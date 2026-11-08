> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source**: github ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Source Version**: `4bd28b57`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T23:12:42.709Z  
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
> **Harvest Timestamp**: 2026-11-08T23:12:42.562Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41813 stars

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
- **Issue #6985** (2026-11-04): **[Bug]: auto-commit policy silently truncates fractional and boolean thresholds**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  `AutoCommitPolicy.from_dict()` validates fields described as integers by calling `int(value)` in `_coerce_int()`. A fractional JSON number is silently truncated; e.g. `message_count_threshold: 0.5` becomes `0`, which disables message-count auto-commit. A JSON boolean also becomes an integer (`true` -> `1`). `validate_idle_timeout_input()` has the same truncation behavior. The server configuration validator passes a raw policy dict to these functions, so this can change user-supplied configuration semantics without an error.  ### Steps to Reproduce  1. On main commit `5760af6ff41fdc7b74056a7b408807ee7cdbc9b1`, run the example below against `openviking.session.auto_commit_policy`. 2. Observe that fractional and boolean values are accepted and changed. I executed the current policy module locally in isolation, with only its `InvalidArgumentError` import stubbed; I did not start the full server.  ### Expected Behavior  Reject fractional numbers and booleans for integer policy fields with a clear validation error. Keep the existing documented bounds/clamping for valid integers, if intended. Invalid input must not silently disable or accelerate auto-commit.  ### Actual Behavior  `{"message_count_threshold": 0.5}` becomes `message_count_threshold=0`; `{"idle_timeout_seconds": 300.9}` becomes `300`; `{"message_count_threshold": true}` becomes `1`. There is no error, despite the validation message say

- **Issue #6984** (2026-11-04): **[Bug]: CSV/TSV tool-result synopsis materializes every row before externalization**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  Large CSV/TSV tool outputs are meant to be externalized, but `openviking/session/tool_result_synopsis.py::_try_table()` calls `list(csv.reader(...))` and then builds a second list of nonempty rows. `ToolOutputExternalizer.prepared_externalized_preview()` calls this synopsis generator before externalizing an oversized tool result. This creates a large transient allocation on the path intended to handle large results.  ### Steps to Reproduce  1. On main commit `5760af6ff41fdc7b74056a7b408807ee7cdbc9b1`, run the example below against `openviking.session.tool_result_synopsis`. 2. Observe peak Python allocations after the CSV string has already been created. I ran the current module in isolation; I did not start the full server.  ### Expected Behavior  Count rows and retain only the header, first data row, and small validation window. Additional peak memory should remain bounded rather than scale with the total parsed table size.  ### Actual Behavior  An 8.69 MB CSV string (100,000 rows, two columns) caused 71.35 MB of additional peak Python allocations under Python 3.11.8 on Windows. The synopsis itself only reports row and column counts and a short sample.  ### Minimal Reproducible Example  ```python import tracemalloc from openviking.session.tool_result_synopsis import generate_tool_result_synopsis  content = "id,value\n" + "".join(f"{i}," + "x" * 80 + "\n" for i in range(100_000)) tracemalloc.

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

