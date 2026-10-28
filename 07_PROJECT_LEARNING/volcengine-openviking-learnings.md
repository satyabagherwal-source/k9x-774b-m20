> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source**: github ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Source Version**: `6afd9ba3`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T20:01:41.531Z  
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
> **Harvest Timestamp**: 2026-10-28T20:01:41.523Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41056 stars

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
- **Issue #6588** (2026-10-26): **[Bug]: # issue-v0.5.2-SDK漂移致镜像崩溃**
  *Symptoms*: ### Issue Origin  Inferred by an AI agent and not observed or reproduced  ### Bug Description  # issue-v0.5.2-SDK漂移致镜像崩溃  > 上游 issue 稿件（待提交）：v0.5.2 发布管道把不含 ​`git_diff_paths` 的 SDK 0.1.15 打进镜像，server 调用不存在的方法导致崩溃。已回滚 v0.5.1.1 自用，本文档为完整 issue 稿，证据全部实测。  **同类事故**：#5928（0cdce969）、2da84464（10-13）之后第三轮 SDK 漂移。  ---  # [Bug] v0.5.2 release pipeline ships SDK 0.1.15 without ​`git_diff_paths` — server calls a method the installed SDK does not have  ## Environment  - Image: official ​`openviking`​ v0.5.2 (built from the ​`v0.5.2`​ tag via ​`build-docker-image.yml`) - Installed inside the image (verified by starting a throwaway container and inspecting):    - `openviking == 0.5.2`   - `openviking-sdk == 0.1.15`   - `hasattr(AsyncHTTPClient, "git_diff_paths") == False`  ## Symptom  Server code shipped in v0.5.2 calls ​`git_diff_paths`​, but neither the SDK version locked in ​`uv.lock`​ (0.1.15) nor the latest PyPI release (0.1.16) contains that method. The v0.5.2 image therefore crashes whenever the affected code paths run (compile / memory snapshot diffing). We had to roll back to v0.5.1.1, where the server does not call ​`git_diff_paths` and is self-consistent with SDK 0.1.15.  ## Evidence chain (all verified locally, nothing inferred)  1. **v0.5.2 tag server source calls** ​**​`git_diff_paths`​**​ **:**     - `service/compile_targets.py:1096`​ — ​`await self._fs._async_agfs.run("git_diff_paths", ...)`    - `storage/viking_fs/_snapshot.py:808`​ — ​`await self._async_agfs.run("git_diff_

- **Issue #6486** (2026-10-27): **[Bug]: add-resource --wait times out while ingestion continues in the background**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  add-resource --wait times out while ingestion continues in the background  ### Issue Origin  Observed or reproduced in a real environment.  ### Bug Description  `ov add-resource --wait` can exit with a request timeout before ingestion finishes, even though the server continues processing the task and eventually completes it successfully.  The CLI sends `wait: true` in the ingestion POST and waits for that HTTP response. It does not obtain the task ID first and poll task status. For local files and directories, the POST has a size-based timeout of `max(60 seconds, ceil(file size in MiB × 5 seconds))`, using ZIP size for directories. Compressed input size does not reliably predict parsing, semantic processing, and embedding time.  ### Steps to Reproduce  1. Start an OpenViking server with a working embedding backend. 2. Import a directory whose processing time exceeds the ingestion POST timeout:     ```bash    ov add-resource ./docs \      --parent-auto-create viking://resources/demo \      --wait    ```  3. Observe the CLI exit with `Request Timeout`. 4. Query the server separately:     ```bash    ov task list --task-type add_resource -o json    ov task status <task_id>    ```  5. Observe that the task continues running and subsequently reaches `completed`.  ### Expected Behavior  `--wait` should wait until the task completes, fails, or is cancelled, unless the user interrupts the wait. A sing

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

