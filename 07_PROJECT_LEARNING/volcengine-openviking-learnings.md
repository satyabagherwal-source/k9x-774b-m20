> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source**: github ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Source Version**: `54d4c0fa`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T17:23:43.353Z  
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
> **Harvest Timestamp**: 2026-10-27T17:23:43.191Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 40959 stars

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

### Incident Patch 1: `5c066d97` (2026-10-26)
**Commit Message**: fix(storage): 修复递归删除导致 PathLock 提前失效 (#6631)

* fix(storage): 修复递归删除导致 PathLock 提前失效

将目录锁迁移到父目录 sidecar，并兼容旧锁与 handoff；删除获锁后重新确认目标状态，避免并发请求沿用过期判断。

* test(storage): 补充 PathLock 路径关系矩阵

使用共享文件系统上的独立 Manager 验证祖先、后代与兄弟路径的冲突和非冲突语义，防止 sidecar 迁移引入锁范围回归。

* fix(storage): 收敛 PathLock sidecar 迁移协议

拆分 Tree 路径解析并修正根路径寻址，撤回无关的 Snapshot 行为变化，同时明确新旧锁协议的切换约束，降低迁移影响范围。

---------

Co-authored-by: zhanghe.1216 <@bytedance.com>

**File**: `crates/ragfs/src/lock/manager.rs` (modified, +272/-84)
```diff
@@ -1049,15 +1049,13 @@ impl PathLockManager {
                         });
                     }
                     PathLockKind::Tree => {
-                        let lock_path = self.resolver.resolve_tree_lock_path(&request.path).await?;
+                        let resolved = self.resolver.resolve_tree_paths(&request.path).await?;
                         self.check_ancestor_tree_locks(&request.path, owner_id)
                             .await?;
-                        let exact_candidates = self
-                            .resolver
-                            .resolve_exact_conflict_paths(&request.path)
+                        self.check_lock_paths(&resolved.conflict_paths, owner_id)
                             .await?;
-                        self.check_lock_paths(&exact_candidates, owner_id).await?;
                         self.check_descendant_locks(&request.path, owner_id).await?;
+                        let lock_path = resolved.acquire_lock_path;
                         self.ensure_lock_dir(&lock_path).await.map_err(|error| {
                             PathLockError::Io(format!("failed to create lock dir: {error}"))
                         })?;
@@ -1099,11 +1097,11 @@ impl PathLockManager {
                     PathLockKind::Tree => {
                         self.check_ancestor_tree_locks(&request.path, owner_id)
                             .await?;
-                        let exact_candidates = self
+                        let tree_candidates = self
                             .resolver
-                            .resolve_exact_conflict_paths(&request.path)
+                            .resolve_tree_conflict_paths(&request.path)
                             .await?;
-                        self.check_lock_paths(&exact_candidates, owner_id).await?;
+                        self.check_lock_paths(&tree_candidates, owner_id).await?;
                         self.check_descendant_locks(&request.path, owner_id).await?;
                     }
                 }
@@ -1252,37 +1250,25 @@ impl PathLockManager {
 
     /// Check ancestor directories for tree locks that would conflict.
     async fn check_ancestor_tree_locks(&self, path: &str, owner_id: &str) -> PathLockResult<()> {
-        let mut current = path.to_string();
         let now_ns = Self::now_ns();
 
-        loop {
-            let parent = match current.rsplit_once('/') {
-                Some((p, _)) if !p.is_empty() => p.to_string(),
-                Some(_) if current != "/" => "/".to_string(),
-                _ => break,
-            };
-
-            let ancestor_lock = if parent == "/" {
-                format!("/{}", PATH_LOCK_FILE)
-            } else {
-                format!("{}/{}", parent, PATH_LOCK_FILE)
-            };
-            if let Some(token) = self.provider.read_token(&ancestor_lock).await? {
-                // Only Tree locks propagate to descendants; an Exact lock on
-                // /a must not block /a/b.
-                if token.lock_type == PathLockKind::Tree
-                    && token.owner_id != owner_id
-                    && !self.is_stale(&token, now_ns)
-                {
-                    return Err(PathLockError::Conflict {
-                        lock_path: ancestor_lock,
-                        owner: token.owner_id,
-                        kind: token.lock_type,
-                    });
+        for parent in LockPathResolver::ancestor_paths(path) {
+            for ancestor_lock in self.resolver.resolve_tree_conflict_paths(&parent).await? {
+                if let Some(token) = self.provider.read_token(&ancestor_lock).await? {
+                    // Only Tree locks propagate to descendants; an Exact lock on
+                    // /a must not block /a/b.
+                    if token.lock_type == PathLockKind::Tree
+                        && token.owner_id != owner_id
+                        && !self.is_stale(&token, now_ns)
+                    {
+                        return Err(PathLockError::Conflict {
+                            lock_path: ancestor_lock,
+                            owner: token.owner_id,
+                            kind: token.lock_type,
+                        });
+                    }
                 }
             }
-
-            current = parent;
         }
         Ok(())
     }
@@ -1851,17 +1837,23 @@ impl PathLockManager {
                 }
                 PathLockHandleMode::LockPath if legacy_handoff => {
                     let file_name = lp.rsplit('/').next().unwrap_or("");
-                    if lp == &format!("/{}", PATH_LOCK_FILE)
+                    if !(lp == &format!("/{}", PATH_LOCK_FILE)
                         || lp.ends_with(&format!("/{}", PATH_LOCK_FILE))
+                        || file_name.starts_with(EXACT_LOCK_FILE_PREFIX))
                     {
-                        PathLockKind::Tree
-                    } else if file_name.starts_with(EXACT_LOCK_FILE_PREFIX) {
-                     
```

**File**: `crates/ragfs/src/lock/resolver.rs` (modified, +109/-40)
```diff
@@ -18,9 +18,18 @@ pub(crate) struct ResolvedExactPaths {
     pub conflict_paths: Vec<String>,
 }
 
+/// Tree-lock paths resolved for new writes plus legacy reads.
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub(crate) struct ResolvedTreePaths {
+    /// Lock path used for the actual tree token creation.
+    pub acquire_lock_path: String,
+    /// Paths that may contain a tree token for the same logical path.
+    pub conflict_paths: Vec<String>,
+}
+
 /// Computes lock-file paths for exact and tree locks.
 pub struct LockPathResolver {
-    /// Filesystem used for `stat` calls to determine is_dir.
+    /// Filesystem retained for lock-directory creation and compatibility checks.
     pub(crate) fs: Arc<dyn FileSystem>,
 }
 
@@ -32,17 +41,13 @@ impl LockPathResolver {
 
     /// Compute exact lock paths for `path`.
     ///
-    /// - Existing directory → `{path}/.path.ovlock`
-    /// - File or non-existent path → `{parent}/.exact.ovlock.<safe_name>.<sha1-prefix>`
+    /// All paths use a parent sidecar so deleting a directory cannot delete its own token.
     pub async fn resolve_exact_lock_paths(&self, path: &str) -> PathLockResult<Vec<String>> {
         Ok(vec![self.resolve_exact_lock_path(path).await?])
     }
 
     /// Compute every lock-file path that can represent an exact lock for conflict checks.
-    pub async fn resolve_exact_conflict_paths(
-        &self,
-        path: &str,
-    ) -> PathLockResult<Vec<String>> {
+    pub async fn resolve_exact_conflict_paths(&self, path: &str) -> PathLockResult<Vec<String>> {
         Ok(self.resolve_exact_paths(path).await?.conflict_paths)
     }
 
@@ -51,37 +56,54 @@ impl LockPathResolver {
         Ok(self.resolve_exact_paths(path).await?.acquire_lock_path)
     }
 
-    /// Resolve the exact acquire path and its conservative conflict set using one `stat`.
-    pub(crate) async fn resolve_exact_paths(&self, path: &str) -> PathLockResult<ResolvedExactPaths> {
-        let stat_result = self.fs.stat(path).await;
-        let acquire_lock_path = match stat_result {
-            Ok(info) if info.is_dir => path_lock_path(path),
-            _ => prefixed_exact_lock_path(path),
-        };
-        let conflict_paths = if acquire_lock_path == path_lock_path(path) {
-            vec![acquire_lock_path.clone(), prefixed_exact_lock_path(path)]
-        } else {
-            vec![acquire_lock_path.clone(), path_lock_path(path)]
-        };
+    /// Resolve the sidecar acquire path and include the legacy in-directory token for conflicts.
+    pub(crate) async fn resolve_exact_paths(
+        &self,
+        path: &str,
+    ) -> PathLockResult<ResolvedExactPaths> {
+        let acquire_lock_path = prefixed_exact_lock_path(path);
+        let conflict_paths = vec![acquire_lock_path.clone(), path_lock_path(path)];
         Ok(ResolvedExactPaths {
             acquire_lock_path,
             conflict_paths,
         })
     }
 
-    /// Compute the tree lock path for `path`.
-    ///
-    /// - Regular directory or missing path → `{path}/.path.ovlock`
-    /// - Existing file path → parent directory sidecar
+    /// Compute every lock-file path that can represent a tree lock.
+    pub async fn resolve_tree_conflict_paths(&self, path: &str) -> PathLockResult<Vec<String>> {
+        Ok(self.resolve_tree_paths(path).await?.conflict_paths)
+    }
+
+    /// Compute the primary lock-file path used when acquiring one tree lock.
     pub async fn resolve_tree_lock_path(&self, path: &str) -> PathLockResult<String> {
-        let stat_result = self.fs.stat(path).await;
-        match stat_result {
-            Ok(info) if !info.is_dir => {
-                // Existing file: use parent sidecar to avoid `{file}/.path.ovlock`.
-                Ok(prefixed_exact_lock_path(path))
-            }
-            _ => Ok(path_lock_path(path)),
+        Ok(self.resolve_tree_paths(path).await?.acquire_lock_path)
+    }
+
+    /// Resolve the shared sidecar acquire path and include the legacy tree token for reads.
+    pub(crate) async fn resolve_tree_paths(&self, path: &str) -> PathLockResult<ResolvedTreePaths> {
+        let acquire_lock_path = prefixed_exact_lock_path(path);
+        let conflict_paths = vec![acquire_lock_path.clone(), path_lock_path(path)];
+        Ok(ResolvedTreePaths {
+            acquire_lock_path,
+            conflict_paths,
+        })
+    }
+
+    /// Return every ancestor path from nearest parent to root.
+    pub(crate) fn ancestor_paths(path: &str) -> Vec<String> {
+        let mut current = path.to_string();
+        let mut ancestors = Vec::new();
+
+        loop {
+            let parent = match current.rsplit_once('/') {
+                Some((p, _)) if !p.is_empty() => p.to_string(),
+                Some(_) if current != "/" => "/".to_string(),
+                _ => break,
+            };
+            ancestors.push(parent.clone());
+            current = parent;
         }
+        ancestors
     }
 }
 
@@ -93,13 +115,17 @@ fn path_lock_path(path: &
```

**File**: `docs/en/concepts/09-transaction.md` (modified, +23/-12)
```diff
@@ -242,17 +242,17 @@ Locks coordinate participating operations. The low-level `PathLockWrappedFS` use
 
 ### Filesystem Provider Lock Protocol
 
-The caller chooses the lock type; the resolver chooses the token location from the target's state:
+The caller chooses the lock type. The filesystem provider uses a parent sidecar for every target:
 
 | Target state | Exact token | Tree token |
 | --- | --- | --- |
 | Existing file `/docs/a` | `/docs/.exact.ovlock.a.<hash>`, containing E | Same sidecar, containing T |
-| Existing directory `/docs/a` | `/docs/a/.path.ovlock`, containing E | Same file inside the directory, containing T |
-| Missing `/docs/a` | Parent sidecar, containing E | Create the target directory, then write `.path.ovlock` inside it, containing T |
+| Existing directory `/docs/a` | `/docs/.exact.ovlock.a.<hash>`, containing E | Same sidecar, containing T |
+| Missing `/docs/a` | `/docs/.exact.ovlock.a.<hash>`, containing E | Same sidecar, containing T |
 
-A sidecar sits beside its target but represents only that target, not its parent directory. `<hash>` is a SHA-1 prefix of the full backend path, not the business file's contents.
+A sidecar sits beside its target but represents only that target, not its parent directory. Recursively deleting the target does not delete the token in its parent, so mutual exclusion remains active until the lease is formally released. `<hash>` is a SHA-1 prefix of the full backend path, not the business file's contents.
 
-`.exact.ovlock.*` can contain a Tree token, and `.path.ovlock` can contain an Exact token. Filenames are part of the storage protocol, but do not alone identify the logical lock type. Token contents are:
+`.exact.ovlock.*` stores E or T according to the logical lock type. For compatibility with tokens left by older versions, conflict checks still read `.path.ovlock` inside the target, but new locks are no longer written there. Filenames are part of the storage protocol, but do not alone identify the logical lock type. Token contents are:
 
 ```text
 {owner_id}:{time_ns}:{lock_type}
@@ -262,6 +262,17 @@ A sidecar sits beside its target but represents only that target, not its parent
 
 A lease records logical scope in `covered_paths` separately from token locations in `lock_paths`. An owned lease controls refresh, release, and handoff. A borrowed lease proves coverage by an existing lock without permission to release the outer lock.
 
+#### Protocol Migration and Deployment
+
+The new version reads both the new sidecar and the legacy `.path.ovlock`, but writes new tokens only to the sidecar. Existing leases are not migrated in place: refresh, release, and handoff continue to use the legacy `lock_paths` recorded by the lease until those tokens are released or expire.
+
+Old versions do not inspect new ancestor sidecars, so filesystem-provider instances of different protocol versions must not process writes against the same backend concurrently. The current version requires a coordinated cutover:
+
+1. Stop new writes, wait for active leases and pending handoffs to drain, then stop every old instance.
+2. Start all new instances, confirm legacy tokens were released or can be reclaimed by expiry, then resume writes.
+
+A zero-downtime rolling deployment requires two independently deployable protocol stages: first deploy a compatibility version that reads both formats but still writes legacy tokens; after every instance is upgraded, switch all instances to reading both formats and writing only new sidecars. There must be no interval where an old instance can encounter a new sidecar.
+
 ### Cache Provider Lock Protocol
 
 The cache provider stores the same token format in Redis HASH fields. It uses
@@ -321,8 +332,8 @@ loop until timeout (poll interval: 200ms):
        - Missing target directory? -> treat as no descendant locks
        - Stale lock? -> remove and retry
        - Active lock? -> wait
-    4. Ensure the resolved token parent exists; this creates a missing target as a directory
-    5. Write the TREE (T) token (sidecar for an existing file, internal .path.ovlock otherwise)
+    4. Ensure the resolved sidecar parent exists; do not create the missing target itself
+    5. Write the TREE (T) token to the parent sidecar
     6. TOCTOU double-check: re-scan descendants and ancestors
        - Conflict found: compare (timestamp, handle_id)
        - Later one (larger timestamp/handle_id) backs off (removes own lock) to prevent livelock
@@ -335,17 +346,17 @@ Timeout (default 0 = no-wait) raises LockAcquisitionError
 
 ### Missing Directory Creation
 
-The lock system may create directories so it can place lock files, but it checks
-for conflicts first:
+The lock system may create a missing parent chain so it can place a sidecar,
+but it does not create the locked target itself. It checks for conflicts first:
 
 ```
-1. Ancestor TreeLock / same-path lock / descendant lock conflict -> do not create the directory
-2. No current conflict -> create
```

**File**: `docs/zh/concepts/09-transaction.md` (modified, +22/-12)
```diff
@@ -239,17 +239,17 @@ Exact 和 Tree 表达操作范围，文件、目录或缺失路径表达目标
 
 ### Filesystem Provider 锁协议
 
-锁类型由调用者选择，Resolver 根据目标状态决定 token 位置：
+锁类型由调用者选择。Filesystem Provider 对所有目标统一使用父目录 sidecar：
 
 | 目标状态 | Exact token | Tree token |
 | --- | --- | --- |
 | 现存文件 `/docs/a` | `/docs/.exact.ovlock.a.<hash>`，内容为 E | 同一 sidecar，内容为 T |
-| 现存目录 `/docs/a` | `/docs/a/.path.ovlock`，内容为 E | 同一目录内文件，内容为 T |
-| 缺失路径 `/docs/a` | 父目录 sidecar，内容为 E | 创建目标目录后写内部 `.path.ovlock`，内容为 T |
+| 现存目录 `/docs/a` | `/docs/.exact.ovlock.a.<hash>`，内容为 E | 同一 sidecar，内容为 T |
+| 缺失路径 `/docs/a` | `/docs/.exact.ovlock.a.<hash>`，内容为 E | 同一 sidecar，内容为 T |
 
-sidecar 位于目标旁边，但只代表该目标，不会锁住整个父目录。`<hash>` 来自完整后端路径的 SHA-1 前缀，与业务文件内容无关。
+sidecar 位于目标旁边，但只代表该目标，不会锁住整个父目录。递归删除目标时不会删除位于父目录中的 token，因此锁的互斥保护会持续到 lease 正式释放。`<hash>` 来自完整后端路径的 SHA-1 前缀，与业务文件内容无关。
 
-`.exact.ovlock.*` 可以存 Tree token，`.path.ovlock` 也可以存 Exact token。文件名是存储协议的一部分，不能单凭名字判断逻辑锁类型。token 内容为：
+`.exact.ovlock.*` 根据实际锁类型存储 E 或 T。为兼容升级前遗留 token，冲突检测仍读取目标内部的 `.path.ovlock`，但新锁不再写入该位置。文件名是存储协议的一部分，不能单凭名字判断逻辑锁类型。token 内容为：
 
 ```text
 {owner_id}:{time_ns}:{lock_type}
@@ -259,6 +259,17 @@ sidecar 位于目标旁边，但只代表该目标，不会锁住整个父目录
 
 lease 将逻辑范围 `covered_paths` 与 token 位置 `lock_paths` 分开记录。Owned lease 控制续期、释放和交接；Borrowed lease 仅提供已有锁的覆盖证明，不能释放外层锁。
 
+#### 协议迁移与发布
+
+新版本对新 sidecar 和旧 `.path.ovlock` 执行双读，但只向新 sidecar 写入 token。升级前已存在的 lease 不做原地迁移：续期、释放和交接继续使用 lease 中记录的旧 `lock_paths`，直到旧 token 正常释放或过期。
+
+旧版本不会检查祖先路径的新 sidecar，因此 Filesystem Provider 不能让新旧版本在同一后端上同时处理写请求。当前版本采用协调切换：
+
+1. 停止新的写请求，等待活跃 lease 和待交接任务排空，然后停止所有旧实例。
+2. 全量启动新版本实例，确认旧 token 已释放或可按过期规则回收，再恢复写流量。
+
+如果部署必须保持零停机滚动升级，需要拆成两个可独立发布的协议阶段：先发布“新旧双读、仍写旧 token”的兼容版本；全部实例升级后，再统一切换为“新旧双读、只写新 sidecar”。两个阶段之间不得存在旧实例读取新 sidecar 的窗口。
+
 ### Cache Provider 锁协议
 
 Cache Provider 将相同 token 格式存入 Redis HASH field，并通过 Lua
@@ -318,8 +329,8 @@ HASH。跨 scope batch 会被拒绝。
        - 目标目录不存在？ -> 视为无后代锁
        - 陈旧锁？ -> 移除后重试
        - 活跃锁？ -> 等待
-    4. 确保 Resolver 选定的 token 父目录存在；缺失目标会因此被创建成目录
-    5. 写入 TREE (T) token（现存文件用 sidecar，其余用内部 .path.ovlock）
+    4. 确保 Resolver 选定的 sidecar 父目录存在；不会创建缺失目标本身
+    5. 在父目录 sidecar 写入 TREE (T) token
     6. TOCTOU 双重检查：重新扫描后代目录和祖先目录
        - 发现冲突：比较 (timestamp, handle_id)
        - 后到者（更大的 timestamp/handle_id）主动让步（删除自己的锁），防止活锁
@@ -332,11 +343,11 @@ HASH。跨 scope batch 会被拒绝。
 
 ### 缺失目录创建规则
 
-锁系统允许为了放置锁文件而创建目录，但创建前必须先检查冲突：
+锁系统允许为了放置 sidecar 而创建缺失的父目录链，但不会创建被锁目标本身。创建前必须先检查冲突：
 
 ```
 1. 发现祖先 TreeLock / 同路径锁 / 后代锁冲突 -> 不创建目录，直接失败或等待
-2. 当前无冲突 -> 可以创建目录并写锁
+2. 当前无冲突 -> 可以创建 sidecar 的父目录并写锁
 3. 写锁后再次检查时发现新冲突 -> 删除自己的锁并失败或重试
 4. 第 3 步不会回滚刚创建的空目录
 ```
@@ -353,10 +364,9 @@ HASH。跨 scope batch 会被拒绝。
 ```
 
 如果两个请求同时创建 `java-guide`，两边都可能先看到“当前无冲突”，但最终只有
-fencing token 校验通过的一方成功持有 `TreeLock(java-guide)`；失败方会删除自己的锁，
-已创建出来的空目录可以保留。
+fencing token 校验通过的一方成功持有 `TreeLock(java-guide)`；失败方会删除自己的锁。
 
-获取失败的回滚和正常释放只清理 token，不保证删除为存放 token 创建的目录。Exact sidecar 也可能创建缺失的父目录链。Snapshot 对缺失目标采用单独的策略，见 [快照的范围与并发](../guides/15-snapshot.md#提交范围与并发)。
+获取失败的回滚和正常释放只清理 token，不保证删除为存放 sidecar 创建的父目录链。Snapshot 对缺失目标采用单独的策略，见 [快照的范围与并发](../guides/15-snapshot.md#提交范围与并发)。
 
 ### 锁过期清理
 
```

**File**: `openviking/storage/viking_fs/_ops.py` (modified, +24/-10)
```diff
@@ -268,6 +268,18 @@ async def _estimate_deleted_count(target_path: str, real_ctx: RequestContext) ->
                 logger.warning(f"[VikingFS] Failed to count nodes before delete: {e}")
                 return 0
 
+        async def _finish_missing_delete() -> Dict[str, Any]:
+            """Clean orphan index records for an idempotent delete."""
+            if no_vector:
+                return {"estimated_deleted_count": 0}
+            uris_to_delete = await self._collect_uris(path, recursive, ctx=ctx)
+            uris_to_delete.append(target_uri)
+            real_ctx = self._ctx_or_default(ctx)
+            estimated_count = await _estimate_deleted_count(path, real_ctx)
+            await self._delete_from_vector_store(uris_to_delete, ctx=ctx)
+            logger.info(f"[VikingFS] rm target not found, cleaned orphan index: {uri}")
+            return {"estimated_deleted_count": estimated_count}
+
         # Check existence and determine lock strategy
         try:
             stat = await self._async_agfs.stat(path)
@@ -280,16 +292,7 @@ async def _estimate_deleted_count(target_path: str, real_ctx: RequestContext) ->
                 raise
             if recursive:
                 await self._ensure_access(target_uri, ctx, action=AclAction.MANAGE)
-            if no_vector:
-                return {"estimated_deleted_count": 0}
-            # Path does not exist: clean up any orphan index records and return
-            uris_to_delete = await self._collect_uris(path, recursive, ctx=ctx)
-            uris_to_delete.append(target_uri)
-            real_ctx = self._ctx_or_default(ctx)
-            estimated_count = await _estimate_deleted_count(path, real_ctx)
-            await self._delete_from_vector_store(uris_to_delete, ctx=ctx)
-            logger.info(f"[VikingFS] rm target not found, cleaned orphan index: {uri}")
-            return {"estimated_deleted_count": estimated_count}
+            return await _finish_missing_delete()
 
         if is_dir:
             await self._ensure_access(target_uri, ctx, action=AclAction.MANAGE)
@@ -315,6 +318,17 @@ async def _estimate_deleted_count(target_path: str, real_ctx: RequestContext) ->
                 raise ResourceBusyError(f"Resource is being processed: {uri}", uri=uri)
 
         try:
+            if lease_ref is None and lease is not None:
+                try:
+                    await self._async_agfs.stat(path)
+                except Exception as exc:
+                    if is_not_found_error(exc):
+                        return await _finish_missing_delete()
+                    mapped = map_exception(exc, resource=uri)
+                    if mapped is not None:
+                        raise mapped from exc
+                    raise
+
             check_descendant_acl = (
                 is_dir
                 and (not no_vector or is_acl_uri(target_uri))
```

**File**: `tests/storage/test_session_delete_storage.py` (modified, +14/-0)
```diff
@@ -139,6 +139,20 @@ async def test_session_rm_releases_its_tree_lease_when_backend_delete_fails(stor
     assert storage.agfs.rm.await_args.kwargs["fs_ctx"]["lease_ref"] == "delete-lease"
 
 
+async def test_session_rm_rechecks_existence_after_waiting_for_tree_lock(storage):
+    storage.agfs.stat.side_effect = [
+        {"isDir": True},
+        FileNotFoundError(SESSION_PATH),
+    ]
+
+    result = await storage.fs.rm(SESSION_URI, recursive=True, ctx=storage.ctx, no_vector=True)
+
+    assert result == {"estimated_deleted_count": 0}
+    storage.agfs.pathlock_acquire_tree.assert_awaited_once_with(SESSION_PATH)
+    storage.agfs.rm.assert_not_awaited()
+    storage.agfs.pathlock_release.assert_awaited_once_with(storage.lease)
+
+
 async def test_session_rm_reuses_outer_lease_without_releasing_it(storage):
     outer_lease = {"lease_ref": "outer-lease"}
 
```

---

### Incident Patch 2: `54d4c0fa` (2026-10-27)
**Commit Message**: fix(pathlock): prevent path aliases from bypassing locks (#6687)

Share logical path validation across acquisition, lease coverage, Redis, and SQLite, and reject ambiguous Lua batch paths before mutation.

**File**: `crates/ragfs/src/lock/cache_provder.rs` (modified, +204/-3)
```diff
@@ -12,6 +12,7 @@ use crate::cache_runtime::{
 };
 
 use super::codec::LockTokenCodec;
+use super::path::validate_normalized_logical_path;
 use super::provider::{
     AcquisitionChange, AtomicAcquisition, AtomicAcquisitionResult, PathLockHandleMode,
     PathLockProvider,
@@ -79,6 +80,21 @@ local function decode_token(raw)
     end
     return { owner = token_owner, time_ns = time_ns, kind = kind }
 end
+local function is_normalized_path(path)
+    if not path or string.sub(path, 1, 1) ~= "/"
+        or (path ~= "/" and string.sub(path, -1) == "/")
+        or string.find(path, "//", 1, true)
+        or string.find(path, string.char(0), 1, true) then
+        return false
+    end
+    for part in string.gmatch(path, "[^/]+") do
+        if part == "." or part == ".." then
+            return false
+        end
+    end
+    return true
+end
+
 local function ancestors(path)
     local result = {}
     if path == "/" then
@@ -127,9 +143,7 @@ local includes_tree = false
 for index = 5, #ARGV, 2 do
     local path = ARGV[index]
     local kind = ARGV[index + 1]
-    if not path or string.sub(path, 1, 1) ~= "/"
-        or (path ~= "/" and string.sub(path, -1) == "/")
-        or (kind ~= "E" and kind ~= "T") then
+    if not is_normalized_path(path) or (kind ~= "E" and kind ~= "T") then
         return { "invalid_request", "invalid path or lock kind" }
     end
     table.insert(requests, { path = path, kind = kind })
@@ -535,6 +549,7 @@ impl RedisPathLockProvider {
 
     /// Return the Redis HASH key responsible for one logical path.
     fn tokens_key_for_path(&self, path: &str) -> PathLockResult<String> {
+        validate_normalized_logical_path(path)?;
         let suffix = if path == "/" || path == "/local" {
             "global".to_string()
         } else {
@@ -1188,6 +1203,7 @@ mod tests {
     use crate::cache_runtime::{
         CacheRuntime, RedisProviderConfig, ScriptDefinition, ScriptRequest, ScriptValue,
     };
+    use crate::core::FileSystem;
     use crate::plugins::memfs::MemFileSystem;
 
     use super::super::manager::{PathLockConfig, PathLockManager};
@@ -1532,6 +1548,191 @@ return redis.call("HGET", KEYS[1], ARGV[2])
         runtime.close().await.unwrap();
     }
 
+    /// Real filesystem aliases must not bypass another manager's Redis Exact lock.
+    #[tokio::test]
+    async fn redis_path_aliases_cannot_write_a_locked_file() {
+        let Some((runtime, provider)) = test_provider("path-alias-write").await else {
+            return;
+        };
+        let dir = tempfile::TempDir::new().unwrap();
+        let fs = Arc::new(
+            crate::plugins::localfs::LocalFileSystem::new(dir.path().to_str().unwrap()).unwrap(),
+        );
+        let path = "/local/account-a/file";
+        std::fs::create_dir_all(dir.path().join("local/account-a")).unwrap();
+        fs.write(path, b"original", 0, crate::core::WriteFlag::Create)
+            .await
+            .unwrap();
+        let second_provider =
+            RedisPathLockProvider::new(runtime.clone(), &provider.service_name, 1.0).unwrap();
+        let config = PathLockConfig {
+            lock_expire_secs: 1.0,
+            ..PathLockConfig::default()
+        };
+        let first = PathLockManager::new(fs.clone(), Arc::new(provider), config.clone());
+        let second = Arc::new(PathLockManager::new(
+            fs.clone(),
+            Arc::new(second_provider),
+            config,
+        ));
+        let wrapped = crate::lock::PathLockWrappedFS::new(second, fs.clone());
+        let lease = first
+            .acquire_exact(path, Duration::ZERO, None)
+            .await
+            .unwrap();
+
+        assert!(matches!(
+            wrapped
+                .write(path, b"modified", 0, crate::core::WriteFlag::Truncate)
+                .await,
+            Err(crate::core::Error::PathLock(PathLockError::Timeout { .. }))
+        ));
+        for alias in [
+            "/local/account-a/./file",
+            "/local/account-a//file",
+            "/local/./account-a/file",
+        ] {
+            assert_eq!(fs.read(alias, 0, 100).await.unwrap(), b"original");
+            assert!(
+                wrapped
+                    .write(alias, b"modified", 0, crate::core::WriteFlag::Truncate)
+                    .await
+                    .is_err(),
+                "write through alias {alias} bypassed the lock"
+            );
+            assert_eq!(fs.read(path, 0, 100).await.unwrap(), b"original");
+        }
+        first.release(&lease).await.unwrap();
+        wrapped
+            .write(path, b"modified", 0, crate::core::WriteFlag::Truncate)
+            .await
+            .unwrap();
+        assert_eq!(fs.read(path, 0, 100).await.unwrap(), b"modified");
+        runtime.close().await.unwrap();
+    }
+
+    /// Lua validates the entire batch before writing any target or cleaning stale tokens.
+    #[tokio::test]
+    async fn redis_lua_rejects_path_aliases_before_mutation() {
+        let Some(
```

**File**: `crates/ragfs/src/lock/manager.rs` (modified, +20/-20)
```diff
@@ -17,6 +17,7 @@ use crate::core::internal_names::{EXACT_LOCK_FILE_PREFIX, PATH_LOCK_FILE};
 use crate::core::{FileSystem, FsContextView};
 
 use super::metrics::LockMetrics;
+use super::path::normalize_logical_path;
 use super::provider::{AcquisitionChange, AtomicAcquisition, PathLockHandleMode, PathLockProvider};
 use super::resolver::{LockPathResolver, ResolvedExactPaths};
 use super::types::{
@@ -669,10 +670,10 @@ impl PathLockManager {
     }
 
     /// Normalize, deduplicate, and sort requests with Tree taking precedence over Exact.
-    fn normalize_requests(requests: &[PathLockRequest]) -> Vec<PathLockRequest> {
+    fn normalize_requests(requests: &[PathLockRequest]) -> PathLockResult<Vec<PathLockRequest>> {
         let mut by_path: HashMap<String, PathLockKind> = HashMap::new();
         for request in requests {
-            let path = Self::normalize_path(&request.path);
+            let path = normalize_logical_path(&request.path)?.to_string();
             by_path
                 .entry(path)
                 .and_modify(|kind| {
@@ -693,17 +694,7 @@ impl PathLockManager {
                 .cmp(&b.path.len())
                 .then_with(|| a.path.cmp(&b.path))
         });
-        normalized
-    }
-
-    /// Normalize one logical path using the existing PathLock trailing-slash rule.
-    fn normalize_path(path: &str) -> String {
-        let trimmed = path.trim_end_matches('/');
-        if trimmed.is_empty() {
-            "/".to_string()
-        } else {
-            trimmed.to_string()
-        }
+        Ok(normalized)
     }
 
     /// Return the configured lock expiry in nanoseconds.
@@ -851,7 +842,7 @@ impl PathLockManager {
                 "lock request batch must not be empty".to_string(),
             ));
         }
-        let sorted = Self::normalize_requests(requests);
+        let sorted = Self::normalize_requests(requests)?;
 
         let owner = self.resolve_owner_state(owner_capability)?;
         let owner_id = owner.owner_id.clone();
@@ -1751,6 +1742,9 @@ impl PathLockManager {
                 "handoff owner_id and lock_paths must not be empty".to_string(),
             ));
         }
+        for request in &handoff.covered_paths {
+            normalize_logical_path(&request.path)?;
+        }
 
         // Local fast path: a handoff carrying lease_ref MUST be adopted from this
         // process's registry — it is never legacy. Adopt in-place (migrate to a fresh
@@ -1834,8 +1828,8 @@ impl PathLockManager {
             let expected_kind = match handle_mode {
                 PathLockHandleMode::LogicalPath => {
                     let request = &handoff.covered_paths[index];
-                    let expected_path = Self::normalize_path(&request.path);
-                    if lp != &expected_path {
+                    let expected_path = normalize_logical_path(&request.path)?;
+                    if lp != expected_path {
                         return Err(PathLockError::InvalidRequest(format!(
                             "handoff coverage '{}' does not match logical lock path '{lp}'",
                             request.path
@@ -1976,11 +1970,11 @@ impl PathLockManager {
     /// Check if a path is locked (for observability).
     pub async fn is_locked(&self, path: &str, ignore_stale: bool) -> PathLockResult<bool> {
         let now_ns = Self::now_ns();
-        let normalized_path = Self::normalize_path(path);
+        let normalized_path = normalize_logical_path(path)?;
         if let Some(locked) = self
             .provider
             .is_path_locked_atomic(
-                &normalized_path,
+                normalized_path,
                 now_ns,
                 now_ns.saturating_sub(self.lock_expire_ns()),
                 ignore_stale,
@@ -1993,7 +1987,7 @@ impl PathLockManager {
         // Check the current sidecar and the legacy in-directory token.
         let exact_paths = self
             .resolver
-            .resolve_exact_conflict_paths(&normalized_path)
+            .resolve_exact_conflict_paths(normalized_path)
             .await?;
         for lp in &exact_paths {
             if let Ok(Some(token)) = self.provider.read_token(lp).await {
@@ -2004,7 +1998,7 @@ impl PathLockManager {
         }
 
         // Check ancestor tree locks.
-        for parent in LockPathResolver::ancestor_paths(&normalized_path) {
+        for parent in LockPathResolver::ancestor_paths(normalized_path) {
             for ancestor_lock in self.resolver.resolve_tree_conflict_paths(&parent).await? {
                 if let Ok(Some(token)) = self.provider.read_token(&ancestor_lock).await {
                     // Only Tree locks propagate to descendants.
@@ -2081,6 +2075,9 @@ impl PathLockManager {
         lease_ref: &str,
         requests: &[PathLockRequest],
     ) -> PathLockResult<()> {
+        for request in requests {
+            normalize_logical_path(&request.path)?;
+        }
         let owner = self.lease_registry.resolve(lease_ref).ok_o
```

**File**: `crates/ragfs/src/lock/mod.rs` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ pub mod codec;
 mod cache_provder;
 pub mod manager;
 pub mod metrics;
+mod path;
 pub mod provider;
 pub mod resolver;
 pub mod sqlite_provider;
```

**File**: `crates/ragfs/src/lock/path.rs` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+//! Shared lexical path rules for lock identity and lease coverage.
+
+use super::types::{PathLockError, PathLockResult};
+
+/// Validate a logical path and preserve compatibility with a single trailing slash.
+///
+/// Reject aliases instead of rewriting them: the filesystem still receives the
+/// original path, and resolving `..` could change the operation's scope.
+pub(super) fn normalize_logical_path(path: &str) -> PathLockResult<&str> {
+    if !path.starts_with('/')
+        || path.contains("//")
+        || path.contains('\0')
+        || path.split('/').any(|part| matches!(part, "." | ".."))
+    {
+        return Err(PathLockError::InvalidRequest(format!(
+            "PathLock requires an absolute logical path without repeated '/', \
+             '.' or '..' components, or NUL: {path:?}"
+        )));
+    }
+    Ok(if path == "/" {
+        path
+    } else {
+        path.strip_suffix('/').unwrap_or(path)
+    })
+}
+
+/// Provider token paths must already be normalized by the Manager.
+pub(super) fn validate_normalized_logical_path(path: &str) -> PathLockResult<()> {
+    if normalize_logical_path(path)? != path {
+        return Err(PathLockError::InvalidRequest(format!(
+            "PathLock requires a normalized absolute logical path: {path:?}"
+        )));
+    }
+    Ok(())
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::core::{FileSystem, FsContextInner, PathLockContext, FS_CTX};
+    use crate::lock::types::PathLockKind;
+    use crate::lock::{MemoryPathLockProvider, PathLockConfig, PathLockManager, PathLockRequest};
+    use crate::plugins::memfs::MemFileSystem;
+    use std::sync::Arc;
+    use std::time::Duration;
+
+    #[test]
+    fn logical_paths_reject_aliases_and_preserve_valid_names() {
+        for path in [
+            "", "relative", "//", "/a//b", "/a//", "/a/./b", "/./a", "/a/../b", "/a/.", "/a/..",
+            "/a\0b",
+        ] {
+            assert!(normalize_logical_path(path).is_err(), "{path:?}");
+            assert!(validate_normalized_logical_path(path).is_err(), "{path:?}");
+        }
+        for path in [
+            "/",
+            "/a",
+            "/a/.hidden",
+            "/a/file..txt",
+            "/中文/文件",
+            "/a/file name",
+        ] {
+            assert_eq!(normalize_logical_path(path).unwrap(), path);
+            validate_normalized_logical_path(path).unwrap();
+        }
+        assert_eq!(normalize_logical_path("/a/").unwrap(), "/a");
+        assert!(validate_normalized_logical_path("/a/").is_err());
+    }
+
+    /// Invalid aliases cannot acquire locks, query locks, or borrow Tree coverage.
+    #[tokio::test]
+    async fn path_aliases_are_rejected_before_acquisition_and_coverage() {
+        let fs = Arc::new(MemFileSystem::new());
+        fs.mkdir("/data", 0o755).await.unwrap();
+        let mgr = PathLockManager::new(
+            fs.clone(),
+            Arc::new(MemoryPathLockProvider::new()),
+            PathLockConfig::default(),
+        );
+        let tree = mgr
+            .acquire_tree("/data", Duration::ZERO, None)
+            .await
+            .unwrap();
+        let context = Arc::new(FsContextInner::with_pathlock(
+            "account",
+            PathLockContext {
+                lease_ref: Some(tree.lease.lease_ref.clone()),
+                disable_auto_pathlock: false,
+            },
+        ));
+        for path in [
+            "",
+            "relative",
+            "//",
+            "/data//file",
+            "/data/./file",
+            "/data/../other/file",
+            "/data/file//",
+            "/data/file\0",
+        ] {
+            let request = PathLockRequest {
+                path: path.to_string(),
+                kind: PathLockKind::Exact,
+            };
+            for kind in [PathLockKind::Exact, PathLockKind::Tree] {
+                assert!(
+                    matches!(
+                        mgr.acquire_batch(
+                            &[
+                                PathLockRequest {
+                                    path: "/unrelated/file".into(),
+                                    kind: PathLockKind::Exact
+                                },
+                                PathLockRequest {
+                                    path: path.into(),
+                                    kind
+                                },
+                            ],
+                            Duration::ZERO,
+                            None
+                        )
+                        .await,
+                        Err(PathLockError::InvalidRequest(_))
+                    ),
+                    "Manager accepted {path:?}"
+                );
+            }
+            assert!(
+                matches!(
+                    mgr.is_locked(path, true).await,
+                    Err(PathLockError::InvalidRequest(_))
+                ),
+                "is_locked accepted {path:?}"
+           
```

**File**: `crates/ragfs/src/lock/sqlite_provider.rs` (modified, +1/-14)
```diff
@@ -7,6 +7,7 @@ use std::time::Duration;
 use async_trait::async_trait;
 use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
 
+use super::path::validate_normalized_logical_path as validate_path;
 use super::provider::{
     AcquisitionChange, AtomicAcquisition, AtomicAcquisitionResult, PathLockHandleMode,
     PathLockProvider,
@@ -50,20 +51,6 @@ fn timestamp(time_ns: u128) -> String {
     format!("{time_ns:039}")
 }
 
-fn validate_path(path: &str) -> PathLockResult<()> {
-    if !path.starts_with('/')
-        || (path != "/" && path.ends_with('/'))
-        || path.contains("//")
-        || path.contains('\0')
-        || path.split('/').any(|part| matches!(part, "." | ".."))
-    {
-        return Err(PathLockError::InvalidRequest(format!(
-            "SQLite PathLock requires a normalized absolute logical path: {path}"
-        )));
-    }
-    Ok(())
-}
-
 fn validate_owner(owner: &str) -> PathLockResult<()> {
     if owner.is_empty() || owner.contains(':') {
         return Err(PathLockError::InvalidRequest(
```

**File**: `crates/ragfs/src/lock/types.rs` (modified, +12/-16)
```diff
@@ -2,6 +2,8 @@
 
 use serde::{Deserialize, Serialize};
 
+use super::path::normalize_logical_path;
+
 /// Lock kind: exact (single path) or tree (path + descendants).
 #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
 pub enum PathLockKind {
@@ -106,31 +108,25 @@ impl PathLockLease {
 
 /// Return true when a held request covers another requested operation.
 fn request_is_covered_by(held: &PathLockRequest, request: &PathLockRequest) -> bool {
+    let (Ok(held_path), Ok(request_path)) = (
+        normalize_logical_path(&held.path),
+        normalize_logical_path(&request.path),
+    ) else {
+        return false;
+    };
     match (held.kind, request.kind) {
-        (PathLockKind::Exact, PathLockKind::Exact) => normalize_path(&held.path) == normalize_path(&request.path),
-        (PathLockKind::Tree, _) => path_is_self_or_descendant(&request.path, &held.path),
+        (PathLockKind::Exact, PathLockKind::Exact) => held_path == request_path,
+        (PathLockKind::Tree, _) => path_is_self_or_descendant(request_path, held_path),
         (PathLockKind::Exact, PathLockKind::Tree) => false,
     }
 }
 
-/// Normalize a path for simple lock coverage checks.
-fn normalize_path(path: &str) -> String {
-    let trimmed = path.trim_end_matches('/');
-    if trimmed.is_empty() {
-        "/".to_string()
-    } else {
-        trimmed.to_string()
-    }
-}
-
-/// Return true when `path` is equal to or under `ancestor`.
+/// Return true when a normalized `path` is equal to or under `ancestor`.
 fn path_is_self_or_descendant(path: &str, ancestor: &str) -> bool {
-    let path = normalize_path(path);
-    let ancestor = normalize_path(ancestor);
     path == ancestor
         || ancestor == "/"
         || path
-            .strip_prefix(&ancestor)
+            .strip_prefix(ancestor)
             .is_some_and(|suffix| suffix.starts_with('/'))
 }
 
```

**File**: `docs/en/concepts/09-transaction.md` (modified, +8/-0)
```diff
@@ -224,6 +224,14 @@ The lock mechanism uses two lock types to handle different conflict patterns:
 
 Exact and Tree describe an operation's scope; file, directory, and missing describe the target's current state. These are independent. Locks protect path names, including names that do not currently exist.
 
+Lock paths must be absolute. The Manager rejects empty or relative paths, repeated
+`/`, `.` or `..` components, and NUL with `InvalidRequest` before acquiring locks
+or checking lease coverage. A single trailing `/` is stripped, except at `/`.
+Redis and SQLite token operations require this normalized form; Redis Lua batch
+acquisition also validates every request before mutating tokens. Use
+`/local/account-a/file`, rather than aliases such as `/local/account-a/./file`
+or `/local/account-a//file`.
+
 The following conflicts apply to different owners within the same provider scope:
 
 | Held lock | New request | Conflict |
```

**File**: `docs/zh/concepts/09-transaction.md` (modified, +7/-0)
```diff
@@ -221,6 +221,13 @@ async with LockContext(lock_manager, [src], lock_mode="mv", mv_dst_path=dst):
 
 Exact 和 Tree 表达操作范围，文件、目录或缺失路径表达目标的当前状态，两者独立。锁保护路径名字，目标不存在也可以申请锁。
 
+锁路径必须是绝对路径。Manager 在获取锁或检查租约覆盖范围前，对空路径、
+相对路径、重复 `/`、`.` 或 `..` 路径段及 NUL 返回 `InvalidRequest`。
+非根路径末尾的单个 `/` 会被移除。Redis 和 SQLite 的 token 操作要求路径
+已完成这一规范化；Redis Lua 批量获取也会在修改 token 前校验全部请求。
+应使用 `/local/account-a/file`，避免 `/local/account-a/./file`、
+`/local/account-a//file` 等别名。
+
 以下冲突关系限定为不同 owner、同一 Provider scope 内的请求：
 
 | 已持有 | 新请求 | 冲突 |
```

---

### Incident Patch 3: `f3d408a4` (2026-10-27)
**Commit Message**: fix(pathlock): reject Redis Tree locks spanning scopes (#6685)

* fix(pathlock): reject Redis Tree locks spanning scopes

Prevent global Tree locks from reporting success without excluding account and system descendants; validate acquisition and token upgrades and document supported roots.

* fix format

**File**: `crates/ragfs/src/lock/cache_provder.rs` (modified, +205/-6)
```diff
@@ -1,4 +1,5 @@
-//! Redis-backed PathLock storage.
+//! Redis-backed PathLock storage. Tree locks must fit within one account or
+//! system scope; global roots cannot atomically cover the separate scope HASHes.
 
 use std::collections::BTreeMap;
 use std::sync::Arc;
@@ -12,7 +13,8 @@ use crate::cache_runtime::{
 
 use super::codec::LockTokenCodec;
 use super::provider::{
-    AcquisitionChange, AtomicAcquisition, AtomicAcquisitionResult, PathLockHandleMode, PathLockProvider,
+    AcquisitionChange, AtomicAcquisition, AtomicAcquisitionResult, PathLockHandleMode,
+    PathLockProvider,
 };
 use super::types::{LockToken, PathLockError, PathLockKind, PathLockRequest, PathLockResult};
 
@@ -556,6 +558,17 @@ impl RedisPathLockProvider {
         ))
     }
 
+    /// Reject Tree roots whose descendants span multiple Redis HASHes.
+    fn validate_lock_scope(path: &str, kind: PathLockKind) -> PathLockResult<()> {
+        if kind == PathLockKind::Tree && (path == "/" || path == "/local") {
+            return Err(PathLockError::InvalidRequest(format!(
+                "cache PathLock Tree lock at '{path}' spans multiple scopes; \
+                 use '/local/<account>' or '/local/_system' as the Tree root"
+            )));
+        }
+        Ok(())
+    }
+
     /// Return the shared Redis HASH key for one same-scope path batch.
     fn tokens_key_for_batch<'a>(
         &self,
@@ -809,6 +822,9 @@ impl PathLockProvider for RedisPathLockProvider {
                 "lock request batch must not be empty".to_string(),
             ));
         }
