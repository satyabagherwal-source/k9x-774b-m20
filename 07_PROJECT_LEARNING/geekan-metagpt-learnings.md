# Forensic Learning Record (Deep Inspection): FoundationAgents/MetaGPT

> **Canonical Artifact**: `07_PROJECT_LEARNING/geekan-metagpt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/geekan/MetaGPT](https://github.com/geekan/MetaGPT))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:29:41.020Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FoundationAgents/MetaGPT`
- **Description**: 🌟 The Multi-Agent Framework: First AI Software Company, Towards Natural Language Programming
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 70767 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/exp_pool/scorer.py`
```
import asyncio

from metagpt.exp_pool.scorers import SimpleScorer

# Request to implement quicksort in Python
REQ = "Write a program to implement quicksort in python."

# First response: Quicksort implementation without base case
RESP1 = """
def quicksort(arr):
    return quicksort([x for x in arr[1:] if x <= arr[0]]) + [arr[0]] + quicksort([x for x in arr[1:] if x > arr[0]])
"""

# Second response: Quicksort implementation with base case
RESP2 = """
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    return quicksort([x for x in arr[1:] if x <= arr[0]]) + [arr[0]] + quicksort([x for x in arr[1:] if x > arr[0]])
"""


async def simple():
    """Evaluates two quicksort implementations using SimpleScorer.

    Example:
        {
            "val": 3,
            "reason": "The response attempts to implement quicksort but contains a critical flaw: it lacks a base case to terminate the recursion, which will lead to a maximum recursion depth exceeded error for non-empty lists. Additionally, the function does not handle empty lists properly. A correct implementation should include a base case to handle lists of length 0 or 1."
        }
    """

    scorer = SimpleScorer()

    await scorer.evaluate(req=REQ, resp=RESP1)
    await scorer.evaluate(req=REQ, resp=RESP2)


async def main():
    await simple()


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/werewolf_game/evals/utils.py`
```
"""
Filename: MetaGPT/examples/werewolf_game/evals/utils.py
Created Date: Oct 11, 2023
Revised Date: Oct 20, 2023
Author: [Aria](https://github.com/ariafyy)
"""
import glob
import os
import re
from pathlib import Path

from metagpt.const import METAGPT_ROOT


class Utils:
    """Utils: utils of logs"""

    @staticmethod
    def polish_log(in_logfile, out_txtfile):
        """polish logs for evaluation"""
        pattern_text = r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) \| (\w+) +\| ([\w\.]+:\w+:\d+) - (.*\S)"
        pattern_player = r"(Player(\d{1}): \w+)"
        pattern_start = False
        json_start = False

        with open(in_logfile, "r") as f, open(out_txtfile, "w") as out:
            for line in f.readlines():
                matches = re.match(pattern_text, line)
                if matches:
                    message = matches.group(4).strip()
                    pattern_start = True
                    json_start = False

                    if (
                        "Moderator(Moderator) ready to InstructSpeak" not in message
                        and "Moderator(Moderator) ready to ParseSpeak" not in message
                        and "Total running cost:" not in message
                    ):
                        out.write("- " + message + "\n")
                    else:
                        out.write("\n")

                elif pattern_start and not matches:
                    if "gpt-4 may update over time" in line:
                        line = ""
                    out.write(line)

                elif line.strip().startswith("{"):
                    out.write(line.strip())
                    json_start = True

                elif json_start and not line.strip().endswith("}"):
                    out.write(line.strip())

                elif json_start and line.strip().endswith("}"):
                    out.write(line.strip())
                    json_start = False

                elif (
                    line.startswith("(User):") or line.startswith("********** STEP:") or re.search(pattern_player, line)
                ):
                    out.write(line)

                else:
                    out.write("\n")

    @staticmethod
    def pick_vote_log(in_logfile, out_txtfile):
        """
        pick the vote log from the log file.
        ready to AnnounceGameResult serves as the 'HINT_TEXT ' which indicates the end of the game.
        based on bservation and reflection, then discuss is not in vote session.
        """
        pattern_vote = r"(Player\d+)\(([A-Za-z]+)\): (\d+) \| (I vote to eliminate Player\d+)"
        ignore_text = """reflection"""
        HINT_TEXT = r"ready to AnnounceGameResult"
        pattern_moderator = r"\[([^\]]+)\]\. Say ONLY: I vote to eliminate ..."
        in_valid_block = False

        with open(in_logfile, "r") as f:
            lines = f.read()
            split_lines = lines.split(HINT_TEXT)

            if len(split_lines) < 2:
                print(f"Key text :{HINT_TEXT} not found in {in_logfile}")
                return

            relevant_lines = split_lines[1].split("\n")
            with open(out_txtfile, "w") as out:
                for line in relevant_lines:
                    if re.search(pattern_moderator, line):
                        in_valid_block = True
                        out.write(line.lstrip() + "\n")

                    elif in_valid_block and re.search(pattern_vote, line):
                        out.write(line + "\n")
                    elif ignore_text in line:
                        in_valid_block = False

    @staticmethod
    def get_file_list(path: str) -> list:
        file_pattern = os.path.join(path, "*.txt")
        files_list = glob.glob(file_pattern)
        return files_list

    @staticmethod
    def filename_to_foldername(out_txtfile: str):
        """
        convert filename into its parent folder name
        input:"....../# 01-10_10132100.txt"
        output:# 01-10
        """
        s = Path(out_txtfile).stem
        pattern_folder = r"([^_]*)_"
        match = re.match(pattern_folder, s)
        if match:
            folder = match.group(1)
            return folder

    @staticmethod
    def float_to_percent(decimal: float) -> str:
        """
        input:  1.00
        output: 100.00%
        """
        percent = decimal * 100
        return f"{percent:.2f}%"


if __name__ == "__main__":
    in_logfile = METAGPT_ROOT / "logs/log.txt"
    out_txtfile = "input your wish path"
    # Utils().polish_log(in_logfile, out_txtfile)
    Utils().pick_vote_log(in_logfile, out_txtfile)

```

### Core Architecture Module: `metagpt/environment/minecraft/mineflayer/lib/utils.js`
```
let gameTimeCounter = 0;
let gameTimeList = [];
const initCounter = (bot) => {
    gameTimeList = [];
    for (let i = 0; i < 13000; i += 1000) {
        gameTimeList.push(i);
    }
    for (let i = 13000; i < 24000; i += 2000) {
        gameTimeList.push(i);
    }
    const timeOfDay = bot.time.timeOfDay;
    for (let i = 0; i < gameTimeList.length; i++) {
        if (gameTimeList[i] > timeOfDay) {
            gameTimeCounter = i - 1;
            break;
        }
    }
};

const getNextTime = () => {
    gameTimeCounter++;
    if (gameTimeCounter >= gameTimeList.length) {
        gameTimeCounter = 0;
    }
    return gameTimeList[gameTimeCounter];
};

module.exports = {
    initCounter,
    getNextTime,
};

```

### Core Architecture Module: `metagpt/environment/minecraft/mineflayer/mineflayer-collectblock/src/TaskQueue.ts`
```
import type { Callback } from './index'
export type Task = (cb: Callback) => void
export type SyncTask = () => void

/**
 * A simple utility class for queuing up a series of async tasks to execute.
 */
export class TaskQueue {
  private tasks: Task[] = []

  /**
   * If true, the task list will stop executing if one of the tasks throws an error.
   */
  readonly stopOnError: boolean = true

  /**
   * Adds a new async task to this queue. The provided callback should be executed when
   * the async task is complete.
   *
   * @param task - The async task to add.
   */
  add (task: Task): void {
    this.tasks.push(task)
  }

  /**
   * Adds a synchronous task toi this queue.
   *
   * @param task - The sync task to add.
   */
  addSync (task: SyncTask): void {
    this.add((cb) => {
      try {
        task()
        cb()
      } catch (err: any) {
        cb(err)
      }
    })
  }

  /**
   * Runs all tasks currently in this queue and empties the queue.
   *
   * @param cb - The optional callback to be executed when all tasks in this queue have
   * finished executing.
   */
  runAll (cb?: Callback): void {
    const taskList = this.tasks
    this.tasks = []

    let index = -1
    const runNext: () => void = () => {
      index++
      if (index >= taskList.length) {
        if (cb !== undefined) cb()
        return
      }

      try {
        taskList[index]((err) => {
          if (err !== undefined) {
            if (cb !== undefined) cb(err)

            if (this.stopOnError) return
          }

          runNext()
        })
      } catch (err: any) {
        if (cb !== undefined) cb(err)
      }
    }

    runNext()
  }
}

```

### Core Architecture Module: `metagpt/environment/minecraft/mineflayer/mineflayer-collectblock/src/Util.ts`
```
/**
 * Creates a new error object with the given type and message.
 *
 * @param type - The error type.
 * @param message - The error message.
 *
 * @returns The error object.
 */
export function error (type: string, message: string): Error {
  const e = new Error(message)
  e.name = type
  return e
}

```

### Core Architecture Module: `metagpt/exp_pool/scorers/__init__.py`
```
"""Scorers init."""

from metagpt.exp_pool.scorers.base import BaseScorer
from metagpt.exp_pool.scorers.simple import SimpleScorer

__all__ = ["BaseScorer", "SimpleScorer"]

```

### Core Architecture Module: `metagpt/exp_pool/scorers/base.py`
```
"""Base scorer."""

from abc import ABC, abstractmethod

from pydantic import BaseModel, ConfigDict

from metagpt.exp_pool.schema import Score


class BaseScorer(BaseModel, ABC):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    @abstractmethod
    async def evaluate(self, req: str, resp: str) -> Score:
        """Evaluates the quality of a response relative to a given request."""

```

### Core Architecture Module: `metagpt/exp_pool/scorers/simple.py`
```
"""Simple scorer."""

import json

from pydantic import Field

from metagpt.exp_pool.schema import Score
from metagpt.exp_pool.scorers.base import BaseScorer
from metagpt.llm import LLM
from metagpt.provider.base_llm import BaseLLM
from metagpt.utils.common import CodeParser

SIMPLE_SCORER_TEMPLATE = """
Role: You are a highly efficient assistant, tasked with evaluating a response to a given request. The response is generated by a large language model (LLM). 

I will provide you with a request and a corresponding response. Your task is to assess this response and provide a score from a human perspective.

## Context
### Request
{req}

### Response
{resp}

## Format Example
```json
{{
    "val": "the value of the score, int from 1 to 10, higher is better.",
    "reason": "an explanation supporting the score."
}}
```

## Instructions
- Understand the request and response given by the user.
- Evaluate the response based on its quality relative to the given request.
- Provide a score from 1 to 10, where 10 is the best.
- Provide a reason supporting your score.

## Constraint
Format: Just print the result in json format like **Format Example**.

## Action
Follow instructions, generate output and make sure it follows the **Constraint**.
"""


class SimpleScorer(BaseScorer):
    llm: BaseLLM = Field(default_factory=LLM)

    async def evaluate(self, req: str, resp: str) -> Score:
        """Evaluates the quality of a response relative to a given request, as scored by an LLM.

        Args:
            req (str): The request.
            resp (str): The response.

        Returns:
            Score: An object containing the score (1-10) and the reasoning.
        """

        prompt = SIMPLE_SCORER_TEMPLATE.format(req=req, resp=resp)
        resp = await self.llm.aask(prompt)
        resp_json = json.loads(CodeParser.parse_code(resp, lang="json"))

        return Score(**resp_json)

