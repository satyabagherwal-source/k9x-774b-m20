# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: volcengine-openviking-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "volcengine-openviking-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T09:18:17.046Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-volcengine-openviking-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine-openviking-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T09:18:17.046Z`  
> **Learning ID**: `LEARN-EVO-volcengine-openviking-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: D (Research & Knowledge Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), G (Architecture Intelligence), I (Content & Information Intelligence), F (Design Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 82%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from volcengine-openviking-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source**: github ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Source Version**: `d421d520`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T09:17:43.227Z  
> **Learning ID**: `learn-github-volcengine-openviking`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): volcengine/OpenViking

> **Canonical Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-27T09:17:43.222Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 42909 stars

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

### Incident Patch 1: `220dd481` (2026-11-27)
**Commit Message**: test(security): 收敛权限、隐私与加密核心测试 (#8511)

将重复覆盖合并到请求、存储和密钥的真实流程，补强跨账户隔离和根密钥恢复的结果断言。

**File**: `openviking/crypto/exceptions.py` (modified, +0/-12)
```diff
@@ -35,19 +35,7 @@ class KeyMismatchError(EncryptionError):
     pass
 
 
-class KeyNotFoundError(EncryptionError):
-    """Key not found error."""
-
-    pass
-
-
 class ConfigError(EncryptionError):
     """Configuration error."""
 
     pass
-
-
-class KMSError(EncryptionError):
-    """KMS service error."""
-
-    pass
```

**File**: `tests/integration/test_encryption_integration.py` (modified, +123/-437)
```diff
@@ -7,148 +7,69 @@
 Tests encryption functionality integrated with VikingFS and OpenViking service.
 """
 
-import os
 import secrets
 from pathlib import Path
 
 import pytest
 import pytest_asyncio
 
 from openviking.crypto.config import bootstrap_encryption
-from openviking.crypto.encryptor import FileEncryptor
-from openviking.crypto.providers import LocalFileProvider
+from openviking.crypto.exceptions import KeyMismatchError
 from openviking.message import TextPart
 from openviking.server.api_keys import is_valid_format_key
 from openviking.server.identity import RequestContext, Role
 from openviking.server.store_assembly import build_api_key_manager
 from openviking.service.core import OpenVikingService
 from openviking_cli.session.user_id import UserIdentifier
 from openviking_cli.utils.config.open_viking_config import OpenVikingConfigSingleton
+from tests.integration.conftest import (
+    VAULT_ADDR,
+    VAULT_TOKEN,
+    VOLCENGINE_ACCESS_KEY,
+    VOLCENGINE_KMS_KEY_ID,
+    VOLCENGINE_KMS_REGION,
+    VOLCENGINE_SECRET_KEY,
+    requires_vault,
+    requires_volcengine_kms,
+)
 from tests.server.conftest import _install_fake_embedder, _install_fake_vlm
 
 
-@pytest_asyncio.fixture(scope="function")
-async def encryption_config(tmp_path):
-    """Fixture that provides encryption configuration with local provider"""
-    # Create temporary key file
-    key_file = tmp_path / "master.key"
-    root_key = secrets.token_bytes(32)
-    key_file.write_text(root_key.hex())
-    os.chmod(key_file, 0o600)
-
+@pytest.fixture
+def encryption_provider():
+    return "local"
+
+
+@pytest.fixture
+def encryption_config(tmp_path, encryption_provider):
+    if encryption_provider == "disabled":
+        return {"encryption": {"enabled": False}}
+    if encryption_provider == "vault":
+        options = {"address": VAULT_ADDR, "token": VAULT_TOKEN}
+    elif encryption_provider == "volcengine_kms":
+        options = {
+            "region": VOLCENGINE_KMS_REGION,
+            "access_key": VOLCENGINE_ACCESS_KEY,
+            "secret_key": VOLCENGINE_SECRET_KEY,
+            "key_id": VOLCENGINE_KMS_KEY_ID,
+            "key_file": str(tmp_path / "kms-root-key.enc"),
+        }
+    else:
+        key_file = tmp_path / "master.key"
+        key_file.write_text(secrets.token_hex(32))
+        key_file.chmod(0o600)
+        options = {"key_file": str(key_file)}
     return {
-        "encryption": {"enabled": True, "provider": "local", "local": {"key_file": str(key_file)}}
+        "encryption": {
+            "enabled": True,
+            "provider": encryption_provider,
+            encryption_provider: options,
+        }
     }
 
 
-@pytest_asyncio.fixture(scope="function")
-async def file_encryptor(tmp_path):
-    """Fixture that provides a FileEncryptor instance for testing"""
-    # Create temporary key file
-    key_file = tmp_path / "master.key"
-    root_key = secrets.token_bytes(32)
-    key_file.write_text(root_key.hex())
-    os.chmod(key_file, 0o600)
-
-    provider = LocalFileProvider(key_file=str(key_file))
-    return FileEncryptor(provider)
-
-
-class TestEncryptionBootstrap:
-    """Tests for encryption module bootstrap"""
-
-    async def test_bootstrap_encryption_enabled(self, encryption_config):
-        """Test bootstrapping encryption with enabled configuration"""
-        encryptor = await bootstrap_encryption(encryption_config)
-        assert encryptor is not None
-        assert isinstance(encryptor, FileEncryptor)
-
-    async def test_bootstrap_encryption_disabled(self):
-        """Test bootstrapping encryption with disabled configuration"""
-        config = {"encryption": {"enabled": False}}
-        encryptor = await bootstrap_encryption(config)
-        assert encryptor is None
-
-
-class TestFileEncryptorIntegration:
-    """Tests for FileEncryptor integration"""
-
-    async def test_encrypt_decrypt_roundtrip(self, file_encryptor):
-        """Test basic encryption/decryption roundtrip"""
-        account_id = "test_account"
-        plaintext = b"This is a test file content for encryption integration"
-
-        # Encrypt
-        ciphertext = await file_encryptor.encrypt(account_id, plaintext)
-        assert ciphertext != plaintext
-        assert ciphertext.startswith(b"OVE1")
-
-        # Decrypt
-        decrypted = await file_encryptor.decrypt(account_id, ciphertext)
-        assert decrypted == plaintext
-
-    async def test_different_accounts_isolation(self, file_encryptor):
-        """Test that different accounts cannot decrypt each other's data"""
-        account1 = "account_1"
-        account2 = "account_2"
-        plaintext = b"Sensitive data for account isolation test"
-
-        # Encrypt with account1
-        ciphertext = await file_encryptor.encrypt(account1, plaintext)
-
-        # Decrypt with account1 should work
-        decrypted1 = await file_encryptor.decrypt(account1, ciphertext)
-        assert decrypted1 == plaintext
-
-        # Decrypt with ac
```

**File**: `tests/integration/test_vault_encryption_integration.py` (modified, +13/-663)
```diff
@@ -1,678 +1,28 @@
 # Copyright (c) 2026 Beijing Volcano Engine Technology Co., Ltd.
 # SPDX-License-Identifier: AGPL-3.0
-
-"""
-Vault encryption integration tests.
-
-Tests encryption functionality with HashiCorp Vault as the key provider.
-Requires VAULT_TOKEN env var to be set.
-Run: pytest tests/integration/test_vault_encryption_integration.py -v -m integration
-"""
-
-import secrets
-from pathlib import Path
+"""Vault-specific failure handling. The file roundtrip is shared by all providers."""
 
 import pytest
-import pytest_asyncio
 
-from openviking.crypto.config import bootstrap_encryption
-from openviking.crypto.encryptor import FileEncryptor
 from openviking.crypto.exceptions import AuthenticationFailedError, ConfigError
-from openviking.crypto.providers import VaultProvider, create_root_key_provider
-from openviking.server.store_assembly import build_api_key_manager
-from openviking.service.core import OpenVikingService
-from openviking_cli.session.user_id import UserIdentifier
-from openviking_cli.utils.config.open_viking_config import OpenVikingConfigSingleton
-from tests.integration.conftest import VAULT_ADDR, VAULT_TOKEN, requires_vault
-
-pytestmark = [pytest.mark.integration, requires_vault]
-
-# Vault environment configuration
-VAULT_MOUNT_PATH = "transit"
-
-
-class TestVaultProviderIntegration:
-    """Integration tests for VaultProvider."""
-
-    @pytest_asyncio.fixture(scope="function")
-    async def vault_provider(self):
-        """Fixture that provides a VaultProvider instance."""
-        provider = VaultProvider(addr=VAULT_ADDR, token=VAULT_TOKEN, mount_path=VAULT_MOUNT_PATH)
-        yield provider
-
-    @pytest.fixture(scope="function")
-    def vault_config(self):
-        """Fixture that provides Vault configuration."""
-        return {
-            "vault": {
-                "address": VAULT_ADDR,
-                "token": VAULT_TOKEN,
-                "mount_point": VAULT_MOUNT_PATH,
-            }
-        }
-
-    async def test_vault_provider_initialization(self, vault_provider):
-        """Test VaultProvider initialization and Vault connection."""
-        client = await vault_provider._get_client()
-        assert client is not None
-        assert client.is_authenticated()
-
-    async def test_derive_account_key(self, vault_provider):
-        """Test deriving account keys."""
-        account_id = "test-account-vault"
-        account_key = await vault_provider.derive_account_key(account_id)
-
-        assert account_key is not None
-        assert isinstance(account_key, bytes)
-        assert len(account_key) == 32
-
-    async def test_derive_different_account_keys(self, vault_provider):
-        """Test that different accounts get different keys."""
-        account1_key = await vault_provider.derive_account_key("account-1")
-        account2_key = await vault_provider.derive_account_key("account-2")
-
-        assert account1_key != account2_key
-
-    async def test_derive_same_account_key_consistent(self, vault_provider):
-        """Test that same account gets consistent key."""
-        key1 = await vault_provider.derive_account_key("test-account")
-        key2 = await vault_provider.derive_account_key("test-account")
-
-        assert key1 == key2
-
-    async def test_encrypt_decrypt_file_key(self, vault_provider):
-        """Test encrypting and decrypting file keys."""
-        plaintext_key = secrets.token_bytes(32)
-        account_id = "test-account-encrypt"
-
-        encrypted_key, iv = await vault_provider.encrypt_file_key(plaintext_key, account_id)
+from openviking.crypto.providers import create_root_key_provider
+from tests.integration.conftest import VAULT_ADDR, requires_vault
 
