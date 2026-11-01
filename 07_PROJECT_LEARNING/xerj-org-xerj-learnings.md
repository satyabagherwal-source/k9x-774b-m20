> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source**: github ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Source Version**: `c7abfced`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T11:53:42.646Z  
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
> **Harvest Timestamp**: 2026-10-31T11:53:42.637Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: AI search engine and MCP server for bots and agents. One Rust binary indexes code, docs, logs, JSONL/CSV and PDFs for BM25 full-text, vector and hybrid search, code search without grep, agent memory and RAG. Elasticsearch-compatible API; Corpus Hub serves hundreds of reference memory corpora.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17836 stars

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

### Core Architecture Module: `engine/crates/xerj-ai/src/lib.rs`
```
//! # xerj-ai
//!
//! AI-native features for the xerj search engine.
//!
//! Provides:
//! - [`embedder`] — Unified backend handle (lexical / proxy / Candle neural /
//!   experimental ONNX) used by the engine
//! - [`embed`]   — Embedding proxy: async HTTP client for OpenAI-compatible embedding APIs
//! - [`local`]   — Built-in zero-config deterministic text embedder (feature hashing)
//! - [`neural`]  — Built-in neural BERT sentence embedder via candle (feature `neural`)
//! - [`decide`]  — Built-in zero-shot decision head: a ModernBERT-class candle
//!   classifier answering noul/choice with no history index (feature `decide-local`)
//! - `microbatch` — Length-aware batching shared by the in-process encoders,
//!   so one long passage cannot pad a whole window up to its length
//! - `onnx`      — Experimental MiniLM-compatible FP32 ONNX backend
//!   (feature `onnx-experimental`; server feature + explicit runtime selection required)
//! - [`chunker`] — Text chunking with sentence-aware splitting and overlap
//!
//! Agent memory does NOT live here. The real memory store is index-backed
//! (`/_memory/*` in xerj-api over ordinary XERJ indices — durable, WAL-replayed,
//! kNN/BM25-searchable). An earlier in-RAM `AgentMemory` (O(N²) dedup scan, no
//! durability, process-lifetime only) was deleted once it reached zero callers:
//! keeping it around shadowed the real API and invited accidental use.

pub mod chunker;
#[cfg(feature = "decide-local")]
pub mod decide;
pub mod embed;
pub mod embedder;
pub mod local;
#[cfg(any(
    feature = "neural",
    feature = "onnx-experimental",
    feature = "decide-local"
))]
pub mod microbatch;
#[cfg(feature = "neural")]
pub mod neural;
#[cfg(feature = "onnx-experimental")]
pub mod onnx;
pub mod semantic_lexical;

pub use chunker::{Chunk, TextChunker};
pub use embed::{EmbeddingProxy, EmbeddingProxyConfig};
pub use embedder::Embedder;
pub use local::{local_embed, DEFAULT_DIMS};

pub use xerj_common::Result;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2754** (2026-10-30): **[bug]: Corpus Hub: loicngr/Kobo recorded with an MIT grant the author never gave**
  *Symptoms*: ### XERJ version  N/A - Corpus Hub registry (corpus-hub branch, commit e4fd50a, #2526), not the engine  ### How did you install / run XERJ?  Prebuilt release binary  ### Operating system & architecture  N/A  ### Steps to reproduce  ```shell 1. Open tools/xerj-code/hub/candidates/authors/loicngr--kobo.json on the corpus-hub branch (added in e4fd50a, #2526). 2. Open the loicngr/Kobo line in tools/xerj-code/hub/candidates/authors/CONTRIBUTORS-2.jsonl. 3. Both carry: "author_grant": { "terms": "MIT", ..., "receipt": "bff64177cf4d" } ```  ### Expected behavior  I am the author of loicngr/Kobo. My reply to the Corpus Hub outreach email (receipt bff64177cf4d, 2026-10-27T18:07Z) allowed inclusion under GPL-3.0 only and explicitly refused MIT or any other licence. It also asked that the latest state of the repository be indexed, not a single commit.  The record should carry no author_grant, and Kobo should be pinned to the latest state of the repository, or removed from the hub entirely (including the CONTRIBUTORS files).  ### Actual behavior  The record carries an MIT author_grant I never gave, and Kobo is pinned to the single commit c2c8d4a with "to": "selected commit".  If the outreach pipeline turns any "yes" into an MIT grant, other authors who replied "GPL only" or "under the repository's licence" may be affected too.  ### Is this an Elasticsearch wire-compatibility divergence?  Unknown / not sure  ### Elasticsearch reference (if a compat divergence)  _No response_  ### Relevant

- **Issue #2654** (2026-10-29): **[bug]: constant_score inside a bool should loses its score after a flush**
  *Symptoms*: Written by an AI coding agent (Claude Code), run by @jelbirt, who has reviewed this change.  ### XERJ version  xerj v1.0.0-rc.100 (code unchanged on `main` 2c1609d18)  ### How did you install / run XERJ?  Prebuilt release binary  ### Operating system & architecture  Ubuntu 24.04.3 x86_64 (WSL2)  ### Steps to reproduce  ```shell xerj --insecure --port 9390 -d ./data & U=http://localhost:9390; J='content-type: application/json' curl -s -XPUT "$U/cs" -H "$J" -d '{"mappings":{"properties":{"t":{"type":"text"}}}}' curl -s -XPUT "$U/cs/_doc/1?refresh=true" -H "$J" -d '{"t":"alpha beta"}' curl -s -XPUT "$U/cs/_doc/2?refresh=true" -H "$J" -d '{"t":"alpha"}' Q='{"query":{"bool":{"must":[{"match":{"t":"alpha"}}],"should":[{"constant_score":{"filter":{"match":{"t":"beta"}},"boost":1000}}]}}}' curl -s "$U/cs/_search?filter_path=hits.hits._id,hits.hits._score" -H "$J" -d "$Q" curl -s -XPOST "$U/cs/_flush" curl -s "$U/cs/_search?filter_path=hits.hits._id,hits.hits._score" -H "$J" -d "$Q" ```  ### Expected behavior  Before and after the flush, doc 1 scores its `must` score plus 1000 and doc 2 its `must` score (the bare `must` gives 0.16044301 and 0.2111092). A `constant_score` scores every match exactly `boost`, and `bool` adds matching `should` scores.  ### Actual behavior  ``` before flush: {"hits":{"hits":[{"_id":"1","_score":1001.6932},{"_id":"2","_score":1.6931472}]}} after flush:  {"hits":{"hits":[{"_id":"1","_score":0.7704125},{"_id":"2","_score":0.2111092}]}} ```  After the flush th

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

### Incident Patch 1: `6236eccb` (2026-10-31)
**Commit Message**: fix(aggs): bound hdr number_of_significant_value_digits; one request hung a search thread (#2651)

`percentiles` / `percentile_ranks` with `hdr` size their histogram as the
next power of two at or above `2 * 10^digits`:

    let target = 2u64 * 10u64.pow(hdr_digits);
    let mut p = 1u64;
    while p < target { p <<= 1; }

Nothing bounded `digits`. Release builds have overflow checks off, so from
digits = 19 the product wraps. When the wrapped `target` is above 2^63
(digits 20, 26, 29-31, 39, ... and any u64 that truncates to one of them
through `as u32`), `p` shifts past 2^63 to 0 and the loop never ends. A
single request

  POST /idx/_search
  {"size":0,"aggs":{"p":{"percentiles":{"field":"n",
     "hdr":{"number_of_significant_value_digits":20}}}}}

pins a search thread at 100% CPU forever. Repeated, it exhausts the
search/blocking pool. The API validator routed `percentiles` to the
tdigest checks only, and the columnar fast path bails to this code
whenever `hdr` is present, so the loop is reached before any document is
read. The same loop is duplicated in `hdr_percentiles_values`
(xerj-api).

ES accepts 0..=5 significant digits and returns 400
"[numberOfSignificantValueDigits] 

**File**: `engine/crates/xerj-api/src/es_compat.rs` (modified, +91/-2)
```diff
@@ -8088,6 +8088,29 @@ fn find_invalid_agg_params(aggs: Option<&Value>) -> Option<String> {
             _ => None,
         }
     }
+    /// `hdr` options shared by `percentiles` and `percentile_ranks`. ES
+    /// accepts 0..=5 significant digits; anything else is a 400. The engine
+    /// sizes its histogram as `2 * 10^digits` rounded up to a power of two,
+    /// so an unchecked value such as 20 overflowed that `u64` and spun the
+    /// rounding loop forever on the search thread.
+    fn check_hdr(name: &str, params: &Value) -> Option<String> {
+        let digits = params
+            .get("hdr")?
+            .get("number_of_significant_value_digits")?;
+        if digits.as_u64().is_some_and(|d| d <= 5) {
+            return None;
+        }
+        if digits.is_null() {
+            return Some(
+                "[hdr] number_of_significant_value_digits doesn't support values of type: \
+                 VALUE_NULL"
+                    .to_string(),
+            );
+        }
+        Some(format!(
+            "[numberOfSignificantValueDigits] must be between 0 and 5: [{name}]"
+        ))
+    }
     /// Every descendant definition below `def`, as `(type, name)`.
     fn descendants<'a>(def: &'a Value, out: &mut Vec<(&'a str, &'a str)>) {
         for (name, child) in sub_aggs(def).into_iter().flatten() {
@@ -8178,11 +8201,33 @@ fn find_invalid_agg_params(aggs: Option<&Value>) -> Option<String> {
                     }
                 }
             }
-            "percentiles" => return check_tdigest(params),
+            "percentiles" => {
+                if let Some(e) = check_tdigest(params) {
+                    return Some(e);
+                }
+                if let Some(e) = check_hdr(name, params) {
+                    return Some(e);
+                }
+                match params.get("percents") {
+                    Some(Value::Null) => {
+                        return Some(format!("[percents] must not be null: [{name}]"))
+                    }
+                    Some(Value::Array(a)) if a.is_empty() => {
+                        return Some(format!("[percents] must not be empty: [{name}]"))
+                    }
+                    Some(Value::Array(a)) if !a.iter().all(Value::is_number) => {
+                        return Some(format!("[percents] must be numbers: [{name}]"))
+                    }
+                    _ => {}
+                }
+            }
             "percentile_ranks" => {
                 if let Some(e) = check_tdigest(params) {
                     return Some(e);
                 }
+                if let Some(e) = check_hdr(name, params) {
+                    return Some(e);
+                }
                 match params.get("values") {
                     None | Some(Value::Null) => {
                         return Some(format!("[values] must not be null: [{name}]"))
@@ -8331,6 +8376,47 @@ mod agg_param_validation_tests {
         }
     }
 
+    /// FAIL-BEFORE: none of these were refused. `hdr` digits of 20 (or any
+    /// value whose `2 * 10^digits` wraps `u64` past 2^63) also hung the search
+    /// thread in the engine's histogram sizing loop instead of erroring.
+    #[test]
+    fn percentiles_hdr_and_percents_are_validated() {
+        for digits in [
+            json!(-1),
+            json!(6),
+            json!(10),
+            json!(20),
+            json!(4294967316u64),
+        ] {
+            for kind in ["percentiles", "percentile_ranks"] {
+                let aggs = json!({"p": {kind: {"field": "f", "values": [1],
+                    "hdr": {"number_of_significant_value_digits": digits}}}});
+                assert_eq!(
+                    check(aggs.clone()).as_deref(),
+                    Some("[numberOfSignificantValueDigits] must be between 0 and 5: [p]"),
+                    "{aggs}"
+                );
+            }
+        }
+        let null_digits = json!({"p": {"percentiles": {"field": "f",
+            "hdr": {"number_of_significant_value_digits": null}}}});
+        assert!(check(null_digits).is_some_and(|e| e.contains("VALUE_NULL")));
+        for (percents, reason) in [
+            (json!([]), "[percents] must not be empty: [p]"),
+            (json!(null), "[percents] must not be null: [p]"),
+            (json!(["foo"]), "[percents] must be numbers: [p]"),
+        ] {
+            let aggs = json!({"p": {"percentiles": {"field": "f", "hdr": {},
+                                                    "percents": percents}}});
+            assert_eq!(check(aggs.clone()).as_deref(), Some(reason), "{aggs}");
+        }
+        for digits in 0..=5 {
+            let aggs = json!({"p": {"percentiles": {"field": "f", "percents": [50],
+                "hdr": {"number_of_significant_value_digits": digits}}}});
+            assert_eq!(check(aggs.clone()), None, "{aggs}");
+        }
+    }
+
     #[test]
     fn invalid_parameters_are_refused_with_es_messages() {
         let cases = [
@@ -92
```

**File**: `engine/crates/xerj-engine/src/aggs.rs` (modified, +24/-1)
```diff
@@ -8146,7 +8146,12 @@ fn run_percentiles(params: &Value, docs: &[Value]) -> Value {
         .get("hdr")
         .and_then(|v| v.get("number_of_significant_value_digits"))
         .and_then(Value::as_u64)
-        .unwrap_or(3) as u32;
+        .unwrap_or(3)
+        // ES bounds this to 0..=5. Past 18 `10^digits` overflows `u64` (it
+        // wraps in release) and the power-of-two loop below never ends, so
+        // clamp here too: agg definitions also reach the engine without the
+        // HTTP validator (MCP, msearch, async search, watchers).
+        .min(5) as u32;
     // subBucketCount = 2^ceil(log2(2 * 10^digits)). For digits=3 that's 2048.
     let sub_bucket_count: u64 = {
         let target = 2u64 * 10u64.pow(hdr_digits);
@@ -14322,6 +14327,24 @@ mod tests {
     use super::*;
     use serde_json::json;
 
+    /// FAIL-BEFORE: `2 * 10^20` wraps `u64` to a value above 2^63, so the
+    /// power-of-two rounding loop shifted `p` to 0 and spun forever. Run on a
+    /// side thread so a regression fails on the timeout instead of hanging.
+    #[test]
+    fn hdr_out_of_range_digits_terminate() {
+        let (tx, rx) = std::sync::mpsc::channel();
+        std::thread::spawn(move || {
+            let docs = vec![json!({ "n": 1 }), json!({ "n": 51 }), json!({ "n": 151 })];
+            let params = json!({"field": "n", "percents": [50],
+                                "hdr": {"number_of_significant_value_digits": 20}});
+            let _ = tx.send(run_percentiles(&params, &docs));
+        });
+        let out = rx
+            .recv_timeout(std::time::Duration::from_secs(10))
+            .expect("run_percentiles must return for out-of-range hdr digits");
+        assert!(out.get("values").is_some(), "{out}");
+    }
+
     #[test]
     fn multivalued_numeric_metric_aggs_use_all_values() {
         // ES aggregates over EVERY value of a multi-valued field; the old path
```

---

### Incident Patch 2: `f0409d2f` (2026-10-31)
**Commit Message**: fix(engine): run at most one background cold stored warm per index (refs #2427) (#2715)

* fix(engine): run at most one background cold stored warm per index

Refs #2427.

Motivation: on the 1 GB gate (seed 2421, cap 3072 MB) the node's anon
RSS peaked well above the cap during the search phase. The peak is not
index open (version map + HNSW reload is ~1.0 GB anon) but the first
cold full-text queries.

Root cause: hydrating FTS hits on a cold segment calls
schedule_cold_stored_warm, which spawned one spawn_blocking task per cold
segment, all concurrently (54 on pg-docs). Each runs stored_slices_for:
a whole stored-section decode plus brace_walk_offsets. The only gate was
memory_breaker_engaged() at schedule time, so one query started dozens of
whole-section decodes at once; most results were then refused at publish
by the SegmentHydrationBudget and dropped.

Evidence (variant.py, fresh node on the gate's data, RssAnon every 20 ms):
match title "opentelemetry" size 5: anon +3.4 GB; the query returns at
1.67 s, anon peaks at 4.75 GB at 2.5 s and falls back to 1.4 GB at 4.1 s.

Fix: an AtomicBool lets one warm run per index; a schedule while one is
running is skipped (counted in cold

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -126,6 +126,13 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   200-580 MB of warmed stored slices between 40 breaker engages. Queries
   still hydrate a segment on first read. (Refs #2427)
 
+- A cold full-text query no longer starts one background whole-section
+  stored decode per cold segment at once (refs #2427). On the 1 GB gate's
+  `pg-docs` (54 cold segments) one 5-hit query drove anon RSS from ~1.0 to
+  ~4.7 GB after it had returned, with most decodes refused by the hydration
+  budget at publish and thrown away. One background warm per index now runs
+  at a time and the others are skipped. Query answers are unchanged.
+
 - `simple_query_string` with `"fields": ["*"]` is answered from the inverted
   index instead of a stored-document scan of every segment (refs #2427). The
   bare `*` pattern lowered to a literal `"*"` field that has no index
```

**File**: `engine/crates/xerj-engine/src/index.rs` (modified, +157/-5)
```diff
@@ -2431,6 +2431,108 @@ mod flush_publication_recovery_tests {
         drop(engine);
     }
 
+    /// #2427: a cold query over a many-segment index must not start one
+    /// whole-section stored decode per segment at once. Before the fix every
+    /// cold segment the query hydrated from its winning rows spawned its own
+    /// background warm, all concurrently (54 on the 1 GB gate's pg-docs:
+    /// anon RSS ~1.0 -> ~4.7 GB after the query returned, cap 3 GiB). Now one
+    /// warm per index runs at a time and the rest are skipped, so one query
+    /// warms at most one segment; the answer is unchanged.
+    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
+    async fn cold_query_runs_at_most_one_stored_warm_2427() {
+        let dir = tempfile::tempdir().unwrap();
+        let engine = crate::Engine::new(topk_projection_config(dir.path())).unwrap();
+        engine
+            .create_index("warm-bound", topk_projection_schema())
+            .unwrap();
+        let idx = engine.get_index("warm-bound").unwrap();
+        idx.abort_background_tasks();
+        let blob = "0.125 33.9 -118.4 ".repeat(50);
+        for batch in 0..6u64 {
+            for i in 0..400u64 {
+                let n = batch * 400 + i;
+                // Later segments score higher, so every segment holds
+                // candidates for the page and is hydrated from its rows.
+                let body = if n % 7 == 0 {
+                    format!("{}report {n}", "needle ".repeat(batch as usize + 1))
+                } else {
+                    format!("hay stack {n}")
+                };
+                idx.index_document(
+                    Some(format!("doc-{n}")),
+                    json!({"title": format!("title {n}"), "body": body, "blob": blob}),
+                )
+                .await
+                .unwrap();
+            }
+            idx.flush().await.unwrap();
+        }
+        drop(idx);
+        drop(engine);
+
+        let engine = crate::Engine::new(topk_projection_config(dir.path())).unwrap();
+        let idx = engine.get_index("warm-bound").unwrap();
+        idx.abort_background_tasks();
+        let segs: Vec<String> = {
+            let snapshot = idx.store.snapshot();
+            snapshot.segments.iter().map(|s| s.id.to_string()).collect()
+        };
+        assert!(
+            segs.len() >= 4,
+            "precondition: many segments, got {}",
+            segs.len()
+        );
+        let warmed = |idx: &Index| {
+            segs.iter()
+                .filter(|id| {
+                    idx.stored_slices_cache.contains_key(id.as_str())
+                        || idx.decoded_stored_cache.contains_key(id.as_str())
+                })
+                .count()
+        };
+        assert_eq!(warmed(&idx), 0, "precondition: stored caches cold");
+
+        let request = xerj_query::parse_request(&json!({
+            "query": {"match": {"body": "needle"}},
+            "size": 5,
+            "_source": ["title"]
+        }))
+        .unwrap();
+        let cold = idx.search(&request).await.unwrap();
+        assert_eq!(cold.hits.len(), 5);
+        let hydrated = idx.cold_row_hydrations.load(Ordering::Relaxed);
+        assert!(
+            hydrated >= 3,
+            "precondition: the query hydrates several cold segments, got {hydrated}"
+        );
+        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
+        while !idx.cold_stored_warms.is_empty() {
+            assert!(std::time::Instant::now() < deadline, "warm never settled");
+            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
+        }
+        // Let any (pre-fix) straggler publish before counting.
+        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
+        // The bound is on warms running at once. A warm that finishes while
+        // the query is still hydrating lets the next cold segment start
+        // one, so the total warmed can exceed one on a fast runner (CI saw
+        // 2 of 6); the number in flight never does.
+        let peak = idx.cold_stored_warm_peak.load(Ordering::Acquire);
+        assert!(
+            peak <= 1,
+            "one cold query ran {peak} stored warms at once over {} segments",
+            segs.len()
+        );
+
+        // The warm answer equals the cold answer.
+        let warm = idx.search(&request).await.unwrap();
+        let ids = |r: &xerj_query::executor::SearchResult| {
+            r.hits.iter().map(|h| h.id.clone()).collect::<Vec<_>>()
+        };
+        assert_eq!(ids(&cold), ids(&warm));
+        drop(idx);
+        drop(engine);
+    }
+
     /// #2422/#2423: on a cold segment (after a restart, or evicted under the
     /// cache budget) a top-k query that names its `_source` fields must read
     /// only the winning rows and only the needed columns. Before the fix the
@@ -10858,8 +10960,17 @@ pub struct Index {
     self_ref: std::sync::OnceLock<std::sync:
```

---

### Incident Patch 3: `e5675dec` (2026-10-31)
**Commit Message**: fix(engine): flush one shard at a time when draining for memory pressure (#2753)

Motivation: in the #2427 A/B at a 1,536 MB cap, one breaker drain took
RSS from 1,460 MB to 2,323 MB in about a second (node log 19:10:25Z,
off arm). The drain that is meant to release memory was the largest
single RSS spike of the run.

Root cause: Engine::pressure_drain and release_rebuildable_memory call
Index::flush, which since M5.15 spawns one task per non-empty memtable
shard and runs them in parallel (about four building at once under the
finalize gate). Each shard's segment build holds its parsed documents,
columns, postings and stored blocks, none of which is charged to the
memtable budget, so the working set of a parallel drain is several
times the charged memtable bytes it frees.

Fix: Index::flush becomes flush_with(FlushFanout::Parallel); a new
Index::flush_one_shard_at_a_time (FlushFanout::Serial) awaits each
shard task before starting the next, folding the results through the
same fold_shard_flush. The two memory-release paths use the serial
variant; ordinary flushes (refresh, interval, explicit _flush) keep the
parallel fan-out.

Evidence: serial_pressure_flush_tests::a_pressure_drain

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -68,6 +68,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   longer take a node from below the watermark into the parent breaker band and
   turn ingest into HTTP 429s. The relief for a search node resting between the
   merge-pool ceiling and the watermark is kept (#2427).
+- **A memory-pressure drain no longer spikes RSS past the cap while it
+  flushes** (#2427). The breaker drain and the cache-release path
+  flushed each index with every non-empty memtable shard building its
+  segment at once, and that working set (parsed documents, columns,
+  postings, stored blocks) is not charged to the memtable budget. On a
+  1,536 MB-capped node one drain took RSS from 1,460 MB to 2,323 MB in
+  about a second. Memory-release flushes now build one shard at a time;
+  ordinary flushes still run in parallel.
 
 - The per-index document version map is smaller and now visible in the
   ingest memory trace. Its keys are `Box<str>` instead of `String`, which
```

**File**: `engine/crates/xerj-engine/src/engine.rs` (modified, +79/-2)
```diff
@@ -4566,8 +4566,11 @@ impl Engine {
         if release_caches {
             return self.release_rebuildable_memory(&loaded).await;
         }
+        // One shard at a time (#2427): the flush working set is uncharged,
+        // and building every shard at once is what pushed RSS past the cap
+        // in the middle of the drain meant to bring it down.
         for idx in &loaded {
-            if idx.memtable_bytes() > 0 && idx.flush().await.is_err() {
+            if idx.memtable_bytes() > 0 && idx.flush_one_shard_at_a_time().await.is_err() {
                 tracing::warn!("memory pressure drain: flush failed");
             }
         }
@@ -4641,7 +4644,9 @@ impl Engine {
     /// released.
     pub async fn release_rebuildable_memory(&self, indices: &[Arc<Index>]) -> usize {
         for idx in indices {
-            if idx.memtable_bytes() > 0 && idx.flush().await.is_err() {
+            // Serial for the same reason as `pressure_drain` (#2427): a
+            // release must not spike RSS on its way down.
+            if idx.memtable_bytes() > 0 && idx.flush_one_shard_at_a_time().await.is_err() {
                 tracing::warn!("memory release: flush failed, releasing caches anyway");
             }
             idx.release_memory();
@@ -6616,3 +6621,75 @@ mod pressure_drain_tests {
         );
     }
 }
+
+#[cfg(test)]
+mod serial_pressure_flush_tests {
+    use super::Engine;
+    use crate::index::FlushShardProbe;
+    use serde_json::json;
+    use tempfile::TempDir;
+    use xerj_common::config::Config;
+    use xerj_common::types::{FieldConfig, FieldType, Schema};
+
+    async fn seed(engine: &Engine, name: &str, n: usize) {
+        let mut schema = Schema::empty();
+        schema
+            .fields
+            .push(FieldConfig::new("body", FieldType::Text));
+        engine.create_index(name, schema).expect("create");
+        let idx = engine.get_index(name).expect("get");
+        for i in 0..n {
+            idx.index_document(
+                Some(format!("d{i}")),
+                json!({ "body": format!("document number {i}") }),
+            )
+            .await
+            .expect("index");
+        }
+    }
+
+    async fn count_all(engine: &Engine, name: &str) -> u64 {
+        let idx = engine.get_index(name).expect("get index");
+        let req = xerj_query::parse_request(
+            &json!({ "query": { "match_all": {} }, "size": 0, "from": 0 }),
+        )
+        .expect("parse_request");
+        idx.search(&req).await.expect("search").total.value
+    }
+
+    /// #2427: a breaker drain builds one shard segment at a time. The flush
+    /// working set (parsed docs, columns, postings, stored blocks) is not
+    /// charged to the memtable budget, and a drain that built every shard at
+    /// once took RSS from 1,460 MB to 2,323 MB on a 1,536 MB-capped node.
+    /// The control index shows the ordinary flush still fans out, so the
+    /// probe does see concurrency when there is some. FAIL-BEFORE:
+    /// `pressure_drain` called `Index::flush`, which runs every non-empty
+    /// shard at once (peak > 1 here).
+    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
+    async fn a_pressure_drain_flushes_one_shard_at_a_time() {
+        let dir = TempDir::new().unwrap();
+        let mut config = Config::default();
+        config.server.data_dir = dir.path().to_str().unwrap().to_string();
+        let engine = Engine::new(config).expect("engine::new");
+
+        seed(&engine, "serial-drain-control", 400).await;
+        let control = engine.get_index("serial-drain-control").unwrap();
+        control.flush().await.expect("flush");
+        assert!(
+            FlushShardProbe::peak("serial-drain-control") > 1,
+            "the ordinary flush runs shards concurrently"
+        );
+
+        seed(&engine, "serial-drain", 400).await;
+        let idx = engine.get_index("serial-drain").unwrap();
+        assert!(idx.memtable_bytes() > 0);
+        engine.pressure_drain(false).await;
+        assert_eq!(idx.memtable_bytes(), 0, "the drain published the memtable");
+        assert_eq!(
+            FlushShardProbe::peak("serial-drain"),
+            1,
+            "a pressure drain must build one shard at a time"
+        );
+        assert_eq!(count_all(&engine, "serial-drain").await, 400);
+    }
+}
```

**File**: `engine/crates/xerj-engine/src/index.rs` (modified, +102/-12)
```diff
@@ -28693,6 +28693,25 @@ impl Index {
 
     /// Flush the memtable to a new segment on disk, then build the FTS index.
     pub async fn flush(self: &Arc<Self>) -> Result<()> {
+        self.flush_with(FlushFanout::Parallel).await
+    }
+
+    /// [`Self::flush`] with one shard building at a time (#2427).
+    ///
+    /// A shard flush parses the drained documents, builds columns, postings
+    /// and the stored blocks, and none of that working set is charged to the
+    /// memtable budget. The parallel flush builds every non-empty shard at
+    /// once (bounded only by the finalize gate), so a breaker drain on a
+    /// 1,536 MB-capped node took RSS from 1,460 MB to 2,323 MB in about a
+    /// second while four shards built together. A memory-release caller
+    /// wants the peak bounded more than it wants the drain short: each
+    /// shard's segment publishes and its working set is freed before the
+    /// next shard starts.
+    pub async fn flush_one_shard_at_a_time(self: &Arc<Self>) -> Result<()> {
+        self.flush_with(FlushFanout::Serial).await
+    }
+
+    async fn flush_with(self: &Arc<Self>, fanout: FlushFanout) -> Result<()> {
         // #873: this flush is about to take whatever the memtable holds, so
         // every idle-probe observation about it is stale from here on. Clear
         // the pair at the ONE coordinator every flush path runs through
@@ -28756,6 +28775,7 @@ impl Index {
         // coordinator is not aborted (#1015).
         let coordinator = tokio::spawn(async move {
             let mut shard_futures = Vec::with_capacity(n_shards);
+            let mut result: Result<()> = Ok(());
             for shard_idx in 0..n_shards {
                 // #1226 — do not fan a finalize out for an EMPTY shard.
                 //
@@ -28789,7 +28809,9 @@ impl Index {
                 let shard_index_name = coordinator_name.clone();
                 #[cfg(test)]
                 let test_hook = flush_test_hook.clone();
-                shard_futures.push(tokio::spawn(async move {
+                let shard_task = tokio::spawn(async move {
+                    #[cfg(test)]
+                    let _in_flight = FlushShardProbe::enter(&shard_index_name).await;
                     let permit = match wait_for_flush_permit(
                         &shard_index_name,
                         "the flush semaphore",
@@ -28831,19 +28853,14 @@ impl Index {
                         let _ = guard.take();
                     }
                     result
-                }));
+                });
+                match fanout {
+                    FlushFanout::Parallel => shard_futures.push(shard_task),
+                    FlushFanout::Serial => fold_shard_flush(&mut result, shard_task.await),
+                }
             }
-            let mut result: Result<()> = Ok(());
             for fut in shard_futures {
-                match fut.await {
-                    Ok(Ok(())) => {}
-                    Ok(Err(e)) => result = Err(e),
-                    Err(error) => {
-                        result = Err(EngineError::Common(xerj_common::XerjError::internal(
-                            format!("flush shard task failed: {error}"),
-                        )));
-                    }
-                }
+                fold_shard_flush(&mut result, fut.await);
             }
             // Publication completion must invalidate results even when the
             // request that initiated the flush was cancelled. The coordinator
@@ -36686,6 +36703,79 @@ tokio::task_local! {
     static FLUSH_PUBLISHER_TEST_HOOK: FlushPublisherTestHook;
 }
 
+/// How [`Index::flush_with`] runs its shard flushes.
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+enum FlushFanout {
+    /// Every non-empty shard at once (M5.15): the shortest flush.
+    Parallel,
+    /// One shard after another: the smallest uncharged working set (#2427).
+    Serial,
+}
+
+/// Keep the last shard error, as the parallel join always has.
+fn fold_shard_flush(
+    result: &mut Result<()>,
+    joined: std::result::Result<Result<()>, tokio::task::JoinError>,
+) {
+    match joined {
+        Ok(Ok(())) => {}
+        Ok(Err(e)) => *result = Err(e),
+        Err(error) => {
+            *result = Err(EngineError::Common(xerj_common::XerjError::internal(
+                format!("flush shard task failed: {error}"),
+            )));
+        }
+    }
+}
+
+/// Test-only count of shard-flush tasks in flight per index, with the peak.
+#[cfg(test)]
+static FLUSH_SHARD_PROBE: std::sync::LazyLock<
+    dashmap::DashMap<
+        String,
+        (
+            Arc<std::sync::atomic::AtomicUsize>,
+            Arc<std::sync::atomic::AtomicUsize>,
+        ),
+    >,
+> = std::sync::LazyLock::new(dashmap::DashMap::new);
+
+#[cfg(test)]
+pub(crate) struct FlushShardProbe(Arc<std::sync::atomic::AtomicUsize>);
+
+#[cfg(test)]
+impl FlushShardProbe {
+    /// Count this shard task in, then yield so sibling tasks of a parallel
+   
```

#### Recent Merged Pull Requests:
- **PR #2798** (2026-10-31): hub: author-approved contribution candidates (8953 repos) (@xerj-org)
- **PR #2797** (2026-10-31): CLA: add xobotyi to .contributors (@xobotyi)
- **PR #2795** (2026-10-31): docs: sign contributor license agreement (@mammaddrik)
- **PR #2792** (2026-10-31): hub: author-approved contribution candidates (8923 repos) (@xerj-org)
- **PR #2790** (2026-10-31): docs(feedback): report code size-boundary experience (@Jarvis636431)
- **PR #2789** (2026-10-31): fix(autoindex): report exact code size-limit skips (@Jarvis636431)

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

## X. aggs): bound hdr number_of_significant_value_digits; one request hung a search t

**RULE**:
When implementing operations in `engine/crates/xerj-api/src/es_compat.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6236eccb`: aggs): bound hdr number_of_significant_value_digits; one request hung a search thread (#2651). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `engine/crates/xerj-api/src/es_compat.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// `hdr` options shared by `percentiles` and `percentile_ranks`. ES
    /// accepts 0..=5 significant digits; anything else is a 400. The engine
    /// sizes its histogram as `2 * 10^digits` rounded up to a power of two,
    /// so an unchecked value such as 20 overflowed that `u64` and spun the
    /// rounding loop forever on the search thread.
    fn check_hdr(name: &str, params: &Value) -> Option<String> {
        let digits = params
            .get("hdr")?
            .get("number_of_significant_value_digits")?;
        if digits.as_u64().is_some_and(|d| d <= 5) {
            return None;
        }
        if digits.is_null() {
            return Some(
                "[hdr] number_of_significant_value_digits doesn't support values of type: \
                 VALUE_NULL"
                    .to_string(),
            );
        }
        Some(format!(
            "[numberOfSignificantValueDigits] must be between 0 and 5: [{name}]"
        ))
    }
            "percentiles" => {
                if let Some(e) = check_tdigest(params) {
                    return Some(e);
                }
                if let Some(e) = check_hdr(name, params) {
                    return
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
            "percentiles" => return check_tdigest(params),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6236eccb` are properly handled with clean fallback behavior.
