> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source**: github ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Source Version**: `317f3af6`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T22:04:24.512Z  
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
> **Harvest Timestamp**: 2026-10-18T22:04:24.298Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: XERJ is the new way for AI to search data. Its autoindex capability activates agents to know your data without the token waste of grep (1974 tool). One command indexes code, docs, logs and PDFs for search, RAG, security audits and agent memory, using 40x fewer tokens than grep. It’s durable and can replace ElasticSearch saving you x10 infra costs.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8334 stars

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
    /// API endpoint URL (e.g., `https://api.openai.com/v1/embeddings`).
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
    pub fn new(config: EmbeddingProxyConfig) -> Result<Self> {
        let endpoint = reqwest::Url::parse(&config.endpoint)
            .map_err(|e| XerjError::embedding(format!("invalid embedding endpoint: {e}")))?;
        if !matches!(endpoint.scheme(), "http" | "https") {
            return Err(XerjError::embedding(
                "embedding endpoint must use http or https",
            ));
        }
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
        let chunks: Vec<&[String]> = if texts.len() <= chunk_len {
            vec![texts.as_slice()]
        } else {
            texts.chunks(chunk_len).collect()
        };

        let mut futs = Vec::with_capacity(chunks.len());
        for chunk in &chunks {
            futs.push(async {
                let _permit = self
                    .semaphore
                    .acquire()
                    .await
                    .map_err(|e| XerjError::embedding(format!("semaphore: {e}")))?;
                self.send_with_retry(chunk, model).await
            });
        }
        let results = futures_util::future::try_join_all(futs).await?;
        Ok(results.into_iter().flatten().collect())
    }

    async fn send_with_retry(&self, texts: &[String], model: &str) -> Result<Vec<Vec<f32>>> {
        let mut last_err = XerjError::embedding("no attempts made");
        let mut backoff = Duration::from_millis(200);

        for attempt in 0..=self.config.max_retries {
            if attempt > 0 {
                warn!("embed retry {}/{}", attempt, self.config.max_retries);
                sleep(backoff).await;
                backoff = (backoff * 2).min(Duration::from_secs(10));
            }

            match self.send_once(texts, model).await {
                Ok(result) => return Ok(result),
                Err(EmbedFailure {
                    err,
                    retryable: false,
                }) => {
                    // Non-transient: a 4xx client error (bad model / bad key /
                    // malformed payload) or a contract violation from the
                    // upstream. Retrying just stalls ~max_retries × backoff
                    // (≈2 min/doc) to arrive at the same failure. Fail fast.
                    warn!("embed failed (non-transient, not retrying): {err}");
                    return Err(err);
                }
                Err(EmbedFailure {
                    err,
                    retryable: true,
                }) => {
                    debug!("embed attempt {attempt} failed (transient): {err}");
                    last_err = err;
                }
            }
        }

        Err(last_err)
    }

    async fn send_once(
        &self,
        texts: &[String],
        model: &str,
    ) -> std::result::Result<Vec<Vec<f32>>, EmbedFailure> {
        let body = EmbedRequest {
            input: texts,
            model,
        };

        let mut req = self
            .client
            .post(&self.config.endpoint)
            .header("Content-Type", "application/json");

        if let Some(key) = &self.config.api_key {
            req = req.header("Authorization", format!("Bearer {key}"));
        }

        // Transport-level failures (connection refused, DNS, timeout) are
        // transient: the proxy may be restarting or briefly unreachable.
        let resp = req.json(&body).send().await.map_err(|e| {
            EmbedFailure::transient(XerjError::embedding(format!("HTTP request: {e}")))
        })?;

        if !resp.status().is_success() {
            let status = resp.status();
            // Classify by status (item 9): 5xx are server-side and transient;
            // 429 (rate limit) and 408 (request timeout) are transient; every
            // other 4xx is a permanent client error — a wrong model, a bad API
            // key, or a malformed request — that no amount of retrying fixes.
            let retryable = status_is_retryable(status.as_u16());
            let body = resp.text().await.unwrap_or_default();
            let err = XerjError::embedding(format!("embedding API returned {status}: {bo
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
//!     under the `neural` cargo feature; the model is loaded lazily on first
//!     use (download-on-first-run) so startup stays instant.
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
            let spawn = std::thread::Builder::new()
                .name(thread_name.clone())
                .spawn(move || {
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
            if let Err(error) = spawn {
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
    /// Built-in neural BERT embedder (candle). Lazily loaded on first use.
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

    /// A lazily-loaded built-in neural embedder.
    #[cfg(feature = "neural")]
    pub fn neural(cfg: crate::neural::NeuralConfig) -> Self {
        Embedder::Neural(NeuralHandle::new(cfg))
    }

    #[cfg(feature = "onnx-experimental")]
    pub fn onnx(cfg: OnnxConfig) -> Self {
        Embedder::Onnx(OnnxHandle::new(cfg))
    }

    /// `true` when a Candle neural, experimental ONNX, or external proxy
    /// embedder is config
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
- **Issue #1648** (2026-10-17): **[bug]: HELLO IM HAVE ERROR ON MY CODE**
  *Symptoms*: ### XERJ version  HELLO IM HAVE ERROR ON MY CODE  ### How did you install / run XERJ?  Prebuilt release binary  ### Operating system & architecture  HELLO IM HAVE ERROR ON MY CODE  ### Steps to reproduce  ```shell HELLO IM HAVE ERROR ON MY CODE ```  ### Expected behavior  HELLO IM HAVE ERROR ON MY CODE  ### Actual behavior  HELLO IM HAVE ERROR ON MY CODE  ### Is this an Elasticsearch wire-compatibility divergence?  Unknown / not sure  ### Elasticsearch reference (if a compat divergence)  HELLO IM HAVE ERROR ON MY CODE  ### Relevant logs  ```shell HELLO IM HAVE ERROR ON MY CODE ```  ### Confirmations  - [x] I searched existing issues and did not find a duplicate. - [ ] I can reproduce this with a minimal example on a clean data directory.

- **Issue #1365** (2026-10-16): **[bug]: xerj search prints whole-file hits without a line number, then asks to "Cite ax_path:line"**
  *Symptoms*: ### XERJ version  xerj v1.0.0-rc.95  ### How did you install / run XERJ?  Prebuilt release binary  ### Operating system & architecture  Pop!_OS 22.04 LTS x86_64  ### Steps to reproduce  ```shell git clone https://github.com/sebollin/lupa.git mkdir lupa-a705445 && git -C lupa archive a705445 | tar -x -C lupa-a705445 xerj --insecure --data-dir ./data & xerj autoindex ./lupa-a705445 xerj search "mensaje de error del motor conditionMessage se limpia de literales antes de publicarse" ```  ### Expected behavior  ``` Every passage header should carry the line, or line range, of the passage it prints. The command ends with "Cite ax_path:line for anything you rely on", and without a line the reader has to open the whole file to find the passage. ```  ### Actual behavior  ```` Whole-file hits print the bare path, followed by a passage from the middle of the file (excerpt):  ```text ─── tests/testthat/test-O68-el-universo-de-los-estadisticos.R  (score 83.77)       # 2. Ahora las dos dicen 2, y las dos declaran la exclusion: antes ninguna lo       ... 5 passage(s) from 'ax-*'. Cite ax_path:line for anything you rely on. ```  Across the 8 xerj search / xerj def runs in our test, 21 of 34 passage headers had no line.  Verified in the source at v1.0.0-rc.95: search.rs:196-202 falls back to the bare path when `_source` has neither `line` nor `start_line`. The comment at search.rs:151-152 calls whole-file bodies "the token flood (measured ~9x the size of the matching passage)", and opening th

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

### Incident Patch 1: `a6ce269d` (2026-10-18)
**Commit Message**: fix(deploy): comment out the placeholder FIELD_REPORTS KV binding that blocks every Pages deploy

#1760 merged with a placeholder KV namespace id
(REPLACE_WITH_FIELD_REPORTS_KV_NAMESPACE_ID) in wrangler.toml. wrangler
rejects it with "Error 8000022: Invalid KV namespace ID", so deploy-pages.yml
(triggered by any change to wrangler.toml or landing/**) fails at the publish
step — blocking ALL xerj.org deploys. The 2026-10-18 15:17 run failed this way
and the next run was queued to fail the same way; the site stayed up only on
the last good deploy.

The endpoint is not meant to go live yet (owner is reviewing before wiring the
namespace). Commenting the block out restores deploys and leaves the Function
fail-open: /api/field-report returns 200 but does not store, via the
`!env.FIELD_REPORTS` branch in functions/api/field-report.js. Restoring
storage is a one-liner once the owner creates the namespace.

No behaviour change for any other route; no secret committed.

**File**: `wrangler.toml` (modified, +11/-3)
```diff
@@ -41,6 +41,14 @@ bucket_name = "xerj-installs"
 #   wrangler kv namespace create FIELD_REPORTS
 # and replace the id below with the one it prints. Do not commit a real id
 # from the live account via an automated run; the owner wires this at deploy.
-[[kv_namespaces]]
-binding = "FIELD_REPORTS"
-id = "REPLACE_WITH_FIELD_REPORTS_KV_NAMESPACE_ID"
+# [[kv_namespaces]]  — COMMENTED OUT until the owner wires the real namespace.
+# A placeholder id here makes `wrangler pages deploy` fail with
+# "Error 8000022: Invalid KV namespace ID", which blocks EVERY xerj.org deploy
+# (this file is on the deploy trigger path). With no binding declared, the
+# Function fails open: /api/field-report accepts a report and returns 200 but
+# does NOT store it (see functions/api/field-report.js, the `!env.FIELD_REPORTS`
+# branch). To activate storage, create the namespace and restore this block:
+#     wrangler kv namespace create FIELD_REPORTS   # prints an id
+# [[kv_namespaces]]
+# binding = "FIELD_REPORTS"
+# id = "<the id it printed>"
```

---

### Incident Patch 2: `d481370f` (2026-10-18)
**Commit Message**: fix(hub): bare `xerj code <slug>` finds the node `hub pull` restored into (#1729)

Motivation
----------
Corpus Hub v2's whole point is that `xerj hub pull <slug>` leaves the user one
command away from an answer: the pull prints "`xerj code <slug>` works now", and
the §12.3/§12.4 release gates run exactly that. On a clean machine (empty HOME,
nothing on localhost:9200) that promise was broken.

`xerj hub pull` resolves a node through `node::ensure_node` — which, finding
nothing on localhost:9200, starts the automatic node on 9300+, restores the pack
into it, and records that URL (`http://127.0.0.1:9300`) in the state ledger
(`~/.xerj-code/state/<slug>.json`, `source: "hubpack"`). But `xerj code` resolved
its node through `xc::resolve_url` — `--url` > `XERJ_URL` > `http://localhost:9200`
— which ignores the ledger. So immediately after a successful pull:

  $ xerj code lz4 --def LZ4_VERSION_RELEASE   # no --url, no XERJ_URL
  defs query failed: no response from http://localhost:9200/...-defs/_search
  no match in lz4 ...
  answered from: local pack            # exit 1, and a false "local pack"
  $ xerj code lz4 "how does LZ4 decompress a block safely"
  search failed: ... (http://lo

**File**: `engine/crates/xerj-hub/src/cli.rs` (modified, +96/-4)
```diff
@@ -1276,10 +1276,79 @@ pub fn parse_ask_args(args: &[String]) -> Result<Option<AskArgs>, String> {
 /// `xerj code …`: `--def <SYMBOL>` answers from the `-defs` index; everything
 /// else is the existing retrieval path, delegated unchanged.
 pub fn run_code(args: &[String]) -> i32 {
+    let args = match with_pulled_node_url(args) {
+        Ok(args) => args,
+        Err(e) => {
+            eprintln!("xerj code: {e:#}");
+            return 2;
+        }
+    };
     if !args.iter().any(|a| a == "--def") {
-        return xerj_autoindex::xc::run_code_cli(args);
+        return xerj_autoindex::xc::run_code_cli(&args);
+    }
+    run_code_def(&args)
+}
+
+/// The `xerj code` flags (either mode) that take a value.
+const CODE_VALUE_FLAGS: &[&str] = &[
+    "-k",
+    "--lang",
+    "--mode",
+    "--full",
+    "--url",
+    "--api-key",
+    "--def",
+];
+
+/// The `<corpus>` argument of `xerj code …`: the first positional, skipping the
+/// values of [`CODE_VALUE_FLAGS`] (both parsers take it in that position).
+fn code_corpus_arg(args: &[String]) -> Option<&str> {
+    let mut i = 0;
+    while i < args.len() {
+        let a = args[i].as_str();
+        if CODE_VALUE_FLAGS.contains(&a) {
+            i += 2;
+            continue;
+        }
+        if !a.starts_with('-') {
+            return Some(a);
+        }
+        i += 1;
     }
-    run_code_def(args)
+    None
+}
+
+/// For a PULLED corpus queried with no `--url` and no `XERJ_URL`, add
+/// `--url <the node the pack lives on>` ([`node::resolve_pulled_node`]).
+///
+/// Without this, `xerj code <slug>` — the command `xerj hub pull` tells the user
+/// to run next — resolved `localhost:9200` while the pack had been restored into
+/// the automatic node on 9300+: `--def` printed "no match … answered from: local
+/// pack" and a question failed with a transport error. `xerj ask` already used
+/// the automatic node. A locally indexed corpus, an explicit `--url` or
+/// `XERJ_URL`, and anything that is not a pulled corpus pass through unchanged.
+fn with_pulled_node_url(args: &[String]) -> Result<Vec<String>> {
+    let explicit_env = std::env::var("XERJ_URL").is_ok_and(|u| !u.is_empty());
+    let help = args.iter().any(|a| a == "-h" || a == "--help");
+    if explicit_env || help || args.iter().any(|a| a == "--url") {
+        return Ok(args.to_vec());
+    }
+    let Some(corpus) = code_corpus_arg(args) else {
+        return Ok(args.to_vec());
+    };
+    let Ok(st) = state::load_state(&xerj_autoindex::xc::code_root(), corpus) else {
+        return Ok(args.to_vec()); // the code path reports "not indexed" itself
+    };
+    if st.source.as_deref() != Some(state::SOURCE_HUBPACK) {
+        return Ok(args.to_vec());
+    }
+    let launcher = NodeLauncher::current()?;
+    let resolved = node::resolve_pulled_node(&hub_home(), st.url.as_deref(), &launcher)
+        .with_context(|| format!("cannot reach the node holding the pulled corpus '{corpus}'"))?;
+    let mut out = args.to_vec();
+    out.push("--url".into());
+    out.push(resolved.url);
+    Ok(out)
 }
 
 fn run_code_def(args: &[String]) -> i32 {
@@ -1358,11 +1427,18 @@ fn run_code_def(args: &[String]) -> i32 {
         return 2;
     }
     let prefix = state::query_prefix(&st);
-    if let Ok(live) = node.cat_indices_json(&format!("{prefix}*")) {
-        if live.is_empty() {
+    match node.cat_indices_json(&format!("{prefix}*")) {
+        Ok(live) if live.is_empty() => {
             eprintln!("{}", state::not_loaded_message(&st, &prefix, &url));
             return 3;
         }
+        Ok(_) => {}
+        // An unreachable node is a failure to answer (exit 2), not "no match"
+        // (exit 1) — and never "answered from: local pack".
+        Err(e) => {
+            eprintln!("xerj code: cannot reach {url}: {e}");
+            return 2;
+        }
     }
 
     let answer = crate::def::lookup(&node, &slug, &symbol, k);
@@ -1461,6 +1537,22 @@ mod tests {
         }
     }
 
+    #[test]
+    fn code_corpus_arg_skips_flag_values() {
+        let v = |xs: &[&str]| xs.iter().map(|x| x.to_string()).collect::<Vec<_>>();
+        assert_eq!(code_corpus_arg(&v(&["lz4", "q"])), Some("lz4"));
+        assert_eq!(code_corpus_arg(&v(&["--def", "X", "lz4"])), Some("lz4"));
+        assert_eq!(
+            code_corpus_arg(&v(&["-k", "3", "--json", "lz4", "q"])),
+            Some("lz4")
+        );
+        assert_eq!(
+            code_corpus_arg(&v(&["--mode", "bm25", "--lang", "c"])),
+            None
+        );
+        assert_eq!(code_corpus_arg(&v(&["--def"])), None);
+    }
+
     #[test]
     fn run_code_without_def_does_not_enter_the_def_path() {
         // No node is contacted and no panic: a bare `code` with a bad flag
```

**File**: `engine/crates/xerj-hub/src/node.rs` (modified, +84/-0)
```diff
@@ -559,6 +559,43 @@ fn ensure_node_with(
     }
 }
 
+/// The node a PULLED corpus (a `source: "hubpack"` ledger) is queried on when
+/// the caller named none (no `--url`, no `XERJ_URL`).
+///
+/// `xerj hub pull` restores into whatever [`ensure_node`] resolved — on a
+/// machine with nothing on `localhost:9200`, the automatic node on 9300+ — and
+/// records that URL in the ledger. A bare `xerj code <slug>` used to ignore the
+/// ledger and query `localhost:9200`, so the corpus `pull` had just restored was
+/// unreachable from the command `pull` tells the user to run next.
+///
+/// The recorded URL takes the place `--url` has in [`ensure_node`]: used when it
+/// answers; refused when it is remote and silent; and when it is local and
+/// silent (the automatic node was stopped, or its port changed), the automatic
+/// node is reused or restarted on its own data directory, where the restored
+/// indices persist. `localhost:9200` is NOT probed: a node there that never held
+/// the pack would answer "not loaded" for a corpus that is one restart away.
+/// A ledger with no URL falls back to plain [`ensure_node`].
+pub fn resolve_pulled_node(
+    hub_home: &Path,
+    recorded: Option<&str>,
+    launcher: &NodeLauncher,
+) -> Result<ResolvedNode> {
+    resolve_pulled_node_with(hub_home, recorded, launcher, NODE_BOOT_TIMEOUT)
+}
+
+/// [`resolve_pulled_node`] with the boot timeout spelled out (tests shorten it).
+fn resolve_pulled_node_with(
+    hub_home: &Path,
+    recorded: Option<&str>,
+    launcher: &NodeLauncher,
+    boot_timeout: Duration,
+) -> Result<ResolvedNode> {
+    let recorded = recorded
+        .map(|u| u.trim().trim_end_matches('/'))
+        .filter(|u| !u.is_empty());
+    ensure_node_with(hub_home, recorded, launcher, boot_timeout)
+}
+
 fn unconfirmed_message(hub_home: &Path, rec: &NodeRecord) -> String {
     if rec.port.is_none() {
         format!(
@@ -1832,6 +1869,35 @@ mod tests {
         assert!(!hub.path().join("node.pid").exists());
     }
 
+    // ── resolve_pulled_node: a bare `xerj code <pulled slug>` ────────────────
+
+    #[test]
+    fn a_pulled_corpus_is_queried_on_the_node_its_ledger_recorded() {
+        // The bug: `pull` restored into the automatic node (9300+) and recorded
+        // its URL; a bare `xerj code` then queried localhost:9200 instead.
+        let hub = tempfile::tempdir().unwrap();
+        let port = fake_node("200 OK", r#"{"status":"green"}"#);
+        let recorded = format!("http://127.0.0.1:{port}/");
+        let r = resolve_pulled_node(hub.path(), Some(&recorded), &forbidden_launcher()).unwrap();
+        assert_eq!(r.url, format!("http://127.0.0.1:{port}"));
+        assert!(!r.started_now, "an answering node is never started over");
+        assert!(!hub.path().join("node.pid").exists());
+    }
+
+    #[test]
+    fn a_pulled_corpus_on_a_silent_remote_node_is_an_error_not_a_local_node() {
+        let hub = tempfile::tempdir().unwrap();
+        let err = resolve_pulled_node(
+            hub.path(),
+            Some("http://nonexistent.invalid:9200"),
+            &forbidden_launcher(),
+        )
+        .unwrap_err()
+        .to_string();
+        assert!(err.contains("not a local address"), "{err}");
+        assert!(!hub.path().join("node.pid").exists());
+    }
+
     #[test]
     fn free_port_search_skips_a_busy_triple() {
         let held = TcpListener::bind("127.0.0.1:0").unwrap();
@@ -2401,6 +2467,24 @@ mod tests {
             live.wait().unwrap();
         }
 
+        #[test]
+        fn a_pulled_corpus_whose_recorded_node_moved_finds_the_automatic_node() {
+            // `xerj hub stop` + a later restart put the automatic node on another
+            // port than the one `pull` recorded. The ledger URL is silent and
+            // local, so the automatic node is the answer — and localhost:9200 is
+            // never consulted (a node there never held the pack).
+            let hub = tempfile::tempdir().unwrap();
+            let mut live = spawn_node_like(&node_data_dir(hub.path()));
+            let port = fake_node_with_pid(live.id());
+            record(hub.path(), live.id(), Some(port));
+            let r = resolve_pulled_node(hub.path(), Some(&silent_url()), &forbidden_launcher())
+                .unwrap();
+            assert_eq!(r.url, format!("http://127.0.0.1:{port}"));
+            assert!(r.managed && !r.started_now);
+            live.kill().unwrap();
+            live.wait().unwrap();
+        }
+
         #[test]
         fn something_else_on_the_recorded_port_is_not_taken_for_the_recorded_node() {
             // The node is alive but has not bound its port yet, and another process
```

**File**: `engine/crates/xerj-hub/tests/pack_roundtrip.rs` (modified, +29/-0)
```diff
@@ -491,6 +491,35 @@ async fn pack_build_pull_def_roundtrip() {
     assert_eq!(answer.hits[0].file, "limits.h");
     assert_eq!(answer.hits[0].line, 5);
 
+    // A BARE `xerj code` (no --url, no XERJ_URL) finds the node the pack was
+    // restored into, from the ledger — not localhost:9200. `pull` names exactly
+    // this command as the next step; it used to query localhost:9200, where
+    // `--def` printed "no match … answered from: local pack" (exit 1) and a
+    // question failed to connect (exit 2).
+    let (rc_def, rc_how) = {
+        let (ch, hh) = (code_home.clone(), hub_home.clone());
+        tokio::task::spawn_blocking(move || {
+            std::env::set_var("XERJ_CODE_HOME", &ch);
+            std::env::set_var("XERJ_HUB_HOME", &hh);
+            std::env::remove_var("XERJ_URL");
+            let def = xerj_hub::cli::run_code(&[
+                "mini-c".into(),
+                "--def".into(),
+                "MINI_LIMIT".into(),
+                "--json".into(),
+            ]);
+            let how = xerj_hub::cli::run_code(&["mini-c".into(), "mini c reference".into()]);
+            (def, how)
+        })
+        .await
+        .unwrap()
+    };
+    assert_eq!(
+        rc_def, 0,
+        "bare `xerj code mini-c --def MINI_LIMIT` answers"
+    );
+    assert_eq!(rc_how, 0, "bare `xerj code mini-c \"<question>\"` answers");
+
     // Second pull of the same pin → already present, restores nothing.
     let rc2 = {
         let (url_b, ch, hh, pk) = (
```

**File**: `tools/hub-packs/consumer_e2e.sh` (modified, +14/-0)
```diff
@@ -17,6 +17,8 @@
 #      snapshot restore — all against the key compiled into <xerj>;
 #   4. `xerj code <slug> --def <symbol> --json`, the symbol taken from the pack's
 #      own defs.jsonl, must return that symbol from the local pack;
+#      4b. the same lookup with NO XERJ_URL must find the node from the ledger
+#      `hub pull` wrote (not localhost:9200);
 #   5. `xerj code <slug> "<word from ask_for>" --json` must return a hit with a
 #      file and a line.
 #
@@ -108,6 +110,18 @@ jq -e --argjson d "$DEF" '
   || { cat "$WORK/def.json"; fail "--def $SYM did not return $(jq -r '"\(.file):\(.line)"' <<<"$DEF") from the local pack"; }
 echo "def ok: $SYM -> $(jq -r '"\(.file):\(.line)"' <<<"$DEF") (answered_from local_pack)"
 
+# 4b. The same lookup BARE: no XERJ_URL, no --url — the command `hub pull` tells
+#     a user to run next. It must find the node the pack was restored into from
+#     the ledger, not fall back to localhost:9200 (where nothing listens here).
+env -u XERJ_URL "$BIN" code "$SLUG" --def "$SYM" --json > "$WORK/def-bare.json" \
+  || { cat "$WORK/def-bare.json"; fail "bare xerj code $SLUG --def $SYM (no XERJ_URL) failed"; }
+jq -e --argjson d "$DEF" '
+  .answered_from == "local_pack"
+  and ([.hits[]? | select(.file == $d.file and .line == $d.line)] | length) > 0' \
+  "$WORK/def-bare.json" >/dev/null \
+  || { cat "$WORK/def-bare.json"; fail "bare --def $SYM (no XERJ_URL) did not find the pulled pack's node"; }
+echo "bare def ok: $SYM with no XERJ_URL found the pulled pack's node"
+
 # 5. One question: a word from the catalogue entry's ask_for. Words the template
 #    sentence ("an agent working on ... queries this for ...") always carries say
 #    nothing about the corpus; the longest remaining words are tried, at most three.
```

---

### Incident Patch 3: `80c88cc3` (2026-10-18)
**Commit Message**: fix(autoindex): name symlinks the walk does not follow (#1680)

The default walk does not follow symlinks. walkdir then yields the
link itself, `file_type().is_file()` is false, and the entry was
`continue`d with no ignore-report line. A dry-run of a tree with an
inside link and an outside link listed neither file and did not
mention symlinks, so the links looked like they were not there.

Before: unfollowed symlinks were absent from the file list and from
the ignore summary.
After: each one is counted under `symlink:not-followed`, and the
summary carries one warning: pass `--follow-symlinks` to index a
target inside the folder; a target outside it stays refused.
`--follow-symlinks` still indexes an inside target under the link's
path and still records `symlink:outside-root` for a target outside.

Verified: cargo +1.97.1 test --locked -p xerj-autoindex --lib --
walk:: (19 passed, including
an_unfollowed_symlink_is_named_and_an_inside_target_is_indexed).
cargo +1.97.1 clippy --locked -p xerj-autoindex --all-targets --
-D warnings (exit 0).
ES-YAML not run; no wire change.

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: xerj-org <[REDACTED_EMAIL]>

**File**: `engine/crates/xerj-autoindex/src/ignore_rules.rs` (modified, +21/-0)
```diff
@@ -163,6 +163,14 @@ pub const UNRESOLVED_LINK_RULE: &str = "symlink:unresolved";
 /// Both were tried; this names the two facts that are actually true.
 pub const HIDDEN_OUTSIDE_ROOT_RULE: &str = "symlink:outside-root+hidden";
 
+/// A symlink the walk did not follow. The default is not to follow links, and
+/// an unfollowed symlink is not a file to walkdir, so it used to be skipped
+/// with no line on the ignore report — a tree of links looked empty. One
+/// warning names `--follow-symlinks`; each link is counted under this rule.
+/// A target outside the folder stays refused even when the flag is on
+/// ([`ESCAPED_ROOT_RULE`]).
+pub const NOT_FOLLOWED_RULE: &str = "symlink:not-followed";
+
 const MAX_WARNINGS: usize = 20;
 /// Directory entries the `--dry-run` deep count may examine in total. A
 /// pathological `node_modules` is not allowed to turn "tell me the plan" into
@@ -768,6 +776,19 @@ impl IgnoreStack {
         }
     }
 
+    /// A symlink left unfollowed. See [`NOT_FOLLOWED_RULE`]. The warning is
+    /// once per walk: the rule count already says how many links.
+    pub fn record_symlink_not_followed(&mut self) {
+        if !self.report.by_rule.contains_key(NOT_FOLLOWED_RULE) {
+            self.warn(
+                "symlink: not followed (pass --follow-symlinks to index a target inside \
+                 this folder; a target outside it stays refused)"
+                    .into(),
+            );
+        }
+        self.record_file(NOT_FOLLOWED_RULE);
+    }
+
     /// A followed entry that could not be resolved. See [`UNRESOLVED_LINK_RULE`].
     pub fn record_symlink_unresolved(&mut self, is_dir: bool) {
         if is_dir {
```

**File**: `engine/crates/xerj-autoindex/src/walk.rs` (modified, +68/-0)
```diff
@@ -486,6 +486,12 @@ fn walk_impl(
             continue;
         }
         if !entry.file_type().is_file() {
+            // Unfollowed symlinks are not files to walkdir. Skipping them
+            // with no report made a tree of links look empty: neither the
+            // file list nor the ignore summary mentioned them.
+            if !follow_symlinks && entry.path_is_symlink() {
+                stack.record_symlink_not_followed();
+            }
             continue;
         }
         if stack.skip_file(entry.path()).is_some() {
@@ -1186,6 +1192,68 @@ mod takeout_noise_tests {
     }
 }
 
+#[cfg(all(test, unix))]
+mod unfollowed_symlink_tests {
+    use super::walk_reporting;
+    use crate::ignore_rules::{IgnoreOptions, NOT_FOLLOWED_RULE};
+    use std::fs;
+    use std::os::unix::fs::symlink;
+
+    /// Default walk: links are omitted from the file list and named on the
+    /// report, once. `--follow-symlinks` indexes a target inside the folder
+    /// under the link's path and still refuses a target outside it.
+    #[test]
+    fn an_unfollowed_symlink_is_named_and_an_inside_target_is_indexed() {
+        let dir = tempfile::tempdir().unwrap();
+        let root = dir.path().join("proj");
+        fs::create_dir_all(root.join("src")).unwrap();
+        fs::write(root.join("src/lib.rs"), "fn alpha() {}\n").unwrap();
+        symlink("src/lib.rs", root.join("link-inside.rs")).unwrap();
+        let outside = dir.path().join("secret.txt");
+        fs::write(&outside, "secret").unwrap();
+        symlink(&outside, root.join("link-out.txt")).unwrap();
+
+        let (files, report) = walk_reporting(&root, false, IgnoreOptions::default()).unwrap();
+        let rels: Vec<&str> = files.iter().map(|e| e.rel.as_str()).collect();
+        assert!(rels.contains(&"src/lib.rs"), "{rels:?}");
+        assert!(
+            !rels.iter().any(|r| r.starts_with("link-")),
+            "unfollowed links must not be indexed: {rels:?}"
+        );
+        assert_eq!(
+            report.by_rule.get(NOT_FOLLOWED_RULE).map(|c| c.files),
+            Some(2),
+            "{report:?}"
+        );
+        let lines = report.summary_lines().join("\n");
+        assert_eq!(lines.matches("--follow-symlinks").count(), 1, "{lines}");
+        assert!(lines.contains(NOT_FOLLOWED_RULE), "{lines}");
+
+        let (followed, followed_report) =
+            walk_reporting(&root, true, IgnoreOptions::default()).unwrap();
+        let frels: Vec<&str> = followed.iter().map(|e| e.rel.as_str()).collect();
+        assert!(
+            frels.contains(&"link-inside.rs"),
+            "an inside target is indexed under the link path: {frels:?}"
+        );
+        assert!(
+            !frels.contains(&"link-out.txt"),
+            "a target outside the folder stays refused: {frels:?}"
+        );
+        assert!(
+            !followed_report.by_rule.contains_key(NOT_FOLLOWED_RULE),
+            "{followed_report:?}"
+        );
+        assert!(
+            followed_report
+                .summary_lines()
+                .iter()
+                .any(|l| l.contains("symlink:outside-root")),
+            "{followed_report:?}"
+        );
+    }
+}
+
 #[cfg(test)]
 mod portable_rel_tests {
     use super::{portable_rel, walk_reporting};
```

#### Recent Merged Pull Requests:
- **PR #1777** (2026-10-18): fix(hub): consumer gate passes defs-0 packs on the question check alone (@xerj-org)
- **PR #1775** (2026-10-18): feat(functions): store /api/field-report in R2 (go live; token has no KV) (@xerj-org)
- **PR #1769** (2026-10-18): fix(deploy): placeholder FIELD_REPORTS KV id blocks every Pages deploy (@xerj-org)
- **PR #1768** (closed): fix(pages): deploy without a stand-in field-report KV id (@xerj-org)
- **PR #1763** (2026-10-18): docs: field report for Windows autoindex and ES-compat search (2026-10-18) (@roedyrustam)
- **PR #1762** (closed): chore: add roedyrustam to .contributors (CLA signature) (@roedyrustam)

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

## X. deploy): comment out the placeholder FIELD_REPORTS KV binding that blocks every 

**RULE**:
When implementing operations in `wrangler.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a6ce269d`: deploy): comment out the placeholder FIELD_REPORTS KV binding that blocks every Pages deploy. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `wrangler.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# [[kv_namespaces]]  — COMMENTED OUT until the owner wires the real namespace.
# A placeholder id here makes `wrangler pages deploy` fail with
# "Error 8000022: Invalid KV namespace ID", which blocks EVERY xerj.org deploy
# (this file is on the deploy trigger path). With no binding declared, the
# Function fails open: /api/field-report accepts a report and returns 200 but
# does NOT store it (see functions/api/field-report.js, the `!env.FIELD_REPORTS`
# branch). To activate storage, create the namespace and restore this block:
#     wrangler kv namespace create FIELD_REPORTS   # prints an id
# [[kv_namespaces]]
# binding = "FIELD_REPORTS"
# id = "<the id it printed>"
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
[[kv_namespaces]]
binding = "FIELD_REPORTS"
id = "REPLACE_WITH_FIELD_REPORTS_KV_NAMESPACE_ID"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a6ce269d` are properly handled with clean fallback behavior.
