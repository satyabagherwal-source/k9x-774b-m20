# Forensic Learning Record (Deep Inspection): om-ai-lab/OmAgent

> **Canonical Artifact**: `07_PROJECT_LEARNING/om-ai-lab-omagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/om-ai-lab/OmAgent](https://github.com/om-ai-lab/OmAgent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:17:46.672Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `om-ai-lab/OmAgent`
- **Description**: [EMNLP-2024] Build multimodal language agents for fast prototype and production
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2666 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/step3_outfit_with_loop/agent/outfit_decider/outfit_decider.py`
```
import re
from pathlib import Path
from typing import List

import json_repair
from omagent_core.engine.worker.base import BaseWorker
from omagent_core.models.llms.base import BaseLLMBackend
from omagent_core.models.llms.openai_gpt import OpenaiGPTLLM
from omagent_core.models.llms.prompt.parser import StrParser
from omagent_core.models.llms.prompt.prompt import PromptTemplate
from omagent_core.utils.logger import logging
from omagent_core.utils.registry import registry
from pydantic import Field

CURRENT_PATH = root_path = Path(__file__).parents[0]


@registry.register_worker()
class OutfitDecider(BaseLLMBackend, BaseWorker):
    """Outfit decision processor that determines if enough information has been gathered.

    This processor evaluates whether sufficient information exists to make an outfit recommendation
    by analyzing user instructions, search results, and any feedback received. It uses an LLM to
    make this determination.

    If enough information is available, it returns success. Otherwise, it returns failed along with
    feedback about what additional information is needed.

    Attributes:
        output_parser: Parser for string outputs from the LLM
        llm: OpenAI GPT language model instance
        prompts: List of system and user prompts loaded from template files
    """

    llm: OpenaiGPTLLM
    prompts: List[PromptTemplate] = Field(
        default=[
            PromptTemplate.from_file(
                CURRENT_PATH.joinpath("sys_prompt.prompt"), role="system"
            ),
            PromptTemplate.from_file(
                CURRENT_PATH.joinpath("user_prompt.prompt"), role="user"
            ),
        ]
    )

    def _run(self, *args, **kwargs):
        """Process the current state to determine if an outfit recommendation can be made.

        Retrieves the current user instructions, search information, and feedback from the
        short-term memory. Uses the LLM to analyze this information and determine if
        sufficient details exist to make a recommendation.

        Args:
            args: Variable length argument list
            kwargs: Arbitrary keyword arguments

        Returns:
            dict: Contains 'decision' key with:
                - True if enough information exists to make a recommendation
                - False if more information is needed, also stores feedback about what's missing
        """
        # Retrieve context data from short-term memory, using empty lists as defaults
        if self.stm(self.workflow_instance_id).get("user_instruction"):
            user_instruct = self.stm(self.workflow_instance_id).get("user_instruction")
        else:
            user_instruct = []

        if self.stm(self.workflow_instance_id).get("search_info"):
            search_info = self.stm(self.workflow_instance_id).get("search_info")
        else:
            search_info = []

        if self.stm(self.workflow_instance_id).get("feedback"):
            feedback = self.stm(self.workflow_instance_id).get("feedback")
        else:
            feedback = []

        # Query LLM to analyze available information
        chat_complete_res = self.simple_infer(
            instruction=str(user_instruct),
            previous_search=str(search_info),
            feedback=str(feedback),
        )
        content = chat_complete_res["choices"][0]["message"].get("content")
        content = self._extract_from_result(content)
        logging.info(content)

        # Return decision and handle feedback if more information is needed
        if content.get("decision") == "ready":
            return {"decision": True}
        else:
            feedback.append(content["reason"])
            self.stm(self.workflow_instance_id)["feedback"] = feedback
            return {"decision": False}

    def _extract_from_result(self, result: str) -> dict:
        try:
            pattern = r"```json\s+(.*?)\s+```"
            match = re.search(pattern, result, re.DOTALL)
            if match:
                return json_repair.loads(match.group(1))
            else:
                return json_repair.loads(result)
        except Exception as error:
            raise ValueError("LLM generation is not valid.")

```

### Core Architecture Module: `examples/step3_outfit_with_loop/agent/outfit_image_input/outfit_image_input.py`
```
from pathlib import Path

from omagent_core.engine.worker.base import BaseWorker
from omagent_core.utils.general import read_image
from omagent_core.utils.registry import registry

CURRENT_PATH = root_path = Path(__file__).parents[0]


@registry.register_worker()
class OutfitImageInput(BaseWorker):
    """Outfit image input processor that handles user-provided clothing images.

    This processor allows users to provide an image of a clothing item that they want to build
    an outfit around. It accepts either an image URL or local file path as input, reads the image,
    and caches it in the workflow's short-term memory for use by downstream processors.

    The processor gracefully handles cases where users choose not to provide an image or if there
    are issues reading the provided image.

    Attributes:
        None - This worker uses only the base worker functionality
    """

    def _run(self, *args, **kwargs):
        """Process user-provided clothing image input.

        Prompts the user to provide an image of a clothing item, either via URL or local path.
        Reads and caches the image if provided, handling any errors that occur during image loading.

        Args:
            *args: Variable length argument list
            **kwargs: Arbitrary keyword arguments

        Returns:
            None - Results are stored in workflow's short-term memory
        """
        user_input = self.input.read_input(
            workflow_instance_id=self.workflow_instance_id,
            input_prompt="Please input a image of a clothing item.",
        )

        content = user_input["messages"][-1]["content"]
        for content_item in content:
            if content_item["type"] == "image_url":
                image_path = content_item["data"]

        try:
            img = read_image(input_source=image_path)
            image_cache = {"<image_0>": img}
            self.stm(self.workflow_instance_id)["image_cache"] = image_cache
        except Exception as e:
            pass

        return

```

