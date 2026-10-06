# Forensic Learning Record (Deep Inspection): xingyaoww/code-act

> **Canonical Artifact**: `07_PROJECT_LEARNING/xingyaoww-code-act-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xingyaoww/code-act](https://github.com/xingyaoww/code-act))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:31:38.891Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xingyaoww/code-act`
- **Description**: Official Repo for ICML 2024 paper "Executable Code Actions Elicit Better LLM Agents" by Xingyao Wang, Yangyi Chen, Lifan Yuan, Yizhe Zhang, Yunzhu Li, Hao Peng, Heng Ji.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1708 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `mint/tasks/codegen/APPS/utils.py`
```
# Borrowed from: https://huggingface.co/spaces/codeparrot/apps_metric/blob/main/utils.py

import itertools
import json
import multiprocessing
import numpy as np
from typing import Dict, Optional
from datasets import load_dataset
from .testing_util import run_test

DATASET = "codeparrot/apps"
TIMEOUT = 10

def check_correctness(in_outs: Optional[dict], generation, timeout=TIMEOUT, debug=True):
    """Check correctness of code generation with a global timeout.
    The global timeout is to catch some extreme/rare cases not handled by the timeouts
    inside `run_test`"""
    def _temp_run(sample, generation, debug, result):
        result.append(run_test(sample, test=generation, debug=debug))

    manager = multiprocessing.Manager()
    result = manager.list()
    p = multiprocessing.Process(target=_temp_run, args=(in_outs, generation, debug, result))
    p.start()
    p.join(timeout=timeout + 1)
    if p.is_alive():
        p.kill()
    if not result:
        # consider that all tests failed
        result = [[-1 for i in range(len(in_outs["inputs"]))]]
        if debug:
            print(f"global timeout")
    return result[0]


def evaluate_generations(generations: list, level: str = "all", debug: bool = False):
    """We take the list of code generations and try to compile them
     and the run their corresponding unit tests which are retrieved from the APPS dataset.

    Args:
        generations: list of code generations (same order as samples in APPS dataset)
        level: difficulty level used in the generation, can be "all", "introductory", "interview" or "competition"

    Returns:
        results: dictionary of results, key is the problem index, value is a list of results for each generation
        [-2] = compile error, [-1] = runtime error [False] = failed test case [True] = passed test case
     """

    # generations are code generations in the same order of the dataset
    apps_eval = load_dataset(DATASET, split="test", difficulties=[level])
    results = {}
    for index in range(len(generations)):
        # code generations for problem (index)
        problem_generations = generations[index]
        # get corresponding samples from APPS dataset
        sample = apps_eval[index]
        res = []
        # loop over the generations
        for o_idx, o in enumerate(problem_generations):
            curr_res = [-2]
            try:
                curr_res = check_correctness(sample, o, timeout=TIMEOUT, debug=debug)
                if debug:
                    print(f"\nSuccessful compilation of task {index}!")
                fixed = []
                for e in curr_res:
                    if isinstance(e, np.ndarray):
                       e = e.item(0)
                    if isinstance(e, np.bool_):
                        e = bool(e)
                    fixed.append(e)
                curr_res = fixed
                if not np.all(curr_res):
                    if debug:
                        print(f"Results were not True for all test cases")
            except Exception as e:
                if debug:
                    print(f"Compilation failed, test framework exception = {repr(e)}{e}\n")
                break
            finally:
                assert isinstance(curr_res, list)
                res.append(curr_res)
        results[index] = res
    return results


def estimate_pass_at_k(num_samples, num_correct, k):
    """Estimates pass@k of each problem and returns them in an array."""

    def estimator(n: int, c: int, k: int) -> float:
        """Calculates 1 - comb(n - c, k) / comb(n, k)."""
        if n - c < k:
            return 1.0
        return 1.0 - np.prod(1.0 - k / np.arange(n - c + 1, n + 1))

    if isinstance(num_samples, int):
        num_samples_it = itertools.repeat(num_samples, len(num_correct))
    else:
        assert len(num_samples) == len(num_correct)
        num_samples_it = iter(num_samples)

    return np.array([estimator(int(n), int(c), k) for n, c in zip(num_samples_it, num_correct)])


def get_results(results: Dict[int, list], count_errors: bool = False, k_list: list = [1, 10, 100]):
    """
    Given the results evaluated against the testcases we output some statistics.
    For single generations:
    >>> example_results = {0: [[-2]], 1: [[False,False]], 2: [[True,True]], 3: [[False,True,False,True]], 4: [[-1,-1]]}
    >>> get_results(example_results, count_errors=True)
    Computing accuracy metrics...
    number of compile errors = 1 avg = 0.2
    number of runtime errors = 1 avg = 0.2
    number of problems evaluated = 5
    Average Accuracy : 0.3
    Strict Accuracy : 0.2
    {'avg_accuracy': 0.3, 'strict_accuracy': 0.2, 'pass_at_k': None}

    For multiple generations:
    >>> example_results = {0: [[-2], [True, True, True]], 1: [[-1,-1, -1], [True, False, True]]}
    >>> get_results(example_results, k_list=[1, 2])
    Computing pass@k metric for multiple generations...
    {'pass@1': 0.25, 'pass@2': 0.5}
    {'avg_accuracy': None, 'strict_accuracy': None, 'pass_at_k': {'pass@1': 0.25, 'pass@2': 0.5}}
    """

    metrics = {"avg_accuracy": None, "strict_accuracy": None, "pass_at_k": None}

    if len(results[0]) == 1:
        # for single generations we compute average accuracy and stric accuracy: original APPS metrics
        print("Computing accuracy metrics...")
        res = []
        per_prob_res = []
        all_correct = []
        for index in results:
            problem_results = np.asarray(results[index])
            res.extend(problem_results)
            per_prob_res.append(np.mean(problem_results > 0))
            all_correct.append(np.all(problem_results > 0))
        # we count campilation and runtime errors once per pronlem
        compile_errors = len([e for e in res if -2 in e])
        runtime_errors = len([e for e in res if -1 in e])
        total_testcases = len(res)
        if count_errors:
            print(f"number of compile errors = {compile_errors} avg = {compile_errors / total_testcases}")
            print(f"number of runtime errors = {runtime_errors} avg = {runtime_errors / total_testcases}")
            print(f"number of problems evaluated = {total_testcases}")

        print(f"Average Accuracy : {np.mean(per_prob_res)}")
        print(f"Strict Accuracy : {np.mean(all_correct)}")
        metrics["avg_accuracy"] = np.mean(per_prob_res)
        metrics["strict_accuracy"] = np.mean(all_correct)

    else:
        # for multiple generations we use pass@k metric used in the HumanEval benchmark
        # we use strict accuracy, a generation is valid if it has to pass all the tests
        print("Computing pass@k metric for multiple generations...")
        # total is list with nb generations per task (task=index)
        # correct is number of generations that passed all tests per task
        total = []
        correct = [] 
        for index in results:
            all_correct = []
            for generation in results[index]:
                gen = np.array(generation)
                all_correct.append(np.all(gen>0))
            total.append(len(all_correct))
            correct.append(sum(all_correct))
        total = np.array(total)
        correct = np.array(correct)
        ks = k_list
        pass_at_k = {f"pass@{k}": estimate_pass_at_k(total, correct, k).mean() for k in ks if (total >= k).all()}
        print(pass_at_k)
        metrics["pass_at_k"] = pass_at_k
    return metrics

def compute_metrics(generations, level="all", k_list=[1, 10, 100], count_errors=True, debug=False):
    """Return metrics for the given generations.
    Args:
        generations: list of code generations for each problem (each generation is a list of generations)
        k_list: list of k values to compute pass@k when using multiple generations
        count_errors: whether to count compilation and runtime errors when using single generations
        level: difficulty level in APPS dataset that was used for the given generations (from: "all", "introductory", "interview", "competition")
    Returns:
        metrics: dict of metrics  

    Examples:

    >>> import json
    >>> # lists of solutions to the two first APPS problems (note not all solutions pass all tests)
    >>> solution_sample1 = json.load(open("test_examples/solutions_problem_1.json", "r"))
    >>> solution_sample2 = json.load(open("test_examples/solutions_problem_2.json", "r"))
    >>> single_solutions = [solution_sample1[:1], solution_sample2[:1]]
    >>> compute_metrics(single_solutions, level="all")
    Computing accuracy metrics...
    number of compile errors = 0 avg = 0.0
    number of runtime errors = 0 avg = 0.0
    number of problems evaluated = 2
    Average Accuracy : 1.0
    Strict Accuracy : 1.0
    {'avg_accuracy': 1.0, 'strict_accuracy': 1.0, 'pass_at_k': None}
    >>> multiple_solutions = [solution_sample1[:3], solution_sample2[:3]]
    >>> compute_metrics(multiple_solutions, level="all", k_list=[1, 2, 3])
    Computing pass@k metric for multiple generations...
    {'pass@1': 1.0, 'pass@2': 1.0, 'pass@3': 1.0}
    {'avg_accuracy': None, 'strict_accuracy': None, 'pass_at_k': {'pass@1': 1.0, 'pass@2': 1.0, 'pass@3': 1.0}}
    """
    results = evaluate_generations(generations, level=level, debug=debug)
    metrics = get_results(results, count_errors=count_errors, k_list=k_list)
    return metrics

# import doctest
# doctest.testmod()

```

### Core Architecture Module: `mint/utils/__init__.py`
```
import functools

# use cache to avoid loading the same file multiple times
# which can leads to too many open files error
@functools.lru_cache(maxsize=128)
def load_file(filepath: str) -> str:
    with open(filepath, "r") as f:
        content = f.read()
    return content

```

### Core Architecture Module: `mint/utils/exception.py`
```
class ParseError(Exception):
    pass


class ToolExecutionError(Exception):
    pass


class LMExecutionTimeoutError(Exception):
    pass

```

