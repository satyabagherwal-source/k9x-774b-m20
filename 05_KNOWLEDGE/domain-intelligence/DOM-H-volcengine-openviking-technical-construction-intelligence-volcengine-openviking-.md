# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: volcengine/OpenViking Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "volcengine/OpenViking",
  "source_url": "https://github.com/volcengine/OpenViking",
  "source_version": "280caf35",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-28T04:12:26.974Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-volcengine-openviking",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine/OpenViking](https://github.com/volcengine/OpenViking) (Revision: `280caf35`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-28T04:12:26.974Z`  
> **Learning ID**: `learn-github-volcengine-openviking`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: I (Content & Information Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), F (Design Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), K (Quality & Verification Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 60%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from volcengine/OpenViking:

# Forensic Learning Record (Deep Inspection): volcengine/OpenViking

> **Canonical Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T04:12:25.306Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 42946 stars

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
const SESSION_HISTORY_TOOL = "session_history";
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
  // (params) => the OV session id of the host session making this tools/call,
  // or "" when the harness cannot tell; fills `session_history`'s `session`.
  defaultHistorySession = null,
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

  // A `session` the model passed is kept as is, even one this proxy would not
  // have chosen; only a missing or blank one is filled.
  function withDefaultHistorySession(message) {
    if (
      typeof defaultHistorySession !== "function"
      || message.method !== "tools/call"
      || message.params?.name !== SESSION_HISTORY_TOOL
    ) {
      return message;
    }
    const args = message.params.arguments;
    const given = args && typeof args === "object" ? args.session : undefined;
    if (given != null && (typeof given !== "string" || given.trim())) return message;
    let session = "";
    try {
      session = String(defaultHistorySession(message.params) || "").trim();
    } catch (err) {
      logError("default_history_session", err);
    }
    log("default_history_session", { filled: Boolean(session) });
    if (!session) return message;
    return {
      ...message,
      params: { ...message.params, arguments: { ...(args || {}), session } },
    };
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
          `OpenViking MCP authentication failed (HTTP ${err.st
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
if not __package__:
    sys.path.insert(0, str(BENCHMARK_DIR.parents[1]))

from run_collection_benchmark import parse_positive_int_list  # noqa: E402
from run_index_benchmark import percentile, prepare_dataset, runtime_metadata  # noqa: E402

from benchmark.vector_config import BenchmarkVectorConfigResolver  # noqa: E402
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
            {"FieldName": "uri", "FieldType": "path"},
            {"FieldName": "uniform_bucket", "FieldType": "int64"},
            {"FieldName": "row_number", "FieldType": "int64"},
        ],
        "ScalarIndex": ["account_id", "uri", "uniform_bucket", "row_number"],
    }


def make_record(row_index: int, vector: Sequence[float]) -> dict[str, Any]:
    record_id = f"record-{row_index}"
    return {
        "id": record_id,
        "vector": list(vector),
        "account_id": ACCOUNT_ID,
        "uri": f"viking://resources/bench/cuvs-service/{record_id}",
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
        "name": name
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
- **Issue #8416** (2026-11-27): **[Bug]: `backup --include-vectors` fails permanently — consistency checker expects index records for namespaces that reindex cannot build**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  `ov backup --include-vectors` and `ov system consistency viking://` fail with `Cannot export incomplete OpenViking vector index snapshot` because the consistency checker (`openviking/storage/index_consistency.py`) builds index expectations for namespaces where the reindex path either refuses to run or skips by design. The checker and the indexer disagree on which namespaces are indexable, so the check can never pass — not after a full-namespace `semantic_and_vectors --force` reindex that completes with `failed_records=0`.  Three concrete mismatches were observed:  1. **`viking://system/*` (FILE_ONLY)** — `namespace_policy.py` marks the system    namespace `processing_mode=FILE_ONLY, supports_reindex=False`, and    `reindex_executor.py` rejects it with `reindex is not supported for namespace`,    but `index_consistency.py` only excludes sessions    (`NON_INDEX_SCOPES = frozenset({"session"})`), so it still expects level=0/1    records for every system sidecar. These records can never be created. 2. **`viking://agent` root** — reindex of the root URI is rejected    (`UNSUPPORTED_URI`), yet the checker expects its level=0/1 records. Children    (`endpoints`, `payments`) reindex fine; `agent/skills` reindex completes    (`rebuilt_records=6, failed_records=0`) but its level=0/1 records stay missing. 3. **Fingerprint-skip with absent record** — for `viking://user/alice/skills`,    `.abstract.md`/`.

- **Issue #7814** (2026-11-19): **[Bug]: 100篇目录输入，生成wiki，非常耗时且存在循环调用**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  版本	 ：                          0.4.20	                    ；       新版对照（官方 0.5.5 包） 运行时间：	          约 11 分 50 秒，完成	     ；       30 分 12 秒，未完成 模型 token：	      约 208 万                      ；     	已消耗约 501 万 来源抽取	：       138 篇进入清单	         ；          138 篇均生成中间记录 最终 Wiki	 ：           26 个 Markdown 文件	    ；            0 个页面  来源抽取已完成 134/138，只有 4 个仍在运行。到目前为止，输入约 245 万、输出约 149 万 token；新版确实显著更耗模型资源。马上可以观察它进入合并阶段后的实际页面产出。   138/138 个来源都完成了逐篇抽取，并生成 138 条记录。流程已进入审阅／合并；这一阶段决定最终 Wiki 的内容覆盖，我会继续核对任务状态和实际页面。   逐篇抽取完成后，审阅器判断这 138 条记录跨多个无关主题，正在调整合并指令；目前已生成分组文件，但还没有最终 Wiki 页面。这里是新版的关键风险点：若把全部记录压到同一组，可能再次遗漏独立主题。我会继续观察合并结果和 token 增量。  现在满足你设定的停止条件：138 条抽取记录已生成，但合并阶段连续 27 次模型调用，额外消耗约 74 万输入 token，只反复读取同一个 assignment.json 的异常偏移，仍未写出 Wiki 页面。我会停止这轮独立服务，保存工作区和日志，再分析卡住的原因；继续等待只会增加无效调用。  ### Steps to Reproduce  可以随便找100篇文章，或者200篇，调用wiki能力。  ### Expected Behavior  能完整较快的生成wiki  ### Actual Behavior  wiki生成  ### Minimal Reproducible Example  ```python  ```  ### Error Logs  ```shell  ```  ### OpenViking Version  0.5.5  ### Python Version  Python 3.12.8  ### Operating System  Windows  ### Model Backend  None  ### Additional Context  _No response_

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

### Incident Patch 1: `bab33336` (2026-11-27)
**Commit Message**: fix(snapshot-log)!: scope postgres indexes and use full paths (#8562)

* fix(snapshot-log)!: isolate postgres indexes by service_name

Keep shared PostgreSQL index progress, path rows and append locks
independent for each deployment. Align schema limits with the
64-byte service_name and account contract.

BREAKING CHANGE: PostgreSQL store constructors require service_name.
Existing tables must be rebuilt with the revised PostgreSQL DDL.

* test(snapshot-log): remove shared postgres isolation test

* fix(snapshot-log)!: use full paths in postgres indexes

Prevent path digest collisions from rejecting PostgreSQL history rows.
Limit indexed branch names to 128 bytes so full-path keys fit.

BREAKING CHANGE: PostgreSQL SnapshotLog indexes branches up to 128 bytes.
Shared runtime field-limit alignment is deferred to a separate change.

* fix(snapshot-log): align postgres runtime branch limit

* fix(snapshot-log)!: set shared branch limit to 128 bytes

Use one branch limit for SnapshotLog providers and remove the
PostgreSQL-specific override.

BREAKING CHANGE: SnapshotLog providers index branches up to 128 bytes.

**File**: `crates/ragfs-python/src/git.rs` (modified, +9/-0)
```diff
@@ -170,6 +170,7 @@ fn build_snapshot_log_store(
                 PyRuntimeError::new_err("build_snapshot_log_store must run inside a tokio runtime")
             })?;
             match handle.block_on(ragfs::git::PostgresSnapshotLogStore::connect_with_timeout(
+                service_name,
                 &dsn,
                 postgres.max_connections,
                 postgres.connect_timeout_ms,
@@ -851,6 +852,9 @@ mod tests {
         let store = build_snapshot_log_store(&cfg, "test-service")
             .unwrap()
             .expect("PG index enabled");
+        let other = build_snapshot_log_store(&cfg, "other-service")
+            .unwrap()
+            .expect("PG index enabled for another service");
         runtime.block_on(async {
             let account = uuid::Uuid::new_v4().simple().to_string();
             let oid = "1234567890123456789012345678901234567890";
@@ -875,6 +879,11 @@ mod tests {
                     .1,
                 oid
             );
+            assert!(other
+                .load_latest_indexed_commit(&account, "main")
+                .await
+                .unwrap()
+                .is_none());
         });
     }
 
```

**File**: `crates/ragfs/src/git/snapshot_log/postgres.rs` (modified, +37/-19)
```diff
@@ -7,8 +7,8 @@ use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
 use sqlx::{PgPool, Postgres, QueryBuilder};
 
 use super::store::{
-    ensure_latest_matches, validate_append, SnapshotLogError, SnapshotLogHit, SnapshotLogLimits,
-    SnapshotLogRow, SnapshotLogStore,
+    ensure_latest_matches, validate_append, validate_service_name, SnapshotLogError, SnapshotLogHit,
+    SnapshotLogLimits, SnapshotLogRow, SnapshotLogStore,
 };
 
 const POSTGRES_INSERT_BATCH_ROWS: usize = 1_000;
@@ -33,16 +33,20 @@ pub struct PostgresSnapshotLogStore {
     pool: PgPool,
     limits: SnapshotLogLimits,
     operation_timeout: Duration,
+    service_name: String,
 }
 
 impl PostgresSnapshotLogStore {
-    /// Connect to a pre-provisioned database without creating or migrating tables.
+    /// Connect using a service name, DSN, pool size and acquisition timeout.
+    /// Return the service-scoped store or an error; never provision tables.
     pub async fn connect(
+        service_name: &str,
         dsn: &str,
         max_connections: u32,
         connect_timeout_ms: u64,
     ) -> Result<Self, SnapshotLogError> {
         Self::connect_with_timeout(
+            service_name,
             dsn,
             max_connections,
             connect_timeout_ms,
@@ -51,14 +55,17 @@ impl PostgresSnapshotLogStore {
         .await
     }
 
-    /// Bound initialization and each complete index operation, including pool
-    /// acquisition, lock waits and all statements in an append transaction.
+    /// Connect using a service name, DSN, pool size and timeouts in milliseconds.
+    /// Return a store whose initialization and complete operations have deadlines,
+    /// or a configuration/database error.
     pub async fn connect_with_timeout(
+        service_name: &str,
         dsn: &str,
         max_connections: u32,
         connect_timeout_ms: u64,
         operation_timeout_ms: u64,
     ) -> Result<Self, SnapshotLogError> {
+        validate_service_name(service_name)?;
         if dsn.trim().is_empty()
             || max_connections == 0
             || connect_timeout_ms == 0
@@ -89,13 +96,16 @@ impl PostgresSnapshotLogStore {
                 .await?;
             // Fail initialization if deployment DDL/permissions are missing, allowing
             // the binding's existing best-effort fallback to the Git scan path.
-            sqlx::query("SELECT id, account, branch, path, commit_oid FROM snapshot_log LIMIT 0")
-                .execute(&pool)
-                .await?;
+            sqlx::query(
+                "SELECT id, service_name, account, branch, path, commit_oid FROM snapshot_log LIMIT 0",
+            )
+            .execute(&pool)
+            .await?;
             Ok(Self {
                 pool,
                 limits: SnapshotLogLimits::default(),
                 operation_timeout,
+                service_name: service_name.to_string(),
             })
         })
         .await
@@ -116,8 +126,9 @@ impl SnapshotLogStore for PostgresSnapshotLogStore {
         with_timeout(self.operation_timeout, async {
             Ok(sqlx::query_as::<_, (i64, String)>(
                 "SELECT id, commit_oid FROM snapshot_log \
-             WHERE account = $1 AND branch = $2 ORDER BY id DESC LIMIT 1",
+             WHERE service_name = $1 AND account = $2 AND branch = $3 ORDER BY id DESC LIMIT 1",
             )
+            .bind(&self.service_name)
             .bind(account)
             .bind(branch)
             .fetch_optional(&self.pool)
@@ -142,18 +153,22 @@ impl SnapshotLogStore for PostgresSnapshotLogStore {
                 .execute(&mut *tx)
                 .await?;
             // Row locking cannot serialize two first appends to an empty branch.
-            // Length-prefixing avoids ambiguous (account, branch) concatenations.
+            // Length-prefixing isolates service/account/branch lock namespaces.
             // Hash collisions only serialize unrelated branches; equality is still
-            // checked against the original account/branch columns.
-            let lock_key = format!("{}:{}{}", account.len(), account, branch);
+            // checked against the original service/account/branch columns.
+            let lock_key = format!(
+                "{}:{}|{}:{}{}",
+                self.service_name.len(), self.service_name, account.len(), account, branch
+            );
             sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
                 .bind(lock_key)
                 .execute(&mut *tx)
                 .await?;
             let latest = sqlx::query_as::<_, (i64, String)>(
                 "SELECT id, commit_oid FROM snapshot_log \
-             WHERE account = $1 AND branch = $2 ORDER BY id DESC LIMIT 1",
+             WHERE service_name = $1 AND account = $2 AND branch = $3 ORDER BY id DESC LIMIT 1",
             )
+            .bind(&self.service_name)
             .bind(account)
             .bind(branch)
             .fetch_optional
```

**File**: `crates/ragfs/src/git/snapshot_log/store.rs` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ impl Default for SnapshotLogLimits {
     fn default() -> Self {
         Self {
             account_bytes: 64,
-            branch_bytes: 512,
+            branch_bytes: 128,
             path_bytes: 2048,
             max_rows_per_commit: SNAPSHOT_LOG_MAX_ROWS_PER_COMMIT,
         }
```

**File**: `crates/ragfs/src/git/tests/test_snapshot_log.rs` (modified, +7/-5)
```diff
@@ -6,7 +6,7 @@ async fn make_snapshot_log_store() -> Arc<dyn SnapshotLogStore> {
     #[cfg(feature = "postgres")]
     if let Ok(dsn) = std::env::var("SNAPSHOT_LOG_TEST_PG_DSN") {
         return Arc::new(
-            crate::git::PostgresSnapshotLogStore::connect(&dsn, 4, 5_000)
+            crate::git::PostgresSnapshotLogStore::connect("test-service", &dsn, 4, 5_000)
                 .await
                 .expect("PostgreSQL SnapshotLog schema must be provisioned"),
         );
@@ -215,9 +215,11 @@ async fn test_snapshot_log_postgres_restore_completes_with_locked_index_and_back
     let account = uuid::Uuid::new_v4().simple().to_string();
     let (_dir, vfs, _object_store, _ref_store, svc) = make_service(&account);
     let store = Arc::new(
-        crate::git::PostgresSnapshotLogStore::connect_with_timeout(&dsn, 2, 5_000, 200)
-            .await
-            .unwrap(),
+        crate::git::PostgresSnapshotLogStore::connect_with_timeout(
+            "test-service", &dsn, 2, 5_000, 200,
+        )
+        .await
+        .unwrap(),
     );
     let svc = svc.with_snapshot_log(Some(store.clone()));
     vfs.put("proj/a.md", b"v1");
@@ -232,7 +234,7 @@ async fn test_snapshot_log_postgres_restore_completes_with_locked_index_and_back
         .unwrap();
     let mut lock = pool.begin().await.unwrap();
     sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
-        .bind(format!("{}:{}main", account.len(), account))
+        .bind(format!("12:test-service|{}:{}main", account.len(), account))
         .execute(&mut *lock)
         .await
         .unwrap();
```

**File**: `crates/ragfs/tests/postgres_snapshot_log.rs` (modified, +21/-9)
```diff
@@ -9,6 +9,8 @@ use std::sync::Arc;
 use tokio::sync::Barrier;
 use tokio::time::{timeout, Duration, Instant};
 
+const TEST_SERVICE: &str = "test-service";
+
 async fn expect_timeout<T: std::fmt::Debug>(
     operation: impl std::future::Future<Output = Result<T, SnapshotLogError>>,
 ) {
@@ -32,7 +34,7 @@ fn dsn() -> String {
 }
 
 async fn store() -> PostgresSnapshotLogStore {
-    PostgresSnapshotLogStore::connect(&dsn(), 4, 5_000)
+    PostgresSnapshotLogStore::connect(TEST_SERVICE, &dsn(), 4, 5_000)
         .await
         .expect("provision openviking/service/sql/snapshot_log_postgres_init.sql first")
 }
@@ -69,8 +71,8 @@ async fn cleanup(account: &str) {
 #[ignore = "requires a real PostgreSQL database"]
 async fn postgres_snapshot_log_history_scope_width_and_watermark() {
     let store = store().await;
-    let account = uuid::Uuid::new_v4().simple().to_string() + &"a".repeat(223);
-    let branch = "b".repeat(512);
+    let account = uuid::Uuid::new_v4().simple().to_string() + &"a".repeat(32);
+    let branch = "b".repeat(128);
     // Varied four-byte characters exercise the full 2048-byte path limit.
     let wide: String = (0..512)
         .map(|i| char::from_u32(0x10000 + i).unwrap())
@@ -291,7 +293,7 @@ async fn postgres_snapshot_log_startup_does_not_provision_schema() {
     url.query_pairs_mut()
         .append_pair("options", &format!("-c search_path={schema}"));
     assert!(matches!(
-        PostgresSnapshotLogStore::connect(url.as_str(), 1, 5_000).await,
+        PostgresSnapshotLogStore::connect(TEST_SERVICE, url.as_str(), 1, 5_000).await,
         Err(SnapshotLogError::Sql(_))
     ));
     let count: i64 = sqlx::query_scalar("SELECT count(*) FROM pg_tables WHERE schemaname = $1")
@@ -330,7 +332,7 @@ async fn postgres_snapshot_log_bounds_startup_and_read_table_lock_waits() {
     let mut url = url::Url::parse(&dsn()).unwrap();
     url.query_pairs_mut()
         .append_pair("options", &format!("-c search_path={schema}"));
-    let store = PostgresSnapshotLogStore::connect_with_timeout(url.as_str(), 1, 5_000, 200)
+    let store = PostgresSnapshotLogStore::connect_with_timeout(TEST_SERVICE, url.as_str(), 1, 5_000, 200)
         .await
         .unwrap();
     let mut lock = pool.begin().await.unwrap();
@@ -343,7 +345,7 @@ async fn postgres_snapshot_log_bounds_startup_and_read_table_lock_waits() {
     // Do not release the lock until every call has returned by its own deadline.
     let result = timeout(
         Duration::from_secs(2),
-        PostgresSnapshotLogStore::connect_with_timeout(url.as_str(), 1, 5_000, 200),
+        PostgresSnapshotLogStore::connect_with_timeout(TEST_SERVICE, url.as_str(), 1, 5_000, 200),
     )
     .await
     .expect("startup probe must have an execution deadline");
@@ -372,7 +374,7 @@ async fn postgres_snapshot_log_bounds_startup_and_read_table_lock_waits() {
 #[tokio::test]
 #[ignore = "requires a real PostgreSQL database"]
 async fn postgres_snapshot_log_bounds_advisory_lock_and_reuses_pool() {
-    let store = PostgresSnapshotLogStore::connect_with_timeout(&dsn(), 1, 5_000, 200)
+    let store = PostgresSnapshotLogStore::connect_with_timeout(TEST_SERVICE, &dsn(), 1, 5_000, 200)
         .await
         .unwrap();
     let pool = PgPoolOptions::new()
@@ -383,11 +385,21 @@ async fn postgres_snapshot_log_bounds_advisory_lock_and_reuses_pool() {
     let account = uuid::Uuid::new_v4().simple().to_string();
     let mut lock = pool.begin().await.unwrap();
     sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
-        .bind(format!("{}:{}main", account.len(), account))
+        .bind(format!("12:test-service|{}:{}main", account.len(), account))
         .execute(&mut *lock)
         .await
         .unwrap();
     expect_timeout(store.append_rows_if_latest(&account, "main", None, &rows(1, &["/"]))).await;
+    // Another service must append without waiting for this service's lock.
+    let other = PostgresSnapshotLogStore::connect_with_timeout(
+        "other-service", &dsn(), 1, 5_000, 200,
+    )
+    .await
+    .unwrap();
+    other
+        .append_rows_if_latest(&account, "main", None, &rows(1, &["/"]))
+        .await
+        .unwrap();
     lock.rollback().await.unwrap();
     assert!(store
         .load_latest_indexed_commit(&account, "main")
@@ -438,7 +450,7 @@ async fn postgres_snapshot_log_deadline_covers_all_batches_and_rolls_back() {
     let mut url = url::Url::parse(&dsn()).unwrap();
     url.query_pairs_mut()
         .append_pair("options", &format!("-c search_path={schema}"));
-    let store = PostgresSnapshotLogStore::connect_with_timeout(url.as_str(), 1, 5_000, 500)
+    let store = PostgresSnapshotLogStore::connect_with_timeout(TEST_SERVICE, url.as_str(), 1, 5_000, 500)
         .await
         .unwrap();
     let account = uuid::Uuid::new_v4().simple().to_string();
```

**File**: `docs/en/guides/15-snapshot.md` (modified, +10/-6)
```diff
@@ -218,8 +218,13 @@ export OPENVIKING_SNAPSHOT_LOG_POSTGRES_DSN='postgresql://user:password@host:543
 
 Runtime startup does not create or migrate PostgreSQL tables. The runtime role
 needs `SELECT` and `INSERT` on `snapshot_log`, and `USAGE` on its identity sequence.
-Use a dedicated database or schema per OV deployment; accounts and branches
-are isolated within that index. When using a custom schema, set the URL's
+Provision the table with the supplied DDL before deploying.
+Rows, indexes and append locks are scoped by the top-level `service_name`,
+so deployments can share one database or schema. Use the same name for replicas
+of one deployment and distinct names for separate deployments.
+`service_name` accepts 1–64 ASCII letters, digits, `.`, `_` or `-`; `account` is
+limited to 64 bytes. A dedicated database or schema per deployment also works.
+When using a custom schema, set the URL's
 `options` parameter to a URL-encoded `-c search_path=your_schema`.
 No PostgreSQL extension or Python database extra is required: the driver is
 part of the Rust binding (`ragfs/postgres` for standalone Rust consumers).
@@ -232,12 +237,11 @@ Git when the index is unavailable. A write transaction that times out before
 commit is rolled back.
 Increase `operation_timeout_ms` if normal index operations exceed the default.
 
-Each account/branch append is serialized with a transaction advisory lock,
+Each service/account/branch append is serialized with a transaction advisory lock,
 including the first append to an empty index. All rows are committed atomically
 only when the latest indexed commit matches the expected parent.
-Path indexes use `md5(path)` to stay within PostgreSQL B-tree width limits;
-queries also check the original path. A digest collision for the same commit
-rejects the append rather than silently dropping a path.
+Path indexes use the complete path for lookups and uniqueness.
+PostgreSQL indexes branches up to 128 bytes and paths up to 2048 bytes.
 Switching providers does not copy an existing index. Path queries trigger
 background backfill from Git history when needed. An unavailable database or
 missing schema disables the index for that service instance at startup and
```

**File**: `docs/zh/guides/15-snapshot.md` (modified, +8/-4)
```diff
@@ -213,7 +213,11 @@ export OPENVIKING_SNAPSHOT_LOG_POSTGRES_DSN='postgresql://user:password@host:543
 
 运行时不会创建或迁移 PostgreSQL 表。运行账号只需 `snapshot_log` 的
 `SELECT`、`INSERT` 权限，以及 identity sequence 的 `USAGE` 权限。
-不同 OV 部署应使用独立数据库或 schema；同一索引内按账号、分支隔离。
+部署前使用提供的 DDL 建表。
+记录、索引和追加锁都按顶层 `service_name` 隔离，多个部署可以共用数据库或 schema。
+同一部署的副本使用相同名称，不同部署使用不同名称。
+`service_name` 允许 1–64 个 ASCII 字母、数字、`.`、`_` 或 `-`；`account` 上限为 64 字节。
+每个部署使用独立数据库或 schema 也仍然可行。
 自定义 schema 可通过连接 URL 的 `options` 参数指定
 `-c search_path=your_schema`，参数值需要 URL 编码。
 
@@ -225,10 +229,10 @@ PostgreSQL 索引操作有执行期限，连接同时设置 `statement_timeout`
 无需安装 PostgreSQL 扩展或 Python 数据库 extra，驱动由 Rust binding 提供；
 独立 Rust 接入需启用 `ragfs/postgres` feature。
 
-同一账号、分支的索引追加使用事务 advisory lock 串行化，包括空索引的首次写入。
+同一服务、账号、分支的索引追加使用事务 advisory lock 串行化，包括空索引的首次写入。
 仅当最新索引提交等于预期父提交时，整批路径记录才会原子提交。
-路径索引使用 `md5(path)` 避免超过 PostgreSQL B-tree 键宽限制，
-查询同时校验原始路径；同一提交发生摘要冲突时会拒绝整批追加，不会静默丢失路径。
+路径索引使用完整路径查询和保证唯一性。
+PostgreSQL 索引的分支上限为 128 字节，路径上限为 2048 字节。
 切换 provider 不会复制旧索引，按路径查询会在需要时触发从 Git 历史后台回填。
 启动时数据库不可用或缺少表，会为该实例关闭索引并回退到历史扫描；
 恢复后需重启实例。回退扫描仍受 1000 个候选提交上限约束。
```

**File**: `openviking/service/sql/snapshot_log_postgres_init.sql` (modified, +8/-9)
```diff
@@ -1,21 +1,20 @@
 -- Provision once with a deployment/migration role before starting OV.
 -- Runtime needs SELECT and INSERT on snapshot_log and USAGE on its sequence.
--- No extensions are required. Use a dedicated database/schema per OV deployment.
+-- No extensions are required. service_name isolates deployments sharing a database/schema.
 CREATE TABLE IF NOT EXISTS snapshot_log (
     id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
-    account TEXT COLLATE "C" NOT NULL CHECK (octet_length(account) <= 255),
-    branch TEXT COLLATE "C" NOT NULL CHECK (octet_length(branch) <= 512),
+    service_name TEXT COLLATE "C" NOT NULL CHECK (octet_length(service_name) BETWEEN 1 AND 64),
+    account TEXT COLLATE "C" NOT NULL CHECK (octet_length(account) <= 64),
+    branch TEXT COLLATE "C" NOT NULL CHECK (octet_length(branch) <= 128),
     path TEXT COLLATE "C" NOT NULL CHECK (octet_length(path) BETWEEN 1 AND 2048),
     commit_oid TEXT COLLATE "C" NOT NULL CHECK (commit_oid ~ '^[0-9a-fA-F]{40}$'),
     created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
 );
 
--- A path digest keeps maximum-width keys below PostgreSQL's B-tree tuple limit.
--- Queries also compare the original path; digest matches alone are never trusted.
--- A digest collision for the same commit rejects the append rather than losing rows.
+-- Bounded service/account/branch lengths keep full-path keys within the B-tree limit.
 CREATE UNIQUE INDEX IF NOT EXISTS uniq_snapshot_log_path_commit
-    ON snapshot_log (account, branch, md5(path), commit_oid);
+    ON snapshot_log (service_name, account, branch, path, commit_oid);
 CREATE INDEX IF NOT EXISTS idx_snapshot_log_lookup
-    ON snapshot_log (account, branch, md5(path), id DESC);
+    ON snapshot_log (service_name, account, branch, path, id DESC);
 CREATE INDEX IF NOT EXISTS idx_snapshot_log_latest
-    ON snapshot_log (account, branch, id DESC);
+    ON snapshot_log (service_name, account, branch, id DESC);
```

---

### Incident Patch 2: `56e568f4` (2026-11-27)
**Commit Message**: docs(gateway): end the cache-hit range where memory A is missing (#8590)

The 'not replayed' row of the one-turn figure painted Reply 1 and
Message 2 green and bracketed them as 'same as last turn: hit'. A
prefix cache breaks at the first byte that differs, so once memory A
is absent everything after it, from Reply 1 on, is billed at the full
rate. Colour Reply 1 and Message 2 as misses, end the green bracket
after Message 1, and start the red bracket at the missing block.

Co-authored-by: openviking-superagent <[REDACTED_EMAIL]>

**File**: `docs/images/gateway/one-turn.en.svg` (modified, +9/-9)
```diff
@@ -125,9 +125,9 @@
 <text x="364" y="765" font-size="14" font-weight="400" fill="#1F2329" text-anchor="middle">Message 1</text>
 <rect x="416" y="738" width="96" height="44" rx="4" fill="#FFFFFF" stroke="#8F959E" stroke-width="1.5" stroke-dasharray="5 4"/>
 <text x="464" y="765" font-size="14" font-weight="400" fill="#8F959E" text-anchor="middle">none</text>
-<rect x="516" y="738" width="84" height="44" rx="4" fill="#E3F5E1" stroke="#2EA121" stroke-width="1.5"/>
+<rect x="516" y="738" width="84" height="44" rx="4" fill="#FDECEC" stroke="#F54A45" stroke-width="1.5"/>
 <text x="558" y="765" font-size="14" font-weight="400" fill="#1F2329" text-anchor="middle">Reply 1</text>
-<rect x="604" y="738" width="96" height="44" rx="4" fill="#E3F5E1" stroke="#2EA121" stroke-width="1.5"/>
+<rect x="604" y="738" width="96" height="44" rx="4" fill="#FDECEC" stroke="#F54A45" stroke-width="1.5"/>
 <text x="652" y="765" font-size="14" font-weight="400" fill="#1F2329" text-anchor="middle">Message 2</text>
 <rect x="704" y="738" width="96" height="44" rx="4" fill="#FFFFFF" stroke="#F54A45" stroke-width="1.5" stroke-dasharray="5 4"/>
 <text x="752" y="765" font-size="14" font-weight="400" fill="#F54A45" text-anchor="middle">missing</text>
@@ -137,14 +137,14 @@
 <text x="955" y="765" font-size="14" font-weight="400" fill="#1F2329" text-anchor="middle">New message 3</text>
 <rect x="1022" y="738" width="100" height="44" rx="4" fill="#FDECEC" stroke="#F54A45" stroke-width="1.5"/>
 <text x="1072" y="765" font-size="14" font-weight="400" fill="#1F2329" text-anchor="middle">New recall</text>
-<line x1="192" y1="728" x2="700" y2="728" stroke="#2EA121" stroke-width="1.5"/>
+<line x1="192" y1="728" x2="412" y2="728" stroke="#2EA121" stroke-width="1.5"/>
 <line x1="192" y1="728" x2="192" y2="734" stroke="#2EA121" stroke-width="1.5"/>
-<line x1="700" y1="728" x2="700" y2="734" stroke="#2EA121" stroke-width="1.5"/>
-<text x="446" y="721" font-size="14" font-weight="700" fill="#2EA121" text-anchor="middle">Same as last turn: hit</text>
-<line x1="704" y1="728" x2="1122" y2="728" stroke="#F54A45" stroke-width="1.5"/>
-<line x1="704" y1="728" x2="704" y2="734" stroke="#F54A45" stroke-width="1.5"/>
+<line x1="412" y1="728" x2="412" y2="734" stroke="#2EA121" stroke-width="1.5"/>
+<text x="302" y="721" font-size="14" font-weight="700" fill="#2EA121" text-anchor="middle">Same as last turn: hit</text>
+<line x1="416" y1="728" x2="1122" y2="728" stroke="#F54A45" stroke-width="1.5"/>
+<line x1="416" y1="728" x2="416" y2="734" stroke="#F54A45" stroke-width="1.5"/>
 <line x1="1122" y1="728" x2="1122" y2="734" stroke="#F54A45" stroke-width="1.5"/>
-<text x="913" y="721" font-size="14" font-weight="700" fill="#F54A45" text-anchor="middle">Full price from last turn's memory onward</text>
+<text x="769" y="721" font-size="14" font-weight="700" fill="#F54A45" text-anchor="middle">Full price from the missing memory onward</text>
 <rect x="1164" y="652" width="26" height="18" rx="3" fill="#EDE6FF" stroke="#2EA121" stroke-width="1.5"/>
 <text x="1200" y="667" font-size="14" font-weight="400" fill="#646A73" text-anchor="start">Memory the gateway added</text>
 <rect x="1164" y="682" width="26" height="18" rx="3" fill="#E3F5E1" stroke="#2EA121" stroke-width="1.5"/>
@@ -154,7 +154,7 @@
 <rect x="1164" y="742" width="26" height="18" rx="3" fill="#FFFFFF" stroke="#8F959E" stroke-width="1.5"/>
 <text x="1200" y="757" font-size="14" font-weight="400" fill="#646A73" text-anchor="start">New in this turn</text>
 <text x="40" y="812" font-size="14.5" font-weight="400" fill="#646A73" text-anchor="start">The client's history never contains what the gateway added, so the gateway keeps its own record and puts it back on every request.</text>
-<text x="40" y="832" font-size="14.5" font-weight="400" fill="#646A73" text-anchor="start">Without replay, each turn is recomputed from where memory was added in the previous turn; the exact cost depends on the provider's cache breakpoints.</text>
+<text x="40" y="832" font-size="14.5" font-weight="400" fill="#646A73" text-anchor="start">Without replay, the prefix breaks where memory A should be, and everything after it is billed at full price; the exact cost depends on the provider's cache breakpoints.</text>
 <rect x="40" y="856" width="760" height="180" rx="12" fill="#F7F3FF" stroke="#7F3BF5" stroke-width="1.5"/>
 <text x="62" y="888" font-size="17" font-weight="700" fill="#1F2329" text-anchor="start">Across turns: save the conversation, extract memories</text>
 <rect x="62" y="904" width="159.5" height="72" rx="8" fill="#FFFFFF" stroke="#7F3BF5" stroke-width="1.5"/>
```

**File**: `docs/images/gateway/one-turn.zh.svg` (modified, +9/-9)
```diff
@@ -117,9 +117,9 @@
 <text x="355" y="765" font-size="14" font-weight="400" fill="#1F2329" text-anchor="middle">消息 1</text>
 <rect x="402" y="738" width="86" height="44" rx="4" fill="#FFFFFF" stroke="#8F959E" stroke-width="1.5" stroke-dasharray="5 4"/>
 <text x="445" y="765" font-size="14" font-weight="400" fill="#8F959E" text-anchor="middle">无</text>
-<rect x="492" y="738" width="86" height="44" rx="4" fill="#E3F5E1" stroke="#2EA121" stroke-width="1.5"/>
+<rect x="492" y="738" width="86" height="44" rx="4" fill="#FDECEC" stroke="#F54A45" stroke-width="1.5"/>
 <text x="535" y="765" font-size="14" font-weight="400" fill="#1F2329" text-anchor="middle">回复 1</text>
-<rect x="582" y="738" width="86" height="44" rx="4" fill="#E3F5E1" stroke="#2EA121" stroke-width="1.5"/>
+<rect x="582" y="738" width="86" height="44" rx="4" fill="#FDECEC" stroke="#F54A45" stroke-width="1.5"/>
 <text x="625" y="765" font-size="14" font-weight="400" fill="#1F2329" text-anchor="middle">消息 2</text>
 <rect x="672" y="738" width="86" height="44" rx="4" fill="#FFFFFF" stroke="#F54A45" stroke-width="1.5" stroke-dasharray="5 4"/>
 <text x="715" y="765" font-size="14" font-weight="400" fill="#F54A45" text-anchor="middle">缺失</text>
@@ -129,14 +129,14 @@
 <text x="905" y="765" font-size="14" font-weight="400" fill="#1F2329" text-anchor="middle">新消息 3</text>
 <rect x="962" y="738" width="96" height="44" rx="4" fill="#FDECEC" stroke="#F54A45" stroke-width="1.5"/>
 <text x="1010" y="765" font-size="14" font-weight="400" fill="#1F2329" text-anchor="middle">本轮召回</text>
-<line x1="192" y1="728" x2="668" y2="728" stroke="#2EA121" stroke-width="1.5"/>
+<line x1="192" y1="728" x2="398" y2="728" stroke="#2EA121" stroke-width="1.5"/>
 <line x1="192" y1="728" x2="192" y2="734" stroke="#2EA121" stroke-width="1.5"/>
-<line x1="668" y1="728" x2="668" y2="734" stroke="#2EA121" stroke-width="1.5"/>
-<text x="430" y="721" font-size="14" font-weight="700" fill="#2EA121" text-anchor="middle">和上一轮相同，命中</text>
-<line x1="672" y1="728" x2="1058" y2="728" stroke="#F54A45" stroke-width="1.5"/>
-<line x1="672" y1="728" x2="672" y2="734" stroke="#F54A45" stroke-width="1.5"/>
+<line x1="398" y1="728" x2="398" y2="734" stroke="#2EA121" stroke-width="1.5"/>
+<text x="295" y="721" font-size="14" font-weight="700" fill="#2EA121" text-anchor="middle">和上一轮相同，命中</text>
+<line x1="402" y1="728" x2="1058" y2="728" stroke="#F54A45" stroke-width="1.5"/>
+<line x1="402" y1="728" x2="402" y2="734" stroke="#F54A45" stroke-width="1.5"/>
 <line x1="1058" y1="728" x2="1058" y2="734" stroke="#F54A45" stroke-width="1.5"/>
-<text x="865" y="721" font-size="14" font-weight="700" fill="#F54A45" text-anchor="middle">从上一轮补充记忆的位置起按原价重算</text>
+<text x="730" y="721" font-size="14" font-weight="700" fill="#F54A45" text-anchor="middle">从缺失记忆的位置起，后面全部按原价重算</text>
 <rect x="1100" y="652" width="26" height="18" rx="3" fill="#EDE6FF" stroke="#2EA121" stroke-width="1.5"/>
 <text x="1136" y="667" font-size="14" font-weight="400" fill="#646A73" text-anchor="start">网关补充的记忆</text>
 <rect x="1100" y="682" width="26" height="18" rx="3" fill="#E3F5E1" stroke="#2EA121" stroke-width="1.5"/>
@@ -146,7 +146,7 @@
 <rect x="1100" y="742" width="26" height="18" rx="3" fill="#FFFFFF" stroke="#8F959E" stroke-width="1.5"/>
 <text x="1136" y="757" font-size="14" font-weight="400" fill="#646A73" text-anchor="start">本轮新内容</text>
 <text x="40" y="812" font-size="14.5" font-weight="400" fill="#646A73" text-anchor="start">客户端的历史里没有网关补充的内容，网关自己记下，并在每个请求里放回原位。</text>
-<text x="40" y="832" font-size="14.5" font-weight="400" fill="#646A73" text-anchor="start">不放回时，每轮都从上一轮补充记忆的位置起重算，具体还取决于服务商的缓存断点。</text>
+<text x="40" y="832" font-size="14.5" font-weight="400" fill="#646A73" text-anchor="start">不放回时，前缀在记忆 A 本该出现的位置断开，后面的内容全部按原价重算；具体还取决于服务商的缓存断点。</text>
 <rect x="40" y="856" width="760" height="180" rx="12" fill="#F7F3FF" stroke="#7F3BF5" stroke-width="1.5"/>
 <text x="62" y="888" font-size="17" font-weight="700" fill="#1F2329" text-anchor="start">跨轮：保存对话，提取记忆</text>
 <rect x="62" y="904" width="159.5" height="72" rx="8" fill="#FFFFFF" stroke="#7F3BF5" stroke-width="1.5"/>
```

---

### Incident Patch 3: `280caf35` (2026-11-27)
**Commit Message**: fix(privacy): match values next to non-ASCII text, simplify the Betterleaks import (#8602)

* refactor(privacy): import upstream rules without per-rule curation

Drop the exclusion list, the two pattern overrides and the repeated-character exemption, so an upstream bump only needs the tag changed and the script rerun. The generator keeps its rule-agnostic criteria and the skip pattern for formats the hand-written file owns.

* refactor(privacy): keep hand-written rules to OpenViking keys and three key shapes

Remove the Telegram, Alibaba Cloud and Vault detectors. The sk- shapes and the Zhipu shape stay because upstream only matches them next to a provider name.

* build: ship the Betterleaks license in the wheel

The imported rules are compiled into the ragfs extension that the wheel carries, so the MIT notice has to travel with it.

* fix(privacy): replace registered values typed right next to non-ASCII text

The registered-value matcher treated a Han character and an adjacent ASCII value as one word, so a value written without a space after Chinese text was never replaced. Sealing enrolled such a token through the detector and then left it in the text. ASCII next to another scri

**File**: `crates/ragfs/src/privacy_extractor_rules.json` (modified, +0/-40)
```diff
@@ -244,46 +244,6 @@
         ["0a1b2c3d4e5f60718293a4b5c6d7e8f9", ".", "aB3dE5gH7jK9mN2pQ4sT6vW8"],
         ["0A1B2C3D4E5F60718293A4B5C6D7E8F9", ".", "aB3dE5gH7jK9mN2p"]
       ]
-    },
-    {
-      "id": "alibaba_access_key_id",
-      "pattern": "LTAI[A-Za-z0-9]{17,21}",
-      "reject_repeated": true,
-      "positive": [
-        ["LTAI", "aB3dE5gH7jK9mN2pQ"],
-        ["LTAI", "aB3dE5gH7jK9mN2pQ4sT"]
-      ],
-      "negative": [
-        ["LTAI", "aB3dE5gH7jK9mN2p"],
-        ["LTAI", "aB3dE5gH7jK9mN2pQ4sT6v"],
-        ["LTAI", "EXAMPLE", "aB3dE5gH7jK9m"]
-      ]
-    },
-    {
-      "id": "vault",
-      "pattern": "hvs\\.[A-Za-z0-9_-]{90,120}",
-      "reject_repeated": true,
-      "positive": [
-        ["hvs.", "aB3dE5gH7jK9mN2pQ4sT6vW8yZ0cF1rUaB3dE5gH7jK9mN2pQ4sT6vW8yZ0cF1rUaB3dE5gH7jK9mN2pQ4sT6vW8yZ"]
-      ],
-      "negative": [
-        ["hvs.", "aB3dE5gH7jK9mN2pQ4sT6vW8yZ0cF1rUaB3dE5gH7jK9mN2pQ4sT6vW8yZ0cF1rU"],
-        ["hvs.", "your-vault-token"]
-      ]
-    },
-    {
-      "id": "telegram_bot_token",
-      "pattern": "(?:bot)?[0-9]{5,16}:A[A-Za-z0-9_-]{34}",
-      "reject_repeated": true,
-      "positive": [
-        ["1234567890:A", "aB3dE5gH7jK9mN2pQ4sT6vW8yZ0cF1rUaB"],
-        ["bot1234567890:A", "aB3dE5gH7jK9mN2pQ4sT6vW8yZ0cF1rUaB"]
-      ],
-      "negative": [
-        ["1234:A", "aB3dE5gH7jK9mN2pQ4sT6vW8yZ0cF1rUaB"],
-        ["1234567890:B", "aB3dE5gH7jK9mN2pQ4sT6vW8yZ0cF1rUaB"],
-        ["1234567890:A", "aB3dE5gH7jK9mN2pQ4sT6vW8yZ0cF1rUa"]
-      ]
     }
   ],
   "reference_pattern": "\\{\\{[ \\t]*ov_privacy:[^{}\\r\\n]+\\}\\}"
```

**File**: `crates/ragfs/src/privacy_extractor_rules_betterleaks.json` (modified, +10/-3)
```diff
@@ -12,10 +12,13 @@
     {"id": "artifactory-api-key", "pattern": "AKCp[A-Za-z0-9]{68,70}", "reject_repeated": true},
     {"id": "artifactory-reference-token", "pattern": "cmVmd[A-Za-z0-9]{59}", "reject_repeated": true},
     {"id": "atlassian-api-token", "pattern": "ATAT[A-Za-z0-9_\\-=]{100,}", "reject_repeated": true},
+    {"id": "authress-service-client-access-key", "pattern": "(?i)(?:sc|ext|scauth|authress)_[a-z0-9]{5,30}\\.[a-z0-9]{4,6}\\.acc[_-][a-z0-9-]{10,32}\\.[a-z0-9+/_=-]{30,120}", "reject_repeated": true},
     {"id": "aws-amazon-bedrock-api-key-long-lived", "pattern": "ABSK[A-Za-z0-9+/]{109,269}={0,2}", "reject_repeated": true},
+    {"id": "azure-servicebus-connection-string", "pattern": "(?i)Endpoint=sb://[a-z0-9-]+\\.servicebus\\.windows\\.net/;SharedAccessKeyName=[^;=\\t\\n\\f\\r '\"]{1,128};SharedAccessKey=[A-Za-z0-9+/]{32,100}={0,2}(?:;EntityPath=[^;\\t\\n\\f\\r '\"]{1,128})?", "reject_repeated": true},
     {"id": "bitbucket-data-center-token", "pattern": "BBDC-[A-Za-z0-9+/=]{32,}", "reject_repeated": true},
+    {"id": "brave-search-api-key", "pattern": "BSA[A-Za-z0-9_-]{24,40}", "reject_repeated": true},
     {"id": "buildkite-service-token", "pattern": "bkaa_[A-Za-z0-9_-]{75}|bkaj_[A-Za-z0-9_-]{333}|bkar_[A-Za-z0-9_-]{73}|bkct_[A-Za-z0-9_-]{73}|bkpt_[A-Za-z0-9_-]{199}|bkpat_[A-Za-z0-9_-]{54}|bkps_[A-Za-z0-9_-]{64}", "reject_repeated": true},
-    {"id": "buildkite-user-access-token", "pattern": "bkua_(?:[a-z0-9]{53}|[a-z0-9]{40})", "reject_repeated": true},
+    {"id": "buildkite-user-access-token", "pattern": "bkua_(?:[a-z0-9]{40}|[a-z0-9]{53})", "reject_repeated": true},
     {"id": "cal-api-key", "pattern": "cal_live_[a-f0-9]{32}", "reject_repeated": true},
     {"id": "canva-client-secret", "pattern": "cnvca[a-zA-Z0-9_-]{51}", "reject_repeated": true},
     {"id": "cartesia-api-key.1", "pattern": "sk_car_[A-Za-z0-9_]{20}", "reject_repeated": true},
@@ -29,7 +32,7 @@
     {"id": "cockroachlabs-cloud-api-key", "pattern": "CCDB1_[A-Za-z0-9]{22}_[A-Za-z0-9]{40}", "reject_repeated": true},
     {"id": "configcat-sdk-key-extended", "pattern": "configcat-sdk-1/[A-Za-z0-9_-]{22}/[A-Za-z0-9_-]{22}", "reject_repeated": true},
     {"id": "databricks-api-token", "pattern": "dapi[a-f0-9]{32}(?:-[0-9])?", "reject_repeated": true},
-    {"id": "datastax-astra-application-token", "pattern": "AstraCS:[A-Za-z0-9]{20,}:[a-f0-9]{64}", "reject_repeated": true},
+    {"id": "datastax-astra-application-token", "pattern": "AstraCS:[A-Za-z0-9]{20,}", "reject_repeated": true},
     {"id": "daytona-api-key", "pattern": "dtn_[a-f0-9]{64}", "reject_repeated": true},
     {"id": "deno-account-token", "pattern": "ddp_[A-Za-z0-9]{36}", "reject_repeated": true},
     {"id": "devcycle-server-sdk-key", "pattern": "dvc_server_[A-Za-z0-9]{8,32}", "reject_repeated": true},
@@ -54,7 +57,7 @@
     {"id": "figma-personal-access-token", "pattern": "(?i)figd_[A-Z0-9_-]{38,42}", "reject_repeated": true},
     {"id": "flutterwave-encryption-key", "pattern": "FLWSECK_TEST-(?i)[a-h0-9]{12}", "reject_repeated": true},
     {"id": "flutterwave-secret-key", "pattern": "FLWSECK_TEST-(?i)[a-h0-9]{32}-X", "reject_repeated": true},
-    {"id": "flyio-access-token", "pattern": "FlyV1[\\t\\n\\f\\r ][A-Za-z0-9=_\\-,/+]{100,}"},
+    {"id": "flyio-access-token", "pattern": "FlyV1[\\t\\n\\f\\r ][A-Za-z0-9=_\\-,/+]{100,}", "reject_repeated": true},
     {"id": "frameio-api-token", "pattern": "fio-u-(?i)[a-z0-9\\-_=]{64}", "reject_repeated": true},
     {"id": "gcp-api-key", "pattern": "AIza[0-9A-Za-z_-]{35}", "reject_repeated": true},
     {"id": "gcp-gemini-api", "pattern": "AQ\\.Ab8RN6[A-Za-z0-9_-]{44}", "reject_repeated": true},
@@ -91,6 +94,7 @@
     {"id": "langchain-langsmith-personal-access-token", "pattern": "lsv2_pt_[0-9a-fA-F]{32}_[0-9a-fA-F]{10}", "reject_repeated": true},
     {"id": "langchain-langsmith-service-key", "pattern": "lsv2_sk_[0-9a-fA-F]{32}_[0-9a-fA-F]{10}", "reject_repeated": true},
     {"id": "langfuse-secret-key.1", "pattern": "sk-lf-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}", "reject_repeated": true},
+    {"id": "lichess-personal-access-token", "pattern": "lip_[A-Za-z0-9_]{16,60}", "reject_repeated": true},
     {"id": "linear-api-key", "pattern": "lin_api_(?i)[a-z0-9]{40}", "reject_repeated": true},
     {"id": "llama-cloud-api-key.1", "pattern": "llx-[A-Za-z0-9]{44,52}", "reject_repeated": true},
     {"id": "mailersend-api-token", "pattern": "mlsn\\.[A-Za-z0-9]{30,100}", "reject_repeated": true},
@@ -122,11 +126,13 @@
     {"id": "planetscale-api-token", "pattern": "pscale_tkn_(?i)[0-9A-Za-z_=\\.-]{32,64}", "reject_repeated": true},
     {"id": "planetscale-oauth-token", "pattern": "pscale_oauth_[0-9A-Za-z_=\\.-]{32,64}", "reject_repeated": true},
     {"id": "planetscale-password", "pattern": "(?i)pscale_pw_(?i)[0-9A-Za-z_=\\.-]{32,64}", "reject_repeated": true},
+    {"id": "polar-oauth-access-token", "pattern": "polar_at_[A-Za-z0-9_-]{20,100}", "reject_repeated": true},
     {"id":
```

**File**: `crates/ragfs/src/privacy_matcher.rs` (modified, +15/-7)
```diff
@@ -115,9 +115,10 @@ impl PrivacyMatcher {
             parent_prefix[index] = prefixes.last().copied().unwrap_or(patterns.len());
             for &prefix in prefixes.iter().rev() {
                 let end = patterns[prefix].len();
-                if !(value[..end].chars().next_back().is_some_and(word_char)
-                    && value[end..].chars().next().is_some_and(word_char))
-                {
+                if !joins_word(
+                    value[..end].chars().next_back(),
+                    value[end..].chars().next(),
+                ) {
                     shorter_prefixes[index] = Some(PatternID::must(prefix));
                     break;
                 }
@@ -457,8 +458,15 @@ fn next_unmarked_prefix(links: &mut [usize], mut index: usize) -> usize {
 }
 // Matches may not split adjacent word characters.
 fn is_match_boundary(content: &str, at: usize) -> bool {
-    !(content[..at].chars().next_back().is_some_and(word_char)
-        && content[at..].chars().next().is_some_and(word_char))
+    !joins_word(
+        content[..at].chars().next_back(),
+        content[at..].chars().next(),
+    )
+}
+// ASCII next to another script, such as a token typed right after Chinese text, is not one word.
+fn joins_word(left: Option<char>, right: Option<char>) -> bool {
+    matches!((left, right), (Some(l), Some(r))
+        if word_char(l) && word_char(r) && l.is_ascii() == r.is_ascii())
 }
 fn word_char(c: char) -> bool {
     c.is_alphanumeric() || c == '_'
@@ -497,9 +505,9 @@ mod tests {
         ]);
         assert_eq!(
             matcher
-                .sanitize("pass123-v2x pass123-v2 中pass123 pass123_ pass123²")
+                .sanitize("pass123-v2x pass123-v2 中pass123 pass123_ pass123² 秘密值们 x秘密")
                 .content,
-            "short-v2x long 中pass123 pass123_ pass123²"
+            "short-v2x long 中short pass123_ short² 秘密值们 xshort"
         );
         let input = format!("🙂秘密值 {reference} session default");
         let (found, exceeded) = matcher.find_limited(&input, 3);
```

**File**: `docs/en/concepts/13-privacy.md` (modified, +1/-1)
```diff
@@ -225,7 +225,7 @@ Restoration is supported for these files under the current user's Session direct
 
 PrivacySanitizer does not infer sensitivity from field names. String values in the active Privacy catalog participate in automatic content scanning and reference replacement only when they contain at least 6 Unicode characters. Shorter values can still be stored, referenced, and explicitly resolved, but are excluded from global substring replacement to reduce false positives in ordinary text. Python owns catalog loading, reference generation, and cache policy; matcher construction, leftmost-longest matching, and text rewriting run in RAGFS's Rust Aho-Corasick implementation through a reusable PyO3 matcher that releases the GIL while scanning. The matcher catalog is cached per user and process-local revision; local changes invalidate it immediately, and a 3600-second TTL bounds staleness after changes made by another worker or node.
 
-Values stored under `credential` for the current user take priority. Otherwise, only values in the current Skill's or Session's Privacy config that match a recognized credential format are used. Matching respects word boundaries and skips values listed in `never_mask`.
+Values stored under `credential` for the current user take priority. Otherwise, only values in the current Skill's or Session's Privacy config that match a recognized credential format are used. Matching respects word boundaries, where an ASCII value next to text in another script such as Chinese still counts as a whole word, and skips values listed in `never_mask`.
 
 Using a GitHub Personal Access Token (PAT) as an example:
 
```

**File**: `docs/zh/concepts/13-privacy.md` (modified, +1/-1)
```diff
@@ -223,7 +223,7 @@ fs.read(uri)
 
 PrivacySanitizer 不根据字段名猜测敏感性。当前 active Privacy 中长度不少于 6 个 Unicode 字符的字符串值会参与正文自动扫描与引用替换；更短的值仍可保存、引用和显式读取，但不会参与全文替换，以降低普通正文误命中。Python 负责目录、引用和缓存策略，匹配器构建、最长匹配与正文重写由 `ragfs` 的 Rust Aho-Corasick 实现完成，并通过 PyO3 复用不可变 matcher、扫描时释放 GIL。匹配目录按用户和本进程 revision 缓存，本进程修改会立即失效，另外设有 3600 秒缓存 TTL 以覆盖多 worker/多节点修改。
 
-上述按值匹配优先使用当前用户的 `credential`；未命中时，仅使用当前 Skill 或 Session 中符合凭据格式的值，其他对象不参与匹配。匹配遵循词边界，并排除 `never_mask` 中的值。
+上述按值匹配优先使用当前用户的 `credential`；未命中时，仅使用当前 Skill 或 Session 中符合凭据格式的值，其他对象不参与匹配。匹配遵循词边界（ASCII 值紧贴中文等其他文字时仍算完整的词），并排除 `never_mask` 中的值。
 
 以保存 GitHub Personal Access Token（PAT）为例：
 
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ authors = [
     {name = "ByteDance", email = "noreply@bytedance.com"}
 ]
 license = "AGPL-3.0"
+license-files = ["LICENSE", "crates/ragfs/src/BETTERLEAKS_LICENSE.txt"]
 classifiers = [
     "Development Status :: 3 - Alpha",
     "Intended Audience :: Developers",
```

**File**: `scripts/maintenance/privacy_rules/sync_betterleaks.py` (modified, +1/-25)
```diff
@@ -38,25 +38,6 @@
     r"^(?:anthropic|aws-access-token|github|jwt|openai|private-key"
     r"|slack-(?:app|bot|config-access|legacy|user)-)"
 )
-EXCLUDED = {
-    # The prefix and body also fit ordinary identifiers such as prf_hmac_sha256_expand_label.
-    "brave-search-api-key": "matches ordinary identifiers",
-    "lichess-personal-access-token": "matches ordinary identifiers",
-    "polar-oauth-access-token": "matches ordinary identifiers",
-    "proof-full-access-api-key": "matches ordinary identifiers",
-    "thunderstore-api-token.1": "matches ordinary identifiers",
-    # Their lazy DFAs do not fit the per-pattern cache of the built-in detectors.
-    "authress-service-client-access-key": "too large for the built-in cache budget",
-    "azure-servicebus-connection-string": "too large for the built-in cache budget",
-}
-# Upstream relies on a trailing \b to reach the longer branch or to stop early; the
-# extractor checks boundaries after matching, so these need the full token spelled out.
-OVERRIDES = {
-    "buildkite-user-access-token": "bkua_(?:[a-z0-9]{53}|[a-z0-9]{40})",
-    "datastax-astra-application-token": "AstraCS:[A-Za-z0-9]{20,}:[a-f0-9]{64}",
-}
-# Real tokens of these rules contain long runs of one character.
-KEEP_REPEATED = {"flyio-access-token"}
 MIN_PREFIX = 3
 
 ASCII_CLASS = {"w": "0-9A-Za-z_", "d": "0-9", "s": r"\t\n\f\r "}
@@ -239,8 +220,6 @@ def convert(rules: list[dict]) -> tuple[list[dict], dict[str, str]]:
         try:
             if HAND_WRITTEN.match(rule_id):
                 raise Skip("covered by a hand-written detector")
-            if rule_id in EXCLUDED:
-                raise Skip(EXCLUDED[rule_id])
             if not rule.get("regex") or rule.get("path"):
                 raise Skip("matches file paths")
             if rule.get("skipReport"):
@@ -253,10 +232,7 @@ def convert(rules: list[dict]) -> tuple[list[dict], dict[str, str]]:
                 raise Skip("no fixed prefix")
             if fixed:
                 raise Skip("fixed string without a secret part")
-            detector = {"id": rule_id, "pattern": to_rust(OVERRIDES.get(rule_id, pattern))}
-            if rule_id not in KEEP_REPEATED:
-                detector["reject_repeated"] = True
-            detectors.append(detector)
+            detectors.append({"id": rule_id, "pattern": to_rust(pattern), "reject_repeated": True})
         except Skip as reason:
             skipped[rule_id] = str(reason)
     return sorted(detectors, key=lambda detector: detector["id"]), skipped
```

**File**: `tests/server/test_api_privacy_configs.py` (modified, +15/-0)
```diff
@@ -677,6 +677,21 @@ async def test_privacy_seal_replaces_registered_values_when_mode_is_off(
     assert again == {"revision": revision, "texts": [None]}
 
 
+async def test_privacy_seal_replaces_a_new_token_typed_next_to_cjk_text(client: httpx.AsyncClient):
+    token = _github_token("cjk-adjacent")
+    response = await _seal(
+        client,
+        {"text": f"密钥是{token}请保存", "enroll": True},
+        f"历史消息里的{token}也要替换",
+    )
+    assert response.status_code == 200, response.text
+    sealed, history = response.json()["result"]["texts"]
+    reference = sealed["replaced"][0]["reference"]
+    assert sealed["replaced"][0]["created"] is True
+    assert sealed["text"] == f"密钥是{reference}请保存"
+    assert history["text"] == f"历史消息里的{reference}也要替换"
+
+
 async def test_privacy_seal_enrolls_new_tokens_once(client: httpx.AsyncClient, service):
     token = _github_token("enroll-once")
     first = await _seal(
```

#### Recent Merged Pull Requests:
- **PR #8603** (closed): fix(privacy): replace registered values typed right next to non-ASCII text (@t0saki)
- **PR #8602** (2026-11-27): fix(privacy): match values next to non-ASCII text, simplify the Betterleaks import (@t0saki)
- **PR #8597** (2026-11-27): fix(superagent): keep card images named by img_key or i18n_img_key (@ZaynJarvis)
- **PR #8595** (2026-11-27): fix(superagent): read one language of a composite interactive card (@MaojiaSheng)
- **PR #8590** (2026-11-27): docs(gateway): end the cache-hit range where memory A is missing (@openviking-superagent)
- **PR #8588** (2026-11-27): fix(snapshot-log)!: backport mysql branch limit to v0.5.6 (@baojun-zhang)

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

## X. snapshot-log)!: scope postgres indexes and use full paths

**RULE**:
When implementing operations in `crates/ragfs-python/src/git.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bab33336`: snapshot-log)!: scope postgres indexes and use full paths. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/ragfs-python/src/git.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
                service_name,
        let other = build_snapshot_log_store(&cfg, "other-service")
            .unwrap()
            .expect("PG index enabled for another service");
            assert!(other
                .load_latest_indexed_commit(&account, "main")
                .await
                .unwrap()
                .is_none());
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bab33336` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
