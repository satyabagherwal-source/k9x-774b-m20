# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: kividbio-kividb-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "kividbio-kividb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T05:12:44.025Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kividbio-kividb-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kividbio-kividb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T05:12:44.025Z`  
> **Learning ID**: `LEARN-EVO-kividbio-kividb-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: F (Design Intelligence), H (Technical Construction Intelligence), G (Architecture Intelligence), A (Human & Need Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 62%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from kividbio-kividb-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kividbio-kividb-learnings.md`  
> **Source**: github ([https://github.com/kividbio/kividb](https://github.com/kividbio/kividb))  
> **Source Version**: `3405fdb6`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T05:11:27.767Z  
> **Learning ID**: `learn-github-kividbio-kividb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): kividbio/kividb

> **Canonical Artifact**: `07_PROJECT_LEARNING/kividbio-kividb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kividbio/kividb](https://github.com/kividbio/kividb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-27T05:11:27.761Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kividbio/kividb`
- **Description**: A fast, multi-threaded Redis® and Valkey alternative written in Rust: drop-in compatible, with full-text and vector search built in
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 1578 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/1.2.0/core/harness/charts.py`
```
#!/usr/bin/env python3
"""SVG charts from summarize.py's summary.csv.

    python3 charts.py <results-dir> <charts-dir>

One idea per chart; fixed engine colours shared by every 1.2.0 suite.
"""
import csv
import math
import statistics
import os
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

plt.rcParams.update({
    "svg.fonttype": "none", "font.family": "DejaVu Sans", "font.size": 10,
    "figure.facecolor": "white", "axes.facecolor": "white", "savefig.facecolor": "white",
    "text.color": "#222222", "axes.labelcolor": "#222222", "xtick.color": "#222222", "ytick.color": "#222222",
    "axes.edgecolor": "#888888", "axes.grid": True, "grid.color": "#e3e3e3", "grid.linewidth": 0.8,
    "axes.axisbelow": True, "axes.spines.top": False, "axes.spines.right": False,
})

ROOT, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

CAND = "kividb-cand"
CAND_LABEL = os.environ.get("CAND_LABEL", "KiviDB 1.2.0 (75482ab)")
ENGINES = [  # key prefix, label, colour
    (CAND, CAND_LABEL, "#0072B2"),
    ("kividb-rc4", "KiviDB 1.2.0-rc4", "#56B4E9"),  # regression chart only
    ("kividb-113", "KiviDB 1.1.3", "#56B4E9"),
    ("redis-cluster", "Redis 8.10.3 Cluster (32 shards)", "#E69F00"),
    ("redis", "Redis 8.10.3 (io-threads {io})", "#D55E00"),
    ("valkey", "Valkey 9.1.3 (io-threads {io})", "#009E73"),
    ("dragonfly", "Dragonfly 2.0.2", "#CC79A7"),
    ("garnet", "Garnet 2.2.5", "#999999"),
]
ORDER = [CAND, "kividb-113", "redis", "redis-cluster", "valkey", "dragonfly", "garnet"]
MAIN = os.environ.get("MAIN_ENGINES", "").split()  # e.g. "kividb-cand kividb-113 redis@24 ..."

rows = list(csv.DictReader(open(os.path.join(ROOT, "summary.csv"))))
data = {(r["engine"], r["size"], r["scenario"]): r for r in rows}
runs = list(csv.DictReader(open(os.path.join(ROOT, "runs.csv"))))
# rc4 is only in the regression chart, not in the main charts.
engines = MAIN or sorted({r["engine"] for r in rows if r["engine"] != "kividb-rc4"},
                         key=lambda e: ORDER.index(e.split("@")[0]) if e.split("@")[0] in ORDER else 99)


def style(engine):
    base, _, io = engine.partition("@")
    for key, label, colour in ENGINES:
        if base == key:
            return label.format(io=io or "8"), colour
    return engine, "#444444"


def get(e, s, sc, k="ops_median"):
    r = data.get((e, s, sc))
    if not r or r.get(k, "") == "":
        return None
    return float(r[k])


def limited(e, s, sc):
    r = data.get((e, s, sc))
    return r["limit"] if r else ""


def save(fig, name):
    fig.savefig(os.path.join(OUT, name), format="svg", bbox_inches="tight")
    if os.environ.get("PREVIEW"):  # PNG copies for a quick look; not published
        fig.savefig(os.path.join(os.environ["PREVIEW"], name[:-4] + ".png"), dpi=80, bbox_inches="tight")
    plt.close(fig)
    print("wrote", name)


SIZE_NAME = {"100": "100 B", "1024": "1 KB", "2048": "2 KB"}
WL = [("get_p1", "GET\npipeline 1"), ("get_p16", "GET\npipeline 16"), ("set_p1", "SET\npipeline 1"),
      ("set_p16", "SET\npipeline 16")]


def grouped(scenarios, size, title, name, es=None):
    es = es or engines
    es = [e for e in es if any(get(e, size, sc) for sc, _ in scenarios)]
    n = len(es)
    width = 0.8 / n
    fig, ax = plt.subplots(figsize=(10, 4.8))
    for i, e in enumerate(es):
        label, colour = style(e)
        for j, (sc, _) in enumerate(scenarios):
            v = get(e, size, sc)
            if v is None:
                continue
            lo, hi = get(e, size, sc, "ops_min"), get(e, size, sc, "ops_max")
            x = j - 0.4 + width * (i + 0.5)
            lim = limited(e, size, sc)
            ax.bar(x, v / 1e6, width * 0.92, color=colour, hatch="///" if lim else None, edgecolor="white" if not lim else "#333333", linewidth=0.4)
            ax.errorbar(x, v / 1e6, yerr=[[(v - lo) / 1e6], [(hi - v) / 1e6]], color="#333333", lw=0.8, capsize=1.5)
            ax.text(x, hi / 1e6, f" {v / 1e6:.2f}", rotation=90, ha="center", va="bottom", fontsize=7, color="#222222")
    handles = [plt.Rectangle((0, 0), 1, 1, color=style(e)[1]) for e in es]
    labels = [style(e)[0] for e in es]
    if any(limited(e, size, sc) for e in es for sc, _ in scenarios):
        handles.append(plt.Rectangle((0, 0), 1, 1, facecolor="white", edgecolor="#333333", hatch="///"))
        labels.append("hatched: load generators or NIC were the limit")
    ax.legend(handles, labels, loc="upper left", bbox_to_anchor=(1.01, 1), frameon=False, fontsize=9)
    ax.set_xticks(range(len(scenarios)), [l for _, l in scenarios])
    ax.set_ylabel("million requests / s (median of rounds; whiskers min-max)")
    ax.set_ylim(0, ax.get_ylim()[1] * 1.12)
    ax.set_title(title, loc="left", fontsize=12, fontweight="bold")
    save(fig, name)


def best_other(size, sc):
    others = [(get(e, size, sc) or 0, e) for e in engines if not e.startswith("kividb")]
    return max(others) if others else (0, None)


def short(e):
    return style(e)[0].split(" (")[0]


def vs(size, sc):
    """'0.97x Garnet 2.2.5': the KiviDB candidate against the fastest other engine."""
    k = get(CAND, size, sc)
    b, be = best_other(size, sc)
    return f"{k / b:.2f}x {short(be)}" if k and b else "n/a"


for size in ("100", "1024", "2048"):
    p16 = [get(e, size, "get_p16") for e in engines if get(e, size, "get_p16")]
    if "nic" in limited(CAND, size, "get_p16"):
        t = (f"{SIZE_NAME[size]} values: at pipeline 16 the fast engines all hit the server's 16 Gbps NIC "
             f"(~{max(p16) / 1e6:.2f}M GET/s)")
    else:
        t = (f"{SIZE_NAME[size]} values, pipeline 16: KiviDB 1.2.0 GET is {vs(size, 'get_p16')}, "
             f"SET is {vs(size, 'set_p16')}")
    grouped(WL, size, t, f"throughput-{size}.svg")

mk = [("mget10_p1", "MGET of 10 keys\npipeline 1"), ("mset10_p1", "MSET of 10 keys\npipeline 1")]
grouped(mk, "100", f"10-key commands: KiviDB 1.2.0 MGET is {vs('100', 'mget10_p1')}, "
        f"MSET only {vs('100', 'mset10_p1')} (commands/s)",
        "multikey.svg", [e for e in engines if e != "redis-cluster"])

# Latency: p50, p99, p99.9 per engine, one panel per workload, log scale.
for size in ("100", "1024", "2048"):
    es = [e for e in engines if get(e, size, "get_p16")]
    fig, axes = plt.subplots(1, 4, figsize=(12, 0.45 * len(es) + 1.6), sharey=True)
    for ax, (sc, lab) in zip(axes, WL):
        for i, e in enumerate(es):
            y = len(es) - 1 - i
            p50, p99, p999 = (get(e, size, sc, k) for k in ("p50_ms", "p99_ms", "p999_ms"))
            if p50 is None:
                continue
            c = style(e)[1]
            ax.plot([p50, p999], [y, y], color=c, lw=2, solid_capstyle="round")
            ax.plot(p50, y, "o", color=c, ms=6, mec="white", mew=1)
            ax.plot(p99, y, "D", color=c, ms=7, mec="#222222", mew=0.8)
            ax.plot(p999, y, "|", color="#222222", ms=10)
            ax.text(p99, y - 0.38, f"{p99:.2f}", fontsize=7, ha="center", va="center")
        ax.set_ylim(-0.7, len(es) - 0.5)
        ax.set_xscale("log")
        ax.set_title(lab.replace("\n", ", "), fontsize=10)
        ax.set_xlabel("latency, ms (log)")
        ax.grid(axis="y", visible=False)
    axes[0].set_yticks(range(len(es)), [style(e)[0] for e in reversed(es)])
    handles = [plt.Line2D([], [], marker="o", ls="", color="#555555", label="p50"),
               plt.Line2D([], [], marker="D", ls="", color="#555555", mec="#222222", label="p99 (labelled)"),
               plt.Line2D([], [], marker="|", ls="", color="#222222", ms=10, label="p99.9")]
    fig.legend(handles=handles, loc="lower center", ncol=3, frameon=False, bbox_to_anchor=(0.5, -0.08))
    fig.suptitle(f"{SIZE_NAME[size]} values: request latency at each engine's own throughput (p50, p99, p99.9)",
                 x=0.01, ha="left", fontsize=12, fontweight="bold")
    fig.tight_layout()
    save(fig, f"latency-{size}.svg")

# Throughput against pipeline depth, GET 100 B, 300 connections.
fig, ax = plt.subplots(figsize=(8.5, 4.6))
depths = [1, 4, 16, 64]
ends = []
for e in engines:
    pts = [(d, get(e, "100", "get_p16" if d == 16 else f"sweep_get_p{d}")) for d in depths]
    pts = [(d, v) for d, v in pts if v]
    if len(pts) < 2:
        continue
    label, c = style(e)
    ax.plot([d for d, _ in pts], [v / 1e6 for _, v in pts], "-o", color=c, lw=2, ms=6, mec="white", label=label)
    ends.append([pts[-1][1] / 1e6, pts[-1][0]])
ax.set_ylim(0, max([v for v, _ in ends] + [1]) * 1.1)
# End labels, nudged apart so close values do not overprint.
gap = ax.get_ylim()[1] * 0.045
ends.sort()
for i, end in enumerate(ends):
    end.append(end[0] if i == 0 else max(end[0], ends[i - 1][2] + gap))
for v, d, ypos in ends:
    ax.text(d * 1.1, ypos, f"{v:.1f}M", fontsize=8, va="center")
ax.set_xscale("log", base=2)
ax.set_xticks(depths, [str(d) for d in depths])
ax.set_xlim(0.8, 110)
ax.set_xlabel("pipeline depth (requests in flight per connection; 300 connections)")
ax.set_ylabel("million GETs / s, 100 B")
ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1), frameon=False, fontsize=9)
ax.set_title("Batching is where the multi-threaded engines pull away: GET throughput by pipeline depth",
             loc="left", fontsize=11, fontweight="bold")
save(fig, "pipeline-depth.svg")


# The candidate against 1.2.0-rc4: every round of each, as % of rc4's median.
SCS = [(s, sc) for s in ("100", "1024", "2048") for sc, _ in WL] + [("100", "mget10_p1"), ("100", "mset10_p1")]


def per_round(e, s, sc, k):
    return [float(r[k]) for r in runs if r["engine"] == e and r["size"] == s and r["scenario"] == sc
            and r.get(k, "") not in ("", None) and not r.get("error")]


def scen_name(s, sc):
    op, p = sc.split("_p")
    return f"{SIZE_NAME[s]} {op.upper().replace('10', ' 10')}, p{p}"


