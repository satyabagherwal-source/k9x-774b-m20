> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source**: github ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Source Version**: `b1d0fa51`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T10:35:00.325Z  
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
> **Harvest Timestamp**: 2026-10-19T10:35:00.020Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 40323 stars

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
- **Issue #6222** (2026-10-19): **[Bug]:  opencode-plugin: subagent OpenViking session id derived from message.parentID creates bogus oc-msg_... sessions**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  ## Summary `lib/memory-session.mjs` builds the OpenViking session id from `event.properties.info.parentID` in `createSessionState`. That function is also called from the `message.updated` / `message.part.updated` handlers, where `info` is an opencode Message and `parentID` is the **parent message id** (`msg_...`), not a session id. Result: bogus ids like `oc-msg_<msgid>__subagent-<sesid>`.  ## Impact - Subagent sessions are occasionally filed under a bogus   `oc-msg_...__subagent-...` session, losing parent linkage. - When such a bogus session receives no capturable message it is never created   server-side; at dispose `flushAll` commits it and gets `404 Session not found`   -> `[opencode-plugin] flushAll skipped session ...`. - Non-fatal (caught in flushAll), but noisy and misfiles memory.  ## Evidence (plugin 2026.10.9, opencode 1.18.35) Persisted `openviking-session-state.json` contained, among 13 correctly-nested sibling subagent sessions:     ses_eb4d04c47... -> oc-msg_14b2fb3c4001...__subagent-ses_eb4d04c47...     ses_f093aafb9... -> oc-msg_0f6fd0561001...__subagent-ses_f093aafb9... Only sessions whose state was created from a message event first were wrong. Same code is still present in 2026.10.16.  ## Root cause - handleMessageUpdated -> getOrCreateSession(sessionId, event)          (event = message.updated) - handleMessagePartUpdated -> getOrCreateSession(sessionId, event)      (even

- **Issue #6129** (2026-10-15): **[Bug]: embedding.max_input_tokens assumes 4 chars/token, so text truncated to "4096 tokens" arrives with up to 6090**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  `embedding.max_input_tokens` bounds the text sent to the embedding provider using a character-based estimate of **four characters per token** for everything that is not CJK (`openviking/utils/embedding_input.py:12-24`):  ```python def estimate_embedding_input_tokens(text: str) -> int:     cjk_chars = sum(1 for char in text if ...)     other_chars = len(text) - cjk_chars     return max(1, cjk_chars + math.ceil(other_chars / 4)) ```  Counting CJK at one token per character is reasonable. Assuming four characters per token for everything else holds for English prose and fails for other scripts: Cyrillic costs roughly 2-3 characters per token, and source code is denser still.  So a document truncated to "4096 tokens" can arrive with up to 6090 real tokens and be rejected by a provider whose per-slot context is 4096 — and the whole `session_commit` task fails, so that session's memory is never written.   ### Steps to Reproduce  1. Configure `embedding.max_input_tokens: 4096` and an embedding backend with a 4096-token    per-slot context. 2. Commit a session whose documents are Russian or source code. 3. Observe `session_commit` tasks failing while the provider reports inputs of 4202-5819 tokens.  Measurement against the tokenizer of the configured model (`llama-server /tokenize`):  | sample | chars | estimate | real | real/estimate | real tokens when estimate = 4096 | |---|---|---|---|---|---| | R

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

