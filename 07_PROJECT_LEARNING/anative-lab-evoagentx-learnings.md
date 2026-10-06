# Forensic Learning Record (Deep Inspection): ANative-Lab/EvoAgentX

> **Canonical Artifact**: `07_PROJECT_LEARNING/anative-lab-evoagentx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ANative-Lab/EvoAgentX](https://github.com/ANative-Lab/EvoAgentX))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:15:38.573Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ANative-Lab/EvoAgentX`
- **Description**: 🚀 EvoAgentX: Building a Self-Evolving Ecosystem of AI Agents
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3362 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `evoagentx/benchmark/lcb_utils/code_execution.py`
```
# copied from: https://github.com/LiveCodeBench/LiveCodeBench/blob/main/lcb_runner/benchmarks/code_execution.py

from datetime import datetime
from dataclasses import dataclass

from datasets import load_dataset


@dataclass
class CodeExecutionProblem:
    question_id: str
    contest_id: str
    contest_date: datetime
    difficulty: str
    function_name: str
    code: str
    input: str
    output: str
    id: str
    problem_id: str
    numsteps: int

    def __post_init__(self):
        pass

    def insert_output(self, output_list: list[str], pred_list: list[str]) -> dict:
        return {
            "question_id": self.question_id,
            "contest_id": self.contest_id,
            "contest_date": self.contest_date.isoformat(),
            "difficulty": self.difficulty,
            "function_name": self.function_name,
            "code": self.code,
            "input": self.input,
            "output": self.output,
            "id": self.id,
            "problem_id": self.problem_id,
            "numsteps": self.numsteps,
            "output_list": output_list,
            "pred_list": pred_list,
        }

    def insert_output_evaluation(
        self, output_list: list[str], code_list: list[str], graded_list: list[bool]
    ) -> dict:
        output = self.insert_output(output_list, code_list)
        output["graded_list"] = graded_list
        output["pass@1"] = graded_list.count(True) / len(graded_list)
        return output

    def get_evaluation_sample(self) -> dict:
        return {
            "code": self.code,
            "input": self.input,
            "output": self.output,
        }


def load_code_execution_dataset(release_version="release_v1", cache_dir: str = None) -> list[CodeExecutionProblem]:
    dataset = load_dataset("livecodebench/execution-v2", split="test", trust_remote_code=True, cache_dir=cache_dir)  # type: ignore
    dataset = [CodeExecutionProblem(**p) for p in dataset]  # type: ignore
    # print(f"Loaded {len(dataset)} problems")
    return dataset


if __name__ == "__main__":
    dataset = load_code_execution_dataset()

```

### Core Architecture Module: `evoagentx/benchmark/lcb_utils/code_generation.py`
```
# copied from: https://github.com/LiveCodeBench/LiveCodeBench/blob/main/lcb_runner/benchmarks/code_generation.py

import json
import zlib
import pickle
import base64
from enum import Enum
from datetime import datetime
from dataclasses import dataclass

from datasets import load_dataset


class Platform(Enum):
    LEETCODE = "leetcode"
    CODEFORCES = "codeforces"
    ATCODER = "atcoder"


class Difficulty(Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class TestType(Enum):
    STDIN = "stdin"
    FUNCTIONAL = "functional"


@dataclass
class Test:
    input: str
    output: str
    testtype: TestType

    def __post_init__(self):
        self.testtype = TestType(self.testtype)
        # if self.testtype == TestType.FUNCTIONAL:
        #     self.input = json.loads(self.input)
        #     self.output = json.loads(self.output)


@dataclass
class CodeGenerationProblem:
    question_title: str
    question_content: str
    platform: Platform
    question_id: str
    contest_id: str
    contest_date: datetime
    starter_code: str
    difficulty: Difficulty
    public_test_cases: list[Test]
    private_test_cases: list[Test]
    metadata: dict

    def __post_init__(self):
        self.platform = Platform(self.platform)
        self.difficulty = Difficulty(self.difficulty)
        self.contest_date = datetime.fromisoformat(self.contest_date)

        self.public_test_cases = json.loads(self.public_test_cases)  # type: ignore
        self.public_test_cases = [Test(**t) for t in self.public_test_cases]

        try:
            self.private_test_cases = json.loads(self.private_test_cases)  # type: ignore
        except Exception:
            self.private_test_cases = json.loads(
                pickle.loads(
                    zlib.decompress(
                        base64.b64decode(self.private_test_cases.encode("utf-8"))  # type: ignore
                    )
                )
            )  # type: ignore
        self.private_test_cases = [Test(**t) for t in self.private_test_cases]

        self.metadata = json.loads(self.metadata)  # type: ignore

    def insert_output(self, output_list: list[str], code_list: list[str]) -> dict:
        return {
            "question_title": self.question_title,
            "question_content": self.question_content,
            "platform": self.platform.value,
            "question_id": self.question_id,
            "contest_id": self.contest_id,
            "contest_date": self.contest_date.isoformat(),
            "starter_code": self.starter_code,
            "difficulty": self.difficulty.value,
            "output_list": output_list,
            "code_list": code_list,
        }

    def insert_output_evaluation(
        self,
        output_list: list[str],
        code_list: list[str],
        graded_list: list[bool],
        **kwargs,
    ) -> dict:
        output = self.insert_output(output_list, code_list)
        output["graded_list"] = graded_list
        output["pass@1"] = graded_list.count(True) / len(graded_list)
        for k, v in kwargs.items():
            output[k] = v
        return output

    def get_evaluation_sample(self):
        return {
            "input_output": json.dumps(
                {
                    "inputs": [
                        t.input
                        for t in self.public_test_cases + self.private_test_cases
                    ],
                    "outputs": [
                        t.output
                        for t in self.public_test_cases + self.private_test_cases
                    ],
                    "fn_name": self.metadata.get("func_name", None),
                }
            ),
        }


def load_code_generation_dataset(release_version="release_v1", cache_dir: str = None, start_date=None, end_date=None) -> list[CodeGenerationProblem]:
    dataset = load_dataset("livecodebench/code_generation_lite", split="test", version_tag=release_version, trust_remote_code=True, cache_dir=cache_dir)
    dataset = [CodeGenerationProblem(**p) for p in dataset]  # type: ignore
    if start_date is not None:
        p_start_date = datetime.strptime(start_date, "%Y-%m-%d")
        dataset = [e for e in dataset if p_start_date <= e.contest_date]

    if end_date is not None:
        p_end_date = datetime.strptime(end_date, "%Y-%m-%d")
        dataset = [e for e in dataset if e.contest_date <= p_end_date]
    
    # print(f"Loaded {len(dataset)} problems")
    return dataset


def load_code_generation_dataset_not_fast(release_version="release_v1") -> list[CodeGenerationProblem]:
    dataset = load_dataset("livecodebench/code_generation", split="test")
    dataset = [CodeGenerationProblem(**p) for p in dataset]  # type: ignore
    # print(f"Loaded {len(dataset)} problems")
    return dataset


if __name__ == "__main__":
    dataset = load_code_generation_dataset()
```

### Core Architecture Module: `evoagentx/benchmark/lcb_utils/evaluation.py`
```
# modified from: 
# https://github.com/LiveCodeBench/LiveCodeBench/blob/main/lcb_runner/evaluation/compute_code_generation_metrics.py
# https://github.com/LiveCodeBench/LiveCodeBench/blob/main/lcb_runner/evaluation/compute_test_output_prediction_metrics.py
# https://github.com/LiveCodeBench/LiveCodeBench/blob/main/lcb_runner/evaluation/compute_code_execution_metrics.py

import os 
import io
import sys
import ast
import time 
import json
import signal
import tempfile
import platform
import contextlib
import faulthandler
import numpy as np 
import multiprocessing 
from enum import Enum
from io import StringIO
from decimal import Decimal
from types import ModuleType
from datetime import datetime
from collections import defaultdict 
# used for testing the code that reads from input
from unittest.mock import patch, mock_open
from concurrent.futures import ProcessPoolExecutor, as_completed 

import_string = "from string import *\nfrom re import *\nfrom datetime import *\nfrom collections import *\nfrom heapq import *\nfrom bisect import *\nfrom copy import *\nfrom math import *\nfrom random import *\nfrom statistics import *\nfrom itertools import *\nfrom functools import *\nfrom operator import *\nfrom io import *\nfrom sys import *\nfrom json import *\nfrom builtins import *\nfrom typing import *\nimport string\nimport re\nimport datetime\nimport collections\nimport heapq\nimport bisect\nimport copy\nimport math\nimport random\nimport statistics\nimport itertools\nimport functools\nimport operator\nimport io\nimport sys\nimport json\nsys.setrecursionlimit(50000)\n"


#--------------------------------
# code generation metrics
#--------------------------------

class TimeoutException(Exception):
    pass


class CODE_TYPE(Enum):
    call_based = 0
    standard_input = 1


def timeout_handler(signum, frame):
    print("timeout occured: alarm went off")
    raise TimeoutException


def reliability_guard(maximum_memory_bytes=None):
    """
    This disables various destructive functions and prevents the generated code
    from interfering with the test (e.g. fork bomb, killing other processes,
    removing filesystem files, etc.)
    WARNING
    This function is NOT a security sandbox. Untrusted code, including, model-
    generated code, should not be blindly executed outside of one. See the
    Codex paper for more information about OpenAI's code sandbox, and proceed
    with caution.
    """

    if maximum_memory_bytes is not None:
        import resource

        resource.setrlimit(
            resource.RLIMIT_AS, (maximum_memory_bytes, maximum_memory_bytes)
        )
        resource.setrlimit(
            resource.RLIMIT_DATA, (maximum_memory_bytes, maximum_memory_bytes)
        )
        if not platform.uname().system == "Darwin":
            resource.setrlimit(
                resource.RLIMIT_STACK, (maximum_memory_bytes, maximum_memory_bytes)
            )

    faulthandler.disable()

    import builtins

    # builtins.exit = None
    builtins.quit = None

    import os

    os.environ["OMP_NUM_THREADS"] = "1"

    os.kill = None
    os.system = None
    os.putenv = None
    os.remove = None
    os.removedirs = None
    os.rmdir = None
    os.fchdir = None
    os.setuid = None
    os.fork = None
    os.forkpty = None
    os.killpg = None
    os.rename = None
    os.renames = None
    os.truncate = None
    os.replace = None
    os.unlink = None
    os.fchmod = None
    os.fchown = None
    os.chmod = None
    os.chown = None
    os.chroot = None
    os.fchdir = None
    os.lchflags = None
    os.lchmod = None
    os.lchown = None
    os.getcwd = None
    os.chdir = None

    import shutil

    shutil.rmtree = None
    shutil.move = None
    shutil.chown = None

    import subprocess

    subprocess.Popen = None  # type: ignore

    __builtins__["help"] = None

    import sys

    sys.modules["ipdb"] = None
    sys.modules["joblib"] = None
    sys.modules["resource"] = None
    sys.modules["psutil"] = None
    sys.modules["tkinter"] = None


def get_function(compiled_sol, fn_name: str):  # type: ignore
    try:
        assert hasattr(compiled_sol, fn_name)
        return getattr(compiled_sol, fn_name)
    except Exception:
        return


def compile_code(code: str, timeout: int):
    signal.alarm(timeout)
    try:
        tmp_sol = ModuleType("tmp_sol", "")
        exec(code, tmp_sol.__dict__)
        if "class Solution" in code:
            # leetcode wraps solutions in `Solution`
            # this is a hack to check if it is leetcode solution or not
            # currently livecodebench only supports LeetCode but
            # else condition allows future extensibility to other platforms
            compiled_sol = tmp_sol.Solution()
        else:
            # do nothing in the other case since function is accesible
            compiled_sol = tmp_sol

        assert compiled_sol is not None
    finally:
        signal.alarm(0)

    return compiled_sol


def truncatefn(s, length=300):
    if isinstance(s, str):
        pass
    else:
        s = str(s)
    if len(s) <= length:
        return s

    return s[: length // 2] + "...(truncated) ..." + s[-length // 2 :]


def grade_call_based(
    code: str, all_inputs: list, all_outputs: list, fn_name: str, timeout: int
):
    # call-based clean up logic
    # need to wrap in try-catch logic after to catch the correct errors, but for now this is fine.
    code = import_string + "\n\n" + code
    compiled_sol = compile_code(code, timeout)

    if compiled_sol is None:
        return

    method = get_function(compiled_sol, fn_name)

    if method is None:
        return

    all_inputs = [
        [json.loads(line) for line in inputs.split("\n")] for inputs in all_inputs
    ]

    all_outputs = [json.loads(output) for output in all_outputs]

    total_execution = 0
    all_results = []
    for idx, (gt_inp, gt_out) in enumerate(zip(all_inputs, all_outputs)):
        signal.alarm(timeout)
        faulthandler.enable()
        try:
            # can lock here so time is useful
            start = time.time()
            prediction = method(*gt_inp)
            total_execution += time.time() - start
            signal.alarm(0)

            # don't penalize model if it produces tuples instead of lists
            # ground truth sequences are not tuples
            if isinstance(prediction, tuple):
                prediction = list(prediction)

            tmp_result = prediction == gt_out

            # handle floating point comparisons

            all_results.append(tmp_result)

            if not tmp_result:
                return all_results, {
                    "output": truncatefn(prediction),
                    "inputs": truncatefn(gt_inp),
                    "expected": truncatefn(gt_out),
                    "error_code": -2,
                    "error_message": "Wrong Answer",
                }
        except Exception as e:
            signal.alarm(0)
            if "timeoutexception" in repr(e).lower():
                all_results.append(-3)
                return all_results, {
                    "error": repr(e),
                    "error_code": -3,
                    "error_message": "Time Limit Exceeded",
                    "inputs": truncatefn(gt_inp),
                    "expected": truncatefn(gt_out),
                }
            else:
                all_results.append(-4)
                return all_results, {
                    "error": repr(e),
                    "error_code": -4,
                    "error_message": "Runtime Error",
                    "inputs": truncatefn(gt_inp),
                    "expected": truncatefn(gt_out),
                }

        finally:
            signal.alarm(0)
            faulthandler.disable()

    return all_results, {"execution time": total_execution}


def clean_if_name(code: str) -> str:
    try:
        astree = ast.parse(code)
        last_block = astree.body[-1]
        if isinstance(last_block, ast.If):
            condition = last_block.test
            if ast.unparse(condition).strip() == "__name__ == '__main__'":
                code = (
                    ast.unparse(astree.body[:-1]) + "\n" + ast.unparse(last_block.body)  # type: ignore
                )
    except Exception:
        pass

    return code


def make_function(code: str) -> str:
    try:
        import_stmts = []
        all_other_stmts = []
        astree = ast.parse(code)
        for stmt in astree.body:
            if isinstance(stmt, (ast.Import, ast.ImportFrom)):
                import_stmts.append(stmt)
            else:
                all_other_stmts.append(stmt)

        function_ast = ast.FunctionDef(
            name="wrapped_function",
            args=ast.arguments(
                posonlyargs=[], args=[], kwonlyargs=[], kw_defaults=[], defaults=[]
            ),
            body=all_other_stmts,
            decorator_list=[],
            lineno=-1,
        )
        main_code = (
            import_string
            + "\n"
            + ast.unparse(import_stmts)  # type: ignore
            + "\n"
            + ast.unparse(function_ast)  # type: ignore
        )
        return main_code
    except Exception:
        return code
    

# used to capture stdout as a list
# from https://stackoverflow.com/a/16571630/6416660
# alternative use redirect_stdout() from contextlib
class Capturing(list):
    def __enter__(self):
        self._stdout = sys.stdout
        sys.stdout = self._stringio = StringIO()
        # Make closing the StringIO a no-op
        self._stringio.close = lambda x: 1
        return self

    def __exit__(self, *args):
        self.append(self._stringio.getvalue())
        del self._stringio  # free up some memory
        sys.stdout = self._stdout


def call_method(method, inputs):

    if isinstance(inputs, list):
        inputs = "\n".join(inputs)

    inputs_line_iterator = iter(inputs.split("\n"))

    # sys.setrecursionlimit(10000)

    # @patch('builtins.input', side_effect=inpu
```

### Core Architecture Module: `evoagentx/benchmark/lcb_utils/utils.py`
```

def extract_test_output_code(model_output: str):

    outputlines = model_output.split("\n")
    # find the last line startwith assert...
    indexlines = [i for i, line in enumerate(outputlines) if line.startswith("assert")]
    if indexlines:
        return outputlines[indexlines[-1]]
    
    # first try to extract ```python if not then try ```
    indexlines = [
        i
        for i, line in enumerate(outputlines)
        if "```python" in line or "```Python" in line
    ]
    if indexlines:
        start_index = indexlines[0]
    else:
        start_index = None
    indexlines = [i for i, line in enumerate(outputlines) if "```" in line]
    if start_index is not None:
        indexlines = [i for i in indexlines if i > start_index]
        indexlines = [start_index] + indexlines

    if len(indexlines) < 2:
        return ""
    return "\n".join(outputlines[indexlines[0] + 1 : indexlines[1]])


def extract_execution_code(model_output: str, cot: bool = False):
    if cot:
        if "[ANSWER]" in model_output:
            model_output = model_output.split("[ANSWER]")[1].strip()
    if "==" in model_output:
        model_output = model_output.split("==")[1].strip()
    if "[/ANSWER]" in model_output:
        model_output = model_output.split("[/ANSWER]")[0].strip()
    else:
        model_output = model_output.split("\n")[0].strip()
    return model_output.strip()
```

### Core Architecture Module: `evoagentx/core/__init__.py`
```
# ruff: noqa: F403
from .base_config import BaseConfig
# from .callbacks import *
from .message import Message
from .parser import Parser
# from .decorators import * 
from .module import * 
from .registry import * 

__all__ = ["BaseConfig", "Message", "Parser"]

```

### Core Architecture Module: `evoagentx/core/base_config.py`
```
from typing import List, Optional

from jsonschema import Draft7Validator
from pydantic import model_validator

from .module import BaseModule


