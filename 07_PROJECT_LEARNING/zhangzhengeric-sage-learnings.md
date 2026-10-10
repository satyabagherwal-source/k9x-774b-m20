> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zhangzhengeric-sage-learnings.md`  
> **Source**: github ([https://github.com/ZHangZHengEric/Sage](https://github.com/ZHangZHengEric/Sage))  
> **Source Version**: `ac0f83bc`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-10T11:55:09.815Z  
> **Learning ID**: `learn-github-zhangzhengeric-sage-mv2c7pfb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): ZHangZHengEric/Sage

> **Canonical Artifact**: `07_PROJECT_LEARNING/zhangzhengeric-sage-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ZHangZHengEric/Sage](https://github.com/ZHangZHengEric/Sage))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-10T11:55:09.801Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ZHangZHengEric/Sage`
- **Description**: Multi-Agent System Framework For Complex Tasks
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1210 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/skills/skill-creator/scripts/run_loop.py`
```
#!/usr/bin/env python3
"""Run the eval + improve loop until all pass or max iterations reached.

Combines run_eval.py and improve_description.py in a loop, tracking history
and returning the best description found. Supports train/test split to prevent
overfitting.
"""

import argparse
import json
import random
import sys
import tempfile
import time
import webbrowser
from pathlib import Path

from scripts.generate_report import generate_html
from scripts.improve_description import improve_description
from scripts.run_eval import find_project_root, run_eval
from scripts.utils import parse_skill_md


def split_eval_set(
    eval_set: list[dict], holdout: float, seed: int = 42
) -> tuple[list[dict], list[dict]]:
    """Split eval set into train and test sets, stratified by should_trigger."""
    random.seed(seed)

    # Separate by should_trigger
    trigger = [e for e in eval_set if e["should_trigger"]]
    no_trigger = [e for e in eval_set if not e["should_trigger"]]

    # Shuffle each group
    random.shuffle(trigger)
    random.shuffle(no_trigger)

    # Calculate split points
    n_trigger_test = max(1, int(len(trigger) * holdout))
    n_no_trigger_test = max(1, int(len(no_trigger) * holdout))

    # Split
    test_set = trigger[:n_trigger_test] + no_trigger[:n_no_trigger_test]
    train_set = trigger[n_trigger_test:] + no_trigger[n_no_trigger_test:]

    return train_set, test_set


def run_loop(
    eval_set: list[dict],
    skill_path: Path,
    description_override: str | None,
    num_workers: int,
    timeout: int,
    max_iterations: int,
    runs_per_query: int,
    trigger_threshold: float,
    holdout: float,
    model: str,
    verbose: bool,
    live_report_path: Path | None = None,
    log_dir: Path | None = None,
) -> dict:
    """Run the eval + improvement loop."""
    project_root = find_project_root()
    name, original_description, content = parse_skill_md(skill_path)
    current_description = description_override or original_description

    # Split into train/test if holdout > 0
    if holdout > 0:
        train_set, test_set = split_eval_set(eval_set, holdout)
        if verbose:
            print(
                f"Split: {len(train_set)} train, {len(test_set)} test (holdout={holdout})",
                file=sys.stderr,
            )
    else:
        train_set = eval_set
        test_set = []

    history = []
    exit_reason = "unknown"

    for iteration in range(1, max_iterations + 1):
        if verbose:
            print(f"\n{'=' * 60}", file=sys.stderr)
            print(f"Iteration {iteration}/{max_iterations}", file=sys.stderr)
            print(f"Description: {current_description}", file=sys.stderr)
            print(f"{'=' * 60}", file=sys.stderr)

        # Evaluate train + test together in one batch for parallelism
        all_queries = train_set + test_set
        t0 = time.time()
        all_results = run_eval(
            eval_set=all_queries,
            skill_name=name,
            description=current_description,
            num_workers=num_workers,
            timeout=timeout,
            project_root=project_root,
            runs_per_query=runs_per_query,
            trigger_threshold=trigger_threshold,
            model=model,
        )
        eval_elapsed = time.time() - t0

        # Split results back into train/test by matching queries
        train_queries_set = {q["query"] for q in train_set}
        train_result_list = [
            r for r in all_results["results"] if r["query"] in train_queries_set
        ]
        test_result_list = [
            r for r in all_results["results"] if r["query"] not in train_queries_set
        ]

        train_passed = sum(1 for r in train_result_list if r["pass"])
        train_total = len(train_result_list)
        train_summary = {
            "passed": train_passed,
            "failed": train_total - train_passed,
            "total": train_total,
        }
        train_results = {"results": train_result_list, "summary": train_summary}

        if test_set:
            test_passed = sum(1 for r in test_result_list if r["pass"])
            test_total = len(test_result_list)
            test_summary = {
                "passed": test_passed,
                "failed": test_total - test_passed,
                "total": test_total,
            }
            test_results = {"results": test_result_list, "summary": test_summary}
        else:
            test_results = None
            test_summary = None

        history.append(
            {
                "iteration": iteration,
                "description": current_description,
                "train_passed": train_summary["passed"],
                "train_failed": train_summary["failed"],
                "train_total": train_summary["total"],
                "train_results": train_results["results"],
                "test_passed": test_summary["passed"] if test_summary else None,
                "test_failed": test_summary["failed"] if test_summary else None,
                "test_total": test_summary["total"] if test_summary else None,
                "test_results": test_results["results"] if test_results else None,
                # For backward compat with report generator
                "passed": train_summary["passed"],
                "failed": train_summary["failed"],
                "total": train_summary["total"],
                "results": train_results["results"],
            }
        )

        # Write live report if path provided
        if live_report_path:
            partial_output = {
                "original_description": original_description,
                "best_description": current_description,
                "best_score": "in progress",
                "iterations_run": len(history),
                "holdout": holdout,
                "train_size": len(train_set),
                "test_size": len(test_set),
                "history": history,
            }
            live_report_path.write_text(
                generate_html(partial_output, auto_refresh=True, skill_name=name)
            )

        if verbose:

            def print_eval_stats(label, results, elapsed):
                pos = [r for r in results if r["should_trigger"]]
                neg = [r for r in results if not r["should_trigger"]]
                tp = sum(r["triggers"] for r in pos)
                pos_runs = sum(r["runs"] for r in pos)
                fn = pos_runs - tp
                fp = sum(r["triggers"] for r in neg)
                neg_runs = sum(r["runs"] for r in neg)
                tn = neg_runs - fp
                total = tp + tn + fp + fn
                precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
                recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
                accuracy = (tp + tn) / total if total > 0 else 0.0
                print(
                    f"{label}: {tp + tn}/{total} correct, precision={precision:.0%} recall={recall:.0%} accuracy={accuracy:.0%} ({elapsed:.1f}s)",
                    file=sys.stderr,
                )
                for r in results:
                    status = "PASS" if r["pass"] else "FAIL"
                    rate_str = f"{r['triggers']}/{r['runs']}"
                    print(
                        f"  [{status}] rate={rate_str} expected={r['should_trigger']}: {r['query'][:60]}",
                        file=sys.stderr,
                    )

            print_eval_stats("Train", train_results["results"], eval_elapsed)
            if test_summary:
                print_eval_stats("Test ", test_results["results"], 0)

        if train_summary["failed"] == 0:
            exit_reason = f"all_passed (iteration {iteration})"
            if verbose:
                print(
                    f"\nAll train queries passed on iteration {iteration}!",
                    file=sys.stderr,
                )
            break

        if iteration == max_iterations:
            exit_reason = f"max_iterations ({max_iterations})"
            if verbose:
                print(f"\nMax iterations reached ({max_iterations}).", file=sys.stderr)
            break

        # Improve the description based on train results
        if verbose:
            print("\nImproving description...", file=sys.stderr)

        t0 = time.time()
        # Strip test scores from history so improvement model can't see them
        blinded_history = [
            {k: v for k, v in h.items() if not k.startswith("test_")} for h in history
        ]
        new_description = improve_description(
            skill_name=name,
            skill_content=content,
            current_description=current_description,
            eval_results=train_results,
            history=blinded_history,
            model=model,
            log_dir=log_dir,
            iteration=iteration,
        )
        improve_elapsed = time.time() - t0

        if verbose:
            print(
                f"Proposed ({improve_elapsed:.1f}s): {new_description}", file=sys.stderr
            )

        current_description = new_description

    # Find the best iteration by TEST score (or train if no test set)
    if test_set:
        best = max(history, key=lambda h: h["test_passed"] or 0)
        best_score = f"{best['test_passed']}/{best['test_total']}"
    else:
        best = max(history, key=lambda h: h["train_passed"])
        best_score = f"{best['train_passed']}/{best['train_total']}"

    if verbose:
        print(f"\nExit reason: {exit_reason}", file=sys.stderr)
        print(
            f"Best score: {best_score} (iteration {best['iteration']})", file=sys.stderr
        )

    return {
        "exit_reason": exit_reason,
        "original_description": original_description,
        "best_description": best["description"],
        "best_score": best_score,
        "best_train_score": f"{best['train_passed']}/{best['train_total']}",
        "best_test_score": f"{best['test_passed']}/{best['test_total']}"
        if test_set
        else None,
      
```

### Core Architecture Module: `app/skills/skill-creator/scripts/utils.py`
```
"""Shared utilities for skill-creator scripts."""

from pathlib import Path


def parse_skill_md(skill_path: Path) -> tuple[str, str, str]:
    """Parse a SKILL.md file, returning (name, description, full_content)."""
    content = (skill_path / "SKILL.md").read_text()
    lines = content.split("\n")

    if lines[0].strip() != "---":
        raise ValueError("SKILL.md missing frontmatter (no opening ---)")

    end_idx = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        raise ValueError("SKILL.md missing frontmatter (no closing ---)")

    name = ""
    description = ""
    frontmatter_lines = lines[1:end_idx]
    i = 0
    while i < len(frontmatter_lines):
        line = frontmatter_lines[i]
        if line.startswith("name:"):
            name = line[len("name:") :].strip().strip('"').strip("'")
        elif line.startswith("description:"):
            value = line[len("description:") :].strip()
            # Handle YAML multiline indicators (>, |, >-, |-)
            if value in (">", "|", ">-", "|-"):
                continuation_lines: list[str] = []
                i += 1
                while i < len(frontmatter_lines) and (
                    frontmatter_lines[i].startswith("  ")
                    or frontmatter_lines[i].startswith("\t")
                ):
                    continuation_lines.append(frontmatter_lines[i].strip())
                    i += 1
                description = " ".join(continuation_lines)
                continue
            else:
                description = value.strip('"').strip("'")
        i += 1

    return name, description, content

```

### Core Architecture Module: `app/skills/slack-gif-creator/core/easing.py`
```
#!/usr/bin/env python3
"""
Easing Functions - Timing functions for smooth animations.

Provides various easing functions for natural motion and timing.
All functions take a value t (0.0 to 1.0) and return eased value (0.0 to 1.0).
"""

import math


def linear(t: float) -> float:
    """Linear interpolation (no easing)."""
    return t


def ease_in_quad(t: float) -> float:
    """Quadratic ease-in (slow start, accelerating)."""
    return t * t


def ease_out_quad(t: float) -> float:
    """Quadratic ease-out (fast start, decelerating)."""
    return t * (2 - t)


def ease_in_out_quad(t: float) -> float:
    """Quadratic ease-in-out (slow start and end)."""
    if t < 0.5:
        return 2 * t * t
    return -1 + (4 - 2 * t) * t


def ease_in_cubic(t: float) -> float:
    """Cubic ease-in (slow start)."""
    return t * t * t


def ease_out_cubic(t: float) -> float:
    """Cubic ease-out (fast start)."""
    return (t - 1) * (t - 1) * (t - 1) + 1


def ease_in_out_cubic(t: float) -> float:
    """Cubic ease-in-out."""
    if t < 0.5:
        return 4 * t * t * t
    return (t - 1) * (2 * t - 2) * (2 * t - 2) + 1


def ease_in_bounce(t: float) -> float:
    """Bounce ease-in (bouncy start)."""
    return 1 - ease_out_bounce(1 - t)


def ease_out_bounce(t: float) -> float:
    """Bounce ease-out (bouncy end)."""
    if t < 1 / 2.75:
        return 7.5625 * t * t
    elif t < 2 / 2.75:
        t -= 1.5 / 2.75
        return 7.5625 * t * t + 0.75
    elif t < 2.5 / 2.75:
        t -= 2.25 / 2.75
        return 7.5625 * t * t + 0.9375
    else:
        t -= 2.625 / 2.75
        return 7.5625 * t * t + 0.984375


def ease_in_out_bounce(t: float) -> float:
    """Bounce ease-in-out."""
    if t < 0.5:
        return ease_in_bounce(t * 2) * 0.5
    return ease_out_bounce(t * 2 - 1) * 0.5 + 0.5


def ease_in_elastic(t: float) -> float:
    """Elastic ease-in (spring effect)."""
    if t == 0 or t == 1:
        return t
    return -math.pow(2, 10 * (t - 1)) * math.sin((t - 1.1) * 5 * math.pi)


def ease_out_elastic(t: float) -> float:
    """Elastic ease-out (spring effect)."""
    if t == 0 or t == 1:
        return t
    return math.pow(2, -10 * t) * math.sin((t - 0.1) * 5 * math.pi) + 1


def ease_in_out_elastic(t: float) -> float:
    """Elastic ease-in-out."""
    if t == 0 or t == 1:
        return t
    t = t * 2 - 1
    if t < 0:
        return -0.5 * math.pow(2, 10 * t) * math.sin((t - 0.1) * 5 * math.pi)
    return math.pow(2, -10 * t) * math.sin((t - 0.1) * 5 * math.pi) * 0.5 + 1


# Convenience mapping
EASING_FUNCTIONS = {
    "linear": linear,
    "ease_in": ease_in_quad,
    "ease_out": ease_out_quad,
    "ease_in_out": ease_in_out_quad,
    "bounce_in": ease_in_bounce,
    "bounce_out": ease_out_bounce,
    "bounce": ease_in_out_bounce,
    "elastic_in": ease_in_elastic,
    "elastic_out": ease_out_elastic,
    "elastic": ease_in_out_elastic,
}


def get_easing(name: str = "linear"):
    """Get easing function by name."""
    return EASING_FUNCTIONS.get(name, linear)


def interpolate(start: float, end: float, t: float, easing: str = "linear") -> float:
    """
    Interpolate between two values with easing.

    Args:
        start: Start value
        end: End value
        t: Progress from 0.0 to 1.0
        easing: Name of easing function

    Returns:
        Interpolated value
    """
    ease_func = get_easing(easing)
    eased_t = ease_func(t)
    return start + (end - start) * eased_t


def ease_back_in(t: float) -> float:
    """Back ease-in (slight overshoot backward before forward motion)."""
    c1 = 1.70158
    c3 = c1 + 1
    return c3 * t * t * t - c1 * t * t


def ease_back_out(t: float) -> float:
    """Back ease-out (overshoot forward then settle back)."""
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2)


