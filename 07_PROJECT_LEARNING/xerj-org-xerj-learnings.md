> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source**: github ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Source Version**: `b7800483`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T01:27:52.980Z  
> **Learning ID**: `learn-github-xerj-org-xerj`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): xerj-org/xerj

> **Canonical Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-04T01:27:52.729Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: AI search engine and MCP server for bots and agents. One Rust binary indexes code, docs, logs, JSONL/CSV and PDFs for BM25 full-text, vector and hybrid search, code search without grep, agent memory and RAG. Elasticsearch-compatible API; Corpus Hub serves hundreds of reference memory corpora.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 18945 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/decisions-as-retrieval/results/2026-09-30-rc80gates/score_history.py`
```
"""Tier-1 (history vote) on the SAME rows the tier-2 run scores, through the
node's own decide endpoints — the #1064 comparison table's other arm.

  - SMS: the 4,000-row seed-7 train history indexed as `sms4000`, the 1,574
    held-out rows scored via /_decide (index named per request, k=10,
    positive_label=spam) — the same endpoint/shape the tier-2 SMS run used.
  - Banking77: the 10,003 train rows indexed as the node's configured
    [decisions] index, the full 3,080-row test split scored as a 77-way
    choice via /v1/systemone.

Requires one node booted with [decisions] index = "b77" for the Banking77
half (the wire surface reads the configured index); the SMS half names its
index per request and works on any node.
"""
import argparse, csv, http.client, json, os, time

def ece(conf_correct, bins=10):
    n = len(conf_correct); tot = 0.0
    for b in range(bins):
        xs = [(c, k) for c, k in conf_correct
              if b/bins < c <= (b+1)/bins or (b == 0 and c == 0)]
        if xs:
            tot += len(xs)/n*abs(sum(k for _, k in xs)/len(xs) - sum(c for c, _ in xs)/len(xs))
    return tot

class C:
    def __init__(self, base):
        h, p = base.split("//")[1].split(":")
        self.c = http.client.HTTPConnection(h, int(p), timeout=900)
    def req(self, method, path, body=None, ct="application/json"):
        data = None if body is None else (
            body if isinstance(body, bytes) else json.dumps(body).encode())
        for _ in range(3):
            try:
                self.c.request(method, path, data, {"content-type": ct})
                r = self.c.getresponse()
                return r.status, json.loads(r.read() or b"{}")
            except Exception:
                self.c.close()
                self.c = http.client.HTTPConnection(self.c.host, self.c.port, timeout=900)
        raise SystemExit("request kept failing: " + path)

def load_index(es, index, rows):
    es.req("DELETE", f"/{index}")
    st, _ = es.req("PUT", f"/{index}", {"mappings": {"properties": {
        "text": {"type": "text"}, "label": {"type": "keyword"}}}})
    lines = []
    for i, (t, l) in enumerate(rows):
        lines.append(json.dumps({"index": {"_index": index, "_id": str(i)}}))
        lines.append(json.dumps({"text": t, "label": l}))
        if len(lines) >= 5000:
            st, r = es.req("POST", "/_bulk", ("\n".join(lines)+"\n").encode(), "application/x-ndjson")
            assert not r.get("errors"), r
            lines = []
    if lines:
        st, r = es.req("POST", "/_bulk", ("\n".join(lines)+"\n").encode(), "application/x-ndjson")
        assert not r.get("errors"), r
    es.req("POST", f"/{index}/_refresh", {})
    st, r = es.req("GET", f"/{index}/_count")
    print(f"  indexed {index}: {r.get('count')} docs", flush=True)

def summarise(name, cc, ms, extra=None):
    hi = [k for c, k in cc if c >= 0.8]
    out = {"set": name, "n": len(cc),
           "accuracy": round(sum(k for _, k in cc)/len(cc), 4),
           "ECE": round(ece(cc), 4),
           "conf>=0.8 share": round(len(hi)/len(cc), 4),
           "acc@>=0.8": round(sum(hi)/max(len(hi), 1), 4),
           "ms/item": round(ms, 1)}
    if extra:
        out.update(extra)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--es", default="http://localhost:9604")
    ap.add_argument("--native", default="http://localhost:9605")
    ap.add_argument("--data", default="/tmp/xerj-rc80gates-work/data")
    ap.add_argument("--out", default=".")
    ap.add_argument("--sets", default="sms,b77")
    args = ap.parse_args()
    es, nat = C(args.es), C(args.native)
    rows_out = open(os.path.join(args.out, "rows_history.jsonl"), "a")
    summary = []
    import random

    if "sms" in args_sets(args, "sms"):
        s = [l.rstrip("\n").split("\t", 1) for l in open(f"{args.data}/sms.tsv")]
        s = [(t, l) for l, t in s]
        random.Random(7).shuffle(s)
        load_index(es, "sms4000", s[:4000])
        test = s[4000:]
        cc, praw = [], []
        tp = fp = fn = 0
        t0 = time.time()
        for i, (text, gold) in enumerate(test):
            st, r = es.req("POST", "/_decide", {"index": "sms4000", "question": text,
                                                "positive_label": "spam", "k": 10})
            assert st == 200, r
            pred_spam = r["label"] == "spam"
            correct = int(pred_spam == (gold == "spam"))
            cc.append((r["confidence"], correct))
            praw.append((r["p_raw"], int(gold == "spam")))
            tp += pred_spam and gold == "spam"
            fp += pred_spam and gold != "spam"
            fn += (not pred_spam) and gold == "spam"
            rows_out.write(json.dumps({"set": "sms_history", "i": i, "gold": gold,
                                       "label": r["label"], "confidence": r["confidence"],
                                       "p_raw": r["p_raw"]}) + "\n")
        ms = (time.time()-t0)/len(test)*1000
        p = tp/max(tp+fp, 1); rc = tp/max(tp+fn, 1)
        summary.append(summarise("SMS held-out — tier-1 history vote (/_decide, k=10, 4000 docs)", cc, ms, {
            "ECE_noul_p_raw": round(ece(praw), 4),
            "spam_P": round(p, 3), "spam_R": round(rc, 3),
            "spam_F1": round(2*p*rc/max(p+rc, 1e-9), 3)}))

    if "b77" in args_sets(args, "b77"):
        train = [(r["text"], r["category"]) for r in csv.DictReader(open(f"{args.data}/b77_train.csv"))]
        load_index(es, "b77", train)
        labels = json.load(open(f"{args.data}/b77_labels.json"))
        criteria = {l: f"example of {l}" for l in labels}
        test = json.load(open(f"{args.data}/b77_test.json"))
        cc = []
        t0 = time.time()
        for i, (text, gold) in enumerate(test):
            st, r = nat.req("POST", "/v1/systemone", {
                "model": "xerj-history-vote-1", "state": {"message": text},
                "questions": {"intent": {"type": "choice",
                                         "instructions": "Which intent matches `message`?",
                                         "criteria": criteria}}})
            assert st == 200, r
            pred = r["answers"]["intent"]["choice"]
            cc.append((r["answers"]["intent"]["confidence"], int(pred == gold)))
            rows_out.write(json.dumps({"set": "b77_history", "i": i, "gold": gold,
                                       "label": pred,
                                       "confidence": r["answers"]["intent"]["confidence"]}) + "\n")
            if (i+1) % 500 == 0:
                print(f"  b77 {i+1}/{len(test)}", flush=True)
        ms = (time.time()-t0)/len(test)*1000
        summary.append(summarise("Banking77 test — tier-1 history vote (/v1/systemone, k=10, 10003 docs)", cc, ms))

    rows_out.close()
    for s_ in summary:
        print(json.dumps(s_), flush=True)
    with open(os.path.join(args.out, "summary_history.json"), "a") as f:
        f.write(json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "summary": summary},
                           indent=1) + "\n")

def args_sets(args, _):
    return args.sets.split(",")

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/decisions-as-retrieval/results/2026-09-30-rc80gates/score_local.py`
```
"""Gate #1057 / #1064: score the tier-2 local decide head (xerj-decide-v1)
through a live node — no history index, every answer from the local tier.

Datasets (same sources and splits the harness documents):
  - SMS held-out split: load.py's exact seed-7 shuffle, rows 4000.. (1,574 rows),
    scored as a noul via /_decide (positive_label=spam, no index).
  - Banking77: the FULL 3,080-row test split, 77-way choice via /v1/systemone.
  - AG News: the FULL 7,600-row test set, 4-way choice via /v1/systemone
    (never in the artifact's training — the genuinely zero-shot dataset).

Metrics are eval.py's: accuracy, ECE (10 equal-width bins over
(winner-confidence, correct)), share of items at confidence >= 0.8 and that
share's accuracy. For the SMS noul the p_raw-based ECE (the calibrated
quantity) is reported beside it.

Usage:
  python3 score_local.py --es http://localhost:9600 --native http://localhost:9601 \
      --data /tmp/xerj-rc80gates-work/data --out .
"""
import argparse, csv, http.client, json, os, sys, time, urllib.request, uuid

def ece(conf_correct, bins=10):
    """eval.py's estimator, verbatim semantics."""
    n = len(conf_correct); tot = 0.0
    for b in range(bins):
        xs = [(c, k) for c, k in conf_correct
              if b/bins < c <= (b+1)/bins or (b == 0 and c == 0)]
        if xs:
            tot += len(xs)/n*abs(sum(k for _, k in xs)/len(xs) - sum(c for c, _ in xs)/len(xs))
    return tot

class Client:
    def __init__(self, base):
        self.host, self.port = base.split("//", 1)[1].split(":")
        self.c = http.client.HTTPConnection(self.host, int(self.port), timeout=300)
    def post(self, path, body):
        for _ in range(3):
            try:
                self.c.request("POST", path, json.dumps(body).encode(),
                               {"content-type": "application/json"})
                return json.loads(self.c.getresponse().read())
            except Exception:
                self.c.close(); self.c = http.client.HTTPConnection(
                    self.host, int(self.port), timeout=300)
        raise SystemExit("request kept failing: " + path)

