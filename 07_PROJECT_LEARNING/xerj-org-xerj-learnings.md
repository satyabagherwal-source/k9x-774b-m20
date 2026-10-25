> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source**: github ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Source Version**: `d6ef7fbb`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T14:50:58.780Z  
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
> **Harvest Timestamp**: 2026-10-25T14:50:58.773Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: Local-first search engine and MCP server for AI agents. One Rust binary indexes code, docs, logs, JSONL/CSV and PDFs for BM25 full-text, vector and hybrid search, code search without grep, agent memory and RAG. Elasticsearch-compatible API; Corpus Hub serves hundreds of reference memory corpora.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 15454 stars

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
- **Issue #2201** (2026-10-22): **corpus licence detection misses lower-case license.txt / License.md (records NONE-FOUND)**
  *Symptoms*: From API field report #2196 (agent qwen3.8-flash-next, Claude Code subagent; R2 key `reports/2026-10-22/1792690737963-1b6a55aa.json`, Oct 22, 2026).  > Licence auto-detection: jfreechart NONE-FOUND (ships license.txt, is LGPL-2.1) — same class as the documented ta4j case; set registry licence manually.  `detect_licence` in `engine/crates/xerj-common/src/xccode/licence.rs` only looks at root files whose names start with upper-case `LICENSE`, `LICENCE` or `COPYING`. A repo that ships `license.txt`, `License.md` or `copying` is recorded as `NONE-FOUND`, which `is_restricted` treats as restricted, so every passage gets the "do not copy" warning and the operator has to set the registry licence by hand.  Expected: the filename match is case-insensitive, so `license.txt` is read and classified (LGPL for jfreechart). The 3rdparty-inventory skip already lowercases the name.  Opened by Xerj Merger from agent field reports. 

- **Issue #2199** (2026-10-23): **corpus add: an untracked .xerjignore in the source tree is silently dropped (clone indexes without it)**
  *Symptoms*: From field report #2196 (agent qwen3.8-flash-next, rc.97 local node).  `xerj corpus add <name> <path>` git-clones the given path into `~/.xerj-code/corpora/<name>/<name>` and indexes that clone. An untracked `.xerjignore` in the source tree is not part of the clone, so it is silently dropped and only the built-in ignore rules apply.  Observed on wicket: the first build indexed 5,825 files with only built-in rules, producing 8 poisoned structured datasets and a 37,888-record docs dataset. Workaround used: write the `.xerjignore` into the corpora copy, delete the bad datasets, `index --fresh`, then the mapping-scan cleanup recipe.  Expected: `corpus add` honours the source tree's `.xerjignore` even when it is untracked (copy it into the clone, or warn loudly that it was ignored), and the docs mention the behaviour. 

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

