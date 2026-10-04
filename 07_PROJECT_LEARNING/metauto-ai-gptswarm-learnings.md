# Forensic Learning Record (Deep Inspection): metauto-ai/GPTSwarm

> **Canonical Artifact**: `07_PROJECT_LEARNING/metauto-ai-gptswarm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/metauto-ai/GPTSwarm](https://github.com/metauto-ai/GPTSwarm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:41:24.970Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `metauto-ai/GPTSwarm`
- **Description**: 🐝  The First Self-Improving agents with RL / Prompting Optimization
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1051 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `datasets/gaia/utils/data_split.py`
```
import json

input_file = '2023_validation_metadata.jsonl'
output_files = {
    1: 'level_1_val.jsonl',
    2: 'level_2_val.jsonl',
    3: 'level_3_val.jsonl'
}

data_by_level = {1: [], 2: [], 3: []}

with open(input_file, 'r') as file:
    for line in file:
        data = json.loads(line)
        level = data.get("Level")
        if level in data_by_level:
            data_by_level[level].append(data)

for level, data_list in data_by_level.items():
    with open(output_files[level], 'w') as file:
        for data in data_list:
            json.dump(data, file)
            file.write('\n')

```

### Core Architecture Module: `datasets/gaia/utils/prefix_clean.py`
```
import os

prefix = "2023_validation_"

files_and_dirs = os.listdir('.')

for name in files_and_dirs:
    if os.path.isfile(name) and name.startswith(prefix):
        new_name = name[len(prefix):]
        
        os.rename(name, new_name)
        print(f"Renamed '{name}' to '{new_name}'")

```

### Core Architecture Module: `swarm/environment/domain/gaia/evaluation/scorer.py`
```
import json
import re
import string
import warnings

import numpy as np


def normalize_number_str(number_str: str) -> float:
    # we replace these common units and commas to allow
    # conversion to float
    for char in ["$", "%", ","]:
        number_str = number_str.replace(char, "")
    try:
        return float(number_str)
    except ValueError:
        print(f"String {number_str} cannot be normalized to number str.")
        return float("inf")


def split_string(
    s: str,
    char_list: list[str] = [",", ";"],
) -> list[str]:
    pattern = f"[{''.join(char_list)}]"
    return re.split(pattern, s)


def question_scorer(
    model_answer: str,
    ground_truth: str,
) -> bool:
    def is_float(element: any) -> bool:
        try:
            float(element)
            return True
        except ValueError:
            return False

    # if gt is a number
    if is_float(ground_truth):
        #print(f"Evaluating {model_answer} as a number.")
        normalized_answer = normalize_number_str(model_answer)
        return normalized_answer == float(ground_truth)

    # if gt is a list
    elif any(char in ground_truth for char in [",", ";"]):
        #print(f"Evaluating {model_answer} as a comma separated list.")
        # question with the fish: normalization removes punct

        gt_elems = split_string(ground_truth)
        ma_elems = split_string(model_answer)

        # check length is the same
        if len(gt_elems) != len(ma_elems):
            warnings.warn(
                "Answer lists have different lengths, returning False.", UserWarning
            )
            return False

        # compare each element as float or str
        comparisons = []
        for ma_elem, gt_elem in zip(ma_elems, gt_elems):
            if is_float(gt_elem):
                normalized_ma_elem = normalize_number_str(ma_elem)
                comparisons.append(normalized_ma_elem == float(gt_elem))
            else:
                # we do not remove punct since comparisons can include punct
                comparisons.append(
                    normalize_str(ma_elem, remove_punct=False)
                    == normalize_str(gt_elem, remove_punct=False)
                )
        return all(comparisons)

    # if gt is a str
    else:
        #print(f"Evaluating {model_answer} as a string.")
        return normalize_str(model_answer) == normalize_str(ground_truth)


