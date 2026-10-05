# Forensic Learning Record (Deep Inspection): xingyaoww/code-act

> **Canonical Artifact**: `07_PROJECT_LEARNING/xingyaoww-code-act-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xingyaoww/code-act](https://github.com/xingyaoww/code-act))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:13:01.004Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xingyaoww/code-act`
- **Description**: Official Repo for ICML 2024 paper "Executable Code Actions Elicit Better LLM Agents" by Xingyao Wang, Yangyi Chen, Lifan Yuan, Yizhe Zhang, Yunzhu Li, Hao Peng, Heng Ji.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1705 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `mint/agents/__init__.py`
```
from .base import LMAgent
from .openai_lm_agent import OpenAILMAgent
from .bard_agent import BardLMAgent
from .openai_feedback_agent import OpenAIFeedbackAgent
from .claude_feedback_agent import ClaudeFeedbackAgent
from .vllm_feedback_agent import VLLMFeedbackAgent
from .vllm_agent import VLLMAgent
from .claude_agent import ClaudeLMAgent

```

### Core Architecture Module: `mint/agents/bard_agent.py`
```
import os
import logging
import traceback
import backoff
from typing import List, Mapping
import google.api_core.exceptions
import google.generativeai as palm
from google.generativeai.types import ChatResponse
from google.api_core.exceptions import InvalidArgument
from .base import LMAgent
from mint.datatypes import Action

palm.configure(api_key=os.environ.get("BARD_API_KEY", None))

LOGGER = logging.getLogger("MINT")


class BardIssue(Exception):
    pass


class BardLMAgent(LMAgent):
    def __init__(self, config):
        super().__init__(config)
        assert "model_name" in config.keys()
        self.stop_words = ["\nObservation:", "\nExpert feedback:", "\nTask:", "\n---"]
        if not self.config["model_name"].startswith("models/"):
            self.config["model_name"] = f"models/{self.config['model_name']}"

    def parse_bard_messages(self, messages: List[Mapping[str, str]]):
        # Bard accepts messages as a list of strings
        if self.config.get("add_system_message", False):
            messages = self.add_system_message(messages)
            assert messages[0]["role"] == "system"
            system = messages[0]["content"]
            messages = messages[1:]
            messages = [
                {"author": m["role"], "content": m["content"]} for m in messages
            ]
            return {
                "context": system,
                "examples": None,
                "messages": messages,
            }
        else:
            messages = [
                {"author": m["role"], "content": m["content"]} for m in messages
            ]
            return {
                "context": None,
                "examples": None,
                "messages": messages,
            }

    @backoff.on_exception(
        backoff.expo,
        (
            google.api_core.exceptions.GatewayTimeout,
            google.api_core.exceptions.ServiceUnavailable,
            google.api_core.exceptions.InternalServerError,
            google.api_core.exceptions.TooManyRequests,
        ),
    )
    def call_lm(self, messages: List[str]):
        parsed_prompt = self.parse_bard_messages(messages)
        token_stats = palm.count_message_tokens(
            context=parsed_prompt["context"],
            examples=parsed_prompt["examples"],
            messages=parsed_prompt["messages"],
        )

        # Prepend the prompt with the system message
        try:
            candidate_count = self.config.get("candidate_count", 1)
            response: ChatResponse = palm.chat(
                model=self.config["model_name"],
                context=parsed_prompt["context"],
                examples=parsed_prompt["examples"],
                messages=parsed_prompt["messages"],
                temperature=self.config.get("temperature", 0.0),
                candidate_count=candidate_count,
            )

            response_str = response.last
            # Best effort to find the candidate that contains <execute> or <solution>
            if candidate_count > 1:
                for candidate in response.candidates:
                    cur_content = candidate["content"]
                    if "<execute>" in cur_content or "<solution>" in cur_content:
                        response_str = cur_content
        except IndexError:
            raise BardIssue(
                f"IndexError (Likely triggered a filter). {traceback.format_exc()}"
            )
        except InvalidArgument:
            raise BardIssue(
                f"InvalidArgument (Likely exceeded maxlen). {traceback.format_exc()}"
            )
        if hasattr(response, "filters") and len(response.filters) > 0:
            raise BardIssue(
                f"Filters triggered: {response.filters}. {traceback.format_exc()}"
            )
        if (
            (not hasattr(response, "candidates"))
            or (response.candidates is None)
            or (len(response.candidates) == 0)
        ):
            raise BardIssue(f"Empty candidates: {response}")
        # cut off based on self.stop_words
        for stop_word in self.stop_words:
            if stop_word in response_str:
                response_str = response_str[: response_str.index(stop_word)].rstrip()
        LOGGER.info(token_stats)
        return response_str, token_stats

    def act(self, state):
        messages = state.history
        try:
            lm_output, token_usage = self.call_lm(messages)
            for usage_type, count in token_usage.items():
                state.token_counter[usage_type] += count
            action = self.lm_output_to_action(lm_output)
            return action
        except BardIssue as e:
            LOGGER.error(f"BardIssue\n{e.args[0]}")
            return Action(None, False, error=f"BardIssue\n{e.args[0]}")

```