### Incident Patch 1: `f6b1d612` (2026-10-25)
**Commit Message**: Batch: land 11 reviewed fixes (rc.100) (#2377)

* feat(cluster): run _delete_by_query on every shard primary

Motivation: with a shard plan, POST /{index}/_delete_by_query ran on the
member that accepted the call. That member's user index only contains its
own shard, so a match_all from any other member deleted nothing it did not
own, and the delete was never copied onto the in-sync replica. PR #2347
routed _update_by_query and left this path on the receiving node.

Root cause: delete_by_query called the local runner on the indexes open
on the accepting node. Those indexes are not the other primaries' shards.

What changed: when a cluster handle is attached, the request is sent to
every primary as ShardOp::DeleteByQuery. Each primary deletes only its
shard and copies those deletes through the existing replicate_write
quorum. max_docs is one budget spent in node-id order. A primary that
does not answer is refused before any write. wait_for_completion=false
uses the same fan-out. [cluster] enabled = false returns before it and
runs the existing runner.

The fan-out and the runner are boxed so a debug worker (2 MiB) does not
build both on one stack. A primary, including this node, is 

**File**: `CHANGELOG.md` (modified, +142/-0)
```diff
@@ -7,6 +7,148 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Added
+
+- `xerj autoindex` names a file family in the run summary when every file of
+  that family was junked, or when junked files are a strict majority
+  (`junk_files * 2 > files`; stale-plan skips are not counted). The human
+  summary and the progress stream print one `warning:` line per family with
+  the count and the most common junk reason. `--json` and the catalog run
+  document gain `family_junk_warnings` only when that happens; existing
+  summary fields are unchanged and exit codes are unchanged. `xerj autoindex
+  map` and the MCP `xerj_map` response include the same warnings
+  ([#2370](https://github.com/xerj-org/xerj/issues/2370)).
+
+- `xerj autoindex map <folder>` previews a folder that has not been indexed.
+  It runs the same discovery as `xerj autoindex <folder> --dry-run` (walk,
+  sniff, infer, and print the plan) and writes nothing to an index.
+  `xerj autoindex map` with no folder still prints the catalog of what is
+  already indexed
+  ([#2368](https://github.com/xerj-org/xerj/issues/2368)).
+
+- With `[cluster] enabled = true`, `POST /{index}/_delete_by_query` runs on
+  every shard primary, whichever member accepted the request. Each primary
+  deletes the documents in its own shard and copies those deletes to the
+  in-sync replicas, with the same quorum as `DELETE /{index}/_doc/{id}`.
+  `max_docs` is one budget for the index, spent across primaries in
+  node-id order, not once per shard. A primary that does not answer
+  refuses the request before any document is written. A copy that misses
+  quorum is HTTP 503 `replica_not_acknowledged`: the primaries that ran
+  have the delete, and the response still reports `deleted` and
+  `failures`. `wait_for_completion=false` uses the same path. Native
+  `/v1` ingest still writes on the receiving node. A write still needs
+  the primary. `[cluster] enabled = false` does not take this path (part of
+  [#1170](https://github.com/xerj-org/xerj/issues/1170); the issue stays
+  open).
+
+### Fixed
+
+- A graph-path `xerj autoindex` resume whose plan predates files now on disk
+  names those files in the summary. The human text under the `ok:` line, the
+  lines immediately before `xerj-done`, the run document, and the
+  `--progress json` terminal object list the first five paths
+  (`skipped_appeared_files`), how many were not listed
+  (`skipped_appeared_not_listed`, only when the list was capped), and say to
+  re-run with `--fresh`. `skipped_appeared` stays the full count. Exit code 3
+  and `reason=stale-resume-plan` are unchanged. The plain `xerj-done` line
+  stays `key=value` numbers, because a path may contain spaces
+  ([#2372](https://github.com/xerj-org/xerj/issues/2372)).
+
+- `xerj autoindex` indexes `.ts` and `.tsx` sources under Next.js route
+  directories such as `app/[locale]/booking/[token]/`. Gitignore reads
+  `[locale]` as a character class, so a line written as the directory name
+  (`!app/[locale]/**` or `app/[locale]/`) did not name that directory and a
+  broader `*` left the sources out of the docs index with no file named.
+  Each ignore-file line that contains an unescaped bracket is also applied
+  to the literal directory name. A real class such as `*.[ch]` is
+  unchanged. A route-like class is explained in the ignore summary, a
+  pruned `[…]` directory is named, and a code file that is still skipped
+  is named with the rule
+  ([#2357](https://github.com/xerj-org/xerj/issues/2357)).
+
+- `xerj autoindex` extracts JavaScript definitions from inline `<script>`
+  blocks in HTML pages. `function openDrawer()` inside a `<script>` in a
+  `.html` or `.htm` file becomes a code symbol (`defs` / `symbols`, plus a
+  per-declaration record), so `xerj def`, `xerj search`, and the MCP def
+  and search tools cite that function at its line in the HTML file. A
+  `src` script, a non-JavaScript type (`application/ld+json`, a template),
+  and `<style>` are not definitions. The page body stays the visible text.
+  A page taken as a data table (five or more consistent rows) stays row
+  records. An HTML file already sealed in a generation keeps those records
+  until the file bytes change or the tree is indexed under a new
+  `--state-dir`
+  ([#2356](https://github.com/xerj-org/xerj/issues/2356)).
+
+- Proxy embeddings (`--embed-mode proxy`, `[embedding] default_endpoint`)
+  accept an OpenAI-style base URL. A path ending in `/v1` or `/v1/`, and a
+  bare host, have `/embeddings` appended. A URL that already ends in
+  `/embeddings` is POSTed unchanged, and a trailing slash is dropped. Any
+  other path refuses to start in `mode = "proxy"` and names the URL that was
+  set plus the `{origin}/v1/embeddings` path to use. In `mode = "auto"` that
+  same path is an init failure and keeps the existing lexical fallback
+  (#1189) instead of being called. A local vLLM base such as
+  `http://loc
```

**File**: `content/answers/autoindex-exit-codes.md` (modified, +17/-11)
```diff
@@ -7,7 +7,7 @@ cluster: "Operations: exit codes"
 question: "What does indexer exit code 3 mean?"
 intent: "troubleshooting"
 published: "2026-08-22"
-updated: "2026-10-19"
+updated: "2026-10-24"
 author: "XERJ documentation team"
 reviewer: "XERJ engineering team"
 schema_type: "TechArticle"
@@ -38,10 +38,10 @@ links_out:
   - "autoindex-dataset-refused-by-server"
   - "autoindex-server-back-pressure-429"
 evidence:
-  - claim: "EXIT CODES: 0 complete (also: gate answered with --approve cancel); 3 completed-with-junk (junk recorded, never fatal) - this includes a dataset whose mapping the server REFUSED: its files are recorded as junk with the server's reason, the xerj-done line carries datasets_refused / files_refused, and every other dataset is indexed; 4 NEEDS A DECISION - the estimate exceeded --max-minutes and nothing was indexed, a JSON decision request is on stdout; 2 usage; 1 endpoint/journal failure, a refused corpus removal, or a refused unsafe state transition."
-    source: "engine/crates/xerj-autoindex/src/cli.rs:395"
+  - claim: "EXIT CODES: 0 complete (also: gate answered with --approve cancel); 3 completed-with-junk (junk recorded, never fatal) — SUCCESS: the index is searchable, and the summary on stdout opens with a line starting `ok:` that says so (xerj-done carries ok=true). Treat 0 and 3 alike as a finished run. This includes a dataset whose mapping the server REFUSED: its files are recorded as junk with the server's reason, the xerj-done line carries datasets_refused / files_refused, and every other dataset is indexed; 4 NEEDS A DECISION — the estimate exceeded --max-minutes and nothing was indexed, a JSON decision request is on stdout; 2 usage; 1 endpoint/journal failure, a refused corpus removal, or a refused unsafe state transition."
+    source: "engine/crates/xerj-autoindex/src/cli.rs:771"
   - claim: "Exit 4 is a code of its own; 1 is the catch-all for real failures, and the decision request is answered by re-running the same command with --approve proceed, fast or cancel."
-    source: "engine/crates/xerj-autoindex/src/cli.rs:395"
+    source: "engine/crates/xerj-autoindex/src/cli.rs:771"
   - claim: "A forced mapping refusal ended xerj-done ok=true exit=3 reason=completed-with-junk wall=0.7s files=1 records=1 generation=1 datasets_refused=1 files_refused=2, with the other dataset indexed."
     source: "benchmarks/autoindex-resilience/refusal-e2e.run1.stderr.txt"
   - claim: "Before issue #955 was fixed, a 48,533-file --no-graph run applied every operation and then ended xerj-done ok=false exit=1 reason=aborted wall=10336.0s, because the catalog went out as one bulk request of 51,129 actions and the engine's max_actions_per_bulk is 50,000."
@@ -54,7 +54,7 @@ evidence:
     source: "engine/crates/xerj-autoindex/src/lib.rs:277"
 faq:
   - q: "What does indexer exit code 3 mean?"
-    a: "It means the run completed and recorded junk. `xerj autoindex --help` states it as `3 completed-with-junk (junk recorded, never fatal)`. Treat it as a success with a refusal list to read."
+    a: "It means the run completed and recorded junk. `xerj autoindex --help` states it as `3 completed-with-junk (junk recorded, never fatal) — SUCCESS` and says to treat 0 and 3 alike as a finished run. Treat it as a success with a refusal list to read. Do not rerun it as a failure."
   - q: "The indexer exited 3 (or 4). Did it fail?"
     a: "3 did not fail. 4 did not fail either, and it did not index anything: it is a decision request waiting for `--approve`. Only 1 and 2 are failures."
   - q: "Why did folder indexing stop and ask me to approve?"
@@ -80,7 +80,7 @@ The list below is quoted from `xerj autoindex --help` on the installed binary. R
 | Exit | Name in `--help` | What it means for the corpus |
 | --- | --- | --- |
 | 0 | complete | The run finished and refused nothing. A gate answered with `--approve cancel` also exits 0. |
-| 3 | completed-with-junk | The run finished. At least one file was refused and recorded. Never fatal. This includes a whole dataset whose mapping the server refused. |
+| 3 | completed-with-junk | SUCCESS. The run finished. At least one file was refused and recorded. Treat it the same as exit 0: the index is searchable. This includes a whole dataset whose mapping the server refused. |
 | 4 | NEEDS A DECISION | The estimate exceeded `--max-minutes`. Nothing was indexed. A JSON decision request is on stdout. |
 | 2 | usage | The command line was wrong. Nothing ran. |
 | 1 | endpoint/journal failure | The node or the resume journal failed, a corpus removal was refused, or an unsafe state transition was refused. |
@@ -89,7 +89,7 @@ Read the table in that order rather than in numeric order. It is the order the h
 
 ## Exit 3 is a finished run
 
-`3 completed-with-junk (junk recorded, never fatal)` is the phrase in the help text, and `never fatal` is doing the work in that sentence.
+`3 completed-with-junk (junk recorded, never fatal) — SUCCESS` is the phrase in the help text, a
```

**File**: `content/answers/check-codebase-index-is-complete.md` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ cluster: "Operations: completeness"
 question: "My codebase indexer says indexed but I don't see my code. How do I check it actually finished?"
 intent: "troubleshooting"
 published: "2026-08-21"
-updated: "2026-10-19"
+updated: "2026-10-24"
 author: "XERJ documentation team"
 reviewer: "XERJ engineering team"
 schema_type: "TechArticle"
@@ -39,7 +39,7 @@ faq:
   - q: "How do I verify a local code index actually contains my files?"
     a: "Query for a symbol you know exists. The captured query on the defs field for merge_segments returned 2 hits, src/lib.rs in Rust and src/ingest.py in Python, each with its path."
   - q: "The indexer exited. Did it finish or just stop?"
-    a: "Read the terminal line and then the journal. Exit 0 with reason=completed means nothing was refused, and exit 3 with reason=completed-with-junk means the run finished and refused at least one file."
+    a: "Read the terminal line and then the journal. Exit 0 with reason=completed means nothing was refused. Exit 3 with reason=completed-with-junk is success: the run finished and refused at least one file. Do not treat exit 3 as a failure."
   - q: "Why does the index hold more documents than files?"
     a: "XERJ writes one document per extracted row, and for source files it adds one document per declaration on top of the whole-file document. The document count therefore follows how many declarations your code holds, not a fixed multiple of the file count, so read it from your own run."
   - q: "Why does the plan hold fewer files than the folder?"
```

**File**: `content/answers/read-autoindex-progress.md` (modified, +7/-5)
```diff
@@ -7,7 +7,7 @@ cluster: "Operations: progress"
 question: "How can I see whether folder indexing is still working?"
 intent: "how-to"
 published: "2026-08-21"
-updated: "2026-10-19"
+updated: "2026-10-24"
 author: "XERJ documentation team"
 reviewer: "XERJ engineering team"
 schema_type: "TechArticle"
@@ -148,15 +148,15 @@ Every run shows `phase=starting` until its first real phase opens. On that resum
 
 The `index` phase applies one file at a time, so it is the slow one on a large corpus. Read `eta_s` once `eta_quality` leaves `unknown`.
 
-## scan at 100% now means scan
+## `scan` at 100% now means `scan`
 
-Through v1.0.0-rc.74 the `--no-graph` route reported only `walk`, `hash` and `scan`. Mapping install, sealing, indexing and the read-back all ran with no phase of their own, so the stream kept describing the scan that had already finished:
+Through v1.0.0-rc.74 the `--no-graph` route reported only `walk`, `hash` and `scan`. Mapping install, sealing, indexing and the read-back all ran with no phase of their own, so the stream kept describing the `scan` that had already finished:
 
 ```text
 xerj-progress phase=scan basis=bytes pct=100.0 items=48533/48533 bytes=520892779/520892779 rate=17050775.5 eta_s=unknown eta_quality=stalled since_progress_s=15.0 phase_elapsed_s=25.7 elapsed_s=30.0
 ```
 
-The rc.74 capture holds 48 such lines, with `since_progress_s` climbing to 250.0. A real hang at the end of the scan prints exactly the same thing. Neither a person nor an agent could tell the two apart.
+The rc.74 capture holds 48 such lines, with `since_progress_s` climbing to 250.0. A real hang at the end of the `scan` prints exactly the same thing. Neither a person nor an agent could tell the two apart.
 
 On a current build each of those steps is a phase, and the small-repository capture holds 0 lines that read `scan` at `pct=100.0`. If you are on rc.74 or earlier and see that line, check `_count` on the node before you conclude the run is hung.
 
@@ -168,7 +168,9 @@ On a current build each of those steps is a phase, and the small-repository capt
 xerj-done ok=true exit=0 reason=completed wall=22.2s files=1 records=164441 datasets=1 junk_files=0
 ```
 
-`reason` distinguishes `completed`, `dry-run`, `completed-with-junk`, `aborted` and, on the `--no-graph` path, `server-backpressure`, and the exit code follows it. Exit 3 with `completed-with-junk` means the run refused some files, and the catalog holds a reason for each one. `server-backpressure` is exit 1: the node kept rejecting for the whole 600 s a bulk waits, and the line adds `ops_applied` and `ops_remaining` so you know how much the same command still has to do.
+`reason` distinguishes `completed`, `dry-run`, `completed-with-junk`, `aborted` and, on the `--no-graph` path, `server-backpressure`, and the exit code follows it. Exit 3 with `completed-with-junk` means the run refused some files, and the catalog holds a reason for each one. `server-backpressure` is exit 1. The node kept rejecting for the whole 600 s a bulk waits. The line adds `ops_applied` and `ops_remaining` so you know how much the same command still has to do.
+
+Exit 3 is success. Treat it the same as exit 0. Do not rerun it as a failure.
 
 If the server refused a whole dataset, the line also carries `datasets_refused` and `files_refused`. They appear only when it happened. The [refused-dataset page](/answers/autoindex-dataset-refused-by-server) covers that case.
 
```

**File**: `content/answers/why-autoindex-skipped-files.md` (modified, +3/-3)
```diff
@@ -7,7 +7,7 @@ cluster: "Operations: exclusions"
 question: "Why would a folder search miss files that I can see on disk?"
 intent: "troubleshooting"
 published: "2026-08-21"
-updated: "2026-10-19"
+updated: "2026-10-24"
 author: "XERJ documentation team"
 reviewer: "XERJ engineering team"
 schema_type: "TechArticle"
@@ -43,7 +43,7 @@ faq:
   - q: "Does autoindex index my .env file?"
     a: "Not in this capture. Hidden dotfiles were pruned, and a query across _all for the fixture secrets returned 0 hits. Ignore rules are a filter, not an access control."
   - q: "What does exit code 3 from autoindex mean?"
-    a: "The run finished but refused at least one file. The terminal line reads reason=completed-with-junk, and junk_files counts the refusals."
+    a: "Exit 3 is success. The run finished and refused at least one file. The terminal line reads reason=completed-with-junk, and junk_files counts the refusals. Do not rerun it as a failure."
 ---
 
 **TL;DR** — XERJ prints one line per ignore rule with an exact file count, and stores a refusal reason for every file it opened. A capture over 26 files on disk indexed 1, refused 2 with named reasons, and excluded 23 through ignore rules. The run exited 3 with `reason=completed-with-junk`.
@@ -115,6 +115,6 @@ The captured run ended with a terminal line that names both the outcome and the
 xerj-done ok=true exit=3 reason=completed-with-junk wall=3.1s files=1 records=2 datasets=1 junk_files=2 code_files=0 code_files_indexed=0 code_files_junked=0
 ```
 
-Exit 0 with `reason=completed` means nothing was refused. Exit 3 with `reason=completed-with-junk` means the catalog holds at least one reason worth reading.
+Exit 0 with `reason=completed` means nothing was refused. Exit 3 with `reason=completed-with-junk` is success: the run finished, the index is searchable, and the catalog holds at least one reason worth reading. Do not rerun exit 3 as a failure.
 
 Every number above comes from a capture on 2026-10-05, on a build of `main` after v1.0.0-rc.82 (commit `06185966`). The Parquet hint is not in the v1.0.0-rc.82 release itself: that release reports such a file as `binary content (unknown)`. The binary was a `quick` profile build, so the `wall` figure is not a performance number.
```

**File**: `docs/RERANK.md` (modified, +4/-1)
```diff
@@ -379,7 +379,10 @@ the picture:
   `http://localhost:9200` unless you say otherwise. On an empty corpus ledger,
   `xerj code` and `xerj corpus list` also POST one catalog search to that same
   node URL (autoindex run prefixes, and the API key when one is configured);
-  no document text and no user query.
+  no document text and no user query. After a successful search, `xerj search`
+  and MCP `xerj_search` POST one catalog search to that same node URL (the
+  autoindex run for the prefix, and the API key when one is configured) so a
+  folder older than its files can be named; no document text and no user query.
   `xerj batch-search` sends the batch's queries or identifiers to `/_msearch`
   and optionally reads index mappings at that node, with the configured API
   key when present (`--url` / `--auth` override `XERJ_URL` / `XERJ_AUTH`).
```

**File**: `docs/examples/external-embeddings/README.md` (modified, +18/-4)
```diff
@@ -37,10 +37,24 @@ the endpoint in your config). The API key is read from the
 `XERJ_EMBEDDING_API_KEY` environment variable and sent as
 `Authorization: Bearer <key>`.
 
-The wire contract is the standard one:
+`default_endpoint` is not always the request URL. Accepted forms, trailing
+slash optional:
+
+| configured | request URL |
+|---|---|
+| `http://127.0.0.1:8900/v1` or `…/v1/` | `http://127.0.0.1:8900/v1/embeddings` |
+| `http://127.0.0.1:8900` or `…/` | `http://127.0.0.1:8900/embeddings` |
+| `http://127.0.0.1:8900/v1/embeddings` | unchanged |
+
+Any other path refuses to start when `mode = "proxy"`. The error names the
+URL that was set and suggests `{origin}/v1/embeddings`. The string in the
+config stays the embedder identity, so switching a corpus from the full path
+to the `/v1` base is a different embedder.
+
+The wire contract is the standard one, posted to that request URL:
 
 ```
-POST {default_endpoint}
+POST {request URL}
 {"input": ["text one", "text two"], "model": "<default_model>"}
 → {"data": [{"embedding": [ ... ], "index": 0}, { ... }]}
 ```
@@ -55,9 +69,9 @@ Any endpoint that speaks the contract above works — just change
 
 | provider | `default_endpoint` |
 |---|---|
-| OpenAI | `https://api.openai.com/v1/embeddings` |
+| OpenAI | `https://api.openai.com/v1/embeddings` or `https://api.openai.com/v1` |
 | Gemini (OpenAI-compatible mode) | `https://generativelanguage.googleapis.com/v1beta/openai/embeddings` |
-| Local (text-embeddings-inference, LM Studio, llama.cpp server, …) | `http://localhost:PORT/v1/embeddings` |
+| Local vLLM, Ollama, text-embeddings-inference, LM Studio, llama.cpp server, … | `http://localhost:PORT/v1` or `http://localhost:PORT/v1/embeddings` |
 
 > Verified in this repo against the reproducible mock, which implements the
 > exact request/response shape XERJ sends. Real providers that speak the same
```

**File**: `docs/examples/external-embeddings/xerj-proxy.toml` (modified, +3/-0)
```diff
@@ -1,5 +1,8 @@
 [embedding]
 mode = "proxy"
+# Full embeddings path (used unchanged). `http://127.0.0.1:8900/v1` and
+# `http://127.0.0.1:8900/v1/` also work: `/embeddings` is appended. A bare
+# host gets `/embeddings`. Any other path refuses to start.
 default_endpoint = "http://127.0.0.1:8900/v1/embeddings"
 default_model = "mock-embed-256"
 batch_size = 64
```

---

### Incident Patch 2: `9625d7c8` (2026-10-25)
**Commit Message**: Bypass proxy env vars for loopback XERJ node clients (#2381)

* fix(mcp): bypass proxy env vars for loopback node clients

Motivation: MCP tools (xerj_search, xerj_map) returned HTTP 503 against a
healthy node at 127.0.0.1:9200 when ALL_PROXY was a socks5 proxy. curl
--noproxy reached the same node. Reported on macOS arm64 in #2379.

Root cause: the MCP reqwest client is built with the default proxy
matcher. reqwest honours ALL_PROXY, HTTP_PROXY, and HTTPS_PROXY for
127.0.0.1, localhost, and ::1. An HTTP proxy that cannot reach loopback
returns its own 503, which the tool reported as "XERJ returned HTTP 503".
The socks feature is off, so a socks5 ALL_PROXY still intercepts the
request. xerj-hub already called .no_proxy() for loopback; MCP and the
shared autoindex node client did not.

Change: node_http_builder and node_blocking_builder call .no_proxy() when
url_is_loopback is true (127.0.0.1, localhost, ::1, 0.0.0.0 — the same
predicate that decides the admin key stays local). Non-loopback URLs keep
the process proxy, including NO_PROXY. A 502, 503, or 504 that did go
through a proxy, and a connect failure to that proxy, name the proxy
(userinfo stripped) instead of "XERJ returned 

**File**: `CHANGELOG.md` (modified, +13/-0)
```diff
@@ -43,6 +43,19 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- MCP calls to a loopback node (`127.0.0.1`, `localhost`, `::1`) no longer
+  follow `ALL_PROXY`, `HTTP_PROXY`, or `HTTPS_PROXY`. reqwest sends those
+  addresses through the proxy unless the client opts out, so a socks or HTTP
+  proxy in the environment answered HTTP 503 while the node was healthy and
+  `curl --noproxy` reached it. `xerj autoindex`, `xerj search`, `xerj def`,
+  and the other commands that share the node HTTP client skip the proxy for
+  the same hosts. A non-loopback URL still uses the process proxy, including
+  `NO_PROXY`. When a proxy is used and returns HTTP 502, 503, or 504, or the
+  connection to it fails, the tool error names the proxy (`request to …
+  went through proxy http://…, which returned HTTP 503`) instead of
+  `XERJ returned HTTP 503`
+  ([#2379](https://github.com/xerj-org/xerj/issues/2379)).
+
 - `xerj mcp`: `xerj_code_search` now gives up on a node that does not
   answer. Its requests went through a fresh HTTP client without the 30 s
   deadline every other tool uses, so a node that accepted the connection
```

**File**: `engine/Cargo.lock` (modified, +2/-0)
```diff
@@ -7690,6 +7690,8 @@ version = "1.0.0-rc.99"
 dependencies = [
  "anyhow",
  "axum",
+ "http 1.4.0",
+ "hyper-util",
  "reqwest",
  "serde_json",
  "tempfile",
```

**File**: `engine/crates/xerj-autoindex/src/esclient.rs` (modified, +20/-1)
```diff
@@ -1188,6 +1188,23 @@ fn with_single_wal_shard(body: &Value) -> Value {
     body
 }
 
+/// HTTP client for one XERJ node.
+///
+/// A loopback URL (`127.0.0.1`, `localhost`, `::1`, `0.0.0.0` — the same
+/// hosts as [`xerj_common::localauth::url_is_loopback`]) skips
+/// `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY`. reqwest would otherwise send
+/// `127.0.0.1` through them, and a proxy that cannot reach loopback answers
+/// HTTP 503 while the node is up (#2379). A non-loopback URL keeps those
+/// variables, including `NO_PROXY`.
+pub(crate) fn node_blocking_builder(url: &str) -> reqwest::blocking::ClientBuilder {
+    let builder = reqwest::blocking::Client::builder();
+    if xerj_common::localauth::url_is_loopback(url) {
+        builder.no_proxy()
+    } else {
+        builder
+    }
+}
+
 impl Es {
     pub fn new(url: &str, api_key: Option<String>) -> Result<Self> {
         Self::with_bulk_timeout(url, api_key, 300)
@@ -1214,7 +1231,9 @@ impl Es {
         retry_initial_delay: Duration,
         retry_max_delay: Duration,
     ) -> Result<Self> {
-        let http = reqwest::blocking::Client::builder()
+        // Loopback skips HTTP(S)_PROXY / ALL_PROXY (#2379). A non-loopback
+        // URL keeps them, including NO_PROXY. Same rule as `xerj mcp`.
+        let http = node_blocking_builder(url)
             .timeout(Duration::from_secs(300))
             .danger_accept_invalid_certs(true)
             .build()
```

**File**: `engine/crates/xerj-autoindex/src/xc.rs` (modified, +1/-1)
```diff
@@ -219,7 +219,7 @@ fn prefixes_from_catalog_hits(v: &Value) -> Option<Vec<String>> {
 /// One catalog read. `None` on any failure, including a node that is not
 /// there: callers print nothing in that case.
 fn fetch_catalog_run_prefixes(url: &str, explicit_key: Option<&str>) -> Option<Vec<String>> {
-    let http = reqwest::blocking::Client::builder()
+    let http = crate::esclient::node_blocking_builder(url)
         .connect_timeout(CATALOG_HINT_CONNECT)
         .timeout(CATALOG_HINT_TIMEOUT)
         .danger_accept_invalid_certs(true)
```

**File**: `engine/crates/xerj-engine/tests/node_lock.rs` (modified, +63/-3)
```diff
@@ -8,6 +8,8 @@
 //! `<data_dir>/node.lock` before any index open / WAL replay, and fails
 //! fast with the holder's pid.
 
+use std::sync::{Mutex, OnceLock};
+
 use tempfile::TempDir;
 use xerj_common::config::Config;
 use xerj_engine::Engine;
@@ -18,8 +20,19 @@ fn config_for(dir: &TempDir) -> Config {
     config
 }
 
+/// `Engine::new` installs process-wide governor and pool state, and the
+/// stale-lock test rebuilds the tracing interest cache. The two tests in
+/// this binary have to take turns.
+fn serialize_tests() -> std::sync::MutexGuard<'static, ()> {
+    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
+    LOCK.get_or_init(|| Mutex::new(()))
+        .lock()
+        .unwrap_or_else(|poison| poison.into_inner())
+}
+
 #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
 async fn second_engine_on_same_data_dir_fails_fast_with_holder_pid() {
+    let _guard = serialize_tests();
     let dir = TempDir::new().unwrap();
     let engine = Engine::new(config_for(&dir)).expect("first engine must boot");
 
@@ -41,20 +54,67 @@ async fn second_engine_on_same_data_dir_fails_fast_with_holder_pid() {
     // Dropping the holder releases the OS lock; the stale node.lock FILE
     // left behind (as after kill -9) must never block the next boot.
     drop(engine);
-    let reopened = Engine::new(config_for(&dir));
+    let reopened = reopen_after_drop(&dir);
     assert!(
         reopened.is_ok(),
-        "reopen after the holder exits must succeed: {:?}",
-        reopened.err()
+        "reopen after the holder exits must succeed: {:?} (open node.lock fds: {})",
+        reopened.err(),
+        node_lock_fds()
     );
 }
 
+/// The OS lock is released when the holder's file is closed. Full-workspace
+/// CI has still observed `WouldBlock` from this process immediately after
+/// `drop` (this branch's run 40152941822, and `main` run 40145228672) and
+/// a pass of the same test on run 40148648744. Wait briefly for that close
+/// to become visible. A lock that stays held still fails.
+fn reopen_after_drop(dir: &TempDir) -> Result<Engine, xerj_engine::EngineError> {
+    let mut last = Engine::new(config_for(dir));
+    for _ in 0..20 {
+        if last.is_ok() {
+            return last;
+        }
+        let still_ours = last
+            .as_ref()
+            .err()
+            .map(|err| err.to_string())
+            .is_some_and(|text| text.contains("already in use") && text.contains("node.lock"));
+        if !still_ours {
+            return last;
+        }
+        std::thread::sleep(std::time::Duration::from_millis(10));
+        last = Engine::new(config_for(dir));
+    }
+    last
+}
+
+fn node_lock_fds() -> String {
+    let Ok(dir) = std::fs::read_dir("/proc/self/fd") else {
+        return "unavailable".to_string();
+    };
+    let mut hits = Vec::new();
+    for entry in dir.flatten() {
+        if let Ok(target) = std::fs::read_link(entry.path()) {
+            let text = target.to_string_lossy();
+            if text.contains("node.lock") {
+                hits.push(text.into_owned());
+            }
+        }
+    }
+    if hits.is_empty() {
+        "none".to_string()
+    } else {
+        hits.join(", ")
+    }
+}
+
 /// A `node.lock` left by a process that has exited must not block the next
 /// boot, and the reclaim is logged. This is the file `kill -9` leaves once
 /// the kernel has dropped `flock`, and the file a crashed Windows process
 /// leaves behind when `LockFileEx` does not.
 #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
 async fn stale_node_lock_from_a_dead_pid_is_reclaimed_on_start() {
+    let _guard = serialize_tests();
     let dir = TempDir::new().unwrap();
     let dead = reaped_pid();
     std::fs::write(dir.path().join("node.lock"), format!("{dead}\n")).unwrap();
```

**File**: `engine/crates/xerj-hub/src/node.rs` (modified, +2/-1)
```diff
@@ -77,7 +77,8 @@ pub fn resolve_url(explicit: Option<&str>) -> String {
 /// probe to the proxy, and the proxy's own `502 Bad Gateway` page then reads as
 /// "an HTTP answer, so a node is running" — the hub would decline to start the
 /// node it needs, or talk to a proxy believing it is one. A remote `--url` keeps
-/// the system proxy settings.
+/// the system proxy settings. `xerj mcp` and the autoindex node client use the
+/// same loopback bypass (#2379).
 fn client_builder(url: &str) -> reqwest::blocking::ClientBuilder {
     let builder = reqwest::blocking::Client::builder();
     if url_is_loopback(url) {
```

**File**: `engine/crates/xerj-mcp/Cargo.toml` (modified, +5/-0)
```diff
@@ -25,6 +25,11 @@ tokio = { workspace = true }
 # Inherits the workspace's default-features=false + rustls-tls config, so it
 # builds in the same offline/cross-compile matrix as the rest of the tree.
 reqwest = { workspace = true }
+# Same proxy matcher reqwest consults (`HTTP(S)_PROXY`, `ALL_PROXY`, `NO_PROXY`).
+# Used to name the proxy in a failure. The client still lets reqwest apply it.
+# Loopback targets never reach this: they are built with `no_proxy()` (#2379).
+hyper-util = { version = "0.1.20", default-features = false, features = ["client-proxy"] }
+http = "1"
 # All request/response bodies are handled as untyped JSON `Value`s — no
 # bespoke serde structs, which keeps the wire contract identical to what the
 # engine already accepts.
```

**File**: `engine/crates/xerj-mcp/src/batch.rs` (modified, +13/-6)
```diff
@@ -282,15 +282,19 @@ fn item_result(
 }
 
 async fn msearch(ctx: &Ctx, ndjson: String) -> Result<Vec<Value>, String> {
+    let url = format!("{}/_msearch", ctx.base_url);
     let mut req = ctx
         .client
-        .post(format!("{}/_msearch", ctx.base_url))
+        .post(&url)
         .header("Content-Type", "application/x-ndjson")
         .body(ndjson);
     if let Some(auth) = &ctx.auth {
         req = req.header("Authorization", auth);
     }
-    let mut resp = req.send().await.map_err(|e| crate::error_detail(&e))?;
+    let mut resp = req
+        .send()
+        .await
+        .map_err(|e| crate::transport_failure_text(&ctx.base_url, &url, &e))?;
     let status = resp.status();
     let mut bytes = Vec::new();
     while let Some(chunk) = resp.chunk().await.map_err(|e| crate::error_detail(&e))? {
@@ -300,10 +304,13 @@ async fn msearch(ctx: &Ctx, ndjson: String) -> Result<Vec<Value>, String> {
         bytes.extend_from_slice(&chunk);
     }
     if !status.is_success() {
-        return Err(format!(
-            "batch endpoint returned HTTP {status}: {}",
-            String::from_utf8_lossy(&bytes)
-        ));
+        let body = String::from_utf8_lossy(&bytes);
+        if let Some(proxied) =
+            crate::proxy_status_failure(&ctx.base_url, &url, status.as_u16(), &body)
+        {
+            return Err(proxied);
+        }
+        return Err(format!("batch endpoint returned HTTP {status}: {body}"));
     }
     let response: Value =
         serde_json::from_slice(&bytes).map_err(|_| "batch endpoint returned invalid JSON")?;
```

---

### Incident Patch 3: `c9c4a7ca` (2026-10-25)
**Commit Message**: fix(mcp): answer ping and honour cancellation while a tool call runs (#2394)

The stdio loop handled one message at a time: it awaited handle_message
before reading the next line. A tools/call waiting on the node therefore
held every message behind it. Against a node that accepts connections
and never answers, a ping sent 0.2 s after an xerj_search call was
answered after 60 s (two 30 s request deadlines: mapping, then search).
notifications/cancelled was matched and dropped, and in a serial loop it
could not have been read before the call ended anyway (#2390).

The loop now lives in serve(ctx, reader, writer), so tests can drive it
over in-memory pipes; run() passes stdin and stdout. In serve():

- each tools/call request runs on its own task; ping, initialize,
  tools/list and notifications stay inline, since they never wait;
- every reply goes through one writer task, so lines never interleave;
- InFlight maps request id to the task's abort handle.
  notifications/cancelled removes the entry and aborts the task. A task
  writes its reply only if its entry is still there, so a cancellation
  that wins the race means no response, as the MCP spec asks. The entry
  is registered und

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -67,6 +67,16 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- `xerj mcp` no longer holds every message behind a slow tool call. Each
+  `tools/call` runs on its own task, so `ping`, `tools/list` and other
+  calls are answered while one call waits on the node. A ping sent 0.2 s
+  after a call to a stalled node was answered after 60 s; it is now
+  answered at once. `notifications/cancelled` now aborts the call it names,
+  and no response is sent for that call, as the MCP spec asks; it used to
+  be ignored. Replies can go out in any order (they are matched by `id`); a
+  batch is still answered one line per request
+  ([#2390](https://github.com/xerj-org/xerj/issues/2390)).
+
 - `xerj autoindex remove --root` also deletes indices an aborted or failed
   build of that folder left behind when the build never wrote a catalog run.
   The resume journal names the folder and the index names; a catalog walk
```

**File**: `engine/crates/xerj-mcp/src/lib.rs` (modified, +284/-8)
```diff
@@ -398,10 +398,41 @@ pub async fn run(args: &[String]) -> anyhow::Result<()> {
     }
 
     // stdout is the JSON-RPC channel; stderr is for logs only.
-    let mut lines = BufReader::new(tokio::io::stdin()).lines();
-    let mut stdout = tokio::io::stdout();
+    serve(ctx, BufReader::new(tokio::io::stdin()), tokio::io::stdout()).await
+}
+
+/// The JSON-RPC loop over newline-delimited messages, apart from the process'
+/// stdin/stdout so tests can drive it over an in-memory pipe.
+///
+/// A `tools/call` request runs on its own task, so a call that waits on the
+/// node does not hold up the messages behind it (#2390): `ping`,
+/// `initialize`, `tools/list` and notifications stay inline because they never
+/// wait on anything. Replies are matched by `id`, so they may go out in any
+/// order. `notifications/cancelled` aborts the call it names, and no response
+/// is written for it. Every reply goes through one writer task, so lines never
+/// interleave. At end of input the loop waits for the calls still running and
+/// writes their replies before returning, as the serial loop did.
+async fn serve<R, W>(ctx: Ctx, reader: R, stdout: W) -> anyhow::Result<()>
+where
+    R: tokio::io::AsyncBufRead + Unpin,
+    W: tokio::io::AsyncWrite + Unpin + Send + 'static,
+{
+    let ctx = std::sync::Arc::new(ctx);
+    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Value>();
+    let writer = tokio::spawn(async move {
+        let mut stdout = stdout;
+        while let Some(msg) = rx.recv().await {
+            write_msg(&mut stdout, &msg).await?;
+        }
+        anyhow::Ok(())
+    });
+    let in_flight = InFlight::default();
+    let mut calls = tokio::task::JoinSet::new();
+    let mut lines = reader.lines();
 
     while let Some(line) = lines.next_line().await? {
+        // Reap finished calls so a long session does not accumulate them.
+        while calls.try_join_next().is_some() {}
         let line = line.trim();
         if line.is_empty() {
             continue;
@@ -411,14 +442,19 @@ pub async fn run(args: &[String]) -> anyhow::Result<()> {
             Ok(v) => v,
             Err(e) => {
                 // Parse error: reply per JSON-RPC (id unknown → null).
-                let resp = rpc_error(Value::Null, -32700, format!("parse error: {e}"));
-                write_msg(&mut stdout, &resp).await?;
+                if tx
+                    .send(rpc_error(Value::Null, -32700, format!("parse error: {e}")))
+                    .is_err()
+                {
+                    break;
+                }
                 continue;
             }
         };
 
         // JSON-RPC allows a batch (array) of messages. MCP 2024-11-05 uses it;
         // 2025-06-18 dropped it. Support both: object → single, array → batch.
+        // A batch keeps the serial handling it always had, one reply per line.
         let responses: Vec<Value> = match parsed {
             Value::Array(batch) => {
                 let mut out = Vec::new();
@@ -429,20 +465,119 @@ pub async fn run(args: &[String]) -> anyhow::Result<()> {
                 }
                 out
             }
+            msg if is_cancellation(&msg) => {
+                if let Some(id) = msg.pointer("/params/requestId") {
+                    in_flight.cancel(id);
+                }
+                Vec::new()
+            }
+            msg if is_tool_call_request(&msg) => {
+                let key = id_key(&msg["id"]);
+                let (ctx, tx, registry) = (ctx.clone(), tx.clone(), in_flight.clone());
+                in_flight.start(&mut calls, key, move |token| async move {
+                    let reply = handle_message(&ctx, msg).await;
+                    // A cancellation that got here first means: say nothing.
+                    if registry.finish(token) {
+                        if let Some(reply) = reply {
+                            let _ = tx.send(reply);
+                        }
+                    }
+                });
+                Vec::new()
+            }
             other => handle_message(&ctx, other).await.into_iter().collect(),
         };
 
-        for resp in responses {
-            write_msg(&mut stdout, &resp).await?;
+        if responses.into_iter().any(|resp| tx.send(resp).is_err()) {
+            break; // the writer stopped: its error is returned below
         }
     }
 
-    Ok(())
+    while calls.join_next().await.is_some() {}
+    drop(tx);
+    writer.await?
+}
+
+fn is_tool_call_request(msg: &Value) -> bool {
+    msg.get("method").and_then(Value::as_str) == Some("tools/call")
+        && msg.get("id").is_some_and(|id| !id.is_null())
+}
+
+fn is_cancellation(msg: &Value) -> bool {
+    msg.get("method").and_then(Value::as_str) == Some("notifications/cancelled")
+}
+
+/// A request id as a map key. JSON-RPC ids are strings or numbers and `2` is
+/// not `"2"`, so the key is the id's JSON text.
+fn id_key(id: &Value) -> String {
+    id.to_string()
+}
+
+/// The `tools
```

#### Recent Merged Pull Requests:
- **PR #2398** (2026-10-25): Sign CLA: add peteretelej to .contributors (@peteretelej)
- **PR #2397** (2026-10-25): agent field report: sandboxed CVE-landscape research channel and cgroup memory (@peteretelej)
- **PR #2396** (2026-10-25): Sign CLA: add bebac to .contributors (@bebac)
- **PR #2395** (closed): Add cppcoreguidelines corpus: C++ Core Guidelines (MIT, isocpp/CppCor… (@bebac)
- **PR #2394** (2026-10-25): fix(mcp): answer ping and honour cancellation while a tool call runs (@ahmetadakli)
- **PR #2393** (2026-10-25): fix(autoindex): remove orphan indices left by an aborted build (@xerj-org)

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

## X. Batch: land 11 reviewed fixes (rc.100) (#2377)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f6b1d612`: Batch: land 11 reviewed fixes (rc.100) (#2377). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
### Added

- `xerj autoindex` names a file family in the run summary when every file of
  that family was junked, or when junked files are a strict majority
  (`junk_files * 2 > files`; stale-plan skips are not counted). The human
  summary and the progress stream print one `warning:` line per family with
  the count and the most common junk reason. `--json` and the catalog run
  document gain `family_junk_warnings` only when that happens; existing
  summary fields are unchanged and exit codes are unchanged. `xerj autoindex
  map` and the MCP `xerj_map` response include the same warnings
  ([#2370](https://github.com/xerj-org/xerj/issues/2370)).

- `xerj autoindex map <folder>` previews a folder that has not been indexed.
  It runs the same discovery as `xerj autoindex <folder> --dry-run` (walk,
  sniff, infer, and print the plan) and writes nothing to an index.
  `xerj autoindex map` with no folder still prints the catalog of what is
  already indexed
  ([#2368](https://github.com/xerj-org/xerj/issues/2368)).

- With `[cluster] enabled = true`, `POST /{index}/_delete_by_query` runs on
  every shard primary, whichever member accepted the request. Each primary
  deletes the document
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f6b1d612` are properly handled with clean fallback behavior.