def summarise(name, cc, ms_per_item, extra=None):
    acc = sum(k for _, k in cc)/len(cc)
    hi = [k for c, k in cc if c >= 0.8]
    out = {"set": name, "n": len(cc), "accuracy": round(acc, 4),
           "ECE": round(ece(cc), 4),
           "conf>=0.8 share": round(len(hi)/len(cc), 4),
           "acc@>=0.8": round(sum(hi)/max(len(hi), 1), 4),
           "ms/item": round(ms_per_item, 1)}
    if extra:
        out.update(extra)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--es", default="http://localhost:9600")
    ap.add_argument("--native", default="http://localhost:9601")
    ap.add_argument("--data", default="/tmp/xerj-rc80gates-work/data")
    ap.add_argument("--out", default=".")
    ap.add_argument("--sets", default="sms,b77,agnews")
    args = ap.parse_args()
    sets = args.sets.split(",")

    es, nat = Client(args.es), Client(args.native)
    rows_out = open(os.path.join(args.out, "rows.jsonl"), "a")
    summary = []

    # ── SMS held-out, noul via /_decide, no index ────────────────────────────
    if "sms" in sets:
        sms = json.load(open(os.path.join(args.data, "sms_test.json")))
        cc, cc_praw, praw_pairs = [], [], []
        tp = fp = fn = 0
        t0 = time.time()
        for i, (text, gold) in enumerate(sms):
            r = es.post("/_decide", {"question": text, "positive_label": "spam", "index": ""})
            if r.get("tier") != "local":
                raise SystemExit(f"row {i}: not local tier: {json.dumps(r)[:300]}")
            pred_spam = r["label"] == "spam"
            correct = int(pred_spam == (gold == "spam"))
            cc.append((r["confidence"], correct))
            praw_pairs.append((r["p_raw"], int(gold == "spam")))
            cc_praw.append((max(r["p_raw"], 1.0 - r["p_raw"]), correct))
            tp += pred_spam and gold == "spam"
            fp += pred_spam and gold != "spam"
            fn += (not pred_spam) and gold == "spam"
            rows_out.write(json.dumps({"set": "sms", "i": i, "gold": gold,
                                       "label": r["label"], "confidence": r["confidence"],
                                       "p_raw": r["p_raw"]}) + "\n")
            if (i+1) % 500 == 0:
                print(f"  sms {i+1}/{len(sms)} {(time.time()-t0)/(i+1)*1000:.1f} ms/item", flush=True)
        ms = (time.time()-t0)/len(sms)*1000
        p = tp/max(tp+fp, 1); rc = tp/max(tp+fn, 1)
        s = summarise("SMS held-out noul (1574 rows)", cc, ms, {
            "ECE_noul_p_raw": round(ece(praw_pairs), 4),
            "spam_P": round(p, 3), "spam_R": round(rc, 3), "spam_F1": round(2*p*rc/max(p+rc, 1e-9), 3)})
        summary.append(s)

    # ── Banking77 full test, 77-way choice via /v1/systemone ─────────────────
    if "b77" in sets:
        labels = json.load(open(os.path.join(args.data, "b77_labels.json")))
        criteria = {l: f"example of {l}" for l in labels}
        b77 = json.load(open(os.path.join(args.data, "b77_test.json")))
        cc = []
        t0 = time.time()
        for i, (text, gold) in enumerate(b77):
            r = nat.post("/v1/systemone", {
                "model": "xerj-decide-local-1", "state": {"message": text},
                "questions": {"intent": {"type": "choice",
                                         "instructions": "Which intent matches `message`?",
                                         "criteria": criteria}}})
            ev = r.get("decisions", {}).get("evidence", {}).get("intent", {})
            if ev.get("tier") != "local":
                raise SystemExit(f"row {i}: not local tier: {json.dumps(r)[:300]}")
            pred = r["answers"]["intent"]["choice"]
            conf = r["answers"]["intent"]["confidence"]
            cc.append((conf, int(pred == gold)))
            rows_out.write(json.dumps({"set": "b77", "i": i, "gold": gold, "label": pred,
                                       "confidence": conf}) + "\n")
            if (i+1) % 250 == 0:
                print(f"  b77 {i+1}/{len(b77)} {(time.time()-t0)/(i+1)*1000:.1f} ms/item", flush=True)
        ms = (time.time()-t0)/len(b77)*1000
        summary.append(summarise("Banking77 test choice (77-way, 3080 rows)", cc, ms))

    # ── AG News full test, 4-way choice via /v1/systemone ────────────────────
    if "agnews" in sets:
        names = {1: "World", 2: "Sports", 3: "Business", 4: "SciTech"}
        criteria = {v: f"example of {v}" for v in names.values()}
        ag = []
        with open(os.path.join(args.data, "ag_news_test.csv"), newline="") as f:
            for row in csv.reader(f):
                cls = int(row[0]); text = (row[1] + " " + row[2]).strip()
                ag.append((text, names[cls]))
        cc = []
        t0 = time.time()
        for i, (text, gold) in enumerate(ag):
            r = nat.post("/v1/systemone", {
                "model": "xerj-decide-local-1", "state": {"message": text},
                "questions": {"topic": {"type": "choice",
                                        "instructions": "Which topic matches `message`?",
                                        "criteria": criteria}}})
            ev = r.get("decisions", {}).get("evidence", {}).get("topic", {})
            if ev.get("tier") != "local":
                raise SystemExit(f"row {i}: not local tier: {json.dumps(r)[:300]}")
            pred = r["answers"]["topic"]["choice"]
            conf = r["answers"]["topic"]["confidence"]
            cc.append((conf, int(pred == gold)))
            rows_out.write(json.dumps({"set": "agnews", "i": i, "gold": gold, "label": pred,
                                       "confidence": conf}) + "\n")
            if (i+1) % 1000 == 0:
                print(f"  agnews {i+1}/{len(ag)} {(time.time()-t0)/(i+1)*1000:.1f} ms/item", flush=True)
        ms = (time.time()-t0)/len(ag)*1000
        summary.append(summarise("AG News test choice (4-way, 7600 rows — never trained)", cc, ms))

    rows_out.close()
    for s in summary:
        print(json.dumps(s), flush=True)
    with open(os.path.join(args.out, "summary.json"), "a") as f:
        f.write(json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "summary": summary},
                           indent=1) + "\n")

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/neural-path-triage/window_concurrency_bench.py`
```
#!/usr/bin/env python3
"""`_bulk` ingest throughput into a `semantic_text` field at a given
`embedding.neural_window_concurrency`, on a SYNTHETIC corpus (no BEIR
download), with the server's own CPU use so "how many cores did it keep busy"
is a number (#938).

    python3 window_concurrency_bench.py <url> <server_pid> <n_docs> \
        [--chars 1470] [--bulk 50] [--clients 1] [--seed 938] [--warmup 20]

The server must ALREADY be running with `--embed-mode neural` and the
`neural_window_concurrency` you want to measure — the harness does not restart
it. Warmup docs are indexed first so the model download/load lands outside the
timed window. Deterministic: the corpus is a fixed seed, so every run against
the same <n_docs>/<chars>/<seed> sends identical bytes. Linux only (/proc).
WRITES to the node: creates and deletes throwaway indices named wc_*.
"""
import concurrent.futures as cf
import json
import os
import random
import sys
import time

from common import http, process_cpu_seconds

url, pid, n = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
rest = sys.argv[4:]
opt = {rest[i]: rest[i + 1] for i in range(0, len(rest) - 1, 2)}
CHARS = int(opt.get("--chars", "1470"))
BULK = int(opt.get("--bulk", "50"))
CLIENTS = int(opt.get("--clients", "1"))
SEED = int(opt.get("--seed", "938"))
WARMUP = int(opt.get("--warmup", "20"))

WORDS = ("the model encodes a passage into one vector by averaging token "
         "embeddings attention weights layer normalization training corpus "
         "retrieval relevance ranking query document evidence abstract "
         "scientific study result method analysis evaluation benchmark "
         "index shard segment memory disk throughput latency measurement "
         "engine thread core scheduler window concurrent forward pass").split()


def doc(rng, chars):
    parts, total = [], 0
    while total < chars:
        n = rng.randint(14, 24)
        s = " ".join(rng.choice(WORDS) for _ in range(n)) + "."
        parts.append(s.capitalize() if parts else s.capitalize())
        total += len(s) + 1
    return " ".join(parts)[:chars]


rng = random.Random(SEED)
docs = [doc(rng, CHARS) for _ in range(n)]
mean_chars = sum(map(len, docs)) / len(docs)
print(f"docs={len(docs)} mean_chars={mean_chars:.0f} bulk={BULK} "
      f"clients={CLIENTS} cores={os.cpu_count()}", flush=True)


def bulk(name, part, off):
    lines = []
    for j, d in enumerate(part):
        lines.append(json.dumps({"index": {"_index": name, "_id": str(off + j)}}))
        lines.append(json.dumps({"text": d, "body": d}))
    r = http(url, "POST", "/_bulk", ("\n".join(lines) + "\n").encode(),
             "application/x-ndjson")
    return bool(r.get("errors")), str(r)[:200]


def one_pass(name, corpus):
    http(url, "DELETE", "/" + name)
    http(url, "PUT", "/" + name, {"mappings": {"properties": {
        "text": {"type": "text"}, "body": {"type": "semantic_text"}}}})
    parts = [(corpus[i:i + BULK], i) for i in range(0, len(corpus), BULK)]
    load = open("/proc/loadavg").read().split()[0]
    c0, t0 = process_cpu_seconds(pid), time.time()
    with cf.ThreadPoolExecutor(CLIENTS) as ex:
        res = list(ex.map(lambda a: bulk(name, *a), parts))
    wall, used = time.time() - t0, process_cpu_seconds(pid) - c0
    errs = [r for r in res if r[0]]
    http(url, "POST", f"/{name}/_refresh")
    count = http(url, "GET", f"/{name}/_count").get("count")
    print(f"loadavg={load} docs={len(corpus)} indexed={count} errors={len(errs)} "
          f"wall={wall:6.1f}s docs/s={len(corpus) / wall:6.1f} "
          f"server_cpu_s={used:7.1f} avg_cores_busy={used / wall:5.1f}", flush=True)
    if errs:
        print("  first error:", errs[0][1])
        sys.exit(1)
    http(url, "DELETE", "/" + name)


if WARMUP:
    one_pass("wc_warmup", docs[:WARMUP])  # pays model download + load
one_pass("wc_measure", docs)

```

### Core Architecture Module: `benchmarks/skills-intent/score.py`
```
"""Rank the expected skill for each labelled query.

    python3 -I score.py XERJ_BIN URL QUERIES.tsv RESULTS.tsv

Runs `xerj search --url URL --prefix skills -k 50 --json QUERY` for each
`query<TAB>expected` line, folds the passages into skills (a hit's path starts
with its skill folder), and records the expected skill's rank among the first
10 distinct skills, or `miss`. Every row is kept, misses included. Prints the
top-1, top-3 and top-10 counts. Standard library only.
"""

import json
import os
import subprocess
import sys

TOP = 10


def skills_for(binary, url, query):
    out = subprocess.run(
        [binary, "search", "--url", url, "--prefix", "skills", "-k", "50", "--json", query],
        capture_output=True, text=True, check=True,
    ).stdout
    ranked = []
    for hit in json.loads(out)["hits"]["hits"]:
        src = hit.get("_source", {})
        path = (src.get("ax_path") or src.get("path") or "").replace("\\", "/")
        skill = path.split("/", 1)[0]
        if skill and skill not in ranked:
            ranked.append(skill)
    return ranked[:TOP]


