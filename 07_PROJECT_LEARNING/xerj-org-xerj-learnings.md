> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source**: github ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Source Version**: `7ba0069e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T05:28:25.430Z  
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
> **Harvest Timestamp**: 2026-11-24T05:28:25.422Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: AI search engine and MCP server for bots and agents. One Rust binary indexes code, docs, logs, JSONL/CSV and PDFs for BM25 full-text, vector and hybrid search, code search without grep, agent memory and RAG. Elasticsearch-compatible API; Corpus Hub serves hundreds of reference memory corpora.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 20270 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/agent-memory/score.py`
```
"""Score every results/*.json the same way and write summary.csv + summary.json.

A question is a hit@k when a returned memory among the top k contains the
answer string (case-insensitive, word boundaries). For update and distractor
questions, "correct first" means the first returned memory that contains
either the answer or the stale/wrong answer contains the answer (and the
answer appears in the top k). Stdlib only.
"""
import json, os, re, glob, statistics, csv

HERE = os.path.dirname(os.path.abspath(__file__))
ds = json.load(open(os.path.join(HERE, "dataset.json")))
QS = {q["id"]: q for q in ds["questions"]}

def has(text, s):
    return re.search(r"(?<![\w-])" + re.escape(s.lower()) + r"(?![\w-])", (text or "").lower()) is not None

def first_rank(hits, s):
    for i, h in enumerate(hits):
        if has(h, s):
            return i + 1
    return None

def pct(a):
    return round(100.0 * sum(a) / len(a), 1) if a else None

def p(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    i = min(len(xs) - 1, max(0, int(round(q / 100.0 * (len(xs) - 1)))))
    return round(xs[i], 2)

rows = []
per_q = []
for f in sorted(glob.glob(os.path.join(HERE, "results", "*.json"))):
    r = json.load(open(f))
    k = r["k"]
    by_type = {}
    h1_all, h5_all = [], []
    upd_ok, dis_ok = [], []
    for qr in r["questions"]:
        q = QS[qr["id"]]
        hits = qr["hits"]
        ra = first_rank(hits, q["answer"])
        h1 = ra == 1
        hk = ra is not None and ra <= k
        h1_all.append(h1); h5_all.append(hk)
        by_type.setdefault(q["type"], []).append((h1, hk))
        ok = None
        if q["stale"]:
            rs = first_rank(hits, q["stale"])
            ok = ra is not None and (rs is None or ra <= rs)
            (upd_ok if q["type"] == "update" else dis_ok).append(ok)
        per_q.append({"system": r["system"], "config": r["config"], "id": q["id"], "type": q["type"],
                      "answer_rank": ra, "hit1": h1, "hitk": hk, "correct_first": ok})
    qms = [x["ms"] for x in r["questions"]]
    row = {
        "system": r["system"], "config": r["config"],
        "version": r["meta"].get("version"), "commit": r["meta"].get("commit"),
        "llm": r["meta"].get("llm") or "none", "embedder": r["meta"].get("embedder") or "none",
        "hit_at_1_pct": pct(h1_all), "hit_at_5_pct": pct(h5_all),
    }
    for t in ("exact", "paraphrase", "update", "distractor"):
        v = by_type.get(t, [])
        row[f"{t}_hit5_pct"] = pct([b for _, b in v])
    row["update_newest_wins_pct"] = pct(upd_ok)
    row["distractor_correct_first_pct"] = pct(dis_ok)
    row["write_ms_p50"] = p(r["write_ms"], 50)
    row["write_ms_p95"] = p(r["write_ms"], 95)
    row["query_ms_p50"] = p(qms, 50)
    row["query_ms_p95"] = p(qms, 95)
    row["ingest_total_s"] = r["ingest_total_s"]
    row["llm_calls_per_write"] = r["meta"].get("llm_calls_per_write")
    row["run_at"] = r["run_at"]
    rows.append(row)

os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
if rows:
    with open(os.path.join(HERE, "out", "summary.csv"), "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    with open(os.path.join(HERE, "out", "per_question.csv"), "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(per_q[0].keys()))
        w.writeheader(); w.writerows(per_q)
    json.dump(rows, open(os.path.join(HERE, "out", "summary.json"), "w"), indent=1)
for r in rows:
    print(f'{r["system"]:<22}{r["config"]:<22} h@1 {r["hit_at_1_pct"]:>5}  h@5 {r["hit_at_5_pct"]:>5}  ex {r["exact_hit5_pct"]:>5} para {r["paraphrase_hit5_pct"]:>5} upd-new {r["update_newest_wins_pct"]:>5} dis {r["distractor_correct_first_pct"]:>5}  w50 {r["write_ms_p50"]:>8} q50 {r["query_ms_p50"]:>8} q95 {r["query_ms_p95"]:>8}')

```