### Core Architecture Module: `examples/step3_outfit_with_loop/agent/outfit_qa/outfit_qa.py`
```
import re
from pathlib import Path
from typing import List

import json_repair
from omagent_core.engine.worker.base import BaseWorker
from omagent_core.models.llms.base import BaseLLMBackend
from omagent_core.models.llms.openai_gpt import OpenaiGPTLLM
from omagent_core.models.llms.prompt.parser import StrParser
from omagent_core.models.llms.prompt.prompt import PromptTemplate
from omagent_core.tool_system.manager import ToolManager
from omagent_core.utils.logger import logging
from omagent_core.utils.registry import registry
from pydantic import Field

CURRENT_PATH = Path(__file__).parents[0]


@registry.register_worker()
class OutfitQA(BaseLLMBackend, BaseWorker):
    """Outfit Q&A processor that handles interactive dialogue with users about outfit recommendations.

    This processor manages a multi-turn conversation with users to gather outfit preferences and requirements:
    1. Takes user instructions, search info, and feedback from workflow context
    2. Uses LLM to analyze context and either:
       - Generate follow-up questions to clarify user needs
       - Make tool calls to search for relevant information (e.g. weather)
    3. Handles user responses and tool execution results
    4. Updates workflow context with new information for downstream processors

    Attributes:
        output_parser (StrParser): Parser for LLM output strings
        llm (OpenaiGPTLLM): LLM model for generating questions and analyzing responses
        prompts (List[PromptTemplate]): System and user prompts loaded from template files
        tool_manager (ToolManager): Tool manager instance for executing web searches
    """

    llm: OpenaiGPTLLM
    prompts: List[PromptTemplate] = Field(
        default=[
            PromptTemplate.from_file(
                CURRENT_PATH.joinpath("sys_prompt.prompt"), role="system"
            ),
            PromptTemplate.from_file(
                CURRENT_PATH.joinpath("user_prompt.prompt"), role="user"
            ),
        ]
    )
    tool_manager: ToolManager

    def _run(self, *args, **kwargs):
        """Run the outfit Q&A processor to gather outfit requirements through conversation.

        Manages an interactive dialogue loop that:
        1. Retrieves current context (user instructions, search results, feedback)
        2. Uses LLM to analyze context and determine next action
        3. Either asks user a follow-up question or executes a web search
        4. Updates context with new information

        Args:
            *args: Variable length argument list
            **kwargs: Arbitrary keyword arguments containing workflow context

        Returns:
            None - Updates workflow context with new user responses or search results

        Raises:
            ValueError: If LLM output is invalid or web search fails
        """
        # Retrieve conversation context from memory, initializing empty if not present
        if self.stm(self.workflow_instance_id).get("user_instruction"):
            user_instruct = self.stm(self.workflow_instance_id).get("user_instruction")
        else:
            user_instruct = []

        if self.stm(self.workflow_instance_id).get("search_info"):
            search_info = self.stm(self.workflow_instance_id).get("search_info")
        else:
            search_info = []

        if self.stm(self.workflow_instance_id).get("feedback"):
            feedback = self.stm(self.workflow_instance_id).get("feedback")
        else:
            feedback = []

        # Log current conversation state for debugging
        chat_structure = {
            "search_info": search_info,
            "user_instruct": user_instruct,
            "feedback": feedback,
        }
        logging.info(chat_structure)

        # Generate next conversation action using LLM
        chat_complete_res = self.simple_infer(
            instruction=str(user_instruct),
            previous_search=str(search_info),
            feedback=str(feedback),
        )
        content = chat_complete_res["choices"][0]["message"].get("content")
        content = self._extract_from_result(content)

        # Handle follow-up question flow
        if content.get("conversation"):
            question = content["conversation"]
            # self.callback.send_block(self.workflow_instance_id, msg=question)
            user_input = self.input.read_input(
                workflow_instance_id=self.workflow_instance_id,
                input_prompt=question + "\n",
            )
            content = user_input["messages"][-1]["content"]
            for content_item in content:
                if content_item["type"] == "text":
                    answer = content_item["data"]

            # Store Q&A exchange in conversation history
            user_instruct.append("Question: " + question + "\n" + "Answer: " + answer)
            self.stm(self.workflow_instance_id)["user_instruction"] = user_instruct
            return

        # Handle web search flow for gathering contextual info
        elif content.get("tool_call"):
            self.callback.info(
                self.workflow_instance_id,
                progress="Outfit QA",
                message="Search for weather information",
            )
            execution_status, execution_results = self.tool_manager.execute_task(
                content["tool_call"]
                + "\nYou should use web search to complete this task."
            )
            if execution_status == "success":
                search_info.append(str(execution_results))
                self.stm(self.workflow_instance_id)["search_info"] = search_info
                feedback.append(
                    "The weather information is provided detailly and specifically, and satisfied the requirement, dont need to ask for more weather information."
                )
                self.stm(self.workflow_instance_id)["feedback"] = feedback
                return
            else:
                raise ValueError("Web search tool execution failed.")

        else:
            raise ValueError("LLM generation is not valid.")

    def _extract_from_result(self, result: str) -> dict:
        try:
            pattern = r"```json\s+(.*?)\s+```"
            match = re.search(pattern, result, re.DOTALL)
            if match:
                return json_repair.loads(match.group(1))
            else:
                return json_repair.loads(result)
        except Exception as error:
            raise ValueError("LLM generation is not valid.")

```

### Core Architecture Module: `examples/step3_outfit_with_loop/compile_container.py`
```
# Import core modules and components
from pathlib import Path

from omagent_core.utils.container import container
from omagent_core.utils.registry import registry

# Import all registered modules
registry.import_module()

CURRENT_PATH = Path(__file__).parents[0]


# Register required components
container.register_stm("SharedMemSTM")
container.register_callback(callback="AppCallback")
container.register_input(input="AppInput")

# Compile container config
container.compile_config(CURRENT_PATH)

```

### Core Architecture Module: `examples/step3_outfit_with_loop/run_app.py`
```
# Import core OmAgent components for workflow management and app functionality
from omagent_core.clients.devices.app.client import AppClient
from omagent_core.engine.workflow.conductor_workflow import ConductorWorkflow
from omagent_core.engine.workflow.task.simple_task import simple_task
from omagent_core.utils.container import container
from omagent_core.utils.logger import logging

logging.init_logger("omagent", "omagent", level="INFO")

from pathlib import Path

from omagent_core.utils.registry import registry

CURRENT_PATH = Path(__file__).parents[0]

# Import and register worker modules from agent directory
registry.import_module(project_path=CURRENT_PATH.joinpath("agent"))

import os
# Add parent directory to Python path for imports
import sys

sys.path.append(os.path.abspath(CURRENT_PATH.joinpath("../../")))

# Import custom image input worker
from agent.outfit_image_input.outfit_image_input import OutfitImageInput
# Import task type for implementing loops in workflow
from omagent_core.engine.workflow.task.do_while_task import DoWhileTask

from examples.step2_outfit_with_switch.agent.outfit_recommendation.outfit_recommendation import \
    OutfitRecommendation

# Configure container with Redis storage and load settings
container.register_stm("RedisSTM")
container.from_config(CURRENT_PATH.joinpath("container.yaml"))


# Initialize workflow for outfit recommendations with loops
workflow = ConductorWorkflow(name="step3_outfit_with_loop")

# Define workflow tasks:
# 1. Get initial outfit image input
task1 = simple_task(task_def_name="OutfitImageInput", task_reference_name="image_input")

# 2. Ask questions about the outfit
task2 = simple_task(task_def_name="OutfitQA", task_reference_name="outfit_qa")

# 3. Decide if enough information is gathered
task3 = simple_task(task_def_name="OutfitDecider", task_reference_name="outfit_decider")

# 4. Generate final outfit recommendations
task4 = simple_task(
    task_def_name="OutfitRecommendation", task_reference_name="outfit_recommendation"
)

# Create loop that continues Q&A until sufficient information is gathered
# Loop terminates when outfit_decider returns decision=true
outfit_qa_loop = DoWhileTask(
    task_ref_name="outfit_loop",
    tasks=[task2, task3],
    termination_condition='if ($.outfit_decider["decision"] == true){false;} else {true;} ',
)

# Define workflow sequence: image input -> Q&A loop -> final recommendation
workflow >> task1 >> outfit_qa_loop >> task4

# Register workflow with conductor server
workflow.register(True)

# Initialize and start app client with workflow and image input worker
config_path = CURRENT_PATH.joinpath("configs")
agent_client = AppClient(
    interactor=workflow, config_path=config_path, workers=[OutfitImageInput()]
)
agent_client.start_interactor()

```

### Core Architecture Module: `examples/step3_outfit_with_loop/run_cli.py`
```
# Import core modules for workflow management and configuration
import os
os.environ["OMAGENT_MODE"] = "lite"

from omagent_core.engine.workflow.conductor_workflow import ConductorWorkflow
from omagent_core.engine.workflow.task.simple_task import simple_task
from omagent_core.utils.container import container
from omagent_core.utils.logger import logging

logging.init_logger("omagent", "omagent", level="INFO")

from pathlib import Path

from omagent_core.clients.devices.cli import DefaultClient
# Import registry and CLI client modules
from omagent_core.utils.registry import registry

CURRENT_PATH = Path(__file__).parents[0]

# Import and register worker modules from agent directory
registry.import_module(project_path=CURRENT_PATH.joinpath("agent"))

import os
# Add parent directory to Python path
import sys

sys.path.append(os.path.abspath(CURRENT_PATH.joinpath("../../")))

# Import custom outfit image input worker
from agent.outfit_image_input.outfit_image_input import OutfitImageInput
# Import loop task type for iterative Q&A
from omagent_core.engine.workflow.task.do_while_task import DoWhileTask

from examples.step2_outfit_with_switch.agent.outfit_recommendation.outfit_recommendation import \
    OutfitRecommendation

# Configure Redis storage and load container settings
container.register_stm("SharedMemSTM")
container.from_config(CURRENT_PATH.joinpath("container.yaml"))


# Initialize outfit recommendation workflow
workflow = ConductorWorkflow(name="step3_outfit_with_loop")

# Define workflow tasks:
# 1. Get initial outfit image from user
task1 = simple_task(task_def_name="OutfitImageInput", task_reference_name="image_input")

# 2. Ask questions about the outfit
task2 = simple_task(task_def_name="OutfitQA", task_reference_name="outfit_qa")

# 3. Check if enough information is gathered
task3 = simple_task(task_def_name="OutfitDecider", task_reference_name="outfit_decider")

# 4. Generate final outfit recommendations
task4 = simple_task(
    task_def_name="OutfitRecommendation", task_reference_name="outfit_recommendation"
)

# Create loop that continues Q&A until sufficient information is gathered
# Loop terminates when outfit_decider returns decision=true
outfit_qa_loop = DoWhileTask(
    task_ref_name="outfit_loop",
    tasks=[task2, task3],
    termination_condition='if ($.outfit_decider["decision"] == true){false;} else {true;} ',
)

# Define workflow sequence: image input -> Q&A loop -> final recommendation
workflow >> task1 >> outfit_qa_loop >> task4

# Register workflow with conductor server
workflow.register(True)

# Initialize and start CLI client with workflow and image input worker
config_path = CURRENT_PATH.joinpath("configs")
cli_client = DefaultClient(
    interactor=workflow, config_path=config_path, workers=[OutfitImageInput()]
)
cli_client.start_interactor()

```

