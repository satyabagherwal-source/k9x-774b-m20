> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source**: github ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Source Version**: `83c9f0d1`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T15:20:46.451Z  
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
> **Harvest Timestamp**: 2026-11-05T15:20:46.257Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: AI search engine and MCP server for bots and agents. One Rust binary indexes code, docs, logs, JSONL/CSV and PDFs for BM25 full-text, vector and hybrid search, code search without grep, agent memory and RAG. Elasticsearch-compatible API; Corpus Hub serves hundreds of reference memory corpora.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 19029 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2903** (2026-11-04): **tests: debug-profile local_def tests stack-overflow on macOS arm64, and the 127.0.0.2 loopback_proxy test fails on stock macOS without naming the missing alias**
  *Symptoms*: From field report #2902 (JoyCode, macOS 26.2 arm64, rc.100 / main):  1. Debug-profile `local_def` tests stack-overflow and SIGABRT on clean `main` on this host. Nothing in CONTRIBUTING says to use `--profile ci-test`, so contributors first think their patch broke it. 2. `loopback_proxy::loopback_ignores_an_unreachable_proxy_and_a_proxied_503_names_the_proxy` needs a `127.0.0.2` loopback alias, which stock macOS doesn't have. The failure says "request to http://127.0.0.2:9/... failed" with no hint that the host lacks the alias.  Expected: the debug-profile tests either pass (e.g. larger test thread stack) or CONTRIBUTING documents `--profile ci-test`; the 127.0.0.2 test skips with a clear message (or names the missing alias and the `ifconfig lo0 alias 127.0.0.2` fix) when the alias isn't configured.

- **Issue #2898** (2026-11-03): **mcp: a tools/call with no id blocks the stdio read loop and still gets a response**
  *Symptoms*: ### XERJ version  `origin/main` at `4ce1fbb5503beb1f5a1cd8f54d2e34ab7499657f`  ### How did you install / run XERJ?  Other (describe in steps below). Read the dispatch in `engine/crates/xerj-mcp/src/lib.rs` on that commit. No node was started.  ### Operating system & architecture  Windows 11 x86_64. The dispatch is the same on every platform.  ### Steps to reproduce  On `origin/main`, the stdio loop and `handle_message` disagree about what a `tools/call` without a usable id is.  `is_tool_call_request` (`lib.rs` 517-519) is the only path that runs a tool call off the read loop:  ```rust fn is_tool_call_request(msg: &Value) -> bool {     msg.get("method").and_then(Value::as_str) == Some("tools/call")         && msg.get("id").is_some_and(|id| !id.is_null()) } ```  Anything else falls through to the read loop (`lib.rs` 504):  ```rust other => handle_message(&ctx, other).await.into_iter().collect(), ```  `handle_message` (`lib.rs` 606-621) does not treat a missing id as "do not reply" for the methods it knows. A notification is `id.is_none()`, and that flag is consulted only in the unknown-method arm. `tools/call` always awaits `call_tool` and always returns a response:  ```rust "tools/call" => Some(rpc_result(id, call_tool(ctx, &msg).await)), ```  `rpc_result` turns a missing id into JSON `null` (`lib.rs` 726-727).  Send either of these as one stdio line:  ```json {"jsonrpc":"2.0","method":"tools/call","params":{"name":"xerj_search","arguments":{"query":"x"}}} ```  ```json {"jsonr

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