class BaseConfig(BaseModule):

    """
    Base configuration class that serves as parent for all configuration classes.
    
    A config should inherit BaseConfig and specify the attributes and their types. 
    Otherwise this will be an empty config.
    """
    def save(self, path: str, **kwargs)-> str:

        """Save configuration to the specified path.
        
        Args:
            path: The file path to save the configuration
            **kwargs (Any): Additional keyword arguments passed to save_module method
        
        Returns:
            str: The path where the file was saved
        """
        return super().save_module(path, **kwargs)

    def get_config_params(self) -> List[str]:
        """Get a list of configuration parameters.
        
        Returns:
            List[str]: List of configuration parameter names, excluding 'class_name'
        """
        config_params = list(type(self).model_fields.keys())
        config_params.remove("class_name")
        return config_params

    def get_set_params(self, ignore: List[str] = []) -> dict:
        """Get a dictionary of explicitly set parameters.
        
        Args:
            ignore: List of parameter names to ignore
        
        Returns:
            dict: Dictionary of explicitly set parameters, excluding 'class_name' and ignored parameters
        """
        explicitly_set_fields = {field: getattr(self, field) for field in self.model_fields_set}
        if self.kwargs:
            explicitly_set_fields.update(self.kwargs)
        for field in ignore:
            explicitly_set_fields.pop(field, None)
        explicitly_set_fields.pop("class_name", None)
        return explicitly_set_fields


class Parameter(BaseModule):
    """Parameter class used to define configuration parameters.

    Attributes:
        name: Parameter name
        type: Parameter type, support json & python type.
        description: Parameter description
        required: Whether the parameter is required, defaults to True
        json_schema: the optional json schema of the parameter. Recommended when type is `object` or `array`.
    """
    name: str
    type: str
    description: str
    required: Optional[bool] = True
    json_schema: Optional[dict] = None

    @model_validator(mode="after")
    def _validate_type_and_schema(self):
        from ..utils.utils import normalize_param_type, string_to_json_schema_type, string_to_python_type
        if self.type not in string_to_python_type:
            # LLM-generated specs may emit synonyms (e.g. "List[str]", "text"); map those to
            # canonical types. Truly unrecognized types (e.g. "other_type") still raise.
            normalized = normalize_param_type(self.type)
            if normalized is None:
                raise ValueError(f"Invalid `type`: {self.type}. Allowed: {list(string_to_python_type.keys())}")
            self.type = normalized
        if self.json_schema is not None:
            try:
                Draft7Validator.check_schema(self.json_schema)
            except Exception as e:
                raise ValueError(f"Invalid `json_schema` for '{self.name}': {self.json_schema}.") from e
            expected_schema_type = string_to_json_schema_type[self.type]
            actual_schema_type = self.json_schema.get("type")
            if expected_schema_type != actual_schema_type:
                raise ValueError(
                    "`type` and `json_schema.type` must be the same if `json_schema` is provided. "
                    f"But got `type`: {self.type}, `json_schema.type`: {actual_schema_type}"
                )
        return self

```

### Core Architecture Module: `evoagentx/core/callbacks.py`
```
import sys 
# import stopit
from overdue import timeout_set_to 
import threading
import contextvars
from typing import Union
from contextlib import contextmanager
from .logging import logger, get_log_file

class Callback:

    """
    a base class for callbacks 
    """

    def on_error(self, exception, *args, **kwargs):
        pass

    def __call__(self, *args, **kwargs):
        try:
            result = self.run(*args, **kwargs)
        except Exception as e:
            self.on_error(e, *args, kwargs)
            raise e 
        return result
    
    def run(self, *args, **kwargs):
        raise NotImplementedError(f"run is not implemented for {type(self).__name__}!")


class CallbackManager:

    def __init__(self):
        self.local_data = threading.local()
        # self.local_data.callbacks = {}
    
    def _ensure_callbacks(self):
        if not hasattr(self.local_data, "callbacks"):
            self.local_data.callbacks = {}

    def set_callback(self, callback_type: str, callback: Callback):
        self._ensure_callbacks()
        self.local_data.callbacks[callback_type] = callback

    def get_callback(self, callback_type: str):
        self._ensure_callbacks()
        return self.local_data.callbacks.get(callback_type, None)
    
    def has_callback(self, callback_type: str):
        self._ensure_callbacks()
        return callback_type in self.local_data.callbacks

    def clear_callback(self, callback_type: str):
        self._ensure_callbacks()
        if callback_type in self.local_data.callbacks:
            del self.local_data.callbacks[callback_type]

    def clear_all(self):
        self._ensure_callbacks()
        self.local_data.callbacks.clear()

callback_manager = CallbackManager()


class DeferredExceptionHandler(Callback):

    def __init__(self):
        self.exceptions = [] 
    
    def add(self, exception):
        self.exceptions.append(exception)
    

@contextmanager
def exception_buffer():
    if not callback_manager.has_callback("exception_buffer"):
        exception_handler = DeferredExceptionHandler()
        callback_manager.set_callback("exception_buffer", exception_handler)
    else:
        exception_handler = callback_manager.get_callback("exception_buffer")
    try:
        yield exception_handler
    finally:
        callback_manager.clear_callback("exception_buffer")
    

suppress_cost_logs = contextvars.ContextVar("suppress_cost_logs", default=False)

@contextmanager
def suppress_cost_logging():
    """Thread-safe context manager: only suppresses cost-related logs without affecting other info-level logs"""
    token = suppress_cost_logs.set(True)  # Set the value in the current thread/task
    try:
        yield
    finally:
        suppress_cost_logs.reset(token)  # Restore the previous value


silence_nesting = contextvars.ContextVar("silence_nesting", default=0)

@contextmanager
def suppress_logger_info():
    token = None
    try:
        current_level = silence_nesting.get()
        token = silence_nesting.set(current_level + 1)
        
        if current_level == 0:
            logger.remove()
            logger.add(sys.stdout, level="WARNING")
            log_file = get_log_file()
            if log_file is not None:
                logger.add(
                    log_file,
                    encoding="utf-8",
                    level="WARNING", 
                    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}"
                )
        yield
    finally:
        new_level = silence_nesting.get() - 1
        silence_nesting.set(new_level)
        
        if new_level == 0:
            logger.remove()
            logger.add(sys.stdout, level="INFO")
            log_file = get_log_file()
            if log_file is not None:
                logger.add(
                    log_file,
                    encoding="utf-8",
                    level="INFO", 
                    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}"
                )
        if token:
            silence_nesting.reset(token)


class TimeoutException(Exception):
    pass

class TimeoutContext:
    """
    A reliable cross-platform timeout context manager using stopit
    
    Usage:
        with TimeoutContext(seconds=5):
            # code that may timeout
            do_something()
    """
    def __init__(self, seconds: Union[int, float]):
        self.seconds = float(seconds)
        # self._context: Optional[stopit.SignalTimeout] = None
        self._cm = None
        self._result = None
        
    def __enter__(self):
        # self._context = stopit.ThreadingTimeout(self.seconds)
        # self._context.__enter__()
        self._cm = timeout_set_to(self.seconds)
        self._result = self._cm.__enter__()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        # timeout_occurred = self._context.__exit__(exc_type, exc_val, exc_tb)
        # if timeout_occurred:
            # raise TimeoutException("Operation timed out")
        self._cm.__exit__(exc_type, exc_val, exc_tb)
        if self._result.triggered:
            raise TimeoutException("Operation timed out")
        return False

@contextmanager
def timeout(seconds: float):
    with TimeoutContext(seconds):
        yield

```

### Core Architecture Module: `evoagentx/core/decorators.py`
```
import threading
from functools import wraps
from contextlib import nullcontext


def atomic(lock=None):
    """
    threading safe decorator, it can be used to decorate a function or receive a lock:
    1. directly decorate a function: @atomic 
    2. receive a lock: @atomic(lock=shared_lock)
    """
    lock = lock or threading.Lock()
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            with lock:
                return func(*args, **kwargs)
        return wrapper
    
    return decorator if not callable(lock) else decorator(lock)


def atomic_method(func):
    """
    threading safe decorator for class methods. 
    If there are self._lock in the instance, it will use the lock. Otherwise, use nullcontext for execution.
    """
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        lock = getattr(self, "_lock", None)
        context = lock if lock is not None else nullcontext()
        with context:
            return func(self, *args, **kwargs)
    return wrapper


def async_atomic_method(func):
    """
    Async version of atomic_method for async class methods.
    If there is self._async_lock (asyncio.Lock) in the instance, it will use the lock.
    Otherwise, use async nullcontext for execution.
    """
    @wraps(func)
    async def wrapper(self, *args, **kwargs):
        lock = getattr(self, "_async_lock", None)
        if lock is not None:
            async with lock:
                return await func(self, *args, **kwargs)
        else:
            return await func(self, *args, **kwargs)
    return wrapper



```

### Core Architecture Module: `evoagentx/core/exception.py`
```
class DisplayableException(Exception):
    pass

class NoAnswerError(DisplayableException):
    pass

class InputValidationError(DisplayableException):
    pass

```

### Core Architecture Module: `evoagentx/core/logging.py`
```
import os
import sys
import io
from loguru import logger

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# 清空默认 handler，避免重复输出
logger.remove()

# 控制台输出
logger.add(sys.stdout, level="INFO")
# file_handler_id = None 
save_logging_file = None  

def save_logger(path: str):
    """
    Save the logging to a file.
    
    Args:
        path: The path to save the logging file
    """
    global save_logging_file
    save_logging_file = path

    parent_folder = os.path.dirname(path)
    os.makedirs(parent_folder, exist_ok=True)
    logger.add(path, encoding="utf-8", format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}")

def get_log_file():
    """
    Get the path to the logging file.
    
    Returns:
        str: The path to the logging file
    """
    return save_logging_file 

__all__ = ["logger", "save_logger", "get_log_file"]


```

### Core Architecture Module: `evoagentx/core/message.py`
```
from enum import Enum
from pydantic import Field, model_validator
from datetime import datetime
from typing import Optional, Callable, Any, List, Union

from .module import BaseModule
from .module_utils import generate_id, get_timestamp

class MessageType(Enum):
    
    REQUEST = "request"
    RESPONSE = "response"
    COMMAND = "command"
    ERROR = "error"
    UNKNOWN = "unknown"
    INPUT = "input"


class Message(BaseModule):

    """
    the base class for message. 

    Attributes: 
        content (Any): the content of the message, need to implement str() function. 
        agent (str): the sender of the message, normally set as the agent name.
        action (str): the trigger of the message, normally set as the action name.
        prompt (str): the prompt used to obtain the generated text. 
        next_actions (List[str]): the following actions. 
        msg_type (str): the type of the message, such as "request", "response", "command" etc. 
        wf_goal (str): the goal of the whole workflow. 
        wf_task (str): the name of a task in the workflow, i.e., the ``name`` of a WorkFlowNode instance. 
        wf_task_desc (str): the description of a task in the workflow, i.e., the ``description`` of a WorkFlowNode instance.
        message_id (str): the unique identifier of the message. 
        timestamp (str): the timestame of the message. 
    """
    
    content: Any
    agent: Optional[str] = None
    # receivers: Optional[Union[str, List[str]]] = None
    action: Optional[str] = None
    prompt: Optional[Union[str, List[dict]]] = None
    next_actions: Optional[List[str]] = None
    msg_type: Optional[MessageType] = MessageType.UNKNOWN
    wf_goal: Optional[str] = None
    wf_task: Optional[str] = None
    wf_task_desc: Optional[str] = None
    message_id: Optional[str] = Field(default_factory=generate_id)
    timestamp: Optional[str] = Field(default_factory=get_timestamp)
    conversation_id: Optional[str] = Field(default_factory=generate_id)
    
    def __str__(self) -> str:
        return self.to_str()
    
    def __eq__(self, other: "Message"):
        return self.message_id == other.message_id

    def __hash__(self):
        return self.message_id
    
    def to_str(self) -> str:

        msg_part = []
        if self.timestamp:
            msg_part.append(f"[{self.timestamp}]")
        if self.agent:
            msg_part.append(f"Agent: {self.agent}")
        if self.msg_type and self.msg_type != MessageType.UNKNOWN:
            msg_part.append(f"Type: {self.msg_type}")
        if self.action:
            msg_part.append(f"Action: {self.action}")
        if self.wf_goal:
            msg_part.append(f"Goal: {self.wf_goal}")
        if self.wf_task:
            msg_part.append(f"Task: {self.wf_task} ({self.wf_task_desc or 'No description'})")
        if self.content:
            msg_part.append(f"Content: {str(self.content)}")
                
        msg = "\n".join(msg_part)
        return msg 

    def to_dict(self, exclude_none: bool = True, ignore: List[str] = [], **kwargs) -> dict:
        """
        Convert the Message to a dictionary for saving. 
        """
        data = super().to_dict(exclude_none=exclude_none, ignore=ignore, **kwargs) 
        if self.msg_type:
            data["msg_type"] = self.msg_type.value
        return data 
    
    @model_validator(mode="before")
    @classmethod
    def validate_data(cls, data: Any) -> Any:
        if "msg_type" in data and data["msg_type"] and isinstance(data["msg_type"], str):
            data["msg_type"] = MessageType(data["msg_type"])
        return data 

    @classmethod
    def sort_by_timestamp(cls, messages: List['Message'], reverse: bool = False) -> List['Message']:
        """
        sort the messages based on the timestamp. 

        Args: 
            messages (List[Message]): the messages to be sorted. 
            reverse (bool): If True, sort the messages in descending order. Otherwise, sort the messages in ascending order.
        """
        messages.sort(key=lambda msg: datetime.strptime(msg.timestamp, "%Y-%m-%d %H:%M:%S"), reverse=reverse)
        return messages

    @classmethod
    def sort(cls, messages: List['Message'], key: Optional[Callable[['Message'], Any]] = None, reverse: bool = False) -> List['Message']:
        """
        sort the messages using key or timestamp (by default). 

        Args:
            messages (List[Message]): the messages to be sorted. 
            key (Optional[Callable[['Message'], Any]]): the function used to sort messages. 
            reverse (bool): If True, sort the messages in descending order. Otherwise, sort the messages in ascending order.
        """
        if key is None:
            return cls.sort_by_timestamp(messages, reverse=reverse)
        messages.sort(key=key, reverse=reverse)
        return messages

    @classmethod
    def merge(cls, messages: List[List['Message']], sort: bool=False, key: Optional[Callable[['Message'], Any]] = None, reverse: bool=False) -> List['Message']:
        """
        merge different message list. 

        Args:
            messages (List[List[Message]]): the message lists to be merged. 
            sort (bool): whether to sort the merged messages.
            key (Optional[Callable[['Message'], Any]]): the function used to sort messages. 
            reverse (bool): If True, sort the messages in descending order. Otherwise, sort the messages in ascending order.
        """
        merged_messages = sum(messages, [])
        if sort:
            merged_messages = cls.sort(merged_messages, key=key, reverse=reverse)
        return merged_messages
    


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #212** (2026-04-22): **[Bug] Using official examples, but generating results keeps generating the same content cyclically**
  *Symptoms*: ### Describe the Bug  - code ```ts openai_config = OpenAILLMConfig(     model="deepseek-chat",       # 指定模型名称     openai_key="sk-25b***************813", # 直接传入密钥     base_url="https://api.deepseek.com/v1",     stream=True,               # 启用流式响应     output_response=True       # 打印响应到标准输出 ) llm = OpenAILLM(config=openai_config)  goal = "生成可以在浏览器中玩的俄罗斯方块游戏的html代码。请使用中文" wf_generator = WorkFlowGenerator(llm=llm) workflow_graph: WorkFlowGraph = wf_generator.generate_workflow(goal=goal) # 可视化工作流结构（可选） workflow_graph.display()  # 将工作流保存为 JSON 文件（可选） workflow_graph.save_module("./workflow_demo.json") ``` - result  <img width="1130" height="1124" alt="Image" src="https://github.com/user-attachments/assets/48b9d159-b145-4992-99e7-74e747dd78cc" />  This is just an example. It's repeated a lot.    ### Operating System  macos 15.7.1  ### Python Version  3.10.18  ### Steps to Reproduce  1. Use official examples  ### Logs or Screenshots  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi, I noticed that you are using deepseek model as the backbone model. However, most of our prompts are optimised based on the OpenAI series model, since other models sometimes failed to follow the instructions. Please try OpenAI models instead. 

- **Issue #199** (2025-10-17): **[Bug] JSON output parser not properly escaping**
  *Symptoms*: ### Describe the Bug  If there is dirty json coming from the output parser in the models/base_model.py causing the workflow execution to fail. Troublesome non-escaped is "[:port]". The parser should be built very strong to handle all sorts of situations and to prevent prompt injection attacks and allow to finish.  ### Operating System  Windows   ### Python Version  3.11  ### Steps to Reproduce  1. Open examples, workflow, workflow_direction.py 2. Paste this goal:   ```goal = """Return only valid JSON containing at least one string value with the literal substring "[:port]" (exact characters). Example JSON should include a field "endpoint" with value "http://localhost[:port]/api" and nothing else outside the JSON."""``` 4. Run it  ### Logs or Screenshots  ``` Traceback (most recent call last):   File "C:\EvoAgentX\evoagentx\models\base_model.py", line 168, in _parse_json     data = yaml.safe_load(json_str)            ^^^^^^^^^^^^^^^^^^^^^^^^   File "C:\EvoAgentX\.venv\Lib\site-packages\yaml\__init__.py", line 125, in s     return load(stream, SafeLoader)            ^^^^^^^^^^^^^^^^^^^^^^^^   File "C:\EvoAgentX\.venv\Lib\site-packages\yaml\__init__.py", line 81, in lo     return loader.get_single_data()            ^^^^^^^^^^^^^^^^^^^^^^^^   File "C:\EvoAgentX\.venv\Lib\site-packages\yaml\constructor.py", line 49, in     node = self.get_single_node()            ^^^^^^^^^^^^^^^^^^^^^^   File "C:\EvoAgentX\.venv\Lib\site-packages\yaml\composer.py", line 36, in ge     document = se
  **Post-Mortem & Fix Analysis**:
  > We have fixed this issue. Please check the latest PR

- **Issue #196** (2025-11-05): **[Bug] RAG failure when we tried to load existing index**
  *Symptoms*: ### Describe the Bug  <img width="682" height="126" alt="Image" src="https://github.com/user-attachments/assets/3624252e-fbe4-4926-a30e-5356637739ee" />  ### Operating System  windows11  ### Python Version  3.10.12  ### Steps to Reproduce  I writed my own implementation based on the rag_engine. If I tried to load the existing index, this error will show up.  ### Logs or Screenshots  <img width="682" height="126" alt="Image" src="https://github.com/user-attachments/assets/4e5733ac-901c-4356-abba-64b949384dec" />  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi, the bug has been received.

