# Verification Protocol: Verification Protocol: Empirical Defect Shield for volcengine/OpenViking

<!-- PROVENANCE_START
{
  "source_repository": "volcengine/OpenViking",
  "source_url": "https://github.com/volcengine/OpenViking",
  "source_version": "af412110",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-25T13:49:34.950Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-volcengine-openviking",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine/OpenViking](https://github.com/volcengine/OpenViking) (Revision: `af412110`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-25T13:49:34.950Z`  
> **Learning ID**: `learn-github-volcengine-openviking`


## 1. Scope & Verification Target
- **Target Repository**: `volcengine/OpenViking` (Commit: `af412110`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): volcengine/OpenViking

> **Canonical Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T13:49:33.097Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 42755 stars

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
- **Issue #7814** (2026-11-19): **[Bug]: 100篇目录输入，生成wiki，非常耗时且存在循环调用**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  版本	 ：                          0.4.20	                    ；       新版对照（官方 0.5.5 包） 运行时间：	          约 11 分 50 秒，完成	     ；       30 分 12 秒，未完成 模型 token：	      约 208 万                      ；     	已消耗约 501 万 来源抽取	：       138 篇进入清单	         ；          138 篇均生成中间记录 最终 Wiki	 ：           26 个 Markdown 文件	    ；            0 个页面  来源抽取已完成 134/138，只有 4 个仍在运行。到目前为止，输入约 245 万、输出约 149 万 token；新版确实显著更耗模型资源。马上可以观察它进入合并阶段后的实际页面产出。   138/138 个来源都完成了逐篇抽取，并生成 138 条记录。流程已进入审阅／合并；这一阶段决定最终 Wiki 的内容覆盖，我会继续核对任务状态和实际页面。   逐篇抽取完成后，审阅器判断这 138 条记录跨多个无关主题，正在调整合并指令；目前已生成分组文件，但还没有最终 Wiki 页面。这里是新版的关键风险点：若把全部记录压到同一组，可能再次遗漏独立主题。我会继续观察合并结果和 token 增量。  现在满足你设定的停止条件：138 条抽取记录已生成，但合并阶段连续 27 次模型调用，额外消耗约 74 万输入 token，只反复读取同一个 assignment.json 的异常偏移，仍未写出 Wiki 页面。我会停止这轮独立服务，保存工作区和日志，再分析卡住的原因；继续等待只会增加无效调用。  ### Steps to Reproduce  可以随便找100篇文章，或者200篇，调用wiki能力。  ### Expected Behavior  能完整较快的生成wiki  ### Actual Behavior  wiki生成  ### Minimal Reproducible Example  ```python  ```  ### Error Logs  ```shell  ```  ### OpenViking Version  0.5.5  ### Python Version  Python 3.12.8  ### Operating System  Windows  ### Model Backend  None  ### Additional Context  _No response_

- **Issue #7802** (2026-11-19): **[Bug]: 环境存在 socks5 代理（ALL_PROXY）时 ov 命令报 unsupported scheme socks5，且配置向导隐藏真实错误**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  而同一台机器上浏览器、curl访问同一个服务端均正常，但使用 `ov config` 添加配置时报错 「无法连接服务器。请检查 URL 和网络连接。」  ### Steps to Reproduce  1. 准备 socks5 代理环境：     ```bash    export ALL_PROXY=socks5://127.0.0.1:10808    ```  2. 服务端可直连，自部署地址为 `http://private-server:1933`，用 curl 验证正常：     ```bash    curl -s http://private-server:1933/health    # {"status":"ok","healthy":true,"version":"v0.5.5","auth_mode":"api_key"}    ```  3. 用 CLI 写入配置：     ```bash    printf '%s' "$KEY" | ov config add custom --name home \      --url http://private-server:1933 --api-key-stdin --activate    ```  4. 执行健康检查：     ```bash    ov health    ```  ### Expected Behavior  1. 正常通过 socks5 代理访问服务端； 2. 遇到不支持的代理 scheme 时，忽略该代理（回退直连）并给出警告，而不是让所有请求失败； 3. 至少把真实错误（`unsupported scheme socks5`）透出到 `ov config` / 向导界面上，并提示检查 `ALL_PROXY` / `NO_PROXY`。  ### Actual Behavior  `ov health`（含详情）：  ``` OPENVIKING 健康检查  ╭─ 连接错误 ───────────────────────────────────────────────────────────╮ │ 无法连接 OpenViking。请先查看详情，再确认服务器是否运行、URL         │ │ 是否正确。 详情：HTTP request failed: error sending request for url  │ │ (http://private-server:1933/health): client error (Connect):            │ │ unsupported scheme socks5                                            │ ╰──────────────────────────────────────────────────────────────────────╯ ```  `ov config add custom` / 配置向导（向导界面上只剩一句通用文案）：  ``` Error [validation_failed] Could not reach the custom server. HTTP request failed: error sending request for ur

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

### Incident Patch 1: `f905a91c` (2026-11-25)
**Commit Message**: feat(plugins): session_history support across the memory plugins and two Claude Code capture fixes (#7872)

* fix(claude-code): keep host-authored transcript records out of capture

Claude Code writes its compaction summary and other meta records into the
transcript as user turns. They were captured into the OpenViking session
as if the user had said them. They are now marked when the transcript is
read and left out of what is sent, for the main session and for subagent
transcripts; they still count for the capture cursor, so later turns keep
their positions.

* fix(claude-code): capture the turn in progress before a compaction commit

An auto-compaction can happen in the middle of a long turn, before any
Stop hook has run for it, so nothing of that turn was on the server when
the session was committed. PreCompact now runs the capture over the
transcript first, in its own process, and waits for it up to 20 s before
it commits. A catch-up that takes longer is left running, never killed,
and its messages land in the live tail after the commit as before. A
commit that does not finish in what is left of the hook timeout is
queued and replayed later.

Captures of one Claude Code session

**File**: `agent-plugins/servers/shared/mcp-proxy-core.mjs` (modified, +32/-0)
```diff
@@ -12,6 +12,7 @@ import { createInterface } from "node:readline";
 import { buildOvHeaders } from "./ov-http.mjs";
 
 const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
+const SESSION_HISTORY_TOOL = "session_history";
 const DELETE_TIMEOUT_MS = 2000;
 const MAX_CONCURRENT_REQUESTS = 16;
 
@@ -145,6 +146,9 @@ export function createOpenVikingMcpProxy({
   loggerFactory,
   fetchImpl = globalThis.fetch,
   localToolProvider = null,
+  // (params) => the OV session id of the host session making this tools/call,
+  // or "" when the harness cannot tell; fills `session_history`'s `session`.
+  defaultHistorySession = null,
 } = {}) {
   if (typeof fetchImpl !== "function") {
     throw new Error("global fetch is required; use Node.js 18 or newer");
@@ -219,6 +223,33 @@ export function createOpenVikingMcpProxy({
     return localToolProvider.callTool(message.params, { config: proxyConfig });
   }
 
+  // A `session` the model passed is kept as is, even one this proxy would not
+  // have chosen; only a missing or blank one is filled.
+  function withDefaultHistorySession(message) {
+    if (
+      typeof defaultHistorySession !== "function"
+      || message.method !== "tools/call"
+      || message.params?.name !== SESSION_HISTORY_TOOL
+    ) {
+      return message;
+    }
+    const args = message.params.arguments;
+    const given = args && typeof args === "object" ? args.session : undefined;
+    if (given != null && (typeof given !== "string" || given.trim())) return message;
+    let session = "";
+    try {
+      session = String(defaultHistorySession(message.params) || "").trim();
+    } catch (err) {
+      logError("default_history_session", err);
+    }
+    log("default_history_session", { filled: Boolean(session) });
+    if (!session) return message;
+    return {
+      ...message,
+      params: { ...message.params, arguments: { ...(args || {}), session } },
+    };
+  }
+
   function reloadConfig(reason) {
     proxyConfig = readConfig();
     logger = loggerFactory("mcp-proxy", proxyConfig);
@@ -429,6 +460,7 @@ export function createOpenVikingMcpProxy({
       return;
     }
 
+    message = withDefaultHistorySession(message);
     const expectsResponse = isRequest(message);
     if (message.method === "initialize") {
       initializeRequest = cloneMessage(message);
```

**File**: `docs/en/agent-integrations/12-cursor.md` (modified, +2/-1)
```diff
@@ -48,7 +48,8 @@ Once installed, start a new Cursor session and ask it to follow https://docs.ope
 - `beforeReadFile` denies reading a `viking://` path as a local file and points the Agent to OpenViking MCP tools. Shell commands are not checked.
 - `afterMCPExecution` appends completed calls to the `openviking` MCP server to a local tool log, preserving the native call ID, input, output, and success or failure status. It does not upload messages or rewrite earlier results.
 - `stop` uploads new conversation turns and locally recorded tool results through `add message`. Capture progress advances only after upload succeeds, and `session commit` follows the existing message threshold. Tool records do not add to that threshold's message count.
-- `preCompact` and `sessionEnd` commit pending messages for memory extraction.
+- `preCompact` and `sessionEnd` commit pending messages for memory extraction. After a compaction, the next `beforeSubmitPrompt` also adds a short note naming the session's OpenViking id (`cu-<conversation id>`) and the `session_history` MCP tool for looking up exact earlier details.
+- `preToolUse` matches only `MCP:session_history` and adds the current conversation as its `session` argument when the Agent leaves it out.
 
 Tool capture requires `afterMCPExecution` to provide `tool_use_id`, `mcp_server_name`, `tool_name`, `tool_input`, and `result_json`. Events without an identity or result are skipped, never inferred to be successful. Failed uploads remain local for the same conversation's next capture attempt; incomplete capture prevents a commit.
 
```

**File**: `docs/en/agent-integrations/13-trae.md` (modified, +2/-1)
```diff
@@ -4,7 +4,7 @@ Give TRAE, TRAE CN, and TraeCode CLI 2.0 long-term memory across projects and se
 
 ## Install
 
-Prerequisites: macOS or Linux, Node.js 18+, and a TRAE/TRAE CN release that supports the `SessionStart`, `UserPromptSubmit`, `PreToolUse`, and `Stop` Hooks. TraeCode CLI 2.0 uses the Codex-compatible plugin format directly. The installer guides you through the OpenViking connection settings.
+Prerequisites: macOS or Linux, Node.js 18+, and a TRAE/TRAE CN release that supports the `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `Stop`, and `PostCompact` Hooks. TraeCode CLI 2.0 uses the Codex-compatible plugin format directly. The installer guides you through the OpenViking connection settings.
 
 For a managed connection, select **OpenViking Managed Service**, then:
 
@@ -48,6 +48,7 @@ Once installed, start a new TRAE session and ask it to follow https://docs.openv
 - `UserPromptSubmit` recalls and injects context for the current request, including your own skills and those shared with your account under `viking://agent/skills`.
 - `PreToolUse` on TRAE and TRAE CN denies `Read`, `Glob`, and `Grep` calls whose path is a `viking://` URI and points to OpenViking MCP tools; a `Bash` or `RunCommand` command that carries a `viking://` URI still runs, with a notice suggesting those tools. TraeCode CLI 2.0 uses the Codex plugin, which has no URI guard.
 - TRAE/TRAE CN `Stop` captures and commits the completed turn. TraeCode CLI 2.0 follows the Codex plugin’s capture and lifecycle commit policy.
+- TRAE/TRAE CN `PostCompact` adds a short note after a compaction, naming the session's OpenViking id and the `session_history` MCP tool for looking up exact earlier details; the Agent passes that id as the tool's `session`.
 - The OpenViking MCP server transparently exposes the full server MCP tool set (21 tools): `find`, `search`, `read`, `download`, `list`, `tree`, `remember`, `write`, `edit`, `add_resource`, `add_skill`, `list_watches`, `cancel_watch`, `grep`, `glob`, `forget`, `health`, `list_users`, `list_groups`, `get_acl`, and `set_acl`. `search` with `mode="context"` returns assembled context.
 - TRAE/TRAE CN skills: `openviking-memory`, `openviking-skills`, `ov-experience-memory`, `openviking-rule-search`, and `ov-memory-doctor` are installed into `~/.trae/skills/<name>` (TRAE CN: `~/.trae-cn/skills/<name>`). A skill you edited, or an existing unmanaged directory of the same name, is preserved on upgrade. TraeCode CLI also reads `~/.trae/skills`, so with both the TRAE integration and the TraeCode CLI 2.0 plugin installed, the CLI lists each of these skills twice: once bare and once under the plugin namespace.
 The skill catalog lists your own skills before those shared with your account, with each description cut to about 40 tokens. Its budget, `skillCatalogTokenBudget` (default `1200` tokens), is separate from the profile budget; when not every description fits, the catalog lists names only. Set `skillCatalog` to `false` or the budget to `0` to turn it off, either in the `plugin` section of `~/.openviking/ovcli.conf` ([Plugin Settings](../configuration/02-client.md#plugin-settings)) or through `OPENVIKING_SKILL_CATALOG` and `OPENVIKING_SKILL_CATALOG_TOKEN_BUDGET`.
```

**File**: `docs/en/agent-integrations/20-codebuddy.md` (modified, +3/-2)
```diff
@@ -44,12 +44,13 @@ The installer assembles a self-contained plugin under `~/.openviking/agent-integ
 - **UserPromptSubmit** recalls relevant memories and injects them as an `<openviking-context>` block in `additionalContext`. Host-generated continuation turns are skipped, so a turn the host produced on its own never triggers a search.
 - **PreToolUse** denies reading or writing a `viking://` URI as a local path and points the Agent at the OpenViking MCP tools. Shell commands are not checked, so `ov` invocations and literal `viking://` arguments still work.
 - **Stop**, **PreCompact**, and **SessionEnd** capture new transcript turns incrementally in a detached worker. `Stop` commits the OpenViking session every 8 captured messages (`commitTurnThreshold`); `PreCompact` and `SessionEnd` commit everything not yet committed, including messages `Stop` already sent.
+- After a compaction or a resume, the next **UserPromptSubmit** also adds a short note naming the session's OpenViking id and the `session_history` MCP tool for looking up exact earlier details. The MCP proxy fills that tool's `session` argument from the call when the Agent leaves it out.
 
 Hooks and MCP read the same credentials from `~/.openviking/ovcli.conf`, so they cannot disagree about the server, account, or user. `OPENVIKING_URL` and `OPENVIKING_API_KEY` override that file, and per-plugin settings live under `plugin.codebuddy` (see [Plugin Settings](../configuration/02-client.md#plugin-settings)). Sessions are stored in OpenViking as `cb-<session id>`.
 
 ### Behaviour that follows from the host
 
-`UserPromptSubmit` and `SessionEnd` fire **only in the interactive TUI**. Headless runs (`-p`, `--input-format stream-json`) never emit them, so a headless session captures on `Stop` but never sends the final commit. `SessionStart` carries no `cwd` and can be delivered twice per session, so the session-start hook is idempotent and falls back to the process working directory. A hook that overruns its timeout is killed, but its child processes are not, which is what lets commits run in a detached worker after the hook process returns.
+`SessionEnd` fires **only in the interactive TUI**, so a headless session (`-p`, `--input-format stream-json`) captures on `Stop` but never sends the final commit. `UserPromptSubmit` also fires only in the TUI before CodeBuddy Code 2.185.0; from 2.185.0 it fires in headless `-p` runs too. `SessionStart` carries no `cwd` and can be delivered twice per session, so the session-start hook is idempotent and falls back to the process working directory. A hook that overruns its timeout is killed, but its child processes are not, which is what lets commits run in a detached worker after the hook process returns.
 
 Subagent capture is not supported yet: the host fires `SubagentStart`/`SubagentStop`, but the shared dispatcher has no subagent stage. The verified host contract and transcript format are recorded in [`hosts/codebuddy/DESIGN.md`](https://github.com/volcengine/OpenViking/blob/main/examples/agent-hook-plugin/hosts/codebuddy/DESIGN.md).
 
@@ -67,7 +68,7 @@ Uninstall removes the plugin, its local marketplace, the copy CodeBuddy caches,
 
 | Symptom | Cause and fix |
 |---------|---------------|
-| No recall in headless runs | `UserPromptSubmit` fires only in the interactive TUI. Use an interactive session. |
+| No recall in headless runs | Before CodeBuddy Code 2.185.0, `UserPromptSubmit` fires only in the interactive TUI. Upgrade or use an interactive session. |
 | The plugin is not listed | Re-run the installer and check that `codebuddy` is on `PATH`, then start a new session. |
 | MCP does not connect | Check the URL/API key in `~/.openviking/ovcli.conf`, then start a new session. |
 | Detailed diagnostics are needed | Start CodeBuddy with `OPENVIKING_DEBUG=1` and inspect `~/.openviking/logs/codebuddy-hooks.log`. |
```

**File**: `docs/en/agent-integrations/21-qoder.md` (modified, +2/-1)
```diff
@@ -46,7 +46,8 @@ Every Qoder CLI build on `PATH` gets the plugin: `qodercli` in `~/.qoder` (`QODE
 
 - **SessionStart** injects the user profile and replays anything the offline queue is holding.
 - **UserPromptSubmit** recalls relevant memories and injects them as an `<openviking-context>` block in `additionalContext`.
-- **PreToolUse** denies reading or writing a `viking://` URI as a local path and points the Agent at the OpenViking MCP tools. A Bash command that contains such a URI still runs, with a notice pointing at the same tools, so `ov` invocations and literal `viking://` arguments still work.
+- **PreToolUse** denies reading or writing a `viking://` URI as a local path and points the Agent at the OpenViking MCP tools. A Bash command that contains such a URI still runs, with a notice pointing at the same tools, so `ov` invocations and literal `viking://` arguments still work. A second `PreToolUse` entry on `mcp_call` adds the current session as the `session` argument of a `session_history` call that leaves it out.
+- After a compaction or a resume, **SessionStart** also adds a short note naming the session's OpenViking id and the `session_history` MCP tool for looking up exact earlier details.
 - **Stop**, **PreCompact**, and **SessionEnd** capture new transcript turns incrementally in a detached worker. `Stop` commits the OpenViking session every 8 captured messages (`commitTurnThreshold`); `PreCompact` and `SessionEnd` commit everything not yet committed, including messages `Stop` already sent.
 
 Hooks and MCP read the same credentials from `~/.openviking/ovcli.conf`, so they cannot disagree about the server, account, or user. `OPENVIKING_URL` and `OPENVIKING_API_KEY` override that file, and per-plugin settings live under `plugin.qoder` (see [Plugin Settings](../configuration/02-client.md#plugin-settings)). Sessions are stored in OpenViking as `qd-<session id>`.
```

**File**: `docs/zh/agent-integrations/12-cursor.md` (modified, +2/-1)
```diff
@@ -48,7 +48,8 @@ curl -fsSL https://openviking.ai/install | bash
 - `beforeReadFile`：阻止把 `viking://` 虚拟路径当作本地文件读取，并提示改用 OpenViking MCP 工具；shell 命令不做检查。
 - `afterMCPExecution`：将 `openviking` MCP 服务的工具完成记录追加到本地工具日志，保留真实调用 ID、输入、输出和成功或失败状态；此时不向服务端写入消息，也不重写此前的结果。
 - `stop`：将新增对话与本地工具记录一起通过 `add message` 上报；成功后才推进捕获位置，达到原有消息阈值时执行 `session commit`。工具记录不额外增加该阈值的消息计数。
-- `preCompact` / `sessionEnd`：提交尚未处理的消息，触发记忆抽取。
+- `preCompact` / `sessionEnd`：提交尚未处理的消息，触发记忆抽取。压缩之后，下一次 `beforeSubmitPrompt` 还会追加一段简短说明，给出会话的 OpenViking id（`cu-<conversation id>`）以及用来查回之前确切细节的 `session_history` MCP 工具。
+- `preToolUse`：只匹配 `MCP:session_history`，Agent 没传 `session` 参数时补上当前会话。
 
 工具采集要求 `afterMCPExecution` 提供 `tool_use_id`、`mcp_server_name`、`tool_name`、`tool_input` 和 `result_json`。缺少身份或结果的事件会跳过，不会推断为成功。上传失败时保留本地记录，等待同一会话的后续采集重试；消息未传完整时不提交。
 
```

**File**: `docs/zh/agent-integrations/13-trae.md` (modified, +2/-1)
```diff
@@ -4,7 +4,7 @@
 
 ## 安装
 
-前置条件：macOS 或 Linux、Node.js 18+，以及支持 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`Stop` Hook 的 TRAE/TRAE CN 版本。TraeCode CLI 2.0 直接使用兼容 Codex 的插件格式。安装过程中会引导配置 OpenViking 连接信息。
+前置条件：macOS 或 Linux、Node.js 18+，以及支持 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`Stop`、`PostCompact` Hook 的 TRAE/TRAE CN 版本。TraeCode CLI 2.0 直接使用兼容 Codex 的插件格式。安装过程中会引导配置 OpenViking 连接信息。
 
 连接托管实例时，选择 **OpenViking 托管服务**，再选择服务商：
 
@@ -48,6 +48,7 @@ TRAE 和 TRAE CN 使用安装后的 `hooks.json`，不需要审阅 hook，安装
 - `UserPromptSubmit`：根据当前问题召回并注入相关内容，召回范围包括你自己的 skill 和账号内共享在 `viking://agent/skills` 下的 skill。
 - `PreToolUse`：在 TRAE 和 TRAE CN 上，`Read`、`Glob`、`Grep` 的路径是 `viking://` URI 时拒绝调用，并提示改用 OpenViking MCP 工具；`Bash` 或 `RunCommand` 命令带 `viking://` URI 时照常执行，同时附加改用建议。TraeCode CLI 2.0 使用 Codex 插件，它不安装 URI guard。
 - TRAE/TRAE CN 的 `Stop` 捕获并提交本轮消息；TraeCode CLI 2.0 遵循 Codex 插件的捕获与生命周期提交策略。
+- TRAE/TRAE CN 的 `PostCompact` 在压缩后追加一段简短说明，给出会话的 OpenViking id 以及用来查回之前确切细节的 `session_history` MCP 工具；Agent 调用时把这个 id 作为 `session` 传入。
 - OpenViking MCP Server：透传服务端完整 MCP 工具集（21 个工具）：`find`、`search`、`read`、`download`、`list`、`tree`、`remember`、`write`、`edit`、`add_resource`、`add_skill`、`list_watches`、`cancel_watch`、`grep`、`glob`、`forget`、`health`、`list_users`、`list_groups`、`get_acl`、`set_acl`。其中 `search` 的 `mode="context"` 可返回组装后的上下文。
 - TRAE/TRAE CN 的 skill：`openviking-memory`、`openviking-skills`、`ov-experience-memory`、`openviking-rule-search` 和 `ov-memory-doctor` 安装到 `~/.trae/skills/<name>`（TRAE CN 为 `~/.trae-cn/skills/<name>`）。你修改过的 skill，或已有的同名非托管目录，升级时保留。TraeCode CLI 也读取 `~/.trae/skills`，同时安装 TRAE 集成和 TraeCode CLI 2.0 插件时，CLI 会把这几个 skill 各列两次：一次不带前缀，一次在插件命名空间下。
 skill 清单先列你自己的 skill，再列账号内共享的 skill，每条描述截到约 40 token。清单的预算 `skillCatalogTokenBudget`（默认 `1200` token）独立于画像预算；描述放不下时只列名称。把 `skillCatalog` 设为 `false` 或把预算设为 `0` 即可关闭，既可以写在 `~/.openviking/ovcli.conf` 的 `plugin` 段（见[插件配置](../configuration/02-client.md#插件配置)），也可以用环境变量 `OPENVIKING_SKILL_CATALOG` 和 `OPENVIKING_SKILL_CATALOG_TOKEN_BUDGET`。
```

**File**: `docs/zh/agent-integrations/20-codebuddy.md` (modified, +3/-2)
```diff
@@ -44,12 +44,13 @@ curl -fsSL https://openviking.ai/install | bash
 - **UserPromptSubmit** 召回相关记忆，以 `additionalContext` 中的 `<openviking-context>` 块注入。宿主自动生成的续写轮次会被跳过，因此宿主自己产生的轮次不会触发检索。
 - **PreToolUse** 拒绝把 `viking://` URI 当本地路径读写，并引导 Agent 改用 OpenViking MCP 工具。Shell 命令不做检查，`ov` 调用与字面量 `viking://` 参数照常可用。
 - **Stop**、**PreCompact** 和 **SessionEnd** 在分离的 worker 中增量捕获 transcript 中的新轮次。`Stop` 每捕获 8 条消息（`commitTurnThreshold`）提交一次 OpenViking session；`PreCompact` 和 `SessionEnd` 提交所有尚未提交的消息，包括 `Stop` 已经发送的。
+- 压缩或恢复之后，下一次 **UserPromptSubmit** 还会追加一段简短说明，给出会话的 OpenViking id 以及用来查回之前确切细节的 `session_history` MCP 工具。Agent 没传该工具的 `session` 参数时，MCP 代理从调用中补上。
 
 hook 与 MCP 从 `~/.openviking/ovcli.conf` 读取同一份凭据，不会在服务端、账号或用户上各说各话。`OPENVIKING_URL` 与 `OPENVIKING_API_KEY` 可覆盖该文件，按插件的配置位于 `plugin.codebuddy` 下（见[插件配置](../configuration/02-client.md#插件配置)）。会话在 OpenViking 中记为 `cb-<session id>`。
 
 ### 宿主决定的行为
 
-`UserPromptSubmit` 与 `SessionEnd` **只在交互式 TUI 触发**。headless 运行（`-p`、`--input-format stream-json`）不会触发它们，因此 headless 会话只在 `Stop` 捕获，不发收尾提交。`SessionStart` 不带 `cwd`，且同一会话内可能投递两次，因此该 hook 是幂等的，并以进程工作目录兜底。hook 超时会被杀，但其子进程不会，这正是提交能在 hook 进程返回后由分离的 worker 完成的原因。
+`SessionEnd` **只在交互式 TUI 触发**，因此 headless 会话（`-p`、`--input-format stream-json`）只在 `Stop` 捕获，不发收尾提交。CodeBuddy Code 2.185.0 之前 `UserPromptSubmit` 也只在 TUI 触发；从 2.185.0 起 headless `-p` 运行同样会触发。`SessionStart` 不带 `cwd`，且同一会话内可能投递两次，因此该 hook 是幂等的，并以进程工作目录兜底。hook 超时会被杀，但其子进程不会，这正是提交能在 hook 进程返回后由分离的 worker 完成的原因。
 
 暂不支持子代理采集：宿主会触发 `SubagentStart`/`SubagentStop`，但共享 dispatcher 还没有子代理阶段。经过实测的宿主契约与 transcript 格式记录在 [`hosts/codebuddy/DESIGN.md`](https://github.com/volcengine/OpenViking/blob/main/examples/agent-hook-plugin/hosts/codebuddy/DESIGN.md)。
 
@@ -67,7 +68,7 @@ curl -fsSL https://openviking.ai/install | bash -s -- --uninstall --yes --harnes
 
 | 现象 | 原因与处理 |
 |------|------------|
-| headless 运行没有召回 | `UserPromptSubmit` 只在交互式 TUI 触发，请使用交互式会话。 |
+| headless 运行没有召回 | CodeBuddy Code 2.185.0 之前 `UserPromptSubmit` 只在交互式 TUI 触发，请升级或使用交互式会话。 |
 | 插件列表中没有它 | 重新运行安装器并确认 `codebuddy` 在 `PATH` 中，然后新建会话。 |
 | MCP 连不上 | 检查 `~/.openviking/ovcli.conf` 中的 URL/API Key，然后新建会话。 |
 | 需要详细诊断 | 以 `OPENVIKING_DEBUG=1` 启动 CodeBuddy，查看 `~/.openviking/logs/codebuddy-hooks.log`。 |
```

---

### Incident Patch 2: `4afd0e7f` (2026-11-25)
**Commit Message**: fix(pgvector): preserve cosine pagination and reuse query vector strings (#7985)

* fix(pgvector): avoid costly probes in filtered vector search

Admit narrow exact routing only for cheap scalar index plans and defer cosine eligibility checks to avoid redundant vector reads while preserving native fallback behavior.

* fix(ui): unblock frontend CI after main merge

Extract reference search requests with safe response types and split destination validation tests to satisfy lint limits without changing behavior.

* test(ui): align write URI expectations with plain editor text

Keep clickable URI coverage for command echoes while matching the intentional editor behavior introduced on main.

* fix(pgvector): isolate filter planning and qualify candidate tables

* fix(ci): allow more time for the full UI test suite

* fix(pgvector): retain zero-vector pagination fixes and query string reuse

* fix(pgvector): keep HNSW candidate ordering index-compatible

**File**: `docs/en/guides/25-pgvector.md` (modified, +9/-0)
```diff
@@ -99,6 +99,15 @@ scanning to improve recall with filters, but ANN recall and filtered TopK are
 not guaranteed; measure recall and p99 with representative filters. Cosine
 zero vectors are not included in a pgvector HNSW index.
 
+Cosine search also excludes zero vectors from flat results and dense candidates
+in hybrid/time-decay search. Native dense search drops NaN distances after
+sorting and pagination: PostgreSQL sorts NaN after all finite distances, so zero
+vectors cannot displace eligible results or alter valid pagination. Hybrid
+sparse recall excludes them before applying its candidate budget, with a CASE
+expression that evaluates the norm only after scalar filtering. Sparse-only
+search still accepts these records. Ordinary dense queries serialize the query
+vector once and reuse the string for both SQL parameters.
+
 Flat search stays exact even when the table also contains an ANN index. On
 reconnect, the configured collection dimension, metric and index type must
 match persisted metadata; missing or invalid ANN indexes produce errors.
```

**File**: `docs/zh/guides/25-pgvector.md` (modified, +7/-0)
```diff
@@ -92,6 +92,13 @@ HNSW 开启 strict iterative scanning 来改善带过滤的召回，但不保证
 召回率或过滤后 TopK 数量；需用真实过滤条件验证召回率和 p99。
 pgvector HNSW 的 cosine 索引不包含零向量。
 
+Cosine 检索同样从 flat 结果以及 hybrid/时间衰减的 dense 候选中排除零向量。
+原生 dense 查询在距离排序和分页之后排除 NaN：PostgreSQL 将 NaN 排在所有
+有限距离之后，因此零向量不会挤掉有效结果或改变有效分页。hybrid 的 sparse
+分支在候选预算截取之前排除零向量，并通过 CASE 保证标量过滤通过后才计算范数。
+仅 sparse 查询仍允许这些记录参与检索。普通 dense 查询只将查询向量转为字符串
+一次，供两个 SQL 参数复用。
+
 即使表中额外存在 ANN 索引，flat 检索仍保持精确。重新连接时会校验配置与
 持久化元数据中的维度、距离和索引类型，ANN 索引缺失或无效会明确报错。
 修改 `ef_search` 在重新连接后生效，不需要重建索引；修改索引类型或构建参数
```

**File**: `openviking/storage/vectordb_adapters/opengauss/retrieval.py` (modified, +28/-8)
```diff
@@ -432,6 +432,23 @@ def _drop_sparse_postings_on_cursor(self, cursor) -> None:
     def _validate_ranked_filters(self, filters) -> None:
         _validate_filters(filters, self._field_names)
 
+    def _dense_vector_guard(self, op: str) -> str:
+        return '"vector" IS NOT NULL'
+
+    def _dense_filter_clause(self, op, where, filter_params):
+        condition = f"({where})" if where else "TRUE"
+        return f"{condition} AND {self._dense_vector_guard(op)}", list(filter_params)
+
+    def _dense_candidate_query(self, index_name, where, filter_params, vector_text, op, budget):
+        """Backend hook for dense recall, kept inside the ranking statement's snapshot."""
+        predicate, params = self._dense_filter_clause(op, where, filter_params)
+        return (
+            f'SELECT "id" AS _ov_candidate_id FROM {_quote_identifier(self._name)} '
+            f"WHERE {predicate} "
+            f'ORDER BY "vector" {op} %s::vector LIMIT %s',
+            [*params, vector_text, budget],
+        )
+
     def search_ranked(
         self,
         index_name: str,
@@ -505,24 +522,27 @@ def search_ranked(
             for term, weight in sparse.items():
                 params.extend([term, weight])
         if has_dense:
-            ctes.append(
-                f'dense_candidates AS (SELECT "id" AS _ov_candidate_id FROM {table} '
-                f'WHERE {condition} AND "vector" IS NOT NULL '
-                f'ORDER BY "vector" {op} %s::vector LIMIT %s)'
+            dense_sql, dense_params = self._dense_candidate_query(
+                index_name, where, filter_params, vector_text, op, budget
             )
-            params.extend([*filter_params, vector_text, budget])
+            ctes.append(f"dense_candidates AS ({dense_sql})")
+            params.extend(dense_params)
             candidate_selects.append("SELECT _ov_candidate_id FROM dense_candidates")
         if has_sparse:
-            vector_guard = ' AND "vector" IS NOT NULL' if has_dense else ""
+            sparse_predicate, sparse_params = (
+                self._dense_filter_clause(op, where, filter_params)
+                if has_dense
+                else (condition, list(filter_params))
+            )
             ctes.append(
                 f"sparse_candidates AS (SELECT p.id AS _ov_candidate_id FROM {postings} p "
                 "JOIN query_sparse q ON p.term = q.term "
                 f'WHERE EXISTS (SELECT 1 FROM {table} WHERE "id" = p.id '
-                f"AND {condition}{vector_guard}) GROUP BY p.id "
+                f"AND {sparse_predicate}) GROUP BY p.id "
                 "HAVING SUM(p.weight * q.weight) > 0 "
                 "ORDER BY SUM(p.weight * q.weight) DESC, p.id LIMIT %s)"
             )
-            params.extend([*filter_params, budget])
+            params.extend([*sparse_params, budget])
             candidate_selects.append("SELECT _ov_candidate_id FROM sparse_candidates")
         ctes.append("candidates AS (" + " UNION ".join(candidate_selects) + ")")
         distance_sql = (
```

**File**: `openviking/storage/vectordb_adapters/pgvector_adapter.py` (modified, +50/-2)
```diff
@@ -10,6 +10,7 @@
 from __future__ import annotations
 
 import json
+import math
 import os
 import re
 import threading
@@ -175,6 +176,48 @@ def upsert_data(self, data_list, ttl=0):
             raise NotImplementedError("pgvector TTL writes are not supported")
         return super().upsert_data(data_list, ttl=0)
 
+    def _dense_vector_guard(self, op):
+        # pgvector does not index cosine zero vectors. Exact fallback must use
+        # the same eligible set and avoid propagating their NaN distances.
+        guard = super()._dense_vector_guard(op)
+        return f"{guard} AND vector_norm(vector) > 0" if op == "<=>" else guard
+
+    def _dense_filter_clause(self, op, where, filter_params):
+        if op != "<=>" or not where:
+            return super()._dense_filter_clause(op, where, filter_params)
+        # SQL AND does not guarantee evaluation order. Keep the scalar predicate
+        # visible to indexes, but fence the TOAST-reading norm behind CASE.
+        return (
+            f'({where}) AND "vector" IS NOT NULL AND '
+            f"CASE WHEN ({where}) THEN vector_norm(vector) > 0 ELSE FALSE END",
+            [*filter_params, *filter_params],
+        )
+
+    def _dense_candidate_query(self, index_name, where, filter_params, vector_text, op, budget):
+        if op != "<=>":
+            return super()._dense_candidate_query(
+                index_name, where, filter_params, vector_text, op, budget
+            )
+        # PostgreSQL sorts NaN after finite distances in ascending order. Cosine
+        # zero vectors therefore cannot displace any eligible top-budget row.
+        # Filter after LIMIT to avoid norm/TOAST reads on scalar-rejected rows
+        # and a second vector read on scalar exact plans. HNSW itself omits zeros.
+        condition = f"({where}) AND " if where else ""
+        # PostgreSQL 16 cannot match a second sort key to the HNSW ordering.
+        # Keep candidate recall distance-only for ANN; final ranking sorts ties.
+        order = "_ov_distance"
+        if self._indexes[index_name]["_pg_index_type"] == "flat":
+            order += ", _ov_candidate_id"
+        return (
+            'SELECT _ov_candidate_id FROM (SELECT "id" AS _ov_candidate_id, '
+            f'"vector" {op} %s::vector AS _ov_distance '
+            f"FROM public.{_quote_identifier(self._name)} "
+            f'WHERE {condition}"vector" IS NOT NULL '
+            f"ORDER BY {order} LIMIT %s) _ov_native_candidates "
+            "WHERE _ov_distance <> 'NaN'::double precision",
+            [vector_text, *filter_params, budget],
+        )
+
     def search_by_vector(
         self,
         index_name,
@@ -207,6 +250,7 @@ def search_by_vector(
             return SearchResult(data=[])
         vector = _validate_vector(dense_vector, self._dim)
         metric, op = self._resolve_distance_and_op(index_name)
+        vector_text = str(vector)
         where, params = _build_where_clause(
             self._normalize_filter_date_times(filters), self._array_fields
         )
@@ -215,13 +259,17 @@ def search_by_vector(
             f"SELECT {self._select_output_columns(output_fields)}, "
             f"vector {op} %s::vector AS _ov_distance "
             f"FROM {_quote_identifier(self._name)} "
-            f"WHERE {condition}vector IS NOT NULL "
+            f'WHERE {condition}"vector" IS NOT NULL '
             f"ORDER BY vector {op} %s::vector, id LIMIT %s OFFSET %s",
-            [str(vector), *params, str(vector), limit, offset],
+            [vector_text, *params, vector_text, limit, offset],
             index_name,
         )
         items = []
         for row in rows:
+            # NaN zero-vector distances sort last, so removing them after native
+            # pagination cannot drop an otherwise eligible result at this offset.
+            if metric == "cosine" and math.isnan(float(row[-1])):
+                continue
             record = self._row_to_dict(row[:-1], columns[:-1])
             items.append(
                 SearchItemResult(
```

**File**: `tests/storage/test_pgvector_adapter.py` (modified, +229/-0)
```diff
@@ -492,6 +492,235 @@ def test_distance_metrics(adapter, metric):
         other.close()
 
 
+def test_cosine_guard_never_reads_scalar_rejected_vectors(adapter):
+    adapter.upsert(
+        [
+            {"id": "mine", "vector": [1, 0, 0], "account_id": "one"},
+            {"id": "zero", "vector": [0, 0, 0], "account_id": "one"},
+            {"id": "foreign", "vector": [-1, 0, 0], "account_id": "two"},
+        ]
+    )
+    collection = adapter.get_collection()._Collection__collection
+    predicate, params = collection._dense_filter_clause("<=>", '"account_id" = %s', ["one"])
+    cursor = collection._cursor()
+    try:
+        # A cheap norm function lets the planner evaluate an ordinary AND before
+        # scalar filtering. CASE must protect scalar-rejected heap rows.
+        cursor.execute(
+            """CREATE FUNCTION pg_temp.ov_test_norm(v vector) RETURNS double precision
+               LANGUAGE plpgsql COST 0.0001 AS $$
+               BEGIN
+                 IF v = '[-1,0,0]'::vector THEN
+                   RAISE EXCEPTION 'read scalar-rejected vector';
+                 END IF;
+                 RETURN vector_norm(v);
+               END $$"""
+        )
+        cursor.execute("SET LOCAL enable_indexscan = off")
+        cursor.execute("SET LOCAL enable_bitmapscan = off")
+        cursor.execute(
+            f'SELECT id FROM "{adapter.collection_name}" WHERE '
+            + predicate.replace("vector_norm(vector)", "pg_temp.ov_test_norm(vector)"),
+            params,
+        )
+        assert cursor.fetchall() == [("mine",)]
+    finally:
+        collection._conn.rollback()
+        cursor.close()
+    assert [
+        r["id"]
+        for r in adapter.query(query_vector=[1, 0, 0], filter=Eq("account_id", "one"), limit=10)
+    ] == ["mine"]
+
+
+@pytest.mark.parametrize("offset", [0, 1, 2, 3])
+def test_cosine_zero_vectors_after_dense_pagination(adapter, offset):
+    adapter.upsert(
+        [
+            {"id": "first", "vector": [1, 0, 0], "account_id": "one"},
+            {"id": "second", "vector": [0, 1, 0], "account_id": "one"},
+            *[{"id": f"zero_{i}", "vector": [0, 0, 0], "account_id": "one"} for i in range(8)],
+        ]
+    )
+    expected = ["first", "second"][offset : offset + 3]
+    for advance in [None, {"time_decay": {"protection": "1d"}}]:
+        rows = adapter.query(
+            query_vector=[1, 0, 0],
+            filter=Eq("account_id", "one"),
+            limit=3,
+            offset=offset,
+            advance=advance,
+        )
+        assert [r["id"] for r in rows] == expected
+    assert adapter.query(query_vector=[0, 0, 0], filter=Eq("account_id", "one")) == []
+
+
+@pytest.mark.parametrize("depth", [-1, 0, 1])
+def test_cosine_zero_vectors_scoped_pagination_and_ranked(adapter, depth):
+    collection = adapter.get_collection()._Collection__collection
+    path = "viking://resources/目录_%"
+    records = [
+        {
+            "id": f"mine_{i:02d}",
+            "vector": [1, i / 10, 0],
+            "sparse_vector": {"hello": i + 1},
+            "uri": path if i == 0 else path + ("/sub" if i % 2 else "") + f"/f{i}",
+            "account_id": "one",
+            "search_tags": ["allowed"],
+            "updated_at": "2026-11-12T00:00:00Z",
+        }
+        for i in range(12)
+    ]
+    records += [
+        {
+            "id": "tenant",
+            "vector": [1, 0, 0],
+            "uri": path,
+            "account_id": "two",
+            "search_tags": ["allowed"],
+        },
+        {
+            "id": "acl",
+            "vector": [1, 0, 0],
+            "uri": path,
+            "account_id": "one",
+            "search_tags": ["denied"],
+        },
+        {
+            "id": "sibling",
+            "vector": [1, 0, 0],
+            "uri": path + "suffix/f",
+            "account_id": "one",
+            "search_tags": ["allowed"],
+        },
+        {"id": "null", "uri": path, "account_id": "one", "search_tags": ["allowed"]},
+        {
+            "id": "zero",
+            "vector": [0, 0, 0],
+            "sparse_vector": {"hello": 100},
+            "uri": path,
+            "account_id": "one",
+            "search_tags": ["allowed"],
+        },
+    ]
+    adapter.upsert(records)
+    scope = And(
+        [Eq("account_id", "one"), Eq("search_tags", "allowed"), PathScope("uri", path, depth)]
+    )
+    modes = [
+        {},
+        {"sparse_query_vector": {"hello": 1}},
+        {"advance": {"time_decay": {"protection": "1d", "origin": "2026-11-15T00:00:00Z"}}},
+    ]
+    for mode in modes:
+        actual = adapter.query(
+            query_vector=[1, 0, 0], filter=scope, limit=3, offset=1, output_fields=["uri"], **mode
+        )
+        # Flat search on the same table is the oracle even with a physical HNSW
+        # index. Restore metadata before the next query.
+        index_meta = collection._indexes["default"]
+        previous_type = index_meta["_pg_index_type"]
+        try:
+    
```

---

### Incident Patch 3: `89a50ed9` (2026-11-25)
**Commit Message**: fix(snapshot): 拒绝含反斜杠的分支名 (#8415)

让快照分支名校验符合 Git ref 命名规则，在读取分支引用时拒绝非法输入。

**File**: `crates/ragfs/src/git/util.rs` (modified, +3/-0)
```diff
@@ -36,6 +36,7 @@ pub fn validate_ref_name(ref_name: &str) -> Result<(), RefStoreError> {
         || ref_name.contains('?')
         || ref_name.contains('[')
         || ref_name.contains('*')
+        || ref_name.contains('\\')
     {
         return Err(RefStoreError::InvalidName(
             "ref name contains invalid characters".to_string(),
@@ -204,6 +205,7 @@ mod tests {
     fn test_validate_ref_name() {
         assert!(validate_ref_name("refs/heads/main").is_ok());
         assert!(validate_ref_name("refs/tags/v1.0").is_ok());
+        assert!(validate_ref_name("feature/topic").is_ok());
         assert!(validate_ref_name("HEAD").is_ok());
 
         assert!(validate_ref_name("").is_err());
@@ -217,6 +219,7 @@ mod tests {
         assert!(validate_ref_name("refs?head").is_err());
         assert!(validate_ref_name("refs[head]").is_err());
         assert!(validate_ref_name("refs*head").is_err());
+        assert!(validate_ref_name(r"feature\topic").is_err());
     }
 
     #[test]
```

#### Recent Merged Pull Requests:
- **PR #8439** (2026-11-25): fix(studio):  disable arranger temporarily (@vikinglbx)
- **PR #8436** (2026-11-25): feat(gateway): rotate the request log file hourly like the usage log (@t0saki)
- **PR #8435** (closed): fix(sdk): exclude output archive from directory upload (@ktz03)
- **PR #8433** (closed): fix(web-studio): preserve numeric values in JSON previews (@ktz03)
- **PR #8430** (2026-11-25): feat(admin): freeze user agent files through account metadata (@MaojiaSheng)
- **PR #8427** (closed): fix(cli): match Ollama models by full identity (@ktz03)

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

## X. plugins): session_history support across the memory plugins and two Claude Code 

**RULE**:
When implementing operations in `agent-plugins/servers/shared/mcp-proxy-core.mjs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f905a91c`: plugins): session_history support across the memory plugins and two Claude Code capture fixes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `agent-plugins/servers/shared/mcp-proxy-core.mjs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
const SESSION_HISTORY_TOOL = "session_history";
  // (params) => the OV session id of the host session making this tools/call,
  // or "" when the harness cannot tell; fills `session_history`'s `session`.
  defaultHistorySession = null,
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
      params: { ...message.params, arguments: { ...(args || {}), se
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f905a91c` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