### Core Architecture Module: `mint/utils/exec.py`
```
"""Check the correctness of a program by running a test suite.

Modified from: https://github.com/openai/human-eval/blob/master/human_eval/execution.py
"""

from typing import Optional, Callable, Dict
import ast
import contextlib
import faulthandler
import io
import os
import multiprocessing
import platform
import signal
import tempfile


def check_correctness(
    solution_code: str,
    test_code: str,
    timeout: float = 10,
    completion_id: Optional[int] = None,
) -> Dict:
    """
    Evaluates the functional correctness of a completion by running the test
    suite provided in the problem.

    :param completion_id: an optional completion ID so we can match
        the results later even if execution finishes asynchronously.
    """

    def unsafe_execute():
        with create_tempdir():
            # These system calls are needed when cleaning up tempdir.
            import os
            import shutil

            rmtree = shutil.rmtree
            rmdir = os.rmdir
            chdir = os.chdir

            # Disable functionalities that can make destructive changes to the test.
            reliability_guard()

            # Construct the check program and run it.
            check_program = solution_code + "\n" + test_code

            try:
                exec_globals = {}
                with swallow_io():
                    with time_limit(timeout):
                        # WARNING
                        # This program exists to execute untrusted model-generated code. Although
                        # it is highly unlikely that model-generated code will do something overtly
                        # malicious in response to this test suite, model-generated code may act
                        # destructively due to a lack of model capability or alignment.
                        # Users are strongly encouraged to sandbox this evaluation suite so that it
                        # does not perform destructive actions on their host or network. For more
                        # information on how OpenAI sandboxes its code, see the accompanying paper.
                        # Once you have read this disclaimer and taken appropriate precautions,
                        # uncomment the following line and proceed at your own risk:
                        exec(check_program, exec_globals)
                result.append("passed")
            except TimeoutException:
                result.append("timed out")
            except BaseException as e:
                result.append(f"failed: {e}")

            # Needed for cleaning up.
            shutil.rmtree = rmtree
            os.rmdir = rmdir
            os.chdir = chdir

    manager = multiprocessing.Manager()
    result = manager.list()

    p = multiprocessing.Process(target=unsafe_execute)
    p.start()
    p.join(timeout=timeout + 1)
    if p.is_alive():
        p.kill()

    if not result:
        result.append("timed out")

    return dict(
        success=result[0] == "passed",
        result=result[0],
        completion_id=completion_id,
    )


@contextlib.contextmanager
def time_limit(seconds: float):
    def signal_handler(signum, frame):
        raise TimeoutException("Timed out!")

    signal.setitimer(signal.ITIMER_REAL, seconds)
    signal.signal(signal.SIGALRM, signal_handler)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)


@contextlib.contextmanager
def swallow_io():
    stream = WriteOnlyStringIO()
    with contextlib.redirect_stdout(stream):
        with contextlib.redirect_stderr(stream):
            with redirect_stdin(stream):
                yield


@contextlib.contextmanager
def create_tempdir():
    # with tempfile.TemporaryDirectory() as dirname:
    # Manually do this to avoid too many open files error caused by TemporaryDirectory
    dirname = tempfile.mkdtemp()
    with chdir(dirname):
        yield dirname
    os.rmdir(dirname)


class TimeoutException(Exception):
    pass


class WriteOnlyStringIO(io.StringIO):
    """StringIO that throws an exception when it's read from"""

    def read(self, *args, **kwargs):
        raise IOError

    def readline(self, *args, **kwargs):
        raise IOError

    def readlines(self, *args, **kwargs):
        raise IOError

    def readable(self, *args, **kwargs):
        """Returns True if the IO object can be read."""
        return False


class redirect_stdin(contextlib._RedirectStream):  # type: ignore
    _stream = "stdin"


@contextlib.contextmanager
def chdir(root):
    if root == ".":
        yield
        return
    cwd = os.getcwd()
    os.chdir(root)
    try:
        yield
    except BaseException as exc:
        raise exc
    finally:
        os.chdir(cwd)


def reliability_guard(maximum_memory_bytes: Optional[int] = None):
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

    builtins.exit = None
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

```

### Core Architecture Module: `scripts/eval/api-bank/apis/search_engine.py`
```
from apis.api import API
from rank_bm25 import BM25Okapi
import numpy as np
import nltk
try:
    from nltk.tokenize import word_tokenize
except:
    nltk.download('punkt')
    from nltk.tokenize import word_tokenize

class SearchEngine(API):
    description = 'This API searches for a given keyword for search engine.'
    input_parameters = {
        "keyword": {'type': 'str', 'description': 'The keyword to search.'},
    }
    output_parameters = {
        "results": {'type': 'list', 'description': 'The list of results.'},
    }
    database_name = 'SearchEngine'
    """
    database = {
        "item1": {
            "title": "title1",
            "url": "url1",
            "abstract": "abstract1",
        },
        "item2": {
            "title": "title2",
            "url": "url2",
            "abstract": "abstract2",
        },
        "item3": {
            "title": "title3",
            "url": "url3",
            "abstract": "abstract3",
        },
        "item4": {
            "title": "title4",
            "url": "url4",
            "abstract": "abstract4",
        },
    }
    """

    def __init__(self, init_database=None) -> None:
        if init_database != None:
            self.database = init_database
        else:
            self.database = {}
        self.bm25 = BM25Okapi(self.database['tokenized_documents'])

    def call(self, keyword: str) -> dict:
        """
        Calls the API with the given parameters.

        Parameters:
        - keyword (str): the keyword to search.

        Returns:
        - response (dict): the response from the API call.
        """
        input_parameters = {
            'keyword': keyword,
        }
        try:
            results = self.search(keyword)
        except Exception as e:
            exception = str(e)
            return {
                'api_name': self.__class__.__name__,
                'input': input_parameters,
                'output': None,
                'exception': exception,
            }
        else:
            return {
                'api_name': self.__class__.__name__,
                'input': input_parameters,
                'output': results,
                'exception': None,
            }

    def search(self, keyword: str) -> list:
        """
        Searches for a given keyword.

        Parameters:
        - keyword (str): the keyword to search.

        Returns:
        - results (list): the list of results.
        """
        keyword = keyword.lower().strip()
        query = word_tokenize(keyword) # keyword.split()
        rankings = np.argsort(-np.array(self.bm25.get_scores(query)))
        if len(rankings) > 2:
            rankings = rankings[:2]
        results = [self.database["raw_documents"][i] for i in rankings]
        return results
    
    def check_api_call_correctness(self, response, groundtruth) -> bool:
        """
        Checks the correctness of the API call.

        Parameters:
        - response (dict): the response from the API call.
        - groundtruth (dict): the groundtruth from the API call.

        Returns:
        - correctness (bool): whether the response is correct.
        """
        if response['api_name'] != groundtruth['api_name']:
            return False
        if response['exception'] != groundtruth['exception']:
            return False
        if response['output'] != None:
            response_output = sorted(response['output'], key=lambda x: x['title']+x['abstract'], reverse=True)
        if groundtruth['output'] != None:
            groundtruth_output = sorted(groundtruth['output'], key=lambda x: x['title']+x['abstract'], reverse=True)
        if response_output != groundtruth_output:
            return False
        return True


```

### Core Architecture Module: `scripts/eval/api-bank/utils.py`
```
import openai
import backoff
import logging
import requests
import os
import json
import google.generativeai as genai

logger = logging.getLogger("backoff")
logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)


class GeminiWrapper:

    ROLE_MAPPING = {
        "system": "system",
        "assistant": "model",
        "user": "user"
    }
    def __init__(self, model_name) -> None:
        self.model_name = model_name
        assert "gemini" in self.model_name
        self.model = genai.GenerativeModel(self.model_name)

    @backoff.on_exception(
        backoff.expo,
        Exception,
        logger=logger,
    )
    def call(self, messages, **kwargs):
        # https://github.com/neulab/gemini-benchmark/blob/6b3b8f18c3fbaa6df947f00fc49b87802c5e063e/benchmarking/Code/run_code.py#L17
        extra_kwargs = {}
        safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_NONE",
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_NONE",
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_NONE",
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_NONE",
            },
        ]
        extra_kwargs = {
            "safety_settings": safety_settings,
        }
        # Convert message format
        # messages = [
        #     {'role':'user',
        #     'parts': ["Briefly explain how a computer works to a young child."]}
        # ]
        messages = [
            {
                "role": self.ROLE_MAPPING[message["role"]],
                "parts": [message["content"]]
            }
            for message in messages
        ]
        # merge the system message with the first user message
        # since Gemini doesn't support system message
        if messages[0]["role"] == "system":
            if len(messages) > 1:
                assert messages[1]["role"] == "user"
                # merge the system message with the first user message
                messages[1]["parts"][0] = f"{messages[0]['parts'][0]}\n\n{messages[1]['parts'][0]}"
                messages = messages[1:]
            else:
                # if there is only one message, we just set the role to user
                messages[0]["role"] = "user"

        # if the last message is assistant, we need to add a user message (Gemini restriction)
        if messages[-1]["role"] == "model":
            messages.append({
                "role": "user",
                "parts": ["Continue."]
            })

        # concatenate any two consecutive user messages (required by Gemini)
        new_messages = []
        for message in messages:
            if message["role"] == "user" \
                and len(new_messages) > 0 and new_messages[-1]["role"] == "user":
                new_messages[-1]["parts"][0] = f"{new_messages[-1]['parts'][0]}\n\n{message['parts'][0]}"
            else:
                new_messages.append(message)
        messages = new_messages

        for message in messages:
            print(message["role"], message["parts"])

        response = self.model.generate_content(
            messages,
            **extra_kwargs
        )
        return response.text

class OpenAIChatWrapper:
    def __init__(self, model_name) -> None:
        self.model_name = model_name

    @backoff.on_exception(
        backoff.fibo,
        # https://platform.openai.com/docs/guides/error-codes/python-library-error-types
        (
            openai.error.Timeout,
            openai.error.RateLimitError,
            openai.error.ServiceUnavailableError,
            openai.error.APIConnectionError,
            
        ),
        logger=logger,
    )
    def call(self, messages, **kwargs):
        query = {
            "model": self.model_name,
            "messages": messages,
            "max_tokens": 512,
        }
        query.update(kwargs)
        try:
            response = openai.ChatCompletion.create(**query)
        except openai.error.APIError as e:
            if "maximum context length" in str(e):
                return None
            raise e
        return response


class DavinciWrapper:
    def __init__(self, model_name) -> None:
        self.model_name = model_name

    @backoff.on_exception(
        backoff.fibo,
        # https://platform.openai.com/docs/guides/error-codes/python-library-error-types
        (
            openai.error.Timeout,
            openai.error.RateLimitError,
            openai.error.ServiceUnavailableError,
            openai.error.APIConnectionError,
        ),
        logger=logger,
    )
    def call(self, messages, **kwargs):

        # messages to prompt
        prompt = ''
        for message in messages:
            prompt += message['role'] + ': ' + message['content'] + '\n'

        query = {
            "model": self.model_name,
            "prompt": prompt,
            "max_tokens": 512,
        }
        query.update(kwargs)
        response = openai.Completion.create(**query)
        return response

class ClaudeWrapper:

    url = "https://api.anthropic.com/v1/complete"
    headers = {
        "accept": "application/json",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": os.environ.get("ANTHROPIC_API_KEY"),
    }
    def __init__(self, model_name) -> None:
        self.model_name = model_name

    @backoff.on_exception(
        backoff.expo,
        requests.exceptions.RequestException,
    )
    def call(self, messages, **kwargs):
        # Prepend the prompt with the system message
        data = {
            "model": self.model_name,
            "prompt": "",
            "max_tokens_to_sample": 512,
            # "temperature": self.config.get("temperature", 0),
            # "stop_sequences": self.stop_words,
        }
        for message in messages:
            if message["role"] == "user" or message["role"] == "system":
                data["prompt"] += f"\n\nHuman: {message['content']}"
            else:
                data["prompt"] += f"\n\nAssistant: {message['content']}"
        data["prompt"] += "\n\nAssistant:"

        response = requests.post(self.url, headers=self.headers, json=data)

        if response.status_code == 200:
            pass
        else:
            logger.error(response.text)
            raise requests.exceptions.RequestException(
                "Request failed with status code:", response.status_code
            )

        return json.loads(response.text)["completion"]

```

