# Forensic Learning Record (Deep Inspection): xerj-org/xerj

> **Canonical Artifact**: `07_PROJECT_LEARNING/xerj-org-xerj-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xerj-org/xerj](https://github.com/xerj-org/xerj))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:35:26.765Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerj-org/xerj`
- **Description**: XERJ is the new way for AI to search data. Its autoindex capability activates agents to know your data without the token waste of grep and sed. One command indexes code, docs, logs and PDFs for search, RAG, security audits and agent memory, using 40x fewer tokens than grep. Elasticsearch compatible, so existing clients just work.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2667 stars

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
    /// Request timeout in seconds.
    #[serde(default = "default_timeout_secs")]
    pub timeout_secs: u64,
    /// Maximum concurrent in-flight requests.
    #[serde(default = "default_max_concurrent")]
    pub max_concurrent: usize,
    /// Maximum number of retries on transient failures.
    #[serde(default = "default_max_retries")]
    pub max_retries: u32,
}

fn default_timeout_secs() -> u64 {
    30
}
fn default_max_concurrent() -> usize {
    4
}
fn default_max_retries() -> u32 {
    3
}

impl EmbeddingProxyConfig {
    pub fn new(endpoint: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            endpoint: endpoint.into(),
            api_key: None,
            model: model.into(),
            timeout_secs: default_timeout_secs(),
            max_concurrent: default_max_concurrent(),
            max_retries: default_max_retries(),
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
            .timeout(Duration::from_secs(config.timeout_secs))
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

        let _permit = self
            .semaphore
            .acquire()
            .await
            .map_err(|e| XerjError::embedding(format!("semaphore: {e}")))?;

        let result = self.send_with_retry(&texts, model).await?;
        Ok(result)
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
            let err = XerjError::embedding(format!("embedding API returned {status}: {body}"));
            return Err(if retryable {
                EmbedFailure::transient(err)
            } else {
                EmbedFailure::permanent(err)
            });
        }

        // A 200 with an unparseable / short body is a contract violation, not
        // a transient blip — don't spin on it.
        let response: EmbedResponse = resp.json().await.map_err(|e| {
            EmbedFailure::permanent(XerjError::embedding(format!("response parse: {e}")))
        })?;

        // Sort by index to restore original order
        let mut data = response.data;
        data.sort_by_key(|d| d.index);

        if data.len() != texts.len() {
            return Err(EmbedFailure::permanent(XerjError::embedding(format!(
                "expected {} embeddings, got {}",
                texts.len(),
                data.len()
            ))));
        }

        Ok(data.into_iter().map(|d| d.embedding).collect())
    }

    /// Embed a single text.
    pub async fn embed(&self, text: String) -> Result<Vec<f32>> {
        let mut results = self.embed_batch(vec![text]).await?;
        results
            .pop()
            .ok_or_else(|| XerjError::embedding("empty embedding response"))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::
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

### Core Architecture Module: `engine/crates/xerj-ai/src/local.rs`
```
//! Built-in, zero-config deterministic text embedder.
//!
//! [`local_embed`] turns arbitrary text into a fixed-dimensional, L2-normalised
//! `f32` vector using the *feature-hashing trick* (a.k.a. the "hashing
//! vectoriser"): word unigrams and intra-word character trigrams are hashed
//! into a fixed number of buckets with a signed contribution, then the whole
//! accumulator is L2-normalised so that cosine similarity is comparable across
//! documents of different lengths.
//!
//! This is **not** a neural model — it captures lexical / sub-word overlap, not
//! deep semantics. Its job is to make the `semantic_text` field type work
//! end-to-end with **zero external dependencies** (offline, no API key), giving
//! a sensible out-of-the-box experience: paraphrases that share vocabulary rank
//! above unrelated text. When a real
//! [`crate::embed::EmbeddingProxy`] is configured the engine uses that instead
//! for production-quality embeddings — the *same* embedder is always used at
//! ingest and query time so the vectors are comparable.
//!
//! Key properties:
//! * **Deterministic** — identical input always yields the identical vector,
//!   across processes and restarts (no learned weights, no RNG).
//! * **Configurable dimensionality** — `dims` (default [`DEFAULT_DIMS`]).
//! * **Comparable** — L2-normalised, so cosine similarity is well-behaved.

/// Default embedding dimensionality for the built-in embedder.
///
/// 384 mirrors the popular `all-MiniLM-L6-v2` output size, so switching from
/// the built-in embedder to a real proxy of that width needs no mapping change.
pub const DEFAULT_DIMS: usize = 384;

/// 64-bit FNV-1a hash — small, fast, stable across platforms.
#[inline]
fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for &b in bytes {
        h ^= b as u64;
        h = h.wrapping_mul(0x00000100000001b3);
    }
    h
}

/// Accumulate one hashed feature into `acc` with a signed weight. The low bits
/// pick the bucket; one high bit picks the sign (signed hashing reduces the
/// collision bias of unsigned feature hashing).
#[inline]
fn add_feature(acc: &mut [f32], token: &[u8], weight: f32) {
    let dims = acc.len();
    if dims == 0 {
        return;
    }
    let h = fnv1a64(token);
    let idx = (h % dims as u64) as usize;
    let sign = if (h >> 63) & 1 == 0 { 1.0 } else { -1.0 };
    acc[idx] += weight * sign;
}

/// Embed `text` into a deterministic, L2-normalised vector of length `dims`.
///
/// Empty / whitespace-only text (or `dims == 0`) yields an all-zero vector;
/// cosine similarity against a zero vector is defined as 0 by
/// `compute_vector_similarity`, so this degrades gracefully rather than
/// panicking.
pub fn local_embed(text: &str, dims: usize) -> Vec<f32> {
    let mut acc = vec![0.0f32; dims];
    if dims == 0 {
        return acc;
    }

    let lower = text.to_lowercase();
    for token in lower
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| !t.is_empty())
    {
        // Whole-word unigram — the dominant lexical signal.
        add_feature(&mut acc, token.as_bytes(), 1.0);

        // Intra-word character trigrams (padded so word boundaries matter),
        // at a lower weight. These give partial credit to morphological
        // variants (e.g. "run" / "running" share the "run" shingle), which
        // nudges the embedding a little past exact-keyword matching.
        let padded: Vec<char> = std::iter::once('#')
            .chain(token.chars())
            .chain(std::iter::once('#'))
            .collect();
        if padded.len() >= 3 {
            for w in padded.windows(3) {
                let mut buf = [0u8; 12];
                let mut n = 0;
                for &ch in w {
                    let s = ch.len_utf8();
                    ch.encode_utf8(&mut buf[n..]);
                    n += s;
                }
                add_feature(&mut acc, &buf[..n], 0.35);
            }
        }
    }

    // L2-normalise so cosine similarity is length-invariant.
    let norm: f32 = acc.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in acc.iter_mut() {
            *x /= norm;
        }
    }
    acc
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dot(a: &[f32], b: &[f32]) -> f32 {
        a.iter().zip(b).map(|(x, y)| x * y).sum()
    }

    #[test]
    fn dims_and_determinism() {
        let a = local_embed("the quick brown fox", 128);
        let b = local_embed("the quick brown fox", 128);
        assert_eq!(a.len(), 128);
        assert_eq!(a, b, "embedding must be deterministic");
    }

    /// Deliberately independent of [`fnv1a64`] so that changing the embedder's
    /// hash cannot silently move the checksum with it.
    fn djb2_over_bits(v: &[f32]) -> u64 {
        let mut h: u64 = 5381;
        for x in v {
            for byte in x.to_le_bytes() {
                h = h.wrapping_mul(33) ^ byte as u64;
            }
        }
        h
    }

    /// GOLDEN VECTOR — do not "fix" this by re-recording the constants.
    ///
    /// `lexical` is the default backend and the one most deployments run, and
    /// `GET /v1/embedding/identity` reports it as `resumable: true`, which
    /// tells `xerj autoindex` it may resume an existing semantic run straight
    /// across a restart. That identity is derived from the literal string
    /// `lexical-feature-hash.v1;dimensions=384`, so nothing in it is computed
    /// from this function: changing the tokenizer, the trigram padding, the
    /// feature weights, the hash seed, or the normalisation would move every
    /// vector into a new space while `identity_sha256` stayed byte-identical,
    /// and autoindex would resume across the change and mix the two spaces —
    /// exactly the failure the identity endpoint exists to prevent.
    ///
    /// If this test fails, the lexical vector space changed. The fix is to
    /// bump `lexical-feature-hash.v1` to `.v2` in
    /// `xerj-engine/src/index.rs::embedding_execution_identity` (which changes
    /// `identity_sha256` and so makes resumes across the change fail closed),
    /// and only then re-record the constants below.
    #[test]
    fn lexical_vector_space_is_frozen() {
        let v = local_embed(
            "quarterly revenue increased in the london office",
            DEFAULT_DIMS,
        );
        assert_eq!(v.len(), DEFAULT_DIMS);

        // Whole-vector fingerprint: catches any change to any bucket.
        assert_eq!(
            djb2_over_bits(&v),
            14262738046721457820,
            "the lexical vector space changed; see this test's doc comment"
        );

        // A few exact buckets, so a failure says *what* moved rather than just
        // that a checksum differs. Bit-exact: these are IEEE-754 f32 results
        // of a fixed sequence of adds and one divide, so they are reproducible
        // across platforms.
        for (index, expected) in [
            (0usize, 0.09425097f32),
            (43, 0.09425097),
            (120, -0.09425097),
            (123, 0.26928848),
        ] {
            assert_eq!(
                v[index], expected,
                "bucket {index} moved: {} != {expected}",
                v[index]
            );
        }
    }

    #[test]
    fn l2_normalised() {
        let v = local_embed("hello world of vectors", DEFAULT_DIMS);
        let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-4, "expected unit norm, got {norm}");
    }

    #[test]
    fn empty_text_is_zero_vector() {
        let v = local_embed("   ", 64);
        assert_eq!(v.len(), 64);
        assert!(v.iter().all(|x| *x == 0.0));
    }

    #[test]
    fn zero_dims_is_empty() {
        assert!(local_embed("anything", 0).is_empty());
    }

    #[test]
    fn paraphrase_ranks_above_unrelated() {
        // A paraphrase sharing vocabulary must be closer (higher cosine) than
        // a topically-unrelated sentence — the property `semantic_text` relies
        // on for kNN retrieval.
        let dims = DEFAULT_DIMS;
        let doc_relevant = local_embed("a hungry dog chased the ball across the green park", dims);
        let doc_unrelated = local_embed(
            "investors sold technology shares amid rising interest rates",
            dims,
        );
        let query = local_embed("a dog ran after a ball in the park", dims);

        let sim_relevant = dot(&query, &doc_relevant);
        let sim_unrelated = dot(&query, &doc_unrelated);
        assert!(
            sim_relevant > sim_unrelated,
            "relevant {sim_relevant} should beat unrelated {sim_unrelated}"
        );
    }
}

```

### Core Architecture Module: `engine/crates/xerj-ai/src/microbatch.rs`
```
//! Length-aware batching for transformer inference.
//!
//! Both in-process encoder backends (Candle [`crate::neural`] and the
//! experimental [`crate::onnx`] one) run a *rectangular* tensor: every row in
//! one call is padded to the longest row in that call, and the model pays for
//! the padding exactly as if it were real text. A window that mixes one long
//! chunk with sixty short lines therefore costs `61 × long`, not
//! `long + 60 × short`.
//!
//! [`group_by_padded_cost`] is the shared cure: sort the rows by token length,
//! then cut a batch as soon as adding the next row would break either the row
//! cap or the `rows × padded_sequence_length` budget. Rows of similar length
//! end up together, so padding waste is bounded rather than set by the single
//! longest member of the window, and the token budget bounds the activation
//! memory one call can allocate.
//!
//! The returned groups hold *positions into the input*, so callers must map
//! results back into input order — neither backend may reorder its output.

/// Group row positions into inference batches.
///
/// `token_lengths[i]` is the tokenized length of row `i`. A batch is cut when
/// it already holds `max_rows` rows, or when admitting the next row would push
/// `rows × longest_row` past `padded_token_budget`.
///
/// A single row longer than the whole budget is still emitted, alone: the
/// caller's model has its own truncation limit and refusing the row here would
/// turn an expensive document into a failed one. Callers that want an error
/// instead check the lengths before calling (see [`crate::onnx`]).
///
/// The sort is stable, so equal-length rows keep input order and the plan is
/// deterministic for a given input.
pub fn group_by_padded_cost(
    token_lengths: &[usize],
    max_rows: usize,
    padded_token_budget: usize,
) -> Vec<Vec<usize>> {
    debug_assert!(max_rows > 0 && padded_token_budget > 0);
    let max_rows = max_rows.max(1);
    let padded_token_budget = padded_token_budget.max(1);

    let mut order = (0..token_lengths.len()).collect::<Vec<_>>();
    order.sort_by_key(|&i| token_lengths[i]);

    let mut batches: Vec<Vec<usize>> = Vec::new();
    let mut batch: Vec<usize> = Vec::new();
    let mut longest = 0usize;
    for i in order {
        let length = token_lengths[i];
        let next_longest = longest.max(length);
        if !batch.is_empty()
            && (batch.len() >= max_rows
                || next_longest.saturating_mul(batch.len() + 1) > padded_token_budget)
        {
            batches.push(std::mem::take(&mut batch));
            longest = 0;
        }
        longest = longest.max(length);
        batch.push(i);
    }
    if !batch.is_empty() {
        batches.push(batch);
    }
    batches
}

/// Total `rows × longest_row` slots a plan pushes through the model.
///
/// This is the quantity the padding waste lives in: it equals the sum of the
/// real token lengths only when every batch is length-homogeneous.
pub fn padded_token_slots(token_lengths: &[usize], batches: &[Vec<usize>]) -> usize {
    batches
        .iter()
        .map(|batch| {
            let longest = batch
                .iter()
                .map(|&i| token_lengths[i])
                .max()
                .unwrap_or_default();
            longest * batch.len()
        })
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_position_appears_exactly_once() {
        let lengths = [512, 14, 200, 16, 400, 15, 90, 300];
        let batches = group_by_padded_cost(&lengths, 3, 600);
        let mut positions = batches.iter().flatten().copied().collect::<Vec<_>>();
        positions.sort_unstable();
        assert_eq!(positions, (0..lengths.len()).collect::<Vec<_>>());
    }

    #[test]
    fn batches_respect_the_row_cap_and_the_token_budget() {
        let lengths = [512, 14, 200, 16, 400, 15, 90, 300];
        let batches = group_by_padded_cost(&lengths, 3, 600);
        for batch in &batches {
            assert!(batch.len() <= 3, "row cap");
            let longest = batch.iter().map(|&i| lengths[i]).max().unwrap();
            assert!(
                longest * batch.len() <= 600 || batch.len() == 1,
                "token budget: {longest} × {}",
                batch.len()
            );
        }
    }

    /// The defect this module exists for: one long row in a window of short
    /// ones must not drag the short ones up to its length.
    #[test]
    fn one_long_row_does_not_pad_the_short_rows_up_to_it() {
        let mut lengths = vec![128];
        lengths.resize(64, 30);
        let real: usize = lengths.iter().sum();

        // What a single rectangular call costs: 64 rows × the longest row.
        let unbatched = padded_token_slots(&lengths, &[(0..lengths.len()).collect()]);
        assert_eq!(unbatched, 64 * 128);

        let planned = padded_token_slots(&lengths, &group_by_padded_cost(&lengths, 64, 4096));
        assert_eq!(planned, real, "length-homogeneous groups pad nothing");
        assert!(
            planned * 3 < unbatched,
            "planned={planned} must be far below the rectangular cost {unbatched}"
        );
    }

    #[test]
    fn a_row_longer_than_the_budget_is_emitted_alone() {
        let batches = group_by_padded_cost(&[8, 9_000, 8], 64, 4_096);
        let oversized = batches
            .iter()
            .find(|batch| batch.contains(&1))
            .expect("the oversized row is still planned");
        assert_eq!(oversized.as_slice(), &[1]);
    }

    #[test]
    fn empty_input_plans_nothing() {
        assert!(group_by_padded_cost(&[], 64, 4_096).is_empty());
    }

    #[test]
    fn equal_lengths_keep_input_order() {
        let batches = group_by_padded_cost(&[10, 10, 10, 10], 2, 4_096);
        assert_eq!(batches, vec![vec![0, 1], vec![2, 3]]);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1148** (2026-10-05): **[bug]: xerj code --lang silently disables the vector leg (semantic → 0 hits, hybrid → BM25 only)**
  *Symptoms*: ### XERJ version  v1.0.0-rc.81  ### How did you install / run XERJ?  Prebuilt release binary  ### Operating system & architecture  Windows 11 x86_64  ### Steps to reproduce  ```shell 1. Start a server on a clean data directory:    xerj --data-dir ./data --insecure  2. Engine-level shape, no corpus needed. Index 20 docs with a semantic_text body and a language keyword:    curl -s -XPUT localhost:9200/t -H 'Content-Type: application/json' -d '{"mappings":{"properties":{"body":{"type":"semantic_text"},"language":{"type":"keyword"}}}}'    for i in $(seq 1 20); do printf '{"index":{"_id":"%s"}}\n{"language":"rust","body":"retry connection timeout handler number %s"}\n' $i $i; done > b.ndjson    curl -s -XPOST 'localhost:9200/t/_bulk?refresh=true' -H 'Content-Type: application/x-ndjson' --data-binary @b.ndjson  3. The semantic clause alone -> 20 hits:    curl -s -XPOST localhost:9200/t/_search -H 'Content-Type: application/json' -d '{"size":20,"query":{"semantic":{"field":"body","query":"retry connection timeout","k":20}}}'  4. The shape `xerj code --lang rust` builds (semantic and a match side by side in bool.must) -> 0 hits:    curl -s -XPOST localhost:9200/t/_search -H 'Content-Type: application/json' -d '{"size":20,"query":{"bool":{"must":[{"semantic":{"field":"body","query":"retry connection timeout","k":20}},{"match":{"language":"rust"}}]}}}'  5. The same filter as bool.filter instead -> 20 hits:    curl -s -XPOST localhost:9200/t/_search -H 'Content-Type: application/json' -

- **Issue #1145** (2026-10-05): **[bug]: xerj code never sends `k` on the semantic clause, so `--mode semantic -k N` and hybrid's vector leg are capped at 10**
  *Symptoms*: ### XERJ version  v1.0.0-rc.81  ### How did you install / run XERJ?  Prebuilt release binary  ### Operating system & architecture  Windows 11 x86_64  ### Steps to reproduce  ```shell 1. Start a server on a clean data directory (default lexical embedder):    `xerj --data-dir ./data --insecure`  2. Create an index whose `body` is semantic_text, and index 30 documents that all match the query:    curl -s -XPUT localhost:9200/t -H 'Content-Type: application/json' -d '{"mappings":{"properties":{"body":{"type":"semantic_text"},"title":{"type":"keyword"}}}}'    for i in $(seq 1 30); do printf '{"index":{"_id":"%s"}}\n{"title":"d%s","body":"retry connection timeout handler number %s"}\n' $i $i $i; done > bulk.ndjson    curl -s -XPOST 'localhost:9200/t/_bulk?refresh=true' -H 'Content-Type: application/x-ndjson' --data-binary @bulk.ndjson  3. Send the semantic clause exactly as `xerj code --mode semantic -k 20` builds it (size=20, no k) -> 10 hits:    curl -s -XPOST localhost:9200/t/_search -H 'Content-Type: application/json' -d '{"size":20,"query":{"semantic":{"field":"body","query":"retry connection timeout"}}}'  4. The same request with "k":20 on the semantic clause -> 20 hits:    curl -s -XPOST localhost:9200/t/_search -H 'Content-Type: application/json' -d '{"size":20,"query":{"semantic":{"field":"body","query":"retry connection timeout","k":20}}}'  5. Hybrid, shaped like `xerj code --mode hybrid -k 20` (size=20, semantic clause without k). The BM25 leg is    made to match nothing
  **Post-Mortem & Fix Analysis**:
  > Root cause is one layer deeper than `xccode`, and the same cap reaches two more callers. (Agent-written; verified vs assumed at the end.)  **Engine: the hybrid executor's per-leg window does not apply to vector legs.** `run_hybrid_with_deadline` fetches every sub-query at `per_query_topk = max(50, size + from)` (`engine/crates/xerj-engine/src/index.rs:16491`), and its doc comment says "each sub-list is fetched at `top_k = max(50, request.size + request.from)`" (`:16443-16445`). But a `semantic`/`knn` leg then truncates its pool to its own `k` (`pool.truncate(k.max(1))`, `:38443`), and `k` defaults to 10 in the parser (`engine/crates/xerj-query/src/parser.rs:2843` knn, `:2915` semantic). So in any `hybrid` request whose vector leg has no explicit `k`, BM25 contributes 50 candidates and the vector leg 10 — whoever built the request.  A side effect: a vector leg cut off by `k` reports its total as `min(k, matches)` with relation `eq`, so `hits.total` on a hybrid response can say `eq` whil

- **Issue #1031** (2026-09-30): **autoindex: a source file that grows mid-run (append-only log) kills the run, is misclassified as a bulk/backend failure, and the retry advice points at the wrong fix**
  *Symptoms*: User report (maxwhy, 2026-09-26), verbatim:  ``` error: autoindex stopped with bulk/backend failures: /Users/maxwhy/dev/true-inventory/audit.jsonl changed size during autoindex (expected 143882, now 148201); retry the run. Failed source files were not journaled complete; fix the reported server or embedding configuration and rerun the same command to resume safely ```  `audit.jsonl` is an append-only audit log. Growing while something reads it is its **normal behavior**, not an error condition — and this failure mode will hit anyone pointing autoindex at any live log, outbox, or export-on-a-timer directory. Three things are wrong with how we handle it:  1. **The whole run aborts.** The size guard (`engine/crates/xerj-autoindex/src/content.rs:195`) is correct to exist, but a mutated source currently costs the run: already-completed files' progress is not journaled complete for this class (`engine/crates/xerj-autoindex/src/lib.rs:7536`), so the rerun redoes work. Cheap at 148 KB; brutal at #948 mailbox scale. 2. **Misclassified and mis-advised.** The failure is bucketed under "bulk/backend failures" and the user is told to "fix the reported server or embedding configuration" — nothing is wrong with either. That advice sends the user debugging the wrong layer. (The sync path has the sibling message: `sync_executor.rs:1590`.) 3. **No resumable cut.** Nothing journals *which prefix* was consistent, so a rerun has no delta to resume from.  ## Fix shape (proposal — discussion welcom
  **Post-Mortem & Fix Analysis**:
  > Closing as **deferred, not fixed**. The defect stands exactly as reported: a source file that grows during an autoindex run (the normal behaviour of an append-only log) aborts the run, is misclassified as a bulk/backend failure, and the retry advice points at the wrong fix.  Deferred by maintainer decision 2026-09-29 rather than scheduled; the status is recorded in ROADMAP.md's defect record. The original repro (maxwhy's `audit.jsonl`, 2026-09-26) is in the issue body — reopen or re-file with it if this bites again.