def normalize_str(input_str, remove_punct=True) -> str:
    """
    Normalize a string by:
    - Removing all white spaces
    - Optionally removing punctuation (if remove_punct is True)
    - Converting to lowercase
    Parameters:
    - input_str: str, the string to normalize
    - remove_punct: bool, whether to remove punctuation (default: True)
    Returns:
    - str, the normalized string
    """
    # Remove all white spaces. Required e.g for seagull vs. sea gull
    no_spaces = re.sub(r"\s", "", input_str)

    # Remove punctuation, if specified.
    if remove_punct:
        translator = str.maketrans("", "", string.punctuation)
        return no_spaces.lower().translate(translator)
    else:
        return no_spaces.lower()

```

### Core Architecture Module: `swarm/environment/tools/coding/executor_utils.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import json
from threading import Thread

def timeout_handler(_, __):
    raise TimeoutError()


def to_jsonl(dict_data, file_path):
    with open(file_path, 'a') as file:
        json_line = json.dumps(dict_data)
        file.write(json_line + os.linesep)


class PropagatingThread(Thread):
    def run(self):
        self.exc = None
        try:
            if hasattr(self, '_Thread__target'):
                # Thread uses name mangling prior to Python 3.
                self.ret = self._Thread__target(*self._Thread__args, **self._Thread__kwargs)
            else:
                self.ret = self._target(*self._args, **self._kwargs)
        except BaseException as e:
            self.exc = e

    def join(self, timeout=None):
        super(PropagatingThread, self).join(timeout)
        if self.exc:
            raise self.exc
        return self.ret
    

def function_with_timeout(func, args, timeout):
    result_container = []

    def wrapper():
        result_container.append(func(*args))

    thread = PropagatingThread(target=wrapper)
    thread.start()
    thread.join(timeout)

    if thread.is_alive():
        raise TimeoutError()
    else:
        return result_container[0]
    


```

### Core Architecture Module: `swarm/utils/common.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

import json
import openai
import jsonlines
import re
import regex
import func_timeout
from typing import Union
import random

from typing import List
from swarm.utils.const import GPTSWARM_ROOT

def load_agents_info(candidates_path: str, agent_num: int):
    """
    Load agents' information from a given file path.

    :param society_path: Path to the society file.
    :param agent_num: Number of agents to be loaded.
    :return: Tuple of names and profiles.
    """
    print(candidates_path)
    with open(candidates_path, "r", encoding="utf-8") as file:
        data = json.load(file)["agents"]
        names = [agent['name'] for agent in data[:agent_num]]
        profiles = [agent['profile'] for agent in data[:agent_num]]
        strategies = [agent['strategy'] for agent in data[:agent_num]]

        return names, profiles, strategies

```

### Core Architecture Module: `swarm/utils/const.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
from pathlib import Path


GPTSWARM_ROOT = Path(os.path.realpath(os.path.join(os.path.split(__file__)[0], "../..")))

```

### Core Architecture Module: `swarm/utils/globals.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
from typing import Optional

class Singleton:
    _instance = None

    @classmethod
    def instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def reset(self):
        self.value = 0.0

class Cost(Singleton):
    def __init__(self):
        self.value = 0.0

class PromptTokens(Singleton):
    def __init__(self):
        self.value = 0.0

class CompletionTokens(Singleton):
    def __init__(self):
        self.value = 0.0

class Time(Singleton):
    def __init__(self):
        self.value = ""

class Mode(Singleton):
    def __init__(self):
        self.value = ""