- **Issue #181** (2025-09-12): **[Bug] import feedparser the feedparser can not be found**
  *Symptoms*: ### Describe the Bug  <img width="424" height="160" alt="Image" src="https://github.com/user-attachments/assets/1a5336b6-8744-464d-a398-eceb0e88494d" />  ### Operating System  windows11  ### Python Version  3.10.2  ### Steps to Reproduce  The feedparser for windows installation has some issue  ### Logs or Screenshots  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > <img width="1089" height="309" alt="Image" src="https://github.com/user-attachments/assets/2547a2ae-759a-4c5a-b10c-9728449216b7" />  Hi, it seems feedparser can be installed on Windows.
  > Thanks for your reply, here is my screenshot.  <!-- Failed to upload "image.png" -->I use the admin mode and update the setuptool by pip install --upgrade setuptools but it does not work
  > Thanks for your reply, here is my screenshot.  I use the admin mode and update the setuptool by pip install --upgrade setuptools but it does not work  <img width="567" height="365" alt="Image" src="https://github.com/user-attachments/assets/5b0cd918-80ad-47c2-80ce-53448d7844c5" />

- **Issue #180** (2025-09-16): **[Bug] WikipediaSearchToolkit seems can not install on windows, so the __init__.py will have error so the windows can not use this package.**
  *Symptoms*: ### Describe the Bug  WikipediaSearchToolkit seems can not install on windows, so the __init__.py will have error so the windows can not use this package. Recommend to comment this comment  ### Operating System  windows11  ### Python Version  3.10  ### Steps to Reproduce  run the install step on windows and you will get this error.  ### Logs or Screenshots  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for reporting the bug. Can you share the complete error message?
  > Hi, thanks for reporting this issue! I just tested on Windows and was able to install and use wikipedia without errors, and it’s already included in the requirements.txt. Could you please share the complete error message? That will help me better understand and reproduce the problem.
  > Thanks, here is my screenshot  <img width="712" height="50" alt="Image" src="https://github.com/user-attachments/assets/e131cd26-09a8-4520-b936-d6d62bc35f56" />

- **Issue #160** (2025-09-04): **[Bug] aflow_math example fail to evaluate**
  *Symptoms*: ### Describe the Bug  run aflow_math.py report evaluation failed  Evaluation failed: 'coroutine' object is not subscriptable  ### Operating System  debian  ### Python Version  3.10  ### Steps to Reproduce  1. change executor_llm and optimizer_llm config (which works in textgrad example) 2. run aflow_math.py 3. observe Evaluation failed: 'coroutine' object is not subscriptable,   ### Logs or Screenshots  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > fixed, network problem

- **Issue #144** (2025-09-14): **[Bug] There are bugs when using AliyunLLM as the backend LLM**
  *Symptoms*: ### Describe the Bug  When I run textgrad_optimizer.ipynb with AliyunLLM as the backend LLM, it print the following log:  2025-08-20 22:28:24.505 | ERROR    | evoagentx.workflow.workflow:async_execute:104 - An Error occurs when executing the workflow: Error during single_generate_async of AliyunLLM: HTTPSConnectionPool(host='dashscope.aliyuncs.com', port=443): Max retries exceeded with url: /api/v1/services/aigc/text-generation/generation (Caused by ProxyError('Unable to connect to proxy', RemoteDisconnected('Remote end closed connection without response'))) Error processing async stream: 'async for' requires an object with __aiter__ method, got generator 2025-08-20 22:28:36.875 | WARNING  | evoagentx.evaluators.evaluator:_evaluate_single_example:197 - Error evaluating example and set the metrics to None: Example: {'id': 'test-3600', 'problem': 'Subtract the number of positive multiples of $3$ that are less than $20$ from the number of positive multiples of $6$ that are less than $20$.', 'level': 'Level 4', 'type': 'Prealgebra', 'solution': 'The positive multiples of $3$ that are less than $20$ are $$3, 6, 9, 12, 15, 18.$$The positive multiples of $6$ that are less than $20$ are $$6, 12, 18.$$Therefore, there are $6$ positive multiples of $3$ and $3$ positive multiples of $6$, so our final answer is    $$3 - 6 = -(6 - 3) = \\boxed{-3}.$$'} Error: Error during single_generate_async of AliyunLLM: Failed to process async stream response: 'async for' requires an object with __ait
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for pointing out this issue. It seems like this issue is due to the connection error. Have you tried disconnecting your VPN and running the code again? 
  > I tried that and found that if I call the AliyunLLM API directly, it works and returns a response. However, when I use it as the backend LLM for the TextGrad optimizer, I encounter the following error: 'Error during single_generate_async of AliyunLLM: Failed to process async stream response: "async for" requires an object with an aiter method, but got a generator.
  > Hi, can you turn off the stream of AliyunLLM? It looks like the error is due to that you return a normal generator instead of async generator. 

- **Issue #133** (2025-09-14): **[Bug] Model-specific failure with kimi-k2: missing goal variable in WorkflowExecutorAgent prompt**
  *Symptoms*: ### Describe the Bug  Using kimi-k2 results in an error because the agent prompt doesn’t include a reference to the goal input variable.  ### Operating System  Windows11  ### Python Version  3.12  ### Steps to Reproduce  Run kimi-k2 workflow  ### Logs or Screenshots  Expected  Either robust templating that guarantees required variables or a clear pre-execution validation error. Actual  Failure attributed to missing goal in prompt (and likely model sensitivity).    ### Additional Context  Suggested Fix •	Add template validation (assert required variables present). •	Document recommended high-performance models and known limitations. Priority  P2

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

### Incident Patch 1: `d77fd6b9` (2026-08-27)
**Commit Message**: Merge pull request #256 from bitkira/fix/alita-generated-tool-output

fix(alita): preserve generated tool results with stdout logs

**File**: `evoagentx/tools/alita_agent.py` (modified, +74/-18)
```diff
@@ -1,16 +1,15 @@
 import json
 import os
-from typing import Any, Dict, List, Optional
+import uuid
+from typing import TYPE_CHECKING, Any, ClassVar, Dict, List, Optional
 
 from ..core.logging import logger
-from ..models.model_configs import LLMConfig
-from ..agents import CustomizeAgent
 
 from .tool import Tool, Toolkit
-from .storage_file import StorageToolkit
-from .search_serpapi import SerpAPIToolkit
-from .interpreter_docker import DockerInterpreterToolkit
-from .interpreter_python import PythonInterpreterToolkit
+
+if TYPE_CHECKING:
+    from ..agents import CustomizeAgent
+    from ..models.model_configs import LLMConfig
 
 
 class GeneratedCodeTool(Tool):
@@ -43,6 +42,8 @@ class GeneratedCodeTool(Tool):
         }
     }
     required: Optional[List[str]] = []
+    _RESULT_MARKER_PREFIX: ClassVar[str] = "__ALITA_GENERATED_TOOL_RESULT__"
+    _RESULT_MARKER: ClassVar[str] = "__ALITA_GENERATED_TOOL_RESULT__="
 
     def __init__(
         self,
@@ -77,12 +78,17 @@ def __call__(self, payload: dict = None) -> Dict[str, Any]:
 
         # Inject payload and user code into a small wrapper that expects the
         # user to set `result` and prints it as JSON.
+        result_marker = f"{self._RESULT_MARKER_PREFIX}_{uuid.uuid4().hex}="
         wrapper_code = (
-            "import json\n\n"
-            f"payload = json.loads({json.dumps(payload_json)})\n\n"
+            "import json as __alita_json\n\n"
+            f"payload = __alita_json.loads({json.dumps(payload_json)})\n\n"
             "result = None\n\n"
             f"{self._source_code}\n\n"
-            "print(json.dumps(result, ensure_ascii=False))\n"
+            "import json as __alita_json\n"
+            "print("
+            f"{json.dumps(result_marker)} + "
+            "__alita_json.dumps(result, ensure_ascii=False)"
+            ")\n"
         )
 
         try:
@@ -101,7 +107,49 @@ def __call__(self, payload: dict = None) -> Dict[str, Any]:
                 "error": "Code executor returned no output for generated tool.",
             }
 
-        # Try to parse the output as JSON; if that fails, return raw text.
+        # Parse the wrapper's marked result while preserving user stdout logs.
+        return self._parse_execution_output(output, marker=result_marker)
+
+    @classmethod
+    def _parse_execution_output(
+        cls, output: str, marker: Optional[str] = None
+    ) -> Dict[str, Any]:
+        result_marker = marker or cls._RESULT_MARKER
+        marker_index = output.rfind(result_marker)
+        failed_result_text = None
+        while marker_index != -1:
+            result_start = marker_index + len(result_marker)
+            line_end = output.find("\n", result_start)
+            if line_end == -1:
+                line_end = len(output)
+                after_result = ""
+            else:
+                after_result = output[line_end + 1 :]
+
+            result_text = output[result_start:line_end].strip()
+            try:
+                parsed = json.loads(result_text)
+            except Exception:
+                failed_result_text = result_text
+            else:
+                result = {
+                    "success": True,
+                    "result": parsed,
+                    "raw_output": output,
+                }
+                logs = (output[:marker_index] + after_result).strip()
+                if logs:
+                    result["logs"] = logs
+                return result
+            marker_index = output.rfind(result_marker, 0, marker_index)
+
+        if failed_result_text is not None:
+            logger.warning(
+                "Failed to parse marked generated tool result as JSON: {}",
+                failed_result_text,
+            )
+
+        # Backward-compatible fallback for unmarked executor output.
         try:
             parsed = json.loads(output)
             return {
@@ -110,10 +158,12 @@ def __call__(self, payload: dict = None) -> Dict[str, Any]:
                 "raw_output": output,
             }
         except Exception:
-            return {
-                "success": True,
-                "result": output,
-            }
+            pass
+
+        return {
+            "success": True,
+            "result": output,
+        }
 
 
 class AlitaDynamicToolkit(Toolkit):
@@ -509,13 +559,13 @@ def __call__(self) -> Dict[str, Any]:
 
 
 def create_alita_agent(
-    llm_config: LLMConfig,
+    llm_config: "LLMConfig",
     persist_dynamic_tools: bool = True,
     load_existing_dynamic_tools: bool = True,
     dynamic_tools_path: str = "./workplace/alita/dynamic_tools.json",
     use_docker: bool = True,
     serpapi_api_key: Optional[str] = None,
-) -> CustomizeAgent:
+) -> "CustomizeAgent":
     """
     Build the Alita agent with search, storage, code execution, and dynamic tools.
 
@@ -544,6 +594,12 @@ def create_alita_agent(
             variable.
     """
 
+    from ..agents import CustomizeAgent
+    from .interpreter_docker import DockerInter
```

**File**: `tests/src/tools/test_alita_generated_code_tool.py` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+import contextlib
+import io
+from pathlib import Path
+from typing import Dict, List, Optional
+
+from evoagentx.tools.alita_agent import GeneratedCodeTool
+from evoagentx.tools.interpreter_python import PythonExecuteTool, PythonInterpreter
+from evoagentx.tools.tool import Tool
+
+
+class FakePythonExecutor(Tool):
+    name: str = "fake_python_execute"
+    description: str = "Execute Python code and return stdout."
+    inputs: Dict[str, Dict[str, str]] = {
+        "code": {"type": "string", "description": "Python source code."},
+        "language": {"type": "string", "description": "Execution language."},
+    }
+    required: Optional[List[str]] = ["code"]
+
+    def __call__(self, code: str, language: str = "python") -> str:
+        stdout = io.StringIO()
+        with contextlib.redirect_stdout(stdout):
+            exec(code, {})
+        return stdout.getvalue()
+
+
+class AppendingPythonExecutor(FakePythonExecutor):
+    name: str = "appending_python_execute"
+    description: str = "Execute Python code and append output after execution."
+    inputs: Dict[str, Dict[str, str]] = {
+        "code": {"type": "string", "description": "Python source code."},
+        "language": {"type": "string", "description": "Execution language."},
+    }
+    required: Optional[List[str]] = ["code"]
+
+    def __call__(self, code: str, language: str = "python") -> str:
+        return super().__call__(code, language) + "stderr: warning\n"
+
+
+class MarkerCollisionPythonExecutor(FakePythonExecutor):
+    name: str = "marker_collision_python_execute"
+    description: str = "Execute Python code and append a colliding marker line."
+    inputs: Dict[str, Dict[str, str]] = {
+        "code": {"type": "string", "description": "Python source code."},
+        "language": {"type": "string", "description": "Execution language."},
+    }
+    required: Optional[List[str]] = ["code"]
+
+    def __call__(self, code: str, language: str = "python") -> str:
+        marker_start = code.rfind(GeneratedCodeTool._RESULT_MARKER_PREFIX)
+        marker_end = code.find("=", marker_start)
+        assert marker_start != -1
+        assert marker_end != -1
+        marker = code[marker_start : marker_end + 1]
+        return super().__call__(code, language) + f"{marker}not-json\n"
+
+
+def test_generated_code_tool_returns_structured_result_without_logs():
+    tool = GeneratedCodeTool(
+        code_executor=FakePythonExecutor(),
+        tool_name="clean_tool",
+        description="Clean generated tool",
+        code='result = {"echo": payload.get("text")}',
+    )
+
+    output = tool(payload={"text": "hello"})
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["raw_output"]
+    assert "logs" not in output
+
+
+def test_generated_code_tool_separates_stdout_logs_from_result():
+    tool = GeneratedCodeTool(
+        code_executor=FakePythonExecutor(),
+        tool_name="noisy_tool",
+        description="Noisy generated tool",
+        code='print("debug: starting")\nresult = {"echo": payload.get("text")}',
+    )
+
+    output = tool(payload={"text": "hello"})
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["logs"] == "debug: starting"
+    assert "debug: starting" in output["raw_output"]
+
+
+def test_generated_code_tool_handles_output_after_marked_result():
+    tool = GeneratedCodeTool(
+        code_executor=AppendingPythonExecutor(),
+        tool_name="stderr_tool",
+        description="Generated tool with post-result output",
+        code='print("debug: starting")\nresult = {"echo": payload.get("text")}',
+    )
+
+    output = tool(payload={"text": "hello"})
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["logs"] == "debug: starting\nstderr: warning"
+
+
+def test_generated_code_tool_ignores_invalid_marker_collision_after_result():
+    tool = GeneratedCodeTool(
+        code_executor=MarkerCollisionPythonExecutor(),
+        tool_name="collision_tool",
+        description="Generated tool with a post-result marker collision",
+        code='print("debug: starting")\nresult = {"echo": payload.get("text")}',
+    )
+
+    output = tool(payload={"text": "hello"})
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["logs"].startswith("debug: starting\n")
+    assert "not-json" in output["logs"]
+
+
+def test_generated_code_tool_preserves_legacy_full_json_output():
+    output = GeneratedCodeTool._parse_execution_output('{"echo": "hello"}')
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["raw_output"] == '{"echo": "hello"}'
+
+
+def test_generated_code_tool_does_not_guess_from_unmarked_json_log():
+    raw_output = '{"debug": true}\nTraceback (most recent call last):\nboom'
+
+    output = GeneratedCodeTool.
```

---

### Incident Patch 2: `f0c179ee` (2026-08-27)
**Commit Message**: Merge pull request #253 from bitkira/fix/evoprompt-state-isolation

fix(evoprompt): isolate registry state during concurrent evaluation

**File**: `evoagentx/optimizers/engine/base.py` (modified, +8/-3)
```diff
@@ -1,7 +1,12 @@
-from typing import Any, Callable, Dict, List, Optional
+from __future__ import annotations
+
 import abc
+from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING
+
 from .decorators import EntryPoint
-from .registry import ParamRegistry
+
+if TYPE_CHECKING:
+    from .registry import ParamRegistry
 
 class BaseOptimizer(abc.ABC):
     # def __init__(
@@ -67,4 +72,4 @@ def optimize(self):
         if self.program is None:
             raise RuntimeError("No entry function provided or registered.")
         print(f"Starting optimization from entry: {self.program.__name__}")
-        raise NotImplementedError
\ No newline at end of file
+        raise NotImplementedError
```

**File**: `evoagentx/optimizers/engine/decorators.py` (modified, +6/-2)
```diff
@@ -1,5 +1,9 @@
-from typing import Any, Callable, List, Tuple, Optional
-from .registry import ParamRegistry
+from __future__ import annotations
+
+from typing import Any, Callable, List, Tuple, Optional, TYPE_CHECKING
+
+if TYPE_CHECKING:
+    from .registry import ParamRegistry
 
 # --------- EntryPoint decorator ---------
 class EntryPoint:
```

**File**: `evoagentx/optimizers/evoprompt_optimizer.py` (modified, +73/-31)
```diff
@@ -12,6 +12,8 @@
 #   https://opensource.microsoft.com/codeofconduct/
 # -----------------------------------------------------------------------------
 
+from __future__ import annotations
+
 import asyncio
 import json
 import random
@@ -20,19 +22,19 @@
 import csv
 import time
 import itertools
-from typing import Callable, Dict, List
+from typing import Callable, Dict, List, TYPE_CHECKING
 from datetime import datetime
 
 import numpy as np
 from tqdm.asyncio import tqdm as aio_tqdm
-import matplotlib.pyplot as plt
 
-from evoagentx.agents import CustomizeAgent
-from evoagentx.benchmark.bigbenchhard import BIGBenchHard
 from evoagentx.core.logging import logger
-from evoagentx.models import OpenAILLMConfig
 from evoagentx.optimizers.engine.base import BaseOptimizer
-from evoagentx.optimizers.engine.registry import ParamRegistry
+
+if TYPE_CHECKING:
+    from evoagentx.benchmark.bigbenchhard import BIGBenchHard
+    from evoagentx.models import OpenAILLMConfig
+    from evoagentx.optimizers.engine.registry import ParamRegistry
 
 
 class EvopromptOptimizer(BaseOptimizer):