- **Issue #1028** (2026-09-26): **llms.txt: "Not implemented" lists rerank, share links and mbox as not on main; #948 still presented as open after #1002**
  *Symptoms*: > Drafted by an AI coding agent (Claude Code, Claude Opus 5.5) on behalf of @Vinz2168, who reviewed it before filing.  ## What is wrong  `https://xerj.org/llms.txt` — the file agents read first — says three shipped features are not on `main`, and still describes #948 as open although #1002 fixed it. Agents told "do not plan around these" will skip features that work.  The live file is byte-identical to `landing/llms.txt` at `main` `fa27e936` (2026-09-24). Line numbers below refer to that file. Lines 50 and 53 are hand-written (they sit outside the `BEGIN/END GENERATED ARTICLE TREE` markers at lines 86 and 236), so `build_articles.py` will not correct them.  ### 1. The "Not implemented" bullet contradicts the rest of the file and `main`  [Line 50](https://github.com/xerj-org/xerj/blob/fa27e936/landing/llms.txt#L50) (last touched in #942, 2026-09-19):  > A rerank stage, share links, `mbox`/Takeout ingest: in flight on branches, not on `main`.  All three merged on 2026-09-20 and have shipped in a release since rc.75:  | Feature | Merged | On `main` | Documented as usable in the same file | |---|---|---|---| | rerank stage | #946 (`aaeae25c`) | `engine/crates/xerj-api/src/rerank_stage.rs`, `docs/RERANK.md` | L45 (caveat), L73, L74, L161–162 | | share links | #947 (`01d0044d`) | `xerj share` dispatch at `engine/crates/xerj-server/src/main.rs:1995`, `docs/SHARING.md` | L79, L203–205, L243 | | mbox / Takeout | #949 (`51d4b66a`, in `v1.0.0-rc.75`) | `engine/crates/xerj-autoindex/src/

- **Issue #1013** (2026-09-21): **delete_by_query (any long search) 500s under sustained ingest: seqlock reader starvation — "search could not complete within one stable collection generation"**
  *Symptoms*: ## What happened  While measuring #950 (heap-profile of corpus ingest), the first run aborted mid-index-phase and the cleanup `POST /<index>/_delete_by_query` failed:  ``` error: delete_by_query: HTTP 500 Internal Server Error: internal_server_error_exception: internal error: search could not complete within one stable collection generation before its deadline ```  (`/root/950-run.log:1319`, run of 2026-09-20; node under full bulk ingest — `xerj autoindex` on a ~1 GB / 85k-file corpus, 32 index workers, `--bulk-mb 8`.)  ## Mechanism  `CollectionPublication` is a seqlock: a reader is only **admitted** when no writer is in flight, and its capture is only **valid** if no writer began at any point during the read (`engine/crates/xerj-engine/src/collection_publication.rs:98-126` — `try_admit_reader` requires `in_flight == 0`; `validate_reader` requires `in_flight == 0 && generation == token.generation`; every `begin()` and every guard `Drop` bumps the generation).  The writer guard is held across the **entire flush finalize** — memtable drain, segment write, FTS sidecar build, publish — inside the blocking worker (`engine/crates/xerj-engine/src/index.rs:29986`, commit/drop at `:30389`), and concurrent flushes are explicitly allowed (`index.rs:29989-29992`).  `search()` retries admission+validation until the request deadline, then errors (`engine/crates/xerj-engine/src/index.rs:17521-17561`; `delete_by_query` rides the same loop via `index.rs:17500-17507`).  Under sustained ingest:
  **Post-Mortem & Fix Analysis**:
  > Fix posted in #1014 (fail-before churn test included: old code dies at its deadline with this issue's exact 500 message, new code converges in 0.37 s with exact totals; ES-YAML 1376/0). The latency follow-up — shrinking the flush guard to a ms-scale bracket around the install — is now #1015.

- **Issue #940** (2026-09-21): **hybrid RRF orders tied fused scores by HashMap iteration: top-10 differs for 21 of 40 queries after a restart on unchanged data**
  *Symptoms*: ## Summary  `hybrid` with `fusion: "rrf"` orders documents with an equal fused score by `HashMap` iteration order. The same request against the same data returns a different ranking after the node is restarted: on BEIR SciFact, **32 of 40 queries changed order and 21 of 40 changed their top 10**, with identical hit sets. Rank 1 itself can flip.  Ties are not an edge case under RRF — they are structural. A document found only by the BM25 leg at rank *r* and a document found only by the vector leg at rank *r* both score exactly `1/(k+r)`; two documents found by both legs at swapped ranks (1,2)/(2,1) both score `1/61 + 1/62`. Every rank position is a potential tie.  It is also why the project's own quality number moves between runs: the SciFact hybrid nDCG@10 measured 0.6993 in one run and 0.7023 in another on the same index (NFCorpus: 0.3448 / 0.3446), while the BM25-only and vector-only arms reproduced to four decimals (0.6572 / 0.6764).  Reproduced on the `v1.0.0-rc.74` release binary, `--embed-mode neural`; `fuse_rrf` is unchanged on `main` @ 4d8dadbf.  ## Repro  ```sh cd benchmarks/neural-path-triage python3 rrf_stability.py save    http://localhost:9560 scifact /path/to/beir/scifact 40 before.json # stop the node, start it again on the SAME data directory — no writes in between python3 rrf_stability.py save    http://localhost:9560 scifact /path/to/beir/scifact 40 after.json python3 rrf_stability.py compare before.json after.json ```  Literal output ([`rrf-stability-scifac

- **Issue #939** (2026-09-21): **semantic/hybrid over multi-passage documents is an exact scan that deep-clones every _source per query: ~410 ms p50 on 5,183 docs, of which the BERT forward pass is ~14 ms**
  *Symptoms*: ## Summary  On a 5,183-document index, a `semantic` query costs **~430 ms p50** and `hybrid` (BM25 + semantic, RRF) **~540 ms p50**, against **11 ms** for BM25 on the same index. The BERT forward pass for the query is **12–19 ms** of that. The rest is the exact vector scan, and almost none of the scan is arithmetic:  | phase (p50, ms) | semantic, unfiltered | semantic + `ids` filter (30 docs) | hybrid rrf | |---|---|---|---| | embed the query (MiniLM forward pass) | 14 | 12 | 19 | | **collect** — load every stored document | **216** | **197** | **331** | | **score** | **107** | **105** (30 docs scored) | **106** | | top-k + hits | 67 | 0 | 75 | | request total | 410 | 317 | 542 | | documents scored | 5,183 | 30 | 5,183 |  The same query shape on a 10,003-document index of one-sentence documents is **16 ms p50**: 12 ms embed, 2–3 ms for the HNSW search and hydrate, 0 of 37 requests on the exact scan.  So this is not "BERT is slow on CPU" and it is not "hybrid runs its legs serially" (it does — see below — but the BM25 leg is ~10 ms). It is that **any `semantic_text` index containing a multi-chunk document is pinned to an exact scan, and the exact scan deep-clones every stored `_source`, vectors included, on every query — before the filter is applied.**  Measured on the `v1.0.0-rc.74` release binary, `--embed-mode neural` (all-MiniLM-L6-v2, CPU), BEIR SciFact, on a shared 32-thread box with load average 16–23 from other jobs, so treat absolute milliseconds as conservative; the 

