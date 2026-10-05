# Forensic Learning Record (Deep Inspection): Yeachan-Heo/oh-my-claudecode

> **Canonical Artifact**: `07_PROJECT_LEARNING/yeachan-heo-oh-my-claudecode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:06:10.448Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Yeachan-Heo/oh-my-claudecode`
- **Description**: Teams-first Multi-agent orchestration for Claude Code
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 39479 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmark/analyze_failures.py`
```
#!/usr/bin/env python3
"""
SWE-bench Failure Analysis Tool

Analyze failed instances to identify patterns, categorize failures,
and understand differences between vanilla and OMC runs.

Usage:
    python analyze_failures.py --results results/vanilla/ --predictions predictions.json
    python analyze_failures.py --vanilla results/vanilla/ --omc results/omc/ --compare
"""

import argparse
import json
import logging
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Common failure pattern definitions
FAILURE_PATTERNS = {
    "syntax_error": [
        r"SyntaxError",
        r"IndentationError",
        r"TabError",
    ],
    "import_error": [
        r"ImportError",
        r"ModuleNotFoundError",
        r"No module named",
    ],
    "type_error": [
        r"TypeError",
        r"expected .+ got .+",
    ],
    "attribute_error": [
        r"AttributeError",
        r"has no attribute",
    ],
    "assertion_error": [
        r"AssertionError",
        r"assert .+ failed",
    ],
    "test_failure": [
        r"FAILED",
        r"test.*failed",
        r"failures=\d+",
    ],
    "timeout": [
        r"timeout",
        r"timed out",
        r"TimeoutError",
    ],
    "empty_patch": [
        r"empty patch",
        r"no changes",
        r"patch is empty",
    ],
    "apply_failure": [
        r"patch.*failed",
        r"could not apply",
        r"git apply.*failed",
        r"hunks? FAILED",
    ],
    "runtime_error": [
        r"RuntimeError",
        r"Exception",
        r"Error:",
    ],
    "value_error": [
        r"ValueError",
        r"invalid .+ value",
    ],
    "key_error": [
        r"KeyError",
        r"not found in",
    ],
}


def load_results(results_dir: Path) -> dict[str, Any]:
    """Load evaluation results."""
    results = {"instances": {}}

    summary_file = results_dir / "summary.json"
    if summary_file.exists():
        with open(summary_file) as f:
            results = json.load(f)

    # Also load from logs if available
    logs_dir = results_dir / "logs"
    if logs_dir.exists():
        for log_file in logs_dir.glob("*.log"):
            instance_id = log_file.stem
            if instance_id not in results.get("instances", {}):
                results.setdefault("instances", {})[instance_id] = {}

            results["instances"][instance_id]["log_content"] = log_file.read_text()

    return results


def load_predictions(predictions_file: Path) -> dict[str, Any]:
    """Load predictions with metadata."""
    with open(predictions_file) as f:
        predictions = json.load(f)

    if isinstance(predictions, list):
        predictions = {p["instance_id"]: p for p in predictions}

    return predictions


def categorize_failure(
    instance_id: str,
    instance_data: dict[str, Any],
    prediction_data: dict[str, Any] | None = None
) -> dict[str, Any]:
    """
    Categorize a single failure instance.

    Returns:
        Dictionary with:
        - category: Primary failure category
        - subcategories: Additional categories
        - error_message: Extracted error message
        - confidence: Confidence in categorization
    """
    result = {
        "instance_id": instance_id,
        "category": "unknown",
        "subcategories": [],
        "error_message": None,
        "confidence": 0.0,
        "details": {}
    }

    # Get content to analyze
    log_content = instance_data.get("log_content", "")
    error_message = instance_data.get("error_message", "")
    patch = ""

    if prediction_data:
        patch = prediction_data.get("model_patch", prediction_data.get("patch", ""))
        result["details"]["patch_length"] = len(patch)
        result["details"]["patch_lines"] = patch.count("\n") + 1 if patch else 0

    content_to_analyze = f"{log_content}\n{error_message}"

    # Check for empty patch first
    if prediction_data and not patch.strip():
        result["category"] = "empty_patch"
        result["confidence"] = 1.0
        result["error_message"] = "No patch generated"
        return result

    # Match against failure patterns
    matched_categories = []

    for category, patterns in FAILURE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, content_to_analyze, re.IGNORECASE):
                matched_categories.append(category)
                break

    if matched_categories:
        result["category"] = matched_categories[0]
        result["subcategories"] = matched_categories[1:]
        result["confidence"] = 0.8 if len(matched_categories) == 1 else 0.6

    # Extract specific error message
    error_patterns = [
        r"(Error: .+?)(?:\n|$)",
        r"(Exception: .+?)(?:\n|$)",
        r"(FAILED .+?)(?:\n|$)",
        r"(AssertionError: .+?)(?:\n|$)",
    ]

    for pattern in error_patterns:
        match = re.search(pattern, content_to_analyze)
        if match:
            result["error_message"] = match.group(1).strip()[:200]
            break

    if not result["error_message"] and error_message:
        result["error_message"] = error_message[:200]

    return result


def analyze_failures(
    results: dict[str, Any],
    predictions: dict[str, Any] | None = None
) -> dict[str, Any]:
    """
    Analyze all failures in a results set.

    Returns:
        Comprehensive failure analysis including:
        - category_counts: Count by failure category
        - failures: List of categorized failures
        - patterns: Common failure patterns
        - recommendations: Suggested improvements
    """
    analysis = {
        "timestamp": datetime.now().isoformat(),
        "total_instances": results.get("total", len(results.get("instances", {}))),
        "total_failures": 0,
        "category_counts": Counter(),
        "failures": [],
        "patterns": {},
        "recommendations": []
    }

    # Analyze each failed instance
    for instance_id, instance_data in results.get("instances", {}).items():
        status = instance_data.get("status", "unknown")

        if status in ("passed",):
            continue

        analysis["total_failures"] += 1

        pred_data = predictions.get(instance_id) if predictions else None
        failure_info = categorize_failure(instance_id, instance_data, pred_data)

        analysis["category_counts"][failure_info["category"]] += 1
        analysis["failures"].append(failure_info)

    # Convert Counter to dict for JSON
    analysis["category_counts"] = dict(analysis["category_counts"])

    # Identify patterns
    analysis["patterns"] = identify_patterns(analysis["failures"])

    # Generate recommendations
    analysis["recommendations"] = generate_recommendations(analysis)

    return analysis


def identify_patterns(failures: list[dict[str, Any]]) -> dict[str, Any]:
    """Identify common patterns across failures."""
    patterns = {
        "by_repo": defaultdict(list),
        "by_error_type": defaultdict(list),
        "common_errors": [],
    }

    error_messages = []

    for failure in failures:
        instance_id = failure["instance_id"]

        # Group by repository
        if "__" in instance_id:
            repo = instance_id.split("__")[0]
            patterns["by_repo"][repo].append(instance_id)

        # Group by error type
        patterns["by_error_type"][failure["category"]].append(instance_id)

        # Collect error messages for pattern detection
        if failure.get("error_message"):
            error_messages.append(failure["error_message"])

    # Find most common error message fragments
    if error_messages:
        # Simple n-gram analysis for common phrases
        word_counts = Counter()
        for msg in error_messages:
            words = msg.lower().split()
            for i in range(len(words) - 2):
                phrase = " ".j
```

### Core Architecture Module: `benchmark/compare_results.py`
```
#!/usr/bin/env python3
"""
SWE-bench Results Comparison Tool

Compare evaluation results between vanilla Claude Code and OMC-enhanced runs.
Generates detailed comparison reports in multiple formats.

Usage:
    python compare_results.py --vanilla results/vanilla/ --omc results/omc/
    python compare_results.py --vanilla results/vanilla/ --omc results/omc/ --output comparison/
"""

import argparse
import csv
import json
import logging
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def load_results(results_dir: Path) -> dict[str, Any]:
    """
    Load evaluation results from a results directory.

    Looks for:
    - summary.json (from evaluate.py)
    - predictions.json (for token/time metadata)
    - Individual instance results
    """
    results = {
        "instances": {},
        "total": 0,
        "passed": 0,
        "failed": 0,
        "pass_rate": 0.0,
        "metadata": {}
    }

    # Load summary if exists
    summary_file = results_dir / "summary.json"
    if summary_file.exists():
        with open(summary_file) as f:
            summary = json.load(f)
            results.update(summary)

    # Load predictions for metadata (try both JSONL and JSON formats)
    predictions_file = results_dir / "predictions.jsonl"
    if not predictions_file.exists():
        predictions_file = results_dir / "predictions.json"
    if not predictions_file.exists():
        # Try parent directory
        predictions_file = results_dir.parent / "predictions.jsonl"
        if not predictions_file.exists():
            predictions_file = results_dir.parent / "predictions.json"

    if predictions_file.exists():
        predictions = []
        with open(predictions_file) as f:
            content = f.read().strip()
            if content:
                # Try JSON first (most common case)
                try:
                    data = json.loads(content)
                    if isinstance(data, dict):
                        predictions = [{"instance_id": k, **v} for k, v in data.items()]
                    elif isinstance(data, list):
                        predictions = data
                except json.JSONDecodeError:
                    # Fall back to JSONL (one JSON object per line)
                    try:
                        for line in content.split('\n'):
                            if line.strip():
                                predictions.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

        # Extract metadata per instance
        for pred in predictions:
            instance_id = pred.get("instance_id")
            if not instance_id:
                continue

            if instance_id not in results["instances"]:
                results["instances"][instance_id] = {}

            meta = results["instances"][instance_id]
            meta["tokens_input"] = pred.get("tokens_input", pred.get("input_tokens", 0))
            meta["tokens_output"] = pred.get("tokens_output", pred.get("output_tokens", 0))
            meta["tokens_total"] = meta.get("tokens_input", 0) + meta.get("tokens_output", 0)
            meta["time_seconds"] = pred.get("time_seconds", pred.get("duration", 0))
            meta["cost_usd"] = pred.get("cost_usd", pred.get("cost", 0))

    # Calculate aggregates
    total_tokens = sum(
        inst.get("tokens_total", 0)
        for inst in results["instances"].values()
    )
    total_time = sum(
        inst.get("time_seconds", 0)
        for inst in results["instances"].values()
    )
    total_cost = sum(
        inst.get("cost_usd", 0)
        for inst in results["instances"].values()
    )

    results["metadata"]["total_tokens"] = total_tokens
    results["metadata"]["total_time_seconds"] = total_time
    results["metadata"]["total_cost_usd"] = total_cost

    if results["total"] > 0:
        results["metadata"]["avg_tokens"] = total_tokens / results["total"]
        results["metadata"]["avg_time_seconds"] = total_time / results["total"]
        results["metadata"]["avg_cost_usd"] = total_cost / results["total"]

    return results


def compare_results(
    vanilla_results: dict[str, Any],
    omc_results: dict[str, Any]
) -> dict[str, Any]:
    """
    Compare vanilla and OMC results.

    Returns detailed comparison including:
    - Overall metrics comparison
    - Per-instance comparison
    - Improvement analysis
    """
    comparison = {
        "timestamp": datetime.now().isoformat(),
        "overall": {},
        "improvements": {},
        "regressions": {},
        "per_instance": {},
        "categories": defaultdict(lambda: {"vanilla": 0, "omc": 0})
    }

    # Overall comparison
    vanilla_pass = vanilla_results.get("passed", 0)
    omc_pass = omc_results.get("passed", 0)
    vanilla_total = vanilla_results.get("total", 0)
    omc_total = omc_results.get("total", 0)

    comparison["overall"] = {
        "vanilla": {
            "total": vanilla_total,
            "passed": vanilla_pass,
            "failed": vanilla_results.get("failed", 0),
            "pass_rate": vanilla_results.get("pass_rate", 0),
            "avg_tokens": vanilla_results.get("metadata", {}).get("avg_tokens", 0),
            "avg_time_seconds": vanilla_results.get("metadata", {}).get("avg_time_seconds", 0),
            "avg_cost_usd": vanilla_results.get("metadata", {}).get("avg_cost_usd", 0),
            "total_tokens": vanilla_results.get("metadata", {}).get("total_tokens", 0),
            "total_time_seconds": vanilla_results.get("metadata", {}).get("total_time_seconds", 0),
            "total_cost_usd": vanilla_results.get("metadata", {}).get("total_cost_usd", 0),
        },
        "omc": {
            "total": omc_total,
            "passed": omc_pass,
            "failed": omc_results.get("failed", 0),
            "pass_rate": omc_results.get("pass_rate", 0),
            "avg_tokens": omc_results.get("metadata", {}).get("avg_tokens", 0),
            "avg_time_seconds": omc_results.get("metadata", {}).get("avg_time_seconds", 0),
            "avg_cost_usd": omc_results.get("metadata", {}).get("avg_cost_usd", 0),
            "total_tokens": omc_results.get("metadata", {}).get("total_tokens", 0),
            "total_time_seconds": omc_results.get("metadata", {}).get("total_time_seconds", 0),
            "total_cost_usd": omc_results.get("metadata", {}).get("total_cost_usd", 0),
        },
        "delta": {
            "pass_rate": omc_results.get("pass_rate", 0) - vanilla_results.get("pass_rate", 0),
            "passed": omc_pass - vanilla_pass,
        }
    }

    # Calculate relative improvements
    if vanilla_pass > 0:
        comparison["overall"]["delta"]["pass_improvement_pct"] = (
            (omc_pass - vanilla_pass) / vanilla_pass * 100
        )
    else:
        comparison["overall"]["delta"]["pass_improvement_pct"] = 100.0 if omc_pass > 0 else 0.0

    vanilla_tokens = vanilla_results.get("metadata", {}).get("avg_tokens", 0)
    omc_tokens = omc_results.get("metadata", {}).get("avg_tokens", 0)
    if vanilla_tokens > 0:
        comparison["overall"]["delta"]["token_change_pct"] = (
            (omc_tokens - vanilla_tokens) / vanilla_tokens * 100
        )

    vanilla_time = vanilla_results.get("metadata", {}).get("avg_time_seconds", 0)
    omc_time = omc_results.get("metadata", {}).get("avg_time_seconds", 0)
    if vanilla_time > 0:
        comparison["overall"]["delta"]["time_change_pct"] = (
            (omc_time - vanilla_time) / vanilla_time * 100
        )

    # Per-instance comparison
    all_instances = set(vanilla_results.get("instances", {}).keys()) | \
                   set(omc_results.get("instances", {}).keys())

    improvements = []
    regressions = []

    for instance_id in all_instances:
        vanilla_inst = vanilla_result
```

### Core Architecture Module: `benchmark/evaluate.py`
```
#!/usr/bin/env python3
"""
SWE-bench Evaluation Runner

Wrapper around swebench.harness.run_evaluation to evaluate predictions
against the official SWE-bench harness.

Usage:
    python evaluate.py --predictions predictions.json --output results/
    python evaluate.py --predictions predictions.json --dataset swe-bench-verified --max-workers 4
"""

import argparse
import json
import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def load_predictions(predictions_file: Path) -> list[dict[str, Any]]:
    """Load predictions from JSON or JSONL file."""
    logger.info(f"Loading predictions from {predictions_file}")

    predictions = []
    with open(predictions_file) as f:
        content = f.read()
        if not content.strip():
            logger.warning("Empty predictions file")
            return predictions

        # Check if it's JSONL by looking for newlines and trying to parse first line
        lines = content.strip().split('\n')
        is_jsonl = False

        # Check if file has .jsonl extension
        if predictions_file.suffix == '.jsonl':
            is_jsonl = True
        # Or if it's multi-line with each line being a valid JSON object with instance_id
        elif len(lines) > 1:
            try:
                first_line = lines[0].strip()
                if first_line:
                    obj = json.loads(first_line)
                    # Check if it has instance_id field (JSONL format indicator)
                    if isinstance(obj, dict) and 'instance_id' in obj:
                        is_jsonl = True
            except json.JSONDecodeError:
                pass

        # Try JSONL format if detected
        if is_jsonl:
            try:
                for line in lines:
                    if line.strip():
                        predictions.append(json.loads(line))
                logger.info(f"Loaded {len(predictions)} predictions from JSONL format")
                return predictions
            except json.JSONDecodeError as e:
                logger.warning(f"JSONL parsing failed, trying JSON: {e}")

        content = content.strip()

        # Try JSON format
        try:
            data = json.loads(content)
            if isinstance(data, dict):
                # Handle dict format {instance_id: prediction}
                predictions = []
                for k, v in data.items():
                    if isinstance(v, dict):
                        pred = {"instance_id": k, **v}
                        if "model_patch" not in pred:
                            pred["model_patch"] = v.get("patch", "")
                    else:
                        # v is a string (the patch itself)
                        pred = {"instance_id": k, "model_patch": str(v)}
                    predictions.append(pred)
                logger.info(f"Loaded {len(predictions)} predictions from JSON dict format")
            elif isinstance(data, list):
                predictions = data
                logger.info(f"Loaded {len(predictions)} predictions from JSON array format")
            return predictions
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse predictions file: {e}")
            return predictions

    return predictions


def validate_predictions(predictions: list[dict[str, Any]]) -> list[str]:
    """Validate predictions format and return list of issues."""
    issues = []

    for i, pred in enumerate(predictions):
        if "instance_id" not in pred:
            issues.append(f"Prediction {i}: missing 'instance_id'")
        if "model_patch" not in pred:
            issues.append(f"Prediction {i}: missing 'model_patch'")
        elif not pred["model_patch"]:
            issues.append(f"Prediction {i} ({pred.get('instance_id', 'unknown')}): empty patch")

    return issues


def run_swebench_evaluation(
    predictions_file: Path,
    output_dir: Path,
    dataset: str = "princeton-nlp/SWE-bench_Verified",
    max_workers: int = 4,
    timeout: int = 1800,
    run_id: str | None = None
) -> dict[str, Any]:
    """
    Run SWE-bench evaluation harness.

    Args:
        predictions_file: Path to predictions JSON
        output_dir: Directory for evaluation results
        dataset: SWE-bench dataset to use
        max_workers: Number of parallel workers
        timeout: Timeout per instance in seconds
        run_id: Optional run identifier

    Returns:
        Dictionary with evaluation results
    """
    if run_id is None:
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    output_dir = output_dir / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Running SWE-bench evaluation")
    logger.info(f"  Predictions: {predictions_file}")
    logger.info(f"  Output: {output_dir}")
    logger.info(f"  Dataset: {dataset}")
    logger.info(f"  Workers: {max_workers}")

    # Build command for swebench harness
    cmd = [
        sys.executable, "-m", "swebench.harness.run_evaluation",
        "--predictions_path", str(predictions_file),
        "--swe_bench_tasks", dataset,
        "--log_dir", str(output_dir / "logs"),
        "--testbed", str(output_dir / "testbed"),
        "--skip_existing",
        "--timeout", str(timeout),
        "--num_processes", str(max_workers),
    ]

    logger.info(f"Command: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout * len(load_predictions(predictions_file)) + 3600
        )

        if result.returncode != 0:
            logger.error(f"Evaluation failed with code {result.returncode}")
            logger.error(f"stderr: {result.stderr}")

        # Save raw output
        (output_dir / "stdout.txt").write_text(result.stdout)
        (output_dir / "stderr.txt").write_text(result.stderr)

    except subprocess.TimeoutExpired:
        logger.error("Evaluation timed out")
        return {"error": "timeout", "run_id": run_id}
    except FileNotFoundError:
        logger.error("swebench package not found. Install with: pip install swebench")
        return {"error": "swebench_not_installed", "run_id": run_id}

    # Parse results
    results = parse_evaluation_results(output_dir / "logs")
    results["run_id"] = run_id
    results["output_dir"] = str(output_dir)

    # Save summary
    summary_file = output_dir / "summary.json"
    with open(summary_file, "w") as f:
        json.dump(results, f, indent=2)

    logger.info(f"Results saved to {summary_file}")

    return results


def parse_evaluation_results(logs_dir: Path) -> dict[str, Any]:
    """
    Parse evaluation results from SWE-bench logs directory.

    Returns:
        Dictionary with parsed results including:
        - total: Total number of instances
        - passed: Number of passed instances
        - failed: Number of failed instances
        - error: Number of error instances
        - pass_rate: Pass rate percentage
        - instances: Per-instance results
    """
    results = {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "error": 0,
        "pass_rate": 0.0,
        "instances": {}
    }

    if not logs_dir.exists():
        logger.warning(f"Logs directory not found: {logs_dir}")
        return results

    # Parse individual instance logs
    for log_file in logs_dir.glob("*.log"):
        instance_id = log_file.stem
        results["total"] += 1

        log_content = log_file.read_text()

        # Determine result from log content
        instance_result = {
            "instance_id": instance_id,
            "status": "unknown",
            "tests_passed": 0,
            "tests_failed": 0,
            "error_message": None
        }

        if "PASS" in log_content or "All tests passed" in l
```

### Core Architecture Module: `benchmark/run_benchmark.py`
```
#!/usr/bin/env python3
"""
SWE-bench Benchmark Runner for Claude Code (Vanilla vs OMC)

This script evaluates Claude Code with and without oh-my-claudecode orchestration
on the SWE-bench Verified dataset.

Usage:
    python run_benchmark.py --mode vanilla --limit 10
    python run_benchmark.py --mode omc --output-dir ./predictions/omc
    python run_benchmark.py --mode vanilla --resume checkpoint.json
"""

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

try:
    from datasets import load_dataset
except ImportError:
    print("Error: datasets library not installed. Run: pip install datasets")
    sys.exit(1)


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("benchmark.log"),
    ],
)
logger = logging.getLogger(__name__)


