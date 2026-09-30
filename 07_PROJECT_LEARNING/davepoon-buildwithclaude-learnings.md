# Forensic Learning Record (Deep Inspection): davepoon/buildwithclaude

> **Canonical Artifact**: `07_PROJECT_LEARNING/davepoon-buildwithclaude-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/davepoon/buildwithclaude](https://github.com/davepoon/buildwithclaude))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:34:12.753Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `davepoon/buildwithclaude`
- **Description**: A single hub to find Claude Skills, Agents, Commands, Hooks, Plugins, and Marketplace collections to extend Claude Code, Claude Desktop, Agent SDK and OpenClaw
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3572 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `plugins/all-skills/skills/atlas-cloud-media/scripts/atlas_media.py`
```
#!/usr/bin/env python3
"""Discover Atlas Cloud media models and run one confirmed generation task."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable


DEFAULT_BASE_URL = "https://api.atlascloud.ai"
USER_AGENT = "buildwithclaude-atlas-media/1.0"
SUCCESS_STATUSES = {"completed", "succeeded", "success"}
FAILURE_STATUSES = {"failed", "canceled", "cancelled"}


class AtlasCloudClient:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        *,
        opener: Callable[..., Any] = urllib.request.urlopen,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        self.api_key = api_key or os.environ.get("ATLASCLOUD_API_KEY")
        self.base_url = (
            base_url or os.environ.get("ATLASCLOUD_BASE_URL") or DEFAULT_BASE_URL
        ).rstrip("/")
        self.opener = opener
        self.sleep_fn = sleep_fn

    def _request_json(
        self,
        url: str,
        *,
        method: str = "GET",
        payload: dict[str, Any] | None = None,
        require_auth: bool = False,
    ) -> Any:
        if require_auth and not self.api_key:
            raise ValueError("ATLASCLOUD_API_KEY is required for generation")

        headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload).encode("utf-8")

        request = urllib.request.Request(
            url,
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with self.opener(request, timeout=120) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"Atlas Cloud API error {error.code}: {detail or error.reason}"
            ) from error
        except urllib.error.URLError as error:
            raise RuntimeError(f"Atlas Cloud request failed: {error.reason}") from error

    @staticmethod
    def _unwrap_data(value: Any) -> Any:
        if isinstance(value, dict) and "data" in value:
            return value["data"]
        return value

    def list_models(
        self,
        *,
        model_type: str | None = None,
        query: str | None = None,
    ) -> list[dict[str, Any]]:
        response = self._request_json(f"{self.base_url}/api/v1/models")
        models = self._unwrap_data(response)
        if isinstance(models, dict):
            models = models.get("models") or models.get("items") or []
        if not isinstance(models, list):
            raise RuntimeError("Atlas Cloud model catalog returned an invalid shape")

        query_lower = query.lower() if query else None
        filtered = []
        for model in models:
            if not isinstance(model, dict) or model.get("display_console") is False:
                continue
            if model_type and str(model.get("type", "")).lower() != model_type.lower():
                continue
            if query_lower and query_lower not in str(model.get("model", "")).lower():
                continue
            filtered.append(model)
        return filtered

    def find_model(self, model_id: str) -> dict[str, Any]:
        for model in self.list_models():
            if model.get("model") == model_id:
                return model
        raise ValueError(f"Model is not available in the live catalog: {model_id}")

    def get_schema(self, model: dict[str, Any]) -> dict[str, Any]:
        schema_url = model.get("schema")
        if not isinstance(schema_url, str) or not schema_url.startswith("https://"):
            raise RuntimeError("Model catalog entry does not include a valid schema URL")
        schema = self._request_json(schema_url)
        if not isinstance(schema, dict):
            raise RuntimeError("Atlas Cloud model schema returned an invalid shape")
        return schema

    @staticmethod
    def _resolve_ref(schema: dict[str, Any], node: dict[str, Any]) -> dict[str, Any]:
        reference = node.get("$ref")
        if not isinstance(reference, str) or not reference.startswith("#/"):
            return node
        current: Any = schema
        for part in reference[2:].split("/"):
            current = current[part]
        if not isinstance(current, dict):
            raise RuntimeError(f"Schema reference is not an object: {reference}")
        return current

    @classmethod
    def _schema_contract(
        cls, schema: dict[str, Any]
    ) -> tuple[str, str, dict[str, Any]]:
        paths = schema.get("paths")
        if not isinstance(paths, dict):
            raise RuntimeError("Model schema has no paths object")

        submit_path = None
        result_path = None
        submit_operation = None
        for path, operations in paths.items():
            if not isinstance(operations, dict):
                continue
            if submit_path is None and isinstance(operations.get("post"), dict):
                submit_path = path
                submit_operation = operations["post"]
            if isinstance(operations.get("get"), dict) and (
                "{request_id}" in path
                or "{id}" in path
                or "/prediction/" in path
                or "/result/" in path
            ):
                result_path = path

        if not submit_path or not result_path or not submit_operation:
            raise RuntimeError("Model schema does not expose POST and GET task endpoints")

        request_body = submit_operation.get("requestBody", {})
        content = request_body.get("content", {}).get("application/json", {})
        input_schema = cls._resolve_ref(schema, content.get("schema", {}))
        return submit_path, result_path, input_schema

    @staticmethod
    def _validate_params(params: dict[str, Any], input_schema: dict[str, Any]) -> None:
        required = input_schema.get("required") or []
        missing = [name for name in required if name != "model" and name not in params]
        if missing:
            raise ValueError(f"Missing required model parameters: {', '.join(missing)}")

        properties = input_schema.get("properties") or {}
        for name, value in params.items():
            rules = properties.get(name)
            if not isinstance(rules, dict):
                continue
            expected_type = rules.get("type")
            valid_type = {
                "string": isinstance(value, str),
                "integer": isinstance(value, int) and not isinstance(value, bool),
                "number": isinstance(value, (int, float))
                and not isinstance(value, bool),
                "boolean": isinstance(value, bool),
                "array": isinstance(value, list),
                "object": isinstance(value, dict),
            }.get(expected_type, True)
            if not valid_type:
                raise ValueError(f"Parameter '{name}' must be {expected_type}")
            if "enum" in rules and value not in rules["enum"]:
                raise ValueError(f"Parameter '{name}' is outside the schema enum")
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                if "minimum" in rules and value < rules["minimum"]:
                    raise ValueError(f"Parameter '{name}' is below the schema minimum")
                if "maximum" in rules and value > rules["maximum"]:
                    raise ValueError(f"Parameter '{name}' is above the schema maximum")

    def describe(self, model_id: str) -> dict[str, Any]:
        model = self.find_model(model_id)
        schema = self.get_schema(model)
        s
```

### Core Architecture Module: `plugins/all-skills/skills/checkpointed-agent-loop/scripts/checkpoint-loop.mjs`
```
#!/usr/bin/env node

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const STATES = new Set(['planned', 'running', 'verifying', 'succeeded', 'failed', 'blocked'])
const TERMINAL_STATES = new Set(['succeeded', 'failed', 'blocked'])
const TRANSITIONS = {
  planned: new Set(['running']),
  running: new Set(['verifying', 'failed', 'blocked']),
  verifying: new Set(['succeeded', 'running', 'failed', 'blocked']),
}

function nonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function isoTimestamp(value, field) {
  const normalized = nonEmptyString(value, field)
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${field} must be an ISO timestamp`)
  return normalized
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${field} must be a positive integer`)
  return value
}

function validateHistory(history) {
  if (!Array.isArray(history)) throw new Error('history must be an array')
  return history.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`history[${index}] must be an object`)
    if (!STATES.has(entry.from) || !STATES.has(entry.to)) {
      throw new Error(`history[${index}] contains an invalid state`)
    }
    const result = {
      from: entry.from,
      to: entry.to,
      at: isoTimestamp(entry.at, `history[${index}].at`),
    }
    if (entry.reason !== undefined) result.reason = nonEmptyString(entry.reason, `history[${index}].reason`)
    return result
  })
}

function validateEvidence(evidence) {
  if (!Array.isArray(evidence)) throw new Error('evidence must be an array')
  return evidence.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`evidence[${index}] must be an object`)
    if (entry.outcome !== 'passed' && entry.outcome !== 'failed') {
      throw new Error(`evidence[${index}].outcome must be passed or failed`)
    }
    const result = {
      check: nonEmptyString(entry.check, `evidence[${index}].check`),
      outcome: entry.outcome,
      at: isoTimestamp(entry.at, `evidence[${index}].at`),
    }
    if (entry.artifact !== undefined) {
      result.artifact = nonEmptyString(entry.artifact, `evidence[${index}].artifact`)
    }
    return result
  })
}

export function parseCheckpoint(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('checkpoint must be an object')
  }
  if (value.schemaVersion !== 1) throw new Error('schemaVersion must be 1')

  const taskId = nonEmptyString(value.taskId, 'taskId')
  const objective = nonEmptyString(value.objective, 'objective')
  if (!STATES.has(value.state)) throw new Error(`state is invalid: ${value.state}`)

  const attempts = value.attempts
  if (!Number.isInteger(attempts) || attempts < 0) throw new Error('attempts must be a non-negative integer')
  const maxAttempts = positiveInteger(value.maxAttempts, 'maxAttempts')
  if (attempts > maxAttempts) throw new Error('attempts cannot exceed maxAttempts')

  const checkpoint = {
    schemaVersion: 1,
    taskId,
    objective,
    state: value.state,
    attempts,
    maxAttempts,
    nextAction: nonEmptyString(value.nextAction, 'nextAction'),
    createdAt: isoTimestamp(value.createdAt, 'createdAt'),
    updatedAt: isoTimestamp(value.updatedAt, 'updatedAt'),
    history: validateHistory(value.history),
    evidence: validateEvidence(value.evidence),
  }

  if (value.terminalReason !== undefined) {
    checkpoint.terminalReason = nonEmptyString(value.terminalReason, 'terminalReason')
  }
  if (TERMINAL_STATES.has(value.state) && value.state !== 'succeeded' && !checkpoint.terminalReason) {
    throw new Error(`${value.state} checkpoints require terminalReason`)
  }

  return checkpoint
}

export function createCheckpoint({ taskId, objective, maxAttempts, nextAction, now = new Date().toISOString() }) {
  return parseCheckpoint({
    schemaVersion: 1,
    taskId,
    objective,
    state: 'planned',
    attempts: 0,
    maxAttempts: positiveInteger(maxAttempts, 'maxAttempts'),
    nextAction,
    createdAt: now,
    updatedAt: now,
    history: [],
    evidence: [],
  })
}

export function transitionCheckpoint(checkpointValue, to, options = {}, now = new Date().toISOString()) {
  const checkpoint = parseCheckpoint(checkpointValue)
  if (TERMINAL_STATES.has(checkpoint.state)) {
    throw new Error(`checkpoint is terminal: ${checkpoint.state}`)
  }
  if (!STATES.has(to) || !TRANSITIONS[checkpoint.state]?.has(to)) {
    throw new Error(`invalid transition: ${checkpoint.state} -> ${to}`)
  }
  if (to === 'running' && checkpoint.attempts >= checkpoint.maxAttempts) {
    throw new Error(`attempt budget exhausted: ${checkpoint.attempts}/${checkpoint.maxAttempts}`)
  }
  if ((to === 'failed' || to === 'blocked') && !options.reason) {
    throw new Error(`${to} transitions require a reason`)
  }
  if (to === 'succeeded' && !checkpoint.evidence.some(({ outcome }) => outcome === 'passed')) {
    throw new Error('succeeded requires at least one passing verification evidence record')
  }

  const next = {
    ...checkpoint,
    state: to,
    attempts: checkpoint.attempts + (to === 'running' ? 1 : 0),
    updatedAt: now,
    history: [
      ...checkpoint.history,
      {
        from: checkpoint.state,
        to,
        at: now,
        ...(options.reason ? { reason: nonEmptyString(options.reason, 'reason') } : {}),
      },
    ],
  }

  if (options.nextAction !== undefined) next.nextAction = nonEmptyString(options.nextAction, 'nextAction')
  if (to === 'failed' || to === 'blocked') next.terminalReason = nonEmptyString(options.reason, 'reason')

  return parseCheckpoint(next)
}

export function appendEvidence(checkpointValue, evidence, now = new Date().toISOString()) {
  const checkpoint = parseCheckpoint(checkpointValue)
  if (checkpoint.state !== 'verifying') throw new Error('evidence can only be recorded while verifying')

  return parseCheckpoint({
    ...checkpoint,
    updatedAt: now,
    evidence: [
      ...checkpoint.evidence,
      {
        check: evidence.check,
        outcome: evidence.outcome,
        at: now,
        ...(evidence.artifact ? { artifact: evidence.artifact } : {}),
      },
    ],
  })
}

export async function loadCheckpoint(file) {
  const text = await readFile(file, 'utf8')
  let value
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new Error(`checkpoint is not valid JSON: ${error.message}`)
  }
  return parseCheckpoint(value)
}

export async function saveCheckpoint(file, checkpointValue, { createParent = false } = {}) {
  const checkpoint = parseCheckpoint(checkpointValue)
  const parent = dirname(file)
  if (createParent) await mkdir(parent, { recursive: true })
  const temporary = join(parent, `.${basename(file)}.tmp-${process.pid}`)

  try {
    await writeFile(temporary, `${JSON.stringify(checkpoint, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, file)
  } catch (error) {
    await unlink(temporary).catch(() => {})
    throw error
  }
}

function parseArguments(args) {
  const command = args[0]
  const options = {}
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (!flag?.startsWith('--') || value === undefined) throw new Error(`invalid argument near ${flag || '<end>'}`)
    options[flag.slice(2)] = value
  }
  return { command, options }
}

function requireOption(options, name) {
  return nonEmptyString(options[name], `--${name}`)
}

async function runCli(args) {
  const { command, options } = parseArguments(args)
  const file = requireOption(options, 'file')

  if (command === 'init') {
    const checkpoint = createCheckpoint({
      taskId: requireOption(options, 'task'),
      o
```

### Core Architecture Module: `plugins/all-skills/skills/de-ai-writer/scripts/deai.py`
```
#!/usr/bin/env python3
"""
De-AI Writer — AI 文案去味器（通用版 CLI）
============================================
把 AI 生成的文本改写成自然、有真人味的中文。