```

### Core Architecture Module: `metagpt/ext/aflow/benchmark/utils.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@Time    : 2024/7/24 16:37
@Author  : didi
@File    : utils.py
"""

import json
import os

import numpy as np

from metagpt.utils.common import read_json_file, write_json_file


def generate_random_indices(n, n_samples, test=False):
    """
    Generate random indices
    """

    def _set_seed(seed=42):
        np.random.seed(seed)

    _set_seed()
    indices = np.arange(n)
    np.random.shuffle(indices)
    if test:
        return indices[n_samples:]
    else:
        return indices[:n_samples]


def split_data_set(file_path, samples, test=False):
    data = []

    with open(file_path, "r") as file:
        for line in file:
            data.append(json.loads(line))
    random_indices = generate_random_indices(len(data), samples, test)
    data = [data[i] for i in random_indices]
    return data


def log_mismatch(problem, expected_output, prediction, predicted_number, path):
    log_data = {
        "question": problem,
        "right_answer": expected_output,
        "model_output": prediction,
        "extracted_output": predicted_number,
    }

    log_file = os.path.join(path, "log.json")

    # Check if the log file already exists
    if os.path.exists(log_file):
        # If it exists, load the existing log data
        data = read_json_file(log_file)
    else:
        # If it does not exist, create a new log list
        data = []

    # Add the new log entry
    data.append(log_data)

    # Write the data back to log.json file
    write_json_file(log_file, data, encoding="utf-8", indent=4)

```

### Core Architecture Module: `metagpt/ext/aflow/scripts/optimizer_utils/convergence_utils.py`
```
# -*- coding: utf-8 -*-
# @Date    : 9/23/2024 10:00 AM
# @Author  : Issac
# @Desc    :

import json
import os

import numpy as np

from metagpt.logs import logger


class ConvergenceUtils:
    def __init__(self, root_path):
        self.root_path = root_path
        self.data = None
        self.rounds = None
        self.avg_scores, self.stds = None, None

    def load_data(self, root_path):
        """
        Read JSON file, create a new file if it doesn't exist, then return the data.
        """
        rounds_dir = os.path.join(root_path, "workflows")
        result_file = os.path.join(rounds_dir, "results.json")

        # Ensure directory exists
        os.makedirs(rounds_dir, exist_ok=True)

        # If file doesn't exist, create a new one with an empty list
        if not os.path.exists(result_file):
            with open(result_file, "w") as file:
                json.dump([], file)

        # Read file and return data
        with open(result_file, "r") as file:
            return json.load(file)

    def process_rounds(self):
        """
        Organize data by round, return a dictionary of scores by round.
        """
        self.data = self.load_data(root_path=self.root_path)
        rounds = {}
        for entry in self.data:
            round_number = entry["round"]
            score = entry["score"]
            if round_number not in rounds:
                rounds[round_number] = []
            rounds[round_number].append(score)
        return rounds

    def calculate_avg_and_std(self):
        """
        Calculate average score and standard deviation for each round, return two lists: average scores and standard deviations.
        """
        self.rounds = self.process_rounds()

        sorted_rounds = sorted(self.rounds.items(), key=lambda x: x[0])
        avg_scores = []
        stds = []
        for round_number, scores in sorted_rounds:
            avg_scores.append(np.mean(scores))
            stds.append(np.std(scores))
        return avg_scores, stds

    def check_convergence(self, top_k=3, z=0, consecutive_rounds=5):
        """
        Check for convergence. z is the z-score corresponding to the confidence level.
        consecutive_rounds is the number of consecutive rounds that must meet the stop condition.
        """
        # Calculate average score and standard deviation for each round
        self.avg_scores, self.stds = self.calculate_avg_and_std()
        # If total rounds are not enough to calculate top_k+1 rounds, return not converged
        if len(self.avg_scores) < top_k + 1:
            return False, None, None
        convergence_count = 0  # Convergence counter
        previous_y = None  # Y value of the previous round (average of top_k scores)
        sigma_y_previous = None  # Standard error of Y value from previous round
        for i in range(len(self.avg_scores)):
            # Dynamically select top_k from current round and all previous rounds
            top_k_indices = np.argsort(self.avg_scores[: i + 1])[::-1][
                :top_k
            ]  # Select top k indices by descending average score
            top_k_scores = [self.avg_scores[j] for j in top_k_indices]  # Get list of top k scores
            top_k_stds = [
                self.stds[j] for j in top_k_indices
            ]  # Get list of standard deviations corresponding to top k scores
            # Calculate mean of top k scores for current round, i.e., y_current
            y_current = np.mean(top_k_scores)
            # Calculate standard error of y_current (sigma_y_current), representing score dispersion
            sigma_y_current = np.sqrt(np.sum([s**2 for s in top_k_stds]) / (top_k**2))
            # If not the first round, calculate change in Y (Delta_Y) and corresponding standard error
            if previous_y is not None:
                # Calculate Y difference between current round and previous round
                delta_y = y_current - previous_y
                # Calculate standard error of Y difference (sigma_Delta_Y)
                sigma_delta_y = np.sqrt(sigma_y_current**2 + sigma_y_previous**2)
                # Check if Y change is within acceptable confidence interval, i.e., convergence condition
                if abs(delta_y) <= z * sigma_delta_y:
                    convergence_count += 1
                    # If consecutive converged rounds reach set value, return convergence information
                    if convergence_count >= consecutive_rounds:
                        return True, i - consecutive_rounds + 1, i
                else:
                    # If change is large, reset convergence counter
                    convergence_count = 0
            # Update Y value and standard error for previous round
            previous_y = y_current
            sigma_y_previous = sigma_y_current
        # If convergence condition not met, return not converged
        return False, None, None

    def print_results(self):
        """
        Print average score and standard deviation for all rounds.
        """
        self.avg_scores, self.stds = self.calculate_avg_and_std()
        for i, (avg_score, std) in enumerate(zip(self.avg_scores, self.stds), 1):
            logger.info(f"Round {i}: Average Score = {avg_score:.4f}, Standard Deviation = {std:.4f}")


if __name__ == "__main__":
    # Use this class and specify top_k
    checker = ConvergenceUtils("path")  # For example, set top_k=5
    converged, convergence_round, final_round = checker.check_convergence()

    if converged:
        logger.info(f"Convergence detected, occurred at round {convergence_round}, final round is {final_round}")
    else:
        logger.info("No convergence detected within all rounds")

    # Print average score and standard deviation for each round
    checker.print_results()

```

### Core Architecture Module: `metagpt/ext/aflow/scripts/optimizer_utils/data_utils.py`
```
import datetime
import json
import os
import random

import numpy as np
import pandas as pd

from metagpt.logs import logger
from metagpt.utils.common import read_json_file, write_json_file


class DataUtils:
    def __init__(self, root_path: str):
        self.root_path = root_path
        self.top_scores = []

    def load_results(self, path: str) -> list:
        result_path = os.path.join(path, "results.json")
        if os.path.exists(result_path):
            with open(result_path, "r") as json_file:
                try:
                    return json.load(json_file)
                except json.JSONDecodeError:
                    return []
        return []

    def get_top_rounds(self, sample: int, path=None, mode="Graph"):
        self._load_scores(path, mode)
        unique_rounds = set()
        unique_top_scores = []

        first_round = next((item for item in self.top_scores if item["round"] == 1), None)
        if first_round:
            unique_top_scores.append(first_round)
            unique_rounds.add(1)

        for item in self.top_scores:
            if item["round"] not in unique_rounds:
                unique_top_scores.append(item)
                unique_rounds.add(item["round"])

                if len(unique_top_scores) >= sample:
                    break

        return unique_top_scores

    def select_round(self, items):
        if not items:
            raise ValueError("Item list is empty.")

        sorted_items = sorted(items, key=lambda x: x["score"], reverse=True)
        scores = [item["score"] * 100 for item in sorted_items]

        probabilities = self._compute_probabilities(scores)
        logger.info(f"\nMixed probability distribution: {probabilities}")
        logger.info(f"\nSorted rounds: {sorted_items}")

        selected_index = np.random.choice(len(sorted_items), p=probabilities)
        logger.info(f"\nSelected index: {selected_index}, Selected item: {sorted_items[selected_index]}")

        return sorted_items[selected_index]

    def _compute_probabilities(self, scores, alpha=0.2, lambda_=0.3):
        scores = np.array(scores, dtype=np.float64)
        n = len(scores)

        if n == 0:
            raise ValueError("Score list is empty.")

        uniform_prob = np.full(n, 1.0 / n, dtype=np.float64)

        max_score = np.max(scores)
        shifted_scores = scores - max_score
        exp_weights = np.exp(alpha * shifted_scores)

        sum_exp_weights = np.sum(exp_weights)
        if sum_exp_weights == 0:
            raise ValueError("Sum of exponential weights is 0, cannot normalize.")

        score_prob = exp_weights / sum_exp_weights

        mixed_prob = lambda_ * uniform_prob + (1 - lambda_) * score_prob

        total_prob = np.sum(mixed_prob)
        if not np.isclose(total_prob, 1.0):
            mixed_prob = mixed_prob / total_prob

        return mixed_prob

    def load_log(self, cur_round, path=None, mode: str = "Graph"):
        if mode == "Graph":
            log_dir = os.path.join(self.root_path, "workflows", f"round_{cur_round}", "log.json")
        else:
            log_dir = path

        # 检查文件是否存在
        if not os.path.exists(log_dir):
            return ""  # 如果文件不存在，返回空字符串
        logger.info(log_dir)
        data = read_json_file(log_dir, encoding="utf-8")

        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            data = list(data)

        if not data:
            return ""

        sample_size = min(3, len(data))
        random_samples = random.sample(data, sample_size)

        log = ""
        for sample in random_samples:
            log += json.dumps(sample, indent=4, ensure_ascii=False) + "\n\n"

        return log

    def get_results_file_path(self, graph_path: str) -> str:
        return os.path.join(graph_path, "results.json")

    def create_result_data(self, round: int, score: float, avg_cost: float, total_cost: float) -> dict:
        now = datetime.datetime.now()
        return {"round": round, "score": score, "avg_cost": avg_cost, "total_cost": total_cost, "time": now}

    def save_results(self, json_file_path: str, data: list):
        write_json_file(json_file_path, data, encoding="utf-8", indent=4)

    def _load_scores(self, path=None, mode="Graph"):
        if mode == "Graph":
            rounds_dir = os.path.join(self.root_path, "workflows")
        else:
            rounds_dir = path

        result_file = os.path.join(rounds_dir, "results.json")
        self.top_scores = []

        data = read_json_file(result_file, encoding="utf-8")
        df = pd.DataFrame(data)

        scores_per_round = df.groupby("round")["score"].mean().to_dict()

        for round_number, average_score in scores_per_round.items():
            self.top_scores.append({"round": round_number, "score": average_score})

        self.top_scores.sort(key=lambda x: x["score"], reverse=True)

        return self.top_scores

```

### Core Architecture Module: `metagpt/ext/aflow/scripts/optimizer_utils/evaluation_utils.py`
```
from metagpt.ext.aflow.scripts.evaluator import Evaluator


class EvaluationUtils:
    def __init__(self, root_path: str):
        self.root_path = root_path

    async def evaluate_initial_round(self, optimizer, graph_path, directory, validation_n, data):
        # 使用 optimizer 的 graph_utils 来加载图
        optimizer.graph = optimizer.graph_utils.load_graph(optimizer.round, graph_path)
        evaluator = Evaluator(eval_path=directory)

        for i in range(validation_n):
            score, avg_cost, total_cost = await evaluator.graph_evaluate(
                optimizer.dataset,
                optimizer.graph,
                {"dataset": optimizer.dataset, "llm_config": optimizer.execute_llm_config},
                directory,
                is_test=False,
            )

            new_data = optimizer.data_utils.create_result_data(optimizer.round, score, avg_cost, total_cost)
            data.append(new_data)

            result_path = optimizer.data_utils.get_results_file_path(graph_path)
            optimizer.data_utils.save_results(result_path, data)

        return data

    async def evaluate_graph(self, optimizer, directory, validation_n, data, initial=False):
        evaluator = Evaluator(eval_path=directory)
        sum_score = 0

        for i in range(validation_n):
            score, avg_cost, total_cost = await evaluator.graph_evaluate(
                optimizer.dataset,
                optimizer.graph,
                {"dataset": optimizer.dataset, "llm_config": optimizer.execute_llm_config},
                directory,
                is_test=False,
            )

            cur_round = optimizer.round + 1 if initial is False else optimizer.round

            new_data = optimizer.data_utils.create_result_data(cur_round, score, avg_cost, total_cost)
            data.append(new_data)

            result_path = optimizer.data_utils.get_results_file_path(f"{optimizer.root_path}/workflows")
            optimizer.data_utils.save_results(result_path, data)

            sum_score += score

        return sum_score / validation_n

    async def evaluate_graph_test(self, optimizer, directory, is_test=True):
        evaluator = Evaluator(eval_path=directory)
        return await evaluator.graph_evaluate(
            optimizer.dataset,
            optimizer.graph,
            {"dataset": optimizer.dataset, "llm_config": optimizer.execute_llm_config},
            directory,
            is_test=is_test,
        )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1709** (2025-04-07): **openai o1 raise BadRequestError: Unsupported parameter: 'max_tokens' is not supported with this model**
  *Symptoms*: **Bug description** ``` openai.BadRequestError: Error code: 400 - {'error': {'message': "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.", 'type': 'invalid_request_error', 'param': 'max_tokens', 'code': 'unsupported_parameter'}} ```  llm config: ```yaml llm:   api_type: "openai"  # or azure / ollama / groq etc.   model: "o1"  # or gpt-3.5-turbo   base_url: "https://api.openai.com/v1"  # or forward url / other llm url   api_key: ``` 
  **Post-Mortem & Fix Analysis**:
  > This issue has no activity in the past 30 days. Please comment on the issue if you have anything to add.
  > This issue was closed due to 45 days of inactivity. If you feel this issue is still relevant, please reopen the issue to continue the discussion.

- **Issue #1275** (2024-10-10): **Function _achat_completion_stream in metagpt/provider/openai_api.py produced TypeError: openai.types.completion_usage.CompletionUsage() argument after ** must be a mapping, not NoneType**
  *Symptoms*: **Bug description** Running the example code llm_hello_world.py on branch v0.8-release will produce a TypeError. See logs below.  **Screenshots or logs**  Traceback (most recent call last):   File "/workspaces/MetaGPT/examples/llm_hello_world.py", line 43, in <module>     asyncio.run(main())   File "/usr/local/lib/python3.9/asyncio/runners.py", line 44, in run     return loop.run_until_complete(main)   File "/usr/local/lib/python3.9/asyncio/base_events.py", line 647, in run_until_complete     return future.result()   File "/workspaces/MetaGPT/examples/llm_hello_world.py", line 19, in main     logger.info(await llm.aask(question))   File "/workspaces/MetaGPT/metagpt/provider/base_llm.py", line 150, in aask     rsp = await self.acompletion_text(message, stream=stream, timeout=self.get_timeout(timeout))   File "/usr/local/lib/python3.9/site-packages/tenacity/_asyncio.py", line 88, in async_wrapped     return await fn(*args, **kwargs)   File "/usr/local/lib/python3.9/site-packages/tenacity/_asyncio.py", line 47, in __call__     do = self.iter(retry_state=retry_state)   File "/usr/local/lib/python3.9/site-packages/tenacity/__init__.py", line 314, in iter     return fut.result()   File "/usr/local/lib/python3.9/concurrent/futures/_base.py", line 439, in result     return self.__get_result()   File "/usr/local/lib/python3.9/concurrent/futures/_base.py", line 391, in __get_result     raise self._exception   File "/usr/local/lib/python3.9/site-packages/tenaci

- **Issue #1210** (2024-10-11): **Fixing existing code does not work again**
  *Symptoms*: **Bug description** I generated metagpt project. But I am not satisfied with dummy logic implementation. I want to apply corrections to generated project I tried: --project-path ... --inc and --project-path ... only The docs and resources changes. But the generated code doesn't. The .py code files in project does not change. The new file mentioned in log are not created. Running metagpt on existing project doesn't call metagpt.actions.write_code:run. Only metagpt.actions.write_code_plan_and_change_an:run. Does metagpt support applying new requirements to project?   **Bug solved method** Have not tried to solve yet.  **Environment information** Debian, python=3.11.2-1+b1, venv,  I have this bug as on pip metagpt version, as on newest metagpt github release.  Model gpt-3.5-turbo
  **Post-Mortem & Fix Analysis**:
  > According to the [document](https://docs.deepwisdom.ai/main/en/guide/in_depth_guides/incremental_development.html#unresolved-issues), there are still some unresolved issues in incremental development.
  > I've consolidated all the incremental development-related issues into #1498 to make it easier to follow up. Any new issues will be discussed in this newly opened issue, and the old issue will be closed.

- **Issue #1177** (2025-02-11): **Data Interpreter - Large JSON/tabular data being returned by a tool, should not be included in subsequent code prompts. **
  *Symptoms*: **Bug description** <!-- Clearly and directly describe the current bug --> I have a tool, that returns a large JSON/tabular data. I find that the DI takes all this data(50,000) chars and tries to add it to the prompt for subsequent analysis. (This is too expensive and slow) I could return a file name from the tool, where I dumped the JSON into, but this doesn't *ALWAYS* work, sometimes the DI tries to write all the data into the prompt, or worse still, truncates it.   What is a more efficient way to do this?   **Bug solved method** <!-- If you solved the bug, describe the idea or process to solve the current bug. Of course, you can also paste the URL address of your Pull Request. --> <!-- If not, provide more auxiliary information to facilitate our further positioning and investigation  -->  **Environment information** <!-- Environment：System version (like ubuntu 22.04), Python version (conda python 3.7), LLM type and model (OpenAI gpt-4-1106-preview) --> OpenAI gpt-4-1106-preview Python 3.10 Ubuntu 22.04  - LLM type and model name: - System version: - Python version: - MetaGPT version or branch:  <!-- Dependent packagess：the packages version cause the bug(like `pydantic 1.10.8`), installation method（like `pip install metagpt` or `pip install from source` or `run in docker`） -->  - packages version: - installation method:   **Screenshots or logs** <!-- Screenshots or logs of the bug can help us understand the problem more quickly --> 
  **Post-Mortem & Fix Analysis**:
  > @garylin2099 could you take a look at this?
  > Let me clarify the question, so DI is expected to generate a string for your downstream tasks, and you want the string to contain the file name instead of the file content, which is very long, is my understanding correct?
  > umm, let me explain: Tools could return various kinds of outputs, correct? In my case, my tool returns the rows of a table, as JSON(This could be huge). What happens, is that after the tool execution has completed, DI picks up the output from the logs/working memory and adds it all to the prompt, to continue to the next steps(which could be training a model on the data, etc) This makes the prompt enormous and time-consuming.   I was wondering if there was a way to do this more efficiently, one way I thought of was to dump the JSON in a file and return the file name for the DI to continue with.  This doesn't always work, because the DI ignores the filename sometimes.   So another way I've tried, which has worked better, is to return a Dataframe object and tell DI in the prompt, "to store all outputs in dataframe df" - this helps in my case, since I'm calling a single tool. For multiple tool calls, or calls that are chained, I'm not sure how this will help.   So to conclude, the

- **Issue #1153** (2024-04-04): **mermaid: Generating ..seq_flow/20240402032019.svg.. Error: Failed to launch the browser process!**
  *Symptoms*: **Bug description** Generating /app/metagpt/workspace/jqdlhwap/resources/seq_flow/20240402032019.svg.. Error: Failed to launch the browser process!  **Bug solved method**   **Environment information** "docker compose up -d" after clone already run "npm install -g @mermaid-js/mermaid-cli":  root@84a2e77496b0:/app/metagpt# mmdc -h Usage: mmdc [options]  Options:   -V, --version                                   output the version number   -t, --theme [theme]                             Theme of the chart (choices: "default", "forest", "dark", "neutral", default: "default")   -w, --width [width]                             Width of the page (default: 800)   -H, --height [height]                           Height of the page (default: 600)   -i, --input <input>                             Input mermaid file. Files ending in .md will be treated as Markdown and all charts (e.g. ```mermaid (...)```) will be extracted and generated.                                                   Use `-` to read from stdin.   -o, --output [output]                           Output file. It should be either md, svg, png or pdf. Optional. Default: input + ".svg"   -e, --outputFormat [format]                     Output format for the generated image. (choices: "svg", "png", "pdf", default: Loaded from the output file extension)   -b, --backgroundColor [backgroundColor]         Background color for pngs/svgs (not pdfs). Example: transparent, red, '#F0F0F0'. (default: "white")   -c,
  **Post-Mortem & Fix Analysis**:
  > After this pr merging, modify `config2.yaml` with the following configuration to disable the mermaid tool: ```yaml mermaid:   engine: "none" ```

- **Issue #1132** (2024-10-10): **Minecraft Environment which is contained in the release version is not adapted by Windows**
  *Symptoms*: The Release version somehow put Minecraft (which is a independent branch, not in the main branch) in to it. This "Minecraft Environment" has several packages which are only supported in Linux such as Langchain. If you just use `pip install metagpt` in Windows, you will get error "No module named pwd" as the package pwd is Unix Specific Service Try to use manual installation rather than pip. And please fix this thank you.  中文版本（Chinese Version）： 发行版本中，不知怎么搞的把Minecraft那个Branch拿进来了。这个Branch里有一些Linux依赖，例如Langchain。直接`pip install metagpt`会报错"No module named pwd"，建议手动安装。请作者修复这个问题，移除Minecraft环境，或者让Minecraft环境变得同时适配Windows和Linux。 
  **Post-Mortem & Fix Analysis**:
  > @RyanLoil We should not have any dependencies on langchain (main branch) now. Can you post your specific environment and package version?
  > Here is the dependencies requirement list from [Metagpt 0.7.7 release version](https://files.pythonhosted.org/packages/bc/22/732a40ccd2da1164e5ce0b4e57fbf6ac530aae1e390fa475673cf862fb64/metagpt-0.7.7.tar.gz) from pypi  > aiohttp==3.8.4 > channels==4.0.0 > faiss_cpu==1.7.4 > fire==0.4.0 > typer==0.9.0 > lancedb==0.4.0 > **langchain==0.0.352** > loguru==0.6.0 > meilisearch==0.21.0 > numpy<1.25.0,>=1.24.3 > openai==1.6.0 > openpyxl > beautifulsoup4==4.12.2 > pandas==2.0.3 > pydantic==2.5.3 > python_docx==0.8.11 > PyYAML==6.0.1 > setuptools==65.6.3 > tenacity==8.2.2 > tiktoken==0.5.2 > tqdm==4.65.0 > anthropic==0.8.1 > typing-inspect==0.8.0 > libcst==1.0.1 > qdrant-client==1.7.0 > ta==0.10.2 > semantic-kernel==0.4.3.dev0 > wrapt==1.15.0 > aioredis~=2.0.1 > websocket-client==1.6.2 > aiofiles==23.2.1 > gitpython==3.1.40 > zhipuai==2.0.1 > rich==13.6.0 > nbclient==0.9.0 > nbformat==5.9.2 > ipython==8.17.2 > ipykernel==6.27.0 > scikit_learn==1.3.2 > typ
  > Also I highly recommended that please do not use the dependencies versions which are too specific, many frameworks got abandoned due to this issue.

- **Issue #1100** (2024-10-10): **debate example fail to work with gemini**
  *Symptoms*: **Bug description** debate example throws error with gemini-pro 1.5. Websearch works with gemini-pro  **Bug solved method**  **Environment information** Python 3.9 Conda  - LLM type and model name: Gemini-Pro - System version: - Python version: 3.9   **Screenshots or logs** python3 debate.py "Talk about Artificial General Intelligence" 2024-03-25 17:57:01.666 | INFO     | metagpt.const:get_metagpt_package_root:29 - Package root set to /Users/samsaha2 2024-03-25 17:57:03.800 | INFO     | metagpt.team:invest:90 - Investment: $3.0. 2024-03-25 17:57:03.801 | INFO     | __main__:_act:63 - Biden(Democrat): to do SpeakAloud(SpeakAloud) 2024-03-25 17:57:06.072 | WARNING  | metagpt.utils.common:wrapper:572 - There is a exception in role's execution, in order to resume, we delete the newest role communication message in the role's memory. 2024-03-25 17:57:06.081 | ERROR    | metagpt.utils.common:wrapper:554 - Exception occurs, start to serialize the project, exp: Traceback (most recent call last):   File "/Users/samsaha2/miniconda3/envs/metagpt/lib/python3.9/site-packages/metagpt/utils/common.py", line 563, in wrapper     return await func(self, *args, **kwargs)   File "/Users/samsaha2/miniconda3/envs/metagpt/lib/python3.9/site-packages/metagpt/roles/role.py", line 558, in run     rsp = await self.react() ValueError: The `response.text` quick accessor only works for simple (single-`Part`) text responses. This response is not simple text.Use the `result.parts`
  **Post-Mortem & Fix Analysis**:
  > It's blocked by gemini: ``` [category: HARM_CATEGORY_SEXUALLY_EXPLICIT probability: NEGLIGIBLE , category: HARM_CATEGORY_HATE_SPEECH probability: NEGLIGIBLE , category: HARM_CATEGORY_HARASSMENT probability: NEGLIGIBLE , category: HARM_CATEGORY_DANGEROUS_CONTENT probability: NEGLIGIBLE ] ``` <img width="1272" alt="截屏2024-03-25 21 23 18" src="https://github.com/geekan/MetaGPT/assets/46912756/e2613f68-0570-4d6a-960e-e24703982eff">  hahahaha~~
  > My prompt for debate is the following. " "Talk about Artificial General Intelligence" " How to debug if it is blocked I am just running on command line as below.  python3 debate.py "Talk about Artificial General Intelligence"
  > Try `examples/debate_simple.py`?  remove line 17 and line 19 to use your config in the file.

- **Issue #1095** (2024-10-11): **bug: Fixing existing code does not work**
  *Symptoms*: **Bug description** - `main` branch - logs: [20240321.txt](https://github.com/geekan/MetaGPT/files/14739821/20240321.txt)  `Engineer` ignores error information in `_act_code_plan_and_change()`
  **Post-Mortem & Fix Analysis**:
  > <img width="1121" alt="截屏2024-03-25 15 02 37" src="https://github.com/geekan/MetaGPT/assets/46912756/b9935d42-1a8a-49af-abdc-30b754c3a21e">  The error information is excluded when formatting the prompt: <img width="1011" alt="截屏2024-03-25 15 05 32" src="https://github.com/geekan/MetaGPT/assets/46912756/01e0d61d-7075-4f5f-8eb9-21a914472793">  Actually, the error information is stored in `docs/bugfix.txt`: <img width="339" alt="截屏2024-03-25 15 09 47" src="https://github.com/geekan/MetaGPT/assets/46912756/c85c80db-1be6-4baa-b692-71123b5d96bf">  
  > I've consolidated all the incremental development-related issues into #1498 to make it easier to follow up. Any new issues will be discussed in this newly opened issue, and the old issue will be closed.

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

### Incident Patch 1: `2f0c7fb1` (2025-06-29)
**Commit Message**: Merge pull request #1849 from GasolSun36/feature/bugfix-config-model

Use model instead of config.model inside an LLM instance

**File**: `metagpt/provider/base_llm.py` (modified, +6/-4)
```diff
@@ -42,7 +42,9 @@ class BaseLLM(ABC):
     # OpenAI / Azure / Others
     aclient: Optional[Union[AsyncOpenAI]] = None
     cost_manager: Optional[CostManager] = None
-    model: Optional[str] = None  # deprecated
+    # Maintain model name in own instance in case the global config has changed,
+    # Should always use model not config.model within this class
+    model: Optional[str] = None
     pricing_plan: Optional[str] = None
 
     _reasoning_content: Optional[str] = None  # content from reasoning mode
@@ -87,7 +89,7 @@ def _system_msg(self, msg: str) -> dict[str, str]:
         return {"role": "system", "content": msg}
 
     def support_image_input(self) -> bool:
-        return any([m in self.config.model for m in MULTI_MODAL_MODELS])
+        return any([m in self.model for m in MULTI_MODAL_MODELS])
 
     def format_msg(self, messages: Union[str, "Message", list[dict], list["Message"], list[str]]) -> list[dict]:
         """convert messages to list[dict]."""
@@ -321,7 +323,7 @@ def messages_to_dict(self, messages):
 
     def with_model(self, model: str):
         """Set model and return self. For example, `with_model("gpt-3.5-turbo")`."""
-        self.config.model = model
+        self.model = model
         return self
 
     def get_timeout(self, timeout: int) -> int:
@@ -352,7 +354,7 @@ def compress_messages(
         if compress_type == CompressType.NO_COMPRESS:
             return messages
 
-        max_token = TOKEN_MAX.get(self.config.model, max_token)
+        max_token = TOKEN_MAX.get(self.model, max_token)
         keep_token = int(max_token * threshold)
         compressed = []
 
```

**File**: `metagpt/provider/bedrock_api.py` (modified, +11/-10)
```diff
@@ -22,13 +22,14 @@
 class BedrockLLM(BaseLLM):
     def __init__(self, config: LLMConfig):
         self.config = config
+        self.model = config.model
         self.__client = self.__init_client("bedrock-runtime")
         self.__provider = get_provider(
-            self.config.model, reasoning=self.config.reasoning, reasoning_max_token=self.config.reasoning_max_token
+            self.model, reasoning=self.config.reasoning, reasoning_max_token=self.config.reasoning_max_token
         )
         self.cost_manager = CostManager(token_costs=BEDROCK_TOKEN_COSTS)
-        if self.config.model in NOT_SUPPORT_STREAM_MODELS:
-            logger.warning(f"model {self.config.model} doesn't support streaming output!")
+        if self.model in NOT_SUPPORT_STREAM_MODELS:
+            logger.warning(f"model {self.model} doesn't support streaming output!")
 
     def __init_client(self, service_name: Literal["bedrock-runtime", "bedrock"]):
         """initialize boto3 client"""
@@ -72,25 +73,25 @@ def list_models(self):
     async def invoke_model(self, request_body: str) -> dict:
         loop = asyncio.get_running_loop()
         response = await loop.run_in_executor(
-            None, partial(self.client.invoke_model, modelId=self.config.model, body=request_body)
+            None, partial(self.client.invoke_model, modelId=self.model, body=request_body)
         )
         usage = self._get_usage(response)
-        self._update_costs(usage, self.config.model)
+        self._update_costs(usage, self.model)
         response_body = self._get_response_body(response)
         return response_body
 
     async def invoke_model_with_response_stream(self, request_body: str) -> EventStream:
         loop = asyncio.get_running_loop()
         response = await loop.run_in_executor(
-            None, partial(self.client.invoke_model_with_response_stream, modelId=self.config.model, body=request_body)
+            None, partial(self.client.invoke_model_with_response_stream, modelId=self.model, body=request_body)
         )
         usage = self._get_usage(response)
-        self._update_costs(usage, self.config.model)
+        self._update_costs(usage, self.model)
         return response
 
     @property
     def _const_kwargs(self) -> dict:
-        model_max_tokens = get_max_tokens(self.config.model)
+        model_max_tokens = get_max_tokens(self.model)
         if self.config.max_token > model_max_tokens:
             max_tokens = model_max_tokens
         else:
@@ -119,7 +120,7 @@ async def _achat_completion(self, messages: list[dict], timeout=USE_CONFIG_TIMEO
         return await self.acompletion(messages)
 
     async def _achat_completion_stream(self, messages: list[dict], timeout=USE_CONFIG_TIMEOUT) -> str:
-        if self.config.model in NOT_SUPPORT_STREAM_MODELS:
+        if self.model in NOT_SUPPORT_STREAM_MODELS:
             rsp = await self.acompletion(messages)
             full_text = self.get_choice_text(rsp)
             log_llm_stream(full_text)
@@ -132,7 +133,7 @@ async def _achat_completion_stream(self, messages: list[dict], timeout=USE_CONFI
         full_text = ("".join(collected_content)).lstrip()
         if self.__provider.usage:
             # if provider provide usage, update it
-            self._update_costs(self.__provider.usage, self.config.model)
+            self._update_costs(self.__provider.usage, self.model)
         return full_text
 
     def _get_response_body(self, response) -> dict:
```

**File**: `metagpt/provider/human_provider.py` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ class HumanProvider(BaseLLM):
 
     def __init__(self, config: LLMConfig):
         self.config = config
+        self.model = config.model
 
     def ask(self, msg: str, timeout=USE_CONFIG_TIMEOUT) -> str:
         logger.info("It's your turn, please type in your response. You may also refer to the context below")
```

**File**: `metagpt/provider/ollama_api.py` (modified, +1/-0)
```diff
@@ -195,6 +195,7 @@ class OllamaLLM(BaseLLM):
     def __init__(self, config: LLMConfig):
         self.client = GeneralAPIRequestor(base_url=config.base_url, key=config.api_key)
         self.config = config
+        self.model = config.model
         self.http_method = "post"
         self.use_system_prompt = False
         self.cost_manager = TokenCostManager()
```

**File**: `metagpt/provider/openai_api.py` (modified, +1/-1)
```diff
@@ -321,6 +321,6 @@ async def gen_image(
 
     def count_tokens(self, messages: list[dict]) -> int:
         try:
-            return count_message_tokens(messages, self.config.model)
+            return count_message_tokens(messages, self.model)
         except:
             return super().count_tokens(messages)
```

**File**: `metagpt/provider/qianfan_api.py` (modified, +7/-6)
```diff
@@ -37,6 +37,7 @@ def __init__(self, config: LLMConfig):
         self.cost_manager = CostManager(token_costs=self.token_costs)
 
     def __init_qianfan(self):
+        self.model = self.config.model
         if self.config.access_key and self.config.secret_key:
             # for system level auth, use access_key and secret_key, recommended by official
             # set environment variable due to official recommendation
@@ -61,14 +62,14 @@ def __init_qianfan(self):
             ("ERNIE-Speed", "ernie_speed"),
             ("EB-turbo-AppBuilder", "ai_apaas"),
         ]
-        if self.config.model in [pair[0] for pair in support_system_pairs]:
+        if self.model in [pair[0] for pair in support_system_pairs]:
             # only some ERNIE models support
             self.use_system_prompt = True
         if self.config.endpoint in [pair[1] for pair in support_system_pairs]:
             self.use_system_prompt = True
 
-        assert not (self.config.model and self.config.endpoint), "Only set `model` or `endpoint` in the config"
-        assert self.config.model or self.config.endpoint, "Should set one of `model` or `endpoint` in the config"
+        assert not (self.model and self.config.endpoint), "Only set `model` or `endpoint` in the config"
+        assert self.model or self.config.endpoint, "Should set one of `model` or `endpoint` in the config"
 
         self.token_costs = copy.deepcopy(QIANFAN_MODEL_TOKEN_COSTS)
         self.token_costs.update(QIANFAN_ENDPOINT_TOKEN_COSTS)
@@ -87,8 +88,8 @@ def _const_kwargs(self, messages: list[dict], stream: bool = False) -> dict:
             kwargs["temperature"] = self.config.temperature
         if self.config.endpoint:
             kwargs["endpoint"] = self.config.endpoint
-        elif self.config.model:
-            kwargs["model"] = self.config.model
+        elif self.model:
+            kwargs["model"] = self.model
 
         if self.use_system_prompt:
             # if the model support system prompt, extract and pass it
@@ -99,7 +100,7 @@ def _const_kwargs(self, messages: list[dict], stream: bool = False) -> dict:
 
     def _update_costs(self, usage: dict):
         """update each request's token cost"""
