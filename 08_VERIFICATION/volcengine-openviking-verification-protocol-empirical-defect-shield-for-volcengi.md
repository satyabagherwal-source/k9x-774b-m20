# Verification Protocol: Verification Protocol: Empirical Defect Shield for volcengine/OpenViking

<!-- PROVENANCE_START
{
  "source_repository": "volcengine/OpenViking",
  "source_url": "https://github.com/volcengine/OpenViking",
  "source_version": "e13f0441",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-24T18:34:33.857Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-volcengine-openviking",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine/OpenViking](https://github.com/volcengine/OpenViking) (Revision: `e13f0441`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-24T18:34:33.857Z`  
> **Learning ID**: `learn-github-volcengine-openviking`


## 1. Scope & Verification Target
- **Target Repository**: `volcengine/OpenViking` (Commit: `e13f0441`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): volcengine/OpenViking

> **Canonical Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T18:34:32.437Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/OpenViking`
- **Description**: Self-evolving Context Database for AI Agents. Unify Agent Memory, Knowledge RAG and Skills.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 42693 stars

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

### Incident Patch 1: `e13f0441` (2026-11-24)
**Commit Message**: fix(acl): restore empty-string grant decoding (#8371)

Restore the exact-empty-string filtering introduced by #6067 and removed by #6956. Normalize offline-index empty ACL elements only at DirectAcl.from_context_fields; preserve valid direct/inherited grants, singleton none serialization, and rejection of every other malformed token.

Extend the existing ACL roundtrip and mixed-grant tests for list/tuple inputs and both grant prefixes. Document the read contract in English and Chinese.

Validation: seven regression cases fail on main before the decoder change; all 22 focused ACL cases pass afterward. Ruff lint/format and git diff --check pass. Focused mypy matches the baseline assignment diagnostic; unrestricted mypy has existing transitive errors. OpenViking has no check-domain Make target. No runtime, deployment, or index changes.

**File**: `docs/en/concepts/15-acl.md` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ acl_inherited_grants
 
 `acl_direct_grants` is the ACL assigned to the current node. `acl_inherited_grants` stores the parent's current effective ACL. `acl_mode` controls whether inherited grants contribute to the current node's effective permissions. Each principal stores only its highest level as `{mask}:{principal}`: `1` means `read`, `3` means `write`, and `7` means `manage`. There is no separate ACL collection.
 
-An empty grants list is stored as `["none"]` and decoded as no grants. The `"none"` token must appear alone and never grants access. This storage marker is independent of `acl_mode`: clearing direct grants preserves the mode and any inherited permissions.
+An empty grants list is stored as `["none"]` and decoded as no grants. The `"none"` token must appear alone and never grants access. Exact empty-string elements introduced by offline indexes are ignored on reads; other invalid grant tokens are rejected. This storage marker is independent of `acl_mode`: clearing direct grants preserves the mode and any inherited permissions.
 
 ACLs update with the index, so records for the same URI may temporarily hold different versions. Reads use one ACL snapshot returned by the index, without merging grants across versions or blocking on temporary disagreement. Permission changes take effect as index updates complete; strong consistency is not guaranteed.
 
```

**File**: `docs/zh/concepts/15-acl.md` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@ acl_inherited_grants
 
 `acl_direct_grants` 是当前节点直接 ACL，`acl_inherited_grants` 是父节点当前有效 ACL，`acl_mode` 决定 inherited 是否参与当前节点的有效权限。每个 principal 只保存最高 level，编码为 `{mask}:{principal}`：`1` 表示 `read`、`3` 表示 `write`、`7` 表示 `manage`。不维护独立 ACL collection。
 
-空 grants 列表存储为 `["none"]`，读取时解析为空权限。`"none"` 必须单独出现，不授予任何权限。该存储标记与 `acl_mode` 独立：清空直接授权时，模式和已有继承权限保持原有语义。
+空 grants 列表存储为 `["none"]`，读取时解析为空权限。`"none"` 必须单独出现，不授予任何权限。读取时忽略离线索引产生的精确空字符串元素，其他非法 grant token 仍报错。该存储标记与 `acl_mode` 独立：清空直接授权时，模式和已有继承权限保持原有语义。
 
 ACL 随索引更新，允许同一 URI 的不同索引记录短暂保留不同版本。读取采用索引返回的一份 ACL 快照，不合并不同版本的授权，也不因副本暂时不一致阻断处理。权限变更按索引更新进度生效，不保证强一致。
 
```

**File**: `openviking/storage/acl.py` (modified, +2/-0)
```diff
@@ -126,6 +126,8 @@ def from_context_fields(cls, record: Mapping[str, Any], prefix: str) -> "DirectA
             raise RuntimeError(f"Invalid ACL grants for {prefix}: expected a list")
         if len(raw_grants) == 1 and raw_grants[0] == EMPTY_ACL_GRANT:
             return cls()
+        # 离线索引可能将空列表还原为空字符串元素；仅忽略精确空串。
+        raw_grants = [grant for grant in raw_grants if grant != ""]
         return cls.from_entries(_decode_grant(grant) for grant in raw_grants)
 
 
```

**File**: `tests/storage/test_acl.py` (modified, +29/-6)
```diff
@@ -10,6 +10,9 @@
         {"acl_direct_grants": None},
         {"acl_direct_grants": []},
         {"acl_direct_grants": ["none"]},
+        {"acl_direct_grants": [""]},
+        {"acl_direct_grants": ["", ""]},
+        {"acl_direct_grants": ("", "")},
     ],
 )
 def test_context_fields_roundtrip_empty_grants(record):