### Incident Patch 1: `c5798431` (2026-11-05)
**Commit Message**: fix(api): refuse a malformed _bulk action line for the whole request (#2938)

Motivation: ES 8 parses every action line of a `_bulk` body before it
runs any action (`BulkRequestParser#parse`). A line it cannot read as an
action refuses the whole request with a 400 `illegal_argument_exception`
naming the line, and nothing in the body is written. XERJ answered 200,
wrote every other action, and gave the bad line a per-item error. It
also ignored unknown keys in an action line, so `_type` (removed in ES 8)
and typos such as `_routing` went through silently. Two vendored ES YAML
cases were on the catch-lenient ratchet for this:
`bulk/10_basic.yml · empty action` and
`bulk/60_deprecated.yml · Deprecated parameters should fail in Bulk query`.

Before, on a scratch node (`{"index":{...}}`, `{"f1":"v1"}`, `{}`):

  ES 8.13  400 "Malformed action/metadata line [3], expected FIELD_NAME
           but found [END_OBJECT]", nothing written
  XERJ     200 errors:true, line 1 written, item 2 a 400

Root cause: the engine's bulk parse (`xerj_engine::bulk`) reads action
lines in parallel and turns a bad one into a per-item error, after
which the rest of the batch is applied. Its fast path never loo

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -156,6 +156,18 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   `sudo ifconfig lo0 alias 127.0.0.2 up` instead of a bare connection error,
   through the new `xerj_common::loopback_test::require_loopback_alias`.
   CONTRIBUTING documents both, and that CI runs `--profile ci-test`.
+- `_bulk` refuses a malformed action line the way Elasticsearch 8 does: the
+  whole request is a 400 `illegal_argument_exception` naming the line
+  (`Malformed action/metadata line [3], expected FIELD_NAME but found
+  [END_OBJECT]`, `Action/metadata line [1] contains an unknown parameter
+  [_type]`), and nothing in the body is written. XERJ answered 200 with a
+  per-item error for that line and wrote every other action. An unknown
+  parameter (`_type`, `_version`, `_routing`, a typo) used to be ignored and
+  is now refused, as in ES 8; a client sending the 7.x REST compatibility
+  header (`compatible-with=7`) may still send `_type`, as ES 8 allows. A line
+  the check cannot read with confidence (JSON ES's own parser rejects, an
+  escaped key, a byte order mark) stops the check there, and the rest of the
+  body is answered as before.
 - Data-stream `_rollover` honours `dry_run` and its `conditions` instead of
   ignoring the body: `max_docs`/`max_age` are ORed and reported in
   `conditions`, and a dry run or an unmet condition creates no backing index.
```

**File**: `engine/crates/xerj-api/src/bulk_action_lines.rs` (added, +554/-0)
```diff
@@ -0,0 +1,554 @@
+//! Elasticsearch's whole-request check of `_bulk` action lines.
+//!
+//! ES parses every action line of a bulk body before it executes any action
+//! (`BulkRequestParser#parse`, 8.13). A line it cannot read as an action
+//! refuses the whole request with a 400 `illegal_argument_exception` that
+//! names the line, so nothing in the body is written. The bulk engine reads
+//! action lines on its parallel parse and reports a bad one as a per-item
+//! error after the rest have run; this check runs first, on the HTTP path,
+//! and gives ES's answer instead.
+//!
+//! It is a byte scanner, not a JSON parse: action lines are short, and the
+//! bulk hot path deliberately avoids building a `Value` per action (M5.12 in
+//! `xerj_engine::bulk`). It reads names and token shapes the way ES's
+//! streaming parser meets them, and refuses only what it reads with
+//! confidence. Anything else (JSON it cannot follow, an escaped key, a byte
+//! order mark) stops the check at that line and leaves the rest of the body
+//! to the engine, which answers exactly as before. Stopping, rather than
+//! skipping the line, matters: once a line is unread, which line is an action
+//! and which is a source is no longer certain, and reading a source line as
+//! an action would refuse a body ES accepts.
+//!
+//! It does not convert values. ES does (`version` to a number, `_source` to a
+//! fetch context), so for a line that also has a value ES cannot convert, ES
+//! can name that value where this check names a later problem. Both answers
+//! are a 400 for the whole request.
+
+/// Fields ES reads as a simple value inside an action. `_type` is absent on
+/// purpose: on the 8.x REST API it is an unknown parameter (see
+/// `first_malformed_action_line` for the 7.x compatibility case).
+const SIMPLE_FIELDS: &[&[u8]] = &[
+    b"_index",
+    b"_id",
+    b"routing",
+    b"op_type",
+    b"version",
+    b"version_type",
+    b"if_seq_no",
+    b"if_primary_term",
+    b"retry_on_conflict",
+    b"pipeline",
+    b"_source",
+    b"require_alias",
+    b"require_data_stream",
+    b"list_executed_pipelines",
+];
+
+/// Fields ES accepts as an object inside an action.
+const OBJECT_FIELDS: &[&[u8]] = &[b"dynamic_templates", b"_source"];
+
+/// The reason ES gives for the first malformed action line in `body`, or
+/// `None` when every action line is one ES would accept, or the check
+/// stopped at a line it leaves to the engine. Lines are numbered from 1 and
+/// blank lines count, as in ES. Pairing follows the bulk engine: every action
+/// but a delete is followed by one source line.
+///
+/// `compat_v7` is a request sent with ES's REST compatibility header
+/// (`compatible-with=7`); ES 8 then accepts `_type` with a deprecation
+/// warning instead of refusing it.
+pub(crate) fn first_malformed_action_line(body: &str, compat_v7: bool) -> Option<String> {
+    let mut expect_source = false;
+    for (n, line) in body.split('\n').enumerate() {
+        if line.trim().is_empty() {
+            if expect_source {
+                // ES takes the very next line as the source even when it is
+                // blank; the engine skips blank lines. The two pair every
+                // line after this one differently, so stop here.
+                return None;
+            }
+            continue;
+        }
+        if expect_source {
+            expect_source = false;
+            continue;
+        }
+        match check(line.as_bytes(), n + 1, compat_v7) {
+            Line::Refused(reason) => return Some(reason),
+            Line::Deferred => return None,
+            Line::Accepted => {}
+        }
+        expect_source = !crate::cluster_shard::bulk_action_line_is_delete(line);
+    }
+    None
+}
+
+enum Line {
+    Accepted,
+    Refused(String),
+    /// Not something this scanner reads with confidence; the engine decides.
+    Deferred,
+}
+
+/// A JSON number, the whole of `t`.
+fn is_json_number(t: &[u8]) -> bool {
+    let digits = |i: &mut usize| {
+        let start = *i;
+        while matches!(t.get(*i), Some(b'0'..=b'9')) {
+            *i += 1;
+        }
+        *i > start
+    };
+    let mut i = 0;
+    if t.first() == Some(&b'-') {
+        i += 1;
+    }
+    match t.get(i) {
+        Some(b'0') => i += 1,
+        Some(b'1'..=b'9') => {
+            digits(&mut i);
+        }
+        _ => return false,
+    }
+    if t.get(i) == Some(&b'.') {
+        i += 1;
+        if !digits(&mut i) {
+            return false;
+        }
+    }
+    if matches!(t.get(i), Some(b'e' | b'E')) {
+        i += 1;
+        if matches!(t.get(i), Some(b'+' | b'-')) {
+            i += 1;
+        }
+        if !digits(&mut i) {
+            return false;
+        }
+    }
+    i == t.len()
+}
+
+struct Cursor<'a> {
+    b: &'a [u8],
+    p: usize,
+}
+
+impl<'a> Cursor<'a> {
+    fn peek(&mut self) -> Option<u8> {
+        while self.p < self.b.len() && matches!(self.b[self.p], b' ' | b'\t' | b'\r
```

**File**: `engine/crates/xerj-api/src/cluster_shard.rs` (modified, +1/-1)
```diff
@@ -1849,7 +1849,7 @@ fn bulk_item_error(
 
 /// Same pairing rule as the bulk engine: a delete action has no source line.
 /// The two parsers have to agree, or a delete swallows the next action.
-fn bulk_action_line_is_delete(line: &str) -> bool {
+pub(crate) fn bulk_action_line_is_delete(line: &str) -> bool {
     let b = line.as_bytes();
     let mut p = 0usize;
     while p < b.len() && (b[p] == b' ' || b[p] == b'\t') {
```

**File**: `engine/crates/xerj-api/src/es_compat.rs` (modified, +32/-2)
```diff
@@ -21417,11 +21417,13 @@ pub async fn bulk_ops(
     State(state): State<AppState>,
     Path(index): Path<String>,
     axum::extract::Query(qp): axum::extract::Query<std::collections::HashMap<String, String>>,
+    headers: axum::http::HeaderMap,
     body: bytes::Bytes,
 ) -> impl IntoResponse {
     let started = Instant::now();
     let opts = bulk_opts_from_query(&qp);
-    process_bulk_body(&state, Some(&index), &body, started, opts).await
+    let compat_v7 = wants_rest_compat_v7(&headers);
+    process_bulk_body(&state, Some(&index), &body, started, opts, compat_v7).await
 }
 
 // ─────────────────────────────────────────────────────────────────────────────
@@ -21431,11 +21433,30 @@ pub async fn bulk_ops(
 pub async fn global_bulk(
     State(state): State<AppState>,
     axum::extract::Query(qp): axum::extract::Query<std::collections::HashMap<String, String>>,
+    headers: axum::http::HeaderMap,
     body: bytes::Bytes,
 ) -> impl IntoResponse {
     let started = Instant::now();
     let opts = bulk_opts_from_query(&qp);
-    process_bulk_body(&state, None, &body, started, opts).await
+    let compat_v7 = wants_rest_compat_v7(&headers);
+    process_bulk_body(&state, None, &body, started, opts, compat_v7).await
+}
+
+/// A request sent with ES's REST API compatibility header for 7.x
+/// (`Accept` or `Content-Type` of
+/// `application/vnd.elasticsearch+json; compatible-with=7`). ES 8 keeps a few
+/// 7.x forms for such a client; `_bulk` uses it to accept `_type`.
+fn wants_rest_compat_v7(headers: &axum::http::HeaderMap) -> bool {
+    [axum::http::header::ACCEPT, axum::http::header::CONTENT_TYPE]
+        .iter()
+        .filter_map(|h| headers.get(h)?.to_str().ok())
+        .any(|v| {
+            v.split(';').any(|param| {
+                param.trim().split_once('=').is_some_and(|(k, v)| {
+                    k.trim().eq_ignore_ascii_case("compatible-with") && v.trim() == "7"
+                })
+            })
+        })
 }
 
 fn bulk_opts_from_query(
@@ -21522,6 +21543,7 @@ async fn process_bulk_body(
     body: &bytes::Bytes,
     _started: Instant,
     opts: xerj_engine::bulk::BulkOpts,
+    compat_v7: bool,
 ) -> axum::response::Response {
     // The request body remains owned by this handler through parsing,
     // grouping, and publication. The opt-in guard is a single branch and
@@ -21538,6 +21560,14 @@ async fn process_bulk_body(
         }
     };
 
+    // ES reads every action line before it runs any action, so a malformed
+    // one refuses the whole request and nothing is written. Checked on the
+    // body as sent, before the rewrites below and before the local and
+    // cluster paths split, so the line number is the client's.
+    if let Some(reason) = crate::bulk_action_lines::first_malformed_action_line(text, compat_v7) {
+        return es_bad_request("illegal_argument_exception", &reason, None);
+    }
+
     // ES bulk NDJSON alternates action-lines and source-lines. We rewrite
     // each source line through apply_ignore_malformed so the downstream
     // bulk pipeline sees a doc with _ignored already populated and any
```

**File**: `engine/crates/xerj-api/src/lib.rs` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ pub mod audit_mw;
 pub mod auth;
 pub mod authz;
 pub mod binary_protocol;
+mod bulk_action_lines;
 pub mod cat;
 pub mod cluster_shard;
 pub mod embed_warning;
```

**File**: `engine/crates/xerj-api/tests/bulk_action_line_refusal.rs` (added, +232/-0)
```diff
@@ -0,0 +1,232 @@
+//! A malformed `_bulk` action line refuses the whole request, as in
+//! Elasticsearch 8, and nothing in the body is written.
+//!
+//! ES parses every action line before it executes any of them
+//! (`BulkRequestParser`), so a bad line is a 400 `illegal_argument_exception`
+//! naming the line, and the actions before it never run. XERJ used to answer
+//! 200 with a per-item error for the bad line and write everything else.
+
+use axum::body::Body;
+use axum::http::{Request, StatusCode};
+use serde_json::Value;
+use tower::ServiceExt;
+
+async fn app() -> (axum::Router, tempfile::TempDir) {
+    let dir = tempfile::tempdir().expect("tempdir");
+    let mut config = xerj_common::config::Config::default();
+    config.server.data_dir = dir.path().to_string_lossy().into_owned();
+    let metrics = xerj_common::metrics::Metrics::new().expect("metrics");
+    let engine = xerj_engine::Engine::new(config.clone()).expect("engine");
+    let state = xerj_api::state::AppState::new(config, engine, metrics);
+    (xerj_api::router::build_es_compat_router(state), dir)
+}
+
+async fn send(app: &axum::Router, method: &str, path: &str, body: &str) -> (StatusCode, Value) {
+    send_as(app, method, path, "application/x-ndjson", body).await
+}
+
+async fn send_as(
+    app: &axum::Router,
+    method: &str,
+    path: &str,
+    content_type: &str,
+    body: &str,
+) -> (StatusCode, Value) {
+    let req = Request::builder()
+        .method(method)
+        .uri(path)
+        .header("content-type", content_type)
+        .body(Body::from(body.to_owned()))
+        .expect("request");
+    let response = app.clone().oneshot(req).await.expect("response");
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
+async fn bulk(app: &axum::Router, body: &str) -> (StatusCode, Value) {
+    send(app, "POST", "/_bulk?refresh=true", body).await
+}
+
+/// The request was refused as a whole with ES's reason.
+fn assert_refused(status: StatusCode, got: &Value, reason: &str) {
+    assert_eq!(status, StatusCode::BAD_REQUEST, "{got}");
+    assert_eq!(got["status"], 400, "{got}");
+    assert_eq!(got["error"]["type"], "illegal_argument_exception", "{got}");
+    assert_eq!(got["error"]["reason"], reason, "{got}");
+    assert_eq!(got["error"]["root_cause"][0]["reason"], reason, "{got}");
+}
+
+async fn doc_exists(app: &axum::Router, index: &str, id: &str) -> bool {
+    let (status, _) = send(app, "GET", &format!("/{index}/_doc/{id}"), "").await;
+    status == StatusCode::OK
+}
+
+#[tokio::test]
+async fn an_empty_action_refuses_the_request_and_writes_nothing() {
+    let (app, _dir) = app().await;
+    let body = "{\"index\":{\"_index\":\"t\",\"_id\":\"1\"}}\n{\"f1\":\"v1\"}\n{}\n";
+    let (status, got) = bulk(&app, body).await;
+    assert_refused(
+        status,
+        &got,
+        "Malformed action/metadata line [3], expected FIELD_NAME but found [END_OBJECT]",
+    );
+    assert!(!doc_exists(&app, "t", "1").await, "the first action ran");
+}
+
+#[tokio::test]
+async fn an_unknown_parameter_refuses_the_request_and_writes_nothing() {
+    let (app, _dir) = app().await;
+    // ES 8 dropped mapping types: `_type` is an unknown parameter now.
+    let body = "{\"index\":{\"_index\":\"t\",\"_id\":\"1\"}}\n{\"a\":1}\n\
+                {\"update\":{\"_index\":\"t\",\"_type\":\"x\",\"_id\":\"1\"}}\n{\"doc\":{\"a\":2}}\n";
+    let (status, got) = bulk(&app, body).await;
+    assert_refused(
+        status,
+        &got,
+        "Action/metadata line [3] contains an unknown parameter [_type]",
+    );
+    assert!(!doc_exists(&app, "t", "1").await, "the first action ran");
+
+    // The ES 7 underscore spellings are unknown too.
+    for key in ["_version", "_routing", "_retry_on_conflict"] {
+        let body =
+            format!("{{\"index\":{{\"_index\":\"t\",\"_id\":\"2\",\"{key}\":1}}}}\n{{\"a\":1}}\n");
+        let (status, got) = bulk(&app, &body).await;
+        assert_refused(
+            status,
+            &got,
+            &format!("Action/metadata line [1] contains an unknown parameter [{key}]"),
+        );
+    }
+    assert!(!doc_exists(&app, "t", "2").await);
+}
+
+#[tokio::test]
+async fn an_unknown_action_is_named_with_its_line() {
+    let (app, _dir) = app().await;
+    // Blank lines count toward the line number, as in ES; a delete has no
+    // source line, so the line after it is the next action.
+    let body = "\n{\"delete\":{\"_index\":\"t\",\"_id\":\"9\"}}\n\n{\"upsert\":{\"_index\":\"t\"}}\n{\"a\":1}\n";
+    let (status, got) = bulk(&app, body).await;
+    assert_refused(
+        status,
+        &got,
+        "Malformed action/metadata line [4], expected field [create], [delete], [index] or [update] but found [upsert]",
+    );
+}
+
+#[tokio::test]
+async fn each_malformed
```

**File**: `engine/tests/es-compat-yaml/catch-lenient.txt` (modified, +0/-2)
```diff
@@ -44,8 +44,6 @@ aggregations/stats_metric_fail_formatting.yml · fail formatting
 aggregations/terms.yml · IP test
 aggregations/top_hits.yml · having
 aggregations/weighted_avg.yml · Multi weight field not allowed
-bulk/10_basic.yml · empty action
-bulk/60_deprecated.yml · Deprecated parameters should fail in Bulk query
 indices/indices.put_template/10_basic.yml · Put template create
 scroll/11_clear.yml · Body params with array param override query string
 scroll/11_clear.yml · Body params with string param scroll id override query string
```

---

### Incident Patch 2: `9892820a` (2026-11-05)
**Commit Message**: fix(aggs): keep composite missing order consistent across pages (#2944)

Explicit missing_order first/last must not reverse with descending order.
Use one comparator for initial ordering and after-key filtering so missing
buckets remain reachable through pagination.

Written with AI assistance and reviewed by parijat1222q. The exact native
regression fails on unchanged production code at ascending/missing-last
pagination and passes after this change. The focused aggregation suite has
118 passing tests, including mixed two-source numeric/missing cases.
Two new YAML cases fail on the unpatched rc.100 release as expected.
Full candidate server/YAML and release validation remain pending fork CI.

Related to xerj-org/xerj#2935, single-index composite missing-order finding.

**File**: `engine/crates/xerj-engine/src/aggs.rs` (modified, +150/-62)
```diff
@@ -8786,44 +8786,60 @@ fn run_composite(
             parts.next().unwrap_or(0),
         )
     }
-    let mut sorted_keys: Vec<Vec<String>> = bucket_map.keys().cloned().collect();
-    sorted_keys.sort_by(|a, b| {
+    // Use exactly the same ordering for the initial sort and cursor filtering.
+    // Explicit missing_order is absolute; only the default follows direction.
+    let cmp_parts = |a: &[String], b: &[String]| -> std::cmp::Ordering {
         use std::cmp::Ordering;
         for i in 0..a.len().min(b.len()) {
             let (av, bv) = (&a[i], &b[i]);
-            let null_cmp = match missing_orders.get(i).copied().unwrap_or("default") {
-                "first" => (Ordering::Less, Ordering::Greater),
-                "last" => (Ordering::Greater, Ordering::Less),
-                _ => (Ordering::Less, Ordering::Greater), // "default" — first
+            let asc = orders.get(i).copied().unwrap_or(true);
+            let null_first = match missing_orders.get(i).copied().unwrap_or("default") {
+                "first" => true,
+                "last" => false,
+                _ => asc,
             };
-            let cmp = if av == "__null__" && bv == "__null__" {
-                Ordering::Equal
-            } else if av == "__null__" {
-                null_cmp.0
-            } else if bv == "__null__" {
-                null_cmp.1
-            } else if geotile_src.get(i).copied().unwrap_or(false) {
-                // Geotile keys sort by (zoom, x, y) numerically.
-                geotile_parse(av).cmp(&geotile_parse(bv))
-            } else {
-                composite_part_cmp(
-                    kinds.get(i).copied().unwrap_or(CompositeKeyKind::Heuristic),
-                    numeric_src.get(i).copied().unwrap_or(false),
-                    av,
-                    bv,
-                )
-            };
-            let cmp = if orders.get(i).copied().unwrap_or(true) {
-                cmp
-            } else {
-                cmp.reverse()
+            let cmp = match (av == "__null__", bv == "__null__") {
+                (true, true) => Ordering::Equal,
+                (true, false) => {
+                    if null_first {
+                        Ordering::Less
+                    } else {
+                        Ordering::Greater
+                    }
+                }
+                (false, true) => {
+                    if null_first {
+                        Ordering::Greater
+                    } else {
+                        Ordering::Less
+                    }
+                }
+                (false, false) => {
+                    let cmp = if geotile_src.get(i).copied().unwrap_or(false) {
+                        geotile_parse(av).cmp(&geotile_parse(bv))
+                    } else {
+                        composite_part_cmp(
+                            kinds.get(i).copied().unwrap_or(CompositeKeyKind::Heuristic),
+                            numeric_src.get(i).copied().unwrap_or(false),
+                            av,
+                            bv,
+                        )
+                    };
+                    if asc {
+                        cmp
+                    } else {
+                        cmp.reverse()
+                    }
+                }
             };
             if cmp != Ordering::Equal {
                 return cmp;
             }
         }
         a.len().cmp(&b.len())
-    });
+    };
+    let mut sorted_keys: Vec<Vec<String>> = bucket_map.keys().cloned().collect();
+    sorted_keys.sort_by(|a, b| cmp_parts(a, b));
 
     // Filter by `after` param for pagination: drop every key <= after-key.
     if let Some(after_obj) = params.get("after").and_then(Value::as_object) {
@@ -8901,40 +8917,6 @@ fn run_composite(
                     .unwrap_or_default()
             })
             .collect();
-        // Compare keys against `after` using the same per-source
-        // numeric/lex semantics as the sort — otherwise `after: {long: 20}`
-        // would keep keys like `"100"` before `"20"` lexicographically.
-        let cmp_parts = |a: &[String], b: &[String]| -> std::cmp::Ordering {
-            use std::cmp::Ordering;
-            for i in 0..a.len().min(b.len()) {
-                let (av, bv) = (&a[i], &b[i]);
-                let c = if av == "__null__" && bv == "__null__" {
-                    Ordering::Equal
-                } else if av == "__null__" {
-                    Ordering::Less
-                } else if bv == "__null__" {
-                    Ordering::Greater
-                } else if geotile_src.get(i).copied().unwrap_or(false) {
-                    geotile_parse(av).cmp(&geotile_parse(bv))
-                } else {
-                    composite_part_cmp(
-                        kinds.get(i).copied().unwrap_or(CompositeKeyKind::Heuristic),
-                        numeric_src.get(i).copied().unwrap_or(false),
-                        av,
-                        bv,
-             
```

**File**: `engine/tests/es-compat-yaml/yaml/aggregations/composite_missing_order_pagination.yml` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+---
+setup:
+  - do:
+      indices.create:
+        index: missing-order-test
+        body:
+          mappings:
+            properties:
+              tag: { type: keyword }
+  - do:
+      index:
+        index: missing-order-test
+        id: "1"
+        body: { tag: "1" }
+  - do:
+      index:
+        index: missing-order-test
+        id: "2"
+        body: { tag: "2" }
+  - do:
+      index:
+        index: missing-order-test
+        id: "3"
+        body: {}
+  - do:
+      indices.refresh:
+        index: missing-order-test
+---
+"missing last survives ascending cursor pagination":
+  - do:
+      search:
+        index: missing-order-test
+        body:
+          size: 0
+          aggs:
+            c:
+              composite:
+                size: 1
+                after: { tag: "2" }
+                sources:
+                  - tag:
+                      terms:
+                        field: tag
+                        missing_bucket: true
+                        missing_order: last
+  - length: { aggregations.c.buckets: 1 }
+  - match: { aggregations.c.buckets.0.key: { tag: null } }
+  - match: { aggregations.c.buckets.0.doc_count: 1 }
+---
+"explicit missing first stays first under descending order":
+  - do:
+      search:
+        index: missing-order-test
+        body:
+          size: 0
+          aggs:
+            c:
+              composite:
+                size: 10
+                sources:
+                  - tag:
+                      terms:
+                        field: tag
+                        order: desc
+                        missing_bucket: true
+                        missing_order: first
+  - length: { aggregations.c.buckets: 3 }
+  - match: { aggregations.c.buckets.0.key: { tag: null } }
+  - match: { aggregations.c.buckets.1.key.tag: "2" }
+  - match: { aggregations.c.buckets.2.key.tag: "1" }
```

---

### Incident Patch 3: `15f6a926` (2026-11-05)
**Commit Message**: chore: add gravion-ux to .contributors (CLA signature) (#2920)

Record acceptance of the XERJ Contributor License Agreement (CLA.md, adapted from the ASF ICLA v2.0): copyright licence and patent licence grants as written there, copyright retained. Signed from the gravion-ux account by opening this PR, per the CLA process.

Written by an AI coding agent (MiniMax M3.1, the MCode desktop agent), run by @gravion-ux (Priyanshu Kumar Thakur), who read CLA.md and stands behind this change.

Co-authored-by: xerj-org <[REDACTED_EMAIL]>

**File**: `.contributors` (modified, +2/-1)
```diff
@@ -101,5 +101,6 @@
   "richuff",
   "badretd",
   "parijat1222q",
-  "napattan"
+  "napattan",
+  "gravion-ux"
 ]
```

#### Recent Merged Pull Requests:
- **PR #2951** (closed): fix(hub): verify the cached catalogue's signature on every read (#2904) (@Irfanwani)
- **PR #2947** (2026-11-05): hub: allow post-audit /add for #2171 withheld logins (@xerj-org)
- **PR #2946** (2026-11-05): seo: restore AI agent memory benchmark pages from #2788 onto main (@xerj-org)
- **PR #2944** (2026-11-05): fix(aggs): keep composite missing order consistent across pages (@parijat1222q)
- **PR #2938** (2026-11-05): fix(api): refuse a malformed _bulk action line for the whole request (@jelbirt)
- **PR #2937** (2026-11-04): fix(api): enforce the search.max_keep_alive cluster setting (@amartya1523)

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

## X. api): refuse a malformed _bulk action line for the whole request (#2938)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c5798431`: api): refuse a malformed _bulk action line for the whole request (#2938). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- `_bulk` refuses a malformed action line the way Elasticsearch 8 does: the
  whole request is a 400 `illegal_argument_exception` naming the line
  (`Malformed action/metadata line [3], expected FIELD_NAME but found
  [END_OBJECT]`, `Action/metadata line [1] contains an unknown parameter
  [_type]`), and nothing in the body is written. XERJ answered 200 with a
  per-item error for that line and wrote every other action. An unknown
  parameter (`_type`, `_version`, `_routing`, a typo) used to be ignored and
  is now refused, as in ES 8; a client sending the 7.x REST compatibility
  header (`compatible-with=7`) may still send `_type`, as ES 8 allows. A line
  the check cannot read with confidence (JSON ES's own parser rejects, an
  escaped key, a byte order mark) stops the check there, and the rest of the
  body is answered as before.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c5798431` are properly handled with clean fallback behavior.