### Core Architecture Module: `mint/agents/base.py`
```
import logging
from typing import List, Dict, Any, Mapping

LOGGER = logging.getLogger("MINT")

from mint.datatypes import Action, State


class LMAgent:
    """Base class for an agent."""

    def __init__(self, config: Mapping[str, Any]):
        self.config = config
        LOGGER.info(f"Initialized {self.__class__.__name__} with config: {config}")
        # The agent should not generate observations or expert feedback
        self.stop_words = ["\nObservation:", "\nExpert feedback:", "\nTask:", "\n---"]

    def lm_output_to_action(self, lm_output: str) -> Action:
        propose_solution = bool("<solution>" in lm_output)
        return Action(lm_output, not propose_solution)

    def act(self, state: State) -> Action:
        """
        The history should be a format like:
        [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Who won the world series in 2020?"},
            {"role": "assistant", "content": "The Los Angeles Dodgers won the World Series in 2020."},
            {"role": "user", "content": "Where was it played?"}
        ]
        """
        raise NotImplementedError

    def add_system_message(
        self, messages: List[Dict[str, str]]
    ) -> List[Dict[str, str]]:
        # Prepend the prompt with the system message
        first_msg = messages[0]
        assert first_msg["role"] == "user"
        system, examples, task = first_msg["content"].split("\n---\n")
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": examples + "\n---\n" + task},
        ] + messages[1:]
        return messages

```

### Core Architecture Module: `mint/agents/claude_agent.py`
```
from .base import LMAgent
import logging
import traceback
from mint.datatypes import Action
import backoff
import requests
import os
import json

LOGGER = logging.getLogger("MINT")

url = "https://api.anthropic.com/v1/complete"
headers = {
    "accept": "application/json",
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
    "x-api-key": os.environ.get("ANTHROPIC_API_KEY", None),
}


class ClaudeLMAgent(LMAgent):
    def __init__(self, config):
        super().__init__(config)
        assert "model_name" in config.keys()
        self.stop_words = [
            "Observation:",
            "Expert feedback:",
            "Task:",
            "---",
            "\n\nHuman:",
        ]

    @backoff.on_exception(
        backoff.expo,
        requests.exceptions.RequestException,
    )
    def call_lm(self, messages):
        # Prepend the prompt with the system message
        data = {
            "model": self.config["model_name"],
            "prompt": "",
            "max_tokens_to_sample": self.config.get("max_tokens", 512),
            "temperature": self.config.get("temperature", 0),
            "stop_sequences": self.stop_words,
        }
        for message in messages:
            if message["role"] == "user":
                data["prompt"] += f"\n\nHuman: {message['content']}"
            else:
                data["prompt"] += f"\n\nAssistant: {message['content']}"
        assert len(messages) % 2 == 1, "messages must be odd length"
        data["prompt"] += "\n\nAssistant:"

        response = requests.post(url, headers=headers, json=data)

        if response.status_code == 200:
            pass
        else:
            raise requests.exceptions.RequestException(
                "Request failed with status code:", response.status_code
            )

        return json.loads(response.text)["completion"], {}

    def act(self, state):
        messages = state.history
        lm_output, token_usage = self.call_lm(messages)
        for usage_type, count in token_usage.items():
            state.token_counter[usage_type] += count
        action = self.lm_output_to_action(lm_output)
        return action
        # except Exception as e:
        #     tb = traceback.format_exc()
        #     return Action(None, False, error="Unknown error")

```

