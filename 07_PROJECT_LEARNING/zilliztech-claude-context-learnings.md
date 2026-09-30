# Forensic Learning Record (Deep Inspection): zilliztech/claude-context

> **Canonical Artifact**: `07_PROJECT_LEARNING/zilliztech-claude-context-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zilliztech/claude-context](https://github.com/zilliztech/claude-context))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:03:05.093Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zilliztech/claude-context`
- **Description**: Code search MCP for Claude Code. Make entire codebase the context for any coding agent.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12578 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended',
    ],
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    env: {
        node: true,
        es6: true,
    },
    rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
    },
    ignorePatterns: [
        'dist',
        'node_modules',
        '*.js',
        '*.d.ts',
    ],
}; 
```

### Core Architecture Module: `evaluation/analyze_and_plot_mcp_efficiency.py`
```
#!/usr/bin/env python3
"""
Analyze retrieval results and create MCP efficiency chart using real data.
This script loads data from the actual result directories and generates seaborn charts.
"""

import json
import os
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
import pandas as pd
from typing import Dict, List, Tuple


def normalize_file_path(file_path: str) -> str:
    """Normalize file paths."""
    if file_path.startswith("/"):
        file_path = file_path[1:]
    return file_path


def calculate_metrics(hits: List[str], oracles: List[str]) -> Dict[str, float]:
    """Calculate precision, recall, and F1-score."""
    if not hits and not oracles:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}

    # Normalize file paths
    hits_set = set(normalize_file_path(f) for f in hits)
    oracles_set = set(normalize_file_path(f) for f in oracles)

    # Calculate intersection
    intersection = hits_set.intersection(oracles_set)

    # Calculate metrics
    precision = len(intersection) / len(hits_set) if hits_set else 0.0
    recall = len(intersection) / len(oracles_set) if oracles_set else 0.0
    f1 = (
        2 * (precision * recall) / (precision + recall)
        if (precision + recall) > 0
        else 0.0
    )

    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "num_hits": len(hits_set),
        "num_oracles": len(oracles_set),
        "num_correct": len(intersection),
    }


def load_method_results(method_dirs: List[str], method_name: str) -> Dict:
    """Load and aggregate results from multiple runs of the same method."""

    all_f1_scores = []
    all_token_usage = []
    all_tool_calls = []
    successful_instances = set()

    print(f"\nLoading {method_name} method data from {len(method_dirs)} runs...")

    for run_idx, run_dir in enumerate(method_dirs):
        print(f"  Processing run {run_idx + 1}: {run_dir}")

        if not os.path.exists(run_dir):
            print(f"    Warning: Directory {run_dir} does not exist")
            continue

        run_success_count = 0
        run_f1_scores = []
        run_tokens = []
        run_tools = []

        for item in os.listdir(run_dir):
            instance_dir = os.path.join(run_dir, item)
            result_file = os.path.join(instance_dir, "result.json")

            if os.path.isdir(instance_dir) and os.path.exists(result_file):
                try:
                    with open(result_file, "r") as f:
                        data = json.load(f)

                    # Calculate F1-score
                    hits = data.get("hits", [])
                    oracles = data.get("oracles", [])
                    metrics = calculate_metrics(hits, oracles)

                    # Extract other metrics
                    tokens = data.get("token_usage", {}).get("total_tokens", 0)
                    tools = data.get("tool_stats", {}).get("total_tool_calls", 0)

                    # Store data
                    run_f1_scores.append(metrics["f1"])
                    run_tokens.append(tokens)
                    run_tools.append(tools)

                    successful_instances.add(item)
                    run_success_count += 1

                except Exception as e:
                    print(f"    Warning: Failed to load {result_file}: {e}")
                    continue

        print(f"    Loaded {run_success_count} successful instances")

        # Add this run's data to overall collection
        all_f1_scores.extend(run_f1_scores)
        all_token_usage.extend(run_tokens)
        all_tool_calls.extend(run_tools)

    # Calculate aggregated statistics
    results = {
        "method_name": method_name,
        "total_runs": len(method_dirs),
        "successful_instances": len(successful_instances),
        "avg_f1": np.mean(all_f1_scores) if all_f1_scores else 0,
        "std_f1": np.std(all_f1_scores) if all_f1_scores else 0,
        "avg_tokens": np.mean(all_token_usage) if all_token_usage else 0,
        "std_tokens": np.std(all_token_usage) if all_token_usage else 0,
        "avg_tools": np.mean(all_tool_calls) if all_tool_calls else 0,
        "std_tools": np.std(all_tool_calls) if all_tool_calls else 0,
    }

    print(f"  Aggregated results:")
    print(f"    Avg F1-Score: {results['avg_f1']:.3f} ± {results['std_f1']:.3f}")
    print(f"    Avg Tokens: {results['avg_tokens']:.0f} ± {results['std_tokens']:.0f}")
    print(
        f"    Avg Tool Calls: {results['avg_tools']:.1f} ± {results['std_tools']:.1f}"
    )

    return results


def create_efficiency_chart(both_results: Dict, grep_results: Dict):
    """Create the efficiency comparison chart using Seaborn."""

    # Set the aesthetic style
    sns.set_style("whitegrid")
    sns.set_palette("husl")

    # Prepare data for plotting
    data = {
        "Method": [
            "With claude-context MCP",
            "Baseline",
            "With claude-context MCP",
            "Baseline",
        ],
        "Metric": ["Token Usage", "Token Usage", "Tool Calls", "Tool Calls"],
        "Value": [
            both_results["avg_tokens"] / 1000,  # Convert to thousands
            grep_results["avg_tokens"] / 1000,
            both_results["avg_tools"],
            grep_results["avg_tools"],
        ],
    }

    df = pd.DataFrame(data)

    # Create figure with custom styling
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 7))

    # Custom color palette
    colors = ["#3498db", "#e74c3c"]  # Modern blue and red

    # Token Usage subplot
    token_data = df[df["Metric"] == "Token Usage"]
    sns.barplot(
        data=token_data,
        x="Method",
        y="Value",
        ax=ax1,
        palette=colors,
        alpha=0.8,
        edgecolor="white",
        linewidth=2,
    )

    ax1.set_title("Token Usage", fontsize=18, fontweight="bold", pad=20)
    ax1.set_ylabel("Average Tokens (K)", fontsize=14, fontweight="bold")
    ax1.set_xlabel("")
    ax1.tick_params(axis="x", labelsize=12)
    ax1.tick_params(axis="y", labelsize=12)
    # Set y-axis range with some padding
    ax1.set_ylim(0, max(token_data["Value"]) * 1.15)

    # Add value labels for token usage
    token_values = [
        both_results["avg_tokens"] / 1000,
        grep_results["avg_tokens"] / 1000,
    ]
    for i, val in enumerate(token_values):
        ax1.text(
            i,
            val + 2,
            f"{val:.1f}K",
            ha="center",
            va="bottom",
            fontweight="bold",
            fontsize=13,
            color=colors[i],
        )

    # Add improvement annotation for tokens
    token_reduction = (
        (grep_results["avg_tokens"] - both_results["avg_tokens"])
        / grep_results["avg_tokens"]
        * 100
    )
    mid_height = max(token_values) * 0.8
    ax1.annotate(
        f"-{token_reduction:.1f}%",
        xy=(0.5, mid_height),
        xycoords="data",
        ha="center",
        va="center",
        fontsize=16,
        fontweight="bold",
        bbox=dict(
            boxstyle="round,pad=0.5",
            facecolor="#2ecc71",
            alpha=0.8,
            edgecolor="white",
            linewidth=2,
        ),
        color="white",
    )

    # Tool Calls subplot
    tool_data = df[df["Metric"] == "Tool Calls"]
    sns.barplot(
        data=tool_data,
        x="Method",
        y="Value",
        ax=ax2,
        palette=colors,
        alpha=0.8,
        edgecolor="white",
        linewidth=2,
    )

    ax2.set_title("Tool Calls", fontsize=18, fontweight="bold", pad=20)
    ax2.set_ylabel("Average Number of Calls", fontsize=14, fontweight="bold")
    ax2.set_xlabel("")
    ax2.tick_params(axis="x", labelsize=12)
    ax2.tick_params(axis="y", labelsize=12)
    # Set y-axis range with some padding
    ax2.set_ylim(0, max(tool_data["Value"]) * 1.15)

    # Add value labels for tool calls
    tool_values = [both_results["avg_tools"], grep_results["avg_tools"]]
    for i, val in enumerate(tool_values):
        a
```

### Core Architecture Module: `evaluation/client.py`
```
import asyncio
from langgraph.prebuilt import create_react_agent
from utils.format import (
    extract_conversation_summary,
    extract_file_paths_from_edits,
    calculate_total_tokens,
)


class Evaluator:
    """Evaluator class for running LLM queries with MCP tools"""

    def __init__(self, llm_model, tools):
        """
        Initialize the Evaluator

        Args:
            llm_model: LangChain LLM model instance (required)
            tools: List of tools to use (required)
        """
        self.llm_model = llm_model
        self.tools = tools
        self.agent = create_react_agent(self.llm_model, self.tools)

        # Setup event loop for sync usage
        try:
            self.loop = asyncio.get_event_loop()
        except RuntimeError:
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

    async def async_run(self, query, codebase_path=None):
        """Internal async method to run the query"""
        response = await self.agent.ainvoke(
            {"messages": [{"role": "user", "content": query}]},
            config={"recursion_limit": 150},
        )

        # Extract data without printing
        conversation_summary, tool_stats = extract_conversation_summary(response)
        token_usage = calculate_total_tokens(response)

        if codebase_path:
            file_paths = extract_file_paths_from_edits(response, codebase_path)
        else:
            file_paths = []

        return conversation_summary, token_usage, file_paths, tool_stats

    def run(self, query: str, codebase_path=None):
        """
        Run a query synchronously

        Args:
            query (str): The query to execute
            codebase_path (str): Path to the codebase for relative path conversion

        Returns:
            tuple: (response, conversation_summary, token_usage, file_paths)
        """

        return asyncio.run(self.async_run(query, codebase_path))

```

### Core Architecture Module: `evaluation/generate_subset_json.py`
```
#!/usr/bin/env python3
"""
Generate swe_verified_15min1h_2files_instances.json from the subset analysis
"""

import json
import re
from datasets import load_dataset

def parse_patch_files(patch_content):
    """Parse patch content to extract the number of modified files"""
    if not patch_content:
        return []
    
    file_pattern = r'^diff --git a/(.*?) b/(.*?)$'
    files = []
    
    for line in patch_content.split('\n'):
        match = re.match(file_pattern, line)
        if match:
            file_path = match.group(1)
            files.append(file_path)
    
    return files