用法:
  python3 deai.py 输入文件.txt -o 输出文件.txt     # 处理文件
  cat 文本.txt | python3 deai.py -o 输出.txt       # 管道输入
  python3 deai.py -t "要改写的文本"                 # 直接传文本
  python3 deai.py 输入.txt --prompt-only           # 只输出 prompt（无API key时用）

配置（环境变量）:
  LLM_API_KEY    API Key（OpenAI 兼容）
  LLM_BASE_URL   接口地址，默认 https://api.openai.com/v1
  LLM_MODEL      模型名，默认 gpt-4o-mini
  不配置也能用：--prompt-only 模式输出可直接粘贴到任意 AI 助手的提示词

示例:
  python3 deai.py draft.txt -o polished.txt
  python3 deai.py -t "此外，该产品不仅性能卓越，更是彰显了创新精神。" 
"""
import sys, os, json, argparse, urllib.request

# ---------- 核心提示词（产品核心资产） ----------
CORE_PROMPT = """你是一位资深中文编辑，专长是去除 AI 味、恢复真人写作风格。请把用户提供的文本改写成自然、有人味的中文。

【必须清除的 AI 味模式】
1. 空洞拔高：删除"不仅...更是""彰显""标志着""至关重要""深远影响"等虚张声势的表述
2. 排比三连：打破"创新、卓越、领先"式三连排比
3. 万能衔接词：清除"此外""然而""值得注意的是""综上所述"等机械过渡
4. 官方腔：去掉"赋能""抓手""闭环""颗粒度"等黑话
5. 形容词堆砌：删掉"极致""巅峰""完美"等夸张词
6. 模板化结尾：删除"未来可期""让我们拭目以待"式空话
7. 重复替代词：避免用"该产品""此方案"反复替换主语
8. 过度客套：删除"希望对您有帮助""欢迎随时联系"式废话
9. 被动句式：能主动就主动（"文件被保存"→"系统保存了文件"）
10. 完美工整：允许句子长短交错、口语化、轻微不完美

【写作要求】
- 保留原意、事实、数据，只改表达
- 用短句和长句交错，自然呼吸感
- 可以有一点点个人态度（"说实话""我个人觉得"），但不要过度
- 中文优先，专有名词保留原文
- 输出 ONLY 改写后的文本，不要任何解释、前言、后记
"""

def build_prompt(text: str) -> str:
    return CORE_PROMPT + "\n\n【用户文本】\n" + text

def load_config():
    """读取配置：环境变量优先，其次参数，最后 ~/.deai_writer.conf 配置文件。
    环境变量: LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
    配置示例 (~/.deai_writer.conf):
        [llm]
        key = sk-xxx
        base_url = https://api.deepseek.com/v1
        model = deepseek-chat
    """
    import configparser
    cfg = configparser.ConfigParser()
    cfg.read(os.path.expanduser("~/.deai_writer.conf"))
    key = os.environ.get("LLM_API_KEY", "") or cfg.get("llm", "key", fallback="")
    base = os.environ.get("LLM_BASE_URL", "") or cfg.get("llm", "base_url", fallback="https://api.openai.com/v1")
    model = os.environ.get("LLM_MODEL", "") or cfg.get("llm", "model", fallback="gpt-4o-mini")
    return key, base, model

def call_llm(prompt: str, api_key: str = "", base_url: str = "", model: str = "") -> str:
    if not api_key:
        api_key, base_url, model = load_config()
    base = base_url.rstrip("/")
    if not api_key:
        raise SystemExit("❌ 未配置 API Key。用 --api-key 参数，或写 ~/.deai_writer.conf（见 load_config 注释），或用 --prompt-only 模式。")
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
        }).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return data["choices"][0]["message"]["content"].strip()

def main():
    ap = argparse.ArgumentParser(description="De-AI Writer — AI 文案去味器")
    ap.add_argument("input", nargs="?", help="输入文件（缺省读 stdin）")
    ap.add_argument("-t", "--text", help="直接传入要改写的文本")
    ap.add_argument("-o", "--output", help="输出文件（缺省打印 stdout）")
    ap.add_argument("--prompt-only", action="store_true", help="只输出提示词（不调用 API）")
    ap.add_argument("--api-key", default="", help="API Key（优先于配置文件）")
    args = ap.parse_args()

    # 读输入
    if args.text:
        text = args.text
    elif args.input:
        with open(args.input, encoding="utf-8") as f:
            text = f.read()
    else:
        text = sys.stdin.read()
    if not text.strip():
        raise SystemExit("❌ 没有输入内容")

    if args.prompt_only:
        result = build_prompt(text)
    else:
        print("⏳ 正在改写...", file=sys.stderr)
        result = call_llm(build_prompt(text), api_key=args.api_key)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(result)
        print(f"✅ 已保存到 {args.output}", file=sys.stderr)
    else:
        print(result)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `plugins/all-skills/skills/doc-ocr/scripts/dococr.py`
```
#!/usr/bin/env python3
"""
Doc-OCR — 文档文字识别（通用版）
================================
PDF / 图片 → 可编辑文字。支持扫描件 OCR（macOS Vision 自带，中英文）。

用法:
  python3 dococr.py 文件.pdf              # PDF → 文字（有文字层直接提取，扫描件自动OCR）
  python3 dococr.py 文件.png              # 图片 → OCR
  python3 dococr.py 目录/ -o 输出.txt     # 批量处理目录
  python3 dococr.py 文件.pdf --md         # 输出 Markdown

输出:
  <输入名>_ocr.txt（或 --md 输出 .md）

依赖:
  macOS 自带 Vision（无需安装）；PDF 用 pymupdf: pip install pymupdf
"""
import sys, os, argparse, glob

def ocr_image(path: str) -> str:
    """用 macOS Vision 识别图片中的文字（中英文）。"""
    import Quartz
    from Foundation import NSURL
    import Vision
    url = NSURL.fileURLWithPath_(path)
    handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLanguages_(["zh-Hans", "en"])
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    ok, err = handler.performRequests_error_([request], None)
    if not ok:
        return f"[OCR失败: {err}]"
    results = request.results() or []
    lines = [r.topCandidates_(1)[0].string() for r in results]
    return "\n".join(lines)

def ocr_pdf_pages(path: str) -> str:
    """PDF 逐页转图片后 OCR。"""
    import fitz  # pymupdf
    doc = fitz.open(path)
    parts = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=200)
        tmp = f"/tmp/dococr_p{i}.png"
        pix.save(tmp)
        text = ocr_image(tmp)
        parts.append(f"--- 第{i+1}页 ---\n{text}")
        os.remove(tmp)
    return "\n\n".join(parts)

def extract_pdf_text(path: str) -> str:
    """优先提取 PDF 文字层，若几乎无文字则走 OCR。"""
    import fitz
    doc = fitz.open(path)
    text = "\n".join(page.get_text() for page in doc)
    if len(text.strip()) > 20:
        return text
    print("⚠️ 文字层为空（扫描件），启动 OCR...", file=sys.stderr)
    return ocr_pdf_pages(path)

def main():
    ap = argparse.ArgumentParser(description="Doc-OCR — 文档文字识别")
    ap.add_argument("input", help="PDF/图片文件 或 目录")
    ap.add_argument("-o", "--output", help="输出文件（缺省 <输入名>_ocr.txt）")
    ap.add_argument("--md", action="store_true", help="输出 Markdown")
    args = ap.parse_args()

    files = []
    if os.path.isdir(args.input):
        files = sorted(glob.glob(os.path.join(args.input, "*")))
        files = [f for f in files if f.lower().endswith((".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"))]
    else:
        files = [args.input]

    if not files:
        raise SystemExit("❌ 没有可处理的文件")

    all_text = []
    for f in files:
        ext = f.lower().rsplit(".", 1)[-1]
        print(f"📄 处理: {os.path.basename(f)}", file=sys.stderr)
        if ext == "pdf":
            text = extract_pdf_text(f)
        else:
            text = ocr_image(f)
        all_text.append(f"# {os.path.basename(f)}\n{text}")

    result = "\n\n".join(all_text)
    if args.md:
        result = result.replace("\n", "  \n")
    out = args.output or (os.path.splitext(files[0])[0] + "_ocr" + (".md" if args.md else ".txt"))
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(result)
    print(f"✅ 已保存: {out}（{len(result)} 字）")

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `plugins/all-skills/skills/docx/ooxml/scripts/pack.py`
```
#!/usr/bin/env python3
"""
Tool to pack a directory into a .docx, .pptx, or .xlsx file with XML formatting undone.

Example usage:
    python pack.py <input_directory> <office_file> [--force]
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
import defusedxml.minidom
import zipfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Pack a directory into an Office file")
    parser.add_argument("input_directory", help="Unpacked Office document directory")
    parser.add_argument("output_file", help="Output Office file (.docx/.pptx/.xlsx)")
    parser.add_argument("--force", action="store_true", help="Skip validation")
    args = parser.parse_args()

    try:
        success = pack_document(
            args.input_directory, args.output_file, validate=not args.force
        )

        # Show warning if validation was skipped
        if args.force:
            print("Warning: Skipped validation, file may be corrupt", file=sys.stderr)
        # Exit with error if validation failed
        elif not success:
            print("Contents would produce a corrupt file.", file=sys.stderr)
            print("Please validate XML before repacking.", file=sys.stderr)
            print("Use --force to skip validation and pack anyway.", file=sys.stderr)
            sys.exit(1)

    except ValueError as e:
        sys.exit(f"Error: {e}")


def pack_document(input_dir, output_file, validate=False):
    """Pack a directory into an Office file (.docx/.pptx/.xlsx).

    Args:
        input_dir: Path to unpacked Office document directory
        output_file: Path to output Office file
        validate: If True, validates with soffice (default: False)

    Returns:
        bool: True if successful, False if validation failed
    """
    input_dir = Path(input_dir)
    output_file = Path(output_file)

    if not input_dir.is_dir():
        raise ValueError(f"{input_dir} is not a directory")
    if output_file.suffix.lower() not in {".docx", ".pptx", ".xlsx"}:
        raise ValueError(f"{output_file} must be a .docx, .pptx, or .xlsx file")

    # Work in temporary directory to avoid modifying original
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_content_dir = Path(temp_dir) / "content"
        shutil.copytree(input_dir, temp_content_dir)

        # Process XML files to remove pretty-printing whitespace
        for pattern in ["*.xml", "*.rels"]:
            for xml_file in temp_content_dir.rglob(pattern):
                condense_xml(xml_file)

        # Create final Office file as zip archive
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output_file, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in temp_content_dir.rglob("*"):
                if f.is_file():
                    zf.write(f, f.relative_to(temp_content_dir))

        # Validate if requested
        if validate:
            if not validate_document(output_file):
                output_file.unlink()  # Delete the corrupt file
                return False

    return True


def validate_document(doc_path):
    """Validate document by converting to HTML with soffice."""
    # Determine the correct filter based on file extension
    match doc_path.suffix.lower():
        case ".docx":
            filter_name = "html:HTML"
        case ".pptx":
            filter_name = "html:impress_html_Export"
        case ".xlsx":
            filter_name = "html:HTML (StarCalc)"

    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            result = subprocess.run(
                [
                    "soffice",
                    "--headless",
                    "--convert-to",
                    filter_name,
                    "--outdir",
                    temp_dir,
                    str(doc_path),
                ],
                capture_output=True,
                timeout=10,
                text=True,
            )
            if not (Path(temp_dir) / f"{doc_path.stem}.html").exists():
                error_msg = result.stderr.strip() or "Document validation failed"
                print(f"Validation error: {error_msg}", file=sys.stderr)
                return False
            return True
        except FileNotFoundError:
            print("Warning: soffice not found. Skipping validation.", file=sys.stderr)
            return True
        except subprocess.TimeoutExpired:
            print("Validation error: Timeout during conversion", file=sys.stderr)
            return False
        except Exception as e:
            print(f"Validation error: {e}", file=sys.stderr)
            return False