### Core Architecture Module: `scripts/eval/miniwob++/computergym/computergym/miniwob/miniwob_interface/html/common/ui_utils.js`
```
var ui_utils = {};

ui_utils.COLORS = ['black', 'white', 'aqua', 'blue', 'gray', 'green', 'lime', 'maroon', 'navy', 'olive', 'purple', 'red', 'silver', 'teal', 'yellow', 'pink', 'magenta', 'gold', 'orange'];
ui_utils.PEOPLE_NAMES = ["Aaren","Aarika","Abagael","Abagail","Abbe","Abbey","Abbi","Abbie","Abby","Abbye","Abigael","Abigail","Abigale","Abra","Ada","Adah","Adaline","Adan","Adara","Adda","Addi","Addia","Addie","Addy","Adel","Adela","Adelaida","Adelaide","Adele","Adelheid","Adelice","Adelina","Adelind","Adeline","Adella","Adelle","Adena","Adey","Adi","Adiana","Adina","Adora","Adore","Adoree","Adorne","Adrea","Adria","Adriaens","Adrian","Adriana","Adriane","Adrianna","Adrianne","Adriena","Adrienne","Aeriel","Aeriela","Aeriell","Afton","Ag","Agace","Agata","Agatha","Agathe","Aggi","Aggie","Aggy","Agna","Agnella","Agnes","Agnese","Agnesse","Agneta","Agnola","Agretha","Aida","Aidan","Aigneis","Aila","Aile","Ailee","Aileen","Ailene","Ailey","Aili","Ailina","Ailis","Ailsun","Ailyn","Aime","Aimee","Aimil","Aindrea","Ainslee","Ainsley","Ainslie","Ajay","Alaine","Alameda","Alana","Alanah","Alane","Alanna","Alayne","Alberta","Albertina","Albertine","Albina","Alecia","Aleda","Aleece","Aleen","Alejandra","Alejandrina","Alena","Alene","Alessandra","Aleta","Alethea","Alex","Alexa","Alexandra","Alexandrina","Alexi","Alexia","Alexina","Alexine","Alexis","Alfi","Alfie","Alfreda","Alfy","Ali","Alia","Alica","Alice","Alicea","Alicia","Alida","Alidia","Alie","Alika","Alikee","Alina","Aline","Alis","Alisa","Alisha","Alison","Alissa","Alisun","Alix","Aliza","Alla","Alleen","Allegra","Allene","Alli","Allianora","Allie","Allina","Allis","Allison","Allissa","Allix","Allsun","Allx","Ally","Allyce","Allyn","Allys","Allyson","Alma","Almeda","Almeria","Almeta","Almira","Almire","Aloise","Aloisia","Aloysia","Alta","Althea","Alvera","Alverta","Alvina","Alvinia","Alvira","Alyce","Alyda","Alys","Alysa","Alyse","Alysia","Alyson","Alyss","Alyssa","Amabel","Amabelle","Amalea","Amalee","Amaleta","Amalia","Amalie","Amalita","Amalle","Amanda","Amandi","Amandie","Amandy","Amara","Amargo","Amata","Amber","Amberly","Ambur","Ame","Amelia","Amelie","Amelina","Ameline","Amelita","Ami","Amie","Amii","Amil","Amitie","Amity","Ammamaria","Amy","Amye","Ana","Anabal","Anabel","Anabella","Anabelle","Analiese","Analise","Anallese","Anallise","Anastasia","Anastasie","Anastassia","Anatola","Andee","Andeee","Anderea","Andi","Andie","Andra","Andrea","Andreana","Andree","Andrei","Andria","Andriana","Andriette","Andromache","Andy","Anestassia","Anet","Anett","Anetta","Anette","Ange","Angel","Angela","Angele","Angelia","Angelica","Angelika","Angelina","Angeline","Angelique","Angelita","Angelle","Angie","Angil","Angy","Ania","Anica","Anissa","Anita","Anitra","Anjanette","Anjela","Ann","Ann-Marie","Anna","Anna-Diana","Anna-Diane","Anna-Maria","Annabal","Annabel","Annabela","Annabell","Annabella","Annabelle","Annadiana","Annadiane","Annalee","Annaliese","Annalise","Annamaria","Annamarie","Anne","Anne-Corinne","Anne-Marie","Annecorinne","Anneliese","Annelise","Annemarie","Annetta","Annette","Anni","Annice","Annie","Annis","Annissa","Annmaria","Annmarie","Annnora","Annora","Anny","Anselma","Ansley","Anstice","Anthe","Anthea","Anthia","Anthiathia","Antoinette","Antonella","Antonetta","Antonia","Antonie","Antonietta","Antonina","Anya","Appolonia","April","Aprilette","Ara","Arabel","Arabela","Arabele","Arabella","Arabelle","Arda","Ardath","Ardeen","Ardelia","Ardelis","Ardella","Ardelle","Arden","Ardene","Ardenia","Ardine","Ardis","Ardisj","Ardith","Ardra","Ardyce","Ardys","Ardyth","Aretha","Ariadne","Ariana","Aridatha","Ariel","Ariela","Ariella","Arielle","Arlana","Arlee","Arleen","Arlen","Arlena","Arlene","Arleta","Arlette","Arleyne","Arlie","Arliene","Arlina","Arlinda","Arline","Arluene","Arly","Arlyn","Arlyne","Aryn","Ashely","Ashia","Ashien","Ashil","Ashla","Ashlan","Ashlee","Ashleigh","Ashlen","Ashley","Ashli","Ashlie","Ashly","Asia","Astra","Astrid","Astrix","Atalanta","Athena","Athene","Atlanta","Atlante","Auberta","Aubine","Aubree","Aubrette","Aubrey","Aubrie","Aubry","Audi","Audie","Audra","Audre","Audrey","Audrie","Audry","Audrye","Audy","Augusta","Auguste","Augustina","Augustine","Aundrea","Aura","Aurea","Aurel","Aurelea","Aurelia","Aurelie","Auria","Aurie","Aurilia","Aurlie","Auroora","Aurora","Aurore","Austin","Austina","Austine","Ava","Aveline","Averil","Averyl","Avie","Avis","Aviva","Avivah","Avril","Avrit","Ayn","Bab","Babara","Babb","Babbette","Babbie","Babette","Babita","Babs","Bambi","Bambie","Bamby","Barb","Barbabra","Barbara","Barbara-Anne","Barbaraanne","Barbe","Barbee","Barbette","Barbey","Barbi","Barbie","Barbra","Barby","Bari","Barrie","Barry","Basia","Bathsheba","Batsheva","Bea","Beatrice","Beatrisa","Beatrix","Beatriz","Bebe","Becca","Becka","Becki","Beckie","Becky","Bee","Beilul","Beitris","Bekki","Bel","Belia","Belicia","Belinda","Belita","Bell","Bella","Bellanca","Belle","Bellina","Belva","Belvia","Bendite","Benedetta","Benedicta","Benedikta","Benetta","Benita","Benni","Bennie","Benny","Benoite","Berenice","Beret","Berget","Berna","Bernadene","Bernadette","Bernadina","Bernadine","Bernardina","Bernardine","Bernelle","Bernete","Bernetta","Bernette","Berni","Bernice","Bernie","Bernita","Berny","Berri","Berrie","Berry","Bert","Berta","Berte","Bertha","Berthe","Berti","Bertie","Bertina","Bertine","Berty","Beryl","Beryle","Bess","Bessie","Bessy","Beth","Bethanne","Bethany","Bethena","Bethina","Betsey","Betsy","Betta","Bette","Bette-Ann","Betteann","Betteanne","Betti","Bettina","Bettine","Betty","Bettye","Beulah","Bev","Beverie","Beverlee","Beverley","Beverlie","Beverly","Bevvy","Bianca","Bianka","Bibbie","Bibby","Bibbye","Bibi","Biddie","Biddy","Bidget","Bili","Bill","Billi","Billie","Billy","Billye","Binni","Binnie","Binny","Bird","Birdie","Birgit","Birgitta","Blair","Blaire","Blake","Blakelee","Blakeley","Blanca","Blanch","Blancha","Blanche","Blinni","Blinnie","Blinny","Bliss","Blisse","Blithe","Blondell","Blondelle","Blondie","Blondy","Blythe","Bobbe","Bobbee","Bobbette","Bobbi","Bobbie","Bobby","Bobbye","Bobette","Bobina","Bobine","Bobinette","Bonita","Bonnee","Bonni","Bonnibelle","Bonnie","Bonny","Brana","Brandais","Brande","Brandea","Brandi","Brandice","Brandie","Brandise","Brandy","Breanne","Brear","Bree","Breena","Bren","Brena","Brenda","Brenn","Brenna","Brett","Bria","Briana","Brianna","Brianne","Bride","Bridget","Bridgette","Bridie","Brier","Brietta","Brigid","Brigida","Brigit","Brigitta","Brigitte","Brina","Briney","Brinn","Brinna","Briny","Brit","Brita","Britney","Britni","Britt","Britta","Brittan","Brittaney","Brittani","Brittany","Britte","Britteny","Brittne","Brittney","Brittni","Brook","Brooke","Brooks","Brunhilda","Brunhilde","Bryana","Bryn","Bryna","Brynn","Brynna","Brynne","Buffy","Bunni","Bunnie","Bunny","Cacilia","Cacilie","Cahra","Cairistiona","Caitlin","Caitrin","Cal","Calida","Calla","Calley","Calli","Callida","Callie","Cally","Calypso","Cam","Camala","Camel","Camella","Camellia","Cami","Camila","Camile","Camilla","Camille","Cammi","Cammie","Cammy","Candace","Candi","Candice","Candida","Candide","Candie","Candis","Candra","Candy","Caprice","Cara","Caralie","Caren","Carena","Caresa","Caressa","Caresse","Carey","Cari","Caria","Carie","Caril","Carilyn","Carin","Carina","Carine","Cariotta","Carissa","Carita","Caritta","Carla","Carlee","Carleen","Carlen","Carlene","Carley","Carlie","Carlin","Carlina","Carline","Carlita","Carlota","Carlotta","Carly","Carlye","Carlyn","Carlynn","Carlynne","Carma","Carmel","Carmela","Carmelia","Carmelina","Carmelita","Carmella","Carmelle","Carmen","Carmencita","Carmina","Carmine","Carmita","Carmon","Caro","Carol","Carol-Jean","Carola","Carolan","Carolann","Carole","Carolee","Carolin","Carolina","Caroline","Caroljean","Carolyn","Carolyne","Carolynn","Caron","Carree","Carri","Carrie","Carrissa","Carroll","Carry","Cary","Caryl","Caryn","Casandra","Casey","Casi","Casie","Cass","Cassandra","Cassandre","Cassandry","Cassaundra","Cassey","Cassi","Cassie","Cassondra","Cassy","Catarina","Cate","Caterina","Catha","Catharina","Catharine","Cathe","Cathee","Catherin","Catherina","Catherine","Cathi","Cathie","Cathleen","Cathlene","Cathrin","Cathrine","Cathryn","Cathy","Cathyleen","Cati","Catie","Catina","Catlaina","Catlee","Catlin","Catrina","Catriona","Caty","Caye","Cayla","Cecelia","Cecil","Cecile","Ceciley","Cecilia","Cecilla","Cecily","Ceil","Cele","Celene","Celesta","Celeste","Celestia","Celestina","Celestine","Celestyn","Celestyna","Celia","Celie","Celina","Celinda","Celine","Celinka","Celisse","Celka","Celle","Cesya","Chad","Chanda","Chandal","Chandra","Channa","Chantal","Chantalle","Charil","Charin","Charis","Charissa","Charisse","Charita","Charity","Charla","Charlean","Charleen","Charlena","Charlene","Charline","Charlot","Charlotta","Charlotte","Charmain","Charmaine","Charmane","Charmian","Charmine","Charmion","Charo","Charyl","Chastity","Chelsae","Chelsea","Chelsey","Chelsie","Chelsy","Cher","Chere","Cherey","Cheri","Cherianne","Cherice","Cherida","Cherie","Cherilyn","Cherilynn","Cherin","Cherise","Cherish","Cherlyn","Cherri","Cherrita","Cherry","Chery","Cherye","Cheryl","Cheslie","Chiarra","Chickie","Chicky","Chiquia","Chiquita","Chlo","Chloe","Chloette","Chloris","Chris","Chrissie","Chrissy","Christa","Christabel","Christabella","Christal","Christalle","Christan","Christean","Christel","Christen","Christi","Christian","Christiana","Christiane","Christie","Christin","Christina","Christine","Christy","Christye","Christyna","Chrysa","Chrysler","Chrystal","Chryste","Chrystel","Cicely","Cicily","Ciel","Cilka","Cinda","Cindee","Cindelyn","Cinderella","Cindi","Cindie","Cindra","Cindy","Cinnamon","Cissiee","Cissy","Clair","Claire","Clara","Clarabelle","Clare","Claresta","Clareta","Claretta","Clarette","Clarey","Clari","Claribel","Clarice","Clarie","Clarinda","Clarine","Clarissa","Clarisse","Clarita","Clary","Claude","Claudelle","Claudetta","Claudette","Claudia","Claudie","Claudina","Claudine","Clea","Clem","C
```