### Incident Patch 1: `4bd28b57` (2026-11-08)
**Commit Message**: feat(ui): align the scope switcher with the console design (#7228)

* feat(ui): align the scope switcher with the console design

The component still carried the geometry of an earlier draft and a single
`level` object holding 23 fields of four different kinds. Rework both, using
the console design and the host implementation as the reference.

Visual alignment:

- The row is 32px tall with no outline; each level is its own 32px tall,
  16px radius pill with 8px horizontal padding and an 8px icon-to-label gap.
  Labels are 13px at weight 500.
- A level paints its outline in the primary colour on hover, focus and expand,
  and keeps a transparent outline at rest so nothing shifts when it appears.
- The panel is 272px wide with 8px padding, a 12px radius and a 1px
  `#edeef2` outline; rows are 44px tall with a 2px gap, so two hover tints
  never merge into one shape.
- A selected row bolds its label and keeps the label colour: the design
  separates selection by weight and tint, not by colour. Search hits are
  tinted in the primary colour rather than highlighted in yellow.
- The list caps at 288px and scrolls inside the panel. A host `renderPanel`
  shares the same cap, so taking ov

**File**: `frontend/docs/docs/_demos/assets/scope-switcher/README.md` (removed, +0/-9)
```diff
@@ -1,9 +0,0 @@
-# Scope switcher example assets
-
-Unmodified SVG exports from the user-provided [OpenViking Console design](https://www.figma.com/design/ecpd1ZGHKRYibm1ODKEpM6/OpenViking-Console?node-id=10325-138037), under the repository license.
-
-- `space.svg`: `I10325:138037;9343:425924`, 14 × 14.
-- `user.svg`: `I10325:138037;9343:425954`, 14 × 14.
-- `library-0.svg` through `library-7.svg`: the two masks and six original layers of `I10325:138037;9343:425894`. Composed at 14 × 14 in `scope-switcher-icons.tsx`, preserving each SVG's intrinsic dimensions.
-
-These are host-provided example icons; the reusable component still accepts `icon` as a React node.
```

**File**: `frontend/docs/docs/_demos/assets/scope-switcher/library-0.svg` (removed, +0/-11)
```diff
@@ -1,11 +0,0 @@
-<svg preserveAspectRatio="none" overflow="visible" style="display: block;" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
-<g id="Group">
-<path id="Vector" d="M14 0H0V14H14V0Z" fill="url(#paint0_radial_0_144)"/>
-</g>
-<defs>
-<radialGradient id="paint0_radial_0_144" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(7 7) scale(7)">
-<stop offset="0.984375" stop-color="white"/>
-<stop offset="1" stop-color="white" stop-opacity="0"/>
-</radialGradient>
-</defs>
-</svg>
```

**File**: `frontend/docs/docs/_demos/assets/scope-switcher/library-1.svg` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
-<svg preserveAspectRatio="none" overflow="visible" style="display: block;" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
-<g id="clip-oreo-5f6o93">
-<path id="Vector" d="M14 7C14 3.13401 10.866 0 7 0C3.13401 0 0 3.13401 0 7C0 10.866 3.13401 14 7 14C10.866 14 14 10.866 14 7Z" fill="black"/>
-</g>
-</svg>
```

**File**: `frontend/docs/docs/_demos/assets/scope-switcher/library-2.svg` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
-<svg preserveAspectRatio="none" overflow="visible" style="display: block;" width="14.0131" height="14.0131" viewBox="0 0 14.0131 14.0131" fill="none" xmlns="http://www.w3.org/2000/svg">
-<g id="Group">
-<path id="Vector" d="M10.4541 0H3.55906C1.59345 0 0 1.59345 0 3.55906V10.4541C0 12.4197 1.59345 14.0131 3.55906 14.0131H10.4541C12.4197 14.0131 14.0131 12.4197 14.0131 10.4541V3.55906C14.0131 1.59345 12.4197 0 10.4541 0Z" fill="#031A05"/>
-</g>
-</svg>
```

**File**: `frontend/docs/docs/_demos/assets/scope-switcher/library-3.svg` (removed, +0/-30)
```diff
@@ -1,30 +0,0 @@
-<svg preserveAspectRatio="none" overflow="visible" style="display: block;" width="17.6006" height="17.6006" viewBox="0 0 17.6006 17.6006" fill="none" xmlns="http://www.w3.org/2000/svg">
-<g id="Group" opacity="0.42">
-<g id="Vector" opacity="0.38" filter="url(#filter0_f_0_136)">
-<path d="M5.35258 2.05623H12.2476C14.0682 2.05623 15.5441 3.53215 15.5441 5.35279V12.2478C15.5441 14.0684 14.0682 15.5444 12.2476 15.5444H5.35258C3.53194 15.5444 2.05602 14.0684 2.05602 12.2478V5.35279C2.05602 3.53215 3.53194 2.05623 5.35258 2.05623Z" stroke-width="0.30625" stroke="white"/>
-</g>
-<g id="Vector_2" opacity="0.24" filter="url(#filter1_f_0_136)">
-<path d="M5.35281 2.23125H12.2478C13.9718 2.23125 15.3694 3.62882 15.3694 5.35281V12.2478C15.3694 13.9718 13.9718 15.3694 12.2478 15.3694H5.35281C3.62882 15.3694 2.23125 13.9718 2.23125 12.2478V5.35281C2.23125 3.62882 3.62882 2.23125 5.35281 2.23125Z" stroke-width="0.525" stroke="#FFDFDA"/>
-</g>
-<g id="Vector_3" opacity="0.18" filter="url(#filter2_f_0_136)">
-<path d="M5.35281 2.66875H12.2478C13.7302 2.66875 14.9319 3.87045 14.9319 5.35281V12.2478C14.9319 13.7302 13.7302 14.9319 12.2478 14.9319H5.35281C3.87045 14.9319 2.66875 13.7302 2.66875 12.2478V5.35281C2.66875 3.87045 3.87045 2.66875 5.35281 2.66875Z" stroke-width="0.875" stroke="#FFBE74"/>
-</g>
-</g>
-<defs>
-<filter id="filter0_f_0_136" x="1.42164" y="1.42186" width="14.7569" height="14.7569" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
-<feFlood flood-opacity="0" result="BackgroundImageFix"/>
-<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
-<feGaussianBlur stdDeviation="0.240625" result="effect1_foregroundBlur_0_136"/>
-</filter>
-<filter id="filter1_f_0_136" x="0.56875" y="0.56875" width="16.4631" height="16.4631" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
-<feFlood flood-opacity="0" result="BackgroundImageFix"/>
-<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
-<feGaussianBlur stdDeviation="0.7" result="effect1_foregroundBlur_0_136"/>
-</filter>
-<filter id="filter2_f_0_136" x="0" y="0" width="17.6006" height="17.6006" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
-<feFlood flood-opacity="0" result="BackgroundImageFix"/>
-<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
-<feGaussianBlur stdDeviation="1.11563" result="effect1_foregroundBlur_0_136"/>
-</filter>
-</defs>
-</svg>
```

**File**: `frontend/docs/docs/_demos/assets/scope-switcher/library-4.svg` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
-<svg preserveAspectRatio="none" overflow="visible" style="display: block;" width="15.3497" height="16.3494" viewBox="0 0 15.3497 16.3494" fill="none" xmlns="http://www.w3.org/2000/svg">
-<g id="Group">
-<path id="Vector" d="M11.7906 0H3.55906C1.59345 0 0 1.59345 0 3.55906V12.7903C0 14.7559 1.59345 16.3494 3.55906 16.3494H11.7906C13.7562 16.3494 15.3497 14.7559 15.3497 12.7903V3.55906C15.3497 1.59345 13.7562 0 11.7906 0Z" fill="#FFAAAA"/>
-</g>
-</svg>
```

**File**: `frontend/docs/docs/_demos/assets/scope-switcher/library-5.svg` (removed, +0/-30)
```diff
@@ -1,30 +0,0 @@
-<svg preserveAspectRatio="none" overflow="visible" style="display: block;" width="18.9372" height="19.9369" viewBox="0 0 18.9372 19.9369" fill="none" xmlns="http://www.w3.org/2000/svg">
-<g id="Group" opacity="0.36">
-<g id="Vector" opacity="0.38" filter="url(#filter0_f_0_128)">
-<path d="M5.35282 2.05623H13.5844C15.405 2.05623 16.881 3.53215 16.881 5.35279V14.584C16.881 16.4047 15.405 17.8806 13.5844 17.8806H5.35282C3.53218 17.8806 2.05626 16.4047 2.05626 14.584V5.35279C2.05626 3.53215 3.53218 2.05623 5.35282 2.05623Z" stroke-width="0.30625" stroke="white"/>
-</g>
-<g id="Vector_2" opacity="0.24" filter="url(#filter1_f_0_128)">
-<path d="M5.35281 2.23125H13.5844C15.3084 2.23125 16.7059 3.62882 16.7059 5.35281V14.5841C16.7059 16.3081 15.3084 17.7056 13.5844 17.7056H5.35281C3.62882 17.7056 2.23125 16.3081 2.23125 14.5841V5.35281C2.23125 3.62882 3.62882 2.23125 5.35281 2.23125Z" stroke-width="0.525" stroke="#FFDFDA"/>
-</g>
-<g id="Vector_3" opacity="0.18" filter="url(#filter2_f_0_128)">
-<path d="M5.35281 2.66875H13.5844C15.0667 2.66875 16.2684 3.87045 16.2684 5.35281V14.5841C16.2684 16.0664 15.0667 17.2681 13.5844 17.2681H5.35281C3.87045 17.2681 2.66875 16.0664 2.66875 14.5841V5.35281C2.66875 3.87045 3.87045 2.66875 5.35281 2.66875Z" stroke-width="0.875" stroke="#FFBE74"/>
-</g>
-</g>
-<defs>
-<filter id="filter0_f_0_128" x="1.42189" y="1.42186" width="16.0934" height="17.0931" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
-<feFlood flood-opacity="0" result="BackgroundImageFix"/>
-<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
-<feGaussianBlur stdDeviation="0.240625" result="effect1_foregroundBlur_0_128"/>
-</filter>
-<filter id="filter1_f_0_128" x="0.56875" y="0.56875" width="17.7997" height="18.7994" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
-<feFlood flood-opacity="0" result="BackgroundImageFix"/>
-<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
-<feGaussianBlur stdDeviation="0.7" result="effect1_foregroundBlur_0_128"/>
-</filter>
-<filter id="filter2_f_0_128" x="0" y="0" width="18.9372" height="19.9369" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
-<feFlood flood-opacity="0" result="BackgroundImageFix"/>
-<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
-<feGaussianBlur stdDeviation="1.11563" result="effect1_foregroundBlur_0_128"/>
-</filter>
-</defs>
-</svg>
```

**File**: `frontend/docs/docs/_demos/assets/scope-switcher/library-6.svg` (removed, +0/-18)
```diff
@@ -1,18 +0,0 @@
-<svg preserveAspectRatio="none" overflow="visible" style="display: block;" width="19.7901" height="18.6675" viewBox="0 0 19.7901 18.6675" fill="none" xmlns="http://www.w3.org/2000/svg">
-<g id="Group">
-<g id="Vector" opacity="0.922" filter="url(#filter0_f_0_126)">
-<path d="M17.5588 9.33373C17.5588 5.41114 14.1276 2.23125 9.89505 2.23125C5.66245 2.23125 2.23125 5.41114 2.23125 9.33373C2.23125 13.2563 5.66245 16.4362 9.89505 16.4362C14.1276 16.4362 17.5588 13.2563 17.5588 9.33373Z" fill="url(#paint0_linear_0_126)"/>
-</g>
-</g>
-<defs>
-<filter id="filter0_f_0_126" x="5.90506e-08" y="1.11646e-08" width="19.7901" height="18.6675" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
-<feFlood flood-opacity="0" result="BackgroundImageFix"/>
-<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
-<feGaussianBlur stdDeviation="1.11563" result="effect1_foregroundBlur_0_126"/>
-</filter>
-<linearGradient id="paint0_linear_0_126" x1="2.23125" y1="2.23125" x2="2.23125" y2="16.4362" gradientUnits="userSpaceOnUse">
-<stop stop-color="#FEE9F5"/>
-<stop offset="1" stop-color="#F8F8F8"/>
-</linearGradient>
-</defs>
-</svg>
```

---

### Incident Patch 2: `14ce455d` (2026-11-08)
**Commit Message**: feat(ui): 实现文件预览组件并建立包级主题基线 (#7225)

* chore(ui): 清空 file-preview 实现，保留入口与样式占位

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

* feat(ui): 实现文件预览组件

外壳（页签行、逐段可点面包屑、视图切换、编辑）自绘，正文交给
FileViewerCore 按格式渲染，支持文本、文档、图片与音视频。

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

* refactor(ui): 复用图标集并收窄文件预览的主题变量

页签图标改用 getFileTypeIcon，未命中时由图标集回退，不再维护本地映射。
主题变量加 --ov-ui-file-preview- 前缀并集中声明，避免与包内其他组件冲突。

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

* fix(ui): 构建时不再清空 dist

`rslib build` 默认 `cleanDistPath: 'auto'`，每次构建前清空 `dist/`，重建
期间产物短暂消失。文档站的 dev server 正盯着这个目录，一旦在那几毫秒里
解析模块就报「找不到模块」，且文件回来后不会自动恢复。

产物文件名稳定、就地覆盖，因此改为不清空；需要干净构建时用新增的
`npm run clean:lib`。

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

* feat(ui): 建立包级主题基线并让各组件从基线取色

组件此前各自定义颜色：文件树用中灰加透明度、文件预览另起一套、作用域选择
与文件浏览器又用第三套 `--ov-ui-color-*`，其中主色默认值还分成蓝色与紫色
两种。宿主想统一换肤时无从下手。

新增 `packages/react/src/theme.css`，一套 `--ov-ui-color-*` 变量覆盖主色、
文字、边框、底色、语义色与浮层，取值对齐 OpenViking 控制台的设计规范
（Arco 主题包 `theme-ve-o-aml-design`，只取色值不引入其组件样式）。声明在
各组件的根选择器上而非 `:root`，库仍不修改宿主的全局样式。

文件树、文件预览、作用域选择、TUI、AgentConnect、文件浏览器与模块占位视图
的颜色全部改为从基线派生，组件私有变量只保留几何量与组件独有语义。旧的
三套并行变量名一并清除。各样式入口（整包、分类、单组件）都先引基线，保证
独立消费时也有默认值。

暗色只认宿主放在 `<html>` 上的 `.dark` 类，不读 `prefers

**File**: `docs/en/api/26-mcp-live-context.md` (modified, +1/-1)
```diff
@@ -177,7 +177,7 @@ With `wait=false`, the registration result may also contain the underlying catal
 
 ### List, inspect, and check status
 
-Without `target_uri`, `GET /api/v1/mcps` merges user and shared servers and identifies each entry with `root_uri`. `GET /api/v1/mcps/{name}` and status default to the user space; pass `target_uri=viking://agent/tools` for a same-named shared server. A connection failure still has a successful HTTP envelope, but `result.status` is `error`.
+Without `target_uri`, `GET /api/v1/mcps` merges user and shared servers and identifies each entry with `root_uri`. `GET /api/v1/mcps/{name}` and `GET /api/v1/mcps/status?name=...` default to the user space; pass `target_uri=viking://agent/tools` for a same-named shared server. A connection failure still has a successful HTTP envelope, but `result.status` is `error`.
 
 **SDK and CLI**
 
```

**File**: `docs/zh/api/26-mcp-live-context.md` (modified, +1/-1)
```diff
@@ -176,7 +176,7 @@ ov mcps add -p viking://agent/tools --wait '{"mcpServers":{"weather":{"url":"htt
 
 ### 列出、查看和检查状态
 
-`GET /api/v1/mcps` 未指定 `target_uri` 时合并用户空间和共享空间的 Server，每项用 `root_uri` 标识所属空间。`GET /api/v1/mcps/{name}` 和状态接口默认操作用户空间；使用同名共享 Server 时必须指定 `target_uri=viking://agent/tools`。连接失败仍是成功的 HTTP 响应，但 `result.status` 为 `error`。
+`GET /api/v1/mcps` 未指定 `target_uri` 时合并用户空间和共享空间的 Server，每项用 `root_uri` 标识所属空间。`GET /api/v1/mcps/{name}` 和 `GET /api/v1/mcps/status?name=...` 默认操作用户空间；使用同名共享 Server 时必须指定 `target_uri=viking://agent/tools`。连接失败仍是成功的 HTTP 响应，但 `result.status` 为 `error`。
 
 **SDK 与 CLI**
 
```

**File**: `frontend/.gitignore` (modified, +4/-0)
```diff
@@ -3,6 +3,10 @@
 
 node_modules/
 dist/
+
+# Playwright CLI 的会话快照与日志，不属于源码。
+# Playwright CLI session snapshots and logs, not source.
+.playwright-cli/
 doc_build/
 .rspress/
 .rspress-cache/
```

**File**: `frontend/AGENTS.md` (modified, +5/-1)
```diff
@@ -19,11 +19,15 @@
 - React 源码的 `components/` 放独立视图组件，`modules/` 放按业务能力划分的 Hook 与组合视图，不提供完整页面。模块 Hook 暴露可独立消费的数据、状态与操作，组合视图复用 Hook 并组装组件；宿主差异通过服务契约、参数、回调与插槽接入。当前先提供四个模块的占位组件、基础类型与样式入口，便于宿主接入布局；真实业务与 Hook 随后迁入，占位状态和 API 范围须在示例与文档中明确。可独立部署的微应用放在 `apps/`，例如 `apps/workbench-embed/`，消费公开模块与组件，管理挂载、卸载、样式隔离和宿主通信。
 - 每个组件、业务模块或区块独占一个 kebab-case 目录，入口文件与目录同名。实现、样式、测试及私有子组件就近放置，例如 `components/<模块>/<模块>.tsx` 和同目录的 `<模块>.css`。模块私有的 Hook、类型和工具留在模块内，不提前提升到公共目录。
 - 根入口与子路径分别维护公开导出；组件子路径为 `@openviking/react/components/<组件>`，业务模块为 `@openviking/react/modules/<模块>`，从模块入口分别导出 Hook 与组合视图。不提供 `components`、`modules` 分类聚合 JS 入口。包导出显式列举，内部文件不开放；各入口共享实现，避免重复创建 Provider、Context 或状态对象。同步维护 Rslib 入口和声明路径。
+- 被多个组件共用的内部代码放在 `src/shared/`，**不设公开入口**：不进包根导出、不进子路径、不写进 `package.json` 的 `exports`。只有出现第二个真实消费者时才提升到这里；单个组件用到的东西留在该组件目录内。共享代码不得反向依赖 `components/`、`modules/` 或任何宿主契约。
 - 目录按实际内容创建，不预建空目录，也不为单个简单模块增加不必要的转发层。
 
 ## 样式与交互
 
 - 库样式局部化，类名使用 `ov-` 前缀加 BEM 命名（块 `.ov-file-tree`，元素 `.ov-file-tree__row`，修饰 `.ov-file-preview__button--primary`），主题变量使用 `--ov-ui-` 前缀。消费者无需额外扫描库源码生成 Tailwind CSS，也不承担库的全局 reset；库样式不修改应用的 `html`、`body`、`:root` 或 `.dark`。
+- **颜色一律取自主题基线，不要在组件里另写色值。** 包级基线在 `packages/react/src/theme.css`，是一套 `--ov-ui-color-*` 变量（主色、文字、边框、底色、语义色、浮层），取值来自 OpenViking 控制台的设计规范。新写或改动样式时先看基线里有没有对应语义的变量；有就直接用，没有就先往基线里补一条，再在组件里引用。不要在组件 CSS 里写 `#5252ff`、`rgb(0 0 0 / 8%)` 这类字面值——它们不会跟随宿主主题切换，也无法被宿主统一覆盖。
+- 组件私有变量用 `--ov-ui-<组件>-*` 前缀，值从基线派生（`--ov-ui-file-preview-accent: var(--ov-ui-color-primary)`），不要重复定义一份色值。只有纯几何量（行高、圆角、缩进）或组件独有的语义（如文件树的层级竖线）才在组件里直接赋值。
+- 暗色只认宿主放在 `<html>` 上的 `.dark` 类，不读 `prefers-color-scheme`：系统偏好与宿主实际呈现的主题可能不一致，跟系统走会让组件底色与周围文字对不上。
 - 文档站的全局样式、布局和主题覆盖只作用于文档站。CSS 同时提供整包 `style.css`、分类 `components/style.css` / `modules/style.css` 和单模块 `<分类>/<模块>/style.css` 入口；JS 不隐式加载样式。各 CSS 入口共用样式源码并可独立消费，模块 CSS 包含当前占位视图及后续组合视图所需组件样式；单独使用 Hook 无需 CSS。保留构建中的 CSS 副作用声明。
 - 复用模块使用实例内状态和引用。持久化、请求缓存等需要跨实例共享的行为通过明确的 Adapter 接入，避免用全局 DOM ID、事件或 singleton Store 隐式关联实例与账号。
 - 公开组件提供可替换的默认文案，动态文案通过类型化参数传入。宿主在接入层映射 i18next 或 Starling。状态通过可见文本表达；可操作控件使用合适的语义、键盘行为和焦点样式。
@@ -32,7 +36,7 @@
 
 - 顶部导航以 Guide、Components 和 OpenViking docs 外链为基础。Guide 承载入门、安装、样式与集成说明；Components 承载视图组件。出现实际内容后再增加 Modules 和 Patterns，分别对应业务 Hook 与组合视图，以及纯视图组合示例；独立 API 栏目在内容需要时再引入。
 - 文档按语言组织在 `docs/docs/en/` 和 `docs/docs/zh/`，各语言内按 `guide/`、`components/`、`modules/`、`patterns/` 分类。业务模块归入 Modules，不把所有模块都归入 Components。
-- 英文为默认语言，保留 `/ui/` 下的原有地址；简体中文使用 `/ui/zh/`。新增或修改文档时同步维护两种语言的页面、导航和侧边栏，保持对应页面路径一致，以支持原位语言切换。可运行示例共用 `docs/docs/_demos/`，不要为翻译复制实现；组件文案仍由调用者定制。
+- 简体中文为默认语言，使用 `/ui/` 下的地址；英文使用 `/ui/en/`。新增或修改文档时同步维护两种语言的页面、导航和侧边栏，保持对应页面路径一致，以支持原位语言切换。可运行示例共用 `docs/docs/_demos/`，不要为翻译复制实现；组件文案仍由调用者定制。
 - 模块分类入口指向该分类的 `index.mdx` 概览，而不是首个模块；侧边栏按路由前缀隔离，仅列出当前分类的概览与详情，并按职责分组。新增分类时同时提供真实内容、概览和导航，不创建空栏目或占位页面。
 - 示例从 `@openviking/react` 的公开导出及样式入口导入，不通过相对路径绕过接口。外部 TSX 示例是可运行代码与源码展示的同一事实源。
 - 开发与正式文档均通过包导出消费实际库产物。开发模式由官方 workspace 插件启动 Rslib watch；不使用源码 alias 或 TypeScript paths 绕过产物解析，以发现缺失导出、CSS 和打包资源等问题。
```

**File**: `frontend/README.md` (modified, +2/-1)
```diff
@@ -16,7 +16,7 @@ npm run dev
 
 Open the `/ui/` URL printed by Rspress. The official workspace development plugin starts the library's Rslib watcher before the documentation server, so no manual library build is required. Demos consume the built package exports and update when the watcher rebuilds them.
 
-The navigation language menu switches between English at `/ui/` and Simplified Chinese at `/ui/zh/`. Existing English URLs remain unchanged.
+The navigation language menu switches between Simplified Chinese at `/ui/` and English at `/ui/en/`.
 
 ```bash
 npm run lint           # Check formatting, lint rules, and types for all workspaces
@@ -34,6 +34,7 @@ npm run preview        # Serve the built documentation at /ui/
 - `packages/react/src/modules/{file-browser,console,task-center}`: importable placeholder components with settled public Props / Labels / Slots types, and styles. Business Hooks and interactions are planned.
 - `packages/react/src/client`: the framework-neutral request client, exported from `@openviking/react/client` — a `fetch`-based `createOvClient` plus the contract modules depend on (`OvClient`, `OvRequestOptions`, `OvClientError`).
 - `packages/react/src/{hooks,utils}`: reserved internal shared code, without public subpaths. Module-private helpers stay within their module.
+- `packages/react/src/shared`: internal shared code used by more than one component, with no public entry — not exported from the root, any subpath, or `package.json`. Currently holds the `tooltip` surface that `file-preview` renders into `document.body`.
 - `docs`: Rspress with `@rspress/plugin-preview`, external TSX demos, source viewing/copying, and hand-written props tables.
 - `docs/docs/en` and `docs/docs/zh`: matching English and Simplified Chinese pages, with localized navigation.
 - `docs/docs/_demos`: runnable examples using the public package exports.
```

**File**: `frontend/docs/docs/_demos/file-preview-basic.tsx` (modified, +228/-24)
```diff
@@ -1,69 +1,273 @@
 import { useState } from 'react';
+import { useLang } from '@rspress/core/runtime';
 import { FilePreview } from '@openviking/react/components/file-preview';
-import type { FilePreviewTab } from '@openviking/react/components/file-preview';
+import type {
+  FilePreviewActions,
+  FilePreviewTab,
+} from '@openviking/react/components/file-preview';
+import { getFileTypeIcon } from '@openviking/react/icons';
 import '@openviking/react/components/file-preview/style.css';
 
-const markdown = `# LLM Wiki
+/**
+ * 示例文案。文档站中英文页面共用这份示例，因此文案跟随页面语言。
+ *
+ * Demo copy. Both language pages share this demo, so the copy follows the page
+ * language.
+ */
+const COPY = {
+  en: {
+    markdown: `# LLM Wiki
 
 Compile heterogeneous knowledge sources into durable, connected knowledge.
 
 ## Objective
 
 Turn the supplied sources into reusable pages instead of a pile of summaries.
-`;
 
-const dashboard = (
-  <div style={{ padding: 16, color: '#8f959e', fontSize: 13 }}>
-    A content tab renders whatever the host passes — a dashboard, a graph, a
-    summary. The component does not know what it is.
-  </div>
-);
+See [the compile notes](viking://system/compile/notes.md) and [a relative page](./sibling.md).
+`,
+    dashboard:
+      'A content tab renders whatever the host passes — a dashboard, a graph, a summary. The component does not know what it is.',
+    dashboardTitle: 'Dashboard',
+    hint: 'Switch tabs, copy the path or the content, or toggle preview and source.',
+    contentCopied: 'Content copied',
+    pathCopied: 'Path copied',
+    permissionTag: 'Can manage',
+    parentOpened: (path: string) => `Simulated parent navigation: ${path}`,
+    linkOpened: (uri: string) => `Simulated link navigation: ${uri}`,
+    saved: 'Content saved',
+    cancelled: 'Editing cancelled',
+    previewLabel: 'File preview',
+    labels: {
+      copyPath: 'Copy path',
+    },
+    // 动作按钮由示例自己渲染，文案也归示例，不经过组件的 labels。
+    actions: {
+      copyContent: 'Copy content',
+      preview: 'Preview',
+      source: 'Source',
+      edit: 'Edit',
+      save: 'Save',
+      cancel: 'Cancel',
+    },
+  },
+  zh: {
+    markdown: `# LLM Wiki
+
+把异构的知识来源编译成可长期使用、彼此关联的知识。
+
+## 目标
+
+把素材变成可复用的页面，而不是一堆摘要。
+
+参见 [编译说明](viking://system/compile/notes.md) 与 [同目录页面](./sibling.md)。
+`,
+    dashboard:
+      '内容页签原样渲染宿主传入的节点——可以是看板、图谱或摘要，组件不关心它是什么。',
+    dashboardTitle: '看板',
+    hint: '切换页签、复制路径或正文，或在预览与源码之间切换。',
+    contentCopied: '正文已复制',
+    pathCopied: '路径已复制',
+    permissionTag: '可管理',
+    parentOpened: (path: string) => `已模拟跳转到上级：${path}`,
+    linkOpened: (uri: string) => `已模拟打开链接：${uri}`,
+    saved: '正文已保存',
+    cancelled: '已取消编辑',
+    previewLabel: '文件预览',
+    labels: {
+      copyPath: '复制路径',
+    },
+    actions: {
+      copyContent: '复制正文',
+      preview: '预览',
+      source: '源码',
+      edit: '编辑',
+      save: '保存',
+      cancel: '取消',
+    },
+  },
+};
+
+const diagramSvg =
+  'data:image/svg+xml;charset=utf-8,' +
+  encodeURIComponent(
+    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140">' +
+      '<rect width="240" height="140" fill="#eef2f8"/>' +
+      '<rect x="20" y="24" width="80" height="36" rx="6" fill="#2563c5"/>' +
+      '<rect x="140" y="24" width="80" height="36" rx="6" fill="#7aa7e8"/>' +
+      '<rect x="80" y="88" width="80" height="30" rx="6" fill="#a9c4ef"/>' +
+      '</svg>',
+  );
 
 export default function FilePreviewBasic() {
+  const lang = useLang() === 'zh' ? 'zh' : 'en';
+  const t = COPY[lang];
   const [activeHint, setActiveHint] = useState('');
-  const [content, setContent] = useState(markdown);
+  // 正文按语言分别保存：切换语言时展示该语言的初始正文，编辑过的内容不丢。
+  const [drafts, setDrafts] = useState<Partial<Record<string, string>>>({});
+  const content = drafts[lang] ?? t.markdown;
+  const setContent = (value: string) =>
+    setDrafts((current) => ({ ...current, [lang]: value }));
+
+  const dashboard = (
+    <div style={{ padding: 16, color: '#8f959e', fontSize: 13 }}>
+      {t.dashboard}
+    </div>
+  );
+
+  // 图标由宿主决定：组件不按文件名推断类型，这里用包的图标集按格式取一个。
+  // The host decides the icon: the component never infers a type from the file
+  // name, so the demo picks one per format from the package icon set.
+  const tabIcon = (fileName: string) => {
+    const Icon = getFileTypeIcon(fileName);
+    return <Icon width={14} height={14} />;
+  };
+
+  // 组件不内置复制、下载、视图切换与编辑按钮，这些由宿主用 `actions` 上下文
+  // 自己渲染。示例演示一个最小实现。
+  // The component ships no copy, download, view-switch or edit buttons; the host
+  // renders them from the `actions` context. This is a minimal implementation.
+  const renderActions = (actions: FilePreviewActions) => (
+    <>
+      {actions.canCopyContent ? (
+        <button
+          type="button"
+          className="ov-file-preview__button"
+          disabled={actions.busy}
+          onClick={() => void actions.copyContent()}
+        >
+          {t.actions.copyContent}
+        </button>
+      ) : null}
+      {actions.canSwitchView ? (
+ 
```

**File**: `frontend/docs/docs/_demos/file-tree-basic.tsx` (modified, +2/-1)
```diff
@@ -327,7 +327,8 @@ export default function FileTreeBasic() {
     [MEMORIES]: childrenOf(MEMORIES).slice(0, PAGE),
   }));
   const [loading, setLoading] = useState<ReadonlySet<string>>(new Set());
-  const [selected, setSelected] = useState<string>();
+  // 默认选中一行，进页面就能看到选中态，不必先点一下。
+  const [selected, setSelected] = useState<string>(`${MEMORIES}/profile.md`);
 
   /** Fetches one more page of children, showing the loading row meanwhile. */
   const loadPage = (uri: string) => {
```

**File**: `frontend/docs/docs/en/components/file-preview.mdx` (modified, +72/-35)
```diff
@@ -19,7 +19,9 @@ Pass at least one tab. A file tab carries `source`; a content tab carries a node
 | `kind: 'file'`    | The component   | A file, its source, a document |
 | `kind: 'content'` | The host, as-is | Dashboards, graphs, summaries  |
 
-Both share the shell — tab row, path breadcrumb, copy path and the header slots. They differ in how the body arrives, and in that the preview/source switch is a file-tab capability: a content tab renders whatever views it needs inside `content`.
+Both share the shell — tab row, path breadcrumb, copy path and the header action area. They differ in how the body arrives, and in that the preview/source switch is a file-tab capability: a content tab renders whatever views it needs inside `content`.
+
+**The component ships no action buttons of its own.** Copy body, copy path, download, the preview/source switch and editing all carry host product semantics and copy; built in they could be neither trimmed nor restyled. Copy path is the exception — any file with a `source.path` needs it under every host, so it stays in the shell at the end of the breadcrumb. Everything else is rendered by the host in `slots.actions`, which receives a `FilePreviewActions` context: the current view mode, editing state, which capabilities are available, and the methods that change them. The state stays with the component.
 
 The active tab is owned by the component. To switch from outside, use the ref handle:
 
@@ -40,11 +42,11 @@ previewRef.current?.setActiveTab('dashboard');
 
 ## States
 
-Loading, failure and unsupported formats are not props — the component decides them from the content and the file name. All three can be replaced through `slots`:
+Loading, failure and unsupported formats are not props: this component decides loading and failure, while whether a format can be previewed is the base component's call. All three can be replaced through `slots`:
 
 - `slots.loadingFallback`
 - `slots.errorFallback`
-- `slots.unsupportedFallback`
+- `slots.unsupportedFallback` — handed to the base, which then owns the whole unsupported state, so the download entry it would otherwise offer no longer appears
 
 The host supplies asynchronous `editing.save` and optional `editing.loadContent` capabilities. `loadContent` returns the full text; `undefined` abandons the edit, and rejection shows a read error. A failed save retains the draft and shows an error. `editing.onSave` only reports a successful save; `editing.onCancel` reports a discarded draft. Saving prevents duplicate submissions and tab changes until completion.
 
@@ -62,37 +64,54 @@ Execution capabilities and notifications are separate. Operation resolution trig
 
 Shared by both kinds:
 
-| Property             | Type                         | Default   | Description                                                                  |
-| -------------------- | ---------------------------- | --------- | ---------------------------------------------------------------------------- |
-| `key`                | `string`                     | Required  | Unique tab key.                                                              |
-| `title`              | `ReactNode`                  | File name | What the tab row shows. Required for content tabs.                           |
-| `icon`               | `ReactNode`                  | By format | Tab icon.                                                                    |
-| `labels`             | `Partial<FilePreviewLabels>` | —         | Overrides the outer copy for this tab.                                       |
-| `disabled`           | `boolean`                    | `false`   | Disables the tab.                                                            |
-| `onOpenParent`       | `(path: string) => void`     | —         | Called after the parent directory opens successfully; not called on failure. |
-| `onCopyPath`         | `(path: string) => void`     | —         | Called after path copying succeeds.                                          |
-| `showViewModeSwitch` | `boolean`                    | `true`    | Preview/source switch; file tabs only.                                       |
-| `slots`              | `FilePreviewHeaderSlots`     | —         | `actions`, `titleExtra`.                                                     |
+| Property       | Type                         | Default   | Description                                                                  |
+| -------------- | ---------------------------- | --------- | ---------------------------------------------------------------------------- |
+| `key`          | `string`                     | Required  | Unique tab key.                                                              |
+| `title`        | `ReactNode`                  | File name | What the tab row shows. Required for content tabs.                           |
+| `icon`         | `ReactNode`                  | —         | Tab icon, supplied by the host;
```

#### Recent Merged Pull Requests:
- **PR #7242** (2026-11-08): docs(vika): link the Windows x64 preview package from README and install guide (@ZaynJarvis)
- **PR #7241** (2026-11-08): fix(vika): retry moving extracted Windows preview into place (@ZaynJarvis)
- **PR #7240** (2026-11-08): fix(vika): load System.IO.Compression in Windows preview scripts (@ZaynJarvis)
- **PR #7239** (2026-11-08): feat(vika): add Windows preview artifacts to release workflow (@openviking-superagent)
- **PR #7236** (2026-11-08): feat(vika): use native PowerShell for Windows Durable tools (@openviking-superagent)
- **PR #7228** (2026-11-08): feat(ui): align the scope switcher with the console design (@LaamGinghong)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
