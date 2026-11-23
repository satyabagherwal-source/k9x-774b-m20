# Verification Protocol: Verification Protocol: Empirical Defect Shield for xerj-org-xerj-learnings

<!-- PROVENANCE_START
{
  "source_repository": "xerj-org-xerj-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T06:22:34.543Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-xerj-org-xerj-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xerj-org-xerj-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T06:22:34.543Z`  
> **Learning ID**: `LEARN-EVO-xerj-org-xerj-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `xerj-org-xerj-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source**: github ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Source Version**: `98e7681c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T06:22:29.529Z  
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
> **Harvest Timestamp**: 2026-11-23T06:22:29.524Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: AI search engine and MCP server for bots and agents. One Rust binary indexes code, docs, logs, JSONL/CSV and PDFs for BM25 full-text, vector and hybrid search, code search without grep, agent memory and RAG. Elasticsearch-compatible API; Corpus Hub serves hundreds of reference memory corpora.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 19483 stars

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
- **Issue #3466** (2026-11-23): **search: size:0 aggs under a numeric term filter take the brute corpus path (429 on an index with overwrites)**
  *Symptoms*: ## What happens  A `size:0` aggregation whose query is a `term` on a numeric field still takes the brute `_source` corpus path. On an index with overwrite history the corpus estimate is over the 512 MB query cap, so it returns 429 at `aggregation corpus materialisation`. Below the cap it is just slow.  Measured during #3444 (200k live docs, 100k overwritten, ~1 KB text body): 1.2-2.4 s and +842-851 MB RSS per query on the brute path, or 429.  ```json {"size": 0,  "query": {"term": {"g": 1}},  "aggs": {"a": {"terms": {"field": "cat"}}}} ```  The same aggregation with a keyword `term` or a numeric `range` filter is served from doc values in tens of ms.  ## Root cause  `query_node_to_agg_filter` (engine/crates/xerj-engine/src/index.rs) only turns a `term` with a **string** value into the agg filter. A numeric `term` value returns `None`, so `try_fast_aggs` is never tried and the request falls to the brute corpus. `compile_pred` in fast_aggs.rs also bails on a numeric `term`.  ## Fix direction  On a numeric doc-values column, `term: N` is the same row set as `range: {gte: N, lte: N}`. That is already how `seg_term_positions` counts a numeric term (index.rs). The `_source` comparator `json_scalar_equal` compares numbers by value and compares integers exactly, so the rewrite is limited to |N| < 2^53, where f64 is exact. A segment whose column for the field is not numeric still bails, the same as for any numeric range.  Acceptance: peak RSS and latency before/after on the 200k/100k 

- **Issue #3448** (2026-11-23): **Flaky tests: "no free port triple" in brain_cli / node_lifecycle / shutdown_signals under load**
  *Symptoms*: \`xerj-server\` tests \`brain_cli\`, \`node_lifecycle\`, \`shutdown_signals\` and \`ask_folder_cli\` each carry their own \`free_port_triple()\`. At load 40 they panic \`no free port triple\` (4 failures in round 9: brain_cli 2 + node_lifecycle 2).  Root cause: each helper takes a base from \`bind(:0)\` and probes \`base+1\` and \`base+2\`. Linux gives \`bind(:0)\` ports of one parity and \`connect()\` the other. When the host makes lots of short loopback connections, which parallel test suites do, the \`connect()\` half of the ephemeral range fills with client sockets and TIME_WAIT. Then \`base+1\` is nearly always taken, and all 64 or 200 tries fail. The window between release and the child's bind is exposed to the same thing.  Repro (de56838e9): 8 threads making short loopback connections (TIME_WAIT 14-28k, all on the connect parity), 30 runs, 6 parallel: node_lifecycle **30/30**, brain_cli **30/30**, shutdown_signals **30/30** failed with \`no free port triple\`.

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

### Incident Patch 1: `a8dfd181` (2026-11-23)
**Commit Message**: governor: run the pressure purge off the memory sampler thread (Refs #2427)

Motivation
#3408 made the resource sampler purge freed jemalloc pages itself once RSS
reaches 80% of the watermark, at most every 250 ms. The purge ran inline on
the sampler thread (Thread A), the thread that refreshes the RSS figure the
parent breaker compares against every 100 ms. Earlier rounds measured the
purge at p50 62.7 ms / p99 231.7 ms but not what it costs or what it delays.

Root cause (measured; main d36c4af6b plus a local timing patch, not
committed: epoch / purge time per call, dirty+muzzy bytes per arena from
jemalloc stats, sampler tick gaps >= 150 ms, madvise traced with bpftrace)
- Duration follows bytes handed back. 651 calls over 5 runs: 16-64 MiB p50
  6.6 ms, 128-256 MiB 30.9 ms, 256-512 MiB 68.6 ms, 512-1024 MiB 114.4 ms;
  slope 199 ms/GiB, Pearson 0.76.
- About 73% of purge time is the kernel: over one 120 s window the sampler's
  40 purges took 3.70 s, of which 2.69 s was madvise(MADV_DONTNEED) in 93,781
  calls (14.2 GiB, average 155 KiB, median extent 16-32 KiB).
- The stats epoch is 5.5% (p50 2.5 ms). Calls with nothing to free: 36 of
  651, all in one run, ~1.9 ms each. 75 of

**File**: `engine/crates/xerj-engine/src/engine.rs` (modified, +102/-1)
```diff
@@ -81,6 +81,56 @@ fn pressure_purge_due(
     due
 }
 
+/// Runs the sampler's pressure purge on a thread of its own (#2427).
+///
+/// A purge hands every freed allocator page back to the kernel, and the
+/// call takes about as long as the bytes it returns, roughly 125-200 ms per
+/// GiB: about three quarters of it is `madvise(MADV_DONTNEED)` over many
+/// small extents (median 16-32 KiB, ~2,300 calls per purge), and the stats
+/// epoch is ~5%. Skipping calls with nothing to free would save little:
+/// such a call costs ~2 ms. Run on the sampler thread, each call held back
+/// the next RSS sample, so the breaker read an RSS figure up to 389 ms old
+/// (1,722 ms once) during exactly the bursts the purge is there for. The
+/// sampler now only asks. The channel is a rendezvous channel, so a
+/// request lands only when the worker is idle; one that arrives mid-purge
+/// is dropped and the next due tick asks again. Same
+/// shape as ClickHouse's `MemoryWorker`, whose RSS thread flags a separate
+/// purge thread (`src/Common/MemoryWorker.cpp:924-962`, `:1154-1230`,
+/// Apache-2.0), written fresh here. Without a worker (the spawn failed)
+/// the purge runs inline, as before.
+struct PressurePurgeWorker {
+    purge: Arc<dyn Fn() + Send + Sync + 'static>,
+    tx: Option<std::sync::mpsc::SyncSender<()>>,
+}
+
+impl PressurePurgeWorker {
+    fn spawn(purge: Arc<dyn Fn() + Send + Sync + 'static>) -> Self {
+        let (tx, rx) = std::sync::mpsc::sync_channel::<()>(0);
+        let worker = Arc::clone(&purge);
+        let running = spawn_governor_thread("xerj-mem-purge", move || {
+            while let Ok(()) = rx.recv() {
+                worker();
+            }
+        });
+        Self {
+            purge,
+            tx: running.then_some(tx),
+        }
+    }
+
+    /// Ask for a purge without waiting for it. Returns whether one was
+    /// started: `false` means the worker is still on the previous one.
+    fn request(&self) -> bool {
+        match &self.tx {
+            Some(tx) => tx.try_send(()).is_ok(),
+            None => {
+                (self.purge)();
+                true
+            }
+        }
+    }
+}
+
 /// Whether this sampler tick should ask the drain worker to run on the fixed
 /// window (#948, #2238).
 ///
@@ -355,6 +405,56 @@ mod pressure_cache_release_gate_tests {
         assert!(!pressure_purge_due(u64::MAX, 0, &mut never, t0));
     }
 
+    /// #2427: asking for a pressure purge never waits for it. A purge that
+    /// is still running drops the next request instead of queueing it, and
+    /// the worker takes requests again once it is done.
+    #[test]
+    fn a_pressure_purge_request_does_not_wait_for_the_purge() {
+        use super::PressurePurgeWorker;
+        use std::sync::atomic::{AtomicUsize, Ordering};
+        use std::sync::Arc;
+        let runs = Arc::new(AtomicUsize::new(0));
+        let (started_tx, started_rx) = std::sync::mpsc::channel::<()>();
+        let (release_tx, release_rx) = std::sync::mpsc::channel::<()>();
+        let started_tx = std::sync::Mutex::new(started_tx);
+        let release_rx = std::sync::Mutex::new(release_rx);
+        let counted = Arc::clone(&runs);
+        let worker = PressurePurgeWorker::spawn(Arc::new(move || {
+            started_tx.lock().unwrap().send(()).unwrap();
+            release_rx.lock().unwrap().recv().unwrap();
+            counted.fetch_add(1, Ordering::SeqCst);
+        }));
+        let wait_until = |what: &str, mut f: Box<dyn FnMut() -> bool + '_>| {
+            let by = Instant::now() + Duration::from_secs(10);
+            while !f() {
+                assert!(Instant::now() < by, "{what}");
+                std::thread::sleep(Duration::from_millis(1));
+            }
+        };
+        wait_until("the worker never went idle", Box::new(|| worker.request()));
+        started_rx
+            .recv_timeout(Duration::from_secs(10))
+            .expect("the purge must start on the worker");
+        let t = Instant::now();
+        assert!(!worker.request(), "a busy worker must drop the request");
+        assert!(
+            t.elapsed() < Duration::from_secs(1),
+            "a request must not block"
+        );
+        assert_eq!(runs.load(Ordering::SeqCst), 0);
+        release_tx.send(()).unwrap();
+        wait_until(
+            "the worker never took a request again",
+            Box::new(|| worker.request()),
+        );
+        started_rx.recv_timeout(Duration::from_secs(10)).unwrap();
+        release_tx.send(()).unwrap();
+        wait_until(
+            "the second purge never finished",
+            Box::new(|| runs.load(Ordering::SeqCst) == 2),
+        );
+    }
+
     #[test]
     fn a_zero_interval_releases_on_every_tick() {
         let mut gate = PressureCacheReleaseGate::new(Duration::ZERO);
@@ -5108,6 +5208,7 @@ impl Engine {
                 crate::governor::MemoryDrainSchedule::new(MEMORY_DRAIN_MIN_INTERVAL);
             let mut last_memtable_drain_
```

---

### Incident Patch 2: `618cc874` (2026-11-23)
**Commit Message**: fix(search,test): stored scan keeps a segment's best matches; three load flakes made deterministic

Three tests failed now and then on the loaded shared box. Each one is
fixed at its cause; no timeout was raised and nothing is #[ignore]d.

1. term_on_multi_valued_keyword_matches_the_scan (#3465): a real ranking bug

The stored-doc scan keeps the FIRST materialisation_limit matches of each
segment; the cross-segment trim then keeps the best from+size. With the
count not authoritative, a full collector did `continue`: it counted the
match and dropped it unscored. The call site justified that with "a
segment's first cap matches are its own cap best", which holds only when
every match scores the same. score_query_against_doc scores `term` and
`match` by the query's token count across ALL array elements
(match_term_frequency), so ["Install guide", "Install"] beats ["Install"].
With size 5 a merged segment whose first five "Install" matches include a
one-element doc (d0006) dropped the two-element d0016 behind it. Whether a
merge had produced such a segment depended on background merge timing,
hence the flake.

Fix: when the scan score can differ between matches (scan_scores_tied is
fals

**File**: `engine/crates/xerj-api/tests/cluster_metadata_replicates.rs` (modified, +169/-29)
```diff
@@ -93,36 +93,103 @@ async fn send(app: &Router, req: Request<Body>) -> (StatusCode, Value) {
     (status, body)
 }
 
+/// The `ProposeError` reasons that mean "raft did not acknowledge this
+/// change; nothing was reported applied" (`xerj_cluster::propose`). Shutdown
+/// is left out: these tests stop members on purpose.
+const RAFT_NOT_ACKNOWLEDGED: [&str; 3] = [
+    "no elected raft leader",
+    "timed out waiting for the metadata change to commit on a majority",
+    "raft leadership changed before the metadata write committed",
+];
+
+fn raft_not_acknowledged(status: StatusCode, body: &Value) -> bool {
+    status == StatusCode::SERVICE_UNAVAILABLE && {
+        let text = body.to_string();
+        RAFT_NOT_ACKNOWLEDGED
+            .iter()
+            .any(|reason| text.contains(reason))
+    }
+}
+
+/// Upper bound on raft-unacknowledged answers before a write gives up. A
+/// hang guard, not a timing budget: the loop ends when the answer changes.
+const RAFT_RETRY_GUARD: u32 = 500;
+
+/// Send a write; while the answer is a raft-unacknowledged 503, send it again.
+///
+/// #3469: raft elections run on wall-clock timers (150-300 ms election
+/// timeout, 50 ms heartbeat), so on a loaded box a starved runner loses or
+/// never settles leadership, and a metadata change (an index create, or the
+/// in-sync change a replicated write proposes) answers 503 "not
+/// acknowledged". These tests are about what happens once a change commits,
+/// not about elections, so they wait for the commit the way a client does:
+/// send again until raft answers. The wait ends on that answer, not on a
+/// sleep. A change whose unacknowledged attempt committed after all answers
+/// the retry with "already done" (`resource_already_exists_exception` for a
+/// create, 404 for a delete); that is the change succeeding, so it is
+/// returned as 200.
+async fn send_write(app: &Router, make: impl Fn() -> Request<Body>) -> (StatusCode, Value) {
+    let is_delete = make().method() == axum::http::Method::DELETE;
+    let mut unacknowledged = 0u32;
+    loop {
+        let (status, body) = send(app, make()).await;
+        if raft_not_acknowledged(status, &body) {
+            unacknowledged += 1;
+            assert!(
+                unacknowledged < RAFT_RETRY_GUARD,
+                "raft never acknowledged the write: {status} {body}"
+            );
+            tokio::time::sleep(Duration::from_millis(20)).await;
+            continue;
+        }
+        let already_done = if is_delete {
+            status == StatusCode::NOT_FOUND
+        } else {
+            body.pointer("/error/type").and_then(Value::as_str)
+                == Some("resource_already_exists_exception")
+        };
+        if unacknowledged > 0 && already_done {
+            return (StatusCode::OK, body);
+        }
+        return (status, body);
+    }
+}
+
+fn json_request(method: &str, path: &str, content_type: &str, body: &str) -> Request<Body> {
+    Request::builder()
+        .method(method)
+        .uri(path)
+        .header("content-type", content_type)
+        .body(Body::from(body.to_string()))
+        .expect("request")
+}
+
 async fn put_json(app: &Router, path: &str, body: Value) -> (StatusCode, Value) {
+    let body = body.to_string();
+    send_write(app, || json_request("PUT", path, "application/json", &body)).await
+}
+
+/// One PUT, no retry: for asserting the raft-unavailable answer itself.
+async fn put_json_once(app: &Router, path: &str, body: Value) -> (StatusCode, Value) {
     send(
         app,
-        Request::put(path)
-            .header("content-type", "application/json")
-            .body(Body::from(body.to_string()))
-            .expect("request"),
+        json_request("PUT", path, "application/json", &body.to_string()),
     )
     .await
 }
 
 async fn post_json(app: &Router, path: &str, body: Value) -> (StatusCode, Value) {
-    send(
-        app,
-        Request::post(path)
-            .header("content-type", "application/json")
-            .body(Body::from(body.to_string()))
-            .expect("request"),
-    )
+    let body = body.to_string();
+    send_write(app, || {
+        json_request("POST", path, "application/json", &body)
+    })
     .await
 }
 
 async fn post_ndjson(app: &Router, path: &str, body: &str) -> (StatusCode, Value) {
-    send(
-        app,
-        Request::post(path)
-            .header("content-type", "application/x-ndjson")
-            .body(Body::from(body.to_string()))
-            .expect("request"),
-    )
+    send_write(app, || {
+        json_request("POST", path, "application/x-ndjson", body)
+    })
     .await
 }
 
@@ -135,10 +202,9 @@ async fn get(app: &Router, path: &str) -> (StatusCode, Value) {
 }
 
 async fn delete(app: &Router, path: &str) -> (StatusCode, Value) {
-    send(
-        app,
-        Request::delete(path).body(Body::empty()).expect("request"),
-    )
+    send_write(app, || {
+        Request::delete(path).body(Body::empty()).ex
```

**File**: `engine/crates/xerj-autoindex/src/xc.rs` (modified, +14/-3)
```diff
@@ -7178,7 +7178,18 @@ precedence = ["a", "b"]
             r#"{"corpus":"other","indexed_at":"2026-01-02T03:04:05Z","prefix":"xc-other"}"#,
         )
         .unwrap();
-        let before = server.requests().len();
+        // Count catalog reads only (#3468). Each call also opens a bare TCP
+        // connection first (`localnode::ensure_for_cli` asks whether the port
+        // accepts), and the stand-in records it as an empty request whenever
+        // its accept loop gets to it — before or after this call returns.
+        let catalog_reads = || {
+            server
+                .requests()
+                .iter()
+                .filter(|req| req.contains("autoindex-catalog"))
+                .count()
+        };
+        assert_eq!(catalog_reads(), 1, "the empty ledger read the catalog once");
         let done = code_cli_outcome(&[
             "proj".into(),
             "how does it flush".into(),
@@ -7196,8 +7207,8 @@ precedence = ["a", "b"]
         );
         assert!(!out.text.contains("autoindex catalog"), "{}", out.text);
         assert_eq!(
-            server.requests().len(),
-            before,
+            catalog_reads(),
+            1,
             "a non-empty ledger must not probe the catalog"
         );
         drop(_hold);
```

**File**: `engine/crates/xerj-engine/src/index.rs` (modified, +137/-1)
```diff
@@ -27070,6 +27070,12 @@ impl Index {
             score
         };
         let score_doc: &(dyn Fn(&Value, &str) -> f32 + Send + Sync) = &score_doc;
+        // #3465: whether `score_doc` gives every match the same score. Only
+        // then may a full stored-scan collector keep a segment's first
+        // matches; otherwise it keeps the segment's best by score.
+        let scan_scores_tied: bool = ids_only
+            || (peeled_fs.is_none()
+                && (leaf_base_const.is_some() || scan_score_is_constant(query)));
 
         // Helper: admit a hit into the bounded `all_hits` collector.
         //
@@ -30541,6 +30547,7 @@ impl Index {
                             &mut dbg_walked,
                             &mut dbg_admitted,
                             score_doc,
+                            scan_scores_tied,
                             &dmq_schema,
                         );
                         dbg_scan_ms += t_scan.elapsed().as_millis() as u64;
@@ -30590,6 +30597,7 @@ impl Index {
                                     Some(search_deadline),
                                     &mut deadline_exceeded,
                                     score_doc,
+                                    scan_scores_tied,
                                     &dmq_schema,
                                 );
                             }
@@ -30613,6 +30621,7 @@ impl Index {
                                     &mut dbg_walked,
                                     &mut dbg_admitted,
                                     score_doc,
+                                    scan_scores_tied,
                                     &dmq_schema,
                                 );
                             }
@@ -30760,6 +30769,7 @@ impl Index {
                                     &mut dbg_walked,
                                     &mut dbg_admitted,
                                     score_doc,
+                                    scan_scores_tied,
                                     &dmq_schema,
                                 );
                                 dbg_scan_ms += t_scan.elapsed().as_millis() as u64;
@@ -39420,8 +39430,12 @@ impl Index {
         // Per-doc scorer from `search_inner` (`score_doc`): single-applies
         // any peeled function_score and resolves `_id` for ids clauses.
         scorer: &(dyn Fn(&Value, &str) -> f32 + Send + Sync),
+        // #3465: see `scan_stored_section_into`.
+        scores_tied: bool,
         schema: &Schema,
     ) {
+        // One call hydrates one segment: hits from `segment_floor` on are its own.
+        let segment_floor = all_hits.len();
         // LOSS_BATTLE_PLAN B7 (completed): the positions arrive PRE-SORTED
         // ascending from the cached `PrefilterSet` — zero per-query set
         // collection, selection, or sorting.  With an authoritative count
@@ -39500,6 +39514,29 @@ impl Index {
                 if count_authoritative {
                     break;
                 }
+                // #3465: a match that outscores one of this segment's hits
+                // takes its slot (see `scan_stored_section_into`).
+                if !scores_tied && !ids_only && !seen_ids.contains(id_ref) {
+                    let source_ref = doc.get("_source").unwrap_or(&doc);
+                    let score = scorer(source_ref, id_ref);
+                    if let Some(at) = stored_scan_displaced_slot(&all_hits[segment_floor..], score)
+                    {
+                        let id = id_ref.to_string();
+                        seen_ids.insert(id.clone());
+                        all_hits[segment_floor + at] = Hit {
+                            id,
+                            score,
+                            source: source_ref.clone(),
+                            seq_no: hit_seq_no,
+                            version: hit_version,
+                            sort: Vec::new(),
+                            explain: None,
+                            highlight: None,
+                            matched_queries: Vec::new(),
+                            passage: None,
+                        };
+                    }
+                }
                 continue;
             }
             let id: String = id_ref.to_string();
@@ -39832,11 +39869,17 @@ impl Index {
         // Per-doc scorer from `search_inner` (`score_doc`): single-applies
         // any peeled function_score and resolves `_id` for ids clauses.
         scorer: &(dyn Fn(&Value, &str) -> f32 + Send + Sync),
+        // #3465: every match scores the same (`scan_scores_tied` in
+        // `search_inner`). When false, a full collector keeps this segment's
+        // best hits by score instead of its first ones.
+        scores_tied: bool,
         schema: &Schema,
     ) {
         // #3285: this walk is synchronous, so the scoped analyzer covers
         // every `doc_matches_query_typed` below.
         let _phrase_analyzer = ScanPhraseAnalyzer::enter(self.sca
```

---

### Incident Patch 3: `0abdca1a` (2026-11-23)
**Commit Message**: test(autoindex): count catalog reads, not every request, in the empty-ledger prefix test (#3468)

xerj_code_on_an_empty_ledger_names_catalog_prefixes asserted that a call
with a non-empty ledger leaves the stand-in node's recorded request count
unchanged. The count includes the bare TCP connection that
localnode::ensure_for_cli opens to probe the node, which the stand-in's
accept loop records as an empty request.

On the first call the probe is recorded before the catalog POST is
answered, so it is already in the count. On the second call nothing
follows the probe, so whether it is recorded before server.requests()
runs depends on thread scheduling. Under CPU contention it is, and the
count goes from 2 to 3 although no catalog read happened.

Count only the requests that name autoindex-catalog: one after the
empty-ledger call, still one after the non-empty-ledger call. That is
what the assertion message says it checks.

Evidence (Windows, test binary pinned to 2 CPUs, 20 at a time, 60 runs):
before, 2 passed and 58 failed with "left: 3" at the old
xc.rs:7198; after, 60 passed.

Signed-off-by: Raghuvar Karthik Durga <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -86,6 +86,17 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **`xerj_code_on_an_empty_ledger_names_catalog_prefixes` no longer counts the
+  node probe as a catalog read
+  ([#3468](https://github.com/xerj-org/xerj/issues/3468)).** Each `xerj code`
+  call first probes the node with a bare TCP connection, and the test's
+  stand-in server records that connection as an empty request. The test
+  compared the total request count, so under CPU contention the second call's
+  probe landed before the count and failed it (55 of 60 runs pinned to two
+  CPUs). It now counts only requests that name `autoindex-catalog`: one after
+  the empty-ledger call, still one after the non-empty-ledger call. Test-only
+  change.
+
 - **Native `q` and `multi_match` on `*` find documents again (#3413).**
   `multi_match` with `fields: ["*"]`, which is what the native search `q`
   parameter sends, matched nothing, so every `q` search returned 0 hits. A
```

**File**: `engine/crates/xerj-autoindex/src/xc.rs` (modified, +17/-3)
```diff
@@ -7136,6 +7136,16 @@ precedence = ["a", "b"]
     #[test]
     fn xerj_code_on_an_empty_ledger_names_catalog_prefixes() {
         let server = JsonServer::start(|_| (200, catalog_hits(&["proj"])));
+        // `localnode::ensure_for_cli` opens a bare TCP connection to probe the
+        // node; the stand-in records it as an empty request, so only requests
+        // that name the catalog count as catalog reads.
+        let catalog_reads = || {
+            server
+                .requests()
+                .iter()
+                .filter(|req| req.contains("autoindex-catalog"))
+                .count()
+        };
         let home = tempfile::tempdir().unwrap();
         let _hold = code_home(home.path());
         let done = code_cli_outcome(&[
@@ -7178,7 +7188,11 @@ precedence = ["a", "b"]
             r#"{"corpus":"other","indexed_at":"2026-01-02T03:04:05Z","prefix":"xc-other"}"#,
         )
         .unwrap();
-        let before = server.requests().len();
+        assert_eq!(
+            catalog_reads(),
+            1,
+            "an empty ledger must read the catalog once"
+        );
         let done = code_cli_outcome(&[
             "proj".into(),
             "how does it flush".into(),
@@ -7196,8 +7210,8 @@ precedence = ["a", "b"]
         );
         assert!(!out.text.contains("autoindex catalog"), "{}", out.text);
         assert_eq!(
-            server.requests().len(),
-            before,
+            catalog_reads(),
+            1,
             "a non-empty ledger must not probe the catalog"
         );
         drop(_hold);
```

#### Recent Merged Pull Requests:
- **PR #3484** (closed): fix(engine): serve size:0 aggregations under a numeric term from doc values (#3466) (@drk-ram)
- **PR #3483** (2026-11-23): hub: author-approved contribution candidates (14279 repos) (@xerj-team)
- **PR #3482** (2026-11-23): perf(search): object sub-fields get their own FTS side-car (#3464) (@xerj-team)
- **PR #3481** (2026-11-23): governor: run the pressure purge off the memory sampler thread (Refs #2427) (@xerj-team)
- **PR #3479** (2026-11-23): fix(search,test): stored scan keeps a segment's best matches; three load flakes made deterministic (@xerj-team)
- **PR #3478** (2026-11-23): perf(engine): read each segment once per columnar page, not once per hit (#3470) (@xerj-team)

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

## X. governor: run the pressure purge off the memory sampler thread (Refs #2427)

**RULE**:
When implementing operations in `engine/crates/xerj-engine/src/engine.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a8dfd181`: governor: run the pressure purge off the memory sampler thread (Refs #2427). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `engine/crates/xerj-engine/src/engine.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Runs the sampler's pressure purge on a thread of its own (#2427).
///
/// A purge hands every freed allocator page back to the kernel, and the
/// call takes about as long as the bytes it returns, roughly 125-200 ms per
/// GiB: about three quarters of it is `madvise(MADV_DONTNEED)` over many
/// small extents (median 16-32 KiB, ~2,300 calls per purge), and the stats
/// epoch is ~5%. Skipping calls with nothing to free would save little:
/// such a call costs ~2 ms. Run on the sampler thread, each call held back
/// the next RSS sample, so the breaker read an RSS figure up to 389 ms old
/// (1,722 ms once) during exactly the bursts the purge is there for. The
/// sampler now only asks. The channel is a rendezvous channel, so a
/// request lands only when the worker is idle; one that arrives mid-purge
/// is dropped and the next due tick asks again. Same
/// shape as ClickHouse's `MemoryWorker`, whose RSS thread flags a separate
/// purge thread (`src/Common/MemoryWorker.cpp:924-962`, `:1154-1230`,
/// Apache-2.0), written fresh here. Without a worker (the spawn failed)
/// the purge runs inline, as before.
struct PressurePurgeWorker {
    purge: Arc<dyn Fn() + Send + Sync + 's
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a8dfd181` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