-        model_or_endpoint = self.config.model or self.config.endpoint
+        model_or_endpoint = self.model or self.config.endpoint
         local_calc_usage = model_or_endpoint in self.token_costs
         super()._update_costs(usage, model_or_endpoint, local_calc_usage)
 
```

**File**: `tests/metagpt/provider/mock_llm_config.py` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@
     app_id="mock_app_id",
     api_secret="mock_api_secret",
     domain="mock_domain",
+    model="mock_model",
 )
 
 
```

**File**: `tests/metagpt/provider/test_base_llm.py` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@ def test_format_msg(mocker):
 
 def test_format_msg_w_images(mocker):
     base_llm = MockBaseLLM()
-    base_llm.config.model = "gpt-4o"
+    base_llm.model = "gpt-4o"
     msg_w_images = UserMessage(content="req1")
     msg_w_images.add_metadata(IMAGES, ["base64 string 1", "base64 string 2"])
     msg_w_empty_images = UserMessage(content="req2")
```

---

### Incident Patch 2: `cfb578fe` (2025-06-17)
**Commit Message**: pre-commit fix

**File**: `tests/metagpt/provider/test_base_llm.py` (modified, +1/-1)
```diff
@@ -201,4 +201,4 @@ def test_format_msg_w_images(mocker):
 
 
 if name == "__main__":