def ease_back_in_out(t: float) -> float:
    """Back ease-in-out (overshoot at both ends)."""
    c1 = 1.70158
    c2 = c1 * 1.525
    if t < 0.5:
        return (pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    return (pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2


def apply_squash_stretch(
    base_scale: tuple[float, float], intensity: float, direction: str = "vertical"
) -> tuple[float, float]:
    """
    Calculate squash and stretch scales for more dynamic animation.

    Args:
        base_scale: (width_scale, height_scale) base scales
        intensity: Squash/stretch intensity (0.0-1.0)
        direction: 'vertical', 'horizontal', or 'both'

    Returns:
        (width_scale, height_scale) with squash/stretch applied
    """
    width_scale, height_scale = base_scale

    if direction == "vertical":
        # Compress vertically, expand horizontally (preserve volume)
        height_scale *= 1 - intensity * 0.5
        width_scale *= 1 + intensity * 0.5
    elif direction == "horizontal":
        # Compress horizontally, expand vertically
        width_scale *= 1 - intensity * 0.5
        height_scale *= 1 + intensity * 0.5
    elif direction == "both":
        # General squash (both dimensions)
        width_scale *= 1 - intensity * 0.3
        height_scale *= 1 - intensity * 0.3

    return (width_scale, height_scale)


def calculate_arc_motion(
    start: tuple[float, float], end: tuple[float, float], height: float, t: float
) -> tuple[float, float]:
    """
    Calculate position along a parabolic arc (natural motion path).

    Args:
        start: (x, y) starting position
        end: (x, y) ending position
        height: Arc height at midpoint (positive = upward)
        t: Progress (0.0-1.0)

    Returns:
        (x, y) position along arc
    """
    x1, y1 = start
    x2, y2 = end

    # Linear interpolation for x
    x = x1 + (x2 - x1) * t

    # Parabolic interpolation for y
    # y = start + progress * (end - start) + arc_offset
    # Arc offset peaks at t=0.5
    arc_offset = 4 * height * t * (1 - t)
    y = y1 + (y2 - y1) * t - arc_offset

    return (x, y)


# Add new easing functions to the convenience mapping
EASING_FUNCTIONS.update(
    {
        "back_in": ease_back_in,
        "back_out": ease_back_out,
        "back_in_out": ease_back_in_out,
        "anticipate": ease_back_in,  # Alias
        "overshoot": ease_back_out,  # Alias
    }
)

```

### Core Architecture Module: `app/skills/slack-gif-creator/core/frame_composer.py`
```
#!/usr/bin/env python3
"""
Frame Composer - Utilities for composing visual elements into frames.

Provides functions for drawing shapes, text, emojis, and compositing elements
together to create animation frames.
"""

from typing import Optional

from PIL import Image, ImageDraw, ImageFont


def create_blank_frame(
    width: int, height: int, color: tuple[int, int, int] = (255, 255, 255)
) -> Image.Image:
    """
    Create a blank frame with solid color background.

    Args:
        width: Frame width
        height: Frame height
        color: RGB color tuple (default: white)

    Returns:
        PIL Image
    """
    return Image.new("RGB", (width, height), color)


def draw_circle(
    frame: Image.Image,
    center: tuple[int, int],
    radius: int,
    fill_color: Optional[tuple[int, int, int]] = None,
    outline_color: Optional[tuple[int, int, int]] = None,
    outline_width: int = 1,
) -> Image.Image:
    """
    Draw a circle on a frame.

    Args:
        frame: PIL Image to draw on
        center: (x, y) center position
        radius: Circle radius
        fill_color: RGB fill color (None for no fill)
        outline_color: RGB outline color (None for no outline)
        outline_width: Outline width in pixels

    Returns:
        Modified frame
    """
    draw = ImageDraw.Draw(frame)
    x, y = center
    bbox = [x - radius, y - radius, x + radius, y + radius]
    draw.ellipse(bbox, fill=fill_color, outline=outline_color, width=outline_width)
    return frame


def draw_text(
    frame: Image.Image,
    text: str,
    position: tuple[int, int],
    color: tuple[int, int, int] = (0, 0, 0),
    centered: bool = False,
) -> Image.Image:
    """
    Draw text on a frame.

    Args:
        frame: PIL Image to draw on
        text: Text to draw
        position: (x, y) position (top-left unless centered=True)
        color: RGB text color
        centered: If True, center text at position

    Returns:
        Modified frame
    """
    draw = ImageDraw.Draw(frame)

    # Uses Pillow's default font.
    # If the font should be changed for the emoji, add additional logic here.
    font = ImageFont.load_default()

    if centered:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = position[0] - text_width // 2
        y = position[1] - text_height // 2
        position = (x, y)  # pyright: ignore[reportAssignmentType]

    draw.text(position, text, fill=color, font=font)
    return frame


def create_gradient_background(
    width: int,
    height: int,
    top_color: tuple[int, int, int],
    bottom_color: tuple[int, int, int],
) -> Image.Image:
    """
    Create a vertical gradient background.

    Args:
        width: Frame width
        height: Frame height
        top_color: RGB color at top
        bottom_color: RGB color at bottom

    Returns:
        PIL Image with gradient
    """
    frame = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(frame)

    # Calculate color step for each row
    r1, g1, b1 = top_color
    r2, g2, b2 = bottom_color

    for y in range(height):
        # Interpolate color
        ratio = y / height
        r = int(r1 * (1 - ratio) + r2 * ratio)
        g = int(g1 * (1 - ratio) + g2 * ratio)
        b = int(b1 * (1 - ratio) + b2 * ratio)

        # Draw horizontal line
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    return frame


def draw_star(
    frame: Image.Image,
    center: tuple[int, int],
    size: int,
    fill_color: tuple[int, int, int],
    outline_color: Optional[tuple[int, int, int]] = None,
    outline_width: int = 1,
) -> Image.Image:
    """
    Draw a 5-pointed star.

    Args:
        frame: PIL Image to draw on
        center: (x, y) center position
        size: Star size (outer radius)
        fill_color: RGB fill color
        outline_color: RGB outline color (None for no outline)
        outline_width: Outline width

    Returns:
        Modified frame
    """
    import math

    draw = ImageDraw.Draw(frame)
    x, y = center

    # Calculate star points
    points = []
    for i in range(10):
        angle = (i * 36 - 90) * math.pi / 180  # 36 degrees per point, start at top
        radius = size if i % 2 == 0 else size * 0.4  # Alternate between outer and inner
        px = x + radius * math.cos(angle)
        py = y + radius * math.sin(angle)
        points.append((px, py))

    # Draw star
    draw.polygon(points, fill=fill_color, outline=outline_color, width=outline_width)

    return frame

```

### Core Architecture Module: `app/skills/slack-gif-creator/core/validators.py`
```
#!/usr/bin/env python3
"""
Validators - Check if GIFs meet Slack's requirements.

These validators help ensure your GIFs meet Slack's size and dimension constraints.
"""

from pathlib import Path


def validate_gif(
    gif_path: str | Path, is_emoji: bool = True, verbose: bool = True
) -> tuple[bool, dict]:
    """
    Validate GIF for Slack (dimensions, size, frame count).

    Args:
        gif_path: Path to GIF file
        is_emoji: True for emoji (128x128 recommended), False for message GIF
        verbose: Print validation details

    Returns:
        Tuple of (passes: bool, results: dict with all details)
    """
    from PIL import Image

    gif_path = Path(gif_path)

    if not gif_path.exists():
        return False, {"error": f"File not found: {gif_path}"}

    # Get file size
    size_bytes = gif_path.stat().st_size
    size_kb = size_bytes / 1024
    size_mb = size_kb / 1024

    # Get dimensions and frame info
    try:
        with Image.open(gif_path) as img:
            width, height = img.size

            # Count frames
            frame_count = 0
            try:
                while True:
                    img.seek(frame_count)
                    frame_count += 1
            except EOFError:
                pass

            # Get duration
            try:
                duration_ms = img.info.get("duration", 100)
                total_duration = (duration_ms * frame_count) / 1000
                fps = frame_count / total_duration if total_duration > 0 else 0
            except Exception:
                total_duration = None
                fps = None

    except Exception as e:
        return False, {"error": f"Failed to read GIF: {e}"}

    # Validate dimensions
    if is_emoji:
        optimal = width == height == 128
        acceptable = width == height and 64 <= width <= 128
        dim_pass = acceptable
    else:
        aspect_ratio = (
            max(width, height) / min(width, height)
            if min(width, height) > 0
            else float("inf")
        )
        dim_pass = aspect_ratio <= 2.0 and 320 <= min(width, height) <= 640

    results = {
        "file": str(gif_path),
        "passes": dim_pass,
        "width": width,
        "height": height,
        "size_kb": size_kb,
        "size_mb": size_mb,
        "frame_count": frame_count,
        "duration_seconds": total_duration,
        "fps": fps,
        "is_emoji": is_emoji,
        "optimal": optimal if is_emoji else None,
    }

    # Print if verbose
    if verbose:
        print(f"\nValidating {gif_path.name}:")
        print(
            f"  Dimensions: {width}x{height}"
            + (
                f" ({'optimal' if optimal else 'acceptable'})"
                if is_emoji and acceptable
                else ""
            )
        )
        print(
            f"  Size: {size_kb:.1f} KB"
            + (f" ({size_mb:.2f} MB)" if size_mb >= 1.0 else "")
        )
        print(
            f"  Frames: {frame_count}"
            + (f" @ {fps:.1f} fps ({total_duration:.1f}s)" if fps else "")
        )

        if not dim_pass:
            print(
                f"  Note: {'Emoji should be 128x128' if is_emoji else 'Unusual dimensions for Slack'}"
            )

        if size_mb > 5.0:
            print("  Note: Large file size - consider fewer frames/colors")

    return dim_pass, results


def is_slack_ready(
    gif_path: str | Path, is_emoji: bool = True, verbose: bool = True
) -> bool:
    """
    Quick check if GIF is ready for Slack.

    Args:
        gif_path: Path to GIF file
        is_emoji: True for emoji GIF, False for message GIF
        verbose: Print feedback

    Returns:
        True if dimensions are acceptable
    """
    passes, _ = validate_gif(gif_path, is_emoji, verbose)
    return passes

```

### Core Architecture Module: `app/skills/social-push/scripts/render_xhs.js`
```
#!/usr/bin/env node
/**
 * 小红书卡片渲染脚本 - Node.js 增强版
 * 支持多种排版样式和智能分页策略
 * 
 * 使用方法:
 *     node render_xhs.js <markdown_file> [options]
 * 
 * 选项:
 *     --output-dir, -o     输出目录（默认为当前工作目录）
 *     --theme, -t          排版主题：default, playful-geometric, neo-brutalism, 等
 *     --mode, -m           分页模式：separator, auto-fit, auto-split, dynamic
 *     --width, -w          图片宽度（默认 1080）
 *     --height, -h         图片高度（默认 1440）
 *     --dpr                设备像素比（默认 2）
 * 
 * 依赖安装:
 *     npm install marked yaml playwright
 *     npx playwright install chromium
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const yaml = require('yaml');
const { chromium } = require('playwright');

// 获取脚本所在目录
const SCRIPT_DIR = path.dirname(__dirname);
const ASSETS_DIR = path.join(SCRIPT_DIR, 'assets');
const THEMES_DIR = path.join(ASSETS_DIR, 'themes');

// 默认卡片尺寸配置 (3:4 比例)
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1440;
const MAX_HEIGHT = 2160;

// 可用主题列表
const AVAILABLE_THEMES = [
    'default',
    'playful-geometric',
    'neo-brutalism',
    'botanical',
    'professional',
    'retro',
    'terminal',
    'sketch'
];

// 分页模式
const PAGING_MODES = ['separator', 'auto-fit', 'auto-split', 'dynamic'];

// 主题背景色
const THEME_BACKGROUNDS = {
    'default': 'linear-gradient(180deg, #f3f3f3 0%, #f9f9f9 100%)',
    'playful-geometric': 'linear-gradient(135deg, #8B5CF6 0%, #F472B6 100%)',
    'neo-brutalism': 'linear-gradient(135deg, #FF4757 0%, #FECA57 100%)',
    'botanical': 'linear-gradient(135deg, #4A7C59 0%, #8FBC8F 100%)',
    'professional': 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
    'retro': 'linear-gradient(135deg, #D35400 0%, #F39C12 100%)',
    'terminal': 'linear-gradient(135deg, #0D1117 0%, #161B22 100%)',
    'sketch': 'linear-gradient(135deg, #555555 0%, #888888 100%)'
};

// 封面标题文字渐变（随主题变化）
const THEME_TITLE_GRADIENTS = {
    'default': 'linear-gradient(180deg, #111827 0%, #4B5563 100%)',
    'playful-geometric': 'linear-gradient(180deg, #7C3AED 0%, #F472B6 100%)',
    'neo-brutalism': 'linear-gradient(180deg, #000000 0%, #FF4757 100%)',
    'botanical': 'linear-gradient(180deg, #1F2937 0%, #4A7C59 100%)',
    'professional': 'linear-gradient(180deg, #1E3A8A 0%, #2563EB 100%)',
    'retro': 'linear-gradient(180deg, #8B4513 0%, #D35400 100%)',
    'terminal': 'linear-gradient(180deg, #39D353 0%, #58A6FF 100%)',
    'sketch': 'linear-gradient(180deg, #111827 0%, #6B7280 100%)',
};

/**
 * 解析命令行参数
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        markdownFile: null,
        outputDir: process.cwd(),
        theme: 'default',
        mode: 'separator',
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        maxHeight: MAX_HEIGHT,
        dpr: 2
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];

        switch (arg) {
            case '--output-dir':
            case '-o':
                options.outputDir = nextArg;
                i++;
                break;
            case '--theme':
            case '-t':
                options.theme = nextArg;
                i++;
                break;
            case '--mode':
            case '-m':
                options.mode = nextArg;
                i++;
                break;
            case '--width':
            case '-w':
                options.width = parseInt(nextArg);
                i++;
                break;
            case '--height':
                options.height = parseInt(nextArg);
                i++;
                break;
            case '--max-height':
                options.maxHeight = parseInt(nextArg);
                i++;
                break;
            case '--dpr':
                options.dpr = parseInt(nextArg);
                i++;
                break;
            case '--help':
                printHelp();
                process.exit(0);
            default:
                if (!arg.startsWith('-')) {
                    options.markdownFile = arg;
                }
        }
    }

    return options;
}

/**
 * 打印帮助信息
 */
function printHelp() {
    console.log(`
小红书卡片渲染脚本 - Node.js 版本

使用方法:
    node render_xhs.js <markdown_file> [options]

选项:
    --output-dir, -o     输出目录（默认为当前工作目录）
    --theme, -t          排版主题
    --mode, -m           分页模式
    --width, -w          图片宽度（默认 1080）
    --height             图片高度（默认 1440）
    --max-height         最大高度（默认 2160）
    --dpr                设备像素比（默认 2）

可用主题: ${AVAILABLE_THEMES.join(', ')}
分页模式: ${PAGING_MODES.join(', ')}
`);
}

/**
 * 解析 Markdown 文件
 */
function parseMarkdownFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 解析 YAML 头部
    const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    
    let metadata = {};
    let body = content;
    
    if (yamlMatch) {
        try {
            metadata = yaml.parse(yamlMatch[1]) || {};
        } catch (e) {
            metadata = {};
        }
        body = content.slice(yamlMatch[0].length);
    }
    
    return { metadata, body: body.trim() };
}

/**
 * 按分隔符拆分内容
 */
function splitContentBySeparator(body) {
    const parts = body.split(/\n---+\n/);
    return parts.map(p => p.trim()).filter(p => p);
}

/**
 * 加载主题 CSS
 */
function loadThemeCss(theme) {
    const themeFile = path.join(THEMES_DIR, `${theme}.css`);
    if (fs.existsSync(themeFile)) {
        return fs.readFileSync(themeFile, 'utf-8');
    }
    const defaultFile = path.join(THEMES_DIR, 'default.css');
    if (fs.existsSync(defaultFile)) {
        return fs.readFileSync(defaultFile, 'utf-8');
    }
    return '';
}

/**
 * 生成封面 HTML
 */
function generateCoverHtml(metadata, theme, width, height) {
    const emoji = metadata.emoji || '📝';
    let title = metadata.title || '标题';
    let subtitle = metadata.subtitle || '';
    
    if (title.length > 15) title = title.slice(0, 15);
    if (subtitle.length > 15) subtitle = subtitle.slice(0, 15);
    
    const bg = THEME_BACKGROUNDS[theme] || THEME_BACKGROUNDS['default'];
    const titleBg = THEME_TITLE_GRADIENTS[theme] || THEME_TITLE_GRADIENTS['default'];
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=${width}, height=${height}">
    <title>小红书封面</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Noto Sans SC', 'Source Han Sans CN', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
        }
        
        .cover-container {
            width: ${width}px;
            height: ${height}px;
            background: ${bg};
            position: relative;
            overflow: hidden;
        }
        
        .cover-inner {
            position: absolute;
            width: ${Math.floor(width * 0.88)}px;
            height: ${Math.floor(height * 0.91)}px;
            left: ${Math.floor(width * 0.06)}px;
            top: ${Math.floor(height * 0.045)}px;
            background: #F3F3F3;
            border-radius: 25px;
            display: flex;
            flex-direction: column;
            padding: ${Math.floor(width * 0.074)}px ${Math.floor(width * 0.079)}px;
        }
        
        .cover-emoji {
            font-size: ${Math.floor(width * 0.167)}px;
            line-height: 1.2;
            margin-bottom: ${Math.floor(height * 0.035)}px;
        }
        
        .cover-title {
            font-weight: 900;
            font-size: ${Math.floor(width * 0.12)}px;
            line-height: 1.4;
            background: ${titleBg};
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            flex: 1;
            display: flex;
            align-items: flex-start;
            word-break: break-all;
        }
        
        .cover-subtitle {
            font-weight: 350;
            font-size: ${Math.floor(width * 0.067)}px;
            line-height: 1.4;
            color: #000000;
            margin-top: auto;
        }
    </style>
</head>
<body>
    <div class="cover-container">
        <div class="cover-inner">
            <div class="cover-emoji">${emoji}</div>
            <div class="cover-title">${title}</div>
            <div class="cover-subtitle">${subtitle}</div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * 生成正文卡片 HTML
 */
function generateCardHtml(content, theme, pageNumber, totalPages, width, height, mode) {
    const htmlContent = marked.parse(content);
    const themeCss = loadThemeCss(theme);
    const pageText = totalPages > 1 ? `${pageNumber}/${totalPages}` : '';
    const bg = THEME_BACKGROUNDS[theme] || THEME_BACKGROUNDS['default'];
    
    let containerStyle, innerStyle, contentStyle;
    
    if (mode === 'auto-fit') {
        containerStyle = `
            width: ${width}px;
            height: ${height}px;
            background: ${bg};
            position: relative;
            padding: 50px;
            overflow: hidden;
        `;
        innerStyle = `
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 60px;
            height: calc(${height}px - 100px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;
        contentStyle = 'flex: 1; overflow: hidden;';
    } else if (mode === 'dynamic') {
        containerStyle = `
            width: ${width}px;
            min-height: ${height}px;
            background: ${bg};
            position: relative;
            padding: 50px;
        `;
        innerStyle
```

### Core Architecture Module: `app/skills/social-push/scripts/render_xhs.py`
```
#!/usr/bin/env python3
"""
小红书卡片渲染脚本 - 增强版
支持多种排版样式和智能分页策略

使用方法:
    python render_xhs.py <markdown_file> [options]

选项:
    --output-dir, -o     输出目录（默认为当前工作目录）
    --theme, -t          排版主题：default, playful-geometric, neo-brutalism,
                         botanical, professional, retro, terminal, sketch
    --mode, -m           分页模式：
                         - separator  : 按 --- 分隔符手动分页（默认）
                         - auto-fit   : 自动缩放文字以填满固定尺寸
                         - auto-split : 根据内容高度自动切分
                         - dynamic    : 根据内容动态调整图片高度
    --width, -w          图片宽度（默认 1080）
    --height, -h         图片高度（默认 1440，dynamic 模式下为最小高度）
    --max-height         dynamic 模式下的最大高度（默认 4320
    --dpr                设备像素比（默认 2）

依赖安装:
    pip install markdown pyyaml playwright
    playwright install chromium
"""

import argparse
import asyncio
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import List

try:
    import markdown
    import yaml
    from playwright.async_api import async_playwright  # pyright: ignore[reportMissingImports]
except ImportError as e:
    print(f"缺少依赖: {e}")
    print(
        "请运行: pip install markdown pyyaml playwright && playwright install chromium"
    )
    sys.exit(1)


# 获取脚本所在目录
SCRIPT_DIR = Path(__file__).parent.parent
ASSETS_DIR = SCRIPT_DIR / "assets"
THEMES_DIR = ASSETS_DIR / "themes"

# 默认卡片尺寸配置 (3:4 比例)
DEFAULT_WIDTH = 1080
DEFAULT_HEIGHT = 1440
MAX_HEIGHT = 4320  # dynamic 模式最大高度

# 可用主题列表
AVAILABLE_THEMES = [
    "default",
    "playful-geometric",
    "neo-brutalism",
    "botanical",
    "professional",
    "retro",
    "terminal",
    "sketch",
]

# 分页模式
PAGING_MODES = ["separator", "auto-fit", "auto-split", "dynamic"]


def parse_markdown_file(file_path: str) -> dict:
    """解析 Markdown 文件，提取 YAML 头部和正文内容"""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 解析 YAML 头部
    yaml_pattern = r"^---\s*\n(.*?)\n---\s*\n"
    yaml_match = re.match(yaml_pattern, content, re.DOTALL)

    metadata = {}
    body = content

    if yaml_match:
        try:
            metadata = yaml.safe_load(yaml_match.group(1)) or {}
        except yaml.YAMLError:
            metadata = {}
        body = content[yaml_match.end() :]

    return {"metadata": metadata, "body": body.strip()}


def split_content_by_separator(body: str) -> List[str]:
    """按照 --- 分隔符拆分正文为多张卡片内容"""
    parts = re.split(r"\n---+\n", body)
    return [part.strip() for part in parts if part.strip()]


def convert_markdown_to_html(md_content: str) -> str:
    """将 Markdown 转换为 HTML"""
    # 处理 tags（以 # 开头的标签）
    tags_pattern = r"((?:#[\w\u4e00-\u9fa5]+\s*)+)$"
    tags_match = re.search(tags_pattern, md_content, re.MULTILINE)
    tags_html = ""

    if tags_match:
        tags_str = tags_match.group(1)
        md_content = md_content[: tags_match.start()].strip()
        tags = re.findall(r"#([\w\u4e00-\u9fa5]+)", tags_str)
        if tags:
            tags_html = '<div class="tags-container">'
            for tag in tags:
                tags_html += f'<span class="tag">#{tag}</span>'
            tags_html += "</div>"

    # 转换 Markdown 为 HTML
    html = markdown.markdown(
        md_content, extensions=["extra", "codehilite", "tables", "nl2br"]
    )

    return html + tags_html


def load_theme_css(theme: str) -> str:
    """加载主题 CSS 样式"""
    theme_file = THEMES_DIR / f"{theme}.css"
    if theme_file.exists():
        with open(theme_file, "r", encoding="utf-8") as f:
            return f.read()
    else:
        # 如果主题不存在，使用默认主题
        default_file = THEMES_DIR / "default.css"
        if default_file.exists():
            with open(default_file, "r", encoding="utf-8") as f:
                return f.read()
        return ""


def generate_cover_html(metadata: dict, theme: str, width: int, height: int) -> str:
    """生成封面 HTML"""
    emoji = metadata.get("emoji", "📝")
    title = metadata.get("title", "标题")
    subtitle = metadata.get("subtitle", "")

    # 动态调整标题字体大小
    title_len = len(title)
    if title_len <= 6:
        title_size = int(width * 0.14)  # 极大
    elif title_len <= 10:
        title_size = int(width * 0.12)  # 大
    elif title_len <= 18:
        title_size = int(width * 0.09)  # 中
    elif title_len <= 30:
        title_size = int(width * 0.07)  # 小
    else:
        title_size = int(width * 0.055)  # 极小

    # 获取主题背景色
    theme_backgrounds = {
        "default": "linear-gradient(180deg, #f3f3f3 0%, #f9f9f9 100%)",
        "playful-geometric": "linear-gradient(180deg, #8B5CF6 0%, #F472B6 100%)",
        "neo-brutalism": "linear-gradient(180deg, #FF4757 0%, #FECA57 100%)",
        "botanical": "linear-gradient(180deg, #4A7C59 0%, #8FBC8F 100%)",
        "professional": "linear-gradient(180deg, #2563EB 0%, #3B82F6 100%)",
        "retro": "linear-gradient(180deg, #D35400 0%, #F39C12 100%)",
        "terminal": "linear-gradient(180deg, #0D1117 0%, #21262D 100%)",
        "sketch": "linear-gradient(180deg, #555555 0%, #999999 100%)",
    }
    bg = theme_backgrounds.get(theme, theme_backgrounds["default"])

    # 封面标题文字渐变随主题变化
    title_gradients = {
        "default": "linear-gradient(180deg, #111827 0%, #4B5563 100%)",
        "playful-geometric": "linear-gradient(180deg, #7C3AED 0%, #F472B6 100%)",
        "neo-brutalism": "linear-gradient(180deg, #000000 0%, #FF4757 100%)",
        "botanical": "linear-gradient(180deg, #1F2937 0%, #4A7C59 100%)",
        "professional": "linear-gradient(180deg, #1E3A8A 0%, #2563EB 100%)",
        "retro": "linear-gradient(180deg, #8B4513 0%, #D35400 100%)",
        "terminal": "linear-gradient(180deg, #39D353 0%, #58A6FF 100%)",
        "sketch": "linear-gradient(180deg, #111827 0%, #6B7280 100%)",
    }
    title_bg = title_gradients.get(theme, title_gradients["default"])

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width={width}, height={height}">
    <title>小红书封面</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');
        
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Noto Sans SC', 'Source Han Sans CN', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            width: {width}px;
            height: {height}px;
            overflow: hidden;
        }}
        
        .cover-container {{
            width: {width}px;
            height: {height}px;
            background: {bg};
            position: relative;
            overflow: hidden;
        }}
        
        .cover-inner {{
            position: absolute;
            width: {int(width * 0.88)}px;
            height: {int(height * 0.91)}px;
            left: {int(width * 0.06)}px;
            top: {int(height * 0.045)}px;
            background: #F3F3F3;
            border-radius: 25px;
            display: flex;
            flex-direction: column;
            padding: {int(width * 0.074)}px {int(width * 0.079)}px;
        }}
        
        .cover-emoji {{
            font-size: {int(width * 0.167)}px;
            line-height: 1.2;
            margin-bottom: {int(height * 0.035)}px;
        }}
        
        .cover-title {{
            font-weight: 900;
            font-size: {title_size}px;
            line-height: 1.4;
            background: {title_bg};
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            flex: 1;
            display: flex;
            align-items: flex-start;
            word-break: break-all;
        }}
        
        .cover-subtitle {{
            font-weight: 350;
            font-size: {int(width * 0.067)}px;
            line-height: 1.4;
            color: #000000;
            margin-top: auto;
        }}
    </style>
</head>
<body>
    <div class="cover-container">
        <div class="cover-inner">
            <div class="cover-emoji">{emoji}</div>
            <div class="cover-title">{title}</div>
            <div class="cover-subtitle">{subtitle}</div>
        </div>
    </div>
</body>
</html>"""
    return html


def generate_card_html(
    content: str,
    theme: str,
    page_number: int = 1,
    total_pages: int = 1,
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
    mode: str = "separator",
) -> str:
    """生成正文卡片 HTML"""

    html_content = convert_markdown_to_html(content)
    theme_css = load_theme_css(theme)

    page_text = f"{page_number}/{total_pages}" if total_pages > 1 else ""

    # 获取主题背景色
    theme_backgrounds = {
        "default": "linear-gradient(180deg, #f3f3f3 0%, #f9f9f9 100%)",
        "playful-geometric": "linear-gradient(135deg, #8B5CF6 0%, #F472B6 100%)",
        "neo-brutalism": "linear-gradient(135deg, #FF4757 0%, #FECA57 100%)",
        "botanical": "linear-gradient(135deg, #4A7C59 0%, #8FBC8F 100%)",
        "professional": "linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)",
        "retro": "linear-gradient(135deg, #D35400 0%, #F39C12 100%)",
        "terminal": "linear-gradient(135deg, #0D1117 0%, #161B22 100%)",
        "sketch": "linear-gradient(135deg, #555555 0%, #888888 100%)",
    }
    bg = theme_backgrounds.get(theme, theme_backgrounds["default"])

    # 根据模式设置不同的容器样式
    if mode == "auto-fit":
        container_style = f"""
            width: {width}px;
            height: {height}px;
            background: {bg};
            position: relative;
            padding: 50px;
            overflow: hidden;
        """
        inner_style = f"""
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 60px;
            height: calc({height}px - 100px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            overflow: hidden;
            display: flex;
            flex-direction: column;

```

### Core Architecture Module: `app/skills/social-push/scripts/render_xhs_v2.js`
```
#!/usr/bin/env node
/**
 * 小红书卡片渲染脚本 V2 - Node.js 智能分页版
 * 将 Markdown 文件渲染为小红书风格的图片卡片
 * 
 * 新特性：
 * 1. 智能分页：自动检测内容高度，超出时自动拆分到多张卡片
 * 2. 多种样式：支持多种预设样式主题
 * 
 * 使用方法:
 *   node render_xhs_v2.js <markdown_file> [options]
 * 
 * 依赖安装:
 *   npm install marked js-yaml playwright
 *   npx playwright install chromium
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { marked } = require('marked');
const yaml = require('js-yaml');

// 获取脚本所在目录
const SCRIPT_DIR = path.dirname(__dirname);
const ASSETS_DIR = path.join(SCRIPT_DIR, 'assets');

// 卡片尺寸配置 (3:4 比例)
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1440;

// 内容区域安全高度
const SAFE_HEIGHT = CARD_HEIGHT - 120 - 100 - 80 - 40; // ~1100px

// 样式配置
const STYLES = {
    purple: {
        name: "紫韵",
        cover_bg: "linear-gradient(180deg, #3450E4 0%, #D266DA 100%)",
        card_bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        accent_color: "#6366f1",
    },
    xiaohongshu: {
        name: "小红书红",
        cover_bg: "linear-gradient(180deg, #FF2442 0%, #FF6B81 100%)",
        card_bg: "linear-gradient(135deg, #FF2442 0%, #FF6B81 100%)",
        accent_color: "#FF2442",
    },
    mint: {
        name: "清新薄荷",
        cover_bg: "linear-gradient(180deg, #43e97b 0%, #38f9d7 100%)",
        card_bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        accent_color: "#43e97b",
    },
    sunset: {
        name: "日落橙",
        cover_bg: "linear-gradient(180deg, #fa709a 0%, #fee140 100%)",
        card_bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        accent_color: "#fa709a",
    },
    ocean: {
        name: "深海蓝",
        cover_bg: "linear-gradient(180deg, #4facfe 0%, #00f2fe 100%)",
        card_bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        accent_color: "#4facfe",
    },
    elegant: {
        name: "优雅白",
        cover_bg: "linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%)",
        card_bg: "linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)",
        accent_color: "#333333",
    },
    dark: {
        name: "暗黑模式",
        cover_bg: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
        card_bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        accent_color: "#e94560",
    },
};

/**
 * 解析 Markdown 文件，提取 YAML 头部和正文内容
 */
function parseMarkdownFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const yamlPattern = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const yamlMatch = content.match(yamlPattern);
    
    let metadata = {};
    let body = content;
    
    if (yamlMatch) {
        try {
            metadata = yaml.load(yamlMatch[1]) || {};
        } catch (e) {
            metadata = {};
        }
        body = content.slice(yamlMatch[0].length);
    }
    
    return { metadata, body: body.trim() };
}

/**
 * 按照 --- 分隔符拆分正文为多张卡片内容
 */
function splitContentBySeparator(body) {
    const parts = body.split(/\n---+\n/);
    return parts.filter(part => part.trim()).map(part => part.trim());
}

/**
 * 预估内容高度
 */
function estimateContentHeight(content) {
    const lines = content.split('\n');
    let totalHeight = 0;
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            totalHeight += 20;
            continue;
        }
        
        if (trimmed.startsWith('# ')) {
            totalHeight += 130;
        } else if (trimmed.startsWith('## ')) {
            totalHeight += 110;
        } else if (trimmed.startsWith('### ')) {
            totalHeight += 90;
        } else if (trimmed.startsWith('```')) {
            totalHeight += 80;
        } else if (trimmed.match(/^[-*+]\s/)) {
            totalHeight += 85;
        } else if (trimmed.startsWith('>')) {
            totalHeight += 100;
        } else if (trimmed.startsWith('![')) {
            totalHeight += 300;
        } else {
            const charCount = trimmed.length;
            const linesNeeded = Math.max(1, charCount / 28);
            totalHeight += Math.floor(linesNeeded * 42 * 1.7) + 35;
        }
    }
    
    return totalHeight;
}

/**
 * 智能拆分内容
 */
function smartSplitContent(content, maxHeight = SAFE_HEIGHT) {
    const blocks = [];
    let currentBlock = [];
    
    const lines = content.split('\n');
    
    for (const line of lines) {
        if (line.trim().startsWith('#') && currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
            currentBlock = [line];
        } else if (line.trim() === '---') {
            if (currentBlock.length > 0) {
                blocks.push(currentBlock.join('\n'));
                currentBlock = [];
            }
        } else {
            currentBlock.push(line);
        }
    }
    
    if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
    }
    
    if (blocks.length <= 1) {
        const paragraphs = content.split('\n\n').filter(b => b.trim());
        blocks.length = 0;
        blocks.push(...paragraphs);
    }
    
    const cards = [];
    let currentCard = [];
    let currentHeight = 0;
    
    for (const block of blocks) {
        const blockHeight = estimateContentHeight(block);
        
        if (blockHeight > maxHeight) {
            if (currentCard.length > 0) {
                cards.push(currentCard.join('\n\n'));
                currentCard = [];
                currentHeight = 0;
            }
            
            const blockLines = block.split('\n');
            let subBlock = [];
            let subHeight = 0;
            
            for (const line of blockLines) {
                const lineHeight = estimateContentHeight(line);
                
                if (subHeight + lineHeight > maxHeight && subBlock.length > 0) {
                    cards.push(subBlock.join('\n'));
                    subBlock = [line];
                    subHeight = lineHeight;
                } else {
                    subBlock.push(line);
                    subHeight += lineHeight;
                }
            }
            
            if (subBlock.length > 0) {
                cards.push(subBlock.join('\n'));
            }
        } else if (currentHeight + blockHeight > maxHeight && currentCard.length > 0) {
            cards.push(currentCard.join('\n\n'));
            currentCard = [block];
            currentHeight = blockHeight;
        } else {
            currentCard.push(block);
            currentHeight += blockHeight;
        }
    }
    
    if (currentCard.length > 0) {
        cards.push(currentCard.join('\n\n'));
    }
    
    return cards.length > 0 ? cards : [content];
}

/**
 * 将 Markdown 转换为 HTML
 */