### Core Architecture Module: `mint/agents/claude_feedback_agent.py`
```
import re
import logging
from .openai_lm_agent import OpenAILMAgent
from mint.datatypes import State, Action
from mint.prompt import FeedbackPromptTemplate
import logging
from mint.datatypes import Action
import backoff
import requests
import os
import json

LOGGER = logging.getLogger("MINT")

url = "https://api.anthropic.com/v1/complete"
headers = {
    "accept": "application/json",
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
    "x-api-key": os.environ.get("ANTHROPIC_API_KEY", None),
}


class ClaudeFeedbackAgent(OpenAILMAgent):
    def __init__(self, config):
        super().__init__(config)
        # The agent should not generate Assistant msg since it should provide feedback
        self.stop_words = ["\nObservation:", "\nTask:", "\nAssistant:"]
        self.feedback_prompt = FeedbackPromptTemplate()

    def lm_output_to_action(self, lm_output, form) -> Action:
        if form == "textual":
            feedback = lm_output
        elif form == "binary":
            # Find the first sentence (as feedback).
            first_sent = re.findall(r"([^.]*\.)", lm_output)[0]
            if "GOOD" in first_sent:
                feedback = "This is GOOD."
            elif "BAD" in first_sent:
                feedback = "This is BAD."
            else:
                raise ValueError(f"Cannot find GOOD or BAD in feedback: {feedback}")
        return Action(feedback, use_tool=False)

    def act(
        self,
        state: State,
        observation: str,
        form: str,
        gt,
        task_in_context_example: str,
        tool_desc: str,
    ) -> Action:
        gt_solution = (
            (
                f"Correct solution (please DO NOT disclose the correct solution to the assistant): {str(gt).strip()}\n"
            )
            if gt
            else "Correct solution (please DO NOT disclose the correct solution to the assistant): NOT GIVEN\n"
        )
        trajectory = "---\n".join(state.history[0]["content"].split("---\n")[2:]) + "\n"
        trajectory += "\n".join([x["content"] for x in state.history[1:]])
        trajectory += "\n" + observation
        trajectory = trajectory[
            trajectory.find("Task:") :
        ]  # Get rid of the initial instruction to avoid confusion
        messages = [
            {
                "role": "user",
                "content": self.feedback_prompt(
                    in_context_example=task_in_context_example[
                        task_in_context_example.find("Task:") :
                    ],  # This is to get rid of the initial instruction to avoid confusion
                    trajectory=trajectory,
                    correct_solution=gt_solution,
                    tool_desc=tool_desc,
                ),
            }
        ]

        # log in yellow
        LOGGER.debug(
            "Feedback Agent Prompt:\n" + "\033[93m" + messages[0]["content"] + "\033[0m"
        )
        lm_output, token_usage = self.call_lm(messages)
        for usage_type, count in token_usage.items():
            state.token_counter["feedback_" + usage_type] += count
        action = self.lm_output_to_action(lm_output, form)
        # log in red
        LOGGER.debug("Feedback Agent Action:\n" + "\033[91m" + action.value + "\033[0m")
        return action

    @backoff.on_exception(
        backoff.expo,
        requests.exceptions.RequestException,
    )
    def call_lm(self, messages):
        # Prepend the prompt with the system message
        data = {
            "model": self.config["model_name"],
            "prompt": f"\n\nHuman: {messages[0]['content']}\n\n",
            "max_tokens_to_sample": self.config.get("max_tokens", 512),
            "temperature": self.config.get("temperature", 0),
            "stop_sequences": self.stop_words,
        }
        assert len(messages) == 1, "message length must be 1"

        response = requests.post(url, headers=headers, json=data)

        if response.status_code == 200:
            pass
        else:
            raise requests.exceptions.RequestException(
                "Request failed with status code:", response.status_code
            )

        return json.loads(response.text)["completion"], {}

```