-        assert encrypted_key is not None
-        assert isinstance(encrypted_key, bytes)
-        assert encrypted_key != plaintext_key
-        assert iv is not None
-        assert isinstance(iv, bytes)
-
-        decrypted = await vault_provider.decrypt_file_key(encrypted_key, iv, account_id)
-
-        assert decrypted == plaintext_key
-
-    async def test_encrypt_decrypt_multiple_keys(self, vault_provider):
-        """Test encrypting and decrypting multiple different keys."""
-        key1 = secrets.token_bytes(32)
-        key2 = secrets.token_bytes(32)
-        account_id = "test-account-multiple"
-
-        encrypted1, iv1 = await vault_provider.encrypt_file_key(key1, account_id)
-        encrypted2, iv2 = await vault_provider.encrypt_file_key(key2, account_id)
-
-        assert encrypted1 != encrypted2
-
-        decrypted1 = await vault_provider.decrypt_file_key(encrypted1, iv1, account_id)
-        decrypted2 = await vault_provider.decrypt_file_key(encrypted2, iv2, account_id)
-
-        assert decrypted1 == key1
-        assert decrypted2 == key2
-
-    async def test_create_root_key_provider_vault(self, vault_config):
-        """Test creating VaultProvider via create_root_key_provider."""
-        provider = create_root_key_provider("vault", vau
```

**File**: `tests/integration/test_volcengine_kms_encryption_integration.py` (removed, +0/-697)
```diff
@@ -1,697 +0,0 @@
-# Copyright (c) 2026 Beijing Volcano Engine Technology Co., Ltd.
-# SPDX-License-Identifier: AGPL-3.0
-
-"""
-Volcengine KMS Encryption Integration Tests
-
-Tests encryption functionality integrated with VikingFS and OpenViking service
-using Volcengine KMS as the key provider.
-Requires VOLCENGINE_ACCESS_KEY, VOLCENGINE_SECRET_KEY, and VOLCENGINE_KMS_KEY_ID env vars.
-Run: pytest tests/integration/test_volcengine_kms_encryption_integration.py -v -m integration
-"""
-
-import secrets
-import tempfile
-from pathlib import Path
-
-import pytest
-import pytest_asyncio
-
-from openviking.crypto.encryptor import FileEncryptor
-from openviking.crypto.providers import VolcengineKMSProvider
-from openviking.server.api_keys import is_valid_format_key
-from openviking.server.store_assembly import build_api_key_manager
-from openviking.service.core import OpenVikingService
-from openviking_cli.session.user_id import UserIdentifier
-from openviking_cli.utils.config.open_viking_config import OpenVikingConfigSingleton
-from tests.integration.conftest import (
-    VOLCENGINE_ACCESS_KEY,
-    VOLCENGINE_KMS_KEY_ID,
-    VOLCENGINE_KMS_REGION,
-    VOLCENGINE_SECRET_KEY,
-    requires_volcengine_kms,
-)
-
-pytestmark = [pytest.mark.integration, requires_volcengine_kms]
-
-
-class TestVolcengineKMSProvider:
-    """Tests for VolcengineKMSProvider"""
-
-    @pytest_asyncio.fixture(scope="module")
-    async def volcengine_kms_provider(self):
-        """
-        Fixture that provides a VolcengineKMSProvider instance for testing.
-        Requires valid Volcengine KMS credentials from environment variables.
-        """
-        provider = VolcengineKMSProvider(
-            region=VOLCENGINE_KMS_REGION,
-            access_key_id=VOLCENGINE_ACCESS_KEY,
-            secret_access_key=VOLCENGINE_SECRET_KEY,
-            key_id=VOLCENGINE_KMS_KEY_ID,
-        )
-        return provider
-
-    @pytest.mark.asyncio
-    async def test_initialize_provider(self, volcengine_kms_provider):
-        """Test that VolcengineKMSProvider initializes correctly"""
-        assert volcengine_kms_provider is not None
-        assert volcengine_kms_provider.region == "cn-beijing"
-        assert volcengine_kms_provider.key_id == "d926aa0d-deee-455a-9186-0d07e2e250e1"
-
-    @pytest.mark.asyncio
-    async def test_get_root_key(self, volcengine_kms_provider):
-        """Test getting root key"""
-        root_key = await volcengine_kms_provider.get_root_key()
-        assert isinstance(root_key, bytes)
-        assert len(root_key) > 0
-
-    @pytest.mark.asyncio
-    async def test_derive_account_key(self, volcengine_kms_provider):
-        """Test deriving account key"""
-        account_id = "test-account-volcengine"
-        account_key = await volcengine_kms_provider.derive_account_key(account_id)
-        assert isinstance(account_key, bytes)
-        assert len(account_key) == 32  # Should be 256-bit key
-
-    @pytest.mark.asyncio
-    async def test_derive_different_account_keys(self, volcengine_kms_provider):
-        """Test that different account IDs produce different keys"""
-        account1 = "account-1-volc"
-        account2 = "account-2-volc"
-
-        key1 = await volcengine_kms_provider.derive_account_key(account1)
-        key2 = await volcengine_kms_provider.derive_account_key(account2)
-
-        assert key1 != key2
-
-    @pytest.mark.asyncio
-    async def test_derive_same_account_key(self, volcengine_kms_provider):
-        """Test that same account ID produces same key"""
-        account_id = "test-account-consistent"
-
-        key1 = await volcengine_kms_provider.derive_account_key(account_id)
-        key2 = await volcengine_kms_provider.derive_account_key(account_id)
-
-        assert key1 == key2
-
-    @pytest.mark.asyncio
-    async def test_encrypt_decrypt_file_key(self, volcengine_kms_provider):
-        """Test encrypting and decrypting a file key"""
-        plaintext_key = secrets.token_bytes(32)  # 256-bit key
-        account_id = "test-account-encrypt"
-
-        encrypted_key, iv = await volcengine_kms_provider.encrypt_file_key(
-            plaintext_key, account_id
-        )
-        assert isinstance(encrypted_key, bytes)
-        assert isinstance(iv, bytes)
-
-        decrypted = await volcengine_kms_provider.decrypt_file_key(encrypted_key, iv, account_id)
-        assert decrypted == plaintext_key
-
-    @pytest.mark.asyncio
-    async def test_encrypt_different_keys(self, volcengine_kms_provider):
-        """Test that different plaintexts produce different ciphertexts"""
-        key1 = secrets.token_bytes(32)
-        key2 = secrets.token_bytes(32)
-        account_id = "test-account-multi"
-
-        encrypted1, iv1 = await volcengine_kms_provider.encrypt_file_key(key1, account_id)
-        encrypted2, iv2 = await volcengine_kms_provider.encrypt_file_key(key2, account_id)
-
-        assert encrypted1 != encrypted2
-
-    @pytest.mark.asyncio
-    async def test_full_rou
```

**File**: `tests/server/oauth/test_router.py` (modified, +32/-102)
```diff
@@ -329,6 +329,11 @@ async def test_full_device_flow(app_with_oauth, client):
     assert body["client_name"] == "Claude"
     pending = await store.load_pending_authorization(pending_id)
     assert pending["verified_key_fp"] == "f" * 64
+    repeated = await client.post(
+        "/api/v1/auth/oauth-verify", json={"code": display_code, "decision": "approve"}
+    )
+    assert repeated.status_code == 400
+    assert repeated.json()["error_description"] == "Invalid or expired verification code"
 
     # Status after verify: approved + redirect_url with code/state.
     post = await client.get("/oauth/authorize/page/status", params={"pending": pending_id})
@@ -370,6 +375,21 @@ async def test_full_device_flow(app_with_oauth, client):
     refresh_record = await store.peek_refresh(tokens["refresh_token"])
     assert record.authorizing_key_fp == refresh_record["authorizing_key_fp"] == "f" * 64
 
+    refresh_form = {
+        "grant_type": "refresh_token",
+        "refresh_token": tokens["refresh_token"],
+        "client_id": client_id,
+    }
+    rotated = await client.post("/token", data=refresh_form)
+    assert rotated.status_code == 200, rotated.text
+    replacement = rotated.json()
+    assert replacement["access_token"] != tokens["access_token"]
+    assert replacement["refresh_token"] != tokens["refresh_token"]
+
+    replay = await client.post("/token", data=refresh_form)
+    assert replay.status_code == 400
+    assert replay.json()["error"] == "invalid_grant"
+
 
 @pytest.mark.asyncio
 async def test_oauth_pending_info_endpoint(app_with_oauth, client):
@@ -392,36 +412,13 @@ async def test_oauth_pending_info_endpoint(app_with_oauth, client):
     record = await store.load_pending_authorization(pending_id)
     assert record is not None and record["display_code"]
 
-
-@pytest.mark.asyncio
-async def test_oauth_pending_info_404_when_missing(client):
-    resp = await client.get("/api/v1/auth/oauth/pending/doesnotexist")
-    assert resp.status_code == 404
-    status = await client.get("/oauth/authorize/page/status", params={"pending": "doesnotexist"})
-    assert status.status_code == 410
-    assert status.json() == {"status": "expired"}
-
-
-@pytest.mark.asyncio
-async def test_oauth_verify_by_pending_id(app_with_oauth, client):
-    """Studio consent path: verify with pending_id instead of display_code."""
-    _, store, _ = app_with_oauth
-    client_id, pending_id, _, _ = await _start_authorize(
-        client, redirect_uri="https://claude.ai/cb", state="abc"
+    verified = await client.post(
+        "/api/v1/auth/oauth-verify", json={"pending_id": pending_id, "decision": "approve"}
     )
-
-    verify = await client.post(
-        "/api/v1/auth/oauth-verify",
-        json={"pending_id": pending_id, "decision": "approve"},
-    )
-    assert verify.status_code == 200, verify.text
-    body = verify.json()
-    assert body["status"] == "approved"
-    assert body["client_id"] == client_id
-
-    record = await store.load_pending_authorization(pending_id)
-    assert record is not None
-    assert record["verified"] is True
+    assert verified.status_code == 200, verified.text
+    assert verified.json()["status"] == "approved"
+    assert verified.json()["client_id"] == client_id
+    assert (await store.load_pending_authorization(pending_id))["verified"] is True
 
 
 @pytest.mark.asyncio
@@ -430,17 +427,11 @@ async def test_oauth_verify_requires_pending_or_code(client):
     assert resp.status_code == 400
     assert resp.json()["error_description"] == "Must provide either 'pending_id' or 'code'"
 
-
-@pytest.mark.asyncio
-async def test_oauth_verify_unknown_code(app_with_oauth, client):
-    _, _, _ = app_with_oauth
-    resp = await client.post(
-        "/api/v1/auth/oauth-verify",
-        json={"code": "BOGUS1", "decision": "approve"},
+    unknown = await client.post(
+        "/api/v1/auth/oauth-verify", json={"code": "BOGUS1", "decision": "approve"}
     )
-    assert resp.status_code == 400
-    body = resp.json()
-    assert "Invalid" in body.get("error_description", "") or "Invalid" in body.get("message", "")
+    assert unknown.status_code == 400
+    assert "Invalid" in unknown.json()["error_description"]
 
 
 @pytest.mark.asyncio
@@ -459,69 +450,8 @@ async def test_oauth_verify_deny_destroys_pending(app_with_oauth, client):
     # Pending row gone — page polling now returns 410.
     status = await client.get("/oauth/authorize/page/status", params={"pending": pending_id})
     assert status.status_code == 410
-
-
-@pytest.mark.asyncio
-async def test_oauth_verify_idempotency(app_with_oauth, client):
-    """A second verify with the same code must fail — pending is one-shot."""
-    _, store, _ = app_with_oauth
-    _, pending_id, _, _ = await _start_authorize(client)
-    record = await store.load_pending_authorization(pending_id)
-    code = record["display_code"]
-
-    first = await client.post(
-        "/api/v1/auth/oauth-verify", json={"code": code, "decision": "ap
```

**File**: `tests/server/oauth/test_storage.py` (modified, +68/-147)
```diff
@@ -5,12 +5,12 @@
 from __future__ import annotations
 
 import asyncio
-import time
+from types import SimpleNamespace
 
 import pytest
 import pytest_asyncio
 
-from openviking.server.oauth.otp import hash_secret
+from openviking.server.oauth import storage
 from openviking.server.oauth.storage import OAuthStore
 
 # Test stand-in for an API key fingerprint. Real fps come from
@@ -29,6 +29,13 @@ async def store(tmp_path):
         await s.close()
 
 
+@pytest.fixture
+def clock(monkeypatch):
+    now = SimpleNamespace(seconds=1_000)
+    monkeypatch.setattr(storage, "time", SimpleNamespace(time=lambda: now.seconds))
+    return now
+
+
 @pytest.mark.asyncio
 async def test_refresh_path_role_downgrade_rejected(store):
     """Provider's exchange_refresh_token must refuse to mint new tokens
@@ -70,42 +77,26 @@ async def test_refresh_path_role_downgrade_rejected(store):
     assert await store.peek_refresh(token) is not None
 
 
-@pytest.mark.asyncio
-async def test_register_and_get_client(store):
-    record = await store.register_client(
-        redirect_uris=["https://claude.ai/api/mcp/auth_callback"],
-        client_name="Claude.ai",
-        scope="mcp",
-    )
-    assert record["client_id"]
-    assert record["redirect_uris"] == ["https://claude.ai/api/mcp/auth_callback"]
-    assert record["token_endpoint_auth_method"] == "none"
-    assert record["scope"] == "mcp"
-    fetched = await store.get_client(record["client_id"])
-    assert fetched is not None
-    assert fetched["redirect_uris"] == ["https://claude.ai/api/mcp/auth_callback"]
-    assert fetched["client_name"] == "Claude.ai"
-    assert fetched["scope"] == "mcp"
-    assert "authorization_code" in fetched["grant_types"]
-    assert await store.get_client("unregistered-client") is None
-
-
-@pytest.mark.asyncio
 async def test_provider_get_client_keeps_registered_scope(store):
-    """The missing-scope fallback must not clobber an explicitly registered
-    scope (e.g. Claude registers its own scope string via DCR)."""
     from openviking.server.oauth.provider import OpenVikingOAuthProvider
 
+    callback = "https://claude.ai/api/mcp/auth_callback"
     record = await store.register_client(
-        redirect_uris=["https://claude.ai/api/mcp/auth_callback"],
-        client_name="Claude.ai",
-        scope="claudeai",
+        redirect_uris=[callback], client_name="Claude.ai", scope="claudeai"
     )
     provider = OpenVikingOAuthProvider(store=store, issuer="https://ov.test")
+
     client = await provider.get_client(record["client_id"])
     assert client is not None
+    assert client.client_id == record["client_id"]
+    assert client.redirect_uris is not None
+    assert [str(uri) for uri in client.redirect_uris] == [callback]
+    assert client.client_name == "Claude.ai"
+    assert client.token_endpoint_auth_method == "none"
+    assert "authorization_code" in client.grant_types
     assert client.scope == "claudeai"
     assert client.validate_scope("claudeai") == ["claudeai"]
+    assert await provider.get_client("unregistered-client") is None
 
 
 def _insert_code(store, code, *, account_id="a", user_id="u", ttl_seconds=300):
@@ -125,115 +116,56 @@ def _insert_code(store, code, *, account_id="a", user_id="u", ttl_seconds=300):
     )
 
 
-@pytest.mark.asyncio
 async def test_auth_code_concurrent_consume_race(store, tmp_path):
-    """Two coroutines racing to consume the same code — exactly one wins."""
     code = "race-code"
-    await _insert_code(store, code)
+    claims = {
+        "client_id": "cx",
+        "redirect_uri": "https://x.test/cb",
+        "code_challenge": "challenge-xyz",
+        "code_challenge_method": "S256",
+        "scope": "mcp",
+        "resource": "https://x.test/mcp",
+        "account_id": "a",
+        "user_id": "u",
+        "role": "user",
+        "authorizing_key_fp": _FP,
+    }
+    await store.insert_auth_code(code_plain=code, ttl_seconds=300, **claims)
     second_store = OAuthStore(tmp_path / "oauth.db")
     await second_store.initialize()
     try:
         results = await asyncio.gather(
             store.consume_auth_code(code), second_store.consume_auth_code(code)
         )
-        winners = [record for record in results if record is not None]
-        assert len(winners) == 1
-        assert (winners[0]["account_id"], winners[0]["user_id"]) == ("a", "u")
+        [winner] = [record for record in results if record is not None]
+        assert {field: winner[field] for field in claims} == claims
         assert await second_store.peek_auth_code(code) is None
     finally:
         await second_store.close()
 
 
-@pytest.mark.asyncio
-async def test_auth_code_expired_rejected(store):
-    code = "stale-code"
-    await _insert_code(store, code, ttl_seconds=60)
-    # Forge expiry by editing the row to be in the past.
-    assert store._conn is not None
-    store._conn.execute(
-        "UPDATE oauth_codes SET expires_at = ? WHERE used = 0",
-        (int(time.time()) - 10,),
```

**File**: `tests/server/test_api_key_manager.py` (modified, +50/-147)
```diff
@@ -428,22 +428,6 @@ async def mutate():
 # ---- User lifecycle tests ----
 
 
-async def test_register_user(manager: APIKeyManager):
-    """register_user should create a user with given role."""
-    from openviking.server.api_keys import parse_api_key
-
-    acct = _uid()
-    await manager.create_account(acct, "alice")
-    key = await manager.register_user(acct, "bob", "user")
-    assert parse_api_key(key)[:2] == (acct, "bob")
-
-    identity = await manager.resolve_identity(key)
-    assert identity.role == Role.USER
-    assert identity.account_id == acct
-    assert identity.user_id == "bob"
-    assert await manager.get_registered_user_role(acct, "bob") == Role.USER
-
-
 async def test_register_user_in_nonexistent_account_raises(manager: APIKeyManager):
     """Registering user in nonexistent account should raise NotFoundError."""
     with pytest.raises(NotFoundError):
@@ -516,7 +500,6 @@ async def test_regenerate_key(manager: APIKeyManager):
     old_key = await manager.register_user(account, "bob", Role.USER)
     original_fingerprint = hashlib.sha256(old_key.encode()).hexdigest()
     assert await manager.get_user_key_fingerprint(account, "bob") == original_fingerprint
-    assert await manager.get_user_key_fingerprint(account, "bob") == original_fingerprint
 
     new_key = await manager.regenerate_key(account, "bob")
     assert new_key != old_key
@@ -579,144 +562,74 @@ async def test_conditional_rotation_checks_persisted_key(manager_service, hashin
 
 
 async def test_set_role(manager: APIKeyManager):
-    """set_role should update user's role in both storage and index."""
+    """An issued key keeps its identity and sees the registered role change."""
+    from openviking.server.api_keys import parse_api_key
+
     acct = _uid()
     await manager.create_account(acct, "alice")
-    bob_key = await manager.register_user(acct, "bob", "user")
-
-    assert (await manager.resolve_identity(bob_key)).role == Role.USER
+    key = await manager.register_user(acct, "bob", "user")
+    assert parse_api_key(key)[:2] == (acct, "bob")
+    identity = await manager.resolve_identity(key)
+    assert (identity.account_id, identity.user_id, identity.role) == (acct, "bob", Role.USER)
+    assert await manager.get_registered_user_role(acct, "bob") == Role.USER
 
     await manager.set_role(acct, "bob", "admin")
-    assert (await manager.resolve_identity(bob_key)).role == Role.ADMIN
-
     with pytest.raises(PermissionDeniedError, match="server.root_api_key"):
         await manager.set_role(acct, "bob", Role.ROOT)
-    assert (await manager.resolve_identity(bob_key)).role == Role.ADMIN
+    assert (await manager.resolve_identity(key)).role == Role.ADMIN
+    assert await manager.get_registered_user_role(acct, "bob") == Role.ADMIN
 
 
-async def test_get_users(manager: APIKeyManager):
-    """list_users should list all users in an account."""
+async def test_get_users_pagination_and_ordering(manager: APIKeyManager):
     acct = _uid()
     await manager.create_account(acct, "alice")
-    await manager.register_user(acct, "bob", "user")
+    for user in ("dave", "alan", "carol"):
+        await manager.register_user(acct, user, "user")
 
     users = await _list_users(manager, acct)
-    user_ids = {u["user_id"] for u in users}
-    assert user_ids == {"alice", "bob"}
-
-    roles = {u["user_id"]: u["role"] for u in users}
-    assert roles["alice"] == "admin"
-    assert roles["bob"] == "user"
+    assert [(u["user_id"], u["role"]) for u in users] == [
+        ("alice", Role.ADMIN),
+        ("dave", Role.USER),
+        ("alan", Role.USER),
+        ("carol", Role.USER),
+    ]
+    for page, expected in enumerate((["alice", "dave"], ["alan", "carol"], []), start=1):
+        assert [
+            u["user_id"] for u in await _list_users(manager, acct, limit=2, page=page)
+        ] == expected
+    for pattern, expected in (("al*", ["alice", "alan"]), ("alice", ["alice"]), ("zzz*", [])):
+        assert [
+            u["user_id"] for u in await _list_users(manager, acct, name_filter=pattern)
+        ] == expected
 
     await manager.begin_deletion(
         acct,
-        "bob",
-        task_id="delete-bob",
+        "alan",
+        task_id="delete-alan",
         owner_account_id=acct,
         owner_user_id="alice",
     )
-    users = await _list_users(manager, acct)
-    assert {u["user_id"] for u in users} == {"alice"}
-
-
-async def test_get_users_name_filter(manager: APIKeyManager):
-    """list_users name_filter uses fnmatch wildcard matching against user IDs."""
-    acct = _uid()
-    await manager.create_account(acct, "alice")
-    await manager.register_user(acct, "alan", "user")
-    await manager.register_user(acct, "bob", "user")
-
-    # Wildcard substring match
-    matched = {u["user_id"] for u in await _list_users(manager, acct, name_filter="al*")}
-    assert matched == {"alice", "alan"}
-
-    # Exact match (no wildcard) only hits the literal ID
-    assert {u["user_id"] for u in 
```

**File**: `tests/server/test_api_privacy_configs.py` (modified, +23/-49)
```diff
@@ -122,19 +122,25 @@ async def test_privacy_config_api_roundtrip(client: httpx.AsyncClient):
     assert current_body["result"]["current"]["values"]["api_key"] == "sample"
     assert current_body["result"]["meta"]["active_version"] == 1
 
+    second_values = {"api_key": "secret-2", "new_key": "x"}
     second = await client.post(
         "/api/v1/privacy-configs/credential/demo-skill",
         json={
-            "values": {"api_key": "secret-2"},
+            "values": second_values,
             "change_reason": "rotate",
         },
     )
     assert second.status_code == 200
     assert second.json()["result"]["version"] == 2
+    assert second.json()["result"]["values"] == second_values
 
     versions = await client.get("/api/v1/privacy-configs/credential/demo-skill/versions")
     assert versions.status_code == 200
     assert versions.json()["result"] == [1, 2]
+    missing = await client.get("/api/v1/privacy-configs/credential/demo-skill/versions/10")
+    assert missing.status_code == 404
+    assert missing.json()["status"] == "error"
+    assert missing.json()["error"]["code"] == "NOT_FOUND"
 
     activate = await client.post(
         "/api/v1/privacy-configs/credential/demo-skill/activate",
@@ -144,31 +150,7 @@ async def test_privacy_config_api_roundtrip(client: httpx.AsyncClient):
     assert activate.json()["result"]["version"] == 1
 
     final_current = await client.get("/api/v1/privacy-configs/credential/demo-skill")
-    assert final_current.json()["result"]["current"]["values"]["api_key"] == "sample"
-
-
-async def test_privacy_config_update_allows_new_keys(client: httpx.AsyncClient):
-    create = await client.post(
-        "/api/v1/privacy-configs/skill/demo-skill-unknown-key",
-        json={
-            "values": {"api_key": "secret-1"},
-            "change_reason": "seed",
-        },
-    )
-    assert create.status_code == 200
-
-    update = await client.post(
-        "/api/v1/privacy-configs/skill/demo-skill-unknown-key",
-        json={
-            "values": {"api_key": "secret-2", "new_key": "x"},
-            "change_reason": "extend-keys",
-        },
-    )
-    assert update.status_code == 200
-    body = update.json()
-    assert body["status"] == "ok"
-    assert body["result"]["values"]["api_key"] == "secret-2"
-    assert body["result"]["values"]["new_key"] == "x"
+    assert final_current.json()["result"]["current"]["values"] == {"api_key": "sample"}
 
 
 async def test_privacy_config_patch_creates_target_and_atomically_merges_fields(
@@ -188,10 +170,11 @@ async def test_privacy_config_patch_creates_target_and_atomically_merges_fields(
     )
     assert updated.status_code == 200, updated.text
     assert updated.json()["result"]["version"] == 2
-    assert updated.json()["result"]["values"] == {
-        "pat": "github_pat_mock_value",
-        "username": "alice",
-    }
+    expected = {"pat": "github_pat_mock_value", "username": "alice"}
+    assert updated.json()["result"]["values"] == expected
+    current = await client.get("/api/v1/privacy-configs/credential/github")
+    assert current.status_code == 200, current.text
+    assert current.json()["result"]["current"]["values"] == expected
 
 
 async def test_privacy_api_rejects_invalid_target_with_structured_format_error(
@@ -227,25 +210,6 @@ async def test_privacy_api_rejects_oversized_values_without_echoing_secret(
     assert secret not in response.text
 
 
-async def test_privacy_config_get_version_not_found(client: httpx.AsyncClient):
-    create = await client.post(
-        "/api/v1/privacy-configs/skill/demo-skill-version-not-found",
-        json={
-            "values": {"api_key": "secret-1"},
-            "change_reason": "seed",
-        },
-    )
-    assert create.status_code == 200
-
-    missing = await client.get(
-        "/api/v1/privacy-configs/skill/demo-skill-version-not-found/versions/10"
-    )
-    assert missing.status_code == 404
-    body = missing.json()
-    assert body["status"] == "error"
-    assert body["error"]["code"] == "NOT_FOUND"
-
-
 async def test_privacy_config_target_not_found(client: httpx.AsyncClient):
     missing_target = "demo-skill-target-not-found"
 
@@ -394,6 +358,16 @@ async def test_privacy_config_delete_is_idempotent_and_removes_history(
     assert deleted_again.status_code == 200, deleted_again.text
     assert deleted_again.json()["result"]["deleted"] is False
 
+    recreated = await client.post(
+        "/api/v1/privacy-configs/credential/delete-me",
+        json={"values": {"api_key": "replacement"}},
+    )
+    assert recreated.status_code == 200, recreated.text
+    assert recreated.json()["result"]["version"] == 1
+    old_version = await client.get("/api/v1/privacy-configs/credential/delete-me/versions/2")
+    assert old_version.status_code == 404
+    assert old_version.json()["error"]["code"] == "NOT_FOUND"
+
 
 async def test_privacy_scan_is_dry_run_by_default_and_fix_rewrites_content(
     client: httpx.AsyncClient,
```

---

### Incident Patch 2: `4fe7846b` (2026-11-27)
**Commit Message**: fix(studio): manage Compile plans by compile_name (#8393)

* fix(studio): manage Compile plans by compile_name

The scheduled plans tab crashed with "Cannot read properties of undefined
(reading 'map')" because GET /api/v1/compile/configs returns configs, not
targets. Studio also still read and updated configurations by to, and
created scheduled plans through the full-input POST /api/v1/compile,
which now rejects scheduling options.

- List, read and update configurations by compile_name, and carry saved
  args through updates so they are not cleared.
- Show next_triggered_slot and last_run_time instead of the removed
  next_run_at and running fields.
- Save new scheduled plans with POST /api/v1/compile/create under a
  validated plan name.
- Open the editor at /compile/new?name=<compile_name>.

Fixes #8392

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(studio): read last_run_time as Unix seconds

The Last run column passed last_run_time to new Date() as milliseconds,
but the API returns Unix seconds from task created_at, so 1793606700
rendered as 1970-01-21. Type last_run_time and task_first_create_time as
number | null and scale Last run by 1000; next_triggered_slot s

**File**: `web-studio/src/features/workbench/compile/components/compile-form.test.tsx` (modified, +56/-15)
```diff
@@ -18,6 +18,8 @@ import { afterEach, beforeEach, expect, it, vi } from 'vitest'
 const api = vi.hoisted(() => ({
   BUILTIN_SKILLS_ROOT: 'viking://system/compile/example-skills',
   createCompile: vi.fn(),
+  createCompileConfig: vi.fn(),
+  isCompileName: (name: string) => /^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(name),
   fetchCompileConfig: vi.fn(),
   updateCompileConfig: vi.fn(),
   lookupSubmission: vi.fn(),
@@ -81,7 +83,7 @@ const storageKey = 'compile-submission:recovery-test'
 const clients: QueryClient[] = []
 const task = { task_id: 'cmp-original', status: 'pending' }
 function mount(
-  props: { fromTask?: string; sourceUri?: string; target?: string } = {},
+  props: { fromTask?: string; sourceUri?: string; compileName?: string } = {},
   cachedConfig?: unknown,
   cachedAt = Date.now(),
 ) {
@@ -91,7 +93,7 @@ function mount(
   clients.push(client)
   if (cachedConfig)
     client.setQueryData(
-      ['compile-config', 'recovery-test', props.target],
+      ['compile-config', 'recovery-test', props.compileName],
       cachedConfig,
       { updatedAt: cachedAt },
     )
@@ -259,22 +261,32 @@ it('still recovers an accepted task when execution is no longer configured', asy
   await waitFor(() => expect(api.navigate).toHaveBeenCalled())
   expect(api.createCompile).not.toHaveBeenCalled()
 })
+// Shape follows GET /api/v1/compile/config.
 const configuredTarget = {
-  ...savedDraft,
+  compile_name: 'weekly-wiki',
   from: savedDraft.sources.split('\n'),
+  to: savedDraft.to,
+  skill: savedDraft.skill,
+  instruction: savedDraft.instruction,
+  args: { mode_hint: 'summary' },
   auto_update: true,
   update_schedule: { frequency: 'weekly', weekday: 3, hour: 14, minute: 30 },
-  next_run_at: '2026-11-04T14:30:00+08:00',
+  task_first_create_time: null,
+  last_run_time: null,
+  last_triggered_slot: null,
+  next_triggered_slot: '2026-11-04T14:30:00+08:00',
 }
+const planName = () => screen.getByRole('textbox', { name: 'schedule.name *' })
 
 it('saves a weekly plan without navigating to a task or leaving a submission recovery key', async () => {
   prepareCompileHandoff(
     'recovery-test',
     'compile --from viking://resources/source --to viking://resources/wiki --skill viking://agent/skills/wiki',
   )
-  api.createCompile.mockResolvedValueOnce(configuredTarget)
+  api.createCompileConfig.mockResolvedValueOnce({ compile_name: 'weekly-wiki' })
   const page = mount()
   fireEvent.click(page.getByRole('checkbox', { name: 'schedule.enabled' }))
+  fireEvent.change(planName(), { target: { value: 'weekly-wiki' } })
   await choose(
     page.getByRole('combobox', { name: 'schedule.frequency' }),
     'schedule.weekly',
@@ -292,23 +304,47 @@ it('saves a weekly plan without navigating to a task or leaving a submission rec
       search: { tab: 'schedules' },
     }),
   )
-  expect(api.createCompile.mock.calls[0][0].args).toEqual({
-    auto_update: true,
-    update_schedule: configuredTarget.update_schedule,
+  expect(api.createCompileConfig).toHaveBeenCalledWith({
+    compile_name: 'weekly-wiki',
+    from: ['viking://resources/source'],
+    to: 'viking://resources/wiki',
+    skill: 'viking://agent/skills/wiki',
+    args: {
+      auto_update: true,
+      update_schedule: configuredTarget.update_schedule,
+    },
   })
+  expect(api.createCompile).not.toHaveBeenCalled()
   expect(sessionStorage.getItem(storageKey)).toBeNull()
 })
 
+it('requires a valid plan name before saving a schedule', async () => {
+  prepareCompileHandoff(
+    'recovery-test',
+    'compile --from viking://resources/source --to viking://resources/wiki --skill viking://agent/skills/wiki',
+  )
+  const page = mount()
+  fireEvent.click(page.getByRole('checkbox', { name: 'schedule.enabled' }))
+  page.submit()
+  expect(await page.findByText('schedule.nameRequired')).toBeTruthy()
+  fireEvent.change(planName(), { target: { value: '-weekly' } })
+  page.submit()
+  expect(await page.findByText('schedule.nameInvalid')).toBeTruthy()
+  expect(api.createCompileConfig).not.toHaveBeenCalled()
+  expect(api.createCompile).not.toHaveBeenCalled()
+})
+
 it('keeps a failed plan save retryable without task submission recovery', async () => {
   prepareCompileHandoff(
     'recovery-test',
     'compile --from viking://resources/source --to viking://resources/wiki --skill viking://agent/skills/wiki',
   )
-  api.createCompile
+  api.createCompileConfig
     .mockRejectedValueOnce(new Error('response lost'))
-    .mockResolvedValueOnce(configuredTarget)
+    .mockResolvedValueOnce({ compile_name: 'weekly-wiki' })
   const page = mount()
   fireEvent.click(page.getByRole('checkbox', { name: 'schedule.enabled' }))
+  fireEvent.change(planName(), { target: { value: 'weekly-wiki' } })
   page.submit()
   await waitFor(() => expect(page.getByRole('alert')).toBeTruthy())
   expect(sessionStorage.getItem(storageKey)).toBeNull()
@@ -329,7 +365,7 @@ it('loads a registered target and disables its schedule without requiring an exe
     configur
```

**File**: `web-studio/src/features/workbench/compile/components/compile-form.tsx` (modified, +82/-41)
```diff
@@ -16,14 +16,15 @@ import {
   ScheduleFields,
 } from '#/features/workbench/compile/components/schedule-fields'
 import type {
-  CompileConfig,
   CompileRequest,
   CompileTask,
   UpdateSchedule,
 } from '#/features/workbench/compile/lib/api'
 import {
   createCompile,
+  createCompileConfig,
   fetchCompileConfig,
+  isCompileName,
   fetchCompileTask,
   lookupSubmission,
   updateCompileConfig,
@@ -53,6 +54,7 @@ import {
 import { isOvClientError } from '#/shared/api/ov-client/index'
 import { createRandomUuid } from '#/shared/lib/browser-crypto'
 import { Button } from '#/shared/ui/button'
+import { Input } from '#/shared/ui/input'
 import {
   Dialog,
   DialogContent,
@@ -87,11 +89,11 @@ function readDraft(key: string): Draft {
 export function CompileForm({
   fromTask,
   sourceUri,
-  target,
+  compileName,
 }: {
   fromTask?: string
   sourceUri?: string
-  target?: string
+  compileName?: string
 }) {
   const { t } = useTranslation('compile'),
     navigate = useNavigate()
@@ -103,14 +105,15 @@ export function CompileForm({
   const queryClient = useQueryClient()
   const [autoUpdate, setAutoUpdate] = useState(false)
   const [schedule, setSchedule] = useState<UpdateSchedule>(defaultSchedule)
+  const [planName, setPlanName] = useState('')
   const config = useQuery({
-    queryKey: ['compile-config', identityScopeKey, target],
-    queryFn: ({ signal }) => fetchCompileConfig(target!, signal),
-    enabled: !!target,
+    queryKey: ['compile-config', identityScopeKey, compileName],
+    queryFn: ({ signal }) => fetchCompileConfig(compileName!, signal),
+    enabled: !!compileName,
     staleTime: 0,
   })
   const [recoverKey, setRecoverKey] = useState(() => {
-    if (target) return null
+    if (compileName) return null
     try {
       return sessionStorage.getItem(submissionKey)
     } catch {
@@ -125,8 +128,8 @@ export function CompileForm({
     clearCompileHandoff()
   }, [])
   const [draft, setDraft] = useState(() =>
-    target
-      ? { ...empty, to: target }
+    compileName
+      ? empty
       : recoverKey
         ? savedDraft
         : handoff
@@ -144,7 +147,7 @@ export function CompileForm({
               },
   )
   const [args, setArgs] = useState(
-      !target && !recoverKey && handoff?.args
+      !compileName && !recoverKey && handoff?.args
         ? JSON.stringify(handoff.args, null, 2)
         : '',
     ),
@@ -175,14 +178,14 @@ export function CompileForm({
     enableBeforeUnload: () => !completed.current && !!args.trim(),
   })
   useEffect(() => {
-    if (completed.current || !draftStarted || target) return
+    if (completed.current || !draftStarted || compileName) return
     try {
       localStorage.setItem(draftKey, JSON.stringify(draft))
       setSavingError(false)
     } catch {
       setSavingError(true)
     }
-  }, [draft, draftKey, draftStarted, target])
+  }, [draft, draftKey, draftStarted, compileName])
   useEffect(() => {
     if (!config.isSuccess || !config.isFetchedAfterMount || filled.current)
       return
@@ -243,6 +246,15 @@ export function CompileForm({
         ? t('invalidUri')
         : '',
     to: targetError(draft.to.trim()) ? t(targetError(draft.to.trim())!) : '',
+    // Only new plans need a name; existing configurations keep theirs.
+    name:
+      compileName || !autoUpdate
+        ? ''
+        : !planName.trim()
+          ? t('schedule.nameRequired')
+          : !isCompileName(planName.trim())
+            ? t('schedule.nameInvalid')
+            : '',
     args: (() => {
       try {
         const parsed = parseArgs(args)
@@ -319,10 +331,10 @@ export function CompileForm({
   function isCurrent() {
     return mounted.current
   }
-  async function finish(result: CompileTask | CompileConfig) {
+  async function finish(result: CompileTask | { compile_name: string }) {
     if (!isCurrent()) return
     completed.current = true
-    if (!target) {
+    if (!compileName) {
       try {
         localStorage.removeItem(draftKey)
         sessionStorage.removeItem(submissionKey)
@@ -350,7 +362,7 @@ export function CompileForm({
   async function submit() {
     if (
       busy ||
-      (target &&
+      (compileName &&
         (!config.data || !config.isFetchedAfterMount || config.isError))
     )
       return
@@ -375,14 +387,16 @@ export function CompileForm({
           throw new Error(t('expiredSubmission'))
       }
       if (!submission.current && !validate()) return
-      if (target) {
+      if (compileName) {
         const body = request()
         await finish(
           await updateCompileConfig({
-            to: target,
+            compile_name: compileName,
             from: body.from,
             skill: body.skill,
             instruction: draft.instruction.trim() || null,
+            // Args are not editable here; updates replace them, so keep the saved ones.
+            args: config.data?.args ?? null,
             auto_update: autoUpdate,
             update_schedule: autoUpdate ? 
```

**File**: `web-studio/src/features/workbench/compile/components/schedule-list.test.tsx` (modified, +68/-45)
```diff
@@ -54,25 +54,37 @@ vi.mock('#/features/workbench/compile/components/shared', () => ({
   ),
 }))
 
+// Shapes follow GET /api/v1/compile/configs.
 const daily = {
+  compile_name: 'daily',
+  from: ['viking://resources/source'],
   to: 'viking://resources/daily',
-  status: 'ready',
-  initialized: true,
-  running: true,
+  skill: 'viking://agent/skills/wiki',
+  instruction: null,
+  args: {},
   auto_update: true,
   update_schedule: { frequency: 'daily', hour: 8, minute: 5 },
-  next_run_at: '2026-11-03T08:05:00+00:00',
+  task_first_create_time: 1793577600,
+  last_run_time: 1793606700,
+  last_triggered_slot: '2026-11-02T08:05:00+00:00',
+  next_triggered_slot: '2026-11-03T08:05:00+00:00',
+  owner_user_id: 'alice',
+  executor_user_id: 'alice',
+  updated_by: 'alice',
 }
 const weekly = {
   ...daily,
+  compile_name: 'weekly',
   to: 'viking://resources/weekly',
-  running: false,
   auto_update: false,
   update_schedule: { frequency: 'weekly', weekday: 3, hour: 14, minute: 30 },
-  next_run_at: null,
+  last_run_time: null,
+  last_triggered_slot: null,
+  next_triggered_slot: null,
 }
 const unscheduled = {
   ...weekly,
+  compile_name: 'unscheduled',
   to: 'viking://resources/unscheduled',
   update_schedule: null,
 }
@@ -91,7 +103,10 @@ function mount(cachedConfig?: unknown) {
   })
   clients.push(client)
   if (cachedConfig)
-    client.setQueryData(['compile-config', 'account-a', daily.to], cachedConfig)
+    client.setQueryData(
+      ['compile-config', 'account-a', daily.compile_name],
+      cachedConfig,
+    )
   const content = () => (
     <QueryClientProvider client={client}>
       <CompileScheduleList />
@@ -114,7 +129,7 @@ afterEach(() => {
 
 it('shows all registered targets, schedule details, execution state, and editor actions', async () => {
   mocks.fetchCompileConfigs.mockResolvedValue({
-    targets: [daily, weekly, unscheduled],
+    configs: [daily, weekly, unscheduled],
     next_cursor: null,
   })
   const page = mount()
@@ -125,22 +140,24 @@ it('shows all registered targets, schedule details, execution state, and editor
     page.getByText('schedule.weeklyAt schedule.weekdays.3 14:30'),
   ).toBeTruthy()
   expect(page.getByText('schedule.noSchedule')).toBeTruthy()
-  expect(page.getByText('schedule.running')).toBeTruthy()
-  expect(page.getAllByText('schedule.idle')).toHaveLength(2)
+  expect(page.getByRole('heading', { name: daily.compile_name })).toBeTruthy()
+  expect(page.getAllByText('schedule.neverRun')).toHaveLength(2)
   expect(page.getAllByText('schedule.active')).toHaveLength(1)
   const nextRun = page.container.querySelector('time')!
   expect(nextRun.dateTime).toBe('2026-11-03T08:05:00.000Z')
   expect(nextRun.textContent).toBe(
-    new Date(daily.next_run_at).toLocaleString('en', {
+    new Date(daily.next_triggered_slot).toLocaleString('en', {
       timeZone: 'Asia/Shanghai',
     }),
   )
+  const lastRun = page.container.querySelectorAll('time')[1]
+  expect(lastRun.dateTime).toBe('2026-11-02T08:05:00.000Z')
   fireEvent.click(
-    page.getByRole('button', { name: `schedule.edit: ${weekly.to}` }),
+    page.getByRole('button', { name: `schedule.edit: ${weekly.compile_name}` }),
   )
   expect(mocks.navigate).toHaveBeenCalledWith({
     to: '/compile/new',
-    search: { target: weekly.to },
+    search: { name: weekly.compile_name },
   })
   expect(mocks.fetchCompileConfigs).toHaveBeenCalledWith(
     undefined,
@@ -150,8 +167,8 @@ it('shows all registered targets, schedule details, execution state, and editor
 
 it('filters loaded targets locally and keeps pagination available when a page has no matches', async () => {
   mocks.fetchCompileConfigs
-    .mockResolvedValueOnce({ targets: [daily], next_cursor: 'page-2' })
-    .mockResolvedValueOnce({ targets: [weekly], next_cursor: null })
+    .mockResolvedValueOnce({ configs: [daily], next_cursor: 'page-2' })
+    .mockResolvedValueOnce({ configs: [weekly], next_cursor: null })
   const page = mount()
   await page.findByRole('link', { name: daily.to })
   await choose(
@@ -178,7 +195,7 @@ it('filters loaded targets locally and keeps pagination available when a page ha
 
 it('only claims an exhaustive filtered empty result after the last page', async () => {
   mocks.fetchCompileConfigs.mockResolvedValue({
-    targets: [daily],
+    configs: [daily],
     next_cursor: null,
   })
   const page = mount()
@@ -199,7 +216,7 @@ it('shows loading and retryable errors, then the empty registered-target state',
   await page.findByRole('alert')
   expect(page.queryByText('schedule.empty')).toBeNull()
   mocks.fetchCompileConfigs.mockResolvedValueOnce({
-    targets: [],
+    configs: [],
     next_cursor: null,
   })
   fireEvent.click(page.getByRole('button', { name: 'Retry' }))
@@ -209,9 +226,9 @@ it('shows loading and retryable errors, then the empty registered-target state',
 
 it('refreshes the current list and isolates data when the active identity changes', async () => {
   mocks.fetchCompileC
```

**File**: `web-studio/src/features/workbench/compile/components/schedule-list.tsx` (modified, +2/-2)
```diff
@@ -25,7 +25,7 @@ export function CompileScheduleList() {
   const targets = [
     ...new Map(
       query.data?.pages.flatMap((page) =>
-        page.targets.map((target) => [target.to, target] as const),
+        page.configs.map((config) => [config.compile_name, config] as const),
       ),
     ).values(),
   ].filter(
@@ -83,7 +83,7 @@ export function CompileScheduleList() {
         <ul className="overflow-hidden rounded-xl border">
           {targets.map((target) => (
             <CompileScheduleTarget
-              key={`${identityScopeKey}:${target.to}`}
+              key={`${identityScopeKey}:${target.compile_name}`}
               target={target}
             />
           ))}
```

**File**: `web-studio/src/features/workbench/compile/components/schedule-target.tsx` (modified, +54/-24)
```diff
@@ -36,6 +36,10 @@ import { useTranslation } from 'react-i18next'
 import { toast } from 'sonner'
 
 const SCHEDULE_TIME_ZONE = 'Asia/Shanghai'
+const parseTime = (value: string | null | undefined) => {
+  const time = value ? new Date(value) : null
+  return time && !Number.isNaN(time.getTime()) ? time : null
+}
 type ConfigPage = Awaited<ReturnType<typeof fetchCompileConfigs>>
 
 export function CompileScheduleTarget({
@@ -56,14 +60,19 @@ export function CompileScheduleTarget({
       // Read fresh source/Skill settings so a list action cannot restore stale ones.
       const controller = new AbortController()
       pendingRead.current = controller
-      const config = await fetchCompileConfig(target.to, controller.signal)
+      const config = await fetchCompileConfig(
+        target.compile_name,
+        controller.signal,
+      )
       // The active connection may have changed while reading the configuration.
       controller.signal.throwIfAborted()
       return updateCompileConfig({
-        to: target.to,
+        compile_name: target.compile_name,
         from: config.from,
         skill: config.skill,
         instruction: config.instruction,
+        // Updates replace args, so carry the saved ones forward.
+        args: config.args,
         auto_update: schedule !== null,
         update_schedule: schedule,
       })
@@ -78,8 +87,10 @@ export function CompileScheduleTarget({
             ...data,
             pages: data.pages.map((page) => ({
               ...page,
-              targets: page.targets.map((item) =>
-                item.to === target.to ? { ...item, ...config } : item,
+              configs: page.configs.map((item) =>
+                item.compile_name === target.compile_name
+                  ? { ...item, ...config }
+                  : item,
               ),
             })),
           },
@@ -91,7 +102,7 @@ export function CompileScheduleTarget({
       await Promise.all([
         client.invalidateQueries({ queryKey: listKey }),
         client.invalidateQueries({
-          queryKey: ['compile-config', identityScopeKey, target.to],
+          queryKey: ['compile-config', identityScopeKey, target.compile_name],
           refetchType: 'none',
         }),
       ])
@@ -105,25 +116,38 @@ export function CompileScheduleTarget({
   const time = schedule
     ? `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`
     : ''
-  const nextRun = target.next_run_at ? new Date(target.next_run_at) : null
-  const validNextRun = nextRun && !Number.isNaN(nextRun.getTime())
+  const nextRun = parseTime(target.next_triggered_slot)
+  const lastRun =
+    target.last_run_time == null
+      ? null
+      : new Date(target.last_run_time * 1000)
+  const formatTime = (value: Date) =>
+    value.toLocaleString(i18n.language, { timeZone: SCHEDULE_TIME_ZONE })
 
   return (
     <li
       className="space-y-4 border-b p-5 last:border-b-0"
       aria-busy={mutation.isPending}
     >
       <div className="flex flex-wrap items-start justify-between gap-3">
-        <h2 className="min-w-0 flex-1 break-words text-sm font-medium [overflow-wrap:anywhere]">
-          <ContextLink uri={target.to}>{target.to}</ContextLink>
-        </h2>
+        <div className="min-w-0 flex-1 space-y-1">
+          <h2 className="break-words text-sm font-medium [overflow-wrap:anywhere]">
+            {target.compile_name}
+          </h2>
+          <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
+            <ContextLink uri={target.to}>{target.to}</ContextLink>
+          </p>
+        </div>
         <Button
           variant="ghost"
           size="sm"
           disabled={mutation.isPending}
-          aria-label={`${t('schedule.edit')}: ${target.to}`}
+          aria-label={`${t('schedule.edit')}: ${target.compile_name}`}
           onClick={() =>
-            void navigate({ to: '/compile/new', search: { target: target.to } })
+            void navigate({
+              to: '/compile/new',
+              search: { name: target.compile_name },
+            })
           }
         >
           {t('schedule.edit')}
@@ -132,11 +156,11 @@ export function CompileScheduleTarget({
       <div className="flex flex-wrap items-center gap-3">
         <label htmlFor={switchId} className="text-sm font-medium">
           {t('schedule.autoUpdate')}
-          <span className="sr-only">{`: ${target.to}`}</span>
+          <span className="sr-only">{`: ${target.compile_name}`}</span>
         </label>
         <Switch
           id={switchId}
-          aria-label={`${t('schedule.autoUpdate')}: ${target.to}`}
+          aria-label={`${t('schedule.autoUpdate')}: ${target.compile_name}`}
           checked={target.auto_update}
           disabled={mutation.isPending}
           onCheckedChange={(checked) => {
@@ -181,7 +205,7 @@ export function CompileScheduleTarget({
               size="sm"
               className="h-auto px-1 py-0.5 te
```

**File**: `web-studio/src/features/workbench/compile/lib/api.test.ts` (modified, +38/-22)
```diff
@@ -2,10 +2,11 @@ import { beforeEach, describe, expect, it, vi } from 'vitest'
 
 import {
   BUILTIN_SKILLS_ROOT,
-  createCompile,
+  createCompileConfig,
   fetchCompileConfig,
   fetchCompileConfigs,
   fetchCompileSkills,
+  isCompileName,
   updateCompileConfig,
   fetchCompileTask,
   fetchCompileTasks,
@@ -39,44 +40,46 @@ beforeEach(() => {
 })
 
 describe('Compile scheduling APIs', () => {
-  it('accepts a saved configuration without inventing a task ID', async () => {
-    const config = {
+  it('creates a named configuration without executing it', async () => {
+    clientMocks.post.mockResolvedValueOnce({ compile_name: '每日_wiki' })
+    const body = {
+      compile_name: '每日_wiki',
+      from: ['viking://resources/source'],
       to: 'viking://resources/wiki',
-      auto_update: true,
-      next_run_at: '2026-11-03T09:00:00+08:00',
-    }
-    clientMocks.post.mockResolvedValueOnce(config)
-    const result = await createCompile(
-      {
-        from: ['viking://resources/source'],
-        to: config.to,
-        skill: 'viking://agent/skills/wiki',
-        args: { auto_update: true },
+      skill: 'viking://agent/skills/wiki',
+      args: {
+        auto_update: true,
+        update_schedule: { frequency: 'daily' as const, hour: 9, minute: 0 },
       },
-      'schedule-save-key',
-    )
-    expect(result).toEqual(config)
-    expect(result).not.toHaveProperty('task_id')
+    }
+    await expect(createCompileConfig(body)).resolves.toEqual({
+      compile_name: '每日_wiki',
+    })
+    expect(clientMocks.post).toHaveBeenLastCalledWith({
+      url: '/api/v1/compile/create',
+      body,
+    })
   })
 
-  it('passes target cursors and URI query values without changing them', async () => {
-    const cursor = 'viking://resources/a folder?value=1'
+  it('addresses configurations by compile_name and passes cursors unchanged', async () => {
+    const cursor = 'team-wiki_2'
     await fetchCompileConfigs(cursor)
     expect(clientMocks.get).toHaveBeenLastCalledWith({
       url: '/api/v1/compile/configs',
       signal: undefined,
       query: { limit: 30, cursor },
     })
-    await fetchCompileConfig(cursor)
+    await fetchCompileConfig('团队 wiki?')
     expect(clientMocks.get).toHaveBeenLastCalledWith({
       url: '/api/v1/compile/config',
       signal: undefined,
-      query: { to: cursor },
+      query: { compile_name: '团队 wiki?' },
     })
     const body = {
-      to: cursor,
+      compile_name: 'team-wiki',
       from: ['viking://resources/source'],
       skill: 'viking://agent/skills/wiki',
+      args: { mode_hint: 'summary' },
       auto_update: false,
       update_schedule: null,
     }
@@ -86,6 +89,19 @@ describe('Compile scheduling APIs', () => {
       body,
     })
   })
+
+  it.each([
+    ['team-wiki_2', true],
+    ['每日编译', true],
+    ['-leading', false],
+    ['has space', false],
+    ['a'.repeat(64), true],
+    ['a'.repeat(65), false],
+    ['汉'.repeat(32), true],
+    ['汉'.repeat(33), false],
+  ])('validates compile name %s', (name, valid) => {
+    expect(isCompileName(name)).toBe(valid)
+  })
 })
 
 describe('compile task API normalization', () => {
```

**File**: `web-studio/src/features/workbench/compile/lib/api.ts` (modified, +43/-23)
```diff
@@ -19,33 +19,47 @@ export type CompileRequest = {
 export type UpdateSchedule =
   | { frequency: 'daily'; hour: number; minute: number }
   | { frequency: 'weekly'; weekday: number; hour: number; minute: number }
-export type CompileConfigSummary = {
-  status: string
+// Saved configurations are identified by their creator-scoped compile_name.
+export type CompileConfig = {
+  compile_name: string
+  from: string[]
   to: string
-  initialized: boolean
-  running: boolean
+  skill: string
+  instruction: string | null
+  args: Record<string, unknown> | null
   auto_update: boolean
   update_schedule: UpdateSchedule | null
-  next_run_at: string | null
+  // Unix seconds, as stored on the task records.
+  task_first_create_time: number | null
+  last_run_time: number | null
+  last_triggered_slot: string | null
+  next_triggered_slot: string | null
 }
-export type CompileConfig = Omit<CompileConfigSummary, 'running'> & {
-  from: string[]
-  skill: string
-  instruction: string | null
-  last_error: string | null
-  last_run: unknown
+export type CompileConfigSummary = CompileConfig & {
+  owner_user_id?: string
+  executor_user_id?: string | null
+  updated_by?: string | null
 }
+export type CompileConfigCreate = Required<
+  Pick<CompileRequest, 'from' | 'to' | 'skill'>
+> &
+  Pick<CompileRequest, 'instruction' | 'args'> & { compile_name: string }
 export type CompileConfigUpdate = {
-  to: string
+  compile_name: string
   from: string[]
   skill: string
   instruction?: string | null
+  args?: Record<string, unknown> | null
   auto_update: boolean
   update_schedule: UpdateSchedule | null
 }
+// Mirrors the server's CompileName pattern; the server remains authoritative.
+const COMPILE_NAME =
+  /^(?:[A-Za-z0-9_][A-Za-z0-9_-]{0,63}|[\p{Script=Han}A-Za-z0-9_][\p{Script=Han}A-Za-z0-9_-]{0,31})$/u
+export const isCompileName = (name: string) => COMPILE_NAME.test(name)
 export function fetchCompileConfigs(cursor?: string, signal?: AbortSignal) {
   return getOvResult<{
-    targets: CompileConfigSummary[]
+    configs: CompileConfigSummary[]
     next_cursor: string | null
   }>(
     ovClient.client.get({
@@ -55,15 +69,20 @@ export function fetchCompileConfigs(cursor?: string, signal?: AbortSignal) {
     }),
   )
 }
-export function fetchCompileConfig(to: string, signal?: AbortSignal) {
+export function fetchCompileConfig(compileName: string, signal?: AbortSignal) {
   return getOvResult<CompileConfig>(
     ovClient.client.get({
       url: '/api/v1/compile/config',
       signal,
-      query: { to },
+      query: { compile_name: compileName },
     }),
   )
 }
+export function createCompileConfig(body: CompileConfigCreate) {
+  return getOvResult<{ compile_name: string }>(
+    ovClient.client.post({ url: '/api/v1/compile/create', body }),
+  )
+}
 export function updateCompileConfig(body: CompileConfigUpdate) {
   return getOvResult<CompileConfig>(
     ovClient.client.post({
@@ -147,15 +166,16 @@ export async function fetchCompileTask(id: string, signal?: AbortSignal) {
 export async function createCompile(
   body: CompileRequest,
   key: string,
-): Promise<CompileTask | CompileConfig> {
-  const result = await getOvResult<CompileTaskPayload | CompileConfig>(
-    ovClient.client.post({
-      url: '/api/v1/compile',
-      body,
-      headers: { 'Idempotency-Key': key },
-    }),
+): Promise<CompileTask> {
+  return normalizeCompileTask(
+    await getOvResult<CompileTaskPayload>(
+      ovClient.client.post({
+        url: '/api/v1/compile',
+        body,
+        headers: { 'Idempotency-Key': key },
+      }),
+    ),
   )
-  return 'task_id' in result ? normalizeCompileTask(result) : result
 }
 export async function cancelCompile(id: string) {
   return normalizeCompileTask(
```

**File**: `web-studio/src/features/workbench/compile/lib/terminal.test.ts` (modified, +6/-14)
```diff
@@ -21,23 +21,15 @@ beforeEach(() => vi.resetAllMocks())
 afterEach(() => vi.unstubAllGlobals())
 
 describe('Compile terminal regressions', () => {
-  it('handles a saved plan without a task ID or a persistent recovery key', async () => {
-    api.createCompile.mockResolvedValue({
-      to: 'viking://resources/b',
-      next_run_at: '2026-11-03T09:00:00+08:00',
-    })
+  it('surfaces scheduling-option rejections without keeping a recovery key', async () => {
+    const rejection = new Error('use POST /api/v1/compile/create')
+    api.createCompile.mockRejectedValue(rejection)
     const saveKey = vi.fn()
     const pending = { current: null }
     const command = `compile --from viking://resources/a --to viking://resources/b --skill viking://agent/skills/s --args '{"auto_update":true,"update_schedule":{"frequency":"daily"}}'`
-    const result = await runCompileSubmission(
-      command,
-      pending,
-      (value) => value,
-      saveKey,
-    )
-    expect(result.taskId).toBeUndefined()
-    expect(result.body).toContain('2026-11-03T09:00:00+08:00')
-    expect(result.body).not.toContain('undefined')
+    await expect(
+      runCompileSubmission(command, pending, (value) => value, saveKey),
+    ).rejects.toBe(rejection)
     expect(pending.current).toBeNull()
     expect(saveKey).not.toHaveBeenCalled()
   })
```

---

### Incident Patch 3: `28194c3b` (2026-11-27)
**Commit Message**: fix(retry): apply the rate-limit backoff on 429 responses (#7948)

rate_limit_retry_delay() has no call site: every retryable error, including
a provider rate limit, is delayed by _compute_delay() with the generic
0.5s -> 8s backoff. The dedicated LLM backoff (5s -> 120s with jitter)
was added in #2503 and never wired in.

The generic backoff is short enough to keep a provider's limiter
saturated: the retries themselves consume the quota, so the limit window
never recovers and the work unit fails with the raw 429 instead of
backing off and succeeding. Measured against a provider that allows ~5
concurrent requests: 3277 rejected requests in 5 minutes, with the log
showing "retrying in 0.94s".

retry_sync() and retry_async() now pick the delay through _retry_delay(),
which uses rate_limit_retry_delay() for errors that
is_retryable_rate_limit_error() accepts and keeps the generic backoff for
every other transient error. The attempt number is 1-based, so the ramp
is 5s, 10s, 20s, 40s, 80s, 120s.

Fixes #7936

**File**: `openviking/utils/model_retry.py` (modified, +29/-2)
```diff
@@ -431,6 +431,31 @@ def _compute_delay(
     return delay
 
 
+def _retry_delay(
+    error: BaseException,
+    attempt: int,
+    *,
+    base_delay: float,
+    max_delay: float,
+    jitter: bool,
+) -> float:
+    """Pick the backoff to wait before the next attempt.
+
+    Rate-limit errors use the dedicated LLM backoff (5s -> 120s). The generic
+    backoff (0.5s -> 8s by default) is short enough to keep a provider's
+    limiter saturated: the retries themselves consume the quota, so the limit
+    window never recovers and the work unit fails with the raw 429.
+    """
+    if is_retryable_rate_limit_error(error):
+        return rate_limit_retry_delay(attempt + 1)
+    return _compute_delay(
+        attempt,
+        base_delay=base_delay,
+        max_delay=max_delay,
+        jitter=jitter,
+    )
+
+
 def _retry_limit(
     error: Exception,
     *,
@@ -481,7 +506,8 @@ def retry_sync(
             if attempt >= retry_limit:
                 raise
 
-            delay = _compute_delay(
+            delay = _retry_delay(
+                e,
                 attempt,
                 base_delay=base_delay,
                 max_delay=max_delay,
@@ -529,7 +555,8 @@ async def retry_async(
             if attempt >= retry_limit:
                 raise
 
-            delay = _compute_delay(
+            delay = _retry_delay(
+                e,
                 attempt,
                 base_delay=base_delay,
                 max_delay=max_delay,
```

**File**: `tests/unit/test_model_retry.py` (modified, +75/-0)
```diff
@@ -229,6 +229,81 @@ async def _call():
     assert attempts["count"] == 1
 
 
+# --- rate-limit backoff ---
+
+
+def _rate_limit_error() -> RuntimeError:
+    return RuntimeError(
+        "Error code: 429 - {'error': {'code': '1302', 'message': 'Rate limit reached for requests'}}"
+    )
+
+
+def test_retry_sync_uses_rate_limit_backoff_for_rate_limit_errors(monkeypatch):
+    delays: list[float] = []
+    attempts: list[int] = []
+    monkeypatch.setattr(
+        "openviking.utils.model_retry.time.sleep", lambda delay: delays.append(delay)
+    )
+    monkeypatch.setattr(
+        "openviking.utils.model_retry.rate_limit_retry_delay",
+        lambda attempt: attempts.append(attempt) or float(attempt),
+    )
+    error = _rate_limit_error()
+
+    @model_error_boundary
+    def _call():
+        raise error
+
+    with pytest.raises(RuntimeError) as raised:
+        retry_sync(_call, max_retries=3)
+
+    assert raised.value is error
+    assert attempts == [1, 2, 3]
+    assert delays == [1.0, 2.0, 3.0]
+
+
+@pytest.mark.asyncio
+async def test_retry_async_uses_rate_limit_backoff_for_rate_limit_errors(monkeypatch):
+    delays: list[float] = []
+    attempts: list[int] = []
+
+    async def _sleep(delay):
+        delays.append(delay)
+
+    monkeypatch.setattr("openviking.utils.model_retry.asyncio.sleep", _sleep)
+    monkeypatch.setattr(
+        "openviking.utils.model_retry.rate_limit_retry_delay",
+        lambda attempt: attempts.append(attempt) or float(attempt),
+    )
+    error = _rate_limit_error()
+
+    @model_error_boundary
+    async def _call():
+        raise error
+
+    with pytest.raises(RuntimeError) as raised:
+        await retry_async(_call, max_retries=3)
+
+    assert raised.value is error
+    assert attempts == [1, 2, 3]
+    assert delays == [1.0, 2.0, 3.0]
+
+
+def test_retry_sync_keeps_generic_backoff_for_other_transient_errors(monkeypatch):
+    delays: list[float] = []
+    monkeypatch.setattr(
+        "openviking.utils.model_retry.time.sleep", lambda delay: delays.append(delay)
+    )
+
+    def _fail():
+        raise TimeoutError("timed out")
+
+    with pytest.raises(TimeoutError):
+        retry_sync(_fail, max_retries=3, base_delay=0.5, max_delay=8.0, jitter=False)
+
+    assert delays == [0.5, 1.0, 2.0]
+
+
 # --- quota_exceeded classification ---
 
 
```

#### Recent Merged Pull Requests:
- **PR #8585** (2026-11-27): feat(privacy): widen built-in detectors with Betterleaks rules and OpenViking keys (@t0saki)
- **PR #8582** (2026-11-27): feat(pgvector): select native or ByteDance enhanced search explicitly (@zhanglistar)
- **PR #8581** (2026-11-27): Revert "fix(ovpack): 修复向量备份校验与目录索引重建" (@qin-ctx)
- **PR #8579** (2026-11-27): feat(superagent): make the worker slot count configurable per instance and at runtime (@openviking-superagent)
- **PR #8575** (2026-11-27): Revert "fix(memory): narrow automatic output language detection to four languages" (@MaojiaSheng)
- **PR #8572** (2026-11-27): fix(storage): 停止预建 Agent 端点和支付目录 (@qin-ctx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