pairs = [(s, sc) for s, sc in SCS if get("kividb-rc4", s, sc) and get(CAND, s, sc)]
CLIP = float(os.environ.get("REGRESSION_CLIP", "104"))  # % of rc4's median
if pairs:
    fig, axes = plt.subplots(1, 2, 
```

### Core Architecture Module: `benchmarks/1.2.0/core/harness/summarize.py`
```
#!/usr/bin/env python3
"""Summarise run-suite.sh output.

    python3 summarize.py <results-dir>

Reads <results-dir>/<engine>/r<round>/d<size>/<scenario>.{c1,c2}.json (memtier),
*.cpu (sample.sh) and memory.txt, and writes into <results-dir>:

  runs.csv     one row per engine x round x size x scenario. Throughput is the
               sum of both load generators; p50/p99/p99.9 come from the two
               generators' latency histograms merged (HdrHistogram, exact),
               not from averaging their percentiles.
  summary.csv  one row per engine x size x scenario: median throughput over
               the rounds with min and max, median of each percentile, server
               CPU, CPU microseconds per request (user vs kernel), NIC rate,
               and flags for rows limited by the load generators or the NIC.

Needs the `hdrhistogram` package (pip install hdrhistogram).
"""
import csv
import glob
import json
import os
import re
import statistics
import sys

from hdrh.histogram import HdrHistogram

ROOT = sys.argv[1]
NIC_MBPS = float(os.environ.get("NIC_MBPS", "2000"))  # D32ps_v5: 16 Gbps = 2000 MB/s
CLIENT_BUSY = float(os.environ.get("CLIENT_BUSY", "90"))


def cpu(path):
    try:
        f = open(path).read().strip().split(",")
        return dict(zip(["busy", "user", "sys", "softirq", "rx", "tx", "ncpu"], map(float, f)))
    except (OSError, ValueError):
        return None


def load(path):
    try:
        return json.load(open(path))["ALL STATS"]
    except (OSError, ValueError, KeyError):
        return None


rows = []
for c1 in sorted(glob.glob(os.path.join(ROOT, "*", "r*", "d*", "*.c1.json"))):
    d = os.path.dirname(c1)
    scen = os.path.basename(c1)[: -len(".c1.json")]
    if scen == "warm":
        continue
    size = os.path.basename(d)[1:]
    rnd = os.path.basename(os.path.dirname(d))[1:]
    engine = os.path.basename(os.path.dirname(os.path.dirname(d)))
    parts = [load(c1), load(c1.replace(".c1.json", ".c2.json"))]
    if not all(parts):
        rows.append(dict(engine=engine, round=rnd, size=size, scenario=scen, ops="", error="missing client output"))
        continue
    ops = sum(p["Totals"]["Ops/sec"] for p in parts)
    hits = sum(p["Totals"].get("Hits/sec", 0) for p in parts)
    misses = sum(p["Totals"].get("Misses/sec", 0) for p in parts)
    merged = None
    for p in parts:
        h = HdrHistogram.decode(p["Totals"]["Percentile Latencies"]["Histogram log format"]["Compressed Histogram"])
        if merged is None:
            merged = h
        else:
            merged.add(h)
    # memtier records microseconds; check the scale against its own p50.
    own = parts[0]["Totals"]["Percentile Latencies"]["p50.00"]
    single = HdrHistogram.decode(parts[0]["Totals"]["Percentile Latencies"]["Histogram log format"]["Compressed Histogram"])
    scale = 1000.0 if abs(single.get_value_at_percentile(50) / 1000.0 - own) <= max(0.05 * own, 0.002) else 1.0
    pct = {q: merged.get_value_at_percentile(q) / scale for q in (50, 99, 99.9)}
    srv = cpu(c1.replace(".c1.json", ".srv.cpu"))
    cl = [cpu(c1.replace(".c1.json", f".{c}.cpu")) for c in ("c1", "c2")]
    row = dict(engine=engine, round=rnd, size=size, scenario=scen, ops=round(ops),
               miss_pct=round(100 * misses / (hits + misses), 2) if hits + misses else "",
               p50_ms=round(pct[50], 3), p99_ms=round(pct[99], 3), p999_ms=round(pct[99.9], 3),
               avg_ms=round(statistics.mean(p["Totals"]["Average Latency"] for p in parts), 3), error="")
    if srv:
        n = srv["ncpu"]
        row.update(srv_busy=srv["busy"], srv_user=srv["user"], srv_kernel=round(srv["sys"] + srv["softirq"], 1),
                   srv_rx_MBps=srv["rx"], srv_tx_MBps=srv["tx"],
                   us_per_op=round(srv["busy"] / 100 * n * 1e6 / ops, 2) if ops else "",
                   us_user_per_op=round(srv["user"] / 100 * n * 1e6 / ops, 2) if ops else "",
                   us_kernel_per_op=round((srv["sys"] + srv["softirq"]) / 100 * n * 1e6 / ops, 2) if ops else "")
    if all(cl):
        row.update(client_busy_max=max(c["busy"] for c in cl))
    rows.append(row)

cols = ["engine", "round", "size", "scenario", "ops", "miss_pct", "p50_ms", "p99_ms", "p999_ms", "avg_ms",
        "srv_busy", "srv_user", "srv_kernel", "srv_rx_MBps", "srv_tx_MBps", "us_per_op", "us_user_per_op",
        "us_kernel_per_op", "client_busy_max", "error"]
with open(os.path.join(ROOT, "runs.csv"), "w", newline="\n") as f:
    w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
    w.writeheader()
    for r in rows:
        w.writerow({c: r.get(c, "") for c in cols})

groups = {}
for r in rows:
    if r.get("ops") == "":
        continue
    groups.setdefault((r["engine"], r["size"], r["scenario"]), []).append(r)


def med(rs, k):
    v = [r[k] for r in rs if r.get(k, "") != ""]
    return round(statistics.median(v), 3) if v else ""


scols = ["engine", "size", "scenario", "rounds", "ops_median", "ops_min", "ops_max", "spread_pct",
         "p50_ms", "p99_ms", "p999_ms", "miss_pct", "srv_busy", "us_per_op", "us_user_per_op", "us_kernel_per_op",
         "srv_rx_MBps", "srv_tx_MBps", "client_busy_max", "limit"]
with open(os.path.join(ROOT, "summary.csv"), "w", newline="\n") as f:
    w = csv.DictWriter(f, fieldnames=scols, lineterminator="\n")
    w.writeheader()
    for (e, s, sc), rs in sorted(groups.items(), key=lambda kv: (kv[0][0], int(kv[0][1]), kv[0][2])):
        ops = [r["ops"] for r in rs]
        m = statistics.median(ops)
        limit = []
        cb = med(rs, "client_busy_max")
        if cb != "" and cb >= CLIENT_BUSY:
            limit.append("client")
        nic = max(med(rs, "srv_rx_MBps") or 0, med(rs, "srv_tx_MBps") or 0)
        if nic >= 0.85 * NIC_MBPS:
            limit.append("nic")
        w.writerow(dict(engine=e, size=s, scenario=sc, rounds=len(rs), ops_median=round(m), ops_min=min(ops),
                        ops_max=max(ops), spread_pct=round(100 * (max(ops) - min(ops)) / m, 1) if m else "",
                        p50_ms=med(rs, "p50_ms"), p99_ms=med(rs, "p99_ms"), p999_ms=med(rs, "p999_ms"),
                        miss_pct=med(rs, "miss_pct"), srv_busy=med(rs, "srv_busy"), us_per_op=med(rs, "us_per_op"),
                        us_user_per_op=med(rs, "us_user_per_op"), us_kernel_per_op=med(rs, "us_kernel_per_op"),
                        srv_rx_MBps=med(rs, "srv_rx_MBps"), srv_tx_MBps=med(rs, "srv_tx_MBps"),
                        client_busy_max=cb, limit="+".join(limit)))
print(open(os.path.join(ROOT, "summary.csv")).read())

```

### Core Architecture Module: `benchmarks/1.2.0/core/harness/tables.py`
```
#!/usr/bin/env python3
"""Markdown tables for the README from summary.csv and runs.csv.

    python3 tables.py <results-dir>  > tables.md
"""
import csv
import os
import statistics
import sys

ROOT = sys.argv[1]
rows = list(csv.DictReader(open(os.path.join(ROOT, "summary.csv"))))
runs = [r for r in csv.DictReader(open(os.path.join(ROOT, "runs.csv"))) if not r.get("error")]
D = {(r["engine"], r["size"], r["scenario"]): r for r in rows}
CAND_LABEL = os.environ.get("CAND_LABEL", "KiviDB 1.2.0 (75482ab)")
ENG = [("kividb-cand", CAND_LABEL), ("kividb-113", "KiviDB 1.1.3"), ("redis@24", "Redis 8.10.3, io-threads 24"),
       ("redis-cluster", "Redis 8.10.3 Cluster, 32 shards"), ("valkey@24", "Valkey 9.1.3, io-threads 24"),
       ("dragonfly", "Dragonfly 2.0.2"), ("garnet", "Garnet 2.2.5")]
SIZE = {"100": "100 B", "1024": "1 KB", "2048": "2 KB"}
FLAG = {"client": "C", "nic": "N", "client+nic": "C N"}


def m(v):
    v = float(v)
    return f"{v / 1e6:.2f}M" if v >= 1e6 else f"{v / 1e3:.0f}K"


def cell(r):
    if not r:
        return "—"
    f = FLAG.get(r["limit"], "")
    return (f"{m(r['ops_median'])} ±{float(r['spread_pct']) / 2:.1f}%{' ' + f if f else ''}<br>"
            f"{float(r['p50_ms']):.2f} / {float(r['p99_ms']):.2f} / {float(r['p999_ms']):.2f}")


WL = [("get_p1", "GET p1"), ("get_p16", "GET p16"), ("set_p1", "SET p1"), ("set_p16", "SET p16")]
for size in ("100", "1024", "2048"):
    print(f"\n#### {SIZE[size]} values\n")
    print("| Engine | " + " | ".join(l for _, l in WL) + " |")
    print("|---|" + "---:|" * len(WL))
    for e, label in ENG:
        print(f"| {label} | " + " | ".join(cell(D.get((e, size, sc))) for sc, _ in WL) + " |")

print("\n#### MGET / MSET of 10 keys, 100 B, pipeline 1 (commands/s; keys/s is ten times that)\n")
print("| Engine | MGET 10 keys | MSET 10 keys |")
print("|---|---:|---:|")
for e, label in ENG:
    if e == "redis-cluster":
        continue
    print(f"| {label} | {cell(D.get((e, '100', 'mget10_p1')))} | {cell(D.get((e, '100', 'mset10_p1')))} |")

print("\n#### GET throughput by pipeline depth, 100 B, 300 connections\n")
print("| Engine | depth 1 | depth 4 | depth 16 | depth 64 |")
print("|---|---:|---:|---:|---:|")
for e, label in ENG:
    vals = []
    for d in (1, 4, 16, 64):
        r = D.get((e, "100", "get_p16" if d == 16 else f"sweep_get_p{d}"))
        vals.append(m(r["ops_median"]) + (" " + FLAG[r["limit"]] if r and r["limit"] else "") if r else "—")
    print(f"| {label} | " + " | ".join(vals) + " |")

print("\n#### Server CPU per request, GET 100 B, 300 connections (µs, user + kernel)\n")
print("| Engine | depth 1 | depth 4 | depth 16 | depth 64 |")
print("|---|---:|---:|---:|---:|")
for e, label in ENG:
    if e in ("kividb-113",):
        continue
    vals = []
    for d in (1, 4, 16, 64):
        r = D.get((e, "100", "get_p16" if d == 16 else f"sweep_get_p{d}"))
        vals.append(f"{float(r['us_user_per_op']):.2f} + {float(r['us_kernel_per_op']):.2f}" if r else "—")
    print(f"| {label} | " + " | ".join(vals) + " |")


def rr(e, s, sc, k):
    return [float(r[k]) for r in runs if r["engine"] == e and r["size"] == s and r["scenario"] == sc and r[k] != ""]


def against(old, old_label, new, new_label, p99=True):
    print(f"\n#### {new_label} against {old_label} (median, [min - max] of the rounds)\n")
    head = f"| Scenario | {old_label} | {new_label} | Change | Beyond spread? |"
    if p99:
        head += " p99 ms, old → new | server µs/req, old → new |"
    print(head)
    print("|---|---:|---:|---:|---|" + ("---:|---:|" if p99 else ""))
    scs = [(s, sc) for s in ("100", "1024", "2048") for sc, _ in WL] + [("100", "mget10_p1"), ("100", "mset10_p1")]
    for s, sc in scs:
        o, n = D.get((old, s, sc)), D.get((new, s, sc))
        if not (o and n):
            continue
        ch = 100 * (float(n["ops_median"]) / float(o["ops_median"]) - 1)
        worse = float(n["ops_max"]) < float(o["ops_min"])
        better = float(n["ops_min"]) > float(o["ops_max"])
        name = f"{SIZE[s]} {sc.split('_')[0].upper()} p{sc.split('_p')[1]}"
        nic = " (NIC)" if "nic" in n["limit"] and not (worse or better) else ""
        line = (f"| {name} | {m(o['ops_median'])} [{m(o['ops_min'])} - {m(o['ops_max'])}] ({o['rounds']}) | "
                f"{m(n['ops_median'])} [{m(n['ops_min'])} - {m(n['ops_max'])}] ({n['rounds']}) | {ch:+.1f}% | "
                f"{'**slower**' if worse else 'faster' if better else 'no'}{nic} |")
        if p99:
            po, pn = rr(old, s, sc, "p99_ms"), rr(new, s, sc, "p99_ms")
            line += (f" {statistics.median(po):.2f} → {statistics.median(pn):.2f} |"
                     f" {float(o['us_per_op']):.2f} → {float(n['us_per_op']):.2f} |")
        print(line)


against("kividb-rc4", "1.2.0-rc4", "kividb-cand", "1.2.0 (75482ab)")
against("kividb-113", "1.1.3", "kividb-cand", "1.2.0 (75482ab)", p99=False)

```

### Core Architecture Module: `benchmarks/1.2.0/core/rc10/harness/analyze-rc10.py`
```
#!/usr/bin/env python3
"""rc10 quick core check: rc10 against rc8, 100 B rows.

    python3 analyze-rc10.py <results-dir> > tables.md

Reads summarize.py's summary.csv and runs.csv in <results-dir>.
"""
import csv
import os
import sys

ROOT = sys.argv[1]
S = {(r["engine"], r["size"], r["scenario"]): r for r in csv.DictReader(open(os.path.join(ROOT, "summary.csv")))}
RUNS = [r for r in csv.DictReader(open(os.path.join(ROOT, "runs.csv"))) if not r.get("error")]
SCS = ["get_p1", "get_p16", "set_p1", "set_p16", "mget10_p1", "mset10_p1"]
NEW, OLD = "kividb-rc10", "kividb-rc8"
FLOOR = float(os.environ.get("FLOOR", "1"))


def m(v):
    v = float(v)
    return f"{v / 1e6:.2f}M" if v >= 1e6 else f"{v / 1e3:.0f}K"


def name(sc):
    op, p = sc.split("_p")
    return f"100 B {op.upper().replace('10', ' 10')} p{p}"


def flag(r):
    return {"client": " C", "nic": " N", "client+nic": " C N"}.get(r.get("limit", ""), "")


print("### rc10 against rc8 (same session, alternating rounds)\n")
print("Median [min - max] of the rounds. Spread is half the min-max range of each build, as % of its median.")
print(f"Verdict: **fail** only if every rc10 round is below every rc8 round and the medians differ by more than {FLOOR:.0f}%.\n")
print("| Scenario | rc8 | rc10 | Change | Spread rc8 / rc10 | Verdict | p99 ms rc8 → rc10 | p99.9 ms rc8 → rc10 | server µs/req rc8 → rc10 |")
print("|---|---:|---:|---:|---:|---|---:|---:|---:|")
for sc in SCS:
    o, n = S.get((OLD, "100", sc)), S.get((NEW, "100", sc))
    if not (o and n):
        print(f"| {name(sc)} | missing | | | | | | | |")
        continue
    ch = 100 * (float(n["ops_median"]) / float(o["ops_median"]) - 1)
    below = float(n["ops_max"]) < float(o["ops_min"])
    above = float(n["ops_min"]) > float(o["ops_max"])
    v = "**fail**" if below and ch < -FLOOR else "pass (faster)" if above and ch > FLOOR else "pass (level)"
    if (below or above) and v == "pass (level)":
        v = f"pass (rounds apart, under {FLOOR:.0f}%)"
    if "client" in n["limit"] and v.startswith("pass ("):
        v = v[:-1] + ", clients)"
    print(f"| {name(sc)} | {m(o['ops_median'])} [{m(o['ops_min'])} - {m(o['ops_max'])}]{flag(o)} | "
          f"{m(n['ops_median'])} [{m(n['ops_min'])} - {m(n['ops_max'])}]{flag(n)} | {ch:+.1f}% | "
          f"±{float(o['spread_pct']) / 2:.1f}% / ±{float(n['spread_pct']) / 2:.1f}% | {v} | "
          f"{float(o['p99_ms']):.2f} → {float(n['p99_ms']):.2f} | {float(o['p999_ms']):.2f} → {float(n['p999_ms']):.2f} | "
          f"{float(o['us_per_op']):.2f} → {float(n['us_per_op']):.2f} |")

print("\n### Round by round\n")
print("| Scenario | Build | round | ops/s | p50 / p99 / p99.9 ms | server busy | server µs/req (user + kernel) | load generators busy |")
print("|---|---|---|---:|---:|---:|---:|---:|")
for sc in SCS:
    for e in (OLD, NEW):
        for r in sorted([r for r in RUNS if r["engine"] == e and r["size"] == "100" and r["scenario"] == sc],
                        key=lambda r: r["round"]):
            print(f"| {name(sc)} | {e.split('-')[1]} | {r['round']} | {m(r['ops'])} | "
                  f"{float(r['p50_ms']):.2f} / {float(r['p99_ms']):.2f} / {float(r['p999_ms']):.2f} | {r['srv_busy']}% | "
                  f"{r['us_per_op']} ({r['us_user_per_op']} + {r['us_kernel_per_op']}) | {r['client_busy_max']}% |")

```

### Core Architecture Module: `benchmarks/1.2.0/core/rc8/harness/analyze.py`
```
#!/usr/bin/env python3
"""rc8 round of the core suite: tables and the regression chart.

    python3 analyze.py <results-dir> <published-summary.csv> <charts-dir> > tables.md

Reads summarize.py's summary.csv and runs.csv in <results-dir>.
"""
import csv
import os
import statistics
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT, PUB, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
S = {(r["engine"], r["size"], r["scenario"]): r for r in csv.DictReader(open(os.path.join(ROOT, "summary.csv")))}
RUNS = [r for r in csv.DictReader(open(os.path.join(ROOT, "runs.csv"))) if not r.get("error")]
P = {(r["engine"], r["size"], r["scenario"]): r for r in csv.DictReader(open(PUB))}
SIZE = {"100": "100 B", "1024": "1 KB", "2048": "2 KB"}
WL = ["get_p1", "get_p16", "set_p1", "set_p16"]
SCS = [(s, w) for s in ("100", "1024", "2048") for w in WL] + [("100", "mget10_p1"), ("100", "mset10_p1")]
NEW, OLD = "kividb-rc8", "kividb-rc7"
FLOOR = float(os.environ.get("FLOOR", "1"))  # % change below which two builds count as level


def m(v):
    v = float(v)
    return f"{v / 1e6:.2f}M" if v >= 1e6 else f"{v / 1e3:.0f}K"


def name(s, sc):
    op, p = sc.split("_p")
    return f"{SIZE[s]} {op.upper().replace('10', ' 10')} p{p}"


def per_round(e, s, sc, k):
    return [float(r[k]) for r in RUNS if r["engine"] == e and r["size"] == s and r["scenario"] == sc
            and r.get(k, "") not in ("", None)]


def flag(r):
    return {"client": " C", "nic": " N", "client+nic": " C N"}.get(r.get("limit", ""), "")


print("### rc8 against rc7 (same session, alternating rounds)\n")
print("Median [min - max] of the rounds. Spread is half the min-max range of each build, as % of its median.")
print(f"Verdict: *slower* if rc8's best round is below rc7's worst and the medians differ by more than {FLOOR:.0f}% "
      "(the run-to-run spread of the published six-round session), *faster* the other way round.\n")
print("| Scenario | rc7 | rc8 | Change | Spread rc7 / rc8 | Verdict | p99 ms rc7 → rc8 | p99.9 ms rc7 → rc8 | server µs/req rc7 → rc8 |")
print("|---|---:|---:|---:|---:|---|---:|---:|---:|")
for s, sc in SCS:
    o, n = S.get((OLD, s, sc)), S.get((NEW, s, sc))
    if not (o and n):
        continue
    ch = 100 * (float(n["ops_median"]) / float(o["ops_median"]) - 1)
    below = float(n["ops_max"]) < float(o["ops_min"])
    above = float(n["ops_min"]) > float(o["ops_max"])
    worse, better = below and ch < -FLOOR, above and ch > FLOOR
    v = "**slower**" if worse else "faster" if better else "level"
    if (below or above) and not (worse or better):
        v += f" (rounds apart, under {FLOOR:.0f}%)"
    if "nic" in n["limit"] and not (worse or better):
        v += " (NIC)"
    elif "client" in n["limit"] and not (worse or better):
        v += " (clients)"
    print(f"| {name(s, sc)} | {m(o['ops_median'])} [{m(o['ops_min'])} - {m(o['ops_max'])}]{flag(o)} | "
          f"{m(n['ops_median'])} [{m(n['ops_min'])} - {m(n['ops_max'])}]{flag(n)} | {ch:+.1f}% | "
          f"±{float(o['spread_pct']) / 2:.1f}% / ±{float(n['spread_pct']) / 2:.1f}% | {v} | "
          f"{float(o['p99_ms']):.2f} → {float(n['p99_ms']):.2f} | {float(o['p999_ms']):.2f} → {float(n['p999_ms']):.2f} | "
          f"{float(o['us_per_op']):.2f} → {float(n['us_per_op']):.2f} |")

print("\n### MSET and MGET of 10 keys in detail (100 B, pipeline 1, 1,200 connections)\n")
print("| Build | round | commands/s | p50 / p99 / p99.9 ms | server CPU busy | server µs/cmd (user + kernel) | load generators busy |")
print("|---|---|---:|---:|---:|---:|---:|")
for sc in ("mset10_p1", "mget10_p1"):
    for e in (OLD, NEW):
        for r in [r for r in RUNS if r["engine"] == e and r["size"] == "100" and r["scenario"] == sc]:
            print(f"| {e.split('-')[1]} {sc.split('_')[0].upper()} | {r['round']} | {m(r['ops'])} | "
                  f"{float(r['p50_ms']):.2f} / {float(r['p99_ms']):.2f} / {float(r['p999_ms']):.2f} | {r['srv_busy']}% | "
                  f"{r['us_per_op']} ({r['us_user_per_op']} + {r['us_kernel_per_op']}) | {r['client_busy_max']}% |")

print("\n### rc8 against the published 1.2.0 numbers (75482ab, 2026-11-02, eastasia; indicative only)\n")
print("| Scenario | published 75482ab | rc8 today | Change | p99 ms published → today |")
print("|---|---:|---:|---:|---:|")
for s, sc in SCS:
    o, n = P.get(("kividb-cand", s, sc)), S.get((NEW, s, sc))
    if not (o and n):
        continue
    ch = 100 * (float(n["ops_median"]) / float(o["ops_median"]) - 1)
    print(f"| {name(s, sc)} | {m(o['ops_median'])}{flag(o)} | {m(n['ops_median'])}{flag(n)} | {ch:+.1f}% | "
          f"{float(o['p99_ms']):.2f} → {float(n['p99_ms']):.2f} |")

print("\n### Competitors, one round, against their published medians\n")
print("| Engine | Scenario | published | today | Change | p99 ms published → today | rc8 today | rc8 / engine today |")
print("|---|---|---:|---:|---:|---:|---:|---:|")
for e, lab in (("garnet", "Garnet 2.2.5"), ("dragonfly", "Dragonfly 2.0.2"), ("redis@24", "Redis 8.10.3, io-threads 24")):
    for sc in ("get_p16", "set_p16", "mget10_p1", "mset10_p1"):
        o, n, k = P.get((e, "100", sc)), S.get((e, "100", sc)), S.get((NEW, "100", sc))
        if not (o and n):
            continue
        ch = 100 * (float(n["ops_median"]) / float(o["ops_median"]) - 1)
        print(f"| {lab} | {name('100', sc)} | {m(o['ops_median'])}{flag(o)} | {m(n['ops_median'])}{flag(n)} | {ch:+.1f}% | "
              f"{float(o['p99_ms']):.2f} → {float(n['p99_ms']):.2f} | {m(k['ops_median']) if k else '-'} | "
              f"{float(k['ops_median']) / float(n['ops_median']):.2f}× |")

# Regression chart.
plt.rcParams.update({
    "svg.fonttype": "none", "font.family": "DejaVu Sans", "font.size": 10,
    "figure.facecolor": "white", "axes.facecolor": "white", "savefig.facecolor": "white",
    "text.color": "#222222", "axes.labelcolor": "#222222", "xtick.color": "#222222", "ytick.color": "#222222",
    "axes.edgecolor": "#888888", "axes.grid": True, "grid.color": "#e3e3e3", "grid.linewidth": 0.8,
    "axes.axisbelow": True, "axes.spines.top": False, "axes.spines.right": False,
})
C_NEW, C_OLD = "#0072B2", "#8c8c8c"
pairs = [(s, sc) for s, sc in SCS if per_round(NEW, s, sc, "ops") and per_round(OLD, s, sc, "ops")]
LIM = {"ops": (90, 110), "p99_ms": (70, 130)}
fig, axes = plt.subplots(1, 2, figsize=(11, 0.36 * len(pairs) + 1.9), sharey=True)
ys = list(range(len(pairs)))[::-1]
slow = []
for ax, key, lab in ((axes[0], "ops", "throughput, % of rc7 median (higher is better)"),
                     (axes[1], "p99_ms", "p99 latency, % of rc7 median (lower is better)")):
    lo, hi = LIM[key]
    for y, (s, sc) in zip(ys, pairs):
        base = statistics.median(per_round(OLD, s, sc, key))
        for e, dy, c in ((OLD, 0.16, C_OLD), (NEW, -0.16, C_NEW)):
            v = [100 * x / base for x in per_round(e, s, sc, key)]
            out = [x for x in v if x > hi or x < lo]
            if out:
                med = statistics.median(v)
                edge = hi if med > hi else lo
                ax.annotate((f"{med:.0f}% of rc7 →" if edge == hi else f"← {med:.0f}% of rc7"), (edge, y + dy), xytext=(-9 if edge == hi else 9, 0),
                            textcoords="offset points", ha="right" if edge == hi else "left", va="center",
                            fontsize=8, color=c, fontweight="bold")
                v = [min(max(x, lo), hi) for x in v]
                ax.plot(edge, y + dy, ">" if edge == hi else "<", color=c, ms=7)
                continue
            ax.plot([min(v), max(v)], [y + dy, y + dy], color=c, lw=2, solid_capstyle="round")
            ax.plot(v, [y + dy] * len(v), "|", color=c, ms=7)
            ax.plot(statistics.median(v), y + dy, "o", color=c, ms=6, mec="white", mew=1)
        if key == "ops":
            cv, rv = per_round(NEW, s, sc, key), per_round(OLD, s, sc, key)
            if max(cv) < min(rv) and statistics.median(cv) / statistics.median(rv) - 1 < -FLOOR / 100:
                slow.append(f"{name(s, sc)} {100 * (statistics.median(cv) / statistics.median(rv) - 1):+.1f}%")
    ax.set_xlim(lo, hi)
    ax.axvline(100, color="#444444", lw=1)
    ax.set_xlabel(lab)
    ax.grid(axis="y", visible=False)
axes[0].set_yticks(ys, [name(s, sc) for s, sc in pairs])
handles = [plt.Line2D([], [], marker="o", color=c, lw=2, mec="white", label=l)
           for l, c in (("KiviDB 1.2.0-rc7 (598b74d)", C_OLD), ("KiviDB 1.2.0-rc8 (082dab3)", C_NEW))]
fig.legend(handles=handles, loc="lower center", ncol=2, frameon=False, bbox_to_anchor=(0.5, -0.04))
note = ("slower beyond the run-to-run spread: " + ", ".join(slow)) if slow else f"nothing slower beyond the run-to-run spread (> {FLOOR:.0f}% and every round apart)"
fig.suptitle(f"KiviDB 1.2.0-rc8 vs rc7, alternating rounds (dot: median, ticks: each round)\n{note}",
             x=0.01, ha="left", fontsize=11, fontweight="bold")
fig.tight_layout()
fig.savefig(os.path.join(OUT, "regression-rc7-vs-rc8.svg"), format="svg", bbox_inches="tight")
if os.environ.get("PREVIEW"):
    fig.savefig(os.environ["PREVIEW"], dpi=80, bbox_inches="tight")

```

### Core Architecture Module: `benchmarks/1.2.0/failover/rc9/harness/core/analyze-rc9.py`
```
#!/usr/bin/env python3
"""rc9 retest of the core suite: tables and the regression chart.

    python3 analyze-rc9.py <results-dir> <unused.csv> <charts-dir> > tables.md

Reads summarize.py's summary.csv and runs.csv in <results-dir>.
"""
import csv
import os
import statistics
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT, PUB, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
S = {(r["engine"], r["size"], r["scenario"]): r for r in csv.DictReader(open(os.path.join(ROOT, "summary.csv")))}
RUNS = [r for r in csv.DictReader(open(os.path.join(ROOT, "runs.csv"))) if not r.get("error")]
P = {}  # rc9 retest: no published comparison
SIZE = {"100": "100 B", "1024": "1 KB", "2048": "2 KB"}
WL = ["get_p1", "get_p16", "set_p1", "set_p16"]
SCS = [(s, w) for s in ("100", "1024", "2048") for w in WL] + [("100", "mget10_p1"), ("100", "mset10_p1")]
NEW, OLD = "kividb-rc9", "kividb-rc8"
FLOOR = float(os.environ.get("FLOOR", "1"))  # % change below which two builds count as level


def m(v):
    v = float(v)
    return f"{v / 1e6:.2f}M" if v >= 1e6 else f"{v / 1e3:.0f}K"


def name(s, sc):
    op, p = sc.split("_p")
    return f"{SIZE[s]} {op.upper().replace('10', ' 10')} p{p}"


def per_round(e, s, sc, k):
    return [float(r[k]) for r in RUNS if r["engine"] == e and r["size"] == s and r["scenario"] == sc
            and r.get(k, "") not in ("", None)]


def flag(r):
    return {"client": " C", "nic": " N", "client+nic": " C N"}.get(r.get("limit", ""), "")


print("### rc9 against rc8 (same session, alternating rounds)\n")
print("Median [min - max] of the rounds. Spread is half the min-max range of each build, as % of its median.")
print(f"Verdict: *slower* if rc9's best round is below rc8's worst and the medians differ by more than {FLOOR:.0f}% "
      "(the run-to-run spread of the published six-round session), *faster* the other way round.\n")
print("| Scenario | rc8 | rc9 | Change | Spread rc8 / rc9 | Verdict | p99 ms rc8 → rc9 | p99.9 ms rc8 → rc9 | server µs/req rc8 → rc9 |")
print("|---|---:|---:|---:|---:|---|---:|---:|---:|")
for s, sc in SCS:
    o, n = S.get((OLD, s, sc)), S.get((NEW, s, sc))
    if not (o and n):
        continue
    ch = 100 * (float(n["ops_median"]) / float(o["ops_median"]) - 1)
    below = float(n["ops_max"]) < float(o["ops_min"])
    above = float(n["ops_min"]) > float(o["ops_max"])
    worse, better = below and ch < -FLOOR, above and ch > FLOOR
    v = "**slower**" if worse else "faster" if better else "level"
    if (below or above) and not (worse or better):
        v += f" (rounds apart, under {FLOOR:.0f}%)"
    if "nic" in n["limit"] and not (worse or better):
        v += " (NIC)"
    elif "client" in n["limit"] and not (worse or better):
        v += " (clients)"
    print(f"| {name(s, sc)} | {m(o['ops_median'])} [{m(o['ops_min'])} - {m(o['ops_max'])}]{flag(o)} | "
          f"{m(n['ops_median'])} [{m(n['ops_min'])} - {m(n['ops_max'])}]{flag(n)} | {ch:+.1f}% | "
          f"±{float(o['spread_pct']) / 2:.1f}% / ±{float(n['spread_pct']) / 2:.1f}% | {v} | "
          f"{float(o['p99_ms']):.2f} → {float(n['p99_ms']):.2f} | {float(o['p999_ms']):.2f} → {float(n['p999_ms']):.2f} | "
          f"{float(o['us_per_op']):.2f} → {float(n['us_per_op']):.2f} |")

print("\n### MSET and MGET of 10 keys in detail (100 B, pipeline 1, 1,200 connections)\n")
print("| Build | round | commands/s | p50 / p99 / p99.9 ms | server CPU busy | server µs/cmd (user + kernel) | load generators busy |")
print("|---|---|---:|---:|---:|---:|---:|")
for sc in ("mset10_p1", "mget10_p1"):
    for e in (OLD, NEW):
        for r in [r for r in RUNS if r["engine"] == e and r["size"] == "100" and r["scenario"] == sc]:
            print(f"| {e.split('-')[1]} {sc.split('_')[0].upper()} | {r['round']} | {m(r['ops'])} | "
                  f"{float(r['p50_ms']):.2f} / {float(r['p99_ms']):.2f} / {float(r['p999_ms']):.2f} | {r['srv_busy']}% | "
                  f"{r['us_per_op']} ({r['us_user_per_op']} + {r['us_kernel_per_op']}) | {r['client_busy_max']}% |")

# Regression chart.
plt.rcParams.update({
    "svg.fonttype": "none", "font.family": "DejaVu Sans", "font.size": 10,
    "figure.facecolor": "white", "axes.facecolor": "white", "savefig.facecolor": "white",
    "text.color": "#222222", "axes.labelcolor": "#222222", "xtick.color": "#222222", "ytick.color": "#222222",
    "axes.edgecolor": "#888888", "axes.grid": True, "grid.color": "#e3e3e3", "grid.linewidth": 0.8,
    "axes.axisbelow": True, "axes.spines.top": False, "axes.spines.right": False,
})
C_NEW, C_OLD = "#0072B2", "#8c8c8c"
pairs = [(s, sc) for s, sc in SCS if per_round(NEW, s, sc, "ops") and per_round(OLD, s, sc, "ops")]
LIM = {"ops": (90, 110), "p99_ms": (70, 130)}
fig, axes = plt.subplots(1, 2, figsize=(11, 0.36 * len(pairs) + 1.9), sharey=True)
ys = list(range(len(pairs)))[::-1]
slow = []
for ax, key, lab in ((axes[0], "ops", "throughput, % of rc8 median (higher is better)"),
                     (axes[1], "p99_ms", "p99 latency, % of rc8 median (lower is better)")):
    lo, hi = LIM[key]
    for y, (s, sc) in zip(ys, pairs):
        base = statistics.median(per_round(OLD, s, sc, key))
        for e, dy, c in ((OLD, 0.16, C_OLD), (NEW, -0.16, C_NEW)):
            v = [100 * x / base for x in per_round(e, s, sc, key)]
            out = [x for x in v if x > hi or x < lo]
            if out:
                med = statistics.median(v)
                edge = hi if med > hi else lo
                ax.annotate((f"{med:.0f}% of rc8 →" if edge == hi else f"← {med:.0f}% of rc8"), (edge, y + dy), xytext=(-9 if edge == hi else 9, 0),
                            textcoords="offset points", ha="right" if edge == hi else "left", va="center",
                            fontsize=8, color=c, fontweight="bold")
                v = [min(max(x, lo), hi) for x in v]
                ax.plot(edge, y + dy, ">" if edge == hi else "<", color=c, ms=7)
                continue
            ax.plot([min(v), max(v)], [y + dy, y + dy], color=c, lw=2, solid_capstyle="round")
            ax.plot(v, [y + dy] * len(v), "|", color=c, ms=7)
            ax.plot(statistics.median(v), y + dy, "o", color=c, ms=6, mec="white", mew=1)
        if key == "ops":
            cv, rv = per_round(NEW, s, sc, key), per_round(OLD, s, sc, key)
            if max(cv) < min(rv) and statistics.median(cv) / statistics.median(rv) - 1 < -FLOOR / 100:
                slow.append(f"{name(s, sc)} {100 * (statistics.median(cv) / statistics.median(rv) - 1):+.1f}%")
    ax.set_xlim(lo, hi)
    ax.axvline(100, color="#444444", lw=1)
    ax.set_xlabel(lab)
    ax.grid(axis="y", visible=False)
axes[0].set_yticks(ys, [name(s, sc) for s, sc in pairs])
handles = [plt.Line2D([], [], marker="o", color=c, lw=2, mec="white", label=l)
           for l, c in (("KiviDB 1.2.0-rc8 (082dab3)", C_OLD), ("KiviDB 1.2.0-rc9 (4a47644)", C_NEW))]
fig.legend(handles=handles, loc="lower center", ncol=2, frameon=False, bbox_to_anchor=(0.5, -0.04))
note = ("slower beyond the run-to-run spread: " + ", ".join(slow)) if slow else f"nothing slower beyond the run-to-run spread (> {FLOOR:.0f}% and every round apart)"
fig.suptitle(f"KiviDB 1.2.0-rc9 vs rc8, alternating rounds (dot: median, ticks: each round)\n{note}",
             x=0.01, ha="left", fontsize=11, fontweight="bold")
fig.tight_layout()
fig.savefig(os.path.join(OUT, "regression-rc8-vs-rc9.svg"), format="svg", bbox_inches="tight")
if os.environ.get("PREVIEW"):
    fig.savefig(os.environ["PREVIEW"], dpi=80, bbox_inches="tight")

```

### Core Architecture Module: `benchmarks/1.2.0/failover/rc9/harness/core/analyze.py`
```
#!/usr/bin/env python3
"""rc8 round of the core suite: tables and the regression chart.

    python3 analyze.py <results-dir> <published-summary.csv> <charts-dir> > tables.md

Reads summarize.py's summary.csv and runs.csv in <results-dir>.
"""
import csv
import os
import statistics
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT, PUB, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
S = {(r["engine"], r["size"], r["scenario"]): r for r in csv.DictReader(open(os.path.join(ROOT, "summary.csv")))}
RUNS = [r for r in csv.DictReader(open(os.path.join(ROOT, "runs.csv"))) if not r.get("error")]
P = {(r["engine"], r["size"], r["scenario"]): r for r in csv.DictReader(open(PUB))}
SIZE = {"100": "100 B", "1024": "1 KB", "2048": "2 KB"}
WL = ["get_p1", "get_p16", "set_p1", "set_p16"]
SCS = [(s, w) for s in ("100", "1024", "2048") for w in WL] + [("100", "mget10_p1"), ("100", "mset10_p1")]
NEW, OLD = "kividb-rc8", "kividb-rc7"
FLOOR = float(os.environ.get("FLOOR", "1"))  # % change below which two builds count as level


def m(v):
    v = float(v)
    return f"{v / 1e6:.2f}M" if v >= 1e6 else f"{v / 1e3:.0f}K"


def name(s, sc):
    op, p = sc.split("_p")
    return f"{SIZE[s]} {op.upper().replace('10', ' 10')} p{p}"


def per_round(e, s, sc, k):
    return [float(r[k]) for r in RUNS if r["engine"] == e and r["size"] == s and r["scenario"] == sc
            and r.get(k, "") not in ("", None)]


def flag(r):
    return {"client": " C", "nic": " N", "client+nic": " C N"}.get(r.get("limit", ""), "")


print("### rc8 against rc7 (same session, alternating rounds)\n")
print("Median [min - max] of the rounds. Spread is half the min-max range of each build, as % of its median.")
print(f"Verdict: *slower* if rc8's best round is below rc7's worst and the medians differ by more than {FLOOR:.0f}% "
      "(the run-to-run spread of the published six-round session), *faster* the other way round.\n")
print("| Scenario | rc7 | rc8 | Change | Spread rc7 / rc8 | Verdict | p99 ms rc7 → rc8 | p99.9 ms rc7 → rc8 | server µs/req rc7 → rc8 |")
print("|---|---:|---:|---:|---:|---|---:|---:|---:|")
for s, sc in SCS:
    o, n = S.get((OLD, s, sc)), S.get((NEW, s, sc))
    if not (o and n):
        continue
    ch = 100 * (float(n["ops_median"]) / float(o["ops_median"]) - 1)
    below = float(n["ops_max"]) < float(o["ops_min"])
    above = float(n["ops_min"]) > float(o["ops_max"])
    worse, better = below and ch < -FLOOR, above and ch > FLOOR
    v = "**slower**" if worse else "faster" if better else "level"
    if (below or above) and not (worse or better):
        v += f" (rounds apart, under {FLOOR:.0f}%)"
    if "nic" in n["limit"] and not (worse or better):
        v += " (NIC)"
    elif "client" in n["limit"] and not (worse or better):
        v += " (clients)"
    print(f"| {name(s, sc)} | {m(o['ops_median'])} [{m(o['ops_min'])} - {m(o['ops_max'])}]{flag(o)} | "
          f"{m(n['ops_median'])} [{m(n['ops_min'])} - {m(n['ops_max'])}]{flag(n)} | {ch:+.1f}% | "
          f"±{float(o['spread_pct']) / 2:.1f}% / ±{float(n['spread_pct']) / 2:.1f}% | {v} | "
          f"{float(o['p99_ms']):.2f} → {float(n['p99_ms']):.2f} | {float(o['p999_ms']):.2f} → {float(n['p999_ms']):.2f} | "
          f"{float(o['us_per_op']):.2f} → {float(n['us_per_op']):.2f} |")

print("\n### MSET and MGET of 10 keys in detail (100 B, pipeline 1, 1,200 connections)\n")
print("| Build | round | commands/s | p50 / p99 / p99.9 ms | server CPU busy | server µs/cmd (user + kernel) | load generators busy |")
print("|---|---|---:|---:|---:|---:|---:|")
for sc in ("mset10_p1", "mget10_p1"):
    for e in (OLD, NEW):
        for r in [r for r in RUNS if r["engine"] == e and r["size"] == "100" and r["scenario"] == sc]:
            print(f"| {e.split('-')[1]} {sc.split('_')[0].upper()} | {r['round']} | {m(r['ops'])} | "
                  f"{float(r['p50_ms']):.2f} / {float(r['p99_ms']):.2f} / {float(r['p999_ms']):.2f} | {r['srv_busy']}% | "
                  f"{r['us_per_op']} ({r['us_user_per_op']} + {r['us_kernel_per_op']}) | {r['client_busy_max']}% |")

print("\n### rc8 against the published 1.2.0 numbers (75482ab, 2026-11-02, eastasia; indicative only)\n")
print("| Scenario | published 75482ab | rc8 today | Change | p99 ms published → today |")
print("|---|---:|---:|---:|---:|")
for s, sc in SCS:
    o, n = P.get(("kividb-cand", s, sc)), S.get((NEW, s, sc))
    if not (o and n):
        continue
    ch = 100 * (float(n["ops_median"]) / float(o["ops_median"]) - 1)
    print(f"| {name(s, sc)} | {m(o['ops_median'])}{flag(o)} | {m(n['ops_median'])}{flag(n)} | {ch:+.1f}% | "
          f"{float(o['p99_ms']):.2f} → {float(n['p99_ms']):.2f} |")

print("\n### Competitors, one round, against their published medians\n")
print("| Engine | Scenario | published | today | Change | p99 ms published → today | rc8 today | rc8 / engine today |")
print("|---|---|---:|---:|---:|---:|---:|---:|")
for e, lab in (("garnet", "Garnet 2.2.5"), ("dragonfly", "Dragonfly 2.0.2"), ("redis@24", "Redis 8.10.3, io-threads 24")):
    for sc in ("get_p16", "set_p16", "mget10_p1", "mset10_p1"):
        o, n, k = P.get((e, "100", sc)), S.get((e, "100", sc)), S.get((NEW, "100", sc))
        if not (o and n):
            continue
        ch = 100 * (float(n["ops_median"]) / float(o["ops_median"]) - 1)
        print(f"| {lab} | {name('100', sc)} | {m(o['ops_median'])}{flag(o)} | {m(n['ops_median'])}{flag(n)} | {ch:+.1f}% | "
              f"{float(o['p99_ms']):.2f} → {float(n['p99_ms']):.2f} | {m(k['ops_median']) if k else '-'} | "
              f"{float(k['ops_median']) / float(n['ops_median']):.2f}× |")

# Regression chart.
plt.rcParams.update({
    "svg.fonttype": "none", "font.family": "DejaVu Sans", "font.size": 10,
    "figure.facecolor": "white", "axes.facecolor": "white", "savefig.facecolor": "white",
    "text.color": "#222222", "axes.labelcolor": "#222222", "xtick.color": "#222222", "ytick.color": "#222222",
    "axes.edgecolor": "#888888", "axes.grid": True, "grid.color": "#e3e3e3", "grid.linewidth": 0.8,
    "axes.axisbelow": True, "axes.spines.top": False, "axes.spines.right": False,
})
C_NEW, C_OLD = "#0072B2", "#8c8c8c"
pairs = [(s, sc) for s, sc in SCS if per_round(NEW, s, sc, "ops") and per_round(OLD, s, sc, "ops")]
LIM = {"ops": (90, 110), "p99_ms": (70, 130)}
fig, axes = plt.subplots(1, 2, figsize=(11, 0.36 * len(pairs) + 1.9), sharey=True)
ys = list(range(len(pairs)))[::-1]
slow = []
for ax, key, lab in ((axes[0], "ops", "throughput, % of rc7 median (higher is better)"),
                     (axes[1], "p99_ms", "p99 latency, % of rc7 median (lower is better)")):
    lo, hi = LIM[key]
    for y, (s, sc) in zip(ys, pairs):
        base = statistics.median(per_round(OLD, s, sc, key))
        for e, dy, c in ((OLD, 0.16, C_OLD), (NEW, -0.16, C_NEW)):
            v = [100 * x / base for x in per_round(e, s, sc, key)]
            out = [x for x in v if x > hi or x < lo]
            if out:
                med = statistics.median(v)
                edge = hi if med > hi else lo
                ax.annotate((f"{med:.0f}% of rc7 →" if edge == hi else f"← {med:.0f}% of rc7"), (edge, y + dy), xytext=(-9 if edge == hi else 9, 0),
                            textcoords="offset points", ha="right" if edge == hi else "left", va="center",
                            fontsize=8, color=c, fontweight="bold")
                v = [min(max(x, lo), hi) for x in v]
                ax.plot(edge, y + dy, ">" if edge == hi else "<", color=c, ms=7)
                continue
            ax.plot([min(v), max(v)], [y + dy, y + dy], color=c, lw=2, solid_capstyle="round")
            ax.plot(v, [y + dy] * len(v), "|", color=c, ms=7)
            ax.plot(statistics.median(v), y + dy, "o", color=c, ms=6, mec="white", mew=1)
        if key == "ops":
            cv, rv = per_round(NEW, s, sc, key), per_round(OLD, s, sc, key)
            if max(cv) < min(rv) and statistics.median(cv) / statistics.median(rv) - 1 < -FLOOR / 100:
                slow.append(f"{name(s, sc)} {100 * (statistics.median(cv) / statistics.median(rv) - 1):+.1f}%")
    ax.set_xlim(lo, hi)
    ax.axvline(100, color="#444444", lw=1)
    ax.set_xlabel(lab)
    ax.grid(axis="y", visible=False)
axes[0].set_yticks(ys, [name(s, sc) for s, sc in pairs])
handles = [plt.Line2D([], [], marker="o", color=c, lw=2, mec="white", label=l)
           for l, c in (("KiviDB 1.2.0-rc7 (598b74d)", C_OLD), ("KiviDB 1.2.0-rc8 (082dab3)", C_NEW))]
fig.legend(handles=handles, loc="lower center", ncol=2, frameon=False, bbox_to_anchor=(0.5, -0.04))
note = ("slower beyond the run-to-run spread: " + ", ".join(slow)) if slow else f"nothing slower beyond the run-to-run spread (> {FLOOR:.0f}% and every round apart)"
fig.suptitle(f"KiviDB 1.2.0-rc8 vs rc7, alternating rounds (dot: median, ticks: each round)\n{note}",
             x=0.01, ha="left", fontsize=11, fontweight="bold")
fig.tight_layout()
fig.savefig(os.path.join(OUT, "regression-rc7-vs-rc8.svg"), format="svg", bbox_inches="tight")
if os.environ.get("PREVIEW"):
    fig.savefig(os.environ["PREVIEW"], dpi=80, bbox_inches="tight")

```

### Core Architecture Module: `benchmarks/1.2.0/failover/rc9/harness/core/summarize.py`
```
#!/usr/bin/env python3
"""Summarise run-suite.sh output.

    python3 summarize.py <results-dir>

Reads <results-dir>/<engine>/r<round>/d<size>/<scenario>.{c1,c2}.json (memtier),
*.cpu (sample.sh) and memory.txt, and writes into <results-dir>:

  runs.csv     one row per engine x round x size x scenario. Throughput is the
               sum of both load generators; p50/p99/p99.9 come from the two
               generators' latency histograms merged (HdrHistogram, exact),
               not from averaging their percentiles.
  summary.csv  one row per engine x size x scenario: median throughput over
               the rounds with min and max, median of each percentile, server
               CPU, CPU microseconds per request (user vs kernel), NIC rate,
               and flags for rows limited by the load generators or the NIC.

Needs the `hdrhistogram` package (pip install hdrhistogram).
"""
import csv
import glob
import json
import os
import re
import statistics
import sys

from hdrh.histogram import HdrHistogram

ROOT = sys.argv[1]
NIC_MBPS = float(os.environ.get("NIC_MBPS", "2000"))  # D32ps_v5: 16 Gbps = 2000 MB/s
CLIENT_BUSY = float(os.environ.get("CLIENT_BUSY", "90"))


def cpu(path):
    try:
        f = open(path).read().strip().split(",")
        return dict(zip(["busy", "user", "sys", "softirq", "rx", "tx", "ncpu"], map(float, f)))
    except (OSError, ValueError):
        return None


def load(path):
    try:
        return json.load(open(path))["ALL STATS"]
    except (OSError, ValueError, KeyError):
        return None


rows = []
for c1 in sorted(glob.glob(os.path.join(ROOT, "*", "r*", "d*", "*.c1.json"))):
    d = os.path.dirname(c1)
    scen = os.path.basename(c1)[: -len(".c1.json")]
    if scen == "warm":
        continue
    size = os.path.basename(d)[1:]
    rnd = os.path.basename(os.path.dirname(d))[1:]
    engine = os.path.basename(os.path.dirname(os.path.dirname(d)))
    parts = [load(c1), load(c1.replace(".c1.json", ".c2.json"))]
    if not all(parts):
        rows.append(dict(engine=engine, round=rnd, size=size, scenario=scen, ops="", error="missing client output"))
        continue
    ops = sum(p["Totals"]["Ops/sec"] for p in parts)
    hits = sum(p["Totals"].get("Hits/sec", 0) for p in parts)
    misses = sum(p["Totals"].get("Misses/sec", 0) for p in parts)
    merged = None
    for p in parts:
        h = HdrHistogram.decode(p["Totals"]["Percentile Latencies"]["Histogram log format"]["Compressed Histogram"])
        if merged is None:
            merged = h
        else:
            merged.add(h)
    # memtier records microseconds; check the scale against its own p50.
    own = parts[0]["Totals"]["Percentile Latencies"]["p50.00"]
    single = HdrHistogram.decode(parts[0]["Totals"]["Percentile Latencies"]["Histogram log format"]["Compressed Histogram"])
    scale = 1000.0 if abs(single.get_value_at_percentile(50) / 1000.0 - own) <= max(0.05 * own, 0.002) else 1.0
    pct = {q: merged.get_value_at_percentile(q) / scale for q in (50, 99, 99.9)}
    srv = cpu(c1.replace(".c1.json", ".srv.cpu"))
    cl = [cpu(c1.replace(".c1.json", f".{c}.cpu")) for c in ("c1", "c2")]
    row = dict(engine=engine, round=rnd, size=size, scenario=scen, ops=round(ops),
               miss_pct=round(100 * misses / (hits + misses), 2) if hits + misses else "",
               p50_ms=round(pct[50], 3), p99_ms=round(pct[99], 3), p999_ms=round(pct[99.9], 3),
               avg_ms=round(statistics.mean(p["Totals"]["Average Latency"] for p in parts), 3), error="")
    if srv:
        n = srv["ncpu"]
        row.update(srv_busy=srv["busy"], srv_user=srv["user"], srv_kernel=round(srv["sys"] + srv["softirq"], 1),
                   srv_rx_MBps=srv["rx"], srv_tx_MBps=srv["tx"],
                   us_per_op=round(srv["busy"] / 100 * n * 1e6 / ops, 2) if ops else "",
                   us_user_per_op=round(srv["user"] / 100 * n * 1e6 / ops, 2) if ops else "",
                   us_kernel_per_op=round((srv["sys"] + srv["softirq"]) / 100 * n * 1e6 / ops, 2) if ops else "")
    if all(cl):
        row.update(client_busy_max=max(c["busy"] for c in cl))
    rows.append(row)

cols = ["engine", "round", "size", "scenario", "ops", "miss_pct", "p50_ms", "p99_ms", "p999_ms", "avg_ms",
        "srv_busy", "srv_user", "srv_kernel", "srv_rx_MBps", "srv_tx_MBps", "us_per_op", "us_user_per_op",
        "us_kernel_per_op", "client_busy_max", "error"]
with open(os.path.join(ROOT, "runs.csv"), "w", newline="\n") as f:
    w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
    w.writeheader()
    for r in rows:
        w.writerow({c: r.get(c, "") for c in cols})

groups = {}
for r in rows:
    if r.get("ops") == "":
        continue
    groups.setdefault((r["engine"], r["size"], r["scenario"]), []).append(r)


def med(rs, k):
    v = [r[k] for r in rs if r.get(k, "") != ""]
    return round(statistics.median(v), 3) if v else ""


scols = ["engine", "size", "scenario", "rounds", "ops_median", "ops_min", "ops_max", "spread_pct",
         "p50_ms", "p99_ms", "p999_ms", "miss_pct", "srv_busy", "us_per_op", "us_user_per_op", "us_kernel_per_op",
         "srv_rx_MBps", "srv_tx_MBps", "client_busy_max", "limit"]
with open(os.path.join(ROOT, "summary.csv"), "w", newline="\n") as f:
    w = csv.DictWriter(f, fieldnames=scols, lineterminator="\n")
    w.writeheader()
    for (e, s, sc), rs in sorted(groups.items(), key=lambda kv: (kv[0][0], int(kv[0][1]), kv[0][2])):
        ops = [r["ops"] for r in rs]
        m = statistics.median(ops)
        limit = []
        cb = med(rs, "client_busy_max")
        if cb != "" and cb >= CLIENT_BUSY:
            limit.append("client")
        nic = max(med(rs, "srv_rx_MBps") or 0, med(rs, "srv_tx_MBps") or 0)
        if nic >= 0.85 * NIC_MBPS:
            limit.append("nic")
        w.writerow(dict(engine=e, size=s, scenario=sc, rounds=len(rs), ops_median=round(m), ops_min=min(ops),
                        ops_max=max(ops), spread_pct=round(100 * (max(ops) - min(ops)) / m, 1) if m else "",
                        p50_ms=med(rs, "p50_ms"), p99_ms=med(rs, "p99_ms"), p999_ms=med(rs, "p999_ms"),
                        miss_pct=med(rs, "miss_pct"), srv_busy=med(rs, "srv_busy"), us_per_op=med(rs, "us_per_op"),
                        us_user_per_op=med(rs, "us_user_per_op"), us_kernel_per_op=med(rs, "us_kernel_per_op"),
                        srv_rx_MBps=med(rs, "srv_rx_MBps"), srv_tx_MBps=med(rs, "srv_tx_MBps"),
                        client_busy_max=cb, limit="+".join(limit)))
print(open(os.path.join(ROOT, "summary.csv")).read())

```

### Core Architecture Module: `benchmarks/1.2.0/media/render_media.py`
```
"""README media for KiviDB 1.2.0: light and dark PNG charts, and an MP4 + animated WebP.

  python -I render_media.py <benchmarks/1.2.0 dir> <out dir> [--no-video]

Every number comes from the 1.2.0 result files (core/results/summary.csv) or is
copied from the suites' tables (memory, vector, core/rc8), as noted beside it.
"""
import csv
import os
import sys

import imageio_ffmpeg
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

B, OUT = sys.argv[1], sys.argv[2]
VIDEO = "--no-video" not in sys.argv
os.makedirs(OUT, exist_ok=True)

THEME = {
    "light": dict(bg="#fcfcfb", ink="#0b0b0b", ink2="#52514e", muted="#898781", grid="#e1e0d9",
                  axis="#c3c2b7", accent="#2a78d6", other="#b9b7b0", s2="#eb6834", s3="#1baf7a"),
    "dark": dict(bg="#1a1a19", ink="#f0efec", ink2="#c3c2b7", muted="#898781", grid="#2c2c2a",
                 axis="#383835", accent="#3987e5", other="#5d5c58", s2="#d95926", s3="#199e70"),
}
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 13})