@@ -77,6 +79,7 @@ def __init__(self,
         self.iterations = iterations
         self.llm_config = llm_config
         self.semaphore = asyncio.Semaphore(concurrency_limit)
+        self._program_config_lock = asyncio.Lock()
         self.combination_sample_size = combination_sample_size
 
         # Logging configuration
@@ -100,6 +103,7 @@ def __init__(self,
         self.avg_combo_scores_per_gen: Dict[str, float] = {}
         
         # Initialize paraphrase agent for prompt generation
+        from evoagentx.agents import CustomizeAgent
         self.paraphrase_agent = CustomizeAgent(
             name="ParaphraseAgent",
             description="An agent that paraphrases a given instruction.",
@@ -215,6 +219,8 @@ def _log_detailed_evaluation(self, generation: int, combinations: List[Dict[str,
     def _create_single_metric_plot(self, metric_name: str, generations: List[int],
                                    best_scores: List[float], avg_scores: List[float],
                                    algorithm_name: str, plot_dir: str):
+        import matplotlib.pyplot as plt
+
         fig, ax = plt.subplots(figsize=(12, 7))
         ax.plot(generations, best_scores, marker='o', linestyle='-', linewidth=2, markersize=8, label='Best Score')
         ax.plot(generations, avg_scores, marker='x', linestyle='--', linewidth=2, markersize=8, label='Average Score')
@@ -242,9 +248,12 @@ def _create_single_metric_plot(self, metric_name: str, generations: List[int],
             plt.close(fig)
 
     def _plot_and_save_performance_graph(self, algorithm_name: str):
-        if not self.enable_logging or plt is None:
-            if plt is None:
-                logger.warning("Matplotlib not found, skipping plot generation.")
+        if not self.enable_logging:
+            return
+        try:
+            import matplotlib.pyplot as plt
+        except ImportError:
+            logger.warning("Matplotlib not found, skipping plot generation.")
             return
         if not self.best_scores_per_gen and not self.best_combo_scores_per_gen:
             logger.warning("No performance data to plot.")
@@ -460,8 +469,7 @@ async def _evaluate_combination_list(self, combinations: List[Dict], benchmark:
         all_scores = []
         pbar = aio_tqdm(total=len(combinations), desc="Evaluating batch", leave=False)
         for combo in combinations:
-            tasks = [self._evaluate_combination_on_example(combo, benchmark, ex) for ex in eval_dev_set]
-            example_scores = await asyncio.gather(*tasks)
+            example_scores = await self._evaluate_combination_on_examples(combo, benchmark, eval_dev_set)
             avg_score = sum(example_scores) / len(example_scores) if example_scores else 0.0
             all_scores.append(avg_score)
             pbar.update(1)
@@ -507,47 +515,79 @@ def _generate_combinations(self, node_populations: Dict[str, List[str]]) -> List
         logger.info(f"Generated {len(sampled_combinations)} unique combinations")
         return sampled_combinations
 
-    async def _evaluate_combination_on_example(self, combination: Dict[str, str],
-                                             benchmark: BIGBenchHard, example: Dict) -> float:
+    def _get_eval_cache_key(self, combination: Dict[str, str], example: Dict):
         combo_key = tuple(sorted(combination.items()))
         example_key = str(hash(str(example)))
-        cache_key = hash((combo_key, example_key))
-
-        if not hasattr(self, '_eval_cache'):
-            self._eval_cache = {}
+        return hash((combo_key, example_key))
 
-        if cache_key in self._eval_cache:
-            return self._eval_cache[cache_key]
+    def _cache_eval_score(self, cache_key, score: float):
+        self._eval_cache[cache_key] = score
+        if len(self._eval_cache) > 5000:
+            keys_to_del = list(self._eval_cache.keys())[:1000]
+            fo
```

**File**: `tests/src/optimizers/test_evoprompt_state_isolation.py` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+import asyncio
+import threading
+
+import pytest
+
+from evoagentx.optimizers.engine.base import BaseOptimizer
+from evoagentx.optimizers.evoprompt_optimizer import EvopromptOptimizer
+
+
+class FakeBenchmark:
+    def get_input_keys(self):
+        return ["case"]
+
+    def get_label(self, example):
+        return example["target"]
+
+    def evaluate(self, prediction, label):
+        return {"em": float(prediction == label)}
+
+
+class RaisingBenchmark(FakeBenchmark):
+    def evaluate(self, prediction, label):
+        raise RuntimeError("evaluation failed")
+
+
+class SimpleProgram:
+    def __init__(self):
+        self.prompt = "base"
+
+    def __call__(self, case):
+        return self.prompt, {"case": case}
+
+
+class PromptRegistry:
+    def __init__(self, program):
+        self.program = program
+        self.fields = {"prompt": object()}
+
+    def get(self, name):
+        assert name == "prompt"
+        return self.program.prompt
+
+    def set(self, name, value):
+        assert name == "prompt"
+        self.program.prompt = value
+
+    def names(self):
+        return ["prompt"]
+
+
+class CoordinatedExampleProgram:
+    def __init__(self):
+        self._prompt = "base"
+        self.slow_started = threading.Event()
+        self.fast_returned = threading.Event()
+        self.base_restored_after_fast = threading.Event()
+        self.observed = {}
+
+    @property
+    def prompt(self):
+        return self._prompt
+
+    @prompt.setter
+    def prompt(self, value):
+        self._prompt = value
+        if value == "base" and self.fast_returned.is_set():
+            self.base_restored_after_fast.set()
+
+    def __call__(self, case):
+        if case == "fast":
+            self.slow_started.wait(timeout=1.0)
+            observed = self.prompt
+            self.observed[case] = observed
+            self.fast_returned.set()
+            return observed, {"case": case}
+
+        if case == "slow":
+            self.slow_started.set()
+            self.fast_returned.wait(timeout=1.0)
+            self.base_restored_after_fast.wait(timeout=0.05)
+            observed = self.prompt
+            self.observed[case] = observed
+            return observed, {"case": case}
+
+        observed = self.prompt
+        self.observed[case] = observed
+        return observed, {"case": case}
+
+
+class CrossCombinationProgram:
+    def __init__(self):
+        self.prompt = "base"
+        self.combo_a_entered = threading.Event()
+        self.combo_b_entered = threading.Event()
+        self.observed = []
+
+    def __call__(self, case):
+        initial_prompt = self.prompt
+        if initial_prompt == "combo-a":
+            self.combo_a_entered.set()
+            self.combo_b_entered.wait(timeout=0.05)
+        elif initial_prompt == "combo-b":
+            self.combo_b_entered.set()
+            self.combo_a_entered.wait(timeout=0.05)
+
+        observed = self.prompt
+        self.observed.append((case, initial_prompt, observed))
+        return observed, {"case": case}
+
+
+def make_optimizer(program, concurrency_limit=2):
+    registry = PromptRegistry(program)
+
+    class TestOptimizer(EvopromptOptimizer):
+        def __init__(self):
+            BaseOptimizer.__init__(self, registry=registry, program=program)
+            self.semaphore = asyncio.Semaphore(concurrency_limit)
+            self._program_config_lock = asyncio.Lock()
+            self._eval_cache = {}
+
+        async def optimize(self):
+            return None
+
+    return TestOptimizer()
+
+
+@pytest.mark.asyncio
+async def test_combination_config_is_kept_until_all_examples_finish():
+    program = CoordinatedExampleProgram()
+    optimizer = make_optimizer(program, concurrency_limit=2)
+    benchmark = FakeBenchmark()
+
+    scores = await optimizer._evaluate_combination_on_examples(
+        {"prompt": "optimized"},
+        benchmark,
+        [
+            {"case": "fast", "target": "optimized"},
+            {"case": "slow", "target": "optimized"},
+        ],
+    )
+
+    assert scores == [1.0, 1.0]
+    assert program.observed == {"fast": "optimized", "slow": "optimized"}
+    assert program.prompt == "base"
+
+
+@pytest.mark.asyncio
+async def test_combination_config_is_restored_after_evaluation_error():
+    program = SimpleProgram()
+    optimizer = make_optimizer(program)
+
+    scores = await optimizer._evaluate_combination_on_examples(
+        {"prompt": "optimized"},
+        RaisingBenchmark(),
+        [{"case": "single", "target": "optimized"}],
+    )
+
+    assert scores == [0.0]
+    assert program.prompt == "base"
+
+
+@pytest.mark.asyncio
+async def test_concurrent_combinations_do_not_share_temporary_config():
+    program = CrossCombinationProgram()
+    optimizer = make_optimizer(program, concurrency_limit=2)
+    benchmark = FakeBenchmark()
+
+    scores_a, scores_b = await asyncio.gather(
+        optimizer._evaluate_combination_list(
+            [{"prompt": "comb
```

---

### Incident Patch 3: `317a8dfc` (2026-06-28)
**Commit Message**: Merge pull request #263 from FBISiri/docs/fix-missing-os-import-readme

docs: add missing import os in OpenAI API key example

**File**: `README.md` (modified, +1/-0)
```diff
@@ -228,6 +228,7 @@ OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
 Once the API key is set, initialise the LLM with:
 
 ```python
+import os
 from evoagentx.models import OpenAILLMConfig, OpenAILLM
 
 # Load the API key from environment
```

---

### Incident Patch 4: `e0b4f5fc` (2026-06-27)
**Commit Message**: remove auto fix for json schema

**File**: `evoagentx/utils/utils.py` (modified, +0/-45)
```diff
@@ -359,51 +359,6 @@ def params_to_json(params: List[Parameter], ignore: List[str] = []) -> str:
     return params_json
 
 
-def fix_property_name(object: Any, json_schema: Dict) -> Any:
-    """
-    Recursively fixes the property names of `object` to match the provided JSON schema.
-    """
-    if object is None:
-        return object
-
-    if json_schema["type"] == "array" and json_schema["items"]["type"] == "object":
-        return [fix_property_name(item, json_schema["items"]) for item in object]
-
-    elif json_schema["type"] == "object":
-        fixed_object = dict()
-        properties = json_schema.get("properties")
-
-        if properties is None:
-            return object
-
-        for property_name, property_schema in properties.items():
-
-            if property_schema["type"] == "array":
-                property = object.get(property_name, None)
-                if property is not None:
-                    fixed_object[property_name] = [fix_property_name(item, property_schema["items"]) for item in property]
-
-            elif property_schema["type"] == "object":
-                property = object.get(property_name, None)
-                if property is not None:
-                    fixed_object[property_name] = fix_property_name(property, property_schema)
-
-            else:
-                object_properties_lower = {name.lower(): name for name in object}
-                schema_properties_lower = {name.lower(): name for name in properties}
-
-                for name in object_properties_lower:
-                    if name in schema_properties_lower:
-                        fixed_object[schema_properties_lower[name]] = object[object_properties_lower[name]]
-                    else:
-                        fixed_object[object_properties_lower[name]] = object[object_properties_lower[name]]
-
-        return fixed_object
-
-    else:
-        return object
-
-
 def resolve_json_schema_ref(json_schema: Any, root_schema: Optional[Dict] = None) -> Any:
     """
     Recursively resolve all $ref in a JSON schema.
```

**File**: `evoagentx/workflow/workflow.py` (modified, +2/-17)
```diff
@@ -2,7 +2,7 @@
 import traceback
 from copy import deepcopy
 from pydantic import Field, ValidationError, create_model
-from typing import Dict, Literal, Optional, List, Union
+from typing import Literal, Optional, List, Union
 from ..core.logging import logger
 from ..core.exception import DisplayableException, InputValidationError
 from ..core.module import BaseModule
@@ -19,7 +19,7 @@
 from .action_graph import ActionGraph
 from ..hitl import HITLManager, HITLBaseAgent
 from ..utils.async_utils import call_maybe_async, is_method_overridden, run_coroutine_sync
-from ..utils.utils import generate_dynamic_class_name, fix_property_name, format_validation_error
+from ..utils.utils import generate_dynamic_class_name, format_validation_error
 from ..actions import ActionInput, ActionOutput
 
 
@@ -193,26 +193,11 @@ async def _execute_workflow(self, inputs: Optional[dict] = None, extract_output:
             output: str = await self.workflow_manager.extract_output(graph=self.graph, env=self.environment)
         else:
             output: dict = self.environment.get_execution_data(self.output_names)
-            output = self._fix_outputs(output)
 
         self.graph.reset_graph()
         logger.info("Workflow execution completed successfully")
         return output
 
-    def _fix_outputs(self, outputs: Dict) -> Dict:
-        """
-        Recursively fixes the property names of the outputs to match the provided JSON schema.
-        """
-        outputs_copy = deepcopy(outputs)
-
-        for output_name, output in outputs_copy.items():
-            json_schema = self.graph.workflow_outputs_dict[output_name].json_schema
-
-            if json_schema:
-                outputs_copy[output_name] = fix_property_name(output, json_schema)
-
-        return outputs_copy
-
     def _validate_inputs(self, inputs: dict):
         workflow_inputs = [param.to_dict(ignore=["class_name"]) for param in self.graph.workflow_inputs]
         input_validator = CustomizeAgent.create_action_input(workflow_inputs, "workflow_inputs")
```

**File**: `evoagentx/workflow/workflow_graph.py` (modified, +46/-145)
```diff
@@ -300,7 +300,7 @@ def get_output_names(self, required: bool = False) -> List[str]:
         else:
             return [param.name for param in self.outputs]
 
-    def check_agents(self, auto_fix: bool = False):
+    def check_agents(self):
         """
         Checks if any agent assigned to this node accept the node inputs and if any agent outputs the node outputs.
         """
@@ -333,25 +333,17 @@ def _check_agent_dict(agent_dict: dict, inputs_or_outputs: Literal["inputs", "ou
             # "input" or "output"
             input_or_output = inputs_or_outputs[:-1]
 
-            for i, agent_input_or_output in enumerate(agent_dict[inputs_or_outputs]):
+            for agent_input_or_output in agent_dict[inputs_or_outputs]:
                 if agent_input_or_output["name"] in node_inputs_outputs[inputs_or_outputs]:
                     in_agents[inputs_or_outputs][agent_input_or_output["name"]] = True
                     agent_input_or_output_param = Parameter(**agent_input_or_output)
-                    try:
-                        validate_param(
-                            node_inputs_outputs[inputs_or_outputs][agent_input_or_output["name"]],
-                            agent_input_or_output_param,
-                            f"node '{self.name}' {input_or_output}",
-                            f"agent '{agent_dict['name']}' {input_or_output}",
-                        )
-                    except ValueError as e:
-                        if auto_fix:
-                            logger.warning(e)
-                            logger.info(f"Auto-fixed agent '{agent_dict['name']}' {input_or_output}: '{agent_input_or_output['name']}'")
-                            agent_dict[inputs_or_outputs][i] = node_inputs_outputs[inputs_or_outputs][agent_input_or_output["name"]].to_dict(ignore=["class_name"])
-                        else:
-                            raise
-            
+                    validate_param(
+                        node_inputs_outputs[inputs_or_outputs][agent_input_or_output["name"]],
+                        agent_input_or_output_param,
+                        f"node '{self.name}' {input_or_output}",
+                        f"agent '{agent_dict['name']}' {input_or_output}",
+                    )
+
             return agent_dict
 
 
@@ -374,23 +366,15 @@ def _check_agent(agent: Agent, inputs_or_outputs: Literal["inputs", "outputs"])
                 
                 action_params = pydantic_to_parameters(action_format, ignore=ignore)
 
-                for j, param in enumerate(action_params):
+                for param in action_params:
                     if param.name in node_inputs_outputs[inputs_or_outputs]:
                         in_agents[inputs_or_outputs][param.name] = True
-                        try:
-                            validate_param(
-                                node_inputs_outputs[inputs_or_outputs][param.name],
-                                param,
-                                f"node '{self.name}' {input_or_output}",
-                                f"agent action '{agent_actions.name}' {input_or_output}",
-                            )
-                        except ValueError as e:
-                            if auto_fix:
-                                logger.warning(e)
-                                logger.info(f"Auto-fixed agent action '{agent_actions.name}' {inputs_or_outputs}: '{param.name}'")
-                                action_params[j] = node_inputs_outputs[inputs_or_outputs][param.name]
-                            else:
-                                raise
+                        validate_param(
+                            node_inputs_outputs[inputs_or_outputs][param.name],
+                            param,
+                            f"node '{self.name}' {input_or_output}",
+                            f"agent action '{agent_actions.name}' {input_or_output}",
+                        )
 
                 action_params = [param.to_dict(ignore=["class_name"]) for param in action_params]
                 if inputs_or_outputs == "inputs":                      
@@ -405,30 +389,17 @@ def _check_customize_agent(agent: CustomizeAgent, inputs_or_outputs: Literal["in
             # input or output
             input_or_output = inputs_or_outputs[:-1]
 
-            new_inputs_or_outputs = []
-
-            for i, agent_input_or_output in enumerate(getattr(agent, inputs_or_outputs)):
-                new_inputs_or_outputs.append(agent_input_or_output)
-
+            for agent_input_or_output in getattr(agent, inputs_or_outputs):
                 param_name = agent_input_or_output.name
                 if param_name in node_inputs_outputs[inputs_or_outputs]:
                     in_agents[inputs_or_outputs][param_name] = True
-                    try:
-                        validate_param(
-                            node_inputs_outputs[inputs_or_outputs][param_name],
-                            agent_input_or_
```

**File**: `tests/src/workflow/test_workflow_graph.py` (modified, +4/-110)
```diff
@@ -499,91 +499,23 @@ def test_node_output_uniqueness(self):
                 workflow_outputs=[Parameter(name="workflow_out", type="string", description="desc")]
             )
 
-    def test_auto_fix_mismatched_params(self):
-        """Test that auto_fix correctly updates node parameters to match workflow/agent parameters."""
-        # Create a node with a mismatched type compared to workflow input
+    def test_mismatched_params_raise(self):
+        """A node parameter that mismatches the workflow parameter (type/required) must raise."""
         mismatched_node = WorkFlowNode(
             name="MismatchedNode",
             description="test",
             inputs=[Parameter(name="input", type="number", description="desc", required=False)], # Should be string, required=True
             outputs=[Parameter(name="output", type="boolean", description="desc")],
             agents=["TestAgent"]
         )
-        
-        # This should fail without auto_fix
+
         with pytest.raises(ValueError):
             WorkFlowGraph(
-                goal="Test Auto-fix",
+                goal="Test mismatch",
                 nodes=[mismatched_node],
                 workflow_inputs=[Parameter(name="input", type="string", description="desc", required=True)],
                 workflow_outputs=[Parameter(name="output", type="string", description="desc")],
             )
-            
-        graph = WorkFlowGraph(
-            goal="Test Auto-fix",
-            nodes=[mismatched_node],
-            workflow_inputs=[Parameter(name="input", type="string", description="desc", required=True)],
-            workflow_outputs=[Parameter(name="output", type="string", description="desc")],
-            auto_fix=True
-        )
-        
-        # Verify it was fixed
-        fixed_input = graph.get_node("MismatchedNode").inputs[0]
-        self.assertEqual(fixed_input.type, "string")
-        self.assertTrue(fixed_input.required)
-
-        fixed_output = graph.get_node("MismatchedNode").outputs[0]
-        self.assertEqual(fixed_output.type, "string")
-        self.assertTrue(fixed_output.required)
-
-    def test_auto_fix_mismatched_params_from_dict(self):
-        """Test that auto_fix correctly updates node parameters when using WorkFlowGraph.from_dict."""
-
-        graph_dict = {
-            "goal": "Test Auto-fix",
-            "nodes": [{
-                "name": "MismatchedNode",
-                "description": "test",
-                "inputs": [{"name": "input", "type": "number", "description": "desc", "required": False}],
-                "outputs": [{"name": "output", "type": "boolean", "description": "desc"}],
-                "agents": [
-                    {
-                        "name": "TestAgent",
-                        "description": "test",
-                        "inputs": [{"name": "input", "type": "integer", "description": "desc", "required": False}],
-                        "outputs": [{"name": "output", "type": "number", "description": "desc", "required": False}],
-                        "prompt_template": {
-                            "class_name": "ChatTemplate",
-                            "instruction": "instruction"
-                        }
-                    }
-                ]
-            }],
-            "workflow_inputs": [{"name": "input", "type": "string", "description": "desc", "required": True}],
-            "workflow_outputs": [{"name": "output", "type": "string", "description": "desc"}],
-        }
-        
-        graph = WorkFlowGraph.from_dict(graph_dict, auto_fix=True)
-
-        # Verify it was fixed
-        fixed_node_input = graph.get_node("MismatchedNode").inputs[0]
-        self.assertEqual(fixed_node_input.type, "string")
-        self.assertTrue(fixed_node_input.required)
-
-        fixed_node_output = graph.get_node("MismatchedNode").outputs[0]
-        self.assertEqual(fixed_node_output.type, "string")
-        self.assertTrue(fixed_node_output.required)
-
-        # from_dict no longer instantiates agents: they stay as dicts and are
-        # materialized later by AgentManager. auto_fix still reconciles the agent
-        # dict's parameters with the node parameters in place.
-        fixed_agent_input = graph.get_node("MismatchedNode").agents[0]["inputs"][0]
-        self.assertEqual(fixed_agent_input["type"], "string")
-        self.assertTrue(fixed_agent_input["required"])
-
-        fixed_agent_output = graph.get_node("MismatchedNode").agents[0]["outputs"][0]
-        self.assertEqual(fixed_agent_output["type"], "string")
-        self.assertTrue(fixed_agent_output["required"])
 
     def test_json_schema_cannot_be_dropped_downstream(self):
         """A node/agent cannot omit a schema declared by the workflow output."""
@@ -618,44 +550,6 @@ def test_json_schema_cannot_be_dropped_downstream(self):
         with pytest.raises(Exception, match="json_schema"):
             WorkFlowGraph.from_dict(graph_dict)
 
-    def test_auto_fix_propa
```

---

### Incident Patch 5: `23107114` (2026-06-27)
**Commit Message**: fix get_next_task None handling

**File**: `evoagentx/workflow/workflow.py` (modified, +5/-2)
```diff
@@ -238,12 +238,15 @@ def _prepare_inputs(self, inputs: dict) -> dict:
             
         return inputs 
     
-    async def get_next_task(self) -> WorkFlowNode:
+    async def get_next_task(self) -> Optional[WorkFlowNode]:
         task_execution_history = " -> ".join(self.environment.task_execution_history)
         if not task_execution_history:
             task_execution_history = "None"
         logger.info(f"Task Execution Trajectory: {task_execution_history}. Scheduling next subtask ...")
-        task: WorkFlowNode = await self.workflow_manager.schedule_next_task(graph=self.graph, env=self.environment)
+        task: Optional[WorkFlowNode] = await self.workflow_manager.schedule_next_task(graph=self.graph, env=self.environment)
+        if task is None:
+            logger.info("No next subtask could be scheduled (the scheduler returned None).")
+            return None
         logger.info(f"The next subtask to be executed is: {task.name}")
         return task
         
```

---

### Incident Patch 6: `72a5502a` (2026-06-27)
**Commit Message**: fix edge priority issue

**File**: `evoagentx/workflow/workflow_graph.py` (modified, +30/-6)
```diff
@@ -748,11 +748,12 @@ def _init_from_nodes(self, nodes: List[WorkFlowNode] = [], explicit_edges: Optio
         a name with an input of B.
 
         Any user-provided `explicit_edges` are merged *in addition to* the inferred edges
-        (deduplicated by `(source, target)`), so explicit edges supplement — but never replace —
-        the inferred data-flow topology. This lets users express ordering dependencies that carry
-        no shared data, while wrong/incomplete explicit edges can no longer silently break the graph.
-        Explicit edges referencing unknown nodes raise; explicit edges with no matching input/output
-        are kept but emit a warning (see `add_edge`).
+        (deduplicated by `(source, target)`). If an explicit edge has the same `(source, target)`
+        as an inferred edge, the explicit edge replaces the inferred edge's metadata (e.g.
+        `priority`) while preserving the inferred data-flow topology. This lets users express
+        ordering dependencies that carry no shared data, while wrong/incomplete explicit edges can
+        no longer silently break the graph. Explicit edges referencing unknown nodes raise;
+        explicit edges with no matching input/output are kept but emit a warning (see `add_edge`).
         """
         self.nodes = []
         self.edges = []
@@ -767,11 +768,34 @@ def _init_from_nodes(self, nodes: List[WorkFlowNode] = [], explicit_edges: Optio
             for edge in explicit_edges:
                 pair = (edge.source, edge.target)
                 if pair in seen_pairs:
+                    self._replace_edge_by_pair(edge)
                     continue
                 seen_pairs.add(pair)
                 extra_edges.append(edge)
             self.add_edges(*extra_edges, update_graph=False)
 
+    def _replace_edge_by_pair(self, edge: WorkFlowEdge) -> bool:
+        """
+        Replace an existing edge with the same source/target pair, preserving one edge
+        in both `self.edges` and the underlying NetworkX graph.
+        """
+        if not isinstance(edge, WorkFlowEdge):
+            raise ValueError(f"{edge} is not a valid WorkFlowEdge instance!")
+
+        for i, existing_edge in enumerate(self.edges):
+            if existing_edge.source != edge.source or existing_edge.target != edge.target:
+                continue
+
+            self.edges[i] = edge
+            edge_data = self.graph.get_edge_data(edge.source, edge.target, default={})
+            for attrs in edge_data.values():
+                ref = attrs.get("ref")
+                if isinstance(ref, WorkFlowEdge) and ref.source == edge.source and ref.target == edge.target:
+                    attrs["ref"] = edge
+                    return True
+            return True
+        return False
+
     def _init_from_multidigraph(self, graph: MultiDiGraph, nodes: List[WorkFlowNode] = []):
         graph_nodes = [deepcopy(node_attrs["ref"]) for _, node_attrs in graph.nodes(data=True)]
         graph_edges = [deepcopy(edge_attrs["ref"]) for *_, edge_attrs in graph.edges(data=True)]
@@ -1879,4 +1903,4 @@ class SEWWorkFlowGraph(SequentialWorkFlowGraph):
     def __init__(self, **kwargs):
         goal = kwargs.pop("goal", SEW_WORKFLOW["goal"])
         tasks = kwargs.pop("tasks", SEW_WORKFLOW["tasks"])
-        super().__init__(goal=goal, tasks=tasks, **kwargs)
\ No newline at end of file
+        super().__init__(goal=goal, tasks=tasks, **kwargs)
```

**File**: `tests/src/workflow/test_workflow_graph.py` (modified, +36/-0)
```diff
@@ -689,6 +689,42 @@ def make_agent(name, in_name, out_name):
         next_tasks = graph.next()
         self.assertEqual(["A"], [task.name for task in next_tasks])
 
+    def test_explicit_edge_priority_overrides_inferred_edge_priority(self):
+        """When an explicit edge matches an inferred data-flow edge, preserve the explicit metadata."""
+        graph_dict = {
+            "goal": "Test Explicit Edge Priority",
+            "nodes": [
+                {
+                    "name": "A",
+                    "description": "source",
+                    "inputs": [{"name": "wf_in", "type": "string", "description": "desc"}],
+                    "outputs": [{"name": "outA", "type": "string", "description": "desc"}],
+                    "agents": ["AgentA"],
+                },
+                {
+                    "name": "B",
+                    "description": "target",
+                    "inputs": [{"name": "outA", "type": "string", "description": "desc"}],
+                    "outputs": [{"name": "outB", "type": "string", "description": "desc"}],
+                    "agents": ["AgentB"],
+                },
+            ],
+            # A -> B is also inferred from outA, but the explicit priority must win.
+            "edges": [{"source": "A", "target": "B", "priority": 7}],
+            "workflow_inputs": [{"name": "wf_in", "type": "string", "description": "desc"}],
+            "workflow_outputs": [{"name": "outB", "type": "string", "description": "desc"}],
+        }
+
+        graph = WorkFlowGraph.from_dict(graph_dict)
+
+        self.assertEqual([("A", "B", 7)], [(edge.source, edge.target, edge.priority) for edge in graph.edges])
+        graph_edge_refs = [
+            attrs["ref"]
+            for source, target, attrs in graph.graph.edges(data=True)
+            if source == "A" and target == "B"
+        ]
+        self.assertEqual([7], [edge.priority for edge in graph_edge_refs])
+
     def test_to_dict_supports_string_and_dict_agents(self):
         """get_config()/to_dict() must support string agents and convert a callable
         parse_func in a dict agent to its function name (JSON-serializable)."""
```

---

### Incident Patch 7: `235f5d5d` (2026-06-27)
**Commit Message**: fix workflow graph

**File**: `evoagentx/utils/utils.py` (modified, +10/-6)
```diff
@@ -282,7 +282,12 @@ def validate_param(
     actual_params_name: str,
 ):
     """
-    Checks if `actual_param` has the same type, required, description and json_schema value as `required_param`.
+    Checks if `actual_param` is compatible with `required_param`.
+
+    Only the attributes that affect runtime behavior are strictly enforced: `type` and
+    `required`. `description` is free-form text and is not compared. `json_schema` is
+    compared softly — only when both params provide one (matching `Parameter`'s own
+    "provide to validate, omit to skip" semantics).
     """
 
     def format_error_msg(
@@ -306,11 +311,10 @@ def format_error_msg(
     if required_param.required != actual_param.required:
         raise ValueError(format_error_msg("required", required_param.required, actual_param.required))
 
-    if required_param.description != actual_param.description:
-        raise ValueError(format_error_msg("description", required_param.description, actual_param.description))
-
-    if required_param.json_schema != actual_param.json_schema:
-        raise ValueError(format_error_msg("json_schema", required_param.json_schema, actual_param.json_schema))
+    # `json_schema` is optional: only enforce it when both sides provide one.
+    if required_param.json_schema is not None and actual_param.json_schema is not None:
+        if required_param.json_schema != actual_param.json_schema:
+            raise ValueError(format_error_msg("json_schema", required_param.json_schema, actual_param.json_schema))
 
 
 def format_validation_error(error: ValidationError) -> str:
```

**File**: `evoagentx/workflow/workflow_graph.py` (modified, +38/-10)
```diff
@@ -172,13 +172,19 @@ async def patched_async_execute(*args, **kwargs):
 
     def to_dict(self, exclude_none: bool = True, ignore: List[str] = [], **kwargs) -> dict:
         
-        agents_dict: List[dict] = []
+        agents_dict: List[Union[str, dict]] = []
         if self.agents:
             for agent in self.agents:
-                if isinstance(agent, Agent):
+                if isinstance(agent, str):
+                    agents_dict.append(agent)
+                elif isinstance(agent, Agent):
                     agents_dict.append(agent.get_config())
                 elif isinstance(agent, dict):
-                    agents_dict.append(recursive_to_dict(agent))
+                    agent_dict = recursive_to_dict(agent)
+                    # for CustomizeAgent: a callable parse_func is not serializable, store its name
+                    if "parse_func" in agent_dict and callable(agent_dict["parse_func"]):
+                        agent_dict["parse_func"] = agent_dict["parse_func"].__name__
+                    agents_dict.append(agent_dict)
                 else:
                     raise TypeError(f"'{type(agent)}' is an unknown agent type!")
 
@@ -632,21 +638,33 @@ def init_module(self):
         else:
             raise TypeError(f"{type(self.graph)} is an unknown type for graph. Supported types: [MultiDiGraph, WorkFlowGraph]")
         
+        def _dedup_params(params: List[Parameter]) -> List[Parameter]:
+            # Multiple initial/end nodes may share a parameter name (e.g. a common workflow
+            # input). Keep the first occurrence so the derived list passes the uniqueness check.
+            seen = set()
+            deduped = []
+            for param in params:
+                if param.name in seen:
+                    continue
+                seen.add(param.name)
+                deduped.append(param)
+            return deduped
+
         # If `workflow_inputs` is not provided, set it to the inputs of initial nodes
         if self.workflow_inputs is None:
             initial_nodes = [node for node, in_degree in self.graph.in_degree() if in_degree==0]
             workflow_inputs = []
             for node_name in initial_nodes:
                 workflow_inputs.extend(self.get_node(node_name).inputs)
-            self.workflow_inputs = workflow_inputs
+            self.workflow_inputs = _dedup_params(workflow_inputs)
 
         # If `workflow_outputs` is not provided, set it to the outputs of end nodes
         if self.workflow_outputs is None:
             end_nodes = [node for node, out_degree in self.graph.out_degree() if out_degree==0]
             workflow_outputs = []
             for node_name in end_nodes:
                 workflow_outputs.extend(self.get_node(node_name).outputs)
-            self.workflow_outputs = workflow_outputs
+            self.workflow_outputs = _dedup_params(workflow_outputs)
 
         self.workflow_inputs_dict = {param.name: param for param in self.workflow_inputs}
         self.workflow_outputs_dict = {param.name: param for param in self.workflow_outputs}
@@ -1351,11 +1369,17 @@ def filter_nodes_with_uncompleted_predecessors(self, nodes: List[Union[str, Work
 
     def get_next_candidate_nodes(self) -> List[str]:
 
+        # `find_initial_nodes` classifies a node as initial purely from data readiness
+        # (its required inputs are a subset of the workflow inputs). A node can satisfy that
+        # while still having incoming edges — an explicit control edge, or an inferred edge
+        # feeding one of its optional inputs. Those nodes must not start before their
+        # predecessors, so filter the initial candidates by predecessor completion as well.
         uncomplete_initial_nodes = self.get_uncomplete_initial_nodes()
-        if len(uncomplete_initial_nodes) > 0:
-            return uncomplete_initial_nodes
-        
-        # find the last completed nodes in all paths starting from initial nodes. 
+        ready_initial_nodes = self.filter_nodes_with_uncompleted_predecessors(uncomplete_initial_nodes)
+        if len(ready_initial_nodes) > 0:
+            return ready_initial_nodes
+
+        # find the last completed nodes in all paths starting from initial nodes.
         completed_leaf_nodes = self.find_completed_leaf_nodes_start_from_initial_nodes()
 
         # obtain children nodes of last completed nodes which are uncompleted (consider previous completed tasks if there exists loops)
@@ -1692,10 +1716,14 @@ def from_dict(
         workflow_inputs = BaseModule._process_data(workflow_dict.get("workflow_inputs", []))
         workflow_outputs = BaseModule._process_data(workflow_dict.get("workflow_outputs", []))
         nodes = BaseModule._process_data(workflow_dict.get("nodes", []))
-        
+        # Pass the serialized edges so explicit control dependencies (edges with no shared
+        # input/output, which cannot be re-inferred from data flow) survive a save/load round-trip.
+        edges = BaseMo
```

**File**: `tests/src/utils/test_validate_param.py` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+import unittest
+
+from evoagentx.core.base_config import Parameter
+from evoagentx.utils.utils import validate_param
+
+
+class TestValidateParam(unittest.TestCase):
+
+    def _validate(self, required: Parameter, actual: Parameter):
+        validate_param(required, actual, "node", "agent")
+
+    def test_differing_description_is_allowed(self):
+        """Description is free-form text and must not cause a validation failure."""
+        required = Parameter(name="p", type="string", description="node-side wording")
+        actual = Parameter(name="p", type="string", description="agent-side wording")
+        # Should not raise.
+        self._validate(required, actual)
+
+    def test_type_mismatch_raises(self):
+        required = Parameter(name="p", type="string", description="d")
+        actual = Parameter(name="p", type="integer", description="d")
+        with self.assertRaises(ValueError):
+            self._validate(required, actual)
+
+    def test_required_mismatch_raises(self):
+        required = Parameter(name="p", type="string", description="d", required=True)
+        actual = Parameter(name="p", type="string", description="d", required=False)
+        with self.assertRaises(ValueError):
+            self._validate(required, actual)
+
+    def test_json_schema_skipped_when_one_side_missing(self):
+        """json_schema is soft: if either side omits it, it is not compared."""
+        schema = {"type": "object", "properties": {"a": {"type": "string"}}}
+        required = Parameter(name="p", type="object", description="d", json_schema=schema)
+        actual = Parameter(name="p", type="object", description="d")  # no json_schema
+        # Should not raise.
+        self._validate(required, actual)
+        # Other direction too.
+        self._validate(actual, required)
+
+    def test_json_schema_enforced_when_both_provided(self):
+        required = Parameter(
+            name="p", type="object", description="d",
+            json_schema={"type": "object", "properties": {"a": {"type": "string"}}},
+        )
+        actual = Parameter(
+            name="p", type="object", description="d",
+            json_schema={"type": "object", "properties": {"a": {"type": "integer"}}},
+        )
+        with self.assertRaises(ValueError):
+            self._validate(required, actual)
+
+    def test_json_schema_match_passes(self):
+        schema = {"type": "object", "properties": {"a": {"type": "string"}}}
+        required = Parameter(name="p", type="object", description="d", json_schema=dict(schema))
+        actual = Parameter(name="p", type="object", description="d", json_schema=dict(schema))
+        # Should not raise.
+        self._validate(required, actual)
+
+
+if __name__ == "__main__":
+    unittest.main()
```

**File**: `tests/src/workflow/test_workflow_graph.py` (modified, +196/-0)
```diff
@@ -216,6 +216,90 @@ def test_fork_join_execution(self):
         next_tasks = self.fork_join_graph.next()
         self.assertEqual(0, len(next_tasks))
     
+    def test_control_edge_not_executed_in_parallel(self):
+        """An explicit control edge (A -> B with no shared data) must be respected even
+        when B's required inputs are all workflow inputs and therefore B is data-initial."""
+        node_a = WorkFlowNode(
+            name="A",
+            description="control source",
+            inputs=[Parameter(name="input1", type="string", description="workflow input")],
+            outputs=[Parameter(name="outputA", type="string", description="output A")],
+            agents=["TestAgent"],
+        )
+        node_b = WorkFlowNode(
+            name="B",
+            description="control target",
+            inputs=[Parameter(name="input1", type="string", description="workflow input")],
+            outputs=[Parameter(name="outputB", type="string", description="output B")],
+            agents=["TestAgent"],
+        )
+        graph = WorkFlowGraph(
+            goal="Control Edge Workflow",
+            nodes=[node_a, node_b],
+            edges=[WorkFlowEdge(source="A", target="B")],
+            workflow_inputs=[Parameter(name="input1", type="string", description="workflow input")],
+            workflow_outputs=[
+                Parameter(name="outputA", type="string", description="output A"),
+                Parameter(name="outputB", type="string", description="output B"),
+            ],
+        )
+
+        # Both A and B are data-initial, but only A may run first.
+        self.assertEqual({"A", "B"}, set(graph.find_initial_nodes()))
+        next_tasks = graph.next()
+        self.assertEqual(1, len(next_tasks))
+        self.assertEqual("A", next_tasks[0].name)
+
+        graph.set_node_status("A", WorkFlowNodeState.COMPLETED)
+        next_tasks = graph.next()
+        self.assertEqual(1, len(next_tasks))
+        self.assertEqual("B", next_tasks[0].name)
+
+    def test_optional_input_edge_respects_dependency(self):
+        """An inferred edge feeding an optional input must be respected even though the
+        target's required inputs are all workflow inputs (so it is data-initial)."""
+        node_a = WorkFlowNode(
+            name="A",
+            description="optional source",
+            inputs=[Parameter(name="input1", type="string", description="workflow input")],
+            outputs=[Parameter(name="outA", type="string", description="output A")],
+            agents=["TestAgent"],
+        )
+        node_b = WorkFlowNode(
+            name="B",
+            description="optional target",
+            inputs=[
+                Parameter(name="input1", type="string", description="workflow input"),
+                Parameter(name="outA", type="string", description="optional from A", required=False),
+            ],
+            outputs=[Parameter(name="outputB", type="string", description="output B")],
+            agents=["TestAgent"],
+        )
+        graph = WorkFlowGraph(
+            goal="Optional Input Workflow",
+            nodes=[node_a, node_b],
+            workflow_inputs=[Parameter(name="input1", type="string", description="workflow input")],
+            workflow_outputs=[
+                Parameter(name="outA", type="string", description="output A"),
+                Parameter(name="outputB", type="string", description="output B"),
+            ],
+        )
+
+        # The A -> B edge is inferred from the shared `outA` name (B's optional input).
+        edge_pairs = [(edge.source, edge.target) for edge in graph.edges]
+        self.assertIn(("A", "B"), edge_pairs)
+
+        # B is data-initial (only required input is the workflow input) but must wait for A.
+        self.assertEqual({"A", "B"}, set(graph.find_initial_nodes()))
+        next_tasks = graph.next()
+        self.assertEqual(1, len(next_tasks))
+        self.assertEqual("A", next_tasks[0].name)
+
+        graph.set_node_status("A", WorkFlowNodeState.COMPLETED)
+        next_tasks = graph.next()
+        self.assertEqual(1, len(next_tasks))
+        self.assertEqual("B", next_tasks[0].name)
+
     def test_cycle_detection(self):
         """Test cycle detection in a workflow."""
         # The cycle graph should identify a loop
@@ -460,6 +544,118 @@ def test_auto_fix_mismatched_params_from_dict(self):
         self.assertEqual(fixed_agent_output.type, "string")
         self.assertTrue(fixed_agent_output.required)
 
+    def test_from_dict_preserves_explicit_edges(self):
+        """Explicit control edges (no shared input/output) must survive a from_dict round-trip;
+        they cannot be re-inferred from data flow."""
+
+        def make_agent(name, in_name, out_name):
+            return {
+                "name": name,
+                "description": "test",
+                "inputs": [{"name": in_name, "type": "string", "description": "desc"}],
+                "outputs": [
```

---

### Incident Patch 8: `adcf8e41` (2026-06-26)
**Commit Message**: fix pytest errors

**File**: `evoagentx/actions/customize_action.py` (modified, +14/-5)
```diff
@@ -72,8 +72,6 @@ def __init__(self, **kwargs):
             self.add_tools(tools)
         self.tool_schemas: List[dict] = compile_tool_schemas(self.tools)
 
-        self.semaphore = asyncio.Semaphore(self.max_tool_call_concurrency)
-
     def prepare_extraction_prompt(self, llm_output_content: str) -> str:
         """Prepare extraction prompt for fallback extraction when parsing fails.
 
@@ -244,7 +242,11 @@ async def _async_extract_output(self, llm_output: Union[str, LLMOutputParser], l
             output = self.outputs_format(**llm_extracted_data)
             return output
 
-    async def _call_single_tool(self, function_param: dict) -> ToolResult:
+    async def _call_single_tool(self, function_param: dict, semaphore: Optional[asyncio.Semaphore] = None) -> ToolResult:
+        # When called outside of `_calling_tools` (e.g. directly in tests), create a
+        # loop-bound semaphore on the fly so concurrency limiting still applies.
+        if semaphore is None:
+            semaphore = asyncio.Semaphore(self.max_tool_call_concurrency)
         tool_call_id = function_param.get("id")
         function_name = function_param.get("function_name") or ""
         function_args = function_param.get("function_args") or {}
@@ -268,7 +270,7 @@ async def _call_single_tool(self, function_param: dict) -> ToolResult:
             return ToolResult(result=output, metadata=metadata, id=tool_call_id)
 
         try:
-            async with self.semaphore:
+            async with semaphore:
                 tool_args_str = json.dumps(function_args, indent=4, ensure_ascii=False)
                 logger.info(f"[Tool Call] Executing tool `{function_name}` with parameters:\n{tool_args_str}")
 
@@ -289,8 +291,15 @@ async def _call_single_tool(self, function_param: dict) -> ToolResult:
             return ToolResult(result={"error": str(e)}, metadata=metadata, id=tool_call_id)
 
     async def _calling_tools(self, tool_call_args: List[dict]) -> List[ToolResult]:
+        # Create the semaphore inside the running event loop. `asyncio.Semaphore`
+        # binds to the loop on first await, so a long-lived instance attribute would
+        # be reused across the fresh loops that `execute()` spins up via
+        # `asyncio.run()` / the thread-pool loop, raising "Semaphore is bound to a
+        # different event loop". A per-call semaphore is loop-safe and still bounds
+        # concurrency within a single tool-calling round.
+        semaphore = asyncio.Semaphore(self.max_tool_call_concurrency)
         tasks = [
-            self._call_single_tool(args)
+            self._call_single_tool(args, semaphore)
             for args in tool_call_args
         ]
 
```

**File**: `pyproject.toml` (modified, +4/-0)
```diff
@@ -91,6 +91,9 @@ tools = [
 multimodal = [
     "torch",
     "datasets>=3.4.0",
+    # Transitive dep of `datasets`; 0.70.18+ resource_tracker raises a harmless
+    # AttributeError at shutdown on some Python builds. Pin below it.
+    "multiprocess<0.70.18",
     "voyageai"
 ]
 optimizers = [
@@ -147,6 +150,7 @@ all = [
     "google-auth-httplib2>=0.1.0",
     "torch",
     "datasets>=3.4.0",
+    "multiprocess<0.70.18",
     "voyageai",
     "textgrad>=0.1.8",
     "dspy",
```

**File**: `requirements.txt` (modified, +4/-0)
```diff
@@ -70,6 +70,10 @@ google-auth-httplib2>=0.1.0
 # multimodal
 # torch  # uncomment and pin as needed, e.g. for cu118: --extra-index-url https://download.pytorch.org/whl/cu118
 datasets>=3.4.0
+# Pulled in transitively by `datasets`. 0.70.18+ resource_tracker calls
+# RLock._recursion_count(), which is absent on some Python builds, raising a
+# harmless AttributeError at interpreter shutdown. Pin below it to avoid the noise.
+multiprocess<0.70.18
 voyageai
 
 # optimizers
```

---

### Incident Patch 9: `7583895c` (2026-06-23)
**Commit Message**: add json schema auto fix in LLMOutputParser

**File**: `evoagentx/models/base_model.py` (modified, +127/-6)
```diff
@@ -6,14 +6,15 @@
 from abc import ABC, abstractmethod
 from collections.abc import Callable
 from copy import copy, deepcopy
-from typing import Any, Dict, List, Optional, Type, Union
+from typing import Any, ClassVar, Dict, List, Optional, Type, Union
 
 import yaml
 from jsonschema import Draft7Validator
 from jsonschema.exceptions import ValidationError as JSONSchemaValidationError
 from pydantic import Field, model_validator
 from pydantic_core import PydanticUndefined
 
+from ..core.logging import logger
 from ..core.module_utils import (
     extract_code_blocks,
     get_type_name,
@@ -39,6 +40,7 @@ class LLMOutputParser(Parser):
         content: The raw text generated by the LLM.
     """
     content: str = Field(default=None, exclude=True, description=RAW_LLM_OUTPUT_DESCRIPTION)
+    fix_json_schema_error: ClassVar[bool] = False
 
     def init_module(self):
         if "_raw_llm_output" in self.kwargs:
@@ -60,8 +62,10 @@ def json_schema_validation(cls, data: dict) -> dict:
                 final_data = remove_none(final_data)
                 validator.validate(final_data)
             except JSONSchemaValidationError as e:
-                raise ValueError(e)
-                
+                if not cls.fix_json_schema_error:
+                    raise ValueError(e)
+                final_data = LLMOutputParser.fix_data_on_validation_fail(validator, final_data)
+
         else:
             for field_name, field_info in cls.model_fields.items():
 
@@ -73,10 +77,128 @@ def json_schema_validation(cls, data: dict) -> dict:
                         try:
                             validator.validate(field_value)
                         except JSONSchemaValidationError as e:
-                            raise ValueError(e)
+                            if not cls.fix_json_schema_error:
+                                raise ValueError(e)
+                            field_value = LLMOutputParser.fix_data_on_validation_fail(validator, field_value)
+                            final_data[field_name] = field_value
 
         return final_data
-    
+
+
+    @staticmethod
+    def fix_data_on_validation_fail(validator, data: dict) -> dict:
+        """Attempts to fix JSON schema validation errors by modifying the data.
+
+        Args:
+            validator: The JSON schema validator.
+            data: The data to fix.
+
+        Returns:
+            The modified data.
+        """
+        fixed_data = deepcopy(data)
+
+        try:
+            fixed_data = LLMOutputParser._recursive_fix(fixed_data, validator.schema)
+        except Exception as e:
+            logger.exception(f"Failed to fix data on JSON schema validation fail. {e}")
+            pass
+
+        try:
+            validator.validate(fixed_data)
+        except JSONSchemaValidationError as e:
+            raise ValueError(e)
+
+        return fixed_data
+
+
+    @staticmethod
+    def _recursive_fix(data: dict, schema: dict) -> dict:
+        """Recursively fixes data against schema."""
+        if schema is None:
+            return data
+
+        # 1. Fix children first (Bottom-Up)
+        if isinstance(data, dict) and "properties" in schema:
+            for k, sub_schema in schema["properties"].items():
+                if k in data:
+                    data[k] = LLMOutputParser._recursive_fix(data[k], sub_schema)
+
+        elif isinstance(data, list) and "items" in schema:
+            items_schema = schema["items"]
+            for i in range(len(data)):
+                data[i] = LLMOutputParser._recursive_fix(data[i], items_schema)
+
+        # 2. Validate and fix current level
+        # Loop because fixing one error may introduce new ones or require re-checking.
+        max_iter = 10
+        validator = Draft7Validator(schema)
+
+        for _ in range(max_iter):
+            errors = sorted(validator.iter_errors(data), key=lambda e: len(e.path), reverse=True)
+
+            if not errors:
+                break
+
+            try:
+                data = LLMOutputParser.fix_validation_error(errors[0], data, inplace=True)
+            except (IndexError, KeyError, TypeError):
+                pass
+
+        return data
+
+
+    @staticmethod
+    def fix_validation_error(error: JSONSchemaValidationError, data: dict, inplace: bool = False) -> dict:
+        """Attempts to fix a single JSON schema validation error by modifying the data.
+
+        Modifications:
+        - ENUM violation: Set value to the first enum value
+        - String length: Truncate string to max length or add spaces to reach min length
+        - Array length: Truncate array to max length or add elements to reach min length
+        - Numeric range: Set value to minimum or maximum
+
+        Args:
+            error: The JSON schema validation error.
+            data: The data to fix.
+            inplace: Whether to fix the data in-place.
+
+        Returns:
+            The modified data.
+        """
+        fixed_data = data if inpla
```

**File**: `evoagentx/models/model_configs.py` (modified, +2/-0)
```diff
@@ -171,6 +171,8 @@ class OpenRouterConfig(LLMConfig):
     tool_choice: Optional[Union[str, dict]] = Field(default=None, description="Controls which tool is called by model. Can be 'none', 'auto', 'required', or specific tool configuration.")
 
     stream: Optional[bool] = Field(default=None, description="If set to true, it sends partial message deltas. Tokens will be sent as they become available, with the stream terminated by a [DONE] message.")
+    extra_body: Optional[dict] = Field(default=None, description="Additional request body parameters for provider-specific features.")
+
     def __str__(self):
         return self.model
 
```

---

### Incident Patch 10: `7fc9d44e` (2026-06-23)
**Commit Message**: fix parse_data_from_text typing and simplify JSON parsing

**File**: `evoagentx/core/module_utils.py` (modified, +44/-49)
```diff
@@ -1,7 +1,8 @@
 import json
 import os
 from datetime import date, datetime
-from typing import Any, Dict, List, Optional, Type, Union, get_args, get_origin
+from types import UnionType
+from typing import Any, Dict, List, Type, Union, get_args, get_origin
 from uuid import uuid4
 
 import regex
@@ -84,29 +85,6 @@ def save_json(data, path: str, type: str="json", use_indent: bool=True) -> str:
     return path
 
 
-def extract_fenced_blocks(text: str, labels: Optional[List[str]] = None) -> List[str]:
-    """
-    Extract fenced code blocks from the given text.
-
-    Args:
-        text (str): The text to extract fenced code blocks from.
-        labels (List[str]): The labels to extract fenced code blocks for.
-
-    Returns:
-        List[str]: Code blocks with specified labels.
-    """
-    # Pattern to match fenced blocks: ```label\ncode\n```
-    pattern = r"```([a-zA-Z0-9_\-\+]*)\s*\n*(.*?)\n*```"
-    matches = regex.findall(pattern, text, regex.DOTALL)
-    
-    if labels:
-        # Normalize labels for case-insensitive matching
-        labels_lower = {label.lower() for label in labels}
-        return [code.strip() for lang, code in matches if lang.strip().lower() in labels_lower]
-    
-    return [code.strip() for _, code in matches]
-
-
 def escape_json_values(string: str) -> str:
 
     def escape_value(match):
@@ -196,30 +174,25 @@ def _replacer(match) -> str:
 
 def fix_json(string: str) -> str:
     string = remove_json_comments(string)
-    string = fix_json_booleans(string)
+    # string = fix_json_booleans(string)
     string = escape_json_values(string)
     return string
 
 
 def parse_json_from_text(text: str) -> List[str]:
     """
-    Autoregressively extract JSON object from text 
+    Autoregressively extract JSON object from text
+
+    Args:
+        text (str): a text that includes JSON data
 
-    Args: 
-        text (str): a text that includes JSON data 
-    
     Returns:
         List[str]: a list of parsed JSON data
     """
-    fenced_blocks = extract_fenced_blocks(text)
-    if fenced_blocks:
-        matches = fenced_blocks
-    else:
-        json_pattern = r"""(?:\{(?:[^{}]*|(?R))*\}|\[(?:[^\[\]]*|(?R))*\])"""
-        pattern = regex.compile(json_pattern, regex.VERBOSE)
-        matches = pattern.findall(text)
-
-    matches = [fix_json(m) for m in matches]
+    json_pattern = r"""(?:\{(?:[^{}]*|(?R))*\}|\[(?:[^\[\]]*|(?R))*\])"""
+    pattern = regex.compile(json_pattern, regex.VERBOSE)
+    matches = pattern.findall(text)
+    matches = [fix_json(match) for match in matches]
     return matches
 
 
@@ -231,28 +204,50 @@ def parse_xml_from_text(text: str, label: str) -> List[str]:
         values = [match.strip() for match in matches]
     return values
 
-def parse_data_from_text(text: str, datatype: str):
-
-    if datatype == "str":
+def parse_data_from_text(text: str, datatype: Type):
+    if datatype is str:
         data = text
-    elif datatype == "int":
+
+    elif datatype is int:
         data = int(text)
-    elif datatype == "float":
+
+    elif datatype is float:
         data = float(text)
-    elif datatype == "bool":
+
+    elif datatype is bool:
         data = text.lower() in ("true", "yes", "1", "on", "True")
-    elif datatype == "list":
-        data = eval(text)
-    elif datatype == "dict":
-        data = eval(text)
+
+    elif datatype is list:
+        try:
+            data = json.loads(text)
+        except json.JSONDecodeError:
+            data = [item.strip() for item in text.split(",")]
+            type_args = get_args(datatype)
+            if len(type_args) == 1:
+                data = [parse_data_from_text(item, type_args[0]) for item in data]
+
+    elif datatype is dict:
+        data = json.loads(text)
+
+    elif get_origin(datatype) is Union or get_origin(datatype) is UnionType:
+        type_args = get_args(datatype)
+        for i, type_arg in enumerate(type_args):
+            try:
+                data = parse_data_from_text(text, type_arg)
+                break
+            except Exception:
+                if i == len(type_args) - 1:
+                    data = text
+                continue
+
     else:
         # raise ValueError(
         #     f"Invalid value '{datatype}' is detected for `datatype`. "
         #     "Available choices: ['str', 'int', 'float', 'bool', 'list', 'dict']"
         # )
         # logger.warning(f"Unknown datatype '{datatype}' is detected for `datatype`. Return the raw text instead.")
         # failed to parse the data, return the raw text
-        return text 
+        return text
     return data
 
 def parse_json_from_llm_output(text: str) -> dict:
```

---

### Incident Patch 11: `293927f0` (2026-06-23)
**Commit Message**: fix: restore antlr4-python3-runtime to benchmarks extra

sympy's parse_latex() requires antlr4 at runtime to parse LaTeX
expressions symbolically. Moving it from base to benchmarks (where
it's actually used) rather than dropping it entirely.

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `pyproject.toml` (modified, +3/-1)
```diff
@@ -98,7 +98,8 @@ optimizers = [
     "ujson>=5.9.0"
 ]
 benchmarks = [
-    "sympy"
+    "sympy",
+    "antlr4-python3-runtime==4.11"
 ]
 viz = [
     "matplotlib>=3.10.0"
@@ -147,6 +148,7 @@ all = [
     "cloudpickle",
     "ujson>=5.9.0",
     "sympy",
+    "antlr4-python3-runtime==4.11",
     "matplotlib>=3.10.0"
 ]
 
```

**File**: `requirements.txt` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ ujson>=5.9.0
 
 # benchmarks
 sympy
+antlr4-python3-runtime==4.11
 
 # viz
 matplotlib>=3.10.0
```

---

### Incident Patch 12: `fb94a34a` (2026-06-01)
**Commit Message**: fix(alita): preserve generated tool results with stdout logs

**File**: `evoagentx/tools/alita_agent.py` (modified, +74/-18)
```diff
@@ -1,16 +1,15 @@
 import json
 import os
-from typing import Any, Dict, List, Optional
+import uuid
+from typing import TYPE_CHECKING, Any, ClassVar, Dict, List, Optional
 
 from ..core.logging import logger
-from ..models.model_configs import LLMConfig
-from ..agents import CustomizeAgent
 
 from .tool import Tool, Toolkit
-from .storage_file import StorageToolkit
-from .search_serpapi import SerpAPIToolkit
-from .interpreter_docker import DockerInterpreterToolkit
-from .interpreter_python import PythonInterpreterToolkit
+
+if TYPE_CHECKING:
+    from ..agents import CustomizeAgent
+    from ..models.model_configs import LLMConfig
 
 
 class GeneratedCodeTool(Tool):
@@ -43,6 +42,8 @@ class GeneratedCodeTool(Tool):
         }
     }
     required: Optional[List[str]] = []
+    _RESULT_MARKER_PREFIX: ClassVar[str] = "__ALITA_GENERATED_TOOL_RESULT__"
+    _RESULT_MARKER: ClassVar[str] = "__ALITA_GENERATED_TOOL_RESULT__="
 
     def __init__(
         self,
@@ -77,12 +78,17 @@ def __call__(self, payload: dict = None) -> Dict[str, Any]:
 
         # Inject payload and user code into a small wrapper that expects the
         # user to set `result` and prints it as JSON.
+        result_marker = f"{self._RESULT_MARKER_PREFIX}_{uuid.uuid4().hex}="
         wrapper_code = (
-            "import json\n\n"
-            f"payload = json.loads({json.dumps(payload_json)})\n\n"
+            "import json as __alita_json\n\n"
+            f"payload = __alita_json.loads({json.dumps(payload_json)})\n\n"
             "result = None\n\n"
             f"{self._source_code}\n\n"
-            "print(json.dumps(result, ensure_ascii=False))\n"
+            "import json as __alita_json\n"
+            "print("
+            f"{json.dumps(result_marker)} + "
+            "__alita_json.dumps(result, ensure_ascii=False)"
+            ")\n"
         )
 
         try:
@@ -101,7 +107,49 @@ def __call__(self, payload: dict = None) -> Dict[str, Any]:
                 "error": "Code executor returned no output for generated tool.",
             }
 
-        # Try to parse the output as JSON; if that fails, return raw text.
+        # Parse the wrapper's marked result while preserving user stdout logs.
+        return self._parse_execution_output(output, marker=result_marker)
+
+    @classmethod
+    def _parse_execution_output(
+        cls, output: str, marker: Optional[str] = None
+    ) -> Dict[str, Any]:
+        result_marker = marker or cls._RESULT_MARKER
+        marker_index = output.rfind(result_marker)
+        failed_result_text = None
+        while marker_index != -1:
+            result_start = marker_index + len(result_marker)
+            line_end = output.find("\n", result_start)
+            if line_end == -1:
+                line_end = len(output)
+                after_result = ""
+            else:
+                after_result = output[line_end + 1 :]
+
+            result_text = output[result_start:line_end].strip()
+            try:
+                parsed = json.loads(result_text)
+            except Exception:
+                failed_result_text = result_text
+            else:
+                result = {
+                    "success": True,
+                    "result": parsed,
+                    "raw_output": output,
+                }
+                logs = (output[:marker_index] + after_result).strip()
+                if logs:
+                    result["logs"] = logs
+                return result
+            marker_index = output.rfind(result_marker, 0, marker_index)
+
+        if failed_result_text is not None:
+            logger.warning(
+                "Failed to parse marked generated tool result as JSON: {}",
+                failed_result_text,
+            )
+
+        # Backward-compatible fallback for unmarked executor output.
         try:
             parsed = json.loads(output)
             return {
@@ -110,10 +158,12 @@ def __call__(self, payload: dict = None) -> Dict[str, Any]:
                 "raw_output": output,
             }
         except Exception:
-            return {
-                "success": True,
-                "result": output,
-            }
+            pass
+
+        return {
+            "success": True,
+            "result": output,
+        }
 
 
 class AlitaDynamicToolkit(Toolkit):
@@ -509,13 +559,13 @@ def __call__(self) -> Dict[str, Any]:
 
 
 def create_alita_agent(
-    llm_config: LLMConfig,
+    llm_config: "LLMConfig",
     persist_dynamic_tools: bool = True,
     load_existing_dynamic_tools: bool = True,
     dynamic_tools_path: str = "./workplace/alita/dynamic_tools.json",
     use_docker: bool = True,
     serpapi_api_key: Optional[str] = None,
-) -> CustomizeAgent:
+) -> "CustomizeAgent":
     """
     Build the Alita agent with search, storage, code execution, and dynamic tools.
 
@@ -544,6 +594,12 @@ def create_alita_agent(
             variable.
     """
 
+    from ..agents import CustomizeAgent
+    from .interpreter_docker import DockerInter
```

**File**: `tests/src/tools/test_alita_generated_code_tool.py` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+import contextlib
+import io
+from pathlib import Path
+from typing import Dict, List, Optional
+
+from evoagentx.tools.alita_agent import GeneratedCodeTool
+from evoagentx.tools.interpreter_python import PythonExecuteTool, PythonInterpreter
+from evoagentx.tools.tool import Tool
+
+
+class FakePythonExecutor(Tool):
+    name: str = "fake_python_execute"
+    description: str = "Execute Python code and return stdout."
+    inputs: Dict[str, Dict[str, str]] = {
+        "code": {"type": "string", "description": "Python source code."},
+        "language": {"type": "string", "description": "Execution language."},
+    }
+    required: Optional[List[str]] = ["code"]
+
+    def __call__(self, code: str, language: str = "python") -> str:
+        stdout = io.StringIO()
+        with contextlib.redirect_stdout(stdout):
+            exec(code, {})
+        return stdout.getvalue()
+
+
+class AppendingPythonExecutor(FakePythonExecutor):
+    name: str = "appending_python_execute"
+    description: str = "Execute Python code and append output after execution."
+    inputs: Dict[str, Dict[str, str]] = {
+        "code": {"type": "string", "description": "Python source code."},
+        "language": {"type": "string", "description": "Execution language."},
+    }
+    required: Optional[List[str]] = ["code"]
+
+    def __call__(self, code: str, language: str = "python") -> str:
+        return super().__call__(code, language) + "stderr: warning\n"
+
+
+class MarkerCollisionPythonExecutor(FakePythonExecutor):
+    name: str = "marker_collision_python_execute"
+    description: str = "Execute Python code and append a colliding marker line."
+    inputs: Dict[str, Dict[str, str]] = {
+        "code": {"type": "string", "description": "Python source code."},
+        "language": {"type": "string", "description": "Execution language."},
+    }
+    required: Optional[List[str]] = ["code"]
+
+    def __call__(self, code: str, language: str = "python") -> str:
+        marker_start = code.rfind(GeneratedCodeTool._RESULT_MARKER_PREFIX)
+        marker_end = code.find("=", marker_start)
+        assert marker_start != -1
+        assert marker_end != -1
+        marker = code[marker_start : marker_end + 1]
+        return super().__call__(code, language) + f"{marker}not-json\n"
+
+
+def test_generated_code_tool_returns_structured_result_without_logs():
+    tool = GeneratedCodeTool(
+        code_executor=FakePythonExecutor(),
+        tool_name="clean_tool",
+        description="Clean generated tool",
+        code='result = {"echo": payload.get("text")}',
+    )
+
+    output = tool(payload={"text": "hello"})
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["raw_output"]
+    assert "logs" not in output
+
+
+def test_generated_code_tool_separates_stdout_logs_from_result():
+    tool = GeneratedCodeTool(
+        code_executor=FakePythonExecutor(),
+        tool_name="noisy_tool",
+        description="Noisy generated tool",
+        code='print("debug: starting")\nresult = {"echo": payload.get("text")}',
+    )
+
+    output = tool(payload={"text": "hello"})
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["logs"] == "debug: starting"
+    assert "debug: starting" in output["raw_output"]
+
+
+def test_generated_code_tool_handles_output_after_marked_result():
+    tool = GeneratedCodeTool(
+        code_executor=AppendingPythonExecutor(),
+        tool_name="stderr_tool",
+        description="Generated tool with post-result output",
+        code='print("debug: starting")\nresult = {"echo": payload.get("text")}',
+    )
+
+    output = tool(payload={"text": "hello"})
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["logs"] == "debug: starting\nstderr: warning"
+
+
+def test_generated_code_tool_ignores_invalid_marker_collision_after_result():
+    tool = GeneratedCodeTool(
+        code_executor=MarkerCollisionPythonExecutor(),
+        tool_name="collision_tool",
+        description="Generated tool with a post-result marker collision",
+        code='print("debug: starting")\nresult = {"echo": payload.get("text")}',
+    )
+
+    output = tool(payload={"text": "hello"})
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["logs"].startswith("debug: starting\n")
+    assert "not-json" in output["logs"]
+
+
+def test_generated_code_tool_preserves_legacy_full_json_output():
+    output = GeneratedCodeTool._parse_execution_output('{"echo": "hello"}')
+
+    assert output["success"] is True
+    assert output["result"] == {"echo": "hello"}
+    assert output["raw_output"] == '{"echo": "hello"}'
+
+
+def test_generated_code_tool_does_not_guess_from_unmarked_json_log():
+    raw_output = '{"debug": true}\nTraceback (most recent call last):\nboom'
+
+    output = GeneratedCodeTool.
```

---

### Incident Patch 13: `9b0ded6e` (2026-06-01)
**Commit Message**: fix(evoprompt): isolate registry state during concurrent evaluation

**File**: `evoagentx/optimizers/engine/base.py` (modified, +8/-3)
```diff
@@ -1,7 +1,12 @@
-from typing import Any, Callable, Dict, List, Optional
+from __future__ import annotations
+
 import abc
+from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING
+
 from .decorators import EntryPoint
-from .registry import ParamRegistry
+
+if TYPE_CHECKING:
+    from .registry import ParamRegistry
 
 class BaseOptimizer(abc.ABC):
     # def __init__(
@@ -67,4 +72,4 @@ def optimize(self):
         if self.program is None:
             raise RuntimeError("No entry function provided or registered.")
         print(f"Starting optimization from entry: {self.program.__name__}")
-        raise NotImplementedError
\ No newline at end of file
+        raise NotImplementedError
```

**File**: `evoagentx/optimizers/engine/decorators.py` (modified, +6/-2)
```diff
@@ -1,5 +1,9 @@
-from typing import Any, Callable, List, Tuple, Optional
-from .registry import ParamRegistry
+from __future__ import annotations
+
+from typing import Any, Callable, List, Tuple, Optional, TYPE_CHECKING
+
+if TYPE_CHECKING:
+    from .registry import ParamRegistry
 
 # --------- EntryPoint decorator ---------
 class EntryPoint:
```

**File**: `evoagentx/optimizers/evoprompt_optimizer.py` (modified, +73/-31)
```diff
@@ -12,6 +12,8 @@
 #   https://opensource.microsoft.com/codeofconduct/
 # -----------------------------------------------------------------------------
 
+from __future__ import annotations
+
 import asyncio
 import json
 import random
@@ -20,19 +22,19 @@
 import csv
 import time
 import itertools
-from typing import Callable, Dict, List
+from typing import Callable, Dict, List, TYPE_CHECKING
 from datetime import datetime
 
 import numpy as np
 from tqdm.asyncio import tqdm as aio_tqdm
-import matplotlib.pyplot as plt
 
-from evoagentx.agents import CustomizeAgent
-from evoagentx.benchmark.bigbenchhard import BIGBenchHard
 from evoagentx.core.logging import logger
-from evoagentx.models import OpenAILLMConfig
 from evoagentx.optimizers.engine.base import BaseOptimizer
-from evoagentx.optimizers.engine.registry import ParamRegistry
+
+if TYPE_CHECKING:
+    from evoagentx.benchmark.bigbenchhard import BIGBenchHard
+    from evoagentx.models import OpenAILLMConfig
+    from evoagentx.optimizers.engine.registry import ParamRegistry
 
 
 class EvopromptOptimizer(BaseOptimizer):
@@ -77,6 +79,7 @@ def __init__(self,
         self.iterations = iterations
         self.llm_config = llm_config
         self.semaphore = asyncio.Semaphore(concurrency_limit)
+        self._program_config_lock = asyncio.Lock()
         self.combination_sample_size = combination_sample_size
 
         # Logging configuration
@@ -100,6 +103,7 @@ def __init__(self,
         self.avg_combo_scores_per_gen: Dict[str, float] = {}
         
         # Initialize paraphrase agent for prompt generation
+        from evoagentx.agents import CustomizeAgent
         self.paraphrase_agent = CustomizeAgent(
             name="ParaphraseAgent",
             description="An agent that paraphrases a given instruction.",
@@ -215,6 +219,8 @@ def _log_detailed_evaluation(self, generation: int, combinations: List[Dict[str,
     def _create_single_metric_plot(self, metric_name: str, generations: List[int],
                                    best_scores: List[float], avg_scores: List[float],
                                    algorithm_name: str, plot_dir: str):
+        import matplotlib.pyplot as plt
+
         fig, ax = plt.subplots(figsize=(12, 7))
         ax.plot(generations, best_scores, marker='o', linestyle='-', linewidth=2, markersize=8, label='Best Score')
         ax.plot(generations, avg_scores, marker='x', linestyle='--', linewidth=2, markersize=8, label='Average Score')
@@ -242,9 +248,12 @@ def _create_single_metric_plot(self, metric_name: str, generations: List[int],
             plt.close(fig)
 
     def _plot_and_save_performance_graph(self, algorithm_name: str):
-        if not self.enable_logging or plt is None:
-            if plt is None:
-                logger.warning("Matplotlib not found, skipping plot generation.")
+        if not self.enable_logging:
+            return
+        try:
+            import matplotlib.pyplot as plt
+        except ImportError:
+            logger.warning("Matplotlib not found, skipping plot generation.")
             return
         if not self.best_scores_per_gen and not self.best_combo_scores_per_gen:
             logger.warning("No performance data to plot.")
@@ -460,8 +469,7 @@ async def _evaluate_combination_list(self, combinations: List[Dict], benchmark:
         all_scores = []
         pbar = aio_tqdm(total=len(combinations), desc="Evaluating batch", leave=False)
         for combo in combinations:
-            tasks = [self._evaluate_combination_on_example(combo, benchmark, ex) for ex in eval_dev_set]
-            example_scores = await asyncio.gather(*tasks)
+            example_scores = await self._evaluate_combination_on_examples(combo, benchmark, eval_dev_set)
             avg_score = sum(example_scores) / len(example_scores) if example_scores else 0.0
             all_scores.append(avg_score)
             pbar.update(1)
@@ -507,47 +515,79 @@ def _generate_combinations(self, node_populations: Dict[str, List[str]]) -> List
         logger.info(f"Generated {len(sampled_combinations)} unique combinations")
         return sampled_combinations
 
-    async def _evaluate_combination_on_example(self, combination: Dict[str, str],
-                                             benchmark: BIGBenchHard, example: Dict) -> float:
+    def _get_eval_cache_key(self, combination: Dict[str, str], example: Dict):
         combo_key = tuple(sorted(combination.items()))
         example_key = str(hash(str(example)))
-        cache_key = hash((combo_key, example_key))
-
-        if not hasattr(self, '_eval_cache'):
-            self._eval_cache = {}
+        return hash((combo_key, example_key))
 
-        if cache_key in self._eval_cache:
-            return self._eval_cache[cache_key]
+    def _cache_eval_score(self, cache_key, score: float):
+        self._eval_cache[cache_key] = score
+        if len(self._eval_cache) > 5000:
+            keys_to_del = list(self._eval_cache.keys())[:1000]
+            fo
```

**File**: `tests/src/optimizers/test_evoprompt_state_isolation.py` (added, +185/-0)
```diff
@@ -0,0 +1,185 @@
+import asyncio
+import threading
+
+import pytest
+
+from evoagentx.optimizers.engine.base import BaseOptimizer
+from evoagentx.optimizers.evoprompt_optimizer import EvopromptOptimizer
+
+
+class FakeBenchmark:
+    def get_input_keys(self):
+        return ["case"]
+
+    def get_label(self, example):
+        return example["target"]
+
+    def evaluate(self, prediction, label):
+        return {"em": float(prediction == label)}
+
+
+class RaisingBenchmark(FakeBenchmark):
+    def evaluate(self, prediction, label):
+        raise RuntimeError("evaluation failed")
+
+
+class SimpleProgram:
+    def __init__(self):
+        self.prompt = "base"
+
+    def __call__(self, case):
+        return self.prompt, {"case": case}
+
+
+class PromptRegistry:
+    def __init__(self, program):
+        self.program = program
+        self.fields = {"prompt": object()}
+
+    def get(self, name):
+        assert name == "prompt"
+        return self.program.prompt
+
+    def set(self, name, value):
+        assert name == "prompt"
+        self.program.prompt = value
+
+    def names(self):
+        return ["prompt"]
+
+
+class CoordinatedExampleProgram:
+    def __init__(self):
+        self._prompt = "base"
+        self.slow_started = threading.Event()
+        self.fast_returned = threading.Event()
+        self.base_restored_after_fast = threading.Event()
+        self.observed = {}
+
+    @property
+    def prompt(self):
+        return self._prompt
+
+    @prompt.setter
+    def prompt(self, value):
+        self._prompt = value
+        if value == "base" and self.fast_returned.is_set():
+            self.base_restored_after_fast.set()
+
+    def __call__(self, case):
+        if case == "fast":
+            self.slow_started.wait(timeout=1.0)
+            observed = self.prompt
+            self.observed[case] = observed
+            self.fast_returned.set()
+            return observed, {"case": case}
+
+        if case == "slow":
+            self.slow_started.set()
+            self.fast_returned.wait(timeout=1.0)
+            self.base_restored_after_fast.wait(timeout=0.05)
+            observed = self.prompt
+            self.observed[case] = observed
+            return observed, {"case": case}
+
+        observed = self.prompt
+        self.observed[case] = observed
+        return observed, {"case": case}
+
+
+class CrossCombinationProgram:
+    def __init__(self):
+        self.prompt = "base"
+        self.combo_a_entered = threading.Event()
+        self.combo_b_entered = threading.Event()
+        self.observed = []
+
+    def __call__(self, case):
+        initial_prompt = self.prompt
+        if initial_prompt == "combo-a":
+            self.combo_a_entered.set()
+            self.combo_b_entered.wait(timeout=0.05)
+        elif initial_prompt == "combo-b":
+            self.combo_b_entered.set()
+            self.combo_a_entered.wait(timeout=0.05)
+
+        observed = self.prompt
+        self.observed.append((case, initial_prompt, observed))
+        return observed, {"case": case}
+
+
+def make_optimizer(program, concurrency_limit=2):
+    registry = PromptRegistry(program)
+
+    class TestOptimizer(EvopromptOptimizer):
+        def __init__(self):
+            BaseOptimizer.__init__(self, registry=registry, program=program)
+            self.semaphore = asyncio.Semaphore(concurrency_limit)
+            self._program_config_lock = asyncio.Lock()
+            self._eval_cache = {}
+
+        async def optimize(self):
+            return None
+
+    return TestOptimizer()
+
+
+@pytest.mark.asyncio
+async def test_combination_config_is_kept_until_all_examples_finish():
+    program = CoordinatedExampleProgram()
+    optimizer = make_optimizer(program, concurrency_limit=2)
+    benchmark = FakeBenchmark()
+
+    scores = await optimizer._evaluate_combination_on_examples(
+        {"prompt": "optimized"},
+        benchmark,
+        [
+            {"case": "fast", "target": "optimized"},
+            {"case": "slow", "target": "optimized"},
+        ],
+    )
+
+    assert scores == [1.0, 1.0]
+    assert program.observed == {"fast": "optimized", "slow": "optimized"}
+    assert program.prompt == "base"
+
+
+@pytest.mark.asyncio
+async def test_combination_config_is_restored_after_evaluation_error():
+    program = SimpleProgram()
+    optimizer = make_optimizer(program)
+
+    scores = await optimizer._evaluate_combination_on_examples(
+        {"prompt": "optimized"},
+        RaisingBenchmark(),
+        [{"case": "single", "target": "optimized"}],
+    )
+
+    assert scores == [0.0]
+    assert program.prompt == "base"
+
+
+@pytest.mark.asyncio
+async def test_concurrent_combinations_do_not_share_temporary_config():
+    program = CrossCombinationProgram()
+    optimizer = make_optimizer(program, concurrency_limit=2)
+    benchmark = FakeBenchmark()
+
+    scores_a, scores_b = await asyncio.gather(
+        optimizer._evaluate_combination_list(
+            [{"prompt": "comb
```

---

### Incident Patch 14: `d7b63e29` (2026-05-15)
**Commit Message**: Merge pull request #246 from gdsm2/fix_pydantic_warnings

fix: pydantic warnings

**File**: `evoagentx/actions/agent_generation.py` (modified, +7/-7)
```diff
@@ -50,8 +50,7 @@ def sim(t1: str, t2: str):
         return outputs[similarities.index(max_sim)]
 
     @model_validator(mode="after")
-    @classmethod
-    def validate_prompt(cls, agent: 'GeneratedAgent'):
+    def validate_prompt(self) -> 'GeneratedAgent':
         """Validate and fix the agent's prompt template.
         
         This validator ensures that:
@@ -62,15 +61,16 @@ def validate_prompt(cls, agent: 'GeneratedAgent'):
         If there are mismatches in the output sections, it attempts to
         fix them by finding the most similar output name.
         
-        Args:
-            agent: The GeneratedAgent instance to validate.
-            
         Returns:
             The validated and potentially modified GeneratedAgent.
             
         Raises:
             ValueError: If inputs are missing from the prompt or output sections don't match the defined outputs.
         """
+
+        # alias to minimise diff from the pre-Pydantic-2.12 version
+        agent = self
+
         # check whether all the inputs are present in the prompt 
         input_names = [inp.name for inp in agent.inputs]
         prompt_has_inputs = [name in agent.prompt for name in input_names]
@@ -106,7 +106,7 @@ def fix_output_names(match):
             # check whether the generated output names are the same as agent outputs 
             for generated_output in generated_outputs:
                 if generated_output not in outputs_names:
-                    most_similar_output_name = cls.find_output_name(text=generated_output, outputs=outputs_names)
+                    most_similar_output_name = type(agent).find_output_name(text=generated_output, outputs=outputs_names)
                     output_format = output_format.replace(generated_output, most_similar_output_name)
                     logger.warning(f"Couldn't find output name in prompt ('{generated_output}') in agent's outputs. Replace it with the most similar agent output: '{most_similar_output_name}'")
             return "### Output Format" + output_format
@@ -195,4 +195,4 @@ def execute(self, llm: Optional[BaseLLM] = None, inputs: Optional[dict] = None,
             return agents, prompt
         
         return agents
-    
\ No newline at end of file
+    
```

**File**: `evoagentx/workflow/workflow_graph.py` (modified, +5/-2)
```diff
@@ -84,14 +84,17 @@ def check_agent_format(cls, agents: List[Union[str, dict, Agent]]):
         return validated_agents
 
     @model_validator(mode="after")
-    @classmethod
-    def check_action_graph(cls, instance: "WorkFlowNode"):
+    def check_action_graph(self) -> "WorkFlowNode":
         """
         Validates that:
         1. All required parameters of execute/async_execute methods are included in inputs
         2. The execute/async_execute methods return dictionaries
         3. All output parameters are present in the returned dictionaries
         """
+
+        # alias to minimise diff from the pre-Pydantic-2.12 version
+        instance = self 
+
         if instance.action_graph is None:
             return instance
         
```

---

### Incident Patch 15: `bf6d413d` (2026-05-11)
**Commit Message**: Merge remote-tracking branch 'upstream/main' into fix_pydantic_warnings

**File**: `evoagentx/core/decorators.py` (modified, +19/-1)
```diff
@@ -27,9 +27,27 @@ def atomic_method(func):
     """
     @wraps(func)
     def wrapper(self, *args, **kwargs):
-        context = getattr(self, "_lock", nullcontext())
+        lock = getattr(self, "_lock", None)
+        context = lock if lock is not None else nullcontext()
         with context:
             return func(self, *args, **kwargs)
     return wrapper
 
 
+def async_atomic_method(func):
+    """
+    Async version of atomic_method for async class methods.
+    If there is self._async_lock (asyncio.Lock) in the instance, it will use the lock.
+    Otherwise, use async nullcontext for execution.
+    """
+    @wraps(func)
+    async def wrapper(self, *args, **kwargs):
+        lock = getattr(self, "_async_lock", None)
+        if lock is not None:
+            async with lock:
+                return await func(self, *args, **kwargs)
+        else:
+            return await func(self, *args, **kwargs)
+    return wrapper
+
+
```

**File**: `evoagentx/core/logging.py` (modified, +10/-2)
```diff
@@ -1,8 +1,16 @@
 import os
+import sys
+import io
 from loguru import logger
 
-# logger.remove()
-# logger.add(sys.stdout, level="INFO")
+if hasattr(sys.stdout, "buffer"):
+    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
+
+# 清空默认 handler，避免重复输出
+logger.remove()
+
+# 控制台输出
+logger.add(sys.stdout, level="INFO")
 # file_handler_id = None 
 save_logging_file = None  
 
```

**File**: `evoagentx/core/module.py` (modified, +27/-44)
```diff
@@ -1,22 +1,24 @@
-import os 
-import yaml
-import json 
 import copy
+import json
 import logging
-from typing import Callable, Any, Dict, List
-from pydantic import BaseModel, ValidationError
+import os
+from typing import Any, Callable, Dict, List
+
+import yaml
+from pydantic import BaseModel, ConfigDict, ValidationError
 from pydantic._internal._model_construction import ModelMetaclass
 
-from .logging import logger
 from .callbacks import callback_manager, exception_buffer
+from .logging import logger
 from .module_utils import (
-    save_json,
     custom_serializer,
-    parse_json_from_text, 
+    get_base_module_init_error_message,
     get_error_message,
-    get_base_module_init_error_message
+    parse_json_from_text,
+    recursive_to_dict,
+    save_json,
 )
-from .registry import register_module, MODULE_REGISTRY
+from .registry import MODULE_REGISTRY, register_module
 
 
 class MetaModule(ModelMetaclass):
@@ -41,7 +43,7 @@ def __new__(mcs, name, bases, namespace, **kwargs):
         Returns:
             The created class object
         """
-        cls = super().__new__(mcs, name, bases, namespace)
+        cls = super().__new__(mcs, name, bases, namespace, **kwargs)
         register_module(name, cls)
         return cls 
 
@@ -60,8 +62,13 @@ class BaseModule(BaseModel, metaclass=MetaModule):
 
     class_name: str = None 
     # NOTE: do not set "validate_assignment" to True, otherwise infinite recursion will occur when validating the model.
-    model_config = {"arbitrary_types_allowed": True, "extra": "allow", "protected_namespaces": (), "validate_assignment": False}
-
+    model_config = ConfigDict(
+        arbitrary_types_allowed=True,
+        extra="allow",
+        protected_namespaces=(),
+        validate_assignment=False
+    )
+    
     def __init_subclass__(cls, **kwargs):
         """
         Subclass initialization method that automatically sets the class_name attribute.
@@ -223,7 +230,7 @@ def from_json(cls, content: str, **kwargs) -> "BaseModule":
         Raises:
             ValueError: When the input is not a valid JSON string
         """
-        use_logger = kwargs.get("log", True)
+        use_logger = kwargs.pop("log", True)
         try:
             data = yaml.safe_load(content)
         except Exception:
@@ -238,7 +245,7 @@ def from_json(cls, content: str, **kwargs) -> "BaseModule":
                 logger.error(error_message)
             raise ValueError(error_message)
 
-        return cls.from_dict(data, log=use_logger)
+        return cls.from_dict(data, log=use_logger, **kwargs)
     
     @classmethod
     def from_str(cls, content: str, **kwargs) -> "BaseModule":
@@ -260,7 +267,7 @@ def from_str(cls, content: str, **kwargs) -> "BaseModule":
         Raises:
             ValueError: When the input does not contain valid JSON strings or the JSON is incompatible with the class
         """
-        use_logger = kwargs.get("log", True)
+        use_logger = kwargs.pop("log", True)
         
         extracted_json_list = parse_json_from_text(content)
         if len(extracted_json_list) == 0:
@@ -272,7 +279,7 @@ def from_str(cls, content: str, **kwargs) -> "BaseModule":
         module = None
         for json_str in extracted_json_list:
             try:
-                module = cls.from_json(json_str, log=False)
+                module = cls.from_json(json_str, log=False, **kwargs)
             except Exception:
                 continue
             break
@@ -336,7 +343,7 @@ def from_file(cls, path: str, load_function: Callable=None, **kwargs) -> "BaseMo
         
         function = load_function or cls.load_module
         content = function(path, **kwargs)
-        module = cls.from_dict(content, log=use_logger)
+        module = cls.from_dict(content, log=use_logger, **kwargs)
 
         return module
     
@@ -358,29 +365,7 @@ def to_dict(self, exclude_none: bool = True, ignore: List[str] = [], **kwargs) -
         Returns:
             dict: Dictionary containing the object data
         """
-        data = {}
-        for field_name, _ in type(self).model_fields.items():
-            if field_name in ignore:
-                continue
-            field_value = getattr(self, field_name, None)
-            if exclude_none and field_value is None:
-                continue
-            if isinstance(field_value, BaseModule):
-                data[field_name] = field_value.to_dict(exclude_none=exclude_none, ignore=ignore)
-            elif isinstance(field_value, list):
-                data[field_name] = [
-                    item.to_dict(exclude_none=exclude_none, ignore=ignore) if isinstance(item, BaseModule) else item
-                    for item in field_value
-                ]
-            elif isinstance(field_value, dict):
-                data[field_name] = {
-                    key: value.to_dict(exclude_none=exclude_none, ignore=ignore) if isinstance(value, BaseModule) else value
-                    for key, value in field_value.
```

**File**: `evoagentx/core/module_utils.py` (modified, +112/-44)
```diff
@@ -1,15 +1,16 @@
-import os 
-import re
-import yaml
 import json
-import regex
+import os
+from datetime import date, datetime
+from typing import Any, Dict, List, Optional, Type, Union, get_args, get_origin
 from uuid import uuid4
-from datetime import datetime, date 
+
+import regex
+import yaml
 from pydantic import BaseModel
 from pydantic_core import PydanticUndefined, ValidationError
-from typing import Union, Type, Any, List, Dict, Tuple, get_origin, get_args
 
-from .logging import logger 
+from .logging import logger
+
 
 def make_parent_folder(path: str):
 
@@ -83,25 +84,27 @@ def save_json(data, path: str, type: str="json", use_indent: bool=True) -> str:
     return path
 
 
-def _extract_fenced_blocks(text: str) -> Tuple[List[str], List[str]]:
+def extract_fenced_blocks(text: str, labels: Optional[List[str]] = None) -> List[str]:
     """
     Extract fenced code blocks from the given text.
 
+    Args:
+        text (str): The text to extract fenced code blocks from.
+        labels (List[str]): The labels to extract fenced code blocks for.
+
     Returns:
-        preferred (List[str]): Code blocks explicitly labeled as json/yaml/yml.
-        others (List[str]): Code blocks with other or missing language labels.
+        List[str]: Code blocks with specified labels.
     """
-    _FENCE_RE = re.compile(r"```(\w+)?\r?\n(.*?)```", re.DOTALL)
-
-    preferred, others = [], []
-    for m in _FENCE_RE.finditer(text):
-        lang = (m.group(1) or "").lower().strip()
-        code = m.group(2)
-        if lang in ("json", "yaml", "yml"):
-            preferred.append(code)
-        else:
-            others.append(code)
-    return preferred, others
+    # Pattern to match fenced blocks: ```label\ncode\n```
+    pattern = r"```([a-zA-Z0-9_\-\+]*)\s*\n*(.*?)\n*```"
+    matches = regex.findall(pattern, text, regex.DOTALL)
+    
+    if labels:
+        # Normalize labels for case-insensitive matching
+        labels_lower = {label.lower() for label in labels}
+        return [code.strip() for lang, code in matches if lang.strip().lower() in labels_lower]
+    
+    return [code.strip() for _, code in matches]
 
 
 def escape_json_values(string: str) -> str:
@@ -111,7 +114,7 @@ def escape_value(match):
         raw_value = raw_value.replace('\n', '\\n')
         return f'"{raw_value}"'
     
-    def fix_json(match):
+    def escape_nested_json(match):
         raw_key = match.group(1)
         raw_value = match.group(2)
         raw_value = raw_value.replace("\n", "\\n")
@@ -126,19 +129,21 @@ def fix_json(match):
 
     try:
         string = regex.sub(r'(?<!\\)"', '\\\"', string) # replace " with \"
-        pattern_key = r'\\"([^"]+)\\"(?=\s*:\s*)'
+        # pattern_key = r'\\"([^"]+)\\"(?=\s*:\s*)'
+        pattern_key = r'(?:(?<=^)|(?<=[{,]))\s*\\"([^"]+)\\"(?=\s*:)'
         string = regex.sub(pattern_key, r'"\1"', string) # replace \\"key\\" with "key"
         pattern_value = r'(?<=:\s*)\\"((?:\\.|[^"\\])*)\\"'
         string = regex.sub(pattern_value, escape_value, string, flags=regex.DOTALL) # replace \\"value\\" with "value"and change \n to \\n
         pattern_nested_json = r'"([^"]+)"\s*:\s*\\"([^"]*\{+[\S\s]*?\}+)[\r\n\\n]*"' # handle nested json in value
-        string = regex.sub(pattern_nested_json, fix_json, string, flags=regex.DOTALL)
+        string = regex.sub(pattern_nested_json, escape_nested_json, string, flags=regex.DOTALL)
         json.loads(string)
         return string
     except json.JSONDecodeError:
         pass
     
     return string
 
+
 def fix_json_booleans(string: str) -> str:
     """
     Finds and replaces isolated "True" and "False" with "true" and "false".
@@ -159,7 +164,38 @@ def fix_json_booleans(string: str) -> str:
     return modified_string
 
 
+def remove_json_comments(json_str: str) -> str:
+    """
+    Remove // and /* */ comments from a JSON-like string and preserving text inside quotes.
+
+    Args:
+        json_str (str): The JSON-like input string that may contain comments.
+
+    Returns:
+        str: The same string with comments removed.
+    """
+    pattern = regex.compile(
+        r"""
+        ("(?:\\.|[^"\\])*")   |  # group 1: double-quoted string
+        ('(?:\\.|[^'\\])*')   |  # group 2: single-quoted string
+        (//[^\n\r]*)          |  # group 3: single-line comment
+        (/\*.*?\*/)              # group 4: multi-line comment
+        """,
+        regex.VERBOSE | regex.DOTALL | regex.MULTILINE
+    )
+
+    def _replacer(match) -> str:
+        # If group 3 (//...) or group 4 (/*...*/) matched, remove it
+        if match.group(3) or match.group(4):
+            return ""
+        # Otherwise it's a quoted string (group 1 or 2) — keep it unchanged
+        return match.group(0)
+
+    return pattern.sub(_replacer, json_str).strip()
+
+
 def fix_json(string: str) -> str:
+    string = remove_json_comments(string)
     string = fix_json_booleans(string)
     string = escape_json_values(string)
     return string
```

#### Recent Merged Pull Requests:
- **PR #274** (closed): fix(evaluator): stop concurrent Evaluator workers sharing one Agent's short_term_memory (@AmirF194)
- **PR #268** (2026-08-14): Add Novita AI as a supported LLM provider (@jax-novita)
- **PR #265** (2026-06-28): Feat/workflow upgrade (@fangjy6)
- **PR #264** (2026-06-27): Feat/agent upgrade (@fangjy6)
- **PR #263** (2026-06-28): docs: add missing import os in OpenAI API key example (@FBISiri)
- **PR #262** (2026-06-24): Upgrade EAX Core (@fangjy6)
- **PR #261** (2026-06-23): chore: sync and clean up project dependencies (@fangjy6)
- **PR #260** (2026-06-23): [codex] Remove legacy FastAPI app (@fangjy6)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