### Core Architecture Module: `examples/step3_outfit_with_loop/run_webpage.py`
```
# Import core OmAgent components for workflow management and app functionality
import os
os.environ["OMAGENT_MODE"] = "lite"
from omagent_core.clients.devices.webpage import WebpageClient
from omagent_core.engine.workflow.conductor_workflow import ConductorWorkflow
from omagent_core.engine.workflow.task.simple_task import simple_task
from omagent_core.utils.container import container
from omagent_core.utils.logger import logging

logging.init_logger("omagent", "omagent", level="INFO")

from pathlib import Path

from omagent_core.utils.registry import registry

CURRENT_PATH = Path(__file__).parents[0]

# Import and register worker modules from agent directory
registry.import_module(project_path=CURRENT_PATH.joinpath("agent"))

# Add parent directory to Python path for imports
import sys

sys.path.append(os.path.abspath(CURRENT_PATH.joinpath("../../")))

# Import custom image input worker
from agent.outfit_image_input.outfit_image_input import OutfitImageInput
# Import task type for implementing loops in workflow
from omagent_core.engine.workflow.task.do_while_task import DoWhileTask

from examples.step2_outfit_with_switch.agent.outfit_recommendation.outfit_recommendation import \
    OutfitRecommendation

# Configure container with Redis storage and load settings
container.register_stm("RedisSTM")
container.from_config(CURRENT_PATH.joinpath("container.yaml"))


# Initialize workflow for outfit recommendations with loops
workflow = ConductorWorkflow(name="step3_outfit_with_loop")

# Define workflow tasks:
# 1. Get initial outfit image input
task1 = simple_task(task_def_name="OutfitImageInput", task_reference_name="image_input")

# 2. Ask questions about the outfit
task2 = simple_task(task_def_name="OutfitQA", task_reference_name="outfit_qa")

# 3. Decide if enough information is gathered
task3 = simple_task(task_def_name="OutfitDecider", task_reference_name="outfit_decider")

# 4. Generate final outfit recommendations
task4 = simple_task(
    task_def_name="OutfitRecommendation", task_reference_name="outfit_recommendation"
)

# Create loop that continues Q&A until sufficient information is gathered
# Loop terminates when outfit_decider returns decision=true
outfit_qa_loop = DoWhileTask(
    task_ref_name="outfit_loop",
    tasks=[task2, task3],
    termination_condition='if ($.outfit_decider["decision"] == true){false;} else {true;} ',
)

# Define workflow sequence: image input -> Q&A loop -> final recommendation
workflow >> task1 >> outfit_qa_loop >> task4

# Register workflow with conductor server
workflow.register(True)

# Initialize and start app client with workflow and image input worker
config_path = CURRENT_PATH.joinpath("configs")
agent_client = WebpageClient(
    interactor=workflow, config_path=config_path, workers=[OutfitImageInput()]
)
agent_client.start_interactor()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #246** (2025-03-24): **pymilvus维度匹配不上**
  *Symptoms*: pymilvus.exceptions.MilvusException: <MilvusException: (code=2000, message=vector dimension mismatch, expected vector size(byte) 512, actual 3072.: segcore error)>  你好，把OpenaiTextEmbeddingV3的model_id改为ollama的nomic-embed-text后报错如上，请问哪里需要修改？
  **Post-Mortem & Fix Analysis**:
  > 你好，需要在`examples/video_understanding/container.yaml`的MilvusLTM components中进行修改，设置`dim`为对应的向量化模型提供的维度。 例如openai的text-embedding-3-large模型提供的向量化维度为3072，则设置为3072。 请注意，如果存在已有数据，请在换模型之后重新进行preprocess操作，可以通过更改video_cache的名称（建议）或直接删除来实现。 

- **Issue #245** (2025-03-19): **Standardize the initialization and add range info**
  *Symptoms*: 1. Standardize the initialization of channel and client. 2. Add a utility class for obtaining front, left, and right distances.
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review, invoke the `@coderabbitai review` command. >  > You can disable this status message by setting the `reviews.review_status` to `false` in the CodeRabbit configuration file.  <!-- end of auto-generated comment: skip review by coderabbit.ai --> <!-- tips_start -->  ---  Thanks for using CodeRabbit! It's free for OSS, and your support helps us grow. If you like it, consider giving us a shout-out.  <details> <summary>❤️ Share</summary>  - [X](https://twitter.com/intent/tweet?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%2

- **Issue #244** (2025-03-18): **Add utility classes for Unitree Go2 operations: FreeAvoid, GetImageSa…**
  *Symptoms*: …mple, Move, StandUp, StandDown, and StopMove; implement workflow and container setup for ut_dog example.
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review, invoke the `@coderabbitai review` command. >  > You can disable this status message by setting the `reviews.review_status` to `false` in the CodeRabbit configuration file.  <!-- end of auto-generated comment: skip review by coderabbit.ai --> <!-- tips_start -->  ---  Thanks for using CodeRabbit! It's free for OSS, and your support helps us grow. If you like it, consider giving us a shout-out.  <details> <summary>❤️ Share</summary>  - [X](https://twitter.com/intent/tweet?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%2

- **Issue #243** (2025-03-18): **Update parameter descriptions in move.py**
  *Symptoms*: Update parameter descriptions in move.py
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review, invoke the `@coderabbitai review` command. >  > You can disable this status message by setting the `reviews.review_status` to `false` in the CodeRabbit configuration file.  <!-- end of auto-generated comment: skip review by coderabbit.ai --> <!-- tips_start -->  ---  Thanks for using CodeRabbit! It's free for OSS, and your support helps us grow. If you like it, consider giving us a shout-out.  <details> <summary>❤️ Share</summary>  - [X](https://twitter.com/intent/tweet?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%2

- **Issue #242** (2025-03-18): **Add a utility class for go2: get image sample**
  *Symptoms*: Add a utility class for go2: get image sample
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review, invoke the `@coderabbitai review` command. >  > You can disable this status message by setting the `reviews.review_status` to `false` in the CodeRabbit configuration file.  <!-- end of auto-generated comment: skip review by coderabbit.ai --> <!-- tips_start -->  ---  Thanks for using CodeRabbit! It's free for OSS, and your support helps us grow. If you like it, consider giving us a shout-out.  <details> <summary>❤️ Share</summary>  - [X](https://twitter.com/intent/tweet?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%2

- **Issue #240** (2025-03-26): **运行run_webpage.py，一直没有对话**
  *Symptoms*: 使用ollama，模型id：minicpm-v:8b ![Image](https://github.com/user-attachments/assets/52a22330-4ebc-4ac4-b184-ff6acca09661) ![Image](https://github.com/user-attachments/assets/6dea93f6-eb60-40d7-b236-636ed9e9294d)
  **Post-Mortem & Fix Analysis**:
  > 你好，可否提供一下从启动运行开始的日志以便于我们定位和排查问题，谢谢。
  > 已经解决了，是路径没写对，谢谢！

- **Issue #239** (2025-03-18): **Add utility classes for go2 operations: free avoid, stand up, stand d…**
  *Symptoms*: …own, move, stop move  Add utility classes for go2 operations: free avoid, stand up, stand down, move, stop move  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - **New Features**   - Introduced a free avoid tool to enable or disable the robot's avoidance mode.   - Added a movement control tool for flexible directional and rotational commands.   - Implemented stand up and stand down commands to adjust the robot's posture.   - Integrated a stop movement tool to safely halt ongoing commands.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  ## Walkthrough This pull request introduces five new modules that each add a tool class for controlling the Unitree Go2 robot. Each tool (i.e., FreeAvoid, Move, StandDown, StandUp, and StopMove) is implemented as a subclass of a base tool and features its own argument schema, network interface validation, and error handling. The changes also initialize necessary clients (such as the SportClient, and in one case, the ChannelFactory) and implement the core control flow for executing robot commands safely.  ## Changes  | Files                                                                                                                     | Change Summary                                                                                                                                                                                                                                               
  > > [!NOTE] > Generated docstrings for this pull request at https://github.com/om-ai-lab/OmAgent/pull/241

- **Issue #238** (2025-03-18): **video_understanding使用ollama**
  *Symptoms*: 你好！请问在video_understanding中使用ollama该怎么填写yml文件，可以给个示例吗。 container.yaml中conductor_config是指：https://github.com/Netflix/conductor    ？ 十分 感谢您的解答！！

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

### Incident Patch 1: `d8f71893` (2025-02-24)
**Commit Message**: Merge pull request #227 from panregedit:fix/update_package_version

update package version

**File**: `omagent-core/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 
 [tool.poetry]
 name = "omagent_core"