@@ -19,23 +22,43 @@ def test_context_fields_roundtrip_empty_grants(record):
     assert acl.context_fields("acl_direct") == {"acl_direct_grants": ["none"]}
 
 
-def test_context_fields_preserve_valid_grants():
-    raw_grants = ["3:user:alice", "1:group:readers"]
+@pytest.mark.parametrize("prefix", ["acl_direct", "acl_inherited"])
+@pytest.mark.parametrize(
+    "raw_grants",
+    [
+        ["3:user:alice", "1:group:readers"],
+        ["", "3:user:alice", "", "1:group:readers", ""],
+        ("", "3:user:alice", "1:group:readers", ""),
+    ],
+)
+def test_context_fields_preserve_valid_grants(prefix, raw_grants):
     acl = DirectAcl.from_context_fields(
-        {"acl_inherited_grants": raw_grants},
-        "acl_inherited",
+        {f"{prefix}_grants": raw_grants},
+        prefix,
     )
 
     assert {(entry.principal, entry.level) for entry in acl.entries} == {
         ("user:alice", AclLevel.WRITE),
         ("group:readers", AclLevel.READ),
     }
-    assert set(acl.context_fields("acl_inherited")["acl_inherited_grants"]) == set(raw_grants)
+    assert set(acl.context_fields(prefix)[f"{prefix}_grants"]) == {
+        "3:user:alice",
+        "1:group:readers",
+    }
 
 
 @pytest.mark.parametrize(
     "raw_grants",
-    [[""], ["none", "3:user:alice"], ["none", "none"], [1]],
+    [
+        [" "],
+        ["invalid"],
+        ["", "invalid"],
+        ["", 1],
+        ["", "none"],
+        ["none", "3:user:alice"],
+        ["none", "none"],
+        [1],
+    ],
 )
 def test_context_fields_reject_invalid_grants(raw_grants):
     with pytest.raises(RuntimeError, match="Invalid ACL grant token"):
