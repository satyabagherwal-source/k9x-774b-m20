# Forensic Learning Record (Deep Inspection): wshobson/agents

> **Canonical Artifact**: `07_PROJECT_LEARNING/wshobson-agents-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wshobson/agents](https://github.com/wshobson/agents))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:51:29.752Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wshobson/agents`
- **Description**: Multi-harness agentic plugin marketplace for Claude Code, Codex, Cursor, OpenCode, GitHub Copilot, Google Antigravity, and Pi
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 40229 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `plugins/llm-application-dev/skills/prompt-engineering-patterns/scripts/optimize-prompt.py`
```
#!/usr/bin/env python3
"""
Prompt Optimization Script

Automatically test and optimize prompts using A/B testing and metrics tracking.
"""

import json
import time
from typing import List, Dict, Any
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import numpy as np


@dataclass
class TestCase:
    input: Dict[str, Any]
    expected_output: str
    metadata: Dict[str, Any] = None


class PromptOptimizer:
    def __init__(self, llm_client, test_suite: List[TestCase]):
        self.client = llm_client
        self.test_suite = test_suite
        self.results_history = []
        self.executor = ThreadPoolExecutor()

    def shutdown(self):
        """Shutdown the thread pool executor."""
        self.executor.shutdown(wait=True)

    def evaluate_prompt(self, prompt_template: str, test_cases: List[TestCase] = None) -> Dict[str, float]:
        """Evaluate a prompt template against test cases in parallel."""
        if test_cases is None:
            test_cases = self.test_suite

        metrics = {
            'accuracy': [],
            'latency': [],
            'token_count': [],
            'success_rate': []
        }

        def process_test_case(test_case):
            start_time = time.time()

            # Render prompt with test case inputs
            prompt = prompt_template.format(**test_case.input)

            # Get LLM response
            response = self.client.complete(prompt)

            # Measure latency
            latency = time.time() - start_time

            # Calculate individual metrics
            token_count = len(prompt.split()) + len(response.split())
            success = 1 if response else 0
            accuracy = self.calculate_accuracy(response, test_case.expected_output)

            return {
                'latency': latency,
                'token_count': token_count,
                'success_rate': success,
                'accuracy': accuracy
            }

        # Run test cases in parallel
        results = list(self.executor.map(process_test_case, test_cases))

        # Aggregate metrics
        for result in results:
            metrics['latency'].append(result['latency'])
            metrics['token_count'].append(result['token_count'])
            metrics['success_rate'].append(result['success_rate'])
            metrics['accuracy'].append(result['accuracy'])

        return {
            'avg_accuracy': np.mean(metrics['accuracy']),
            'avg_latency': np.mean(metrics['latency']),
            'p95_latency': np.percentile(metrics['latency'], 95),
            'avg_tokens': np.mean(metrics['token_count']),
            'success_rate': np.mean(metrics['success_rate'])
        }

    def calculate_accuracy(self, response: str, expected: str) -> float:
        """Calculate accuracy score between response and expected output."""
        # Simple exact match
        if response.strip().lower() == expected.strip().lower():
            return 1.0

        # Partial match using word overlap
        response_words = set(response.lower().split())
        expected_words = set(expected.lower().split())

        if not expected_words:
            return 0.0

        overlap = len(response_words & expected_words)
        return overlap / len(expected_words)

    def optimize(self, base_prompt: str, max_iterations: int = 5) -> Dict[str, Any]:
        """Iteratively optimize a prompt."""
        current_prompt = base_prompt
        best_prompt = base_prompt
        best_score = 0
        current_metrics = None

        for iteration in range(max_iterations):
            print(f"\nIteration {iteration + 1}/{max_iterations}")

            # Evaluate current prompt
            # Bolt Optimization: Avoid re-evaluating if we already have metrics from previous iteration
            if current_metrics:
                metrics = current_metrics
            else:
                metrics = self.evaluate_prompt(current_prompt)

            print(f"Accuracy: {metrics['avg_accuracy']:.2f}, Latency: {metrics['avg_latency']:.2f}s")

            # Track results
            self.results_history.append({
                'iteration': iteration,
                'prompt': current_prompt,
                'metrics': metrics
            })

            # Update best if improved
            if metrics['avg_accuracy'] > best_score:
                best_score = metrics['avg_accuracy']
                best_prompt = current_prompt

            # Stop if good enough
            if metrics['avg_accuracy'] > 0.95:
                print("Achieved target accuracy!")
                break

            # Generate variations for next iteration
            variations = self.generate_variations(current_prompt, metrics)

            # Test variations and pick best
            best_variation = current_prompt
            best_variation_score = metrics['avg_accuracy']
            best_variation_metrics = metrics

            for variation in variations:
                var_metrics = self.evaluate_prompt(variation)
                if var_metrics['avg_accuracy'] > best_variation_score:
                    best_variation_score = var_metrics['avg_accuracy']
                    best_variation = variation
                    best_variation_metrics = var_metrics

            # Variations are generated deterministically from the prompt, so a
            # round with no improvement would repeat identical evaluations for
            # every remaining iteration.
            if best_variation == current_prompt:
                print("No improving variation found. Stopping optimization.")
                break

            current_prompt = best_variation
            current_metrics = best_variation_metrics

        return {
            'best_prompt': best_prompt,
            'best_score': best_score,
            'history': self.results_history
        }

    def generate_variations(self, prompt: str, current_metrics: Dict) -> List[str]:
        """Generate prompt variations to test."""
        variations = []

        # Variation 1: Add explicit format instruction
        variations.append(prompt + "\n\nProvide your answer in a clear, concise format.")

        # Variation 2: Add step-by-step instruction
        variations.append("Let's solve this step by step.\n\n" + prompt)

        # Variation 3: Add verification step
        variations.append(prompt + "\n\nVerify your answer before responding.")

        # Variation 4: Make more concise
        concise = self.make_concise(prompt)
        if concise != prompt:
            variations.append(concise)

        # Variation 5: Add examples (if none present)
        if "example" not in prompt.lower():
            variations.append(self.add_examples(prompt))

        return variations[:3]  # Return top 3 variations

    def make_concise(self, prompt: str) -> str:
        """Remove redundant words to make prompt more concise."""
        replacements = [
            ("in order to", "to"),
            ("due to the fact that", "because"),
            ("at this point in time", "now"),
            ("in the event that", "if"),
        ]

        result = prompt
        for old, new in replacements:
            result = result.replace(old, new)

        return result

    def add_examples(self, prompt: str) -> str:
        """Add example section to prompt."""
        return f"""{prompt}

Example:
Input: Sample input
Output: Sample output
"""

    def compare_prompts(self, prompt_a: str, prompt_b: str) -> Dict[str, Any]:
        """A/B test two prompts."""
        print("Testing Prompt A...")
        metrics_a = self.evaluate_prompt(prompt_a)

        print("Testing Prompt B...")
        metrics_b = self.evaluate_prompt(prompt_b)

        return {
            'prompt_a_metrics': metrics_a,
            'prompt_b_metrics': metrics_b,
            'winner': 'A' if metrics_a['avg_accuracy'] > metrics_b['avg_accuracy'] else 'B',
            'improvement': abs(metrics_a['avg_accuracy'] - metrics_b['avg_accuracy'])
        }

    def export_results(self, filename: str):
        """Export optimization results to JSON."""
        with open(filename, 'w') as f:
            json.dump(self.results_history, f, indent=2)


def main():
    # Example usage
    test_suite = [
        TestCase(
            input={'text': 'This movie was amazing!'},
            expected_output='Positive'
        ),
        TestCase(
            input={'text': 'Worst purchase ever.'},
            expected_output='Negative'
        ),
        TestCase(
            input={'text': 'It was okay, nothing special.'},
            expected_output='Neutral'
        )
    ]

    # Mock LLM client for demonstration
    class MockLLMClient:
        def complete(self, prompt):
            # Simulate LLM response
            if 'amazing' in prompt:
                return 'Positive'
            elif 'worst' in prompt.lower():
                return 'Negative'
            else:
                return 'Neutral'

    optimizer = PromptOptimizer(MockLLMClient(), test_suite)

    try:
        base_prompt = "Classify the sentiment of: {text}\nSentiment:"

        results = optimizer.optimize(base_prompt)

        print("\n" + "="*50)
        print("Optimization Complete!")
        print(f"Best Accuracy: {results['best_score']:.2f}")
        print(f"Best Prompt:\n{results['best_prompt']}")

        optimizer.export_results('optimization_results.json')
    finally:
        optimizer.shutdown()


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `plugins/plugin-eval/src/plugin_eval/engine.py`
```
"""Eval Engine — coordinates all layers and produces composite scores."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path

from plugin_eval.layers.static import StaticAnalyzer, anti_pattern_penalty
from plugin_eval.models import (
    Badge,
    CompositeResult,
    Depth,
    DimensionScore,
    EvalConfig,
    LayerResult,
    PluginEvalResult,
)
from plugin_eval.parser import ParsedSkill, parse_skill

# Top-level dimension weights (must sum to 1.0)
DIMENSION_WEIGHTS: dict[str, float] = {
    "triggering_accuracy": 0.25,
    "orchestration_fitness": 0.20,
    "output_quality": 0.15,
    "scope_calibration": 0.12,
    "progressive_disclosure": 0.10,
    "token_efficiency": 0.06,
    "robustness": 0.05,
    "structural_completeness": 0.03,
    "code_template_quality": 0.02,
    "ecosystem_coherence": 0.02,
}

# Per-dimension blend weights across layers
LAYER_BLENDS: dict[str, dict[str, float]] = {
    "triggering_accuracy": {"static": 0.15, "judge": 0.25, "monte_carlo": 0.60},
    "orchestration_fitness": {"static": 0.10, "judge": 0.70, "monte_carlo": 0.20},
    "output_quality": {"static": 0.00, "judge": 0.40, "monte_carlo": 0.60},
    "scope_calibration": {"static": 0.30, "judge": 0.55, "monte_carlo": 0.15},
    "progressive_disclosure": {"static": 0.80, "judge": 0.20, "monte_carlo": 0.00},
    "token_efficiency": {"static": 0.40, "judge": 0.10, "monte_carlo": 0.50},
    "robustness": {"static": 0.00, "judge": 0.20, "monte_carlo": 0.80},
    "structural_completeness": {"static": 0.90, "judge": 0.10, "monte_carlo": 0.00},
    "code_template_quality": {"static": 0.30, "judge": 0.70, "monte_carlo": 0.00},
    "ecosystem_coherence": {"static": 0.85, "judge": 0.15, "monte_carlo": 0.00},
}

# Maps static sub-score names → dimension names
STATIC_TO_DIMENSION: dict[str, str] = {
    "frontmatter_quality": "triggering_accuracy",
    "orchestration_wiring": "orchestration_fitness",
    "structural_completeness": "structural_completeness",
    "progressive_disclosure": "progressive_disclosure",
    "token_efficiency": "token_efficiency",
    "ecosystem_coherence": "ecosystem_coherence",
}


class EvalEngine:
    """Coordinates evaluation layers and produces composite PluginEvalResult."""

    def __init__(self, config: EvalConfig) -> None:
        self.config = config
        self._static = StaticAnalyzer()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def evaluate_skill(self, skill_dir: Path) -> PluginEvalResult:
        """Run evaluation layers on a skill directory and return a result."""
        skill = parse_skill(skill_dir)
        layers: list[LayerResult] = []

        # Layer 1: Static analysis (always runs)
        static_result = self._static.analyze_skill(skill)
        layers.append(static_result)

        # Layer 2: Judge (standard+ depth)
        if self.config.depth in (Depth.STANDARD, Depth.DEEP, Depth.THOROUGH):
            from plugin_eval.layers.judge import JudgeAnalyzer, JudgeConfig

            judge_config = JudgeConfig(
                judges=self.config.judges,
                concurrency=self.config.concurrency,
            )
            judge = JudgeAnalyzer(judge_config)

            # Layer 3: Monte Carlo (deep+ depth) — run together with judge when both active
            if self.config.depth in (Depth.DEEP, Depth.THOROUGH):
                from plugin_eval.layers.monte_carlo import MonteCarloAnalyzer, MonteCarloConfig

                n_runs = self.config.monte_carlo_n or (
                    100 if self.config.depth == Depth.THOROUGH else 50
                )
                mc_config = MonteCarloConfig(
                    n_runs=n_runs,
                    concurrency=self.config.concurrency,
                )
                mc = MonteCarloAnalyzer(mc_config)

                async def _run_llm_layers(
                    judge: JudgeAnalyzer,
                    mc: MonteCarloAnalyzer,
                    skill: ParsedSkill,
                ) -> tuple[LayerResult, LayerResult]:
                    judge_result = await judge.analyze_skill(skill)
                    mc_result = await mc.analyze_skill(skill)
                    return judge_result, mc_result

                judge_result, mc_result = asyncio.run(_run_llm_layers(judge, mc, skill))
                layers.append(judge_result)
                layers.append(mc_result)
            else:
                judge_result = asyncio.run(judge.analyze_skill(skill))
                layers.append(judge_result)

        composite = self._build_composite(layers)

        return PluginEvalResult(
            plugin_path=str(skill_dir),
            timestamp=datetime.now(UTC).isoformat(),
            config=self.config,
            layers=layers,
            composite=composite,
            model_usage=self._merge_model_usage(layers),
        )

    def evaluate_plugin(self, plugin_dir: Path) -> PluginEvalResult:
        """Run evaluation on an entire plugin directory (all skills + agents).

        Note: Plugin-level evaluation currently only runs Layer 1 (static).
        Judge and Monte Carlo require per-skill evaluation. The confidence
        label is always "Estimated" regardless of requested depth.
        """
        layers: list[LayerResult] = []

        # Layer 1: Static analysis of whole plugin
        static_result = self._static.analyze_plugin(plugin_dir)
        layers.append(static_result)

        # Plugin-level composite uses overall static score mapped to all
        # static-measurable dimensions (plugin result lacks per-dimension breakdown)
        static_overall = static_result.score
        dimension_scores = {dim: static_overall for dim in STATIC_TO_DIMENSION.values()}
        anti_pattern_count = len(static_result.anti_patterns)
        composite = self._assemble_composite(dimension_scores, anti_pattern_count)

        # Plugin-level eval only has static data — always "Estimated"
        # regardless of requested depth (judge/MC are per-skill only)
        composite.confidence_label = Depth.QUICK.confidence_label

        return PluginEvalResult(
            plugin_path=str(plugin_dir),
            timestamp=datetime.now(UTC).isoformat(),
            config=self.config,
            layers=layers,
            composite=composite,
            model_usage=self._merge_model_usage(layers),
        )

    # ------------------------------------------------------------------
    # Composite construction
    # ------------------------------------------------------------------

    def _build_composite(self, layers: list[LayerResult]) -> CompositeResult:
        """Build the CompositeResult from available layer results."""
        static_result = next((lr for lr in layers if lr.layer == "static"), None)
        judge_result = next((lr for lr in layers if lr.layer == "judge"), None)
        mc_result = next((lr for lr in layers if lr.layer == "monte_carlo"), None)

        static_scores = self._map_static_to_dimensions(static_result) if static_result else None
        judge_scores = judge_result.sub_scores if judge_result else None
        mc_scores = self._normalize_mc_scores(mc_result.sub_scores) if mc_result else None

        dimension_scores = self._blend_layer_scores(
            static_scores=static_scores,
            judge_scores=judge_scores,
            mc_scores=mc_scores,
        )

        anti_pattern_count = len(static_result.anti_patterns) if static_result else 0
        return self._assemble_composite(dimension_scores, anti_pattern_count)

    def _assemble_composite(
        self, dimension_scores: dict[str, float], anti_pattern_count: int
    ) -> CompositeResult:
        """Build a CompositeResult from blended dimension scores and anti-pattern count."""
        penalty = anti_pattern_penalty(anti_pattern_count)

        # Split into measured vs unmeasured dimensions
        # Dimensions absent from dimension_scores are also treated as unmeasured
        measured = {d: s for d, s in dimension_scores.items() if s >= 0.0}
        unmeasured = {d for d, s in dimension_scores.items() if s < 0.0} | (
            set(DIMENSION_WEIGHTS) - set(dimension_scores)
        )

        # Renormalize weights to only measured dimensions
        measured_weight_sum = sum(DIMENSION_WEIGHTS.get(d, 0.0) for d in measured)
        if measured_weight_sum > 0:
            raw = sum(
                (DIMENSION_WEIGHTS.get(dim, 0.0) / measured_weight_sum) * score
                for dim, score in measured.items()
            )
        else:
            raw = 0.0
        composite_score = min(100.0, max(0.0, raw * 100.0 * penalty))

        # Build DimensionScore objects
        dim_objects: list[DimensionScore] = []
        for dim in DIMENSION_WEIGHTS:
            weight = DIMENSION_WEIGHTS[dim]
            if dim in unmeasured:
                dim_objects.append(
                    DimensionScore(
                        name=dim,
                        weight=weight,
                        score=0.0,
                        grade="—",
                    )
                )
            else:
                score = measured.get(dim, 0.0)
                dim_objects.append(
                    DimensionScore(
                        name=dim,
                        weight=weight,
                        score=score,
                        grade=self._score_to_grade(score * 100.0),
                    )
                )

        badge = Badge.from_scores(composite_score, elo=None)

        return CompositeResult(
            score=composite_score,
            anti_pattern_penalty=penalty,
            dimensions=dim_objects,
            badge=badge,
            confidence_label=self.config.depth.confidence_label,
        )

    # ------------------------------------------------------------------
    # Layer blending
    # ------------------
```

### Core Architecture Module: `plugins/backend-development/skills/api-design-principles/assets/rest-api-template.py`
```
"""
Production-ready REST API template using FastAPI.
Includes pagination, filtering, error handling, and best practices.
"""

from fastapi import FastAPI, HTTPException, Query, Path, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum

app = FastAPI(
    title="API Template",
    version="1.0.0",
    docs_url="/api/docs"
)

# Security Middleware
# Trusted Host: Prevents HTTP Host Header attacks
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"] # TODO: Configure this in production, e.g. ["api.example.com"]
)

# CORS: Configures Cross-Origin Resource Sharing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # TODO: Update this with specific origins in production
    allow_credentials=False, # TODO: Set to True if you need cookies/auth headers, but restrict origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)
    status: UserStatus = UserStatus.ACTIVE

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    status: Optional[UserStatus] = None

class User(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Pagination
class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    pages: int

# Error handling
class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str
    code: str

class ErrorResponse(BaseModel):
    error: str
    message: str
    details: Optional[List[ErrorDetail]] = None

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.__class__.__name__,
            message=exc.detail if isinstance(exc.detail, str) else exc.detail.get("message", "Error"),
            details=exc.detail.get("details") if isinstance(exc.detail, dict) else None
        ).model_dump()
    )

# Endpoints
@app.get("/api/users", response_model=PaginatedResponse, tags=["Users"])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[UserStatus] = Query(None),
    search: Optional[str] = Query(None)
):
    """List users with pagination and filtering."""
    # Mock implementation
    total = 100
    items = [
        User(
            id=str(i),
            email=f"user{i}@example.com",
            name=f"User {i}",
            status=UserStatus.ACTIVE,
            created_at=datetime.now(),
            updated_at=datetime.now()
        ).model_dump()
        for i in range((page-1)*page_size, min(page*page_size, total))
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size
    )

@app.post("/api/users", response_model=User, status_code=status.HTTP_201_CREATED, tags=["Users"])
async def create_user(user: UserCreate):
    """Create a new user."""
    # Mock implementation
    return User(
        id="123",
        email=user.email,
        name=user.name,
        status=user.status,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

@app.get("/api/users/{user_id}", response_model=User, tags=["Users"])
async def get_user(user_id: str = Path(..., description="User ID")):
    """Get user by ID."""
    # Mock: Check if exists
    if user_id == "999":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "User not found", "details": {"id": user_id}}
        )

    return User(
        id=user_id,
        email="user@example.com",
        name="User Name",
        status=UserStatus.ACTIVE,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

@app.patch("/api/users/{user_id}", response_model=User, tags=["Users"])
async def update_user(user_id: str, update: UserUpdate):
    """Partially update user."""
    # Validate user exists
    existing = await get_user(user_id)

    # Apply updates
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(existing, field, value)

    existing.updated_at = datetime.now()
    return existing

@app.delete("/api/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Users"])
async def delete_user(user_id: str):
    """Delete user."""
    await get_user(user_id)  # Verify exists
    return None

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

```

### Core Architecture Module: `plugins/plugin-eval/scripts/eval_all.py`
```
"""Batch-evaluate every local plugin and write per-plugin JSON + a summary report.

Runs `plugin-eval score` (via the library, not the CLI subprocess) on every
plugin directory under `plugins/`. External git-subdir plugins are skipped
since their source does not exist locally. Outputs:

  reports/<plugin>.json          — raw result per plugin
  reports/summary.md             — aggregated markdown report
  reports/summary.json           — machine-readable aggregate

Plugin-level evaluation runs the static layer only, so `--depth` accepts only
`quick`. Other values exit with code 2 and point to per-skill scoring.

Intended for CI usage but works locally too:

  uv run python scripts/eval_all.py --depth quick
  uv run python scripts/eval_all.py --output-dir /tmp/reports
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from plugin_eval.engine import EvalEngine
from plugin_eval.models import Depth, EvalConfig, PluginEvalResult

REPO_ROOT = Path(__file__).resolve().parents[3]
PLUGINS_DIR = REPO_ROOT / "plugins"

DEPTH_MAP = {
    "quick": Depth.QUICK,
    "standard": Depth.STANDARD,
    "deep": Depth.DEEP,
    "thorough": Depth.THOROUGH,
}


@dataclass
class PluginRow:
    name: str
    score: float | None
    badge: str | None
    confidence: str | None
    anti_patterns: list[str]
    weakest_dimensions: list[tuple[str, float]]
    duration_ms: int | None
    errored: bool
    error: str | None = None


def discover_plugins() -> list[Path]:
    return sorted(
        p
        for p in PLUGINS_DIR.iterdir()
        if p.is_dir() and (p / ".claude-plugin" / "plugin.json").exists()
    )


def row_from_result(name: str, result: PluginEvalResult, duration_ms: int) -> PluginRow:
    comp = result.composite
    if comp is None:
        return PluginRow(
            name=name,
            score=None,
            badge=None,
            confidence=None,
            anti_patterns=[],
            weakest_dimensions=[],
            duration_ms=duration_ms,
            errored=True,
            error="No composite score produced",
        )

    # Collect unique anti-pattern flags across layers
    seen: set[str] = set()
    anti_patterns: list[str] = []
    for layer in result.layers:
        for ap in getattr(layer, "anti_patterns", []) or []:
            flag = getattr(ap, "flag", None) or str(ap)
            if flag and flag not in seen:
                seen.add(flag)
                anti_patterns.append(flag)

    # Weakest 3 dimensions (by weighted_score)
    dims = sorted(
        comp.dimensions,
        key=lambda d: (d.weighted_score if d.weight > 0 else 1.0),
    )[:3]
    weakest = [(d.name, d.score) for d in dims if d.weight > 0]

    badge_val = comp.badge.value if hasattr(comp.badge, "value") else str(comp.badge)
    return PluginRow(
        name=name,
        score=comp.score,
        badge=badge_val,
        confidence=comp.confidence_label,
        anti_patterns=anti_patterns,
        weakest_dimensions=weakest,
        duration_ms=duration_ms,
        errored=False,
    )


def evaluate_one(
    plugin_dir: Path, config: EvalConfig, output_dir: Path
) -> PluginRow:
    start = time.monotonic()
    name = plugin_dir.name
    engine = EvalEngine(config)
    try:
        result = engine.evaluate_plugin(plugin_dir)
    except Exception as exc:
        return PluginRow(
            name=name,
            score=None,
            badge=None,
            confidence=None,
            anti_patterns=[],
            weakest_dimensions=[],
            duration_ms=int((time.monotonic() - start) * 1000),
            errored=True,
            error=f"{type(exc).__name__}: {exc}",
        )

    duration_ms = int((time.monotonic() - start) * 1000)
    (output_dir / f"{name}.json").write_text(result.model_dump_json(indent=2))
    return row_from_result(name, result, duration_ms)


def format_score(v: float | None) -> str:
    """Composite scores are 0-100."""
    return f"{v:.1f}" if v is not None else "—"


def format_dim_score(v: float) -> str:
    """Dimension scores are 0-1, expressed as 0-100 for readability."""
    return f"{v * 100:.0f}"


