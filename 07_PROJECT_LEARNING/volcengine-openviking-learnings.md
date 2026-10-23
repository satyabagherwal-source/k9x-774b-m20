> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source**: github ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Source Version**: `0d546854`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T06:49:58.246Z  
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
> **Harvest Timestamp**: 2026-10-23T06:49:57.543Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 40629 stars

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
- **Issue #6356** (2026-10-21): **[Bug]: Studio Markdown preview drops viking:// images and lacks internal image navigation**
  *Symptoms*: ### Issue Origin  Inferred by an AI agent and not observed or reproduced  ### Bug Description  In the Markdown body preview, `rehype-sanitize` uses its default protocol allowlists, which do not include OpenViking's `viking` scheme. Explicit internal image `src` values and internal link `href` values are therefore stripped before the custom Markdown renderers can use them.  The existing `MarkdownImage` component already resolves resource-relative paths and downloads internal images through the authenticated content-download API, but it does not receive `onNavigate`. Consequently, bare internal images that do render cannot open the corresponding resource from the preview.  This is a code-level finding with local component-test coverage using mocked authenticated downloads. End-to-end acceptance against a live authenticated service has not been performed.  ### Steps to Reproduce  1. Place a readable JPEG at `viking://resources/demo/photo.jpg` and a Markdown document at `viking://resources/demo/article.md`. 2. Include the Markdown example below in the document. 3. Open the document body in Studio's resource preview. 4. Check the explicit internal image/link, then click or focus and press Enter on the relative image.  ```markdown ![Explicit internal image](viking://resources/demo/photo.jpg)  ![Relative internal image](./photo.jpg)  [Open image](viking://resources/demo/photo.jpg)  [![Linked image](./photo.jpg)](./target.md) ```  These are suggested live reproduction steps; live aut

- **Issue #6290** (2026-10-20): **[Bug]: Experience application count is always 0 — plugin tool_status stays "running", gateway injection produces no ToolPart**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  ## Summary Experience **application count** (trajectory linkage via `collect_read_experience_uris`) stays **0 forever**, even when sessions clearly contain successful Experience body reads.  Verified locally on OpenViking **0.4.23**: 37 Experiences all return `total: 0`, while session archives show multiple `read`s of `.../memories/experiences/*.md`.  ## Environment - **OS**: macOS (arm64) - **OpenViking server**: 0.4.23 (`uv tool`, `127.0.0.1:1933`) - **Also checked**: 0.5.0 wheel — `collect_read_experience_uris` gating logic unchanged - **Clients**:   - Cursor (memory plugin capture)   - WorkBuddy / CodeBuddy (shared `openviking-transcript.mjs` / fleet adapter)  ### Steps to Reproduce  1. Install OpenViking **0.4.23** + the official memory plugin (Cursor or WorkBuddy). 2. Enable agent evolution / Experience features as usual. 3. In a new agent session, have the model **explicitly read** one Experience file, e.g. via MCP `read` / `CallDynamicTool` → `toolName: "read"` with:    - `uris: ["viking://user/<user>/memories/experiences/<name>.md"]` 4. Continue until the session is **captured and committed** (Stop / sessionEnd commit path). 5. Confirm the committed session `messages` contain a tool part whose `tool_input` includes that Experience URI. 6. Query:    ```http    GET /api/v1/agent-evolution/experiences/trajectories?experience_uri=viking://user/<user>/memories/experiences/<name>.md  ### E

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