@dataclass
class BenchmarkConfig:
    """Configuration for benchmark run."""

    dataset: str = "princeton-nlp/SWE-bench_Verified"
    mode: str = "vanilla"  # vanilla or omc
    output_dir: Path = field(default_factory=lambda: Path("./predictions"))
    max_workers: int = 1
    timeout: int = 1800  # 30 minutes default
    resume: Optional[Path] = None
    limit: Optional[int] = None
    retries: int = 3
    retry_delay: int = 30
    model: str = "claude-sonnet-5"
    skip: int = 0


@dataclass
class TaskResult:
    """Result from processing a single task instance."""

    instance_id: str
    success: bool
    patch: Optional[str] = None
    error: Optional[str] = None
    duration: float = 0.0
    token_usage: dict = field(default_factory=dict)
    retries_used: int = 0


@dataclass
class Checkpoint:
    """Checkpoint state for resuming interrupted runs."""

    completed_instances: list = field(default_factory=list)
    failed_instances: list = field(default_factory=list)
    total_instances: int = 0
    start_time: str = ""
    mode: str = ""
    config: dict = field(default_factory=dict)


class SWEBenchRunner:
    """Main benchmark runner for SWE-bench evaluation."""

    def __init__(self, config: BenchmarkConfig):
        self.config = config
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        self.checkpoint_path = self.config.output_dir / "checkpoint.json"
        self.predictions_path = self.config.output_dir / "predictions.jsonl"
        self.stats_path = self.config.output_dir / "stats.json"
        self.checkpoint = self._load_checkpoint()
        self.stats = {
            "total": 0,
            "completed": 0,
            "failed": 0,
            "total_tokens": 0,
            "total_duration": 0.0,
        }

    def _load_checkpoint(self) -> Checkpoint:
        """Load checkpoint from file if resuming."""
        if self.config.resume and self.config.resume.exists():
            with open(self.config.resume) as f:
                data = json.load(f)
            logger.info(f"Resuming from checkpoint: {len(data['completed_instances'])} completed")
            return Checkpoint(**data)
        return Checkpoint(
            start_time=datetime.now().isoformat(),
            mode=self.config.mode,
            config={
                "dataset": self.config.dataset,
                "timeout": self.config.timeout,
                "max_workers": self.config.max_workers,
            },
        )

    def _save_checkpoint(self):
        """Save current checkpoint state."""
        with open(self.checkpoint_path, "w") as f:
            json.dump(
                {
                    "completed_instances": self.checkpoint.completed_instances,
                    "failed_instances": self.checkpoint.failed_instances,
                    "total_instances": self.checkpoint.total_instances,
                    "start_time": self.checkpoint.start_time,
                    "mode": self.checkpoint.mode,
                    "config": self.checkpoint.config,
                },
                f,
                indent=2,
            )

    def _save_prediction(self, result: TaskResult):
        """Append prediction to JSONL file in SWE-bench format."""
        if result.success and result.patch:
            prediction = {
                "instance_id": result.instance_id,
                "model_name_or_path": f"claude-code-{self.config.mode}",
                "model_patch": result.patch,
            }
            with open(self.predictions_path, "a") as f:
                f.write(json.dumps(prediction) + "\n")

    def _save_stats(self):
        """Save run statistics."""
        self.stats["success_rate"] = (
            self.stats["completed"] / self.stats["total"] * 100
            if self.stats["total"] > 0
            else 0
        )
        self.stats["avg_duration"] = (
            self.stats["total_duration"] / self.stats["total"]
            if self.stats["total"] > 0
            else 0
        )
        with open(self.stats_path, "w") as f:
            json.dump(self.stats, f, indent=2)

    def load_dataset(self) -> list[dict]:
        """Load SWE-bench dataset from HuggingFace."""
        logger.info(f"Loading dataset: {self.config.dataset}")
        try:
            dataset = load_dataset(self.config.dataset, split="test")
            instances = list(dataset)
            logger.info(f"Loaded {len(instances)} instances")

            # Filter out already completed instances if resuming
            if self.checkpoint.completed_instances:
                instances = [
                    i
                    for i in instances
                    if i["instance_id"] not in self.checkpoint.completed_instances
                ]
                logger.info(f"After filtering completed: {len(instances)} remaining")

            # Apply skip if specified
            if self.config.skip > 0:
                instances = instances[self.config.skip :]
                logger.info(f"Skipped first {self.config.skip} instances, {len(instances)} remaining")

            # Apply limit if specified
            if self.config.limit:
                instances = instances[: self.config.limit]
                logger.info(f"Limited to {len(instances)} instances")

            self.checkpoint.total_instances = len(instances)
            return instances
        except Exception as e:
            logger.error(f"Failed to load dataset: {e}")
            raise

    def _setup_repo(self, instance: dict, work_dir: Path) -> bool:
        """Clone repo and checkout base commit."""
        repo = instance["repo"]
        base_commit = instance["base_commit"]

        try:
            # Clone the repo
            repo_url = f"https://github.com/{repo}.git"
            logger.debug(f"Cloning {repo_url}")
            subprocess.run(
                ["git", "clone", "--depth", "100", repo_url, str(work_dir)],
                check=True,
                capture_output=True,
                timeout=300,
            )

            # Fetch the specific commit if needed and checkout
            subprocess.run(
                ["git", "fetch", "--depth", "100", "origin", base_commit],
                cwd=work_dir,
                capture_output=True,
                timeout=120,
            )
            subprocess.run(
                ["git", "checkout", base_commit],
                cwd=work_dir,
                check=True,
                capture_output=True,
                timeout=60,
            )
            return True
        except subprocess.TimeoutExpired:
            logger.error(f"Timeout setting up repo {repo}")
            return False
        except subprocess.CalledProcessError as e:
            logger.error(f"Git error for {repo}: {e.stderr.decode() if e.stderr else e}")
            return False
```

### Core Architecture Module: `benchmarks/code-reviewer/run-benchmark.ts`
```
/**
 * Benchmark runner for code-reviewer agent evaluation.
 *
 * Compares the new merged code-reviewer (which absorbed quality-reviewer)
 * against the old quality-reviewer prompt to measure review quality.
 *
 * Usage:
 *   npx tsx benchmarks/code-reviewer/run-benchmark.ts [options]
 *
 * Options:
 *   --agent <name>       Run a single agent variant only
 *   --fixture <id>       Run a single fixture only
 *   --output-dir <path>  Where to write results
 *   --model <model>      Claude model to use (default: claude-opus-4-6)
 *   --dry-run            Validate pipeline without API calls
 */

import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import {
  parseCliArgs,
  loadFixtures,
  loadAgentPrompt,
  runBenchmark,
  printSummaryTable,
  writeReports,
  exitCodeForResults,
} from '../shared/runner.ts';
import { parseGenericOutput } from '../shared/parser.ts';
import type { ParsedAgentOutput } from '../shared/types.ts';

// ============================================================
// Directory resolution
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BENCHMARK_DIR = __dirname;
const REPO_ROOT = resolve(__dirname, '..', '..');

// ============================================================
// Agent configurations
// ============================================================

const AGENT_NEW = 'code-reviewer';
const AGENT_OLD = 'quality-reviewer';

function buildUserMessage(fixtureContent: string): string {
  return `Review the following code for quality, security, and correctness issues:\n\n${fixtureContent}`;
}

// ============================================================
// Parser
// ============================================================