-version = "0.2.3"
+version = "0.2.4"
 description = "Core package for OmAgent"
 authors = ["OM AI Lab <OmAIglobal2024@gmail.com>"]
 readme = "README.md"
```

---

### Incident Patch 2: `fd0e5c3e` (2025-02-20)
**Commit Message**: Fix memory leak bug in SharedMemSTM

Fix memory leak bug in SharedMemSTM

**File**: `omagent-core/src/omagent_core/memories/stms/stm_sharedMem.py` (modified, +66/-18)
```diff
@@ -3,6 +3,7 @@
 from multiprocessing import shared_memory
 from typing import Any
 import atexit
+import os
 
 import numpy as np
 from omagent_core.memories.stms.stm_base import STMBase, WorkflowInstanceProxy
@@ -14,28 +15,73 @@ class SharedMemSTM(STMBase):
     def __init__(self, id=None):
         super().__init__()
         self.id = id
-        self.workflow_instance_ids = set()
-        atexit.register(self.cleanup)
-
-    def __del__(self):
-        self.cleanup()
+        self.main_pid = os.getpid()
+        self._cleaned_up = False
+        
+        # Use shared memory to store workflow_instance_ids
+        if os.getpid() == self.main_pid:
+            try:
+                self._ids_shm = shared_memory.SharedMemory(name='workflow_ids', size=1024*1024)
+            except FileNotFoundError:
+                self._ids_shm = shared_memory.SharedMemory(create=True, name='workflow_ids', size=1024*1024)
+                self._save_ids(set())
+        else:
+            try:
+                self._ids_shm = shared_memory.SharedMemory(name='workflow_ids')
+            except FileNotFoundError:
+                # if not found, create a new one
+                self._ids_shm = shared_memory.SharedMemory(create=True, name='workflow_ids', size=1024*1024)
+                self._save_ids(set())
+
+        if os.getpid() == self.main_pid:
+            atexit.register(self.cleanup)
+
+    def _save_ids(self, ids_set):
+        """Save ids set to shared memory"""
+        pickled_data = pickle.dumps(ids_set)
+        self._ids_shm.buf[:len(pickled_data)] = pickled_data
+
+    def _load_ids(self):
+        """Load ids set from shared memory"""
+        try:
+            return pickle.loads(bytes(self._ids_shm.buf).strip(b'\x00'))
+        except (pickle.UnpicklingError, EOFError):
+            return set()
 
-    def cleanup(self):
-        for workflow_instance_id in list(self.workflow_instance_ids):
-            self.clear(workflow_instance_id)
+    def _add_workflow_id(self, workflow_id):
+        """Add workflow id to shared set"""
+        ids = self._load_ids()
+        ids.add(workflow_id)
+        self._save_ids(ids)
 
     def __call__(self, workflow_instance_id: str):
-        """
-        Return a WorkflowInstanceProxy for the given workflow instance ID.
-
-        Args:
-            workflow_instance_id (str): The ID of the workflow instance.
-
-        Returns:
-            WorkflowInstanceProxy: A proxy object for accessing the workflow instance data.
-        """
-        self.workflow_instance_ids.add(workflow_instance_id)
+        self._add_workflow_id(workflow_instance_id)
         return WorkflowInstanceProxy(self, workflow_instance_id)
+    
+    def cleanup(self):
+        if os.getpid() == self.main_pid and not self._cleaned_up:
+            try:
+                workflow_ids = self._load_ids()
+                for workflow_instance_id in list(workflow_ids):
+                    try:
+                        self.clear(workflow_instance_id)
+                    except Exception as e:
+                        print(f"Error cleaning up {workflow_instance_id}: {e}")
+            finally:
+                self._cleaned_up = True
+                # clear workflow_ids shared memory
+                if hasattr(self, '_ids_shm'):
+                    self._ids_shm.close()
+                    if os.getpid() == self.main_pid:
+                        try:
+                            self._ids_shm.unlink()
+                        except Exception:
+                            pass
+
+    def __del__(self):
+        if not self._cleaned_up:
+            self.cleanup()
+    
 
     def _create_shm(self, workflow_instance_id: str, size: int = 1024 * 1024 * 100):
         """Create a new shared memory block"""
@@ -53,6 +99,7 @@ def _get_shm(self, workflow_instance_id, size: int = 1024 * 1024 * 100):
             shm = shared_memory.SharedMemory(name=shortened_id)
         except FileNotFoundError:
             shm = shared_memory.SharedMemory(create=True, size=size, name=shortened_id)
+            self._add_workflow_id(workflow_instance_id)
         return shm
 
     def __getitem__(self, key: tuple | str) -> Any:
@@ -99,6 +146,7 @@ def __setitem__(self, key: tuple, value: Any) -> None:
             value (Any): The value to associate with the key.
         """
         workflow_instance_id, key = key
+        self._add_workflow_id(workflow_instance_id)
         shm = self._get_shm(workflow_instance_id)
         try:
             data = pickle.loads(bytes(shm.buf).strip(b"\x00"))
```

---

### Incident Patch 3: `56459647` (2025-02-20)
**Commit Message**: Fix bug in SharedMemSTM initialization

Fix bug in SharedMemSTM initialization

**File**: `omagent-core/src/omagent_core/memories/stms/stm_sharedMem.py` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
 
 @registry.register_component()
 class SharedMemSTM(STMBase):
-    def __init__(self, id):
+    def __init__(self, id=None):
         super().__init__()
         self.id = id
         self.workflow_instance_ids = set()
```

---

### Incident Patch 4: `5b6de3e5` (2025-02-18)
**Commit Message**: Fix bug where SharedMemSTM does not release memory after program exit

Fix bug where SharedMemSTM does not release memory after program exit

**File**: `omagent-core/src/omagent_core/memories/stms/stm_sharedMem.py` (modified, +15/-0)
```diff
@@ -2,6 +2,7 @@
 import pickle
 from multiprocessing import shared_memory
 from typing import Any
+import atexit
 
 import numpy as np
 from omagent_core.memories.stms.stm_base import STMBase, WorkflowInstanceProxy
@@ -10,6 +11,19 @@
 
 @registry.register_component()
 class SharedMemSTM(STMBase):
+    def __init__(self, id):
+        super().__init__()
+        self.id = id
+        self.workflow_instance_ids = set()
+        atexit.register(self.cleanup)
+
+    def __del__(self):
+        self.cleanup()
+
+    def cleanup(self):
+        for workflow_instance_id in list(self.workflow_instance_ids):
+            self.clear(workflow_instance_id)
+
     def __call__(self, workflow_instance_id: str):
         """
         Return a WorkflowInstanceProxy for the given workflow instance ID.