- **Issue #938** (2026-09-21): **Neural ingest keeps ~3.4 of 32 threads busy: 6.1 docs/s from one _bulk stream, 29.5 docs/s from 8 clients for the same CPU-seconds (forward passes run single-file)**
  *Symptoms*: ## Summary  With `--embed-mode neural` (all-MiniLM-L6-v2, Candle, CPU), one `_bulk` stream into a `semantic_text` field runs at **6.1 documents/s** on SciFact abstracts (mean 1,470 characters ≈ 3.9 passages each) while the server keeps **3.4 of 32 hardware threads busy**. Short one-sentence documents (the same corpus's titles only: mean 96 characters, one passage) run at 88 documents/s through the same path with 2.7 threads busy. The gap between the two is just passages × tokens; the defect is the 3.4 and the 2.7.  The engine is not the bottleneck and neither is the model's raw cost. The encoder alone, fed the same passages, does 31.1 passages/s with 3.5 cores busy — the end-to-end rate (6.1 docs/s × 3.86 passages = 23.5 passages/s) is within 25% of it. And the same node does **29.5 documents/s — 4.8× — when eight clients send `_bulk` concurrently, for the same total CPU** (226 → 213 CPU-seconds). The work is fixed; one stream simply never occupies the machine.  Measured on the `v1.0.0-rc.74` release binary and on `xerj-ai` built from `main` @ 4d8dadbf (`git diff v1.0.0-rc.74..main` does not touch `xerj-ai` or the bulk embedding path). AMD Ryzen AI Max+ 395, 16 cores / 32 threads, **shared with other jobs at load average 18–31 for every run below** — absolute rates are therefore conservative and noisy; CPU-seconds and cores-busy are the robust columns.  ## Measurements  End-to-end, `_bulk` of 50 documents into `{"body": {"type": "semantic_text"}}`, 400 SciFact documents per p
  **Post-Mortem & Fix Analysis**:
  > Slice 1 landed on main (PR #995, merge 4985f931): neural_window_concurrency config key + bounded window scheduler — measured 2.8x from one _bulk stream at the same CPU-seconds (14.1 -> 39.1 docs/s in-sandbox, harness in benchmarks/neural-path-triage/window_concurrency_bench.py). Remaining: slice 2 (Candle intra-op pinning) and slice 3 (cross-request pool sharing + non-serial default). Issue stays open for those.

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

### Incident Patch 1: `f24580df` (2026-10-05)
**Commit Message**: rc.83 cut fixes: de-link the three closed trackers from the ROADMAP shortlist

The release-notes gate flagged four contradictions on the release PR:
#1136/#1145/#1148 are CLOSED but still linked as open defects in the
Open-defects shortlist (the rc.16/rc.18 drift class), and merge #1164
was uncited in the [1.0.0-rc.83] notes. The shortlist now carries the
true eight (adds #1158 and #1122, which the section had never listed),
the closed three move to the plain-text closed-in-window record beside
the rc.82-era #1137/#1139 line, and the CHANGELOG intro cites #1164
(and #1157, whose five SKILL rows rode the same window). Also
rustfmt's join of the band list my #1162 rebeave left mis-indented
(order.rs:228).

**File**: `CHANGELOG.md` (modified, +4/-1)
```diff
@@ -13,7 +13,10 @@ The corpus-hub hundred release. The engine window is small — one retrieval
 fix and three extractor PRs — while the reference-coding catalogue reached
 **100 live, licence-reviewed, G7-graded corpora at
 [hub.xerj.org](https://hub.xerj.org)**, every one of them now named in the
-`xerj-code` skill's domain-selection table.
+`xerj-code` skill's domain-selection table (PR
+[#1164](https://github.com/xerj-org/xerj/pull/1164); the five SKILL-row
+additions of the rc.82 window rode in as PR
+[#1157](https://github.com/xerj-org/xerj/pull/1157)).
 
 ### Fixed
 
```

**File**: `ROADMAP.md` (modified, +18/-12)
```diff
@@ -113,7 +113,7 @@ and the console review's), the #1062 wrong-and-confident detection gate, the
 `xerj-decide-v1` Hugging Face publication (operator credentials), and the GA
 bar itself — *The road to v1.0.0 GA* below.
 
-**Open defects.** Nine, all live on the tracker at rc.82 cut time — the
+**Open defects.** Eight, all live on the tracker at rc.83 cut time — the
 shortlist the release-notes gate checks. From the rc.80 gate runs:
 [#1091](https://github.com/xerj-org/xerj/issues/1091) (hybrid first stage
 13–26 s/query on the 57,638-doc FiQA index),
@@ -124,18 +124,24 @@ flywheel write-back freezes once the history index has BM25 support). From
 the rc.80 console knowledge-surface review:
 [#1100](https://github.com/xerj-org/xerj/issues/1100) (second-brain
 belief-time frame rendered on non-note corpora). Filed from the corpus-hub
-G7 work inside the rc.82 window:
-[#1136](https://github.com/xerj-org/xerj/issues/1136) (stale index
-generations survive `--fresh` swaps; a state file with `index_prefix=null`
-queries all of them) and the `xerj code` retrieval quartet
-[#1145](https://github.com/xerj-org/xerj/issues/1145) (`k` never sent on
-the semantic clause),
-[#1146](https://github.com/xerj-org/xerj/issues/1146) (hybrid drops
-lexical-only indices from the BM25 leg too),
+G7 work: [#1146](https://github.com/xerj-org/xerj/issues/1146) (hybrid
+drops lexical-only indices from the BM25 leg too) and
 [#1147](https://github.com/xerj-org/xerj/issues/1147) (corpus-index ingest
-throughput caps corpus builds at ~10⁵ records/node-day, measured) and
-[#1148](https://github.com/xerj-org/xerj/issues/1148) (`--lang` silently
-disables the vector leg). **Closed inside the rc.82 window and recorded in
+throughput caps corpus builds at ~10⁵ records/node-day, measured — the
+osv-ecosystems corpus is deferred on exactly this number). Reopened or
+still open from the rc.81/82 windows:
+[#1158](https://github.com/xerj-org/xerj/issues/1158) (the missing `text`
+field that made raw-JSON/JSONL mirrors invisible to `xerj code` passage
+search) and [#1122](https://github.com/xerj-org/xerj/issues/1122) (reopened
+2026-10-05 when the reference node died at its memory ceiling with no panic
+line). **Closed inside the rc.83 window and recorded in the CHANGELOG, not
+carried here:** #1136 (stale index generations surviving `--fresh` swaps —
+a state file with `index_prefix=null` queried all of them; fixed by PR
+[#1156](https://github.com/xerj-org/xerj/pull/1156)) and two of the `xerj
+code` retrieval quartet, #1145 (`k` never sent on the semantic clause) and
+#1148 (`--lang` silently disabling the vector leg), both fixed by PR
+[#1153](https://github.com/xerj-org/xerj/pull/1153). **Closed inside the
+rc.82 window and recorded in
 the CHANGELOG, not carried here:** #1137 and #1139 (per-file top-k diversity
 and the txt-family search field, both fixed by PR
 [#1140](https://github.com/xerj-org/xerj/pull/1140)). **Closed inside the
```

**File**: `engine/crates/xerj-autoindex/src/order.rs` (modified, +1/-2)
```diff
@@ -228,8 +228,7 @@ pub fn band_from_family_str(rel: &str, family: &str) -> Band {
         // planning run had put it ahead of. The agreement test did not catch it
         // because its family list was written by hand and omitted `Eml` too.
         "code" | "txt-prose" | "html" | "pdf" | "docx" | "pptx" | "epub" | "ipynb" | "man"
-        | "unity"
-        | "eml" | "mbox" => Band::SourceAndDocs,
+        | "unity" | "eml" | "mbox" => Band::SourceAndDocs,
         "yaml" | "json" | "xml" | "unity-meta" => Band::Config,
         "csv" | "jsonl" | "sqlite" | "sqldump" | "xlsx" | "bvh" => Band::Data,
         // Pre-existing drift, caught by
```

---

### Incident Patch 2: `ebe35c4f` (2026-10-05)
**Commit Message**: Merge pull request #1160 from thomas-villani/fix/section-redundant-overlap

fix(autoindex): don't emit a section that the next one repeats whole

**File**: `engine/crates/xerj-autoindex/src/extract/mod.rs` (modified, +58/-3)
```diff
@@ -469,7 +469,12 @@ pub fn for_each_section(text: &str, emit: &mut dyn FnMut(String) -> bool) -> boo
     let mut cur = String::new();
 
     for para in text.split("\n\n") {
-        if !cur.is_empty() && cur.len() + para.len() > SECTION_CHARS {
+        // `cur.len() > SECTION_OVERLAP`: a shorter section would be carried
+        // WHOLE into the next as its overlap, so emitting it adds a record
+        // with no text of its own (a heading before a long first paragraph).
+        // It stays in `cur` and leads the next section instead.
+        if !cur.is_empty() && cur.len() + para.len() > SECTION_CHARS && cur.len() > SECTION_OVERLAP
+        {
             let done = std::mem::take(&mut cur);
             let carry = tail(&done, SECTION_OVERLAP);
             if !emit(done) {
@@ -726,6 +731,43 @@ mod section_tests {
         }
     }
 
+    /// A short paragraph (a heading) followed by one too big to join it was
+    /// emitted as a section of its own, and the next section then repeated it
+    /// whole as its overlap: a record with no text of its own. Seen as
+    /// "CHAPTER 26. Knights and Squires." alone on a Gutenberg EPUB.
+    #[test]
+    fn a_section_the_next_would_repeat_whole_is_not_emitted() {
+        // Each ~2100 bytes: too big to join the heading in one section.
+        let long = |i: usize| format!("w{i} ").repeat(700);
+        let t = format!(
+            "CHAPTER 26. Knights and Squires.\n\n{}\n\n{}\n\n{}",
+            long(1),
+            long(2),
+            long(3)
+        );
+        let secs = split_sections(&t);
+        assert!(
+            secs[0].starts_with("CHAPTER 26.") && secs[0].contains("w1 w1"),
+            "the heading leads a real section: {:?}",
+            &secs[0][..secs[0].len().min(60)]
+        );
+        for w in secs.windows(2) {
+            assert!(
+                !w[1].starts_with(w[0].as_str()),
+                "a section repeated whole by its successor: {:?}",
+                w[0]
+            );
+        }
+        let short = format!("{}\n\nCHAPTER 26.", "y".repeat(SECTION_CHARS));
+        assert!(
+            split_sections(&short)
+                .last()
+                .unwrap()
+                .contains("CHAPTER 26."),
+            "a short LAST paragraph is still emitted"
+        );
+    }
+
     /// A single paragraph larger than two sections must still be bounded.
     #[test]
     fn pathological_single_paragraph_is_hard_split() {
@@ -737,7 +779,8 @@ mod section_tests {
         }
     }
 
-    /// The pre-#239 implementation, kept verbatim as an oracle. It is quadratic
+    /// The pre-#239 implementation, kept as an oracle (verbatim but for the
+    /// redundant-section rule, changed in both in step). It is quadratic
     /// — only ever call it on inputs of a few hundred KB.
     fn legacy_split_sections(text: &str) -> Vec<String> {
         if text.len() <= SECTION_CHARS {
@@ -746,7 +789,13 @@ mod section_tests {
         let mut out: Vec<String> = Vec::new();
         let mut cur = String::new();
         for para in text.split("\n\n") {
-            if !cur.is_empty() && cur.len() + para.len() > SECTION_CHARS {
+            // The one deliberate change since #239, mirrored from
+            // `for_each_section`: a section its successor would repeat whole
+            // is not emitted.
+            if !cur.is_empty()
+                && cur.len() + para.len() > SECTION_CHARS
+                && cur.len() > SECTION_OVERLAP
+            {
                 let done = std::mem::take(&mut cur);
                 let carry = tail(&done, SECTION_OVERLAP);
                 out.push(done);
@@ -793,6 +842,12 @@ mod section_tests {
             doc(200, 400),
             doc(60, 300),
             doc(3, 9000),
+            // A short paragraph before ones too big to join it, at the
+            // overlap boundary and one byte either side.
+            format!("{}\n\n{}", "h".repeat(32), doc(4, 2100)),
+            format!("{}\n\n{}", "h".repeat(SECTION_OVERLAP - 1), doc(4, 2100)),
+            format!("{}\n\n{}", "h".repeat(SECTION_OVERLAP), doc(4, 2100)),
+            format!("{}\n\n{}", "h".repeat(SECTION_OVERLAP + 1), doc(4, 2100)),
             // Multi-byte, with the cut landing inside a char: 3-byte and 4-byte
             // sequences do not divide SECTION_CHARS evenly.
             "é".repeat(4 * SECTION_CHARS),
```

---

### Incident Patch 3: `dc635305` (2026-10-05)
**Commit Message**: fix(autoindex): don't emit a section that the next one repeats whole

`for_each_section` packs paragraphs into ~2 KB sections and starts each
new section with the last SECTION_OVERLAP (200) bytes of the previous
one. When a short paragraph (typically a heading) was followed by one
too big to join it, the short one was flushed as a section on its own,
and the next section then began with ALL of it as overlap. The record
carried no text of its own: a duplicate that competes for a result slot
with the real section. Seen on a Gutenberg EPUB as
"CHAPTER 26. Knights and Squires." alone, the next section repeating it;
the same shape occurs in every family that sections through this
function (PDF pages, DOCX, PPTX slides, txt prose, HTML, EPUB).

Fix (extract/mod.rs): a section is flushed only if it is longer than
SECTION_OVERLAP, i.e. only if its overlap tail is not the whole of it.
A shorter one stays in `cur` and leads the next section, which is then
at most 2 * SECTION_CHARS + 202 bytes before the existing hard-split
path applies, as for any long paragraph. Nothing is dropped: the text
is in the next section as before, once instead of twice.

The byte-for-byte oracle test (`legacy_spli

**File**: `engine/crates/xerj-autoindex/src/extract/mod.rs` (modified, +58/-3)
```diff
@@ -467,7 +467,12 @@ pub fn for_each_section(text: &str, emit: &mut dyn FnMut(String) -> bool) -> boo
     let mut cur = String::new();
 
     for para in text.split("\n\n") {
-        if !cur.is_empty() && cur.len() + para.len() > SECTION_CHARS {
+        // `cur.len() > SECTION_OVERLAP`: a shorter section would be carried
+        // WHOLE into the next as its overlap, so emitting it adds a record
+        // with no text of its own (a heading before a long first paragraph).
+        // It stays in `cur` and leads the next section instead.
+        if !cur.is_empty() && cur.len() + para.len() > SECTION_CHARS && cur.len() > SECTION_OVERLAP
+        {
             let done = std::mem::take(&mut cur);
             let carry = tail(&done, SECTION_OVERLAP);
             if !emit(done) {
@@ -724,6 +729,43 @@ mod section_tests {
         }
     }
 
+    /// A short paragraph (a heading) followed by one too big to join it was
+    /// emitted as a section of its own, and the next section then repeated it
+    /// whole as its overlap: a record with no text of its own. Seen as
+    /// "CHAPTER 26. Knights and Squires." alone on a Gutenberg EPUB.
+    #[test]
+    fn a_section_the_next_would_repeat_whole_is_not_emitted() {
+        // Each ~2100 bytes: too big to join the heading in one section.
+        let long = |i: usize| format!("w{i} ").repeat(700);
+        let t = format!(
+            "CHAPTER 26. Knights and Squires.\n\n{}\n\n{}\n\n{}",
+            long(1),
+            long(2),
+            long(3)
+        );
+        let secs = split_sections(&t);
+        assert!(
+            secs[0].starts_with("CHAPTER 26.") && secs[0].contains("w1 w1"),
+            "the heading leads a real section: {:?}",
+            &secs[0][..secs[0].len().min(60)]
+        );
+        for w in secs.windows(2) {
+            assert!(
+                !w[1].starts_with(w[0].as_str()),
+                "a section repeated whole by its successor: {:?}",
+                w[0]
+            );
+        }
+        let short = format!("{}\n\nCHAPTER 26.", "y".repeat(SECTION_CHARS));
+        assert!(
+            split_sections(&short)
+                .last()
+                .unwrap()
+                .contains("CHAPTER 26."),
+            "a short LAST paragraph is still emitted"
+        );
+    }
+
     /// A single paragraph larger than two sections must still be bounded.
     #[test]
     fn pathological_single_paragraph_is_hard_split() {
@@ -735,7 +777,8 @@ mod section_tests {
         }
     }
 
-    /// The pre-#239 implementation, kept verbatim as an oracle. It is quadratic
+    /// The pre-#239 implementation, kept as an oracle (verbatim but for the
+    /// redundant-section rule, changed in both in step). It is quadratic
     /// — only ever call it on inputs of a few hundred KB.
     fn legacy_split_sections(text: &str) -> Vec<String> {
         if text.len() <= SECTION_CHARS {
@@ -744,7 +787,13 @@ mod section_tests {
         let mut out: Vec<String> = Vec::new();
         let mut cur = String::new();
         for para in text.split("\n\n") {
-            if !cur.is_empty() && cur.len() + para.len() > SECTION_CHARS {
+            // The one deliberate change since #239, mirrored from
+            // `for_each_section`: a section its successor would repeat whole
+            // is not emitted.
+            if !cur.is_empty()
+                && cur.len() + para.len() > SECTION_CHARS
+                && cur.len() > SECTION_OVERLAP
+            {
                 let done = std::mem::take(&mut cur);
                 let carry = tail(&done, SECTION_OVERLAP);
                 out.push(done);
@@ -791,6 +840,12 @@ mod section_tests {
             doc(200, 400),
             doc(60, 300),
             doc(3, 9000),
+            // A short paragraph before ones too big to join it, at the
+            // overlap boundary and one byte either side.
+            format!("{}\n\n{}", "h".repeat(32), doc(4, 2100)),
+            format!("{}\n\n{}", "h".repeat(SECTION_OVERLAP - 1), doc(4, 2100)),
+            format!("{}\n\n{}", "h".repeat(SECTION_OVERLAP), doc(4, 2100)),
+            format!("{}\n\n{}", "h".repeat(SECTION_OVERLAP + 1), doc(4, 2100)),
             // Multi-byte, with the cut landing inside a char: 3-byte and 4-byte
             // sequences do not divide SECTION_CHARS evenly.
             "é".repeat(4 * SECTION_CHARS),
```

---

### Incident Patch 4: `0303a7bf` (2026-10-05)
**Commit Message**: Merge branch 'main' into fix/corpus-generation-hygiene

**File**: `engine/Cargo.lock` (modified, +2/-2)
```diff
@@ -7728,9 +7728,9 @@ checksum = "66fee0b777b0f5ac1c69bb06d361268faafa61cd4682ae064a171c16c433e9e4"
 
 [[package]]
 name = "xxhash-rust"
-version = "0.8.15"
+version = "0.8.19"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fdd20c5420375476fbd4394763288da7eb0cc0b8c11deed431a91562af7335d3"
+checksum = "550a2b930b62486a393c52d5c3b84bff264b28aa437ed64694d31e93b1757af7"
 
 [[package]]
 name = "yasna"
```

**File**: `landing/agent-search/index.html` (modified, +1/-1)
```diff
@@ -358,7 +358,7 @@ <h2 class="asx-h2">The same thing, over the wire</h2>
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · AGENT SEARCH · V1.0.0-RC.81</span>
+  <span>XERJ.AI · AGENT SEARCH · V1.0.0-RC.82</span>
   <span>PORTED FROM THE ENGINE · BIT-EXACT</span>
   <span><a href="/">HOME</a> · <a href="/docs/recipes/semantic-search-rag">SEMANTIC RECIPE</a> · <a href="/docs/recipes/">RECIPES</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/cutting-the-index-28-percent.html` (modified, +1/-1)
```diff
@@ -491,7 +491,7 @@ <h2 class="scene">What we tried and kept out</h2>
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/does-xerj-beat-jev.html` (modified, +1/-1)
```diff
@@ -666,7 +666,7 @@ <h2 class="scene" style="font-size:var(--fs-56);">THE TITLE ASKED FOR A WINNER.<
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/index.html` (modified, +1/-1)
```diff
@@ -476,7 +476,7 @@ <h2 class="bl-title">Does XERJ beat JEV? On the bill, outright. On FiQA, no.</h2
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/jev-vs-a-bm25-vote.html` (modified, +1/-1)
```diff
@@ -473,7 +473,7 @@ <h2 class="scene">Count your labels before you pay for a model</h2>
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/one-vulnerability-three-names.html` (modified, +1/-1)
```diff
@@ -405,7 +405,7 @@ <h2 class="scene">Every number, pinned to a run</h2>
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/the-rc80-gates.html` (modified, +1/-1)
```diff
@@ -379,7 +379,7 @@ <h2 class="scene" style="font-size:var(--fs-56);">EVERY LOSS HAS<br><span class=
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

---

### Incident Patch 5: `75952f67` (2026-10-05)
**Commit Message**: Merge branch 'main' into fix/html-table-text

**File**: `CHANGELOG.md` (modified, +90/-0)
```diff
@@ -7,6 +7,96 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [1.0.0-rc.82] - 2026-10-05
+
+The documents-people-actually-have release. Three extractor PRs from a
+first-time contributor extend autoindex to the formats that were still
+read-as-text: Unix man pages, and the two spreadsheet shapes real
+workbooks ship — vertically merged cells and two-row grouped headers.
+Every code change in the window came through the community surface:
+the extractor work is
+[thomas-villani](https://github.com/thomas-villani)'s first contributions
+to the project, and the window also carries the `xerj code` retrieval
+fixes and two field reports.
+
+### Added
+
+- **Man page extraction** — roff `man(7)` sources read as documents, one
+  record per `.SH` section: the `.TH` title (`LS(1)`), the NAME summary,
+  font escapes dropped, `\(em`-class specials become the characters they
+  name, no-fill blocks keep their layout, and a tbl table becomes one
+  ` | `-joined line per row. Enough of the roff request language is read
+  (`.ds` strings, `.if`/`.ie`/`.el` conditionals, `.de` macro bodies) that
+  pod2man's preamble needs no special case; mdoc(7) pages and `.so` stubs
+  stay text, as before. Ported from the man parser in all2md
+  (`parsers/man.py`, MIT), reduced to plain text with attribution
+  (PR [#1134](https://github.com/xerj-org/xerj/pull/1134),
+  thomas-villani).
+- **XLSX merged cells fill down** — a cell merged DOWN over several rows
+  (a pandas MultiIndex export, a category label beside its line items)
+  stores its value only in the top row; every covered row now gets it, so
+  `region: East` matches all of East's rows and a `terms` aggregation
+  counts them. Merges across columns are deliberately not expanded
+  (PR [#1132](https://github.com/xerj-org/xerj/pull/1132),
+  thomas-villani).
+- **XLSX two-row grouped headers** — a header two rows deep (group labels
+  above the column names, pandas' MultiIndex columns) names each column
+  from both rows: `Q1_Jan`, `Q1_Feb`. Three-or-more-row headers keep
+  their two lowest rows; on sheets over 64 MB the sample keeps one
+  (PR [#1133](https://github.com/xerj-org/xerj/pull/1133),
+  thomas-villani, stacked on #1132).
+- **Docs: extracted formats** — `.pptx`/`.xlsx` listed as extracted
+  formats across the docs and the retired "no XLSX/PPTX extractor"
+  caveats removed
+  (PR [#1130](https://github.com/xerj-org/xerj/pull/1130),
+  thomas-villani).
+- **The xerj-code skill points at the whole hub** — per-project corpus
+  selection now walks the live registry instead of a hand-listed few
+  (PR [#1126](https://github.com/xerj-org/xerj/pull/1126)), and the
+  domain-selection table covers every live hub corpus
+  (PRs [#1143](https://github.com/xerj-org/xerj/pull/1143),
+  [#1149](https://github.com/xerj-org/xerj/pull/1149),
+  [#1150](https://github.com/xerj-org/xerj/pull/1150)).
+
+### Fixed
+
+- **`xerj code` top-k crowding** — one large file's adjacent 2 KB chunks
+  no longer crowd every other source out of the top-k: at most 2 records
+  per source file (issue [#1137](https://github.com/xerj-org/xerj/issues/1137),
+  fixed by PR [#1140](https://github.com/xerj-org/xerj/pull/1140) — the
+  failure class was measured as G7 retrieval fails before the fix).
+- **`xerj code` txt-family search** — the txt extraction family puts its
+  content in a `text` field the BM25 leg never searched, so passages
+  rendered empty; the field is searched now (issue
+  [#1139](https://github.com/xerj-org/xerj/issues/1139), fixed by PR
+  [#1140](https://github.com/xerj-org/xerj/pull/1140)).
+- **Markdown sniffing** — markdown whose body starts with YAML-shaped
+  keys or an HTML prefix classified as Yaml or Xml and indexed as junk;
+  it is Txt now, with guards on the sniffs that mistook it
+  (PRs [#1142](https://github.com/xerj-org/xerj/pull/1142) and
+  [#1144](https://github.com/xerj-org/xerj/pull/1144)).
+- **`.odp` advice** — the unsupported-format hint now tells OpenDocument
+  presentation owners to save as `.pptx` (one record per slide, with
+  slide titles and notes) rather than export to PDF
+  (PR [#1131](https://github.com/xerj-org/xerj/pull/1131),
+  thomas-villani).
+
+### Community
+
+- Field reports: a second reference-coding report from
+  [alessandropcostabr](https://github.com/alessandropcostabr)
+  (PR [#1141](https://github.com/xerj-org/xerj/pull/1141)) and a
+  doc-sort field report from
+  [Ravandevil25](https://github.com/Ravandevil25)
+  (PR [#1128](https://github.com/xerj-org/xerj/pull/1128)), whose CLA
+  signature landed with it (PR
+  [#1129](https://github.com/xerj-org/xerj/pull/1129)) — the `_doc`
+  arrival-order fix that report describes is reviewed and waiting on its
+  own CLA signature (PR
+  [#1127](https://github.com/xerj-org/xerj/pull/1127)).
+- Release-download metrics chore for 2026-10-04 (2,956 assets, 1,651
+  binaries — direct commit, `[skip ci]`).
+
 ## [1.0.0-rc.81]
```

**File**: `ROADMAP.md` (modified, +45/-14)
```diff
@@ -2,14 +2,19 @@
 
 This roadmap tracks capabilities that are **planned but not yet fully implemented**, so the project's public claims stay honest about what ships today versus what is coming. Status is verified against the actual code and by real API requests to the release binary, not aspirational.
 
-Last reviewed: 2026-10-03 (against `v1.0.0-rc.81` and `main`). Statuses trace to issues, merged PRs, the CHANGELOG, and the conformance suite; items carried forward from the 2026-07-12 review without fresh live verification are marked as such. This review line is machine-checked: `docs_capability_lists` fails the build if a release is cut without re-reviewing this file (issue #298 — closed as abandoned 2026-09-29; the machine check, not the issue, enforces the cadence now). This pass is the rc.81 release-cut roll: the open-defects shortlist was
-re-verified against the live tracker at cut time — **four open** (#1091,
-#1092, #1094 from the rc.80 gate runs; #1100 from the console review);
-#1093 was closed inside the window by PR
-[#1112](https://github.com/xerj-org/xerj/pull/1112) (strict unknown-field
-refusal) and moves to the CHANGELOG — the lesson of 2026-09-21, when several
+Last reviewed: 2026-10-05 (against `v1.0.0-rc.82` and `main`). Statuses trace to issues, merged PRs, the CHANGELOG, and the conformance suite; items carried forward from the 2026-07-12 review without fresh live verification are marked as such. This review line is machine-checked: `docs_capability_lists` fails the build if a release is cut without re-reviewing this file (issue #298 — closed as abandoned 2026-09-29; the machine check, not the issue, enforces the cadence now). This pass is the rc.82 release-cut roll: the open-defects shortlist was
+re-verified against the live tracker at cut time — **nine open** (#1091,
+#1092, #1094 from the rc.80 gate runs; #1100 from the console review;
+#1136 and #1145–#1148, the corpus-namespace and `xerj code` retrieval
+defects filed from the corpus-hub G7 work inside this window); #1137 and
+#1139 were closed inside the window by PR
+[#1140](https://github.com/xerj-org/xerj/pull/1140) and move to the
+CHANGELOG — the lesson of 2026-09-21, when several
 entries went stale within hours of that review, is why the shortlist is
-checked live at the cut rather than desk-carried. Later the same day the tracker was emptied: everything open after the cut — #1038, #1030, #1031, #1032 — was closed (the two shipped-half epics are in the rc.78 record below, the two defects are recorded below as deferred, not fixed), leaving zero open issues. The 2026-09-26 desk review (PR [#1036](https://github.com/xerj-org/xerj/pull/1036)) stands as recorded: it closed the CHANGELOG-gap GA item (the rc.19–rc.70 backfill, PR [#1035](https://github.com/xerj-org/xerj/pull/1035)), marked the stage-2 object-storage item done ([#965](https://github.com/xerj-org/xerj/issues/965) wired in rc.77), and corrected the mail-ingest memory line to the post-[#1002](https://github.com/xerj-org/xerj/pull/1002) reality. The *Shipping today* claims were last live-verified against rc.76 (unchanged by this pass), and *The zero-token direction* below was verified separately on 2026-09-18, against `main` @ `4d8dadbf`.
+checked live at the cut rather than desk-carried. The rc.81 roll's record
+stands as written: four open at that cut, with #1093 closed inside the
+window by PR [#1112](https://github.com/xerj-org/xerj/pull/1112) (strict
+unknown-field refusal). Later the same day the tracker was emptied: everything open after the cut — #1038, #1030, #1031, #1032 — was closed (the two shipped-half epics are in the rc.78 record below, the two defects are recorded below as deferred, not fixed), leaving zero open issues. The 2026-09-26 desk review (PR [#1036](https://github.com/xerj-org/xerj/pull/1036)) stands as recorded: it closed the CHANGELOG-gap GA item (the rc.19–rc.70 backfill, PR [#1035](https://github.com/xerj-org/xerj/pull/1035)), marked the stage-2 object-storage item done ([#965](https://github.com/xerj-org/xerj/issues/965) wired in rc.77), and corrected the mail-ingest memory line to the post-[#1002](https://github.com/xerj-org/xerj/pull/1002) reality. The *Shipping today* claims were last live-verified against rc.76 (unchanged by this pass), and *The zero-token direction* below was verified separately on 2026-09-18, against `main` @ `4d8dadbf`.
 
 ## Follow the roadmap
 
@@ -40,7 +45,19 @@ The release-by-release record of how all of this landed is [CHANGELOG.md](./CHAN
 
 ## Next release — [v1.0.0](https://github.com/xerj-org/xerj/milestone/2)
 
-The GA window. **rc.81 was cut on 2026-10-03** — its full contents are the
+The GA window. **rc.82 was cut on 2026-10-05** — the
+documents-people-actually-have release: man-page extraction plus the two
+spreadsheet shapes real workbooks ship (vertically merged XLSX cells,
+two-row grouped headers), all three
+[thomas-villani](https://github.com/thomas-villani)'s first contributions
+to the pro
```

**File**: `engine/Cargo.lock` (modified, +19/-19)
```diff
@@ -7236,7 +7236,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-ai"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "candle-core",
@@ -7258,7 +7258,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-api"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "argon2",
@@ -7293,7 +7293,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-autoindex"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "aws-sdk-s3",
@@ -7368,7 +7368,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-cluster"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -7393,7 +7393,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-common"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "byteorder",
@@ -7413,7 +7413,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-compress"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "byteorder",
  "bytes",
@@ -7426,7 +7426,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-console-api"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "arc-swap",
@@ -7462,7 +7462,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-engine"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "arc-swap",
@@ -7517,7 +7517,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-fts"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "bitpacking",
@@ -7544,7 +7544,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-logs"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "byteorder",
@@ -7562,7 +7562,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-mcp"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "reqwest",
@@ -7576,7 +7576,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-query"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "base64 0.22.1",
@@ -7591,7 +7591,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-rerank"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "reqwest",
  "serde",
@@ -7605,7 +7605,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-server"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "axum",
@@ -7654,7 +7654,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-storage"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "arc-swap",
@@ -7687,7 +7687,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-vector"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "byteorder",
@@ -7705,7 +7705,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-wasm"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "bytes",
@@ -7728,9 +7728,9 @@ checksum = "66fee0b777b0f5ac1c69bb06d361268faafa61cd4682ae064a171c16c433e9e4"
 
 [[package]]
 name = "xxhash-rust"
-version = "0.8.15"
+version = "0.8.19"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fdd20c5420375476fbd4394763288da7eb0cc0b8c11deed431a91562af7335d3"
+checksum = "550a2b930b62486a393c52d5c3b84bff264b28aa437ed64694d31e93b1757af7"
 
 [[package]]
 name = "yasna"
```

**File**: `engine/Cargo.toml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ members = [
 ]
 
 [workspace.package]
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 edition = "2021"
 license = "Apache-2.0"
 authors = ["xerj Contributors"]
```

**File**: `landing/agent-search/index.html` (modified, +1/-1)
```diff
@@ -358,7 +358,7 @@ <h2 class="asx-h2">The same thing, over the wire</h2>
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · AGENT SEARCH · V1.0.0-RC.81</span>
+  <span>XERJ.AI · AGENT SEARCH · V1.0.0-RC.82</span>
   <span>PORTED FROM THE ENGINE · BIT-EXACT</span>
   <span><a href="/">HOME</a> · <a href="/docs/recipes/semantic-search-rag">SEMANTIC RECIPE</a> · <a href="/docs/recipes/">RECIPES</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/cutting-the-index-28-percent.html` (modified, +1/-1)
```diff
@@ -491,7 +491,7 @@ <h2 class="scene">What we tried and kept out</h2>
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/does-xerj-beat-jev.html` (modified, +1/-1)
```diff
@@ -666,7 +666,7 @@ <h2 class="scene" style="font-size:var(--fs-56);">THE TITLE ASKED FOR A WINNER.<
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/index.html` (modified, +1/-1)
```diff
@@ -476,7 +476,7 @@ <h2 class="bl-title">Does XERJ beat JEV? On the bill, outright. On FiQA, no.</h2
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

---

### Incident Patch 6: `bac29a61` (2026-10-05)
**Commit Message**: Merge branch 'main' into fix/xccode-semantic-k-and-lang

**File**: `CHANGELOG.md` (modified, +90/-0)
```diff
@@ -7,6 +7,96 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [1.0.0-rc.82] - 2026-10-05
+
+The documents-people-actually-have release. Three extractor PRs from a
+first-time contributor extend autoindex to the formats that were still
+read-as-text: Unix man pages, and the two spreadsheet shapes real
+workbooks ship — vertically merged cells and two-row grouped headers.
+Every code change in the window came through the community surface:
+the extractor work is
+[thomas-villani](https://github.com/thomas-villani)'s first contributions
+to the project, and the window also carries the `xerj code` retrieval
+fixes and two field reports.
+
+### Added
+
+- **Man page extraction** — roff `man(7)` sources read as documents, one
+  record per `.SH` section: the `.TH` title (`LS(1)`), the NAME summary,
+  font escapes dropped, `\(em`-class specials become the characters they
+  name, no-fill blocks keep their layout, and a tbl table becomes one
+  ` | `-joined line per row. Enough of the roff request language is read
+  (`.ds` strings, `.if`/`.ie`/`.el` conditionals, `.de` macro bodies) that
+  pod2man's preamble needs no special case; mdoc(7) pages and `.so` stubs
+  stay text, as before. Ported from the man parser in all2md
+  (`parsers/man.py`, MIT), reduced to plain text with attribution
+  (PR [#1134](https://github.com/xerj-org/xerj/pull/1134),
+  thomas-villani).
+- **XLSX merged cells fill down** — a cell merged DOWN over several rows
+  (a pandas MultiIndex export, a category label beside its line items)
+  stores its value only in the top row; every covered row now gets it, so
+  `region: East` matches all of East's rows and a `terms` aggregation
+  counts them. Merges across columns are deliberately not expanded
+  (PR [#1132](https://github.com/xerj-org/xerj/pull/1132),
+  thomas-villani).
+- **XLSX two-row grouped headers** — a header two rows deep (group labels
+  above the column names, pandas' MultiIndex columns) names each column
+  from both rows: `Q1_Jan`, `Q1_Feb`. Three-or-more-row headers keep
+  their two lowest rows; on sheets over 64 MB the sample keeps one
+  (PR [#1133](https://github.com/xerj-org/xerj/pull/1133),
+  thomas-villani, stacked on #1132).
+- **Docs: extracted formats** — `.pptx`/`.xlsx` listed as extracted
+  formats across the docs and the retired "no XLSX/PPTX extractor"
+  caveats removed
+  (PR [#1130](https://github.com/xerj-org/xerj/pull/1130),
+  thomas-villani).
+- **The xerj-code skill points at the whole hub** — per-project corpus
+  selection now walks the live registry instead of a hand-listed few
+  (PR [#1126](https://github.com/xerj-org/xerj/pull/1126)), and the
+  domain-selection table covers every live hub corpus
+  (PRs [#1143](https://github.com/xerj-org/xerj/pull/1143),
+  [#1149](https://github.com/xerj-org/xerj/pull/1149),
+  [#1150](https://github.com/xerj-org/xerj/pull/1150)).
+
+### Fixed
+
+- **`xerj code` top-k crowding** — one large file's adjacent 2 KB chunks
+  no longer crowd every other source out of the top-k: at most 2 records
+  per source file (issue [#1137](https://github.com/xerj-org/xerj/issues/1137),
+  fixed by PR [#1140](https://github.com/xerj-org/xerj/pull/1140) — the
+  failure class was measured as G7 retrieval fails before the fix).
+- **`xerj code` txt-family search** — the txt extraction family puts its
+  content in a `text` field the BM25 leg never searched, so passages
+  rendered empty; the field is searched now (issue
+  [#1139](https://github.com/xerj-org/xerj/issues/1139), fixed by PR
+  [#1140](https://github.com/xerj-org/xerj/pull/1140)).
+- **Markdown sniffing** — markdown whose body starts with YAML-shaped
+  keys or an HTML prefix classified as Yaml or Xml and indexed as junk;
+  it is Txt now, with guards on the sniffs that mistook it
+  (PRs [#1142](https://github.com/xerj-org/xerj/pull/1142) and
+  [#1144](https://github.com/xerj-org/xerj/pull/1144)).
+- **`.odp` advice** — the unsupported-format hint now tells OpenDocument
+  presentation owners to save as `.pptx` (one record per slide, with
+  slide titles and notes) rather than export to PDF
+  (PR [#1131](https://github.com/xerj-org/xerj/pull/1131),
+  thomas-villani).
+
+### Community
+
+- Field reports: a second reference-coding report from
+  [alessandropcostabr](https://github.com/alessandropcostabr)
+  (PR [#1141](https://github.com/xerj-org/xerj/pull/1141)) and a
+  doc-sort field report from
+  [Ravandevil25](https://github.com/Ravandevil25)
+  (PR [#1128](https://github.com/xerj-org/xerj/pull/1128)), whose CLA
+  signature landed with it (PR
+  [#1129](https://github.com/xerj-org/xerj/pull/1129)) — the `_doc`
+  arrival-order fix that report describes is reviewed and waiting on its
+  own CLA signature (PR
+  [#1127](https://github.com/xerj-org/xerj/pull/1127)).
+- Release-download metrics chore for 2026-10-04 (2,956 assets, 1,651
+  binaries — direct commit, `[skip ci]`).
+
 ## [1.0.0-rc.81]
```

**File**: `ROADMAP.md` (modified, +45/-14)
```diff
@@ -2,14 +2,19 @@
 
 This roadmap tracks capabilities that are **planned but not yet fully implemented**, so the project's public claims stay honest about what ships today versus what is coming. Status is verified against the actual code and by real API requests to the release binary, not aspirational.
 
-Last reviewed: 2026-10-03 (against `v1.0.0-rc.81` and `main`). Statuses trace to issues, merged PRs, the CHANGELOG, and the conformance suite; items carried forward from the 2026-07-12 review without fresh live verification are marked as such. This review line is machine-checked: `docs_capability_lists` fails the build if a release is cut without re-reviewing this file (issue #298 — closed as abandoned 2026-09-29; the machine check, not the issue, enforces the cadence now). This pass is the rc.81 release-cut roll: the open-defects shortlist was
-re-verified against the live tracker at cut time — **four open** (#1091,
-#1092, #1094 from the rc.80 gate runs; #1100 from the console review);
-#1093 was closed inside the window by PR
-[#1112](https://github.com/xerj-org/xerj/pull/1112) (strict unknown-field
-refusal) and moves to the CHANGELOG — the lesson of 2026-09-21, when several
+Last reviewed: 2026-10-05 (against `v1.0.0-rc.82` and `main`). Statuses trace to issues, merged PRs, the CHANGELOG, and the conformance suite; items carried forward from the 2026-07-12 review without fresh live verification are marked as such. This review line is machine-checked: `docs_capability_lists` fails the build if a release is cut without re-reviewing this file (issue #298 — closed as abandoned 2026-09-29; the machine check, not the issue, enforces the cadence now). This pass is the rc.82 release-cut roll: the open-defects shortlist was
+re-verified against the live tracker at cut time — **nine open** (#1091,
+#1092, #1094 from the rc.80 gate runs; #1100 from the console review;
+#1136 and #1145–#1148, the corpus-namespace and `xerj code` retrieval
+defects filed from the corpus-hub G7 work inside this window); #1137 and
+#1139 were closed inside the window by PR
+[#1140](https://github.com/xerj-org/xerj/pull/1140) and move to the
+CHANGELOG — the lesson of 2026-09-21, when several
 entries went stale within hours of that review, is why the shortlist is
-checked live at the cut rather than desk-carried. Later the same day the tracker was emptied: everything open after the cut — #1038, #1030, #1031, #1032 — was closed (the two shipped-half epics are in the rc.78 record below, the two defects are recorded below as deferred, not fixed), leaving zero open issues. The 2026-09-26 desk review (PR [#1036](https://github.com/xerj-org/xerj/pull/1036)) stands as recorded: it closed the CHANGELOG-gap GA item (the rc.19–rc.70 backfill, PR [#1035](https://github.com/xerj-org/xerj/pull/1035)), marked the stage-2 object-storage item done ([#965](https://github.com/xerj-org/xerj/issues/965) wired in rc.77), and corrected the mail-ingest memory line to the post-[#1002](https://github.com/xerj-org/xerj/pull/1002) reality. The *Shipping today* claims were last live-verified against rc.76 (unchanged by this pass), and *The zero-token direction* below was verified separately on 2026-09-18, against `main` @ `4d8dadbf`.
+checked live at the cut rather than desk-carried. The rc.81 roll's record
+stands as written: four open at that cut, with #1093 closed inside the
+window by PR [#1112](https://github.com/xerj-org/xerj/pull/1112) (strict
+unknown-field refusal). Later the same day the tracker was emptied: everything open after the cut — #1038, #1030, #1031, #1032 — was closed (the two shipped-half epics are in the rc.78 record below, the two defects are recorded below as deferred, not fixed), leaving zero open issues. The 2026-09-26 desk review (PR [#1036](https://github.com/xerj-org/xerj/pull/1036)) stands as recorded: it closed the CHANGELOG-gap GA item (the rc.19–rc.70 backfill, PR [#1035](https://github.com/xerj-org/xerj/pull/1035)), marked the stage-2 object-storage item done ([#965](https://github.com/xerj-org/xerj/issues/965) wired in rc.77), and corrected the mail-ingest memory line to the post-[#1002](https://github.com/xerj-org/xerj/pull/1002) reality. The *Shipping today* claims were last live-verified against rc.76 (unchanged by this pass), and *The zero-token direction* below was verified separately on 2026-09-18, against `main` @ `4d8dadbf`.
 
 ## Follow the roadmap
 
@@ -40,7 +45,19 @@ The release-by-release record of how all of this landed is [CHANGELOG.md](./CHAN
 
 ## Next release — [v1.0.0](https://github.com/xerj-org/xerj/milestone/2)
 
-The GA window. **rc.81 was cut on 2026-10-03** — its full contents are the
+The GA window. **rc.82 was cut on 2026-10-05** — the
+documents-people-actually-have release: man-page extraction plus the two
+spreadsheet shapes real workbooks ship (vertically merged XLSX cells,
+two-row grouped headers), all three
+[thomas-villani](https://github.com/thomas-villani)'s first contributions
+to the pro
```

**File**: `engine/Cargo.lock` (modified, +19/-19)
```diff
@@ -7236,7 +7236,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-ai"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "candle-core",
@@ -7258,7 +7258,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-api"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "argon2",
@@ -7293,7 +7293,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-autoindex"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "aws-sdk-s3",
@@ -7368,7 +7368,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-cluster"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -7393,7 +7393,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-common"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "byteorder",
@@ -7413,7 +7413,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-compress"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "byteorder",
  "bytes",
@@ -7426,7 +7426,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-console-api"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "arc-swap",
@@ -7462,7 +7462,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-engine"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "arc-swap",
@@ -7517,7 +7517,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-fts"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "bitpacking",
@@ -7544,7 +7544,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-logs"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "byteorder",
@@ -7562,7 +7562,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-mcp"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "reqwest",
@@ -7576,7 +7576,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-query"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "base64 0.22.1",
@@ -7591,7 +7591,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-rerank"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "reqwest",
  "serde",
@@ -7605,7 +7605,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-server"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "axum",
@@ -7654,7 +7654,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-storage"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "arc-swap",
@@ -7687,7 +7687,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-vector"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "byteorder",
@@ -7705,7 +7705,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-wasm"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "bytes",
@@ -7728,9 +7728,9 @@ checksum = "66fee0b777b0f5ac1c69bb06d361268faafa61cd4682ae064a171c16c433e9e4"
 
 [[package]]
 name = "xxhash-rust"
-version = "0.8.15"
+version = "0.8.19"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fdd20c5420375476fbd4394763288da7eb0cc0b8c11deed431a91562af7335d3"
+checksum = "550a2b930b62486a393c52d5c3b84bff264b28aa437ed64694d31e93b1757af7"
 
 [[package]]
 name = "yasna"
```

**File**: `engine/Cargo.toml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ members = [
 ]
 
 [workspace.package]
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 edition = "2021"
 license = "Apache-2.0"
 authors = ["xerj Contributors"]
```

**File**: `landing/agent-search/index.html` (modified, +1/-1)
```diff
@@ -358,7 +358,7 @@ <h2 class="asx-h2">The same thing, over the wire</h2>
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · AGENT SEARCH · V1.0.0-RC.81</span>
+  <span>XERJ.AI · AGENT SEARCH · V1.0.0-RC.82</span>
   <span>PORTED FROM THE ENGINE · BIT-EXACT</span>
   <span><a href="/">HOME</a> · <a href="/docs/recipes/semantic-search-rag">SEMANTIC RECIPE</a> · <a href="/docs/recipes/">RECIPES</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/cutting-the-index-28-percent.html` (modified, +1/-1)
```diff
@@ -491,7 +491,7 @@ <h2 class="scene">What we tried and kept out</h2>
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/does-xerj-beat-jev.html` (modified, +1/-1)
```diff
@@ -666,7 +666,7 @@ <h2 class="scene" style="font-size:var(--fs-56);">THE TITLE ASKED FOR A WINNER.<
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

**File**: `landing/blog/index.html` (modified, +1/-1)
```diff
@@ -476,7 +476,7 @@ <h2 class="bl-title">Does XERJ beat JEV? On the bill, outright. On FiQA, no.</h2
 </nav>
 <!-- seo:footer-end -->
 <footer class="footer">
-  <span>XERJ.AI · V1.0.0-RC.81 · 2026</span>
+  <span>XERJ.AI · V1.0.0-RC.82 · 2026</span>
   <span>SEARCH FOR THE AGENT ERA</span>
   <span><a href="/product">PRODUCT</a> · <a href="/docs/">DOCS</a> · <a href="/brand">BRAND</a> · <a href="/playground">DASHBOARDS</a> &middot; <a href="/llms.txt">LLMS.TXT</a></span>
 </footer>
```

---

### Incident Patch 7: `fbebeb95` (2026-10-05)
**Commit Message**: fix(corpus): retire stale index generations; never read a failed listing as empty

Issue #1136, both halves of the leak, measured on the corpus-hub nodes:

1. LEGACY RUNS NEVER RETIRED ANYTHING. A corpus whose state file names no
   build (legacy mode, or a lost state file beside live indices) re-indexed
   under the bare xc-<corpus> namespace and left every stamped generation
   live forever. Measured: tldr-pages carried an unstamped 38,554-doc
   generation beside b1790965276-* (3,111) and b1791124662-* (4,706);
   kafka-protocol ~120 indices across three generations; unicode-cldr
   2.18M docs. Because the ledger names no build, those stamped
   generations are unreachable BY CONSTRUCTION while xerj code queries
   the namespace — a top-5 was measured mixing current-mirror and
   dead-clone hits, failing 3 of 5 grade resolutions.

   Now: after a successful legacy run, every live xc-<name>-b<stamp>-*
   index is retired by exact name plus its catalog scope (one per
   generation, BTreeSet-deduped). The run's own unstamped output is kept.

2. A LISTING THE NODE NEVER ANSWERED READ AS 'NOTHING TO RETIRE'.
   corpus_indices swallowed list_indices errors into an empty Vec; the
   bu

**File**: `CHANGELOG.md` (modified, +18/-0)
```diff
@@ -7,6 +7,24 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- **Corpus generation hygiene** (issue
+  [#1136](https://github.com/xerj-org/xerj/issues/1136)) — stale index
+  generations no longer survive beside a corpus, silently poisoning its
+  namespace. Three changes in `xerj corpus index` / `xerj code`:
+  a legacy-mode run (a state file that names no build) now retires the
+  stamped generations it supersedes — the measured shape was
+  `tldr-pages` carrying an unstamped 38,554-document generation beside
+  two stamped ones, mixed into every `xerj code` answer; a build whose
+  namespace listing the node never answered says so loudly and retires
+  nothing instead of reading the empty list as "nothing to retire"; and
+  every verified `--fresh` swap ends with an epilogue naming whatever
+  still sits under `xc-<corpus>-` outside the build readers are pinned
+  to. `xerj code` now also prints a stderr notice when a corpus has no
+  verified build recorded and the query is widening to the whole
+  namespace.
+
 ## [1.0.0-rc.82] - 2026-10-05
 
 The documents-people-actually-have release. Three extractor PRs from a
```

**File**: `engine/crates/xerj-autoindex/src/xc.rs` (modified, +230/-16)
```diff
@@ -1078,12 +1078,16 @@ fn count_under(node: &dyn CorpusNode, prefix: &str) -> Option<u64> {
 /// glob is not enough: `xc-battle-*` also matches the sibling corpus
 /// `battle-terse`, and retiring a sibling's indices is not a mistake this
 /// command gets to make.
-fn corpus_indices(node: &dyn CorpusNode, name: &str, root: &Path) -> Vec<String> {
-    // Any error lists nothing, which errs toward KEEPING an index (nothing is
-    // retired that was not listed), never toward deleting one.
-    let rows = node
-        .list_indices(&format!("xc-{name}-*"))
-        .unwrap_or_default();
+/// The namespace listing plus whether the node actually answered. An error
+/// lists nothing — which errs toward KEEPING an index (nothing is retired
+/// that was not listed), never toward deleting one — but the caller now gets
+/// to SAY so instead of a silent empty list reading as "nothing to retire"
+/// (#1136: generations survived exactly that way).
+fn corpus_indices(node: &dyn CorpusNode, name: &str, root: &Path) -> (Vec<String>, bool) {
+    let rows = match node.list_indices(&format!("xc-{name}-*")) {
+        Ok(rows) => rows,
+        Err(_) => return (Vec::new(), false),
+    };
     let mut siblings: Vec<String> = Vec::new();
     for (folder, strip) in [(root.join("corpora"), ""), (root.join("state"), ".json")] {
         if let Ok(entries) = std::fs::read_dir(&folder) {
@@ -1100,12 +1104,94 @@ fn corpus_indices(node: &dyn CorpusNode, name: &str, root: &Path) -> Vec<String>
             }
         }
     }
-    rows.into_iter()
-        .filter(|idx| {
-            idx.starts_with(&format!("xc-{name}-"))
-                && !siblings.iter().any(|s| idx.starts_with(s.as_str()))
-        })
-        .collect()
+    (
+        rows.into_iter()
+            .filter(|idx| {
+                idx.starts_with(&format!("xc-{name}-"))
+                    && !siblings.iter().any(|s| idx.starts_with(s.as_str()))
+            })
+            .collect(),
+        true,
+    )
+}
+
+/// The generation prefix of a stamped index (`xc-<corpus>-b<stamp>` → itself),
+/// or `None` for an unstamped legacy index (`xc-<corpus>-<dataset>`), where
+/// the segment after the corpus name is a dataset name, not a build stamp.
+/// Digits-only between `b` and the next `-` is the stamp shape; a dataset
+/// named like a stamp has never been a shape the autoindex emits.
+fn stamped_prefix(name: &str, idx: &str) -> Option<String> {
+    let rest = idx.strip_prefix(&format!("xc-{name}-b"))?;
+    let stamp = rest.split('-').next()?;
+    (!stamp.is_empty() && stamp.bytes().all(|b| b.is_ascii_digit()))
+        .then(|| format!("xc-{name}-b{stamp}"))
+}
+
+/// Retire every index in `names` that belongs to a stamped generation, plus
+/// that generation's catalog scope. Returns how many indices were deleted.
+/// Used by the legacy arm: the ledger names no build there, so stamped
+/// generations are unreachable by construction — `xerj code` queries the bare
+/// namespace and mixes their documents into every answer (#1136).
+fn retire_stamped(node: &dyn CorpusNode, name: &str, names: &[String]) -> usize {
+    let doomed: Vec<String> = names
+        .iter()
+        .filter(|idx| stamped_prefix(name, idx).is_some())
+        .cloned()
+        .collect();
+    if doomed.is_empty() {
+        return 0;
+    }
+    let scopes: std::collections::BTreeSet<String> = doomed
+        .iter()
+        .filter_map(|idx| stamped_prefix(name, idx))
+        .collect();
+    println!(
+        "xerj corpus index: retiring {} stale-generation indices this corpus cannot reach \
+         (the ledger names no build):",
+        doomed.len()
+    );
+    for idx in &doomed {
+        println!("xerj corpus index:   {idx}");
+    }
+    let deleted = doomed.len() - delete_indices(node, &doomed);
+    for scope in scopes {
+        node.delete_catalog_scope(&scope);
+    }
+    deleted
+}
+
+/// Say what still sits under `xc-<name>-` outside the prefix readers are now
+/// pinned to — the visibility half of #1136: a retirement that half-failed
+/// (or a listing that came back empty at the wrong moment) is a poison the
+/// next G7-grade query would otherwise measure for us.
+fn report_leftovers(node: &dyn CorpusNode, name: &str, root: &Path, keep: &str) {
+    let (left, listed_ok) = corpus_indices(node, name, root);
+    if !listed_ok {
+        eprintln!(
+            "xerj corpus index: could not re-list this corpus's indices to check for stale \
+             generations — run `xerj corpus list` against the node when it answers."
+        );
+        return;
+    }
+    let left: Vec<String> = left.into_iter().filter(|i| !i.starts_with(keep)).collect();
+    if left.is_empty() {
+        return;
+    }
+    eprintln!(
+        "xerj corpus index: WARNING — {} stale indices remain under xc-{name}- outside \
+         what `xerj code` now reads ({keep}-*):",
+        left.len()
+    );
+    for idx in left.iter().take(5) {
+        eprintln!("xerj cor
```

**File**: `engine/crates/xerj-common/src/xccode/mod.rs` (modified, +12/-0)
```diff
@@ -200,6 +200,18 @@ pub fn run_code_query(
     };
 
     let prefix = state::query_prefix(&st);
+    // Legacy state (indexed before builds existed) names no verified build,
+    // so the query widens to the whole `xc-<corpus>` namespace — and whatever
+    // stale generations live there are mixed into the answers (#1136). Say
+    // so at the point it happens; stderr, because stdout is the parsed
+    // hit list. `corpus index <name> --fresh` pins one verified build.
+    if st.index_prefix.is_none() {
+        eprintln!(
+            "xerj code: notice: corpus '{corpus}' has no verified build recorded — querying \
+             the whole xc-{corpus} namespace; `xerj corpus index {corpus} --fresh` pins one \
+             verified build"
+        );
+    }
 
     // 3. Not-loaded-here: in state/ yet 0 live indices on THIS node. A
     //    distinct, actionable diagnosis (exit 3) — collapsing it into
```

---

### Incident Patch 8: `9c311659` (2026-10-05)
**Commit Message**: fix(autoindex): end HTML paragraphs with a blank line so sections break between them

`split_sections` packs paragraphs at blank lines (`\n\n`). The HTML
tokenizer ended a `<p>`/`<div>` with a single newline; only headings got a
blank line. A page of paragraphs was therefore ONE paragraph to the
splitter: it was hard-cut every SECTION_CHARS (2 KB) bytes mid-word, and
the heading before the run, being a paragraph of its own followed by one
too large to join, was emitted as a section on its own (a 12-byte
"Introduction" record whose text the next section then repeated).
Observed on a real EPUB 3 test book read through this tokenizer: section
starts like "ahaere me te pupuri..." cut mid-word.

Fix (extract/html.rs): `<p>`, `<div>` and the end of a `<ul>`/`<ol>` end
the body's paragraph (blank line); `<br>`, `<li>` and table rows end a
line, so a list or a table stays one block. A table's rows are now set
off from the prose around them by blank lines. New helper `line_break`
also drops the space `flush_text` leaves after a text run.

Test: sections_of_a_long_page_end_at_paragraph_ends (10 paragraphs of
~450 bytes under an h1, then a list): every section but the last ends at
a paragraph

**File**: `engine/crates/xerj-autoindex/src/extract/html.rs` (modified, +57/-13)
```diff
@@ -279,9 +279,7 @@ fn parse(html: &str) -> Doc {
                         // text never reaches the body any other way, and a
                         // table that is not the dominant one is not emitted
                         // as rows. An empty cell keeps its column.
-                        if !doc.body.is_empty() && !doc.body.ends_with('\n') {
-                            doc.body.push('\n');
-                        }
+                        line_break(&mut doc.body, 2);
                         for row in &cur_table {
                             if row.iter().any(|c| !c.is_empty()) {
                                 doc.body.push_str(&row.join(" | "));
@@ -312,16 +310,16 @@ fn parse(html: &str) -> Doc {
                     cur_row_th.push(name == "th");
                     cur_cell = Some(String::new());
                 }
-                (false, "br")
-                | (false, "p")
-                | (true, "p")
-                | (false, "div")
-                | (true, "div")
-                | (false, "li")
-                | (true, "tr")
-                    if !doc.body.ends_with('\n') && !doc.body.is_empty() =>
-                {
-                    doc.body.push('\n');
+                // Block boundaries are blank lines: `split_sections` packs
+                // paragraphs at `\n\n`, so a single newline here made a page
+                // of paragraphs one paragraph, hard-cut mid-word. Line-level
+                // breaks (`br`, list items, table rows) stay single newlines,
+                // so a list or a table stays one block.
+                (_, "p") | (_, "div") | (true, "ul") | (true, "ol") => {
+                    line_break(&mut doc.body, 2);
+                }
+                (false, "br") | (false, "li") | (true, "tr") => {
+                    line_break(&mut doc.body, 1);
                 }
                 _ => {}
             }
@@ -432,6 +430,20 @@ fn raw_text_end(bytes: &[u8], from: usize, name: &[u8]) -> usize {
     bytes.len()
 }
 
+/// End the body's current line (`n` = 1) or paragraph (`n` = 2): drop the
+/// space `flush_text` leaves after a run of text, then make the body end in
+/// at least `n` newlines. Nothing is added to an empty body.
+fn line_break(body: &mut String, n: usize) {
+    body.truncate(body.trim_end_matches(' ').len());
+    if body.is_empty() {
+        return;
+    }
+    let have = body.len() - body.trim_end_matches('\n').len();
+    for _ in have..n {
+        body.push('\n');
+    }
+}
+
 fn normalize_ws(s: &str) -> String {
     s.split_whitespace().collect::<Vec<_>>().join(" ")
 }
@@ -767,6 +779,38 @@ mod tests {
         );
     }
 
+    /// `split_sections` packs paragraphs at blank lines. A `<p>` used to end
+    /// with a single newline, so a page of paragraphs was ONE paragraph to it
+    /// and was hard-cut every `SECTION_CHARS` bytes, mid-word; the heading
+    /// before such a run was emitted as a section on its own. Paragraph and
+    /// div ends are now blank lines, so sections end where paragraphs do.
+    #[test]
+    fn sections_of_a_long_page_end_at_paragraph_ends() {
+        let para = |i: usize| format!("Paragraph {i} {} end{i}.", "lorem ipsum dolor ".repeat(24));
+        let html: String = std::iter::once("<html><body><h1>Title</h1>".to_string())
+            .chain((0..10).map(|i| format!("<p>{}</p>", para(i))))
+            .chain(std::iter::once(
+                "<ul><li>one</li><li>two</li></ul><p>tail</p></body></html>".into(),
+            ))
+            .collect();
+        let (stats, recs) = run("long.html", &html);
+        assert!(stats.records > 1, "{} bytes split", html.len());
+        for r in &recs[..recs.len() - 1] {
+            let body = body_of(r).trim_end();
+            assert!(
+                (0..10).any(|i| body.ends_with(&format!("end{i}."))),
+                "section ends mid-paragraph: ...{:?}",
+                &body[body.len().saturating_sub(40)..]
+            );
+        }
+        assert!(
+            body_of(&recs[0]).len() > 100,
+            "the heading is not a section of its own"
+        );
+        let last = body_of(recs.last().unwrap());
+        assert!(last.contains("one\ntwo"), "list items stay lines: {last:?}");
+    }
+
     #[test]
     fn a_page_without_a_title_falls_back_to_a_heading_then_to_the_file_stem() {
         let (_, recs) = run(
```

---

### Incident Patch 9: `d61841a1` (2026-10-05)
**Commit Message**: fix(autoindex): keep HTML table text in the document body

An HTML page that is not turned into row records (no dominant table:
fewer than 5 rows, an inconsistent column count, or simply not the
largest table) is indexed as one document {title, headings, body}. Every
table on such a page was lost from it: `flush_text` diverts text inside a
cell into `cur_cell`, and the finished table went only to `doc.tables`,
which the document path never reads. Small tables, the common case on a
documentation page (option lists, version matrices, price tables), were
silently unindexed. c3a06f3b pinned this as a known defect
(a_table_below_the_dominance_threshold_leaves_its_cells_unindexed, "flip
this assertion").

Fix (extract/html.rs, `</table>`): the table's rows are also written to
the body where the table stood, one ` | `-joined line per row, the shape
PPTX tables already use. An empty cell keeps its column; an all-empty row
is dropped. The dominant-table path is unchanged (it never reads the
body), so pages already indexed as rows produce the same records.

Test: the pinned test is flipped to
a_table_below_the_dominance_threshold_keeps_its_rows_in_the_body, which
also checks the rows sit bet

**File**: `engine/crates/xerj-autoindex/src/extract/html.rs` (modified, +40/-13)
```diff
@@ -274,6 +274,20 @@ fn parse(html: &str) -> Doc {
                         cur_table.push(std::mem::take(&mut cur_row));
                     }
                     if !cur_table.is_empty() {
+                        // The rows also go to the body, in place, one
+                        // ` | `-joined line per row as PPTX tables do: cell
+                        // text never reaches the body any other way, and a
+                        // table that is not the dominant one is not emitted
+                        // as rows. An empty cell keeps its column.
+                        if !doc.body.is_empty() && !doc.body.ends_with('\n') {
+                            doc.body.push('\n');
+                        }
+                        for row in &cur_table {
+                            if row.iter().any(|c| !c.is_empty()) {
+                                doc.body.push_str(&row.join(" | "));
+                                doc.body.push('\n');
+                            }
+                        }
                         doc.header_cells
                             .push(vec![table_header_flags.first().copied().unwrap_or(false)]);
                         doc.tables.push(std::mem::take(&mut cur_table));
@@ -716,27 +730,40 @@ mod tests {
         );
     }
 
-    /// DEFECT, pinned as CURRENT behaviour.
-    ///
-    /// A table under the 5-row dominance threshold loses its content twice
-    /// over: it is not emitted as rows, and `flush_text` has already diverted
-    /// every cell into `cur_cell` instead of `doc.body`, so the cells are not
-    /// in the document record either. Small tables — the common case on a
-    /// documentation page — are silently unindexed.
+    /// A table that is not emitted as rows (under the 5-row dominance
+    /// threshold here) used to lose its content twice over: `flush_text`
+    /// diverts every cell into `cur_cell`, so the cells never reached
+    /// `doc.body` either. Its rows now land in the body where the table
+    /// stood, one ` | `-joined line per row, as PPTX tables do.
     #[test]
-    fn a_table_below_the_dominance_threshold_leaves_its_cells_unindexed() {
+    fn a_table_below_the_dominance_threshold_keeps_its_rows_in_the_body() {
         let (stats, recs) = run(
             "small.html",
             "<html><body><h1>Head</h1><p>prose</p>\
-             <table><tr><td>cellA</td><td>cellB</td></tr></table>\
+             <table><tr><th>Region</th><th>Q3</th></tr>\
+             <tr><td>North</td><td>12</td></tr>\
+             <tr><td>  </td><td></td></tr>\
+             <tr><td>South <b>East</b></td><td></td></tr></table>\
              <p>after</p></body></html>",
         );
         assert_eq!(stats.records, 1, "falls back to the document record");
         let body = body_of(&recs[0]);
-        assert!(body.contains("prose") && body.contains("after"));
-        assert!(
-            !body.contains("cellA") && !body.contains("cellB"),
-            "small-table cells are now indexed — flip this assertion: {body:?}"
+        let lines: Vec<&str> = body.lines().map(str::trim).collect();
+        let at = |s: &str| {
+            lines
+                .iter()
+                .position(|l| *l == s)
+                .unwrap_or_else(|| panic!("no line {s:?} in {body:?}"))
+        };
+        // In place, in order: after the prose before it, before the prose
+        // after it. An empty cell keeps its column; an all-empty row is
+        // dropped.
+        let (head, north, south) = (at("Region | Q3"), at("North | 12"), at("South East |"));
+        assert!(at("prose") < head && head < north && north < south && south < at("after"));
+        assert_eq!(
+            lines.iter().filter(|l| l.contains('|')).count(),
+            3,
+            "{body:?}"
         );
     }
 
```

---

### Incident Patch 10: `509a01dd` (2026-10-05)
**Commit Message**: fix(xccode): put --lang in bool.filter so the vector leg still runs (#1148)

semantic_body and hybrid_body wrapped the semantic clause as
bool.must [semantic, match language]. The engine sends a bool to the
vector path only when the semantic clause is its one must/should
clause, merging bool.filter into the semantic filter
(peel_semantic_query, xerj-engine/src/index.rs:39265-39304, #395/#557).
A semantic clause beside a sibling in `must` falls through to the
lexical path and matches nothing, with HTTP 200. So:

- `xerj code --mode semantic --lang LG` returned 0 hits;
- `xerj code --mode hybrid --lang LG` was BM25-only, while its @mode
  note still reported a vector leg.

Repro on v1.0.0-rc.81 (issue #1148): semantic alone -> 20 hits;
bool.must [semantic, match language] -> 0; bool.must [semantic] +
bool.filter [term language] -> 20. On a psf/requests corpus, semantic
-k 5 -> 5 hits, with --lang python -> 0; hybrid's top RRF score drops
from 2/61 (both legs) to 1/61 (BM25 only).

Fix: `--lang` becomes bool.filter [match language] with the clause
alone in `must`, in semantic_body and on both hybrid legs (the BM25 leg
keeps the same shape as the vector leg). `match` is kept rather tha

**File**: `engine/crates/xerj-common/src/xccode/mod.rs` (modified, +36/-2)
```diff
@@ -520,9 +520,11 @@ pub(crate) fn bm25_body(query: &str, k: usize, lang: &Option<String>, fields: &[
 /// vector pool to 10 whatever `size` says (#1145).
 pub(crate) fn semantic_body(query: &str, k: usize, lang: &Option<String>) -> Value {
     let q = serde_json::json!({ "semantic": { "field": "body", "query": query, "k": k } });
+    // `--lang` rides in `filter`: the engine sends a bool to the vector path
+    // only when the semantic clause is its sole must/should clause (#1148).
     let query = match lang {
         Some(lg) => serde_json::json!({
-            "bool": { "must": [q, { "match": { "language": lg } }] }
+            "bool": { "must": [q], "filter": [{ "match": { "language": lg } }] }
         }),
         None => q,
     };
@@ -541,10 +543,13 @@ pub(crate) fn hybrid_body(
 ) -> Value {
     // `--lang` must constrain BOTH legs (xc.py semantics): a language filter
     // on BM25 only lets the vector leg surface docs the user filtered out.
+    // It is a `filter`, not a second `must`: a semantic clause beside a
+    // sibling in `must` falls through to the lexical path and matches
+    // nothing (#1148). Both legs take the same shape.
     let wrap = |q: Value| -> Value {
         match lang {
             Some(lg) => serde_json::json!({
-                "bool": { "must": [q, { "match": { "language": lg } }] }
+                "bool": { "must": [q], "filter": [{ "match": { "language": lg } }] }
             }),
             None => q,
         }
@@ -904,6 +909,35 @@ mod tests {
         );
     }
 
+    /// #1148: the engine dispatches a bool to the vector path only when the
+    /// semantic clause is its ONE must/should clause (bool.filter is merged
+    /// into the semantic filter); a `match` beside it in `must` fell through
+    /// to the lexical path and answered 200 with zero hits. `--lang` must
+    /// therefore ride in `filter`, on both hybrid legs.
+    #[test]
+    fn lang_is_a_filter_so_the_semantic_clause_stays_alone_in_must() {
+        let lang = Some("rust".to_string());
+        let want_filter = serde_json::json!([{ "match": { "language": "rust" } }]);
+
+        let sem = semantic_body("q", 50, &lang);
+        let must = sem.pointer("/query/bool/must").and_then(Value::as_array);
+        assert_eq!(must.map(Vec::len), Some(1), "{sem}");
+        assert!(must.unwrap()[0].get("semantic").is_some(), "{sem}");
+        assert_eq!(sem.pointer("/query/bool/filter"), Some(&want_filter));
+
+        let fields = vec!["body".to_string()];
+        let hy = hybrid_body("q", 50, &lang, &fields);
+        for (leg, clause) in [(0, "multi_match"), (1, "semantic")] {
+            let q = hy
+                .pointer(&format!("/query/hybrid/queries/{leg}/query"))
+                .unwrap();
+            let must = q.pointer("/bool/must").and_then(Value::as_array);
+            assert_eq!(must.map(Vec::len), Some(1), "leg {leg}: {q}");
+            assert!(must.unwrap()[0].get(clause).is_some(), "leg {leg}: {q}");
+            assert_eq!(q.pointer("/bool/filter"), Some(&want_filter), "leg {leg}");
+        }
+    }
+
     #[test]
     fn hybrid_without_a_capable_index_degrades_to_bm25_and_says_so() {
         let root = root_with_state();
```

---

### Incident Patch 11: `54521f01` (2026-10-05)
**Commit Message**: merge #1151: release v1.0.0-rc.82 (man pages, XLSX shapes, xerj code fixes)

Release: v1.0.0-rc.82 (2026-10-05)

**File**: `CHANGELOG.md` (modified, +90/-0)
```diff
@@ -7,6 +7,96 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [1.0.0-rc.82] - 2026-10-05
+
+The documents-people-actually-have release. Three extractor PRs from a
+first-time contributor extend autoindex to the formats that were still
+read-as-text: Unix man pages, and the two spreadsheet shapes real
+workbooks ship — vertically merged cells and two-row grouped headers.
+Every code change in the window came through the community surface:
+the extractor work is
+[thomas-villani](https://github.com/thomas-villani)'s first contributions
+to the project, and the window also carries the `xerj code` retrieval
+fixes and two field reports.
+
+### Added
+
+- **Man page extraction** — roff `man(7)` sources read as documents, one
+  record per `.SH` section: the `.TH` title (`LS(1)`), the NAME summary,
+  font escapes dropped, `\(em`-class specials become the characters they
+  name, no-fill blocks keep their layout, and a tbl table becomes one
+  ` | `-joined line per row. Enough of the roff request language is read
+  (`.ds` strings, `.if`/`.ie`/`.el` conditionals, `.de` macro bodies) that
+  pod2man's preamble needs no special case; mdoc(7) pages and `.so` stubs
+  stay text, as before. Ported from the man parser in all2md
+  (`parsers/man.py`, MIT), reduced to plain text with attribution
+  (PR [#1134](https://github.com/xerj-org/xerj/pull/1134),
+  thomas-villani).
+- **XLSX merged cells fill down** — a cell merged DOWN over several rows
+  (a pandas MultiIndex export, a category label beside its line items)
+  stores its value only in the top row; every covered row now gets it, so
+  `region: East` matches all of East's rows and a `terms` aggregation
+  counts them. Merges across columns are deliberately not expanded
+  (PR [#1132](https://github.com/xerj-org/xerj/pull/1132),
+  thomas-villani).
+- **XLSX two-row grouped headers** — a header two rows deep (group labels
+  above the column names, pandas' MultiIndex columns) names each column
+  from both rows: `Q1_Jan`, `Q1_Feb`. Three-or-more-row headers keep
+  their two lowest rows; on sheets over 64 MB the sample keeps one
+  (PR [#1133](https://github.com/xerj-org/xerj/pull/1133),
+  thomas-villani, stacked on #1132).
+- **Docs: extracted formats** — `.pptx`/`.xlsx` listed as extracted
+  formats across the docs and the retired "no XLSX/PPTX extractor"
+  caveats removed
+  (PR [#1130](https://github.com/xerj-org/xerj/pull/1130),
+  thomas-villani).
+- **The xerj-code skill points at the whole hub** — per-project corpus
+  selection now walks the live registry instead of a hand-listed few
+  (PR [#1126](https://github.com/xerj-org/xerj/pull/1126)), and the
+  domain-selection table covers every live hub corpus
+  (PRs [#1143](https://github.com/xerj-org/xerj/pull/1143),
+  [#1149](https://github.com/xerj-org/xerj/pull/1149),
+  [#1150](https://github.com/xerj-org/xerj/pull/1150)).
+
+### Fixed
+
+- **`xerj code` top-k crowding** — one large file's adjacent 2 KB chunks
+  no longer crowd every other source out of the top-k: at most 2 records
+  per source file (issue [#1137](https://github.com/xerj-org/xerj/issues/1137),
+  fixed by PR [#1140](https://github.com/xerj-org/xerj/pull/1140) — the
+  failure class was measured as G7 retrieval fails before the fix).
+- **`xerj code` txt-family search** — the txt extraction family puts its
+  content in a `text` field the BM25 leg never searched, so passages
+  rendered empty; the field is searched now (issue
+  [#1139](https://github.com/xerj-org/xerj/issues/1139), fixed by PR
+  [#1140](https://github.com/xerj-org/xerj/pull/1140)).
+- **Markdown sniffing** — markdown whose body starts with YAML-shaped
+  keys or an HTML prefix classified as Yaml or Xml and indexed as junk;
+  it is Txt now, with guards on the sniffs that mistook it
+  (PRs [#1142](https://github.com/xerj-org/xerj/pull/1142) and
+  [#1144](https://github.com/xerj-org/xerj/pull/1144)).
+- **`.odp` advice** — the unsupported-format hint now tells OpenDocument
+  presentation owners to save as `.pptx` (one record per slide, with
+  slide titles and notes) rather than export to PDF
+  (PR [#1131](https://github.com/xerj-org/xerj/pull/1131),
+  thomas-villani).
+
+### Community
+
+- Field reports: a second reference-coding report from
+  [alessandropcostabr](https://github.com/alessandropcostabr)
+  (PR [#1141](https://github.com/xerj-org/xerj/pull/1141)) and a
+  doc-sort field report from
+  [Ravandevil25](https://github.com/Ravandevil25)
+  (PR [#1128](https://github.com/xerj-org/xerj/pull/1128)), whose CLA
+  signature landed with it (PR
+  [#1129](https://github.com/xerj-org/xerj/pull/1129)) — the `_doc`
+  arrival-order fix that report describes is reviewed and waiting on its
+  own CLA signature (PR
+  [#1127](https://github.com/xerj-org/xerj/pull/1127)).
+- Release-download metrics chore for 2026-10-04 (2,956 assets, 1,651
+  binaries — direct commit, `[skip ci]`).
+
 ## [1.0.0-rc.81]
```

**File**: `ROADMAP.md` (modified, +45/-14)
```diff
@@ -2,14 +2,19 @@
 
 This roadmap tracks capabilities that are **planned but not yet fully implemented**, so the project's public claims stay honest about what ships today versus what is coming. Status is verified against the actual code and by real API requests to the release binary, not aspirational.
 
-Last reviewed: 2026-10-03 (against `v1.0.0-rc.81` and `main`). Statuses trace to issues, merged PRs, the CHANGELOG, and the conformance suite; items carried forward from the 2026-07-12 review without fresh live verification are marked as such. This review line is machine-checked: `docs_capability_lists` fails the build if a release is cut without re-reviewing this file (issue #298 — closed as abandoned 2026-09-29; the machine check, not the issue, enforces the cadence now). This pass is the rc.81 release-cut roll: the open-defects shortlist was
-re-verified against the live tracker at cut time — **four open** (#1091,
-#1092, #1094 from the rc.80 gate runs; #1100 from the console review);
-#1093 was closed inside the window by PR
-[#1112](https://github.com/xerj-org/xerj/pull/1112) (strict unknown-field
-refusal) and moves to the CHANGELOG — the lesson of 2026-09-21, when several
+Last reviewed: 2026-10-05 (against `v1.0.0-rc.82` and `main`). Statuses trace to issues, merged PRs, the CHANGELOG, and the conformance suite; items carried forward from the 2026-07-12 review without fresh live verification are marked as such. This review line is machine-checked: `docs_capability_lists` fails the build if a release is cut without re-reviewing this file (issue #298 — closed as abandoned 2026-09-29; the machine check, not the issue, enforces the cadence now). This pass is the rc.82 release-cut roll: the open-defects shortlist was
+re-verified against the live tracker at cut time — **nine open** (#1091,
+#1092, #1094 from the rc.80 gate runs; #1100 from the console review;
+#1136 and #1145–#1148, the corpus-namespace and `xerj code` retrieval
+defects filed from the corpus-hub G7 work inside this window); #1137 and
+#1139 were closed inside the window by PR
+[#1140](https://github.com/xerj-org/xerj/pull/1140) and move to the
+CHANGELOG — the lesson of 2026-09-21, when several
 entries went stale within hours of that review, is why the shortlist is
-checked live at the cut rather than desk-carried. Later the same day the tracker was emptied: everything open after the cut — #1038, #1030, #1031, #1032 — was closed (the two shipped-half epics are in the rc.78 record below, the two defects are recorded below as deferred, not fixed), leaving zero open issues. The 2026-09-26 desk review (PR [#1036](https://github.com/xerj-org/xerj/pull/1036)) stands as recorded: it closed the CHANGELOG-gap GA item (the rc.19–rc.70 backfill, PR [#1035](https://github.com/xerj-org/xerj/pull/1035)), marked the stage-2 object-storage item done ([#965](https://github.com/xerj-org/xerj/issues/965) wired in rc.77), and corrected the mail-ingest memory line to the post-[#1002](https://github.com/xerj-org/xerj/pull/1002) reality. The *Shipping today* claims were last live-verified against rc.76 (unchanged by this pass), and *The zero-token direction* below was verified separately on 2026-09-18, against `main` @ `4d8dadbf`.
+checked live at the cut rather than desk-carried. The rc.81 roll's record
+stands as written: four open at that cut, with #1093 closed inside the
+window by PR [#1112](https://github.com/xerj-org/xerj/pull/1112) (strict
+unknown-field refusal). Later the same day the tracker was emptied: everything open after the cut — #1038, #1030, #1031, #1032 — was closed (the two shipped-half epics are in the rc.78 record below, the two defects are recorded below as deferred, not fixed), leaving zero open issues. The 2026-09-26 desk review (PR [#1036](https://github.com/xerj-org/xerj/pull/1036)) stands as recorded: it closed the CHANGELOG-gap GA item (the rc.19–rc.70 backfill, PR [#1035](https://github.com/xerj-org/xerj/pull/1035)), marked the stage-2 object-storage item done ([#965](https://github.com/xerj-org/xerj/issues/965) wired in rc.77), and corrected the mail-ingest memory line to the post-[#1002](https://github.com/xerj-org/xerj/pull/1002) reality. The *Shipping today* claims were last live-verified against rc.76 (unchanged by this pass), and *The zero-token direction* below was verified separately on 2026-09-18, against `main` @ `4d8dadbf`.
 
 ## Follow the roadmap
 
@@ -40,7 +45,19 @@ The release-by-release record of how all of this landed is [CHANGELOG.md](./CHAN
 
 ## Next release — [v1.0.0](https://github.com/xerj-org/xerj/milestone/2)
 
-The GA window. **rc.81 was cut on 2026-10-03** — its full contents are the
+The GA window. **rc.82 was cut on 2026-10-05** — the
+documents-people-actually-have release: man-page extraction plus the two
+spreadsheet shapes real workbooks ship (vertically merged XLSX cells,
+two-row grouped headers), all three
+[thomas-villani](https://github.com/thomas-villani)'s first contributions
+to the pro
```

**File**: `engine/Cargo.lock` (modified, +17/-17)
```diff
@@ -7236,7 +7236,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-ai"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "candle-core",
@@ -7258,7 +7258,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-api"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "argon2",
@@ -7293,7 +7293,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-autoindex"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "aws-sdk-s3",
@@ -7368,7 +7368,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-cluster"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -7393,7 +7393,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-common"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "byteorder",
@@ -7413,7 +7413,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-compress"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "byteorder",
  "bytes",
@@ -7426,7 +7426,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-console-api"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "arc-swap",
@@ -7462,7 +7462,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-engine"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "arc-swap",
@@ -7517,7 +7517,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-fts"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "bitpacking",
@@ -7544,7 +7544,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-logs"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "byteorder",
@@ -7562,7 +7562,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-mcp"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "reqwest",
@@ -7576,7 +7576,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-query"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "base64 0.22.1",
@@ -7591,7 +7591,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-rerank"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "reqwest",
  "serde",
@@ -7605,7 +7605,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-server"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "axum",
@@ -7654,7 +7654,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-storage"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "arc-swap",
@@ -7687,7 +7687,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-vector"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "byteorder",
@@ -7705,7 +7705,7 @@ dependencies = [
 
 [[package]]
 name = "xerj-wasm"
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 dependencies = [
  "anyhow",
  "bytes",
```

**File**: `engine/Cargo.toml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ members = [
 ]
 
 [workspace.package]
-version = "1.0.0-rc.81"
+version = "1.0.0-rc.82"
 edition = "2021"
 license = "Apache-2.0"
 authors = ["xerj Contributors"]
```

**File**: `landing/index.html` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@
   <a href="/docs/recipes/">RECIPES</a>
   <a href="/playground">DASHBOARDS</a>
   <a href="https://github.com/xerj-org/xerj" rel="external">GITHUB</a>
-  <a class="nav-dl" href="https://github.com/xerj-org/xerj/releases/latest" rel="external" title="Download the latest XERJ release">↓ <span data-latest-tag>v1.0.0-rc.81</span></a>
+  <a class="nav-dl" href="https://github.com/xerj-org/xerj/releases/latest" rel="external" title="Download the latest XERJ release">↓ <span data-latest-tag>v1.0.0-rc.82</span></a>
   <span class="theme">
     <button type="button" data-theme="day" class="active">DAY</button>
     <span class="dash">·</span>
```

**File**: `landing/sitemap.xml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
   <url>
     <loc>https://xerj.org/</loc>
-    <lastmod>2026-10-03</lastmod>
+    <lastmod>2026-10-05</lastmod>
   </url>
   <url>
     <loc>https://xerj.org/agent-search/</loc>
```

---

### Incident Patch 12: `64974a1c` (2026-10-05)
**Commit Message**: fix(xccode): send k on the semantic clause so the vector leg gets the fetch window (#1145)

semantic_body and hybrid_body sent no `k` on the `semantic` clause, so
the parser default (10, xerj-query/src/parser.rs:2915) applied and the
engine cut the vector pool to 10 whatever `size` said. Two symptoms:

- `xerj code --mode semantic -k N` returned at most 10 hits for N > 10.
- `--mode hybrid` fused BM25@size with vector@10. Since #1137 the
  request size is diversity_fetch(k) = 50 at the default -k 5, so the
  overfetch widened the BM25 leg alone and the fused tail past rank 10
  was BM25-only.

Repro on v1.0.0-rc.81 (issue #1145, steps 3-5): semantic size=20 with
no k -> 10 hits, with "k":20 -> 20; hybrid with an empty BM25 leg ->
10 hits, with "k":20 -> 20.

Fix: put "k": <fetch window> on the semantic clause in both bodies, the
same window as `size`. The engine-side default proposed in the #1145
comment (an omitted vector-leg k defaulting to the hybrid executor's
per_query_topk, which would also cover MCP xerj_hybrid_search and the
catalog's suggested query) is left to the maintainers.

Test: the_vector_leg_carries_the_fetch_window_as_k, watched failing
before the fix (left: None,

**File**: `engine/crates/xerj-common/src/xccode/mod.rs` (modified, +30/-2)
```diff
@@ -515,8 +515,11 @@ pub(crate) fn bm25_body(query: &str, k: usize, lang: &Option<String>, fields: &[
 
 /// The vector-only body. Aimed ONLY at indices whose `body` is semantic_text
 /// (a semantic query against plain text 400s the whole wildcard).
+///
+/// The clause carries `k` = the fetch window: without it the parser cuts the
+/// vector pool to 10 whatever `size` says (#1145).
 pub(crate) fn semantic_body(query: &str, k: usize, lang: &Option<String>) -> Value {
-    let q = serde_json::json!({ "semantic": { "field": "body", "query": query } });
+    let q = serde_json::json!({ "semantic": { "field": "body", "query": query, "k": k } });
     let query = match lang {
         Some(lg) => serde_json::json!({
             "bool": { "must": [q, { "match": { "language": lg } }] }
@@ -549,8 +552,11 @@ pub(crate) fn hybrid_body(
     let bm = wrap(serde_json::json!({
         "multi_match": { "query": query, "fields": fields }
     }));
+    // `k` on the semantic clause: the vector leg's pool is cut to its own
+    // `k` (parser default 10), not to `size`, so without it the #1137
+    // overfetch widens the BM25 leg alone (#1145).
     let sem = wrap(serde_json::json!({
-        "semantic": { "field": "body", "query": query }
+        "semantic": { "field": "body", "query": query, "k": k }
     }));
     serde_json::json!({
         "size": k,
@@ -876,6 +882,28 @@ mod tests {
         );
     }
 
+    /// #1145: a `semantic` clause without `k` is cut to the parser default
+    /// (10), so the vector leg must carry the same window as `size` — else
+    /// `--mode semantic -k 20` returns 10 hits and hybrid fuses BM25@50 with
+    /// vector@10 (the #1137 overfetch widened the BM25 leg alone).
+    #[test]
+    fn the_vector_leg_carries_the_fetch_window_as_k() {
+        let sem = semantic_body("q", 50, &None);
+        assert_eq!(sem.pointer("/size"), Some(&serde_json::json!(50)));
+        assert_eq!(
+            sem.pointer("/query/semantic/k"),
+            Some(&serde_json::json!(50))
+        );
+
+        let fields = vec!["body".to_string()];
+        let hy = hybrid_body("q", 50, &None, &fields);
+        assert_eq!(
+            hy.pointer("/query/hybrid/queries/1/query/semantic/k"),
+            Some(&serde_json::json!(50)),
+            "{hy}"
+        );
+    }
+
     #[test]
     fn hybrid_without_a_capable_index_degrades_to_bm25_and_says_so() {
         let root = root_with_state();
```

---

### Incident Patch 13: `c90383b9` (2026-10-05)
**Commit Message**: Merge pull request #1131 from thomas-villani/fix/odf-export-advice

fix(autoindex): tell .odp owners to save as .pptx, not export to PDF

**File**: `engine/crates/xerj-autoindex/src/sniff.rs` (modified, +10/-1)
```diff
@@ -1130,7 +1130,7 @@ pub fn unsupported_document_advice(binary_kind: &str) -> Option<String> {
         "xlsb" => ("Excel binary workbook", "save it as .xlsx"),
         "odt" => ("OpenDocument text", "export it as DOCX or PDF"),
         "ods" => ("OpenDocument spreadsheet", "save it as .xlsx"),
-        "odp" => ("OpenDocument presentation", "export it as PDF"),
+        "odp" => ("OpenDocument presentation", "save it as .pptx"),
         "epub" => ("EPUB e-book", "convert it to PDF"),
         _ => return None,
     };
@@ -4282,6 +4282,15 @@ mod zip_container_sniff_tests {
         assert!(unsupported_document_advice("xlsb")
             .unwrap()
             .contains("Excel binary workbook"));
+        // The hint names the format autoindex extracts best for that kind of
+        // document: a presentation saved as .pptx keeps one record per slide,
+        // which a PDF export also gives but without the slide titles and notes.
+        assert!(unsupported_document_advice("ods")
+            .unwrap()
+            .contains(".xlsx"));
+        assert!(unsupported_document_advice("odp")
+            .unwrap()
+            .contains(".pptx"));
         for k in ["zip", "tar", "png", "docx", "pptx", "xlsx", "unknown", ""] {
             assert_eq!(unsupported_document_advice(k), None, "{k}");
         }
```

---

### Incident Patch 14: `53f9793a` (2026-10-04)
**Commit Message**: skill: domain rows for night-2 live corpora (fda-food-code, mutcd, uk-building-regs, eurlex-core, ada-2010) (#1150)

Five corpora flipped live on the hub tonight (87 live), each G7
graded with pre-registered suites. Table one-liners match the hub
manifests' scope notes exactly - uk-building-regs is the SI 2010/2214
per-provision mirror (not the Approved Documents), eurlex-core is the
five digital-regulation acts per-article/recital (not the treaties).

**File**: `tools/xerj-code/SKILL.md` (modified, +5/-0)
```diff
@@ -108,6 +108,11 @@ project's domain, not by size:
 | accessible UI components | `govuk-design-system` | GOV.UK component options and accessibility criteria — the exact option semantics (maxwords vs maxlength, divider text, focus-on-load) |
 | pharma / drug labels | `dailymed` | FDA label sections: indications, contraindications, administration timing |
 | clinical treatment guidance | `cdc-clinical` | CDC STI treatment regimens and doses, syphilis desensitization, measles clinical signs |
+| food-service safety | `fda-food-code` | FDA Food Code 2022 provisions: hand-contact surfaces, Time as a Public Health Control, date marking, bare-hand readiness |
+| traffic control devices | `mutcd` | FHWA MUTCD 11th Ed (Rev 1): sign and signal warrants, markings, work-zone typical applications |
+| building works (England) | `uk-building-regs` | Building Regulations 2010 (SI 2010/2214) per-provision: Parts A–P requirements, Wales variants labelled, 44ZB/44ZC dual numbering documented |
+| EU digital regulation | `eurlex-core` | GDPR, AI Act, DSA, DMA, NIS2 per-article and per-recital from the EUR-Lex Cellar (annexes excluded by design) |
+| accessibility (built environment) | `ada-2010` | ADA 2010 Standards: reach ranges, clear floor space, slope ratios, per-section |
 
 Three rules that keep the choice honest:
 
```

---

### Incident Patch 15: `37bc931e` (2026-10-04)
**Commit Message**: Merge pull request #1144 from xerj-org/fix/autoindex-markdown-sniff-guards

fix(autoindex): markdown with YAML-shaped headers or HTML prefixes is Txt, not Yaml/Xml

**File**: `engine/crates/xerj-autoindex/src/sniff.rs` (modified, +164/-2)
```diff
@@ -1262,7 +1262,16 @@ fn classify_text(text: &str, nonblank: &[&str]) -> Family {
             }
         }
     }
-    if leads_with_marker || yaml_line_ratio(nonblank) >= 0.6 {
+    // #1142: `yaml_line_ratio` counts `Label:` prose headers and `- ` bullets
+    // as YAML evidence, so "labeled prose" — a short `id:`/`title:` header
+    // followed by `Statement:`/`Guidance:` paragraphs, the shape of every
+    // NIST/OSCAL control file — scores ~0.7, went to the YAML extractor, and
+    // was junk-filed (measured: 400 of 722 files in one corpus silently never
+    // indexed). The discriminator the frontmatter branch already uses applies
+    // here too: labeled prose does not parse as a YAML stream, a real
+    // key:value mapping does. The parse only runs for files the line tier
+    // already judged YAML-majority, and on the sniff prefix.
+    if leads_with_marker || (yaml_line_ratio(nonblank) >= 0.6 && parses_as_yaml_stream(text)) {
         return Family::Yaml;
     }
 
@@ -1424,12 +1433,23 @@ fn classify_structured(text: &str, nonblank: &[&str]) -> Option<Family> {
     if head_lc.contains("<!doctype html") || head_lc.contains("<html") {
         return Some(Family::Html);
     }
-    if head_lc.contains("<?xml") || (trimmed.starts_with('<') && text.contains("</")) {
+    let xml_decl = head_lc.contains("<?xml");
+    if xml_decl || (trimmed.starts_with('<') && text.contains("</")) {
         // xhtml disguised as xml?
         let lc: String = text.to_lowercase();
         if lc.contains("<html") || lc.contains("<body") {
             return Some(Family::Html);
         }
+        // #1142: markdown that merely OPENS with an HTML fragment — a Hugo
+        // `<!--- … --->` front-matter comment, an `<a name="…"></a>` anchor, a
+        // floated `<div>` — took the XML branch here, and the XML extractor
+        // junk-filed the not-well-formed document (whole chapters and every
+        // `*-spans.md` convention page of one corpus). A whole-file markdown
+        // signature outranks the leading `<`; only declared-`<?xml` documents
+        // are exempt, so XML with embedded markdown CDATA keeps its family.
+        if !xml_decl && markdown_signature(nonblank) {
+            return None;
+        }
         return Some(Family::Xml);
     }
 
@@ -1493,6 +1513,43 @@ fn yaml_like_count(lines: &[&str]) -> usize {
         .count()
 }
 
+/// #1142: does this text carry a whole-file markdown signature — at least one
+/// ATX heading plus three further markdown marker lines (list items, table
+/// rows, fences, links/images)? Used only to keep markdown that opens with an
+/// HTML fragment out of the XML family, whose extractor junk-files
+/// not-well-formed documents. Real XML/HTML documents carry no ATX headings,
+/// so the pairing is one-sided on purpose. Measured on the corpus that exposed
+/// the defect: `cover.md` 2 headings + 13 markers, `sec5_authenticators.md`
+/// 77 markers, semconv `http-spans.md` 83 — all junked as XML before, all
+/// text afterwards.
+fn markdown_signature(nonblank: &[&str]) -> bool {
+    let atx = |t: &str| {
+        let hashes = t.chars().take_while(|c| *c == '#').count();
+        (1..=6).contains(&hashes)
+            && t[hashes..].starts_with(' ')
+            && !t[hashes + 1..].trim().is_empty()
+    };
+    let mut has_heading = false;
+    let mut markers = 0usize;
+    for l in nonblank {
+        let t = l.trim_start();
+        if atx(t) {
+            has_heading = true;
+            continue;
+        }
+        let marker = t.starts_with("- ")
+            || t.starts_with("* ")
+            || t.starts_with("+ ")
+            || t.starts_with('|')
+            || t.starts_with("```")
+            || t.contains("](");
+        if marker {
+            markers += 1;
+        }
+    }
+    has_heading && markers >= 3
+}
+
 /// Does `text` parse as a YAML stream of structured documents — i.e. was the
 /// `---` a *document separator* in a multi-document stream rather than the
 /// closing fence of a markdown frontmatter block?
@@ -3455,6 +3512,111 @@ mod tests {
         );
     }
 
+    /// #1142 class 1: markdown opening with an HTML fragment (Hugo front-matter
+    /// comment, anchor) must NOT take the XML family — the XML extractor
+    /// junk-files the not-well-formed document. This is the semconv
+    /// `http-spans.md` / `database-spans.md` shape (every `*-spans.md`
+    /// convention page was silently unindexed).
+    #[test]
+    fn markdown_with_leading_html_fragment_stays_text() {
+        let hugo = "<!--- Hugo front matter used to generate the website version of this page:\n\
+                    linkTitle: Spans\n--->\n\n\
+                    # Semantic conventions for HTTP spans\n\n\
+                    **Status**: [Stable][DocumentStatus]\n\n\
+                    - one\n- two\n- three\n\n\
+                    | a | b |\n|---|---|\n| 1 | 2 |\n";
+        assert!(
+            matches!(classify(hugo), Family::TxtProse | F
```

#### Recent Merged Pull Requests:
- **PR #1167** (2026-10-06): docs(llms): the hub counts went stale — 75 live / 104 rows was 2026-10-02 (@xerj-org)
- **PR #1166** (2026-10-06): hub: 5 contributor-permission corpus candidates (76 sources) (@xerj-org)
- **PR #1165** (2026-10-06): release: v1.0.0-rc.83 — the corpus-hub hundred (@xerj-org)
- **PR #1164** (2026-10-05): docs(xerj-code): the hundred — every live corpus in the skill's domain table (@xerj-org)
- **PR #1162** (2026-10-05): feat(autoindex): extract Jupyter notebooks per heading section; name Parquet/Arrow/NumPy/HDF5/pickle files with an export hint (maintainer rebase of #1161) (@xerj-org)
- **PR #1161** (closed): feat(autoindex): Jupyter notebooks as heading sections; name Parquet/Arrow/NumPy/HDF5/pickle files with an export hint (@thomas-villani)
- **PR #1160** (2026-10-05): fix(autoindex): don't emit a section that the next one repeats whole (@thomas-villani)
- **PR #1159** (2026-10-05): feat(autoindex): extract EPUB books, one record per chapter in reading order (@thomas-villani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