### Incident Patch 1: `b1d0fa51` (2026-10-19)
**Commit Message**: fix(langchain): preserve conversation text, roles and tool history (#6275)

* fix(langchain): retain Responses text blocks

(cherry picked from commit 83702c766fdcdc78c557143ff9ff4abfb400759d)
Signed-off-by: Hao Zhe <[REDACTED_EMAIL]>

* fix(langchain): preserve generic ChatMessage roles

(cherry picked from commit cecca479f135efdf18cc64d404afe0436613e178)
Signed-off-by: Hao Zhe <[REDACTED_EMAIL]>

* fix(langchain): restore completed tool parts that carry their input

Motivation: OpenVikingChatMessageHistory dropped a completed ToolPart that
stores call id, name, input and output in one part. The part became a
ToolMessage, and restore_openviking_messages() discarded it because no
pending call had registered its id. A session holding only that part
restored as [] (no exception).

Approach: when a completed part has a tool_id and a nonempty tool_input,
openviking_message_to_langchain() also emits the tool call on the AIMessage.
restore_openviking_messages() drops calls whose id is already active from an
earlier pending call, so no duplicate call is added. Result-only parts (no
input) keep the existing orphan handling. A stored empty tool_input ({}) is
treated as no input and is not r

**File**: `integrations/frameworks/langchain/src/langchain_openviking/client.py` (modified, +27/-8)
```diff
@@ -814,7 +814,9 @@ def extract_message_text(content: Any) -> str:
             if isinstance(block, str):
                 chunks.append(block)
             elif isinstance(block, dict):
-                if block.get("type") == "text" and isinstance(block.get("text"), str):
+                if block.get("type") in ("text", "input_text", "output_text") and isinstance(
+                    block.get("text"), str
+                ):
                     chunks.append(block["text"])
                 elif isinstance(block.get("content"), str):
                     chunks.append(block["content"])
@@ -824,15 +826,32 @@ def extract_message_text(content: Any) -> str:
     return str(content)
 
 
+def get_message_role(message: Any) -> str:
+    """Normalize conversation role aliases, preserving typed-message precedence."""
+
+    if isinstance(message, dict):
+        role = message.get("type") or message.get("role")
+    else:
+        role = getattr(message, "type", None) or getattr(message, "role", None)
+    if role in ("chat", "ChatMessageChunk"):
+        role = message.get("role") if isinstance(message, dict) else getattr(message, "role", None)
+    if role in ("human", "user", "HumanMessageChunk"):
+        return "user"
+    if role in ("system", "developer", "SystemMessageChunk"):
+        return "system"
+    if role in ("ai", "assistant", "AIMessageChunk"):
+        return "assistant"
+    return str(role or "")
+
+
 def get_latest_user_text(messages: Iterable[Any]) -> str:
     for message in reversed(list(messages)):
-        role = getattr(message, "type", None) or getattr(message, "role", None)
-        if isinstance(message, dict):
-            role = message.get("type") or message.get("role")
-            content = message.get("content")
-        else:
-            content = getattr(message, "content", "")
-        if role in {"human", "user"}:
+        if get_message_role(message) == "user":
+            content = (
+                message.get("content")
+                if isinstance(message, dict)
+                else getattr(message, "content", "")
+            )
             text = extract_message_text(content).strip()
             if text:
                 return text
```

**File**: `integrations/frameworks/langchain/src/langchain_openviking/messages.py` (modified, +90/-19)
```diff
@@ -14,14 +14,15 @@
         BaseMessage,
         HumanMessage,
         SystemMessage,
+        ToolCall,
         ToolMessage,
     )
 except ImportError as exc:  # pragma: no cover - exercised by optional import path
     from langchain_openviking.client import missing_dependency
 
     raise missing_dependency("langchain", "langchain-core") from exc
 
-from langchain_openviking.client import extract_message_text
+from langchain_openviking.client import extract_message_text, get_message_role
 
 OPENVIKING_CONTEXT_MARKER = "<openviking_context>"
 LANGCHAIN_SUMMARIZATION_SOURCE = "summarization"
@@ -96,13 +97,14 @@ def langchain_message_to_openviking(
             }
         ]
 
-    if isinstance(message, SystemMessage):
+    role = get_message_role(message)
+    if role == "system":
         return []
 
     text = extract_message_text(getattr(message, "content", ""))
     if not text:
         return []
-    role = "user" if getattr(message, "type", "") == "human" else "assistant"
+    role = "user" if role == "user" else "assistant"
     return [{"role": role, "parts": [{"type": "text", "text": text}]}]
 
 
@@ -116,15 +118,27 @@ def openviking_message_to_langchain(message: dict[str, Any]) -> list[BaseMessage
         return [HumanMessage(content=text)]
 
     tool_calls = []
+    tool_call_ids: set[str] = set()
     tool_messages = []
     for part in parts:
         if part.get("type") != "tool":
             continue
         tool_id = str(part.get("tool_id") or "")
         tool_name = str(part.get("tool_name") or "")
         status = str(part.get("tool_status") or "")
-        has_output = part.get("tool_output") is not None
-        is_completed_result = has_output or status in {"completed", "error"}
+        is_completed_result = _has_tool_result(part)
+        if not is_completed_result or (
+            tool_id and tool_name and part.get("tool_input") is not None
+        ):
+            if not tool_id or tool_id not in tool_call_ids:
+                tool_calls.append(
+                    {
+                        "id": tool_id,
+                        "name": tool_name,
+                        "args": _tool_args(part.get("tool_input")),
+                    }
+                )
+                tool_call_ids.add(tool_id)
         if is_completed_result:
             tool_messages.append(
                 ToolMessage(
@@ -134,14 +148,6 @@ def openviking_message_to_langchain(message: dict[str, Any]) -> list[BaseMessage
                     status="error" if status == "error" else "success",
                 )
             )
-        else:
-            tool_calls.append(
-                {
-                    "id": tool_id,
-                    "name": tool_name,
-                    "args": _tool_args(part.get("tool_input")),
-                }
-            )
 
     messages: list[BaseMessage] = []
     if text or tool_calls or not tool_messages:
@@ -155,28 +161,93 @@ def openviking_message_to_langchain(message: dict[str, Any]) -> list[BaseMessage
 
 
 def restore_openviking_messages(messages: Sequence[dict[str, Any]]) -> list[BaseMessage]:
-    """Restore a valid LangChain message sequence from OpenViking session messages."""
+    """Restore LangChain history, matching tool results to recorded calls."""
 
     restored: list[BaseMessage] = []
-    active_tool_call_ids: set[str] = set()
+    active_tool_calls: dict[str, ToolCall] = {}
+    completed_tool_calls: dict[str, tuple[ToolCall, ToolMessage]] = {}
     for message in messages:
-        for langchain_message in openviking_message_to_langchain(message):
+        converted = openviking_message_to_langchain(message)
+        pending_call_ids = {
+            str(part.get("tool_id") or "")
+            for part in message.get("parts") or []
+            if part.get("type") == "tool" and not _has_tool_result(part)
+        }
+        converted_calls = {
+            str(call.get("id") or ""): call
+            for item in converted
+            if isinstance(item, AIMessage)
+            for call in item.tool_calls
+        }
+        converted_results: dict[str, ToolMessage] = {}
+        for item in converted:
+            if isinstance(item, ToolMessage):
+                converted_results.setdefault(item.tool_call_id, item)
+        completed_here: set[str] = set()
+        # Complete earlier calls before any new assistant text or calls.
+        for result in converted_results.values():
+            pending = active_tool_calls.get(result.tool_call_id)
+            # Different arguments or names describe a new call that reused the ID.
+            if pending is not None and converted_calls.get(result.tool_call_id, pending) == pending:
+                restored.append(result)
+                completed_tool_calls[result.tool_call_id] = (
+                    active_tool_calls.pop(result.tool_call_id),
+                    result,
+                )
+                completed_here.add(result.tool_call_id)
+        for langchain_messa
```

**File**: `integrations/frameworks/langchain/tests/unit/test_langchain_integration.py` (modified, +364/-42)
```diff
@@ -1,6 +1,7 @@
 from __future__ import annotations
 
 import json
+from copy import deepcopy
 from types import MappingProxyType
 from typing import Any
 
@@ -12,8 +13,12 @@
 
 from langchain_core.messages import (
     AIMessage,
+    ChatMessage,
+    ChatMessageChunk,
     HumanMessage,
+    HumanMessageChunk,
     SystemMessage,
+    SystemMessageChunk,
     ToolMessage,
     convert_to_openai_messages,
 )
@@ -29,6 +34,7 @@
     OpenVikingContextMiddleware,
     OpenVikingRetriever,
     OpenVikingSessionContextAssembler,
+    OpenVikingSessionRecorder,
     OpenVikingStore,
     create_openviking_tools,
     with_openviking_context,
@@ -38,6 +44,7 @@
     apply_commit_policy,
     call_openviking,
     ensure_client,
+    get_latest_user_text,
 )
 from langchain_openviking.history import (
     langchain_message_to_openviking,
@@ -789,41 +796,81 @@ def test_in_memory_openviking_client_batch_add_messages_records_messages():
     assert client.sessions["batch-session"][1]["created_at"] == "2026-05-26T00:00:00+00:00"
 
 
-def test_chat_message_history_preserves_tool_parts():
+@pytest.mark.asyncio
+@pytest.mark.parametrize("asynchronous", [False, True])
+@pytest.mark.parametrize(
+    "second_query,new_turn,second_output",
+    [
+        ("deployment", True, "deployment notes found."),
+        ("Tokyo", True, "Tokyo notes found."),
+        ("Tokyo", False, "Tokyo notes found."),
+        ("deployment", False, "done"),
+        ("deployment", False, "deployment notes found."),
+        ("deployment", False, None),
+    ],
+)
+async def test_chat_message_history_preserves_tool_parts(
+    asynchronous, second_query, new_turn, second_output
+):
     client = InMemoryOpenVikingClient()
-    history = OpenVikingChatMessageHistory(session_id="history-session", client=client)
-
-    history.add_messages(
-        [
-            HumanMessage(content="Find deployment notes."),
-            AIMessage(
-                content="Searching.",
-                tool_calls=[
-                    {
-                        "id": "call-1",
-                        "name": "viking_find",
-                        "args": {"query": "deployment"},
-                    }
-                ],
-            ),
-            ToolMessage(
-                content="Azure deployment notes found.",
-                tool_call_id="call-1",
-                name="viking_find",
-            ),
-        ]
+    history = OpenVikingChatMessageHistory(
+        session_id="history-session", client=client, async_client=client
     )
 
+    messages = []
+    outputs = ["deployment notes found.", second_output]
+    for index, (query, output) in enumerate(
+        zip(("deployment", second_query), outputs, strict=True)
+    ):
+        if index == 0 or new_turn:
+            messages.append(HumanMessage(content=f"Find {query} notes."))
+        messages.extend(
+            [
+                AIMessage(
+                    content="Searching.",
+                    tool_calls=[
+                        {
+                            "id": "call-1",
+                            "name": "viking_find",
+                            "args": {"query": query},
+                        }
+                    ],
+                ),
+            ]
+        )
+        if output is not None:
+            messages.append(ToolMessage(content=output, tool_call_id="call-1", name="viking_find"))
+    try:
+        if asynchronous:
+            await history.aadd_messages(messages)
+            restored = await history.aget_messages()
+        else:
+            history.add_messages(messages)
+            restored = history.messages
+    finally:
+        await history.aclose()
+
     stored = client.sessions["history-session"]
     assert stored[1]["parts"][1]["type"] == "tool"
-    assert stored[2]["parts"][0]["tool_output"] == "Azure deployment notes found."
+    assert stored[2]["parts"][0]["tool_output"] == "deployment notes found."
 
-    restored = history.messages
+    assert [type(message) for message in restored] == (
+        [HumanMessage, AIMessage, ToolMessage]
+        + ([HumanMessage] if new_turn else [])
+        + [AIMessage]
+        + ([ToolMessage] if second_output is not None else [])
+    )
     restored_ai_messages = [message for message in restored if isinstance(message, AIMessage)]
     restored_tool_messages = [message for message in restored if isinstance(message, ToolMessage)]
-    assert len(restored_ai_messages) == 1
-    assert len(restored_ai_messages[0].tool_calls) == 1
-    assert len(restored_tool_messages) == 1
+    assert [message.tool_calls for message in restored_ai_messages] == [
+        [{"id": "call-1", "name": "viking_find", "args": {"query": query}, "type": "tool_call"}]
+        for query in ("deployment", second_query)
+    ]
+    expected_outputs = [output for output in outputs if output is not None]
+    assert [message.tool_call_id for message in restored_tool_messages] == ["call-1"] * len(
+        expected_
```

**File**: `integrations/frameworks/langchain/tests/unit/test_langchain_recording.py` (modified, +47/-0)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import asyncio
 from typing import Any
 
 import pytest
@@ -25,6 +26,7 @@
     OpenVikingRecordResult,
     OpenVikingSessionRecorder,
 )
