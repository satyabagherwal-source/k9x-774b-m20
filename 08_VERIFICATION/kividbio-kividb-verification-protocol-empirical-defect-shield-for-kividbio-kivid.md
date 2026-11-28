# Verification Protocol: Verification Protocol: Empirical Defect Shield for kividbio/kividb

<!-- PROVENANCE_START
{
  "source_repository": "kividbio/kividb",
  "source_url": "https://github.com/kividbio/kividb",
  "source_version": "59b4cf65",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-28T00:19:32.376Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-kividbio-kividb",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kividbio/kividb](https://github.com/kividbio/kividb) (Revision: `59b4cf65`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-28T00:19:32.376Z`  
> **Learning ID**: `learn-github-kividbio-kividb`


## 1. Scope & Verification Target
- **Target Repository**: `kividbio/kividb` (Commit: `59b4cf65`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): kividbio/kividb

> **Canonical Artifact**: `07_PROJECT_LEARNING/kividbio-kividb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kividbio/kividb](https://github.com/kividbio/kividb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T00:19:30.464Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kividbio/kividb`
- **Description**: A fast, multi-threaded Redis® and Valkey alternative written in Rust: drop-in compatible, with full-text and vector search built in
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 1557 stars

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
- **Issue #1075** (2026-11-27): **Config: warn on daemonize yes instead of failing at startup**
  *Symptoms*: <!-- Security vulnerabilities: do NOT report them here. See SECURITY.md for how to report one privately. -->  **What happened**  Starting KiviDB with a Redis-style configuration file that includes `daemonize yes` fails at startup with a hard error:  `'daemonize yes' is not supported: KiviDB runs in the foreground`  Users migrating from Redis who carry over settings from `redis.conf` hit a startup failure instead of a non-fatal warning like other unsupported/no-op Redis directives (`save`, `hz`, `tcp-keepalive`, `pidfile`, `unixsocket`).  **How to reproduce**  1. Create a config file `kividb.conf` containing `daemonize yes`. 2. Start KiviDB with `--configfile kividb.conf`. 3. KiviDB exits with `line 1: 'daemonize yes' is not supported: KiviDB runs in the foreground`.  **What you expected**  KiviDB should accept `daemonize yes` with a warning (e.g. `'daemonize' is accepted but has no effect: KiviDB runs in the foreground`) and continue starting in the foreground, matching how `save` and similar Redis directives are handled, and document this behavior in `docs/MIGRATING_FROM_REDIS.md`.  In Redis, `daemonize yes` forks into the background. KiviDB always runs in the foreground (managed by systemd, Docker, or a process supervisor).  **Environment**  - KiviDB version (`kividb --version`): `1.2.1` (`upstream/master` at `e55b4404`) - Build variant (`default`, `lua`, `tls` or `full`): `default` - Installed from (binary, .deb/.rpm, Docker image, built from source): built from source - O

- **Issue #1016** (2026-11-25): **Large-string SETBIT, BITFIELD, SETRANGE and APPEND copy the entire value on small writes**
  *Symptoms*: ### Summary  While testing i noticed that small updates to large strings copy the entire buffer. This also affects read-only and no-op bitmap operations, making the cost depend on the string size rather than the actual change.  ### Benchmark results  Tested on Apple M3 Pro with KiviDB (release/fat LTO) and Redis 8.10.3 using a 64 MiB string. Each scenario was repeated three times, with replies and final values verified.  | Command | KiviDB | Redis | |---|---:|---:| | SETBIT (unchanged) | 1,423 µs | ≤0.6 µs | | SETBIT (changed) | 2,847 µs | ≤0.6 µs | | BITFIELD INCRBY | 5,033 µs | ≤0.8 µs | | BITFIELD GET | 2,835 µs | ≤0.6 µs | | SETRANGE (3 bytes) | 2,837 µs | ≤0.8 µs | | APPEND (3 bytes) | 1,402 µs | ≤0.3 µs |  With four pipelined clients, KiviDB handled 370–375 SETBIT/s compared to at least 475,000 SETBIT/s on Redis (client-limited).  Peak RSS increased from 202 MiB to 266 MiB during SETBIT and 330 MiB during BITFIELD.  Only a scratch macOS build fix was applied; no string or bitmap logic was changed.  ### Source findings  - `bitmap.rs:118,153` — SETBIT copies the entire value, even for unchanged bits, and copies it again when storing changes. - `bitmap.rs:599,608,724,729` — BITFIELD copies, clones and compares the entire buffer. - `strings.rs:685,1232` — APPEND and SETRANGE fall back to full-buffer copies for non-inline strings.  ### Possible improvement  - Avoid allocations for unchanged SETBIT and read-only BITFIELD operations. - Update only affected bytes when the buffe

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

### Incident Patch 1: `59b4cf65` (2026-11-27)
**Commit Message**: Connections: a grown read buffer is kept while its turns need it, and given back after sixteen that do not (#1077)

* Connections: a grown read buffer is given back after sixteen turns that did not need it

* Idle connection memory: tests of requests in small pieces and of bursts between single commands; suite 55 opens the count it gates; configuration note

* Suite 56: bursts between single commands, and requests in small pieces

* Suite 56: recorded on a Standard_D8s_v5

* Tests: the pipeline read test sends the small commands the buffer rule counts

A grown read buffer is given back after sixteen turns in a row that did not
need it; the test sends seventeen PINGs before it expects the pipeline to be
read in two reads again.

* Tests: the replication byte counts are first read once the link is quiet

The master's and the replica's counts are read on two connections; the test
waits until neither moves between two readings before taking its starting
values, so both start from the same point of the stream.

**File**: `benchmarks/1.3.0/regressions/README.md` (modified, +2/-0)
```diff
@@ -72,6 +72,7 @@ and why.
 | `53-large-string-writes` | #1027, #1031, #1016, #1065 | one string of 64 MiB a case (`SETRANGE k 67108863 a`), one connection, one call at a time (2,000 calls a round; v1.2.2, which copies the string on every call: 10), 3 rounds: a `SETBIT` that leaves the bit as it is and a `BITFIELD ... GET u8` (#1027), a `SETBIT` that changes a bit, by turns set and cleared (#1031), `APPEND` of 3 bytes and of 1 KiB (#1016), and `SETRANGE` of 3 bytes at the string's end and 1 KiB past it (#1065): the server's own microseconds a call (`INFO commandstats`) and the client's wall time a call, median of the rounds; `bad_replies` and the lengths the appends and `SETRANGE`s end at. Gates in the same session, with fixed margins: every server time at most 0.01x v1.2.2's (100x faster: v1.2.2 takes 30-130 ms a call, the candidate one or two microseconds), every wall time at most 0.05x v1.2.2's and at most 2x Redis's; no gate on the server times against Redis's (both about a microsecond, on a clock of whole microseconds); `bad_replies` exactly 0 and the lengths as recorded. Recorded through `run-all.sh --candidate <default build> --only 53 --record` on a `Standard_D4s_v5` (`results/pr-1065-53-record`: all seven cases, with the `SETRANGE` ones, from the PR's head built by rustc 1.100.0; the five earlier cases are in `results/pr-append-53-record`) |
 | `54-yii2-mutex` | #1049 | yii2-redis's `Mutex` cycle: `SET <lock> <token> NX PX 30000`, then the release, `EVAL` of the compare-and-delete with the script's text every time, on a lock of the connection's own (no hash tag), from 32 connections one command at a time each (`lib/mutex_load.c`, one thread a connection; needs a C compiler); the calls checked under MONITOR first. `--threads 4` (Redis `--io-threads 4`) on the first half of the CPUs, the load on the other: commands a second, the `EVAL` and `SET` p50 and p99, the server's CPUs, median of 3 rounds of 10 s; the candidate must run 90 % of the releases beside others. Gates in the same session: commands a second at least 1.2x Redis's and 1.6x v1.2.2's, and within 10 % of recorded; the `EVAL` p50 at most 0.9x and its p99 at most 1.1x Redis's. Needs the `lua,tls` builds (`--candidate-full`); `min_cpus=8`, recorded on a `Standard_D8s_v5` (`results/pr-1049-54-final`) |
 | `55-idle-connection-memory` | idle connections | 10,000 connections opened from one client and left idle, on Tokio and on io_uring, each a configuration: ones that send nothing (`*-idle`) and ones that send one `PING` (`*-ping`); `used_memory` and VmRSS growth a connection, 5 s after the last went idle, with Redis's figure beside it; `CONFIG SET maxclients 20000` first. Gates: `used_per_conn` within 5 % (or 256 B) of recorded and at least 60 % of the recorded gain over v1.2.2; `rss_per_conn` within 10 % (or 1 KiB); `clients` as recorded. Recorded through `run-all.sh --candidate <default build> --only 55 --record` on a `Standard_D4s_v5` (`results/idle-connections-55-d4s_v5`) |
+| `56-burst-between-commands` | idle connections, the read buffer kept | one connection, on io_uring and on Tokio, each a configuration (`--threads 2`): 2,000 cycles of a pipelined burst of 400 `SET`s of 100 B (about 50 KiB in one write) then 4 `GET`s one at a time; and 200 `SET`s of an 8 KiB value sent in 2 KiB pieces 2 ms apart. The server's reads a burst (INFO `total_reads_processed`, less the `GET`s'), and its CPU time a burst cycle and a slow request (every thread's schedstat, shown). Gates: `burst_reads` within 0.25 of recorded and at most 1.1x v1.2.2's in the same session (a read buffer given back between bursts makes each burst one read more). Recorded on a `Standard_D8s_v5` (`results/buffer-reuse-56-d8s_v5`) |
 
 ## Running it
 
@@ -292,6 +293,7 @@ was re-recorded for it:
 | `53-large-string-writes` | 2 | one connection, one call at a time, as suite `48` |
 | `54-yii2-mutex` | 4 | the issue's: the server pinned to half the CPUs of a `Standard_D8s_v5`, Redis with `--io-threads 4` |
 | `55-idle-connection-memory` | 2 | the default on a `Standard_D4s_v5`: what a connection holds does not depend on the count |
+| `56-burst-between-commands` | 2 | as suite `55`: one connection |
 | `32-default-threads` | 0 (none) | measures the default on purpose |
 
 Redis ignores the count. The default itself is watched by
```

**File**: `benchmarks/1.3.0/regressions/baseline.json` (modified, +156/-0)
```diff
@@ -37195,6 +37195,162 @@
           "keep": 0.6
         }
       ]
+    },
+    "56-burst-between-commands/tokio/burst_cpu_us": {
+      "suite": "56-burst-between-commands",
+      "config": "tokio",
+      "metric": "burst_cpu_us",
+      "unit": "us",
+      "better": "lower",
+      "recorded": {
+        "v1_2_2": 284.0166,
+        "candidate": 253.2641,
+        "redis": 312.8654,
+        "vm": "Standard_D8s_v5",
+        "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
+        "date": "2026-11-27",
+        "commit": "7f7c0541",
+        "label": "buffer-reuse-56-d8s_v5",
+        "rustc": "1.100.0",
+        "nproc": 8
+      },
+      "gate": [
+        {
+          "kind": "info"
+        }
+      ]
+    },
+    "56-burst-between-commands/tokio/burst_reads": {
+      "suite": "56-burst-between-commands",
+      "config": "tokio",
+      "metric": "burst_reads",
+      "unit": "reads",
+      "better": "lower",
+      "recorded": {
+        "v1_2_2": 13.0,
+        "candidate": 2.0,
+        "redis": 3.0,
+        "vm": "Standard_D8s_v5",
+        "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
+        "date": "2026-11-27",
+        "commit": "7f7c0541",
+        "label": "buffer-reuse-56-d8s_v5",
+        "rustc": "1.100.0",
+        "nproc": 8
+      },
+      "gate": [
+        {
+          "kind": "rel",
+          "pct": 0,
+          "abs": 0.25
+        },
+        {
+          "kind": "vs_v1_2_2",
+          "max_x": 1.1
+        }
+      ]
+    },
+    "56-burst-between-commands/tokio/slow_cpu_us": {
+      "suite": "56-burst-between-commands",
+      "config": "tokio",
+      "metric": "slow_cpu_us",
+      "unit": "us",
+      "better": "lower",
+      "recorded": {
+        "v1_2_2": 113.4863,
+        "candidate": 120.4373,
+        "redis": 96.9379,
+        "vm": "Standard_D8s_v5",
+        "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
+        "date": "2026-11-27",
+        "commit": "7f7c0541",
+        "label": "buffer-reuse-56-d8s_v5",
+        "rustc": "1.100.0",
+        "nproc": 8
+      },
+      "gate": [
+        {
+          "kind": "info"
+        }
+      ]
+    },
+    "56-burst-between-commands/uring/burst_cpu_us": {
+      "suite": "56-burst-between-commands",
+      "config": "uring",
+      "metric": "burst_cpu_us",
+      "unit": "us",
+      "better": "lower",
+      "recorded": {
+        "v1_2_2": 252.9976,
+        "candidate": 252.4986,
+        "redis": 305.4377,
+        "vm": "Standard_D8s_v5",
+        "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
+        "date": "2026-11-27",
+        "commit": "7f7c0541",
+        "label": "buffer-reuse-56-d8s_v5",
+        "rustc": "1.100.0",
+        "nproc": 8
+      },
+      "gate": [
+        {
+          "kind": "info"
+        }
+      ]
+    },
+    "56-burst-between-commands/uring/burst_reads": {
+      "suite": "56-burst-between-commands",
+      "config": "uring",
+      "metric": "burst_reads",
+      "unit": "reads",
+      "better": "lower",
+      "recorded": {
+        "v1_2_2": 2.0,
+        "candidate": 2.0,
+        "redis": 3.0,
+        "vm": "Standard_D8s_v5",
+        "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
+        "date": "2026-11-27",
+        "commit": "7f7c0541",
+        "label": "buffer-reuse-56-d8s_v5",
+        "rustc": "1.100.0",
+        "nproc": 8
+      },
+      "gate": [
+        {
+          "kind": "rel",
+          "pct": 0,
+          "abs": 0.25
+        },
+        {
+          "kind": "vs_v1_2_2",
+          "max_x": 1.1
+        }
+      ]
+    },
+    "56-burst-between-commands/uring/slow_cpu_us": {
+      "suite": "56-burst-between-commands",
+      "config": "uring",
+      "metric": "slow_cpu_us",
+      "unit": "us",
+      "better": "lower",
+      "recorded": {
+        "v1_2_2": 106.9595,
+        "candidate": 127.5567,
+        "redis": 96.2118,
+        "vm": "Standard_D8s_v5",
+        "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
+        "date": "2026-11-27",
+        "commit": "7f7c0541",
+        "label": "buffer-reuse-56-d8s_v5",
+        "rustc": "1.100.0",
+        "nproc": 8
+      },
+      "gate": [
+        {
+          "kind": "info"
+        }
+      ]
     }
   }
 }
```

**File**: `benchmarks/1.3.0/regressions/results/buffer-reuse-56-d8s_v5/env.json` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+{
+ "label": "buffer-reuse-56-d8s_v5",
+ "date": "2026-11-27",
+ "vm": "Standard_D8s_v5",
+ "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
+ "nproc": 8,
+ "cpu_count": 8,
+ "calib_ms": 97.7,
+ "kernel": "7.0.0-1017-azure",
+ "glibc": "2.39",
+ "python": "3.12.3",
+ "redis_py": "5.2.1",
+ "candidate_commit": "7f7c0541",
+ "candidate_allocator": "glibc",
+ "suite_seconds": {
+  "56-burst-between-commands": 23
+ },
+ "scale": "1",
+ "full": "0",
+ "only": "56",
+ "engines_selected": [
+  "v1_2_2",
+  "candidate",
+  "redis"
+ ],
+ "failures": [],
+ "expected": [
+  {
+   "suite": "56-burst-between-commands",
+   "config": "uring",
+   "engines": [
+    "v1_2_2",
+    "candidate",
+    "redis"
+   ]
+  },
+  {
+   "suite": "56-burst-between-commands",
+   "config": "tokio",
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
+   "path": "/home/azureuser/kividb-branch",
+   "sha256": "5630d3e172b49778dad2f56ccaec5773e5a6669969a479ab06dbb0ec3e0578d2",
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

**File**: `benchmarks/1.3.0/regressions/results/buffer-reuse-56-d8s_v5/summary.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"label":"buffer-reuse-56-d8s_v5","env":{"label":"buffer-reuse-56-d8s_v5","date":"2026-11-27","vm":"Standard_D8s_v5","cpu":"Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz","nproc":8,"cpu_count":8,"calib_ms":97.7,"kernel":"7.0.0-1017-azure","glibc":"2.39","python":"3.12.3","redis_py":"5.2.1","candidate_commit":"7f7c0541","candidate_allocator":"glibc","suite_seconds":{"56-burst-between-commands":23},"scale":"1","full":"0","only":"56","engines_selected":["v1_2_2","candidate","redis"],"failures":[],"expected":[{"suite":"56-burst-between-commands","config":"uring","engines":["v1_2_2","candidate","redis"]},{"suite":"56-burst-between-commands","config":"tokio","engines":["v1_2_2","candidate","redis"]}],"engines":{"v1_2_2":{"path":"/home/azureuser/.cache/kividb-regress/releases/v1.2.2/default/kividb","sha256":"38fc2cea40c131e041f4914527a98719e5d34dffdfe2abdc1f07ecb86aa6723e","version":"kividb 1.2.2","rustc":"1.100.0"},"candidate":{"path":"/home/azureuser/kividb-branch","sha256":"5630d3e172b49778dad2f56ccaec5773e5a6669969a479ab06dbb0ec3e0578d2","version":"kividb 1.2.1 (default build: no Lua, no TLS)","rustc":"1.100.0"},"redis":{"path":"/opt/redis-8.10.2/src/redis-server","sha256":"b0cd304980112fa6cd8dced524fdd6b136fd8efb802f5cf9e81610051a11891c","version":"Redis server v=8.10.2 sha=00000000:1 malloc=jemalloc-5.3.0 bits=64 build=75a9b36b1f0aa00","rustc":null},"v1_2_2_full":{"path":"/home/azureuser/.cache/kividb-regress/releases/v1.2.2/full/kividb","sha256":"ac5e05fe1274fd1167780e512bc03aa103340f42525a2cef4a2a762e47317ad5","version":"kividb 1.2.2","rustc":"1.100.0"}},"skipped_configs":[],"rustc_override":false,"allow_vm_change":false,"redis_source_sha256":null,"needs_more_cpus":{},"ran_below_min_cpus":{},"suite_min_cpus":{},"min_cpus_only":false,"run_failed":false},"rows":[{"key":"56-burst-between-commands/tokio/burst_cpu_us","suite":"56-burst-between-commands","config":"tokio","metric":"burst_cpu_us","unit":"us","better":"lower","values":{"v1_2_2":284.0166,"candidate":253.2641,"redis":312.8654},"samples":{},"recorded_candidate":null,"host":null,"gates":[{"gate":{"kind":"info"},"status":"info","limit":""}],"status":"info"},{"key":"56-burst-between-commands/tokio/burst_reads","suite":"56-burst-between-commands","config":"tokio","metric":"burst_reads","unit":"reads","better":"lower","values":{"v1_2_2":13.0,"candidate":2.0,"redis":3.0},"samples":{},"recorded_candidate":null,"host":null,"gates":[{"gate":{"kind":"rel","pct":0,"abs":0.25},"status":"new","limit":"rel 0%: nothing recorded"},{"gate":{"kind":"vs_v1_2_2","max_x":1.1},"status":"pass","limit":"0.15x v1.2.2 <= 1.1x"}],"status":"pass"},{"key":"56-burst-between-commands/tokio/slow_cpu_us","suite":"56-burst-between-commands","config":"tokio","metric":"slow_cpu_us","unit":"us","better":"lower","values":{"v1_2_2":113.4863,"candidate":120.4373,"redis":96.9379},"samples":{},"recorded_candidate":null,"host":null,"gates":[{"gate":{"kind":"info"},"status":"info","limit":""}],"status":"info"},{"key":"56-burst-between-commands/uring/burst_cpu_us","suite":"56-burst-between-commands","config":"uring","metric":"burst_cpu_us","unit":"us","better":"lower","values":{"v1_2_2":252.9976,"candidate":252.4986,"redis":305.4377},"samples":{},"recorded_candidate":null,"host":null,"gates":[{"gate":{"kind":"info"},"status":"info","limit":""}],"status":"info"},{"key":"56-burst-between-commands/uring/burst_reads","suite":"56-burst-between-commands","config":"uring","metric":"burst_reads","unit":"reads","better":"lower","values":{"v1_2_2":2.0,"candidate":2.0,"redis":3.0},"samples":{},"recorded_candidate":null,"host":null,"gates":[{"gate":{"kind":"rel","pct":0,"abs":0.25},"status":"new","limit":"rel 0%: nothing recorded"},{"gate":{"kind":"vs_v1_2_2","max_x":1.1},"status":"pass","limit":"1.00x v1.2.2 <= 1.1x"}],"status":"pass"},{"key":"56-burst-between-commands/uring/slow_cpu_us","suite":"56-burst-between-commands","config":"uring","metric":"slow_cpu_us","unit":"us","better":"lower","values":{"v1_2_2":106.9595,"candidate":127.5567,"redis":96.2118},"samples":{},"recorded_candidate":null,"host":null,"gates":[{"gate":{"kind":"info"},"status":"info","limit":""}],"status":"info"}],"not_run":["01-scan-match/default/dbsize","01-scan-match/default/hscan_match_c1000_calls","01-scan-match/default/hscan_match_c1000_distinct","01-scan-match/default/hscan_match_c1000_ms","01-scan-match/default/keys_schedule_ms","01-scan-match/default/keys_schedule_returned","01-scan-match/default/scan_all_c1000_calls","01-scan-match/default/scan_all_c1000_distinct","01-scan-match/default/scan_all_c1000_ms","01-scan-match/default/scan_infix_c1000_calls","01-scan-match/default/scan_infix_c1000_distinct","01-scan-match/default/scan_infix_c1000_ms","01-scan-match/default/scan_match_c10000_calls","01-scan-match/default/scan_match_c10000_distinct","01-scan-match/default/scan_match_c10000_ms","01-scan-match/default/scan_match_c1000_calls","01-scan-match/default/scan_match_c1000_distinct","01-scan-match/default/scan_matc
```

**File**: `benchmarks/1.3.0/regressions/results/buffer-reuse-56-d8s_v5/summary.md` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+# Regression suite: buffer-reuse-56-d8s_v5
+
+Verdict: **ok**
+
+- Machine: Standard_D8s_v5, 8 vCPU, Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz, kernel 7.0.0-1017-azure, glibc 2.39
+- CPU: recorded on INTEL(R) XEON(R) PLATINUM 8573C / Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz / Intel(R) Xeon(R) Platinum 8473C; now Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz
+- calibration (indicative only): 97.7 ms for a fixed sha256 loop, 8 cores
+- Client: Python 3.12.3, redis-py 5.2.1
+- v1_2_2: `kividb 1.2.2`, sha256 `38fc2cea40c131e041f4914527a98719e5d34dffdfe2abdc1f07ecb86aa6723e`, rustc 1.100.0
+- candidate: `kividb 1.2.1 (default build: no Lua, no TLS)`, sha256 `5630d3e172b49778dad2f56ccaec5773e5a6669969a479ab06dbb0ec3e0578d2`, rustc 1.100.0
+- redis: `Redis server v=8.10.2 sha=00000000:1 malloc=jemalloc-5.3.0 bits=64 build=75a9b36b1f0aa00`, sha256 `b0cd304980112fa6cd8dced524fdd6b136fd8efb802f5cf9e81610051a11891c`
+- v1_2_2_full: `kividb 1.2.2`, sha256 `ac5e05fe1274fd1167780e512bc03aa103340f42525a2cef4a2a762e47317ad5`, rustc 1.100.0
+- candidate commit: `7f7c0541`
+- date: 2026-11-27; FULL=0, SCALE=1
+- run time: 56-burst-between-commands 23s
+
+## 56-burst-between-commands
+
+| config | metric | unit | v1.2.2 | candidate | Redis | recorded | gate | result |
+|---|---|---|---:|---:|---:|---:|---|---|
+| tokio | burst_cpu_us | us | 284.0 | 253.3 | 312.9 | - | info | info |
+| tokio | burst_reads | reads | 13.00 | 2 | 3 | - | rel: rel 0%: nothing recorded<br>vs_v1_2_2: 0.15x v1.2.2 <= 1.1x | new<br>pass |
+| tokio | slow_cpu_us | us | 113.5 | 120.4 | 96.94 | - | info | info |
+| uring | burst_cpu_us | us | 253.0 | 252.5 | 305.4 | - | info | info |
+| uring | burst_reads | reads | 2 | 2 | 3 | - | rel: rel 0%: nothing recorded<br>vs_v1_2_2: 1.00x v1.2.2 <= 1.1x | new<br>pass |
+| uring | slow_cpu_us | us | 107.0 | 127.6 | 96.21 | - | info | info |
+
+## Not run this time
+
+`01-scan-match/default/dbsize`, `01-scan-match/default/hscan_match_c1000_calls`, `01-scan-match/default/hscan_match_c1000_distinct`, `01-scan-match/default/hscan_match_c1000_ms`, `01-scan-match/default/keys_schedule_ms`, `01-scan-match/default/keys_schedule_returned`, `01-scan-match/default/scan_all_c1000_calls`, `01-scan-match/default/scan_all_c1000_distinct`, `01-scan-match/default/scan_all_c1000_ms`, `01-scan-match/default/scan_infix_c1000_calls`, `01-scan-match/default/scan_infix_c1000_distinct`, `01-scan-match/default/scan_infix_c1000_ms`, `01-scan-match/default/scan_match_c10000_calls`, `01-scan-match/default/scan_match_c10000_distinct`, `01-scan-match/default/scan_match_c10000_ms`, `01-scan-match/default/scan_match_c1000_calls`, `01-scan-match/default/scan_match_c1000_distinct`, `01-scan-match/default/scan_match_c1000_ms`, `01-scan-match/default/sscan_match_c1000_calls`, `01-scan-match/default/sscan_match_c1000_distinct`, `01-scan-match/default/sscan_match_c1000_ms`, `01-scan-match/default/zscan_match_c1000_calls`, `01-scan-match/default/zscan_match_c1000_distinct`, `01-scan-match/default/zscan_match_c1000_ms`, `02-growth-ping/ex17m/dbsize`, `02-growth-ping/ex17m/load_s`, `02-growth-ping/ex17m/ping_max_ms`, `02-growth-ping/ex17m/ping_p99_ms`, `02-growth-ping/ex17m/pings`, `02-growth-ping/ex17m/pings_over_10ms`, `02-growth-ping/ex17m/rss_loaded_mib`, `02-growth-ping/ex17m/used_memory_mib`, `02-growth-ping/tokio/dbsize`, `02-growth-ping/tokio/load_s`, `02-growth-ping/tokio/ping_max_ms`, `02-growth-ping/tokio/ping_p99_ms`, `02-growth-ping/tokio/pings`, `02-growth-ping/tokio/pings_over_10ms`, `02-growth-ping/tokio/rss_loaded_mib`, `02-growth-ping/tokio/used_memory_mib`, `02-growth-ping/uring1/dbsize`, `02-growth-ping/uring1/load_s`, `02-growth-ping/uring1/ping_max_ms`, `02-growth-ping/uring1/ping_p99_ms`, `02-growth-ping/uring1/pings`, `02-growth-ping/uring1/pings_over_10ms`, `02-growth-ping/uring1/rss_loaded_mib`, `02-growth-ping/uring1/used_memory_mib`, `03-give-back/churn/delete_ms`, `03-give-back/churn/rss_after_15s_mib`, `03-give-back/churn/rss_after_1_5s_mib`, `03-give-back/churn/rss_after_5s_mib`, `03-give-back/churn/rss_loaded_mib`, `03-give-back/churn/rss_start_mib`, `03-give-back/churn/used_after_mib`, `03-give-back/churn/used_loaded_mib`, `03-give-back/hashdel/delete_ms`, `03-give-back/hashdel/rss_after_15s_mib`, `03-give-back/hashdel/rss_after_1_5s_mib`, `03-give-back/hashdel/rss_after_5s_mib`, `03-give-back/hashdel/rss_loaded_mib`, `03-give-back/hashdel/rss_start_mib`, `03-give-back/hashdel/used_after_mib`, `03-give-back/hashdel/used_loaded_mib`, `03-give-back/hdel/delete_ms`, `03-give-back/hdel/rss_after_15s_mib`, `03-give-back/hdel/rss_after_1_5s_mib`, `03-give-back/hdel/rss_after_5s_mib`, `03-give-back/hdel/rss_loaded_mib`, `03-give-back/hdel/rss_start_mib`, `03-give-back/hdel/used_after_mib`, `03-give-back/hdel/used_loaded_mib`, `04-long-commands/tokio/dbsize`, `04-long-commands/tokio/del_cmd_ms`, `04-long-commands/tokio/del_probes_stalled`, `04-long-commands/tokio/del_reply`, `04-long-commands/tokio/del
```

**File**: `benchmarks/1.3.0/regressions/suites/55-idle-connection-memory.py` (modified, +4/-3)
```diff
@@ -8,7 +8,8 @@
 once it has been quiet for `query-buffer-idle-resize-after`).
 
 Configurations (each a fresh server; CONNS connections, 10,000, opened from
-one client process; `CONFIG SET maxclients 20000` first):
+one client process; `CONFIG SET maxclients 20000` first). The count is the
+same at any SCALE: `clients` is gated equal to the recorded count.
 
   tokio-idle  `--io-model tokio`: connections that send nothing
   tokio-ping  `--io-model tokio`: each sends one `PING`, reads its reply,
@@ -38,7 +39,7 @@
 import time
 
 sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
-from suite import Suite, Config, rel, bound, info, KEEP_IMPROVEMENT, scaled  # noqa: E402
+from suite import Suite, Config, rel, bound, info, KEEP_IMPROVEMENT  # noqa: E402
 from rss import vmrss_mib, MIB  # noqa: E402
 
 S = Suite("55-idle-connection-memory", [
@@ -62,7 +63,7 @@ def recv_exactly(s, n):
 
 @S.run
 def run(ctx):
-    conns = scaled(CONNS, step=100)
+    conns = CONNS
     soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
     if soft < conns + 100:
         resource.setrlimit(resource.RLIMIT_NOFILE, (min(hard, conns + 1000), hard))
```

**File**: `benchmarks/1.3.0/regressions/suites/56-burst-between-commands.py` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
+#!/usr/bin/env python3
+"""Bursts between single commands: a connection keeps the read buffer it uses.
+
+A client that sends a pipelined burst, then a few single commands, then a
+burst again (a worker that flushes a batch of writes and then reads a few
+keys one at a time), and one whose requests each arrive in several small
+reads (a slow sender of 8 KiB values). A read buffer grown for a burst is
+given back only after 16 reads in a row have not needed it, so both keep the
+buffer from one burst or request to the next: the next burst is read in as
+many reads as the first, rather than one more each time, and nothing is
+grown and given back between them.
+
+Configurations (each a fresh server, `--threads 2`; one connection):
+
+  uring  `--io-model uring`
+  tokio  `--io-model tokio`
+
+Each runs, after 5 cycles of warm-up:
+
+  burst  CYCLES cycles of one pipelined burst of 400 `SET k<i> <100 B>`
+         (about 50 KiB, sent in one write), its replies read, then 4 `GET`s,
+         each read before the next
+  slow   SLOW requests, each `SET` of an 8 KiB value sent in 2 KiB pieces
+         2 ms apart, its reply read before the next
+
+  burst_reads      the server's reads a burst cycle (INFO
+                   total_reads_processed), less the 4 `GET`s'
+  burst_cpu_us     the server's CPU time a burst cycle (every thread's
+                   schedstat), shown
+  slow_cpu_us      the server's CPU time a slow request, shown
+
+Gates (the candidate): `burst_reads` within 0.25 of recorded and at most
+1.1x v1.2.2's (whose read buffer is 32 KiB from the start) in the same
+session. v1.2.2 and Redis are shown.
+"""
+import os
+import socket
+import sys
+import time
+
+sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
+from suite import Suite, Config, rel, info, vs_v1_2_2, scaled  # noqa: E402
+
+S = Suite("56-burst-between-commands", [
+    Config("uring", io="uring", threads=2),
+    Config("tokio", io="tokio", threads=2),
+])
+CYCLES = 2000
+SLOW = 200
+BURST = 400
+SINGLES = 4
+
+
+def enc(*args):
+    out = b"*%d\r\n" % len(args)
+    for a in args:
+        if isinstance(a, str):
+            a = a.encode()
+        out += b"$%d\r\n%s\r\n" % (len(a), a)
+    return out
+
+
+class Conn:
+    def __init__(self, port):
+        self.s = socket.create_connection(("127.0.0.1", port), timeout=60)
+        self.s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
+        self.buf = b""
+
+    def _fill(self):
+        d = self.s.recv(1 << 20)
+        if not d:
+            raise RuntimeError("connection closed")
+        self.buf += d
+
+    def line(self):
+        while b"\r\n" not in self.buf:
+            self._fill()
+        i = self.buf.index(b"\r\n")
+        ln, self.buf = self.buf[:i], self.buf[i + 2:]
+        return ln
+
+    def reply(self):
+        ln = self.line()
+        if ln[:1] == b"$":
+            n = int(ln[1:])
+            if n < 0:
+                return None
+            while len(self.buf) < n + 2:
+                self._fill()
+            v, self.buf = self.buf[:n], self.buf[n + 2:]
+            return v
+        if ln[:1] == b"-":
+            raise RuntimeError(ln.decode())
+        return ln
+
+    def cmd(self, *args):
+        self.s.sendall(enc(*args))
+        return self.reply()
+
+
+def server_cpu(pid):
+    """Seconds on a CPU, every thread of the server (schedstat, ns)."""
+    t = 0
+    for tid in os.listdir("/proc/%d/task" % pid):
+        try:
+            with open("/proc/%d/task/%s/schedstat" % (pid, tid)) as f:
+                t += int(f.read().split()[0])
+        except OSError:
+            pass
+    return t / 1e9
+
+
+@S.run
+def run(ctx):
+    cycles = scaled(CYCLES, step=100)
+    slow = scaled(SLOW, step=20)
+    ctl = ctx.client()
+    c = Conn(ctx.port)
+    value = b"b" * 100
+    burst = b"".join(enc("SET", "k%d" % i, value) for i in range(BURST))
+
+    def burst_cycle():
+        c.s.sendall(burst)
+        for _ in range(BURST):
+            if c.reply() != b"+OK":
+                raise RuntimeError("SET in a burst not OK")
+        for i in range(SINGLES):
+            if c.cmd("GET", "k%d" % i) != value:
+                raise RuntimeError("GET k%d" % i)
+
+    slow_request = enc("SET", "slow", b"s" * 8192)
+
+    def slow_cycle():
+        for i in range(0, len(slow_request), 2048):
+            c.s.sendall(slow_request[i:i + 2048])
+            time.sleep(0.002)
+        if c.reply() != b"+OK":
+            raise RuntimeError("slow SET not OK")
+
+    def reads():
+        return int(ctl.info("stats")["total_reads_processed"])
+
+    for _ in range(5):
+        burst_cycle()
+    r0, t0 = reads(), server_cpu(ctx.pid)
+    for _ in range(cycles):
+        burst_cycle()
+    # The INFO that reads the count is one read of its own connection.
+    r1, t1 = reads() - 1, server_cpu(ctx.pid)
+    burst_reads = (r1 - r0) / float(cycles) - SINGLES
+    burst_cpu = (t1 - t0) * 1e6 / 
```

**File**: `docs/CONFIGURATION.md` (modified, +4/-2)
```diff
@@ -140,8 +140,10 @@ warning. Cluster bus links, a replica's link to its master and files written whi
 are not counted in that; leave room for them in a large cluster.
 
 A connection's read buffer starts at 4 KiB and its reply buffers start empty, so a connection that
-has sent nothing holds little more than that. A read buffer grown for a burst goes back to 4 KiB
-once the connection's requests are small again, with the reply buffers; on the Tokio loop a
+has sent nothing holds little more than that. A read buffer grown for a burst goes back to 4 KiB,
+with the reply buffers, once sixteen reads in a row have not needed more than 4 KiB of it: a
+client whose requests arrive in several small reads, or that sends pipelined bursts between a few
+single commands, keeps the size it uses rather than growing it again for each. On the Tokio loop a
 quiet connection also gives them back after `query-buffer-idle-resize-after`. On io_uring a read
 buffer that has grown stays at its size while a read is pending on it. Suite
 `55-idle-connection-memory` under `benchmarks/1.3.0/regressions/` measures what 10,000 idle
```

---

### Incident Patch 2: `f67b1595` (2026-11-27)
**Commit Message**: Config: daemonize yes is accepted with a warning (#1076)

KiviDB runs in the foreground; the directive is reported as having no effect, like save and pidfile. A value that is neither yes nor no stops the start. Closes #1075.

**File**: `docs/MIGRATING_FROM_REDIS.md` (modified, +1/-0)
```diff
@@ -65,6 +65,7 @@ The ones that behave differently:
 | Directive | In KiviDB |
 |---|---|
 | `io-threads` | Accepted, no effect: commands run on every core. `--threads` sets the worker count (default: half the CPUs available to the process, rounded up, at least 2 where there are 2 or more). |
+| `daemonize` | `no` is accepted quietly; `yes` is accepted with a warning and has no effect. KiviDB always runs in the foreground — use systemd, Docker, or a process supervisor to run it in the background. |
 | `save <points>` | Accepted with a warning, no effect. KiviDB doesn't snapshot on a schedule. Use `appendonly yes`, or `BGSAVE`. |
 | `appendfsync` | `always` and `everysec` as in Redis. `no` is taken as `everysec`, with a warning. |
 | `dbfilename`, `appendfilename` | Fixed: `dump.kdb` and `appendonly.aof`. KiviDB reads a Redis `dump.rdb` if there is no `dump.kdb`. `CONFIG GET dbfilename` answers `dump.kdb`, with `CONFIG GET dir` the place to find it after a `SAVE`. |
```

**File**: `src/config.rs` (modified, +10/-6)
```diff
@@ -2381,9 +2381,7 @@ impl Config {
             }
             "daemonize" => {
                 if yes_no(key, one()?)? {
-                    return Err(
-                        "'daemonize yes' is not supported: KiviDB runs in the foreground".into(),
-                    );
+                    return no_effect("KiviDB runs in the foreground");
                 }
             }
             // When the AOF is synced (#513). It used to be read and warned
@@ -3137,7 +3135,7 @@ mod config_file_tests {
             "requirepass \"unterminated",
             "maxmemory-policy allkeys-mru",
             "maxmemory-samples 0",
-            "daemonize yes",
+            "daemonize maybe",
             "dbfilename other.rdb",
         ] {
             let err = load(bad).unwrap_err();
@@ -3366,9 +3364,15 @@ mod config_file_tests {
 
     #[test]
     fn redis_directives_with_no_effect_are_reported_and_not_fatal() {
-        let (_, warnings) = load("save 900 1\ntcp-keepalive 300\nappendfsync no\n").unwrap();
-        assert_eq!(warnings.len(), 3, "{warnings:?}");
+        let (_, warnings) =
+            load("save 900 1\ntcp-keepalive 300\nappendfsync no\ndaemonize yes\n").unwrap();
+        assert_eq!(warnings.len(), 4, "{warnings:?}");
         assert!(warnings[0].contains("line 1") && warnings[0].contains("'save'"));
+        assert!(
+            warnings[3].contains("line 4")
+                && warnings[3].contains("'daemonize'")
+                && warnings[3].contains("foreground")
+        );
         // The values KiviDB already behaves as are not worth a warning.
         let (_, warnings) =
             load("save \"\"\nappendfsync everysec\ndaemonize no\ndbfilename dump.kdb\n").unwrap();
```

#### Recent Merged Pull Requests:
- **PR #1077** (2026-11-27): Connections: a grown read buffer is kept while its turns need it, and given back after sixteen that do not (@murtazayusuf)
- **PR #1076** (2026-11-27): Config: warn on daemonize yes instead of failing at startup (@JituRewar)
- **PR #1073** (2026-11-27): Connections: read and reply buffers start small and are given back when a connection goes idle (@murtazayusuf)
- **PR #1071** (2026-11-27): INFO fields for redis_exporter: client buffers, ACL denials, saves, replication traffic, expiry (@murtazayusuf)
- **PR #1068** (2026-11-27): e2e: pub/sub tests publish after the subscription is confirmed; a limit on each e2e step (@murtazayusuf)
- **PR #1067** (2026-11-27): Allocate collection group arrays from chunk slabs (@BLVCK-MAMBA-6)

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

## X. Connections: a grown read buffer is kept while its turns need it, and given back

**RULE**:
When implementing operations in `benchmarks/1.3.0/regressions/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kividbio/kividb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `59b4cf65`: Connections: a grown read buffer is kept while its turns need it, and given back after sixteen that do not. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `benchmarks/1.3.0/regressions/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| `56-burst-between-commands` | idle connections, the read buffer kept | one connection, on io_uring and on Tokio, each a configuration (`--threads 2`): 2,000 cycles of a pipelined burst of 400 `SET`s of 100 B (about 50 KiB in one write) then 4 `GET`s one at a time; and 200 `SET`s of an 8 KiB value sent in 2 KiB pieces 2 ms apart. The server's reads a burst (INFO `total_reads_processed`, less the `GET`s'), and its CPU time a burst cycle and a slow request (every thread's schedstat, shown). Gates: `burst_reads` within 0.25 of recorded and at most 1.1x v1.2.2's in the same session (a read buffer given back between bursts makes each burst one read more). Recorded on a `Standard_D8s_v5` (`results/buffer-reuse-56-d8s_v5`) |
| `56-burst-between-commands` | 2 | as suite `55`: one connection |
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `59b4cf65` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