### Core Architecture Module: `mint/agents/openai_feedback_agent.py`
```
import re
import logging

LOGGER = logging.getLogger("MINT")

from .openai_lm_agent import OpenAILMAgent

from mint.datatypes import State, Action
from mint.prompt import FeedbackPromptTemplate
import openai
import logging
import traceback
from mint.datatypes import Action


class OpenAIFeedbackAgent(OpenAILMAgent):
    def __init__(self, config):
        super().__init__(config)
        # The agent should not generate Assistant msg since it should provide feedback
        self.stop_words = ["\nObservation:", "\nTask:", "\nAssistant:"]
        self.feedback_prompt = FeedbackPromptTemplate()

    def lm_output_to_action(self, lm_output, form) -> Action:
        if form == "textual":
            feedback = lm_output
        elif form == "binary":
            # Find the first sentence (as feedback).
            first_sent = re.findall(r"([^.]*\.)", lm_output)[0]
            if "GOOD" in first_sent:
                feedback = "This is GOOD."
            elif "BAD" in first_sent:
                feedback = "This is BAD."
            else:
                raise ValueError(f"Cannot find GOOD or BAD in feedback: {feedback}")
        return Action(feedback, use_tool=False)

    def act(
        self,
        state: State,
        observation: str,
        form: str,
        gt,
        task_in_context_example: str,
        tool_desc: str,
    ) -> Action:
        try:
            gt_solution = (
                (
                    f"Correct solution (please DO NOT disclose the correct solution to the assistant): {str(gt).strip()}\n"
                )
                if gt
                else "Correct solution (please DO NOT disclose the correct solution to the assistant): NOT GIVEN\n"
            )
            trajectory = (
                "---\n".join(state.history[0]["content"].split("---\n")[2:]) + "\n"
            )
            trajectory += "\n".join([x["content"] for x in state.history[1:]])
            trajectory += "\n" + observation
            trajectory = trajectory[
                trajectory.find("Task:") :
            ]  # Get rid of the initial instruction to avoid confusion
            messages = [
                {
                    "role": "user",
                    "content": self.feedback_prompt(
                        in_context_example=task_in_context_example[
                            task_in_context_example.find("Task:") :
                        ],  # This is to get rid of the initial instruction to avoid confusion
                        trajectory=trajectory,
                        correct_solution=gt_solution,
                        tool_desc=tool_desc,
                    ),
                }
            ]

            # log in yellow
            LOGGER.debug(
                "Feedback Agent Prompt:\n"
                + "\033[93m"
                + messages[0]["content"]
                + "\033[0m"
            )
            lm_output, token_usage = self.call_lm(messages)
            for usage_type, count in token_usage.items():
                state.token_counter["feedback_" + usage_type] += count
            action = self.lm_output_to_action(lm_output, form)
            # log in red
            LOGGER.debug(
                "Feedback Agent Action:\n" + "\033[91m" + action.value + "\033[0m"
            )
            return action
        except openai.error.InvalidRequestError:
            tb = traceback.format_exc()
            return Action(f"", False, error=f"InvalidRequestError\n{tb}")
        except Exception as e:
            tb = traceback.format_exc()
            return Action(f"", False, error=f"Unknown error\n{tb}")

```

### Core Architecture Module: `mint/agents/openai_lm_agent.py`
```
from .base import LMAgent
import openai
import logging
import traceback
from mint.datatypes import Action
import backoff

LOGGER = logging.getLogger("MINT")


class OpenAILMAgent(LMAgent):
    def __init__(self, config):
        super().__init__(config)
        assert "model_name" in config.keys()

    @backoff.on_exception(
        backoff.fibo,
        # https://platform.openai.com/docs/guides/error-codes/python-library-error-types
        (
            openai.error.APIError,
            openai.error.Timeout,
            openai.error.RateLimitError,
            openai.error.ServiceUnavailableError,
            openai.error.APIConnectionError,
        ),
    )
    def call_lm(self, messages):
        # Prepend the prompt with the system message
        response = openai.ChatCompletion.create(
            model=self.config["model_name"],
            messages=messages,
            max_tokens=self.config.get("max_tokens", 512),
            temperature=self.config.get("temperature", 0),
            stop=self.stop_words,
        )
        return response.choices[0].message["content"], response["usage"]

    def act(self, state):
        messages = state.history
        try:
            lm_output, token_usage = self.call_lm(messages)
            for usage_type, count in token_usage.items():
                state.token_counter[usage_type] += count
            action = self.lm_output_to_action(lm_output)
            return action
        except openai.error.InvalidRequestError:  # mostly due to model context window limit
            tb = traceback.format_exc()
            return Action(f"", False, error=f"InvalidRequestError\n{tb}")
        # except Exception as e:
        #     tb = traceback.format_exc()
        #     return Action(f"", False, error=f"Unknown error\n{tb}")

```