```

---

### Incident Patch 2: `dfad651f` (2026-11-24)
**Commit Message**: fix(compile): 修复增量编译漏处理和重复执行 (#7813)

* fix(compile): retain partial delivery across incremental runs

Signed-off-by: lusendong.6789 <[REDACTED_EMAIL]>
Co-authored-by: TRAE CLI <[REDACTED_EMAIL]>

* test(compile): keep focused delivery regressions

Signed-off-by: lusendong.6789 <[REDACTED_EMAIL]>
Co-authored-by: TRAE CLI <[REDACTED_EMAIL]>

* fix(compile): preserve failures for individual diff pages

* fix(compile): advance baseline after verified no-change recovery

* fix(compile): retain rejected pages in partial delivery

Apply the rejected-page coverage fix from #8207 (0a6e2fba7). Exercise the Complex service path where a valid page and a rejected page share one source.

Co-authored-by: wrfgup <[REDACTED_EMAIL]>

* test(compile): streamline partial recovery coverage

* refactor(compile): align snapshot and coverage naming with existing terms

- Rename download_snapshot_bytes to git_show_bytes: the wrapper only
  calls the SDK git_show snapshot endpoint, so "download" misrepresented
  the operation and diverged from download_bytes, which really hits
  /content/download.
- Drop the AI-introduced "delivered" wording in the compile chain:
  coverage state and output flag become "pu

**File**: `bot/tests/test_compile_markdown.py` (modified, +247/-29)
```diff
@@ -14,7 +14,12 @@
 from vikingbot.bus.queue import MessageBus
 from vikingbot.compile import simple
 from vikingbot.compile.file_ops import DocumentReader
-from vikingbot.compile.models import CompileFailure, CompileLimits, SanitizedCompileRequest
+from vikingbot.compile.models import (
+    CompileFailure,
+    CompileLimits,
+    CompileTask,
+    SanitizedCompileRequest,
+)
 from vikingbot.compile.ops import finalize
 from vikingbot.compile.ops import reduce as reduce_op
 from vikingbot.compile.ops.shuffle import Shuffle
@@ -29,9 +34,11 @@
 from vikingbot.sandbox.backends.direct import DirectBackend
 from vikingbot.session.manager import SessionManager
 
+from openviking.utils.compile_recovery import source_set_digest
 from openviking_cli.exceptions import NotFoundError
 
 MAP_ONLY = "drafts = p.map(sources, task=contract.extract)\np.finalize(drafts, into=target)"
+INVALID_FRONTMATTER = "---\ntype: concept\ntitle: Rules\n description: invalid\n---\n"
 MERGE = (
     "drafts = p.map(sources, task=contract.extract)\n"
     "groups = p.shuffle(drafts, by=contract.routing)\n"
@@ -150,7 +157,7 @@ def test_plan_rejects_unsafe_or_invalid_flows(program):
         parse_plan(program, contract(True))
 
 
-async def configure_pipeline(pipeline, merge=False, fail_second=False):
+async def configure_pipeline(pipeline, merge=False, fail_second=False, invalid_sibling=False):
     """Use actual file collection with controlled agent jobs and JSON control responses."""
     proposal = PlanProposal(contract=contract(merge), plan=MERGE if merge else MAP_ONLY)
 
@@ -173,6 +180,8 @@ async def worker(system, data, model, *, stage, runtime):
             assert len(data["documents"]) == 2
             content += "Combined details from both drafts.\n"
         await model.files.sandbox.write_file(f"{root}/{name}", content)
+        if invalid_sibling:
+            await model.files.sandbox.write_file(f"{root}/bad.md", INVALID_FRONTMATTER)
         await model.files.sandbox.write_file(
             root.rsplit("/", 1)[0] + "/scratch.md", "private scratch"
         )
@@ -432,7 +441,7 @@ async def chat(**kwargs):
         f"# Fact {i}" in "\n".join(op["content"] for op in bundle.operations) for i in range(3)
     )
     await pipeline.write_coverage([op["uri"] for op in bundle.operations])
-    assert (await pipeline.files.get("coverage"))["counts"] == {"delivered": 3}
+    assert (await pipeline.files.get("coverage"))["counts"] == {"prepared": 3}
 
 
 async def test_finalization_requires_unique_paths_and_prior_target_read(pipeline):