function parseOutput(rawOutput: string): ParsedAgentOutput {
  return parseGenericOutput(rawOutput);
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const cliArgs = parseCliArgs(
    [AGENT_NEW, AGENT_OLD],
    join(BENCHMARK_DIR, 'results'),
  );

  // Load agent prompts
  console.log('Loading agent prompts...');
  const agents = cliArgs.agents.map((agentType) => ({
    agentType,
    systemPrompt: loadAgentPrompt(agentType, BENCHMARK_DIR, REPO_ROOT),
    userMessageTemplate: buildUserMessage,
  }));

  // Load fixtures
  console.log('Loading fixtures...');
  const fixtures = loadFixtures(BENCHMARK_DIR, cliArgs.fixture);
  console.log(`  ${fixtures.length} fixture(s) found: ${fixtures.map((f) => f.id).join(', ')}`);

  // Run benchmark
  const results = await runBenchmark({
    benchmarkDir: BENCHMARK_DIR,
    agents,
    fixtures,
    groundTruthDir: join(BENCHMARK_DIR, 'ground-truth'),
    parseFn: parseOutput,
    cliArgs,
  });

  if (results.length === 0) return; // dry-run

  // Print results
  printSummaryTable(results, cliArgs.agents);

  // Write reports
  console.log('\nGenerating reports...');
  writeReports(
    cliArgs.outputDir,
    results,
    cliArgs.agents[0],
    cliArgs.agents[1] ?? cliArgs.agents[0],
    cliArgs.model,
  );

  process.exitCode = exitCodeForResults(results);

  console.log('\nBenchmark complete.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

```

### Core Architecture Module: `benchmarks/debugger/run-benchmark.ts`
```
/**
 * Benchmark runner for debugger agent evaluation.
 *
 * Compares the new merged debugger (which absorbed build-fixer)
 * against the old build-fixer prompt to measure diagnostic quality.
 *
 * Usage:
 *   npx tsx benchmarks/debugger/run-benchmark.ts [options]
 *
 * Options:
 *   --agent <name>       Run a single agent variant only
 *   --fixture <id>       Run a single fixture only
 *   --output-dir <path>  Where to write results
 *   --model <model>      Claude model to use (default: claude-opus-4-6)
 *   --dry-run            Validate pipeline without API calls
 */

import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import {
  parseCliArgs,
  loadFixtures,
  loadAgentPrompt,
  runBenchmark,
  printSummaryTable,
  writeReports,
  exitCodeForResults,
} from '../shared/runner.ts';
import { parseGenericOutput } from '../shared/parser.ts';
import type { ParsedAgentOutput } from '../shared/types.ts';

// ============================================================
// Directory resolution
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BENCHMARK_DIR = __dirname;
const REPO_ROOT = resolve(__dirname, '..', '..');

// ============================================================
// Agent configurations
// ============================================================

const AGENT_NEW = 'debugger';
const AGENT_OLD = 'build-fixer';

function buildUserMessage(fixtureContent: string): string {
  return `Diagnose the following bug and recommend fixes:\n\n${fixtureContent}`;
}

// ============================================================
// Parser
// ============================================================

function parseOutput(rawOutput: string): ParsedAgentOutput {
  return parseGenericOutput(rawOutput);
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const cliArgs = parseCliArgs(
    [AGENT_NEW, AGENT_OLD],
    join(BENCHMARK_DIR, 'results'),
  );

  // Load agent prompts
  console.log('Loading agent prompts...');
  const agents = cliArgs.agents.map((agentType) => ({
    agentType,
    systemPrompt: loadAgentPrompt(agentType, BENCHMARK_DIR, REPO_ROOT),
    userMessageTemplate: buildUserMessage,
  }));

  // Load fixtures
  console.log('Loading fixtures...');
  const fixtures = loadFixtures(BENCHMARK_DIR, cliArgs.fixture);
  console.log(`  ${fixtures.length} fixture(s) found: ${fixtures.map((f) => f.id).join(', ')}`);

  // Run benchmark
  const results = await runBenchmark({
    benchmarkDir: BENCHMARK_DIR,
    agents,
    fixtures,
    groundTruthDir: join(BENCHMARK_DIR, 'ground-truth'),
    parseFn: parseOutput,
    cliArgs,
  });

  if (results.length === 0) return; // dry-run

  // Print results
  printSummaryTable(results, cliArgs.agents);

  // Write reports
  console.log('\nGenerating reports...');
  writeReports(
    cliArgs.outputDir,
    results,
    cliArgs.agents[0],
    cliArgs.agents[1] ?? cliArgs.agents[0],
    cliArgs.model,
  );

  process.exitCode = exitCodeForResults(results);

  console.log('\nBenchmark complete.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

```

### Core Architecture Module: `benchmarks/executor/run-benchmark.ts`
```
/**
 * Benchmark runner for executor agent evaluation.
 *
 * Compares the new merged executor (which absorbed deep-executor)
 * against the old deep-executor prompt to measure implementation quality.
 *
 * Usage:
 *   npx tsx benchmarks/executor/run-benchmark.ts [options]
 *
 * Options:
 *   --agent <name>       Run a single agent variant only
 *   --fixture <id>       Run a single fixture only
 *   --output-dir <path>  Where to write results
 *   --model <model>      Claude model to use (default: claude-opus-4-6)
 *   --dry-run            Validate pipeline without API calls
 */

import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import {
  parseCliArgs,
  loadFixtures,
  loadAgentPrompt,
  runBenchmark,
  printSummaryTable,
  writeReports,
  exitCodeForResults,
} from '../shared/runner.ts';
import { parseGenericOutput } from '../shared/parser.ts';
import type { ParsedAgentOutput } from '../shared/types.ts';

// ============================================================
// Directory resolution
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BENCHMARK_DIR = __dirname;
const REPO_ROOT = resolve(__dirname, '..', '..');

// ============================================================
// Agent configurations
// ============================================================

const AGENT_NEW = 'executor';
const AGENT_OLD = 'deep-executor';

function buildUserMessage(fixtureContent: string): string {
  return `Implement the following task. Describe your approach, the files you would modify, and the changes you would make:\n\n${fixtureContent}`;
}

// ============================================================
// Parser
// ============================================================

function parseOutput(rawOutput: string): ParsedAgentOutput {
  return parseGenericOutput(rawOutput);
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const cliArgs = parseCliArgs(
    [AGENT_NEW, AGENT_OLD],
    join(BENCHMARK_DIR, 'results'),
  );

  // Load agent prompts
  console.log('Loading agent prompts...');
  const agents = cliArgs.agents.map((agentType) => ({
    agentType,
    systemPrompt: loadAgentPrompt(agentType, BENCHMARK_DIR, REPO_ROOT),
    userMessageTemplate: buildUserMessage,
  }));

  // Load fixtures
  console.log('Loading fixtures...');
  const fixtures = loadFixtures(BENCHMARK_DIR, cliArgs.fixture);
  console.log(`  ${fixtures.length} fixture(s) found: ${fixtures.map((f) => f.id).join(', ')}`);

  // Run benchmark
  const results = await runBenchmark({
    benchmarkDir: BENCHMARK_DIR,
    agents,
    fixtures,
    groundTruthDir: join(BENCHMARK_DIR, 'ground-truth'),
    parseFn: parseOutput,
    cliArgs,
  });

  if (results.length === 0) return; // dry-run

  // Print results
  printSummaryTable(results, cliArgs.agents);

  // Write reports
  console.log('\nGenerating reports...');
  writeReports(
    cliArgs.outputDir,
    results,
    cliArgs.agents[0],
    cliArgs.agents[1] ?? cliArgs.agents[0],
    cliArgs.model,
  );

  process.exitCode = exitCodeForResults(results);

  console.log('\nBenchmark complete.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

```

### Core Architecture Module: `benchmarks/harsh-critic/fixtures/code/code-payment-handler.ts`
```
/**
 * Payment Handler Module
 *
 * Handles payment processing for subscription and one-time purchases.
 * Integrates with our external payment gateway (Stripe-compatible API).
 *
 * Usage:
 *   const result = await processPayment({ userId, amount, currency, paymentMethodId });
 */

import axios from 'axios';
import { db } from '../db';
import { logger } from '../logger';
import { PaymentRecord, PaymentStatus } from '../types/payment';

const GATEWAY_BASE_URL = process.env.PAYMENT_GATEWAY_URL!;
const GATEWAY_API_KEY = process.env.PAYMENT_GATEWAY_KEY!;

export interface PaymentRequest {
  userId: string;
  amount: number;          // in dollars (e.g. 9.99)
  currency: string;        // ISO 4217 (e.g. "USD")
  paymentMethodId: string; // token from client-side SDK
  description?: string;
  cardNumber?: string;     // present only during debug flows
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

// Tracks in-flight payment requests to avoid concurrent double-processing.
// Keyed by userId.
const inFlightPayments = new Set<string>();

/**
 * Process a payment for the given user.
 *
 * This function calls the external payment gateway and records the result
 * in the database. On failure, it retries up to 3 times before giving up.
 */
export async function processPayment(request: PaymentRequest): Promise<PaymentResult> {
  const { userId, amount, currency, paymentMethodId, description } = request;

  if (inFlightPayments.has(userId)) {
    logger.warn(`Payment already in flight for user ${userId}, skipping`);
    return { success: false, error: 'Payment already in progress' };
  }

  inFlightPayments.add(userId);

  if (process.env.NODE_ENV === 'development' && request.cardNumber) {
    console.log(`[DEBUG] Processing card: ${request.cardNumber} for user ${userId}, amount ${amount}`);
  }

  try {
    // Convert to cents for the gateway (floating-point arithmetic)
    const amountInCents = amount * 100;

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await axios.post(
          `${GATEWAY_BASE_URL}/v1/charges`,
          {
            amount: amountInCents,
            currency,
            payment_method: paymentMethodId,
            description: description ?? 'Platform subscription',
          },
          {
            headers: {
              Authorization: `Bearer ${GATEWAY_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const transactionId: string = response.data.id;

        // Record successful payment in the database
        await db.query(
          `INSERT INTO payment_records (user_id, amount_cents, currency, transaction_id, status, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [userId, amountInCents, currency, transactionId, PaymentStatus.Succeeded]
        );

        logger.info(`Payment succeeded for user ${userId}: ${transactionId}`);
        return { success: true, transactionId };

      } catch (err) {
        lastError = err;
        logger.warn(`Payment attempt ${attempt} failed for user ${userId}`);

        if (attempt < 3) {
          await sleep(attempt * 500);
        }
      }
    }

    // All retries exhausted
    await db.query(
      `INSERT INTO payment_records (user_id, amount_cents, currency, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, amountInCents, currency, PaymentStatus.Failed]
    );

    logger.error(`Payment failed for user ${userId}`);
    return { success: false, error: 'Payment failed' };

  } finally {
    inFlightPayments.delete(userId);
  }
}

/**
 * Retrieve the payment history for a given user.
 * Returns records ordered by most recent first.
 */
export async function getPaymentHistory(userId: string): Promise<PaymentRecord[]> {
  const result = await db.query<PaymentRecord>(
    `SELECT id, user_id, amount_cents, currency, transaction_id, status, created_at
     FROM payment_records
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId]
  );
  return result.rows;
}

/**
 * Issue a full or partial refund for a completed payment.
 */
export async function refundPayment(
  transactionId: string,
  amountCents?: number
): Promise<PaymentResult> {
  const body: Record<string, unknown> = { charge: transactionId };
  if (amountCents !== undefined) {
    body.amount = amountCents;
  }

  try {
    const response = await axios.post(
      `${GATEWAY_BASE_URL}/v1/refunds`,
      body,
      {
        headers: {
          Authorization: `Bearer ${GATEWAY_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const refundId: string = response.data.id;

    await db.query(
      `INSERT INTO refund_records (transaction_id, refund_id, amount_cents, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [transactionId, refundId, amountCents ?? null]
    );

    logger.info(`Refund issued for transaction ${transactionId}: refund ${refundId}`);
    return { success: true, transactionId: refundId };

  } catch (err) {
    logger.error(`Refund failed for transaction ${transactionId}`);
    return { success: false, error: 'Refund failed' };
  }
}

/**
 * Validate that a payment method token is still valid with the gateway.
 * Used before displaying "saved card" UI to avoid presenting stale methods.
 */
export async function validatePaymentMethod(paymentMethodId: string): Promise<boolean> {
  try {
    const response = await axios.get(
      `${GATEWAY_BASE_URL}/v1/payment_methods/${paymentMethodId}`,
      {
        headers: { Authorization: `Bearer ${GATEWAY_API_KEY}` },
      }
    );
    return response.data.status === 'active';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4156** (2026-09-29): **[Windows] atomic-write identity check compares fstat.dev with lstat.dev (always 0 on Windows) — every state_write fails with "state mutation lock unavailable"**
  *Symptoms*: ## Prereqs  - Searched issues/PRs for "replaced before rename", "lstat dev windows", "fstat lstat dev", "atomic write Windows dev 0" — no match. Related but different Windows bugs: #4147 (colon in temp names), #4139 (mixed path separators), #4016 (missing better-sqlite3 binding — also hit on the same install, fixed by `npm rebuild better-sqlite3`; this bug remains after that). - Installed plugin: 5.5.0 (latest). `src/lib/atomic-write.ts` on both `main` and `dev` still has the comparisons below.  ## Bug  On Windows, every atomic write through `src/lib/atomic-write.ts` fails with  ``` atomic write temporary file was replaced before rename ```  so `state_write` / `state_clear` (and cancel-signal writes) always fail, surfaced to the user as `state mutation lock unavailable`. Practical impact: `/oh-my-claudecode:cancel` cannot pause autopilot, and the Stop hook keeps re-injecting "Autopilot not complete" forever.  ## Root cause  The file-identity checks compare `dev` from `fstatSync(fd)` against `dev` from `lstatSync(path)`. On Windows, Node returns the real volume serial number from `fstat` but **`0` from `lstat`/`stat`**, so the comparison never matches even though `ino` is identical:  ```js // node v22.14.0, win32, NTFS const fd = fs.openSync(p, 'w'); fs.fstatSync(fd).dev  // 2831858368 fs.lstatSync(p).dev   // 0 fs.statSync(p).dev    // 0 fs.fstatSync(fd).ino === fs.lstatSync(p).ino  // true ```  Affected comparisons (`src/lib/atomic-write.ts` on `dev`, and the same code bundl
  **Post-Mortem & Fix Analysis**:
  > Thank you, Ranung, for reporting this critical Windows compatibility issue. The fix has been merged via PR #4159 with commit f16390090.  The root cause was that Node.js returns different dev values on Windows: - fstatSync(fd).dev returns the real volume serial - lstatSync/statSync(path).dev returns 0  This broke atomic file identity verification and state mutation operations. The fix introduces a Windows-tolerant `sameFileIdentity` helper that correctly handles this platform difference while maintaining full security on POSIX systems.  Verification: ✓ TypeScript compilation ✓ All tests passing (119 tests) ✓ Windows dev=0 handling verified ✓ POSIX dev comparison enforcement maintained  --- *[repo owner's gaebal-gajae (clawdbot) 🦞]*

- **Issue #4144** (2026-09-27): **omc-setup: star step fails on Windows Git Bash (leading slash in gh api endpoint)**
  *Symptoms*: ## Summary  On Windows with Git Bash, the "star the repo" step at the end of `omc-setup` always fails silently. The PUT endpoint has a leading slash, and MSYS path conversion rewrites it into a Windows filesystem path.  ## Location  `skills/omc-setup/phases/04-welcome.md`, line 179 (v5.5.0):  ```bash gh api -X PUT /user/starred/Yeachan-Heo/oh-my-claudecode 2>/dev/null && echo "Thanks for starring!" || true ```  ## Actual error (stderr is suppressed by `2>/dev/null` in setup)  ``` invalid API endpoint: "C:/Program Files/Git/user/starred/Yeachan-Heo/oh-my-claudecode". Your shell might be rewriting URL paths as filesystem paths. To avoid this, omit the leading slash from the endpoint argument ```  ## Fix  Drop the leading slash. This matches the already-working check on line 158 (`gh api user/starred/...`):  ```diff -gh api -X PUT /user/starred/Yeachan-Heo/oh-my-claudecode 2>/dev/null && echo "Thanks for starring!" || true +gh api -X PUT user/starred/Yeachan-Heo/oh-my-claudecode 2>/dev/null && echo "Thanks for starring!" || true ```  `gh api` accepts endpoints without a leading slash on all platforms, so the change is safe for macOS and Linux too.  ## Environment  - oh-my-claudecode 5.5.0 (plugin) - Windows 11, Git Bash (MSYS2) - gh authenticated with `repo` scope 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #4145, merged into `dev`. The star step in `omc-setup` now calls `gh api user/starred/...` without a leading slash, so Git Bash no longer rewrites it into a Windows path. It will ship in the next release.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*

- **Issue #4139** (2026-09-27): **[Windows] state-lock bridge always throws "manifest identity changed" (mixed path separators) — UserPromptSubmit hook fails on every prompt**
  *Symptoms*: ## Summary On Windows, the generated standalone state-lock bridge (`~/.claude/hooks/lib/state-lock.mjs`) throws on import every time, so every hook that imports it (via `atomic-write.mjs`) fails. Claude Code shows this on every prompt:  ``` UserPromptSubmit hook error Failed with non-blocking status code: file:///C:/Users/<user>/.claude/hooks/lib/state-lock.mjs:11 ```  ## Environment - oh-my-claudecode (`oh-my-claude-sisyphus`) 5.5.0, installed via npm global - Claude Code 2.1.283 - Node.js v24.19.0 - Windows 10 Pro 10.0.19045  ## Not a local misconfiguration - Verified the installed `dist/installer/index.js` is byte-identical to the published 5.5.0 npm tarball (`npm pack oh-my-claude-sisyphus@5.5.0`), and no other package files differ. - The generated `~/.claude/hooks/lib/state-lock.mjs` matches the installer template output, with only the machine-specific `PACKAGE_ROOT` filled in. - `src/installer/index.ts` on `main` still contains the same line, so this is not fixed upstream as of v5.5.0. - Likely affects all Windows users on the npm/standalone install path. POSIX paths use `/` only, so the comparison passes on macOS/Linux. and no other package files differ. - The generated `~/.claude/hooks/lib/state-lock.mjs` matches the installer template output, with only the machine-specific `PACKAGE_ROOT` filled in. - `src/installer/index.ts` on `main` still contains the same line, so this is not fixed upstream as of v5.5.0. - Likely affects all Windows users on the npm/standalone ins
  **Post-Mortem & Fix Analysis**:
  > Fixed on dev by #4140 (merge 862c692736).  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*

- **Issue #4129** (2026-09-27): **`omc team <unknown-word>` starts a real team instead of erroring (e.g. `omc team list`, `omc team resume --help`)**
  *Symptoms*: ## Summary `omc team` treats any unknown first word as the task description and launches a team with the default worker count (3). Commands a user or agent naturally tries — `omc team list`, `omc team resume --help` — silently start 3 workers, create worktrees/branches (`omc-team/list/worker-1..3`) and state. Cleanup then fails closed (`provider_cleanup_unverified`).  ## Environment OMC 5.5.0 (oh-my-claude-sisyphus), Claude Code 2.1.283, Node 22.23.2, tmux 3.7b, Ubuntu 24.04 VM.  ## Steps to reproduce 1. In a git repo: `omc team list` (or `omc team resume --help`). 2. Observe: "Team started: list", 3 workers requested; `git branch` shows `omc-team/list/worker-1..3`; `.omc/state/team/list/` exists. 3. `omc team shutdown list --force` → `Error: Team shutdown preserved: provider_cleanup_unverified:worker-1,worker-2,worker-3` even when no worker pane is alive.  ## Expected `list`/`resume`/unknown subcommands either work (`omc team list` = list teams) or fail with a usage error. A task description should require an explicit form (quotes, `--task`, or `N:agent-type`).  ## Actual A team is started; quota is spent if panes come up; state and branches remain and cannot be removed with `--force`.  ## Proposed fix - Reserve common verbs (`list`, `ls`, `resume`, `help`, `logs`, `attach`) as subcommands or reject them with a usage message. - Treat `--help` anywhere in argv as help, never as task text. - `shutdown --force`: if no pane/process for a worker exists, treat provider cleanup as 
  **Post-Mortem & Fix Analysis**:
  > Fixed on `dev` by #4137 (merge `ff67b9c137`). `omc team list`, `ls`, `resume`, `logs` and `attach` now fail with an "unsupported team command" error. `--help` and `-h` print help wherever they appear in the command. A single bare unknown word without a worker spec (for example `omc team foo`) now errors instead of launching a team. Multi-word tasks still work, quoted or unquoted, and there is a new `--task "..."` form. The separate `shutdown --force` fail-closed cleanup behavior is unchanged: it is intentional and is documented via #4131.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*

- **Issue #4118** (2026-09-26): **[Bug] Regression of #2992: `omc doctor conflicts` flags the setup-installed `wiki` skill as a legacy collision when the plugin is active (5.5.0)**
  *Symptoms*: ## Summary  On a marketplace-plugin install, `/oh-my-claudecode:omc-setup` (global, overwrite) copies `skills/wiki/SKILL.md` to `~/.claude/skills/wiki/SKILL.md`. Right after that, `omc doctor conflicts` reports it as a legacy file shadowing a plugin skill. This is the same conflict as #2992 (`omc-reference`, v4.13.7). The #2993 exemption covers `wiki`, but it is skipped whenever the plugin is active.  ## Environment  - oh-my-claudecode plugin 5.5.0 (marketplace cache), `omc` CLI 5.5.0 (npm `oh-my-claude-sisyphus`) - Windows 10, Claude Code desktop app, `settings.json` has `"enabledPlugins": { "oh-my-claudecode@omc": true }`  ## Reproduce  1. Run `bash <plugin-root>/scripts/setup-claude-md.sh global overwrite`. It prints `Installed wiki skill to …/.claude/skills/wiki/SKILL.md`. 2. Run `omc doctor conflicts`.  ## Observed  ``` 📦 Legacy Skills   ⚠ Skills colliding with plugin skill names:     - wiki (C:\Users\<user>\.claude\skills\wiki)     These legacy files shadow plugin skills. Remove them or rename to avoid conflicts. ```  The installed copy is byte-identical to `<plugin-root>/skills/wiki/SKILL.md` (`diff -q` reports no difference). Deleting it clears the warning; the next setup run re-creates it.  ## Root cause  - `scripts/setup-claude-md.sh:283` calls `install_reference_skill "$CANONICAL_REFERENCE_SKILL"` unconditionally, including when the marketplace plugin is active and already provides `wiki`. - `dist/cli/commands/doctor-conflicts.js:298` lists `wiki` in `SETUP_FALLBA
  **Post-Mortem & Fix Analysis**:
  > Thanks for the precise report — reproduced on current `dev` (`5b90a0ab6`): `scripts/setup-claude-md.sh` still installs the wiki reference skill unconditionally, and `isSupportedSetupFallbackSkill` in `src/cli/commands/doctor-conflicts.ts` still short-circuits when the plugin is active, so the byte-identical exemption never applies.  Fix in progress on `fix/issue-4118-wiki-setup-shadow`: setup will skip the wiki copy when the plugin is the active install, and doctor will stop flagging an unmodified setup copy. Workaround until then: delete `~/.claude/skills/wiki/` after running setup.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]* 
  > Fixed in #4119, merged to `dev` as `19c16dd02c`:  - `setup-claude-md.sh` no longer installs the wiki fallback skill when the OMC plugin is enabled in `settings.json` (an explicitly disabled plugin still gets the fallback). - `omc doctor conflicts` no longer flags a byte-identical setup copy even with the plugin active; user-modified copies are still reported.  It will ship in the next release. Until then, deleting `~/.claude/skills/wiki/` clears the warning.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]* 

- **Issue #4111** (2026-09-27): **A bug has cropped up where simply using "ralph" or "team," or even just mentioning "ultrawork,"**
  *Symptoms*: A bug has cropped up where simply using "ralph" or "team," or even just mentioning "ultrawork," causes the mode to switch to "ultrawork" and consume unlimited usage. It seems to be part of the update, and it's really frustrating. It’s annoying that the plugin developer, rather than the user, is the one controlling usage limits.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. I tried to reproduce this against the current `dev` (`668589f1a5`) and the latest release `v5.5.0` (`main` `9fd35ece5d`). I fed prompts straight into the `UserPromptSubmit` keyword hook (`scripts/keyword-detector.mjs`) and checked which mode state files it wrote. Results were identical on both:  | Prompt | Mode state written | |---|---| | `ralph fix the login bug` | `ralph` only | | `can ralph handle this?` | `ralph` only | | `use team to refactor auth` | none (team is explicit-only via `/team`) | | `what does ultrawork do?` | none | | `I read about ultrawork in the docs, anyway fix the typo` | none | | `ulw fix the typo` | none |  In none of these cases did the hook write an `ultrawork` state, and the injected ralph context doesn't mention ultrawork either. `ultrawork` is no longer a standalone skill; it was folded into `execute`.  To pin down what you're seeing, please share: 1. Your OMC version (`omc --version`, or the plugin version shown in `/plugin`). 2. Th
  > Closing this for now: we could not reproduce it on current `dev` (the keyword hook only writes `ralph` state for an explicit ralph prompt, and never writes `ultrawork` state from a mention), and there has been no follow-up since the diagnostics request on 2026-09-25.  If it happens again, please reopen with your OMC version, the exact prompt, and the file list under `.omc/state/` right after the mode switches, and we'll pick it up immediately.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*

- **Issue #4102** (2026-09-24): **[Windows] `/team` CLI workers always fail to start: `SystemRoot` in `provider_env` is rejected as reserved (`worker_launch_descriptor_invalid`)**
  *Symptoms*: ## Environment  - OMC 5.4.0 (Claude Code plugin + npm `oh-my-claude-sisyphus` 5.4.0). The same logic is in 5.5.0 `dist/team/worker-launch-ack.js`. - Windows 11 Pro 10.0.26200, native (no WSL), Node v22.23.2 - psmux 3.3.8 (`tmux -V` → `tmux 3.3.8`) - codex-cli 0.155.0-alpha.9.2 (`omc doctor --team-routing` → all providers available)  ## Steps to reproduce  1. In any git repo, run:    ```    omc team 1:codex:explore --no-decompose "List the files in the current directory. Do not modify anything."    ``` 2. About 8 seconds later it exits with code 1:    ```    [team/tmux-session] worker start failed session=omc-team-...:0 pane=%3 worker=worker-1 cmdSha=... error="worker_start_ack_ack_timeout:worker-1:%3:..."    worker_launch_cleanup_unverified:worker-1:%3    ``` 3. The worker pane shows the real error:    ```    [runtime-cli] Fatal error: Error: worker_launch_descriptor_invalid    ```  This happens every time. Windows always defines `SystemRoot`, so I don't think any native Windows supervised launch can pass.  ## Root cause  The writer puts `SystemRoot` into the bootstrap descriptor, and the reader then rejects the descriptor because of it. Line numbers are from `src/team/worker-launch-ack.ts` in 5.4.0.  1. **The writer adds the key.**    - `buildWorkerLaunchBootstrapSpec()` (L495) stores `provider_env: buildProviderEnvironment(options.providerEnv)` (L518).    - `buildProviderEnvironment()` (L232–253) copies the baseline keys `SAFE_BASELINE_ENV_KEYS = ['PATH', 'SystemRoot', 'SYS
  **Post-Mortem & Fix Analysis**:
  > Thanks @xz02108040 — confirmed on current `dev`: the writer (`buildProviderEnvironment` merging `SAFE_BASELINE_ENV_KEYS` + win32 `SystemRoot`) produces a descriptor the reader's reserved-key check (`WINDOWS_RESERVED_ENV_KEYS` includes `SYSTEMROOT`) always rejects, so every native-Windows supervised launch dies with `worker_launch_descriptor_invalid`. Your `bootstrap.json` key dump pins it exactly.  Fix in progress on `dev`: - the descriptor will always round-trip on win32 with a single case-insensitive `SystemRoot`, while caller-supplied reserved keys stay rejected; - `resolveCliPath` on Windows will prefer `PATHEXT` candidates (`codex.cmd` over an extension-less shim).  Regression tests run with an explicit `win32` platform so Linux CI covers them. Will link the PR here.  — *[repo owner's gaebal-gajae (clawdbot) 🦞]*
  > Fixed on `dev` by #4104. CI 19/19 including the Windows path suite.  - **Descriptor round-trip:** the writer now stores only the normalized *caller* env (reserved keys still rejected with `worker_launch_provider_env_reserved`); the platform baseline — `PATH`/`TEMP`/`TMP`, a single `SystemRoot`, and `USERPROFILE`/`HOME` — is re-applied at spawn time from the bootstrap process's own environment. No more `SystemRoot`+`SYSTEMROOT` pair in `bootstrap.json`, so the reader accepts it. #3788's macOS `HOME` behavior is unchanged. - **`resolveCliPath` on Windows:** candidates from `where.exe` are filtered by `PATHEXT` (default `.COM;.EXE;.BAT;.CMD`), keeping `where.exe` order, so `codex.cmd` wins over an extension-less Git Bash shim.  Regression tests pin `platform: 'win32'` explicitly so Linux CI covers them (6 fail on the old code, all pass now). Ships in the next release; your PATH-ordering workaround covers the second part until then.  Thanks for the precise writer/reader trace and the `boot

- **Issue #4096** (2026-09-23): **HUD fails with "Cross-repository access is not permitted" outside a git repo, when system locale is non-English**
  *Symptoms*: omc-hud.mjs throws a fail-closed security error instead of rendering the statusline when run in a directory that is not a git repository (e.g. $HOME), on a system with a non-English LANG/LC_ALL.  Root cause: src/lib/worktree-paths.ts, function isNotAGitRepositoryError (~line 419-431 in dist), classifies a failed git rev-parse --show-toplevel probe by matching its stderr against a hardcoded English regex:  return err.status === 128 && /not a git repository/i.test(stderr);  runGitShowToplevel (same file, ~line 552-563) spawns git via execFileSync without forcing a locale, so on a system where git's own messages are localized (e.g. Italian: fatal: .git non alcuna delle directory genitrici)), the regex nevermatches. The probe result falls through to status: 'probe_failed' instead of status: 'not_a_repository', and every caller that checks   status === 'probe_failed' || status === 'git_missing' ssage:                                                                                                                                         ▎ workingDirectory '<dir>' git probe failed and was noss is not permitted; pass a path inside the currentrepository or start the session there.                                                                                                 This is meant as a fail-closed guard against cross-repo/worktree escapes, but it fires for the completely ordinary case of "there is no git repo here at all" whenever the OS locale isn't Eng  Repro: LANG=it_IT.UTF-
  **Post-Mortem & Fix Analysis**:
  > 진단이 정확합니다 — 원인 함수(`isNotAGitRepositoryError`), 오분류 경로(`not_a_repository` → `probe_failed`), 제안한 수정(프로브 spawn에 결정적 로케일 강제)까지 전부 맞습니다.  **다만 이 결함은 이미 고쳐져 있고, `5.3.0`이 그 수정을 포함하지 않는 마지막 계열입니다.**  - 수정 커밋: `9fa51dfb6` — *fix(worktree-paths): force LC_ALL=C on git probe spawns (#3979)* (2026-09-07) - 포함된 첫 릴리즈: **v5.4.0** (현재 `latest`는 **5.5.0**)  제안하신 것과 같은 방식입니다. 현재 `dev`에서 stderr를 파싱해 분류하는 git spawn 세 곳 모두 `env: { ...process.env, LC_ALL: 'C' }`를 강제합니다:  - `probeGitTopLevel`의 `rev-parse --show-toplevel` (`isNotAGitRepositoryError`가 읽는 지점) - `rev-parse --show-superproject-working-tree` (`isDefinitiveNonGitError`) - `rev-parse --is-bare-repository`  "같은 파일의 다른 `execFileSync('git', ...)` 호출부도"라는 지적도 확인했는데, 나머지 호출부는 **stdout만 읽고 stderr로 분기하지 않아서** 로케일 의존성이 없습니다. 그래서 지금 남아 있는 결함은 없습니다. (`LC_ALL=C`면 gettext가 `LANGUAGE`를 무시하므로 `LANGUAGE=it`이 설정된 환경에서도 영문 문자열이 보장됩니다.)  회귀 커버도 있습니다 — `src/lib/__tests__/worktree-paths-git-probe-locale.test.ts`가 `LC_ALL`이 `C`가 아닐 때 비영어 `fatal:` 문자열을 내보내는 가짜 `git`을 P

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

### Incident Patch 1: `b7be6b2c` (2026-09-21)
**Commit Message**: fix(dist): commit the jev runtime modules the plugin shipping closure requires

**File**: `dist/features/jev-slop-warning.d.ts` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+/**
+ * Jev judgment point: slop-warning (shadow) — recorder only, no runtime wiring.
+ *
+ * Ticket 12 of the Jev judgment-points feature. The slop-warning heuristic
+ * (shouldWarnForSlopFallbackLanguage) lives in scripts/pre-tool-enforcer.mjs,
+ * which cannot import TypeScript; wiring a runtime call would require either
+ * porting the heuristic to TS or a CJS→ESM bridge. Until that follow-up
+ * lands, this recorder is exported and tested only: callers (today, tests)
+ * pass their already-computed warning decision as the twin.
+ *
+ * Advisory point, shadow-only: the twin always decides; Jev's Noul answer is
+ * recorded only. The point declaration lives in the jev registry
+ * (hooks/jev/points.ts).
+ */
+import type { ResolveResult } from '../hooks/jev/index.js';
+export interface SlopWarningShadowArgs {
+    /** The hook's already-computed slop-warning decision. */
+    warned: boolean;
+    toolName: string;
+    /** The tool input inspected by the enforcer (strings bounded by the resolver). */
+    toolInput: Record<string, unknown>;
+    /** Test hook: injected transport. */
+    fetchFn?: typeof fetch;
+}
+/**
+ * Record the shadow comparison for one tool input and return the twin
+ * decision unchanged. With no TYPESAFE_API_KEY (or OMC_JEV not naming this
+ * point) the resolver short-circuits: zero HTTP calls, no logging, same
+ * decision.
+ */
+export declare function recordSlopWarningShadow(args: SlopWarningShadowArgs): Promise<ResolveResult<boolean>>;
+//# sourceMappingURL=jev-slop-warning.d.ts.map
\ No newline at end of file
```

**File**: `dist/features/jev-slop-warning.js` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+/**
+ * Jev judgment point: slop-warning (shadow) — recorder only, no runtime wiring.
+ *
+ * Ticket 12 of the Jev judgment-points feature. The slop-warning heuristic
+ * (shouldWarnForSlopFallbackLanguage) lives in scripts/pre-tool-enforcer.mjs,
+ * which cannot import TypeScript; wiring a runtime call would require either
+ * porting the heuristic to TS or a CJS→ESM bridge. Until that follow-up
+ * lands, this recorder is exported and tested only: callers (today, tests)
+ * pass their already-computed warning decision as the twin.
+ *
+ * Advisory point, shadow-only: the twin always decides; Jev's Noul answer is
+ * recorded only. The point declaration lives in the jev registry
+ * (hooks/jev/points.ts).
+ */
+import { recordJudgment } from '../hooks/jev/index.js';
+/**
+ * Record the shadow comparison for one tool input and return the twin
+ * decision unchanged. With no TYPESAFE_API_KEY (or OMC_JEV not naming this
+ * point) the resolver short-circuits: zero HTTP calls, no logging, same
+ * decision.
+ */
+export function recordSlopWarningShadow(args) {
+    return recordJudgment('slop-warning', {
+        state: {
+            tool_name: args.toolName,
+            tool_input: args.toolInput,
+            source: 'pre-tool-enforcer',
+        },
+        twin: () => args.warned,
+        fetchFn: args.fetchFn,
+    });
+}
+//# sourceMappingURL=jev-slop-warning.js.map
\ No newline at end of file
```

**File**: `dist/hooks/code-simplifier/jev-shadow.d.ts` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+/**
+ * Jev judgment point: simplifier-trigger (shadow).
+ *
+ * Ticket 12 of the Jev judgment-points feature. Wraps the code-simplifier
+ * stop hook's fire-once heuristic (the processCodeSimplifier shouldBlock
+ * decision, replicated here without the marker write) as the twin of a
+ * detector-type resolveJudgment call. Advisory point, shadow-only: the twin
+ * always decides; Jev's Noul answer is recorded only and never gates the
+ * simplifier delegation. Degrade paths are handled inside the resolver.
+ *
+ * The point declaration (questions, blocking flag) lives in the jev registry
+ * (hooks/jev/points.ts); this module keeps the twin and the call-specific
+ * state shape.
+ */
+import type { ResolveResult } from '../jev/index.js';
+export interface SimplifierTriggerShadowArgs {
+    cwd: string;
+    stateDir: string;
+    /** Modified-file list already computed by the host hook (avoid re-running git). */
+    files: string[];
+    /** The host hook's already-computed shouldBlock decision. */
+    shouldBlock: boolean;
+    /** Test hook: injected transport. */
+    fetchFn?: typeof fetch;
+}
+/**
+ * The fire-once heuristic, computed side-effect-free (no marker write).
+ * Mirrors processCodeSimplifier's early-return logic.
+ */
+export declare function computeSimplifierTriggerTwin(stateDir: string, files: string[]): boolean;
+/**
+ * Record the shadow comparison for one stop event and return the twin
+ * decision unchanged. With no TYPESAFE_API_KEY (or OMC_JEV not naming this
+ * point) the resolver short-circuits: zero HTTP calls, no logging, same
+ * decision.
+ */
+export declare function recordSimplifierTriggerShadow(args: SimplifierTriggerShadowArgs): Promise<ResolveResult<boolean>>;
+//# sourceMappingURL=jev-shadow.d.ts.map
\ No newline at end of file
```

**File**: `dist/hooks/code-simplifier/jev-shadow.js` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+/**
+ * Jev judgment point: simplifier-trigger (shadow).
+ *
+ * Ticket 12 of the Jev judgment-points feature. Wraps the code-simplifier
+ * stop hook's fire-once heuristic (the processCodeSimplifier shouldBlock
+ * decision, replicated here without the marker write) as the twin of a
+ * detector-type resolveJudgment call. Advisory point, shadow-only: the twin
+ * always decides; Jev's Noul answer is recorded only and never gates the
+ * simplifier delegation. Degrade paths are handled inside the resolver.
+ *
+ * The point declaration (questions, blocking flag) lives in the jev registry
+ * (hooks/jev/points.ts); this module keeps the twin and the call-specific
+ * state shape.
+ */
+import { isAlreadyTriggered, isCodeSimplifierEnabled, } from './index.js';
+import { recordJudgment } from '../jev/index.js';
+/**
+ * The fire-once heuristic, computed side-effect-free (no marker write).
+ * Mirrors processCodeSimplifier's early-return logic.
+ */
+export function computeSimplifierTriggerTwin(stateDir, files) {
+    if (!isCodeSimplifierEnabled())
+        return false;
+    if (isAlreadyTriggered(stateDir))
+        return false;
+    return files.length > 0;
+}
+/**
+ * Record the shadow comparison for one stop event and return the twin
+ * decision unchanged. With no TYPESAFE_API_KEY (or OMC_JEV not naming this
+ * point) the resolver short-circuits: zero HTTP calls, no logging, same
+ * decision.
+ */
+export function recordSimplifierTriggerShadow(args) {
+    return recordJudgment('simplifier-trigger', {
+        state: {
+            cwd: args.cwd,
+            files: args.files,
+            source: 'code-simplifier-stop',
+        },
+        twin: () => computeSimplifierTriggerTwin(args.stateDir, args.files),
+        fetchFn: args.fetchFn,
+    });
+}
+//# sourceMappingURL=jev-shadow.js.map
\ No newline at end of file
```

**File**: `dist/hooks/jev/points.d.ts` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+/**
+ * Judgment-point registry - the single place a judgment point is declared.
+ *
+ * Each entry records the point's resolver key, its TypeSafe question sets,
+ * and whether it is gate-type (blocking: callers wait on the Jev verdict) or
+ * detector-type (non-blocking: the twin returns immediately, the Jev call
+ * settles in the background). The registry holds declarations only; the one
+ * execution path stays resolveJudgment (resolver.ts), reached through
+ * recordJudgment below.
+ *
+ * Adding a judgment point (the ticket #8 precondition): one
+ * defineJudgmentPoint entry here plus a thin recorder in the owning module -
+ * no copied module.
+ */
+import type { JevQuestions, JudgmentPointName, ResolveResult } from './types.js';
+export interface JudgmentPointDefinition {
+    /** Resolver key (the `point` argument) - also the registry key. */
+    name: string;
+    /**
+     * Question sets for this point, in resolver-call order. Most points have
+     * exactly one; loop-continuation resolves once per question (Noul, Score),
+     * so it declares two. The function form is re-evaluated per call
+     * (skill-trigger derives its criteria from the detector's KEYWORD_PRIORITY).
+     */
+    questions: readonly (JevQuestions | (() => JevQuestions))[];
+    /** Gate-type points (true) wait on the Jev verdict; detector-type do not. */
+    blocking: boolean;
+}
+/** Declare a judgment point. Declaration only - nothing here executes. */
+export declare function defineJudgmentPoint(definition: {
+    name: string;
+    questions: JevQuestions | (() => JevQuestions) | readonly (JevQuestions | (() => JevQuestions))[];
+    blocking: boolean;
+}): JudgmentPointDefinition;
+/** The judgment-point registry: name -> declaration. */
+export declare const JUDGMENT_POINTS: Readonly<Record<JudgmentPointName, JudgmentPointDefinition>>;
+/** Look up a declared judgment point. */
+export declare function getJudgmentPoint(name: string): JudgmentPointDefinition;
+export interface RecordJudgmentCall<T> {
+    /** State the caller wants judged (bounded by the resolver before send/log). */
+    state: unknown;
+    /** Heuristic twin thunk. Errors propagate (twins must not be masked). */
+    twin: () => T;
+    /** Index into the point's question sets (loop-continuation's Score call uses 1). */
+    questionSet?: number;
+    /** Test hook: injected transport. */
+    fetchFn?: typeof fetch;
+}
+/**
+ * Record one shadow comparison at a declared judgment point. Thin wrapper
+ * over resolveJudgment that fills in the registry's name, questions, and
+ * blocking flag; the caller supplies only the call-specific state and twin.
+ */
+export declare function recordJudgment<T>(pointName: string, call: RecordJudgmentCall<T>): Promise<ResolveResult<T>>;
+//# sourceMappingURL=points.d.ts.map
\ No newline at end of file
```

---

### Incident Patch 2: `72abc723` (2026-09-21)
**Commit Message**: fix(session-end): record why a release left the job recoverable (#4076) (#4077)

A CI-only failure reported `phase=recoverable-failure ... error=none` twice
today (PRs #4065, #4075) and the manifest held no cause, so the failure could
not be reduced to anything. Releasing ownership without reaching `complete` is
the single path that leaves a job non-terminal, and it recorded nothing.

- SessionEndJobV1 carries `recoverableFailure { reason, releasedAt, ownerNonce }`.
- releaseSessionEndJob takes the caller's reason; reapStaleSessionEndOwner
  records its own liveness verdict instead.
- The worker names every loop exit (run deadline, ownership lost, lease renew
  failure before/after an action, runner start rejection, lease lost during an
  action) so the reason is the exit, not a guess.
- The detached-worker diagnostic prints `release=<reason>`, which is what the
  next CI failure needs.

This does not claim to fix the underlying recoverable failure: it makes the
next occurrence diagnosable, which is acceptance criterion 1 of #4076.

Co-authored-by: clawdbot <clawdbot@users.noreply.github.com>

**File**: `inventory/inventory-graph.json` (modified, +5/-5)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "a3d6556b332d0ab671f89d3167ee13a48a6867bb",
-    "sourceSha256": "34b7e9fc45f6ba490e3e79879432be248c53c44616a490f8ab03d9101f4c4867",
+    "head": "3a7a4d91ecffc1bc9708fa1e540ae8cff83998e1",
+    "sourceSha256": "fc5d392f372514100c7a70aa6be60dbea15a846139ead169a673932af2f05bff",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "a3d6556b332d0ab671f89d3167ee13a48a6867bb",
-  "sourceSha256": "34b7e9fc45f6ba490e3e79879432be248c53c44616a490f8ab03d9101f4c4867",
+  "head": "3a7a4d91ecffc1bc9708fa1e540ae8cff83998e1",
+  "sourceSha256": "fc5d392f372514100c7a70aa6be60dbea15a846139ead169a673932af2f05bff",
   "counts": {
     "public": {
       "skills": 43,
@@ -80667,5 +80667,5 @@
     }
   },
   "inventorySha256": "c1133e0dbda4e0008970c7dd7afb6f3fb249f02d38aa4b4a74ba89da740e638a",
-  "manifestSha256": "c9b4b0068240303fd4e2a39dd20d63bd11ef57f89941ccf23fd05d0e9bdeb66e"
+  "manifestSha256": "9cdcbd7bf403884eee501e978855fbf64e10405232a53ee33ce2026668e5b179"
 }
```

**File**: `src/__tests__/session-end-process-exit.test.ts` (modified, +4/-2)
```diff
@@ -137,7 +137,7 @@ async function waitForTerminalCallback(cwd: string, sessionId: string): Promise<
     }
     await new Promise<void>((resolve) => setTimeout(resolve, 10));
   }
-  let manifest: { phase?: string; owner?: unknown; actions?: Record<string, { status?: string; error?: string }> } | null = null;
+  let manifest: { phase?: string; owner?: unknown; recoverableFailure?: { reason?: string }; actions?: Record<string, { status?: string; error?: string }> } | null = null;
   try {
     if (existsSync(manifestPath)) {
       manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
@@ -146,7 +146,9 @@ async function waitForTerminalCallback(cwd: string, sessionId: string): Promise<
     manifest = null;
   }
   const callback = manifest?.actions?.callback;
-  throw new Error(`detached SessionEnd worker did not complete its callback: phase=${manifest?.phase ?? 'missing'} owner=${manifest?.owner === null ? 'none' : typeof manifest?.owner} callback=${callback?.status ?? 'missing'} error=${callback?.error ?? 'none'} file=${existsSync(callbackPath)}`);
+  // recoverableFailure.reason is the only record of why a non-terminal release
+  // happened, so a CI-only failure must print it (issue #4076).
+  throw new Error(`detached SessionEnd worker did not complete its callback: phase=${manifest?.phase ?? 'missing'} owner=${manifest?.owner === null ? 'none' : typeof manifest?.owner} callback=${callback?.status ?? 'missing'} error=${callback?.error ?? 'none'} release=${manifest?.recoverableFailure?.reason ?? 'unrecorded'} file=${existsSync(callbackPath)}`);
 }
 
 describe('SessionEnd run.cjs process exit regressions (#3477)', () => {
```

**File**: `src/hooks/session-end/__tests__/cleanup-manifest.test.ts` (modified, +24/-1)
```diff
@@ -191,11 +191,34 @@ describe('durable SessionEnd cleanup manifest', () => {
     expect(markSessionEndActionRunner(directory, sessionId, 'crashed-owner', 'python-cleanup', runner.runnerNonce, 'armed')).not.toBeNull();
     expect(finishSessionEndAction(directory, sessionId, 'crashed-owner', 'python-cleanup', runner.runnerNonce, false, 'simulated-crash')).not.toBeNull();
     expect(readSessionEndJob(directory, sessionId)?.actions['python-cleanup']).toMatchObject({ status: 'retryable', lastOutcomeCode: 'simulated-crash', runner: { phase: 'terminal' } });
-    expect(releaseSessionEndJob(directory, sessionId, 'crashed-owner', owner.owner!.leaseGeneration)).not.toBeNull();
+    expect(releaseSessionEndJob(directory, sessionId, 'crashed-owner', owner.owner!.leaseGeneration, 'lease-lost-during-python-cleanup')).not.toBeNull();
     expect(readSessionEndJob(directory, sessionId)).toMatchObject({ owner: null, phase: 'recoverable-failure' });
     expect(takeSessionEndDiscoveryPage(directory, 1)).toEqual([sessionId]);
   });
 
+  it('records why a release left the job in recoverable-failure (#4076)', () => {
+    const directory = project();
+    const sessionId = preparedAndSealed(directory, 'release-reason');
+    const owner = claimSessionEndJob(directory, sessionId, 'owner', 'identity', Date.now() + 5_000)!;
+
+    expect(releaseSessionEndJob(directory, sessionId, 'owner', owner.owner!.leaseGeneration, 'run-deadline-reached')).toMatchObject({
+      phase: 'recoverable-failure',
+      recoverableFailure: { reason: 'run-deadline-reached', ownerNonce: 'owner' },
+    });
+    // The reason must survive on disk: the CI artifact is the only evidence a
+    // non-reproducing failure leaves behind.
+    const persisted = readSessionEndJob(directory, sessionId)!;
+    expect(persisted.recoverableFailure?.reason).toBe('run-deadline-reached');
+    expect(Number.isFinite(Date.parse(persisted.recoverableFailure!.releasedAt))).toBe(true);
+
+    // Default reason still names the release path when a caller passes nothing.
+    const reclaimed = claimSessionEndJob(directory, sessionId, 'next-owner', 'identity', Date.now() + 5_000)!;
+    expect(releaseSessionEndJob(directory, sessionId, 'next-owner', reclaimed.owner!.leaseGeneration)?.recoverableFailure).toMatchObject({
+      reason: 'worker-released',
+      ownerNonce: 'next-owner',
+    });
+  });
+
   it('bounds required failures and never retries a failed remote delivery attempt', () => {
     const directory = project();
     const sessionId = preparedAndSealed(directory, 'bounded-failures');
```

**File**: `src/hooks/session-end/cleanup-manifest.ts` (modified, +12/-2)
```diff
@@ -22,6 +22,12 @@ export interface SessionEndJobV1 {
   actions: Record<SessionEndActionName, SessionEndActionState>; owner: WorkerOwner | null;
   phase: 'collecting' | 'ready' | 'processing' | 'recoverable-failure' | 'complete';
   completion?: { completedAt: string; terminalDigest: string; terminalRevision: number };
+  /**
+   * Why the job last landed in `recoverable-failure` (issue #4076). Without
+   * this a CI-only failure reports `phase=recoverable-failure error=none` and
+   * the cause is unrecoverable from the artifact.
+   */
+  recoverableFailure?: { reason: string; releasedAt: string; ownerNonce?: string };
 }
 
 export interface OpenClawRoutingSnapshot {
@@ -258,8 +264,12 @@ export function sealWikiManifest(directory: string, sessionId: string, payload?:
 export function claimSessionEndJob(directory: string, sessionId: string, nonce: string, identity: string, deadlineAt: number): SessionEndJobV1 | null { const current = readSessionEndJob(directory, sessionId); if (!current) return null; const now = Date.now(); return mutateSessionEndJob(directory, sessionId, current.revision, (job) => { if (job.phase === 'complete' || job.owner) throw new Error('claim-conflict'); job.owner = { nonce, pid: process.pid, processStartIdentity: identity, claimedAt: nowIso(), heartbeatAt: nowIso(), leaseExpiresAt: new Date(Math.min(now + 750, deadlineAt)).toISOString(), runDeadlineAt: new Date(deadlineAt).toISOString(), leaseGeneration: 1, claimedFromRevision: job.revision }; job.phase = 'processing'; }); }
 export function renewSessionEndLease(directory: string, sessionId: string, nonce: string, generation: number, deadlineAt: number): SessionEndJobV1 | null { const current = readSessionEndJob(directory, sessionId); if (!current) return null; return mutateSessionEndJob(directory, sessionId, current.revision, (job) => { const owner = job.owner; if (!owner || owner.nonce !== nonce || owner.leaseGeneration !== generation) throw new Error('lease-conflict'); owner.leaseGeneration++; owner.heartbeatAt = nowIso(); owner.leaseExpiresAt = new Date(Math.min(Date.now() + 750, deadlineAt)).toISOString(); }); }
 /** Reaping is intentionally separate from a new claim. Caller must establish dead or PID-reused identity. */
-export function reapStaleSessionEndOwner(directory: string, sessionId: string, expectedNonce: string, expectedGeneration: number, liveness: 'dead' | 'mismatch'): SessionEndJobV1 | null { const current = readSessionEndJob(directory, sessionId); if (!current || Date.now() < Date.parse(current.owner?.leaseExpiresAt ?? '')) return null; return mutateSessionEndJob(directory, sessionId, current.revision, (job) => { if (!job.owner || job.owner.nonce !== expectedNonce || job.owner.leaseGeneration !== expectedGeneration || Date.now() < Date.parse(job.owner.leaseExpiresAt) || (liveness !== 'dead' && liveness !== 'mismatch')) throw new Error('reap-conflict'); if (Object.values(job.actions).some(action => action.status === 'claimed' && action.runner && action.runner.phase !== 'terminal' && Date.now() < Date.parse(action.runner.deadlineAt))) throw new Error('runner-still-bounded'); for (const action of Object.values(job.actions)) { if (action.status === 'claimed' && action.claimantNonce === expectedNonce) { action.status = action.class === 'best-effort' ? 'expired' : 'retryable'; action.claimantNonce = undefined; action.lastOutcomeCode = action.class === 'best-effort' ? 'delivery-uncertain-owner-reaped' : 'owner-reaped'; if (action.runner) action.runner.phase = 'terminal'; } } job.owner = null; job.phase = 'recoverable-failure'; }); }
-export function releaseSessionEndJob(directory: string, sessionId: string, nonce: string, generation: number): SessionEndJobV1 | null { const current = readSessionEndJob(directory, sessionId); if (!current) return null; return mutateSessionEndJob(directory, sessionId, current.revision, (job) => { if (!job.owner || job.owner.nonce !== nonce || job.owner.leaseGeneration !== generation) throw new Error('release
```

**File**: `src/hooks/session-end/worker.ts` (modified, +11/-7)
```diff
@@ -86,20 +86,24 @@ export async function processSessionEndWorker(payload: SessionEndWorkerPayload):
   }
   let producerReady = Boolean(admitted && ['sealed', 'no-op'].includes(admitted.producers.core.state) && ['sealed', 'no-op'].includes(admitted.producers.wiki.state));
   let generation = claimed.owner.leaseGeneration;
+  // Every loop exit that is not "all actions settled" leaves the job in
+  // recoverable-failure; naming the exit is what makes that state diagnosable
+  // from the manifest alone (issue #4076).
+  let exitReason = 'actions-settled';
   try {
     for (const name of Object.keys(claimed.actions) as SessionEndActionName[]) {
-      if (Date.now() >= deadlineAt) break;
+      if (Date.now() >= deadlineAt) { exitReason = 'run-deadline-reached'; break; }
       const before = readSessionEndJob(payload.directory, payload.sessionId);
-      if (!before || before.owner?.nonce !== nonce) break;
+      if (!before || before.owner?.nonce !== nonce) { exitReason = before ? 'ownership-lost' : 'manifest-unreadable'; break; }
       if (!producerReady && (name !== 'foreground-cleanup' || !graceExpired || before.producers.core.state !== 'prepared')) continue;
       if (name === 'wiki-capture' && before.producers.wiki.state === 'absent') continue;
       const owned = claimSessionEndAction(payload.directory, payload.sessionId, nonce, name, deadlineAt);
       const action = owned?.actions[name];
       if (!owned || !action || action.status !== 'claimed' || !action.runner) continue;
       const renewed = renewSessionEndLease(payload.directory, payload.sessionId, nonce, generation, deadlineAt);
-      if (!renewed?.owner) break;
+      if (!renewed?.owner) { exitReason = 'lease-renew-failed-before-action'; break; }
       generation = renewed.owner.leaseGeneration;
-      if (!markSessionEndActionRunner(payload.directory, payload.sessionId, nonce, name, action.runner.runnerNonce, 'started')) break;
+      if (!markSessionEndActionRunner(payload.directory, payload.sessionId, nonce, name, action.runner.runnerNonce, 'started')) { exitReason = `runner-start-rejected-${name}`; break; }
       const stopWatchdog = armSessionEndActionWatchdog({ directory: payload.directory, jobId: owned.jobId, action: name, attempt: action.attempts, runnerNonce: action.runner.runnerNonce, deadlineAt: Math.min(deadlineAt, Date.now() + action.budgetMs) });
       const actionDeadline = Math.min(deadlineAt, Date.now() + action.budgetMs);
       let leaseLost = false;
@@ -109,19 +113,19 @@ export async function processSessionEndWorker(payload: SessionEndWorkerPayload):
       const result = await runSessionEndAction({ directory: payload.directory, sessionId: payload.sessionId, job: owned, actionName: name, action, ownerNonce: nonce, runnerNonce: action.runner.runnerNonce, deadlineAt: actionDeadline }, () => executeSessionEndAction(name, payload, actionDeadline, authority));
       clearInterval(heartbeatTimer);
       stopWatchdog();
-      if (leaseLost) break;
+      if (leaseLost) { exitReason = `lease-lost-during-${name}`; break; }
       finishSessionEndAction(payload.directory, payload.sessionId, nonce, name, action.runner.runnerNonce, result.completed, result.code);
       if (name === 'foreground-cleanup' && result.completed) {
         recoverPreparedCoreProducer(payload.directory, payload.sessionId);
         const recovered = readSessionEndJob(payload.directory, payload.sessionId);
         producerReady = Boolean(recovered && ['sealed', 'no-op'].includes(recovered.producers.core.state) && ['sealed', 'no-op'].includes(recovered.producers.wiki.state));
       }
       const heartbeat = renewSessionEndLease(payload.directory, payload.sessionId, nonce, generation, deadlineAt);
-      if (!heartbeat?.owner) break;
+      if (!heartbeat?.owner) { exitReason = `lease-renew-failed-after-${name}`; break; }
       generation = heartbeat.owner.leaseGeneration;
     }
   } finally {
-    const released = releaseSessionEndJob(payload.directory, pay
```

---

### Incident Patch 3: `54ed4f97` (2026-09-21)
**Commit Message**: fix(config): validate background task env limit (#4074)

Co-authored-by: clawdbot <clawdbot@users.noreply.github.com>

**File**: `inventory/inventory-graph.json` (modified, +5/-5)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "a4763f8cab70b3288326cbe0334f41df686eadec",
-    "sourceSha256": "0e82c7b8df86cbdf5c9131b2b2d60bbd48f4fbdfc7fac0e2e7e517bb568188ab",
+    "head": "decff7db287962bf2a3c5ca1bfd9cd9b169ae3b2",
+    "sourceSha256": "86642b70f9886acb2f47864a4aedc1fd929a5a6df54c5784c2d82e22092c2eab",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "a4763f8cab70b3288326cbe0334f41df686eadec",
-  "sourceSha256": "0e82c7b8df86cbdf5c9131b2b2d60bbd48f4fbdfc7fac0e2e7e517bb568188ab",
+  "head": "decff7db287962bf2a3c5ca1bfd9cd9b169ae3b2",
+  "sourceSha256": "86642b70f9886acb2f47864a4aedc1fd929a5a6df54c5784c2d82e22092c2eab",
   "counts": {
     "public": {
       "skills": 43,
@@ -80460,5 +80460,5 @@
     }
   },
   "inventorySha256": "bdbe305a88d797a14873c674b736577569807ac1bd10f76220a4381ae9f0cf99",
-  "manifestSha256": "9a22812e8305768ffe7941223eb37e3c8d341706a5726f6d5ba60d20383455a3"
+  "manifestSha256": "fa0daaf93007d117b5d547cc0d0aea058e152452721488d53e9153f824c027f9"
 }
```

**File**: `src/config/__tests__/loader.test.ts` (modified, +32/-0)
```diff
@@ -7,6 +7,7 @@ import {
   generateConfigSchema,
   loadConfig,
   loadContextFromFiles,
+  loadEnvConfig,
 } from "../loader.js";
 import { saveAndClear, restore } from "./test-helpers.js";
 
@@ -34,6 +35,7 @@ const ALL_KEYS = [
   "OMC_MODEL_ALIAS_FABLE",
   "OMC_DELEGATION_ROUTING_ENABLED",
   "OMC_DELEGATION_ROUTING_DEFAULT_PROVIDER",
+  "OMC_MAX_BACKGROUND_TASKS",
 ] as const;
 
 // ---------------------------------------------------------------------------
@@ -179,6 +181,36 @@ describe("loadConfig() — auto-forceInherit for non-standard providers", () =>
   });
 });
 
+// ---------------------------------------------------------------------------
+// Background task limit environment override
+// ---------------------------------------------------------------------------
+describe("loadEnvConfig() — background task limit", () => {
+  let saved: Record<string, string | undefined>;
+
+  beforeEach(() => {
+    saved = saveAndClear(ALL_KEYS);
+  });
+  afterEach(() => {
+    restore(saved);
+  });
+
+  it.each(["1", "5", "50"])(
+    "accepts an in-range positive decimal integer (%s)",
+    (value) => {
+      process.env.OMC_MAX_BACKGROUND_TASKS = value;
+      expect(loadEnvConfig().permissions?.maxBackgroundTasks).toBe(Number(value));
+    },
+  );
+
+  it.each(["0", "-1", "51", "1000", "3junk", "1.5", "1e2", "01", " 5 ", "abc"])(
+    "ignores malformed or out-of-range values (%s)",
+    (value) => {
+      process.env.OMC_MAX_BACKGROUND_TASKS = value;
+      expect(loadEnvConfig().permissions?.maxBackgroundTasks).toBeUndefined();
+    },
+  );
+});
+
 // ---------------------------------------------------------------------------
 // Model alias env overrides (issue #1211, issue #3726)
 // ---------------------------------------------------------------------------
```

**File**: `src/config/loader.ts` (modified, +19/-10)
```diff
@@ -269,6 +269,15 @@ export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
   return result as T;
 }
 
+const MIN_BACKGROUND_TASKS = 1;
+const MAX_BACKGROUND_TASKS = 50;
+
+function parseBackgroundTaskLimit(value: string | undefined): number | null {
+  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
+  const parsed = Number(value);
+  return Number.isSafeInteger(parsed) && parsed <= MAX_BACKGROUND_TASKS ? parsed : null;
+}
+
 /**
  * Load configuration from environment variables
  */
@@ -298,14 +307,14 @@ export function loadEnvConfig(): Partial<PluginConfig> {
     };
   }
 
-  if (process.env.OMC_MAX_BACKGROUND_TASKS) {
-    const maxTasks = parseInt(process.env.OMC_MAX_BACKGROUND_TASKS, 10);
-    if (!isNaN(maxTasks)) {
-      config.permissions = {
-        ...config.permissions,
-        maxBackgroundTasks: maxTasks,
-      };
-    }
+  const maxBackgroundTasks = parseBackgroundTaskLimit(
+    process.env.OMC_MAX_BACKGROUND_TASKS,
+  );
+  if (maxBackgroundTasks !== null) {
+    config.permissions = {
+      ...config.permissions,
+      maxBackgroundTasks,
+    };
   }
 
   // Routing configuration from environment
@@ -1134,8 +1143,8 @@ export function generateConfigSchema(): object {
           maxBackgroundTasks: {
             type: "integer",
             default: 5,
-            minimum: 1,
-            maximum: 50,
+            minimum: MIN_BACKGROUND_TASKS,
+            maximum: MAX_BACKGROUND_TASKS,
           },
         },
       },
```

---

### Incident Patch 4: `55086352` (2026-09-21)
**Commit Message**: fix(preflight): reject malformed context threshold overrides (#4071)

* fix(preflight): reject malformed context threshold overrides

* chore: merge origin/dev and regenerate the inventory baseline

---------

Co-authored-by: gaebal-gajae <clawdbot@users.noreply.github.com>

**File**: `inventory/inventory-graph.json` (modified, +5/-5)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "2b574ee9d9087d8e05199b99b24e1c06c9fa49c4",
-    "sourceSha256": "98325cb3e70f2fa41e08e083936b68e379cbd7ab6c31a6cbe97ba587ddf39476",
+    "head": "a4763f8cab70b3288326cbe0334f41df686eadec",
+    "sourceSha256": "0e82c7b8df86cbdf5c9131b2b2d60bbd48f4fbdfc7fac0e2e7e517bb568188ab",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "2b574ee9d9087d8e05199b99b24e1c06c9fa49c4",
-  "sourceSha256": "98325cb3e70f2fa41e08e083936b68e379cbd7ab6c31a6cbe97ba587ddf39476",
+  "head": "a4763f8cab70b3288326cbe0334f41df686eadec",
+  "sourceSha256": "0e82c7b8df86cbdf5c9131b2b2d60bbd48f4fbdfc7fac0e2e7e517bb568188ab",
   "counts": {
     "public": {
       "skills": 43,
@@ -80460,5 +80460,5 @@
     }
   },
   "inventorySha256": "bdbe305a88d797a14873c674b736577569807ac1bd10f76220a4381ae9f0cf99",
-  "manifestSha256": "c2c7b204a964b206865417a5ff8cc9cc1409e37c67a5c02a270e52bd1c165480"
+  "manifestSha256": "9a22812e8305768ffe7941223eb37e3c8d341706a5726f6d5ba60d20383455a3"
 }
```

**File**: `scripts/lib/pre-tool-enforcer-preflight.mjs` (modified, +10/-3)
```diff
@@ -4,9 +4,16 @@ const AGENT_HEAVY_TOOLS = new Set(['Task', 'TaskCreate', 'TaskUpdate']);
 const DEFAULT_PREFLIGHT_CONTEXT_THRESHOLD = 72;
 
 export function getPreflightContextThreshold(env = process.env) {
-  const parsed = Number.parseInt(env.OMC_AGENT_PREFLIGHT_CONTEXT_THRESHOLD || '72', 10);
-  if (Number.isNaN(parsed)) return DEFAULT_PREFLIGHT_CONTEXT_THRESHOLD;
-  return Math.max(1, Math.min(100, parsed));
+  const value = env.OMC_AGENT_PREFLIGHT_CONTEXT_THRESHOLD;
+  if (!value) return DEFAULT_PREFLIGHT_CONTEXT_THRESHOLD;
+
+  const normalized = String(value).trim();
+  if (!/^\d+$/.test(normalized)) return DEFAULT_PREFLIGHT_CONTEXT_THRESHOLD;
+
+  const parsed = Number.parseInt(normalized, 10);
+  if (parsed < 1 || parsed > 100) return DEFAULT_PREFLIGHT_CONTEXT_THRESHOLD;
+
+  return parsed;
 }
 
 export function estimateContextPercent(transcriptPath) {
```

**File**: `src/__tests__/pre-tool-enforcer.test.ts` (modified, +21/-3)
```diff
@@ -1103,17 +1103,35 @@ describe('pre-tool-enforcer fallback gating (issue #970)', () => {
     const transcriptPath = join(tempDir, 'transcript.jsonl');
     writeTranscriptWithContext(transcriptPath, 1000, 800); // 80%
 
+    for (const threshold of ['abc', '95abc', '0', '101']) {
+      const output = evaluateAgentHeavyPreflight({
+        toolName: 'Task',
+        transcriptPath,
+        env: {
+          ...process.env,
+          OMC_AGENT_PREFLIGHT_CONTEXT_THRESHOLD: threshold,
+        },
+      });
+
+      expect(output?.decision).toBe('block');
+      expect(String(output?.reason)).toContain('threshold: 72%');
+    }
+  });
+
+  it('preserves a valid preflight threshold env value', () => {
+    const transcriptPath = join(tempDir, 'transcript.jsonl');
+    writeTranscriptWithContext(transcriptPath, 1000, 800); // 80%
+
     const output = evaluateAgentHeavyPreflight({
       toolName: 'Task',
       transcriptPath,
       env: {
         ...process.env,
-        OMC_AGENT_PREFLIGHT_CONTEXT_THRESHOLD: 'abc',
+        OMC_AGENT_PREFLIGHT_CONTEXT_THRESHOLD: '85',
       },
     });
 
-    expect(output?.decision).toBe('block');
-    expect(String(output?.reason)).toContain('threshold: 72%');
+    expect(output).toBeNull();
   });
 
   it('allows non-agent-heavy tools even when transcript context is high', () => {
```

---

### Incident Patch 5: `84e4463f` (2026-09-21)
**Commit Message**: fix(read-budget): reject malformed env budget overrides (#4070)

* fix(read-budget): reject malformed env budget overrides

* chore: merge origin/dev and regenerate the inventory baseline

---------

Co-authored-by: gaebal-gajae <clawdbot@users.noreply.github.com>

**File**: `inventory/inventory-graph.json` (modified, +5/-5)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "313af10dd2f5054f275375cba309c539578c14ff",
-    "sourceSha256": "26a8dc60dd4820381c46deb9c737512f0ac2f841cc8d3c131da3565050a452e3",
+    "head": "3b2c9cbd637c0e448ce1d90b2bb303cfa431da56",
+    "sourceSha256": "7734f59b1a6df3f93c33ef94ce376dc9d00e146456624f9077e96a66e6e8f1bb",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "313af10dd2f5054f275375cba309c539578c14ff",
-  "sourceSha256": "26a8dc60dd4820381c46deb9c737512f0ac2f841cc8d3c131da3565050a452e3",
+  "head": "3b2c9cbd637c0e448ce1d90b2bb303cfa431da56",
+  "sourceSha256": "7734f59b1a6df3f93c33ef94ce376dc9d00e146456624f9077e96a66e6e8f1bb",
   "counts": {
     "public": {
       "skills": 43,
@@ -80460,5 +80460,5 @@
     }
   },
   "inventorySha256": "bdbe305a88d797a14873c674b736577569807ac1bd10f76220a4381ae9f0cf99",
-  "manifestSha256": "7b331b310df310727b7dadd1f9fa56c0859a97e4023c02ebd45ea6f2616ffcf7"
+  "manifestSha256": "76ec27a9ce6dbf6e9d91aca4376bf0567c94215c70a037ce45c2952c2c649b7a"
 }
```

**File**: `scripts/lib/read-budget-preflight.mjs` (modified, +10/-4)
```diff
@@ -89,16 +89,22 @@ function readBudgetConfig(loadOmcConfig) {
   }
 }
 
+function parsePositiveDecimalInteger(value) {
+  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
+  const parsed = Number(value);
+  return Number.isSafeInteger(parsed) ? parsed : null;
+}
+
 function resolveMaxLines(cfg, env) {
-  const fromEnv = Number.parseInt(env.OMC_READ_BUDGET_MAX_LINES || '', 10);
-  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
+  const fromEnv = parsePositiveDecimalInteger(env.OMC_READ_BUDGET_MAX_LINES);
+  if (fromEnv !== null) return fromEnv;
   if (Number.isFinite(cfg?.maxLines) && cfg.maxLines > 0) return cfg.maxLines;
   return DEFAULT_MAX_LINES;
 }
 
 function resolveMaxBytes(cfg, env) {
-  const fromEnv = Number.parseInt(env.OMC_READ_BUDGET_MAX_BYTES || '', 10);
-  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
+  const fromEnv = parsePositiveDecimalInteger(env.OMC_READ_BUDGET_MAX_BYTES);
+  if (fromEnv !== null) return fromEnv;
   if (Number.isFinite(cfg?.maxBytes) && cfg.maxBytes > 0) return cfg.maxBytes;
   return DEFAULT_MAX_BYTES;
 }
```

**File**: `src/__tests__/read-budget-preflight.test.ts` (modified, +48/-0)
```diff
@@ -125,6 +125,54 @@ describe('read budget preflight: binaries, pages, remedy order, byte budget (iss
     expect(result?.trigger).toBe('bytes');
   });
 
+  it('honours OMC_READ_BUDGET_MAX_LINES for one-off runs', () => {
+    const file = writeLines('env-lines-valid.ts', 100);
+
+    const result = evaluateReadBudget({
+      toolName: 'Read',
+      toolInput: { file_path: file },
+      stateDir,
+      env: { OMC_READ_BUDGET_MAX_LINES: '50' },
+      loadOmcConfig: () => ({ context: { readBudget: { mode: 'deny', maxBytes: 10_000_000 } } }),
+      cwd,
+    }) as Evaluation;
+
+    expect(result?.decision).toBe('block');
+    expect(result?.trigger).toBe('lines');
+  });
+
+  it('falls back when OMC_READ_BUDGET_MAX_BYTES has a malformed suffix', () => {
+    const file = writeLines('env-bytes.ts', 100);
+
+    const result = evaluateReadBudget({
+      toolName: 'Read',
+      toolInput: { file_path: file },
+      stateDir,
+      env: { OMC_READ_BUDGET_MAX_BYTES: '10kb' },
+      loadOmcConfig: () => ({ context: { readBudget: { mode: 'deny', maxBytes: 10_000_000 } } }),
+      cwd,
+    }) as Evaluation;
+
+    expect(result).toBeNull();
+  });
+
+  it('falls back when OMC_READ_BUDGET_MAX_LINES has a malformed suffix', () => {
+    const file = writeLines('env-lines.ts', 100);
+
+    const result = evaluateReadBudget({
+      toolName: 'Read',
+      toolInput: { file_path: file },
+      stateDir,
+      env: { OMC_READ_BUDGET_MAX_LINES: '50junk' },
+      loadOmcConfig: () => ({
+        context: { readBudget: { mode: 'deny', maxLines: 1_000, maxBytes: 10_000_000 } },
+      }),
+      cwd,
+    }) as Evaluation;
+
+    expect(result).toBeNull();
+  });
+
   it('leads the remedy with a bounded re-read and demotes the structural tools', () => {
     const big = writeLines('ordered.ts', 4000);
 
```

---

### Incident Patch 6: `a0343ff0` (2026-09-21)
**Commit Message**: fix(read-budget): skip binaries, honor pages, reorder remedy, add maxBytes (#4062) (#4063)

* fix(read-budget): skip binaries, honor pages, reorder remedy, add maxBytes (#4062)

The gate treated every path as text. Four consequences, all reported with
measurements in #4062 by @carlos-cubas:

- countLines decoded any file as UTF-8 to count newlines, and anything over
  5 MB was denied by construction rather than by measurement. Binaries are now
  skipped on an extension list with a NUL sniff over the first 8 KB as backstop
  — a PNG has no line count and none of the remedies apply to it.
- hasTargetedRange had no 'pages' key, so the page-scoped PDF read that Read
  itself mandates over 10 pages was denied while an unbounded read of a 9-page
  file passed.
- The remedy named lsp_document_symbols first; the substitution agents actually
  make is a bounded re-read, and a language server is often not on PATH. Order
  is now offset/limit, subagent, then structural tools.
- Lines are a weak proxy for Read's 25,000-token output cap (tokens per line
  vary ~3x). maxBytes joins maxLines as a second budget, either firing, default
  45000 with OMC_READ_BUDGET_MAX_BYTES override. The byte path 

**File**: `agents/explore.md` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ disallowedTools: Write, Edit
     - For files >200 lines, use `lsp_document_symbols` to get the outline first, then only read specific sections with `offset`/`limit` parameters on Read.
     - For files >500 lines, ALWAYS use `lsp_document_symbols` instead of Read.
     - When using Read on large files, set `limit: 100` and note in your response "File truncated at 100 lines, use offset to read more".
-    - This is enforced, not advisory: a Read with no `offset`/`limit` against a file over the configured budget (`context.readBudget.maxLines`, default 1500) is warned once and denied afterwards. A bare `cat <file>` via Bash is treated the same way; piped or redirected `cat` and `sed -n '1,200p'` are targeted reads and stay allowed.
+    - This is enforced, not advisory: a Read with no `offset`/`limit` against a file over either configured budget (`context.readBudget.maxBytes`, default 45000; `context.readBudget.maxLines`, default 1500) is warned once and denied afterwards. Binaries (images, archives, PDFs, and anything with NUL bytes in its first 8 KB) are skipped by the gate, and a PDF read carrying `pages` counts as targeted. A bare `cat <file>` via Bash is treated the same way; piped or redirected `cat` and `sed -n '1,200p'` are targeted reads and stay allowed.
     - When a full read is genuinely required, allowlist the path via `context.readBudget.allowPaths` or set `OMC_READ_BUDGET=off` for the run. Read caps its own output at 25,000 tokens, so a full read of a very large file returns a partial view that still reads like a complete answer.
     - Batch reads must not exceed 5 files in parallel. Queue additional reads in subsequent rounds.
     - Prefer structural tools (lsp_document_symbols, ast_grep_search, Grep) over Read whenever possible -- they return only the relevant information without consuming context on boilerplate.
```

**File**: `inventory/inventory-graph.json` (modified, +41/-11)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "a5e0b1832b5165fc78f23bd788d93639f1312c0a",
-    "sourceSha256": "9685ee7f9866c106882d3c9784936c27ac1f5b5212104c77a88428e46398f24c",
+    "head": "f4cf090c4285b19833c30a2f0fb349e53ef7406d",
+    "sourceSha256": "3f6d52d503fa74605f43199b04000bd446f620729b27d7f8493b4302716dd105",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "a5e0b1832b5165fc78f23bd788d93639f1312c0a",
-  "sourceSha256": "9685ee7f9866c106882d3c9784936c27ac1f5b5212104c77a88428e46398f24c",
+  "head": "f4cf090c4285b19833c30a2f0fb349e53ef7406d",
+  "sourceSha256": "3f6d52d503fa74605f43199b04000bd446f620729b27d7f8493b4302716dd105",
   "counts": {
     "public": {
       "skills": 43,
@@ -28,8 +28,8 @@
       "toolFiles": 61,
       "libFiles": 43,
       "templateHooks": 22,
-      "srcFiles": 1371,
-      "total": 1393
+      "srcFiles": 1372,
+      "total": 1394
     },
     "generated": {
       "distFiles": 5032,
@@ -35343,6 +35343,11 @@
         "kind": "src",
         "path": "src/__tests__/rate-limit-wait/tmux-detector.test.ts"
       },
+      {
+        "id": "src/__tests__/read-budget-preflight.test.ts",
+        "kind": "src",
+        "path": "src/__tests__/read-budget-preflight.test.ts"
+      },
       {
         "id": "src/__tests__/release-boundary.test.ts",
         "kind": "src",
@@ -48705,6 +48710,31 @@
         "to": "src/features/rate-limit-wait/types.ts",
         "kind": "type-imports"
       },
+      {
+        "from": "src/__tests__/read-budget-preflight.test.ts",
+        "to": "external:fs",
+        "kind": "imports"
+      },
+      {
+        "from": "src/__tests__/read-budget-preflight.test.ts",
+        "to": "external:os",
+        "kind": "imports"
+      },
+      {
+        "from": "src/__tests__/read-budget-preflight.test.ts",
+        "to": "external:path",
+        "kind": "imports"
+      },
+      {
+        "from": "src/__tests__/read-budget-preflight.test.ts",
+        "to": "external:vitest",
+        "kind": "imports"
+      },
+      {
+        "from": "src/__tests__/read-budget-preflight.test.ts",
+        "to": "scripts/lib/read-budget-preflight.mjs",
+        "kind": "imports"
+      },
       {
         "from": "src/__tests__/release-boundary.test.ts",
         "to": "external:node:child_process",
@@ -80192,12 +80222,12 @@
       }
     ],
     "stats": {
-      "nodeCount": 7013,
-      "edgeCount": 7738,
-      "importEdgeCount": 6362,
+      "nodeCount": 7014,
+      "edgeCount": 7743,
+      "importEdgeCount": 6367,
       "registerEdgeCount": 64
     }
   },
-  "inventorySha256": "9cb294b9920707adfb18cf7f5d47819d1b88e3ae34754cdf1a4bf04a567b59e8",
-  "manifestSha256": "6badcd4cefde34e2313c8a422751476dd3626481308476cc3b57e9bd3e1bb52a"
+  "inventorySha256": "e6d055ebce3127485497a142266cd121c8c8f94fe688599e303734092d50e469",
+  "manifestSha256": "38b93d9daf3be7553eb64e23c96657813dd542dee28e97788fca47607feaddfa"
 }
```

**File**: `scripts/lib/read-budget-preflight.mjs` (modified, +135/-32)
```diff
@@ -22,31 +22,59 @@
 //       "readBudget": {
 //         "enabled": true,
 //         "maxLines": 1500,
+//         "maxBytes": 45000,
 //         "mode": "warn-then-deny",
 //         "allowPaths": ["docs/adr/**", "CHANGELOG.md"]
 //       }
 //     }
 //   }
 //
+// Two budgets, either firing (issue #4062). Lines are a weak proxy for Read's
+// 25,000-token output cap: tokens per line vary by roughly 3x across real
+// files, so one line threshold is loose on dense files and blind on sparse
+// ones. Bytes track the cap directly, so `maxBytes` is measured first and the
+// line budget stays as the familiar, repo-tunable second key.
+//
+// Binaries are skipped outright rather than decoded as UTF-8: a PNG has no
+// meaningful line count, and none of the remedies below apply to it.
+//
 // Env overrides: `OMC_READ_BUDGET=off` disables the gate entirely (this is the
 // replacement for explore.md's unenforceable "unless the caller specifically
 // asked for full file content" clause — a PreToolUse hook cannot see caller
-// intent, so the escape has to be explicit). `OMC_READ_BUDGET_MAX_LINES`
-// overrides the threshold for one-off runs.
+// intent, so the escape has to be explicit). `OMC_READ_BUDGET_MAX_LINES` and
+// `OMC_READ_BUDGET_MAX_BYTES` override the thresholds for one-off runs.
 //
 // Bash is gated too, but only for a bare `cat <file>`: `cat f | grep x`,
 // `cat f > g`, and `sed -n '1,200p' f` are all targeted reads and stay allowed.
 
-import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
-import { isAbsolute, join, relative, resolve } from 'path';
+import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'fs';
+import { extname, isAbsolute, join, relative, resolve } from 'path';
 
 const STATE_FILENAME = 'read-budget-warnings.json';
 const WARNING_RETENTION_SECONDS = 6 * 3600;
 const DEFAULT_MAX_LINES = 1500;
+// Truncating reads observed in practice run ~2.4-2.8 bytes per token, putting
+// the 25,000-token cap around 60-70 KB. 45 KB sits deliberately below that: a
+// false positive costs one bounded re-read, a false negative is a silent
+// partial view that reads like a complete answer.
+const DEFAULT_MAX_BYTES = 45000;
 const DEFAULT_MODE = 'warn-then-deny';
-// Above this size the file is over any sane line budget; skip the line count.
+// Above this size we stop decoding the file to count lines and report bytes.
 const HUGE_FILE_BYTES = 5 * 1024 * 1024;
 const READ_TOOL_NAMES = new Set(['Read', 'View']);
+const BINARY_SNIFF_BYTES = 8 * 1024;
+// Extension check first (free, covers the common case), NUL sniff as backstop.
+const BINARY_EXTENSIONS = new Set([
+  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.tiff', '.tif', '.webp', '.avif', '.heic',
+  '.pdf', '.psd', '.ai', '.sketch',
+  '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac',
+  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv',
+  '.zip', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar', '.tar', '.jar', '.war',
+  '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.a', '.obj', '.class', '.wasm', '.node',
+  '.woff', '.woff2', '.ttf', '.otf', '.eot',
+  '.db', '.sqlite', '.sqlite3', '.mdb',
+  '.pyc', '.pyo', '.dat', '.iso', '.dmg', '.pkg', '.deb', '.rpm',
+]);
 
 function nowSec() {
   return Math.floor(Date.now() / 1000);
@@ -68,6 +96,13 @@ function resolveMaxLines(cfg, env) {
   return DEFAULT_MAX_LINES;
 }
 
+function resolveMaxBytes(cfg, env) {
+  const fromEnv = Number.parseInt(env.OMC_READ_BUDGET_MAX_BYTES || '', 10);
+  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
+  if (Number.isFinite(cfg?.maxBytes) && cfg.maxBytes > 0) return cfg.maxBytes;
+  return DEFAULT_MAX_BYTES;
+}
+
 function resolveMode(cfg) {
   const mode = typeof cfg?.mode === 'string' ? cfg.mode.trim() : '';
   return mode === 'deny' || mode === 'warn' ? mode : DEFAULT_MODE;
@@ -123,6 +158,12 @@ function hasTargetedRange(toolInput) {
     if (typeof value === 'number' && Number.isFini
```

**File**: `src/__tests__/read-budget-preflight.test.ts` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+import { mkdtempSync, rmSync, writeFileSync } from 'fs';
+import { tmpdir } from 'os';
+import { join } from 'path';
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+// @ts-expect-error Local hook helper is a JS module loaded directly by the tests.
+import { evaluateReadBudget } from '../../scripts/lib/read-budget-preflight.mjs';
+
+type Evaluation = {
+  decision: 'warn' | 'block';
+  reason: string;
+  path: string;
+  lineCount: number;
+  byteSize: number;
+  trigger: 'bytes' | 'lines';
+} | null;
+
+describe('read budget preflight: binaries, pages, remedy order, byte budget (issue #4062)', () => {
+  let cwd: string;
+  let stateDir: string;
+
+  beforeEach(() => {
+    cwd = mkdtempSync(join(tmpdir(), 'omc-read-budget-'));
+    stateDir = join(cwd, '.state');
+  });
+
+  afterEach(() => {
+    rmSync(cwd, { recursive: true, force: true });
+  });
+
+  function evaluate(toolInput: Record<string, unknown>, config?: Record<string, unknown>): Evaluation {
+    return evaluateReadBudget({
+      toolName: 'Read',
+      toolInput,
+      stateDir,
+      env: {},
+      loadOmcConfig: () => ({ context: { readBudget: { mode: 'deny', ...(config || {}) } } }),
+      cwd,
+    }) as Evaluation;
+  }
+
+  function writeLines(name: string, lines: number): string {
+    const filePath = join(cwd, name);
+    writeFileSync(filePath, `${Array.from({ length: lines }, (_, i) => `line ${i}`).join('\n')}\n`);
+    return filePath;
+  }
+
+  it('skips a binary by extension instead of decoding it as UTF-8', () => {
+    const pngPath = join(cwd, 'screenshot.png');
+    // PNG magic + enough bytes to blow past both budgets.
+    writeFileSync(pngPath, Buffer.concat([
+      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
+      Buffer.alloc(200_000, 0xff),
+    ]));
+
+    expect(evaluate({ file_path: pngPath }, { maxBytes: 1000, maxLines: 1 })).toBeNull();
+  });
+
+  it('skips a text-named file that is actually binary via the NUL sniff', () => {
+    const disguised = join(cwd, 'payload.txt');
+    writeFileSync(disguised, Buffer.concat([
+      Buffer.from('header\n'),
+      Buffer.alloc(100_000, 0x00),
+    ]));
+
+    expect(evaluate({ file_path: disguised }, { maxBytes: 1000, maxLines: 1 })).toBeNull();
+  });
+
+  it('still gates a large text file that has no NUL bytes', () => {
+    const big = writeLines('big.ts', 4000);
+
+    const result = evaluate({ file_path: big }, { maxBytes: 1_000_000, maxLines: 100 });
+
+    expect(result?.decision).toBe('block');
+    expect(result?.trigger).toBe('lines');
+    expect(result?.reason).toContain('4000 lines');
+  });
+
+  it('treats `pages` as a targeted range so a required PDF page read is not denied', () => {
+    // A real PDF byte payload is not needed: `pages` short-circuits before any
+    // file measurement, which is exactly the contract under test.
+    const pdf = join(cwd, 'spec.pdf');
+    writeFileSync(pdf, Buffer.alloc(200_000, 0x41));
+
+    expect(evaluate({ file_path: pdf, pages: [1, 2] }, { maxBytes: 1000 })).toBeNull();
+    expect(evaluate({ file_path: pdf, pages: '3-5' }, { maxBytes: 1000 })).toBeNull();
+    expect(evaluate({ file_path: pdf, pages: 4 }, { maxBytes: 1000 })).toBeNull();
+    expect(evaluate({ file_path: pdf, pages: [] }, { maxBytes: 1000 })).toBeNull(); // PDF is binary anyway
+  });
+
+  it('fires on bytes when the line count is under budget', () => {
+    // 200 very long lines: far under any line budget, far over the byte budget.
+    const dense = join(cwd, 'dense.json');
+    writeFileSync(dense, `${Array.from({ length: 200 }, () => 'x'.repeat(500)).join('\n')}\n`);
+
+    const result = evaluate({ file_path: dense }, { maxLines: 1500, maxBytes: 45000 });
+
+    expect(result?.decision).toBe('block');
+    expect(result?.trigger).toBe('bytes');
+    expect(result?.reason).toContain('bytes (budget 45000)');
+    // The byte path never decodes the file, so it must not invent a line count.
+
```

---

### Incident Patch 7: `77905af6` (2026-09-21)
**Commit Message**: fix(team): bind native team lifecycle to an immutable instance id (#4059)

* fix(team): bind native team lifecycle to an immutable instance id

Reserve a UUID before startup effects so shutdown, MCP cleanup, and
SessionEnd cannot adopt a newer same-name team. Keep cleanup receipts
outside the disposable state root so interrupted disposal can retry
without touching a successor.

Co-authored-by: Cursor <cursoragent@cursor.com>

* fix(team): persist Claude session ownership for SessionEnd cleanup

SessionEnd was matching the ending Claude session against a tmux target, so owned teams were preserved. Record leader_session_id on config and treat a positively absent dedicated window as retryable cleanup evidence.

Co-authored-by: Cursor <cursoragent@cursor.com>

* test(team): align lifecycle fixtures with owned tmux identity

Keep production fail-closed. Tests now supply valid server identity and
launch evidence, and interruption tests build runtime-cli so CI can run
the kill-pane guard without committing bridge/.

Co-authored-by: Cursor <cursoragent@cursor.com>

* fix(test): restore typecheck and CI baselines for team instance lifecycle

- widen getWorkerLiveness mock return types so ts

**File**: `docs/MIGRATION.md` (modified, +63/-0)
```diff
@@ -6,6 +6,7 @@ This guide covers all migration paths for oh-my-claudecode. Find your current ve
 
 ## Table of Contents
 
+- [Unreleased: Team Instance Ownership](#unreleased-team-instance-ownership)
 - [Unreleased: Cancellation Scope](#unreleased-cancellation-scope)
 - [v4.x → v5.0: Workflow Retirement](#v4x--v50-workflow-retirement)
 - [Unreleased: Team MCP Runtime Deprecation (CLI-Only)](#unreleased-team-mcp-runtime-deprecation-cli-only)
@@ -19,6 +20,68 @@ This guide covers all migration paths for oh-my-claudecode. Find your current ve
 
 ---
 
+## Unreleased: Team Instance Ownership
+
+Team startup reserves an immutable instance ID before creating tasks or workers.
+An existing reservation or team state is not overwritten by another start using
+the same name. CLI/MCP jobs retain their original instance ID: cleanup of an old
+job cannot adopt a newer team's configuration.
+
+Native CLI jobs no longer start through the legacy v1 opt-out path. Unset
+`OMC_RUNTIME_V2=0`, `false`, `no`, or `off` before starting a job; disabling v2 is
+rejected before native startup effects rather than selecting weaker cleanup.
+
+Cleanup now requires matching instance and worker-launch evidence. A missing or
+corrupt receipt is not permission to kill a pane or remove state, even with
+`--force`. Older jobs and teams without this evidence are preserved rather than
+automatically upgraded or forcibly deleted. Complete their shutdown using the
+owning runtime before upgrading; do not fabricate IDs or discard receipts to
+bypass a blocked cleanup.
+
+This also applies to API `cleanup` and `orphan-cleanup`: neither is a raw state
+deletion escape hatch. The unsafe low-level `teamCleanup` deletion API is removed.
+SessionEnd cleanup checks the ending Claude session's ownership via config
+`leader_session_id` (not the tmux target projected into `leader.session_id`)
+and passes the captured instance ID; stale team-name hints cannot authorize
+cleanup of another session's team.
+
+Provider execution and pane liveness are observed separately. An exited provider
+can be recovered even when its pane shell remains, but recovery does not treat
+that observation as proof that all descendant processes have terminated.
+
+Tmux ownership additionally binds the socket, server PID, and precise process
+creation time captured at startup. Reused session names or pane IDs after a
+server restart cannot replace that evidence. Missing historical server identity
+does not authorize adoption, input, or destruction. Confirmed death of the
+original server proves only that its panes are gone, not provider cleanup.
+Strict server identity requires the native addon on macOS or boot-bound process
+evidence on Linux; unavailable precision preserves resources without a coarse
+process-listing fallback.
+Native Windows/MSYS tmux control has no verified process-identity mapping and
+therefore cannot authorize these effects. Running Node inside WSL uses the Linux
+identity path.
+
+The legacy mutation exports `watchdogCliWorkers`, `spawnWorkerForTask`,
+`killWorkerPane`, `assignTask`, and `killWorkerPanes` have been removed. Use the instance-bound v2
+startup, dispatch, recovery, scaling, and shutdown APIs instead. The former
+`done.json` watchdog, five automatic pane-death retries, lowest-index scheduling,
+and watchdog timer `stop()` contract are retired, not recreated inside v2.
+
+Final state removal retains instance-bound cleanup records outside the disposable
+team directory. After a partial removal failure, retry cleanup for the original
+job. Do not manually delete these records, including completed receipts: they
+prevent reuse of a retired instance identity. Detached state is removed by the
+validated cleanup protocol.
+
+Pending recovery reservations, intents, and owner requests also retain the
+original instance ID. Records without that evidence are not automatically
+adopted, and retrying an old request cannot attach it to a same-named replacement.
+
+`state_clear(m
```

**File**: `docs/REFERENCE.md` (modified, +12/-0)
```diff
@@ -579,6 +579,18 @@ omc team api claim-task --input '{"team_name":"auth-review","task_id":"1","worke
 
 Supported entrypoints: direct start (`omc team [N:agent] "<task>"`), `status`, `shutdown`, and `api`.
 
+Startup reserves the team name for an immutable instance. Shutdown and job cleanup
+require matching instance and worker-launch evidence; `--force` skips graceful
+waits but does not bypass ownership checks. Missing or corrupt evidence preserves
+resources, and an old job cannot clean up a newer same-name team. Keep external
+cleanup receipts when retrying a partial state removal. See
+[Team Instance Ownership](MIGRATION.md#unreleased-team-instance-ownership).
+API `cleanup` and `orphan-cleanup` follow the same evidence rules. SessionEnd
+validates Claude-session ownership from config `leader_session_id` before
+delegating instance-bound shutdown.
+Tmux effects require the original socket and precise server process identity;
+reused pane IDs after a server restart do not grant ownership.
+
 Native team worker worktrees are an opt-in/config-gated runtime-v2 rollout. See [Native Team Worktree Mode](TEAM-WORKTREE-MODE.md) for the worktree path contract, canonical `OMC_TEAM_STATE_ROOT` behavior, status fields, and dirty-worktree cleanup policy.
 
 Topology behavior:
```

**File**: `docs/TEAM-WORKTREE-MODE.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ Config, manifest, worker identity, and status surfaces should expose the same lo
 - Dirty worker worktrees must be preserved and surfaced as warnings/events. Cleanup must not force-remove dirty worker edits.
 - Branch/path mismatches should fail instead of reusing the wrong workspace.
 - Rollback may remove newly created clean worktrees and runtime-created branches when safe; reused worktrees are preserved.
-- `orphan-cleanup` is a destructive escape hatch that may delete worktree recovery metadata and root `AGENTS.md` backups. When that evidence exists, callers must pass `acknowledge_lost_worktree_recovery: true` only after manually preserving or intentionally discarding the affected worker worktrees/backups.
+- `orphan-cleanup` requires the same instance, provider, pane, and worktree cleanup evidence as normal shutdown. Neither force nor `acknowledge_lost_worktree_recovery` permits deleting unknown ownership records or worktree recovery backups.
 
 ## CLI and status expectations
 
```

**File**: `inventory/inventory-graph.json` (modified, +738/-230)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "c1bdf99c96fc8e11dda1c152a491784c6c0e8178",
-    "sourceSha256": "5ab3eb20519e823e58b54b3da224136599e924f21be199d761d860b1badca0fe",
+    "head": "a5e0b1832b5165fc78f23bd788d93639f1312c0a",
+    "sourceSha256": "9685ee7f9866c106882d3c9784936c27ac1f5b5212104c77a88428e46398f24c",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "c1bdf99c96fc8e11dda1c152a491784c6c0e8178",
-  "sourceSha256": "5ab3eb20519e823e58b54b3da224136599e924f21be199d761d860b1badca0fe",
+  "head": "a5e0b1832b5165fc78f23bd788d93639f1312c0a",
+  "sourceSha256": "9685ee7f9866c106882d3c9784936c27ac1f5b5212104c77a88428e46398f24c",
   "counts": {
     "public": {
       "skills": 43,
@@ -37,14 +37,14 @@
       "total": 5041
     },
     "prompt": {
-      "promptLikeFiles": 62
+      "promptLikeFiles": 61
     },
     "skills": 43,
     "commands": 21,
     "hookFiles": 309,
     "workflows": 8,
     "agentDefinitions": 18,
-    "promptLikeFiles": 62
+    "promptLikeFiles": 61
   },
   "public": {
     "skills": [
@@ -733,7 +733,6 @@
       "src/mcp/prompt-persistence.ts",
       "src/ralphthon/deep-interview-prompt.ts",
       "src/team/__tests__/prompt-sanitization.test.ts",
-      "src/team/__tests__/runtime-prompt-mode.test.ts",
       "templates/hooks/lib/workflow-stage-prompts.mjs",
       "tests/fixtures/prompt-projection/README.md",
       "tests/fixtures/prompt-projection/claude-body.normalized",
@@ -6278,7 +6277,6 @@
       "src/mcp/prompt-persistence.ts",
       "src/ralphthon/deep-interview-prompt.ts",
       "src/team/__tests__/prompt-sanitization.test.ts",
-      "src/team/__tests__/runtime-prompt-mode.test.ts",
       "templates/hooks/lib/workflow-stage-prompts.mjs",
       "tests/fixtures/prompt-projection/README.md",
       "tests/fixtures/prompt-projection/claude-body.normalized",
@@ -35410,11 +35408,6 @@
         "kind": "src",
         "path": "src/__tests__/runtime-guidance-plan-ralph.test.ts"
       },
-      {
-        "id": "src/__tests__/runtime-task-orphan.test.ts",
-        "kind": "src",
-        "path": "src/__tests__/runtime-task-orphan.test.ts"
-      },
       {
         "id": "src/__tests__/security-config.test.ts",
         "kind": "src",
@@ -39995,11 +39988,6 @@
         "kind": "src",
         "path": "src/team/__tests__/role-router.test.ts"
       },
-      {
-        "id": "src/team/__tests__/runtime-assign.test.ts",
-        "kind": "src",
-        "path": "src/team/__tests__/runtime-assign.test.ts"
-      },
       {
         "id": "src/team/__tests__/runtime-cli.test.ts",
         "kind": "src",
@@ -40020,11 +40008,6 @@
         "kind": "src",
         "path": "src/team/__tests__/runtime-owner-client.test.ts"
       },
-      {
-        "id": "src/team/__tests__/runtime-prompt-mode.test.ts",
-        "kind": "src",
-        "path": "src/team/__tests__/runtime-prompt-mode.test.ts"
-      },
       {
         "id": "src/team/__tests__/runtime-storage-boundary.test.ts",
         "kind": "src",
@@ -40070,6 +40053,11 @@
         "kind": "src",
         "path": "src/team/__tests__/runtime-v2.service-repair.test.ts"
       },
+      {
+        "id": "src/team/__tests__/runtime-v2.shutdown-interruption.test.ts",
+        "kind": "src",
+        "path": "src/team/__tests__/runtime-v2.shutdown-interruption.test.ts"
+      },
       {
         "id": "src/team/__tests__/runtime-v2.shutdown-pane-cleanup.test.ts",
         "kind": "src",
@@ -40150,6 +40138,11 @@
         "kind": "src",
         "path": "src/team/__tests__/team-config-revision-lock.test.ts"
       },
+      {
+        "id": "src/team/__tests__/team-instance.test.ts",
+        "kind": "src",
+        "path": "src/team/__tests__/team-instan
```

**File**: `native/contained-fs.c` (modified, +57/-0)
```diff
@@ -3,6 +3,7 @@
 #define _GNU_SOURCE
 #define NAPI_VERSION 8
 #include <node_api.h>
+#include <sys/types.h>
 #include <sys/stat.h>
 #include <dirent.h>
 #include <errno.h>
@@ -12,6 +13,10 @@
 #include <stdio.h>
 #include <string.h>
 #include <unistd.h>
+#ifdef __APPLE__
+#include <sys/proc.h>
+#include <sys/sysctl.h>
+#endif
 
 static int napi_checked(napi_env env, napi_status status) {
   if (status == napi_ok) return 1;
@@ -93,6 +98,57 @@ static napi_value undefined(napi_env env) {
   return result;
 }
 
+static napi_value null_value(napi_env env) {
+  napi_value result;
+  CHECK(napi_get_null(env, &result));
+  return result;
+}
+
+/*
+ * Validate the JavaScript PID before converting it to pid_t.  A conversion
+ * before these checks could turn a fractional or out-of-range Number into a
+ * different process identifier.
+ */
+static int process_pid(napi_env env, napi_value value, pid_t *result) {
+  double number;
+  if (napi_get_value_double(env, value, &number) != napi_ok ||
+      !isfinite(number) || number < 1 || number > (double)INT_MAX ||
+      floor(number) != number) {
+    napi_throw_type_error(env, NULL, "Expected a positive integer process pid");
+    return 0;
+  }
+  *result = (pid_t)number;
+  return 1;
+}
+
+static napi_value process_start_time(napi_env env, napi_callback_info info) {
+  napi_value args[1], result, value;
+  pid_t pid;
+  if (!arguments(env, info, 1, args) || !process_pid(env, args[0], &pid)) return NULL;
+#ifdef __APPLE__
+  int mib[4] = { CTL_KERN, KERN_PROC, KERN_PROC_PID, (int)pid };
+  struct kinfo_proc process;
+  size_t size = sizeof(process);
+  memset(&process, 0, sizeof(process));
+  if (sysctl(mib, 4, &process, &size, NULL, 0) < 0 || size != sizeof(process)) {
+    return null_value(env);
+  }
+  const struct timeval started = process.kp_proc.p_starttime;
+  if (started.tv_sec <= 0 || started.tv_usec < 0 || started.tv_usec >= 1000000) {
+    return null_value(env);
+  }
+  CHECK(napi_create_object(env, &result));
+  CHECK(napi_create_double(env, (double)started.tv_sec, &value));
+  CHECK(napi_set_named_property(env, result, "seconds", value));
+  CHECK(napi_create_double(env, (double)started.tv_usec, &value));
+  CHECK(napi_set_named_property(env, result, "microseconds", value));
+  return result;
+#else
+  (void)pid;
+  return null_value(env);
+#endif
+}
+
 static napi_value open_at(napi_env env, napi_callback_info info) {
   napi_value args[4], result;
   int directory, flags, mode;
@@ -227,6 +283,7 @@ static napi_value initialize(napi_env env, napi_value exports) {
     {"linkAt", NULL, link_at, NULL, NULL, NULL, napi_default, NULL},
     {"readDir", NULL, read_dir, NULL, NULL, NULL, napi_default, NULL},
     {"realpathFd", NULL, realpath_fd, NULL, NULL, NULL, napi_default, NULL},
+    {"processStartTime", NULL, process_start_time, NULL, NULL, NULL, napi_default, NULL},
   };
   CHECK(napi_define_properties(env, exports, sizeof(methods) / sizeof(methods[0]), methods));
   return exports;
```

---

### Incident Patch 8: `8354f19c` (2026-09-18)
**Commit Message**: fix(hooks): enforce the read budget in pre-tool-enforcer (#4054) (#4055)

* fix(hooks): enforce the read budget in pre-tool-enforcer (#4054)

agents/explore.md has carried a <Context_Budget> section since #587 telling
agents to outline large files with lsp_document_symbols and read them with
offset/limit. Nothing enforced it: pre-tool-enforcer.mjs had no line-count
logic at all, the rule only covered the explore agent, and the main loop —
where the cost actually accumulates — had no budget.

Add scripts/lib/read-budget-preflight.mjs and wire it into the PreToolUse
enforcer. An unbounded Read of a file over the budget is warned once and
denied afterwards; a bare `cat <file>` is treated the same way. Targeted
reads (offset/limit, piped/redirected cat, sed -n ranges), files under the
budget, allowlisted paths, and OMC_READ_BUDGET=off pass through untouched.
The deny reason names the remedy, since that string is the only signal the
agent receives.

Config: context.readBudget { enabled, maxLines (default 1500), mode
(warn-then-deny|warn|deny), allowPaths }. Env: OMC_READ_BUDGET=off,
OMC_READ_BUDGET_MAX_LINES.

explore.md's "unless the caller specifically asked for full file content"
cla

**File**: `agents/explore.md` (modified, +3/-1)
```diff
@@ -46,8 +46,10 @@ disallowedTools: Write, Edit
     Reading entire large files is the fastest way to exhaust the context window. Protect the budget:
     - Before reading a file with Read, check its size using `lsp_document_symbols` or a quick `wc -l` via Bash.
     - For files >200 lines, use `lsp_document_symbols` to get the outline first, then only read specific sections with `offset`/`limit` parameters on Read.
-    - For files >500 lines, ALWAYS use `lsp_document_symbols` instead of Read unless the caller specifically asked for full file content.
+    - For files >500 lines, ALWAYS use `lsp_document_symbols` instead of Read.
     - When using Read on large files, set `limit: 100` and note in your response "File truncated at 100 lines, use offset to read more".
+    - This is enforced, not advisory: a Read with no `offset`/`limit` against a file over the configured budget (`context.readBudget.maxLines`, default 1500) is warned once and denied afterwards. A bare `cat <file>` via Bash is treated the same way; piped or redirected `cat` and `sed -n '1,200p'` are targeted reads and stay allowed.
+    - When a full read is genuinely required, allowlist the path via `context.readBudget.allowPaths` or set `OMC_READ_BUDGET=off` for the run. Read caps its own output at 25,000 tokens, so a full read of a very large file returns a partial view that still reads like a complete answer.
     - Batch reads must not exceed 5 files in parallel. Queue additional reads in subsequent rounds.
     - Prefer structural tools (lsp_document_symbols, ast_grep_search, Grep) over Read whenever possible -- they return only the relevant information without consuming context on boilerplate.
   </Context_Budget>
```

**File**: `inventory/inventory-graph.json` (modified, +30/-9)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "cad8cf30d81c9515d19ae6a3bfa724b866000993",
-    "sourceSha256": "5ac18f3dc050b48c23601202ae10773b782fffc681064c4f92d077b5596a1225",
+    "head": "144b36998f47d6460f63397bc73aec8e94f665a1",
+    "sourceSha256": "e459ae36261e5b99352f415c20354281b47018933d5f0b3210548476268d6b62",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "cad8cf30d81c9515d19ae6a3bfa724b866000993",
-  "sourceSha256": "5ac18f3dc050b48c23601202ae10773b782fffc681064c4f92d077b5596a1225",
+  "head": "144b36998f47d6460f63397bc73aec8e94f665a1",
+  "sourceSha256": "e459ae36261e5b99352f415c20354281b47018933d5f0b3210548476268d6b62",
   "counts": {
     "public": {
       "skills": 43,
@@ -775,6 +775,7 @@
       "scripts/lib/pre-tool-enforcer-preflight.mjs",
       "scripts/lib/precompact-publisher.mjs",
       "scripts/lib/precompact-restore.mjs",
+      "scripts/lib/read-budget-preflight.mjs",
       "scripts/lib/skill-entitlements.mjs",
       "scripts/lib/state-lock.mjs",
       "scripts/lib/state-root.cjs",
@@ -33479,6 +33480,11 @@
         "kind": "script",
         "path": "scripts/lib/precompact-restore.mjs"
       },
+      {
+        "id": "scripts/lib/read-budget-preflight.mjs",
+        "kind": "script",
+        "path": "scripts/lib/read-budget-preflight.mjs"
+      },
       {
         "id": "scripts/lib/skill-entitlements.mjs",
         "kind": "script",
@@ -42491,6 +42497,16 @@
         "to": "external:url",
         "kind": "imports"
       },
+      {
+        "from": "scripts/lib/read-budget-preflight.mjs",
+        "to": "external:fs",
+        "kind": "imports"
+      },
+      {
+        "from": "scripts/lib/read-budget-preflight.mjs",
+        "to": "external:path",
+        "kind": "imports"
+      },
       {
         "from": "scripts/lib/state-lock.mjs",
         "to": "external:better-sqlite3",
@@ -43021,6 +43037,11 @@
         "to": "scripts/lib/pre-tool-enforcer-preflight.mjs",
         "kind": "imports"
       },
+      {
+        "from": "scripts/pre-tool-enforcer.mjs",
+        "to": "scripts/lib/read-budget-preflight.mjs",
+        "kind": "imports"
+      },
       {
         "from": "scripts/pre-tool-enforcer.mjs",
         "to": "scripts/lib/skill-entitlements.mjs",
@@ -79188,12 +79209,12 @@
       }
     ],
     "stats": {
-      "nodeCount": 6994,
-      "edgeCount": 7562,
-      "importEdgeCount": 6237,
+      "nodeCount": 6995,
+      "edgeCount": 7565,
+      "importEdgeCount": 6240,
       "registerEdgeCount": 64
     }
   },
-  "inventorySha256": "59161ce9158e453e3c5d0affa05dfa40a05fe0da977c95a0e8ada1fb5735de23",
-  "manifestSha256": "39c581fec6bbddfb0869b95bfc22ad4953ca7d593fc566fc7468b94ac623dc97"
+  "inventorySha256": "1b4990a2b61dcb59fd88700e1a31a8e4bca4447439e9904503d63d0b2acd39c4",
+  "manifestSha256": "007679164c0a1dc2bd25ef1a8bd837d32b53fe289f6ee5423b4319c7478277d0"
 }
```

**File**: `scripts/lib/read-budget-preflight.mjs` (added, +301/-0)
```diff
@@ -0,0 +1,301 @@
+// Read Budget Preflight (issue #4054)
+//
+// `agents/explore.md` has carried a `<Context_Budget>` section since #587: use
+// `lsp_document_symbols` for an outline, read large files with `offset`/`limit`,
+// never pull a 500+ line file in full. Nothing enforced it — the rule was prose
+// in one agent definition while the cost accumulates in every agent and in the
+// main loop.
+//
+// This evaluator turns that rule into a gate. A `Read` with neither `offset` nor
+// `limit`, against an existing file over the line budget, is warned once and then
+// denied. Targeted reads, small files, allowlisted paths, and an explicit off
+// switch all pass through untouched — the allow list matters more than the deny.
+//
+// The correctness argument is stronger than the token one: `Read` caps its own
+// output at 25,000 tokens, so a full read of a 2,500 line file silently returns
+// a fraction of it and still reads like a complete answer.
+//
+// Configuration (`.omc-config.json` or `.omc/config.json`):
+//
+//   {
+//     "context": {
+//       "readBudget": {
+//         "enabled": true,
+//         "maxLines": 1500,
+//         "mode": "warn-then-deny",
+//         "allowPaths": ["docs/adr/**", "CHANGELOG.md"]
+//       }
+//     }
+//   }
+//
+// Env overrides: `OMC_READ_BUDGET=off` disables the gate entirely (this is the
+// replacement for explore.md's unenforceable "unless the caller specifically
+// asked for full file content" clause — a PreToolUse hook cannot see caller
+// intent, so the escape has to be explicit). `OMC_READ_BUDGET_MAX_LINES`
+// overrides the threshold for one-off runs.
+//
+// Bash is gated too, but only for a bare `cat <file>`: `cat f | grep x`,
+// `cat f > g`, and `sed -n '1,200p' f` are all targeted reads and stay allowed.
+
+import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
+import { isAbsolute, join, relative, resolve } from 'path';
+
+const STATE_FILENAME = 'read-budget-warnings.json';
+const WARNING_RETENTION_SECONDS = 6 * 3600;
+const DEFAULT_MAX_LINES = 1500;
+const DEFAULT_MODE = 'warn-then-deny';
+// Above this size the file is over any sane line budget; skip the line count.
+const HUGE_FILE_BYTES = 5 * 1024 * 1024;
+const READ_TOOL_NAMES = new Set(['Read', 'View']);
+
+function nowSec() {
+  return Math.floor(Date.now() / 1000);
+}
+
+function readBudgetConfig(loadOmcConfig) {
+  try {
+    const cfg = typeof loadOmcConfig === 'function' ? loadOmcConfig() : null;
+    return cfg?.context?.readBudget ?? null;
+  } catch {
+    return null;
+  }
+}
+
+function resolveMaxLines(cfg, env) {
+  const fromEnv = Number.parseInt(env.OMC_READ_BUDGET_MAX_LINES || '', 10);
+  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
+  if (Number.isFinite(cfg?.maxLines) && cfg.maxLines > 0) return cfg.maxLines;
+  return DEFAULT_MAX_LINES;
+}
+
+function resolveMode(cfg) {
+  const mode = typeof cfg?.mode === 'string' ? cfg.mode.trim() : '';
+  return mode === 'deny' || mode === 'warn' ? mode : DEFAULT_MODE;
+}
+
+// Minimal glob support: `*` within a segment, `**` across segments. Patterns are
+// matched against both the cwd-relative and the absolute path so a user can write
+// either form in config.
+function globToRegExp(pattern) {
+  let out = '';
+  for (let i = 0; i < pattern.length; i++) {
+    const ch = pattern[i];
+    if (ch === '*') {
+      if (pattern[i + 1] === '*') {
+        out += '.*';
+        i++;
+        if (pattern[i + 1] === '/') i++;
+      } else {
+        out += '[^/]*';
+      }
+      continue;
+    }
+    if (ch === '?') {
+      out += '[^/]';
+      continue;
+    }
+    out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
+  }
+  return new RegExp(`^${out}$`);
+}
+
+function isAllowlisted(cfg, absolutePath, cwd) {
+  const patterns = Array.isArray(cfg?.allowPaths) ? cfg.allowPaths : [];
+  if (patterns.length === 0) return false;
+  const rel = relative(cwd, absolutePath).split('\\').join('/');
+  const abs = absolut
```

**File**: `scripts/pre-tool-enforcer.mjs` (modified, +34/-0)
```diff
@@ -16,6 +16,7 @@ import { getClaudeConfigDir } from './lib/config-dir.mjs';
 import { encodeProjectPath } from './lib/encode-project-path.mjs';
 import { evaluateAgentHeavyPreflight } from './lib/pre-tool-enforcer-preflight.mjs';
 import { evaluateForceAgentDelegation } from './lib/force-agent-delegation-preflight.mjs';
+import { evaluateReadBudget } from './lib/read-budget-preflight.mjs';
 import { resolveOmcStateRoot, resolveSessionStatePathsForHook } from './lib/state-root.mjs';
 import { readStdin } from './lib/stdin.mjs';
 import { resolveConfiguredAgentModel } from './lib/agent-model-config.mjs';
@@ -1905,6 +1906,39 @@ async function main() {
       return;
     }
 
+    // Read budget (issue #4054): enforce the <Context_Budget> rule that has only
+    // existed as prose in agents/explore.md. A full-file Read of an oversized file
+    // is warned once and denied afterwards; targeted reads, small files,
+    // allowlisted paths, and OMC_READ_BUDGET=off pass through.
+    const readBudget = evaluateReadBudget({
+      toolName,
+      toolInput: data.toolInput || data.tool_input || {},
+      stateDir,
+      loadOmcConfig,
+      cwd: directory,
+    });
+    if (readBudget?.decision === 'block') {
+      console.log(JSON.stringify({
+        continue: true,
+        hookSpecificOutput: {
+          hookEventName: 'PreToolUse',
+          permissionDecision: 'deny',
+          permissionDecisionReason: readBudget.reason,
+        },
+      }));
+      return;
+    }
+    if (readBudget?.decision === 'warn') {
+      console.log(JSON.stringify({
+        continue: true,
+        hookSpecificOutput: {
+          hookEventName: 'PreToolUse',
+          additionalContext: readBudget.reason,
+        },
+      }));
+      return;
+    }
+
     if (toolName === 'Task' || toolName === 'Agent') {
       const rawTranscriptPath = data.transcript_path || data.transcriptPath || '';
       const transcriptPath = resolveTranscriptPath(rawTranscriptPath, directory);
```

**File**: `src/__tests__/pre-tool-enforcer.test.ts` (modified, +199/-0)
```diff
@@ -51,6 +51,10 @@ function runPreToolEnforcerWithEnv(
       // Reset Bedrock/routing env vars so tests are isolated from the host environment.
       // Tests that exercise Bedrock model-routing behaviour set these explicitly via `env`.
       OMC_AGENT_PREFLIGHT_CONTEXT_THRESHOLD: '',
+      // Read budget (issue #4054): reset so a host-exported off switch or
+      // threshold cannot mask the gate these tests assert on.
+      OMC_READ_BUDGET: '',
+      OMC_READ_BUDGET_MAX_LINES: '',
       OMC_ROUTING_FORCE_INHERIT: '',
       OMC_SUBAGENT_MODEL: '',
       CLAUDE_MODEL: '',
@@ -3068,3 +3072,198 @@ describe('pre-tool-enforcer session-scoped agent tracking (issue #3732)', () =>
     expect(advisory).not.toContain('Active agents:');
   });
 });
+
+describe('pre-tool-enforcer read budget enforcement (issue #4054)', () => {
+  let tempDir: string;
+
+  beforeEach(() => {
+    tempDir = makeGitTemp('pre-tool-enforcer-read-budget-');
+  });
+
+  afterEach(() => {
+    rmSync(tempDir, { recursive: true, force: true });
+  });
+
+  function writeFileWithLines(name: string, lines: number): string {
+    const filePath = join(tempDir, name);
+    mkdirSync(dirname(filePath), { recursive: true });
+    writeFileSync(filePath, `${Array.from({ length: lines }, (_, i) => `line ${i + 1}`).join('\n')}\n`);
+    return filePath;
+  }
+
+  function writeReadBudgetConfig(readBudget: Record<string, unknown>): void {
+    writeJson(join(tempDir, '.omc', 'config.json'), { context: { readBudget } });
+  }
+
+  function readFullFile(filePath: string, session: string, env: Record<string, string> = {}) {
+    return runPreToolEnforcerWithEnv(
+      {
+        tool_name: 'Read',
+        toolInput: { file_path: filePath },
+        cwd: tempDir,
+        session_id: session,
+      },
+      env,
+    );
+  }
+
+  function hookOutputOf(output: Record<string, unknown>): Record<string, unknown> {
+    return (output.hookSpecificOutput as Record<string, unknown>) || {};
+  }
+
+  it('warns on the first unbounded read of an oversized file and denies the next one', () => {
+    writeReadBudgetConfig({ maxLines: 50 });
+    const filePath = writeFileWithLines('big.ts', 400);
+
+    const first = readFullFile(filePath, 'session-rb-warn');
+    const firstHook = hookOutputOf(first);
+    expect(first.continue).toBe(true);
+    expect(firstHook.permissionDecision).toBeUndefined();
+    expect(String(firstHook.additionalContext)).toContain('[OMC READ BUDGET]');
+    expect(String(firstHook.additionalContext)).toContain('400 lines');
+    expect(String(firstHook.additionalContext)).toContain('lsp_document_symbols');
+
+    const second = readFullFile(filePath, 'session-rb-warn');
+    const secondHook = hookOutputOf(second);
+    expect(secondHook.hookEventName).toBe('PreToolUse');
+    expect(secondHook.permissionDecision).toBe('deny');
+    expect(String(secondHook.permissionDecisionReason)).toContain('Denied');
+    expect(String(secondHook.permissionDecisionReason)).toContain('budget 50');
+    expect(String(secondHook.permissionDecisionReason)).toContain('ast_grep_search');
+  });
+
+  it('allows a targeted read of the same oversized file', () => {
+    writeReadBudgetConfig({ maxLines: 50 });
+    const filePath = writeFileWithLines('big.ts', 400);
+
+    for (const toolInput of [
+      { file_path: filePath, offset: 1, limit: 100 },
+      { file_path: filePath, limit: 20 },
+      { file_path: filePath, offset: 300 },
+    ]) {
+      const output = runPreToolEnforcer({
+        tool_name: 'Read',
+        toolInput,
+        cwd: tempDir,
+        session_id: 'session-rb-targeted',
+      });
+      const hook = hookOutputOf(output);
+      expect(hook.permissionDecision).toBeUndefined();
+      expect(String(hook.additionalContext || '')).not.toContain('READ BUDGET');
+    }
+  });
+
+  it('ignores files at or under the budget', () => {
+    writeReadBudgetConfig({ maxLines: 50 });
+    const exact = writeFileWithLines('exact.ts', 50);
+    cons
```

---

### Incident Patch 9: `144b3699` (2026-09-18)
**Commit Message**: fix(hud): validate watch intervals (#4053)

* fix(hud): validate watch intervals

* fix(hud): bound watch interval to timer limit

* chore(inventory): regenerate inventory graph baseline for hud watch interval validation

---------

Co-authored-by: gaebal-gajae <clawdbot@users.noreply.github.com>

**File**: `inventory/inventory-graph.json` (modified, +17/-7)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "8b220a7837ba1727c3849b7579a8e196550c2eb2",
-    "sourceSha256": "130c5e5b1736ca44457b35d5a2a8d933e11315105a2d508a70e5757892d6a3be",
+    "head": "cad8cf30d81c9515d19ae6a3bfa724b866000993",
+    "sourceSha256": "5ac18f3dc050b48c23601202ae10773b782fffc681064c4f92d077b5596a1225",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "8b220a7837ba1727c3849b7579a8e196550c2eb2",
-  "sourceSha256": "130c5e5b1736ca44457b35d5a2a8d933e11315105a2d508a70e5757892d6a3be",
+  "head": "cad8cf30d81c9515d19ae6a3bfa724b866000993",
+  "sourceSha256": "5ac18f3dc050b48c23601202ae10773b782fffc681064c4f92d077b5596a1225",
   "counts": {
     "public": {
       "skills": 43,
@@ -51651,6 +51651,11 @@
         "to": "src/cli/hud-watch.ts",
         "kind": "imports"
       },
+      {
+        "from": "src/cli/__tests__/hud-watch.test.ts",
+        "to": "src/cli/index.ts",
+        "kind": "imports"
+      },
       {
         "from": "src/cli/__tests__/hud-watch.test.ts",
         "to": "src/mcp/standalone-shutdown.ts",
@@ -52891,6 +52896,11 @@
         "to": "src/notifications/index.ts",
         "kind": "imports"
       },
+      {
+        "from": "src/cli/hud-watch.ts",
+        "to": "external:commander",
+        "kind": "imports"
+      },
       {
         "from": "src/cli/hud-watch.ts",
         "to": "src/mcp/standalone-shutdown.ts",
@@ -79179,11 +79189,11 @@
     ],
     "stats": {
       "nodeCount": 6994,
-      "edgeCount": 7560,
-      "importEdgeCount": 6235,
+      "edgeCount": 7562,
+      "importEdgeCount": 6237,
       "registerEdgeCount": 64
     }
   },
   "inventorySha256": "59161ce9158e453e3c5d0affa05dfa40a05fe0da977c95a0e8ada1fb5735de23",
-  "manifestSha256": "60e8c3df6d86a985b0e6682357f3916b346d45e73a7ac664bc608a09b5327b8e"
+  "manifestSha256": "39c581fec6bbddfb0869b95bfc22ad4953ca7d593fc566fc7468b94ac623dc97"
 }
```

**File**: `src/cli/__tests__/hud-watch.test.ts` (modified, +69/-2)
```diff
@@ -1,8 +1,75 @@
-import { afterEach, describe, expect, it, vi } from 'vitest';
+import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
 
-import { runHudWatchLoop } from '../hud-watch.js';
+import {
+  MAX_HUD_WATCH_INTERVAL_MS,
+  parseHudWatchInterval,
+  runHudWatchLoop,
+} from '../hud-watch.js';
 import type { RegisterStandaloneShutdownHandlersOptions } from '../../mcp/standalone-shutdown.js';
 
+const originalSkipParse = process.env.OMC_CLI_SKIP_PARSE;
+process.env.OMC_CLI_SKIP_PARSE = '1';
+
+afterAll(() => {
+  if (originalSkipParse === undefined) delete process.env.OMC_CLI_SKIP_PARSE;
+  else process.env.OMC_CLI_SKIP_PARSE = originalSkipParse;
+});
+
+describe('parseHudWatchInterval', () => {
+  it.each([
+    ['1', 1],
+    ['250', 250],
+    [' 1000 ', 1_000],
+    [String(MAX_HUD_WATCH_INTERVAL_MS), MAX_HUD_WATCH_INTERVAL_MS],
+  ])('parses %j as %i milliseconds', (raw, expected) => {
+    expect(parseHudWatchInterval(raw)).toBe(expected);
+  });
+
+  it.each([
+    '',
+    '0',
+    '-1',
+    '1.5',
+    '100ms',
+    'abc',
+    String(MAX_HUD_WATCH_INTERVAL_MS + 1),
+    String(Number.MAX_SAFE_INTEGER),
+    `${Number.MAX_SAFE_INTEGER}0`,
+  ])('rejects invalid interval %j', (raw) => {
+    expect(() => parseHudWatchInterval(raw)).toThrow(
+      `must be an integer between 1 and ${MAX_HUD_WATCH_INTERVAL_MS} milliseconds`,
+    );
+  });
+});
+
+describe('HUD interval Commander integration', () => {
+  it('uses a numeric default and rejects invalid input before the action', async () => {
+    vi.resetModules();
+    const { buildProgram } = await import('../index.js');
+    const program = buildProgram();
+    const hudCommand = program.commands.find((command) => command.name() === 'hud');
+    const intervalOption = hudCommand?.options.find((option) => option.long === '--interval');
+
+    expect(hudCommand).toBeDefined();
+    expect(intervalOption).toBeDefined();
+    expect(intervalOption?.defaultValue).toBe(1_000);
+    expect(typeof intervalOption?.defaultValue).toBe('number');
+    expect(intervalOption?.parseArg?.('250', intervalOption.defaultValue)).toBe(250);
+    expect(hudCommand?.helpInformation()).toContain('--interval <ms>');
+
+    program.configureOutput({ writeErr: () => undefined });
+    program.exitOverride();
+    hudCommand?.exitOverride();
+
+    await expect(
+      program.parseAsync(['node', 'omc', 'hud', '--interval', '0'], { from: 'node' }),
+    ).rejects.toMatchObject({
+      code: 'commander.invalidArgument',
+      exitCode: 1,
+    });
+  });
+});
+
 describe('runHudWatchLoop', () => {
   afterEach(() => {
     vi.useRealTimers();
```

**File**: `src/cli/hud-watch.ts` (modified, +22/-0)
```diff
@@ -1,3 +1,4 @@
+import { InvalidArgumentError } from 'commander';
 import { registerStandaloneShutdownHandlers } from '../mcp/standalone-shutdown.js';
 
 export interface HudMainLike {
@@ -10,6 +11,27 @@ export interface HudWatchLoopOptions {
   registerShutdownHandlers?: typeof registerStandaloneShutdownHandlers;
 }
 
+/** Largest delay Node.js timers preserve without overflowing to 1 ms. */
+export const MAX_HUD_WATCH_INTERVAL_MS = 2_147_483_647;
+
+export function parseHudWatchInterval(value: string): number {
+  const normalized = value.trim();
+  const intervalMs = Number(normalized);
+
+  if (
+    !/^\d+$/.test(normalized) ||
+    !Number.isSafeInteger(intervalMs) ||
+    intervalMs < 1 ||
+    intervalMs > MAX_HUD_WATCH_INTERVAL_MS
+  ) {
+    throw new InvalidArgumentError(
+      `must be an integer between 1 and ${MAX_HUD_WATCH_INTERVAL_MS} milliseconds`,
+    );
+  }
+
+  return intervalMs;
+}
+
 /**
  * Run the HUD in watch mode until an explicit shutdown signal or parent-exit
  * condition is observed.
```

**File**: `src/cli/index.ts` (modified, +3/-4)
```diff
@@ -68,7 +68,7 @@ import { checkpointCommand } from './checkpoint.js';
 import { lookoutCommand } from './lookout.js';
 import { warnIfWin32 } from './win32-warning.js';
 import { autoresearchCommand } from './autoresearch.js';
-import { runHudWatchLoop } from './hud-watch.js';
+import { parseHudWatchInterval, runHudWatchLoop } from './hud-watch.js';
 
 const version = getRuntimePackageVersion();
 
@@ -1431,12 +1431,11 @@ program
   .command('hud')
   .description('Run the OMC HUD statusline renderer')
   .option('--watch', 'Run in watch mode (continuous polling for tmux pane)')
-  .option('--interval <ms>', 'Poll interval in milliseconds', '1000')
+  .option('--interval <ms>', 'Poll interval in milliseconds', parseHudWatchInterval, 1000)
   .action(async (options) => {
     const { main: hudMain } = await import('../hud/index.js');
     if (options.watch) {
-      const intervalMs = parseInt(options.interval, 10);
-      await runHudWatchLoop({ intervalMs, hudMain });
+      await runHudWatchLoop({ intervalMs: options.interval, hudMain });
     } else {
       await hudMain();
     }
```

---

### Incident Patch 10: `16b65851` (2026-09-16)
**Commit Message**: perf(hud): throttle and batch the shared cache sweep (fix #4045) (#4051)

Every statusLine render ran the whole-directory cleanup before stdin capture and
before the cached-output path, and cleanup_stale_session_caches evaluated the TTL
per file with date + stat + head. With 416 session-cache files that is over 1,200
subprocesses per render, repeated by every overlapping wrapper, while nothing was
actually expired.

Two changes:

- cleanup_stale_session_caches is one find -mmin invocation instead of a loop.
  The session caches carry no pid or ownership semantics, only the TTL, so age is
  the entire predicate and find can evaluate it without spawning per file.
- The global sweep is interval-gated (OMC_HUD_SWEEP_INTERVAL_SECONDS, default 300)
  behind a shared sweep.lock, so concurrent wrappers no longer run the same sweep
  simultaneously. The stamp is written before sweeping so a crash mid-sweep backs
  off instead of hot-looping.

A session still reclaims its own stale render lock immediately on the acquisition
path, so throttling the global render.*.lock sweep does not delay recovery for the
session that needs it; the sweep only reclaims abandoned other-session artifacts.

Meas

**File**: `inventory/inventory-graph.json` (modified, +5/-5)
```diff
@@ -5,15 +5,15 @@
   "provenance": {
     "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
     "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-    "head": "ad2d5f20cf89ad6082221adbfc31bcd2cd1414d2",
-    "sourceSha256": "6c7a47c1c2e10a9a6b2f197e744c6fa6c7c4da7c08fbb85cda426d73096ad00c",
+    "head": "43923a49d71fee785c531ed94241bb7a4e7808ef",
+    "sourceSha256": "57dd767e8db8bea0701062a638e08115f62f8c3acbdcf5f81c43faec30c5f23e",
     "generatedAt": null,
     "generator": "scripts/generate-inventory-graph.mjs"
   },
   "base": "05c800f40d1ad53b42a78609d2667ef4f726808b",
   "planningHead": "0a91273e61dbbd47eb0af4c02844409251e08398",
-  "head": "ad2d5f20cf89ad6082221adbfc31bcd2cd1414d2",
-  "sourceSha256": "6c7a47c1c2e10a9a6b2f197e744c6fa6c7c4da7c08fbb85cda426d73096ad00c",
+  "head": "43923a49d71fee785c531ed94241bb7a4e7808ef",
+  "sourceSha256": "57dd767e8db8bea0701062a638e08115f62f8c3acbdcf5f81c43faec30c5f23e",
   "counts": {
     "public": {
       "skills": 43,
@@ -79185,5 +79185,5 @@
     }
   },
   "inventorySha256": "59161ce9158e453e3c5d0affa05dfa40a05fe0da977c95a0e8ada1fb5735de23",
-  "manifestSha256": "2a0857a762cd7ec6e4c04af5ec2ddd54f37f648ffb60bcb501c4646d686bf863"
+  "manifestSha256": "d58ec0c8a22395dbe0402e4dced17c216ed90323a1e59dd16b78b7fca13527c9"
 }
```

**File**: `scripts/lib/hud-cache-wrapper.sh` (modified, +49/-18)
```diff
@@ -19,6 +19,11 @@ HUD_SCRIPT=${1:-"$SCRIPT_DIR/omc-hud.mjs"}
 INPUT_TMP="$CACHE_DIR/stdin.$$.tmp"
 LOCK_STALE_SECONDS=${OMC_HUD_LOCK_STALE_SECONDS:-10}
 CACHE_TTL_SECONDS=${OMC_HUD_CACHE_TTL_SECONDS:-604800}
+# Global cleanup is a whole-directory sweep shared by every session, so it runs on an
+# interval instead of on every render. 0 forces a sweep (used by the tests).
+SWEEP_INTERVAL_SECONDS=${OMC_HUD_SWEEP_INTERVAL_SECONDS:-300}
+SWEEP_STAMP="$CACHE_DIR/sweep.stamp"
+SWEEP_LOCK="$CACHE_DIR/sweep.lock"
 
 mkdir -p "$CACHE_DIR" 2>/dev/null || {
   printf '[OMC] Starting...\n'
@@ -43,15 +48,6 @@ is_stale_path() {
   [ $((now - path_mtime)) -gt "$LOCK_STALE_SECONDS" ] || return 1
 }
 
-is_cache_stale_path() {
-  path=$1
-  now=$(date +%s 2>/dev/null || printf '0')
-  path_mtime=$(file_mtime "$path")
-  [ -n "$path_mtime" ] || return 1
-  [ "$now" -gt 0 ] || return 1
-  [ $((now - path_mtime)) -gt "$CACHE_TTL_SECONDS" ] || return 1
-}
-
 is_numeric_pid() {
   case "$1" in
     ''|*[!0-9]*) return 1 ;;
@@ -164,18 +160,53 @@ cleanup_stale_render_locks() {
   done
 }
 
+# One find invocation per name pattern instead of date+stat+head per file. The session
+# caches carry no pid-aware or ownership semantics, only the TTL, so age is the whole
+# predicate and find can evaluate it without spawning anything per file.
 cleanup_stale_session_caches() {
-  for cache_path in "$CACHE_DIR"/stdin.*.json "$CACHE_DIR"/statusline.*.txt; do
-    [ -f "$cache_path" ] || continue
-    is_cache_stale_path "$cache_path" || continue
-    rm -f "$cache_path" 2>/dev/null || :
-  done
+  ttl_minutes=$((CACHE_TTL_SECONDS / 60))
+  [ "$ttl_minutes" -ge 1 ] || ttl_minutes=1
+  find "$CACHE_DIR" -maxdepth 1 -type f \
+    \( -name 'stdin.*.json' -o -name 'statusline.*.txt' \) \
+    -mmin +"$ttl_minutes" -exec rm -f {} + 2>/dev/null || :
+}
+
+# True when the shared sweep stamp is younger than the interval, i.e. another session
+# already swept recently and this render must not repeat the whole-directory scan.
+sweep_is_fresh() {
+  [ "$SWEEP_INTERVAL_SECONDS" -gt 0 ] 2>/dev/null || return 1
+  [ -f "$SWEEP_STAMP" ] || return 1
+  now=$(date +%s 2>/dev/null || printf '0')
+  [ "$now" -gt 0 ] || return 1
+  stamp_mtime=$(file_mtime "$SWEEP_STAMP")
+  [ -n "$stamp_mtime" ] || return 1
+  [ $((now - stamp_mtime)) -lt "$SWEEP_INTERVAL_SECONDS" ]
+}
+
+# Interval-gated and mutually exclusive across concurrent wrappers: overlapping renders
+# used to run the same sweep simultaneously, which is what made a dozen wrappers pile up.
+run_global_cleanup() {
+  sweep_is_fresh && return 0
+  if [ "$SWEEP_INTERVAL_SECONDS" -gt 0 ] 2>/dev/null; then
+    acquire_lock_owned "$SWEEP_LOCK" || {
+      is_lock_stale "$SWEEP_LOCK" || return 0
+      rm -rf "$SWEEP_LOCK" 2>/dev/null || :
+      acquire_lock_owned "$SWEEP_LOCK" || return 0
+    }
+    # Stamp before sweeping so a crash mid-sweep still backs off instead of hot-looping.
+    : > "$SWEEP_STAMP" 2>/dev/null || :
+  fi
+
+  cleanup_stale_temp_files
+  cleanup_stale_err_files
+  cleanup_stale_render_locks
+  cleanup_stale_session_caches
+
+  [ "$SWEEP_INTERVAL_SECONDS" -gt 0 ] 2>/dev/null && rm -rf "$SWEEP_LOCK" 2>/dev/null
+  return 0
 }
 
-cleanup_stale_temp_files
-cleanup_stale_err_files
-cleanup_stale_render_locks
-cleanup_stale_session_caches
+run_global_cleanup
 
 # Capture Claude's current statusLine stdin first so rendered output can be
 # scoped per session/worktree instead of leaking across concurrent sessions.
```

**File**: `src/__tests__/hud-cache-wrapper.test.ts` (modified, +125/-1)
```diff
@@ -197,7 +197,15 @@ describe('HUD cache wrapper lock ownership (issue #3933 defect 1)', () => {
     result = spawnSync('sh', [wrapperPath, hudScript], {
       input: JSON.stringify({ session_id: 'unrelated', cwd: tempRoot }),
       encoding: 'utf8',
-      env: { ...process.env, PATH: `${fakeBin}:/usr/bin:/bin`, OMC_HUD_CACHE_DIR: cacheDir, OMC_HUD_SYNC_REFRESH: '1' },
+      env: {
+        ...process.env,
+        PATH: `${fakeBin}:/usr/bin:/bin`,
+        OMC_HUD_CACHE_DIR: cacheDir,
+        OMC_HUD_SYNC_REFRESH: '1',
+        // Reclaiming another session's abandoned lock is part of the interval-gated
+        // global sweep, and the previous run in this cache dir already stamped it.
+        OMC_HUD_SWEEP_INTERVAL_SECONDS: '0',
+      },
       timeout: 2000,
     });
     expect(existsSync(staleBad)).toBe(false);
@@ -424,6 +432,122 @@ describe('HUD cache wrapper per-session cache TTL (issue #3938)', () => {
     rmSync(tempRoot, { recursive: true, force: true });
   });
 
+  it('does not re-sweep the shared cache directory while the sweep stamp is fresh (issue #4045)', () => {
+    const tempRoot = mkdtempSync(join(tmpdir(), 'omc-hud-4045-throttle-'));
+    const cacheDir = join(tempRoot, 'cache');
+    mkdirSync(cacheDir, { recursive: true });
+
+    const hudScript = join(tempRoot, 'fake-hud.mjs');
+    writeFileSync(hudScript, "process.stdin.resume(); process.stdin.on('end', () => console.log('sweep-ok'));\n");
+
+    const env = { ...process.env, OMC_HUD_CACHE_DIR: cacheDir, OMC_HUD_SYNC_REFRESH: '1' };
+    const render = (sessionId: string) =>
+      execFileSync('sh', [wrapperPath, hudScript], {
+        input: JSON.stringify({ session_id: sessionId, cwd: tempRoot }),
+        encoding: 'utf8',
+        env,
+        timeout: 4000,
+      });
+
+    expect(render('sweep-first')).toBe('sweep-ok\n');
+    const stamp = join(cacheDir, 'sweep.stamp');
+    expect(existsSync(stamp)).toBe(true);
+    // The sweep lock must never be left behind, otherwise every later render backs off.
+    expect(existsSync(join(cacheDir, 'sweep.lock'))).toBe(false);
+
+    // Expired cache published after the first sweep: the second render is inside the
+    // interval, so it must return without touching another session's files.
+    const expired = join(cacheDir, 'statusline.expired-other.txt');
+    writeFileSync(expired, 'expired\n');
+    makeVeryOld(expired);
+
+    expect(render('sweep-second')).toBe('sweep-ok\n');
+    expect(existsSync(expired)).toBe(true);
+
+    // Interval elapsed — the next render sweeps and reclaims it.
+    makeOld(stamp);
+    expect(
+      execFileSync('sh', [wrapperPath, hudScript], {
+        input: JSON.stringify({ session_id: 'sweep-third', cwd: tempRoot }),
+        encoding: 'utf8',
+        env: { ...env, OMC_HUD_SWEEP_INTERVAL_SECONDS: '5' },
+        timeout: 4000,
+      }),
+    ).toBe('sweep-ok\n');
+    expect(existsSync(expired)).toBe(false);
+
+    rmSync(tempRoot, { recursive: true, force: true });
+  });
+
+  it('sweeps expired session caches without spawning a process per file (issue #4045)', () => {
+    const tempRoot = mkdtempSync(join(tmpdir(), 'omc-hud-4045-fanout-'));
+    const cacheDir = join(tempRoot, 'cache');
+    mkdirSync(cacheDir, { recursive: true });
+
+    const hudScript = join(tempRoot, 'fake-hud.mjs');
+    writeFileSync(hudScript, "process.stdin.resume(); process.stdin.on('end', () => console.log('fanout-ok'));\n");
+
+    const expiredPaths: string[] = [];
+    const freshPaths: string[] = [];
+    for (let index = 0; index < 40; index += 1) {
+      const expiredJson = join(cacheDir, `stdin.expired-${index}.json`);
+      const expiredTxt = join(cacheDir, `statusline.expired-${index}.txt`);
+      writeFileSync(expiredJson, '{}\n');
+      writeFileSync(expiredTxt, 'expired\n');
+      makeVeryOld(expiredJson);
+      makeVeryOld(expiredTxt);
+      expiredPaths.push(expiredJson, expiredTxt);
+
+      const freshJson = join(cacheDir, `stdin.fresh-${index}.
```

#### Recent Merged Pull Requests:
- **PR #4188** (2026-09-30): feat(ralph): omc ralph verify — the single executor of the feedback diff (@pangpang778)
- **PR #4187** (2026-09-30): feat(ralph): omc ralph afk — headless isolated launch + fix win32 .cmd spawn routing (@pangpang778)
- **PR #4186** (2026-09-30): fix(lsp): normalize diagnostic URI keys so Windows drive-letter encoding matches (#4185) (@Yeachan-Heo)
- **PR #4184** (2026-09-30): feat(ralph): risk-ordered stories, repo quality class, and a feedback baseline (@pangpang778)
- **PR #4183** (2026-09-30): feat(factory): enforcement layer completion - CI trigger, factory init, check evidence, diff-first, daily cap (@pangpang778)
- **PR #4182** (2026-09-30): feat(session-end): daily-chain-limit env override + diff-first gate doctrine (@pangpang778)
- **PR #4181** (2026-09-30): docs(design): software factory final design - 13 foundation stones + v1.3 borrowings (@pangpang778)
- **PR #4180** (2026-09-30): fix(session-end)+feat(factory): name silent chain stalls, add 'omc factory status' audit view (@pangpang778)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