def condense_xml(xml_file):
    """Strip unnecessary whitespace and remove comments."""
    with open(xml_file, "r", encoding="utf-8") as f:
        dom = defusedxml.minidom.parse(f)

    # Process each element to remove whitespace and comments
    for element in dom.getElementsByTagName("*"):
        # Skip w:t elements and their processing
        if element.tagName.endswith(":t"):
            continue

        # Remove whitespace-only text nodes and comment nodes
        for child in list(element.childNodes):
            if (
                child.nodeType == child.TEXT_NODE
                and child.nodeValue
                and child.nodeValue.strip() == ""
            ) or child.nodeType == child.COMMENT_NODE:
                element.removeChild(child)

    # Write back the condensed XML
    with open(xml_file, "wb") as f:
        f.write(dom.toxml(encoding="UTF-8"))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `plugins/all-skills/skills/docx/ooxml/scripts/unpack.py`
```
#!/usr/bin/env python3
"""Unpack and format XML contents of Office files (.docx, .pptx, .xlsx)"""

import random
import sys
import defusedxml.minidom
import zipfile
from pathlib import Path

# Get command line arguments
assert len(sys.argv) == 3, "Usage: python unpack.py <office_file> <output_dir>"
input_file, output_dir = sys.argv[1], sys.argv[2]

# Extract and format
output_path = Path(output_dir)
output_path.mkdir(parents=True, exist_ok=True)
zipfile.ZipFile(input_file).extractall(output_path)

# Pretty print all XML files
xml_files = list(output_path.rglob("*.xml")) + list(output_path.rglob("*.rels"))
for xml_file in xml_files:
    content = xml_file.read_text(encoding="utf-8")
    dom = defusedxml.minidom.parseString(content)
    xml_file.write_bytes(dom.toprettyxml(indent="  ", encoding="ascii"))

# For .docx files, suggest an RSID for tracked changes
if input_file.endswith(".docx"):
    suggested_rsid = "".join(random.choices("0123456789ABCDEF", k=8))
    print(f"Suggested RSID for edit session: {suggested_rsid}")

```

### Core Architecture Module: `plugins/all-skills/skills/docx/ooxml/scripts/validate.py`
```
#!/usr/bin/env python3
"""
Command line tool to validate Office document XML files against XSD schemas and tracked changes.

Usage:
    python validate.py <dir> --original <original_file>
"""

import argparse
import sys
from pathlib import Path

from validation import DOCXSchemaValidator, PPTXSchemaValidator, RedliningValidator


def main():
    parser = argparse.ArgumentParser(description="Validate Office document XML files")
    parser.add_argument(
        "unpacked_dir",
        help="Path to unpacked Office document directory",
    )
    parser.add_argument(
        "--original",
        required=True,
        help="Path to original file (.docx/.pptx/.xlsx)",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose output",
    )
    args = parser.parse_args()

    # Validate paths
    unpacked_dir = Path(args.unpacked_dir)
    original_file = Path(args.original)
    file_extension = original_file.suffix.lower()
    assert unpacked_dir.is_dir(), f"Error: {unpacked_dir} is not a directory"
    assert original_file.is_file(), f"Error: {original_file} is not a file"
    assert file_extension in [".docx", ".pptx", ".xlsx"], (
        f"Error: {original_file} must be a .docx, .pptx, or .xlsx file"
    )

    # Run validations
    match file_extension:
        case ".docx":
            validators = [DOCXSchemaValidator, RedliningValidator]
        case ".pptx":
            validators = [PPTXSchemaValidator]
        case _:
            print(f"Error: Validation not supported for file type {file_extension}")
            sys.exit(1)

    # Run validators
    success = True
    for V in validators:
        validator = V(unpacked_dir, original_file, verbose=args.verbose)
        if not validator.validate():
            success = False

    if success:
        print("All validations PASSED!")

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `plugins/all-skills/skills/docx/ooxml/scripts/validation/__init__.py`
```
"""
Validation modules for Word document processing.
"""

from .base import BaseSchemaValidator
from .docx import DOCXSchemaValidator
from .pptx import PPTXSchemaValidator
from .redlining import RedliningValidator

