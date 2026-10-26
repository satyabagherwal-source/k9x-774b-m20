> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source**: github ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Source Version**: `045aada9`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T11:15:43.074Z  
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
> **Harvest Timestamp**: 2026-10-26T11:15:43.066Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: Local-first search engine and MCP server for AI agents. One Rust binary indexes code, docs, logs, JSONL/CSV and PDFs for BM25 full-text, vector and hybrid search, code search without grep, agent memory and RAG. Elasticsearch-compatible API; Corpus Hub serves hundreds of reference memory corpora.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 15711 stars

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
- **Issue #2438** (2026-10-26): **Indexing ~5x slower since rc.78: background merges use zstd level 19**
  *Symptoms*: ## Summary  Bulk indexing under the memory governor has been about 5x slower since **v1.0.0-rc.78**. The README and BENCHMARK_VS_ES.md claims (faster and smaller than Elasticsearch/Lucene) were measured before rc.78.  Cause: ec712826 / PR #1042 ("ZBS4 stored-section slim ... merge-path zstd chooser"). Every **background** merge now tries a zstd level 19 + long-distance matching (window 2^24) candidate on each stored JSON column and keeps the smaller one (`engine/crates/xerj-storage/src/stored_codec.rs:272` `RAW_LONG_LEVEL = 19`; called from `engine/crates/xerj-engine/src/index.rs:14250` via `encode_stored_v2_merge_at_level`).  zstd 19 runs at about 2 MB/s per thread, so the stored part of a merge batch went from **2.4-3.3 s to 94-107 s**. RSS sits at or above the parent breaker's 95% watermark while the merge runs. The breaker latches and `_bulk` gets 429s until the merge finishes. The loader stalls for 60-100 s at a time, and in one run it dropped 34,398 docs after its retry budget ran out.  The codec comment says "merges are background work, so the extra encode pass is not on any back-pressure-critical path". With the memory governor, that is not true.  Two side findings from the same runs: - The `xerj-drain-free` helper thread was skipped with "memory is at the governor watermark". The thread that frees memory was refused because memory was high. - `_forcemerge?max_num_segments=1` stopped at 2 segments. At a 2 GiB cap the per-batch byte cap is 32 MiB. Once every segment is

- **Issue #2428** (2026-10-26): **[URGENT] autoindex client aborts on thread spawn EAGAIN (os error 11) after 73 min, losing the run**
  *Symptoms*: **Benchmark setup (Oct 25, 2026):** xerj v1.0.0-rc.99 (x86_64-unknown-linux-musl release binary), 15 GB RAM Linux box, one `xerj autoindex` run over a ~5 GB folder of real data (146,199 files: Rust and Go dependency sources, the xerj repo, JSONL audit data, CVE JSON and mbox, ADS-B flight-trace JSON). Command: `xerj autoindex /workspace/bench/src --prefix b5 --state-dir state2 --max-index-size 25GB --approve proceed --workers 4 --no-graph`  ## Summary The rc.99 run-4 autoindex client (`--workers 4 --no-graph`) aborted after ~1h13m with `Resource temporarily unavailable (os error 11)` when it tried to start a new thread. That's EAGAIN from thread creation under memory or thread pressure. The whole run was lost: 8.6 GB of state and 748 MB indexed, unfinished.  ## Asks - Every client-side thread spawn (scan, fetch, prepare, bulk senders, progress) goes through the fallible spawn path that rc.100 already uses for the scan and fetch pools. On failure, run the work inline or back off and retry, never abort. - Keep the thread count bounded for the whole run; check for per-dataset or per-index thread or runtime creation that grows with the ~450 datasets. - Make resume work after such an abort, without `--fresh`.  Severity: critical (part of #1122). 

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