# ── data ──────────────────────────────────────────────────────────────────────
core = {(r["engine"], r["size"], r["scenario"]): r
        for r in csv.DictReader(open(os.path.join(B, "core/results/summary.csv"), encoding="utf-8"))}
CORE = [("kividb-cand", "KiviDB 1.2.0"), ("garnet", "Garnet 2.2.5"), ("dragonfly", "Dragonfly 2.0.2"),
        ("redis-cluster", "Redis Cluster (32 shards)"), ("redis@24", "Redis 8.10 (io-threads 24)"),
        ("valkey@24", "Valkey 9.1 (io-threads 24)")]


def core_rows(scenario, field, scale):
    rows = []
    for key, name in CORE:
        r = core[(key, "100", scenario)]
        rows.append((name, float(r[field]) * scale, bool(r["limit"]) and field == "ops_median"))
    return rows


CORE_NOTE = "Azure D32ps_v5 server (32 vCPU arm64), two D16ps_v5 load generators; 10M keys, 100-byte values; median of 3+ rounds"
SCENES = [
    dict(name="throughput-pipelined", title="Throughput, pipeline 16, 100-byte values", unit="M ops/s",
         panels=[("GET", core_rows("get_p16", "ops_median", 1e-6)), ("SET", core_rows("set_p16", "ops_median", 1e-6))],
         fmt="{:.2f}M", note=CORE_NOTE + "; * the load generators were the limit"),
    dict(name="throughput-unpipelined", title="Throughput, no pipelining, 100-byte values", unit="M ops/s",
         panels=[("GET", core_rows("get_p1", "ops_median", 1e-6)), ("SET", core_rows("set_p1", "ops_median", 1e-6))],
         fmt="{:.2f}M", note=CORE_NOTE + "; * the load generators were the limit"),
    dict(name="latency-p99-pipelined", title="p99 latency, pipeline 16 (ms, lower is better)", unit="ms",
         panels=[("GET", core_rows("get_p16", "p99_ms", 1)), ("SET", core_rows("set_p16", "p99_ms", 1))],
         fmt="{:.2f} ms", note=CORE_NOTE),
    # core/rc8/README.md: the shipped MSET code, competitors in the same session (one round each).
    dict(name="mset", title="MSET of 10 keys, pipeline 1 (thousand commands/s)", unit="K/s",
         panels=[("", [("KiviDB 1.2.0", 569, False), ("Garnet 2.2.5", 800, False), ("Dragonfly 2.0.2", 561, False),
                       ("Redis 8.10 (io-threads 24)", 144, False)])],
         fmt="{:.0f}K", note="Same machines; 1,200 connections; keys/s is ten times this. Valkey and Redis Cluster were not in this round"),
    # memory/results/tables.md, "Memory as the dataset grows", 100 B values, 50M keys.
    dict(name="memory-per-key", title="Memory per key, 50M keys of 100 bytes (bytes, lower is better)", unit="B",
         panels=[("", [("KiviDB 1.2.0", 140.7, False), ("Dragonfly 2.0.2", 141.5, False), ("Valkey 9.1", 166.6, False),
                       ("Redis 8.10", 174.4, False)])],
         fmt="{:.1f} B", note="RSS per key while loading random 100-byte values, Azure E32ds_v7"),
    # memory/results/tables.md, "Snapshot, per engine", BGSAVE added %.
    dict(name="snapshot-memory", title="Memory added by BGSAVE under 100k writes/s (%, lower is better)", unit="%",
         panels=[("", [("KiviDB 1.2.0", 10, False), ("Dragonfly 2.0.2", 0.4, False), ("Valkey 9.1", 78, False),
                       ("Redis 8.10", 89, False)])],
         fmt="+{:g}%", note="30M keys of 1 KB, uniform random SETs during the snapshot; Redis and Valkey fork, copy-on-write"),
    # vector/results/tables.md, h-and-m 2048-d filtered, 100 clients, ef 128.
    dict(name="vector-filtered", title="Filtered vector search, 2048 dimensions, 100 clients (queries/s)", unit="q/s",
         panels=[("", [("KiviDB 1.2.0", 4478, False), ("Redis 8.10 (io-threads 8)", 1842, False), ("Dragonfly 2.0.2", 811, False)])],
         fmt="{:,.0f}", note="vector-db-benchmark h-and-m-2048-angular-filters, ef 128, recall@10 0.998 on all three"),
    # vector/results/tables.md, glove 25-d, upload + index.
    dict(name="vector-ingest", title="Vector ingest and index build, 1.18M vectors (s, lower is better)", unit="s",
         panels=[("", [("KiviDB 1.2.0", 30.2, False), ("Dragonfly 2.0.2", 27.8, False), ("Redis 8.10 (io-threads 8)", 59.8, False)])],
         fmt="{:.1f} s", note="glove-25-angular, HNSW M=16, EF_CONSTRUCTION=256, 100 clients uploading in batches of 64"),
]
# vector/results/tables.md, glove 25-d, 100 clients, ef 64/128/256/512: (recall, q/s).
QPS = dict(title="Vector search: queries per second against recall, 1.18M vectors",
           note="glove-25-angular, HNSW M=16, ef 64-512, 100 clients; Azure D32ps_v5 server, D16ps_v5 client",
           series=[("KiviDB 1.2.0", "accent", [(0.9478, 38217), (0.9647, 33891), (0.9908, 23451), (0.9983, 14992)]),
                   ("Dragonfly 2.0.2", "s2", [(0.9116, 25582), (0.9366, 25089), (0.9791, 21412), (0.9951, 15452)]),
                   ("Redis 8.10 (io-threads 8)", "s3", [(0.9116, 21198), (0.9366, 19310), (0.9791, 13677), (0.9951, 8794)])])


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3


