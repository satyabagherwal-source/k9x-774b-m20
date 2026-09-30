# Forensic Learning Record (Deep Inspection): wshobson/agents

> **Canonical Artifact**: `07_PROJECT_LEARNING/wshobson-agents-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wshobson/agents](https://github.com/wshobson/agents))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:53:51.326Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wshobson/agents`
- **Description**: Multi-harness agentic plugin marketplace for Claude Code, Codex, Cursor, OpenCode, GitHub Copilot, Google Antigravity, and Pi
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 40112 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

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
            'improvement': abs(metrics_a['avg_accuracy'] - metrics_b['avg
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
    outp
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

        # Split into measured vs unmeasured dime
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

### Incident Patch 1: `156b7a5e` (2026-09-29)
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

---

### Incident Patch 2: `51b6e0b5` (2026-09-28)
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

---

### Incident Patch 3: `7c83b809` (2026-09-28)
**Commit Message**: fix(gardener): validate generated YAML frontmatter (#711)

* fix(gardener): validate generated YAML frontmatter

* fix(gardener): handle leading blank frontmatter

* docs(gardener): document context budget check

* fix(gardener): require column-zero closing delimiter

* test(gardener): cover frontmatter selector CLI

* fix(gardener): include the Pi output in the frontmatter YAML check

---------

Co-authored-by: Seth Hobson <wshobson@gmail.com>

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
+        assert "INVALID_GENERATED_FRONT
```

---

### Incident Patch 4: `9b15b34b` (2026-09-26)
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

---

### Incident Patch 5: `8edbd648` (2026-09-26)
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
+    A resumed run keeps every existing trace in the output direct
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

---

### Incident Patch 6: `d6de37e7` (2026-09-26)
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

### Incident Patch 7: `8b957cde` (2026-09-26)
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

---

### Incident Patch 8: `6161de4d` (2026-09-26)
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

---

### Incident Patch 9: `76ac708f` (2026-09-25)
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

---

### Incident Patch 10: `1a7e9235` (2026-09-25)
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
                     f"versions
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
+        self, tmp_path: Path, monkeypatch: pyt
```

#### Recent Merged Pull Requests:
- **PR #743** (2026-09-29): fix(skills): remove dangling Reference lines and check them in the gardener (@wshobson)
- **PR #741** (2026-09-28): chore(hol-guard): move the pin to upstream main and stop promoting it in the README (@wshobson)
- **PR #739** (2026-09-28): deps(plugin-eval): bump the python-minor-and-patch group in /plugins/plugin-eval with 3 updates (@dependabot[bot])
- **PR #737** (2026-09-26): chore(plugin-eval): remove the trace harness and the API prompt writer (@wshobson)
- **PR #736** (2026-09-26): fix(pptx-deck-creation): drop the agents entry that stops the plugin from loading (@wshobson)
- **PR #735** (2026-09-28): fix(antigravity): update plugin's config dir for Antigravity & some r… (@jarvisbot01)
- **PR #734** (2026-09-26): feat(plugin-eval): generate synthetic prompts and run isolated skill traces (@wshobson)
- **PR #733** (2026-09-26): feat(plugin-eval): make the docs match the code and snapshot static scores (@wshobson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