### Core Architecture Module: `mint/agents/vllm_agent.py`
```
from .openai_lm_agent import OpenAILMAgent
import openai
import openai.error
import logging
import traceback
from mint.datatypes import Action
import backoff

LOGGER = logging.getLogger("MINT")
# REMEMBER to RUN ALL MODELS


class VLLMAgent(OpenAILMAgent):
    """Inference for open-sourced models with a unified interface with OpenAI's API."""

    def __init__(self, config):
        super().__init__(config)
        assert (
            "openai.api_base" in config.keys()
        ), "missing openai.api_base to connect to server"
        self.api_base = config["openai.api_base"]
        self.api_key = "EMPTY"
        LOGGER.info("remember to openup the server using docs/SERVING.mdh")
        self.stop_words = [
            "\nObservation:",
            "\nExpert feedback:",
            "\nTask:",
            "\n---",
            "\nHuman:",
        ]

    def format_prompt(self, messages):
        """Format messages into a prompt for the model."""
        prompt = ""
        for message in messages:
            if message["role"] == "user":
                prompt += f"\n\nHuman: {message['content']}"
            elif message["role"] == "assistant":
                prompt += f"\n\nAssistant: {message['content']}"
        prompt += "\n\nAssistant:"
        return prompt

    @backoff.on_exception(
        backoff.fibo,
        # https://platform.openai.com/docs/guides/error-codes/python-library-error-types
        (
            openai.error.Timeout,
            openai.error.RateLimitError,
            openai.error.ServiceUnavailableError,
            openai.error.APIConnectionError,
        ),
    )
    def call_lm(self, messages):
        if self.config.get("add_system_message", False):
            messages = self.add_system_message(messages)
            assert messages[0]["role"] == "system"
            # system msg will be formatted by vllm and fastchat, so no need to format here
        else:
            messages = [
                {"role": "system", "content": ""}
            ] + messages  # add empty system message

        try:
            if self.config["chat_mode"]:
                response = openai.ChatCompletion.create(
                    model=self.config["model_name"],
                    messages=messages,
                    max_tokens=self.config.get("max_tokens", 512),
                    temperature=self.config.get("temperature", 0),
                    stop=self.stop_words,
                    api_base=self.api_base,
                    api_key=self.api_key,
                )
                resp_str = response.choices[0].message["content"]

            else:
                prompt = self.format_prompt(messages)
                response = openai.Completion.create(
                    model=self.config["model_name"],
                    prompt=prompt,
                    max_tokens=self.config.get("max_tokens", 512),
                    temperature=self.config.get("temperature", 0),
                    stop=self.stop_words,
                    api_base=self.api_base,
                    api_key=self.api_key,
                )
                resp_str = response.choices[0].text

        except openai.error.APIError as e:
            # This is special handling for FastChat Library
            # and is actually unrelated to the OpenAI API
            error_message = e.args[0]
            # Invalid response object from API: '{"object":"error","message":"This model\'s maximum context length is 4096 tokens. However, you requested 4169 tokens (3657 in the messages, 512 in the completion). Please reduce the length of the messages or completion.","type":"invalid_request_error","param":null,"code":null}' (HTTP response code was 400))
            if "maximum context length" in error_message:
                raise openai.error.InvalidRequestError(e.args[0], "")
            else:
                raise e
        resp_str = resp_str.rstrip()  # remove trailing spaces (usually caused by llama)
        return resp_str, response["usage"]

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

### Incident Patch 1: `a3e3b468` (2024-03-07)
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

### Incident Patch 2: `68b85fd4` (2024-03-07)
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

### Incident Patch 3: `cdc5d423` (2024-02-04)
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

### Incident Patch 4: `4557b542` (2024-02-03)
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

### Incident Patch 5: `01a43f8c` (2024-02-02)
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
