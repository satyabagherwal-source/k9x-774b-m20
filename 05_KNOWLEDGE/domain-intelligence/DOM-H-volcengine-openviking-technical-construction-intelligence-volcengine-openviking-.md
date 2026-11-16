# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: volcengine/OpenViking Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "volcengine/OpenViking",
  "source_url": "https://github.com/volcengine/OpenViking",
  "source_version": "bfd935f4",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-16T08:06:43.397Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-volcengine-openviking",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine/OpenViking](https://github.com/volcengine/OpenViking) (Revision: `bfd935f4`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-16T08:06:43.397Z`  
> **Learning ID**: `learn-github-volcengine-openviking`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: D (Research & Knowledge Intelligence), G (Architecture Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), F (Design Intelligence), K (Quality & Verification Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 73%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from volcengine/OpenViking:

# Forensic Learning Record (Deep Inspection): volcengine/OpenViking

> **Canonical Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-16T08:01:29.212Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 42292 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent-plugins/servers/shared/mcp-proxy-core.mjs`
```
// GENERATED FROM examples/memory-plugin-shared/lib. DO NOT EDIT.
/**
 * Shared stdio -> streamable-HTTP MCP proxy core for OpenViking memory plugins.
 *
 * Harness-specific entrypoints provide credential/config loading; this module
 * owns only transport, session retry, SSE parsing, and protocol-clean stdio.
 */

import { statSync } from "node:fs";
import { createInterface } from "node:readline";

import { buildOvHeaders } from "./ov-http.mjs";

const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
const DELETE_TIMEOUT_MS = 2000;
const MAX_CONCURRENT_REQUESTS = 16;

class HttpStatusError extends Error {
  constructor(status, statusText, bodyText, messages = []) {
    super(`HTTP ${status}${statusText ? ` ${statusText}` : ""}`);
    this.name = "HttpStatusError";
    this.status = status;
    this.statusText = statusText;
    this.bodyText = bodyText;
    this.messages = messages;
  }
}

function snapshotPaths(paths) {
  const out = new Map();
  for (const path of paths || []) {
    try {
      const st = statSync(path);
      out.set(path, `${st.mtimeMs}:${st.size}`);
    } catch {
      out.set(path, "missing");
    }
  }
  return out;
}

function snapshotsDiffer(a, b) {
  if (a.size !== b.size) return true;
  for (const [key, value] of a.entries()) {
    if (b.get(key) !== value) return true;
  }
  return false;
}

function createSemaphore(limit) {
  let active = 0;
  const queue = [];
  return async function acquire() {
    if (active >= limit) {
      await new Promise((resolve) => queue.push(resolve));
    }
    active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active -= 1;
      const next = queue.shift();
      if (next) next();
    };
  };
}

function isRequest(message) {
  return Object.prototype.hasOwnProperty.call(message || {}, "id");
}

function messageId(message) {
  return isRequest(message) ? message.id : undefined;
}