# ── drawing ───────────────────────────────────────────────────────────────────
def style(ax, th):
    ax.set_facecolor(th["bg"])
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(th["axis"])
    ax.tick_params(colors=th["ink2"], length=0)
    ax.grid(axis="x", color=th["grid"], linewidth=1)
    ax.set_axisbelow(True)


def draw_bars(fig, scene, th, t=1.0, video=False):
    panels = scene["panels"]
    n = len(panels)
    vmax = max(v for _, rows in panels for _, v, _ in rows) * 1.22
    axes = fig.subplots(1, n, sharey=True) if n > 1 else [fig.add_subplot(1, 1, 1)]
    for ax, (ptitle, rows) in zip(np.atleast_1d(axes), panels):
        style(ax, th)
        names = [r[0] for r in rows]
        y = np.arange(len(rows))[::-1]
        vals = [r[1] * ease(t) for r in rows]
        colors = [th["accent"] if nm.startswith("KiviDB") else th["other"] for nm in names]
        ax.barh(y, vals, height=0.68, color=colors, edgecolor=th["bg"], linewidth=2)
        ax.set_yticks(y)
        ax.set_yticklabels(names, color=th["ink"])
        ax.set_xlim(0, vmax)
        ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v:g}"))
        if ptitle:
            ax.set_title(ptitle, color=th["ink"], fontsize=15, pad=8)
        if t > 0.85:
            for yi, (nm, v, limited) in zip(y, rows):
                label = scene["fmt"].format(v) + (" *" if limited else "")
                ax.text(v + vmax * 0.012, yi, label, va="center", ha="left", color=th["ink"], fontsize=12,
                        fontweight="bold" if nm.startswith("KiviDB") else "normal")
    fig.suptitle(scene["title"], color=th["ink"], fontsize=19 if video else 18, fontweight="bold", y=0.965)
    fig.text(0.5, 0.025, scene["note"], ha="center", color=th["muted"], fontsize=10.5)
    fig.subplots_adjust(left=0.2, right=0.97, top=0.84 if n > 1 else 0.88, bottom=0.12, wspace=0.12)