+from langchain_openviking.client import get_latest_user_text
 from langchain_openviking.messages import OPENVIKING_CONTEXT_MARKER
 
 
@@ -804,3 +806,48 @@ def commit_session(self, session_id: str, **kwargs: Any) -> dict[str, Any]:
     ]
     assert client.sessions["middleware-commit-retry"] == []
     assert len(client.archives["middleware-commit-retry"][0]["messages"]) == 2
+
+
+@pytest.mark.parametrize("asynchronous", [False, True])
+@pytest.mark.parametrize(
+    "message,expected",
+    [
+        (HumanMessage([{"type": "input_text", "text": "deployment west"}]), "deployment west"),
+        (AIMessage([{"type": "output_text", "text": "remembered"}]), "remembered"),
+        (
+            HumanMessage(
+                [
+                    {"type": "input_image", "image_url": "https://example.invalid/chart.png"},
+                    {"type": "input_text", "text": "chart caption"},
+                    {"type": "text", "text": "second line"},
+                ]
+            ),
+            "chart caption\nsecond line",
+        ),
+        (HumanMessage([{"type": "text", "text": "standard"}]), "standard"),
+        (AIMessage("plain"), "plain"),
+        (HumanMessage([{"type": ["text"], "text": "ignored"}]), ""),
+        (HumanMessage([{"type": {}, "text": "ignored"}]), ""),
+    ],
+)
+def test_recorder_preserves_responses_text(message, expected, asynchronous):
+    client = InMemoryOpenVikingClient()
+    client.create_session("responses")
+    recorder = OpenVikingSessionRecorder(client=client)
+    if asynchronous:
+        result = asyncio.run(recorder.arecord("responses", [message]))
+    else:
+        result = recorder.record("responses", [message])
+    assert result.messages_written == 1
+    assert client.sessions["responses"][0]["parts"] == [{"type": "text", "text": expected}]
+
+
+def test_responses_text_used_for_recall_and_tool_output():
+    user = HumanMessage([{"type": "input_text", "text": "new question"}])
+    assert get_latest_user_text([HumanMessage("old question"), user]) == "new question"
+    tool = ToolMessage([{"type": "output_text", "text": "tool result"}], tool_call_id="call-1")
+    client = InMemoryOpenVikingClient()
+    client.create_session("tools")
+    recorder = OpenVikingSessionRecorder(client=client)
+    recorder.record("tools", [tool])
+    assert client.sessions["tools"][0]["parts"][0]["tool_output"] == "tool result"
```

**File**: `openviking/message/message.py` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ def _part_to_dict(self, part: Part) -> dict:
                 "skill_uri": part.skill_uri,
                 "tool_status": part.tool_status,
             }
-            if part.tool_input:
+            if part.tool_input is not None:
                 d["tool_input"] = part.tool_input
             if part.tool_output:
                 d["tool_output"] = part.tool_output
```