@@ -20,6 +34,7 @@ def __call__(self, workflow_instance_id: str):
         Returns:
             WorkflowInstanceProxy: A proxy object for accessing the workflow instance data.
         """
+        self.workflow_instance_ids.add(workflow_instance_id)
         return WorkflowInstanceProxy(self, workflow_instance_id)
 
     def _create_shm(self, workflow_instance_id: str, size: int = 1024 * 1024 * 100):
```

---

### Incident Patch 5: `0ab66817` (2025-02-17)
**Commit Message**: Fix bug where worker lacked workflow_instance_id

Fix bug where worker lacked workflow_instance_id

**File**: `omagent-core/src/omagent_core/clients/devices/app/input.py` (modified, +0/-2)
```diff
@@ -22,8 +22,6 @@ class AppInput(InputBase):
     redis_stream_client: RedisConnector
 
     def read_input(self, workflow_instance_id: str, input_prompt=""):
-        if os.getenv("OMAGENT_MODE") == "lite":
-            workflow_instance_id = "temp"
         stream_name = f"{workflow_instance_id}_input"
         group_name = "omappagent"  # consumer group name
         consumer_name = f"{workflow_instance_id}_agent"  # consumer name
```

**File**: `omagent-core/src/omagent_core/clients/devices/cli/lite_client.py` (modified, +10/-7)
```diff
@@ -1,4 +1,5 @@
 from pathlib import Path
+import uuid
 
 from omagent_core.services.connectors.redis import RedisConnector
 from omagent_core.utils.container import container
@@ -48,22 +49,26 @@ def __init__(
         self._input_prompt = input_prompt
         self._task_to_domain = {}
         worker_config = build_from_file(self._config_path)
+        self.workflow_instance_id = str(uuid.uuid4())
         self.initialization(workers, worker_config)
 
     def initialization(self, workers, worker_config):        
         self.workers = {}
         for worker in workers:
+            worker.workflow_instance_id = self.workflow_instance_id
             self.workers[type(worker).__name__] = worker            
         
         for config in worker_config:
-            worker_cls = registry.get_worker(config['name'])        
-            self.workers[config['name']] = worker_cls(**config)                    
+            worker_cls = registry.get_worker(config['name'])    
+            worker = worker_cls(**config)
+            worker.workflow_instance_id = self.workflow_instance_id
+            self.workers[config['name']] = worker
 
     def start_interactor(self):
         import threading
         from time import sleep
 
-        workflow_instance_id = "temp"
+        workflow_instance_id = self.workflow_instance_id
         exception_queue = queue.Queue()  # add exception queue
 
         try:
@@ -72,19 +77,17 @@ def start_interactor(self):
             # ---------------------------------------------------
             def run_workflow():
                 try:
-                    nonlocal workflow_instance_id
-                    wid = self._interactor.start_workflow_with_input(
+                    self._interactor.start_workflow_with_input(
                         workflow_input={}, workers=self.workers
                     )
-                    workflow_instance_id = wid
                 except Exception as e:
                     exception_queue.put(e)  # add exception to queue
                     logging.error(f"Error starting workflow: {e}")
                     raise e
             workflow_thread = threading.Thread(target=run_workflow, daemon=True)
             workflow_thread.start()
             # Wait until workflow_instance_id is set by the thread
-            #while workflow_instance_id is None:
+            # while workflow_instance_id is None:
             #    sleep(0.1)
 
             stream_name = f"{workflow_instance_id}_output"
```

**File**: `omagent-core/src/omagent_core/engine/workflow/executor/local_workflow_executor.py` (modified, +0/-3)
```diff
@@ -1,8 +1,6 @@
-import uuid
 from typing import Dict
 import logging
 from omagent_core.utils.registry import registry
-import uuid
 import logging
 from omagent_core.engine.http.models import *
 import json
@@ -37,7 +35,6 @@ def evaluate_input_parameters(self, task: Dict) -> Dict:
 
 
     def start_workflow(self, workflow_def, start_request, workers) -> str:
-        workflow_id = str(uuid.uuid4())        
         print ("start_request:", start_request.input)
         self.task_outputs["workflow"] = {"input": start_request.input}        
         output = {}
```

---

### Incident Patch 6: `82f22aa0` (2025-02-14)
**Commit Message**: program exit bug fix

**File**: `omagent-core/src/omagent_core/clients/devices/cli/lite_client.py` (modified, +4/-3)
```diff
@@ -20,7 +20,8 @@
 from omagent_core.utils.container import container
 from omagent_core.utils.logger import logging
 from omagent_core.utils.registry import registry
-import os 
+import os
+import sys
 import queue
 
 
@@ -193,7 +194,7 @@ def run_workflow():
 
                 except Exception as e:
                     logging.error(f"Error in main loop: {e}")
-                    os._exit(0)
+                    sys.exit(1)
             self.stop_interactor()
             
 
@@ -206,7 +207,7 @@ def run_workflow():
     def stop_interactor(self):
         #self._task_handler_interactor.stop_processes()
         print ("stop_interactor")
-        os._exit(0)
+        sys.exit(0)
 
 
     def start_processor(self):
```

**File**: `omagent-core/src/omagent_core/utils/container.py` (modified, +0/-1)
```diff
@@ -1,7 +1,6 @@
 from pathlib import Path
 from typing import Dict, List, Optional, Type
 from threading import Thread
-from fakeredis import TcpFakeServer
 
 from omagent_core.engine.configuration.aaas_config import AaasConfig
 import yaml
```

---

### Incident Patch 7: `c96a009c` (2025-02-14)
**Commit Message**: video understanding support lite version, fix minor bugs in lite version

**File**: `examples/general_dnc/configs/workers/conclude.yml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 name: Conclude
-llm: ${sub|text_res_stream}
+llm: ${sub|text_res}
 prompts:
   - role: system
     template: examples/general_dnc/agent/conclude/sys_prompt.prompt
```

**File**: `examples/general_dnc/run_cli.py` (modified, +0/-1)
```diff
@@ -1,7 +1,6 @@
 # Import required modules and components
 import os
 os.environ["OMAGENT_MODE"] = "lite"
-import os
 from pathlib import Path
 
 from agent.conclude.conclude import Conclude
```

**File**: `examples/video_understanding/agent/conclude/conclude.py` (modified, +7/-9)
```diff
@@ -9,7 +9,7 @@
 from omagent_core.models.llms.prompt import PromptTemplate
 from omagent_core.utils.logger import logging
 from omagent_core.utils.registry import registry
-from openai import Stream
+from collections.abc import Iterator
 from pydantic import Field
 
 CURRENT_PATH = root_path = Path(__file__).parents[0]
@@ -63,22 +63,20 @@ def _run(self, dnc_structure: dict, last_output: str, *args, **kwargs):
                 list(self.stm(self.workflow_instance_id).get("image_cache", {}).keys())
             ),
         )
-        if isinstance(chat_complete_res, Stream):
+        if isinstance(chat_complete_res, Iterator):
             last_output = "Answer: "
             self.callback.send_incomplete(
                 agent_id=self.workflow_instance_id, msg="Answer: "
             )
             for chunk in chat_complete_res:
-                if chunk.choices[0].delta.content is not None:
+                if len(chunk.choices) > 0:
+                    current_msg = chunk.choices[0].delta.content if chunk.choices[0].delta.content is not None else ''
                     self.callback.send_incomplete(
                         agent_id=self.workflow_instance_id,
-                        msg=f"{chunk.choices[0].delta.content}",
+                        msg=f"{current_msg}",
                     )
-                    last_output += chunk.choices[0].delta.content
-                else:
-                    self.callback.send_block(agent_id=self.workflow_instance_id, msg="")
-                    last_output += ""
-                    break
+                    last_output += current_msg
+            self.callback.send_answer(agent_id=self.workflow_instance_id, msg="")
         else:
             last_output = chat_complete_res["choices"][0]["message"]["content"]
             self.callback.send_answer(
```

**File**: `examples/video_understanding/agent/video_preprocessor/video_preprocess.py` (modified, +2/-4)
```diff
@@ -62,7 +62,7 @@ def calculate_md5(self, file_path):
                 md5_hash.update(byte_block)
         return md5_hash.hexdigest()
 
-    def _run(self, video_path: str, *args, **kwargs):
+    def _run(self, test: str, *args, **kwargs):
         """
         Process video files by:
         1. Calculating MD5 hash of input video for caching