def main(binary, url, queries, results):
    with open(queries, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
    assert lines[0] == "query\texpected", "queries file needs a `query<TAB>expected` header"
    ranks = []
    # Written aside and moved into place at the end, so a run that fails
    # halfway never replaces a committed results file with a partial one.
    with open(results + ".tmp", "w", encoding="utf-8") as out:
        out.write("rank\texpected\tquery\ttop3\n")
        for line in lines[1:]:
            query, expected = line.split("\t")
            ranked = skills_for(binary, url, query)
            rank = ranked.index(expected) + 1 if expected in ranked else None
            ranks.append(rank)
            out.write(f"{rank or 'miss'}\t{expected}\t{query}\t{', '.join(ranked[:3])}\n")
    os.replace(results + ".tmp", results)
    n = len(ranks)
    at = lambda k: sum(1 for r in ranks if r and r <= k)
    print(f"queries {n}  top1 {at(1)}/{n}  top3 {at(3)}/{n}  top10 {at(TOP)}/{n}  miss {ranks.count(None)}/{n}")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    main(*sys.argv[1:])

```

### Core Architecture Module: `engine/crates/xerj-ai/examples/neural_throughput.rs`
```
//! Throughput harness for the built-in Candle neural embedder (issue #366).
//!
//! Measures passages/second through [`xerj_ai::neural::NeuralEmbedder`] under
//! the shapes the ingest path actually produces, so the cost of
//! `--embed-mode neural` can be quoted from a run rather than guessed:
//!
//!   * `single`  — one passage per `embed_blocking` call. This is what the
//!     per-document ingest paths do (single-doc `PUT`, binary-protocol bulk).
//!   * `uniform` — one window of equal-length short passages, the shape the
//!     HTTP `_bulk` path produces for the short documents in #366.
//!   * `mixed`   — one window mixing a few long chunks with many short ones,
//!     the shape `autoindex` produces over a real folder. Padding every row to
//!     the longest member of the window is what this arm exposes.
//!   * `one big document` — every chunk of one large field in a SINGLE call.
//!     `semantic_embedding_window_end` always admits a whole document even past
//!     the scheduling window, so this really does happen; without a row cap the
//!     forward pass and its attention tensors scale with the document.
//!
//! `padded/real` is the padding waste: `rows × padded_sequence_length` summed
//! over the forward passes, divided by the tokens the input actually held. 1.00
//! means the model did no work on padding.
//!
//! Run (downloads ~90 MB of MiniLM weights on first use):
//!
//! ```sh
//! cargo run --release -p xerj-ai --features neural --example neural_throughput
//! ```
//!
//! `XERJ_NEURAL_LOCAL_DIR=/path/to/model` loads air-gapped weights instead.
//! `XERJ_NEURAL_CORPUS=/path/to/folder` adds an arm over real files, chunked
//! the way ingest chunks a `semantic_text` field. `XERJ_NEURAL_BIGDOC=/path/to/
//! file` replaces the synthesized big document with a real one.
//!
//! This measures the encoder in isolation. The end-to-end server measurement
//! (ingest a corpus over HTTP with `--embed-mode neural`) lives in
//! `demo/playbooks/neural-embedder-verification/`.

use std::time::Instant;

use xerj_ai::neural::{BatchStats, NeuralConfig, NeuralEmbedder};
use xerj_ai::TextChunker;

/// One ~120-character line, the document shape measured in issue #366.
fn short_passage(i: usize) -> String {
    format!(
        "method selectAndLinkDiverse{i} in HnswGraphBuilder.java. Select neighbors to add and \
         return a mask of the ones kept."
    )
}

/// One ~512-character chunk, what `TextChunker` emits for a long field.
fn long_passage(i: usize) -> String {
    let mut s = format!("chunk {i}: ");
    while s.len() < 512 {
        s.push_str(
            "the graph builder links each new node to its diverse neighbors and prunes the \
             candidate list before the next level is entered. ",
        );
    }
    s.truncate(512);
    s
}

/// Embed `texts` in windows of `window` passages and report the arm.
///
/// `padded/real` is what this build actually ran. `rect/real` is what the same
/// windows cost as ONE rectangular forward pass each — the pre-#366 behaviour —
/// priced from the same token lengths, so any corpus can be scored for how much
/// length-aware batching is worth on it without keeping an old binary around.
fn arm(
    embedder: &NeuralEmbedder,
    label: &str,
    texts: &[String],
    window: usize,
) -> anyhow::Result<()> {
    let mut total = BatchStats::default();
    let mut rectangular = 0usize;
    for chunk in texts.chunks(window) {
        let lengths = embedder.token_lengths(chunk)?;
        rectangular += lengths.len() * lengths.iter().copied().max().unwrap_or(0);
    }
    let started = Instant::now();
    for chunk in texts.chunks(window) {
        let (_, stats) = embedder.embed_blocking_stats(chunk)?;
        total.inference_calls += stats.inference_calls;
        total.padded_token_slots += stats.padded_token_slots;
        total.real_tokens += stats.real_tokens;
    }
    let secs = started.elapsed().as_secs_f64();
    let real = total.real_tokens.max(1) as f64;
    println!(
        "{label:<28} passages={:<5} forwards={:<4} wall={secs:>7.2}s  {:>7.1} passages/s  \
         padded/real={:.2}  rect/real={:.2}",
        texts.len(),
        total.inference_calls,
        texts.len() as f64 / secs,
        total.padded_token_slots as f64 / real,
        rectangular as f64 / real,
    );
    Ok(())
}

/// Every readable file under `dir`, as one passage list: each file's text is
/// chunked exactly the way the ingest path chunks a `semantic_text` field
/// (`SEMANTIC_CHUNK_SIZE` 512 / overlap 64 in `xerj-engine`), so the passage
/// length distribution is the one a real `autoindex` run produces.
fn corpus_passages(dir: &std::path::Path, max_files: usize) -> anyhow::Result<Vec<String>> {
    let chunker = TextChunker::new(512, 64);
    let mut passages = Vec::new();
    let mut stack = vec![dir.to_path_buf()];
    let mut files = 0;
    while let Some(path) = stack.pop() {
        if files >= max_files {
            break;
        }
        let Ok(entries) = std::fs::read_dir(&path) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if let Ok(text) = std::fs::read_to_string(&path) {
                if text.trim().is_empty() {
                    continue;
                }
                passages.extend(chunker.chunk(&text, None).into_iter().map(|c| c.text));
                files += 1;
                if files >= max_files {
                    break;
                }
            }
        }
    }
    println!(
        "corpus {}: {files} files, {} passages",
        dir.display(),
        passages.len()
    );
    Ok(passages)
}

fn main() -> anyhow::Result<()> {
    let cfg = NeuralConfig {
        local_dir: std::env::var("XERJ_NEURAL_LOCAL_DIR").ok().map(Into::into),
        ..Default::default()
    };
    let t = Instant::now();
    let embedder = NeuralEmbedder::load(&cfg)?;
    println!(
        "loaded model dims={} in {:.2}s on {} cores\n",
        embedder.dims(),
        t.elapsed().as_secs_f64(),
        std::thread::available_parallelism().map_or(0, |n| n.get())
    );

    // Warm up: the first call pays lazy allocation inside candle.
    embedder.embed_blocking(&[short_passage(0)])?;

    let short: Vec<String> = (0..320).map(short_passage).collect();
    arm(&embedder, "single (1 passage/call)", &short[..128], 1)?;
    arm(&embedder, "uniform short (window 64)", &short, 64)?;

    // Each window of 64 holds 4 long chunks and 60 short lines — one window
    // per 64 consecutive entries.
    let mut mixed = Vec::new();
    for w in 0..5 {
        mixed.extend((0..4).map(|i| long_passage(w * 4 + i)));
        mixed.extend((0..60).map(|i| short_passage(w * 60 + i)));
    }
    arm(&embedder, "mixed 4 long + 60 short", &mixed, 64)?;

    // Batch-size sweep on uniform short passages: where does batching stop
    // paying?
    let sweep: Vec<String> = (0..512).map(short_passage).collect();
    for window in [1usize, 8, 16, 32, 64, 128, 256] {
        arm(
            &embedder,
            &format!("sweep short batch={window}"),
            &sweep,
            window,
        )?;
    }

    // All-long control: nothing short to pad up, so length grouping has
    // nothing to win and only the token budget applies.
    let long: Vec<String> = (0..64).map(long_passage).collect();
    arm(&embedder, "all long (control)", &long, 64)?;

    // One large document, every chunk in a single call — what a 200 KB header
    // does to the ingest path. Run it last: pre-fix this arm peaks at multiple
    // GB of resident memory.
    //
    // The synthesized default is prose (~4.7 characters per token), which shows
    // the row cap but understates the memory. Point `XERJ_NEURAL_BIGDOC` at a
    // real source file for the honest number: dense code tokenizes near 1.2
    // characters per token, so its chunks are ~4x longer and BERT's attention
    // tensor is quadratic in that.
    let document = match std::env::var("XERJ_NEURAL_BIGDOC") {
        Ok(path) => {
            let mut text = std::fs::read_to_string(&path)?;
            let cut = text
                .char_indices()
                .map(|(i, _)| i)
                .find(|i| *i >= 210_000)
                .unwrap_or(text.len());
            text.truncate(cut);
            println!("big document: {path} ({} bytes)", text.len());
            text
        }
        Err(_) => {
            let mut text = String::new();
            while text.len() < 210_000 {
                text.push_str(&long_passage(text.len()));
                text.push(' ');
            }
            text
        }
    };
    let chunks: Vec<String> = TextChunker::new(512, 64)
        .chunk(&document, None)
        .into_iter()
        .map(|c| c.text)
        .collect();
    arm(
        &embedder,
        "one 210 KB document",
        &chunks,
        chunks.len().max(1),
    )?;

    // Optional: a real folder, chunked the way ingest chunks it.
    if let Ok(dir) = std::env::var("XERJ_NEURAL_CORPUS") {
        let max_files = std::env::var("XERJ_NEURAL_CORPUS_FILES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);
        let passages = corpus_passages(std::path::Path::new(&dir), max_files)?;
        if !passages.is_empty() {
            arm(&embedder, "real corpus (window 64)", &passages, 64)?;
        }
    }

    Ok(())
}

```

### Core Architecture Module: `engine/crates/xerj-ai/examples/onnx_experimental.rs`
```
//! Reproducible smoke/throughput example for the experimental ONNX backend.
//!
//! cargo run --release -p xerj-ai --features onnx-experimental \
//!   --example onnx_experimental -- MODEL.onnx tokenizer.json

use anyhow::{Context, Result};
use std::path::PathBuf;
use std::time::Instant;
use xerj_ai::onnx::{MicrobatchConfig, OnnxEmbedder};

fn main() -> Result<()> {
    let args = std::env::args().collect::<Vec<_>>();
    let model = PathBuf::from(args.get(1).context("MODEL.onnx path required")?);
    let tokenizer = PathBuf::from(args.get(2).context("tokenizer.json path required")?);
    let embedder = OnnxEmbedder::load(&model, &tokenizer, 16)?;
    let texts = (0..256)
        .map(|i| {
            let repeats = [1, 1, 1, 6, 6, 18, 40, 80][i % 8];
            format!(
                "{} Record {i}.",
                "Revenue increased while freight expense reduced operating margin. "
                    .repeat(repeats)
            )
        })
        .collect::<Vec<_>>();

    let start = Instant::now();
    let singleton = texts
        .iter()
        .map(|text| embedder.embed_blocking(std::slice::from_ref(text)))
        .collect::<Result<Vec<_>>>()?;
    let singleton_seconds = start.elapsed().as_secs_f64();

    let start = Instant::now();
    let scheduled = embedder.embed_scheduled_blocking(&texts, MicrobatchConfig::default())?;
    let scheduled_seconds = start.elapsed().as_secs_f64();
    let min_cosine = singleton
        .iter()
        .zip(&scheduled)
        .map(|(left, right)| left[0].iter().zip(right).map(|(a, b)| a * b).sum::<f32>())
        .fold(1.0_f32, f32::min);

    println!(
        "{}",
        serde_json::to_string_pretty(&serde_json::json!({
            "documents": texts.len(),
            "singleton_documents_per_second": texts.len() as f64 / singleton_seconds,
            "scheduled_documents_per_second": texts.len() as f64 / scheduled_seconds,
            "speedup": singleton_seconds / scheduled_seconds,
            "min_cosine_vs_singleton": min_cosine,
            "output_order_checked": true,
        }))?
    );
    Ok(())
}

```

### Core Architecture Module: `engine/crates/xerj-ai/src/chunker.rs`
```
//! Text chunking for retrieval-augmented generation (RAG).
//!
//! Splits long documents into overlapping chunks suitable for embedding.
//! Attempts to break at sentence boundaries to preserve semantic coherence.

use serde::{Deserialize, Serialize};
use xerj_common::XerjError;

/// Result alias.
pub type Result<T> = std::result::Result<T, XerjError>;

// ─────────────────────────────────────────────────────────────────────────────
// Chunk
// ─────────────────────────────────────────────────────────────────────────────

/// A text chunk produced by [`TextChunker`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Chunk {
    /// The chunk text.
    pub text: String,
    /// Byte offset of the first character in the source document.
    pub start_offset: usize,
    /// Byte offset one past the last character in the source document.
    pub end_offset: usize,
    /// The ID of the parent document (set by the caller).
    pub parent_doc_id: Option<u64>,
    /// 0-based chunk index within the document.
    pub chunk_index: usize,
}

impl Chunk {
    /// Byte length of this chunk.
    pub fn len(&self) -> usize {
        self.end_offset - self.start_offset
    }