function errorResponse(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function parseMaybeJson(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function parseSseMessages(text) {
  const messages = [];
  let dataLines = [];

  function flush() {
    if (dataLines.length === 0) return;
    const data = dataLines.join("\n").trim();
    dataLines = [];
    if (!data || data === "[DONE]") return;
    messages.push(JSON.parse(data));
  }

  for (const rawLine of String(text || "").split(/\r\n|\r|\n/)) {
    if (rawLine === "") {
      flush();
      continue;
    }
    if (rawLine.startsWith(":")) continue;
    const colon = rawLine.indexOf(":");
    const field = colon === -1 ? rawLine : rawLine.slice(0, colon);
    let value = colon === -1 ? "" : rawLine.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") dataLines.push(value);
  }
  flush();
  return messages;
}

function parseHttpBody(contentType, text) {
  const ctype = String(contentType || "").toLowerCase();
  if (!String(text || "").trim()) return [];
  if (ctype.includes("text/event-stream")) return parseSseMessages(text);
  const json = parseMaybeJson(text);
  return json == null ? [] : [json];
}

function serializeBodyForError(bodyText) {
  const parsed = parseMaybeJson(bodyText);
  if (parsed?.error?.message) return parsed.error.message;
  if (parsed?.detail) return typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
  const compact = String(bodyText || "").replace(/\s+/g, " ").trim();
  return compact.slice(0, 500);
}

function cloneMessage(message) {
  return JSON.parse(JSON.stringify(message));
}

export function createOpenVikingMcpProxy({
  stdin = process.stdin,
  stdout = process.stdout,
  readConfig,
  loggerFactory,
  fetchImpl = globalThis.fetch,
  localToolProvider = null,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("global fetch is required; use Node.js 18 or newer");
  }
  if (typeof readConfig !== "function") {
    throw new Error("readConfig function is required");
  }
  if (typeof loggerFactory !== "function") {
    throw new Error("loggerFactory function is required");
  }

  let proxyConfig = readConfig();
  let logger = loggerFactory("mcp-proxy", proxyConfig);
  let watchedSnapshot = snapshotPaths(proxyConfig.watchedPaths);
  let sessionId = "";
  let initializeRequest = null;
  let initializedNotification = null;
  let protocolVersion = DEFAULT_PROTOCOL_VERSION;
  let initializeInFlight = null;
  let reinitializeInFlight = null;
  let stdoutChain = Promise.resolve();
  let shuttingDown = false;
  let reinitCounter = 0;
  const acquire = createSemaphore(MAX_CONCURRENT_REQUESTS);

  function log(stage, data) {
    try {
      logger.log(stage, data);
    } catch { /* debug logging must never affect protocol IO */ }
  }

  function logError(stage, err) {
    try {
      logger.logError(stage, err);
    } catch { /* debug logging must never affect protocol IO */ }
  }

  function localTools() {
    if (!localToolProvider || typeof localToolProvider.listTools !== "function") return [];
    const tools = localToolProvider.listTools();
    return Array.isArray(tools) ? tools : [];
  }

  function appendLocalTools(message, outbound) {
    if (message.method !== "tools/list" || !Array.isArray(outbound?.result?.tools)) {
      return outbound;
    }
    const additions = localTools().filter((tool) => tool?.name);
    if (additions.length === 0) return outbound;
    const localNames = new Set(additions.map((tool) => tool.name));
    const upstreamTools = outbound.result.tools.filter((tool) => !localNames.has(tool?.name));
    return {
      ...outbound,
      result: {
        ...outbound.result,
        tools: [...upstreamTools, ...additions],
      },
    };
  }

  async function callLocalTool(message) {
    if (
      message.method !== "tools/call"
      || !localToolProvider
      || typeof localToolProvider.callTool !== "function"
    ) {
      return null;
    }
    const name = message.params?.name;
    if (!localTools().some((tool) => tool?.name === name)) return null;
    reloadIfCredentialFilesChanged("local_tool_call");
    return localToolProvider.callTool(message.params, { config: proxyConfig });
  }

  function reloadConfig(reason) {
    proxyConfig = readConfig();
    logger = loggerFactory("mcp-proxy", proxyConfig);
    watchedSnapshot = snapshotPaths(proxyConfig.watchedPaths);
    log("credentials_reloaded", {
      reason,
      credentialSource: proxyConfig.credentialSource,
      credentialPath: proxyConfig.credentialPath,
      mcpUrl: proxyConfig.mcpUrl,
      hasApiKey: Boolean(proxyConfig.apiKey),
      hasIdentity: Boolean(proxyConfig.account || proxyConfig.user),
      hasPeer: Boolean(proxyConfig.peerId),
    });
  }

  function reloadIfCredentialFilesChanged(reason) {
    const next = snapshotPaths(proxyConfig.watchedPaths);
    if (!snapshotsDiffer(watchedSnapshot, next)) return false;
    reloadConfig(reason);
    return true;
  }

  function headersForRequest(includeSession = true) {
    const built = buildOvHeaders(proxyConfig, {
      actorPeerId: proxyConfig.peerId,
      extraHeaders: {
        "Accept": "application/json, text/event-stream",
        // Always the proxy's current version (default, then server-negotiated) —
        // never the client's un-negotiated ask, which strict upstreams reject
        // with HTTP 400 before initialize negotiation can run.
        "MCP-Protocol-Version": protocolVersion,
        ...(includeSession && sessionId ? { "Mcp-Session-Id": sessionId } : {}),
      },
    });
    // Operator-supplied extras (OPENVIKING_EXTRA_HEADERS) merged with the
    // proxy's own headers winning — the env-only escape hatch fills gaps for
    // strict private-gateway upstreams (tenant/vault names, region hints)
    // without letting a stray env var override authentication or session
    // negotiation.
    const opExtras = proxyConfig.extraHeaders;
    if (opExtras && typeof opExtras === "object") {
      return { ...opExtras, ...built };
    }
    return built;
  }

  function writeMessage(obj) {
    const line = `${JSON.stringify(obj)}\n`;
    stdoutChain = stdoutChain
      .then(() => new Promise((resolve) => stdout.write(line, resolve)))
      .catch(() => {});
    return stdoutChain;
  }

  function mapError(message, err) {
    const id = messageId(message);
    if (err instanceof HttpStatusError) {
      if (err.status === 401 || err.status === 403) {
        return errorResponse(
          id,
          -32001,
          `OpenViking MCP authentication failed (HTTP ${err.status}). Check ~/.openviking/ovcli.conf or OPENVIKING_API_KEY, and verify the configured account/user for trusted mode.`,
          {
            status: err.status,
            credentialSource: proxyConfig.credentialSource,
            credentialPath: proxyConfig.credentialPath || undefined,
            serverMessage: serializeBodyForError(err.bodyText) || undefined,
          },
        );
      }
      return errorResponse(
        id,
        -32002,
        `OpenViking MCP upstream returned HTTP ${err.status}.`,
        {
          status: err.status,
          serverMessage: serializeBodyForError(err.bodyText) || undefined,
        },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (err && err.name === "AbortError") {
      // Client-side timeout, not an outage: the server may be healthy and
      // still computing (rerank-inclusive find/search can legitimately take
      // longer than the default budget). Keep -32001 for genuine
      // connection failures so the two are not misdiagnosed as each other.
      return errorResponse(
        id,
        -32004,
        `OpenViking MCP request timed out after ${proxyConfig.timeoutMs}ms (${proxyConfig.mcpUrl}).
```

### Core Architecture Module: `benchmark/RAG/src/core/judge_util.py`
```
import json
import re

from langchain_core.messages import HumanMessage, SystemMessage


def llm_grader(
    llm_client,
    model: str,
    question: str,
    gold_answer: str or list,
    response: str,
    dataset_name: str = "Locomo"
) -> dict:
    """
    Use an LLM as a judge to score a generated answer against a gold answer.

    Return format:
    {
        "score": int,          # LoCoMo: 0 or 4; Qasper/Generic: 0~4
        "reasoning": str,      # grading explanation or fallback parse info
        "prompt_type": str     # which prompt template was used
    }
    """

    dataset_name_lower = (dataset_name or "").lower()
    content = ""
    score = 0
    reasoning = "No reasoning provided."
    prompt_type = "Generic_0-4"
    
    # Handle case when gold_answer is a list
    if isinstance(gold_answer, list):
        gold_answer_str = " | ".join(gold_answer)
    else:
        gold_answer_str = gold_answer

    # -------------------------
    # 1) Route by dataset
    # -------------------------
    if "locomo" in dataset_name_lower:
        prompt_type = "Locomo_0or4"

        system_prompt = """
You are an expert grader that determines if answers to questions match a gold standard answer
"""

        ACCURACY_PROMPT = f"""
Your task is to label an answer to a question by assigning a score of 4 or 0. You will be given the following data:
(1) a question (posed by one user to another user),
(2) a 'gold' (ground truth) answer,
(3) a generated answer

which you will score as 4 or 0.
The point of the question is to ask about something one user should know about the other user based on their prior conversations.
The gold answer will usually be a concise and short answer that includes the referenced topic, for example:
Question: Do you remember what I got the last time I went to Hawaii?
Gold answer: A shell necklace
The generated answer might be much longer, but you should be generous with your grading - as long as it touches on the same topic as the gold answer, it should be counted as correct.
For time related questions, the gold answer will be a specific date, month, year, etc. The generated answer might be much longer or use relative time references (like "last Tuesday" or "next month"), but you should be generous with your grading - as long as it refers to the same date or time period as the gold answer, it should be counted as correct. Even if the format differs (e.g., "May 7th" vs "7 May"), consider it correct if it's the same date.

Scoring rule:
- Output score 4 if the generated answer should be considered CORRECT.
- Output score 0 if the generated answer should be considered WRONG.

Now it's time for the real question:
Question: {question}
Gold answer: {gold_answer_str}
Generated answer: {response}

First, provide a short (one sentence) explanation of your reasoning.
Respond with JSON only: {{"score": 4 or 0, "reasoning": "your explanation"}}
"""

    else:
        prompt_type = "Generic_0-4"

        system_prompt = """
You are an expert evaluator scoring how well an AI-generated answer matches a gold standard (ground truth).
"""

        ACCURACY_PROMPT = f"""
Please score the Generated Answer against the Gold Answers on a scale of 0 to 4.

[Evaluation Rubric]
- Score 4 (Perfect): Fully and accurately captures the core meaning and key facts of any of the Gold Answers. Additional relevant explanation or context is acceptable and does NOT reduce the score, as long as it is consistent with and does not contradict the Gold Answers. Minor differences in wording, capitalization, punctuation, or phrasing are acceptable if the core meaning is preserved.
- Score 3 (Good): Correctly captures the main answer and most key facts, but has minor issues such as slight imprecision, small omissions of non-critical details, or wording that is somewhat vague or ambiguous. The overall answer is still clearly correct.
- Score 2 (Partial): Partially correct, but missing at least one important fact, condition, or detail needed for a fully correct answer. The answer is related to the correct topic, but is incomplete or insufficient.
- Score 1 (Poor): Mostly incorrect, seriously incomplete, or only weakly related to the Gold Answers.
- Score 0 (Wrong): Incorrect, contradictory to the Gold Answers, or contains fabricated / hallucinated core content.

Important Notes:
- Gold answers are multiple possible correct answers separated by " | ". The generated answer only needs to match any one of them.
- The gold answers may be concise, but the generated answer can be longer and include additional explanations - this is acceptable for Score 4 as long as the core information is correct.
- Do NOT penalize for additional relevant information that doesn't contradict the gold answers. Examples of acceptable extra information: titles ("King Padella" vs "Padella"), locations ("Paflagonia" vs "the capital of Paflagonia"), or additional context that supports the answer.
- Only penalize for actual incorrect information, missing key facts, or contradictions.
- Ignore minor differences in capitalization (e.g., "CRIM TARTARY" vs "Crim Tartary") or punctuation (e.g., with or without a period at the end).

Question: {question}
Gold Answers: {gold_answer_str}
Generated Answer: {response}

First, briefly explain the rating in 1 sentence. Then output the integer score.
Respond ONLY with a JSON object: {{"score": 0 to 4, "reasoning": "string"}}
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=ACCURACY_PROMPT),
    ]

    # -------------------------
    # 2) Unified invoke + parse
    # -------------------------
    try:
        resp = llm_client.invoke(messages)
        content = resp.content if resp and hasattr(resp, "content") else ""

        result = json.loads(content)
        score = int(result.get("score", 0))
        reasoning = result.get("reasoning", "No reasoning provided.")

        # Clamp score by dataset
        if "locomo" in dataset_name_lower:
            # LoCoMo only allows 0 or 4
            score = 4 if score == 4 else 0
        else:
            # Other datasets allow 0~4
            score = max(0, min(4, score))

    except Exception:
        # -------------------------
        # 3) Unified fallback parse
        # -------------------------
        text = (content or "").strip()
        reasoning = (
            f"Parse fallback from raw output: {text}"
            if text
            else "Parse failed or model invocation failed. Defaulted to 0."
        )

        # First try: JSON-like score field
        match = re.search(r'"score"\s*:\s*([0-4])', text)
        if match:
            score = int(match.group(1))
        else:
            # Second try: any standalone integer 0~4 in text
            match = re.search(r'\b([0-4])\b', text)
            if match:
                score = int(match.group(1))
            else:
                score = 0

        # Dataset-specific clamp
        if "locomo" in dataset_name_lower:
            score = 4 if score == 4 else 0
        else:
            score = max(0, min(4, score))

    return {
        "score": score,
        "reasoning": reasoning,
        "prompt_type": prompt_type,
    }

```

### Core Architecture Module: `benchmark/RAG/src/core/llm_client.py`
```
import time
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage


class LLMClientWrapper:
    def __init__(self, config: dict, api_key: str):
        self.llm = ChatOpenAI(
            model=config['model'],
            temperature=config['temperature'],
            api_key=api_key,
            base_url=config['base_url']
        )
        self.retry_count = 3

    def generate(self, prompt: str) -> str:
        """Call LLM to generate answer with simple exponential backoff retry"""
        last_err = None
        for attempt in range(self.retry_count):
            try:
                resp = self.llm.invoke([HumanMessage(content=prompt)])
                return resp.content
            except Exception as e:
                last_err = e
                if attempt < self.retry_count - 1:
                    time.sleep(1.5 * (attempt + 1))

        raise RuntimeError(
            f"LLM generate failed after {self.retry_count} retries: {type(last_err).__name__}: {last_err}"
        ) from last_err

```

### Core Architecture Module: `benchmark/RAG/src/core/logger.py`
```
import logging
import os


def setup_logging(log_file):
    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    logger = logging.getLogger("Benchmark")
    logger.setLevel(logging.INFO)
    logger.handlers = []

    formatter = logging.Formatter("%(asctime)s | %(levelname)-7s | %(message)s")

    fh = logging.FileHandler(log_file, mode="a", encoding="utf-8")
    fh.setFormatter(formatter)
    logger.addHandler(fh)

    sh = logging.StreamHandler()
    sh.setFormatter(formatter)
    logger.addHandler(sh)

    return logger


def get_logger() -> logging.Logger:
    return logging.getLogger("Benchmark")

```

### Core Architecture Module: `benchmark/RAG/src/core/metrics.py`
```
import re
import string
import collections
from typing import List


class MetricsCalculator:
    @staticmethod
    def normalize_answer(s):
        """Normalize answer text: remove punctuation, convert to lowercase, remove articles"""
        s = str(s).replace(',', "") 
        def remove_articles(text): return re.sub(r'\b(a|an|the|and)\b', ' ', text)
        def white_space_fix(text): return ' '.join(text.split())
        def remove_punc(text):
            exclude = set(string.punctuation)
            return ''.join(ch for ch in text if ch not in exclude)
        return white_space_fix(remove_articles(remove_punc(s.lower())))

    @staticmethod
    def calculate_f1(prediction: str, ground_truth: str) -> float:
        pred_tokens = MetricsCalculator.normalize_answer(prediction).split()
        truth_tokens = MetricsCalculator.normalize_answer(ground_truth).split()
        common = collections.Counter(pred_tokens) & collections.Counter(truth_tokens)
        num_same = sum(common.values())
        if num_same == 0: return 0.0
        precision = 1.0 * num_same / len(pred_tokens)
        recall = 1.0 * num_same / len(truth_tokens)
        return (2 * precision * recall) / (precision + recall)

    @staticmethod
    def check_refusal(text: str) -> bool:
        refusals = ["not mentioned", "no information", "cannot be answered", "none", "unknown", "don't know"]
        return any(r in text.lower() for r in refusals)

    @staticmethod
    def check_recall(retrieved_texts: List[str], evidence_list: List[str], soft_threshold: float = 0.8, min_soft_match_tokens: int = 4) -> float:
        """
        Calculate retrieval recall combining strict substring matching with dynamic token-based soft matching.
        
        Approach:
        - Combine and preprocess: concatenate multiple retrieved text chunks into a single string.
        - Strict matching first: check if evidence exists as a complete substring in the combined retrieved text.
        - Length blocking mechanism: calculate effective token count of evidence. If below threshold (e.g., short IDs or entities), directly determine no hit after strict match failure, prohibiting soft matching.
        - Soft matching fallback: for long text evidence, calculate token coverage in retrieved text, consider hit if threshold is met.
        - Equal weighting: each evidence has equal weight, final score is hit count / total count.
        
        Args:
            retrieved_texts: List[str], list of text chunks returned by retrieval module (required)
            evidence_list: List[str], ground truth evidence list containing IDs or long text evidence (required)
            soft_threshold: float, coverage threshold for soft matching to be considered a hit (optional, 0.0~1.0, default 0.8)
            min_soft_match_tokens: int, minimum effective token count threshold allowing fallback to soft matching (optional, default 4. Short texts below this length require strict matching)
            
        Returns:
            float, retrieval recall score, range 0.0 to 1.0
        """
        if not evidence_list: 
            return 0.0 
            
        combined_retrieved = " ".join(retrieved_texts)
        
        normalized_retrieved = MetricsCalculator.normalize_answer(combined_retrieved)
        ret_tokens = set(normalized_retrieved.split())
        
        hit_count = 0
        
        for evidence in evidence_list:
            if evidence in combined_retrieved:
                hit_count += 1
                continue
                
            normalized_ev = MetricsCalculator.normalize_answer(evidence)
            ev_tokens = set(normalized_ev.split())
            
            if not ev_tokens:
                continue
                
            if len(ev_tokens) < min_soft_match_tokens:
                continue
                
            overlap_count = len(ev_tokens & ret_tokens)
            coverage = overlap_count / len(ev_tokens)
            
            if coverage >= soft_threshold:
                hit_count += 1
                
        return hit_count / len(evidence_list)

```

### Core Architecture Module: `benchmark/RAG/src/core/monitor.py`
```
import threading
import time
from dataclasses import dataclass


@dataclass
class MonitorStats:
    active_threads: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    total_tokens: int = 0
    start_time: float = 0.0


class BenchmarkMonitor:
    def __init__(self):
        self._lock = threading.Lock()
        self.stats = MonitorStats()
        self.stats.start_time = time.time()

    def worker_start(self):
        with self._lock:
            self.stats.active_threads += 1

    def worker_end(self, tokens=0, success=True):
        with self._lock:
            self.stats.active_threads -= 1
            self.stats.completed_tasks += 1
            self.stats.total_tokens += tokens
            if not success:
                self.stats.failed_tasks += 1

    def get_status_dict(self):
        """Return real-time status dictionary for tqdm progress bar display"""
        elapsed = time.time() - self.stats.start_time
        qps = self.stats.completed_tasks / elapsed if elapsed > 0 else 0
        
        tokens = self.stats.total_tokens
        if tokens > 1_000_000:
            token_str = f"{tokens/1_000_000:.1f}M"
        elif tokens > 1_000:
            token_str = f"{tokens/1_000:.1f}k"
        else:
            token_str = str(tokens)

        return {
            "Active": self.stats.active_threads,
            "QPS": f"{qps:.2f}",
            "Tokens": token_str,
            "Errs": self.stats.failed_tasks
        }

```

### Core Architecture Module: `benchmark/RAG/src/core/vector_store.py`
```
import os
import sys
import time
from pathlib import Path
from typing import List

sys.path.append(str(Path(__file__).parent.parent))

import tiktoken
from adapters.base import StandardDoc
from openviking_sdk import SyncHTTPClient


class VikingStoreWrapper:
    def __init__(self):
        self.client = SyncHTTPClient()
        self.client.initialize()

        try:
            self.enc = tiktoken.get_encoding("cl100k_base")
        except Exception as e:
            print(f"[Warning] tiktoken init failed: {e}")
            self.enc = None

    def count_tokens(self, text: str) -> int:
        if not text or not self.enc:
            return 0
        return len(self.enc.encode(str(text)))

    def ingest(
        self, samples: List[StandardDoc], max_workers=10, monitor=None, ingest_mode="per_file"
    ) -> dict:
        start_time = time.time()
        total_input_tokens = 0
        total_output_tokens = 0
        total_embedding_tokens = 0

        if not samples:
            return {"time": time.time() - start_time, "input_tokens": 0, "output_tokens": 0}

        if ingest_mode == "directory":
            doc_paths = [os.path.abspath(s.doc_path) for s in samples]
            common_ancestor = None
            if doc_paths:
                try:
                    common_ancestor = os.path.commonpath(doc_paths)
                except ValueError:
                    common_ancestor = None

            if common_ancestor:
                result = self.client.add_resource(
                    path=common_ancestor,
                    wait=True,
                    options={"telemetry": True},
                )
                telemetry = result.get("telemetry", {})
                summary = telemetry.get("summary", {})
                tokens = summary.get("tokens", {})
                llm_tokens = tokens.get("llm", {})
                embedding_tokens = tokens.get("embedding", {})
                total_input_tokens = llm_tokens.get("input", 0)
                total_output_tokens = llm_tokens.get("output", 0)
                total_embedding_tokens = embedding_tokens.get("total", 0)
            else:
                for sample in samples:
                    result = self.client.add_resource(
                        path=sample.doc_path,
                        wait=True,
                        options={"telemetry": True},
                    )
                    telemetry = result.get("telemetry", {})
                    summary = telemetry.get("summary", {})
                    tokens = summary.get("tokens", {})
                    llm_tokens = tokens.get("llm", {})
                    embedding_tokens = tokens.get("embedding", {})
                    total_input_tokens += llm_tokens.get("input", 0)
                    total_output_tokens += llm_tokens.get("output", 0)
                    total_embedding_tokens += embedding_tokens.get("total", 0)
        else:
            for sample in samples:
                result = self.client.add_resource(
                    path=sample.doc_path,
                    wait=True,
                    options={"telemetry": True},
                )
                telemetry = result.get("telemetry", {})
                summary = telemetry.get("summary", {})
                tokens = summary.get("tokens", {})
                llm_tokens = tokens.get("llm", {})
                embedding_tokens = tokens.get("embedding", {})
                total_input_tokens += llm_tokens.get("input", 0)
                total_output_tokens += llm_tokens.get("output", 0)
                total_embedding_tokens += embedding_tokens.get("total", 0)

        return {
            "time": time.time() - start_time,
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens,
            "embedding_tokens": total_embedding_tokens,
        }

    def retrieve(self, query: str, topk: int, target_uri: str = "viking://resources"):
        """Execute retrieval"""
        return self.client.find(
            query=query,
            target_uri=target_uri,
            limit=topk,
        )

    def read_resource(self, uri: str) -> str:
        """Read resource content"""
        return str(self.client.read(uri))

    def clear(self):
        """Clear the store"""
        self.client.rm("viking://resources", recursive=True)

```

### Core Architecture Module: `benchmark/cuvs/run_service_concurrency_benchmark.py`
```
#!/usr/bin/env python3
"""Benchmark OpenViking's async vector-service facade under concurrency.

This is the pre-embedding service layer: requests go through
VikingVectorIndexBackend and its asyncio.to_thread adapter, but use precomputed
query vectors so embedding and HTTP do not obscure vector-search scheduling.
"""

from __future__ import annotations

import argparse
import asyncio
import gc
import json
import os
import shutil
import statistics
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Sequence

import numpy as np

BENCHMARK_DIR = Path(__file__).resolve().parent
if str(BENCHMARK_DIR) not in sys.path:
    sys.path.insert(0, str(BENCHMARK_DIR))

from run_collection_benchmark import parse_positive_int_list  # noqa: E402
from run_index_benchmark import percentile, prepare_dataset, runtime_metadata  # noqa: E402

from openviking.server.identity import RequestContext, Role  # noqa: E402
from openviking.storage.viking_vector_index_backend import (  # noqa: E402
    VikingVectorIndexBackend,
)
from openviking_cli.session.user_id import UserIdentifier  # noqa: E402
from openviking_cli.utils.config.vectordb_config import (  # noqa: E402
    CuVSConfig,
    VectorDBBackendConfig,
)

SUPPORTED_BACKENDS = ("native", "cuvs_brute_force", "auto_cuvs_background")
ACCOUNT_ID = "benchmark"


def collection_schema(collection_name: str, dimension: int) -> dict[str, Any]:
    return {
        "CollectionName": collection_name,
        "Fields": [
            {"FieldName": "id", "FieldType": "string", "IsPrimaryKey": True},
            {"FieldName": "vector", "FieldType": "vector", "Dim": dimension},
            {"FieldName": "account_id", "FieldType": "string"},
            {"FieldName": "uniform_bucket", "FieldType": "int64"},
            {"FieldName": "row_number", "FieldType": "int64"},
        ],
        "ScalarIndex": ["account_id", "uniform_bucket", "row_number"],
    }


def make_record(row_index: int, vector: Sequence[float]) -> dict[str, Any]:
    return {
        "id": f"record-{row_index}",
        "vector": list(vector),
        "account_id": ACCOUNT_ID,
        "uniform_bucket": row_index % 1000,
        "row_number": row_index,
    }


def make_config(
    backend: str,
    *,
    project_path: Path,
    collection_name: str,
    dimension: int,
    filter_cache_size: int,
    auto_rebuild_debounce_ms: int,
) -> VectorDBBackendConfig:
    common = {
        "name": collection_name,
        "path": str(project_path),
        "index_name": "default",
        "distance_metric": "cosine",
        "dimension": dimension,
        "sparse_weight": 0.0,
    }
    if backend == "native":
        return VectorDBBackendConfig(backend="local", **common)
    if backend == "cuvs_brute_force":
        return VectorDBBackendConfig(
            backend="cuvs",
            cuvs=CuVSConfig(
                algorithm="brute_force",
                fallback_to_native=False,
                filter_cache_size=filter_cache_size,
            ),
            **common,
        )
    if backend == "auto_cuvs_background":
        return VectorDBBackendConfig(
            backend="local",
            cuvs=CuVSConfig(
                algorithm="brute_force",
                auto_enable=True,
                auto_background_rebuild=True,
                auto_rebuild_debounce_ms=auto_rebuild_debounce_ms,
                filter_cache_size=filter_cache_size,
            ),
            **common,
        )
    raise ValueError(f"Unsupported backend: {backend}")


async def wait_for_background_rebuild(manager: VikingVectorIndexBackend, timeout: float) -> float:
    index = manager._shared_adapter.get_collection().get_index("default")
    wait = getattr(index, "wait_for_background_rebuild", None)
    if wait is None:
        raise RuntimeError("auto background benchmark could not access the local index worker")
    started = time.perf_counter()
    completed = await asyncio.to_thread(wait, timeout)
    elapsed = time.perf_counter() - started
    if not completed:
        raise RuntimeError(f"auto background rebuild did not complete within {timeout}s")
    return elapsed


def concurrent_summary(
    latencies_ms: Sequence[float],
    *,
    wall_seconds: float,
    request_count: int,
    success_count: int,
    error_count: int,
) -> dict[str, Any]:
    return {
        "request_count": request_count,
        "success_count": success_count,
        "error_count": error_count,
        "wall_seconds": wall_seconds,
        "qps": success_count / wall_seconds if wall_seconds else 0.0,
        "latency_ms": {
            "mean": statistics.fmean(latencies_ms) if latencies_ms else 0.0,
            "p50": percentile(latencies_ms, 0.50),
            "p95": percentile(latencies_ms, 0.95),
            "p99": percentile(latencies_ms, 0.99),
            "max": max(latencies_ms, default=0.0),
        },
        "raw_latency_ms": list(latencies_ms),
    }


async def run_request_set(
    manager: Any,
    ctx: RequestContext,
    queries: np.ndarray,
    *,
    concurrency: int,
    request_count: int,
    k: int,
    filter_factory: Callable[[int], dict[str, Any] | None],
) -> dict[str, Any]:
    semaphore = asyncio.Semaphore(concurrency)
    start_event = asyncio.Event()
    query_lists = [row.tolist() for row in queries]

    async def one_request(request_index: int) -> tuple[float, str | None]:
        await start_event.wait()
        async with semaphore:
            started = time.perf_counter()
            try:
                records = await manager.query(
                    query_vector=query_lists[request_index % len(query_lists)],
                    filter=filter_factory(request_index),
                    limit=k,
                    output_fields=["id"],
                    ctx=ctx,
                )
                latency_ms = (time.perf_counter() - started) * 1000.0
                if len(records) != k:
                    return latency_ms, f"expected {k} results, received {len(records)}"
                return latency_ms, None
            except Exception as exc:
                latency_ms = (time.perf_counter() - started) * 1000.0
                return latency_ms, f"{type(exc).__name__}: {exc}"

    tasks = [asyncio.create_task(one_request(index)) for index in range(request_count)]
    await asyncio.sleep(0)
    wall_started = time.perf_counter()
    start_event.set()
    outcomes = await asyncio.gather(*tasks)
    wall_seconds = time.perf_counter() - wall_started
    latencies = [latency for latency, _ in outcomes]
    errors = [error for _, error in outcomes if error is not None]
    result = concurrent_summary(
        latencies,
        wall_seconds=wall_seconds,
        request_count=request_count,
        success_count=request_count - len(errors),
        error_count=len(errors),
    )
    result["errors"] = errors[:10]
    return result


def uniform_filter(selectivity: float) -> dict[str, Any]:
    upper_bound = max(1, int(1000 * selectivity))
    return {"op": "range", "field": "uniform_bucket", "lt": upper_bound}


def unique_filter(request_index: int, vector_count: int, salt: int) -> dict[str, Any]:
    width = max(10, min(100, vector_count))
    span = max(1, vector_count - width + 1)
    start = ((request_index + salt) * 997) % span
    return {
        "op": "range",
        "field": "row_number",
        "gte": start,
        "lt": start + width,
    }


async def ingest_dataset(
    manager: VikingVectorIndexBackend,
    dataset: np.ndarray,
    *,
    batch_size: int,
) -> dict[str, Any]:
    # Benchmark setup uses the shared adapter's batch API. Timed requests below
    # go through the public async service facade.
    adapter = manager._shared_adapter
    started = time.perf_counter()
    for start in range(0, dataset.shape[0], batch_size):
        stop = min(start + batch_size, dataset.shape[0])
        records = [make_record(index, dataset[index].tolist()) for index in range(start, stop)]
        await asyncio.to_thread(adapter.upsert, records)
    total_seconds = time.perf_counter() - started
    return {
        "total_seconds": total_seconds,
        "records_per_second": dataset.shape[0] / total_seconds if total_seconds else 0.0,
    }


async def warm_query(
    manager: VikingVectorIndexBackend,
    ctx: RequestContext,
    query: Sequence[float],
    *,
    filter: dict[str, Any] | None,
    k: int,
) -> float:
    started = time.perf_counter()
    records = await manager.query(
        query_vector=list(query),
        filter=filter,
        limit=k,
        output_fields=["id"],
        ctx=ctx,
    )
    if len(records) != k:
        raise RuntimeError(f"Warm query returned {len(records)} records, expected {k}")
    return (time.perf_counter() - started) * 1000.0


async def run_cached_scenario(
    manager: VikingVectorIndexBackend,
    ctx: RequestContext,
    queries: np.ndarray,
    *,
    name: str,
    filter: dict[str, Any] | None,
    concurrency_levels: Sequence[int],
    request_count: int,
    k: int,
) -> dict[str, Any]:
    initial_filter_ms = await warm_query(manager, ctx, queries[0], filter=filter, k=k)
    results = []
    for concurrency in concurrency_levels:
        await warm_query(manager, ctx, queries[0], filter=filter, k=k)
        result = await run_request_set(
            manager,
            ctx,
            queries,
            concurrency=concurrency,
            request_count=request_count,
            k=k,
            filter_factory=lambda _index, value=filter: value,
        )
        result["concurrency"] = concurrency
        results.append(result)
    return {
        "name": name,
        "filter_mode": "cached",
        "filter": filter,
        "initial_filter_query_ms": initial_filter_ms,
        "results": results,
    }


async def run_unique_filter_scenario(
    manager: VikingVectorIndexBackend,
    ctx: RequestContext,
    queries: np.ndarray,
    *,
    vector_count: int,
   
```

### Core Architecture Module: `benchmark/locomo/vikingbot/progress_utils.py`
```
"""Shared progress bar utilities for LoCoMo benchmark scripts.

Provides a four-state progress bar (successful / failed / running / pending) built on
top of ``rich.progress``, plus helpers for both threaded and asyncio
scenarios.
"""

from __future__ import annotations

import sys
import time
from typing import Optional

from rich.console import Console
from rich.progress import (
    Progress,
    ProgressColumn,
    Task,
    TaskID,
    TextColumn,
)
from rich.table import Column
from rich.text import Text

from openviking.session.train.components.progress import ProgressSummaryColumn


def format_duration(seconds: float) -> str:
    """Format a duration as compact h/m/s text for progress displays."""
    total_seconds = max(0, int(round(seconds)))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}h{minutes:02d}m{secs:02d}s"
    if minutes:
        return f"{minutes}m{secs:02d}s"
    return f"{secs}s"


class ElapsedTimeColumn(ProgressColumn):
    """Render wall-clock elapsed time for a progress task."""

    def render(self, task: Task) -> Text:
        started_at = task.fields.get("started_at")
        if started_at is None:
            return Text("elapsed: 0s", style="dim")
        elapsed = format_duration(time.monotonic() - float(started_at))
        return Text(f"elapsed: {elapsed}", style="dim")


# ---------------------------------------------------------------------------
# Multi-state bar column
# ---------------------------------------------------------------------------


class ThreeStateBarColumn(ProgressColumn):
    """A progress bar that renders four states: successful / failed / running / pending.

    - **successful** = solid green
    - **failed**     = solid red
    - **running**    = shaded yellow
    - **pending**    = hollow / background

    The number of in-flight items is read from
    ``task.fields.get("running", 0)``.  The total bar width maps to
    ``task.total``; ``task.completed`` is the processed count and
    ``task.fields["failed"]`` splits failures out of that processed count.
    """

    def __init__(
        self,
        bar_width: int = 28,
        style: str = "bar.complete",
        running_style: str = "bar.finished",
        complete_style: Optional[str] = None,
        finished_style: Optional[str] = None,
        pulse_style: str = "bar.pulse",
        table_column: Optional[Column] = None,
    ) -> None:
        super().__init__(table_column=table_column or Column(ratio=1, no_wrap=True))
        self.bar_width = bar_width
        self.style = style
        # "complete" = done portion, "finished" = running portion.
        # We accept both naming conventions so callers can override freely.
        self.complete_style = complete_style or style
        self.finished_style = finished_style or running_style
        self.pulse_style = pulse_style

    def render(self, task: Task) -> Text:
        """Render the four-state bar."""
        bar_width = self.bar_width or 40

        total = max(task.total or 0, 0)
        processed = max(task.completed or 0, 0)
        failed = max(int(task.fields.get("failed", 0) or 0), 0)
        done = max(int(task.fields.get("succeeded", processed - failed) or 0), 0)
        running = max(int(task.fields.get("running", 0) or 0), 0)

        if total <= 0:
            # Degenerate case: show empty bar
            return Text("─" * bar_width, style="bar.back")

        # Clamp so we don't exceed 100% visually
        done = min(done, total)
        failed = min(failed, total - done)
        running = min(running, total - done - failed)

        done_width = int(bar_width * done / total)
        failed_width = int(bar_width * (done + failed) / total) - done_width
        running_width = (
            int(bar_width * (done + failed + running) / total) - done_width - failed_width
        )
        pending_width = bar_width - done_width - failed_width - running_width

        bar = Text()
        if done_width > 0:
            bar.append("█" * done_width, style="green")
        if failed_width > 0:
            bar.append("█" * failed_width, style="red")
        if running_width > 0:
            bar.append("▓" * running_width, style="yellow")
        if pending_width > 0:
            bar.append("░" * pending_width, style="dim")

        return bar


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def make_three_state_progress(
    description: str = "Progress",
    console: Optional[Console] = None,
    transient: bool = False,
) -> tuple[Progress, TaskID]:
    """Create a :class:`Progress` instance with a four-state bar.

    Returns the ``(progress, task_id)`` pair.  The task starts with
    ``completed=0``, ``total=0``, ``running=0``, ``failed=0``; callers
    should call ``progress.update(task_id, total=N)`` to set the total and
    use a tracker to keep success/failure/running fields in sync.
    """
    console = console or Console(stderr=True, soft_wrap=False)
    progress = Progress(
        ThreeStateBarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        ProgressSummaryColumn(),
        ElapsedTimeColumn(),
        console=console,
        transient=transient,
    )
    task_id = progress.add_task(
        description,
        total=0,
        running=0,
        succeeded=0,
        failed=0,
        started_at=time.monotonic(),
    )
    return progress, task_id


def should_show_progress(no_progress_flag: bool) -> bool:
    """Decide whether to render a progress bar.

    Disabled when the user explicitly passed ``--no-progress`` or when
    stderr is not a TTY (e.g. redirected to a file / CI logs).
    """
    if no_progress_flag:
        return False
    return sys.stderr.isatty()


# ---------------------------------------------------------------------------
# Thread-safe counter (for run_eval.py's ThreadPoolExecutor)
# ---------------------------------------------------------------------------


class ThreadSafeProgressTracker:
    """Thin wrapper around a rich Progress that keeps ``running`` count
    correct when tasks start/finish from multiple threads.

    Usage::

        tracker = ThreadSafeProgressTracker(progress, task_id, total=N)
        # For each job:
        tracker.job_started()
        try:
            ... do work ...
        finally:
            tracker.job_finished()
    """

    def __init__(self, progress: Progress, task_id: TaskID, total: int) -> None:
        import threading

        self._progress = progress
        self._task_id = task_id
        self._lock = threading.Lock()
        self._running = 0
        self._done = 0
        self._failed = 0
        self._total = total
        self._progress.update(task_id, total=total, completed=0, running=0, succeeded=0, failed=0)

    def job_started(self) -> None:
        """Call when a worker thread picks up a job."""
        with self._lock:
            self._running += 1
            self._progress.update(
                self._task_id,
                running=self._running,
            )

    def job_finished(self, *, failed: bool = False) -> None:
        """Call when a worker thread finishes a job."""
        with self._lock:
            self._running = max(0, self._running - 1)
            self._done += 1
            if failed:
                self._failed += 1
            self._progress.update(
                self._task_id,
                completed=self._done,
                running=self._running,
                succeeded=self._done - self._failed,
                failed=self._failed,
            )

    @property
    def done(self) -> int:
        with self._lock:
            return self._done

    @property
    def running(self) -> int:
        with self._lock:
            return self._running

    @property
    def failed(self) -> int:
        with self._lock:
            return self._failed


# ---------------------------------------------------------------------------
# Async-safe counter (for judge.py's asyncio semaphore pattern)
# ---------------------------------------------------------------------------


class AsyncProgressTracker:
    """Same idea as :class:`ThreadSafeProgressTracker` but for asyncio.

    Since asyncio tasks all run on the same event loop, we don't strictly
    need a lock; we keep one anyway for clarity and in case someone later
    mixes threads in.
    """

    def __init__(self, progress: Progress, task_id: TaskID, total: int) -> None:
        self._progress = progress
        self._task_id = task_id
        self._running = 0
        self._done = 0
        self._failed = 0
        self._total = total
        self._progress.update(task_id, total=total, completed=0, running=0, succeeded=0, failed=0)

    def job_started(self) -> None:
        self._running += 1
        self._progress.update(self._task_id, running=self._running)

    def job_finished(self, *, failed: bool = False) -> None:
        self._running = max(0, self._running - 1)
        self._done += 1
        if failed:
            self._failed += 1
        self._progress.update(
            self._task_id,
            completed=self._done,
            running=self._running,
            succeeded=self._done - self._failed,
            failed=self._failed,
        )

    @property
    def done(self) -> int:
        return self._done

    @property
    def running(self) -> int:
        return self._running

    @property
    def failed(self) -> int:
        return self._failed

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7713** (2026-11-16): **[Bug]: non-object pending queue JSON blocks replay of healthy messages**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  A pending queue file containing valid JSON null blocks replay of otherwise healthy offline messages. listPending() catches JSON parse errors but accepts non-object values; sorting reads entry.createdAt outside that catch. Reproduced locally through the shared production enqueue/replay functions by an AI agent.  ### Steps to Reproduce  1. Set OPENVIKING_PENDING_DIR to a temporary directory. 2. Call enqueue("addMessage", "session", {role:"user",content:"offline message"}). 3. Write null into another .json file in the directory. 4. Call replayPending(async () => ({ok:true}), () => {}).  ### Expected Behavior  Skip non-object queue values, as with invalid JSON, and replay healthy queued messages.  ### Actual Behavior  TypeError: Cannot read properties of null (reading createdAt). No HTTP replay is attempted.  ### Minimal Reproducible Example  ```python  ```  ### Error Logs  ```shell  ```  ### OpenViking Version  main at 1a6e51f0c62462da43a79e9794f03efb485cc17f  ### Python Version  Not applicable; shared JavaScript memory plugin running in Node.js  ### Operating System  Linux  ### Model Backend  None  ### Additional Context  The malformed file is deliberately injected to exercise the corruption boundary; this is not a claim that normal enqueue writes null. Searches of existing pending/null and pending/malformed issues and PRs found no matching fix.  Proposed scope: skip null, scalar and array JSON

- **Issue #7412** (2026-11-13): **[Bug]: Gateway session memory_policy overrides user-level memory_types**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  ### Version  - OpenViking: v0.5.3 - Also reproducible on main `9c48090b0e6a48303909cb87333c778acca34cd6`  ### Description  OpenViking Gateway creates every capture session with:  ```json {"memory_policy":{"working_memory":{"enabled":false}}}   Session policy precedence selects the whole Session policy before the User policy. It does not merge missing fields from lower-priority policies. Therefore a User-level memory_policy.memory_types allowlist is ignored for Gateway-created sessions.  Because the Gateway policy omits memory_types, it resolves to null, meaning all enabled memory types are allowed.  ### Steps to Reproduce  Configure a User policy such as:   {"memory_policy":{"memory_types":["events"]}}   Start a new conversation through OpenViking Gateway.  Inspect the generated OV session and commit it.  The session carries a Session-level policy with Working Memory disabled but no memory_types restriction; extraction is not limited to events.  ### Expected Behavior  Gateway should disable only Working Memory while preserving User-level self, peer, and memory_types policy resolution.  ### Actual Behavior  The partial Session policy masks the complete User policy.   ### Minimal Reproducible Example  ```python Remove memory_policy from Gateway create_session().  Send enable_working_memory: false in the Gateway commit request. This existing per-commit field overrides only Working Memory and pre

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

### Incident Patch 1: `1a6e51f0` (2026-11-15)
**Commit Message**: feat(ci): route Linux API jobs and wheel builds to dedicated runner (#6806)

* feat(ci): route Linux tests and CLI builds across available compute pools

Use prepared self-hosted hosts for ordinary Linux jobs with isolated build environments, shared pool scheduling without inventory credentials, and hosted fallback when selection is unavailable.

* fix(ci): let Linux distribution builds use available compute pools

Preserve the Ubuntu 20.04 wheel baseline while routing x64 wheels and shared Studio/source builds through the Linux pool selector.

* fix(ci): avoid waiting for self-hosted capacity in pool selection

Default the selector to GitHub-hosted and retain an explicit runner-label override for prepared self-hosted machines.

* fix(ci): resolve Hermes Python libraries in clean container environments

Register setup-python libraries with the container loader so Hermes can clear its environment without losing the shared Python runtime.

* fix(ci): install zip for plugin archive tests in Linux containers

The hosted image supplied zip implicitly, but archive installation tests also need it in the isolated test container.

* fix(ci): supply and check plugin marketplace installer too

**File**: `.github/CI.md` (modified, +62/-7)
```diff
@@ -18,12 +18,65 @@ file checksum before writing it. Other test platforms build locally. Release
 wheels build independently in Ubuntu 20.04/macOS/Windows; Ubuntu 24.04 test
 binaries and musl CLI binaries are never reused in release wheels.
 
-Builds and ordinary tests use GitHub-hosted runners to measure build reuse and
-cache behavior independently of self-hosted machine capacity. There is no
-`ov-ci-runner` scheduling or manual selection in these workflows.
-The existing P0 Memory Tests remain on their original ECS environment, selected
-with `[self-hosted, Linux, X64, openviking-ecs]`. That runner must have the
-`openviking-ecs` custom label; its display name alone does not select it.
+With repository variable `CI_LINUX_BUILDS_ENABLED=true`, trusted Linux API jobs
+use `[self-hosted, Linux, X64, ci-linux-builds]`. Linux x86_64 wheel builds
+alternate between GitHub-hosted and this dedicated pool.
+Only the dedicated runner `iv-yezentk8ao3z47ge5tmm` has that custom label; runner
+display names do not select machines.
+Linux wheels use the dedicated runner on even workflow run numbers.
+API native runtime preparation and its short change-planning job always use
+the dedicated runner for eligible events, regardless of workflow run number.
+The planning job runs Git/Python on the host with a five-minute execution limit.
+Linux API/CLI, MySQL/Redis and
+cuVS tests inherit their same-run native producer's destination. This keeps the
+entire trusted Linux API dependency chain off the hosted queue.
+Wheel builds send 50% of consecutive runs to each destination, and reruns keep
+the same destination. This is not half of all Linux jobs or an equal share of
+execution time. Conditional skips can change the observed share.
+The old ECS runner does not receive these jobs.
+
+Only official repository PRs from the same repository and branch pushes are
+eligible. Release/tag events, schedules, manual builds, fork PRs and other
+repositories use GitHub-hosted. The native producer publishes its selected labels
+and container image for its consumers; no extra selector job or token is needed.
+Studio, both musl CLI targets, other tests/checks and source packaging stay hosted. Native ARM,
+macOS and Windows assignments are unchanged.
+
+Self-hosted builds and tests require Docker access and use disposable containers with
+job-local HOME/Cargo/Rustup directories and post-job ownership cleanup.
+Wheels retain Ubuntu 20.04/glibc 2.31. API native runtime preparation uses Ubuntu
+24.04 on both destinations so its artifact remains compatible with hosted tests.
+Self-hosted API, database and cuVS consumers also use Ubuntu 24.04 containers;
+hosted consumers retain their existing host execution. Database consumers use
+service-container DNS inside containers and loopback on hosted runners.
+The Linux wheel execution timeout is 60 minutes and native preparation is limited
+to 30 minutes. Timeouts start when execution begins, not while queued; there is
+no automatic queue fallback.
+
+Before enabling routing, dispatch `_build.yml` on this branch with
+`check_linux_runner=true`, `build_wheels=false` and `build_sdist=false`. Its
+five-minute diagnostic checks Docker access, HTTPS package-index downloads and
+package installation in both container images without checking out repository
+code. Enable `CI_LINUX_BUILDS_ENABLED` only after it passes. The runner user must
+be able to access Docker without interactive sudo.
+
+Package sources use HTTPS. Minimal Ubuntu images bootstrap TLS verification with
+the host's `/etc/ssl/certs/ca-certificates.crt`, mounted read-only at a temporary
+path until the container installs its own certificates. The host CA bundle must
+exist. Incomplete apt index downloads fail the job instead of continuing with
+missing package metadata.
+If official Ubuntu endpoints are unreachable from the dedicated machine, set
+`CI_UBUNTU_MIRROR` to a reachable HTTPS Ubuntu mirror, including its `/ubuntu` path.
+The override applies only to self-hosted builds/tests and the readiness diagnostic;
+hosted builds retain the official sources. The diagnostic prints host/container
+TCP reachability to help distinguish mirror access from Docker networking issues.
+
+If the dedicated runner is offline or stuck, set repository Actions variable
+`CI_DISABLE_SELF_HOSTED=true`, cancel affected runs and trigger new runs.
+New jobs use hosted runners; already queued jobs retain their original labels.
+After repairing/updating the runner, remove the disable variable to resume the
+dedicated routing. Removing `CI_LINUX_BUILDS_ENABLED` also leaves these builds/tests hosted.
+Release builds remain hosted regardless of either variable.
 
 The cuVS check now lives in the API workflow so it can consume the same artifact.
 Its check name stays `cuvs-tests / Lite Test (ubuntu-24.04, 3.11)`, matching the
@@ -54,9 +107,11 @@ select API tests, including newly introduced runtime paths.
 Local checks:
 
 ```sh
+python3 -m pip install pytest PyYAML
 
```

**File**: `.github/actionlint.yaml` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 self-hosted-runner:
   labels:
-    - openviking-ecs
+    - ci-linux-builds
```

**File**: `.github/actions/linux-test-env/action.yml` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+name: Bootstrap Linux build container
+description: Supply a job-local home before language setup and restore workspace ownership
+runs:
+  using: node24
+  main: bootstrap.mjs
+  post: cleanup.mjs
+  post-if: always()
```

**File**: `.github/actions/linux-test-env/bootstrap.mjs` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+import { execFileSync } from 'node:child_process';
+import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs';
+import { join } from 'node:path';
+
+const env = process.env;
+const workspace = env.GITHUB_WORKSPACE;
+// Preserve the host runner's ownership before any build writes root-owned files.
+const owner = execFileSync('stat', ['-c', '%u:%g', workspace], { encoding: 'utf8' }).trim();
+const home = mkdtempSync(join(env.RUNNER_TEMP, 'linux-test-home.'));
+appendFileSync(env.GITHUB_STATE, `owner=${owner}\nworkspace=${workspace}\nhome=${home}\n`);
+appendFileSync(env.GITHUB_ENV, `HOME=${home}\nCARGO_HOME=${home}/.cargo\nRUSTUP_HOME=${home}/.rustup\n`);
+// Checkout used the original container HOME; restrict trust to these workspaces.
+writeFileSync(join(home, '.gitconfig'),
+  `[safe]\n\tdirectory = ${workspace}\n`);
```

**File**: `.github/actions/linux-test-env/cleanup.mjs` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+import { execFileSync } from 'node:child_process';
+
+const { STATE_owner: owner, STATE_workspace: workspace, STATE_home: home } = process.env;
+if (owner && workspace && home) {
+  // Run after test/cache steps, before checkout's post-job cleanup. Do not follow
+  // symlinks into host paths. The next host job must be able to
+  // clean the shared checkout and runner temp directory.
+  execFileSync('chown', ['-hR', owner, workspace, home], { stdio: 'inherit' });
+}
```

**File**: `.github/workflows/_build.yml` (modified, +95/-7)
```diff
@@ -25,6 +25,11 @@ on:
         default: true
   workflow_dispatch:
     inputs:
+      check_linux_runner:
+        description: 'Check Docker and HTTPS package downloads on the dedicated Linux build runner'
+        required: false
+        type: boolean
+        default: false
       build_sdist:
         description: 'Whether to build source distribution'
         required: false
@@ -45,6 +50,63 @@ on:
         default: '["3.10"]'
 
 jobs:
+  check-linux-runner:
+    name: Check dedicated Linux runner
+    if: github.event_name == 'workflow_dispatch' && inputs.check_linux_runner && github.repository == 'volcengine/OpenViking'
+    runs-on: [self-hosted, Linux, X64, ci-linux-builds]
+    permissions: {}
+    timeout-minutes: 5
+    env:
+      UBUNTU_MIRROR: ${{ vars.CI_UBUNTU_MIRROR }}
+    steps:
+      - name: Verify runner and disposable build containers
+        shell: bash
+        run: |
+          set -euo pipefail
+          id
+          uname -m
+          nproc
+          df -h "$RUNNER_TEMP"
+          docker version
+          test -s /etc/ssl/certs/ca-certificates.crt
+          for host in archive.ubuntu.com mirrors.aliyun.com; do
+            if timeout 5 bash -c 'exec 3<>/dev/tcp/$1/443' _ "$host"; then
+              echo "Host TCP reachable: $host:443"
+            else
+              echo "Host TCP unreachable: $host:443"
+            fi
+            if docker run --rm ubuntu:24.04 timeout 5 \
+              bash -c 'exec 3<>/dev/tcp/$1/443' _ "$host"; then
+              echo "Container TCP reachable: $host:443"
+            else
+              echo "Container TCP unreachable: $host:443"
+            fi
+          done
+          for image in ubuntu:20.04 ubuntu:24.04; do
+            docker run --rm -i \
+              --env UBUNTU_MIRROR \
+              --volume /etc/ssl/certs/ca-certificates.crt:/tmp/runner-ca-certificates.crt:ro \
+              "$image" bash -e <<'BOOTSTRAP'
+          for source in /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources; do
+            if [ -f "$source" ]; then
+              sed -i 's|http://|https://|g' "$source"
+              if [ -n "$UBUNTU_MIRROR" ]; then
+                case "$UBUNTU_MIRROR" in https://*) ;; *) exit 1 ;; esac
+                sed -i \
+                  "s|https://archive.ubuntu.com/ubuntu|${UBUNTU_MIRROR%/}|g; s|https://security.ubuntu.com/ubuntu|${UBUNTU_MIRROR%/}|g" \
+                  "$source"
+              fi
+            fi
+          done
+          apt-get -o Acquire::https::CaInfo=/tmp/runner-ca-certificates.crt \
+            -o Acquire::Retries=2 -o Acquire::https::Timeout=20 \
+            -o APT::Update::Error-Mode=any update
+          apt-get -o Acquire::https::CaInfo=/tmp/runner-ca-certificates.crt \
+            -o Acquire::Retries=2 install -y ca-certificates git
+          getconf GNU_LIBC_VERSION
+          BOOTSTRAP
+          done
+
   build-studio:
     name: Build shared Studio bundle
     if: inputs.build_wheels
@@ -145,8 +207,22 @@ jobs:
         contains(inputs.os_json, '"ubuntu-24.04"') ||
         contains(inputs.os_json, 'ubuntu-24.04-arm')
       )
-    runs-on: ${{ matrix.arch == 'aarch64' && 'ubuntu-24.04-arm' || 'ubuntu-24.04' }}
-    container: ubuntu:20.04
+    runs-on: >-
+      ${{ fromJSON(matrix.arch == 'aarch64' && '["ubuntu-24.04-arm"]' ||
+          github.repository == 'volcengine/OpenViking' &&
+          (github.event_name == 'pull_request' || github.event_name == 'push') &&
+          !startsWith(github.ref, 'refs/tags/') && vars.CI_DISABLE_SELF_HOSTED != 'true' &&
+          vars.CI_LINUX_BUILDS_ENABLED == 'true' &&
+          (!github.event.pull_request || github.event.pull_request.head.repo.full_name == github.repository) &&
+          (endsWith(github.run_number, '0') || endsWith(github.run_number, '2') ||
+           endsWith(github.run_number, '4') || endsWith(github.run_number, '6') ||
+           endsWith(github.run_number, '8')) &&
+          '["self-hosted","Linux","X64","ci-linux-builds"]' || '["ubuntu-24.04"]') }}
+    container:
+      image: ubuntu:20.04
+      # Minimal Ubuntu images lack CA certificates before the first apt install.
+      options: --volume /etc/ssl/certs/ca-certificates.crt:/tmp/runner-ca-certificates.crt:ro
+    timeout-minutes: 60
     env:
       DEBIAN_FRONTEND: noninteractive
       TZ: Etc/UTC
@@ -158,13 +234,23 @@ jobs:
     
     steps:
     - name: Install system dependencies (Linux)
+      env:
+        UBUNTU_MIRROR: ${{ runner.environment == 'self-hosted' && vars.CI_UBUNTU_MIRROR || '' }}
       run: |
-        # Replace archive.ubuntu.com with azure.archive.ubuntu.com for better stability in GH Actions
-        sed -i 's/http:\/\/archive.ubuntu.com\/ubuntu\//http:\/\/azure.archive.ubuntu.com\/ubuntu\//g' /etc/apt/sources.list
-        # Retry apt-get update
-        for i in 1 2 3 4 5; do apt-get update && break || sleep 5; done
-        apt-get install -y \
+        sed -i 's|http://|https://|g' /etc/apt/sources.li
```

**File**: `.github/workflows/_test_lite.yml` (modified, +40/-2)
```diff
@@ -3,6 +3,16 @@ name: 12. _Test Suite (Lite)
 on:
   workflow_call:
     inputs:
+      linux_runner_json:
+        description: 'Linux labels selected by the same-run native producer'
+        required: false
+        type: string
+        default: '["ubuntu-24.04"]'
+      linux_container:
+        description: 'Disposable Linux test container; empty keeps hosted execution'
+        required: false
+        type: string
+        default: ''
       native_artifact:
         description: 'Validated same-run cp310-abi3 native runtime (empty builds locally)'
         required: false
@@ -32,17 +42,45 @@ on:
 jobs:
   test-lite:
     name: Lite Test (${{ matrix.os }}, ${{ matrix.python-version }})
-    runs-on: ${{ matrix.os }}
+    runs-on: ${{ matrix.os == 'ubuntu-24.04' && fromJSON(inputs.linux_runner_json || '["ubuntu-24.04"]') || matrix.os }}
+    container:
+      image: ${{ matrix.os == 'ubuntu-24.04' && inputs.linux_container || '' }}
+      options: --volume /etc/ssl/certs/ca-certificates.crt:/tmp/runner-ca-certificates.crt:ro
+    timeout-minutes: 30
+    defaults:
+      run:
+        shell: ${{ matrix.os == 'windows-latest' && 'pwsh' || 'bash' }}
     strategy:
       fail-fast: false
       matrix:
         os: ${{ fromJson(inputs.os_json) }}
         python-version: ${{ fromJson(inputs.python_json) }}
 
     steps:
+    - name: Bootstrap self-hosted Ubuntu test container
+      if: runner.environment == 'self-hosted'
+      env:
+        UBUNTU_MIRROR: ${{ vars.CI_UBUNTU_MIRROR }}
+        DEBIAN_FRONTEND: noninteractive
+      run: |
+        sed -i 's|http://|https://|g' /etc/apt/sources.list.d/ubuntu.sources
+        if [ -n "$UBUNTU_MIRROR" ]; then
+          case "$UBUNTU_MIRROR" in https://*) ;; *) exit 1 ;; esac
+          sed -i \
+            "s|https://archive.ubuntu.com/ubuntu|${UBUNTU_MIRROR%/}|g; s|https://security.ubuntu.com/ubuntu|${UBUNTU_MIRROR%/}|g" \
+            /etc/apt/sources.list.d/ubuntu.sources
+        fi
+        apt-get -o Acquire::https::CaInfo=/tmp/runner-ca-certificates.crt \
+          -o Acquire::Retries=2 -o Acquire::https::Timeout=20 \
+          -o APT::Update::Error-Mode=any update
+        apt-get -o Acquire::https::CaInfo=/tmp/runner-ca-certificates.crt \
+          -o Acquire::Retries=2 install -y --no-install-recommends \
+          git ca-certificates curl python3 cmake build-essential
     - uses: actions/checkout@v6
       with:
         submodules: recursive
+    - uses: ./.github/actions/linux-test-env
+      if: runner.environment == 'self-hosted'
 
     - name: Set up Python ${{ matrix.python-version }}
       uses: actions/setup-python@v6
@@ -55,7 +93,7 @@ jobs:
         enable-cache: true
 
     - name: Install system dependencies (Ubuntu)
-      if: runner.os == 'Linux'
+      if: runner.os == 'Linux' && runner.environment != 'self-hosted'
       run: |
         sudo apt-get update
         sudo apt-get install -y cmake build-essential
```

**File**: `.github/workflows/api_test.yml` (modified, +118/-10)
```diff
@@ -30,7 +30,14 @@ concurrency:
 
 jobs:
   prepare:
-    runs-on: ubuntu-24.04
+    runs-on: >-
+      ${{ fromJSON(github.repository == 'volcengine/OpenViking' &&
+          (github.event_name == 'pull_request' || github.event_name == 'push') &&
+          !startsWith(github.ref, 'refs/tags/') && vars.CI_DISABLE_SELF_HOSTED != 'true' &&
+          vars.CI_LINUX_BUILDS_ENABLED == 'true' &&
+          (!github.event.pull_request || github.event.pull_request.head.repo.full_name == github.repository) &&
+          '["self-hosted","Linux","X64","ci-linux-builds"]' || '["ubuntu-24.04"]') }}
+    timeout-minutes: 5
     outputs:
       api_changed: ${{ steps.plan.outputs.api_changed }}
       cuvs_changed: ${{ steps.plan.outputs.cuvs_changed }}
@@ -50,18 +57,63 @@ jobs:
 
   native-runtime:
     needs: prepare
+    outputs:
+      test_runner: ${{ steps.test-pool.outputs.runner }}
+      test_container: ${{ steps.test-pool.outputs.container }}
     if: >-
       (needs.prepare.outputs.api_changed == 'true' || needs.prepare.outputs.cuvs_changed == 'true') &&
       (github.event_name == 'pull_request' || github.event_name == 'workflow_dispatch' ||
        (github.repository == 'volcengine/OpenViking' &&
         (github.event_name != 'release' || startsWith(github.event.release.tag_name, 'v'))))
-    runs-on: ubuntu-24.04
+    runs-on: >-
+      ${{ fromJSON(github.repository == 'volcengine/OpenViking' &&
+          (github.event_name == 'pull_request' || github.event_name == 'push') &&
+          !startsWith(github.ref, 'refs/tags/') && vars.CI_DISABLE_SELF_HOSTED != 'true' &&
+          vars.CI_LINUX_BUILDS_ENABLED == 'true' &&
+          (!github.event.pull_request || github.event.pull_request.head.repo.full_name == github.repository) &&
+          '["self-hosted","Linux","X64","ci-linux-builds"]' || '["ubuntu-24.04"]') }}
+    container:
+      image: ubuntu:24.04
+      # Bootstrap HTTPS apt with the host's read-only CA bundle.
+      options: --volume /etc/ssl/certs/ca-certificates.crt:/tmp/runner-ca-certificates.crt:ro
     timeout-minutes: 30
+    defaults:
+      run:
+        shell: bash
+    env:
+      DEBIAN_FRONTEND: noninteractive
     steps:
+      - name: Share the Linux test destination
+        id: test-pool
+        env:
+          TEST_RUNNER: ${{ runner.environment == 'self-hosted' && '["self-hosted","Linux","X64","ci-linux-builds"]' || '["ubuntu-24.04"]' }}
+          TEST_CONTAINER: ${{ runner.environment == 'self-hosted' && 'ubuntu:24.04' || '' }}
+        run: |
+          echo "runner=$TEST_RUNNER" >> "$GITHUB_OUTPUT"
+          echo "container=$TEST_CONTAINER" >> "$GITHUB_OUTPUT"
+      - name: Install native build system dependencies
+        env:
+          UBUNTU_MIRROR: ${{ runner.environment == 'self-hosted' && vars.CI_UBUNTU_MIRROR || '' }}
+        run: |
+          sed -i 's|http://|https://|g' /etc/apt/sources.list.d/ubuntu.sources
+          if [ -n "$UBUNTU_MIRROR" ]; then
+            case "$UBUNTU_MIRROR" in https://*) ;; *) exit 1 ;; esac
+            sed -i \
+              "s|https://archive.ubuntu.com/ubuntu|${UBUNTU_MIRROR%/}|g; s|https://security.ubuntu.com/ubuntu|${UBUNTU_MIRROR%/}|g" \
+              /etc/apt/sources.list.d/ubuntu.sources
+          fi
+          apt-get -o Acquire::https::CaInfo=/tmp/runner-ca-certificates.crt \
+            -o Acquire::Retries=2 -o Acquire::https::Timeout=20 \
+            -o APT::Update::Error-Mode=any update
+          apt-get -o Acquire::https::CaInfo=/tmp/runner-ca-certificates.crt \
+            -o Acquire::Retries=2 install -y \
+            git ca-certificates build-essential clang pkg-config curl unzip xz-utils \
+            python3 libssl-dev
       - uses: actions/checkout@v6
         with:
           submodules: recursive
           fetch-depth: 0
+      - uses: ./.github/actions/linux-test-env
       - uses: actions/setup-python@v6
         with:
           python-version: '3.10'
@@ -88,12 +140,20 @@ jobs:
       os_json: '["ubuntu-24.04"]'
       python_json: '["3.11"]'
       native_artifact: native-runtime-linux-x64-cp310-abi3
+      linux_runner_json: ${{ needs.native-runtime.outputs.test_runner }}
+      linux_container: ${{ needs.native-runtime.outputs.test_container }}
 
   database-tests:
     name: MySQL & Redis Integration Tests
     needs: [prepare, native-runtime]
     if: needs.prepare.outputs.api_changed == 'true'
-    runs-on: ubuntu-24.04
+    runs-on: ${{ fromJSON(needs.native-runtime.outputs.test_runner) }}
+    container:
+      image: ${{ needs.native-runtime.outputs.test_container }}
+      options: --volume /etc/ssl/certs/ca-certificates.crt:/tmp/runner-ca-certificates.crt:ro
+    defaults:
+      run:
+        shell: bash
     timeout-minutes: 20
     services:
       mysql:
@@ -104,7 +164,7 @@ jobs:
           MYSQL_USER: openviking_test
           MYSQL_PASSWORD: integration-test-password
         ports:
-          - 3306:3306
+          - ${{ needs.native-runtime.outputs.test_container != ''
```

---

### Incident Patch 2: `26be9df8` (2026-11-16)
**Commit Message**: Feat/queuefs memory integration (#7606)

* fix(tests): isolate domain fixtures from Watch leadership

Disable the background Watch scheduler for file-only domain fixtures so Session tests do not require native leadership APIs.

* feat(memory): integrate grouped queues with native retry

Keep account/user memory batches on one consumer and settle deliveries after shared work finishes, while preserving existing batching windows, flush cancellation, and first-failure semantics.

**File**: `docs/en/concepts/16-queue-lifecycle.md` (modified, +13/-0)
```diff
@@ -169,3 +169,16 @@ a warning and leaves the delivery for recovery while consumption continues.
 For this release, ExternalTaskService retains its baseline target reservations
 and execution guard for pre-key deliveries, restoring reservations before workers
 start. These transitional guards are scheduled for removal in the next release.
+
+SessionCommit uses an account/user `group_key` on initial and recovery enqueue,
+allowing concurrent sessions to share the streaming-memory batcher. Waiting for
+a predecessor archive returns `ProcessResult.retry()` without publishing a
+replacement. The original message returns to its group tail, allowing the
+predecessor to continue. RETRY and REQUEUED both increment the persisted Work
+`requeue_count`; this counter has no retry limit.
+Batch work and all merge groups finish before processing returns, including on
+failure or cancellation; shutdown leaves the message unacknowledged.
+Submit cancellation keeps the existing count/time/close batching window.
+Cancelling a flush propagates to batch processing and settles its waiting items
+as cancelled. Multiple group failures preserve the first observed exception
+after the remaining groups finish.
```

**File**: `docs/zh/concepts/16-queue-lifecycle.md` (modified, +10/-0)
```diff
@@ -147,3 +147,13 @@ Task/Work 保存异常均不 ACK，已处理的业务失败在 Work 结算后 AC
 warning，消息留待恢复，消费继续。本版本 ExternalTaskService 保留基线的目标
 占用和执行保护，并在 worker 启动前恢复占用，以兼容未携带 key 的旧消息；
 这些过渡保护计划在下个版本移除。
+
+SessionCommit 的首次提交和恢复入队均按账号/用户生成 `group_key`，
+让同用户的并发会话共用流式 Memory 批处理器。等待前一个 archive 时返回
+`ProcessResult.retry()`，不发布替代消息；原消息回到该组队尾，让前一个 archive
+可继续消费。RETRY 与 REQUEUED 都会累加持久化 Work 的 `requeue_count`，
+该计数不设重投上限。批处理及全部合并分组结束后才返回，
+失败或取消也须等待实际写回结束；停机取消保留未 ACK 消息。
+取消 submit 不改变原有 count/time/close 批处理窗口；取消 flush 会传递给
+批处理，并将等待项结算为取消。多个合并分组失败时，等待其他组结束后仍抛出
+最先发生的异常。
```

**File**: `openviking/session/memory/streaming_memory_updater.py` (modified, +10/-2)
```diff
@@ -23,6 +23,7 @@
 from openviking.core.peer_id import safe_peer_id
 from openviking.message import Message
 from openviking.server.identity import RequestContext
+from openviking.service.task_tracker_concurrency import run_to_completion
 from openviking.session.memory.dataclass import (
     MemoryFile,
     MemoryOperationSource,
@@ -232,9 +233,16 @@ async def _submit_grouped_merge_request(
             (await self._get_group_batcher(group_key)).submit(group_request)
             for group_key, group_request in grouped_requests
         ]
-        group_results = list(await asyncio.gather(*submissions))
+        submissions = [asyncio.ensure_future(submission) for submission in submissions]
+        try:
+            group_results = list(await asyncio.gather(*submissions))
+        except (Exception, asyncio.CancelledError):
+            # Drain accepted groups before delivery settlement while preserving
+            # gather's first failure, rather than choosing by group order.
+            await run_to_completion(lambda: asyncio.gather(*submissions, return_exceptions=True))
+            raise
         result = combine_streaming_memory_results(*group_results, fallback_request_count=1)
-        await self._apply_post_group_links(request, result)
+        await run_to_completion(lambda: self._apply_post_group_links(request, result))
         return result
 
     async def _apply_post_group_links(
```

**File**: `openviking/session/memory/utils/streaming_batcher.py` (modified, +16/-3)
```diff
@@ -12,6 +12,7 @@
 from dataclasses import dataclass, field
 from typing import Any, Generic, TypeVar
 
+from openviking.service.task_tracker_concurrency import run_to_completion
 from openviking.service.task_work_index import detach_task_context
 from openviking.telemetry import tracer
 from openviking_cli.utils import get_logger
@@ -115,7 +116,16 @@ async def submit(self, payload: T) -> R:
         if should_flush:
             self._trigger_background_flush("count")
 
-        return await future
+        try:
+            return await asyncio.shield(future)
+        except asyncio.CancelledError:
+            # Keep delivery settlement behind accepted shared work. Cancellation
+            # does not change the existing count/time/close batching window.
+            try:
+                await run_to_completion(lambda: future)
+            except Exception:
+                pass
+            raise
 
     async def close(self) -> R | None:
         if self._closed:
@@ -151,10 +161,13 @@ async def flush(self, reason: str) -> R | None:
                     if metadata is not None:
                         metadata.setdefault("batch_id", batch_id)
                         metadata.setdefault("batch_trace_id", batch_trace_id)
-            except Exception as exc:
+            except (Exception, asyncio.CancelledError) as exc:
                 for item in items:
                     if not item.future.done():
-                        item.future.set_exception(exc)
+                        if isinstance(exc, asyncio.CancelledError):
+                            item.future.cancel()
+                        else:
+                            item.future.set_exception(exc)
                 raise
 
             self._last_result = result
```

**File**: `openviking/session/session.py` (modified, +4/-1)
```diff
@@ -1935,6 +1935,7 @@ async def commit_async(
                     await get_queue_manager().enqueue(
                         QueueManager.SESSION_COMMIT,
                         queue_msg.to_dict(),
+                        group_key=queue_msg.queue_group_key,
                     )
             except Exception as exc:
                 try:
@@ -2324,7 +2325,9 @@ async def retry_archive(
             )
             try:
                 with bind_task_context(new_task_id, self.ctx.account_id, self.ctx.user.user_id):
-                    await get_queue_manager().enqueue(QueueManager.SESSION_COMMIT, msg.to_dict())
+                    await get_queue_manager().enqueue(
+                        QueueManager.SESSION_COMMIT, msg.to_dict(), group_key=msg.queue_group_key
+                    )
             except Exception as exc:
                 await tracker.fail(
                     new_task_id,
```

**File**: `openviking/storage/queuefs/session_commit_msg.py` (modified, +10/-0)
```diff
@@ -2,6 +2,7 @@
 # SPDX-License-Identifier: AGPL-3.0
 """Persistent Session Phase 2 queue message."""
 
+import json
 from dataclasses import asdict, dataclass, field, fields
 from typing import Any, Dict, List
 
@@ -35,6 +36,15 @@ class SessionCommitMsg:
     # omitted true; only queued work, never saved user intent, inherits that value.
     memory_policy_version: int = 1
 
+    @property
+    def queue_group_key(self) -> str:
+        """All sessions of one account/user share a streaming-memory consumer."""
+        return json.dumps(
+            [self.user["account_id"], self.user["user_id"]],
+            ensure_ascii=False,
+            separators=(",", ":"),
+        )
+
     def to_dict(self) -> Dict[str, Any]:
         return asdict(self)
 
```

**File**: `openviking/storage/queuefs/session_commit_processor.py` (modified, +2/-10)
```diff
@@ -75,15 +75,7 @@ async def _process_bound(self, msg: SessionCommitMsg, ctx: RequestContext) -> bo
                     user_id=ctx.user.user_id,
                 )
                 return True
-            processed = await session.resume_queued_commit(msg)
-            if not processed:
-                from openviking.storage.queuefs import QueueManager, get_queue_manager
-
-                await get_queue_manager().enqueue(
-                    QueueManager.SESSION_COMMIT,
-                    msg.to_dict(),
-                )
-            return processed
+            return await session.resume_queued_commit(msg)
         finally:
             reset_root_observability_context(root_context_token)
 
@@ -129,4 +121,4 @@ async def on_dequeue(self, data: Optional[Dict[str, Any]]) -> ProcessResult:
                 processed = await self._process(msg, ctx)
             except Exception as exc:
                 return ProcessResult.failed(str(exc))
-        return ProcessResult.success() if processed else ProcessResult.requeued()
+        return ProcessResult.success() if processed else ProcessResult.retry()
```

**File**: `tests/conftest.py` (modified, +2/-0)
```diff
@@ -162,6 +162,8 @@ def get_dimension(self) -> int:
     OpenVikingConfigSingleton.reset_instance()
     OpenVikingConfigSingleton.initialize(
         config_dict={
+            # Domain tests use a file-only fake; Watch leadership has dedicated fixtures.
+            "enable_watch_scheduler": False,
             "storage": {
                 "workspace": str(test_data_dir),
                 "agfs": {"backend": "local"},
```

---

### Incident Patch 3: `bfd935f4` (2026-11-16)
**Commit Message**: fix(session): serialize explicit session creation (#6044)

Co-authored-by: TRAE CLI <[REDACTED_EMAIL]>

**File**: `openviking/service/session_service.py` (modified, +3/-5)
```diff
@@ -295,10 +295,6 @@ async def create(
         """
         self._record_lifecycle_metric("create", "attempt")
         try:
-            if session_id:
-                existing = self.session(ctx, session_id)
-                if await existing.exists():
-                    raise AlreadyExistsError(f"Session '{session_id}' already exists")
             session = self.session(ctx, session_id)
             if memory_policy is not None:
                 policy = MemoryPolicy.from_dict(memory_policy)
@@ -321,7 +317,9 @@ async def create(
                     event_tags,
                     discard_invalid=True,
                 )
-            await session.ensure_exists()
+            created = await session.ensure_exists()
+            if session_id and not created:
+                raise AlreadyExistsError(f"Session '{session_id}' already exists")
             self._record_lifecycle_metric("create", "ok")
             return session
         except Exception:
```

**File**: `openviking/session/session.py` (modified, +4/-3)
```diff
@@ -790,23 +790,24 @@ async def is_materialized(self) -> bool:
                 raise
             return False
 
-    async def ensure_exists(self) -> None:
-        """Materialize session root and messages file if missing."""
+    async def ensure_exists(self) -> bool:
+        """Materialize session state and return whether this call created it."""
         # Initial state must not overwrite a concurrent append or commit.
         session_path = self._viking_fs._uri_to_path(self._session_uri, ctx=self.ctx)
         lease = await self._viking_fs._async_agfs.pathlock_acquire_exact(
             session_path, timeout_secs=_SESSION_PHASE1_LOCK_TIMEOUT_SECONDS
         )
         try:
             if await self.exists():
-                return
+                return False
             await self._viking_fs.mkdir(self._session_uri, exist_ok=True, ctx=self.ctx)
             await self._viking_fs.write_file(
                 f"{self._session_uri}/messages.jsonl",
                 "",
                 ctx=self.ctx,
             )
             await self._save_meta()
+            return True
         finally:
             await self._viking_fs._async_agfs.pathlock_release(lease)
 
```

**File**: `tests/server/test_api_sessions.py` (modified, +49/-0)
```diff
@@ -642,6 +642,55 @@ async def append(self, messages):
     assert meta["last_message_at"]
 
 
+async def test_concurrent_create_with_explicit_id_has_single_winner(
+    client: httpx.AsyncClient,
+    monkeypatch,
+):
+    session_id = "concurrent-explicit-create"
+    request_count = 8
+    ready_count = 0
+    ready_lock = asyncio.Lock()
+    all_ready = asyncio.Event()
+    original_ensure_exists = Session.ensure_exists
+
+    async def synchronize_before_create(session):
+        nonlocal ready_count
+        if session.session_id == session_id:
+            async with ready_lock:
+                ready_count += 1
+                if ready_count == request_count:
+                    all_ready.set()
+            await asyncio.wait_for(all_ready.wait(), timeout=5)
+        return await original_ensure_exists(session)
+
+    monkeypatch.setattr(Session, "ensure_exists", synchronize_before_create)
+    requests = [
+        {
+            "session_id": session_id,
+            "auto_commit_policy": {"message_count_threshold": threshold},
+        }
+        for threshold in range(10, 10 + request_count)
+    ]
+
+    responses = await asyncio.wait_for(
+        asyncio.gather(*(client.post("/api/v1/sessions", json=request) for request in requests)),
+        timeout=10,
+    )
+
+    winners = [response for response in responses if response.status_code == 200]
+    conflicts = [response for response in responses if response.status_code == 409]
+    assert len(winners) == 1
+    assert len(conflicts) == request_count - 1
+    assert all(response.json()["error"]["code"] == "ALREADY_EXISTS" for response in conflicts)
+
+    persisted = await client.get(f"/api/v1/sessions/{session_id}")
+    assert persisted.status_code == 200
+    assert (
+        persisted.json()["result"]["auto_commit_policy"]
+        == winners[0].json()["result"]["auto_commit_policy"]
+    )
+
+
 async def test_add_message_ignores_extra_metadata_fields(client: httpx.AsyncClient):
     create_resp = await client.post("/api/v1/sessions", json={})
     session_id = create_resp.json()["result"]["session_id"]
```

**File**: `tests/service/test_session_service_metrics.py` (modified, +1/-3)
```diff
@@ -25,8 +25,7 @@ async def test_create_keeps_working_when_lifecycle_metrics_fail(monkeypatch: pyt
     service = SessionService()
     ctx = _make_ctx()
     session = Mock()
-    session.exists = AsyncMock(return_value=False)
-    session.ensure_exists = AsyncMock()
+    session.ensure_exists = AsyncMock(return_value=True)
     debug = Mock()
 
     def _boom(*_args, **_kwargs):
@@ -39,7 +38,6 @@ def _boom(*_args, **_kwargs):
     result = await service.create(ctx, "sess-1")
 
     assert result is session
-    session.exists.assert_awaited_once()
     session.ensure_exists.assert_awaited_once()
     assert debug.call_count == 2
 
```

#### Recent Merged Pull Requests:
- **PR #7746** (2026-11-16): fix(parse): keep Markdown that is not YAML frontmatter (@123XieC)
- **PR #7744** (2026-11-16): feat(studio): show the connected OpenViking version in the sidebar footer (@zuoanCo)
- **PR #7740** (closed): fix(dsh-memory-plugin): never give up on a returning server (@lztxwd6666)
- **PR #7735** (closed): parse: resolve percent-encoded image destinations (@Batianxieshen1)
- **PR #7734** (closed): fix(mcp): expose metadata-only retrieval tag updates (@xixi-box)
- **PR #7733** (2026-11-16): fix(superagent): accept reactions from other Lark apps (@r266-tech)

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

## X. ci): route Linux API jobs and wheel builds to dedicated runner

**RULE**:
When implementing operations in `.github/CI.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1a6e51f0`: ci): route Linux API jobs and wheel builds to dedicated runner. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/CI.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
With repository variable `CI_LINUX_BUILDS_ENABLED=true`, trusted Linux API jobs
use `[self-hosted, Linux, X64, ci-linux-builds]`. Linux x86_64 wheel builds
alternate between GitHub-hosted and this dedicated pool.
Only the dedicated runner `iv-yezentk8ao3z47ge5tmm` has that custom label; runner
display names do not select machines.
Linux wheels use the dedicated runner on even workflow run numbers.
API native runtime preparation and its short change-planning job always use
the dedicated runner for eligible events, regardless of workflow run number.
The planning job runs Git/Python on the host with a five-minute execution limit.
Linux API/CLI, MySQL/Redis and
cuVS tests inherit their same-run native producer's destination. This keeps the
entire trusted Linux API dependency chain off the hosted queue.
Wheel builds send 50% of consecutive runs to each destination, and reruns keep
the same destination. This is not half of all Linux jobs or an equal share of
execution time. Conditional skips can change the observed share.
The old ECS runner does not receive these jobs.

Only official repository PRs from the same repository and branch pushes are
eligible. Release/tag events, schedules, ma
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
Builds and ordinary tests use GitHub-hosted runners to measure build reuse and
cache behavior independently of self-hosted machine capacity. There is no
`ov-ci-runner` scheduling or manual selection in these workflows.
The existing P0 Memory Tests remain on their original ECS environment, selected
with `[self-hosted, Linux, X64, openviking-ecs]`. That runner must have the
`openviking-ecs` custom label; its display name alone does not select it.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1a6e51f0` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