**File**: `openviking/session/retention.py` (modified, +2/-2)
```diff
@@ -154,7 +154,7 @@ def _truncate_message_group(
 
     Durable messages are never mutated. Text/context bodies and tool outputs are
     the only fields shortened. Tool IDs, names and result pairing remain intact;
-    oversized tool inputs are replaced only when their fixed serialized cost
+    oversized tool inputs are omitted only when their fixed serialized cost
     would otherwise make the whole atomic Step impossible to return.
     """
     if token_budget <= 0 or not messages:
@@ -186,7 +186,7 @@ def _truncate_message_group(
             for part in message.parts:
                 if not isinstance(part, ToolPart) or not part.tool_input:
                     continue
-                part.tool_input = {}
+                part.tool_input = None
                 truncated_ids.add(message.id)
                 if _message_tokens(cloned) <= token_budget:
                     break
```

**File**: `sdk/python/openviking_sdk/message.py` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ def normalize_part(part: Union[Dict[str, Any], MessagePart, Any]) -> Dict[str, A
             "tool_output_externalized_reason",
         ):
             value = getattr(part, field, None)
-            if value:
+            if value or (field == "tool_input" and value is not None):
                 payload[field] = value
         for field in (
             "duration_ms",
```

**File**: `sdk/python/tests/test_async_client_behaviors.py` (modified, +4/-3)
```diff
@@ -145,7 +145,8 @@ async def test_async_http_client_sends_message_semantics_and_turn_retention():
 
 
 @pytest.mark.asyncio
-async def test_async_http_client_normalizes_message_part_objects():
+@pytest.mark.parametrize("tool_input", [None, {}, {"query": "OpenViking"}])
+async def test_async_http_client_normalizes_message_part_objects(tool_input):
     client = AsyncHTTPClient(url="http://localhost:1933")
     fake_http = SimpleNamespace(post=AsyncMock(return_value=object()))
     client._http = fake_http
@@ -165,7 +166,7 @@ async def test_async_http_client_normalizes_message_part_objects():
             ToolPart(
                 tool_id="call-1",
                 tool_name="search",
-                tool_input={"query": "OpenViking"},
+                tool_input=tool_input,
                 tool_status="completed",
                 duration_ms=12.5,
                 prompt_tokens=42,
@@ -202,7 +203,7 @@ async def test_async_http_client_normalizes_message_part_objects():
                     "type": "tool",
                     "tool_id": "call-1",
                     "tool_name": "search",
-                    "tool_input": {"query": "OpenViking"},
+                    **({"tool_input": tool_input} if tool_input is not None else {}),
                     "tool_status": "completed",
                     "duration_ms": 12.5,
                     "prompt_tokens": 42,
```

---

### Incident Patch 2: `a9c21c2f` (2026-10-19)
**Commit Message**: fix(compile): isolate account locks and stop stalled review loops (#6133)

* fix(bot): align compile execution with model configuration

* fix(bot): close SDK streaming responses

* fix(compile): restore bounded execution and fallback semantics

* fix(compile): reject missing authenticated account IDs

* fix(compile): enforce minimum call and assignment budgets

* fix(compile): fall back after consecutive reader failures

* fix(compile): give assignments twice the model timeout

**File**: `bot/tests/test_bot_provider_thinking.py` (modified, +4/-1)
```diff
@@ -1,4 +1,5 @@
 from types import SimpleNamespace
+from unittest.mock import MagicMock
 
 import pytest
 from vikingbot.providers.vlm_adapter import VLMProviderAdapter
@@ -183,7 +184,9 @@ async def chunks():
                     usage=None,
                 )
 
-            return chunks()
+            response = MagicMock()
+            response.__aenter__.return_value = chunks()
+            return response
 
     vlm = SimpleNamespace(
         provider="volcengine",
```

**File**: `bot/tests/test_bot_vlm_credentials.py` (modified, +8/-2)
```diff
@@ -10,6 +10,7 @@
 
 from openviking.models.vlm import MultiCredentialVLM
 from openviking.models.vlm.backends.litellm_vlm import LiteLLMVLMProvider
+from openviking.models.vlm.retry_vlm import RetryVLM
 
 
 def _write_config(tmp_path, monkeypatch, data):
@@ -149,7 +150,7 @@ def test_bot_inherits_root_vlm_credentials_when_agents_model_is_omitted(tmp_path
 
 
 @pytest.mark.parametrize("bot_override", [False, True], ids=["inherited-model", "bot-model"])
-def test_agent_max_tokens_reaches_provider(tmp_path, monkeypatch, bot_override):
+def test_agent_generation_settings_reach_provider(tmp_path, monkeypatch, bot_override):
     agents = {"max_tokens": 8192}
     if bot_override:
         agents.update(provider="openai", model="bot-model", api_key="bot-key")
@@ -162,13 +163,15 @@ def test_agent_max_tokens_reaches_provider(tmp_path, monkeypatch, bot_override):
                 "model": "root-model",
                 "api_key": "root-key",
                 "max_tokens": 4096,
+                "thinking": False,
             },
             "bot": {"agents": agents},
         },
     )
     provider = _make_provider(config)
     assert config.agents.inherits_root_vlm() is (not bot_override)
     assert provider._vlm.max_tokens == 8192
+    assert provider._vlm.thinking is bot_override
 
 
 def test_explicit_bot_model_uses_bot_credentials_instead_of_root(tmp_path, monkeypatch):