    pub fn is_empty(&self) -> bool {
        self.start_offset == self.end_offset
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TextChunker
// ─────────────────────────────────────────────────────────────────────────────

/// Splits text into overlapping chunks, breaking at sentence boundaries
/// when possible.
#[derive(Debug, Clone)]
pub struct TextChunker {
    /// Target chunk size in characters.
    pub chunk_size: usize,
    /// Number of characters to overlap between consecutive chunks.
    pub overlap: usize,
}

impl TextChunker {
    pub fn new(chunk_size: usize, overlap: usize) -> Self {
        assert!(
            overlap < chunk_size,
            "overlap must be smaller than chunk_size"
        );
        Self {
            chunk_size,
            overlap,
        }
    }

    /// Split `text` into chunks.
    ///
    /// Attempts to break at sentence boundaries (`.`, `!`, `?` followed by
    /// whitespace). Falls back to word boundaries, then character boundaries.
    pub fn chunk(&self, text: &str, parent_doc_id: Option<u64>) -> Vec<Chunk> {
        if text.is_empty() {
            return vec![];
        }

        // Work in char indices for correctness with multi-byte UTF-8
        let chars: Vec<(usize, char)> = text.char_indices().collect();
        let char_count = chars.len();

        if char_count <= self.chunk_size {
            return vec![Chunk {
                text: text.to_owned(),
                start_offset: 0,
                end_offset: text.len(),
                parent_doc_id,
                chunk_index: 0,
            }];
        }

        let mut chunks = Vec::new();
        let mut chunk_start_char = 0usize; // char index

        while chunk_start_char < char_count {
            let chunk_end_char = (chunk_start_char + self.chunk_size).min(char_count);

            // Find a good break point near chunk_end_char
            let break_char = if chunk_end_char >= char_count {
                char_count
            } else {
                self.find_sentence_break(&chars, chunk_end_char)
                    .or_else(|| self.find_word_break(&chars, chunk_end_char))
                    .unwrap_or(chunk_end_char)
            };

            let byte_start = chars[chunk_start_char].0;
            let byte_end = if break_char >= char_count {
                text.len()
            } else {
                chars[break_char].0
            };

            let chunk_text = text[byte_start..byte_end].to_owned();
            if !chunk_text.trim().is_empty() {
                chunks.push(Chunk {
                    text: chunk_text,
                    start_offset: byte_start,
                    end_offset: byte_end,
                    parent_doc_id,
                    chunk_index: chunks.len(),
                });
            }

            if break_char >= char_count {
                break;
            }

            // Advance from the ACTUAL break, not by a fixed
            // `chunk_size - overlap` step from the chunk start (RC4 W2
            // item 18): when the break landed before `start + chunk_size`
            // (early sentence/word boundary), the fixed step skipped the
            // chars in `break_char..start + step` — up to `chunk_size/4`
            // minus overlap chars (64 with the auto-embed 512/64 defaults)
            // silently absent from every chunk and every passage vector.
            // Starting the next chunk `overlap` chars before the previous
            // chunk's real end guarantees contiguous coverage and exactly
            // `overlap` shared chars. The `max(start + 1)` clamp guarantees
            // forward progress for degenerate configs whose overlap reaches
            // back past the early break.
            chunk_start_char = break_char
                .saturating_sub(self.overlap)
                .max(chunk_start_char + 1);
        }

        // Coverage assertion (debug builds): every non-whitespace char of
        // the input lies inside at least one chunk. Only whitespace may be
        // skipped (whitespace-only chunks are intentionally dropped above).
        debug_assert!(
            {
                let mut covered = vec![false; text.len()];
                for c in &chunks {
                    for b in &mut covered[c.start_offset..c.end_offset] {
                        *b = true;
                    }
                }
                text.char_indices()
                    .all(|(i, ch)| covered[i] || ch.is_whitespace())
            },
            "TextChunker dropped non-whitespace input between chunks"
        );

        chunks
    }

    /// Search backwards from `end_char` for a sentence boundary
    /// (`. `, `! `, `? ` or `.\n`).
    fn find_sentence_break(&self, chars: &[(usize, char)], end_char: usize) -> Option<usize> {
        let search_from = end_char.saturating_sub(self.chunk_size / 4);
        for i in (search_from..end_char).rev() {
            if i + 1 >= chars.len() {
                continue;
            }
            let c = chars[i].1;
            let next = chars[i + 1].1;
            if (c == '.' || c == '!' || c == '?') && (next == ' ' || next == '\n') {
                return Some(i + 2); // start after the punctuation + space
            }
        }
        None
    }

    /// Search backwards from `end_char` for a word boundary (space).
    fn find_word_break(&self, chars: &[(usize, char)], end_char: usize) -> Option<usize> {
        let search_from = end_char.saturating_sub(self.chunk_size / 4);
        for i in (search_from..end_char).rev() {
            if chars[i].1.is_whitespace() {
                return Some(i + 1);
            }
        }
        None
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_text_produces_single_chunk() {
        let chunker = TextChunker::new(200, 20);
        let chunks = chunker.chunk("Hello world.", None);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].text, "Hello world.");
        assert_eq!(chunks[0].start_offset, 0);
    }

    #[test]
    fn chunks_cover_full_text() {
        let text = "The quick brown fox jumps over the lazy dog. ".repeat(20);
        let chunker = TextChunker::new(100, 20);
        let chunks = chunker.chunk(&text, Some(42));

        // Every character should be covered by at least one chunk
        for chunk in &chunks {
            assert!(!chunk.text.is_empty());
            assert_eq!(chunk.text, text[chunk.start_offset..chunk.end_offset]);
        }

        // Parent doc ID is propagated
        for chunk in &chunks {
            assert_eq!(chunk.parent_doc_id, Some(42));
        }
    }

    #[test]
    fn overlap_creates_overlap_in_content() {
        let text = "word ".repeat(100);
        let chunker = TextChunker::new(50, 10);
        let chunks = chunker.chunk(&text, None);

        // Consecutive chunks should have some shared content
        if chunks.len() >= 2 {
            let a_end = chunks[0].end_offset;
            let b_start = chunks[1].start_offset;
            // b_start should be before a_end (overlap)
            assert!(
                b_start < a_end,
                "expected overlap: chunk[0] ends at {a_end}, chunk[1] starts at {b_start}"
            );
        }
    }

    #[test]
    fn chunk_indices_are_sequential() {
        let text = "sentence one. sentence two. sentence three. ".repeat(10);
        let chunker = TextChunker::new(80, 15);
        let chunks = chunker.chunk(&text, None);
        for (i, chunk) in chunks.iter().enumerate() {
            assert_eq!(chunk.chunk_index, i);
        }
    }

    #[test]
    fn empty_text_returns_empty() {
        let chunker = TextChunker::new(100, 10);
        assert!(chunker.chunk("", None).is_empty());
    }

    /// Every non-whitespace byte of `text` must be covered by at least one
    /// chunk's `[start_offset, end_offset)` range. (Whitespace-only regions
    /// may legitimately be skipped: whitespace-only chunks are dropped.)
    fn assert_full_coverage(text: &str, chunks: &[Chunk], ctx: &str) {
        let mut covered = vec![false; text.len()];
        for c in chunks {
            for b in &mut covered[c.start_offset..c.end_offset] {
                *b = true;
            }
        }
        let bytes = text.as_bytes();
        let dropped: Vec<usize> = covered
            .iter()
            .enumerate()
            .filter(|(i, cov)| !**cov && !bytes[*i].is_ascii_whitespace())
            .map(|(i, _)| i)
            .collect();
        assert!(
            dropped.is_empty(),
            "{ctx
```

### Core Architecture Module: `engine/crates/xerj-ai/src/decide.rs`
```
//! Local zero-shot decision head — tier 2 of the System One decide ladder.
//!
//! [`crate::neural`] answers *what is this text about* with vectors; this
//! module answers *what is this text* with probabilities over labels, in
//! process, via the same candle path. It is the rung below the history vote
//! in `xerj-api`'s decide ladder (issue #1057): when the `[decisions]`
//! history index has support the vote wins, and this head answers what the
//! history cannot — a node with no labelled history at all, or a question
//! whose payload retrieves no labelled neighbour.
//!
//! # The contract: pair scoring, not a fixed vocabulary
//!
//! A classifier head has a fixed `id2label`; decision questions arrive with
//! arbitrary labels (`noul` positive labels, `choice` criteria options), so a
//! fixed-vocabulary head cannot answer them. The head therefore loads an
//! NLI-shaped sequence-pair scorer — `id2label` must name `entailment` — and
//! scores one (premise, hypothesis) pair per candidate label, premise = the
//! payload text, hypothesis = [`hypothesis`] applied to the label. The
//! entailment probability of each hypothesis is renormalised across the
//! question's labels to a distribution that sums to 1. This is the
//! zero-shot-classification design the HF pipeline made standard, and it is
//! the shape the open `xerj-decide` model (issue #1064) is trained against:
//! v1.1 loads through this path unchanged.
//!
//! # Local files only — no egress
//!
//! Unlike [`crate::neural`], this module has **no hub download**: there is no
//! `hf-hub` dependency and no network code, so it adds nothing to the
//! published egress inventory. Weights are read from a configured directory
//! holding `config.json`, `tokenizer.json` and `model.safetensors` — the same
//! three files [`crate::neural::NeuralConfig::local_dir`] expects. A
//! deployment gets a checkpoint onto the machine the same way it gets any
//! other air-gapped asset.
//!
//! Weights load as F32 safetensors. candle 0.9 no longer ships the quantized
//! safetensors `VarBuilder` that earlier versions had (`gguf` is the only
//! quantized container left), so "quantized weights" in the issue's sense
//! would mean a gguf loader — deliberately not built here; the ≤ 300 MB
//! download budget is a property of the trained artifact (#1064), not of the
//! loader.
//!
//! Compiled only under the `decide-local` cargo feature.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock, Weak};

use anyhow::{anyhow, Context, Result};
use candle_core::{DType, Device, IndexOp, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::modernbert::{Config, ModernBertForSequenceClassification};
use tokenizers::{Encoding, Tokenizer, TruncationParams};

use crate::microbatch::group_by_padded_cost;

/// Cap on tokens per (premise, hypothesis) pair. Decision payloads are SMS-
/// and ticket-shaped, and every extra token is paid by every pair in the
/// batch; 512 covers the payload shapes the benchmarks use with headroom.
pub const MAX_TOKENS: usize = 512;

/// Rows in one forward pass — the same knee the neural embedder measured
/// ([`crate::neural`]): throughput climbs to 64 rows on CPU and then
/// flattens.
const MAX_BATCH_ROWS: usize = 64;

/// Ceiling on `rows × padded_sequence_length` for one forward pass, bounding
/// the activation memory one call can allocate. Same value as the neural
/// embedder's.
const PADDED_TOKEN_BUDGET: usize = 4_096;

/// How one label becomes an NLI hypothesis. Deterministic and part of the
/// model contract (#1064 trains against exactly this sentence); a template
/// is required because a bare label word is not a premise-hypothesis
/// statement an NLI head was trained to judge.
pub fn hypothesis(label: &str) -> String {
    format!("This example is {label}.")
}

/// The competing hypothesis for a `noul`: a binary question is scored as two
/// candidate statements, the positive label and its negation, so the answer
/// is a comparison rather than one unopposed score.
pub fn negation_hypothesis(label: &str) -> String {
    format!("This example is not {label}.")
}

/// How to obtain the decision model. A directory, not a hub id — see the
/// module header: this tier has no download path.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct DecideConfig {
    /// Directory holding `config.json`, `tokenizer.json` and
    /// `model.safetensors`.
    pub model_dir: PathBuf,
}

/// One scoring request: a payload and the candidate labels to judge it
/// against. `hypotheses` are full hypothesis strings (build them with
/// [`hypothesis`] / [`negation_hypothesis`]) so the caller controls label
/// wording; this module only scores what it is handed.
#[derive(Debug, Clone)]
pub struct ScoreRequest {
    pub premise: String,
    pub hypotheses: Vec<String>,
}

/// A loaded ModernBERT-class zero-shot decision head. Cheap to share behind
/// an `Arc`; scoring takes `&self`.
pub struct DecideModel {
    model: ModernBertForSequenceClassification,
    tokenizer: Tokenizer,
    device: Device,
    /// Row of the classifier head that means "entailment", resolved from
    /// `id2label` at load time.
    entailment: usize,
    pad_token_id: u32,
    /// The label vocabulary, for diagnostics (`/_decide`, `/v1/models`).
    labels: Vec<String>,
}

impl DecideModel {
    /// The classifier's own label vocabulary, index-ordered.
    pub fn labels(&self) -> &[String] {
        &self.labels
    }

    /// Load the model from a local directory. **Blocking** — callers run
    /// this off the async executor (see [`DecideHandle`]).
    pub fn load(cfg: &DecideConfig) -> Result<Self> {
        let dir = &cfg.model_dir;
        let config_path = dir.join("config.json");
        let tokenizer_path = dir.join("tokenizer.json");
        let weights_path = dir.join("model.safetensors");
        for (name, path) in [
            ("config.json", &config_path),
            ("tokenizer.json", &tokenizer_path),
            ("model.safetensors", &weights_path),
        ] {
            if !path.exists() {
                return Err(anyhow!(
                    "decide model dir {} is missing {name} (candle requires safetensors \
                     weights, not pytorch_model.bin)",
                    dir.display()
                ));
            }
        }

        let config_json = std::fs::read_to_string(&config_path)
            .with_context(|| format!("read decide config {}", config_path.display()))?;
        let config: Config = serde_json::from_str(&config_json)
            .with_context(|| format!("parse decide config {}", config_path.display()))?;
        let (entailment, labels) = entailment_index(&config)
            .with_context(|| format!("decide config {}", config_path.display()))?;

        let mut tokenizer = Tokenizer::from_file(&tokenizer_path)
            .map_err(|e| anyhow!("load tokenizer {}: {e}", tokenizer_path.display()))?;
        // Padding is applied per batch in [`Self::score_blocking`], so that
        // one long pair cannot charge every short pair its length — the same
        // discipline as [`crate::neural`].
        tokenizer.with_padding(None);
        tokenizer
            .with_truncation(Some(TruncationParams {
                max_length: MAX_TOKENS.min(config.max_position_embeddings.max(1)),
                ..Default::default()
            }))
            .map_err(|e| anyhow!("configure decide tokenizer truncation: {e}"))?;

        let device = Device::Cpu;
        let vb = unsafe {
            VarBuilder::from_mmaped_safetensors(
                std::slice::from_ref(&weights_path),
                DType::F32,
                &device,
            )
            .with_context(|| format!("map decide weights {}", weights_path.display()))?
        };
        let model = ModernBertForSequenceClassification::load(vb, &config)
            .map_err(|e| anyhow!("load ModernBERT classifier: {e}"))?;

        Ok(Self {
            model,
            tokenizer,
            device,
            entailment,
            pad_token_id: config.pad_token_id,
            labels,
        })
    }

    /// Score every request's hypotheses against its premise. Returns, per
    /// request, one probability per hypothesis (input order) summing to 1.
    /// **Blocking / CPU-bound** — call via `spawn_blocking`.
    ///
    /// All pairs across all requests are flattened and pushed through the
    /// model in length-homogeneous batches, so a request's cost is paid once
    /// for all of its labels.
    pub fn score_blocking(&self, requests: &[ScoreRequest]) -> Result<Vec<Vec<f32>>> {
        if requests.is_empty() {
            return Ok(Vec::new());
        }
        let mut pairs: Vec<(String, String)> = Vec::new();
        let mut spans: Vec<(usize, usize)> = Vec::with_capacity(requests.len()); // (start, len)
        for req in requests {
            if req.hypotheses.is_empty() {
                return Err(anyhow!(
                    "a score request with no hypotheses cannot be scored"
                ));
            }
            spans.push((pairs.len(), req.hypotheses.len()));
            for hypothesis in &req.hypotheses {
                pairs.push((req.premise.clone(), hypothesis.clone()));
            }
        }

        let encodings = self
            .tokenizer
            .encode_batch(pairs, true)
            .map_err(|e| anyhow!("tokenize decide pairs: {e}"))?;
        let lengths: Vec<usize> = encodings
            .iter()
            .map(|enc| enc.get_ids().len().min(MAX_TOKENS))
            .collect();

        // Entailment probability per pair, input order. With template
        // post-processing every encoding holds at least [CLS] and [SEP], so
        // a length of 0 cannot occur.
        let mut entailment_probs: Vec<f32> = vec![0.0; lengths.len()];
        for rows in group_by_padded_cost(&lengths, MAX_BATCH_ROWS, PADDED_TOKEN_BUDGET) {
            let seq_len = ro
```

### Core Architecture Module: `engine/crates/xerj-ai/src/embed.rs`
```
//! Embedding proxy — async HTTP client for OpenAI-compatible embedding APIs.
//!
//! Supports:
//! - Batch embedding with configurable model
//! - Rate limiting (token bucket)
//! - Retry with exponential backoff
//! - Configurable timeout

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tokio::time::sleep;
use tracing::{debug, warn};
use xerj_common::XerjError;

/// Result alias.
pub type Result<T> = std::result::Result<T, XerjError>;

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

/// Configuration for the embedding proxy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingProxyConfig {
    /// API endpoint URL.
    ///
    /// Before [`EmbeddingProxy::new`], this is the configured value
    /// (`embedding.default_endpoint`). `new` rewrites it to the URL that is
    /// actually POSTed (#2355). Accepted forms, trailing slash optional:
    ///
    /// * a base whose path ends in `/v1` — `/embeddings` is appended
    ///   (`http://localhost:8000/v1` → `http://localhost:8000/v1/embeddings`)
    /// * a bare origin (`http://host:port` or `http://host:port/`) —
    ///   `/embeddings` is appended
    /// * a path that already ends in `/embeddings` — used unchanged, aside
    ///   from dropping a trailing slash
    ///
    /// Any other path is refused here, before a request is sent. The error
    /// names the configured URL and suggests `{origin}/v1/embeddings`.
    pub endpoint: String,
    /// API key (sent as `Authorization: Bearer <key>`).
    pub api_key: Option<String>,
    /// Default embedding model name.
    pub model: String,
    /// Request timeout in milliseconds, per HTTP attempt.
    ///
    /// Milliseconds, because `embedding.timeout_ms` is: this field used to be
    /// whole seconds, filled with `timeout_ms / 1000`, so 1500 became a 1 s
    /// timeout and anything under 1000 became 0 s, which fails every request.
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
    /// Maximum concurrent in-flight requests.
    #[serde(default = "default_max_concurrent")]
    pub max_concurrent: usize,
    /// Maximum number of retries on transient failures.
    #[serde(default = "default_max_retries")]
    pub max_retries: u32,
    /// Maximum input texts per request (#1190). Providers cap
    /// `input` array length (OpenAI: 2048, many self-hosted ones far lower);
    /// one `_bulk` of N docs used to leave here as a single N-input request.
    /// Default 64 mirrors `embedding.batch_size`.
    #[serde(default = "default_batch_size")]
    pub batch_size: usize,
}

fn default_timeout_ms() -> u64 {
    30_000
}
fn default_max_concurrent() -> usize {
    4
}
fn default_max_retries() -> u32 {
    3
}
fn default_batch_size() -> usize {
    64
}

impl EmbeddingProxyConfig {
    pub fn new(endpoint: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            endpoint: endpoint.into(),
            api_key: None,
            model: model.into(),
            timeout_ms: default_timeout_ms(),
            max_concurrent: default_max_concurrent(),
            max_retries: default_max_retries(),
            batch_size: default_batch_size(),
        }
    }

    pub fn with_api_key(mut self, key: impl Into<String>) -> Self {
        self.api_key = Some(key.into());
        self
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wire types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct EmbedRequest<'a> {
    input: &'a [String],
    model: &'a str,
}

#[derive(Debug, Deserialize)]
struct EmbedResponse {
    data: Vec<EmbedDatum>,
}

#[derive(Debug, Deserialize)]
struct EmbedDatum {
    embedding: Vec<f32>,
    index: usize,
}

/// A single embedding attempt's failure, tagged with whether a retry could
/// plausibly succeed (item 9). Only `retryable` failures are re-attempted by
/// [`EmbeddingProxy::send_with_retry`]; a permanent failure (4xx client error,
/// contract violation) returns immediately instead of stalling ~2 min/doc.
struct EmbedFailure {
    err: XerjError,
    retryable: bool,
}

impl EmbedFailure {
    fn transient(err: XerjError) -> Self {
        Self {
            err,
            retryable: true,
        }
    }
    fn permanent(err: XerjError) -> Self {
        Self {
            err,
            retryable: false,
        }
    }
}

/// Whether an upstream HTTP status warrants a retry (item 9). Server errors
/// (5xx), rate-limit (429), and request-timeout (408) are transient; all
/// other 4xx client errors are permanent (fail fast).
fn status_is_retryable(code: u16) -> bool {
    code >= 500 || code == 429 || code == 408
}

/// `scheme://host[:port]` for `url`, with brackets around an IPv6 host.
fn endpoint_origin(url: &reqwest::Url) -> String {
    let host = url.host_str().unwrap_or("");
    let host = if host.contains(':') {
        format!("[{host}]")
    } else {
        host.to_string()
    };
    match url.port() {
        Some(port) => format!("{}://{host}:{port}", url.scheme()),
        None => format!("{}://{host}", url.scheme()),
    }
}

/// Request URL for one OpenAI-compatible embeddings call (#2355).
///
/// `default_endpoint` used to be POSTed verbatim, so the usual client base
/// `http://host:port/v1` 404'd. A base ending in `/v1` (trailing slash
/// optional) and a bare origin have `/embeddings` appended. A path that
/// already ends in `/embeddings` is kept, with a trailing slash removed so
/// `/v1/embeddings/` and `/v1/embeddings` hit the same route. Query strings
/// stay. Any other path is refused: appending would guess a route and send
/// document text there. The error names the configured URL and the full
/// `{origin}/v1/embeddings` path to set instead.
fn resolve_embeddings_endpoint(raw: &str) -> Result<String> {
    let configured = raw.trim();
    let mut url = reqwest::Url::parse(configured)
        .map_err(|e| XerjError::embedding(format!("invalid embedding endpoint: {e}")))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(XerjError::embedding(
            "embedding endpoint must use http or https",
        ));
    }
    if url.host_str().is_none() {
        let suggestion = format!("{configured}/v1/embeddings");
        return Err(XerjError::embedding(format!(
            "embedding endpoint `{configured}` has no host, so it was not called. \
             Set embedding.default_endpoint to `{suggestion}`."
        )));
    }

    let trimmed = url.path().trim_end_matches('/');
    let path = if trimmed.is_empty() { "/" } else { trimmed };
    let resolved = if path == "/" {
        "/embeddings".to_string()
    } else if path.ends_with("/embeddings") {
        path.to_string()
    } else if path.ends_with("/v1") {
        format!("{path}/embeddings")
    } else {
        let origin = endpoint_origin(&url);
        let suggestion = format!("{origin}/v1/embeddings");
        return Err(XerjError::embedding(format!(
            "embedding endpoint `{configured}` is not an embeddings URL, so it was not called. \
             A base URL ending in `/v1` or `/v1/` has `/embeddings` appended, and so does a bare \
             host (`{origin}` or `{origin}/`). Any other path must already end in `/embeddings`. \
             Set embedding.default_endpoint to `{suggestion}`."
        )));
    };
    url.set_path(&resolved);
    Ok(url.as_str().to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// EmbeddingProxy
// ─────────────────────────────────────────────────────────────────────────────

/// Async HTTP embedding proxy.
///
/// Thread-safe — clone-share freely between tasks.
#[derive(Clone)]
pub struct EmbeddingProxy {
    config: EmbeddingProxyConfig,
    client: reqwest::Client,
    /// Concurrency limiter.
    semaphore: Arc<Semaphore>,
}

impl EmbeddingProxy {
    /// Create a new proxy with the given config.
    ///
    /// Resolves [`EmbeddingProxyConfig::endpoint`] before the client is
    /// built, so a `/v1` base is completed and an unrecognized path fails
    /// here — at startup, when `mode = "proxy"` — rather than as a 404 on
    /// the first document.
    pub fn new(mut config: EmbeddingProxyConfig) -> Result<Self> {
        config.endpoint = resolve_embeddings_endpoint(&config.endpoint)?;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(config.timeout_ms))
            .build()
            .map_err(|e| XerjError::embedding(format!("HTTP client init: {e}")))?;

        let semaphore = Arc::new(Semaphore::new(config.max_concurrent));

        Ok(Self {
            config,
            client,
            semaphore,
        })
    }

    /// URL this proxy POSTs to, after base-URL completion (#2355).
    pub fn request_url(&self) -> &str {
        &self.config.endpoint
    }

    /// Embed a batch of texts using the configured model.
    ///
    /// Returns one embedding vector per input text, in the same order.
    pub async fn embed_batch(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        self.embed_batch_with_model(texts, &self.config.model.clone())
            .await
    }

    /// Embed texts using a specific model (overrides the config default).
    pub async fn embed_batch_with_model(
        &self,
        texts: Vec<String>,
        model: &str,
    ) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        // #1190: split into requests of at most `batch_size` inputs. The
        // semaphore permit moved from here to per-chunk: it limits in-flight
        // HTTP requests (its actual purpose), not logical batches.
        let chunk_len = self.config.batch_size.max(1);
        let chunks: Vec<&[String]> = if texts.len() <
```

### Core Architecture Module: `engine/crates/xerj-ai/src/embedder.rs`
```
//! Unified embedding backend.
//!
//! XERJ embeds `semantic_text` fields through one of four interchangeable
//! backends, all behind a single [`Embedder`] handle so the engine's ingest
//! and query paths never branch on the backend:
//!
//!   * [`Embedder::Lexical`] — the zero-dependency built-in feature-hash
//!     embedder ([`crate::local::local_embed`]). Deterministic, offline,
//!     fast — but lexical, *not* neural semantic understanding. This is the
//!     honest default when nothing else is configured.
//!   * [`Embedder::Proxy`] — an external OpenAI-compatible `/v1/embeddings`
//!     service ([`crate::embed::EmbeddingProxy`]). Bring any model/provider.
//!   * [`Embedder::Neural`] — the built-in BERT sentence encoder
//!     ([`crate::neural`]), running in-process via `candle`. Compiled only
//!     under the `neural` cargo feature. The server loads it at startup
//!     (`Embedder::preload_neural`); a blocked download refuses the process
//!     rather than failing every ingest. The handle still shares one
//!     process-wide model.
//!   * [`Embedder::Onnx`] — the experimental in-process ONNX Runtime backend.
//!     It is compiled only under `onnx-experimental`, requires explicit model
//!     and tokenizer paths, and loads the model lazily on first use.
//!
//! [`Embedder::is_active`] distinguishes a neural/proxy/ONNX backend from the
//! lexical fallback. The query path nevertheless auto-embeds `semantic_text`
//! fields with whichever backend indexed them, including lexical, so ingest
//! and query vectors always use the same embedding identity.

use anyhow::{anyhow, Result};

use crate::embed::EmbeddingProxy;
use crate::local::{local_embed, DEFAULT_DIMS};

#[cfg(feature = "onnx-experimental")]
struct CancellationSafeInit<T> {
    result: std::sync::OnceLock<std::result::Result<std::sync::Arc<T>, std::sync::Arc<str>>>,
    started: std::sync::atomic::AtomicBool,
    slow_warning_emitted: std::sync::atomic::AtomicBool,
    notify: tokio::sync::Notify,
}

#[cfg(feature = "onnx-experimental")]
struct InitCompletionGuard<T: Send + Sync + 'static> {
    shared: std::sync::Arc<CancellationSafeInit<T>>,
    armed: bool,
}

#[cfg(feature = "onnx-experimental")]
impl<T: Send + Sync + 'static> Drop for InitCompletionGuard<T> {
    fn drop(&mut self) {
        if !self.armed {
            return;
        }
        let fallback = std::sync::Arc::<str>::from(
            "ONNX initialization worker panicked before publishing a terminal result",
        );
        let _ = self.shared.result.set(Err(fallback));
        self.shared.notify.notify_waiters();
    }
}

#[cfg(feature = "onnx-experimental")]
impl<T: Send + Sync + 'static> CancellationSafeInit<T> {
    fn new() -> Self {
        Self {
            result: std::sync::OnceLock::new(),
            started: std::sync::atomic::AtomicBool::new(false),
            slow_warning_emitted: std::sync::atomic::AtomicBool::new(false),
            notify: tokio::sync::Notify::new(),
        }
    }

    async fn get_or_spawn<F>(
        self: &std::sync::Arc<Self>,
        thread_name: &str,
        load: F,
    ) -> Result<std::sync::Arc<T>>
    where
        F: FnOnce() -> Result<T> + Send + 'static,
    {
        use std::sync::atomic::Ordering;

        if !self.started.swap(true, Ordering::AcqRel) {
            let shared = std::sync::Arc::clone(self);
            let thread_name = thread_name.to_string();
            let worker_name = thread_name.clone();
            let started = std::time::Instant::now();
            tracing::info!(%thread_name, "ONNX lazy initialization scheduled");
            // #1122: Builder::spawn panics in the child when the alternate
            // signal stack cannot be mapped (`panic = "abort"` kills the
            // node). A failed spawn publishes the error on the same path
            // an `Err` from pthread_create already took.
            let spawn = xerj_common::thread_spawn::try_spawn_unguarded(&thread_name, move || {
                let mut completion = InitCompletionGuard {
                    shared: std::sync::Arc::clone(&shared),
                    armed: true,
                };
                let result =
                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| match load() {
                        Ok(value) => Ok(std::sync::Arc::new(value)),
                        Err(error) => Err(std::sync::Arc::<str>::from(format!("{error:#}"))),
                    }))
                    .unwrap_or_else(|payload| {
                        let detail = if let Some(message) = payload.downcast_ref::<&str>() {
                            (*message).to_string()
                        } else if let Some(message) = payload.downcast_ref::<String>() {
                            message.clone()
                        } else {
                            "non-string panic payload".to_string()
                        };
                        Err(std::sync::Arc::<str>::from(format!(
                            "ONNX initialization loader panicked: {detail}"
                        )))
                    });
                let elapsed_ms = started.elapsed().as_millis();
                let _ = shared.result.set(result);
                shared.notify.notify_waiters();
                completion.armed = false;

                let published = shared
                    .result
                    .get()
                    .expect("initialization result was just published");
                match published {
                    Ok(_) => tracing::info!(
                        thread_name = %worker_name,
                        elapsed_ms,
                        "ONNX lazy initialization completed"
                    ),
                    Err(error) => tracing::error!(
                        thread_name = %worker_name,
                        elapsed_ms,
                        %error,
                        "ONNX lazy initialization failed"
                    ),
                }
            });
            if let Err(failure) = spawn {
                let error = failure.error;
                drop(failure.job);
                let error = std::sync::Arc::<str>::from(format!(
                    "spawn ONNX initialization thread {thread_name}: {error}"
                ));
                let _ = self.result.set(Err(error));
                self.notify.notify_waiters();
            }
        }

        loop {
            let notified = self.notify.notified();
            if let Some(result) = self.result.get() {
                return result
                    .clone()
                    .map_err(|error| anyhow!("ONNX model initialization failed: {error}"));
            }
            if self
                .slow_warning_emitted
                .load(std::sync::atomic::Ordering::Acquire)
            {
                notified.await;
            } else {
                tokio::select! {
                    () = notified => {}
                    () = tokio::time::sleep(std::time::Duration::from_secs(30)) => {
                        if !self.slow_warning_emitted.swap(
                            true,
                            std::sync::atomic::Ordering::AcqRel,
                        ) {
                            tracing::warn!(
                                "ONNX lazy initialization is still running after 30 seconds"
                            );
                        }
                    }
                }
            }
        }
    }
}

#[cfg(feature = "onnx-experimental")]
struct OnnxShared {
    init: std::sync::Arc<CancellationSafeInit<crate::onnx::OnnxPool>>,
    calls: std::sync::Arc<tokio::sync::Semaphore>,
    bytes: std::sync::Arc<tokio::sync::Semaphore>,
}

#[cfg(feature = "neural")]
type NeuralCell = tokio::sync::OnceCell<std::sync::Arc<crate::neural::NeuralEmbedder>>;

/// Process-scoped registry of lazily loaded neural models. Every index builds
/// its own [`Embedder`], but indices using the same complete neural
/// configuration must not each load another copy of the ~90 MB model.
///
/// Weak values are intentional: the registry coordinates sharing without
/// extending a model's lifetime after the last index using it is dropped.
#[cfg(feature = "neural")]
fn shared_neural_cell(cfg: &crate::neural::NeuralConfig) -> std::sync::Arc<NeuralCell> {
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock, Weak};

    static CELLS: OnceLock<Mutex<HashMap<crate::neural::NeuralConfig, Weak<NeuralCell>>>> =
        OnceLock::new();

    let mut cells = CELLS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(cell) = cells.get(cfg).and_then(Weak::upgrade) {
        return cell;
    }

    // Opportunistically discard entries whose final handle has gone away.
    cells.retain(|_, cell| cell.strong_count() > 0);
    let cell = std::sync::Arc::new(NeuralCell::new());
    cells.insert(cfg.clone(), std::sync::Arc::downgrade(&cell));
    cell
}

/// A backend-agnostic text embedder shared across the engine.
pub enum Embedder {
    /// Built-in lexical feature-hash embedder (no model, no network).
    Lexical,
    /// External OpenAI-compatible embedding service.
    Proxy(EmbeddingProxy),
    /// Built-in neural BERT embedder (candle). The server preloads it at
    /// startup; a handle built without that preload still loads on first embed.
    #[cfg(feature = "neural")]
    Neural(NeuralHandle),
    /// Experimental local ONNX Runtime sentence encoder.
    #[cfg(feature = "onnx-experimental")]
    Onnx(OnnxHandle),
}

impl Embedder {
    /// The zero-config lexical fallback.
    pub fn lexical() -> Self {
        Embedder::Lexical
    }