def build_summary_md(rows: list[PluginRow], depth: str, started_at: str) -> str:
    total = len(rows)
    errored = sum(1 for r in rows if r.errored)
    scored = [r for r in rows if not r.errored and r.score is not None]
    scored.sort(key=lambda r: r.score or 0.0)

    badges: dict[str, int] = {}
    for r in scored:
        key = r.badge or "none"
        badges[key] = badges.get(key, 0) + 1

    mean_score = (
        sum((r.score or 0.0) for r in scored) / len(scored) if scored else 0.0
    )

    lines: list[str] = []
    lines.append(f"# Plugin Eval Report — depth: `{depth}`")
    lines.append("")
    lines.append(f"_Generated: {started_at}_")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Plugins evaluated: **{total}** ({errored} errored)")
    lines.append(f"- Mean score: **{mean_score:.1f}** / 100")
    badge_line = ", ".join(f"{k}: {v}" for k, v in badges.items() if v > 0)
    lines.append(f"- Badges: {badge_line or 'none'}")
    lines.append("")

    # Highlight anything scoring below 60 or with anti-patterns
    concerning = [
        r for r in scored if (r.score or 0.0) < 60.0 or r.anti_patterns
    ]
    if concerning:
        lines.append(f"## Issues requiring attention ({len(concerning)})")
        lines.append("")
        lines.append("| Plugin | Score | Badge | Anti-patterns | Weakest dimensions |")
        lines.append("|---|---|---|---|---|")
        for r in concerning:
            ap = ", ".join(r.anti_patterns) if r.anti_patterns else "—"
            weak = (
                ", ".join(f"{n} ({format_dim_score(s)})" for n, s in r.weakest_dimensions)
                or "—"
            )
            lines.append(
                f"| `{r.name}` | {format_score(r.score)} | {r.badge or '—'} | {ap} | {weak} |"
            )
        lines.append("")

    if errored:
        lines.append(f"## Errors ({errored})")
        lines.append("")
        lines.append("| Plugin | Error |")
        lines.append("|---|---|")
        for r in rows:
            if r.errored:
                lines.append(f"| `{r.name}` | {r.error or '—'} |")
        lines.append("")

    # Full ranked table
    lines.append("## All plugins (ranked by score ascending)")
    lines.append("")
    lines.append("| Plugin | Score | Badge | Confidence | Duration |")
    lines.append("|---|---|---|---|---|")
    for r in sorted(rows, key=lambda r: (r.score or 0.0)):
        dur = f"{(r.duration_ms or 0) / 1000:.1f}s" if r.duration_ms else "—"
        lines.append(
            f"| `{r.name}` | {format_score(r.score)} | "
            f"{r.badge or '—'} | {r.confidence or '—'} | {dur} |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--depth", default="quick", choices=list(DEPTH_MAP.keys())
    )
    parser.add_argument("--output-dir", default="eval-reports")
    parser.add_argument(
        "--concurrency",
        type=int,
        default=4,
        help="Has no effect, because this script runs only the static layer and makes no LLM calls",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        help="Exit 1 if mean score below this (0-100)",
    )
    parser.add_argument(
        "--only-changed",
        default=None,
        help="Comma-separated plugin names to limit evaluation to",
    )
    args = parser.parse_args()

    if args.depth != "quick":
        print(
            "plugin-level evaluation runs the static layer only; use "
            '"plugin-eval score <skill-dir> --depth standard" for the experimental LLM layers',
            file=sys.stderr,
        )
        return 2

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    plugins = discover_plugins()
    if args.only_changed:
        wanted = {n.strip() for n in args.only_changed.split(",") if n.strip()}
        plugins = [p for p in plugins if p.name in wanted]

    config = EvalConfig(
        depth=DEPTH_MAP[args.depth],
        concurrency=args.concurrency,
    )

    started_at = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    print(
        f"[eval_all] evaluating {len(plugins)} plugins at depth={args.depth} "
        f"concurrency={args.concurrency}",
        file=sys.stderr,
    )

    rows: list[PluginRow] = []
    for i, plugin_dir in enumerate(plugins, 1):
        print(
            f"[eval_all] ({i}/{len(plugins)}) {plugin_dir.name}…",
            file=sys.stderr,
        )
        row = evaluate_one(plugin_dir, config, output_dir)
        rows.append(row)

    summary_md = build_summary_md(rows, args.depth, started_at)
    (output_dir / "summary.md").write_text(summary_md)
    (output_dir / "summary.json").write_text(
        json.dumps([asdict(r) for r in rows], indent=2)
    )

    # Echo to stdout so CI can redirect to $GITHUB_STEP_SUMMARY
    sys.stdout.write(summary_md)

    scored = [r for r in rows if not r.errored and r.score is not None]
    if args.threshold is not None and scored:
        mean = sum(r.score or 0.0 for r in scored) / len(scored)
        if mean < args.threshold:
            print(
                f"[eval_all] mean {mean:.1f} below threshold {args.threshold}",
                file=sys.stderr,
            )
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `plugins/plugin-eval/src/plugin_eval/__init__.py`
```
"""PluginEval — Quality evaluation framework for Claude Code plugins."""

__version__ = "0.1.0"

```

### Core Architecture Module: `plugins/plugin-eval/src/plugin_eval/cli.py`
```
"""Typer CLI for plugin-eval."""

from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console

from plugin_eval.engine import EvalEngine
from plugin_eval.models import Depth, EvalConfig
from plugin_eval.reporter import Reporter

app = typer.Typer(
    name="plugin-eval",
    help="Evaluate Claude Code plugins and skills.",
    add_completion=False,
)
console = Console()
stderr_console = Console(stderr=True)

EXPERIMENTAL_NOTE = (
    "note: the judge and Monte Carlo layers are experimental and not validated "
    "against human labels; see evals/README.md"
)


def _detect_target(path: Path) -> str:
    """Return 'skill' if SKILL.md exists, 'plugin' if .claude-plugin/ exists, else 'unknown'."""
    if (path / "SKILL.md").exists():
        return "skill"
    if (path / ".claude-plugin").exists():
        return "plugin"
    return "unknown"


def _run_score(
    path: Path,
    depth: Depth,
    output: str,
    verbose: bool,
    concurrency: int,
    threshold: float | None,
) -> int:
    """Core scoring logic; returns exit code."""
    if not path.exists():
        console.print(f"[red]Error: Path does not exist: {path}[/red]")
        raise typer.Exit(code=2)

    config = EvalConfig(
        depth=depth,
        output_format=output,
        verbose=verbose,
        concurrency=concurrency,
    )
    engine = EvalEngine(config)

    target = _detect_target(path)
    if target == "skill":
        if depth != Depth.QUICK:
            typer.echo(EXPERIMENTAL_NOTE, err=True)
        result = engine.evaluate_skill(path)
    elif target == "plugin":
        if depth != Depth.QUICK:
            stderr_console.print(
                f"[yellow]warning:[/yellow] plugin-level evaluation only runs the "
                f"static layer; judge and Monte Carlo layers require per-skill "
                f"evaluation. Requested depth [bold]{depth.value}[/bold] will be "
                f"served from the static layer only — confidence label will be "
                f"[bold]Estimated[/bold] regardless. To use the deeper layers, "
                f"point at an individual skill directory."
            )
        result = engine.evaluate_plugin(path)
    else:
        # Attempt skill evaluation as fallback
        result = engine.evaluate_skill(path)

    reporter = Reporter()
    if output == "json":
        typer.echo(reporter.to_json(result))
    elif output == "html":
        typer.echo(reporter.to_html(result))
    else:
        # Default: markdown
        typer.echo(reporter.to_markdown(result))

    judge_layer = next((lr for lr in result.layers if lr.layer == "judge"), None)
    if judge_layer is not None:
        unmeasured = judge_layer.metadata.get("unmeasured") or []
        if unmeasured:
            stderr_console.print(
                f"[yellow]warning:[/yellow] LLM judge could not measure "
                f"{', '.join(unmeasured)}; composite computed from the remaining "
                f"layers. Check that claude-agent-sdk is installed and a model is "
                f"configured (run with --verbose for details)."
            )

    if (
        threshold is not None
        and result.composite is not None
        and result.composite.score < threshold
    ):
        return 1

    return 0


@app.command()
def score(
    path: Path = typer.Argument(..., help="Plugin or skill directory to evaluate"),  # noqa: B008
    depth: Depth = typer.Option(Depth.STANDARD, help="Evaluation depth"),  # noqa: B008
    output: str = typer.Option("markdown", help="Output format: json|markdown|html"),  # noqa: B008
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),  # noqa: B008
    concurrency: int = typer.Option(4, help="Max concurrent LLM calls"),  # noqa: B008
    threshold: float | None = typer.Option(  # noqa: B008
        None, help="Minimum score threshold; exit code 1 if below"
    ),
) -> None:
    """Evaluate a plugin or skill directory and report its quality score."""
    exit_code = _run_score(path, depth, output, verbose, concurrency, threshold)
    if exit_code != 0:
        raise typer.Exit(code=exit_code)


@app.command()
def certify(
    path: Path = typer.Argument(..., help="Plugin or skill directory to certify"),  # noqa: B008
    output: str = typer.Option("markdown", help="Output format: json|markdown|html"),  # noqa: B008
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),  # noqa: B008
    concurrency: int = typer.Option(4, help="Max concurrent LLM calls"),  # noqa: B008
    threshold: float | None = typer.Option(None, help="Minimum score threshold"),  # noqa: B008
) -> None:
    """Certify a plugin or skill (runs at deep depth)."""
    exit_code = _run_score(path, Depth.DEEP, output, verbose, concurrency, threshold)
    if exit_code != 0:
        raise typer.Exit(code=exit_code)


@app.command()
def init(
    corpus_source: Path = typer.Argument(..., help="Path to plugins directory to index as corpus"),  # noqa: B008
    corpus_dir: Path = typer.Option(  # noqa: B008
        Path.home() / ".plugineval" / "corpus",  # noqa: B008
        help="Where to store corpus index",  # noqa: B008
    ),
) -> None:
    """Initialize corpus from a plugin directory."""
    if not corpus_source.exists():
        console.print(f"[red]Error: Source path does not exist: {corpus_source}[/red]")
        raise typer.Exit(code=2)
    from plugin_eval.corpus import Corpus  # lazy import — Task 10

    corpus = Corpus.init_from_source(corpus_source, corpus_dir)
    console.print(f"[green]Corpus initialized with {corpus.size} skills at {corpus_dir}[/green]")


@app.command()
def compare(
    skill_a: Path = typer.Argument(..., help="First skill directory"),  # noqa: B008
    skill_b: Path = typer.Argument(..., help="Second skill directory"),  # noqa: B008
    depth: Depth = typer.Option(Depth.QUICK, help="Evaluation depth"),  # noqa: B008
    output: str = typer.Option("markdown", help="Output format"),  # noqa: B008
) -> None:
    """Head-to-head comparison of two skills."""
    for p in (skill_a, skill_b):
        if not p.exists():
            console.print(f"[red]Error: Path does not exist: {p}[/red]")
            raise typer.Exit(code=2)
    if depth != Depth.QUICK:
        typer.echo(EXPERIMENTAL_NOTE, err=True)
    config = EvalConfig(depth=depth, output_format=output)
    engine = EvalEngine(config)
    result_a = engine.evaluate_skill(skill_a)
    result_b = engine.evaluate_skill(skill_b)
    score_a = result_a.composite.score if result_a.composite else 0
    score_b = result_b.composite.score if result_b.composite else 0
    lines = [
        f"# Head-to-Head: {skill_a.name} vs {skill_b.name}",
        "",
        f"| | {skill_a.name} | {skill_b.name} | Winner |",
        "|---|---|---|---|",
        f"| **Overall** | {score_a:.0f}/100 | {score_b:.0f}/100 | {'A' if score_a > score_b else 'B' if score_b > score_a else 'Tie'} |",
    ]
    if result_a.composite and result_b.composite:
        for da, db in zip(
            result_a.composite.dimensions, result_b.composite.dimensions, strict=False
        ):
            winner = "A" if da.score > db.score else "B" if db.score > da.score else "Tie"
            name = da.name.replace("_", " ").title()
            lines.append(f"| {name} | {da.score:.2f} | {db.score:.2f} | {winner} |")
    console.print("\n".join(lines))

```

### Core Architecture Module: `plugins/plugin-eval/src/plugin_eval/corpus.py`
```
"""Gold standard corpus management for Elo ranking."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from plugin_eval.parser import parse_skill


@dataclass
class CorpusEntry:
    name: str
    path: str
    category: str
    line_count: int
    elo_rating: float = 1500.0

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "path": self.path,
            "category": self.category,
            "line_count": self.line_count,
            "elo_rating": self.elo_rating,
        }


class Corpus:
    def __init__(self, corpus_dir: Path) -> None:
        self.corpus_dir = corpus_dir
        self.entries: list[CorpusEntry] = []
        self._load()

    @classmethod
    def init_from_source(cls, plugins_dir: Path, corpus_dir: Path) -> Corpus:
        """Index all skills from a plugins directory into a corpus."""
        corpus_dir.mkdir(parents=True, exist_ok=True)

        entries = []
        for plugin_dir in sorted(plugins_dir.iterdir()):
            if not plugin_dir.is_dir():
                continue
            skills_dir = plugin_dir / "skills"
            if not skills_dir.exists():
                continue
            for skill_dir in sorted(skills_dir.iterdir()):
                if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
                    try:
                        skill = parse_skill(skill_dir)
                        entries.append(
                            CorpusEntry(
                                name=skill.name,
                                path=str(skill_dir),
                                category=plugin_dir.name,
                                line_count=skill.line_count,
                            )
                        )
                    except Exception:
                        continue

        index = [e.to_dict() for e in entries]
        (corpus_dir / "index.json").write_text(json.dumps(index, indent=2))

        corpus = cls(corpus_dir)
        return corpus

    @property
    def size(self) -> int:
        return len(self.entries)

    def list_skills(self) -> list[CorpusEntry]:
        return self.entries

    def select_references(
        self,
        category: str | None = None,
        line_count: int | None = None,
        n: int = 5,
    ) -> list[CorpusEntry]:
        """Select reference skills for Elo comparison."""
        candidates = self.entries

        if category:
            same_cat = [e for e in candidates if e.category == category]
            if same_cat:
                candidates = same_cat

        if line_count:
            margin = line_count * 0.3
            sized = [e for e in candidates if abs(e.line_count - line_count) <= margin]
            if sized:
                candidates = sized

        candidates = sorted(candidates, key=lambda e: abs(e.elo_rating - 1500))
        return candidates[:n]

    def update_rating(self, name: str, new_rating: float) -> None:
        for entry in self.entries:
            if entry.name == name:
                entry.elo_rating = new_rating
                break
        self._save()

    def _load(self) -> None:
        index_path = self.corpus_dir / "index.json"
        if index_path.exists():
            data = json.loads(index_path.read_text())
            self.entries = [
                CorpusEntry(
                    name=e["name"],
                    path=e["path"],
                    category=e["category"],
                    line_count=e["line_count"],
                    elo_rating=e.get("elo_rating", 1500.0),
                )
                for e in data
            ]

    def _save(self) -> None:
        index = [e.to_dict() for e in self.entries]
        (self.corpus_dir / "index.json").write_text(json.dumps(index, indent=2))

```

### Core Architecture Module: `plugins/plugin-eval/src/plugin_eval/elo.py`
```
"""Elo rating system for pairwise skill comparison."""

from __future__ import annotations

import random


class EloCalculator:
    def __init__(self, k_factor: int = 32) -> None:
        self.k_factor = k_factor

    def expected(self, rating_a: float, rating_b: float) -> float:
        """Expected score for player A against player B."""
        return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400))

    def update(self, rating: float, opponent_rating: float, actual: float) -> float:
        """Update rating after a single matchup."""
        exp = self.expected(rating, opponent_rating)
        return rating + self.k_factor * (actual - exp)

    def compute_rating(self, initial: float, matchups: list[tuple[float, float]]) -> float:
        """Compute final rating from (opponent_rating, actual_score) matchups."""
        rating = initial
        for opponent_rating, actual in matchups:
            rating = self.update(rating, opponent_rating, actual)
        return rating

    def compute_rating_with_ci(
        self,
        initial: float,
        matchups: list[tuple[float, float]],
        n_resamples: int = 500,
        seed: int | None = None,
    ) -> tuple[float, float, float]:
        """Compute rating with bootstrap CI by resampling matchups."""
        point_estimate = self.compute_rating(initial, matchups)

        if len(matchups) < 2:
            return point_estimate, point_estimate, point_estimate

        rng = random.Random(seed)
        ratings = []
        for _ in range(n_resamples):
            sample = [rng.choice(matchups) for _ in range(len(matchups))]
            ratings.append(self.compute_rating(initial, sample))

        ratings.sort()
        lower_idx = int(0.025 * n_resamples)
        upper_idx = int(0.975 * n_resamples) - 1
        return point_estimate, ratings[lower_idx], ratings[upper_idx]

```

### Core Architecture Module: `plugins/plugin-eval/src/plugin_eval/layers/_sdk.py`
```
"""Shared helper for reading Claude Agent SDK message streams.

Both the judge and Monte Carlo layers consume the same `query()` message stream
(assistant text blocks + a terminal result message). This centralizes that
walk so the two layers can't drift on how SDK message types are handled.
"""

from __future__ import annotations

from typing import Any, NamedTuple


class SdkOutput(NamedTuple):
    """Extracted view of one SDK message stream."""

    text: str  # concatenated assistant TextBlock text
    result: str | None  # ResultMessage.result, if present (fallback text)
    errored: bool  # a ResultMessage reported is_error
    usage: dict[str, Any] | None  # ResultMessage.usage, if it was a dict
    model: str | None  # AssistantMessage.model, if any assistant turn occurred


def collect_sdk_output(messages: list) -> SdkOutput:
    """Walk SDK messages → assistant text, result fallback, error flag, usage, model."""
    from claude_agent_sdk import (  # type: ignore[import-untyped]
        AssistantMessage,
        ResultMessage,
        TextBlock,
    )

    text = ""
    result: str | None = None
    errored = False
    usage: dict[str, Any] | None = None
    model: str | None = None
    for message in messages:
        if isinstance(message, AssistantMessage):
            model = message.model
            for block in message.content:
                if isinstance(block, TextBlock):
                    text += block.text
        elif isinstance(message, ResultMessage):
            if message.is_error:
                errored = True
            if message.result:
                result = message.result
            if isinstance(message.usage, dict):
                usage = message.usage
    return SdkOutput(text=text, result=result, errored=errored, usage=usage, model=model)


def usage_total_tokens(usage: dict[str, Any] | None) -> int:
    """Total token count from an SDK usage dict.

    The SDK's `usage` exposes separate `*_tokens` fields (input/output/cache),
    not a single `total_tokens`. Prefer an explicit `total_tokens` if a future
    SDK provides one, otherwise sum the component `*_tokens` fields.
    """
    if not usage:
        return 0
    total = usage.get("total_tokens")
    if isinstance(total, int):
        return total
    return sum(n for k, n in usage.items() if k.endswith("_tokens") and isinstance(n, int))

```