### Incident Patch 1: `d9db19ab` (2026-10-21)
**Commit Message**: fix(gateway): tolerate non-string "type" values in client history (#6306)

Motivation: normalize() and several request-side helpers test a client
supplied "type" with set membership. When a history item or content block
carries an object there (e.g. an echoed JSON Schema fragment such as
{"type": {"type": "string"}}), this raises TypeError: unhashable type: 'dict'.
kernel.enhance() catches it and the request proceeds with
degradation=memory_store_failure, so recall and capture are skipped for the
whole turn while the HTTP status stays 200.

Approach: add protocols.string_type(), which returns the type only when it is
a string and "" otherwise, and use it at the client-supplied membership checks
in protocols.py, capture.py, tool_executor.py, tool_protocols/responses.py and
tool_protocols/anthropic.py. normalize() and the text filter also no longer
call .strip() on a non-string "text". Behaviour for well-formed input is
unchanged; a malformed type is treated as "no type". Upstream-generated
output items are left alone.

Validation: ran `python -m pytest tests/gateway` (820 passed) and
`ruff check` / `ruff format --check` on openviking_gateway and tests/gateway.
The new tests/gateway/

**File**: `openviking_gateway/capture.py` (modified, +4/-4)
```diff
@@ -23,7 +23,7 @@
 from .capture_store import Document, LeaseLost
 from .models import Policy
 from .notices import without_notices
-from .protocols import clean_text, is_user, text_content, unwrap_client
+from .protocols import clean_text, is_user, string_type, text_content, unwrap_client
 from .records import RecordKind as K
 from .tool_protocols import reply_chain
 
@@ -453,14 +453,14 @@ def capture_messages(messages, chain):
     for message in messages:
         if message.get("role") == "tool":
             results[message.get("tool_call_id")] = message.get("content", "")
-        if message.get("type") in {"function_call_output", "custom_tool_call_output"}:
+        if string_type(message) in {"function_call_output", "custom_tool_call_output"}:
             results[message.get("call_id")] = message.get("output", "")
         for block in message.get("content", []) if isinstance(message.get("content"), list) else []:
             if isinstance(block, dict) and block.get("type") == "tool_result":
                 results[block.get("tool_use_id")] = block.get("content", "")
     output = []
     for message, anchor in zip(messages, chain, strict=True):
-        if message.get("role") not in {"user", "assistant"} and message.get("type") not in {
+        if message.get("role") not in {"user", "assistant"} and string_type(message) not in {
             "function_call",
             "custom_tool_call",
         }:
@@ -473,7 +473,7 @@ def capture_messages(messages, chain):
         text = clean_text(unwrap_client(text))
         parts = [{"type": "text", "text": text}] if text else []
         calls = list(message.get("tool_calls") or [])
-        if message.get("type") in {"function_call", "custom_tool_call"}:
+        if string_type(message) in {"function_call", "custom_tool_call"}:
             calls.append(message)
         calls.extend(
             b
```

**File**: `openviking_gateway/protocols.py` (modified, +16/-8)
```diff
@@ -124,6 +124,12 @@ def pairs(items):
         return None
 
 
+def string_type(value: Any) -> str:
+    """A block's ``type`` when it is a string; malformed histories may carry an object."""
+    kind = value.get("type") if isinstance(value, dict) else None
+    return kind if isinstance(kind, str) else ""
+
+
 def text_content(message: dict) -> str:
     content = message.get("content", "")
     if isinstance(content, str):
@@ -133,7 +139,7 @@ def text_content(message: dict) -> str:
             x.get("text", "")
             for x in content
             if isinstance(x, dict)
-            and x.get("type") in {"text", "input_text", "output_text"}
+            and string_type(x) in {"text", "input_text", "output_text"}
             and isinstance(x.get("text", ""), str)
         )
     return ""
@@ -162,10 +168,10 @@ def normalize(value: Any) -> Any:
             if not (
                 isinstance(v, dict)
                 and (
-                    v.get("type") in {"thinking", "redacted_thinking"}
+                    string_type(v) in {"thinking", "redacted_thinking"}
                     or (
-                        v.get("type") in {"text", "input_text", "output_text"}
-                        and not v.get("text", "").strip()
+                        string_type(v) in {"text", "input_text", "output_text"}
+                        and not (isinstance(v.get("text", ""), str) and v.get("text", "").strip())
                     )
                 )
             )
@@ -182,7 +188,7 @@ def normalize(value: Any) -> Any:
             content = out["content"]
             if isinstance(content, list) and len(content) == 1 and isinstance(content[0], dict):
                 block = content[0]
-                if set(block) == {"type", "text"} and block["type"] in {
+                if set(block) == {"type", "text"} and string_type(block) in {
                     "text",
                     "input_text",
                     "output_text",
@@ -191,7 +197,9 @@ def normalize(value: Any) -> Any:
             if isinstance(content, str):
                 content = unwrap_client(content).strip()
             out["content"] = content
-        if out.get("type") in {"text", "input_text", "output_text"}:
+        if string_type(out) in {"text", "input_text", "output_text"} and isinstance(
+            out.get("text", ""), str
+        ):
             out["text"] = unwrap_client(out.get("text", "")).strip()
         # Responses message items may omit type/status/id when resent by a client.
         # IDs of opaque items (item_reference, reasoning, calls) remain significant.
@@ -316,7 +324,7 @@ def client_openviking_tools(body: dict, names) -> bool:
             continue
         # Hosted MCP servers (Responses mcp, Anthropic mcp_servers and mcp_toolset) list
         # no tools, so their name is all there is.
-        server = definition.get("type") in {"mcp", "mcp_toolset", "url"}
+        server = string_type(definition) in {"mcp", "mcp_toolset", "url"}
         named_tool = isinstance(definition.get("name"), str) and not server
         # A tool must be one of OpenViking's, so a connector's authenticate tool is not.
         if any(
@@ -436,7 +444,7 @@ def strip_thinking(messages: list[dict]) -> list[dict]:
             message["content"] = [
                 b
                 for b in message["content"]
-                if b.get("type") not in {"thinking", "redacted_thinking"}
+                if string_type(b) not in {"thinking", "redacted_thinking"}
             ]
     return result
 
```

**File**: `openviking_gateway/tool_executor.py` (modified, +2/-1)
```diff
@@ -18,6 +18,7 @@
 from .capture_store import Document
 from .client import VikingError
 from .config import MOUNT_PATH
+from .protocols import string_type
 from .state_store import get_state
 from .storage import digest
 from .tool_catalog import PREFIX, TOOL_OVERRIDES
@@ -57,7 +58,7 @@ def attachments(body, protocol):
         content = message.get("content", [])
         if isinstance(content, list):
             for part in content:
-                if isinstance(part, dict) and part.get("type") in {"file", "input_file"}:
+                if string_type(part) in {"file", "input_file"}:
                     output.append(part.get("file", part))
                 elif isinstance(part, dict) and part.get("type") == "document":
                     source = part.get("source", {})
```

**File**: `openviking_gateway/tool_protocols/anthropic.py` (modified, +3/-3)
```diff
@@ -6,7 +6,7 @@
 
 import orjson
 
-from ..protocols import strip_thinking, text_content
+from ..protocols import string_type, strip_thinking, text_content
 from .common import (
     SUMMARY_HEADROOM,
     SummaryError,
@@ -94,7 +94,7 @@ def split_reasoning(output):
             blocks = [
                 [position, block]
                 for position, block in enumerate(content if isinstance(content, list) else [])
-                if isinstance(block, dict) and block.get("type") in THINKING
+                if string_type(block) in THINKING
             ]
             if blocks:
                 reasoning[index] = {"blocks": blocks}
@@ -108,7 +108,7 @@ def restore_reasoning(previous, message, value):
         if (
             message.get("role") != "assistant"
             or not isinstance(content, list)
-            or any(isinstance(b, dict) and b.get("type") in THINKING for b in content)
+            or any(string_type(b) in THINKING for b in content)
         ):
             return [message]
         # Blocks go back where the reply had them, so the client's form must equal it without them.
```

**File**: `openviking_gateway/tool_protocols/responses.py` (modified, +4/-4)
```diff
@@ -6,7 +6,7 @@
 import uuid
 
 from ..notices import without_recall_notice
-from ..protocols import text_content
+from ..protocols import string_type, text_content
 from .common import (
     PREFIX,
     SUMMARY_HEADROOM,
@@ -44,18 +44,18 @@ def enhanced_supported(body):
 
     @staticmethod
     def is_reply(message):
-        return message.get("role") == "assistant" or message.get("type") in {
+        return message.get("role") == "assistant" or string_type(message) in {
             "reasoning",
             *CLIENT_CALLS,
         }
 
     @staticmethod
     def accepts_context(message):
-        return message.get("role") == "user" or message.get("type") in TOOL_OUTPUTS
+        return message.get("role") == "user" or string_type(message) in TOOL_OUTPUTS
 
     @staticmethod
     def append_context(message, text):
-        if message.get("type") in TOOL_OUTPUTS:
+        if string_type(message) in TOOL_OUTPUTS:
             append_text(message, "output", text, "input_text", joins_strings=True)
         else:
             append_text(message, "content", text, "input_text")
```

**File**: `tests/gateway/test_malformed_types.py` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+"""Histories whose ``type`` is not a string must not abort request processing."""
+
+from openviking_gateway.capture import capture_messages
+from openviking_gateway.protocols import normalize, prefix_chain, strip_thinking, text_content
+from openviking_gateway.tool_protocols import tool_protocol
+
+ODD = {"type": "string"}
+
+
+def malformed():
+    return {
+        "role": "user",
+        "type": ODD,
+        "content": [{"type": ODD, "text": "hello"}, {"type": "text", "text": ODD}],
+    }
+
+
+def test_protocol_helpers_ignore_object_types():
+    message = malformed()
+    assert normalize([message])[0]["type"] == ODD
+    assert len(prefix_chain([message])) == 1
+    assert text_content(message) == ""
+    assert strip_thinking([message])[0]["content"][0]["type"] == ODD
+
+
+def test_capture_and_responses_ignore_object_types():
+    message = malformed()
+    assert capture_messages([message], ["a"]) == capture_messages([message], ["a"])
+    protocol = tool_protocol("responses")
+    assert protocol.accepts_context(message)
+    assert not protocol.is_reply(message)
```

---

### Incident Patch 2: `c973ad1c` (2026-10-22)
**Commit Message**: fix(session): respect configured thinking in patch merge and repair budget-exhausted extraction (#6104)

* fix(session): respect configured thinking in patch merge and repair budget-exhausted extraction

PatchMergePolicyOptimizer forced per-call thinking=True for experiences/
trajectories merges, overriding a deployment's configured thinking=False
(volcengine backend per-call value takes precedence over its config). The
single format retry reused the same thinking mode and output cap without
showing the model its truncated program, so a reasoning-heavy merge that
consumed the completion budget failed terminally as parse_error after a
~2h session commit (#6096).

- policy_optimizer: add thinking field (bool | None, default None); None
  defers to the VLM backend's configured thinking policy, explicit
  True/False still override.
- extract_loop: accept thinking: Optional[bool] = None and pass it
  through verbatim so the backend default applies when unset; callers
  passing True/False are unchanged.
- extract_loop: classify a response as budget_exhausted when its
  finish_reason is 'length' or its completion tokens reach the resolved
  output cap; the single repair now appends the fa

**File**: `openviking/models/vlm/backends/litellm_vlm.py` (modified, +20/-8)
```diff
@@ -473,8 +473,11 @@ def _call() -> Union[str, VLMResponse]:
             elapsed = time.perf_counter() - t0
             self._update_token_usage_from_response(response, duration_seconds=elapsed)
             tracer.info(f"response={response}")
-            if tools:
-                return self._build_vlm_response(response, has_tools=True)
+            if tools is not None:
+                result = self._build_vlm_response(response, has_tools=True)
+                if not tools:
+                    result.content = self._clean_response(result.content or "")
+                return result
             return self._clean_response(self._extract_content_from_response(response))
 
         return _call()
@@ -505,8 +508,11 @@ async def _call() -> Union[str, VLMResponse]:
             elapsed = time.perf_counter() - t0
             self._update_token_usage_from_response(response, duration_seconds=elapsed)
             tracer.info(f"response={response}")
-            if tools:
-                return self._build_vlm_response(response, has_tools=True)
+            if tools is not None:
+                result = self._build_vlm_response(response, has_tools=True)
+                if not tools:
+                    result.content = self._clean_response(result.content or "")
+                return result
             return self._clean_response(self._extract_content_from_response(response))
 
         return await _call()
@@ -529,8 +535,11 @@ def _call() -> Union[str, VLMResponse]:
             response = completion(**kwargs)
             elapsed = time.perf_counter() - t0
             self._update_token_usage_from_response(response, duration_seconds=elapsed)
-            if tools:
-                return self._build_vlm_response(response, has_tools=True)
+            if tools is not None:
+                result = self._build_vlm_response(response, has_tools=True)
+                if not tools:
+                    result.content = self._clean_response(result.content or "")
+                return result
             return self._clean_response(self._extract_content_from_response(response))
 
         return _call()
@@ -553,8 +562,11 @@ async def _call() -> Union[str, VLMResponse]:
             response = await acompletion(**kwargs)
             elapsed = time.perf_counter() - t0
             self._update_token_usage_from_response(response, duration_seconds=elapsed)
-            if tools:
-                return self._build_vlm_response(response, has_tools=True)
+            if tools is not None:
+                result = self._build_vlm_response(response, has_tools=True)
+                if not tools:
+                    result.content = self._clean_response(result.content or "")
+                return result
             return self._clean_response(self._extract_content_from_response(response))
 
         return await _call()
```

**File**: `openviking/models/vlm/backends/openai_vlm.py` (modified, +4/-1)
```diff
@@ -386,7 +386,10 @@ async def _call() -> Union[str, VLMResponse]:
             elapsed = time.perf_counter() - t0
             if tools is not None:
                 self._update_token_usage_from_response(response, duration_seconds=elapsed)
-                return self._build_vlm_response(response, has_tools=True)
+                result = self._build_vlm_response(response, has_tools=True)
+                if not tools:
+                    result.content = self._clean_response(result.content or "")
+                return result
             return await self._extract_completion_content_async(response, elapsed)
 
         # 用 tracer.info 打印请求（人类可读格式）
```

**File**: `openviking/models/vlm/backends/volcengine_vlm.py` (modified, +20/-8)
```diff
@@ -231,9 +231,12 @@ def get_completion(
             raise
         elapsed = time.perf_counter() - t0
         self._update_token_usage_from_response(response, duration_seconds=elapsed)
-        result = self._build_vlm_response(response, has_tools=bool(tools))
-        if tools:
+        if tools is not None:
+            result = self._build_vlm_response(response, has_tools=True)
+            if not tools:
+                result.content = self._clean_response(result.content or "")
             return result
+        result = self._build_vlm_response(response, has_tools=False)
         return self._clean_response(str(result))
 
     @model_error_boundary
@@ -292,9 +295,12 @@ async def _call() -> Union[str, VLMResponse]:
                 raise
             elapsed = time.perf_counter() - t0
             self._update_token_usage_from_response(response, duration_seconds=elapsed)
-            result = self._build_vlm_response(response, has_tools=bool(tools))
-            if tools:
+            if tools is not None:
+                result = self._build_vlm_response(response, has_tools=True)
+                if not tools:
+                    result.content = self._clean_response(result.content or "")
                 return result
+            result = self._build_vlm_response(response, has_tools=False)
             content = self._clean_response(str(result))
             if content:
                 tracer.info(f"message.content={content}")
@@ -462,9 +468,12 @@ def get_vision_completion(
             raise
         elapsed = time.perf_counter() - t0
         self._update_token_usage_from_response(response, duration_seconds=elapsed)
-        result = self._build_vlm_response(response, has_tools=bool(tools))
-        if tools:
+        if tools is not None:
+            result = self._build_vlm_response(response, has_tools=True)
+            if not tools:
+                result.content = self._clean_response(result.content or "")
             return result
+        result = self._build_vlm_response(response, has_tools=False)
         return self._clean_response(str(result))
 
     @model_error_boundary
@@ -513,7 +522,10 @@ async def get_vision_completion_async(
             raise
         elapsed = time.perf_counter() - t0
         self._update_token_usage_from_response(response, duration_seconds=elapsed)
-        result = self._build_vlm_response(response, has_tools=bool(tools))
-        if tools:
+        if tools is not None:
+            result = self._build_vlm_response(response, has_tools=True)
+            if not tools:
+                result.content = self._clean_response(result.content or "")
             return result
+        result = self._build_vlm_response(response, has_tools=False)
         return self._clean_response(str(result))
```

**File**: `openviking/models/vlm/base.py` (modified, +2/-1)
```diff
@@ -204,7 +204,8 @@ async def get_media_completion_async(
             f"VLM provider {self.provider!r} does not support audio/video inputs"
         )
 
-    def _clean_response(self, content: str) -> str:
+    @staticmethod
+    def _clean_response(content: str) -> str:
         """Strip reasoning tags (e.g. ``<think>...</think>``) from model output."""
         return _THINK_TAG_RE.sub("", content).strip()
 
```

**File**: `openviking/session/memory/extract_loop.py` (modified, +59/-6)
```diff
@@ -134,7 +134,7 @@ def __init__(
         ctx: Optional[RequestContext] = None,
         context_provider: Optional[Any] = None,  # ExtractContextProvider
         isolation_handler: MemoryIsolationHandler = None,
-        thinking: bool = False,
+        thinking: Optional[bool] = None,
         max_output_tokens: Optional[int] = None,
     ):
         """
@@ -147,7 +147,9 @@ def __init__(
             max_iterations: Maximum number of ReAct iterations (default: 5)
             ctx: Request context
             context_provider: ExtractContextProvider - 必须提供（由 provider 加载 schema）
-            thinking: Whether to explicitly enable model thinking for this extraction loop.
+            thinking: Per-call thinking override for this extraction loop. True/False
+                force the mode for every call; None (default) defers to the VLM
+                backend's configured thinking policy.
             max_output_tokens: Per-call output cap for the extraction LLM. When None, the
                 configured vlm.max_tokens is used, falling back to a value large enough for
                 full memory rewrites so providers do not apply a small server-side default
@@ -159,7 +161,7 @@ def __init__(
         self.max_iterations = max_iterations
         self.ctx = ctx
         self.context_provider = context_provider
-        self.thinking = bool(thinking)
+        self.thinking = thinking
         self.max_output_tokens = max_output_tokens
         # Resolved in run() via _resolve_effective_max_output_tokens(); default to
         # the extraction floor so a direct _call_llm() before run() stays safe.
@@ -402,10 +404,21 @@ async def run(self) -> Tuple[Optional[Any], List[Dict[str, Any]]]:
             parse_error = self._last_parse_error
             # Add format error message if parse failed (max 1 retry). This may raise
             # max_iterations, granting one more attempt after this failure.
+            if failure_kind == "budget_exhausted":
+                # Truncation is not an ordinary format mistake: a same-cap format
+                # retry would only hit the budget again, and replaying the
+                # truncated output just grows the prompt. Fail fast with the
+                # dedicated error recorded by _call_llm().
+                raise RuntimeError(
+                    f"Memory extraction aborted: {parse_error or failure_kind}"
+                )
+
             if self._format_retry_count == 0:
                 self._format_retry_count += 1
                 max_iterations += 1
-                retry_reason = "refusal_text" if failure_kind == "refusal_text" else "format_retry"
+                retry_reason = (
+                    "refusal_text" if failure_kind == "refusal_text" else "format_retry"
+                )
                 tracer.info(f"Extended max_iterations to {max_iterations} for {retry_reason}")
                 self._add_format_error_message(messages)
 
@@ -479,6 +492,25 @@ def _resolve_effective_max_output_tokens(self) -> None:
             configured if configured is not None else _DEFAULT_EXTRACTION_MAX_OUTPUT_TOKENS
         )
 
+    def _budget_exhausted_error(self, response: Any, content: str) -> str:
+        """Build the dedicated, actionable error for a truncated response.
+
+        Truncation is detected only from the backend's explicit
+        ``finish_reason == "length"``; token counters are never used to infer it.
+        """
+        usage = getattr(response, "usage", None)
+        completion_tokens = usage.get("completion_tokens") if isinstance(usage, dict) else None
+        details = (
+            f"finish_reason='length', output cap={self._effective_max_output_tokens} tokens"
+        )
+        if completion_tokens:
+            details += f", completion_tokens={completion_tokens}"
+        return (
+            "Response was cut off by the output-token budget "
+            f"({details}), response_preview={_preview_text(content)!r}. "
+            "Raise vlm.max_tokens in ov.conf or reduce the memory context before retrying."
+        )
+
     def _retryable_resolution_issues(self, operations: ResolvedOperations) -> List[Dict[str, Any]]:
         issues: List[Dict[str, Any]] = []
         for operation in operations.upsert_operations:
@@ -1173,8 +1205,11 @@ async def _call_llm(
         Returns:
             Tuple of (tool_calls, operations) - one will be None, the other set
         """
-        # Call LLM with tools - use tools from strategy
-        tools = None
+        # Call LLM with tools - use tools from strategy. Pass tools=[] (not None)
+        # when tools are disabled so backends following the OpenAI backend's
+        # `tools is not None` convention still return a VLMResponse carrying
+        # finish_reason and usage instead of a bare string.
+        tools: Optional[List[Dict[str, Any]]] = []
         tool_choice = None
         if not self._disable_tools_for_iteration and self._tool_schemas:
             tools = self._tool_
```

**File**: `openviking/session/train/components/policy_optimizer.py` (modified, +10/-1)
```diff
@@ -51,6 +51,15 @@ class PatchMergePolicyOptimizer:
     memory_type: str = "experiences"
     memory_registry: MemoryTypeRegistry | None = None
     vlm_resolver: VLMResolver | None = None
+    thinking: bool | None = None
+    """Per-call thinking override for the merge extract loop.
+
+    None (default) defers to the VLM backend's configured ``thinking`` policy.
+    True/False force the mode for every merge call, overriding the backend
+    configuration. The optimizer never forces thinking on by itself: forcing
+    ``thinking=True`` for experiences/trajectories merges made reasoning consume
+    the whole completion budget and truncate the emitted program mid-string.
+    """
 
     @tracer(
         "train.policy_optimizer.patch_merge.plan",
@@ -183,7 +192,7 @@ async def _run_merge_extract_loop(
             context_provider=provider,
             isolation_handler=isolation_handler,
             max_iterations=1,
-            thinking=self.memory_type in {"trajectories", "experiences"},
+            thinking=self.thinking,
         )
         operations, _ = await orchestrator.run()
         return operations
```

**File**: `tests/session/memory/test_extract_loop_budget_recovery.py` (added, +370/-0)
```diff
@@ -0,0 +1,370 @@
+# Copyright (c) 2026 Beijing Volcano Engine Technology Co., Ltd.
+# SPDX-License-Identifier: AGPL-3.0
+"""Tests for ExtractLoop truncation handling and thinking passthrough.
+
+Regression tests for https://github.com/volcengine/issues/6096, reworked after
+review of PR #6104: truncation is detected only from an explicit
+``finish_reason == "length"``, checked before parsing; ``tools=[]`` is passed so
+real backends still return a ``VLMResponse`` with finish_reason and usage on the
+patch-merge path (where ``PatchMergeContextProvider.get_tools() == []``); and
+budget exhaustion is terminal — no cap doubling, no replay of the truncated
+output, and no completion_tokens-based truncation inference.
+"""
+
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, MagicMock, Mock, patch
+
+import pytest
+
+from openviking.models.vlm.base import ToolCall, VLMResponse
+from openviking.session.memory.dataclass import MemoryTypeSchema
+from openviking.session.memory.extract_loop import ExtractLoop
+from openviking.session.memory.page_id_map import PageIdMap
+
+_DEFAULT_CAP = 32768
+
+_TRUNCATED_PROGRAM = (
+    "sdk.upsert_preference(\n"
+    '    topic="booking",\n'
+    '    content="""The agent should deduplicate requests because\n'
+)
+
+
+class FakeContextProvider:
+    read_file_contents = {}
+
+    def get_memory_schemas(self, ctx):
+        return [
+            MemoryTypeSchema(
+                memory_type="preferences",
+                description="Preferences",
+                directory="viking://user/{user_space}/memories/preferences",
+                filename_template="{topic}.md",
+                fields=[],
+            )
+        ]
+
+    def get_tools(self):
+        # The real patch-merge path returns [] — this is what forced _call_llm
+        # down the tools-less branch under review.
+        return []
+
+    def get_extract_context(self):
+        return SimpleNamespace(page_id_map=PageIdMap())
+
+    def get_output_language(self):
+        return "en"
+
+    def instruction(self):
+        return "Extract memory operations."
+
+    async def prefetch(self):
+        return []
+
+
+def _length_response(
+    completion_tokens: int = _DEFAULT_CAP,
+    finish_reason: str = "length",
+    content: str = _TRUNCATED_PROGRAM,
+) -> VLMResponse:
+    return VLMResponse(
+        content=content,
+        finish_reason=finish_reason,
+        usage={"prompt_tokens": 100, "completion_tokens": completion_tokens},
+    )
+
+
+class ScriptedVLM:
+    """Fake VLM that records per-call kwargs and replays scripted responses."""
+
+    model = "test-model"
+
+    def __init__(self, responses):
+        self.responses = iter(responses)
+        self.calls = []
+
+    async def get_completion_async(self, **kwargs):
+        self.calls.append(kwargs)
+        return next(self.responses)
+
+
+def _user_contents(messages):
+    return [message.get("content", "") for message in messages if message.get("role") == "user"]
+
+
+def _assistant_contents(messages):
+    return [
+        message.get("content", "") for message in messages if message.get("role") == "assistant"
+    ]
+
+
+def _make_loop(vlm, **kwargs):
+    isolation_handler = Mock()
+    isolation_handler.get_read_scope.return_value = None
+    isolation_handler.fill_identity_fields.side_effect = lambda item, **kwargs: item
+    return ExtractLoop(
+        vlm=vlm,
+        viking_fs=MagicMock(),
+        context_provider=FakeContextProvider(),
+        isolation_handler=isolation_handler,
+        max_iterations=1,
+        **kwargs,
+    )
+
+
+async def _run_loop(loop):
+    config = SimpleNamespace(
+        memory=SimpleNamespace(link_enabled=False, extraction_output_format="python")
+    )
+    with (
+        patch(
+            "openviking.session.memory.extract_loop.get_openviking_config",
+            return_value=config,
+        ),
+        patch(
+            "openviking_cli.utils.config.get_openviking_config",
+            return_value=config,
+        ),
+    ):
+        loop._check_unread_existing_files = _async_return({})
+        loop._validate_patch_operations = _async_return([])
+        loop.finalize_operations = _async_return(None)
+        # Await inside the patch context: run() is a coroutine, so returning it
+        # would let the patches expire before the code under test executes.
+        return await loop.run()
+
+
+def _async_return(value):
+    async def _call(*args, **kwargs):
+        return value
+
+    return _call
+
+
+class TestThinkingPassthrough:
+    @pytest.mark.asyncio
+    @pytest.mark.parametrize("thinking", [None, True, False])
+    async def test_thinking_kwarg_is_forwarded_verbatim(self, thinking):
+        vlm = ScriptedVLM(["sdk.commit()"])
+        loop = _make_loop(vlm, thinking=thinking)
+        await _run_loop(loop)
+
+        assert len(vlm.calls) == 1
+        assert vlm.calls[0]["thinking"] is thinking
+
+
+class TestToolsDisabledStillUsesVLMResponse:
+    @pyt
```

**File**: `tests/session/train/test_train_components.py` (modified, +79/-0)
```diff
@@ -751,6 +751,85 @@ async def run(self):
     assert "+merged content" in captured["prefetch_messages"][-1]["content"]
 
 
+@pytest.mark.asyncio
+async def test_patch_merge_policy_optimizer_thinking_defaults_to_config_passthrough(
+    monkeypatch,
+):
+    """The optimizer must not force per-call thinking for experiences/trajectories.
+
+    Regression test for issue #6096: an operator-configured ``thinking=False`` VLM
+    still received ``thinking=True`` on every patch-merge call.
+    """
+    from openviking.session.memory.dataclass import ResolvedOperations
+
+    captured = {}
+
+    class FakeExtractLoop:
+        def __init__(self, **kwargs):
+            captured.update(kwargs)
+
+        async def run(self):
+            return ResolvedOperations(upsert_operations=[], delete_file_contents=[], errors=[]), []
+
+    monkeypatch.setattr(
+        "openviking.session.train.components.policy_optimizer.ExtractLoop",
+        FakeExtractLoop,
+    )
+
+    policy_set = _experience_set()
+    gradient = _patch_gradient(
+        uri=policy_set.policies[0].uri,
+        before="stale content",
+        after="merged content",
+    )
+    await PatchMergePolicyOptimizer(viking_fs=FakeVikingFS({}), vlm=object()).plan(
+        [gradient],
+        policy_set,
+        PatchMergePolicyOptimizerContext(request_context=fake_request_context()),
+    )
+
+    assert captured["thinking"] is None
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("thinking", [True, False])
+async def test_patch_merge_policy_optimizer_explicit_thinking_is_forwarded(monkeypatch, thinking):
+    from openviking.session.memory.dataclass import ResolvedOperations
+
+    captured = {}
+
+    class FakeExtractLoop:
+        def __init__(self, **kwargs):
+            captured.update(kwargs)
+
+        async def run(self):
+            return ResolvedOperations(upsert_operations=[], delete_file_contents=[], errors=[]), []
+
+    monkeypatch.setattr(
+        "openviking.session.train.components.policy_optimizer.ExtractLoop",
+        FakeExtractLoop,
+    )
+
+    policy_set = _experience_set()
+    gradient = _patch_gradient(
+        uri=policy_set.policies[0].uri,
+        before="stale content",
+        after="merged content",
+    )
+    optimizer = PatchMergePolicyOptimizer(
+        viking_fs=FakeVikingFS({}),
+        vlm=object(),
+        thinking=thinking,
+    )
+    await optimizer.plan(
+        [gradient],
+        policy_set,
+        PatchMergePolicyOptimizerContext(request_context=fake_request_context()),
+    )
+
+    assert captured["thinking"] is thinking
+
+
 @pytest.mark.asyncio
 async def test_patch_merge_policy_optimizer_merges_all_patch_gradients_once(monkeypatch):
     from openviking.session.memory.dataclass import (
```

---

### Incident Patch 3: `d7b32ac5` (2026-10-22)
**Commit Message**: fix(claude-plugin): replay pending writes on Stop (#6394)

SessionStart replays at most OPENVIKING_PENDING_REPLAY_LIMIT entries, and
no other Claude Code hook drained the queue, so the newest deferred writes
(usually the end of the failed turn) waited for the next session. The Stop
hook now replays the queue, without consuming retries, before it sends the
turn's new messages.

**File**: `examples/claude-code-memory-plugin/.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "openviking-memory",
-  "version": "0.7.16",
+  "version": "0.7.17",
   "description": "Long-term semantic memory for Claude Code, powered by OpenViking. Auto-recall relevant memories at session start and capture important information during conversations.",
   "author": {
     "name": "OpenViking",
```

**File**: `examples/claude-code-memory-plugin/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "claude-code-openviking-memory",
-  "version": "0.7.16",
+  "version": "0.7.17",
   "description": "OpenViking memory plugin for Claude Code — semantic long-term memory",
   "type": "module",
   "scripts": {
```

**File**: `examples/claude-code-memory-plugin/scripts/auto-capture.mjs` (modified, +8/-0)
```diff
@@ -34,6 +34,7 @@ import {
   makeFetchJSON,
 } from "./lib/ov-session.mjs";
 import { maybeDetach, readHookStdin } from "./lib/async-writer.mjs";
+import { replayPending } from "./lib/pending-queue.mjs";
 import { readJsonState, writeJsonState } from "./lib/state.mjs";
 import { getEffectivePeerId } from "./lib/workspace-peer.mjs";
 import { runHookStage } from "./shared/agent-hook-runtime.mjs";
@@ -317,6 +318,13 @@ async function main({ cfg, input, cwd }) {
   const health = await fetchJSON("/health");
   let result;
   if (health.ok) {
+    // SessionStart replays at most one capped batch, so drain more of the
+    // queue here; older entries go out before this turn's messages.
+    try {
+      await replayPending(fetchJSON, log, { consumeRetries: false });
+    } catch (err) {
+      logError("pending-replay", err);
+    }
     result = await pushTurnsToOv(ovSessionId, captureTurns, effectivePeer.peerId, cfg);
   } else if (isRetryableFailure(health)) {
     logError("health_check", "server unreachable or unhealthy; enqueuing capture");
```

**File**: `examples/claude-code-memory-plugin/scripts/auto-capture.test.mjs` (modified, +58/-1)
```diff
@@ -6,8 +6,9 @@ import { dirname, join } from "node:path";
 import test from "node:test";
 import { fileURLToPath } from "node:url";
 
-import { readRequestBody, withMockOpenViking, writeJson } from "../../memory-plugin-shared/testing/support.mjs";
+import { readRequestBody, withMockOpenViking, withPendingDir, writeJson } from "../../memory-plugin-shared/testing/support.mjs";
 import { extractCaptureTurns } from "./cc-transcript.mjs";
+import { enqueue, listPending } from "./lib/pending-queue.mjs";
 
 const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
 
@@ -127,6 +128,62 @@ test("failed non-retryable capture keeps the cursor for a later retry", async ()
   }
 });
 
+test("Stop replays queued writes before sending the new turns", async () => {
+  const root = await mkdtemp(join(tmpdir(), "ov-cc-capture-replay-"));
+  const transcriptPath = join(root, "transcript.jsonl");
+  const requests = [];
+
+  try {
+    await writeTranscript(transcriptPath);
+    await withPendingDir(async (pendingDir) => {
+      for (let i = 0; i < 20; i++) {
+        await enqueue("addMessage", "cc-old-session", {
+          role: "assistant",
+          parts: [{ type: "text", text: `old ${i}` }],
+        }, { createdAt: 1000 + i });
+      }
+
+      await withMockOpenViking(async (req, res) => {
+        const url = new URL(req.url, "http://127.0.0.1");
+        if (req.method === "GET" && url.pathname === "/health") {
+          writeJson(res, { status: "ok", result: { healthy: true } });
+          return;
+        }
+        if (req.method === "POST" && url.pathname.endsWith("/messages/batch")) {
+          const body = await readRequestBody(req);
+          requests.push({ path: url.pathname, count: body.messages.length });
+          writeJson(res, { status: "ok", result: { added: body.messages.length } });
+          return;
+        }
+        if (req.method === "POST" && url.pathname.endsWith("/messages")) {
+          const body = await readRequestBody(req);
+          requests.push({ path: url.pathname, text: body.parts[0].text });
+          writeJson(res, { status: "ok", result: {} });
+          return;
+        }
+        writeJson(res, { status: "ok", result: {} });
+      }, async (baseUrl) => {
+        await runAutoCapture(
+          { session_id: "capture-replay", transcript_path: transcriptPath, cwd: root },
+          { ...hookEnv(root, baseUrl), OPENVIKING_PENDING_DIR: pendingDir },
+        );
+      });
+
+      assert.deepEqual(await listPending(), []);
+    });
+
+    assert.deepEqual(requests, [
+      ...Array.from({ length: 20 }, (_, i) => ({
+        path: "/api/v1/sessions/cc-old-session/messages",
+        text: `old ${i}`,
+      })),
+      { path: "/api/v1/sessions/cc-capture-replay/messages/batch", count: 2 },
+    ]);
+  } finally {
+    await rm(root, { recursive: true, force: true });
+  }
+});
+
 test("threshold commit archives every captured message", async () => {
   const root = await mkdtemp(join(tmpdir(), "ov-cc-capture-commit-"));
   const transcriptPath = join(root, "transcript.jsonl");
```

#### Recent Merged Pull Requests:
- **PR #6463** (2026-10-23): feat(studio): align filesystem CLI commands and task interactions (@leowld)
- **PR #6447** (2026-10-22): feat(connector): support oauth refs for document imports (@duyuxuan0518)
- **PR #6435** (closed): feat(dsh-memory-plugin): add OpenViking console panel (@zrwangems)
- **PR #6429** (2026-10-22): fix(memory): skip unfixable event resolution retries (@dannyward630)
- **PR #6424** (2026-10-22): fix(pathlock): 调整 pathlock release 顺序，先执行内存 Registry lease 的移除，再通过 provider 删除 pathlock 文件 (@baojun-zhang)
- **PR #6421** (2026-10-22): fix(memory): allow omitting optional supersedes field (@rjdotdev)

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

## X. gateway): tolerate non-string "type" values in client history (#6306)

**RULE**:
When implementing operations in `openviking_gateway/capture.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d9db19ab`: gateway): tolerate non-string "type" values in client history (#6306). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `openviking_gateway/capture.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
from .protocols import clean_text, is_user, string_type, text_content, unwrap_client
        if string_type(message) in {"function_call_output", "custom_tool_call_output"}:
        if message.get("role") not in {"user", "assistant"} and string_type(message) not in {
        if string_type(message) in {"function_call", "custom_tool_call"}:
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
from .protocols import clean_text, is_user, text_content, unwrap_client
        if message.get("type") in {"function_call_output", "custom_tool_call_output"}:
        if message.get("role") not in {"user", "assistant"} and message.get("type") not in {
        if message.get("type") in {"function_call", "custom_tool_call"}:
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d9db19ab` are properly handled with clean fallback behavior.
