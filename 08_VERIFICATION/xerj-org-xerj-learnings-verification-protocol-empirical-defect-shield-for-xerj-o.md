# Verification Protocol: Verification Protocol: Empirical Defect Shield for xerj-org-xerj-learnings

<!-- PROVENANCE_START
{
  "source_repository": "xerj-org-xerj-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T02:55:24.363Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-xerj-org-xerj-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xerj-org-xerj-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T02:55:24.363Z`  
> **Learning ID**: `LEARN-EVO-xerj-org-xerj-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `xerj-org-xerj-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source**: github ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Source Version**: `35ccd192`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T02:55:18.884Z  
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
> **Harvest Timestamp**: 2026-11-26T02:55:18.878Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: AI search engine and MCP server for bots and agents. One Rust binary indexes code, docs, logs, JSONL/CSV and PDFs for BM25 full-text, vector and hybrid search, code search without grep, agent memory and RAG. Elasticsearch-compatible API; Corpus Hub serves hundreds of reference memory corpora.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 21526 stars

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

### Incident Patch 1: `e774cf7c` (2026-11-25)
**Commit Message**: fix(autoindex): validate pack source slugs on consume to block path traversal (#3167)

**File**: `engine/crates/xerj-autoindex/src/harvest/pack.rs` (modified, +73/-2)
```diff
@@ -468,8 +468,16 @@ pub fn read_manifest(pack_dir: &Path) -> Result<PackMeta> {
     if sources.is_empty() {
         bail!(at("manifest declares no sources"));
     }
-    if sources.iter().any(|s| s.slug.is_empty()) {
-        bail!(at("a manifest source has no slug"));
+    // #3166: the slug becomes a directory under the corpus on consume
+    // (`corpora/<name>/<slug>`), so it is gated here, before any path is
+    // built from it, using the same gate the recipe build path applies. A
+    // checksum cannot stand in for this: SHA256SUMS is authored by the
+    // same party as the manifest, so a self-consistent malicious pack
+    // verifies clean.
+    for s in &sources {
+        if let Err(e) = xerj_common::xccode::pathgate::valid_slug(&s.slug) {
+            bail!(at(&format!("source slug: {e}")));
+        }
     }
 
     Ok(PackMeta {
@@ -746,6 +754,69 @@ mod tests {
         assert!(err.contains("does not cover manifest.json"), "{err}");
     }
 
+    /// Rewrite SHA256SUMS from the bytes now on disk, so a test that edits
+    /// manifest.json can reach the slug check instead of dying on a
+    /// checksum first.
+    fn rehash_sums(pack_dir: &Path) {
+        let sums_raw = std::fs::read_to_string(pack_dir.join("SHA256SUMS")).unwrap();
+        let mut fresh = String::new();
+        for line in sums_raw.lines() {
+            let (_, name) = line.split_once("  ").unwrap();
+            let file_bytes = std::fs::read(pack_dir.join(name)).unwrap();
+            fresh.push_str(&format!(
+                "{}  {}\n",
+                hex(&Sha256::digest(&file_bytes)),
+                name
+            ));
+        }
+        std::fs::write(pack_dir.join("SHA256SUMS"), fresh).unwrap();
+    }
+
+    /// Rewrite one source slug in an emitted pack's manifest, keeping the
+    /// checksums valid so only the slug gate can refuse it.
+    fn set_source_slug(pack_dir: &Path, slug: &str) {
+        let mut m: Value =
+            serde_json::from_str(&std::fs::read_to_string(pack_dir.join("manifest.json")).unwrap())
+                .unwrap();
+        m["sources"][0]["slug"] = json!(slug);
+        std::fs::write(
+            pack_dir.join("manifest.json"),
+            serde_json::to_vec_pretty(&m).unwrap(),
+        )
+        .unwrap();
+        rehash_sums(pack_dir);
+    }
+
+    /// #3166: a pack manifest may name any slug, and the slug becomes a
+    /// directory under the corpus on consume, so a `../` slug writes
+    /// outside it. The consume path must refuse it, checksums or not: a
+    /// self-consistent malicious pack verifies clean.
+    #[test]
+    fn read_manifest_refuses_a_traversal_source_slug() {
+        let tmp = tempfile::tempdir().unwrap();
+        let records = vec![rec("a", &[])];
+        let r = emit(
+            tmp.path(),
+            &recipe("t", 1),
+            "# r\n",
+            records.clone(),
+            &stats_with_source(),
+            &sugg(&records),
+        )
+        .unwrap();
+        for bad in ["../../tmp/pwn", "..", "a/b", ".hidden", ""] {
+            set_source_slug(&r.dir, bad);
+            let err = read_manifest(&r.dir).unwrap_err().to_string();
+            assert!(err.contains("source slug"), "{bad}: {err}");
+            assert!(err.contains(bad) || bad.is_empty(), "{bad}: {err}");
+        }
+        // a plain slug with the same charset the recipe build path allows
+        // still consumes: the gate must not reject real packs.
+        set_source_slug(&r.dir, "a-b_c.d");
+        let meta = read_manifest(&r.dir).unwrap();
+        assert_eq!(meta.sources[0].slug, "a-b_c.d");
+    }
+
     #[test]
     fn read_manifest_refuses_manifest_and_sums_disagreement() {
         // A manifest whose files[] sha disagrees with SHA256SUMS: caught
```

**File**: `engine/crates/xerj-autoindex/src/harvest/recipe.rs` (modified, +3/-11)
```diff
@@ -371,18 +371,10 @@ fn d_sample() -> usize {
 
 /// A slug becomes a filename component in the content store
 /// (`<slug>.<key>.json`), so it is gated to a safe charset the way corpus
-/// and repo names are — but locally, because slugs are a builder concept.
+/// and repo names are. The gate lives in `xccode::pathgate` so the pack
+/// consume path shares it (#3166): one rule, builder and consumer.
 fn valid_slug(slug: &str) -> Result<()> {
-    let ok = !slug.is_empty()
-        && slug.len() <= 64
-        && slug
-            .chars()
-            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
-        && !slug.starts_with('.');
-    if !ok {
-        bail!("source slug '{slug}' must be 1-64 chars of [A-Za-z0-9._-], not starting with '.'");
-    }
-    Ok(())
+    xerj_common::xccode::pathgate::valid_slug(slug).map_err(anyhow::Error::msg)
 }
 
 /// Read, validate and compile a recipe. Every error names the file and the
```

**File**: `engine/crates/xerj-autoindex/src/xc.rs` (modified, +81/-4)
```diff
@@ -2026,7 +2026,14 @@ fn run_corpus_add_pack(
     }
     let mut total = 0usize;
     for s in &meta.sources {
-        let count = std::fs::read_to_string(dest.join(&s.slug).join("records.jsonl"))
+        let path = match pack_slug_dir(&dest, &s.slug) {
+            Ok(dir) => dir.join("records.jsonl"),
+            Err(e) => {
+                eprintln!("xerj corpus add: {e:#}");
+                return 1;
+            }
+        };
+        let count = std::fs::read_to_string(path)
             .map(|t| t.lines().filter(|l| !l.trim().is_empty()).count())
             .unwrap_or(0);
         total += count;
@@ -2058,6 +2065,24 @@ fn run_corpus_add_pack(
     0
 }
 
+/// Join a pack slug onto the corpus dir, refusing anything that would
+/// escape it. The slug is gated in `read_manifest`, but the stored
+/// corpus.json on disk predates that gate, so the join itself refuses a
+/// bad name too; resolving the parent first keeps a symlink planted
+/// inside the corpus dir from redirecting the write or the re-add delete
+/// outside it (#3166).
+fn pack_slug_dir(dest: &Path, slug: &str) -> Result<PathBuf> {
+    xccode::pathgate::valid_slug(slug).map_err(anyhow::Error::msg)?;
+    let base = dest
+        .canonicalize()
+        .with_context(|| format!("cannot resolve {}", dest.display()))?;
+    let dir = base.join(slug);
+    if !dir.starts_with(&base) {
+        anyhow::bail!("pack slug '{slug}' escapes {}", dest.display());
+    }
+    Ok(dir)
+}
+
 /// Copy the pack's records into `corpora/<name>/<slug>/records.jsonl`
 /// (verbatim lines — the pack line IS canonical JSON), reconcile away slug
 /// dirs a previous add owned that this pack no longer has, and write the
@@ -2080,7 +2105,10 @@ fn add_pack_materialize(
     // or a re-add APPENDS to the old records.jsonl and duplicates every line
     if let Ok(prev) = manifest::read_corpus_manifest(&dest.join("corpus.json")) {
         for r in &prev.repos {
-            let _ = std::fs::remove_dir_all(dest.join(&r.repo));
+            // a stored repo predates the slug gate: refuse to delete
+            // outside the corpus dir rather than trusting the name (#3166)
+            let dir = pack_slug_dir(dest, &r.repo)?;
+            let _ = std::fs::remove_dir_all(&dir);
         }
     }
     std::fs::create_dir_all(dest).with_context(|| format!("cannot create {}", dest.display()))?;
@@ -2127,7 +2155,7 @@ fn add_pack_materialize(
     let mut counts: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
     for (slug, mut records) in by_slug {
         records.sort_by(|a, b| a.0.cmp(&b.0));
-        let dir = dest.join(&slug);
+        let dir = pack_slug_dir(dest, &slug)?;
         std::fs::create_dir_all(&dir)
             .with_context(|| format!("cannot create {}", dir.display()))?;
         let path = dir.join("records.jsonl");
@@ -2143,7 +2171,7 @@ fn add_pack_materialize(
 
     let mut entries = Vec::new();
     for s in &meta.sources {
-        let path = dest.join(&s.slug).join("records.jsonl");
+        let path = pack_slug_dir(dest, &s.slug)?.join("records.jsonl");
         let bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
         entries.push(manifest::ManifestRepo {
             repo: s.slug.clone(),
@@ -3991,6 +4019,55 @@ mod tests {
         assert!(xccode::pathgate::valid_corpus_name("battle-terse").is_ok());
     }
 
+    /// #3166: the re-add reconcile deletes every dir the previous
+    /// corpus.json owned, and the stored repo is the pack slug. A corpus
+    /// materialized before the slug gate (or a hand-edited corpus.json)
+    /// can hold `..` as its repo, which would delete the whole corpora
+    /// dir. The re-add must refuse instead, and nothing outside the
+    /// corpus dir may be touched.
+    #[test]
+    fn re_add_with_a_dotdot_repo_does_not_delete_outside_the_corpus() {
+        let tmp = tempfile::tempdir().unwrap();
+        let dest = tmp.path().join("corpora").join("evil");
+        std::fs::create_dir_all(&dest).unwrap();
+        // a sibling file outside dest that must survive the re-add
+        let keep = tmp.path().join("corpora").join("keep.txt");
+        std::fs::write(&keep, "keep\n").unwrap();
+        // a previous add's corpus.json naming `..` as its repo
+        std::fs::write(
+            dest.join("corpus.json"),
+            r#"{"corpus":"evil","kind":"harvested","repos":[{"repo":"..","url":"","licence":"CC0-1.0"}]}"#,
+        )
+        .unwrap();
+        // a pack with one good record
+        let pack_dir = tmp.path().join("pack");
+        std::fs::create_dir_all(&pack_dir).unwrap();
+        std::fs::write(
+            pack_dir.join("records-0.jsonl"),
+            "{\"id\":\"a\",\"source\":\"good\"}\n",
+        )
+        .unwrap();
+        let meta = crate::harvest::pack::PackMeta {
+            name: "evil".to_string(),
+            description: String::new(),
+            generation: 1,
+            records: 1,
+            sources: ve
```

**File**: `engine/crates/xerj-common/src/xccode/pathgate.rs` (modified, +53/-0)
```diff
@@ -126,6 +126,32 @@ pub fn valid_repo_name(repo: &str) -> Result<(), String> {
     ))
 }
 
+/// Validate a pack source slug from an untrusted manifest: 1-64 chars of
+/// `[A-Za-z0-9._-]`, not starting with `.`.
+///
+/// The slug becomes a directory under the corpus
+/// (`corpora/<name>/<slug>`), so the rule is the one the recipe build path
+/// has always applied locally: a `/` or a leading `.` would let a crafted
+/// pack write or delete outside the corpus dir on consume (#3166). The
+/// build path and the consume path now share this one gate, so a pack the
+/// builder accepts is a pack the consumer accepts, and nothing else.
+pub fn valid_slug(slug: &str) -> Result<(), String> {
+    let ok = !slug.is_empty()
+        && slug.len() <= 64
+        && slug
+            .chars()
+            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
+        && !slug.starts_with('.');
+    if ok {
+        Ok(())
+    } else {
+        Err(format!(
+            "source slug '{slug}' must be 1-64 chars of [A-Za-z0-9._-], not starting with '.'. \
+             It becomes a directory under the corpus, so a '/' or '..' would escape it."
+        ))
+    }
+}
+
 /// How many paths one repo entry may name. A harvest is a few subtrees
 /// (`data/osv`) or files, not a file list; past this, name a parent.
 pub const MAX_SPARSE_PATHS: usize = 32;
@@ -315,6 +341,33 @@ mod tests {
         }
     }
 
+    /// #3166: the pack source slug becomes a directory under the corpus,
+    /// so the consume path and the recipe build path share this gate. The
+    /// build path's old charset is kept exactly (uppercase and a leading
+    /// `-` included), so a pack the builder accepted still consumes.
+    #[test]
+    fn unsafe_pack_slugs_are_rejected_with_the_path_escape_reason() {
+        let too_long = "x".repeat(65);
+        for bad in [
+            "../escape",
+            "a/b",
+            ".hidden",
+            "..",
+            "",
+            "a b",
+            too_long.as_str(),
+        ] {
+            let err = valid_slug(bad).unwrap_err();
+            assert!(
+                err.contains("escapes") || err.contains("escape"),
+                "the message must say why: {err}"
+            );
+        }
+        for good in ["rustsec", "osv-crates-io", "a.b_c-1", "X9", "-lead", "a"] {
+            assert!(valid_slug(good).is_ok(), "{good:?}");
+        }
+    }
+
     #[test]
     fn short_shas_are_rejected_with_regen_advice() {
         let err = valid_sha("valkey", "e449d17").unwrap_err();
```

---

### Incident Patch 2: `35ccd192` (2026-11-25)
**Commit Message**: fix(autoindex): cap CSV record size so one quoted field cannot allocate the whole file (#3202)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -1050,6 +1050,7 @@ The model, its bundle and its serve rule are those of rc.102.
   per-aggregation cap from `limits.max_buckets` still applies too, so a
   setting above it does not raise that cap. `_async_search`,
   `_search/template` and `_msearch/template` do not read the setting yet.
+- The CSV extractor now caps one record at 16 MiB of decoded bytes (issue [#3201](https://github.com/xerj-org/xerj/issues/3201)). A quoted field may span newlines, so a single record could previously be as large as the whole input stream: the parser buffered it all before returning it. An oversize record is now counted as junk and extraction stops there, with the records before it still indexed; an oversize header row junks the file instead of failing it, so one hostile file cannot abort the whole autoindex run.
 
 ## [1.0.0-rc.102] - 2026-11-06
 
```

**File**: `engine/crates/xerj-autoindex/src/extract/csv_x.rs` (modified, +85/-4)
```diff
@@ -1,10 +1,14 @@
 //! CSV with sniffed dialect (delimiter / header / decimal-comma), streaming.
 
-use super::{sanitize_field_name, ExtractStats, FieldOrigin, RawRecord, Sink};
+use super::{
+    sanitize_field_name, ExtractStats, FieldOrigin, RawRecord, RecordByteCap, Sink,
+    MAX_CSV_RECORD_BYTES,
+};
 use crate::sniff::Sniffed;
 use anyhow::Result;
 use serde_json::{Map, Value};
 use std::path::Path;
+use std::sync::Arc;
 
 pub fn extract(
     path: &Path,
@@ -17,14 +21,36 @@ pub fn extract(
         has_header: true,
         decimal_comma: false,
     });
-    let r = super::open_reader(path, sn.gzip, limit_bytes)?;
+    // #3201: one quoted field may span newlines, so a single record can be
+    // as large as the whole input stream. The Rust csv crate offers no
+    // record or field size option, so the bound lives in the reader: the
+    // parser errors once one record has consumed more than the cap, before
+    // the allocation happens. The reference is Python's csv module, which
+    // has enforced a per-field limit since 2003 (Modules/_csv.c,
+    // parse_add_char: "field larger than field limit"), because an unmatched
+    // quote could otherwise read the entire file into the field buffer.
+    let cap = Arc::new(RecordByteCap::new(MAX_CSV_RECORD_BYTES as u64));
+    let r = super::open_reader_with_cap(path, sn.gzip, limit_bytes, Some(&cap))?;
     let mut rdr = csv::ReaderBuilder::new()
         .delimiter(dialect.delim)
         .has_headers(dialect.has_header)
         .flexible(true)
         .from_reader(r);
+    let mut stats = ExtractStats::default();
     let headers: Vec<String> = if dialect.has_header {
-        let h = rdr.headers()?.clone();
+        let h = match rdr.headers() {
+            Ok(h) => h.clone(),
+            Err(_) if cap.tripped() => {
+                // An oversize header must junk-file the file, never fail it:
+                // an extract error aborts the whole autoindex run unless the
+                // file changed mid-run, so one hostile file must not take
+                // the run down with it.
+                stats.junk += 1;
+                return Ok(stats);
+            }
+            Err(e) => return Err(e.into()),
+        };
+        cap.reset();
         let mut seen = std::collections::HashSet::new();
         h.iter()
             .map(|f| {
@@ -40,15 +66,23 @@ pub fn extract(
         Vec::new()
     };
     let decimal_comma_re = regex::Regex::new(r"^-?\d{1,12},\d+$").unwrap();
-    let mut stats = ExtractStats::default();
     for (i, rec) in rdr.into_records().enumerate() {
         let rec = match rec {
             Ok(r) => r,
             Err(_) => {
                 stats.junk += 1;
+                if cap.tripped() {
+                    // The parser is mid-record inside the oversize field,
+                    // so resuming would re-read the same field past the cap.
+                    // Stop here: the loss is counted as junk, and the
+                    // records before it still extract.
+                    break;
+                }
+                cap.reset();
                 continue;
             }
         };
+        cap.reset();
         let mut fields = Map::new();
         for (j, val) in rec.iter().enumerate() {
             let name = if j < headers.len() {
@@ -235,6 +269,53 @@ mod tests {
         assert_eq!(recs[0].fields["x"], serde_json::json!("1"));
     }
 
+    /// #3201: one quoted field may span newlines, so a single record can be
+    /// as large as the whole input. The per-record cap must junk-count it
+    /// and stop there; the rows after it are never reached, because the
+    /// parser is mid-record inside the oversize field and cannot resume.
+    #[test]
+    fn a_record_over_the_cap_is_counted_as_junk_and_extraction_stops_there() {
+        let mut bytes = b"a,b\n1,ok\n\"".to_vec();
+        bytes.extend_from_slice(&vec![b'x'; MAX_CSV_RECORD_BYTES + (1 << 20)]);
+        bytes.extend_from_slice(b"\",2\n3,fine\n");
+        let (stats, recs) = ok(&sniffed(b',', true, false), &bytes);
+        assert_eq!(stats.records, 1, "only the row before the oversize one");
+        assert_eq!(stats.junk, 1, "the oversize record is counted, not dropped");
+        assert_eq!(recs.len(), 1);
+        assert_eq!(recs[0].fields["b"], serde_json::json!("ok"));
+    }
+
+    /// A field 1 MiB under the cap must still extract unchanged.
+    #[test]
+    fn a_record_just_under_the_cap_still_extracts() {
+        let mut bytes = b"a,b\n\"".to_vec();
+        bytes.extend_from_slice(&vec![b'x'; MAX_CSV_RECORD_BYTES - (1 << 20)]);
+        bytes.extend_from_slice(b"\",2\n");
+        let (stats, recs) = ok(&sniffed(b',', true, false), &bytes);
+        assert_eq!(stats.records, 1);
+        assert_eq!(stats.junk, 0);
+        assert_eq!(recs[0].fields["b"], serde_json::json!("2"));
+        assert_eq!(
+            recs[0].fields["a"].as_str().unwrap().len(),
+            MAX_CSV_RECORD_BYTES - (1 << 20)
+ 
```

**File**: `engine/crates/xerj-autoindex/src/extract/mod.rs` (modified, +116/-1)
```diff
@@ -38,7 +38,8 @@ use serde::{Deserialize, Serialize};
 use serde_json::{Map, Value};
 use std::io::{BufRead, BufReader, Read};
 use std::path::Path;
-use std::sync::{Condvar, Mutex};
+use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
+use std::sync::{Arc, Condvar, Mutex};
 use std::time::{Duration, Instant};
 
 /// Where a record's FIELD NAMES came from — the input to dataset clustering.
@@ -108,6 +109,24 @@ pub type Sink<'a> = &'a mut dyn FnMut(RawRecord) -> bool;
 
 pub const MAX_LINE: usize = 16 << 20; // 16MB line cap
 pub const MAX_WHOLE_FILE: u64 = 64 << 20; // whole-file parse cap (json/html/yaml/txt)
+
+/// Hard cap on one CSV record, in decoded bytes (#3201).
+///
+/// The `csv` crate offers no record or field size option (`ReaderBuilder`
+/// has none), and a quoted field may span newlines, so one record can be as
+/// large as the whole input stream: the parser buffers it all before
+/// returning it, then each field is copied into a `String` and a JSON map.
+/// Same 16 MiB per-unit convention as [`MAX_LINE`] (JSONL) and the YAML
+/// whole-file cap, so a record over it is refused at read time, before the
+/// allocation happens. A record over the 8 MiB indexed-document ceiling
+/// would be refused downstream anyway; the read cap is the memory bound.
+///
+/// Enforced on decoded bytes consumed since the last completed record, so
+/// up to one buffered fill (the 256 KiB `BufReader` below, plus the `csv`
+/// crate's own read chunk) of read-ahead may be attributed to the record in
+/// flight. The enforced threshold is therefore the cap minus at most that
+/// much, and the error is always fail-closed, never late by more than it.
+pub const MAX_CSV_RECORD_BYTES: usize = 16 << 20;
 /// Target characters per document section.
 ///
 /// Was 32 KB, which is a *storage* granularity, not a *retrieval* one: BM25
@@ -145,6 +164,95 @@ const WORD_SNAP_BYTES: usize = 64;
 /// Open a (possibly gzipped) file as a buffered reader of DECODED-transparent
 /// bytes, optionally capped at `limit` decoded bytes (sampling).
 pub fn open_reader(path: &Path, gzip: bool, limit: Option<u64>) -> Result<Box<dyn BufRead + Send>> {
+    open_reader_with_cap(path, gzip, limit, None)
+}
+
+/// Shared per-record byte budget for the CSV extractor (#3201).
+///
+/// The `csv` crate reads records through the `Read` it is given and cannot
+/// be told to stop inside a record, so the budget lives in the reader: the
+/// extractor holds the other end of the `Arc` and calls [`reset`] after each
+/// completed record (and after the header). Bytes already pulled into the
+/// parser's buffers are counted at read time, so [`tripped`] may fire while
+/// the parser still holds up to one buffered fill past the cap; the
+/// allocation it guards stays bounded at the cap plus that fill.
+pub struct RecordByteCap {
+    cap: u64,
+    used: AtomicU64,
+    tripped: AtomicBool,
+}
+
+impl RecordByteCap {
+    pub fn new(cap: u64) -> Self {
+        Self {
+            cap,
+            used: AtomicU64::new(0),
+            tripped: AtomicBool::new(false),
+        }
+    }
+
+    /// Start the budget for the next record. Call after each record the
+    /// parser returns, including the header row.
+    pub fn reset(&self) {
+        self.used.store(0, Ordering::Relaxed);
+    }
+
+    /// True once a record has consumed more than the cap. Latched: the
+    /// parser is mid-record inside the oversize field and cannot resume, so
+    /// the caller must stop extraction, never reset and continue.
+    pub fn tripped(&self) -> bool {
+        self.tripped.load(Ordering::Relaxed)
+    }
+}
+
+/// A `Read` that errors once the shared [`RecordByteCap`] is spent. The
+/// bytes that pushed it over are consumed and dropped: the caller is
+/// aborting the file anyway, and handing them to the parser would only grow
+/// the record the cap exists to bound.
+struct CappedReader<R: Read> {
+    inner: R,
+    cap: Arc<RecordByteCap>,
+}
+
+impl<R: Read> Read for CappedReader<R> {
+    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
+        if self.cap.tripped() {
+            return Err(std::io::Error::new(
+                std::io::ErrorKind::InvalidData,
+                format!(
+                    "CSV record exceeds the {}-byte per-record cap",
+                    self.cap.cap
+                ),
+            ));
+        }
+        let n = self.inner.read(buf)?;
+        if n > 0 {
+            let used = self.cap.used.fetch_add(n as u64, Ordering::Relaxed) + n as u64;
+            if used > self.cap.cap {
+                self.cap.tripped.store(true, Ordering::Relaxed);
+                return Err(std::io::Error::new(
+                    std::io::ErrorKind::InvalidData,
+                    format!(
+                        "CSV record exceeds the {}-byte per-record cap",
+                        self.cap.cap
+                    ),
+                ));
+            }
+        }
+        Ok(n)
+    }
+}
+
+/// [`open_
```

---

### Incident Patch 3: `dc5fc1b9` (2026-11-25)
**Commit Message**: fix(engine): term-level queries on unmapped sub-fields match nothing (#3652)

Refs #3533.

**File**: `engine/crates/xerj-api/tests/match_unmapped_subfield_empty.rs` (modified, +146/-0)
```diff
@@ -174,6 +174,40 @@ async fn match_on_unmapped_subfield_returns_empty_before_and_after_flush() {
         (json!({"match": {"title.raw.extra": "fruit"}}), vec![]),
         (json!({"match": {"title.keyword.raw": "Fruit"}}), vec![]),
         (json!({"match": {"obj.name.raw": "fruit"}}), vec![]),
+        // Issue #3533: term-level leaves on the unmapped sub-field match nothing.
+        (json!({"term": {"title.raw": "Fruit"}}), vec![]),
+        (json!({"terms": {"title.raw": ["fruit", "Fruit"]}}), vec![]),
+        (json!({"range": {"title.raw": {"gte": "a"}}}), vec![]),
+        (json!({"regexp": {"title.raw": "fru.*"}}), vec![]),
+        (json!({"exists": {"field": "title.raw"}}), vec![]),
+        (
+            json!({"constant_score": {"filter": {"term": {"title.raw": "Fruit"}}}}),
+            vec![],
+        ),
+        (
+            json!({"bool": {"must": [{"term": {"title.raw": "Fruit"}}]}}),
+            vec![],
+        ),
+        (
+            json!({"bool": {"must_not": [{"term": {"title.raw": "Fruit"}}]}}),
+            vec!["1", "2", "3"],
+        ),
+        (
+            json!({"bool": {"filter": [{"exists": {"field": "title.raw"}}]}}),
+            vec![],
+        ),
+        (json!({"term": {"title.raw.extra": "Fruit"}}), vec![]),
+        (json!({"term": {"title.keyword.raw": "Fruit"}}), vec![]),
+        (json!({"term": {"obj.name.raw": "Fruit"}}), vec![]),
+        (json!({"exists": {"field": "obj.name.raw"}}), vec![]),
+        // Mapped term-level controls keep working.
+        (json!({"term": {"title.keyword": "Fruit"}}), vec!["1"]),
+        (json!({"term": {"title.keyword": "fruit salad"}}), vec!["2"]),
+        (json!({"exists": {"field": "title"}}), vec!["1", "2", "3"]),
+        (
+            json!({"exists": {"field": "title.keyword"}}),
+            vec!["1", "2", "3"],
+        ),
         // Mapped multi-fields keep #3495 behaviour, and mapped parents stay unchanged.
         (json!({"match": {"title.keyword": "fruit"}}), vec![]),
         (json!({"match": {"title.keyword": "Fruit"}}), vec!["1"]),
@@ -201,6 +235,12 @@ async fn match_on_unmapped_subfield_returns_empty_before_and_after_flush() {
                 "size": 0,
                 "aggs": {
                     "unmapped_raw": { "filter": { "match": { "title.raw": "fruit" } } },
+                    // #3533: term-level agg filters on the unmapped sub-field.
+                    "unmapped_term": { "filter": { "term": { "title.raw": "Fruit" } } },
+                    "unmapped_terms": { "filter": { "terms": { "title.raw": ["fruit", "Fruit"] } } },
+                    "unmapped_range": { "filter": { "range": { "title.raw": { "gte": "a" } } } },
+                    "unmapped_regexp": { "filter": { "regexp": { "title.raw": "fru.*" } } },
+                    "unmapped_exists": { "filter": { "exists": { "field": "title.raw" } } },
                     "mixed_bool_must": {
                         "filter": {
                             "bool": {
@@ -237,6 +277,19 @@ async fn match_on_unmapped_subfield_returns_empty_before_and_after_flush() {
             json!(0),
             "{phase}: agg filter on unmapped title.raw must match 0"
         );
+        for (name, want) in [
+            ("unmapped_term", 0),
+            ("unmapped_terms", 0),
+            ("unmapped_range", 0),
+            ("unmapped_regexp", 0),
+            ("unmapped_exists", 0),
+        ] {
+            assert_eq!(
+                agg_resp["aggregations"][name]["doc_count"],
+                json!(want),
+                "{phase}: agg filter {name} on unmapped title.raw must match {want}"
+            );
+        }
         assert_eq!(
             agg_resp["aggregations"]["mixed_bool_must"]["doc_count"],
             json!(0),
@@ -354,6 +407,47 @@ async fn explicit_mapping_keeps_declared_multifield_and_rejects_undeclared_sibli
             vec!["1"],
             "{phase}: declared title.raw"
         );
+        // #3533: term-level leaves on a DECLARED multi-field keep working.
+        assert_eq!(
+            ids(
+                &app,
+                "explicit_mf",
+                &json!({"term": {"title.raw": "Fruit"}})
+            )
+            .await,
+            vec!["1"],
+            "{phase}: declared title.raw term"
+        );
+        assert_eq!(
+            ids(
+                &app,
+                "explicit_mf",
+                &json!({"term": {"title.raw": "fruit"}})
+            )
+            .await,
+            Vec::<String>::new(),
+            "{phase}: declared title.raw term case-sensitive"
+        );
+        assert_eq!(
+            ids(
+                &app,
+                "explicit_mf",
+                &json!({"exists": {"field": "title.raw"}})
+            )
+            .await,
+            vec!["1", "2"],
+            "{phase}: declared title.raw exists"
+        );
+        assert_eq!(
+            ids(
+                &app,
+                "explicit_mf",
+                &json
```

**File**: `engine/crates/xerj-engine/src/aggs.rs` (modified, +37/-0)
```diff
@@ -7383,6 +7383,23 @@ fn run_filters(
 /// (must/filter/must_not/should). Unknown clause types are NOT a match
 /// (#959); clauses the query parser rejects are surfaced as an error at
 /// run_filter/run_filters entry instead.
+/// #3533: true when `field` is an unmapped leaf sub-field under the schema
+/// the current agg filter runs against (see `FILTER_SCHEMA`). A term-level
+/// filter leaf on such a field names a field that does not exist, so it
+/// matches nothing in ES (`extract_field_values` would otherwise strip the
+/// suffix and read the parent value. A declared multi-field is not unmapped
+/// and keeps matching. With no schema in scope this is false; with a live
+/// schema it fires for dynamically mapped parents too, which is why
+/// `fast_aggs_multifield_suffix`'s brute leg moved to 0 for filter leaves
+/// on `<field>.raw` (see the #3533 note there).
+fn filter_field_is_unmapped_leaf_subfield(field: &str) -> bool {
+    FILTER_SCHEMA.with(|cell| {
+        cell.borrow()
+            .as_ref()
+            .is_some_and(|s| crate::index::is_unmapped_leaf_subfield(s, field))
+    })
+}
+
 pub(crate) fn doc_matches_filter(doc: &Value, filter: &Value) -> bool {
     let obj = match filter.as_object() {
         Some(o) => o,
@@ -7395,6 +7412,10 @@ pub(crate) fn doc_matches_filter(doc: &Value, filter: &Value) -> bool {
             "term" => {
                 if let Some(field_map) = query_body.as_object() {
                     for (field, expected) in field_map {
+                        // #3533: an unmapped leaf sub-field matches nothing.
+                        if filter_field_is_unmapped_leaf_subfield(field) {
+                            return false;
+                        }
                         let actual_values = extract_field_values(doc, field);
                         let expected_str = match expected {
                             Value::Object(o) => o.get("value").map(value_to_string),
@@ -7411,6 +7432,10 @@ pub(crate) fn doc_matches_filter(doc: &Value, filter: &Value) -> bool {
             "terms" => {
                 if let Some(field_map) = query_body.as_object() {
                     for (field, expected_vals) in field_map {
+                        // #3533: an unmapped leaf sub-field matches nothing.
+                        if filter_field_is_unmapped_leaf_subfield(field) {
+                            return false;
+                        }
                         if let Some(arr) = expected_vals.as_array() {
                             let expected_strs: Vec<String> =
                                 arr.iter().map(value_to_string).collect();
@@ -7529,6 +7554,10 @@ pub(crate) fn doc_matches_filter(doc: &Value, filter: &Value) -> bool {
             "regexp" => {
                 if let Some(field_map) = query_body.as_object() {
                     for (field, expected) in field_map {
+                        // #3533: an unmapped leaf sub-field matches nothing.
+                        if filter_field_is_unmapped_leaf_subfield(field) {
+                            return false;
+                        }
                         let actual_values = extract_field_values(doc, field);
                         let (pattern, case_insensitive) = match expected {
                             Value::Object(o) => (
@@ -7570,6 +7599,10 @@ pub(crate) fn doc_matches_filter(doc: &Value, filter: &Value) -> bool {
             "exists" => {
                 // exists: {"field": "price"} — match docs that have the field.
                 if let Some(field) = query_body.get("field").and_then(Value::as_str) {
+                    // #3533: an unmapped leaf sub-field has no value of its own.
+                    if filter_field_is_unmapped_leaf_subfield(field) {
+                        return false;
+                    }
                     // #1260: a field whose value is directly an OBJECT counts
                     // as present.  `extract_field_values` flattens objects to
                     // `[]` while the query path's `value_present`
@@ -7588,6 +7621,10 @@ pub(crate) fn doc_matches_filter(doc: &Value, filter: &Value) -> bool {
             "range" => {
                 if let Some(field_map) = query_body.as_object() {
                     for (field, bounds) in field_map {
+                        // #3533: an unmapped leaf sub-field matches nothing.
+                        if filter_field_is_unmapped_leaf_subfield(field) {
+                            return false;
+                        }
                         let values = extract_field_values(doc, field);
                         if values.is_empty() {
                             return false;
```

**File**: `engine/crates/xerj-engine/src/index.rs` (modified, +158/-32)
```diff
@@ -53019,6 +53019,15 @@ fn query_has_unmapped_leaf_subfield(q: &QueryNode, schema: &Schema) -> bool {
         | QueryNode::Wildcard { field, .. }
         | QueryNode::Fuzzy { field, .. }
         | QueryNode::Intervals { field, .. } => is_unmapped_leaf_subfield(schema, field),
+        // #3533: term-level leaves on an unmapped sub-field are lowered too,
+        // so a bare `term` / `exists` query must also trip this pre-check or
+        // the lowering below never runs for it.
+        QueryNode::Term { field, .. }
+        | QueryNode::Terms { field, .. }
+        | QueryNode::Range { field, .. }
+        | QueryNode::Regexp { field, .. }
+        | QueryNode::SpanTerm { field, .. }
+        | QueryNode::Exists { field } => is_unmapped_leaf_subfield(schema, field),
         QueryNode::MultiMatch { fields, .. } | QueryNode::SimpleQueryString { fields, .. } => {
             fields
                 .iter()
@@ -53839,7 +53848,10 @@ fn lower_lexically_typeless_clauses(
 /// whatever the mapping says, so those clauses are lowered to `match_none`
 /// before any path decision, with the same folds as the typeless pass below.
 fn lower_unmapped_clauses(q: &QueryNode, hidden: &dyn Fn(&str) -> bool) -> QueryNode {
-    lower_clauses_naming(q, hidden, hidden, true)
+    // No unmapped-leaf term lowering here: `hidden` already covers the
+    // `dynamic: false` cases, and a dotted sub-field of a declared leaf is
+    // caught by the `lower_unsatisfiable_clauses` pass instead.
+    lower_clauses_naming(q, hidden, hidden, &|_| false, true)
 }
 
 /// Whether `field` is one a root `dynamic: false` keeps out of the index: a
@@ -53960,7 +53972,10 @@ fn hidden_by_dynamic_false(
 /// naming an undeclared sub-field of a declared leaf field (`title.raw`, #3515)
 /// to `MatchNone`, then fold the resulting `MatchNone` nodes through `Bool`,
 /// `Constant`, and `Boosted` so they never fall back to a stored-doc scan that
-/// strips unknown suffixes or walks unindexed vectors.
+/// strips unknown suffixes or walks unindexed vectors. #3533 extends the same
+/// lowering to the term-level leaves (`term`, `terms`, `range`, `regexp`,
+/// `span_term`) and `exists` on those sub-fields: the field does not exist,
+/// so ES matches nothing there either.
 fn lower_unsatisfiable_clauses(
     q: &QueryNode,
     typeless: &std::collections::HashSet<String>,
@@ -53970,20 +53985,24 @@ fn lower_unsatisfiable_clauses(
         q,
         &|field: &str| typeless.contains(field),
         &|field: &str| typeless.contains(field) || is_unmapped_leaf_subfield(schema, field),
+        &|field: &str| is_unmapped_leaf_subfield(schema, field),
         false,
     )
 }
 
 /// The shared lowering walk. `unsatisfiable` flags a field no leaf can match
 /// (typeless #328, unmapped under `dynamic: false` #3514); `fulltext_dead`
 /// additionally flags fields only FULL-TEXT leaves and `fields` lists cannot
-/// match (an unmapped sub-field of a declared leaf, #3515) — term-level
-/// leaves on those keep today's behaviour (#3533). `exists_too` also lowers
-/// `exists`.
+/// match (an unmapped sub-field of a declared leaf, #3515); `unmapped_leaf`
+/// flags exactly that unmapped-sub-field case for the TERM-LEVEL leaves and
+/// `exists` (#3533), kept separate from `fulltext_dead` because a typeless
+/// (vector) field is dead for full-text but alive for `exists`, which ES
+/// answers from `_source` / doc values. `exists_too` also lowers `exists`.
 fn lower_clauses_naming(
     q: &QueryNode,
     unsatisfiable: &dyn Fn(&str) -> bool,
     fulltext_dead: &dyn Fn(&str) -> bool,
+    unmapped_leaf: &dyn Fn(&str) -> bool,
     exists_too: bool,
 ) -> QueryNode {
     // One entry of a `fields: [...]` list. `"emb^3"` carries a boost.
@@ -54035,15 +54054,22 @@ fn lower_clauses_naming(
                 .collect(),
         )
     };
-    let recurse = |c: &QueryNode| lower_clauses_naming(c, unsatisfiable, fulltext_dead, exists_too);
+    let recurse = |c: &QueryNode| {
+        lower_clauses_naming(c, unsatisfiable, fulltext_dead, unmapped_leaf, exists_too)
+    };
     match q {
         // ── Leaves that name exactly one field ────────────────────────────
+        // #3533: term-level leaves on an unmapped leaf sub-field lower to
+        // MatchNone like the full-text ones, since the field does not exist, so
+        // ES matches nothing. A typeless (vector) field is already covered
+        // by `unsatisfiable`; a declared multi-field is not unmapped, so it
+        // keeps matching.
         QueryNode::Term { field, .. }
         | QueryNode::Terms { field, .. }
         | QueryNode::Range { field, .. }
         | QueryNode::Regexp { field, .. }
         | QueryNode::SpanTerm { field, .. } => {
-            if unsatisfiable(field) {
+            if unsatisfiable(field) || unmapped_leaf(field) {
                 QueryNode::MatchNone
             } else {
                 q.clone()
@@ -54064,8 +54090,11 @@ fn lower_clauses_naming(
         }
    
```

**File**: `engine/crates/xerj-engine/tests/fast_aggs_multifield_suffix.rs` (modified, +104/-37)
```diff
@@ -23,6 +23,20 @@
 //! skipped the segment, so a panel returned a small plausible number built
 //! from the memtable alone.
 //!
+//! #3533 changed the first fact for QUERY and FILTER leaves: `extension` is
+//! dynamically mapped as `text` with a `.keyword` multi-field, so every
+//! other suffix on it is an unmapped leaf sub-field and a `term` / `terms`
+//! on it now matches nothing on the brute path either, as in ES. The
+//! lowering in `search_inner` and the guards in `doc_matches_query_typed`
+//! and `doc_matches_filter` run before `get_field_value`'s recursive
+//! fallback is reached. The bullets above still describe the resolvers for
+//! the names #3533 does not cover (aggregation TARGETS, and schemaless
+//! callers whose schema has no declared ancestor). The absolute assertions
+//! below were moved with that change: the query-filter and
+//! filters-predicate legs pin 0 for the unmapped suffixes and 3 200 for the
+//! bare field and the declared `.keyword` multi-field, so the agreement
+//! check still has a live non-zero leg to stand on.
+//!
 //! The fix keeps resolution narrow — widening it would make the fast path
 //! claim shapes it cannot prove byte-identical, and per the above there is
 //! no single behaviour to widen TO — and instead BAILS to the brute path
@@ -203,6 +217,12 @@ fn nested_sub_metric_on_raw() -> serde_json::Value {
 
 /// `filters` sub-agg whose leaf is a `term` on `<field>.raw` — the
 /// predicate resolver's fail-closed path.
+///
+/// #3533: `extension` is dynamically mapped as `text` with a `.keyword`
+/// multi-field, so `extension.raw` is an unmapped leaf sub-field and a
+/// `term` on it now matches nothing on BOTH paths, as in ES. The agreement
+/// below is still the invariant (fast == brute); the absolute counts moved
+/// from 3 200 / 3 000 to 0 with the brute reference itself.
 #[tokio::test]
 async fn fast_and_brute_agree_on_raw_filters_agg() {
     let brute = agree(
@@ -212,14 +232,13 @@ async fn fast_and_brute_agree_on_raw_filters_agg() {
          `filters` agg keyed by `<field>.raw`",
     )
     .await;
-    assert_eq!(
-        brute["aggs"]["by_ext"]["buckets"]["css"]["doc_count"],
-        3_200
-    );
-    assert_eq!(brute["aggs"]["by_ext"]["buckets"]["gz"]["doc_count"], 3_000);
+    assert_eq!(brute["aggs"]["by_ext"]["buckets"]["css"]["doc_count"], 0);
+    assert_eq!(brute["aggs"]["by_ext"]["buckets"]["gz"]["doc_count"], 0);
 }
 
 /// Single `filter` agg with a `terms` leaf on `<field>.raw`.
+/// #3533: see `fast_and_brute_agree_on_raw_filters_agg`; `terms` on the
+/// unmapped `extension.raw` now matches nothing on both paths, as in ES.
 #[tokio::test]
 async fn fast_and_brute_agree_on_raw_filter_terms_agg() {
     let brute = agree(
@@ -229,11 +248,14 @@ async fn fast_and_brute_agree_on_raw_filter_terms_agg() {
          `filter` agg with a `terms` leaf on `<field>.raw`",
     )
     .await;
-    assert_eq!(brute["aggs"]["css_or_gz"]["doc_count"], 6_200);
+    assert_eq!(brute["aggs"]["css_or_gz"]["doc_count"], 0);
 }
 
 /// Top-level query `term` on `<field>.raw` — this one moves `hits.total`,
 /// not just a bucket count.
+/// #3533: see `fast_and_brute_agree_on_raw_filters_agg`; the top-level
+/// `term` on the unmapped `extension.raw` now matches nothing on both
+/// paths, as in ES, so the `sum` over zero docs is 0.0.
 #[tokio::test]
 async fn fast_and_brute_agree_on_raw_query_filter() {
     let brute = agree(
@@ -243,8 +265,8 @@ async fn fast_and_brute_agree_on_raw_query_filter() {
          top-level `term` query against `<field>.raw`",
     )
     .await;
-    assert_eq!(brute["total"], 6_000);
-    assert_eq!(brute["aggs"]["total_v"]["value"], 600_000.0);
+    assert_eq!(brute["total"], 0);
+    assert_eq!(brute["aggs"]["total_v"]["value"], 0.0);
 }
 
 /// Aggregation TARGET on `<field>.raw`.  Broader than the predicate case:
@@ -365,24 +387,33 @@ async fn genuinely_absent_dotted_field_is_empty_on_both_paths() {
 /// Every multi-field suffix SHAPE, not just the one-segment `.raw` the issue
 /// happened to name.
 ///
-/// The resolver a top-level query filter is measured against is
-/// `index.rs::get_field_value`, and its multi-field fallback RECURSES
-/// (`get_field_value(source, &field[..idx])`), so it strips an unbounded
-/// number of trailing segments: `extension.raw.raw` and
-/// `extension.keyword.raw` both resolve to `extension`'s value on the brute
-/// path.  A columnar bail keyed on the immediate parent alone therefore
-/// still failed closed for every doubly-suffixed name.
+/// The resolver a top-level query filter used to be measured against is
+/// `index.rs::get_field_value`, whose multi-field fallback RECURSES
+/// (`get_field_value(source, &field[..idx])`) and strips an unbounded number
+/// of trailing segments: `extension.raw.raw` and `extension.keyword.raw`
+/// both resolved to `extension`'s value on the brute path. #3533 changed
+/// that for query leaves: `extension` is dynamically mapped as `text` with
```

**File**: `engine/crates/xerj-engine/tests/unmapped_subfield_flush_parity.rs` (modified, +51/-4)
```diff
@@ -9,9 +9,15 @@
 //! | `match title.raw "fruit"` | 0 | 2 | 0 |
 //! | `constant_score match title.raw "fRuIt"` | 3 | 3 | 0 |
 //!
+//! #3533 extends the same rule to the term-level leaves: `term`, `terms`,
+//! `range`, `regexp` and `exists` on `title.raw` must also match nothing,
+//! before and after `_flush`. Pre-fix they read the parent value on both
+//! sides (`term title.raw "Fruit"` -> [1], `exists title.raw` -> [1, 2, 3]).
+//!
 //! Every query below runs twice on the same documents, once before and once
 //! after `flush`, and both answers must equal the ES answer. Mapped fields
-//! (`title`, `title.keyword`, the object leaf `meta.owner`) are the controls.
+//! (`title`, `title.keyword`, the object leaf `meta.owner`, and the declared
+//! multi-field `name.raw`) are the controls.
 
 use serde_json::{json, Value};
 use tempfile::TempDir;
@@ -51,6 +57,35 @@ fn cases() -> Vec<(Value, u64)> {
         (json!({"prefix": {"title.raw": "fru"}}), 0),
         (json!({"wildcard": {"title.raw": "fru*"}}), 0),
         (json!({"match": {"meta.owner.raw": "alpha"}}), 0),
+        // #3533: term-level leaves on the unmapped sub-field match nothing.
+        (json!({"term": {"title.raw": "Fruit"}}), 0),
+        (json!({"terms": {"title.raw": ["fruit", "Fruit"]}}), 0),
+        (json!({"range": {"title.raw": {"gte": "a"}}}), 0),
+        (json!({"regexp": {"title.raw": "fru.*"}}), 0),
+        (json!({"exists": {"field": "title.raw"}}), 0),
+        (
+            json!({"constant_score": {"filter": {"term": {"title.raw": "Fruit"}}}}),
+            0,
+        ),
+        (
+            json!({"bool": {"must": [{"term": {"title.raw": "Fruit"}}]}}),
+            0,
+        ),
+        (
+            json!({"bool": {"must_not": [{"term": {"title.raw": "Fruit"}}]}}),
+            3,
+        ),
+        (
+            json!({"bool": {"filter": [{"exists": {"field": "title.raw"}}]}}),
+            0,
+        ),
+        (json!({"term": {"meta.owner.raw": "Alpha"}}), 0),
+        // Declared multi-field controls keep working.
+        (json!({"term": {"title.keyword": "Fruit"}}), 1),
+        (json!({"term": {"name.raw": "Fruit"}}), 1),
+        (json!({"exists": {"field": "name.raw"}}), 3),
+        (json!({"exists": {"field": "title"}}), 3),
+        (json!({"exists": {"field": "title.keyword"}}), 3),
         (json!({"match": {"title": "fruit"}}), 3),
         (json!({"match": {"title.keyword": "Fruit"}}), 1),
         (json!({"match": {"title.keyword": "fruit"}}), 0),
@@ -78,15 +113,27 @@ async fn unmapped_dotted_subfield_is_flush_invariant() {
     let mut meta = FieldConfig::new("meta", FieldType::Object);
     meta.fields.push(FieldConfig::new("owner", FieldType::Text));
     schema.fields.push(meta);
+    // Declared multi-field control for #3533: `name.raw` IS mapped, so
+    // term-level queries on it keep matching while `title.raw` matches nothing.
+    let mut name = FieldConfig::new("name", FieldType::Text);
+    name.fields
+        .push(FieldConfig::new("raw", FieldType::Keyword));
+    schema.fields.push(name);
     engine.create_index("docs", schema).expect("create");
     let idx = engine.get_index("docs").expect("get");
     for (id, doc) in [
-        ("1", json!({"title": "Fruit", "meta": {"owner": "Alpha"}})),
+        (
+            "1",
+            json!({"title": "Fruit", "meta": {"owner": "Alpha"}, "name": "Fruit"}),
+        ),
         (
             "2",
-            json!({"title": "fruit salad", "meta": {"owner": "Beta"}}),
+            json!({"title": "fruit salad", "meta": {"owner": "Beta"}, "name": "fruit salad"}),
+        ),
+        (
+            "3",
+            json!({"title": "FRUiT", "meta": {"owner": "Gamma"}, "name": "FRUiT"}),
         ),
-        ("3", json!({"title": "FRUiT", "meta": {"owner": "Gamma"}})),
     ] {
         idx.index_document(Some(id.to_string()), doc)
             .await
```

**File**: `engine/tests/es-compat-yaml/yaml/search/801_term_unmapped_subfield.yml` (added, +182/-0)
```diff
@@ -0,0 +1,182 @@
+# #3533: a term-level query on a dotted sub-field that is not mapped
+# (`title.raw`, where `title` is a dynamic `text` field whose only
+# multi-field is `.keyword`) matches nothing, before and after `_flush`.
+# The field does not exist, so ES 8.x returns 0 hits. Pre-fix the
+# term-level arms resolved `title.raw` through `get_field_value`, which
+# strips the unknown suffix and compares the raw parent string
+# (`term title.raw "Fruit"` -> [1], `exists title.raw` -> [1, 2, 3]).
+# `um_mem` is never flushed (memtable), `um_seg` is flushed (segment);
+# both get the same documents, the same queries and the same answers.
+# Mapped `title` / `title.keyword` are the controls.
+setup:
+  - do:
+      bulk:
+        refresh: true
+        body:
+          - '{"index": {"_index": "um_mem", "_id": "1"}}'
+          - '{"title": "Fruit"}'
+          - '{"index": {"_index": "um_mem", "_id": "2"}}'
+          - '{"title": "fruit salad"}'
+          - '{"index": {"_index": "um_mem", "_id": "3"}}'
+          - '{"title": "FRUiT"}'
+          - '{"index": {"_index": "um_seg", "_id": "1"}}'
+          - '{"title": "Fruit"}'
+          - '{"index": {"_index": "um_seg", "_id": "2"}}'
+          - '{"title": "fruit salad"}'
+          - '{"index": {"_index": "um_seg", "_id": "3"}}'
+          - '{"title": "FRUiT"}'
+  - do:
+      indices.flush:
+        index: um_seg
+
+---
+"term and terms on an unmapped sub-field: memtable":
+  - do:
+      search:
+        index: um_mem
+        body: { query: { term: { title.raw: Fruit } } }
+  - match: { hits.total.value: 0 }
+  - do:
+      search:
+        index: um_mem
+        body: { query: { terms: { title.raw: [ fruit, Fruit ] } } }
+  - match: { hits.total.value: 0 }
+  - do:
+      count:
+        index: um_mem
+        body: { query: { term: { title.raw: Fruit } } }
+  - match: { count: 0 }
+
+---
+"term and terms on an unmapped sub-field: segment":
+  - do:
+      search:
+        index: um_seg
+        body: { query: { term: { title.raw: Fruit } } }
+  - match: { hits.total.value: 0 }
+  - do:
+      search:
+        index: um_seg
+        body: { query: { terms: { title.raw: [ fruit, Fruit ] } } }
+  - match: { hits.total.value: 0 }
+  - do:
+      count:
+        index: um_seg
+        body: { query: { term: { title.raw: Fruit } } }
+  - match: { count: 0 }
+
+---
+"range and regexp on an unmapped sub-field: memtable":
+  - do:
+      search:
+        index: um_mem
+        body: { query: { range: { title.raw: { gte: a } } } }
+  - match: { hits.total.value: 0 }
+  - do:
+      search:
+        index: um_mem
+        body: { query: { regexp: { title.raw: "fru.*" } } }
+  - match: { hits.total.value: 0 }
+
+---
+"range and regexp on an unmapped sub-field: segment":
+  - do:
+      search:
+        index: um_seg
+        body: { query: { range: { title.raw: { gte: a } } } }
+  - match: { hits.total.value: 0 }
+  - do:
+      search:
+        index: um_seg
+        body: { query: { regexp: { title.raw: "fru.*" } } }
+  - match: { hits.total.value: 0 }
+
+---
+"exists on an unmapped sub-field: memtable":
+  - do:
+      search:
+        index: um_mem
+        body: { query: { exists: { field: title.raw } } }
+  - match: { hits.total.value: 0 }
+  - do:
+      search:
+        index: um_mem
+        body: { query: { bool: { must_not: [ { term: { title.raw: Fruit } } ] } } }
+  - match: { hits.total.value: 3 }
+
+---
+"exists on an unmapped sub-field: segment":
+  - do:
+      search:
+        index: um_seg
+        body: { query: { exists: { field: title.raw } } }
+  - match: { hits.total.value: 0 }
+  - do:
+      search:
+        index: um_seg
+        body: { query: { bool: { must_not: [ { term: { title.raw: Fruit } } ] } } }
+  - match: { hits.total.value: 3 }
+
+---
+"constant_score and bool filter on an unmapped sub-field: memtable":
+  - do:
+      search:
+        index: um_mem
+        body: { query: { constant_score: { filter: { term: { title.raw: Fruit } } } } }
+  - match: { hits.total.value: 0 }
+  - do:
+      search:
+        index: um_mem
+        body: { query: { bool: { must: [ { match: { title: fruit } } ], filter: [ { term: { title.raw: Fruit } } ] } } }
+  - match: { hits.total.value: 0 }
+
+---
+"constant_score and bool filter on an unmapped sub-field: segment":
+  - do:
+      search:
+        index: um_seg
+        body: { query: { constant_score: { filter: { term: { title.raw: Fruit } } } } }
+  - match: { hits.total.value: 0 }
+  - do:
+      search:
+        index: um_seg
+        body: { query: { bool: { must: [ { match: { title: fruit } } ], filter: [ { term: { title.raw: Fruit } } ] } } }
+  - match: { hits.total.value: 0 }
+
+---
+"mapped parent and keyword multi-field are unchanged: memtable":
+  - do:
+      search:
+        index: um_mem
+        body: { query: { term: { title.keyword: Fruit } } }
+  - match: { hits.total.value: 1 }
+  - match: { hits.hits.0._id: "1" }
+  - do:
+      search:
+        index: um_mem
+      
```

#### Recent Merged Pull Requests:
- **PR #3694** (2026-11-26): hub: author-approved contribution candidates (14441 repos) (@xerj-team)
- **PR #3692** (2026-11-25): hub: author-approved contribution candidates (14442 repos) (@xerj-team)
- **PR #3688** (2026-11-25): hub: author-approved contribution candidates (14443 repos) (@xerj-team)
- **PR #3687** (2026-11-25): hub: author-approved contribution candidates (14439 repos) (@xerj-team)
- **PR #3686** (2026-11-25): hub: author-approved contribution candidates (14436 repos) (@xerj-team)
- **PR #3685** (2026-11-25): docs(readme): sync the Simplified Chinese README with the English one (@polarours)

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

## X. autoindex): validate pack source slugs on consume to block path traversal

**RULE**:
When implementing operations in `engine/crates/xerj-autoindex/src/harvest/pack.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e774cf7c`: autoindex): validate pack source slugs on consume to block path traversal. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `engine/crates/xerj-autoindex/src/harvest/pack.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    // #3166: the slug becomes a directory under the corpus on consume
    // (`corpora/<name>/<slug>`), so it is gated here, before any path is
    // built from it, using the same gate the recipe build path applies. A
    // checksum cannot stand in for this: SHA256SUMS is authored by the
    // same party as the manifest, so a self-consistent malicious pack
    // verifies clean.
    for s in &sources {
        if let Err(e) = xerj_common::xccode::pathgate::valid_slug(&s.slug) {
            bail!(at(&format!("source slug: {e}")));
        }
    /// Rewrite SHA256SUMS from the bytes now on disk, so a test that edits
    /// manifest.json can reach the slug check instead of dying on a
    /// checksum first.
    fn rehash_sums(pack_dir: &Path) {
        let sums_raw = std::fs::read_to_string(pack_dir.join("SHA256SUMS")).unwrap();
        let mut fresh = String::new();
        for line in sums_raw.lines() {
            let (_, name) = line.split_once("  ").unwrap();
            let file_bytes = std::fs::read(pack_dir.join(name)).unwrap();
            fresh.push_str(&format!(
                "{}  {}\n",
                hex(&Sha256::digest(&file_bytes)),
                name
        
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    if sources.iter().any(|s| s.slug.is_empty()) {
        bail!(at("a manifest source has no slug"));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e774cf7c` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