@@ -248,6 +251,7 @@ def test_bot_credentials_without_outer_model_use_bot_chain(tmp_path, monkeypatch
         {
             "vlm": {
                 "model": "root-primary",
+                "thinking": False,
                 "credentials": [
                     {
                         "id": "root-primary",
@@ -264,6 +268,7 @@ def test_bot_credentials_without_outer_model_use_bot_chain(tmp_path, monkeypatch
     provider = _make_provider(config)
 
     assert config.agents.inherits_root_vlm() is False
+    assert provider._vlm.thinking is True
     assert config.agents.model == ""
     assert isinstance(provider._vlm, MultiCredentialVLM)
     assert provider._vlm._credential_ids == ["bot-primary", "bot-backup"]
@@ -353,7 +358,8 @@ def test_explicit_litellm_provider_uses_vlm_adapter(tmp_path, monkeypatch):
     provider = _make_provider(config)
 
     assert isinstance(provider, VLMProviderAdapter)
-    assert isinstance(provider._vlm, LiteLLMVLMProvider)
+    assert isinstance(provider._vlm, RetryVLM)
+    assert isinstance(provider._vlm.inner, LiteLLMVLMProvider)
     assert provider._vlm.model == "openrouter/openai/gpt-4o-mini"
 
 
```

**File**: `bot/tests/test_bot_vlm_streaming.py` (modified, +17/-3)
```diff
@@ -1,8 +1,10 @@
 from types import SimpleNamespace
+from unittest.mock import MagicMock
 
 import pytest
 from vikingbot.providers.vlm_adapter import VLMProviderAdapter
 
+from openviking.models.model_error import ModelError, ModelErrorKind
 from openviking.models.vlm import FailoverVLM, MultiCredentialVLM, OpenAIVLM, VolcEngineVLM
 
 
@@ -23,7 +25,9 @@ async def generate():
                     raise chunk
                 yield chunk
 
-        return generate()
+        response = MagicMock()
+        response.__aenter__.return_value = generate()
+        return response
 
 
 def stream_chunk(
@@ -112,20 +116,25 @@ async def test_vlm_adapter_streams_openai_content_deltas():
 
 @pytest.mark.asyncio
 async def test_vlm_adapter_streams_with_credential_failover_before_first_delta():
-    primary_completions = FakeCompletions(error=RuntimeError("status 429: rate limit"))
+    primary_completions = FakeCompletions(
+        error=ModelError(ModelErrorKind.RATE_LIMIT_ERROR, "Rate limit exceeded")
+    )
     backup_completions = FakeCompletions(chunks=[stream_chunk("backup", finish_reason="stop")])
     primary = VolcEngineVLM(
         {
             "provider": "volcengine",
             "model": "primary-model",
             "api_key": "primary-key",
+            "max_retries": 0,
         }
     )
     backup = VolcEngineVLM(
         {
             "provider": "volcengine",
             "model": "backup-model",
             "api_key": "backup-key",
+            "thinking": True,
+            "reasoning_effort": "low",
         }
     )
     attach_client(primary, primary_completions)
@@ -149,6 +158,7 @@ async def test_vlm_adapter_streams_with_credential_failover_before_first_delta()
     assert events[-1].response.content == "backup"
     assert len(primary_completions.calls) == 1
     assert backup_completions.calls[0]["model"] == "backup-model"
+    assert backup_completions.calls[0]["reasoning_effort"] == "low"
     assert credentials.active_credential_id == "backup"
 
 
@@ -178,7 +188,10 @@ async def test_vlm_adapter_streams_with_legacy_primary_backup_failover():
 @pytest.mark.asyncio
 async def test_credential_stream_does_not_replay_after_a_visible_delta():
     primary_completions = FakeCompletions(
-        chunks=[stream_chunk("partial"), RuntimeError("status 429: rate limit")]
+        chunks=[
+            stream_chunk("partial"),
+            ModelError(ModelErrorKind.RATE_LIMIT_ERROR, "Rate limit exceeded"),
+        ]
     )
     backup_completions = FakeCompletions(chunks=[stream_chunk("duplicate", finish_reason="stop")])
     primary = OpenAIVLM({"provider": "openai", "model": "primary-model", "api_key": "primary-key"})
@@ -202,4 +215,5 @@ async def test_credential_stream_does_not_replay_after_a_visible_delta():
     assert events[0].content == "partial"
     assert events[-1].type == "response"
     assert events[-1].response.finish_reason == "error"
+    assert len(primary_completions.calls) == 1
     assert backup_completions.calls == []
```

**File**: `bot/tests/test_compile_execution.py` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+"""Core regressions for account isolation and advisory Compile execution."""
+
+import asyncio
+from collections import Counter
+from types import SimpleNamespace
+from unittest.mock import AsyncMock
+
+import pytest
+from vikingbot.compile import review
+from vikingbot.compile.models import CompileLimits
+from vikingbot.compile.pipeline_io import JsonModel, ModelCallLimitError
+from vikingbot.compile.plan import Contract, Node, ReviewDecision
+from vikingbot.compile.service import BotCompileService
+from vikingbot.config.schema import Config
+from vikingbot.providers.base import LLMResponse, ToolCallRequest
+
+
+@pytest.mark.parametrize(
+    "mode,account,peak", [("api_key", "b", 2), ("api_key", "a", 1), ("dev", "b", 1)]
+)
+async def test_target_locks_follow_effective_account(tmp_path, mode, account, peak):
+    config = Config(storage_workspace=str(tmp_path))
+    config.ov_server.set_effective_auth_mode(mode)
+    service = BotCompileService(agent_loop=SimpleNamespace(config=config))
+    active = highest = 0
+
+    async def execute(*args):
+        nonlocal active, highest
+        active += 1
+        highest = max(highest, active)
+        await asyncio.sleep(0)
+        active -= 1
+
+    service._execute_task = execute
+    request = SimpleNamespace(to="viking://resources/wiki")
+    await asyncio.gather(
+        service._run_task("a", request, {"account_id": "a", "user_id": "alice"}),
+        service._run_task("b", request, {"account_id": account, "user_id": "bob"}),
+    )
+    assert highest == peak
+
+
+@pytest.mark.parametrize("failure", ["model", "record", "cancel"])
+async def test_review_failures_preserve_plan_and_cancellation(failure):
+    contract = Contract(extract={"instructions": "Copy", "execution": "direct", "output": "files"})
+    decision = ReviewDecision(
+        action="revise", contract=contract, plan="p.finalize(mapped, into=target)"
+    )
+
+    async def ask(*args, **kwargs):
+        args[4](decision)
+        if failure != "record":
+            error = asyncio.CancelledError() if failure == "cancel" else OSError("Review failed")
+            raise error
+        return decision
+
+    runtime = SimpleNamespace(
+        contract=contract,
+        model=SimpleNamespace(ask=ask),
+        files=SimpleNamespace(put=AsyncMock()),
+        resources=SimpleNamespace(name="read_skill_resource"),
+        failures=[],
+        metrics=Counter(),
+    )
+    if failure == "record":
+        runtime.files.put.side_effect = OSError("Record failed")
+    args = (runtime, Node("mapped", "map", "sources", task="extract"), [], "", set(), 0, "", {})
+    if failure == "cancel":
+        with pytest.raises(asyncio.CancelledError):
+            await review.run(*args)
+    else:
+        assert await review.run(*args) is None
+    assert runtime.contract is contract
+
+
+def response(name, arguments):
+    """Return one scripted reader or final-result tool call."""
+    return LLMResponse(None, [ToolCallRequest("call", name, arguments, 0)])
+
+
+@pytest.mark.parametrize("case", ["repeat", "progress", "error"])
+async def test_direct_reads_stop_repetition_but_allow_progress(case):
+    offsets = [n // 2 for n in range(102)] if case == "progress" else list(range(4))
+    files = SimpleNamespace(put=AsyncMock())
+    responses = [response("read", {"offset": n}) for n in offsets]
+    responses.append(response("emit", {"action": "continue"}))
+    provider = SimpleNamespace(thinking=True, chat=AsyncMock(side_effect=responses))
+    model = JsonModel(provider, "test", 0, files, CompileLimits(), {}, Counter())
+    reader = SimpleNamespace(
+        name="read", description="", parameters={}, execute=AsyncMock(return_value="x")
+    )
+    if case == "progress":
+        reader.execute.side_effect = [f"chunk{n}" for n in offsets]
+    if case == "error":
+        reader.execute.side_effect = [
+            error(f"request_id={i}")
+            for i, error in enumerate((OSError, ValueError, TimeoutError, PermissionError))
+        ]
+    result = model.direct("map", "", {}, ReviewDecision, None, "test", readers={"read": reader})
+    if case == "progress":
+        assert (await result).action == "continue"
+    else:
+        with pytest.raises(ModelCallLimitError, match="made no progress|failed repeatedly"):
+            await result
+    assert provider.chat.await_count == (len(offsets) + 1 if case == "progress" else 4)
+    assert provider.chat.await_args.kwargs["thinking"] is False
```

**File**: `bot/vikingbot/compile/entry.py` (modified, +11/-2)
```diff
@@ -4,9 +4,10 @@
 
 from pydantic import Field
 
+from openviking.models.model_error import ModelErrorKind, model_error_kind
 from vikingbot.compile import file_ops
 from vikingbot.compile.ops.common import payload
-from vikingbot.compile.pipeline_io import ModelCallError
+from vikingbot.compile.pipeline_io import ModelCallError, ModelCallLimitError
 from vikingbot.compile.results import FileResponse, Group
 
 
@@ -55,7 +56,15 @@ def validate(response):
 
     try:
         response = await runtime.model.ask("compile", system, data, EntryResponse, validate)
-    except (ModelCallError, ValueError):
+    except ModelCallError as exc:
+        runtime.direct_output_format = None
+        if not isinstance(exc, ModelCallLimitError) and model_error_kind(exc) not in {
+            ModelErrorKind.INPUT_TOO_LARGE,
+            ModelErrorKind.TRANSIENT_NETWORK_ERROR,
+        }:
+            raise
+        return None
+    except ValueError:
         runtime.direct_output_format = None
         return None
     if response.needs_pipeline or any(
```

**File**: `bot/vikingbot/compile/models.py` (modified, +0/-4)
```diff
@@ -37,10 +37,6 @@ class CompileLimits(BaseModel):
     agent_iterations: int = 120
     # Per-child model/tool rounds, including draft checks and submission; parent budget is separate.
     subagent_iterations: int = Field(default=70, ge=1)
-    # Wall-clock limits include provider capacity waits, transport retries and tool reads.
-    pipeline_call_seconds: float = Field(default=600, gt=0)
-    pipeline_plan_seconds: float = Field(default=600, gt=0)
-    pipeline_agent_seconds: float = Field(default=1200, gt=0)
     # Per-task Map workers, also used for Resource source subagents.
     source_concurrency: int = Field(default=6, ge=1)
     # Per-task Shuffle routing workers and embedding batches.
```

**File**: `bot/vikingbot/compile/pipeline_io.py` (modified, +56/-29)
```diff
@@ -103,7 +103,11 @@ def retry_allowed(failures: Counter, error: str) -> bool:
 
 
 class ModelCallError(OSError):
-    """A model timeout or provider failure; output validation errors remain separate."""
+    """A failed model request or stalled read loop; output validation errors remain separate."""
+
+
+class ModelCallLimitError(ModelCallError):
+    """A local deadline or no-progress limit allows direct generation to use the pipeline."""
 
 
 class TaskFiles:
@@ -228,20 +232,20 @@ def __init__(self, provider, model, temperature, files, limits, usage, metrics):
         self.identity.update(
             batch_target_chars=self.budget, output_reserve_tokens=self.output_tokens
         )
-        self.identity["thinking"] = {"compile": True}
+        self.identity["thinking"] = {
+            "map": False,
+            "route": False,
+            "reduce": False,
+            "combine": False,
+        }
         underlying = getattr(provider, "_provider", provider)
         backend = getattr(underlying, "_vlm", underlying)
+        backend = getattr(backend, "primary", backend)
+        self.timeout = getattr(backend, "timeout", 600.0)
         self.identity["backend_settings"] = {
             name: getattr(backend, name, None)
             for name in ("model", "thinking", "temperature", "max_tokens", "reasoning_effort")
         }
-        # Explicit Ark configuration controls direct generation without changing other stages.
-        self.identity["reasoning_effort"] = (
-            {"compile": backend.reasoning_effort}
-            if getattr(backend, "provider", None) == "volcengine"
-            and getattr(backend, "reasoning_effort", None) is not None
-            else {}
-        )
         configured_tokens = self.identity["backend_settings"]["max_tokens"]
         self.max_tokens = (
             configured_tokens
@@ -276,12 +280,17 @@ async def call(self, stage, messages, tools, *, max_tokens):
         self.metrics[f"{stage}_calls"] += 1
         number = self.metrics[f"{stage}_calls"]
         started = time.monotonic()
+        seconds = max(600, self.timeout)
+        thinking = self.identity["thinking"].get(stage.split("_", 1)[0])
         report = {
             "stage": stage,
             "call": number,
             "max_tokens": max_tokens,
-            "timeout_seconds": self.limits.pipeline_call_seconds,
-            "thinking": self.identity["thinking"].get(stage, False),
+            "timeout_seconds": seconds,
+            "thinking": thinking
+            if thinking is not None
+            else self.identity["backend_settings"]["thinking"],
+            "reasoning_effort": self.identity["backend_settings"]["reasoning_effort"],
             "message_chars": sum(len(json.dumps(m, ensure_ascii=False)) for m in messages),
             "tool_schema_chars": len(json.dumps(tools, ensure_ascii=False)),
             "tool_result_chars": sum(
@@ -295,19 +304,14 @@ async def call(self, stage, messages, tools, *, max_tokens):
             json.dumps([messages, tools], ensure_ascii=False), text_type="mixed"
         )
         try:
-            completion_overrides = {}
-            if stage in self.identity["reasoning_effort"]:
-                report["reasoning_effort"] = self.identity["reasoning_effort"][stage]
-                completion_overrides["reasoning_effort"] = report["reasoning_effort"]
-            async with asyncio.timeout(self.limits.pipeline_call_seconds):
+            async with asyncio.timeout(seconds):
                 response = await self.provider.chat(
                     messages=messages,
                     tools=tools,
                     model=self.model,
                     temperature=self.temperature,
                     max_tokens=max_tokens,
-                    thinking=report["thinking"],
-                    **completion_overrides,
+                    thinking=thinking,
                 )
             report.update(
                 finish_reason=response.finish_reason,
@@ -331,8 +335,8 @@ async def call(self, stage, messages, tools, *, max_tokens):
             return response
         except TimeoutError as exc:
             report["error"] = "TimeoutError"
-            raise ModelCallError(
-                f"{stage}: model call wall-clock budget exhausted ({self.limits.pipeline_call_seconds:g}s)"
+            raise ModelCallLimitError(
+                f"{stage}: model call wall-clock budget exhausted ({seconds:g}s)"
             ) from exc
         except Exception as exc:
             report["error"] = type(exc).__name__
@@ -356,21 +360,20 @@ async def ask(
         agent=False,
         readers=None,
     ) -> R:
-        """Bound an assignment; readers adds scoped tools for direct calls without widening worker access."""
-        seconds = (
-            self.limits.pipeline_plan_seconds
-            if stage in {"plan", "review"}
-            else self.limits.pipeline_agent_seconds
-        )
+        """Bound each assignment to twice
```

**File**: `bot/vikingbot/compile/review.py` (modified, +16/-8)
```diff
@@ -2,9 +2,12 @@
 
 from __future__ import annotations
 
+import asyncio
 import json
 from dataclasses import asdict
 
+from loguru import logger
+
 from vikingbot.agent.tools.base import Tool
 from vikingbot.compile import file_ops
 from vikingbot.compile.plan import PLANNING_RULES, ReviewDecision, parse_plan
@@ -175,12 +178,7 @@ async def execute(self, tool_context=None, index=0, member=None, offset=0, limit
 
 
 async def run(runtime, node, outputs, remaining_plan, completed_names, revisions, prompt, context):
-    """Return an accepted decision and parsed suffix, or None to retain the existing plan.
-
-    Only future configurations may change; output format and scope meanings remain fixed.
-    Invalid decisions get up to three repairs per review; exhausted or model/read failures
-    are recorded. Cancellation and diagnostic-write failures propagate; the contract stays fixed.
-    """
+    """Return a validated revision or None; cancellation propagates."""
     record = {}
     accepted = None
     try:
@@ -245,8 +243,18 @@ def validate_decision(decision):
         )
         record["decision"] = decision.model_dump(exclude_none=True)
         record["status"] = "accepted" if accepted else "continued"
-    except (OSError, ValueError, TypeError) as exc:
+    except Exception as exc:
+        if asyncio.current_task().cancelling():
+            raise asyncio.CancelledError() from exc
+        accepted = None
         record.update(status="rejected", error=str(exc)[:800])
         runtime.metrics["review_rejections"] += 1
-    await runtime.files.put(f"reviews/{node.name}", record)
+        logger.warning("Compile stage review {} failed: {}", node.name, exc)
+    try:
+        await runtime.files.put(f"reviews/{node.name}", record)
+    except Exception as exc:
+        if asyncio.current_task().cancelling():
+            raise asyncio.CancelledError() from exc
+        logger.warning("Compile stage review {} record write failed: {}", node.name, exc)
+        return None
     return accepted
```

---

### Incident Patch 3: `e7812740` (2026-10-19)
**Commit Message**: fix(langchain): extract text blocks in viking_store (#6070)

* fix(langchain): extract text blocks in viking_store

* test(langchain): align integration imports with package lint context

**File**: `integrations/frameworks/langchain/src/langchain_openviking/tools.py` (modified, +5/-1)
```diff
@@ -25,6 +25,7 @@
     call_openviking,
     compact_json,
     ensure_client,
+    extract_message_text,
     item_value,
     iter_result_items,
     stringify,
@@ -683,7 +684,10 @@ def _normalize_messages(messages: str | list[dict[str, Any]]) -> list[dict[str,
                 }
             )
             continue
-        content = str(message.get("content", ""))
+        raw_content = message.get("content", "")
+        content = (
+            extract_message_text(raw_content) if isinstance(raw_content, list) else str(raw_content)
+        )
         if role == "tool":
             normalized.append(
                 {
```

**File**: `integrations/frameworks/langchain/tests/unit/test_langchain_integration.py` (modified, +78/-1)
```diff
@@ -10,7 +10,13 @@
 pytest.importorskip("langgraph")
 pytest.importorskip("langchain_openviking")
 
-from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
+from langchain_core.messages import (
+    AIMessage,
+    HumanMessage,
+    SystemMessage,
+    ToolMessage,
+    convert_to_openai_messages,
+)
 from langchain_core.runnables import RunnableLambda
 from langgraph.store.base import PutOp
 from openviking_sdk.errors import InvalidArgumentError
@@ -177,6 +183,77 @@ def test_create_openviking_tools_exposes_common_viking_primitives():
     assert "VikingDB is internal vector/index storage" in health
 
 
+@pytest.mark.parametrize("role", ["user", "assistant", "system", "tool"])
+@pytest.mark.parametrize("text_format", ["string", "block"])
+def test_viking_store_normalizes_langchain_text_blocks(role: str, text_format: str):
+    content = [
+        {"type": "text", "text": "Remember cobalt deployment."},
+        {"type": "text", "text": "中文确认"},
+    ]
+    messages = {
+        "user": HumanMessage(content=content),
+        "assistant": AIMessage(content=content),
+        "system": SystemMessage(content=content),
+        "tool": ToolMessage(content=content, tool_call_id="call-normal", name="ordinary_tool"),
+    }
+    wire = convert_to_openai_messages([messages[role]], text_format=text_format)
+    client = InMemoryOpenVikingClient()
+    store = create_openviking_tools(client=client, tool_names=["viking_store"])[0]
+
+    result = json.loads(
+        store.invoke({"session_id": "text-blocks", "messages": wire, "commit": False})
+    )
+
+    assert result["messages_added"] == 1
+    stored = client.sessions["text-blocks"][0]
+    assert stored["role"] == ("assistant" if role in {"system", "tool"} else role)
+    part = stored["parts"][0]
+    assert (
+        part["tool_output" if role == "tool" else "text"] == "Remember cobalt deployment.\n中文确认"
+    )
+    if role == "tool":
+        assert part["tool_id"] == "call-normal"
+        assert part["tool_name"] == "ordinary_tool"
+        assert part["tool_status"] == "completed"
+
+
+@pytest.mark.parametrize("content", [None, False, 0])
+def test_viking_store_preserves_scalar_content(content: Any):
+    client = InMemoryOpenVikingClient()
+    store = create_openviking_tools(client=client, tool_names=["viking_store"])[0]
+
+    store.invoke(
+        {
+            "session_id": "scalar",
+            "messages": [{"role": "user", "content": content}],
+            "commit": False,
+        }
+    )
+
+    assert client.sessions["scalar"][0]["parts"] == [{"type": "text", "text": str(content)}]
+
+
+@pytest.mark.parametrize("role", ["user", "system", "tool"])
+def test_viking_store_preserves_native_parts(role: str):
+    client = InMemoryOpenVikingClient()
+    store = create_openviking_tools(client=client, tool_names=["viking_store"])[0]
+    parts = [{"type": "text", "text": "explicit parts control"}]
+
+    store.invoke(
+        {
+            "session_id": "native-parts",
+            "messages": [
+                {"role": role, "content": [{"type": "text", "text": "unused"}], "parts": parts}
+            ],
+            "commit": False,
+        }
+    )
+
+    stored = client.sessions["native-parts"][0]
+    assert stored["role"] == ("assistant" if role in {"system", "tool"} else role)
+    assert stored["parts"] == parts
+
+
 def test_create_openviking_tools_uses_peer_id_only_for_message_attribution():
     client = InMemoryOpenVikingClient(
         {"viking://~/memories/profile.md": "The peer likes LangGraph agents."}
```

#### Recent Merged Pull Requests:
- **PR #6294** (2026-10-19): docs: refresh WeChat group QR code (@ZaynJarvis)
- **PR #6291** (2026-10-19): docs: refresh WeChat group QR code (@ZaynJarvis)
- **PR #6275** (2026-10-19): fix(langchain): preserve conversation text, roles and tool history (@ehz0ah)
- **PR #6270** (2026-10-19): perf(session): 减少消息写入和 Session 接口的重复读取 (@qin-ctx)
- **PR #6267** (2026-10-19): fix(gateway): read cache usage from every upstream form and warn about long conversations missing the cache (@t0saki)
- **PR #6265** (2026-10-19): fix(tasks): 移除文件任务存储的统一 I/O 限流 (@qin-ptr)

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

## X. langchain): preserve conversation text, roles and tool history (#6275)

**RULE**:
When implementing operations in `integrations/frameworks/langchain/src/langchain_openviking/client.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b1d0fa51`: langchain): preserve conversation text, roles and tool history (#6275). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `integrations/frameworks/langchain/src/langchain_openviking/client.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
                if block.get("type") in ("text", "input_text", "output_text") and isinstance(
                    block.get("text"), str
                ):
def get_message_role(message: Any) -> str:
    """Normalize conversation role aliases, preserving typed-message precedence."""

    if isinstance(message, dict):
        role = message.get("type") or message.get("role")
    else:
        role = getattr(message, "type", None) or getattr(message, "role", None)
    if role in ("chat", "ChatMessageChunk"):
        role = message.get("role") if isinstance(message, dict) else getattr(message, "role", None)
    if role in ("human", "user", "HumanMessageChunk"):
        return "user"
    if role in ("system", "developer", "SystemMessageChunk"):
        return "system"
    if role in ("ai", "assistant", "AIMessageChunk"):
        return "assistant"
    return str(role or "")


        if get_message_role(message) == "user":
            content = (
                message.get("content")
                if isinstance(message, dict)
                else getattr(message, "content", "")
            )
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
                if block.get("type") == "text" and isinstance(block.get("text"), str):
        role = getattr(message, "type", None) or getattr(message, "role", None)
        if isinstance(message, dict):
            role = message.get("type") or message.get("role")
            content = message.get("content")
        else:
            content = getattr(message, "content", "")
        if role in {"human", "user"}:
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b1d0fa51` are properly handled with clean fallback behavior.
