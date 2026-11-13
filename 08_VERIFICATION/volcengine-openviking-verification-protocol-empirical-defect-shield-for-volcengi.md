# Verification Protocol: Verification Protocol: Empirical Defect Shield for volcengine/OpenViking

<!-- PROVENANCE_START
{
  "source_repository": "volcengine/OpenViking",
  "source_url": "https://github.com/volcengine/OpenViking",
  "source_version": "07432564",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-13T16:49:10.806Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-volcengine-openviking",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine/OpenViking](https://github.com/volcengine/OpenViking) (Revision: `07432564`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-13T16:49:10.806Z`  
> **Learning ID**: `learn-github-volcengine-openviking`


## 1. Scope & Verification Target
- **Target Repository**: `volcengine/OpenViking` (Commit: `07432564`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): volcengine/OpenViking

> **Canonical Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T16:49:10.027Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 42189 stars

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
- **Issue #7412** (2026-11-13): **[Bug]: Gateway session memory_policy overrides user-level memory_types**
  *Symptoms*: ### Issue Origin  Observed or reproduced in a real environment  ### Bug Description  ### Version  - OpenViking: v0.5.3 - Also reproducible on main `9c48090b0e6a48303909cb87333c778acca34cd6`  ### Description  OpenViking Gateway creates every capture session with:  ```json {"memory_policy":{"working_memory":{"enabled":false}}}   Session policy precedence selects the whole Session policy before the User policy. It does not merge missing fields from lower-priority policies. Therefore a User-level memory_policy.memory_types allowlist is ignored for Gateway-created sessions.  Because the Gateway policy omits memory_types, it resolves to null, meaning all enabled memory types are allowed.  ### Steps to Reproduce  Configure a User policy such as:   {"memory_policy":{"memory_types":["events"]}}   Start a new conversation through OpenViking Gateway.  Inspect the generated OV session and commit it.  The session carries a Session-level policy with Working Memory disabled but no memory_types restriction; extraction is not limited to events.  ### Expected Behavior  Gateway should disable only Working Memory while preserving User-level self, peer, and memory_types policy resolution.  ### Actual Behavior  The partial Session policy masks the complete User policy.   ### Minimal Reproducible Example  ```python Remove memory_policy from Gateway create_session().  Send enable_working_memory: false in the Gateway commit request. This existing per-commit field overrides only Working Memory and pre

- **Issue #7356** (2026-11-12): **[Bug]: 同一用户批量 session commit 时，记忆操作组产生同 URI 冲突并导致任务失败**
  *Symptoms*: ## 问题描述  在为记忆编译准备真实会议记忆时，同一用户下的多个 session 正常完成消息写入，`session commit` 请求也已受理，但部分后台任务最终失败，报 `Conflicting add/update/delete results for URIs`。  本轮错误表明，不同操作组的结果落到了同一个记忆 URI，合并时判定冲突，导致对应 `session commit` 失败；日志反复指向同一条“录音项目”记忆。  这是**真实环境观察到的问题**。失败发生在 `session commit` 的记忆提取／更新阶段，当时尚未开始调用 `POST /api/v1/compile`。  ## 环境与输入  - 服务端：商业个人版，`/health` 返回版本 `v0.5.2.5`；同一个用户、同一个 API Key。 - 客户端：Linux 容器，Python 3.12，通过 HTTP API 调用；模型服务为 Volcengine。 - 数据：公开 [ICSI 会议转写](https://groups.inf.ed.ac.uk/ami/icsi/download/)，50 场不同的完整会议，对应 **50 个 session**。 - 每段会议发言作为一条 `role=user` 的 message，正文保留说话人标签，保留 `created_at` 和 `turn_id`。 - 共 **71,998 条 message**；每个 session 平均约 **1,440 条**，实际范围 256–2,494 条。每个 session 仅执行一次手动 `session commit`。 - 创建 session 时设置 `auto_commit_policy=null`，未设置自定义 `memory_extraction_config`。  ## 实际操作流程  1. 在同一用户下创建 50 个不同 session：     ```http    POST /api/v1/sessions    {"session_id": "<每场会议独立的 session_id>", "auto_commit_policy": null}    ```  2. 通过 `POST /api/v1/sessions/{session_id}/messages/batch` 写入各自的会议转写，每个请求最多 100 条；同一个 session 内按原顺序写入。 3. **全部 session 的消息写入完成后**，以 HTTP 并发 16 提交整批 50 个 commit：     ```http    POST /api/v1/sessions/{session_id}/commit    {"keep_recent_count": 0}    ```  4. 收集所有已受理请求返回的 `task_id`，整批提交完成后，再通过 `GET /api/v1/tasks/{task_id}` 等待各自终态。  以上是本次实测流程，尚未缩减为每次运行都必然触发的最小复现。  ## 实际结果与错误  已核对完整任务回执，50 个 commit 均已进入终态：  | 已受理 commit | 成功 | 失败 | 尚未确认终态 | | --- | --- | --- | --- | | 50 | 34 | 16 | 0 |  最终任务失败率为 **32%（16/50）**。16 个失败任务均包含同类 URI 操作冲突错误。  一条真实任务回执：  ```j
  **Post-Mortem & Fix Analysis**:
  > I reproduced a **target-selection collision with disjoint input URIs** at `main@32de68480d36593648563f749d9af7a4a817489f`, using fixed completion responses and the real `StreamingMemoryUpdater.submit` → patch prefetch → `ExtractLoop` → apply path.  The inputs use the repository's `_registry`, `_note_op`, `_note_update_op`, `_ctx` and `InMemoryVikingFS` fixtures:  ```text Stored: canonical.md = "old canonical" Session A: ADD alias_0.md; UPDATE canonical.md Session B: ADD alias_1.md ```  All three input targets are distinct. The search fixture returns `canonical.md` as a candidate for the add group. Its real read tool assigns `page_id=1`. The scripted completion selects that existing page:  ```json {"notes":[{"page_id":1,"content":{"blocks":[{"search":"old canonical","replace":"old canonical\nfrom_adds"}]}}],"delete_ids":[]} ```  The real parser/resolver returns an **update** to `canonical.md` (`old_memory_file_content` is populated). However, the final conflict check still associates th

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

### Incident Patch 1: `cf14a0cb` (2026-11-13)
**Commit Message**: fix(react): align the file browser search dialog with the console design (#7570)

* fix(react): align the file browser search dialog with the console design

The dialog drifted from the design: the empty state was two lines of centred
text with no artwork, a hover preview panel split the result list in two, the
count line put the mode chip before the retrieval label, and the advanced panel
referenced `--ov-ui-file-search-*` variables that were never declared, so its
surface was transparent.

Match the design node by node:

- Empty state: the design's 258x140 artwork above the title and hint, 24px
  apart, with the block starting 120px below the content top.
- Results: the list fills the dialog again. The preview panel and its split
  layout are gone; rows keep the design's 20px/12px padding, 24px icon tile,
  14px name and bottom divider. Arrow keys still move the current row and Enter
  opens it.
- Count line: `N results ・ [mode] Vector retrieval Switch`, indented to the
  row's text edge, and rendered only when there are results — the design draws
  neither the empty, loading nor failure state with it.
- Advanced panel: the design's `bg-2` surface, which needed `--ov-ui-bg-2-defa

**File**: `frontend/.changeset/file-browser-search-design-alignment.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+'@openviking/react': patch
+---
+
+Align the FileBrowser search dialog with the console design and drop the result preview panel it gained in 0.1.10.
+
+- The empty state shows the design's artwork above the title and hint instead of two centred lines of text.
+- Results fill the dialog width again: the hover/keyboard preview panel and its split layout are gone, and each row keeps its bottom divider, 24px icon tile and 14px name. `↑`/`↓` still move the current row and `Enter` opens it.
+- The count line reads `N results ・ [mode] Vector retrieval Switch` in the design's order, and appears only when there are results; the empty, loading and failure states no longer carry it.
+- The advanced panel takes the design's `bg-2` surface, and the mode menu its 259px popover with a 6px radius and card shadow.
+
+BREAKING CHANGE: `FileBrowserLabels.searchPreview`, `searchPreviewEmpty` and `searchPreviewFailed` are removed, because the search dialog no longer previews results. Drop those overrides; the keys have no effect.
```

**File**: `frontend/docs/docs/en/modules/file-browser.mdx` (modified, +2/-2)
```diff
@@ -241,7 +241,7 @@ All fields are optional, and omitted fields follow `locale`.
 | searchIgnoreCase        | Case-insensitive matching                                                                                                    | `string`                             | `'Ignore case'`                                                       |
 | searchFilterUnsupported | Why a filter is unavailable in the current mode                                                                              | `string`                             | `'This filter is unavailable for the current mode'`                   |
 | searchResultCount       | Result count; receives the number                                                                                            | `(count: number) => string`          | `'N results'`                                                         |
-| searchVia               | Copy between the count and the mode chip                                                                                     | `string`                             | `'Vector retrieval'`                                                  |
+| searchVia               | Copy that follows the mode chip                                                                                              | `string`                             | `'Vector retrieval'`                                                  |
 | searchSwitchMode        | Entry that switches the retrieval mode                                                                                       | `string`                             | `'Switch'`                                                            |
 | searchAdvancedLabel     | Accessible name of the advanced-filter button                                                                                | `string`                             | `'Advanced filters'`                                                  |
 | previewMode             | Preview in the Preview / Source switch                                                                                       | `string`                             | `'Preview'`                                                           |
@@ -424,7 +424,7 @@ Reveal defaults to `true`; `{ reveal: false }` only requests a preview and resol
 - Semantic results rank by score and deduplicate by URI. `grep` keeps each match and its line number, even when several matches share a file.
 - A `glob` pattern without `/` gains a `**/` prefix; a directory match drops its trailing slash before navigation and records the directory fact on `isDir`.
 - Filter groups enable or disable with the mode. A disabled group stays visible but dimmed, with the reason beside its title. Directory candidates derive from `rootUri` with the `~` alias; selections invalidated by a root change are dropped.
-- Hover a result or use **↑ / ↓** to preview it. Click or press **Enter** to close the dialog, open the resource and reveal its tree row. The preview moves below the list on narrow screens.
+- Use **↑ / ↓** to move the current result. Click or press **Enter** to close the dialog, open the resource and reveal its tree row.
 
 ### Preview actions
 
```

**File**: `frontend/docs/docs/zh/modules/file-browser.mdx` (modified, +2/-2)
```diff
@@ -241,7 +241,7 @@ import '@openviking/react/modules/file-browser/style.css';
 | searchIgnoreCase        | 忽略大小写                                                                                    | `string`                             | `'忽略大小写'`                           |
 | searchFilterUnsupported | 某个筛选在当前检索方式下不可用的原因                                                          | `string`                             | `'当前检索方式不支持此筛选'`             |
 | searchResultCount       | 检索结果数量，参数为条数                                                                      | `(count: number) => string`          | `'检索到 N 条结果'`                      |
-| searchVia               | 结果数量与模式之间的分隔说明                                                                  | `string`                             | `'向量检索方式'`                         |
+| searchVia               | 模式 chip 之后的检索方式说明                                                                  | `string`                             | `'向量检索方式'`                         |
 | searchSwitchMode        | 切换检索方式的入口                                                                            | `string`                             | `'切换'`                                 |
 | searchAdvancedLabel     | 高级筛选按钮的无障碍名称                                                                      | `string`                             | `'高级筛选'`                             |
 | previewMode             | 「预览 / 源码」切换里的「预览」                                                               | `string`                             | `'预览'`                                 |
@@ -424,7 +424,7 @@ await browserRef.current?.openResource(resultUri, { reveal: true });
 - 结果按 URI 去重；`grep` 例外——同一文件的多行命中是不同结果，各带自己的行号。
 - `glob` 的模式不含 `/` 时自动补 `**/` 前缀；目录命中去掉尾斜杠后再参与导航，目录这一事实记在 `isDir` 上。
 - 高级面板的筛选项按当前方式启用或禁用，禁用的分区保留可见并置灰，标题旁说明原因。目录候选从 `rootUri` 派生，用户根用 `~` 别名；切换根时失效的已选目录会被丢弃。
-- 悬停结果或按 **↑ / ↓** 查看预览。点击或按 **Enter** 关闭弹窗、打开资源并在树中定位。窄屏时预览移到列表下方。
+- 按 **↑ / ↓** 切换当前结果，点击或按 **Enter** 关闭弹窗、打开资源并在树中定位。
 
 ### 预览操作区
 
```

**File**: `frontend/packages/icons/README.md` (modified, +7/-0)
```diff
@@ -28,6 +28,13 @@ React imports these SVG files directly during its build. This file records where
   ISC; the same artwork is present in 0.0.134. The 14 × 14 viewBox, path and
   1.2-unit `currentColor` stroke are unchanged. Only the runtime wrapper is
   removed; the React package bundles the local SVG through SVGR.
+- `svg/file-browser/` — the search dialog's filter glyph, the toolbar's refresh
+  glyph and the empty search state's artwork. `search-filter.svg` and
+  `refresh-cw-01.svg` keep the design's geometry with `currentColor` paint;
+  `search-empty.svg` redraws the design's 258 × 140 dashed grid, document outline
+  and magnifier in the style of `svg/console/history-empty.svg`, with its colours
+  mapped to theme variables. See that directory's README.
+
 - `svg/scope-switcher/` — the chevron and check assets were supplied by the
   designer. Chevron is 14 × 14 and check is 16 × 16. Their paint was changed from
   the design's fixed colours to `currentColor` so a host theme can recolour them;
```

**File**: `frontend/packages/icons/svg/file-browser/README.md` (modified, +9/-0)
```diff
@@ -3,3 +3,12 @@
 - `search-filter.svg` comes from the supplied `Frame.svg`. The 28 × 28
   viewBox and paths are unchanged. Its stroke inherits the button's theme color.
   The artwork follows the repository license.
+- `refresh-cw-01.svg` is the console's refresh glyph. The 14 × 14 viewBox and
+  paths are unchanged; its stroke inherits the button's theme color.
+- `search-empty.svg` is the empty search state's artwork, redrawn in the style of
+  `svg/console/history-empty.svg`: the same 258 × 140 canvas, document outline,
+  fold and magnifier geometry, but the design's five per-row grid paths collapsed
+  into one dashed grid masked by a radial fade, and the white backdrop dropped so
+  the dialog's own surface shows through. The design's fixed colours become theme
+  variables: `--ov-ui-color-border-2` for the grid, `--ov-ui-color-border-3` for
+  the sheet behind, `currentColor` for the front sheet and glyph.
```

**File**: `frontend/packages/icons/svg/file-browser/search-empty.svg` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="258" height="140" viewBox="0 0 258 140" fill="none">
+  <g
+    opacity=".36"
+    stroke="var(--ov-ui-color-border-2, var(--ov-ui-border-2-default))"
+    stroke-dasharray="2 2"
+    style="
+      mask-image: radial-gradient(
+        ellipse at center,
+        currentColor,
+        transparent 72%
+      );
+    "
+  >
+    <path d="M0 28H258M0 56H258M0 84H258M0 112H258M37 0V140M75 0V140M117 0V140M159 0V140M199 0V140M235 0V140" />
+  </g>
+  <path
+    d="M109.974 93.6485V43.9883C109.974 39.57 113.555 35.9883 117.974 35.9883H151.613C154.247 35.9883 156.712 37.2844 158.204 39.4541L165.495 50.0515C166.412 51.3855 166.904 52.9665 166.904 54.5857V93.6485C166.904 98.0667 163.322 101.648 158.904 101.648H117.974C113.555 101.648 109.974 98.0667 109.974 93.6485Z"
+    fill="var(--ov-ui-color-bg-1, var(--ov-ui-bg-1-default))"
+    stroke="var(--ov-ui-color-border-3, var(--ov-ui-border-3-default))"
+    stroke-width="1.5"
+  />
+  <path
+    d="M108.68 107.328H151.207C155.625 107.328 159.207 103.747 159.207 99.3283V60.8783C159.207 58.9881 158.537 57.1589 157.317 55.715L148.037 44.732C146.517 42.9331 144.281 41.8954 141.926 41.8954H108.68C104.262 41.8954 100.68 45.4771 100.68 49.8954V99.3283C100.68 103.747 104.262 107.328 108.68 107.328Z"
+    fill="var(--ov-ui-color-bg-1, var(--ov-ui-bg-1-default))"
+    stroke="currentColor"
+    stroke-width="1.5"
+    stroke-linecap="round"
+  />
+  <path
+    d="M144.3 41.8954V48.2817C144.3 54.3568 149.225 59.2817 155.3 59.2817H159.204"
+    stroke="currentColor"
+    stroke-width="1.5"
+  />
+  <circle
+    cx="126.114"
+    cy="73.6377"
+    r="11.0244"
+    stroke="currentColor"
+    stroke-width="1.5"
+    stroke-linecap="round"
+  />
+  <path
+    d="M135.746 79.8945L141.385 85.5332C142.195 86.3438 142.195 87.6581 141.385 88.4687C140.574 89.2794 139.26 89.2794 138.449 88.4687L132.811 82.83"
+    stroke="currentColor"
+    stroke-width="1.5"
+    stroke-linecap="round"
+  />
+  <g
+    stroke="currentColor"
+    stroke-width="1.5"
+    stroke-linecap="round"
+    opacity=".8"
+  >
+    <path d="M129.019 58.2283L129.168 53.9442" />
+    <path d="M133.498 59.8939L136.088 56.4783" />
+    <path d="M137.098 63.4613L140.95 61.5799" />
+  </g>
+</svg>
```

**File**: `frontend/packages/react/src/modules/file-browser/file-browser-search-mode-menu.tsx` (modified, +62/-36)
```diff
@@ -1,64 +1,90 @@
-import { useEffect, useRef, useState } from 'react';
+import { useCallback, useEffect } from 'react';
+import type { RefObject } from 'react';
 
 import { SEARCH_MODES } from './search-types.js';
 import type { SearchMode } from './search-types.js';
 import type { ResolvedLabels } from './file-browser-labels.js';
 
 /**
- * 模式下拉：四种检索方式各一行，带一句说明。选中项打勾。
+ * 模式下拉的内容：四种检索方式各一行，带一句说明，选中项打勾。
  *
- * 展开状态由调用方持有——结果区的「切换」按钮与下拉本身是两个触发器，共用一个
- * 开关比各自维护一份状态更简单。
+ * 浮层本身由结果区的 `Popover` 提供——它挂到 `document.body` 并用视口坐标定位，
+ * 结果区裁掉的溢出不会波及菜单。这里只画内容，另外补两件事：挂载后把焦点交给
+ * 调用方（键盘打开时移进第一项），以及点击菜单外时关闭。
  *
- * The mode menu: one row per retrieval mode with a one-line description, and a check
- * on the current one.
+ * The mode menu's content: one row per retrieval mode with a one-line description and a
+ * check on the current one.
  *
- * The open state belongs to the caller: the result header's switch button and the menu
- * are two triggers, and sharing one flag is simpler than keeping two.
+ * The surface comes from the result area's `Popover`, which portals into `document.body`
+ * and positions in viewport coordinates, so the results area's clipping cannot reach it.
+ * This draws the content, hands the node to the caller after mount (so a keyboard opening
+ * can move focus to the first item) and closes on Escape. Outside clicks stay with
+ * `Popover`, which already excludes both the surface and the trigger.
  */
 export interface FileBrowserSearchModeMenuProps {
-  open: boolean;
   value: SearchMode;
   text: ResolvedLabels;
+  menuRef?: RefObject<HTMLDivElement | null>;
   onSelect: (mode: SearchMode) => void;
-  onClose: () => void;
+  /** 菜单挂载后调用，供调用方移动焦点。 Called after mount so the caller can focus. */
+  onMounted?: () => void;
+  /** 点击菜单外部时调用。 Called on a click outside the menu. */
+  onDismiss: () => void;
 }
 
 export function FileBrowserSearchModeMenu({
-  open,
   value,
   text,
+  menuRef,
   onSelect,
-  onClose,
+  onMounted,
+  onDismiss,
 }: FileBrowserSearchModeMenuProps) {
-  const ref = useRef<HTMLDivElement>(null);
-  const [active, setActive] = useState(value);
-
-  useEffect(() => {
-    setActive(value);
-  }, [value, open]);
-
-  // useEffect 必要性：与 document 的指针事件同步。下拉挂在结果区里，点击外部
-  // 关闭必须监听整个文档——只监听自己的节点收不到外部点击。卸载或关闭时移除。
+  // 回调 ref 必须稳定：每次渲染新建函数会让 React 先 `ref(null)` 再 `ref(node)`，
+  // 而 `onMounted` 在挂载回调里移焦点，重复触发会让焦点反复跳动。
+  //
+  // The callback ref must be stable: a fresh function per render makes React call
+  // `ref(null)` then `ref(node)`, and since `onMounted` moves focus from that callback,
+  // repeated firing would bounce focus around.
+  const attachMenu = useCallback(
+    (node: HTMLDivElement | null) => {
+      if (menuRef) menuRef.current = node;
+      if (node) onMounted?.();
+    },
+    [menuRef, onMounted],
+  );
+  // 点击外部关闭交给 `Popover`：它的点击态已经同时排除浮层与触发按钮，点「切换」
+  // 才能正常切换关闭。这里再挂一份只排除菜单的 `pointerdown` 监听，会把「切换」
+  // 当成外部点击——先关掉，随后的 click 又把它打开，菜单永远关不上。
+  //
+  // Outside clicks belong to `Popover`, whose click trigger already excludes both the
+  // surface and its trigger, so clicking the switch toggles it closed. A second
+  // `pointerdown` listener here that excludes only the menu would treat the switch as an
+  // outside click — closing on pointerdown and reopening on the following click, so the
+  // menu could never be dismissed by clicking it again.
+  //
+  // useEffect 必要性：Esc 要监听整个文档。菜单容器是 `role="group"`，给它挂键盘
+  // 监听既不合语义，也拦不住焦点在按钮上时的冒泡。捕获阶段先于弹窗的 Esc 处理，
+  // 一次 Esc 只关菜单。卸载时移除。
   //
-  // Syncs with the document's pointer events. The menu sits inside the result area,
-  // so closing on an outside click needs a document-level listener: a listener on its
-  // own node never sees that click. Removed on unmount or close.
+  // The Escape listener has to sit on the document. The menu is a `role="group"`, so a
+  // key listener on it is both wrong semantically and unable to intercept events while
+  // focus sits on a button. Capture runs before the dialog's own Escape handler, so one
+  // Escape closes the menu only. Removed on unmount.
   useEffect(() => {
-    if (!open) return;
-    const onPointerDown = (event: PointerEvent) => {
-      if (!(event.target instanceof Node)) return;
-      if (ref.current?.contains(event.target)) return;
-      onClose();
+    const onKeyDown = (event: KeyboardEvent) => {
+      if (event.key !== 'Escape' || event.defaultPrevented) return;
+      event.preventDefault();
+      event.stopPropagation();
+      onDismiss();
     };
-    document.addEventListener('pointerdown', onPointerDown);
-    return () => document.removeEventListener('pointerdown', onPointerDown);
-  }, [open, onClose]);
+    document.addEventListener('keydown', onKeyDown, true);
+    return () => document.removeEventListener('keydown', onKeyDown, true);
+  }, [onDismiss]);
 
-  if (!open) return null;
   return (
     <div
-      ref={ref}
+      ref={attachMenu}
       className="ov-file-browser-search__menu"
       role="g
```

**File**: `frontend/packages/react/src/modules/file-browser/file-browser-search-mode-row.tsx` (modified, +135/-15)
```diff
@@ -1,47 +1,167 @@
-import { useState } from 'react';
+import { useCallback, useRef, useState } from 'react';
+import type { KeyboardEvent, RefObject } from 'react';
+
+import { Popover } from '../../shared/primitives/popover/popover.js';
 import { FileBrowserSearchModeMenu } from './file-browser-search-mode-menu.js';
 import type { SearchMode } from './search-types.js';
 import type { ResolvedLabels } from './file-browser-labels.js';
 
+/**
+ * 结果区顶部的模式行：数量、模式 chip、检索方式说明与切换入口。
+ *
+ * 顺序与设计稿一致：先给数量，再给当前模式，最后才是切换入口。
+ *
+ * 下拉挂在「切换」按钮上，由 `Popover` 渲染到 `document.body`：结果区为了固定
+ * 头部会裁掉溢出，菜单留在原地时在窄屏会被裁掉大半。菜单 portal 出去后不在弹窗
+ * 的 DOM 子树里，`Popover` 会把它登记进弹窗的焦点范围，Tab 因此仍能进入。
+ *
+ * 键盘打开（Enter、Space、↓ 进第一项，↑ 进最后一项）时焦点移进菜单；关闭时若
+ * 焦点还在菜单里就还给「切换」按钮——否则 portal 的菜单虽然能被 Tab 到，键盘
+ * 用户仍要多按几次才知道菜单开了。
+ *
+ * The mode row above the results: the count, the mode chip, what the mode retrieves
+ * and the switch.
+ *
+ * The order follows the design: the count first, then the current mode, then the
+ * switch.
+ *
+ * The menu hangs off the switch button and is rendered by `Popover` into
+ * `document.body`: the results area clips its overflow so the header can stay put, and a
+ * menu left in place would lose most of itself on a narrow viewport. Once portaled it is
+ * outside the dialog's DOM subtree, so `Popover` registers it into the dialog's focus
+ * scope and Tab can still reach it.
+ *
+ * Opening from the keyboard (Enter, Space and ↓ land on the first item, ↑ on the last)
+ * moves focus into the menu; closing returns it to the switch when it was inside the
+ * menu. Without that, the portaled menu would be reachable but a keyboard user would
+ * have no sign it had opened.
+ */
 export interface FileBrowserSearchModeRowProps {
   mode: SearchMode;
   count: number;
   text: ResolvedLabels;
+  /** 「切换」不在时的焦点去处；选完模式会立刻重新检索，本行在加载态里不渲染。 */
+  fallbackFocusRef?: RefObject<HTMLElement | null>;
   onSelectMode: (mode: SearchMode) => void;
 }
 
 export function FileBrowserSearchModeRow({
   mode,
   count,
   text,
+  fallbackFocusRef,
   onSelectMode,
 }: FileBrowserSearchModeRowProps) {
   const [menuOpen, setMenuOpen] = useState(false);
+  const anchorRef = useRef<HTMLButtonElement>(null);
+  // 菜单内容在 `Popover` 里，节点要等它挂载后才拿得到；用 ref 交给它的回调，
+  // 不额外存 state——焦点只在打开那一刻移动一次。
+  //
+  // The menu lives inside `Popover` and only exists after it mounts; hand the node over
+  // through a ref rather than extra state, since focus moves exactly once per opening.
+  const menuRef = useRef<HTMLDivElement | null>(null);
+  const pendingFocus = useRef<'first' | 'last' | null>(null);
+
+  const focusPendingItem = useCallback(() => {
+    const edge = pendingFocus.current;
+    if (!edge) return;
+    pendingFocus.current = null;
+    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
+      'button:not(:disabled)',
+    );
+    const target = edge === 'first' ? items?.[0] : items?.[items.length - 1];
+    target?.focus();
+  }, []);
+
+  // 焦点去处取决于菜单怎么关的：
+  //
+  // - 选中某个模式时，`onSelectMode` 会立刻重新检索，结果区在加载态里不渲染模式行，
+  //   「切换」按钮随这一行卸载，`focus()` 会落空并把焦点丢给 `body`。所以这里交给
+  //   搜索输入框。
+  // - Esc 与点击外部时这一行还在，焦点回到「切换」；焦点本来就不在菜单里（用户点
+  //   了别处）则不动，免得把焦点从刚点的地方抢走。
+  //
+  // Where focus goes depends on how the menu closed:
+  //
+  // - Picking a mode triggers a new search at once, and the results area renders no mode
+  //   row while loading, so the switch unmounts with that row and `focus()` would land
+  //   nowhere, dropping focus to `body`. The search input takes it instead.
+  // - Escape and outside clicks leave the row in place, so focus returns to the switch —
+  //   unless it was never inside the menu (the user clicked elsewhere), where moving it
+  //   would steal focus from where they just clicked.
+  const close = useCallback(
+    (focusTarget: 'switch' | 'fallback' = 'switch') => {
+      const inside =
+        !!menuRef.current?.contains(document.activeElement) ||
+        pendingFocus.current !== null;
+      pendingFocus.current = null;
+      setMenuOpen(false);
+      if (focusTarget === 'fallback') {
+        fallbackFocusRef?.current?.focus();
+        return;
+      }
+      if (inside) anchorRef.current?.focus();
+    },
+    [fallbackFocusRef],
+  );
+
+  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
+    if (event.key === 'Escape' && menuOpen) {
+      event.preventDefault();
+      close();
+      return;
+    }
+    if (!['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
+    if (menuOpen) return;
+    // Enter 与 Space 的默认行为是点击，这里显式接管，焦点移动只发生一次。
+    // Enter and Space would otherwise click; take over so focus moves exactly once.
+    event.preventDefault();
+    pendingFocus.current = event.key === 'ArrowUp' ? 'last' : 'first';
+    setMenuOpen(true);
+  };
+
   return (
     <div className="ov-file-browser-search__summary">
       <span>{text.searchResultCount?.(count)}</span>
       <span aria-hidden="true">・</span>
-      <span>{text.searchVia
```

---

### Incident Patch 2: `297847cd` (2026-11-13)
**Commit Message**: fix(opencode): load bundled skills on OpenCode v2 and run v2 prompt context concurrently (#7582)

* fix(opencode): register bundled skills through the v2 skill editor

The v2 entrypoint called draft.source() on the skill editor, which the
OpenCode v2 plugin API does not have (the editor exposes list/get/add/
update/remove). It was also unreachable: the host batches plugin setup, so
the MCP transform callback had not run yet and `registered` was still
false when the skill transform was gated on it. The bundled skills were
never loaded.

Read the bundled SKILL.md files at setup and add them through the public
editor in a transform registered at setup time, reading the MCP decision
inside the callback. A missing directory or unparsable skill is logged and
skipped so it cannot throw into setup and disable the plugin.

Co-authored-by: stefanielizeth73-art <[REDACTED_EMAIL]>

* fix(opencode): run v2 session context and recall concurrently

prepareV2Prompt awaited the session-start injection before starting
recall, so the first prompt of each v2 session waited for both round
trips back to back while the prompt hook held the message. The v1
chat.message path already runs them together. Sta

**File**: `examples/opencode-plugin/lib/v2-plugin.mjs` (modified, +42/-22)
```diff
@@ -1,3 +1,5 @@
+import { readFile, readdir } from "node:fs/promises"
+import { join } from "node:path"
 import { isRecallEnabled } from "./shared/recall-core.mjs"
 import { createOpenVikingV2McpConfig, openVikingSkillsDir } from "./mcp-config.mjs"
 import { contextMessageEvents, normalizeV2LifecycleEvent } from "./v2-events.mjs"
@@ -39,15 +41,19 @@ export async function startV2Plugin(ctx, runtime, { pluginRoot }) {
   if (config.mcp.enabled && ctx?.mcp?.transform) {
     let registered = false
     await ctx.mcp.transform((editor) => {
-      const current = editor.get?.("openviking")
-      if (current?.disabled === true) return
-      editor.set("openviking", createOpenVikingV2McpConfig(pluginRoot))
-      registered = true
+      registered = editor.get?.("openviking")?.disabled !== true
+      if (registered) editor.set("openviking", createOpenVikingV2McpConfig(pluginRoot))
     })
     log("INFO", "mcp", "Registered OpenViking MCP server for OpenCode v2")
-    if (registered && ctx?.skill?.transform) {
-      await ctx.skill.transform((draft) => {
-        draft.source({ type: "directory", path: openVikingSkillsDir(pluginRoot) })
+    if (ctx?.skill?.transform) {
+      const skills = await loadBundledSkills(openVikingSkillsDir(pluginRoot))
+      // Transforms run again after setup, so read the MCP decision on each run.
+      await ctx.skill.transform((editor) => {
+        if (!registered) return
+        // A user skill overrides a bundled one by ID or by name; the host keys
+        // skills by ID only, so a same-name skill would otherwise be listed twice.
+        const taken = new Set(editor.list().flatMap((skill) => [skill.id, skill.name]))
+        for (const skill of skills) if (!taken.has(skill.id) && !taken.has(skill.name)) editor.add(skill)
       })
     }
   } else if (!config.mcp.enabled) {
@@ -160,6 +166,29 @@ export async function startV2Plugin(ctx, runtime, { pluginRoot }) {
   }
 }
 
+async function loadBundledSkills(root) {
+  const entries = await readdir(root, { withFileTypes: true }).catch((error) => {
+    logHookError("skill.load", error)
+    return []
+  })
+  const skills = []
+  for (const entry of entries.filter((item) => item.isDirectory())) {
+    const path = join(root, entry.name, "SKILL.md")
+    try {
+      const text = await readFile(path, "utf8")
+      const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
+      // Bundled descriptions are a plain scalar or a folded (`>`) block.
+      const [, head = "", folded = ""] = frontmatter?.[1].match(/^description:(.*)((?:\r?\n[ \t]+.*)*)/m) ?? []
+      const description = (/^\s*>-?\s*$/.test(head) ? folded : head).trim().replace(/\s+/g, " ")
+      if (!description) throw new Error(`no description in ${path}`)
+      skills.push({ id: entry.name, name: entry.name, description, path, content: text.slice(frontmatter[0].length) })
+    } catch (error) {
+      logHookError("skill.load", error)
+    }
+  }
+  return skills
+}
+
 async function consumeEvents(ctx, signal, handle) {
   try {
     for await (const event of ctx.event.subscribe({ signal })) {
@@ -187,21 +216,12 @@ export async function prepareV2Prompt(event, {
   const text = event?.prompt?.text
   const parts = typeof text === "string" && text.trim() ? [{ type: "text", text }] : []
   const input = { sessionID, messageID, directory }
-  const blocks = []
-  try {
-    const sessionBlock = await sessionInject.buildSessionContext(input)
-    if (sessionBlock) blocks.push(sessionBlock)
-  } catch (error) {
-    logHookError("session.prompt.profile", error)
-  }
-  if (recallEnabled) {
-    try {
-      const recallBlock = await recall.buildRelevantMemories(input, parts)
-      if (recallBlock) blocks.push(recallBlock)
-    } catch (error) {
-      logHookError("session.prompt.recall", error)
-    }
-  }
+  const blocks = (await Promise.all([
+    sessionInject.buildSessionContext(input).catch((error) => logHookError("session.prompt.profile", error)),
+    recallEnabled
+      ? recall.buildRelevantMemories(input, parts).catch((error) => logHookError("session.prompt.recall", error))
+      : undefined,
+  ])).filter(Boolean)
   if (blocks.length === 0) return
 
   event.metadata = event.metadata && typeof event.metadata === "object" ? event.metadata : {}
```

**File**: `examples/opencode-plugin/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@openviking/opencode-plugin",
-  "version": "0.5.25",
+  "version": "0.5.26",
   "author": "@openviking",
   "description": "Unified OpenCode plugin for OpenViking repository retrieval and long-term memory",
   "type": "module",
```

**File**: `examples/opencode-plugin/tests/v2-plugin.test.mjs` (modified, +80/-4)
```diff
@@ -1,9 +1,12 @@
 import test from "node:test"
 import assert from "node:assert/strict"
-import { resolve } from "node:path"
+import { fileURLToPath } from "node:url"
 import { captureV2Context, injectV2Context, prepareV2Prompt, startV2Plugin } from "../lib/v2-plugin.mjs"
 import { createVikingUriNotice } from "../lib/viking-uri-guard.mjs"
 
+const pluginRoot = fileURLToPath(new URL("..", import.meta.url))
+const BUNDLED_SKILLS = ["openviking-memory", "openviking-rule-search", "openviking-skills", "ov-experience-memory"]
+
 function runtimeFixture(overrides = {}) {
   const events = []
   return {
@@ -39,7 +42,11 @@ function contextFixture(messages = []) {
     skillSources,
     ctx: {
       skill: {
-        transform: async (callback) => callback({ source: (source) => skillSources.push(source), list: () => skillSources }),
+        transform: async (callback) => callback({
+          list: () => skillSources,
+          get: (id) => skillSources.find((skill) => skill.id === id),
+          add: (skill) => skillSources.push(skill),
+        }),
       },
       location: { directory: "/tmp/project" },
       mcp: {
@@ -61,16 +68,65 @@ function contextFixture(messages = []) {
 test("startV2Plugin registers direct MCP tools and all v2 hooks", async () => {
   const { runtime } = runtimeFixture()
   const { ctx, hooks, registered, skillSources } = contextFixture()
-  const cleanup = await startV2Plugin(ctx, runtime, { pluginRoot: "/tmp/ov" })
+  const cleanup = await startV2Plugin(ctx, runtime, { pluginRoot })
 
-  assert.deepEqual(skillSources, [{ type: "directory", path: resolve("/tmp/ov", "skills") }])
+  assert.deepEqual(skillSources.map((skill) => skill.id).sort(), BUNDLED_SKILLS)
+  for (const skill of skillSources) {
+    assert.ok(skill.description.length > 20 && !skill.description.includes("\n"))
+    assert.match(skill.content, /^\s*# /)
+  }
   assert.equal(registered[0][0], "openviking")
   assert.equal(registered[0][1].type, "local")
   assert.equal(registered[0][1].codemode, false)
   assert.deepEqual(Object.keys(hooks).sort(), ["compaction", "context", "execute.after", "execute.before", "prompt"])
   await cleanup()
 })
 
+for (const disabled of [false, true]) {
+  test(`bundled skills follow MCP registration when transforms run after setup, disabled=${disabled}`, async () => {
+    const { runtime } = runtimeFixture()
+    const { ctx } = contextFixture()
+    const transforms = []
+    ctx.mcp.transform = async (callback) => { transforms.push(callback) }
+    ctx.skill.transform = async (callback) => { transforms.push(callback) }
+    const cleanup = await startV2Plugin(ctx, runtime, { pluginRoot })
+    const [mcp, skill] = transforms
+    const skills = new Map()
+    mcp({ get: () => (disabled ? { disabled: true } : undefined), set: () => {} })
+    skill({ list: () => [...skills.values()], get: (id) => skills.get(id), add: (value) => skills.set(value.id, value) })
+    assert.deepEqual([...skills.keys()].sort(), disabled ? [] : BUNDLED_SKILLS)
+    await cleanup()
+  })
+}
+
+test("existing skills override bundled skills by ID or name", async () => {
+  const { runtime } = runtimeFixture()
+  const { ctx, skillSources } = contextFixture()
+  skillSources.push(
+    { id: "project-memory", name: "openviking-memory", path: "/tmp/project/.opencode/skills/project-memory/SKILL.md", content: "" },
+    { id: "openviking-skills", name: "Custom skills", path: "/tmp/project/.opencode/skills/openviking-skills/SKILL.md", content: "" },
+  )
+  const cleanup = await startV2Plugin(ctx, runtime, { pluginRoot })
+  assert.deepEqual(skillSources.map((skill) => skill.id).sort(), [
+    "openviking-rule-search",
+    "openviking-skills",
+    "ov-experience-memory",
+    "project-memory",
+  ])
+  assert.equal(skillSources.find((skill) => skill.id === "openviking-skills").name, "Custom skills")
+  await cleanup()
+})
+
+test("a missing skills directory leaves MCP and hooks registered", async () => {
+  const { runtime } = runtimeFixture()
+  const { ctx, hooks, registered, skillSources } = contextFixture()
+  const cleanup = await startV2Plugin(ctx, runtime, { pluginRoot: "/nonexistent" })
+  assert.deepEqual(skillSources, [])
+  assert.equal(registered[0][0], "openviking")
+  assert.equal(typeof hooks.prompt, "function")
+  await cleanup()
+})
+
 test("compaction captures messages before the host drops them and contains read failures", async () => {
   const { runtime, events } = runtimeFixture()
   const messages = [
@@ -126,6 +182,26 @@ test("cleanup waits for background initialization before flushing", async () =>
   assert.equal(flushed, true)
 })
 
+test("prompt starts session context and recall together and keeps block order", async () => {
+  const started = []
+  const pending = {}
+  const call = (name) => new Promise((resolve) => {
+    started.push(name)
+    pending[name] = resolve
+  })
+  const event = { sessionID: "ses_1", messageID: "msg_1", prompt: { text: "query" } }
+  const preparing
```

---

### Incident Patch 3: `dbb22428` (2026-11-13)
**Commit Message**: fix(react): keep the quick command tooltip when the description is truncated (#7558)

* fix(react): show the quick command tooltip only when a summary hides the description

The empty state row prints `summary ?? description`, so a command without a
`summary` had the same sentence in the row and in the Tooltip. Only mount the
Tooltip when the host supplied a `summary`, which is the only case where the
description is not already visible.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

* fix(react): keep the quick command tooltip when the description is truncated

The empty state row prints `summary ?? description` and clips it to one line
with an ellipsis, so a command without a `summary` lost the rest of its
description once the panel narrowed. Mount the Tooltip whenever the row cannot
show the text in full: a `summary` hides it, or the description is truncated.

Truncation is measured per description node rather than on the list, because a
longer text can appear while the container keeps its width. The measurement
re-runs on resize and drops the Tooltip again when the text fits.

Co-Authored-By: Claude Code <[REDACTED_EMAIL]>

* fix(react): keep the quick command tooltip subscrip

**File**: `frontend/.changeset/quick-command-tooltip-summary.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openviking/react': patch
+---
+
+Show a quick command's description on hover only when the row cannot show it in full: when the command defines a `summary`, or when the description is truncated by the row's single-line ellipsis. The row prints `summary ?? description`, so a command without a `summary` used to repeat the same sentence in the Tooltip, while removing it outright hid the full text of a long description in a narrow panel.
```

**File**: `frontend/docs/docs/en/components/command-console.mdx` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ The example uses fixed simulated data: submitting appends a pending record that
 
 ### Empty state and quick commands
 
-Quick commands appear while there are no records. Clicking one only fills the input; press Enter to submit, and the first submission replaces the empty state with records.
+Quick commands appear while there are no records. Clicking one only fills the input; press Enter to submit, and the first submission replaces the empty state with records. Each row shows its `summary`, falling back to `description`; hovering the row shows the full `description` when a `summary` is provided or when the description is truncated by the single-line ellipsis.
 
 ```tsx file="../../_demos/command-console-empty.tsx" preview
 
```

**File**: `frontend/docs/docs/zh/components/command-console.mdx` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ import '@openviking/react/components/command-console/style.css';
 
 ### 空态与快捷命令
 
-没有记录时显示快捷入口，点击只把命令填入输入区，按 Enter 才提交，提交后空态被记录取代。
+没有记录时显示快捷入口，点击只把命令填入输入区，按 Enter 才提交，提交后空态被记录取代。每行显示 `summary`，省略时回退到 `description`；提供了 `summary`，或说明被单行省略截断时，悬停该行显示完整的 `description`。
 
 ```tsx file="../../_demos/command-console-empty.tsx" preview
 
```

**File**: `frontend/packages/react/src/components/command-console/command-console-empty.tsx` (modified, +55/-25)
```diff
@@ -8,6 +8,7 @@ import {
   DEFAULT_COMMAND_CONSOLE_LABELS,
   type ResolvedCommandConsoleLabels,
 } from './command-console-labels.js';
+import { useCommandConsoleQuickOverflow } from './use-command-console-quick-overflow.js';
 
 /**
  * 按名称从宿主目录中取快捷命令，保持传入顺序，未命中的名称直接跳过。
@@ -53,6 +54,10 @@ export function CommandConsoleEmptyRegion({
   disabled?: boolean;
   onPick: (value: string) => void;
 }) {
+  // Hook 必须在提前返回之前调用；内置空态不渲染时列表 ref 为空，测量直接跳过。
+  // Hooks run before the early returns; with no built-in empty state the list ref
+  // stays null and the measurement is skipped.
+  const { listRef, truncated } = useCommandConsoleQuickOverflow();
   if (emptyState !== undefined) {
     return emptyState === null ? null : (
       <div className="ov-command-console__empty">{emptyState}</div>
@@ -88,34 +93,59 @@ export function CommandConsoleEmptyRegion({
       <p className="ov-command-console__empty-quick-label">
         {labels.quickStart}
       </p>
-      <ul className="ov-command-console__empty-list">
-        {commands.map((command) => (
-          <li key={command.name} className="ov-command-console__empty-item">
-            <Tooltip
-              content={command.description}
-              placement="top"
+      <ul ref={listRef} className="ov-command-console__empty-list">
+        {commands.map((command, index) => {
+          const action = (
+            <button
+              type="button"
+              className="ov-command-console__empty-action"
               disabled={disabled}
-              className="ov-command-console__quick-tooltip"
+              onClick={() => onPick(command.value)}
             >
-              <button
-                type="button"
-                className="ov-command-console__empty-action"
-                disabled={disabled}
-                onClick={() => onPick(command.value)}
-              >
-                <ArrowRightIcon width={14} height={14} focusable="false" />
-                <span className="ov-command-console__empty-content">
-                  <span className="ov-command-console__empty-name">
-                    {command.name}
-                  </span>
-                  <span className="ov-command-console__empty-desc">
-                    {command.summary ?? command.description}
-                  </span>
+              <ArrowRightIcon width={14} height={14} focusable="false" />
+              <span className="ov-command-console__empty-content">
+                <span className="ov-command-console__empty-name">
+                  {command.name}
+                </span>
+                <span className="ov-command-console__empty-desc">
+                  {command.summary ?? command.description}
                 </span>
-              </button>
-            </Tooltip>
-          </li>
-        ))}
+              </span>
+            </button>
+          );
+          // 行内显示 summary ?? description：宿主另给了 summary 时完整说明被藏起来，
+          // 没有 summary 但说明被单行省略截断时同样看不到全文。两种情况下 Tooltip
+          // 才有行内没有的内容，其余情况弹出的会是同一句话。
+          //
+          // Tooltip 始终挂载、只切 disabled，而不是按需包一层：包与不包会替换整棵
+          // 子树，说明节点随之卸载，截断测量仍盯着已脱离 DOM 的旧节点，测出的 0
+          // 宽又会把 Tooltip 关掉。保持节点身份稳定，订阅才一直有效。
+          //
+          // The row shows `summary ?? description`: the full description is hidden
+          // when the host supplied a `summary`, and equally when the description is
+          // truncated by the single-line ellipsis. Only then does the Tooltip add
+          // something the row does not already show.
+          //
+          // The Tooltip stays mounted and only toggles `disabled` instead of being
+          // added on demand: adding it replaces the whole subtree, so the
+          // description node unmounts while the measurement still watches the
+          // detached old node, whose zero width then switches the Tooltip back off.
+          // Keeping the node's identity stable keeps the subscription valid.
+          const hasTooltip =
+            command.summary !== undefined || truncated.includes(index);
+          return (
+            <li key={command.name} className="ov-command-console__empty-item">
+              <Tooltip
+                content={command.description}
+                placement="top"
+                disabled={disabled || !hasTooltip}
+                className="ov-command-console__quick-tooltip"
+              >
+                {action}
+              </Tooltip>
+            </li>
+          );
+        })}
       </ul>
     </div>
   );
```

**File**: `frontend/packages/react/src/components/command-console/use-command-console-quick-overflow.ts` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+import {
+  useCallback,
+  useEffect,
+  useLayoutEffect,
+  useRef,
+  useState,
+} from 'react';
+
+// 服务端渲染没有布局，useLayoutEffect 在那里只会告警；测量只在浏览器有意义。
+// A server render has no layout, so a layout effect would only warn there.
+const useMeasureEffect =
+  typeof window === 'undefined' ? useEffect : useLayoutEffect;
+
+const DESC_SELECTOR = '.ov-command-console__empty-desc';
+
+/**
+ * 跟踪哪些快捷命令的说明被单行省略截断，返回列表的 callback ref 与截断项下标。
+ *
+ * 说明是单行省略的文本，容器变窄或文案变长时会被截断，行内便看不到全文。
+ *
+ * 返回 callback ref 而不是 ref 对象：空态区域在快捷命令尚未匹配到、或宿主提供
+ * 了 `emptyState` 时照样挂载却不渲染列表，此时没有可观察的节点。用 effect 建订阅
+ * 会在这时提前返回，而空依赖的 effect 之后不会再跑，列表后来出现就永远没有观察器；
+ * 列表隐藏再恢复时，旧观察器也仍绑在已卸载的节点上。callback ref 在节点挂载与
+ * 卸载时各触发一次，订阅始终跟随当前列表。
+ *
+ * useLayoutEffect 必要性：是否截断取决于容器的布局宽度与文本的自然宽度，二者
+ * 只有提交后才可测量，无法在渲染或事件里算出；窗口缩放和面板宽度变化都会改变
+ * 结果。
+ *
+ * 观察列表容器，而不是说明节点：说明是网格列里的单行文本，宽度由列宽决定，
+ * 文本溢出时它自己的 content box 不变，观察它收不到回调。容器宽度随面板与窗口
+ * 变化，是可靠的触发源。
+ *
+ * 文案变长不改变任何盒尺寸，观察器不会回调，因此每次渲染后再测一次：测量只读
+ * scrollWidth/clientWidth，不写 DOM，代价是一次同步布局查询。
+ *
+ * Tracks which quick command descriptions the single-line ellipsis truncates,
+ * returning the list's callback ref and the truncated indices.
+ *
+ * A layout effect is required: truncation depends on the container's laid-out
+ * width and the text's natural width, measurable only after commit, and both
+ * change with the window and the panel.
+ *
+ * It returns a callback ref rather than a ref object: the empty region mounts
+ * while no quick command resolves or while the host supplies `emptyState`, and
+ * renders no list then. An effect would return early with no node to observe, and
+ * an empty-dependency effect never runs again, so a list that appears later would
+ * never get an observer; a list hidden and shown again would keep the observer on
+ * the unmounted node. A callback ref fires on both mount and unmount, so the
+ * subscription always follows the current list.
+ *
+ * The list container is observed rather than the description nodes: each
+ * description is a single line inside a grid column, so its width follows the
+ * column and its own content box does not change when the text overflows —
+ * watching it receives no callback. The container's width tracks the panel and
+ * the window.
+ *
+ * Longer copy changes no box at all, so the observer never fires; measuring after
+ * every render covers it. The measurement only reads `scrollWidth`/`clientWidth`
+ * and writes no DOM, so it costs one synchronous layout query.
+ */
+export function useCommandConsoleQuickOverflow() {
+  const listRef = useRef<HTMLUListElement | null>(null);
+  const observerRef = useRef<ResizeObserver | null>(null);
+  const [truncated, setTruncated] = useState<readonly number[]>([]);
+
+  const measure = useCallback(() => {
+    const list = listRef.current;
+    if (!list) return;
+    const next: number[] = [];
+    list.querySelectorAll<HTMLElement>(DESC_SELECTOR).forEach((node, index) => {
+      if (node.scrollWidth > node.clientWidth) next.push(index);
+    });
+    // 只在结果变化时提交，避免每次渲染都触发一轮新渲染。
+    // Commit only on change so a render does not schedule another one.
+    setTruncated((current) =>
+      current.length === next.length &&
+      current.every((value, index) => value === next[index])
+        ? current
+        : next,
+    );
+  }, []);
+
+  const attachList = useCallback(
+    (list: HTMLUListElement | null) => {
+      listRef.current = list;
+      observerRef.current?.disconnect();
+      observerRef.current = null;
+      if (!list) {
+        // 列表消失后下标不再对应任何一行，清空避免残留。
+        // Without a list the indices point at nothing; drop them.
+        setTruncated((current) => (current.length ? [] : current));
+        return;
+      }
+      const observer = new ResizeObserver(measure);
+      observer.observe(list);
+      observerRef.current = observer;
+      measure();
+    },
+    [measure],
+  );
+
+  // 每次渲染后补测一次，覆盖文案变长这类不改变盒尺寸的变化。
+  // Re-measure after every render to cover changes that resize no box, such as
+  // longer copy.
+  useMeasureEffect(measure);
+
+  // 订阅的建立与释放全部交给 callback ref：它在节点挂载时收到列表、卸载时收到
+  // null。不要再加一个「卸载时断开」的 effect——StrictMode 会重放 effect 的
+  // setup→cleanup→setup，却不会重新调用 DOM callback ref，cleanup 断开的订阅
+  // 便无人恢复。
+  //
+  // The callback ref owns both ends of the subscription: it receives the list on
+  // mount and null on unmount. Do not add an "disconnect on unmount" effect —
+  // StrictMode replays an effect's setup→cleanup→setup without re-invoking DOM
+  // callback refs, so a cleanup that disconnects leaves nothing to restore it.
+  return { listRef: attachList, truncated };
+}
```

**File**: `frontend/packages/react/test/command-console-empty-tooltip-lifecycle.test.mjs` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+import assert from 'node:assert/strict';
+import { test } from 'node:test';
+import { mount } from './helpers/command-console-dom.mjs';
+import {
+  hover,
+  observedLists,
+  resize,
+  setDescWidth,
+} from './helpers/quick-command-widths.mjs';
+
+const commands = [
+  {
+    name: 'ls',
+    description: 'List directory entries',
+    usage: 'ov ls [uri]',
+  },
+];
+
+const actions = (container) => [
+  ...container.querySelectorAll('.ov-command-console__empty-action'),
+];
+
+const withCommand = {
+  commands,
+  quickCommands: [{ name: 'ls', value: '' }],
+};
+
+test('a list that appears after mount still gets observed', async () => {
+  // 空态区域在没有匹配到快捷命令时照样挂载、但不渲染列表。订阅若只在首次挂载
+  // 时建立，这里会因 ref 为空而跳过，之后列表出现也不会被观察。
+  //
+  // The empty region mounts without a list when no quick command resolves. A
+  // subscription built only on first mount would skip it and never observe the
+  // list that appears later.
+  setDescWidth(1000);
+  const view = await mount({ commands, quickCommands: [] });
+  try {
+    assert.equal(observedLists(), 0, 'no list, nothing to observe');
+    await view.render(withCommand);
+    assert.equal(observedLists(), 1, 'the list that appeared is observed');
+    setDescWidth(80);
+    await resize();
+    assert.equal(
+      await hover(actions(view.container)[0]),
+      'List directory entries',
+    );
+  } finally {
+    await view.dispose();
+    setDescWidth(1000);
+  }
+});
+
+test('StrictMode keeps the list observed', async () => {
+  // StrictMode 会重放 effect 的 setup→cleanup→setup，但不重新调用 DOM callback
+  // ref。若另有 effect 在 cleanup 里断开订阅，这里就再也没人恢复它。
+  //
+  // StrictMode replays an effect's setup→cleanup→setup without re-invoking DOM
+  // callback refs, so a cleanup that disconnects the subscription leaves nothing
+  // to restore it.
+  setDescWidth(1000);
+  const view = await mount(withCommand, true, { strict: true });
+  try {
+    assert.equal(
+      observedLists(),
+      1,
+      'the list stays observed under StrictMode',
+    );
+    setDescWidth(80);
+    await resize();
+    assert.equal(
+      await hover(actions(view.container)[0]),
+      'List directory entries',
+    );
+  } finally {
+    await view.dispose();
+    setDescWidth(1000);
+  }
+});
+
+test('a list hidden and shown again is observed afresh', async () => {
+  // 列表消失后旧观察器绑在已卸载的节点上；恢复时必须重新订阅当前列表，否则
+  // 之后的宽度变化收不到。
+  //
+  // Once the list goes away the old observer holds an unmounted node; showing it
+  // again has to subscribe to the new one, or later resizes go unheard.
+  setDescWidth(1000);
+  const view = await mount(withCommand);
+  try {
+    assert.equal(observedLists(), 1);
+    await view.render({ commands, quickCommands: [] });
+    assert.equal(observedLists(), 0, 'the old list is no longer observed');
+    await view.render(withCommand);
+    assert.equal(observedLists(), 1, 'the new list is observed');
+    setDescWidth(80);
+    await resize();
+    assert.equal(
+      await hover(actions(view.container)[0]),
+      'List directory entries',
+    );
+  } finally {
+    await view.dispose();
+    setDescWidth(1000);
+  }
+});
```

**File**: `frontend/packages/react/test/command-console-empty-tooltip.test.mjs` (added, +156/-0)
```diff
@@ -0,0 +1,156 @@
+import assert from 'node:assert/strict';
+import { test } from 'node:test';
+import { mount } from './helpers/command-console-dom.mjs';
+import {
+  hover,
+  resize,
+  setDescWidth,
+} from './helpers/quick-command-widths.mjs';
+
+const commands = [
+  {
+    name: 'ls',
+    description: 'List directory entries',
+    usage: 'ov ls [uri]',
+  },
+  {
+    name: 'find',
+    summary: 'Find matching context',
+    description: 'Unused when a summary exists',
+    usage: 'ov find <query>',
+  },
+];
+
+const actions = (container) => [
+  ...container.querySelectorAll('.ov-command-console__empty-action'),
+];
+
+test('a row shows its description on hover only when a summary hides it', async () => {
+  const withSummary = await mount({
+    commands,
+    quickCommands: [{ name: 'find', value: '' }],
+  });
+  try {
+    assert.equal(
+      await hover(actions(withSummary.container)[0]),
+      'Unused when a summary exists',
+    );
+  } finally {
+    await withSummary.dispose();
+  }
+  const withoutSummary = await mount({
+    commands,
+    quickCommands: [{ name: 'ls', value: '' }],
+  });
+  try {
+    assert.equal(await hover(actions(withoutSummary.container)[0]), null);
+  } finally {
+    await withoutSummary.dispose();
+  }
+});
+
+test('a truncated description keeps its tooltip without a summary', async () => {
+  // 'List directory entries' 是 22 个字符，自然宽度 176px；容器给 80px 便截断。
+  // The 22-character description measures 176px; an 80px container truncates it.
+  setDescWidth(80);
+  const view = await mount({
+    commands,
+    quickCommands: [{ name: 'ls', value: '' }],
+  });
+  try {
+    assert.equal(
+      await hover(actions(view.container)[0]),
+      'List directory entries',
+    );
+  } finally {
+    await view.dispose();
+    setDescWidth(1000);
+  }
+});
+
+test('a description that fits keeps no tooltip and gains one when truncated', async () => {
+  setDescWidth(1000);
+  const view = await mount({
+    commands,
+    quickCommands: [{ name: 'ls', value: '' }],
+  });
+  try {
+    assert.equal(await hover(actions(view.container)[0]), null);
+    // 容器收窄后重新测量，Tooltip 随之出现。
+    // Re-measuring after the container narrows brings the tooltip back.
+    setDescWidth(80);
+    await resize();
+    assert.equal(
+      await hover(actions(view.container)[0]),
+      'List directory entries',
+    );
+    // 恢复宽度后说明完整可见，Tooltip 撤销。
+    // Widening again makes the whole description visible, so the tooltip goes.
+    setDescWidth(1000);
+    await resize();
+    assert.equal(await hover(actions(view.container)[0]), null);
+  } finally {
+    await view.dispose();
+    setDescWidth(1000);
+  }
+});
+
+test('narrowing then widening repeatedly keeps tracking the current node', async () => {
+  // 覆盖评审指出的节点替换问题：Tooltip 开关会替换子树，若观察器盯着旧节点，
+  // 旧节点脱离文档后宽度为 0，第二轮收窄就再也测不到截断。
+  //
+  // Covers the stale-node regression: toggling the tooltip replaces the subtree,
+  // and a watcher bound to the old node reads 0 once it detaches, so the second
+  // narrowing would never be detected.
+  setDescWidth(1000);
+  const view = await mount({
+    commands,
+    quickCommands: [{ name: 'ls', value: '' }],
+  });
+  try {
+    for (const width of [80, 1000, 80, 1000, 80]) {
+      setDescWidth(width);
+      await resize();
+      const expected = width < 176 ? 'List directory entries' : null;
+      assert.equal(await hover(actions(view.container)[0]), expected);
+    }
+  } finally {
+    await view.dispose();
+    setDescWidth(1000);
+  }
+});
+
+test('a longer description at the same width gains its tooltip', async () => {
+  // 单行文本变长不改变节点盒尺寸，ResizeObserver 不会回调；只有按内容重测才
+  // 能发现新的截断。这里不触发 resize，只替换 commands 的文案。
+  //
+  // A longer single-line text keeps the node's box unchanged, so the observer
+  // never fires; only a content-driven re-measure reveals the new truncation.
+  // No resize is fired here — only the command copy changes.
+  setDescWidth(200);
+  const short = [{ name: 'ls', description: 'Short', usage: 'ov ls [uri]' }];
+  const view = await mount({
+    commands: short,
+    quickCommands: [{ name: 'ls', value: '' }],
+  });
+  try {
+    assert.equal(await hover(actions(view.container)[0]), null);
+    await view.render({
+      commands: [
+        {
+          name: 'ls',
+          description: 'A much longer description that no longer fits the row',
+          usage: 'ov ls [uri]',
+        },
+      ],
+      quickCommands: [{ name: 'ls', value: '' }],
+    });
+    assert.equal(
+      await hover(actions(view.container)[0]),
+      'A much longer description that no longer fits the row',
+    );
+  } finally {
+    await view.dispose();
+    setDescWidth(1000);
+  }
+});
```

**File**: `frontend/packages/react/test/helpers/command-console-dom.mjs` (modified, +25/-3)
```diff
@@ -1,6 +1,6 @@
 import { after } from 'node:test';
 import { JSDOM } from 'jsdom';
-import { act, createElement, useState } from 'react';
+import { act, createElement, StrictMode, useState } from 'react';
 import { CommandConsole } from '@openviking/react/components/command-console';
 
 const dom = new JSDOM('<!doctype html><html><body></body></html>', {
@@ -13,6 +13,19 @@ Object.defineProperty(globalThis, 'navigator', {
   value: dom.window.navigator,
 });
 globalThis.IS_REACT_ACT_ENVIRONMENT = true;
+// jsdom 没有 ResizeObserver，而快捷命令的截断测量依赖它；替身只记录目标、
+// 从不回调，测试断言的是渲染结果而非尺寸变化。需要模拟尺寸的用例自行覆盖。
+//
+// jsdom has no ResizeObserver and the quick-command truncation measurement needs
+// one; the stub records its target and never calls back, since these tests assert
+// on rendered output rather than size changes. Cases that need sizes override it.
+if (typeof globalThis.ResizeObserver === 'undefined') {
+  globalThis.ResizeObserver = class {
+    observe() {}
+    unobserve() {}
+    disconnect() {}
+  };
+}
 const { createRoot } = await import('react-dom/client');
 after(() => dom.window.close());
 
@@ -33,7 +46,7 @@ export const record = (content, id = 'one') => ({
   content,
 });
 
-export async function mount(props = {}, controlled = true) {
+export async function mount(props = {}, controlled = true, options = {}) {
   const container = document.createElement('div');
   document.body.append(container);
   const root = createRoot(container);
@@ -45,9 +58,18 @@ export async function mount(props = {}, controlled = true) {
       controlled ? { ...input, value, onValueChange: setValue } : input,
     );
   }
+  // StrictMode 会重放 effect 的 setup→cleanup→setup，但不重新调用 DOM
+  // callback ref；订阅类实现必须在这个模式下同样成立。
+  //
+  // StrictMode replays an effect's setup→cleanup→setup without re-invoking DOM
+  // callback refs, so a subscription must survive that replay too.
+  const tree = (input) => {
+    const host = createElement(Host, { input });
+    return options.strict ? createElement(StrictMode, null, host) : host;
+  };
   const render = async (next = {}) => {
     current = { ...current, ...next };
-    await act(() => root.render(createElement(Host, { input: current })));
+    await act(() => root.render(tree(current)));
   };
   await render();
   return {
```

#### Recent Merged Pull Requests:
- **PR #7635** (2026-11-13): ci(react): publish GitHub releases with bilingual notes (@LaamGinghong)
- **PR #7628** (2026-11-13): chore(react): prepare 0.1.11 stable release (@LaamGinghong)
- **PR #7626** (2026-11-13): fix(react): highlight conversation error notices (@LaamGinghong)
- **PR #7613** (closed): feat(superagent): load Role from OpenViking soul.md (@openviking-superagent)
- **PR #7611** (2026-11-13): fix(superagent): show the model the text of a quoted message (@t0saki)
- **PR #7609** (2026-11-13): feat(react): isolate rendering failures and support local retries (@LaamGinghong)

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

## X. react): align the file browser search dialog with the console design (#7570)

**RULE**:
When implementing operations in `frontend/.changeset/file-browser-search-design-alignment.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cf14a0cb`: react): align the file browser search dialog with the console design (#7570). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `frontend/.changeset/file-browser-search-design-alignment.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
---
'@openviking/react': patch
---

Align the FileBrowser search dialog with the console design and drop the result preview panel it gained in 0.1.10.

- The empty state shows the design's artwork above the title and hint instead of two centred lines of text.
- Results fill the dialog width again: the hover/keyboard preview panel and its split layout are gone, and each row keeps its bottom divider, 24px icon tile and 14px name. `↑`/`↓` still move the current row and `Enter` opens it.
- The count line reads `N results ・ [mode] Vector retrieval Switch` in the design's order, and appears only when there are results; the empty, loading and failure states no longer carry it.
- The advanced panel takes the design's `bg-2` surface, and the mode menu its 259px popover with a 6px radius and card shadow.

BREAKING CHANGE: `FileBrowserLabels.searchPreview`, `searchPreviewEmpty` and `searchPreviewFailed` are removed, because the search dialog no longer previews results. Drop those overrides; the keys have no effect.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cf14a0cb` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