def main():
    print("Loading SWE-bench_Verified dataset...")
    dataset = load_dataset("princeton-nlp/SWE-bench_Verified")
    instances = list(dataset['test'])
    
    print("Filtering instances for: 15min-1hour difficulty + 2 patch files...")
    
    # Filter for the specific subset
    subset_instances = []
    
    for instance in instances:
        difficulty = instance.get('difficulty', 'Unknown')
        
        # Parse main patch to count files
        patch_content = instance.get('patch', '')
        patch_files = parse_patch_files(patch_content)
        oracle_count = len(patch_files)
        
        # Check if it matches our criteria
        if difficulty == '15 min - 1 hour' and oracle_count == 2:
            subset_instances.append(instance)
    
    print(f"Found {len(subset_instances)} instances matching criteria")
    
    # Create the JSON structure that _prepare_instances expects
    output_data = {
        "metadata": {
            "description": "SWE-bench_Verified subset: 15min-1hour difficulty with 2 patch files",
            "source_dataset": "princeton-nlp/SWE-bench_Verified", 
            "extraction_date": "2024",
            "filter_criteria": {
                "difficulty": "15 min - 1 hour",
                "patch_files_count": 2
            },
            "total_instances": len(subset_instances),
            "statistics": {
                "total_instances_in_original": 500,
                "subset_count": len(subset_instances),
                "percentage_of_original": round((len(subset_instances) / 500) * 100, 1)
            }
        },
        "instances": subset_instances
    }
    
    # Save to JSON file
    output_file = "swe_verified_15min1h_2files_instances.json"
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"Generated {output_file} with {len(subset_instances)} instances")
    
    # Verify the structure
    print("\nVerifying JSON structure...")
    with open(output_file, 'r') as f:
        loaded_data = json.load(f)
    
    print(f"✓ Contains 'instances' key: {'instances' in loaded_data}")
    print(f"✓ Contains 'metadata' key: {'metadata' in loaded_data}")
    print(f"✓ Number of instances: {len(loaded_data['instances'])}")
    print(f"✓ First instance has required fields:")
    
    if loaded_data['instances']:
        first_instance = loaded_data['instances'][0]
        required_fields = ['instance_id', 'repo', 'base_commit', 'problem_statement']
        for field in required_fields:
            has_field = field in first_instance
            print(f"   - {field}: {'✓' if has_field else '✗'}")
    
    print(f"\nFile successfully generated: {output_file}")
    print("This file can be used with BaseRetrieval._prepare_instances()")

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `evaluation/retrieval/base.py`
```
import json
import os
import traceback
from pathlib import Path
from tqdm.auto import tqdm
from typing import List, Dict, Any, Tuple

from datasets import load_from_disk, load_dataset

from utils.file_management import get_remaining_instances


from utils.file_management import ContextManager, clone_repo

import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


class BaseRetrieval:
    def __init__(
        self, *, dataset_name_or_path, splits, output_dir, max_instances=None, **kwargs
    ):
        self.dataset_name_or_path = dataset_name_or_path
        self.splits = splits
        self.output_dir = output_dir
        self.max_instances = max_instances
        self.instances = self._prepare_instances()
        self.prompt = """The codebase is at {repo_path}.

Issue: 
<issue>
{issue}
</issue>

Your task is to identify and edit the files that need to be modified to resolve the issue.
Focus on making the necessary changes to completely address the problem.
Use the available tools step by step to accomplish this goal. The primary objective is to edit the existing code files. No validation or testing is required.
"""

    def _prepare_instances(self) -> List[Dict]:
        if Path(self.dataset_name_or_path).exists():
            # Check if it's a JSON file
            if self.dataset_name_or_path.endswith(".json"):
                with open(self.dataset_name_or_path, "r") as f:
                    data = json.load(f)
                    # If it's our custom JSON format with instances data
                    if "instances" in data:
                        logger.info(
                            f"Loaded {len(data['instances'])} instances from JSON file"
                        )
                        if "metadata" in data and "statistics" in data["metadata"]:
                            logger.info(f"Statistics: {data['metadata']['statistics']}")
                        # Create a simple dict that mimics HuggingFace dataset structure
                        dataset = {"test": data["instances"]}
                    elif "test" in data:
                        dataset = {"test": data["test"]}
                    else:
                        # Assume the JSON file itself contains the instances
                        dataset = {"test": data if isinstance(data, list) else [data]}
                dataset_name = os.path.basename(self.dataset_name_or_path).replace(
                    ".json", ""
                )
            else:
                dataset = load_from_disk(self.dataset_name_or_path)
                dataset_name = os.path.basename(self.dataset_name_or_path)
        else:
            dataset = load_dataset(self.dataset_name_or_path)
            dataset_name = self.dataset_name_or_path.replace("/", "__")

        instances = []
        from datasets import DatasetDict

        if isinstance(dataset, DatasetDict):
            available_splits = set(dataset.keys())
            if set(self.splits) - available_splits != set():
                missing_splits = set(self.splits) - available_splits
                logger.warning(f"Unknown splits {missing_splits}")

        for split in self.splits:
            logger.info(f"Loading split '{split}'")
            from datasets import DatasetDict, IterableDatasetDict

            if isinstance(dataset, (DatasetDict, IterableDatasetDict)):
                split_instances = list(dataset[split])
            elif isinstance(dataset, dict) and split in dataset:
                # Handle our custom JSON format
                split_instances = dataset[split]
            else:
                split_instances = list(dataset)
            instances.extend(split_instances)
            logger.info(f"Loaded {len(split_instances)} instances from split '{split}'")

        output_file = Path(self.output_dir) / f"{dataset_name}__retrieval.jsonl"
        output_file.parent.mkdir(parents=True, exist_ok=True)

        # Check for both JSONL format (for legacy compatibility) and directory structure format
        remaining_instances, processed_count = self._filter_existing_instances(
            instances, output_file
        )

        if not remaining_instances:
            logger.info("All instances already processed")
            return []

        # Apply max_instances limit if specified
        if self.max_instances is not None and self.max_instances > 0:
            # Check if we've already processed enough instances
            if processed_count >= self.max_instances:
                logger.info(
                    f"Already processed {processed_count} instances, which meets or exceeds max_instances={self.max_instances}. No more instances to process."
                )
                return []

            # Calculate how many more instances we need to process
            remaining_needed = self.max_instances - processed_count
            if len(remaining_instances) > remaining_needed:
                logger.info(
                    f"Limiting to {remaining_needed} more instances (processed: {processed_count}, target: {self.max_instances}, remaining: {len(remaining_instances)})"
                )
                remaining_instances = remaining_instances[:remaining_needed]

        return remaining_instances

    def _filter_existing_instances(
        self, instances: List[Dict], output_file: Path
    ) -> Tuple[List[Dict], int]:
        """
        Filter instances to exclude those that have already been processed.

        This method supports both output formats:
        1. JSONL format (legacy): results saved to a single JSONL file
        2. Directory format: results saved to individual directories with result.json files

        Args:
            instances: List of instances to filter
            output_file: Path to the JSONL output file (used for legacy format detection)

        Returns:
            Tuple of (remaining_instances, processed_count)
        """
        # First check JSONL format for backward compatibility
        if output_file.exists():
            # JSONL format already handled by get_remaining_instances
            remaining_instances = get_remaining_instances(instances, output_file)
            processed_count = len(instances) - len(remaining_instances)
            return remaining_instances, processed_count
        else:
            # Check directory structure format
            processed_instance_ids = set()

            # Check if output directory exists and has subdirectories with result.json
            if os.path.exists(self.output_dir):
                for item in os.listdir(self.output_dir):
                    instance_dir = os.path.join(self.output_dir, item)
                    result_file = os.path.join(instance_dir, "result.json")
                    if os.path.isdir(instance_dir) and os.path.exists(result_file):
                        processed_instance_ids.add(item)

            processed_count = len(processed_instance_ids)
            if processed_count > 0:
                logger.info(
                    f"Found {processed_count} existing instances in directory format. Will skip them."
                )

            # Filter out already processed instances
            remaining_instances = [
                instance
                for instance in instances
                if instance["instance_id"] not in processed_instance_ids
            ]

            return remaining_instances, processed_count

    def build_index(self, repo_path: str) -> Any:
        raise NotImplementedError("Subclasses must implement this method")

    def search(self, repo_path: str, issue: str, k: int = 20) -> List[Dict[str, Any]]:
        raise NotImplementedError("Subclasses must implement this method")

    def run(self, root_dir: str, token: str = "git") -> None:
        for instance in tqdm(self.instances, desc="Running retrieval"):
            instance_id = instance["instance_id"]
            repo 
```

### Core Architecture Module: `evaluation/retrieval/custom.py`
```
import traceback
from typing import List, Dict, Any
import asyncio
from contextlib import asynccontextmanager
from retrieval.base import BaseRetrieval
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools
import os
import logging
import sys
import time
from client import Evaluator
from utils.llm_factory import llm_factory
from utils.constant import project_path, evaluation_path
from utils.format import extract_oracle_files_from_patch, create_unified_diff_file
import json
import traceback
from tqdm.auto import tqdm
from typing import List, Dict, Any

from utils.file_management import ContextManager, clone_repo

logger = logging.getLogger(__name__)


class CustomRetrieval(BaseRetrieval):
    def __init__(
        self,
        llm_type: str,
        llm_model: str,
        retrieval_types: List[str],
        *,
        dataset_name_or_path,
        splits,
        output_dir,
        **kwargs,
    ):
        """
        Initialize CustomRetrieval with specified retrieval types.
        
        Args:
            llm_type: Type of LLM to use
            llm_model: LLM model name
            retrieval_types: List containing "cc", "grep", or both
            dataset_name_or_path: Dataset path
            splits: Dataset splits
            output_dir: Output directory
            **kwargs: Additional arguments
        """
        super().__init__(
            dataset_name_or_path=dataset_name_or_path,
            splits=splits,
            output_dir=output_dir,
            **kwargs,
        )

        # Validate retrieval types
        valid_types = {"cc", "grep"}
        if not isinstance(retrieval_types, list):
            raise ValueError("retrieval_types must be a list")
        if not all(rt in valid_types for rt in retrieval_types):
            raise ValueError(
                f"retrieval_types must contain only 'cc' and/or 'grep', got: {retrieval_types}"
            )
        if not retrieval_types:
            raise ValueError("retrieval_types cannot be empty")

        self.retrieval_types = retrieval_types
        self.llm_model = llm_factory(llm_type, llm_model)
        self.mcp_client = self._create_mcp_client()

    def _create_mcp_client(self) -> MultiServerMCPClient:
        """Create MCP client based on retrieval types"""
        servers = {
            "filesystem": {
                "command": sys.executable,
                "args": [str(evaluation_path / "servers/read_server.py"),],
                "transport": "stdio",
            },
            "edit": {
                "command": sys.executable,
                "args": [str(evaluation_path / "servers/edit_server.py"),],
                "transport": "stdio",
            },
        }

        # Add CC server if needed
        if "cc" in self.retrieval_types:
            servers["claude-context"] = {
                # "command": "node",
                # "args": [str(project_path / "packages/mcp/dist/index.js")],  # For development environment
                "command": "npx",
                "args": ["-y", "@zilliz/claude-context-mcp@0.1.0"],  # For reproduction environment
                "env": {
                    "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY"),
                    "MILVUS_ADDRESS": os.getenv("MILVUS_ADDRESS"),
                    "EMBEDDING_BATCH_SIZE": os.getenv("EMBEDDING_BATCH_SIZE", "100"),
                },
                "transport": "stdio",
            }

        # Add Grep server if needed
        if "grep" in self.retrieval_types:
            servers["grep"] = {
                "command": sys.executable,
                "args": [str(evaluation_path / "servers/grep_server.py"),],
                "transport": "stdio",
            }

        return MultiServerMCPClient(servers)

    @asynccontextmanager
    async def mcp_sessions_context(self):
        """Context manager for MCP sessions and tools loading"""
        # Build session context based on retrieval types
        session_names = ["filesystem", "edit"]

        # Add CC session if needed
        if "cc" in self.retrieval_types:
            session_names.append("claude-context")

        # Add Grep session if needed
        if "grep" in self.retrieval_types:
            session_names.append("grep")

        # Create the appropriate context manager based on which sessions we need
        if len(session_names) == 2:  # filesystem + edit
            async with self.mcp_client.session(
                "filesystem"
            ) as fs_session, self.mcp_client.session("edit") as edit_session:
                sessions = {
                    "filesystem": fs_session,
                    "edit": edit_session,
                }
                yield await self._load_tools_from_sessions(sessions)
        elif len(session_names) == 3:
            if "claude-context" in session_names:
                async with self.mcp_client.session(
                    "filesystem"
                ) as fs_session, self.mcp_client.session(
                    "edit"
                ) as edit_session, self.mcp_client.session(
                    "claude-context"
                ) as cc_session:
                    sessions = {
                        "filesystem": fs_session,
                        "edit": edit_session,
                        "claude-context": cc_session,
                    }
                    yield await self._load_tools_from_sessions(sessions)
            else:  # grep
                async with self.mcp_client.session(
                    "filesystem"
                ) as fs_session, self.mcp_client.session(
                    "edit"
                ) as edit_session, self.mcp_client.session(
                    "grep"
                ) as grep_session:
                    sessions = {
                        "filesystem": fs_session,
                        "edit": edit_session,
                        "grep": grep_session,
                    }
                    yield await self._load_tools_from_sessions(sessions)
        else:  # all 4 sessions
            async with self.mcp_client.session(
                "filesystem"
            ) as fs_session, self.mcp_client.session(
                "edit"
            ) as edit_session, self.mcp_client.session(
                "claude-context"
            ) as cc_session, self.mcp_client.session(
                "grep"
            ) as grep_session:
                sessions = {
                    "filesystem": fs_session,
                    "edit": edit_session,
                    "claude-context": cc_session,
                    "grep": grep_session,
                }
                yield await self._load_tools_from_sessions(sessions)

    async def _load_tools_from_sessions(self, sessions: Dict):
        """Load tools from the provided sessions"""
        fs_tools = await load_mcp_tools(sessions["filesystem"])
        edit_tools = await load_mcp_tools(sessions["edit"])

        # Get basic tools
        edit_tool = next((tool for tool in edit_tools if tool.name == "edit"), None,)

        # Start with filesystem tools
        search_tools = [
            tool
            for tool in fs_tools
            if tool.name in ["read_file", "list_directory", "directory_tree"]
        ]

        # Add edit tool
        if edit_tool:
            search_tools.append(edit_tool)

        # Initialize CC-specific tools
        cc_tools = {
            "index_tool": None,
            "indexing_status_tool": None,
            "clear_index_tool": None,
            "search_code_tool": None,
        }

        # Load CC tools if needed
        if "cc" in self.retrieval_types and "claude-context" in sessions:
            cc_tool_list = await load_mcp_tools(sessions["claude-context"])

            cc_tools["index_tool"] = next(
                (tool for tool in cc_tool_list if tool.name == "index_codebase"), None
            )
            cc_tools["indexing_status_tool"] = next(
                (tool for t
```