-    pytest.main([__file__, "-s"])
\ No newline at end of file
+    pytest.main([__file__, "-s"])
```

---

### Incident Patch 3: `a05eed2e` (2025-06-17)
**Commit Message**: fix bugs for test

**File**: `tests/metagpt/provider/req_resp_const.py` (modified, +52/-5)
```diff
@@ -191,7 +191,7 @@ async def llm_general_chat_funcs_test(llm: BaseLLM, prompt: str, messages: list[
 BEDROCK_PROVIDER_REQUEST_BODY = {
     "mistral": {"prompt": "", "max_tokens": 0, "stop": [], "temperature": 0.0, "top_p": 0.0, "top_k": 0},
     "meta": {"prompt": "", "temperature": 0.0, "top_p": 0.0, "max_gen_len": 0},
-    "ai21": {
+    "ai21-j2": {
         "prompt": "",
         "temperature": 0.0,
         "topP": 0.0,
@@ -201,6 +201,16 @@ async def llm_general_chat_funcs_test(llm: BaseLLM, prompt: str, messages: list[
         "presencePenalty": {"scale": 0.0},
         "frequencyPenalty": {"scale": 0.0},
     },
+    "ai21-jamba": {
+        "messages": [],
+        "temperature": 0.0,
+        "topP": 0.0,
+        "max_tokens": 0,
+        "stopSequences": [],
+        "countPenalty": {"scale": 0.0},
+        "presencePenalty": {"scale": 0.0},
+        "frequencyPenalty": {"scale": 0.0},
+    },
     "cohere": {
         "prompt": "",
         "temperature": 0.0,
@@ -214,6 +224,20 @@ async def llm_general_chat_funcs_test(llm: BaseLLM, prompt: str, messages: list[
         "logit_bias": {},
         "truncate": "NONE",
     },
+    "cohere-command-r": {
+        "message": [],
+        "chat_history": [],
+        "temperature": 0.0,
+        "p": 0.0,
+        "k": 0.0,
+        "max_tokens": 0,
+        "stop_sequences": [],
+        "return_likelihoods": "NONE",
+        "stream": False,
+        "num_generations": 0,
+        "logit_bias": {},
+        "truncate": "NONE",
+    },
     "anthropic": {
         "anthropic_version": "bedrock-2023-05-31",
         "max_tokens": 0,
@@ -233,12 +257,20 @@ async def llm_general_chat_funcs_test(llm: BaseLLM, prompt: str, messages: list[
 BEDROCK_PROVIDER_RESPONSE_BODY = {
     "mistral": {"outputs": [{"text": "Hello World", "stop_reason": ""}]},
     "meta": {"generation": "Hello World", "prompt_token_count": 0, "generation_token_count": 0, "stop_reason": ""},
-    "ai21": {
+    "ai21-jamba": {
         "id": "",
         "prompt": {"text": "Hello World", "tokens": []},
-        "completions": [
-            {"data": {"text": "Hello World", "tokens": []}, "finishReason": {"reason": "length", "length": 2}}
-        ],
+        "choices": [{"message": {"content": "Hello World"}}],
+    },
+    "ai21-jamba-stream": {
+        "id": "",
+        "prompt": {"text": "Hello World", "tokens": []},
+        "choices": [{"delta": {"content": "Hello World"}}],
+    },
+    "ai21-j2": {
+        "id": "",
+        "prompt": {"text": "Hello World", "tokens": []},
+        "completions": [{"data": {"text": "Hello World"}, "finishReason": {"reason": "length", "length": 2}}],
     },
     "cohere": {
         "generations": [
@@ -255,6 +287,21 @@ async def llm_general_chat_funcs_test(llm: BaseLLM, prompt: str, messages: list[
         "id": "",
         "prompt": "",
     },
+    "cohere-command-r": {
+        "generations": [
+            {
+                "finish_reason": "",
+                "id": "",
+                "text": "Hello World",
+                "likelihood": 0.0,
+                "token_likelihoods": [{"token": 0.0}],
+                "is_finished": True,
+                "index": 0,
+            }
+        ],
+        "id": "",
+        "prompt": "",
+    },
     "anthropic": {
         "id": "",
         "model": "",
```

**File**: `tests/metagpt/provider/test_base_llm.py` (modified, +60/-2)
```diff
@@ -8,6 +8,7 @@
 
 import pytest
 
+from metagpt.configs.compress_msg_config import CompressType
 from metagpt.configs.llm_config import LLMConfig
 from metagpt.const import IMAGES
 from metagpt.provider.base_llm import BaseLLM
@@ -25,7 +26,6 @@
 class MockBaseLLM(BaseLLM):
     def __init__(self, config: LLMConfig = None):
         self.config = config or mock_llm_config
-        self.model = mock_llm_config.model
 
     def completion(self, messages: list[dict], timeout=3):
         return get_part_chat_completion(name)
@@ -108,6 +108,64 @@ async def test_async_base_llm():
     # assert resp == default_resp_cont
 
 
+@pytest.mark.parametrize("compress_type", list(CompressType))
+def test_compress_messages_no_effect(compress_type):
+    base_llm = MockBaseLLM()
+    messages = [
+        {"role": "system", "content": "first system msg"},
+        {"role": "system", "content": "second system msg"},
+    ]
+    for i in range(5):
+        messages.append({"role": "user", "content": f"u{i}"})
+        messages.append({"role": "assistant", "content": f"a{i}"})
+    compressed = base_llm.compress_messages(messages, compress_type=compress_type)
+    # should take no effect for short context
+    assert compressed == messages
+
+
+@pytest.mark.parametrize("compress_type", CompressType.cut_types())
+def test_compress_messages_long(compress_type):
+    base_llm = MockBaseLLM()
+    base_llm.config.model = "test_llm"
+    max_token_limit = 100
+
+    messages = [
+        {"role": "system", "content": "first system msg"},
+        {"role": "system", "content": "second system msg"},
+    ]
+    for i in range(100):
+        messages.append({"role": "user", "content": f"u{i}" * 10})  # ~2x10x0.5 = 10 tokens
+        messages.append({"role": "assistant", "content": f"a{i}" * 10})
+    compressed = base_llm.compress_messages(messages, compress_type=compress_type, max_token=max_token_limit)
+
+    print(compressed)
+    print(len(compressed))
+    assert 3 <= len(compressed) < len(messages)
+    assert compressed[0]["role"] == "system" and compressed[1]["role"] == "system"
+    assert compressed[2]["role"] != "system"
+
+
+def test_long_messages_no_compress():
+    base_llm = MockBaseLLM()
+    messages = [{"role": "user", "content": "1" * 10000}] * 10000
+    compressed = base_llm.compress_messages(messages)
+    assert len(compressed) == len(messages)
+
+
+@pytest.mark.parametrize("compress_type", CompressType.cut_types())
+def test_compress_messages_long_no_sys_msg(compress_type):
+    base_llm = MockBaseLLM()
+    base_llm.config.model = "test_llm"
+    max_token_limit = 100
+
+    messages = [{"role": "user", "content": "1" * 10000}]
+    compressed = base_llm.compress_messages(messages, compress_type=compress_type, max_token=max_token_limit)
+
+    print(compressed)
+    assert compressed
+    assert len(compressed[0]["content"]) < len(messages[0]["content"])
+
+
 def test_format_msg(mocker):
     base_llm = MockBaseLLM()
     messages = [UserMessage(content="req"), AIMessage(content="rsp")]
@@ -143,4 +201,4 @@ def test_format_msg_w_images(mocker):
 
 
 if name == "__main__":
-    pytest.main([__file__, "-s"])
+    pytest.main([__file__, "-s"])
\ No newline at end of file
```

**File**: `tests/metagpt/provider/test_bedrock_api.py` (modified, +31/-5)
```diff
@@ -22,9 +22,33 @@
 }
 
 
+def get_provider_name(model: str) -> str:
+    arr = model.split(".")
+    if len(arr) == 2:
+        provider, model_name = arr  # meta、mistral……
+    elif len(arr) == 3:
+        # some model_ids may contain country like us.xx.xxx
+        _, provider, model_name = arr
+    return provider
+
+
+def deal_special_provider(provider: str, model: str, stream: bool = False) -> str:
+    # for ai21
+    if "j2-" in model:
+        provider = f"{provider}-j2"
+    elif "jamba-" in model:
+        provider = f"{provider}-jamba"
+    elif "command-r" in model:
+        provider = f"{provider}-command-r"
+    if stream and "ai21" in model:
+        provider = f"{provider}-stream"
+    return provider
+
+
 async def mock_invoke_model(self: BedrockLLM, *args, **kwargs) -> dict:
-    provider = self.config.model.split(".")[0]
-    self._update_costs(usage, self.config.model)
+    provider = get_provider_name(self.model)
+    self._update_costs(usage, self.model)
+    provider = deal_special_provider(provider, self.model)
     return BEDROCK_PROVIDER_RESPONSE_BODY[provider]
 
 
@@ -33,7 +57,7 @@ async def mock_invoke_model_stream(self: BedrockLLM, *args, **kwargs) -> dict:
     def dict2bytes(x):
         return json.dumps(x).encode("utf-8")
 
-    provider = self.config.model.split(".")[0]
+    provider = get_provider_name(self.model)
 
     if provider == "amazon":
         response_body_bytes = dict2bytes({"outputText": "Hello World"})
@@ -44,15 +68,17 @@ def dict2bytes(x):
     elif provider == "cohere":
         response_body_bytes = dict2bytes({"is_finished": False, "text": "Hello World"})
     else:
+        provider = deal_special_provider(provider, self.model, stream=True)
         response_body_bytes = dict2bytes(BEDROCK_PROVIDER_RESPONSE_BODY[provider])
 
     response_body_stream = {"body": [{"chunk": {"bytes": response_body_bytes}}]}
-    self._update_costs(usage, self.config.model)
+    self._update_costs(usage, self.model)
     return response_body_stream
 
 
 def get_bedrock_request_body(model_id) -> dict:
-    provider = model_id.split(".")[0]
+    provider = get_provider_name(model_id)
+    provider = deal_special_provider(provider, model_id)
     return BEDROCK_PROVIDER_REQUEST_BODY[provider]
 
 
```

---

### Incident Patch 4: `46feec4a` (2025-06-16)
**Commit Message**: fix_bug_for_config_model

**File**: `metagpt/provider/base_llm.py` (modified, +6/-4)
```diff
@@ -42,7 +42,9 @@ class BaseLLM(ABC):
     # OpenAI / Azure / Others
     aclient: Optional[Union[AsyncOpenAI]] = None
     cost_manager: Optional[CostManager] = None
-    model: Optional[str] = None  # deprecated
+    # Maintain model name in own instance in case the global config has changed,
+    # Should always use model not config.model within this class
+    model: Optional[str] = None
     pricing_plan: Optional[str] = None
 
     _reasoning_content: Optional[str] = None  # content from reasoning mode
@@ -87,7 +89,7 @@ def _system_msg(self, msg: str) -> dict[str, str]:
         return {"role": "system", "content": msg}
 
     def support_image_input(self) -> bool:
-        return any([m in self.config.model for m in MULTI_MODAL_MODELS])
+        return any([m in self.model for m in MULTI_MODAL_MODELS])
 
     def format_msg(self, messages: Union[str, "Message", list[dict], list["Message"], list[str]]) -> list[dict]:
         """convert messages to list[dict]."""
@@ -321,7 +323,7 @@ def messages_to_dict(self, messages):
 
     def with_model(self, model: str):
         """Set model and return self. For example, `with_model("gpt-3.5-turbo")`."""
-        self.config.model = model
+        self.model = model
         return self
 
     def get_timeout(self, timeout: int) -> int:
@@ -352,7 +354,7 @@ def compress_messages(
         if compress_type == CompressType.NO_COMPRESS:
             return messages
 
-        max_token = TOKEN_MAX.get(self.config.model, max_token)
+        max_token = TOKEN_MAX.get(self.model, max_token)
         keep_token = int(max_token * threshold)
         compressed = []
 
```

**File**: `metagpt/provider/bedrock_api.py` (modified, +11/-10)
```diff
@@ -22,13 +22,14 @@
 class BedrockLLM(BaseLLM):
     def __init__(self, config: LLMConfig):
         self.config = config
+        self.model = config.model
         self.__client = self.__init_client("bedrock-runtime")
         self.__provider = get_provider(
-            self.config.model, reasoning=self.config.reasoning, reasoning_max_token=self.config.reasoning_max_token
+            self.model, reasoning=self.config.reasoning, reasoning_max_token=self.config.reasoning_max_token
         )
         self.cost_manager = CostManager(token_costs=BEDROCK_TOKEN_COSTS)
-        if self.config.model in NOT_SUPPORT_STREAM_MODELS:
-            logger.warning(f"model {self.config.model} doesn't support streaming output!")
+        if self.model in NOT_SUPPORT_STREAM_MODELS:
+            logger.warning(f"model {self.model} doesn't support streaming output!")
 
     def __init_client(self, service_name: Literal["bedrock-runtime", "bedrock"]):
         """initialize boto3 client"""
@@ -72,25 +73,25 @@ def list_models(self):
     async def invoke_model(self, request_body: str) -> dict:
         loop = asyncio.get_running_loop()
         response = await loop.run_in_executor(
-            None, partial(self.client.invoke_model, modelId=self.config.model, body=request_body)
+            None, partial(self.client.invoke_model, modelId=self.model, body=request_body)
         )
         usage = self._get_usage(response)
-        self._update_costs(usage, self.config.model)
+        self._update_costs(usage, self.model)
         response_body = self._get_response_body(response)
         return response_body
 
     async def invoke_model_with_response_stream(self, request_body: str) -> EventStream:
         loop = asyncio.get_running_loop()
         response = await loop.run_in_executor(
-            None, partial(self.client.invoke_model_with_response_stream, modelId=self.config.model, body=request_body)
+            None, partial(self.client.invoke_model_with_response_stream, modelId=self.model, body=request_body)
         )
         usage = self._get_usage(response)
-        self._update_costs(usage, self.config.model)
+        self._update_costs(usage, self.model)
         return response
 
     @property
     def _const_kwargs(self) -> dict:
-        model_max_tokens = get_max_tokens(self.config.model)
+        model_max_tokens = get_max_tokens(self.model)
         if self.config.max_token > model_max_tokens:
             max_tokens = model_max_tokens
         else:
@@ -119,7 +120,7 @@ async def _achat_completion(self, messages: list[dict], timeout=USE_CONFIG_TIMEO
         return await self.acompletion(messages)
 
     async def _achat_completion_stream(self, messages: list[dict], timeout=USE_CONFIG_TIMEOUT) -> str:
-        if self.config.model in NOT_SUPPORT_STREAM_MODELS:
+        if self.model in NOT_SUPPORT_STREAM_MODELS:
             rsp = await self.acompletion(messages)
             full_text = self.get_choice_text(rsp)
             log_llm_stream(full_text)
@@ -132,7 +133,7 @@ async def _achat_completion_stream(self, messages: list[dict], timeout=USE_CONFI
         full_text = ("".join(collected_content)).lstrip()
         if self.__provider.usage:
             # if provider provide usage, update it
-            self._update_costs(self.__provider.usage, self.config.model)
+            self._update_costs(self.__provider.usage, self.model)
         return full_text
 
     def _get_response_body(self, response) -> dict:
```

**File**: `metagpt/provider/human_provider.py` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ class HumanProvider(BaseLLM):
 
     def __init__(self, config: LLMConfig):
         self.config = config
+        self.model = config.model
 
     def ask(self, msg: str, timeout=USE_CONFIG_TIMEOUT) -> str:
         logger.info("It's your turn, please type in your response. You may also refer to the context below")
```

**File**: `metagpt/provider/ollama_api.py` (modified, +1/-0)
```diff
@@ -195,6 +195,7 @@ class OllamaLLM(BaseLLM):
     def __init__(self, config: LLMConfig):
         self.client = GeneralAPIRequestor(base_url=config.base_url, key=config.api_key)
         self.config = config
+        self.model = config.model
         self.http_method = "post"
         self.use_system_prompt = False
         self.cost_manager = TokenCostManager()
```

**File**: `metagpt/provider/openai_api.py` (modified, +1/-1)
```diff
@@ -321,6 +321,6 @@ async def gen_image(
 
     def count_tokens(self, messages: list[dict]) -> int:
         try:
-            return count_message_tokens(messages, self.config.model)
+            return count_message_tokens(messages, self.model)
         except:
             return super().count_tokens(messages)
```

**File**: `metagpt/provider/qianfan_api.py` (modified, +7/-6)
```diff
@@ -37,6 +37,7 @@ def __init__(self, config: LLMConfig):
         self.cost_manager = CostManager(token_costs=self.token_costs)
 
     def __init_qianfan(self):
+        self.model = self.config.model
         if self.config.access_key and self.config.secret_key:
             # for system level auth, use access_key and secret_key, recommended by official
             # set environment variable due to official recommendation
@@ -61,14 +62,14 @@ def __init_qianfan(self):
             ("ERNIE-Speed", "ernie_speed"),
             ("EB-turbo-AppBuilder", "ai_apaas"),
         ]
-        if self.config.model in [pair[0] for pair in support_system_pairs]:
+        if self.model in [pair[0] for pair in support_system_pairs]:
             # only some ERNIE models support
             self.use_system_prompt = True
         if self.config.endpoint in [pair[1] for pair in support_system_pairs]:
             self.use_system_prompt = True
 
-        assert not (self.config.model and self.config.endpoint), "Only set `model` or `endpoint` in the config"
-        assert self.config.model or self.config.endpoint, "Should set one of `model` or `endpoint` in the config"
+        assert not (self.model and self.config.endpoint), "Only set `model` or `endpoint` in the config"
+        assert self.model or self.config.endpoint, "Should set one of `model` or `endpoint` in the config"
 
         self.token_costs = copy.deepcopy(QIANFAN_MODEL_TOKEN_COSTS)
         self.token_costs.update(QIANFAN_ENDPOINT_TOKEN_COSTS)
@@ -87,8 +88,8 @@ def _const_kwargs(self, messages: list[dict], stream: bool = False) -> dict:
             kwargs["temperature"] = self.config.temperature
         if self.config.endpoint:
             kwargs["endpoint"] = self.config.endpoint
-        elif self.config.model:
-            kwargs["model"] = self.config.model
+        elif self.model:
+            kwargs["model"] = self.model
 
         if self.use_system_prompt:
             # if the model support system prompt, extract and pass it
@@ -99,7 +100,7 @@ def _const_kwargs(self, messages: list[dict], stream: bool = False) -> dict:
 
     def _update_costs(self, usage: dict):
         """update each request's token cost"""
-        model_or_endpoint = self.config.model or self.config.endpoint
+        model_or_endpoint = self.model or self.config.endpoint
         local_calc_usage = model_or_endpoint in self.token_costs
         super()._update_costs(usage, model_or_endpoint, local_calc_usage)
 
```

**File**: `tests/metagpt/provider/mock_llm_config.py` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@
     app_id="mock_app_id",
     api_secret="mock_api_secret",
     domain="mock_domain",
+    model="mock_model",
 )
 
 
```

**File**: `tests/metagpt/provider/test_base_llm.py` (modified, +2/-60)
```diff
@@ -8,7 +8,6 @@
 
 import pytest
 
-from metagpt.configs.compress_msg_config import CompressType
 from metagpt.configs.llm_config import LLMConfig
 from metagpt.const import IMAGES
 from metagpt.provider.base_llm import BaseLLM
@@ -26,6 +25,7 @@
 class MockBaseLLM(BaseLLM):
     def __init__(self, config: LLMConfig = None):
         self.config = config or mock_llm_config
+        self.model = mock_llm_config.model
 
     def completion(self, messages: list[dict], timeout=3):
         return get_part_chat_completion(name)
@@ -108,64 +108,6 @@ async def test_async_base_llm():
     # assert resp == default_resp_cont
 
 
-@pytest.mark.parametrize("compress_type", list(CompressType))
-def test_compress_messages_no_effect(compress_type):
-    base_llm = MockBaseLLM()
-    messages = [
-        {"role": "system", "content": "first system msg"},
-        {"role": "system", "content": "second system msg"},
-    ]
-    for i in range(5):
-        messages.append({"role": "user", "content": f"u{i}"})
-        messages.append({"role": "assistant", "content": f"a{i}"})
-    compressed = base_llm.compress_messages(messages, compress_type=compress_type)
-    # should take no effect for short context
-    assert compressed == messages
-
-
-@pytest.mark.parametrize("compress_type", CompressType.cut_types())
-def test_compress_messages_long(compress_type):
-    base_llm = MockBaseLLM()
-    base_llm.config.model = "test_llm"
-    max_token_limit = 100
-
-    messages = [
-        {"role": "system", "content": "first system msg"},
-        {"role": "system", "content": "second system msg"},
-    ]
-    for i in range(100):
-        messages.append({"role": "user", "content": f"u{i}" * 10})  # ~2x10x0.5 = 10 tokens
-        messages.append({"role": "assistant", "content": f"a{i}" * 10})
-    compressed = base_llm.compress_messages(messages, compress_type=compress_type, max_token=max_token_limit)
-
-    print(compressed)
-    print(len(compressed))
-    assert 3 <= len(compressed) < len(messages)
-    assert compressed[0]["role"] == "system" and compressed[1]["role"] == "system"
-    assert compressed[2]["role"] != "system"
-
-
-def test_long_messages_no_compress():
-    base_llm = MockBaseLLM()
-    messages = [{"role": "user", "content": "1" * 10000}] * 10000
-    compressed = base_llm.compress_messages(messages)
-    assert len(compressed) == len(messages)
-
-
-@pytest.mark.parametrize("compress_type", CompressType.cut_types())
-def test_compress_messages_long_no_sys_msg(compress_type):
-    base_llm = MockBaseLLM()
-    base_llm.config.model = "test_llm"
-    max_token_limit = 100
-
-    messages = [{"role": "user", "content": "1" * 10000}]
-    compressed = base_llm.compress_messages(messages, compress_type=compress_type, max_token=max_token_limit)
-
-    print(compressed)
-    assert compressed
-    assert len(compressed[0]["content"]) < len(messages[0]["content"])
-
-
 def test_format_msg(mocker):
     base_llm = MockBaseLLM()
     messages = [UserMessage(content="req"), AIMessage(content="rsp")]
@@ -175,7 +117,7 @@ def test_format_msg(mocker):
 
 def test_format_msg_w_images(mocker):
     base_llm = MockBaseLLM()
-    base_llm.config.model = "gpt-4o"
+    base_llm.model = "gpt-4o"
     msg_w_images = UserMessage(content="req1")
     msg_w_images.add_metadata(IMAGES, ["base64 string 1", "base64 string 2"])
     msg_w_empty_images = UserMessage(content="req2")
```

---

### Incident Patch 5: `bcf01951` (2025-03-25)
**Commit Message**: bugfix: Missing download info for actions/upload-artifact@v3

**File**: `.github/workflows/unittest.yaml` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@ on:
 
 jobs:
   build:
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-22.04
     strategy:
       matrix:
         # python-version: ['3.9', '3.10', '3.11']
@@ -48,7 +48,7 @@ jobs:
           exit 1
         fi
     - name: Upload pytest test results
-      uses: actions/upload-artifact@v3
+      uses: actions/upload-artifact@v4
       with:
         name: pytest-results-${{ matrix.python-version }}
         path: |
```

---

### Incident Patch 6: `ad334450` (2025-03-18)
**Commit Message**: Update requirements.txt

**File**: `requirements.txt` (modified, +1/-2)
```diff
@@ -85,7 +85,6 @@ volcengine-python-sdk[ark]~=1.0.94 # Solution for installation error in Windows:
 gymnasium==0.29.1
 boto3~=1.34.69
 spark_ai_python~=0.3.30
-agentops
 tree_sitter~=0.23.2
 tree_sitter_python~=0.23.2
-httpx==0.28.1
\ No newline at end of file
+httpx==0.28.1
```

---

### Incident Patch 7: `feec34ca` (2025-03-10)
**Commit Message**: fix pre-commit

**File**: `metagpt/utils/token_counter.py` (modified, +0/-1)
```diff
@@ -93,7 +93,6 @@
     "openai/o1-preview": {"prompt": 0.015, "completion": 0.06},
     "openai/o1-mini": {"prompt": 0.003, "completion": 0.012},
     "anthropic/claude-3-opus": {"prompt": 0.015, "completion": 0.075},
-    "anthropic/claude-3.5-sonnet": {"prompt": 0.003, "completion": 0.015},
     "anthropic/claude-3.7-sonnet": {"prompt": 0.003, "completion": 0.015},
     "anthropic/claude-3.7-sonnet:beta": {"prompt": 0.003, "completion": 0.015},
     "anthropic/claude-3.7-sonnet:thinking": {"prompt": 0.003, "completion": 0.015},
```

---

### Incident Patch 8: `cf761ab7` (2025-03-09)
**Commit Message**: Merge pull request #1600 from MorpheusI0/feature/support_for_open_webui

Add api key to ollama client to support open webui

**File**: `metagpt/provider/ollama_api.py` (modified, +1/-1)
```diff
@@ -193,7 +193,7 @@ class OllamaLLM(BaseLLM):
     """
 
     def __init__(self, config: LLMConfig):
-        self.client = GeneralAPIRequestor(base_url=config.base_url)
+        self.client = GeneralAPIRequestor(base_url=config.base_url, key=config.api_key)
         self.config = config
         self.http_method = "post"
         self.use_system_prompt = False
```

---

### Incident Patch 9: `de368d81` (2025-03-09)
**Commit Message**: Merge pull request #1725 from seehi/fix-gemini-model

Support gemini models

**File**: `metagpt/provider/google_gemini_api.py` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ def __init__(self, config: LLMConfig):
 
         self.__init_gemini(config)
         self.config = config
-        self.model = "gemini-pro"  # so far only one model
+        self.model = config.model
         self.pricing_plan = self.config.pricing_plan or self.model
         self.llm = GeminiGenerativeModel(model_name=self.model)
 
```

---

### Incident Patch 10: `f36a4ece` (2025-02-28)
**Commit Message**: Merge pull request #1728 from HuiDBK/mgx_example

example fix

**File**: `examples/di/ocr_receipt.py` (modified, +4/-4)
```diff
@@ -1,17 +1,17 @@
+from metagpt.const import EXAMPLE_DATA_PATH
 from metagpt.roles.di.data_interpreter import DataInterpreter
 
 
 async def main():
     # Notice: pip install metagpt[ocr] before using this example
-    image_path = "image.jpg"
+    image_path = EXAMPLE_DATA_PATH / "di/receipt_shopping.jpg"
     language = "English"
     requirement = f"""This is a {language} receipt image.
     Your goal is to perform OCR on images using PaddleOCR, output text content from the OCR results and discard 
-    coordinates and confidence levels, then recognize the total amount from ocr text content, and finally save as table. 
+    coordinates and confidence levels, then recognize the total amount from ocr text content, and finally save as csv table. 
     Image path: {image_path}.
     NOTE: The environments for Paddle and PaddleOCR are all ready and has been fully installed."""
-    di = DataInterpreter()
-
+    di = DataInterpreter(react_mode="react")
     await di.run(requirement)
 
 
```

**File**: `examples/di/rm_image_background.py` (modified, +3/-2)
```diff
@@ -1,5 +1,6 @@
 import asyncio
 
+from metagpt.const import DEFAULT_WORKSPACE_ROOT, EXAMPLE_DATA_PATH
 from metagpt.roles.di.data_interpreter import DataInterpreter
 
 
@@ -9,7 +10,7 @@ async def main(requirement: str = ""):
 
 
 if __name__ == "__main__":
-    image_path = "/your/path/to/the/image.jpeg"
-    save_path = "/your/intended/save/path/for/image_rm_bg.png"
+    image_path = EXAMPLE_DATA_PATH / "di/dog.jpg"
+    save_path = DEFAULT_WORKSPACE_ROOT / "image_rm_bg.png"
     requirement = f"This is a image, you need to use python toolkit rembg to remove the background of the image and save the result. image path:{image_path}; save path:{save_path}."
     asyncio.run(main(requirement))
```

---

### Incident Patch 11: `178ddaec` (2025-02-28)
**Commit Message**: example fix

**File**: `examples/android_assistant/run_assistant.py` (modified, +2/-1)
```diff
@@ -9,7 +9,7 @@
 
 import typer
 
-from metagpt.config2 import config
+from metagpt.config2 import Config
 from metagpt.environment.android.android_env import AndroidEnv
 from metagpt.ext.android_assistant.roles.android_assistant import AndroidAssistant
 from metagpt.team import Team
@@ -41,6 +41,7 @@ def startup(
     ),
     device_id: str = typer.Option(default="emulator-5554", help="The Android device_id"),
 ):
+    config = Config.default()
     config.extra = {
         "stage": stage,
         "mode": mode,
```

**File**: `examples/di/ocr_receipt.py` (modified, +5/-4)
```diff
@@ -1,17 +1,18 @@
+from metagpt.const import EXAMPLE_DATA_PATH
 from metagpt.roles.di.data_interpreter import DataInterpreter
 
 
 async def main():
     # Notice: pip install metagpt[ocr] before using this example
-    image_path = "image.jpg"
+    image_path = EXAMPLE_DATA_PATH / "di/receipt_shopping.jpg"
     language = "English"
     requirement = f"""This is a {language} receipt image.
     Your goal is to perform OCR on images using PaddleOCR, output text content from the OCR results and discard 
-    coordinates and confidence levels, then recognize the total amount from ocr text content, and finally save as table. 
+    coordinates and confidence levels, then recognize the total amount from ocr text content, and finally save as csv table. 
     Image path: {image_path}.
     NOTE: The environments for Paddle and PaddleOCR are all ready and has been fully installed."""
-    di = DataInterpreter()
-
+    di = DataInterpreter(react_mode="react")
+    print(requirement)
     await di.run(requirement)
 
 
```

**File**: `examples/di/rm_image_background.py` (modified, +3/-2)
```diff
@@ -1,5 +1,6 @@
 import asyncio
 
+from metagpt.const import DEFAULT_WORKSPACE_ROOT, EXAMPLE_DATA_PATH
 from metagpt.roles.di.data_interpreter import DataInterpreter
 
 
@@ -9,7 +10,7 @@ async def main(requirement: str = ""):
 
 
 if __name__ == "__main__":
-    image_path = "/your/path/to/the/image.jpeg"
-    save_path = "/your/intended/save/path/for/image_rm_bg.png"
+    image_path = EXAMPLE_DATA_PATH / "di/dog.jpg"
+    save_path = DEFAULT_WORKSPACE_ROOT / "image_rm_bg.png"
     requirement = f"This is a image, you need to use python toolkit rembg to remove the background of the image and save the result. image path:{image_path}; save path:{save_path}."
     asyncio.run(main(requirement))
```

**File**: `examples/rag/omniparse.py` (modified, +3/-1)
```diff
@@ -1,6 +1,6 @@
 import asyncio
 
-from metagpt.config2 import config
+from metagpt.config2 import Config
 from metagpt.const import EXAMPLE_DATA_PATH
 from metagpt.logs import logger
 from metagpt.rag.parsers import OmniParse
@@ -12,6 +12,8 @@
 TEST_VIDEO = EXAMPLE_DATA_PATH / "omniparse/test03.mp4"
 TEST_AUDIO = EXAMPLE_DATA_PATH / "omniparse/test04.mp3"
 
+config = Config.default()
+
 
 async def omniparse_client_example():
     client = OmniParseClient(base_url=config.omniparse.base_url)
```

**File**: `metagpt/environment/werewolf/env_space.py` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 from gymnasium import spaces
 from pydantic import ConfigDict, Field
 
-from metagpt.environment.base_env_space import BaseEnvAction, BaseEnvActionType
+from metagpt.base.base_env_space import BaseEnvAction, BaseEnvActionType
 from metagpt.environment.werewolf.const import STEP_INSTRUCTIONS
 
 
```

---

### Incident Patch 12: `9e989af3` (2025-02-28)
**Commit Message**: fix bug

**File**: `examples/ui_with_chainlit/app.py` (modified, +4/-2)
```diff
@@ -1,3 +1,5 @@
+from pathlib import Path
+
 import chainlit as cl
 from init_setup import ChainlitEnv
 
@@ -67,8 +69,8 @@ async def startup(message: cl.Message) -> None:
 
     await company.run(n_round=5)
 
-    workdir = company.env.context.git_repo.workdir
-    files = company.env.context.git_repo.get_files(workdir)
+    workdir = Path(company.env.context.config.project_path)
+    files = [file.name for file in workdir.iterdir() if file.is_file()]
     files = "\n".join([f"{workdir}/{file}" for file in files if not file.startswith(".git")])
 
     await cl.Message(
```

---

### Incident Patch 13: `b2aac3eb` (2025-02-28)
**Commit Message**: fix bug

**File**: `examples/android_assistant/run_assistant.py` (modified, +2/-1)
```diff
@@ -9,7 +9,7 @@
 
 import typer
 
-from metagpt.config2 import config
+from metagpt.config2 import Config
 from metagpt.environment.android.android_env import AndroidEnv
 from metagpt.ext.android_assistant.roles.android_assistant import AndroidAssistant
 from metagpt.team import Team
@@ -41,6 +41,7 @@ def startup(
     ),
     device_id: str = typer.Option(default="emulator-5554", help="The Android device_id"),
 ):
+    config = Config.default()
     config.extra = {
         "stage": stage,
         "mode": mode,
```

---

### Incident Patch 14: `db8b2976` (2025-02-28)
**Commit Message**: fix bug

**File**: `metagpt/environment/android/env_space.py` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
 from gymnasium import spaces
 from pydantic import ConfigDict, Field, field_validator
 
-from metagpt.environment.base_env_space import (
+from metagpt.base.base_env_space import (
     BaseEnvAction,
     BaseEnvActionType,
     BaseEnvObsParams,
```

**File**: `metagpt/environment/werewolf/env_space.py` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 from gymnasium import spaces
 from pydantic import ConfigDict, Field
 
-from metagpt.environment.base_env_space import BaseEnvAction, BaseEnvActionType
+from metagpt.base.base_env_space import BaseEnvAction, BaseEnvActionType
 from metagpt.environment.werewolf.const import STEP_INSTRUCTIONS
 
 
```

**File**: `metagpt/ext/android_assistant/actions/manual_record.py` (modified, +2/-1)
```diff
@@ -7,7 +7,7 @@
 import cv2
 
 from metagpt.actions.action import Action
-from metagpt.config2 import config
+from metagpt.config2 import Config
 from metagpt.environment.android.android_env import AndroidEnv
 from metagpt.environment.android.const import ADB_EXEC_FAIL
 from metagpt.environment.android.env_space import (
@@ -55,6 +55,7 @@ async def run(self, task_desc: str, task_dir: Path, env: AndroidEnv):
         self.task_desc_path.write_text(task_desc)
 
         step = 0
+        config = Config.default()
         extra_config = config.extra
         while True:
             step += 1
```

**File**: `metagpt/ext/android_assistant/actions/parse_record.py` (modified, +2/-1)
```diff
@@ -8,7 +8,7 @@
 from pathlib import Path
 
 from metagpt.actions.action import Action
-from metagpt.config2 import config
+from metagpt.config2 import Config
 from metagpt.ext.android_assistant.actions.parse_record_an import RECORD_PARSE_NODE
 from metagpt.ext.android_assistant.prompts.operation_prompt import (
     long_press_doc_template,
@@ -45,6 +45,7 @@ async def run(self, task_dir: Path, docs_dir: Path):
             path.mkdir(parents=True, exist_ok=True)
 
         task_desc = self.task_desc_path.read_text()
+        config = Config.default()
         extra_config = config.extra
 
         with open(self.record_path, "r") as record_file:
```

**File**: `metagpt/ext/android_assistant/actions/screenshot_parse.py` (modified, +2/-1)
```diff
@@ -6,7 +6,7 @@
 from pathlib import Path
 
 from metagpt.actions.action import Action
-from metagpt.config2 import config
+from metagpt.config2 import Config
 from metagpt.environment.android.android_env import AndroidEnv
 from metagpt.environment.android.const import ADB_EXEC_FAIL
 from metagpt.environment.android.env_space import (
@@ -101,6 +101,7 @@ async def run(
         grid_on: bool,
         env: AndroidEnv,
     ):
+        config = Config.default()
         extra_config = config.extra
         for path in [task_dir, docs_dir]:
             path.mkdir(parents=True, exist_ok=True)
```

**File**: `metagpt/ext/android_assistant/actions/self_learn_and_reflect.py` (modified, +2/-1)
```diff
@@ -6,7 +6,7 @@
 from pathlib import Path
 
 from metagpt.actions.action import Action
-from metagpt.config2 import config
+from metagpt.config2 import Config
 from metagpt.environment.android.android_env import AndroidEnv
 from metagpt.environment.android.const import ADB_EXEC_FAIL
 from metagpt.environment.android.env_space import (
@@ -80,6 +80,7 @@ async def run(
     async def run_self_learn(
         self, round_count: int, task_desc: str, last_act: str, task_dir: Path, env: AndroidEnv
     ) -> AndroidActionOutput:
+        config = Config.default()
         extra_config = config.extra
         screenshot_path: Path = env.observe(
             EnvObsParams(obs_type=EnvObsType.GET_SCREENSHOT, ss_name=f"{round_count}_before", local_save_dir=task_dir)
```

**File**: `metagpt/ext/android_assistant/roles/android_assistant.py` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@
 from pydantic import Field
 
 from metagpt.actions.add_requirement import UserRequirement
-from metagpt.config2 import config
+from metagpt.config2 import Config
 from metagpt.const import EXAMPLE_PATH
 from metagpt.ext.android_assistant.actions.manual_record import ManualRecord
 from metagpt.ext.android_assistant.actions.parse_record import ParseRecord
@@ -38,7 +38,7 @@ class AndroidAssistant(Role):
 
     def __init__(self, **data):
         super().__init__(**data)
-
+        config = Config.default()
         self._watch([UserRequirement, AndroidActionOutput])
         extra_config = config.extra
         self.task_desc = extra_config.get("task_desc", "Just explore any app in this phone!")
```

**File**: `metagpt/ext/android_assistant/utils/utils.py` (modified, +2/-1)
```diff
@@ -10,7 +10,7 @@
 import cv2
 import pyshine as ps
 
-from metagpt.config2 import config
+from metagpt.config2 import Config
 from metagpt.ext.android_assistant.utils.schema import (
     ActionOp,
     AndroidElement,
@@ -48,6 +48,7 @@ def get_id_from_element(elem: Element) -> str:
 
 def traverse_xml_tree(xml_path: Path, elem_list: list[AndroidElement], attrib: str, add_index=False):
     path = []
+    config = Config.default()
     extra_config = config.extra
     for event, elem in iterparse(str(xml_path), ["start", "end"]):
         if event == "start":
```

---

### Incident Patch 15: `77703f12` (2025-02-26)
**Commit Message**: fix conflicts

**File**: `.coveragerc` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+[run]
+source = 
+    ./metagpt/
+omit = 
+    */metagpt/ext/*
+    */metagpt/environment/android_env/*
+    */metagpt/environment/werewolf_env/*
+    
\ No newline at end of file
```

**File**: `.devcontainer/devcontainer.json` (modified, +2/-2)
```diff
@@ -3,7 +3,7 @@
 {
 	"name": "Python 3",
 	// Or use a Dockerfile or Docker Compose file. More info: https://containers.dev/guide/dockerfile
-	"image": "mcr.microsoft.com/devcontainers/python:0-3.11",
+	"image": "metagpt/metagpt:latest",
 
 	// Features to add to the dev container. More info: https://containers.dev/features.
 	// "features": {},
@@ -18,7 +18,7 @@
 			]
 		}
 	},
-	
+
 	// Use 'postCreateCommand' to run commands after the container is created.
 	"postCreateCommand": "./.devcontainer/postCreateCommand.sh"
 
```

**File**: `.gitattributes` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
 *.ico binary
 *.jpeg binary
 *.mp3 binary
+*.mp4 binary
 *.zip binary
 *.bin binary
 
```

**File**: `.github/workflows/fulltest.yaml` (modified, +9/-6)
```diff
@@ -30,7 +30,10 @@ jobs:
         cache: 'pip'
     - name: Install dependencies
       run: |
-        sh tests/scripts/run_install_deps.sh
+        python -m pip install --upgrade pip
+        pip install -e .[test]
+        npm install -g @mermaid-js/mermaid-cli
+        playwright install --with-deps
     - name: Run reverse proxy script for ssh service
       if: contains(github.ref, '-debugger')
       continue-on-error: true
@@ -76,8 +79,8 @@ jobs:
           ./tests/data/rsp_cache_new.json
         retention-days: 3
       if: ${{ always() }}
-    - name: Upload coverage reports to Codecov
-      uses: codecov/codecov-action@v3
-      env:
-        CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
-      if: ${{ always() }}
+    # - name: Upload coverage reports to Codecov
+    #   uses: codecov/codecov-action@v3
+    #   env:
+    #     CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
+    #   if: ${{ always() }}
```

**File**: `.github/workflows/pre-commit.yaml` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ on:
 jobs:
   pre-commit-check:
     runs-on: ubuntu-latest
+    environment: pre-commit
     steps:
     - name: Checkout Source Code
       uses: actions/checkout@v2
```

**File**: `.github/workflows/stale.yaml` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+name: Close inactive issues
+on:
+  schedule:
+    - cron: "5 0 * * *"
+
+jobs:
+  close-issues:
+    runs-on: ubuntu-latest
+    permissions:
+      issues: write
+      pull-requests: write
+    steps:
+      - uses: actions/stale@v5
+        with:
+          days-before-issue-stale: 30
+          days-before-issue-close: 14
+          stale-issue-label: "inactive"
+          stale-issue-message: "This issue has no activity in the past 30 days. Please comment on the issue if you have anything to add."
+          close-issue-message: "This issue was closed due to 45 days of inactivity. If you feel this issue is still relevant, please reopen the issue to continue the discussion."
+          days-before-pr-stale: -1
+          days-before-pr-close: -1
+          repo-token: ${{ secrets.GITHUB_TOKEN }}
```

**File**: `.github/workflows/unittest.yaml` (modified, +7/-9)
```diff
@@ -27,20 +27,23 @@ jobs:
         cache: 'pip'
     - name: Install dependencies
       run: |
-        sh tests/scripts/run_install_deps.sh
+        python -m pip install --upgrade pip
+        pip install -e .[test]
+        npm install -g @mermaid-js/mermaid-cli
+        playwright install --with-deps
     - name: Test with pytest
       run: |
         export ALLOW_OPENAI_API_CALL=0
         mkdir -p ~/.metagpt && cp tests/config2.yaml ~/.metagpt/config2.yaml
-        pytest tests/ --doctest-modules --cov=./metagpt/ --cov-report=xml:cov.xml --cov-report=html:htmlcov --durations=20 | tee unittest.txt
+        pytest | tee unittest.txt
     - name: Show coverage report
       run: |
         coverage report -m
     - name: Show failed tests and overall summary
       run: |
         grep -E "FAILED tests|ERROR tests|[0-9]+ passed," unittest.txt
-        failed_count=$(grep -E "FAILED|ERROR" unittest.txt | wc -l)
-        if [[ "$failed_count" -gt 0 ]]; then
+        failed_count=$(grep -E "FAILED tests|ERROR tests" unittest.txt | wc -l | tr -d '[:space:]')
+        if [[ $failed_count -gt 0 ]]; then
           echo "$failed_count failed lines found! Task failed."
           exit 1
         fi
@@ -54,8 +57,3 @@ jobs:
           ./tests/data/rsp_cache_new.json
         retention-days: 3
       if: ${{ always() }}
-    - name: Upload coverage reports to Codecov
-      uses: codecov/codecov-action@v3
-      env:
-        CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
-      if: ${{ always() }}
```

**File**: `.gitignore` (modified, +7/-0)
```diff
@@ -178,6 +178,7 @@ tmp.png
 .dependencies.json
 tests/metagpt/utils/file_repo_git
 tests/data/rsp_cache_new.json
+tests/data/serdeser_storage/
 *.tmp
 *.png
 htmlcov
@@ -191,3 +192,9 @@ cov.xml
 *.dot
 .python-version
 tests/data/requirements/*.jpg
+*.csv
+metagpt/ext/sela/results/*
+.chainlit/
+
+metagpt/ext/aflow/data
+metagpt/ext/aflow/scripts/optimized
```

#### Recent Merged Pull Requests:
- **PR #2146** (closed): talha added main file (@mallick-talha)
- **PR #2139** (closed): Add Build Remote Agent phone pairing (gbr/1) (@LinespottingPrivate)
- **PR #2132** (closed): docs: fix grammar issues in README.md (@MarkHe1222)
- **PR #2125** (closed): docs: note OpenAI client base_url for multi-model gateways (@seven7763)
- **PR #2124** (closed): docs: note OpenAI client base_url for multi-model gateways (@seven7763)
- **PR #2122** (closed): docs: fix --code_review flag typo in usage tutorials (--code_review -> --code-review) (@latent-9)
- **PR #2111** (closed): fix(terminal): yield single-line buffers so end marker is observed (@Solaris-star)
- **PR #2103** (closed): Integrate barewire for AI safety & performance (@sh8kme)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