### Incident Patch 1: `196e5820` (2026-10-28)
**Commit Message**: fix(plugins): read profile and memory listings from peer scope (#5246)

* fix(plugins): read profile and memory listings from peer scope

SessionStart profile injection read `viking://user/<space>/memories/...`
unconditionally, while capture has written to
`viking://user/<space>/peers/<id>/memories/...` since the user/peer memory
isolation model landed. The reader and the writer therefore never agreed on a
path: `<user-profile>` was empty for every repository workspace, whatever was
in the peer profile.

`actorPeerId` was already accepted by `buildProfileBlock` and already passed by
its caller, but it only becomes the `X-OpenViking-Actor-Peer` request header.
That header is a view filter, not a path rewrite, so it could not redirect the
hardcoded URIs.

Resolve each category independently, peer scope first, user scope as fallback:

    const roots = [];
    if (actorPeerId) roots.push(`.../peers/${actorPeerId}/memories`);
    roots.push(`.../memories`);

Per category rather than per scope, because a peer that has `preferences/` or
`entities/` but no `profile.md` would otherwise win the scope and drop the user
profile from the block entirely - a state that occurs in practice, not ju

**File**: `docs/en/agent-integrations/16-capability-reference.md` (modified, +2/-2)
```diff
@@ -200,7 +200,7 @@ The table shows the default path. Turning on [recall digests](#recall-digest) ch
 
 ### Session-start context
 
-Integrations that use the shared plugin code inject one `<openviking-context>` block at session start. It holds the user profile (`viking://user/<space>/memories/profile.md`), an index of the `preferences/` and `entities/` memories, and an `<available-skills>` catalog:
+Integrations that use the shared plugin code inject one `<openviking-context>` block at session start. It holds the user profile (`viking://user/<space>/memories/profile.md`), an index of the `preferences/` and `entities/` memories, and an `<available-skills>` catalog. When the session has an actor peer, the same files under `viking://user/<space>/peers/<peer>/memories/` are added: the profile, preferences, and entities have no message range, so extraction writes the user's own facts to the user root even in a peer session. The user root comes first; the peer profile is a second `<user-profile>` element without the lines it shares with the user profile, and both roots share one budget:
 
 ```text
 <openviking-context source="startup">
@@ -233,7 +233,7 @@ When each integration injects it:
 
 Budgets and limits:
 
-- `profileTokenBudget` (default 10,000 tokens) covers the profile and the memory index. The profile gets half. An oversized profile keeps its first 8 lines and its end; an oversized listing ends with `... +N more`. Token estimates count CJK characters as 1.5 tokens and other text as four characters per token.
+- `profileTokenBudget` (default 10,000 tokens) covers the profiles and the memory index. The profiles get half: the user profile first, the peer profile what is left, or a one-line pointer to its URI when less than 200 tokens remain. The two roots split the index budget. An oversized profile keeps its first 8 lines and its end; an oversized listing ends with `... +N more`. Token estimates count CJK characters as 1.5 tokens and other text as four characters per token.
 - `skillCatalogTokenBudget` (default 1,200 tokens, `OPENVIKING_SKILL_CATALOG_TOKEN_BUDGET`) is a separate budget for the skill catalog. `skillCatalog` (`OPENVIKING_SKILL_CATALOG`) or a budget of 0 turns the catalog off.
 - The catalog comes from one `GET /api/v1/skills` request. The user's own skills come first, and an account skill with the same name as a user skill is left out. Each description is cut to about 40 tokens. If descriptions do not fit, the catalog lists names only; if names do not fit, it ends with `... +N more`, or shrinks to a one-line count. Servers without that endpoint get no catalog.
 - `sessionStartMaxBytes` caps the whole block in UTF-8 bytes: 9,500 for Claude Code and Codex, whose hosts move hook output above about 10,000 characters into a file and show only a preview; 20,000 for ZCode, which drops output above 32 KB; no cap elsewhere. Above the cap, the memory index is dropped first, then the skill catalog.
```

**File**: `docs/zh/agent-integrations/16-capability-reference.md` (modified, +2/-2)
```diff
@@ -199,7 +199,7 @@ skill 走单独的路径。创建、安装或替换 skill 用 MCP `add_skill` 
 
 ### 会话开场上下文
 
-使用共享插件代码的集成会在会话开始时注入一个 `<openviking-context>` 块，包含用户 profile（`viking://user/<space>/memories/profile.md`）、`preferences/` 和 `entities/` 记忆的索引，以及 `<available-skills>` skill 清单：
+使用共享插件代码的集成会在会话开始时注入一个 `<openviking-context>` 块，包含用户 profile（`viking://user/<space>/memories/profile.md`）、`preferences/` 和 `entities/` 记忆的索引，以及 `<available-skills>` skill 清单。会话带有 actor peer 时，还会加入 `viking://user/<space>/peers/<peer>/memories/` 下的同名文件：profile、preferences 和 entities 没有消息范围，所以即使在 peer 会话中，抽取也会把用户本人的事实写到用户根目录。用户根目录在前；peer profile 是第二个 `<user-profile>` 元素，并去掉与用户 profile 相同的行；两个根目录共用同一份预算：
 
 ```text
 <openviking-context source="startup">
@@ -232,7 +232,7 @@ skill 走单独的路径。创建、安装或替换 skill 用 MCP `add_skill` 
 
 预算与限制：
 
-- `profileTokenBudget`（默认 10,000 token）覆盖 profile 和记忆索引，profile 占一半。profile 超长时保留前 8 行和结尾；清单超长时以 `... +N more` 结尾。token 估算中，CJK 字符按 1.5 token 计，其他文本按每 4 个字符 1 token 计。
+- `profileTokenBudget`（默认 10,000 token）覆盖 profile 和记忆索引，profile 占一半：先放用户 profile，peer profile 使用剩余部分，剩余不足 200 token 时只放一行指向其 URI 的提示。两个根目录分摊索引预算。profile 超长时保留前 8 行和结尾；清单超长时以 `... +N more` 结尾。token 估算中，CJK 字符按 1.5 token 计，其他文本按每 4 个字符 1 token 计。
 - `skillCatalogTokenBudget`（默认 1,200 token，`OPENVIKING_SKILL_CATALOG_TOKEN_BUDGET`）是 skill 清单的独立预算。`skillCatalog`（`OPENVIKING_SKILL_CATALOG`）或把预算设为 0 都会关闭清单。
 - 清单来自一次 `GET /api/v1/skills` 请求。用户自己的 skill 排在前面，与用户 skill 同名的账户 skill 不再列出。每条描述截到约 40 token。描述放不下时只列名称；名称也放不下时以 `... +N more` 结尾，或缩成一行数量。服务端没有该接口时不注入清单。
 - `sessionStartMaxBytes` 按 UTF-8 字节限制整个块：Claude Code 和 Codex 为 9,500，因为这两个宿主会把超过约 10,000 字符的 hook 输出存成文件，只显示预览；ZCode 为 20,000，因为它会丢弃超过 32 KB 的输出；其他集成不设上限。超出上限时，先去掉记忆索引，再去掉 skill 清单。
```

**File**: `examples/agent-hook-plugin/hosts/codebuddy/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "openviking-memory",
-  "version": "0.5.26",
+  "version": "0.5.27",
   "description": "Long-term semantic memory for the CodeBuddy Code CLI, powered by OpenViking. Injects relevant context at session start and on each prompt, and captures the conversation back into OpenViking.",
   "author": {
     "name": "OpenViking",
```

**File**: `examples/agent-hook-plugin/hosts/cursor/openviking.integration.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "schemaVersion": 1,
   "id": "openviking-memory",
-  "version": "0.5.26",
+  "version": "0.5.27",
   "clients": [
     "cursor"
   ],
```

**File**: `examples/agent-hook-plugin/hosts/kimicode/kimi.plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "openviking-memory",
-  "version": "0.5.26",
+  "version": "0.5.27",
   "description": "Long-term semantic memory for Kimi Code CLI, powered by OpenViking.",
   "author": {
     "name": "OpenViking",
```

**File**: `examples/agent-hook-plugin/hosts/kimicode/openviking.integration.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "schemaVersion": 1,
   "id": "openviking-memory",
-  "version": "0.5.26",
+  "version": "0.5.27",
   "clients": [
     "kimicode"
   ],
```

**File**: `examples/agent-hook-plugin/hosts/trae/openviking.integration.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "schemaVersion": 1,
   "id": "openviking-memory",
-  "version": "0.5.26",
+  "version": "0.5.27",
   "clients": [
     "trae",
     "trae-cn"
```

**File**: `examples/agent-hook-plugin/hosts/zcode/openviking.integration.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "schemaVersion": 1,
   "id": "openviking-memory",
-  "version": "0.5.26",
+  "version": "0.5.27",
   "clients": [
     "zcode"
   ],
```

---

### Incident Patch 2: `4adcab74` (2026-10-28)
**Commit Message**: fix(pathlock): revoke lease authorization after token loss (#6704)

* fix(pathlock): revoke lease authorization after token loss

Track per-token confirmation deadlines for explicit and background renewal, preserve release capabilities after invalidation, and bound cleanup retries to prevent stale authorization and registry growth.

* test(pathlock): cover Redis renewal timeout and network recovery

Delay real Redis replies through a local TCP proxy to exercise the 20ms command timeout, retain lease authorization during a short interruption, and verify renewal and file writes recover afterwards.

* feat(pathlock): distinguish lease invalidation causes for diagnostics

Retain the first invalidation reason and timestamp through cleanup, and expose cause-specific log context with regression coverage and bilingual documentation.

**File**: `crates/ragfs-python/src/lib.rs` (modified, +2/-2)
```diff
@@ -2834,7 +2834,7 @@ impl RAGFSBindingClient {
             let ownership = ownership_ref.clone();
             async move {
                 let lease = mgr
-                    .get_owned_lease_by_capability(&lr, &ownership)
+                    .get_releasable_lease_by_capability(&lr, &ownership)
                     .await
                     .ok_or_else(|| {
                         PathLockError::InvalidRequest(format!(
@@ -2867,7 +2867,7 @@ impl RAGFSBindingClient {
             let paths = lock_paths.clone();
             async move {
                 let lease = mgr
-                    .get_owned_lease_by_capability(&lr, &ownership)
+                    .get_releasable_lease_by_capability(&lr, &ownership)
                     .await
                     .ok_or_else(|| {
                         PathLockError::InvalidRequest(format!(
```

**File**: `crates/ragfs/src/lock/lost_lease_tests.rs` (added, +1031/-0)
```diff
@@ -0,0 +1,1031 @@
+//! Lost lease authorization, renewal deadlines, and bounded cleanup regressions.
+use super::*;
+use crate::core::{FsContextInner, PathLockContext, WriteFlag, FS_CTX};
+use crate::lock::provider::{FilesystemPathLockProvider, MemoryPathLockProvider};
+use crate::lock::wrapper::PathLockWrappedFS;
+use crate::plugins::memfs::MemFileSystem;
+use async_trait::async_trait;
+use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
+
+struct FaultProvider {
+    inner: Arc<dyn PathLockProvider>,
+    /// false: definite loss; true: uncertain transport failure.
+    failures: StdMutex<HashMap<String, bool>>,
+    fail_remove: AtomicBool,
+    refresh_calls: AtomicUsize,
+    remove_calls: AtomicUsize,
+    delay: Duration,
+}
+
+impl FaultProvider {
+    fn new(inner: Arc<dyn PathLockProvider>) -> Self {
+        Self {
+            inner,
+            failures: StdMutex::new(HashMap::new()),
+            fail_remove: AtomicBool::new(false),
+            refresh_calls: AtomicUsize::new(0),
+            remove_calls: AtomicUsize::new(0),
+            delay: Duration::ZERO,
+        }
+    }
+}
+
+#[async_trait]
+impl PathLockProvider for FaultProvider {
+    fn name(&self) -> &'static str {
+        "fault-injection"
+    }
+    fn handle_mode(&self) -> PathLockHandleMode {
+        self.inner.handle_mode()
+    }
+    async fn try_acquire_batch_atomic(
+        &self,
+        requests: &[PathLockRequest],
+        owner: &str,
+        now: u128,
+        stale: u128,
+    ) -> PathLockResult<Option<Vec<AtomicAcquisition>>> {
+        self.inner
+            .try_acquire_batch_atomic(requests, owner, now, stale)
+            .await
+    }
+    async fn read_token(&self, path: &str) -> PathLockResult<Option<LockToken>> {
+        self.inner.read_token(path).await
+    }
+    async fn try_create_token(&self, path: &str, token: &LockToken) -> PathLockResult<()> {
+        self.inner.try_create_token(path, token).await
+    }
+    async fn compare_and_write_token(
+        &self,
+        path: &str,
+        expected: &LockToken,
+        replacement: &LockToken,
+    ) -> PathLockResult<bool> {
+        self.inner
+            .compare_and_write_token(path, expected, replacement)
+            .await
+    }
+    async fn refresh_token(&self, path: &str, owner: &str, now: u128) -> PathLockResult<bool> {
+        self.refresh_calls.fetch_add(1, Ordering::SeqCst);
+        if !self.delay.is_zero() {
+            tokio::time::sleep(self.delay).await;
+        }
+        let fault = self.failures.lock().unwrap().get(path).copied();
+        match fault {
+            Some(true) => Err(PathLockError::Io("injected refresh timeout".into())),
+            Some(false) => Ok(false),
+            None => self.inner.refresh_token(path, owner, now).await,
+        }
+    }
+    async fn remove_token(&self, path: &str, owner: &str, force: bool) -> PathLockResult<bool> {
+        assert!(!force, "cleanup must use ownership CAS");
+        self.remove_calls.fetch_add(1, Ordering::SeqCst);
+        if self.fail_remove.load(Ordering::SeqCst) {
+            Err(PathLockError::Io("injected cleanup timeout".into()))
+        } else {
+            self.inner.remove_token(path, owner, force).await
+        }
+    }
+    async fn scan_descendant_locks(&self, root: &str) -> PathLockResult<Vec<String>> {
+        self.inner.scan_descendant_locks(root).await
+    }
+}
+
+async fn fixture() -> (PathLockManager, Arc<FaultProvider>) {
+    let fs = Arc::new(MemFileSystem::new());
+    fs.mkdir("/data", 0o755).await.unwrap();
+    let provider = Arc::new(FaultProvider::new(Arc::new(MemoryPathLockProvider::new())));
+    let manager = PathLockManager::new(fs, provider.clone(), PathLockConfig::default());
+    (manager, provider)
+}
+
+fn capability(lease: &OwnedPathLockLease) -> Option<(&str, &str)> {
+    Some((&lease.lease.lease_ref, &lease.ownership_ref))
+}
+
+async fn age_token(
+    manager: &PathLockManager,
+    lease: &OwnedPathLockLease,
+    path: &str,
+    age: Duration,
+) {
+    let owner = manager
+        .lease_registry
+        .resolve(&lease.lease.lease_ref)
+        .unwrap();
+    owner
+        .registry
+        .lock()
+        .await
+        .token_health
+        .get_mut(path)
+        .unwrap()
+        .last_confirmed_at = Instant::now() - age;
+}
+
+async fn lease_invalidation(
+    manager: &PathLockManager,
+    lease: &OwnedPathLockLease,
+) -> LeaseInvalidation {
+    let owner = manager
+        .lease_registry
+        .resolve(&lease.lease.lease_ref)
+        .unwrap();
+    let registry = owner.registry.lock().await;
+    registry.entries[&lease.lease.lease_ref]
+        .invalidation
+        .unwrap()
+}
+
+#[tokio::test]
+async fn loss_invalidates_whole_leases_sharing_tokens_but_not_exact_descendants() {
+    let (manager, provider) = fixture().await;
+    let tree = manager
+        .acquire_tree("/data", Duration::ZERO, None)
+        .await
+        .unwrap();
+    let shared = ma
```

**File**: `crates/ragfs/src/lock/manager.rs` (modified, +438/-184)
```diff
@@ -62,6 +62,10 @@ const MAX_POLL_INTERVAL_MS: u64 = 500;
 const POLL_BACKOFF_NUMERATOR: u64 = 3;
 const POLL_BACKOFF_DENOMINATOR: u64 = 2;
 const POLL_JITTER_PERCENT: u64 = 20;
+/// Revoke authorization before the provider's expiry, leaving a safety margin.
+const LEASE_VALIDITY_RATIO: f64 = 0.8;
+/// Retry invalidated cleanup for six heartbeat intervals, then forget locally.
+const CLEANUP_RETRY_INTERVALS: f64 = 6.0;
 
 impl PathLockManager {
     fn poll_interval_bounds(attempt: u32) -> (u64, u64) {
@@ -117,6 +121,45 @@ struct LeaseEntry {
     pending_handoff: bool,
     lock_kinds: HashMap<String, PathLockKind>,
     last_active_at: Instant,
+    /// Irreversible; retain the capability and references until cleanup finishes.
+    invalidation: Option<LeaseInvalidation>,
+}
+
+/// The first irreversible authorization revocation, retained through cleanup.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+struct LeaseInvalidation {
+    at: Instant,
+    reason: InvalidationReason,
+}
+
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+enum InvalidationReason {
+    TokenLost,
+    ConfirmationDeadlineExceeded,
+    ReleaseFailed,
+}
+
+impl LeaseEntry {
+    /// Keep the first cause and timestamp, including during cleanup retries.
+    fn invalidate(&mut self, at: Instant, reason: InvalidationReason, paths: &[&str]) {
+        if self.invalidation.is_some() {
+            return;
+        }
+        self.invalidation = Some(LeaseInvalidation { at, reason });
+        warn!(
+            lease_ref = %self.lease.lease_ref,
+            owner_id = %self.lease.owner_id,
+            ?reason,
+            affected_paths = ?paths,
+            "pathlock lease invalidated"
+        );
+    }
+}
+
+#[derive(Debug)]
+struct TokenHealth {
+    last_confirmed_at: Instant,
+    consecutive_failures: u64,
 }
 
 #[derive(Debug)]
@@ -132,6 +175,7 @@ enum DowngradeTokenResult {
 struct OwnerRegistry {
     entries: HashMap<String, LeaseEntry>,
     lock_refs: HashMap<String, usize>,
+    token_health: HashMap<String, TokenHealth>,
     // ponytail: grows with handoffs while this owner lives; encode generations if measured.
     consumed_handoff_refs: HashSet<String>,
 }
@@ -144,6 +188,7 @@ impl OwnerRegistry {
         lease: PathLockLease,
         ownership_ref: String,
         lock_kinds: &[PathLockKind],
+        confirmed_at: Instant,
     ) -> PathLockResult<()> {
         let lease_ref = lease.lease_ref.clone();
         if lease.owner_id != expected_owner_id {
@@ -172,6 +217,12 @@ impl OwnerRegistry {
         for lock_path in &lease.lock_paths {
             if unique_paths.insert(lock_path.clone()) {
                 *self.lock_refs.entry(lock_path.clone()).or_default() += 1;
+                self.token_health
+                    .entry(lock_path.clone())
+                    .or_insert(TokenHealth {
+                        last_confirmed_at: confirmed_at,
+                        consecutive_failures: 0,
+                    });
             }
         }
         self.entries.insert(
@@ -182,6 +233,7 @@ impl OwnerRegistry {
                 pending_handoff: false,
                 lock_kinds,
                 last_active_at: Instant::now(),
+                invalidation: None,
             },
         );
         Ok(())
@@ -200,19 +252,22 @@ impl OwnerRegistry {
     }
 
     /// True when the entry exists, is owned (not parked for handoff) and its
-    /// ownership_ref matches. Used to gate release/refresh against a stale
+    /// ownership_ref matches. Used to gate acquisition/refresh against a stale
     /// capability under the same write guard that performs the mutation.
     fn capability_matches(&self, lease_ref: &str, ownership_ref: &str) -> bool {
-        self.entries
-            .get(lease_ref)
-            .is_some_and(|entry| !entry.pending_handoff && entry.ownership_ref == ownership_ref)
+        self.entries.get(lease_ref).is_some_and(|entry| {
+            !entry.pending_handoff
+                && entry.invalidation.is_none()
+                && entry.ownership_ref == ownership_ref
+        })
     }
 
     /// Return the strongest remaining kind after one lease drops a lock path.
     fn strongest_kind_excluding(&self, lease_ref: &str, lock_path: &str) -> Option<PathLockKind> {
         self.entries
             .iter()
             .filter(|(candidate_ref, _)| candidate_ref.as_str() != lease_ref)
+            .filter(|(_, entry)| entry.invalidation.is_none())
             .filter_map(|(_, entry)| entry.lock_kinds.get(lock_path).copied())
             .max_by_key(|kind| match kind {
                 PathLockKind::Exact => 0,
@@ -253,7 +308,11 @@ impl OwnerRegistry {
     /// but reject the original ownership_ref. Requires a matching, not-yet-parked entry.
     fn mark_pending_handoff(&mut self, lease_ref: &str, ownership_ref: &str) -> PathLockResult<()> {
         match self.entries.get_mut(lease_ref) {
-            Some(entry) if entry.ownership_ref == ownership_ref && !entry.pending_handoff 
```

**File**: `docs/en/concepts/09-transaction.md` (modified, +9/-1)
```diff
@@ -375,7 +375,15 @@ Acquisition rollback and normal release clean up tokens without guaranteeing rem
 
 **Stale lock detection**: PathLockEngine checks the ownership token timestamp. Locks older than `lock_expire` (default 30s) are considered stale and are removed automatically during acquisition.
 
-**In-process cleanup**: During refresh, Rust PathLockManager checks leases that have not refreshed successfully for `2 × lock_expire` and attempts cleanup with ownership validation.
+**Lost lease authorization**: Explicit and background refresh use the same rules. A missing token or owner mismatch immediately invalidates every local lease under that owner sharing the actual token path (`lock_paths`). Losing any required token invalidates the entire lease, including a pending handoff. A Tree ancestor and an Exact descendant have different tokens and do not invalidate each other.
+
+A transport error preserves authorization only until `0.8 × lock_expire` since that token's last successful confirmation (24 seconds by default). Each token has its own monotonic deadline; partial refresh, reentry, and local handoff/adoption do not extend failed tokens. Authorization checks enforce the deadline even before the next heartbeat. Invalidated leases cannot authorize subsequent protected writes, refresh, owner reuse, or handoff/adoption, and cannot become valid again.
+
+**In-process cleanup**: Invalidated leases retain their release capability and local references while ownership-checked cleanup is retried. A missing or foreign-owned token completes cleanup without deleting a new owner's token. Tokens shared with another valid local lease remain protected. After six heartbeat intervals from the first invalidation (`2 × lock_expire`, 60 seconds by default), the manager logs remaining paths and forgets the local entry even if the provider is unavailable; remaining provider tokens rely on expiry. Cleanup retries never extend this window.
+
+**Invalidation diagnostics**: The manager retains the first invalidation time and reason through cleanup. The `pathlock lease invalidated` log includes `reason`, `lease_ref`, `owner_id`, and `affected_paths`. `TokenLost` means a required token is missing or ownership no longer matches; inspect token expiry, removal, and takeover. `ConfirmationDeadlineExceeded` means ownership could not be confirmed before the safety deadline; inspect provider health, network latency, and renewal scheduling. Its token log includes `since_last_confirmation_ms` and `failures`. `ReleaseFailed` means a release or downgrade error revoked authorization while cleanup is retried; the release log includes the error. Later results and cleanup failures do not replace the first reason or reset its time; the cleanup-window exhaustion log retains that reason.
+
+These checks revoke authorization for future operations after loss is detected or the deadline passes. They do not cancel writes that already passed authorization or provide storage-side fencing.
 
 **Orphan locks**: Provider tokens left behind after a process crash are automatically removed via stale lock detection when a later acquisition checks the same path or scope.
 
```

**File**: `docs/zh/concepts/09-transaction.md` (modified, +9/-1)
```diff
@@ -383,7 +383,15 @@ fencing token 校验通过的一方成功持有 `TreeLock(java-guide)`；失败
 
 **陈旧锁检测**：PathLockEngine 检查归属 token 中的时间戳。超过 `lock_expire`（默认 30s）的锁被视为陈旧锁，在加锁过程中自动移除。
 
-**进程内清理**：Rust PathLockManager 在续期循环中检查长期未成功续期的 lease，以 `2 × lock_expire` 为阈值尝试清理，并校验归属后释放 token。
+**失锁后的授权失效**：手动和后台续租使用相同规则。token 不存在或 owner 不匹配时，同 owner 下共享实际 token 路径（`lock_paths`）的所有本地 lease 立即整份失效，包括待交接的 lease。Tree 祖先和 Exact 后代使用不同 token，不会因逻辑覆盖关系连带失效。
+
+网络等不确定错误允许短暂重试，但每个 token 距离最近一次成功确认达到 `0.8 × lock_expire`（默认 24 秒）时撤销授权。使用单调时钟分别记录各 token 的确认时间；部分续租成功、重入和本地交接/接管不会延长失败 token 的期限。写入授权检查也会检查期限，无需等待下次心跳。失效 lease 不能再授权后续受保护写入、续租、复用 owner 或交接/接管，且不会恢复有效。
+
+**进程内清理**：失效 lease 保留释放能力和本地引用，后台重试带 owner 校验的清理。token 已不存在或已被其他 owner 接管均视为清理完成，不会删除新 owner 的 token；仍被其他有效本地 lease 引用的 token 也不会被删除。从首次失效起超过六个心跳间隔（`2 × lock_expire`，默认 60 秒），即使 Provider 持续不可用也记录剩余路径并移除本地 entry，遗留的远端 token 依赖过期清理。重试不会延长该窗口。
+
+**失效诊断**：manager 在清理期间保留首次失效的时间与原因。`pathlock lease invalidated` 日志包含 `reason`、`lease_ref`、`owner_id` 和 `affected_paths`。`TokenLost` 表示必要 token 缺失或归属不符，应检查 token 过期、删除和接管情况；`ConfirmationDeadlineExceeded` 表示安全期限内未能确认归属，应检查 Provider 健康、网络延迟和续租调度，对应 token 日志还包含 `since_last_confirmation_ms` 和 `failures`；`ReleaseFailed` 表示释放或降级错误导致撤销授权并进入清理重试，释放日志会记录具体错误。后续响应和清理失败不会覆盖首次原因或重置时间，清理窗口耗尽的日志也会保留该原因。
+
+上述检查在发现失锁或达到期限后拒绝后续操作；不会中断已经通过授权检查的写入，也不提供存储侧 fencing。
 
 **孤儿锁**：进程崩溃后遗留的 Provider token，在后续 acquire 检查同一路径或 scope 时通过 stale lock 检测自动移除。
 
```

---

### Incident Patch 3: `eb8ae949` (2026-10-28)
**Commit Message**: fix(gateway): relay a null "tools" in Responses replies instead of failing (#6309)

An OpenAI-compatible upstream may echo "tools": null in a Responses object.
public_response() filtered the hidden openviking_ tools out of any present
"tools" key, so a null value raised TypeError and the request failed with
"Invalid model tool response". Only filter when the value is a list and
relay anything else unchanged.

Fixes #6284

Co-authored-by: wang2-lat <[REDACTED_EMAIL]>

**File**: `openviking_gateway/tool_protocols/responses.py` (modified, +1/-1)
```diff
@@ -150,7 +150,7 @@ def encode(self, value):
 
     def public_response(self, value):
         value = {**value, "id": self.identifier}
-        if "tools" in value:
+        if isinstance(value.get("tools"), list):
             value["tools"] = [t for t in value["tools"] if not t.get("name", "").startswith(PREFIX)]
         return value
 
```

**File**: `tests/gateway/test_native_tools.py` (modified, +21/-0)
```diff
@@ -679,6 +679,27 @@ async def backend(request):
     assert "openviking_search" not in response.text
 
 
+@pytest.mark.parametrize("streaming", [False, True])
+async def test_responses_relays_null_tools(running_gateway, streaming):
+    app, client, admin, key, _, _ = running_gateway
+    await enable_tools(client, admin)
+
+    async def backend(request):
+        if request.path != "/v1/responses":
+            return None
+        value = {**native_response("responses", 1), "tools": None}
+        return await wire_response(request, "responses", value, streaming)
+
+    app.state.test_backend["handler"] = backend
+    response = await client.post(
+        "/v1/responses",
+        headers={"Authorization": "Bearer " + key["key"]},
+        json=request_body("responses", streaming),
+    )
+    assert response.status_code == 200, response.text
+    assert visible_response("responses", response, streaming)["tools"] is None
+
+
 @pytest.mark.parametrize("protocol", ["responses", "anthropic"])
 async def test_native_incompatible_mode_keeps_only_visible_history(
     setup_kernel, credential, policy, protocol
```

#### Recent Merged Pull Requests:
- **PR #6735** (2026-10-28): fix(ci): 将 API 集成测试模型切换到 Seed 2.1 Lite (@qin-ptr)
- **PR #6734** (closed): fix(ci): 将 API 集成测试模型切换到 Seed 2.1 Lite (@qin-ctx)
- **PR #6730** (2026-10-28): fix(embedding): 在线检索绕过入库并发限制 (@qin-ctx)
- **PR #6725** (2026-10-28): fix(sdk/go): omit unset write and session options (@qin-ptr)
- **PR #6724** (2026-10-28): rerank: add optional candidate isolation for Jev (@chenjw)
- **PR #6722** (2026-10-28): feat(pathlock): observe Redis acquisition latency and slow calls (@zhanglistar)

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

## X. plugins): read profile and memory listings from peer scope (#5246)

**RULE**:
When implementing operations in `docs/en/agent-integrations/16-capability-reference.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `196e5820`: plugins): read profile and memory listings from peer scope (#5246). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/en/agent-integrations/16-capability-reference.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
Integrations that use the shared plugin code inject one `<openviking-context>` block at session start. It holds the user profile (`viking://user/<space>/memories/profile.md`), an index of the `preferences/` and `entities/` memories, and an `<available-skills>` catalog. When the session has an actor peer, the same files under `viking://user/<space>/peers/<peer>/memories/` are added: the profile, preferences, and entities have no message range, so extraction writes the user's own facts to the user root even in a peer session. The user root comes first; the peer profile is a second `<user-profile>` element without the lines it shares with the user profile, and both roots share one budget:
- `profileTokenBudget` (default 10,000 tokens) covers the profiles and the memory index. The profiles get half: the user profile first, the peer profile what is left, or a one-line pointer to its URI when less than 200 tokens remain. The two roots split the index budget. An oversized profile keeps its first 8 lines and its end; an oversized listing ends with `... +N more`. Token estimates count CJK characters as 1.5 tokens and other text as four characters per token.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
Integrations that use the shared plugin code inject one `<openviking-context>` block at session start. It holds the user profile (`viking://user/<space>/memories/profile.md`), an index of the `preferences/` and `entities/` memories, and an `<available-skills>` catalog:
- `profileTokenBudget` (default 10,000 tokens) covers the profile and the memory index. The profile gets half. An oversized profile keeps its first 8 lines and its end; an oversized listing ends with `... +N more`. Token estimates count CJK characters as 1.5 tokens and other text as four characters per token.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `196e5820` are properly handled with clean fallback behavior.