### Core Architecture Module: `scripts/eval/miniwob++/computergym/computergym/miniwob/miniwob_interface/html/core/core.js`
```
var core = {};

// various common utilities

// seedrandom.min.js -- https://github.com/davidbau/seedrandom
// Usage: Math.seedrandom('hello.'); -- Set the seed
// Usage: Math.seedrandom(); -- Automatically set a random seed
!function (a, b) { function c(c, j, k) { var n = []; j = 1 == j ? { entropy: !0 } : j || {}; var s = g(f(j.entropy ? [c, i(a)] : null == c ? h() : c, 3), n), t = new d(n), u = function () { for (var a = t.g(m), b = p, c = 0; a < q;)a = (a + c) * l, b *= l, c = t.g(1); for (; a >= r;)a /= 2, b /= 2, c >>>= 1; return (a + c) / b }; return u.int32 = function () { return 0 | t.g(4) }, u.quick = function () { return t.g(4) / 4294967296 }, u.double = u, g(i(t.S), a), (j.pass || k || function (a, c, d, f) { return f && (f.S && e(f, t), a.state = function () { return e(t, {}) }), d ? (b[o] = a, c) : a })(u, s, "global" in j ? j.global : this == b, j.state) } function d(a) { var b, c = a.length, d = this, e = 0, f = d.i = d.j = 0, g = d.S = []; for (c || (a = [c++]); e < l;)g[e] = e++; for (e = 0; e < l; e++)g[e] = g[f = s & f + a[e % c] + (b = g[e])], g[f] = b; (d.g = function (a) { for (var b, c = 0, e = d.i, f = d.j, g = d.S; a--;)b = g[e = s & e + 1], c = c * l + g[s & (g[e] = g[f = s & f + b]) + (g[f] = b)]; return d.i = e, d.j = f, c })(l) } function e(a, b) { return b.i = a.i, b.j = a.j, b.S = a.S.slice(), b } function f(a, b) { var c, d = [], e = typeof a; if (b && "object" == e) for (c in a) try { d.push(f(a[c], b - 1)) } catch (a) { } return d.length ? d : "string" == e ? a : a + "\0" } function g(a, b) { for (var c, d = a + "", e = 0; e < d.length;)b[s & e] = s & (c ^= 19 * b[s & e]) + d.charCodeAt(e++); return i(b) } function h() { try { var b; return j && (b = j.randomBytes) ? b = b(l) : (b = new Uint8Array(l), (k.crypto || k.msCrypto).getRandomValues(b)), i(b) } catch (b) { var c = k.navigator, d = c && c.plugins; return [+new Date, k, d, k.screen, i(a)] } } function i(a) { return String.fromCharCode.apply(0, a) } var j, k = this, l = 256, m = 6, n = 52, o = "random", p = b.pow(l, m), q = b.pow(2, n), r = 2 * q, s = l - 1; if (b["seed" + o] = c, g(b.random(), a), "object" == typeof module && module.exports) { module.exports = c; try { j = require("crypto") } catch (a) { } } else "function" == typeof define && define.amd && define(function () { return c }) }([], Math);

core.randi = function (min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

core.randf = function (min, max) {
  return Math.random() * (max - min) + min;
}

core.sample = function (lst) {
  var ix = core.randi(0, lst.length);
  return lst[ix];
}

// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
core.shuffle = function (array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

// utilities for timing episodes
var WOB_REWARD_GLOBAL = 0; // what was reward in previous iteration?
var WOB_RAW_REWARD_GLOBAL = 0; // reward without time penalty
var WOB_REWARD_REASON = null; // reason for the reward
var WOB_DONE_GLOBAL = false; // a done indicator
var WOB_EPISODE_ID = 0; // number of episodes done so far
var WOB_TASK_READY = true; // override this to show that the task is not ready yet
core.EPISODE_MAX_TIME = 1000000; // in ms. Set default time to 10s.

// https://stackoverflow.com/questions/3169786/clear-text-selection-with-javascript
// this piece of code clears the selection in a new episode, if a user happened
// to select some part of text. We don't want this to persist across episodes
core.clearUserSelection = function () {
  if (window.getSelection) {
    if (window.getSelection().empty) {  // Chrome
      window.getSelection().empty();
    } else if (window.getSelection().removeAllRanges) {  // Firefox
      window.getSelection().removeAllRanges();
    }
  } else if (document.selection) {  // IE?
    document.selection.empty();
  }
}

core.EP_TIMER = null; // stores timer id
core.CD_TIMER = null; // stores timer ID for displaying rewards
core.ept0 = null; // stores system time when episode begins (so we can time it)
core.cover_div = null; // cover div for synchronization

core.startEpisode = function () {
  core.createDisplay();
  if (core.cover_div == null) {
    core.cover_div = document.createElement('div');
    core.cover_div.setAttribute('id', 'sync-task-cover');
    core.cover_div.innerHTML = 'START';
    core.cover_div.onclick = function () {
      core.startEpisodeReal();
    };
    document.body.appendChild(core.cover_div);
  }
  core.cover_div.style.display = 'block';
}

core.startEpisodeReal = function () {
  core.resetRefCode();
  genProblem();
  WOB_DONE_GLOBAL = false;
  WOB_REWARD_GLOBAL = 0;
  WOB_RAW_REWARD_GLOBAL = 0;
  WOB_REWARD_REASON = null;
  core.clearUserSelection();
  core.canvasClear();
  core.cover_div.style.display = 'none';
  core.ept0 = new Date().getTime();
  core.countdownTimer(core.EPISODE_MAX_TIME);
  // start an end of episode timer
  if (core.EP_TIMER !== null) { clearTimeout(core.EP_TIMER); } // reset timer if needed
  core.EP_TIMER = setTimeout(function () {
    core.endEpisode(-1, false, 'timed out'); // time ran out
  }, core.EPISODE_MAX_TIME);
}

core.endEpisode = function (reward, time_proportional, reason) {
  // stop timer and set to null, so that only one event gets rewarded
  // for any given episode.
  if (core.EP_TIMER !== null) {
    clearTimeout(core.EP_TIMER);
    core.EP_TIMER = null;
  } else {
    // if timer is null, don't reward anything and exit out.
    return;
  }

  WOB_RAW_REWARD_GLOBAL = reward;
  WOB_REWARD_REASON = reason;

  // adjust reward based on time, so acting early is encouraged
  var ept1 = new Date().getTime(); // get system time
  if (typeof time_proportional === 'undefined') { time_proportional = false; }
  if (time_proportional) {
    var dt = ept1 - core.ept0; // difference in ms since start of ep
    reward = reward * Math.max(0, 1.0 - dt / core.EPISODE_MAX_TIME);
  }

  WOB_REWARD_GLOBAL = reward; // add to global, to be accessed from Python
  WOB_DONE_GLOBAL = true;
  WOB_EPISODE_ID++;
  document.getElementById('episode-id').innerHTML = WOB_EPISODE_ID;
  // console.log('reward: ' + WOB_REWARD_GLOBAL + ' (raw: ' + WOB_RAW_REWARD_GLOBAL + ')');
  core.updateDisplay(reward);
  core.clearTimer();

  // start a new problem with a new timer. add a slight delay so that the problem
  // isn't generated immediately, which can lead to accidental clicking.
  //setTimeout(function(){
  //  core.startEpisode();
  //}, 500);

  // With the sync screen, the timeout above is redundant
  core.startEpisode();
}

// returns parameters passed in the url.
// e.g. ?topic=123&name=query+string in the url would return
// QueryString["topic"];    // 123
// QueryString["name"];     // query string
// QueryString["nothere"];  // undefined (object)
core.QueryString = (function (a) {
  if (a == "") return {};
  var b = {};
  for (var i = 0; i < a.length; ++i) {
    var p = a[i].split('=', 2);
    if (p.length == 1)
      b[p[0]] = "";
    else
      b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
  }
  return b;
})(window.location.search.substr(1).split('&'));

core.getOpt = function (d, k, def) {
  var v = d[k]
  return typeof v === 'undefined' ? def : v;
}

// template used to create the reward display HUD. This HTML
// gets wrapped inside a <div id='reward-display'> element.

core.DISPLAY_HTML = `
  <div class="info">
    <label>Last reward:</label>
    <span id='reward-last'>-</span>
  </div>
  <div class="info">
    <label>Last 10 average:</label>
    <span id='reward-avg'>-</span>
  </div>
  <div class="info">
    <label>Time left:</label>
    <span id='timer-countdown'>-</span>
  </div>
  <div class="info">
    <label>Episodes done:</label>
    <span id='episode-id'>0</span>
  </div>
`;

// create element via JS; appending the HTML template
// directly to the body will cause jQuery UI elements
// to freak out.
core.createDisplay = function () {
  var display = document.getElementById('reward-display');
  if (display === null) {
    // Click visualizer
    var canvas = document.createElement('canvas');
    canvas.setAttribute('id', 'click-canvas');
    canvas.setAttribute('width', 160);
    canvas.setAttribute('height', 210);
    document.body.appendChild(canvas);
    document.body.addEventListener('click', core.canvasDrawClick);
    // Reward display
    var newDiv = document.createElement('div');
    newDiv.setAttribute('id', 'reward-display');
    newDiv.innerHTML = core.DISPLAY_HTML;
    document.body.appendChild(newDiv);
  }
  core.reloadDisplay();
}

// reload the display, reward stats should be persistent
// across all tasks and not just within a single task.
core.reloadDisplay = function () {
  core.wob_latest = core.wob_latest || '-';
  core.wob_scores = core.wob_scores || [];

  if (core.wob_latest !== '-') {
    var latestColor = core.computeColor(core.wob_latest);
    document.getElementById('reward-last').setAttribute('style', 'color: ' + latestColor);
    document.getElementById('reward-last').innerHTML = core.wob_latest.toFixed(2);
  }

  if (core.wob_scores.length > 0) {
    var avg = core.rewardAvg();
    var avgColor = core.computeColor(avg);
    document.getElementById('reward-avg').setAttribute('style', 'color: ' + avgColor);
    document.getElementById('reward-avg').innerHTML = avg.toFixed(2);
  }
}

core.updateDisplay = function (reward) {
  core.wob_latest = reward;
  core.wob_scores.push(reward);
  core.wob_scores = core.wob_scores.splice(-10); // only keep the last 10 rewards.

  var avg = core.rewardAvg();
  var avgColor = core.computeColor(avg);
  var latestColor 
```

