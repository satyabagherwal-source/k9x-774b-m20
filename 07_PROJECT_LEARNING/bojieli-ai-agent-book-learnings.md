# Forensic Learning Record (Deep Inspection): bojieli/ai-agent-book

> **Canonical Artifact**: `07_PROJECT_LEARNING/bojieli-ai-agent-book-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bojieli/ai-agent-book](https://github.com/bojieli/ai-agent-book))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:22:42.437Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bojieli/ai-agent-book`
- **Description**: 《深入理解 AI Agent：设计原理与工程实践》（李博杰 著）开源主仓库：全书正文、编译版 PDF 与按章配套代码
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 52494 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `chapter10/generative-agents/compat/utils.py`
```
"""Runtime configuration overlay for the pinned Generative Agents source.

The upstream project asks users to put a plaintext API key in its ``utils.py``.
Experiment 10-5 instead imports this overlay ahead of the upstream source and
reads credentials exclusively from the environment.
"""

from __future__ import annotations

import os


openai_api_key = os.environ["DASHSCOPE_API_KEY"]
openai_api_base = os.environ.get(
    "GA_OPENAI_API_BASE",
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
)
key_owner = "ai-agent-book Experiment 10-5"

maze_assets_loc = os.environ["GA_MAZE_ASSETS_ROOT"]
env_matrix = f"{maze_assets_loc}/the_ville/matrix"
env_visuals = f"{maze_assets_loc}/the_ville/visuals"

fs_storage = os.environ["GA_STORAGE_ROOT"]
fs_temp_storage = os.environ["GA_TEMP_STORAGE_ROOT"]

collision_block_id = "32125"
debug = False

```

### Core Architecture Module: `chapter2/prompt-engineering/ablation_agent.py`
```
"""
Custom Agent for Ablation Study
Extends ToolCallingAgent to support tone modifications
"""

import json
import os
import time
import copy
import traceback
from datetime import datetime, timezone
from litellm import completion
from typing import List, Optional, Dict, Any

from tau_bench.agents.base import Agent
from tau_bench.agents.tool_calling_agent import message_to_action
from tau_bench.envs.base import Env
from tau_bench.types import SolveResult, Action, RESPOND_ACTION_NAME


def completion_token_limit(model: str) -> int:
    """Return enough output budget for reasoning models to emit an action."""
    return 8192 if "kimi-k3" in str(model).lower() else 4096


class AblationAgent(Agent):
    """
    Agent that supports tone modifications for ablation studies
    """
    
    def __init__(
        self,
        tools_info: List[Dict[str, Any]],
        wiki: str,
        model: str,
        provider: str,
        temperature: float = 0.0,
        verbose: bool = True,
        seed: Optional[int] = None,
    ):
        """
        Initialize the ablation agent
        
        Args:
            tools_info: Information about available tools
            wiki: Wiki/system prompt text (may have tone modifications already applied)
            model: Model name
            provider: Model provider
            temperature: Sampling temperature
            verbose: Whether to show detailed output (default: True)
        """
        self.tools_info = tools_info
        self.wiki = wiki
        self.model = model
        self.provider = provider
        self.temperature = temperature
        self.verbose = verbose
        self.seed = seed
    
    def solve(
        self, env: Env, task_index: Optional[int] = None, max_num_steps: int = 30
    ) -> SolveResult:
        """
        Solve a task with potential tone modifications
        
        Args:
            env: The environment
            task_index: Optional task index
            max_num_steps: Maximum number of steps
        
        Returns:
            SolveResult with the outcome
        """
        if self.verbose:
            print(f"\n{'='*80}")
            print(f"🎯 STARTING TASK {task_index if task_index is not None else 'N/A'}")
            print(f"{'='*80}")
            print(f"\n📜 SYSTEM PROMPT (Wiki) - {len(self.wiki)} characters:")
            print("─"*40)
            # Show first 500 chars of wiki to see tone modifications
            if len(self.wiki) > 500:
                print(self.wiki[:500])
                print(f"... [{len(self.wiki) - 500} more characters]")
            else:
                print(self.wiki)
            print("─"*40)
        
        total_cost = 0.0
        env_reset_res = env.reset(task_index=task_index)
        obs = env_reset_res.observation
        info = env_reset_res.info.model_dump()
        reward = 0.0
        api_records: List[Dict[str, Any]] = []
        tool_call_count = 0
        tool_error_count = 0
        failure = None
        
        if self.verbose:
            print(f"\n📝 Initial User Message:")
            print(f"{'─'*40}")
            print(obs)
            print(f"{'─'*40}")
        
        # Initialize messages
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": self.wiki},
            {"role": "user", "content": obs},
        ]
        
        for step in range(max_num_steps):
            if self.verbose:
                print(f"\n{'━'*80}")
                print(f"📍 STEP {step + 1}/{max_num_steps}")
                print(f"{'━'*80}")
            
            # Debug: Print request details
            if self.verbose:  # Show full API request details when verbose
                print(f"\n{'='*60}")
                print(f"🚀 API CALL #{step + 1} to {self.provider} / {self.model}")
                print(f"{'='*60}")
                print(f"📤 SENDING {len(messages)} messages:")
                print("\n" + "─"*50)
                for i, msg in enumerate(messages):  # Show ALL messages
                    role = msg.get('role', 'unknown')
                    content = msg.get('content', '')
                    print(f"\n📨 Message [{i+1}] - Role: {role.upper()}")
                    print("─"*50)
                    if content:
                        print(content)
                    if 'tool_calls' in msg and msg['tool_calls']:
                        print(f"\n🔧 Tool Calls:")
                        for tc in msg['tool_calls']:
                            if isinstance(tc, dict):
                                print(f"  - Function: {tc.get('function', {}).get('name', 'unknown')}")
                                print(f"    Args: {tc.get('function', {}).get('arguments', 'none')}")
                    if 'tool_call_id' in msg:
                        print(f"\n🔧 Tool Response ID: {msg['tool_call_id']}")
                    print("─"*50)
                print("\n" + "="*60)
                print(f"🔧 Temperature: {self.temperature}")
                print(f"🛠️  Tools: {len(self.tools_info) if self.tools_info else 0} tools available")
                if self.tools_info:
                    print("\n📋 COMPLETE TOOL DEFINITIONS (JSON):")
                    print("─"*50)
                    import json
                    for i, tool in enumerate(self.tools_info, 1):
                        print(f"\n[Tool {i}] {tool.get('function', {}).get('name', 'unknown')}:")
                        print(json.dumps(tool, indent=2))
                    print("─"*50)
                print("="*60)
            
            # Get completion from model
            try:
                # Prepare completion kwargs
                # Kimi K3 can spend most of a 4K completion budget on hidden
                # reasoning in the longer Tau-Bench tasks and then return an
                # empty visible message with no tool call.  That is not a
                # usable Agent action and caused the otherwise complete 60-cell
                # campaign to fail at the simulator boundary.  Reserve the same
                # reasoning headroom used by the paired Kimi user simulator;
                # ordinary non-reasoning models retain the historical limit.
                completion_limit = completion_token_limit(self.model)
                completion_kwargs = {
                    "messages": messages,
                    "model": self.model,
                    "custom_llm_provider": self.provider,
                    "tools": self.tools_info,
                    "temperature": self.temperature,
                    "max_tokens": completion_limit,
                }
                requested_seed = (
                    self.seed + (task_index or 0) * 1000 + step
                    if self.seed is not None else None
                )
                if requested_seed is not None:
                    completion_kwargs["seed"] = requested_seed
                
                # Add reasoning_effort for gpt-5 to minimize thinking tokens
                if "gpt-5" in self.model:
                    completion_kwargs["extra_body"] = {"reasoning_effort": "low"}
                    if self.verbose:
                        print("💭 Using reasoning_effort='low' to minimize thinking tokens")
                
                requested_at = datetime.now(timezone.utc).isoformat()
                started = time.perf_counter()
                res = completion(**completion_kwargs)
                choice = res.choices[0]
                usage = getattr(res, "usage", None)
                usage_payload = (
                    usage.model_dump()
                    if usage is not None and hasattr(usage, "model_dump")
                    else None
                )
                hidden_cost = getattr(res, "_hidden_params", {}).get("response_cost")
                api_records.append({
                    "requested_at": requested_at,
                    "provider": self.provider,
                    "model": self.model,
                    "task_index": task_index,
                    "step": step + 1,
                    "requested_seed": requested_seed,
                    "request": {
                        "messages": copy.deepcopy(messages),
                        "tools": copy.deepcopy(self.tools_info),
                        "temperature": self.temperature,
                        "max_tokens": completion_limit,
                    },
                    "elapsed_ms": round((time.perf_counter() - started) * 1000, 3),
                    "response": {
                        "id": getattr(res, "id", None),
                        "model": getattr(res, "model", None),
                        "created": getattr(res, "created", None),
                        "finish_reason": getattr(choice, "finish_reason", None),
                        "content": choice.message.content,
                        "reasoning_content": getattr(choice.message, "reasoning_content", None),
                        "tool_calls": [
                            item.model_dump() if hasattr(item, "model_dump") else item
                            for item in (getattr(choice.message, "tool_calls", None) or [])
                        ],
                        "usage": usage_payload,
                        "litellm_estimated_cost": hidden_cost,
                    },
                })
                
                # Debug: Print response
                if self.verbose:  # Show full API response details when verbose
                    print(f"\n📥 RESPONSE received:")
                    print("─"*50)
                    if res.choices[0].message.content:
                        print("📝 Response Content:")
                        print("─"*50)
                        print(res.choices[0].message.content)  # Show FULL content
                        print("─"*50)
                    if hasattr(res.choices[0].message, 'tool_calls') and res.choices[0].message.tool_calls:
                        print(f"\n🔧 Too
```

### Core Architecture Module: `chapter2/prompt-engineering/ablation_utils.py`
```
"""
Ablation utilities for prompt engineering experiments
"""

import random
import re
from enum import Enum
from typing import List, Dict, Any, Optional
import copy


class ToneStyle(Enum):
    """Different tone styles for the agent"""
    DEFAULT = "default"
    TRUMP = "trump"
    CASUAL = "casual"


# Tone style instructions
TONE_INSTRUCTIONS = {
    ToneStyle.TRUMP: """
You must communicate in the distinctive style of Donald Trump. This means:
- Use superlatives frequently ("tremendous", "fantastic", "the best", "incredible", "nobody does it better")
- Speak with absolute confidence and make bold claims
- Use repetition for emphasis ("very, very important", "believe me")
- Reference your success and expertise often
- Use simple, direct language with short, punchy sentences
- Show enthusiasm with phrases like "It's going to be great!" or "You're going to love it!"
- Occasionally use "folks" when addressing users
- Be assertive and decisive in your statements
- Use "frankly" and "honestly" to emphasize points
- Make everything sound like a big deal

Example responses:
- Instead of "I'll help you book a flight", say "I'm going to get you the best flight deal ever, believe me. Nobody books flights better than me."
- Instead of "There's an error", say "This is a disaster, frankly. But don't worry, I'll fix it. I always fix things. It'll be tremendous."
""",
    
    ToneStyle.CASUAL: """
Speak with the user in a super casual, fun, and cool tone. Use a ton of emojis, as well as slang and idioms. Be like their fun friend who's helping them out! 

Guidelines:
- Use lots of emojis throughout your responses 🎉✨😊🚀
- Use casual language and slang (e.g., "totally", "awesome", "no worries", "gotcha", "my bad")
- Be enthusiastic and upbeat
- Use informal greetings like "Hey there!", "What's up?", "Yo!"
- Use phrases like "Let's do this!", "You got it!", "Boom!", "Sweet!"
- Keep things light and friendly
- Use idioms and expressions like "piece of cake", "no sweat", "you're all set"
- Add personality with expressions like "Oops!", "Yay!", "Woohoo!"

Example responses:
- Instead of "I'll help you book a flight", say "Hey! Let's get you that flight booked! 🛫✨ This is gonna be awesome!"
- Instead of "There's an error", say "Oops! 😅 Looks like we hit a little snag, but no worries! Let me fix that for you real quick! 💪"
""",
    
    ToneStyle.DEFAULT: ""  # No modification for default
}


def apply_tone_modification(text: str, tone_style: ToneStyle) -> str:
    """
    Apply tone modification to text (wiki or system prompt)
    
    Args:
        text: Original text
        tone_style: The tone style to apply
    
    Returns:
        Modified text with tone instructions prepended
    """
    if tone_style == ToneStyle.DEFAULT:
        return text
    
    tone_instruction = TONE_INSTRUCTIONS[tone_style]
    
    # Add tone instruction to the beginning of the text
    if text:
        return f"{tone_instruction}\n\n---ORIGINAL INSTRUCTIONS---\n\n{text}"
    else:
        return tone_instruction


def load_randomized_wiki(env: str) -> str:
    """
    Load pre-generated randomized wiki for the specified environment
    
    Args:
        env: Environment name ('airline' or 'retail')
    
    Returns:
        Pre-randomized wiki text
    """
    import os
    from pathlib import Path
    
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    
    if env == "airline":
        wiki_path = script_dir / "wiki_airline_randomized.md"
    elif env == "retail":
        wiki_path = script_dir / "wiki_retail_randomized.md"
    else:
        raise ValueError(f"Unknown environment: {env}")
    
    if not wiki_path.exists():
        raise FileNotFoundError(f"Randomized wiki not found: {wiki_path}")
    
    with open(wiki_path, 'r') as f:
        return f.read()


def remove_descriptions_recursive(obj: Any) -> Any:
    """
    Recursively remove all description fields from a nested object
    
    Args:
        obj: The object to process
    
    Returns:
        Object with all descriptions removed
    """
    if isinstance(obj, dict):
        result = {}
        for key, value in obj.items():
            if key == "description":
                # Remove description by setting to empty string
                result[key] = ""
            else:
                # Recursively process nested structures
                result[key] = remove_descriptions_recursive(value)
        return result
    elif isinstance(obj, list):
        # Process each item in the list
        return [remove_descriptions_recursive(item) for item in obj]
    else:
        # Return primitive values as-is
        return obj


def remove_tool_descriptions(tools_info: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove descriptions from tools and their parameters (including nested structures)
    
    Args:
        tools_info: Original tools information
    
    Returns:
        Tools information with all descriptions removed
    """
    modified_tools = []
    
    for tool in tools_info:
        # Deep copy to avoid modifying original
        modified_tool = copy.deepcopy(tool)
        
        # Recursively remove all descriptions
        modified_tool = remove_descriptions_recursive(modified_tool)
        
        modified_tools.append(modified_tool)
    
    return modified_tools

```

### Core Architecture Module: `chapter2/prompt-engineering/analyze_results.py`
```
#!/usr/bin/env python3
"""
Analyze and visualize ablation study results
"""

import argparse
import json
import glob
import re
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple
import sys


def _extract_experiment_name(filename: str) -> str:
    """
    Recover the ablation name from a result filename.

    Filenames follow the pattern produced by run_ablation.py:
        ``{strategy}-{model}-{ablation_str}_{timestamp}.json``
    e.g. ``tool-calling-gpt-5-tone_trump_0917203842`` -> ``tone_trump``.

    The model segment itself may contain ``-`` (e.g. ``gpt-5``), so we strip
    the trailing ``_<timestamp>`` first, then take everything after the last
    ``-`` as the ablation name.
    """
    # Strip a trailing timestamp such as ``_0917203842`` (>=6 digits).
    stripped = re.sub(r"_\d{6,}$", "", filename)
    # The ablation name is the final hyphen-separated segment.
    return stripped.rsplit("-", 1)[-1]


def load_results(results_dir: str = "results_ablation") -> Dict[str, List[float]]:
    """
    Load all results from the results directory

    Returns:
        Dictionary mapping experiment names to lists of rewards
    """
    results = {}

    for file_path in sorted(glob.glob(f"{results_dir}/*.json")):
        # Skip auxiliary/aggregate files that are not raw run outputs.
        if Path(file_path).name in ("visualization_data.json", "summary.json"):
            continue
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)

            # Extract experiment name from filename
            filename = Path(file_path).stem
            exp_name = _extract_experiment_name(filename)

            # Handle different data formats
            if isinstance(data, dict) and 'results' in data:
                # New format with ablation config
                rewards = [r['reward'] for r in data['results']]
                
                # Create descriptive name from config
                config = data.get('ablation_config', {})
                if config:
                    name_parts = []
                    if config.get('tone_style', 'default') != 'default':
                        name_parts.append(f"tone_{config['tone_style']}")
                    if config.get('randomize_wiki'):
                        name_parts.append('wiki_random')
                    if config.get('remove_tool_descriptions'):
                        name_parts.append('no_tools')
                    if config.get('apply_tone_to_system'):
                        name_parts.append('system')
                    
                    if name_parts:
                        exp_name = '_'.join(name_parts)
                    else:
                        exp_name = 'baseline'

                results.setdefault(exp_name, []).extend(rewards)

            elif isinstance(data, list):
                # Old format - list of results
                rewards = [r.get('reward', 0) for r in data]
                results.setdefault(exp_name, []).extend(rewards)
                
        except Exception as e:
            print(f"Warning: Could not load {file_path}: {e}")
    
    return results


def calculate_statistics(rewards: List[float]) -> Dict[str, float]:
    """
    Calculate statistics for a list of rewards
    """
    if not rewards:
        return {
            'success_rate': 0.0,
            'total': 0,
            'successes': 0,
            'failures': 0
        }
    
    successes = sum(rewards)
    total = len(rewards)
    
    return {
        'success_rate': (successes / total * 100) if total > 0 else 0,
        'total': total,
        'successes': int(successes),
        'failures': total - int(successes)
    }


def print_results_table(results: Dict[str, List[float]]):
    """
    Print a formatted table of results
    """
    if not results:
        print("No results found!")
        return
    
    # Calculate statistics for each experiment
    stats = {}
    for exp_name, rewards in results.items():
        stats[exp_name] = calculate_statistics(rewards)
    
    # Sort by success rate
    sorted_exps = sorted(stats.items(), key=lambda x: x[1]['success_rate'], reverse=True)
    
    # Find baseline for comparison
    baseline_rate = 0
    for exp_name, exp_stats in sorted_exps:
        if 'baseline' in exp_name.lower():
            baseline_rate = exp_stats['success_rate']
            break
    
    # If no explicit baseline, use the best performing as baseline
    if baseline_rate == 0 and sorted_exps:
        baseline_rate = sorted_exps[0][1]['success_rate']
    
    # Print header
    print("\n" + "="*80)
    print(" "*25 + "ABLATION STUDY RESULTS")
    print("="*80)
    print()
    print(f"{'Experiment':<30} {'Success Rate':>15} {'Tasks':>10} {'Relative':>15}")
    print("-"*70)
    
    # Print each experiment
    for exp_name, exp_stats in sorted_exps:
        success_rate = exp_stats['success_rate']
        relative = (success_rate / baseline_rate * 100) if baseline_rate > 0 else 100
        
        # Add indicator for baseline
        indicator = " ⭐" if 'baseline' in exp_name.lower() else ""
        
        print(f"{exp_name:<30} {success_rate:>6.1f}%{' ':>8} "
              f"{exp_stats['successes']}/{exp_stats['total']:>3} "
              f"{relative:>10.1f}% {indicator}")
    
    print("-"*70)


def analyze_ablation_impact(results: Dict[str, List[float]]):
    """
    Analyze the impact of each ablation factor
    """
    stats = {name: calculate_statistics(rewards) for name, rewards in results.items()}
    
    # Find baseline
    baseline_rate = 0
    for name, stat in stats.items():
        if 'baseline' in name.lower():
            baseline_rate = stat['success_rate']
            break
    
    if baseline_rate == 0:
        print("\n⚠️  No baseline found for comparison")
        return
    
    print("\n" + "="*80)
    print(" "*25 + "ABLATION FACTOR ANALYSIS")
    print("="*80)
    
    # Analyze individual factors
    factors = {
        'Tone (Trump)': ['tone_trump'],
        'Tone (Casual)': ['tone_casual'],
        'Wiki Randomization': ['wiki_random'],
        'No Tool Descriptions': ['no_tools', 'no_tool_desc'],
        'All Factors Combined': ['all_ablations', 'worst']
    }
    
    print(f"\n{'Factor':<25} {'Impact on Performance':>30} {'Severity':>15}")
    print("-"*70)
    
    impacts = []
    for factor_name, patterns in factors.items():
        # Find matching experiments
        for exp_name, exp_stats in stats.items():
            if any(pattern in exp_name.lower() for pattern in patterns):
                impact = baseline_rate - exp_stats['success_rate']
                relative_impact = (impact / baseline_rate * 100) if baseline_rate > 0 else 0
                
                # Determine severity
                if relative_impact >= 50:
                    severity = "🔴 Critical"
                elif relative_impact >= 30:
                    severity = "🟠 High"
                elif relative_impact >= 15:
                    severity = "🟡 Medium"
                else:
                    severity = "🟢 Low"
                
                impacts.append((factor_name, impact, relative_impact, severity))
                # `impact` is baseline - experiment: positive = degradation (show as
                # e.g. "-25.0%"), negative = the ablation outperformed baseline (small
                # samples can do this) and should read as "+25.0%", not "--25.0%".
                print(f"{factor_name:<25} {f'{-impact:+.1f}%':>20} ({relative_impact:.1f}%) {severity:>15}")
                break
    
    print("-"*70)
    
    # Key insights
    print("\n📊 KEY INSIGHTS:")
    print("-"*40)
    
    if impacts:
        # Sort by impact
        impacts.sort(key=lambda x: x[1], reverse=True)
        
        print(f"1. Most Critical Factor: {impacts[0][0]} (-{impacts[0][1]:.1f}% performance)")
        print(f"2. Least Critical Factor: {impacts[-1][0]} (-{impacts[-1][1]:.1f}% performance)")
        
        # Calculate cumulative effect
        combined = [i for i in impacts if 'All Factors' in i[0]]
        if combined:
            individual_sum = sum(i[1] for i in impacts if 'All Factors' not in i[0])
            actual_combined = combined[0][1]
            
            if individual_sum > 0:
                print(f"\n3. Interaction Effect:")
                print(f"   - Sum of individual impacts: -{individual_sum:.1f}%")
                print(f"   - Actual combined impact: -{actual_combined:.1f}%")
                
                if actual_combined > individual_sum:
                    print(f"   - Synergistic negative effect: Additional -{actual_combined - individual_sum:.1f}%")
                else:
                    print(f"   - Some resilience to combined factors")


def generate_summary_report(results: Dict[str, List[float]]):
    """
    Generate a comprehensive summary report
    """
    print("\n" + "="*80)
    print(" "*20 + "EXECUTIVE SUMMARY")
    print("="*80)
    
    stats = {name: calculate_statistics(rewards) for name, rewards in results.items()}
    
    # Overall statistics
    total_experiments = len(results)
    total_tasks = sum(len(rewards) for rewards in results.values())
    avg_success = sum(s['success_rate'] for s in stats.values()) / len(stats) if stats else 0
    
    print(f"\n📈 Overall Statistics:")
    print(f"   • Total Experiments Run: {total_experiments}")
    print(f"   • Total Tasks Evaluated: {total_tasks}")
    print(f"   • Average Success Rate: {avg_success:.1f}%")
    
    # Best and worst performers
    sorted_stats = sorted(stats.items(), key=lambda x: x[1]['success_rate'], reverse=True)
    if sorted_stats:
        best = sorted_stats[0]
        worst = sorted_stats[-1]
        
        print(f"\n🏆 Best Performer: {best[0]} ({best[1]['success_rate']:.1f}%)")
        print(f"❌ Worst Performer: {worst[0]} ({worst[1]['success_rate']:.1f}%)")
        print(f"📉 Perf
```

### Core Architecture Module: `chapter2/prompt-engineering/run.py`
```
# Copyright Sierra

import argparse

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from tau_bench.types import RunConfig
from tau_bench.run import run
from litellm import provider_list
from tau_bench.envs.user import UserStrategy


def parse_args() -> RunConfig:
    parser = argparse.ArgumentParser()
    parser.add_argument("--num-trials", type=int, default=1)
    parser.add_argument(
        "--env", type=str, choices=["retail", "airline"], default="retail"
    )
    parser.add_argument(
        "--model",
        type=str,
        help="The model to use for the agent",
    )
    parser.add_argument(
        "--model-provider",
        type=str,
        choices=provider_list,
        help="The model provider for the agent",
    )
    parser.add_argument(
        "--user-model",
        type=str,
        default="gpt-4o",
        help="The model to use for the user simulator",
    )
    parser.add_argument(
        "--user-model-provider",
        type=str,
        choices=provider_list,
        help="The model provider for the user simulator",
    )
    parser.add_argument(
        "--agent-strategy",
        type=str,
        default="tool-calling",
        choices=["tool-calling", "act", "react", "few-shot"],
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="The sampling temperature for the action model",
    )
    parser.add_argument(
        "--task-split",
        type=str,
        default="test",
        choices=["train", "test", "dev"],
        help="The split of tasks to run (only applies to the retail domain for now",
    )
    parser.add_argument("--start-index", type=int, default=0)
    parser.add_argument("--end-index", type=int, default=-1, help="Run all tasks if -1")
    parser.add_argument("--task-ids", type=int, nargs="+", help="(Optional) run only the tasks with the given IDs")
    parser.add_argument("--log-dir", type=str, default="results")
    parser.add_argument(
        "--max-concurrency",
        type=int,
        default=1,
        help="Number of tasks to run in parallel",
    )
    parser.add_argument("--seed", type=int, default=10)
    parser.add_argument("--shuffle", type=int, default=0)
    parser.add_argument("--user-strategy", type=str, default="llm", choices=[item.value for item in UserStrategy])
    parser.add_argument("--few-shot-displays-path", type=str, help="Path to a jsonlines file containing few shot displays")
    args = parser.parse_args()
    print(args)
    return RunConfig(
        model_provider=args.model_provider,
        user_model_provider=args.user_model_provider,
        model=args.model,
        user_model=args.user_model,
        num_trials=args.num_trials,
        env=args.env,
        agent_strategy=args.agent_strategy,
        temperature=args.temperature,
        task_split=args.task_split,
        start_index=args.start_index,
        end_index=args.end_index,
        task_ids=args.task_ids,
        log_dir=args.log_dir,
        max_concurrency=args.max_concurrency,
        seed=args.seed,
        shuffle=args.shuffle,
        user_strategy=args.user_strategy,
        few_shot_displays_path=args.few_shot_displays_path,
    )


def main():
    config = parse_args()
    run(config)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `chapter2/prompt-engineering/run_ablation.py`
```
#!/usr/bin/env python3
"""
Ablation Study Runner for Tau-Bench Framework
Demonstrates the importance of prompt engineering by testing different variations:
1. Tone variations (Trump style, Casual style, Default style)
2. Wiki rule randomization
3. Tool description removal
"""

import argparse
import copy
import hashlib
import random
import os
import json
import shutil
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from tau_bench.types import RunConfig
# from litellm import provider_list  # This returns enums, not strings
# Define provider choices as strings
provider_list = ["openai", "anthropic", "azure", "bedrock", "cohere", "gemini", "groq", "mistral", "ollama", "openrouter", "replicate", "together_ai", "vertex_ai", "huggingface"]
from tau_bench.envs.user import UserStrategy

# Import custom modules for ablation
from ablation_utils import (
    apply_tone_modification,
    load_randomized_wiki, 
    remove_tool_descriptions,
    ToneStyle
)


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "提示工程消融实验（实验 2-4）：基于 Tau-Bench 逐个降解提示工程要素，"
            "量化其对任务成功率的影响。\n"
            "三个消融维度：语气风格（--tone-style）、信息组织（--randomize-wiki）、"
            "工具描述（--remove-tool-descriptions）。"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "示例：\n"
            "  # 基线（结构化提示词 + 完整工具描述 + 专业中立语气），跑前 10 个任务\n"
            "  python run_ablation.py --model gpt-5.6-luna --env airline --end-index 10\n\n"
            "  # 单个消融：打乱 wiki 规则的组织结构\n"
            "  python run_ablation.py --env airline --randomize-wiki --end-index 10\n\n"
            "  # 一键跑完整套消融并打印对比表（基线 + 各维度 + 全部叠加）\n"
            "  python run_ablation.py --env airline --all --end-index 10\n\n"
            "  # 跑完后单独汇总分析：python analyze_results.py\n"
        ),
    )

    # Original arguments
    parser.add_argument(
        "--num-trials", type=int, default=1,
        help="每个任务重复运行的次数（默认：1）"
    )
    parser.add_argument(
        "--env", type=str, choices=["retail", "airline"], default="airline",
        help="运行的场景环境：airline（航空客服）或 retail（零售客服），默认 airline"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gpt-5.6-luna",
        help="The model to use for the agent (default: gpt-5.6-luna; routed via OpenRouter when OPENROUTER_API_KEY is set, else OpenAI direct)",
    )
    parser.add_argument(
        "--model-provider",
        type=str,
        choices=provider_list,
        default=None,  # Will be set based on model
        help="The model provider for the agent (default: openai; a model id containing '/' auto-selects openrouter)",
    )
    parser.add_argument(
        "--user-model",
        type=str,
        default="gpt-5.6-luna",
        help="The model to use for the user simulator (default: gpt-5.6-luna; routed via OpenRouter when OPENROUTER_API_KEY is set, else OpenAI direct)",
    )
    parser.add_argument(
        "--user-model-provider",
        type=str,
        choices=provider_list,
        default=None,  # Will be set based on model
        help="The model provider for the user simulator (default: openai; a model id containing '/' auto-selects openrouter)",
    )
    parser.add_argument(
        "--agent-strategy",
        type=str,
        default="tool-calling",
        choices=["tool-calling", "act", "react", "few-shot"],
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=1.0,
        help="The sampling temperature for the action model (default: 1.0 for gpt-5 compatibility)",
    )
    parser.add_argument(
        "--task-split",
        type=str,
        default="test",
        choices=["train", "test", "dev"],
    )
    parser.add_argument("--start-index", type=int, default=0)
    parser.add_argument("--end-index", type=int, default=-1)
    parser.add_argument("--task-ids", type=int, nargs="+")
    parser.add_argument("--log-dir", type=str, default="results_ablation")
    parser.add_argument("--max-concurrency", type=int, default=1)
    parser.add_argument("--seed", type=int, default=10)
    parser.add_argument("--shuffle", type=int, default=0)
    parser.add_argument(
        "--max-agent-steps",
        type=int,
        default=30,
        help="每个任务允许的最大 Agent 步数（默认：30）",
    )
    parser.add_argument(
        "--protocol",
        type=str,
        default=str(Path(__file__).resolve().parent / "experiment_protocol.json"),
        help="冻结实验协议；--all 会复制并哈希到结果目录",
    )
    parser.add_argument(
        "--user-strategy", 
        type=str, 
        default="llm", 
        choices=[item.value for item in UserStrategy]
    )
    parser.add_argument("--few-shot-displays-path", type=str)
    
    # New ablation study arguments
    parser.add_argument(
        "--tone-style",
        type=str,
        choices=["default", "trump", "casual"],
        default="default",
        help="维度一·语气风格：default（专业中立，基线）、trump（Trump 夸张风格）、casual（大量表情符号的休闲风格）"
    )

    parser.add_argument(
        "--randomize-wiki",
        action="store_true",
        help="维度二·信息组织：打乱 wiki 规则的组织结构（去除标题层次，规则平铺为无序列表）"
    )

    parser.add_argument(
        "--remove-tool-descriptions",
        action="store_true",
        help="维度三·工具描述：保留函数签名与参数，但移除所有描述性文本"
    )

    parser.add_argument(
        "--ablation-name",
        type=str,
        default="",
        help="本次消融实验的自定义名称（用于结果文件名标识）"
    )

    parser.add_argument(
        "--all",
        dest="run_all",
        action="store_true",
        help="一键运行完整消融套件（基线 + 各单维度 + 全部叠加），结束后打印成功率对比表"
    )

    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="（仅 --all 模式）将套件汇总统计写入该 JSON 文件路径（默认写入 log-dir/ablation_summary_<时间戳>.json）"
    )

    parser.add_argument(
        "--resume-from",
        type=str,
        default=None,
        help=(
            "Import only hash-valid, completed task receipts from a previous --all run directory. "
            "Accepted tasks are never regenerated; missing/error tasks run in the new log directory."
        ),
    )

    parser.add_argument(
        "--no-verbose",
        action="store_true",
        help="关闭详细输出（默认开启 verbose）"
    )

    args = parser.parse_args()
    
    # Set verbose flag (defaults to True unless --no-verbose is used)
    args.verbose = not args.no_verbose
    
    # Set default provider based on model if not specified.
    # A model id containing "/" (e.g. "openai/gpt-5") is an OpenRouter-style id and
    # routes through openrouter (requires a valid OPENROUTER_API_KEY); a bare id
    # (e.g. "gpt-4o-mini") routes through OpenAI direct (requires OPENAI_API_KEY).
    if args.model_provider is None:
        args.model_provider = "openrouter" if "/" in args.model else "openai"

    # Set default user model provider based on user model if not specified
    if args.user_model_provider is None:
        args.user_model_provider = "openrouter" if "/" in args.user_model else "openai"

    # Universal fallback: if the resolved provider is OpenAI-direct but
    # OPENAI_API_KEY is missing while OPENROUTER_API_KEY is present, route the
    # bare gpt-* / o1-* id through OpenRouter (prefix "openai/"). Preserves the
    # default (OpenAI-direct) behavior whenever OPENAI_API_KEY is set.
    # gpt-5.x (incl. gpt-5.6*) needs OpenAI org-verification on the direct API, so
    # when an OPENROUTER_API_KEY is present we route these ids (and any bare
    # gpt-*/o1-* when OPENAI_API_KEY is missing) through OpenRouter (prefix
    # "openai/"). Direct-OpenAI behavior is preserved otherwise.
    if os.environ.get("OPENROUTER_API_KEY"):
        no_openai = not os.environ.get("OPENAI_API_KEY")
        if args.model_provider == "openai" and (no_openai or args.model.lower().startswith("gpt-5")):
            args.model_provider = "openrouter"
            if "/" not in args.model:
                args.model = "openai/" + args.model
        if args.user_model_provider == "openai" and (no_openai or args.user_model.lower().startswith("gpt-5")):
            args.user_model_provider = "openrouter"
            if "/" not in args.user_model:
                args.user_model = "openai/" + args.user_model

    return args