```

### Core Architecture Module: `swarm/utils/log.py`
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
from pathlib import Path
from loguru import logger
# from globals import CompletionTokens, PromptTokens, Cost
from swarm.utils.const import GPTSWARM_ROOT

def configure_logging(print_level: str = "INFO", logfile_level: str = "DEBUG") -> None:
    """
    Configure the logging settings for the application.

    Args:
        print_level (str): The logging level for console output.
        logfile_level (str): The logging level for file output.
    """
    logger.remove()
    logger.add(sys.stderr, level=print_level)
    logger.add(GPTSWARM_ROOT / 'logs/log.txt', level=logfile_level, rotation="10 MB")

def initialize_log_file(experiment_name: str, time_stamp: str) -> Path:
    """
    Initialize the log file with a start message and return its path.

    Args:
        mode (str): The mode of operation, used in the file path.
        time_stamp (str): The current timestamp, used in the file path.

    Returns:
        Path: The path to the initialized log file.
    """
    try:
        log_file_path = GPTSWARM_ROOT / f'result/{experiment_name}/logs/log_{time_stamp}.txt'
        os.makedirs(log_file_path.parent, exist_ok=True)
        with open(log_file_path, 'w') as file:
            file.write("============ Start ============\n")
    except OSError as error:
        logger.error(f"Error initializing log file: {error}")
        raise
    return log_file_path

def swarmlog(sender: str, text: str, cost: float,  prompt_tokens: int, complete_tokens: int, log_file_path: str) -> None:
    """
    Custom log function for swarm operations. Includes dynamic global variables.

    Args:
        sender (str): The name of the sender.
        text (str): The text message to log.
        cost (float): The cost associated with the operation.
        result_file (Path, optional): Path to the result file. Default is None.
        solution (list, optional): Solution data to be logged. Default is an empty list.
    """
    # Directly reference global variables for dynamic values
    formatted_message = (
        f"{sender} | 💵Total Cost: ${cost:.5f} | "
        f"Prompt Tokens: {prompt_tokens} | "
        f"Completion Tokens: {complete_tokens} | \n {text}"
    )
    logger.info(formatted_message)

    try:
        os.makedirs(log_file_path.parent, exist_ok=True)
        with open(log_file_path, 'a') as file:
            file.write(f"{formatted_message}\n")
    except OSError as error:
        logger.error(f"Error initializing log file: {error}")
        raise


def main():
    configure_logging()
    # Example usage of swarmlog with dynamic values
    swarmlog("SenderName", "This is a test message.", 0.123)

if __name__ == "__main__":
    main()


```

### Core Architecture Module: `datasets/MMLU/download.py`
```
import os
import requests
import tarfile


def download():

    this_file_path = os.path.split(__file__)[0]
    tar_path = os.path.join(this_file_path, "data.tar")
    if not os.path.exists(tar_path):
        url = "https://people.eecs.berkeley.edu/~hendrycks/data.tar"
        print(f"Downloading {url}")
        r = requests.get(url, allow_redirects=True)
        with open(tar_path, 'wb') as f:
            f.write(r.content)
        print(f"Saved to {tar_path}")

    data_path = os.path.join(this_file_path, "data")
    if not os.path.exists(data_path):
        tar = tarfile.open(tar_path)
        tar.extractall(this_file_path)
        tar.close()
        print(f"Saved to {data_path}")


if __name__ == "__main__":
    download()

```

### Core Architecture Module: `datasets/gaia/format.py`
```
import json

input_file = 'level_1_val.jsonl'
output_file = 'level_1_val.json'

data = []

with open(input_file, 'r') as file:
    for line in file:
        json_obj = json.loads(line)
        data.append(json_obj)

with open(output_file, 'w') as file:
    json.dump(data, file, indent=4)

```