### Core Architecture Module: `scripts/eval/miniwob++/computergym/computergym/miniwob/miniwob_interface/html/core/jquery-ui/external/jquery/jquery.js`
```
/*!
 * jQuery JavaScript Library v1.12.4
 * http://jquery.com/
 *
 * Includes Sizzle.js
 * http://sizzlejs.com/
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2016-05-20T17:17Z
 */

(function( global, factory ) {

	if ( typeof module === "object" && typeof module.exports === "object" ) {
		// For CommonJS and CommonJS-like environments where a proper `window`
		// is present, execute the factory and get jQuery.
		// For environments that do not have a `window` with a `document`
		// (such as Node.js), expose a factory as module.exports.
		// This accentuates the need for the creation of a real `window`.
		// e.g. var jQuery = require("jquery")(window);
		// See ticket #14549 for more info.
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
}(typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

// Support: Firefox 18+
// Can't be in strict mode, several libs including ASP.NET trace
// the stack via arguments.caller.callee and Firefox dies if
// you try to trace through "use strict" call chains. (#13335)
//"use strict";
var deletedIds = [];

var document = window.document;

var slice = deletedIds.slice;

var concat = deletedIds.concat;

var push = deletedIds.push;

var indexOf = deletedIds.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var support = {};



var
	version = "1.12.4",

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {

		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	},

	// Support: Android<4.1, IE<9
	// Make sure we trim BOM and NBSP
	rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,

	// Matches dashed string for camelizing
	rmsPrefix = /^-ms-/,
	rdashAlpha = /-([\da-z])/gi,

	// Used by jQuery.camelCase as callback to replace()
	fcamelCase = function( all, letter ) {
		return letter.toUpperCase();
	};

jQuery.fn = jQuery.prototype = {

	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// Start with an empty selector
	selector: "",

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {
		return num != null ?

			// Return just the one element from the set
			( num < 0 ? this[ num + this.length ] : this[ num ] ) :

			// Return all the elements in a clean array
			slice.call( this );
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;
		ret.context = this.context;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	each: function( callback ) {
		return jQuery.each( this, callback );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map( this, function( elem, i ) {
			return callback.call( elem, i, elem );
		} ) );
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor();
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: deletedIds.sort,
	splice: deletedIds.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var src, copyIsArray, copy, name, options, clone,
		target = arguments[ 0 ] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !jQuery.isFunction( target ) ) {
		target = {};
	}

	// extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {

		// Only deal with non-null/undefined values
		if ( ( options = arguments[ i ] ) != null ) {

			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
					( copyIsArray = jQuery.isArray( copy ) ) ) ) {

					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && jQuery.isArray( src ) ? src : [];

					} else {
						clone = src && jQuery.isPlainObject( src ) ? src : {};
					}

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend( {

	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	// See test/unit/core.js for details concerning isFunction.
	// Since version 1.3, DOM methods and functions like alert
	// aren't supported. They return false on IE (#2968).
	isFunction: function( obj ) {
		return jQuery.type( obj ) === "function";
	},

	isArray: Array.isArray || function( obj ) {
		return jQuery.type( obj ) === "array";
	},

	isWindow: function( obj ) {
		/* jshint eqeqeq: false */
		return obj != null && obj == obj.window;
	},

	isNumeric: function( obj ) {

		// parseFloat NaNs numeric-cast false positives (null|true|false|"")
		// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
		// subtraction forces infinities to NaN
		// adding 1 corrects loss of precision from parseFloat (#15100)
		var realStringObj = obj && obj.toString();
		return !jQuery.isArray( obj ) && ( realStringObj - parseFloat( realStringObj ) + 1 ) >= 0;
	},

	isEmptyObject: function( obj ) {
		var name;
		for ( name in obj ) {
			return false;
		}
		return true;
	},

	isPlainObject: function( obj ) {
		var key;

		// Must be an Object.
		// Because of IE, we also have to check the presence of the constructor property.
		// Make sure that DOM nodes and window objects don't pass through, as well
		if ( !obj || jQuery.type( obj ) !== "object" || obj.nodeType || jQuery.isWindow( obj ) ) {
			return false;
		}

		try {

			// Not own constructor property must be Object
			if ( obj.constructor &&
				!hasOwn.call( obj, "constructor" ) &&
				!hasOwn.call( obj.constructor.prototype, "isPrototypeOf" ) ) {
				return false;
			}
		} catch ( e ) {

			// IE8,9 Will throw exceptions on certain host objects #9897
			return false;
		}

		// Support: IE<9
		// Handle iteration over inherited properties before own properties.
		if ( !support.ownFirst ) {
			for ( key in obj ) {
				return hasOwn.call( obj, key );
			}
		}

		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.
		for ( key in obj ) {}

		return key === undefined || hasOwn.call( obj, key );
	},

	type: function( obj ) {
		if ( obj == null ) {
			return obj + "";
		}
		return typeof obj === "object" || typeof obj === "function" ?
			class2type[ toString.call( obj ) ] || "object" :
			typeof obj;
	},

	// Workarounds based on findings by Jim Driscoll
	// http://weblogs.java.net/blog/driscoll/archive/2009/09/08/eval-javascript-global-context
	globalEval: function( data ) {
		if ( data && jQuery.trim( data ) ) {

			// We use execScript on Internet Explorer
			// We use an anonymous function so that context is window
			// rather than jQuery in Firefox
			( window.execScript || function( data ) {
				window[ "eval" ].call( window, data ); // jscs:ignore requireDotNotation
			} )( data );
		}
	},

	// Convert dashed to camelCase; used by the css and data modules
	// Microsoft forgot to hump their vendor prefix (#9572)
	camelCase: function( string ) {
		return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
	},

	nodeName: function( elem, name ) {
		return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
	},

	each: function( obj, callback ) {
		var length, i = 0;

		if ( isArrayLike( obj ) ) {
			length = obj.length;
			for ( ; i < length; i++ ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		} else {
			for ( i in obj ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		}

		return obj;
	},

	// Support: Android<4.1, IE<9
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArrayLike( Object( arr ) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
					[ arr ] : arr
				);
			} else {
				
```

### Core Architecture Module: `scripts/eval/miniwob++/computergym/computergym/miniwob/miniwob_interface/html/core/record.js`
```
// ################################################
// Record demonstrations

/* POST submit format

* utterance
* states: array of objects with the following keys:
  - time: time elapsed
  - dom: DOM structure
  - action: action performed at that moment
* reward

*/

var recorder = {};
recorder.SERVER_DEFAULT = 'http://localhost:8032';
recorder.DISPLAY_HTML = `
  <div class="info">
    <label>Server URL:</label>
    <span id='server-name'>-</span>
  </div>
  <div class="info">
    <label>Server reply:</label>
    <span id='server-reply'>-</span>
  </div>