function convertMarkdownToHtml(mdContent, style = STYLES.purple) {
    const tagsPattern = /((?:#[\w\u4e00-\u9fa5]+\s*)+)$/m;
    const tagsMatch = mdContent.match(tagsPattern);
    let tagsHtml = "";
    
    if (tagsMatch) {
        const tagsStr = tagsMatch[1];
        mdContent = mdContent.slice(0, tagsMatch.index).trim();
        const tags = tagsStr.match(/#([\w\u4e00-\u9fa5]+)/g);
        if (tags) {
            const accent = style.accent_color;
            tagsHtml = '<div class="tags-container">';
            for (const tag of tags) {
                tagsHtml += `<span class="tag" style="background: ${accent};">${tag}</span>`;
            }
            tagsHtml += '</div>';
        }
    }
    
    const html = marked.parse(mdContent, { breaks: true, gfm: true });
    return html + tagsHtml;
}

/**
 * 生成封面 HTML
 */
function generateCoverHtml(metadata, styleKey = 'purple') {
    const style = STYLES[styleKey] || STYLES.purple;
    
    const emoji = metadata.emoji || '📝';
    let title = metadata.title || '标题';
    let subtitle = metadata.subtitle || '';
    
    if (title.length > 15) title = title.slice(0, 15);
    if (subtitle.length > 15) subtitle = subtitle.slice(0, 15);
    
    const isDark = styleKey === 'dark';
    const textColor = isDark ? '#ffffff' : '#000000';
    const titleGradient = isDark 
        ? 'linear-gradient(180deg, #ffffff 0%, #cccccc 100%)' 
        : 'linear-gradient(180deg, #2E67B1 0%, #4C4C4C 100%)';
    const innerBg = isDark ? '#1a1a2e' : '#F3F3F3';
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1080, height=1440">
    <title>小红书封面</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Noto Sans SC', 'Source Han Sans CN', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            width: 1080px; height: 1440px; overflow: hidden;
        }
        .cover-container {
            width: 1080px; height: 1440px;
            background: ${style.cover_bg};
            position: relative; overflow: hidden;
        }
        .cover-inner {
            position: absolute; width: 950px; height: 1310px;
            left: 65px; top: 65px;
            background: ${innerBg};
            border-radius: 25px;
            display: flex; flex-direction: column;
            padding: 80px 85px;
        }
        .cover-emoji { font-size: 180px; line-height: 1.2; margin-bottom: 50px; }
        .cover-title {
            font-weight: 900; font-size: 130px; line-height: 1.4;
            background: ${titleGradient};
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            flex: 1;
            display: flex; align-items: flex-start;
            word-break: break-all;
        }
        .cover-subtitle {
            font-weight: 350; font-size: 72px; line-height: 1.4;
            color: ${textColor};
            margin-top: auto;
        }
    </style>
</head>
<body>
    <div class="cover-container">
        <div class="cover-inner">
            <div class="cover-emoji">${emoji}</div>
            <div class="cover-ti
```

### Core Architecture Module: `app/skills/social-push/scripts/render_xhs_v2.py`
```
#!/usr/bin/env python3
"""
小红书卡片渲染脚本 V2 - 智能分页版
将 Markdown 文件渲染为小红书风格的图片卡片

新特性：
1. 智能分页：自动检测内容高度，超出时自动拆分到多张卡片
2. 多种样式：支持多种预设样式主题
3. 字数预估：基于字数预分配内容，减少渲染次数

使用方法:
    python render_xhs_v2.py <markdown_file> [options]

依赖安装:
    pip install markdown pyyaml playwright
    playwright install chromium
"""

import argparse
import asyncio
import os
import re
import sys
from pathlib import Path
from typing import List

try:
    import markdown
    import yaml
    from playwright.async_api import async_playwright, Page  # pyright: ignore[reportMissingImports]
except ImportError as e:
    print(f"缺少依赖: {e}")
    print(
        "请运行: pip install markdown pyyaml playwright && playwright install chromium"
    )
    sys.exit(1)


# 获取脚本所在目录
SCRIPT_DIR = Path(__file__).parent.parent
ASSETS_DIR = SCRIPT_DIR / "assets"

# 卡片尺寸配置 (3:4 比例)
CARD_WIDTH = 1080
CARD_HEIGHT = 1440

# 内容区域安全高度（考虑 padding 和 margin）
# card-inner padding: 60px * 2 = 120px
# card-container padding: 50px * 2 = 100px
# 页码区域: ~80px
# 安全边距: ~40px
SAFE_HEIGHT = CARD_HEIGHT - 120 - 100 - 80 - 40  # ~1100px

# 样式配置
STYLES = {
    "purple": {
        "name": "紫韵",
        "cover_bg": "linear-gradient(180deg, #3450E4 0%, #D266DA 100%)",
        "card_bg": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "accent_color": "#6366f1",
    },
    "xiaohongshu": {
        "name": "小红书红",
        "cover_bg": "linear-gradient(180deg, #FF2442 0%, #FF6B81 100%)",
        "card_bg": "linear-gradient(135deg, #FF2442 0%, #FF6B81 100%)",
        "accent_color": "#FF2442",
    },
    "mint": {
        "name": "清新薄荷",
        "cover_bg": "linear-gradient(180deg, #43e97b 0%, #38f9d7 100%)",
        "card_bg": "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        "accent_color": "#43e97b",
    },
    "sunset": {
        "name": "日落橙",
        "cover_bg": "linear-gradient(180deg, #fa709a 0%, #fee140 100%)",
        "card_bg": "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        "accent_color": "#fa709a",
    },
    "ocean": {
        "name": "深海蓝",
        "cover_bg": "linear-gradient(180deg, #4facfe 0%, #00f2fe 100%)",
        "card_bg": "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        "accent_color": "#4facfe",
    },
    "elegant": {
        "name": "优雅白",
        "cover_bg": "linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%)",
        "card_bg": "linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)",
        "accent_color": "#333333",
        "text_light": "#555555",
    },
    "dark": {
        "name": "暗黑模式",
        "cover_bg": "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
        "card_bg": "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        "accent_color": "#e94560",
    },
}


def parse_markdown_file(file_path: str) -> dict:
    """解析 Markdown 文件，提取 YAML 头部和正文内容"""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 解析 YAML 头部
    yaml_pattern = r"^---\s*\n(.*?)\n---\s*\n"
    yaml_match = re.match(yaml_pattern, content, re.DOTALL)

    metadata = {}
    body = content

    if yaml_match:
        try:
            metadata = yaml.safe_load(yaml_match.group(1)) or {}
        except yaml.YAMLError:
            metadata = {}
        body = content[yaml_match.end() :]

    return {"metadata": metadata, "body": body.strip()}


def split_content_by_separator(body: str) -> list:
    """按照 --- 分隔符拆分正文为多张卡片内容"""
    parts = re.split(r"\n---+\n", body)
    return [part.strip() for part in parts if part.strip()]


def estimate_content_height(content: str) -> int:
    """预估内容高度（基于字数和元素类型）"""
    lines = content.split("\n")
    total_height = 0

    for line in lines:
        line = line.strip()
        if not line:
            total_height += 20  # 空行
            continue

        # 标题
        if line.startswith("# "):
            total_height += 130  # h1: font-size 72 + margin
        elif line.startswith("## "):
            total_height += 110  # h2
        elif line.startswith("### "):
            total_height += 90  # h3
        # 代码块
        elif line.startswith("```"):
            total_height += 80  # 代码块起始/结束
        # 列表
        elif line.startswith(("- ", "* ", "+ ")):
            total_height += 85  # li: line-height ~1.6, font-size 42
        # 引用
        elif line.startswith(">"):
            total_height += 100  # blockquote padding
        # 图片
        elif line.startswith("!["):
            total_height += 300  # 图片高度估计
        # 普通段落
        else:
            # 估算字数
            char_count = len(line)
            # 一行约25-30个中文字，行高1.7，字体42px
            lines_needed = max(1, char_count / 28)
            total_height += int(lines_needed * 42 * 1.7) + 35  # + margin-bottom

    return total_height


def smart_split_content(content: str, max_height: int = SAFE_HEIGHT) -> List[str]:
    """
    智能拆分内容到多张卡片
    基于预估高度进行拆分，尽量保持段落完整
    """
    # 首先尝试识别内容块（以标题或空行分隔）
    blocks = []
    current_block = []

    lines = content.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]

        # 新标题开始新块（除非是第一个）
        if line.strip().startswith("#") and current_block:
            blocks.append("\n".join(current_block))
            current_block = [line]
        # 分隔线
        elif line.strip() == "---":
            if current_block:
                blocks.append("\n".join(current_block))
                current_block = []
        else:
            current_block.append(line)

        i += 1

    if current_block:
        blocks.append("\n".join(current_block))

    # 如果没有明显的块边界，按段落拆分
    if len(blocks) <= 1:
        blocks = [b for b in content.split("\n\n") if b.strip()]

    # 合并块到卡片，确保每张卡片高度不超过限制
    cards = []
    current_card = []
    current_height = 0

    for block in blocks:
        block_height = estimate_content_height(block)

        # 如果单个块就超过限制，需要进一步拆分
        if block_height > max_height:
            # 如果当前卡片有内容，先保存
            if current_card:
                cards.append("\n\n".join(current_card))
                current_card = []
                current_height = 0

            # 将大块按行拆分
            lines = block.split("\n")
            sub_block = []
            sub_height = 0

            for line in lines:
                line_height = estimate_content_height(line)

                if sub_height + line_height > max_height and sub_block:
                    cards.append("\n".join(sub_block))
                    sub_block = [line]
                    sub_height = line_height
                else:
                    sub_block.append(line)
                    sub_height += line_height

            if sub_block:
                cards.append("\n".join(sub_block))

        # 如果当前卡片加上这个块会超，先保存当前卡片
        elif current_height + block_height > max_height and current_card:
            cards.append("\n\n".join(current_card))
            current_card = [block]
            current_height = block_height

        # 否则加入当前卡片
        else:
            current_card.append(block)
            current_height += block_height

    # 保存最后一个卡片
    if current_card:
        cards.append("\n\n".join(current_card))

    return cards if cards else [content]


def convert_markdown_to_html(md_content: str, style: dict = None) -> str:  # pyright: ignore[reportArgumentType]
    """将 Markdown 转换为 HTML"""
    style = style or STYLES["purple"]

    # 处理 tags（以 # 开头的标签）
    tags_pattern = r"((?:#[\w\u4e00-\u9fa5]+\s*)+)$"
    tags_match = re.search(tags_pattern, md_content, re.MULTILINE)
    tags_html = ""

    if tags_match:
        tags_str = tags_match.group(1)
        md_content = md_content[: tags_match.start()].strip()
        tags = re.findall(r"#([\w\u4e00-\u9fa5]+)", tags_str)
        if tags:
            accent = style.get("accent_color", "#6366f1")
            tags_html = '<div class="tags-container">'
            for tag in tags:
                tags_html += (
                    f'<span class="tag" style="background: {accent};">#{tag}</span>'
                )
            tags_html += "</div>"

    # 转换 Markdown 为 HTML
    html = markdown.markdown(
        md_content, extensions=["extra", "codehilite", "tables", "nl2br"]
    )

    return html + tags_html


def generate_cover_html(metadata: dict, style_key: str = "purple") -> str:
    """生成封面 HTML"""
    style = STYLES.get(style_key, STYLES["purple"])

    emoji = metadata.get("emoji", "📝")
    title = metadata.get("title", "标题")
    subtitle = metadata.get("subtitle", "")

    # 动态调整标题字体大小
    title_len = len(title)
    if title_len <= 6:
        title_size = 150  # 极大 (width * 0.14)
    elif title_len <= 10:
        title_size = 130  # 大 (width * 0.12)
    elif title_len <= 18:
        title_size = 100  # 中 (width * 0.09)
    elif title_len <= 30:
        title_size = 80  # 小 (width * 0.07)
    else:
        title_size = 60  # 极小 (width * 0.055)

    # 暗黑模式特殊处理
    is_dark = style_key == "dark"
    text_color = "#ffffff" if is_dark else "#000000"
    title_gradient = (
        "linear-gradient(180deg, #ffffff 0%, #cccccc 100%)"
        if is_dark
        else "linear-gradient(180deg, #2E67B1 0%, #4C4C4C 100%)"
    )
    inner_bg = "#1a1a2e" if is_dark else "#F3F3F3"

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=1080, height=1440">
    <title>小红书封面</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;900&display=swap');
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Noto Sans SC', 'Source Han Sans CN', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            width: 1080px; height: 1440px; overflow: hidden;
        }}
        .cover-container {{
            width: 1080px; height: 1440px;
            background: {style["cover_bg"]};
            position: relative; overflow: hidden;
        }}
        .cover-inner {{
            position: absolute; width: 950px; height: 1310px;
            left: 65px; top: 65px;
            background: {
```

### Core Architecture Module: `app/skills/ui-ux-pro-max/scripts/core.py`
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI/UX Pro Max Core - BM25 search engine for UI/UX style guides
"""

import csv
import re
from pathlib import Path
from math import log
from collections import defaultdict

# ============ CONFIGURATION ============
DATA_DIR = Path(__file__).parent.parent / "data"
MAX_RESULTS = 3

CSV_CONFIG = {
    "style": {
        "file": "styles.csv",
        "search_cols": [
            "Style Category",
            "Keywords",
            "Best For",
            "Type",
            "AI Prompt Keywords",
        ],
        "output_cols": [
            "Style Category",
            "Type",
            "Keywords",
            "Primary Colors",
            "Effects & Animation",
            "Best For",
            "Performance",
            "Accessibility",
            "Framework Compatibility",
            "Complexity",
            "AI Prompt Keywords",
            "CSS/Technical Keywords",
            "Implementation Checklist",
            "Design System Variables",
        ],
    },
    "color": {
        "file": "colors.csv",
        "search_cols": ["Product Type", "Notes"],
        "output_cols": [
            "Product Type",
            "Primary (Hex)",
            "Secondary (Hex)",
            "CTA (Hex)",
            "Background (Hex)",
            "Text (Hex)",
            "Notes",
        ],
    },
    "chart": {
        "file": "charts.csv",
        "search_cols": [
            "Data Type",
            "Keywords",
            "Best Chart Type",
            "Accessibility Notes",
        ],
        "output_cols": [
            "Data Type",
            "Keywords",
            "Best Chart Type",
            "Secondary Options",
            "Color Guidance",
            "Accessibility Notes",
            "Library Recommendation",
            "Interactive Level",
        ],
    },
    "landing": {
        "file": "landing.csv",
        "search_cols": [
            "Pattern Name",
            "Keywords",
            "Conversion Optimization",
            "Section Order",
        ],
        "output_cols": [
            "Pattern Name",
            "Keywords",
            "Section Order",
            "Primary CTA Placement",
            "Color Strategy",
            "Conversion Optimization",
        ],
    },
    "product": {
        "file": "products.csv",
        "search_cols": [
            "Product Type",
            "Keywords",
            "Primary Style Recommendation",
            "Key Considerations",
        ],
        "output_cols": [
            "Product Type",
            "Keywords",
            "Primary Style Recommendation",
            "Secondary Styles",
            "Landing Page Pattern",
            "Dashboard Style (if applicable)",
            "Color Palette Focus",
        ],
    },
    "ux": {
        "file": "ux-guidelines.csv",
        "search_cols": ["Category", "Issue", "Description", "Platform"],
        "output_cols": [
            "Category",
            "Issue",
            "Platform",
            "Description",
            "Do",
            "Don't",
            "Code Example Good",
            "Code Example Bad",
            "Severity",
        ],
    },
    "typography": {
        "file": "typography.csv",
        "search_cols": [
            "Font Pairing Name",
            "Category",
            "Mood/Style Keywords",
            "Best For",
            "Heading Font",
            "Body Font",
        ],
        "output_cols": [
            "Font Pairing Name",
            "Category",
            "Heading Font",
            "Body Font",
            "Mood/Style Keywords",
            "Best For",
            "Google Fonts URL",
            "CSS Import",
            "Tailwind Config",
            "Notes",
        ],
    },
    "icons": {
        "file": "icons.csv",
        "search_cols": ["Category", "Icon Name", "Keywords", "Best For"],
        "output_cols": [
            "Category",
            "Icon Name",
            "Keywords",
            "Library",
            "Import Code",
            "Usage",
            "Best For",
            "Style",
        ],
    },
    "react": {
        "file": "react-performance.csv",
        "search_cols": ["Category", "Issue", "Keywords", "Description"],
        "output_cols": [
            "Category",
            "Issue",
            "Platform",
            "Description",
            "Do",
            "Don't",
            "Code Example Good",
            "Code Example Bad",
            "Severity",
        ],
    },
    "web": {
        "file": "web-interface.csv",
        "search_cols": ["Category", "Issue", "Keywords", "Description"],
        "output_cols": [
            "Category",
            "Issue",
            "Platform",
            "Description",
            "Do",
            "Don't",
            "Code Example Good",
            "Code Example Bad",
            "Severity",
        ],
    },
}

STACK_CONFIG = {
    "html-tailwind": {"file": "stacks/html-tailwind.csv"},
    "react": {"file": "stacks/react.csv"},
    "nextjs": {"file": "stacks/nextjs.csv"},
    "astro": {"file": "stacks/astro.csv"},
    "vue": {"file": "stacks/vue.csv"},
    "nuxtjs": {"file": "stacks/nuxtjs.csv"},
    "nuxt-ui": {"file": "stacks/nuxt-ui.csv"},
    "svelte": {"file": "stacks/svelte.csv"},
    "swiftui": {"file": "stacks/swiftui.csv"},
    "react-native": {"file": "stacks/react-native.csv"},
    "flutter": {"file": "stacks/flutter.csv"},
    "shadcn": {"file": "stacks/shadcn.csv"},
    "jetpack-compose": {"file": "stacks/jetpack-compose.csv"},
}

# Common columns for all stacks
_STACK_COLS = {
    "search_cols": ["Category", "Guideline", "Description", "Do", "Don't"],
    "output_cols": [
        "Category",
        "Guideline",
        "Description",
        "Do",
        "Don't",
        "Code Good",
        "Code Bad",
        "Severity",
        "Docs URL",
    ],
}

AVAILABLE_STACKS = list(STACK_CONFIG.keys())


# ============ BM25 IMPLEMENTATION ============
class BM25:
    """BM25 ranking algorithm for text search"""

    def __init__(self, k1=1.5, b=0.75):
        self.k1 = k1
        self.b = b
        self.corpus = []
        self.doc_lengths = []
        self.avgdl = 0
        self.idf = {}
        self.doc_freqs = defaultdict(int)
        self.N = 0

    def tokenize(self, text):
        """Lowercase, split, remove punctuation, filter short words"""
        text = re.sub(r"[^\w\s]", " ", str(text).lower())
        return [w for w in text.split() if len(w) > 2]

    def fit(self, documents):
        """Build BM25 index from documents"""
        self.corpus = [self.tokenize(doc) for doc in documents]
        self.N = len(self.corpus)
        if self.N == 0:
            return
        self.doc_lengths = [len(doc) for doc in self.corpus]
        self.avgdl = sum(self.doc_lengths) / self.N

        for doc in self.corpus:
            seen = set()
            for word in doc:
                if word not in seen:
                    self.doc_freqs[word] += 1
                    seen.add(word)

        for word, freq in self.doc_freqs.items():
            self.idf[word] = log((self.N - freq + 0.5) / (freq + 0.5) + 1)

    def score(self, query):
        """Score all documents against query"""
        query_tokens = self.tokenize(query)
        scores = []

        for idx, doc in enumerate(self.corpus):
            score = 0
            doc_len = self.doc_lengths[idx]
            term_freqs = defaultdict(int)
            for word in doc:
                term_freqs[word] += 1

            for token in query_tokens:
                if token in self.idf:
                    tf = term_freqs[token]
                    idf = self.idf[token]
                    numerator = tf * (self.k1 + 1)
                    denominator = tf + self.k1 * (
                        1 - self.b + self.b * doc_len / self.avgdl
                    )
                    score += idf * numerator / denominator

            scores.append((idx, score))

        return sorted(scores, key=lambda x: x[1], reverse=True)


# ============ SEARCH FUNCTIONS ============
def _load_csv(filepath):
    """Load CSV and return list of dicts"""
    with open(filepath, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _search_csv(filepath, search_cols, output_cols, query, max_results):
    """Core search function using BM25"""
    if not filepath.exists():
        return []

    data = _load_csv(filepath)

    # Build documents from search columns
    documents = [" ".join(str(row.get(col, "")) for col in search_cols) for row in data]

    # BM25 search
    bm25 = BM25()
    bm25.fit(documents)
    ranked = bm25.score(query)

    # Get top results with score > 0
    results = []
    for idx, score in ranked[:max_results]:
        if score > 0:
            row = data[idx]
            results.append({col: row.get(col, "") for col in output_cols if col in row})

    return results


def detect_domain(query):
    """Auto-detect the most relevant domain from query"""
    query_lower = query.lower()

    domain_keywords = {
        "color": ["color", "palette", "hex", "#", "rgb"],
        "chart": [
            "chart",
            "graph",
            "visualization",
            "trend",
            "bar",
            "pie",
            "scatter",
            "heatmap",
            "funnel",
        ],
        "landing": [
            "landing",
            "page",
            "cta",
            "conversion",
            "hero",
            "testimonial",
            "pricing",
            "section",
        ],
        "product": [
            "saas",
            "ecommerce",
            "e-commerce",
            "fintech",
            "healthcare",
            "gaming",
            "portfolio",
            "crypto",
            "dashboard",
        ],
        "style": [
            "style",
            "design",
            "ui",
            "minimalism",
            "glassmorphism",
            "neumorphism",
            "brutalism",
 
```

### Core Architecture Module: `app/v1/chrome-extension/service-worker.js`
```
const DEFAULT_CANDIDATE_BASES = [
  "http://127.0.0.1:18080",
  "http://localhost:18080",
  "http://127.0.0.1:18081",
  "http://localhost:18081",
  "http://127.0.0.1:18082",
  "http://localhost:18082",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  "http://127.0.0.1:18090",
  "http://localhost:18090"
];

const DEFAULT_STATE = {
  detected: false,
  apiBase: "",
  lastActiveAt: 0,
  lastError: "",
  lastProbeLine: ""
};

const COMMAND_RUNTIME_STATE = {
  polling: false,
  executing: false,
  currentCommandId: "",
  lastCommandAt: 0,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getState() {
  const { sageState } = await chrome.storage.local.get("sageState");
  return { ...DEFAULT_STATE, ...(sageState || {}) };
}

async function setState(patch) {
  const next = { ...(await getState()), ...patch };
  await chrome.storage.local.set({ sageState: next });
  return next;
}

async function fetchJson(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return data;
}

async function fetchWithTimeout(url, timeoutMs = 800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function checkBackend(base) {
  try {
    const response = await fetchWithTimeout(`${base}/active`, 800);
    if (!response.ok) return false;
    const text = (await response.text()).trim().toLowerCase();
    return text.includes("service is available");
  } catch (_err) {
    return false;
  }
}

async function probeBackend(base) {
  try {
    const response = await fetchWithTimeout(`${base}/active`, 800);
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    const text = (await response.text()).trim().toLowerCase();
    if (text.includes("service is available")) {
      return { ok: true, reason: "active-ok" };
    }
    return { ok: false, reason: "active-mismatch" };
  } catch (err) {
    return { ok: false, reason: err?.name === "AbortError" ? "timeout" : "network-error" };
  }
}

async function scanFallbackPorts() {
  const scannedBases = [];
  // Bounded scan range for desktop fallback ports.
  for (let port = 18083; port <= 18120; port++) {
    scannedBases.push(`http://127.0.0.1:${port}`);
    scannedBases.push(`http://localhost:${port}`);
  }

  const batchSize = 12;
  for (let i = 0; i < scannedBases.length; i += batchSize) {
    const batch = scannedBases.slice(i, i + batchSize);
    const checks = await Promise.all(batch.map(async (base) => ({ base, ok: await checkBackend(base) })));
    const matched = checks.find((item) => item.ok);
    if (matched) return matched.base;
  }
  return "";
}

async function detectBackend(force = false) {
  const state = await getState();
  if (state.detected && state.apiBase && !force) {
    try {
      if (await checkBackend(state.apiBase)) {
        return state;
      }
    } catch (err) {
      console.warn("Current backend unavailable, redetecting", err);
    }
  }

  const { customApiBase, recentApiBase } = await chrome.storage.local.get(["customApiBase", "recentApiBase"]);
  const candidates = [];
  if (customApiBase && typeof customApiBase === "string") {
    candidates.push(customApiBase.trim());
  }
  if (recentApiBase && typeof recentApiBase === "string") {
    candidates.push(recentApiBase.trim());
  }
  candidates.push(...DEFAULT_CANDIDATE_BASES);
  const diagnostics = [];

  for (const base of candidates) {
    if (!base) continue;
    const result = await probeBackend(base);
    diagnostics.push(`${base} -> ${result.reason}`);
    if (result.ok) {
      await chrome.storage.local.set({ recentApiBase: base });
      return await setState({
        detected: true,
        apiBase: base,
        lastActiveAt: Date.now(),
        lastError: "",
        lastProbeLine: `已命中 ${base}`
      });
    }
  }

  const scanned = await scanFallbackPorts();
  if (scanned) {
    await chrome.storage.local.set({ recentApiBase: scanned });
    return await setState({
      detected: true,
      apiBase: scanned,
      lastActiveAt: Date.now(),
      lastError: "",
      lastProbeLine: `端口扫描命中 ${scanned}`
    });
  }

  const probeLine = diagnostics.slice(0, 6).join(" | ");

  return await setState({
    detected: false,
    apiBase: "",
    lastError: "Sage Desktop service not found on localhost",
    lastProbeLine: probeLine || "未发现可用 /active 接口"
  });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) return null;
  const tab = tabs[0];
  return {
    id: tab.id,
    title: tab.title || "",
    url: tab.url || "",
    windowId: tab.windowId
  };
}

