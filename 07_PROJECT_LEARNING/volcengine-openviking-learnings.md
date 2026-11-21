> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source**: github ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Source Version**: `1efb03a3`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T20:10:54.935Z  
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
> **Harvest Timestamp**: 2026-11-21T20:10:54.927Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 42564 stars

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

### Incident Patch 1: `a0c00a4f` (2026-11-21)
**Commit Message**: fix(crypto): reject malformed local root key files (#8126)

LocalFileProvider read the root key file and accepted any valid hex
string. A truncated or hand-edited file (for example 16 bytes instead of
32) silently became the root key: HKDF then derived account keys from it,
so newly encrypted files were sealed under a key the real 32-byte root
key can never open, while existing ciphertext fails to decrypt. The
inline root_key configuration already enforces 32 bytes; apply the same
rule to the file path.

Co-authored-by: Kiko0301 <[REDACTED_EMAIL]>

**File**: `openviking/crypto/providers.py` (modified, +9/-1)
```diff
@@ -247,9 +247,17 @@ async def _load_or_create_root_key(self) -> bytes:
             with open(self.key_file, "r") as f:
                 hex_key = f.read().strip()
             try:
-                return bytes.fromhex(hex_key)
+                root_key = bytes.fromhex(hex_key)
             except ValueError:
                 raise ConfigError(f"Invalid root key format in {self.key_file}")
+            # A truncated or hand-edited key file must not silently become a
+            # shorter root key: the account keys derived from it would encrypt
+            # new files under a key the real 32-byte root key cannot open.
+            if len(root_key) != 32:
+                raise ConfigError(
+                    f"Invalid root key in {self.key_file}: expected 32 bytes, got {len(root_key)}"
+                )
+            return root_key
         else:
             # Create new key
             root_key = secrets.token_bytes(32)
```

**File**: `tests/unit/crypto/test_local_provider_root_key_validation.py` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+# Copyright (c) 2026 Beijing Volcano Engine Technology Co., Ltd.
+# SPDX-License-Identifier: AGPL-3.0
+"""The local root-key file must hold exactly one 32-byte root key."""
+
+import secrets
+
+import pytest
+
+from openviking.crypto.exceptions import ConfigError
+from openviking.crypto.providers import LocalFileProvider
+
+
+async def test_short_root_key_file_is_rejected(tmp_path):
+    key_file = tmp_path / "master.key"
+    # 16 valid hex bytes: parseable, but not a 256-bit root key.
+    key_file.write_text("ab" * 16)
+
+    provider = LocalFileProvider(key_file=str(key_file))
+
+    with pytest.raises(ConfigError):
+        await provider.get_root_key()
+
+
+async def test_long_root_key_file_is_rejected(tmp_path):
+    key_file = tmp_path / "master.key"
+    key_file.write_text("cd" * 64)
+
+    provider = LocalFileProvider(key_file=str(key_file))
+
+    with pytest.raises(ConfigError):
+        await provider.get_root_key()
+
+
+async def test_valid_root_key_file_still_loads(tmp_path):
+    root_key = secrets.token_bytes(32)
+    key_file = tmp_path / "master.key"
+    key_file.write_text(root_key.hex())
+
+    provider = LocalFileProvider(key_file=str(key_file))
+
+    assert await provider.get_root_key() == root_key
```

---

### Incident Patch 2: `1efb03a3` (2026-11-21)
**Commit Message**: fix(compile): persist cancellation of queued runs (#8166)

Co-authored-by: fujiajie.168 <[REDACTED_EMAIL]>

**File**: `openviking/server/routers/tasks.py` (modified, +10/-1)
```diff
@@ -12,9 +12,10 @@
 from fastapi import APIRouter, Depends, Query
 
 from openviking.server.auth import get_request_context
+from openviking.server.dependencies import get_service
 from openviking.server.identity import RequestContext, Role
 from openviking.server.models import Response
-from openviking.service.task_domain import TaskRecord
+from openviking.service.task_domain import TaskRecord, TaskStatus
 from openviking.service.task_store import SYSTEM_TASK_ACCOUNT_ID, SYSTEM_TASK_USER_ID
 from openviking.service.task_tracker import get_task_tracker
 from openviking_cli.exceptions import (
@@ -93,6 +94,14 @@ async def cancel_task(
             code="NOT_FOUND",
             details={"resource": task_id, "type": "task"},
         )
+    if (
+        task.task_type == "compile"
+        and task.status == TaskStatus.CANCELLED
+        and task.stage == "queued"
+    ):
+        lifecycle = get_service().compile.lifecycle
+        if lifecycle is not None:
+            await lifecycle.store.cancel_queued_run(task)
     return Response(status="ok", result=task.to_dict())
 
 
```

**File**: `openviking/service/compile_targets.py` (modified, +16/-1)
```diff
@@ -52,7 +52,7 @@
 )
 from openviking.server.identity import RequestContext, Role
 from openviking.service.external_task_service import SUBMIT_EXHAUSTED, ExternalTaskSnapshot
-from openviking.service.task_domain import TaskPatch, TaskStatus, sanitize_error
+from openviking.service.task_domain import TaskPatch, TaskRecord, TaskStatus, sanitize_error
 from openviking.service.task_tracker_concurrency import run_to_completion
 from openviking.storage.errors import LockAcquisitionError, ResourceBusyError
 from openviking.storage.pathlock_recovery import (
@@ -242,6 +242,7 @@ async def list_runs(
     async def put_run(
         self, account_id: str, owner_user_id: str, compile_name: str, run: dict
     ) -> None: ...
+    async def cancel_queued_run(self, task: TaskRecord) -> None: ...
     def lock_run(
         self, account_id: str, owner_user_id: str, compile_name: str, task_id: str
     ) -> Any: ...
@@ -488,6 +489,20 @@ async def put_run(
         async with self.locked(path) as lease:
             await self.write_json(path, run, lease)
 
+    async def cancel_queued_run(self, task: TaskRecord) -> None:
+        """Finalize an unstarted Run using the Task's persisted cancellation time."""
+        compile_meta = (task.meta.get("request") or {}).get("compile") or {}
+        owner = compile_meta.get("owner_user_id")
+        name = compile_meta.get("compile_name")
+        if task.account_id is None or not owner or not name:
+            return
+        path = self._run_path(task.account_id, owner, name, task.task_id)
+        async with self.locked(path) as lease:
+            run = await self.read_json(path)
+            if run is not None and run["status"] == "queued" and run["started_at"] is None:
+                run.update(status="cancelled", finished_at=task.updated_at)
+                await self.write_json(path, run, lease)
+
     async def list_runs(
         self,
         account_id: str,
```

**File**: `tests/server/test_compile_configurations.py` (modified, +10/-0)
```diff
@@ -339,6 +339,16 @@ async def test_same_name_configuration_and_runs_are_user_scoped(service, app, cl
         ]["runs"]
         assert [r["task_id"] for r in runs] == [task_ids[-1]]
         assert runs[0]["params"]["instruction"] == actor.user.user_id
+        assert runs[0]["status"] == "queued"
+        cancel_path = f"/api/v1/tasks/{task_ids[-1]}/cancel"
+        cancelled = await client.post(cancel_path)
+        assert cancelled.status_code == 200, cancelled.text
+        task = cancelled.json()["result"]
+        run = await service.compile.get_run(name, task_ids[-1], actor)
+        assert task["status"] == run["status"] == "cancelled"
+        assert run["finished_at"] == task["updated_at"]
+        assert (await client.post(cancel_path)).status_code == 200
+        assert await service.compile.get_run(name, task_ids[-1], actor) == run
     assert task_ids[0] != task_ids[1]
     foreign_run = await client.get(
         f"/api/v1/compile/runs/{task_ids[0]}", params={"compile_name": name}
```

---

### Incident Patch 3: `000f0765` (2026-11-21)
**Commit Message**: fix(react): refresh preview permissions with file tree (#8156)

**File**: `frontend/.changeset/file-browser-refresh-permissions.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+'@openviking/react': patch
+---
+
+## en-US
+
+Refresh the active resource's permission label and edit action when the file tree is refreshed, including grants changed elsewhere. Outdated permission responses from earlier refreshes cannot overwrite the latest result.
+
+## zh-CN
+
+刷新目录树时同步重新查询当前资源权限，使外部授权变更可更新权限标签和编辑入口。旧刷新请求的响应不会覆盖最新权限。
```

**File**: `frontend/docs/docs/_demos/file-browser-acl.tsx` (modified, +2/-5)
```diff
@@ -12,14 +12,13 @@ export default function FileBrowserAclDemo() {
   const locale = useLang() === 'zh' ? 'zh-CN' : 'en-US';
   const zh = locale === 'zh-CN';
   const [demo] = useState(createAclDemo);
-  const [revision, setRevision] = useState(0);
   const [hideDeniedEntries, setHideDeniedEntries] = useState(false);
   return (
     <div lang={locale}>
       <p>
         {zh
-          ? '离线模拟数据 · 不修改真实授权。'
-          : 'Offline simulation · no real grants are changed.'}
+          ? '离线模拟数据 · 切换当前权限后点击刷新，不修改真实授权。'
+          : 'Offline simulation · change the permission, then click Refresh. No real grants are changed.'}
       </p>
       <div
         style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}
@@ -49,7 +48,6 @@ export default function FileBrowserAclDemo() {
             onChange={([value]) => {
               if (value === undefined) return;
               demo.setLevel(value);
-              setRevision((value) => value + 1);
             }}
           >
             <SelectOption value="manage">
@@ -67,7 +65,6 @@ export default function FileBrowserAclDemo() {
       <div style={{ height: 580 }}>
         <OpenVikingProvider fetch={demo.fetch} accountId="demo" userId="alice">
           <FileBrowser
-            key={revision}
             acl
             hideDeniedEntries={hideDeniedEntries}
             locale={locale}
```

**File**: `frontend/docs/docs/en/modules/file-browser.mdx` (modified, +1/-1)
```diff
@@ -517,7 +517,7 @@ All fields are optional, and omitted fields follow `locale`.
 - The dashboard tab is hidden while editing a file and returns after saving or cancelling.
 - Saving a Wiki file shows a progress notice in the upper right, followed by a success notice if the write succeeds. Wiki saves send `use_snapshot: true` to preserve version history and `resolve_conflicts: true` so the server preserves and updates conflict records. Ordinary text saves leave snapshots disabled by default.
 - All YAML frontmatter, ordinary HTML comments and fenced Markdown examples survive. In a Markdown file with confirmed scope, an unclosed reserved trailer starting on its own line is hidden through the end of the file; markers quoted in YAML frontmatter, code fences or inline examples survive.
-- The refresh button reloads the expanded directories and the current preview.
+- The refresh button reloads the expanded directories, the current preview and its effective permissions.
 
 ### Open and reveal a resource
 
```

**File**: `frontend/docs/docs/zh/modules/file-browser.mdx` (modified, +1/-1)
```diff
@@ -517,7 +517,7 @@ import '@openviking/react/modules/file-browser/style.css';
 - 编辑文件时隐藏看板页签，保存或取消后恢复显示。
 - 保存 Wiki 文件时，右上角显示保存进度，写入成功后显示「保存成功」。请求携带 `use_snapshot: true` 创建历史快照，并通过 `resolve_conflicts: true` 交由服务端保留、更新冲突记录；普通文本保存默认不创建快照。
 - 所有 YAML 头、普通 HTML 注释和 Markdown 代码围栏中的示例保留；已确认作用域的 Markdown 文件中，独占一行的未闭合保留尾注隐藏至文件末尾；YAML 头、代码围栏和行内示例中的标记保留。
-- 刷新按钮重新加载已展开的目录和当前预览。
+- 刷新按钮重新加载已展开的目录、当前预览及其有效权限。
 
 ### 打开并定位资源
 
```

**File**: `frontend/packages/react/src/modules/file-browser/acl/use-acl-manager.ts` (modified, +5/-3)
```diff
@@ -4,12 +4,14 @@ import type { FileBrowserAclLevel } from '../acl-types.js';
 /** Revalidate the active resource before opening its permission manager. */
 export function useAclManager({
   key,
+  revision,
   uri,
   loadPermission,
   onLevel,
   onError,
 }: {
   key: string;
+  revision: number;
   uri: string | null;
   loadPermission: (
     uri: string,
@@ -19,14 +21,14 @@ export function useAclManager({
   onError: () => void;
 }) {
   const pending = useRef<AbortController | null>(null);
-  // The probe outlives its click. Abort on resource/request scope changes or
-  // unmount so an old account cannot open a manager in the new scope.
+  // The probe outlives its click. Abort on a new server-permission revision,
+  // resource/request scope change or unmount so stale access cannot reopen it.
   useEffect(
     () => () => {
       pending.current?.abort();
       pending.current = null;
     },
-    [key, loadPermission],
+    [key, revision, loadPermission],
   );
   return async () => {
     if (!uri || pending.current) return;
```

**File**: `frontend/packages/react/src/modules/file-browser/file-browser-content.tsx` (modified, +3/-3)
```diff
@@ -91,7 +91,6 @@ export const FileBrowserContent: FileBrowserComponent = forwardRef<
   // rather than discarded, so the tree returns to where it was dragged once the
   // container widens again.
   const treeMaxWidth = resolveTreeMaxWidth(width);
-  const treeWidth = Math.min(preferredTreeWidth, treeMaxWidth);
 
   // Keep preview and summary copy stable until locale or host overrides change.
   const { summaryLabels, previewLabels } = useMemo(
@@ -128,6 +127,7 @@ export const FileBrowserContent: FileBrowserComponent = forwardRef<
     locale,
     labels: labels?.acl,
     requestOptions,
+    refreshGeneration: browser.refreshGeneration,
     refresh: browser.actions.refresh,
   });
   const pack = usePackImportPicker(layoutRef, text, locale, permissions);
@@ -158,7 +158,7 @@ export const FileBrowserContent: FileBrowserComponent = forwardRef<
             // 分隔条是独立一列，树宽只作用在自己身上，两者相加才是左栏占用。
             // The divider is its own column: the tree width applies to the tree alone
             // and the two together are what the left side occupies.
-            '--ov-file-browser-tree-width': `${treeWidth}px`,
+            '--ov-file-browser-tree-width': `${Math.min(preferredTreeWidth, treeMaxWidth)}px`,
           } as CSSProperties
         }
       >
@@ -194,7 +194,7 @@ export const FileBrowserContent: FileBrowserComponent = forwardRef<
             label={text.resizeTree}
             min={TREE_MIN_WIDTH}
             max={treeMaxWidth}
-            value={treeWidth}
+            value={Math.min(preferredTreeWidth, treeMaxWidth)}
             onResize={setPreferredTreeWidth}
             className="ov-file-browser__resizer"
           />
```

**File**: `frontend/packages/react/src/modules/file-browser/file-browser-state-types.ts` (modified, +2/-0)
```diff
@@ -36,6 +36,8 @@ export interface FileBrowserApi {
   currentUri: string | null;
   /** 刷新是否进行中。Whether a refresh is running. */
   refreshing: boolean;
+  /** 树和当前预览共用的刷新次数。Refresh revision shared by the tree and active preview. */
+  refreshGeneration: number;
   /** 预览字符数文案。Localized preview character count. */
   previewFooter?: string;
   /** 当前资源的更新时间（ISO 8601）。Update time of the current resource (ISO 8601). */
```

**File**: `frontend/packages/react/src/modules/file-browser/use-file-browser-acl.tsx` (modified, +11/-9)
```diff
@@ -28,6 +28,7 @@ export function useFileBrowserAcl({
   locale,
   labels,
   requestOptions,
+  refreshGeneration: revision,
   refresh,
 }: {
   uri: string | null;
@@ -36,6 +37,7 @@ export function useFileBrowserAcl({
   locale: Locale;
   labels?: FileBrowserAclLabels;
   requestOptions?: OvRequestOptions;
+  refreshGeneration: number;
   refresh: () => Promise<void>;
 }) {
   const client = useOvClient();
@@ -45,7 +47,7 @@ export function useFileBrowserAcl({
   const signal = requestOptions?.signal ?? inheritedSignal;
   const options = typeof acl === 'object' ? acl : undefined;
   const key = scopeKeyOf(client, requestOptions, uri ?? undefined);
-  const [permission, setPermission] = useState<{
+  const [access, setPermission] = useState<{
     key: string;
     level?: FileBrowserAclLevel;
     error?: boolean;
@@ -112,9 +114,10 @@ export function useFileBrowserAcl({
     },
     [aclEnabled, loadPermission, readOnly],
   );
-  // Sync the active resource with the permission service, including navigation
-  // and account changes that do not originate in a click. Abort on scope change
-  // or unmount; aborted responses never publish a permission for the next scope.
+  // Sync the active resource with the permission service on navigation, account
+  // changes and explicit refresh, even when the selected URI stays the same.
+  // The server owns grants, so rendering cannot derive them. Abort on refresh,
+  // scope change or unmount so an older response cannot publish stale access.
   useEffect(() => {
     if (!enabled || !uri) return;
     const controller = new AbortController();
@@ -129,15 +132,15 @@ export function useFileBrowserAcl({
       },
     );
     return () => controller.abort();
-  }, [enabled, key, uri, signal, generation, loadPermission]);
-  const level =
-    enabled && permission?.key === key ? permission.level : undefined;
+  }, [enabled, key, uri, signal, generation, revision, loadPermission]);
+  const level = enabled && access?.key === key ? access.level : undefined;
   const text = aclLabels(locale, labels);
   // Pending saves may finish after the host changes its locale or labels.
   const currentText = useRef(text);
   currentText.current = text;
   const openManager = useAclManager({
     key,
+    revision,
     uri,
     loadPermission,
     onLevel: (current) => {
@@ -158,7 +161,7 @@ export function useFileBrowserAcl({
     canDelete: !enabled || level === 'manage',
     canEdit: !enabled || level === 'write' || level === 'manage',
     titleExtra:
-      enabled && permission?.key === key && permission.error ? (
+      enabled && access?.key === key && access.error ? (
         <AclPermissionError
           text={text}
           onRetry={() => setGeneration((value) => value + 1)}
@@ -198,7 +201,6 @@ export function useFileBrowserAcl({
                 options?.onChange?.(report);
               } catch {
                 // A host notification cannot undo a successful server mutation.
-                return;
               }
             }}
           />
```

#### Recent Merged Pull Requests:
- **PR #8166** (2026-11-21): fix(compile): persist cancellation of queued runs (@FuJiaJie123)
- **PR #8156** (2026-11-21): fix(react): refresh preview permissions with file tree (@leowld)
- **PR #8152** (2026-11-21): fix(react): distinguish compile and experience dashboard colors (@leowld)
- **PR #8146** (2026-11-21): fix(storage): backport effective file access metadata to v0.5.5 (@leowld)
- **PR #8141** (2026-11-21): fix(react): only offer ovpack export for directories (@leowld)
- **PR #8140** (2026-11-21): fix(react): keep ACL search placeholder stable (@leowld)

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

## X. crypto): reject malformed local root key files

**RULE**:
When implementing operations in `openviking/crypto/providers.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a0c00a4f`: crypto): reject malformed local root key files. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `openviking/crypto/providers.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
                root_key = bytes.fromhex(hex_key)
            # A truncated or hand-edited key file must not silently become a
            # shorter root key: the account keys derived from it would encrypt
            # new files under a key the real 32-byte root key cannot open.
            if len(root_key) != 32:
                raise ConfigError(
                    f"Invalid root key in {self.key_file}: expected 32 bytes, got {len(root_key)}"
                )
            return root_key
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
                return bytes.fromhex(hex_key)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a0c00a4f` are properly handled with clean fallback behavior.