`;

// Add event listeners
recorder.LISTENERS = [
  'click',
  // 'dblclick',
  'mousedown',
  'mouseup',
  // 'keypress',
  // 'scroll',
];
recorder.setup = function () {
  if (recorder.isSetup) return;
  document.getElementById('reward-display').innerHTML += recorder.DISPLAY_HTML;
  recorder.LISTENERS.forEach(function (name) {
    document.addEventListener(name, recorder['on' + name], true);
    document.addEventListener(name, recorder['on' + name], false);
  });
  recorder.server = (core.QueryString.server || recorder.SERVER_DEFAULT) + '/record';
  document.getElementById('server-name').innerHTML = recorder.server;
  var url = window.location.pathname;
  recorder.taskName = url.substr(url.lastIndexOf('/') + 1).replace(/\.html/, '');
  recorder.isSetup = true;
}

// Start recording the episode
recorder.startRecording = function () {
  recorder.data = {};
  recorder.data.taskName = recorder.taskName;
  var utterance = core.getUtterance();
  if (typeof utterance === 'string') {
    recorder.data.utterance = utterance;
  } else {
    recorder.data.utterance = utterance.utterance;
    recorder.data.fields = utterance.fields;
  }
  recorder.data.states = [];
  recorder.isRecording = true;
  recorder.addState(null, null);
}

function rgba2rgb(rgba) {
  var rgb = []
  for (var i = 0; i < rgba.length; i += 4) {
    rgb.push([rgba[i], rgba[i + 1], rgba[i + 2]])
  }
  return rgb
}

// Add a state to the recording data
recorder.addState = function (event, action) {
  if (!recorder.isRecording) return;
  if (event && action)
    action.timing = event.eventPhase;
  // console.log('Adding state', action);
  console.log(recorder.imageCapture.track.readyState)
  console.log(recorder.imageCapture.track.enabled)
  console.log(recorder.imageCapture.track.muted)
  if (!(recorder.imageCapture.track.readyState != 'live' || !recorder.imageCapture.track.enabled || recorder.imageCapture.track.muted)) {
    recorder.takeSnapshot().then(imagebitmap => {
      let canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = 210
      let context = canvas.getContext('2d')

      context.drawImage(imagebitmap, 0, 111, imagebitmap.width, imagebitmap.height, 0, 0, imagebitmap.width, imagebitmap.height)
      var imgData = context.getImageData(0, 0, canvas.width, canvas.height).data;

      var state = {
        'time': new Date().getTime() - core.ept0,
        'action': action,
        'image': rgba2rgb(Array.from(imgData))
      };
      state.dom = core.getDOMInfo();

      recorder.data.states.push(state);
    }).catch(error => console.log(error));
  }
  if (event)
    event.target.dataset.recording_target = true;

  if (event)
    delete event.target.dataset.recording_target;
}

/*
let pre_x = 0
let pre_y = 0
recorder.onmousemove = async function (event) {
  if (event.target === core.cover_div ||
    event.pageX >= 160 || event.pageY >= 210)
    return;


  if (pre_x < event.pageX) {
    recorder.addState(event, {
      "type": "right",
      "x": event.pageX,
      "y": event.pageY,
    });
  } else if (pre_x > event.pageX) {
    recorder.addState(event, {
      "type": "left",
      "x": event.pageX,
      "y": event.pageY,
    });
  }

  if (pre_y < event.pageY) {
    recorder.addState(event, {
      "type": "down",
      "x": event.pageX,
      "y": event.pageY,
    });
  } else if (pre_y > event.pageY) {
    recorder.addState(event, {
      "type": "up",
      "x": event.pageX,
      "y": event.pageY,
    });
  }

  pre_x = event.pageX
  pre_y = event.pageY
}
*/

// Actions
recorder.ondblclick = function (event) {
  if (event.target === core.cover_div ||
    event.pageX >= 160 || event.pageY >= 210)
    return;
  recorder.addState(event, {
    'type': 'dblclick',
    'x': event.pageX,
    'y': event.pageY,
  });
}
recorder.onclick = function (event) {
  if (event.target === core.cover_div ||
    event.pageX >= 160 || event.pageY >= 210)
    return;
  recorder.addState(event, {
    'type': 'click',
    'x': event.pageX,
    'y': event.pageY,
  });
}
recorder.onmousedown = function (event) {
  if (event.target === core.cover_div ||
    event.pageX >= 160 || event.pageY >= 210)
    return;
  recorder.addState(event, {
    'type': 'mousedown',
    'x': event.pageX,
    'y': event.pageY,
  });
}
recorder.onmouseup = function (event) {
  if (event.target === core.cover_div ||
    event.pageX >= 160 || event.pageY >= 210)
    return;
  recorder.addState(event, {
    'type': 'mouseup',
    'x': event.pageX,
    'y': event.pageY,
  });
}

/*
recorder.onkeypress = async function (event) {
  recorder.addState(event, {
    'type': 'keypress',
    'keyCode': event.keyCode,
    'charCode': event.charCode,
  });
}

recorder.onscroll = async function (event) {
  // Scroll is super redundant; only keep the first one
  if (recorder.data.states.length) {
    var lastState = recorder.data.states[recorder.data.states.length - 1];
    if (lastState.action && lastState.action.type === 'scroll')
      return;
    //recorder.data.states.pop();     // <-- use this for keeping the last one
  }
  recorder.addState(event, {
    'type': 'scroll',
  });
}
*/

// End recording the episode
recorder.endRecording = function () {
  recorder.data.reward = WOB_REWARD_GLOBAL;
  recorder.data.rawReward = WOB_RAW_REWARD_GLOBAL;
  // Send the data to the server
  recorder.isRecording = false;
  var data = recorder.data;
  recorder.data = {};   // Prevent future addition
  // console.log(data);
  var req = new XMLHttpRequest();
  req.open('POST', recorder.server);
  req.setRequestHeader('Content-type', 'text/plain');
  req.onreadystatechange = function () {
    if (req.readyState === XMLHttpRequest.DONE) {
      var msg = document.getElementById('server-reply');
      if (req.status === 200) {
        msg.setAttribute('style', 'color:green');
        msg.textContent = 'OK: ' + req.responseText;
      } else {
        msg.setAttribute('style', 'color:red');
        msg.textContent = 'ERROR: ' + req.statusText;
      }
    }
  }
  req.send(JSON.stringify(data));
  // Make it ready for the next episode
  core.cover_div.classList.remove('transparent');
}

// ################################
// Wrappers
recorder.imageCapture = null
// Wrap startEpisodeReal
core.startEpisodeReal = (function (startEpisodeReal) {
  return function () {
    if (core.cover_div.classList.contains('transparent')) return;
    recorder.setup();
    recorder.startCapture().then(() => {
      recorder.startRecording();
      startEpisodeReal();
    })
      .catch(err => {
        console.log(err);
      });



  }
})(core.startEpisodeReal);

// Wrap endEpisode
core.endEpisode = (function (endEpisode) {
  return function (reward, time_proportional, reason) {
    if (core.EP_TIMER === null) return;
    core.cover_div.classList.add('transparent');

    endEpisode(reward, time_proportional, reason);
    // Delay to allow the last action to be recorded
    setTimeout(recorder.endRecording, 500);
  }
})(core.endEpisode);

// ################################################################
// Screnn capture
recorder.captureStream = null
// 화면캡쳐(video)를 시작하는 함수
recorder.startCapture = async function () {
  try {
    const displayMediaOptions = { audio: false, video: { cursor: 'never' } }
    recorder.captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
    recorder.track = recorder.captureStream.getVideoTracks()[0];
    recorder.imageCapture = new ImageCapture(recorder.track);
  } catch (err) {
    console.error(err)
  }

  return
}


// 화면캡쳐를 중지하는 함수
recorder.stopCapture = function () {
  const tracks = recorder.captureStream.getTracks()
  tracks.forEach((track) => track.stop())
}

// 스냅샷을 찍는 함수
recorder.takeSnapshot = function () {
  try {
    const image = recorder.imageCapture.grabFrame();
    return image
  }
  catch (err) {
    console.log(err)
  }

}

```

### Core Architecture Module: `scripts/eval/miniwob++/computergym/computergym/miniwob/miniwob_interface/html/flight/AA/apps/common/js/jquery/aacom/utilities/aaUtilities-2.1.js`
```
var activeDialog="";var dialogArray={};var dialogLinkObj;function aa_Utilities(){this.aaDialog=function(name,attributes){return new aa_Utilities_Dialog(name,attributes);};this.aaFormat=new aa_Utilities_Format();}function aa_Utilities_Dialog(dialog,props){var self=this;var dialogObj="",dialogName="";if(dialog!==undefined){if(typeof(dialog)=="object"){if(dialog.attr("id")!==undefined){dialogObj="#"+dialog.attr("id");dialogName=dialog.attr("id");}}else{if(typeof(dialog)=="string"){if(dialog.indexOf("#")===0){dialogObj=dialog;dialogName=dialog.replace(/#/,"");}else{dialogObj="#"+dialog+"Dialog";dialogName=dialog;}}}}var dialogObjTitle="#"+dialogName+"Title";var dialogLink=".aa-dialog-"+dialogName;var wrapperClass="aa-dialog-content-wrapper";self.version=2.1;self.jQueryUIVersion=jQuery.map(jQuery.ui.version.split("."),function(i){return("0"+i).slice(-2);}).join(".");self.initDialog=function(){props=(props!==undefined)?props:{};props.hide=(props.hide!==undefined)?props.hide:null;props.width=(props.width!==undefined)?props.width:882;props.width=(props.width=="small")?582:((props.width=="medium")?840:((props.width=="large")?926:props.width));props.height=(props.height!==undefined)?props.height:"auto";props.maxHeight=(props.maxHeight!==undefined)?props.maxHeight:600;props.minHeight=(props.minHeight!==undefined)?props.minHeight:150;props.modal=(props.modal!==undefined)?props.modal:true;props.overlay=(props.overlay!==undefined)?props.overlay:true;props.cssClass=(props.cssClass!==undefined)?props.cssClass:"";props.showClose=(props.showClose!==undefined)?props.showClose:true;props.showTitle=(props.showTitle!==undefined)?props.showTitle:true;props.showBusy=(props.showBusy!==undefined)?props.showBusy:false;props.quickflip=(props.quickflip!==undefined)?props.quickflip:false;props.buttons=(props.buttons!==undefined)?props.buttons:[];props.toggleScroll=(props.toggleScroll!==undefined)?props.toggleScroll:false;props.zIndex=(props.zIndex!==undefined)?props.zIndex:1000;props.closeOnEscape=(props.closeOnEscape!==undefined)?props.closeOnEscape:true;props.submitOnEnter=(props.submitOnEnter!==undefined)?props.submitOnEnter:false;props.title=(props.title!==undefined)?props.title:jQuery(dialogObjTitle).attr("value")||jQuery(dialogObjTitle).html();props.position=(props.position!==undefined)?props.position:"center";props.adaptive=(props.adaptive!==undefined)?props.adaptive:true;props.onOpen=(props.onOpen!==undefined)?props.onOpen:function(){};props.onClose=(props.onClose!==undefined)?props.onClose:function(){};props.onBeforeOpen=(props.onBeforeOpen!==undefined)?props.onBeforeOpen:function(){};props.onBeforeClose=(props.onBeforeClose!==undefined)?props.onBeforeClose:function(){};props.btnPaneContent=(props.btnPaneContent!==undefined)?props.btnPaneContent:jQuery(dialogObj).find("#"+dialogName+"BtnPaneContent").html();props.titlePaneContent=(props.titlePaneContent!==undefined)?props.titlePaneContent:jQuery(dialogObj).find("#"+dialogName+"TitlePaneContent").html();props.resizable=(props.resizable!==undefined)?props.resizable:true;props.aaPosition=jQuery.extend({vertical:null,horizontal:null,of:null},props.aaPosition);dialogArray[dialogObj]=props;var resizable=false;var draggable=(props.modal)?false:true;jQuery(dialogObj).addClass("aa-dialog-content-pad");if(jQuery(dialogObj).find("."+wrapperClass).length===0){jQuery(dialogObj).html('<div class="'+wrapperClass+'">'+jQuery(dialogObj).html()+"</div>");}if(props.quickflip){jQuery(dialogObj+" .quickFlip-wrapper").css({width:props.width-60,height:"auto"});jQuery(dialogObj+" .quickFlip-wrapper").quickFlip({noResize:true});jQuery(".ui-dialog .quickFlip-firstPanel").live("click",function(){setFlipPanel(0,true);return false;});jQuery(".ui-dialog .quickFlip-secondPanel").live("click",function(){setFlipPanel(1,true);return false;});jQuery(".ui-dialog .quickFlip-thirdPanel").live("click",function(){setFlipPanel(2,true);return false;});}jQuery(dialogObj).dialog({autoOpen:false,modal:props.modal,draggable:draggable,resizable:resizable,bgiframe:true,title:props.title,width:props.width,height:props.height,minHeight:props.minHeight,zIndex:props.zIndex,closeOnEscape:props.closeOnEscape,open:props.onOpen,close:props.onClose,closeText:"",beforeClose:props.onBeforeClose});if(props.buttons.length>0){var btnsArray={};var btnsClass="jQuery(dialogObj).parents('.ui-dialog').find('.ui-dialog-buttonpane button')";var btnsClick=btnsClass;for(var i=0;i<props.buttons.length;i++){var btn=props.buttons[i];btn.name=(btn.name!==undefined)?btn.name:"OK";btn.callback=(btn.callback!==undefined)?btn.callback:function(){};btn.cssClass=(btn.cssClass!==undefined)?btn.cssClass:"aa-btn-primary";btn.closeDialog=(btn.closeDialog!==undefined)?btn.closeDialog:true;btn.hideOnpanel=(btn.hideOnpanel!==undefined)?","+btn.hideOnpanel+",":"";btn.id=(btn.id!==undefined)?btn.id:dialogName+"DialogButton"+i;btnsArray[btn.name]=btn.callback;btnsClass+=".eq("+i+").attr('id', '"+btn.id+"').attr('class', 'aa-btn "+btn.cssClass+"').removeAttr('role').hover(function(){jQuery(this).removeClass('ui-state-hover')}).focus(function(){jQuery(this).removeClass('ui-state-focus')}).mousedown(function(){jQuery(this).removeClass('ui-state-active')}).keypress(function(){jQuery(this).removeClass('ui-state-active')}).end()";if(btn.closeDialog){btnsClick+=".eq("+i+").click(function(){jQuery(dialogObj).dialog('close'); return false;}).end()";}}jQuery(dialogObj).dialog("option","buttons",btnsArray);eval(btnsClick);eval(btnsClass);if(props.btnPaneContent!==undefined&&props.btnPaneContent.length){jQuery(dialogObj).parents(".ui-dialog").find(".ui-dialog-buttonpane").prepend(props.btnPaneContent);}}self.initTitleBar(dialogObj,props);if(props.toggleScroll){jQuery(dialogObj).bind("dialogclose",function(){jQuery("body").css("overflow","auto");});}jQuery(dialogObj).bind("dialogclose",_closeDialog);if(props.submitOnEnter){jQuery(dialogObj+" form input").live("keydown",function(e){var keyCode=e.keyCode||e.which;if(keyCode==13){jQuery(this).parents("form:first").submit();}});}jQuery(dialogLink).live("click",function(){self.openDialog(this);return false;});};self.initTitleBar=function(dialogObj,props){var $titleBar=jQuery(dialogObj).parents(".ui-dialog:first").find(".ui-dialog-titlebar");var $dialogTitle=$titleBar.find(".ui-dialog-title");$dialogTitle.appendTo($dialogTitle.parent());$dialogTitle.replaceWith('<h2 tabindex="0" id="'+$dialogTitle.attr("id")+'" class="'+$dialogTitle.attr("class")+'">'+$dialogTitle.html()+"</h2>");$dialogTitle.css("margin","2px");self.initCloseIcon($titleBar);if(props.showTitle&&(props.titlePaneContent!==undefined)&&(props.titlePaneContent.length>0)){$titleBar.append(props.titlePaneContent);}};self.initCloseIcon=function($titleBar){var closeText=(typeof(AAcom)!=="undefined")?AAcom.prototype.getProperty("dialog.closeText"):"Close window";var $closeTag=$titleBar.find(".ui-dialog-titlebar-close");var $closeIconHiddenText=$closeTag.find(".ui-button-text");var $closeIconTag=$closeTag.find(".ui-icon");$closeIconHiddenText.text(closeText);$closeIconTag.text("");if($closeIconHiddenText.length===0){$closeTag.append('<span class="ui-button-text hidden-accessible">'+closeText+"</span>");}$closeTag.attr("id",dialogName+"DialogClose");};self.openDialog=function(clickObj){if(dialogObj.length<=0){return false;}if(activeDialog!==""&&activeDialog!=dialogObj){if(jQuery(activeDialog).dialog("isOpen")){jQuery(activeDialog).dialog("close");}}activeDialog=dialogObj;if(jQuery(dialogObj).dialog("isOpen")){jQuery(dialogObj).dialog("close");}dialogLinkObj=clickObj;var _position=(props.adaptive&&is_phone())?"absolute":"fixed";jQuery(dialogObj).parent(".ui-dialog:first").addClass(props.cssClass);jQuery(dialogObj).parent().css("position",_position);jQuery(dialogObj).css("position","relative");jQuery(dialogObj).dialog("option","position",props.position);props.onBeforeOpen(clickObj);jQuery(dialogObj).dialog("open");self.resizeDialog();var $wrapper=jQuery(activeDialog+" ."+wrapperClass);if($wrapper.find(":input,a,[tabindex=0]").filter(":visible").length===0){$wrapper.attr("tabindex","0");}if(props.quickflip&&clickObj!==undefined){if(jQuery(clickObj).hasClass("quickFlip-secondPanel")){setFlipPanel(1,false);}else{if(jQuery(clickObj).hasClass("quickFlip-thirdPanel")){setFlipPanel(2,false);}else{setFlipPanel(0,false);}}}if(!props.overlay){jQuery(".ui-widget-overlay").css("background","none");}if(props.adaptive&&is_phone()){jQuery(dialogObj).parent(".ui-dialog:first").css("top",getPositionTop());}if(props.showClose!==null&&!props.showClose){jQuery(dialogObj).parents(".ui-dialog:first").find(".ui-dialog-titlebar-close").remove();}if(props.showTitle!==null&&!props.showTitle){jQuery(dialogObj).parents(".ui-dialog:first").find(".ui-dialog-titlebar").remove();}if(props.showBusy!==null&&props.showBusy){self.busyStart("Loading...");}jQuery(window).on("resize.aaDialog",self.resizeDialog);var elemObj=props.aaPosition.of?props.aaPosition.of:dialogObj;jQuery(elemObj).scrollTop(0);self.setFocus();};self.setFocus=function(){var $dialog=jQuery(activeDialog).parents(".ui-dialog:first"),$dialogTitle=$dialog.find(".ui-dialog-title");if($dialogTitle){$dialogTitle.focus();}else{$dialog.focus();}};self.closeDialog=function(){if(dialogObj.length<=0){return false;}if(jQuery(dialogObj).dialog("isOpen")){jQuery(dialogObj).dialog("close");}};var _closeDialog=function(ev){activeDialog="";if(self.jQueryUIVersion<"01.10"&&jQuery(dialogLinkObj).length>0){setTimeout(function(){jQuery(dialogLinkObj).focus();dialogLinkObj=undefined;},200);}ev.stopPropagation();ev.stopImmediatePropagation();return false;};self.busyStart=function(busyMsg){if(activeDialog.length<=0){return false;}var uiParent=jQuery(activeDialog).parents(".ui-dialog:first");var uiBusy=uiParent.find("> .aa-busy-module");uiParent.addClass("aa-busy");if(busyMsg===undefined){busyMsg="";}if(uiBusy.length===0){uiParent.append('<div class="aa-busy-module"><div class="aa-busy-bg"></div><div class="aa-busy-img"><i class="spinner"></i><span class="text"></span></div></
```

