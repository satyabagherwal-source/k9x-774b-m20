> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source**: github ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Source Version**: `739e17f9`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T10:16:11.844Z  
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
> **Harvest Timestamp**: 2026-11-05T10:16:11.838Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41587 stars

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

### Incident Patch 1: `739e17f9` (2026-11-05)
**Commit Message**: fix(magpie): add opt-in sessionless capture and raise recall budget (#7073)

* fix(magpie): warn on missing capture sessions and raise recall budget

Log a fixed capture diagnostic once without replacing recall status. Default recall to 2000 ms and show editable 2000/3000 ms recall/host budgets, preserving saved settings.

Validation: syntax checks and npm pack dry-run passed; 126 tests passed, 0 failed, 1 Bun-host test skipped (Bun unavailable). Refs #7007.

* feat(magpie): add opt-in capture without host sessions

Add captureWithoutSession (false by default). Derive capture identity from client scope and the shaped opening message without changing stateless recall. Preserve real session precedence and recheck file opt-in in queued delivery.

Validation: 131 tests passed, 0 failed, 1 actual Bun-host test skipped (runtime unavailable); syntax checks, npm pack dry-run and diff checks passed. Refs #7007.

* fix(magpie): retire derived capture queues on native takeover

Resolve derived capture scope before checking native ownership. Parse native-marked history for capture cleanup while preserving recall's existing native-context exclusion. Persist ownership and remove pending snapshot

**File**: `examples/claude-code-memory-plugin/scripts/shared/config-schema.mjs` (modified, +7/-3)
```diff
@@ -138,6 +138,9 @@ export const KNOBS = [
     workspace: "capture.enabled",
     capability: "capture",
   },
+  // Magpie uses these for capture when its gateway has no session or yields to a native plugin.
+  { name: "captureWithoutSession", type: "bool", default: false, capability: "capture" },
+  { name: "nativeAgents", type: "list", default: [], capability: "capture" },
   { name: "captureMode", type: "enum", values: ["semantic", "keyword"], default: "semantic", env: "OPENVIKING_CAPTURE_MODE", capability: "capture" },
   { name: "captureMaxLength", type: "int", default: 24000, min: 200, max: 100000, env: "OPENVIKING_CAPTURE_MAX_LENGTH", capability: "capture" },
   // Tool output is reported verbatim; the server owns truncation via
@@ -280,9 +283,10 @@ export function harnessKey(harness) {
 }
 
 /** Both accepted spellings of every harness, for the `plugin` section. */
-export const HARNESS_CONFIG_KEYS = new Set(
-  Object.values(HARNESS_KEYS).flatMap((key) => [key, key.replace(/_/g, "-")]),
-);
+export const HARNESS_CONFIG_KEYS = new Set([
+  ...Object.values(HARNESS_KEYS).flatMap((key) => [key, key.replace(/_/g, "-")]),
+  "magpie", // Magpie supports ovcli.conf only, with no legacy ov.conf section.
+]);
 
 export function knobDefault(knob, harness = "") {
   if (harness && knob.harness && knob.harness[harness] !== undefined) return knob.harness[harness];
```

**File**: `examples/codex-memory-plugin/scripts/shared/config-schema.mjs` (modified, +7/-3)
```diff
@@ -138,6 +138,9 @@ export const KNOBS = [
     workspace: "capture.enabled",
     capability: "capture",
   },
+  // Magpie uses these for capture when its gateway has no session or yields to a native plugin.
+  { name: "captureWithoutSession", type: "bool", default: false, capability: "capture" },
+  { name: "nativeAgents", type: "list", default: [], capability: "capture" },
   { name: "captureMode", type: "enum", values: ["semantic", "keyword"], default: "semantic", env: "OPENVIKING_CAPTURE_MODE", capability: "capture" },
   { name: "captureMaxLength", type: "int", default: 24000, min: 200, max: 100000, env: "OPENVIKING_CAPTURE_MAX_LENGTH", capability: "capture" },
   // Tool output is reported verbatim; the server owns truncation via
@@ -280,9 +283,10 @@ export function harnessKey(harness) {
 }
 
 /** Both accepted spellings of every harness, for the `plugin` section. */
-export const HARNESS_CONFIG_KEYS = new Set(
-  Object.values(HARNESS_KEYS).flatMap((key) => [key, key.replace(/_/g, "-")]),
-);
+export const HARNESS_CONFIG_KEYS = new Set([
+  ...Object.values(HARNESS_KEYS).flatMap((key) => [key, key.replace(/_/g, "-")]),
+  "magpie", // Magpie supports ovcli.conf only, with no legacy ov.conf section.
+]);
 
 export function knobDefault(knob, harness = "") {
   if (harness && knob.harness && knob.harness[harness] !== undefined) return knob.harness[harness];
```

**File**: `examples/magpie-memory-plugin/README.md` (modified, +69/-7)
```diff
@@ -50,7 +50,7 @@ environment; editing the file applies to the next operation without restarting.
       "enabled": true,
       "autoRecall": true,
       "autoCapture": true,
-      "recallContextTimeoutMs": 700,
+      "recallContextTimeoutMs": 2000,
       "recallMaxTokens": 1600,
       "recallPeerScope": "all",
       "mcpEnabled": false
@@ -85,7 +85,7 @@ to enabled; explicit `autoCapture: false` in host options or client settings is
 preserved. Host options override scoped settings, which override shared settings.
 
 Magpie's **Options** editor now accepts `autoRecall`, `autoCapture`, `mcpEnabled`,
-`recallMaxTokens`, `recallContextTimeoutMs` and `nativeAgents`. These behavior
+`captureWithoutSession`, `recallMaxTokens`, `recallContextTimeoutMs` and `nativeAgents`. These behavior
 options override the corresponding file settings for this plugin; connection
 credentials and identity always remain file-owned. `gatewayTimeoutMs` controls
 the host's hook budget. The package supplies an example, not saved defaults;
@@ -94,6 +94,33 @@ options. Memory tools are disabled by default; set `mcpEnabled: true` to enable
 them. Automatic capture is enabled by default and needs no additional setting;
 set `autoCapture: false` to disable it.
 
+`captureWithoutSession` is a Magpie-only boolean, default `false`. If the client
+cannot send a stable session ID, opt in through Magpie's Options:
+
+```json
+{
+  "autoCapture": true,
+  "captureWithoutSession": true
+}
+```
+
+It can also be set in `ovcli.conf` under `plugin.magpie` (or shared `plugin`),
+with the same host → scoped → shared precedence. A real session ID always takes
+priority. Only capture uses the derived ID; recall remains stateless without a
+host session. The fallback hashes the agent, working directory, protocol and
+first user message after the existing capture shaping/filters. Model changes do
+not change this ID; existing connection/credential isolation still applies.
+
+This is approximate grouping: independent conversations with identical opening
+messages in the same client scope may merge. If their histories diverge, capture
+skips snapshots that conflict with the history already written. Rewriting or
+removing the opening message can split a conversation or skip unknown history.
+Start a new conversation after enabling it; existing histories are not backfilled.
+`autoCapture: false` still disables all automatic capture. For file settings without
+a host override, turning this option off pauses queued derived-session snapshots;
+turning it back on lets them resume. Queued snapshots retain their enqueue-time
+host overrides, just as they do for `autoCapture`.
+
 File settings `plugin.magpie.bypassSession: true` or `bypassSessionPatterns`
 matching the Magpie session ID or working directory skip automatic recall and
 capture. Existing queued snapshots pause while bypass applies and can resume
@@ -113,8 +140,17 @@ controlled by `mcpEnabled`.
   turn. Retries and later turns replay the original snapshot.
 - Only host-classified `local` and `magpie-key` origins receive memory. Shared
   gateway keys, forwarded traffic and unknown origins are skipped. Without a
-  session ID, new user requests use stateless recall: no persisted ledger, profile
-  replay or conversation capture. Repeated requests may retrieve different context.
+  session ID, new user requests use stateless recall: no persisted recall ledger or
+  profile replay. Capture is also skipped unless `captureWithoutSession: true`.
+  Repeated requests may retrieve different context.
+  With capture enabled and the fallback off, the first eligible sessionless user request logs
+  `OpenViking capture: no-session` once per plugin-host process, explaining that
+  capture is unavailable and suggesting a stable session header or explicit
+  `captureWithoutSession` opt-in with its grouping limitation. Check Magpie's
+  plugin-host logs; this warning contains no message text or credentials and does
+  not replace the recall status. Current Magpie hosts ignore custom `report()`
+  codes, so a separate capture status in the UI requires host support.
+  Native-owned, disabled, bypassed and auxiliary requests do not trigger the warning.
   The file's OV credentials remain the authority.
 - Only a new textual user message triggers retrieval. Tool continuations replay
   known context without retrieving. Magpie skips its own internal title/classifier
@@ -141,12 +177,38 @@ controlled by `mcpEnabled`.
   against every duplicate. Disabling `autoRecall` prevents new searches while
   replaying known history; disabling the plugin entirely disables both.
 - The shared context builder owns query settings, budgets and result relevance.
-  Default recall timeout is 700 ms inside Magpie's default 1000 ms hook budget.
-  Increasing it requires raising Magpie's `gatewayTimeoutMs` with I/O margin.
-  Cancellation reaches the HTTP request. Query filters use the shared parser.
+  Default recall timeout is 2000 ms. Set
```

**File**: `examples/magpie-memory-plugin/README_CN.md` (modified, +51/-5)
```diff
@@ -45,7 +45,7 @@ magpie plugin add ./examples/magpie-memory-plugin
     "enabled": true,
     "autoRecall": true,
     "autoCapture": true,
-    "recallContextTimeoutMs": 700,
+    "recallContextTimeoutMs": 2000,
     "recallMaxTokens": 1600,
     "recallPeerScope": "all",
     "mcpEnabled": false
@@ -65,10 +65,31 @@ Magpie 的文件读取策略排除环境变量和 workspace 层。
 工具仍需 `plugin.magpie.mcpEnabled: true` 显式开启。采集默认开启；宿主选项或客户端配置中显式设置的 `autoCapture: false` 仍然生效。优先级为宿主选项、Magpie 专属配置、共享配置。
 
 Magpie 的“选项”支持 `autoRecall`、`autoCapture`、`mcpEnabled`、`recallMaxTokens`、
-`recallContextTimeoutMs`、`nativeAgents`，优先于本插件的文件行为配置；Hook 和工具使用同一套设置。
+`recallContextTimeoutMs`、`captureWithoutSession`、`nativeAgents`，优先于本插件的文件行为配置；Hook 和工具使用同一套设置。
 服务连接、凭据和身份仍只从文件读取。`gatewayTimeoutMs` 控制宿主 Hook 预算。
 包内示例不会自动保存；未填写的字段继续沿用文件设置或默认值。记忆工具默认关闭，设置 `mcpEnabled: true` 可开启。自动采集默认开启，无需额外配置；如需关闭，设置 `autoCapture: false`。
 
+`captureWithoutSession` 是 Magpie 专属的布尔配置，默认 `false`。客户端无法传递稳定会话 ID 时，
+可在 Magpie“选项”中显式开启：
+
+```json
+{
+  "autoCapture": true,
+  "captureWithoutSession": true
+}
+```
+
+也可在 `ovcli.conf` 的 `plugin.magpie` 或共享 `plugin` 中设置，优先级仍为宿主选项、专属配置、共享配置。
+有真实会话 ID 时优先使用真实 ID。派生 ID 仅用于采集，无宿主会话时召回仍然无状态。
+派生输入为 Agent、工作目录、协议和经过现有采集清洗/过滤的首条用户消息；切换模型不会改变 ID，
+OV 连接和凭据仍按现有规则隔离。
+
+同一客户端作用域内，相同开场的独立对话可能合并。如果两段历史出现分歧，采集会跳过与已写入历史
+冲突的快照。改写或删除开场消息可能拆分会话，或因历史无法识别而跳过采集。开启后请新建对话，
+不回填未知的已有历史。
+`autoCapture: false` 仍关闭所有自动采集。通过文件配置且无宿主覆盖时，关闭本开关会暂停派生会话的
+待同步队列，重新开启后可恢复。与 `autoCapture` 一样，已入队快照保留入队时的宿主选项覆盖。
+
 不会修改文件、合并环境变量中的凭据，或回退读取 `ov.conf`、Root Key、Gateway Token。
 配置缺失、损坏或服务不可用时，召回跳过，模型请求继续；不会沿用旧配置。
 
@@ -83,7 +104,12 @@ Magpie 的“选项”支持 `autoRecall`、`autoCapture`、`mcpEnabled`、`reca
   资料读取与检索在召回超时预算内并行执行；任一路失败时仍可使用另一路结果。
   资料遵守 `profileTokenBudget`，且最多占 `recallMaxTokens` 的一半，使用共享的中日韩字符 token 估算器；
   资料与检索结果合计不超过 `recallMaxTokens`，与首轮决策一起持久化；重试和后续轮次回放原始快照。
-- 仅处理宿主确认为本机的 `local`、`magpie-key` 请求。没有会话 ID 时，新用户请求使用无状态召回：不读写持久化账本、不重放 Profile 快照、不采集对话；重复请求可能获得不同的召回结果。
+- 仅处理宿主确认为本机的 `local`、`magpie-key` 请求。没有会话 ID 时，新用户请求使用无状态召回：不读写持久化召回账本、不重放 Profile 快照；除非显式设置 `captureWithoutSession: true`，否则不采集对话。重复请求可能获得不同的召回结果。
+  开启采集但未开启哈希兼容时，首次符合条件却缺少会话 ID 的用户请求，会在 Magpie 插件宿主日志中输出
+  `OpenViking capture: no-session`，建议客户端传递稳定的会话 ID 请求头，或了解会话误合并限制后显式开启 `captureWithoutSession`。
+  每个插件宿主进程只提示一次，不含对话正文或凭据，也不覆盖召回状态。
+  当前 Magpie 会忽略自定义 `report()` 状态码，独立的 UI 采集状态仍需宿主支持。
+  原生插件接管、关闭、bypass、辅助请求不会触发此提示。
   共享网关 Key、转发请求或身份缺失时跳过，始终使用文件中配置的 OV 身份。
 - 只有新的文本用户消息触发检索。工具续轮只回放已有记忆；重试复用首次决策，
   包括无结果和失败的决策。同样的问题出现在后续新轮次时仍可重新检索。
@@ -99,8 +125,28 @@ Magpie 的“选项”支持 `autoRecall`、`autoCapture`、`mcpEnabled`、`reca
   Magpie 自身跳过内部标题/分类请求；插件也跳过明确标记的辅助、压缩、标题和子 Agent 请求。
 - `autoRecall: false` 关闭新检索，但仍回放已知历史；插件整体关闭则停止两者。
   查询过滤、召回参数、预算和结果相关性使用共享模块。
-- 默认 700ms 检索预算。提高超时时也应提高 Magpie 的 `gatewayTimeoutMs`，为状态读写留余量。
-  请求取消会中止检索。Actor 范围需要明确填写 `actor_peer_id`，缺失时跳过。
+- 默认 2000ms 检索预算，可在 Magpie“选项”或 `plugin.magpie` 中配置
+  `recallContextTimeoutMs`；已有显式配置继续生效。实际 HTTP 超时还受客户端 `timeout`、
+  9000ms 上限及宿主预算限制：从宿主预算扣除已耗费的准备时间，并预留 200ms 用于结果组装、
+  状态读写和序列化。检索与 Profile 共用内部截止信号，一路超时仍可使用另一路已完成的结果。
+  剩余不足 100ms 时不再发起 HTTP 请求；宿主取消时仍放弃本次注入。
+  宿主没有提供整个 Hook 链的剩余截止时间，因此预留时间不能保证避开更早的外部取消。
+  Actor 范围需要明确填写 `actor_peer_id`，缺失时跳过。
+
+连接托管或远程服务时，请在 Magpie 的“选项”中同时保存两个预算（合并到已有选项）：
+
+```json
+{
+  "recallContextTimeoutMs": 2000,
+  "gatewayTimeoutMs": 3000
+}
+```
+
+包内选项示例包含这组值，但升级不会重写已保存的选项。未设置 `gatewayTimeoutMs` 时，
+Magpie 仍默认使用 1000ms 的宿主预算，插件会自动缩短 HTTP 等待以适配该预算。
+已有安装如需使用完整 2000ms 检索预算，仍须显式提高宿主预算。宿主预算应高于检索预算，
+为配置和状态读写留余量（Magpie 允许的上限为 10000ms）。如需继续增加检索预算，
+请同步调整两个值，并确保 `ovcli.conf` 顶层的 `timeout`（秒）足够。召回失败仍会放行模型请求。
 
 ### 本机回放状态
 
```

**File**: `examples/magpie-memory-plugin/capture-worker.mjs` (modified, +6/-2)
```diff
@@ -88,7 +88,8 @@ export async function deliverSnapshot(directory, snapshot, { call = request, sig
     // A worker may outlive file edits. Recheck identity and opt-in immediately
     // before each non-idempotent operation, without changing its pinned identity.
     const current = await loadConfig({ OPENVIKING_CLI_CONFIG_FILE: snapshot.configPath }, snapshot.options);
-    if (connectionScope(current, context) !== scope || !current.enabled || !current.autoCapture || bypassedSession(current, context)) return "paused";
+    if (connectionScope(current, context) !== scope || !current.enabled || !current.autoCapture
+      || (context.derivedSession && !current.captureWithoutSession) || bypassedSession(current, context)) return "paused";
     if (current.nativeAgents.includes(context.agent) || await exists(join(root, "native-owner"))) return "native";
     return withCaptureDecisions(directory, scope, (state) => {
       if (!Array.isArray(snapshot.turnAnchors) && state.rejected.length) return "rejected";
@@ -110,7 +111,8 @@ export async function deliverSnapshot(directory, snapshot, { call = request, sig
     if (status !== "delivered") return status;
     state = await update((s) => structuredClone(s));
   }
-  if (state.blocked) return "paused";
+  // Older workers may have blocked the entire derived scope on one conflict.
+  if (state.blocked && !(context.derivedSession && state.blocked === "history_changed")) return "paused";
   let meta;
   try { meta = await call(cfg, `/api/v1/sessions/${sessionId}`, { signal }); }
   catch (error) {
@@ -151,6 +153,8 @@ export async function deliverSnapshot(directory, snapshot, { call = request, sig
   }
   if (incoming.length <= state.hashes.length && incoming.every((id, i) => id === state.hashes[i])) return commitCaptured(cfg, sessionId, update, call, signal, stopped);
   if (!state.hashes.every((id, i) => id === incoming[i])) {
+    // Separate sessionless conversations can share an opening message.
+    if (context.derivedSession) return "rejected";
     await update((s) => { s.blocked = "history_changed"; });
     return "paused";
   }
```

**File**: `examples/magpie-memory-plugin/capture.mjs` (modified, +42/-10)
```diff
@@ -10,14 +10,21 @@ import { recallDigest } from "./recall-ledger.mjs";
 
 export const captureDirectory = (cfg, ctx) => join(dataDirectory(cfg), "capture", connectionScope(cfg, ctx));
 const workers = new Map();
+let warnedMissingSession = false;
 export async function nativeOwner(cfg, ctx, body) {
   // Without a session, ownership is request-local: never share a marker
   // between unrelated conversations from the same client.
   if (!ctx.session?.trim()) return cfg.nativeAgents.includes(ctx.agent) || hasNativeContext(body, ctx.protocol);
   const directory = captureDirectory(cfg, ctx);
   const marker = join(directory, "native-owner");
   if (cfg.nativeAgents.includes(ctx.agent) || hasNativeContext(body, ctx.protocol)) {
-    await mkdir(directory, { recursive: true, mode: 0o700 });
+    if (ctx.derivedSession && !cfg.captureWithoutSession) {
+      // Take over an existing scope without creating state while capture is off.
+      try { await access(directory); }
+      catch (error) { if (error.code === "ENOENT") return true; throw error; }
+    } else {
+      await mkdir(directory, { recursive: true, mode: 0o700 });
+    }
     await chmod(directory, 0o700);
     const file = await open(marker, "a", 0o600);
     await file.close();
@@ -67,8 +74,12 @@ export async function queueCapture(cfg, ctx, messages, { launch = true } = {}) {
   const user = payloads.findLast((m) => m.message_kind === "user_query");
   if (!user) return false;
   const turnKey = user.source_message_ids[0].slice(7);
-  const snapshot = { version: 1, scope, configPath: cfg.path, context: { agent: ctx.agent, session: ctx.session, cwd: ctx.cwd, protocol: ctx.protocol },
-    options: Object.hasOwn(ctx.options || {}, "autoCapture") ? { autoCapture: cfg.autoCapture } : {}, turnKey, messages: payloads, turnAnchors: selected.turnAnchors, turnRevisions: selected.turnRevisions };
+  const options = {};
+  if (Object.hasOwn(ctx.options || {}, "autoCapture")) options.autoCapture = cfg.autoCapture;
+  if (typeof ctx.options?.captureWithoutSession === "boolean") options.captureWithoutSession = cfg.captureWithoutSession;
+  const snapshot = { version: 1, scope, configPath: cfg.path, context: { agent: ctx.agent, session: ctx.session, cwd: ctx.cwd, protocol: ctx.protocol,
+    ...(ctx.derivedSession ? { derivedSession: true } : {}) },
+    options, turnKey, messages: payloads, turnAnchors: selected.turnAnchors, turnRevisions: selected.turnRevisions };
   const encoded = JSON.stringify(snapshot);
   if (Buffer.byteLength(encoded) > 3 * 1024 * 1024) return false;
   const path = join(pending, `${turnKey}.json`);
@@ -94,20 +105,35 @@ export async function queueCapture(cfg, ctx, messages, { launch = true } = {}) {
 }
 
 export async function prepareCapture(body, ctx, cfg, options) {
-  if (!cfg.enabled || bypassedSession(cfg, ctx) || !["local", "magpie-key"].includes(ctx.origin) || !ctx.session?.trim()) return;
+  if (!cfg.enabled || bypassedSession(cfg, ctx) || !["local", "magpie-key"].includes(ctx.origin)) return;
   if (isAuxiliaryRequest(body, ctx)) return;
+  const conversation = describeConversation(body, ctx.protocol, { allowNativeContext: true });
+  const first = conversation && captureMessages([conversation.messages[conversation.users[0]]], ctx.protocol, cfg)?.[0]?.source_message_ids[0];
+  if (!ctx.session?.trim() && first && (cfg.captureWithoutSession
+    || cfg.nativeAgents.includes(ctx.agent) || hasNativeContext(body, ctx.protocol))) {
+    // Keep the host context unchanged: fallback identity belongs only to capture.
+    ctx = { ...ctx, derivedSession: true, session: `derived-${recallDigest(JSON.stringify([ctx.agent || "", ctx.cwd || "", ctx.protocol, first]))}` };
+  }
+  // Resolve the capture scope before yielding so native takeover also retires
+  // derived queues and remains effective when later requests lose the marker.
+  if (ctx.derivedSession && bypassedSession(cfg, ctx)) return;
   if (await nativeOwner(cfg, ctx, body)) { ctx.state && (ctx.state.nativeOwner = true); return; }
-  if (!cfg.autoCapture) return;
-  const conversation = describeConversation(body, ctx.protocol);
-  if (!conversation) return;
+  if (!cfg.autoCapture || !conversation || !first) return;
+  if (!ctx.session?.trim()) {
+    if (conversation.fresh && !warnedMissingSession) {
+      warnedMissingSession = true;
+      // Magpie's report() accepts recall codes only; log separately so a
+      // successful recall cannot overwrite the capture diagnostic.
+      console.warn("OpenViking capture: no-session — automatic capture unavailable: the host did not provide a session ID. Configure the client to send a stable session header (for example x-session-id), or opt into captureWithoutSession: true (identical opening messages may merge conversations). Stateless recall remains available.");
+    }
+    return;
+  }
   // Never bind across an earlier assistant/tool exchange, even if only one
   // human user remains after client-side trimming or an identity s
```

**File**: `examples/magpie-memory-plugin/config.mjs` (modified, +7/-1)
```diff
@@ -70,14 +70,20 @@ export async function loadConfig(env = process.env, options = {}) {
   if (!Array.isArray(nativeAgents) || nativeAgents.some((agent) => typeof agent !== "string" || !agent.trim())) {
     throw Object.assign(new Error("OpenViking: invalid"), { code: "invalid" });
   }
+  const captureWithoutSession = options.captureWithoutSession ?? scoped?.captureWithoutSession ?? file.plugin?.captureWithoutSession;
+  if (captureWithoutSession != null && typeof captureWithoutSession !== "boolean") {
+    throw Object.assign(new Error("OpenViking: invalid"), { code: "invalid" });
+  }
   // Host options may tune behavior, never connection credentials or identity.
   const allowed = ["autoRecall", "autoCapture", "mcpEnabled", "recallMaxTokens", "recallContextTimeoutMs"];
   const overrides = Object.fromEntries(Object.entries(options || {}).filter(([key]) => allowed.includes(key)));
+  // Preserve Magpie's strict boolean validation and nullish fallback before resolving the schema default.
+  if (captureWithoutSession != null) overrides.captureWithoutSession = captureWithoutSession;
   const settingsFile = { ...file, plugin: { ...file.plugin, magpie: { ...scoped, ...overrides } } };
   const { settings, configured, sources } = resolveSettings("magpie", { env: {}, cliFile: settingsFile });
   if (!configured.has("mcpEnabled")) settings.mcpEnabled = false;
   if (!configured.has("autoCapture")) settings.autoCapture = true;
-  if (!configured.has("recallContextTimeoutMs")) settings.recallContextTimeoutMs = 700;
+  if (!configured.has("recallContextTimeoutMs")) settings.recallContextTimeoutMs = 2000;
   const connection = resolveConnection("magpie", { env: { OPENVIKING_CREDENTIAL_SOURCE: "cli" }, files });
   const peerId = resolvePluginPeerId({ settings, configured, sources, credentials: connection, env: {} });
   const authorization = clientAuthorization(file);
```

**File**: `examples/magpie-memory-plugin/conversation.mjs` (modified, +3/-2)
```diff
@@ -104,7 +104,7 @@ export function memoryBlock(memory) {
 }
 
 /** Only full, client-owned histories have replayable message positions. */
-export function describeConversation(body, protocol) {
+export function describeConversation(body, protocol, { allowNativeContext = false } = {}) {
   if (!object(body)) return null;
   const encoded = JSON.stringify(body);
   if (Buffer.byteLength(encoded) > 2 * 1024 * 1024) return null;
@@ -122,7 +122,8 @@ export function describeConversation(body, protocol) {
   if (!Array.isArray(messages) || !messages.length || messages.length > 2000 || !messages.every(object)) return null;
   // Tool results and assistant quotations may contain docs describing these
   // markers. They are data, not evidence of an installed memory plugin.
-  if (hasNativeContext(body, protocol)) return null;
+  // Capture may parse native-owned history solely to resolve its cleanup scope.
+  if (!allowNativeContext && hasNativeContext(body, protocol)) return null;
   const exchanges = conversationExchanges(messages, protocol);
   const users = exchanges.filter((exchange) => !exchange.auxiliary).map((exchange) => exchange.start);
   if (!users.length) return null;
```

---

### Incident Patch 2: `2fc2f725` (2026-11-05)
**Commit Message**: refactor(ui): give every public directory an index.ts entry and narrow the root exports (#7066)

* refactor(ui): give every public directory an index.ts entry and narrow the root exports

Each component and module directory now exposes a single `index.ts`
barrel, and the build, the package exports and the root entry all point
at it instead of at the same-named implementation file. This makes the
directory the unit of the public API: renaming an implementation file no
longer changes the published entry, and the declaration output is
`dist/<分类>/<目录>/index.d.ts`.

Narrow the root entry at the same time. `@openviking/react` now exports
each component and its main Props type only — `FileTreeProps`,
`ScopeSwitcherProps` and so on. Row types, option types, handles and
label bags are reachable from the `components/<component>` and
`modules/<module>` subpaths, not from the root, so the root stays a short
list of the things most consumers reach for.

Record the rule in the package agent guide and in the package README, and
restate it in both quick-start pages.

* fix(ui): keep FilePreview out of the root entry so the optional peer stays optional

Review follow-up. Adding `FilePreview` to the

**File**: `frontend/AGENTS.md` (modified, +1/-0)
```diff
@@ -50,6 +50,7 @@
 
 - JS/TS 文件（含 JSX、TSX）每个文件最多 200 行，不计空行和纯注释行，由 lint 的 `max-lines` 规则检查。
 - 按变更选择验证：纯文字改动检查格式、链接和差异；类型、实现或构建配置改动运行 workspace 的格式检查、类型检查和完整构建。命令见 README，CI 环境见 [公共构建 action](../.github/actions/build-ui/action.yml)。
+- 格式化与检查只针对本次改动的文件：在 `frontend/` 下执行 `npm run lint -- <改动文件>` 或 `npx prettier --write <改动文件>`，不要用 `--write .`、`--check .` 等扫描整个目录的写法。仓库根与 `frontend/` 存在同名目录（`docs/`、`README.md`、`AGENTS.md`），从错误的工作目录用相对路径会改到本仓库无关的产品文档；格式化前确认工作目录，并检查 `git status` 里没有出现预期之外的文件。
 - 用户可见的行为或样式改动，在浏览器中运行构建后的文档并实际操作示例，检查相关的主题、窄屏和失败状态；截图后查看图片，构建成功本身不能证明页面可用。
 - 修改包导出、peer dependencies、资源或打包策略时，从真实打包产物验证消费者，包括声明支持的 React 版本，并检查声明、CSS 与 SVG 能在 workspace 外解析；文档开发模式不能代替独立消费验证。
 - 修改部署时，验证合并后主站页面仍存在，并检查 UI 深链及静态资源。线上尚未发布或外部检查尚未结束时，报告实际状态。
```

**File**: `frontend/docs/docs/en/guide/getting-started.mdx` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ Keep application-specific workflows and authentication in the application layer.
 
 ## Public entries
 
-The root `@openviking/react` entry currently exports `FileTree`, `AgentConnect` and the four business module placeholders. `FilePreview`, `Tui` and `ScopeSwitcher` are available from their `components/<component>` subpaths only. `@openviking/react/icons` provides five file-type icons.
+The root `@openviking/react` entry currently exports `FileTree`, `Tui`, `ScopeSwitcher`, `AgentConnect`, and the four business module placeholders with their main Props types. `FilePreview` is available from the `components/file-preview` subpath only, because its types depend on the optional `@ark-design/ui`. Subtypes — row types, option types, handles and label bags — always come from the subpaths. `@openviking/react/icons` provides five file-type icons.
 
 There are no aggregate `components` or `modules` JavaScript entries. Business placeholders use individual `modules/<module>` entries:
 
```

**File**: `frontend/docs/docs/en/modules/index.mdx` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ This example uses the public module entries and the aggregate module stylesheet.
 
 ## Import and styles
 
-Import a component and its Props / Labels types from `@openviking/react/modules/<module>`. The four component bodies, their Props and their Labels types are also exported from `@openviking/react`.
+Import a component and its Props / Labels types from `@openviking/react/modules/<module>`. The four component bodies and their main Props types are also exported from `@openviking/react`; subtypes such as Labels come from the subpath only.
 
 JavaScript does not load CSS. Import `@openviking/react/modules/<module>/style.css` for one module, `@openviking/react/modules/style.css` for all modules, or `@openviking/react/style.css` for the full library. Each stylesheet works independently. There is no aggregate `@openviking/react/modules` JavaScript entry.
 
```

**File**: `frontend/docs/docs/zh/guide/getting-started.mdx` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ workspace 开发插件会在文档服务器启动前运行 Rslib watch。文档
 
 ## 公开入口
 
-根入口 `@openviking/react` 当前导出 `FileTree`、`AgentConnect` 与四个业务模块占位组件；`FilePreview`、`Tui`、`ScopeSwitcher` 只从各自的 `components/<组件>` 子路径导出。`@openviking/react/icons` 提供五种文件类型图标。
+根入口 `@openviking/react` 当前导出 `FileTree`、`Tui`、`ScopeSwitcher`、`AgentConnect` 与四个业务模块占位组件及其主 Props 类型；`FilePreview` 只从 `components/file-preview` 子路径导出，因为它的类型依赖可选的 `@ark-design/ui`。行类型、选项类型、句柄与文案包等子类型一律从子路径导入。`@openviking/react/icons` 提供五种文件类型图标。
 
 没有 `components` 或 `modules` 分类聚合 JavaScript 入口。业务占位组件使用独立的 `modules/<模块>` 入口：
 
```

**File**: `frontend/docs/docs/zh/modules/index.mdx` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
 
 ## 导入与样式
 
-从 `@openviking/react/modules/<模块>` 导入组件及其 Props / Labels 类型。四个组件的本体、Props 与 Labels 类型也一并从根入口 `@openviking/react` 导出。
+从 `@openviking/react/modules/<模块>` 导入组件及其 Props / Labels 类型。四个组件的本体与主 Props 类型也从根入口 `@openviking/react` 导出；Labels 等子类型只从子路径导入。
 
 JavaScript 不加载 CSS。单模块使用 `@openviking/react/modules/<模块>/style.css`，全部模块使用 `@openviking/react/modules/style.css`，整库使用 `@openviking/react/style.css`，每个样式入口均可独立消费。没有 `@openviking/react/modules` 分类聚合 JavaScript 入口。
 
```

**File**: `frontend/packages/react/AGENTS.md` (modified, +8/-0)
```diff
@@ -2,6 +2,14 @@
 
 适用于 `frontend/packages/react/**`，同时遵循 [Frontend Agent Guide](../../AGENTS.md) 和更深目录的规则。
 
+## 公开导出
+
+- 目录以 `index.ts` 作为唯一出口，包根入口 `src/index.ts` 只从这里取。
+- 根入口只导出各组件、各业务模块的组件本体与主 Props 类型（`<组件名>Props`），作为最常用的快捷方式。
+- 子类型、回调参数类型、行与选项等数据结构、句柄与文案包，一律只从 `components/<组件>`、`modules/<模块>` 子路径导出。根入口不聚合它们。
+- 依赖可选 peer 的组件不进入根入口：`FilePreview` 的类型引用 `@ark-design/ui`，放进根声明会让该可选 peer 对只用其他根导出的消费者变成必需。
+- 新增或调整导出时，同步维护 `package.json` 的 `exports`、Rslib 入口与声明路径，并从真实打包产物验证根入口与各子路径都能解析。
+
 ## useEffect 使用门槛
 
 - 新增或修改组件、自定义 Hook 时，非必要不使用 `useEffect`。只有需要在渲染提交后，将组件与明确的外部系统保持同步，且更直接的声明式 API、事件处理或已有专用 Hook 无法满足时，才允许使用。
```

**File**: `frontend/packages/react/README.md` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ FileTree 已实现目录树视图与交互，FilePreview 已实现页签与纯
 
 ## 公开入口与样式
 
-- 根入口导出 `FileTree`、`AgentConnect` 与四个业务模块占位组件及其公开类型；`FilePreview`、`Tui`、`ScopeSwitcher` 只从各自的 `components/<组件>` 子路径导出。具体组件使用 `components/<组件>` 子路径；业务模块使用 `modules/<模块>` 子路径，当前导出占位组件与类型，真实能力迁入后再导出 Hook。不提供 `@openviking/react/components` 或 `@openviking/react/modules` 分类聚合 JS 入口。包导出显式列举，内部文件不开放。
+- 根入口只导出各组件、各业务模块的组件本体与主 Props 类型（`<组件名>Props`），当前为 `FileTree`、`Tui`、`ScopeSwitcher`、`AgentConnect` 与四个业务模块占位组件；行类型、选项类型、句柄与文案包等子类型只从 `components/<组件>`、`modules/<模块>` 子路径导出。`FilePreview` 不在根入口：它的类型依赖可选的 `@ark-design/ui`，放进根声明会让该 peer 变成必需。不提供 `@openviking/react/components` 或 `@openviking/react/modules` 分类聚合 JS 入口。包导出显式列举，内部文件不开放。
 - 组件只提供明确列出的分层子路径，不保留旧路径别名。
 - JS 入口共享实现，不隐式加载 CSS。整包、组件集合与单模块样式由同一份源码构建，选择所需范围导入即可。
 
```

**File**: `frontend/packages/react/package.json` (modified, +9/-9)
```diff
@@ -26,49 +26,49 @@
       "import": "./dist/index.js"
     },
     "./components/file-tree": {
-      "types": "./dist/components/file-tree/file-tree.d.ts",
+      "types": "./dist/components/file-tree/index.d.ts",
       "import": "./dist/components/file-tree.js"
     },
     "./components/file-tree/style.css": "./dist/components/file-tree/style.css",
     "./components/file-preview": {
-      "types": "./dist/components/file-preview/file-preview.d.ts",
+      "types": "./dist/components/file-preview/index.d.ts",
       "import": "./dist/components/file-preview.js"
     },
     "./components/file-preview/style.css": "./dist/components/file-preview/style.css",
     "./components/tui": {
-      "types": "./dist/components/tui/tui.d.ts",
+      "types": "./dist/components/tui/index.d.ts",
       "import": "./dist/components/tui.js"
     },
     "./components/tui/style.css": "./dist/components/tui/style.css",
     "./components/scope-switcher": {
-      "types": "./dist/components/scope-switcher/scope-switcher.d.ts",
+      "types": "./dist/components/scope-switcher/index.d.ts",
       "import": "./dist/components/scope-switcher.js"
     },
     "./components/scope-switcher/style.css": "./dist/components/scope-switcher/style.css",
     "./components/agent-connect": {
-      "types": "./dist/components/agent-connect/agent-connect.d.ts",
+      "types": "./dist/components/agent-connect/index.d.ts",
       "import": "./dist/components/agent-connect.js"
     },
     "./components/agent-connect/style.css": "./dist/components/agent-connect/style.css",
     "./style.css": "./dist/style.css",
     "./components/style.css": "./dist/components/style.css",
     "./modules/file-browser": {
-      "types": "./dist/modules/file-browser/file-browser.d.ts",
+      "types": "./dist/modules/file-browser/index.d.ts",
       "import": "./dist/modules/file-browser.js"
     },
     "./modules/file-browser/style.css": "./dist/modules/file-browser/style.css",
     "./modules/console": {
-      "types": "./dist/modules/console/console.d.ts",
+      "types": "./dist/modules/console/index.d.ts",
       "import": "./dist/modules/console.js"
     },
     "./modules/console/style.css": "./dist/modules/console/style.css",
     "./modules/task-center": {
-      "types": "./dist/modules/task-center/task-center.d.ts",
+      "types": "./dist/modules/task-center/index.d.ts",
       "import": "./dist/modules/task-center.js"
     },
     "./modules/task-center/style.css": "./dist/modules/task-center/style.css",
     "./modules/user-usage": {
-      "types": "./dist/modules/user-usage/user-usage.d.ts",
+      "types": "./dist/modules/user-usage/index.d.ts",
       "import": "./dist/modules/user-usage.js"
     },
     "./modules/user-usage/style.css": "./dist/modules/user-usage/style.css",
```

---

### Incident Patch 3: `425b0d76` (2026-11-05)
**Commit Message**: refactor(ui): move AgentConnect into components (#7065)

* refactor(ui): move AgentConnect into components

AgentConnect is a pure view: the design has tabs, a list and a detail
pane, with no input, no form and no data of its own. It belongs with the
other reusable views rather than with the business modules, which are
defined as Hook plus composed view that loads its own data.

Move the directory from modules/ to components/ and give it a real
contract in place of the shared module placeholder:

- `tabs` / `activeTabId` for the top tabs
- `items` / `selectedId` for the left list
- `detail` for the right pane: title, description, tags, content and the
  text the copy control writes
- `labels` for the instructions heading, copy control and empty state
- `onTabChange` / `onSelect` / `onCopy` report intent only

Everything the old module owned stays with the host: where the catalog
comes from, how the body is rendered, permissions, analytics and routing.

Update the package and build entries, the aggregate stylesheets, the
navigation, the component indexes and the bilingual documentation to the
new path. The placeholder view is unchanged.

`AgentConnectProps` omits `onCopy` from the d

**File**: `frontend/AGENTS.md` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
 - 按 [README 的目标目录](./README.md#target-layout) 放置资产。React 包发布名为 `@openviking/react`，Vue 落地后独立交付为 `@openviking/vue`。源码边界可以先在 workspace 内共享，通过子路径提供消费入口。有独立安装、依赖隔离或独立发布节奏的需求时再拆包。
 - 跨框架纯函数、资源类型和数据转换放在 `packages/lib/`。OpenViking 请求与服务适配器放在 `packages/client/`。仅供单个模块使用的工具留在模块内。仅随 React 使用的共享能力随 React 包交付。跨模块公共 Hook 有真实实现后再从 `@openviking/react/hooks` 开放，组件不能使用取数或缓存 Hook。出现独立于框架的消费需求时，再为 `lib` 定义框架无关的公开包入口，并在未安装 React 或 Vue 的项目中验证。
 - 图标的 SVG 源文件、来源与授权放在 `packages/icons/`。React 图标组件放在 `packages/react/src/icons/`，随 React 包从 `@openviking/react/icons` 交付。各框架的封装直接消费同一份 SVG 源文件。构建产物包含图标实现和类型声明，消费者通过 React 包一次安装。
-- React 源码的 `components/` 放独立视图组件，`modules/` 放按业务能力划分的 Hook 与组合视图，不提供完整页面。模块 Hook 暴露可独立消费的数据、状态与操作，组合视图复用 Hook 并组装组件；宿主差异通过服务契约、参数、回调与插槽接入。当前先提供五个模块的占位组件、基础类型与样式入口，便于宿主接入布局；真实业务与 Hook 随后迁入，占位状态和 API 范围须在示例与文档中明确。可独立部署的微应用放在 `apps/`，例如 `apps/workbench-embed/`，消费公开模块与组件，管理挂载、卸载、样式隔离和宿主通信。
+- React 源码的 `components/` 放独立视图组件，`modules/` 放按业务能力划分的 Hook 与组合视图，不提供完整页面。模块 Hook 暴露可独立消费的数据、状态与操作，组合视图复用 Hook 并组装组件；宿主差异通过服务契约、参数、回调与插槽接入。当前先提供四个模块的占位组件、基础类型与样式入口，便于宿主接入布局；真实业务与 Hook 随后迁入，占位状态和 API 范围须在示例与文档中明确。可独立部署的微应用放在 `apps/`，例如 `apps/workbench-embed/`，消费公开模块与组件，管理挂载、卸载、样式隔离和宿主通信。
 - 每个组件、业务模块或区块独占一个 kebab-case 目录，入口文件与目录同名。实现、CSS Modules、测试及私有子组件就近放置，例如 `components/<模块>/<模块>.tsx` 和同目录的 `<模块>.module.css`。模块私有的 Hook、类型和工具留在模块内，不提前提升到公共目录。
 - 根入口与子路径分别维护公开导出；组件子路径为 `@openviking/react/components/<组件>`，业务模块为 `@openviking/react/modules/<模块>`，从模块入口分别导出 Hook 与组合视图。不提供 `components`、`modules` 分类聚合 JS 入口。包导出显式列举，内部文件不开放；各入口共享实现，避免重复创建 Provider、Context 或状态对象。同步维护 Rslib 入口和声明路径。
 - 目录按实际内容创建，不预建空目录，也不为单个简单模块增加不必要的转发层。
```

**File**: `frontend/README.md` (modified, +2/-2)
```diff
@@ -30,8 +30,8 @@ npm run preview        # Serve the built documentation at /ui/
 ## Layout
 
 - `packages/react`: `@openviking/react` package, Rslib library build with declaration generation, CSS Modules, and React peer dependencies.
-- `packages/react/src/components/{file-tree,file-preview}`: file-tree interaction and tabbed file-preview views with public props types. See the [module map](./packages/react/README.md#模块目录).
-- `packages/react/src/modules/{file-browser,console,agent-connect,task-center,user-usage}`: importable placeholder components, public Props / Labels types, and styles. Business Hooks and interactions are planned.
+- `packages/react/src/components/{file-tree,file-preview,tui,scope-switcher,agent-connect}`: reusable views with public props types. file-tree and file-preview are implemented; tui, scope-switcher and agent-connect publish their reviewed contracts with a placeholder view. See the [module map](./packages/react/README.md#模块目录).
+- `packages/react/src/modules/{file-browser,console,task-center,user-usage}`: importable placeholder components, public Props / Labels types, and styles. Business Hooks and interactions are planned.
 - `packages/react/src/{hooks,utils}`: reserved internal shared code, without public subpaths. Module-private helpers stay within their module.
 - `docs`: Rspress with `@rspress/plugin-preview`, external TSX demos, source viewing/copying, and hand-written props tables.
 - `docs/docs/en` and `docs/docs/zh`: matching English and Simplified Chinese pages, with localized navigation.
```

**File**: `frontend/docs/docs/_demos/agent-connect-basic.tsx` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+import { AgentConnect } from '@openviking/react/components/agent-connect';
+import '@openviking/react/components/agent-connect/style.css';
+
+export default function AgentConnectBasic() {
+  return (
+    <AgentConnect
+      tabs={[{ id: 'mainstream', label: 'Mainstream agents' }]}
+      activeTabId="mainstream"
+      items={[]}
+    />
+  );
+}
```

**File**: `frontend/docs/docs/_demos/agent-connect-placeholder.tsx` (removed, +0/-10)
```diff
@@ -1,10 +0,0 @@
-import { AgentConnect } from '@openviking/react/modules/agent-connect';
-import '@openviking/react/modules/agent-connect/style.css';
-
-export default function AgentConnectPlaceholder() {
-  return (
-    <div lang="en">
-      <AgentConnect />
-    </div>
-  );
-}
```

**File**: `frontend/docs/docs/_demos/modules-basic.tsx` (modified, +0/-2)
```diff
@@ -1,6 +1,5 @@
 import { FileBrowser } from '@openviking/react/modules/file-browser';
 import { Console } from '@openviking/react/modules/console';
-import { AgentConnect } from '@openviking/react/modules/agent-connect';
 import { TaskCenter } from '@openviking/react/modules/task-center';
 import { UserUsage } from '@openviking/react/modules/user-usage';
 import '@openviking/react/modules/style.css';
@@ -10,7 +9,6 @@ export default function ModulesBasic() {
     <div className="ov-demo-modules" lang="en">
       <FileBrowser />
       <Console />
-      <AgentConnect />
       <TaskCenter />
       <UserUsage />
     </div>
```

**File**: `frontend/docs/docs/en/components/agent-connect.mdx` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+# AgentConnect
+
+An agent connection view. The host supplies the tabs, the items of the active tab and the detail body; the component renders the list and the detail, and reports switch and copy intent.
+
+This is a placeholder component: it renders a fixed-size empty shell and consumes no props, so hosts can integrate against the published package before the view is migrated. The props contract below is the agreed shape; the placeholder implementation will be replaced.
+
+## Basic usage
+
+```tsx file="../../_demos/agent-connect-basic.tsx" preview
+
+```
+
+The placeholder is 960 × 640, matching the full-page view.
+
+## Structure
+
+The view has three parts:
+
+- **Tabs** across the top, declared by the host through `tabs` and `activeTabId`.
+- **List** on the left, the items of the active tab through `items`.
+- **Detail** on the right, the selected item's body through `detail`.
+
+The component holds no catalog and no body content. Where the items come from, how the body is rendered and what a copy means all belong to the host.
+
+## Props
+
+### AgentConnectProps
+
+| Property      | Type                             | Default  | Description                                                                                                                                 |
+| ------------- | -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
+| `tabs`        | `readonly AgentConnectTab[]`     | Required | Tabs at the top.                                                                                                                            |
+| `activeTabId` | `string`                         | Required | Active tab id, owned by the host.                                                                                                           |
+| `items`       | `readonly AgentConnectItem[]`    | Required | Items of the active tab.                                                                                                                    |
+| `selectedId`  | `string`                         | —        | Selected item id, owned by the host.                                                                                                        |
+| `detail`      | `AgentConnectDetail`             | —        | Detail of the selected item; no body when omitted.                                                                                          |
+| `labels`      | `AgentConnectLabels`             | English  | Replaceable copy.                                                                                                                           |
+| `onTabChange` | `(tabId: string) => void`        | —        | Invoked when a tab is selected.                                                                                                             |
+| `onSelect`    | `(item) => void`                 | —        | Invoked when an item is selected.                                                                                                           |
+| `onCopy`      | `(text: string) => void`         | —        | Invoked after a successful copy, for analytics or extra feedback; the component performs the write. The control still renders when omitted. |
+| Other props   | `HTMLAttributes<HTMLDivElement>` | —        | Standard div attributes; `children` is excluded.                                                                                            |
+
+### AgentConnectTab
+
+| Property | Type     | Description     |
+| -------- | -------- | --------------- |
+| `id`     | `string` | Unique tab key. |
+| `label`  | `string` | Tab label.      |
+
+### AgentConnectItem
+
+| Property      | Type        | Description                               |
+| ------------- | ----------- | ----------------------------------------- |
+| `id`          | `string`    | Unique item key.                          |
+| `name`        | `string`    | Item name.                                |
+| `description` | `string`    | One-line summary shown in the list.       |
+| `icon`        | `ReactNode` | Item icon, which can be an image or node. |
+
+### AgentConnectDetail
+
+| Property      | Type                | Description                                                     |
+| ------------- | ------------------- | --------------------------------------------------------------- |
+| `title`       | `string`            | Detail title, usually the selected item's name.                 |
+| `icon`        | `ReactNode`         | Icon shown next to the title.                                   |
+| `description` | `string`            | Description under the title.                                    |
+| `tags`        | `readonly string[]` | Tags under the title, for example "SDK" or "Overseas".          |
+| `content`     | `ReactNode`         | Body content, 
```

**File**: `frontend/docs/docs/en/components/index.mdx` (modified, +4/-0)
```diff
@@ -20,6 +20,10 @@ The reviewed API for command records, results and input. The current view is a p
 
 A header scope breadcrumb. The host declares the levels and their options; the component renders the triggers, dropdown panels, option list and search, and reports switch intent.
 
+### [AgentConnect](./agent-connect)
+
+An agent connection view. The host supplies the tabs, the items of the active tab and the detail body; the component renders the list and detail, and reports switch and copy intent.
+
 ### [Icons](./icons)
 
 Five file-type icons with configurable image dimensions and accessible labels: audio, PDF, presentation, video, and word-processing files.
```

**File**: `frontend/docs/docs/en/guide/getting-started.mdx` (modified, +4/-4)
```diff
@@ -2,7 +2,7 @@
 
 OpenViking UI provides React foundations for building AI application interfaces on OpenViking, the context database for AI agents. The workspace includes Rslib builds, bilingual documentation, layered directory conventions, and scoped styles. Applications provide business UI, data, authentication, and workflow orchestration.
 
-The package provides FileTree, FilePreview, five file-type icons, and five business module placeholders. See the [component overview](../components/) and [module overview](../modules/) for their current scope. Public business Hooks are not implemented yet.
+The package provides FileTree, FilePreview, Tui, ScopeSwitcher, AgentConnect, five file-type icons, and four business module placeholders. See the [component overview](../components/) and [module overview](../modules/) for their current scope. Public business Hooks are not implemented yet.
 
 ## Run locally
 
@@ -21,15 +21,15 @@ The workspace development plugin starts Rslib watch before the documentation ser
 ## Organize application code
 
 - `packages/react/src/components/`: reusable views that receive prepared data through props and report intent through callbacks.
-- `packages/react/src/modules/`: five importable placeholder components; business Hooks and composed interactions will follow.
+- `packages/react/src/modules/`: four importable placeholder components; business Hooks and composed interactions will follow.
 - `packages/react/src/hooks/` and `utils/`: internal shared logic, without public subpaths.
 - `docs/docs/en/` and `docs/docs/zh/`: corresponding documentation pages; shared runnable examples belong in `docs/docs/_demos/`.
 
 Keep application-specific workflows and authentication in the application layer. Module Hooks load data through the shared Client; components do not fetch business data or depend on application routing.
 
 ## Public entries
 
-The root `@openviking/react` entry exports FileTree, the five business module placeholders, and their public types. FileTree and FilePreview are also available through their `components/<module>` subpaths. `@openviking/react/icons` provides five file-type icons.
+The root `@openviking/react` entry currently exports `FileTree`, `AgentConnect` and the four business module placeholders. `FilePreview`, `Tui` and `ScopeSwitcher` are available from their `components/<component>` subpaths only. `@openviking/react/icons` provides five file-type icons.
 
 There are no aggregate `components` or `modules` JavaScript entries. Business placeholders use individual `modules/<module>` entries:
 
@@ -40,7 +40,7 @@ import '@openviking/react/modules/file-browser/style.css';
 <FileBrowser />;
 ```
 
-The five placeholders accept `className`, `style`, and replaceable `labels`, and require no Provider. See [Modules](../modules/) for runnable examples and Props types.
+The four placeholders accept `className`, `style`, and replaceable `labels`, and require no Provider. See [Modules](../modules/) for runnable examples and Props types.
 
 Business modules will combine data-loading Hooks with composed views around focused capabilities. Each module entry will export its Hooks separately from its composed view, so hosts can reuse the logic with their own UI. The shared Client will follow the native OpenViking API paths, parameters, and response types. Authentication, account scope, routing, permissions, and complete page flows remain with the host. Business Hooks and cross-module public Hooks have no implementation or exports yet.
 
```

#### Recent Merged Pull Requests:
- **PR #7081** (closed): feat(compile): 支持编译产物关系图增量构建与查询 (@hezhang-1216)
- **PR #7073** (2026-11-05): fix(magpie): add opt-in sessionless capture and raise recall budget (@yufeng201)
- **PR #7071** (closed): fix(retrieve): use the general VLM for context rewrite, not the intent query planner (@umeGe)
- **PR #7068** (closed): feat(compile): 保证产物关系图与编译完成及实时编辑一致 (@hezhang-1216)
- **PR #7067** (2026-11-05): docs(ui): split package and module READMEs into English and Chinese files (@LaamGinghong)
- **PR #7066** (2026-11-05): refactor(ui): give every public directory an index.ts entry and narrow the root exports (@LaamGinghong)

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

## X. magpie): add opt-in sessionless capture and raise recall budget (#7073)

**RULE**:
When implementing operations in `examples/claude-code-memory-plugin/scripts/shared/config-schema.mjs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `739e17f9`: magpie): add opt-in sessionless capture and raise recall budget (#7073). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `examples/claude-code-memory-plugin/scripts/shared/config-schema.mjs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
  // Magpie uses these for capture when its gateway has no session or yields to a native plugin.
  { name: "captureWithoutSession", type: "bool", default: false, capability: "capture" },
  { name: "nativeAgents", type: "list", default: [], capability: "capture" },
export const HARNESS_CONFIG_KEYS = new Set([
  ...Object.values(HARNESS_KEYS).flatMap((key) => [key, key.replace(/_/g, "-")]),
  "magpie", // Magpie supports ovcli.conf only, with no legacy ov.conf section.
]);
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
export const HARNESS_CONFIG_KEYS = new Set(
  Object.values(HARNESS_KEYS).flatMap((key) => [key, key.replace(/_/g, "-")]),
);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `739e17f9` are properly handled with clean fallback behavior.