+        for request in requests {
+            Self::validate_lock_scope(&request.path, request.kind)?;
+        }
         let key =
             self.tokens_key_for_batch(requests.iter().map(|request| request.path.as_str()))?;
         let mut args = vec![
@@ -958,6 +974,7 @@ impl PathLockProvider for RedisPathLockProvider {
 
     /// Atomically create one token when the path is absent.
     async fn try_create_token(&self, lock_path: &str, token: &LockToken) -> PathLockResult<()> {
+        Self::validate_lock_scope(lock_path, token.lock_type)?;
         let key = self.tokens_key_for_path(lock_path)?;
         let values = self
             .execute_array(
@@ -995,6 +1012,7 @@ impl PathLockProvider for RedisPathLockProvider {
         expected: &LockToken,
         replacement: &LockToken,
     ) -> PathLockResult<bool> {
+        Self::validate_lock_scope(lock_path, replacement.lock_type)?;
         let key = self.tokens_key_for_path(lock_path)?;
         self.execute_integer(
             COMPARE_WRITE_ID,
@@ -1514,6 +1532,185 @@ return redis.call("HGET", KEYS[1], ARGV[2])
         runtime.close().await.unwrap();
     }
 
+    /// Reject global Tree requests before accessing Redis, including token upgrades.
+    #[tokio::test]
+    async fn provider_rejects_cross_scope_tree_before_redis_access() {
+        let mock = crate::cache_runtime::MemoryMockProvider::new()
+            .with_script_handler(|_| panic!("invalid Tree request must not access Redis"));
+        let runtime = CacheRuntime::memory_with_provider(Arc::new(mock));
+        let provider = RedisPathLockProvider::new(runtime.clone(), "global-tree", 1.0).unwrap();
+        for root in ["/", "/local"] {
+            let exact = token("owner-a", 100, PathLockKind::Exact);
+            let tree = token("owner-a", 200, PathLockKind::Tree);
+            for requests in [
+                vec![request(root, PathLockKind::Tree)],
+                vec![
+                    request(root, PathLockKind::Exact),
+                    request(root, PathLockKind::Tree),
+                ],
+            ] {
+                assert!(matches!(
+                    provider
+                        .try_acquire_batch_atomic(&requests, "owner-a", 200, 100)
+                        .await,
+                    Err(PathLockError::InvalidRequest(message))
+                        if message.contains("Tree") && message.contains("scope")
+                ));
+            }
+            assert!(matches!(
+                provider.try_create_token(root, &tree).await,
+                Err(PathLockError::InvalidRequest(_))
+            ));
+            assert!(matches!(
+                provider.compare_and_write_token(root, &exact, &tree).await,
+                Err(PathLockError::InvalidRequest(_))
+            ));
+        }
+        runtime.close().await.unwrap();
+    }
+
+    /// Neither acquisition order can publish a Tree token spanning Redis scope HASHes.
+    #[tokio::test]
+    async fn provider_rejects_cross_scope_tree_in_both_acquisition_orders() {
+        let Some((runtime, provider)) = test_provider("global-tree-orders").await else {
+            return;
+        };
+        for root in ["/", "/local"] {
+            for scope in ["/local/account-a", "/local/_system"] {
+                let child = format!("{scope}/file");
+                for kind in [PathLockKind::Exact, PathLockKind::Tree] {
+                    f
```

**File**: `docs/en/concepts/09-transaction.md` (modified, +5/-2)
```diff
@@ -293,8 +293,11 @@ HASH keys are isolated by path scope:
 
 All keys use `{service_name}` as the Redis Cluster hash tag. Exact acquisition
 reads the target and ancestors with `HMGET`; Tree acquisition scans only its
-scope HASH with `HGETALL`. Global `/` and `/local` locks do not scan account
-or `_system` HASHes. Cross-scope batches are rejected.
+scope HASH with `HGETALL`. Tree locks at `/` and `/local` are rejected with
+`InvalidRequest`, because their subtrees span account and `_system` HASHes.
+Use `/local/<account>` or `/local/_system` (or a descendant) as the Tree root.
+Exact locks at `/` and `/local` remain supported and protect only those paths.
+Cross-scope batches are rejected.
 
 ### Filesystem Lock Acquisition (EXACT mode)
 
```

**File**: `docs/zh/concepts/09-transaction.md` (modified, +4/-2)
```diff
@@ -290,8 +290,10 @@ HASH key 按路径 scope 隔离：
 
 所有 key 都使用 `{service_name}` 作为 Redis Cluster hash tag。Exact 获取使用
 `HMGET` 读取目标和祖先；Tree 获取只对所属 scope 的 HASH 执行
-`HGETALL`。`/` 和 `/local` 的 global 锁不会扫描 account 或 `_system`
-HASH。跨 scope batch 会被拒绝。
+`HGETALL`。`/` 和 `/local` 的 Tree 锁会返回 `InvalidRequest`，因为它们的
+子树跨越 account 和 `_system` HASH。Tree 根路径应使用 `/local/<account>`、
+`/local/_system` 或其后代。`/` 和 `/local` 的 Exact 锁仍然支持，只保护
+对应路径本身。跨 scope batch 会被拒绝。
 
 ### Filesystem 获取锁流程（EXACT 模式）
 
```

#### Recent Merged Pull Requests:
- **PR #6688** (2026-10-27): feat(multiwrite): 降低多写元数据 IO (@baojun-zhang)
- **PR #6687** (2026-10-27): fix(pathlock): prevent path aliases from bypassing locks (@zhanglistar)
- **PR #6685** (2026-10-27): fix(pathlock): reject Redis Tree locks spanning scopes (@zhanglistar)
- **PR #6680** (2026-10-27): fix(privacy): pause automatic session secret discovery (@MaojiaSheng)
- **PR #6679** (2026-10-27): feat(ragfs): add transactional SQLite path locks (@zhanglistar)
- **PR #6678** (2026-10-27): feat(encryption): support inline local root key (@zhoujh01)

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

## X. storage): 修复递归删除导致 PathLock 提前失效 (#6631)

**RULE**:
When implementing operations in `crates/ragfs/src/lock/manager.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5c066d97`: storage): 修复递归删除导致 PathLock 提前失效 (#6631). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/ragfs/src/lock/manager.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
                        let resolved = self.resolver.resolve_tree_paths(&request.path).await?;
                        self.check_lock_paths(&resolved.conflict_paths, owner_id)
                        let lock_path = resolved.acquire_lock_path;
                        let tree_candidates = self
                            .resolve_tree_conflict_paths(&request.path)
                        self.check_lock_paths(&tree_candidates, owner_id).await?;
        for parent in LockPathResolver::ancestor_paths(path) {
            for ancestor_lock in self.resolver.resolve_tree_conflict_paths(&parent).await? {
                if let Some(token) = self.provider.read_token(&ancestor_lock).await? {
                    // Only Tree locks propagate to descendants; an Exact lock on
                    // /a must not block /a/b.
                    if token.lock_type == PathLockKind::Tree
                        && token.owner_id != owner_id
                        && !self.is_stale(&token, now_ns)
                    {
                        return Err(PathLockError::Conflict {
                            lock_path: ancestor_lock,
                            owner: token.owner_id,
                 
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
                        let lock_path = self.resolver.resolve_tree_lock_path(&request.path).await?;
                        let exact_candidates = self
                            .resolver
                            .resolve_exact_conflict_paths(&request.path)
                        self.check_lock_paths(&exact_candidates, owner_id).await?;
                        let exact_candidates = self
                            .resolve_exact_conflict_paths(&request.path)
                        self.check_lock_paths(&exact_candidates, owner_id).await?;
        let mut current = path.to_string();
        loop {
            let parent = match current.rsplit_once('/') {
                Some((p, _)) if !p.is_empty() => p.to_string(),
                Some(_) if current != "/" => "/".to_string(),
                _ => break,
            };

            let ancestor_lock = if parent == "/" {
                format!("/{}", PATH_LOCK_FILE)
            } else {
                format!("{}/{}", parent, PATH_LOCK_FILE)
            };
            if let Some(token) = self.provider.read_token(&ancestor_lock).await? {
                // Only Tree locks propagate to descendants; an Exact lock on
       
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5c066d97` are properly handled with clean fallback behavior.