### Core Architecture Module: `scripts/eval/miniwob++/computergym/computergym/miniwob/miniwob_interface/html/flight/AA/apps/common/js/jquery/aacom/utilities/aaUtils.js`
```
jQuery.aaFormFieldEffects=function(){var self=this;self.forms=jQuery("form");self.fieldsets=jQuery(self.forms).find("fieldset");self.inputs=jQuery(self.forms).find("input");self.fieldsets.click(function(e){self.resetFocus();self.focusFieldset(jQuery(this));});self.inputs.focus(function(e){self.resetFocus();self.focusFieldset(jQuery(this).closest("fieldset"));});self.resetFocus=function(){self.fieldsets.parents("div:not(.aa-no-focus)").removeClass("active");};self.focusFieldset=function(fieldset){fieldset.parents("div:not(.aa-no-focus)").addClass("active");};};jQuery.stripeTables=function(table){jQuery("tbody tr",table).hover(function(){jQuery(this).addClass("aa-hoverRow");},function(){jQuery(this).removeClass("aa-hoverRow");});jQuery("tbody tr:even",table).addClass("aa-altRow");};jQuery.tableToLinks=function(table,link){jQuery("tbody tr",table).each(function(i,item){var url=jQuery(link,item).attr("href");if(url!==undefined){jQuery(item).css("cursor","pointer").hover(function(){jQuery(this).toggleClass("hover");jQuery(item).unbind("click");jQuery(item).bind("click",url,function(e){e.preventDefault();window.location=e.data;});},function(){jQuery(this).toggleClass("hover");});jQuery("a",item).each(function(index){var dealUrl=jQuery(link,item).attr("href");if(jQuery(this).attr("class")!=jQuery(link,item).attr("class")){jQuery(this).hover(function(){jQuery(item).toggleClass("hover");jQuery(item).unbind("click");},function(){jQuery(item).toggleClass("hover");jQuery(item).bind("click",dealUrl,function(e){e.preventDefault();window.location=e.data;});});}});}});};
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13** (2025-01-06): **either num_layers or encoder_num_layers should be specified**
  *Symptoms*: When I train the LLM, I met this problem ![image](https://github.com/user-attachments/assets/91a9f7f3-3b0b-460e-861b-290a4cd6147e) but I find there is no num_player or encoder_num_layers in the scripts/models/megatron/finetune_4xA100_4tp_mixture_mistral.sh  I tried to add this parameter, but found that it didn't work. Moreover, I'm not quite sure what value should be set.

- **Issue #7** (2024-05-23): **Update citation in README.md **
  *Symptoms*: 

- **Issue #6** (2024-03-28): **Tool definitions under jupyter kernel server**
  *Symptoms*: Hi I notice there's a tools_to_run code in jupyterkernel server [this line](https://github.com/xingyaoww/code-act/blob/main/scripts/chat/code_execution/jupyter.py#L76). However there's no documentation on how to define one.  How does each code tool code should looks like? can i just paste in tool code under mint/tools and update the system prompt? 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your interests!  Yes! You can just paste in arbitrary function definition as a string, for example:  ```python import math  def foo(a):     return math.ceil(a) ```  Something like this, then your agent will be able to access this `foo` function in its `<execute>` environments.  Feel free to re-open this issue if you have any further questions!

- **Issue #5** (2024-03-18): **NOT AN ISSUE, thanks for the model!**
  *Symptoms*: I able to generate more multi-steps code-act dataset using your model and code, I will release the dataset in HuggingFace asap
  **Post-Mortem & Fix Analysis**:
  > Thanks a lot for your interest!! Happy to see that these artifacts are useful to you!

- **Issue #4** (2024-03-28): **json.decoder.jsondecodeerror**
  *Symptoms*: How to resolve this problme? json.decoder.jsondecodeerror: expecting value: line 1 column 1 (char 0) python
  **Post-Mortem & Fix Analysis**:
  > Can you describe the issue in more detail? (e.g., which code/script you are running)
  > Close due to inactivity - feel free to re-open if issue arises!

- **Issue #3** (2024-03-11): **Potential performance issue: .fillna memory issue in pandas below 1.4.2 version**
  *Symptoms*: **Issue Description:**  Hello. I have discovered a performance degradation in the `.fillna` function of pandas version 1.4.1 and below 1.4.2. And I notice the repository depends on pandas 1.4.1 in `scripts/eval/science-world/requirements.txt`.  I am not sure whether this performance problem in pandas will affect this repository. I found some discussions on pandas GitHub related to this issue, including [#46149](https://github.com/pandas-dev/pandas/issues/46149) and [#46204](https://github.com/pandas-dev/pandas/pull/46204). I also found that `scripts/data/interaction/collection/convert_outputs.ipynb` and `scripts/eval/mint-bench/convert_outputs.py` used the influenced api. There may be more files using the influenced api and pandas version below 1.4.2.  **Suggestion**  I would recommend considering an upgrade to a different version of pandas >= 1.4.2 or exploring other solutions to optimize the performance. Any other workarounds or solutions would be greatly appreciated. Thank you!
  **Post-Mortem & Fix Analysis**:
  > Hi @TendouArisu, thanks for the issue! I just removed the file `scripts/eval/science-world/requirements.txt` since we did not use it to setup environment (see [here](https://github.com/xingyaoww/code-act/blob/ce451422e34dd696dda6f523baebdc0d9c18a571/scripts/eval/setup_env.sh#L31-L34)). The code should work fine if you use a newer version of pandas. Please let me know if you encountered more issues!

- **Issue #2** (2024-03-28): **Installation and Setup on MACOS M1 Arm fails**
  *Symptoms*: Hi, I downloaded the model and followed your instructions.  I get the following error  7b-v0.1 PORT=8080 MODEL_PATH=models--xingyaoww--CodeActAgent-Mistral-7b-v0.1 MODEL_DIR=. CUDA_VISIBLE_DEVICES= docker: Error response from daemon: unknown or invalid runtime name: nvidia. See 'docker run --help'.  I figured out that MacOS is not supported by Nvidia Toolkit.  Any solution for that specific problem?  Thanks a lot
  **Post-Mortem & Fix Analysis**:
  > I have Docker Desktop installed on my Mac. What am I missing here?
  > vllm is not supported by mac.
  > So OS has to be Linux right? Thank you

- **Issue #1** (2024-02-12): **Update README.md**
  *Symptoms*: conversaions -> conversations

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

### Incident Patch 1: `7d91d704` (2024-03-11)
**Commit Message**: remove science-world requirements since we will not be using it when setup env

**File**: `scripts/eval/science-world/requirements.txt` (removed, +0/-162)
```diff
@@ -1,162 +0,0 @@
-accelerate==0.19.0
-aiohttp==3.8.1
-aiosignal==1.2.0
-altair==5.0.0
-altair-data-server==0.4.1
-altair-saver==0.5.0
-altair-viewer==0.4.0
-appdirs==1.4.4
-asttokens==2.2.1
-async-generator==1.10
-async-timeout==4.0.2
-attrs==21.4.0
-backcall==0.2.0
-blessed==1.20.0
-brotlipy==0.7.0
-cffi==1.15.1
-cfgv==3.3.1
-charset-normalizer==2.0.12
-click==8.0.3
-cmake==3.26.1
-colorama==0.4.4
-contourpy==1.0.7
-cycler==0.11.0
-datasets==1.18.3
-decorator==5.1.1
-dill==0.3.4
-distlib==0.3.6
-docker-pycreds==0.4.0
-editdistance==0.6.2
-exceptiongroup==1.1.1
-executing==1.2.0
-faiss-cpu==1.7.3
-fschat
-filelock==3.5.0
-fonttools==4.39.4
-frozenlist==1.3.0
-fsspec==2022.1.0
-gitdb==4.0.9
-GitPython==3.1.31
-gpustat==1.0.0
-h11==0.14.0
-hjson==3.0.2
-huggingface-hub==0.14.1
-identify==2.5.8
-idna==3.3
-importlib-resources==5.12.0
-ipython==8.12.0
-jedi==0.18.2
-Jinja2==3.1.2
-joblib==1.2.0
-jsonschema==4.17.3
-kiwisolver==1.4.4
-lit==16.0.0
-lxml==4.9.2
-MarkupSafe==2.1.2
-matplotlib==3.7.1
-matplotlib-inline==0.1.6
-mpmath==1.3.0
-multidict==6.0.2
-multiprocess==0.70.12.2
-networkx==3.0
-ninja==1.10.2.3
-nltk==3.8
-nodeenv==1.7.0
-numpy==1.22.2
-# nvidia-cublas-cu11==11.10.3.66
-# nvidia-cuda-cupti-cu11==11.7.101
-# nvidia-cuda-nvcc-cu115==11.5.119
-# nvidia-cuda-nvrtc-cu11==11.7.99
-# nvidia-cuda-runtime-cu11==11.7.99
-# nvidia-cudnn-cu11==8.5.0.96
-# nvidia-cufft-cu11==10.9.0.58
-# nvidia-curand-cu11==10.2.10.91
-# nvidia-cusolver-cu11==11.4.0.1
-# nvidia-cusparse-cu11==11.7.4.91
-# nvidia-ml-py==11.495.46
-# nvidia-nccl-cu11==2.14.3
-# nvidia-nvtx-cu11==11.7.91
-# nvidia-pyindex==1.0.9
-openai==0.27.0
-outcome==1.2.0
-packaging==21.3
-pandas==1.4.1
-parso==0.8.3
-pathtools==0.1.2
-pexpect==4.8.0
-pickleshare==0.7.5
-Pillow==9.3.0
-pkgutil_resolve_name==1.3.10
-platformdirs==2.5.2
-portalocker==2.3.2
-portpicker==1.5.2
-pre-commit==2.20.0
-promise==2.3
-prompt-toolkit==3.0.38
-protobuf==3.19.4
-psutil==5.9.0
-ptyprocess==0.7.0
-pure-eval==0.2.2
-py-cpuinfo==8.0.0
-py4j==0.10.9.7
-pyarrow==7.0.0
-pycosat==0.6.3
-pycparser==2.21
-pydantic==1.10.7
-Pygments==2.14.0
-pyparsing==3.0.7
-pyrsistent==0.19.3
-PySocks==1.7.1
-python-dateutil==2.8.2
-python-dotenv==1.0.0
-pytz==2021.3
-pywebio==1.6.2
-PyYAML==6.0
-regex==2022.1.18
-requests==2.28.1
-responses==0.18.0
-sacrebleu==2.0.0
-sacremoses==0.0.47
-scienceworld==1.1.3
-scikit-learn==1.2.0
-scipy==1.9.3
-seaborn==0.12.2
-selenium==4.9.1
-sentence-transformers==2.2.2
-sentencepiece==0.1.96
-sentry-sdk==1.10.1
-setproctitle==1.3.2
-shortuuid==1.0.9
-six==1.16.0
-smmap==5.0.0
-sniffio==1.3.0
-sortedcontainers==2.4.0
-stack-data==0.6.2
-sympy==1.11.1
-tabulate==0.8.9
-tenacity==8.2.2
-threadpoolctl==3.1.0
-tiktoken==0.3.3
-tokenizers==0.11.4
-toml==0.10.2
-toolz==0.12.0
-tornado==6.2
-tqdm==4.62.3
-traitlets==5.9.0
-transformers==4.28.0
-trio==0.22.0
-trio-websocket==0.10.2
-triton==2.0.0
-typing_extensions==4.5.0
-ua-parser==0.15.0
-urllib3==1.26.11
-user-agents==2.2.0
-virtualenv==20.16.6
-vl-convert-python==0.9.0
-wandb==0.15.3
-wcwidth==0.2.6
-webdriver-manager==3.8.6
-wsproto==1.2.0
-xxhash==2.0.2
-yarl==1.7.2
-zipp==3.15.0
\ No newline at end of file
```

---

### Incident Patch 2: `b6ece8ef` (2024-03-11)
**Commit Message**: update chat-ui commit

**File**: `chat-ui` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 12fb6963e09ad064a85c3c66776a0448291d374b
+Subproject commit fb72c59315798028c0d5967e05e55b74e43e3f98
```

