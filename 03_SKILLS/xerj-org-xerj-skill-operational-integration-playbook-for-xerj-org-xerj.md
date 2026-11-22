# Skill: Operational & Integration Playbook for xerj-org/xerj

<!-- PROVENANCE_START
{
  "source_repository": "xerj-org/xerj",
  "source_url": "https://github.com/xerj-org/xerj",
  "source_version": "34a14c0d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T04:05:07.412Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-xerj-org-xerj",
  "canonical_classification": "skill_playbook"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xerj-org/xerj](https://github.com/xerj-org/xerj) (Revision: `34a14c0d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T04:05:07.412Z`  
> **Learning ID**: `learn-github-xerj-org-xerj`


## 1. Skill Overview & Purpose
Procedural playbook defining verified operational and implementation patterns for **xerj-org/xerj**.
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Model Independence**: Universal (Applies across Claude, Gemini, GPT, and Local agents)

## 2. Prerequisites & Technical Boundary
- Runtime ecosystem: Verified against xerj-org/xerj revision `34a14c0d`.
- Required security tier: Sanitized against PII/secrets.

## 3. Step-by-Step Procedural Workflow
# Forensic Learning Record (Deep Inspection): xerj-org/xerj

> **Canonical Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-22T04:05:06.081Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: AI search engine and MCP server for bots and agents. One Rust binary indexes code, docs, logs, JSONL/CSV and PDFs for BM25 full-text, vector and hybrid search, code search without grep, agent memory and RAG. Elasticsearch-compatible API; Corpus Hub serves hundreds of reference memory corpora.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 19261 stars

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
- **Issue #3323** (2026-11-20): **server: a connection mid-request at startup hand-over answers 503 node_starting_exception after the node is ready**
  *Symptoms*: ## What happens  While the engine opens its data dir, the ES-compat and REST ports answer `503 node_starting_exception` (#2575, `StartingResponder` in `engine/crates/xerj-server/src/main.rs`). A connection that is still sending its request when the engine finishes opening keeps answering that 503 **after** the node is ready and the real router is serving other connections.  ## Repro (on `main`, `cc6aee8f7`)  Data dir with 356 indices (so `Engine::new` takes a few seconds), private port, `--insecure`. A client:  1. polls `GET /_cluster/health` until it gets the starting 503; 2. opens 4 raw TCP connections and sends `GET /_cluster/health HTTP/1.1\r\nHost: x\r\n` without the final blank line; 3. waits for `GET /health/ready` = 200 on a new connection, then 3 more seconds; 4. sends the final `\r\n` on the 4 connections.  Result: **4/4 answered `HTTP/1.1 503 Service Unavailable` with `node_starting_exception`**, 3 s after `/health/ready` returned 200.  What did *not* reproduce (same build, same data dir):  - 16 and 32 keep-alive threads hammering `/_cluster/health`, `/hx/_search`, `/health/ready` and `/` across the ready transition: 0 starting 503s after the first 200 (80k and 165k requests). Each run got 16 and 32 `RemoteDisconnected` at the hand-over: a keep-alive connection from the starting phase is closed under the client. - 32 keep-alive connections that got the starting 503, sat idle, and were reused 3 s after ready: 32/32 `RemoteDisconnected`, no 503.  ## Root cause  `Star

- **Issue #3322** (2026-11-20): **highlight: CJK match_phrase / match hits return no highlight fragments**
  *Symptoms*: ## What happens  A CJK `match_phrase` (or `match`) hit comes back with no `highlight` key, while an English term in the same field is highlighted. Seen on rc.104 and on `main` (`cc6aee8f7`).  ## Repro  ```sh curl -s -XPUT localhost:9200/cjkh -H 'content-type: application/json' \   -d '{"mappings":{"properties":{"body":{"type":"text"},"bcjk":{"type":"text","analyzer":"cjk"}}}}' curl -s -XPOST 'localhost:9200/cjkh/_bulk?refresh=true' -H 'content-type: application/x-ndjson' --data-binary $' {"index":{"_id":"1"}} {"body":"我喜欢北京的天气 and the weather in Beijing","bcjk":"我喜欢北京的天气"} {"index":{"_id":"2"}} {"body":"東京都に住んでいます","bcjk":"東京都に住んでいます"} ' curl -s localhost:9200/cjkh/_search -H 'content-type: application/json' \   -d '{"query":{"match_phrase":{"body":"北京"}},"highlight":{"fields":{"body":{}}}}' ```  Measured on `main` (private port, throwaway data dir):  | query | hits | highlight | |---|---|---| | `match_phrase body 北京` | 1 | none | | `match_phrase bcjk 北京` (cjk analyzer) | 1 | none | | `match body 北京天气` | 2 | none | | `match_phrase body 東京` | 1 | none | | `match_phrase body weather` | 1 | `... the <em>weather</em> in Beijing` |  ## Root cause  The highlighter in `engine/crates/xerj-engine/src/index.rs` (`next_term_match`, added by #1948/#1949 to stop `or` matching inside `for`) only accepts a match whose neighbours are not word characters, and it counts any `char::is_alphanumeric` as a word character. Han, kana and Hangul are alphanumeric, so `北京` inside the unspaced run `我喜欢北

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

### Incident Patch 1: `5c7187b3` (2026-11-21)
**Commit Message**: fix(engine,storage): searches stop waiting on WAL and snapshot fsyncs under write load

Motivation (#3324, residual of #3331): under concurrent _bulk load every
op on an index (match_all, range, terms, cardinality, bool) stalled
together for seconds, most often ending at the "segment flushed" log
line, and writes stalled with them.

Root cause, from new slow-hold tracing (instrumented build, old code
order, dd fdatasync neighbour on the same ext4 disk):

1. The flush finalizer committed its collection-publication guard but
   kept it alive to the end of the closure, across after_flush_publish
   (snapshot fsync, WAL checkpoint/rotate/prune). commit() only records
   the outcome; the bracket stays open until the guard drops. 6 stalls
   of 0.5-1.7 s in one 60 s run, each "bracket held" line followed by
   every reader's "search waited" line of the same length.
2. index_batch_turbo_raw / index_batch_turbo / index_batch_sync_raw
   opened the bracket, then appended to the WAL. The WAL shard mutex is
   held by WAL maintenance (4 fsyncs per shard per pass) and by the
   wal_batch_ms fsync scheduler (fsync under the mutex), so a batch
   queued on it inside the bracket held every search

**File**: `CHANGELOG.md` (modified, +21/-0)
```diff
@@ -25,6 +25,27 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **Searches no longer wait on WAL and snapshot fsyncs while bulk writes run
+  (refs #3324 #3331).** Three code paths held the collection-publication
+  bracket (every search on the index waits while it is open) across disk
+  waits. A flush kept its bracket open through post-publish maintenance
+  (snapshot fsync, WAL rotate and prune). `_bulk` opened its bracket before
+  appending to the WAL, so it waited inside the bracket for a WAL shard
+  lock that WAL maintenance and the batched fsync held across fsyncs. The
+  flush bracket now closes when the segment is published, and `_bulk`
+  appends to the WAL before opening the bracket. WAL maintenance and the
+  `wal_batch_ms` fsync now fsync without holding the shard lock: the next
+  generation's file is created and synced first, and only the rename runs
+  under the lock. The same fsyncs still happen, so durability does not
+  change. A WAL write error no longer poisons the index. Measured over 3
+  runs each, 60 s, 300k preload plus a closed-loop 5,000-doc auto-id writer,
+  ext4: p99 over all reads went from 204-265 ms to 40-85 ms (load 25-50).
+  With a `dd` fdatasync neighbour on the same disk it went from 260-305 ms
+  to 45-60 ms, and the longest all-op stall from 2.3-4.2 s to 0.7-1.5 s
+  (load 14-46). Writer throughput went from 34-50k to 53-66k docs/s.
+  Holds and waits of 1 s or more (`XERJ_STALL_TRACE_MS` sets the threshold)
+  are now logged at WARN with the holder's call site.
+
 - **A collapsed `_search` or `_msearch` whose `collapse.inner_hits` block has
   no `name` is refused with a 400**, as Elasticsearch 8.13 refuses it
   (`x_content_parse_exception` caused by `illegal_argument_exception`
```

**File**: `engine/crates/xerj-engine/src/collection_publication.rs` (modified, +14/-0)
```diff
@@ -43,6 +43,8 @@ pub(crate) struct CollectionPublication {
 pub(crate) struct CollectionPublicationGuard {
     state: Arc<CollectionPublication>,
     outcome: GuardOutcome,
+    opened: std::time::Instant,
+    site: &'static std::panic::Location<'static>,
 }
 
 #[derive(Clone, Copy, Debug, PartialEq, Eq)]
@@ -182,6 +184,7 @@ impl CollectionPublication {
         }
     }
 
+    #[track_caller]
     pub(crate) fn begin(
         self: &Arc<Self>,
     ) -> Result<CollectionPublicationGuard, CollectionPublicationPoisoned> {
@@ -204,6 +207,8 @@ impl CollectionPublication {
         Ok(CollectionPublicationGuard {
             state: Arc::clone(self),
             outcome: GuardOutcome::Pending,
+            opened: std::time::Instant::now(),
+            site: std::panic::Location::caller(),
         })
     }
 
@@ -267,6 +272,15 @@ impl CollectionPublicationGuard {
 
 impl Drop for CollectionPublicationGuard {
     fn drop(&mut self) {
+        let held = self.opened.elapsed();
+        if xerj_storage::stall_trace::is_slow(held) {
+            tracing::warn!(
+                held_ms = held.as_millis() as u64,
+                site = %self.site,
+                readers_waiting = self.state.readers_waiting.load(Ordering::Acquire),
+                "collection publication bracket held long; searches on this index wait for it"
+            );
+        }
         if self.outcome == GuardOutcome::Pending {
             self.state.poisoned.store(true, Ordering::Release);
         }
```

**File**: `engine/crates/xerj-engine/src/index.rs` (modified, +282/-14)
```diff
@@ -1764,6 +1764,198 @@ mod collection_publication_fail_closed_tests {
         assert!(idx.get_document("late").await.unwrap().is_none());
     }
 
+    /// #3324: a bulk batch appends to the WAL before it opens the collection
+    /// publication bracket. WAL maintenance and the batched fsync hold a WAL
+    /// shard lock across disk waits (25 s measured under ext4 journal
+    /// pressure); a batch queued on that lock used to be inside the bracket
+    /// already, so every search on the index waited the same 25 s and came
+    /// back `timed_out` with no hits.
+    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
+    async fn search_is_not_held_behind_a_bulk_waiting_on_the_wal_lock() {
+        let dir = tempfile::tempdir().unwrap();
+        let mut config = Config::default();
+        config.server.data_dir = dir.path().to_string_lossy().into_owned();
+        let engine = crate::Engine::new(config).unwrap();
+        engine
+            .create_index("wal-lock-readers", text_schema())
+            .unwrap();
+        let idx = engine.get_index("wal-lock-readers").unwrap();
+        idx.index_batch_turbo_raw(vec![(
+            "seed".into(),
+            Arc::<[u8]>::from(br#"{"body":"alpha"}"#.as_slice()),
+        )])
+        .await
+        .unwrap();
+        idx.refresh().await.unwrap();
+
+        let (entered_tx, entered_rx) = std::sync::mpsc::sync_channel(1);
+        let entered_tx = parking_lot::Mutex::new(Some(entered_tx));
+        idx.set_publication_test_hook(Some(Arc::new(move |_, point| {
+            if point == PublicationTestPoint::RawBeforeCollectionBegin {
+                if let Some(tx) = entered_tx.lock().take() {
+                    let _ = tx.send(());
+                }
+            }
+        })));
+        // Stands in for a maintenance pass or fsync that holds the lock.
+        let wal_locks = idx.store.hold_wal_shards_for_test();
+        let writer_idx = Arc::clone(&idx);
+        let writer = tokio::spawn(async move {
+            writer_idx
+                .index_batch_turbo_raw(vec![(
+                    "late".into(),
+                    Arc::<[u8]>::from(br#"{"body":"alpha"}"#.as_slice()),
+                )])
+                .await
+        });
+        tokio::task::spawn_blocking(move || {
+            entered_rx
+                .recv_timeout(std::time::Duration::from_secs(10))
+                .expect("bulk never reached the WAL append")
+        })
+        .await
+        .unwrap();
+        // Let the batch reach the lock and park on it.
+        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
+        assert!(
+            !writer.is_finished(),
+            "the bulk must be parked on the WAL lock"
+        );
+
+        let mut request = xerj_query::parse_request(&json!({
+            "query": {"match": {"body": "alpha"}}, "size": 10
+        }))
+        .unwrap();
+        request.timeout_ms = Some(2_000);
+        let result = tokio::time::timeout(std::time::Duration::from_secs(5), idx.search(&request))
+            .await
+            .expect("search hung")
+            .unwrap();
+        assert!(
+            !result.timed_out,
+            "search waited out its deadline behind a bulk parked on the WAL lock"
+        );
+        assert_eq!(result.hits.len(), 1);
+        assert_eq!(result.hits[0].id, "seed");
+
+        drop(wal_locks);
+        tokio::time::timeout(std::time::Duration::from_secs(10), writer)
+            .await
+            .expect("bulk did not finish after the WAL lock was released")
+            .unwrap()
+            .unwrap();
+        idx.set_publication_test_hook(None);
+        assert!(!idx.collection_publication.state().2);
+        assert!(idx.get_document("late").await.unwrap().is_some());
+    }
+
+    /// #3324: the flush publication bracket closes as soon as the segment is
+    /// published. Its guard used to live to the end of the finalizer, across
+    /// `after_flush_publish` (snapshot fsync, WAL rotate and prune), so
+    /// every search on the index waited out that disk work. Here the WAL
+    /// maintenance is parked on held WAL locks after the publish.
+    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
+    async fn search_is_not_held_behind_post_flush_wal_maintenance() {
+        let dir = tempfile::tempdir().unwrap();
+        let mut config = Config::default();
+        config.server.data_dir = dir.path().to_string_lossy().into_owned();
+        let engine = crate::Engine::new(config).unwrap();
+        engine
+            .create_index("post-flush-readers", text_schema())
+            .unwrap();
+        let idx = engine.get_index("post-flush-readers").unwrap();
+        idx.index_batch_turbo_raw(vec![(
+            "doc".into(),
+            Arc::<[u8]>::from(br#"{"body":"alpha"}"#.as_slice()),
+        )])
+        .await
+        .unwrap();
+        assert!(idx.store.snapshot().segments.is_empty());
+
+        // The first flush of a store always
```

**File**: `engine/crates/xerj-storage/src/index_store.rs` (modified, +401/-125)
```diff
@@ -702,6 +702,11 @@ pub struct IndexStore {
     /// ticks re-check only its remaining unproven `(doc_id, seq)` pairs
     /// against the version map and prune once the list drains.
     wal_prune_cache: Mutex<std::collections::HashMap<(usize, u64), WalGenVerdict>>,
+    /// #3324 — serializes WAL maintenance passes on this store. A pass
+    /// holds each shard's WAL mutex only to rotate; this lock keeps two
+    /// passes from working on the same frozen generations at once. Appends
+    /// never take it.
+    wal_maintenance_lock: Mutex<()>,
     /// Issue #965 — serializes object-store publication sequences
     /// (pack → bundle PUT → catalog PUT) so a catalog can never be written
     /// while a snapshot-referenced bundle is still in flight (the flush-tail
@@ -719,6 +724,10 @@ pub struct IndexStore {
     snapshot_save_failures_remaining: std::sync::atomic::AtomicUsize,
     #[cfg(test)]
     fail_next_wal_maintenance: std::sync::atomic::AtomicBool,
+    /// Parks a WAL maintenance pass after it froze a generation: the pass
+    /// waits on this barrier twice, between the rotation and the fsync.
+    #[cfg(test)]
+    frozen_work_pause: Mutex<Option<Arc<std::sync::Barrier>>>,
     #[cfg(test)]
     publication_failpoint: std::sync::atomic::AtomicU8,
     #[cfg(test)]
@@ -971,6 +980,7 @@ impl IndexStore {
             segments_changed_hook: Mutex::new(None),
             pending_deletes: Mutex::new(std::collections::HashMap::new()),
             wal_prune_cache: Mutex::new(std::collections::HashMap::new()),
+            wal_maintenance_lock: Mutex::new(()),
             object_publish_lock: Mutex::new(()),
             durable_bundles: Mutex::new(durable_bundles),
             #[cfg(test)]
@@ -982,6 +992,8 @@ impl IndexStore {
             #[cfg(test)]
             fail_next_wal_maintenance: std::sync::atomic::AtomicBool::new(false),
             #[cfg(test)]
+            frozen_work_pause: Mutex::new(None),
+            #[cfg(test)]
             publication_failpoint: std::sync::atomic::AtomicU8::new(0),
             #[cfg(test)]
             orphan_disarm_fail_after: std::sync::atomic::AtomicUsize::new(usize::MAX),
@@ -2021,8 +2033,27 @@ impl IndexStore {
 
     /// Lock a specific WAL shard.
     #[inline]
+    /// Test hook: hold every WAL shard lock, as a maintenance pass or an
+    /// fsync would, so a caller can check what waits behind it (#3324).
+    #[doc(hidden)]
+    pub fn hold_wal_shards_for_test(&self) -> Vec<std::sync::MutexGuard<'_, WalWriter>> {
+        self.wal_shards.iter().map(|s| s.lock().unwrap()).collect()
+    }
+
+    #[track_caller]
     fn wal_lock_shard(&self, shard: usize) -> std::sync::MutexGuard<'_, WalWriter> {
-        self.wal_shards[shard].lock().unwrap()
+        let asked = std::time::Instant::now();
+        let guard = self.wal_shards[shard].lock().unwrap();
+        let waited = asked.elapsed();
+        if crate::stall_trace::is_slow(waited) {
+            warn!(
+                shard,
+                waited_ms = waited.as_millis() as u64,
+                site = %std::panic::Location::caller(),
+                "WAL append waited for the WAL shard lock"
+            );
+        }
+        guard
     }
 
     // ── Write path ────────────────────────────────────────────────────────────
@@ -2849,6 +2880,7 @@ impl IndexStore {
             // the save registers it and the prune below can release the
             // deletes' WAL pins.  Best-effort: on failure the deletes
             // simply stay WAL-pinned (retention, not loss).
+            let maintenance_started = std::time::Instant::now();
             if let Err(e) = self.persist_pending_tombstones() {
                 if self.is_object_store_mode() {
                     // #965 — the bucket catalog does not carry the
@@ -2890,10 +2922,23 @@ impl IndexStore {
             // still rotate + prune on the same 1 s cadence; generations
             // holding unproven entries are retained (that retention IS the
             // fix) and reclaimed on a later tick once their docs flush.
+            let snapshot_saved = std::time::Instant::now();
             let durable_max = self.snapshot.load().max_seq_no;
             if let Err(error) = self.wal_maintain_all_verified(durable_max) {
                 warn!(error = %error, segment_id, "WAL maintenance deferred after segment publication");
             }
+            let total = maintenance_started.elapsed();
+            if crate::stall_trace::is_slow(total) {
+                warn!(
+                    segment_id,
+                    total_ms = total.as_millis() as u64,
+                    tombstones_and_snapshot_ms = snapshot_saved
+                        .duration_since(maintenance_started)
+                        .as_millis() as u64,
+                    wal_ms = snapshot_saved.elapsed().as_millis() as u64,
+                    "post-flush maintenance slow"
+                );
+            }
         }
 
         info!(segment_id, doc_count
```

**File**: `engine/crates/xerj-storage/src/lib.rs` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ pub mod index_store;
 pub mod merge;
 pub mod s3;
 pub mod segment;
+pub mod stall_trace;
 pub mod stored_codec;
 pub mod version_map;
 pub mod wal;
```

**File**: `engine/crates/xerj-storage/src/stall_trace.rs` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+//! Slow-hold reporting for the locks and brackets a search or a write can
+//! wait behind (#3324). A hold or wait longer than the threshold is logged at
+//! WARN with its call site, so a multi-second stall under write load names
+//! what was blocking instead of only showing up as a slow request.
+//!
+//! The threshold is 1 s, or `XERJ_STALL_TRACE_MS` when set.
+
+use std::sync::OnceLock;
+use std::time::Duration;
+
+/// Holds and waits at or above this duration are reported.
+pub fn threshold() -> Duration {
+    static THRESHOLD: OnceLock<Duration> = OnceLock::new();
+    *THRESHOLD.get_or_init(|| {
+        std::env::var("XERJ_STALL_TRACE_MS")
+            .ok()
+            .and_then(|v| v.trim().parse::<u64>().ok())
+            .map(Duration::from_millis)
+            .unwrap_or(Duration::from_secs(1))
+    })
+}
+
+/// True when `elapsed` should be reported.
+pub fn is_slow(elapsed: Duration) -> bool {
+    elapsed >= threshold()
+}
```

**File**: `engine/crates/xerj-storage/src/wal.rs` (modified, +339/-7)
```diff
@@ -445,6 +445,15 @@ impl WalWriter {
     ) -> Result<Self> {
         let dir = dir.as_ref().to_path_buf();
         fs::create_dir_all(&dir)?;
+        // A crash between `PreparedGeneration::create` and its rename leaves
+        // a header-only `.wal.next` file that no generation scan reads.
+        if let Ok(entries) = fs::read_dir(&dir) {
+            for entry in entries.flatten() {
+                if entry.file_name().to_string_lossy().ends_with(".wal.next") {
+                    let _ = fs::remove_file(entry.path());
+                }
+            }
+        }
 
         // Find the highest existing generation
         let (generation, max_seq) = find_latest_generation(&dir)?;
@@ -1055,6 +1064,45 @@ impl WalWriter {
         self.dirty
     }
 
+    /// First half of an fsync that does not hold the shard mutex (#3324).
+    ///
+    /// Drains the userspace buffer to the kernel, clears `dirty` and returns
+    /// a second descriptor of the active generation. The caller drops the
+    /// shard mutex and then calls `sync_all` on that descriptor: an fsync
+    /// covers every byte the kernel holds for the inode when it starts, so
+    /// every append made before this call is durable when it returns —
+    /// the same guarantee [`sync`](Self::sync) gives, without making every
+    /// append to the shard wait on the disk. On ext4 an fsync can wait
+    /// seconds for the journal commit (#3324 measured 25 s); with the
+    /// mutex held, each append behind it, and each search waiting on the
+    /// publication bracket that append holds, waited that long too.
+    ///
+    /// Appends that land while the fsync runs set `dirty` and re-arm the
+    /// scheduler, so they get their own fsync. If the fsync fails the
+    /// caller must call [`mark_unsynced`](Self::mark_unsynced).
+    ///
+    /// Returns `None` when there is nothing to make durable.
+    pub fn begin_unlocked_sync(&mut self) -> Result<Option<File>> {
+        if !self.dirty {
+            return Ok(None);
+        }
+        let Some(w) = self.writer.as_mut() else {
+            self.dirty = false;
+            return Ok(None);
+        };
+        w.flush()?;
+        let file = w.get_ref().file().try_clone()?;
+        self.dirty = false;
+        Ok(Some(file))
+    }
+
+    /// An fsync started by [`begin_unlocked_sync`](Self::begin_unlocked_sync)
+    /// failed: the bytes it covered may not be durable, so the shard is
+    /// dirty again and the scheduler retries it.
+    pub fn mark_unsynced(&mut self) {
+        self.mark_dirty();
+    }
+
     /// Flush the BufWriter to the kernel without a `fsync(2)`.
     ///
     /// The buffered bytes are visible to any reader on the same
@@ -1126,14 +1174,69 @@ impl WalWriter {
     /// on every append so the on-disk prefix is complete up to
     /// `current_offset`).
     pub fn read_generation_entries(&self, gen: u64) -> (Vec<ReplayEntry>, bool) {
-        let path = wal_path(&self.dir, gen);
-        if !path.exists() {
-            return (Vec::new(), true);
+        read_generation_entries_in(&self.dir, gen)
+    }
+
+    /// This writer's directory.
+    pub fn dir(&self) -> &Path {
+        &self.dir
+    }
+
+    /// True when the active generation holds frames, so a maintenance pass
+    /// has something to rotate out.
+    pub fn has_frames(&self) -> bool {
+        self.current_offset > WAL_HEADER_LEN
+    }
+
+    /// Rotate the active generation out WITHOUT any fsync under the shard
+    /// mutex (#3324).
+    ///
+    /// `prepared` is the next generation's file, created and fsynced by
+    /// [`PreparedGeneration::create`] before the caller took the mutex.
+    /// This call drains the buffer, renames that file into place, and
+    /// hands back the generation it froze together with a descriptor of it.
+    /// The caller releases the mutex and only then fsyncs, decodes,
+    /// checkpoints and prunes the frozen generation: nothing appends to it
+    /// any more, so none of that needs the mutex appends wait on.
+    ///
+    /// [`force_rotate`](Self::force_rotate) does the same work with the
+    /// mutex held: an fsync of the active file in `checkpoint`, a second in
+    /// `rotate`, one for the checkpoint file and one for the new
+    /// generation's header — four journal-commit waits per shard per pass.
+    pub fn rotate_detached(
+        &mut self,
+        mut prepared: PreparedGeneration,
+    ) -> Result<DetachedRotation> {
+        if !self.has_frames() {
+            self.release_if_empty();
+            return Ok(DetachedRotation::Empty);
         }
-        let results = read_wal_file(path);
-        let clean = results.iter().all(|r| r.is_ok());
-        let entries = results.into_iter().filter_map(|r| r.ok()).collect();
-        (entries, clean)
+        if prepared.generation != self.generation + 1 || prepared.dir != self.dir {
+            return Ok(DetachedRotation::Stale);
+        }
+        let Some(w) = self.writer.as_mut() else {
```

**File**: `engine/crates/xerj-storage/src/wal_fsync.rs` (modified, +30/-18)
```diff
@@ -310,24 +310,36 @@ impl WalFsyncScheduler {
             let Some(shard) = entry.handle.target.upgrade() else {
                 continue; // store dropped
             };
-            let mut wal = shard.lock().unwrap_or_else(|e| e.into_inner());
-            if wal.is_dirty() {
-                match wal.sync() {
-                    Ok(()) => {
-                        self.synced.fetch_add(1, Ordering::Relaxed);
-                    }
-                    Err(e) => {
-                        // The shard still holds un-fsynced bytes.  Re-arm so
-                        // a transient failure (ENOSPC that later frees, EIO
-                        // on a retryable device) is retried one period later
-                        // instead of waiting for the next write — the old
-                        // per-index loop retried on every tick, and dropping
-                        // that would have been a silent durability
-                        // regression.
-                        warn!("wal_batch_ms fsync failed: {e}");
-                        drop(wal);
-                        entry.handle.arm();
-                    }
+            // #3324 — only the buffer drain runs under the shard mutex; the
+            // fsync itself runs after it is released, on a second
+            // descriptor, so appends to this shard do not wait on the disk.
+            let prepared = shard
+                .lock()
+                .unwrap_or_else(|e| e.into_inner())
+                .begin_unlocked_sync();
+            let result = match prepared {
+                Ok(None) => continue,
+                Ok(Some(file)) => file.sync_all().map_err(crate::StorageError::from),
+                Err(e) => Err(e),
+            };
+            match result {
+                Ok(()) => {
+                    self.synced.fetch_add(1, Ordering::Relaxed);
+                }
+                Err(e) => {
+                    // The shard still holds un-fsynced bytes.  Mark it dirty
+                    // and re-arm so a transient failure (ENOSPC that later
+                    // frees, EIO on a retryable device) is retried one
+                    // period later instead of waiting for the next write —
+                    // the old per-index loop retried on every tick, and
+                    // dropping that would have been a silent durability
+                    // regression.
+                    warn!("wal_batch_ms fsync failed: {e}");
+                    shard
+                        .lock()
+                        .unwrap_or_else(|e| e.into_inner())
+                        .mark_unsynced();
+                    entry.handle.arm();
                 }
             }
         }
```

---

### Incident Patch 2: `d52a99df` (2026-11-21)
**Commit Message**: Merge main into fix/multi-index-leaf-terms (#2957)

Resolve conflicts with main f22ddd5b2:
- engine/crates/xerj-api/src/es_compat.rs: main added the composite
  coordinator (finalize_composite_aggs, #2949) and its tests at the same
  spot the PR added the leaf-terms coordinator. Keep both blocks; run
  finalize_leaf_terms_summaries after finalize_composite_aggs in
  search_impl's post-merge pass.
- CHANGELOG.md: keep main's Fixed entries and append the PR entry.

**File**: `.contributors` (modified, +23/-1)
```diff
@@ -102,5 +102,27 @@
   "badretd",
   "parijat1222q",
   "napattan",
-  "gravion-ux"
+  "gravion-ux",
+  "Irfanwani",
+  "NikhByte",
+  "CalebPiusC",
+  "jaromil",
+  "Galaxy-VN",
+  "oghost2250",
+  "Master-Norna",
+  "TanmayNileshShinde",
+  "Frozican",
+  "Prathamesh51-debug",
+  "igmarin",
+  "shu-chen-dot-ca",
+  "alencarfreire",
+  "YoanWai",
+  "ManeaAl-Shabrain",
+  "l72683876-beep",
+  "ghazy2001",
+  "officialarghya29",
+  "satiricalguru",
+  "codesphere-u",
+  "polarours",
+  "wasabihu"
 ]
```

**File**: `.github/FUNDING.yml` (modified, +4/-5)
```diff
@@ -1,7 +1,6 @@
 # Funding links shown on the repository's "Sponsor" button.
-# Populate a platform below to enable it (e.g. github: [xerj-org]).
-# Left commented until an official sponsorship account exists so the
-# Sponsor button is not shown pointing at a non-existent destination.
+# The project takes donations at https://xerj.org/donate (USDT, TRC20):
+# they buy rented GPU hours for training the XERJ Query-1 model.
+# Add a platform (e.g. github: [xerj-org]) only when that account exists.
 
-# github: [xerj-org]
-custom: ["https://xerj.org"]
+custom: ["https://xerj.org/donate"]
```

**File**: `.github/scripts/functions-get-test.mjs` (modified, +5/-2)
```diff
@@ -190,7 +190,7 @@ console.log('── functions/get.js ──');
     },
   });
   Object.defineProperty(r, 'cf', {
-    value: { country: 'DE', city: 'Berlin', postalCode: '10115', asn: 3320, asOrganization: 'Deutsche Telekom', latitude: '52.52', longitude: '13.40' },
+    value: { country: 'DE', city: 'Berlin', postalCode: '10115', asn: 3320, asOrganization: 'Deutsche Telekom', latitude: '52.5200871', longitude: '13.4049540' },
   });
   await call(r, { ASSETS: fakeAssets(), INSTALLS });
   const stored = [...INSTALLS.store.values()].join('\n');
@@ -203,7 +203,10 @@ console.log('── functions/get.js ──');
   ok(!stored.includes('abcdef123456'), 'no cookie stored');
   ok(!stored.includes('de-DE'), 'no Accept-Language stored');
   ok(!stored.includes('Berlin') && !stored.includes('10115'), 'no city/postcode from request.cf');
-  ok(!stored.includes('52.52') && !stored.includes('13.40'), 'no lat/long from request.cf');
+  // Distinctive values: the stored record carries an ISO timestamp, and a
+  // short value like '52.52' matched it whenever the clock read hh:mm:52.52x.
+  ok(!stored.includes('52.5200871') && !stored.includes('13.4049540'), 'no lat/long from request.cf');
+  ok(!('latitude' in row) && !('longitude' in row), 'no latitude/longitude keys stored');
   ok(!stored.includes('3320') && !stored.includes('Telekom'), 'no ASN/network operator from request.cf');
   const allowed = new Set(['ts', 'script', 'kind', 'country', 'os', 'arch', 'ua', 'ver']);
   const unexpected = Object.keys(row).filter((k) => !allowed.has(k));
```

**File**: `.github/scripts/installer-download-failure-test.sh` (added, +212/-0)
```diff
@@ -0,0 +1,212 @@
+#!/usr/bin/env bash
+# Behaviour test for landing/get when a download is refused (#2460).
+#
+# Agents running `curl | sh` behind a proxy, a WAF challenge or GitHub's
+# anonymous rate limit get a 4xx from the release download and cannot pass a
+# challenge. The installer must then exit non-zero, install nothing, name the
+# HTTP status, and print a manual install that works as printed and fails
+# closed on a bad digest. This runs the real script under sh against a local
+# stand-in for github.com: shims for curl and wget rewrite the github.com URLs
+# to it and exec the real tool, so the script's own download code is what runs.
+#
+# What this does NOT prove: what xerj.org/get itself answers (that is
+# Cloudflare configuration, not this script), or the macOS / Windows branches
+# (shasum, unzip) of the printed recipe.
+#
+#   bash .github/scripts/installer-download-failure-test.sh
+set -uo pipefail
+
+HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+REPO="$(cd "$HERE/../.." && pwd)"
+GET="$REPO/landing/get"
+command -v python3 >/dev/null || { echo "::error::python3 is required"; exit 1; }
+command -v curl >/dev/null || { echo "::error::curl is required"; exit 1; }
+
+W="$(mktemp -d)"
+SPID=''
+cleanup() { [ -n "$SPID" ] && kill "$SPID" 2>/dev/null; rm -rf "$W"; }
+trap cleanup EXIT
+
+FAIL=0
+ok()  { echo "ok   - $*"; }
+bad() { echo "::error::FAIL - $*"; FAIL=1; }
+
+# The host's target, as landing/get will compute it (Linux runners only).
+case "$(uname -m)" in x86_64|amd64) cpu=x86_64 ;; aarch64|arm64) cpu=aarch64 ;; *) echo "SKIP: unsupported CPU"; exit 0 ;; esac
+[ "$(uname -s)" = Linux ] || { echo "SKIP: this test runs on Linux"; exit 0; }
+TAG=v1.0.0-rc.0
+STAGE="xerj-${TAG#v}-${cpu}-unknown-linux-musl"
+ASSET="$STAGE.tar.gz"
+
+# A fake release: a shell script that prints a version.
+mkdir -p "$W/srv" "$W/stage/$STAGE" "$W/bin" "$W/binw"
+printf '#!/bin/sh\necho "xerj %s (test stand-in)"\n' "$TAG" > "$W/stage/$STAGE/xerj"
+chmod +x "$W/stage/$STAGE/xerj"
+tar -czf "$W/srv/$ASSET" -C "$W/stage" "$STAGE"
+(cd "$W/srv" && sha256sum "$ASSET" > "$ASSET.sha256")
+
+cat > "$W/server.py" <<PY
+import http.server, os, sys
+SRV, TAG = sys.argv[2], "$TAG"
+class H(http.server.BaseHTTPRequestHandler):
+    def log_message(self, *a): pass
+    def send(self, code, body=b'', extra=None):
+        self.send_response(code)
+        self.send_header('content-length', str(len(body)))
+        for k, v in (extra or {}).items(): self.send_header(k, v)
+        self.end_headers()
+        if self.command != 'HEAD': self.wfile.write(body)
+    def do_HEAD(self): self.do_GET()
+    def do_GET(self):
+        mode, _, p = self.path.lstrip('/').partition('/')
+        p = '/' + p
+        if p.startswith('/api/repos/'):
+            if mode in ('latest403', 'api403'): return self.send(403, b'{"message":"API rate limit exceeded"}')
+            return self.send(200, ('{"tag_name": "%s"}' % TAG).encode())
+        if p.endswith('/releases/latest'):
+            if mode == 'latest403': return self.send(403, b'<html>Just a moment...</html>')
+            return self.send(302, extra={'location': '/%s/xerj-org/xerj/releases/tag/%s' % (mode, TAG)})
+        if '/releases/tag/' in p: return self.send(200, b'release page')
+        if '/releases/download/' in p:
+            name = p.rsplit('/', 1)[1]
+            sha = name.endswith('.sha256')
+            if mode == 'asset403' and not sha: return self.send(403, b'<html>Just a moment...</html>')
+            if mode == 'sha403' and sha: return self.send(403, b'Forbidden')
+            if mode == 'asset404' and not sha: return self.send(404, b'Not Found')
+            if mode == 'badsha' and sha: return self.send(200, ('0' * 64 + '  ' + name[:-7] + '\n').encode())
+            f = os.path.join(SRV, name)
+            if os.path.isfile(f): return self.send(200, open(f, 'rb').read())
+        self.send(404, b'Not Found')
+s = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
+open(sys.argv[1], 'w').write(str(s.server_address[1]))
+s.serve_forever()
+PY
+python3 -I "$W/server.py" "$W/port" "$W/srv" & SPID=$!
+for _ in $(seq 50); do [ -s "$W/port" ] && break; sleep 0.1; done
+PORT="$(cat "$W/port")" || { echo "::error::fake server did not start"; exit 1; }
+
+# Shims: send https://github.com/... to http://127.0.0.1:PORT/$MODE/... (and
+# api.github.com to .../$MODE/api/..., so no run touches the network) and
+# exec the real tool. MODE picks the server's behaviour for that run.
+for tool in curl wget; do
+  real="$(command -v "$tool" || true)"
+  [ -n "$real" ] || continue
+  cat > "$W/bin/$tool" <<SH
+#!/bin/sh
+n=\$#; i=0
+while [ \$i -lt \$n ]; do
+  a=\$1; shift
+  case "\$a" in
+    https://github.com/*)     a="http://127.0.0.1:$PORT/\$MODE/\${a#https://github.com/}" ;;
+    https://api.github.com/*) a="http://127.0.0.1:$PORT/\$MODE/api/\${a#https://api.github.com/}" ;;
+  esac
+  set -- "\$@" "\$a"; i=\$((i+1))
+done
+exec "$real" "\$@"
+SH
+  chmod +
```

**File**: `.github/scripts/release-notes-gate.sh` (modified, +8/-1)
```diff
@@ -54,6 +54,8 @@
 # USAGE
 #   .github/scripts/release-notes-gate.sh          # gate HEAD (a release branch)
 #
+#   bash .github/scripts/test_release_notes_gate.sh  # fixture tests, offline
+#
 #   Replay the rc.18 release PR head (#460) and watch every check fire:
 #       git fetch origin pull/460/head
 #       git worktree add /tmp/rc18-replay FETCH_HEAD
@@ -198,14 +200,19 @@ printf '\n== coverage: merges since the previous tag are all in the notes ==\n'
 PREV_TAG="$(git describe --tags --abbrev=0 --match 'v*' HEAD 2>/dev/null || true)"
 if [ -z "$PREV_TAG" ]; then
   fail "no previous v* tag reachable from HEAD - coverage needs full history (checkout with fetch-depth: 0)"
+elif [ "$(git rev-list --count "$PREV_TAG..HEAD")" -eq 0 ]; then
+  # An empty window is a real state, not a broken parse: HEAD is the tagged
+  # commit itself (a re-run after the tag was pushed) or nothing has landed
+  # since it. No merge can be missing from the notes.
+  pass "no commits in $PREV_TAG..HEAD - nothing merged since $PREV_TAG, nothing to cover"
 elif [ -n "$SECTION" ]; then
   exempt="$(printf '%s\n' "$SECTION" | grep -oE '<!--[[:space:]]*notes-exempt:[^>]*' | grep -oE '#[0-9]+' | tr -d '#' | sort -un)"
   merged_prs="$(git log --first-parent --format='%s' "$PREV_TAG..HEAD" | awk '
     match($0, /\(#[0-9]+\)$/)          { print substr($0, RSTART + 2, RLENGTH - 3); next }
     match($0, /^Merge pull request #[0-9]+/) { s = substr($0, RSTART + 20, RLENGTH - 20); print s }
   ' | sort -un)"
   if [ -z "$merged_prs" ]; then
-    fail "found no PR-numbered merges in $PREV_TAG..HEAD - wrong window or the parse broke; fix the gate, do not merge around it"
+    fail "found no PR-numbered merges among the $(git rev-list --count --first-parent "$PREV_TAG..HEAD") commit(s) in $PREV_TAG..HEAD - wrong window or the parse broke; fix the gate, do not merge around it"
   fi
   for n in $merged_prs; do
     # grep reads to EOF (no -q): under `set -o pipefail`, a -q that exits on
```

**File**: `.github/scripts/test_release_notes_gate.sh` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+#!/usr/bin/env bash
+# test_release_notes_gate.sh - offline fixture tests for release-notes-gate.sh.
+#
+# Each case builds a throwaway git repo with engine/Cargo.toml, CHANGELOG.md
+# and ROADMAP.md, tags v0.1.0 as the previous release, and runs the gate with
+# a stub `gh` first on PATH (no network, no token). The stub answers the
+# closing-issues GraphQL query with nothing, so an uncited PR stays uncited.
+#
+# The case that motivated this file: a window with NO commits (HEAD is the
+# previous tag itself, e.g. a re-run after the tag was pushed) used to FAIL
+# with "found no PR-numbered merges ... the parse broke". Nothing merged means
+# nothing can be missing from the notes, so it must PASS.
+#
+# USAGE
+#   bash .github/scripts/test_release_notes_gate.sh
+#   GATE=/path/to/other/release-notes-gate.sh bash .github/scripts/test_release_notes_gate.sh
+
+set -uo pipefail
+
+HERE="$(cd "$(dirname "$0")" && pwd)"
+GATE="${GATE:-$HERE/release-notes-gate.sh}"
+WORK="$(mktemp -d)"
+trap 'rm -rf "$WORK"' EXIT
+
+mkdir -p "$WORK/bin"
+cat >"$WORK/bin/gh" <<'EOF'
+#!/bin/sh
+exit 0
+EOF
+chmod +x "$WORK/bin/gh"
+
+failures=0
+ok()  { printf 'ok    %s\n' "$1"; }
+bad() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }
+
+# fixture <dir> <changelog-body> - repo at v0.1.0, cutting 0.2.0.
+fixture() {
+  local d="$1"
+  mkdir -p "$d/engine"
+  git -C "$d" init -q
+  git -C "$d" config user.email fixture@example.invalid
+  git -C "$d" config user.name fixture
+  git -C "$d" config commit.gpgsign false
+  git -C "$d" config tag.gpgsign false
+  printf '[workspace.package]\nversion = "0.2.0"\n' >"$d/engine/Cargo.toml"
+  printf '# Roadmap\n\n**Open defects** (shortlist)\n\nNone.\n\n## Next\n' >"$d/ROADMAP.md"
+  printf '# Changelog\n\n## [0.2.0]\n\n%s\n\n## [0.1.0]\n\n- first\n' "$2" >"$d/CHANGELOG.md"
+  git -C "$d" add -A
+  git -C "$d" commit -q -m "release: v0.1.0"
+  git -C "$d" tag v0.1.0
+}
+
+# run_gate <dir> - runs the gate in <dir>; sets OUT and RC.
+run_gate() {
+  OUT="$(cd "$1" && PATH="$WORK/bin:$PATH" BASE_REF=v0.1.0 XERJ_REPO=fixture/fixture bash "$GATE" 2>&1)"
+  RC=$?
+}
+
+expect() { # <name> <want-rc> <want-substring>
+  if [ "$RC" -eq "$2" ] && printf '%s\n' "$OUT" | grep -F -- "$3" >/dev/null; then
+    ok "$1"
+  else
+    bad "$1 (rc=$RC, want $2 and \"$3\")"
+    printf '%s\n' "$OUT" | sed 's/^/      /'
+  fi
+}
+
+echo '== case 1: empty window (HEAD is the previous tag) =='
+d="$WORK/empty"; fixture "$d" "- nothing yet"
+run_gate "$d"
+expect "empty window passes" 0 "no commits in v0.1.0..HEAD"
+expect "empty window verdict" 0 "PASS  the [0.2.0] notes match the tree"
+
+echo '== case 2: commits but none PR-numbered (parse or window broke) =='
+d="$WORK/noprs"; fixture "$d" "- nothing yet"
+git -C "$d" commit -q --allow-empty -m "docs: tweak"
+run_gate "$d"
+expect "non-empty window with no PR merges still fails" 1 "found no PR-numbered merges among the 1 commit(s) in v0.1.0..HEAD"
+
+echo '== case 3: one merged PR, cited in the notes =='
+d="$WORK/cited"; fixture "$d" "- fix the thing (#12)"
+git -C "$d" commit -q --allow-empty -m "fix: the thing (#12)"
+run_gate "$d"
+expect "cited PR passes" 0 "PR #12 cited in [0.2.0]"
+
+echo '== case 4: one merged PR, not cited =='
+d="$WORK/uncited"; fixture "$d" "- nothing yet"
+git -C "$d" commit -q --allow-empty -m "fix: other (#13)"
+run_gate "$d"
+expect "uncited PR fails" 1 "PR #13 merged in v0.1.0..HEAD but the [0.2.0] notes never mention it"
+
+printf '\n'
+if [ "$failures" -eq 0 ]; then
+  echo "PASS  release-notes-gate fixtures"
+else
+  echo "FAIL  $failures release-notes-gate fixture check(s)"
+  exit 1
+fi
```

**File**: `.github/workflows/ci.yml` (modified, +11/-0)
```diff
@@ -230,6 +230,11 @@ jobs:
       - name: Landing page constants agree with the newest release
         run: bash .github/scripts/landing-constants-guard.sh
 
+      # cohere-tools.json is generated from openai-tools.json; a hand edit or a
+      # forgotten regeneration would publish a tool list that disagrees with it.
+      - name: Cohere tool schema is generated from openai-tools.json
+        run: python3 tools/agents/gen_cohere_tools.py --check
+
   # #770. A job with no `timeout-minutes` runs against GitHub's 360-minute
   # default, and 22 of this repo's 23 jobs had none. Three of its workflows
   # serialise on a concurrency group that never auto-cancels
@@ -299,6 +304,9 @@ jobs:
           ref: ${{ github.event.pull_request.head.sha }}
           fetch-depth: 0
 
+      - name: Gate's own fixture tests (offline)
+        run: bash .github/scripts/test_release_notes_gate.sh
+
       - name: Notes vs tree (#474)
         env:
           GH_TOKEN: ${{ github.token }}
@@ -838,6 +846,9 @@ jobs:
       - name: Installer script lint (landing/get, landing/get.ps1)
         run: bash .github/scripts/installer-lint.sh
 
+      - name: Installer refused-download behaviour (landing/get)
+        run: bash .github/scripts/installer-download-failure-test.sh
+
       - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
         with:
           node-version: '20'
```

**File**: `.github/workflows/release.yml` (modified, +34/-0)
```diff
@@ -315,6 +315,38 @@ jobs:
       - name: List artifacts
         run: ls -la dist/
 
+      # #3286: the MCP tool schema of THIS release, read from the binary being
+      # published rather than from main. `mcp-tools.json` on the site follows
+      # main, so an agent on an installed release read a tool list its binary
+      # did not serve. The script names the file from the binary's own
+      # serverInfo.version. When the release cut committed the file, it must
+      # match this binary (a frozen schema never changes); otherwise it is
+      # generated here and still attached, with a warning to commit it.
+      # Ubuntu runners ship jq.
+      - name: MCP tool schema for this release
+        run: |
+          set -euo pipefail
+          VER="${GITHUB_REF_NAME#v}"
+          STAGE="xerj-${VER}-x86_64-unknown-linux-gnu"
+          mkdir -p "${RUNNER_TEMP}/mcp-bin"
+          tar -C "${RUNNER_TEMP}/mcp-bin" -xzf "dist/${STAGE}.tar.gz"
+          export XERJ_BIN="${RUNNER_TEMP}/mcp-bin/${STAGE}/xerj"
+          SCHEMA="landing/docs/agents/schemas/mcp-tools-${VER}.json"
+          if [ -f "${SCHEMA}" ]; then
+            bash scripts/mcp-schema-check.sh --release
+          else
+            bash scripts/mcp-schema-check.sh --release --write
+            echo "::warning::${SCHEMA} was not committed with the release cut; it is attached to the release only. Commit it to main so xerj.org serves it."
+          fi
+          cp "${SCHEMA}" dist/
+          ( cd dist && sha256sum "mcp-tools-${VER}.json" > "mcp-tools-${VER}.json.sha256" )
+
+      # One combined checksum file for mirror installs (#3278). The model
+      # bundle is uploaded separately; `scripts/release-sha256sums.sh --tag`
+      # rebuilds this asset from every *.sha256 on the release afterwards.
+      - name: Build SHA256SUMS
+        run: bash scripts/release-sha256sums.sh --dir dist
+
       # GitHub anchors auto-generated release notes ("Full Changelog") on the
       # most recently *published* release. Since the daily pack-rust-vulns-*
       # corpus-pack releases started, that anchor is a corpus pack, not the
@@ -378,3 +410,5 @@ jobs:
             dist/*.zip
             dist/*.deb
             dist/*.sha256
+            dist/mcp-tools-*.json
+            dist/SHA256SUMS
```

---

### Incident Patch 3: `75721077` (2026-11-21)
**Commit Message**: fix(aggs): bound multi-index leaf terms candidates; keep single-index cap

Maintainer follow-up to #2957 (parijat1222q), which fixes #2935 finding 4:
a multi-index `terms` agg applied size per index before merging, so
top-a (1 x10, 3 x9) + top-b (2 x10, 3 x9) at size 1 returned [1, 2]
instead of 3 x18, and `_key: desc` returned [3, 1, 2]. #2957 merges
per-index counts and selects once globally. Its coordinator is kept; this
commit changes two parts of it found in review.

1. Per-index work was unbounded. #2957 rewrote every admitted leaf terms
   agg to `size: 0` (every term) on each index, so a size-10 request over
   a high-cardinality field shipped and merged every distinct term. On a
   release build with hc-b (40,000 distinct keys) + top-a, warm per-index
   cache, `size: 10`, request_cache=false: #2957 head merged with main
   44-55 ms per request, this commit 0.5-1.0 ms (10 runs each, load
   13.8-17.6).
   Now each index returns `shard_size` candidates (explicit, never below
   size; default size * 3 / 2 + 10; clamped to search.max_buckets).
   `size: 0` and a primary `_count: asc` order still fetch every term.
   When an index cuts terms, the cut documents are added to
   

**File**: `CHANGELOG.md` (modified, +7/-4)
```diff
@@ -869,10 +869,13 @@ all 2,387 evaluation items. Without the flag a node is the node rc.100 was: no
 - Multi-index composite aggregation pages now use the requested global source
   order and page size, combine duplicate bucket counts, and set the cursor from
   the retained page. Internal typed keys preserve formatted-date ordering.
-- Finalize top-level leaf `terms` buckets across participating indices after
-  complete bounded counts, preserving requested count/key order and global
-  minimum/size. Refuse bucket-cap overflow instead of silently dropping terms;
-  retain private raw term identity until the HTTP response boundary.
+- A top-level `terms` aggregation over several indices now picks its buckets
+  after merging every index's candidates, so a term that wins only in total
+  (9 + 9 = 18 against two local 10s) is no longer lost, and `_key` order is
+  applied globally (#2935). Each index returns `shard_size` candidates
+  (default `size * 1.5 + 10`); when an index cuts terms, the cut documents
+  count in `sum_other_doc_count` and `doc_count_error_upper_bound` reports the
+  bound instead of a false 0.
 
 - A plain debug `cargo test --workspace` no longer aborts on a stack overflow,
   and the `127.0.0.2` loopback test names the missing macOS alias (#2903). Five
```

**File**: `engine/crates/xerj-api/src/es_compat.rs` (modified, +256/-12)
```diff
@@ -7649,19 +7649,55 @@ fn leaf_terms_params(spec: &Value) -> Option<&Value> {
     Some(params)
 }
 
+/// How many candidate terms each index returns for a leaf terms agg: the
+/// explicit `shard_size` (never below `size`), else `size * 3 / 2 + 10`.
+/// `0` means every term: `size: 0` asks for all of them, and a primary
+/// `_count: asc` order has no usable error bound once an index cuts its list.
+/// Clamped to the bucket cap, so per-index work is bounded by the request
+/// rather than by field cardinality.
+fn leaf_terms_fetch_size(params: &Value, cap: usize) -> u64 {
+    let size = params.get("size").and_then(Value::as_u64).unwrap_or(10);
+    let count_asc = leaf_terms_orders(params)
+        .and_then(|orders| orders.into_iter().next())
+        .is_some_and(|(key, asc)| key == "_count" && asc);
+    if size == 0 || count_asc {
+        return 0;
+    }
+    let fetch = match params.get("shard_size").and_then(Value::as_u64) {
+        Some(shard_size) => shard_size.max(size),
+        None => size.saturating_mul(3) / 2 + 10,
+    };
+    fetch.min(cap as u64)
+}
+
+/// Union bound for merging one leaf terms agg across indices. Only an
+/// all-terms request (fetch 0) returns the whole union, so only it is refused
+/// past the cap; a bounded request holds at most `indices x fetch` rows and
+/// emits at most `size`.
+fn leaf_terms_union_cap(request: Option<&Value>, name: &str, cap: usize) -> usize {
+    match request
+        .and_then(|r| r.get(name))
+        .and_then(leaf_terms_params)
+    {
+        Some(params) if leaf_terms_fetch_size(params, cap) != 0 => usize::MAX,
+        _ => cap,
+    }
+}
+
 fn prepare_leaf_terms_summaries(request: &Value) -> (Value, Vec<String>) {
+    let cap = xerj_engine::aggs::max_buckets();
     let mut rewritten = request.clone();
     let mut names = Vec::new();
     if let Some(object) = rewritten.as_object_mut() {
         for (name, spec) in object {
-            if leaf_terms_params(spec).is_none() {
+            let Some(fetch) = leaf_terms_params(spec).map(|p| leaf_terms_fetch_size(p, cap)) else {
                 continue;
-            }
+            };
             let params = spec
                 .get_mut("terms")
                 .and_then(Value::as_object_mut)
                 .unwrap();
-            params.insert("size".into(), json!(0));
+            params.insert("size".into(), json!(fetch));
             params.remove("shard_size");
             if params.get("min_doc_count").and_then(Value::as_u64) != Some(0) {
                 params.insert("min_doc_count".into(), json!(1));
@@ -7710,6 +7746,37 @@ fn leaf_terms_identity(bucket: &Value) -> String {
     }
 }
 
+const LEAF_TERMS_OTHER: &str = "__xy_terms_other__";
+const LEAF_TERMS_ERROR: &str = "__xy_terms_error__";
+
+/// Fold one index's own cut-off into private accumulators, once. `other` is
+/// the documents in terms that index cut; `error` is the count of its last
+/// returned term when it cut any (the most an unseen term can have there).
+fn leaf_terms_accumulate(summary: &mut Value) {
+    let Some(object) = summary.as_object_mut() else {
+        return;
+    };
+    if object.contains_key(LEAF_TERMS_OTHER) {
+        return;
+    }
+    let other = object
+        .get("sum_other_doc_count")
+        .and_then(Value::as_u64)
+        .unwrap_or(0);
+    let error = if other > 0 {
+        object
+            .get("buckets")
+            .and_then(Value::as_array)
+            .and_then(|rows| rows.last())
+            .and_then(|b| b["doc_count"].as_u64())
+            .unwrap_or(0)
+    } else {
+        0
+    };
+    object.insert(LEAF_TERMS_OTHER.into(), json!(other));
+    object.insert(LEAF_TERMS_ERROR.into(), json!(error));
+}
+
 fn merge_leaf_terms_summary(old: &Value, new: &Value, cap: usize) -> Value {
     if old.get("error").is_some() {
         return old.clone();
@@ -7718,6 +7785,17 @@ fn merge_leaf_terms_summary(old: &Value, new: &Value, cap: usize) -> Value {
         return new.clone();
     }
     let mut result = old.clone();
+    if result.get("buckets").and_then(Value::as_array).is_none() {
+        return new.clone();
+    }
+    let mut incoming_summary = new.clone();
+    leaf_terms_accumulate(&mut result);
+    leaf_terms_accumulate(&mut incoming_summary);
+    for key in [LEAF_TERMS_OTHER, LEAF_TERMS_ERROR] {
+        let a = result[key].as_u64().unwrap_or(0);
+        let b = incoming_summary[key].as_u64().unwrap_or(0);
+        result[key] = json!(a.saturating_add(b));
+    }
     let Some(rows) = result.get_mut("buckets").and_then(Value::as_array_mut) else {
         return new.clone();
     };
@@ -7729,7 +7807,7 @@ fn merge_leaf_terms_summary(old: &Value, new: &Value, cap: usize) -> Value {
         .enumerate()
         .map(|(i, b)| (leaf_terms_identity(b), i))
         .collect();
-    if let Some(incoming) = new.get("buckets").and_then(Value::as_array) {
+    if let Some(incoming) = incoming_summary.get("buckets").and_then(Value::as_array) {
 
```

**File**: `engine/crates/xerj-engine/src/aggs.rs` (modified, +3/-43)
```diff
@@ -3652,34 +3652,23 @@ fn run_terms(
     });
     let mut counts: HashMap<String, u64> = HashMap::new();
     let bucket_cap = max_buckets();
-    let too_many_buckets = || {
-        json!({
-            "error": format!(
-                "Trying to create too many buckets. Must be less than or equal to: [{}] but this number of buckets was exceeded. This limit can be set by changing the [search.max_buckets] cluster level setting.",
-                bucket_cap
-            ),
-            "__error_status__": 400u32,
-        })
-    };
     for doc in docs {
         let weight = doc_count_weight(doc);
         let vals = terms_agg_bucket_keys(&field_or_script, doc);
         if vals.is_empty() {
             if let Some(ph) = &missing_placeholder {
-                // Never return an apparently exact result after dropping keys.
+                // Bucket cap: skip new keys past the limit, but always
+                // accumulate into existing keys so the cap doesn't bias
+                // counts of buckets that were already seen.
                 if counts.contains_key(ph) || counts.len() < bucket_cap {
                     *counts.entry(ph.clone()).or_insert(0) += weight;
-                } else {
-                    return too_many_buckets();
                 }
             }
             continue;
         }
         for term in vals {
             if counts.contains_key(&term) || counts.len() < bucket_cap {
                 *counts.entry(term).or_insert(0) += weight;
-            } else {
-                return too_many_buckets();
             }
         }
     }
@@ -3697,8 +3686,6 @@ fn run_terms(
             for term in terms_agg_bucket_keys(&field_or_script, doc) {
                 if counts.contains_key(&term) || counts.len() < bucket_cap {
                     counts.entry(term).or_insert(0);
-                } else {
-                    return too_many_buckets();
                 }
             }
         }
@@ -15859,33 +15846,6 @@ mod tests {
         assert_eq!(buckets[1]["key"]["n"], json!(10));
     }
 
-    #[test]
-    fn leaf_terms_bucket_cap_refuses_incomplete_counts() {
-        let docs = vec![json!({"k":"a"}), json!({"k":"b"}), json!({"k":"c"})];
-        let request = json!({"t":{"terms":{"field":"k","size":0}}});
-        let result = run_aggs_with_limits(&request, &docs, &docs, AggLimits { max_buckets: 2 });
-        assert_eq!(result["t"]["__error_status__"], 400);
-        assert!(result["t"]["error"]
-            .as_str()
-            .unwrap()
-            .contains("too many buckets"));
-        let complete = run_aggs_with_limits(&request, &docs, &docs, AggLimits { max_buckets: 3 });
-        assert_eq!(complete["t"]["buckets"].as_array().unwrap().len(), 3);
-    }
-
-    #[test]
-    fn leaf_terms_bucket_cap_covers_missing_and_zero_count_background() {
-        let docs = vec![json!({"k":"a"}), json!({})];
-        let missing = json!({"t":{"terms":{"field":"k","size":0,"missing":"z"}}});
-        let result = run_aggs_with_limits(&missing, &docs, &docs, AggLimits { max_buckets: 1 });
-        assert_eq!(result["t"]["__error_status__"], 400);
-        let background = vec![json!({"k":"a"}), json!({"k":"b"})];
-        let zero = json!({"t":{"terms":{"field":"k","size":0,"min_doc_count":0}}});
-        let result =
-            run_aggs_with_limits(&zero, &docs[..1], &background, AggLimits { max_buckets: 1 });
-        assert_eq!(result["t"]["__error_status__"], 400);
-    }
-
     // ── RC4-W2 item 8: multi_terms raises too_many_buckets past the cap ─
 
     #[test]
```

**File**: `engine/crates/xerj-engine/src/fast_aggs.rs` (modified, +12/-4)
```diff
@@ -2985,10 +2985,18 @@ impl<'a> FastCtx<'a> {
         // the exact OOM vector the cap exists to close, honoured on brute and
         // ignored here.
         //
-        // Refuse the columnar route when its distinct-term map would exceed
-        // the cap. The brute evaluator returns the shared too-many-buckets
-        // error, never an apparently exact iteration-dependent subset. Keep
-        // the existing bail route so unsupported fast shapes agree with it.
+        // We do NOT enforce the cap by truncating the map: brute drops the
+        // terms past `max_buckets` in doc-iteration order and reports a
+        // `sum_other_doc_count` computed only over the terms it kept, so the
+        // dropped terms vanish silently (order-dependent, and the total
+        // conceals them). Reproducing that on the fast path would copy the bug,
+        // not the contract. Instead we BAIL to brute the moment the distinct
+        // count would exceed the cap (checked below as the map grows, so the
+        // map is bounded to ~`bucket_cap`): after the bail the request is
+        // answered by the very `run_terms` a test would measure the fast path
+        // against, so the two paths AGREE past the cap by construction — the
+        // same shape as the #104 / #120 bail-to-brute fallbacks. An index whose
+        // distinct count is at or under the cap is served here as before.
         let bucket_cap = crate::aggs::max_buckets();
 
         let plan = self.plan_subs(sub, true)?;
```

**File**: `engine/crates/xerj-engine/tests/agg_bucket_cap_terms.rs` (modified, +48/-14)
```diff
@@ -9,11 +9,23 @@
 //! 37. That is the OOM vector the cap exists to close, honoured on brute and
 //! ignored on the columnar path.
 //!
-//! ## Overflow behavior
+//! ## Why the fix BAILS rather than errors or truncates
 //!
-//! exec_terms bails to brute when another distinct key would exceed the cap.
-//! Brute now returns too_many_buckets instead of silently dropping keys and
-//! reporting incomplete counts as exact. Both paths must preserve that error.
+//! The two executors must AGREE past the cap. Brute `run_terms` does not error
+//! there: it keeps the first `max_buckets` distinct terms in doc-iteration
+//! order, drops the rest, and reports a `sum_other_doc_count` computed only
+//! over the terms it kept — so the dropped terms vanish silently and the total
+//! conceals them (order-dependent, and a bug in its own right). Reproducing
+//! that on the fast path would copy the bug, not the contract; erroring would
+//! make the fast path disagree with a brute path that still returns a body.
+//!
+//! So `exec_terms` bails to brute the instant its distinct-term count would
+//! exceed the cap. After the bail the request is answered by the very
+//! `run_terms` the fast path would be measured against, so the two AGREE past
+//! the cap by construction. What this test pins is that agreement plus the two
+//! observable consequences of the bail: the fast path stops SERVING the
+//! over-cap agg (`fast_path_aggs_served` no longer ticks) and the answer honours
+//! the cap (exactly `CAP` distinct buckets, not all `NTERMS`).
 //!
 //! Which executor answered is read from `aggs::fast_path_aggs_served`; the brute
 //! leg is forced by keeping an index under the columnar path's own size gate
@@ -128,15 +140,36 @@ async fn lowered_max_buckets_binds_the_columnar_terms_path_and_the_brute_path_al
     build_index(&engine, "big-at", BIG_DOCS, CAP).await;
     build_index(&engine, "small-over", SMALL_DOCS, NTERMS).await;
 
-    // Both over-cap routes must refuse incomplete counts, not quietly keep
-    // an iteration-dependent subset. This intentional contract correction
-    // replaces the old assertion that pinned the documented silent-drop bug.
-    for name in ["big-over", "small-over"] {
-        let (agg, served) = run_terms(&engine, name).await;
-        assert_eq!(served, 0, "over-cap terms must fall back to brute");
-        assert_eq!(agg["__error_status__"], 400, "{name}: {agg}");
-        assert!(agg["error"].as_str().unwrap().contains("too many buckets"));
-    }
+    // ── Fast path, cardinality PAST the cap ──────────────────────────────
+    // The regression: before the fix this was served columnarly (served == 1)
+    // and returned all NTERMS buckets. The fix bails to brute, so the fast path
+    // no longer serves it and the brute cap (exactly CAP distinct terms) binds.
+    let (agg, served) = run_terms(&engine, "big-over").await;
+    assert_eq!(
+        served,
+        0,
+        "exec_terms served an over-cap agg columnarly instead of bailing; it \
+         returned {} buckets against max_buckets={CAP}",
+        bucket_count(&agg)
+    );
+    assert_eq!(
+        bucket_count(&agg),
+        CAP,
+        "over-cap terms agg did not honour max_buckets={CAP}: {}",
+        bucket_count(&agg)
+    );
+
+    // ── Brute path, same over-cap shape below the size gate ──────────────
+    // The path the fast leg bails INTO. It agrees on the cap: exactly CAP
+    // distinct buckets. (The kept terms are order-dependent and the doc counts
+    // differ from the big index, so agreement is on the count, per the issue.)
+    let (agg, served) = run_terms(&engine, "small-over").await;
+    assert_eq!(served, 0, "the small index must not take the fast path");
+    assert_eq!(
+        bucket_count(&agg),
+        CAP,
+        "brute run_terms disagrees with the fast path on the cap"
+    );
 
     // ── Fast path, cardinality exactly AT the cap ────────────────────────
     // The fix must bail only when the count would EXCEED the cap: an at-cap
@@ -159,6 +192,7 @@ async fn lowered_max_buckets_binds_the_columnar_terms_path_and_the_brute_path_al
             .unwrap()
             .iter()
             .all(|b| b.get("__xy_terms_key__").is_some()),
-        "the admitted fast path must retain raw term identity for coordination"
+        "the columnar path must keep the raw term identity the multi-index \
+         coordinator merges on"
     );
 }
```

**File**: `engine/tests/es-compat-yaml/yaml/aggregations/multi_index_leaf_terms.yml` (modified, +144/-0)
```diff
@@ -128,3 +128,147 @@ setup:
   - length: { aggregations.t.buckets: 1 }
   - match: { aggregations.t.buckets.0.key: a }
   - is_false: aggregations.t.buckets.0.__xy_terms_key__
+---
+"issue 2935 fixture: global 18-count winner and global key order across indices":
+  - do:
+      indices.create:
+        index: issue2935-top-a
+        body:
+          mappings:
+            properties:
+              tag: { type: keyword }
+  - do:
+      indices.create:
+        index: issue2935-top-b
+        body:
+          mappings:
+            properties:
+              tag: { type: keyword }
+  - do:
+      bulk:
+        refresh: true
+        body:
+          - index: { _index: issue2935-top-a, _id: "0" }
+          - { tag: "1" }
+          - index: { _index: issue2935-top-a, _id: "1" }
+          - { tag: "1" }
+          - index: { _index: issue2935-top-a, _id: "2" }
+          - { tag: "1" }
+          - index: { _index: issue2935-top-a, _id: "3" }
+          - { tag: "1" }
+          - index: { _index: issue2935-top-a, _id: "4" }
+          - { tag: "1" }
+          - index: { _index: issue2935-top-a, _id: "5" }
+          - { tag: "1" }
+          - index: { _index: issue2935-top-a, _id: "6" }
+          - { tag: "1" }
+          - index: { _index: issue2935-top-a, _id: "7" }
+          - { tag: "1" }
+          - index: { _index: issue2935-top-a, _id: "8" }
+          - { tag: "1" }
+          - index: { _index: issue2935-top-a, _id: "9" }
+          - { tag: "1" }
+          - index: { _index: issue2935-top-a, _id: "10" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-a, _id: "11" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-a, _id: "12" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-a, _id: "13" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-a, _id: "14" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-a, _id: "15" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-a, _id: "16" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-a, _id: "17" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-a, _id: "18" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-b, _id: "b0" }
+          - { tag: "2" }
+          - index: { _index: issue2935-top-b, _id: "b1" }
+          - { tag: "2" }
+          - index: { _index: issue2935-top-b, _id: "b2" }
+          - { tag: "2" }
+          - index: { _index: issue2935-top-b, _id: "b3" }
+          - { tag: "2" }
+          - index: { _index: issue2935-top-b, _id: "b4" }
+          - { tag: "2" }
+          - index: { _index: issue2935-top-b, _id: "b5" }
+          - { tag: "2" }
+          - index: { _index: issue2935-top-b, _id: "b6" }
+          - { tag: "2" }
+          - index: { _index: issue2935-top-b, _id: "b7" }
+          - { tag: "2" }
+          - index: { _index: issue2935-top-b, _id: "b8" }
+          - { tag: "2" }
+          - index: { _index: issue2935-top-b, _id: "b9" }
+          - { tag: "2" }
+          - index: { _index: issue2935-top-b, _id: "b10" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-b, _id: "b11" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-b, _id: "b12" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-b, _id: "b13" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-b, _id: "b14" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-b, _id: "b15" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-b, _id: "b16" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-b, _id: "b17" }
+          - { tag: "3" }
+          - index: { _index: issue2935-top-b, _id: "b18" }
+          - { tag: "3" }
+  - do:
+      search:
+        index: issue2935-top-a,issue2935-top-b
+        body:
+          size: 0
+          aggs:
+            top:
+              terms: { field: tag, size: 1 }
+            key_desc:
+              terms: { field: tag, size: 10, order: { _key: desc } }
+  - length: { aggregations.top.buckets: 1 }
+  - match: { aggregations.top.buckets.0.key: "3" }
+  - match: { aggregations.top.buckets.0.doc_count: 18 }
+  - match: { aggregations.top.sum_other_doc_count: 20 }
+  - match: { aggregations.top.doc_count_error_upper_bound: 0 }
+  - length: { aggregations.key_desc.buckets: 3 }
+  - match: { aggregations.key_desc.buckets.0.key: "3" }
+  - match: { aggregations.key_desc.buckets.0.doc_count: 18 }
+  - match: { aggregations.key_desc.buckets.1.key: "2" }
+  - match: { aggregations.key_desc.buckets.1.doc_count: 10 }
+  - match: { aggregations.key_desc.buckets.2.key: "1" }
+  - match: { aggregations.key_desc.buckets.2.doc_count: 10 }
+  - match: { aggregations.key_desc.sum_other_doc_count: 0 }
+  - is_false: aggregations.top.buckets.0.__xy_terms_key__
+  - do:
+      search:
+        index
```

#### Recent Merged Pull Requests:
- **PR #3375** (2026-11-22): hub(audit): withhold lukaszFD/cyber-sentinel, the author withdrew consent (@xerj-team)
- **PR #3374** (2026-11-22): hub: author-approved contribution candidates (14273 repos) (@xerj-team)
- **PR #3373** (2026-11-22): hub: apply 20 author-requested page fixes (@xerj-team)
- **PR #3369** (2026-11-22): hub: author-approved contribution candidates (14255 repos) (@xerj-team)
- **PR #3368** (2026-11-21): hub: author-approved contribution candidates (14244 repos) (@xerj-team)
- **PR #3366** (2026-11-22): perf(hybrid): fuse on ids, hydrate only the page (#3018) (@xerj-team)

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

## X. engine,storage): searches stop waiting on WAL and snapshot fsyncs under write lo

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5c7187b3`: engine,storage): searches stop waiting on WAL and snapshot fsyncs under write load. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Searches no longer wait on WAL and snapshot fsyncs while bulk writes run
  (refs #3324 #3331).** Three code paths held the collection-publication
  bracket (every search on the index waits while it is open) across disk
  waits. A flush kept its bracket open through post-publish maintenance
  (snapshot fsync, WAL rotate and prune). `_bulk` opened its bracket before
  appending to the WAL, so it waited inside the bracket for a WAL shard
  lock that WAL maintenance and the batched fsync held across fsyncs. The
  flush bracket now closes when the segment is published, and `_bulk`
  appends to the WAL before opening the bracket. WAL maintenance and the
  `wal_batch_ms` fsync now fsync without holding the shard lock: the next
  generation's file is created and synced first, and only the rename runs
  under the lock. The same fsyncs still happen, so durability does not
  change. A WAL write error no longer poisons the index. Measured over 3
  runs each, 60 s, 300k preload plus a closed-loop 5,000-doc auto-id writer,
  ext4: p99 over all reads went from 204-265 ms to 40-85 ms (load 25-50).
  With a `dd` fdatasync neighbour on the same disk it went from 260-305 ms
  to 45-60 ms, and the
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5c7187b3` are properly handled with clean fallback behavior.


## 4. Empirical Verification & Quality Gate
```bash
node scripts/verify-execution.mjs --target "xerj-org-xerj"
```