### Core Architecture Module: `evaluation/run_evaluation.py`
```
import os
from argparse import ArgumentParser
from typing import List, Optional

from retrieval.custom import CustomRetrieval
from utils.constant import evaluation_path, project_path

import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main(
    dataset_name_or_path: str,
    output_dir: str,
    retrieval_types: List[str],
    llm_type: str = "openai",
    llm_model: Optional[str] = None,
    splits: List[str] = ["test"],
    root_dir: str = str(evaluation_path / "repos"),
    max_instances: Optional[int] = 5,
):
    """
    Main function to run custom retrieval.
    
    Args:
        dataset_name_or_path: Dataset path or name
        output_dir: Output directory for results
        retrieval_types: List of retrieval types to use ('cc', 'grep', or both)
        llm_type: Type of LLM to use
        llm_model: LLM model name
        splits: Dataset splits to process
        root_dir: Root directory for repositories
        max_instances: Maximum number of instances to process
    """
    logger.info(f"Starting custom retrieval with types: {retrieval_types}")

    retrieval = CustomRetrieval(
        dataset_name_or_path=dataset_name_or_path,
        splits=splits,
        output_dir=output_dir,
        retrieval_types=retrieval_types,
        llm_type=llm_type,
        llm_model=llm_model,
        max_instances=max_instances,
    )

    retrieval.run(root_dir, token=os.environ.get("GITHUB_TOKEN", "git"))


def parse_retrieval_types(value: str) -> List[str]:
    """Parse comma-separated retrieval types string into list"""
    types = [t.strip().lower() for t in value.split(",")]
    valid_types = {"cc", "grep"}

    for t in types:
        if t not in valid_types:
            raise ValueError(
                f"Invalid retrieval type '{t}'. Must be one of: {valid_types}"
            )

    return types


if __name__ == "__main__":
    parser = ArgumentParser(
        description="Custom Retrieval for SWE-bench with flexible retrieval types"
    )
    parser.add_argument(
        "--dataset_name_or_path",
        type=str,
        # default="SWE-bench/SWE-bench_Lite",
        default="swe_verified_15min1h_2files_instances.json",
        help="Dataset name or path",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default=str(evaluation_path / "retrieval_results_custom"),
        help="Output directory",
    )
    parser.add_argument(
        "--retrieval_types",
        type=parse_retrieval_types,
        default="cc,grep",
        help="Comma-separated list of retrieval types to use. Options: 'cc', 'grep', or 'cc,grep' (default: 'cc,grep')",
    )
    parser.add_argument(
        "--llm_type",
        type=str,
        choices=["openai", "ollama", "moonshot"],
        # default="moonshot",
        default="openai",
        # default="anthropic",
        help="LLM type",
    )
    parser.add_argument(
        "--llm_model",
        type=str,
        # default="kimi-k2-0711-preview",
        default="gpt-4o-mini",
        # default="claude-sonnet-4-20250514",
        help="LLM model name, e.g. gpt-4o-mini",
    )
    parser.add_argument(
        "--splits", nargs="+", default=["test"], help="Dataset splits to process"
    )
    parser.add_argument(
        "--root_dir",
        type=str,
        default=str(evaluation_path / "repos"),
        help="Temporary directory for repositories",
    )
    parser.add_argument(
        "--max_instances",
        type=int,
        default=5,
        help="Maximum number of instances to process (default: 5, set to -1 for all)",
    )

    args = parser.parse_args()
    main(**vars(args))

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #423** (2026-08-13): **fix: zilliztech/claude-context#421**
  *Symptoms*: ## Summary  Grammar loaders in `packages/core/src/splitter/ast-splitter.ts` were required eagerly at module load, unconditionally and without error handling. On macOS arm64, the unsigned `tree-sitter-cpp`/`tree-sitter-scala` prebuilds fail `dlopen` with `ERR_DLOPEN_FAILED`, crashing the whole MCP server at startup for **every** user — even ones with pure TypeScript/JavaScript codebases and zero C++/Scala files.  This PR makes per-language grammar loading lazy and defensive. Grammars are now `require()`d on first use (inside a try/catch), so a broken grammar only degrades that one language:  - AST splitting is disabled for the affected language - A warning is logged (`[ASTSplitter] ⚠️ Failed to load ...`) - Files of that language fall back to the existing LangChain character-based splitter  The rest of the pipeline (and every other language) keeps working normally.  ## Why this fixes the issue  The crash was self-inflicted: **any** single broken parser took down the server for all languages, regardless of what the user's codebase actually contains. Lazy, guarded loading confines the failure to exactly the language whose grammar is broken. The upstream unsigned-binary problem (arguably a `tree-sitter-cpp`/`tree-sitter-scala` packaging bug) now becomes a graceful degradation instead of a hard, unrecoverable startup crash.  ## Implementation details  - Replaced the module-level `require` block with a `LANGUAGE_PARSER_LOADERS` map of lazy loader functions. - Added `loadLanguagePar
  **Post-Mortem & Fix Analysis**:
  > Addressed review comment 3772389966 (failedLanguages memoization): added a test that reloads the module fresh (`jest.resetModules()`), then asserts two `split()` calls on the broken cpp grammar invoke the loader and `console.warn` exactly once — a per-file re-`require` regression now fails the suite. Verified: 8/8 core test suites pass, `tsc --noEmit` clean. Commit c7f2270.
  > Superseded by #426 — this PR was auto-closed when the head branch was recreated without shared history with master (my earlier force-push caused it). #426 is the same change (lazy grammar loading + failedLanguages memoization, review feedback addressed) on a branch based on current master.

- **Issue #414** (2026-07-28): **clear_index does not reclaim disk space in milvus/minio volumes (data leak)**
  *Symptoms*: 

- **Issue #407** (2026-07-14): **docs: add CLAUDE.md and AGENTS.md repository guide**
  *Symptoms*: ## What  Adds a `CLAUDE.md` repository guide (with `AGENTS.md` as a symlink to it), and removes the `CLAUDE.md` line from `.gitignore` so the shared guide can be tracked.  `CLAUDE.md` documents:  - **Monorepo layout** — the pnpm workspace (`core` / `mcp` / `vscode-extension` / `chrome-extension`) and how the frontends consume `core/dist` via `workspace:*`. - **Commands** — build / lint / typecheck, and the two different test runners (Jest for `core`, the Node built-in runner via `tsx` for `mcp`). - **Architecture** — the `Context` orchestrator and its pluggable embedding / vector-db / splitter interfaces, the two control-flow error types, incremental Merkle-DAG sync, layered ignore-pattern resolution, and the MCP server's "stdout is reserved for the protocol" constraint. - **Conventions** — the Conventional Commits scopes used in this repo.  ## Why  Gives contributors a single, accurate description of the architecture and workflow instead of reverse-engineering it from the source, and lets the coding tools many of us use pick up the same context.  `AGENTS.md` is a symlink to `CLAUDE.md`, so tools following either convention read the same content.  ## Note on `.gitignore`  `.gitignore` previously listed `CLAUDE.md` (treating it as a personal/local file). This PR drops that one line so the shared guide is committed; `.claude/*` stays ignored. Happy to revert that part if you'd rather keep `CLAUDE.md` local and ship only `AGENTS.md`.

- **Issue #397** (2026-06-22): **Bug: .gitignore negation patterns (!pattern) not supported, causing tracked directories to be silently excluded from index**
  *Symptoms*: ## Bug Description  When a `.gitignore` file contains wildcard + negation patterns (a common gitignore idiom), `claude-context-core` silently excludes the negated directories from indexing. This is because `getIgnorePatternsFromFile` loads all non-comment lines from every `.*ignore` file in the codebase root — including `.gitignore` — but there is no negation (`!`) support in `isPatternMatch`.  ## Root Cause  In `packages/core/dist/context.js`:  1. **`getIgnorePatternsFromFile`** loads all lines except empty and `#` comments. Negation lines like `!wp-content/plugins/app` are loaded as literal patterns.  2. **`isPatternMatch`** has no negation handling. The `!wp-content/plugins/app` literal pattern never matches any real path (the `!` prefix breaks glob matching), so it is silently inert — it does NOT whitelist/un-ignore anything.  3. The wildcard line (e.g. `wp-content/plugins/*`) correctly matches subdirectories, but the negation that should reverse it has no effect.  ## Reproduction  A `.gitignore` with this common pattern:  ```gitignore wp-content/plugins/* !wp-content/plugins/app !wp-content/plugins/backoffice ```  This is valid gitignore syntax: ignore all plugins except the listed ones. Git respects the negations. `claude-context` does not.  **Result:** `wp-content/plugins/app` and `wp-content/plugins/backoffice` are **completely excluded** from the index even though they are tracked by git and explicitly whitelisted. In our project this caused ~770 PHP/JS files across 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. This has been fixed on master and released in 0.1.15.  The indexer now uses gitignore-compatible matching for ignore patterns, including ordered negation rules like `ignored/*` followed by `!ignored/keep`. The same matcher is used for initial indexing and incremental sync so those paths stay consistent. Dotfiles and dot-directories remain excluded by the existing default behavior.  Closing this as fixed, but please reopen or file a follow-up if 0.1.15 still misses an explicitly unignored path.
  > Fixed and released in 0.1.15.

- **Issue #396** (2026-06-13): **feat(core): CI semantic index — collection override, Qwen3-4B OpenRouter, Postgres cache**
  *Symptoms*: Enables the CovestLabs/workflows code-index pipeline. COLLECTION_NAME override (fixes cross-machine collection collision), qwen/qwen3-embedding-4b OpenRouter model (dim 2560), pluggable disk|postgres embedding cache (shared, content-addressed, plain psql). Disk default unchanged; typecheck+build green.
  **Post-Mortem & Fix Analysis**:
  > Opened against the wrong repo by mistake — this belongs in my fork. Closing.

- **Issue #390** (2026-06-08): **fix(mcp): show error when embedding model unavailable**
  *Symptoms*: Description:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 

- **Issue #386** (2026-07-14): **fix(core): make Merkle root hashing deterministic**
  *Symptoms*: ## Summary - build the Merkle DAG root hash from sorted file paths instead of Map insertion order - add a regression test that builds identical file-hash maps in different insertion orders and checks the root id stays stable  ## Why `buildMerkleDAG()` already adds child nodes in `sortedPaths` order, but the root node data was still built from the unsorted `Map` key order. When the same file hashes are inserted in a different traversal order, the root id can change even though the files did not.  `MerkleDAG.compare()` treats changed node ids as added/removed, so an insertion-order-only root change can make the synchronizer do unnecessary file-state comparisons and snapshot writes.  ## Tests - `cd packages/core && node_modules/.bin/jest src/sync/synchronizer.test.ts --runInBand` - `./node_modules/.bin/tsc --build packages/core --force` - `git diff --check` 

- **Issue #385** (2026-07-14): **fix(mcp): derive default version from package metadata**
  *Symptoms*: ## Summary - derive the default MCP server version from `packages/mcp/package.json` instead of the stale hard-coded `1.0.0` - preserve the `MCP_SERVER_VERSION` environment override - add focused regression coverage for the package default and override paths  ## Why `createMcpConfig()` passes `config.version` into the MCP server metadata. The package is currently versioned as `0.1.13`, but a default install still reports `1.0.0` unless `MCP_SERVER_VERSION` is set.  ## Tests - `./node_modules/.bin/tsc --build packages/core --force` - `cd packages/mcp && node --import tsx --test "src/config.test.ts"` - `./node_modules/.bin/tsc --build packages/mcp --force` - `git diff --check`  Note: `pnpm --filter @zilliz/claude-context-mcp test -- --test-name-pattern 'server version'` attempted to run through the local pnpm shim, but pnpm 11 aborted with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` before executing tests, so I used the package's underlying `node --import tsx --test` command directly. 

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

### Incident Patch 1: `6fc318b4` (2026-07-14)
**Commit Message**: fix(mcp): derive default version from package metadata

Use the MCP package version as the default server version while preserving the MCP_SERVER_VERSION override.

**File**: `packages/mcp/src/config.test.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { readFileSync } from "node:fs";
+import { createMcpConfig } from "./config.js";
+
+const mcpPackage = JSON.parse(
+    readFileSync(new URL("../package.json", import.meta.url), "utf8")
+) as { version: string };
+
+function withEnvOverride(name: string, value: string | undefined, run: () => void): void {
+    const originalValue = process.env[name];
+
+    if (value === undefined) {
+        delete process.env[name];
+    } else {
+        process.env[name] = value;
+    }
+
+    try {
+        run();
+    } finally {
+        if (originalValue === undefined) {
+            delete process.env[name];
+        } else {
+            process.env[name] = originalValue;
+        }
+    }
+}
+
+test("uses the MCP package version as the default server version", () => {
+    withEnvOverride("MCP_SERVER_VERSION", undefined, () => {
+        const config = createMcpConfig();
+
+        assert.equal(config.version, mcpPackage.version);
+    });
+});
+
+test("allows MCP_SERVER_VERSION to override the package default", () => {
+    withEnvOverride("MCP_SERVER_VERSION", "custom-test-version", () => {
+        const config = createMcpConfig();
+
+        assert.equal(config.version, "custom-test-version");
+    });
+});
```