### Core Architecture Module: `experiments/crosswords/evaluate.py`
```
import json
from tqdm import tqdm
import asyncio
import numpy as np
from copy import deepcopy
import pickle
import torch
import sys
import random

from swarm.environment.domain.crosswords.env import MiniCrosswordsEnv
from swarm.environment.agents.agent_registry import AgentRegistry
from swarm.graph.swarm import Swarm
from swarm.optimizer.edge_optimizer.optimization import optimize
from swarm.environment.domain.crosswords.evaluator import CrosswordsEvaluator


def batched_evaluator(evaluator, batch_size, graph, loop):
    tasks = []
    for _ in range(batch_size):
        tasks.append(evaluator.evaluate(deepcopy(graph)))
    return loop.run_until_complete(asyncio.gather(*tasks))

if __name__ == "__main__":
    file_path = "datasets/crosswords/mini0505_0_100_5.json"
    with open(file_path, "r") as file:
        test_data = json.load(file)

    experiment_id = "experiment1"
    init_connection_probability = .1
    epochs = 1
    batch_size = 4
    use_learned_order = True
    num_batches = int(len(test_data) / batch_size)
    evaluator = CrosswordsEvaluator(test_data, batch_size=batch_size, metric="words", window_size=num_batches)
    swarm = Swarm(["CrosswordsReflection", "CrosswordsToT"], "crosswords", "gpt-4-1106-preview", #"gpt-3.5-turbo-1106",
                final_node_class="ReturnAll", final_node_kwargs={}, edge_optimize=True,
                init_connection_probability=init_connection_probability, connect_output_nodes_to_final_node=True)
    swarm.connection_dist.load_state_dict(torch.load(f"result/crosswords_Jan15/{experiment_id}_edge_logits_{int(epochs * len(test_data) / batch_size) - 1}.pkl"))

    num_edges = []
    for _ in range(100):
        graph = swarm.connection_dist.realize(swarm.composite_graph, use_learned_order=use_learned_order)[0]
        num_edges.append(graph.num_edges)
    num_edges = int(np.array(num_edges).mean())
    print(f"Expected number of edges: {num_edges}")

    graphs = [
                swarm.connection_dist.random_sample_num_edges(swarm.composite_graph, num_edges),
                swarm.connection_dist.realize(swarm.composite_graph, threshold=init_connection_probability, use_learned_order=use_learned_order)[0],
                swarm.connection_dist.realize(swarm.composite_graph, use_learned_order=use_learned_order)[0],
                swarm.composite_graph,
                ]
    loop = asyncio.get_event_loop()
    for i, graph in tqdm(enumerate(graphs)):
        print(f"{graph.num_edges} edges")
        utilities = []
        evaluator.reset()
        for k in range(num_batches):
            utilities += batched_evaluator(evaluator, batch_size, graph, loop)
        print(f"avg. utility = {np.mean(utilities):.3f}")
        with open(f"result/crosswords/{experiment_id}_final_utilities_{i}.pkl", "wb") as file:
            pickle.dump(utilities, file)

```