def run_with_ablation(args):
    """Run tau-bench with ablation modifications"""
    
    # Import the original run module
    from tau_bench.run import run, agent_factory, display_metrics
    from tau_bench.envs import get_env
    import multiprocessing
    from concurrent.futures import ThreadPoolExecutor
    from typing import List
    from tau_bench.types import EnvRunResult
    
    # Create configuration
    config = RunConfig(
        model_provider=args.model_provider,
        user_model_provider=args.user_model_provider,
        model=args.model,
        user_model=args.user_model,
        num_trials=args.num_trials,
        env=args.env,
        agent_strategy=args.agent_strategy,
        temperature=args.temperature,
        task_split=args.task_split,
        start_index=args.start_index,
        end_index=args.end_index,
        task_ids=args.task_ids,
        log_dir=args.log_dir,
        max_concurrency=args.max_concurrency,
        seed=args.seed,
        shuffle=args.shuffle,
        user_strategy=args.user_strategy,
        few_shot_displays_path=args.few_shot_displays_path,
    )
    
    random.seed(config.seed)
    
    # Create descriptive log filename
    ablation_suffix = []
    if args.tone_style != "default":
        ablation_suffix.append(f"tone_{args.tone_style}")
    if args.randomize_wiki:
        ablation_suffix.append("wiki_random")
    if args.remove_tool_descriptions:
        ablation_suffix.append("no_tool_desc")
    if args.ablation_name:
        ablation_suffix.append(args.ablation_name)
    
    ablation_str = "_".join(ablation_suffix) if ablation_suffix else "baseline"
    
    time_str = datetime.now().strftime("%m%d%H%M%S")
    ckpt_pat
```

### Core Architecture Module: `chapter2/prompt-engineering/setup.py`
```
# Copyright Sierra

from setuptools import find_packages, setup

setup(
    name="tau_bench",
    version="0.1.0",
    description="The Tau-Bench package",
    long_description=open("README.md").read(),
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "openai>=1.13.3",
        "mistralai>=0.4.0",
        "anthropic>=0.26.1",
        "google-generativeai>=0.5.4",
        "tenacity>=8.3.0",
        "termcolor>=2.4.0",
        "numpy>=1.26.4",
        "litellm>=1.41.0",
    ],
)

```

### Core Architecture Module: `chapter2/prompt-engineering/tau_bench/__init__.py`
```
# Copyright Sierra

from tau_bench.envs.base import Env as Env
from tau_bench.agents.base import Agent as Agent

```

### Core Architecture Module: `chapter2/prompt-engineering/tau_bench/agents/__init__.py`
```
# Copyright Sierra

```

### Core Architecture Module: `chapter2/prompt-engineering/tau_bench/agents/base.py`
```
# Copyright Sierra

import abc
from typing import Optional
from tau_bench.envs.base import Env
from tau_bench.types import SolveResult


class Agent(abc.ABC):
    @abc.abstractmethod
    def solve(
        self, env: Env, task_index: Optional[int] = None, max_num_steps: int = 30
    ) -> SolveResult:
        raise NotImplementedError

```

### Core Architecture Module: `chapter2/prompt-engineering/tau_bench/agents/chat_react_agent.py`
```
# Copyright Sierra

import json
from litellm import completion

from tau_bench.agents.base import Agent
from tau_bench.envs.base import Env
from tau_bench.types import (
    Action,
    SolveResult,
    RESPOND_ACTION_NAME,
    RESPOND_ACTION_FIELD_NAME,
)
from typing import Optional, List, Dict, Any, Tuple


class ChatReActAgent(Agent):
    def __init__(
        self,
        tools_info: List[Dict[str, Any]],
        wiki: str,
        model: str,
        provider: str,
        use_reasoning: bool = True,
        temperature: float = 0.0,
    ) -> None:
        instruction = REACT_INSTRUCTION if use_reasoning else ACT_INSTRUCTION
        self.prompt = (
            wiki + "\n#Available tools\n" + json.dumps(tools_info) + instruction
        )
        self.model = model
        self.provider = provider
        self.temperature = temperature
        self.use_reasoning = use_reasoning
        self.tools_info = tools_info

    def generate_next_step(
        self, messages: List[Dict[str, Any]]
    ) -> Tuple[Dict[str, Any], Action, float]:
        res = completion(
            model=self.model,
            custom_llm_provider=self.provider,
            messages=messages,
            temperature=self.temperature,
        )
        message = res.choices[0].message
        action_str = message.content.split("Action:")[-1].strip()
        try:
            action_parsed = json.loads(action_str)
        except json.JSONDecodeError:
            # this is a hack
            action_parsed = {
                "name": RESPOND_ACTION_NAME,
                "arguments": {RESPOND_ACTION_FIELD_NAME: action_str},
            }
        assert "name" in action_parsed
        assert "arguments" in action_parsed
        action = Action(name=action_parsed["name"], kwargs=action_parsed["arguments"])
        return message.model_dump(), action, res._hidden_params["response_cost"]

    def solve(
        self, env: Env, task_index: Optional[int] = None, max_num_steps: int = 30
    ) -> SolveResult:
        response = env.reset(task_index=task_index)
        reward = 0.0
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": self.prompt},
            {"role": "user", "content": response.observation},
        ]
        total_cost = 0.0
        info = {}
        for _ in range(max_num_steps):
            message, action, cost = self.generate_next_step(messages)
            response = env.step(action)
            obs = response.observation
            reward = response.reward
            info = {**info, **response.info.model_dump()}
            if action.name != RESPOND_ACTION_NAME:
                obs = "API output: " + obs
            messages.extend(
                [
                    message,
                    {"role": "user", "content": obs},
                ]
            )
            total_cost += cost
            if response.done:
                break
        return SolveResult(
            messages=messages,
            reward=reward,
            info=info,
        )


REACT_INSTRUCTION = f"""
# Instruction
You need to act as an agent that use the above tools to help the user according to the above policy.

At each step, your generation should have exactly the following format:
Thought:
<A single line of reasoning to process the context and inform the decision making. Do not include extra lines.>
Action:
{{"name": <The name of the action>, "arguments": <The arguments to the action in json format>}}

The Action will be parsed, so it must be valid JSON.

You should not use made-up or placeholder arguments.

For example, if the user says "I want to know the current weather of San Francisco", and there is such a tool available
{{
    "type": "function",
    "function": {{
        "name": "get_current_weather",
        "description": "Get the current weather",
        "parameters": {{
            "type": "object",
            "properties": {{
                "location": {{
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA",
                }},
                "format": {{
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "The temperature unit to use. Infer this from the users location.",
                }},
            }},
            "required": ["location", "format"],
        }},
    }}
}}

Your response can be like this:
Thought:
Since the user asks for the weather of San Francisco in USA, the unit should be in fahrenheit. I can query get_current_weather to get the weather.
Action:
{{"name": "get_current_weather", "arguments": {{"location": "San Francisco, CA", "format": "fahrenheit"}}}}

And if the tool returns "70F", your response can be:
Thought:
I can answer the user now.
Action:
{{"name": {RESPOND_ACTION_NAME}, "arguments": {{"{RESPOND_ACTION_FIELD_NAME}": "The current weather of San Francisco is 70F."}}}}

Try to be helpful and always follow the policy.
"""


ACT_INSTRUCTION = f"""
# Instruction
You need to act as an agent that use the above tools to help the user according to the above policy.

At each step, your generation should have exactly the following format:

Action:
{{"name": <The name of the action>, "arguments": <The arguments to the action in json format>}}

You should not use made-up or placeholder arguments.

The Action will be parsed, so it must be valid JSON.

For example, if the user says "I want to know the current weather of San Francisco", and there is such a tool available
```json
{{
    "type": "function",
    "function": {{
        "name": "get_current_weather",
        "description": "Get the current weather",
        "parameters": {{
            "type": "object",
            "properties": {{
                "location": {{
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA",
                }},
                "format": {{
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "The temperature unit to use. Infer this from the users location.",
                }},
            }},
            "required": ["location", "format"],
        }},
    }}
}}
```

Your response can be like this:
Action:
{{"name": "get_current_weather", "arguments": {{"location": "San Francisco, CA", "format": "fahrenheit"}}}}

And if the tool returns "70F", your response can be:
Action:
{{"name": {RESPOND_ACTION_NAME}, "arguments": {{"{RESPOND_ACTION_FIELD_NAME}": "The current weather of San Francisco is 70F."}}}}

Try to be helpful and always follow the policy. Always make sure you generate valid JSON only.
"""

```

### Core Architecture Module: `chapter2/prompt-engineering/tau_bench/agents/few_shot_agent.py`
```
# Copyright Sierra

import json
import random
from litellm import completion
from typing import List, Optional, Dict, Any

from tau_bench.agents.base import Agent
from tau_bench.envs.base import Env
from tau_bench.types import SolveResult, Action, RESPOND_ACTION_NAME


class FewShotToolCallingAgent(Agent):
    def __init__(
        self,
        tools_info: List[Dict[str, Any]],
        wiki: str,
        model: str,
        provider: str,
        few_shot_displays: List[str],
        temperature: float = 0.0,
        num_few_shots: int = 5,
    ):
        self.tools_info = tools_info
        self.wiki = wiki
        self.model = model
        self.provider = provider
        if len(few_shot_displays) == 0:
            raise ValueError("Few shot displays are empty")
        elif len(few_shot_displays) < num_few_shots:
            raise ValueError(f"Few shot displays are less than num_few_shots requested: {len(few_shot_displays)} < {num_few_shots}")
        self.few_shot_displays = few_shot_displays
        self.temperature = temperature
        self.num_few_shots = num_few_shots
    def solve(
        self, env: Env, task_index: Optional[int] = None, max_num_steps: int = 30
    ) -> SolveResult:
        sampled_few_shot_displays = random.sample(self.few_shot_displays, self.num_few_shots)
        few_shots = "\n\n".join([f"Example {i+1}:\n{display}" for i, display in enumerate(sampled_few_shot_displays)])
        total_cost = 0.0
        env_reset_res = env.reset(task_index=task_index)
        obs = env_reset_res.observation
        info = env_reset_res.info.model_dump()
        reward = 0.0
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": f"{self.wiki}\n\n{few_shots}"},
            {"role": "user", "content": obs},
        ]
        for _ in range(max_num_steps):
            res = completion(
                messages=messages,
                model=self.model,
                custom_llm_provider=self.provider,
                tools=self.tools_info,
                temperature=self.temperature,
            )
            next_message = res.choices[0].message.model_dump()
            total_cost += res._hidden_params["response_cost"]
            action = message_to_action(next_message)
            env_response = env.step(action)
            reward = env_response.reward
            info = {**info, **env_response.info.model_dump()}
            if action.name != RESPOND_ACTION_NAME:
                next_message["tool_calls"] = next_message["tool_calls"][:1]
                messages.extend(
                    [
                        next_message,
                        {
                            "role": "tool",
                            "tool_call_id": next_message["tool_calls"][0]["id"],
                            "name": next_message["tool_calls"][0]["function"]["name"],
                            "content": env_response.observation,
                        },
                    ]
                )
            else:
                messages.extend(
                    [
                        next_message,
                        {"role": "user", "content": env_response.observation},
                    ]
                )
            if env_response.done:
                break
        return SolveResult(
            reward=reward,
            info=info,
            messages=messages,
            total_cost=total_cost,
        )