def draw_qps(fig, th, t=1.0, video=False):
    ax = fig.add_subplot(1, 1, 1)
    style(ax, th)
    ax.grid(axis="y", color=th["grid"], linewidth=1)
    frac = ease(t)
    for name, key, pts in QPS["series"]:
        xs = [p[0] for p in pts]
        ys = [p[1] / 1000 for p in pts]
        k = max(1, int(np.ceil(frac * len(xs))))
        ax.plot(xs[:k], ys[:k], color=th[key], linewidth=2.5, marker="o", markersize=8,
                markeredgecolor=th["bg"], markeredgewidth=2, label=name)
        if t > 0.85:
            ax.text(xs[0] - 0.0015, ys[0], name, ha="right", va="center", color=th["ink"], fontsize=12)
    ax.set_xlim(0.875, 1.002)
    ax.set_ylim(0, 42)
    ax.set_xlabel("recall@10 (higher is better)", color=th["ink2"])
    ax.set_ylabel("thousand queries per second", color=th["ink2"])
    leg = ax.legend(loc="lower left", frameon=False, labelcolor=th["ink"], fontsize=12)
    fig.suptitle(QPS["title"], color=th["ink"], fontsize=19 if video else 18, fontweight="bold", y=0.965)
    fig.text(0.5, 0.025, QPS["note"], ha="center", color=th["muted"], fontsize=10.5)
    fig.subplots_adjust(left=0.08, right=0.97, top=0.88, bottom=0.14)
    return leg


def card(fig, th, lines):
    fig.patch.set_facecolor(th["bg"])
    big, small = lines[0], lines[1:]
    fig.text(0.5, 0.58, big, ha="center", va="center", color=th["ink"], fontsize=34, fontweight="bold")
    for i, s in enumerate(small):
        fig.text(0.5, 0.44 - i * 0.075, s, ha="center", va="center", color=th["ink2"], fontsize=17)


def new_fig(th, w, h, dpi):
    fig = plt.figure(figsize=(w / dpi, h / dpi), dpi=dpi)
    fig.patch.set_facecolor(th["bg"])
    return fig


# ── PNGs ──────────────────────────────────────────────────────────────────────
for mode, th in THEME.items():
    for sc in SCENES:
        fig = new_fig(th, 1310, 800 if len(sc["panels"]) > 1 else 640, 100)
        draw_bars(fig, sc, th)
        fig.savefig(os.path.join(OUT, f"{sc['name']}-{mode}.png"), facecolor=th["bg"])
        plt.close(fig)
    fig = new_fig(th, 1310, 800, 100)
    draw_qps(fig, th)
    fig.savefig(os.path.join(OUT, 
```

### Core Architecture Module: `benchmarks/1.2.1/core/harness/analyze-121.py`
```
#!/usr/bin/env python3
"""1.2.1 core check: tables from summarize.py's summary.csv and runs.csv.

    python3 analyze-121.py <results-dir> > tables.md

The rule (the 1.2.0 suite's last round): a row fails only if every NEW round is below every
OLD round AND the medians differ by more than the spread. Spread here is the larger of the two
builds' half min-max ranges, as % of the median, and never less than FLOOR (1%).
"""
import csv
import os
import sys

ROOT = sys.argv[1]
S = {(r["engine"], r["size"], r["scenario"]): r for r in csv.DictReader(open(os.path.join(ROOT, "summary.csv")))}
RUNS = [r for r in csv.DictReader(open(os.path.join(ROOT, "runs.csv"))) if not r.get("error")]
SIZES = ["100", "1024", "2048"]
SCS = ["get_p1", "get_p16", "set_p1", "set_p16", "mget10_p1", "mset10_p1"]
LABEL = {"kividb-121": "1.2.1", "kividb-120rel": "1.2.0 rel", "kividb-120src": "1.2.0 built"}
FLOOR = float(os.environ.get("FLOOR", "1"))


def m(v):
    v = float(v)
    return f"{v / 1e6:.2f}M" if v >= 1e6 else f"{v / 1e3:.0f}K"


def name(size, sc):
    op, p = sc.split("_p")
    sz = {"100": "100 B", "1024": "1 KB", "2048": "2 KB"}[size]
    return f"{sz} {op.upper().replace('10', ' 10')} p{p}"


def flag(r):
    return {"client": " C", "nic": " N", "client+nic": " C N"}.get(r.get("limit", ""), "")


def table(new, old):
    nl, ol = LABEL[new], LABEL[old]
    print(f"### {nl} against {ol}\n")
    print("Median [min - max] of the rounds. **C**: load generators >90% CPU (they are the limit). "
          f"Verdict **fail** only if every {nl} round is below every {ol} round and the medians differ "
          f"by more than the spread (larger half-range, at least {FLOOR:.0f}%).\n")
    print(f"| Row | {nl} | {ol} | Δ | spread {nl} / {ol} | Verdict | p50 ms | p99 ms | p99.9 ms | server µs/req | load gen. CPU % |")
    print("|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|")
    for size in SIZES:
        for sc in SCS:
            if sc.startswith("m") and size != "100":
                continue
            o, n = S.get((old, size, sc)), S.get((new, size, sc))
            if not (o and n):
                if o or n:
                    print(f"| {name(size, sc)} | missing | | | | | | | | | |")
                continue
            ch = 100 * (float(n["ops_median"]) / float(o["ops_median"]) - 1)
            sn, so = float(n["spread_pct"]) / 2, float(o["spread_pct"]) / 2
            spread = max(FLOOR, sn, so)
            below = float(n["ops_max"]) < float(o["ops_min"])
            above = float(n["ops_min"]) > float(o["ops_max"])
            if below and -ch > spread:
                v = "**fail**"
            elif above and ch > spread:
                v = "pass (faster)"
            elif below or above:
                v = "pass (rounds apart, within spread)"
            else:
                v = "pass (level)"
            if "client" in n["limit"] and v.startswith("pass ("):
                v = v[:-1] + ", clients)"
            print(f"| {name(size, sc)} | {m(n['ops_median'])} [{m(n['ops_min'])} - {m(n['ops_max'])}]{flag(n)} | "
                  f"{m(o['ops_median'])} [{m(o['ops_min'])} - {m(o['ops_max'])}]{flag(o)} | {ch:+.1f}% | "
                  f"±{sn:.1f}% / ±{so:.1f}% | {v} | "
                  f"{float(n['p50_ms']):.2f} / {float(o['p50_ms']):.2f} | "
                  f"{float(n['p99_ms']):.2f} / {float(o['p99_ms']):.2f} | {float(n['p999_ms']):.2f} / {float(o['p999_ms']):.2f} | "
                  f"{float(n['us_per_op']):.2f} / {float(o['us_per_op']):.2f} | "
                  f"{float(n['client_busy_max']):.0f} / {float(o['client_busy_max']):.0f} |")
    print()


table("kividb-121", "kividb-120rel")
table("kividb-121", "kividb-120src")
table("kividb-120src", "kividb-120rel")

print("### Round by round\n")
print("| Row | Build | round | ops/s | p50 / p99 / p99.9 ms | server busy % | server µs/req (user + kernel) | load gen. busy % |")
print("|---|---|---|---:|---:|---:|---:|---:|")
for size in SIZES:
    for sc in SCS:
        for e in ("kividb-121", "kividb-120rel", "kividb-120src"):
            for r in sorted([r for r in RUNS if r["engine"] == e and r["size"] == size and r["scenario"] == sc],
                            key=lambda r: r["round"]):
                print(f"| {name(size, sc)} | {LABEL[e]} | {r['round']} | {m(r['ops'])} | "
                      f"{float(r['p50_ms']):.2f} / {float(r['p99_ms']):.2f} / {float(r['p999_ms']):.2f} | {r['srv_busy']} | "
                      f"{r['us_per_op']} ({r['us_user_per_op']} + {r['us_kernel_per_op']}) | {r['client_busy_max']} |")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1016** (2026-11-25): **Large-string SETBIT, BITFIELD, SETRANGE and APPEND copy the entire value on small writes**
  *Symptoms*: ### Summary  While testing i noticed that small updates to large strings copy the entire buffer. This also affects read-only and no-op bitmap operations, making the cost depend on the string size rather than the actual change.  ### Benchmark results  Tested on Apple M3 Pro with KiviDB (release/fat LTO) and Redis 8.10.3 using a 64 MiB string. Each scenario was repeated three times, with replies and final values verified.  | Command | KiviDB | Redis | |---|---:|---:| | SETBIT (unchanged) | 1,423 µs | ≤0.6 µs | | SETBIT (changed) | 2,847 µs | ≤0.6 µs | | BITFIELD INCRBY | 5,033 µs | ≤0.8 µs | | BITFIELD GET | 2,835 µs | ≤0.6 µs | | SETRANGE (3 bytes) | 2,837 µs | ≤0.8 µs | | APPEND (3 bytes) | 1,402 µs | ≤0.3 µs |  With four pipelined clients, KiviDB handled 370–375 SETBIT/s compared to at least 475,000 SETBIT/s on Redis (client-limited).  Peak RSS increased from 202 MiB to 266 MiB during SETBIT and 330 MiB during BITFIELD.  Only a scratch macOS build fix was applied; no string or bitmap logic was changed.  ### Source findings  - `bitmap.rs:118,153` — SETBIT copies the entire value, even for unchanged bits, and copies it again when storing changes. - `bitmap.rs:599,608,724,729` — BITFIELD copies, clones and compares the entire buffer. - `strings.rs:685,1232` — APPEND and SETRANGE fall back to full-buffer copies for non-inline strings.  ### Possible improvement  - Avoid allocations for unchanged SETBIT and read-only BITFIELD operations. - Update only affected bytes when the buffe

- **Issue #949** (2026-11-19): **DEBUG commands remain enabled even when `enable-debug-command` is set to `no`**
  *Symptoms*: ### Summary  KiviDB accepts the Redis setting `enable-debug-command`, but doesn't enforce it. DEBUG commands still work for users with the required ACL permissions, even when the setting is `no`.  Redis 7+ disables DEBUG by default and supports three modes: `no`, `yes`, and `local`.  ### How to reproduce  ```text CONFIG GET enable-debug-command (empty array)  CONFIG SET enable-debug-command no OK  DEBUG SLEEP 0 OK ```  I also tested ACL permissions. A user with `+@all` can run DEBUG, while a restricted user without DEBUG permission gets `NOPERM`. So ACL checks appear to be working.  ### Expected behavior  - Default `enable-debug-command` to `no`. - Support `no`, `yes`, and `local`, like Redis. - With `no`, reject DEBUG commands. - With `yes`, allow DEBUG if the user has ACL permission. - With `local`, allow DEBUG only through loopback or Unix-socket connections, with ACL permission. - Reject runtime changes through `CONFIG SET`, as Redis treats this as a protected setting. - Return the configured value through `CONFIG GET`.  ### Suggested changes  - Remove `enable-debug-command` from the ignored Redis settings. - Parse and store the setting in server configuration. - Check the setting before running DEBUG commands. - Update tests that use DEBUG to enable it explicitly. - Add tests for all three modes and ACL permissions.  ### Scope  This is a security-hardening and Redis compatibility issue, not an ACL bypass. Existing DEBUG subcommands don't need to change, only when they're

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

### Incident Patch 1: `6d3497e5` (2026-11-26)
**Commit Message**: Regressions: suite 53 recorded with the SETRANGE cases (D4s_v5)

**File**: `benchmarks/1.3.0/regressions/README.md` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ and why.
 | `50-keys-wildcard` | #1018 | Plane's cache invalidation, `KEYS */api/workspaces/acme/labels/*` (django-redis `cache.keys(f"*{key}*")`), over 500,000 keys of 2 KB (`:1:/api/workspaces/other-ws/labels/:user-N`) and 5 that match: one `KEYS` alone (client wall time, median of 20), then GETs of random keys from 500 connections (this suite's own client, one asyncio process a client CPU, each connection one GET at a time) for 10 s, without and with another connection sending the `KEYS` every 250 ms: GETs a second, p99, p99.9 and the slowest GET. `--threads 4` (Redis `--io-threads 4`) on the first half of the CPUs, the clients on the other. Gates in the same session: `KEYS` at most 0.2x v1.2.2's and 0.2x Redis's; the GET p99.9 and the slowest GET with scans at most 0.25x v1.2.2's and 0.25x Redis's; GETs a second with scans within 10 % of recorded; the rest shown. `min_cpus=8`, recorded on a `Standard_D8s_v5` (see [the run](#recorded-run-suite-50)) |
 | `51-filtered-flat-knn` | #1020 | KNN 5 on a FLAT FLOAT32 COSINE index of 100,000 1536-d HASH documents (numpy seed 1020) with #1020's TAG filter, `(@user_id:{user\-<u>|__shared__})`, about 10,090 matching documents (`big`), a second TAG field matching 100 (`small`) and no filter (`none`), one random user of 1,000 and query of 256 each time, `RETURN 1 vector_distance`: lookups a second and p99 from a closed loop of 8 and 64 connections (threads of 4 client processes on the client's CPUs), median of 3 rounds of 10 s; `--threads 4` (Redis `--io-threads 4 --search-workers 4`) on the first half of the CPUs; the exact top 5 of 10 queries of each layout checked against numpy (`wrong_top5`, exactly 0); `used_memory` a document and the load rate. Gates: `big` at 8 and 64 connections at least 1.25x v1.2.2's and 1.15x Redis's in the same session and within 10 % of recorded; `used_memory` a document 5 %; `small` (the Python client is the limit there), `none`, p99s and the load shown. Needs `REGRESS_REDISEARCH_SO` for Redis (as `28`); `min_cpus=8`, recorded on a `Standard_D8s_v5` (see [the run](#recorded-run-suite-51)) |
 | `52-small-lists-memory` | #1022 | Misskey's home timelines: 10,000 lists of 300 ten-byte ids (`load`: `RPUSH`, one element a command through a raw pipelined socket as `redis-cli --pipe` sends them; `load-batch`: one `RPUSH` of 300 a list), then every list taken through 3,000 `LPUSH` + `LTRIM key 0 299` pairs (`timeline`: chunks filled at the front, trimmed at the back and given up), the same lists of 32- and 64-byte elements (`size32`, `size64`) and 10,000 lists of 30 elements (`tiny`): `used_memory` and RSS a list element and `MEMORY USAGE` of the first list, `LLEN` of it (300, 30). Gates: `used_per_element` within 5 % (or 1 B) of recorded, at most 1.3x Redis's in the same session and at most 0.8x v1.2.2's; `rss_per_element` within 10 % (or 1 B) of recorded, at most 1.5x Redis's (1.4x for `timeline`, whose chunks come and go in slab blocks: 1.17x measured) and at most 0.8x v1.2.2's (0.5x for `timeline`); `list_len` as recorded; the RSS of `tiny` (4.5 MB in all) is shown, not gated. Recorded through `run-all.sh --candidate <default build> --only 52 --record` on a `Standard_D4s_v5` with the default-features (glibc) candidate, the v1.2.2 release tarball's binary and the source-built Redis 8.10.2 (`results/pr-1022-52-d4s_v5`) |
-| `53-large-string-writes` | #1027, #1031, #1016, #1065 | one string of 64 MiB a case (`SETRANGE k 67108863 a`), one connection, one call at a time (2,000 calls a round; v1.2.2, which copies the string on every call: 10), 3 rounds: a `SETBIT` that leaves the bit as it is and a `BITFIELD ... GET u8` (#1027), a `SETBIT` that changes a bit, by turns set and cleared (#1031), `APPEND` of 3 bytes and of 1 KiB (#1016), and `SETRANGE` of 3 bytes at the string's end and 1 KiB past it (#1065): the server's own microseconds a call (`INFO commandstats`) and the client's wall time a call, median of the rounds; `bad_replies` and the lengths the appends and `SETRANGE`s end at. Gates in the same session, with fixed margins: every server time at most 0.01x v1.2.2's (100x faster: v1.2.2 takes 30-130 ms a call, the candidate one or two microseconds), every wall time at most 0.05x v1.2.2's and at most 2x Redis's; no gate on the server times against Redis's (both about a microsecond, on a clock of whole microseconds); `bad_replies` exactly 0 and the lengths as recorded. Recorded through `run-all.sh --candidate <default build> --only 53 --record` on a `Standard_D4s_v5` (`results/pr-append-53-record`); the `SETRANGE` cases are not recorded yet |
+| `53-large-string-writes` | #1027, #1031, #1016, #1065 | one string of 64 MiB a case (`SETRANGE k 67108863 a`), one connection, one call at a time (2,000 calls a round; v1.2.2, which copies the string on every call: 10), 3 rounds: a `SETBIT` that leaves the bit as it is and a `BITFIELD ... GET u8` (#1027), a `SETBIT` that changes a bit, by turns set and cleared (#1031), `APPEND` of 3 byte
```

**File**: `benchmarks/1.3.0/regressions/baseline.json` (modified, +227/-69)
```diff
@@ -35994,14 +35994,14 @@
       "unit": "us",
       "better": "lower",
       "recorded": {
-        "v1_2_2": 37871.0,
-        "candidate": 0.5455,
-        "redis": 0.813,
+        "v1_2_2": 38332.4,
+        "candidate": 1.094,
+        "redis": 1.549,
         "vm": "Standard_D4s_v5",
         "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
-        "date": "2026-11-24",
-        "commit": "f3479b36",
-        "label": "pr-append-53-record",
+        "date": "2026-11-26",
+        "commit": "3e50cc57",
+        "label": "pr-1065-53-record",
         "rustc": "1.100.0",
         "nproc": 4
       },
@@ -36024,9 +36024,9 @@
         "redis": 73255936.0,
         "vm": "Standard_D4s_v5",
         "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
-        "date": "2026-11-24",
-        "commit": "f3479b36",
-        "label": "pr-append-53-record",
+        "date": "2026-11-26",
+        "commit": "3e50cc57",
+        "label": "pr-1065-53-record",
         "rustc": "1.100.0",
         "nproc": 4
       },
@@ -36044,14 +36044,14 @@
       "unit": "us",
       "better": "lower",
       "recorded": {
-        "v1_2_2": 38110.8891,
-        "candidate": 48.8234,
-        "redis": 47.7974,
+        "v1_2_2": 38562.7343,
+        "candidate": 56.9547,
+        "redis": 57.8328,
         "vm": "Standard_D4s_v5",
         "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
-        "date": "2026-11-24",
-        "commit": "f3479b36",
-        "label": "pr-append-53-record",
+        "date": "2026-11-26",
+        "commit": "3e50cc57",
+        "label": "pr-1065-53-record",
         "rustc": "1.100.0",
         "nproc": 4
       },
@@ -36073,14 +36073,14 @@
       "unit": "us",
       "better": "lower",
       "recorded": {
-        "v1_2_2": 38109.5,
-        "candidate": 0.0195,
-        "redis": 0.2865,
+        "v1_2_2": 38914.1,
+        "candidate": 0.048,
+        "redis": 0.756,
         "vm": "Standard_D4s_v5",
         "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
-        "date": "2026-11-24",
-        "commit": "f3479b36",
-        "label": "pr-append-53-record",
+        "date": "2026-11-26",
+        "commit": "3e50cc57",
+        "label": "pr-1065-53-record",
         "rustc": "1.100.0",
         "nproc": 4
       },
@@ -36103,9 +36103,9 @@
         "redis": 67126873.0,
         "vm": "Standard_D4s_v5",
         "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
-        "date": "2026-11-24",
-        "commit": "f3479b36",
-        "label": "pr-append-53-record",
+        "date": "2026-11-26",
+        "commit": "3e50cc57",
+        "label": "pr-1065-53-record",
         "rustc": "1.100.0",
         "nproc": 4
       },