### Core Architecture Module: `benchmarks/agent-search-ranking-2026-11/fixtures/pos/core/src/position.rs`
```
pub struct Position {
    pub symbol: String,
    pub qty: i64,
    pub open_price: f64,
    pub avg_price: f64,
}

impl Position {
    pub fn pnl(&self, last: f64) -> f64 { (last - self.avg_price) * self.qty as f64 }
}

```

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3496** (2026-11-23): **cluster_metadata_replicates: election/backfill wall-clock waits still fail at load ~150 (after #3494)**
  *Symptoms*: Residual of #3489 after PR #3494. That PR moves the metadata waits in `engine/crates/xerj-api/tests/cluster_metadata_replicates.rs` onto the raft applied index. At 12 runs at a time and load 53 -> 154, the whole file still failed 18 of 120 runs, all on wall-clock waits the applied index does not cover:  | wait | deadline | failures | |---|---|---| | `wait_leader` ("timed out waiting for one raft leader") | 10 s | 10 | | `wait_replica_title` (late member backfill) | 10 s | 9 | | `wait_refilled` (restarted replica refill) | 15 s | 5 | | async `_update_by_query` task poll (`update_by_query_from_a_non_owner_…`) | 5 s | 5 |  At 10 runs at a time (load 96 -> 117) the file passed 80 of 80.  Elections run on wall-clock timers, and backfill and refill run as async tasks off the raft step, so neither has a raft index to wait on. A deterministic fix needs an observable completion signal for each of them, for example a backfill or refill generation counter on the engine or handle that a test can wait on. Bumping these deadlines would only be a timeout bump. 

- **Issue #3491** (2026-11-23): **Flaky cold_topk_with_source_includes_reads_only_winning_rows: warm skipped on a shared, pinned hydration budget**
  *Symptoms*: `index::flush_publication_recovery_tests::cold_topk_with_source_includes_reads_only_winning_rows` (xerj-engine lib, #2422/#2423) fails with `background warm never landed` after its 30 s wait.  Measured on main 98e7681cb, ci-test profile, 10 processes at a time:  | what runs in the process | runs | failed | load (1m, start -> peak) | |---|---|---|---| | this test alone | 50 | 0 | 29.4 -> 29.4 | | this test + `fts_reader_displaces_decoded_sections_when_the_budget_is_full` | 50 | **11** | 27.9 -> 40.8 |  So load is not what triggers it; sharing the process with another test is.  Root cause: `schedule_cold_stored_warm` skips the warm when the hydration budget has no headroom for the segment's slices (`has_headroom(bound)`, #2427/#1122). That budget is process-wide (the governor's). `fts_reader_displaces_decoded_sections_when_the_budget_is_full` sets its target to its current `used` and never restores it, and any other test can fill it. The warm is then skipped every time, `all_cold` stays true, and the loop waits out its 30 s. A longer wait would not help: the warm never runs. 

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

### Incident Patch 1: `a7b82e8b` (2026-11-23)
**Commit Message**: test: hand-driven cold-GET fixture, event-joined cluster runners, #3510 doc comments on the right fns

Three cleanups left over from #3516, #3522 and #3498.

1. a_cold_get_reads_one_row_and_matches_the_full_decode flaked under load (#3530)

   Root cause: `built()` in get_row_decode_tests.rs lays out its
   segments with flush + force_merge(round + 1), and the asserts depend
   on that layout, but the index kept its background merge loop. At load
   150-300 a merge tick (5 s) landed between a flush and its force_merge.
   It merged everything into ONE segment (the `>= 2` assert), or left a
   124-doc legacy-LZ4 shard segment (the `ZBS` magic assert), once
   force_merge saw few enough segments to do nothing. Fix:
   `idx.abort_background_tasks()` after get_index, the same thing
   `hand_driven_index` does. No timeout changed.

   Before (main 53e4db0c1, ci-test, 96 CPU burners):
     alone, 60 runs x16 parallel, load 154-308: 36/60 failed
       (30 x `1 segments`, 6 x `124 docs, magic LZ4`)
     full --lib, 4 copies, --test-threads=16, load 213-225: 4/4 failed
   After:
     alone, 60 runs x16 parallel, load 217-350: 0/60 failed
     full --lib, 8 runs, 4 copies, load 206-366: 0/8

**File**: `engine/crates/xerj-api/tests/cluster_metadata_replicates.rs` (modified, +23/-12)
```diff
@@ -1333,6 +1333,27 @@ async fn a_document_is_stored_on_its_shard_owner_and_search_sees_it_from_any_mem
     }
 }
 
+/// Wait for a member's runner task to exit after its shutdown watch was set.
+///
+/// The runner races the shutdown watch against each step
+/// (`ClusterRunner::run`), so the join is the event: it resolves on the
+/// runner's next poll. It was a 5 s wall-clock join (left by #3516), which a
+/// runner starved at load 100+ can miss while still stopping correctly.
+/// [`RAFT_HANG_GUARD`] only catches a runner that never exits.
+async fn join_runner(member: &mut Member) {
+    let Some(task) = member.runner.take() else {
+        return;
+    };
+    match tokio::time::timeout(RAFT_HANG_GUARD, task).await {
+        Ok(Ok(())) => {}
+        Ok(Err(join)) => panic!("{} runner task failed: {join}", member.handle.node_id()),
+        Err(_) => panic!(
+            "{} runner did not exit in {RAFT_HANG_GUARD:?} after shutdown",
+            member.handle.node_id()
+        ),
+    }
+}
+
 /// Stop one member and release its data directory.
 ///
 /// The shard handler is cleared first, so a document write during shutdown
@@ -1342,12 +1363,7 @@ async fn a_document_is_stored_on_its_shard_owner_and_search_sees_it_from_any_mem
 async fn shutdown_member(mut member: Member) -> tempfile::TempDir {
     member.handle.clear_shard_handler();
     let _ = member.shutdown.send(true);
-    if let Some(task) = member.runner.take() {
-        match tokio::time::timeout(Duration::from_secs(5), task).await {
-            Ok(Ok(())) => {}
-            other => panic!("cluster runner did not stop: {other:?}"),
-        }
-    }
+    join_runner(&mut member).await;
     drop(member.app);
     drop(member.state);
     drop(member.engine);
@@ -1359,12 +1375,7 @@ async fn shutdown_and_keep(members: Vec<Member>) -> Vec<tempfile::TempDir> {
     let mut dirs = Vec::with_capacity(members.len());
     for mut member in members {
         let _ = member.shutdown.send(true);
-        if let Some(task) = member.runner.take() {
-            match tokio::time::timeout(Duration::from_secs(5), task).await {
-                Ok(Ok(())) => {}
-                other => panic!("cluster runner did not stop: {other:?}"),
-            }
-        }
+        join_runner(&mut member).await;
         // ApiShardHandler holds AppState, which holds Engine, which holds
         // this handle. The engine's data-dir node.lock stays taken until
         // that cycle breaks, so a later Engine::new on the same directory
```

**File**: `engine/crates/xerj-engine/src/get_row_decode_tests.rs` (modified, +8/-0)
```diff
@@ -38,6 +38,14 @@ async fn built(name: &str) -> (tempfile::TempDir, crate::Engine, Arc<Index>, usi
     let engine = crate::Engine::new(config).unwrap();
     engine.create_index(name, Schema::empty()).unwrap();
     let idx = engine.get_index(name).unwrap();
+    // Hand-driven: the segment layout below is what the asserts rely on, so
+    // no background merge tick may reshape it. At load 150-300 the build
+    // runs long enough for a tick (5 s) to land between a flush and its
+    // `force_merge`: 30 of 60 runs ended on ONE segment (the `>= 2` assert)
+    // and 6 kept a 124-doc legacy-LZ4 shard segment the tick left behind
+    // (the `ZBS` assert), once `force_merge(round + 1)` saw few enough
+    // segments to do nothing.
+    idx.abort_background_tasks();
     // A flush splits into one small segment per memtable shard, and a stored
     // section under 128 rows stays legacy LZ4 (the full-decode path), so each
     // round is merged into one columnar segment before the next is written.
```

**File**: `engine/crates/xerj-engine/src/index.rs` (modified, +10/-10)
```diff
@@ -11818,16 +11818,6 @@ mod semantic_deadline_regression_tests {
 #[path = "fast_aggs.rs"]
 mod fast_aggs;
 
-/// Reconstruct the ES-JSON form of a query filter that the columnar fast-agg
-/// path (`fast_aggs::compile_top_pred` + `aggs::doc_matches_filter`) can
-/// evaluate over doc-values WITHOUT hydrating `_source`.  Returns `None` for
-/// any query that isn't a plain conjunctive filter over exact/numeric fields
-/// (FTS, wild/prefix, must_not/should bool, numeric term keys on a field not
-/// mapped `long`/`double`, …) — the caller then keeps the exact brute path.
-///
-/// Only the leaf/bool shapes that `doc_matches_filter` and `compile_pred`
-/// jointly support are emitted, so the memtable matcher and the columnar
-/// predicate stay byte-identical.
 /// #3510: whether `q` is a pure conjunction (`bool` with only `must` /
 /// `filter`, nested, or under `constant_score`) whose every leaf passes
 /// `leaf_ok`. A leaf on its own is just checked. Used to admit a filter-only
@@ -11855,6 +11845,16 @@ fn filter_conjunction_leaves_all(q: &QueryNode, leaf_ok: &dyn Fn(&QueryNode) ->
     }
 }
 
+/// Reconstruct the ES-JSON form of a query filter that the columnar fast-agg
+/// path (`fast_aggs::compile_top_pred` + `aggs::doc_matches_filter`) can
+/// evaluate over doc-values WITHOUT hydrating `_source`.  Returns `None` for
+/// any query that isn't a plain conjunctive filter over exact/numeric fields
+/// (FTS, wild/prefix, must_not/should bool, numeric term keys on a field not
+/// mapped `long`/`double`, …) — the caller then keeps the exact brute path.
+///
+/// Only the leaf/bool shapes that `doc_matches_filter` and `compile_pred`
+/// jointly support are emitted, so the memtable matcher and the columnar
+/// predicate stay byte-identical.
 fn query_node_to_agg_filter(node: &QueryNode, schema: &Schema) -> Option<Value> {
     match node {
         QueryNode::MatchAll => Some(serde_json::json!({ "match_all": {} })),
```

---

### Incident Patch 2: `6308204d` (2026-11-23)
**Commit Message**: fix(search): filter-only bool scores 0, strict typed values 400, fvf missing value 400 (Fixes #3508, #3511, #3512)

Three ES-semantics gaps on the search path, each found by a live repro on
main 35584dccc (port 28100, throwaway data dir, --insecure) and each
pinned by a new ES-YAML file.

1. #3508: a filter-only bool scored 1.0 before a flush

Motivation
- `bool { filter: [...] }` (no must, no should) runs every clause in
  filter context; ES scores each hit 0.0. A must_not-only bool gets a
  match-all FILTER clause (`Queries.fixNegativeQueryIfNeeded`, read for
  semantics only) and also scores 0.0.

Root cause
- The segment executor (`scored_fast_plan` -> `ScoredPlan::Filtered`,
  score 0.0) was right. Two memtable-side paths were not:
  - the id-only memtable arms (`AllDocIds` / `DocValuesHits`, served
    by the fused doc-values walk) admit hits through `admit_hit!(count)`
    with a hard-coded 1.0;
  - `score_query_against_doc` (the brute scorer, used for every doc,
    segment docs included, once the memtable is non-empty) fell through
    to its 1.0 "zero sum" fallback.

Before / after (index sw: t text, n long, k keyword; 3 docs)
                                      memtabl

**File**: `CHANGELOG.md` (modified, +26/-3)
```diff
@@ -23,10 +23,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   `strict_date_optional_time||epoch_millis`, four digits are a year and any
   other integer is epoch millis. A `long` stored as `42.0` is found by `42`.
   A date match now uses the segment's doc values, so a query that mixes words
-  and a date or number keeps BM25 for its words there too. Known limit: when
+  and a date or number keeps BM25 for its words there too. Since #3511, when
   `lenient` is off (a `prefix*` pattern without `lenient: true`, or
-  `lenient: false`), ES returns 400 for a value that does not parse, and XERJ
-  skips the field.
+  `lenient: false`), a value that does not parse is a 400, as in ES.
 
 - **Object sub-fields get their own full-text index (#3464).** Each leaf of an
   `object` mapping (`meta.note`, `meta.tag`) is now indexed under its dotted
@@ -120,6 +119,30 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **A filter-only `bool` scores 0.0 before a flush too
+  ([#3508](https://github.com/xerj-org/xerj/issues/3508)).** A `bool` with
+  only `filter` and `must_not` clauses scored 1.0 while its docs sat in the
+  memtable, 0.0 once flushed, and 1.0 for every doc once one new doc was in
+  the memtable, so ordering changed at `_flush`. Every hit now scores 0.0, as
+  in Elasticsearch.
+
+- **A strict value of the wrong type on a boolean, ip or date field is a 400
+  ([#3511](https://github.com/xerj-org/xerj/issues/3511)).** `term`/`terms`,
+  and `match`, `multi_match` and `query_string` unless `lenient` is on,
+  answered 0 hits for `b: "abc"`, `ip: "abc"` or `d: "abc"`. They now answer
+  400 with the Elasticsearch root cause (`query_shard_exception` for boolean
+  and ip, `parse_exception` for date), as numeric fields have since #1284. A
+  `*` field list with an explicit `lenient: false` gets the same check.
+  `lenient: true`, and `*` or a field-less `query_string` without `lenient`,
+  still skip the field.
+
+- **`field_value_factor` with no `missing` fails on a doc without the field
+  ([#3512](https://github.com/xerj-org/xerj/issues/3512)).** Such a doc
+  scored 0.0. The search now answers 400 `illegal_argument_exception`
+  `Missing value for field [f]`, as Elasticsearch does, when a scored doc has
+  no value (an unmapped field counts). Set `missing` to keep the old ranking.
+  Counts (`size: 0`) and field-sorted pages are not scored and do not fail.
+
 - **A flush near the memory watermark no longer waits for the allocator purge
   ([#3493](https://github.com/xerj-org/xerj/issues/3493)).** From 70% of the
   watermark, a finished flush build returned its freed pages to the OS
```

**File**: `engine/crates/xerj-api/src/error.rs` (modified, +6/-2)
```diff
@@ -208,11 +208,15 @@ impl ApiError {
             // `failed to create query:` above — `query_shard_exception`
             // in root_cause, outer wrapper unchanged.
             "query_shard_exception".to_string()
-        } else if reason.starts_with("function score query returned an invalid score:") {
+        } else if reason.starts_with("function score query returned an invalid score:")
+            || reason.starts_with("Missing value for field [")
+        {
             // ES validates function_score results and raises
             // `illegal_argument_exception` with a 400 status when a
             // function produces a non-finite or negative score
-            // (e.g. ln1p on qty=-1 → ln(0) = -∞).
+            // (e.g. ln1p on qty=-1 → ln(0) = -∞), and when a
+            // `field_value_factor` with no `missing` scores a doc that has
+            // no value for its field.
             error_type = "illegal_argument_exception".into();
             status_code = 400;
             "illegal_argument_exception".to_string()
```

**File**: `engine/crates/xerj-api/tests/numeric_fields_enforce_their_type.rs` (modified, +18/-1)
```diff
@@ -549,12 +549,29 @@ async fn a_query_in_the_pre_coercion_spelling_still_matches_the_coerced_document
     for query in [
         json!({ "terms": { "b": ["false"] } }),
         json!({ "term": { "b": false } }),
-        json!({ "terms": { "b": ["yes"] } }),
         json!({ "terms": { "i": ["6"] } }),
     ] {
         let body = search(&app, "t", query.clone()).await;
         assert_eq!(hit_count(&body), 0, "{query} must not match: {body}");
     }
+
+    // #3511: a spelling a boolean field cannot read is a query ES cannot
+    // build, not an empty result.
+    let (status, body) = json_req(
+        &app,
+        "POST",
+        "/t/_search",
+        json!({ "query": { "terms": { "b": ["yes"] } } }),
+    )
+    .await;
+    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
+    assert_eq!(
+        body["error"]["root_cause"][0]["reason"],
+        json!(
+            "failed to create query: Can't parse boolean value [yes], expected [true] or [false]"
+        ),
+        "{body}"
+    );
 }
 
 /// An index that spans the upgrade holds BOTH representations of the same
```

**File**: `engine/crates/xerj-engine/src/index.rs` (modified, +338/-24)
```diff
@@ -3341,7 +3341,8 @@ mod flush_publication_recovery_tests {
                 &snap.segments,
                 &segments_dir,
                 10,
-                &schema
+                &schema,
+                &std::sync::OnceLock::new()
             )
             .is_some(),
             "an unmapped field with no column scores every row as missing"
@@ -3352,7 +3353,8 @@ mod flush_publication_recovery_tests {
                 &snap.segments,
                 &segments_dir,
                 10,
-                &schema
+                &schema,
+                &std::sync::OnceLock::new()
             )
             .is_none(),
             "a mapped field whose column was suppressed keeps the brute scan"
@@ -3363,7 +3365,8 @@ mod flush_publication_recovery_tests {
                 &snap.segments,
                 &segments_dir,
                 10,
-                &schema
+                &schema,
+                &std::sync::OnceLock::new()
             )
             .is_none(),
             "a non-numeric column keeps the brute scan"
@@ -3383,24 +3386,48 @@ mod flush_publication_recovery_tests {
                 (hits, r.total.value)
             }
         };
-        for missing in [json!(2.5), Value::Null] {
-            let mut f = json!({ "field": "nope" });
-            if !missing.is_null() {
-                f["missing"] = missing.clone();
-            }
-            let fast = page(json!({ "size": 12, "query": { "function_score": {
-                "query": { "match_all": {} }, "field_value_factor": f } } }))
-            .await;
-            let brute = page(
-                json!({ "size": 12, "min_score": 0, "query": { "function_score": {
-                "query": { "match_all": {} }, "field_value_factor": f } } }),
+        let f = json!({ "field": "nope", "missing": 2.5 });
+        let fast = page(json!({ "size": 12, "query": { "function_score": {
+            "query": { "match_all": {} }, "field_value_factor": f } } }))
+        .await;
+        let brute = page(
+            json!({ "size": 12, "min_score": 0, "query": { "function_score": {
+            "query": { "match_all": {} }, "field_value_factor": f } } }),
+        )
+        .await;
+        assert_eq!(fast.0.len(), 12);
+        assert!(fast.0.iter().all(|(_, s)| *s == 2.5), "{fast:?}");
+        assert_eq!(fast.0, brute.0);
+        assert_eq!(fast.0[0].0, "doc-0");
+
+        // With no `missing`, a doc without the field fails the request on
+        // both paths, as ES does (`Missing value for field [nope]`).
+        let missing = std::sync::OnceLock::new();
+        assert!(idx
+            .function_score_columnar(
+                &fvf("nope", None),
+                &snap.segments,
+                &segments_dir,
+                10,
+                &schema,
+                &missing
             )
-            .await;
-            let want: f32 = if missing.is_null() { 0.0 } else { 2.5 };
-            assert_eq!(fast.0.len(), 12);
-            assert!(fast.0.iter().all(|(_, s)| *s == want), "{fast:?}");
-            assert_eq!(fast.0, brute.0, "missing={missing}");
-            assert_eq!(fast.0[0].0, "doc-0");
+            .is_none());
+        assert_eq!(missing.get().map(String::as_str), Some("nope"));
+        for min_score in [Value::Null, json!(0)] {
+            let mut body = json!({ "size": 12, "query": { "function_score": {
+                "query": { "match_all": {} }, "field_value_factor": { "field": "nope" } } } });
+            if !min_score.is_null() {
+                body["min_score"] = min_score;
+            }
+            let err = idx
+                .search(&xerj_query::parse_request(&body).unwrap())
+                .await
+                .expect_err("no `missing` on an absent field must fail");
+            assert!(
+                err.to_string().contains("Missing value for field [nope]"),
+                "{err}"
+            );
         }
     }
 
@@ -27613,6 +27640,20 @@ impl Index {
             None
         };
         let fs_min_passed = std::sync::atomic::AtomicU64::new(0);
+        // #3512: a `field_value_factor` with no `missing` fails the request on
+        // the first scored doc without a value for its field, as ES does. ES
+        // only scores when the page is ranked by score (or `min_score` needs
+        // one), so a field sort or a count-only request does not fail. The
+        // scorer records the field; the request fails after the scan.
+        let fvf_needs_value: bool = matches!(
+            peeled_fs,
+            Some((QueryNode::FunctionScore { functions, .. }, _))
+                if functions.iter().any(|f| {
+                    f.field_value_factor.as_ref().is_some_and(|v| v.missing.is_none())
+                })
+        ) && ((size > 0 && !field_sort_active)
+            || request.min_score.is_some());
+        let fvf_missing_field = std::sync::OnceLock::<String>::new();
         // Population max over every score the brute scorer computes.
```

**File**: `engine/tests/es-compat-yaml/yaml/search/799_filter_only_bool_score.yml` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+# #3508: a `bool` with no `must` and no `should` runs every clause in filter
+# context, so ES scores each hit 0.0. XERJ scored 1.0 while the docs were in
+# the memtable, 0.0 once flushed, and 1.0 for every doc (segment docs too)
+# once one new doc sat in the memtable, so ordering changed at `_flush`.
+setup:
+  - do:
+      indices.create:
+        index: fob
+        body:
+          settings:
+            number_of_shards: 1
+          mappings:
+            properties:
+              t: { type: text }
+              n: { type: long }
+              k: { type: keyword }
+  - do:
+      bulk:
+        refresh: true
+        body:
+          - '{"index": {"_index": "fob", "_id": "1"}}'
+          - '{"t": "alpha", "n": 1, "k": "x"}'
+          - '{"index": {"_index": "fob", "_id": "2"}}'
+          - '{"t": "beta", "n": 2, "k": "x"}'
+          - '{"index": {"_index": "fob", "_id": "3"}}'
+          - '{"t": "gamma", "n": 3, "k": "y"}'
+
+---
+"filter-only bool scores 0.0 in the memtable":
+  - do:
+      search:
+        index: fob
+        body:
+          query: { bool: { filter: [ { range: { n: { gte: 1 } } } ] } }
+  - match: { hits.total.value: 3 }
+  - match: { hits.max_score: 0.0 }
+  - match: { hits.hits.0._score: 0.0 }
+  - match: { hits.hits.1._score: 0.0 }
+  - match: { hits.hits.2._score: 0.0 }
+
+  - do:
+      search:
+        index: fob
+        body:
+          query: { bool: { filter: [ { range: { n: { gte: 1 } } }, { term: { k: x } } ] } }
+  - match: { hits.total.value: 2 }
+  - match: { hits.hits.0._score: 0.0 }
+  - match: { hits.hits.1._score: 0.0 }
+
+  - do:
+      search:
+        index: fob
+        body:
+          query: { bool: { must_not: [ { term: { k: y } } ] } }
+  - match: { hits.total.value: 2 }
+  - match: { hits.hits.0._score: 0.0 }
+  - match: { hits.hits.1._score: 0.0 }
+
+---
+"filter-only bool scores 0.0 on segments and in mixed state":
+  - do:
+      indices.flush:
+        index: fob
+  - do:
+      search:
+        index: fob
+        body:
+          query: { bool: { filter: [ { range: { n: { gte: 1 } } } ] } }
+  - match: { hits.total.value: 3 }
+  - match: { hits.hits.0._score: 0.0 }
+  - match: { hits.hits.2._score: 0.0 }
+
+  - do:
+      index:
+        index: fob
+        id: "4"
+        refresh: true
+        body: { t: "delta", n: 4, k: "x" }
+  - do:
+      search:
+        index: fob
+        body:
+          query: { bool: { filter: [ { range: { n: { gte: 1 } } } ] } }
+  - match: { hits.total.value: 4 }
+  - match: { hits.max_score: 0.0 }
+  - match: { hits.hits.0._id: "1" }
+  - match: { hits.hits.0._score: 0.0 }
+  - match: { hits.hits.1._score: 0.0 }
+  - match: { hits.hits.2._score: 0.0 }
+  - match: { hits.hits.3._id: "4" }
+  - match: { hits.hits.3._score: 0.0 }
+
+  - do:
+      search:
+        index: fob
+        body:
+          query: { bool: { must_not: [ { term: { k: y } } ] } }
+  - match: { hits.total.value: 3 }
+  - match: { hits.hits.0._score: 0.0 }
+  - match: { hits.hits.2._score: 0.0 }
```

**File**: `engine/tests/es-compat-yaml/yaml/search/799_fvf_missing_value.yml` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+# A `field_value_factor` with no `missing` cannot score a doc that has no
+# value for its field: ES fails the search with `Missing value for field [f]`
+# (illegal_argument_exception, 400). XERJ scored that doc 0.0. With `missing`
+# set, or when no scored doc lacks the field, the search succeeds.
+setup:
+  - do:
+      indices.create:
+        index: fvfm
+        body:
+          settings:
+            number_of_shards: 1
+          mappings:
+            properties:
+              n: { type: long }
+              k: { type: keyword }
+  - do:
+      bulk:
+        refresh: true
+        body:
+          - '{"index": {"_index": "fvfm", "_id": "1"}}'
+          - '{"n": 2, "k": "x"}'
+          - '{"index": {"_index": "fvfm", "_id": "2"}}'
+          - '{"n": 3, "k": "x"}'
+          - '{"index": {"_index": "fvfm", "_id": "3"}}'
+          - '{"k": "y"}'
+
+---
+"no missing and a doc without the field is a 400":
+  - do:
+      catch: bad_request
+      search:
+        index: fvfm
+        body:
+          query:
+            function_score:
+              query: { match_all: {} }
+              field_value_factor: { field: n }
+  - match: { status: 400 }
+  - match: { error.root_cause.0.type: "illegal_argument_exception" }
+  - match: { error.root_cause.0.reason: "Missing value for field [n]" }
+
+  - do:
+      catch: bad_request
+      search:
+        index: fvfm
+        body:
+          query:
+            function_score:
+              query: { match_all: {} }
+              functions: [ { field_value_factor: { field: n } } ]
+              boost_mode: sum
+  - match: { error.root_cause.0.reason: "Missing value for field [n]" }
+
+  # Flushed: the doc-values path fails the same way.
+  - do:
+      indices.flush:
+        index: fvfm
+  - do:
+      catch: bad_request
+      search:
+        index: fvfm
+        body:
+          query:
+            function_score:
+              query: { match_all: {} }
+              field_value_factor: { field: n }
+  - match: { error.root_cause.0.reason: "Missing value for field [n]" }
+
+  - do:
+      catch: bad_request
+      search:
+        index: fvfm
+        body:
+          query:
+            function_score:
+              query: { match_all: {} }
+              field_value_factor: { field: unmapped_field }
+  - match: { error.root_cause.0.reason: "Missing value for field [unmapped_field]" }
+
+---
+"missing set, or every scored doc has the field, succeeds":
+  - do:
+      search:
+        index: fvfm
+        body:
+          query:
+            function_score:
+              query: { match_all: {} }
+              field_value_factor: { field: n, missing: 1 }
+  - match: { hits.total.value: 3 }
+  - match: { hits.hits.0._id: "2" }
+  - match: { hits.hits.0._score: 3.0 }
+  - match: { hits.hits.2._id: "3" }
+  - match: { hits.hits.2._score: 1.0 }
+
+  - do:
+      search:
+        index: fvfm
+        body:
+          query:
+            function_score:
+              query: { term: { k: x } }
+              field_value_factor: { field: n }
+              boost_mode: replace
+  - match: { hits.total.value: 2 }
+  - match: { hits.hits.0._id: "2" }
+  - match: { hits.hits.0._score: 3.0 }
+
+  # A function filter that excludes the doc without the field.
+  - do:
+      search:
+        index: fvfm
+        body:
+          query:
+            function_score:
+              query: { match_all: {} }
+              functions: [ { filter: { term: { k: x } }, field_value_factor: { field: n } } ]
+              boost_mode: replace
+  - match: { hits.total.value: 3 }
+  - match: { hits.hits.0._id: "2" }
+  - match: { hits.hits.0._score: 3.0 }
```

**File**: `engine/tests/es-compat-yaml/yaml/search/799_lenient_typed_fields.yml` (added, +214/-0)
```diff
@@ -0,0 +1,214 @@
+# A value that a boolean, ip or date field cannot read is a query ES cannot
+# build: `term`/`terms` always, and `match`/`multi_match`/`query_string` unless
+# `lenient` is on, answer 400. With `lenient: true` the field is skipped and
+# the request succeeds. XERJ answered a silent 0-hit 200 either way. Numeric
+# fields got the same rule in #1284 (720_non_numeric_term_value.yml).
+setup:
+  - do:
+      indices.create:
+        index: ltf
+        body:
+          settings:
+            number_of_shards: 1
+          mappings:
+            properties:
+              t: { type: text }
+              b: { type: boolean }
+              ip: { type: ip }
+              d: { type: date }
+              dy: { type: date, format: "yyyy-MM-dd" }
+  - do:
+      bulk:
+        refresh: true
+        body:
+          - '{"index": {"_index": "ltf", "_id": "1"}}'
+          - '{"t": "hello", "b": true, "ip": "10.0.0.1", "d": "2020-01-01", "dy": "2020-01-01"}'
+
+---
+"boolean field: a value that is not true/false is a 400 unless lenient":
+  - do:
+      catch: bad_request
+      search:
+        index: ltf
+        body:
+          query: { match: { b: { query: "abc", lenient: false } } }
+  - match: { status: 400 }
+  - match: { error.root_cause.0.type: "query_shard_exception" }
+  - match: { error.root_cause.0.reason: "failed to create query: Can't parse boolean value [abc], expected [true] or [false]" }
+
+  - do:
+      catch: bad_request
+      search:
+        index: ltf
+        body:
+          query: { term: { b: "abc" } }
+  - match: { error.root_cause.0.type: "query_shard_exception" }
+
+  - do:
+      catch: bad_request
+      search:
+        index: ltf
+        body:
+          query: { multi_match: { query: "abc", fields: [ "b", "t" ] } }
+  - match: { error.root_cause.0.type: "query_shard_exception" }
+
+  - do:
+      catch: bad_request
+      search:
+        index: ltf
+        body:
+          query: { query_string: { query: "b:abc", lenient: false } }
+  - match: { error.root_cause.0.type: "query_shard_exception" }
+
+  - do:
+      search:
+        index: ltf
+        body:
+          query: { match: { b: { query: "abc", lenient: true } } }
+  - match: { hits.total.value: 0 }
+
+  - do:
+      search:
+        index: ltf
+        body:
+          query: { multi_match: { query: "abc", fields: [ "b", "t" ], lenient: true } }
+  - match: { hits.total.value: 0 }
+
+  - do:
+      search:
+        index: ltf
+        body:
+          query: { query_string: { query: "b:abc", lenient: true } }
+  - match: { hits.total.value: 0 }
+
+  - do:
+      search:
+        index: ltf
+        body:
+          query: { match: { b: "true" } }
+  - match: { hits.total.value: 1 }
+
+---
+"ip field: a value that is not an address or CIDR block is a 400 unless lenient":
+  - do:
+      catch: bad_request
+      search:
+        index: ltf
+        body:
+          query: { match: { ip: "abc" } }
+  - match: { status: 400 }
+  - match: { error.root_cause.0.type: "query_shard_exception" }
+  - match: { error.root_cause.0.reason: "failed to create query: 'abc' is not an IP string literal." }
+
+  - do:
+      catch: bad_request
+      search:
+        index: ltf
+        body:
+          query: { term: { ip: "10.0.0.0/40" } }
+  - match: { error.root_cause.0.reason: "failed to create query: Illegal prefix length [40] in [10.0.0.0/40]. Must be 0-32 for IPv4 ranges, 0-128 for IPv6 ranges" }
+
+  - do:
+      catch: bad_request
+      search:
+        index: ltf
+        body:
+          query: { query_string: { query: "abc", fields: [ "ip", "t" ] } }
+  - match: { error.root_cause.0.type: "query_shard_exception" }
+
+  - do:
+      search:
+        index: ltf
+        body:
+          query: { match: { ip: { query: "abc", lenient: true } } }
+  - match: { hits.total.value: 0 }
+
+  - do:
+      search:
+        index: ltf
+        body:
+          query: { term: { ip: "10.0.0.0/8" } }
+  - match: { hits.total.value: 1 }
+
+---
+"date field: a value the format cannot parse is a 400 unless lenient":
+  - do:
+      catch: bad_request
+      search:
+        index: ltf
+        body:
+          query: { match: { d: "abc" } }
+  - match: { status: 400 }
+  - match: { error.root_cause.0.type: "parse_exception" }
+  - match: { error.root_cause.0.reason: "failed to parse date field [abc] with format [strict_date_optional_time||epoch_millis]: [failed to parse date field [abc] with format [strict_date_optional_time||epoch_millis]]" }
+
+  - do:
+      catch: bad_request
+      search:
+        index: ltf
+        body:
+          query: { match: { dy: "2020/01/01" } }
+  - match: { error.root_cause.0.type: "parse_exception" }
+  - match: { error.root_cause.0.reason: "failed to parse date field [2020/01/01] with format [yyyy-MM-dd]: [failed to parse date field [2020/01/01] with format [yyyy-MM-dd]]" }
+
+  - do:
+      catch: bad_request
+      search:
+        index: ltf
+        body:
+          query: { multi_m
```

---

### Incident Patch 3: `a2f18028` (2026-11-23)
**Commit Message**: fix(search): return empty hits for full-text queries on unmapped sub-fields (#3515)

Fixes #3515.

Before `_flush`, a bare `match` on an unmapped dotted sub-field such as
`title.raw` (where `title` is a dynamic `text` field with only `.keyword`)
missed the memtable FTS field filter and returned 0 hits. After `_flush`,
the segment FTS reader lacked `title.raw` and fell back to the stored-doc
scan (`doc_matches_query_typed`), whose `get_field_value` strips trailing
`.suffix` segments whenever the parent resolves to a scalar leaf — running
the query against the analysed parent `title` instead. `constant_score`
(and other doc-scan shapes) hit `get_field_value` on both sides of
`_flush`.

Root cause and fix:
- Add zero-allocation `declared_field_in` and `is_unmapped_leaf_subfield`
  in `engine/crates/xerj-engine/src/index.rs`: a dotted non-wildcard,
  non-metadata field is an unmapped leaf sub-field when it is not declared
  in `schema` itself and at least one dotted ancestor is declared as a
  non-container leaf (`FieldType` other than `Object` / `Nested`). Mapped
  multi-fields (`title.keyword`, explicit `title.raw`), object children
  (`obj.name`, open `object` / `flattened` leaves),

**File**: `engine/crates/xerj-api/tests/match_unmapped_subfield_empty.rs` (added, +410/-0)
```diff
@@ -0,0 +1,410 @@
+//! #3515: `match` (and other full-text queries) on an unmapped dotted sub-field
+//! (`title.raw`, where `title` is a dynamic `text` field with only `.keyword`)
+//! must return 0 hits on every path, before and after `_flush`, on `_search`
+//! and `_count`, as in ES.
+//!
+//! Before the fix, `match title.raw "fruit"` returned `[]` before `_flush` and
+//! `[1, 2]` after `_flush` (the segment FTS reader lacked `title.raw` and fell
+//! back to the stored-doc scan, whose `get_field_value` stripped `.raw` and ran
+//! the query against the analysed parent `title`), while `constant_score` over
+//! `match title.raw` hit the parent on both sides of `_flush`. Mapped
+//! multi-fields (`title.keyword`, or an explicit `title.raw`) keep their #3495
+//! behaviour.
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
+async fn req(app: &axum::Router, method: &str, path: &str, body: String) -> (StatusCode, Value) {
+    let response = app
+        .clone()
+        .oneshot(
+            Request::builder()
+                .method(method)
+                .uri(path)
+                .header("content-type", "application/json")
+                .body(Body::from(body))
+                .expect("request"),
+        )
+        .await
+        .expect("response");
+    let status = response.status();
+    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
+        .await
+        .expect("body");
+    (
+        status,
+        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
+    )
+}
+
+async fn ids(app: &axum::Router, index: &str, query: &Value) -> Vec<String> {
+    let (status, body) = req(
+        app,
+        "POST",
+        &format!("/{index}/_search"),
+        json!({"query": query, "size": 10}).to_string(),
+    )
+    .await;
+    assert_eq!(status, StatusCode::OK, "{query}: {body}");
+    let mut out: Vec<String> = body["hits"]["hits"]
+        .as_array()
+        .expect("hits")
+        .iter()
+        .map(|h| h["_id"].as_str().expect("_id").to_string())
+        .collect();
+    out.sort();
+    let (status, count) = req(
+        app,
+        "POST",
+        &format!("/{index}/_count"),
+        json!({"query": query}).to_string(),
+    )
+    .await;
+    assert_eq!(status, StatusCode::OK, "{query}: {count}");
+    assert_eq!(
+        count["count"].as_u64(),
+        Some(out.len() as u64),
+        "_count disagrees with _search for {query}"
+    );
+    out
+}
+
+async fn flush(app: &axum::Router, index: &str) {
+    let (status, body) = req(app, "POST", &format!("/{index}/_flush"), String::new()).await;
+    assert_eq!(status, StatusCode::OK, "flush {index}: {body}");
+}
+
+#[tokio::test]
+async fn match_on_unmapped_subfield_returns_empty_before_and_after_flush() {
+    let (app, _dir) = app().await;
+    let bulk = concat!(
+        "{\"index\":{\"_id\":\"1\"}}\n",
+        "{\"title\":\"Fruit\",\"obj\":{\"name\":\"Fruit\"}}\n",
+        "{\"index\":{\"_id\":\"2\"}}\n",
+        "{\"title\":\"fruit salad\",\"obj\":{\"name\":\"fruit salad\"}}\n",
+        "{\"index\":{\"_id\":\"3\"}}\n",
+        "{\"title\":\"FRUiT\",\"obj\":{\"name\":\"FRUiT\"}}\n",
+    );
+    let (status, body) = req(&app, "POST", "/nonorm/_bulk?refresh=true", bulk.to_string()).await;
+    assert_eq!(status, StatusCode::OK, "bulk: {body}");
+    assert_eq!(body["errors"], json!(false), "bulk: {body}");
+
+    let cases: Vec<(Value, Vec<&str>)> = vec![
+        // Issue #3515 table: unmapped `.raw` sub-field matches nothing on every path.
+        (json!({"match": {"title.raw": "fruit"}}), vec![]),
+        (json!({"match": {"title.raw": "Fruit Salad"}}), vec![]),
+        (
+            json!({"constant_score": {"filter": {"match": {"title.raw": "fRuIt"}}}}),
+            vec![],
+        ),
+        (
+            json!({"bool": {"filter": [{"match": {"title.raw": "fruit"}}]}}),
+            vec![],
+        ),
+        (
+            json!({"bool": {"must": [{"match": {"title": "fruit"}}], "filter": [{"match": {"title.raw": "fruit"}}]}}),
+            vec![],
+        ),
+        (
+            json!({"bool": {"must": [{"match": {"title": "fruit"}}], "must_not": [{"match": {"title.raw": "fruit"}}]}}),
+            vec!["1", "2", "3"],
+        ),
+        (
+            json!({"bool": {"should": [{"match": {"title.r
```

**File**: `engine/crates/xerj-engine/src/aggs.rs` (modified, +17/-4)
```diff
@@ -257,10 +257,15 @@ fn clause_targets_only_text(node: &QueryNode, schema: &Schema) -> bool {
     match node {
         QueryNode::Match { field, .. }
         | QueryNode::MatchPhrase { field, .. }
-        | QueryNode::MatchPhrasePrefix { field, .. }
-        | QueryNode::Term { field, .. }
-        | QueryNode::Terms { field, .. } => crate::index::declared_field(schema, field)
-            .is_some_and(|f| matches!(f.field_type, FieldType::Text)),
+        | QueryNode::MatchPhrasePrefix { field, .. } => {
+            crate::index::declared_field(schema, field)
+                .is_some_and(|f| matches!(f.field_type, FieldType::Text))
+                || crate::index::is_unmapped_leaf_subfield(schema, field)
+        }
+        QueryNode::Term { field, .. } | QueryNode::Terms { field, .. } => {
+            crate::index::declared_field(schema, field)
+                .is_some_and(|f| matches!(f.field_type, FieldType::Text))
+        }
         QueryNode::Bool {
             must,
             should,
@@ -7322,6 +7327,14 @@ pub(crate) fn doc_matches_filter(doc: &Value, filter: &Value) -> bool {
             "match" | "match_phrase" => {
                 if let Some(field_map) = query_body.as_object() {
                     for (field, expected) in field_map {
+                        let unmapped_subfield = FILTER_SCHEMA.with(|cell| {
+                            cell.borrow()
+                                .as_ref()
+                                .is_some_and(|s| crate::index::is_unmapped_leaf_subfield(s, field))
+                        });
+                        if unmapped_subfield {
+                            return false;
+                        }
                         let actual_values = extract_field_values(doc, field);
                         let expected_str = match expected {
                             Value::Object(o) => {
```

**File**: `engine/crates/xerj-engine/src/index.rs` (modified, +444/-56)
```diff
@@ -25846,10 +25846,13 @@ impl Index {
                 &schema.schema,
             );
             let typeless = crate::memtable::lexically_typeless_fields(&schema.schema);
-            let lowered = if typeless.is_empty() {
+            let lowered = if typeless.is_empty()
+                && (schema.schema.fields.is_empty()
+                    || !query_has_unmapped_leaf_subfield(&resolved, &schema.schema))
+            {
                 resolved
             } else {
-                lower_lexically_typeless_clauses(&resolved, &typeless)
+                lower_unsatisfiable_clauses(&resolved, &typeless, &schema.schema)
             };
             unwrap_single_clause_bool(lowered)
         };
@@ -27122,10 +27125,13 @@ impl Index {
             // the lowering the missing postings hand the clause to the
             // stored-doc scan. See `lower_lexically_typeless_clauses`.
             let typeless = crate::memtable::lexically_typeless_fields(&schema.schema);
-            let lowered = if typeless.is_empty() {
+            let lowered = if typeless.is_empty()
+                && (schema.schema.fields.is_empty()
+                    || !query_has_unmapped_leaf_subfield(&resolved, &schema.schema))
+            {
                 resolved
             } else {
-                lower_lexically_typeless_clauses(&resolved, &typeless)
+                lower_unsatisfiable_clauses(&resolved, &typeless, &schema.schema)
             };
             // #399 — and it belongs HERE for exactly the reason above: every
             // path decision below is made on the SHAPE of this tree, so a
@@ -52594,32 +52600,162 @@ fn lookup_vector_quantization(schema: &Schema, field: &str) -> Option<String> {
 /// `FieldConfig::fields` (object sub-paths and multi-fields). Returns `None`
 /// for anything the schema does not declare — dynamic fields have no declared
 /// mapping options to honour.
-pub(crate) fn declared_field<'a>(schema: &'a Schema, field: &str) -> Option<&'a FieldConfig> {
-    fn find<'a>(fields: &'a [FieldConfig], path: &[&str]) -> Option<&'a FieldConfig> {
-        if path.is_empty() {
-            return None;
+/// Zero-allocation dotted-path lookup through `FieldConfig::fields`, preferring
+/// the longest literal dotted key at each level (matching `get_field_value_parts`).
+fn declared_field_in<'a>(fields: &'a [FieldConfig], path: &str) -> Option<&'a FieldConfig> {
+    if path.is_empty() {
+        return None;
+    }
+    if let Some(fc) = fields.iter().find(|fc| fc.name == path) {
+        return Some(fc);
+    }
+    let mut end = path.len();
+    while let Some(dot) = path[..end].rfind('.') {
+        let head = &path[..dot];
+        let tail = &path[dot + 1..];
+        for fc in fields {
+            if fc.name == head {
+                if let Some(found) = declared_field_in(&fc.fields, tail) {
+                    return Some(found);
+                }
+            }
         }
-        // Prefer the longest dotted-key match starting at this level, matching
-        // `get_field_value_parts` so literal dotted field names in `Schema::fields`
-        // (such as `files_manifest.json_recorded_at` or its `.keyword`
-        // multi-field) resolve instead of failing with `No mapping found`.
-        for take in (1..=path.len()).rev() {
-            let candidate = path[..take].join(".");
-            let tail = &path[take..];
-            for fc in fields {
-                if fc.name == candidate {
-                    if tail.is_empty() {
-                        return Some(fc);
-                    }
-                    if let Some(found) = find(&fc.fields, tail) {
-                        return Some(found);
-                    }
+        end = dot;
+    }
+    None
+}
+
+pub(crate) fn declared_field<'a>(schema: &'a Schema, field: &str) -> Option<&'a FieldConfig> {
+    declared_field_in(&schema.fields, field)
+}
+
+/// True when `field` names an undeclared dotted sub-field under a declared
+/// non-container leaf field — e.g. `title.raw` when `title` is a dynamic
+/// `text` field whose only declared multi-field is `.keyword`, or
+/// `obj.name.raw` when `obj.name` is a leaf field without a `.raw`
+/// multi-field (#3515).
+///
+/// Ancestors typed `Object` or `Nested` are skipped: a dotted path under an
+/// object/nested mapping (such as `meta.owner` on an empty `object` mapping)
+/// names a JSON child key rather than a multi-field suffix and resolves
+/// directly against `_source`.
+pub(crate) fn is_unmapped_leaf_subfield(schema: &Schema, field: &str) -> bool {
+    if schema.fields.is_empty()
+        || !field.contains('.')
+        || field.contains('*')
+        || field.starts_with('_')
+    {
+        return false;
+    }
+    if declared_field_in(&schema.fields, field).is_some() {
+        return false;
+    }
+    for (idx, ch) in field.char_indices() {
+        if ch == '.' {
+            if let Some(ancestor) = declared_field_in(&schema.fields, &field[..idx]) {
+        
```

#### Recent Merged Pull Requests:
- **PR #3656** (2026-11-24): hub: author-approved contribution candidates (14302 repos) (@xerj-team)
- **PR #3654** (2026-11-24): hub: author-approved contribution candidates (14300 repos) (@xerj-team)
- **PR #3653** (2026-11-24): hub: author-approved contribution candidates (14296 repos) (@xerj-team)
- **PR #3651** (2026-11-23): hub: author-approved contribution candidates (14291 repos) (@xerj-team)
- **PR #3649** (2026-11-23): hub: author-approved contribution candidates (14193 repos) (@xerj-team)
- **PR #3648** (2026-11-23): hub: author-approved contribution candidates (14288 repos) (@xerj-team)

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

## X. test: hand-driven cold-GET fixture, event-joined cluster runners, #3510 doc comm

**RULE**:
When implementing operations in `engine/crates/xerj-api/tests/cluster_metadata_replicates.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a7b82e8b`: test: hand-driven cold-GET fixture, event-joined cluster runners, #3510 doc comments on the right fns. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `engine/crates/xerj-api/tests/cluster_metadata_replicates.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Wait for a member's runner task to exit after its shutdown watch was set.
///
/// The runner races the shutdown watch against each step
/// (`ClusterRunner::run`), so the join is the event: it resolves on the
/// runner's next poll. It was a 5 s wall-clock join (left by #3516), which a
/// runner starved at load 100+ can miss while still stopping correctly.
/// [`RAFT_HANG_GUARD`] only catches a runner that never exits.
async fn join_runner(member: &mut Member) {
    let Some(task) = member.runner.take() else {
        return;
    };
    match tokio::time::timeout(RAFT_HANG_GUARD, task).await {
        Ok(Ok(())) => {}
        Ok(Err(join)) => panic!("{} runner task failed: {join}", member.handle.node_id()),
        Err(_) => panic!(
            "{} runner did not exit in {RAFT_HANG_GUARD:?} after shutdown",
            member.handle.node_id()
        ),
    }
}

    join_runner(&mut member).await;
        join_runner(&mut member).await;
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    if let Some(task) = member.runner.take() {
        match tokio::time::timeout(Duration::from_secs(5), task).await {
            Ok(Ok(())) => {}
            other => panic!("cluster runner did not stop: {other:?}"),
        }
    }
        if let Some(task) = member.runner.take() {
            match tokio::time::timeout(Duration::from_secs(5), task).await {
                Ok(Ok(())) => {}
                other => panic!("cluster runner did not stop: {other:?}"),
            }
        }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a7b82e8b` are properly handled with clean fallback behavior.