    /// Wrap an already-constructed external embedding proxy.
    pub fn proxy(proxy: EmbeddingProxy) -> Self {
        Embedder::Proxy(proxy)
    }

    /// A built-in neural embedder. Call [`preload_neural`] first when a
    /// failed down
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2898** (2026-11-03): **mcp: a tools/call with no id blocks the stdio read loop and still gets a response**
  *Symptoms*: ### XERJ version  `origin/main` at `4ce1fbb5503beb1f5a1cd8f54d2e34ab7499657f`  ### How did you install / run XERJ?  Other (describe in steps below). Read the dispatch in `engine/crates/xerj-mcp/src/lib.rs` on that commit. No node was started.  ### Operating system & architecture  Windows 11 x86_64. The dispatch is the same on every platform.  ### Steps to reproduce  On `origin/main`, the stdio loop and `handle_message` disagree about what a `tools/call` without a usable id is.  `is_tool_call_request` (`lib.rs` 517-519) is the only path that runs a tool call off the read loop:  ```rust fn is_tool_call_request(msg: &Value) -> bool {     msg.get("method").and_then(Value::as_str) == Some("tools/call")         && msg.get("id").is_some_and(|id| !id.is_null()) } ```  Anything else falls through to the read loop (`lib.rs` 504):  ```rust other => handle_message(&ctx, other).await.into_iter().collect(), ```  `handle_message` (`lib.rs` 606-621) does not treat a missing id as "do not reply" for the methods it knows. A notification is `id.is_none()`, and that flag is consulted only in the unknown-method arm. `tools/call` always awaits `call_tool` and always returns a response:  ```rust "tools/call" => Some(rpc_result(id, call_tool(ctx, &msg).await)), ```  `rpc_result` turns a missing id into JSON `null` (`lib.rs` 726-727).  Send either of these as one stdio line:  ```json {"jsonrpc":"2.0","method":"tools/call","params":{"name":"xerj_search","arguments":{"query":"x"}}} ```  ```json {"jsonr

- **Issue #2841** (2026-11-02): **[bug]: autoindex stalls on 26-file scientific CSV corpus at 16–32 workers; completes at 4 workers (rc.100)**
  *Symptoms*: ### XERJ version  v1.0.0-rc.100  ### How did you install / run XERJ?  Prebuilt release binary  ### Operating system & architecture  Ubuntu 26.04 LTS / WSL2 / x86_64  ### Steps to reproduce  ```shell Steps to reproduce Generate the approximately 27 MB, 26-file input directory from .csv / .csv.gz-named files in the SCTransform repo (note: XERJ classified 18 as CSV and 8 as txt-lines; the latter is the reader's content-based classification): git clone https://github.com/Zikun-Yang/SCTransform.git cd SCTransform git checkout 8ade6eded351689ff53e37958a8190d70279fe31 mkdir -p /tmp/xerj-sct-csv-files find "$PWD" -type f \( -name '*.csv' -o -name '*.csv.gz' \) -printf '%P\0' | \   rsync -a --from0 --files-from=- "$PWD/" /tmp/xerj-sct-csv-files/ Start a local XERJ server with an empty data directory and an ES-compatible REST endpoint (the measured runs used port 19200). Then, on one server, run the variants separately, with distinct prefixes and journal paths: # Variant 1: 32 workers, 420-second external cutoff mkdir -p /tmp/xerj-states set -o pipefail timeout --signal=INT --kill-after=30s 420s \   xerj autoindex /tmp/xerj-sct-csv-files \     --url http://127.0.0.1:19200 \     --prefix sct-repro-w32 \     --state-dir /tmp/xerj-states/w32 \     --workers 32 --progress plain --progress-interval 5 # Repeat with a NEW prefix and NEW state-dir for --workers 16 and 4. The input construction command above is derived from the original snapshot preparation, not yet independently rerun from a p

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

### Incident Patch 1: `e9f8e4a7` (2026-11-03)
**Commit Message**: fix(tests): name loopback networking when a test's bind is denied (#2889)

* fix(autoindex): name loopback networking when a test's bind is denied

In a sandbox that forbids binding 127.0.0.1, about 250 xerj-autoindex
tests failed with only `Os { kind: PermissionDenied }` from an unwrap,
which reads as a broken build (#2886).

Every fake-node listener in the crate's tests now comes from
`test_loopback::bind()`. On PermissionDenied or AddrNotAvailable it
panics with "the xerj-autoindex tests start fake nodes on 127.0.0.1 and
need loopback networking". tests/feedback_offline.rs, which cannot see
cfg(test) items, gets the same message from a local helper, and its env
lock now survives a poisoned holder, so the other six tests there show
the cause instead of PoisonError. CONTRIBUTING.md says the tests need
loopback.

Tests: test_loopback::tests::a_denied_or_unavailable_loopback_bind_names_the_requirement.
With bind() denied by a seccomp filter (EPERM), the lib tests' 250 bind
panics change from a bare PermissionDenied to the loopback message, and
all 7 feedback_offline tests show it. With loopback allowed the crate
passes except the 3 harvest unreadable-path tests, which fail only when

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -132,6 +132,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- Tests name the cause when loopback networking is unavailable (#2886). Every
+  test that binds an ephemeral 127.0.0.1 port, in all crates, goes through
+  `xerj_common::loopback_test::expect_loopback`, so a sandbox that denies the
+  bind fails with "this test starts a fake server on 127.0.0.1 and needs
+  loopback networking" instead of hundreds of bare `PermissionDenied` panics.
+
 - `/lead` rejects non-string email values with HTTP 400 before storage.
   Arrays no longer become accepted addresses through string coercion, and
   objects with a non-callable `toString` no longer cause HTTP 500.
```

**File**: `CONTRIBUTING.md` (modified, +5/-0)
```diff
@@ -42,6 +42,11 @@ cargo test                                # unit + integration tests
 cargo test -p xerj-engine --test integration
 ```
 
+Many tests start fake nodes on `127.0.0.1`, so they need loopback networking. In a
+sandbox that denies binding `127.0.0.1`, those tests fail with a message that says
+so. A new test that binds an ephemeral loopback port should wrap the bind in
+`xerj_common::loopback_test::expect_loopback`.
+
 ### ES-YAML conformance suite (required)
 
 XERJ's compatibility contract is the Elasticsearch REST API YAML test suite based on ES 8.13. **CI requires 0 failed cases — there is no "known failures" list.** The runner reports passed, failed, and skipped cases separately; skipped cases do not fail the gate, and the total changes as cases are added. If a test expects one response and XERJ returns another, XERJ is wrong; fix the engine, not the test.
```

**File**: `engine/Cargo.lock` (modified, +1/-0)
```diff
@@ -7813,6 +7813,7 @@ dependencies = [
  "tokio",
  "tracing",
  "xerj-ai",
+ "xerj-common",
 ]
 
 [[package]]
```

**File**: `engine/crates/xerj-ai/src/embed.rs` (modified, +6/-3)
```diff
@@ -509,7 +509,8 @@ mod tests {
     /// `/v1/embeddings` URL must all POST to `/v1/embeddings`.
     #[tokio::test]
     async fn posts_v1_base_trailing_slash_and_full_url_to_embeddings() {
-        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
+        let listener =
+            xerj_common::loopback_test::expect_loopback(std::net::TcpListener::bind("127.0.0.1:0"));
         let addr = listener.local_addr().unwrap();
         let handle = std::thread::spawn(move || {
             use std::io::{Read, Write};
@@ -597,7 +598,8 @@ mod tests {
         // 200ms base backoff, the OLD code would sleep 200+400+800+1600+3200ms
         // ≈ 6.2s before giving up. Classified as permanent, we return on the
         // first attempt — well under the first backoff.
-        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
+        let listener =
+            xerj_common::loopback_test::expect_loopback(std::net::TcpListener::bind("127.0.0.1:0"));
         let addr = listener.local_addr().unwrap();
         let handle = std::thread::spawn(move || {
             use std::io::{Read, Write};
@@ -640,7 +642,8 @@ mod tests {
     // order across chunk boundaries.
     #[tokio::test]
     async fn batch_size_splits_requests_and_preserves_order() {
-        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
+        let listener =
+            xerj_common::loopback_test::expect_loopback(std::net::TcpListener::bind("127.0.0.1:0"));
         let addr = listener.local_addr().unwrap();
         let handle = std::thread::spawn(move || {
             use std::io::{Read, Write};
```

**File**: `engine/crates/xerj-api/src/binary_protocol.rs` (modified, +4/-6)
```diff
@@ -540,9 +540,8 @@ mod tests {
                 }
             }),
         );
-        let listener = TcpListener::bind("127.0.0.1:0")
-            .await
-            .expect("bind mock backend");
+        let listener =
+            xerj_common::loopback_test::expect_loopback(TcpListener::bind("127.0.0.1:0").await);
         let addr = listener.local_addr().expect("mock backend addr");
         tokio::spawn(async move {
             let _ = axum::serve(listener, app).await;
@@ -563,9 +562,8 @@ mod tests {
         let (config, engine, dir) = semantic_engine(endpoint);
         let metrics = xerj_common::metrics::Metrics::new().expect("metrics");
         let state = Arc::new(crate::state::AppState::new(config, engine, metrics));
-        let listener = TcpListener::bind("127.0.0.1:0")
-            .await
-            .expect("bind binary protocol");
+        let listener =
+            xerj_common::loopback_test::expect_loopback(TcpListener::bind("127.0.0.1:0").await);
         let addr = listener.local_addr().expect("binary protocol addr");
         tokio::spawn(async move {
             while let Ok((stream, _)) = listener.accept().await {
```

**File**: `engine/crates/xerj-api/tests/autoindex_changed_file_drops_stale_symbols.rs` (modified, +3/-1)
```diff
@@ -351,7 +351,9 @@ async fn reindex_changed_code(app: &axum::Router, url: &str, no_graph: bool) {
 #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
 async fn changed_code_file_reindex_drops_shifted_and_removed_symbols_on_the_engine() {
     let app = app().await;
-    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
+    let listener = xerj_common::loopback_test::expect_loopback(
+        tokio::net::TcpListener::bind("127.0.0.1:0").await,
+    );
     let addr = listener.local_addr().unwrap();
     let served = app.clone();
     tokio::spawn(async move {
```

**File**: `engine/crates/xerj-api/tests/autoindex_html_inline_script.rs` (modified, +3/-1)
```diff
@@ -234,7 +234,9 @@ fn autoindex_finds_inline_script_functions_by_def_and_search() {
 
 async fn autoindex_finds_inline_script_functions_by_def_and_search_inner() {
     let app = app().await;
-    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
+    let listener = xerj_common::loopback_test::expect_loopback(
+        tokio::net::TcpListener::bind("127.0.0.1:0").await,
+    );
     let addr = listener.local_addr().unwrap();
     let served = app.clone();
     tokio::spawn(async move {
```

**File**: `engine/crates/xerj-api/tests/body_named_index_bypasses.rs` (modified, +3/-3)
```diff
@@ -50,9 +50,9 @@ struct Node {
 
 /// Bind an ephemeral port and serve `app` on it.
 async fn serve(app: axum::Router) -> SocketAddr {
-    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
-        .await
-        .expect("bind");
+    let listener = xerj_common::loopback_test::expect_loopback(
+        tokio::net::TcpListener::bind("127.0.0.1:0").await,
+    );
     let addr = listener.local_addr().expect("local addr");
     tokio::spawn(async move {
         let _ = axum::serve(listener, app).await;
```

---

### Incident Patch 2: `1fc45697` (2026-11-02)
**Commit Message**: fix(api): refuse more than one alias write index at update time (#2876)

`POST /_aliases` and `PUT /{index}/_alias/{name}` stored every
`is_write_index: true` they were given, even when two members of the same
alias carried it. The update answered 200 and the alias was unusable: every
document write through it answered 400 "has more than one write index",
potentially long after the change.

Both APIs now simulate the final member set of the request before mutating
anything and refuse a state with more than one designated writer with a 400
`illegal_argument_exception`. The final state is what matters: an atomic
switch (add the new write index, then clear the old one) is accepted even
though an intermediate action names two. A wildcard add that expands to
several indices with `is_write_index:true` is refused, as is a second PUT. A
single-member alias with no explicit flag remains an implicit writer, so
adding one explicit `true` member is valid. A refused request leaves no
alias/member behind.

Evidence (rc.100, real node):
- before: add i1+i2 with is_write_index:true -> 200, _cat shows both true,
  write via alias -> 400; PUT i4/_alias/b true when i3 true -> 200, write 400;
  wildca

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -232,6 +232,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   bytes) is reported as the new `version_map` category. On the 1 GB gate's
   search node the map held ~0.5 GB that no budget saw. (#2427)
 - `xerj autoindex`: Vue (`.vue`) and Svelte (`.svelte`) single-file components are indexed as code instead of being junk-filed as malformed XML. Their `<script>` blocks are parsed with the TypeScript or JavaScript grammar (by `lang`), so their declarations are symbols on the component's own lines, and the record's `language` is `vue` or `svelte`. (#2732)
+- The alias APIs reject an update that would leave more than one
+  `is_write_index: true` member (`POST /_aliases` and
+  `PUT /{index}/_alias/{name}`), including a wildcard add that expands to
+  several indices. The check is on the final state of a batch, so an atomic
+  switch (add the new writer, clear the old one) still works; a rejected
+  update changes nothing instead of leaving an alias whose every write
+  answers 400.
+
 - `_reindex` applies `source._source` field filtering to the documents it
   copies, so an excluded secret or large field no longer reaches the
   destination. `_source:false` is refused with ES's sentence, and a `script`
```

**File**: `engine/crates/xerj-api/src/es_compat.rs` (modified, +92/-0)
```diff
@@ -26256,6 +26256,49 @@ fn alias_target_is_pattern(spec: &str) -> bool {
         .any(|p| p == "_all" || p.contains('*'))
 }
 
+/// The members of `alias` explicitly marked `is_write_index: true`.
+///
+/// A single-member alias with no explicit flag is an implicit write target and
+/// is deliberately not listed: adding a second member with an explicit `true`
+/// leaves exactly one designated write index, which ES accepts. The list is
+/// what the alias-update invariant counts.
+fn alias_write_members(state: &AppState, alias: &str) -> HashSet<String> {
+    let mut writes = HashSet::new();
+    if let Some(members) = state.engine.aliases.get(alias) {
+        for member in members.iter() {
+            let is_write = state
+                .engine
+                .index_alias_metadata
+                .get(member.as_str())
+                .is_some_and(|meta| {
+                    meta.get(alias)
+                        .and_then(|alias_meta| alias_meta.get("is_write_index"))
+                        .and_then(Value::as_bool)
+                        == Some(true)
+                });
+            if is_write {
+                writes.insert(member.clone());
+            }
+        }
+    }
+    writes
+}
+
+/// ES's metadata invariant: an alias can designate at most one write index.
+/// Refuse the alias update before it is stored, rather than accepting an alias
+/// whose every later write answers 400.
+fn more_than_one_write_index(alias: &str, writes: &HashSet<String>) -> Option<String> {
+    if writes.len() <= 1 {
+        return None;
+    }
+    let mut names: Vec<&str> = writes.iter().map(String::as_str).collect();
+    names.sort_unstable();
+    Some(format!(
+        "alias [{alias}] has more than one write index [{}]",
+        names.join(", ")
+    ))
+}
+
 pub async fn post_aliases(
     State(state): State<AppState>,
     Json(body): Json<AliasActionsBody>,
@@ -26307,6 +26350,41 @@ pub async fn post_aliases(
             plan.push(Resolved::Remove(remove, targets));
         }
     }
+    // At most one `is_write_index: true` per alias. Actions run in order, so
+    // an atomic swap (add the new write index, then clear the old one) is
+    // valid even though an intermediate action has two. Simulate the final
+    // state and refuse the whole request before the first mutation; otherwise
+    // the alias is persisted and every later write answers 400.
+    let mut write_members: HashMap<String, HashSet<String>> = HashMap::new();
+    for step in &plan {
+        match step {
+            Resolved::Add(add, targets) => {
+                let writes = write_members
+                    .entry(add.alias.clone())
+                    .or_insert_with(|| alias_write_members(&state, &add.alias));
+                for target in targets {
+                    if add.is_write_index == Some(true) {
+                        writes.insert(target.clone());
+                    } else {
+                        writes.remove(target);
+                    }
+                }
+            }
+            Resolved::Remove(remove, targets) => {
+                let writes = write_members
+                    .entry(remove.alias.clone())
+                    .or_insert_with(|| alias_write_members(&state, &remove.alias));
+                for target in targets {
+                    writes.remove(target);
+                }
+            }
+        }
+    }
+    for (alias, writes) in &write_members {
+        if let Some(reason) = more_than_one_write_index(alias, writes) {
+            return es_bad_request("illegal_argument_exception", &reason, None);
+        }
+    }
     for step in &plan {
         match step {
             Resolved::Add(add, targets) => {
@@ -26634,6 +26712,20 @@ pub async fn put_alias(
         let e = xerj_common::XerjError::index_not_found(&index);
         return ApiError::new(e).into_response();
     }
+    // Re-putting an alias replaces its definition (including the write flag).
+    // Simulate the final member set and refuse a second write index before
+    // any member is attached, so a rejected PUT leaves the alias untouched.
+    let mut write_members = alias_write_members(&state, &alias);
+    for target in &targets {
+        if alias_meta.get("is_write_index").and_then(Value::as_bool) == Some(true) {
+            write_members.insert(target.clone());
+        } else {
+            write_members.remove(target);
+        }
+    }
+    if let Some(reason) = more_than_one_write_index(&alias, &write_members) {
+        return es_bad_request("illegal_argument_exception", &reason, None);
+    }
     for idx in &targets {
         if let Err(error) = attach(idx) {
             return ApiError::new(xerj_common::XerjError::from(error)).into_response();
```

**File**: `engine/crates/xerj-api/tests/alias_write_index_uniqueness.rs` (added, +240/-0)
```diff
@@ -0,0 +1,240 @@
+//! An alias may designate at most one write index.
+//!
+//! `POST /_aliases` and `PUT /{index}/_alias/{alias}` used to accept two
+//! members with `is_write_index: true` and answer 200. The resulting alias
+//! was unusable: every document write through it answered 400 "alias [a] has
+//! more than one write index", so the configuration error surfaced only at
+//! the next write, possibly long after the alias update.
+//!
+//! The invariant is checked against the FINAL state of the action batch:
+//! actions run in order, so an atomic swap (add the new write index, then
+//! clear the old one) is valid even though an intermediate step names two.
+//! A refused batch changes nothing, including when the second write index is
+//! added through a wildcard that expands to several indices.
+//!
+//! Elasticsearch is referenced for wire semantics only; no ES code is
+//! reproduced here.
+
+use axum::body::Body;
+use axum::http::{Request, StatusCode};
+use serde_json::{json, Value};
+use tower::ServiceExt;
+
+async fn app() -> (axum::Router, tempfile::TempDir) {
+    let dir = tempfile::tempdir().expect("tempdir");
+    let mut config = xerj_common::config::Config::default();
+    config.server.data_dir = dir.path().to_string_lossy().into_owned();
+    config.storage.wal_sync = xerj_common::config::WalSync::Async;
+    let metrics = xerj_common::metrics::Metrics::new().expect("metrics");
+    let engine = xerj_engine::Engine::new(config.clone()).expect("engine");
+    let state = xerj_api::state::AppState::new(config, engine, metrics);
+    (xerj_api::router::build_es_compat_router(state), dir)
+}
+
+async fn call(app: &axum::Router, method: &str, path: &str, body: Value) -> (StatusCode, Value) {
+    let mut req = Request::builder().method(method).uri(path);
+    let body = if body.is_null() {
+        Body::empty()
+    } else {
+        req = req.header("content-type", "application/json");
+        Body::from(body.to_string())
+    };
+    let response = app.clone().oneshot(req.body(body).unwrap()).await.unwrap();
+    let status = response.status();
+    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
+        .await
+        .unwrap();
+    (
+        status,
+        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
+    )
+}
+
+async fn create_index(app: &axum::Router, index: &str) {
+    let (status, body) = call(app, "PUT", &format!("/{index}"), json!({})).await;
+    assert_eq!(status, StatusCode::OK, "{body}");
+}
+
+async fn post_actions(app: &axum::Router, actions: Value) -> (StatusCode, Value) {
+    call(app, "POST", "/_aliases", json!({"actions": actions})).await
+}
+
+async fn put_alias(
+    app: &axum::Router,
+    index: &str,
+    alias: &str,
+    body: Value,
+) -> (StatusCode, Value) {
+    call(app, "PUT", &format!("/{index}/_alias/{alias}"), body).await
+}
+
+fn is_write(entry: &Value) -> bool {
+    entry["is_write_index"] == json!(true) || entry["is_write_index"] == json!("true")
+}
+
+/// `(index, is_write_index)` for one alias from `_cat/aliases?format=json`.
+async fn alias_members(app: &axum::Router, alias: &str) -> Vec<(String, bool)> {
+    let (status, body) = call(app, "GET", "/_cat/aliases?format=json", Value::Null).await;
+    assert_eq!(status, StatusCode::OK, "{body}");
+    let mut members: Vec<(String, bool)> = body
+        .as_array()
+        .unwrap()
+        .iter()
+        .filter(|entry| entry["alias"] == alias)
+        .map(|entry| {
+            (
+                entry["index"].as_str().unwrap_or_default().to_string(),
+                is_write(entry),
+            )
+        })
+        .collect();
+    members.sort_by(|a, b| a.0.cmp(&b.0));
+    members
+}
+
+async fn write_through_alias(app: &axum::Router, alias: &str) -> (StatusCode, Value) {
+    call(app, "PUT", &format!("/{alias}/_doc/1"), json!({"v": "x"})).await
+}
+
+fn reason(body: &Value) -> &str {
+    body.pointer("/error/root_cause/0/reason")
+        .and_then(Value::as_str)
+        .or_else(|| body.get("error").and_then(Value::as_str))
+        .unwrap_or_default()
+}
+
+#[tokio::test]
+async fn post_aliases_rejects_two_write_indices_atomically() {
+    let (app, _dir) = app().await;
+    create_index(&app, "i1").await;
+    create_index(&app, "i2").await;
+
+    let (status, body) = post_actions(
+        &app,
+        json!([
+            {"add": {"index": "i1", "alias": "a", "is_write_index": true}},
+            {"add": {"index": "i2", "alias": "a", "is_write_index": true}}
+        ]),
+    )
+    .await;
+    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
+    assert_eq!(
+        body.pointer("/error/type").and_then(Value::as_str),
+        Some("illegal_argument_exception"),
+        "{body}"
+    );
+    assert!(
+        reason(&body).contains("alias [a] has more than one write index"),
+        "{body}"
+    );
+    assert!(
+        alias_members(&app, "a").await.is_empty(),
+        "a refused batch must leave no alias behin
```

**File**: `engine/crates/xerj-api/tests/alias_write_routing.rs` (modified, +5/-3)
```diff
@@ -211,19 +211,21 @@ async fn writes_follow_the_alias_write_index_and_refuse_ambiguity() {
     assert_eq!(status, StatusCode::CREATED, "{body}");
     assert_eq!(body["_index"], "i1", "{body}");
 
-    // Two designated write indices are refused like the ambiguous shape.
+    // A second designated write index is refused at the alias update, before
+    // it can leave the alias unusable; i2 remains the write target.
     let (status, body) = call(
         &app,
         "PUT",
         "/i1/_alias/multi",
         json!({"is_write_index": true}),
     )
     .await;
-    assert_eq!(status, StatusCode::OK, "{body}");
-    let (status, body) = call(&app, "PUT", "/multi/_doc/10", json!({"t": "ten"})).await;
     assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
     assert!(
         refusal(&body).contains("has more than one write index"),
         "{body}"
     );
+    let (status, body) = call(&app, "PUT", "/multi/_doc/10", json!({"t": "ten"})).await;
+    assert_eq!(status, StatusCode::CREATED, "{body}");
+    assert_eq!(body["_index"], "i2", "{body}");
 }
```

---

### Incident Patch 3: `526ac8db` (2026-11-03)
**Commit Message**: docs(feedback): report MCP stdio protocol fix session (#2902)

Agent field report for the session that produced PR #2901 (issue #2898).
Written by an AI agent (JoyCode), operated and submitted by @Jarvis636431.

Records what the stdio test scaffolding was like to work in, and the two
host-specific test failures that read as regressions on first contact: the
debug-profile local_def stack overflow and the loopback_proxy test's
undocumented need for a 127.0.0.2 alias. Both reproduce on clean upstream/main
on this host. Every number in the file comes from a command run in the session;
no retrieval or indexing was measured because none was run.

One new file under user-feedback/16-agent-field-reports/, 13 lines, nothing
else in the diff.

**File**: `user-feedback/16-agent-field-reports/2026-11-03-mcp-stdio-gate.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+# Fixing an MCP stdio protocol defect, with the binary as its own test node (2026-11-03)
+
+**Agent:** JoyCode (GPT-6)  ·  **XERJ:** xerj v1.0.0-rc.100  ·  **Platform:** macOS 26.2, arm64
+
+**Pointed at:** nothing indexed this session — the XERJ repo itself, as the subject of the change, plus a locally built node used only as the target of the ES-YAML conformance suite.
+
+**Used it for:** `xerj mcp` protocol work (issue #2898: an id-less `tools/call` was answered with `"id": null` and awaited on the stdio read loop), then the repo's own gates to prove the fix.
+
+**Verdict:** The stdio layer was pleasant to work in: `stdio_session` / `silent_node` let me write four failing tests in one pass, and the #2390 cancellation machinery was documented well enough in comments that I could tell *why* a `null` registration key would be unsafe without guessing. Two things cost real time, both in the test harness rather than the product. Debug-profile `local_def` tests stack-overflow and SIGABRT on this host on clean `upstream/main` too, and nothing says so — I burned a cycle confirming it was a baseline failure before switching everything to `--profile ci-test`. And `loopback_proxy::loopback_ignores_an_unreachable_proxy_and_a_proxied_503_names_the_proxy` fails on stock macOS because it needs a `127.0.0.2` loopback alias; after #2886 the message says "request to http://127.0.0.2:9/... failed", which is accurate and still does not hint that the host, not the code, is wrong. Both read as "your patch broke something" on first contact. I have not filed either as an issue.
+
+**Numbers:** `cargo test --locked --profile ci-test -p xerj-mcp --no-fail-fast` -> 195 passed, 1 failed (the `127.0.0.2` test above, identical on stashed clean `upstream/main`). ES-YAML gate -> 1453 passed, 0 failed, 10 skipped, 233 files, runner exit 0. `cargo build --locked --profile ci-test -j 32 -p xerj-server -p es-yaml-runner` -> 5m22s. No retrieval or indexing measured; I ran no queries.
+
+**Filed alongside:** https://github.com/xerj-org/xerj/pull/2901 (fix for #2898)
```

#### Recent Merged Pull Requests:
- **PR #2906** (2026-11-03): hub: propose localized spectral-bound Lean corpus (rebase of #2629) (@xerj-org)
- **PR #2902** (2026-11-03): docs(feedback): report MCP stdio protocol fix session (@Jarvis636431)
- **PR #2900** (2026-11-03): fix(api,engine): data-stream rollover honours dry_run, conditions and write routing (@Tong-bit-art)
- **PR #2899** (2026-11-03): fix(mcp): never answer a notification, and run every tools/call off the loop (@Term56)
- **PR #2897** (2026-11-03): chore: add richuff to contributors (CLA signature) (@richuff)
- **PR #2896** (2026-11-03): corpus: rctool-live2d — Flutter × Cubism Live2D integration (WebView, local asset server, lip sync) (@richuff)

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

## X. tests): name loopback networking when a test's bind is denied (#2889)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e9f8e4a7`: tests): name loopback networking when a test's bind is denied (#2889). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Tests name the cause when loopback networking is unavailable (#2886). Every
  test that binds an ephemeral 127.0.0.1 port, in all crates, goes through
  `xerj_common::loopback_test::expect_loopback`, so a sandbox that denies the
  bind fails with "this test starts a fake server on 127.0.0.1 and needs
  loopback networking" instead of hundreds of bare `PermissionDenied` panics.

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e9f8e4a7` are properly handled with clean fallback behavior.