@@ -250,7 +250,5 @@ def _run(self, video_path: str, *args, **kwargs):
             with open(cache_path, "wb") as f:
                 pickle.dump(video.scenes, f)
         return {
-            "video_md5": video_md5,
-            "video_path": video_path,
-            "instance_id": self.workflow_instance_id,
+            "video_md5": video_md5
         }
```

**File**: `examples/video_understanding/agent/video_qa/qa.py` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ class VideoQA(BaseWorker, BaseLLMBackend):
     )
     text_encoder: OpenaiTextEmbeddingV3
 
-    def _run(self, video_md5: str, video_path: str, instance_id: str, *args, **kwargs):
+    def _run(self, video_md5: str, *args, **kwargs):
         self.stm(self.workflow_instance_id)["image_cache"] = {}
         self.stm(self.workflow_instance_id)["former_results"] = {}
         question = self.input.read_input(
```

**File**: `examples/video_understanding/compile_container.py` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 # Register required components
 container.register_callback(callback="DefaultCallback")
 container.register_input(input="AppInput")
-container.register_stm("RedisSTM")
+container.register_stm("SharedMemSTM")
 container.register_ltm(ltm="VideoMilvusLTM")
 # Compile container config
 container.compile_config(CURRENT_PATH)
```

**File**: `examples/video_understanding/configs/workers/conclude.yml` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 name: Conclude
-llm: ${sub|text_res_stream}
+llm: ${sub|text_res}
 output_parser: 
   name: StrParser
\ No newline at end of file
```

**File**: `examples/video_understanding/run_cli.py` (modified, +3/-2)
```diff
@@ -1,12 +1,13 @@
 # Import required modules and components
 import os
+os.environ["OMAGENT_MODE"] = "lite"
 from pathlib import Path
 
 from agent.conclude.conclude import Conclude
 from agent.video_preprocessor.video_preprocess import VideoPreprocessor
 from agent.video_qa.qa import VideoQA
 from omagent_core.advanced_components.workflow.dnc.workflow import DnCWorkflow
-from omagent_core.clients.devices.cli.client import DefaultClient
+from omagent_core.clients.devices.cli import DefaultClient
 from omagent_core.engine.automator.task_handler import TaskHandler
 from omagent_core.engine.workflow.conductor_workflow import ConductorWorkflow
 from omagent_core.engine.workflow.task.do_while_task import (DnCLoopTask,
@@ -28,7 +29,7 @@
 registry.import_module(project_path=CURRENT_PATH.joinpath("agent"))
 
 # Load container configuration from YAML file
-container.register_stm("RedisSTM")
+container.register_stm("SharedMemSTM")
 container.register_ltm(ltm="VideoMilvusLTM")
 container.from_config(CURRENT_PATH.joinpath("container.yaml"))
 
```

---

### Incident Patch 8: `e8c69d62` (2025-02-10)
**Commit Message**: fixed the bug to stuck at the end and add load json for workflow

**File**: `omagent-core/src/omagent_core/engine/workflow/conductor_workflow.py` (modified, +29/-1)
```diff
@@ -22,7 +22,8 @@
 from shortuuid import uuid
 from typing_extensions import Self
 import os
-
+from omagent_core.engine.http.models.workflow_def import to_workflow_def
+from omagent_core.engine.workflow.task.simple_task import simple_task
 
 class ConductorWorkflow:
     SCHEMA_VERSION = 2
@@ -194,6 +195,31 @@ def workflow_input(self, input: dict) -> Self:
         keys = list(input.keys())
         self.input_template(input)
         return self
+        
+    def load(self, json_file_path: str) -> None:
+        import json
+        from pathlib import Path
+
+        # Load the JSON file
+        json_path = Path(json_file_path)
+        if not json_path.is_file():
+            raise FileNotFoundError(f"The file {json_file_path} does not exist.")
+
+        with open(json_path, 'r') as file:
+            data = json.load(file)
+        workflow_def = to_workflow_def(json_data=data)
+        self.name = workflow_def.name
+        self._tasks = [simple_task(task_def_name=task.name, task_reference_name=task.task_reference_name, inputs=task.input_parameters) for task in workflow_def.tasks]
+        self._input_parameters = workflow_def.input_parameters
+        self._output_parameters = workflow_def.output_parameters
+        self._failure_workflow = workflow_def.failure_workflow
+        self._timeout_seconds = workflow_def.timeout_seconds
+        self._variables = workflow_def.variables
+        self._input_template = workflow_def.input_template
+        self._workflow_status_listener_enabled = workflow_def.workflow_status_listener_enabled
+        self._owner_email = workflow_def.owner_email
+
+    
 
     # Register the workflow definition with the server. If overwrite is set, the definition on the server will be
     # overwritten. When not set, the call fails if there is any change in the workflow definition between the server
@@ -321,7 +347,9 @@ def to_workflow_task(self):
     def __get_workflow_task_list(self) -> List[WorkflowTask]:
         workflow_task_list = []
         for task in self._tasks:
+            print (type(task))
             converted_task = task.to_workflow_task()
+            print (converted_task)
             if isinstance(converted_task, list):
                 for subtask in converted_task:
                     workflow_task_list.append(subtask)
```

**File**: `omagent-core/src/omagent_core/engine/workflow/executor/local_workflow_executor.py` (modified, +4/-3)
```diff
@@ -227,15 +227,16 @@ def __init__(self):
 
     def start_workflow(self, start_workflow_request: StartWorkflowRequest, workers=None) -> str:
         try:
-            return self.local_executor.start_workflow(
+            exe_output = self.local_executor.start_workflow(
                 workflow_def=start_workflow_request.workflow_def,
                 start_request=start_workflow_request, workers=workers
-            )
+            )            
             self.status.status = "COMPLETED"
+            return exe_output
         except Exception as e:
             self.status.status = "FAILED"
             self.status.error = str(e)
-            
+
 
     def get_workflow(self, workflow_id: str, include_tasks: bool = None) -> Workflow:        
         return self.status
```

---

### Incident Patch 9: `55a3c2a6` (2025-01-26)
**Commit Message**: Fixed issue with LLM payload containing only text and updated image handling method in DNC operator.

**File**: `examples/general_dnc/agent/conclude/conclude.py` (modified, +1/-3)
```diff
@@ -50,9 +50,7 @@ def _run(self, dnc_structure: dict, last_output: str, *args, **kwargs):
         chat_complete_res = self.simple_infer(
             task=task.get_root().task,
             result=str(last_output),
-            img_placeholders="".join(
-                list(self.stm(self.workflow_instance_id).get("image_cache", {}).keys())
-            ),
+            img_placeholders=self.stm(self.workflow_instance_id).get("image_cache"),
         )
         if isinstance(chat_complete_res, Iterator):
             last_output = "Answer: "
```

**File**: `examples/general_dnc/agent/input_interface/input_interface.py` (modified, +1/-1)
```diff
@@ -35,5 +35,5 @@ def _run(self, *args, **kwargs):
             elif each_content["type"] == "text":
                 text = each_content["data"]
         if image is not None:
-            self.stm(self.workflow_instance_id)["image_cache"] = {f"<image_0>": image}
+            self.stm(self.workflow_instance_id)["image_cache"] = image
         return {"query": text}
```