### Core Architecture Module: `experiments/crosswords/train.py`
```
import json
from tqdm import tqdm
import asyncio
import numpy as np
from copy import deepcopy
import pickle
import torch
import sys
import random

from swarm.environment.domain.crosswords.env import MiniCrosswordsEnv
from swarm.environment.agents.agent_registry import AgentRegistry
from swarm.graph.swarm import Swarm
from swarm.optimizer.edge_optimizer.optimization import optimize
from swarm.environment.domain.crosswords.evaluator import CrosswordsEvaluator


if __name__ == "__main__":
    if len(sys.argv) == 2:
        id = int(sys.argv[1])
        experiment_id = f"experiment{id}"
        torch.manual_seed(id)
        np.random.seed(id)
        random.seed(id)
    else:
        experiment_id = "experiment"

    file_path = "datasets/crosswords/mini0505_0_100_5.json"
    with open(file_path, "r") as file:
        test_data = json.load(file)

    init_connection_probability = .1
    epochs = 2
    batch_size = 4
    use_learned_order = True
    include_inner_agent_connections = True
    window_size = int(len(test_data) / batch_size)
    evaluator = CrosswordsEvaluator(test_data, batch_size=batch_size, metric="words", window_size=window_size)
    swarm = Swarm(["CrosswordsReflection", "CrosswordsToT"], "crosswords", "gpt-4-1106-preview", #"gpt-3.5-turbo-1106",
                final_node_class="TakeBest", final_node_kwargs={}, edge_optimize=True,
                init_connection_probability=init_connection_probability, connect_output_nodes_to_final_node=True, 
                include_inner_agent_connections=include_inner_agent_connections)
    optimize(swarm, evaluator, batch_size=batch_size, num_iter=int(epochs * len(test_data) / batch_size), display_freq=1, record=True,
              experiment_id=experiment_id, lr=.25, use_learned_order=use_learned_order)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #34** (2026-02-05): **add bocha web search tool**
  *Symptoms*: ## Summary  This PR introduces Bocha Search as a new external search tool, enabling the system to retrieve real-time, web-based information beyond the existing data sources.  ## Key Changes  Added Bocha Search tool integration with a unified tool interface  No breaking changes to current search or retrieval logic

- **Issue #33** (2025-09-09): **Seach Engine Update**
  *Symptoms*: Hey🍻   Since [Bing Search API has been discontinued](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement), I suggest changes to the code that:  * remove BingSearchEngine * add free web search option DuckDuckGO  cheers with respect 
  **Post-Mortem & Fix Analysis**:
  > > I think these changes are good to me. Should we re-open it and merge?  I'd be happy to contribute but I a little bit later, if you don't mind

- **Issue #29** (2025-01-03): **Added Bing APIs and docs links**
  *Symptoms*: This pull request introduces support for Bing Web Search and improves the web search functionality by adding a dynamic search engine selection based on available API keys. The most important changes include modifying the environment file, updating the README, adding the Bing search engine, and adjusting the web search operation to use the appropriate search engine.  ### Added Bing Web Search Support:  * [`.env.template`](diffhunk://#diff-749e06f64632f62a0c0dfbf4c4f3850e27e94ac109aa121fabd5c29469ae88deR5): Added `BING_API_KEY` to the environment template file. * [`README.md`](diffhunk://#diff-b335630551682c19a781afebcf4d07bf978fb1f8ac04c6bf87428ed5106870f5L99-R111): Updated to include `BING_API_KEY` and added a section on selecting the search engine based on the provided API keys. * [`swarm/environment/tools/search/search.py`](diffhunk://#diff-8fe1ef5df09a4268f5d1ebe8728c2a0372db16420574e02e9cd731bdcb4b3cedL5-L14): Added `BingSearchEngine` class to handle Bing search operations and updated error messages for existing search engines. [[1]](diffhunk://#diff-8fe1ef5df09a4268f5d1ebe8728c2a0372db16420574e02e9cd731bdcb4b3cedL5-L14) [[2]](diffhunk://#diff-8fe1ef5df09a4268f5d1ebe8728c2a0372db16420574e02e9cd731bdcb4b3cedL24-R35) [[3]](diffhunk://#diff-8fe1ef5df09a4268f5d1ebe8728c2a0372db16420574e02e9cd731bdcb4b3cedL48-R58)  ### Dynamic Search Engine Selection:  * [`swarm/environment/__init__.py`](diffhunk://#diff-29ceb218e3f8cd15251bd50c84f73a969a4473fa3bc18dc9c253705d7621bc6
  **Post-Mortem & Fix Analysis**:
  > Thank you @sandrohanea  We have added you in the contributors list in README.md

- **Issue #27** (2025-01-03): **Restrict numpy version to 1.x since 2.0 crashes**
  *Symptoms*: 

- **Issue #22** (2024-03-27): **Cost Calculation**
  *Symptoms*: This update turns back the easy implementation for calculating the token, cost, etc.  USAGES (Common):  ``` from swarm.utils.globals import Time, Cost, CompletionTokens, PromptTokens  current_cost = Cost.instance().value  current_prompt_tokens =  PromptTokens.instance().value current_completion_tokens = CompletionTokens.instance().value  # Reset them when needed Cost.instance().reset()     PromptTokens.instance().reset()  CompletionTokens.instance().reset()  ```     Demo (please refer to GAIA):  ``` from swarm.utils.globals import Time, Cost, CompletionTokens, PromptTokens from swarm.utils.log import initialize_log_file, logger, swarmlog  current_time = Time.instance().value or time.strftime("%Y-%m-%d-%H-%M-%S", time.localtime()) Time.instance().value = current_time log_file_path = initialize_log_file("GAIA", Time.instance().value)  swarmlog("🐝GPTSWARM SYS", f"Finish {i} samples...", Cost.instance().value, PromptTokens.instance().value, CompletionTokens.instance().value, log_file_path) ``` 
  **Post-Mortem & Fix Analysis**:
  > > Can I have cost_get() function? That returns a dictionary that I can save to my experiment artifacts. Also what if I want to measure training cost separately and evaluation cons separately in one go?  Here is where `cost_count()` has been used: https://github.com/metauto-ai/GPTSwarm/blob/main/swarm/llm/gpt_chat.py  Here is how `cost_count()` was designed: https://github.com/metauto-ai/GPTSwarm/blob/main/swarm/llm/price.py

- **Issue #20** (2024-03-15): **Update evaluate.py**
  *Symptoms*: Changed the final_node_class to ReturnAll because there is no "TakeBest" - I am Lukas from WeChat.