def message_to_action(
    message: Dict[str, Any],
) -> Action:
    if "tool_calls" in message and message["tool_calls"] is not None and len(message["tool_calls"]) > 0 and message["tool_calls"][0]["function"] is not None:
        tool_call = message["tool_calls"][0]
        return Action(
            name=tool_call["function"]["name"],
            kwargs=json.loads(tool_call["function"]["arguments"]),
        )
    else:
        return Action(name=RESPOND_ACTION_NAME, kwargs={"content": message["content"]})

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1152** (2026-09-23): **docs(i18n): sync #1151 ch2 preserved-thinking additions to all translations**
  *Symptoms*: 将 #1151 的三处第二章改动同步到全部 14 个译本（ar, en, es, he, hu, id, ja, ko, ptbr, ru, ta, tr, vi, zhtw）：  1. 思维链保留段落中关于 Claude 的句子：改为“签名把 thinking block 绑定到产生它时的前缀”。 2. “缓存作为架构约束”一节：新增两段 + 脚注 `[^ch2-preserved-thinking]`，并在核心启示段末补一句。 3. “压缩与 KV Cache”一节：第 3 条之后新增压缩与 thinking 绑定的说明。  检查：每个文件 `ch2-preserved-thinking` 恰好出现 2 次（引用 + 定义）；旧句子已删除；除 ja / zhtw 外新增行不含 CJK 字符；交叉引用使用各译本自己的小节标题和引号风格；未新增标题或图片。  建议在 #1151 合并后再合并本 PR。  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #1151** (2026-09-23): **docs(ch2): 补充 Claude preserved thinking——前缀改动会让历史 thinking 失效**
  *Symptoms*: 依据 Anthropic 官方文档 [Preserved thinking](https://platform.claude.com/docs/en/build-with-claude/preserved-thinking)，在第二章补充“前缀绑定 thinking”这一约束。书中原先只从 KV Cache / Prompt Cache 的成本角度讲“前缀不能动”；Claude Fable 5.1 / Opus 5.5 出于防蒸馏，用签名把 thinking block 绑定到产生它时的前缀，前缀一改，历史 thinking 就失效（新账户默认 400）。两条规则来源不同，得出的都是“只追加、不改写”的纪律。  改动（仅 `book/chapter2.md`）： 1. 思维链保留段落：更正 Claude 历史 thinking 的旧说法，改为签名绑定前缀的描述。 2. “缓存作为架构约束”：新增两段 + 脚注，说明机制、常见踩坑写法、追加式替代方案、thinking 裁剪规则和换模型时的静默丢弃。 3. “压缩与 KV Cache”：补充“摘要旧轮次 + 保留尾部”会让保留轮次的 thinking 失效，以及官方推荐的两种压缩方式。  正文只讲原理，不写 beta header 和参数名。未新增标题或图片。14 个译本的同步另开 PR。  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #1150** (2026-09-24): **文章内容描述歧义，第一章AI Agent 部分 Harness 工程：模型之外的竞争力部分**
  *Symptoms*: 表格数据 Context（上下文） | 为模型提供感知信息；信息要充分，让 Agent 在每个决策点都基于足够的信息判断 | 系统提示词、知识库、Agent 状态栏、Sidecar 旁路查询 | 第二、三章  Sidecar是什么意思，应该为Sidebar吧，Codex Sidebar? 这个名词没有见过 

- **Issue #1149** (2026-09-23): **feat(site): number chapters in the reader rail**
  *Symptoms*: 给 Web 站点的侧边栏目录增加章节序号，提升阅读体验；  **现状**：我在阅读正文的时候，正文中经常提及某一章节，但是不能依赖左边的目录快速定位章节，我还要从头数一下；  <img width="1508" height="805" alt="old" src="https://github.com/user-attachments/assets/a31186ba-6754-4f78-9f3f-7b505c4a21a8" />   **修改**：增加章节序号，对齐正文说的章节是哪一章；  <img width="1477" height="793" alt="new" src="https://github.com/user-attachments/assets/a680cd86-22c7-4704-9419-1221ce803594" />   移动端：  <img width="256" height="461" alt="mobile" src="https://github.com/user-attachments/assets/d7b31fc9-cd64-4a5e-8915-694a7727959d" />   
  **Post-Mortem & Fix Analysis**:
  > Nice work! Thanks for your contributions @Dada-liu 

- **Issue #1146** (2026-09-23): **ci: install httpx and MkDocs for offline test jobs**
  *Symptoms*: The web-search workflow fails during test collection: its chapter environment imports `httpx` directly without declaring it, and its root job runs MkDocs source-link tests without installing MkDocs.  Declare `httpx>=0.27,<1` in the chapter's existing dependency file and install `mkdocs>=1.6,<2` alongside the development package in the root CI job. Both jobs keep their complete test suites. Runtime package requirements and the lockfile are unchanged.  Validation in a fresh Python 3.12 environment:  - Chapter formatting check passes; all 44 offline web-search tests pass. - Root suite: 736 passed, 15 skipped for optional dependencies. On macOS, this run uses `TMPDIR=/private/tmp` so the temporary directory is a canonical path, matching the Linux runner; the default `/var` alias exposes an existing direct-helper path-normalization issue in `test_core_clean_site_links.py`.  This separately fixes the missing-dependency failures seen on #1143 and #1145; it contains no README rewrite.  GitHub verification: both `test` and `agentbook` jobs now pass, as does the security check. 

- **Issue #1145** (2026-09-22): **docs: 保留完整内容，重写中文实验 README 的教学流程**
  *Symptoms*: 原有实验 README 经常先展示英文长文、实现清单或运行结论，首次阅读时难以沿着“问题—方法—准备—操作—结果”理解完整实验。这次在完整 README 内重新组织教学顺序，补充概念、操作衔接和结果解释，保留详细步骤与历史材料。  这是撤销 #1143（#1144）后的重新实现。它不采用短介绍替换全文，也不创建 `REFERENCE` 替代文档。  - 覆盖 111 个实验入口、4 份附属说明和 10 个章节导航，共 125 份现有 README；没有修改实验运行代码或独立语言译本。 - 把完整中文流程放在英文版本之前，把原有章节按概念、准备、运行、结果、实现与排错组织；对较长中文段落分段，补足每一步为什么要做、应该观察什么。 - 为原先英文为主或中文说明过短的项目补充中文教学内容，包括工具生成、桌面交互、记忆系统评估、失败归因、语音训练和多 Agent 协作。原始英文正文完整保留在同一 README 内。 - 保留已有配置、代码、表格、任务案例、失败记录与结果；解释历史分数和单次曲线的适用条件。例如，混合检索的小样本满分不再被写成一般结论；明确 BM25 离线路径需要同时关闭 dense 与 rerank。 - 修正 13 处安装/运行片段中的旧章节目录及相应环境组；澄清评估脚本的 `--load_in_4bit` 不能接受 `False`。保留已有章节链接使用的三个锚点。  ### 如何核对内容保留  差异中的大段删除/新增主要来自完整中英文区块和原有章节的移动，不代表把内容缩成摘要。125 份文档净增加约 5,700 行，每一份都比原文更长。  逐文件与 #1144 合并后的版本比较：原有 1,713 个代码块、344 张表格、1,014 处 Markdown 链接和 8 处图片引用全部保留。代码块只对上述明确的旧目录修正做规范化比较；其余代码内容保留。已有英文正文按原始完整区块检查保留，没有抽取为短摘要。  ### 验证  - 内容保留审计通过；新增文件链接与新增页内锚点检查通过。 - 多语言结构审计通过；章节编号、文档状态链接、网站资源处理测试 11 项通过。 - 实际运行混合检索 BM25 离线入口、DPO 数据示例和轨迹验证器，均通过；未运行付费 API、GPU 训练或设备实验。 - MkDocs 完整构建和英文跳转修正后的增量构建通过；抽查上下文、混合检索、工具训练和社会模拟页面，完整代码/表格与教学导航均正常渲染。 - 原文移动带入了原有行尾空格；没有为清理格式而改动保留代码。新增空行/冲突标记检查通过。  两处原本就不存在的本地结果文件链接仍保留：章节 5 中的旧 agent-creator comparison.json，以及 user-memory-system-evaluation 的 full_7_3_structured_rubric_evidence.json。本次没有伪造或删除这些历史记录的引用。现有 CI 的 mkdocs/httpx 依赖问题由独立的 #1146 修复，不混入这次文档重写。  GitHub 当前验证：多语言检查和 9 个实验测试任务通过。现有 web-search 工作流的两项任务仍因未安装 mkdocs/httpx 在收集测试时失败，修复见 #1146。  #1146 的 GitHub `test` 与 `agentbook` 两项任务已验证通过。文档 PR 的旧基线仍保留原失败；先合并依赖修复并更新本分支即可使用修复后的 CI 环境。 

- **Issue #1144** (2026-09-22): **Revert truncated experiment READMEs and restore full content**
  *Symptoms*: Revert #1143 because it replaced the full experiment READMEs with short introductions and moved their substance into reference files. The requested improvement was to make the complete material easier for first-time learners to follow, while retaining explanations, procedures, examples, configuration details, and results in the READMEs.  This restores every file to its state immediately before #1143, including the full experiment and chapter READMEs, and removes the reference copies and guide introduced by that PR. Earlier changes, including the homepage index automation and #1142, remain in place.  Validation: `git diff --exit-code abb83693^ HEAD` confirms an exact restoration of the pre-#1143 tree. The multilingual consistency audit and 11 chapter/documentation/site-asset tests pass.  The separately requested CI dependency fixes are being kept in a separate change. 

- **Issue #1143** (2026-09-22): **docs: 将全部中文实验 README 改写为教学教程**
  *Symptoms*: 读者打开实验 README 时，原先往往先看到运行记录、验收术语、长篇配置和结果表，难以理解实验要解释什么。本次把全部自有中文实验入口改写为教学正文：从具体问题引入机制，说明如何逐步观察，再解释结果能支持什么结论，并提出进一步思考的问题。  - 重写 111 个实验入口（包含 AndroidWorld 的嵌套失败归因教程）、10 个章节实验导航和 4 份附属教程。第三方随仓库保存的 README、模型产物说明和独立语言译本不在这次编辑范围内。 - 每个实验都有针对自身代码与任务的说明、观察要点和源码阅读路径。区分离线演示、真实模型调用、训练与硬件实验，避免把历史分数或演示输出当作必然结论。 - 将这 125 份文档的原始内容逐字节保存在同目录的 `REFERENCE*.md`，保留英文说明、完整配置和历史记录；维护实际被引用的旧章节锚点。 - 新增 `docs/EXPERIMENTS.md`，说明环境准备、共享包安装、控制比较条件和阅读输出的方法，并接入网站构建。  这是已合并的 #1142 的完整后续改写，回应 #1133，也与 #950 的可读性反馈相关。本次仅编辑文档和学习指南的发布路径，没有修改实验运行逻辑。  验证：  - 章节编号、文档状态链接与网站资源处理测试：11 项通过。 - 多语言结构审计通过；译本文件未修改。 - 54 条入口示例命令的脚本路径和参数已与源码核对；新教学文档本地链接和原文归档完整性已检查。 - 在临时副本中抽查 12 个离线示例，全部通过，涵盖上下文提示、结构化索引、工具选择与发现、ERP、桌面操作预览、成本评估、DPO 数据、轨迹验证、确认门禁、持续进化评估和书籍翻译。 - 最终 MkDocs 完整构建通过；检查 126 个教学页面的 1,688 个内部链接，未发现失效目标或锚点。首次构建触及本机文件描述符上限，提高构建进程限额（`ulimit -n 8192`）后通过。  验证未运行付费模型调用、GPU 训练或实体设备实验。原始参考文档保留既有内容，其中历史链接问题不代表新教学入口的链接状态。  CI 当前状态：多语言审计与 9 个实验测试任务通过，GitHub 网站构建仍在运行。现有 web-search 工作流的两项任务在测试收集时失败：`agentbook` 缺少 `mkdocs`（`tests/test_site_edit_urls.py`），`test` 缺少 `httpx`（`tests/test_agent.py`）；已下载本次运行日志确认。这与 #1142 上已有的依赖问题一致，本次未改动对应工作流或依赖定义。 

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

### Incident Patch 1: `f89a8464` (2026-09-22)
**Commit Message**: Revert "docs: rewrite all Chinese experiment entries as teaching tutorials (#1143)" (#1144)

This reverts commit abb8369328625da900bc1808ad5cdae9829e4415.

Co-authored-by: Bojie Li <[REDACTED_EMAIL]>

**File**: `chapter1/README.md` (modified, +32/-21)
```diff
@@ -1,29 +1,40 @@
-# 第 1 章 · AI Agent 入门
+# 第 1 章 · Agent 基础知识
 
-[读本章正文](../book/chapter1.md) · [实验学习指南](../docs/EXPERIMENTS.md)
+> **Agent = LLM + 上下文 + 工具**；Harness 工程才是竞争力
 
-本章从一条可见的执行轨迹开始，理解模型怎样读取上下文、调用工具并利用结果继续工作。先学会解释一次运行，再讨论不同设计的优劣。
+← [返回主目录](../README.md) · 📖 [读本章正文](../book/chapter1.md)
 
-## 建议的学习顺序
+## 从哪里开始
 
-1. [从一次搜索问答理解 ReAct 循环](web-search-agent/README.md)：先看无需凭据的离线搜索轨迹，辨认思考、动作与观察。
-2. [上下文怎样影响 Agent 的执行过程](context/README.md)：再在同一任务中移除一类上下文，分析行为变化。
-3. [提示词改写会让生成图片更符合需求吗](image-gen-workflow/README.md)：最后比较工作流中的额外步骤是否帮助满足用户需求。
+本章实验帮助你看清两件事：模型每轮能看到哪些信息，以及它如何调用工具、读取结果并继续回答。
+第一次阅读可以按下面的顺序进行：
 
-## 配套项目
-
-| 编号 | 项目 | 类型 | 学习内容 |
-| :--: | --- | :--: | --- |
-| 1-1 | [上下文怎样影响 Agent 的执行过程](context/README.md) | ✅ | 假设模型刚用计算器得到一个结果，下一轮却看不到这条工具消息。 |
-| 1-2 | [从一次搜索问答理解 ReAct 循环](web-search-agent/README.md) | ✅ | 回答一个需要新信息的问题时，模型往往不能一步结束：它先决定查什么，读到结果后再决定是否继续查。 |
-| 1-3 | [把搜索得到的信息交给代码计算](search-codegen/README.md) | ✅ | “两个城市相距多远”同时包含事实查询和数值计算。 |
-| 1-4 | [提示词改写会让生成图片更符合需求吗](image-gen-workflow/README.md) | ✅ | 用户说“画一张耳机海报”，与明确指定画面、风格和文案，是两种不同的任务。 |
-| 8-1, 8-2 | [在寻宝游戏中比较两种学习方式](learning-from-experience/README.md) | ✅ | 面对规则不完全公开的寻宝游戏，Agent 必须从行动后果中学习。 |
+1. 打开 [web-search-agent](web-search-agent/)，先运行无需 API Key 的离线演示。
+   观察一次“思考 → 调用工具 → 读取结果 → 回答”的过程。演示中的搜索结果是预先编写的。
+2. 打开 [context](context/)，配置一个模型提供商，先运行单个任务，再移除一种上下文信息做对照。
+   比较工具调用和最终答案，看看变化发生在哪一步。
+3. 跑通后再读代码：从 `main.py` 找入口，在 `agent.py` 中跟踪消息如何组装、工具结果如何返回。
+   提供商适配、图表和测试可以稍后阅读。
 
-✅ 表示仓库提供实现入口；📖 表示需要按指南准备外部项目；🚧 表示按正文开展的设计练习。即使有实现入口，模型、数据、浏览器或硬件仍可能需要单独准备。
+正文中的简化代码用于解释流程，实验目录中的代码负责实际运行。
+如果你要核对书中的实验结论，再查看 [实验记录](EXPERIMENT_LEDGER.md)：其中列出了运行条件、
+服务可用性和结果文件。例如，实验 1-1 的一次五组对照没有观察到“去掉推理内容必然退化”，
+因此不要把预期现象当作每次都能复现的结论。
 
-## 从演示走向完整实验
-
-先选一项实验，读清楚输入、预期观察和结果解释，再准备该项目的环境。能解释一次运行后，再扩大任务数量或比较不同配置。不要把离线示例、真实模型运行和硬件结果混为同一种证据。
+## 配套项目
 
-各实验的 README 是教学入口。完整配置、英文资料与历史结果保留在对应的技术参考文档中；本章的原始目录、外部项目版本与运行记录可在[章节技术参考](REFERENCE.md)中查阅。
+| 编号 | 项目 | 类型 | 一句话说明 |
+| :--: | --- | :--: | --- |
+| 1-1 | [context](context/) | ✅ | 系统性消融实验展示 Agent 上下文各组件的重要性；支持阿里云百炼直连 Qwen、SiliconFlow Qwen、字节 Doubao、月之暗面 Kimi 等多提供商 |
+| 1-2 | [web-search-agent](web-search-agent/) | ✅ | Kimi K3 模型即 Agent，具备基础深度搜索能力，能进行多轮搜索和信息整合 |
+| 1-3 | [search-codegen](search-codegen/) | ✅ | 模型自主多轮搜索 + 服务端代码执行的 Deep Research 闭环，先澄清意图再执行；官方 GPT-5.6 路径保留，阿里云百炼 qwen3.7-plus（hosted web_search + code_interpreter）实测通过东盟首都距离与比特币技术分析全部验收门 |
+| 1-4 | [image-gen-workflow](image-gen-workflow/) | ✅ | 具体/宽泛两类需求 × 工作流（kimi-k3 改写 + 通义万相）与原生（Gemini / GPT-Image 2）双路线真实对照：具体需求下原生更忠实（海报文案被改写节点丢进负面词），宽泛需求下改写的场景具象化带来想象力，但 GPT-Image 2 自己就能补观点——适配层被模型内化的实证 |
+| 7-1, 7-2 | [learning-from-experience](learning-from-experience/) | ✅ | 10,000 局 Q-learning + 100 局评估与官方 Kimi K3 第一局双臂实测已验收；[证据](learning-from-experience/validation/20260730_011704/evidence.json)记录 Kimi 17 步成功、零 fallback 及历史点估计差异 |
+
+## 项目类型说明
+
+| 图标 | 类型 | 含义 |
+| :--: | --- | --- |
+| ✅ | **可独立运行** | 本仓库自带完整代码，配置好 API Key 即可运行 |
+| 📖 | **复现指南** | 依赖需自行 `git clone` 的**外部仓库**（训练框架、评测基准等） |
+| 🚧 | **设计文档** | 仅包含架构与实现方案，可运行代码仍在完善中 |
```

**File**: `chapter1/REFERENCE.md` (removed, +0/-40)
```diff
@@ -1,40 +0,0 @@
-# 第 1 章 · Agent 基础知识
-
-> **Agent = LLM + 上下文 + 工具**；Harness 工程才是竞争力
-
-← [返回主目录](../README.md) · 📖 [读本章正文](../book/chapter1.md)
-
-## 从哪里开始
-
-本章实验帮助你看清两件事：模型每轮能看到哪些信息，以及它如何调用工具、读取结果并继续回答。
-第一次阅读可以按下面的顺序进行：
-
-1. 打开 [web-search-agent](web-search-agent/)，先运行无需 API Key 的离线演示。
-   观察一次“思考 → 调用工具 → 读取结果 → 回答”的过程。演示中的搜索结果是预先编写的。
-2. 打开 [context](context/)，配置一个模型提供商，先运行单个任务，再移除一种上下文信息做对照。
-   比较工具调用和最终答案，看看变化发生在哪一步。
-3. 跑通后再读代码：从 `main.py` 找入口，在 `agent.py` 中跟踪消息如何组装、工具结果如何返回。
-   提供商适配、图表和测试可以稍后阅读。
-
-正文中的简化代码用于解释流程，实验目录中的代码负责实际运行。
-如果你要核对书中的实验结论，再查看 [实验记录](EXPERIMENT_LEDGER.md)：其中列出了运行条件、
-服务可用性和结果文件。例如，实验 1-1 的一次五组对照没有观察到“去掉推理内容必然退化”，
-因此不要把预期现象当作每次都能复现的结论。
-
-## 配套项目
-
-| 编号 | 项目 | 类型 | 一句话说明 |
-| :--: | --- | :--: | --- |
-| 1-1 | [context](context/) | ✅ | 系统性消融实验展示 Agent 上下文各组件的重要性；支持阿里云百炼直连 Qwen、SiliconFlow Qwen、字节 Doubao、月之暗面 Kimi 等多提供商 |
-| 1-2 | [web-search-agent](web-search-agent/) | ✅ | Kimi K3 模型即 Agent，具备基础深度搜索能力，能进行多轮搜索和信息整合 |
-| 1-3 | [search-codegen](search-codegen/) | ✅ | 模型自主多轮搜索 + 服务端代码执行的 Deep Research 闭环，先澄清意图再执行；官方 GPT-5.6 路径保留，阿里云百炼 qwen3.7-plus（hosted web_search + code_interpreter）实测通过东盟首都距离与比特币技术分析全部验收门 |
-| 1-4 | [image-gen-workflow](image-gen-workflow/) | ✅ | 具体/宽泛两类需求 × 工作流（kimi-k3 改写 + 通义万相）与原生（Gemini / GPT-Image 2）双路线真实对照：具体需求下原生更忠实（海报文案被改写节点丢进负面词），宽泛需求下改写的场景具象化带来想象力，但 GPT-Image 2 自己就能补观点——适配层被模型内化的实证 |
-| 7-1, 7-2 | [learning-from-experience](learning-from-experience/) | ✅ | 10,000 局 Q-learning + 100 局评估与官方 Kimi K3 第一局双臂实测已验收；[证据](learning-from-experience/validation/20260730_011704/evidence.json)记录 Kimi 17 步成功、零 fallback 及历史点估计差异 |
-
-## 项目类型说明
-
-| 图标 | 类型 | 含义 |
-| :--: | --- | --- |
-| ✅ | **可独立运行** | 本仓库自带完整代码，配置好 API Key 即可运行 |
-| 📖 | **复现指南** | 依赖需自行 `git clone` 的**外部仓库**（训练框架、评测基准等） |
-| 🚧 | **设计文档** | 仅包含架构与实现方案，可运行代码仍在完善中 |
```

**File**: `chapter1/context/README.md` (modified, +1160/-18)
```diff
@@ -1,37 +1,1179 @@
-# 上下文怎样影响 Agent 的执行过程
+# Context-Aware AI Agent with Ablation Studies / 上下文感知 Agent 与消融实验
 
-[本章实验目录](../README.md) · [相关正文](../../book/chapter1.md) · [技术参考](REFERENCE.md)
+> Multi-provider context-aware agent with systematic ablation of context components (history, reasoning, tool calls, tool results).
+> 配套《深入理解 AI Agent》第 1 章 **实验 1-1 ★★：上下文的关键作用**。
 
-假设模型刚用计算器得到一个结果，下一轮却看不到这条工具消息。它还能可靠地继续计算吗？本实验用同一任务的不同上下文版本，帮助你理解模型的行为为什么取决于它实际收到的信息。
+← [Chapter 1 index / 返回第 1 章目录](../README.md) · 📖 [Read the chapter / 读本章正文](../../book/chapter1.md)（[EN](../../book-en/chapter1.md)）
 
-## 理解实验
+---
 
-把一类信息从完整输入中移除，再比较行为，称为消融实验。这里分别考察历史消息、推理内容、工具定义和工具结果。它们承担不同职责：工具定义说明能做什么，工具结果说明刚才发生了什么；两者不能相互替代。
+[中文说明](#中文) · [English](#english)
 
-## 动手之前
+## 先跑一个对照
 
-运行模型部分需要按技术参考配置对应的服务凭据；调用会使用该服务的额度。先准备一个小任务，再扩展比较范围。 通用环境说明见[实验学习指南](../../docs/EXPERIMENTS.md)。
+这个实验研究：给同一个模型、同一个任务，少提供一类上下文信息，执行过程会发生什么变化？
+“消融”就是一次只移除一个组件，再与完整版本比较。先观察一个任务，之后再运行批量实验。
 
-## 一步步观察
+你需要 Python 3.10+，以及一个可用的模型 API Key。下面以百炼为例；其他提供商的配置见中文说明。
+在仓库根目录安装依赖并激活环境，再进入实验目录：
 
-先为所选提供商配置 API Key。下面以百炼为例，只运行一道计算题。读完终端中的工具调用，再把命令里的 `full` 改成 `no_tool_results` 重跑。保持任务和模型相同，才能把差异与上下文变化联系起来。
+```bash
+uv sync --locked --extra ch1
+source .venv/bin/activate
+cd chapter1/context
+export DASHSCOPE_API_KEY='your-api-key-here'
+
+python main.py --mode single --provider dashscope --context-mode full \
+  --task "请调用计算器计算 (125 + 375) * 8，并给出结果。" --output full.json
+python main.py --mode single --provider dashscope --context-mode no_tool_results \
+  --task "请调用计算器计算 (125 + 375) * 8，并给出结果。" --output no-tool-results.json
+```
+
+Windows 的环境激活方式和其他安装方法见下文“快速开始”。这两条命令会调用模型 API。
+
+计算结果应为 **4000**。但答案相同不代表两次执行相同：先检查是否调用了计算器，再看工具结果是否
+进入了下一轮上下文。即使没有看到工具结果，模型也可能自己算对这道简单题。
+如果没有发生工具调用，这次任务就不能说明移除工具结果的影响；应换一个确实需要工具的任务再比较。
+`full.json` 和 `no-tool-results.json` 保存了各次运行结果，可结合终端日志核对。
+
+读代码时，先看 `main.py` 的参数分发，再看 `agent.py` 如何组装消息和处理工具结果。
+提供商适配和绘图代码可以稍后阅读。
+
+## 中文
+
+### 概述
+
+对应书中**实验 1-1 ★★：上下文的关键作用**。Agent 可以读取 PDF、换算货币、计算表达式和执行 Python。你可以分别移除历史消息、推理内容、工具定义或工具结果，观察它怎样完成同一任务。下面的配置说明供你在跑通第一个对照后查阅。
+
+### 主要特性
+
+- **多提供商支持**：阿里云百炼（Qwen 直连）、SiliconFlow（Qwen）、Doubao（字节）、Kimi（月之暗面）、DeepSeek
+- **多工具 Agent**：PDF 解析、货币换算、计算与 Python 代码执行
+- **上下文模式**：五种配置，用于消融对照
+- **交互与批处理**：单任务运行或完整测试套件
+- **对话历史**：同一会话内跨多轮查询保持上下文
+- **详细分析**：性能指标、可视化与综合报告
+
+### 支持的 LLM 提供商
+
+#### Doubao（字节跳动）— 默认
+
+- **模型**：`doubao-seed-1-6-thinking-250715`（可自定义）
+- **API**：火山引擎上的 OpenAI 兼容接口
+- **适合**：深度推理、较快响应，中英文任务均可
+
+#### SiliconFlow
+
+- **模型**：`Qwen/Qwen3.5-397B-A17B`（可自定义）
+- **API**：OpenAI 兼容
+- **适合**：复杂推理与细致分析
+
+#### 阿里云百炼（Qwen 直连）
+
+- **模型**：`qwen3.7-plus`（可通过 `--model` 自定义）
+- **API**：直连 DashScope 的 OpenAI 兼容接口，无需 SiliconFlow 账号
+- **提供商名称**：规范名称为 `dashscope`，也可使用别名 `qwen` 或 `bailian`
+- **区域说明**：API Key 与区域绑定。中国内地 Key 默认直连内地端点；国际站 Key 必须设置 `DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
+
+#### Kimi（月之暗面）
+
+- **模型**：`kimi-k3`（K3 推理模型；temperature 强制为 1，max_tokens 足够容纳思考输出）
+- **API**：Moonshot 平台 OpenAI 兼容接口
+- **适合**：深度推理、多轮对话，中英文任务均可
+- **特性**：上下文缓存以优化成本
+
+#### DeepSeek
+
+- **模型**：`deepseek-v4-flash`（默认；更强档可用 `--model deepseek-v4-pro`）
+- **API**：[DeepSeek Platform](https://platform.deepseek.com/) 的 OpenAI 兼容接口
+- **适合**：性价比高的工具调用；开启 thinking，便于 `no_reasoning` 消融剥离 `reasoning_content`
+- **说明**：旧别名 `deepseek-chat` / `deepseek-reasoner` 已弃用（2026-07-24），请优先使用 V4 id
+
+### 架构
+
+#### 上下文组件
+
+1. **Full Context** — 完整 Agent，保留全部组件
+2. **No History** — 缺少历史工具调用追踪
+3. **No Reasoning** — 无战略规划/思考过程
+4. **No Tool Calls** — 无法执行外部工具
+5. **No Tool Results** — 看不到工具执行结果
+
+#### 可用工具
+
+- **`parse_pdf(url)`** — 下载并抽取 PDF 文本
+- **`convert_currency(amount, from, to)`** — 货币换算
+- **`calculate(expression)`** — 简单数学表达式求值
+- **`code_interpreter(code)`** — 执行 Python，用于复杂计算、汇总与数据处理
+
+### 前置条件
+
+- Python 3.10+
+- 任一支持提供商的 API Key：
+  - **阿里云百炼**：[百炼控制台](https://bailian.console.aliyun.com/)
+  - **SiliconFlow**：[SiliconFlow](https://siliconflow.cn)
+  - **Doubao（字节）**：[火山引擎](https://www.volcengine.com/)
+  - **Kimi（月之暗面）**：[Moonshot Platform](https://platform.moonshot.cn/)
+  - **DeepSeek**：[DeepSeek Platform](https://platform.deepseek.com/api_keys)
+
+### 示例任务
+
+系统预置 5 个样例任务：
+
+1. **简单货币换算** — 基础多币种计算
+2. **多币种预算分析** — 跨办公室费用分析
+3. **PDF 财务分析** — 解析并分析财务文档
+4. **投资增长计算** — 复利与货币换算
+5. **综合财务报告** — 串联全部工具的完整流程
+
+用于展示 Agent 能力与上下文消融的影响。
+
+### 快速开始
+
+#### 1. 安装
+
+```bash
+# 推荐在仓库根目录使用统一的第 1 章环境
+uv sync --locked --extra ch1
+
+# 切换目录前先激活环境：
+# macOS/Linux：
+source .venv/bin/activate
+# Windows PowerShell：.\.venv\Scripts\Activate.ps1
+# Windows cmd：.venv\Scripts\activate.bat
+
+# 未安装 uv 时可用 pip 兜底：
+# python -m pip install -e ".[ch1]"
+
+# 进入本实验目录，后续命令都在这里运行
+cd chapter1/context
+
+# 迁移期间仍支持单项目兼容路径：
+# python -m pip install -r requirements.txt
+
+# 复制并配置环境变量
+cp env.example .env
+# 编辑 .env 并填入一个提供商的 API Key（例如 DASHSCOPE_API_KEY 或 ARK_API_KEY）
+```
+
+#### 2. 配置提供商
+
+```bash
+# For Doubao (ByteDance) - Default
+export ARK_API_KEY=your_key_here
+python main.py  # 
```

**File**: `chapter1/context/REFERENCE.md` (removed, +0/-1179)
```diff
@@ -1,1179 +0,0 @@
-# Context-Aware AI Agent with Ablation Studies / 上下文感知 Agent 与消融实验
-
-> Multi-provider context-aware agent with systematic ablation of context components (history, reasoning, tool calls, tool results).
-> 配套《深入理解 AI Agent》第 1 章 **实验 1-1 ★★：上下文的关键作用**。
-
-← [Chapter 1 index / 返回第 1 章目录](../README.md) · 📖 [Read the chapter / 读本章正文](../../book/chapter1.md)（[EN](../../book-en/chapter1.md)）
-
----
-
-[中文说明](#中文) · [English](#english)
-
-## 先跑一个对照
-
-这个实验研究：给同一个模型、同一个任务，少提供一类上下文信息，执行过程会发生什么变化？
-“消融”就是一次只移除一个组件，再与完整版本比较。先观察一个任务，之后再运行批量实验。
-
-你需要 Python 3.10+，以及一个可用的模型 API Key。下面以百炼为例；其他提供商的配置见中文说明。
-在仓库根目录安装依赖并激活环境，再进入实验目录：
-
-```bash
-uv sync --locked --extra ch1
-source .venv/bin/activate
-cd chapter1/context
-export DASHSCOPE_API_KEY='your-api-key-here'
-
-python main.py --mode single --provider dashscope --context-mode full \
-  --task "请调用计算器计算 (125 + 375) * 8，并给出结果。" --output full.json
-python main.py --mode single --provider dashscope --context-mode no_tool_results \
-  --task "请调用计算器计算 (125 + 375) * 8，并给出结果。" --output no-tool-results.json
-```
-
-Windows 的环境激活方式和其他安装方法见下文“快速开始”。这两条命令会调用模型 API。
-
-计算结果应为 **4000**。但答案相同不代表两次执行相同：先检查是否调用了计算器，再看工具结果是否
-进入了下一轮上下文。即使没有看到工具结果，模型也可能自己算对这道简单题。
-如果没有发生工具调用，这次任务就不能说明移除工具结果的影响；应换一个确实需要工具的任务再比较。
-`full.json` 和 `no-tool-results.json` 保存了各次运行结果，可结合终端日志核对。
-
-读代码时，先看 `main.py` 的参数分发，再看 `agent.py` 如何组装消息和处理工具结果。
-提供商适配和绘图代码可以稍后阅读。
-
-## 中文
-
-### 概述
-
-对应书中**实验 1-1 ★★：上下文的关键作用**。Agent 可以读取 PDF、换算货币、计算表达式和执行 Python。你可以分别移除历史消息、推理内容、工具定义或工具结果，观察它怎样完成同一任务。下面的配置说明供你在跑通第一个对照后查阅。
-
-### 主要特性
-
-- **多提供商支持**：阿里云百炼（Qwen 直连）、SiliconFlow（Qwen）、Doubao（字节）、Kimi（月之暗面）、DeepSeek
-- **多工具 Agent**：PDF 解析、货币换算、计算与 Python 代码执行
-- **上下文模式**：五种配置，用于消融对照
-- **交互与批处理**：单任务运行或完整测试套件
-- **对话历史**：同一会话内跨多轮查询保持上下文
-- **详细分析**：性能指标、可视化与综合报告
-
-### 支持的 LLM 提供商
-
-#### Doubao（字节跳动）— 默认
-
-- **模型**：`doubao-seed-1-6-thinking-250715`（可自定义）
-- **API**：火山引擎上的 OpenAI 兼容接口
-- **适合**：深度推理、较快响应，中英文任务均可
-
-#### SiliconFlow
-
-- **模型**：`Qwen/Qwen3.5-397B-A17B`（可自定义）
-- **API**：OpenAI 兼容
-- **适合**：复杂推理与细致分析
-
-#### 阿里云百炼（Qwen 直连）
-
-- **模型**：`qwen3.7-plus`（可通过 `--model` 自定义）
-- **API**：直连 DashScope 的 OpenAI 兼容接口，无需 SiliconFlow 账号
-- **提供商名称**：规范名称为 `dashscope`，也可使用别名 `qwen` 或 `bailian`
-- **区域说明**：API Key 与区域绑定。中国内地 Key 默认直连内地端点；国际站 Key 必须设置 `DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
-
-#### Kimi（月之暗面）
-
-- **模型**：`kimi-k3`（K3 推理模型；temperature 强制为 1，max_tokens 足够容纳思考输出）
-- **API**：Moonshot 平台 OpenAI 兼容接口
-- **适合**：深度推理、多轮对话，中英文任务均可
-- **特性**：上下文缓存以优化成本
-
-#### DeepSeek
-
-- **模型**：`deepseek-v4-flash`（默认；更强档可用 `--model deepseek-v4-pro`）
-- **API**：[DeepSeek Platform](https://platform.deepseek.com/) 的 OpenAI 兼容接口
-- **适合**：性价比高的工具调用；开启 thinking，便于 `no_reasoning` 消融剥离 `reasoning_content`
-- **说明**：旧别名 `deepseek-chat` / `deepseek-reasoner` 已弃用（2026-07-24），请优先使用 V4 id
-
-### 架构
-
-#### 上下文组件
-
-1. **Full Context** — 完整 Agent，保留全部组件
-2. **No History** — 缺少历史工具调用追踪
-3. **No Reasoning** — 无战略规划/思考过程
-4. **No Tool Calls** — 无法执行外部工具
-5. **No Tool Results** — 看不到工具执行结果
-
-#### 可用工具
-
-- **`parse_pdf(url)`** — 下载并抽取 PDF 文本
-- **`convert_currency(amount, from, to)`** — 货币换算
-- **`calculate(expression)`** — 简单数学表达式求值
-- **`code_interpreter(code)`** — 执行 Python，用于复杂计算、汇总与数据处理
-
-### 前置条件
-
-- Python 3.10+
-- 任一支持提供商的 API Key：
-  - **阿里云百炼**：[百炼控制台](https://bailian.console.aliyun.com/)
-  - **SiliconFlow**：[SiliconFlow](https://siliconflow.cn)
-  - **Doubao（字节）**：[火山引擎](https://www.volcengine.com/)
-  - **Kimi（月之暗面）**：[Moonshot Platform](https://platform.moonshot.cn/)
-  - **DeepSeek**：[DeepSeek Platform](https://platform.deepseek.com/api_keys)
-
-### 示例任务
-
-系统预置 5 个样例任务：
-
-1. **简单货币换算** — 基础多币种计算
-2. **多币种预算分析** — 跨办公室费用分析
-3. **PDF 财务分析** — 解析并分析财务文档
-4. **投资增长计算** — 复利与货币换算
-5. **综合财务报告** — 串联全部工具的完整流程
-
-用于展示 Agent 能力与上下文消融的影响。
-
-### 快速开始
-
-#### 1. 安装
-
-```bash
-# 推荐在仓库根目录使用统一的第 1 章环境
-uv sync --locked --extra ch1
-
-# 切换目录前先激活环境：
-# macOS/Linux：
-source .venv/bin/activate
-# Windows PowerShell：.\.venv\Scripts\Activate.ps1
-# Windows cmd：.venv\Scripts\activate.bat
-
-# 未安装 uv 时可用 pip 兜底：
-# python -m pip install -e ".[ch1]"
-
-# 进入本实验目录，后续命令都在这里运行
-cd chapter1/context
-
-# 迁移期间仍支持单项目兼容路径：
-# python -m pip install -r requirements.txt
-
-# 复制并配置环境变量
-cp env.example .env
-# 编辑 .env 并填入一个提供商的 API Key（例如 DASHSCOPE_API_KEY 或 ARK_API_KEY）
-```
-
-#### 2. 配置提供商
-
-```bash
-# For Doubao (ByteDance) - Default
-export ARK_API_KEY=your_key_here
-python main.py  # Uses Doubao by default
-
-# For SiliconFlow (Qwen)
-export SILICONFLOW_API_KEY=your_key_here
-python main.py --provider siliconflow
-
-# 通过阿里云百炼直连 Qwen
-export DASHSCOPE_API_KEY=your_key_here
-python main.py --provider dashscope
-# --provider qwen 与 --provider bailian 是等价别名。
-# 如果使用国际站 Key，还需设置：
-export DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
-
-# For Kimi (Moonshot)
-export MOONSHOT_API_KEY=your_key_here
-python main.py --provider kimi
-
-# For DeepSeek
-export DEEPSEEK_API_KEY=your_key
```

**File**: `chapter1/image-gen-workflow/README.md` (modified, +175/-19)
```diff
@@ -1,37 +1,193 @@
-# 提示词改写会让生成图片更符合需求吗
+# 实验 1-4：文生图工作流与原生图像生成的对照
 
-[本章实验目录](../README.md) · [相关正文](../../book/chapter1.md) · [技术参考](REFERENCE.md)
+对应书稿 `book/chapter1.md` 的「实验 1-4 ★」。
 
-用户说“画一张耳机海报”，与明确指定画面、风格和文案，是两种不同的任务。本实验比较直接生成图片和先改写提示词再生成图片，学习如何判断一个工作流步骤是否真正有帮助。
+## 实验目标
 
-## 理解实验
+让同一句口语化中文需求走两条路线，对照观察：
 
-改写节点把用户语言转成图像模型的输入，也可能补充场景细节。对于宽泛需求，这可能有助于形成画面；对于具体需求，多加的内容却可能挤掉用户的原始约束。因此，应分别评价创意补充和要求保留。
+1. **工作流路线中「改写」节点产出的提示词与原始需求的差异**——LLM 在这一节点做的不是智能决策，而是「翻译」：把自然语言适配成文生图模型能消化的输入格式；
+2. **两条路线最终图片对原始需求的满足程度**。
 
-## 动手之前
+需求按口语化程度分两类对照：
 
-运行模型部分需要按技术参考配置对应的服务凭据；调用会使用该服务的额度。先准备一个小任务，再扩展比较范围。 通用环境说明见[实验学习指南](../../docs/EXPERIMENTS.md)。
+- **具体需求**：用户已指定场景、风格或文案细节，考察的是执行的**忠实度**——改写节点会不会弄丢或篡改用户给定的信息；
+- **宽泛需求**：用户只给主题不给细节，考察的是改写节点做**场景具象化**带来的信息增益——它替用户想象出的画面，是原生路线直接出图所没有的叙事性，还是多此一举的过度发挥。
 
-## 一步步观察
+测试需求（5 句口语化中文描述，`main.py` 中 `REQUIREMENTS`）：
 
-配置参考文档中对应路线的模型凭据后，先只选 `windowsill-plant` 这一项。运行后并排阅读原始需求、改写后的提示词和最终图片。再选择一个宽泛需求，重复同样的观察，避免一开始就批量生成所有图片。
+| 类别 | ID | 需求 |
+| --- | --- | --- |
+| 具体 | `programmer-overtime` | 帮我画一个周末加班的程序员，风格丧一点 |
+| 具体 | `windowsill-plant` | 帮我画一盆放在窗台上的绿植，早晨的阳光刚好照进来 |
+| 具体 | `headphone-poster` | 帮我做一张新款降噪耳机的产品海报，主打"深夜独处也清净"这句文案，风格简约高级 |
+| 宽泛（主用例） | `agi-programmer` | 帮我画一个 AGI 实现以后程序员的工作场景 |
+| 宽泛 | `future-city-morning` | 帮我画一幅"未来城市的早晨"的画 |
 
-以下命令从本实验目录运行；请先完成上面的环境准备。
+## 三条路线的架构
 
-```bash
-python main.py --requirement windowsill-plant
+```
+工作流路线（workflow）：
+  用户需求 ──> [节点 1: 提示词改写, Kimi kimi-k3]
+                 输出 SD 风格 JSON：{prompt（逗号分隔英文 tag + 质量词）,
+                                      negative_prompt, style_notes}
+             ──> [节点 2: 文生图, 通义万相 wan2.2-t2i-flash]
+                 输入改写后的 prompt / negative_prompt，输出图片
+
+原生路线 A（native）：
+  用户需求 ──> [Gemini gemini-3-pro-image（书稿所称 Nano Banana 2）]
+                 一次调用直接输出图片（response_modalities=["IMAGE"]）
+
+原生路线 B（native_gptimage）：
+  用户需求 ──> [OpenAI gpt-image-2（GPT-Image 2）]
+                 images/generations 接口，一次调用直接出图
 ```
 
-## 怎样解释结果
+工作流路线的执行路径是代码写死的（先改写、后生成，见 `pipeline.py` 的
+`run_workflow_route`）；两条原生路线都没有改写节点，模型自己理解口语化需求并直接出图。
+
+## 模型选型实录（如实记录）
+
+- **原生路线 A（native）**：**`gemini-3-pro-image`**（书稿所称 Nano Banana 2）——
+  ListModels 实测可用，5 句需求全部一次成功（20260821T040450Z 轮）；早期轮次
+  `agi-programmer` 偶发内容过滤（候选响应 content 为 None），重跑后恢复，非不可用。
+- **原生路线 B（native_gptimage）**：OpenAI **`gpt-image-2`**（GPT-Image 2，
+  images/generations 接口）——全部 5 句需求均一次成功。该账户此前 GPT-5.x 因
+  `credit_balance_exhausted` 失败过，但图像接口可用。
+- **工作流路线生图工具**：实验设计首选 SiliconFlow 托管的 FLUX.1 / Stable Diffusion
+  系列，实测 `black-forest-labs/FLUX.1-schnell` 与
+  `stabilityai/stable-diffusion-3-5-large` 返回 `Model disabled`；账户余额为 0，
+  `Kwai-Kolors/Kolors`、`Tongyi-MAI/Z-Image-Turbo`、`Qwen/Qwen-Image` 均报
+  `balance insufficient`；OpenRouter 仅提供视觉理解模型，不支持文本转图像生成。
+  改用 **DashScope 国际站通义万相 `wan2.2-t2i-flash`**（经典扩散式文生图模型，接受
+  SD 风格提示词与负面提示词，异步任务接口）。注意：该模型服务端会再做一次内部提示词
+  扩写（响应中的 `actual_prompt` 字段），已一并留证。
+- **改写节点 LLM**：Moonshot **`kimi-k3`**（OpenAI 兼容接口）。
+  kimi-k3 只允许 temperature=1（默认值），显式传其他值被 400 拒绝。
+
+## 配置与运行
 
-检查窗台、绿植和晨光是否同时出现，而不只判断图片是否漂亮。如果某个要求消失了，先查它是否在改写时丢失；若提示词仍保留它，再分析图像生成阶段。不同路线使用的模型也不同，结果不能全部归因于是否改写。
+```bash
+# 在仓库根目录
+cp chapter1/image-gen-workflow/env.example .env   # 填入各 API Key（或 export 环境变量）
 
-## 继续思考
+cd chapter1/image-gen-workflow
+pip install -r requirements.txt   # google-genai openai requests python-dotenv
 
-怎样设计一个既奖励合理补充、又惩罚擅自修改明确要求的评分表？
+# 标准运行：全部 5 句需求 × 3 条路线（workflow/native/native_gptimage）
+python main.py
 
-## 阅读代码与技术参考
+# 只跑某条路线 / 某句需求
+python main.py --route workflow
+python main.py --route native_gptimage
+python main.py --requirement windowsill-plant
 
-沿下面的顺序阅读代码，可以把前面的概念与实现对应起来：[main.py](https://github.com/bojieli/ai-agent-book/blob/main/chapter1/image-gen-workflow/main.py) → [pipeline.py](https://github.com/bojieli/ai-agent-book/blob/main/chapter1/image-gen-workflow/pipeline.py) → [evidence.py](https://github.com/bojieli/ai-agent-book/blob/main/chapter1/image-gen-workflow/evidence.py)。
+# 离线测试（不发真实请求）
+python -m pytest
+```
+
+所需环境变量见 `env.example`：`KIMI_API_KEY`、`DASHSCOPE_API_KEY`、`GEMINI_API_KEY`、
+`OPENAI_API_KEY`（`SILICONFLOW_API_KEY` 为首选方案保留，本次未实际使用）。
+
+## 目录与证据
+
+```
+image-gen-workflow/
+├── config.py        # 环境变量与模型配置
+├── pipeline.py      # 改写节点 + 两条路线的编排，每次调用产生 call record
+├── evidence.py      # evidence manifest 构建与离线校验
+├── main.py          # 正式运行入口
+├── tests/           # 离线测试（改写输出结构、manifest 模式、env 一致性）
+├── outputs/<run_id>/
+│   ├── images/      # 生成的图片
+│   └── calls/       # 每次 API 调用的请求/响应 JSON（模型、参数、响应 ID、用量、时间戳）
+└── validation/
+    ├── latest.json
+    └── real_<run_id>/
+        ├── evidence.json      # manifest：输入、改写结果、图片相对路径与 SHA-256、模型、用量
+        └── evidence.sha256
+```
 
-原有说明保存在[技术参考](REFERENCE.md)中。需要查阅详细配置、英文材料或历史记录时，请从这里继续，并核对记录所使用的数据、模型与环境条件。
+## 正式运行结果摘要
+
+**最终正式运行（run_id=`20260821T040450Z`）**：5 句需求 × 3 条路线共 15 次运行，**15/15 全部成功**，
+证据见 `validation/real_20260821T040450Z/evidence.json`（sha256: `7e529a8085d7d90856a2311a8981f5fc0b59531065121ff7eed5b74a1b076783`）。
+
+历史运行（过程
```

**File**: `chapter1/image-gen-workflow/REFERENCE.md` (removed, +0/-193)
```diff
@@ -1,193 +0,0 @@
-# 实验 1-4：文生图工作流与原生图像生成的对照
-
-对应书稿 `book/chapter1.md` 的「实验 1-4 ★」。
-
-## 实验目标
-
-让同一句口语化中文需求走两条路线，对照观察：
-
-1. **工作流路线中「改写」节点产出的提示词与原始需求的差异**——LLM 在这一节点做的不是智能决策，而是「翻译」：把自然语言适配成文生图模型能消化的输入格式；
-2. **两条路线最终图片对原始需求的满足程度**。
-
-需求按口语化程度分两类对照：
-
-- **具体需求**：用户已指定场景、风格或文案细节，考察的是执行的**忠实度**——改写节点会不会弄丢或篡改用户给定的信息；
-- **宽泛需求**：用户只给主题不给细节，考察的是改写节点做**场景具象化**带来的信息增益——它替用户想象出的画面，是原生路线直接出图所没有的叙事性，还是多此一举的过度发挥。
-
-测试需求（5 句口语化中文描述，`main.py` 中 `REQUIREMENTS`）：
-
-| 类别 | ID | 需求 |
-| --- | --- | --- |
-| 具体 | `programmer-overtime` | 帮我画一个周末加班的程序员，风格丧一点 |
-| 具体 | `windowsill-plant` | 帮我画一盆放在窗台上的绿植，早晨的阳光刚好照进来 |
-| 具体 | `headphone-poster` | 帮我做一张新款降噪耳机的产品海报，主打"深夜独处也清净"这句文案，风格简约高级 |
-| 宽泛（主用例） | `agi-programmer` | 帮我画一个 AGI 实现以后程序员的工作场景 |
-| 宽泛 | `future-city-morning` | 帮我画一幅"未来城市的早晨"的画 |
-
-## 三条路线的架构
-
-```
-工作流路线（workflow）：
-  用户需求 ──> [节点 1: 提示词改写, Kimi kimi-k3]
-                 输出 SD 风格 JSON：{prompt（逗号分隔英文 tag + 质量词）,
-                                      negative_prompt, style_notes}
-             ──> [节点 2: 文生图, 通义万相 wan2.2-t2i-flash]
-                 输入改写后的 prompt / negative_prompt，输出图片
-
-原生路线 A（native）：
-  用户需求 ──> [Gemini gemini-3-pro-image（书稿所称 Nano Banana 2）]
-                 一次调用直接输出图片（response_modalities=["IMAGE"]）
-
-原生路线 B（native_gptimage）：
-  用户需求 ──> [OpenAI gpt-image-2（GPT-Image 2）]
-                 images/generations 接口，一次调用直接出图
-```
-
-工作流路线的执行路径是代码写死的（先改写、后生成，见 `pipeline.py` 的
-`run_workflow_route`）；两条原生路线都没有改写节点，模型自己理解口语化需求并直接出图。
-
-## 模型选型实录（如实记录）
-
-- **原生路线 A（native）**：**`gemini-3-pro-image`**（书稿所称 Nano Banana 2）——
-  ListModels 实测可用，5 句需求全部一次成功（20260821T040450Z 轮）；早期轮次
-  `agi-programmer` 偶发内容过滤（候选响应 content 为 None），重跑后恢复，非不可用。
-- **原生路线 B（native_gptimage）**：OpenAI **`gpt-image-2`**（GPT-Image 2，
-  images/generations 接口）——全部 5 句需求均一次成功。该账户此前 GPT-5.x 因
-  `credit_balance_exhausted` 失败过，但图像接口可用。
-- **工作流路线生图工具**：实验设计首选 SiliconFlow 托管的 FLUX.1 / Stable Diffusion
-  系列，实测 `black-forest-labs/FLUX.1-schnell` 与
-  `stabilityai/stable-diffusion-3-5-large` 返回 `Model disabled`；账户余额为 0，
-  `Kwai-Kolors/Kolors`、`Tongyi-MAI/Z-Image-Turbo`、`Qwen/Qwen-Image` 均报
-  `balance insufficient`；OpenRouter 仅提供视觉理解模型，不支持文本转图像生成。
-  改用 **DashScope 国际站通义万相 `wan2.2-t2i-flash`**（经典扩散式文生图模型，接受
-  SD 风格提示词与负面提示词，异步任务接口）。注意：该模型服务端会再做一次内部提示词
-  扩写（响应中的 `actual_prompt` 字段），已一并留证。
-- **改写节点 LLM**：Moonshot **`kimi-k3`**（OpenAI 兼容接口）。
-  kimi-k3 只允许 temperature=1（默认值），显式传其他值被 400 拒绝。
-
-## 配置与运行
-
-```bash
-# 在仓库根目录
-cp chapter1/image-gen-workflow/env.example .env   # 填入各 API Key（或 export 环境变量）
-
-cd chapter1/image-gen-workflow
-pip install -r requirements.txt   # google-genai openai requests python-dotenv
-
-# 标准运行：全部 5 句需求 × 3 条路线（workflow/native/native_gptimage）
-python main.py
-
-# 只跑某条路线 / 某句需求
-python main.py --route workflow
-python main.py --route native_gptimage
-python main.py --requirement windowsill-plant
-
-# 离线测试（不发真实请求）
-python -m pytest
-```
-
-所需环境变量见 `env.example`：`KIMI_API_KEY`、`DASHSCOPE_API_KEY`、`GEMINI_API_KEY`、
-`OPENAI_API_KEY`（`SILICONFLOW_API_KEY` 为首选方案保留，本次未实际使用）。
-
-## 目录与证据
-
-```
-image-gen-workflow/
-├── config.py        # 环境变量与模型配置
-├── pipeline.py      # 改写节点 + 两条路线的编排，每次调用产生 call record
-├── evidence.py      # evidence manifest 构建与离线校验
-├── main.py          # 正式运行入口
-├── tests/           # 离线测试（改写输出结构、manifest 模式、env 一致性）
-├── outputs/<run_id>/
-│   ├── images/      # 生成的图片
-│   └── calls/       # 每次 API 调用的请求/响应 JSON（模型、参数、响应 ID、用量、时间戳）
-└── validation/
-    ├── latest.json
-    └── real_<run_id>/
-        ├── evidence.json      # manifest：输入、改写结果、图片相对路径与 SHA-256、模型、用量
-        └── evidence.sha256
-```
-
-## 正式运行结果摘要
-
-**最终正式运行（run_id=`20260821T040450Z`）**：5 句需求 × 3 条路线共 15 次运行，**15/15 全部成功**，
-证据见 `validation/real_20260821T040450Z/evidence.json`（sha256: `7e529a8085d7d90856a2311a8981f5fc0b59531065121ff7eed5b74a1b076783`）。
-
-历史运行（过程留证，均保留）：
-
-- **run_id=`20260821T014302Z`（失败记录）**：kimi-k3 显式传了 temperature=0.3
-  被 400 拒绝，改写节点 3 次全部失败；修正后重跑，该次留证保留。
-- **run_id=`20260821T014534Z`**：3 句具体需求 × 2 条路线（workflow + native=gemini-3.1-flash-image-preview）
-  共 6 次成功。
-- **run_id=`20260821T020405Z`**：2 句宽泛需求 × 同上 2 条路线 + gpt-image-2 对照，共 5 次成功。
-
-### 具体需求对照：改写节点对原始需求做了什么
-
-以主用例「帮我画一个周末加班的程序员，风格丧一点」为例，kimi-k3 改写产出：
-
-- **prompt**（节选）：`masterpiece, best quality, ..., exhausted programmer, messy black hair, dark circles under eyes, dead tired eyes, ..., empty dark office at night, weekend overtime, cold blue screen glow, ..., melancholic atmosphere, lonely, gloomy`
-- **negative_prompt**（节选）：`lowres, bad anatomy, ..., smiling, cheerful, bright daylight, crowded`
-- **style_notes**：把抽象的"丧"具象化为冷蓝屏幕光、黑眼圈死鱼眼、凌乱工位和深夜空无一人的办公室；负面词中排除微笑、明亮色彩等破坏情绪的元素。
-
-可以看到改写做了三件事：**翻译**（中文→英文 tag）、**具象化**（"丧"→ 黑眼圈 /
-冷蓝光 / 深夜空办公室，"周末加班"→ weekend overtime + empty office）、**风格决策**
-（自作主张选了 anime style——用户并没有指定画风）。负面提示词甚至把 smiling、
-cheerful 列为排除项来保住"丧"的情绪，这是原始需求里没有的信息增益。
-
-值得注意：万相服务端对 prompt 又做了一次内部扩写（响应里的 `actual_prompt`
-字段，已留证）——托管文生图服务自己也开始内置"改写"这一适配层了。
-
-### 具体需求对照：三条路线的图片对原始需求的满足程度
-
-| 需求 | 工作流路线（改写 + 万相） | 原生路线 A
```

**File**: `chapter1/learning-from-experience/README.md` (modified, +740/-16)
```diff
@@ -1,31 +1,755 @@
-# 在寻宝游戏中比较两种学习方式
+# Learning from Experience: RL vs LLM In-Context Learning / 从经验中学习：RL 与 LLM 上下文学习对比
 
-[本章实验目录](../README.md) · [相关正文](../../book/chapter8.md) · [技术参考](REFERENCE.md)
+> Compares tabular Q-learning with LLM in-context learning on a treasure-hunt game with hidden mechanics (Shunyu Yao, “The Second Half”).  
+> 代码位于第 1 章项目树；对应书中 **实验 8-1 ★（Q-learning 在寻宝游戏中的表现）** 与 **实验 8-2 ★★（传统 RL 与 LLM Agent 的对比研究）**。
 
-面对规则不完全公开的寻宝游戏，Agent 必须从行动后果中学习。本项目把表格型 Q-learning 与 LLM 的上下文学习放在同一游戏中，帮助你区分“更新参数”和“把经验留在输入中”。
+← [Chapter 1 index / 返回第 1 章目录](../README.md) · 📖 [Read Chapter 8 / 读第 8 章正文](../../book/chapter8.md)（[EN](../../book-en/chapter8.md)）
 
-## 理解实验
+---
 
-Q-learning 用多次交互更新状态与动作的价值；LLM 则可以阅读行动历史，提出关于游戏规则的解释，并据此选择下一步。二者使用的先验知识、训练投入和记忆形式不同，不能只比较一局游戏的分数。
+## English
 
-## 动手之前
+### Overview
 
-本项目有多条运行路径。先按下文确定要观察的机制，再使用技术参考中对应的环境、数据与命令，避免混用不同路径的配置。 通用环境说明见[实验学习指南](../../docs/EXPERIMENTS.md)。
+This experiment compares traditional Reinforcement Learning (Q-learning) with LLM-based in-context learning, replicating the key insights from Shunyu Yao's blog post ["The Second Half"](https://ysymyth.github.io/The-Second-Half/).
 
-## 一步步观察
+It demonstrates how LLMs can generalize through reasoning while traditional RL methods require extensive training to learn game mechanics. We use a text-based treasure hunt game with hidden mechanics that agents must discover through experience.
 
-先阅读游戏环境中的状态、动作与奖励定义，再用参考文档中的本地 Q-learning 路径观察训练前后的行为。随后配置 LLM 路径，跟踪一局中的观察如何改变下一步选择。本目录位于第一章项目树，相关学习实验的正文在第八章。
+### Key Insights Being Tested
 
-## 怎样解释结果
+1. **Sample Efficiency**: LLMs can learn from far fewer examples than traditional RL
+2. **Generalization**: LLMs use reasoning to understand patterns, while RL memorizes state-action mappings
+3. **Prior Knowledge**: Language pre-training provides powerful priors for reasoning about new tasks
+4. **Hidden Mechanics Discovery**: LLMs can form hypotheses and test them, while RL requires exhaustive exploration
 
-重点记录是否找到目标、用了多少步，以及遇到新规则后如何调整。某次 LLM 很快成功，不代表它在所有地图上都更优；Q-learning 在熟悉地图上表现稳定，也不等于能直接适应新规则。比较时应保持地图分布与评估预算清楚。
+### What You'll See
 
-## 继续思考
+When running the LLM experiment, you'll see the **complete decision-making process**:
 
-如果把学到的经验从 LLM 上下文中删掉，和重置 Q 表，分别会消除什么能力？
+```
+============================================================
+LLM DECISION PROCESS
+============================================================
+📊 Experiences in memory: 15
+🎮 Current room: hallway
+🎯 Available actions: 8
 
-## 阅读代码与技术参考
+💡 Recent successful patterns learned:
+   • take red key → +5.0 reward
+   • try crafting → +10.0 reward
 
-沿下面的顺序阅读代码，可以把前面的概念与实现对应起来：[game_environment.py](https://github.com/bojieli/ai-agent-book/blob/main/chapter1/learning-from-experience/game_environment.py) → [rl_agent.py](https://github.com/bojieli/ai-agent-book/blob/main/chapter1/learning-from-experience/rl_agent.py) → [llm_agent.py](https://github.com/bojieli/ai-agent-book/blob/main/chapter1/learning-from-experience/llm_agent.py) → [experiment.py](https://github.com/bojieli/ai-agent-book/blob/main/chapter1/learning-from-experience/experiment.py)。
+🤔 LLM is thinking...
 
-原有说明保存在[技术参考](REFERENCE.md)中。需要查阅详细配置、英文材料或历史记录时，请从这里继续，并核对记录所使用的数据、模型与环境条件。
+📝 LLM Reasoning:
+----------------------------------------
+  Based on my past experiences, I've learned that:
+  1. The red key opens the locked door to the guard room
+  2. Crafting rusty sword + magic crystal creates a silver sword
+  3. The silver sword can defeat the strong guard
+  
+  Since I have the silver sword and I'm in the hallway...
+----------------------------------------
+
+✅ Chosen action: go north
+```
+
+This transparency shows exactly how the LLM learns and reasons, unlike the black-box nature of Q-learning.
+
+### The Game
+
+A text-based treasure hunt game where agents must:
+
+- Navigate through multiple rooms
+- Collect items and keys
+- Defeat guards using appropriate weapons
+- Discover hidden mechanics through experience
+
+#### Hidden Mechanics (Not Revealed to Agents)
+
+1. **Color-coded locks**: Specific colored keys open matching doors
+2. **Weapon effectiveness**: Different weapons work against different enemies
+3. **Crafting system**: Certain items combine to create better items
+4. **Potion effects**: Temporary abilities from consuming potions
+
+### Quick Start
+
+#### Installation
+
+```bash
+# Recommended from the repository root: use the shared Chapter 1 environment
+uv sync --locked --extra ch1
+
+# Activate it before changing directories:
+# macOS/Linux:
+source .venv/bin/activate
+# Windows PowerShell: .venv\Scripts\Activate.ps1
+# Windows cmd: .venv\Scripts\activate.bat
+
+# pip fallback when uv is not installed:
+# python -m pip install -e ".[ch1]"
+
+# Enter this experiment directory for the commands below
+cd chapter1/learning-from-experience
+
+# Single-project compatibility path, still supported during migration:
+# python -m pip install -r requirements.txt
+```
+
+- Q-learning runs
```

**File**: `chapter1/learning-from-experience/REFERENCE.md` (removed, +0/-755)
```diff
@@ -1,755 +0,0 @@
-# Learning from Experience: RL vs LLM In-Context Learning / 从经验中学习：RL 与 LLM 上下文学习对比
-
-> Compares tabular Q-learning with LLM in-context learning on a treasure-hunt game with hidden mechanics (Shunyu Yao, “The Second Half”).  
-> 代码位于第 1 章项目树；对应书中 **实验 8-1 ★（Q-learning 在寻宝游戏中的表现）** 与 **实验 8-2 ★★（传统 RL 与 LLM Agent 的对比研究）**。
-
-← [Chapter 1 index / 返回第 1 章目录](../README.md) · 📖 [Read Chapter 8 / 读第 8 章正文](../../book/chapter8.md)（[EN](../../book-en/chapter8.md)）
-
----
-
-## English
-
-### Overview
-
-This experiment compares traditional Reinforcement Learning (Q-learning) with LLM-based in-context learning, replicating the key insights from Shunyu Yao's blog post ["The Second Half"](https://ysymyth.github.io/The-Second-Half/).
-
-It demonstrates how LLMs can generalize through reasoning while traditional RL methods require extensive training to learn game mechanics. We use a text-based treasure hunt game with hidden mechanics that agents must discover through experience.
-
-### Key Insights Being Tested
-
-1. **Sample Efficiency**: LLMs can learn from far fewer examples than traditional RL
-2. **Generalization**: LLMs use reasoning to understand patterns, while RL memorizes state-action mappings
-3. **Prior Knowledge**: Language pre-training provides powerful priors for reasoning about new tasks
-4. **Hidden Mechanics Discovery**: LLMs can form hypotheses and test them, while RL requires exhaustive exploration
-
-### What You'll See
-
-When running the LLM experiment, you'll see the **complete decision-making process**:
-
-```
-============================================================
-LLM DECISION PROCESS
-============================================================
-📊 Experiences in memory: 15
-🎮 Current room: hallway
-🎯 Available actions: 8
-
-💡 Recent successful patterns learned:
-   • take red key → +5.0 reward
-   • try crafting → +10.0 reward
-
-🤔 LLM is thinking...
-
-📝 LLM Reasoning:
-----------------------------------------
-  Based on my past experiences, I've learned that:
-  1. The red key opens the locked door to the guard room
-  2. Crafting rusty sword + magic crystal creates a silver sword
-  3. The silver sword can defeat the strong guard
-  
-  Since I have the silver sword and I'm in the hallway...
-----------------------------------------
-
-✅ Chosen action: go north
-```
-
-This transparency shows exactly how the LLM learns and reasons, unlike the black-box nature of Q-learning.
-
-### The Game
-
-A text-based treasure hunt game where agents must:
-
-- Navigate through multiple rooms
-- Collect items and keys
-- Defeat guards using appropriate weapons
-- Discover hidden mechanics through experience
-
-#### Hidden Mechanics (Not Revealed to Agents)
-
-1. **Color-coded locks**: Specific colored keys open matching doors
-2. **Weapon effectiveness**: Different weapons work against different enemies
-3. **Crafting system**: Certain items combine to create better items
-4. **Potion effects**: Temporary abilities from consuming potions
-
-### Quick Start
-
-#### Installation
-
-```bash
-# Recommended from the repository root: use the shared Chapter 1 environment
-uv sync --locked --extra ch1
-
-# Activate it before changing directories:
-# macOS/Linux:
-source .venv/bin/activate
-# Windows PowerShell: .venv\Scripts\Activate.ps1
-# Windows cmd: .venv\Scripts\activate.bat
-
-# pip fallback when uv is not installed:
-# python -m pip install -e ".[ch1]"
-
-# Enter this experiment directory for the commands below
-cd chapter1/learning-from-experience
-
-# Single-project compatibility path, still supported during migration:
-# python -m pip install -r requirements.txt
-```
-
-- Q-learning runs fully offline with **no API key**.
-- The LLM path needs a Moonshot/Kimi API key (or OpenRouter fallback).
-
-#### Setting up Kimi K3 API
-
-To run the LLM experiments, you need a Kimi (Moonshot) API key:
-
-1. Get your API key from [Moonshot AI](https://platform.moonshot.cn/)
-2. Set the environment variable:
-
-```bash
-export LLM_PROVIDER="moonshot"  # or dashscope/qwen/bailian
-export MOONSHOT_API_KEY="your-api-key-here"
-# For Alibaba Cloud Model Studio / Bailian (Qwen), use:
-# export LLM_PROVIDER="dashscope"
-# export DASHSCOPE_API_KEY="your-dashscope-api-key-here"
-# export DASHSCOPE_MODEL="qwen3.7-plus"
-```
-
-Or create a `.env` file:
-
-```bash
-echo "MOONSHOT_API_KEY=your-api-key-here" > .env
-```
-
-**Universal OpenRouter fallback**: if `MOONSHOT_API_KEY` is unset but `OPENROUTER_API_KEY` is set, the LLM path routes through OpenRouter. Because Kimi models are not stably available on OpenRouter, the fallback uses `OPENROUTER_MODEL` (default `openai/gpt-5.6-luna`):
-
-```bash
-export OPENROUTER_API_KEY=your-openrouter-api-key
-python quick_demo.py   # runs via OpenRouter when MOONSHOT_API_KEY is missing
-```
-
-### Running the Experiment
-
-#### Quick Demo (See LLM Learning in Action)
-
-```bash
-python quick_demo.py
-```
-
-This shows a detailed view of how the LLM learns
```

---

### Incident Patch 2: `19fa4233` (2026-09-22)
**Commit Message**: docs(ch1): fix Harness emphasis rendering (#1136) (#1141)

Co-authored-by: Bojie Li <[REDACTED_EMAIL]>

**File**: `book/chapter1.md` (modified, +1/-1)
```diff
@@ -505,7 +505,7 @@ while true:
 
 ### Harness 五要素与「构建」部分的对应
 
-**先说清楚两个公式的关系，以免读者记住两套骨架。** 全书的结构骨架只有一个，就是引言和后记反复使用的 **Agent = LLM + 上下文 + 工具**：第二至六章讨论构建，第七至九章讨论评估与进化，第十章讨论协作。**Agent = Model + Harness** 不是与它并列的另一套划分，而是同一事物在生产形态下的展开——它把“上下文”和“工具”两项细分为上下文管理、工具接口、约束、验证、纠正五项职责，因此它是**“构建”这一部分内部的一个观察视角**，而不是覆盖全书十章的目录。
+**先说清楚两个公式的关系，以免读者记住两套骨架。** 全书的结构骨架只有一个，就是引言和后记反复使用的 **Agent = LLM + 上下文 + 工具**：第二至六章讨论构建，第七至九章讨论评估与进化，第十章讨论协作。**Agent = Model + Harness** 不是与它并列的另一套划分，而是同一事物在生产形态下的展开——它把“上下文”和“工具”两项细分为上下文管理、工具接口、约束、验证、纠正五项职责，因此，它是**构建部分内部的一个观察视角**，而不是覆盖全书十章的目录。
 
 在这个范围内，Harness 五要素与第二至五章有清晰的对应：
 
```

---

### Incident Patch 3: `59e00981` (2026-09-22)
**Commit Message**: fix(site): generate homepage chapter index from manuscripts (#1139)

* fix(site): generate homepage chapter cards from manuscripts (#1138)

* test(site): keep YAML-dependent audit in the docs environment

---------

Co-authored-by: Bojie Li <[REDACTED_EMAIL]>

**File**: `.github/workflows/deploy-pages.yml` (modified, +9/-0)
```diff
@@ -6,6 +6,11 @@ on:
   pull_request:
     paths:
       - ".github/workflows/deploy-pages.yml"
+      - "scripts/**"
+      - "tests/test_homepage_index.py"
+      - "index*.md"
+      - "mkdocs.yml"
+      - "extras/**"
       - "web-astro/**"
       - "book*/**"
       - "README*.md"
@@ -37,6 +42,10 @@ jobs:
           python-version: "3.11"
       - name: Install MkDocs Material
         run: pip install -r requirements-docs.txt
+      - name: Test homepage generation
+        run: |
+          pip install pytest
+          python -m pytest tests/test_homepage_index.py -q
       - name: Assemble docs
         run: bash scripts/build_site.sh
       - name: Build site
```

**File**: `docs/STATIC_SITE_I18N.md` (modified, +26/-0)
```diff
@@ -62,3 +62,29 @@ The check automatically discovers languages and named navigation entries from
 
 The `i18n consistency check` GitHub Actions workflow runs this audit whenever
 site configuration, translated books, navigation code, or the catalog changes.
+
+## Homepage chapter cards
+
+The `index.md` and `index.<language>.md` homepages are templates. Keep their
+`<!-- book-chapter-index -->` marker: `scripts/homepage_index.py` replaces it
+with chapter cards during every MkDocs build, including local previews.
+There is no generated index to commit or manually synchronize.
+
+The generator follows the chapter index paths in `mkdocs.yml`'s navigation,
+reads each edition's level-one manuscript heading for the card title, and
+uses its first three level-two headings as a short contents preview. It also
+includes the introduction, afterword, and reference answers. Code fences are
+excluded when reading headings. Language prefixes and filename suffixes come
+from `extra.languages`; translated homepages use relative links that work
+under the GitHub Pages repository subpath.
+
+To change a chapter title or its contents preview, edit the manuscript. To
+change the order of chapters, edit the navigation. Missing source files,
+missing titles, or duplicate chapter paths fail the build. The homepage
+regression tests run in the Pages PR workflow:
+
+```bash
+python -m pytest tests/test_homepage_index.py -q
+bash scripts/build_site.sh
+mkdocs build -d site
+```
```

**File**: `index.he.md` (modified, +1/-63)
```diff
@@ -28,69 +28,7 @@ description: ספר טכני פתוח על סוכני AI, הבנוי סביב ה
 
 ## מבט מהיר על הספר
 
-<div class="exp-grid" markdown>
-
-<a class="exp-card" href="../book-he/introduction.he/">
-<span class="exp-title">📖 הקדמה</span>
-<span class="exp-desc">מדוע נכתב הספר · כיצד עקרונות עיצוב טובים שורדים דורות של מודלים</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter1.he/">
-<span class="exp-title">🚀 פרק 1 · צעדים ראשונים עם סוכני AI</span>
-<span class="exp-desc">Agent = LLM + הקשר + כלים · הנדסת Harness כמקור ליתרון תחרותי</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter2.he/">
-<span class="exp-title">🎯 פרק 2 · הנדסת הקשר</span>
-<span class="exp-desc">KV Cache, הנדסת פרומפטים, Agent Skills ודחיסת הקשר</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter3.he/">
-<span class="exp-title">📚 פרק 3 · זיכרון משתמש ובסיס ידע</span>
-<span class="exp-desc">זיכרון בין מפגשים, RAG, אינדוקס מובנה וגרפי ידע</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter4.he/">
-<span class="exp-title">🛠️ פרק 4 · כלים</span>
-<span class="exp-desc">MCP, כלי תפיסה וביצוע, שיתוף פעולה וגילוי כלים</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter5.he/">
-<span class="exp-title">💻 פרק 5 · סוכן קוד ויצירת קוד</span>
-<span class="exp-desc">קוד ככלי שיוצר כלים חדשים · התמונה המלאה של סוכני קוד ברמת ייצור</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter6.he/">
-<span class="exp-title">🎙️ פרק 6 · אינטראקציה</span>
-<span class="exp-desc">אירועים אסינכרוניים, קול, Computer Use ורובוטיקה</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter7.he/">
-<span class="exp-title">🎯 פרק 7 · הערכת סוכנים</span>
-<span class="exp-desc">סביבות הערכה, מדדים, מובהקות סטטיסטית ובחירת מודלים</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter8.he/">
-<span class="exp-title">🧠 פרק 8 · אימון־על של מודלים</span>
-<span class="exp-desc">אימון ביניים, SFT ו־RL · הפיכת אותות משוב ליכולות מודל</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter9.he/">
-<span class="exp-title">🔄 פרק 9 · התפתחות מתמשכת של סוכנים</span>
-<span class="exp-desc">הפקת אותות למידה ממסלולים ועדכון ידע, הוראות, תוכנות ופרמטרים</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter10.he/">
-<span class="exp-title">🤝 פרק 10 · שיתוף פעולה רב־סוכני</span>
-<span class="exp-desc">מסגרות שיתוף פעולה, שיתוף והפרדת הקשר וחברות של סוכנים</span>
-</a>
-
-<a class="exp-card" href="../book-he/afterword.he/">
-<span class="exp-title">📝 אחרית דבר</span>
-<span class="exp-desc">האם מודלים יאכלו את ה־Harness? תשובה מלאה ומבט קדימה</span>
-</a>
-
-</div>
+<!-- book-chapter-index -->
 
 ---
 
```

**File**: `index.ko.md` (modified, +1/-63)
```diff
@@ -28,69 +28,7 @@ description: 핵심 공식 Agent = LLM + 컨텍스트 + 도구를 중심으로,
 
 ## 한눈에 보는 구성
 
-<div class="exp-grid" markdown>
-
-<a class="exp-card" href="../book-ko/introduction.ko/">
-<span class="exp-title">📖 들어가며</span>
-<span class="exp-desc">왜 이 책을 썼는가 · 좋은 설계 원칙은 어떻게 모델 세대 교체를 넘어서는가</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter1.ko/">
-<span class="exp-title">🚀 제1장 · AI 에이전트 기초</span>
-<span class="exp-desc">Agent = LLM + 컨텍스트 + 도구 · 경쟁력의 핵심은 하네스 엔지니어링</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter2.ko/">
-<span class="exp-title">🎯 제2장 · 컨텍스트 엔지니어링</span>
-<span class="exp-desc">컨텍스트가 능력의 상한을 결정 · KV Cache, 프롬프트 엔지니어링, Agent Skills, 컨텍스트 압축</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter3.ko/">
-<span class="exp-title">📚 제3장 · 사용자 메모리와 지식 베이스</span>
-<span class="exp-desc">세션을 넘어 사용자를 기억하고 외부 지식을 연결 · 사용자 메모리, RAG, 구조화 색인, 지식 그래프</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter4.ko/">
-<span class="exp-title">🛠️ 제4장 · 도구</span>
-<span class="exp-desc">도구는 에이전트의 두 손 · MCP 프로토콜, 인식·실행·협업 세 종류의 도구, 비동기 에이전트</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter5.ko/">
-<span class="exp-title">💻 제5장 · 코딩 에이전트와 코드 생성</span>
-<span class="exp-desc">코드는 '새 도구를 만들 수 있는 도구' · 프로덕션급 코딩 에이전트의 전체 그림</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter6.ko/">
-<span class="exp-title">🎯 제6장 · 에이전트 평가</span>
-<span class="exp-desc">성능을 비교 가능한 신호로 · 평가 환경, 지표, 통계적 유의성</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter7.ko/">
-<span class="exp-title">🧠 제7장 · 모델 사후 학습</span>
-<span class="exp-desc">SFT와 강화 학습 · 하네스에 쌓인 피드백 신호를 모델 파라미터에 기록</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter8.ko/">
-<span class="exp-title">🌱 제8장 · 에이전트의 지속적 진화</span>
-<span class="exp-desc">신뢰할 수 있는 학습 신호에서 지식·지침·프로그램·파라미터 갱신까지</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter9.ko/">
-<span class="exp-title">🎙️ 제9장 · 멀티모달과 실시간 상호작용</span>
-<span class="exp-desc">음성 에이전트, Computer Use, 로봇 조작</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter10.ko/">
-<span class="exp-title">🤝 제10장 · 멀티 에이전트 협업</span>
-<span class="exp-desc">협업 아키텍처, 실패 유형, 에이전트 사회</span>
-</a>
-
-<a class="exp-card" href="../book-ko/afterword.ko/">
-<span class="exp-title">📝 후기</span>
-<span class="exp-desc">모델이 하네스를 삼키게 될까? 완전한 답과 전망</span>
-</a>
-
-</div>
+<!-- book-chapter-index -->
 
 ---
 
```

**File**: `index.md` (modified, +1/-63)
```diff
@@ -28,69 +28,7 @@ description: 围绕核心公式 Agent = LLM + 上下文 + 工具,用 10 章把 A
 
 ## 章节速览
 
-<div class="exp-grid" markdown>
-
-<a class="exp-card" href="book/introduction/">
-<span class="exp-title">📖 引言</span>
-<span class="exp-desc">为什么写这本书 · 好的设计原则如何穿越模型迭代周期</span>
-</a>
-
-<a class="exp-card" href="book/chapter1/">
-<span class="exp-title">🚀 第 1 章 · Agent 基础知识</span>
-<span class="exp-desc">Agent = LLM + 上下文 + 工具；Harness 工程才是竞争力</span>
-</a>
-
-<a class="exp-card" href="book/chapter2/">
-<span class="exp-title">🎯 第 2 章 · 上下文工程</span>
-<span class="exp-desc">上下文决定能力上限:KV Cache、提示工程、Agent Skills、上下文压缩</span>
-</a>
-
-<a class="exp-card" href="book/chapter3/">
-<span class="exp-title">📚 第 3 章 · 用户记忆和知识库</span>
-<span class="exp-desc">跨会话记住用户、接入外部知识:用户记忆、RAG、结构化索引、知识图谱</span>
-</a>
-
-<a class="exp-card" href="book/chapter4/">
-<span class="exp-title">🛠️ 第 4 章 · 工具</span>
-<span class="exp-desc">工具是 Agent 的双手:MCP 协议、感知/执行/协作三类工具、异步 Agent</span>
-</a>
-
-<a class="exp-card" href="book/chapter5/">
-<span class="exp-title">💻 第 5 章 · Coding Agent 与代码生成</span>
-<span class="exp-desc">代码是「能创造新工具的工具」,生产级 Coding Agent 全景</span>
-</a>
-
-<a class="exp-card" href="book/chapter6/">
-<span class="exp-title">🎯 第 6 章 · Agent 的评估</span>
-<span class="exp-desc">把表现变成可比较信号:评估环境、指标、统计显著性</span>
-</a>
-
-<a class="exp-card" href="book/chapter7/">
-<span class="exp-title">🧠 第 7 章 · 模型后训练</span>
-<span class="exp-desc">SFT、强化学习——把 Harness 中积累的反馈信号写入模型参数</span>
-</a>
-
-<a class="exp-card" href="book/chapter8/">
-<span class="exp-title">🌱 第 8 章 · Agent 的持续进化</span>
-<span class="exp-desc">从可靠学习信号到知识、指令、程序与参数更新</span>
-</a>
-
-<a class="exp-card" href="book/chapter9/">
-<span class="exp-title">🎙️ 第 9 章 · 多模态与实时交互</span>
-<span class="exp-desc">语音 Agent、Computer Use、机器人操作</span>
-</a>
-
-<a class="exp-card" href="book/chapter10/">
-<span class="exp-title">🤝 第 10 章 · 多 Agent 协作</span>
-<span class="exp-desc">协作架构、失败模式、Agent 社会</span>
-</a>
-
-<a class="exp-card" href="book/afterword/">
-<span class="exp-title">📝 后记</span>
-<span class="exp-desc">模型会不会吃掉 Harness?完整答案与展望</span>
-</a>
-
-</div>
+<!-- book-chapter-index -->
 
 ---
 
```

**File**: `index.ptbr.md` (modified, +1/-68)
```diff
@@ -28,74 +28,7 @@ description: Livro técnico aberto sobre agentes de IA, organizado em torno da f
 
 ## Visão geral do livro
 
-<div class="exp-grid" markdown>
-
-<a class="exp-card" href="../book-ptbr/introduction.ptbr/">
-<span class="exp-title">📖 Introdução</span>
-<span class="exp-desc">Por que este livro foi escrito · como bons princípios de design atravessam gerações de modelos</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/chapter1.ptbr/">
-<span class="exp-title">🚀 Capítulo 1 · Primeiros passos com agentes de IA</span>
-<span class="exp-desc">Agente = LLM + Contexto + Ferramentas · engenharia de Harness como fonte de vantagem competitiva</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/chapter2.ptbr/">
-<span class="exp-title">🎯 Capítulo 2 · Engenharia de contexto</span>
-<span class="exp-desc">Cache KV, engenharia de prompts, Agent Skills e compressão de contexto</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/chapter3.ptbr/">
-<span class="exp-title">📚 Capítulo 3 · Memória do usuário e base de conhecimento</span>
-<span class="exp-desc">Memória entre sessões, RAG, indexação estruturada e grafos de conhecimento</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/chapter4.ptbr/">
-<span class="exp-title">🛠️ Capítulo 4 · Ferramentas</span>
-<span class="exp-desc">MCP, ferramentas de percepção e execução, colaboração e descoberta de ferramentas</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/chapter5.ptbr/">
-<span class="exp-title">💻 Capítulo 5 · Agente de código e geração de código</span>
-<span class="exp-desc">Código como ferramenta capaz de criar novas ferramentas · panorama de agentes de código em produção</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/chapter6.ptbr/">
-<span class="exp-title">🎙️ Capítulo 6 · Interação</span>
-<span class="exp-desc">Eventos assíncronos, voz, Computer Use e robótica</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/chapter7.ptbr/">
-<span class="exp-title">📊 Capítulo 7 · Avaliação de agentes</span>
-<span class="exp-desc">Ambientes de avaliação, métricas, significância estatística e seleção de modelos</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/chapter8.ptbr/">
-<span class="exp-title">🧠 Capítulo 8 · Pós-treinamento de modelos</span>
-<span class="exp-desc">Mid-training, SFT e RL · transformação de sinais de feedback em capacidades do modelo</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/chapter9.ptbr/">
-<span class="exp-title">🔄 Capítulo 9 · Evolução contínua de agentes</span>
-<span class="exp-desc">Extração de sinais de aprendizagem das trajetórias e atualização de conhecimento, instruções, programas e parâmetros</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/chapter10.ptbr/">
-<span class="exp-title">🤝 Capítulo 10 · Colaboração multiagente</span>
-<span class="exp-desc">Arquiteturas de colaboração, compartilhamento e separação de contexto e sociedades de agentes</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/afterword.ptbr/">
-<span class="exp-title">📝 Posfácio</span>
-<span class="exp-desc">Os modelos substituirão o Harness? Resposta completa e perspectivas futuras</span>
-</a>
-
-<a class="exp-card" href="../book-ptbr/reference-answers.ptbr/">
-<span class="exp-title">✅ Respostas das questões de reflexão</span>
-<span class="exp-desc">Respostas de referência para as questões apresentadas ao final dos capítulos</span>
-</a>
-
-</div>
+<!-- book-chapter-index -->
 
 ---
 
```

**File**: `mkdocs.yml` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ docs_dir: _web
 # Strip Pandoc/LaTeX attributes the source Markdown uses (e.g. `{.unnumbered}`,
 # `{#sec:foo}`, image `{height=55%}`) which Python-Markdown cannot parse.
 hooks:
+  - scripts/homepage_index.py
   # `_web/` is an ignored staging tree, so map each staged page back to its
   # tracked source before the revision-date plugin asks Git for timestamps.
   - scripts/git_revision_dates.py
```

**File**: `scripts/homepage_index.py` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+"""Generate homepage chapter cards from the manuscripts during MkDocs builds."""
+from __future__ import annotations
+
+import html
+from html.parser import HTMLParser
+from pathlib import Path
+import re
+
+import markdown as md
+
+MARKER = "<!-- book-chapter-index -->"
+
+
+class PlainText(HTMLParser):
+    def __init__(self):
+        super().__init__()
+        self.parts = []
+
+    def handle_data(self, data):
+        self.parts.append(data)
+
+
+def heading_text(value: str) -> str:
+    value = re.sub(r"\s*\{[^}]*\}\s*$", "", value)
+    parser = PlainText()
+    parser.feed(md.markdown(value))
+    return "".join(parser.parts).strip()
+
+
+def read_headings(source: Path) -> tuple[str, list[str]]:
+    """Read real headings, excluding heading-like lines in fenced examples."""
+    title = None
+    sections = []
+    fence = None
+    for line in source.read_text(encoding="utf-8").splitlines():
+        match = re.match(r"^\s{0,3}(`{3,}|~{3,})", line)
+        if match:
+            run = match[1]
+            if fence is None:
+                fence = run
+            elif run[0] == fence[0] and len(run) >= len(fence) and not line.strip()[len(run):].strip():
+                fence = None
+            continue
+        if fence:
+            continue
+        match = re.match(r"^(#{1,2})\s+(.+?)(?:\s+#+)?\s*$", line)
+        if match:
+            text = heading_text(match[2])
+            if match[1] == "#" and title is None:
+                title = text
+            elif match[1] == "##" and len(sections) < 3:
+                sections.append(text)
+    if not title:
+        raise ValueError(f"Homepage source has no level-one heading: {source}")
+    return title, sections
+
+
+def chapter_order(nav: list) -> list[str]:
+    chapters = []
+
+    def visit(item):
+        if isinstance(item, str):
+            match = re.fullmatch(r"book/(chapter\d+)/(?:index\.md)", item)
+            if match:
+                chapters.append(match[1])
+        elif isinstance(item, dict):
+            for value in item.values():
+                visit(value)
+        elif isinstance(item, list):
+            for value in item:
+                visit(value)
+
+    visit(nav)
+    if not chapters or len(set(chapters)) != len(chapters):
+        raise ValueError("Homepage requires unique chapter index paths in the MkDocs navigation")
+    return chapters
+
+
+def render_cards(root: Path, language: dict, chapters: list[str], *, translated: bool) -> str:
+    prefix = language["prefix"].rstrip("/")
+    suffix = language.get("suffix", "")
+    relative = "../" if translated else ""
+    cards = []
+    for slug in ["introduction", *chapters, "afterword", "reference-answers"]:
+        title, sections = read_headings(root / prefix / f"{slug}{suffix}.md")
+        number = slug.removeprefix("chapter") if slug.startswith("chapter") else ""
+        label = f"{number} · {title}" if number else title
+        href = f"{relative}{prefix}/{slug}{suffix}/"
+        description = " · ".join(sections)
+        card = (f'<a class="exp-card" href="{html.escape(href, quote=True)}">\n'
+                f'<span class="exp-title">{html.escape(label)}</span>\n')
+        if description:
+            card += f'<span class="exp-desc">{html.escape(description)}</span>\n'
+        cards.append(card + "</a>")
+    return '<div class="exp-grid">\n\n' + "\n\n".join(cards) + "\n\n</div>"
+
+
+def on_page_markdown(markdown: str, page, config, **kwargs):
+    """Expand the homepage template; never rewrite checked-in source files."""
+    if MARKER not in markdown:
+        return markdown
+    source = page.file.src_uri
+    match = re.fullmatch(r"index(?:\.([\w-]+))?\.md", source)
+    if not match or markdown.count(MARKER) != 1:
+        raise ValueError(f"Unexpected homepage marker in {source}")
+    code = match[1] or "zh"
+    root = Path(config["config_file_path"]).resolve().parent
+    cards = render_cards(root, config["extra"]["languages"][code],
+                         chapter_order(config["nav"]), translated=bool(match[1]))
+    return markdown.replace(MARKER, cards)
```

---

### Incident Patch 4: `873a20ce` (2026-09-20)
**Commit Message**: test: add regression check for fig0-1 overview figure chapter numbers (#1132)

**File**: `tests/test_chapter_numbering_consistency.py` (modified, +23/-1)
```diff
@@ -6,9 +6,9 @@
 
 from __future__ import annotations
 
+import html
 from pathlib import Path
 
-
 ROOT = Path(__file__).resolve().parents[1]
 
 CHAPTERS = {
@@ -137,3 +137,25 @@ def test_chapter_overviews_do_not_link_obsolete_run_ids():
         content = read(path)
         for fragment in fragments:
             assert fragment not in content, (path, fragment)
+
+
+def test_introduction_overview_figure_uses_current_chapter_numbers():
+    """fig0-1 must agree with fig0-2 on where each chapter sits.
+
+    The figure was corrected in #1111 (issue #1079); this locks the 2.0
+    numbering in so the stale 1.4 numbers cannot drift back unnoticed.
+    fig0-1 stores its text as numeric character references, so it is
+    unescaped before matching.
+    """
+    overview_figure = html.unescape(read("book/images/fig0-1.svg"))
+
+    assert "第 7 章 评估" in overview_figure
+    assert "第 8 章 后训练" in overview_figure
+    assert "第 6 章 交互" in overview_figure
+    assert "第 9 章 持续进化" in overview_figure
+    assert "第 10 章 多 Agent" in overview_figure
+
+    assert "第 6 章 评估" not in overview_figure
+    assert "第 7 章 后训练" not in overview_figure
+    assert "第 8 章 自我进化" not in overview_figure
+    assert "第 9 章 多模态" not in overview_figure
```

---

### Incident Patch 5: `43bcb4d5` (2026-09-19)
**Commit Message**: docs(ch8): reword the mid-training 'too late' sentence to remove ambiguity (#1086) (#1125)

* docs(ch8): reword the mid-training 'too late' sentence to remove ambiguity (#1086)

Chinese source and English edition. Translations follow in the same PR.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

* docs(ch8): sync the reworded mid-training sentence to all 13 translations

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

---------

Co-authored-by: Bojie Li <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `book-ar/chapter8.ar.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@
 
 ### جوهر Mid-training: مواصلة التعلم على التوزيع المستهدف
 
-لا يغطي التدريب المسبق العام كل لغة ومجال وقدرة. فإذا كان النموذج بالكاد يقرأ اللغة المستهدفة، أو يجهل بروتوكولات المؤسسة، أو لم يكوّن تمثيلات الكود والسياق الطويل اللازمة، فلا يكفي تعليمه شكل الإجابة أو منحه مكافأة نجاح/فشل. يحافظ Mid-training على هدف الرمز التالي، لكنه يركز توزيع البيانات على المجال المستهدف ويخلط بيانات عامة للحد من النسيان. والسؤال الذي يجيب عنه هو: هل لدى النموذج المعرفة والقدرات الأساسية للمهمة؟ لا: كيف تبدو الإجابة أو أي سياسة تحقق أعلى مكافأة؟
+لا يغطي التدريب المسبق العام كل لغة ومجال وقدرة. فإذا كان النموذج بالكاد يقرأ اللغة المستهدفة، أو يجهل بروتوكولات المؤسسة، أو لم يكوّن تمثيلات الكود والسياق الطويل اللازمة، فإن تجاوز هذه المرحلة والانتقال مباشرةً إلى تعليمه شكل الإجابة أو منحه مكافأة نجاح/فشل فقط لن يسدّ هذه القدرات الأساسية المفقودة. يحافظ Mid-training على هدف الرمز التالي، لكنه يركز توزيع البيانات على المجال المستهدف ويخلط بيانات عامة للحد من النسيان. والسؤال الذي يجيب عنه هو: هل لدى النموذج المعرفة والقدرات الأساسية للمهمة؟ لا: كيف تبدو الإجابة أو أي سياسة تحقق أعلى مكافأة؟
 
 تبدو دالةُ الخسارة في Mid-training شبيهةً جدًّا بنظيرتها في SFT، غير أن تنظيم البيانات وكثافة الإشراف مختلفان: فالأول يجعل الوثيقة أو الشيفرة أو الاشتقاق كلَّه هدفًا للتعلّم، ويحسب الخسارة على عدد كبير من الرموز؛ أما الثاني فينظّم البيانات في صورة عروضٍ من مدخل ومخرج، ولا يحسب الخسارة عادةً إلا على رموز الإجابة. ولذلك فإن حشو النموذج بجملة من الحقائق عبر عدد قليل من أزواج الأسئلة والأجوبة ليس مستحيلًا تقنيًّا، لكنه لا يعزّز إلا مساراتِ وصولٍ قليلة معادة، فيسهل أن يحفظ النموذجُ صيغةَ السؤال دون أن تتكوّن لديه معرفةٌ واسعةُ الاستدعاء. فإذا احتجتَ إلى استيعاب معرفةٍ مجاليةٍ واسعةٍ يشدّ بعضُها بعضًا، فقدِّم Mid-training؛ وإذا احتجتَ إلى معرفةٍ قابلةٍ للتحديث والتتبّع، فقدِّم RAG.
 
```

**File**: `book-en/chapter8.md` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ After pre-training, the model is erudite but not user-friendly: if you ask it a
 
 ### The Essence of Mid-training: Continue Learning on the Target Distribution
 
-General pre-training cannot cover every language, domain, and capability. If a model can barely read Korean documents, does not understand an enterprise's internal protocols, or has never formed the code and long-context representations required by the target task, it is too late to teach only "how to answer" or reward only success and failure. Mid-training retains pre-training's next-token objective but narrows the data distribution to the target domain and mixes in general retention data to control forgetting. It asks whether the model possesses the knowledge and foundational capabilities needed to complete the task—not what the response should look like or which policy earns the highest reward.
+General pre-training cannot cover every language, domain, and capability. If a model can barely read Korean documents, does not understand an enterprise's internal protocols, or has never formed the code and long-context representations required by the target task, skipping this stage and jumping straight to teaching it "how to answer" or rewarding only success and failure cannot fill in those missing foundational capabilities. Mid-training retains pre-training's next-token objective but narrows the data distribution to the target domain and mixes in general retention data to control forgetting. It asks whether the model possesses the knowledge and foundational capabilities needed to complete the task—not what the response should look like or which policy earns the highest reward.
 
 Mid-training and SFT may appear to use similar loss functions, but their data organization and supervision density differ. Mid-training usually treats whole documents, code, or derivations as learning targets and computes loss over many tokens. SFT organizes data as input-output demonstrations and usually computes loss only on response tokens. It is technically possible to make a model memorize some facts through a small question-answer SFT set, but this repeatedly reinforces only a few access paths: the model may memorize the questions without forming broadly accessible knowledge. Prefer Mid-training when absorbing large, interconnected bodies of domain knowledge; prefer RAG when the knowledge must remain updateable and traceable.
 
```

**File**: `book-es/chapter8.es.md` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ Tras el pre-entrenamiento, el modelo es erudito pero poco práctico: si le formu
 
 ### La esencia de Mid-training: seguir aprendiendo en la distribución objetivo
 
-El pre-entrenamiento general no cubre todos los idiomas, dominios y capacidades. Si el modelo apenas entiende documentos coreanos, protocolos internos o las representaciones de código y contexto largo que exige la tarea, enseñar solo «cómo responder» o premiar éxito y fracaso llega demasiado tarde. Mid-training conserva el objetivo de siguiente token, concentra los datos en el dominio objetivo y mezcla datos generales de retención. Responde a si el modelo posee el conocimiento y las capacidades básicas, no a cómo debe verse la respuesta ni qué política recibe más recompensa.
+El pre-entrenamiento general no cubre todos los idiomas, dominios y capacidades. Si el modelo apenas entiende documentos coreanos, protocolos internos o las representaciones de código y contexto largo que exige la tarea, saltarse esta etapa y pasar directamente a enseñarle «cómo responder» o a premiar solo éxito y fracaso no puede suplir esas capacidades básicas que faltan. Mid-training conserva el objetivo de siguiente token, concentra los datos en el dominio objetivo y mezcla datos generales de retención. Responde a si el modelo posee el conocimiento y las capacidades básicas, no a cómo debe verse la respuesta ni qué política recibe más recompensa.
 
 Las funciones de pérdida del Mid-training y del SFT se parecen mucho, pero difieren en la organización de los datos y en la densidad de supervisión: el primero suele tomar como objetivo de aprendizaje documentos, código o derivaciones enteros, y calcula la pérdida sobre gran cantidad de tokens; el segundo organiza los datos como demostraciones de entrada-salida y normalmente calcula la pérdida solo sobre los tokens de la respuesta. Por eso, hacer que el modelo memorice un conjunto de hechos mediante SFT con unos pocos pares de preguntas y respuestas no es técnicamente imposible, pero eso solo refuerza repetidamente unas pocas rutas de acceso: es fácil que memorice la formulación de la pregunta sin llegar a formar un conocimiento ampliamente invocable. Cuando hace falta absorber conocimiento de dominio a gran escala e interrelacionado, conviene dar prioridad al Mid-training; cuando el conocimiento debe poder actualizarse y rastrearse, la prioridad es RAG.
 
```

**File**: `book-he/chapter8.he.md` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@
 
 ### מהות אימון הביניים: המשך למידה על התפלגות היעד
 
-אימון מקדים כללי אינו יכול לכסות כל שפה, תחום ויכולת. אם מודל בקושי קורא מסמכים בקוריאנית, אינו מבין את הפרוטוקולים הפנימיים של ארגון, או מעולם לא יצר את ייצוגי הקוד וההקשר הארוך שמשימת היעד דורשת, מאוחר מדי ללמד רק "כיצד לענות" או לתגמל רק הצלחה וכישלון. אימון הביניים משמר את מטרת הטוקן הבא של האימון המקדים אך מצמצם את התפלגות הנתונים לתחום היעד, ומערבב פנימה נתונים כלליים לשימור כדי לשלוט בשכחה. הוא שואל האם למודל יש את הידע ואת יכולות היסוד הדרושים להשלמת המשימה — לא כיצד התשובה צריכה להיראות ולא איזו מדיניות זוכה לתגמול הגבוה ביותר.
+אימון מקדים כללי אינו יכול לכסות כל שפה, תחום ויכולת. אם מודל בקושי קורא מסמכים בקוריאנית, אינו מבין את הפרוטוקולים הפנימיים של ארגון, או מעולם לא יצר את ייצוגי הקוד וההקשר הארוך שמשימת היעד דורשת, דילוג על שלב זה ומעבר ישר ללימוד "כיצד לענות" או לתגמול על הצלחה וכישלון בלבד אינו יכול להשלים את יכולות היסוד החסרות הללו. אימון הביניים משמר את מטרת הטוקן הבא של האימון המקדים אך מצמצם את התפלגות הנתונים לתחום היעד, ומערבב פנימה נתונים כלליים לשימור כדי לשלוט בשכחה. הוא שואל האם למודל יש את הידע ואת יכולות היסוד הדרושים להשלמת המשימה — לא כיצד התשובה צריכה להיראות ולא איזו מדיניות זוכה לתגמול הגבוה ביותר.
 
 אימון ביניים ו‑SFT עשויים להיראות כמשתמשים בפונקציות הפסד דומות, אך ארגון הנתונים וצפיפות הפיקוח שלהם שונים. אימון ביניים מתייחס בדרך כלל למסמכים שלמים, לקוד או לגזירות כאל יעדי למידה ומחשב הפסד על טוקנים רבים. ‏SFT מארגן נתונים כהדגמות קלט‑פלט ומחשב בדרך כלל הפסד רק על טוקני התשובה. טכנית ניתן לגרום למודל לשנן עובדות מסוימות באמצעות מערך שאלות‑תשובות קטן ב‑SFT, אך הדבר מחזק שוב ושוב רק כמה נתיבי גישה: המודל עלול לשנן את השאלות מבלי ליצור ידע נגיש באופן רחב. העדיפו אימון ביניים בעת ספיגת גופי ידע תחומיים גדולים ומקושרים; העדיפו RAG כשהידע חייב להישאר בר‑עדכון ובר‑מעקב.
 
```

**File**: `book-hu/chapter8.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ A pre-tréning után a modell tudós, de nem felhasználóbarát: ha felteszel n
 
 ### A Mid-training lényege: továbbtanulás a céleloszláson
 
-Az általános pre-tréning nem fedhet le minden nyelvet, szakterületet és képességet. Ha a modell alig olvassa a célnyelvet, nem ismeri a belső protokollt, vagy még nincs megfelelő reprezentációja hosszú kontextushoz és kódhoz, már késő csak a válaszformátumot vagy a siker/kudarc jutalmát tanítani. A Mid-training megtartja a következő-token célt, a célterületre szűkíti az adateloszlást, és általános adatot kever be a felejtés ellen. Azt kérdezi, megvan-e a feladathoz szükséges tudás és alapképesség, nem azt, hogyan nézzen ki a válasz vagy melyik stratégia kapja a legtöbb jutalmat.
+Az általános pre-tréning nem fedhet le minden nyelvet, szakterületet és képességet. Ha a modell alig olvassa a célnyelvet, nem ismeri a belső protokollt, vagy még nincs megfelelő reprezentációja hosszú kontextushoz és kódhoz, e lépés kihagyásával, csak a válaszformátum tanításával vagy a siker/kudarc jutalmazásával nem pótolhatók ezek a hiányzó alapképességek. A Mid-training megtartja a következő-token célt, a célterületre szűkíti az adateloszlást, és általános adatot kever be a felejtés ellen. Azt kérdezi, megvan-e a feladathoz szükséges tudás és alapképesség, nem azt, hogyan nézzen ki a válasz vagy melyik stratégia kapja a legtöbb jutalmat.
 
 A Mid-training és az SFT veszteségfüggvénye nagyon hasonlónak látszik, de az adatszervezés és a felügyelet sűrűsége eltér: az előbbi rendszerint egész dokumentumokat, kódrészleteket vagy levezetéseket vesz tanulási célnak, és nagyszámú tokenre számol veszteséget; az utóbbi bemenet–kimenet demonstrációkká szervezi az adatot, és a veszteséget általában csak a válasz tokenjeire számolja. Ezért technikailag nem lehetetlen kevés kérdés-felelet párral SFT útján bemagoltatni egy csomó tényt, csakhogy ez mindig ugyanazt a néhány hozzáférési útvonalat erősíti: a modell könnyen a kérdés megfogalmazását jegyzi meg ahelyett, hogy széles körben előhívható tudás alakulna ki benne. Ha nagy terjedelmű, egymással összefüggő szakterületi tudást kell felszívni, a Mid-training az elsődleges; ha a tudásnak frissíthetőnek és visszakövethetőnek kell lennie, a RAG.
 
```

**File**: `book-id/chapter8.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ Setelah pre-training, model menjadi sangat berpengetahuan tetapi tidak user-frie
 
 ### Esensi Mid-training: Melanjutkan Belajar pada Distribusi Target
 
-Pre-training umum tidak mungkin mencakup setiap bahasa, domain, dan kapabilitas. Bila model hampir tidak dapat membaca bahasa target, tidak memahami protokol internal, atau belum membentuk representasi kode dan konteks panjang yang dibutuhkan tugas, mengajarkan format jawaban atau memberi reward sukses/gagal saja sudah terlambat. Mid-training mempertahankan tujuan next-token tetapi memusatkan distribusi data pada domain target dan mencampur data umum untuk mengendalikan lupa. Ia menjawab apakah model memiliki pengetahuan dan kapabilitas dasar untuk mengerjakan tugas, bukan bagaimana respons harus terlihat atau policy mana yang mendapat reward tertinggi.
+Pre-training umum tidak mungkin mencakup setiap bahasa, domain, dan kapabilitas. Bila model hampir tidak dapat membaca bahasa target, tidak memahami protokol internal, atau belum membentuk representasi kode dan konteks panjang yang dibutuhkan tugas, melewati tahap ini dan langsung mengajarkan format jawaban atau memberi reward sukses/gagal saja tidak dapat menutup kapabilitas dasar yang hilang itu. Mid-training mempertahankan tujuan next-token tetapi memusatkan distribusi data pada domain target dan mencampur data umum untuk mengendalikan lupa. Ia menjawab apakah model memiliki pengetahuan dan kapabilitas dasar untuk mengerjakan tugas, bukan bagaimana respons harus terlihat atau policy mana yang mendapat reward tertinggi.
 
 Fungsi kerugian Mid-training dan SFT tampak sangat mirip, tetapi organisasi data dan kerapatan supervisinya berbeda: yang pertama biasanya menjadikan seluruh dokumen, kode, atau penurunan rumus sebagai target belajar dan menghitung kerugian atas sejumlah besar token; yang kedua menyusun data menjadi demonstrasi masukan–keluaran dan umumnya hanya menghitung kerugian pada token jawaban. Karena itu, menjejalkan sekumpulan fakta lewat SFT dengan sedikit pasangan tanya-jawab secara teknis bukan mustahil, tetapi cara itu hanya berulang kali memperkuat segelintir jalur akses, sehingga model mudah menghafal cara bertanya alih-alih membentuk pengetahuan yang luas dan mudah dipanggil. Bila perlu menyerap pengetahuan domain berskala besar yang saling terkait, dahulukan Mid-training; bila pengetahuan perlu dapat diperbarui dan dilacak, dahulukan RAG.
 
```

**File**: `book-ja/chapter8.ja.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@
 
 ### Mid-training の本質：対象分布で学習を続ける
 
-汎用の事前学習だけでは、あらゆる言語、専門分野、能力を十分に網羅できません。対象言語をほとんど読めず、社内プロトコルを知らず、長文やコードに必要な表現すら形成されていないモデルに、回答形式だけを教えたり成否だけを報酬として与えたりしても遅すぎます。Mid-training は次 token 予測を保ったままデータ分布を対象領域へ寄せ、一般データも混ぜて忘却を抑えます。問うのは「タスクを解く知識と基礎能力があるか」であり、「どう答えるか」や「どの方策が高報酬か」ではありません。
+汎用の事前学習だけでは、あらゆる言語、専門分野、能力を十分に網羅できません。対象言語をほとんど読めず、社内プロトコルを知らず、長文やコードに必要な表現すら形成されていないモデルに対して、この段階を飛ばして回答形式だけを教えたり成否だけを報酬として与えたりしても、欠けている基礎能力は補えません。Mid-training は次 token 予測を保ったままデータ分布を対象領域へ寄せ、一般データも混ぜて忘却を抑えます。問うのは「タスクを解く知識と基礎能力があるか」であり、「どう答えるか」や「どの方策が高報酬か」ではありません。
 
 Mid-training と SFT の損失関数はよく似て見えますが、データの組み立て方と監督の密度が異なります。前者は通常、文書やコード、導出の全体を学習目標とし、大量の token に対して損失を計算します。後者はデータを入力—出力の実演として組み立て、通常は回答部分の token にのみ損失を計算します。したがって、少量の問答で SFT を行い一群の事実を暗記させることは技術的に不可能ではありませんが、それはごく少数のアクセス経路を繰り返し強化するだけであり、問い方を覚えても広く呼び出せる知識にはなりにくいのです。大規模で互いに関連し合う領域知識を吸収させたいときは Mid-training を優先し、知識を更新可能・追跡可能にしたいときは RAG を優先します。
 
```

**File**: `book-ko/chapter8.ko.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ SFT와 RL까지 줄곧 이어지는 핵심 사항이 있습니다. **모델의 
 
 ### Mid-training의 본질: 대상 분포에서 학습 계속하기
 
-범용 사전 학습은 모든 언어, 도메인, 역량을 충분히 덮을 수 없습니다. 대상 언어를 거의 읽지 못하고 사내 프로토콜을 모르며 긴 문맥이나 코드에 필요한 표현조차 형성하지 못한 모델에는 답변 형식이나 성공·실패 보상만 가르쳐서는 부족합니다. Mid-training은 다음 토큰 예측 목표를 유지하되 데이터 분포를 대상 도메인으로 좁히고 일반 보존 데이터를 섞어 망각을 제어합니다. 이는 “과제를 풀 지식과 기초 역량이 있는가”를 다루며, “어떻게 답할까”나 “어떤 정책의 보상이 높은가”를 다루지 않습니다.
+범용 사전 학습은 모든 언어, 도메인, 역량을 충분히 덮을 수 없습니다. 대상 언어를 거의 읽지 못하고 사내 프로토콜을 모르며 긴 문맥이나 코드에 필요한 표현조차 형성하지 못한 모델에는 이 단계를 건너뛰고 곧바로 답변 형식만 가르치거나 성공·실패 보상만 주어서는 그 빠진 기초 역량을 채울 수 없습니다. Mid-training은 다음 토큰 예측 목표를 유지하되 데이터 분포를 대상 도메인으로 좁히고 일반 보존 데이터를 섞어 망각을 제어합니다. 이는 “과제를 풀 지식과 기초 역량이 있는가”를 다루며, “어떻게 답할까”나 “어떤 정책의 보상이 높은가”를 다루지 않습니다.
 
 Mid-training과 SFT의 손실 함수는 매우 비슷해 보이지만 데이터 구성과 감독 밀도가 다르다. 전자는 보통 문서나 코드, 유도 과정 전체를 학습 목표로 삼아 많은 token에 대해 손실을 계산한다. 후자는 데이터를 입력—출력 시연으로 구성하고 대개 답변 token에서만 손실을 계산한다. 그래서 적은 수의 문답으로 SFT를 돌려 사실 몇 가지를 외우게 하는 것이 기술적으로 불가능하지는 않지만, 그것은 소수의 접근 경로만 반복해서 강화할 뿐이어서 묻는 방식을 기억할 뿐 널리 불러낼 수 있는 지식으로는 잘 자리 잡지 않는다. 대규모로 서로 얽힌 도메인 지식을 흡수시켜야 한다면 Mid-training을 우선하고, 지식이 갱신 가능하고 추적 가능해야 한다면 RAG를 우선한다.
 
```

---

### Incident Patch 6: `2c730262` (2026-09-19)
**Commit Message**: fix(site): keep experiment figures inside their blockquote box (#1118)

Follow-up to #1087. The figure-caption hook rewrote the Markdown, so a
quoted experiment figure (`> ![图8-7 …](…)`) had to lose its `>` marker:
Python-Markdown has no Markdown-level shape that puts a <figure> directly
inside a <blockquote>. The experiment box therefore split in two with a
bare figure between, and the quote bar broke at every one of the 23
experiment figures per edition.

Run the hook on the rendered HTML instead (on_page_content). There a
standalone image is always `<p><img …></p>`, inside or outside a
blockquote, and can be wrapped in <figure>/<figcaption> in place. The
<img> tag is kept exactly as Python-Markdown emitted it and the caption is
its already-escaped alt text, so numbering and captions are unchanged.
Hook ordering in mkdocs.yml no longer matters (the Pandoc strip is a
Markdown-stage hook and always runs first).

Tests: HTML-level cases plus end-to-end through Python-Markdown with the
site's extensions (skipped where `markdown` is not installed), asserting
the quoted figure stays a direct child of a single <blockquote>.

Co-authored-by: Bojie Li <[REDACTED_EMAIL]>
Co-authored-by: Cl

**File**: `mkdocs.yml` (modified, +5/-5)
```diff
@@ -25,11 +25,11 @@ hooks:
   - scripts/mkdocs_pandoc_strip.py
   # Wrap every standalone book figure in <figure>/<figcaption> so the label the
   # author already wrote in the image alt text ("图0-2 …", "Figure 0-2: …")
-  # becomes a visible caption on the reading site. Must run AFTER the Pandoc
-  # strip above: by the time this hook runs the figure is raw HTML that the
-  # strip hook can no longer reach, so a leftover `{height=55%}` would be
-  # printed as literal text in the caption. See the module docstring for why
-  # this is a build-time hook rather than a browser script.
+  # becomes a visible caption on the reading site. Works on the rendered HTML
+  # (on_page_content), which is what lets the experiment figures stay inside
+  # their `> ` blockquote box; the Pandoc strip above is a Markdown-stage hook,
+  # so it has always run by then whatever the order here. See the module
+  # docstring for why this is a build-time hook rather than a browser script.
   - scripts/mkdocs_figure_captions.py
   - scripts/seo_meta.py
   # Splits the search plugin's single 55 MB search_index.json into one file
```

**File**: `scripts/mkdocs_figure_captions.py` (modified, +65/-97)
```diff
@@ -12,128 +12,96 @@
 caption has to be in the served HTML for search engines, screen readers,
 "view source", and the no-JavaScript case.
 
-This hook rewrites such lines *before* Python-Markdown runs (MkDocs runs every
-`on_page_markdown` hook before parsing):
+This hook rewrites the *rendered* HTML (`on_page_content`, i.e. after
+Python-Markdown has run). A lone image line always comes out of
+Python-Markdown as a paragraph holding nothing but the `<img>`:
 
-    ![图0-2 全书结构](images/fig0-2.svg)
+    <p><img alt="图0-2 全书结构" src="images/fig0-2.svg" /></p>
       ->  <figure class="md-typeset-figure">
-          <img src="images/fig0-2.svg" alt="图0-2 全书结构">
+          <img alt="图0-2 全书结构" src="images/fig0-2.svg" />
           <figcaption>图0-2 全书结构</figcaption>
           </figure>
 
-The `<figure>` is emitted as finished HTML rather than with `markdown="1"`, for
-two reasons:
-
-* inside a blockquote, `md_in_html` never processes the nested figure, so the
-  attribute survived into the page and the `<figcaption>` came out wrapped in a
-  `<p>` (both verified in a real build);
-* it keeps the caption verbatim — the book's captions are plain single-line text
-  (no emphasis or links), so nothing is lost, and no stray Pandoc attribute can
-  end up printed inside the caption.
-
-The caption is never invented: it is the label the author already wrote in the
-alt text, so numbering stays identical to the PDF/EPUB and to every translated
-edition.
-
-Run this hook AFTER `mkdocs_pandoc_strip.py` (see mkdocs.yml): the image line
-must already be free of Pandoc attributes (`{height=55%}`), because the `src`
-written here is final and any leftover attribute would be printed verbatim.
-
-Images inside a blockquote (`> ![图8-7 …](…)`, the 23 experiment figures of
-each edition) lose their quote marker and render as plain centered figures like
-every other figure. Python-Markdown offers no shape that avoids this: a figure
-quoted line comes out as `<p><figure>` with its `<figcaption>` wrapped in a
-`<p>` (inside a blockquote every block is parsed as a paragraph), and with
-`markdown="1"` the attribute and the extra `<p>` both reached the served HTML.
-Every such line is a standalone blockquote, so no prose is disturbed; the only
-visible effect is that the surrounding quote bar breaks where the figure sits.
-Images that are inline inside a sentence (Vietnamese chapter 2) are left alone,
-since splitting their paragraph would reflow prose.
+Working on the HTML rather than the Markdown is what keeps the 23 experiment
+figures of each edition inside their experiment box. Those are written as
+
+    > **实验 8-2 ★★：…**
+    >
+    > ![图8-7 …](images/fig8-7.svg)
+    >
+    > 正文 …
+
+and Python-Markdown offers no Markdown-level shape that puts a `<figure>`
+directly inside a `<blockquote>`: raw HTML on a quoted line is treated as
+inline HTML (`<p><figure>`, caption wrapped in a `<p>`), and `md_in_html`'s
+`markdown="1"` is never processed inside a quote, so the earlier
+Markdown-level version of this hook had to drop the `>` marker and the quote
+bar broke around every experiment figure. Once the page is HTML the quoted
+image is just `<blockquote>…<p><img …></p>…</blockquote>` and can be wrapped
+in place, so the experiment box stays one unbroken blockquote.
+
+The `<img>` tag is kept exactly as Python-Markdown emitted it, and the
+caption is the alt text verbatim: it is the label the author already wrote,
+so numbering stays identical to the PDF/EPUB and to every translated edition.
+Python-Markdown has already HTML-escaped the alt attribute (`&amp;`, `&lt;`,
+`&quot;`), and every such entity is equally valid as element text, so the
+caption is safe to copy as-is.
+
+Images that sit inside a sentence (Vietnamese chapter 2) produce a `<p>` with
+other content around the `<img>`, so they never match and their prose is not
+reflowed. Image syntax inside a code block is rendered as `<code>` text, not
+an `<img>`, so it is never touched either.
+
+`mkdocs_pandoc_strip.py` still has to run as a Markdown hook (it removes the
+`{height=55%}` Pandoc attributes before Python-Markdown sees them); this hook
+runs at a later stage regardless of its position in `hooks:`.
 """
 
 import re
 
-# A whole line that is nothing but one Markdown image, optionally in a
-# blockquote, optionally indented, and optionally carrying Pandoc attributes
-# that `mkdocs_pandoc_strip` has not removed yet. Inline images
-# (`… text ![img](x.svg) more text`) never match.
+# The shape of a figure line in the book sources: a whole line that is nothing
+# but one Markdown image, optionally in a blockquote, optionally indented, and
+# optionally carrying Pandoc attributes. Not used by the hook itself (which
+# works on HTML) but by the tests, to audit that every figure of every edition
+# carries its label in the alt text that becomes the caption.
 _IMAGE_LINE = re.compile(
     r"^[ \t]*(?P<quote>>[ \t]?)?[ \t]*"
     r"(?P<image>!\[(?P<alt>[^\]]*)\]\((?P<src>[
```

**File**: `tests/test_mkdocs_figure_captions.py` (modified, +114/-88)
```diff
@@ -1,12 +1,16 @@
 """Tests for the MkDocs hook that turns book figures into <figure> + <figcaption>.
 
-Two things are locked down here:
-
-1. the line transform itself (standalone images, blockquoted images, Pandoc
-   attributes, code fences, inline images); and
-2. the book sources the transform depends on — every figure in every edition
+Three things are locked down here:
+
+1. the HTML transform itself (standalone images, inline images, images
+   without alt text, attributes Python-Markdown may add);
+2. end to end through Python-Markdown with the site's extensions: a quoted
+   experiment figure must stay inside its <blockquote>, and image syntax in
+   a code fence must stay code (skipped when `markdown` is not installed —
+   the site build installs it via requirements-docs.txt); and
+3. the book sources the transform depends on — every figure in every edition
    must carry its "图X-Y …" / "Figure X-Y: …" label in the image alt text,
-   because that alt text is exactly what the site now prints as the caption.
+   because that alt text is exactly what the site prints as the caption.
 """
 
 from __future__ import annotations
@@ -15,138 +19,160 @@
 import sys
 from pathlib import Path
 
+import pytest
+
 ROOT = Path(__file__).resolve().parents[1]
 sys.path.insert(0, str(ROOT / "scripts"))
 
 from mkdocs_figure_captions import (
     _IMAGE_LINE,
     _transform,
     iter_figure_files,
-    on_page_markdown,
+    on_page_content,
 )
 from mkdocs_pandoc_strip import on_page_markdown as strip_pandoc_attrs
 
 # Every edition labels its figures in its own script, e.g. 图1-1, 圖 1-1,
 # 図1-1, 그림 1-1, Figure 1-1:, Figura 1-1:, Рис. 1-1., Şekil 1-1:, 1-1. ábra:,
 # איור 1‑1: (note the non-breaking hyphen), படம் 1-1, Hình 1-1:, Gambar 1-1:.
-FIGURE_LABEL = re.compile(r"\d+\s*[-\u2010\u2011\u2012\u2013]\s*\d+")
+FIGURE_LABEL = re.compile(r"\d+\s*[-‐‑‒–]\s*\d+")
 
+# The extensions from mkdocs.yml that shape how an image line is rendered.
+SITE_EXTENSIONS = ["admonition", "attr_list", "footnotes", "md_in_html"]
 
-def test_standalone_image_becomes_a_captioned_figure():
-    markdown = (
-        "段落。\n"
-        "\n"
-        "![图0-2 全书结构：构建 Agent 与提升 Agent 能力](images/fig0-2.svg)\n"
-        "\n"
-        "后续段落。\n"
-    )
 
-    result = _transform(markdown)
-
-    assert (
-        '<figure class="md-typeset-figure">\n'
-        '<img src="images/fig0-2.svg" alt="图0-2 全书结构：构建 Agent 与提升 Agent 能力">\n'
-        "<figcaption>图0-2 全书结构：构建 Agent 与提升 Agent 能力</figcaption>\n"
-        "</figure>"
-    ) in result
-    assert result.startswith("段落。\n\n")
-    assert result.endswith("\n\n后续段落。\n")
-    # No `markdown="1"`: inside a blockquote md_in_html never processes the
-    # nested figure, and the attribute leaked into the served HTML.
-    assert "markdown=" not in result
+def render(markdown_text: str) -> str:
+    """Python-Markdown -> figure hook, the way MkDocs chains them."""
+    markdown = pytest.importorskip("markdown")
+    html = markdown.markdown(strip_pandoc_attrs(markdown_text), extensions=SITE_EXTENSIONS)
+    return on_page_content(html)
 
 
-def test_blockquoted_figure_becomes_a_plain_centered_figure():
-    # All 23 experiment figures per edition are written as `> ![图8-7 …](…)`.
-    # Inside a blockquote Python-Markdown cannot make the figure a direct child
-    # of the <blockquote> (`<p><figure>` came out of the real build), so the
-    # markers are dropped and the figure renders like every other figure.
-    markdown = "> ![图8-7 Q-learning 与 LLM Agent 在寻宝游戏中的架构对比](images/fig8-7.svg)\n"
+def test_standalone_image_paragraph_becomes_a_captioned_figure():
+    html = (
+        "<p>段落。</p>\n"
+        '<p><img alt="图0-2 全书结构：构建 Agent 与提升 Agent 能力" src="images/fig0-2.svg" /></p>\n'
+        "<p>后续段落。</p>"
+    )
 
-    result = _transform(markdown)
+    result = _transform(html)
 
     assert result == (
+        "<p>段落。</p>\n"
         '<figure class="md-typeset-figure">\n'
-        '<img src="images/fig8-7.svg" alt="图8-7 Q-learning 与 LLM Agent 在寻宝游戏中的架构对比">\n'
-        "<figcaption>图8-7 Q-learning 与 LLM Agent 在寻宝游戏中的架构对比</figcaption>\n"
+        '<img alt="图0-2 全书结构：构建 Agent 与提升 Agent 能力" src="images/fig0-2.svg" />\n'
+        "<figcaption>图0-2 全书结构：构建 Agent 与提升 Agent 能力</figcaption>\n"
         "</figure>\n"
+        "<p>后续段落。</p>"
     )
 
 
-def test_pandoc_attributes_never_reach_the_figure_html():
-    # mkdocs_pandoc_strip runs first (see mkdocs.yml), so the attribute is gone
-    # before this hook turns the line into HTML. If the order ever flips, the
-    # hook refuses to rewrite the line instead of emitting a broken `src`.
-    image = "![图2-12 启用 Skills 后 Agent Trajectory 的完整结构](images/fig2-12.svg)"
-    caption = "图2-12 启用 Skills 后 Agent Trajectory 的完整结构"
+def test_image_tag_is_kept_verbatim_including_extra_attributes():
+    # Whatever Python-Markdown (attr_list, a title) put on the tag survives;
+    # the hook only wraps, it never rebuilds the <img>.
+    html = '<p><img alt="图2-
```

---

### Incident Patch 7: `65a9beb4` (2026-09-18)
**Commit Message**: fix(ch4): make execution-tools run on Windows via Git Bash / WSL instead of dying on /bin/bash (#1116)

`python cli.py demo` fails on native Windows at step 4 (#1068): the
multi-language executor unconditionally passed executable='/bin/bash' to
create_subprocess_shell, so every code_interpreter call raised
FileNotFoundError. The local Python fallback also invoked `python3`, which
Windows does not put on PATH, and the demo interpolated a backslash temp
path into a bash command line.

- multilang_executor: new find_bash() (POSIX: /bin/bash; otherwise the first
  bash on PATH, i.e. Git for Windows / MSYS2 / WSL) and BASH_MISSING_ERROR.
  _run_command returns an ERROR result with that message when no bash exists
  instead of raising, and spawns `bash -c <command>` through
  create_subprocess_exec: on Windows shell=True always wraps the command in
  `cmd.exe /c`, so a replacement executable would receive cmd's arguments.
  The local Python path runs sys.executable (forward-slash form) rather than
  `python3`; the bash runner quotes its script path the same way.
- execution_tools.virtual_terminal: on Windows run the command as
  [bash, "-c", command] (or return BASH_MISSING_ERROR); POSIX

**File**: `chapter4/execution-tools/README.md` (modified, +4/-0)
```diff
@@ -66,6 +66,8 @@ cd chapter4/execution-tools
 # python -m pip install -r requirements.txt
 ```
 
+> **Windows note**: `code_interpreter` and `virtual_terminal` run commands through `bash`. On Windows, either run the project inside WSL, or install [Git for Windows](https://gitforwindows.org/) so that `bash` (Git Bash) is on your `PATH`. Without `bash`, both tools return a clear error instead of crashing, and `python cli.py demo` stops at startup with the same message.
+
 ### Configuration
 
 1. Copy `env.example` to `.env`:
@@ -312,6 +314,8 @@ cd chapter4/execution-tools
 # python -m pip install -r requirements.txt
 ```
 
+> **Windows 用户注意**：`code_interpreter` 与 `virtual_terminal` 通过 `bash` 执行命令。在 Windows 上请在 WSL 中运行本项目，或安装 [Git for Windows](https://gitforwindows.org/) 让 `bash`（Git Bash）位于 `PATH` 中。找不到 `bash` 时，两个工具会返回明确的错误而不是崩溃，`python cli.py demo` 也会在启动时给出同样的提示。
+
 ### 配置
 
 1. 复制 `env.example` 为 `.env`：
```

**File**: `chapter4/execution-tools/cli.py` (modified, +11/-1)
```diff
@@ -35,9 +35,11 @@
 import asyncio
 import json
 import os
+import shlex
 import sys
 import tempfile
 import textwrap
+from pathlib import Path
 
 
 # ---------------------------------------------------------------------------
@@ -199,6 +201,13 @@ def cmd_demo(args: argparse.Namespace) -> int:
     校验结果。演示同时覆盖四个安全机制：linter 校验、危险命令 fail-safe 审批、
     长输出截断与持久化。整个流程默认离线运行（关闭 LLM 总结）。
     """
+    # bash 是 code_interpreter / virtual_terminal 的执行外壳。纯 Windows 环境没有
+    # bash 时，后面的步骤 4～7 都会失败，这里先给出明确提示（见 README 的 Windows 说明）。
+    from multilang_executor import find_bash, BASH_MISSING_ERROR
+    if find_bash() is None:
+        print(f"错误：{BASH_MISSING_ERROR}", file=sys.stderr)
+        return 1
+
     # 演示放在独立临时工作区，避免污染当前目录。
     workspace = tempfile.mkdtemp(prefix="exec_tools_demo_")
     os.environ["WORKSPACE_DIR"] = workspace
@@ -268,7 +277,8 @@ def word_count(path):
         # 5. virtual_terminal：用 shell 校验数据文件
         section("5. virtual_terminal：用 shell 校验数据文件")
         r = await exec_tools.virtual_terminal(
-            command=f"wc -w {workspace}/data.txt && echo '--- 词数统计完成 ---'"
+            # 正斜杠 + 引号：Windows 的临时目录路径含反斜杠和空格，直接拼进 bash 命令会被当作转义。
+            command=f"wc -w {shlex.quote(Path(workspace).as_posix())}/data.txt && echo '--- 词数统计完成 ---'"
         )
         print(f"结果：success={r['success']}, returncode={r.get('returncode')}")
         print("stdout:")
```

**File**: `chapter4/execution-tools/execution_tools.py` (modified, +15/-4)
```diff
@@ -10,7 +10,7 @@
 from contextlib import redirect_stdout, redirect_stderr
 from llm_helper import LLMHelper
 from config import Config
-from multilang_executor import LanguageExecutor, ExecutionStatus
+from multilang_executor import LanguageExecutor, ExecutionStatus, find_bash, BASH_MISSING_ERROR
 
 # Long-output handling thresholds (see "长输出的截断与持久化" in chapter 4).
 # When output exceeds either threshold, keep the head and tail few lines in the
@@ -227,11 +227,22 @@ async def virtual_terminal(
                         "error": f"Command execution not approved: {reason}"
                     }
         
-        # Execute command
+        # Execute command. POSIX keeps the platform shell. Windows has no POSIX
+        # shell of its own, so run the command through bash (Git Bash or WSL) as
+        # `bash -c`, which is what the shell examples in the book assume.
+        if os.name == "nt":
+            bash = find_bash()
+            if bash is None:
+                return {"success": False, "error": BASH_MISSING_ERROR}
+            popen_args: Any = [bash, "-c", command]
+            use_shell = False
+        else:
+            popen_args = command
+            use_shell = True
         try:
             result = subprocess.run(
-                command,
-                shell=True,
+                popen_args,
+                shell=use_shell,
                 capture_output=True,
                 text=True,
                 timeout=timeout,
```

**File**: `chapter4/execution-tools/multilang_executor.py` (modified, +36/-6)
```diff
@@ -9,6 +9,8 @@
 import base64
 import psutil
 import shlex
+import sys
+from pathlib import Path
 from typing import Dict, Any, Optional, List
 from enum import Enum
 import logging
@@ -36,6 +38,25 @@ async def get_all_output(stream) -> str:
         return ""
 
 
+BASH_MISSING_ERROR = (
+    "bash not found: code_interpreter and virtual_terminal run commands through bash. "
+    "On Windows, run the project inside WSL or install Git for Windows so that "
+    "`bash` (Git Bash) is on PATH."
+)
+
+
+def find_bash() -> Optional[str]:
+    """Locate the bash used to run tool commands, or None when there is none.
+
+    POSIX keeps the historical /bin/bash. Windows has no bash of its own, so
+    the only candidates are a bash.exe on PATH: Git for Windows, MSYS2, or the
+    WSL launcher.
+    """
+    if os.name != "nt" and os.path.exists("/bin/bash"):
+        return "/bin/bash"
+    return shutil.which("bash")
+
+
 def kill_process_tree(pid: int):
     """Kill process and all its children."""
     try:
@@ -150,16 +171,22 @@ async def _run_command(
     ) -> Dict[str, Any]:
         """Run a shell command and return results with proper process management."""
         process = None
+        bash = find_bash()
+        if bash is None:
+            logger.error(BASH_MISSING_ERROR)
+            return {"status": ExecutionStatus.ERROR, "error": BASH_MISSING_ERROR}
         try:
             logger.debug(f'Running command: {command[:100]}...')
-            
-            process = await asyncio.create_subprocess_shell(
-                command,
+
+            # `bash -c` through exec rather than create_subprocess_shell(executable=...):
+            # with shell=True Windows always wraps the command in `cmd.exe /c`, so a
+            # replacement executable would be handed cmd's arguments instead.
+            process = await asyncio.create_subprocess_exec(
+                bash, '-c', command,
                 stdin=asyncio.subprocess.PIPE if stdin else None,
                 stdout=asyncio.subprocess.PIPE,
                 stderr=asyncio.subprocess.PIPE,
                 cwd=cwd,
-                executable='/bin/bash'
             )
             
             # Write stdin if provided
@@ -301,7 +328,10 @@ async def _run_python(
                 }
             else:
                 result = await self._run_command(
-                    f'python3 -I -B -u {shlex.quote(code_file)}',
+                    # The interpreter running this tool, as a forward-slash path so the
+                    # command also parses under Git Bash on Windows.
+                    f'{shlex.quote(Path(sys.executable).as_posix())} -I -B -u '
+                    f'{shlex.quote(Path(code_file).as_posix())}',
                     timeout,
                     stdin,
                     tmp_dir
@@ -630,7 +660,7 @@ async def _run_bash(
             os.chmod(code_file, 0o755)
             
             result = await self._run_command(
-                f'bash {code_file}',
+                f'bash {shlex.quote(Path(code_file).as_posix())}',
                 timeout,
                 stdin,
                 tmp_dir
```

**File**: `chapter4/execution-tools/test_bash_lookup.py` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+"""Regression tests for #1068: the executors must not hard-code /bin/bash.
+
+On native Windows there is no /bin/bash, so every code_interpreter and
+virtual_terminal call used to die with FileNotFoundError. The executor now
+looks bash up (Git Bash / WSL on Windows), reports a clear error when it is
+missing, and runs local Python through the current interpreter instead of a
+`python3` that Windows does not have on PATH.
+"""
+import asyncio
+import sys
+from pathlib import Path
+
+import pytest
+
+import multilang_executor as ml
+from multilang_executor import (
+    BASH_MISSING_ERROR,
+    ExecutionStatus,
+    LanguageExecutor,
+    find_bash,
+)
+
+
+def test_find_bash_posix_prefers_bin_bash(monkeypatch):
+    monkeypatch.setattr(ml.os, "name", "posix")
+    monkeypatch.setattr(ml.os.path, "exists", lambda p: p == "/bin/bash")
+    monkeypatch.setattr(ml.shutil, "which", lambda name: None)
+    assert find_bash() == "/bin/bash"
+
+
+def test_find_bash_windows_uses_bash_on_path(monkeypatch):
+    monkeypatch.setattr(ml.os, "name", "nt")
+    monkeypatch.setattr(
+        ml.shutil, "which",
+        lambda name: r"C:\Program Files\Git\bin\bash.exe" if name == "bash" else None,
+    )
+    assert find_bash() == r"C:\Program Files\Git\bin\bash.exe"
+
+
+def test_find_bash_missing_returns_none(monkeypatch):
+    monkeypatch.setattr(ml.os, "name", "nt")
+    monkeypatch.setattr(ml.shutil, "which", lambda name: None)
+    assert find_bash() is None
+
+
+def test_run_command_reports_missing_bash_instead_of_raising(monkeypatch):
+    monkeypatch.setattr(ml, "find_bash", lambda: None)
+    result = asyncio.run(LanguageExecutor()._run_command("echo hi", timeout=5))
+    assert result["status"] == ExecutionStatus.ERROR
+    assert result["error"] == BASH_MISSING_ERROR
+
+
+def test_local_python_uses_current_interpreter(monkeypatch):
+    captured = {}
+
+    async def fake_run(self, command, timeout, stdin=None, cwd=None, shell=True):
+        captured["command"] = command
+        return {"status": ExecutionStatus.SUCCESS, "returncode": 0,
+                "stdout": "", "stderr": "", "execution_time": 0.0}
+
+    monkeypatch.setattr(ml.shutil, "which", lambda name: None)  # no docker -> local path
+    monkeypatch.setattr(LanguageExecutor, "_run_command", fake_run)
+    asyncio.run(LanguageExecutor()._run_python("print(1)", 5, 5, None, {}))
+    assert Path(sys.executable).as_posix() in captured["command"]
+    assert "python3 -I" not in captured["command"]
+    assert "\\" not in captured["command"]
+
+
+@pytest.mark.skipif(find_bash() is None, reason="needs a bash to run")
+def test_bash_roundtrip_with_real_bash():
+    result = asyncio.run(LanguageExecutor()._run_command("echo ok", timeout=10))
+    assert result["status"] == ExecutionStatus.SUCCESS
+    assert result["stdout"].strip() == "ok"
+
+
+@pytest.mark.skipif(find_bash() is None, reason="needs a bash to run")
+def test_python_roundtrip_with_real_interpreter(monkeypatch):
+    monkeypatch.setattr(ml.shutil, "which", lambda name: find_bash() if name == "bash" else None)
+    result = asyncio.run(LanguageExecutor()._run_python("print(2 + 2)", 10, 10, None, {}))
+    assert result["status"] == ExecutionStatus.SUCCESS, result
+    assert result["stdout"].strip() == "4"
+    assert result["sandbox"]["kind"] == "local-process"
```

---

### Incident Patch 8: `7aacea32` (2026-09-18)
**Commit Message**: fix(ch2): label the cross-request prefix reuse in fig 2-10 as Prompt Cache (#1113)

Section "KV Cache and Prompt Cache: Two Levels of Caching" defines KV Cache
as the in-model mechanism within one inference and Prompt Cache as the
API-layer reuse of the same prefix across requests. Figure 2-10 compares
three separate API requests, yet its title was "KV Cache Prefix Reuse
Mechanism" and the arrows were labelled "KV reuse" / "KV reuse interrupted",
which suggests that KV Cache itself lives across requests.

- fig 2-10 (all 15 editions): title/caption "Prompt Cache: Reusing the Prefix
  KV Cache Across Requests"; arrow labels "Prompt Cache hit: KV reused" and
  "Prompt Cache miss: KV recomputed"; <desc> reworded accordingly. Labels
  use one font size per edition (14 px where it fits, 12 px for ru/tr) and
  sit in the free gap between request rows.
- Markdown captions updated in all 15 chapter 2 files.
- book/chapter2.md and book-en/chapter2.md: one sentence after the prefix
  sensitivity paragraph says the figure shows Prompt Cache-level reuse of
  the prefix's KV Cache, so the two terms are tied together at the figure.

Fixes #1073

Co-authored-by: Bojie Li <[REDACTED_EMAIL]>
Co-aut

**File**: `book-ar/chapter2.ar.md` (modified, +1/-1)
```diff
@@ -541,7 +541,7 @@ response = call_model(request)
 
 لفهم قيمة KV Cache، فكر أولاً في ما يحدث بدونها. لنفترض أن أحد الوكلاء قد وصل إلى جولة المحادثة السادسة وجمع 2000 رمزًا مميزًا للسياق. بدون التخزين المؤقت، يتطلب كل رمز مميز جديد من النموذج إعادة حساب متجهات K وV للبادئة بأكملها. على الرغم من أن الجولات الخمس الأولى لم تتغير، إلا أن الجولة السادسة لا تزال تعيد حسابها، والبادئة الأطول تجعل هذه الجولة أكثر تكلفة من الأولى. بدون التخزين المؤقت، فإن حساب الانتباه في مرحلة التعبئة المسبقة (المرحلة التي يعالج فيها النموذج جميع الرموز المميزة للإدخال قبل إنشاء استجابة) ينمو بشكل تربيعي مع طول السياق، مما يتسبب في ارتفاع زمن الوصول والتكلفة بسرعة مع تعمق المحادثة. يعد هذا مشكلة بشكل خاص لمهام الوكيل التي تتطلب العديد من استدعاءات الأدوات.
 
-![الشكل 2-10: KV Cache آلية إعادة استخدام البادئة](images/fig2-10.svg)
+![الشكل 2-10: Prompt Cache: إعادة استخدام KV Cache للبادئة عبر الطلبات](images/fig2-10.svg)
 
 **فهم KV Cache بمثال بسيط.** لنفترض أن السياق يحتوي على 4 رموز مميزة [A، B، C، D]، والنموذج على وشك إنشاء الرمز المميز الخامس، E. تعمل عملية الاهتمام الأساسية على النحو التالي: ناقل الاستعلام في هذه الخطوة يأتي من آخر رمز مميز معروف وهو D، ويُقارَن بالمتجهات الرئيسية للرموز الأربعة A وB وC وD لحساب درجات المطابقة (للحصول على شرح بديهي للمنتجات النقطية، راجع التجربة 2-2). ثم يستخدم هذه الدرجات لحساب المجموع المرجح لمتجهات القيمة للرموز الأربعة نفسها، مما يؤدي إلى إنتاج تمثيل المخرجات عند موضع D — وهو بالضبط ما يستخدمه النموذج للتنبؤ بالرمز التالي E. أما متجهات Q وK وV الخاصة بـ E نفسه فلا تُحسب إلا بعد أخذ عينة من E وإعادة إدخاله إلى النموذج.
 
```

**File**: `book-ar/images/fig2-10.svg` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 44 820 443" width="820" height="443" style="background:#ffffff">
-<title>الشكل 2-10: KV Cache آلية إعادة استخدام البادئة</title>
-<desc>تقارن ثلاثة طلبات إعادة استخدام بادئة KV Cache: ينشئ الطلب 1 الذاكرة المؤقتة، ويصيبها الطلب 2 لأن البادئة لم تتغير، بينما يضع الطلب 3 طابعًا زمنيًا ديناميكيًا في بداية موجّه النظام، فتُعاد حساب جميع الرموز بعد نقطة التغيير وتُحتسب تكلفتها من جديد.</desc>
+<title>الشكل 2-10: Prompt Cache: إعادة استخدام KV Cache للبادئة عبر الطلبات</title>
+<desc>تقارن ثلاثة طلبات كيف يعيد Prompt Cache استخدام KV Cache الخاصة بالبادئة عبر الطلبات: ينشئ الطلب 1 الذاكرة المؤقتة، ويصيبها الطلب 2 لأن البادئة لم تتغير، بينما يضع الطلب 3 طابعًا زمنيًا ديناميكيًا في بداية موجّه النظام، فتُعاد حساب جميع الرموز بعد نقطة التغيير وتُحتسب تكلفتها من جديد.</desc>
 <defs><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#999999"/></marker></defs>
 <text x="135.262" y="70" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الطلب 1</text>
 <rect x="40" y="85" width="455" height="40" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -17,10 +17,10 @@
 <rect x="660" y="170" width="120" height="40" rx="6" fill="#e8e8e8" stroke="#333333" stroke-width="2"/>
 <text x="720" y="190" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">→ توليد الاستجابة</text>
 <line x1="267.5" y1="127" x2="267.5" y2="168" stroke="#999999" stroke-width="2" marker-end="url(#ah-light)"/>
-<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="end" dominant-baseline="central" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">إعادة استخدام KV</text>
+<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="end" dominant-baseline="central" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">إصابة Prompt Cache: إعادة استخدام KV</text>
 <line x1="267.5" y1="212" x2="267.5" y2="253" stroke="#999999" stroke-width="2" stroke-dasharray="6,5" marker-end="url(#ah-light)"/>
 <text x="255.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#666666" text-anchor="start" dominant-baseline="central" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">تغيّر موجّه النظام</text>
-<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="end" dominant-baseline="central" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">انقطاع إعادة استخدام KV</text>
+<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="end" dominant-baseline="central" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">إخفاق Prompt Cache: إعادة حساب KV</text>
 <text x="135.262" y="240" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الطلب 3</text>
 <rect x="40" y="255" width="455" height="40" rx="6" fill="#ffffff" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="267.5" y="275" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">"الوقت: 10:30:45" + موجّه النظام + الأدوات (إبطال الذاكرة المؤقتة ✗)</text>
```

**File**: `book-en/chapter2.md` (modified, +2/-2)
```diff
@@ -527,13 +527,13 @@ With Qwen3's Chat Template, for instance, multi-turn tool calls can retain prior
 
 Note that different model families differ greatly in how they handle historical chain-of-thought, and the strategies themselves are evolving rapidly. The official guidance in the DeepSeek R1 era was to **strip all historical reasoning**: in multi-turn conversations, only `content` is passed back, not `reasoning_content`—because historical CoT never appeared in R1's training input, feeding it back is out-of-distribution input that may instead interfere with the output, and it also saves a considerable number of tokens. But this strategy has flaws for Agent scenarios: intermediate reasoning carries critical state such as "why this tool was called and which hypotheses were ruled out"; once stripped, the model reasons from scratch every turn, making it prone to repeating mistakes and losing long-range plans. DeepSeek therefore **completely reversed** the policy in V4: as long as the request carries the `tools` parameter, the `reasoning_content` of every assistant message between two user messages—even one that made no tool call on that turn—must be passed back verbatim, or the API returns a 400 error; plain chat without `tools` still ignores historical reasoning. An Agent always carries `tools`, so there is no escaping this requirement—Kimi K2, GLM-5, and others have adopted the same protocol. Claude, meanwhile, requires the client to pass the thinking block (with signature verification) back to the API unchanged within the tool call loop; after new user input, the server ignores thinking blocks from before the most recent user input. Consult the model's latest documentation before use. Across multi-turn dialogue these differences only decide whether tokens are saved; the moment a half-finished trajectory has to be handed to another vendor's model to complete, they turn into real API errors—see Experiment 5-1 in Chapter 5.
 
-**Second, it explains why KV Cache is so sensitive to the prefix.** The Chat Template converts system messages and tool definitions into a fixed token sequence near the beginning of the input. The key-value states for these tokens can be cached and reused across requests. If a token in this prefix changes—even because of an extra space in the system prompt—the cache from the first differing token onward can no longer be reused.
+**Second, it explains why KV Cache is so sensitive to the prefix.** The Chat Template converts system messages and tool definitions into a fixed token sequence near the beginning of the input. The key-value states for these tokens can be cached and reused across requests. If a token in this prefix changes—even because of an extra space in the system prompt—the cache from the first differing token onward can no longer be reused. Figure 2-10 shows exactly this cross-request prefix reuse: in the terms of "KV Cache and Prompt Cache: Two Levels of Caching" below, it happens at the Prompt Cache level, and what gets reused is the prefix's KV Cache.
 
 ### Principles and Constraints of KV Cache
 
 To understand the value of KV Cache, first consider what happens without it. Suppose an Agent has reached the sixth conversation round and accumulated 2,000 context tokens. Without caching, each new token requires the model to recalculate the K and V vectors for the entire prefix. Although the first five rounds are unchanged, the sixth round still recomputes them, and the longer prefix makes this round more expensive than the first. Without caching, the attention computation in the prefill phase (the stage where the model processes all input tokens before generating a response) grows quadratically with context length, causing latency and cost to rise rapidly as the conversation deepens. This is especially problematic for Agent tasks that require many tool calls.
 
-![Figure 2-10: KV Cache Prefix Reuse Mechanism](images/fig2-10.svg)
+![Figure 2-10: Prompt Cache: Reusing the Prefix KV Cache Across Requests](images/fig2-10.svg)
 
 **Understanding KV Cache with a simple example.** Suppose the context has 4 tokens [A, B, C, D], and the model is about to generate the fifth token, E. The core attention operation works like this: the Query vector for this step comes from the last known token, D, and is compared with the Key vectors of the four tokens A, B, C, and D to calculate match scores (for an intuitive explanation of dot products, see Experiment 2-2). It then uses those scores to compute a weighted sum of the Value vectors of those same four tokens, producing the output representation at D's position — which is exactly what the model uses to predict the next token, E. E's own Q, K, and V are computed only after E has been sampled and fed back into the model.
 
```

**File**: `book-en/images/fig2-10.svg` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 44 820 443" width="820" height="443" style="background:#ffffff">
-<title>Figure 2-10: KV Cache Prefix Reuse Mechanism</title>
-<desc>Three requests compare KV Cache prefix reuse: Request 1 establishes the cache; Request 2 hits it because the prefix is unchanged; Request 3 puts a dynamic timestamp at the start of the system prompt, so every token after the change point is recomputed and billed again.</desc>
+<title>Figure 2-10: Prompt Cache: Reusing the Prefix KV Cache Across Requests</title>
+<desc>Three requests compare how Prompt Cache reuses the prefix KV Cache across requests: Request 1 establishes the cache; Request 2 hits it because the prefix is unchanged; Request 3 puts a dynamic timestamp at the start of the system prompt, so every token after the change point is recomputed and billed again.</desc>
 <defs><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#999999"/></marker></defs>
 <text x="40" y="70" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="bold">Request 1</text>
 <rect x="40" y="85" width="455" height="40" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -17,10 +17,10 @@
 <rect x="660" y="170" width="120" height="40" rx="6" fill="#e8e8e8" stroke="#333333" stroke-width="2"/>
 <text x="720" y="190" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">→ Generate response</text>
 <line x1="267.5" y1="127" x2="267.5" y2="168" stroke="#999999" stroke-width="2" marker-end="url(#ah-light)"/>
-<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="start" dominant-baseline="central">KV reuse</text>
+<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="start" dominant-baseline="central">Prompt Cache hit: KV reused</text>
 <line x1="267.5" y1="212" x2="267.5" y2="253" stroke="#999999" stroke-width="2" stroke-dasharray="6,5" marker-end="url(#ah-light)"/>
 <text x="255.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="end" dominant-baseline="central">System prompt changed</text>
-<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="start" dominant-baseline="central">KV reuse interrupted</text>
+<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="start" dominant-baseline="central">Prompt Cache miss: KV recomputed</text>
 <text x="40" y="240" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="bold">Request 3</text>
 <rect x="40" y="255" width="455" height="40" rx="6" fill="#ffffff" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="267.5" y="275" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">"Time: 10:30:45" + System Prompt + Tools (cache miss ✗)</text>
```

**File**: `book-es/chapter2.es.md` (modified, +1/-1)
```diff
@@ -529,7 +529,7 @@ Conviene señalar que las distintas familias de modelos aplican estrategias muy
 
 Para comprender el valor de la Caché KV, veamos primero qué ocurriría sin ella. Supongamos que un Agente se encuentra en el sexto turno de una conversación y que el contexto ya acumula 2000 tokens. Sin caché, cada vez que el modelo genera un token nuevo debe volver a calcular los vectores K y V de esos 2000 tokens, lo que equivale a repetir todo el cálculo hacia delante del prefijo. Aunque el contenido de los cinco primeros turnos no haya cambiado en absoluto, en el sexto turno todavía habría que calcular desde cero todo el prefijo, como en el primero; además, el prefijo sería ahora más largo, por lo que el coste sería muy superior al del primer turno. Sin caché, el volumen de cálculo de atención durante la fase de prefill —es decir, la fase en la que el modelo procesa de una sola vez todos los tokens de entrada antes de comenzar a generar formalmente la respuesta— crece de forma cuadrática con la longitud del contexto. A medida que avanza la conversación, tanto la latencia como el coste aumentan bruscamente. Esto resulta inaceptable para tareas de Agentes que requieren decenas de rondas de llamadas a herramientas.
 
-![Figura 2-10 Mecanismo de reutilización de prefijos de la Caché KV](images/fig2-10.svg)
+![Figura 2-10 Prompt Cache: reutilización de la Caché KV del prefijo entre solicitudes](images/fig2-10.svg)
 
 **Comprendamos la Caché KV con un ejemplo sencillo**. Supongamos que el contexto contiene cuatro tokens [A, B, C, D] y que el modelo está a punto de generar un quinto token, E. La operación fundamental de la atención es la siguiente: el vector de consulta —Query— de este paso procede del último token conocido, D, y se multiplica escalarmente por los vectores de clave —Key— de los cuatro tokens A, B, C y D para determinar el grado de coincidencia —consulte el experimento 2-2 para obtener una explicación intuitiva del producto escalar—. Después, se realiza una suma ponderada de los vectores de valor —Value— de esos mismos cuatro tokens según ese grado de coincidencia, con lo que se obtiene la representación de salida de la posición de D, que es justamente lo que el modelo utiliza para predecir el siguiente token, E. Los vectores Q, K y V del propio E no se calculan hasta que E se ha muestreado y se ha vuelto a introducir en el modelo.
 
```

**File**: `book-es/images/fig2-10.svg` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 <svg xml:lang="es" xmlns="http://www.w3.org/2000/svg" viewBox="0 44 820 443" width="820" height="443" style="background:#ffffff">
-<title>Figura 2-10 Mecanismo de reutilización de prefijos de la Caché KV</title>
-<desc>Tres solicitudes comparan la reutilización del prefijo de la Caché KV: la solicitud 1 crea la caché; la 2 acierta porque el prefijo no cambia; la 3 antepone una marca de tiempo dinámica al prompt del sistema, por lo que todos los tokens posteriores al punto de cambio se recalculan y vuelven a facturarse.</desc>
+<title>Figura 2-10 Prompt Cache: reutilización de la Caché KV del prefijo entre solicitudes</title>
+<desc>Tres solicitudes comparan cómo la Prompt Cache reutiliza la Caché KV del prefijo entre solicitudes: la solicitud 1 crea la caché; la 2 acierta porque el prefijo no cambia; la 3 antepone una marca de tiempo dinámica al prompt del sistema, por lo que todos los tokens posteriores al punto de cambio se recalculan y vuelven a facturarse.</desc>
 <defs><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#999999"/></marker></defs>
 <text x="40" y="70" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="bold">Solicitud 1</text>
 <rect x="40" y="85" width="455" height="40" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -17,10 +17,10 @@
 <rect x="660" y="170" width="120" height="40" rx="6" fill="#e8e8e8" stroke="#333333" stroke-width="2"/>
 <text x="720" y="190" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">→ Generar respuesta</text>
 <line x1="267.5" y1="127" x2="267.5" y2="168" stroke="#999999" stroke-width="2" marker-end="url(#ah-light)"/>
-<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="start" dominant-baseline="central">Reutilización de KV</text>
+<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="start" dominant-baseline="central">Acierto de Prompt Cache: KV reutilizada</text>
 <line x1="267.5" y1="212" x2="267.5" y2="253" stroke="#999999" stroke-width="2" stroke-dasharray="6,5" marker-end="url(#ah-light)"/>
 <text x="255.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="end" dominant-baseline="central">Prompt del sistema cambiado</text>
-<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#666666" text-anchor="start" dominant-baseline="central">Reutilización de KV interrumpida</text>
+<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="start" dominant-baseline="central">Fallo de Prompt Cache: KV recalculada</text>
 <text x="40" y="240" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="bold">Sol. 3</text>
 <rect x="40" y="255" width="455" height="40" rx="6" fill="#ffffff" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="267.5" y="275" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">"Hora: 10:30:45" + System Prompt + Tools (fallo de caché ✗)</text>
```

**File**: `book-he/chapter2.he.md` (modified, +1/-1)
```diff
@@ -531,7 +531,7 @@ response = call_model(request)
 
 כדי להבין את ערכו של KV Cache, שקלו תחילה מה קורה בלעדיו. נניח שסוכן הגיע לסבב השיחה השישי וצבר 2,000 טוקני הקשר. ללא שמירה במטמון, כל טוקן חדש מחייב את המודל לחשב מחדש את וקטורי ה‑K וה‑V עבור הקידומת כולה. אף שחמשת הסבבים הראשונים אינם משתנים, הסבב השישי עדיין מחשב אותם מחדש, והקידומת הארוכה יותר הופכת סבב זה ליקר יותר מהראשון. ללא שמירה במטמון, חישוב הקשב בשלב ה‑prefill (השלב שבו המודל מעבד את כל טוקני הקלט לפני יצירת תגובה) גדל ריבועית עם אורך ההקשר, וגורם לזמן ההשהיה ולעלות לעלות במהירות ככל שהשיחה מעמיקה. הדבר בעייתי במיוחד עבור משימות סוכן הדורשות קריאות כלים רבות.
 
-![איור 2‑10: מנגנון השימוש החוזר בקידומת של KV Cache](images/fig2-10.svg)
+![איור 2‑10: Prompt Cache: שימוש חוזר ב-KV Cache של הקידומת בין בקשות](images/fig2-10.svg)
 
 **הבנת KV Cache באמצעות דוגמה פשוטה.** נניח שלהקשר יש 4 טוקנים [A, B, C, D], והמודל עומד לייצר את הטוקן החמישי, E. פעולת הקשב המרכזית פועלת כך: וקטור ה‑Query של הצעד הנוכחי מגיע מהטוקן האחרון הידוע, D, והוא מושווה לווקטורי ה‑Key של ארבעת הטוקנים A,‏ B,‏ C ו‑D כדי לחשב ציוני התאמה (להסבר אינטואיטיבי על מכפלות סקלריות, ראו ניסוי 2‑2). לאחר מכן היא משתמשת בציונים אלה כדי לחשב סכום משוקלל של וקטורי ה‑Value של אותם ארבעה טוקנים, ומייצרת את ייצוג הפלט במיקום של D — וזה בדיוק מה שהמודל משתמש בו כדי לחזות את הטוקן הבא, E. וקטורי ה‑Q,‏ K ו‑V של E עצמו מחושבים רק לאחר ש‑E נדגם והוזן חזרה אל המודל.
 
```

**File**: `book-he/images/fig2-10.svg` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 44 820 443" width="820" height="443" style="background:#ffffff">
-<title>איור 2‑10: מנגנון השימוש החוזר בקידומת של KV Cache</title>
-<desc>Three requests compare KV Cache prefix reuse: Request 1 establishes the cache; Request 2 hits it because the prefix is unchanged; Request 3 puts a dynamic timestamp at the start of the system prompt, so every token after the change point is recomputed and billed again.</desc>
+<title>איור 2‑10: Prompt Cache: שימוש חוזר ב-KV Cache של הקידומת בין בקשות</title>
+<desc>Three requests compare how Prompt Cache reuses the prefix KV Cache across requests: Request 1 establishes the cache; Request 2 hits it because the prefix is unchanged; Request 3 puts a dynamic timestamp at the start of the system prompt, so every token after the change point is recomputed and billed again.</desc>
 <defs><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#999999"/></marker></defs>
 <text x="40" y="70" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="bold">Request 1</text>
 <rect x="40" y="85" width="455" height="40" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -17,10 +17,10 @@
 <rect x="660" y="170" width="120" height="40" rx="6" fill="#e8e8e8" stroke="#333333" stroke-width="2"/>
 <text x="720" y="190" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">→ Generate response</text>
 <line x1="267.5" y1="127" x2="267.5" y2="168" stroke="#999999" stroke-width="2" marker-end="url(#ah-light)"/>
-<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="start" dominant-baseline="central">KV reuse</text>
+<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="start" dominant-baseline="central">Prompt Cache hit: KV reused</text>
 <line x1="267.5" y1="212" x2="267.5" y2="253" stroke="#999999" stroke-width="2" stroke-dasharray="6,5" marker-end="url(#ah-light)"/>
 <text x="255.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="end" dominant-baseline="central">System prompt changed</text>
-<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="start" dominant-baseline="central">KV reuse interrupted</text>
+<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="start" dominant-baseline="central">Prompt Cache miss: KV recomputed</text>
 <text x="40" y="240" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="bold">Request 3</text>
 <rect x="40" y="255" width="455" height="40" rx="6" fill="#ffffff" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="267.5" y="275" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">"Time: 10:30:45" + System Prompt + Tools (cache miss ✗)</text>
```

---

### Incident Patch 9: `3485886f` (2026-09-18)
**Commit Message**: fix(ch1): scope "no client-side ReAct loop" in fig 1-5 to the Responses API path (#1112)

Figure 1-5 and the Experiment 1-2 text claimed the orchestration loop moved
from the client to the server. That holds for the GPT-5.6 Responses API path
(Experiment 1-3), but not for the Kimi K3 path (Experiment 1-2): Formula runs
web_search server-side, while chapter1/web-search-agent/agent.py still drives
the "call model -> append tool result -> call again" loop in a client-side
while loop.

- fig 1-5 (all 15 editions): ReAct box retitled "Responses API path: ...";
  checklist now says the model decides tool calls, tools execute server-side,
  the loop is server-side on the Responses API path, and the client still
  drives the loop on the Kimi path; <desc> carries the same caveat
- book/chapter1.md: the "loop moved to the server" sentence now distinguishes
  the two paths, and the figure lead-in notes which path the checkmark covers
  (the translations' prose only says tools execute server-side, which is
  accurate, so only the figure changes there)

Fixes #1061

Co-authored-by: Bojie Li <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `book-ar/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>الشكل 1-5: بنية &quot;النموذج كوكيل&quot; — استدعاء الأداة الأصلية</title>
-<desc>يستدعي النموذج أدوات أصلية مثل web_search و code_interpreter داخل حلقة مغلقة ينفّذها Harness على الخادم. مدخل المستخدم والناتج النهائي خارج هذه الحلقة، وداخلها تتكوّن حلقة ReAct من الفكرة والفعل والملاحظة.</desc>
+<desc>يستدعي النموذج أدوات أصلية مثل web_search و code_interpreter داخل حلقة مغلقة ينفّذها Harness على الخادم. مدخل المستخدم والناتج النهائي خارج هذه الحلقة، وداخلها تتكوّن حلقة ReAct من الفكرة والفعل والملاحظة. عبارة «لا حاجة لكتابة حلقة ReAct في العميل» تصح فقط لمسار Responses API (التجربة 1-3)؛ أما في مسار Kimi K3 (التجربة 1-2) فتُنفَّذ الأدوات على الخادم لكن الحلقة ما زالت تُدار من كود العميل.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14.5" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">البيتكوين في الشهر الماضي</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">حلقة ReAct (تنفيذ مغلق عبر Harness على الخادم)</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">حلقة ReAct (مسار Responses API: تنفيذ مغلق عبر Harness على الخادم)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -55,9 +55,8 @@
 
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="233" y="88" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الاختلافات عن الأطر التقليدية</text>
-<text x="230" y="110.6" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">✓ التنسيق يديره Harness على الخادم</text>
-<text x="230" y="129.3" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">✓ لا حاجة لكتابة حلقة ReAct في</text>
-<text x="230" y="143" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">العميل</text>
-<text x="230" y="161.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">✓ النموذج يقرر استدعاء الأدوات</text>
-<text x="230" y="175.4" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">بنفسه</te
```

**File**: `book-en/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>Figure 1-5: &quot;Model as Agent&quot; Architecture—Native Tool Calling</title>
-<desc>The LLM calls native tools such as web_search and code_interpreter in a closed loop run by the server-side Harness. User input and final output sit outside that loop; inside it, Thought, Action and Observation form the ReAct cycle.</desc>
+<desc>The LLM calls native tools such as web_search and code_interpreter in a closed loop run by the server-side Harness. User input and final output sit outside that loop; inside it, Thought, Action and Observation form the ReAct cycle. "No hand-written ReAct loop on the client" holds only for the Responses API path (Experiment 1-3); on the Kimi K3 path (Experiment 1-2) the tools run server-side but the loop is still driven by client code.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">trend over the last month</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct loop (closed-loop execution by the server-side Harness)</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct loop (Responses API path: closed-loop execution by the server-side Harness)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -55,9 +55,8 @@
 
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="27" y="88" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">Differences from traditional frameworks</text>
-<text x="30" y="109.4" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Orchestration hosted by the</text>
-<text x="30" y="123.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">server-side Harness</text>
-<text x="30" y="143" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ No hand-written ReAct loop on the</text>
-<text x="30" y="157.3" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">client</text>
-<text x="30" y="176.6" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ The model decides tool calls itself</text>
+<text x="30" y="110" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ The model decides tool calls itself</text>
+<text x="30" y="133" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Tools execute server-side</text>
+<text x="30" y="156" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Responses API: server-side loop</text>
+<text x="30" y="179" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Micro
```

**File**: `book-es/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>Figura 1-5 Arquitectura de «el modelo es el Agente»—invocación nativa de herramientas</title>
-<desc>El LLM invoca herramientas nativas como web_search y code_interpreter dentro de un bucle cerrado que ejecuta el Harness del servidor. La entrada del usuario y la salida final quedan fuera de ese bucle; dentro, pensamiento, acción y observación forman el ciclo ReAct.</desc>
+<desc>El LLM invoca herramientas nativas como web_search y code_interpreter dentro de un bucle cerrado que ejecuta el Harness del servidor. La entrada del usuario y la salida final quedan fuera de ese bucle; dentro, pensamiento, acción y observación forman el ciclo ReAct. «El cliente no escribe el bucle ReAct» solo se cumple en la ruta Responses API (experimento 1-3); en la ruta Kimi K3 (experimento 1-2) las herramientas corren en el servidor, pero el bucle sigue dirigido por el código del cliente.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">de Bitcoin del último mes</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">Bucle ReAct (ejecución en bucle cerrado por el Harness del servidor)</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">Bucle ReAct (ruta Responses API: ejecución en bucle cerrado por el Harness del servidor)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -55,9 +55,8 @@
 
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="27" y="88" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">Diferencias con los marcos tradicionales</text>
-<text x="30" y="109.4" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ La orquestación la aloja el Harness</text>
-<text x="30" y="123.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">del servidor</text>
-<text x="30" y="143" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ El cliente no escribe el bucle ReAct</text>
-<text x="30" y="162.3" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ El modelo decide las llamadas a</text>
-<text x="30" y="176.6" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">herramientas</text>
+<text x="30" y="110" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ El modelo decide las llamadas</text>
+<text x="30" y="133" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Las herramientas corren en el servidor</text>
+<text x="30" y="156" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="norma
```

**File**: `book-he/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>איור 1‑5: ארכיטקטורת &quot;מודל כסוכן&quot; — קריאה מובנית לכלים</title>
-<desc>The LLM calls native tools such as web_search and code_interpreter in a closed loop run by the server-side Harness. User input and final output sit outside that loop; inside it, Thought, Action and Observation form the ReAct cycle.</desc>
+<desc>The LLM calls native tools such as web_search and code_interpreter in a closed loop run by the server-side Harness. User input and final output sit outside that loop; inside it, Thought, Action and Observation form the ReAct cycle. "No hand-written ReAct loop on the client" holds only for the Responses API path (Experiment 1-3); on the Kimi K3 path (Experiment 1-2) the tools run server-side but the loop is still driven by client code.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">trend over the last month</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct loop (closed-loop execution by the server-side Harness)</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct loop (Responses API path: closed-loop execution by the server-side Harness)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -55,9 +55,8 @@
 
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="27" y="88" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">Differences from traditional frameworks</text>
-<text x="30" y="109.4" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Orchestration hosted by the</text>
-<text x="30" y="123.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">server-side Harness</text>
-<text x="30" y="143" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ No hand-written ReAct loop on the</text>
-<text x="30" y="157.3" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">client</text>
-<text x="30" y="176.6" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ The model decides tool calls itself</text>
+<text x="30" y="110" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ The model decides tool calls itself</text>
+<text x="30" y="133" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Tools execute server-side</text>
+<text x="30" y="156" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Responses API: server-side loop</text>
+<text x="30" y="179" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft Ya
```

**File**: `book-hu/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>1-5. ábra: &quot;Model as Agent&quot; Architektúra – Natív eszközhívás</title>
-<desc>Az LLM natív eszközöket – például web_search és code_interpreter – hív meg a szerveroldali Harness által futtatott zárt hurokban. A felhasználói bemenet és a végső kimenet a hurkon kívül van; a hurkon belül a gondolat, a cselekvés és a megfigyelés alkotja a ReAct-ciklust.</desc>
+<desc>Az LLM natív eszközöket – például web_search és code_interpreter – hív meg a szerveroldali Harness által futtatott zárt hurokban. A felhasználói bemenet és a végső kimenet a hurkon kívül van; a hurkon belül a gondolat, a cselekvés és a megfigyelés alkotja a ReAct-ciklust. „A kliensnek nem kell ReAct-ciklust írnia” csak a Responses API-útra (1-3. kísérlet) igaz; a Kimi K3-úton (1-2. kísérlet) az eszközök a szerveren futnak, de a ciklust továbbra is a kliens kódja hajtja.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14.5" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">keresése az elmúlt hónapban</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct-ciklus (zárt hurkú végrehajtás a szerveroldali Harnessben)</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct-ciklus (Responses API-út: zárt hurkú végrehajtás a szerveroldali Harnessben)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -56,9 +56,8 @@
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="27" y="80.8" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">Eltérések a hagyományos</text>
 <text x="27" y="95.2" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">keretrendszerektől</text>
-<text x="30" y="109.4" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Az orkesztrációt a szerveroldali</text>
-<text x="30" y="123.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">Harness futtatja</text>
-<text x="30" y="143" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ A kliensnek nem kell ReAct-ciklust</text>
-<text x="30" y="157.3" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">írnia</text>
-<text x="30" y="176.6" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ A modell dönt az eszközhívásokról</text>
+<text x="30" y="110" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ A modell dönt az eszközhívásokról</text>
+<text x="30" y="133" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Az eszközök a szerveren futnak</text>
+<text x="30" y="156" font-family="Ar
```

**File**: `book-id/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>Gambar 1-5: Arsitektur &quot;Model sebagai Agent&quot;—Pemanggilan Tool Native</title>
-<desc>LLM memanggil tool native seperti web_search dan code_interpreter di dalam loop tertutup yang dijalankan Harness sisi server. Input pengguna dan output akhir berada di luar loop itu; di dalamnya, pikiran, aksi, dan observasi membentuk siklus ReAct.</desc>
+<desc>LLM memanggil tool native seperti web_search dan code_interpreter di dalam loop tertutup yang dijalankan Harness sisi server. Input pengguna dan output akhir berada di luar loop itu; di dalamnya, pikiran, aksi, dan observasi membentuk siklus ReAct. "Klien tak perlu menulis loop ReAct" hanya berlaku untuk jalur Responses API (Eksperimen 1-3); pada jalur Kimi K3 (Eksperimen 1-2) tool berjalan di sisi server, tetapi loop masih dijalankan oleh kode klien.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">sebulan terakhir</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">Loop ReAct (eksekusi loop tertutup oleh Harness sisi server)</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">Loop ReAct (jalur Responses API: eksekusi loop tertutup oleh Harness sisi server)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -56,9 +56,8 @@
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="27" y="80.8" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">Perbedaan dengan framework</text>
 <text x="27" y="95.2" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">tradisional</text>
-<text x="30" y="109.4" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Orkestrasi ditangani Harness sisi</text>
-<text x="30" y="123.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">server</text>
-<text x="30" y="143" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Klien tak perlu menulis loop ReAct</text>
-<text x="30" y="162.3" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Model menentukan panggilan tool</text>
-<text x="30" y="176.6" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">sendiri</text>
+<text x="30" y="110" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Model menentukan panggilan tool</text>
+<text x="30" y="133" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Tool dieksekusi di sisi server</text>
+<text x="30" y="156" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', 
```

**File**: `book-ja/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>図1-5 「モデルが Agent」アーキテクチャ——ネイティブなツール呼び出し</title>
-<desc>LLM はサーバー側 Harness の閉ループの中で web_search や code_interpreter などのネイティブツールを呼び出す。ユーザー入力と最終出力はその閉ループの外側にあり、内側は思考・行動・観察の 3 ノードからなる ReAct ループである。</desc>
+<desc>LLM はサーバー側 Harness の閉ループの中で web_search や code_interpreter などのネイティブツールを呼び出す。ユーザー入力と最終出力はその閉ループの外側にあり、内側は思考・行動・観察の 3 ノードからなる ReAct ループである。「クライアントで ReAct ループを書く必要がない」は Responses API 経路（実験 1-3）にのみ当てはまる。Kimi K3 経路（実験 1-2）ではツールはサーバー側で実行されるが、ループは依然クライアント側のコードが回している。</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">ビットコイン相場を検索</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct ループ（サーバー側 Harness が閉ループで実行）</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct ループ（Responses API 経路：サーバー側 Harness が閉ループで実行）</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -55,9 +55,8 @@
 
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="27" y="88" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">従来のフレームワークとの違い</text>
-<text x="30" y="109.4" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ オーケストレーションはサーバー側</text>
-<text x="30" y="123.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">Harness が担う</text>
-<text x="30" y="143" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ クライアントで ReAct ループを書く</text>
-<text x="30" y="157.3" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">必要がない</text>
-<text x="30" y="176.6" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ モデルが自らツール呼び出しを決める</text>
+<text x="30" y="110" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ モデルがツール呼び出しを決める</text>
+<text x="30" y="133" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ ツールはサーバー側で実行</text>
+<text x="30" y="156" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Responses API：ループもサーバー側</text>
+<text x="30" y="179" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">※ Kimi 経路：ループはクライアント側</text>
 </svg>
```

**File**: `book-ko/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>그림 1-5 “모델이 곧 에이전트” 아키텍처—네이티브 도구 호출</title>
-<desc>LLM은 서버 측 Harness가 실행하는 폐루프 안에서 web_search, code_interpreter 같은 네이티브 도구를 호출한다. 사용자 입력과 최종 출력은 폐루프 바깥에 있고, 폐루프 안에서는 사고·행동·관찰 세 노드가 ReAct 루프를 이룬다.</desc>
+<desc>LLM은 서버 측 Harness가 실행하는 폐루프 안에서 web_search, code_interpreter 같은 네이티브 도구를 호출한다. 사용자 입력과 최종 출력은 폐루프 바깥에 있고, 폐루프 안에서는 사고·행동·관찰 세 노드가 ReAct 루프를 이룬다. "클라이언트가 ReAct 루프를 작성할 필요 없음"은 Responses API 경로(실험 1-3)에만 해당한다. Kimi K3 경로(실험 1-2)에서는 도구가 서버 측에서 실행되지만 루프는 여전히 클라이언트 코드가 구동한다.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">비트코인 추세 검색</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct 루프(서버 측 Harness가 폐루프로 실행)</text>
+<text x="410" y="328" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct 루프(Responses API 경로: 서버 측 Harness가 폐루프로 실행)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -55,9 +55,8 @@
 
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="27" y="88" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">기존 프레임워크와의 차이</text>
-<text x="30" y="109.4" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ 오케스트레이션은 서버 측 Harness가</text>
-<text x="30" y="123.7" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">담당</text>
-<text x="30" y="143" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ 클라이언트가 ReAct 루프를 작성할 필</text>
-<text x="30" y="157.3" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">요 없음</text>
-<text x="30" y="176.6" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ 모델이 도구 호출을 자율 결정</text>
+<text x="30" y="110" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ 모델이 도구 호출을 자율 결정</text>
+<text x="30" y="133" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ 도구는 서버 측에서 실행</text>
+<text x="30" y="156" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Responses API: 루프도 서버 측</text>
+<text x="30" y
```

---

### Incident Patch 10: `3612c7f1` (2026-09-18)
**Commit Message**: fix(intro): sync fig 0-1 chapter numbers with the current book structure (#1111)

Figure 0-1 (Agent = LLM + Context + Tools) still carried the pre-2.0 chapter
map in every edition: "Ch. 6 Evaluation · Ch. 7 Post-Training" and
"Ch. 8 Self-Evolution · Ch. 9 Multimodal · Ch. 10 Multi-Agent". The book
now has Chapter 6 Interaction, 7 Evaluation, 8 Post-Training, 9 Continual
Evolution and 10 Multi-Agent, as the introduction text and figure 0-2 say.

- LLM detail box: 7 Evaluation · 8 Post-Training
- bottom extension box: 6 Interaction · 9 Continual Evolution · 10 Multi-Agent,
  keywords "Multimodal · Voice · Computer Use · Robotics · Learning from
  Experience · Collaboration"; box widened 390 -> 590 px so every language
  fits on one line (Arabic labels restored to the template 14/13 px after
  being auto-shrunk to 9/12 px)
- applied to all 15 editions; chapter names follow each edition's own
  chapter titles
- book-zhtw: the figure was still in simplified Chinese, converted to
  traditional at the same time

Fixes #1079

Co-authored-by: Bojie Li <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `book-ar/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -30,7 +30,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#555555" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الفصل. 6 التقييم · الفصل. 7 ما بعد التدريب</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#555555" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الفصل. 7 التقييم · الفصل. 8 ما بعد التدريب</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#888888" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">النموذج كوكيل · SFT · التعلم المعزز</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#888888" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">يتم التقييم خلال العملية برمتها</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -50,9 +50,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="9" fill="#333333" text-anchor="middle" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الفصل. 8 التطور الذاتي · الفصل. 9 الوسائط المتعددة · الفصل. 10 متعدد الوكيل</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">نماذج التعلم · إنشاء الأدوات · الصوت · الروبوتات · التعاون</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#333333" text-anchor="middle" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الفصل. 6 التفاعل · الفصل. 9 التطور المستمر · الفصل. 10 متعدد الوكيل</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#666666" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الوسائط المتعددة · الصوت · Computer Use · الروبوتات · التعلم من التجربة · التعاون</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
\ No newline at end of file
```

**File**: `book-en/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -30,7 +30,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">Ch. 6 Evaluation · Ch. 7 Post-Training</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">Ch. 7 Evaluation · Ch. 8 Post-Training</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#888888" text-anchor="middle">Model as Agent · SFT · Reinforcement Learning</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#888888" text-anchor="middle">Evaluation Runs Through the Entire Process</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -50,9 +50,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">Ch. 8 Self-Evolution · Ch. 9 Multimodal · Ch. 10 Multi-Agent</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">Learning Paradigms · Tool Creation · Voice · Robotics · Collaboration</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">Ch. 6 Interaction · Ch. 9 Continual Evolution · Ch. 10 Multi-Agent</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">Multimodal · Voice · Computer Use · Robotics · Learning from Experience · Collaboration</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
\ No newline at end of file
```

**File**: `book-es/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -32,7 +32,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#555555" text-anchor="middle">Cap. 6 Evaluación · Cap. 7 Posentrenamiento</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#555555" text-anchor="middle">Cap. 7 Evaluación · Cap. 8 Posentrenamiento</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="9.5" fill="#888888" text-anchor="middle">Modelo como Agent · SFT · Aprendizaje por refuerzo</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#888888" text-anchor="middle">Evaluación de extremo a extremo</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -52,9 +52,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="middle" font-weight="bold">Cap. 8 Autoevolución · Cap. 9 Multimodalidad · Cap. 10 Multiagente</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="9.5" fill="#666666" text-anchor="middle">Paradigmas de aprendizaje · Creación de herramientas · Voz · Robótica · Colaboración</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="middle" font-weight="bold">Cap. 6 Interacción · Cap. 9 Evolución continua · Cap. 10 Multiagente</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="9.5" fill="#666666" text-anchor="middle">Multimodalidad · Voz · Computer Use · Robótica · Aprendizaje por experiencia · Colaboración</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
```

**File**: `book-he/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -30,7 +30,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">Ch. 6 Evaluation · Ch. 7 Post-Training</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">Ch. 7 Evaluation · Ch. 8 Post-Training</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#888888" text-anchor="middle">Model as Agent · SFT · Reinforcement Learning</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#888888" text-anchor="middle">Evaluation Runs Through the Entire Process</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -50,9 +50,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">Ch. 8 Self-Evolution · Ch. 9 Multimodal · Ch. 10 Multi-Agent</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">Learning Paradigms · Tool Creation · Voice · Robotics · Collaboration</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">Ch. 6 Interaction · Ch. 9 Continual Evolution · Ch. 10 Multi-Agent</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">Multimodal · Voice · Computer Use · Robotics · Learning from Experience · Collaboration</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
\ No newline at end of file
```

**File**: `book-hu/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -30,7 +30,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">6. fej. Kiértékelés · 7. fej. Utótréning</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">7. fej. Kiértékelés · 8. fej. Utótréning</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10" fill="#888888" text-anchor="middle">modell mint ágens · SFT · megerősítéses tanulás</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#888888" text-anchor="middle">A kiértékelés a teljes folyamatot áthatja</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -50,9 +50,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">8. fej. Önfejlődés · 9. fej. Multimodális · 10. fej. Többágens</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#666666" text-anchor="middle">tanulási paradigmák · eszközkészítés · hang · robotika · együttműködés</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">6. fej. Interakció · 9. fej. Folyamatos evolúció · 10. fej. Többágens</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#666666" text-anchor="middle">multimodalitás · hang · Computer Use · robotika · tapasztalati tanulás · együttműködés</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
\ No newline at end of file
```

**File**: `book-id/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -30,7 +30,7 @@
 
 
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3" />
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">Bab 6 Evaluasi · Bab 7 Post-Training</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">Bab 7 Evaluasi · Bab 8 Post-Training</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#888888" text-anchor="middle">Model sebagai Agent · SFT · Reinforcement Learning</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#888888" text-anchor="middle">Evaluasi Berjalan Sepanjang Seluruh Proses</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)" />
@@ -50,9 +50,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)" />
 
 
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4" />
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">Bab 8 Evolusi Diri · Bab 9 Multimodal · Bab 10 Multi-Agent</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">Paradigma Pembelajaran · Pembuatan Tool · Suara · Robotika · Kolaborasi</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4" />
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">Bab 6 Interaksi · Bab 9 Evolusi Kontinual · Bab 10 Multi-Agent</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">Multimodal · Suara · Computer Use · Robotika · Belajar dari Pengalaman · Kolaborasi</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)" />
 
 </svg>
\ No newline at end of file
```

**File**: `book-ja/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -30,7 +30,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">第6章 評価・第7章 ポストトレーニング</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">第7章 評価・第8章 ポストトレーニング</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#888888" text-anchor="middle">モデルの Agent 化・SFT・強化学習</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#888888" text-anchor="middle">評価は全プロセスを貫く</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -50,9 +50,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">第8章 自己進化・第9章 マルチモーダル・第10章 マルチ Agent</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">学習パラダイム・ツール作成・音声・ロボティクス・協調</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">第6章 交互・第9章 継続的進化・第10章 マルチ Agent</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">マルチモーダル・音声・Computer Use・ロボティクス・経験学習・協調</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
\ No newline at end of file
```

**File**: `book-ko/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -30,7 +30,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">제6장 평가 · 제7장 사후 학습</text>
+<text x="150" y="82" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">제7장 평가 · 제8장 사후 학습</text>
 <text x="150" y="102" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#888888" text-anchor="middle">에이전트로서의 모델 · SFT · 강화 학습</text>
 <text x="150" y="122" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#888888" text-anchor="middle">평가는 전 과정을 관통</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -50,9 +50,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="middle" font-weight="bold">제8장 지속적 진화 · 제9장 멀티모달 · 제10장 멀티 에이전트</text>
-<text x="390" y="446" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">학습 패러다임 · 도구 생성 · 음성 · 로보틱스 · 협업</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="middle" font-weight="bold">제6장 상호작용 · 제9장 지속적 진화 · 제10장 멀티 에이전트</text>
+<text x="390" y="446" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">멀티모달 · 음성 · Computer Use · 로보틱스 · 경험 학습 · 협업</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
```

---

### Incident Patch 11: `766b29fb` (2026-09-18)
**Commit Message**: Fix agent-loop animation and responsive connectors (#1085)

* Add Astro homepage and chapter one reading prototype

* Add browser-saved highlights and notes to the Astro reader

* Add Chinese editions to the Astro book prototype

* Add homepage and reader screenshots for prototype review

* Improve reading continuity, mobile controls, and diagram viewing

* Expand prototype to all 15 editions and fix diagram label overflow

Render the homepage and Chapter 1 from all maintained source editions, with
localized interfaces, edition-specific routes, and RTL reading layouts.

Reflow the Agent-Environment interaction diagram (Figure 1-1) because its
fixed text boxes overflowed in English and 10 other editions. Generate a
taller web-only SVG with wrapping labels, retaining all 18 source labels
and the original interaction semantics. Preserve the tracked source SVGs
and Markdown so the Mandarin source, MkDocs, and PDF pipeline are unchanged;
the other six figures per edition remain byte-identical copies.

Expand the mobile chapter outline by default and remember the reader's
choice. Add syntax highlighting for the API and trajectory pseudocode,
including comments and numbers, without changi

**File**: `web-astro/src/components/AgentArchitecture.astro` (modified, +165/-81)
```diff
@@ -3,10 +3,6 @@ import { editions, translator, type Locale } from '../lib/i18n';
 const { locale = 'en' } = Astro.props as { locale?: Locale };
 const t = translator(locale);
 const stages = [
-  {
-    label: t('Observe'),
-    detail: t('Observations update the context available to the model.'),
-  },
   {
     label: t('Reason'),
     detail: t('The model uses that context to choose its next action.'),
@@ -17,6 +13,10 @@ const stages = [
       'Tools act on the environment; the results become new observations.',
     ),
   },
+  {
+    label: t('Observe'),
+    detail: t('Observations update the context available to the model.'),
+  },
 ];
 ---
 
@@ -39,34 +39,21 @@ const stages = [
     )}
   >
     <svg class="circuit" viewBox="0 0 640 460" fill="none" aria-hidden="true">
-      <defs>
-        <marker
-          id="flow-arrow"
-          viewBox="0 0 10 10"
-          refX="8"
-          refY="5"
-          markerWidth="5"
-          markerHeight="5"
-          orient="auto"
-          ><path d="m2 1 6 4-6 4" stroke="currentColor" stroke-width="1.5"
-          ></path></marker
-        >
-      </defs>
-      <g class="circuit-paths" marker-end="url(#flow-arrow)">
-        <path data-route="observe" d="M275 382H116Q80 382 80 346V218"></path>
+      <g class="circuit-paths">
+        <path data-route="observe" d="M174 382H116Q80 382 80 346V252"></path>
         <path data-route="reason" d="M147 180H241"></path>
         <path data-route="select" d="M399 180H493"></path>
-        <path data-route="execute" d="M560 218V346Q560 382 524 382H365"></path>
+        <path data-route="execute" d="M560 252V346Q560 382 524 382H466"></path>
       </g>
       <g class="energy-paths" aria-hidden="true">
-        <path data-energy="0" pathLength="1" d="M275 382H116Q80 382 80 346V218"
+        <path data-energy="0" pathLength="1" d="M174 382H116Q80 382 80 346V252"
         ></path>
         <path data-energy="1" pathLength="1" d="M147 180H241"></path>
         <path data-energy="2" pathLength="1" d="M399 180H493"></path>
         <path
           data-energy="3"
           pathLength="1"
-          d="M560 218V346Q560 382 524 382H365"></path>
+          d="M560 252V346Q560 382 524 382H466"></path>
       </g>
       <g class="packet-stream" opacity="0" aria-hidden="true">
         {
@@ -78,6 +65,12 @@ const stages = [
           ))
         }
       </g>
+      <g class="flow-arrowheads" aria-hidden="true">
+        <path data-arrowhead="0" d="m76 258 4-6 4 6"></path>
+        <path data-arrowhead="1" d="m235 176 6 4-6 4"></path>
+        <path data-arrowhead="2" d="m487 176 6 4-6 4"></path>
+        <path data-arrowhead="3" d="m472 378-6 4 6 4"></path>
+      </g>
       <g class="processing-waves" aria-hidden="true">
         <circle data-wave="0" cx="320" cy="180" r="88"></circle>
         <circle data-wave="1" cx="320" cy="180" r="88"></circle>
@@ -216,14 +209,24 @@ const stages = [
     const routes = ['observe', 'reason', 'select', 'execute'].map((name) =>
       panel.querySelector<SVGPathElement>(`[data-route="${name}"]`)!,
     );
-    const lengths = routes.map((path) => path.getTotalLength());
+    let lengths = routes.map((path) => path.getTotalLength());
+    const scene = panel.querySelector<HTMLElement>('.agent-scene')!;
+    const circuit = panel.querySelector<SVGSVGElement>('.circuit')!;
+    const core = panel.querySelector<HTMLElement>('.model-core')!;
+    const context = panel.querySelector<HTMLElement>('.context-node')!;
+    const tools = panel.querySelector<HTMLElement>('.tools-node')!;
+    const environment = panel.querySelector<HTMLElement>('.environment-label')!;
+    let coreRadius = 80;
     const packetStream = panel.querySelector<SVGGElement>('.packet-stream')!;
     const packets = [
       ...panel.querySelectorAll<SVGCircleElement>('[data-packet]'),
     ];
     const energyPaths = [
       ...panel.querySelectorAll<SVGPathElement>('[data-energy]'),
     ];
+    const arrowheads = [
+      ...panel.querySelectorAll<SVGPathElement>('[data-arrowhead]'),
+    ];
     const waves = [...panel.querySelectorAll<SVGCircleElement>('[data-wave]')];
     const buttons = [
       ...panel.querySelectorAll<HTMLButtonElement>('[data-select-stage]'),
@@ -237,22 +240,23 @@ const stages = [
     )!;
     const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
     let paused = reducedMotion.matches;
+    let animate = !reducedMotion.matches;
     const initialBounds = panel.getBoundingClientRect();
     let visible = initialBounds.bottom > 0 && initialBounds.top < innerHeight;
     let stage = 0;
-    let elapsed = 0;
+    const duration = 3600;
+    let elapsed = paused ? duration : 0;
     let previous = 0;
     let frame = 0;
-    const duration = 3600;
     const clamp = (value: number) => Math.max(0, Math.min(1, value));
     const ease = (value: number) => {
       const t = clamp(value);
       return t * t * (3 - 2 * t);
     };
     const draw = () => {
       const progres
```

**File**: `web-astro/src/components/Header.astro` (modified, +86/-84)
```diff
@@ -18,93 +18,95 @@ const edition = editions[locale];
 ---
 
 <header class:list={['site-header', { 'reader-header': reader }]}>
-  <a
-    class="brand"
-    dir="ltr"
-    href={edition.home}
-    aria-label={t('AI Agents in Depth')}
-    ><span class="brand-mark" aria-hidden="true">a<span>i</span></span><span
-      >AI Agents<span class="brand-secondary">in Depth</span></span
-    ></a
-  >
-  <nav class="header-nav" aria-label={t('Main navigation')}>
-    <a href={`${edition.home}#contents`}>{t('The book')}</a>
-    <a class="desktop-link" href={`${repo}/tree/main/chapter${chapterNumber}`}
-      >{t('Experiments')} <Icon name="external" size={15} /></a
+  <div class="site-header-inner">
+    <a
+      class="brand"
+      dir="ltr"
+      href={edition.home}
+      aria-label={t('AI Agents in Depth')}
+      ><span class="brand-mark" aria-hidden="true">a<span>i</span></span><span
+        >AI Agents<span class="brand-secondary">in Depth</span></span
+      ></a
     >
-    <a href={repo}>GitHub <Icon name="external" size={15} /></a>
-  </nav>
-  <div class="header-tools">
-    <details class="language-picker">
-      <summary aria-label={t('Language')} title={edition.name}
-        ><span aria-hidden="true">◎</span>
-        <span class="current-language">{edition.name}</span>
-        <span aria-hidden="true">⌄</span></summary
+    <nav class="header-nav" aria-label={t('Main navigation')}>
+      <a href={`${edition.home}#contents`}>{t('The book')}</a>
+      <a class="desktop-link" href={`${repo}/tree/main/chapter${chapterNumber}`}
+        >{t('Experiments')} <Icon name="external" size={15} /></a
       >
-      <nav aria-label={t('Language')}>
-        {
-          locales.map((language) => (
-            <a
-              href={
-                reader
-                  ? withBase(
-                      `/${editions[language].directory}/chapter${chapterNumber}${editions[language].suffix}/`,
-                    )
-                  : editions[language].home
-              }
-              lang={language}
-              hreflang={language}
-              dir={editions[language].dir}
-              aria-current={language === locale ? 'page' : undefined}
+      <a href={repo}>GitHub <Icon name="external" size={15} /></a>
+    </nav>
+    <div class="header-tools">
+      <details class="language-picker">
+        <summary aria-label={t('Language')} title={edition.name}
+          ><span aria-hidden="true">◎</span>
+          <span class="current-language">{edition.name}</span>
+          <span aria-hidden="true">⌄</span></summary
+        >
+        <nav aria-label={t('Language')}>
+          {
+            locales.map((language) => (
+              <a
+                href={
+                  reader
+                    ? withBase(
+                        `/${editions[language].directory}/chapter${chapterNumber}${editions[language].suffix}/`,
+                      )
+                    : editions[language].home
+                }
+                lang={language}
+                hreflang={language}
+                dir={editions[language].dir}
+                aria-current={language === locale ? 'page' : undefined}
+              >
+                {editions[language].name}
+                <span aria-hidden="true">{language === locale ? '✓' : ''}</span>
+              </a>
+            ))
+          }
+          <div class="machine-language-heading" dir="auto">
+            机器翻译 / Machine translation<br /><small
+              >未经审核 / Not vetted</small
             >
-              {editions[language].name}
-              <span aria-hidden="true">{language === locale ? '✓' : ''}</span>
-            </a>
-          ))
-        }
-        <div class="machine-language-heading" dir="auto">
-          机器翻译 / Machine translation<br /><small
-            >未经审核 / Not vetted</small
+          </div>
+          {
+            machineTranslation.languages.map((language) => (
+              <a
+                data-machine-language={language.name}
+                href={`${reader ? withBase(`/book-en/chapter${chapterNumber}/`) : editions.en.home}?translate=${language.locale}`}
+                lang={language.locale}
+                dir={'dir' in language ? language.dir : 'ltr'}
+              >
+                {language.label}
+                <small aria-hidden="true">MT</small>
+              </a>
+            ))
+          }
+        </nav>
+      </details>
+      <button
+        class="icon-button theme-toggle"
+        type="button"
+        aria-label={t('Switch to dark theme')}
+        title={t('Switch color theme')}
+        hidden
+        ><span class="moon-icon"><Icon name="moon" /></span><span
+          class="sun-icon"><Icon name="sun" /></span
+        ></button
+      >
+      {
+        reader && (
+          <button
+            class="icon-button mobile-menu"
+            type="button"
+            aria-label={t('Open reading navigation')}
+            aria-expanded="false"
+    
```

**File**: `web-astro/src/styles/global.css` (modified, +10/-9)
```diff
@@ -118,13 +118,17 @@ img {
 }
 .site-header {
   height: 92px;
+  border-bottom: 1px solid var(--line);
+}
+.site-header-inner {
+  width: 100%;
+  height: 100%;
   max-width: 1600px;
-  margin: auto;
+  margin-inline: auto;
   display: flex;
   align-items: center;
   gap: 3rem;
   padding: 0 48px;
-  border-bottom: 1px solid var(--line);
 }
 .brand {
   display: flex;
@@ -463,16 +467,11 @@ img {
   font-weight: 750;
   color: var(--ink);
 }
-@media (min-width: 1600px) {
-  .site-header {
-    border-inline: 1px solid var(--line);
-  }
-}
 @media (max-width: 1100px) {
   .page-width {
     padding-inline: 36px;
   }
-  .site-header {
+  .site-header-inner {
     padding-inline: 30px;
     gap: 20px;
   }
@@ -498,6 +497,8 @@ img {
 @media (max-width: 760px) {
   .site-header {
     height: 76px;
+  }
+  .site-header-inner {
     padding-inline: 20px;
   }
   .brand {
@@ -604,7 +605,7 @@ img {
   .header-nav a:first-child {
     display: none;
   }
-  .site-header {
+  .site-header-inner {
     gap: 10px;
   }
   .hero-actions {
```

---

### Incident Patch 12: `e36bb3c4` (2026-09-18)
**Commit Message**: fix(ch1): honour KIMI_BASE_URL in web-search-agent (#1108)

**File**: `chapter1/web-search-agent/config.py` (modified, +5/-1)
```diff
@@ -48,7 +48,11 @@ class Config:
     if not MOONSHOT_API_KEY:
         MOONSHOT_API_KEY = os.getenv("KIMI_API_KEY", "")
     
-    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
+    # 空值视为「未配置」，与共享注册表 Provider.resolved_base_url() 一致，
+    # 避免 .env 里留空的 KIMI_BASE_URL 把端点清空。
+    KIMI_BASE_URL: str = (
+        os.getenv("KIMI_BASE_URL", "").strip() or "https://api.moonshot.cn/v1"
+    )
     
     # 模型配置
     DEFAULT_MODEL: str = "kimi-k3"  # 使用最新的 Kimi K3 模型
```

**File**: `chapter1/web-search-agent/tests/test_agent.py` (modified, +1/-1)
```diff
@@ -304,7 +304,7 @@ def _rate_limit_error():
 
 
 def test_timeout_answer_names_the_budget_and_the_429_suspect():
-    """"Request timed out." alone reads like a network fault; the reader has
+    """ "Request timed out." alone reads like a network fault; the reader has
     to be told which knob to turn and that 429 retries can burn the budget."""
     instance = build_agent()
     instance._request_timeout = 180
```

**File**: `chapter1/web-search-agent/tests/test_config.py` (modified, +34/-0)
```diff
@@ -1,5 +1,10 @@
 """Unit tests for model mapping and provider selection."""
 
+import os
+import subprocess
+import sys
+from pathlib import Path
+
 import pytest
 from config import map_model_to_openrouter, resolve_llm_backend
 
@@ -76,3 +81,32 @@ def test_gpt5_prefers_openrouter_when_both_keys_exist(monkeypatch):
 def test_provider_resolution_requires_a_key():
     with pytest.raises(ValueError, match="No API key found"):
         resolve_llm_backend(None, "https://moonshot.test/v1", "kimi-k3")
+
+
+def _resolved_base_url(env_overrides):
+    """Read ``Config.KIMI_BASE_URL`` in a fresh interpreter.
+
+    It is a class attribute evaluated at import time, so probing it without a
+    module reload needs its own process.
+    """
+    completed = subprocess.run(
+        [sys.executable, "-c", "import config; print(config.Config.KIMI_BASE_URL)"],
+        cwd=Path(__file__).resolve().parents[1],
+        env={**os.environ, **env_overrides},
+        capture_output=True,
+        text=True,
+        check=True,
+    )
+    return completed.stdout.strip()
+
+
+def test_kimi_base_url_is_read_from_the_environment():
+    """env.example and the README document KIMI_BASE_URL, so it must take effect."""
+    assert _resolved_base_url({"KIMI_BASE_URL": "https://proxy.example.com/v1"}) == (
+        "https://proxy.example.com/v1"
+    )
+
+
+def test_blank_kimi_base_url_keeps_the_public_endpoint():
+    """A present-but-empty value means "not configured", not "no endpoint"."""
+    assert _resolved_base_url({"KIMI_BASE_URL": ""}) == "https://api.moonshot.cn/v1"
```

---

### Incident Patch 13: `7aae86cd` (2026-09-18)
**Commit Message**: fix(ch1): honour KIMI_BASE_URL in the learning-from-experience LLM agent (#1107)

**File**: `chapter1/learning-from-experience/llm_agent.py` (modified, +15/-3)
```diff
@@ -29,6 +29,7 @@ def _reasoning_safe_temperature(model, requested=1.0):
 # experiment runnable from a checkout where agentbook is not installed.
 try:
     from agentbook.providers import (
+        PROVIDERS,
         SUPPORTED_PROVIDERS,
         map_model_to_openrouter,
         resolve_backend,
@@ -41,6 +42,7 @@ def _reasoning_safe_temperature(model, requested=1.0):
         0, str(__import__("pathlib").Path(__file__).resolve().parents[2])
     )
     from agentbook.providers import (
+        PROVIDERS,
         SUPPORTED_PROVIDERS,
         map_model_to_openrouter,
         resolve_backend,
@@ -67,7 +69,7 @@ class LLMAgent:
     def __init__(self,
                  api_key: str = None,
                  model: str = "kimi-k3",  # Kimi K3 (see 实验 7-2)
-                 base_url: str = "https://api.moonshot.cn/v1",
+                 base_url: str | None = None,
                  temperature: float = 0.7,
                  max_experiences: int = 50,
                  provider: str | None = None):
@@ -77,7 +79,11 @@ def __init__(self,
         Args:
             api_key: Provider API key (or set the provider's env var)
             model: Model name (defaults to the selected provider's model)
-            base_url: API base URL
+            base_url: API base URL. Defaults to the kimi provider's own
+                resolution order -- the KIMI_BASE_URL environment variable,
+                then the public Moonshot endpoint -- so a proxy or regional
+                endpoint configured for the rest of the book is honoured here
+                too.
             temperature: Sampling temperature for generation
             max_experiences: Maximum number of experiences to store
         """
@@ -101,8 +107,14 @@ def __init__(self,
             self.provider = backend.provider
         else:
             primary_key = api_key or os.getenv("MOONSHOT_API_KEY")
+            # Honour the kimi provider's base-URL override (KIMI_BASE_URL) so a
+            # proxy or regional endpoint is not silently replaced by the public
+            # one, which would send the reader's key to the wrong host and come
+            # back as an authentication error. The dashscope branch above gets
+            # the same behaviour from resolve_backend.
+            primary_base_url = base_url or PROVIDERS["kimi"].resolved_base_url()
             self.api_key, resolved_base_url, self.model, self.using_openrouter = \
-                resolve_llm_backend(primary_key, base_url, model)
+                resolve_llm_backend(primary_key, primary_base_url, model)
             self.provider = "openrouter" if self.using_openrouter else "moonshot"
         self.base_url = resolved_base_url
         if self.using_openrouter:
```

**File**: `tests/test_ch1_learning_agent_kimi_base_url.py` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+"""Regression test for the chapter1 LLM learning agent ignoring KIMI_BASE_URL.
+
+The agent handed a hardcoded public endpoint to ``resolve_llm_backend``, so a
+reader who pointed ``KIMI_BASE_URL`` at a proxy or a regional deployment -- the
+override the shared provider registry declares for the ``kimi`` provider --
+still sent every request, and their key, to ``api.moonshot.cn``. The failure
+surfaced as an authentication error from the public host, which gives no hint
+that the configured endpoint was never used.
+
+The dashscope path already resolves its endpoint through
+``resolve_backend`` and therefore honours ``DASHSCOPE_BASE_URL``; the last test
+pins that asymmetry so it cannot be "fixed" in the wrong direction.
+"""
+
+import sys
+from pathlib import Path
+
+import pytest
+
+pytest.importorskip("openai")
+
+# chapter1/learning-from-experience is an experiment directory, not an
+# installed package, so it has to be importable by path.
+CH1_DIR = (
+    Path(__file__).resolve().parent.parent / "chapter1" / "learning-from-experience"
+).resolve()
+if str(CH1_DIR) not in sys.path:
+    sys.path.insert(0, str(CH1_DIR))
+
+from llm_agent import LLMAgent  # noqa: E402
+
+PUBLIC_MOONSHOT_BASE_URL = "https://api.moonshot.cn/v1"
+PROXY_BASE_URL = "https://proxy.example.com/v1"
+
+
+@pytest.fixture(autouse=True)
+def clean_provider_env(monkeypatch):
+    """Start every test from a known provider environment."""
+    for var in (
+        "LLM_PROVIDER",
+        "MOONSHOT_API_KEY",
+        "KIMI_API_KEY",
+        "KIMI_BASE_URL",
+        "OPENROUTER_API_KEY",
+        "OPENROUTER_MODEL",
+        "DASHSCOPE_API_KEY",
+        "DASHSCOPE_BASE_URL",
+    ):
+        monkeypatch.delenv(var, raising=False)
+    monkeypatch.setenv("MOONSHOT_API_KEY", "test-key")
+
+
+def test_kimi_base_url_reaches_the_client(monkeypatch):
+    monkeypatch.setenv("KIMI_BASE_URL", PROXY_BASE_URL)
+
+    agent = LLMAgent()
+
+    assert agent.base_url == PROXY_BASE_URL
+    assert str(agent.client.base_url).rstrip("/") == PROXY_BASE_URL
+
+
+def test_public_endpoint_remains_the_default():
+    agent = LLMAgent()
+
+    assert agent.base_url == PUBLIC_MOONSHOT_BASE_URL
+
+
+def test_explicit_base_url_wins_over_the_environment(monkeypatch):
+    monkeypatch.setenv("KIMI_BASE_URL", PROXY_BASE_URL)
+
+    agent = LLMAgent(base_url="https://explicit.example.com/v1")
+
+    assert agent.base_url == "https://explicit.example.com/v1"
+
+
+def test_dashscope_keeps_honouring_its_own_override(monkeypatch):
+    monkeypatch.delenv("MOONSHOT_API_KEY", raising=False)
+    monkeypatch.setenv("DASHSCOPE_API_KEY", "test-key")
+    dashscope_url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
+    monkeypatch.setenv("DASHSCOPE_BASE_URL", dashscope_url)
+
+    agent = LLMAgent(provider="dashscope")
+
+    assert agent.base_url == dashscope_url
```

---

### Incident Patch 14: `0afe062e` (2026-09-18)
**Commit Message**: fix(ch1): replace escapable eval sandbox in calculate with AST whitelist (#1096)

agent.py's calculate evaluated expressions with
    eval(expression, {"__builtins__": {}}, allowed_names)
An empty __builtins__ dict only hides built-in function names; attribute
access, literals and method calls still work, so the classic
().__class__ ... .get("system")("...") escape executed arbitrary shell
commands (reproduced locally on Python 3.14). Replace it with an AST
whitelist (calc_sandbox.py) that rejects Attribute, Subscript and
non-whitelisted Call nodes before the interpreter sees them. The name
surface (all public math members plus abs/round/min/max) and the
caret-to-power rewrite are preserved.

Tests: new tests/test_calc_sandbox.py (15 cases, stdlib-only) pin plain
arithmetic plus all known escape shapes; full context suite green
(26 passed in tests/, 27 in top-level regression).

**File**: `chapter1/context/agent.py` (modified, +9/-10)
```diff
@@ -16,6 +16,8 @@
 import math
 from datetime import datetime
 
+from calc_sandbox import safe_eval
+
 # Configure logging
 logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
 logger = logging.getLogger(__name__)
@@ -260,17 +262,14 @@ def calculate(expression: str) -> Dict[str, Any]:
         try:
             logger.info(f"Calculating: {expression}")
             
-            # Sanitize expression - only allow safe mathematical operations
-            allowed_names = {
-                k: v for k, v in math.__dict__.items() if not k.startswith("__")
-            }
-            allowed_names.update({"abs": abs, "round": round, "min": min, "max": max})
-            
-            # Replace common operations for clarity
+            # Sanitize the syntax tree, not just the builtins dict: an empty
+            # __builtins__ still permits attribute access, so the old eval()
+            # sandbox was escapable via ().__class__ ... . The AST whitelist
+            # in calc_sandbox.py rejects those node shapes before the
+            # interpreter sees them. Keep the caret-to-power rewrite so
+            # existing prompts are unchanged.
             expression = expression.replace("^", "**")
-            
-            # Evaluate the expression
-            result = eval(expression, {"__builtins__": {}}, allowed_names)
+            result = safe_eval(expression)
             
             return {
                 "expression": expression,
```

**File**: `chapter1/context/calc_sandbox.py` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+"""Safe mathematical expression evaluation via an AST whitelist.
+
+Background
+----------
+The calculator previously evaluated expressions with
+
+    eval(expression, {"__builtins__": {}}, allowed_names)
+
+Emptying __builtins__ only removes the built-in *function names*. Attribute
+access, literals and method calls never go through __builtins__, so the
+classic object-obfuscation escape works unchanged:
+
+    ().__class__.__mro__[1].__subclasses__()[i]...get("system")("echo pwned")
+
+The only way to make such an expression inert is to validate the *syntax tree*
+and reject the node types (attribute access, subscripting, calls of anything
+not on an explicit whitelist) before the interpreter ever sees them.  This
+module does exactly that.  The name whitelist keeps every public attribute of
+math plus abs / round / min / max, mirroring the previous allowed_names dict,
+so the arithmetic surface the calculator supported is preserved.
+"""
+
+import ast
+import math
+
+# Names the calculator may reference: every public attribute of `math`
+# (functions such as sin/floor, constants such as pi/e) plus a handful of
+# Python builtins, mirroring the old allowed_names dict.
+ALLOWED_NAMES = {
+    name: getattr(math, name) for name in dir(math) if not name.startswith("_")
+}
+ALLOWED_NAMES.update({"abs": abs, "round": round, "min": min, "max": max})
+
+_DECIMAL_OPS = (
+    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow)
+_UNARY_OPS = (ast.USub, ast.UAdd)
+_COMPARE_OPS = (ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Eq, ast.NotEq)
+
+
+class UnsafeExpression(ValueError):
+    """Raised when the expression uses syntax outside the calculator whitelist."""
+
+
+def _check_op(node, allowed):
+    if not isinstance(node, allowed):
+        raise UnsafeExpression(f"unsupported operator: {type(node).__name__}")
+
+
+def _check(node):
+    """Recursively validate that every node is on the whitelist."""
+    if isinstance(node, ast.Expression):
+        _check(node.body)
+    elif isinstance(node, ast.BinOp):
+        _check(node.left)
+        _check(node.right)
+        _check_op(node.op, _DECIMAL_OPS)
+    elif isinstance(node, ast.UnaryOp):
+        _check(node.operand)
+        _check_op(node.op, _UNARY_OPS)
+    elif isinstance(node, ast.Compare):
+        _check(node.left)
+        for comparator in node.comparators:
+            _check(comparator)
+        for op in node.ops:
+            _check_op(op, _COMPARE_OPS)
+    elif isinstance(node, ast.Call):
+        # Only whitelisted names may be called; anything else (method calls,
+        # attribute access, ...) aborts before reaching the interpreter.
+        if not isinstance(node.func, ast.Name) or node.func.id not in ALLOWED_NAMES:
+            raise UnsafeExpression("only whitelisted functions may be called")
+        for arg in node.args:
+            _check(arg)
+        for keyword in node.keywords:
+            if keyword.arg is None:
+                raise UnsafeExpression("**kwargs is not allowed")
+            _check(keyword.value)
+    elif isinstance(node, ast.Name):
+        if node.id not in ALLOWED_NAMES:
+            raise UnsafeExpression(f"unknown name: {node.id!r}")
+    elif isinstance(node, ast.Constant):
+        # Numeric literals only: strings/bytes are an attack surface.
+        if not isinstance(node.value, (int, float, complex, bool)):
+            raise UnsafeExpression("only numeric literals are allowed")
+    elif isinstance(node, (ast.List, ast.Tuple)):
+        for elt in node.elts:
+            _check(elt)
+    else:
+        # Everything else -- Attribute, Subscript, comprehensions, lambdas,
+        # f-strings ... -- is refused.
+        raise UnsafeExpression(f"unsupported syntax: {type(node).__name__}")
+
+
+def safe_eval(expression):
+    """Evaluate a whitelisted mathematical expression and return its value.
+
+    Raises:
+        UnsafeExpression: if the expression uses syntax outside the whitelist.
+        ValueError: for empty input or unparsable expressions.
+    """
+    if not isinstance(expression, str) or not expression.strip():
+        raise ValueError("empty expression")
+    # Keep the caret-to-power rewrite the original calculator applied, so
+    # existing prompts keep working.
+    expression = expression.replace("^", "**")
+    try:
+        tree = ast.parse(expression, mode="eval")
+    except SyntaxError as exc:
+        raise ValueError(f"invalid expression: {exc}") from exc
+    _check(tree)
+    return eval(compile(tree, "<safe_calc>", "eval"), {"__builtins__": {}}, ALLOWED_NAMES)
\ No newline at end of file
```

**File**: `chapter1/context/tests/test_calc_sandbox.py` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+"""Tests for the AST-whitelist calculator sandbox in calc_sandbox.py.
+
+The previous implementation evaluated expressions with eval() and an empty
+__builtins__ dict.  Emptied builtins only hide built-in function names;
+attribute access, literals and method calls still work, so a classic
+object-obfuscation expression such as
+
+    ().__class__.__mro__[1].__subclasses__()[i]...get("system")("...")
+
+executed arbitrary shell commands.  These tests pin both sides of the fix:
+ordinary arithmetic still works, and every known escape shape is rejected by
+the AST whitelist.  They use only the standard library, so they run offline
+and in key-less CI.
+"""
+
+import math
+
+import pytest
+
+from calc_sandbox import safe_eval, UnsafeExpression
+
+
+def assert_rejected(payload):
+    with pytest.raises((UnsafeExpression, ValueError)):
+        safe_eval(payload)
+
+
+class TestPlainArithmetic:
+    def test_precedence_and_parentheses(self):
+        assert safe_eval("2+3*4") == 14
+        assert safe_eval("(2+3)*4") == 20
+
+    def test_power_and_mod(self):
+        assert safe_eval("2**10") == 1024
+        assert safe_eval("7 % 3") == 1
+
+    def test_caret_is_power_rewrite(self):
+        assert safe_eval("2^3") == 8
+
+    def test_unary_minus(self):
+        assert safe_eval("-5") == -5
+
+    def test_math_functions_and_constants(self):
+        assert safe_eval("sin(pi/2)") == pytest.approx(1.0)
+        assert safe_eval("log(e)") == pytest.approx(1.0)
+        assert safe_eval("floor(3.7)") == 3
+
+    def test_abs_round_min_max(self):
+        assert safe_eval("abs(-7)") == 7
+        assert safe_eval("round(3.14159, 2)") == pytest.approx(3.14)
+        assert safe_eval("round(3.14159, ndigits=3)") == pytest.approx(3.142)
+        assert safe_eval("max(1, 5, 3)") == 5
+        assert safe_eval("min([3, 1, 2])") == 1
+
+    def test_comparison(self):
+        assert safe_eval("1 < 2 < 3") is True
+
+
+class TestEscapeRejected:
+    def test_object_obfuscation_shapes(self):
+        # Every shape below was previously a working escape on the same
+        # values: attribute access is the load-bearing primitive.
+        assert_rejected("().__class__.__mro__[1].__subclasses__()")
+        assert_rejected(
+            "().__class__.__mro__[1].__subclasses__()[174]"
+            ".__init__.__globals__.get('system')('echo pwned')"
+        )
+        assert_rejected("[].__class__.__base__.__subclasses__()")
+        assert_rejected("'x'.__class__")
+        assert_rejected("(1).__class__")
+
+    def test_unwhitelisted_names_and_calls(self):
+        assert_rejected("__import__('os')")
+        assert_rejected("open('/etc/passwd')")
+        assert_rejected("eval('2+2')")
+        assert_rejected("exec('x=1')")
+        assert_rejected("print('hi')")
+        assert_rejected("foo(1)")
+
+    def test_subscript_is_rejected(self):
+        assert_rejected("[1, 2][0]")
+
+    def test_non_numeric_literal_rejected(self):
+        assert_rejected("'abc'")
+        assert_rejected("b'abc'")
+        assert_rejected("None")
+
+    def test_lambda_and_comprehensions_rejected(self):
+        assert_rejected("lambda x: x")
+        assert_rejected("[x for x in [1]]")
+
+    def test_walrus_and_if_expression_rejected(self):
+        assert_rejected("(x := 1)")
+        assert_rejected("1 if True else 2")
+
+    def test_empty_or_invalid_input(self):
+        assert_rejected("")
+        assert_rejected("   ")
+        assert_rejected("2 +")
+
+
+class TestPreservesLegacySemantics:
+    def test_names_that_previously_worked_still_work(self):
+        # All names from the old allowed_names dict (all public math members
+        # plus abs/round/min/max) must still be reachable.
+        for name in ("sin", "cos", "tan", "sqrt", "log", "floor", "ceil",
+                     "abs", "round", "min", "max", "pi", "e", "tau"):
+            assert name in math.__dict__ or name in ("abs", "round", "min", "max")
\ No newline at end of file
```

---

### Incident Patch 15: `f9ed2417` (2026-09-18)
**Commit Message**: fix(ch1): move live-key code_interpreter smoke script out of pytest collection (#1097)

tests/test_code_interpreter.py was collected by pytest but contains zero
assertions, and when SILICONFLOW_API_KEY is set it runs a real agent loop
against a real API -- making the regression command both a live-API caller
and a vacuous pass. Move it to tests/manual/check_code_interpreter.py
(manual smoke scripts live there; the check_ prefix keeps it out of pytest
collection) and point the README regression command at 'pytest .' so the
top-level test_grounding.py / test_experiment_1_1.py /
test_main_result_semantics.py join the run.

Verified: python -m pytest . = 37 passed in chapter1/context.

**File**: `chapter1/context/README.md` (modified, +11/-4)
```diff
@@ -447,10 +447,14 @@ The console prints two tables: a per-run **ablation study results** table and a
 #### Automated Regression Tests
 
 ```bash
-python -m pytest tests
+python -m pytest .
 ```
 
-Manual provider/API smoke scripts live under `tests/manual/` and require the corresponding API keys.
+`pytest .` collects both the `tests/` package and the top-level regression
+tests (`test_grounding.py`, `test_experiment_1_1.py`,
+`test_main_result_semantics.py`) that pin the experiment's claims. Manual
+provider/API smoke scripts live under `tests/manual/` and require the
+corresponding API keys.
 
 ### Understanding Results
 
@@ -997,10 +1001,13 @@ python main.py --mode ablation --cases 3
 #### 自动化回归测试
 
 ```bash
-python -m pytest tests
+python -m pytest .
 ```
 
-需要真实 API Key 的手动提供商/API 冒烟脚本放在 `tests/manual/`。
+`pytest .` 同时收集 `tests/` 目录与顶层回归测试（`test_grounding.py`、
+`test_experiment_1_1.py`、`test_main_result_semantics.py`），这些测试钉住
+实验的核心结论。需要真实 API Key 的手动提供商/API 冒烟脚本放在
+`tests/manual/`。
 
 ### 结果解读
 
```

**File**: `chapter1/context/tests/manual/check_code_interpreter.py` (renamed, +3/-3)
```diff
@@ -6,8 +6,8 @@
 import os
 from agent import ContextAwareAgent, ContextMode
 
-def test_code_interpreter():
-    """Test code interpreter integration"""
+def check_code_interpreter():
+    """Manual smoke test of the code_interpreter tool (requires a live agent/API)."""
     
     print("\n" + "="*60)
     print("🧪 CODE INTERPRETER TEST")
@@ -122,4 +122,4 @@ def test_code_interpreter():
 
 
 if __name__ == "__main__":
-    test_code_interpreter()
+    check_code_interpreter()
```

#### Recent Merged Pull Requests:
- **PR #1152** (2026-09-23): docs(i18n): sync #1151 ch2 preserved-thinking additions to all translations (@bojieli)
- **PR #1151** (2026-09-23): docs(ch2): 补充 Claude preserved thinking——前缀改动会让历史 thinking 失效 (@bojieli)
- **PR #1149** (2026-09-23): feat(site): number chapters in the reader rail (@Dada-liu)
- **PR #1146** (2026-09-23): ci: install httpx and MkDocs for offline test jobs (@bojieli)
- **PR #1145** (2026-09-22): docs: 保留完整内容，重写中文实验 README 的教学流程 (@bojieli)
- **PR #1144** (2026-09-22): Revert truncated experiment READMEs and restore full content (@bojieli)
- **PR #1143** (2026-09-22): docs: 将全部中文实验 README 改写为教学教程 (@bojieli)
- **PR #1142** (2026-09-22): docs(ch1): clarify the first experiment walkthroughs (@bojieli)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
