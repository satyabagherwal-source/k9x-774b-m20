# Forensic Learning Record (Deep Inspection): oceanbase/powercontext

> **Canonical Artifact**: `07_PROJECT_LEARNING/oceanbase-powercontext-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oceanbase/powercontext](https://github.com/oceanbase/powercontext))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:20:45.738Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oceanbase/powercontext`
- **Description**: Not only memory but a full story.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1225 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e/bub/src/powercontext_e2e/rescore.py`
```
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Offline replay rescoring without an execution-adapter dependency."""

from __future__ import annotations

from pathlib import Path

from .artifacts import write_artifacts
from .evaluation import MemoryEvaluator
from .models import TaskObservation
from .settings import HarnessSettings


def rescore_replay(replay_path: Path, output_dir: Path, settings: HarnessSettings) -> bool:
    observation = TaskObservation.model_validate_json(replay_path.read_text(encoding="utf-8"))
    report = MemoryEvaluator.evaluate(observation, experiment=f"offline:{observation.task.id}")
    write_artifacts(observation, report, output_dir, settings=settings)
    return report.accepted

```

### Core Architecture Module: `evaluation/src/powercontext_eval/benchmarks/longmemeval_v2/prepare_worker.py`
```
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Pinned-harness worker that builds bounded LongMemEval-V2 Reader inputs."""

from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import sys
import time
from collections.abc import Iterator, Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol, cast

from powercontext_eval.benchmarks.longmemeval_v2.prepare_smoke import (
    PREPARE_FAILURE_SCHEMA,
    PREPARE_SUMMARY_SCHEMA,
    PREPARED_PROMPT_SCHEMA,
)


class HarnessPromptAPI(Protocol):
    def get_system_prompt(self, domain: str) -> str: ...

    def validate_memory_context_items(self, memory_context: Any, *, question_id: str) -> list[dict[str, str]]: ...

    def truncate_memory_context(
        self,
        memory_context: list[dict[str, str]],
        *,
        max_tokens: int,
        question_id: str,
    ) -> tuple[list[dict[str, str]], int, int]: ...

    def build_messages(
        self,
        *,
        system_prompt: str,
        question_text: str,
        image_path: str | None,
        memory_context: list[dict[str, str]],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]: ...


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare bounded LongMemEval-V2 Reader prompts.")
    parser.add_argument("--harness-root", type=Path, required=True)
    parser.add_argument("--input-path", type=Path, required=True)
    parser.add_argument("--prompts-path", type=Path, required=True)
    parser.add_argument("--failures-path", type=Path, required=True)
    parser.add_argument("--summary-path", type=Path, required=True)
    parser.add_argument("--processor-model", required=True)
    parser.add_argument("--processor-revision", required=True)
    parser.add_argument("--memory-context-max-tokens", type=int, required=True)
    args = parser.parse_args()
    if args.memory_context_max_tokens <= 0:
        raise SystemExit("memory_context_max_tokens must be positive")
    harness = _load_harness(args.harness_root, args.processor_model, args.processor_revision)
    _run(
        harness,
        input_path=args.input_path,
        prompts_path=args.prompts_path,
        failures_path=args.failures_path,
        summary_path=args.summary_path,
        processor_model=args.processor_model,
        processor_revision=args.processor_revision,
        memory_context_max_tokens=args.memory_context_max_tokens,
    )


def _load_harness(harness_root: Path, processor_model: str, processor_revision: str) -> HarnessPromptAPI:
    root = harness_root.resolve()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    harness = importlib.import_module("evaluation.harness")
    transformers = importlib.import_module("transformers")
    processor_class = transformers.AutoProcessor
    processor = processor_class.from_pretrained(processor_model, revision=processor_revision)
    harness.MEMORY_CONTEXT_PROCESSOR_LOCAL.processor = processor
    return cast(HarnessPromptAPI, harness)


def _run(
    harness: HarnessPromptAPI,
    *,
    input_path: Path,
    prompts_path: Path,
    failures_path: Path,
    summary_path: Path,
    processor_model: str,
    processor_revision: str,
    memory_context_max_tokens: int,
) -> None:
    started_ns = time.perf_counter_ns()
    succeeded = 0
    failed = 0
    original_tokens_total = 0
    prepared_tokens_total = 0
    _create_empty(prompts_path)
    _create_empty(failures_path)
    for sequence, result in enumerate(_jsonl(input_path), start=1):
        question_id = _nonblank(result.get("question_id"), "question_id")
        try:
            prepared = _prepare_record(
                harness,
                result,
                sequence=sequence,
                memory_context_max_tokens=memory_context_max_tokens,
            )
        except Exception as error:  # noqa: BLE001 - one malformed result must not hide later preparation failures
            failed += 1
            _append_json(
                failures_path,
                {
                    "schema": PREPARE_FAILURE_SCHEMA,
                    "question_id": question_id,
                    "phase": "prompt_prepare",
                    "error_type": type(error).__name__,
                    "summary": (str(error).strip() or type(error).__name__)[:500],
                },
            )
            continue
        _append_json(prompts_path, prepared)
        succeeded += 1
        original_tokens = prepared["memory_context_original_tokens"]
        prepared_tokens = prepared["memory_context_tokens"]
        if not isinstance(original_tokens, int) or not isinstance(prepared_tokens, int):
            raise TypeError("prepared prompt token counts must be integers")
        original_tokens_total += original_tokens
        prepared_tokens_total += prepared_tokens
    _write_json(
        summary_path,
        {
            "schema": PREPARE_SUMMARY_SCHEMA,
            "classification": "smoke-subset-prepare-only",
            "completed_at": datetime.now(UTC).isoformat(),
            "question_count": succeeded + failed,
            "succeeded": succeeded,
            "failed": failed,
            "memory_context_original_tokens": original_tokens_total,
            "memory_context_tokens": prepared_tokens_total,
            "memory_context_max_tokens": memory_context_max_tokens,
            "processor": {"model": processor_model, "revision": processor_revision},
            "reader": None,
            "judge": None,
            "elapsed_ms": round((time.perf_counter_ns() - started_ns) / 1_000_000, 3),
        },
    )
    if failed:
        raise SystemExit(1)


def _prepare_record(
    harness: HarnessPromptAPI,
    result: Mapping[str, object],
    *,
    sequence: int,
    memory_context_max_tokens: int,
) -> dict[str, object]:
    started_ns = time.perf_counter_ns()
    question_id = _nonblank(result.get("question_id"), "question_id")
    domain = _domain(result.get("domain"))
    question = result.get("question")
    if not isinstance(question, Mapping):
        raise TypeError("question must be an object")
    question_text = _nonblank(question.get("text"), "question.text")
    image_path = question.get("image")
    if image_path is not None and (not isinstance(image_path, str) or not image_path.strip()):
        raise ValueError("question.image must be null or a non-empty string")
    memory_context = harness.validate_memory_context_items(result.get("memory_context"), question_id=question_id)
    bounded_context, original_tokens, bounded_tokens = harness.truncate_memory_context(
        memory_context,
        max_tokens=memory_context_max_tokens,
        question_id=question_id,
    )
    system_prompt = harness.get_system_prompt(domain)
    messages, prompt_messages = harness.build_messages(
        system_prompt=system_prompt,
        question_text=question_text,
        image_path=image_path,
        memory_context=bounded_context,
    )
    return {
        "schema": PREPARED_PROMPT_SCHEMA,
        "sequence": sequence,
        "question_id": question_id,
        "domain": domain,
        "question": {"text": question_text, "image": image_path},
        "scope_id": result.get("scope_id"),
        "haystack_digest": result.get("haystack_digest"),
        "memory_context": bounded_context,
        "memory_context_original_tokens": original_tokens,
        "memory_context_tokens": bounded_tokens,
        "memory_context_max_tokens": memory_context_max_tokens,
        "memory_context_was_truncated": original_tokens > bounded_tokens,
        "memory_context_bytes": sum(len(item["value"].encode()) for item in bounded_context),
        "system_prompt": system_prompt,
        "messages": messages,
        "prompt_messages": prompt_messages,
        "prompt_sha256": _canonical_digest(messages),
        "prepare_latency_ms": round((time.perf_counter_ns() - started_ns) / 1_000_000, 3),
    }


def _jsonl(path: Path) -> Iterator[dict[str, object]]:
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"retrieval result {line_number} is not valid JSON") from error
            if not isinstance(value, dict):
                raise TypeError(f"retrieval result {line_number} is not an object")
            yield value


def _domain(value: object) -> str:
    if value not in {"web", "enterprise"}:
        raise ValueError("domain must be web or enterprise")
    return cast(str, value)