async function readPageContext(tabId) {
  if (!tabId) return null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
        const selectedText = window.getSelection ? String(window.getSelection()) : "";
        const isVisible = (el) => {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          if (!style || style.display === "none" || style.visibility === "hidden") return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        const interactiveNodes = Array.from(
          document.querySelectorAll(
            "a,button,input,textarea,select,[role='button'],[role='link'],[role='textbox'],[contenteditable='true'],[tabindex]"
          )
        )
          .filter(isVisible)
          .slice(0, 120)
          .map((el, idx) => ({
            dom_id: `d${idx}`,
            tag: (el.tagName || "").toLowerCase(),
            text: (el.innerText || el.textContent || "").trim().slice(0, 80),
            role: el.getAttribute("role") || "",
            type: el.getAttribute("type") || "",
            placeholder: el.getAttribute("placeholder") || "",
            aria_label: el.getAttribute("aria-label") || "",
          }));
        const serializedLines = interactiveNodes.map((node) => {
          const chunks = [node.dom_id, node.tag];
          if (node.role) chunks.push(`role=${node.role}`);
          if (node.type) chunks.push(`type=${node.type}`);
          if (node.placeholder) chunks.push(`placeholder=${node.placeholder}`);
          if (node.text) chunks.push(`text=${node.text}`);
          return chunks.join(" | ");
        });
        return {
          schema_version: "browser_context.v2",
          title: document.title || "",
          url: location.href,
          domain: location.hostname || "",
          language: document.documentElement?.lang || "",
          ready_state: document.readyState,
          selectedText: selectedText.slice(0, 5000),
          page_summary: bodyText.slice(0, 1200),
          dom_nodes: interactiveNodes,
          serialized_dom: serializedLines.join("\n"),
        };
      }
    });
    return results?.[0]?.result || null;
  } catch (err) {
    return {
      error: `Cannot read page context: ${err?.message || String(err)}`
    };
  }
}

async function listWindowTabs(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  return (tabs || []).map((tab) => ({
    id: tab.id,
    windowId: tab.windowId,
    active: Boolean(tab.active),
    title: tab.title || "",
    url: tab.url || "",
    status: tab.status || "",
  }));
}