---

### Incident Patch 3: `a3e3b468` (2024-03-07)
**Commit Message**: fix typo

**File**: `scripts/eval/setup_data.sh` (modified, +1/-1)
```diff
@@ -17,5 +17,5 @@ mv data/eval/math/MATH/* data/eval/math
 rm -r data/eval/math/MATH
 
 # GSM8K
-check_conda_env_and_activate code-act-agent
+check_conda_env_and_activate code-act
 python3 -c "import datasets; dataset = datasets.load_dataset('gsm8k', 'main'); dataset.save_to_disk('data/eval/gsm8k')"
```

---

### Incident Patch 4: `68b85fd4` (2024-03-07)
**Commit Message**: fix typo

**File**: `scripts/eval/setup_env.sh` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 #!/bin/bash
 
 source scripts/eval/source.sh
-check_conda_env_and_activate code-act-agent
+check_conda_env_and_activate code-act
 # if jq is not installed, install it
 if ! command -v jq &> /dev/null
 then
```

---

### Incident Patch 5: `cdc5d423` (2024-02-04)
**Commit Message**: fix typo

**File**: `scripts/chat/code_execution/jupyter.py` (modified, +1/-1)
```diff
@@ -360,7 +360,7 @@ def __enter__(self):
         return f"{service_ip}:{self.port}"
 
     def __exit__(self, exc_type, exc_val, exc_tb):
-        self.api_instance.delete_namespaced_service(name=self.pod_name, namespace=self.namespace)
+        self.api_instance.delete_namespaced_service(name=self.pod_name, namespace=self.NAMESPACE)
         logging.info(f"Service {self.pod_name} deleted.")
         self.api_instance.delete_namespaced_pod(self.pod_name, self.NAMESPACE)
         logging.info(f"Pod {self.pod_name} has been deleted.")
```

---

### Incident Patch 6: `4557b542` (2024-02-03)
**Commit Message**: fix path

**File**: `scripts/models/megatron/finetune_4xA100_4tp_mixture_mistral.sh` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 #!/bin/bash
-source scripts/train/megatron/source.sh
+source scripts/models/megatron/source.sh
 export CUDA_VISIBLE_DEVICES=0,1,2,3
 
 TP=4
```

---

### Incident Patch 7: `01a43f8c` (2024-02-02)
**Commit Message**: fix jupyter execution

**File**: `scripts/chat/code_execution/jupyter.py` (modified, +17/-11)
```diff
@@ -50,7 +50,10 @@ async def _send_heartbeat(self):
             # print("Heartbeat sent...")
         except tornado.iostream.StreamClosedError:
             # print("Heartbeat failed, reconnecting...")
-            await self._connect()
+            try:
+                await self._connect()
+            except ConnectionRefusedError:
+                print("ConnectionRefusedError: Failed to reconnect to kernel websocket - Is the kernel still running?")
 
     async def _connect(self):
         if self.ws:
@@ -112,10 +115,10 @@ async def execute(self, code, timeout=60):
         )
 
         outputs = []
-        execution_done = False
+
 
         async def wait_for_messages():
-            nonlocal execution_done
+            execution_done = False
             while not execution_done:
                 msg = await self.ws.read_message()
                 msg = json_decode(msg)
@@ -126,13 +129,12 @@ async def wait_for_messages():
                     continue
 
                 if os.environ.get("DEBUG", False):
-                    if msg_type in {'execute_input'}:
-                        break
-                    print(f"MSG TYPE: {msg_type.upper()}\nCONTENT: {msg['content']}")
+                    print(f"MSG TYPE: {msg_type.upper()} DONE:{execution_done}\nCONTENT: {msg['content']}")
 
                 if msg_type == 'error':
                     traceback = "\n".join(msg["content"]["traceback"])
-                    return traceback
+                    outputs.append(traceback)
+                    execution_done = True
                 elif msg_type == 'stream':
                     outputs.append(msg['content']['text'])
                 elif msg_type in ['execute_result', 'display_data']:
@@ -144,6 +146,7 @@ async def wait_for_messages():
 
                 elif msg_type == 'execute_reply':
                     execution_done = True
+            return execution_done
 
         async def interrupt_kernel():
             client = AsyncHTTPClient()
@@ -155,16 +158,19 @@ async def interrupt_kernel():
             print(f"Kernel interrupted: {interrupt_response}")
 
         try:
-            await asyncio.wait_for(wait_for_messages(), timeout)
+            execution_done = await asyncio.wait_for(wait_for_messages(), timeout)
         except asyncio.TimeoutError:
             await interrupt_kernel()
             return f"[Execution timed out ({timeout} seconds).]"
 
         if not outputs and execution_done:
-            return "[Code executed successfully with no output]"
+            ret = "[Code executed successfully with no output]"
         else:
-            concated = ''.join(outputs)
-            return concated
+            ret = ''.join(outputs)
+
+        if os.environ.get("DEBUG", False):
+            print(f"OUTPUT:\n{ret}")
+        return ret
 
     async def shutdown_async(self):
         if self.kernel_id:
```

#### Recent Merged Pull Requests:
- **PR #7** (2024-05-23): Update citation in README.md  (@dreasysnail)
- **PR #1** (2024-02-12): Update README.md (@eltociear)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