def _nonblank(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string")
    return value.strip()


def _canonical_digest(value: object) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def _create_empty(path: Path) -> None:
    with path.open("x", encoding="utf-8"):
        pass


def _append_json(path: Path, value: object) -> None:
    with path.open("a", encoding="utf-8", newline="") as stream:
        stream.write(json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")


def _write_json(path: Path, value: object) -> None:
    with path.open("x", encoding="utf-8", 
```

### Core Architecture Module: `evaluation/src/powercontext_eval/benchmarks/longmemeval_v2/replay_score.py`
```
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Replay deterministic LongMemEval-V2 scoring from saved Reader and Judge evidence."""

from __future__ import annotations

import hashlib
import importlib
import json
import sys
import time
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol, cast

from powercontext_eval.benchmarks.longmemeval_v2.catalog import validate_harness_checkout
from powercontext_eval.benchmarks.longmemeval_v2.score_smoke import LLM_JUDGE_NAMES, PER_QUESTION_SCHEMA
from powercontext_eval.errors import PowerContextEvalError

REPLAY_MANIFEST_SCHEMA = "powercontext.longmemeval-v2-score-replay.v1"
REPLAY_FAILURE_SCHEMA = "powercontext.longmemeval-v2-score-replay-failure.v1"
REPLAY_SUMMARY_SCHEMA = "powercontext.longmemeval-v2-score-replay-summary.v1"


class ReplayScoreError(PowerContextEvalError):
    """Saved scoring evidence cannot reproduce one deterministic score result."""


class MetricsAPI(Protocol):
    def eval_name(self, eval_spec: str) -> str: ...

    def eval_from_spec(self, spec: str, *args: Any, **kwargs: Any) -> Any: ...

    def score_to_bool(self, value: Any) -> bool: ...


@dataclass(frozen=True)
class ReplayScoreRun:
    output_dir: Path
    manifest_path: Path
    results_path: Path
    failures_path: Path
    summary_path: Path


def replay_score_smoke(*, score_dir: Path, harness_root: Path, output_dir: Path) -> ReplayScoreRun:
    """Replay all score decisions from local artifacts without a Reader or Judge call."""

    if output_dir.exists():
        raise ReplayScoreError(f"Refusing to overwrite score replay artifacts: {output_dir}")
    validate_harness_checkout(harness_root)
    manifest = _load_json(score_dir / "score-manifest.json", "score manifest")
    summary = _load_json(score_dir / "score-summary.json", "score summary")
    inputs_path = score_dir / "scoring-inputs.local.jsonl"
    judge_path = score_dir / "judge-outputs.jsonl"
    if not inputs_path.is_file() or not judge_path.is_file():
        raise ReplayScoreError("Score replay requires local scoring inputs and saved Judge outputs")
    if manifest.get("classification") != "smoke-subset-score-only" or summary.get("failed") != 0:
        raise ReplayScoreError("Score artifacts are not a successful smoke score run")
    metrics = _load_metrics(harness_root)
    judges = {row["question_id"]: row for row in _jsonl(judge_path, "judge output")}
    try:
        output_dir.mkdir(parents=True, exist_ok=False)
    except FileExistsError as error:
        raise ReplayScoreError(f"Refusing to overwrite score replay artifacts: {output_dir}") from error
    except OSError as error:
        raise ReplayScoreError(f"Cannot create score replay artifact directory: {output_dir}") from error

    manifest_path = output_dir / "replay-manifest.json"
    results_path = output_dir / "replay-per-question.jsonl"
    failures_path = output_dir / "replay-failures.jsonl"
    summary_path = output_dir / "replay-summary.json"
    _write_json_exclusive(
        manifest_path,
        {
            "schema": REPLAY_MANIFEST_SCHEMA,
            "classification": "smoke-subset-score-replay",
            "source_score": {
                "directory": str(score_dir.resolve()),
                "manifest_sha256": _file_digest(score_dir / "score-manifest.json"),
                "inputs_sha256": _file_digest(inputs_path),
                "judge_outputs_sha256": _file_digest(judge_path),
                "summary_sha256": _file_digest(score_dir / "score-summary.json"),
            },
        },
    )
    _create_empty(results_path)
    _create_empty(failures_path)
    started_ns = time.perf_counter_ns()
    correct = 0
    failed = 0
    total = 0
    for sequence, score_input in enumerate(_jsonl(inputs_path, "scoring input"), start=1):
        total += 1
        question_id = _nonblank(score_input.get("question_id"), "question_id")
        try:
            result = _replay_one(metrics, score_input, judges.get(question_id), sequence)
        except Exception as error:  # noqa: BLE001 - preserve independent replay failure evidence
            failed += 1
            _append_json(
                failures_path,
                {
                    "schema": REPLAY_FAILURE_SCHEMA,
                    "question_id": question_id,
                    "phase": "replay_score",
                    "error_type": type(error).__name__,
                    "summary": (str(error).strip() or type(error).__name__)[:500],
                },
            )
            continue
        _append_json(results_path, result)
        result_correct = result["correct"]
        if not isinstance(result_correct, bool):
            raise TypeError("Replay result correct field must be boolean")
        correct += int(result_correct)
    _write_json_exclusive(
        summary_path,
        {
            "schema": REPLAY_SUMMARY_SCHEMA,
            "classification": "smoke-subset-score-replay",
            "completed_at": datetime.now(UTC).isoformat(),
            "question_count": total,
            "correct": correct,
            "incorrect": total - correct - failed,
            "failed": failed,
            "accuracy": None if failed else correct / total,
            "reader_calls": 0,
            "judge_calls": 0,
            "elapsed_ms": round((time.perf_counter_ns() - started_ns) / 1_000_000, 3),
        },
    )
    if failed:
        raise ReplayScoreError(f"Score replay failed for {failed} question(s)")
    return ReplayScoreRun(output_dir, manifest_path, results_path, failures_path, summary_path)


def _replay_one(
    metrics: MetricsAPI,
    score_input: Mapping[str, object],
    judge: Mapping[str, object] | None,
    sequence: int,
) -> dict[str, object]:
    question_id = _nonblank(score_input.get("question_id"), "question_id")
    eval_spec = _nonblank(score_input.get("eval_function"), "eval_function")
    parsed = _nonblank(score_input.get("parsed_prediction"), "parsed_prediction")
    response_hash = score_input.get("reader_response_sha256")
    evaluator = metrics.eval_name(eval_spec)
    if evaluator in LLM_JUDGE_NAMES:
        if not isinstance(judge, Mapping) or judge.get("label") not in {0, 1}:
            raise ReplayScoreError(f"Missing saved Judge label for {question_id}")
        correct = judge["label"] == 1
        mode = "llm_judge_replay"
    else:
        answer = _nonblank(score_input.get("reference_answer"), "reference_answer")
        correct = metrics.score_to_bool(metrics.eval_from_spec(eval_spec, parsed, answer))
        mode = "deterministic_replay"
    return {
        "schema": PER_QUESTION_SCHEMA,
        "sequence": sequence,
        "question_id": question_id,
        "eval_function": eval_spec,
        "score_mode": mode,
        "correct": correct,
        "parsed_prediction": parsed,
        "reader_response_sha256": response_hash,
        "judge_output_ref": None if evaluator not in LLM_JUDGE_NAMES else question_id,
    }


def _load_metrics(harness_root: Path) -> MetricsAPI:
    root = str(harness_root.resolve())
    if root not in sys.path:
        sys.path.insert(0, root)
    return cast(MetricsAPI, importlib.import_module("evaluation.qa_eval_metrics"))


def _load_json(path: Path, label: str) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ReplayScoreError(f"Cannot read {label}: {path}") from error
    if not isinstance(value, dict):
        raise ReplayScoreError(f"{label} must be a JSON object")
    return value


def _jsonl(path: Path, label: str) -> Iterator[dict[str, object]]:
    try:
        with path.open(encoding="utf-8") as stream:
            for line_number, line in enumerate(stream, start=1):
                value = json.loads(line)
                if not isinstance(value, dict):
                    raise ReplayScoreError(f"{label} row {line_number} must be an object")
                yield value
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ReplayScoreError(f"Cannot read {label} input: {path}") from error


def _file_digest(path: Path) -> str:
    hasher = hashlib.sha256()
    try:
        with path.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                hasher.update(chunk)
    except OSError as error:
        raise ReplayScoreError(f"Cannot hash replay input: {path}") from error
    return hasher.hexdigest()


def _write_json_exclusive(path: Path, value: object) -> None:
    _write_text_exclusive(path, json.dumps(value, ensure_ascii=True, indent=2, sort_keys=True) + "\n")


def _write_text_exclusive(path: Path, value: str) -> None:
    try:
        with path.open("x", encoding="utf-8", newline="") as stream:
            stream.write(value)
    except OSError as error:
        raise ReplayScoreError(f"Cannot write replay artifact: {path}") from error


def _create_empty(path: Path) -> None:
    _write_text_exclusive(path, "")


def _append_json(path: Path, value: object) -> None:
    with path.open("a", encoding="utf-8", newline="") as stream:
        stream.write(json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")


def _nonblank(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise
```

### Core Architecture Module: `evaluation/src/powercontext_eval/benchmarks/longmemeval_v2/score_smoke.py`
```
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Score LongMemEval-V2 Reader outputs with pinned rules and an optional DeepSeek Judge."""

from __future__ import annotations

import hashlib
import importlib
import json
import os
import sys
import time
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol, cast

from powercontext_eval.benchmarks.longmemeval_v2.catalog import (
    LongMemEvalV2Catalog,
    SmokeSelection,
    load_dataset_lock,
    load_smoke_manifest,
    validate_harness_checkout,
)
from powercontext_eval.benchmarks.longmemeval_v2.costs import (
    ModelPricePolicy,
    UsageAccount,
    cost_policy_record,
    usage_cost_block,
)
from powercontext_eval.benchmarks.longmemeval_v2.reader_smoke import (
    DEFAULT_DEEPSEEK_BASE_URL,
    DEFAULT_DEEPSEEK_MODEL,
    DEFAULT_DEEPSEEK_TOKEN_ENV,
    DeepSeekOpenAIReader,
    ReaderResponseError,
    ReaderTransport,
)
from powercontext_eval.errors import PowerContextEvalError

SCORE_MANIFEST_SCHEMA = "powercontext.longmemeval-v2-score-run.v1"
SCORE_INPUT_SCHEMA = "powercontext.longmemeval-v2-score-input.v1"
PER_QUESTION_SCHEMA = "powercontext.longmemeval-v2-score-result.v1"
JUDGE_OUTPUT_SCHEMA = "powercontext.longmemeval-v2-judge-output.v1"
SCORE_FAILURE_SCHEMA = "powercontext.longmemeval-v2-score-failure.v1"
SCORE_SUMMARY_SCHEMA = "powercontext.longmemeval-v2-score-summary.v1"
LLM_JUDGE_NAMES = {"llm_abstention_checker", "llm_gotchas_checker"}


class ScoreSmokeError(PowerContextEvalError):
    """Reader outputs cannot be scored under the pinned LongMemEval-V2 contract."""


class JudgeJudgementError(ScoreSmokeError):
    """A completed Judge call could not be parsed into a judgement; its usage evidence is preserved."""

    def __init__(self, message: str, *, usage: dict[str, object], judge_latency_ms: float) -> None:
        super().__init__(message)
        self.usage = usage
        self.judge_latency_ms = judge_latency_ms


class MetricsAPI(Protocol):
    def eval_name(self, eval_spec: str) -> str: ...

    def extract_boxed_answer(self, text: str) -> str: ...

    def eval_from_spec(self, spec: str, *args: Any, **kwargs: Any) -> Any: ...

    def score_to_bool(self, value: Any) -> bool: ...

    def _build_abstention_judge_messages(self, **kwargs: Any) -> list[dict[str, str]]: ...

    def _build_gotchas_judge_messages(self, **kwargs: Any) -> list[dict[str, str]]: ...

    def _parse_llm_binary_judgement(self, text: str) -> tuple[int, str]: ...


@dataclass(frozen=True)
class ScoreSmokeRun:
    output_dir: Path
    manifest_path: Path
    inputs_path: Path
    results_path: Path
    judge_outputs_path: Path
    failures_path: Path
    summary_path: Path


def run_score_smoke(
    *,
    reader_dir: Path,
    data_root: Path,
    dataset_lock: Path,
    smoke_manifest: Path,
    harness_root: Path,
    output_dir: Path,
    judge_model: str = DEFAULT_DEEPSEEK_MODEL,
    judge_token_env: str = DEFAULT_DEEPSEEK_TOKEN_ENV,
    judge_base_url: str = DEFAULT_DEEPSEEK_BASE_URL,
    judge_max_tokens: int = 256,
    judge_temperature: float = 0.0,
    judge_timeout_seconds: float = 120.0,
    judge_price_policy: ModelPricePolicy | None = None,
    judge_transport: ReaderTransport | None = None,
) -> ScoreSmokeRun:
    """Score ten Reader answers and call an LLM Judge only for upstream LLM metric types."""

    if output_dir.exists():
        raise ScoreSmokeError(f"Refusing to overwrite score artifacts: {output_dir}")
    validate_harness_checkout(harness_root)
    lock = load_dataset_lock(dataset_lock)
    declared_selection = load_smoke_manifest(smoke_manifest)
    if declared_selection.tier != lock.tier:
        raise ScoreSmokeError("Smoke manifest tier does not match the dataset lock")
    catalog = LongMemEvalV2Catalog.load(
        data_root,
        tier=declared_selection.tier,
        expected_digests=lock.file_digests,
    )
    selection = catalog.select_smoke(declared_selection.cases)
    reader_manifest = _load_json(reader_dir / "reader-manifest.json", "reader manifest")
    reader_summary = _load_json(reader_dir / "reader-summary.json", "reader summary")
    outputs_path = reader_dir / "reader-outputs.jsonl"
    if not outputs_path.is_file():
        raise ScoreSmokeError(f"Missing Reader outputs: {outputs_path}")
    _validate_reader_artifacts(reader_manifest, reader_summary)
    outputs = _reader_outputs(outputs_path, selection)

    metrics = _load_metrics(harness_root)
    if judge_transport is None:
        token = _nonblank(os.getenv(judge_token_env), judge_token_env)
        transport: ReaderTransport = DeepSeekOpenAIReader(
            judge_base_url,
            token=token,
            model=_nonblank(judge_model, "judge_model"),
            max_tokens=judge_max_tokens,
            temperature=judge_temperature,
            timeout_seconds=judge_timeout_seconds,
        )
    else:
        transport = judge_transport

    questions = _selected_questions(data_root / "questions.jsonl", selection)
    try:
        output_dir.mkdir(parents=True, exist_ok=False)
    except FileExistsError as error:
        raise ScoreSmokeError(f"Refusing to overwrite score artifacts: {output_dir}") from error
    except OSError as error:
        raise ScoreSmokeError(f"Cannot create score artifact directory: {output_dir}") from error

    manifest_path = output_dir / "score-manifest.json"
    inputs_path = output_dir / "scoring-inputs.local.jsonl"
    results_path = output_dir / "per-question.jsonl"
    judge_outputs_path = output_dir / "judge-outputs.jsonl"
    failures_path = output_dir / "score-failures.jsonl"
    summary_path = output_dir / "score-summary.json"
    _write_json_exclusive(
        manifest_path,
        {
            "schema": SCORE_MANIFEST_SCHEMA,
            "classification": "smoke-subset-score-only",
            "reader": {
                "directory": str(reader_dir.resolve()),
                "manifest_sha256": _file_digest(reader_dir / "reader-manifest.json"),
                "outputs_sha256": _file_digest(outputs_path),
                "summary_sha256": _file_digest(reader_dir / "reader-summary.json"),
            },
            "judge": {
                "provider": "deepseek-openai",
                "model": judge_model,
                "token_env": judge_token_env,
                "base_url": "configured-directly",
                "max_tokens": judge_max_tokens,
                "temperature": judge_temperature,
            },
            "cost_policy": cost_policy_record(judge_price_policy),
        },
    )
    _create_empty(inputs_path)
    _create_empty(results_path)
    _create_empty(judge_outputs_path)
    _create_empty(failures_path)

    started_ns = time.perf_counter_ns()
    correct = 0
    failed = 0
    judge_account = UsageAccount()
    for sequence, question in enumerate(questions, start=1):
        question_id = _nonblank(question.get("id"), "question.id")
        reader = outputs[question_id]
        try:
            score_input, result, judge_output = _score_one(
                metrics, question, reader, sequence=sequence, transport=transport
            )
        except JudgeJudgementError as error:
            # The Judge transport already completed and returned usage; count the call
            # and keep the evidence with the failure instead of losing the accounting.
            failed += 1
            judge_account.account(error.usage)
            _append_json(
                failures_path,
                {
                    "schema": SCORE_FAILURE_SCHEMA,
                    "question_id": question["id"],
                    "phase": "scoring",
                    "error_type": type(error).__name__,
                    "summary": (str(error).strip() or type(error).__name__)[:500],
                    "judge_usage": error.usage,
                    "judge_latency_ms": error.judge_latency_ms,
                },
            )
            continue
        except Exception as error:  # noqa: BLE001 - one scoring failure must not hide subsequent outcomes
            failed += 1
            _append_json(
                failures_path,
                {
                    "schema": SCORE_FAILURE_SCHEMA,
                    "question_id": question["id"],
                    "phase": "scoring",
                    "error_type": type(error).__name__,
                    "summary": (str(error).strip() or type(error).__name__)[:500],
                },
            )
            continue
        _append_json(inputs_path, score_input)
        _append_json(results_path, result)
        if judge_output is not None:
            _append_json(judge_outputs_path, judge_output)
            judge_account.account(judge_output["usage"])
        result_correct = result["correct"]
        if not isinstance(result_correct, bool):
            raise TypeError("score result correct field must be a boolean")
        correct += int(result_correct)
    total = len(questions)
    _write_json_exclusive(
        summary_path,
        {
            "schema": SCORE_SUMMARY_SCHEMA,
            "classification": "smoke-subset-score-only",
            "completed_at": datetime.now(UTC).isoformat(),
            "question_count": total,
            "correct": correct,
            "incorrect": total - correct - failed,
            "failed": failed,
            "accuracy": None if failed else corr
```

### Core Architecture Module: `evaluation/src/powercontext_eval/web/worker.py`
```
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Supervised task-pair orchestration for queued evaluations."""

from __future__ import annotations

import fcntl
import logging
import os
import sqlite3
import stat
import threading
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol
from uuid import uuid4

from powercontext_eval.artifacts import ArtifactError
from powercontext_eval.benchmarks.base import GoldCheckFailed
from powercontext_eval.benchmarks.swebench_pro.adapter import DatasetSchemaError, SweBenchProInstance
from powercontext_eval.benchmarks.swebench_pro.catalog import CatalogError, SweBenchProCatalog
from powercontext_eval.benchmarks.swebench_pro.evaluator import OfficialResultError
from powercontext_eval.benchmarks.swebench_pro.prediction import BinaryPatchError
from powercontext_eval.codex import CodexCapacityError, CodexInfrastructureError, UnsafeCodexInvocation
from powercontext_eval.errors import CommandCancelled, CommandError, GitSourceError, PowerContextEvalError
from powercontext_eval.git_source import GitSource
from powercontext_eval.models import Arm, PowerContextRef
from powercontext_eval.paths import EvaluationPaths
from powercontext_eval.powercontext_sut import (
    InvalidTreatment,
    PluginInspectionFailure,
    ReadinessFailure,
    UnsafeSutConfiguration,
)
from powercontext_eval.process import ProcessRunner
from powercontext_eval.report import InvalidReportBundle
from powercontext_eval.runner import (
    MinimalRunConfig,
    MinimalRunResult,
    RunConfig,
    RunPhase,
    run_minimal_swebench_pro,
    run_swebench_pro_instance,
)
from powercontext_eval.tokensflow import TokensFlowFinalizationDescriptor, TokensFlowFinalizationRegistrar
from powercontext_eval.web.claiming import ClaimCoordinator, PeriodicUsageRefresher
from powercontext_eval.web.config import WebConfig
from powercontext_eval.web.finalization import DockerFinalizationRuntime, TokensFlowFinalizer
from powercontext_eval.web.models import (
    FailureCategory,
    FailureCode,
    RetryDisposition,
    SafeFailure,
    TaskPhase,
    TaskRecord,
    TaskResult,
)
from powercontext_eval.web.reporting import ReportingError, load_report
from powercontext_eval.web.resources import AttemptLifecycleCleaner, ResourceProbe, default_workspace_reclaimer
from powercontext_eval.web.revision import RUNTIME_SCHEMA_VERSION, current_build_revision
from powercontext_eval.web.store import (
    TaskConflict,
    TaskOwnershipError,
    TaskStore,
    TokensFlowFinalizationCreate,
)
from powercontext_eval.web.usage import CodexUsageProbe, UsageSnapshot

_INTERNAL_SUMMARY = "The evaluation worker failed unexpectedly. Inspect the retained worker logs."
_REPORT_SUMMARY = "Evaluation report validation failed."
_TREATMENT_FAILURE_SUMMARIES = {
    "Treatment evidence is malformed": "Treatment evidence was malformed.",
    "Treatment evidence does not match the requested arm": "Treatment evidence did not match the requested arm.",
    "PowerContext source HEAD does not match the configured commit": (
        "PowerContext source revision did not match the pinned batch."
    ),
    "PowerContext source checkout must be clean": "PowerContext source checkout was not clean.",
    "PowerContext plugin manifest is invalid": "PowerContext plugin manifest was invalid.",
    "PowerContext plugin manifest version does not match configuration": (
        "PowerContext plugin manifest version did not match the evaluation configuration."
    ),
    "PowerContext plugin lockfile is missing": "PowerContext plugin lockfile was missing.",
    "PowerContext plugin lockfile is invalid": "PowerContext plugin lockfile was invalid.",
    "Isolated Codex home does not contain the exact expected plugin": (
        "Isolated Codex home did not contain the pinned PowerContext plugin."
    ),
    "Codex CLI version does not match the pinned experiment": (
        "Codex CLI version did not match the pinned experiment."
    ),
    "PowerContext SQLite evidence is malformed": "PowerContext SQLite treatment evidence was malformed.",
}
_LOGGER = logging.getLogger(__name__)


class ThreadLike(Protocol):
    def start(self) -> None: ...

    def join(self) -> None: ...


ThreadFactory = Callable[..., ThreadLike]
Runner = Callable[..., MinimalRunResult]


class SourceResolver(Protocol):
    def resolve(self, source: str | Path, requested: PowerContextRef) -> object: ...


class Catalog(Protocol):
    def require(self, instance_id: str) -> SweBenchProInstance: ...


class UsageProbe(Protocol):
    def read(self, *, now: datetime) -> UsageSnapshot: ...


class FinalizerSupervisor(Protocol):
    def run_forever(self, stop: threading.Event, poll_seconds: float) -> None: ...


class WorkspaceReclaimerSupervisor(Protocol):
    def run_forever(self, stop: threading.Event) -> None: ...


class AttemptLifecycleSupervisor(Protocol):
    def run_once(self) -> int: ...

    def run_forever(self, stop: threading.Event) -> None: ...


class UsageRefreshSupervisor(Protocol):
    def run_forever(self, stop: threading.Event, poll_seconds: float) -> None: ...


class TaskPairWorker:
    """Claim and execute complete OFF/ON task pairs in one isolated slot."""

    def __init__(
        self,
        config: WebConfig,
        store: TaskStore,
        *,
        coordinator: ClaimCoordinator | None = None,
        usage_probe: UsageProbe | None = None,
        runner: Runner | None = None,
        source: SourceResolver | None = None,
        catalog: Catalog | None = None,
        worker_id: str | None = None,
        clock: Callable[[], datetime] | None = None,
        sleep: Callable[[float], None] | None = None,
        thread_factory: ThreadFactory = threading.Thread,
    ) -> None:
        self._config = config
        self._store = store
        self._usage_probe = usage_probe or CodexUsageProbe(
            codex_binary=config.codex_binary,
            auth_json=config.auth_json,
            codex_config=config.codex_config,
            proxy_url=config.proxy_url,
            timeout_seconds=config.usage_probe_timeout_seconds,
        )
        self._batch_runner: Runner = runner or run_swebench_pro_instance
        self._legacy_runner: Runner = runner or run_minimal_swebench_pro
        self._source = source or GitSource(
            cache_root=config.run_root / "cache" / "powercontext-git",
            runner=ProcessRunner(),
        )
        self._catalog = catalog
        self._worker_id = worker_id or f"worker-{uuid4().hex}"
        self._clock = clock or (lambda: datetime.now(UTC))
        self._coordinator = coordinator or ClaimCoordinator(
            config, store, usage_probe=self._usage_probe, clock=self._clock
        )
        self._stop = threading.Event()
        self._sleep = sleep or self._stop.wait
        self._thread_factory = thread_factory

    def stop(self) -> None:
        """Request shutdown after the active evaluation returns."""
        self._coordinator.stop()
        self._stop.set()

    def run_once(self) -> bool:
        """Run the next task, returning whether one was claimed."""
        task = self._coordinator.claim(self._worker_id)
        if task is None:
            return False
        return self._run_claimed(task)

    def _run_claimed(self, task: TaskRecord) -> bool:
        ownership_lost = threading.Event()
        heartbeat_stop = threading.Event()
        heartbeat: ThreadLike | None = None
        heartbeat_started = False
        phase: TaskPhase | None = None
        attempt_finished = False
        try:
            heartbeat = self._thread_factory(
                target=self._heartbeat,
                daemon=True,
                name=f"evaluation-heartbeat-{task.task_id}",
                args=(task.task_id, heartbeat_stop, ownership_lost),
            )
            heartbeat.start()
            heartbeat_started = True
            run_id = _execution_run_id(task)
            layout = EvaluationPaths(self._config.run_root, run_id)
            work_dir = self._config.run_root / "work" / run_id
            if os.path.lexists(layout.run_artifacts) or os.path.lexists(work_dir):
                attempt_finished = self._fail(
                    task,
                    SafeFailure(
                        category=FailureCategory.REPORT_GENERATION,
                        failure_code=FailureCode.ARTIFACTS_ALREADY_EXIST,
                        summary="Evaluation artifacts already exist; refusing to overwrite them.",
                        retry_disposition=RetryDisposition.TERMINAL,
                    ),
                    ownership_lost,
                )
                return True

            def on_phase(run_phase: RunPhase) -> None:
                nonlocal phase
                mapped = TaskPhase(run_phase.value)
                try:
                    self._store.set_phase(task.task_id, self._worker_id, mapped, now=self._clock())
                except (TaskOwnershipError, TaskConflict):
                    ownership_lost.set()
                    return
                phase = mapped

            result = self._invoke_runner(task, on_phase, ownership_lost)
            if ownership_lost.is_set():
                return True
            task_result = self._validated_result(task, result)
            load_report(layout.run_artifacts, self._config.run_root / "runs")
            self.
```

### Core Architecture Module: `examples/jupyter/support/mcp_worker.py`
```
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Execute notebook-supplied calls through a real MCP HTTP session in another process."""

from __future__ import annotations

import asyncio
import json
import sys

from fastmcp import Client


async def main() -> None:
    request = json.load(sys.stdin)
    async with Client(request["url"]) as client:
        available = [tool.name for tool in await client.list_tools()]
        results = []
        for operation in request["calls"]:
            result = await client.call_tool(operation["name"], operation["arguments"])
            if result.is_error:
                raise RuntimeError("MCP operation failed")  # noqa: TRY003
            results.append({"name": operation["name"], "result": result.structured_content})
    print(json.dumps({"tools": available, "calls": results}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/jupyter/support/receiver_worker.py`
```
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Run the real Receiver once; configuration arrives on stdin, never in argv."""

from __future__ import annotations

import asyncio
import json
import sys
from dataclasses import asdict

from powercontext.client import RemoteSkillReceiver, RemoteSkillReceiverConfig


async def main() -> None:
    config = RemoteSkillReceiverConfig.model_validate(json.load(sys.stdin))
    async with RemoteSkillReceiver(config) as receiver:
        result = await receiver.sync()
    print(json.dumps(asdict(result)))


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/systemone/worker.py`
```
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Run one persisted Memory operation in an independent Python process."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from contextlib import redirect_stdout
from pathlib import Path
from typing import Any

from powercontext.artifacts import MemoryCitation
from powercontext.builtin.artifacts.memory import MemoryEntryInput
from powercontext.builtin.persistence.sqlite import SQLiteConfig
from powercontext.builtin.runtime import (
    BuiltinConfig,
    BuiltinRuntime,
    GetMemoryEntryRequest,
    PrepareContextRequest,
    RememberMemoryRequest,
    open_builtin_runtime,
)
from powercontext.builtin.scope import ScopeDraft

from .scenario import SCENARIO

_BEGIN = "BEGIN_POWERCONTEXT_PREPARED_CONTEXT_V1"
_END = "END_POWERCONTEXT_PREPARED_CONTEXT_V1"


async def _prepare(runtime: BuiltinRuntime, scope_id: str, query: str) -> dict[str, Any]:
    """Recall complete evidence and independently resolve its exact persisted citations."""
    prepared = await runtime.context.for_scope(scope_id).prepare(PrepareContextRequest(query=query, max_bytes=8000))
    citations: list[dict[str, Any]] = []
    if prepared.content is not None:
        payload = json.loads(prepared.content.split(_BEGIN, 1)[1].split(_END, 1)[0].strip())
        for item in payload["items"]:
            citation = item["citation"]
            # The current renderer uses relative citations for the requested Scope.
            # Resolving through that Scope validates ownership as well as entry identity.
            record = await runtime.memory.for_scope(scope_id).get(
                GetMemoryEntryRequest(citation=MemoryCitation.model_validate(citation))
            )
            if item.get("truncated") or record.entry.text != item["content"]:
                raise ValueError("Prepared evidence does not match its complete persisted Memory entry")  # noqa: TRY003
            citations.append({"scope_id": scope_id, **citation})
    return {"prepared": prepared.model_dump(mode="json"), "citations": citations, "pid": os.getpid()}


async def execute(request: dict[str, Any]) -> dict[str, Any]:
    """Open a fresh Runtime, perform one operation, and close every database connection."""
    directory = Path(request["directory"])
    if not directory.is_absolute():
        raise ValueError("The run directory must be an absolute path")  # noqa: TRY003
    await asyncio.to_thread(directory.mkdir, parents=True, exist_ok=True)
    config = BuiltinConfig(database=SQLiteConfig(url=f"sqlite+aiosqlite:///{directory / 'runtime.db'}"))
    async with open_builtin_runtime(config, scheduler_path=directory / "scheduler.db") as runtime:
        if request["mode"] == "seed":
            if runtime.scopes is None:
                raise RuntimeError("The example requires the Scope registry")  # noqa: TRY003
            scope = await runtime.scopes.create(
                ScopeDraft(
                    title="Billing amount conventions",
                    summary="Synthetic project decisions remembered in the first session.",
                    idempotency_key="systemone-example:billing",
                )
            )
            other = await runtime.scopes.create(
                ScopeDraft(
                    title="Analytics amount conventions",
                    summary="A separate project with a conflicting rounding convention.",
                    idempotency_key="systemone-example:analytics",
                )
            )
            saved = await runtime.memory.for_scope(scope.scope_id).remember(
                RememberMemoryRequest(entries=(MemoryEntryInput(kind="decision", text=SCENARIO["policy"]),))
            )
            other_saved = await runtime.memory.for_scope(other.scope_id).remember(
                RememberMemoryRequest(
                    entries=(
                        MemoryEntryInput(
                            kind="decision",
                            text=(
                                f"{SCENARIO['query']}\n"
                                "Analytics project amount policy: use Decimal ROUND_HALF_EVEN for integer cents. "
                                "This decision belongs only to the separate analytics project."
                            ),
                        ),
                    )
                )
            )
            return {
                "scope_id": scope.scope_id,
                "other_scope_id": other.scope_id,
                "memory_ref": saved.memory_ref.model_dump(mode="json"),
                "other_memory_ref": other_saved.memory_ref.model_dump(mode="json"),
                "pid": os.getpid(),
            }
        if request["mode"] == "recall":
            selected = await _prepare(runtime, request["scope_id"], SCENARIO["query"])
            other = await _prepare(runtime, request["other_scope_id"], SCENARIO["query"])
            isolated = (
                request["scope_id"] != request["other_scope_id"]
                and bool(selected["citations"])
                and bool(other["citations"])
                and all(citation["scope_id"] == request["scope_id"] for citation in selected["citations"])
                and all(citation["scope_id"] == request["other_scope_id"] for citation in other["citations"])
            )
            selected["isolation"] = {
                "status": "passed" if isolated else "failed",
                "scope_id": request["scope_id"],
                "other_scope_id": request["other_scope_id"],
                "content_bytes": selected["prepared"]["content_bytes"],
                "other_prepared": other["prepared"],
                "other_citations": other["citations"],
            }
            return selected
        if request["mode"] == "record":
            summary = request["summary"]
            if not isinstance(summary, str) or not summary.strip():
                raise ValueError("An observed outcome summary is required")  # noqa: TRY003
            saved = await runtime.memory.for_scope(request["scope_id"]).remember(
                RememberMemoryRequest(entries=(MemoryEntryInput(kind="outcome", text=f"invoice-outcome {summary}"),))
            )
            return {"memory_ref": saved.memory_ref.model_dump(mode="json"), "pid": os.getpid()}
        if request["mode"] == "resume":
            return await _prepare(runtime, request["scope_id"], "invoice-outcome")
        raise ValueError("Unknown Memory worker mode")  # noqa: TRY003


def main() -> int:
    """Reserve stdout for the machine-readable result of one independent operation."""
    request = json.load(sys.stdin)
    with redirect_stdout(sys.stderr):
        result = asyncio.run(execute(request))
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `integrations/claude-code/plugins/powercontext/hooks/diagnostics.py`
```
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Best-effort cross-process throttling for host-visible hook diagnostics."""

from __future__ import annotations

import json
import os
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

_FAILURE_OUTCOMES = frozenset({"authentication_failed", "version_mismatch", "server_unavailable", "invalid_response"})
_COOLDOWN_SECONDS = 60.0


def _state_path() -> Path:
    configured = os.environ.get("POWERCONTEXT_DIAGNOSTIC_STATE_FILE")
    if configured and configured.strip():
        return Path(configured)
    if os.name == "nt":
        root = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    else:
        root = Path(os.environ.get("XDG_STATE_HOME") or Path.home() / ".local" / "state")
    return root / "powercontext" / "claude-code-diagnostics.json"


@contextmanager
def _locked(lock_path: Path) -> Iterator[None]:
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+b") as lock_file:
        if os.name == "nt":
            import msvcrt

            lock_file.seek(0, os.SEEK_END)
            if lock_file.tell() == 0:
                lock_file.write(b"\0")
                lock_file.flush()
            lock_file.seek(0)
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            if os.name == "nt":
                import msvcrt

                lock_file.seek(0)
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def should_emit(outcome: str) -> bool:
    """Return whether a diagnostic should be shown to the host user."""

    if outcome not in _FAILURE_OUTCOMES:
        return True

    try:
        now = time.time()
        state_path = _state_path()
        with _locked(state_path.with_name(f"{state_path.name}.lock")):
            try:
                state = json.loads(state_path.read_text(encoding="utf-8"))
            except (FileNotFoundError, OSError, UnicodeDecodeError, json.JSONDecodeError):
                state = {}
            if not isinstance(state, dict):
                state = {}
            previous = state.get(outcome)
            if (
                isinstance(previous, (int, float))
                and not isinstance(previous, bool)
                and 0 <= now - previous < _COOLDOWN_SECONDS
            ):
                return False

            state[outcome] = now
            temporary_path = state_path.with_name(f".{state_path.name}.{os.getpid()}.tmp")
            temporary_path.write_text(json.dumps(state, separators=(",", ":")), encoding="utf-8")
            os.replace(temporary_path, state_path)
    except (OSError, TypeError, ValueError):
        # Diagnostics must never make a hook invocation fail.
        return True
    return True

```

### Core Architecture Module: `integrations/claude-code/plugins/powercontext/hooks/prepared_context.py`
```
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Strict parsing for final context prepared by the PowerContext Runtime."""

from __future__ import annotations

from collections.abc import Mapping

PREPARED_CONTEXT_SCHEMA = "powercontext.prepared-context.v1"
MAX_CONTEXT_BYTES = 8_000

_PREPARED_CONTEXT_FIELDS = frozenset({"schema", "status", "content", "content_bytes"})


class InvalidPreparedContextResponse(RuntimeError):
    """Raised when a Server response does not satisfy the prepared-context contract."""


def validate_prepared_context(response: Mapping[str, object]) -> dict[str, object]:
    """Return a safe copy after validating the complete v1 response contract."""

    if set(response) != _PREPARED_CONTEXT_FIELDS:
        raise InvalidPreparedContextResponse
    if response["schema"] != PREPARED_CONTEXT_SCHEMA:
        raise InvalidPreparedContextResponse

    status = response["status"]
    content = response["content"]
    content_bytes = response["content_bytes"]
    if not isinstance(content_bytes, int) or isinstance(content_bytes, bool) or content_bytes < 0:
        raise InvalidPreparedContextResponse
    if status == "empty":
        if content is not None or content_bytes != 0:
            raise InvalidPreparedContextResponse
    elif status == "ready":
        if not isinstance(content, str) or not content.strip():
            raise InvalidPreparedContextResponse
        try:
            encoded_content = content.encode("utf-8")
        except UnicodeEncodeError as error:
            raise InvalidPreparedContextResponse from error
        if len(encoded_content) != content_bytes or content_bytes > MAX_CONTEXT_BYTES:
            raise InvalidPreparedContextResponse
    else:
        raise InvalidPreparedContextResponse
    return {
        "schema": response["schema"],
        "status": status,
        "content": content,
        "content_bytes": content_bytes,
    }

```

### Core Architecture Module: `integrations/claude-code/plugins/powercontext/hooks/user_prompt_submit.py`
```
#!/usr/bin/env python3
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Recall memory and capture the current Claude Code prompt without blocking Claude."""

from __future__ import annotations

import json
import sys
from collections.abc import Mapping
from contextlib import suppress
from hashlib import sha256
from pathlib import Path
from time import monotonic
from typing import Any, Protocol, cast
from urllib.error import HTTPError
from urllib.request import Request

_PLUGIN_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_ROOT = _PLUGIN_ROOT / "scripts"
sys.path.insert(0, str(_PLUGIN_ROOT))
sys.path.insert(0, str(_SCRIPTS_ROOT))

from claude_code_settings import ClaudeCodePluginSettings  # noqa: E402
from hooks import prepared_context as _prepared_context  # noqa: E402
from hooks.diagnostics import should_emit as _should_emit_diagnostic  # noqa: E402
from workspace_scope import bind_response_deadline, open_bounded, resolve_scope_id  # noqa: E402

_MAX_CONTEXT_BYTES = _prepared_context.MAX_CONTEXT_BYTES
_InvalidResponseError = _prepared_context.InvalidPreparedContextResponse
_validate_prepared_context = _prepared_context.validate_prepared_context
_MAX_RESPONSE_BYTES = 1_048_576
_MAX_SOURCE_LENGTH = 200_000
_READ_CHUNK_BYTES = 65_536
_REQUEST_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "powercontext-claude-code-plugin/0.1.2",
}
_FAILURE_OUTCOMES = frozenset({"authentication_failed", "version_mismatch", "server_unavailable", "invalid_response"})


class _ReadableResponse(Protocol):
    def read(self, n: int = -1) -> bytes: ...


class _Response(_ReadableResponse, Protocol):
    status: int

    def __enter__(self) -> _Response: ...

    def __exit__(self, *args: object) -> object: ...


class _HttpStatusError(RuntimeError):
    def __init__(self, status: int, path: str = "/v1/context/prepare", code: str | None = None) -> None:
        self.status = status
        self.path = path
        self.code = code
        super().__init__(f"PowerContext returned HTTP {status}")


class _ServerUnavailableError(RuntimeError):
    pass


_COMPATIBILITY_OR_AVAILABILITY_PATHS = frozenset({
    "/health/live",
    "/health/ready",
    "/v1/capabilities",
    "/v1/context/prepare",
})
_AUTOMATIC_OPERATION_PATHS = {
    "context_prepare": "/v1/context/prepare",
    "capture_source": "/v1/sources/content",
    "flush_memory": "/v1/memory/flush",
}


def _http_failure_outcome(error: _HttpStatusError, *, operation: str) -> str | None:
    if error.status == 401:
        return "authentication_failed"
    if error.status == 404 and error.path in _COMPATIBILITY_OR_AVAILABILITY_PATHS and error.code is None:
        return "version_mismatch"
    if error.status == 503:
        return "server_unavailable"
    if error.status in {404, 409, 422}:
        return "invalid_response" if _AUTOMATIC_OPERATION_PATHS.get(operation) == error.path else None
    return "invalid_response"


def _decode_error_code(raw: bytes) -> str | None:
    try:
        decoded = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(decoded, dict):
        return None
    error = decoded.get("error")
    if not isinstance(error, dict):
        return None
    code = error.get("code")
    return code if isinstance(code, str) else None


def main(settings: ClaudeCodePluginSettings | None = None) -> int:
    """Process one Claude Code hook payload and fail open."""

    try:
        settings = ClaudeCodePluginSettings.from_environment() if settings is None else settings
        stdin = sys.stdin
        if hasattr(stdin, "buffer"):
            payload = cast(dict[str, Any], json.loads(stdin.buffer.read().decode("utf-8")))
        else:
            payload = cast(dict[str, Any], json.load(stdin))
        if not _is_user_prompt_submit(payload.get("hook_event_name")):
            return 0
        emitted_diagnostics: set[str] = set()
        diagnostic_events: list[dict[str, object]] = []
        prompt = _prompt(payload)
        cwd = payload.get("cwd")
        if prompt is None or not prompt.strip() or not isinstance(cwd, str):
            _emit_context_event("skipped", diagnostic_events=diagnostic_events)
            _write_hook_output(diagnostic_events=diagnostic_events)
            return 0

        http_deadline = monotonic() + settings.http_budget_seconds
        scope_id = resolve_scope_id(
            cwd,
            session_id=_payload_identifier(payload, "session_id"),
            settings=settings,
            deadline=http_deadline,
        )
        context = None
        with suppress(Exception):
            context = _recall_context(
                prompt,
                scope_id,
                settings=settings,
                deadline=http_deadline,
                emitted_diagnostics=emitted_diagnostics,
                diagnostic_events=diagnostic_events,
            )

        if settings.capture_prompts and len(prompt) <= _MAX_SOURCE_LENGTH:
            try:
                captured = _capture_prompt(
                    payload,
                    prompt=prompt,
                    cwd=cwd,
                    scope_id=scope_id,
                    settings=settings,
                    deadline=http_deadline,
                )
                position = _source_position(captured)
            except Exception as error:
                _emit_failure_event(
                    "capture_source",
                    error,
                    emitted_diagnostics=emitted_diagnostics,
                    diagnostic_events=diagnostic_events,
                )
            else:
                if settings.flush_on_capture:
                    try:
                        _flush_through(
                            scope_id,
                            position,
                            settings=settings,
                            deadline=http_deadline,
                        )
                    except Exception as error:
                        _emit_failure_event(
                            "flush_memory",
                            error,
                            emitted_diagnostics=emitted_diagnostics,
                            diagnostic_events=diagnostic_events,
                        )

        _write_hook_output(context=context, diagnostic_events=diagnostic_events)
    except Exception:
        return 0
    return 0


def _prompt(payload: Mapping[str, object]) -> str | None:
    prompt = payload.get("prompt")
    if isinstance(prompt, str):
        return prompt
    fallback = payload.get("user_prompt")
    return fallback if isinstance(fallback, str) else None


def _prepare_context(
    query: str,
    scope_id: str,
    *,
    settings: ClaudeCodePluginSettings,
    deadline: float,
) -> Mapping[str, object]:
    return _post_json(
        "/v1/context/prepare",
        {
            "scope_id": scope_id,
            "query": query,
            "max_bytes": _MAX_CONTEXT_BYTES,
            **({"include_code": True} if settings.include_code else {}),
            **({"assembly": settings.context_assembly} if settings.context_assembly is not None else {}),
        },
        settings=settings,
        deadline=deadline,
        expected_status=200,
    )


def _capture_prompt(
    payload: Mapping[str, object],
    *,
    prompt: str,
    cwd: str,
    scope_id: str,
    settings: ClaudeCodePluginSettings,
    deadline: float,
) -> Mapping[str, object]:
    session_id = _payload_identifier(payload, "session_id")
    prompt_id = _payload_identifier(payload, "prompt_id", "request_id")
    identity = "\0".join((scope_id, session_id or "", prompt_id or "", prompt))
    source_id = f"claude-code-user-prompt:{sha256(identity.encode()).hexdigest()}"
    metadata = {
        "origin": "claude-code",
        "event": "user_prompt_submit",
        "cwd": cwd,
    }
    if session_id is not None:
        metadata["session_id"] = session_id
    if prompt_id is not None:
        metadata["prompt_id"] = prompt_id
    return _post_json(
        "/v1/sources/content",
        {
            "scope_id": scope_id,
            "source_id": source_id,
            "content": prompt,
            "metadata": metadata,
        },
        settings=settings,
        deadline=deadline,
    )


def _flush_through(
    scope_id: str,
    position: int,
    *,
    settings: ClaudeCodePluginSettings,
    deadline: float,
) -> None:
    for _ in range(settings.flush_max_calls):
        result = _post_json(
            "/v1/memory/flush",
            {"scope_id": scope_id},
            settings=settings,
            deadline=deadline,
        )
        cursor = result.get("current_cursor")
        if isinstance(cursor, int) and not isinstance(cursor, bool) and cursor >= position:
            return
    raise RuntimeError


def _source_position(response: Mapping[str, object]) -> int:
    position = response.get("position")
    if not isinstance(position, int) or isinstance(position, bool) or position < 1:
        raise TypeError
    return position


def _payload_identifier(payload: Mapping[str, object], *names: str) -> str | None:
    for name in names:
        value = payload.get(name)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _is_user_prompt_submit(value: object) -> bool:
    return isinstance(value, str) and value.replace("_", "").lowe
```

### Core Architecture Module: `integrations/codex/plugins/powercontext/hooks/bind_tools.py`
```
#!/usr/bin/env python3
# Copyright (c) 2026 OceanBase.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Bind PowerContext MCP data-plane calls to the current Codex Session."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from time import monotonic
from typing import Any, cast

_PLUGIN_ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS_ROOT = _PLUGIN_ROOT / "scripts"
sys.path.insert(0, str(_PLUGIN_ROOT))
sys.path.insert(0, str(_SCRIPTS_ROOT))

from scope_binding import (  # noqa: E402
    ScopeBindingError,
    binding_keys,
    resolve_scope_id,
    session_binding_key,
)
from settings import CodexPluginSettings  # noqa: E402

_PREFIX = "mcp__powercontext__"
_CONTROL_OPERATIONS = frozenset({"set_scope_binding", "clear_scope_binding"})
_RESOLVE_OPERATIONS = frozenset({"resolve_scope_binding"})
_HOST_OPERATIONS = frozenset({"create_scope", "get_scope", "list_scopes", "publish_artifact"})
_CURRENT_OPERATIONS = frozenset({
    "acknowledge_handoff",
    "activate_handoff",
    "approve_artifact_candidate",
    "capture_content_source",
    "commit_handoff",
    "continue_handoff",
    "create_remote_skill_target",
    "create_work_contract",
    "download_skill_package",
    "finalize_handoff",
    "flush_memory",
    "flush_topic_memory",
    "generate_experience",
    "generate_skill",
    "get_artifact_candidate",
    "get_experience",
    "get_memory_capacity",
    "get_memory_entry",
    "get_skill",
    "get_skill_package_manifest",
    "get_topic_memory",
    "handoff_current_work",
    "import_external_skill",
    "list_artifact_candidates",
    "list_external_skills",
    "list_managed_skills",
    "list_memory_changes",
    "list_memory_entries",
    "list_remote_skill_targets",
    "prepare_context",
    "prepare_handoff",
    "prepare_handoff_hint",
    "propose_experience",
    "propose_skill",
    "propose_skill_package",
    "publish_remote_skill",
    "query_code",
    "record_skill_usage",
    "record_task_outcome",
    "reject_artifact_candidate",
    "remember_memory",
    "rename_remote_skill_target",
    "resolve_external_skill",
    "retire_memory_entry",
    "revise_artifact_candidate",
    "revise_memory_entry",
    "revoke_remote_skill_target",
    "scan_external_skills",
    "search_memory",
    "search_topic_memory",
    "unpublish_remote_skill",
    "update_skill_lifecycle",
})
_SELECTION_OPERATIONS = frozenset({"get_handoff_report", "get_stats"})


def main(settings: CodexPluginSettings | None = None) -> int:
    try:
        payload = cast(dict[str, Any], json.load(sys.stdin))
        tool_name = payload.get("tool_name")
        tool_input = payload.get("tool_input")
        session_id = payload.get("session_id")
        cwd = payload.get("cwd")
        if (
            not isinstance(tool_name, str)
            or not tool_name.startswith(_PREFIX)
            or not isinstance(tool_input, dict)
            or not isinstance(session_id, str)
            or not isinstance(cwd, str)
        ):
            return 0
        operation = tool_name.removeprefix(_PREFIX)
        if operation in _CONTROL_OPERATIONS:
            updated = dict(tool_input)
            updated["key"] = session_binding_key(session_id)
            _allow(updated)
            return 0
        if operation in _RESOLVE_OPERATIONS:
            settings = CodexPluginSettings() if settings is None else settings
            _allow({
                "explicit_scope_id": settings.scope_id,
                "binding_keys": binding_keys(cwd, session_id=session_id),
            })
            return 0
        if operation in _HOST_OPERATIONS:
            _allow(dict(tool_input))
            return 0
        if operation not in _CURRENT_OPERATIONS and operation not in _SELECTION_OPERATIONS:
            return 0
        settings = CodexPluginSettings() if settings is None else settings
        scope_id = resolve_scope_id(
            cwd,
            session_id=session_id,
            settings=settings,
            deadline=monotonic() + settings.http_budget_seconds,
        )
        updated = dict(tool_input)
        if operation in _SELECTION_OPERATIONS:
            updated["selection"] = {"mode": "exact", "scope_ids": [scope_id]}
        else:
            updated["scope_id"] = scope_id
        _allow(updated)
    except (ScopeBindingError, ValueError, OSError, json.JSONDecodeError):
        _deny()
    return 0


def _allow(updated_input: dict[str, object]) -> None:
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "updatedInput": updated_input,
            }
        },
        sys.stdout,
        separators=(",", ":"),
    )
    sys.stdout.write("\n")


def _deny() -> None:
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "PowerContext could not resolve the current Scope binding.",
            }
        },
        sys.stdout,
        separators=(",", ":"),
    )
    sys.stdout.write("\n")