**File**: `omagent-core/src/omagent_core/advanced_components/workflow/dnc/agent/conqueror/conqueror.py` (modified, +3/-3)
```diff
@@ -18,6 +18,7 @@
 from pydantic import Field
 from tenacity import (retry, retry_if_exception_message, stop_after_attempt,
                       stop_after_delay)
+from omagent_core.utils.logger import logging
 
 CURRENT_PATH = Path(__file__).parents[0]
 
@@ -96,13 +97,12 @@ def _run(self, dnc_structure: dict, last_output: str, *args, **kwargs):
             ),
             "former_results": self.stm(self.workflow_instance_id)["former_results"],
             "extra_info": self.stm(self.workflow_instance_id).get("extra"),
-            "img_placeholders": "".join(
-                list(self.stm(self.workflow_instance_id).get("image_cache", {}).keys())
-            ),
+            "img_placeholders": self.stm(self.workflow_instance_id).get("image_cache"),
         }
 
         # Call LLM to get next actions or task completion results
         chat_complete_res = self.infer(input_list=[payload])
+        logging.info(f"Conqueror chat_complete_res: {chat_complete_res}")
         content = chat_complete_res[0]["choices"][0]["message"].get("content")
         content = json_repair.loads(content)
 
```

**File**: `omagent-core/src/omagent_core/advanced_components/workflow/dnc/agent/divider/divider.py` (modified, +2/-0)
```diff
@@ -14,6 +14,7 @@
 from pydantic import Field
 from tenacity import (retry, retry_if_exception_message, stop_after_attempt,
                       stop_after_delay)
+from omagent_core.utils.logger import logging
 
 CURRENT_PATH = Path(__file__).parents[0]
 
@@ -85,6 +86,7 @@ def _run(self, dnc_structure: dict, last_output: str, *args, **kwargs):
             former_results=last_output,
             tools=self.tool_manager.generate_prompt(),
         )
+        logging.info(f"Divider chat_complete_res: {chat_complete_res}")
         chat_complete_res = json_repair.loads(
             chat_complete_res["choices"][0]["message"]["content"]
         )
```

**File**: `omagent-core/src/omagent_core/models/llms/schemas.py` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ def content_validator(
             raise ValueError(
                 "Content must be a string, a list of Content objects or list of dicts."
             )
-        return formatted
+        return formatted[0] if len(formatted) == 1 else formatted
 
     @classmethod
     def system(cls, content: str | List[str | Dict | Content]) -> "Message":
```

**File**: `omagent-core/src/omagent_core/tool_system/manager.py` (modified, +2/-0)
```diff
@@ -247,6 +247,7 @@ def execute_task(self, task, related_info="", function=None):
             [{"task": task, "related_info": related_info}],
             tools=self.generate_schema(),
         )[0]
+        logging.info(f"ToolManager execute_task chat_complete_res: {chat_complete_res}")
         content = chat_complete_res["choices"][0]["message"].get("content")
         tool_calls = chat_complete_res["choices"][0]["message"].get("tool_calls")
         if not tool_calls:
@@ -318,6 +319,7 @@ async def aexecute_task(self, task, related_info=None, function=None):
             [{"task": task, "related_info": list(related_info.keys())}],
             tools=self.generate_schema(),
         )[0]
+        logging.info(f"ToolManager aexecute_task chat_complete_res: {chat_complete_res}")
         content = chat_complete_res["choices"][0]["message"].get("content")
         tool_calls = chat_complete_res["choices"][0]["message"].get("tool_calls")
         if not tool_calls:
```

---

### Incident Patch 10: `68f4cc9d` (2025-01-20)
**Commit Message**: fix exit condition in loop

**File**: `omagent-core/src/omagent_core/engine/workflow/executor/local_workflow_executor.py` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ def _evaluate_single_condition(self, condition: str) -> bool:
             task_ref_full = left[2:]  # Remove $.
             if '[' in task_ref_full:
                 task_ref = task_ref_full.split('[')[0]  # Get part before [
-                array_part = task_ref_full[task_ref_full.find('[')+1:task_ref_full.find(']')].replace("'","")  # Get part between [ ]
+                array_part = task_ref_full[task_ref_full.find('[')+1:task_ref_full.find(']')].replace("'","").replace('"','')  # Get part between [ ]
                 properties = [array_part]  # Use the array part as a property
             elif "." in task_ref_full:
                 task_ref,array_part= task_ref_full.split(".")
```

---

### Incident Patch 11: `21705a60` (2025-01-17)
**Commit Message**: Add GoT and fix some loop exit

**File**: `examples/general_got/GoT.json` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+{
+    "name": "GoT",
+    "tasks": [
+        {
+            "name": "SimpleInput",
+            "taskReferenceName": "input_task",
+            "inputParameters": {},
+            "type": "SIMPLE",
+            "taskDefinition": {}
+        },
+        {
+            "name": "TaskSplitter",
+            "taskReferenceName": "task_splitter",
+            "inputParameters": {
+                "query": "${input_task.output.query}",
+                "task": "${input_task.output.task}",
+                "meta": "${input_task.output.meta}"
+            },
+            "type": "SIMPLE",
+            "taskDefinition": {}
+        },
+        {
+            "name": "got_loop_task",
+            "taskReferenceName": "got_loop_task",
+            "inputParameters": {},
+            "type": "DO_WHILE",
+            "taskDefinition": {},
+            "loopCondition": " if ( $.got_task_exit_monitor['exit_flag'] == true) { false; } else { true; }",
+            "loopOver": [
+                {
+                    "name": "TaskGenerater",
+                    "taskReferenceName": "task_generater",
+                    "inputParameters": {},
+                    "type": "SIMPLE"
+                },
+                {
+                    "name": "TaskScore",
+                    "taskReferenceName": "task_score",
+                    "inputParameters": {},
+                    "type": "SIMPLE"
+                },
+                {
+                    "name": "KeepBestN",
+                    "taskReferenceName": "task_keep_best_n",
+                    "inputParameters": {},
+                    "type": "SIMPLE"
+                },
+                {
+                    "name": "GoTTaskExitMonitor",
+                    "taskReferenceName": "got_task_exit_monitor",
+                    "inputParameters": {},
+                    "type": "SIMPLE"
+                }
+            ]
+        },
+        {
+            "name": "TaskConcluder",
+            "taskReferenceName": "task_concluder",
+            "inputParameters": {},
+            "type": "SIMPLE",
+            "taskDefinition": {}
+        }
+    ],
+    "inputParameters": [],
+    "outputParameters": {},
+    "failureWorkflow": "",
+    "schemaVersion": 2,
+    "workflowStatusListenerEnabled": false,
+    "ownerEmail": "default@omagent.ai",
+    "timeoutSeconds": 60,
+    "variables": {},
+    "inputTemplate": {}
+}
\ No newline at end of file
```

**File**: `examples/general_got/agent/input_interface/input_interface.py` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+from pathlib import Path
+import json_repair
+
+from omagent_core.utils.registry import registry
+from omagent_core.utils.general import read_image
+from omagent_core.engine.worker.base import BaseWorker
+from omagent_core.utils.logger import logging
+
+CURRENT_PATH = Path(__file__).parents[0]
+
+SUPPORT_TASK= {
+    'sort': "Please input number list.",
+    'keyword_count': "Please input a paragraph.",
+    'set_intersection': "Please input two lists of numbers."
+}
+
+@registry.register_worker()
+class InputInterfaceGot(BaseWorker):
+
+    def _run(self, *args, **kwargs):
+        # # Read user input through configured input interface
+        user_input_task = self.input.read_input(workflow_instance_id=self.workflow_instance_id, input_prompt=f'Welcome to use OmAgent GoT Algorithm, please input the task you want to conduct. Choices: {list(SUPPORT_TASK.keys())}. Please press enter if there is no specific task. Please be noted that the task is desgined only for got examples in the origin got paper.')
+        
+        task =  user_input_task['messages'][-1]['content'][0]['data']
+        if task not in SUPPORT_TASK:
+            task = ''
+
+        user_input_query = self.input.read_input(workflow_instance_id=self.workflow_instance_id, input_prompt=SUPPORT_TASK[task] if task != '' else "Please input your request.")
+        query = user_input_query['messages'][-1]['content'][0]['data']
+
+        meta_input = self.input.read_input(workflow_instance_id=self.workflow_instance_id, input_prompt="Please input meta information. If there is no meta information, please press space and then enter.")
+        meta = meta_input['messages'][-1]['content'][0]['data']
+        if meta is not None and meta != '' and meta != ' ':
+            try:    
+                meta = json_repair.loads(meta)
+            except Exception:
+                raise ValueError("Meta information should be json. {} is not valid. Please checkout the meta information.".format(meta))
+                meta = None
+        else:
+            meta = None
+        
+        return {'query': query, 'task': task, 'meta': meta}
+
```