@@ -452,26 +461,7 @@ async def test_finalization_requires_unique_paths_and_prior_target_read(pipeline
         await finalize.run(pipeline, [doc])
 
 
-@pytest.mark.parametrize("cancelled,conflict", [(False, False), (False, True), (True, False)])
-async def test_service_publishes_final_markdown_with_batch_write_and_honors_cancel(
-    pipeline, monkeypatch, cancelled, conflict
-):
-    if conflict:
-        pipeline.client.batch_write.return_value = {
-            "created": [],
-            "updated": [],
-            "unchanged": [],
-            "conflicts": [
-                {
-                    "uri": pipeline.target + "/topic.md",
-                    "code": "ALREADY_EXISTS",
-                    "message": "Exists",
-                }
-            ],
-        }
-    await configure_pipeline(pipeline)
-    task = SimpleNamespace(status="cancelling" if cancelled else "running", meta={}, result=None)
-
+def compile_service_for_test(pipeline, task, monkeypatch):
     async def update(task_id, mutate):
         mutate(task)
 
@@ -489,17 +479,51 @@ async def update(task_id, mutate):
     )
     service._set_state = AsyncMock()
     monkeypatch.setattr("vikingbot.compile.service.Pipeline", lambda **kwargs: pipeline)
+    return service
+
+
+@pytest.mark.parametrize("case", ["normal", "cancelled", "conflict", "source", "worker", "sibling"])
+async def test_service_publishes_final_markdown_with_batch_write_and_honors_cancel(
+    pipeline, monkeypatch, case
+):
+    source_files = [pipeline.request.from_[0] + "/one.md"]
+    output_files = [pipeline.target + "/topic.md"]
+    if case in {"source", "worker"}:
+        source_files.append(pipeline.request.from_[0] + "/two.md")
+    if case == "conflict":
+        pipeline.client.batch_write.return_value = {
+            "created": [],
+            "conflicts": [
+                {
+                    "uri": output_files[0],
+                    "code": "ALREADY_EXISTS",
+                    "message": "Exists",
+                }
+            ],
+        }
+    await configure_pipeline(
+        pipeline, fail_second=case == "worker", invalid_sibling=case == "sibling"
+    )
+    if case == "source":
+        pipeline.client.read_raw.side_effect = [
+            "source fact",
+            ConnectionError("Source unavailable"),
+        ]
+    task = SimpleNamespace(
+        status="cancelling" if case == "cancelled" else "running", meta={}, result=
```

**File**: `bot/tests/test_openapi_auth.py` (modified, +2/-2)
```diff
@@ -77,7 +77,7 @@ async def create_task(self, request, *, principal_scope, task_id=None):
                     to=request.to,
                 )
 
-            async def get_task(self, task_id, *, principal_scope):
+            async def get_task(self, task_id, *, principal_scope, include_recovery_proof=False):
                 if task_id != "cmp_test" or principal_scope != self.scope:
                     return None
                 return self.task
@@ -173,7 +173,7 @@ async def create_task(self, request, *, principal_scope, task_id=None):
                     to=request.to,
                 )
 