if __name__ == "__main__":
    raise SystemExit(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1822** (2026-10-01): **bug: E2E ACP installation upgrades Bub beyond the harness pin**
  *Symptoms*: ### Describe the bug  The E2E harness initially installs Bub 0.4.2, but adding the ACP plugin can silently upgrade it to 0.5.0. The upgraded shell command path passes `command`, while `bub-acp-server==0.0.2` expects `cmd`. Native ACP shell execution then fails before reaching the terminal.  This affects the [E2E harness run on master b07c466f](https://github.com/oceanbase/powercontext/actions/runs/36729316752), including the [OceanBase acceptance job](https://github.com/oceanbase/powercontext/actions/runs/36729316752/job/110164147119). Its replay artifact declares `registry_entry_version: bub-0.4.2`, but the actual ACP handshake reports `agentInfo.version: 0.5.0`.  ### Steps to reproduce  On Linux with Python 3.12 and uv, use an isolated tool environment and an empty Bub project:  ```bash repro_dir="$(mktemp -d)" export UV_TOOL_BIN_DIR="$repro_dir/bin" export UV_TOOL_DIR="$repro_dir/tools" export BUB_HOME="$repro_dir/bub-home" export BUB_PROJECT="$repro_dir/bub-project" mkdir -p "$BUB_HOME" "$BUB_PROJECT" uv tool install 'bub==0.4.2' "$UV_TOOL_BIN_DIR/bub" install 'bub-acp-server==0.0.2' bub_python="$(dirname "$(readlink -f "$UV_TOOL_BIN_DIR/bub")")/python" "$bub_python" -c 'from importlib.metadata import version; print(version("bub"))' ```  The second installation resolves Bub to 0.5.0. Starting this environment's ACP server and sending a shell prompt such as `,printf acp-pin-ok` reproduces the argument error. The existing `failure-policy-timeout` scenario triggers it with `

- **Issue #1817** (2026-10-02): **bug: native parser worker fails to initialize RLIMIT_AS on macOS**
  *Symptoms*: ### Describe the bug  This issue was discovered while implementing and running local validation for #1789 (compact continuity hints). It affects the existing native code indexing implementation and is independent of the continuity-hint feature. The compatibility fix will be submitted in a separate PR.  The native code indexing capability (`powercontext.builtin.code`, RFC 1708 Native Git Code Understanding) starts an isolated parser worker. On the affected revision, the worker unconditionally sets an address-space limit at the beginning of `run()`:  ```python def run(manifest_path: Path) -> None:     import resource      job = json.loads(manifest_path.read_bytes())     memory = job["memory_bytes"]     resource.setrlimit(resource.RLIMIT_AS, (memory, memory)) ```  In the reproduced macOS environment, this call fails with:  ```text ValueError: current limit exceeds maximum limit ```  The worker's entry point catches `ValueError` and exits before emitting any progress line. The parent reads EOF from the worker's stdout, receives no completed files, and raises `CodeError("code_parser_failed")`.  The parent reports the worker's startup failure as the generic `code_parser_failed`, without exposing the underlying memory-limit initialization error. The worker's stderr is also discarded by `process._batch`.  As a result, index or sync operations that need to start a parser worker fail before parsing begins. They publish no new index and preserve any previously published index. Operation

- **Issue #1794** (2026-10-04): **bug: enforced access control: updating existing Topic Memory fails authorization and permanently blocks frontier**
  *Symptoms*: ### Describe the bug  After enabling `enforced` Access Control, Topic Memory background processing can create the first Topic revision, but fails authorization when updating an existing Topic to generate a new revision. After three consecutive failures, the same Source frontier enters `window_attempt_limit`. The Source Cursor stops advancing, all subsequent Sources are backlogged, and restarting the Server cannot auto-recover. The root cause is a design contradiction between the HTTP authorization layer and the background Worker authorization layer: the HTTP layer correctly treats Topic Memory as Scope-owned (skipping Artifact owner checks), but the Worker layer (`WorkerSecurity.topic_commit()`) still applies legacy Artifact owner authorization logic. When updating an existing Topic, the Worker calls `require(ARTIFACT_WRITE)`, which triggers `artifact_family_profile()` — but `topic-memory` is intentionally excluded from `ARTIFACT_FAMILY_PROFILES` because it is Scope-owned. This results in `AccessInvalidRequestError("artifact-family")`.   ### Steps to reproduce  1. Enable enforced Access Control: export POWERCONTEXT_SERVER_ACCESS_MODE=enforced export POWERCONTEXT_SERVER_AUTH_TOKEN=<your-token> 2. Enable Topic Memory background scheduling: export POWERCONTEXT_SERVER_RUNTIME_TOPIC_MEMORY_SCHEDULE_SECONDS=60 powercontext server run --env-file .env 3. Write Source(s) and wait for the background to create the first Topic Memory revision: Wait 60-120 seconds, then verify Topic Memor
  **Post-Mortem & Fix Analysis**:
  > I‘d like to take this.

- **Issue #1766** (2026-09-30): **bug: seekDB Writes Fail Due to aiomysql / PyMySQL Version Incompatibility**
  *Symptoms*: ### Describe the bug  After installing PowerContext with seekDB support from Git master, the Server starts normally and powercontext ready reports database: ready. However, all writes involving bytes/BLOB payloads — including Source capture — fail with TypeError: 'str' object is not callable. The root cause is that aiomysql 0.3.2 calls pymysql.escape_bytes_prefixed as a function, but PyMySQL 1.2.3 replaced it with the string sentinel "DO NOT IMPORT THIS!!!". The dependency resolver allows this combination because PyMySQL 1.2.3 satisfies all declared version constraints, but the packages are runtime-incompatible.  ### Steps to reproduce  1. Install PowerContext with seekDB support using the command above. 2. Configure seekDB backend in .env. 3. Start the Server:  powercontext server run --env-file .env 4. Check readiness:  powercontext ready runtime: ready database: ready 5. Write a Source via Codex Hook or Source capture API. 6. Check Server logs.  ### Expected behavior  1. Source and other BLOB/bytes payloads can be written to seekDB successfully. 2. Memory, Artifact processing, and other features depending on Source capture work normally. 3. If core write paths are unavailable, the database should not be reported as fully ready.  ### Actual behavior  Source write fails with: File "powercontext/builtin/persistence/sources.py", line 148, in add_with_status     await connection.execute(...)  File "aiomysql/cursors.py", line 197, in _escape_args     return tuple(conn.escape(arg
  **Post-Mortem & Fix Analysis**:
  > I'll take care of this problem. 

- **Issue #1762** (2026-09-28): **bug:  Old SQLite (3.26) reported as ready but Topic Memory publication fails with INSERT ... RETURNING syntax error**
  *Symptoms*: ### Describe the bug  PowerContext's Topic Memory vector index publication unconditionally uses INSERT ... RETURNING, a syntax only available since SQLite 3.35. However, the Server does not check the SQLite version at startup — it reports ready on SQLite 3.26, and the OperationalError only surfaces after Topic Memory has completed all model generation phases and enters the publication phase, wasting expensive LLM calls.  ### Steps to reproduce  1. Start PowerContext Server in a SQLite 3.26 environment. 2. Confirm /health/ready returns ready. 3. Let Topic Memory complete model generation and enter the publication phase. 4. Observe the Worker error. Alternatively, directly verify: sql INSERT INTO pc_topic_memory_vector_topics (...) VALUES (...) RETURNING vector_id;  ### Expected behavior  The Server should fail at startup (powercontext server run) or capability initialization when the SQLite version is insufficient — not waste model calls and fail only at Topic publication time.  ### Actual behavior  OperationalError: near "RETURNING": syntax error  The error occurs only after Topic Memory has completed all model generation phases and enters the vector index publication phase. The Server reported ready at startup and Topic Memory was reported as leader, so this failure is unexpected and wastes expensive LLM calls.  ### Environment  _No response_  ### Are you willing to submit a PR to fix this bug?  - [ ] Yes, I would like to submit a PR.
  **Post-Mortem & Fix Analysis**:
  > I'll take care of this problem.

- **Issue #1761** (2026-09-28): **bug: Topic Memory rejects Qwen enable_thinking: false via extra_body despite official docs recommending this configuration**
  *Symptoms*: ### Describe the bug  The official PowerContext documentation recommends closing Qwen's thinking mode via extra_body.chat_template_kwargs.enable_thinking: false. However, Topic Memory's provider settings validation rejects all extra_body, making this configuration incompatible with Topic Memory auto-scheduling. Users are caught in a contradiction: without the setting, Qwen thinking causes InferenceTimeoutError; with the setting, the Server refuses to start.  ### Steps to reproduce  1. Configure a Qwen generation model and enable Topic Memory auto-scheduling. 2. Start the Server without closing thinking → InferenceTimeoutError in topic_memory.global phase. 3. Increase generation timeout from 60s to 180s → problem persists. 4. Add the documented configuration: POWERCONTEXT_SERVER_INFERENCE_GENERATION_MODEL_SETTINGS='{"extra_body":{"chat_template_kwargs":{"enable_thinking":false}}}' 5. Restart the Server.  ### Expected behavior  Topic Memory should support a constrained, auditable way to close Qwen thinking while continuing to reject arbitrary, unconstrained extra_body fields.  ### Actual behavior  1. Configuration validation raises: BuiltinConfigurationError: Topic Memory workers require supported providers with transport retries disabled and bounded stateless model settings When the validation was bypassed and thinking was closed, Topic Memory successfully passed the probe, global, and subsequent model phases, entering the database publication phase.   ### Environment  _No res
  **Post-Mortem & Fix Analysis**:
  > I'll take care of this problem.

- **Issue #1757** (2026-10-01): **bug: Memory extraction permanently blocked after large Source window timeout — Worker retries identical window without shrinking or advancing Cursor**
  *Symptoms*: ### Describe the bug  Memory auto-processing splits Source windows by a fixed count (SOURCE_WINDOW_LIMIT=100). When a window exceeds the model's processing capacity within the configured timeout, the Worker continuously retries the exact same window — it neither shrinks the batch size nor advances the Cursor, permanently blocking all subsequent Sources for that Scope.  ### Steps to reproduce  1. Position the Memory Cursor where there are many pending Sources. 2. Configure: POWERCONTEXT_SERVER_RUNTIME_SOURCE_WINDOW_LIMIT=100 POWERCONTEXT_SERVER_INFERENCE_GENERATION_TIMEOUT_SECONDS=60 3. Start the Server and wait for Memory auto-scheduling. 4. Check processing metrics and Cursor position.    ### Expected behavior  A single window timeout should not permanently block the entire Scope. The processor should shrink the window or enter a clearly defined, recoverable failure state.  ### Actual behavior  Window size | Data volume | Result -- | -- | -- 97 Sources | ~74 KB | InferenceTimeoutError 15 Sources | ~9.7 KB | Still timeout 1 Source | ~548 bytes | Success in ~16 seconds Large window + max_tokens=2048 | — | Still timeout 1. Worker continuously retries the same window. 2. Memory Cursor stays at the original position. 3. New Sources cannot be processed — permanently blocked.   ### Environment  Item | Value Generation model | openai-chat:qwen3.8-max Generation timeout | 60 seconds Generation max requests | 2 Source window limit | 100 Database | SQLite    ### Are you willing to subm
  **Post-Mortem & Fix Analysis**:
  > I'll take care of this problem.  This is persistent head-of-line blocking in Memory processing within a single Scope, rather than a service-wide deadlock, and manual recovery is possible. 

- **Issue #1732** (2026-09-29): **bug: Codex MCP missing generate_skill tool — cannot generate Skill via origin=source in conversation**
  *Symptoms*: ### Describe the bug  The official docs describe three origins for Skill generation (experience, source, usage) and provide both CLI and HTTP API paths for all three. However, when using Codex conversation to generate a Skill with origin=source, the Agent reports that mcp__powercontext__generate_skill does not exist in the MCP tool registry. The only available generation path (create_dream_run / Dream Run) only accepts Experience Artifact references and does not support origin=source.  ### Steps to reproduce  1. Start Server with a Generation model configured. 2. Open a new Codex session, ensure PowerContext hooks are trusted. 3. Have a conversation that produces a Source (e.g., describe a deployment procedure). 4. Ask Codex to generate a Skill from the Source directly: plaintext 5. Generate a Skill candidate from the deployment Source we just discussed, using origin=source, skip Experience. 6. Observe the error: Codex reports mcp__powercontext__generate_skill is not available in the current tool registry.  ### Expected behavior  Codex MCP should expose a generate_skill tool (or equivalent) that supports all three origins documented in the official docs: 1. origin=experience — requires approved Experience Revision(s) 2. origin=source — requires precise Source reference(s), no Artifact references 3. origin=usage — requires target Skill Revision + usage Source  ### Actual behavior  1. mcp__powercontext__generate_skill is not available in the Codex MCP tool registry. 2. create_d
  **Post-Mortem & Fix Analysis**:
  > @jingtu666  This issue has been addressed by #1765, which has been merged into master. The MCP server now exposes generate_skill, supporting all three origins: experience, source, and usage. For origin=source, you can provide exact source_refs with an empty artifact_refs list, without creating an Experience first or using a Dream Run. We verified the MCP registration and request handling. The relevant tests pass, including an MCP transport test covering Source-based Skill generation, candidate approval, and reading back the resulting Skill revision. These tests use a deterministic generator rather than a live model.  The upcoming 1.2.0 version will address this issue. Please upgrade and restart the PowerContext service, and then restart the Codex session for it to take effect.  Please feel free to provide further feedback if generate_skill is still missing after updating~

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

### Incident Patch 1: `5fbd9186` (2026-10-05)
**Commit Message**: chore(authz): remove legacy topic-memory owner rows at startup (#1849)

* chore(authz): remove legacy topic-memory owner rows at startup

Topic Memory is Scope-owned and no read path has ever consulted an
Artifact owner relation, but the pre-#1794 Worker established one for
every newly created Topic. #1794 stopped writing them; rows persisted
by older versions remain as dead state.

Delete them once at startup while the access tables are open. The
predicate keeps owner_kind='artifact' so candidate attestations are
never matched.

Refs #1848

* fix(authz): move policy revision when removing legacy topic-memory owners

Owner rows feed the decision snapshot through list_owned_resources and
the owner-derived authorized resource filter, so removing them is a
relationship mutation: take the shared policy-head lock first and
increment the revision. Skip both when there is nothing to delete, so a
restart cannot invalidate outstanding signed cursors.

Also correct the claim that no read path consults these rows.

Refs #1848

**File**: `src/powercontext/server/authz/repository.py` (modified, +27/-0)
```diff
@@ -32,6 +32,7 @@
     Table,
     Text,
     UniqueConstraint,
+    delete,
     insert,
     or_,
     select,
@@ -558,6 +559,32 @@ async def get_candidate_owner(
             )
         return None if row is None else _decode_candidate_owner(row)
 
+    async def delete_legacy_topic_memory_owners(self) -> int:
+        """Drop Artifact owner rows retained for the Scope-owned Topic Memory family.
+
+        The pre-#1794 Worker established an owner for every newly created Topic.
+        Such a row is not inert: ``list_owned_resources`` reads it into the
+        decision snapshot, which feeds the owner-derived authorized resource
+        filter. Removing one therefore changes derived authorization and must
+        move the policy revision like every other relationship mutation, taking
+        the same policy-head lock first. Candidate attestations belong to other
+        families and are never matched.
+        """
+        stale = (
+            ACCESS_OWNERS_TABLE.c.owner_kind == "artifact",
+            ACCESS_OWNERS_TABLE.c.family == "topic-memory",
+        )
+        async with self._database.connection(self._bound_connection) as connection:
+            present = await connection.scalar(select(ACCESS_OWNERS_TABLE.c.object_key_hash).where(*stale).limit(1))
+            if present is None:
+                # Nothing to remove, so an ordinary restart must not churn the
+                # revision and stale every outstanding signed cursor.
+                return 0
+            # Same lock order as every other relationship write: policy head first.
+            await self._increment_policy_revision(connection)
+            result = await connection.execute(delete(ACCESS_OWNERS_TABLE).where(*stale))
+        return result.rowcount
+
     async def list_owned_resources(self, owner: PrincipalRef, /) -> tuple[ResourceRef, ...]:
         async with self._database.connection(self._bound_connection) as connection:
             rows = (
```

**File**: `src/powercontext/server/factory.py` (modified, +19/-0)
```diff
@@ -71,6 +71,7 @@
     access_control_for_mode,
 )
 from powercontext.server.authz.composition import open_builtin_access_control
+from powercontext.server.authz.repository import RelationalAccessRepository
 from powercontext.server.context import current_principal, current_request_id
 from powercontext.server.cursor_secret import resolve_cursor_secret
 from powercontext.server.dashboard import mount_dashboard
@@ -250,6 +251,7 @@ async def lifespan(app: FastAPI) -> AsyncIterator[None]:
                     "server.receipt_migration",
                     f"Receipt migration: {migrated} attested, {unresolved} pending in pc_receipt_migration_review",
                 )
+                await _remove_legacy_topic_owners(active_access_control)
             readiness_probe.bind(runtime)
             app.state.application = runtime
             app.state.access_control = active_access_control
@@ -368,6 +370,23 @@ def _bind_dream_access(access: DreamAccess | None, runtime: BuiltinRuntime) -> N
         access.bind(runtime)
 
 
+async def _remove_legacy_topic_owners(access: AccessControlService) -> None:
+    """Drop the Artifact owner rows older versions retained for Topic Memory.
+
+    Access tables are open only while a real service is configured, and a
+    deployment that ran an older version may still hold stale rows that the
+    owner-derived authorized resource filter reads back.
+    """
+    if not isinstance(access, AccessControlService):
+        return
+    relationships = access.relationships
+    if not isinstance(relationships, RelationalAccessRepository):
+        return
+    removed = await relationships.delete_legacy_topic_memory_owners()
+    if removed:
+        _log_lifecycle("server.topic_owner_cleanup", f"Removed {removed} legacy topic-memory Artifact owner rows")
+
+
 def _scheduled_access_runners(
     settings: ServerSettings,
     access: AccessControlService | None,
```

**File**: `tests/e2e/test_access_control_regressions.py` (modified, +48/-1)
```diff
@@ -27,12 +27,13 @@
 from powercontext.builtin.persistence.sqlite import SQLiteConfig
 from powercontext.builtin.runtime import InferenceConfig, RuntimeConfig
 from powercontext.server.authentication import AuthenticationResult, ProviderReadiness
-from powercontext.server.authz import AccessUnavailableError, PrincipalRef
+from powercontext.server.authz import AccessAuditContext, AccessUnavailableError, PrincipalRef, ResourceRef
 from powercontext.server.authz.composition import open_builtin_access_control, open_casbin_access_control
 from powercontext.server.factory import create_server_app
 from powercontext.server.settings import AccessControlConfig, McpConfig, MetricsConfig, ServerSettings
 
 ADMIN = PrincipalRef(type="service", id="admin")
+AUDIT = AccessAuditContext(transport="http", operation="test")
 
 
 class _Authentication:
@@ -790,6 +791,52 @@ async def missing(*args, **kwargs):
             }
 
 
+def test_startup_removes_legacy_topic_memory_owners_and_keeps_other_relations(tmp_path):
+    import sqlite3
+
+    async def seed():
+        async with _server(tmp_path) as (_, client, access):
+            scope_id = await _scope(client)
+            legacy = ResourceRef.artifact(scope_id, family="topic-memory", artifact_id="legacy-topic")
+            skill = ResourceRef.artifact(scope_id, family="skill", artifact_id="skill-a")
+            await access.establish_artifact_owner(legacy, ADMIN, idempotency_key="legacy-topic", context=AUDIT)
+            await access.establish_artifact_owner(skill, ADMIN, idempotency_key="skill-a", context=AUDIT)
+            await access.attest_candidate_owner(
+                scope_id=scope_id,
+                candidate_id="candidate-a",
+                family="experience",
+                proposed_owner=ADMIN,
+                target=None,
+                idempotency_key="candidate-a",
+            )
+
+    def relations():
+        with sqlite3.connect(tmp_path / "regressions.db") as connection:
+            return set(
+                connection.execute(
+                    "SELECT owner_kind, family, artifact_id, candidate_id FROM pc_access_owners"
+                ).fetchall()
+            )
+
+    asyncio.run(seed())
+    before = relations()
+    assert ("artifact", "topic-memory", "legacy-topic", None) in before
+
+    async def restart():
+        async with _server(tmp_path) as (_, client, _):
+            assert (await client.get("/v1/scopes")).status_code == 200
+
+    asyncio.run(restart())
+    after = relations()
+    assert ("artifact", "topic-memory", "legacy-topic", None) not in after
+    assert ("artifact", "skill", "skill-a", None) in after
+    assert ("candidate", "experience", None, "candidate-a") in after
+
+    # A later restart of an already-clean database changes nothing.
+    asyncio.run(restart())
+    assert relations() == after
+
+
 def test_generic_receipt_markers_cannot_block_source_collection(tmp_path):
     async def scenario():
         async with _server(tmp_path) as (app, client, _):
```

**File**: `tests/test_access_control.py` (modified, +37/-0)
```diff
@@ -623,3 +623,40 @@ async def scenario() -> None:
             assert await service.candidate_owner("scope-a", "same-id") == attestation
 
     asyncio.run(scenario())
+
+
+def test_legacy_topic_memory_owners_are_removed_without_touching_other_relations() -> None:
+    async def scenario() -> None:
+        async with open_builtin_access_control(SQLiteConfig(), bootstrap_administrators=(ADMIN,)) as service:
+            # The pre-#1794 Worker wrote an Artifact owner for the Scope-owned
+            # Topic Memory family; the owner-derived resource filter reads it back.
+            legacy = ResourceRef.artifact("scope-a", family="topic-memory", artifact_id="legacy-topic")
+            skill = ResourceRef.artifact("scope-a", family="skill", artifact_id="skill-a")
+            await service.establish_artifact_owner(legacy, ALICE, idempotency_key="legacy-topic", context=AUDIT)
+            await service.establish_artifact_owner(skill, ALICE, idempotency_key="skill-owner", context=AUDIT)
+            await service.attest_candidate_owner(
+                scope_id="scope-a",
+                candidate_id="candidate-a",
+                family="experience",
+                proposed_owner=ALICE,
+                target=None,
+                idempotency_key="candidate-owner-a",
+            )
+
+            relationships = service.relationships
+            assert isinstance(relationships, RelationalAccessRepository)
+            before = await relationships.policy_revision()
+            assert await relationships.delete_legacy_topic_memory_owners() == 1
+            # Ownership feeds the decision snapshot, so the deletion must move
+            # the revision that labels it.
+            assert await relationships.policy_revision() != before
+            assert await service.artifact_owner(legacy) is None
+            assert await service.artifact_owner(skill) is not None
+            assert await service.candidate_owner("scope-a", "candidate-a") is not None
+
+            clean = await relationships.policy_revision()
+            # A repeated run is a no-op: no deletion, and no revision churn.
+            assert await relationships.delete_legacy_topic_memory_owners() == 0
+            assert await relationships.policy_revision() == clean
+
+    asyncio.run(scenario())
```

---

### Incident Patch 2: `86537e4f` (2026-10-05)
**Commit Message**: build(deps): bump jdx/mise-action from 2.4.4 to 5.0.1 (#1852)

Bumps [jdx/mise-action](https://github.com/jdx/mise-action) from 2.4.4 to 5.0.1.
- [Release notes](https://github.com/jdx/mise-action/releases)
- [Changelog](https://github.com/jdx/mise-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/jdx/mise-action/compare/c37c93293d6b742fc901e1406b8f764f6fb19dac...7a4e45a543138629540c9a1616d08632b893e492)

---
updated-dependencies:
- dependency-name: jdx/mise-action
  dependency-version: 5.0.1
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/deploy-docs.yml` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ jobs:
         uses: ./.github/actions/setup-python-env
 
       - name: Set up website tools
-        uses: jdx/mise-action@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2
+        uses: jdx/mise-action@7a4e45a543138629540c9a1616d08632b893e492 # v5.0.1
 
       - name: Build website
         run: make docs-build
```

**File**: `.github/workflows/master.yml` (modified, +6/-6)
```diff
@@ -173,7 +173,7 @@ jobs:
         uses: ./.github/actions/setup-python-env
 
       - name: Set up project tools
-        uses: jdx/mise-action@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2
+        uses: jdx/mise-action@7a4e45a543138629540c9a1616d08632b893e492 # v5.0.1
 
       - name: Test DSH package
         run: make js-test
@@ -197,7 +197,7 @@ jobs:
         uses: ./.github/actions/setup-python-env
 
       - name: Set up project tools
-        uses: jdx/mise-action@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2
+        uses: jdx/mise-action@7a4e45a543138629540c9a1616d08632b893e492 # v5.0.1
 
       - name: Test Pi package
         run: make pi-test
@@ -215,7 +215,7 @@ jobs:
       - name: Set up the Python environment
         uses: ./.github/actions/setup-python-env
 
-      - uses: jdx/mise-action@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2
+      - uses: jdx/mise-action@7a4e45a543138629540c9a1616d08632b893e492 # v5.0.1
       - name: Test OpenCode package
         run: make opencode-test
 
@@ -232,7 +232,7 @@ jobs:
       - name: Set up the Python environment
         uses: ./.github/actions/setup-python-env
 
-      - uses: jdx/mise-action@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2
+      - uses: jdx/mise-action@7a4e45a543138629540c9a1616d08632b893e492 # v5.0.1
       # The pinned OpenClaw SDK requires the SQLite runtime shipped with Node 24.15+.
       - run: mise install node@24.15.0
       - name: Test OpenClaw package
@@ -269,7 +269,7 @@ jobs:
           persist-credentials: false
 
       - name: Set up website tools
-        uses: jdx/mise-action@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2
+        uses: jdx/mise-action@7a4e45a543138629540c9a1616d08632b893e492 # v5.0.1
 
       - name: Install website dependencies
         run: pnpm --dir website install --frozen-lockfile
@@ -290,7 +290,7 @@ jobs:
         uses: ./.github/actions/setup-python-env
 
       - name: Set up website tools
-        uses: jdx/mise-action@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2
+        uses: jdx/mise-action@7a4e45a543138629540c9a1616d08632b893e492 # v5.0.1
 
       - name: Check website
         run: make docs-test
```

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -56,7 +56,7 @@ jobs:
           PY
 
       - name: Set up website tools
-        uses: jdx/mise-action@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2
+        uses: jdx/mise-action@7a4e45a543138629540c9a1616d08632b893e492 # v5.0.1
 
       - name: Verify synchronized release references and release notes
         env:
@@ -142,7 +142,7 @@ jobs:
         uses: ./.github/actions/setup-python-env
 
       - name: Set up website tools
-        uses: jdx/mise-action@c37c93293d6b742fc901e1406b8f764f6fb19dac # v2
+        uses: jdx/mise-action@7a4e45a543138629540c9a1616d08632b893e492 # v5.0.1
 
       - name: Build website
         run: make docs-build
```

---

### Incident Patch 3: `5cf66be6` (2026-10-04)
**Commit Message**: fix(topic-memory): authorize background publication by Scope authority (#1847)

Topic Memory is shared Scope knowledge: it registers no Artifact Family
Access Profile and carries no per-topic owner. The processing Worker
still applied the legacy per-Artifact rules, so updating an existing
Topic called require(ARTIFACT_WRITE) on a topic-memory resource, which
the family registry rejects with AccessInvalidRequestError("artifact-family").
The publication rolled back before the Source Cursor advanced, three
attempts exhausted the window work budget, and the frontier stayed
terminal across restarts.

Authorize the whole batch with the Scope authority the Worker already
holds, and stop establishing per-topic owner relations for new Topics.

Refs #1794

**File**: `src/powercontext/server/processing_security.py` (modified, +8/-14)
```diff
@@ -200,20 +200,14 @@ async def profile_commit(
                 idempotency_key=f"candidate-owner:{scope_id}:{candidate.candidate_id}",
             )
 
-    async def topic_commit(self, connection: AsyncConnection, scope_id: str, operations: Sequence[Any]) -> None:
-        bound = self.access.with_connection(connection)
-        await self._authorize_scope(bound, scope_id)
-        for operation in operations:
-            resource = ResourceRef.artifact(scope_id, family="topic-memory", artifact_id=operation.artifact_id)
-            if operation.current is not None:
-                await bound.require(self.principal, AccessAction.ARTIFACT_WRITE, resource, context=self.context)
-            else:
-                await bound.establish_artifact_owner(
-                    resource,
-                    self.principal,
-                    idempotency_key=f"background-topic-owner:{scope_id}:{operation.artifact_id}",
-                    context=self.context,
-                )
+    async def topic_commit(self, connection: AsyncConnection, scope_id: str, _operations: Sequence[Any]) -> None:
+        """Authorize one Scope-owned Topic Memory publication.
+
+        Topic Memory is shared Scope knowledge: it registers no Artifact Family
+        Access Profile and carries no per-topic owner, so its publications are
+        authorized by Scope authority alone. The batch is accepted unchanged.
+        """
+        await self._authorize_scope(self.access.with_connection(connection), scope_id)
 
 
 @asynccontextmanager
```

**File**: `tests/builtin/runtime/test_topic_memory_security.py` (modified, +155/-29)
```diff
@@ -12,7 +12,7 @@
 # See the License for the specific language governing permissions and
 # limitations under the License.
 
-"""Topic publication, Server ownership, and accepted request completion are atomic."""
+"""Topic publication, Scope authorization, and accepted request completion are atomic."""
 
 from __future__ import annotations
 
@@ -21,7 +21,12 @@
 import pytest
 from sqlalchemy import func, select
 
-from powercontext.builtin.artifacts.topic_memory import TOPIC_MEMORY_SOURCE_WINDOW_BINDING, TopicMemoryContent
+from powercontext.builtin.artifacts.topic_memory import (
+    TOPIC_MEMORY_SOURCE_WINDOW_BINDING,
+    TopicMemoryContent,
+    TopicMemoryDraft,
+    prepare_topic_memory_projection,
+)
 from powercontext.builtin.artifacts.topic_memory.generation import (
     TopicMemoryGlobalOutput,
     TopicMemoryProbe,
@@ -51,25 +56,28 @@
     ArtifactProcessingWorkerOutcome,
 )
 from powercontext.builtin.runtime.topic_memory_processing import (
+    ArtifactProcessingWaveKind,
     TopicMemoryAtomicPublisher,
     TopicMemoryProcessor,
+    TopicMemoryWindowAssignment,
     TopicMemoryWindowSelector,
 )
 from powercontext.builtin.runtime.topic_memory_scope import TopicMemoryScopeProcessor
-from powercontext.server.authz import PrincipalRef
+from powercontext.builtin.sources import SourceCursor
+from powercontext.server.authz import AccessAction, PrincipalRef
 from powercontext.server.authz.repository import ACCESS_AUDIT_EVENTS_TABLE, ACCESS_OWNERS_TABLE, ACCESS_TABLES
 from powercontext.server.processing_security import WorkerSecuritySpec, open_worker_security
 from powercontext.sources import SourceMaterialization
 from tests.builtin.persistence.contract import SOURCE_ADAPTERS, NoteSource
-from tests.builtin.runtime.test_topic_memory_processing import _stages
+from tests.builtin.runtime.test_topic_memory_processing import _content, _stages
 
 BINDING = TOPIC_MEMORY_SOURCE_WINDOW_BINDING
 SCOPE = "topic-security-scope"
-TOPIC_ID = "owned-topic"
+TOPIC_ID = "shared-topic"
 
 
-@pytest.mark.parametrize("failure_boundary", ["owner", "acknowledgement"])
-def test_real_topic_owner_and_publication_roll_back_then_same_generation_retry_succeeds(tmp_path, failure_boundary):
+@pytest.mark.parametrize("failure_boundary", ["authorization", "acknowledgement"])
+def test_scope_authorized_topic_publication_rolls_back_then_same_generation_retry_succeeds(tmp_path, failure_boundary):
     async def scenario():
         index = CompositeTopicMemoryIndex(SQLiteTopicMemoryFTSIndex())
         topics = TopicMemoryRepository(index=index)
@@ -82,14 +90,14 @@ async def scenario():
                     connection,
                     SCOPE,
                     NoteSource(
-                        name="ownership-source", materialization=SourceMaterialization.CAPTURED, body="Verified topic"
+                        name="scope-source", materialization=SourceMaterialization.CAPTURED, body="Verified topic"
                     ),
                 )
                 pending = ArtifactProcessingPendingRepository()
                 await pending.raise_source(connection, SCOPE, BINDING, source.journal_position)
                 await pending.request_flush(connection, SCOPE, BINDING)
                 intent = await ArtifactProcessingIntentRepository().request(connection, SCOPE, BINDING)
-                term = await ArtifactProcessingLeaseRepository().start_single_process_term(connection, "topic-owner")
+                term = await ArtifactProcessingLeaseRepository().start_single_process_term(connection, "topic-worker")
             assignment = ArtifactProcessingWorkAssignment(
                 BINDING, SCOPE, "topic-memory", intent.requested_generation, term.fence("single-process"), "worker-1"
             )
@@ -133,26 +141,40 @@ def processor(commit_authorizer):
             ).model_dump(mode="json")
             async with open_worker_security(spec, profile.database) as security:
                 assert security is not None
-                owner_hook_calls = 0
+                authorization_calls = 0
 
-                async def owner_commit(connection, scope_id, operations):
-                    nonlocal owner_hook_calls
+                async def scope_commit(connection, scope_id, operations):
+                    nonlocal authorization_calls
                     await security.topic_commit(connection, scope_id, operations)
-                    owner_hook_calls += 1
+                    authorization_calls += 1
                     assert len(operations) == 1 and operations[0].artifact_id == TOPIC_ID
-                    assert await connection.scalar(select(func.count()).select_from(ACCESS_OWNERS_TABLE)) == 1
+                    # Scope-owned knowledge carries no per-topic Artifact owner.
+                    assert await connection.scalar(select(func.count()).select_from(ACCESS_OWNERS_TABLE)) == 0
                     assert (
                         await connection.scalar(
                             select(func.
```

---

### Incident Patch 4: `5be51f95` (2026-10-04)
**Commit Message**: fix(e2e): give the usage-record observation window the recorder's budget (#1846)

The two tests that wait for a stalled usage write to commit observe the
database through a hardcoded five-second window while configuring the
recorder with a thirty-second write budget. A record that consumes its
whole budget commits late but still commits; a window smaller than the
budget reports that late commit as a wedged runtime. On loaded CI
runners the write itself can outlast five seconds, so these tests fail
intermittently on a healthy runtime and the red leg rotates between
Python versions.

Anchor the observation window to the write budget (budget + five-second
margin) so the test only fails when the record is genuinely lost, which
the recorder's own retry logic already treats as a real defect.

Verified locally: with body delays of 6s and 12s against a 30s budget,
the old 5s window fails both cases while the budget-aligned window
commits and passes; 920+ repetitions of the cancellation scenario under
concurrency pass with no observation-window failures.

**File**: `tests/e2e/test_topic_memory_generic_api.py` (modified, +8/-4)
```diff
@@ -107,17 +107,21 @@ def _topic_embedding_requests(database, scope=None):
         return connection.execute(query, parameters).fetchone()[0]
 
 
-async def _await_usage_record(database, scope):
+async def _await_usage_record(database, scope, write_budget):
     """Wait until the scope's usage row is visible.
 
     A visible row means the recorder's transaction committed, so it no longer
     holds SQLite's write lock. A later write that upgrades from a read does not
     consult the busy handler and fails immediately instead of waiting, so a
     health check issued while that write is still in flight measures contention
     rather than the runtime's health.
+
+    The window must exceed the recorder's own write budget: a record that
+    consumes its whole budget commits late but still commits, and a window
+    smaller than the budget would report a healthy runtime as wedged.
     """
 
-    async with asyncio.timeout(5):
+    async with asyncio.timeout(write_budget + 5):
         while _topic_embedding_requests(database, scope) == 0:  # noqa: ASYNC110 - bounded observation of committed database state
             await asyncio.sleep(0.02)
 
@@ -465,7 +469,7 @@ async def stalled_record(repository, connection, *args):
                 assert await asyncio.wait_for(entered.wait(), 5)
                 release.set()
             assert len((await client.get(path + "/topic-memory")).json()["items"]) == 1
-            await _await_usage_record(tmp_path / "topics.db", scope)
+            await _await_usage_record(tmp_path / "topics.db", scope, 30.0)
             assert (await client.post(path, json=payload)).status_code == 201
 
     asyncio.run(scenario())
@@ -594,7 +598,7 @@ async def stalled_record(repository, connection, *args):
                 with pytest.raises(asyncio.CancelledError):
                     await pending
                 release.set()
-            await _await_usage_record(tmp_path / "topics.db", scope)
+            await _await_usage_record(tmp_path / "topics.db", scope, 30.0)
             assert (await client.post(path, json=payload)).status_code == 201
 
     asyncio.run(scenario())
```

---

### Incident Patch 5: `eb1cd50a` (2026-10-04)
**Commit Message**: build(deps): bump brace-expansion (#1845)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 2.1.4 to 2.1.7.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v2.1.4...v2.1.7)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 2.1.7
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `integrations/opencode/plugins/powercontext/pnpm-lock.yaml` (modified, +4/-4)
```diff
@@ -913,8 +913,8 @@ packages:
   birpc@4.2.0:
     resolution: {integrity: sha512-KxgKcZPfrtzJDDALHPguGpGJUrzdgpymyiQQgzFjWreHMOpWrnFNVREr5J48x2DBh8ZVioscrV1SBkDipGiX+Q==}
 
-  brace-expansion@2.1.4:
-    resolution: {integrity: sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==}
+  brace-expansion@2.1.7:
+    resolution: {integrity: sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g==}
 
   browserslist@4.28.8:
     resolution: {integrity: sha512-V2NpofLblG64mfOtSgDhOJESZEGogzDMBv/q+W6oc4LXWP/q75eOXoOaaOu1EOadB9U4Bwx/e0yzbvwKH8zalA==}
@@ -2259,7 +2259,7 @@ snapshots:
 
   birpc@4.2.0: {}
 
-  brace-expansion@2.1.4:
+  brace-expansion@2.1.7:
     dependencies:
       balanced-match: 1.0.2
 
@@ -2471,7 +2471,7 @@ snapshots:
 
   minimatch@8.0.7:
     dependencies:
-      brace-expansion: 2.1.4
+      brace-expansion: 2.1.7
 
   minipass@4.2.8: {}
 
```

---

### Incident Patch 6: `74a846bc` (2026-10-04)
**Commit Message**: build(deps): bump pyjwt from 2.13.0 to 2.15.0 in /e2e/bub (#1844)

Bumps [pyjwt](https://github.com/jpadilla/pyjwt) from 2.13.0 to 2.15.0.
- [Release notes](https://github.com/jpadilla/pyjwt/releases)
- [Changelog](https://github.com/jpadilla/pyjwt/blob/master/CHANGELOG.rst)
- [Commits](https://github.com/jpadilla/pyjwt/compare/2.13.0...2.15.0)

---
updated-dependencies:
- dependency-name: pyjwt
  dependency-version: 2.15.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `e2e/bub/uv.lock` (modified, +3/-3)
```diff
@@ -2043,11 +2043,11 @@ wheels = [
 
 [[package]]
 name = "pyjwt"
-version = "2.13.0"
+version = "2.15.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz", hash = "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423", size = 107515, upload-time = "2026-05-21T19:54:36.618Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/02/a5/5197bfd06417837ac079921c66fa6393f1dea3557272a263cebfef69e432/pyjwt-2.15.0.tar.gz", hash = "sha256:b11c5f9791d7bf51c2b39a81ed669f6b2dbbd669df2942f6c60167e9e3d1abe4", size = 120513, upload-time = "2026-09-23T16:56:00.689Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl", hash = "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728", size = 31274, upload-time = "2026-05-21T19:54:35.362Z" },
+    { url = "https://files.pythonhosted.org/packages/e8/55/40e45bf052ee8ee12a4dfd785519660f8effa7b065442b91646ec6828619/pyjwt-2.15.0-py3-none-any.whl", hash = "sha256:7a3742debf6b879e912dbb9819ceec1594be812452b78c5f2e2dfc56564954f8", size = 33680, upload-time = "2026-09-23T16:55:59.241Z" },
 ]
 
 [package.optional-dependencies]
```

---

### Incident Patch 7: `d6dad819` (2026-10-04)
**Commit Message**: build(deps): bump urllib3 from 2.7.0 to 2.8.0 in /e2e/bub (#1843)

Bumps [urllib3](https://github.com/urllib3/urllib3) from 2.7.0 to 2.8.0.
- [Release notes](https://github.com/urllib3/urllib3/releases)
- [Changelog](https://github.com/urllib3/urllib3/blob/main/CHANGES.rst)
- [Commits](https://github.com/urllib3/urllib3/compare/2.7.0...2.8.0)

---
updated-dependencies:
- dependency-name: urllib3
  dependency-version: 2.8.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `e2e/bub/uv.lock` (modified, +3/-3)
```diff
@@ -2781,11 +2781,11 @@ wheels = [
 
 [[package]]
 name = "urllib3"
-version = "2.7.0"
+version = "2.8.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz", hash = "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c", size = 433602, upload-time = "2026-05-07T16:13:18.596Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz", hash = "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63", size = 458972, upload-time = "2026-09-15T19:29:36.253Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl", hash = "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897", size = 131087, upload-time = "2026-05-07T16:13:17.151Z" },
+    { url = "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl", hash = "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3", size = 135717, upload-time = "2026-09-15T19:29:34.577Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 8: `ba7dc8dd` (2026-10-03)
**Commit Message**: Fix/model usage attempt expiry (#1838)

* fix(usage): repeat an attempt that expired before its body committed

One record's budget is spent in fixed slices, but the check that ends a slice
runs *after* the body. A write whose body outlived its slice had those
statements rolled back and the record dropped, even though the record still
owned most of its budget and `_write` repeats only a lost race, never an
expired attempt. A slow machine therefore loses a record the runtime already
accepted: the row never becomes visible, so the request cancellation e2e test
waits out its budget for a row that can no longer appear.

An expiry before the body commits is the same rollback-safe shape as a lost
race, so it now raises `ModelUsageAttemptExpired` -- a `TimeoutError`, so
existing callers and budgets keep their meaning -- and is repeated while the
record has budget left. Shutdown keeps the previous behaviour, because
`close()` has already dropped the backlog and waits one write window, so a
repeat cannot be counted on there. An expiry that may have raced a commit
stays a plain `TimeoutError` and is still never repeated, so usage cannot be
counted twice.

* fix(usage): keep an accepted write

**File**: `src/powercontext/builtin/persistence/database.py` (modified, +40/-5)
```diff
@@ -32,6 +32,32 @@
 SELECTION_BATCH_SIZE = 500
 
 
+class ModelUsageAttemptExpired(TimeoutError):
+    """A usage attempt stopped before its body could commit.
+
+    Raised only where the record cannot have been applied, which is the same
+    rollback-safe shape as a lost race: the recorder may spend more of the same
+    record budget on another attempt. A deadline that may have raced a commit
+    stays a plain ``TimeoutError``, because repeating that one could count the
+    same usage twice.
+    """
+
+
+@asynccontextmanager
+async def _expiring(deadline: float) -> AsyncIterator[None]:
+    """Bound a step that cannot have applied anything when it expires.
+
+    Guard acquisition and checkout run before the body, so an expired step
+    leaves the record unapplied and worth another attempt within its budget.
+    """
+
+    try:
+        async with asyncio.timeout_at(deadline):
+            yield
+    except TimeoutError as error:
+        raise ModelUsageAttemptExpired from error
+
+
 class AsyncDatabase:
     """Own or attach to one SQLAlchemy async engine.
 
@@ -111,7 +137,9 @@ async def _model_usage_transaction(self, timeout_seconds: float) -> AsyncIterato
 
         Only the recorder's separate consumer task calls this method. SQLite SQL
         is interrupted natively, not by cancelling SQLAlchemy (which invalidates
-        its connection and destroys a StaticPool's in-memory database).
+        its connection and destroys a StaticPool's in-memory database). A step
+        that expires before the body commits raises ``ModelUsageAttemptExpired``
+        so the recorder can repeat the attempt inside the same record budget.
         """
 
         deadline = asyncio.get_running_loop().time() + timeout_seconds
@@ -124,15 +152,15 @@ async def _model_usage_transaction(self, timeout_seconds: float) -> AsyncIterato
         try:
             if guard is not None:
                 # Cancellation is safe here: no driver operation has started.
-                async with asyncio.timeout_at(deadline):
+                async with _expiring(deadline):
                     await guard.acquire()
                 acquired = True
             connection = self._engine.connect()
             try:
                 # Pool timeout only bounds waiting for a slot, not pre-ping or
                 # the driver's handshake. SQLAlchemy returns an interrupted
                 # checkout to the pool; aiomysql closes cancelled socket reads.
-                async with asyncio.timeout_at(deadline):
+                async with _expiring(deadline):
                     await connection.start()
                 if connection.dialect.name == "sqlite":
                     async with _sqlite_model_usage_transaction(connection, deadline):
@@ -203,6 +231,8 @@ async def _sqlite_model_usage_transaction(connection: AsyncConnection, deadline:
     loop = asyncio.get_running_loop()
     remaining = deadline - loop.time()
     if remaining <= 0:
+        # The record's budget was already gone when this attempt started, so
+        # there is nothing left to repeat it with.
         raise TimeoutError
     # The worker thread uses a monotonic clock, not the event loop's clock API.
     stop_at = time.monotonic() + remaining
@@ -242,13 +272,18 @@ def _past_deadline() -> int:
         timer = loop.call_at(deadline, driver._conn.interrupt)
         async with connection.begin():
             if loop.time() >= deadline:
-                raise TimeoutError
+                raise ModelUsageAttemptExpired
             # sqlite3's legacy mode does not begin a transaction for SELECT.
             # Include the Scope existence read in the write's actual snapshot.
             await connection.exec_driver_sql("BEGIN")
             yield
+            # The body is done, but the attempt may have outlived its slice. The
+            # statements are still uncommitted, so stopping here applies nothing
+            # and costs the record its usage; the native timer above, not this
+            # check, is what bounds work in progress. Expire as a repeatable
+            # attempt and let the recorder spend the rest of the record budget.
             if loop.time() >= deadline:
-                raise TimeoutError
+                raise ModelUsageAttemptExpired
         # busy_timeout stays bounded through COMMIT and any automatic ROLLBACK.
     finally:
         if timer is not None:
```

**File**: `src/powercontext/builtin/runtime/_model_usage.py` (modified, +44/-12)
```diff
@@ -27,7 +27,11 @@
 
 from powercontext._logging import log_safely
 from powercontext.builtin.inference import InferenceUsage
-from powercontext.builtin.persistence.database import AsyncDatabase, is_transaction_contention
+from powercontext.builtin.persistence.database import (
+    AsyncDatabase,
+    ModelUsageAttemptExpired,
+    is_transaction_contention,
+)
 from powercontext.builtin.persistence.statistics import StatisticsRepository
 from powercontext.builtin.persistence.tables import SCOPES_TABLE
 from powercontext.builtin.statistics import ModelUsageOperation, ModelUsagePurpose
@@ -66,8 +70,9 @@ class _ModelUsageRecorder:
     """Offer without I/O; serialize independent writes on one owned consumer.
 
     Checkpoints identify accepted records, not successful writes. A failed or
-    indeterminate transaction is settled once and is never retried. This is
-    deliberately lossy telemetry, not an authoritative billing ledger.
+    indeterminate transaction is settled once and is never retried; only a
+    failure that provably applied nothing is repeated inside the same budget.
+    This is deliberately lossy telemetry, not an authoritative billing ledger.
     """
 
     def __init__(
@@ -180,7 +185,10 @@ async def _consume(self) -> None:
                     continue
                 sequence, record = self._pending.popleft()
                 try:
-                    await self._write(record)
+                    # The record is already accepted, so it must survive whoever
+                    # cancels this consumer: nothing else will ever retry it, and
+                    # `_settle` reports it as settled either way.
+                    await asyncio.shield(self._write(record))
                 except Exception:
                     log_safely(_LOGGER, logging.WARNING, "Model usage write failed; record will not be retried")
                 finally:
@@ -194,23 +202,34 @@ async def _write(self, record: _ModelUsageRecord) -> None:
         """Write one record, retrying only a failure that rolled back cleanly.
 
         A busy or conflict error leaves nothing applied, so repeating it cannot
-        double count and is worth the rest of this record's budget. Any other
-        failure may have committed with an unknown outcome and is never retried.
+        double count and is worth the rest of this record's budget. An attempt
+        that expired before its body committed is the same shape and is worth the
+        same: a slow body must be allowed to finish rather than take the record's
+        usage with it. Any other failure may have committed with an unknown
+        outcome and is never retried.
         """
 
         loop = asyncio.get_running_loop()
         deadline = loop.time() + self._write_timeout_seconds
-        # A fixed slice per attempt rather than a re-sliced remainder, so one
-        # attempt that really does wait cannot consume the whole budget. Contended
-        # attempts normally return immediately, so the backoff interval, not this
-        # slice, is what decides how many attempts fit inside the deadline.
+        # The first attempt gets a fixed slice rather than the whole budget, so
+        # one attempt that really does wait cannot consume all of it before any
+        # repeat happens. Contended attempts normally return immediately, so the
+        # backoff interval, not this slice, is what decides how many attempts fit
+        # inside the deadline.
         attempt_timeout = max(self._write_timeout_seconds / _WRITE_ATTEMPT_SLICES, _MIN_WRITE_ATTEMPT_SECONDS)
+        # Every repeat gets what the record has left. Repeating is only reached
+        # once a slice-sized attempt has already failed, and that failure is the
+        # evidence that a slice is not what this record needs: handing the repeat
+        # the same slice reaches the same wall and drops a record that still owns
+        # most of its budget. The budget, not the slice, is what bounds the total.
+        first_attempt = True
         while True:
             remaining = deadline - loop.time()
             if remaining <= 0:
                 raise TimeoutError
+            allowance = attempt_timeout if first_attempt else remaining
             try:
-                async with self._database._model_usage_transaction(min(remaining, attempt_timeout)) as connection:
+                async with self._database._model_usage_transaction(min(remaining, allowance)) as connection:
                     # Lock the Scope row on MySQL so delete cannot race the
                     # increment. SQLite ignores FOR UPDATE; its real snapshot
                     # makes a competing delete fail the write upgrade instead.
@@ -231,7 +250,20 @@ async def _write(self, record: _ModelUsageRecord) -> None:
             except OperationalError as error:
                 if not is_transaction_contention(error):
                     raise
-                # Let the competing writer finish before taking another slice
```

**File**: `tests/builtin/runtime/test_model_usage_recorder.py` (modified, +170/-1)
```diff
@@ -27,12 +27,13 @@
 import pytest
 from aiosqlite import Connection as SQLiteConnection
 from sqlalchemy import delete, event, insert, select, update
+from sqlalchemy.exc import OperationalError
 from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine
 from sqlalchemy.pool import QueuePool
 from sqlalchemy.util import await_only
 
 from powercontext.builtin.inference import InferenceUsage
-from powercontext.builtin.persistence.database import AsyncDatabase
+from powercontext.builtin.persistence.database import AsyncDatabase, ModelUsageAttemptExpired
 from powercontext.builtin.persistence.sqlite import SQLiteConfig, SQLiteProfile
 from powercontext.builtin.persistence.statistics import StatisticsRepository, StoredModelUsage
 from powercontext.builtin.persistence.tables import MODEL_USAGE_DAILY_TABLE, SCOPES_TABLE
@@ -232,6 +233,174 @@ async def release_later() -> None:
     asyncio.run(scenario())
 
 
+def test_an_attempt_that_expires_at_checkout_is_repeated(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
+    """An expired attempt applied nothing, so the record keeps its budget."""
+
+    async def scenario() -> None:
+        config = SQLiteConfig(url=f"sqlite+aiosqlite:///{tmp_path / 'slow-checkout.db'}")
+        async with _database(config) as database:
+            starts = 0
+            original_start = AsyncConnection.start
+
+            async def start(connection: AsyncConnection, is_ctxmanager: bool = False) -> AsyncConnection:
+                nonlocal starts
+                starts += 1
+                if starts == 1:
+                    # Outlive the whole slice without starting driver work, so
+                    # the attempt expires with nothing applied.
+                    await asyncio.sleep(0.08)
+                return await original_start(connection, is_ctxmanager)
+
+            monkeypatch.setattr(AsyncConnection, "start", start)
+            recorder = _ModelUsageRecorder(database, StatisticsRepository(), write_timeout_seconds=0.2)
+            try:
+                _offer(recorder)
+                await recorder.flush()
+                assert starts > 1
+                assert (await _rows(database))[0].requests == 1
+                await _assert_connection_restored(database)
+            finally:
+                await recorder.close()
+
+    asyncio.run(scenario())
+
+
+class _SlowBodyRepository(StatisticsRepository):
+    """Make the first write outlive its slice without leaving the event loop."""
+
+    def __init__(self, *, delay: float) -> None:
+        self.delay = delay
+        self.calls = 0
+
+    async def record(
+        self,
+        connection: AsyncConnection,
+        scope_id: str,
+        usage_date: date,
+        purpose: ModelUsagePurpose,
+        operation: ModelUsageOperation,
+        usage: InferenceUsage,
+        /,
+    ) -> None:
+        self.calls += 1
+        if self.calls == 1:
+            await asyncio.sleep(self.delay)
+        await super().record(connection, scope_id, usage_date, purpose, operation, usage)
+
+
+def test_a_body_that_outlives_its_slice_is_repeated_not_dropped(tmp_path: Path) -> None:
+    """A body that finishes after its own slice still records.
+
+    The deadline check runs after the body, so on its own it can only discard
+    work that is already done. A released usage write must not depend on the
+    release landing inside one slice, which is what the stalled-request e2e test
+    asserts when it waits for a visible row on a loaded machine.
+    """
+
+    async def scenario() -> None:
+        config = SQLiteConfig(url=f"sqlite+aiosqlite:///{tmp_path / 'late-body.db'}")
+        async with _database(config) as database:
+            # One record's 0.2s budget is spent in 0.05s slices, so a 0.08s body
+            # outlives the attempt that owns it while the record owns budget.
+            repository = _SlowBodyRepository(delay=0.08)
+            recorder = _ModelUsageRecorder(database, repository, write_timeout_seconds=0.2)
+            try:
+                _offer(recorder)
+                await recorder.flush()
+                assert repository.calls == 2
+                assert (await _rows(database))[0].requests == 1
+                await _assert_connection_restored(database)
+            finally:
+                await recorder.close()
+
+    asyncio.run(scenario())
+
+
+def test_a_repeat_after_an_expiry_gets_the_rest_of_the_budget(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
+    """A slice bounds a wait; a body slower than every slice must not be dropped.
+
+    The first attempt is sliced, so a slow body expires it. Handing the repeat
+    the same slice only reaches the same wall, which is how a loaded machine
+    loses a record that still owns most of its budget; the repeat has to spend
+    what the record has left.
+    """
+
+    async def scenario() -> None:
+        config = SQLiteConfig(url=f"sqlite+aiosqlite:///{tmp_path / 'rest-of-budget.db'}")

```

---

### Incident Patch 9: `6b2f6e8a` (2026-10-03)
**Commit Message**: fix(e2e): keep PowerContext out of the OFF arm (#1816)

* feat(bub): authenticate to a Server that requires a token

The Bub plugin opened its PowerContext client without a token, so it
could not work with a Server whose access mode is enforced; the other
host integrations already send their credential. POWERCONTEXT_BUB_API_TOKEN
now reaches the client that the hooks and the tools open, in both the
default and the vouched transport. The token stays a SecretStr in Bub's
turn state, so it is not rendered with the state.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(e2e): keep PowerContext out of the OFF arm

The OFF arm should be the host as a user without PowerContext has it, but
its agent could find PowerContext: Codex and Claude Code installed the
plugin and disabled it, every host mounted PowerContext sources in both
arms, and both arms' containers can reach the pilot Server, which keeps
earlier trials' ON Memory. In an OpenCode pilot, GLM-5.3 OFF agents read
the mounted plugin, tried to reach the Server six times, and opened the
host's own session store while looking for the earlier session.

The OFF arm now installs no integration and mounts no PowerContext
sources

**File**: `e2e/bub/README.md` (modified, +34/-16)
```diff
@@ -157,16 +157,25 @@ this for `--trials` trials. The arm that runs first alternates between trials. `
 both arms: `bub` by default, `codex`, or `claude-code`. Each host uses its own PowerContext integration, so ON means
 what that integration does for its users.
 
-- OFF passes no `POWERCONTEXT_*` settings to the agent. Bub is installed without its PowerContext plugin. Codex has
-  the PowerContext plugin installed but runs with `--disable plugins`, as in the published SWE-bench Pro protocol.
-  Claude Code has the plugin installed and then disabled with `claude plugin disable`.
-- ON binds the integration to a new Scope. For Bub this means the plugin with `capture_events` enabled, so that, like
-  the other host integrations, it captures what the user says without relying on the model to call a memory tool.
-  This is not the plugin's default setting. Codex runs with `--enable plugins`, and Claude Code keeps the plugin
-  enabled: in both, a hook captures each user prompt and asks for context before each turn, and the plugin's MCP
-  tools and Skill are available to the model.
+- OFF is the host as a user without PowerContext has it. The agent is not told that PowerContext is off, and it
+  cannot find PowerContext: no integration is installed, no PowerContext sources are mounted in its container, and it
+  gets no `POWERCONTEXT_*` settings or Server credential. Continuation tasks ask about earlier sessions, and agents
+  that find PowerContext files go looking for it. For Codex this differs from the published SWE-bench Pro protocol,
+  whose OFF arm has the plugin installed and runs with `--disable plugins`.
+- ON installs the integration, binds it to a new Scope, and gives it the harness Client's Server token. For Bub this
+  means the plugin with `capture_events` enabled, so that, like the other host integrations, it captures what the
+  user says without relying on the model to call a memory tool. This is not the plugin's default setting. Codex runs
+  with `--enable plugins`, and Claude Code has the plugin enabled: in both, a hook captures each user prompt and asks
+  for context before each turn, and the plugin's MCP tools and Skill are available to the model.
 - Everything else is the same in both arms: image, host version, model, reasoning settings, and budget.
 
+Both arms' containers can reach the Server, and the Server keeps the ON arms' Memory across trials. The command
+therefore runs only against a Server that requires authentication: it stops before the first run if the Server lists
+its Scopes to a client without a token. Start the Server with `POWERCONTEXT_SERVER_ACCESS_MODE=enforced` and a
+`POWERCONTEXT_SERVER_AUTH_TOKEN`, and give the harness the same value as `POWERCONTEXT_CLIENT_API_TOKEN`; the harness
+passes it to the ON arm's integration as `POWERCONTEXT_BUB_API_TOKEN` or `POWERCONTEXT_<HOST>_AUTHORIZATION`. The
+token still lets an ON agent read other Scopes on the same Server, including earlier trials'.
+
 After each ON session the harness records the Scope's Server statistics. When another session follows, it first
 flushes the Scope, standing in for the time that passes between real sessions, and repeats the flush until the Scope
 has processed every captured Source, a flush makes no progress, or 20 rounds pass. This runs from a Harbor agent-end
@@ -186,8 +195,15 @@ differences. An agent timeout counts as a failed attempt in either arm.
 The harness Client waits for each flush, which runs the Server's generation model, so raise its 10-second default
 timeout; the Bub plugin also flushes during a session.
 
+```bash
+export POWERCONTEXT_SERVER_ACCESS_MODE=enforced
+export POWERCONTEXT_SERVER_AUTH_TOKEN=replace-me
+powercontext server run  # in another shell, with the Server's inference settings
+```
+
 ```bash
 export POWERCONTEXT_CLIENT_SERVER_URL=http://127.0.0.1:8000
+export POWERCONTEXT_CLIENT_API_TOKEN=replace-me
 export POWERCONTEXT_CLIENT_TIMEOUT=150
 export POWERCONTEXT_BUB_BASE_URL=http://host-gateway:8000
 export POWERCONTEXT_BUB_TIMEOUT=150
@@ -198,7 +214,7 @@ make harness-paired ARGS='--trials 2'
 ```
 
 Codex 0.153.4 runs through Harbor's Codex agent. The plugin reads its Server URL only from its installed
-`.mcp.json`, so the harness writes `POWERCONTEXT_CODEX_SERVER_URL` there before each session, as
+`.mcp.json`, so the harness writes `POWERCONTEXT_CODEX_SERVER_URL` there before each ON session, as
 `powercontext setup codex --server-url` does; other `POWERCONTEXT_CODEX_*` settings reach the ON arm unchanged. The
 harness selects the model with `POWERCONTEXT_E2E_CODEX_MODEL` and the reasoning effort with
 `POWERCONTEXT_E2E_CODEX_REASONING_EFFORT`, which defaults to `medium`. Harbor authenticates Codex with
@@ -207,6 +223,7 @@ harness selects the model with `POWERCONTEXT_E2E_CODEX_MODEL` and the reasoning
 
 ```bash
 export POWERCONTEXT_CLIENT_SERVER_URL=http://127.0.0.1:8000
+export POWERCONTEXT_CLIENT_API_TOKEN=replace-me
 export POWERCONTEXT_CLIENT_TIMEOUT=150
```

**File**: `e2e/bub/src/powercontext_e2e/harbor_agent.py` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
 REMOTE_BIN_DIR = "/installed-agent/bin"
 REMOTE_BUB_HOME = "/installed-agent/bub-home"
 REMOTE_BUB_PROJECT = "/installed-agent/bub-project"
-REMOTE_CODEX_AUTH = "/run/powercontext/codex-auth.json"
+REMOTE_CODEX_AUTH = "/run/agent-auth/codex-auth.json"
 REMOTE_CODEX_HOME = "/installed-agent/codex"
 REMOTE_SOURCE = "/opt/powercontext/source"
 REMOTE_SOURCE_OVERRIDE = f"{REMOTE_SOURCE}/e2e/bub/source-overrides.txt"
```

**File**: `e2e/bub/src/powercontext_e2e/harbor_claude_code.py` (modified, +8/-8)
```diff
@@ -29,10 +29,10 @@
 
 
 class PowerContextClaudeCodeAgent(ClaudeCode):
-    """Install the PowerContext Claude Code plugin in both arms and enable it only in the ON arm.
+    """Run Claude Code with the local PowerContext Claude Code plugin installed only in the ON arm.
 
-    Like the Codex host, both arms run the same installation; OFF disables the plugin with Claude Code's own
-    ``claude plugin disable``, so no plugin hook, MCP server, or Skill is loaded.
+    The OFF arm is Claude Code as a user without PowerContext has it, with nothing of the plugin in its container, so
+    its agent cannot find PowerContext and search for it.
     """
 
     def __init__(self, *, server_url: str, powercontext: bool = True, **kwargs: Any) -> None:
@@ -43,6 +43,8 @@ def __init__(self, *, server_url: str, powercontext: bool = True, **kwargs: Any)
     @override
     async def install(self, environment: BaseEnvironment) -> None:
         await super().install(environment)
+        if not self._powercontext:
+            return
         # The plugin's hook runs `python3` with the standard library only.
         await self.exec_as_agent(
             environment,
@@ -53,13 +55,13 @@ async def install(self, environment: BaseEnvironment) -> None:
     def _build_register_mcp_servers_command(self) -> str | None:
         # Harbor points CLAUDE_CONFIG_DIR at the step's log directory, which it clears after every step, so the
         # plugin is installed again before each Claude Code session, after Harbor's own MCP configuration.
-        commands = [install_plugin_command(self._server_url, enabled=self._powercontext)]
+        commands = [install_plugin_command(self._server_url)] if self._powercontext else []
         if task_servers := super()._build_register_mcp_servers_command():
             commands.insert(0, task_servers)
-        return " && ".join(commands)
+        return " && ".join(commands) or None
 
 
-def install_plugin_command(server_url: str, *, enabled: bool) -> str:
+def install_plugin_command(server_url: str) -> str:
     """Install the plugin from the mounted marketplace, as ``powercontext setup claude-code`` would.
 
     The plugin's MCP connection reads the Server URL only from its ``server_url`` option; its hook reads
@@ -72,6 +74,4 @@ def install_plugin_command(server_url: str, *, enabled: bool) -> str:
         f"claude plugin marketplace add {REMOTE_SOURCE} --scope user >/dev/null",
         f"claude plugin install {PLUGIN_ID} --scope user --config {server_option} >/dev/null",
     ]
-    if not enabled:
-        steps.append(f"claude plugin disable {PLUGIN_ID} --scope user >/dev/null")
     return "(set -e; " + "; ".join(steps) + ")"
```

**File**: `e2e/bub/src/powercontext_e2e/harbor_codex.py` (modified, +11/-7)
```diff
@@ -43,10 +43,11 @@
 
 
 class PowerContextCodexAgent(Codex):
-    """Install the PowerContext Codex plugin in both arms and enable Codex plugins only in the ON arm.
+    """Run Codex with the local PowerContext Codex plugin installed and enabled only in the ON arm.
 
-    This follows the published SWE-bench Pro protocol: both arms run the same installation, and the arm switch is
-    Codex's own ``plugins`` feature. Hooks run without interactive trust, as an unattended run cannot grant it.
+    The OFF arm is Codex as a user without PowerContext has it, with nothing of the plugin in its container, so its
+    agent cannot find PowerContext and search for it. The ON arm's hooks run without interactive trust, as an
+    unattended run cannot grant it.
     """
 
     CLI_FLAGS: ClassVar[list[CliFlag]] = [
@@ -57,27 +58,30 @@ class PowerContextCodexAgent(Codex):
 
     def __init__(self, *, server_url: str, powercontext: bool = True, **kwargs: Any) -> None:
         self._server_url = server_url
+        self._powercontext = powercontext
         super().__init__(
             version=CODEX_VERSION,
-            plugins="enable" if powercontext else "disable",
-            bypass_hook_trust=True,
+            plugins="enable" if powercontext else None,
+            bypass_hook_trust=powercontext,
             **kwargs,
         )
 
     @override
     async def install(self, environment: BaseEnvironment) -> None:
         await super().install(environment)
+        if not self._powercontext:
+            return
         await self.exec_as_root(environment, command=_install_plugin_runtime_command())
         agent_user = shlex.quote(str(environment.default_user or "root"))
         await self.exec_as_root(environment, command=f"chown -R {agent_user} {REMOTE_PLUGIN_ENV} {REMOTE_UV_PYTHON}")
 
     @override
     def _build_register_mcp_servers_command(self) -> str | None:
         # Harbor removes CODEX_HOME after every step, so the plugin is added again before each Codex session.
-        commands = [install_plugin_command(self._server_url)]
+        commands = [install_plugin_command(self._server_url)] if self._powercontext else []
         if task_servers := super()._build_register_mcp_servers_command():
             commands.append(task_servers)
-        return "\n".join(commands)
+        return "\n".join(commands) or None
 
 
 def _install_plugin_runtime_command() -> str:
```

**File**: `e2e/bub/src/powercontext_e2e/hosts.py` (modified, +35/-18)
```diff
@@ -28,7 +28,13 @@
 from .harbor_agent import BUB_ACP_SERVER_VERSION, BUB_VERSION, REMOTE_CODEX_AUTH, REMOTE_SOURCE
 from .harbor_claude_code import CLAUDE_CODE_VERSION
 from .harbor_codex import CODEX_VERSION
-from .settings import bub_environment, codex_auth_path, powercontext_bub_environment, prefixed_environment
+from .settings import (
+    bub_environment,
+    codex_auth_path,
+    powercontext_bub_environment,
+    prefixed_environment,
+    server_api_token,
+)
 
 # Bub installs its plugin against the local powercontext package, so its container gets that package's sources.
 POWERCONTEXT_PACKAGE_PATHS = ("pyproject.toml", "README.md", "LICENSE", "src")
@@ -50,8 +56,12 @@ def agent_model(self) -> str | None:
     def agent_settings(self) -> dict[str, str]:
         """Return runtime-selected agent settings, other than the model, recorded in evidence."""
 
-    def mounts(self, task: E2ETask, repository: Path) -> list[ServiceVolumeConfig]:
-        """Return host-owned bind mounts for the task container, such as the integration sources it installs."""
+    def mounts(self, task: E2ETask, repository: Path, *, powercontext: bool) -> list[ServiceVolumeConfig]:
+        """Return host-owned bind mounts for the task container.
+
+        Only a run with PowerContext gets the integration sources it installs, so an agent without PowerContext cannot
+        find PowerContext in its container.
+        """
 
     def agent_config(
         self,
@@ -63,8 +73,8 @@ def agent_config(
         """Configure the host agent for one Harbor job.
 
         With ``scope_id``, the host runs with its PowerContext integration bound to that Scope, or to one Scope per
-        agent invocation when ``invocation_scopes`` is given. Without it, the host runs with no PowerContext
-        integration installed.
+        agent invocation when ``invocation_scopes`` is given, and authenticated with the harness Client's token.
+        Without it, the host runs as a user without PowerContext has it: no integration and no credential.
         """
 
 
@@ -84,11 +94,10 @@ def agent_model(self) -> str | None:
     def agent_settings(self) -> dict[str, str]:
         return {}
 
-    def mounts(self, task: E2ETask, repository: Path) -> list[ServiceVolumeConfig]:
-        mounts = source_mounts(
-            repository,
-            (*POWERCONTEXT_PACKAGE_PATHS, "integrations/bub", "e2e/bub/source-overrides.txt"),
-        )
+    def mounts(self, task: E2ETask, repository: Path, *, powercontext: bool) -> list[ServiceVolumeConfig]:
+        paths = (*POWERCONTEXT_PACKAGE_PATHS, "integrations/bub", "e2e/bub/source-overrides.txt")
+        mounts = source_mounts(repository, paths) if powercontext else []
+        # The Codex login authenticates Bub's model, so both arms get it.
         if task.execution.model and (auth_path := codex_auth_path()).is_file():
             mounts.append(read_only_bind(auth_path, REMOTE_CODEX_AUTH))
         return mounts
@@ -123,6 +132,8 @@ def agent_config(
                 "POWERCONTEXT_BUB_CAPTURE_MAX_BYTES": str(max_bytes),
                 "POWERCONTEXT_BUB_SCOPE_ID": scope_id,
             })
+            if (token := server_api_token()) is not None:
+                env["POWERCONTEXT_BUB_API_TOKEN"] = token
             if invocation_scopes is not None:
                 env.pop("POWERCONTEXT_BUB_SCOPE_ID")
                 kwargs["invocation_scopes"] = invocation_scopes
@@ -135,12 +146,13 @@ def agent_config(
 
 @dataclass(frozen=True)
 class PluginHost:
-    """Run a host through Harbor's own agent for it, with the host's PowerContext plugin installed in both arms.
+    """Run a host through Harbor's own agent for it, with the host's PowerContext plugin only in the ON arm.
 
-    Only the ON arm keeps the plugin enabled and receives the plugin's native ``<plugin_prefix>*`` settings, with
-    ``<plugin_prefix>SCOPE_ID`` bound to the arm's Scope. Both arms point the installed plugin at
-    ``<plugin_prefix>SERVER_URL``, the Server as the agent container reaches it. The harness selects the model with
-    ``<setting_prefix>MODEL`` and passes the reasoning effort from ``<setting_prefix>REASONING_EFFORT`` explicitly.
+    Only the ON arm installs the plugin and receives the plugin's native ``<plugin_prefix>*`` settings, with
+    ``<plugin_prefix>SCOPE_ID`` bound to the arm's Scope and ``<plugin_prefix>AUTHORIZATION`` carrying the harness
+    Client's token. ``<plugin_prefix>SERVER_URL`` names the Server as the agent container reaches it. The harness
+    selects the model with ``<setting_prefix>MODEL`` and passes the reasoning effort from
+    ``<setting_prefix>REASONING_EFFORT`` explicitly.
     """
 
     name: str
@@ -168,8 +180,8 @@ def agent_settings(self) -> dict[str, str]:
         # such as CLAUDE_CODE_EFFORT_LEVEL, from changing it unrecorded.
         return {"reasoning_effort": environ.get(f"{self.setting_prefix}REASONING_EFFORT") or "medium"}
 
-    def mounts(self, task: E2ETask, repositor
```

**File**: `e2e/bub/src/powercontext_e2e/paired.py` (modified, +30/-0)
```diff
@@ -22,6 +22,8 @@
 from uuid import uuid4
 
 from harbor.job import Job
+from powercontext.client import PowerContextClient, UnauthorizedResponseError
+from powercontext.client.settings import ClientSettings
 from powercontext.http import CreateScopeRequest
 
 from .catalog import ContinuationEvaluationSpec, E2ETask
@@ -62,6 +64,17 @@
 AGENT_TIMEOUT = "AgentTimeoutError"
 
 
+class UnauthenticatedServerError(RuntimeError):
+    """Report a Server that answers without a token, which an OFF agent that reaches it could read."""
+
+    def __init__(self) -> None:
+        super().__init__(
+            "The PowerContext Server answers unauthenticated requests, so an OFF agent that reaches it could read the "
+            "ON arm's Memory. Start it with POWERCONTEXT_SERVER_ACCESS_MODE=enforced and POWERCONTEXT_SERVER_AUTH_TOKEN, "
+            "and give the harness the same token as POWERCONTEXT_CLIENT_API_TOKEN"
+        )
+
+
 class MemoryExtractionUnavailableError(RuntimeError):
     """Report a Server that cannot turn captured Sources into Memory, which the ON arm depends on."""
 
@@ -92,6 +105,7 @@ async def run_paired(
     observations: list[PairedArmObservation] = []
     async with _powercontext_client() as client:
         await client.get_readiness()
+        await require_authenticated_server()
         if not (await client.get_capabilities()).memory_extraction:
             raise MemoryExtractionUnavailableError
         for task in tasks:
@@ -133,6 +147,22 @@ def _paired_agent(host: HostAdapter) -> PairedAgent:
     )
 
 
+async def require_authenticated_server() -> None:
+    """Refuse a Server that lists its Scopes to a client without a token.
+
+    Both arms' containers can reach the Server, so only authentication keeps the OFF arm out of the ON arm's Memory;
+    the token goes to the harness Client and the ON arm's integration only.
+    """
+
+    settings = ClientSettings()
+    async with PowerContextClient(settings.server_url, timeout=settings.timeout) as anonymous:
+        try:
+            await anonymous.list_scopes()
+        except UnauthorizedResponseError:
+            return
+    raise UnauthenticatedServerError
+
+
 def recall_session_index(task: E2ETask, settings: HarnessSettings) -> int:
     """Return the zero-based agent session that answers from earlier sessions."""
 
```

**File**: `e2e/bub/src/powercontext_e2e/runner.py` (modified, +1/-1)
```diff
@@ -432,7 +432,7 @@ def _job_config(
 ) -> JobConfig:
     host = host or host_adapter(task.execution.type)
     repository = settings.repository_path()
-    mounts: list[ServiceVolumeConfig] = host.mounts(task, repository)
+    mounts: list[ServiceVolumeConfig] = host.mounts(task, repository, powercontext=scope_id is not None)
     agent = host.agent_config(
         task,
         scope_id=scope_id,
```

**File**: `e2e/bub/src/powercontext_e2e/settings.py` (modified, +8/-0)
```diff
@@ -21,6 +21,7 @@
 from os import environ
 from pathlib import Path
 
+from powercontext.client.settings import ClientSettings
 from pydantic import Field, SecretStr
 from pydantic_settings import BaseSettings, SettingsConfigDict
 
@@ -47,6 +48,13 @@ def prefixed_environment(prefix: str) -> dict[str, str]:
     return {name: value for name, value in environ.items() if name.startswith(prefix) and value}
 
 
+def server_api_token() -> str | None:
+    """Return the token the harness Client uses, which the ON arm's integration also needs for the same Server."""
+
+    token = ClientSettings().api_token
+    return None if token is None else token.get_secret_value()
+
+
 def codex_auth_path() -> Path:
     """Resolve Codex's native authentication document location."""
 
```

---

### Incident Patch 10: `45f60099` (2026-10-02)
**Commit Message**: docs: document memory governance server settings (#1832)

* docs: document memory governance server settings

* docs: distinguish decision model requests from SDK retries

**File**: `docs/en/docs/operate/configuration.md` (modified, +16/-0)
```diff
@@ -76,6 +76,16 @@ Server settings use the `POWERCONTEXT_SERVER_` prefix.
 | `POWERCONTEXT_SERVER_RUNTIME_MEMORY_EXTRACTION_PROFILE` | `coding` | Memory selection policy: `coding` or `conversation` |
 | `POWERCONTEXT_SERVER_RUNTIME_MEMORY_RERANK_ENABLED` | `false` | Apply listwise reranking after coarse Memory retrieval |
 | `POWERCONTEXT_SERVER_RUNTIME_MEMORY_RERANK_CANDIDATE_LIMIT` | `30` | Coarse candidate pool supplied to the reranker |
+| `POWERCONTEXT_SERVER_RUNTIME_DECISION_ASSISTANCE_ENABLED` | `false` | Enable decision-model assistance; requires a decision or generation model |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_WRITE_GATE_ENABLED` | `false` | Enable the decision-model gate for pending Memory writes; without a decision backend, writes pass through |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_WRITE_GATE_HOLD_ON` | `yes` | Decision outcome that means evidence is insufficient: `yes` or `no` |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_WRITE_GATE_THRESHOLD` | unset | Optional confidence threshold from `0` to `1`; a hold-direction verdict below it is flagged instead of held |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_MAX_ACTIVE_ENTRIES` | `5000` | Maximum active entries per Memory; must not exceed the manifest-entry limit |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_MAX_MANIFEST_ENTRIES` | `10000` | Maximum entries in a Memory manifest, including inactive entries |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_MAX_MANIFEST_BYTES` | `4194304` | Maximum bytes of complete canonical Memory manifest content |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_COMPACTION_ENABLED` | `false` | Permit explicit in-process tombstone compaction; does not schedule or trigger compaction |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_COMPACTION_MIN_TOMBSTONE_REVISIONS` | `10` | Minimum completed Revision advances before a tombstone can be compacted |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_MAX_HISTORY_REVISIONS` | `100` | Maximum Memory history Revisions read by the Runtime |
 | `POWERCONTEXT_SERVER_RUNTIME_RECALL_GATE_ENABLED` | `false` | Enable the optional recall-sufficiency gate; disabling it keeps recall identical to a deployment without the feature |
 | `POWERCONTEXT_SERVER_RUNTIME_RECALL_GATE_MAX_ROUNDS` | `2` | Most expansion rounds after the first recall; `0` to `2`, where `0` assesses without expanding |
 | `POWERCONTEXT_SERVER_RUNTIME_RECALL_GATE_MIN_CANDIDATES` | `2` | Fewest candidates a recall needs to count as sufficient |
@@ -134,6 +144,12 @@ Server settings use the `POWERCONTEXT_SERVER_` prefix.
 | `POWERCONTEXT_SERVER_INFERENCE_RERANK_MODEL_SETTINGS` | `{}` | JSON object of Pydantic AI reranker model settings |
 | `POWERCONTEXT_SERVER_INFERENCE_RERANK_TIMEOUT_SECONDS` | generation timeout | LLM reranker timeout |
 | `POWERCONTEXT_SERVER_INFERENCE_RERANK_MAX_REQUESTS` | generation request limit | Maximum model requests in one rerank operation |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_MODEL` | generation model | Optional dedicated Pydantic AI model for decision assistance and the Memory write gate |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_BASE_URL` | inherited/provider default | Custom decision-model provider base URL; requires `DECISION_MODEL` |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_HEADERS` | `{}` | JSON object of static decision client headers; values are secrets and inherit generation headers when no dedicated model is set |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_MODEL_SETTINGS` | `{}` | JSON object of decision model settings; merged with generation settings when no dedicated model is set |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_TIMEOUT_SECONDS` | generation timeout | Timeout in seconds for a decision operation |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_MAX_REQUESTS` | generation request limit | Maximum model requests for one decision operation, including model-output validation retries; excludes provider SDK HTTP retries |
 | `POWERCONTEXT_SERVER_RUNTIME_EXPERIENCE_SCHEDULE_SECONDS` | unset | Experience automatic admission interval; unset preserves accepted work and stops new automatic admission |
 | `POWERCONTEXT_SERVER_EXTERNAL_SKILLS` | automatic local project targets | JSON override containing the host identity and explicit Agent Skill targets |
 
```

**File**: `docs/zh/docs/operate/configuration.md` (modified, +16/-0)
```diff
@@ -72,6 +72,16 @@ Server 配置使用 `POWERCONTEXT_SERVER_` 前缀。
 | `POWERCONTEXT_SERVER_RUNTIME_MEMORY_EXTRACTION_PROFILE` | `coding` | Memory 选择策略：`coding` 或 `conversation` |
 | `POWERCONTEXT_SERVER_RUNTIME_MEMORY_RERANK_ENABLED` | `false` | 在 Memory 粗召回后应用 listwise rerank |
 | `POWERCONTEXT_SERVER_RUNTIME_MEMORY_RERANK_CANDIDATE_LIMIT` | `30` | 交给 reranker 的粗排候选池大小 |
+| `POWERCONTEXT_SERVER_RUNTIME_DECISION_ASSISTANCE_ENABLED` | `false` | 启用决策模型辅助；需要配置决策模型或 generation 模型 |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_WRITE_GATE_ENABLED` | `false` | 启用待写入 Memory 的决策模型门控；没有决策后端时会放行写入 |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_WRITE_GATE_HOLD_ON` | `yes` | 表示证据不足的决策结果：`yes` 或 `no` |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_WRITE_GATE_THRESHOLD` | 未设置 | 可选的 `0` 到 `1` 置信度阈值；低于阈值的暂缓方向结果会标记而非暂缓写入 |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_MAX_ACTIVE_ENTRIES` | `5000` | 每份 Memory 的活跃条目上限；不得高于清单条目上限 |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_MAX_MANIFEST_ENTRIES` | `10000` | 每份 Memory 清单的条目上限，包括非活跃条目 |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_MAX_MANIFEST_BYTES` | `4194304` | Memory 完整规范内容的字节上限 |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_COMPACTION_ENABLED` | `false` | 允许显式的进程内墓碑压缩；不会自动安排或触发压缩 |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_COMPACTION_MIN_TOMBSTONE_REVISIONS` | `10` | 墓碑可压缩前至少经过的完整 Revision 推进次数 |
+| `POWERCONTEXT_SERVER_RUNTIME_MEMORY_MAX_HISTORY_REVISIONS` | `100` | Runtime 读取的 Memory 历史 Revision 数量上限 |
 | `POWERCONTEXT_SERVER_RUNTIME_RECALL_GATE_ENABLED` | `false` | 启用可选的召回充分性门控；关闭时召回行为与不启用该功能时一致 |
 | `POWERCONTEXT_SERVER_RUNTIME_RECALL_GATE_MAX_ROUNDS` | `2` | 首轮召回之后最多追加的搜索轮数；取值 `0`–`2`，`0` 表示只评估、不追加 |
 | `POWERCONTEXT_SERVER_RUNTIME_RECALL_GATE_MIN_CANDIDATES` | `2` | 判定召回充分所需的最少候选数量 |
@@ -130,6 +140,12 @@ Server 配置使用 `POWERCONTEXT_SERVER_` 前缀。
 | `POWERCONTEXT_SERVER_INFERENCE_RERANK_MODEL_SETTINGS` | `{}` | Pydantic AI reranker model settings JSON object |
 | `POWERCONTEXT_SERVER_INFERENCE_RERANK_TIMEOUT_SECONDS` | generation 超时 | LLM reranker 超时 |
 | `POWERCONTEXT_SERVER_INFERENCE_RERANK_MAX_REQUESTS` | generation request limit | 单次 rerank operation 的最大 model request 数量 |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_MODEL` | generation model | 用于决策辅助和 Memory 写入门控的可选独立 Pydantic AI 模型 |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_BASE_URL` | 继承值或 provider 默认值 | 自定义决策模型 provider base URL；须同时设置 `DECISION_MODEL` |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_HEADERS` | `{}` | 决策模型客户端静态 header 的 JSON object；值按 secret 处理，未设置独立模型时继承 generation headers |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_MODEL_SETTINGS` | `{}` | 决策模型设置的 JSON object；未设置独立模型时与 generation settings 合并 |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_TIMEOUT_SECONDS` | generation 超时 | 单次决策操作的超时秒数 |
+| `POWERCONTEXT_SERVER_INFERENCE_DECISION_MAX_REQUESTS` | generation request limit | 单次决策操作的模型请求次数上限，包含模型输出校验重试；不包含 provider SDK 的 HTTP 重试 |
 | `POWERCONTEXT_SERVER_RUNTIME_EXPERIENCE_SCHEDULE_SECONDS` | 未设置 | Experience 自动准入间隔；未设置时保留已接受工作，停止新的自动准入 |
 | `POWERCONTEXT_SERVER_EXTERNAL_SKILLS` | 自动生成本机项目 target | 覆盖默认值的 host identity 和显式 Agent Skill targets JSON object |
 
```

---

### Incident Patch 11: `1e1b2cd0` (2026-10-02)
**Commit Message**: build(deps): bump brace-expansion (#1833)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 5.0.9 to 5.0.12.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.9...v5.0.12)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 5.0.12
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `integrations/pi/plugins/powercontext/pnpm-lock.yaml` (modified, +4/-18)
```diff
@@ -1,17 +1,3 @@
-# Copyright (c) 2026 OceanBase.
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-# http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-
 lockfileVersion: '9.0'
 
 settings:
@@ -703,8 +689,8 @@ packages:
   bowser@2.14.1:
     resolution: {integrity: sha512-tzPjzCxygAKWFOJP011oxFHs57HzIhOEracIgAePE4pqB3LikALKnSzUyU4MGs9/iCEUuHlAJTjTc5M+u7YEGg==}
 
-  brace-expansion@5.0.9:
-    resolution: {integrity: sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==}
+  brace-expansion@5.0.12:
+    resolution: {integrity: sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==}
     engines: {node: 20 || >=22}
 
   buffer-equal-constant-time@1.0.1:
@@ -1829,7 +1815,7 @@ snapshots:
 
   bowser@2.14.1: {}
 
-  brace-expansion@5.0.9:
+  brace-expansion@5.0.12:
     dependencies:
       balanced-match: 4.0.4
 
@@ -2025,7 +2011,7 @@ snapshots:
 
   minimatch@10.2.5:
     dependencies:
-      brace-expansion: 5.0.9
+      brace-expansion: 5.0.12
 
   minipass@7.1.3: {}
 
```

---

### Incident Patch 12: `9320ce00` (2026-10-02)
**Commit Message**: feat(handoff): add compact continuity hints (#1820)

* feat(handoff): add compact continuity hints

* chore(dsh): regenerate operation bundle

**File**: `docs/en/docs/workflows/memory-and-handoff.md` (modified, +42/-0)
```diff
@@ -27,6 +27,48 @@ Prepared Handoff and checks it against current code and instructions.
 Drafts and Prepared Handoffs are not durable project knowledge by default. Commit a Handoff only when the user
 explicitly asks to retain a milestone.
 
+## Optional continuity hints
+
+For a fresh session, explicitly call `prepare_handoff_hint` through the Python Client, HTTP (`POST /v1/handoff/hint`),
+or an MCP connection that exposes the operation. It returns the standard four-field PreparedContext envelope with
+compact orientation text. Existing context preparation and continuation do not request hints automatically.
+
+```python
+from powercontext.http import PrepareHandoffHintRequest
+
+hint = await client.prepare_handoff_hint(
+    PrepareHandoffHintRequest(scope_id=scope_id, selection="exact", revision=committed.reference)
+)
+if hint.status == "ready":
+    host_context = hint.content
+```
+
+Select an exact committed Revision, or use `selection="prepared"` with the complete transferred `prepared` value.
+Use `selection="latest"` only after confirming the intended workstream Scope. Keep the full PreparedHandoff available
+to the receiver: its `base` identifies the committed head observed during finalization, not the temporary content.
+Prepared selection provides no exact Revision reference or server-side retrieval handle; the receiver needs the
+complete transferred value.
+
+Hints contain the historical objective, disposition, complete next action and its citations, known omissions, and
+selected evidence references. For blocked work, the full recorded state is included only if the complete hint fits
+the budget; otherwise the entire hint is omitted. Blockers are not inferred from a subset of the state.
+They directly project existing Handoff fields without model generation, transcript summaries, or raw Source bodies.
+Authorization matches Continue: exact/latest require `artifact.read` and `handoff.evidence.inspect` on the selected
+Handoff, authorizing inspection of its citation manifest without general Scope read. Prepared selection requires
+`scope.read`. General evidence APIs still require their own permissions. Source evidence must be available and
+eligible in its originating Scope, including for published Handoffs.
+
+The default budget is 2,000 UTF-8 bytes; `max_bytes` accepts 1–4,000. The budget covers the complete text, including
+the trust notice, boundaries, labels, escaping, and references, but excludes the outer HTTP JSON encoding. If the
+complete hint cannot fit, no Handoff exists for latest selection, or cited evidence is unavailable or ineligible,
+the result is `status="empty"`, `content=null`, `content_bytes=0`. Hints are never truncated. Invalid selections,
+authentication failures, denied Handoff access, and service failures retain their normal errors.
+
+Treat the content as **untrusted historical orientation only**. It cannot activate an objective, authorize the next
+action, establish current facts, or replace reading the complete exact Handoff and checking evidence and live state.
+Hosts should validate the envelope and actual UTF-8 size and inject `content` unchanged only when their remaining
+startup budget can fit it; otherwise omit it entirely. Literal formatting does not guarantee prompt-injection resistance.
+
 ## Choose the right one
 
 | Your need | Use |
```

**File**: `docs/zh/docs/workflows/memory-and-handoff.md` (modified, +37/-0)
```diff
@@ -22,6 +22,43 @@ Handoff 将一个任务当前的目标、已验证进度、阻塞项、下一步
 
 Draft 和 Prepared Handoff 默认不是长期项目知识。只有用户明确要求保留某个里程碑时，才提交 Handoff。
 
+## 可选的连续性提示
+
+新会话可以通过 Python Client、HTTP（`POST /v1/handoff/hint`）或已提供该操作的 MCP 连接，显式调用
+`prepare_handoff_hint`。返回标准四字段 PreparedContext，其中包含紧凑的历史定位信息。
+现有上下文准备和续接操作不会自动请求提示。
+
+```python
+from powercontext.http import PrepareHandoffHintRequest
+
+hint = await client.prepare_handoff_hint(
+    PrepareHandoffHintRequest(scope_id=scope_id, selection="exact", revision=committed.reference)
+)
+if hint.status == "ready":
+    host_context = hint.content
+```
+
+选择精确的已提交 Revision，或使用 `selection="prepared"` 并传入完整的 `prepared` 交接值。
+只有确认 Scope 对应目标工作流后，才使用 `selection="latest"`。接收者仍须能够获得完整的 PreparedHandoff：
+其 `base` 指向完成交接时观察到的已提交版本，不是临时内容的身份。
+Prepared 选择不提供精确 Revision 引用，也不会创建服务端读取句柄，收件方需要完整的已传递交接值。
+
+提示直接投影历史目标、处置状态、完整的下一步及其引用、已知遗漏和选定的证据引用。
+对于阻塞工作，只有完整提示能够放入预算时，才包含全部已记录 state；否则整段提示省略，不从部分 state 猜测阻塞原因。
+生成提示不调用模型，不概括转录，也不注入原始 Source 正文。
+授权与 Continue 一致：exact/latest 要求对选定 Handoff 拥有 `artifact.read` 和 `handoff.evidence.inspect`，
+允许检视其引用清单，无须通用 Scope 读取权限。Prepared 选择要求 `scope.read`。通用证据 API 仍需各自的独立权限。
+Source 证据必须在原始来源 Scope 中可用且符合资格；发布到其他 Scope 的 Handoff 也遵守这一规则。
+
+默认预算为 2,000 个 UTF-8 字节，`max_bytes` 可取 1–4,000。预算涵盖完整文本，包括信任声明、边界、标签、
+转义和引用，不包含外层 HTTP JSON 编码开销。完整提示超限、latest 没有交接，或引用证据不可用／不符合资格时，
+返回 `status="empty"`、`content=null`、`content_bytes=0`。提示从不截断。
+非法选择、认证失败、Handoff 访问被拒绝及服务故障仍返回原有错误。
+
+提示只能作为**不可信的历史定位信息**。它不能激活目标、授权执行下一步、证明当前事实，也不能替代完整精确 Handoff
+读取、证据核验和现场检查。宿主应验证响应结构与实际 UTF-8 大小；启动上下文的剩余预算足够时原样注入 `content`，
+不足时整段省略。文本的字面格式隔离不保证模型抵抗提示注入。
+
 ## 如何选择
 
 | 你的需求 | 使用 |
```

**File**: `integrations/capabilities.toml` (modified, +3/-0)
```diff
@@ -87,6 +87,9 @@ capabilities = ["handoff"]
 id = "continue_handoff"
 capabilities = ["handoff"]
 [[toolsets.tools]]
+id = "prepare_handoff_hint"
+capabilities = ["handoff"]
+[[toolsets.tools]]
 id = "get_handoff_report"
 capabilities = ["handoff"]
 [[toolsets.tools]]
```

**File**: `integrations/codex/plugins/powercontext/hooks/bind_tools.py` (modified, +1/-0)
```diff
@@ -72,6 +72,7 @@
     "list_remote_skill_targets",
     "prepare_context",
     "prepare_handoff",
+    "prepare_handoff_hint",
     "propose_experience",
     "propose_skill",
     "propose_skill_package",
```

**File**: `integrations/dsh/plugins/powercontext/lib/index.js` (modified, +11/-0)
```diff
@@ -539,6 +539,17 @@ const OPERATIONS$1 = {
 		successStatuses: [200],
 		emptyStatuses: []
 	},
+	prepare_handoff_hint: {
+		method: "POST",
+		path: "/v1/handoff/hint",
+		location: "body",
+		scopeMode: "current",
+		pathParameters: [],
+		queryParams: [],
+		headerParams: [],
+		successStatuses: [200],
+		emptyStatuses: []
+	},
 	flush_topic_memory: {
 		method: "POST",
 		path: "/v1/topic-memory/flush",
```

**File**: `integrations/dsh/plugins/powercontext/src/operations.generated.ts` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@ export const OPERATIONS = {
   finalize_handoff: { method: 'POST', path: '/v1/handoff/finalize', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   commit_handoff: { method: 'POST', path: '/v1/handoff/commit', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   continue_handoff: { method: 'POST', path: '/v1/handoff/continue', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
+  prepare_handoff_hint: { method: 'POST', path: '/v1/handoff/hint', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   flush_topic_memory: { method: 'POST', path: '/v1/topic-memory/flush', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   search_topic_memory: { method: 'POST', path: '/v1/topic-memory/search', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   get_topic_memory: { method: 'POST', path: '/v1/topic-memory/get', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
```

**File**: `integrations/opencode/plugins/powercontext/src/operations.generated.ts` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@ export const OPERATIONS = {
   finalize_handoff: { method: 'POST', path: '/v1/handoff/finalize', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   commit_handoff: { method: 'POST', path: '/v1/handoff/commit', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   continue_handoff: { method: 'POST', path: '/v1/handoff/continue', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
+  prepare_handoff_hint: { method: 'POST', path: '/v1/handoff/hint', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   flush_topic_memory: { method: 'POST', path: '/v1/topic-memory/flush', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   search_topic_memory: { method: 'POST', path: '/v1/topic-memory/search', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   get_topic_memory: { method: 'POST', path: '/v1/topic-memory/get', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
```

**File**: `integrations/pi/plugins/powercontext/src/operations.generated.ts` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@ export const OPERATIONS = {
   finalize_handoff: { method: 'POST', path: '/v1/handoff/finalize', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   commit_handoff: { method: 'POST', path: '/v1/handoff/commit', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   continue_handoff: { method: 'POST', path: '/v1/handoff/continue', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
+  prepare_handoff_hint: { method: 'POST', path: '/v1/handoff/hint', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   flush_topic_memory: { method: 'POST', path: '/v1/topic-memory/flush', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   search_topic_memory: { method: 'POST', path: '/v1/topic-memory/search', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
   get_topic_memory: { method: 'POST', path: '/v1/topic-memory/get', location: "body", scopeMode: 'current', pathParameters: [], queryParams: [], headerParams: [], successStatuses: [200], emptyStatuses: [] },
```

---

### Incident Patch 13: `502ce0a3` (2026-10-02)
**Commit Message**: fix(code): prevent native parser startup failure on macOS (#1818)

* fix(code): enforce parser memory budgets on macOS

* fix: keep macOS parser checks portable in CI

* fix(code): reconcile buffered parser progress

**File**: `docs/en/docs/workflows/repository-code.md` (modified, +11/-2)
```diff
@@ -14,8 +14,17 @@ The capability is disabled by default. Structural analysis supports UTF-8 Python
 repository reference resolution. It requires no generation model, embeddings, Node.js, or CodeGraph service.
 Dynamic dispatch, reflection, framework-generated calls, and unsupported syntax can remain unknown.
 A `candidate` relationship is a lead, not proof of a runtime call.
-Local indexing is verified on Linux and requires POSIX file locks, process resource limits, and SQLite FTS5 or embedded seekdb full-text search.
-Clients on other systems can use the HTTP service; local indexing on macOS and Windows has not been validated.
+Local indexing with SQLite is verified on Linux and macOS and requires POSIX file locks and SQLite FTS5;
+embedded seekdb deployments use seekdb full-text search. Windows clients can use the HTTP service; local indexing
+on Windows has not been validated.
+
+Parser workers have a default 1 GiB memory budget (`limits.worker_memory_bytes`). Linux enforces an address-space
+limit through `RLIMIT_AS`. macOS does not support that limit: the parent samples the worker's resident memory (RSS)
+approximately every 100 ms under normal scheduling and terminates it when the budget is exceeded. This is sampled
+enforcement: scheduling delays and allocations between checks can allow temporary overshoot. If memory monitoring fails,
+the build fails rather than proceeding without enforcement. A file interrupted by a memory limit retains text search
+with failed structural coverage;
+a worker failure before parsing begins aborts the build and preserves the previously published index.
 
 ## Language coverage
 
```

**File**: `docs/zh/docs/workflows/repository-code.md` (modified, +7/-2)
```diff
@@ -13,8 +13,13 @@ Memory 保存历史决策与约束；代码查询提供当前工作区的定义
 本能力默认关闭。结构分析支持 UTF-8 Python、TypeScript/JavaScript（含 TSX/JSX）和 Go，使用 Tree-sitter 提取语法，再保守地解析仓库内引用。
 它不需要生成模型、Embedding、Node.js 或 CodeGraph 服务。动态分派、反射、框架隐含调用及不支持的语法可能缺失；
 `candidate` 关系只表示线索，不能当作运行时调用证明。
-本机索引目前在 Linux 验证，依赖 POSIX 文件锁、进程资源限制，以及 SQLite FTS5 或嵌入式 seekdb 全文检索；其他系统可通过 HTTP 使用该服务。
-macOS 和 Windows 的本机索引尚未验收。
+使用 SQLite 的本机索引已在 Linux 和 macOS 验证，依赖 POSIX 文件锁与 SQLite FTS5；嵌入式 seekdb 部署使用 seekdb 全文检索。
+Windows 客户端可通过 HTTP 使用该服务，Windows 本机索引尚未验收。
+
+解析 worker 默认内存预算为 1 GiB（`limits.worker_memory_bytes`）。Linux 通过 `RLIMIT_AS` 限制地址空间。
+macOS 不支持此限制，由父进程在正常调度下约每 100 毫秒采样 worker 的实际驻留内存（RSS），超限时终止进程。
+这是采样检查，调度延迟和两次检查之间的分配可能导致内存短暂超出预算。内存监测失败时构建失败，不会无保护地继续解析。
+解析中因内存限制中断的文件保留文本检索，结构覆盖标记为失败；若 worker 在解析开始前失败，则中止构建并保留此前发布的索引。
 
 ## 多语言范围
 
```

**File**: `e2e/bub/uv.lock` (modified, +1/-0)
```diff
@@ -1647,6 +1647,7 @@ requires-dist = [
     { name = "platformdirs", marker = "extra == 'cli'", specifier = ">=4,<5" },
     { name = "platformdirs", marker = "extra == 'server'", specifier = ">=4,<5" },
     { name = "prometheus-client", marker = "extra == 'server'", specifier = ">=0.21,<1" },
+    { name = "psutil", marker = "sys_platform == 'darwin' and extra == 'code'", specifier = ">=7.2,<8" },
     { name = "pycasbin", marker = "extra == 'server'", specifier = ">=2.8,<3" },
     { name = "pydantic", specifier = ">=2.10,<3" },
     { name = "pydantic-ai-slim", extras = ["anthropic", "openai"], marker = "extra == 'builtin'", specifier = ">=2.27.1,<3" },
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@ classifiers = [
 
 [project.optional-dependencies]
 code = [
+    "psutil>=7.2,<8; sys_platform == 'darwin'",
     "tree-sitter==0.26.0",
     "tree-sitter-go==0.25.0",
     "tree-sitter-javascript==0.25.0",
```

**File**: `src/powercontext/builtin/code/process.py` (modified, +56/-11)
```diff
@@ -7,7 +7,7 @@
 # CONDITIONS OF ANY KIND, either express or implied. See the License for the
 # specific language governing permissions and limitations under the License.
 
-"""Parent-enforced per-file deadlines for isolated native parser batches."""
+"""Parent-enforced deadlines and Darwin memory budgets for isolated parser batches."""
 
 from __future__ import annotations
 
@@ -35,9 +35,27 @@ def _progress(line: bytes, count: int) -> tuple[bytes, int]:
     return action, index
 
 
+def _budget_failure(pid: int, remaining: float, memory_bytes: int) -> str | None:
+    if remaining <= 0:
+        return "parse_timeout"
+    if sys.platform != "darwin":
+        return None
+    import psutil
+
+    try:
+        if psutil.Process(pid).memory_info().rss > memory_bytes:
+            return "memory_limit"
+    except psutil.NoSuchProcess:
+        # Drain buffered progress after exit before deciding whether the batch failed.
+        return None
+    except psutil.Error as error:
+        raise CodeError("code_parser_failed") from error
+    return None
+
+
 def _monitor(
-    process: subprocess.Popen[bytes], count: int, deadline: float, parse_seconds: float
-) -> tuple[set[int], int | None, str]:
+    process: subprocess.Popen[bytes], count: int, deadline: float, parse_seconds: float, memory_bytes: int
+) -> tuple[set[int], int | None, str, bytes]:
     completed: set[int] = set()
     current = None
     expires = min(deadline, time.monotonic() + 10)
@@ -49,13 +67,13 @@ def _monitor(
         while True:
             check_deadline(deadline)
             remaining = expires - time.monotonic()
-            if remaining <= 0:
-                return completed, current, "parse_timeout"
+            if reason := _budget_failure(process.pid, remaining, memory_bytes):
+                return completed, current, reason, buffer
             if not selector.select(min(0.1, remaining)):
                 continue
             data = os.read(process.stdout.fileno(), 4096)
             if not data:
-                return completed, current, "parser_crash"
+                return completed, current, "parser_crash", buffer
             buffer += data
             while b"\n" in buffer:
                 line, buffer = buffer.split(b"\n", 1)
@@ -68,12 +86,14 @@ def _monitor(
                     current = None
                     expires = min(deadline, time.monotonic() + 10)
                     if len(completed) == count:
-                        return completed, None, "complete"
+                        return completed, None, "complete", buffer
                 else:
                     raise CodeError("code_parser_failed")
 
 
-def _batch(job_file: Path, count: int, deadline: float, parse_seconds: float) -> tuple[set[int], int | None, str]:
+def _batch(
+    job_file: Path, count: int, deadline: float, parse_seconds: float, memory_bytes: int
+) -> tuple[set[int], int | None, str]:
     environment = {key: value for key, value in os.environ.items() if key not in {"PYTHONPATH", "PYTHONSTARTUP"}}
     with subprocess.Popen(  # noqa: S603 - fixed module and service-owned job manifest.
         [sys.executable, "-m", "powercontext.builtin.code.worker", str(job_file)],
@@ -82,13 +102,38 @@ def _batch(job_file: Path, count: int, deadline: float, parse_seconds: float) ->
         cwd=job_file.parent,
         env=environment,
     ) as process:
+        result = None
         try:
-            result = _monitor(process, count, deadline, parse_seconds)
+            result = _monitor(process, count, deadline, parse_seconds, memory_bytes)
         finally:
             if process.poll() is None:
                 process.kill()
             process.wait()
-    return result
+            if result is not None and result[2] == "memory_limit" and process.stdout is not None:
+                trailing = result[3] + process.stdout.read()
+                completed, current = _reconcile_progress(trailing, count, result[0], result[1])
+                result = completed, current, result[2], b""
+    if result is None:
+        raise CodeError("code_parser_failed")
+    return result[:3]
+
+
+def _reconcile_progress(
+    data: bytes, count: int, completed: set[int], current: int | None
+) -> tuple[set[int], int | None]:
+    """Account for progress already written before a worker is terminated."""
+
+    while b"\n" in data:
+        line, data = data.split(b"\n", 1)
+        action, index = _progress(line, count)
+        if action == b"begin":
+            current = index
+        elif action == b"end" and current == index:
+            completed.add(index)
+            current = None
+        else:
+            raise CodeError("code_parser_failed")
+    return completed, current
 
 
 def extract_jobs(
@@ -102,7 +147,7 @@ def extract_jobs(
         write_private(
             job_file, json_bytes({"memory_bytes": memory_bytes, "parse_seconds": parse_seconds, "files": pending})
         )
-        complete, failed, reason = _batch(
```

**File**: `src/powercontext/builtin/code/worker.py` (modified, +3/-1)
```diff
@@ -27,7 +27,9 @@ def run(manifest_path: Path) -> None:
 
     job = json.loads(manifest_path.read_bytes())
     memory = job["memory_bytes"]
-    resource.setrlimit(resource.RLIMIT_AS, (memory, memory))
+    # Darwin rejects RLIMIT_AS; the parent enforces a sampled RSS budget there.
+    if sys.platform != "darwin":
+        resource.setrlimit(resource.RLIMIT_AS, (memory, memory))
     directory = manifest_path.parent
     extractors: dict[tuple[str, bool], PythonExtractor | PolyglotExtractor] = {}
     for number, entry in enumerate(job["files"]):
```

**File**: `tests/builtin/test_native_code.py` (modified, +119/-0)
```diff
@@ -14,6 +14,7 @@
 import os
 import shutil
 import subprocess
+import sys
 import time
 from pathlib import Path
 
@@ -904,6 +905,124 @@ def test_parser_timeout_is_visible_and_never_publishes_false_edges(repository):
     assert not any(item["kind"] == "function" for item in result.items)
 
 
+@pytest.mark.skipif(sys.platform != "darwin", reason="Darwin uses parent-enforced RSS budgets")
+@pytest.mark.parametrize("started", [False, True], ids=["startup", "parsing"])
+def test_parser_memory_budget_terminates_worker_and_preserves_evidence(repository, monkeypatch, started):
+    from powercontext.builtin.code import CodeLimits, process
+
+    _, service = repository
+    before = query(service, "symbols", query="prepare")
+    constrained = CodeService(
+        service.config.model_copy(
+            update={"limits": CodeLimits(worker_memory_bytes=64 * 1024 * 1024, parse_seconds=30, build_seconds=20)}
+        )
+    )
+    popen = subprocess.Popen
+    workers = []
+
+    def over_budget_worker(arguments, **kwargs):
+        if arguments[1:3] != ["-m", "powercontext.builtin.code.worker"]:
+            return popen(arguments, **kwargs)
+        # A real child exceeds the configured budget and would otherwise sleep for 30 seconds.
+        progress = "print('begin:0', flush=True); time.sleep(0.2); " if started else ""
+        worker = popen(
+            [sys.executable, "-c", f"import time; {progress}allocation = bytearray(128 * 1024 * 1024); time.sleep(30)"],
+            **kwargs,
+        )
+        workers.append(worker)
+        return worker
+
+    started_at = time.monotonic()
+    with monkeypatch.context() as patch:
+        patch.setattr(process.subprocess, "Popen", over_budget_worker)
+        if started:
+            constrained.index("scope", full=True)
+        else:
+            with pytest.raises(CodeError, match="code_parser_failed"):
+                constrained.index("scope", full=True)
+
+    assert time.monotonic() - started_at < 5
+    assert workers
+    assert all(worker.returncode is not None and worker.returncode < 0 for worker in workers)
+    after = query(service, "symbols", query="prepare")
+    if started:
+        assert after.coverage["failed_files"] > 0
+        assert not any(item["kind"] == "function" for item in after.items)
+        files = query(service, "symbols", query="src/sample/api.py")
+        file = next(item for item in files.items if item["path"] == "src/sample/api.py")
+        evidence = query(
+            service,
+            "read",
+            expected=files.fingerprint,
+            path=file["path"],
+            file_sha256=file["file_sha256"],
+            start_line=1,
+            end_line=4,
+        )
+        assert "def prepare" in evidence.items[0]["content"]
+    else:
+        assert after.fingerprint == before.fingerprint
+        assert after.items == before.items
+        assert service.status("scope").last_build["reason"] == "code_parser_failed"
+
+
+@pytest.mark.skipif(sys.platform != "darwin", reason="Darwin uses parent-enforced RSS budgets")
+def test_parser_memory_monitor_failure_aborts_rebuild(repository, monkeypatch):
+    psutil = pytest.importorskip("psutil")
+
+    _, service = repository
+    before = query(service, "symbols", query="prepare")
+
+    def unavailable_memory(process):
+        raise psutil.AccessDenied(process.pid)
+
+    with monkeypatch.context() as patch:
+        patch.setattr(psutil.Process, "memory_info", unavailable_memory)
+        with pytest.raises(CodeError, match="code_parser_failed"):
+            service.index("scope", full=True)
+
+    after = query(service, "symbols", query="prepare")
+    assert after.fingerprint == before.fingerprint
+    assert after.items == before.items
+    assert service.status("scope").last_build["reason"] == "code_parser_failed"
+
+
+def test_parser_reconciles_buffered_progress_before_memory_failure(tmp_path, monkeypatch):
+    import select
+
+    from powercontext.builtin.code import process
+
+    job_file = tmp_path / "jobs.json"
+    job_file.write_text("{}")
+    popen = subprocess.Popen
+    workers = []
+
+    def buffered_worker(arguments, **kwargs):
+        worker = popen(
+            [
+                sys.executable,
+                "-c",
+                "import sys,time; sys.stdout.write('begin:0\\nend:0\\nbegin:1\\nend:1\\nbegin:2\\n'); sys.stdout.flush(); time.sleep(30)",
+            ],
+            **kwargs,
+        )
+        workers.append(worker)
+        assert worker.stdout is not None
+        ready, _, _ = select.select([worker.stdout], [], [], 5)
+        assert ready
+        return worker
+
+    with monkeypatch.context() as patch:
+        patch.setattr(process.subprocess, "Popen", buffered_worker)
+        patch.setattr(process, "_budget_failure", lambda *args: "memory_limit")
+        completed, failed, reason = process._batch(job_file, 3, time.monotonic() + 10, 30, 64 * 1024 * 1024)
+
+    assert completed == {0, 1}
+    assert fail
```

**File**: `uv.lock` (modified, +2/-0)
```diff
@@ -2722,6 +2722,7 @@ client = [
     { name = "pyyaml" },
 ]
 code = [
+    { name = "psutil", marker = "sys_platform == 'darwin'" },
     { name = "tree-sitter" },
     { name = "tree-sitter-go" },
     { name = "tree-sitter-javascript" },
@@ -2836,6 +2837,7 @@ requires-dist = [
     { name = "platformdirs", marker = "extra == 'cli'", specifier = ">=4,<5" },
     { name = "platformdirs", marker = "extra == 'server'", specifier = ">=4,<5" },
     { name = "prometheus-client", marker = "extra == 'server'", specifier = ">=0.21,<1" },
+    { name = "psutil", marker = "sys_platform == 'darwin' and extra == 'code'", specifier = ">=7.2,<8" },
     { name = "pycasbin", marker = "extra == 'server'", specifier = ">=2.8,<3" },
     { name = "pydantic", specifier = ">=2.10,<3" },
     { name = "pydantic-ai-slim", extras = ["anthropic", "openai"], marker = "extra == 'builtin'", specifier = ">=2.27.1,<3" },
```

---

### Incident Patch 14: `dd422f54` (2026-10-02)
**Commit Message**: build(deps): bump urllib3 from 2.7.0 to 2.8.0 (#1830)

Bumps [urllib3](https://github.com/urllib3/urllib3) from 2.7.0 to 2.8.0.
- [Release notes](https://github.com/urllib3/urllib3/releases)
- [Changelog](https://github.com/urllib3/urllib3/blob/main/CHANGES.rst)
- [Commits](https://github.com/urllib3/urllib3/compare/2.7.0...2.8.0)

---
updated-dependencies:
- dependency-name: urllib3
  dependency-version: 2.8.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -4769,11 +4769,11 @@ wheels = [
 
 [[package]]
 name = "urllib3"
-version = "2.7.0"
+version = "2.8.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz", hash = "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c", size = 433602, upload-time = "2026-05-07T16:13:18.596Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz", hash = "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63", size = 458972, upload-time = "2026-09-15T19:29:36.253Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl", hash = "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897", size = 131087, upload-time = "2026-05-07T16:13:17.151Z" },
+    { url = "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl", hash = "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3", size = 135717, upload-time = "2026-09-15T19:29:34.577Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 15: `a9cd64cd` (2026-10-02)
**Commit Message**: build(deps): bump pyjwt from 2.14.0 to 2.15.0 (#1831)

Bumps [pyjwt](https://github.com/jpadilla/pyjwt) from 2.14.0 to 2.15.0.
- [Release notes](https://github.com/jpadilla/pyjwt/releases)
- [Changelog](https://github.com/jpadilla/pyjwt/blob/master/CHANGELOG.rst)
- [Commits](https://github.com/jpadilla/pyjwt/compare/2.14.0...2.15.0)

---
updated-dependencies:
- dependency-name: pyjwt
  dependency-version: 2.15.0
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -3320,11 +3320,11 @@ wheels = [
 
 [[package]]
 name = "pyjwt"
-version = "2.14.0"
+version = "2.15.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/af/c3/8a3b59c25070cc61dc517fbdfa5dc0904670c96f605cc69759dc09166b99/pyjwt-2.14.0.tar.gz", hash = "sha256:77283c83fb56ecf566a886c757a714bc83668e38156de2cce8263302f42e0b86", size = 113177, upload-time = "2026-09-11T13:11:54.638Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/02/a5/5197bfd06417837ac079921c66fa6393f1dea3557272a263cebfef69e432/pyjwt-2.15.0.tar.gz", hash = "sha256:b11c5f9791d7bf51c2b39a81ed669f6b2dbbd669df2942f6c60167e9e3d1abe4", size = 120513, upload-time = "2026-09-23T16:56:00.689Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/9c/97/672cb32ce0dfea44b740cb7b4f97038463b9cf7c0ead1aacf595572851d6/pyjwt-2.14.0-py3-none-any.whl", hash = "sha256:ad0cef71c756a56e74863c2919cf0985f72decbcfcb550ee2f422e7c62b5eedc", size = 32896, upload-time = "2026-09-11T13:11:53.409Z" },
+    { url = "https://files.pythonhosted.org/packages/e8/55/40e45bf052ee8ee12a4dfd785519660f8effa7b065442b91646ec6828619/pyjwt-2.15.0-py3-none-any.whl", hash = "sha256:7a3742debf6b879e912dbb9819ceec1594be812452b78c5f2e2dfc56564954f8", size = 33680, upload-time = "2026-09-23T16:55:59.241Z" },
 ]
 
 [package.optional-dependencies]
```

#### Recent Merged Pull Requests:
- **PR #1852** (2026-10-05): build(deps): bump jdx/mise-action from 2.4.4 to 5.0.1 (@dependabot[bot])
- **PR #1851** (2026-10-05): feat(e2e): run paired continuation workloads with Pi (@Fengzdadi)
- **PR #1849** (2026-10-05): chore(authz): remove legacy topic-memory owner rows at startup (@Lkx-JY)
- **PR #1847** (2026-10-04): fix(topic-memory): authorize background publication by Scope authority (@Lkx-JY)
- **PR #1846** (2026-10-04): fix(e2e): give the usage-record observation window the recorder's budget (@jasondeng1997)
- **PR #1845** (2026-10-04): build(deps): bump brace-expansion from 2.1.4 to 2.1.7 in /integrations/opencode/plugins/powercontext (@dependabot[bot])
- **PR #1844** (2026-10-04): build(deps): bump pyjwt from 2.13.0 to 2.15.0 in /e2e/bub (@dependabot[bot])
- **PR #1843** (2026-10-04): build(deps): bump urllib3 from 2.7.0 to 2.8.0 in /e2e/bub (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