**File**: `examples/general_got/compile_container.py` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# Import core modules and components
+from omagent_core.utils.container import container
+
+# Import workflow related modules
+from pathlib import Path
+from omagent_core.utils.registry import registry
+
+# Set up path and import modules
+CURRENT_PATH = root_path = Path(__file__).parents[0]
+registry.import_module()
+
+# Register required components
+container.register_callback(callback='AppCallback')
+container.register_input(input='AppInput')
+container.register_stm("RedisSTM")
+# Compile container config
+container.compile_config(CURRENT_PATH)
+
+
+
```

**File**: `examples/general_got/configs/llms/gpt.yml` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+name: OpenaiGPTLLM
+model_id: gpt-4o-mini
+api_key: ${env| custom_openai_key, openai_api_key}
+endpoint: ${env| custom_openai_endpoint, https://api.openai.com/v1}
+temperature: 1.0
+vision: false
+response_format: text
\ No newline at end of file
```

**File**: `examples/general_got/configs/llms/text_res.yaml` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+name: OpenaiGPTLLM
+model_id: gpt-4o
+api_key: ${env| custom_openai_key, openai_api_key}
+endpoint: ${env| custom_openai_endpoint, https://api.openai.com/v1}
+temperature: 0
+vision: false
\ No newline at end of file
```

**File**: `examples/general_got/configs/workers/general_got_workflow.yaml` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+- name: TaskSplitter
+  llm: ${sub|gpt}
+  chunk_size: 8
+  concurrency: 1
+  special_task: sort
+- name: TaskGenerater
+  llm: ${sub|gpt}
+  concurrency: 1
+  num_branches_response: 1
+  num_branches_response_for_aggregater: 1
+  num_branches_response_for_refiner: 1
+  parse_method: parse_refine_answer
+- name: TaskScore
+  llm: ${sub|gpt}
+  concurrency: 1
+  eval_method: num_errors
+- name: KeepBestN
+  llm: ${sub|gpt}
+  best_n: 1
+  higher_is_better: False
+  concurrency: 1
+- name: TaskConcluder
+  llm: ${sub|gpt}
+  concurrency: 1
+- name: GoTTaskExitMonitor
```

**File**: `examples/general_got/container.yaml` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+conductor_config:
+  name: Configuration
+  base_url:
+    value: http://10.8.25.26:8080
+    description: The Conductor Server API endpoint
+    env_var: CONDUCTOR_SERVER_URL
+  auth_key:
+    value: null
+    description: The authorization key
+    env_var: AUTH_KEY
+  auth_secret:
+    value: null
+    description: The authorization secret
+    env_var: CONDUCTOR_AUTH_SECRET
+  auth_token_ttl_min:
+    value: 45
+    description: The authorization token refresh interval in minutes.
+    env_var: AUTH_TOKEN_TTL_MIN
+  debug:
+    value: false
+    description: Debug mode
+    env_var: DEBUG
+connectors:
+  redis_stream_client:
+    name: RedisConnector
+    host:
+      value: localhost
+      env_var: HOST
+    port:
+      value: 6379
+      env_var: PORT
+    password:
+      value: null
+      env_var: PASSWORD
+    username:
+      value: null
+      env_var: USERNAME
+    db:
+      value: 0
+      env_var: DB
+  redis_stm_client:
+    name: RedisConnector
+    host:
+      value: localhost
+      env_var: HOST
+    port:
+      value: 6379
+      env_var: PORT
+    password:
+      value: null
+      env_var: PASSWORD
+    username:
+      value: null
+      env_var: USERNAME
+    db:
+      value: 0
+      env_var: DB
+components:
+  DefaultCallback:
+    name: DefaultCallback
+    bot_id:
+      value: ''
+      env_var: BOT_ID
+    start_time:
+      value: 2024-12-17_14:31:40
+      env_var: START_TIME
+    folder_name:
+      value: ./running_logs/2024-12-17_14:31:40
+      env_var: FOLDER_NAME
+    incomplete_flag:
+      value: false
+      env_var: INCOMPLETE_FLAG
+  AppInput:
+    name: AppInput
+  AppCallback:
+    name: AppCallback
+    bot_id:
+      value: ''
+      env_var: BOT_ID
+    start_time:
+      value: 2024-12-17_14:31:40
+      env_var: START_TIME
+    folder_name:
+      value: ./running_logs/2024-12-17_14:31:40
+      env_var: FOLDER_NAME
+  RedisSTM:
+    name: RedisSTM
```

**File**: `examples/general_got/run_cli.py` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+# Import required modules and components
+from omagent_core.utils.container import container
+from omagent_core.engine.workflow.conductor_workflow import ConductorWorkflow
+from omagent_core.engine.workflow.task.simple_task import simple_task
+from pathlib import Path
+from omagent_core.utils.registry import registry
+from omagent_core.clients.devices.cli.client import DefaultClient
+from omagent_core.engine.workflow.task.set_variable_task import SetVariableTask
+from omagent_core.utils.logger import logging
+from omagent_core.engine.workflow.task.do_while_task import DoWhileTask
+
+from agent.input_interface.input_interface import InputInterfaceGot
+# from omagent_core.advanced_components.workflow.dnc.workflow import DnCWorkflow
+from omagent_core.advanced_components.workflow.general_got.workflow import GoTWorkflow
+
+
+
+# Initialize logging
+logging.init_logger("omagent", "omagent", level="INFO")
+
+# Set current working directory path
+CURRENT_PATH = Path(__file__).parents[0]
+
+# Import registered modules
+registry.import_module(project_path=CURRENT_PATH.joinpath('agent'))
+
+container.register_stm("RedisSTM")
+# Load container configuration from YAML file
+container.from_config(CURRENT_PATH.joinpath('container.yaml'))
+
+
+
+# Initialize Got workflow
+workflow = ConductorWorkflow(name='GoT')
+
+# Configure workflow tasks:
+client_input_task = simple_task(task_def_name=InputInterfaceGot, task_reference_name='input_task')
+
+got_workflow = GoTWorkflow()
+got_workflow.set_input(query=client_input_task.output('query'), task=client_input_task.output('task'), meta=client_input_task.output('meta'))
+workflow >> client_input_task >> got_workflow
+
+# Register workflow
+workflow.register(True)
+
+# Initialize and start CLI client with workflow configuration
+config_path = CURRENT_PATH.joinpath('configs')
+cli_client = DefaultClient(interactor=workflow, config_path=config_path, workers=[InputInterfaceGot()])
+cli_client.start_interactor()
```

#### Recent Merged Pull Requests:
- **PR #245** (2025-03-19): Standardize the initialization and add range info (@djwu563)
- **PR #244** (2025-03-18): Add utility classes for Unitree Go2 operations: FreeAvoid, GetImageSa… (@panregedit)
- **PR #243** (2025-03-18): Update parameter descriptions in move.py (@djwu563)
- **PR #242** (2025-03-18): Add a utility class for go2: get image sample (@djwu563)
- **PR #239** (2025-03-18): Add utility classes for go2 operations: free avoid, stand up, stand d… (@djwu563)
- **PR #237** (2025-03-11): Return exception information to the interactive client. (@djwu563)
- **PR #233** (2025-03-13): Support deepseek thinking content output (@qiandl2000)
- **PR #232** (2025-03-04): Fix: fix the issue where passing None to stop variable caused error (@XeonHis)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