- **Issue #19** (2024-03-14): **Small prompt spelling nit**
  *Symptoms*: Great paper :)
  **Post-Mortem & Fix Analysis**:
  > Thank you very much for your careful review! @hinthornw 

- **Issue #17** (2024-03-04): **Coverage for main. Documentation for poetry.**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > I have added a new line in README.md

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

### Incident Patch 1: `4eaca1a3` (2025-01-03)
**Commit Message**: Restrict numpy version to 1.x since 2.0 crashes. (#27)

**File**: `pyproject.toml` (modified, +2/-1)
```diff
@@ -62,8 +62,9 @@ tqdm = "^4.66.1"
 transformers = "^4.36.2"
 wikipedia = "^1.4.0"
 astunparse = "^1.6.3"
-torch = "^2.1.0"
+torch = ">=2.1.0, <=2.2.2"
 async-timeout = "^4.0.3"
+numpy = "^1.25.2"
 
 [tool.poetry.group.dev.dependencies]
 pytest = "^8.0.2"
```

---

### Incident Patch 2: `c8a99701` (2024-03-03)
**Commit Message**: Fix links to the new repo (#10)

**File**: `README.md` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [![Page](https://img.shields.io/badge/Project-Page-lightgreen.svg)](https://gptswarm.org)
 [![arXiv](https://img.shields.io/badge/arXiv-Paper-gold.svg)](https://arxiv.org/abs/2402.16823)
-[![License](https://img.shields.io/badge/License-MIT-orange.svg)](https://github.com/mczhuge/GPTSwarm/blob/main/LICENSE)
+[![License](https://img.shields.io/badge/License-MIT-orange.svg)](https://github.com/metauto-ai/GPTSwarm/blob/main/LICENSE)
 [![Issues](https://img.shields.io/github/issues/metauto-ai/GPTSwarm?color=00afaa)](https://github.com/metauto-ai/gptswarm/issues)
 [![Twitter Follow](https://img.shields.io/twitter/follow/AI_KAUST?style=social)](https://twitter.com/AI_KAUST)
 [![Wechat](https://img.shields.io/badge/Wechat-7BB32E?logo=wechat&logoColor=white)](https://metauto.ai/images/wechat.jpeg)
@@ -85,16 +85,16 @@ inputs = {"task": task, "files": files}
 danswer = swarm.run(inputs)
 ```
 
-Check out the minimal Swarm example in Colab here: [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mczhuge/GPTSwarm/blob/main/notebooks/demo_swarm.ipynb).
+Check out the minimal Swarm example in Colab here: [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/metauto-ai/GPTSwarm/blob/main/notebooks/demo_swarm.ipynb).
 
-See how to create a custom Agent and run a Swarm with it here: [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mczhuge/GPTSwarm/blob/main/notebooks/demo_custom_agent.ipynb).
+See how to create a custom Agent and run a Swarm with it here: [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/metauto-ai/GPTSwarm/blob/main/notebooks/demo_custom_agent.ipynb).
 
 Here is a Youtube video on how to run the demo notebooks:
 
 [<img src="assets/youtube_preview.png" width="75%">](https://www.youtube.com/watch?v=QOLQse5ZBV8&t=8s&ab_channel=GPTSwarm "Running swarm inference")
 
 
-**🛠 See [our experiments](https://github.com/mczhuge/GPTSwarm/tree/main/experiments) for more advanced use of our framework.**
+**🛠 See [our experiments](https://github.com/metauto-ai/GPTSwarm/tree/main/experiments) for more advanced use of our framework.**
 
 ## Class diagram
 
```

**File**: `experiments/README.md` (modified, +0/-24)
```diff
@@ -1,29 +1,5 @@
 ## Run the following commands to reproduce our experiments in the paper
 
-### Download dataset
-
-The datasets are stored in git LFS. If git LFS is already installed in your system, no action is required. To check if git LFS is installed, run:
-```bash
-git lfs
-```
-If you see an error message, install git LFS via this instruction](https://docs.github.com/en/repositories/working-with-files/managing-large-files/installing-git-large-file-storage). Then run:
-```bash
-git lfs install
-git lfs pull
-```
-
-### Include necessary submodules
-
-If the project has already been cloned:
-```bash
-git submodule init
-git submodule update
-```
-or a one-liner:
-```bash
-git submodule update --init --recursive
-```
-
 ### **MMLU**
 Run the baseline:
 ```bash
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -26,8 +26,8 @@ dependencies = {file = ["requirements_py310_macos.txt"]}
 dev = ["black", "bumpver", "isort", "pip-tools", "pytest"]
 
 [project.urls]
-Homepage = "https://github.com/mczhuge/GPTSwarm"
-Issues = "https://github.com/mczhuge/GPTSwarm/issues"
+Homepage = "https://github.com/metauto-ai/GPTSwarm"
+Issues = "https://github.com/metauto-ai/GPTSwarm/issues"
 
 [build-system]
 requires = ["setuptools>=61.0.0", "wheel"]
```

**File**: `swarm/environment/agents/gaia/normal_io.py` (modified, +0/-5)
```diff
@@ -1,10 +1,5 @@
 #!/usr/bin/env python
 # -*- coding: utf-8 -*-
-"""
-Author  : wenyi
-Review  :
-File    : node.py
-"""
 
 from swarm.graph import Graph
 from swarm.environment.operations import DirectAnswer
```

**File**: `swarm/environment/tools/coding/README.md` (modified, +1/-1)
```diff
@@ -1 +1 @@
-[executor_types.py](https://github.com/mczhuge/GPTSwarm/blob/main/swarm/environment/tools/coding/executor_types.py), [executor_utils.py](https://github.com/mczhuge/GPTSwarm/blob/main/swarm/environment/tools/coding/executor_utils.py) and [python_executor.py](https://github.com/mczhuge/GPTSwarm/blob/main/swarm/environment/tools/coding/python_executor.py) under this directory are directly adopted from the [Reflexion project](https://github.com/noahshinn/reflexion/tree/main/programming_runs/executors).
+[executor_types.py](https://github.com/metauto-ai/GPTSwarm/blob/main/swarm/environment/tools/coding/executor_types.py), [executor_utils.py](https://github.com/metauto-ai/GPTSwarm/blob/main/swarm/environment/tools/coding/executor_utils.py) and [python_executor.py](https://github.com/metauto-ai/GPTSwarm/blob/main/swarm/environment/tools/coding/python_executor.py) under this directory are directly adopted from the [Reflexion project](https://github.com/noahshinn/reflexion/tree/main/programming_runs/executors).
```

**File**: `swarm/llm/price.py` (modified, +0/-5)
```diff
@@ -1,10 +1,5 @@
 #!/usr/bin/env python
 # -*- coding: utf-8 -*-
-"""
-Author: mczhuge
-Review  :
-File: price.py
-"""
 
 from swarm.utils.log import swarmlog
 from swarm.utils.globals import Cost
```

---

### Incident Patch 3: `3bdf1a43` (2024-02-28)
**Commit Message**: Merge pull request #7 from metauto-ai/fix_test_run

a quick fix

**File**: `swarm/environment/prompt/common.py` (modified, +4/-0)
```diff
@@ -8,6 +8,10 @@ def get_combine_materials(materials: Dict[str, Any], avoid_vague=True) -> str:
     for key, value in materials.items():
         if "No useful information from WebSearch" in value:
             continue
+        if isinstance(value, list):
+            value = "\n".join(value)
+        if not (isinstance(value, str) and isinstance(key, str)):
+            continue
         value = value.strip("\n").strip()
         if key != 'task' and value:
             question += f"\n\nReference information for {key}:" + \
```

---

### Incident Patch 4: `9035451b` (2024-02-28)
**Commit Message**: Fix

**File**: `README.md` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ Watch the following for an example of how to run the notebooks.
 
 <!-- https://github.com/mczhuge/GPTSwarm/assets/100462607/a05f78b7-5f9d-4762-8337-973702ce4493 -->
 
-[<img src="assets/youtube_preview.png" width="50%">]([https://www.youtube.com/watch?v=Hc79sDi3f0U](https://www.youtube.com/watch?v=QOLQse5ZBV8&t=8s&ab_channel=GPTSwarm) "Running swarm inference")
+[<img src="assets/youtube_preview.png" width="50%">](https://www.youtube.com/watch?v=QOLQse5ZBV8&t=8s&ab_channel=GPTSwarm "Running swarm inference")
 
 
 **🛠 See [our experiments](https://github.com/mczhuge/GPTSwarm/tree/main/experiments) for more advanced use of our framework.**
```

---

### Incident Patch 5: `353dc37a` (2024-02-28)
**Commit Message**: a quick fix

**File**: `swarm/environment/prompt/common.py` (modified, +4/-0)
```diff
@@ -8,6 +8,10 @@ def get_combine_materials(materials: Dict[str, Any], avoid_vague=True) -> str:
     for key, value in materials.items():
         if "No useful information from WebSearch" in value:
             continue
+        if isinstance(value, list):
+            value = "\n".join(value)
+        if not (isinstance(value, str) and isinstance(key, str)):
+            continue
         value = value.strip("\n").strip()
         if key != 'task' and value:
             question += f"\n\nReference information for {key}:" + \
```

---

### Incident Patch 6: `fbfe645a` (2024-02-28)
**Commit Message**: fix the typos of README.md

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [![Page](https://img.shields.io/badge/Project-Page-lightgreen.svg)](https://gptswarm.org)
 [![arXiv](https://img.shields.io/badge/arXiv-Paper-gold.svg)](https://arxiv.org/abs/2402.16823)
 [![License](https://img.shields.io/badge/License-MIT-orange.svg)](https://github.com/mczhuge/GPTSwarm/blob/main/LICENSE)
-[![Issues](https://img.shields.io/github/issues/metauto-aiGPTSwarm?color=00afaa)](https://github.com/metauto-ai/gptswarm/issues)
+[![Issues](https://img.shields.io/github/issues/metauto-ai/GPTSwarm?color=00afaa)](https://github.com/metauto-ai/gptswarm/issues)
 [![Twitter Follow](https://img.shields.io/twitter/follow/AI_KAUST?style=social)](https://twitter.com/AI_KAUST)
 [![Wechat](https://img.shields.io/badge/Wechat-7BB32E?logo=wechat&logoColor=white)](https://metauto.ai/images/wechat.jpeg)
 
```

---

### Incident Patch 7: `b8c78c46` (2024-02-28)
**Commit Message**: fix the typos on README.md

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [![Page](https://img.shields.io/badge/Project-Page-lightgreen.svg)](https://gptswarm.org)
 [![arXiv](https://img.shields.io/badge/arXiv-Paper-gold.svg)](https://arxiv.org/abs/2402.16823)
 [![License](https://img.shields.io/badge/License-MIT-orange.svg)](https://github.com/mczhuge/GPTSwarm/blob/main/LICENSE)
-[![Issues](https://img.shields.io/github/issues/mczhuge/Kaleido-BERT?color=00afaa)](https://github.com/metauto-ai/gptswarm/issues)
+[![Issues](https://img.shields.io/github/issues/metauto-aiGPTSwarm?color=00afaa)](https://github.com/metauto-ai/gptswarm/issues)
 [![Twitter Follow](https://img.shields.io/twitter/follow/AI_KAUST?style=social)](https://twitter.com/AI_KAUST)
 [![Wechat](https://img.shields.io/badge/Wechat-7BB32E?logo=wechat&logoColor=white)](https://metauto.ai/images/wechat.jpeg)
 
```

#### Recent Merged Pull Requests:
- **PR #34** (2026-02-05): add bocha web search tool (@weijintaocode)
- **PR #33** (closed): Seach Engine Update (@technocreep)
- **PR #29** (2025-01-03): Added Bing APIs and docs links (@sandrohanea)
- **PR #27** (2025-01-03): Restrict numpy version to 1.x since 2.0 crashes (@dmitrii-khizbullin)
- **PR #22** (2024-03-27): Cost Calculation (@mczhuge)
- **PR #20** (2024-03-15): Update evaluate.py (@lukasVierling)
- **PR #19** (2024-03-14): Small prompt spelling nit (@hinthornw)
- **PR #17** (2024-03-04): Coverage for main. Documentation for poetry. (@dmitrii-khizbullin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