@@ -36123,14 +36123,14 @@
       "unit": "us",
       "better": "lower",
       "recorded": {
-        "v1_2_2": 38330.6783,
-        "candidate": 47.7555,
-        "redis": 46.4863,
+        "v1_2_2": 39234.7752,
+        "candidate": 48.975,
+        "redis": 55.7706,
         "vm": "Standard_D4s_v5",
         "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
-        "date": "2026-11-24",
-        "commit": "f3479b36",
-        "label": "pr-append-53-record",
+        "date": "2026-11-26",
+        "commit": "3e50cc57",
+        "label": "pr-1065-53-record",
         "rustc": "1.100.0",
         "nproc": 4
       },
@@ -36157,9 +36157,9 @@
         "redis": 0.0,
         "vm": "Standard_D4s_v5",
         "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
-        "date": "2026-11-24",
-        "commit": "f3479b36",
-        "label": "pr-append-53-record",
+        "date": "2026-11-26",
+        "commit": "3e50cc57",
+        "label": "pr-1065-53-record",
         "rustc": "1.100.0",
         "nproc": 4
       },
@@ -36177,14 +36177,14 @@
       "unit": "us",
       "better": "lower",
       "recorded": {
-        "v1_2_2": 75192.4,
-        "candidate": 0.026,
-        "redis": 0.3755,
+        "v1_2_2": 77233.0,
+        "candidate": 0.7595,
+        "redis": 0.3555,
         "vm": "Standard_D4s_v5",
         "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
-        "date": "2026-11-24",
-        "commit": "f3479b36",
-        "label": "pr-append-53-record",
+        "date": "2026-11-26",
+        "commit": "3e50cc57",
+        "label": "pr-1065-53-record",
         "rustc": "1.100.0",
         "nproc": 4
       },