async function resolveTargetTabId(args, activeTab) {
  if (args?.tabId) {
    const parsed = Number(args.tabId);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (args?.tab_id) {
    const parsed = Number(args.tab_id);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (args?.tabIdSuffix || args?.tab_id_suffix) {
    const suffix = String(args.tabIdSuffix || args.tab_id_suffix);
    const tabs = await listWindowTabs(activeTab?.windowId);
    const matched = tabs.find((tab) => String(tab.id || "").endsWith(suffix));
    if (matched?.id) return matched.id;
  }
  return activeTab?.id || null;
}

function parseDomIndex(args) {
  const raw = args?.domId || args?.dom_id || "";
  if (!raw) return null;
  const text = String(raw).trim().toLowerCase();
  const matched = text.match(/^d(\d+)$/);
  if (!matched) return null;
  const idx = Number(matched[1]);
  if (!Number.isFinite(idx) || idx < 0) return null;
  return idx;
}

async function waitForTabComplete(tabId, timeoutMs = 30000) {
  const timeout = Math.max(1000, Math.min(180000, Number(timeoutMs) || 30000));
  const start = Date.now();

  try {
    const current = await chrome.tabs.get(tabId);
    if (current?.status === "complete") {
      return { ok: true, waitMs: Date.now() - start, status: "complete" };
    }
  } catch (err) {
    return { ok: false, error: `Tab unavailable: ${err?.message || String(err)}` };
  }

  return await new Promise((resolve) => {
    let done = false;
    let timer = null;

    const finish = (payload) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(payload);
    };

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo?.status === "complete") {
        finish({ ok: true, waitMs: Date.now() - start, status: "complete" });
      }
    }
```

### Core Architecture Module: `app/v1/cli/runtime/rendering.py`
```
import json
import re
import sys
from typing import Any, Dict, List, Optional


TOOL_NAME_TAG_PATTERN = re.compile(r"<tool_name>\s*([A-Za-z0-9_.-]+)\s*</tool_name>")
TOOL_CALL_FUNCTION_PATTERN = re.compile(r"<call\s+function=\"([A-Za-z0-9_.-]+)\"")
TOOL_RESULT_NAME_PATTERN = re.compile(r"<function_result\s+name=\"([A-Za-z0-9_.-]+)\"")
DSML_INVOKE_NAME_PATTERN = re.compile(r"<｜DSML｜invoke\s+name=\"([A-Za-z0-9_.-]+)\"")
DSML_FILE_PATH_PATTERN = re.compile(
    r"<｜DSML｜parameter\s+name=\"file_path\"\s+string=\"true\">(.*?)</｜DSML｜parameter>",
    re.DOTALL,
)
SKILL_TAG_PATTERN = re.compile(r"<skill>\s*([A-Za-z0-9_.-]+)\s*</skill>", re.DOTALL)
SKILL_INPUT_TAG_PATTERN = re.compile(r"<skill_input>", re.DOTALL)
SKILL_RESULT_TAG_PATTERN = re.compile(r"<skill_result>", re.DOTALL)
RAW_ASSISTANT_BLOCK_PATTERNS = (
    re.compile(r"(^|\n)\s*<skill>\s*.*?</skill>", re.DOTALL),
    re.compile(r"(^|\n)\s*<skill_input>.*?</skill_input>", re.DOTALL),
    re.compile(r"(^|\n)\s*<skill_result>.*?</skill_result>", re.DOTALL),
    re.compile(r"(^|\n)\s*<call\s+function=\"[A-Za-z0-9_.-]+\".*?</call>", re.DOTALL),
    re.compile(
        r"(^|\n)\s*<function_result\s+name=\"[A-Za-z0-9_.-]+\".*?</function_result>",
        re.DOTALL,
    ),
    re.compile(r"(^|\n)\s*<function_results>.*?</function_results>", re.DOTALL),
    re.compile(r"(^|\n)\s*<tool_name>\s*.*?</tool_name>", re.DOTALL),
    re.compile(r"(^|\n)\s*<｜DSML｜tool_calls>.*?</｜DSML｜tool_calls>", re.DOTALL),
    re.compile(r"(^|\n)\s*<｜DSML｜invoke\b.*?</｜DSML｜invoke>", re.DOTALL),
)
RAW_ASSISTANT_START_PATTERNS = (
    re.compile(r"(^|\n)\s*<skill>"),
    re.compile(r"(^|\n)\s*<skill_input>"),
    re.compile(r"(^|\n)\s*<skill_result>"),
    re.compile(r"(^|\n)\s*<call\s+function=\""),
    re.compile(r"(^|\n)\s*<function_result\b"),
    re.compile(r"(^|\n)\s*<function_results>"),
    re.compile(r"(^|\n)\s*<tool_name>"),
    re.compile(r"(^|\n)\s*<｜DSML｜"),
)
INTERNAL_SELF_CHECK_PATTERNS = (
    re.compile(
        r"Self-check: Repeating execution loop detected.*?clarification question\.",
        re.DOTALL,
    ),
    re.compile(
        r"自检：检测到执行出现重复循环模式.*?最小必要澄清问题。",
        re.DOTALL,
    ),
)
INTERNAL_ASSISTANT_EVENT_TYPES = {
    "analysis",
    "observation",
    "plan",
    "reasoning_content",
    "task_analysis",
    "thinking",
}


def _empty_render_state() -> Dict[str, Any]:
    return {
        "assistant_buffer": "",
        "assistant_emitted": "",
        "tool_tag_buffer": "",
        "announced_tools": set(),
        "announced_file_paths": set(),
        "last_tool_name": None,
        "last_visible_phase": None,
    }


def _split_visible_assistant_content(buffer: str) -> tuple[str, str]:
    working = _strip_internal_self_check(buffer)
    previous = None
    while working != previous:
        previous = working
        for pattern in RAW_ASSISTANT_BLOCK_PATTERNS:
            working = pattern.sub("", working)

    start_positions = []
    for pattern in RAW_ASSISTANT_START_PATTERNS:
        match = pattern.search(working)
        if match:
            start_positions.append(match.start())

    if not start_positions:
        return working, ""

    split_at = min(start_positions)
    return working[:split_at], working[split_at:]


def _strip_internal_self_check(text: str) -> str:
    cleaned = text
    for pattern in INTERNAL_SELF_CHECK_PATTERNS:
        cleaned = pattern.sub("", cleaned)
    return cleaned


def _render_assistant_content_delta(render_state: Dict[str, Any], content: str) -> str:
    buffer = (render_state.get("assistant_buffer") or "") + content
    visible, pending = _split_visible_assistant_content(buffer)
    render_state["assistant_buffer"] = visible + pending

    emitted = render_state.get("assistant_emitted") or ""
    if visible.startswith(emitted):
        delta = visible[len(emitted) :]
    else:
        delta = visible
    render_state["assistant_emitted"] = visible
    return delta


def _collect_event_tool_names(
    event: Dict[str, Any], *, content_buffer: str = ""
) -> List[str]:
    tool_names: List[str] = []

    tool_calls = event.get("tool_calls") or []
    for tool_call in tool_calls:
        function = tool_call.get("function", {}) if isinstance(tool_call, dict) else {}
        name = function.get("name")
        if name:
            tool_names.append(name)

    metadata = event.get("metadata") or {}
    metadata_tool_name = metadata.get("tool_name")
    if isinstance(metadata_tool_name, str) and metadata_tool_name:
        tool_names.append(metadata_tool_name)

    event_tool_name = event.get("tool_name")
    if isinstance(event_tool_name, str) and event_tool_name:
        tool_names.append(event_tool_name)

    combined_content = content_buffer
    content = event.get("content")
    if isinstance(content, str) and content:
        combined_content += content
    if combined_content:
        for match in TOOL_NAME_TAG_PATTERN.findall(combined_content):
            if match:
                tool_names.append(match.strip())
        for match in TOOL_CALL_FUNCTION_PATTERN.findall(combined_content):
            if match:
                tool_names.append(match.strip())
        for match in TOOL_RESULT_NAME_PATTERN.findall(combined_content):
            if match:
                tool_names.append(match.strip())
        for match in DSML_INVOKE_NAME_PATTERN.findall(combined_content):
            if match:
                tool_names.append(match.strip())
        for match in SKILL_TAG_PATTERN.findall(combined_content):
            if match:
                tool_names.append(match.strip())

    return sorted(set(tool_names))


def _collect_event_file_paths(
    event: Dict[str, Any], *, content_buffer: str = ""
) -> List[str]:
    file_paths: List[str] = []

    tool_calls = event.get("tool_calls") or []
    for tool_call in tool_calls:
        if not isinstance(tool_call, dict):
            continue
        function = tool_call.get("function", {}) or {}
        name = function.get("name")
        arguments = function.get("arguments")
        if name not in {"FileWrite", "WriteFile", "file_write"}:
            continue
        if isinstance(arguments, str) and arguments.strip():
            try:
                parsed = json.loads(arguments)
            except Exception:  # noqa: BLE001
                parsed = None
            if isinstance(parsed, dict):
                path = parsed.get("file_path") or parsed.get("path")
                if isinstance(path, str) and path.strip():
                    file_paths.append(path.strip())

    metadata = event.get("metadata") or {}
    metadata_path = metadata.get("file_path") or metadata.get("path")
    if isinstance(metadata_path, str) and metadata_path.strip():
        file_paths.append(metadata_path.strip())

    combined_content = content_buffer
    content = event.get("content")
    if isinstance(content, str) and content:
        combined_content += content
    if combined_content:
        for match in DSML_FILE_PATH_PATTERN.findall(combined_content):
            path = (match or "").strip()
            if path:
                file_paths.append(path)

    return sorted(set(file_paths))


def _buffer_has_skill_io_markup(buffer: str) -> bool:
    return bool(
        SKILL_INPUT_TAG_PATTERN.search(buffer)
        or SKILL_RESULT_TAG_PATTERN.search(buffer)
    )


def _print_plain_event(event: Dict[str, Any], render_state: Dict[str, Any]) -> None:
    event_type = event.get("type")
    if event_type in INTERNAL_ASSISTANT_EVENT_TYPES:
        return
    if event_type == "stream_end":
        if not sys.stdout.isatty():
            return
        sys.stdout.write("\n")
        sys.stdout.flush()
        return

    content = event.get("content")
    if isinstance(content, str) and content:
        tool_tag_buffer = (render_state.get("tool_tag_buffer") or "") + content
        render_state["tool_tag_buffer"] = tool_tag_buffer[-2048:]

    names = _collect_event_tool_names(
        event, content_buffer=render_state.get("tool_tag_buffer") or ""
    )
    if names:
        announced_tools = render_state.setdefault("announced_tools", set())
        unseen_names = [name for name in names if name not in announced_tools]
        if unseen_names:
            announced_tools.update(unseen_names)
            render_state["last_tool_name"] = unseen_names[-1]
            render_state["last_visible_phase"] = "tool"
            sys.stderr.write(f"\n[tool] {', '.join(unseen_names)}\n")
            sys.stderr.flush()

    file_paths = _collect_event_file_paths(
        event, content_buffer=render_state.get("tool_tag_buffer") or ""
    )
    if file_paths:
        announced_file_paths = render_state.setdefault("announced_file_paths", set())
        unseen_paths = [path for path in file_paths if path not in announced_file_paths]
        if unseen_paths:
            announced_file_paths.update(unseen_paths)
            for path in unseen_paths:
                sys.stderr.write(f"[file] wrote to: {path}\n")
            sys.stderr.flush()

    role = event.get("role")
    if role == "assistant" and isinstance(content, str) and content:
        visible_delta = _render_assistant_content_delta(render_state, content)
        if visible_delta:
            render_state["last_visible_phase"] = "assistant_text"
            render_state["last_tool_name"] = None
            sys.stdout.write(visible_delta)
            sys.stdout.flush()
        return

    if event_type == "error":
        sys.stderr.write(f"\n[error] {event.get('content', 'Unknown error')}\n")
        sys.stderr.flush()


def _emit_stream_idle_notice(idle_seconds: float) -> None:
    sys.stderr.write(f"\n{_build_stream_idle_notice(idle_seconds)}\n")
    sys.stderr.flush()


def _build_stream_idle_notice(idle_seconds: float) -> str:
    return f"[working] still running ({idle_seconds:.1f}s since last event)"


def _emit_stream_idle_notice_for_state(
    render_state: Dict[str, Any], idle_seconds: float
) -> None:
    message = _build_st
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #281** (2026-10-10): **docs: clarify desktop installer quickstart**
  *Symptoms*: ## Summary - Add a short installer-first quickstart before source-build instructions in the English and Chinese READMEs. - Clarify bundled Python/backend, supported platforms, Linux system dependencies, possible model-service costs, and signing limitations. - Link existing Desktop guides and v2.0.0 release notes.  ## Validation - Checked the guidance against existing Desktop documentation and v2.0.0 release notes. - Reviewed the GitHub diff: only README.md and README_CN.md additions; no source-build instructions or code changed. - Documentation-only change. Runtime tests and installer execution were not run.  Draft for review; no merge or deployment included.

- **Issue #280** (2026-10-09): **fix(v2): omit Responses output_schema for text tool results**
  *Symptoms*: 

- **Issue #279** (2026-10-09): **Add a keyless Parallel Search MCP example for SAgents v2**
  *Symptoms*: Adds a runnable example for free, keyless web search and page fetch through SAgents v2's MCP catalog and executor. Install Sage with Python 3.12+, then run `python -m examples.sagents_v2_parallel_search`, optionally with `--fetch-url`. The example uses Streamable HTTP and leaves existing providers and saved settings unchanged. It demonstrates explicit host-side calls; Agent authorization setup is linked separately.  I work at Parallel. For context, here are [Artificial Analysis's Search API benchmarks](https://artificialanalysis.ai/agents/search-api).  Tested: clean editable installation, anonymous live search/fetch with useful excerpts, SDK request identity and cleanup checks, 24 focused Python tests, and the architecture check.

- **Issue #278** (2026-10-08): **docs(mcp): explain authenticated remote MCP and approval in v2**
  *Symptoms*: The v2 MCP guide describes connection management, but does not show how a Bearer-authenticated remote connection reaches an authorized tool call. This adds matching English and Chinese guidance with a generic Streamable HTTP endpoint and explicit token loading.  It distinguishes Desktop and Server payload fields, current v2 source from legacy releases, and service credentials from Sage tool scopes and approval. It also explains discovery, uncertain remote outcomes after timeout/cancellation, and session/application cleanup. The example uses no vendor-specific service and adds no runtime adapter.  Related to #272.  Validation:  - `python docs/scripts/check_docs.py` — passed (52 current pages). - `python -m pytest tests/sagents/v2/test_mcp_tool_bridge_matrix.py tests/sagents/v2/test_policy_matrix.py -q` — 71 passed. - Offline probe with MCP SDK 1.28.1 and the current v2 builder, Agent Run and scheduler: synthetic Bearer authentication and discovery; suspension before the call; a synthetic approval reply followed by one dispatched tool call; SDK session and application cleanup. The English and Chinese Python snippets were asserted to be identical, then their shared code body was executed; missing/blank keys and wrong-key discovery were rejected. - `git diff --check` — passed.  The probe used a loopback server, scripted model and programmatic approval fixture. It did not test a human approval, Desktop GUI, Server database/auth API, real model or remote production service. The ful

- **Issue #277** (2026-10-08): **fix(v2): add sandbox read paths and resume persistent summaries**
  *Symptoms*: Local sandbox commands need explicit read access to host-provided runtime directories. Long conversations also need bounded summary progress without letting inference-only tool filtering invalidate checkpoints or consume prompt budget.  This PR adds optional host-configured `read_paths`, wired through Desktop and the extension registry. macOS uses Seatbelt read access and Linux uses read-only binds. The default remains empty; relative paths and the filesystem root are rejected.  Context reduction uses a filtered payload for budget accounting and summary input, while a canonical source-position mapping retains raw-history coverage hashes. Missing/partial tool pairs and old automatic Memory results no longer force unnecessary history loss or summary-source failures. Mixed tool batches, supplemental tool context, repeated immutable messages and developer instructions retain correct ordering and coverage. Runtime injection is reserved before reduction.  Summary work is bounded per projection. Valid partial prefixes are checkpointed for later continuation; oversized summaries cannot replace a checkpoint, and incompatible checkpoints remain until a valid replacement is saved. The summary plus mandatory retained messages must fit the reserved budget before persistence.  The PR also updates bilingual Server route/environment references to current source and prepares disposable Ubuntu CI runners for native user-namespace sandbox tests. A bubblewrap capability/startup preflight catches

- **Issue #276** (2026-09-28): **refactor: isolate v1/v2 code and standalone AnyTool MCP**
  *Symptoms*: ## Problem and resulting structure  Legacy and v2 code were mixed across top-level and application directories, and v2 entry points could reach legacy configuration and services. This change makes ownership explicit:  - Keep engines under `sagents/v1` and `sagents/v2`, and applications under `app/v1` and `app/v2`. Legacy application services now belong to `app/v1/common`. - Place the version-selecting `sage` command and Rust terminal under `clients`. Preserve command usage while isolating v1 and v2 CLI implementations; old deep Python import paths intentionally change. - Make AnyTool an independently runnable MCP with explicit model configuration and no imports from either Sage generation. Keep legacy database adaptation in v1. - Group scripts by purpose/version, retain `app/skills` as the only bundled skills source, and update tests, packaging, deployment, CI, resource discovery and documentation for the final layout. - Add architecture/import boundary checks to CI and regression tests for CLI isolation, AnyTool and required Windows build inputs. Remove tracked generated Tauri schemas.  Most changed files are moves. Local dependency/cache cleanup and archived user skills are not included in Git.  ## Validation  Full details and limitations: [runtime verification report](docs/V1_V2_RUNTIME_CHECK.md).  - Architecture/import check: 1,338 Python files, zero issues; staged diff formatting check passed. - SAgents v1: 1,519 passed, 7 skipped; v2: 2,311 passed, 12 failed, 20 skipped

- **Issue #275** (2026-09-28): **fix(v2): 修复取消恢复生命周期并支持插件配置沙箱 PATH**
  *Symptoms*: 长工具等待时，driver 被取消不再被误判为 worker shutdown。执行先记录 `tool.call.unknown`，再恢复未完成的工具屏障；恢复任务继续受租约续期监控，续租失败会取消恢复，恢复中关停也会记录 Run 终态并释放租约。  本地沙箱的命令搜索路径改由插件 `command_path` 配置，不再在资源边界写死 Homebrew 前缀。未配置时使用插件创建时的宿主 PATH；直接命令和 shell 使用同一条路径。已接通插件配置 schema、工厂和 Desktop 配置缓存，并补充中英文文档。PATH 配置不会扩大沙箱文件权限。  验证： - 恢复、Agent Loop、插件注册和沙箱聚焦测试：170 passed，1 skipped；排除 8 项单独检查的原生环境相关测试。 - Desktop 插件/沙箱配置测试：17 passed。 - 新增真实 macOS Seatbelt 测试通过，验证自定义 PATH 下的直接短命令和 shell 内部短命令。 - 扩大的原生沙箱检查：198 passed、12 failed、1 skipped；在修复前提交 5728e499 上复现了完全相同的 12 项失败（Rosetta/Python 运行时启动问题）。 - Ruff 和 git diff --check 通过。 

- **Issue #274** (2026-09-24): **fix(v2): keep full skill descriptions in the catalog**
  *Symptoms*: 

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

### Incident Patch 1: `ac0f83bc` (2026-10-10)
**Commit Message**: Merge pull request #281 from ZHangZHengEric/docs/desktop-installer-quickstart

docs: clarify desktop installer quickstart

**File**: `README.md` (modified, +7/-0)
```diff
@@ -42,6 +42,13 @@
 | 🧠 **SAgents v2** — Build agents into your own application | [Runtime quick start](sagents/v2/README.md#quick-start) |
 | 📦 **Desktop installers** — Available release builds | [Downloads & release instructions](https://github.com/ZHangZHengEric/Sage/releases/tag/v2.0.0) |
 
+### 📦 Desktop installer
+
+1. Download [Sage 2.0.0](https://github.com/ZHangZHengEric/Sage/releases/tag/v2.0.0) for macOS (arm64/x86_64), Windows (x86_64), or Linux (arm64/x86_64).
+2. Install and open Sage. Python and the backend are bundled; no repository checkout, system Python, or Flutter is needed. Linux still requires GTK and bubblewrap.
+3. Add your model in Settings → Configure an Agent → Start a conversation. Your model service may charge usage fees. See the [Desktop guide](docs/en/applications/DESKTOP.md#first-task).
+4. macOS packages are not notarized; Windows installers are not code-signed. See the [release notes](release_notes/v2.0.0.md) for package details.
+
 ### 💻 Desktop from source
 
 Requires **Python 3.12+** and **Flutter** with Dart `^3.12.2` and desktop support. On macOS:
```

**File**: `README_CN.md` (modified, +7/-0)
```diff
@@ -42,6 +42,13 @@
 | 🧠 **SAgents v2** — 将智能体能力集成到自己的应用 | [运行时快速开始](sagents/v2/README.md#quick-start) |
 | 📦 **桌面安装包** — 已发布版本 | [下载与版本说明](https://github.com/ZHangZHengEric/Sage/releases/tag/v2.0.0) |
 
+### 📦 安装桌面端
+
+1. 下载 [Sage 2.0.0](https://github.com/ZHangZHengEric/Sage/releases/tag/v2.0.0)：支持 macOS（arm64/x86_64）、Windows（x86_64）和 Linux（arm64/x86_64）。
+2. 安装并打开 Sage。安装包已包含 Python 和后端，无需克隆仓库、安装系统 Python 或 Flutter；Linux 仍需 GTK 和 bubblewrap。
+3. 在设置中添加模型 → 配置 Agent → 开始对话。模型服务可能收取使用费用，操作步骤见[桌面端指南](docs/zh/applications/DESKTOP.md#第一个任务)。
+4. macOS 安装包未公证，Windows 安装包未做代码签名；各类安装包详情见 [版本说明](release_notes/v2.0.0.md)。
+
 ### 💻 从源码启动桌面端
 
 需要 **Python 3.12+**，以及支持桌面构建、Dart 版本满足 `^3.12.2` 的 **Flutter**。macOS 下运行：
```

---

### Incident Patch 2: `66ec10a2` (2026-10-10)
**Commit Message**: docs: add Chinese desktop installer quickstart

Match the concise English installer guidance in the Chinese README.

**File**: `README_CN.md` (modified, +7/-0)
```diff
@@ -42,6 +42,13 @@
 | 🧠 **SAgents v2** — 将智能体能力集成到自己的应用 | [运行时快速开始](sagents/v2/README.md#quick-start) |
 | 📦 **桌面安装包** — 已发布版本 | [下载与版本说明](https://github.com/ZHangZHengEric/Sage/releases/tag/v2.0.0) |
 
+### 📦 安装桌面端
+
+1. 下载 [Sage 2.0.0](https://github.com/ZHangZHengEric/Sage/releases/tag/v2.0.0)：支持 macOS（arm64/x86_64）、Windows（x86_64）和 Linux（arm64/x86_64）。
+2. 安装并打开 Sage。安装包已包含 Python 和后端，无需克隆仓库、安装系统 Python 或 Flutter；Linux 仍需 GTK 和 bubblewrap。
+3. 在设置中添加模型 → 配置 Agent → 开始对话。模型服务可能收取使用费用，操作步骤见[桌面端指南](docs/zh/applications/DESKTOP.md#第一个任务)。
+4. macOS 安装包未公证，Windows 安装包未做代码签名；各类安装包详情见 [版本说明](release_notes/v2.0.0.md)。
+
 ### 💻 从源码启动桌面端
 
 需要 **Python 3.12+**，以及支持桌面构建、Dart 版本满足 `^3.12.2` 的 **Flutter**。macOS 下运行：
```

---

### Incident Patch 3: `998b50fe` (2026-10-10)
**Commit Message**: docs: clarify desktop installer quickstart

Add an installer-first entry point with supported platforms, bundled runtime, model-service costs, and signing limitations.

**File**: `README.md` (modified, +7/-0)
```diff
@@ -42,6 +42,13 @@
 | 🧠 **SAgents v2** — Build agents into your own application | [Runtime quick start](sagents/v2/README.md#quick-start) |
 | 📦 **Desktop installers** — Available release builds | [Downloads & release instructions](https://github.com/ZHangZHengEric/Sage/releases/tag/v2.0.0) |
 
+### 📦 Desktop installer
+
+1. Download [Sage 2.0.0](https://github.com/ZHangZHengEric/Sage/releases/tag/v2.0.0) for macOS (arm64/x86_64), Windows (x86_64), or Linux (arm64/x86_64).
+2. Install and open Sage. Python and the backend are bundled; no repository checkout, system Python, or Flutter is needed. Linux still requires GTK and bubblewrap.
+3. Add your model in Settings → Configure an Agent → Start a conversation. Your model service may charge usage fees. See the [Desktop guide](docs/en/applications/DESKTOP.md#first-task).
+4. macOS packages are not notarized; Windows installers are not code-signed. See the [release notes](release_notes/v2.0.0.md) for package details.
+
 ### 💻 Desktop from source
 
 Requires **Python 3.12+** and **Flutter** with Dart `^3.12.2` and desktop support. On macOS:
```

---

### Incident Patch 4: `6cddbff9` (2026-10-10)
**Commit Message**: fix(release): support Windows storage and macOS Intel runtime dependencies

**File**: `release_notes/v2.0.0.md` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ All packages must pass verification before Actions creates the `v2.0.0` tag and
 | Compose/Kubernetes, existing deployment images | V1 deployment references / 仍部署 v1 |
 | Legacy Desktop release workflow | Archived; no v1 application builds / 已归档，不再打包旧应用 |
 
+Windows uses native byte-range locks for single-writer ownership. Files are flushed before atomic replacement; directory-entry fsync is available on POSIX only, so Windows does not have the same power-loss durability guarantee.
+
 Server v2 supports one worker. Built-in runtime stores do not establish distributed deployment support. This version number does not change those execution boundaries.
 
 2.0 发布统一了当前产品版本和发布包；仓库仍保留 v1 代码、兼容入口与旧部署文件，因此不能把整个仓库都视为已迁移到 v2。桌面端安装与源码启动见 `app/v2/desktop/README.md`，服务端启动见 `app/v2/server/README.md`。
```

**File**: `sagents/v2/runtime/execution/scheduler/plugins/filesystem.py` (modified, +27/-9)
```diff
@@ -3,6 +3,7 @@
 from __future__ import annotations
 
 import asyncio
+import errno
 import heapq
 import hashlib
 import json
@@ -29,9 +30,14 @@
 
 try:
     import fcntl
-except ImportError:  # pragma: no cover - Windows requires a lock adapter.
+except ImportError:  # pragma: no cover - Windows uses msvcrt below.
     fcntl = None  # type: ignore[assignment]
 
+try:
+    import msvcrt
+except ImportError:  # pragma: no cover - POSIX uses fcntl above.
+    msvcrt = None  # type: ignore[assignment]
+
 
 _T = TypeVar("_T")
 
@@ -653,11 +659,13 @@ def _write(self, state: dict[str, Any]) -> None:
                 handle.flush()
                 os.fsync(handle.fileno())
             os.replace(temporary, self.path)
-            descriptor = os.open(self.root, os.O_RDONLY)
-            try:
-                os.fsync(descriptor)
-            finally:
-                os.close(descriptor)
+            # Windows CRT cannot open directories; file data was fsynced above.
+            if os.name != "nt":
+                descriptor = os.open(self.root, os.O_RDONLY)
+                try:
+                    os.fsync(descriptor)
+                finally:
+                    os.close(descriptor)
         finally:
             temporary.unlink(missing_ok=True)
 
@@ -700,7 +708,7 @@ async def close(self) -> None:
         self._release_writer_lock()
 
     def _acquire_writer_lock(self, root: Path) -> None:
-        if fcntl is None:
+        if fcntl is None and msvcrt is None:
             self._writer_handle.close()
             raise SageV2Error(
                 RuntimeErrorInfo(
@@ -710,9 +718,16 @@ def _acquire_writer_lock(self, root: Path) -> None:
                 )
             )
         try:
-            fcntl.flock(self._writer_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
-        except BlockingIOError as exc:
+            if fcntl is not None:
+                fcntl.flock(self._writer_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
+            else:
+                # Always lock the same byte, including in a newly created file.
+                self._writer_handle.seek(0)
+                msvcrt.locking(self._writer_handle.fileno(), msvcrt.LK_NBLCK, 1)
+        except OSError as exc:
             self._writer_handle.close()
+            if exc.errno not in {errno.EACCES, errno.EAGAIN, errno.EDEADLK}:
+                raise
             raise SchedulerInUseError(
                 RuntimeErrorInfo(
                     code="scheduler.in_use",
@@ -728,6 +743,9 @@ def _release_writer_lock(self) -> None:
             return
         if fcntl is not None:
             fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
+        elif msvcrt is not None:
+            handle.seek(0)
+            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
         handle.close()
 
 
```

**File**: `sagents/v2/runtime/session/migration.py` (modified, +3/-0)
```diff
@@ -503,6 +503,9 @@ def _atomic_json_replace(path: Path, payload: dict[str, Any]) -> None:
 
 
 def _fsync_directory(path: Path) -> None:
+    # Windows CRT cannot open directories; file data is fsynced before replace.
+    if os.name == "nt":
+        return
     descriptor = os.open(path, os.O_RDONLY)
     try:
         os.fsync(descriptor)
```

**File**: `sagents/v2/runtime/session/plugins/filesystem.py` (modified, +25/-4)
```diff
@@ -9,6 +9,7 @@
 from __future__ import annotations
 
 import asyncio
+import errno
 import hashlib
 import itertools
 import json
@@ -44,9 +45,14 @@
 
 try:
     import fcntl
-except ImportError:  # pragma: no cover - Windows hosts need a dedicated lock adapter.
+except ImportError:  # pragma: no cover - Windows uses msvcrt below.
     fcntl = None  # type: ignore[assignment]
 
+try:
+    import msvcrt
+except ImportError:  # pragma: no cover - POSIX uses fcntl above.
+    msvcrt = None  # type: ignore[assignment]
+
 
 LOGGER = get_logger(__name__)
 SESSION_LAYOUT_FORMAT = "sage.filesystem-session-layout/v1"
@@ -667,16 +673,24 @@ def _snapshot_belongs_to(self, snapshot: Path, session_id: str) -> bool:
         return len(rows) == 1 and rows[0].get("session_id") == session_id
 
     def _acquire_writer_lock(self) -> None:
-        if fcntl is None:
+        if fcntl is None and msvcrt is None:
+            self._writer_handle.close()
             raise self._error(
                 "session_store.lock_unsupported",
                 ErrorCategory.UNSUPPORTED_SCHEMA,
                 "the filesystem SessionStore requires an advisory-lock adapter",
             )
         try:
-            fcntl.flock(self._writer_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
-        except BlockingIOError as exc:
+            if fcntl is not None:
+                fcntl.flock(self._writer_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
+            else:
+                # Always lock the same byte, including in a newly created file.
+                self._writer_handle.seek(0)
+                msvcrt.locking(self._writer_handle.fileno(), msvcrt.LK_NBLCK, 1)
+        except OSError as exc:
             self._writer_handle.close()
+            if exc.errno not in {errno.EACCES, errno.EAGAIN, errno.EDEADLK}:
+                raise
             raise StoreInUseError(
                 RuntimeErrorInfo(
                     code="session_store.in_use",
@@ -692,6 +706,9 @@ def _release_writer_lock(self) -> None:
             return
         if fcntl is not None:
             fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
+        elif msvcrt is not None:
+            handle.seek(0)
+            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
         handle.close()
 
     def _write_snapshot(self, path: Path, state: dict[str, Any]) -> None:
@@ -1873,6 +1890,10 @@ def _checksum(cls, payload: dict[str, Any]) -> str:
 
     @staticmethod
     def _fsync_directory(path: Path) -> None:
+        # Windows CRT cannot open directories. File data is fsynced before replace;
+        # POSIX additionally persists the directory entry here.
+        if os.name == "nt":
+            return
         descriptor = os.open(path, os.O_RDONLY)
         try:
             os.fsync(descriptor)
```

**File**: `scripts/release/bundle_desktop_v2.py` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ def main() -> None:
     python = root / ('python/python.exe' if os.name == 'nt' else 'python/bin/python3')
     environment = {k: v for k, v in os.environ.items() if k not in {'PYTHONHOME', 'PYTHONPATH', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'DYLD_FALLBACK_LIBRARY_PATH'}}
     environment['PYTHONNOUSERSITE'] = '1'
-    subprocess.run(['uv', 'pip', 'install', '--break-system-packages', '--python', str(python), str(args.wheel.resolve())], env=environment, check=True)
+    subprocess.run(['uv', 'pip', 'install', '--break-system-packages', '--python', str(python), '--constraint', str(Path(__file__).with_name('desktop-constraints.txt')), str(args.wheel.resolve())], env=environment, check=True)
     (root / 'sage-runtime.json').write_text(json.dumps({
         'version': args.version, 'commit': args.commit,
         'build_id': f'release-{args.version}-{args.commit}',
```

**File**: `scripts/release/desktop-constraints.txt` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+# Numba 0.63+ / llvmlite 0.46+ no longer publish macOS Intel wheels.
+# Use the last compatible pair for the embedded CPython 3.13 runtime.
+numba==0.62.1; sys_platform == "darwin" and platform_machine == "x86_64"
+llvmlite==0.45.1; sys_platform == "darwin" and platform_machine == "x86_64"
```

**File**: `scripts/release/smoke_desktop_v2.py` (modified, +18/-1)
```diff
@@ -27,7 +27,7 @@ def main() -> None:
     with tempfile.TemporaryDirectory(prefix='sage-release-smoke-') as temp:
         environment.update(HOME=temp, USERPROFILE=temp)
         # Check installed package resources as well as lazy v2 imports.
-        subprocess.run([str(python), '-c', '''
+        subprocess.run([str(python), '-c', r'''
 from pathlib import Path
 import importlib.metadata
 import sys
@@ -37,6 +37,23 @@ def main() -> None:
 assert importlib.metadata.version('sage') == '2.0.0'
 assert any((Path(app.__file__).parent / 'skills').glob('*/SKILL.md'))
 assert not any(n.startswith(('app.v1.', 'sagents.v1.')) for n in sys.modules)
+# Verify native one-writer locks, including Windows, across processes.
+import asyncio
+import subprocess
+from sagents.v2.runtime.session.plugins.filesystem import FilesystemSessionStore
+from sagents.v2.runtime.execution.scheduler.plugins.filesystem import FilesystemScheduler
+for module, name, error in (
+    ('sagents.v2.runtime.session.plugins.filesystem', 'FilesystemSessionStore', 'StoreInUseError'),
+    ('sagents.v2.runtime.execution.scheduler.plugins.filesystem', 'FilesystemScheduler', 'SchedulerInUseError'),
+):
+    cls = getattr(__import__(module, fromlist=[name]), name)
+    store_root = Path.cwd() / name
+    first = cls(store_root)
+    probe = f'from {module} import {name}, {error}\ntry: {name}({str(store_root)!r})\nexcept {error}: raise SystemExit(42)'
+    assert subprocess.run([sys.executable, '-c', probe]).returncode == 42
+    asyncio.run(first.close())
+    replacement = cls(store_root)
+    asyncio.run(replacement.close())
 '''], cwd=temp, env=environment, check=True)
         with (Path(temp) / 'stderr.log').open('w+') as log:
             process = subprocess.Popen([str(python), '-m', 'app.v2.desktop.backend.main',
```

---

### Incident Patch 5: `9b57f8e7` (2026-10-10)
**Commit Message**: fix(release): preserve Windows installer artifact name

**File**: `scripts/release/package_desktop_v2.py` (modified, +3/-3)
```diff
@@ -35,9 +35,9 @@ def main() -> None:
         bundle = stage / ('Sage.app' if args.platform == 'macos' else 'Sage')
         shutil.copytree(source, bundle, symlinks=True)
         if args.platform == 'windows':
-            for name in ('msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'):
-                if not (bundle / name).is_file():
-                    raise RuntimeError(f'Windows bundle is missing its MSVC runtime: {name}')
+            for runtime_name in ('msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'):
+                if not (bundle / runtime_name).is_file():
+                    raise RuntimeError(f'Windows bundle is missing its MSVC runtime: {runtime_name}')
         subprocess.run([sys.executable, str(ROOT / 'scripts/release/bundle_desktop_v2.py'),
             '--bundle', str(bundle), '--wheel', str(args.wheel.resolve()),
             '--version', VERSION, '--commit', args.commit], check=True)
```

---

### Incident Patch 6: `7f252d8b` (2026-10-10)
**Commit Message**: fix(release): include MSVC runtime in Windows installer

**File**: `app/v2/desktop/windows/CMakeLists.txt` (modified, +5/-0)
```diff
@@ -81,6 +81,11 @@ install(FILES "${FLUTTER_ICU_DATA_FILE}" DESTINATION "${INSTALL_BUNDLE_DATA_DIR}
 install(FILES "${FLUTTER_LIBRARY}" DESTINATION "${INSTALL_BUNDLE_LIB_DIR}"
   COMPONENT Runtime)
 
+# Include the MSVC runtime beside the executable for clean Windows installs.
+set(CMAKE_INSTALL_SYSTEM_RUNTIME_DESTINATION "${INSTALL_BUNDLE_LIB_DIR}")
+set(CMAKE_INSTALL_SYSTEM_RUNTIME_COMPONENT Runtime)
+include(InstallRequiredSystemLibraries)
+
 if(PLUGIN_BUNDLED_LIBRARIES)
   install(FILES "${PLUGIN_BUNDLED_LIBRARIES}"
     DESTINATION "${INSTALL_BUNDLE_LIB_DIR}"
```

**File**: `scripts/release/package_desktop_v2.py` (modified, +4/-0)
```diff
@@ -34,6 +34,10 @@ def main() -> None:
         stage = Path(temp) / 'build-location'
         bundle = stage / ('Sage.app' if args.platform == 'macos' else 'Sage')
         shutil.copytree(source, bundle, symlinks=True)
+        if args.platform == 'windows':
+            for name in ('msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'):
+                if not (bundle / name).is_file():
+                    raise RuntimeError(f'Windows bundle is missing its MSVC runtime: {name}')
         subprocess.run([sys.executable, str(ROOT / 'scripts/release/bundle_desktop_v2.py'),
             '--bundle', str(bundle), '--wheel', str(args.wheel.resolve()),
             '--version', VERSION, '--commit', args.commit], check=True)
```

---

### Incident Patch 7: `753650a9` (2026-10-10)
**Commit Message**: fix(release): keep bundled Python resources immutable at startup

**File**: `app/v2/desktop/lib/src/api/runtime_host.dart` (modified, +1/-0)
```diff
@@ -472,6 +472,7 @@ class RuntimeHost {
       environment.remove('DYLD_LIBRARY_PATH');
       environment.remove('DYLD_FALLBACK_LIBRARY_PATH');
       environment['PYTHONNOUSERSITE'] = '1';
+      environment['PYTHONDONTWRITEBYTECODE'] = '1';
     }
     return environment;
   }
```

**File**: `app/v2/desktop/test/runtime_host_test.dart` (modified, +1/-0)
```diff
@@ -187,6 +187,7 @@ void main() {
       expect(spawnedArguments, contains('release-2.0.0-test'));
       expect(api.expectedBuildId, 'release-2.0.0-test');
       expect(spawnedEnvironment!['PYTHONNOUSERSITE'], '1');
+      expect(spawnedEnvironment!['PYTHONDONTWRITEBYTECODE'], '1');
       expect(spawnedEnvironment!.containsKey('PYTHONPATH'), isFalse);
       expect(spawnedEnvironment!.containsKey('PYTHONHOME'), isFalse);
     },
```

**File**: `scripts/release/smoke_desktop_v2.py` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ def main() -> None:
     python = root / ('python/python.exe' if os.name == 'nt' else 'python/bin/python3')
     environment = {k: v for k, v in os.environ.items() if k not in {'PYTHONHOME', 'PYTHONPATH', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'DYLD_FALLBACK_LIBRARY_PATH'}}
     environment['PYTHONNOUSERSITE'] = '1'
+    environment['PYTHONDONTWRITEBYTECODE'] = '1'
     with tempfile.TemporaryDirectory(prefix='sage-release-smoke-') as temp:
         environment.update(HOME=temp, USERPROFILE=temp)
         # Check installed package resources as well as lazy v2 imports.
```

---

### Incident Patch 8: `e67472a1` (2026-10-10)
**Commit Message**: fix(release): use a valid Desktop lease identity in smoke check

**File**: `scripts/release/smoke_desktop_v2.py` (modified, +3/-1)
```diff
@@ -5,6 +5,7 @@
 from concurrent.futures import ThreadPoolExecutor
 import json
 import os
+import secrets
 from pathlib import Path
 import subprocess
 import tempfile
@@ -66,8 +67,9 @@ def read_ready():
                     raise RuntimeError('Sidecar never became healthy')
                 assert health['status'] == 'ok' and health['build_id'] == manifest['build_id']
                 assert health['protocol'] == 'sage.runtime/v2', health
+                client_id = secrets.token_urlsafe(24)
                 for method in ('PUT', 'DELETE'):
-                    request = urllib.request.Request(endpoint + '/api/v2/runtime/clients/release-smoke',
+                    request = urllib.request.Request(endpoint + f'/api/v2/runtime/clients/{client_id}',
                         headers=headers, method=method)
                     with urllib.request.urlopen(request, timeout=5) as response:
                         result = json.load(response)['data']
```

---

### Incident Patch 9: `11edc1ca` (2026-10-10)
**Commit Message**: fix(release): install dependencies into private Python runtime copy

**File**: `app/v2/desktop/lib/src/api/runtime_host.dart` (modified, +3/-0)
```diff
@@ -468,6 +468,9 @@ class RuntimeHost {
     if (File('${root.path}/sage-runtime.json').existsSync()) {
       environment.remove('PYTHONHOME');
       environment.remove('PYTHONPATH');
+      environment.remove('LD_LIBRARY_PATH');
+      environment.remove('DYLD_LIBRARY_PATH');
+      environment.remove('DYLD_FALLBACK_LIBRARY_PATH');
       environment['PYTHONNOUSERSITE'] = '1';
     }
     return environment;
```

**File**: `scripts/release/bundle_desktop_v2.py` (modified, +2/-2)
```diff
@@ -28,9 +28,9 @@ def main() -> None:
     # Preserve relative interpreter/library links from python-build-standalone.
     shutil.copytree(prefix, root / 'python', symlinks=True)
     python = root / ('python/python.exe' if os.name == 'nt' else 'python/bin/python3')
-    environment = {k: v for k, v in os.environ.items() if k not in {'PYTHONHOME', 'PYTHONPATH'}}
+    environment = {k: v for k, v in os.environ.items() if k not in {'PYTHONHOME', 'PYTHONPATH', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'DYLD_FALLBACK_LIBRARY_PATH'}}
     environment['PYTHONNOUSERSITE'] = '1'
-    subprocess.run(['uv', 'pip', 'install', '--python', str(python), str(args.wheel.resolve())], env=environment, check=True)
+    subprocess.run(['uv', 'pip', 'install', '--break-system-packages', '--python', str(python), str(args.wheel.resolve())], env=environment, check=True)
     (root / 'sage-runtime.json').write_text(json.dumps({
         'version': args.version, 'commit': args.commit,
         'build_id': f'release-{args.version}-{args.commit}',
```

**File**: `scripts/release/smoke_desktop_v2.py` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ def main() -> None:
     root = args.runtime.resolve()
     manifest = json.loads((root / 'sage-runtime.json').read_text())
     python = root / ('python/python.exe' if os.name == 'nt' else 'python/bin/python3')
-    environment = {k: v for k, v in os.environ.items() if k not in {'PYTHONHOME', 'PYTHONPATH'}}
+    environment = {k: v for k, v in os.environ.items() if k not in {'PYTHONHOME', 'PYTHONPATH', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'DYLD_FALLBACK_LIBRARY_PATH'}}
     environment['PYTHONNOUSERSITE'] = '1'
     with tempfile.TemporaryDirectory(prefix='sage-release-smoke-') as temp:
         environment.update(HOME=temp, USERPROFILE=temp)
```

---

### Incident Patch 10: `9b75b1ee` (2026-10-10)
**Commit Message**: fix(release): bootstrap arm64 Flutter and clean up widget fixtures

**File**: `.github/workflows/release-v2.yml` (modified, +7/-0)
```diff
@@ -94,10 +94,17 @@ jobs:
         with:
           python-version: '3.13'
       - uses: subosito/flutter-action@v2
+        if: matrix.platform != 'linux' || matrix.arch != 'arm64'
         with:
           flutter-version: '3.44.2'
           channel: stable
           cache: true
+      - name: Bootstrap pinned Flutter SDK on Linux arm64
+        if: matrix.platform == 'linux' && matrix.arch == 'arm64'
+        run: |
+          git clone --depth 1 --branch 3.44.2 https://github.com/flutter/flutter.git "$RUNNER_TEMP/flutter-arm64"
+          echo "$RUNNER_TEMP/flutter-arm64/bin" >> "$GITHUB_PATH"
+          "$RUNNER_TEMP/flutter-arm64/bin/flutter" --version
       - name: Install Linux build dependencies
         if: matrix.platform == 'linux'
         run: |
```

**File**: `app/v2/desktop/README.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ app/v2/desktop/
 ## 开发运行
 
 **环境要求：Python 3.12+。** Desktop v2 sidecar 与 `sagents.v2` 共用这一下限；
-旧 Desktop / Web 仍可使用 Python 3.10+。低于 3.12 时 Flutter 不会启动 sidecar。
+Sage 2.0 发布包统一要求 Python 3.12+；旧发布版的 Python 要求以其版本说明为准。低于 3.12 时 Flutter 不会启动 sidecar。
 
 从仓库根目录启动：
 
```

**File**: `app/v2/desktop/test/v2_api_test.dart` (modified, +10/-2)
```diff
@@ -6,6 +6,14 @@ import 'package:file_selector/file_selector.dart';
 import 'package:flutter_test/flutter_test.dart';
 import 'package:sage_desktop_v2/src/api/v2_api.dart';
 
+// Multipart names can contain characters that are illegal in Windows paths.
+class _NamedUploadFile extends XFile {
+  _NamedUploadFile(super.path, this.name);
+
+  @override
+  final String name;
+}
+
 void main() {
   test('clone agent sends source identity and preserves returned settings', () async {
     final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
@@ -106,7 +114,7 @@ void main() {
         'sage-v2-api-unicode-upload-test-',
       );
       const filename = '小凤筝 copy "最终".png';
-      final source = File('${directory.path}/$filename');
+      final source = File('${directory.path}/unicode-upload.png');
       await source.writeAsBytes(const [0x89, 0x50, 0x4e, 0x47]);
       addTearDown(() => server.close(force: true));
       addTearDown(() => directory.delete(recursive: true));
@@ -142,7 +150,7 @@ void main() {
 
       final uploaded = await api.upload(
         agentId: 'sage',
-        file: XFile(source.path),
+        file: _NamedUploadFile(source.path, filename),
       );
       final multipartBytes = await body.future;
       final multipart = utf8.decode(multipartBytes, allowMalformed: true);
```

**File**: `app/v2/desktop/test/widget_test.dart` (modified, +226/-182)
```diff
@@ -10,7 +10,8 @@ import 'package:flutter/foundation.dart';
 import 'package:file_selector/file_selector.dart' show XFile;
 import 'package:sage_desktop_v2/src/services/image_clipboard.dart';
 import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
-import 'package:flutter_test/flutter_test.dart';
+import 'package:flutter_test/flutter_test.dart' hide testWidgets;
+import 'package:flutter_test/flutter_test.dart' as widget_tests show testWidgets;
 import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
 import 'package:shared_preferences/shared_preferences.dart';
 
@@ -2116,9 +2117,52 @@ class _MissingProviderAgentApi extends _FakeApi {
       );
 }
 
+// Dispose externally owned controllers inside the widget test's fake-async
+// scope, before Flutter verifies that no polling timers remain.
+List<WorkspaceController>? _widgetControllers;
+final _disposedControllers = Expando<bool>();
+
+WorkspaceController _newController({
+  V2ApiClient? api,
+  PreferencesLoader? preferencesLoader,
+}) {
+  final controller = WorkspaceController(
+    api: api,
+    preferencesLoader: preferencesLoader,
+  );
+  _widgetControllers?.add(controller);
+  return controller;
+}
+
+void _disposeController(WorkspaceController controller) {
+  if (_disposedControllers[controller] == true) return;
+  _disposedControllers[controller] = true;
+  controller.dispose();
+}
+
+void testWidgets(
+  String description,
+  WidgetTesterCallback callback, {
+  TestVariant<Object?> variant = const DefaultTestVariant(),
+}) {
+  widget_tests.testWidgets(description, (tester) async {
+    final controllers = <WorkspaceController>[];
+    _widgetControllers = controllers;
+    try {
+      await callback(tester);
+    } finally {
+      await tester.pumpWidget(const SizedBox.shrink());
+      for (final controller in controllers.reversed) {
+        _disposeController(controller);
+      }
+      _widgetControllers = null;
+    }
+  }, variant: variant);
+}
+
 Future<WorkspaceController> _controller({_FakeApi? api}) async {
   SharedPreferences.setMockInitialValues({});
-  final value = WorkspaceController(
+  final value = _newController(
     api: api ?? _FakeApi(),
     preferencesLoader: SharedPreferences.getInstance,
   );
@@ -2347,7 +2391,7 @@ void main() {
     SharedPreferences.setMockInitialValues({});
     final api = _SteeringProcessApi();
     final controller = await _controller(api: api);
-    addTearDown(controller.dispose);
+    addTearDown(() => _disposeController(controller));
     await tester.pumpWidget(SageDesktopV2App(controller: controller));
     await tester.pumpAndSettle();
     await controller.send('original');
@@ -2411,8 +2455,8 @@ void main() {
           'sage.desktop_v2.conversations.v1': jsonEncode({WorkspaceController.agentWorkspaceId: [persisted]}),
         });
         final api = _BranchingApi();
-        final controller = WorkspaceController(api: api, preferencesLoader: SharedPreferences.getInstance);
-        addTearDown(controller.dispose);
+        final controller = _newController(api: api, preferencesLoader: SharedPreferences.getInstance);
+        addTearDown(() => _disposeController(controller));
         await controller.initialize();
         await controller.rewriteLastUserMessage(id, replacement);
         await pumpEventQueue();
@@ -2448,7 +2492,7 @@ void main() {
         });
         final api = _ClipboardApi();
         final controller = await _controller(api: api);
-        addTearDown(controller.dispose);
+        addTearDown(() => _disposeController(controller));
         await tester.pumpWidget(SageDesktopV2App(controller: controller));
         await tester.pumpAndSettle();
         final field = find.byKey(const ValueKey('agent-composer'));
@@ -2493,7 +2537,7 @@ void main() {
     addTearDown(tester.view.resetDevicePixelRatio);
     final api = _FakeApi();
     final controller = await _controller(api: api);
-    addTearDown(controller.dispose);
+    addTearDown(() => _disposeController(controller));
     await tester.pumpWidget(SageDesktopV2App(controller: controller));
     await tester.pumpAndSettle();
     await tester.tap(find.byKey(const ValueKey('settings-button')));
@@ -2521,7 +2565,7 @@ void main() {
       addTearDown(tester.view.resetDevicePixelRatio);
       final api = _FakeApi();
       final controller = await _controller(api: api);
-      addTearDown(controller.dispose);
+      addTearDown(() => _disposeController(controller));
       await tester.pumpWidget(SageDesktopV2App(controller: controller));
       await tester.pumpAndSettle();
       await tester.tap(find.byKey(const ValueKey('settings-button')));
@@ -2548,7 +2592,7 @@ void main() {
   test('settings writes are serialized and contain only edited fields', () async {
     final api = _SerializedSettingsApi();
     final controller = await _controller(api: api);
-    addTearDown(controller.dispose);
+    addTearDown(() => _disposeController(controller));
     final first = controller.saveSetti
```

---

### Incident Patch 11: `269236e1` (2026-10-10)
**Commit Message**: release: align Sage 2.0 and build v2 installers in GitHub Actions

**File**: `.github/workflows/ci-tests.yml` (modified, +33/-0)
```diff
@@ -144,3 +144,36 @@ jobs:
 
       - name: Check Desktop i18n keys (zh / en)
         run: npm run check:i18n
+
+  web-v2:
+    name: Server v2 Web build
+    runs-on: ubuntu-24.04
+    defaults:
+      run:
+        working-directory: app/v2/server/web
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '22'
+          cache: npm
+          cache-dependency-path: app/v2/server/web/package-lock.json
+      - run: npm ci
+      - run: npm run build
+
+  desktop-v2:
+    name: Desktop v2 Flutter checks
+    runs-on: ubuntu-24.04
+    defaults:
+      run:
+        working-directory: app/v2/desktop
+    steps:
+      - uses: actions/checkout@v4
+      - uses: subosito/flutter-action@v2
+        with:
+          flutter-version: '3.44.2'
+          channel: stable
+          cache: true
+      - run: flutter pub get
+      - run: flutter analyze
+      - run: flutter test
```

**File**: `.github/workflows/release-desktop.yml` (modified, +3/-2)
```diff
@@ -1,11 +1,12 @@
-name: Release Desktop App
+name: Release Legacy Desktop App
 permissions:
     contents: write
     
 on:
   push:
     tags:
-      - 'desktop-v*'
+      - 'desktop-v0.*'
+      - 'desktop-v1.*'
   workflow_dispatch:
     inputs:
       build_target:
```

**File**: `.github/workflows/release-v2.yml` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+name: Release Sage v2
+
+on:
+  push:
+    tags: ['v2.*']
+  workflow_dispatch:
+    inputs:
+      publish:
+        description: Publish v2.0.0 after every package passes verification
+        type: boolean
+        default: false
+
+permissions:
+  contents: read
+
+concurrency:
+  group: release-v2-${{ github.ref }}
+  cancel-in-progress: false
+
+jobs:
+  packages:
+    runs-on: ubuntu-24.04
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-python@v5
+        with:
+          python-version: '3.13'
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '22'
+          cache: npm
+          cache-dependency-path: app/v2/server/web/package-lock.json
+      - name: Check release metadata and documentation
+        run: |
+          if [ "$GITHUB_REF_TYPE" = "tag" ]; then test "$GITHUB_REF_NAME" = "v2.0.0"; fi
+          python -m pip install build pyyaml
+          python scripts/release/check_v2_release.py
+          python docs/scripts/check_docs.py
+          python scripts/checks/check_architecture.py
+      - name: Build Python distributions
+        run: python -m build --outdir release-assets
+      - name: Verify distribution contents
+        run: python scripts/release/check_v2_release.py --assets release-assets
+      - name: Build Server v2 Web
+        working-directory: app/v2/server/web
+        run: |
+          npm ci
+          npm run build
+      - name: Package source and Web
+        run: |
+          git archive --format=tar.gz --prefix=Sage-2.0.0/ HEAD > release-assets/Sage-2.0.0-source.tar.gz
+          tar -czf release-assets/Sage-2.0.0-server-web.tar.gz -C app/v2/server/web dist
+      - uses: actions/upload-artifact@v4
+        with:
+          name: sage-v2-packages
+          path: release-assets/*
+          if-no-files-found: error
+
+  desktop:
+    needs: packages
+    strategy:
+      fail-fast: false
+      matrix:
+        include:
+          - runner: macos-latest
+            platform: macos
+            arch: arm64
+          - runner: macos-15-intel
+            platform: macos
+            arch: x86_64
+          - runner: ubuntu-24.04
+            platform: linux
+            arch: x86_64
+          - runner: ubuntu-24.04-arm
+            platform: linux
+            arch: arm64
+          - runner: windows-latest
+            platform: windows
+            arch: x86_64
+    runs-on: ${{ matrix.runner }}
+    defaults:
+      run:
+        shell: bash
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/download-artifact@v4
+        with:
+          name: sage-v2-packages
+          path: python-packages
+      - uses: astral-sh/setup-uv@v6
+      - name: Install managed relocatable Python
+        run: uv python install 3.13
+      - uses: actions/setup-python@v5
+        with:
+          python-version: '3.13'
+      - uses: subosito/flutter-action@v2
+        with:
+          flutter-version: '3.44.2'
+          channel: stable
+          cache: true
+      - name: Install Linux build dependencies
+        if: matrix.platform == 'linux'
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y clang cmake ninja-build pkg-config libgtk-3-dev liblzma-dev bubblewrap
+      - name: Install Windows installer tooling
+        if: matrix.platform == 'windows'
+        run: choco install nsis --no-progress -y
+      - name: Verify Flutter client
+        working-directory: app/v2/desktop
+        run: |
+          flutter pub get
+          flutter analyze
+          flutter test
+      - name: Build Flutter v2 client
+        working-directory: app/v2/desktop
+        run: flutter build ${{ matrix.platform }} --release --build-name=2.0.0 --build-number=1
+      - name: Bundle, relocate and verify Desktop v2
+        run: python scripts/release/package_desktop_v2.py --platform '${{ matrix.platform }}' --arch '${{ matrix.arch }}' --commit '${{ github.sha }}' --wheel python-packages/sage-2.0.0-py3-none-any.whl --out release-assets
+      - uses: actions/upload-artifact@v4
+        with:
+          name: sage-v2-desktop-${{ matrix.platform }}-${{ matrix.arch }}
+          path: release-assets/*
+          if-no-files-found: error
+
+  publish:
+    needs: [packages, desktop]
+    if: startsWith(github.ref, 'refs/tags/v2.') || inputs.publish
+    runs-on: ubuntu-24.04
+    permissions:
+      contents: write
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/download-artifact@v4
+        with:
+          pattern: sage-v2-*
+          path: release-assets
+          merge-multiple: true
+      - name: Verify expected assets and publish release
+        env:
+          GH_TOKEN: ${{ github.token }}
+          GH_REPO: ${{ github.repository }}
+        run: |
+          python scripts/release/check_v2_release.py --assets release-assets --complete
+          cd release-assets
+          sha256sum * > SHA256SUMS
+          cd ..
+          gh release c
```

**File**: `MANIFEST.in` (modified, +3/-0)
```diff
@@ -3,3 +3,6 @@ include LICENSE
 recursive-include docs *.md
 recursive-include clients/terminal/bin *
 recursive-include clients/terminal/scripts *.sh
+
+recursive-include app/skills *
+global-exclude __pycache__ *.py[cod]
```

**File**: `README.md` (modified, +3/-3)
```diff
@@ -8,7 +8,7 @@
 [![简体中文](https://img.shields.io/badge/语言-简体中文-red.svg)](README_CN.md)
 [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?logo=opensourceinitiative)](LICENSE)
 [![Python 3.12+ (v2)](https://img.shields.io/badge/Python-3.12%2B%20(v2)-blue.svg?logo=python)](https://python.org)
-[![Version](https://img.shields.io/badge/Version-1.1.0-green.svg)](https://github.com/ZHangZHengEric/Sage)
+[![Version](https://img.shields.io/badge/Version-2.0.0-green.svg)](https://github.com/ZHangZHengEric/Sage)
 [![DeepWiki](https://img.shields.io/badge/DeepWiki-Learn%20More-purple.svg)](https://deepwiki.com/ZHangZHengEric/Sage)
 [![Slack](https://img.shields.io/badge/Slack-Join%20Community-4A154B?logo=slack)](https://join.slack.com/t/sage-b021145/shared_invite/zt-3t8nabs6c-qCEDzNUYtMblPshQTKSWOA)
 
@@ -40,7 +40,7 @@
 | 💻 **Desktop v2** — Local projects and agent collaboration | [Desktop guide](app/v2/desktop/README.md) |
 | 🌐 **Server v2** — Multi-user web access and Agent Studio | [Server guide](app/v2/server/README.md) |
 | 🧠 **SAgents v2** — Build agents into your own application | [Runtime quick start](sagents/v2/README.md#quick-start) |
-| 📦 **Desktop installers** — Available release builds | [Downloads & release instructions](https://github.com/ZHangZHengEric/Sage/releases) |
+| 📦 **Desktop installers** — Available release builds | [Downloads & release instructions](https://github.com/ZHangZHengEric/Sage/releases/tag/v2.0.0) |
 
 ### 💻 Desktop from source
 
@@ -61,7 +61,7 @@ flutter run -d macos
 
 The app starts its local backend automatically. Settings and session data live in `~/sage/runtime`; the default workspace is `~/sage/agent_workspace`.
 
-For Windows and Linux setup, see the [Desktop guide](app/v2/desktop/README.md). Packaged releases follow their own release instructions; the existing release workflow builds the legacy Tauri app.
+For Windows and Linux setup, see the [Desktop guide](app/v2/desktop/README.md). Sage 2.0 packages and the release boundary are documented in [v2.0.0 release notes](release_notes/v2.0.0.md). GitHub Actions builds Flutter v2 installers with an embedded Python runtime; the legacy Tauri installers belong to v1.
 
 ### 🌐 Server from source
 
```

**File**: `README_CN.md` (modified, +3/-3)
```diff
@@ -8,7 +8,7 @@
 [![简体中文](https://img.shields.io/badge/语言-简体中文-red.svg)](README_CN.md)
 [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?logo=opensourceinitiative)](LICENSE)
 [![Python 3.12+ (v2)](https://img.shields.io/badge/Python-3.12%2B%20(v2)-blue.svg?logo=python)](https://python.org)
-[![Version](https://img.shields.io/badge/Version-1.1.0-green.svg)](https://github.com/ZHangZHengEric/Sage)
+[![Version](https://img.shields.io/badge/Version-2.0.0-green.svg)](https://github.com/ZHangZHengEric/Sage)
 [![DeepWiki](https://img.shields.io/badge/DeepWiki-查看文档-purple.svg)](https://deepwiki.com/ZHangZHengEric/Sage)
 [![Slack](https://img.shields.io/badge/Slack-加入社区-4A154B?logo=slack)](https://join.slack.com/t/sage-b021145/shared_invite/zt-3t8nabs6c-qCEDzNUYtMblPshQTKSWOA)
 
@@ -40,7 +40,7 @@
 | 💻 **Desktop v2** — 本地项目工作与智能体协作 | [桌面端指南](app/v2/desktop/README.md) |
 | 🌐 **Server v2** — 多用户 Web 应用与 Agent Studio | [服务端指南](app/v2/server/README.md) |
 | 🧠 **SAgents v2** — 将智能体能力集成到自己的应用 | [运行时快速开始](sagents/v2/README.md#quick-start) |
-| 📦 **桌面安装包** — 已发布版本 | [下载与版本说明](https://github.com/ZHangZHengEric/Sage/releases) |
+| 📦 **桌面安装包** — 已发布版本 | [下载与版本说明](https://github.com/ZHangZHengEric/Sage/releases/tag/v2.0.0) |
 
 ### 💻 从源码启动桌面端
 
@@ -61,7 +61,7 @@ flutter run -d macos
 
 应用自动启动本机后端。设置与会话数据保存在 `~/sage/runtime`，默认工作区为 `~/sage/agent_workspace`。
 
-Windows、Linux 配置见 [桌面端指南](app/v2/desktop/README.md)。安装包以对应版本说明为准；现有发布工作流构建的是旧版 Tauri 应用。
+Windows、Linux 配置见 [桌面端指南](app/v2/desktop/README.md)。2.0 发布包与版本边界见 [v2.0.0 版本说明](release_notes/v2.0.0.md)。GitHub Actions 构建包含 Python 运行环境的 Flutter v2 安装包；旧 Tauri 安装包属于 v1。
 
 ### 🌐 从源码启动服务端
 
```

**File**: `app/v2/desktop/README.md` (modified, +9/-1)
```diff
@@ -1,6 +1,6 @@
 # Sage Desktop v2
 
-Sage Desktop v2 是验证 `sagents/v2` 的独立 Flutter 客户端，不替换、复用或修改旧 `app/v1/desktop` 的前端代码。
+Sage Desktop 2.0 是使用 `sagents/v2` 的独立 Flutter 客户端。旧 `app/v1/desktop` 保留为历史实现。
 
 ## 目录
 
@@ -124,3 +124,11 @@ Agent 编辑页的“复制”会先提交待保存内容，再打开副本的
 `studio_send_message` 在消息和收件队列持久化后返回，不等待对方执行或回复。被 @ 的 Agent 自动唤醒，忙碌或等待审批的成员按顺序排队；@用户只发布消息。接收者可以不回复，也可以通过该工具公开回复而不 @ 回去。Agent 发起的消息所触发的 Run，其普通最终输出不会自动发布；无收件人的公开消息不触发新 Run。用户未指定成员时仍由协调成员接收。
 
 投递记录和 Run 绑定用于重启恢复与去重；启动回执不明时先查询已接受的 Run，不盲目重放。用户触发的最终结果由后端补入公开历史，前端不重复上传。自动投递最多同时占用 8 个执行任务，每个用户轮次最多 64 次自动投递、最多 8 层转发。本机制用于单宿主，不提供多宿主调度保证。
+
+## 2.0 发布包
+
+安装包由 `.github/workflows/release-v2.yml` 在 GitHub Actions 构建，包含 Flutter 客户端、独立 CPython、v2 后端和内置 skills；安装后无需源码目录或系统 Python。macOS 提供 arm64 / x86_64 DMG，Windows 提供 x86_64 安装程序，Linux 提供 arm64 / x86_64 DEB 与便携 tar.gz。Linux 仍需要 GTK 等系统动态库与 bubblewrap。
+
+每个平台在发布前将整个应用移动到另一个包含空格的路径，从仓库外启动内置 Python，验证 v2 导入、skills、带认证的 health 与客户端 lease 关闭。全部平台成功后才创建 `v2.0.0` tag 和 GitHub Release。手动验证运行不发布；选择 `publish` 才发布。
+
+macOS 包使用 ad-hoc 签名，未使用 Apple Developer ID 签名或公证；Windows 包未做代码签名。旧 Tauri updater feed 仅适用于 v1，不向 v1 自动推送 Flutter v2。
```

**File**: `app/v2/desktop/lib/src/api/runtime_host.dart` (modified, +62/-2)
```diff
@@ -22,6 +22,7 @@ class RuntimeHost {
   RuntimeHost({
     V2ApiClient? api,
     File? sidecarRegistryFile,
+    Directory? bundledRuntimeRoot,
     String? buildId,
     RuntimeProcessStarter startProcess = Process.start,
     RuntimePidKiller killPid = Process.killPid,
@@ -34,6 +35,7 @@ class RuntimeHost {
     this.readPythonVersion = _inspectPythonVersion,
   }) : api = api ?? V2ApiClient(),
        _sidecarRegistryFileOverride = sidecarRegistryFile,
+       _bundledRuntimeRootOverride = bundledRuntimeRoot,
        _buildIdOverride = buildId,
        _processStarter = startProcess,
        _pidKiller = killPid,
@@ -44,6 +46,7 @@ class RuntimeHost {
 
   final V2ApiClient api;
   final File? _sidecarRegistryFileOverride;
+  final Directory? _bundledRuntimeRootOverride;
   final String? _buildIdOverride;
   final RuntimeProcessStarter _processStarter;
   final RuntimePidKiller _pidKiller;
@@ -117,7 +120,7 @@ class RuntimeHost {
         buildId,
       ],
       workingDirectory: root.path,
-      environment: Platform.environment,
+      environment: _runtimeEnvironment(root),
     );
     _process = process;
     _sidecarPid = process.pid;
@@ -252,7 +255,8 @@ class RuntimeHost {
   }
 
   String _dataRootPath() {
-    final home = Platform.environment['HOME'];
+    final home =
+        Platform.environment['HOME'] ?? Platform.environment['USERPROFILE'];
     if (home == null || home.trim().isEmpty) {
       throw const SageApiException('Cannot determine the user home directory.');
     }
@@ -442,7 +446,37 @@ class RuntimeHost {
     return base64Url.encode(bytes).replaceAll('=', '');
   }
 
+  Directory? _bundledRuntimeRoot() {
+    final override = _bundledRuntimeRootOverride;
+    if (override != null) return override;
+    final executableDirectory = File(Platform.resolvedExecutable).parent;
+    final candidates = [
+      Directory('${executableDirectory.path}/sage-runtime'),
+      if (Platform.isMacOS)
+        Directory('${executableDirectory.parent.path}/Resources/sage-runtime'),
+    ];
+    for (final candidate in candidates) {
+      if (File('${candidate.path}/sage-runtime.json').existsSync()) {
+        return candidate;
+      }
+    }
+    return null;
+  }
+
+  Map<String, String> _runtimeEnvironment(Directory root) {
+    final environment = Map<String, String>.from(Platform.environment);
+    if (File('${root.path}/sage-runtime.json').existsSync()) {
+      environment.remove('PYTHONHOME');
+      environment.remove('PYTHONPATH');
+      environment['PYTHONNOUSERSITE'] = '1';
+    }
+    return environment;
+  }
+
   Directory _findRepositoryRoot() {
+    final bundled = _bundledRuntimeRoot();
+    if (bundled != null) return bundled;
+
     final candidates = <Directory>[
       Directory.current.absolute,
       File(Platform.resolvedExecutable).parent.absolute,
@@ -465,6 +499,20 @@ class RuntimeHost {
   }
 
   String _pythonExecutable(Directory root) {
+    if (File('${root.path}/sage-runtime.json').existsSync()) {
+      final python = File(
+        Platform.isWindows
+            ? '${root.path}/python/python.exe'
+            : '${root.path}/python/bin/python3',
+      );
+      if (!python.existsSync()) {
+        throw const SageApiException(
+          'The bundled Sage Python runtime is missing.',
+        );
+      }
+      return python.path;
+    }
+
     final candidate = File('${root.path}/.venv/bin/python');
     if (candidate.existsSync()) return candidate.path;
     return Platform.isWindows ? 'python' : 'python3';
@@ -504,6 +552,18 @@ class RuntimeHost {
   }
 
   Future<String> _sourceBuildId(Directory root) async {
+    final manifest = File('${root.path}/sage-runtime.json');
+    if (manifest.existsSync()) {
+      final value = jsonDecode(await manifest.readAsString());
+      final buildId = value is Map ? value['build_id'] : null;
+      if (buildId is! String || buildId.isEmpty) {
+        throw const SageApiException(
+          'The bundled Sage build identity is missing.',
+        );
+      }
+      return buildId;
+    }
+
     final sourceRoots = [
       Directory('${root.path}/app/v2/desktop/backend'),
       Directory('${root.path}/sagents/v2'),
```

---

### Incident Patch 12: `8d65dbdb` (2026-10-09)
**Commit Message**: fix(v2): preserve summary checkpoints and retry timeouts

**File**: `sagents/v2/context/plugins/persistent_reducer.py` (modified, +84/-37)
```diff
@@ -34,6 +34,9 @@
     protected_boundary,
 )
 from sagents.v2.model.contracts import ModelMessage
+from sagents.v2.runtime.observability.logs import get_logger
+
+LOGGER = get_logger(__name__)
 
 
 class _ExtractiveConversationSummarizer:
@@ -378,13 +381,68 @@ def candidate_over(index):
             )
         target = max(1, min(self.summary_target_tokens, available - 128))
         prior_count = covered_count
-        text, covered_selected = await self._hierarchical_summary(
-            scope, previous, selected, target_tokens=target
+        checkpoint = previous
+        checkpoint_covered = 0
+
+        async def save_batch(text, covered_selected):
+            nonlocal checkpoint, checkpoint_covered
+            batch_message_count = covered_selected - checkpoint_covered
+            # Commit only complete source units, with canonical provenance and
+            # CAS. A later model failure must not lose this validated prefix.
+            canonical_end = max(indices[: prior_count + covered_selected]) + 1
+            all_covered = canonical[:canonical_end]
+            summary = create_summary(
+                scope=scope,
+                previous=checkpoint,
+                covered_messages=all_covered,
+                covered_digests=await message_digests_async(all_covered),
+                text=text,
+                estimator=self.estimator,
+            )
+            self._require_compression_gain(
+                checkpoint, selected[checkpoint_covered:covered_selected], summary
+            )
+            if over((*systems, self._summary_message(summary), *planned_retained)):
+                raise self._error(
+                    "context.budget_exhausted",
+                    "summary exceeds its reserved request budget",
+                )
+            checkpoint = await self.store.save(
+                summary,
+                expected_revision=(
+                    checkpoint.revision
+                    if checkpoint is not None
+                    else stored.revision
+                    if stored
+                    else None
+                ),
+            )
+            checkpoint_covered = covered_selected
+            LOGGER.info(
+                "context.summary.checkpoint_saved",
+                "Saved validated conversation summary batch",
+                session_id=scope.session_id,
+                run_id=scope.run_id,
+                attributes={
+                    "summary_id": checkpoint.summary_id,
+                    "summary_revision": checkpoint.revision,
+                    "covered_message_count": checkpoint.source_message_count,
+                    "newly_covered_message_count": batch_message_count,
+                    "projection_covered_message_count": covered_selected,
+                    "remaining_selected_message_count": len(selected)
+                    - covered_selected,
+                    "estimated_summary_tokens": checkpoint.estimated_tokens,
+                },
+            )
+
+        _, covered_selected = await self._hierarchical_summary(
+            scope,
+            previous,
+            selected,
+            target_tokens=target,
+            on_batch_completed=save_batch,
         )
         leftover = selected[covered_selected:]
-        # Tool-context followups can move after results in the inference view.
-        # Whole units are selected, so their highest source position defines
-        # the canonical prefix even when positions within a unit are reordered.
         canonical_end = max(indices[: prior_count + covered_selected]) + 1
         all_covered = canonical[:canonical_end]
         covered_end = prior_count + covered_selected
@@ -394,36 +452,9 @@ def candidate_over(index):
             else ()
         )
         retained = (*anchor, *leftover, *suffix)
-        covered_digests = await message_digests_async(all_covered)
-        summary = create_summary(
-            scope=scope,
-            previous=previous,
-            covered_messages=all_covered,
-            covered_digests=covered_digests,
-            text=text,
-            estimator=self.estimator,
-        )
-        self._require_compression_gain(previous, selected[:covered_selected], summary)
-        result = (*systems, self._summary_message(summary), *retained)
-        # Validate the summary with the suffix and request anchor that must
-        # remain even after the selected prefix is fully summarized. Only the
-        # temporary leftover may exceed this projection's reserved budget;
-        # persisting an oversized summary would poison the next checkpoint.
-        if over((*systems, self._summary_message(summary), *planned_retained)):
-            raise self._error(
-                "context.budget_exhausted",
-                "summary exceeds its reserved request budget",
-            )
-        saved = await self.store.save(
-            summary,
-            expected_revision=(
-                previous.revision
-   
```

**File**: `sagents/v2/context/plugins/summarizer_model.py` (modified, +132/-8)
```diff
@@ -7,6 +7,8 @@
 import json
 from typing import Any
 
+import httpx
+
 from sagents.v2.context.summary import SummarizationRequest, summary_safe_block_text
 from sagents.v2.contracts.common import new_id
 from sagents.v2.contracts.errors import ErrorCategory, RuntimeErrorInfo, SageV2Error
@@ -17,8 +19,10 @@
     ModelProvider,
     auxiliary_model_timeout_error,
 )
+from sagents.v2.runtime.observability.logs import get_logger
 
 DEFAULT_SUMMARY_MODEL_TIMEOUT_SECONDS = 300.0
+LOGGER = get_logger(__name__)
 
 
 class ModelConversationSummarizer:
@@ -32,6 +36,7 @@ class ModelConversationSummarizer:
     plugin_id = "sage.context.summarizer.model"
     name = "Model conversation summarizer"
     description = "Uses a model binding to write conversation summaries."
+    _MAX_TIMEOUT_RETRIES = 3
     _FIELDS = (
         "summary",
         "decisions",
@@ -87,14 +92,132 @@ def __init__(
 
     async def summarize(self, request: SummarizationRequest) -> str:
         async with auxiliary_capacity("context-summary"):
-            progress = {"attempt": 0, "text_delta_count": 0, "reasoning_delta_count": 0}
-            try:
-                # Include capabilities discovery and both format attempts in
-                # one bounded operation, not just each streaming iteration.
-                async with asyncio.timeout(self.timeout_seconds):
-                    return await self._summarize(request, progress)
-            except TimeoutError as exc:
-                raise self._timeout_error("total", progress) from exc
+            logger = LOGGER.bind(
+                session_id=request.scope.session_id,
+                run_id=request.scope.run_id,
+                correlation_id=new_id("summary_operation"),
+            )
+            started = asyncio.get_running_loop().time()
+            for timeout_attempt in range(self._MAX_TIMEOUT_RETRIES + 1):
+                progress = {
+                    "attempt": 0,
+                    "text_delta_count": 0,
+                    "reasoning_delta_count": 0,
+                    "timeout_attempt": timeout_attempt + 1,
+                    "timeout_retry_limit": self._MAX_TIMEOUT_RETRIES,
+                }
+                attributes = {
+                    "model_binding": self.model_binding,
+                    "source_message_count": len(request.messages),
+                    "target_tokens": request.target_tokens,
+                    "timeout_seconds": self.timeout_seconds,
+                    "idle_timeout_seconds": self.idle_timeout_seconds,
+                    **progress,
+                }
+                logger.info(
+                    "context.summary.attempt_started",
+                    "Starting conversation summary attempt",
+                    attributes=attributes,
+                )
+                try:
+                    try:
+                        # Each timeout retry gets a fresh total budget, including
+                        # capabilities discovery and both output-format attempts.
+                        async with asyncio.timeout(self.timeout_seconds):
+                            result = await self._summarize(request, progress)
+                    except TimeoutError as exc:
+                        raise self._timeout_error("total", progress) from exc
+                except Exception as exc:
+                    timeout_error = self._as_timeout_error(exc, progress)
+                    if timeout_error is None:
+                        logger.exception(
+                            "context.summary.failed",
+                            "Conversation summary failed",
+                            exc,
+                            attributes={**attributes, **progress},
+                        )
+                        raise
+                    exhausted = timeout_attempt == self._MAX_TIMEOUT_RETRIES
+                    delay = 0 if exhausted else 2 ** (timeout_attempt + 1)
+                    attributes.update(
+                        {
+                            **timeout_error.info.metadata,
+                            "retry_delay_seconds": delay,
+                            "elapsed_seconds": asyncio.get_running_loop().time()
+                            - started,
+                            "timeout_retries_exhausted": exhausted,
+                        }
+                    )
+                    if exhausted:
+                        error = SageV2Error(
+                            timeout_error.info.model_copy(
+                                update={
+                                    "metadata": {
+                                        **timeout_error.info.metadata,
+                                        "timeout_retries_exhausted": True,
+                                    }
+                                }
+                            )
+                        )
+                        logger.exception(
+                            "context.summary.timeout_exhausted",
+            
```

**File**: `sagents/v2/context/summary.py` (modified, +19/-9)
```diff
@@ -64,11 +64,7 @@ def summary_safe_block_text(block: Any) -> str:
             sort_keys=True,
         )
     if isinstance(block, ImageBlock):
-        alt = (
-            f", alt={_redact_data_urls(block.alt)[:200]}"
-            if block.alt
-            else ""
-        )
+        alt = f", alt={_redact_data_urls(block.alt)[:200]}" if block.alt else ""
         return f"[image attached: mime={block.mime_type}{alt}]"
     if isinstance(block, AudioBlock):
         return f"[audio attached: mime={block.mime_type}]"
@@ -147,23 +143,37 @@ class ConversationSummarizer(Protocol):
     async def summarize(self, request: SummarizationRequest) -> str: ...
 
 
-def message_digest(message: ModelMessage) -> str:
+def message_digest(
+    message: ModelMessage, *, include_source_metadata: bool = False
+) -> str:
+    value = message.model_dump(mode="json")
+    if not include_source_metadata:
+        # Event reconstruction adds provenance that the active Run ledger does
+        # not carry. It must not invalidate an otherwise identical summary.
+        value["metadata"] = {
+            key: item
+            for key, item in value["metadata"].items()
+            if key not in {"source_session_id", "source_run_id", "source_item_id"}
+        }
     payload = json.dumps(
-        message.model_dump(mode="json"),
+        value,
         sort_keys=True,
         separators=(",", ":"),
         ensure_ascii=False,
     ).encode("utf-8")
     return f"sha256:{hashlib.sha256(payload).hexdigest()}"
 
 
-async def message_digests_async(messages):
+async def message_digests_async(messages, *, include_source_metadata: bool = False):
     from copy import deepcopy
     from sagents.v2._concurrency import bounded_to_thread
 
     def prepare():
         snapshot = deepcopy(messages)
-        return lambda: tuple(message_digest(message) for message in snapshot)
+        return lambda: tuple(
+            message_digest(message, include_source_metadata=include_source_metadata)
+            for message in snapshot
+        )
 
     return await bounded_to_thread("context-cpu", None, prepare=prepare)
 
```

**File**: `sagents/v2/model/middleware/recording.py` (modified, +5/-0)
```diff
@@ -275,6 +275,11 @@ async def persist_first_token() -> None:
                     finalized = True
                 yield event
         except BaseException as exc:
+            # A consumer may close immediately after COMPLETED (summaries do
+            # this). GeneratorExit/cancellation must not overwrite the already
+            # authoritative successful diagnostic and span.
+            if finalized:
+                raise
             await persist_first_token()
             await self._diagnose(
                 "fail_model_request",
```

**File**: `tests/sagents/v2/test_context_efficiency.py` (modified, +68/-1)
```diff
@@ -229,6 +229,71 @@ async def test_summary_work_limit_saves_partial_prefix_for_the_next_turn():
         assert summarizer.requests[1].previous_summary == summarizer.text
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("failure", ["timeout", "cancel", "empty", "oversized"])
+async def test_summary_checkpoints_completed_batches_before_later_failure(failure):
+    from sagents.v2.context import ModelConversationSummarizer
+
+    class PartialSummary:
+        def __init__(self):
+            self.requests = []
+            self.fail = True
+
+        async def summarize(self, request):
+            self.requests.append(request)
+            if self.fail and len(self.requests) == 2:
+                if failure == "cancel":
+                    raise asyncio.CancelledError()
+                if failure == "timeout":
+                    raise ModelConversationSummarizer(None)._timeout_error("idle", {})
+                return "" if failure == "empty" else "expanded " * 2000
+            return "saved batch summary"
+
+    summarizer = PartialSummary()
+    store = InMemoryConversationSummaryStore()
+    source = tuple(message("history " * 70 + str(i)) for i in range(12)) + (
+        message("latest", "user"),
+    )
+    original = tuple(m.model_dump() for m in source)
+    reducer = PersistentSummaryContextReducer(
+        store,
+        summarizer=summarizer,
+        summary_target_tokens=32,
+        max_summary_source_tokens=600,
+        max_summary_calls=4,
+    )
+    budget = ContextBudget(max_input_tokens=1000, protected_recent_tokens=0)
+    with pytest.raises(asyncio.CancelledError if failure == "cancel" else SageV2Error):
+        await reducer.reduce(source, budget, scope=scope())
+    saved = await store.get("session")
+    assert saved is not None and saved.revision == 1
+    assert saved.source_message_count == len(summarizer.requests[0].messages)
+    assert saved.text == "saved batch summary"
+    completed_batch = summarizer.requests[0].messages
+    summarizer.requests.clear()
+    summarizer.fail = False
+    # A fresh reducer represents the next Run/process using the durable port.
+    reducer = PersistentSummaryContextReducer(
+        store,
+        summarizer=summarizer,
+        summary_target_tokens=32,
+        max_summary_source_tokens=600,
+        max_summary_calls=4,
+    )
+    try:
+        await reducer.reduce(source, budget, scope=scope())
+    except SageV2Error as exc:
+        assert exc.info.code == "context.budget_exhausted"
+    assert summarizer.requests[0].previous_summary == saved.text
+    assert not any(
+        m in completed_batch for r in summarizer.requests for m in r.messages
+    )
+    assert (
+        await store.get("session")
+    ).source_message_count > saved.source_message_count
+    assert tuple(m.model_dump() for m in source) == original
+
+
 @pytest.mark.asyncio
 async def test_summary_batches_keep_tool_pairs_together_and_bound_source():
     summarizer = Summary()
@@ -479,6 +544,7 @@ async def test_public_builder_rejects_unbounded_input_before_model_request(tmp_p
 @pytest.mark.asyncio
 async def test_summary_capacity_is_shared_across_plugin_instances():
     from sagents.v2.context import ModelConversationSummarizer
+    from sagents.v2.context.summary import SummarizationRequest
 
     active = peak = 0
 
@@ -493,8 +559,9 @@ async def _summarize(self, request, progress):
             finally:
                 active -= 1
 
+    request = SummarizationRequest(scope=scope(), messages=(), target_tokens=512)
     values = await asyncio.gather(
-        *(SummaryPlugin(None).summarize(None) for _ in range(16))
+        *(SummaryPlugin(None).summarize(request) for _ in range(16))
     )
     assert values == ["summary"] * 16
     assert peak == 4
```

**File**: `tests/sagents/v2/test_model_concurrency_budget.py` (modified, +44/-0)
```diff
@@ -112,6 +112,50 @@ async def stream(self, request):
     assert closed == [True]
 
 
+@pytest.mark.asyncio
+async def test_recording_close_after_completed_does_not_overwrite_success():
+    from unittest.mock import AsyncMock
+    from sagents.v2.model import (
+        ModelRequest,
+        ModelStreamEvent,
+        ModelEventKind,
+        ModelResponse,
+        RecordingModelProvider,
+    )
+
+    closed = []
+
+    class Provider:
+        async def stream(self, request):
+            try:
+                yield ModelStreamEvent(
+                    kind=ModelEventKind.COMPLETED,
+                    response=ModelResponse(
+                        response_id="summary-response",
+                        text="summary",
+                        finish_reason="stop",
+                    ),
+                )
+                await asyncio.Event().wait()
+            finally:
+                closed.append(True)
+
+    sink = AsyncMock()
+    provider = RecordingModelProvider(
+        Provider(), sink=sink, session_id_resolver=AsyncMock(return_value="session")
+    )
+    stream = provider.stream(
+        ModelRequest(
+            request_id="request", run_id="run", model_binding="summary", messages=()
+        )
+    )
+    assert (await anext(stream)).kind == ModelEventKind.COMPLETED
+    await stream.aclose()
+    sink.complete_model_request.assert_awaited_once()
+    sink.fail_model_request.assert_not_awaited()
+    assert closed == [True]
+
+
 @pytest.mark.asyncio
 async def test_queue_rejects_overflow_without_invoking_provider_and_preserves_fifo():
     from sagents.v2.contracts.errors import SageV2Error
```

**File**: `tests/sagents/v2/test_persistent_summary_context_matrix.py` (modified, +205/-0)
```diff
@@ -189,6 +189,110 @@ async def test_existing_summary_is_reused_and_rolled_forward_on_later_turns():
     assert projection.messages[-1].content[0].text == "new request"
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("legacy", [False, True])
+async def test_summary_survives_history_provenance_reconstruction(legacy):
+    from sagents.v2.context.summary import message_digests_async
+
+    store = InMemoryConversationSummaryStore()
+    summarizer = RecordingSummarizer()
+    reducer = PersistentSummaryContextReducer(
+        store,
+        summarizer=summarizer,
+        protected_recent_units=2,
+        summary_target_tokens=128,
+    )
+    source = ledger()
+    # Simulate a prefix from prior Runs, followed by new active-Run messages.
+    source = (
+        source[0],
+        source[1].model_copy(
+            update={
+                "metadata": {"source_run_id": "old-run", "source_item_id": "old-item"}
+            }
+        ),
+        *source[2:],
+    )
+    budget = ContextBudget(max_input_tokens=100_000, max_messages=4)
+    await reducer.reduce(source, budget, scope=scope())
+    saved = await store.get("session_1")
+    if legacy:
+        saved = saved.model_copy(
+            update={
+                "covered_message_digests": await message_digests_async(
+                    source[1:4], include_source_metadata=True
+                )
+            }
+        )
+        await store.save(saved, expected_revision=saved.revision)
+    rebuilt = tuple(
+        m.model_copy(
+            update={
+                "metadata": {
+                    **m.metadata,
+                    "source_session_id": "session_1",
+                    "source_run_id": "rebuilt-run",
+                    "source_item_id": f"item-{i}",
+                }
+            }
+        )
+        if i >= 2
+        else m
+        for i, m in enumerate(source)
+    )
+    result = await reducer.reduce(rebuilt, budget, scope=scope())
+    assert result.strategy == "persistent_summary"
+    assert len(summarizer.requests) == 1
+    assert await store.get("session_1") == saved
+    for field in ("content", "metadata"):
+        changed = rebuilt[1].model_copy(
+            update={
+                field: (
+                    (TextBlock(text="rewritten fact"),)
+                    if field == "content"
+                    else {**rebuilt[1].metadata, "tool_context": True}
+                )
+            }
+        )
+        validated, _ = await reducer._validated_previous(saved, (changed, *rebuilt[2:]))
+        assert validated is None
+
+
+@pytest.mark.asyncio
+async def test_exhausted_summary_timeout_preserves_previous_summary_and_history(
+    monkeypatch,
+):
+    store = InMemoryConversationSummaryStore()
+    reducer = PersistentSummaryContextReducer(
+        store, summarizer=RecordingSummarizer(), protected_recent_units=2
+    )
+    budget = ContextBudget(max_input_tokens=100_000, max_messages=4)
+    await reducer.reduce(ledger(), budget, scope=scope())
+    previous = await store.get("session_1")
+    source = (
+        *ledger(),
+        ModelMessage(role="assistant", content=(TextBlock(text="new answer"),)),
+        ModelMessage(role="user", content=(TextBlock(text="new request"),)),
+    )
+    original = tuple(message.model_dump() for message in source)
+    summarizer = ModelConversationSummarizer(ScriptedModelProvider(()))
+
+    async def fail(request, progress):
+        raise summarizer._timeout_error("idle", progress)
+
+    async def sleep(delay):
+        pass
+
+    monkeypatch.setattr(summarizer, "_summarize", fail)
+    monkeypatch.setattr(asyncio, "sleep", sleep)
+    reducer.summarizer = summarizer
+    with pytest.raises(SageV2Error) as caught:
+        await reducer.reduce(source, budget, scope=scope())
+    assert caught.value.info.metadata["timeout_retries_exhausted"] is True
+    assert await store.get("session_1") == previous
+    assert tuple(message.model_dump() for message in source) == original
+
+
 @pytest.mark.asyncio
 async def test_rewritten_prefix_never_applies_stale_summary():
     store = InMemoryConversationSummaryStore()
@@ -532,6 +636,7 @@ async def events():
             return events()
 
     summarizer = ModelConversationSummarizer(SlowSummaryModel(), timeout_seconds=0.01)
+    summarizer._MAX_TIMEOUT_RETRIES = 0  # Test the deadline independently of backoff.
 
     with pytest.raises(SageV2Error) as caught:
         await summarizer.summarize(
@@ -599,6 +704,7 @@ async def events():
         timeout_seconds=0.08 if mode == "total" else 0.5,
         idle_timeout_seconds=0.06,
     )
+    summarizer._MAX_TIMEOUT_RETRIES = 0
     request = SummarizationRequest(
         scope=scope(), messages=ledger()[1:4], target_tokens=512
     )
@@ -620,6 +726,104 @@ def test_summary_has_a_separate_total_budget_from_short_auxiliary_calls():
     assert summarizer.idle_timeout_seconds == 60
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("kind", ["idle", "total", 
```

---

### Incident Patch 13: `16ec9d7b` (2026-10-09)
**Commit Message**: fix(docs): restore bilingual parity for MCP and observability

**File**: `docs/en/ENV_VARS.md` (modified, +15/-0)
```diff
@@ -39,6 +39,21 @@ ref: v2-ENV_VARS
 | `SAGE_SERVER_JAEGER_URL` | Optional OTLP endpoint |
 | `SAGE_SERVER_JAEGER_SERVICE_NAME` | `sage-server` |
 | `SAGE_SERVER_JAEGER_PUBLIC_URL` | `http://127.0.0.1:16686/jaeger` |
+| `SAGE_SERVER_TRACE_BACKEND` | Empty: use OTLP when `JAEGER_URL` is configured, otherwise `noop`; select `noop`, `otlp`, or `langfuse` |
+| `SAGE_SERVER_TRACE_OTLP_ENDPOINT` | Empty; falls back to the legacy Jaeger endpoint |
+| `SAGE_SERVER_TRACE_OTLP_PROTOCOL` | `grpc`; `grpc` or `http` |
+| `SAGE_SERVER_TRACE_OTLP_INSECURE` | `false`; enable only for plaintext gRPC |
+| `SAGE_SERVER_TRACE_SERVICE_NAME` | `sage-server` |
+| `SAGE_SERVER_TRACE_ENVIRONMENT` | `production` |
+| `SAGE_SERVER_TRACE_CONTENT_MODE` | `redacted`; `redacted` or `metadata` |
+| `SAGE_SERVER_TRACE_MAX_CONTENT_CHARS` | `16384`; between 256 and 65536 characters |
+| `SAGE_SERVER_TRACE_SAMPLE_RATE` | `1`; between 0 and 1 |
+| `SAGE_SERVER_TRACE_TIMEOUT_SECONDS` | `3`; greater than 0 and at most 30 seconds |
+| `SAGE_SERVER_LANGFUSE_BASE_URL` | Empty; required for the Langfuse backend |
+| `SAGE_SERVER_LANGFUSE_PUBLIC_URL` | Empty; optional project console URL |
+| `SAGE_SERVER_LANGFUSE_PUBLIC_KEY_ENV` | `LANGFUSE_PUBLIC_KEY`; environment variable containing the public key |
+| `SAGE_SERVER_LANGFUSE_SECRET_KEY_ENV` | `LANGFUSE_SECRET_KEY`; environment variable containing the secret key |
+| `SAGE_SERVER_LANGFUSE_INGESTION_VERSION` | `4`; `3` or `4` |
 | `SAGE_SERVER_PUBLIC_URL` | Empty: use the incoming request origin; set the public origin for A2A behind a proxy |
 
 Concurrency and capacity values must be positive. They are per-process limits, not distributed quotas. Redis is no longer a startup dependency or AG-UI replay store.
```

**File**: `docs/en/architecture/sagents-v2-observability.md` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+---
+layout: default
+title: Model Observability and Langfuse
+parent: Architecture
+nav_order: 10
+lang: en
+ref: v2-detail-sagents-v2-observability
+---
+
+{% include lang_switcher.html %}
+
+# SAgents V2 Model Observability and Langfuse
+
+## Responsibilities
+
+`DiagnosticSink` saves local model requests/responses and wire requests for the Session model diagnostics view; it is not a recovery source. `TraceSink` represents Agent, model, and tool lifecycles, inputs and outputs, usage, status, and parent relationships. Each consumes execution data directly without reading the other's files or relying on the observability backend for Run recovery. Diagnostic write failures produce warnings without interrupting model calls.
+
+`ObservedRunDriver` owns Agent and tool observations; `RecordingModelProvider` owns model observations. They emit the same vendor-independent `TraceSpan`. `sage.trace.otlp` exports generic/GenAI attributes, while `sage.trace.langfuse` adds Langfuse mappings over the shared OTLP transport. No database tables or durable observability queues are added.
+
+## Trace identity
+
+Each top-level execute/resume starts a new trace. Multiple executions in one Session are linked by session_id, and suspension/resumption by run_id. This changes the previous behavior of using one Jaeger trace for the entire Session; historical data can still be queried by session_id.
+
+Child Agents, models, and tools in one execution inherit the trace. A trusted `RequestContext.trace` can supply trace_id/span_id as an explicit remote parent. ObservedRunDriver writes the current identity into the RequestContext passed to the execution body for downstream propagation. Hosts should forward that context across process boundaries. Independent or resumed executions without it start a new trace rather than reconstructing a parent span from storage. HTTP X-Request-ID remains correlation_id, not a W3C trace ID.
+
+OTLP preserves Sage's 128-bit trace ID and 64-bit span ID. Root spans have no parent; remote or already-ended parents retain their actual parent_span_id. Session, Run, request, tool_call, and trusted user/tenant identities are query attributes. Langfuse sessions use root_session_id to group child Agents; the actual child session_id remains in observation metadata.
+
+## Attributes and content
+
+- model.request: actual model name, model parameters, messages/tools, response text/tool calls, finish_reason, input/output/cache/reasoning tokens, and known cost.
+- First token means the first nonempty text or reasoning delta. The first text delta is recorded separately as the first_text event and first_text_ms; a reasoning first token is not treated as user-visible text latency.
+- tool.call: tool name, arguments, results, and errors; agent.run: input, final output, and run_state.
+- Unreported token usage is not fabricated as zero. Unknown actual model names are not replaced by the `fast/default` binding. Cost comes from UsageSummary.cost in US dollars; Sage does not estimate prices when it is absent.
+- Langfuse cache/reasoning tokens are exported as mutually exclusive categories, avoiding double counting them as subsets of total input/output. Configure custom model prices in Langfuse.
+
+`redacted` mode collects content while masking known sensitive keys, Bearer/sk tokens, URL userinfo/query/fragment, and inline/base64 media. `metadata` collects no input/output content. The default per-item content limit is 16384 characters, with a maximum of 65536; oversized content is represented as valid JSON with truncated/preview fields. Structured redaction cannot identify all personal information in free text. Use metadata to disable content collection entirely.
+
+## Server configuration
+
+Install the existing optional dependencies:
+
+```bash
+python -m pip install -e '.[server-v2,otel]'
+```
+
+Langfuse:
+
+```dotenv
+SAGE_SERVER_TRACE_BACKEND=langfuse
+SAGE_SERVER_LANGFUSE_BASE_URL=https://cloud.langfuse.com
+LANGFUSE_PUBLIC_KEY=pk-lf-your-project
+LANGFUSE_SECRET_KEY=sk-lf-your-project
+SAGE_SERVER_TRACE_ENVIRONMENT=production
+SAGE_SERVER_TRACE_CONTENT_MODE=redacted
+SAGE_SERVER_TRACE_SAMPLE_RATE=1.0
+SAGE_SERVER_LANGFUSE_INGESTION_VERSION=4
+```
+
+Use the root URL of the selected region or self-hosted instance. The plugin appends `/api/public/otel/v1/traces` and uses OTLP/HTTP protobuf with Basic Auth. Version 4 adds the ingestion header; select 3 for a compatible v3 instance. `SAGE_SERVER_LANGFUSE_PUBLIC_URL` can point the browser entry to a specific project. Project keys are read only from the environment; the manifest stores environment variable names. Override those names with `SAGE_SERVER_LANGFUSE_PUBLIC_KEY_ENV` and `SAGE_SERVER_LANGFUSE_SECRET_KEY_ENV`.
+
+Generic OTLP:
+
+```dotenv
+SAGE_SERVER_TRACE_BACKEND=otlp
+SAGE_SERVER_TRACE_OTLP_ENDPOINT=http://127.0.0.1:4318/v1/traces
+SAGE_SERVER_TRACE_OTLP_PROTOCOL=http
+```
+
+For gRPC, select `grpc` and use the collector's gRPC address. Set `SAGE_
```

**File**: `docs/zh/ENV_VARS.md` (modified, +15/-0)
```diff
@@ -39,6 +39,21 @@ ref: v2-ENV_VARS
 | `SAGE_SERVER_JAEGER_URL` | 可选 OTLP 地址 |
 | `SAGE_SERVER_JAEGER_SERVICE_NAME` | `sage-server` |
 | `SAGE_SERVER_JAEGER_PUBLIC_URL` | `http://127.0.0.1:16686/jaeger` |
+| `SAGE_SERVER_TRACE_BACKEND` | 默认空：配置 `JAEGER_URL` 时使用 OTLP，否则为 `noop`；可选 `noop`、`otlp`、`langfuse` |
+| `SAGE_SERVER_TRACE_OTLP_ENDPOINT` | 默认空；回退到旧 Jaeger 地址 |
+| `SAGE_SERVER_TRACE_OTLP_PROTOCOL` | `grpc`；可选 `grpc` 或 `http` |
+| `SAGE_SERVER_TRACE_OTLP_INSECURE` | `false`；仅明文 gRPC 时启用 |
+| `SAGE_SERVER_TRACE_SERVICE_NAME` | `sage-server` |
+| `SAGE_SERVER_TRACE_ENVIRONMENT` | `production` |
+| `SAGE_SERVER_TRACE_CONTENT_MODE` | `redacted`；可选 `redacted` 或 `metadata` |
+| `SAGE_SERVER_TRACE_MAX_CONTENT_CHARS` | `16384`；范围 256–65536 字符 |
+| `SAGE_SERVER_TRACE_SAMPLE_RATE` | `1`；范围 0–1 |
+| `SAGE_SERVER_TRACE_TIMEOUT_SECONDS` | `3`；大于 0 且不超过 30 秒 |
+| `SAGE_SERVER_LANGFUSE_BASE_URL` | 默认空；使用 Langfuse 后端时必填 |
+| `SAGE_SERVER_LANGFUSE_PUBLIC_URL` | 默认空；可选项目控制台地址 |
+| `SAGE_SERVER_LANGFUSE_PUBLIC_KEY_ENV` | `LANGFUSE_PUBLIC_KEY`；保存公钥的环境变量名 |
+| `SAGE_SERVER_LANGFUSE_SECRET_KEY_ENV` | `LANGFUSE_SECRET_KEY`；保存私钥的环境变量名 |
+| `SAGE_SERVER_LANGFUSE_INGESTION_VERSION` | `4`；可选 `3` 或 `4` |
 | `SAGE_SERVER_PUBLIC_URL` | 默认空：使用请求来源地址；反向代理后的 A2A 应设置公开来源地址 |
 
 并发和容量参数必须为正数，约束单进程，不是分布式配额。Redis 不再是启动依赖或 AG-UI 回放存储。
```

**File**: `docs/zh/MCP_SERVERS.md` (modified, +6/-0)
```diff
@@ -75,3 +75,9 @@ mcp = McpToolPlugin((McpServerConfig(
 2. **授权：** 嵌入式 Agent 的 `tools` 授权名单应包含实际发现的名称；宿主还需给 actor 所需的 `tool.external_side_effect` scope。MCP bridge 将所有外部工具标为 `WRITE` 与 `requires_approval=True`，即使名称或注释看起来只是只读搜索。默认 `CONFIGURED` 策略在 scope 检查后要求审批；宿主选择的策略与审批记忆可能改变交互。服务 Key 不能代替 Sage 授权。
 3. **调用：** 在宿主审批流程中核对工具和参数，再检查返回结果。区分发现/鉴权失败与工具响应的 `isError`。超时、取消或丢失响应可能使远端副作用未知；考虑重试前先核实远端结果。
 4. **清理：** 默认 bridge 为发现或一次调用打开短生命周期 SDK 会话，并在退出 context 后关闭。嵌入式宿主退出时保留 `await application.close()`。停用或删除连接用于停止后续使用，活动 Run 需另外取消；关闭本地会话不等于撤销服务 Key，也不能证明远端任务已停止。
+
+## 免 Key 的 Parallel 搜索示例
+
+[可运行的 SAgents v2 示例](../../examples/PARALLEL_SEARCH.md)通过 Streamable HTTP
+使用 Parallel Search MCP，在不提供 Parallel API Key 的情况下，经 v2 桥接发现并调用
+网页搜索和页面抓取工具。示例由宿主显式调用；接入 Agent 时，请按上面的授权步骤配置。
```

**File**: `docs/zh/architecture/sagents-v2-local-sandbox-security.md` (modified, +2/-2)
```diff
@@ -73,8 +73,8 @@ Desktop 在 `component_configs["execution.sandbox"].network` 配置网络策略
 Desktop 为代理模式默认启用 HTTP/HTTPS。CLI 支持：
 
 ```bash
-sage v2 run "任务" --network-mode allowlist --network-host pypi.org --network-host files.pythonhosted.org
-sage v2 run "任务" --network-mode proxy --network-proxy http://127.0.0.1:8080
+sage v2 run "task" --network-mode allowlist --network-host pypi.org --network-host files.pythonhosted.org
+sage v2 run "task" --network-mode proxy --network-proxy http://127.0.0.1:8080
 ```
 
 `run`、`chat`、`resume` 均支持这些参数。`--network-port` 可重复指定端口；`--network-allow-private` 显式允许私网目标。`none`/`unrestricted` 不能附带白名单或代理参数。Server 宿主可向 `workspace_sandbox_spec` 或 `provision_workspace` 显式传入 `NetworkPolicy`。直接构造规格时，`unrestricted` 需设置 `deny_private_networks=false`，代理模式需显式选择 `allowed_schemes`。
```

**File**: `docs/zh/architecture/sagents-v2-observability.md` (modified, +11/-0)
```diff
@@ -1,3 +1,14 @@
+---
+layout: default
+title: 模型观测与 Langfuse
+parent: 架构
+nav_order: 10
+lang: zh
+ref: v2-detail-sagents-v2-observability
+---
+
+{% include lang_switcher.html %}
+
 # SAgents V2 模型观测与 Langfuse
 
 ## 职责
```

---

### Incident Patch 14: `264e8953` (2026-10-09)
**Commit Message**: fix(ci): align runtime fixtures and isolate MCP session transport

**File**: `sagents/v2/tool/_mcp_session.py` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+"""Shared official MCP SDK session lifecycle for Tool transports."""
+
+from __future__ import annotations
+
+import asyncio
+from collections.abc import AsyncIterator
+from contextlib import AsyncExitStack, asynccontextmanager
+from typing import Any, Protocol
+
+
+class McpClientSession(Protocol):
+    async def initialize(self) -> Any: ...
+    async def list_tools(self) -> Any: ...
+    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any: ...
+
+
+@asynccontextmanager
+async def sdk_session(config: Any) -> AsyncIterator[McpClientSession]:
+    """Open and initialize one official MCP Python SDK client session."""
+
+    try:
+        from mcp import ClientSession, StdioServerParameters
+        from mcp.client.sse import sse_client
+        from mcp.client.stdio import stdio_client
+        from mcp.client.streamable_http import streamablehttp_client
+    except ImportError as exc:  # pragma: no cover - depends on host packaging
+        raise RuntimeError("the optional 'mcp' package is not installed") from exc
+
+    headers = (
+        {"Authorization": f"Bearer {config.api_key.get_secret_value()}"}
+        if config.api_key
+        else None
+    )
+    async with AsyncExitStack() as stack:
+        if config.protocol == "stdio":
+            if not config.command:
+                raise ValueError("stdio MCP requires command")
+            streams = await stack.enter_async_context(
+                stdio_client(
+                    StdioServerParameters(
+                        command=config.command,
+                        args=list(config.args),
+                        env=dict(config.env),
+                    )
+                )
+            )
+            read, write = streams
+        elif config.protocol == "sse":
+            if not config.url:
+                raise ValueError("SSE MCP requires URL")
+            read, write = await stack.enter_async_context(
+                sse_client(config.url, headers=headers, timeout=config.timeout_seconds)
+            )
+        else:
+            if not config.url:
+                raise ValueError("streamable HTTP MCP requires URL")
+            read, write, _ = await stack.enter_async_context(
+                streamablehttp_client(
+                    config.url, headers=headers, timeout=config.timeout_seconds
+                )
+            )
+        session = await stack.enter_async_context(ClientSession(read, write))
+        await asyncio.wait_for(session.initialize(), timeout=config.timeout_seconds)
+        yield session
```

**File**: `sagents/v2/tool/plugins/mcp.py` (modified, +4/-59)
```diff
@@ -13,9 +13,8 @@
 import hashlib
 import json
 import re
-from collections.abc import AsyncIterator, Callable
-from contextlib import AsyncExitStack, asynccontextmanager
-from typing import Any, Literal, Protocol
+from collections.abc import Callable
+from typing import Any, Literal
 from urllib.parse import urlsplit
 
 from jsonschema import Draft202012Validator
@@ -41,6 +40,8 @@
     ToolExecutionResult,
 )
 from sagents.v2.tool._idempotency import call_fingerprint
+from sagents.v2.tool._mcp_session import McpClientSession as McpClientSession
+from sagents.v2.tool._mcp_session import sdk_session as _sdk_session
 
 
 class McpServerConfig(StrictModel):
@@ -78,12 +79,6 @@ def validate_transport(self) -> "McpServerConfig":
         return self
 
 
-class McpClientSession(Protocol):
-    async def initialize(self) -> Any: ...
-    async def list_tools(self) -> Any: ...
-    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any: ...
-
-
 McpSessionFactory = Callable[[McpServerConfig], Any]
 
 
@@ -720,56 +715,6 @@ def _error(
         )
 
 
-@asynccontextmanager
-async def _sdk_session(config: McpServerConfig) -> AsyncIterator[McpClientSession]:
-    """Open and initialize one official MCP Python SDK client session."""
-
-    try:
-        from mcp import ClientSession, StdioServerParameters
-        from mcp.client.sse import sse_client
-        from mcp.client.stdio import stdio_client
-        from mcp.client.streamable_http import streamablehttp_client
-    except ImportError as exc:  # pragma: no cover - depends on host packaging
-        raise RuntimeError("the optional 'mcp' package is not installed") from exc
-
-    headers = (
-        {"Authorization": f"Bearer {config.api_key.get_secret_value()}"}
-        if config.api_key
-        else None
-    )
-    async with AsyncExitStack() as stack:
-        if config.protocol == "stdio":
-            if not config.command:
-                raise ValueError("stdio MCP requires command")
-            streams = await stack.enter_async_context(
-                stdio_client(
-                    StdioServerParameters(
-                        command=config.command,
-                        args=list(config.args),
-                        env=dict(config.env),
-                    )
-                )
-            )
-            read, write = streams
-        elif config.protocol == "sse":
-            if not config.url:
-                raise ValueError("SSE MCP requires URL")
-            read, write = await stack.enter_async_context(
-                sse_client(config.url, headers=headers, timeout=config.timeout_seconds)
-            )
-        else:
-            if not config.url:
-                raise ValueError("streamable HTTP MCP requires URL")
-            read, write, _ = await stack.enter_async_context(
-                streamablehttp_client(
-                    config.url, headers=headers, timeout=config.timeout_seconds
-                )
-            )
-        session = await stack.enter_async_context(ClientSession(read, write))
-        await asyncio.wait_for(session.initialize(), timeout=config.timeout_seconds)
-        yield session
-
-
 def _value(value: Any, name: str, default: Any = None) -> Any:
     if isinstance(value, dict):
         return value.get(name, default)
```

**File**: `sagents/v2/tool/plugins/sandbox_mcp.py` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@
     OperationIntent,
     ProcessRequest,
 )
-from sagents.v2.tool.plugins.mcp import _sdk_session
+from sagents.v2.tool._mcp_session import sdk_session
 
 
 class SandboxMcpSessionFactory:
@@ -22,7 +22,7 @@ def __init__(self, sandbox, issuer, *, workspace_root="/workspace"):
     @asynccontextmanager
     async def __call__(self, config):
         if config.protocol != "stdio":
-            async with _sdk_session(config) as session:
+            async with sdk_session(config) as session:
                 yield session
             return
         import anyio
```

**File**: `tests/app/v2/server/test_a2a_loop_guard.py` (modified, +1/-1)
```diff
@@ -208,5 +208,5 @@ def test_a_peer_that_is_not_in_the_catalog_gives_the_agent_no_tools(tmp_path):
     # The Run asks what to do instead of delegating: the Tool the model named
     # is not one this Run was granted, because no peer was configured.
     assert interactions
-    assert interactions[0]["payload"]["reason_code"] == "tool.not_enabled"
+    assert interactions[0]["payload"]["reason_code"] == "tool.not_found"
     assert transport.sent == []
```

**File**: `tests/app/v2/server/test_agui_chat.py` (modified, +2/-2)
```diff
@@ -197,11 +197,11 @@ def test_run_without_model_returns_clear_error(tmp_path, language, message):
 
 @pytest.mark.timeout(30)
 def test_catalog_model_is_used_when_dispatcher_drops_contextvar(tmp_path, monkeypatch):
-    from tests.app.v2.server.conftest import scripted_hello
+    from tests.app.v2.server.conftest import CompletingJudgeModel, scripted_hello
 
     monkeypatch.setattr(
         "app.v2.server.runtime.models._build_catalog_provider",
-        lambda record: scripted_hello(),
+        lambda record: CompletingJudgeModel(scripted_hello()),
     )
     service = make_test_service(tmp_path, fallback=False)
     with TestClient(create_app(service=service)) as client:
```

**File**: `tests/app/v2/server/test_packages.py` (modified, +4/-4)
```diff
@@ -221,7 +221,7 @@ def test_agent_creates_agent_through_management_tool(service):
     from app.v2.server.main import create_app
     from sagents.v2.testing.plugins import ScriptedModelProvider
     from tests.sagents.v2.test_agent_management_matrix import tool_step
-    from tests.app.v2.server.conftest import scripted_hello
+    from tests.app.v2.server.conftest import CompletingJudgeModel, scripted_hello
 
     with TestClient(create_app(service=service)) as client:
         headers = {"Authorization": f"Bearer {register_and_login(client)}"}
@@ -234,7 +234,7 @@ def test_agent_creates_agent_through_management_tool(service):
         ]
         parent["manifest"]["agents"]["assistant"]["tools"] = ["agent_package_save"]
         # Saving and building do not consume scripted responses.
-        service.execution.fallback_model = (
+        service.execution.fallback_model = CompletingJudgeModel(
             ScriptedModelProvider(
                 (
                     tool_step("agent_package_save", {"bundle": child}, "create"),
@@ -418,7 +418,7 @@ def test_source_tool_plugin_uses_standard_registration(service):
     from app.v2.server.main import create_app
     from sagents.v2.testing.plugins import ScriptedModelProvider
     from tests.sagents.v2.test_agent_management_matrix import tool_step
-    from tests.app.v2.server.conftest import scripted_hello
+    from tests.app.v2.server.conftest import CompletingJudgeModel, scripted_hello
 
     async def authorize(action, bundle, context):
         assert bundle.manifest.plugins[0].id == "test.scale"
@@ -427,7 +427,7 @@ async def authorize(action, bundle, context):
     provider = ScriptedModelProvider(
         (tool_step("scale", {"value": 4}, "scale"), *scripted_hello()._steps)
     )
-    service.execution.fallback_model = provider
+    service.execution.fallback_model = CompletingJudgeModel(provider)
     with TestClient(create_app(service=service)) as client:
         headers = {"Authorization": f"Bearer {register_and_login(client)}"}
         bundle = client.get("/api/agent-packages/template", headers=headers).json()[
```

**File**: `tests/app/v2/server/test_quality_audit.py` (modified, +6/-1)
```diff
@@ -32,7 +32,12 @@
 
 async def _attach_without_host_sandbox(*args, **kwargs):
     del args, kwargs
-    return EphemeralToolPlugin(), None, None
+
+    async def close():
+        pass
+
+    runtime = SimpleNamespace(sandbox=object(), close=close)
+    return EphemeralToolPlugin(), runtime, None
 
 
 @pytest.mark.asyncio
```

**File**: `tests/sagents/v2/test_agent_management_matrix.py` (modified, +1/-0)
```diff
@@ -367,6 +367,7 @@ async def test_parent_model_creates_and_invokes_full_agent(tmp_path):
 
 
 @pytest.mark.asyncio
+@pytest.mark.timeout(10)
 @pytest.mark.parametrize("binding", ["host", "plugin"])
 async def test_builder_executes_declared_flow_and_custom_node(tmp_path, binding):
     from sagents.v2.flow import FlowNodeResult
```

---

### Incident Patch 15: `55d0fc8c` (2026-10-09)
**Commit Message**: fix(v2): omit Responses output_schema for text tool results

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `change_log.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 面向版本用户的完整说明保存在 [`release_notes/`](release_notes/)；本文件记录持续开发变更。
 
+- **2026-10-09** Responses 不再下发对不上的 output_schema；load_skill 只保留文本结果，避免下一轮 422。
+
 - **2026-10-09** V2 新增 Langfuse 观测插件，通用 OTLP 同步补齐模型输入输出、实际模型、用量和首 token；执行级 trace 保留真实父子 ID，支持采样、脱敏、后台有界导出及失败统计。Server 增加后端配置和管理入口，诊断写入失败不再中断模型调用，不新增业务存储。
 
 - **2026-10-01** 持久摘要按规范历史续压且不删检查点，一次压不完先写回已覆盖前缀；压缩前预留 runtime 注入。
```

**File**: `sagents/v2/model/plugins/openai_responses.py` (modified, +3/-2)
```diff
@@ -608,8 +608,9 @@ def _tool_definition(tool) -> dict[str, Any]:
         }
         if tool.strict is not None:
             value["strict"] = tool.strict
-        if tool.output_schema is not None:
-            value["output_schema"] = tool.output_schema
+        # Historical function_call_output is a string or content parts, not a
+        # schema object. Advertising output_schema makes the gateway 422 the
+        # next turn when it validates those stored results.
         return value
 
     @classmethod
```

**File**: `sagents/v2/skill/tool.py` (modified, +0/-19)
```diff
@@ -48,25 +48,6 @@ def __init__(self, loader: SkillLoader, *, language: str | None = None) -> None:
             "additionalProperties": False,
         },
         strict=True,
-        output_schema={
-            "type": "object",
-            "properties": {
-                "skill_name": {"type": "string"},
-                "workspace_path": {"type": "string"},
-                "content_hash": {"type": "string"},
-                "active_skills": {
-                    "type": "array",
-                    "items": {"type": "string"},
-                },
-            },
-            "required": [
-                "skill_name",
-                "workspace_path",
-                "content_hash",
-                "active_skills",
-            ],
-            "additionalProperties": False,
-        },
         side_effect_level=SideEffectLevel.WRITE,
         idempotency_strategy=IdempotencyStrategy.FINGERPRINT,
         cancel_semantics=CancelSemantics.NOT_STARTED_ONLY,
```

**File**: `tests/sagents/v2/test_builtin_model_protocols_matrix.py` (modified, +81/-0)
```diff
@@ -380,6 +380,87 @@ def test_openai_responses_preserves_image_blocks_in_tool_output():
     }
 
 
+def test_openai_responses_omits_output_schema_when_tool_result_is_plain_text():
+    provider = OpenAIResponsesModelProvider(
+        OpenAIResponsesConfig(model="gpt-test", capabilities=CAPABILITIES),
+        client=object(),
+    )
+    outgoing = provider.diagnostic_request(
+        request(
+            tools=(
+                ModelToolDefinition(
+                    name="load_skill",
+                    description="Load one skill",
+                    input_schema={
+                        "type": "object",
+                        "properties": {"skill_name": {"type": "string"}},
+                    },
+                    strict=True,
+                    output_schema={
+                        "type": "object",
+                        "properties": {
+                            "skill_name": {"type": "string"},
+                            "workspace_path": {"type": "string"},
+                            "content_hash": {"type": "string"},
+                            "active_skills": {
+                                "type": "array",
+                                "items": {"type": "string"},
+                            },
+                        },
+                        "required": [
+                            "skill_name",
+                            "workspace_path",
+                            "content_hash",
+                            "active_skills",
+                        ],
+                        "additionalProperties": False,
+                    },
+                ),
+            ),
+            messages=(
+                ModelMessage(
+                    role="assistant",
+                    tool_calls=(
+                        ModelToolCall(
+                            tool_call_id="call_skill",
+                            name="load_skill",
+                            arguments={"skill_name": "yiii-short-video-production"},
+                        ),
+                    ),
+                ),
+                ModelMessage(
+                    role="tool",
+                    tool_call_id="call_skill",
+                    content=(
+                        TextBlock(
+                            text=(
+                                "Skill yiii-short-video-production loaded. "
+                                "Active skills: yiii-short-video-production."
+                            )
+                        ),
+                    ),
+                    metadata={
+                        "skill_name": "yiii-short-video-production",
+                        "workspace_path": "/tmp/skill",
+                        "content_hash": "sha256:abc",
+                        "active_skills": ["yiii-short-video-production"],
+                    },
+                ),
+            ),
+        )
+    )
+
+    assert "output_schema" not in outgoing["tools"][0]
+    assert outgoing["input"][1] == {
+        "type": "function_call_output",
+        "call_id": "call_skill",
+        "output": (
+            "Skill yiii-short-video-production loaded. "
+            "Active skills: yiii-short-video-production."
+        ),
+    }
+
+
 @pytest.mark.asyncio
 async def test_openai_responses_retries_rejected_reasoning_control_once():
     error = RuntimeError("reasoning is unsupported by this deployment")
```

**File**: `tests/sagents/v2/test_skill_provider_matrix.py` (modified, +5/-0)
```diff
@@ -272,6 +272,7 @@ async def test_load_skill_exposes_a_strict_native_v2_schema_and_loads_lazily():
 
     assert definition.name == "load_skill"
     assert definition.strict is True
+    assert definition.output_schema is None
     assert definition.input_schema == {
         "type": "object",
         "properties": {
@@ -298,6 +299,10 @@ async def test_load_skill_exposes_a_strict_native_v2_schema_and_loads_lazily():
     )
 
     assert "alpha" in result.content[0].text
+    assert result.metadata["skill_name"] == "alpha"
+    assert result.metadata["active_skills"] == ["alpha"]
+    assert result.metadata["content_hash"]
+    assert result.metadata["workspace_path"]
     assert provider.fetches == [("run_1", "alpha")]
     assert workspace.materializations[0][1] == "alpha"
 
```

#### Recent Merged Pull Requests:
- **PR #281** (2026-10-10): docs: clarify desktop installer quickstart (@ZHangZHengEric)
- **PR #280** (2026-10-09): fix(v2): omit Responses output_schema for text tool results (@xiaozhang112)
- **PR #279** (2026-10-09): Add a keyless Parallel Search MCP example for SAgents v2 (@georgeatparallel)
- **PR #278** (2026-10-08): docs(mcp): explain authenticated remote MCP and approval in v2 (@ct-jaryn)
- **PR #277** (2026-10-08): fix(v2): add sandbox read paths and resume persistent summaries (@xiaozhang112)
- **PR #276** (2026-09-28): refactor: isolate v1/v2 code and standalone AnyTool MCP (@ZHangZHengEric)
- **PR #275** (2026-09-28): fix(v2): 修复取消恢复生命周期并支持插件配置沙箱 PATH (@xiaozhang112)
- **PR #274** (2026-09-24): fix(v2): keep full skill descriptions in the catalog (@xiaozhang112)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