**File**: `packages/mcp/src/config.ts` (modified, +18/-1)
```diff
@@ -1,3 +1,4 @@
+import { readFileSync } from "node:fs";
 import { envManager } from "@zilliz/claude-context-core";
 
 export interface ContextMcpConfig {
@@ -118,6 +119,22 @@ export function getEmbeddingModelForProvider(provider: string): string {
     }
 }
 
+function readMcpPackageVersion(): string {
+    try {
+        const packageJsonUrl = new URL("../package.json", import.meta.url);
+        const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version?: unknown };
+        if (typeof packageJson.version === "string" && packageJson.version.trim()) {
+            return packageJson.version;
+        }
+    } catch (error) {
+        console.warn(`[DEBUG] ⚠️  Unable to read MCP package version: ${error}`);
+    }
+
+    return "1.0.0";
+}
+
+const defaultMcpServerVersion = readMcpPackageVersion();
+
 function getPositiveIntegerFromEnv(name: string): number | undefined {
     const rawValue = envManager.get(name);
     if (!rawValue) {
@@ -148,7 +165,7 @@ export function createMcpConfig(): ContextMcpConfig {
 
     const config: ContextMcpConfig = {
         name: envManager.get('MCP_SERVER_NAME') || "Context MCP Server",
-        version: envManager.get('MCP_SERVER_VERSION') || "1.0.0",
+        version: envManager.get('MCP_SERVER_VERSION') || defaultMcpServerVersion,
         // Embedding provider configuration
         embeddingProvider: (envManager.get('EMBEDDING_PROVIDER') as 'OpenAI' | 'VoyageAI' | 'Gemini' | 'Ollama' | 'OpenRouter') || 'OpenAI',
         embeddingModel: getEmbeddingModelForProvider(envManager.get('EMBEDDING_PROVIDER') || 'OpenAI'),
```

---

### Incident Patch 2: `d0a2effd` (2026-07-14)
**Commit Message**: fix(core): make Merkle root hashing deterministic

Build the Merkle DAG root from sorted file paths so identical file hash sets keep a stable root regardless of insertion order.

**File**: `packages/core/src/sync/synchronizer.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { FileSynchronizer } from './synchronizer';
+
+type TestableFileSynchronizer = {
+    buildMerkleDAG(fileHashes: Map<string, string>): {
+        rootIds: string[];
+    };
+};
+
+describe('FileSynchronizer Merkle DAG', () => {
+    it('uses stable root ids for identical file hashes inserted in different orders', () => {
+        const synchronizer = new FileSynchronizer('/tmp/project') as unknown as TestableFileSynchronizer;
+        const firstOrder = new Map([
+            ['src/a.ts', 'hash-a'],
+            ['src/b.ts', 'hash-b'],
+            ['README.md', 'hash-readme'],
+        ]);
+        const secondOrder = new Map([
+            ['README.md', 'hash-readme'],
+            ['src/b.ts', 'hash-b'],
+            ['src/a.ts', 'hash-a'],
+        ]);
+
+        const firstDag = synchronizer.buildMerkleDAG(firstOrder);
+        const secondDag = synchronizer.buildMerkleDAG(secondOrder);
+
+        expect(firstDag.rootIds).toEqual(secondDag.rootIds);
+    });
+});
```

**File**: `packages/core/src/sync/synchronizer.ts` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ export class FileSynchronizer {
 
         // Create a root node for the entire directory
         let valuesString = "";
-        keys.forEach(key => {
+        sortedPaths.forEach(key => {
             valuesString += fileHashes.get(key);
         });
         const rootNodeData = "root:" + valuesString;
```

---

### Incident Patch 3: `627eb2be` (2026-06-22)
**Commit Message**: fix(core): support gitignore negation patterns

Signed-off-by: Cheney Zhang <chen.zhang@zilliz.com>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "claude-context",
-    "version": "0.1.14",
+    "version": "0.1.15",
     "description": "A powerful code indexing tool with multi-platform support",
     "private": true,
     "scripts": {
```

**File**: `packages/core/package.json` (modified, +2/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "@zilliz/claude-context-core",
-    "version": "0.1.14",
+    "version": "0.1.15",
     "description": "Core indexing engine for Claude Context",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
@@ -19,6 +19,7 @@
         "faiss-node": "^0.5.1",
         "fs-extra": "^11.0.0",
         "glob": "^10.0.0",
+        "ignore": "^7.0.5",
         "langchain": "^0.3.27",
         "ollama": "^0.5.16",
         "openai": "^5.1.1",
```

**File**: `packages/core/src/context.ignore-patterns.test.ts` (modified, +64/-0)
```diff
@@ -211,6 +211,45 @@ describe('Context ignore pattern isolation', () => {
         ]);
     });
 
+    it('honors gitignore negation patterns during indexing', async () => {
+        const project = path.join(tempRoot, 'project-with-negation');
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'app'), { recursive: true });
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'backoffice'), { recursive: true });
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'unused'), { recursive: true });
+        await fs.writeFile(
+            path.join(project, '.gitignore'),
+            [
+                'wp-content/plugins/*',
+                '!wp-content/plugins/app',
+                '!wp-content/plugins/backoffice',
+                '',
+            ].join('\n')
+        );
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'app', 'main.md'), 'app should stay');
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'backoffice', 'admin.md'), 'backoffice should stay');
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'unused', 'skip.md'), 'unused should be ignored');
+
+        const vectorDatabase = createVectorDatabase();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: new TestSplitter(),
+        });
+
+        await context.indexCodebase(project);
+
+        const insertedDocuments = vectorDatabase.insert.mock.calls
+            .flatMap(([, documents]) => documents);
+        const indexedPaths = insertedDocuments
+            .map(document => document.relativePath.replace(/\\/g, '/'))
+            .sort();
+
+        expect(indexedPaths).toEqual([
+            'wp-content/plugins/app/main.md',
+            'wp-content/plugins/backoffice/admin.md',
+        ]);
+    });
+
     it('skips dotfiles and dot directories during initial indexing', async () => {
         const project = path.join(tempRoot, 'project');
         await fs.mkdir(path.join(project, '.config'), { recursive: true });
@@ -284,4 +323,29 @@ describe('Context ignore pattern isolation', () => {
         expect(fileHashes.has(path.join('src', 'Library', 'nested.md'))).toBe(true);
         expect(fileHashes.has(path.join('src', 'keep.md'))).toBe(true);
     });
+
+    it('honors gitignore negation patterns during sync hashing', async () => {
+        const project = path.join(tempRoot, 'sync-project-with-negation');
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'app'), { recursive: true });
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'backoffice'), { recursive: true });
+        await fs.mkdir(path.join(project, 'wp-content', 'plugins', 'unused'), { recursive: true });
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'app', 'main.md'), 'app should stay');
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'backoffice', 'admin.md'), 'backoffice should stay');
+        await fs.writeFile(path.join(project, 'wp-content', 'plugins', 'unused', 'skip.md'), 'unused should be ignored');
+
+        const synchronizer = new FileSynchronizer(
+            project,
+            [
+                'wp-content/plugins/*',
+                '!wp-content/plugins/app',
+                '!wp-content/plugins/backoffice',
+            ],
+            ['.md']
+        );
+        const fileHashes = await (synchronizer as any).generateFileHashes(project) as Map<string, string>;
+
+        expect(fileHashes.has(path.join('wp-content', 'plugins', 'app', 'main.md'))).toBe(true);
+        expect(fileHashes.has(path.join('wp-content', 'plugins', 'backoffice', 'admin.md'))).toBe(true);
+        expect(fileHashes.has(path.join('wp-content', 'plugins', 'unused', 'skip.md'))).toBe(false);
+    });
 });
```

**File**: `packages/core/src/context.ts` (modified, +4/-105)
```diff
@@ -22,6 +22,7 @@ import * as fs from 'fs';
 import * as path from 'path';
 import * as crypto from 'crypto';
 import { FileSynchronizer } from './sync/synchronizer';