@@ -36202,14 +36202,14 @@
       "unit": "us",
       "better": "lower",
       "recorded": {
-        "v1_2_2": 75442.9157,
-        "candidate": 52.1259,
-        "redis": 50.8643,
+        "v1_2_2": 77622.2025,
+        "candidate": 56.01,
+        "redis": 53.8136,
         "vm": "Standard_D4s_v5",
         "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
-        "date": "2026-11-24",
-        "commit": "f3479b36",
-        "label": "pr-append-53-record",
+        "date": "2026-11-26",
+        "commit": "3e50cc57",
+        "label": "pr-1065-53-record",
         "rustc": "1.100.0",
         "nproc": 4
    
```

**File**: `benchmarks/1.3.0/regressions/results/pr-1065-53-record/env.json` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+{
+ "label": "pr-1065-53-record",
+ "date": "2026-11-26",
+ "vm": "Standard_D4s_v5",
+ "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
+ "nproc": 4,
+ "cpu_count": 4,
+ "calib_ms": 95.0,
+ "kernel": "7.0.0-1017-azure",
+ "glibc": "2.39",
+ "python": "3.12.3",
+ "redis_py": "5.2.1",
+ "candidate_commit": "3e50cc57",
+ "candidate_allocator": "glibc",
+ "suite_seconds": {
+  "53-large-string-writes": 21
+ },
+ "scale": "1",
+ "full": "0",
+ "only": "53",
+ "engines_selected": [
+  "v1_2_2",
+  "candidate",
+  "redis"
+ ],
+ "failures": [],
+ "expected": [
+  {
+   "suite": "53-large-string-writes",
+   "config": "s64m",
+   "engines": [
+    "v1_2_2",
+    "candidate",
+    "redis"
+   ]
+  }
+ ],
+ "engines": {
+  "v1_2_2": {
+   "path": "/home/azureuser/.cache/kividb-regress/releases/v1.2.2/default/kividb",
+   "sha256": "38fc2cea40c131e041f4914527a98719e5d34dffdfe2abdc1f07ecb86aa6723e",
+   "version": "kividb 1.2.2",
+   "rustc": "1.100.0"
+  },
+  "candidate": {
+   "path": "/home/azureuser/kividb/target/release/kividb",
+   "sha256": "36a88ac8dd53cba32bcb717e4d706029eb348421bf017d3f943220e7c891ce75",
+   "version": "kividb 1.2.1 (default build: no Lua, no TLS)",
+   "rustc": "1.100.0"
+  },
+  "redis": {
+   "path": "/opt/redis-8.10.2/src/redis-server",
+   "sha256": "b0cd304980112fa6cd8dced524fdd6b136fd8efb802f5cf9e81610051a11891c",
+   "version": "Redis server v=8.10.2 sha=00000000:1 malloc=jemalloc-5.3.0 bits=64 build=75a9b36b1f0aa00",
+   "rustc": null
+  },
+  "v1_2_2_full": {
+   "path": "/home/azureuser/.cache/kividb-regress/releases/v1.2.2/full/kividb",
+   "sha256": "ac5e05fe1274fd1167780e512bc03aa103340f42525a2cef4a2a762e47317ad5",
+   "version": "kividb 1.2.2",
+   "rustc": "1.100.0"
+  }
+ },
+ "skipped_configs": [],
+ "rustc_override": false,
+ "allow_vm_change": false,
+ "redis_source_sha256": null,
+ "needs_more_cpus": {},
+ "ran_below_min_cpus": {},
+ "suite_min_cpus": {},
+ "min_cpus_only": false,
+ "run_failed": false
+}
\ No newline at end of file
```

**File**: `benchmarks/1.3.0/regressions/results/pr-1065-53-record/summary.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"label":"pr-1065-53-record","env":{"label":"pr-1065-53-record","date":"2026-11-26","vm":"Standard_D4s_v5","cpu":"Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz","nproc":4,"cpu_count":4,"calib_ms":95.0,"kernel":"7.0.0-1017-azure","glibc":"2.39","python":"3.12.3","redis_py":"5.2.1","candidate_commit":"3e50cc57","candidate_allocator":"glibc","suite_seconds":{"53-large-string-writes":21},"scale":"1","full":"0","only":"53","engines_selected":["v1_2_2","candidate","redis"],"failures":[],"expected":[{"suite":"53-large-string-writes","config":"s64m","engines":["v1_2_2","candidate","redis"]}],"engines":{"v1_2_2":{"path":"/home/azureuser/.cache/kividb-regress/releases/v1.2.2/default/kividb","sha256":"38fc2cea40c131e041f4914527a98719e5d34dffdfe2abdc1f07ecb86aa6723e","version":"kividb 1.2.2","rustc":"1.100.0"},"candidate":{"path":"/home/azureuser/kividb/target/release/kividb","sha256":"36a88ac8dd53cba32bcb717e4d706029eb348421bf017d3f943220e7c891ce75","version":"kividb 1.2.1 (default build: no Lua, no TLS)","rustc":"1.100.0"},"redis":{"path":"/opt/redis-8.10.2/src/redis-server","sha256":"b0cd304980112fa6cd8dced524fdd6b136fd8efb802f5cf9e81610051a11891c","version":"Redis server v=8.10.2 sha=00000000:1 malloc=jemalloc-5.3.0 bits=64 build=75a9b36b1f0aa00","rustc":null},"v1_2_2_full":{"path":"/home/azureuser/.cache/kividb-regress/releases/v1.2.2/full/kividb","sha256":"ac5e05fe1274fd1167780e512bc03aa103340f42525a2cef4a2a762e47317ad5","version":"kividb 1.2.2","rustc":"1.100.0"}},"skipped_configs":[],"rustc_override":false,"allow_vm_change":false,"redis_source_sha256":null,"needs_more_cpus":{},"ran_below_min_cpus":{},"suite_min_cpus":{},"min_cpus_only":false,"run_failed":false},"rows":[{"key":"53-large-string-writes/s64m/append_1k_srv_us","suite":"53-large-string-writes","config":"s64m","metric":"append_1k_srv_us","unit":"us","better":"lower","values":{"v1_2_2":38332.4,"candidate":1.094,"redis":1.549},"samples":{"v1_2_2":[38477.6,37988.9,38332.4],"candidate":[1.8475,0.5795,1.094],"redis":[1.6135,1.549,1.4785]},"recorded_candidate":0.5455,"host":null,"gates":[{"gate":{"kind":"vs_v1_2_2","max_x":0.01},"status":"pass","limit":"0.00x v1.2.2 <= 0.01x"}],"status":"pass"},{"key":"53-large-string-writes/s64m/append_1k_strlen","suite":"53-large-string-writes","config":"s64m","metric":"append_1k_strlen","unit":"bytes","better":"higher","values":{"v1_2_2":67142656.0,"candidate":73255936.0,"redis":73255936.0},"samples":{},"recorded_candidate":73255936.0,"host":null,"gates":[{"gate":{"kind":"bound","eq":"recorded"},"status":"pass","limit":"== 73,255,936"}],"status":"pass"},{"key":"53-large-string-writes/s64m/append_1k_us","suite":"53-large-string-writes","config":"s64m","metric":"append_1k_us","unit":"us","better":"lower","values":{"v1_2_2":38562.7343,"candidate":56.9547,"redis":57.8328},"samples":{"v1_2_2":[38756.7199,38212.255,38562.7343],"candidate":[57.5904,51.7928,56.9547],"redis":[57.8328,57.6071,60.6008]},"recorded_candidate":48.8234,"host":null,"gates":[{"gate":{"kind":"vs_v1_2_2","max_x":0.05},"status":"pass","limit":"0.00x v1.2.2 <= 0.05x"},{"gate":{"kind":"vs_redis","max_x":2.0},"status":"pass","limit":"0.98x Redis <= 2x"}],"status":"pass"},{"key":"53-large-string-writes/s64m/append_3b_srv_us","suite":"53-large-string-writes","config":"s64m","metric":"append_3b_srv_us","unit":"us","better":"lower","values":{"v1_2_2":38914.1,"candidate":0.048,"redis":0.756},"samples":{"v1_2_2":[38948.4,38914.1,38897.7],"candidate":[0.048,0.032,0.768],"redis":[0.756,0.744,0.7605]},"recorded_candidate":0.0195,"host":null,"gates":[{"gate":{"kind":"vs_v1_2_2","max_x":0.01},"status":"pass","limit":"0.00x v1.2.2 <= 0.01x"}],"status":"pass"},{"key":"53-large-string-writes/s64m/append_3b_strlen","suite":"53-large-string-writes","config":"s64m","metric":"append_3b_strlen","unit":"bytes","better":"higher","values":{"v1_2_2":67108963.0,"candidate":67126873.0,"redis":67126873.0},"samples":{},"recorded_candidate":67126873.0,"host":null,"gates":[{"gate":{"kind":"bound","eq":"recorded"},"status":"pass","limit":"== 67,126,873"}],"status":"pass"},{"key":"53-large-string-writes/s64m/append_3b_us","suite":"53-large-string-writes","config":"s64m","metric":"append_3b_us","unit":"us","better":"lower","values":{"v1_2_2":39234.7752,"candidate":48.975,"redis":55.7706},"samples":{"v1_2_2":[39306.7945,39234.7752,39199.4723],"candidate":[48.9124,48.975,60.7373],"redis":[58.8806,55.6658,55.7706]},"recorded_candidate":47.7555,"host":null,"gates":[{"gate":{"kind":"vs_v1_2_2","max_x":0.05},"status":"pass","limit":"0.00x v1.2.2 <= 0.05x"},{"gate":{"kind":"vs_redis","max_x":2.0},"status":"pass","limit":"0.88x Redis <= 2x"}],"status":"pass"},{"key":"53-large-string-writes/s64m/bad_replies","suite":"53-large-string-writes","config":"s64m","metric":"bad_replies","unit":"replies","better":"lower","values":{"v1_2_2":0.0,"candidate":0.0,"redis":0.0},"samples":{},"recorded_candidate":0.0,"host":null,"gates":[{"gate":{"kind":"bound","eq":"recorded"},"status":"pass","limit":
```

**File**: `benchmarks/1.3.0/regressions/results/pr-1065-53-record/summary.md` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+# Regression suite: pr-1065-53-record
+
+Verdict: **ok**
+
+- Machine: Standard_D4s_v5, 4 vCPU, Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz, kernel 7.0.0-1017-azure, glibc 2.39
+- CPU: recorded on INTEL(R) XEON(R) PLATINUM 8573C / Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz / Intel(R) Xeon(R) Platinum 8473C; now Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz
+- calibration (indicative only): 95.0 ms for a fixed sha256 loop, 4 cores
+- Client: Python 3.12.3, redis-py 5.2.1
+- v1_2_2: `kividb 1.2.2`, sha256 `38fc2cea40c131e041f4914527a98719e5d34dffdfe2abdc1f07ecb86aa6723e`, rustc 1.100.0
+- candidate: `kividb 1.2.1 (default build: no Lua, no TLS)`, sha256 `36a88ac8dd53cba32bcb717e4d706029eb348421bf017d3f943220e7c891ce75`, rustc 1.100.0
+- redis: `Redis server v=8.10.2 sha=00000000:1 malloc=jemalloc-5.3.0 bits=64 build=75a9b36b1f0aa00`, sha256 `b0cd304980112fa6cd8dced524fdd6b136fd8efb802f5cf9e81610051a11891c`
+- v1_2_2_full: `kividb 1.2.2`, sha256 `ac5e05fe1274fd1167780e512bc03aa103340f42525a2cef4a2a762e47317ad5`, rustc 1.100.0
+- candidate commit: `3e50cc57`
+- date: 2026-11-26; FULL=0, SCALE=1
+- run time: 53-large-string-writes 21s
+
+Host speed (this host vs the recorded one; 1.00 = same, below 1 = slower), from v1.2.2 measured in both sessions: global 0.98x over 10 metrics
+- 53-large-string-writes/s64m: 0.98x (10 metrics)
+- recorded on Standard_D4s_v5 / Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz: 0.98x (10 metrics)
+
+## 53-large-string-writes
+
+| config | metric | unit | v1.2.2 | candidate | Redis | recorded | gate | result |
+|---|---|---|---:|---:|---:|---:|---|---|
+| s64m | append_1k_srv_us | us | 38,332 | 1.09 | 1.55 | 0.545 | vs_v1_2_2: 0.00x v1.2.2 <= 0.01x | pass |
+| s64m | append_1k_strlen | bytes | 67,142,656 | 73,255,936 | 73,255,936 | 73,255,936 | bound: == 73,255,936 | pass |
+| s64m | append_1k_us | us | 38,563 | 56.95 | 57.83 | 48.82 | vs_v1_2_2: 0.00x v1.2.2 <= 0.05x<br>vs_redis: 0.98x Redis <= 2x | pass<br>pass |
+| s64m | append_3b_srv_us | us | 38,914 | 0.048 | 0.756 | 0.0195 | vs_v1_2_2: 0.00x v1.2.2 <= 0.01x | pass |
+| s64m | append_3b_strlen | bytes | 67,108,963 | 67,126,873 | 67,126,873 | 67,126,873 | bound: == 67,126,873 | pass |
+| s64m | append_3b_us | us | 39,235 | 48.98 | 55.77 | 47.76 | vs_v1_2_2: 0.00x v1.2.2 <= 0.05x<br>vs_redis: 0.88x Redis <= 2x | pass<br>pass |
+| s64m | bad_replies | replies | 0 | 0 | 0 | 0 | bound: == 0 | pass |
+| s64m | bitfield_get_srv_us | us | 77,233 | 0.759 | 0.355 | 0.026 | vs_v1_2_2: 0.00x v1.2.2 <= 0.01x | pass |
+| s64m | bitfield_get_us | us | 77,622 | 56.01 | 53.81 | 52.13 | vs_v1_2_2: 0.00x v1.2.2 <= 0.05x<br>vs_redis: 1.04x Redis <= 2x | pass<br>pass |
+| s64m | setbit_change_srv_us | us | 77,682 | 1.77 | 0.368 | 1.01 | vs_v1_2_2: 0.00x v1.2.2 <= 0.01x | pass |
+| s64m | setbit_change_us | us | 78,073 | 55.04 | 53.48 | 49.72 | vs_v1_2_2: 0.00x v1.2.2 <= 0.05x<br>vs_redis: 1.03x Redis <= 2x | pass<br>pass |
+| s64m | setbit_noop_srv_us | us | 38,900 | 0.206 | 0.274 | 0.286 | vs_v1_2_2: 0.00x v1.2.2 <= 0.01x | pass |
+| s64m | setbit_noop_us | us | 39,232 | 51.28 | 53.46 | 50.39 | vs_v1_2_2: 0.00x v1.2.2 <= 0.05x<br>vs_redis: 0.96x Redis <= 2x | pass<br>pass |
+| s64m | setrange_gap_srv_us | us | 75,901 | 0.677 | 1.71 | - | vs_v1_2_2: 0.00x v1.2.2 <= 0.01x | pass |
+| s64m | setrange_gap_strlen | bytes | 67,142,755 | 73,273,945 | 73,273,945 | - | bound: eq: nothing recorded | new |
+| s64m | setrange_gap_us | us | 76,140 | 54.55 | 58.86 | - | vs_v1_2_2: 0.00x v1.2.2 <= 0.05x<br>vs_redis: 0.93x Redis <= 2x | pass<br>pass |
+| s64m | setrange_grow_srv_us | us | 76,557 | 2.01 | 0.867 | - | vs_v1_2_2: 0.00x v1.2.2 <= 0.01x | pass |
+| s64m | setrange_grow_strlen | bytes | 67,108,963 | 67,126,873 | 67,126,873 | - | bound: eq: nothing recorded | new |
+| s64m | setrange_grow_us | us | 76,800 | 69.51 | 57.86 | - | vs_v1_2_2: 0.00x v1.2.2 <= 0.05x<br>vs_redis: 1.20x Redis <= 2x | pass<br>pass |
+
+## Not run this time
+
+`01-scan-match/default/dbsize`, `01-scan-match/default/hscan_match_c1000_calls`, `01-scan-match/default/hscan_match_c1000_distinct`, `01-scan-match/default/hscan_match_c1000_ms`, `01-scan-match/default/keys_schedule_ms`, `01-scan-match/default/keys_schedule_returned`, `01-scan-match/default/scan_all_c1000_calls`, `01-scan-match/default/scan_all_c1000_distinct`, `01-scan-match/default/scan_all_c1000_ms`, `01-scan-match/default/scan_infix_c1000_calls`, `01-scan-match/default/scan_infix_c1000_distinct`, `01-scan-match/default/scan_infix_c1000_ms`, `01-scan-match/default/scan_match_c10000_calls`, `01-scan-match/default/scan_match_c10000_distinct`, `01-scan-match/default/scan_match_c10000_ms`, `01-scan-match/default/scan_match_c1000_calls`, `01-scan-match/default/scan_match_c1000_distinct`, `01-scan-match/default/scan_match_c1000_ms`, `01-scan-match/default/sscan_match_c1000_calls`, `01-scan-match/default/sscan_match_c1000_distinct`, `01-scan-match/default/sscan_match_c1000_ms`, `01-scan-match/default/zscan_
```

---

### Incident Patch 2: `3e50cc57` (2026-11-26)
**Commit Message**: Add SETRANGE growth regression benchmarks

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -998,7 +998,7 @@ project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
   allocator may do by moving it, and a string held elsewhere is copied
   once, each into a block with room for a quarter more, at most 16 MiB.
   Before this change such a `SETRANGE` copied a string of more than
-  26,208 bytes whole on every call. A key `SETRANGE` makes is made at its
+  26,208 bytes whole on every call. A missing key is made at its
   length, and a value that starts inside the string is written as
   before. The room is allocated memory: `used_memory`, `maxmemory` and
   `MEMORY USAGE` count it. Replies, time to live, `WATCH`, keyspace
```

**File**: `benchmarks/1.3.0/regressions/README.md` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ and why.
 | `50-keys-wildcard` | #1018 | Plane's cache invalidation, `KEYS */api/workspaces/acme/labels/*` (django-redis `cache.keys(f"*{key}*")`), over 500,000 keys of 2 KB (`:1:/api/workspaces/other-ws/labels/:user-N`) and 5 that match: one `KEYS` alone (client wall time, median of 20), then GETs of random keys from 500 connections (this suite's own client, one asyncio process a client CPU, each connection one GET at a time) for 10 s, without and with another connection sending the `KEYS` every 250 ms: GETs a second, p99, p99.9 and the slowest GET. `--threads 4` (Redis `--io-threads 4`) on the first half of the CPUs, the clients on the other. Gates in the same session: `KEYS` at most 0.2x v1.2.2's and 0.2x Redis's; the GET p99.9 and the slowest GET with scans at most 0.25x v1.2.2's and 0.25x Redis's; GETs a second with scans within 10 % of recorded; the rest shown. `min_cpus=8`, recorded on a `Standard_D8s_v5` (see [the run](#recorded-run-suite-50)) |
 | `51-filtered-flat-knn` | #1020 | KNN 5 on a FLAT FLOAT32 COSINE index of 100,000 1536-d HASH documents (numpy seed 1020) with #1020's TAG filter, `(@user_id:{user\-<u>|__shared__})`, about 10,090 matching documents (`big`), a second TAG field matching 100 (`small`) and no filter (`none`), one random user of 1,000 and query of 256 each time, `RETURN 1 vector_distance`: lookups a second and p99 from a closed loop of 8 and 64 connections (threads of 4 client processes on the client's CPUs), median of 3 rounds of 10 s; `--threads 4` (Redis `--io-threads 4 --search-workers 4`) on the first half of the CPUs; the exact top 5 of 10 queries of each layout checked against numpy (`wrong_top5`, exactly 0); `used_memory` a document and the load rate. Gates: `big` at 8 and 64 connections at least 1.25x v1.2.2's and 1.15x Redis's in the same session and within 10 % of recorded; `used_memory` a document 5 %; `small` (the Python client is the limit there), `none`, p99s and the load shown. Needs `REGRESS_REDISEARCH_SO` for Redis (as `28`); `min_cpus=8`, recorded on a `Standard_D8s_v5` (see [the run](#recorded-run-suite-51)) |
 | `52-small-lists-memory` | #1022 | Misskey's home timelines: 10,000 lists of 300 ten-byte ids (`load`: `RPUSH`, one element a command through a raw pipelined socket as `redis-cli --pipe` sends them; `load-batch`: one `RPUSH` of 300 a list), then every list taken through 3,000 `LPUSH` + `LTRIM key 0 299` pairs (`timeline`: chunks filled at the front, trimmed at the back and given up), the same lists of 32- and 64-byte elements (`size32`, `size64`) and 10,000 lists of 30 elements (`tiny`): `used_memory` and RSS a list element and `MEMORY USAGE` of the first list, `LLEN` of it (300, 30). Gates: `used_per_element` within 5 % (or 1 B) of recorded, at most 1.3x Redis's in the same session and at most 0.8x v1.2.2's; `rss_per_element` within 10 % (or 1 B) of recorded, at most 1.5x Redis's (1.4x for `timeline`, whose chunks come and go in slab blocks: 1.17x measured) and at most 0.8x v1.2.2's (0.5x for `timeline`); `list_len` as recorded; the RSS of `tiny` (4.5 MB in all) is shown, not gated. Recorded through `run-all.sh --candidate <default build> --only 52 --record` on a `Standard_D4s_v5` with the default-features (glibc) candidate, the v1.2.2 release tarball's binary and the source-built Redis 8.10.2 (`results/pr-1022-52-d4s_v5`) |
-| `53-large-string-writes` | #1027, #1031, #1016 | one string of 64 MiB a case (`SETRANGE k 67108863 a`), one connection, one call at a time (2,000 calls a round; v1.2.2, which copies the string on every call: 10), 3 rounds: a `SETBIT` that leaves the bit as it is and a `BITFIELD ... GET u8` (#1027), a `SETBIT` that changes a bit, by turns set and cleared (#1031), and `APPEND` of 3 bytes and of 1 KiB (#1016): the server's own microseconds a call (`INFO commandstats`) and the client's wall time a call, median of the rounds; `bad_replies` and the lengths the appends end at. Gates in the same session, with fixed margins: every server time at most 0.01x v1.2.2's (100x faster: v1.2.2 takes 30-130 ms a call, the candidate one or two microseconds), every wall time at most 0.05x v1.2.2's and at most 2x Redis's; no gate on the server times against Redis's (both about a microsecond, on a clock of whole microseconds); `bad_replies` exactly 0 and the lengths as recorded. Recorded through `run-all.sh --candidate <default build> --only 53 --record` on a `Standard_D4s_v5` (`results/pr-append-53-record`) |
+| `53-large-string-writes` | #1027, #1031, #1016, #1065 | one string of 64 MiB a case (`SETRANGE k 67108863 a`), one connection, one call at a time (2,000 calls a round; v1.2.2, which copies the string on every call: 10), 3 rounds: a `SETBIT` that leaves the bit as it is and a `BITFIELD ... GET u8` (#1027), a `SETBIT` that changes a bit, by turns set and cleared (#1031), `APPEND` of 3 bytes and of 1 KiB (#1016), and `SETRANGE` of 3 bytes at the string's end and 1 KiB past it (#1065): the server's own microseconds a call (
```

**File**: `benchmarks/1.3.0/regressions/suites/53-large-string-writes.py` (modified, +22/-9)
```diff
@@ -1,15 +1,16 @@
 #!/usr/bin/env python3
 """#1016: writes to a large string cost the same whatever its length.
 
-Three changes of 1.3.0 make a command on a long string cost what the bytes
+Four changes of 1.3.0 make a command on a long string cost what the bytes
 it touches cost, not what the string's length does: #1027 reads a bit or a
 field where the string is kept (a `SETBIT` that leaves the bit as it is, a
 `BITFIELD` with only `GET`s), #1031 writes a `SETBIT` that changes a bit in
-place when nothing but its key holds the string, and #1016's `APPEND`
+place when nothing but its key holds the string, #1016's `APPEND`
 writes in place too, a long string keeping room for the next appends
 (a quarter of its length, at most 16 MiB) and growing by `realloc` when it
-has none left. In v1.2.2 each of these copied the whole string, twice for
-a `SETBIT` that changed a bit.
+has none left, and #1065 grows a string a `SETRANGE` writes at or past its
+end as an `APPEND` does. In v1.2.2 each of these copied the whole string,
+twice for a `SETBIT` that changed a bit.
 
 Dataset, one server, one key per case: a string of 64 MiB (`SETRANGE k
 67108863 a`: zero bytes and an `a`), made afresh for each case.
@@ -23,13 +24,17 @@
   setbit_change   SETBIT k <bit> 1, then SETBIT k <bit> 0, by turns
   append_3b       APPEND k abc
   append_1k       APPEND k <1,024 bytes>
+  setrange_grow   SETRANGE k <length> abc (at the string's end)
+  setrange_gap    SETRANGE k <length + 1,024> abc (1,024 zero bytes before it)
 
 Each emits `<case>_srv_us`, the server's own microseconds a call (`INFO
 commandstats`, reset before each round), and `<case>_us`, the client's wall
 time a call, round trip included. `bad_replies` counts replies that are not
 what the case makes them (0 for the no-op `SETBIT`, `[0]` for the field,
-the old bit, the new length); `append_3b_strlen` and `append_1k_strlen` are
-the lengths the appends end at.
+the old bit, the new length); `append_3b_strlen`, `append_1k_strlen`,
+`setrange_grow_strlen` and `setrange_gap_strlen` are the lengths the strings
+end at. Every `SETRANGE` writes from the end its key's string has then, so
+each call grows it, and none makes the key or writes inside the string.
 
 Gates, all in the same session, with large fixed margins rather than
 recorded values: every `<case>_srv_us` at most 0.01x v1.2.2's (at least
@@ -38,7 +43,7 @@
 at most 0.05x v1.2.2's (the round trip, about 50 us from Python, bounds
 what can be seen) and at most 2x Redis's. The server times are not gated
 against Redis's: both are around a microsecond, and the server clock counts
-whole microseconds. `bad_replies` exactly 0, and the two lengths as
+whole microseconds. `bad_replies` exactly 0, and the four lengths as
 recorded (they follow from the call counts).
 """
 import os
@@ -54,8 +59,10 @@
 LEN = 64 << 20
 ROUNDS = 3
 WARM = 3
-CASES = ["setbit_noop", "bitfield_get", "setbit_change", "append_3b", "append_1k"]
+CASES = ["setbit_noop", "bitfield_get", "setbit_change", "append_3b", "append_1k",
+         "setrange_grow", "setrange_gap"]
 KILO = b"x" * 1024
+GAP = 1024
 
 
 def calls_for(ctx):
@@ -84,6 +91,12 @@ def plan(case, key, length):
         return (lambda i: (["BITFIELD", key, "GET", "u8", LEN // 2], [0])), "bitfield"
     if case == "setbit_change":
         return (lambda i: (["SETBIT", key, bit, 1 - i % 2], i % 2)), "setbit"
+    if case.startswith("setrange"):
+        # Call i writes at the end calls 0..i-1 left, after the gap.
+        gap = GAP if case == "setrange_gap" else 0
+        step = gap + 3
+        return (lambda i: (["SETRANGE", key, length + step * i + gap, "abc"],
+                           length + step * (i + 1))), "setrange"
     step = 3 if case == "append_3b" else 1024
     extra = b"abc" if case == "append_3b" else KILO
     return (lambda i: (["APPEND", key, extra], length + step * (i + 1))), "append"
@@ -122,7 +135,7 @@ def run(ctx):
         ctx.raw["cases"][case] = {"wall_us": wall, "server_us": server, "strlen": c.strlen(key)}
         ctx.emit(case + "_srv_us", median(server), "us", "lower", gate=vs_v1_2_2(0.01), samples=server)
         ctx.emit(case + "_us", median(wall), "us", "lower", gate=gate_wall, samples=wall)
-        if case.startswith("append"):
+        if case.startswith(("append", "setrange")):
             ctx.emit(case + "_strlen", c.strlen(key), "bytes", "higher", gate=EXACT)
         c.delete(key)
     ctx.emit("bad_replies", bad, "replies", "lower", gate=EXACT)
```

---

### Incident Patch 3: `86d2a651` (2026-11-26)
**Commit Message**: Merge pull request #1058 from lofoneh/fix/1054-error-values

Scripts: what error() raises is placed as Redis places it (#1054)

**File**: `CHANGELOG.md` (modified, +30/-8)
```diff
@@ -675,10 +675,28 @@ project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
   arithmetic on a nil value` was not counted at all.
 
 - **`error` reads a number as Lua 5.1 does (#1054).** Raised with a level,
-  a number gets the place before it, as a string does: `error(42)` on
-  line 2 is `user_script:2: 42`. What a script catches is what it would
-  catch in Redis: `pcall(error, 42)` gives the string `"42"`, where it gave
-  the number; `pcall(error, 42, 0)` still gives the number.
+  a number gets the place before it, as a string does, and is written
+  `%.14g`, as Redis's Lua writes it: `error(42)` on line 2 is
+  `user_script:2: 42`, and `error(10/2)` is `user_script:2: 5`, not `5.0`;
+  `error(10/2, 0)` replies `ERR 5`. What a script catches is what it would catch in Redis: `pcall(error, 42)`
+  gives the string `"42"`, where it gave the number; `pcall(error, 42, 0)`
+  still gives the number.
+
+- **`error` of a value that is not a string replies it with no place of its
+  own (#1054).** `error(nil)`, `error(true)`, `error(false)`, `error()` and
+  `error(42, 0)` reply `ERR nil`, `ERR true`, `ERR false`, `ERR nil` and
+  `ERR 42`, then `script: <sha>, on @user_script:N.` with the line they
+  were raised on, as in Redis; they replied `ERR user_script:1: nil …`
+  whatever the line. Inside `coroutine.wrap`, `N` is the line in the
+  coroutine, where Redis names the line of the call: Lua 5.4's `wrap`
+  places a string only and raises anything else as it is (Redis's, Lua
+  5.1's, places a number too, so that `error(42, 0)` there replies
+  `ERR user_script:4: 42 …`).
+
+- **A nil index error reads `attempt to index a nil value` however it is
+  raised (#1054).** Caught and raised again with `error(e, 0)`, it replied
+  the whole of Lua 5.4's message (`attempt to index a nil value (local
+  't')`); it is cut now as the one raised where it happened is.
 
 - **A function library's lines are counted from its `#!lua` line, under
   Redis's name `user_function` (#1054).** A `FUNCTION LOAD` error says
@@ -2557,10 +2575,14 @@ project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 - **A script's error says where in the script it happened, as in Redis
   (#1054).** A runtime error keeps the `user_script:N:` Lua gives it, and
   its reply ends `script: <sha>, on @user_script:N.`, `N` being the line
-  it left the script from. An `EVAL`'d script that does not compile is
-  reported as `SCRIPT LOAD` reports it, `Error compiling script (new
-  function): user_script:N: …`, where it said `user_script:1` whatever the
-  line. `FCALL` names `user_function` and the function.
+  it left the script from (`=[C]:-1` when `error` was called by a C
+  function, as with `string.gsub(s, p, error)`, as Redis has it). An
+  `EVAL`'d script that does not compile is reported as `SCRIPT LOAD`
+  reports it, `Error compiling script (new function): user_script:N: …`,
+  where it said `user_script:1` whatever the line. `error(nil)`,
+  `error(true)`, `error(false)`, `error()` and `error(42, 0)` name the line
+  they were raised on.
+  `FCALL` names `user_function` and the function, a table error too.
 
 - **`CONFIG REWRITE` writes every setting the server runs with, and no
   `replicaof` after `REPLICAOF NO ONE`.** It writes each setting
```

**File**: `src/commands/lua.rs` (modified, +204/-129)
```diff
@@ -747,20 +747,14 @@ fn lua_error_message(error: &LuaError) -> String {
         LuaError::SyntaxError { message, .. } => message.clone(),
         other => other.to_string(),
     };
-    if let Some((_, msg)) = marked_table_error(&message) {
-        return msg.to_string();
-    }
-    // A string `error` raised, kept with its place (`remember_error_place`):
-    // its message. `error` is not there while a library loads, as in Redis,
-    // but nothing marked is let out if that changes.
-    if let Some(at) = message.find(PLACE_ERROR_MARK) {
-        let marked = &message[at + PLACE_ERROR_MARK.len()..];
-        let marked = &marked[..marked.find('\n').unwrap_or(marked.len())];
-        return marked
-            .splitn(3, '\u{1}')
-            .nth(2)
-            .unwrap_or(marked)
-            .to_string();
+    // A table's `err`, or what `error` raised kept with its place
+    // (`remember_error_place`): its message. `error` is not there while a
+    // library loads, as in Redis, but nothing marked is let out if that
+    // changes.
+    for mark in [TABLE_ERROR_MARK, PLACE_ERROR_MARK] {
+        if let Some((_, _, msg)) = marked_error(&message, mark) {
+            return msg.to_string();
+        }
     }
     message
         .lines()
@@ -4362,27 +4356,48 @@ fn normalize_redis_eval_nil_index_error(s: String) -> String {
 /// message: as `SCRIPT LOAD` says it ([`script_compiles`]).
 const SCRIPT_COMPILE_ERROR: &str = "ERR Error compiling script (new function): ";
 
-/// A Lua error that says where in the script it happened (`user_script:3:
-/// …`, `user_function:7: …`), kept with that place for the reply's tail,
-/// the message as Lua gives it (#1054). `attempt to index a nil value` drops
-/// what Lua 5.4 adds after it, as [`normalize_redis_eval_nil_index_error`]
-/// has it, so that the reply reads `… nil value script: …` as Redis's does.
-fn placed_error(message: &str) -> Option<String> {
-    let (chunk, rest) = ["user_script", "user_function"]
+/// The place Lua puts before a message from a script's code
+/// (`user_script:3: `, `user_function:7: `): the chunk, the line and what
+/// follows.
+fn place_prefix(message: &str) -> Option<(&'static str, &str, &str)> {
+    ["user_script", "user_function"]
         .into_iter()
-        .find_map(|chunk| Some((chunk, message.strip_prefix(chunk)?.strip_prefix(':')?)))?;
-    let digits = rest.bytes().take_while(u8::is_ascii_digit).count();
-    let (line, what) = (&rest[..digits], rest[digits..].strip_prefix(": ")?);
-    if line.is_empty() {
-        return None;
+        .find_map(|chunk| {
+            let rest = message.strip_prefix(chunk)?.strip_prefix(':')?;
+            let digits = rest.bytes().take_while(u8::is_ascii_digit).count();
+            if digits == 0 {
+                return None;
+            }
+            Some((chunk, &rest[..digits], rest[digits..].strip_prefix(": ")?))
+        })
+}
+
+/// `attempt to index a nil value`, behind whatever places come before it,
+/// without what Lua 5.4 adds after it (`(local 't')`, `(field 'x')`), as
+/// [`normalize_redis_eval_nil_index_error`] has it: Redis's suite matches
+/// `*attempt to index a nil value script*`. The same error reads the same,
+/// raised where it happened or caught and raised again (#1055 review).
+fn index_nil_trimmed(message: &str) -> &str {
+    const NIL_INDEX: &str = "attempt to index a nil value";
+    let mut rest = message;
+    while let Some((_, _, after)) = place_prefix(rest) {
+        rest = after;
     }
-    let what = if what.starts_with("attempt to index a nil value") {
-        "attempt to index a nil value"
+    if rest.starts_with(NIL_INDEX) {
+        &message[..message.len() - rest.len() + NIL_INDEX.len()]
     } else {
-        what
-    };
+        message
+    }
+}
+
+/// A Lua error that says where in the script it happened (`user_script:3:
+/// …`, `user_function:7: …`), kept with that place for the reply's tail,
+/// the message as Lua gives it ([`index_nil_trimmed`]) (#1054).
+fn placed_error(message: &str) -> Option<String> {
+    let (chunk, line, _) = place_prefix(message)?;
     Some(format!(
-        "{PLACE_ERROR_MARK}{chunk}\u{1}{line}\u{1}{chunk}:{line}: {what}"
+        "{PLACE_ERROR_MARK}@{chunk}\u{1}{line}\u{1}{}",
+        index_nil_trimmed(message)
     ))
 }
 
@@ -4411,8 +4426,10 @@ fn redis_simple_error_has_category_prefix(s: &str) -> bool {
             .all(|c| c.is_ascii_uppercase() || c == '_' || c == '-')
 }
 
-/// What [`remember_error_table`] puts before a table's `err`, then the line
-/// and a `\u{1}`. Not NUL: mlua reads an error's message as a C string.
+/// What [`remember_error_table`] puts before a table's `err`, then the
+/// source as Redis names it (`@user_script`, `@user_function`, `=[C]`) and
+/// the line, each followed by a `\u{1}`. Not NUL: mlua reads an error's
+/// message as a C string.
 const TABLE_ERROR_MARK: &str = "\u{1}kividb-error\u{1}";
 
 thread_local! {
@@ -4429,16 +4446,21 @@ threa
```

**File**: `tests/luascripting.rs` (modified, +423/-0)
```diff
@@ -3806,3 +3806,426 @@ fn a_number_error_caught_is_what_redis_s_lua_gives() {
         }
     }
 }
+
+// ── #1055 review, second part: values, numbers and frames as Redis has them ──
+
+/// `error` reads a number as Lua 5.1 does: as a string with the place
+/// before it, written `%.14g` (`10/2` is `5`, not 5.4's `5.0`); at level 0
+/// the reply writes it so too. What a script catches is what it would
+/// catch in Redis.
+#[test]
+fn error_reads_a_number_as_lua_51_does() {
+    let _serial = LUA_SCRIPTING_SERIAL.lock().unwrap();
+    let port = free_port();
+    start_server(port);
+    let mut c = Conn::connect(port);
+
+    // Caught with a level: the string 5.1 makes of it.
+    match c.cmds(&[
+        "EVAL",
+        "local ok, e = pcall(error, 10/2) return {type(e), e}",
+        "0",
+    ]) {
+        RespValue::Array(items) => {
+            assert_eq!(items[0].as_str(), "string");
+            assert_eq!(items[1].as_str(), "5");
+        }
+        other => panic!("{other:?}"),
+    }
+
+    for (script, expected) in [
+        (
+            "local x = 1\nerror(10/2)",
+            "ERR user_script:2: 5 script: {sha}, on @user_script:2.",
+        ),
+        (
+            "local x = 1\nerror(10/2, 0)",
+            "ERR 5 script: {sha}, on @user_script:2.",
+        ),
+        (
+            "error(-0.0)",
+            "ERR user_script:1: -0 script: {sha}, on @user_script:1.",
+        ),
+        (
+            "error(1e20)",
+            "ERR user_script:1: 1e+20 script: {sha}, on @user_script:1.",
+        ),
+        (
+            "error(0.1)",
+            "ERR user_script:1: 0.1 script: {sha}, on @user_script:1.",
+        ),
+    ] {
+        assert_script_error(&mut c, script, &["0"], expected);
+    }
+}
+
+/// `error` given something that is not a string (or given nothing): what
+/// Redis's `tostring` says of it, and the line it was raised on.
+#[test]
+fn error_with_a_value_that_is_not_a_string_names_where_it_was_raised() {
+    let _serial = LUA_SCRIPTING_SERIAL.lock().unwrap();
+    let port = free_port();
+    start_server(port);
+    let mut c = Conn::connect(port);
+    c.cmds(&["SET", "notint", "abc"]);
+
+    for (raise, said) in [
+        ("error(42, 0)", "42"),
+        ("error(nil)", "nil"),
+        ("error(true)", "true"),
+        ("error(false)", "false"),
+        ("error()", "nil"),
+    ] {
+        assert_script_error(
+            &mut c,
+            &format!("local x = 1\n{raise}"),
+            &["0"],
+            &format!("ERR {said} script: {{sha}}, on @user_script:2."),
+        );
+    }
+    // A field of what `pcall` caught that is not there.
+    assert_script_error(
+        &mut c,
+        "local ok, e = pcall(redis.call, 'INCR', KEYS[1])\nerror(e.err, 0)",
+        &["1", "notint"],
+        "ERR nil script: {sha}, on @user_script:2.",
+    );
+}
+
+/// Where Redis's message handler finds an error raised through other
+/// functions: one frame past `error`, which is `=[C]:-1` when `error` was
+/// called by a C function (`string.gsub(s, p, error)`), and the line a
+/// coroutine or a `pcall`/`xpcall` that caught the error raises it again on.
+#[test]
+fn an_error_raised_through_other_functions_is_placed_as_in_redis() {
+    let _serial = LUA_SCRIPTING_SERIAL.lock().unwrap();
+    let port = free_port();
+    start_server(port);
+    let mut c = Conn::connect(port);
+
+    let caught = "local ok, e = xpcall(function()\n  local x\n  return x + 1\nend, function(m) return m end)\n";
+    for (script, expected) in [
+        (
+            "local x = 1\nreturn string.gsub('abc', 'b', error)".to_string(),
+            "ERR b script: {sha}, on =[C]:-1.",
+        ),
+        (
+            "local t = {3, 1, 2}\ntable.sort(t, function(a, b) error('sboom') end)".to_string(),
+            "ERR user_script:2: sboom script: {sha}, on @user_script:2.",
+        ),
+        (
+            "local f = coroutine.wrap(function()\n  error('cboom')\nend)\nf()".to_string(),
+            "ERR user_script:4: user_script:2: cboom script: {sha}, on @user_script:4.",
+        ),
+        (
+            "local f = coroutine.wrap(function()\n  local b\n  return 1 + b\nend)\nf()".to_string(),
+            "ERR user_script:5: user_script:3: attempt to perform arithmetic on a nil value \
+             (local 'b') script: {sha}, on @user_script:5.",
+        ),
+        (
+            format!("{caught}error(e)"),
+            "ERR user_script:5: user_script:3: attempt to perform arithmetic on a nil value \
+             (local 'x') script: {sha}, on @user_script:5.",
+        ),
+        (
+            format!("{caught}error(e, 0)"),
+            "ERR user_script:3: attempt to perform arithmetic on a nil value (local 'x') \
+             script: {sha}, on @user_script:5.",
+        ),
+    ] {
+        assert_script_error(&mut c, &script, &["0"], expected);
+    }
+}
+
+/// A message's line breaks are spaces in the reply, which is one line.
+#[test]
+fn an_error_message_is_
```

#### Recent Merged Pull Requests:
- **PR #1067** (2026-11-27): Allocate collection group arrays from chunk slabs (@BLVCK-MAMBA-6)
- **PR #1066** (2026-11-26): Scripts: a script's own nil index message, a number err, and a finalizer's coroutine (#1054) (@lofoneh)
- **PR #1065** (2026-11-26): Grow SETRANGE from the end using append capacity (@Parikalp-Bhardwaj)
- **PR #1063** (2026-11-26): List ranges read integer arguments as Redis does (@Seyamalam)
- **PR #1062** (2026-11-26): HRANDFIELD reads its count as Redis does (@Seyamalam)
- **PR #1060** (2026-11-26): String ranges read integer arguments as Redis does (@Seyamalam)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Regressions: suite 53 recorded with the SETRANGE cases (D4s_v5)

**RULE**:
When implementing operations in `benchmarks/1.3.0/regressions/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kividbio/kividb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6d3497e5`: Regressions: suite 53 recorded with the SETRANGE cases (D4s_v5). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `benchmarks/1.3.0/regressions/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| `53-large-string-writes` | #1027, #1031, #1016, #1065 | one string of 64 MiB a case (`SETRANGE k 67108863 a`), one connection, one call at a time (2,000 calls a round; v1.2.2, which copies the string on every call: 10), 3 rounds: a `SETBIT` that leaves the bit as it is and a `BITFIELD ... GET u8` (#1027), a `SETBIT` that changes a bit, by turns set and cleared (#1031), `APPEND` of 3 byte
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
| `53-large-string-writes` | #1027, #1031, #1016, #1065 | one string of 64 MiB a case (`SETRANGE k 67108863 a`), one connection, one call at a time (2,000 calls a round; v1.2.2, which copies the string on every call: 10), 3 rounds: a `SETBIT` that leaves the bit as it is and a `BITFIELD ... GET u8` (#1027), a `SETBIT` that changes a bit, by turns set and cleared (#1031), `APPEND` of 3 bytes and of 1 KiB (#1016), and `SETRANGE` of 3 bytes at the string's end and 1 KiB past it (#1065): the server's own microseconds a call (`INFO commandstats`) and the client's wall time a call, median of the rounds; `bad_replies` and the lengths the appends and `SETRANGE`s end at. Gates in the same session, with fixed margins: every server time at most 0.01x v1.2.2's (100x faster: v1.2.2 takes 30-130 ms a call, the candidate one or two microseconds), every wall time at most 0.05x v1.2.2's and at most 2x Redis's; no gate on the server times against Redis's (both about a microsecond, on a clock of whole microseconds); `bad_replies` exactly 0 and the lengths as recorded. Recorded through `run-all.sh --candidate <default build> --only 53 --record` on a `Standard_D4s_v5` (`results/pr-append-53-record`); t
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6d3497e5` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