### Incident Patch 1: `12e36e31` (2026-10-26)
**Commit Message**: fix(engine): background merges skip the zstd-19 stored encode (ingest ~5x regression since rc.78) (#2441)

* fix(engine): background merges skip the level-19 stored encode; drain-free starts at the watermark; force-merge converges past the batch cap

Since rc.78 (ec712826, #1042) every background merge ran a zstd-19 + LDM
candidate on each stored JSON column. That made the stored encode ~35x
slower (2.4-3.3 s -> 94-107 s per merge batch on a 1M-doc corpus) and held
RSS at the breaker watermark for the whole merge, so ingest got 429s.

- Background merges encode stored columns at the operator's level only.
  An explicit _forcemerge (or XERJ_MERGE_MAX_EFFORT=true) keeps level 19.
- xerj-drain-free frees memory, so it now ignores the watermark spawn gate.
- A force-merge whose segments each exceed half the batch cap merges the
  two smallest instead of stopping short of max_num_segments.

* style: rustfmt

* docs(changelog): ingest regression fix (#2438)

* test(storage): force-merge level-19 test uses a JSON fallback column (cardinality above the dict cap)

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +17/-0)
```diff
@@ -121,6 +121,23 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   queries on stray digits. Re-index to drop them from existing indices.
   (#2423)
 
+- **Indexing is fast again under a memory cap** (issue
+  [#2438](https://github.com/xerj-org/xerj/issues/2438), part of
+  [#2423](https://github.com/xerj-org/xerj/issues/2423)). Since rc.78 every
+  background merge also tried a very slow, very small compression (zstd level
+  19) on the stored documents. That made each merge ~35x slower in that step,
+  kept memory at the limit for the whole merge, and made `_bulk` answer 429
+  until it ended, so indexing was about 5x slower and a loader could give up
+  and drop documents. Background merges now use the normal compression level.
+  An explicit `_forcemerge` still uses the slow, small one, so the force-merged
+  size is unchanged; set `XERJ_MERGE_MAX_EFFORT=true` to use it for every
+  merge. No data format change.
+- **The helper thread that frees memory now starts when memory is high.**
+  `xerj-drain-free` was refused with "memory is at the governor watermark",
+  which is exactly when it is needed.
+- **`_forcemerge?max_num_segments=1` now reaches one segment** when every
+  segment is larger than half the per-merge size cap (it used to stop at two).
+
 - Server startup now reports the resolved data directory, its configuration
   source and whether this launch created it. New-directory guidance points
   operators back to their previous `--data-dir` or `--config` when they expected
```

**File**: `engine/crates/xerj-common/src/thread_spawn.rs` (modified, +16/-0)
```diff
@@ -325,6 +325,22 @@ where
     try_spawn_with(&StdSpawn, true, name, f)
 }
 
+/// Spawn a helper whose only job is to *free* memory (e.g. the memtable's
+/// `xerj-drain-free`, which drops drained generations off the publish path).
+///
+/// Ignores the watermark gate on purpose: the gate closes exactly when RSS
+/// is at the governor watermark, which is exactly when a memory-relief
+/// helper should run. Gating it meant the drain's frees ran inline on the
+/// publish thread under pressure (logged as "best-effort helper thread was
+/// not started"). A real OS failure is still an `Err` with the job handed
+/// back, and the caller drops it inline.
+pub fn try_spawn_memory_relief<F>(name: &str, f: F) -> Result<SpawnedThread, SpawnFailure<F>>
+where
+    F: FnOnce() + Send + 'static,
+{
+    try_spawn_with(&StdSpawn, true, name, f)
+}
+
 /// [`try_spawn`] with an explicit stack size.
 ///
 /// Used by the in-process shard call, whose handler does not fit on the
```

**File**: `engine/crates/xerj-common/tests/memory_relief_spawn_at_watermark.rs` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+//! A memory-relief helper (`xerj-drain-free`) must start when the governor
+//! watermark gate is closed — that is when it is needed. Its own test binary
+//! because the spawn gate is process-global (first install wins).
+
+use std::sync::mpsc;
+use std::time::Duration;
+
+use xerj_common::thread_spawn::{
+    install_spawn_gate, spawn_allowed, try_spawn, try_spawn_memory_relief,
+};
+
+fn at_watermark() -> bool {
+    false
+}
+
+#[test]
+fn drain_free_helper_starts_at_the_watermark() {
+    assert!(install_spawn_gate(at_watermark));
+    assert!(!spawn_allowed(), "gate simulates RSS at the watermark");
+
+    // An ordinary best-effort helper is refused at the watermark...
+    assert!(try_spawn("xerj-best-effort", || {}).is_err());
+
+    // ...but the memory-relief helper starts and runs its job.
+    let (tx, rx) = mpsc::channel();
+    let handle = try_spawn_memory_relief("xerj-drain-free", move || {
+        tx.send(()).unwrap();
+    })
+    .unwrap_or_else(|f| panic!("relief spawn refused at the watermark: {}", f.error));
+    rx.recv_timeout(Duration::from_secs(10))
+        .expect("relief job ran");
+    handle.join().unwrap();
+}
```

**File**: `engine/crates/xerj-engine/src/index.rs` (modified, +148/-23)
```diff
@@ -105,6 +105,128 @@ async fn await_publication_barrier<T>(rx: tokio::sync::oneshot::Receiver<T>, wha
     }
 }
 
+/// Forcemerge batch selection over segments sorted smallest first: chunks
+/// of at most `chunk_len` segments whose input stays under `cap` bytes
+/// (`0` = no cap, #948). Returns index lists into `sizes`.
+///
+/// Convergence: when every segment is already larger than half the cap,
+/// no chunk can hold two, and the old selection returned nothing — an
+/// explicit `max_num_segments=1` stopped at 2+ segments (seen on a 2 GiB
+/// cap: two 16-27 MB segments vs a 32 MiB batch cap). In that case the two
+/// smallest segments are merged anyway: one minimal batch is the least an
+/// explicit force-merge must do to make progress, and the caller loops
+/// passes until it reaches its target.
+pub(crate) fn forcemerge_chunks(sizes: &[u64], chunk_len: usize, cap: u64) -> Vec<Vec<usize>> {
+    let chunk_len = chunk_len.max(2);
+    let mut chunks: Vec<Vec<usize>> = Vec::new();
+    let mut batch: Vec<usize> = Vec::new();
+    let mut batch_bytes = 0u64;
+    for (i, &size) in sizes.iter().enumerate() {
+        if !batch.is_empty()
+            && (batch.len() >= chunk_len || (cap > 0 && batch_bytes.saturating_add(size) > cap))
+        {
+            chunks.push(std::mem::take(&mut batch));
+            batch_bytes = 0;
+        }
+        batch_bytes = batch_bytes.saturating_add(size);
+        batch.push(i);
+    }
+    if !batch.is_empty() {
+        chunks.push(batch);
+    }
+    chunks.retain(|c| c.len() >= 2);
+    if chunks.is_empty() && sizes.len() >= 2 {
+        chunks.push(vec![0, 1]);
+    }
+    chunks
+}
+
+#[cfg(test)]
+mod forcemerge_chunks_tests {
+    use super::forcemerge_chunks;
+    const MIB: u64 = 1024 * 1024;
+
+    #[test]
+    fn segments_over_the_cap_still_converge_to_one() {
+        // The corpus200 case: two segments, each over half a 32 MiB cap.
+        assert_eq!(
+            forcemerge_chunks(&[16 * MIB, 27 * MIB], 16, 32 * MIB),
+            vec![vec![0, 1]]
+        );
+        // Three oversized segments: merge the two smallest this pass.
+        assert_eq!(
+            forcemerge_chunks(&[40 * MIB, 50 * MIB, 60 * MIB], 16, 32 * MIB),
+            vec![vec![0, 1]]
+        );
+    }
+
+    #[test]
+    fn cap_and_count_still_split_batches() {
+        let sizes = [MIB; 5];
+        assert_eq!(
+            forcemerge_chunks(&sizes, 2, 0),
+            vec![vec![0, 1], vec![2, 3]]
+        );
+        assert_eq!(
+            forcemerge_chunks(&[10 * MIB, 10 * MIB, 10 * MIB, 10 * MIB], 16, 25 * MIB),
+            vec![vec![0, 1], vec![2, 3]]
+        );
+    }
+
+    #[test]
+    fn one_segment_is_nothing_to_do() {
+        assert!(forcemerge_chunks(&[MIB], 16, 32 * MIB).is_empty());
+        assert!(forcemerge_chunks(&[], 16, 32 * MIB).is_empty());
+    }
+}
+
+/// Whether a merge runs the level-19 long-effort stored encode
+/// (`encode_stored_v2_forcemerge_at_level`).
+///
+/// An explicit `_forcemerge` always does: the operator asked for the
+/// smallest index. A background (tiered) merge does only when the
+/// operator opts in with `XERJ_MERGE_MAX_EFFORT=true|1|yes|on`. Since
+/// rc.78 every background merge ran it, which made the stored encode ~35x
+/// slower and held the breaker latched (429 to ingest) for the whole merge.
+pub(crate) fn merge_uses_long_effort_stored_encode(
+    explicit_forcemerge: bool,
+    opt_in: Option<&str>,
+) -> bool {
+    if explicit_forcemerge {
+        return true;
+    }
+    matches!(
+        opt_in.map(|v| v.trim().to_ascii_lowercase()).as_deref(),
+        Some("1" | "true" | "yes" | "on")
+    )
+}
+
+#[cfg(test)]
+mod merge_long_effort_tests {
+    use super::merge_uses_long_effort_stored_encode as uses;
+
+    #[test]
+    fn background_merge_uses_fast_encode_by_default() {
+        assert!(!uses(false, None));
+        assert!(!uses(false, Some("")));
+        assert!(!uses(false, Some("false")));
+        assert!(!uses(false, Some("0")));
+    }
+
+    #[test]
+    fn forcemerge_always_uses_long_effort_encode() {
+        assert!(uses(true, None));
+        assert!(uses(true, Some("false")));
+    }
+
+    #[test]
+    fn background_long_effort_is_opt_in() {
+        for v in ["1", "true", "TRUE", " yes ", "on"] {
+            assert!(uses(false, Some(v)), "{v}");
+        }
+    }
+}
+
 #[cfg(test)]
 mod collection_publication_fail_closed_tests {
     use super::*;
@@ -13620,24 +13742,10 @@ impl Index {
                 let sizes: Vec<u64> = segs.iter().map(|s| s.size_bytes).collect();
                 let ids: Vec<SegmentId> = segs.into_iter().map(|s| s.id.clone()).collect();
                 let chunk_len = (mc.max_merge_count as usize).max(2);
-                let mut chunks: Vec<Vec<SegmentId>> = Vec::new();
-                let mut batch: Vec<SegmentId> = Vec::new();
-                let mut batch_bytes = 0u64;
-                for (id, size) in ids.into_iter().zip(sizes) {
-                    i
```

**File**: `engine/crates/xerj-engine/src/memtable.rs` (modified, +7/-4)
```diff
@@ -2825,9 +2825,10 @@ impl FrozenClaim {
                 removed_bytes,
             )
         });
-        // Free the dead generations off the publish critical path.  If
-        // the thread cannot be created — the governor watermark is already
-        // engaged, `pthread_create` fails, or (the #1122 failure) the new
+        // Free the dead generations off the publish critical path. The
+        // spawn ignores the watermark gate: at the watermark is exactly when
+        // this memory-relief helper must run. If the thread cannot be
+        // created — `pthread_create` fails, or (the #1122 failure) the new
         // thread's stack cannot be reserved — the Arcs drop inline: same
         // correctness, we only lose the async-free optimisation. The spawn
         // itself must not panic: std panics *inside* the child when its
@@ -2838,7 +2839,9 @@ impl FrozenClaim {
         // flush storm under pressure does not emit a line per generation.
         static DRAIN_FREE_DEGRADED: AtomicBool = AtomicBool::new(false);
         if let Err(failure) =
-            xerj_common::thread_spawn::try_spawn("xerj-drain-free", move || drop(dead))
+            xerj_common::thread_spawn::try_spawn_memory_relief("xerj-drain-free", move || {
+                drop(dead)
+            })
         {
             xerj_common::thread_spawn::warn_best_effort_degraded(
                 &DRAIN_FREE_DEGRADED,
```

**File**: `engine/crates/xerj-storage/src/stored_codec.rs` (modified, +121/-20)
```diff
@@ -70,7 +70,8 @@
 //! * form `0` — the payload is a zstd frame written at the encode-time level
 //!   (the only form ZBS2 segments can carry);
 //! * form `1` — `[0x01][level: u8][window_log: u8][zstd frame]`, written by
-//!   the merge-path effort chooser (see [`RAW_LONG_LEVEL`]): level 19 +
+//!   the merge-path effort chooser (see [`RAW_LONG_LEVEL`]): level 19 on an
+//!   explicit `_forcemerge` (background merges do not run it), plus
 //!   long-distance matching + an explicit window, which finds repeats tens
 //!   of MB apart that a default window cannot.  `level`/`window_log` are
 //!   informational — the zstd frame is self-describing.
@@ -269,6 +270,17 @@ impl ColCodec {
 /// column; the chooser keeps whichever candidate is smaller, so a column
 /// that level 3 already answers (e.g. short ids) is stored exactly as
 /// before.
+///
+/// Level 19 is reserved for an explicit `_forcemerge`
+/// ([`encode_stored_v2_forcemerge_at_level`]) or an operator opt-in.
+/// Background merges skip this candidate: zstd 19 encodes at ~2 MB/s per
+/// thread, and on a 1M-doc / 200 MB corpus at a 2 GiB cap the stored
+/// encode was 98% of every background merge (`XERJ_PROF merge-batch`:
+/// stored_us 94-107 s vs 2.4-3.3 s before this chooser existed, rc.77).
+/// While a merge runs its working set keeps RSS above the governor
+/// watermark, so the parent breaker answered 429 to ingest for the whole
+/// merge: bulk throughput fell from ~41k docs/s (rc.77) to ~5-14k docs/s
+/// (rc.78-rc.99).
 const RAW_LONG_LEVEL: i32 = 19;
 const RAW_LONG_WINDOW_LOG_MAX: u32 = 24;
 
@@ -294,23 +306,32 @@ pub fn encode_stored_v2(stored_docs_json: &[u8]) -> Vec<u8> {
 /// operator changes `compression.level` interleave with no migration and no
 /// format flag.
 pub fn encode_stored_v2_at_level(stored_docs_json: &[u8], level: i32) -> Vec<u8> {
-    encode_stored_v2_at_level_inner(stored_docs_json, level, false)
+    encode_stored_v2_at_level_inner(stored_docs_json, level, None)
 }
 
-/// Merge-path variant of [`encode_stored_v2_at_level`]: in addition to the
-/// operator's level, each JSON fallback column is also compressed at
-/// [`RAW_LONG_LEVEL`] with long-distance matching, and the smaller payload is
-/// kept (the same measured-chooser rule the `.dv` ZNV2 codec uses).  Merges
-/// are background work, so the extra encode pass is not on any
-/// back-pressure-critical path; flush never calls this.
+/// Background-merge entry. Encodes exactly like [`encode_stored_v2_at_level`]
+/// at the operator's level: **no** long-effort candidate. Background merges
+/// are on the back-pressure path — their working set holds RSS at the
+/// breaker watermark while they run, so their encode speed is ingest
+/// throughput (see [`RAW_LONG_LEVEL`]). Use
+/// [`encode_stored_v2_forcemerge_at_level`] for the max-effort encode.
 pub fn encode_stored_v2_merge_at_level(stored_docs_json: &[u8], level: i32) -> Vec<u8> {
-    encode_stored_v2_at_level_inner(stored_docs_json, level, true)
+    encode_stored_v2_at_level_inner(stored_docs_json, level, None)
+}
+
+/// Explicit-`_forcemerge` (or operator opt-in) variant: in addition to the
+/// operator's level, each JSON fallback column is also compressed at
+/// [`RAW_LONG_LEVEL`] (19) with long-distance matching, and the smaller
+/// payload is kept (the same measured-chooser rule the `.dv` ZNV2 codec
+/// uses). A force-merge is an operator request for the smallest index.
+pub fn encode_stored_v2_forcemerge_at_level(stored_docs_json: &[u8], level: i32) -> Vec<u8> {
+    encode_stored_v2_at_level_inner(stored_docs_json, level, Some(RAW_LONG_LEVEL))
 }
 
 fn encode_stored_v2_at_level_inner(
     stored_docs_json: &[u8],
     level: i32,
-    long_effort_chooser: bool,
+    long_effort_level: Option<i32>,
 ) -> Vec<u8> {
     // Parse the JSON array of documents.  Failure → v1 fallback.
     let docs: Vec<serde_json::Value> = match serde_json::from_slice(stored_docs_json) {
@@ -381,7 +402,7 @@ fn encode_stored_v2_at_level_inner(
             &columns,
             Some(stored_docs_json),
             level,
-            long_effort_chooser,
+            long_effort_level,
         ),
         present_nulls,
     )
@@ -545,7 +566,7 @@ fn encode_stored_v2_from_values_inner(
             &columns,
             stored_docs_json,
             STORED_ZSTD_LEVEL,
-            false,
+            None,
         ),
         present_nulls,
     )
@@ -559,15 +580,16 @@ fn encode_stored_v2_from_values_inner(
 /// fast path on large segments where the columnar form always wins and
 /// serialising a multi-MB JSON array per flush is measurable CPU).
 ///
-/// `long_effort_chooser` adds a second, higher-effort zstd candidate for
-/// each JSON fallback column (see [`RAW_LONG_LEVEL`]) — merge only.
+/// `long_effort_level` adds a second, higher-effort zstd candidate (LDM +
+/// explicit window) at that level for each JSON fallback column (see
+/// [`RAW_LONG_LEVEL`]) — force-merge only.
 fn encode_v2_columns(
    
```

---

### Incident Patch 2: `6cdb32e2` (2026-10-26)
**Commit Message**: autoindex: bound phase-A memory and cap long dataset names (part of #1122) (#2417)

* autoindex: bound phase-A memory and cap long dataset names (part of #1122)

- Phase A scanned every file and collected all FileScans/sketches (one set of
  FieldAccs per file) before clustering; on a 146k-file tree that is GBs of
  client RSS. Scan in file-ordered chunks and fold sketches into a new
  incremental dataset::Clusterer; clustering is order-dependent, so feeding in
  file order keeps the plan identical. Tests use a 3-file chunk so every
  multi-file phase-A test crosses chunk boundaries.
- The run kept every cluster (all FieldAccs) alive until end-of-run key
  correlation. Keep only correlate::KeyStats (n, distinct, overflow, int range,
  raw values for fields with >=10 distinct) and look datasets up by slug, which
  also fixes the clusters/datasets zip misaligning after a refused dataset.
- Slugs longer than 128 chars are truncated with a stable 8-hex hash suffix so
  index names never exceed the server's 255-byte limit.

* autoindex: keep is_candidate's doc comment on is_candidate (clippy doc_lazy_continuation)

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -79,6 +79,18 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- `xerj autoindex` no longer runs out of memory while planning a large folder.
+  It used to keep the sampled values of every file in memory at once before
+  grouping them into datasets, and kept them all until the end of the run;
+  on a 5 GB folder of about 146,000 files that was several GB on the client
+  before anything was indexed. Files are now grouped as they are read, and only
+  what the end-of-run key correlation needs is kept. The datasets and index
+  names it plans are unchanged (part of #1122).
+- `xerj autoindex` no longer fails a run because a dataset name built from a
+  long path (for example a Go module path) is over the 255-character index name
+  limit. Names longer than 128 characters are shortened and end in a short
+  hash, so they stay the same on every run and never clash (part of #1122).
+
 - Server startup now reports the resolved data directory, its configuration
   source and whether this launch created it. New-directory guidance points
   operators back to their previous `--data-dir` or `--config` when they expected
```

**File**: `engine/crates/xerj-autoindex/src/correlate.rs` (modified, +189/-1)
```diff
@@ -7,7 +7,7 @@
 use crate::esclient::Es;
 use anyhow::Result;
 use serde_json::{json, Value};
-use std::collections::HashSet;
+use std::collections::{HashMap, HashSet};
 
 pub struct Candidate {
     pub slug: String,
@@ -70,6 +70,90 @@ impl KeyCorr {
     }
 }
 
+/// What end-of-run key correlation needs from one sampled field, kept in
+/// place of the field's full phase-A accumulator.
+#[derive(Debug, Clone, PartialEq)]
+pub struct KeyFieldStats {
+    pub n: u64,
+    pub distinct: usize,
+    pub overflow: bool,
+    pub int_range: Option<(i64, i64)>,
+    pub values: HashSet<String>,
+}
+
+/// dataset slug → field name → stats.
+pub type KeyStats = HashMap<String, HashMap<String, KeyFieldStats>>;
+
+/// Fewest distinct sampled values [`is_candidate`] accepts for any type.
+const MIN_CANDIDATE_DISTINCT: usize = 10;
+
+/// Keep only the correlation inputs of every cluster's fields, so the phase-A
+/// accumulators (byte histograms, length/token samples, hashed distinct sets)
+/// can be dropped once the plan is built instead of living to the end of the
+/// run. Fields with too few distinct values to ever be a candidate are left
+/// out; the type-dependent checks run at the end against the final specs.
+pub fn key_stats(clusters: &[crate::dataset::Cluster]) -> KeyStats {
+    let mut out = KeyStats::new();
+    for c in clusters {
+        let fields: HashMap<String, KeyFieldStats> = c
+            .fields
+            .iter()
+            .filter(|(_, acc)| acc.distinct.len() >= MIN_CANDIDATE_DISTINCT)
+            .map(|(name, acc)| {
+                (
+                    name.clone(),
+                    KeyFieldStats {
+                        n: acc.n,
+                        distinct: acc.distinct.len(),
+                        overflow: acc.distinct_overflow,
+                        int_range: (acc.long_ok > 0).then_some((acc.int_min, acc.int_max)),
+                        values: acc.raw_values.clone(),
+                    },
+                )
+            })
+            .collect();
+        if !fields.is_empty() {
+            out.insert(c.slug.clone(), fields);
+        }
+    }
+    out
+}
+
+/// Key-overlap candidates among `datasets`' fields, from stats captured by
+/// [`key_stats`]. Looked up by slug, so datasets refused after planning
+/// simply drop out.
+pub fn candidates(stats: &KeyStats, datasets: &[crate::state::PlanDataset]) -> Vec<Candidate> {
+    let mut cands = Vec::new();
+    for d in datasets {
+        let Some(fields) = stats.get(&d.slug) else {
+            continue;
+        };
+        for spec in &d.specs {
+            let Some(st) = fields.get(&spec.name) else {
+                continue;
+            };
+            if is_candidate(
+                &spec.es_type,
+                spec.semantic.as_deref(),
+                st.distinct,
+                st.n,
+                st.overflow,
+                st.int_range,
+            ) {
+                cands.push(Candidate {
+                    slug: d.slug.clone(),
+                    index: d.index.clone(),
+                    field: spec.name.clone(),
+                    kind: spec.es_type.clone(),
+                    values: st.values.clone(),
+                    sampled_n: st.n,
+                });
+            }
+        }
+    }
+    cands
+}
+
 /// Key-like candidate filter. Deviations from the design draft (recorded):
 /// - keyword fields qualify at cardinality ≥ 20 regardless of distinct/n
 ///   ratio (join keys like user ids have LOW sample ratios in big datasets);
@@ -351,6 +435,110 @@ pub fn time_alignment(series: &[TimeSeries]) -> Vec<Value> {
 mod tests {
     use super::*;
 
+    fn spec(name: &str, es_type: &str) -> crate::infer::FieldSpec {
+        crate::infer::FieldSpec {
+            name: name.into(),
+            es_type: es_type.into(),
+            date_enc: None,
+            semantic: None,
+            cardinality_est: 0,
+            cardinality_overflow: false,
+            null_ratio: 0.0,
+            avg_len: 0.0,
+            coverage: 1.0,
+            examples: vec![],
+            notes: vec![],
+            date_min: None,
+            date_max: None,
+            date_evidence: vec![],
+            num_min: None,
+            num_max: None,
+        }
+    }
+
+    fn plan_dataset(slug: &str, specs: Vec<crate::infer::FieldSpec>) -> crate::state::PlanDataset {
+        crate::state::PlanDataset {
+            slug: slug.into(),
+            index: format!("ax-{slug}"),
+            family: "jsonl".into(),
+            group: None,
+            specs,
+            time_field: None,
+            semantic_field: None,
+            text_analyzer: None,
+            scope: None,
+            sampled_records: 1,
+            file_count: 1,
+        }
+    }
+
+    fn cluster(
+        slug: &str,
+        field: &str,
+        values: impl Iterator<Item = String>,
+    ) -> crate::dataset::Cluster {
+        let mut acc = crate::infer::FieldAcc::default();
+     
```

**File**: `engine/crates/xerj-autoindex/src/dataset.rs` (modified, +237/-99)
```diff
@@ -135,31 +135,61 @@ pub(crate) fn demotable_family(f: Family) -> bool {
 /// Cluster sketches into datasets. `rels` and `scopes` are indexed by
 /// `Sketch::file_idx`: `rels` are root-relative paths (slug naming), `scopes`
 /// the repository scope of each file ("" = root) — see `module` docs.
+///
+/// Equivalent to feeding every sketch, in order, to a [`Clusterer`] and
+/// calling [`Clusterer::finish`].
 pub fn cluster(sketches: Vec<Sketch>, rels: &[String], scopes: &[String]) -> Vec<Cluster> {
-    // scope → docs cluster (BTreeMap: deterministic scope order).
-    let mut docs: BTreeMap<String, Cluster> = BTreeMap::new();
-    let mut data: Vec<Cluster> = Vec::new();
-    fn docs_cluster<'a>(docs: &'a mut BTreeMap<String, Cluster>, scope: &str) -> &'a mut Cluster {
-        docs.entry(scope.to_string()).or_insert_with(|| Cluster {
-            family: Family::Code,
-            group: None,
-            members: Vec::new(),
-            fields: HashMap::new(),
-            key_fields: HashSet::new(),
-            records: 0,
-            population: 0,
-            slug: String::new(),
-            scope: scope.to_string(),
-            is_docs: true,
-            demoted: Vec::new(),
-        })
-    }
-
+    let mut clusterer = Clusterer::default();
     for sk in sketches {
         let scope = scopes[sk.file_idx].as_str();
+        clusterer.push(sk, scope);
+    }
+    clusterer.finish(rels)
+}
+
+fn docs_cluster<'a>(docs: &'a mut BTreeMap<String, Cluster>, scope: &str) -> &'a mut Cluster {
+    docs.entry(scope.to_string()).or_insert_with(|| Cluster {
+        family: Family::Code,
+        group: None,
+        members: Vec::new(),
+        fields: HashMap::new(),
+        key_fields: HashSet::new(),
+        records: 0,
+        population: 0,
+        slug: String::new(),
+        scope: scope.to_string(),
+        is_docs: true,
+        demoted: Vec::new(),
+    })
+}
+
+/// Incremental form of [`cluster`]: sketches are folded into their dataset as
+/// they arrive, so a caller never has to hold every file's sketch at once.
+///
+/// A sketch carries one [`FieldAcc`] per sampled field (a 1 KiB byte histogram,
+/// up to 512 length samples and up to [`crate::infer::RAW_CAP`] raw values
+/// each). Phase A used to collect every file's sketches before clustering:
+/// tens of KiB per file, and 4.4 GB of client RSS on a 146k-file folder before
+/// a single document was sent. Folding them as they are produced bounds that
+/// to the clusters themselves. Sketches must be pushed in file order for the
+/// result to match [`cluster`] exactly (clustering is greedy and
+/// order-dependent).
+#[derive(Default)]
+pub struct Clusterer {
+    // scope → docs cluster (BTreeMap: deterministic scope order).
+    docs: BTreeMap<String, Cluster>,
+    data: Vec<Cluster>,
+}
+
+impl Clusterer {
+    /// Fold one sketch into its dataset. `scope` is the repository scope of
+    /// `sk.file_idx`.
+    pub fn push(&mut self, sk: Sketch, scope: &str) {
+        let docs = &mut self.docs;
+        let data = &mut self.data;
         // Documents: no data-derived names, no sub-file group.
         if sk.key_fields.is_empty() && sk.group.is_none() {
-            let c = docs_cluster(&mut docs, scope);
+            let c = docs_cluster(docs, scope);
             c.members.push(sk.file_idx);
             c.records += sk.records;
             c.population += sk.population;
@@ -171,7 +201,7 @@ pub fn cluster(sketches: Vec<Sketch>, rels: &[String], scopes: &[String]) -> Vec
                     }
                 }
             }
-            continue;
+            return;
         }
         // Data: schema clustering within (scope, family, group).
         let names: HashSet<&str> = sk.key_fields.iter().map(|s| s.as_str()).collect();
@@ -219,92 +249,96 @@ pub fn cluster(sketches: Vec<Sketch>, rels: &[String], scopes: &[String]) -> Vec
         }
     }
 
-    // Demote small config clusters — one record each, or a short multi-doc
-    // YAML/JSON/XML file — to their scope's document dataset. Their sampled
-    // fields are dropped — the caller re-samples the demoted files through
-    // the document renderer, which is also what indexes them.
-    //
-    // A file that also produced a grouped dataset (a second top-level JSON
-    // array) must not be folded: folding marks the whole file `as_document`
-    // and phase B then drops the grouped rows.
-    let grouped_files: HashSet<usize> = data
-        .iter()
-        .filter(|c| c.group.is_some())
-        .flat_map(|c| c.members.iter().copied())
-        .collect();
-    let mut kept: Vec<Cluster> = Vec::with_capacity(data.len());
-    let mut capped: BTreeMap<String, Vec<Cluster>> = BTreeMap::new();
-    for c in data {
-        let shares_grouped_sibling = c.members.iter().any(|m| grouped_files.contains(m));
-        if small_structured_config(&c) && !shares_grouped_sibling {
-            let d = docs_cluster(&mut docs, &c.scope);
-            d.members.ext
```

**File**: `engine/crates/xerj-autoindex/src/lib.rs` (modified, +96/-93)
```diff
@@ -5247,18 +5247,17 @@ struct PhaseA {
 /// `--progress json` stays a single parseable stream (#241).
 fn report_pdf_spool_fallbacks(
     files: &[walk::FileEntry],
-    scans: &[FileScan],
+    fallbacks: &[(usize, Vec<extract::pdf::SpoolFallback>)],
     ctx: &PhaseAContext<'_>,
 ) {
     let pdf_spool_budget = ctx.budget;
     let pr = ctx.progress;
-    let reasons: Vec<(&str, &extract::pdf::SpoolFallback)> = scans
+    let reasons: Vec<(&str, &extract::pdf::SpoolFallback)> = fallbacks
         .iter()
-        .enumerate()
-        .flat_map(|(index, scan)| {
-            scan.pdf_spool_fallbacks
+        .flat_map(|(index, per_file)| {
+            per_file
                 .iter()
-                .map(move |fallback| (files[index].rel.as_str(), fallback))
+                .map(move |fallback| (files[*index].rel.as_str(), fallback))
         })
         .collect();
     for (path, fallback) in &reasons {
@@ -5296,6 +5295,13 @@ fn report_pdf_spool_fallbacks(
     }
 }
 
+/// Files phase A scans before folding their sketches into clusters. Large
+/// enough that the scan pool stays busy across a chunk, small enough that the
+/// sketches held at once stay bounded whatever the folder's file count.
+// Tests use a tiny chunk so every multi-file phase-A test crosses chunk
+// boundaries.
+const PHASE_A_CHUNK_FILES: usize = if cfg!(test) { 3 } else { 2048 };
+
 /// Sniff + sample every file, cluster into datasets, and assemble the plan.
 /// Pure planning: reads the tree, never the server — which is what makes the
 /// #173/#196 grouping behaviour testable end-to-end without a cluster.
@@ -5320,77 +5326,95 @@ fn build_phase_a(
     // Patterns were validated (loudly) at run start; a failure here would be
     // a programming error, not user input.
     let stub_matcher = StubMatcher::compile(&cfg.stub_globs).expect("validated at startup");
-    let scans: Vec<FileScan> = crate::pool::install(|| {
-        files
-            .par_iter()
-            .zip(digests.par_iter())
-            .map(|(f, digest)| {
-                let _in_flight = pr.file(&f.rel, f.size);
-                scan_file(
-                    &f.path,
-                    f.size,
-                    digest,
-                    ctx,
-                    cfg.sample,
-                    cfg.max_file_bytes,
-                    stub_matcher.matches(&f.rel),
-                )
-            })
-            .collect()
-    });
-
-    report_pdf_spool_fallbacks(files, &scans, ctx);
-    note_worker_address_space_cap(pr);
-
     let rels: Vec<String> = files.iter().map(|f| f.rel.clone()).collect();
     let scopes = compute_scopes(root, &rels);
     // (family, gzip) per file, from the scan's sniff — reused for assignments
     // and demoted-file re-sampling instead of re-sniffing every file.
-    let file_meta: Vec<Option<(Family, bool)>> = scans
-        .iter()
-        .map(|sc| sc.sniffed.as_ref().map(|s| (s.family, s.gzip)))
-        .collect();
-    let mut sketches = Vec::new();
+    let mut file_meta: Vec<Option<(Family, bool)>> = Vec::with_capacity(files.len());
     let mut junk_files = Vec::new();
     let mut pdf_spools: Vec<Option<extract::pdf::ExtractionSpool>> =
         (0..files.len()).map(|_| None).collect();
-    for (i, mut sc) in scans.into_iter().enumerate() {
-        let family = sc
-            .sniffed
-            .as_ref()
-            .map(|s| s.family)
-            .unwrap_or(Family::Binary);
-        // A file that phase A junks is never indexed, so its artifact is
-        // refunded here rather than held to the phase A→B boundary.
-        pdf_spools[i] =
-            take_pdf_spool_if_indexable(&mut sc.pdf_spool, sc.junk.is_some(), pdf_spool_budget);
-        if let Some((status, reason)) = sc.junk {
-            junk_files.push(JunkFile {
-                file_key: keys[i].clone(),
-                rel: files[i].rel.clone(),
-                format: format_str(sc.sniffed.as_ref()),
-                status,
-                reason,
-                bytes: files[i].size,
-            });
-            continue;
-        }
-        for gs in sc.sketches {
-            sketches.push(dataset::Sketch {
-                file_idx: i,
-                group: gs.group,
-                family,
-                fields: gs.fields,
-                key_fields: gs.key_fields,
-                records: gs.records,
-                population: gs.population,
-            });
+    let mut pdf_fallbacks: Vec<(usize, Vec<extract::pdf::SpoolFallback>)> = Vec::new();
+    // Scan in file-ordered chunks and fold each chunk's sketches into the
+    // clusters before the next chunk is scanned. Collecting every file's scan
+    // first held one set of field accumulators per file for the whole folder
+    // at once: 4.4 GB of client RSS on a 146k-file tree before anything was
+    // indexed (part of #1122). Folding in file order keeps the clustering
+    // identical to the collect-all version (see `dataset::Clusterer`).
+  
```

---

### Incident Patch 3: `b3d0865d` (2026-10-26)
**Commit Message**: fix(autoindex): bounded, reused replay workers and retryable thread spawn (#2428) (#2437)

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -79,6 +79,14 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- `xerj autoindex` no longer aborts a long run with `Resource temporarily
+  unavailable (os error 11)` when the machine refuses to start a thread. The
+  sync replay used to start a new thread for every operation (hundreds of
+  thousands on a large folder); it now starts at most the window width of
+  workers once per replay and reuses them. Starting a replay worker or an
+  indexing worker now retries with a short backoff when thread creation is
+  refused, and the replay finishes on the calling thread if no worker can be
+  started, so a refusal is no longer fatal (#2428).
 - `xerj autoindex` no longer runs out of memory while planning a large folder.
   It used to keep the sampled values of every file in memory at once before
   grouping them into datasets, and kept them all until the end of the run;
```

**File**: `engine/crates/xerj-autoindex/src/lib.rs` (modified, +11/-1)
```diff
@@ -11368,10 +11368,20 @@ fn run_index_report_inner(
     // an error: workers that did start share the queue, the pipe stops
     // counting the ones that never did, and if none started this thread
     // works the queue itself. The failed closure is dropped unrun.
+    // #2428: a refused spawn is retried with backoff first; a transient
+    // `EAGAIN` must not cost the run a worker, let alone the run.
     xerj_common::thread_spawn::scope(|scope| {
         let mut started = 0usize;
         for _ in 0..worker_count {
-            match scope.spawn("autoindex-worker", worker) {
+            match crate::sync_executor::spawn_scoped_with_backoff(
+                scope,
+                &xerj_common::thread_spawn::StdSpawn,
+                xerj_common::thread_spawn::spawn_allowed,
+                "autoindex-worker",
+                crate::sync_executor::WORKER_SPAWN_ATTEMPTS,
+                crate::sync_executor::WORKER_SPAWN_BACKOFF,
+                worker,
+            ) {
                 Ok(_) => started += 1,
                 Err(error) => {
                     pr.note(&format!(
```

**File**: `engine/crates/xerj-autoindex/src/sync_executor.rs` (modified, +315/-17)
```diff
@@ -344,6 +344,83 @@ pub(crate) fn replay_windowed<T: Sync>(
     hooks: &mut dyn ReplayHooks<T>,
     apply: &(dyn Fn(&T) -> Result<()> + Sync),
 ) -> Result<()> {
+    replay_windowed_with(
+        &xerj_common::thread_spawn::StdSpawn,
+        xerj_common::thread_spawn::spawn_allowed,
+        items,
+        width,
+        hooks,
+        apply,
+    )
+}
+
+/// How many times a refused worker spawn is retried before the run
+/// continues with the workers it already has (#2428).
+pub(crate) const WORKER_SPAWN_ATTEMPTS: u32 = 3;
+/// First pause after a refused worker spawn; doubled on each retry.
+pub(crate) const WORKER_SPAWN_BACKOFF: std::time::Duration = std::time::Duration::from_millis(50);
+
+/// Start `f` on a scoped helper thread, retrying a refused spawn (`EAGAIN`
+/// from `pthread_create`, or the spawn gate saying no) up to `attempts`
+/// times with a doubling `backoff` (#2428). A refused spawn is a transient
+/// thread or memory limit, not a reason to lose the run: `Err` after the
+/// last attempt means `f` never ran and the caller carries on with the
+/// threads it has, or does the work itself.
+pub(crate) fn spawn_scoped_with_backoff<'scope, 'env, S, G, F>(
+    scope: &xerj_common::thread_spawn::Scope<'scope, 'env>,
+    spawner: &S,
+    gate: G,
+    name: &str,
+    attempts: u32,
+    backoff: std::time::Duration,
+    f: F,
+) -> std::io::Result<()>
+where
+    S: xerj_common::thread_spawn::Spawn + ?Sized,
+    G: Fn() -> bool,
+    F: FnOnce() + Send + Copy + 'scope,
+{
+    let attempts = attempts.max(1);
+    let mut delay = backoff;
+    let mut attempt = 1;
+    loop {
+        match scope.spawn_with(spawner, gate(), name, f) {
+            Ok(()) => return Ok(()),
+            Err(error) if attempt >= attempts => return Err(error),
+            Err(_) => {
+                std::thread::sleep(delay);
+                delay = delay.saturating_mul(2);
+                attempt += 1;
+            }
+        }
+    }
+}
+
+/// [`replay_windowed`] with an explicit spawner and spawn gate, so the
+/// spawn-failure paths are testable without exhausting a real machine.
+///
+/// #2428: the window used to start one thread per *operation*. A corpus
+/// replay is hundreds of thousands of operations, so a long run made
+/// hundreds of thousands of `pthread_create` calls, and under memory or
+/// thread pressure one of them eventually got `EAGAIN`. Now at most
+/// `width` workers are started once per replay and reused for every item.
+/// A refused worker spawn is retried with backoff; if it is still refused
+/// the replay continues on the workers that did start, and if none did,
+/// every item is applied on the calling thread. Ordering and failure
+/// semantics are unchanged.
+pub(crate) fn replay_windowed_with<T, S, G>(
+    spawner: &S,
+    gate: G,
+    items: &[T],
+    width: usize,
+    hooks: &mut dyn ReplayHooks<T>,
+    apply: &(dyn Fn(&T) -> Result<()> + Sync),
+) -> Result<()>
+where
+    T: Sync,
+    S: xerj_common::thread_spawn::Spawn + ?Sized,
+    G: Fn() -> bool,
+{
     if items.is_empty() {
         return Ok(());
     }
@@ -355,19 +432,68 @@ pub(crate) fn replay_windowed<T: Sync>(
         }
         return Ok(());
     }
-    /// One dispatched operation: on its own thread, or — when that thread
-    /// could not be started (#1122) — already applied inline.
-    enum Dispatched<'scope> {
-        Thread(xerj_common::thread_spawn::ScopedJoinHandle<'scope, Result<()>>),
+    /// One dispatched operation: queued to a worker, or — when no worker
+    /// could be started (#1122, #2428) — already applied inline.
+    enum Dispatched {
+        Worker(std::sync::mpsc::Receiver<Result<()>>),
         Inline(Result<()>),
     }
+    type Job<'a, T> = (&'a T, std::sync::mpsc::Sender<Result<()>>);
+    let (job_tx, job_rx) = std::sync::mpsc::channel::<Job<'_, T>>();
+    let job_rx = std::sync::Mutex::new(job_rx);
+    let job_rx = &job_rx;
+    // A worker takes queued items until the sender is dropped. A panic in
+    // `apply` (unwind builds) becomes that item's error and the worker
+    // keeps serving the queue.
+    let worker = move || loop {
+        let job = {
+            let rx = job_rx
+                .lock()
+                .unwrap_or_else(|poisoned| poisoned.into_inner());
+            rx.recv()
+        };
+        let Ok((item, reply)) = job else { break };
+        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| apply(item)))
+            .unwrap_or_else(|panic| {
+                Err(anyhow::anyhow!(
+                    "replay apply panicked: {}",
+                    panic_message(panic)
+                ))
+            });
+        // The scheduler may have stopped listening after a `begin` error.
+        let _ = reply.send(outcome);
+    };
     // #1122: `Builder::spawn_scoped` can abort the process after returning
     // `Ok`, when the child cannot map its alternate signal stack. This
-    // scope uses `pthread_
```

#### Recent Merged Pull Requests:
- **PR #2454** (2026-10-26): Cold FTS top-k: walk on identities, hydrate only the page's winners (@xerj-org)
- **PR #2452** (2026-10-26): fix(memory): bound merge/FST buffers under the governor and add breaker release hysteresis (#2427) (@xerj-org)
- **PR #2445** (2026-10-26): chore: sign CLA for PensiveFei (@PensiveFei)
- **PR #2444** (2026-10-26): docs: add an agent field report for the DeepSeek Harness MCP registration (@PensiveFei)
- **PR #2443** (2026-10-26): Cut cold first-query search latency (#2422) (@xerj-org)
- **PR #2441** (2026-10-26): fix(engine): background merges skip the zstd-19 stored encode (ingest ~5x regression since rc.78) (@xerj-org)

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

## X. engine): background merges skip the zstd-19 stored encode (ingest ~5x regression

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `12e36e31`: engine): background merges skip the zstd-19 stored encode (ingest ~5x regression since rc.78) (#2441). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Indexing is fast again under a memory cap** (issue
  [#2438](https://github.com/xerj-org/xerj/issues/2438), part of
  [#2423](https://github.com/xerj-org/xerj/issues/2423)). Since rc.78 every
  background merge also tried a very slow, very small compression (zstd level
  19) on the stored documents. That made each merge ~35x slower in that step,
  kept memory at the limit for the whole merge, and made `_bulk` answer 429
  until it ended, so indexing was about 5x slower and a loader could give up
  and drop documents. Background merges now use the normal compression level.
  An explicit `_forcemerge` still uses the slow, small one, so the force-merged
  size is unchanged; set `XERJ_MERGE_MAX_EFFORT=true` to use it for every
  merge. No data format change.
- **The helper thread that frees memory now starts when memory is high.**
  `xerj-drain-free` was refused with "memory is at the governor watermark",
  which is exactly when it is needed.
- **`_forcemerge?max_num_segments=1` now reaches one segment** when every
  segment is larger than half the per-merge size cap (it used to stop at two).

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `12e36e31` are properly handled with clean fallback behavior.