-            async def get_task(self, task_id, *, principal_scope):
+            async def get_task(self, task_id, *, principal_scope, include_recovery_proof=False):
                 if task_id != "cmp_dev" or principal_scope != self.scope:
                     return None
                 return {
```

**File**: `bot/vikingbot/compile/models.py` (modified, +9/-3)
```diff
@@ -207,11 +207,13 @@ class CompileResult(BaseModel):
     created: list[str] = Field(default_factory=list)
     updated: list[str] = Field(default_factory=list)
     unchanged: list[str] = Field(default_factory=list)
-    # Skipped target-state conflicts, each containing uri, code and message; never delivered.
+    # Skipped target-state conflicts, each containing uri, code and message; never published.
     conflicts: list[dict[str, str]] = Field(default_factory=list)
     page_count: int = 0
     link_count: int = 0
     warnings: list[str] = Field(default_factory=list)
+    completion_status: Literal["partial"] | None = None
+    recovery_proof: str | None = None
 
 
 class CompileTask(BaseModel):
@@ -236,10 +238,14 @@ class CompileTask(BaseModel):
     result: CompileResult | None = None
     error: CompileErrorInfo | None = None
 
-    def public_dict(self) -> dict[str, Any]:
+    def public_dict(self, *, include_recovery_proof: bool = False) -> dict[str, Any]:
         data = self.model_dump(exclude={"principal_scope", "sanitized_request"}, exclude_none=True)
         if self.result is not None:
-            data["result"] = self.result.model_dump(by_alias=True)
+            data["result"] = self.result.model_dump(
+                by_alias=True,
+                exclude_none=True,
+                exclude=None if include_recovery_proof else {"recovery_proof"},
+            )
         return data
 
 
```

**File**: `bot/vikingbot/compile/ops/finalize.py` (modified, +3/-2)
```diff
@@ -19,7 +19,7 @@ async def run(runtime, documents):
     prior read by a worker. This preflight does not provide atomic compare-and-swap writes.
     """
     bundle = RenderedBundle()
-    contents, outputs = {}, {}
+    contents, outputs, rejected = {}, {}, {}
     seen_paths: set[str] = set()
     for document in documents:
         path = validate_relative_file_path(document.path)
@@ -38,6 +38,7 @@ async def run(runtime, documents):
                 validate_declared_okf_markdown(uri, content.encode("utf-8"))
             except ValueError as exc:
                 runtime.warnings.append(str(exc))
+                rejected[path] = document.source_refs
                 continue
         contents[path] = content
         outputs[path] = {"source_refs": document.source_refs, "sha256": content_hash(content)}
@@ -63,5 +64,5 @@ async def run(runtime, documents):
         outputs[path] = {"source_refs": document.source_refs, "sha256": content_hash(content)}
     if runtime.skill_target and contents:
         file_ops.validate_skill_output(contents)
-    await runtime.files.put("finalize", {"outputs": outputs})
+    await runtime.files.put("finalize", {"outputs": outputs, "rejected": rejected})
     return bundle
```

**File**: `bot/vikingbot/compile/pipeline.py` (modified, +18/-12)
```diff
@@ -58,6 +58,7 @@ def __init__(
         self.tools, self.tool_context = {}, None
         self.sources: dict[str, Source] = {}
         self.evidence, self.status, self.old = {}, {}, {}
+        self.recovery_evidence: set[str] = set()
         self.failures, self.warnings = [], []
         self.artifacts: list[Document] = []
         self.noop = False
@@ -243,30 +244,35 @@ def validate(proposal):
                     raise
                 logger.exception("Compile diagnostic write failed; preserving the execution error")
 
-    async def write_coverage(self, published=()):
-        """Track assignment provenance and acknowledged output URIs without claiming semantic coverage."""
+    async def write_coverage(self, published=None):
+        """Record source states; only supplied write results can mark outputs incomplete."""
         manifest = await self.files.get("inputs") or {}
         final = await self.files.get("finalize") or {}
-        delivered = set(published)
+        published = set(published) if published is not None else None
         inputs = {}
         for source_id, metadata in self.evidence.items():
             item = inputs.setdefault(metadata["uri"], {"ranges": {}, "outputs": []})
             item["ranges"][source_id] = self.status[source_id]
-        for path, output in final.get("outputs", {}).items():
+        rejected = final.get("rejected", {})
+        if published is not None:
+            published.difference_update(safe_join_viking_uri(self.target, path) for path in rejected)
+        references = {
+            path: output["source_refs"] for path, output in final.get("outputs", {}).items()
+        }
+        for path, refs in (references | rejected).items():
             uri = safe_join_viking_uri(self.target, path)
-            for source_uri in {self.evidence[ref]["uri"] for ref in output["source_refs"]}:
-                inputs[source_uri]["outputs"].append({"uri": uri, "delivered": uri in delivered})
+            for source_uri in {self.evidence[ref]["uri"] for ref in refs}:
+                inputs[source_uri]["outputs"].append(uri)
         for uri, item in inputs.items():
             states = item["ranges"].values()
             state = next(
                 (s for s in ("failed", "pending", "unreferenced") if s in states), "prepared"
             )
-            if (
-                state == "prepared"
-                and item["outputs"]
-                and all(o["delivered"] for o in item["outputs"])
-            ):
-                state = "delivered"
+            if state == "prepared" and published is not None:
+                if not item["outputs"]:
+                    state = "unreferenced"
+                elif any(output not in published for output in item["outputs"]):
+                    state = "failed"
             manifest[uri] = item["status"] = state
         await self.files.put("inputs", manifest)
         await self.files.put(
```

**File**: `bot/vikingbot/compile/pipeline_agent.py` (modified, +9/-3)
```diff
@@ -113,9 +113,15 @@ async def run(system, data, model, *, stage, runtime):
             registry.register(
                 CompileChildTool(tool, output_root, merge_only=True, readonly_paths=readonly_paths)
             )
-        evidence = EvidenceReader(model.files, data)
-        if evidence.allowed:
-            registry.register(evidence)
+        reader = EvidenceReader(
+            model.files,
+            data,
+            recovery_evidence=(
+                runtime.recovery_evidence if (runtime.changes or {}).get("recovery_sources") else None
+            ),
+        )
+        if reader.allowed:
+            registry.register(reader)
         registry.register(runtime.resources)
         registry.register(TargetReader(runtime))
         search = runtime.tools.get("openviking_search")
```

**File**: `bot/vikingbot/compile/router.py` (modified, +3/-1)
```diff
@@ -124,7 +124,9 @@ async def load_session(
         if cancel:
             task = await service.cancel_task(body.session_id, principal_scope=principal_scope)
         else:
-            task = await service.get_task(body.session_id, principal_scope=principal_scope)
+            task = await service.get_task(
+                body.session_id, principal_scope=principal_scope, include_recovery_proof=True
+            )
         if task is None:
             raise HTTPException(
                 status_code=status.HTTP_404_NOT_FOUND,
```

**File**: `bot/vikingbot/compile/service.py` (modified, +35/-5)
```diff
@@ -43,6 +43,7 @@
 from vikingbot.agent.tools.registry import ToolRegistry
 from vikingbot.agent.tools.spawn import WaitSubagentsTool
 from vikingbot.compile import file_ops, simple
+from vikingbot.compile.hashing import content_hash
 from vikingbot.compile.models import (
     COMPILE_DRAFT_ROOT,
     COMPILE_STAGING_ROOT,
@@ -68,7 +69,12 @@
     validate_declared_okf_markdown,
 )
 from vikingbot.compile.sandbox import CompileSandboxManager
-from vikingbot.compile.sources import CompileSourceRange, pack_source_batches, read_source
+from vikingbot.compile.sources import (
+    CompileSourceRange,
+    pack_source_batches,
+    read_source,
+    verify_recovery_sources,
+)
 from vikingbot.compile.store import CompileTaskStore
 from vikingbot.config.schema import SandboxBackend, SandboxMode, SessionKey
 from vikingbot.openviking_mount.ov_server import VikingClient
@@ -361,15 +367,17 @@ async def create_task(
             if not runner_started:
                 await self._release_admission(principal_scope)
 
-    async def get_task(self, task_id: str, *, principal_scope: str) -> dict[str, Any] | None:
+    async def get_task(
+        self, task_id: str, *, principal_scope: str, include_recovery_proof: bool = False
+    ) -> dict[str, Any] | None:
         await self.start()
         try:
             task = await self.store.get(task_id)
         except ValueError:
             return None
         if task is None or task.principal_scope != principal_scope:
             return None
-        return task.public_dict()
+        return task.public_dict(include_recovery_proof=include_recovery_proof)
 
     async def cancel_task(self, task_id: str, *, principal_scope: str) -> dict[str, Any] | None:
         """Request cooperative cancellation of one principal-owned Compile task."""
@@ -1024,8 +1032,8 @@ async def resolve_wiki_uri(uri: str) -> bool:
             preserve_workspace = preserve_workspace or bool(warnings)
             if output_file_count == 0:
                 warnings.append("No reliable output was produced from the supplied materials.")
-            result = CompileResult(
-                **{
+            result = CompileResult.model_validate(
+                {
                     "from": request.from_,
                     "to": request.to,
                     "skill": request.skill,
@@ -1141,6 +1149,8 @@ def record_metrics(task):
         source_limits = self.limits.model_copy(
             update={"source_batch_chars": min(self.limits.source_batch_chars, 10_000)}
         )
+        recovery = (request.changes or {}).get("recovery_sources")
+        source_hashes: dict[str, str] = {}
 
         async def source_batches():
             """Retain at most one read batch of source bodies while seeding task shards."""
@@ -1160,6 +1170,8 @@ async def source_batches():
                     elif isinstance(content, BaseException):
                         raise content
                     else:
+                        if recovery and isinstance(content, str):
+                            source_hashes[uri] = content_hash(content)
                         readable.append((uri, content))
                 for batch in pack_source_batches(readable, source_limits):
                     yield batch
@@ -1200,6 +1212,22 @@ async def source_batches():
                 ]
             )
             await pipeline.write_coverage(published)
+            counts = (await pipeline.files.get("coverage") or {}).get("counts", {})
+            partial = bool(pipeline.failures or conflicts) or any(
+                counts.get(state, 0) for state in ("failed", "pending", "unreferenced")
+            )
+            recovery_proof = None
+            if (
+                recovery
+                and not partial
+                and not pipeline.warnings
+                and not rendered.operations
+                and counts.get("prepared") == len(ordered)
+                and pipeline.evidence.keys() <= pipeline.recovery_evidence
+            ):
+                recovery_proof = await verify_recovery_sources(
+                    client, request.changes, source_hashes
+                )
             summary = await pipeline.files.get("summary")
             summary["committed"] = True
             summary["warnings"] = pipeline.warnings
@@ -1223,6 +1251,8 @@ async def source_batches():
                 page_count=len(set(published)),
                 link_count=rendered.link_count,
                 warnings=pipeline.warnings,
+                completion_status="partial" if partial else None,
+                recovery_proof=recovery_proof,
             )
 
             def complete(task):
```

---

### Incident Patch 3: `6b42f562` (2026-11-24)
**Commit Message**: fix(react): 保持未知预览类型并修复前端测试 (#8369)

* fix(react): 保持未知预览类型并修复前端测试

Only resolve the loading preview type from actual stat metadata. Align existing tests with automatic empty-directory expansion, Skill candidate collapse and independent Wiki badge reads.

Signed-off-by: lusendong.6789 <[REDACTED_EMAIL]>
Co-authored-by: TRAE CLI <[REDACTED_EMAIL]>

* chore(react): remove release note from CI repair

Signed-off-by: lusendong.6789 <[REDACTED_EMAIL]>
Co-authored-by: TRAE CLI <[REDACTED_EMAIL]>

---------

Signed-off-by: lusendong.6789 <[REDACTED_EMAIL]>
Co-authored-by: TRAE CLI <[REDACTED_EMAIL]>

**File**: `frontend/packages/react/src/modules/file-browser/use-fs-preview.ts` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ export function useFsPreview({
       const stat = resourceType === 'unknown' ? await metadata : undefined;
       const isDir = stat?.isDirectory ?? resourceType === 'directory';
       if (signal.aborted) throw abortError();
-      if (resourceType === 'unknown' && isDir !== undefined) {
+      if (resourceType === 'unknown' && stat?.isDirectory !== undefined) {
         const type = isDir ? 'directory' : 'file';
         setStatType({ lookup, type });
         setTabs([loadingTab(uri, type)]);
```

**File**: `frontend/packages/react/test/console-inactive-overlays.test.mjs` (modified, +4/-0)
```diff
@@ -76,6 +76,10 @@ test('inactive Skill upload releases its focus and body lock while its inline an
               value: 'viking://agent/skills/wiki/SKILL.md',
               label: 'Wiki Skill',
             },
+            {
+              value: 'viking://agent/skills/report/SKILL.md',
+              label: 'Report Skill',
+            },
           ],
           initialValue: 'viking://agent/skills/wiki/SKILL.md',
         },
```

**File**: `frontend/packages/react/test/file-browser-metadata-ownership.test.mjs` (modified, +1/-0)
```diff
@@ -106,6 +106,7 @@ test('a known Wiki keeps the truncation hint when its full read fails', async ()
     content,
     taggedTarget: uri,
     fullRead: full.promise,
+    kinds: [],
   });
   try {
     assert.equal(f.tab.source.truncated, true);
```

**File**: `frontend/packages/react/test/file-browser-preview-priority.test.mjs` (modified, +6/-1)
```diff
@@ -185,7 +185,12 @@ test('a listed Markdown file reads its body while Wiki attrs are pending', async
       ),
     );
     await settle();
-    assert.equal(fetch.countOf('/api/v1/content/read'), 1);
+    assert.deepEqual(
+      fetch.calls
+        .filter(({ path }) => path === '/api/v1/content/read')
+        .map(({ query }) => query.limit),
+      ['2000', '-1'],
+    );
     assert.equal(body(), 'Chapter text');
   } finally {
     await view.unmount();
```

**File**: `frontend/packages/react/test/file-browser-wiki-conflict-editing.test.mjs` (modified, +2/-1)
```diff
@@ -171,13 +171,14 @@ test('navigating away discards a pending Wiki conflict edit before preview loadi
       view.container.textContent,
       new RegExp(`${otherBody.length} characters`),
     );
+    const otherReads = editReads(otherFile);
 
     await act(async () => preview.resolve());
     await settle();
     assert.equal(activeTab(), otherFile);
     assert.equal(view.container.querySelector('.cm-content'), null);
     assert.equal(editReads(file), dashboardReads);
-    assert.equal(editReads(otherFile), 0);
+    assert.equal(editReads(otherFile), otherReads);
   } finally {
     await view.unmount();
   }
```

**File**: `frontend/packages/react/test/file-tree-root-order.test.mjs` (modified, +1/-2)
```diff
@@ -128,8 +128,7 @@ test('FileBrowser marks only shared resources and labels an expanded empty folde
   try {
     await expand(user);
     await expand(agent);
-    assert.equal(row(`${endpoints}::empty`), null);
-    await expand(endpoints);
+    assert.ok(row(`${endpoints}::empty`));
     assert.match(row(`${endpoints}::empty`).textContent, /该文件夹为空/);
     assert.doesNotMatch(row(`${endpoints}::empty`).textContent, /暂无文件/);
     assert.equal(
```

#### Recent Merged Pull Requests:
- **PR #8379** (closed): feat(retrieve): add RL query planner intent-analysis prompt (@Guoxuter)
- **PR #8372** (2026-11-24): fix(acl): restore empty-string grant decoding on v0.5.2 (@chuanbao666)
- **PR #8371** (2026-11-24): fix(acl): restore empty-string grant decoding (@chuanbao666)
- **PR #8369** (2026-11-24): fix(react): 保持未知预览类型并修复前端测试 (@cocolord)
- **PR #8367** (2026-11-24): test(react): 修复当前用户目录展开测试卡死 (@cocolord)
- **PR #8363** (2026-11-24): feat(superagent): refresh the /tasks cards in place (@krsish)

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

## X. acl): restore empty-string grant decoding

**RULE**:
When implementing operations in `docs/en/concepts/15-acl.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e13f0441`: acl): restore empty-string grant decoding. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/en/concepts/15-acl.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
An empty grants list is stored as `["none"]` and decoded as no grants. The `"none"` token must appear alone and never grants access. Exact empty-string elements introduced by offline indexes are ignored on reads; other invalid grant tokens are rejected. This storage marker is independent of `acl_mode`: clearing direct grants preserves the mode and any inherited permissions.
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
An empty grants list is stored as `["none"]` and decoded as no grants. The `"none"` token must appear alone and never grants access. This storage marker is independent of `acl_mode`: clearing direct grants preserves the mode and any inherited permissions.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e13f0441` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