+import { IgnoreMatcher } from './utils/ignore-matcher';
 
 /**
  * Thrown by indexCodebase / processFileList when an AbortSignal fires
@@ -811,15 +812,17 @@ export class Context {
         supportedExtensions: string[] = this.supportedExtensions
     ): Promise<string[]> {
         const files: string[] = [];
+        const ignoreMatcher = new IgnoreMatcher(ignorePatterns);
 
         const traverseDirectory = async (currentPath: string) => {
             const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
 
             for (const entry of entries) {
                 const fullPath = path.join(currentPath, entry.name);
+                const relativePath = path.relative(codebasePath, fullPath);
 
                 // Check if path matches ignore patterns
-                if (this.matchesIgnorePattern(fullPath, codebasePath, ignorePatterns)) {
+                if (ignoreMatcher.ignores(relativePath, entry.isDirectory())) {
                     continue;
                 }
 
@@ -1282,110 +1285,6 @@ export class Context {
         }
     }
 
-    /**
-     * Check if a path matches any ignore pattern
-     * @param filePath Path to check
-     * @param basePath Base path for relative pattern matching
-     * @returns True if path should be ignored
-     */
-    private matchesIgnorePattern(filePath: string, basePath: string, ignorePatterns: string[] = this.ignorePatterns): boolean {
-        const relativePath = path.relative(basePath, filePath);
-
-        // Always ignore dotfiles/dotdirs to stay aligned with
-        // FileSynchronizer.shouldIgnore. If these traversals diverge, files
-        // indexed here are never hashed by the synchronizer and their stale
-        // chunks linger in Milvus forever.
-        if (relativePath.split(path.sep).some(part => part.startsWith('.'))) {
-            return true;
-        }
-
-        if (ignorePatterns.length === 0) {
-            return false;
-        }
-
-        const normalizedPath = relativePath.replace(/\\/g, '/'); // Normalize path separators
-
-        for (const pattern of ignorePatterns) {
-            if (this.isPatternMatch(normalizedPath, pattern)) {
-                return true;
-            }
-        }
-
-        return false;
-    }
-
-    /**
-     * Simple glob pattern matching
-     * @param filePath File path to test
-     * @param pattern Glob pattern
-     * @returns True if pattern matches
-     */
-    private isPatternMatch(filePath: string, pattern: string): boolean {
-        const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
-        const normalizedPattern = pattern.replace(/\\/g, '/');
-        const cleanPattern = normalizedPattern.replace(/^\/+|\/+$/g, '');
-        const isRootAnchored = normalizedPattern.startsWith('/');
-        const isDirectoryPattern = normalizedPattern.endsWith('/');
-
-        if (!cleanPath || !cleanPattern) {
-            return false;
-        }
-
-        // Handle directory patterns (ending with /)
-        if (isDirectoryPattern) {
-            if (isRootAnchored) {
-                return this.simpleGlobMatch(cleanPath, cleanPattern) ||
-                    cleanPath.startsWith(`${cleanPattern}/`);
-            }
-
-            return this.matchesDirectoryPattern(cleanPath, cleanPattern);
-        }
-
-        if (isRootAnchored) {
-            return this.simpleGlobMatch(cleanPath, cleanPattern);
-        }
-
-        // Handle file patterns
-        if (cleanPattern.includes('/')) {
-            // Pattern with path separator - match exact path
-            return this.simpleGlobMatch(cleanPath, cleanPattern);
-        } else {
-            // Pattern without path separator - match filename in any directory
-            const fileName = path.basename(cleanPath);
-            return this.simpleGlob
```

**File**: `packages/core/src/sync/synchronizer.ts` (modified, +8/-104)
```diff
@@ -3,22 +3,23 @@ import * as path from 'path';
 import * as crypto from 'crypto';
 import { MerkleDAG } from './merkle';
 import * as os from 'os';
+import { IgnoreMatcher } from '../utils/ignore-matcher';
 
 export class FileSynchronizer {
     private fileHashes: Map<string, string>;
     private merkleDAG: MerkleDAG;
     private rootDir: string;
     private snapshotPath: string;
-    private ignorePatterns: string[];
     private supportedExtensions: string[];
+    private ignoreMatcher: IgnoreMatcher;
 
     constructor(rootDir: string, ignorePatterns: string[] = [], supportedExtensions: string[] = []) {
         this.rootDir = rootDir;
         this.snapshotPath = this.getSnapshotPath(rootDir);
         this.fileHashes = new Map();
         this.merkleDAG = new MerkleDAG();
-        this.ignorePatterns = ignorePatterns;
         this.supportedExtensions = supportedExtensions;
+        this.ignoreMatcher = new IgnoreMatcher(ignorePatterns);
     }
 
     private getSnapshotPath(codebasePath: string): string {
@@ -57,7 +58,7 @@ export class FileSynchronizer {
             const relativePath = path.relative(this.rootDir, fullPath);
 
             // Check if this path should be ignored BEFORE any file system operations
-            if (this.shouldIgnore(relativePath)) {
+            if (this.shouldIgnore(relativePath, entry.isDirectory())) {
                 continue; // Skip completely - no access at all
             }
 
@@ -72,7 +73,7 @@ export class FileSynchronizer {
 
             if (stat.isDirectory()) {
                 // Verify it's really a directory and not ignored
-                if (!this.shouldIgnore(relativePath)) {
+                if (!this.shouldIgnore(relativePath, true)) {
                     const subHashes = await this.generateFileHashes(fullPath);
                     const entries = Array.from(subHashes.entries());
                     for (let i = 0; i < entries.length; i++) {
@@ -82,7 +83,7 @@ export class FileSynchronizer {
                 }
             } else if (stat.isFile()) {
                 // Verify it's really a file and not ignored
-                if (!this.shouldIgnore(relativePath)) {
+                if (!this.shouldIgnore(relativePath, false)) {
                     const ext = path.extname(entry.name);
                     if (this.supportedExtensions.length > 0 && !this.supportedExtensions.includes(ext)) {
                         continue;
@@ -101,105 +102,8 @@ export class FileSynchronizer {
         return fileHashes;
     }
 
-    private shouldIgnore(relativePath: string): boolean {
-        // Always ignore hidden files and directories (starting with .)
-        const pathParts = relativePath.split(path.sep);
-        if (pathParts.some(part => part.startsWith('.'))) {
-            return true;
-        }
-
-        if (this.ignorePatterns.length === 0) {
-            return false;
-        }
-
-        // Normalize path separators and remove leading/trailing slashes
-        const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
-
-        if (!normalizedPath) {
-            return false; // Don't ignore root
-        }
-
-        // Check direct pattern matches first
-        for (const pattern of this.ignorePatterns) {
-            if (this.matchPattern(normalizedPath, pattern)) {
-                return true;
-            }
-        }
-
-        // Check if any parent directory is ignored
-        const normalizedPathParts = normalizedPath.split('/');
-        for (let i = 0; i < normalizedPathParts.length; i++) {
-            const partialPath = normalizedPathParts.slice(0, i + 1).join('/');
-            for (const pattern of this.ignorePatterns) {
-                if (this.matchPattern(partialPath, pattern)) {
-                    return true;
-                }
-            }
-        }
-
-        return false;
-    }
-
-    private matchPattern(filePath: string, pattern: string): boolean {
-        // Clean both path and pattern
-  
```

---

### Incident Patch 4: `f8e26729` (2026-06-05)
**Commit Message**: fix(mcp): show error when embedding model unavailable

**File**: `packages/core/src/context.embedding-error.test.ts` (added, +170/-0)
```diff
@@ -0,0 +1,170 @@
+import * as fs from 'fs/promises';
+import * as os from 'os';
+import * as path from 'path';
+import { Context, EmbeddingError } from './context';
+import { Embedding, EmbeddingVector } from './embedding';
+import { Splitter, CodeChunk } from './splitter';
+import { VectorDatabase } from './vectordb';
+
+type EmbeddingMode = 'throw' | 'empty' | 'short';
+
+class FailingEmbedding extends Embedding {
+    protected maxTokens = 8192;
+
+    constructor(private readonly mode: EmbeddingMode) {
+        super();
+    }
+
+    async detectDimension(): Promise<number> {
+        return 3;
+    }
+
+    async embed(_text: string): Promise<EmbeddingVector> {
+        return { vector: [1, 0, 0], dimension: 3 };
+    }
+
+    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
+        if (this.mode === 'throw') {
+            throw new Error('quota exhausted');
+        }
+
+        if (this.mode === 'empty') {
+            return [];
+        }
+
+        return texts.slice(0, Math.max(0, texts.length - 1)).map(() => ({
+            vector: [1, 0, 0],
+            dimension: 3,
+        }));
+    }
+
+    getDimension(): number {
+        return 3;
+    }
+
+    getProvider(): string {
+        return 'test';
+    }
+}
+
+class OneChunkSplitter implements Splitter {
+    async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
+        return [{
+            content: code,
+            metadata: {
+                startLine: 1,
+                endLine: 1,
+                language,
+                filePath,
+            },
+        }];
+    }
+
+    setChunkSize(): void { }
+    setChunkOverlap(): void { }
+}
+
+const createVectorDatabase = (): jest.Mocked<VectorDatabase> => ({
+    createCollection: jest.fn().mockResolvedValue(undefined),
+    createHybridCollection: jest.fn().mockResolvedValue(undefined),
+    dropCollection: jest.fn().mockResolvedValue(undefined),
+    hasCollection: jest.fn().mockResolvedValue(false),
+    listCollections: jest.fn().mockResolvedValue([]),
+    insert: jest.fn().mockResolvedValue(undefined),
+    insertHybrid: jest.fn().mockResolvedValue(undefined),
+    search: jest.fn().mockResolvedValue([]),
+    hybridSearch: jest.fn().mockResolvedValue([]),
+    delete: jest.fn().mockResolvedValue(undefined),
+    query: jest.fn().mockResolvedValue([]),
+    getCollectionDescription: jest.fn().mockResolvedValue(''),
+    checkCollectionLimit: jest.fn().mockResolvedValue(true),
+    getCollectionRowCount: jest.fn().mockResolvedValue(0),
+});
+
+describe('Context embedding failure handling', () => {
+    let tempRoot: string;
+    let originalHome: string | undefined;
+    let originalHybridMode: string | undefined;
+    let originalEmbeddingBatchSize: string | undefined;
+
+    beforeEach(async () => {
+        tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-context-embedding-error-'));
+        const homeDir = path.join(tempRoot, 'home');
+        await fs.mkdir(homeDir, { recursive: true });
+        originalHome = process.env.HOME;
+        originalHybridMode = process.env.HYBRID_MODE;
+        originalEmbeddingBatchSize = process.env.EMBEDDING_BATCH_SIZE;
+        process.env.HOME = homeDir;
+        process.env.HYBRID_MODE = 'false';
+    });
+
+    afterEach(async () => {
+        if (originalHome === undefined) {
+            delete process.env.HOME;
+        } else {
+            process.env.HOME = originalHome;
+        }
+        if (originalHybridMode === undefined) {
+            delete process.env.HYBRID_MODE;
+        } else {
+            process.env.HYBRID_MODE = originalHybridMode;
+        }
+        if (originalEmbeddingBatchSize === undefined) {
+            delete process.env.EMBEDDING_BATCH_SIZE;
+        } else {
+            process.env.EMBEDDING_BATCH_SIZE = originalEmbeddingBatchSize;
+        }
+        await fs.rm(tempRoot, { recursive: true, force: true });
+    });
+
+    async function createProject(): Promise
```

**File**: `packages/core/src/context.ts` (modified, +72/-1)
```diff
@@ -35,6 +35,23 @@ export class IndexAbortError extends Error {
     }
 }
 
+/**
+ * Thrown when the embedding API fails (quota exhausted, auth failure,
+ * network error, etc.). Propagates through processFileList so callers
+ * can distinguish a critical embedding failure from a per-file skip.
+ *
+ * Unlike a per-file read/parse error (which is logged and skipped),
+ * an EmbeddingError is always re-thrown so that the entire indexing
+ * pipeline stops. This prevents silent partial indexing: Milvus would
+ * otherwise receive zero vectors while the snapshot marks files as done.
+ */
+export class EmbeddingError extends Error {
+    constructor(message: string) {
+        super(message);
+        this.name = 'EmbeddingError';
+    }
+}
+
 const DEFAULT_SUPPORTED_EXTENSIONS = [
     // Programming languages
     '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
@@ -877,6 +894,10 @@ export class Context {
                         try {
                             await this.processChunkBuffer(chunkBuffer);
                         } catch (error) {
+                            // Embedding errors (such as API having no quota) halt the entire indexing process and propagate upwards.
+                            if (error instanceof EmbeddingError) {
+                                throw error;
+                            }
                             const searchType = isHybrid === true ? 'hybrid' : 'regular';
                             console.error(`[Context] ❌ Failed to process chunk batch for ${searchType}:`, error);
                             if (error instanceof Error) {
@@ -903,6 +924,9 @@ export class Context {
                 }
 
             } catch (error) {
+                if (error instanceof EmbeddingError) {
+                    throw error;
+                }
                 console.warn(`[Context] ⚠️  Skipping file ${filePath}: ${error}`);
             }
         }
@@ -914,6 +938,9 @@ export class Context {
             try {
                 await this.processChunkBuffer(chunkBuffer);
             } catch (error) {
+                if (error instanceof EmbeddingError) {
+                    throw error;
+                }
                 console.error(`[Context] ❌ Failed to process final chunk batch for ${searchType}:`, error);
                 if (error instanceof Error) {
                     console.error('[Context] Stack trace:', error.stack);
@@ -959,7 +986,18 @@ export class Context {
 
         // Generate embedding vectors
         const chunkContents = chunks.map(chunk => chunk.content);
-        const embeddings = await this.embedding.embedBatch(chunkContents);
+
+        let embeddings: EmbeddingVector[];
+        try {
+            embeddings = await this.embedding.embedBatch(chunkContents);
+        } catch (error) {
+            const errorMessage = error instanceof Error ? error.message : String(error);
+            // Include batch size in the log/error message so operators can
+            // identify how many chunks were lost when the API call failed.
+            console.error(`[Context] ❌ Embedding API failed (batch size: ${chunkContents.length}): ${errorMessage}`);
+            throw new EmbeddingError(`Embedding API error (batch size: ${chunkContents.length}): ${errorMessage}`);
+        }
+        this.validateEmbeddings(embeddings, chunks.length);
 
         if (isHybrid === true) {
             // Create hybrid vector documents
@@ -1024,6 +1062,39 @@ export class Context {
         }
     }
 
+    /**
+     * Validate that the embedding batch response is well-formed before writing
+     * any vectors to Milvus. Throwing EmbeddingError here aborts the entire
+     * indexing run so that no partial / empty vectors are persisted.
+     *
+     * @param embeddings   - Array of embedding vectors returned by the API.
+     * @param expectedCount - Number of chunks submitted in the batch request.
+     * @throws EmbeddingError if the response is missing, mism
```

---

### Incident Patch 5: `7326074a` (2026-05-22)
**Commit Message**: Merge pull request #378 from yuyua9/devc/dotfile-indexing-regression

test(core): cover dotfile skips during indexing

**File**: `packages/core/src/context.ignore-patterns.test.ts` (modified, +58/-0)
```diff
@@ -211,6 +211,64 @@ describe('Context ignore pattern isolation', () => {
         ]);
     });
 
+    it('skips dotfiles and dot directories during initial indexing', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(path.join(project, '.config'), { recursive: true });
+        await fs.mkdir(path.join(project, '.github', 'workflows'), { recursive: true });
+        await fs.mkdir(path.join(project, 'src', '.cache'), { recursive: true });
+        await fs.mkdir(path.join(project, 'src'), { recursive: true });
+
+        await fs.writeFile(path.join(project, '.hidden.md'), 'root hidden file should be ignored');
+        await fs.writeFile(path.join(project, '.config', 'settings.md'), 'hidden dir should be ignored');
+        await fs.writeFile(path.join(project, '.github', 'workflows', 'ci.md'), 'hidden nested dir should be ignored');
+        await fs.writeFile(path.join(project, 'src', '.cache', 'generated.md'), 'nested hidden dir should be ignored');
+        await fs.writeFile(path.join(project, 'src', 'keep.md'), 'regular file should stay');
+
+        const vectorDatabase = createVectorDatabase();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: new TestSplitter(),
+        });
+
+        await context.indexCodebase(project);
+
+        const insertedDocuments = vectorDatabase.insert.mock.calls
+            .flatMap(([, documents]) => documents);
+        const indexedPaths = insertedDocuments
+            .map(document => document.relativePath.replace(/\\/g, '/'))
+            .sort();
+
+        expect(indexedPaths).toEqual(['src/keep.md']);
+    });
+
+    it('keeps dotfile skipping active when request ignore patterns are provided', async () => {
+        const project = path.join(tempRoot, 'project-with-request-ignores');
+        await fs.mkdir(path.join(project, '.config'), { recursive: true });
+        await fs.mkdir(path.join(project, 'src'), { recursive: true });
+
+        await fs.writeFile(path.join(project, '.config', 'settings.ts'), 'hidden dir should be ignored');
+        await fs.writeFile(path.join(project, 'src', 'ignored.ts'), 'request ignore should be ignored');
+        await fs.writeFile(path.join(project, 'src', 'keep.ts'), 'regular file should stay');
+
+        const vectorDatabase = createVectorDatabase();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: new TestSplitter(),
+        });
+
+        await context.indexCodebase(project, undefined, false, ['src/ignored.ts']);
+
+        const insertedDocuments = vectorDatabase.insert.mock.calls
+            .flatMap(([, documents]) => documents);
+        const indexedPaths = insertedDocuments
+            .map(document => document.relativePath.replace(/\\/g, '/'))
+            .sort();
+
+        expect(indexedPaths).toEqual(['src/keep.ts']);
+    });
+
     it('treats leading-slash directory ignore patterns as root-anchored and recursive during sync', async () => {
         const project = path.join(tempRoot, 'project');
         await fs.mkdir(path.join(project, 'Library'), { recursive: true });
```

---

### Incident Patch 6: `291863a4` (2026-05-05)
**Commit Message**: fix(mcp): cancel background indexing on clear_index (#199) (#369)

clear_index returned "successfully cleared" while the background
indexing task kept embedding chunks and writing them into the
just-cleared collection, leaving the user with a half-rebuilt index
they did not ask for.

Add cooperative cancellation:

- core: indexCodebase / processFileList accept an optional AbortSignal
  and bail at the next file boundary with a new IndexAbortError.
- mcp: handlers track the AbortController + promise per absolute
  codebase path, abort and await the in-flight task before dropping
  the collection in handleClearIndex, and skip the indexfailed
  snapshot write when the failure is an IndexAbortError so the
  abort-then-clear path leaves no tombstone.

Tests: 4 new jest cases in packages/core covering the no-signal
regression, never-fires regression, mid-indexing abort (only the
files processed before the signal are split, no inserts fire), and
pre-aborted signal.

Closes #199

Co-authored-by: voidborne-d <voidborne-d@users.noreply.github.com>

**File**: `packages/core/src/context.abort.test.ts` (added, +207/-0)
```diff
@@ -0,0 +1,207 @@
+import * as fs from 'fs/promises';
+import * as os from 'os';
+import * as path from 'path';
+import { Context, IndexAbortError } from './context';
+import { Embedding, EmbeddingVector } from './embedding';
+import { Splitter, CodeChunk } from './splitter';
+import { VectorDatabase } from './vectordb';
+
+class TestEmbedding extends Embedding {
+    protected maxTokens = 8192;
+
+    async detectDimension(): Promise<number> {
+        return 3;
+    }
+
+    async embed(_text: string): Promise<EmbeddingVector> {
+        return { vector: [1, 0, 0], dimension: 3 };
+    }
+
+    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
+        return texts.map(() => ({ vector: [1, 0, 0], dimension: 3 }));
+    }
+
+    getDimension(): number {
+        return 3;
+    }
+
+    getProvider(): string {
+        return 'test';
+    }
+}
+
+class CountingSplitter implements Splitter {
+    public calls = 0;
+
+    constructor(private readonly onCall?: (callIndex: number) => void) { }
+
+    async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
+        this.calls += 1;
+        this.onCall?.(this.calls);
+        return [{
+            content: code,
+            metadata: {
+                startLine: 1,
+                endLine: code.split('\n').length,
+                language,
+                filePath,
+            },
+        }];
+    }
+
+    setChunkSize(): void { }
+    setChunkOverlap(): void { }
+}
+
+const createVectorDatabase = (): jest.Mocked<VectorDatabase> => ({
+    createCollection: jest.fn().mockResolvedValue(undefined),
+    createHybridCollection: jest.fn().mockResolvedValue(undefined),
+    dropCollection: jest.fn().mockResolvedValue(undefined),
+    hasCollection: jest.fn().mockResolvedValue(false),
+    listCollections: jest.fn().mockResolvedValue([]),
+    insert: jest.fn().mockResolvedValue(undefined),
+    insertHybrid: jest.fn().mockResolvedValue(undefined),
+    search: jest.fn().mockResolvedValue([]),
+    hybridSearch: jest.fn().mockResolvedValue([]),
+    delete: jest.fn().mockResolvedValue(undefined),
+    query: jest.fn().mockResolvedValue([]),
+    getCollectionDescription: jest.fn().mockResolvedValue(''),
+    checkCollectionLimit: jest.fn().mockResolvedValue(true),
+    getCollectionRowCount: jest.fn().mockResolvedValue(0),
+});
+
+describe('Context indexCodebase AbortSignal support', () => {
+    let tempRoot: string;
+    let originalHome: string | undefined;
+    let originalHybridMode: string | undefined;
+
+    beforeEach(async () => {
+        tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-context-abort-'));
+        const homeDir = path.join(tempRoot, 'home');
+        await fs.mkdir(homeDir, { recursive: true });
+        originalHome = process.env.HOME;
+        originalHybridMode = process.env.HYBRID_MODE;
+        process.env.HOME = homeDir;
+        process.env.HYBRID_MODE = 'false';
+    });
+
+    afterEach(async () => {
+        if (originalHome === undefined) {
+            delete process.env.HOME;
+        } else {
+            process.env.HOME = originalHome;
+        }
+        if (originalHybridMode === undefined) {
+            delete process.env.HYBRID_MODE;
+        } else {
+            process.env.HYBRID_MODE = originalHybridMode;
+        }
+        await fs.rm(tempRoot, { recursive: true, force: true });
+    });
+
+    it('completes normally when no signal is provided (regression guard)', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(project);
+        for (let i = 0; i < 3; i++) {
+            await fs.writeFile(path.join(project, `file${i}.ts`), `const v${i} = ${i};`);
+        }
+
+        const vectorDatabase = createVectorDatabase();
+        const splitter = new CountingSplitter();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: splitter,
+        });
+

```

**File**: `packages/core/src/context.ts` (modified, +31/-5)
```diff
@@ -23,6 +23,18 @@ import * as path from 'path';
 import * as crypto from 'crypto';
 import { FileSynchronizer } from './sync/synchronizer';
 
+/**
+ * Thrown by indexCodebase / processFileList when an AbortSignal fires
+ * mid-indexing. Callers (e.g. the MCP server's clear_index handler) use
+ * this to detect a cooperative cancel vs. a real failure.
+ */
+export class IndexAbortError extends Error {
+    constructor(message: string = 'Indexing aborted') {
+        super(message);
+        this.name = 'IndexAbortError';
+    }
+}
+
 const DEFAULT_SUPPORTED_EXTENSIONS = [
     // Programming languages
     '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
@@ -328,7 +340,8 @@ export class Context {
         forceReindex: boolean = false,
         additionalIgnorePatterns: string[] = [],
         additionalSupportedExtensions: string[] = [],
-        requestSplitter?: Splitter
+        requestSplitter?: Splitter,
+        signal?: AbortSignal
     ): Promise<{ indexedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
         const isHybrid = this.getIsHybrid();
         const searchType = isHybrid === true ? 'hybrid search' : 'semantic search';
@@ -376,7 +389,8 @@ export class Context {
                     percentage: Math.round(progressPercentage)
                 });
             },
-            splitter
+            splitter,
+            signal
         );
 
         console.log(`[Context] ✅ Codebase indexing completed! Processed ${result.processedFiles} files in total, generated ${result.totalChunks} code chunks`);
@@ -818,7 +832,8 @@ export class Context {
         filePaths: string[],
         codebasePath: string,
         onFileProcessed?: (filePath: string, fileIndex: number, totalFiles: number) => void,
-        splitter: Splitter = this.codeSplitter
+        splitter: Splitter = this.codeSplitter,
+        signal?: AbortSignal
     ): Promise<{ processedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
         const isHybrid = this.getIsHybrid();
         const EMBEDDING_BATCH_SIZE = Math.max(1, parseInt(envManager.get('EMBEDDING_BATCH_SIZE') || '100', 10));
@@ -831,6 +846,13 @@ export class Context {
         let limitReached = false;
 
         for (let i = 0; i < filePaths.length; i++) {
+            // Cooperative cancellation: bail out at the next file boundary so the
+            // caller (e.g. clear_index) can rely on no further inserts/snapshot
+            // writes happening once it has signalled abort. See issue #199.
+            if (signal?.aborted) {
+                throw new IndexAbortError(`Indexing aborted after processing ${processedFiles}/${filePaths.length} files`);
+            }
+
             const filePath = filePaths[i];
 
             try {
@@ -885,8 +907,8 @@ export class Context {
             }
         }
 
-        // Process any remaining chunks in the buffer
-        if (chunkBuffer.length > 0) {
+        // Process any remaining chunks in the buffer (skip if cancelled).
+        if (chunkBuffer.length > 0 && !signal?.aborted) {
             const searchType = isHybrid === true ? 'hybrid' : 'regular';
             console.log(`📝 Processing final batch of ${chunkBuffer.length} chunks for ${searchType}`);
             try {
@@ -899,6 +921,10 @@ export class Context {
             }
         }
 
+        if (signal?.aborted) {
+            throw new IndexAbortError(`Indexing aborted after processing ${processedFiles}/${filePaths.length} files`);
+        }
+
         return {
             processedFiles,
             totalChunks,
```

**File**: `packages/mcp/src/handlers.ts` (modified, +61/-6)
```diff
@@ -1,7 +1,7 @@
 import * as fs from "fs";
 import * as path from "path";
 import * as crypto from "crypto";
-import { Context, COLLECTION_LIMIT_MESSAGE, FileSynchronizer } from "@zilliz/claude-context-core";
+import { Context, COLLECTION_LIMIT_MESSAGE, FileSynchronizer, IndexAbortError } from "@zilliz/claude-context-core";
 import { SnapshotManager } from "./snapshot.js";
 import type { CodebaseIndexOptions, RequestSplitterType } from "./config.js";
 import { createRequestSplitter, isRequestSplitterType } from "./splitter.js";
@@ -12,6 +12,14 @@ export class ToolHandlers {
     private snapshotManager: SnapshotManager;
     private indexingStats: { indexedFiles: number; totalChunks: number } | null = null;
     private currentWorkspace: string;
+    /**
+     * Tracks active background indexing tasks per absolute codebase path so
+     * clear_index can cancel and await them before dropping the collection.
+     * Without this, a clear_index call returns "successfully cleared" while
+     * the background task keeps embedding chunks and writing them into the
+     * just-cleared collection (issue #199).
+     */
+    private indexingTasks: Map<string, { controller: AbortController; promise: Promise<void> }> = new Map();
 
     constructor(context: Context, snapshotManager: SnapshotManager) {
         this.context = context;
@@ -476,8 +484,27 @@ export class ToolHandlers {
             // Track the codebase path for syncing
             trackCodebasePath(absolutePath);
 
-            // Start background indexing - now safe to proceed
-            this.startBackgroundIndexing(absolutePath, forceReindex, splitterType, customIgnorePatterns, customFileExtensions, indexOptions);
+            // Start background indexing - now safe to proceed.
+            // Track the controller + promise so clear_index can cancel and
+            // await us before dropping the underlying collection.
+            const controller = new AbortController();
+            const promise = this.startBackgroundIndexing(
+                absolutePath,
+                forceReindex,
+                splitterType,
+                customIgnorePatterns,
+                customFileExtensions,
+                indexOptions,
+                controller.signal
+            ).finally(() => {
+                // Only clear the entry if it still points at this run — a
+                // concurrent re-index may have replaced us.
+                const current = this.indexingTasks.get(absolutePath);
+                if (current && current.controller === controller) {
+                    this.indexingTasks.delete(absolutePath);
+                }
+            });
+            this.indexingTasks.set(absolutePath, { controller, promise });
 
             const pathInfo = codebasePath !== absolutePath
                 ? `\nNote: Input path '${codebasePath}' was resolved to absolute path '${absolutePath}'`
@@ -519,8 +546,9 @@ export class ToolHandlers {
         splitterType: RequestSplitterType,
         customIgnorePatterns: string[] = [],
         customFileExtensions: string[] = [],
-        indexOptions?: CodebaseIndexOptions
-    ) {
+        indexOptions?: CodebaseIndexOptions,
+        signal?: AbortSignal
+    ): Promise<void> {
         const absolutePath = codebasePath;
         let lastSaveTime = 0; // Track last save timestamp
 
@@ -574,7 +602,7 @@ export class ToolHandlers {
                 }
 
                 console.log(`[BACKGROUND-INDEX] Progress: ${progress.phase} - ${progress.percentage}% (${progress.current}/${progress.total})`);
-            }, false, customIgnorePatterns, customFileExtensions, requestSplitter);
+            }, false, customIgnorePatterns, customFileExtensions, requestSplitter, signal);
             console.log(`[BACKGROUND-INDEX] ✅ Indexing completed successfully! Files: ${stats.indexedFiles}, Chunks: ${stats.totalChunks}`);
 
             // Set codebase to indexed status with complete statistics
@@ -592,6 +620,15 @@ export clas
```

---

### Incident Patch 7: `747ada5f` (2026-05-02)
**Commit Message**: docs: fix Cherry Studio npx arguments (#368)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -278,7 +278,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_ADDRESS`: `your-zilliz-cloud-public-endpoint`
```

**File**: `docs/getting-started/quick-start.md` (modified, +1/-1)
```diff
@@ -300,7 +300,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_TOKEN`: `your-zilliz-cloud-api-key`
```

**File**: `packages/mcp/README.md` (modified, +1/-1)
```diff
@@ -502,7 +502,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_TOKEN`: `your-zilliz-cloud-api-key`
```

---

### Incident Patch 8: `0d558ff7` (2026-05-01)
**Commit Message**: docs: fix Cherry Studio npx arguments

**File**: `README.md` (modified, +1/-1)
```diff
@@ -278,7 +278,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_ADDRESS`: `your-zilliz-cloud-public-endpoint`
```

**File**: `docs/getting-started/quick-start.md` (modified, +1/-1)
```diff
@@ -300,7 +300,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_TOKEN`: `your-zilliz-cloud-api-key`
```

**File**: `packages/mcp/README.md` (modified, +1/-1)
```diff
@@ -502,7 +502,7 @@ Cherry Studio allows for visual MCP server configuration through its settings in
    - **Name**: `claude-context`
    - **Type**: `STDIO`
    - **Command**: `npx`
-   - **Arguments**: `["@zilliz/claude-context-mcp@latest"]`
+   - **Arguments**: `["-y", "@zilliz/claude-context-mcp@latest"]`
    - **Environment Variables**:
      - `OPENAI_API_KEY`: `your-openai-api-key`
      - `MILVUS_TOKEN`: `your-zilliz-cloud-api-key`
```

---

### Incident Patch 9: `ead19f4a` (2026-05-01)
**Commit Message**: fix(mcp,core): honor request-scoped splitter option (#363)

**File**: `packages/core/src/context.splitter.test.ts` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+import * as fs from 'fs/promises';
+import * as os from 'os';
+import * as path from 'path';
+import { Context } from './context';
+import { Embedding, EmbeddingVector } from './embedding';
+import { Splitter, CodeChunk } from './splitter';
+import { FileSynchronizer } from './sync/synchronizer';
+import { VectorDatabase } from './vectordb';
+
+class TestEmbedding extends Embedding {
+    protected maxTokens = 8192;
+
+    async detectDimension(): Promise<number> {
+        return 3;
+    }
+
+    async embed(text: string): Promise<EmbeddingVector> {
+        return { vector: [1, 0, 0], dimension: 3 };
+    }
+
+    async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
+        return texts.map(() => ({ vector: [1, 0, 0], dimension: 3 }));
+    }
+
+    getDimension(): number {
+        return 3;
+    }
+
+    getProvider(): string {
+        return 'test';
+    }
+}
+
+class RecordingSplitter implements Splitter {
+    public calls: Array<{ code: string; language: string; filePath?: string }> = [];
+
+    constructor(private readonly label: string) { }
+
+    async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
+        this.calls.push({ code, language, filePath });
+        return [{
+            content: `${this.label}:${code}`,
+            metadata: {
+                startLine: 1,
+                endLine: code.split('\n').length,
+                language,
+                filePath,
+            },
+        }];
+    }
+
+    setChunkSize(): void { }
+
+    setChunkOverlap(): void { }
+}
+
+const createVectorDatabase = (): jest.Mocked<VectorDatabase> => ({
+    createCollection: jest.fn().mockResolvedValue(undefined),
+    createHybridCollection: jest.fn().mockResolvedValue(undefined),
+    dropCollection: jest.fn().mockResolvedValue(undefined),
+    hasCollection: jest.fn().mockResolvedValue(false),
+    listCollections: jest.fn().mockResolvedValue([]),
+    insert: jest.fn().mockResolvedValue(undefined),
+    insertHybrid: jest.fn().mockResolvedValue(undefined),
+    search: jest.fn().mockResolvedValue([]),
+    hybridSearch: jest.fn().mockResolvedValue([]),
+    delete: jest.fn().mockResolvedValue(undefined),
+    query: jest.fn().mockResolvedValue([]),
+    getCollectionDescription: jest.fn().mockResolvedValue(''),
+    checkCollectionLimit: jest.fn().mockResolvedValue(true),
+    getCollectionRowCount: jest.fn().mockResolvedValue(0),
+});
+
+describe('Context request-scoped splitters', () => {
+    let tempRoot: string;
+    let originalHome: string | undefined;
+    let originalHybridMode: string | undefined;
+
+    beforeEach(async () => {
+        tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-context-splitter-'));
+        const homeDir = path.join(tempRoot, 'home');
+        await fs.mkdir(homeDir, { recursive: true });
+        originalHome = process.env.HOME;
+        originalHybridMode = process.env.HYBRID_MODE;
+        process.env.HOME = homeDir;
+        process.env.HYBRID_MODE = 'false';
+    });
+
+    afterEach(async () => {
+        if (originalHome === undefined) {
+            delete process.env.HOME;
+        } else {
+            process.env.HOME = originalHome;
+        }
+        if (originalHybridMode === undefined) {
+            delete process.env.HYBRID_MODE;
+        } else {
+            process.env.HYBRID_MODE = originalHybridMode;
+        }
+        await fs.rm(tempRoot, { recursive: true, force: true });
+    });
+
+    it('uses a request-scoped splitter for indexing without replacing the context splitter', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(project);
+        await fs.writeFile(path.join(project, 'index.ts'), 'const value = 1;');
+
+        const vectorDatabase = createVectorDatabase();
+        const contextSplitter = new RecordingSplitter('context');
+        const requestSplitter = new RecordingSplitter('request');
+        const context = new Conte
```

**File**: `packages/core/src/context.ts` (modified, +14/-6)
```diff
@@ -319,18 +319,21 @@ export class Context {
      * @param forceReindex Whether to recreate the collection even if it exists
      * @param additionalIgnorePatterns Request-scoped ignore patterns
      * @param additionalSupportedExtensions Request-scoped file extensions
+     * @param requestSplitter Request-scoped splitter for this indexing run
      * @returns Indexing statistics
      */
     async indexCodebase(
         codebasePath: string,
         progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void,
         forceReindex: boolean = false,
         additionalIgnorePatterns: string[] = [],
-        additionalSupportedExtensions: string[] = []
+        additionalSupportedExtensions: string[] = [],
+        requestSplitter?: Splitter
     ): Promise<{ indexedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
         const isHybrid = this.getIsHybrid();
         const searchType = isHybrid === true ? 'hybrid search' : 'semantic search';
         console.log(`[Context] 🚀 Starting to index codebase with ${searchType}: ${codebasePath}`);
+        const splitter = requestSplitter || this.codeSplitter;
 
         // 1. Compute ignore patterns for this codebase/request without
         // retaining file-based patterns from previous codebases.
@@ -372,7 +375,8 @@ export class Context {
                     total: totalFiles,
                     percentage: Math.round(progressPercentage)
                 });
-            }
+            },
+            splitter
         );
 
         console.log(`[Context] ✅ Codebase indexing completed! Processed ${result.processedFiles} files in total, generated ${result.totalChunks} code chunks`);
@@ -395,10 +399,12 @@ export class Context {
         codebasePath: string,
         progressCallback?: (progress: { phase: string; current: number; total: number; percentage: number }) => void,
         additionalIgnorePatterns: string[] = [],
-        additionalSupportedExtensions: string[] = []
+        additionalSupportedExtensions: string[] = [],
+        requestSplitter?: Splitter
     ): Promise<{ added: number, removed: number, modified: number }> {
         const collectionName = this.getCollectionName(codebasePath);
         const synchronizer = this.synchronizers.get(collectionName);
+        const splitter = requestSplitter || this.codeSplitter;
 
         if (!synchronizer) {
             // Recreate the synchronizer with the same request-scoped options that
@@ -454,7 +460,8 @@ export class Context {
                 codebasePath,
                 (filePath, fileIndex, totalFiles) => {
                     updateProgress(`Indexed ${filePath} (${fileIndex}/${totalFiles})`);
-                }
+                },
+                splitter
             );
         }
 
@@ -810,7 +817,8 @@ export class Context {
     private async processFileList(
         filePaths: string[],
         codebasePath: string,
-        onFileProcessed?: (filePath: string, fileIndex: number, totalFiles: number) => void
+        onFileProcessed?: (filePath: string, fileIndex: number, totalFiles: number) => void,
+        splitter: Splitter = this.codeSplitter
     ): Promise<{ processedFiles: number; totalChunks: number; status: 'completed' | 'limit_reached' }> {
         const isHybrid = this.getIsHybrid();
         const EMBEDDING_BATCH_SIZE = Math.max(1, parseInt(envManager.get('EMBEDDING_BATCH_SIZE') || '100', 10));
@@ -828,7 +836,7 @@ export class Context {
             try {
                 const content = await fs.promises.readFile(filePath, 'utf-8');
                 const language = this.getLanguageFromExtension(path.extname(filePath));
-                const chunks = await this.codeSplitter.split(content, language, filePath);
+                const chunks = await splitter.split(content, language, filePath);
 
                 // Log files with many chunks or large content
                 if (chunks.length > 50) {
```

**File**: `packages/mcp/src/config.ts` (modified, +3/-0)
```diff
@@ -33,8 +33,11 @@ export interface CodebaseSnapshotV1 {
 
 // New format (v2) - structured with codebase information
 
+export type RequestSplitterType = 'ast' | 'langchain';
+
 // Request-level indexing options stored with a codebase's snapshot entry.
 export interface CodebaseIndexOptions {
+    requestSplitter?: RequestSplitterType;
     requestCustomExtensions?: string[];
     requestIgnorePatterns?: string[];
 }
```

**File**: `packages/mcp/src/handlers.ts` (modified, +17/-21)
```diff
@@ -3,7 +3,8 @@ import * as path from "path";
 import * as crypto from "crypto";
 import { Context, COLLECTION_LIMIT_MESSAGE, FileSynchronizer } from "@zilliz/claude-context-core";
 import { SnapshotManager } from "./snapshot.js";
-import type { CodebaseIndexOptions } from "./config.js";
+import type { CodebaseIndexOptions, RequestSplitterType } from "./config.js";
+import { createRequestSplitter, isRequestSplitterType } from "./splitter.js";
 import { ensureAbsolutePath, truncateContent, trackCodebasePath } from "./utils.js";
 
 export class ToolHandlers {
@@ -315,28 +316,30 @@ export class ToolHandlers {
     public async handleIndexCodebase(args: any) {
         const { path: codebasePath, force, splitter, customExtensions, ignorePatterns } = args;
         const forceReindex = force || false;
-        const splitterType = splitter || 'ast'; // Default to AST
+        const requestedSplitter = splitter || 'ast'; // Default to AST
         const customFileExtensions = customExtensions || [];
         const customIgnorePatterns = ignorePatterns || [];
-        const indexOptions: CodebaseIndexOptions = {
-            requestCustomExtensions: customFileExtensions,
-            requestIgnorePatterns: customIgnorePatterns
-        };
 
         try {
             // Sync indexed codebases from cloud first
             await this.syncIndexedCodebasesFromCloud();
 
             // Validate splitter parameter
-            if (splitterType !== 'ast' && splitterType !== 'langchain') {
+            if (!isRequestSplitterType(requestedSplitter)) {
                 return {
                     content: [{
                         type: "text",
-                        text: `Error: Invalid splitter type '${splitterType}'. Must be 'ast' or 'langchain'.`
+                        text: `Error: Invalid splitter type '${requestedSplitter}'. Must be 'ast' or 'langchain'.`
                     }],
                     isError: true
                 };
             }
+            const splitterType: RequestSplitterType = requestedSplitter;
+            const indexOptions: CodebaseIndexOptions = {
+                requestSplitter: splitterType,
+                requestCustomExtensions: customFileExtensions,
+                requestIgnorePatterns: customIgnorePatterns
+            };
             // Force absolute path resolution - warn if relative path provided
             const absolutePath = ensureAbsolutePath(codebasePath);
 
@@ -513,7 +516,7 @@ export class ToolHandlers {
     private async startBackgroundIndexing(
         codebasePath: string,
         forceReindex: boolean,
-        splitterType: string,
+        splitterType: RequestSplitterType,
         customIgnorePatterns: string[] = [],
         customFileExtensions: string[] = [],
         indexOptions?: CodebaseIndexOptions
@@ -529,17 +532,13 @@ export class ToolHandlers {
                 console.log(`[BACKGROUND-INDEX] ℹ️  Force reindex mode - collection was already cleared during validation`);
             }
 
-            // Use the existing Context instance for indexing.
-            let contextForThisTask = this.context;
-            if (splitterType !== 'ast') {
-                console.warn(`[BACKGROUND-INDEX] Non-AST splitter '${splitterType}' requested; falling back to AST splitter`);
-            }
+            const requestSplitter = createRequestSplitter(splitterType);
 
             // Load ignore patterns from files first (including .ignore, .gitignore, etc.)
             // and merge them with this request's custom ignore patterns without
             // relying on shared Context state for this background indexing task.
-            const ignorePatterns = await contextForThisTask.getEffectiveIgnorePatterns(absolutePath, customIgnorePatterns);
-            const supportedExtensions = contextForThisTask.getEffectiveSupportedExtensions(customFileExtensions);
+            const ignorePatterns = await this.context.getEffectiveIgnorePatterns(absolutePath, customIgnoreP
```

**File**: `packages/mcp/src/snapshot.request-options.test.ts` (modified, +8/-0)
```diff
@@ -39,6 +39,7 @@ test("preserves request-level index options across snapshot state transitions",
 
         const snapshotManager = new SnapshotManager();
         const indexOptions = {
+            requestSplitter: "langchain" as const,
             requestCustomExtensions: ["foo", ".vue"],
             requestIgnorePatterns: ["drafts/**", "*.tmp"]
         };
@@ -48,6 +49,7 @@ test("preserves request-level index options across snapshot state transitions",
 
         const indexingInfo = snapshotManager.getCodebaseInfo(codebasePath);
         assert.equal(indexingInfo?.status, "indexing");
+        assert.equal(indexingInfo?.requestSplitter, "langchain");
         assert.deepEqual(indexingInfo?.requestCustomExtensions, ["foo", ".vue"]);
         assert.deepEqual(indexingInfo?.requestIgnorePatterns, ["drafts/**", "*.tmp"]);
 
@@ -59,13 +61,15 @@ test("preserves request-level index options across snapshot state transitions",
 
         const indexedInfo = snapshotManager.getCodebaseInfo(codebasePath);
         assert.equal(indexedInfo?.status, "indexed");
+        assert.equal(indexedInfo?.requestSplitter, "langchain");
         assert.deepEqual(indexedInfo?.requestCustomExtensions, ["foo", ".vue"]);
         assert.deepEqual(indexedInfo?.requestIgnorePatterns, ["drafts/**", "*.tmp"]);
 
         snapshotManager.setCodebaseIndexFailed(codebasePath, "boom", 55);
 
         const failedInfo = snapshotManager.getCodebaseInfo(codebasePath);
         assert.equal(failedInfo?.status, "indexfailed");
+        assert.equal(failedInfo?.requestSplitter, "langchain");
         assert.deepEqual(failedInfo?.requestCustomExtensions, ["foo", ".vue"]);
         assert.deepEqual(failedInfo?.requestIgnorePatterns, ["drafts/**", "*.tmp"]);
     });
@@ -79,13 +83,15 @@ test("explicit empty request options clear previous request-level index options"
         const snapshotManager = new SnapshotManager();
 
         snapshotManager.setCodebaseIndexing(codebasePath, 0, {
+            requestSplitter: "langchain",
             requestCustomExtensions: ["foo"],
             requestIgnorePatterns: ["drafts/**"]
         });
         snapshotManager.setCodebaseIndexing(codebasePath, 0, {});
 
         const info = snapshotManager.getCodebaseInfo(codebasePath);
         assert.equal(info?.status, "indexing");
+        assert.equal(info?.requestSplitter, undefined);
         assert.equal(info?.requestCustomExtensions, undefined);
         assert.equal(info?.requestIgnorePatterns, undefined);
     });
@@ -98,6 +104,7 @@ test("preserves request-level index options when interrupted indexing is loaded
 
         const firstSnapshotManager = new SnapshotManager();
         firstSnapshotManager.setCodebaseIndexing(codebasePath, 25, {
+            requestSplitter: "langchain",
             requestCustomExtensions: ["astro"],
             requestIgnorePatterns: ["drafts/**"]
         });
@@ -112,6 +119,7 @@ test("preserves request-level index options when interrupted indexing is loaded
             throw new Error("Expected interrupted indexing to load as indexfailed");
         }
         assert.equal(info.lastAttemptedPercentage, 25);
+        assert.equal(info?.requestSplitter, "langchain");
         assert.deepEqual(info?.requestCustomExtensions, ["astro"]);
         assert.deepEqual(info?.requestIgnorePatterns, ["drafts/**"]);
     });
```

---

### Incident Patch 10: `be107de3` (2026-04-29)
**Commit Message**: fix(core): support root-anchored directory ignore patterns

**File**: `packages/core/src/context.ignore-patterns.test.ts` (modified, +46/-1)
```diff
@@ -3,8 +3,8 @@ import * as os from 'os';
 import * as path from 'path';
 import { Context } from './context';
 import { Embedding, EmbeddingVector } from './embedding';
-import { FileSynchronizer } from './sync/synchronizer';
 import { Splitter, CodeChunk } from './splitter';
+import { FileSynchronizer } from './sync/synchronizer';
 import { VectorDatabase } from './vectordb';
 
 class TestEmbedding extends Embedding {
@@ -181,4 +181,49 @@ describe('Context ignore pattern isolation', () => {
         }
     });
 
+    it('treats leading-slash directory ignore patterns as root-anchored and recursive during indexing', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(path.join(project, 'Library'), { recursive: true });
+        await fs.mkdir(path.join(project, 'src', 'Library'), { recursive: true });
+        await fs.writeFile(path.join(project, '.gitignore'), '/Library/\n');
+        await fs.writeFile(path.join(project, 'Library', 'generated.md'), 'root library should be ignored');
+        await fs.writeFile(path.join(project, 'src', 'Library', 'nested.md'), 'nested library should stay');
+        await fs.writeFile(path.join(project, 'src', 'keep.md'), 'regular file should stay');
+
+        const vectorDatabase = createVectorDatabase();
+        const context = new Context({
+            embedding: new TestEmbedding(),
+            vectorDatabase,
+            codeSplitter: new TestSplitter(),
+        });
+
+        await context.indexCodebase(project);
+
+        const insertedDocuments = vectorDatabase.insert.mock.calls
+            .flatMap(([, documents]) => documents);
+        const indexedPaths = insertedDocuments
+            .map(document => document.relativePath.replace(/\\/g, '/'))
+            .sort();
+
+        expect(indexedPaths).toEqual([
+            'src/Library/nested.md',
+            'src/keep.md',
+        ]);
+    });
+
+    it('treats leading-slash directory ignore patterns as root-anchored and recursive during sync', async () => {
+        const project = path.join(tempRoot, 'project');
+        await fs.mkdir(path.join(project, 'Library'), { recursive: true });
+        await fs.mkdir(path.join(project, 'src', 'Library'), { recursive: true });
+        await fs.writeFile(path.join(project, 'Library', 'generated.md'), 'root library should be ignored');
+        await fs.writeFile(path.join(project, 'src', 'Library', 'nested.md'), 'nested library should stay');
+        await fs.writeFile(path.join(project, 'src', 'keep.md'), 'regular file should stay');
+
+        const synchronizer = new FileSynchronizer(project, ['/Library/'], ['.md']);
+        const fileHashes = await (synchronizer as any).generateFileHashes(project) as Map<string, string>;
+
+        expect(fileHashes.has(path.join('Library', 'generated.md'))).toBe(false);
+        expect(fileHashes.has(path.join('src', 'Library', 'nested.md'))).toBe(true);
+        expect(fileHashes.has(path.join('src', 'keep.md'))).toBe(true);
+    });
 });
```

**File**: `packages/core/src/context.ts` (modified, +39/-8)
```diff
@@ -1187,24 +1187,55 @@ export class Context {
      * @returns True if pattern matches
      */
     private isPatternMatch(filePath: string, pattern: string): boolean {
+        const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
+        const normalizedPattern = pattern.replace(/\\/g, '/');
+        const cleanPattern = normalizedPattern.replace(/^\/+|\/+$/g, '');
+        const isRootAnchored = normalizedPattern.startsWith('/');
+        const isDirectoryPattern = normalizedPattern.endsWith('/');
+
+        if (!cleanPath || !cleanPattern) {
+            return false;
+        }
+
         // Handle directory patterns (ending with /)
-        if (pattern.endsWith('/')) {
-            const dirPattern = pattern.slice(0, -1);
-            const pathParts = filePath.split('/');
-            return pathParts.some(part => this.simpleGlobMatch(part, dirPattern));
+        if (isDirectoryPattern) {
+            if (isRootAnchored) {
+                return this.simpleGlobMatch(cleanPath, cleanPattern) ||
+                    cleanPath.startsWith(`${cleanPattern}/`);
+            }
+
+            return this.matchesDirectoryPattern(cleanPath, cleanPattern);
+        }
+
+        if (isRootAnchored) {
+            return this.simpleGlobMatch(cleanPath, cleanPattern);
         }
 
         // Handle file patterns
-        if (pattern.includes('/')) {
+        if (cleanPattern.includes('/')) {
             // Pattern with path separator - match exact path
-            return this.simpleGlobMatch(filePath, pattern);
+            return this.simpleGlobMatch(cleanPath, cleanPattern);
         } else {
             // Pattern without path separator - match filename in any directory
-            const fileName = path.basename(filePath);
-            return this.simpleGlobMatch(fileName, pattern);
+            const fileName = path.basename(cleanPath);
+            return this.simpleGlobMatch(fileName, cleanPattern);
         }
     }
 
+    private matchesDirectoryPattern(filePath: string, dirPattern: string): boolean {
+        const pathParts = filePath.split('/');
+        const dirPartCount = dirPattern.split('/').length;
+
+        for (let i = 0; i <= pathParts.length - dirPartCount; i++) {
+            const candidate = pathParts.slice(i, i + dirPartCount).join('/');
+            if (this.simpleGlobMatch(candidate, dirPattern)) {
+                return true;
+            }
+        }
+
+        return false;
+    }
+
     /**
      * Simple glob matching supporting * wildcard
      * @param text Text to test
```

**File**: `packages/core/src/sync/synchronizer.ts` (modified, +36/-32)
```diff
@@ -57,7 +57,7 @@ export class FileSynchronizer {
             const relativePath = path.relative(this.rootDir, fullPath);
 
             // Check if this path should be ignored BEFORE any file system operations
-            if (this.shouldIgnore(relativePath, entry.isDirectory())) {
+            if (this.shouldIgnore(relativePath)) {
                 continue; // Skip completely - no access at all
             }
 
@@ -72,7 +72,7 @@ export class FileSynchronizer {
 
             if (stat.isDirectory()) {
                 // Verify it's really a directory and not ignored
-                if (!this.shouldIgnore(relativePath, true)) {
+                if (!this.shouldIgnore(relativePath)) {
                     const subHashes = await this.generateFileHashes(fullPath);
                     const entries = Array.from(subHashes.entries());
                     for (let i = 0; i < entries.length; i++) {
@@ -82,7 +82,7 @@ export class FileSynchronizer {
                 }
             } else if (stat.isFile()) {
                 // Verify it's really a file and not ignored
-                if (!this.shouldIgnore(relativePath, false)) {
+                if (!this.shouldIgnore(relativePath)) {
                     const ext = path.extname(entry.name);
                     if (this.supportedExtensions.length > 0 && !this.supportedExtensions.includes(ext)) {
                         continue;
@@ -101,7 +101,7 @@ export class FileSynchronizer {
         return fileHashes;
     }
 
-    private shouldIgnore(relativePath: string, isDirectory: boolean = false): boolean {
+    private shouldIgnore(relativePath: string): boolean {
         // Always ignore hidden files and directories (starting with .)
         const pathParts = relativePath.split(path.sep);
         if (pathParts.some(part => part.startsWith('.'))) {
@@ -121,7 +121,7 @@ export class FileSynchronizer {
 
         // Check direct pattern matches first
         for (const pattern of this.ignorePatterns) {
-            if (this.matchPattern(normalizedPath, pattern, isDirectory)) {
+            if (this.matchPattern(normalizedPath, pattern)) {
                 return true;
             }
         }
@@ -131,49 +131,39 @@ export class FileSynchronizer {
         for (let i = 0; i < normalizedPathParts.length; i++) {
             const partialPath = normalizedPathParts.slice(0, i + 1).join('/');
             for (const pattern of this.ignorePatterns) {
-                // Check directory patterns
-                if (pattern.endsWith('/')) {
-                    const dirPattern = pattern.slice(0, -1);
-                    if (this.simpleGlobMatch(partialPath, dirPattern) ||
-                        this.simpleGlobMatch(normalizedPathParts[i], dirPattern)) {
-                        return true;
-                    }
-                }
-                // Check exact path patterns
-                else if (pattern.includes('/')) {
-                    if (this.simpleGlobMatch(partialPath, pattern)) {
-                        return true;
-                    }
-                }
-                // Check filename patterns against any path component
-                else {
-                    if (this.simpleGlobMatch(normalizedPathParts[i], pattern)) {
-                        return true;
-                    }
+                if (this.matchPattern(partialPath, pattern)) {
+                    return true;
                 }
             }
         }
 
         return false;
     }
 
-    private matchPattern(filePath: string, pattern: string, isDirectory: boolean = false): boolean {
+    private matchPattern(filePath: string, pattern: string): boolean {
         // Clean both path and pattern
         const cleanPath = filePath.replace(/^\/+|\/+$/g, '');
-        const cleanPattern = pattern.replace(/^\/+|\/+$/g, '');
+        const normalizedPattern = pattern.replace(/\\/g, '/');
+        const cleanPattern = normalizedPattern.replace(/^\/+|\/+$/g, '');
+        const isRootAnch
```

#### Recent Merged Pull Requests:
- **PR #423** (closed): fix: zilliztech/claude-context#421 (@Zewang0217)
- **PR #407** (2026-07-14): docs: add CLAUDE.md and AGENTS.md repository guide (@zc277584121)
- **PR #396** (closed): feat(core): CI semantic index — collection override, Qwen3-4B OpenRouter, Postgres cache (@BeamNawapat)
- **PR #390** (2026-06-08): fix(mcp): show error when embedding model unavailable (@xu20160924)
- **PR #386** (2026-07-14): fix(core): make Merkle root hashing deterministic (@wuyua9)
- **PR #385** (2026-07-14): fix(mcp): derive default version from package metadata (@wuyua9)
- **PR #380** (2026-05-22): test(core): cover VoyageAI variable dimensions (@euyua9)
- **PR #379** (2026-05-22): test(mcp): cover get_indexing_status cloud sync (@yuyua9)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