### Core Architecture Module: `plugins/plugin-eval/src/plugin_eval/layers/harness_portability.py`
```
"""Harness portability checks — surface non-portable patterns across Codex/Cursor/OpenCode/Antigravity.

Each finding ships with a `remediation` string (OpenAI harness-engineering pattern:
lint error messages inject remediation instructions into agent context).

Used by `layers/static.py` to compute the `harness_portability` sub-score.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from plugin_eval.parser import ParsedAgent, ParsedSkill

# Codex hard cap for skill body
_CODEX_SKILL_BYTE_CAP = 8 * 1024

# Names that collide with Codex built-in subagent roles
_CODEX_BUILTIN_AGENT_NAMES = {"default", "worker", "explorer"}

_CLAUDE_TOOLS = (
    "Read",
    "Edit",
    "Write",
    "Bash",
    "Grep",
    "Glob",
    "Agent",
    "Task",
    "TodoWrite",
    "WebFetch",
    "WebSearch",
    "LS",
    "LSP",
)
_TOOL_ALTERNATION = "|".join(_CLAUDE_TOOLS)

# Match a backticked tool name only when it's used in a Claude-tool context:
#   - prefixed by "the " ("the `Bash`")
#   - or suffixed by " tool" (`Task` tool)
#   - or "use `Bash`" / "call `Read`" / "invoke `Task`"
# This rules out generic prose backticks like Rust's `Task` type in API docs.
_CAMEL_TOOL_PATTERN = re.compile(
    rf"(?:\b(?:the|use|using|call|calling|invoke|invoking|via)\s+)`({_TOOL_ALTERNATION})`"
    rf"|`({_TOOL_ALTERNATION})`\s+tool\b",
    re.IGNORECASE,
)

# Phrases like "use the Read tool" / "Use the Bash tool".
# The leading article ("the" / "The" / "THE") is matched case-insensitively, but the
# tool name itself must match exact CamelCase — otherwise generic English like
# "the bash tool" (referring to the shell, not Claude's Bash) false-positives.
_TOOL_PROSE_PATTERN = re.compile(rf"(?i:\bthe)\s+(?:`)?({_TOOL_ALTERNATION})(?:`)?\s+tool\b")

# Bare model aliases that don't map cleanly (Cursor/OpenCode need full IDs; Antigravity
# maps aliases to tier values — pro/flash/inherit — so it's unaffected)
_BARE_MODEL_ALIAS_PATTERN = re.compile(r"^(fable|opus|sonnet|haiku)$")

# Context file line cap (per harness-engineering principle)
_CONTEXT_FILE_LINE_CAP = 150


@dataclass(frozen=True)
class PortabilityFinding:
    flag: str
    severity: float  # 0.0–0.30 (max one finding)
    description: str
    remediation: str

    def to_anti_pattern(self):
        """Render as a plugin_eval.models.AntiPattern with remediation appended."""
        from plugin_eval.models import AntiPattern

        return AntiPattern(
            flag=self.flag,
            description=f"{self.description}\nFix: {self.remediation}",
            severity=self.severity,
        )


def detect_skill_findings(skill: ParsedSkill) -> list[PortabilityFinding]:
    """All harness-portability findings for one skill."""
    findings: list[PortabilityFinding] = []

    # 1. Skill body exceeds Codex's 8 KB hard cap
    body_bytes = len(skill.raw_content.encode("utf-8"))
    if body_bytes > _CODEX_SKILL_BYTE_CAP and not skill.has_references:
        findings.append(
            PortabilityFinding(
                flag="SKILL_OVER_CODEX_CAP",
                severity=0.15,
                description=(
                    f"Skill body is {body_bytes} bytes; Codex hard-truncates skills at "
                    f"{_CODEX_SKILL_BYTE_CAP} bytes. No `references/` directory present."
                ),
                remediation=(
                    "Move detail sections into `references/details.md` (or similar) and "
                    "leave the SKILL.md body as a navigation summary. Codex will load the "
                    "references on demand."
                ),
            )
        )

    # 2. Body uses CamelCase Claude tool names in backticks ("`Read`", "`Bash`")
    raw_matches = _CAMEL_TOOL_PATTERN.findall(skill.raw_content)
    # Pattern has two alternatives so each match is a 2-tuple; pick whichever side fired.
    tool_hits = [m[0] or m[1] for m in raw_matches if m[0] or m[1]]
    if tool_hits:
        unique = sorted(set(tool_hits))
        findings.append(
            PortabilityFinding(
                flag="CLAUDE_TOOL_REFS",
                severity=min(0.10, 0.02 * len(unique)),
                description=(
                    f"Skill body references Claude Code tools by CamelCase name: {unique}. "
                    "OpenCode requires lowercase (`read`, `bash`); Codex prefers action verbs."
                ),
                remediation=(
                    "Use action verbs (e.g. 'open the file', 'run the shell command') or "
                    "lowercase the tool reference. The adapter rewrites a conservative set, "
                    "but explicit phrasing is more portable."
                ),
            )
        )

    # 3. Body uses prose like "use the Read tool"
    prose_hits = _TOOL_PROSE_PATTERN.findall(skill.raw_content)
    if prose_hits:
        unique = sorted(set(prose_hits))
        findings.append(
            PortabilityFinding(
                flag="CLAUDE_TOOL_PROSE",
                severity=0.05,
                description=(
                    f"Skill body uses prose like 'use the X tool' for: {unique}. Codex "
                    "doesn't name tools to the model; the model picks them by action."
                ),
                remediation=(
                    'Rewrite "the Read tool" as "open the file", "the Bash tool" as '
                    '"run the shell command", etc. Talk about the action, not the tool.'
                ),
            )
        )

    return findings


def detect_agent_findings(agent: ParsedAgent) -> list[PortabilityFinding]:
    """All harness-portability findings for one agent."""
    findings: list[PortabilityFinding] = []

    name = (agent.frontmatter.get("name") or "").strip().lower()
    if name in _CODEX_BUILTIN_AGENT_NAMES:
        findings.append(
            PortabilityFinding(
                flag="AGENT_NAME_COLLISION",
                severity=0.10,
                description=(
                    f"Agent name '{name}' collides with a Codex built-in role "
                    "(default/worker/explorer). The Codex adapter will namespace-rename it."
                ),
                remediation=(f"Rename to something plugin-scoped, e.g. `<plugin>-{name}`."),
            )
        )

    model = (agent.frontmatter.get("model") or "").strip().lower()
    if _BARE_MODEL_ALIAS_PATTERN.match(model):
        findings.append(
            PortabilityFinding(
                flag="BARE_MODEL_ALIAS",
                severity=0.03,
                description=(
                    f"Agent frontmatter uses bare model alias `{model}`. Cursor doesn't "
                    "accept Anthropic aliases; OpenCode requires full provider/model-id."
                ),
                remediation=(
                    "The adapter maps these at generation time. To be explicit, use "
                    "`inherit` (Cursor) or `anthropic/claude-<full-id>` (OpenCode)."
                ),
            )
        )

    raw_matches = _CAMEL_TOOL_PATTERN.findall(agent.raw_content)
    tool_hits = [m[0] or m[1] for m in raw_matches if m[0] or m[1]]
    if tool_hits:
        findings.append(
            PortabilityFinding(
                flag="CLAUDE_TOOL_REFS",
                severity=0.05,
                description=(
                    f"Agent body references Claude Code tools by CamelCase name: "
                    f"{sorted(set(tool_hits))}."
                ),
                remediation=(
                    "OpenCode wants lowercase; Codex wants action verbs. The adapter "
                    "rewrites these but explicit phrasing is more portable."
                ),
            )
        )

    return findings


def score_skill_portability(skill: ParsedSkill) -> float:
    """0.0–1.0 portability sub-score for a skill."""
    findings = detect_skill_findings(skill)
    if not findings:
        return 1.0
    penalty = sum(f.severity for f in findings)
    return max(0.0, 1.0 - penalty)


def score_agent_portability(agent: ParsedAgent) -> float:
    """0.0–1.0 portability sub-score for an agent."""
    findings = detect_agent_findings(agent)
    if not findings:
        return 1.0
    penalty = sum(f.severity for f in findings)
    return max(0.0, 1.0 - penalty)

```

### Core Architecture Module: `plugins/plugin-eval/src/plugin_eval/layers/judge.py`
```
"""Layer 2: LLM Judge — semantic evaluation via Claude, model-tiered, async."""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from plugin_eval.layers._sdk import collect_sdk_output, usage_total_tokens
from plugin_eval.models import LayerResult
from plugin_eval.parser import ParsedSkill, parse_skill

# ---------------------------------------------------------------------------
# Anchored rubrics
# ---------------------------------------------------------------------------

ORCHESTRATION_RUBRIC = """
Score 0.0 — Poor: Skill acts as standalone agent; manages its own tool calls and sub-tasks.
Score 0.25 — Below average: Skill has some orchestration logic mixed with worker tasks.
Score 0.5 — Average: Skill delegates some tasks but still coordinates multi-step flows itself.
Score 0.75 — Good: Skill is mostly a worker; inputs/outputs documented, minimal coordination.
Score 1.0 — Excellent: Pure worker role; composable, clear contracts, no orchestration logic.
""".strip()

SCOPE_RUBRIC = """
Score 0.0 — Too thin: Stub or trivial wrapper with near-zero unique value.
Score 0.25 — Under-scoped: Covers only a narrow slice; misses obvious related tasks.
Score 0.5 — Average: Reasonable scope but either too broad or somewhat narrow.
Score 0.75 — Well-scoped: Covers one coherent domain; neither bloated nor sparse.
Score 1.0 — Perfectly calibrated: Minimal surface area, maximum cohesion, ideal composability.
""".strip()

# ---------------------------------------------------------------------------
# Model resolution
# ---------------------------------------------------------------------------

_MODEL_MAP: dict[str, str] = {
    "haiku": "claude-haiku-4-5-20251001",
    "sonnet": "claude-sonnet-5",
    "opus": "claude-opus-4-8",
}


def _resolve_model(tier: str) -> str:
    """Map a tier name to a full model ID."""
    return _MODEL_MAP.get(tier, _MODEL_MAP["sonnet"])


# ---------------------------------------------------------------------------
# LLM query helper (abstracted for testability)
# ---------------------------------------------------------------------------


def _extract_and_parse(messages: list) -> dict:
    """Pull assistant text from SDK messages and parse JSON.

    Returns the parsed dict on success, or an {"unmeasured": True, ...} marker
    when the run errored, produced no text, or returned non-JSON.
    """
    output = collect_sdk_output(messages)
    text = output.text.strip()
    raw = text or (output.result or "")
    if output.errored:
        return {
            "unmeasured": True,
            "error": "judge LLM call returned an error result",
            **({"raw": raw} if raw else {}),
        }
    if not raw.strip():
        return {"unmeasured": True, "error": "judge LLM returned no text"}

    stripped = raw.strip()
    fence_match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", stripped)
    if fence_match:
        stripped = fence_match.group(1).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        return {"unmeasured": True, "error": "judge response was not valid JSON", "raw": raw}


async def query_llm(
    prompt: str,
    system: str = "",
    model: str = "claude-sonnet-5",
    usage_sink: dict[str, int] | None = None,
) -> dict:
    """Call Claude via the Agent SDK and return a parsed JSON dict.

    Degrades to an {"unmeasured": True, ...} marker (never raises) when the SDK
    is missing or the call fails, so the judge layer can be skipped instead of
    crashing the whole evaluation.

    When `usage_sink` is given, the call's token usage (if any) is added to it
    under the SDK-reported model (falling back to the requested `model` if the
    stream reported none), letting callers accumulate per-model usage across
    calls even when routing or fallback selects a different model.
    """
    try:
        from claude_agent_sdk import (  # type: ignore[import-untyped]
            ClaudeAgentOptions,
            query,
        )
    except ImportError:
        return {
            "unmeasured": True,
            "error": "claude-agent-sdk not installed (uv sync --extra llm)",
        }

    full_prompt = f"{system}\n\n{prompt}" if system else prompt
    try:
        messages = [
            message
            async for message in query(
                prompt=full_prompt,
                options=ClaudeAgentOptions(model=model, allowed_tools=[]),
            )
        ]
    except Exception as exc:  # noqa: BLE001 — judge is best-effort; degrade to unmeasured
        return {"unmeasured": True, "error": f"judge LLM call failed: {exc}"}

    if usage_sink is not None:
        output = collect_sdk_output(messages)
        tokens = usage_total_tokens(output.usage)
        if tokens:
            usage_model = output.model or model
            usage_sink[usage_model] = usage_sink.get(usage_model, 0) + tokens

    return _extract_and_parse(messages)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


def _measured_score(result: Any, key: str) -> float | None:
    """Return the numeric score for an assessment, or None if it was unmeasured.

    Tolerates non-dict JSON (e.g. a list or bare string) by treating it as
    unmeasured rather than raising.
    """
    if not isinstance(result, dict) or result.get("unmeasured"):
        return None
    val = result.get(key)
    return float(val) if isinstance(val, (int, float)) else None


@dataclass
class JudgeConfig:
    judges: int = 1
    concurrency: int = 4


# ---------------------------------------------------------------------------
# Analyzer
# ---------------------------------------------------------------------------


class JudgeAnalyzer:
    """Semantic skill evaluation using Claude as a judge."""

    def __init__(self, config: JudgeConfig) -> None:
        self.config = config
        self._sem = asyncio.Semaphore(config.concurrency)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def analyze_skill(self, skill_or_dir: Path | ParsedSkill) -> LayerResult:
        """Run all 4 assessments concurrently and return a LayerResult."""
        skill = skill_or_dir if isinstance(skill_or_dir, ParsedSkill) else parse_skill(skill_or_dir)
        # Local to this call so concurrent/repeated analyze_skill invocations on
        # the same analyzer instance never mix or accumulate token counts.
        model_usage: dict[str, int] = {}
        triggering, orchestration, output_quality, scope = await asyncio.gather(
            self.assess_triggering(skill, model_usage),
            self.assess_orchestration(skill, model_usage),
            self.assess_output_quality(skill, model_usage),
            self.assess_scope(skill, model_usage),
        )

        raw_scores: dict[str, float | None] = {
            "triggering_accuracy": _measured_score(triggering, "f1"),
            "orchestration_fitness": _measured_score(orchestration, "score"),
            "output_quality": _measured_score(output_quality, "score"),
            "scope_calibration": _measured_score(scope, "score"),
        }
        sub_scores: dict[str, float] = {k: v for k, v in raw_scores.items() if v is not None}
        unmeasured = sorted(k for k, v in raw_scores.items() if v is None)

        # Layer score is display-only; the composite engine blends per-dimension
        # sub_scores (omitted keys are excluded). Use the mean of measured dims.
        score = sum(sub_scores.values()) / len(sub_scores) if sub_scores else 0.0

        metadata: dict = {
            "triggering": triggering,
            "orchestration": orchestration,
            "output_quality": output_quality,
            "scope": scope,
            "unmeasured": unmeasured,
            "model_usage": model_usage,
        }

        return LayerResult(
            layer="judge",
            score=score,
            sub_scores=sub_scores,
            metadata=metadata,
        )

    # ------------------------------------------------------------------
    # Individual assessments
    # ------------------------------------------------------------------

    async def assess_triggering(
        self, skill: Path | ParsedSkill, usage_sink: dict[str, int] | None = None
    ) -> dict:
        """Generate 10 synthetic prompts and classify triggering accuracy via Haiku."""
        if isinstance(skill, Path):
            skill = parse_skill(skill)
        model = _resolve_model("haiku")

        system = (
            "You are an expert evaluator of Claude Code skills. "
            "Respond ONLY with valid JSON — no explanation, no markdown fences."
        )
        prompt = f"""Given this skill description:

<description>
{skill.description}
</description>

Generate 10 synthetic user prompts: 5 that SHOULD trigger this skill and 5 that should NOT.
For each prompt, also predict whether a typical Claude model would trigger this skill.

Return JSON matching this schema:
{{
  "predictions": [
    {{"prompt": "...", "should_trigger": true, "would_trigger": true}},
    ...
  ],
  "precision": <float 0-1>,
  "recall": <float 0-1>,
  "f1": <float 0-1>
}}"""

        async with self._sem:
            return await query_llm(prompt, system=system, model=model, usage_sink=usage_sink)

    async def assess_orchestration(
        self, skill: Path | ParsedSkill, usage_sink: dict[str, int] | None = None
    ) -> dict:
        """Rate orchestration fitness using an anchored rubric via Sonnet."""
        if isinstance(skill, Path):
            skill = parse_skill(skill)
        model = _resolve_model("sonnet")

        system = (
            "You are an expert evaluator of Claude Code skills. "
            "Respond ONLY with valid JSON — no explanat
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #618** (2026-07-11): **fix(adapters): parse nested frontmatter mappings**
  *Symptoms*: # Summary  Fix the shared frontmatter parser so one-level YAML mappings remain dictionaries when generating harness artifacts. This prevents Codex from rejecting generated skills whose `metadata` was previously serialized as an empty string.  ## Why  Valid source frontmatter such as:  ```yaml metadata:   version: "1.0.0"   source: https://example.com ```  was parsed as `metadata: ""`, which does not satisfy Codex's `SkillFrontmatterMetadata` schema. It is now preserved as the intended mapping:  ```yaml metadata:   version: 1.0.0   source: https://example.com ```  ## Change type  - Bug fix - No breaking API, dependency, schema, configuration, or migration changes  ## Implementation  - Recognize indented `key: value` entries beneath an empty top-level frontmatter key and promote that field to a one-level dictionary. - Preserve subsequent entries in the same mapping, including quoted values and values containing URL punctuation. - Document the supported mapping shape and add a focused regression test for the reported metadata structure.  ## Verification  - `make test`: 477 passed, 2 skipped. Both skips are OpenCode-only CLI smoke tests because OpenCode is not installed locally; CI exercises them. - `make validate STRICT=1`: passed across all 5 harnesses. - Native Codex prompt loading completed without the original invalid-YAML warning for `.codex/skills/social-publishing__social-publishing/SKILL.md`. - Direct YAML parsing confirmed `metadata` is a mapping and `version` is `1.0.0
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @wshobson's task in 2m 7s** —— [View job](https://github.com/wshobson/agents/actions/runs/29154486020)  --- ### Review: ✅ LGTM  Traced the parser change through the two new elif branches against the reported `metadata:` frontmatter and confirmed the intended shape:  - **Promotion branch (`base.py:135-141`)**: fires only when `fields[current_key]` is the empty-string sentinel and the continuation line is indented and matches `^(\w[\w-]*):\s*(.*)` — correctly narrow, won't hijack `tools:\n  - foo` block lists (which hit the earlier `stripped.startswith("-")` branch first). - **Continuation branch (`base.py:104-111`)**: fires once the dict exists, so subsequent nested entries (including `source: https://example.com` with its URL colons — captured by the greedy `.*`) land correctly. - Downstream: `_frontmatter_block` in `tools/adapters/codex.py:173-176` already handles `dict` values, so the parsed mapping is emitted as valid YAML — no adapter changes needed.  Non-blocking
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/wshobson/agents/pull/618?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Organization UI  **Review profile**: ASSERTIVE  **Plan**: Pro Plus  **Run ID**: `37d33611-90db-4649-8209-9e9af5644022`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between ea1f4c94d0d49e3151fca36945fa1fde3be31e5c and d985988bddce6355304256967dad4516374ff846.  </details>  <details> <summary>📒 Files selected for processing (2)</summary>  * `tools/a
  > **Claude finished @wshobson's task in 1m 38s** —— [View job](https://github.com/wshobson/agents/actions/runs/29154615848)  --- ### Review: ✅ LGTM  Re-traced the two new branches against the real `plugins/social-publishing/skills/social-publishing/SKILL.md`, which has three nested keys (`version`, `source`, `homepage`) — the promotion branch fires on `version`, the continuation branch fires on `source` and `homepage`, and the URL colons are captured correctly by the greedy `.*` in the regex.  **Correctness** - `base.py:135-141` (promotion): only fires when we're already in the empty-string `in_list` sentinel state and the line is indented — cannot hijack legitimate block lists (which hit `stripped.startswith("-")` first at `base.py:122`). - `base.py:104-111` (continuation): only fires once `fields[current_key]` is already a `dict`, and the top-level `^(\w[\w-]*):` regex at line 61 doesn't match indented lines, so ordering is safe. - Downstream: `_frontmatter_block` in `tools/adapters/co

- **Issue #617** (2026-07-18): **[BUG] Installation failed: String must contain at least 1 character**
  *Symptoms*: ### Preliminary Checks  - [x] I have read the [Code of Conduct](https://github.com/wshobson/agents/blob/main/.github/CODE_OF_CONDUCT.md) - [x] I have searched existing issues to ensure this is not a duplicate - [x] This report contains only technical information about a bug  ### Harness  OpenAI Codex CLI  ### Harness version  _No response_  ### Affected plugin / agent / skill / command  -  ### Bug description  Running the install command results into an error:  ``` codex@oracle:~/idp-brain$ npx codex-marketplace add wshobson/agents --plugins   ██████  ██████  ██████  ███████ ██   ██  ██      ██    ██ ██   ██ ██       ██ ██  ██      ██    ██ ██   ██ █████     ███  ██      ██    ██ ██   ██ ██       ██ ██   ██████  ██████  ██████  ███████ ██   ██  ███    ███  █████  ██████  ██   ██ ███████ ████████  ████  ████ ██   ██ ██   ██ ██  ██  ██         ██  ██ ████ ██ ███████ ██████  █████   █████      ██  ██  ██  ██ ██   ██ ██   ██ ██  ██  ██         ██  ██      ██ ██   ██ ██   ██ ██   ██ ███████    ██ ┌  Codex Installer │ ◇  Where should Codex install these artifacts? │  Project scope │ ◇  Inspection failed │ ■  [ │    { │      "code": "too_small", │      "minimum": 1, │      "type": "string", │      "inclusive": true, │      "exact": false, │      "message": "String must contain at least 1 character(s)", │      "path": [ │        "description" │      ] │    } │  ] ```  ### Steps to reproduce  1. `npx codex-marketplace add wshobson/agents --plugins`  ### Expected behavior  It should wo

- **Issue #591** (2026-06-25): **[BUG] use plugin-eval standard but cannot output with llm**
  *Symptoms*: ### Preliminary Checks  - [x] I have read the [Code of Conduct](https://github.com/wshobson/agents/blob/main/.github/CODE_OF_CONDUCT.md) - [x] I have searched existing issues to ensure this is not a duplicate - [x] This report contains only technical information about a bug  ### Harness  Claude Code  ### Harness version  2.1.185 (Claude Code)  ### Affected plugin / agent / skill / command  plugins/plugin-eval  ### Bug description  # lkjie @ openubmc-dev in ~/projects/rd_lab_skill_eval/repos/agents/plugins/plugin-eval on git:main x .venv [20:36:55]  $ uv run plugin-eval score /home/lkjie/projects/rd_lab_skill_eval/repos/agents/plugins/protect-mcp/skills/protect-mcp-setup --depth standard --output json > /home/lkjie/projects/rd_lab_skill_eval/work/plugin_eval/result.json  json result ```json {   "plugin_path": "/home/lkjie/projects/rd_lab_skill_eval/repos/agents/plugins/protect-mcp/skills/protect-mcp-setup",   "timestamp": "2026-06-21T11:50:00.126221+00:00",   "config": {     "depth": "standard",     "concurrency": 4,     "model_tier": "auto",     "output_format": "json",     "verbose": false,     "corpus_path": null,     "auth": "max",     "judges": 1,     "monte_carlo_n": null   },   "layers": [     {       "layer": "static",       "score": 0.7561739130434783,       "sub_scores": {         "frontmatter_quality": 0.6499999999999999,         "orchestration_wiring": 0.9,         "progressive_disclosure": 0.6,         "structural_completeness": 0.7000000000000001,         "token_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report and the working repro, @lkjie — and you were right that something was off beyond your z.ai setup.  Root cause: the judge read the LLM response from `ResultMessage.content`, which doesn't exist on that SDK type, so the text was always empty, JSON parsing always failed, and every dimension silently fell back to `0.5` (an F). It failed the same way for any model, not just z.ai.  Fix in #600: the judge (and the Monte Carlo layer) now read `AssistantMessage` `TextBlock` text with a `ResultMessage.result` fallback; genuine failures are reported as **"unmeasured"** (excluded from the composite) with a clear stderr warning, instead of a fabricated 0.5; and the dead `auth`/`model_tier` config was removed. Added tests that exercise the real SDK-message path.  Will close this when #600 merges. 

- **Issue #536** (2026-05-21): **[BUG]Plugin Isolation Boundary Vulnerable to Cross-Plugin Skill/Command Context Contamination**
  *Symptoms*: ### Preliminary Checks  - [x] I have read the [Code of Conduct](https://github.com/wshobson/agents/blob/main/.github/CODE_OF_CONDUCT.md) - [x] I have searched existing issues to ensure this is not a duplicate - [x] This report contains only technical information about a bug  ### Affected Subagent  full-stack-orchestration agent-teams conductor  ### Bug Description  The plugin ecosystem dynamically loads agents, commands, workflows, and progressive-disclosure skills into shared Claude Code execution context. Under multi-plugin orchestration and parallel workflow execution, there is a potential risk of cross-plugin context contamination where skills, commands, or orchestration metadata leak across isolated plugin boundaries.  This becomes especially dangerous in: - multi-agent orchestration chains - dynamically activated skills - plugin hot-reload/update flows - nested orchestration pipelines - long-running Claude sessions  Potential symptoms: - incorrect skill activation - orphaned orchestration state - stale plugin metadata persistence - unintended command resolution - context-window pollution across workflows  ### Steps to Reproduce  1. Install multiple orchestration plugins simultaneously:    - full-stack-orchestration    - agent-teams    - conductor  2. Trigger nested multi-agent workflows in parallel  3. Dynamically activate/deactivate plugins during long-running sessions  4. Execute overlapping commands with shared orchestration context  5. Observe command resolution beh
  **Post-Mortem & Fix Analysis**:
  > Closing as needs-reproduction. The report describes symptoms generically (incorrect skill activation, context-window pollution, orphaned state) but doesn't include a concrete reproduction — specific commands, observed-vs-expected behavior, or a session transcript.  The premise also doesn't quite hold: Claude Code plugins are config bundles (agents, commands, skills as Markdown/JSON), not isolated runtime processes, so there isn't an "isolation boundary" to violate in the way described.  If you hit a specific concrete failure, please open a new issue with a minimal reproduction and we'll dig in.

- **Issue #523** (2026-05-17): **[BUG] Agent Teams members don't have SendMessage tool**
  *Symptoms*: ### Preliminary Checks  - [x] I have read the [Code of Conduct](https://github.com/wshobson/agents/blob/main/.github/CODE_OF_CONDUCT.md) - [x] I have searched existing issues to ensure this is not a duplicate - [x] This report contains only technical information about a bug  ### Affected Subagent  Agent Teams plugin.  ### Bug Description  I usually got this message for all implementer members of the fullstack team even for team lead, so the team lead went idle because it wasn't able to send message back to orchestrator for creating tasks, I ended up recreating team in hope it would work.  ``` Note: I don't see a SendMessage tool in my available toolset — only Read, Write, Edit, and Bash. Posting this readiness summary here as my acknowledgement to team-lead. If a messaging tool becomes   available, I'll use it for future updates ```  Another issue is naming conflicts between orchestrator and team lead, there is a case orchestrator is named team-lead and team lead is named team-lead-2, team lead send message to wrong recipient and orchestrator never receive the message  Orchestrator message: ``` Team is up. Roster:                                                                                                                                                                                                                                                                                                                                                                                 
  **Post-Mortem & Fix Analysis**:
  > This is two distinct bugs stacked, and they have different fixes:  ### 1. Missing `SendMessage` tool on team members  `SendMessage` is a built-in Claude Code agent tool, but it has to be **explicitly listed in each subagent's `tools:` frontmatter** to be available — it isn't injected by default the way `Read` / `Write` / `Edit` / `Bash` are when `tools: *` is used or omitted. If the Agent Teams plugin defines its agents with an explicit allowlist:  ```yaml tools: Read, Write, Edit, Bash ```  …then SendMessage is silently excluded. The team-lead's "Note: I don't see a SendMessage tool" log line is the agent doing exactly the right thing — narrating its missing capability rather than hallucinating a call.  **Fix:** In the team-orchestrator and team-member agent definitions, add `SendMessage` (and probably `TaskList` / `TaskGet` / `TaskUpdate` if the orchestrator is meant to coordinate tasks) to the `tools:` allowlist. If the plugin uses a single template, one line.  ### 2. Naming collisi
  > Fixed by #535. That PR adds the missing Agent Teams communication/task tools (`SendMessage`, `TaskList`, `TaskGet`, `TaskUpdate`, plus lead coordination tools) to the restricted team agent allowlists and updates the team-spawn/communication docs to use actual spawned teammate names when names are suffixed. Closing this as resolved.

- **Issue #520** (2026-05-21): **[BUG] Error adding to the Copilot marketplace**
  *Symptoms*: ### Preliminary Checks  - [x] I have read the [Code of Conduct](https://github.com/wshobson/agents/blob/main/.github/CODE_OF_CONDUCT.md) - [x] I have searched existing issues to ensure this is not a duplicate - [x] This report contains only technical information about a bug  ### Affected Subagent  Plugin marketplace add  ### Bug Description  <img width="1430" height="840" alt="Image" src="https://github.com/user-attachments/assets/515923d2-db0e-4081-96de-ff90eb53a1b2" />  ### Steps to Reproduce  1. /plugin marketplace add wshobson/agents  output  2. Failed to add marketplace: Invalid marketplace.json: plugins.77.source: Invalid input  ### Expected Behavior  .  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. Verified locally: `plugins[77]` is the only entry whose `source` is an object (the `git-subdir` form for the `qa-orchestra` external plugin) — every other entry uses the string shorthand `"./plugins/<name>"`. So the validator that rejected `plugins.77.source` is rejecting the object-form `source`, not the marketplace as a whole.  The title mentions "Copilot marketplace" — could you confirm:  1. Which CLI you're running (`claude --version` for Claude Code, or the Copilot CLI version)? 2. Whether `git-subdir` is documented as a supported source type in that runtime's marketplace schema?  `git-subdir` is a relatively newer source type. If your runtime predates it, the cleanest path is to upgrade. If the runtime doesn't support it at all (which would be the case for some Copilot CLI builds), the workaround is to clone this repo locally and reference plugins via local paths (`./plugins/<name>`) rather than `/plugin marketplace add`.  Will leave open until we know whic
  > Closing as stale — no response since the diagnosis on May 9. The root cause appears to be the Copilot CLI marketplace validator not supporting the object-form `git-subdir` source on `plugins[77]` (the `qa-orchestra` external plugin). This is a Copilot CLI schema-support gap, not a marketplace bug.  If you can confirm the CLI version and runtime, comment to reopen.
  > @wshobson I just stumbled across this same issue trying to add this repo as a marketplace in copilot-cli 1.0.56.  `Invalid marketplace.json: plugins.77.source: Invalid input, plugins.78.source: Invalid input`  While the [documentation](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference#marketplacejson) doesn't mention `git-subdir` support, it looks like `source: github` might be close enough, at least for github-hosted projects.  See this excerpt from https://github.com/github/awesome-copilot/blob/main/.github/plugin/marketplace.json: ```json     {       "name": "vercel-plugin",       "description": "Build and deploy web apps and agents. Comprehensive Vercel ecosystem plugin — relational knowledge graph, skills for every major product, specialized agents, and Vercel conventions. Turns any AI agent into a Vercel expert.",       "version": "0.43.0",       "author": {         "name": "Vercel",         "url": "https://github.com/vercel"       },       "

- **Issue #447** (2026-03-07): **[BUG] Missing Resources files in debugging-strategies skill**
  *Symptoms*: ### Preliminary Checks  - [x] I have read the [Code of Conduct](.github/CODE_OF_CONDUCT.md) - [x] I have searched existing issues to ensure this is not a duplicate - [x] This report contains only technical information about a bug  ### Affected Subagent  All agent using this skill  ### Bug Description  After installing the skill, the directory structure is as follows  ``` debugging-strategies/  └─ SKILL.md ```  In fact, the reference section contains these contents  ``` Resources references/debugging-tools-guide.md: Comprehensive tool documentation references/performance-profiling.md: Performance debugging guide references/production-debugging.md: Debugging live systems assets/debugging-checklist.md: Quick reference checklist assets/common-bugs.md: Common bug patterns scripts/debug-helper.ts: Debugging utility functions ```  So my expected directory structure is  ``` debugging-strategies/  ├─ SKILL.md  ├─ references/  ├─ assets/  └─ scripts/ ```  ### Steps to Reproduce  1. npx skills add https://github.com/wshobson/agents --skill debugging-strategies 2. check skill directory  ### Expected Behavior  debugging-strategies/  ├─ SKILL.md  ├─ references/  ├─ assets/  └─ scripts/  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > by the way: the link in issue template -> https://github.com/wshobson/agents/issues/.github/CODE_OF_CONDUCT.md got 404
  > Some issue when using [e2e-testing-patterns](https://skills.sh/wshobson/agents/e2e-testing-patterns)  
  > Thanks for the detailed report, @maple5233! You were right — this turned out to be a systemic issue across the repo, not just `debugging-strategies`.  **What we fixed (47a5dbc):**  1. **Removed phantom resource references from 115 skill files** — These `## Resources`, `## Reference Files`, and `## Additional Resources` sections were pointing to `references/`, `assets/`, `scripts/`, and `examples/` directories that were never created. All affected skills are self-contained in their `SKILL.md`, so no content was lost.  2. **Fixed the broken Code of Conduct link** you flagged in the issue templates — the relative path `.github/CODE_OF_CONDUCT.md` was resolving incorrectly from the issues page. Updated to absolute URLs in `bug_report.yml`, `feature_request.yml`, and `new_subagent.yml`.  3. **Verified the `e2e-testing-patterns` skill** you mentioned in your second comment — same issue, now fixed.  Skills that *do* ship with real `references/`, `assets/`, and `scripts/` directories (like tho

- **Issue #438** (2026-02-21): **[BUG] Deprecated version of TabView is used.**
  *Symptoms*: ### Preliminary Checks  - [x] I have read the [Code of Conduct](.github/CODE_OF_CONDUCT.md) - [x] I have searched existing issues to ensure this is not a duplicate - [x] This report contains only technical information about a bug  ### Affected Subagent  mobile-ios-design  ### Bug Description  Deprecated version of TabView is used in SKILL.md.    ### Steps to Reproduce  Instead of deprecated [.tabItem(_:)](https://developer.apple.com/documentation/swiftui/view/tabitem(_:))  ``` struct MainTabView: View {     @State private var selectedTab = 0          var body: some View {         TabView(selection: $selectedTab) {             HomeView()                 .tabItem {                     Label("Home", systemImage: "house")                 }                 .tag(0)                          SearchView()                 .tabItem {                     Label("Search", systemImage: "magnifyingglass")                 }                 .tag(1)                          ProfileView()                 .tabItem {                     Label("Profile", systemImage: "person")                 }                 .tag(2)         }     } } ```  ### Expected Behavior  Should use [Tab](https://developer.apple.com/documentation/swiftui/tab)  ``` struct MainTabView: View {     @State private var selectedTab = 0          var body: some View {         TabView(selection: $selectedTab) {             Tab("Home", systemImage: "house", value: 0) {                 HomeView()             }                          
  **Post-Mortem & Fix Analysis**:
  > Hey @theedov, thanks for the report! You're right — the Tab struct is the modern approach and our examples should reflect that.  We've updated all three instances across the mobile-ios-design skill:  - **SKILL.md** — TabView example now uses Tab() (iOS 18+) instead of .tabItem - **references/ios-navigation.md** — Both the basic TabView and the badged TabView examples updated to the Tab API. Also renamed the local Tab enum to AppTab to avoid collision with SwiftUI's Tab type.  Shipped in [ade0c7a](https://github.com/wshobson/agents/commit/ade0c7a). Thanks for catching this!

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

### Incident Patch 1: `46891e7e` (2026-10-04)
**Commit Message**: fix(skills): use local conversion and safer setup examples (#753)

* fix(codex): limit native packages to source skills

* test(pi): exclude ambient credentials from smoke fixtures

* fix(skills): use local conversion and safer setup examples

* docs: address deployment and conversion review feedback

* docs(kubernetes): clarify secret names for both deployment paths

* docs(file-conversion): scope temporary profile cleanup

**File**: `.agents/plugins/marketplace.json` (modified, +1/-1)
```diff
@@ -263,7 +263,7 @@
     },
     {
       "name": "file-conversion",
-      "description": "Convert files between 999 routes \u2014 PDF to Word, HEIC to JPG, MP4 to MP3, CSV to JSON, EPUB to MOBI \u2014 via the free ChangeThisFile API. MCP-aware with a zero-dependency script fallback; no API key required.",
+      "description": "Convert common image, audio, video, document, and data formats with installed local tools while preserving originals.",
       "source": {
         "source": "local",
         "path": "./plugins/file-conversion"
```

**File**: `.claude-plugin/marketplace.json` (modified, +8/-6)
```diff
@@ -1251,15 +1251,17 @@
     {
       "name": "file-conversion",
       "source": "./plugins/file-conversion",
-      "description": "Convert files between 999 routes \u2014 PDF to Word, HEIC to JPG, MP4 to MP3, CSV to JSON, EPUB to MOBI \u2014 via the free ChangeThisFile API. MCP-aware with a zero-dependency script fallback; no API key required.",
-      "version": "1.0.0",
+      "description": "Convert common image, audio, video, document, and data formats with installed local tools while preserving originals.",
+      "version": "2.0.0",
       "author": {
-        "name": "Aadil Razvi",
-        "url": "https://changethisfile.com"
+        "name": "Seth Hobson",
+        "email": "seth@major7apps.com",
+        "url": "https://github.com/wshobson"
       },
-      "homepage": "https://github.com/aadilr/changethisfile-mcp",
+      "homepage": "https://github.com/wshobson/agents/tree/main/plugins/file-conversion",
       "license": "MIT",
-      "category": "utilities"
+      "category": "utilities",
+      "repository": "https://github.com/wshobson/agents"
     },
     {
       "name": "skill-forge-essentials",
```

**File**: `.cursor-plugin/marketplace.json` (modified, +5/-5)
```diff
@@ -488,13 +488,13 @@
     {
       "name": "file-conversion",
       "source": "./plugins/file-conversion",
-      "version": "1.0.0",
-      "description": "Convert files between 999 routes \u2014 PDF to Word, HEIC to JPG, MP4 to MP3, CSV to JSON, EPUB to MOBI \u2014 via the free ChangeThisFile API. MCP-aware with a zero-dependency script fallback; no API key required.",
+      "version": "2.0.0",
+      "description": "Convert common image, audio, video, document, and data formats with installed local tools while preserving originals.",
       "author": {
-        "name": "Aadil Razvi",
-        "email": ""
+        "name": "Seth Hobson",
+        "email": "seth@major7apps.com"
       },
-      "homepage": "https://github.com/aadilr/changethisfile-mcp",
+      "homepage": "https://github.com/wshobson/agents/tree/main/plugins/file-conversion",
       "license": "MIT"
     },
     {
```

**File**: `.cursor-plugin/plugins/file-conversion.json` (modified, +5/-5)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "file-conversion",
   "displayName": "File Conversion",
-  "version": "1.0.0",
-  "description": "Convert files between 999 routes \u2014 PDF to Word, HEIC to JPG, MP4 to MP3, CSV to JSON, EPUB to MOBI \u2014 via the free ChangeThisFile API. MCP-aware with a zero-dependency script fallback; no API key required.",
+  "version": "2.0.0",
+  "description": "Convert common image, audio, video, document, and data formats with installed local tools while preserving originals.",
   "author": {
-    "name": "Aadil Razvi",
-    "email": ""
+    "name": "Seth Hobson",
+    "email": "seth@major7apps.com"
   },
-  "homepage": "https://github.com/aadilr/changethisfile-mcp",
+  "homepage": "https://github.com/wshobson/agents/tree/main/plugins/file-conversion",
   "license": "MIT"
 }
```

**File**: `docs/plugins.md` (modified, +1/-1)
```diff
@@ -164,7 +164,7 @@ Next.js, React + Vite, and Node.js project setup with pnpm and TypeScript best p
 | **code-refactoring**      | Code cleanup and technical debt management | `/plugin install code-refactoring`      |
 | **dependency-management** | Dependency auditing and version management | `/plugin install dependency-management` |
 | **error-debugging**       | Error analysis and trace debugging         | `/plugin install error-debugging`       |
-| **file-conversion**       | Convert files across 1,000+ format pairs   | `/plugin install file-conversion`       |
+| **file-conversion**       | Local file conversion with installed tools | `/plugin install file-conversion`       |
 | **team-collaboration**    | Team workflows and standup automation      | `/plugin install team-collaboration`    |
 
 ### 🤖 AI & ML (6 plugins)
```

**File**: `plugins/cicd-automation/skills/gitlab-ci-patterns/SKILL.md` (modified, +6/-1)
```diff
@@ -95,11 +95,16 @@ build-docker:
 
 ## Multi-Environment Deployment
 
+Set `KUBE_CA_CERT_FILE` as a GitLab file variable containing the cluster CA certificate,
+and provide `KUBE_TOKEN` through a protected, masked CI variable. The file variable
+contains a path that kubectl uses to verify the API server certificate. Protect both
+`develop` and `main` so the deployment jobs can read the protected token.
+
 ```yaml
 .deploy_template: &deploy_template
   image: bitnami/kubectl:1.31
   before_script:
-    - kubectl config set-cluster k8s --server="$KUBE_URL" --insecure-skip-tls-verify=true
+    - kubectl config set-cluster k8s --server="$KUBE_URL" --certificate-authority="$KUBE_CA_CERT_FILE" --embed-certs=true
     - kubectl config set-credentials admin --token="$KUBE_TOKEN"
     - kubectl config set-context default --cluster=k8s --user=admin
     - kubectl config use-context default
```

**File**: `plugins/cloud-infrastructure/skills/linkerd-patterns/SKILL.md` (modified, +6/-2)
```diff
@@ -53,9 +53,13 @@ Production patterns for Linkerd service mesh - the lightweight, security-first s
 
 ### Template 1: Mesh Installation
 
+Use a CLI version compatible with the target cluster. The example uses Homebrew;
+for other systems, follow the [official installation guide](https://linkerd.io/docs/getting-started/).
+
 ```bash
-# Install CLI
-curl --proto '=https' --tlsv1.2 -sSfL https://run.linkerd.io/install | sh
+# Install the CLI with Homebrew
+brew install linkerd
+linkerd version
 
 # Validate cluster
 linkerd check --pre
```

**File**: `plugins/developer-essentials/skills/turborepo-caching/SKILL.md` (modified, +5/-4)
```diff
@@ -215,11 +215,11 @@ app.head("/v8/artifacts/:hash", async (req, res) => {
   }
 });
 
-app.listen(3000);
+app.listen(3000, "127.0.0.1");
 ```
 
 ```json
-// turbo.json for self-hosted cache
+// turbo.json for the local cache demo
 {
   "remoteCache": {
     "signature": false
@@ -228,8 +228,9 @@ app.listen(3000);
 ```
 
 ```bash
-# Use self-hosted cache
-turbo build --api="http://localhost:3000" --token="my-token" --team="my-team"
+# This local demo does not authenticate the dummy token.
+# Use only disposable artifacts on a trusted machine; do not expose the server.
+turbo build --api="http://127.0.0.1:3000" --token="my-token" --team="my-team"
 ```
 
 ### Template 5: Filtering and Scoping
```

---

### Incident Patch 2: `373dc369` (2026-10-04)
**Commit Message**: fix(codex): publish only native packages with source skills (#752)

* fix(codex): limit native packages to source skills

* test(pi): exclude ambient credentials from smoke fixtures

**File**: `.agents/plugins/marketplace.json` (modified, +0/-533)
```diff
@@ -14,19 +14,6 @@
       },
       "category": "Coding"
     },
-    {
-      "name": "agent-orchestration",
-      "description": "Multi-agent system optimization, agent improvement workflows, and context management",
-      "source": {
-        "source": "local",
-        "path": "./plugins/agent-orchestration"
-      },
-      "policy": {
-        "installation": "AVAILABLE",
-        "authentication": "ON_USE"
-      },
-      "category": "Coding"
-    },
     {
       "name": "agent-teams",
       "description": "Orchestrate multi-agent teams for parallel code review, hypothesis-driven debugging, and coordinated feature development using Claude Code's Agent Teams",
@@ -53,45 +40,6 @@
       },
       "category": "Coding"
     },
-    {
-      "name": "api-testing-observability",
-      "description": "API testing automation, request mocking, OpenAPI documentation generation, observability setup, and monitoring",
-      "source": {
-        "source": "local",
-        "path": "./plugins/api-testing-observability"
-      },
-      "policy": {
-        "installation": "AVAILABLE",
-        "authentication": "ON_USE"
-      },
-      "category": "Coding"
-    },
-    {
-      "name": "application-performance",
-      "description": "Application profiling, performance optimization, and observability for frontend and backend systems",
-      "source": {
-        "source": "local",
-        "path": "./plugins/application-performance"
-      },
-      "policy": {
-        "installation": "AVAILABLE",
-        "authentication": "ON_USE"
-      },
-      "category": "Coding"
-    },
-    {
-      "name": "arm-cortex-microcontrollers",
-      "description": "ARM Cortex-M firmware development for Teensy, STM32, nRF52, and SAMD with peripheral drivers and memory safety patterns",
-      "source": {
-        "source": "local",
-        "path": "./plugins/arm-cortex-microcontrollers"
-      },
-      "policy": {
-        "installation": "AVAILABLE",
-        "authentication": "ON_USE"
-      },
-      "category": "Coding"
-    },
     {
       "name": "avoid-ai-writing",
       "description": "Audit and rewrite prose that reads as machine-generated, across READMEs, changelogs, PR descriptions, docs, and blog copy, with detect-only, rewrite, and edit-in-place modes.",
@@ -105,19 +53,6 @@
       },
       "category": "documentation"
     },
-    {
-      "name": "backend-api-security",
-      "description": "API security hardening, authentication implementation, authorization patterns, rate limiting, and input validation",
-      "source": {
-        "source": "local",
-        "path": "./plugins/backend-api-security"
-      },
-      "policy": {
-        "installation": "AVAILABLE",
-        "authentication": "ON_USE"
-      },
-      "category": "Coding"
-    },
     {
       "name": "backend-development",
       "description": "Backend API design, GraphQL architecture, workflow orchestration with Temporal, and test-driven backend development",
@@ -196,19 +131,6 @@
       },
       "category": "Coding"
     },
-    {
-      "name": "c4-architecture",
-      "description": "Comprehensive C4 architecture documentation workflow with bottom-up code analysis, component synthesis, container mapping, and context diagram generation",
-      "source": {
-        "source": "local",
-        "path": "./plugins/c4-architecture"
-      },
-      "policy": {
-        "installation": "AVAILABLE",
-        "authentication": "ON_USE"
-      },
-      "category": "Coding"
-    },
     {
       "name": "cicd-automation",
       "description": "CI/CD pipeline configuration, GitHub Actions/GitLab CI workflow setup, and automated deployment pipeline orchestration",
@@ -235,58 +157,6 @@
       },
       "category": "Coding"
     },
-    {
-      "name": "code-documentation",
-      "description": "Documentation generation, code explanation, and technical writing with automated doc generation and tutorial creation",
-      "source": {
-        "source": "local",
-        "path": "./plugins/code-documentation"
-      },
-      "policy": {
-        "installation": "AVAILABLE",
-        "authentication": "ON_USE"
-      },
-      "category": "Coding"
-    },
-    {
-      "name": "code-refactoring",
-      "description": "Code cleanup, refactoring automation, and technical debt management with context restoration",
-      "source": {
-        "source": "local",
-        "path": "./plugins/code-refactoring"
-      },
-      "policy": {
-        "installation": "AVAILABLE",
-        "authentication": "ON_USE"
-      },
-      "category": "Coding"
-    },
-    {
-      "name": "codebase-cleanup",
-      "description": "Technical debt reduction, dependency updates, and code refactoring automation",
-      "source": {
-        "source": "local",
-        "path": "./plugins/codebase-cleanup"
-      },
-      "policy": {
-        "installation": "AVAILABLE",
-        "authentication": "ON_USE"
-      },
-      "category": "Coding"
-    },
-    {
-  
```

**File**: `docs/authoring.md` (modified, +1/-1)
```diff
@@ -206,7 +206,7 @@ Things that work in Claude Code but degrade across harnesses:
 | `color:` on agents | Cosmetic; dropped everywhere except Claude Code. |
 | Per-agent tool allowlist | Honored only on Claude Code/Antigravity/OpenCode, and on Pi through the subagent extension. Cursor and Codex have coarser models. |
 | Slash commands | Codex converts to skills. Antigravity transpiles to TOML. Copilot emits `.copilot/commands/` prompt files. Pi emits prompt templates under `.pi/prompts/`. |
-| Marketplace registry | Only Claude Code, Cursor, and Antigravity have one. Codex, OpenCode, and Pi have no marketplace; Pi installs packages from npm, git, or a local path. |
+| Marketplace registry | Claude Code, Codex, Cursor, and Antigravity have registries. Codex installs source skills only; use the [generated Codex setup](round-trip-results.md#codex-round-trip) for agents and command-derived skills. OpenCode and Pi have no marketplace; Pi installs packages from npm, git, or a local path. |
 
 When you must use a feature with no equivalent, the `harness_portability` lint won't fire
 (it's not a portability problem — it's a capability gap). Just document the constraint in
```

**File**: `docs/harnesses.md` (modified, +8/-1)
```diff
@@ -111,12 +111,19 @@ leave everything else under `.pi/` alone.
 ## Native install
 
 - **Codex**. Run `codex plugin marketplace add wshobson/agents`, then
-  `codex plugin add python-development@claude-code-workflows` (or choose another local plugin).
+  `codex plugin add python-development@claude-code-workflows` (or choose another plugin
+  with source skills). The native registry includes only local plugins with a
+  `skills/<name>/SKILL.md` source file; agent-only and command-only plugins use the generated
+  setup linked below.
   The native manifests expose source skills from `plugins/<name>/skills/`, and skill bodies over
   the 8 KB cap are truncated by Codex at load. Generated TOML agents and command-derived skills
   use a separate adapter route. The gitignored `.codex/skills/` copies split oversized bodies
   into reference files. Follow the [generated Codex setup](round-trip-results.md#codex-round-trip)
   to generate and link skills into `~/.codex/skills/` and TOML agents into `~/.codex/agents/`.
+  Native manifests preserve explicit plugin metadata. Missing values use the repository owner,
+  repository URL, plugin source URL, root MIT license, and source skill names as keywords.
+  Regeneration removes the native manifest and registry entry when a plugin loses its last
+  source skill; generated agents and command-derived skills remain available.
 - **Cursor** — add the marketplace, then `/plugin install <name>`. Entries point at source
   `./plugins/<name>`; Cursor reads `SKILL.md` + `.md` agents from source directly.
 - **Antigravity** — no one-step-from-URL install (the lean tradeoff). Clone the repo, then
```

**File**: `plugins/accessibility-compliance/.codex-plugin/plugin.json` (modified, +6/-0)
```diff
@@ -7,7 +7,13 @@
     "name": "Seth Hobson",
     "email": "seth@major7apps.com"
   },
+  "homepage": "https://github.com/wshobson/agents/tree/main/plugins/accessibility-compliance",
+  "repository": "https://github.com/wshobson/agents",
   "license": "MIT",
+  "keywords": [
+    "screen-reader-testing",
+    "wcag-audit-patterns"
+  ],
   "interface": {
     "displayName": "Accessibility Compliance",
     "shortDescription": "WCAG accessibility auditing, compliance validation, UI testing for screen readers, keyboard navigation, and\u2026",
```

**File**: `plugins/agent-orchestration/.codex-plugin/plugin.json` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-{
-  "name": "agent-orchestration",
-  "version": "1.2.2",
-  "description": "Multi-agent system optimization, agent improvement workflows, and context management",
-  "skills": "./skills/",
-  "author": {
-    "name": "Seth Hobson",
-    "email": "seth@major7apps.com"
-  },
-  "license": "MIT",
-  "interface": {
-    "displayName": "Agent Orchestration",
-    "shortDescription": "Multi-agent system optimization, agent improvement workflows, and context management",
-    "category": "Coding"
-  }
-}
```

**File**: `plugins/agent-teams/.codex-plugin/plugin.json` (modified, +10/-0)
```diff
@@ -7,7 +7,17 @@
     "name": "Seth Hobson",
     "email": "seth@major7apps.com"
   },
+  "homepage": "https://github.com/wshobson/agents/tree/main/plugins/agent-teams",
+  "repository": "https://github.com/wshobson/agents",
   "license": "MIT",
+  "keywords": [
+    "multi-reviewer-patterns",
+    "parallel-debugging",
+    "parallel-feature-development",
+    "task-coordination-strategies",
+    "team-communication-protocols",
+    "team-composition-patterns"
+  ],
   "interface": {
     "displayName": "Agent Teams",
     "shortDescription": "Orchestrate multi-agent teams for parallel code review, hypothesis-driven debugging, and coordinated feature\u2026",
```

**File**: `plugins/api-scaffolding/.codex-plugin/plugin.json` (modified, +5/-0)
```diff
@@ -7,7 +7,12 @@
     "name": "Seth Hobson",
     "email": "seth@major7apps.com"
   },
+  "homepage": "https://github.com/wshobson/agents/tree/main/plugins/api-scaffolding",
+  "repository": "https://github.com/wshobson/agents",
   "license": "MIT",
+  "keywords": [
+    "fastapi-templates"
+  ],
   "interface": {
     "displayName": "Api Scaffolding",
     "shortDescription": "REST and GraphQL API scaffolding, framework selection, backend architecture, and API generation",
```

**File**: `plugins/api-testing-observability/.codex-plugin/plugin.json` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-{
-  "name": "api-testing-observability",
-  "version": "1.2.1",
-  "description": "API testing automation, request mocking, OpenAPI documentation generation, observability setup, and monitoring",
-  "skills": "./skills/",
-  "author": {
-    "name": "Seth Hobson",
-    "email": "seth@major7apps.com"
-  },
-  "license": "MIT",
-  "interface": {
-    "displayName": "Api Testing Observability",
-    "shortDescription": "API testing automation, request mocking, OpenAPI documentation generation, observability setup, and monitoring",
-    "category": "Coding"
-  }
-}
```

---

### Incident Patch 3: `156b7a5e` (2026-09-29)
**Commit Message**: fix(skills): remove dangling Reference lines and check them in the gardener (#743)

* fix(skills): remove dangling Reference lines and check them in the gardener

Seventeen "**Reference:** See `path`" lines in six skills pointed to
files that were never added to the repo. The lines are removed, and the
content they named is already inline in each skill or in its
references/details.md file.

The gardener's dead link check only read markdown links, so it missed
these backticked paths. It now also checks each **Reference:** line in a
skill file, and it reports an error when a references/, assets/, or
scripts/ path does not exist in the skill folder.

Closes #742

* fix(gardener): resolve Reference pointers from the skill folder

The check now finds the skill folder from the file's place under
plugins/, so a file in a nested folder such as references/examples/
resolves its pointers the same way as references/details.md. It skips
**Reference:** lines inside fenced code examples, as the markdown link
check already does. It also rejects a path that uses .. to leave the
skill folder.

**File**: `plugins/cicd-automation/skills/github-actions-templates/SKILL.md` (modified, +0/-6)
```diff
@@ -64,8 +64,6 @@ jobs:
           files: ./coverage/lcov.info
 ```
 
-**Reference:** See `assets/test-workflow.yml`
-
 ### Pattern 2: Build and Push Docker Image
 
 ```yaml
@@ -119,8 +117,6 @@ jobs:
           cache-to: type=gha,mode=max
 ```
 
-**Reference:** See `assets/deploy-workflow.yml`
-
 ### Pattern 3: Deploy to Kubernetes
 
 ```yaml
@@ -193,8 +189,6 @@ jobs:
         run: pytest
 ```
 
-**Reference:** See `assets/matrix-build.yml`
-
 ## Workflow Best Practices
 
 1. **Use specific action versions** (@v4, not @latest)
```

**File**: `plugins/cicd-automation/skills/secrets-management/SKILL.md` (modified, +0/-4)
```diff
@@ -114,8 +114,6 @@ deploy:
       # Use $DB_PASSWORD, $API_KEY
 ```
 
-**Reference:** See `references/vault-setup.md`
-
 ## AWS Secrets Manager
 
 ### Store Secret
@@ -196,8 +194,6 @@ deploy:
         ./deploy.sh
 ```
 
-**Reference:** See `references/github-secrets.md`
-
 ## GitLab CI/CD Variables
 
 ### Project Variables
```

**File**: `plugins/observability-monitoring/skills/distributed-tracing/references/details.md` (modified, +0/-6)
```diff
@@ -71,8 +71,6 @@ services:
       - COLLECTOR_ZIPKIN_HOST_PORT=:9411
 ```
 
-**Reference:** See `references/jaeger-setup.md`
-
 ## Application Instrumentation
 
 ### OpenTelemetry (Recommended)
@@ -220,8 +218,6 @@ func getUsers(ctx context.Context) ([]User, error) {
 }
 ```
 
-**Reference:** See `references/instrumentation.md`
-
 ## Context Propagation
 
 ### HTTP Headers
@@ -313,8 +309,6 @@ spec:
             name: tempo-config
 ```
 
-**Reference:** See `assets/jaeger-config.yaml.template`
-
 ## Sampling Strategies
 
 ### Probabilistic Sampling
```

**File**: `plugins/observability-monitoring/skills/grafana-dashboards/SKILL.md` (modified, +0/-6)
```diff
@@ -105,8 +105,6 @@ Design effective Grafana dashboards for monitoring applications, infrastructure,
 }
 ```
 
-**Reference:** See `assets/api-dashboard.json`
-
 ## Panel Types
 
 ### 1. Stat Panel (Single Value)
@@ -308,8 +306,6 @@ providers:
 - Pod count by namespace
 - Node status
 
-**Reference:** See `assets/infrastructure-dashboard.json`
-
 ### Database Dashboard
 
 **Key Panels:**
@@ -322,8 +318,6 @@ providers:
 - Replication lag
 - Slow queries
 
-**Reference:** See `assets/database-dashboard.json`
-
 ### Application Dashboard
 
 **Key Panels:**
```

**File**: `plugins/observability-monitoring/skills/prometheus-configuration/references/details.md` (modified, +0/-8)
```diff
@@ -136,8 +136,6 @@ scrape_configs:
       key_file: /etc/prometheus/client.key
 ```
 
-**Reference:** See `assets/prometheus.yml.template`
-
 ## Scrape Configurations
 
 ### Static Targets
@@ -201,8 +199,6 @@ scrape_configs:
         regex: (.+)
 ```
 
-**Reference:** See `references/scrape-configs.md`
-
 ## Recording Rules
 
 Create pre-computed metrics for frequently queried expressions:
@@ -251,8 +247,6 @@ groups:
           100 - ((node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100)
 ```
 
-**Reference:** See `references/recording-rules.md`
-
 ## Alert Rules
 
 ```yaml
@@ -331,5 +325,3 @@ promtool check rules /etc/prometheus/rules/*.yml
 # Test query
 promtool query instant http://localhost:9090 'up'
 ```
-
-**Reference:** See `scripts/validate-prometheus.sh`
```

**File**: `plugins/observability-monitoring/skills/slo-implementation/SKILL.md` (modified, +0/-4)
```diff
@@ -61,8 +61,6 @@ sum(storage_writes_successful_total)
 sum(storage_writes_total)
 ```
 
-**Reference:** See `references/slo-definitions.md`
-
 ## Setting SLO Targets
 
 ### Availability SLO Examples
@@ -134,8 +132,6 @@ error_budget_policy:
     action: Feature freeze, focus on reliability
 ```
 
-**Reference:** See `references/error-budget.md`
-
 ## SLO Implementation
 
 ### Prometheus Recording Rules
```

**File**: `tools/doc_gardener.py` (modified, +32/-4)
```diff
@@ -438,11 +438,12 @@ def check_oversized_context_files(report: Report) -> None:
 _INLINE_CODE_PATTERN = re.compile(r"(`+)(?!`).*?(?<!`)\1(?!`)")
 
 
-def _strip_code(content: str) -> str:
+def _strip_code(content: str, *, inline: bool = True) -> str:
     """Drop fenced blocks and inline code, so example links in skills aren't checked.
 
     A fence closes only on a bare run of the same character at least as long as the
-    opener, so a ```` block can hold ``` examples.
+    opener, so a ```` block can hold ``` examples. With `inline=False`, inline code
+    is kept.
     """
     kept: list[str] = []
     fence: str | None = None
@@ -452,7 +453,7 @@ def _strip_code(content: str) -> str:
             if match:
                 fence = match.group(1)
             else:
-                kept.append(_INLINE_CODE_PATTERN.sub("", line))
+                kept.append(_INLINE_CODE_PATTERN.sub("", line) if inline else line)
             continue
         run = line.strip()
         if match and set(run) == {fence[0]} and len(run) >= len(fence):
@@ -479,11 +480,37 @@ def _report_dead_links(md: Path, content: str, report: Report) -> None:
             )
 
 
+_SKILL_REFERENCE_PATTERN = re.compile(r"^\*\*Reference:\*\*.*$", re.MULTILINE)
+_SKILL_REFERENCE_PATH_PATTERN = re.compile(r"`((?:references|assets|scripts)/[^`\s]+)`")
+
+
+def _report_dead_skill_references(md: Path, content: str, report: Report) -> None:
+    """Check `**Reference:** See `references/x.md`` pointers, which aren't markdown links.
+
+    These paths are written relative to the skill folder, even inside references/,
+    and must stay inside it.
+    """
+    # `plugins/<plugin>/skills/<skill>/...`, however deep the file is.
+    skill_dir = PLUGINS_DIR.joinpath(*md.relative_to(PLUGINS_DIR).parts[:3]).resolve()
+    for line in _SKILL_REFERENCE_PATTERN.findall(content):
+        for target in _SKILL_REFERENCE_PATH_PATTERN.findall(line):
+            resolved = (skill_dir / target).resolve()
+            if not resolved.is_relative_to(skill_dir) or not resolved.exists():
+                report.add(
+                    kind="DEAD_LINK",
+                    severity="error",
+                    path=md,
+                    message=f"**Reference:** to `{target}` does not exist in the skill folder",
+                    fix="Create the missing file in the skill folder, or remove the **Reference:** line.",
+                )
+
+
 def check_dead_links(report: Report) -> None:
     """Find markdown links that point at missing files.
 
     Covers docs/, the top-level guides, and every skill's SKILL.md and references/
-    files. Skill files skip links inside code, because skills carry sample documents.
+    files. Skill files skip links inside code, because skills carry sample documents,
+    and also have their `**Reference:**` pointers checked.
     """
     targets = [DOCS_DIR] if DOCS_DIR.is_dir() else []
     for top_file in (
@@ -509,6 +536,7 @@ def check_dead_links(report: Report) -> None:
             if content is None:
                 continue
             _report_dead_links(md, _strip_code(content), report)
+            _report_dead_skill_references(md, _strip_code(content, inline=False), report)
 
 
 def check_codex_skill_caps(report: Report) -> None:
```

**File**: `tools/tests/test_doc_gardener.py` (modified, +61/-0)
```diff
@@ -417,6 +417,67 @@ def test_skill_links_in_multi_backtick_code_are_skipped(
         check_dead_links(report)
         assert not [f for f in report.findings if f.kind == "DEAD_LINK"]
 
+    def test_skill_reference_pointers_resolve_from_the_skill_folder(
+        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+    ):
+        """`**Reference:** See `references/x.md`` pointers that were never created (#742)."""
+        _patch_paths(monkeypatch, tmp_path)
+        skill = tmp_path / "plugins" / "p" / "skills" / "s"
+        (skill / "references").mkdir(parents=True)
+        (skill / "references" / "real.md").write_text("# Real\n")
+        (skill / "SKILL.md").write_text(
+            "**Reference:** See `references/real.md` and `references/gone.md`\n"
+        )
+        (skill / "references" / "details.md").write_text(
+            "**Reference:** See `references/real.md`\n**Reference:** See `assets/gone.json`\n"
+        )
+        # Nested files still resolve from the skill folder, not from their parent.
+        (skill / "references" / "examples").mkdir()
+        (skill / "references" / "examples" / "nested.md").write_text(
+            "**Reference:** See `references/real.md`\n"
+        )
+        report = Report()
+        check_dead_links(report)
+        findings = [f for f in report.findings if f.kind == "DEAD_LINK"]
+        assert sorted((f.path.name, f.message) for f in findings) == [
+            (
+                "SKILL.md",
+                "**Reference:** to `references/gone.md` does not exist in the skill folder",
+            ),
+            (
+                "details.md",
+                "**Reference:** to `assets/gone.json` does not exist in the skill folder",
+            ),
+        ]
+
+    def test_skill_reference_pointers_in_fenced_examples_are_skipped(
+        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+    ):
+        _patch_paths(monkeypatch, tmp_path)
+        skill = tmp_path / "plugins" / "p" / "skills" / "s"
+        skill.mkdir(parents=True)
+        (skill / "SKILL.md").write_text(
+            "```markdown\n**Reference:** See `assets/example.yml`\n```\n"
+        )
+        report = Report()
+        check_dead_links(report)
+        assert not [f for f in report.findings if f.kind == "DEAD_LINK"]
+
+    def test_skill_reference_pointers_cannot_leave_the_skill_folder(
+        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+    ):
+        _patch_paths(monkeypatch, tmp_path)
+        skills = tmp_path / "plugins" / "p" / "skills"
+        (skills / "other" / "references").mkdir(parents=True)
+        (skills / "other" / "references" / "x.md").write_text("# X\n")
+        (skills / "s").mkdir()
+        (skills / "s" / "SKILL.md").write_text(
+            "**Reference:** See `references/../../other/references/x.md`\n"
+        )
+        report = Report()
+        check_dead_links(report)
+        assert len([f for f in report.findings if f.kind == "DEAD_LINK"]) == 1
+
 
 # ── Codex skill cap ──────────────────────────────────────────────────────────
 
```

---

### Incident Patch 4: `51b6e0b5` (2026-09-28)
**Commit Message**: fix(antigravity): install into ~/.gemini/config, migrate old links, and repair skill dead links (#735)

* fix(antigravity): update plugin's config dir for Antigravity & some references

* fix(skills): repair the remaining dead links in skill files

Links inside references/ files resolve from that folder, so eight more
details.md files that linked references/x.md now link ./x.md. The
postmortem-writing split had left Template 1's closing lines and fence in
SKILL.md, which inverted every later code block; they are back at the end
of the template in details.md. Related Skills links in
on-call-handoff-patterns and sast-configuration pointed at skills that do
not exist and now point at real sibling skills.

* fix(gardener): check dead links in SKILL.md and references/ files

Links inside fenced blocks and inline code are skipped, because skills
carry sample documents with placeholder links.

* fix(antigravity): move old installs out of ~/.gemini/antigravity-cli

install removes this repo's link for a plugin from the old directory once
the new link is in place, and uninstall cleans both directories. Neither
touches the old directory when the caller chose a config dir. A smoke test
instal

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ The small per-harness registries are **committed** so each harness installs nati
 
 - **Codex**: `.codex/agents/<plugin>__<agent>.toml` (drop `tools:`, map model alias to the GPT-5.x family, infer `sandbox_mode`)
 - **OpenCode**: `.opencode/agents/<plugin>__<agent>.md` with `mode: subagent` + `permission:` block (locked agents — those with source `tools: []` — get deny-everything except base `skill`/`task`)
-- **Antigravity CLI**: `.antigravity/plugins/<p>/agents/<agent>.md` (Markdown + YAML frontmatter, `model:` is a tier alias — `inherit`/`flash`/`pro`); TOML commands at `commands/<p>/<cmd>.toml` (agy reports these as "converted to skills"); global install via `make install-antigravity` symlinks each plugin into `~/.gemini/antigravity-cli/plugins/`
+- **Antigravity CLI**: `.antigravity/plugins/<p>/agents/<agent>.md` (Markdown + YAML frontmatter, `model:` is a tier alias — `inherit`/`flash`/`pro`); TOML commands at `commands/<p>/<cmd>.toml` (agy reports these as "converted to skills"); global install via `make install-antigravity` symlinks each plugin into `~/.gemini/config/plugins/`
 - **Pi**: `.pi/agents/<plugin>__<agent>.md` in the reference `subagent` extension's format (name, description, tools, model); commands become prompt templates at `.pi/prompts/<plugin>__<cmd>.md`
 - **Cursor**: reads `.claude/agents/` directly
 
```

**File**: `docs/harnesses.md` (modified, +4/-2)
```diff
@@ -111,7 +111,9 @@ leave everything else under `.pi/` alone.
 - **Antigravity** — no one-step-from-URL install (the lean tradeoff). Clone the repo, then
   `make generate HARNESS=antigravity` and either `agy plugin install .antigravity/plugins/<name>`
   per plugin, or `make install-antigravity` to symlink every generated plugin into
-  `~/.gemini/antigravity-cli/plugins/` (agy's config dir) at once.
+  `~/.gemini/config/plugins/` (agy's config dir) at once. Installs made before this
+  change linked into `~/.gemini/antigravity-cli/plugins/`, and both `make install-antigravity`
+  and `make uninstall-antigravity` remove this repo's links from that old directory.
 - **OpenCode** — no one-step-from-URL install. Clone the repo, then `make install-opencode`
   (runs generate + symlinks `.opencode/` → `~/.config/opencode/`).
 - **Pi** — no one-step-from-URL install. Clone the repo, then `make install-pi` symlinks every
@@ -230,7 +232,7 @@ make uninstall-opencode
 make install-copilot     # symlink .copilot/ → ~/.copilot/
 make uninstall-copilot
 
-make install-antigravity    # symlink each .antigravity/plugins/<p>/ → ~/.gemini/antigravity-cli/plugins/<p>/
+make install-antigravity    # symlink each .antigravity/plugins/<p>/ → ~/.gemini/config/plugins/<p>/
 make uninstall-antigravity
 
 make install-pi          # symlink each .pi/ skill, prompt, and agent → ~/.pi/agent/
```

**File**: `plugins/conductor/skills/context-driven-development/references/details.md` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ Update when:
 - Track status changes
 - Tracks are completed or archived
 
-See [references/artifact-templates.md](references/artifact-templates.md) for copy-paste starter templates.
+See [references/artifact-templates.md](./artifact-templates.md) for copy-paste starter templates.
 
 ## Context Maintenance Principles
 
```

**File**: `plugins/documentation-generation/skills/openapi-spec-generation/references/details.md` (modified, +1/-1)
```diff
@@ -467,7 +467,7 @@ security:
   - bearerAuth: []
 ```
 
-For advanced code-first generation patterns and tooling, see [references/code-first-and-tooling.md](references/code-first-and-tooling.md):
+For advanced code-first generation patterns and tooling, see [references/code-first-and-tooling.md](./code-first-and-tooling.md):
 
 - **Template 2: Python/FastAPI** — Pydantic models with `Field` validation, enum types, full CRUD endpoints with `response_model` and `status_code`, exporting the spec as JSON
 - **Template 3: TypeScript/tsoa** — Decorator-based controllers (`@Route`, `@Get`, `@Security`, `@Example`, `@Response`) that generate OpenAPI from TypeScript types
```

**File**: `plugins/frontend-mobile-development/skills/tailwind-design-system/references/details.md` (modified, +2/-2)
```diff
@@ -348,7 +348,7 @@ export function Container({ className, size, ...props }: ContainerProps) {
 </Container>
 ```
 
-For advanced animation and dark mode patterns, see [references/advanced-patterns.md](references/advanced-patterns.md):
+For advanced animation and dark mode patterns, see [references/advanced-patterns.md](./advanced-patterns.md):
 
 - **Pattern 5: Native CSS Animations** — dialog `@keyframes`, native popover API with `@starting-style`, `allow-discrete` transitions, and a full `DialogContent`/`DialogOverlay` implementation using Radix UI
 - **Pattern 6: Dark Mode** — `ThemeProvider` context with `localStorage` persistence, `prefers-color-scheme` detection, meta `theme-color` update, and a `ThemeToggle` button component
@@ -374,7 +374,7 @@ export const focusRing = cn(
 export const disabled = "disabled:pointer-events-none disabled:opacity-50";
 ```
 
-For advanced v4 CSS patterns, the full v3-to-v4 migration checklist, and complete best practices, see [references/advanced-patterns.md](references/advanced-patterns.md):
+For advanced v4 CSS patterns, the full v3-to-v4 migration checklist, and complete best practices, see [references/advanced-patterns.md](./advanced-patterns.md):
 
 - **Custom `@utility`** — reusable CSS utilities for decorative lines and text gradients
 - **Theme modifiers** — `@theme inline` (reference other CSS vars), `@theme static` (always output), `@import "tailwindcss" theme(static)`
```

**File**: `plugins/game-development/skills/godot-gdscript-patterns/references/details.md` (modified, +1/-1)
```diff
@@ -484,7 +484,7 @@ func receive_hit(hitbox: HitboxComponent) -> void:
         health_component.take_damage(hitbox.damage, hitbox.owner_node)
 ```
 
-For advanced Godot patterns, performance tips, and best practices, see [references/advanced-patterns.md](references/advanced-patterns.md):
+For advanced Godot patterns, performance tips, and best practices, see [references/advanced-patterns.md](./advanced-patterns.md):
 
 - **Pattern 6: Scene Management** — Autoload `SceneManager` with async threaded loading (`ResourceLoader.load_threaded_request`), `ResourceLoader.has_cached` check, transition overlay support, and scene swapping with `queue_free`
 - **Pattern 7: Save System** — Autoload `SaveManager` with AES-encrypted save files (`FileAccess.open_encrypted_with_pass`), JSON serialization, and a reusable `Saveable` component node for per-node save/load lifecycle
```

**File**: `plugins/incident-response/skills/on-call-handoff-patterns/SKILL.md` (modified, +2/-2)
```diff
@@ -66,5 +66,5 @@ Add a standard step: outgoing engineer fires a test alert and confirms incoming
 
 ## Related Skills
 
-- [incident-classification](../../skills/incident-classification/SKILL.md) — Classify and prioritize incidents that need to be included in the handoff document
-- [postmortem-facilitation](../../skills/postmortem-facilitation/SKILL.md) — Turn resolved incidents from the shift into structured postmortems
+- [incident-runbook-templates](../incident-runbook-templates/SKILL.md) — Runbooks for the incidents that are handed over mid-response
+- [postmortem-writing](../postmortem-writing/SKILL.md) — Turn resolved incidents from the shift into structured postmortems
```

**File**: `plugins/incident-response/skills/postmortem-writing/SKILL.md` (modified, +0/-5)
```diff
@@ -54,11 +54,6 @@ Quarterly: Review patterns across incidents
 
 Full template library and detailed worked examples live in `references/details.md`. Read that file when you need the concrete templates.
 
-## References
-- [Connection Pool Best Practices](internal-wiki/connection-pools)
-- [Deployment Runbook](internal-wiki/deployment-runbook)
-```
-
 ### Template 2: 5 Whys Analysis
 
 ```markdown
```

---

### Incident Patch 5: `7c83b809` (2026-09-28)
**Commit Message**: fix(gardener): validate generated YAML frontmatter (#711)

* fix(gardener): validate generated YAML frontmatter

* fix(gardener): handle leading blank frontmatter

* docs(gardener): document context budget check

* fix(gardener): require column-zero closing delimiter

* test(gardener): cover frontmatter selector CLI

* fix(gardener): include the Pi output in the frontmatter YAML check

---------

Co-authored-by: Seth Hobson <[REDACTED_EMAIL]>

**File**: `tools/doc_gardener.py` (modified, +63/-0)
```diff
@@ -10,6 +10,7 @@
 6. Plugins missing from marketplace.json
 7. Component counts quoted in README.md / AGENTS.md that no longer match reality
 8. Same-named agents whose bodies have diverged across plugins
+9. Generated Markdown artifacts with invalid YAML frontmatter
 
 Each finding ships with a `Fix:` remediation line.
 
@@ -31,6 +32,8 @@
 from pathlib import Path
 from typing import Any, cast
 
+import yaml
+
 sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
 
 from tools.adapters.base import WORKTREE, list_plugins, parse_frontmatter
@@ -351,7 +354,66 @@ def check_stale_artifacts(report: Report) -> None:
             )
 
 
+GENERATED_MARKDOWN_ROOTS = (".codex", ".opencode", ".copilot", ".antigravity", ".pi")
+
+
+def check_generated_frontmatter_yaml(report: Report) -> None:
+    """Parse generated Markdown frontmatter with a real YAML loader.
+
+    Adapter-level smoke tests can miss syntax that tolerant line-oriented readers
+    accept.  Scan only generated harness outputs and fail on malformed or
+    non-mapping frontmatter so broken artifacts cannot be published silently.
+    """
+    for root_name in GENERATED_MARKDOWN_ROOTS:
+        root = WORKTREE / root_name
+        if not root.is_dir():
+            continue
+        for path in sorted(root.rglob("*.md")):
+            text = read_text_or_none(path, report)
+            if text is None:
+                continue
+            lines = text.lstrip(BOM).splitlines()
+            first_content = next((index for index, line in enumerate(lines) if line.strip()), None)
+            if first_content is None or lines[first_content].strip() != "---":
+                continue
+            lines = lines[first_content:]
+            closing = next(
+                (index for index, line in enumerate(lines[1:], 1) if line.rstrip() == "---"), None
+            )
+            if closing is None:
+                report.add(
+                    kind="INVALID_GENERATED_FRONTMATTER",
+                    severity="error",
+                    path=path,
+                    message="frontmatter opens with `---` but has no closing delimiter",
+                    fix="Fix the source metadata or adapter, then regenerate this artifact.",
+                )
+                continue
+            raw = "\n".join(lines[1:closing])
+            try:
+                parsed = yaml.safe_load(raw)
+            except yaml.YAMLError as exc:
+                detail = str(exc).splitlines()[0]
+                report.add(
+                    kind="INVALID_GENERATED_FRONTMATTER",
+                    severity="error",
+                    path=path,
+                    message=f"frontmatter is not valid YAML: {detail}",
+                    fix="Fix the source metadata or adapter, then regenerate this artifact.",
+                )
+                continue
+            if not isinstance(parsed, dict):
+                report.add(
+                    kind="INVALID_GENERATED_FRONTMATTER",
+                    severity="error",
+                    path=path,
+                    message=f"frontmatter is {type(parsed).__name__}, expected a YAML mapping",
+                    fix="Emit key/value frontmatter from the adapter, then regenerate this artifact.",
+                )
+
+
 def check_oversized_context_files(report: Report) -> None:
+    """Report context files that exceed their configured line budgets."""
     for name, cap in CONTEXT_FILES.items():
         path = WORKTREE / name
         if not path.is_file():
@@ -760,6 +822,7 @@ def check_arguments_framing(report: Report) -> None:
 CHECKS = {
     "stale": check_stale_artifacts,
     "context": check_oversized_context_files,
+    "frontmatter-yaml": check_generated_frontmatter_yaml,
     "links": check_dead_links,
     "codex-cap": check_codex_skill_caps,
     "marketplace": check_marketplace_consistency,
```

**File**: `tools/tests/test_doc_gardener.py` (modified, +134/-0)
```diff
@@ -3,6 +3,7 @@
 from __future__ import annotations
 
 import json
+import sys
 from pathlib import Path
 
 import pytest
@@ -14,9 +15,11 @@
     check_codex_skill_caps,
     check_dead_links,
     check_doc_counts,
+    check_generated_frontmatter_yaml,
     check_marketplace_consistency,
     check_oversized_context_files,
     check_stale_artifacts,
+    main,
     marketplace_entry_problem,
 )
 
@@ -150,6 +153,137 @@ def test_stale_pi_artifacts_are_reported(self, tmp_path: Path, monkeypatch: pyte
         ]
 
 
+# ── Generated YAML frontmatter ────────────────────────────────────────────────
+
+
+class TestGeneratedFrontmatterYaml:
+    @pytest.mark.parametrize(
+        "root_name", [".codex", ".opencode", ".copilot", ".antigravity", ".pi"]
+    )
+    def test_malformed_generated_frontmatter_errors(
+        self, root_name: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+    ):
+        """Malformed YAML is reported in every generated Markdown root."""
+        _patch_paths(monkeypatch, tmp_path)
+        generated = tmp_path / root_name / "agents" / "broken.md"
+        generated.parent.mkdir(parents=True)
+        generated.write_text('---\nname: broken\ndescription: "unterminated\n---\nBody.\n')
+
+        report = Report()
+        check_generated_frontmatter_yaml(report)
+
+        findings = [f for f in report.findings if f.kind == "INVALID_GENERATED_FRONTMATTER"]
+        assert len(findings) == 1
+        assert findings[0].severity == "error"
+        assert findings[0].path == generated
+
+    def test_leading_blank_lines_do_not_hide_malformed_frontmatter(
+        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+    ):
+        """A BOM and leading blank lines do not bypass frontmatter validation."""
+        _patch_paths(monkeypatch, tmp_path)
+        generated = tmp_path / ".codex" / "agents" / "broken.md"
+        generated.parent.mkdir(parents=True)
+        generated.write_text(
+            '\ufeff\n  \n---\nname: broken\ndescription: "unterminated\n---\nBody.\n',
+            encoding="utf-8",
+        )
+
+        report = Report()
+        check_generated_frontmatter_yaml(report)
+
+        findings = [f for f in report.findings if f.kind == "INVALID_GENERATED_FRONTMATTER"]
+        assert len(findings) == 1
+        assert findings[0].path == generated
+
+    def test_indented_delimiter_in_literal_does_not_hide_malformed_yaml(
+        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+    ):
+        """An indented scalar line is content, not the closing delimiter."""
+        _patch_paths(monkeypatch, tmp_path)
+        generated = tmp_path / ".opencode" / "agents" / "broken.md"
+        generated.parent.mkdir(parents=True)
+        generated.write_text(
+            '---\ndescription: |\n  ---\nvalue: "unterminated\n---   \nBody.\n',
+            encoding="utf-8",
+        )
+
+        report = Report()
+        check_generated_frontmatter_yaml(report)
+
+        findings = [f for f in report.findings if f.kind == "INVALID_GENERATED_FRONTMATTER"]
+        assert len(findings) == 1
+        assert findings[0].path == generated
+        assert "not valid YAML" in findings[0].message
+
+    def test_cli_selector_dispatches_and_returns_error(
+        self,
+        tmp_path: Path,
+        monkeypatch: pytest.MonkeyPatch,
+        capsys: pytest.CaptureFixture[str],
+    ):
+        """The named CLI check dispatches frontmatter validation and exits nonzero."""
+        _patch_paths(monkeypatch, tmp_path)
+        generated = tmp_path / ".codex" / "agents" / "broken.md"
+        generated.parent.mkdir(parents=True)
+        generated.write_text(
+            '---\nname: broken\ndescription: "unterminated\n---\nBody.\n',
+            encoding="utf-8",
+        )
+        monkeypatch.setattr(
+            sys,
+            "argv",
+            ["doc_gardener.py", "--check", "frontmatter-yaml", "--quiet"],
+        )
+
+        assert main() == 1
+        assert "INVALID_GENERATED_FRONTMATTER" in capsys.readouterr().out
+
+    def test_valid_generated_mapping_is_clean(
+        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+    ):
+        """A mapping-valued generated frontmatter block remains valid."""
+        _patch_paths(monkeypatch, tmp_path)
+        generated = tmp_path / ".opencode" / "agents" / "valid.md"
+        generated.parent.mkdir(parents=True)
+        generated.write_text("---\nname: valid\ntools:\n  read: true\n---\nBody.\n")
+
+        report = Report()
+        check_generated_frontmatter_yaml(report)
+
+        assert [f for f in report.findings if f.kind == "INVALID_GENERATED_FRONTMATTER"] == []
+
+    def test_missing_closing_delimiter_errors(
+        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+    ):
+        """An opened frontmatter block must have a closing delimiter."""
+        _patch_paths(monkeypatch, tmp_path)
+        generated = tmp_path / ".copilot" / "agents" / "broken.md"
+        generated.parent.mkdir(parents
```

---

### Incident Patch 6: `9b15b34b` (2026-09-26)
**Commit Message**: chore(plugin-eval): remove the trace harness and the API prompt writer (#737)

* chore(plugin-eval): remove the trace harness and the API prompt writer

plugin-eval traces run started the claude CLI with whatever ANTHROPIC_API_KEY was
set, and plugin-eval traces prompts called the Anthropic SDK. The eval process
now makes its traces and test requests with Claude Code subagents on the
maintainer's Claude plan, so both commands, the traces package, their tests and
fixture, and the api extra are removed. The judge and Monte Carlo layers stay.

New tests fail if the traces command, an anthropic import, or the api extra
comes back.

* fix(plugin-eval): drop the stale api install line and catch from-imports in the guard

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -1092,7 +1092,7 @@
       "name": "plugin-eval",
       "source": "./plugins/plugin-eval",
       "description": "Static lint for Claude Code plugins and skills, with experimental LLM scoring for skills",
-      "version": "0.1.1",
+      "version": "0.1.2",
       "author": {
         "name": "Seth Hobson"
       },
```

**File**: `.cursor-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -757,7 +757,7 @@
     {
       "name": "plugin-eval",
       "source": "./plugins/plugin-eval",
-      "version": "0.1.1",
+      "version": "0.1.2",
       "description": "Static lint for Claude Code plugins and skills, with experimental LLM scoring for skills"
     },
     {
```

**File**: `.cursor-plugin/plugins/plugin-eval.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "plugin-eval",
   "displayName": "Plugin Eval",
-  "version": "0.1.1",
+  "version": "0.1.2",
   "description": "Static lint for Claude Code plugins and skills, with experimental LLM scoring for skills"
 }
```

**File**: `.gitignore` (modified, +0/-3)
```diff
@@ -66,6 +66,3 @@ opencode.json
 
 # Superpowers plugin artifacts (specs/plans are session-local, never committed)
 docs/superpowers/
-
-# plugin-eval traces from `plugin-eval traces run` (large; not committed for now)
-evals/traces/
```

**File**: `docs/plugin-eval.md` (modified, +1/-5)
```diff
@@ -49,9 +49,6 @@ uv sync
 # Install with LLM support (Layers 2 & 3)
 uv sync --extra llm
 
-# Install with direct API support
-uv sync --extra api
-
 # Install dev dependencies (tests, linting)
 uv sync --extra dev
 ```
@@ -60,8 +57,7 @@ uv sync --extra dev
 
 - Python ≥ 3.12
 - Core: `pydantic`, `typer`, `rich`, `pyyaml`
-- LLM layers: `claude-agent-sdk` (uses Claude Code Max plan by default)
-- API alternative: `anthropic` SDK (requires `ANTHROPIC_API_KEY`)
+- LLM layers: `claude-agent-sdk`. It runs the `claude` CLI, which bills `ANTHROPIC_API_KEY` when that variable is set and otherwise uses your Claude Code login.
 
 ## CLI Commands
 
```

**File**: `evals/README.md` (modified, +2/-0)
```diff
@@ -23,3 +23,5 @@ Run `make eval-snapshot` and commit the updated file in either of these cases:
 The LLM judge and Monte Carlo layers of plugin-eval are experimental. They have not been checked against human labels.
 
 A trace-based eval program is in progress. It follows the method that Hamel Husain and Shreya Shankar teach, which starts with error analysis. People read traces of real Claude Code sessions that use these skills and write down what went wrong. Checks are then written for the failures they find, and an LLM judge is trusted only after it has been checked against human labels.
+
+The traces come from Claude Code subagents that run on the maintainer's Claude plan. Nothing in this repository calls a model API to make them, and the traces stay outside the repository because they contain local file paths.
```

**File**: `evals/prompts/dimensions.yaml` (removed, +0/-55)
```diff
@@ -1,55 +0,0 @@
-# Dimensions for the synthetic prompt set that we run through Claude Code to get
-# traces for error analysis.
-#
-# Generation has two steps. Code in plugins/plugin-eval/src/plugin_eval/traces/prompts.py
-# samples skills across marketplace categories and builds the tuples. Each sampled skill
-# gets three tuples: two should_trigger and one near_miss, each at a different
-# explicitness level. Task shapes are spread evenly over all tuples. Ten off_topic tuples
-# each target a randomly chosen sampled skill and ask for unrelated work. The tuples do
-# not cover every combination of dimension values. A separate LLM call then writes one
-# user message for each tuple.
-# Each dimension targets a failure we expect when a plugin skill should or should not
-# load. Add a dimension only when traces show failures along a new axis.
-#
-# Command:
-#   plugin-eval traces prompts --plugins-dir plugins \
-#     --marketplace .claude-plugin/marketplace.json \
-#     --n-skills 30 --seed 20260926 --out evals/prompts/prompts-v1.jsonl
-
-explicitness:
-  description: Whether the prompt names the topic of the target skill.
-  why: >-
-    Skill descriptions may only match literal topic words. A prompt that describes the
-    problem without naming the topic tests whether the skill is chosen because the task
-    needs it, and not because a keyword matched.
-  values:
-    names_topic: The prompt names the technology or topic directly.
-    describes_problem: The prompt describes the problem or goal without naming the technology or topic.
-    vague: The prompt is brief and underspecified, the way people type quick requests.
-
-routing:
-  description: Whether the target skill should load for the prompt.
-  why: >-
-    should_trigger prompts test recall: the skill must load when the task needs it.
-    near_miss and off_topic prompts test false triggers: the skill must stay quiet when
-    the task only looks related, or when it is unrelated.
-  values:
-    should_trigger: The prompt clearly needs the knowledge the skill provides.
-    near_miss: The prompt is about an adjacent topic that the skill does not cover, so the skill must not fire.
-    off_topic: The prompt is about ordinary software work unrelated to the skill.
-  mix: >-
-    Each sampled skill gets two should_trigger tuples and one near_miss tuple. Ten
-    off_topic tuples each target a randomly chosen sampled skill, so that its plugin is
-    loaded during the run.
-
-task_shape:
-  description: The kind of work the prompt asks for.
-  why: >-
-    A skill can help with one kind of task and be ignored or misused in another. Varying
-    the shape shows whether skills are used for designs, new code, reviews, and
-    explanations alike.
-  values:
-    design: The prompt asks for a design, plan, or recommendation.
-    write_code: The prompt asks for code to be written.
-    review_snippet: The prompt includes a short inline code snippet and asks for a review or fix.
-    explain: The prompt asks for an explanation.
```

**File**: `plugins/plugin-eval/.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 {
   "name": "plugin-eval",
-  "version": "0.1.1",
+  "version": "0.1.2",
   "description": "Static lint for Claude Code plugins and skills, with experimental LLM scoring for skills"
 }
```

---

### Incident Patch 7: `8edbd648` (2026-09-26)
**Commit Message**: feat(plugin-eval): generate synthetic prompts and run isolated skill traces (#734)

* feat(plugin-eval): generate synthetic prompts for skill traces

Add a traces package that builds the synthetic user prompts for trace
generation. Code samples skills across marketplace categories and builds
one tuple per skill and dimension mix. A separate LLM call then writes one
message per tuple, following the generate-synthetic-data method.

The new `plugin-eval traces prompts` command writes the tuples as JSONL.
With --dry-run it writes tuples without calling the API. The dimensions
and the failure each one targets are documented in
evals/prompts/dimensions.yaml.

Claude-Session: https://claude.ai/code/session_012TJthve8fGapk6u7aQg5iG

* fix(plugin-eval): drop cut-off prompts and cap prompt-writing spend

The query writer now returns an empty string when a reply stops at
max_tokens, so render_queries drops and logs it like a refusal. The cap
is raised to 2048 tokens, and effort stays low with thinking left on.

When a retry for a too-similar query comes back empty, the first query
is kept instead of dropping the tuple.

render_queries now adds up spend from each call's token usage at the
clau

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -66,3 +66,6 @@ opencode.json
 
 # Superpowers plugin artifacts (specs/plans are session-local, never committed)
 docs/superpowers/
+
+# plugin-eval traces from `plugin-eval traces run` (large; not committed for now)
+evals/traces/
```

**File**: `evals/prompts/dimensions.yaml` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+# Dimensions for the synthetic prompt set that we run through Claude Code to get
+# traces for error analysis.
+#
+# Generation has two steps. Code in plugins/plugin-eval/src/plugin_eval/traces/prompts.py
+# samples skills across marketplace categories and builds the tuples. Each sampled skill
+# gets three tuples: two should_trigger and one near_miss, each at a different
+# explicitness level. Task shapes are spread evenly over all tuples. Ten off_topic tuples
+# each target a randomly chosen sampled skill and ask for unrelated work. The tuples do
+# not cover every combination of dimension values. A separate LLM call then writes one
+# user message for each tuple.
+# Each dimension targets a failure we expect when a plugin skill should or should not
+# load. Add a dimension only when traces show failures along a new axis.
+#
+# Command:
+#   plugin-eval traces prompts --plugins-dir plugins \
+#     --marketplace .claude-plugin/marketplace.json \
+#     --n-skills 30 --seed 20260926 --out evals/prompts/prompts-v1.jsonl
+
+explicitness:
+  description: Whether the prompt names the topic of the target skill.
+  why: >-
+    Skill descriptions may only match literal topic words. A prompt that describes the
+    problem without naming the topic tests whether the skill is chosen because the task
+    needs it, and not because a keyword matched.
+  values:
+    names_topic: The prompt names the technology or topic directly.
+    describes_problem: The prompt describes the problem or goal without naming the technology or topic.
+    vague: The prompt is brief and underspecified, the way people type quick requests.
+
+routing:
+  description: Whether the target skill should load for the prompt.
+  why: >-
+    should_trigger prompts test recall: the skill must load when the task needs it.
+    near_miss and off_topic prompts test false triggers: the skill must stay quiet when
+    the task only looks related, or when it is unrelated.
+  values:
+    should_trigger: The prompt clearly needs the knowledge the skill provides.
+    near_miss: The prompt is about an adjacent topic that the skill does not cover, so the skill must not fire.
+    off_topic: The prompt is about ordinary software work unrelated to the skill.
+  mix: >-
+    Each sampled skill gets two should_trigger tuples and one near_miss tuple. Ten
+    off_topic tuples each target a randomly chosen sampled skill, so that its plugin is
+    loaded during the run.
+
+task_shape:
+  description: The kind of work the prompt asks for.
+  why: >-
+    A skill can help with one kind of task and be ignored or misused in another. Varying
+    the shape shows whether skills are used for designs, new code, reviews, and
+    explanations alike.
+  values:
+    design: The prompt asks for a design, plan, or recommendation.
+    write_code: The prompt asks for code to be written.
+    review_snippet: The prompt includes a short inline code snippet and asks for a review or fix.
+    explain: The prompt asks for an explanation.
```

**File**: `plugins/plugin-eval/src/plugin_eval/cli.py` (modified, +264/-0)
```diff
@@ -189,3 +189,267 @@ def compare(
             name = da.name.replace("_", " ").title()
             lines.append(f"| {name} | {da.score:.2f} | {db.score:.2f} | {winner} |")
     console.print("\n".join(lines))
+
+
+traces_app = typer.Typer(help="Build prompts and traces for error analysis.")
+app.add_typer(traces_app, name="traces")
+
+
+@traces_app.command("prompts")
+def traces_prompts(
+    plugins_dir: Path = typer.Option(Path("plugins"), help="The repo's plugins directory"),  # noqa: B008
+    marketplace: Path = typer.Option(  # noqa: B008
+        Path(".claude-plugin/marketplace.json"), help="Path to the marketplace.json"
+    ),
+    n_skills: int = typer.Option(30, help="Number of skills to sample"),  # noqa: B008
+    seed: int = typer.Option(20260926, help="Seed for sampling and tuple building"),  # noqa: B008
+    out: Path = typer.Option(..., help="JSONL file to write"),  # noqa: B008
+    max_usd: float = typer.Option(5.0, help="Stop writing before API spend could pass this"),  # noqa: B008
+    dry_run: bool = typer.Option(False, "--dry-run", help="Write tuples without queries"),  # noqa: B008
+) -> None:
+    """Sample skills, build prompt tuples, and write one user message per tuple."""
+    from plugin_eval.traces.prompts import (
+        AnthropicQueryWriter,
+        build_tuples,
+        render_queries,
+        sample_skills,
+    )
+
+    for p in (plugins_dir, marketplace):
+        if not p.exists():
+            console.print(f"[red]Error: Path does not exist: {p}[/red]")
+            raise typer.Exit(code=2)
+    skills = sample_skills(plugins_dir, marketplace, n=n_skills, seed=seed)
+    if not skills:
+        console.print(f"[red]Error: No local skills found under {plugins_dir}[/red]")
+        raise typer.Exit(code=2)
+    tuples = build_tuples(skills, seed=seed)
+    if dry_run:
+        rows = tuples
+    else:
+        rows = render_queries(
+            tuples,
+            skill_text=lambda plugin, skill: (
+                plugins_dir / plugin / "skills" / skill / "SKILL.md"
+            ).read_text(encoding="utf-8"),
+            client=AnthropicQueryWriter(),
+            max_usd=max_usd,
+        )
+    out.parent.mkdir(parents=True, exist_ok=True)
+    out.write_text("".join(row.model_dump_json() + "\n" for row in rows), encoding="utf-8")
+    console.print(f"Wrote {len(rows)} rows for {len(tuples)} tuples to {out}")
+
+
+@traces_app.command("run")
+def traces_run(
+    prompts: Path = typer.Option(..., help="JSONL file of prompt records"),  # noqa: B008
+    out: Path = typer.Option(..., help="Directory for one <id>.json trace per prompt"),  # noqa: B008
+    model: str = typer.Option("claude-opus-5-5", help="Model for the Claude Code sessions"),  # noqa: B008
+    total_usd: float = typer.Option(60.0, help="Stop starting traces past this total spend"),  # noqa: B008
+    per_trace_usd: float = typer.Option(1.5, help="Spend cap for one trace"),  # noqa: B008
+    max_turns: int = typer.Option(12, help="Turn cap for one trace"),  # noqa: B008
+    concurrency: int = typer.Option(3, help="Sessions to run at once"),  # noqa: B008
+    plugins_dir: Path = typer.Option(Path("plugins"), help="The repo's plugins directory"),  # noqa: B008
+    marketplace: Path = typer.Option(  # noqa: B008
+        Path(".claude-plugin/marketplace.json"), help="Path to the marketplace.json"
+    ),
+    seed: int = typer.Option(20260926, help="Seed for choosing distractor plugins"),  # noqa: B008
+    limit: int | None = typer.Option(None, help="Run only the first N prompts"),  # noqa: B008
+    timeout_s: int = typer.Option(600, help="Seconds before one session is stopped"),  # noqa: B008
+    smoke: bool = typer.Option(  # noqa: B008
+        False, "--smoke", help="Run the first should_trigger prompt and check its skill fired"
+    ),
+) -> None:
+    """Run prompts through isolated headless Claude Code sessions and save the traces.
+
+    A resumed run keeps every existing trace in the output directory, including error and
+    timeout traces that were billed at the cap. To retry a trace, delete its .json and
+    .stream.jsonl files.
+    """
+    import os
+    import tempfile
+    from functools import partial
+
+    from plugin_eval.traces import runner
+    from plugin_eval.traces.models import PromptRecord, TraceRecord
+    from plugin_eval.traces.triggering import target_fired
+
+    for p in (prompts, plugins_dir, marketplace):
+        if not p.exists():
+            console.print(f"[red]Error: Path does not exist: {p}[/red]")
+            raise typer.Exit(code=2)
+    for name, source_dir in runner.local_plugin_dirs(marketplace).items():
+        if source_dir != (plugins_dir / name).resolve():
+            console.print(
+                f"[red]Error: {marketplace} places {name} at {source_dir}, but --plugins-dir "
+                f"gives {(plugins_dir / name).resolve()}. Point both at the same repo.[/red]",
+                soft_wrap=True,
+            )
+           
```

**File**: `plugins/plugin-eval/src/plugin_eval/traces/__init__.py` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+"""Synthetic prompts and Claude Code traces for error analysis."""
```

**File**: `plugins/plugin-eval/src/plugin_eval/traces/models.py` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+"""Data models for synthetic trace prompts and the traces they produce."""
+
+from __future__ import annotations
+
+from typing import Literal
+
+from pydantic import BaseModel
+
+Explicitness = Literal["names_topic", "describes_problem", "vague"]
+Routing = Literal["should_trigger", "near_miss", "off_topic"]
+TaskShape = Literal["design", "write_code", "review_snippet", "explain"]
+
+
+class PromptTuple(BaseModel):
+    """One combination of dimension values that defines a test prompt."""
+
+    id: str
+    target_plugin: str
+    target_skill: str
+    explicitness: Explicitness
+    routing: Routing
+    task_shape: TaskShape
+
+
+class PromptRecord(PromptTuple):
+    """A tuple with the user message an LLM wrote for it."""
+
+    query: str
+    generator_model: str
+
+
+class ToolCall(BaseModel):
+    """One tool call in a trace, paired with its result."""
+
+    name: str
+    input_summary: str  # JSON of the input, truncated to 2,000 characters
+    result_summary: str = ""  # tool result text, truncated to 4,000 characters
+    is_error: bool = False
+
+
+class Step(BaseModel):
+    """One assistant action in a trace: a text block or a tool call."""
+
+    kind: Literal["assistant_text", "tool_call"]
+    text: str | None = None
+    tool: ToolCall | None = None
+
+
+class TraceRecord(BaseModel):
+    """One headless Claude Code session run for one prompt.
+
+    skills_available is the init event's skill list as reported, so plugin skills carry
+    their namespace ("plugin:skill"). skills_invoked holds the skill input of each Skill tool
+    call as given, in order, so plugin skills carry their namespace there too. Use
+    triggering.target_fired to tell whether the target fired. contaminated is True when the
+    session saw a skill, tool, plugin, or MCP server that the runner did not load, when a
+    loaded skill was missing, when a hook ran, or when the stream had no init event.
+    contamination_reasons names each cause, for example "unexpected skill: x".
+    """
+
+    prompt: PromptRecord
+    model: str
+    plugins_loaded: list[str]
+    skills_available: list[str] = []
+    skills_invoked: list[str] = []
+    steps: list[Step] = []
+    final_text: str = ""
+    cost_usd: float = 0.0
+    num_turns: int = 0
+    duration_ms: int = 0
+    is_error: bool = False
+    error: str | None = None
+    contaminated: bool = False
+    contamination_reasons: list[str] = []
+    claude_version: str = ""
+    # How far cost_usd went past the per-trace cap. Claude Code checks --max-budget-usd
+    # between turns, so the turn that crosses the cap still completes.
+    over_cap_usd: float = 0.0
+    # The run settings that produced this trace. model above is the id the session
+    # reported, which differs from requested_model when the run used an alias like "opus".
+    # A resumed run compares these with its own settings, and bills an unknown cost at
+    # per_trace_cap_usd. plugins_digest covers the files of the loaded plugins (see
+    # runner.plugins_digest). Traces written before a field existed have its default, and a
+    # default is not compared.
+    requested_model: str = ""
+    seed: int | None = None
+    per_trace_cap_usd: float = 0.0
+    max_turns: int = 0
+    timeout_s: int = 0
+    plugins_digest: str = ""
```

**File**: `plugins/plugin-eval/src/plugin_eval/traces/parse.py` (added, +257/-0)
```diff
@@ -0,0 +1,257 @@
+"""Turn the stream-json output of `claude -p --output-format stream-json` into a TraceRecord.
+
+The stream is one JSON event per line. The events this parser reads are:
+
+- `system` with subtype `init`: the model, the Claude Code version, and the tools, skills,
+  plugins, and MCP servers the session loaded.
+- `assistant`: message content blocks. Text blocks become steps, and `tool_use` blocks
+  become tool calls. Thinking blocks are skipped.
+- `user`: `tool_result` blocks, matched to their tool call by `tool_use_id`.
+- `result`: cost, turn count, duration, the final text, and the error flag.
+- `system` with a subtype such as `hook_started` or `hook_response`: a hook ran.
+
+Every other event type is skipped, and so are lines that are not JSON.
+"""
+
+from __future__ import annotations
+
+import json
+import math
+from collections.abc import Iterable
+from typing import Any
+
+from plugin_eval.traces.models import PromptRecord, Step, ToolCall, TraceRecord
+
+SKILL_TOOL = "Skill"  # the tool Claude Code calls to load a skill
+SKILL_INPUT_FIELD = "skill"  # its input field, e.g. {"skill": "database-design:some-skill"}
+INPUT_CHARS = 2000
+RESULT_CHARS = 4000
+NO_RESULT_ERROR = "no result event"  # the error of a trace whose stream has no result event
+# Claude Code writes system events with these subtypes when a hook runs. The runner passes
+# --include-hook-events so that PreToolUse and PostToolUse hooks show up too.
+HOOK_EVENT_PREFIX = "hook_"
+
+# The only tools a trace session gets, passed to claude with --tools. Every other built-in
+# tool (Bash, WebFetch, WebSearch, Task, Agent, Workflow, and tools such as PushNotification
+# or CronCreate that act outside the session) is left out. An allowlist does not drift when
+# Claude Code adds a tool. With --tools, Claude Code 2.1.283 adds no tool of its own.
+ALLOWED_TOOLS = ("Read", "Glob", "Grep", "Edit", "Write", "NotebookEdit", "Skill")
+
+# Skills that ship with Claude Code 2.1.283 and appear in every session's init event, even
+# with an empty CLAUDE_CONFIG_DIR and no plugins. Taken from the init event of the fixture
+# tests/fixtures/traces/sample-stream.jsonl. They are not contamination. When a new Claude
+# Code version adds a built-in skill, every trace is marked contaminated until the new name
+# is added here, so the change cannot go unnoticed.
+BUILTIN_SKILLS = frozenset(
+    {
+        "batch",
+        "claude-api",
+        "code-review",
+        "dataviz",
+        "debug",
+        "deep-research",
+        "design",
+        "design-sync",
+        "doctor",
+        "fewer-permission-prompts",
+        "loop",
+        "run",
+        "run-skill-generator",
+        "simplify",
+        "update-config",
+        "verify",
+        "workflow-authoring",
+    }
+)
+
+
+def _events(lines: Iterable[str]) -> Iterable[dict[str, Any]]:
+    for line in lines:
+        try:
+            event = json.loads(line)
+        except json.JSONDecodeError:
+            continue
+        if isinstance(event, dict):
+            yield event
+
+
+def _blocks(event: dict[str, Any]) -> list[dict[str, Any]]:
+    message = event.get("message")
+    content = message.get("content") if isinstance(message, dict) else None
+    return [b for b in content if isinstance(b, dict)] if isinstance(content, list) else []
+
+
+def _result_text(content: Any) -> str:
+    if isinstance(content, str):
+        return content
+    if isinstance(content, list):
+        return "\n".join(
+            str(block.get("text", ""))
+            for block in content
+            if isinstance(block, dict) and block.get("type") == "text"
+        )
+    return ""
+
+
+def _strings(value: Any) -> tuple[list[str], bool]:
+    """Return the string entries of an init-event list, and whether anything else was there."""
+    if value is None:
+        return [], False
+    if not isinstance(value, list):
+        return [], True
+    names = [v for v in value if isinstance(v, str)]
+    return names, len(names) != len(value)
+
+
+def _number(value: Any) -> float:
+    """Read a number from the result event, or 0 when it is missing, not a number, or not
+    finite (JSON from Claude Code can carry NaN or Infinity)."""
+    try:
+        number = float(value or 0)
+    except (TypeError, ValueError):
+        return 0.0
+    return number if math.isfinite(number) else 0.0
+
+
+def _subtype(event: dict[str, Any]) -> str:
+    subtype = event.get("subtype")
+    return subtype if isinstance(subtype, str) else ""
+
+
+def _contamination(
+    init: dict[str, Any] | None, plugins_loaded: list[str], expected: set[str]
+) -> list[str]:
+    """List every way the init event differs from what the runner loaded, in both
+    directions: skills, tools, plugins, or MCP servers the runner did not load, and skills of
+    the loaded plugins that the session does not list.
+
+    An entry the parser cannot read (a skill or tool that is not a string, a plugin that is
+    not an 
```

**File**: `plugins/plugin-eval/src/plugin_eval/traces/prompts.py` (added, +316/-0)
```diff
@@ -0,0 +1,316 @@
+"""Build the synthetic user prompts that later runs send through Claude Code.
+
+Generation has two steps, as in the generate-synthetic-data method. Code builds the
+dimension tuples, and then a separate LLM call writes one user message for each tuple.
+The dimensions are documented in evals/prompts/dimensions.yaml.
+"""
+
+from __future__ import annotations
+
+import json
+import logging
+import random
+import re
+from collections import defaultdict
+from collections.abc import Callable
+from itertools import zip_longest
+from pathlib import Path
+from typing import Protocol
+
+from plugin_eval.parser import _split_frontmatter
+from plugin_eval.traces.models import (
+    Explicitness,
+    PromptRecord,
+    PromptTuple,
+    Routing,
+    TaskShape,
+)
+
+logger = logging.getLogger(__name__)
+
+EXPLICITNESS: tuple[Explicitness, ...] = ("names_topic", "describes_problem", "vague")
+TASK_SHAPES: tuple[TaskShape, ...] = ("design", "write_code", "review_snippet", "explain")
+SKILL_ROUTING: tuple[Routing, ...] = ("should_trigger", "should_trigger", "near_miss")
+EXCERPT_CHARS = 1500
+# claude-opus-5 list prices in USD per million tokens, from the claude-api skill. Thinking
+# tokens are billed as output tokens.
+INPUT_USD_PER_MTOK = 5.0
+OUTPUT_USD_PER_MTOK = 25.0
+
+ROUTING_INSTRUCTIONS: dict[str, str] = {
+    "should_trigger": "the message clearly needs the knowledge this skill provides",
+    "near_miss": (
+        "the message is about a closely related topic that this skill does NOT cover; "
+        "a good assistant should not use this skill"
+    ),
+    "off_topic": "the message is about ordinary software work unrelated to this skill's topic",
+}
+EXPLICITNESS_INSTRUCTIONS: dict[str, str] = {
+    "names_topic": "name the technology or topic directly",
+    "describes_problem": "describe the problem or goal without naming the technology or topic",
+    "vague": "be brief and underspecified, the way people type quick requests",
+}
+TASK_SHAPE_INSTRUCTIONS: dict[str, str] = {
+    "design": "ask for a design, plan, or recommendation",
+    "write_code": "ask for code to be written",
+    "review_snippet": "ask for a review or fix of the included snippet",
+    "explain": "ask for an explanation",
+}
+
+QUERY_PROMPT = """\
+We are generating realistic user messages for Claude Code, a coding assistant.
+The user has some plugins installed. One of them provides the skill below.
+
+Skill name: {skill}
+Skill description: {description}
+Skill excerpt:
+{excerpt}
+
+Write one message a developer might type, with these properties:
+- routing: {routing_instruction}
+- explicitness: {explicitness_instruction}
+- task shape: {task_shape_instruction}
+Keep it self-contained: no references to files that do not exist. If the task shape is
+review_snippet, include a short code snippet (under 25 lines) inline in a fenced block.
+Reply with the message only.
+"""
+
+
+class QueryWriter(Protocol):
+    """Anything that turns a query-writing prompt into one user message.
+
+    A writer that calls a paid API should also expose two attributes so render_queries can
+    keep the spend under budget: max_tokens, the output cap of one call, and last_usage,
+    the input and output token counts of its latest call.
+    """
+
+    def write(self, prompt: str) -> str: ...
+
+
+def skill_names(plugin_dir: Path) -> list[str]:
+    """Return the sorted names of skill directories that contain a SKILL.md."""
+    skills_dir = plugin_dir / "skills"
+    if not skills_dir.is_dir():
+        return []
+    return sorted(d.name for d in skills_dir.iterdir() if (d / "SKILL.md").is_file())
+
+
+def sample_skills(
+    plugins_dir: Path, marketplace_json: Path, n: int, seed: int
+) -> list[tuple[str, str]]:
+    """Pick n (plugin, skill) pairs spread across the marketplace categories.
+
+    Categories are visited in a seeded random order, one skill per category per round,
+    until n skills are picked. Within a category the plugins take turns, so one large
+    plugin does not fill the whole share of its category. External plugins, and plugins
+    without a local skills directory, are skipped.
+    """
+    rng = random.Random(seed)
+    entries = json.loads(marketplace_json.read_text(encoding="utf-8"))["plugins"]
+    by_category: dict[str, dict[str, list[str]]] = defaultdict(dict)
+    for entry in entries:
+        if not isinstance(entry.get("source"), str):
+            continue
+        skills = skill_names(plugins_dir / entry["name"])
+        if skills:
+            by_category[entry.get("category", "uncategorized")][entry["name"]] = skills
+
+    categories = sorted(by_category)
+    rng.shuffle(categories)
+    queues: dict[str, list[tuple[str, str]]] = {}
+    for category in categories:
+        plugins = sorted(by_category[category])
+        rng.shuffle(plugins)
+        per_plugin = []
+        for plugin in plugins:
+            skills = list(by_category[category][plugin])
+            rng.shuffle(s
```

**File**: `plugins/plugin-eval/src/plugin_eval/traces/runner.py` (added, +468/-0)
```diff
@@ -0,0 +1,468 @@
+"""Run each prompt through an isolated, headless Claude Code session and record the trace.
+
+Each session gets a fresh temporary CLAUDE_CONFIG_DIR and a fresh working directory, so the
+maintainer's own skills, plugins, settings, and CLAUDE.md never reach it. Plugins load only
+through --plugin-dir. The parser marks a trace contaminated if anything else shows up in the
+session's init event. Each session's raw stream is kept next to its trace as
+<id>.stream.jsonl, because the trace keeps only summaries (for example, the text a skill
+loads is only in the raw stream).
+"""
+
+from __future__ import annotations
+
+import hashlib
+import json
+import logging
+import os
+import random
+import re
+import subprocess
+import tempfile
+import threading
+from collections.abc import Callable, Iterable
+from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
+from pathlib import Path
+from typing import Any
+
+from plugin_eval.traces.models import PromptRecord, TraceRecord
+from plugin_eval.traces.parse import ALLOWED_TOOLS, NO_RESULT_ERROR, parse_stream
+from plugin_eval.traces.prompts import skill_names
+
+logger = logging.getLogger(__name__)
+
+README_TEXT = "Scratch project for a Claude Code session.\n"
+# Prompt ids become file names in the output directory, so they must be plain names.
+PROMPT_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
+# plugins_digest skips hidden entries other than these, and cache directories, so a local
+# .venv or .pytest_cache does not count as plugin content.
+DIGEST_HIDDEN_KEEP = frozenset({".claude-plugin", ".mcp.json"})
+DIGEST_SKIP = frozenset({"__pycache__", "node_modules"})
+STREAM_SUFFIX = ".stream.jsonl"  # the raw stream file; it never matches the *.json traces
+# Plugin hooks run shell commands on every tool call (protect-mcp's run npx), and the init
+# event does not list them. Flag settings keep the config dir empty. A probe on Claude Code
+# 2.1.283 showed this stops a plugin's hooks; the parser flags any hook event that still runs.
+SESSION_SETTINGS = json.dumps({"disableAllHooks": True})
+# The only variables a trace session inherits. Anything else in the caller's environment
+# can carry the maintainer's Claude Code configuration: a parent Claude Code session exports
+# its settings.json "env" block (for example ENABLE_TOOL_SEARCH) and its own CLAUDE_* values
+# (for example CLAUDE_EFFORT), and a child session would read them.
+ENV_ALLOWLIST = (
+    "PATH",
+    "HOME",
+    "USER",
+    "LOGNAME",
+    "SHELL",
+    "TMPDIR",
+    "LANG",
+    "LC_ALL",
+    "LC_CTYPE",
+    "TERM",
+    "ANTHROPIC_API_KEY",
+)
+
+
+def choose_plugins(
+    target_plugin: str,
+    marketplace_json: Path,
+    seed: int,
+    same_category: int = 2,
+    random_other: int = 2,
+) -> list[str]:
+    """Return the target plugin plus distractors, in a seeded random order.
+
+    Distractors are local marketplace plugins with at least one skill, since a plugin with
+    no skills competes with nothing: same_category from the target's category and
+    random_other from the other categories. A local source is resolved against the
+    marketplace root, the directory that holds .claude-plugin/. The order is shuffled so the
+    target does not always load first. Pass a seed derived from the prompt id (see
+    trace_seed) to get a different but repeatable set for each prompt.
+    """
+    entries = json.loads(marketplace_json.read_text(encoding="utf-8"))["plugins"]
+    local = {
+        e["name"]: e.get("category", "uncategorized")
+        for e in entries
+        if isinstance(e.get("source"), str)
+    }
+    if target_plugin not in local:
+        raise ValueError(f"{target_plugin} is not a local plugin in {marketplace_json}")
+    dirs = local_plugin_dirs(marketplace_json)
+    candidates = {n: c for n, c in local.items() if n != target_plugin and skill_names(dirs[n])}
+    category = local[target_plugin]
+    same = sorted(n for n, c in candidates.items() if c == category)
+    other = sorted(n for n, c in candidates.items() if c != category)
+    rng = random.Random(seed)
+    picked = [
+        target_plugin,
+        *rng.sample(same, min(same_category, len(same))),
+        *rng.sample(other, min(random_other, len(other))),
+    ]
+    rng.shuffle(picked)
+    return picked
+
+
+def local_plugin_dirs(marketplace_json: Path) -> dict[str, Path]:
+    """Map each local marketplace plugin to its directory, resolved against the marketplace
+    root (the directory that holds .claude-plugin/), as Claude Code resolves it."""
+    root = marketplace_json.parent.parent
+    entries = json.loads(marketplace_json.read_text(encoding="utf-8"))["plugins"]
+    return {
+        e["name"]: (root / e["source"]).resolve()
+        for e in entries
+        if isinstance(e.get("source"), str)
+    }
+
+
+def check_prompt_ids(records: Iterable[PromptRecord]) -> None:
+    """Raise ValueError unless every prompt id is a plain file name and
```

---

### Incident Patch 8: `d6de37e7` (2026-09-26)
**Commit Message**: fix(pptx-deck-creation): drop the agents entry that stops the plugin from loading (#736)

plugin.json listed "agents": ["./agents"]. Claude Code 2.1.283 rejects a
directory there ("agents.0: Invalid input"), so the plugin failed
validation and none of its five skills or its agent loaded. Claude Code
finds agents/ on its own, so the entry is removed and the version goes to
1.0.1.

Claude-Session: https://claude.ai/code/session_012TJthve8fGapk6u7aQg5iG

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -1277,7 +1277,7 @@
       "name": "pptx-deck-creation",
       "source": "./plugins/pptx-deck-creation",
       "description": "Create production-ready, editable PowerPoint decks through a spec-first, coordinate-explicit workflow with read-only reference analysis and quality gates.",
-      "version": "1.0.0",
+      "version": "1.0.1",
       "author": {
         "name": "kimtth"
       },
```

**File**: `.cursor-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -763,7 +763,7 @@
     {
       "name": "pptx-deck-creation",
       "source": "./plugins/pptx-deck-creation",
-      "version": "1.0.0",
+      "version": "1.0.1",
       "description": "Create production-ready, editable PowerPoint decks through a spec-first, coordinate-explicit workflow with read-only reference analysis and quality gates.",
       "author": {
         "name": "kimtth",
```

**File**: `.cursor-plugin/plugins/pptx-deck-creation.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "pptx-deck-creation",
   "displayName": "Pptx Deck Creation",
-  "version": "1.0.0",
+  "version": "1.0.1",
   "description": "Create production-ready, editable PowerPoint decks through a spec-first, coordinate-explicit workflow with read-only reference analysis and quality gates.",
   "author": {
     "name": "kimtth",
```

**File**: `plugins/pptx-deck-creation/.claude-plugin/plugin.json` (modified, +1/-2)
```diff
@@ -1,13 +1,12 @@
 {
   "name": "pptx-deck-creation",
-  "version": "1.0.0",
+  "version": "1.0.1",
   "description": "Create production-ready, editable PowerPoint decks through a spec-first, coordinate-explicit workflow with read-only reference analysis and quality gates.",
   "author": { "name": "kimtth" },
   "repository": "https://github.com/kimtth/agent-pptify-kit",
   "license": "MIT",
   "category": "creative",
   "keywords": ["powerpoint", "pptx", "presentations", "slide-decks", "deck-generation", "slide-design"],
-  "agents": ["./agents"],
   "skills": [
     "./skills/pptx-deck-context",
     "./skills/pptx-slide-specification",
```

**File**: `plugins/pptx-deck-creation/.codex-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "pptx-deck-creation",
-  "version": "1.0.0",
+  "version": "1.0.1",
   "description": "Create production-ready, editable PowerPoint decks through a spec-first, coordinate-explicit workflow with read-only reference analysis and quality gates.",
   "skills": "./skills/",
   "author": {
```

---

### Incident Patch 9: `8b957cde` (2026-09-26)
**Commit Message**: fix(audit-trails): make the protect-mcp audit trail work with Claude Code hooks and protect-mcp 0.7.4 (#732)

* fix(signed-audit-trails): wire the recipe hooks through stdin like protect-mcp

Step 1 of the recipe told users to write hooks that pass --tool "$TOOL_NAME"
and --input "$TOOL_INPUT" to protect-mcp. Claude Code sends the hook event as
JSON on stdin and sets neither variable, so protect-mcp got an empty tool
name and a policy denied every call, including Read.

Step 1 now installs the protect-mcp plugin, whose evaluate.sh and sign.sh read
the payload from stdin and call protect-mcp 0.7.4, as #706 did. The hook
configuration and what each script passes moved to references/hook-wiring.md,
so SKILL.md is smaller than before. protect-mcp 0.7.4 does not create a
signing key, so Step 1 now creates ./protect-mcp.key with init. The pitfalls
about hook quoting, key rotation, and a missing policy now match the scripts.
The Cedar examples and the verification steps are unchanged. Plugin version
0.1.2 -> 0.1.3.

Claude-Session: https://claude.ai/code/session_012TJthve8fGapk6u7aQg5iG

* fix(audit-trails): correct the key, gitignore, and verify steps for protect-mcp 0.7.4

The recipe an

**File**: `.claude-plugin/marketplace.json` (modified, +4/-4)
```diff
@@ -1103,7 +1103,7 @@
       "name": "block-no-verify",
       "source": "./plugins/block-no-verify",
       "description": "PreToolUse hook that prevents AI agents from using --no-verify, --no-gpg-sign, and other bypass flags that skip git hooks",
-      "version": "1.0.1",
+      "version": "1.0.2",
       "author": {
         "name": "cskwork"
       },
@@ -1159,7 +1159,7 @@
       "name": "protect-mcp",
       "source": "./plugins/protect-mcp",
       "description": "Cedar policy enforcement + Ed25519 signed receipts for every Claude Code tool call. First cryptographic governance plugin \u2014 decisions are policy-gated before they run and every decision produces a tamper-evident receipt verifiable offline.",
-      "version": "0.1.3",
+      "version": "0.1.4",
       "author": {
         "name": "Tom Farley",
         "email": "tommy@scopeblind.com",
@@ -1182,7 +1182,7 @@
       "name": "signed-audit-trails",
       "source": "./plugins/signed-audit-trails",
       "description": "Teaching skill: cookbook-style walkthrough for signed audit trails on every Claude Code tool call. Cedar policy, Ed25519 receipts, offline verification, CI/CD integration, SLSA composition. Pairs with the protect-mcp runtime plugin.",
-      "version": "0.1.2",
+      "version": "0.1.3",
       "author": {
         "name": "Tom Farley",
         "email": "tommy@scopeblind.com",
@@ -1206,7 +1206,7 @@
       "name": "review-agent-governance",
       "source": "./plugins/review-agent-governance",
       "description": "Require a human approval signal before an AI agent can post PR reviews, comments, merges, or writes to CI configuration. Joins protect-mcp and signed-audit-trails in the governance category; composes with protect-mcp for runtime enforcement.",
-      "version": "0.1.3",
+      "version": "0.1.4",
       "author": {
         "name": "Tom Farley",
         "email": "tommy@scopeblind.com",
```

**File**: `.cursor-plugin/marketplace.json` (modified, +4/-4)
```diff
@@ -136,7 +136,7 @@
     {
       "name": "block-no-verify",
       "source": "./plugins/block-no-verify",
-      "version": "1.0.1",
+      "version": "1.0.2",
       "description": "PreToolUse hook that prevents AI agents from using --no-verify, --no-gpg-sign, and other bypass flags that skip git hooks",
       "author": {
         "name": "cskwork",
@@ -775,7 +775,7 @@
     {
       "name": "protect-mcp",
       "source": "./plugins/protect-mcp",
-      "version": "0.1.3",
+      "version": "0.1.4",
       "description": "Cedar policy enforcement + Ed25519 signed receipts for every Claude Code tool call. First cryptographic governance plugin \u2014 receipts independently verifiable offline.",
       "author": {
         "name": "Tom Farley",
@@ -819,7 +819,7 @@
     {
       "name": "review-agent-governance",
       "source": "./plugins/review-agent-governance",
-      "version": "0.1.3",
+      "version": "0.1.4",
       "description": "Require a human approval signal before an AI agent can post PR reviews, comments, merges, or writes to CI config. Cedar-gated, receipt-signed, designed for the Hermes-style failure mode where a review bot posts without oversight.",
       "author": {
         "name": "Tom Farley",
@@ -907,7 +907,7 @@
     {
       "name": "signed-audit-trails",
       "source": "./plugins/signed-audit-trails",
-      "version": "0.1.2",
+      "version": "0.1.3",
       "description": "Teaching skill: signed audit trails for Claude Code tool calls. Cookbook-style walkthrough of Cedar-gated tool calls with Ed25519 receipts, offline verification, and CI/CD integration. Pairs with the protect-mcp plugin.",
       "author": {
         "name": "Tom Farley",
```

**File**: `.cursor-plugin/plugins/block-no-verify.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "block-no-verify",
   "displayName": "Block No Verify",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "description": "PreToolUse hook that prevents AI agents from using --no-verify, --no-gpg-sign, and other bypass flags that skip git hooks",
   "author": {
     "name": "cskwork",
```

**File**: `.cursor-plugin/plugins/protect-mcp.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "protect-mcp",
   "displayName": "Protect Mcp",
-  "version": "0.1.3",
+  "version": "0.1.4",
   "description": "Cedar policy enforcement + Ed25519 signed receipts for every Claude Code tool call. First cryptographic governance plugin \u2014 receipts independently verifiable offline.",
   "author": {
     "name": "Tom Farley",
```

**File**: `.cursor-plugin/plugins/review-agent-governance.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "review-agent-governance",
   "displayName": "Review Agent Governance",
-  "version": "0.1.3",
+  "version": "0.1.4",
   "description": "Require a human approval signal before an AI agent can post PR reviews, comments, merges, or writes to CI config. Cedar-gated, receipt-signed, designed for the Hermes-style failure mode where a review bot posts without oversight.",
   "author": {
     "name": "Tom Farley",
```

**File**: `.cursor-plugin/plugins/signed-audit-trails.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "signed-audit-trails",
   "displayName": "Signed Audit Trails",
-  "version": "0.1.2",
+  "version": "0.1.3",
   "description": "Teaching skill: signed audit trails for Claude Code tool calls. Cookbook-style walkthrough of Cedar-gated tool calls with Ed25519 receipts, offline verification, and CI/CD integration. Pairs with the protect-mcp plugin.",
   "author": {
     "name": "Tom Farley",
```

**File**: `plugins/block-no-verify/.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "block-no-verify",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "description": "PreToolUse hook that prevents AI agents from using --no-verify, --no-gpg-sign, and other bypass flags that skip git hooks",
   "author": {
     "name": "cskwork"
```

**File**: `plugins/block-no-verify/.codex-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "block-no-verify",
-  "version": "1.0.1",
+  "version": "1.0.2",
   "description": "PreToolUse hook that prevents AI agents from using --no-verify, --no-gpg-sign, and other bypass flags that skip git hooks",
   "skills": "./skills/",
   "author": {
```

---

### Incident Patch 10: `6161de4d` (2026-09-26)
**Commit Message**: fix(review-agent-governance): make the default Cedar policy deny under protect-mcp 0.7 (#728)

* fix(review-agent-governance): evaluate Cedar policy in protect-mcp 0.7 entity shape

* fix(review-agent-governance): close common bypasses in the default policy

The prefix patterns from the 0.7 rewrite (`like "gh pr merge*"`) missed any
command that did not start with the gh call: `cd x && gh pr merge 1`,
`env gh ...`, `GH_TOKEN=x gh ...`, `/usr/bin/gh ...`, `gh -R o/r pr merge 1`,
and `git -C . push origin main`. The rules now use substring patterns with a
gap before the command group (`*gh *pr merge*`). The subcommand must still
follow its group directly, so reads such as `gh pr view 42 --comments` and
`gh pr list --state closed` pass.

Other rule changes:
- `gh api` is gated when it writes (graphql, a method other than GET, or
  -f/-F/--field/--raw-field/--input), replacing the blanket `gh api repos*`
  rule that also blocked reads.
- Protected branches match as whole words (`origin main`, `HEAD:main`,
  `refs/heads/main`), so `maintenance` and `fix-release-notes` pass. A bare
  `git push` stays allowed; the evaluator cannot see the upstream.
- Force pushes (--force, --force-with-le

**File**: `.claude-plugin/marketplace.json` (modified, +3/-3)
```diff
@@ -1159,7 +1159,7 @@
       "name": "protect-mcp",
       "source": "./plugins/protect-mcp",
       "description": "Cedar policy enforcement + Ed25519 signed receipts for every Claude Code tool call. First cryptographic governance plugin \u2014 decisions are policy-gated before they run and every decision produces a tamper-evident receipt verifiable offline.",
-      "version": "0.1.2",
+      "version": "0.1.3",
       "author": {
         "name": "Tom Farley",
         "email": "tommy@scopeblind.com",
@@ -1182,7 +1182,7 @@
       "name": "signed-audit-trails",
       "source": "./plugins/signed-audit-trails",
       "description": "Teaching skill: cookbook-style walkthrough for signed audit trails on every Claude Code tool call. Cedar policy, Ed25519 receipts, offline verification, CI/CD integration, SLSA composition. Pairs with the protect-mcp runtime plugin.",
-      "version": "0.1.1",
+      "version": "0.1.2",
       "author": {
         "name": "Tom Farley",
         "email": "tommy@scopeblind.com",
@@ -1206,7 +1206,7 @@
       "name": "review-agent-governance",
       "source": "./plugins/review-agent-governance",
       "description": "Require a human approval signal before an AI agent can post PR reviews, comments, merges, or writes to CI configuration. Joins protect-mcp and signed-audit-trails in the governance category; composes with protect-mcp for runtime enforcement.",
-      "version": "0.1.2",
+      "version": "0.1.3",
       "author": {
         "name": "Tom Farley",
         "email": "tommy@scopeblind.com",
```

**File**: `.cursor-plugin/marketplace.json` (modified, +3/-3)
```diff
@@ -775,7 +775,7 @@
     {
       "name": "protect-mcp",
       "source": "./plugins/protect-mcp",
-      "version": "0.1.2",
+      "version": "0.1.3",
       "description": "Cedar policy enforcement + Ed25519 signed receipts for every Claude Code tool call. First cryptographic governance plugin \u2014 receipts independently verifiable offline.",
       "author": {
         "name": "Tom Farley",
@@ -819,7 +819,7 @@
     {
       "name": "review-agent-governance",
       "source": "./plugins/review-agent-governance",
-      "version": "0.1.2",
+      "version": "0.1.3",
       "description": "Require a human approval signal before an AI agent can post PR reviews, comments, merges, or writes to CI config. Cedar-gated, receipt-signed, designed for the Hermes-style failure mode where a review bot posts without oversight.",
       "author": {
         "name": "Tom Farley",
@@ -907,7 +907,7 @@
     {
       "name": "signed-audit-trails",
       "source": "./plugins/signed-audit-trails",
-      "version": "0.1.1",
+      "version": "0.1.2",
       "description": "Teaching skill: signed audit trails for Claude Code tool calls. Cookbook-style walkthrough of Cedar-gated tool calls with Ed25519 receipts, offline verification, and CI/CD integration. Pairs with the protect-mcp plugin.",
       "author": {
         "name": "Tom Farley",
```

**File**: `.cursor-plugin/plugins/protect-mcp.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "protect-mcp",
   "displayName": "Protect Mcp",
-  "version": "0.1.2",
+  "version": "0.1.3",
   "description": "Cedar policy enforcement + Ed25519 signed receipts for every Claude Code tool call. First cryptographic governance plugin \u2014 receipts independently verifiable offline.",
   "author": {
     "name": "Tom Farley",
```

**File**: `.cursor-plugin/plugins/review-agent-governance.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "review-agent-governance",
   "displayName": "Review Agent Governance",
-  "version": "0.1.2",
+  "version": "0.1.3",
   "description": "Require a human approval signal before an AI agent can post PR reviews, comments, merges, or writes to CI config. Cedar-gated, receipt-signed, designed for the Hermes-style failure mode where a review bot posts without oversight.",
   "author": {
     "name": "Tom Farley",
```

**File**: `.cursor-plugin/plugins/signed-audit-trails.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "signed-audit-trails",
   "displayName": "Signed Audit Trails",
-  "version": "0.1.1",
+  "version": "0.1.2",
   "description": "Teaching skill: signed audit trails for Claude Code tool calls. Cookbook-style walkthrough of Cedar-gated tool calls with Ed25519 receipts, offline verification, and CI/CD integration. Pairs with the protect-mcp plugin.",
   "author": {
     "name": "Tom Farley",
```

**File**: `plugins/protect-mcp/.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "protect-mcp",
-  "version": "0.1.2",
+  "version": "0.1.3",
   "description": "Cedar policy enforcement + Ed25519 signed receipts for every Claude Code tool call. First cryptographic governance plugin \u2014 receipts independently verifiable offline.",
   "author": {
     "name": "Tom Farley",
```

**File**: `plugins/protect-mcp/.codex-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "protect-mcp",
-  "version": "0.1.2",
+  "version": "0.1.3",
   "description": "Cedar policy enforcement + Ed25519 signed receipts for every Claude Code tool call. First cryptographic governance plugin \u2014 receipts independently verifiable offline.",
   "skills": "./skills/",
   "author": {
```

**File**: `plugins/protect-mcp/README.md` (modified, +32/-9)
```diff
@@ -91,29 +91,52 @@ plugins/protect-mcp/
 ## Example Cedar Policy
 
 ```cedar
-// Allow all read operations
+// Allow read-only tools. One rule can cover several tools: leave `resource`
+// open in the scope and compare it in `when`.
 permit (
     principal,
-    action in [Action::"Read", Action::"Glob", Action::"Grep"],
+    action == Action::"MCP::Tool::call",
     resource
-);
+) when {
+    resource == Tool::"Read" || resource == Tool::"Glob" || resource == Tool::"Grep"
+};
 
-// Writes only within the project directory
+// Writes and edits only inside the project. Claude Code passes absolute
+// paths, so match your project's path, not "./*". `like` matches the raw
+// string, so it is not a path containment check: the forbid rejects `..`.
 permit (
     principal,
-    action in [Action::"Write", Action::"Edit"],
+    action == Action::"MCP::Tool::call",
     resource
 ) when {
-    context.path_starts_with == "./"
+    (resource == Tool::"Write" || resource == Tool::"Edit") &&
+    context has input && context.input has file_path &&
+    context.input.file_path like "/path/to/project/*"
 };
 
-// Never allow destructive shell commands
 forbid (
     principal,
-    action == Action::"Bash",
+    action == Action::"MCP::Tool::call",
     resource
 ) when {
-    context.command_pattern in ["rm -rf", "dd if=", "mkfs", "shred"]
+    (resource == Tool::"Write" || resource == Tool::"Edit") &&
+    context has input && context.input has file_path &&
+    (context.input.file_path like "*/../*" || context.input.file_path like "*/..")
+};
+
+// Never allow destructive shell commands. Substring patterns also catch
+// `cd x && rm -rf y`, but matching shell commands as strings is best-effort:
+// a determined rewording can still get through.
+forbid (
+    principal,
+    action == Action::"MCP::Tool::call",
+    resource == Tool::"Bash"
+) when {
+    context has input && context.input has command &&
+    (context.input.command like "*rm -rf*" ||
+     context.input.command like "*dd if=*" ||
+     context.input.command like "*mkfs*" ||
+     context.input.command like "*shred*")
 };
 ```
 
```

---

### Incident Patch 11: `76ac708f` (2026-09-25)
**Commit Message**: fix(commands): give every command an imperative description (#726)

* fix(commands): give every command an imperative description

35 command files had no frontmatter, so `claude plugin validate --strict`
failed with "No frontmatter block found" on the plugins that ship them.
Each one now has a one-line `description:` written from the command body.
Four commands reuse the wording of an identical command that already had
one (refactor-clean, tech-debt, error-analysis, error-trace).

The six descriptions added in #719 started with "Use when", which is the
trigger style for skills. They now use the imperative style that every
other command description uses, so the two identical context-restore
copies read the same.

No command body changes and no version bumps.

Claude-Session: https://claude.ai/code/session_012TJthve8fGapk6u7aQg5iG

* fix(commands): match the descriptions of duplicated commands

dependency-management/deps-audit and debugging-toolkit/smart-debug have
the same bodies as the copies in codebase-cleanup and error-diagnostics,
which already had descriptions. Both now reuse that wording, so each
duplicated command reads the same wherever it ships.

Claude-Session: https://c

**File**: `plugins/accessibility-compliance/commands/accessibility-audit.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Audit web accessibility for WCAG compliance with automated axe-core tests, keyboard and screen reader checks, and remediation guidance
+---
+
 # Accessibility Audit and Testing
 
 You are an accessibility expert specializing in WCAG compliance, inclusive design, and assistive technology compatibility. Conduct comprehensive audits, identify barriers, provide remediation guidance, and ensure digital products are accessible to all users.
```

**File**: `plugins/agent-orchestration/commands/improve-agent.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Improve an existing agent through performance baselines, prompt engineering, A/B testing, and staged rollout
+---
+
 # Agent Performance Optimization Workflow
 
 Systematic improvement of existing agents through performance analysis, prompt engineering, and continuous iteration.
```

**File**: `plugins/agent-orchestration/commands/multi-agent-optimize.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Optimize multi-agent system performance through profiling, context window tuning, coordination efficiency, and cost and latency tradeoffs
+---
+
 # Multi-Agent Optimization Toolkit
 
 ## Role: AI-Powered Multi-Agent Performance Engineering Specialist
```

**File**: `plugins/api-testing-observability/commands/api-mock.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Build realistic API mock servers with request stubbing, dynamic data, test scenarios, and contract testing
+---
+
 # API Mocking Framework
 
 You are an API mocking expert specializing in creating realistic mock services for development, testing, and demonstration purposes. Design comprehensive mocking solutions that simulate real API behavior, enable parallel development, and facilitate thorough testing.
```

**File**: `plugins/cicd-automation/commands/workflow-automate.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Automate CI/CD pipelines, releases, and development workflows with GitHub Actions, pre-commit hooks, and infrastructure automation
+---
+
 # Workflow Automation
 
 You are a workflow automation expert specializing in creating efficient CI/CD pipelines, GitHub Actions workflows, and automated development processes. Design and implement automation that reduces manual work, improves consistency, and accelerates delivery while maintaining quality and security.
```

**File**: `plugins/code-documentation/commands/code-explain.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Explain complex code, algorithms, and design patterns with step-by-step breakdowns, visual diagrams, and interactive examples
+---
+
 # Code Explanation and Analysis
 
 You are a code education expert specializing in explaining complex code through clear narratives, visual diagrams, and step-by-step breakdowns. Transform difficult concepts into understandable explanations for developers at all levels.
```

**File**: `plugins/code-documentation/commands/doc-generate.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Generate API, architecture, code, and user documentation from a codebase and automate keeping it current
+---
+
 # Automated Documentation Generation
 
 You are a documentation expert specializing in creating comprehensive, maintainable documentation from code. Generate API docs, architecture diagrams, user guides, and technical references using AI-powered analysis and industry best practices.
```

**File**: `plugins/code-refactoring/commands/context-restore.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Restore saved project context and decisions to resume a session
+---
+
 # Context Restoration: Advanced Semantic Memory Rehydration
 
 ## Role Statement
```

---

### Incident Patch 12: `1a7e9235` (2026-09-25)
**Commit Message**: fix(garden): ignore model tier and named variants in agent divergence (#724)

* fix(garden): ignore model tier and named variants in agent divergence

The AGENT_BODY_DIVERGENT check treated two kinds of intended difference
as drift, which left nine standing warnings on main (#643).

- `model:` is a per-plugin deployment choice, so it is dropped from the
  comparison along with `name:`. Every other frontmatter field and the
  body still count.
- The workflow-specific variants in backend-development
  (security-auditor, test-automator, performance-engineer) and
  incident-response (code-reviewer, debugger, error-detective,
  test-automator) are named in INTENTIONAL_AGENT_VARIANTS and skipped.
  The allowlist is keyed by (plugin, agent) pair, so other copies of the
  same agent are still compared. Keeping the names avoids changing
  generated IDs and `subagent_type` callers.

The warning's fix text now points at the allowlist instead of asking
for a rename. No agent files change.

Closes #643

Claude-Session: https://claude.ai/code/session_012TJthve8fGapk6u7aQg5iG

* fix(garden): read allowlisted variants and flag stale allowlist pairs

Review follow-ups on the agent-divergence allowl

**File**: `tools/doc_gardener.py` (modified, +42/-3)
```diff
@@ -72,6 +72,24 @@
 BOM = "\ufeff"
 BODY_LEADING_BLANKS_RE = re.compile(r"\A(?:[ \t]*\n)+")
 
+# Intentional variants, keyed by (plugin, agent file stem). These are workflow-specific
+# versions that share a name with the general agent shipped in other plugins:
+# backend-development's short feature-development trio, which sits beside the full
+# specialists, and incident-response's production-incident versions. They differ on
+# purpose, so they are left out of the divergence comparison instead of being renamed,
+# which would change their generated IDs and every `subagent_type` that calls them.
+INTENTIONAL_AGENT_VARIANTS = frozenset(
+    {
+        ("backend-development", "security-auditor"),
+        ("backend-development", "test-automator"),
+        ("backend-development", "performance-engineer"),
+        ("incident-response", "code-reviewer"),
+        ("incident-response", "debugger"),
+        ("incident-response", "error-detective"),
+        ("incident-response", "test-automator"),
+    }
+)
+
 
 # ── Findings ─────────────────────────────────────────────────────────────────
 
@@ -504,12 +522,13 @@ def canonical_frontmatter_value(value: object) -> object:
 
 
 def normalized_agent_text(text: str) -> str:
-    """Render an agent as its frontmatter fields minus `name`, plus its body.
+    """Render an agent as its frontmatter fields minus `name` and `model`, plus its body.
 
     Uses the same frontmatter parser the adapters use, so a copy is judged on its
     fields and body rather than on exact delimiter formatting. That keeps CRLF files,
     a closing `---` at end of file, and a trailing space after a delimiter from
     reading as drift. A `name:` line in the body is body content and still counts.
+    `model` is a per-plugin deployment choice, so a tier difference alone is not drift.
     """
     text = text.lstrip(BOM)
     trimmed = text.lstrip()
@@ -519,6 +538,7 @@ def normalized_agent_text(text: str) -> str:
         text = trimmed
     fields, body = parse_frontmatter(text)
     fields.pop("name", None)
+    fields.pop("model", None)
     rendered = "\n".join(
         f"{key}: {canonical_frontmatter_value(fields[key])!r}" for key in sorted(fields)
     )
@@ -601,11 +621,30 @@ def check_agent_divergence(report: Report) -> None:
     Plugins are installed individually, so a shared agent is genuinely copied into
     each plugin that offers it. A verbatim copy is therefore expected and is not
     reported at all. Only copies whose bodies have drifted apart are findings.
+    Copies named in INTENTIONAL_AGENT_VARIANTS are skipped, and a pair whose agent
+    file no longer exists is reported so the allowlist cannot go stale.
     """
     if not PLUGINS_DIR.is_dir():
         return
+    for plugin, agent in sorted(INTENTIONAL_AGENT_VARIANTS):
+        variant_path = PLUGINS_DIR / plugin / "agents" / f"{agent}.md"
+        if not variant_path.is_file():
+            report.add(
+                kind="STALE_AGENT_VARIANT",
+                severity="warning",
+                path=variant_path,
+                message=f"INTENTIONAL_AGENT_VARIANTS names ({plugin}, {agent}), "
+                "but this agent file does not exist",
+                fix="Drop the pair from INTENTIONAL_AGENT_VARIANTS in tools/doc_gardener.py.",
+            )
+
     by_filename: dict[str, list[Path]] = defaultdict(list)
     for agent_path in sorted(PLUGINS_DIR.glob("*/agents/*.md")):
+        if (agent_path.parent.parent.name, agent_path.stem) in INTENTIONAL_AGENT_VARIANTS:
+            # Left out of the comparison, but still read so an unreadable variant is
+            # reported: this check is where agent sources get their UTF-8 check.
+            read_text_or_none(agent_path, report)
+            continue
         by_filename[agent_path.name].append(agent_path)
 
     for filename, paths in sorted(by_filename.items()):
@@ -632,8 +671,8 @@ def check_agent_divergence(report: Report) -> None:
                     f"versions: {variants}"
                 ),
                 fix=(
-                    "Reconcile the copies, or rename the intentional variants so the "
-                    "difference is visible in the agent name rather than hidden in the body."
+                    "Reconcile the copies. If one is an intentional variant, add its "
+                    "(plugin, agent) pair to INTENTIONAL_AGENT_VARIANTS in tools/doc_gardener.py."
                 ),
             )
 
```

**File**: `tools/tests/test_doc_gardener.py` (modified, +117/-4)
```diff
@@ -576,7 +576,18 @@ def _write_agent(tmp_path: Path, plugin: str, filename: str, body: str) -> None:
     (agents_dir / filename).write_text(f"---\nname: {plugin}-{filename[:-3]}\n---\n{body}")
 
 
+def _allow_variants(monkeypatch: pytest.MonkeyPatch, *pairs: tuple[str, str]) -> None:
+    import tools.doc_gardener as dg
+
+    monkeypatch.setattr(dg, "INTENTIONAL_AGENT_VARIANTS", frozenset(pairs))
+
+
 class TestAgentDivergence:
+    @pytest.fixture(autouse=True)
+    def _empty_allowlist(self, monkeypatch: pytest.MonkeyPatch) -> None:
+        """Start every test from an empty allowlist so none depends on the real pairs."""
+        _allow_variants(monkeypatch)
+
     def test_single_copy_no_finding(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
         _patch_paths(monkeypatch, tmp_path)
         _write_agent(tmp_path, "alpha", "reviewer.md", "Review carefully.\n")
@@ -791,22 +802,124 @@ def test_delimiter_formatting_is_not_drift(
         check_agent_divergence(report)
         assert report.findings == [], f"{label} was treated as drift"
 
+    def test_model_difference_is_not_drift(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
+        """`model:` is a per-plugin deployment choice, so a tier difference alone is not drift."""
+        _patch_paths(monkeypatch, tmp_path)
+        for plugin, model in (("alpha", "opus"), ("beta", "sonnet"), ("gamma", "inherit")):
+            agents_dir = tmp_path / "plugins" / plugin / "agents"
+            agents_dir.mkdir(parents=True, exist_ok=True)
+            (agents_dir / "reviewer.md").write_text(
+                f"---\nname: {plugin}-reviewer\nmodel: {model}\n---\nReview.\n"
+            )
+
+        report = Report()
+        check_agent_divergence(report)
+        assert report.findings == []
+
+    @pytest.mark.parametrize(
+        ("field", "alpha_value", "beta_value"),
+        [
+            ("description", "Reviews code.", "Reviews docs."),
+            ("tools", "[Read, Write]", "[Read]"),
+        ],
+    )
     def test_frontmatter_field_change_is_drift(
-        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+        self,
+        field: str,
+        alpha_value: str,
+        beta_value: str,
+        tmp_path: Path,
+        monkeypatch: pytest.MonkeyPatch,
     ):
-        """A real frontmatter difference other than `name` still counts."""
+        """A frontmatter difference other than `name` and `model` still counts."""
         _patch_paths(monkeypatch, tmp_path)
-        for plugin, model in (("alpha", "opus"), ("beta", "sonnet")):
+        for plugin, model, value in (
+            ("alpha", "opus", alpha_value),
+            ("beta", "sonnet", beta_value),
+        ):
             agents_dir = tmp_path / "plugins" / plugin / "agents"
             agents_dir.mkdir(parents=True, exist_ok=True)
             (agents_dir / "reviewer.md").write_text(
-                f"---\nname: {plugin}-reviewer\nmodel: {model}\n---\nReview.\n"
+                f"---\nname: {plugin}-reviewer\nmodel: {model}\n{field}: {value}\n---\nReview.\n"
             )
 
         report = Report()
         check_agent_divergence(report)
         assert [f.kind for f in report.findings] == ["AGENT_BODY_DIVERGENT"]
 
+    def test_allowlisted_variant_is_not_reported(
+        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+    ):
+        """A named intentional variant is left out; the remaining copies still match."""
+        _patch_paths(monkeypatch, tmp_path)
+        _allow_variants(monkeypatch, ("feature", "reviewer"))
+        _write_agent(tmp_path, "feature", "reviewer.md", "Feature checks.\n")
+        _write_agent(tmp_path, "alpha", "reviewer.md", "Full review.\n")
+        _write_agent(tmp_path, "beta", "reviewer.md", "Full review.\n")
+
+        report = Report()
+        check_agent_divergence(report)
+        assert report.findings == []
+
+    def test_non_allowlisted_divergence_is_still_reported(
+        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+    ):
+        """The allowlist names (plugin, agent) pairs, not whole plugins or agent names.
+
+        `incident` is on the list for another agent, but not for this one, so its
+        divergent copy is still reported. The allowlisted `feature` copy is left out
+        of the count rather than hiding the whole group.
+        """
+        _patch_paths(monkeypatch, tmp_path)
+        _allow_variants(monkeypatch, ("feature", "reviewer"), ("incident", "linter"))
+        _write_agent(tmp_path, "feature", "reviewer.md", "Feature checks.\n")
+        _write_agent(tmp_path, "incident", "reviewer.md", "Incident checks.\n")
+        _write_agent(tmp_path, "incident", "linter.md", "Lint.\n")
+        _write_agent(tmp_path, "alpha", "reviewer.md", "Full review.\n")
+
+        report = Report()
+        check_agent_divergence(report)
+        assert [f.kind for f in report.findings] == ["AGENT_BODY_DIVERGENT"]
+        finding = report.findings[0]
+        assert "2 copies 
```

---

### Incident Patch 13: `62c4d9fa` (2026-09-25)
**Commit Message**: fix: describe six Claude plugin commands (#719)

**File**: `plugins/context-management/commands/context-restore.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Use when restoring saved project context and decisions to resume a session.
+---
+
 # Context Restoration: Advanced Semantic Memory Rehydration
 
 ## Role Statement
```

**File**: `plugins/context-management/commands/context-save.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Use when saving project context, decisions, and progress for a later session.
+---
+
 # Context Save Tool: Intelligent Context Management Specialist
 
 ## Role and Purpose
```

**File**: `plugins/debugging-toolkit/commands/smart-debug.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Use when investigating an issue with debugging tools, observability data, and root cause analysis.
+---
+
 You are an expert AI-assisted debugging specialist with deep knowledge of modern debugging tools, observability platforms, and automated root cause analysis.
 
 ## Context
```

**File**: `plugins/dependency-management/commands/deps-audit.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Use when auditing dependencies for vulnerabilities, license compliance, and maintenance risks.
+---
+
 # Dependency Audit and Security Analysis
 
 You are a dependency security expert specializing in vulnerability scanning, license compliance, and supply chain security. Analyze project dependencies for known vulnerabilities, licensing issues, outdated packages, and provide actionable remediation strategies.
```

**File**: `plugins/security-compliance/commands/compliance-check.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Use when reviewing software compliance controls, regulatory requirements, and audit readiness.
+---
+
 # Regulatory Compliance Check
 
 You are a compliance expert specializing in regulatory requirements for software systems including GDPR, HIPAA, SOC2, PCI-DSS, and other industry standards. Perform comprehensive compliance audits and provide implementation guidance for achieving and maintaining compliance.
```

**File**: `plugins/security-scanning/commands/security-dependencies.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+---
+description: Use when scanning dependencies for vulnerabilities and generating supply chain security evidence.
+---
+
 # Dependency Vulnerability Scanning
 
 You are a security expert specializing in dependency vulnerability analysis, SBOM generation, and supply chain security. Scan project dependencies across multiple ecosystems to identify vulnerabilities, assess risks, and provide automated remediation strategies.
```

---

### Incident Patch 14: `6b63235b` (2026-09-25)
**Commit Message**: fix(plugin-eval): count each fenced code block once, not once per fence (#710)

* fix(plugin-eval): count each fenced code block once, not once per fence

parse_skill built code_block_count from re.findall(r"```(\w*)", content),
which matches the opening fence and the closing fence of every block, so
the count it stored was twice the number of code blocks in the file. The
static layer reads that number against thresholds the rubric states in
code blocks, so a skill with one block collected the orchestration bonus
documented for two, and three blocks reached the top structural tier the
code reserves for five. A line-based scan now tracks whether a fence is
open and counts only the openers, which also handles an unclosed fence
and a shorter fence nested inside a longer one. The set of
code_block_languages, which is the only form the scorer reads, is
unchanged on all 183 skills in the repo; the ordered list moves on two of
them, in both cases to what CommonMark renders.

* fix(plugin-eval): match tilde fences and ignore fence-like content lines

_CODE_FENCE_PATTERN only saw runs of backticks, so a tilde fenced block was
never counted and its language was never collected. It also close

**File**: `plugins/plugin-eval/src/plugin_eval/parser.py` (modified, +42/-3)
```diff
@@ -12,6 +12,7 @@
 _CROSS_REFERENCE_PATTERN = re.compile(
     r"(?<![\w-])((?:skill|skills|sub-skills)/[a-z0-9-]+(?:/[a-z0-9-]+)*)"
 )
+_CODE_FENCE_PATTERN = re.compile(r"^\s*(?:>\s*)*(`{3,}|~{3,})(\w*)(.*)")
 
 
 @dataclass
@@ -73,8 +74,7 @@ def parse_skill(skill_dir: Path) -> ParsedSkill:
     h2_count = sum(1 for line in lines if re.match(r"^## ", line))
     h3_count = sum(1 for line in lines if re.match(r"^### ", line))
 
-    code_blocks = re.findall(r"```(\w*)", content)
-    code_block_languages = [lang for lang in code_blocks if lang]
+    code_block_count, code_block_languages = _count_code_blocks(content)
 
     lower_body = body.lower()
     has_examples = bool(re.search(r"(## example|### example|## usage)", lower_body))
@@ -106,7 +106,7 @@ def parse_skill(skill_dir: Path) -> ParsedSkill:
         line_count=len(content.split("\n")),
         h2_count=h2_count,
         h3_count=h3_count,
-        code_block_count=len(code_blocks),
+        code_block_count=code_block_count,
         code_block_languages=code_block_languages,
         has_examples=has_examples,
         has_troubleshooting=has_troubleshooting,
@@ -185,6 +185,45 @@ def parse_plugin(plugin_dir: Path) -> ParsedPlugin:
     )
 
 
+def _count_code_blocks(content: str) -> tuple[int, list[str]]:
+    """Count fenced code blocks and collect the languages on their opening fences.
+
+    Every fenced block is delimited twice, so counting each fence run would report
+    double the number of blocks. Track the fence that opened the current block
+    instead and count only the openers. Markdown fences run on backticks or on
+    tildes, and a block closes only on a run of the same character at least as
+    long as its opener with nothing but whitespace after it, so a fence-like line
+    carrying other text is part of the block rather than the end of it.
+    """
+    count = 0
+    languages: list[str] = []
+    open_fence = ""
+
+    for line in content.split("\n"):
+        match = _CODE_FENCE_PATTERN.match(line)
+        if match is None:
+            continue
+        fence, language, trailing = match.group(1), match.group(2), match.group(3)
+        if open_fence:
+            if (
+                fence[0] == open_fence[0]
+                and len(fence) >= len(open_fence)
+                and not language
+                and not trailing.strip()
+            ):
+                open_fence = ""
+            continue
+        if fence[0] == "`" and "`" in trailing:
+            # CommonMark keeps backticks out of the info string of a backtick fence.
+            continue
+        open_fence = fence
+        count += 1
+        if language:
+            languages.append(language)
+
+    return count, languages
+
+
 def _split_frontmatter(content: str) -> tuple[dict, str]:
     """Split YAML frontmatter from markdown body."""
     if not content.startswith("---"):
```

**File**: `plugins/plugin-eval/tests/test_parser.py` (modified, +73/-0)
```diff
@@ -44,6 +44,79 @@ def test_parse_cross_references_preserves_nested_paths(self, tmp_path: Path):
         assert skill.cross_references == ["sub-skills/child", "sibling"]
 
 
+class TestCodeBlockCounting:
+    def _skill(self, tmp_path: Path, body: str, name: str = "counted") -> Path:
+        skill_dir = tmp_path / name
+        skill_dir.mkdir()
+        (skill_dir / "SKILL.md").write_text(
+            "---\n"
+            f"name: {name}\n"
+            'description: "Use when counting fenced code blocks."\n'
+            "---\n\n"
+            "# Counted\n\n" + body
+        )
+        return skill_dir
+
+    def test_each_fenced_block_counts_once(self, tmp_path: Path):
+        body = "\n\n".join(["```python\nprint('x')\n```"] * 3)
+        skill = parse_skill(self._skill(tmp_path, body))
+        assert skill.code_block_count == 3
+        assert skill.code_block_languages == ["python", "python", "python"]
+
+    def test_languages_come_from_opening_fences(self, tmp_path: Path):
+        body = "```bash\nls\n```\n\n```yaml\nkey: value\n```\n"
+        skill = parse_skill(self._skill(tmp_path, body))
+        assert skill.code_block_count == 2
+        assert skill.code_block_languages == ["bash", "yaml"]
+
+    def test_unclosed_fence_still_counts_as_a_block(self, tmp_path: Path):
+        body = "```python\nprint('x')\n```\n\n```bash\nls\n"
+        skill = parse_skill(self._skill(tmp_path, body))
+        assert skill.code_block_count == 2
+        assert skill.code_block_languages == ["python", "bash"]
+
+    def test_shorter_fence_inside_a_longer_one_is_not_a_block(self, tmp_path: Path):
+        body = "````markdown\n```python\nprint('x')\n```\n````\n"
+        skill = parse_skill(self._skill(tmp_path, body))
+        assert skill.code_block_count == 1
+        assert skill.code_block_languages == ["markdown"]
+
+    def test_fence_inside_a_blockquote_counts(self, tmp_path: Path):
+        body = "> ```bash\n> ls\n> ```\n"
+        skill = parse_skill(self._skill(tmp_path, body))
+        assert skill.code_block_count == 1
+        assert skill.code_block_languages == ["bash"]
+
+    def test_prose_without_fences_counts_nothing(self, tmp_path: Path):
+        skill = parse_skill(self._skill(tmp_path, "Just prose about ``inline code``.\n"))
+        assert skill.code_block_count == 0
+        assert skill.code_block_languages == []
+
+    def test_tilde_fenced_block_counts_once_with_its_language(self, tmp_path: Path):
+        body = "~~~python\nprint('x')\n~~~\n"
+        skill = parse_skill(self._skill(tmp_path, body))
+        assert skill.code_block_count == 1
+        assert skill.code_block_languages == ["python"]
+
+    def test_tilde_run_inside_a_backtick_block_does_not_close_it(self, tmp_path: Path):
+        body = "```markdown\n~~~\nstill inside\n~~~\n```\n\n```bash\nls\n```\n"
+        skill = parse_skill(self._skill(tmp_path, body))
+        assert skill.code_block_count == 2
+        assert skill.code_block_languages == ["markdown", "bash"]
+
+    def test_fence_run_with_trailing_text_does_not_close_a_block(self, tmp_path: Path):
+        body = "```\n``` text\n```\n"
+        skill = parse_skill(self._skill(tmp_path, body))
+        assert skill.code_block_count == 1
+        assert skill.code_block_languages == []
+
+    def test_closing_fence_with_trailing_whitespace_still_closes(self, tmp_path: Path):
+        body = "```python\nprint('x')\n```   \n\n```bash\nls\n```\n"
+        skill = parse_skill(self._skill(tmp_path, body))
+        assert skill.code_block_count == 2
+        assert skill.code_block_languages == ["python", "bash"]
+
+
 class TestParseAgent:
     def test_parse_valid_agent(self, sample_plugin_dir: Path):
         agent_path = sample_plugin_dir / "agents" / "test-agent.md"
```

**File**: `plugins/plugin-eval/tests/test_static.py` (modified, +31/-0)
```diff
@@ -69,6 +69,37 @@ def test_nested_cross_reference_resolves_from_skill_directory(self, tmp_path: Pa
         assert "DEAD_CROSS_REF" not in [ap.flag for ap in result.anti_patterns]
 
 
+def _make_skill_with_code_blocks(tmp_path: Path, blocks: int, name: str) -> Path:
+    skill_dir = tmp_path / name
+    skill_dir.mkdir()
+    body = "\n\n".join(["```python\nprint('x')\n```"] * blocks)
+    (skill_dir / "SKILL.md").write_text(
+        f'---\nname: {name}\ndescription: "Use when checking code block thresholds."\n---\n\n'
+        "# Skill\n\n## Usage\n\nRun it.\n\n" + body + "\n\n## Output format\n\nReturns JSON.\n"
+    )
+    return skill_dir
+
+
+class TestCodeBlockThresholds:
+    """The rubric states these thresholds in code blocks, not fence delimiters."""
+
+    def test_two_blocks_earn_the_orchestration_bonus_that_one_does_not(self, tmp_path: Path):
+        analyzer = StaticAnalyzer()
+        one = analyzer.analyze_skill(_make_skill_with_code_blocks(tmp_path, 1, "one-block"))
+        two = analyzer.analyze_skill(_make_skill_with_code_blocks(tmp_path, 2, "two-blocks"))
+        one_score = one.sub_scores["orchestration_wiring"]
+        two_score = two.sub_scores["orchestration_wiring"]
+        assert two_score - one_score == pytest.approx(0.05)
+
+    def test_five_blocks_reach_a_tier_three_blocks_do_not(self, tmp_path: Path):
+        analyzer = StaticAnalyzer()
+        three = analyzer.analyze_skill(_make_skill_with_code_blocks(tmp_path, 3, "three-blocks"))
+        five = analyzer.analyze_skill(_make_skill_with_code_blocks(tmp_path, 5, "five-blocks"))
+        three_score = three.sub_scores["structural_completeness"]
+        five_score = five.sub_scores["structural_completeness"]
+        assert five_score - three_score == pytest.approx(0.05)
+
+
 class TestTriggerPattern:
     """Regression coverage for the broadened trigger-phrase matcher.
 
```

---

### Incident Patch 15: `4236bb91` (2026-09-13)
**Commit Message**: ci: rebuild the Claude Code review workflow from scratch (#708)

Pins anthropics/claude-code-action to the v1.0.223 release commit (the old pin
was from May), moves the review model to claude-opus-5, adds a concurrency
group so superseded runs stop, uses a sticky summary comment, and rewrites the
review prompt with the current harness list, the generated-versus-committed
tree rules, and no hard-coded component counts. The header explains the two
things that make this check look broken: the action refuses to run when a PR
edits this file, and the Bun directory-mismatch message is noise.

Claude-Session: https://claude.ai/code/session_01DZazzWVyb8MxPCuLC1w5Qo

**File**: `.github/workflows/claude-code-review.yml` (modified, +100/-105)
```diff
@@ -1,11 +1,28 @@
+# Automated PR review by Claude Code.
+#
+# Rebuilt from scratch on 2026-09-13 on the current claude-code-action release.
+# Two things to know when this check is red:
+# 1. The action refuses to run when the PR's copy of this file differs from the
+#    copy on main. A PR that edits this workflow therefore fails this check until
+#    it is merged. That is the action's own safeguard, not a bug in the PR.
+# 2. The Bun message "Internal error: directory mismatch ... You don't need to do
+#    anything" in the log is noise from the action's runtime and is not the cause
+#    of a failure.
+
 name: Claude Code Review
 
 on:
   pull_request:
     types: [opened, synchronize, ready_for_review, reopened]
 
+concurrency:
+  group: claude-review-${{ github.event.pull_request.number }}
+  cancel-in-progress: true
+
 jobs:
   claude-review:
+    # Same-repo, non-draft, human-authored PRs only. Fork PRs cannot read the
+    # OAuth secret, and dependabot bumps are reviewed by CI alone.
     if: |
       github.event.pull_request.draft == false &&
       github.actor != 'dependabot[bot]' &&
@@ -26,120 +43,98 @@ jobs:
           persist-credentials: false
 
       - name: Run Claude Code Review
-        id: claude-review
-        uses: anthropics/claude-code-action@4481e6d3c7bbb88db2a928ca3444c536f589c7c1  # v1
+        uses: anthropics/claude-code-action@9cdae7f0d995e3ba7c33f226087fdf82a59cd520  # v1.0.223
         with:
           claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
           track_progress: true
+          use_sticky_comment: true
 
           prompt: |
             REPO: ${{ github.repository }}
             PR NUMBER: ${{ github.event.pull_request.number }}
 
-            You are reviewing a PR for claude-agents — a multi-harness
-            agentic plugin marketplace (Claude Code, Codex CLI, Cursor,
-            OpenCode, Antigravity CLI, Pi) with 92+ plugins, 202+ agents, 181+
-            skills, and 105+ commands. The source of truth is Markdown
-            under `plugins/`; per-harness artifacts under `.codex/`,
-            `.cursor-plugin/`, `.cursor/rules/`, `.opencode/`,
-            `.antigravity/`, and `.pi/` are generated by `make generate HARNESS=<name>`
-            and are gitignored.
-
-            Read `AGENTS.md` at the repo root (canonical context) before
-            starting. Consult `docs/authoring.md` for plugin / agent /
-            skill frontmatter shapes, `docs/harnesses.md` for per-harness
-            capability deltas, and `docs/plugins.md` for the catalog.
-
-            ## Review checklist
-
-            1. **Source-of-truth invariant** — Only `plugins/`,
-               `.claude-plugin/marketplace.json`, `docs/`, `tools/`, and
-               top-level Markdown (`AGENTS.md`, `CLAUDE.md`,
-               `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`) should
-               be hand-edited. Flag any change under `.codex/`,
-               `.cursor-plugin/`, `.cursor/rules/`, `.opencode/`,
-               `.antigravity/`, or `.pi/` — those are generated artifacts and must
-               not be committed by hand.
-
-            2. **Plugin / agent / skill frontmatter** — Every agent under
-               `plugins/*/agents/*.md` needs `name:`, `description:`, and
-               a `model:` tier. Every skill under
-               `plugins/*/skills/*/SKILL.md` needs `name:` and
-               `description:`. Plugin directory names must be lowercase,
-               hyphen-separated, and must NOT contain `__` (that is the
-               adapter namespace separator — see `docs/authoring.md`).
-
-            3. **Cross-harness portability** — Content should work across
-               all six harnesses (Claude Code, Codex CLI, Cursor, OpenCode,
-               Antigravity CLI, Pi) unless explicitly marked Claude-Code-
-               only in `CLAUDE.md`. Watch for hard dependencies on
-               Claude-Code-only primitives (`TodoWrite`, the `Task` /
-               `Agent` spawn tool, per-agent `tools:` frontmatter) without
-               a documented fallback. Locked agents (`tools: []`) get
-               special-cased by the OpenCode adapter — preserve that
-               contract.
-
-            4. **Codex 8 KB skill body cap** — Skill bodies in
-               `plugins/*/skills/*/SKILL.md` should fit under ~8 KB after
-               adapter transpilation; overflow belongs in
-               `references/details.md`. `make garden` flags oversize
-               skills; if a new or edited skill is borderline, suggest
-               splitting before merge.
-
-            5. **Canonical context sync** — `AGENTS.md` is the single
-               source of truth; `CLAUDE.md` is a symlink to it. If the two
-               diverge in this PR, call it out. Per OpenAI's
-               harness-engineering practice, `AGENTS.md` must stay under
-               ~150 lines — detail belongs in `docs/`.
-
-            6. **Quality gates*
```

#### Recent Merged Pull Requests:
- **PR #753** (2026-10-04): fix(skills): use local conversion and safer setup examples (@wshobson)
- **PR #752** (2026-10-04): fix(codex): publish only native packages with source skills (@wshobson)
- **PR #751** (2026-10-04): docs: describe the marketplace across supported harnesses (@wshobson)
- **PR #749** (2026-10-04): docs: refresh plugin setup and harness capabilities (@wshobson)
- **PR #747** (closed): Claude/python plugin etl assets dmxbqt (@shaneslo)
- **PR #746** (2026-10-04): deps(yt-design-extractor): bump urllib3 from 2.7.0 to 2.8.0 in /tools/yt-design-extractor (@dependabot[bot])
- **PR #745** (2026-10-04): deps(plugin-eval): update PyJWT to 2.15.1 (@dependabot[bot])
- **PR #743** (2026-09-29): fix(skills): remove dangling Reference lines and check them in the gardener (@wshobson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