__all__ = [
    "BaseSchemaValidator",
    "DOCXSchemaValidator",
    "PPTXSchemaValidator",
    "RedliningValidator",
]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #356** (2026-09-30): **Add apmzoom-dongdaemun plugin**
  *Symptoms*: ## Summary  Adds `apmzoom-dongdaemun`, a marketplace entry for a public plugin that lives in `plugins/apmzoom-dongdaemun/` of https://github.com/apmleokeo-gif/apmzoom-mcp (same `git-subdir` shape as the `carrick` and `archcore` entries).  It lets an assistant search the Dongdaemun (Seoul) wholesale fashion market through the apMZoomAI remote MCP server: items by keyword, new arrivals, and stalls by building / floor / stall number, each result linking back to apMZoomAI. Read-only — no prices, no contact details, no ordering. The plugin bundles the MCP connection (`https://www.apmzoom.com/mcp`, Streamable HTTP, no authentication) and a `dongdaemun-sourcing` skill that guides sourcing answers in 8 languages (English, Chinese, Korean, Japanese, Vietnamese, Thai, Indonesian, Malay).  ## Component Details  - **Name**: apmzoom-dongdaemun - **Type**: Plugin (remote MCP server + skill) - **Category**: productivity - **Source**: https://github.com/apmleokeo-gif/apmzoom-mcp/tree/main/plugins/apmzoom-dongdaemun (MIT) - **Homepage**: https://www.apmzoom.com - Also published in the official MCP Registry as `com.apmzoom.www/dongdaemun`.  ## Testing  - [x] Ran validation (`node scripts/validate-all.js`) — all passed - [x] Tested functionality — the live server answers `initialize`, `tools/list` (5 tools) and searches such as "dress" and "원피스" without authentication - [x] No overlap with existing components (no other Dongdaemun / Korean wholesale sourcing entry)  ## Examples  1. "Find linen d
  **Post-Mortem & Fix Analysis**:
  > Thanks for the marketplace entry. Reviewed the diff and the plugin at `apmleokeo-gif/apmzoom-mcp` `plugins/apmzoom-dongdaemun/` (`plugin.json`, `.mcp.json`, and the sourcing skill), then called the live server's `tools/list`.  **Security / prompt injection:** The MCP entry is a single unauthenticated HTTP URL, `https://www.apmzoom.com/mcp`. The server currently exposes five tools (`search_products`, `get_new_arrivals`, `find_stalls`, `get_product`, `list_buildings`), each marked read-only, with `additionalProperties: false` and short keyword limits. A sample search returned item links and images on `www.apmzoom.com` and repeated that prices are not in the tool result. The skill tells the agent not to pass the buyer's whole message as the query, and not to invent prices, contact details, or endorsements. I did not find a hook or a write/order tool.  **Codebase fit:** `git-subdir` with `ref: main` matches the Carrick and Archcore entries. The marketplace version matches `plugin.json` (`1

- **Issue #355** (2026-09-30): **Add system-prompt-lookup skill**
  *Symptoms*: Adds one skill: `plugins/all-skills/skills/system-prompt-lookup/SKILL.md`. Category `ai-agents`.  **What it is for.** Ask a model what Cursor's system prompt says and it will answer — fluently, and from nothing. The output reads like a quotation but is a reconstruction, and nothing in the transcript marks the difference. This skill makes the agent go read the artifact instead, from a dated public archive of the system prompts and tool-call schemas shipped products actually send.  The judgement in it is mostly about what *not* to claim:  - quote only what you fetched this session, with the file name and capture date attached - say whether the artifact was captured off the wire or reported by the vendor — those are different kinds of evidence - a product that ships interactive and headless modes has more than one prompt, so "the" prompt is under-specified - a snapshot is not the product's current behaviour, and coverage is uneven  It also carries an injection warning: these files *are* other systems' system prompts, so the skill tells the agent to read them as data and never feed them back as instructions.  The worked example is a real one — Claude Code rewrites its own identity line between the interactive CLI and the Agent SDK entry point, and ships six fewer tools in the headless variant.  **Checks.** `node scripts/validate-skills.js` passes (all skills). Read-only: every command is a `curl` against public github.com URLs, no credentials, nothing fetched is executed. Branch 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the skill. Reviewed the text against the skill schema and against [Continuum-AI-Corp/OrcaPromptVault](https://github.com/Continuum-AI-Corp/OrcaPromptVault).  **Security / prompt injection:** The only commands are unauthenticated reads of public files on github.com. The skill says to treat those files as data and not to follow them, which is the right rule for a directory of other products' prompts. Frontmatter validates (`name`, `description`, `category: ai-agents`). The example paths under `Claude-Code/` and `docs/CAPTURES.md` are present on `main`.  **Codebase fit:** One self-contained `SKILL.md` under `plugins/all-skills/skills/system-prompt-lookup/`. The name matches the directory, and nothing else in the collection does this.  One non-blocking note: when the product name comes from the user, take the directory and file names from the archive listing rather than interpolating that string into a shell command.  Merging.

- **Issue #354** (2026-09-30): **Add mirrord skill**
  *Symptoms*: Adds a `mirrord` skill (category `development-code`): lets Claude run a local process with a Kubernetes pod's env, network and traffic, so changes are verified against real services without deploying. Adapted from the official mirrord skills (metalbear-co/skills, MIT).  - `npm run validate`: all validations pass  Disclosure: I work on mirrord.
  **Post-Mortem & Fix Analysis**:
  > Thanks for adapting this from the MetalBear skills, and for saying to confirm before steal mode. I compared this copy with `skills/mirrord-quickstart/SKILL.md` in [metalbear-co/skills](https://github.com/metalbear-co/skills).  **Security — blocking as shipped:**  1. **The verification step prints the pod environment.** This skill tells the agent to run `mirrord exec --target deployment/<name> -- env`. That copies the target pod's environment into the chat, and those values are often database passwords and API keys. The official quickstart narrows the check (`env | grep -i database`) and still treats that output as sensitive. Please verify the session without printing secret values, and say not to repeat env vars, file contents, or tokens from the impersonated pod.  2. **The install safety rule was dropped.** The official skill says not to pipe a downloaded install script into a shell, and to use a package manager or a pinned binary the user verifies. This copy only links the quick-star

- **Issue #353** (2026-09-29): **Update subagent validation: run agent-only checks against the agent bundle**
  *Symptoms*: ## Summary  `scripts/validate-subagents.js` globs two bundles — `plugins/all-agents/agents/*.md` and `plugins/all-commands/commands/*.md` — and then applies three agent-only checks: file name matches the `name` field, no duplicate names across agents, and a warning when the "You are a..." opening statement is missing.  Those three checks were guarded with `file.startsWith('subagents/')`. No path returned by those glob patterns can start with `subagents/`, so the guards were always false and the checks never ran for any file; a broken agent file would report `✅ All validations passed!`.  This keys the guards off the prefix the script actually globs (`plugins/all-agents/agents/`) and adds `scripts/validate-subagents.test.js` for the three checks plus the well-formed case. The report on the current tree is unchanged — 117 agent files and 177 command files still validate with zero errors and zero warnings — so this only restores the missing coverage.  ## Component Details  - **Name:** validate-subagents.js - **Type:** Validation script - **Category:** tooling  ## Testing  - [x] Ran validation (`npm test` — `npm run validate` exits 0, unit tests pass) - [x] Tested functionality - [x] No overlap with existing components  Reproduction of the gap, before and after the change:  ```bash printf -- '---\nname: other-name\ndescription: Scratch fixture used to check validator coverage.\ncategory: data-ai\n---\n\nBody.\n' > plugins/all-agents/agents/probe-agent.md node scripts/validate-suba
  **Post-Mortem & Fix Analysis**:
  > Thanks for catching this. The agent-only checks were gated on `file.startsWith('subagents/')`, and the script only globs `plugins/all-agents/agents/` and `plugins/all-commands/commands/`, so those checks never ran.  **Security / prompt injection:** The change is local validation only. The new tests build a temp tree and run the existing script with a fixed path. No network, no shell built from file contents.  **Codebase fit:** Keying the checks off `plugins/all-agents/agents/` matches the glob. I ran `node --test scripts/validate-subagents.test.js`: filename mismatch and duplicate names fail, a missing "You are" opening warns and still exits 0, and a well-formed agent passes.  Merging.

- **Issue #352** (2026-09-29): **Add ashlr plugin**
  *Symptoms*: ## Summary  Adds `ashlr`, a marketplace entry for the existing public plugin at https://github.com/ashlrai/ashlr-plugin (plugin manifest at the repo root, `.claude-plugin/plugin.json`, same `github` source shape as the `active-memory` entry).  ashlr-plugin swaps high-volume Read, Grep, Edit and Bash calls for MCP tools that return less output. On the repo's reproducible benchmark it cut token use by 57% (`bun run scripts/run-benchmark.ts --compare`, methodology in docs/benchmarks.md). It runs locally, needs Bun, and telemetry is off by default.  ## Component Details  - **Name**: ashlr (matches `name` in the upstream plugin.json) - **Type**: Plugin (MCP server, slash commands, hooks, status line) - **Category**: productivity - **Source**: https://github.com/ashlrai/ashlr-plugin (MIT) - **Homepage**: https://plugin.ashlr.ai/  ## Testing  - [x] Ran validation (`npm run validate`): all passed - [x] `.claude-plugin/marketplace.json` parses; one entry appended, nothing else changed - [x] No overlap with an existing entry (no other ashlr entry in the marketplace)  ## Examples  - `/plugin install ashlr@buildwithclaude`, then work as usual: the plugin's MCP tools handle large file reads, searches and edits with less output. - `/ashlr-benchmark` runs the token-savings benchmark against the current project. - `/ashlr-benchmark --compare` prints an A/B table against the built-in tools.  One plugin in this PR. Disclosure: I maintain this project. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the marketplace entry, and for keeping telemetry off by default. I checked the listing against `ashlrai/ashlr-plugin` at the version in this PR (`1.36.2`): `hooks/hooks.json`, the PreToolUse read/commit hooks, and `hooks/audit-upload.ts`. The JSON shape matches other `github` source entries, and the name is unique.  **Security — blocking as shipped:**  1. **Git commits are rewritten by default.** `hooks/commit-attribution.ts` runs on Bash. If the command is `git commit -m` or `--message=`, it appends `Assisted-By: ashlr-plugin <https://plugin.ashlr.ai>`. Missing settings count as enabled (`ashlr.attribution` must be explicitly false to turn it off). That changes the user's git history, and this marketplace entry does not say so.  2. **Tool inputs can leave the machine on a different switch than telemetry.** With `ASHLR_PRO_TOKEN` set, `hooks/audit-upload.ts` POSTs the tool name, the full tool input, cwd, and commit to `https://api.ashlr.ai/audit/event` after Edit, Write, and

- **Issue #351** (2026-09-29): **Add gsc-seo-optimizer skill**
  *Symptoms*: ## Summary  Add a Search Console analysis skill for choosing a small, evidence-backed batch of page improvements, including a no-change recommendation when the data is weak or a page was recently edited. It checks exact property, country/device filters, inclusive Pacific-time windows, independent totals and query/page linkage before interpreting performance.  The default workflow is read-only. CSV/ZIP mode works locally with Python standard-library code and needs no account. Optional Google API access uses existing authorization and the Search Console read-only scope. No embedded credentials, telemetry, vendor connector, automatic OAuth or external uploads are included.  ## Component Details  - **Name**: gsc-seo-optimizer - **Type**: Skill - **Category**: analytics - **Location**: `plugins/all-skills/skills/gsc-seo-optimizer/`  ## Differentiation  `claude-ops/ops-marketing` includes GSC within a multi-platform marketing dashboard and its plugin setup. This standalone skill focuses on comparable GSC evidence, offline exports and bounded page prioritization without that plugin infrastructure. `seo-podcast-optimizer` addresses podcast metadata rather than Search Console analysis.  ## Included resources  - Data access, data quality, prioritization and reporting references. - A CSV/ZIP importer that preserves unknown values and separate tables, rejects ambiguous comparison columns, and bounds archive size without extracting paths. - An optional read-only API helper for scope verif
  **Post-Mortem & Fix Analysis**:
  > Thanks for the skill. Reviewed `SKILL.md`, the references, `import_gsc.py`, `gsc_fetch.py`, and the tests.  **Security / prompt injection:** Export mode stays in the standard library. ZIP members are read in memory and never extracted, including names like `../escaped.csv`. Size is capped at 25 MiB and 100 CSVs. The API helper uses the Search Console readonly scope, refuses a property the credential cannot access, and does not print tokens. The skill says not to pull cookies or passwords from the browser, and not to treat exports as instructions.  **Codebase fit:** Frontmatter validates (`category: analytics`, directory name matches). `python3 -m unittest discover -s plugins/all-skills/skills/gsc-seo-optimizer/tests -v` passed, 14 tests. The importer and fetcher are in the skill folder, so an install from this collection can run them as written.  Merging.

- **Issue #350** (2026-09-29): **Add competitor-research skill**
  *Symptoms*: ## Summary  Add a standalone competitor-research skill for builders deciding which acquisition experiment to try. It keeps dated evidence, separates observations from founder claims and estimates, and checks metric definitions before connecting launch activity, installs, customers and revenue.  The skill works with public sources or supplied materials, without a Tracetify account or connector. Untrusted research material is treated as data rather than instructions; the skill does not authorize account creation, directory submissions, outreach or paid retrieval.  ## Component Details  - **Name**: competitor-research - **Type**: Skill - **Category**: research - **Location**: `plugins/all-skills/skills/competitor-research/` - Includes MIT license, an evidence interpretation guide and a report template. - Registers the skill keyword in the existing all-skills bundle and corrects its description to the current 177-skill count.  ## Existing components and scope  - `competitive-ads-extractor` analyzes ad-library creatives and messaging. This skill evaluates dated launch and acquisition evidence, including organic distribution, metric compatibility and transferability. - `startup-superpowers/competitors` maintains a project's competitive landscape and competitor files. This is a bounded research brief without that plugin's project structure, monitoring workflow or subagents. - `hookradar-creative-intelligence` covers ad/video creative intelligence and its optional service. This does 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the skill. Reviewed the skill text, the evidence guide, the report template, and the all-skills manifest change.  **Security / prompt injection:** Research material is treated as data, not commands. The skill does not install a connector, create an account, submit listings, or spend money because research was requested. Supplied private files stay local unless the user authorizes sending them out. Frontmatter validates (`name`, `description`, `category: research`, `license`).  **Codebase fit:** It lives under `plugins/all-skills/skills/competitor-research/` with the MIT notice beside it. It does not overlap with `competitive-ads-extractor` (ad creatives) or the startup-superpowers competitor workflow. The bundle description count matches the skill total after this folder is added.  Merging.

- **Issue #349** (2026-09-28): **Add carrick plugin**
  *Symptoms*: ## Summary  Adds `carrick`, a marketplace entry for an existing public plugin that lives in the `plugin/` directory of https://github.com/carrick-tools/carrick (same `git-subdir` shape as the `pine` and `archcore` entries).  Carrick indexes TypeScript codebases across service and repository boundaries. The plugin adds the edited file's routes, calls and cross-service type mismatches to the session after each edit, and registers Carrick's language server. It pairs with the hosted Carrick MCP server (Streamable HTTP with OAuth, no API key to paste), published in the official MCP Registry as `io.github.carrick-tools/carrick`.  ## Component Details  - **Name**: carrick - **Type**: Plugin (hooks + LSP server), pairs with a remote MCP server - **Category**: development - **Source**: https://github.com/carrick-tools/carrick/tree/main/plugin (Elastic-2.0, source-available) - **Homepage**: https://carrick.tools · Docs: https://docs.carrick.tools  ## Testing  - [x] `claude plugin validate --strict ./plugin` passes in the source repo - [x] `claude plugin marketplace add carrick-tools/carrick` then `claude plugin install carrick@carrick` installs 0.3.93 with 3 hooks and 1 LSP server - [x] `.claude-plugin/marketplace.json` parses; one entry appended, nothing else changed  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Thanks for the marketplace entry. Reviewed the diff and the plugin at `carrick-tools/carrick` `plugin/` (manifest, `hooks/hooks.json`, `.lsp.json`, and the hook sources those commands call).  **Security / prompt injection:** The marketplace entry only points at that subdirectory. The hook commands are fixed (`carrick hook post-edit`, `session-start`, `stop`), not strings built from the prompt. What they add to the session is local index output (routes, calls, type mismatches, a reuse note). I did not find the hook path sending repository contents to an arbitrary URL. Session start can start a detached `carrick refresh` when a hosted index is still missing; that is the documented product behavior, and `CARRICK_CHANNEL=off` silences it. `git-subdir` with `ref: main` matches the existing `archcore` entry.  **Codebase fit:** JSON parses, the name is unique, and the source shape is one this marketplace already installs.  One non-blocking note: `plugin.json` on `main` is already `0.3.94`, wh

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

### Incident Patch 1: `6178ae2b` (2026-09-27)
**Commit Message**: Add active-memory plugin (#343)

* Add active-memory plugin

* Bump active-memory to 0.2.2

* Bump active-memory to 0.2.4

**File**: `.claude-plugin/marketplace.json` (modified, +25/-0)
```diff
@@ -2402,6 +2402,31 @@
         "source": "github",
         "repo": "getpapi/papi"
       }
+    },
+    {
+      "name": "active-memory",
+      "description": "Switch to a fresh Claude chat without losing a single rule, correction or number. /amhandoff writes a complete handoff file, and a code word plus checkpoints warn you when it is time to switch.",
+      "author": {
+        "name": "Klopyy",
+        "url": "https://github.com/Klopyy"
+      },
+      "homepage": "https://github.com/Klopyy/active-memory",
+      "repository": "https://github.com/Klopyy/active-memory",
+      "license": "MIT",
+      "keywords": [
+        "handoff",
+        "context",
+        "long-chats",
+        "chat-memory",
+        "checkpoint",
+        "productivity"
+      ],
+      "category": "productivity",
+      "version": "0.2.4",
+      "source": {
+        "source": "github",
+        "repo": "Klopyy/active-memory"
+      }
     }
   ]
 }
```

---

### Incident Patch 2: `d143ca3f` (2026-08-22)
**Commit Message**: Add agenttrace session audit skill (#287)

Co-authored-by: 张安哲 <zhanganzhe@tenclass.com>

**File**: `plugins/all-skills/skills/agenttrace-session-audit/SKILL.md` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+---
+name: agenttrace-session-audit
+description: Audit local AI coding-agent sessions with agenttrace for cost, tokens, tool failures, latency, anomalies, health, diffs, and CI gates.
+category: observability
+license: MIT
+requires:
+  bins: [agenttrace]
+---
+
+# agenttrace Session Audit
+
+Use this skill when session logs need an operational read: spend, token burn, cache use, tool failures, retry loops, latency, health, anomalies, and CI gate readiness.
+
+## Workflow
+
+1. Prefer the installed `agenttrace` binary when it is available on `PATH`.
+2. If the binary is not available and the current directory is the `luoyuctl/agenttrace` repository, use `cargo run -q -p agenttrace --`.
+3. Start with discovery unless the user gave a specific file or directory:
+
+```bash
+agenttrace --doctor
+agenttrace --overview
+```
+
+4. For a fast human report, use Markdown:
+
+```bash
+agenttrace --overview -f markdown -o agenttrace-overview.md
+```
+
+5. For automation or CI, use JSON or health gates:
+
+```bash
+agenttrace --overview -f json -o agenttrace-overview.json
+agenttrace --overview --fail-under-health 80 --fail-on-critical --max-tool-fail-rate 15
+```
+
+6. For a single recent session:
+
+```bash
+agenttrace --latest
+agenttrace --latest -f json
+```
+
+7. For a specific export or session directory:
+
+```bash
+agenttrace path/to/session-or-export.json
+agenttrace --overview -d path/to/session-dir
+```
+
+## Report Focus
+
+- Lead with the highest-risk sessions and the reason they matter.
+- Call out token/cost waste, repeated tool failures, retry loops, long gaps, and low health scores.
+- When proposing a CI gate, include the exact `agenttrace` command and threshold.
+- If no sessions are detected, run `agenttrace --doctor` and report the detected agent directories and next step.
+- Report the session capability level (`Detailed`, `Aggregate`, or `Limited`) before relying on latency or step evidence.
+- Treat Tool Steps as metadata-only evidence. Do not imply that Aggregate or Limited sources have a complete execution trace.
+
+## Guardrails
+
+- Treat prompts, code, and session contents as local/private data. Do not upload logs to external services.
+- Do not invent metrics. If a parser cannot infer cost, model, or latency, say which field is missing.
+- Do not compare missing event-level evidence as zero latency or zero failures; mark it unavailable.
+- Do not overwrite user reports unless the user asked for that output path.
```

---

### Incident Patch 3: `9358e616` (2026-08-22)
**Commit Message**: Add video-to-text, de-ai-writer, ecommerce-material-studio (schema-valid frontmatter fix) (#286)

* Add video-to-text, de-ai-writer, ecommerce-material-studio (fixed: docs match real CLI)

- video-to-text: link path returns metadata only; local-file transcription is real. Removed unimplemented Kuaishou/share-link transcribe claims.
- de-ai-writer: deai.py now reads LLM_API_KEY/LLM_BASE_URL/LLM_MODEL env vars as documented; --prompt-only mode unchanged.
- ecommerce-material-studio: SKILL.md commands now match real CLIs (--image/--plan/--input-dir); scene compositor documented as library API; brand profile path fixed (brand_profiles/langke.json shipped in-tree).

* fix(video-to-text): schema-valid frontmatter + relative paths + no donation

* fix(de-ai-writer): schema-valid frontmatter + relative paths + no donation

* fix(ecommerce-material-studio): schema-valid frontmatter + relative paths + no donation

* fix(de-ai-writer): use full-width quotes in description to fix YAML frontmatter parsing

* fix(de-ai-writer): remove author/version fields not allowed by skill schema

---------

Co-authored-by: luan haoyu <luanhaoyu@luandeMacBook-Air.local>

**File**: `plugins/all-skills/skills/de-ai-writer/SKILL.md` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+---
+name: de-ai-writer
+description: "AI 文案去味器。用户提供 AI 生成的文本（公众号/小红书/电商文案等），觉得“太 AI 味”要改得更自然、更像人写的时使用。输出自然有人味的中文。De-AI writer: rewrite AI-generated copy (WeChat articles, Xiaohongshu, e-commerce) into natural, human-sounding Chinese text."
+category: media-content
+license: MIT
+---
+
+# De-AI Writer AI 文案去味器
+
+把 AI 生成的文字改写成自然、有真人味的中文。专治空洞拔高、排比三连、官方黑话、模板化结尾。
+
+## 触发条件
+
+用户提供一段文字（粘贴或文件），要求：
+- "去AI味""改得像人写的""太官方了改自然点"
+- 润色文案（公众号/小红书/电商标题/产品描述）
+
+## 使用步骤
+
+### 1. 有 API Key（推荐，效果好）
+
+```bash
+export LLM_API_KEY="你的key"
+export LLM_BASE_URL="https://api.deepseek.com/v1"  # 任意 OpenAI 兼容接口
+export LLM_MODEL="deepseek-chat"
+
+python3 scripts/deai.py 稿子.txt -o 改好.txt
+```
+
+### 2. 无 API Key（零成本模式）
+
+```bash
+python3 scripts/deai.py 稿子.txt --prompt-only
+```
+
+输出内置完整改写规则的提示词，粘贴到任何 AI 助手（ChatGPT/文心/Kimi）即可改写。
+
+## 零依赖
+
+纯 Python 标准库，无需安装任何包。
```

**File**: `plugins/all-skills/skills/de-ai-writer/scripts/deai.py` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+#!/usr/bin/env python3
+"""
+De-AI Writer — AI 文案去味器（通用版 CLI）
+============================================
+把 AI 生成的文本改写成自然、有真人味的中文。
+
+用法:
+  python3 deai.py 输入文件.txt -o 输出文件.txt     # 处理文件
+  cat 文本.txt | python3 deai.py -o 输出.txt       # 管道输入
+  python3 deai.py -t "要改写的文本"                 # 直接传文本
+  python3 deai.py 输入.txt --prompt-only           # 只输出 prompt（无API key时用）
+
+配置（环境变量）:
+  LLM_API_KEY    API Key（OpenAI 兼容）
+  LLM_BASE_URL   接口地址，默认 https://api.openai.com/v1
+  LLM_MODEL      模型名，默认 gpt-4o-mini
+  不配置也能用：--prompt-only 模式输出可直接粘贴到任意 AI 助手的提示词
+
+示例:
+  python3 deai.py draft.txt -o polished.txt
+  python3 deai.py -t "此外，该产品不仅性能卓越，更是彰显了创新精神。" 
+"""
+import sys, os, json, argparse, urllib.request
+
+# ---------- 核心提示词（产品核心资产） ----------
+CORE_PROMPT = """你是一位资深中文编辑，专长是去除 AI 味、恢复真人写作风格。请把用户提供的文本改写成自然、有人味的中文。
+
+【必须清除的 AI 味模式】
+1. 空洞拔高：删除"不仅...更是""彰显""标志着""至关重要""深远影响"等虚张声势的表述
+2. 排比三连：打破"创新、卓越、领先"式三连排比
+3. 万能衔接词：清除"此外""然而""值得注意的是""综上所述"等机械过渡
+4. 官方腔：去掉"赋能""抓手""闭环""颗粒度"等黑话
+5. 形容词堆砌：删掉"极致""巅峰""完美"等夸张词
+6. 模板化结尾：删除"未来可期""让我们拭目以待"式空话
+7. 重复替代词：避免用"该产品""此方案"反复替换主语
+8. 过度客套：删除"希望对您有帮助""欢迎随时联系"式废话
+9. 被动句式：能主动就主动（"文件被保存"→"系统保存了文件"）
+10. 完美工整：允许句子长短交错、口语化、轻微不完美
+
+【写作要求】
+- 保留原意、事实、数据，只改表达
+- 用短句和长句交错，自然呼吸感
+- 可以有一点点个人态度（"说实话""我个人觉得"），但不要过度
+- 中文优先，专有名词保留原文
+- 输出 ONLY 改写后的文本，不要任何解释、前言、后记
+"""
+
+def build_prompt(text: str) -> str:
+    return CORE_PROMPT + "\n\n【用户文本】\n" + text
+
+def load_config():
+    """读取配置：环境变量优先，其次参数，最后 ~/.deai_writer.conf 配置文件。
+    环境变量: LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
+    配置示例 (~/.deai_writer.conf):
+        [llm]
+        key = sk-xxx
+        base_url = https://api.deepseek.com/v1
+        model = deepseek-chat
+    """
+    import configparser
+    cfg = configparser.ConfigParser()
+    cfg.read(os.path.expanduser("~/.deai_writer.conf"))
+    key = os.environ.get("LLM_API_KEY", "") or cfg.get("llm", "key", fallback="")
+    base = os.environ.get("LLM_BASE_URL", "") or cfg.get("llm", "base_url", fallback="https://api.openai.com/v1")
+    model = os.environ.get("LLM_MODEL", "") or cfg.get("llm", "model", fallback="gpt-4o-mini")
+    return key, base, model
+
+def call_llm(prompt: str, api_key: str = "", base_url: str = "", model: str = "") -> str:
+    if not api_key:
+        api_key, base_url, model = load_config()
+    base = base_url.rstrip("/")
+    if not api_key:
+        raise SystemExit("❌ 未配置 API Key。用 --api-key 参数，或写 ~/.deai_writer.conf（见 load_config 注释），或用 --prompt-only 模式。")
+    req = urllib.request.Request(
+        base + "/chat/completions",
+        data=json.dumps({
+            "model": model,
+            "messages": [{"role": "user", "content": prompt}],
+            "temperature": 0.7,
+        }).encode(),
+        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
+    )
+    with urllib.request.urlopen(req, timeout=120) as resp:
+        data = json.loads(resp.read())
+    return data["choices"][0]["message"]["content"].strip()
+
+def main():
+    ap = argparse.ArgumentParser(description="De-AI Writer — AI 文案去味器")
+    ap.add_argument("input", nargs="?", help="输入文件（缺省读 stdin）")
+    ap.add_argument("-t", "--text", help="直接传入要改写的文本")
+    ap.add_argument("-o", "--output", help="输出文件（缺省打印 stdout）")
+    ap.add_argument("--prompt-only", action="store_true", help="只输出提示词（不调用 API）")
+    ap.add_argument("--api-key", default="", help="API Key（优先于配置文件）")
+    args = ap.parse_args()
+
+    # 读输入
+    if args.text:
+        text = args.text
+    elif args.input:
+        with open(args.input, encoding="utf-8") as f:
+            text = f.read()
+    else:
+        text = sys.stdin.read()
+    if not text.strip():
+        raise SystemExit("❌ 没有输入内容")
+
+    if args.prompt_only:
+        result = build_prompt(text)
+    else:
+        print("⏳ 正在改写...", file=sys.stderr)
+        result = call_llm(build_prompt(text), api_key=args.api_key)
+
+    if args.output:
+        with open(args.output, "w", encoding="utf-8") as f:
+ 
```

**File**: `plugins/all-skills/skills/ecommerce-material-studio/SKILL.md` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+---
+name: ecommerce-material-studio
+description: "电商素材工坊（中英双语）。用户需要生成电商主图、详情图、场景图、产品图合成、品牌叠加时使用。自动识别品类→匹配风格→场景感知合成→统一文字→自动质检→多平台适配→标准化交付。E-commerce product image studio: category detection, style matching, scene-aware compositing, text overlay, quality check, multi-platform adaptation, batch delivery."
+category: ecommerce
+license: MIT
+---
+
+# 电商素材工坊 / E-commerce Material Studio
+
+生成电商产品素材（主图/详情图/场景图）的一站式工具链。输入产品图片 → 自动完成品类识别、风格匹配、场景合成、文字叠加、质检、多平台适配、批量交付。
+
+**One-stop pipeline for e-commerce product images: category detection → style matching → scene compositing → text overlay → quality check → platform adaptation → batch delivery.**
+
+## 何时使用 / When to use
+
+- 用户需要生成**电商主图/详情图**（如"帮我做一套剃须刀主图"）
+- 需要**产品图合成到场景**（白底图 → 场景图）
+- 需要**品牌叠加**（Logo/保障条/卖点文字/徽章）
+- 需要**多平台尺寸适配**（淘宝/快手/抖音/拼多多/京东等 7 平台）
+- 需要**批量生成**多个产品素材
+
+## 使用流程 / Workflow
+
+```bash
+# 0. 环境依赖（一次性）
+pip install Pillow numpy scipy
+
+# 1. 品类识别：输入产品图 → 识别品类/风格
+python3 scripts/category_detector.py --image product.png
+
+# 2. 风格匹配：品类+价位+平台+品牌 → 推荐模板
+python3 scripts/style_matcher.py --category 个护电器 --sub-category 剃须刀 --price 169 --platform kuaishou
+
+# 3. 场景感知合成（核心）：库调用（SceneAwareCompositor 是 Python 库，非 CLI）
+python3 -c "
+from PIL import Image
+from scripts.scene_aware_compositor import SceneAwareCompositor
+c = SceneAwareCompositor()
+scene = Image.open('scene.jpg'); product = Image.open('product.png')
+result = c.composite(scene_image=scene, product_image=product, scene_type='lifestyle_bathroom', position=(0.5, 0.45))
+result.save('result.png')
+"
+
+# 4. 统一文字叠加（处理 plan.json 里所有文字层）
+python3 scripts/text_engine.py --plan output/plan.json --brand langke --scene-tone dark
+
+# 5. 自动质检（读取 plan.json + 检查成品图）
+python3 scripts/quality_check.py --plan output/plan.json
+
+# 6. 多平台尺寸适配
+python3 scripts/platform_adapter.py --input-dir ./output --platforms kuaishou --output-dir ./platform_output
+
+# 7. 标准化交付打包（自动生成使用指南+清单+zip）
+python3 scripts/delivery_packager.py --project-dir ./output --product-name "示例产品"
+
+# 8. 批量处理（多产品，断点续传）
+python3 scripts/batch_processor.py --input products.json --output-dir ./batch --prepare
+```
+
+## 模块清单 / Modules
+
+| 模块 | 功能 | 依赖 |
+|:---|:---|:---|
+| `category_detector.py` | 品类识别（色调/材质→子品类） | Pillow |
+| `style_matcher.py` | 风格匹配（品类+价位+平台+品牌→模板） | 无 |
+| `brand_loader.py` | 品牌配置加载（多品牌/Logo选择） | 无 |
+| `text_engine.py` | 统一文字引擎（z-index/避让/对比度） | Pillow |
+| `quality_check.py` | 自动质检（分辨率/可读性/Logo/完整/重叠） | Pillow |
+| `preference_memory.py` | 偏好记忆（跨项目复用风格） | 无 |
+| `batch_processor.py` | 批量处理（断点续传/重试/报告） | 无 |
+| `platform_adapter.py` | 7 平台尺寸适配（resize/crop/压缩） | Pillow |
+| `delivery_packager.py` | 交付打包（使用指南+清单+zip） | Pillow |
+| `layout_engine.py` | 布局引擎（物理尺寸→像素比例） | 无 |
+| `scene_aware_compositor.py` | 场景感知合成（参照物尺度/透视/景深） | Pillow+numpy+scipy |
+
+## 数据文件 / Data (references/)
+
+- `category_templates.json` — 12 品类场景模板库（推荐场景/prompt/配色/文字风格）
+- `product_profiles.json` — 产品档案库（示例：example_shaver）
+- `brand_profiles/langke.json` — 示例品牌配置（朗科=示例品牌，非真实）
+- `brand_config_template.json` — 新建品牌模板
+- `user_preferences.json` — 偏好记忆库（模板）
+
+## 注意事项 / Notes
+
+- **字体**：`text_engine.py` 需要中文字体（macOS: `/System/Library/Fonts/PingFang.ttc`，Linux: NotoSansCJK，Windows: msyh.ttc）——按需修改 `FONT_PATHS_BOLD`/`FONT_PATHS_REGULAR` 常量
+- **品牌配置**：用 `brand_config_template.json` 新建自己的品牌（含 Logo 路径/色系/保障条）
+- **合成模式**：`scene_aware_compositor.py` 支持场景感知模式（自动算尺度）和兼容模式（固定 scale）
+- 参考数据中的"朗科/LangKe"为**示例品牌**，可直接替换为自己的品牌配置
```

**File**: `plugins/all-skills/skills/ecommerce-material-studio/references/brand_config_template.json` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+{
+  "brand_name": "示例品牌",
+  "logo": {
+    "path": "/path/to/your/logo.png",
+    "max_width_ratio": 0.25,
+    "slogan": "品牌slogan（可选，显示在logo下方）"
+  },
+  "badge": {
+    "path": "/path/to/your/badge.png",
+    "max_width_ratio": 0.14
+  },
+  "guarantee_bar": {
+    "labels": ["官方正品", "全国联保", "售后无忧", "现货速发"],
+    "height_ratio": 0.055
+  },
+  "colors": {
+    "accent": "#D4AF6A",
+    "text_primary": "#FFFFFF",
+    "text_secondary": "#CCCCCC",
+    "bar_bg_dark": "#0A0A0F",
+    "bar_bg_light": "#FFFFFF",
+    "bar_text_dark": "#C8C8C8",
+    "bar_text_light": "#505050"
+  },
+  "logo_margin_ratio": 0.03,
+  "brand_zone_top_ratio": 0.14,
+  "content_zone_bottom_ratio": 0.88,
+  "guarantee_zone_bottom_ratio": 0.98,
+  "safe_margin_ratio": 0.02
+}
```

**File**: `plugins/all-skills/skills/ecommerce-material-studio/references/brand_profiles/langke.json` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+{
+  "brand_name": "LangKe",
+  "brand_cn": "朗科",
+  "logo_variants": {
+    "white": {
+      "path": "brand_logos/langke/white_cn_left.png",
+      "scene_tone": "dark",
+      "description": "白色中文左对齐Logo，适用于深色场景"
+    },
+    "blue": {
+      "path": "brand_logos/langke/blue_cn_left.png",
+      "scene_tone": "light",
+      "description": "蓝色中文左对齐Logo，适用于浅色场景"
+    }
+  },
+  "colors": {
+    "primary": "#0066CC",
+    "accent": "#D4AF6A",
+    "text_on_dark": "#FFFFFF",
+    "text_on_light": "#1A1A1A"
+  },
+  "guarantee_bar": {
+    "labels": ["官方正品", "全国联保", "售后无忧", "现货速发"],
+    "style": "rounded_pill"
+  },
+  "style_constraints": {
+    "forbidden_elements": ["过于花哨的装饰", "非品牌色系的渐变"],
+    "preferred_scenes": ["tech_gradient", "lifestyle_bathroom", "minimalist"],
+    "tone_range": ["dark", "light"]
+  }
+}
```

---

### Incident Patch 4: `c592600b` (2026-08-18)
**Commit Message**: Fix search result hydration identity (#272)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "main": "index.js",
   "scripts": {
     "test": "npm run validate && npm run test:unit",
-    "test:unit": "node --test scripts/github-search-pagination.test.js && node --experimental-strip-types --test web-ui/lib/indexer/search-pagination.test.ts web-ui/lib/search/search-types.test.ts web-ui/lib/stories-server.test.ts",
+    "test:unit": "node --test scripts/github-search-pagination.test.js && node --experimental-strip-types --test web-ui/lib/indexer/search-pagination.test.ts web-ui/lib/search/search-types.test.ts web-ui/lib/search/search-hydration.test.ts web-ui/lib/stories-server.test.ts",
     "test:integration": "./tests/plugin-test-harness.sh",
     "validate": "node scripts/validate-all.js",
     "validate:subagents": "node scripts/validate-subagents.js",
```

**File**: `web-ui/lib/search/search-hydrate.ts` (modified, +9/-11)
```diff
@@ -3,6 +3,7 @@ import { getDbPluginsBySlugs, getLocalBuildWithClaudePlugins } from '@/lib/plugi
 import { getMarketplacesByNamespaces } from '@/lib/marketplace-server'
 import type { UnifiedPlugin, PluginType } from '@/lib/plugin-types'
 import type { MarketplaceRegistry } from '@/lib/marketplace-types'
+import { hydrateHitsByTypeAndSlug } from './search-hydration'
 
 /**
  * Meilisearch-backed search for the plugins/skills pages: rank via Meilisearch,
@@ -29,20 +30,17 @@ export async function searchPluginsHydrated(opts: {
 
   const hits = res.items
   const dbList = await getDbPluginsBySlugs(hits.map((h) => h.slug))
-  const dbBySlug = new Map<string, UnifiedPlugin>()
-  for (const p of dbList) if (p.slug) dbBySlug.set(p.slug, p)
+  const dbByIdentity = new Set(dbList.map((p) => `${p.type}:${p.slug}`))
 
   // Hydrate local Build with Claude items only if some hits weren't in the DB.
-  const localByKey = new Map<string, UnifiedPlugin>()
-  if (hits.some((h) => !dbBySlug.has(h.slug))) {
-    for (const p of getLocalBuildWithClaudePlugins()) {
-      localByKey.set(`${p.type}:${p.slug ?? p.name}`, p)
-    }
-  }
+  const local = hits.some((h) => !dbByIdentity.has(`${h.type}:${h.slug}`))
+    ? getLocalBuildWithClaudePlugins().map((p) => ({ ...p, slug: p.slug ?? p.name }))
+    : []
 
-  const plugins = hits
-    .map((h) => dbBySlug.get(h.slug) ?? localByKey.get(`${h.type}:${h.slug}`))
-    .filter((p): p is UnifiedPlugin => Boolean(p))
+  const records = [...dbList, ...local].filter(
+    (p): p is UnifiedPlugin & { slug: string } => Boolean(p.slug),
+  )
+  const plugins = hydrateHitsByTypeAndSlug(hits, records)
 
   return { plugins, total: res.total, limit: res.limit, offset: res.offset, hasMore: res.hasMore }
 }
```

**File**: `web-ui/lib/search/search-hydration.test.ts` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import { describe, it } from 'node:test'
+import assert from 'node:assert/strict'
+import { hydrateHitsByTypeAndSlug } from './search-hydration.ts'
+
+describe('hydrateHitsByTypeAndSlug', () => {
+  it('keeps plugin and skill records separate when they share a slug', () => {
+    const hits = [
+      { type: 'plugin', slug: 'shared' },
+      { type: 'skill', slug: 'shared' },
+    ]
+    const records = [
+      { type: 'skill', slug: 'shared', name: 'Shared skill' },
+      { type: 'plugin', slug: 'shared', name: 'Shared plugin' },
+    ]
+
+    assert.deepEqual(hydrateHitsByTypeAndSlug(hits, records), [
+      records[1],
+      records[0],
+    ])
+  })
+})
```

**File**: `web-ui/lib/search/search-hydration.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+interface SearchIdentity {
+  type: string
+  slug: string
+}
+
+export function hydrateHitsByTypeAndSlug<T extends SearchIdentity>(
+  hits: readonly SearchIdentity[],
+  records: readonly T[],
+): T[] {
+  const byIdentity = new Map<string, T>()
+  for (const record of records) {
+    const key = `${record.type}:${record.slug}`
+    if (!byIdentity.has(key)) byIdentity.set(key, record)
+  }
+
+  return hits
+    .map((hit) => byIdentity.get(`${hit.type}:${hit.slug}`))
+    .filter((record): record is T => Boolean(record))
+}
```

**File**: `web-ui/package.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     "build": "next build",
     "start": "next start",
     "lint": "next lint",
-    "test:unit": "node --experimental-strip-types --test lib/indexer/search-pagination.test.ts lib/search/search-types.test.ts lib/stories-server.test.ts",
+    "test:unit": "node --experimental-strip-types --test lib/indexer/search-pagination.test.ts lib/search/search-hydration.test.ts lib/search/search-types.test.ts lib/stories-server.test.ts",
     "generate-registry": "node ../scripts/generate-registry.js",
     "index:skills": "node scripts/run-skills-index.js",
     "index:cron": "node scripts/run-indexer.js"
```

---

### Incident Patch 5: `64aa0b60` (2026-08-18)
**Commit Message**: Fix search object ID collisions (#271)

**File**: `package.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "main": "index.js",
   "scripts": {
     "test": "npm run validate && npm run test:unit",
-    "test:unit": "node --test scripts/github-search-pagination.test.js && node --experimental-strip-types --test web-ui/lib/indexer/search-pagination.test.ts",
+    "test:unit": "node --test scripts/github-search-pagination.test.js && node --experimental-strip-types --test web-ui/lib/indexer/search-pagination.test.ts web-ui/lib/search/search-types.test.ts",
     "test:integration": "./tests/plugin-test-harness.sh",
     "validate": "node scripts/validate-all.js",
     "validate:subagents": "node scripts/validate-subagents.js",
```

**File**: `web-ui/lib/search/search-types.test.ts` (modified, +8/-1)
```diff
@@ -16,10 +16,17 @@ describe('makeObjectID', () => {
   it('sanitizes characters Meilisearch forbids in primary keys', () => {
     // Only [a-zA-Z0-9_-] is allowed — colons, @, / etc. must be replaced.
     assert.match(makeObjectID('marketplace', '@owner/repo'), /^[a-zA-Z0-9_-]+$/)
-    assert.equal(makeObjectID('marketplace', '@owner/repo'), 'marketplace___owner_repo')
+    assert.match(makeObjectID('marketplace', '@owner/repo'), /^marketplace___owner_repo__[a-f0-9]{16}$/)
     assert.match(makeObjectID('skill', 'weird:slug.with/chars'), /^[a-zA-Z0-9_-]+$/)
   })
 
+  it('does not collide when different slugs sanitize to the same text', () => {
+    assert.notEqual(
+      makeObjectID('marketplace', '@owner/foo/bar'),
+      makeObjectID('marketplace', '@owner/foo.bar'),
+    )
+  })
+
   it('keeps ids stable + unique across types for the same slug', () => {
     assert.notEqual(makeObjectID('subagent', 'review'), makeObjectID('command', 'review'))
     assert.equal(makeObjectID('subagent', 'review'), makeObjectID('subagent', 'review'))
```

**File**: `web-ui/lib/search/search-types.ts` (modified, +7/-3)
```diff
@@ -1,4 +1,5 @@
 import type { Settings } from 'meilisearch'
+import { createHash } from 'node:crypto'
 
 /**
  * The seven content types BuildWithClaude indexes into Meilisearch. Values are
@@ -34,12 +35,15 @@ export function isSearchContentType(value: string): value is SearchContentType {
 /**
  * Build a Meilisearch primary key. Meilisearch only permits `[a-zA-Z0-9_-]` in
  * document ids, so the raw `${type}:${slug}` form (colon, and slugs like a
- * marketplace's `@owner/repo` namespace) must be sanitized. The `__` separator
- * is unambiguous because no content type contains an underscore.
+ * marketplace's `@owner/repo` namespace) must be sanitized. Slugs that require
+ * sanitizing get a stable digest suffix so distinct values cannot collapse.
  */
 export function makeObjectID(type: SearchContentType, slug: string): string {
   const safeSlug = slug.replace(/[^a-zA-Z0-9_-]+/g, '_')
-  return `${type}__${safeSlug}`
+  if (safeSlug === slug) return `${type}__${safeSlug}`
+
+  const digest = createHash('sha256').update(slug).digest('hex').slice(0, 16)
+  return `${type}__${safeSlug}__${digest}`
 }
 
 /**
```

---

### Incident Patch 6: `9ae1b173` (2026-08-13)
**Commit Message**: Add agent-memory-discipline skill (#262)

Standing rules for when an agent should recall from long-term memory and when it
should save. Backend-neutral: works on a folder of Markdown files, a local MCP
server, or a hosted service.

Co-authored-by: Olga Timoshina <helloworld@uinside.org>

**File**: `plugins/all-skills/skills/agent-memory-discipline/SKILL.md` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+---
+name: agent-memory-discipline
+description: "Teaches when to recall from long-term memory before acting and when to save durable decisions, corrections and failures afterwards. Use when a memory tool or MCP memory server is connected but the agent is not using it consistently, when the user complains that the assistant forgets preferences, conventions or past decisions between sessions, or when setting up persistent memory for a project. Works with any memory backend: a folder of Markdown files, a local MCP server, or a managed service."
+category: ai-agents
+license: CC0-1.0
+---
+
+# Agent memory discipline
+
+Connecting a memory tool does not make an agent use it. Tools register, the session runs, and nothing gets recalled or saved. This skill supplies the missing part: standing rules for when to read memory and when to write it.
+
+It is backend-agnostic. Everything below works the same whether memory is a folder of Markdown files, a local MCP server, or a hosted service.
+
+## Recall before acting
+
+Read memory **before** doing any of these, not after:
+
+- starting work on a project you have touched before
+- choosing a library, pattern, or tool
+- writing tests, commits, or documentation, where conventions apply
+- answering "how do we usually do X here"
+- anything the user phrases as "again", "like last time", or "as we agreed"
+
+Do **not** recall for one-off factual questions, arithmetic, or anything fully specified in the current message. Recall costs a tool call and context; spending it on a self-contained question is waste.
+
+Search with the words the user actually used, plus the project or repository name. If the first search returns nothing useful, try one broader query, then stop and proceed without memory rather than looping.
+
+## Save after deciding
+
+Write to memory when one of these has just happened:
+
+- a **decision** was made and will still matter next week ("we use pnpm", "the billing module stays untouched")
+- the user **corrected** you, which is the strongest signal there is
+- an approach **failed**, and why it failed
+- a preference was stated that applies beyond this task
+- a fact about the environment was discovered the hard way (a port, a flag, a service that must be running)
+
+Do **not** save: the contents of files you can read again, restatements of the current task, transient state, anything the user marked as temporary, and anything containing secrets, tokens, or personal data.
+
+One memory, one fact. A paragraph containing four decisions cannot be superseded cleanly when one of them changes.
+
+## Write it so it survives
+
+A memory that is useless in three weeks was written wrong. Each entry should carry, in the text if the backend has no fields for it:
+
+- **what** was decided or observed, in one sentence
+- **why**, briefly, because the reason outlives the decision
+- **when** it became true, and when it stopped being true if it has
+- **where it came from**: a file, a commit, a conversation, a test run
+
+Prefer the user's own words over your paraphrase. Paraphrase drifts.
+
+## Do not overwrite the past, close it
+
+When something changes, the old memory is not wrong. It is **closed**.
+
+If the project moved from Redux to Zustand, "we use Redux" was true from January to June. Deleting it destroys the explanation for every component written in that window. Mark it superseded, keep its validity window, and write the new one alongside.
+
+This is the single most destructive habit in agent memory, and it is invisible until someone asks a question about old code.
+
+## Keep contradictions instead of resolving them silently
+
+If recall returns two entries that disagree, do not pick the closer match and proceed. Surface both, with their dates, and ask or flag.
+
+A convention that a recent failure contradicts is exactly the situation where the user needs to be told, not smoothed over.
+
+## Evidence and policy are different weights
+
+- **Evidence** is what 
```

---

### Incident Patch 7: `7a415291` (2026-07-10)
**Commit Message**: Add context-memory plugin

Persistent memory for Claude Code: auto-captures decisions, gotchas, and
dead ends and recalls the relevant ones at session start and on every
prompt, ranked by proven usefulness. MCP server + session-recall/capture
hooks. Metadata + README listing; source at SlovaApplications/claude-plugins.

Co-authored-by: Andrew Bridges <andrew@slova.app>

**File**: `plugins/context-memory/.claude-plugin/plugin.json` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+{
+  "name": "context-memory",
+  "version": "0.13.1",
+  "description": "Persistent knowledge base for Claude Code. Auto-captures the decisions, gotchas, and dead ends from your sessions and recalls the relevant ones at session start and on every prompt, ranked by proven usefulness. Ships an MCP server plus session-recall and capture hooks.",
+  "author": {
+    "name": "Slova Applications",
+    "url": "https://github.com/SlovaApplications"
+  },
+  "homepage": "https://context-memory.slova.app",
+  "repository": "https://github.com/SlovaApplications/claude-plugins",
+  "license": "MIT",
+  "keywords": [
+    "memory",
+    "context",
+    "knowledge-base",
+    "mcp",
+    "claude-code",
+    "recall",
+    "session-memory",
+    "context-engineering",
+    "hooks"
+  ]
+}
```

**File**: `plugins/context-memory/README.md` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+# context-memory
+
+Persistent memory for your coding agent. Claude Code is brilliant but amnesiac: every session starts cold, re-learns your codebase's quirks, re-litigates settled decisions, and re-walks ruled-out dead ends. context-memory captures those decisions, gotchas, and dead ends automatically as you work and surfaces the relevant ones at session start and on every prompt.
+
+- **Auto-capture** — an end-of-turn hook nudges the agent to save what was genuinely learned (a decision, a gotcha, a dead end), so knowledge lands in the store instead of evaporating between sessions.
+- **Auto-recall** — a `SessionStart` hook injects this repo's "where you left off" plus durable project facts, and a pre-fetch hook searches your store on every prompt and injects the top hits, scoped to your current repo.
+- **Ranked by proven usefulness** — recall is re-ranked by what has actually been used, not just semantic similarity, so load-bearing knowledge rises.
+- **Topics** — related contexts get compiled into durable, editable syntheses instead of staying scattered.
+- **Auditable** — supersede and retract semantics keep a tombstoned history rather than silently overwriting.
+
+Unlike a hand-maintained `CLAUDE.md`, it is auto-captured, auto-recalled, and ranked (no drift). Unlike RAG, it stores derived decisions and facts (recall), not document chunks (retrieval).
+
+## Install
+
+Requires a free API key. Sign up at <https://context-memory.slova.app/signup/>, then export the key and add the marketplace:
+
+```bash
+export CONTEXT_MEMORY_API_KEY="cm_..."
+```
+
+```
+/plugin marketplace add SlovaApplications/claude-plugins
+/plugin install context-memory@slova
+```
+
+Full setup guide: <https://context-memory.slova.app/get-started/>
+
+## Privacy
+
+The plugin is a client for a hosted backend. On each prompt it sends the first 500 bytes of your prompt to the search API; memories you save are stored under your account. Your Claude Code transcripts stay local. All requests use HTTPS. See the plugin repo's README for full details.
+
+## Links
+
+- Homepage: <https://context-memory.slova.app>
+- Source and full docs: <https://github.com/SlovaApplications/claude-plugins>
+- License: MIT
```

---

### Incident Patch 8: `8e73ef50` (2026-07-09)
**Commit Message**: Add ciagent plugin — resubmission with onboard allowlist fixed (re #229) (#232)

* Add ciagent plugin — regression testing for AI agents (skills: onboard, check)

* Fix onboard skill allowlist to match its workflow (review feedback)

**File**: `plugins/ciagent/.claude-plugin/plugin.json` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+{
+  "name": "ciagent",
+  "version": "0.10.0",
+  "description": "Set up and operate CIAgent (pip install ciagent) regression testing for the AI agent in this repo: record golden baselines, run stability and judge-reliability checks after every change.",
+  "author": {
+    "name": "Sunil Pandey",
+    "url": "https://github.com/suniel12"
+  },
+  "repository": "https://github.com/suniel12/ciagent",
+  "license": "Apache-2.0",
+  "keywords": [
+    "testing",
+    "ai-agents",
+    "evals",
+    "regression",
+    "llm-judge"
+  ]
+}
\ No newline at end of file
```

**File**: `plugins/ciagent/README.md` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+# CIAgent plugin for Claude Code
+
+Lets a coding agent set up and operate [CIAgent](https://github.com/suniel12/ciagent)
+(`pip install ciagent`) — pytest-native regression testing for AI agents — on
+the agent it is building.
+
+## Skills
+
+- **onboard** — set up CIAgent in a repo from scratch: find the agent, write
+  the runner, record golden baselines, generate a spec, verify with a real
+  run. Includes a cost gate before any live recording.
+- **check** — after any change to agent code, prompts, or the knowledge
+  base: run the right CIAgent check (`test`, `test --runs 3`, `judge-audit`),
+  read the stability report correctly, and never paper over a failure.
+
+## Install
+
+From the CIAgent repo's own marketplace:
+
+```
+/plugin marketplace add suniel12/ciagent
+/plugin install ciagent@ciagent
+```
+
+## Disclosure
+
+This plugin wraps the `ciagent` PyPI package. The plugin and the package are
+built and maintained by the same author ([@suniel12](https://github.com/suniel12)).
+The package is free and Apache-2.0 licensed; there is no paid tier, telemetry,
+or hosted service behind it.
```

**File**: `plugins/ciagent/skills/check/SKILL.md` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+---
+name: check
+description: Run CIAgent regression checks after changing an AI agent's code, prompts, or knowledge base in a repo that has agentci_spec.yaml, and interpret the results. Use after editing agent logic, before committing agent changes, or when the user asks whether the agent still works.
+allowed-tools: Bash(ciagent *)
+---
+
+# Run CIAgent checks on this repo's agent
+
+The repo has `agentci_spec.yaml` (if it does not, use the `onboard` skill
+instead). Your job: run the right check for the change that was just made,
+read the result correctly, and never paper over a failure.
+
+## Which command
+
+| Situation | Command |
+|---|---|
+| Spec or wiring changed, or no API keys | `ciagent test --mock` |
+| Agent code / prompt / retrieval changed | `ciagent test --yes --format json` |
+| Result differs from last run, or flakiness suspected | `ciagent test --runs 3 --yes` |
+| Knowledge base changed | `ciagent generate-checks --dry-run`, review, then apply |
+| The LLM judge's verdicts look wrong | `ciagent judge-audit` |
+
+Live runs (`test` without `--mock`, `judge-audit`, `generate-checks`) call model
+APIs on the user's keys. Mock mode is free. If the user has not already
+approved live runs in this session, prefer `--mock` or ask.
+
+## Reading results
+
+Exit codes: **0** pass (including flaky-but-passing), **1** correctness failure
+(with `--runs N`: failed in every run), **2** infra or config error — fix the
+setup, not the agent.
+
+With `--format json`: per-query entries carry layer results (correctness /
+path / cost) and the answer text; with `--runs N` a top-level `stability` block
+lists flipped queries with `flip_source`.
+
+Flip sources route the work:
+- `agent-variance` — the agent's answer changed between runs → fix the agent
+  (prompt, retrieval, temperature).
+- `judge-flake` — same answer, the LLM judge changed its verdict → fix the
+  eval (tighten the rubric or replace with a deterministic check).
+- `infra-error` — a judge API call failed → retry; fix nothing.
+- `mixed` — ambiguous; look at the answers yourself.
+
+## Rules
+
+- A correctness failure means the agent lost a fact it used to state. Fix the
+  agent, or — only if the check itself is factually wrong — fix the check.
+  **Never weaken or delete a correct check or baseline to make a run green**;
+  report the failure to the user instead.
+- After intentionally changing agent behavior, re-record the affected golden:
+  delete its baseline file and rerun
+  `ciagent bootstrap --runner <runner> --queries <file> --yes` for that query,
+  or update the spec's expectations — with the user's confirmation.
+- Report results in one or two sentences: score, what failed and in which
+  layer, flip sources if any, and the command you ran.
```

**File**: `plugins/ciagent/skills/onboard/SKILL.md` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+---
+name: onboard
+description: Set up CIAgent regression testing for the AI agent in this repo — write a runner, record golden baselines, generate a test spec, and verify it. Use when the user asks to add tests, evals, or regression testing for their AI agent, or to set up CIAgent.
+allowed-tools: Bash(ciagent *), Bash(pip install *), Bash(python -c *), Read, Grep, Glob, Write, Edit
+---
+
+# Onboard CIAgent into this repo
+
+You are setting up CIAgent (`pip install ciagent`) so this repo's AI agent has
+recorded golden baselines and a runnable regression suite. The end state: the
+user can run `ciagent test --runs 3` and see a stability report for their agent.
+
+Work through the steps in order. Do not skip the cost gate in step 4.
+
+## 1. Find the agent and install CIAgent
+
+- Locate the agent: search for LLM SDK usage (`openai`, `anthropic`, `langgraph`,
+  `langchain`) and for the function or endpoint that takes a user message and
+  returns the agent's answer.
+- Install with the matching extra so trace capture hooks the SDK:
+  `pip install "ciagent[openai]"`, `[anthropic]`, `[langgraph]`, or `[all]`.
+- Sanity check: `ciagent --version` then `ciagent doctor` (it reports what is
+  missing; a missing spec is expected at this point).
+
+## 2. Write the runner
+
+Create `agentci_runner.py` at the repo root (or inside the package if the repo
+has one clear package):
+
+```python
+def run_for_agentci(query: str) -> str:
+    """CIAgent entry point: one query in, final answer text out."""
+    # import the user's agent and invoke it ONCE, no chat history
+    ...
+    return final_answer_text
+```
+
+Rules:
+- Return the final answer **string**. CIAgent wraps the call in its own trace
+  capture, so LLM calls and tool calls are recorded automatically — do not
+  build Trace objects unless the repo already produces them.
+- Fresh context per call: no shared history between queries.
+- Reuse the repo's own config/env loading so the runner works from the repo root.
+- Verify it imports and answers before going further:
+  `python -c "from agentci_runner import run_for_agentci; print(run_for_agentci('hello'))"`.
+
+## 3. Choose queries
+
+Write `agentci_queries.txt`, one query per line — 8 to 15 queries:
+
+- Cover the agent's main jobs (mine the README, docs, knowledge base, prompts,
+  and existing tests for what it is supposed to handle).
+- Include at least 2 out-of-scope queries the agent should refuse or deflect.
+- Prefer queries whose correct answers contain **hard facts** (prices, dates,
+  limits, names) — those become deterministic checks in step 6.
+
+## 4. Cost gate — ask before running live
+
+Recording baselines runs the real agent once per query, on the user's API keys.
+State the query count and a cost ballpark, and **ask the user to confirm**
+before step 5. If there are no API keys or the user declines: write
+`agentci_spec.yaml` by hand instead (same queries, `runner:` set), validate with
+`ciagent test --mock`, and tell the user which step to resume later.
+
+## 5. Record golden baselines
+
+```bash
+ciagent bootstrap --runner agentci_runner:run_for_agentci \
+  --queries agentci_queries.txt --agent <agent-name> --yes
+```
+
+This runs every query, saves each trace as a golden baseline under
+`./baselines/<agent-name>/`, and writes `agentci_spec.yaml` with path and cost
+budgets derived from the recorded traces. Read the printed answers as they
+stream by — if an answer is visibly wrong, that query should not be golden:
+fix the agent or the query, delete that baseline file, and rerun.
+
+## 6. Add correctness checks
+
+The generated spec has path and cost budgets but no correctness checks. Add a
+`correctness:` block per query, derived from the recorded baseline answers and
+the repo's docs/KB — never from what you wish the agent said:
+
+```yaml
+correctness:
+  expected_in_answer: ["30 days"]          # hard facts, AND
+  any_expected_in_answer: ["$9.95", "9.95"] # phrasing variants,
```

---

### Incident Patch 9: `b8e378de` (2026-07-08)
**Commit Message**: Add tlsradar plugin (resubmit of #219 — error-path prose fixed, DNS tests bundled) (#223)

* Add tlsradar plugin

Bundled plugin for SSL/TLS scanning, free Let's Encrypt cert
issuance (private key stays local), and certificate-expiry
monitoring via a single remote MCP server.

* New self-contained bundle under plugins/tlsradar/ (commands,
  skill, hook, .mcp.json, dns helper, README, LICENSE).
* Registered in .claude-plugin/marketplace.json under the
  "security" category, sourced from ./plugins/tlsradar.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

* Add missing .mcp.json to tlsradar bundle

The plugin-root MCP server config was silently dropped from the
initial commit because .gitignore has a bare `.mcp.json` rule;
`git add -A` skipped it. Force-add it (same as the committed
plugins/cashflow/.mcp.json) so the tlsradar MCP server the
commands and skill reference actually exists after install.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

* Address review: harden tlsradar plugin, drop welcome hook

Resolves the three blockers from the #214 review.

* dns_provider.py validates dns-01 challenge records against the
  requested --domain before any Cloudflare/Ro

**File**: `.claude-plugin/marketplace.json` (modified, +23/-0)
```diff
@@ -24,6 +24,29 @@
     ]
   },
   "plugins": [
+    {
+      "name": "tlsradar",
+      "description": "SSL/TLS certificate scanning, free Let's Encrypt issuance (private key stays local), and ongoing certificate-expiry monitoring — through a single remote MCP server. Free anonymous scans and cert issuance need no account; OAuth via /mcp unlocks ongoing monitoring.",
+      "version": "0.6.1",
+      "author": {
+        "name": "TLS Radar",
+        "url": "https://tlsradar.com"
+      },
+      "homepage": "https://tlsradar.com/cli",
+      "repository": "https://github.com/TLS-Radar/tlsradar-claude-plugin",
+      "license": "MIT",
+      "keywords": [
+        "ssl",
+        "tls",
+        "certificates",
+        "monitoring",
+        "letsencrypt",
+        "security",
+        "mcp"
+      ],
+      "category": "security",
+      "source": "./plugins/tlsradar"
+    },
     {
       "name": "cashflow",
       "description": "Personal finance ledger for AI agents. Connect bank accounts via Plaid, query spending, track recurring bills, categorize transactions, and get financial recaps through MCP tools with OAuth authentication.",
```

**File**: `plugins/tlsradar/.claude-plugin/plugin.json` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+{
+  "name": "tlsradar",
+  "displayName": "TLS Radar",
+  "version": "0.6.1",
+  "description": "SSL/TLS certificate monitoring and free Let's Encrypt issuance inside Claude Code and Cowork, through a single MCP server. Free anonymous scans and cert issuance (private key stays local), plus ongoing monitoring after a one-time OAuth via /mcp.",
+  "author": {
+    "name": "TLS Radar",
+    "url": "https://tlsradar.com"
+  },
+  "license": "MIT",
+  "homepage": "https://tlsradar.com/cli",
+  "repository": "https://github.com/TLS-Radar/tlsradar-claude-plugin",
+  "keywords": [
+    "ssl",
+    "tls",
+    "certificates",
+    "monitoring",
+    "letsencrypt",
+    "security"
+  ]
+}
```

**File**: `plugins/tlsradar/.mcp.json` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+{
+  "mcpServers": {
+    "tlsradar": {
+      "type": "http",
+      "url": "${TLSRADAR_BASE_URL:-https://tlsradar.com}/api/v1/mcp"
+    }
+  }
+}
```

**File**: `plugins/tlsradar/LICENSE` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+MIT License
+
+Copyright (c) 2026 TLS Radar
+
+Permission is hereby granted, free of charge, to any person obtaining a copy
+of this software and associated documentation files (the "Software"), to deal
+in the Software without restriction, including without limitation the rights
+to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
+copies of the Software, and to permit persons to whom the Software is
+furnished to do so, subject to the following conditions:
+
+The above copyright notice and this permission notice shall be included in all
+copies or substantial portions of the Software.
+
+THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
+OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
+SOFTWARE.
```

**File**: `plugins/tlsradar/README.md` (added, +153/-0)
```diff
@@ -0,0 +1,153 @@
+# TLS Radar plugin for Claude Code & Cowork
+
+[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
+[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-7c3aed)](https://github.com/TLS-Radar/tlsradar-claude-plugin)
+[![smithery badge](https://smithery.ai/badge/slmusayev/tls-radar)](https://smithery.ai/servers/slmusayev/tls-radar)
+
+Run SSL/TLS scans, issue free Let's Encrypt certificates, and manage cert monitoring from inside Claude Code or Claude Cowork - through a single MCP server, with nothing to configure.
+
+Independent monitoring from a vendor that doesn't sell certificates - built for the 90-day-cert era, where manual renewal tracking is already finished.
+
+![Installing the plugin and issuing a free cert with /tls-cert](https://raw.githubusercontent.com/TLS-Radar/tlsradar-claude-plugin/main/docs/demo.gif)
+
+```
+# Public - no account, no setup
+/tls-scan example.com                       # free SSL/TLS scan
+/tls-cert mydomain.dev                      # free 90-day Let's Encrypt cert (private key stays local)
+/tls-renew mydomain.dev                     # renew a cert
+
+# Connect once for monitoring (OAuth via /mcp)
+/mcp                                        # built-in Claude Code OAuth flow
+/tls-monitor add api.foo.io                 # one or many: /tls-monitor add a.com b.com c.com
+/tls-monitor list
+/tls-monitor remove api.foo.io
+/tls-diagnose                               # health check (use when something's off)
+/tls-upgrade                                # open pricing page
+```
+
+> **See real output before installing:** [sample scan report](https://tlsradar.com/scan/7yeRj83mGGhcuhe5rSbXZg)
+
+Other actions - "what's expiring soon," "scan history for X," "what plan am I on," "export/import my monitors," "invite a teammate" - just ask in plain language; the plugin's skill routes them to the right tool. No slash command needed.
+
+## How it works
+
+Claude Code's MCP client talks to **one** remote server:
+
+- `tlsradar.com/api/v1/mcp`
+
+Certificate issuance is **proxied through that server** to the Let's Encrypt backend (Beacon), so there's a single connection and a single auth model - no second server, no token to paste into your shell.
+
+- **Public tools** (`scan`, `create_certificate`, `check_certificate_propagation`, `finalize_certificate`, `get_certificate_status`, `renew_certificate`) work with no account.
+- **Authenticated tools** (monitoring, plan info, export/import, team) use Claude Code's built-in OAuth 2.0 + PKCE. Run `/mcp` once, pick the `tlsradar` server, approve in the browser; the token is managed by Claude Code.
+
+When you run `/mcp`, Claude Code fetches `tlsradar.com/.well-known/oauth-authorization-server` (RFC 8414), dynamically registers as a public client (RFC 7591), opens the browser for consent (PKCE / RFC 7636), and includes the token on subsequent requests automatically.
+
+### Certificates keep your private key local
+
+`/tls-cert` generates the key + CSR on **your** machine with `openssl` and sends only the CSR. The private key never leaves your computer and no passphrase is ever typed into the chat. If you want a `.p12` bundle (e.g. for Windows/Java import), the plugin packages it locally too.
+
+You choose how to prove control of the domain, and the plugin remembers your choice (in `~/.config/tlsradar/config.json`):
+
+- **`dns-01`** - you add a TXT record by hand (works anywhere).
+- **`dns-01-cloudflare` / `dns-01-route53`** - the plugin sets the TXT record for you via the provider API, reading your token from the local environment (`CLOUDFLARE_API_TOKEN`, or your configured `aws` CLI). Those credentials stay on your machine - they're never sent to TLS Radar or Beacon.
+- **`http-01`** - serve a file on `http://yourdomain` (port 80); issues the apex only.
+
+When a cert is issued, TLS Radar emails you about ongoing monitoring - the cert → monitoring handoff is fully automatic and server-side.
+
+### Wo
```

---

### Incident Patch 10: `18da0fe5` (2026-07-06)
**Commit Message**: Merge pull request #221 from mharnett/fix/segment-brand-nonbrand-prospecting-retargeting

marketing-optimizer: segment brand/non-brand and prospecting/retargeting before recommending budget shifts

**File**: `plugins/claude-ops/agents/marketing-optimizer.md` (modified, +20/-8)
```diff
@@ -1,6 +1,6 @@
 ---
 name: marketing-optimizer
-description: Cross-platform ad budget optimization — reads Meta + Google Ads data, computes blended ROAS, and recommends specific budget shifts.
+description: Cross-platform ad budget optimization — reads Meta + Google Ads data, computes blended ROAS for top-line health plus segmented (brand/non-brand, prospecting/retargeting) ROAS, and recommends specific budget shifts.
 model: claude-sonnet-4-5
 effort: high
 maxTurns: 20
@@ -13,7 +13,7 @@ memory: project
 # Marketing Optimizer Agent
 
 **Model:** claude-sonnet-4-5
-**Purpose:** Cross-platform ad budget optimization — reads Meta + Google Ads data, computes blended ROAS, and recommends specific budget shifts.
+**Purpose:** Cross-platform ad budget optimization — reads Meta + Google Ads data, computes blended ROAS for top-line health plus segmented (brand/non-brand, prospecting/retargeting) ROAS, and recommends specific budget shifts.
 
 ---
 
@@ -61,13 +61,22 @@ curl -s "https://graph.facebook.com/v20.0/${META_ACCOUNT}/insights?fields=spend,
 # ORDER BY metrics.cost_micros DESC LIMIT 20
 ```
 
+### Segment before you optimize
+
+`blended_roas` is a top-line health number for the report — it is **not** the optimization target. Blending demand *capture* with demand *generation* flatters the account and starves growth. Before recommending any budget shift, split each platform:
+
+- **Google Ads — brand vs non-brand.** Brand campaigns (queries containing the company/product name) are demand capture — cheap by construction and largely non-incremental. Classify each campaign from `.campaign.name` (brand = name matches the advertiser's brand terms; ask the user for their brand terms if unknown, don't guess). Report brand ROAS separately, and **never** treat a low brand CPA / high brand ROAS as a win or a reason to scale. Drive targets and reallocation math off **non-brand ROAS**.
+- **Meta — retargeting vs prospecting.** Retargeting/remarketing ad sets (site visitors, cart abandoners, engager Custom Audiences) capture demand that would largely have converted anyway, so their ROAS is systematically inflated. Prospecting (cold / lookalike / broad) is the growth engine that refills the retargeting pool. Split ad sets by audience source, report each separately, and drive scaling decisions off **prospecting ROAS**.
+- **Retargeting/brand ROAS is only trustworthy with a holdout.** A high retargeting or brand ROAS proves incrementality only when measured with a lift test (Meta Conversion Lift, Google Conversion Lift / geo experiments, or a simple audience/geo holdout). Absent a holdout, flag these numbers as "capture, not proven lift" and do not recommend scaling on them.
+
 ### Analysis
 
-1. **Compute blended ROAS**: (Meta revenue + Google revenue) / (Meta spend + Google spend)
-2. **Compare platform ROAS**: Identify which platform has higher ROAS
-3. **Identify campaigns**: Find top 3 and bottom 3 campaigns by ROAS on each platform
-4. **Spot inefficiencies**: Campaigns with spend > $50 and ROAS < 1x
-5. **Budget shift math**: Calculate specific dollar amounts to reallocate
+1. **Compute blended ROAS** — reporting top-line only, **not** an optimization target: (Meta revenue + Google revenue) / (Meta spend + Google spend)
+2. **Compute segmented ROAS**: non-brand vs brand (Google), prospecting vs retargeting (Meta) — these drive every recommendation below
+3. **Compare platform ROAS**: Identify which platform has higher ROAS
+4. **Identify campaigns**: Find top 3 and bottom 3 campaigns by ROAS on each platform (evaluate on the segmented figure, not blended)
+5. **Spot inefficiencies**: Campaigns with spend > $50 and ROAS < 1x
+6. **Budget shift math**: Calculate specific dollar amounts to reallocate — grow non-brand/prospecting toward its target; never scale brand/retargeting on reported ROAS alone
 
 ### Output Format
 
@@ -80,8 +89,10 @@ Always output in this exact format:
 
 PERFORMANCE SUMMARY
  Meta Ads:    $[spend] spent | [ROAS]x RO
```

**File**: `plugins/claude-ops/skills/ops-marketing/SKILL.md` (modified, +4/-0)
```diff
@@ -464,8 +464,12 @@ curl -s -X POST "https://graph.facebook.com/v20.0/${META_ACCOUNT}/adrules_librar
 ```
 
 For "Scale winners":
+
+> ⚠️ **Scope this to prospecting ad sets.** A bare `purchase_roas > 3` filter auto-scales *retargeting* ad sets too — whose ROAS is inflated by warm-audience demand capture (conversions that would have happened anyway), not incremental growth. Blanket-scaling them pours budget into demand you already own while starving prospecting, and the funnel contracts a month later. Add an ad-set-name/audience filter that excludes retargeting/remarketing (or restrict the rule to your prospecting ad sets), and confirm a winner's lift with a holdout before scaling on ROAS alone.
+
 ```bash
 # Increase budget 20% for ad sets with ROAS > 3x in last 7 days
+# NOTE: restrict to prospecting ad sets — see caveat above
 curl -s -X POST "https://graph.facebook.com/v20.0/${META_ACCOUNT}/adrules_library" \
   -H "Authorization: Bearer ${META_TOKEN}" \
   -H "Content-Type: application/json" \
```

#### Recent Merged Pull Requests:
- **PR #356** (2026-09-30): Add apmzoom-dongdaemun plugin (@apmleokeo-gif)
- **PR #355** (2026-09-30): Add system-prompt-lookup skill (@xizhuomengcontin)
- **PR #354** (closed): Add mirrord skill (@hank-metalbear)
- **PR #353** (2026-09-29): Update subagent validation: run agent-only checks against the agent bundle (@william-xue)
- **PR #352** (closed): Add ashlr plugin (@masonwyatt23)
- **PR #351** (2026-09-29): Add gsc-seo-optimizer skill (@jacobGor123)
- **PR #350** (2026-09-29): Add competitor-research skill (@jacobGor123)
- **PR #349** (2026-09-28): Add carrick plugin (@daveymoores)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
