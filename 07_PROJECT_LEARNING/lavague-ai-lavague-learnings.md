# Forensic Learning Record (Deep Inspection): lavague-ai/LaVague

> **Canonical Artifact**: `07_PROJECT_LEARNING/lavague-ai-lavague-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lavague-ai/LaVague](https://github.com/lavague-ai/LaVague))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:55:15.098Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lavague-ai/LaVague`
- **Description**: Large Action Model framework to develop AI Web Agents
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 6394 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/navigation_engine_example.py`
```
from lavague.drivers.selenium import SeleniumDriver
from lavague.core import ActionEngine

# Don't forget to export OPENAI_API_KEY

selenium_driver = SeleniumDriver("https://news.ycombinator.com")
action_engine = ActionEngine(selenium_driver)
action = action_engine.navigation_engine.get_action(
    "Enter hop inside the search bar and then press enter"
)
print(action)

```

### Core Architecture Module: `extension_chrome/src/app/util/theme.tsx`
```
import { theme as chakraTheme, extendBaseTheme } from '@chakra-ui/react';

const { Button, Input, Textarea, FormLabel, Tabs, Badge, List, Accordion, Checkbox, Select } = chakraTheme.components;

const theme = extendBaseTheme({
    components: {
        Button,
        Input,
        Textarea,
        FormLabel,
        Tabs,
        Badge,
        List,
        Accordion,
        Checkbox,
        Select,
    },
});

export default theme;

```

### Core Architecture Module: `lavague-core/lavague/core/__init__.py`
```
from lavague.core.python_engine import PythonEngine
from lavague.core.context import Context, get_default_context
from lavague.core.extractors import (
    PythonFromMarkdownExtractor,
    JsonFromMarkdownExtractor,
)
from lavague.core.retrievers import OpsmSplitRetriever
from lavague.core.world_model import WorldModel
from lavague.core.utilities.version_checker import check_latest_version
from lavague.core.action_engine import ActionEngine
from lavague.core.agents import WebAgent

import os
import warnings


def telemetry_warning():
    telemetry_var = os.getenv("LAVAGUE_TELEMETRY")
    if telemetry_var != "NONE":
        warning_message = "\033[93mTelemetry is turned on. To turn off telemetry, set your LAVAGUE_TELEMETRY to 'NONE'\033[0m"
        warnings.warn(warning_message, UserWarning)


telemetry_warning()
try:
    check_latest_version()
except:
    pass

```

### Core Architecture Module: `lavague-core/lavague/core/action_engine.py`
```
from __future__ import annotations
from typing import Dict, Optional
from llama_index.core import PromptTemplate
from llama_index.core.base.llms.base import BaseLLM
from llama_index.core.base.embeddings.base import BaseEmbedding
from lavague.core.extractors import BaseExtractor, DynamicExtractor
from lavague.core.retrievers import BaseHtmlRetriever, get_default_retriever
from lavague.core.base_driver import BaseDriver
from lavague.core.context import Context, get_default_context
from lavague.core.logger import AgentLogger
from lavague.core.base_engine import BaseEngine, ActionResult
from lavague.core.navigation import NAVIGATION_ENGINE_PROMPT_TEMPLATE
from lavague.core.navigation import NavigationControl, NavigationEngine
from lavague.core.python_engine import PythonEngine
from lavague.core.utilities.model_utils import get_model_name


class ActionEngine:
    """
    ActionEngine is a wrapper that instantiate every other engines (Navigation Engine, Python Engine, Navigation Control)

    Args:
        driver (`BaseDriver`):
            The Web driver used to interact with the headless browser
        python_engine (`BaseActionEngine`)
            Python Engine for generating code that doesn't interact with an html page.
        navigation_control (`BaseActionEngine`)
            Navigation Control
        llm (`BaseLLM`)
            llama-index LLM that will generate the action
        embedding (`BaseEmbedding`)
            llama-index Embedding model
        retriever (`BaseHtmlRetriever`)
            Specify which algorithm will be used for RAG
        prompt_template (`PromptTemplate`)
            Squelette of the final prompt
        extractor (`BaseExtractor`)
            Specify how to extract the final code from the llm answer
        time_between_actions (`float`)
            Time between each action
        logger: (`AgentLogger`)
            Logger to log the actions taken by the agent
    """

    def __init__(
        self,
        driver: BaseDriver,
        navigation_engine: BaseEngine = None,
        python_engine: BaseEngine = None,
        navigation_control: BaseEngine = None,
        llm: BaseLLM = None,
        embedding: BaseEmbedding = None,
        retriever: BaseHtmlRetriever = None,
        prompt_template: PromptTemplate = NAVIGATION_ENGINE_PROMPT_TEMPLATE.prompt_template,
        extractor: BaseExtractor = DynamicExtractor(),
        time_between_actions: float = 1.5,
        n_attempts: int = 5,
        logger: AgentLogger = None,
        extraction_llm: Optional[BaseLLM] = None,
    ):
        if llm is None:
            llm = get_default_context().llm

        if embedding is None:
            embedding = get_default_context().embedding

        if extraction_llm is None:
            extraction_llm = get_default_context().extraction_llm

        self.driver = driver

        if retriever is None:
            retriever = get_default_retriever(driver, embedding=embedding)

        if navigation_engine is None:
            navigation_engine = NavigationEngine(
                driver=driver,
                llm=llm,
                retriever=retriever,
                prompt_template=prompt_template,
                extractor=extractor,
                time_between_actions=time_between_actions,
                n_attempts=n_attempts,
                logger=logger,
                embedding=embedding,
            )
        if python_engine is None:
            python_engine = PythonEngine(driver, extraction_llm, embedding)
        if navigation_control is None:
            navigation_control = NavigationControl(
                driver,
                time_between_actions=time_between_actions,
                navigation_engine=navigation_engine,
            )
        self.navigation_engine = navigation_engine
        self.python_engine = python_engine
        self.navigation_control = navigation_control
        self.engines: Dict[str, BaseEngine] = {
            "Navigation Engine": self.navigation_engine,
            "Python Engine": self.python_engine,
            "Navigation Controls": self.navigation_control,
        }
        self.ret = None
        self.highlight = None
        self.curr_step = 0
        self.curr_instruction = ""
        self.world_model_output = ""
        self.screenshot_ratio = 1

    @classmethod
    def from_context(
        cls,
        context: Context,
        driver: BaseDriver,
        navigation_engine: BaseEngine = None,
        python_engine: BaseEngine = None,
        navigation_control: BaseEngine = None,
        retriever: BaseHtmlRetriever = None,
        prompt_template: PromptTemplate = NAVIGATION_ENGINE_PROMPT_TEMPLATE.prompt_template,
        extractor: BaseExtractor = DynamicExtractor(),
        time_between_actions: float = 1.5,
        n_attempts: int = 5,
        logger: AgentLogger = None,
    ) -> ActionEngine:
        """
        Create an ActionEngine from a context
        """
        return cls(
            driver,
            navigation_engine,
            python_engine,
            navigation_control,
            context.llm,
            context.embedding,
            retriever,
            prompt_template,
            extractor,
            time_between_actions,
            n_attempts,
            logger,
        )

    def set_gradio_mode_all(
        self,
        gradio_mode: bool,
        objective,
        url_input,
        image_display,
        history,
    ):
        self.navigation_engine.set_gradio_mode(
            gradio_mode,
            objective,
            url_input,
            image_display,
            history,
        )
        self.python_engine.set_gradio_mode(
            gradio_mode,
            objective,
            url_input,
            image_display,
            history,
        )
        self.navigation_control.set_gradio_mode(
            gradio_mode,
            objective,
            url_input,
            image_display,
            history,
        )

    def set_display_all(self, display: bool):
        self.navigation_engine.set_display(display)
        self.python_engine.set_display(display)
        self.navigation_control.set_display(display)

    def set_logger_all(self, logger: AgentLogger):
        self.navigation_engine.set_logger(logger)
        self.python_engine.set_logger(logger)
        self.navigation_control.set_logger(logger)

    def dispatch_instruction_gradio(self, next_engine_name: str, instruction: str):
        """
        Dispatch the instruction to the appropriate ActionEngine

        Args:
            next_engine_name (`str`): The name of the engine to call
            instruction (`str`): The instruction to perform

        Return:
            `bool`: True if the code was executed without error
            `Any`: The output of the code
        """

        from io import BytesIO
        from PIL import Image

        next_engine = self.engines[next_engine_name]

        if next_engine_name == "Navigation Engine":
            yield from next_engine.execute_instruction_gradio(instruction, self)
        else:
            ret = next_engine.execute_instruction(instruction)
            self.ret = ret
            self.navigation_engine.url_input = self.driver.get_url()
            img = self.driver.get_screenshot_as_png()
            img = BytesIO(img)
            img = Image.open(img)
            if self.screenshot_ratio != 1:
                img = img.resize(
                    (
                        int(img.width / self.screenshot_ratio),
                        int(img.height / self.screenshot_ratio),
                    )
                )
            self.image_display = img
            yield (
                self.navigation_engine.objective,
                self.navigation_engine.url_input,
                self.navigation_engine.image_display,
                self.navigation_engine.history,
                ret.output,
            )

    def dispatch_instruction(
        self, next_engine_name: str, instruction: str
    ) -> ActionResult:
        """
        Dispatch the instruction to the appropriate ActionEngine

        Args:
            next_engine_name (`str`): The name of the engine to call
            instruction (`str`): The instruction to perform

        Return:
            `bool`: True if the code was executed without error
            `Any`: The output of the code
        """

        next_engine = self.engines[next_engine_name]
        return next_engine.execute_instruction(instruction)

    def get_llm_name(self):
        return get_model_name(self.python_engine.llm)

    def get_embedding_name(self):
        return get_model_name(self.python_engine.embedding)

```

### Core Architecture Module: `lavague-core/lavague/core/action_template.py`
```
from llama_index.core import PromptTemplate
from lavague.core.extractors import BaseExtractor


class ActionTemplate:
    """
    Define a template, extractor pair
    """

    def __init__(self, prompt_template: str, extractor: BaseExtractor):
        self.prompt_template: PromptTemplate = PromptTemplate(prompt_template)
        self.extractor: BaseExtractor = extractor

```

### Core Architecture Module: `lavague-core/lavague/core/agents.py`
```
from io import BytesIO
import logging
import os
import shutil
from typing import Any, Optional

from lavague.core.action_engine import ActionEngine
from lavague.core.world_model import WorldModel
from lavague.core.utilities.format_utils import (
    extract_before_next_engine,
    extract_next_engine,
    extract_world_model_instruction,
    replace_hyphens,
)
from lavague.core.logger import AgentLogger, LocalDBLogger
from lavague.core.memory import ShortTermMemory
from lavague.core.base_driver import BaseDriver
from lavague.core.base_engine import ActionResult
from lavague.core.utilities.telemetry import send_telemetry
from PIL import Image
from IPython.display import display, HTML, Code
from lavague.core.token_counter import TokenCounter
from lavague.core.utilities.config import is_flag_true

from lavague.core.utilities.profiling import (
    ChartGenerator,
    time_profiler,
    start_new_step,
    clear_profiling_data,
)

logging_print = logging.getLogger(__name__)
logging_print.setLevel(logging.INFO)
format = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
ch = logging.StreamHandler()
ch.setLevel(logging.INFO)
ch.setFormatter(format)
logging_print.addHandler(ch)
logging_print.propagate = False


class WebAgent:
    """
    Web agent class, for now only works with selenium.
    """

    def __init__(
        self,
        world_model: WorldModel,
        action_engine: ActionEngine,
        token_counter: Optional[TokenCounter] = None,
        n_steps: int = 10,
        clean_screenshot_folder: bool = True,
        logger: AgentLogger = None,
    ):
        self.driver: BaseDriver = action_engine.driver
        self.action_engine: ActionEngine = action_engine
        self.world_model: WorldModel = world_model
        self.st_memory = ShortTermMemory()
        self.token_counter = token_counter
        self.interrupted = False

        self.n_steps = n_steps

        self.output = ""

        self.clean_screenshot_folder = clean_screenshot_folder

        if logger is None:
            self.logger: AgentLogger = AgentLogger()
        else:
            self.logger = logger

        self.action_engine.set_logger_all(self.logger)
        self.world_model.set_logger(self.logger)
        self.st_memory.set_logger(self.logger)

        if self.clean_screenshot_folder:
            try:
                if os.path.isdir("screenshots"):
                    shutil.rmtree("screenshots")
                logging_print.info("Screenshot folder cleared")
            except:
                pass

        self.result = ActionResult(
            instruction=None,
            code=self.driver.code_for_init(),
            success=False,
            output=None,
            total_estimated_tokens=0,
            total_estimated_cost=0.0,
        )

    def get(self, url):
        self.driver.get(url)
        self.driver.wait_for_idle()
        self.result.code += self.driver.code_for_get(url) + "\n"

    def demo(
        self,
        objective: str = "",
        user_data=None,
        screenshot_ratio: float = 1,
    ):
        try:
            from lavague.gradio import GradioAgentDemo

            grad = GradioAgentDemo(objective, None, self, user_data, screenshot_ratio)
            grad.launch()
        except ImportError:
            raise ImportError(
                "`lavague-gradio` package not found, "
                "please run `pip install lavague-gradio`"
            )

    def _finish_step(
        self,
        next_engine_name: str,
        history: any,
        success,
        curr_step: int,
        instruction: str,
        world_model_output: str,
    ):
        from gradio import ChatMessage

        if next_engine_name != "Navigation Engine":
            if success:
                history[-1] = ChatMessage(
                    role="assistant",
                    content=f"{world_model_output}",
                    metadata={"title": f"✅ Step {curr_step + 1} - {instruction}"},
                )
            else:
                history[-1] = ChatMessage(
                    role="assistant",
                    content=f"{world_model_output}",
                    metadata={"title": f"❌ Step {curr_step + 1} - {instruction}"},
                )
            history.append(
                ChatMessage(role="assistant", content="⏳ Thinking of next steps...")
            )
        else:
            history[-1] = ChatMessage(
                role="assistant", content=f"⏳ Thinking of next steps..."
            )
        return history

    def _add_step(
        self,
        instruction: str,
        next_engine_name: str,
        history: any,
        world_model_output: str,
        curr_step: int,
        curr_instruction: str,
    ):
        from gradio import ChatMessage

        if instruction.find("[NONE]") == -1 and next_engine_name != "COMPLETE":
            history[-1] = ChatMessage(
                role="assistant",
                content=f"{world_model_output}",
                metadata={"title": f"⏳ Step {curr_step + 1} - {curr_instruction}"},
            )
        return history

    def _check_result(self, history: any, output: str, success: bool, curr_step: int):
        from gradio import ChatMessage

        if output is not None:
            if len(output) > 0 and output.strip() != "[NONE]":
                history[-1] = ChatMessage(
                    role="assistant", content=output, metadata={"title": f"🌊 Output"}
                )
            elif len(output) == 0 or output.strip() == "[NONE]":
                if success:
                    history[-1] = ChatMessage(
                        role="assistant",
                        content=f"The objective was successfully executed after {curr_step} step(s).",
                        metadata={"title": f"🌊 Objective reached"},
                    )
                else:
                    history[-1] = ChatMessage(
                        role="assistant",
                        content=f"The objective was not successfully executed after {curr_step} step(s).",
                        metadata={"title": f"❌ Failed to reach objective"},
                    )
            else:
                if success:
                    history[-1] = ChatMessage(
                        role="assistant",
                        content=f"The objective was successfully executed after {curr_step} step(s).",
                        metadata={"title": f"🌊 Objective reached"},
                    )
                else:
                    history[-1] = ChatMessage(
                        role="assistant",
                        content=f"The objective was not successfully executed after {curr_step} step(s).",
                        metadata={"title": f"❌ Failed to reach objective"},
                    )

        return history

    def _run_demo(
        self,
        objective: str,
        user_data=None,
        display: bool = False,
        objective_obj: Any = None,
        url_input: Any = None,
        image_display: Any = None,
        history: Any = None,
        screenshot_ratio: float = 1,
    ):
        """Internal run method for the gradio demo. Do not use directly. Use run instead."""

        driver: BaseDriver = self.driver
        logger = self.logger
        n_steps = self.n_steps
        self.action_engine.set_display_all(display)
        output = None
        success = True

        try:
            if os.path.isdir("screenshots"):
                shutil.rmtree("screenshots")
            logging_print.info("Screenshot folder cleared")
        except:
            pass

        self.st_memory = ShortTermMemory()
        st_memory = self.st_memory
        world_model = self.world_model

        if user_data:
            st_memory.set_user_data(user_data)

        obs = driver.get_obs()

        logger.clear_logs()
        for curr_step in range(n_steps):
            current_state, past = st_memory.get_state()

            world_model_output = world_model.get_instruction(
                objective, current_state, past, obs
            )
            self.action_engine.world_model_output = replace_hyphens(
                extract_before_next_engine(world_model_output)
            )
            logging_print.info(world_model_output)
            next_engine_name = extract_next_engine(world_model_output)
            instruction = extract_world_model_instruction(world_model_output)

            self.action_engine.screenshot_ratio = screenshot_ratio
            image_display = self._get_screenshot(screenshot_ratio)

            self.action_engine.curr_step = curr_step + 1
            self.action_engine.curr_instruction = instruction

            history = self._add_step(
                instruction,
                next_engine_name,
                history,
                self.action_engine.world_model_output,
                curr_step,
                self.action_engine.curr_instruction,
            )
            yield (
                objective_obj,
                url_input,
                image_display,
                history,
                output,
            )

            if next_engine_name == "COMPLETE" or next_engine_name == "SUCCESS":
                output = instruction
                logging_print.info("Objective reached. Stopping...")

                logger.add_log(obs)
                logger.end_step()
                break

            yield from self.action_engine.dispatch_instruction_gradio(
                next_engine_name, instruction
            )

            success = self.action_engine.ret.success
            output = self.action_engine.ret.output

            st_memory.update_state(
                instruction,
                next_engine_name,
                success,
                output,
            )

            logger.add_log(obs)
            logger.end_step()

            obs = driver.get_obs()
            history = self._finish_step(
                next_engine_name,
           
```

### Core Architecture Module: `lavague-core/lavague/core/base_driver.py`
```
from PIL import Image
import os
from pathlib import Path
import re
from typing import Any, Callable, Optional, Mapping, Dict, Set, List, Tuple, Union
from abc import ABC, abstractmethod
from lavague.core.utilities.format_utils import (
    extract_code_from_funct,
    extract_imports_from_lines,
)
from enum import Enum
from datetime import datetime
import hashlib


class InteractionType(Enum):
    CLICK = "click"
    HOVER = "hover"
    SCROLL = "scroll"
    TYPE = "type"


PossibleInteractionsByXpath = Dict[str, Set[InteractionType]]

r_get_xpaths_from_html = r'xpath=["\'](.*?)["\']'


class BaseDriver(ABC):
    def __init__(self, url: Optional[str], init_function: Optional[Callable[[], Any]]):
        """Init the driver with the init funtion, and then go to the desired url"""
        self.init_function = (
            init_function if init_function is not None else self.default_init_code
        )
        self.driver = self.init_function()

        # Flag to check if the page has been previously scanned to avoid erasing screenshots from previous scan
        self.previously_scanned = False

        # extract import lines for later exec of generated code
        init_lines = extract_code_from_funct(self.init_function)
        self.import_lines = extract_imports_from_lines(init_lines)

        if url is not None:
            self.get(url)

    @abstractmethod
    def default_init_code(self) -> Any:
        """Init the driver, with the imports, since it will be pasted to the beginning of the output"""
        pass

    @abstractmethod
    def code_for_init(self) -> str:
        """Extract the code to past to the begining of the final script from the init code"""
        pass

    @abstractmethod
    def destroy(self) -> None:
        """Cleanly destroy the underlying driver"""
        pass

    @abstractmethod
    def get_driver(self) -> Any:
        """Return the expected variable name and the driver object"""
        pass

    @abstractmethod
    def resize_driver(driver, width, height):
        """
        Resize the driver to a targeted height and width.
        """

    @abstractmethod
    def get_url(self) -> Optional[str]:
        """Get the url of the current page"""
        pass

    @abstractmethod
    def get(self, url: str) -> None:
        """Navigate to the url"""
        pass

    @abstractmethod
    def code_for_get(self, url: str) -> str:
        """Return the code to navigate to the url"""
        pass

    @abstractmethod
    def back(self) -> None:
        """Navigate back"""
        pass

    @abstractmethod
    def maximize_window(self) -> None:
        pass

    @abstractmethod
    def code_for_back(self) -> None:
        """Return driver specific code for going back"""
        pass

    @abstractmethod
    def get_html(self, clean: bool = True) -> str:
        """
        Returns the HTML of the current page.
        If clean is True, We remove unnecessary tags and attributes from the HTML.
        Clean HTMLs are easier to process for the LLM.
        """
        pass

    def get_tabs(self) -> str:
        """Return description of the tabs opened with the current tab being focused.

        Example of output:
        Tabs opened:
        0 - Overview - OpenAI API
        1 - [CURRENT] Nos destinations Train - SNCF Connect
        """
        return "Tabs opened:\n 0 - [CURRENT] tab"

    def switch_tab(self, tab_id: int) -> None:
        """Switch to the tab with the given id"""
        pass

    def switch_frame(self, xpath) -> None:
        """
        switch to the frame pointed at by the xpath
        """
        raise NotImplementedError()

    def switch_default_frame(self) -> None:
        """
        Switch back to the default frame
        """
        raise NotImplementedError()

    def switch_parent_frame(self) -> None:
        """
        Switch back to the parent frame
        """
        raise NotImplementedError()

    def resolve_xpath(self, xpath):
        """
        Return the element for the corresponding xpath, the underlying driver may switch iframe if necessary
        """
        pass

    def save_screenshot(self, current_screenshot_folder: Path) -> str:
        """Save the screenshot data to a file and return the path. If the screenshot already exists, return the path. If not save it to the folder."""

        new_screenshot = self.get_screenshot_as_png()
        hasher = hashlib.md5()
        hasher.update(new_screenshot)
        new_hash = hasher.hexdigest()
        new_screenshot_name = f"{new_hash}.png"
        new_screenshot_full_path = current_screenshot_folder / new_screenshot_name

        # If the screenshot does not exist, save it
        if not new_screenshot_full_path.exists():
            with open(new_screenshot_full_path, "wb") as f:
                f.write(new_screenshot)
        return str(new_screenshot_full_path)

    def is_bottom_of_page(self) -> bool:
        return self.execute_script(
            "return (window.innerHeight + window.scrollY + 1) >= document.body.scrollHeight;"
        )

    def get_screenshots_whole_page(self, max_screenshots=30) -> list[str]:
        """Take screenshots of the whole page"""
        screenshot_paths = []

        current_screenshot_folder = self.get_current_screenshot_folder()

        for i in range(max_screenshots):
            # Saves a screenshot
            screenshot_path = self.save_screenshot(current_screenshot_folder)
            screenshot_paths.append(screenshot_path)
            self.scroll_down()
            self.wait_for_idle()

            if self.is_bottom_of_page():
                break

        self.previously_scanned = True
        return screenshot_paths

    @abstractmethod
    def get_possible_interactions(
        self, in_viewport=True, foreground_only=True
    ) -> PossibleInteractionsByXpath:
        """Get elements that can be interacted with as a dictionary mapped by xpath"""
        pass

    def check_visibility(self, xpath: str) -> bool:
        pass

    @abstractmethod
    def get_highlighted_element(self, generated_code: str):
        """Return the page elements that generated code interact with"""
        pass

    @abstractmethod
    def exec_code(
        self,
        code: str,
        globals: dict[str, Any] = None,
        locals: Mapping[str, object] = None,
    ):
        """Exec generated code"""
        pass

    @abstractmethod
    def execute_script(self, js_code: str) -> Any:
        """Exec js script in DOM"""
        pass

    @abstractmethod
    def scroll_up(self):
        pass

    @abstractmethod
    def scroll_down(self):
        pass

    @abstractmethod
    def code_for_execute_script(self, js_code: str):
        """return driver specific code to execute js script in DOM"""
        pass

    @abstractmethod
    def get_capability(self) -> str:
        """Prompt to explain the llm which style of code he should output and which variables and imports he should expect"""
        pass

    def get_obs(self) -> dict:
        """Get the current observation of the driver"""
        current_screenshot_folder = self.get_current_screenshot_folder()

        if not self.previously_scanned:
            # If the last operation was not to scan the whole page, we clear the screenshot folder
            try:
                if os.path.isdir(current_screenshot_folder):
                    for filename in os.listdir(current_screenshot_folder):
                        file_path = os.path.join(current_screenshot_folder, filename)
                        try:
                            # Check if it's a file and then delete it
                            if os.path.isfile(file_path) or os.path.islink(file_path):
                                os.remove(file_path)
                        except Exception as e:
                            print(f"Failed to delete {file_path}. Reason: {e}")

            except Exception as e:
                raise Exception(f"Error while clearing screenshot folder: {e}")
        else:
            # If the last operation was to scan the whole page, we reset the flag
            self.previously_scanned = False

        # We take a screenshot and computes its hash to see if it already exists
        self.save_screenshot(current_screenshot_folder)

        url = self.get_url()
        html = self.get_html()
        obs = {
            "html": html,
            "screenshots_path": str(current_screenshot_folder),
            "url": url,
            "date": datetime.now().isoformat(),
            "tab_info": self.get_tabs(),
        }

        return obs

    def wait(self, duration):
        import time

        time.sleep(duration)

    def wait_for_idle(self):
        pass

    def get_current_screenshot_folder(self) -> Path:
        url = self.get_url()

        if url is None:
            url = "blank"

        screenshots_path = Path("./screenshots")
        screenshots_path.mkdir(exist_ok=True)

        current_url = url.replace("://", "_").replace("/", "_")
        hasher = hashlib.md5()
        hasher.update(current_url.encode("utf-8"))

        current_screenshot_folder = screenshots_path / hasher.hexdigest()
        current_screenshot_folder.mkdir(exist_ok=True)
        return current_screenshot_folder

    @abstractmethod
    def get_screenshot_as_png(self) -> bytes:
        pass

    def get_nodes(self, xpaths: List[str]) -> List["DOMNode"]:
        raise NotImplementedError("get_nodes not implemented")

    def get_nodes_from_html(self, html: str) -> List["DOMNode"]:
        return self.get_nodes(re.findall(r_get_xpaths_from_html, html))

    def highlight_node_from_xpath(
        self, xpath: str, color: str = "red", label=False
    ) -> Callable:
        return self.highlight_nodes([xpath], color, label)

    def highlight_nodes(
        self, xpaths: List[str], color: str = "red", label=False
    ) -> Callable:
        nodes = self.get_nodes(xpaths)
        for n in nodes:
            n.highlight(color)
        return self.
```

### Core Architecture Module: `lavague-core/lavague/core/base_engine.py`
```
from abc import ABC, abstractmethod
from typing import Any, Optional
from lavague.core.display import Display
from lavague.core.logger import Loggable
from dataclasses import dataclass


@dataclass
class ActionResult:
    """Represent the result of executing an instruction"""

    instruction: str
    code: str
    success: bool
    output: Any
    total_estimated_tokens: Optional[int] = 0
    total_estimated_cost: Optional[float] = 0


class BaseEngine(ABC, Loggable, Display):
    @abstractmethod
    def execute_instruction(self, instruction: str) -> ActionResult:
        pass

```

### Core Architecture Module: `lavague-core/lavague/core/context.py`
```
from llama_index.core.llms import LLM
from llama_index.core.multi_modal_llms import MultiModalLLM
from llama_index.core.embeddings import BaseEmbedding
from typing import Optional

DEFAULT_MAX_TOKENS = 512
DEFAULT_TEMPERATURE = 0.0


class Context:
    """Set the context which will be used thourough the action generation pipeline."""

    def __init__(
        self,
        llm: LLM,
        mm_llm: MultiModalLLM,
        embedding: BaseEmbedding,
        extraction_llm: Optional[LLM] = None,
    ):
        """
        llm (`LLM`):
            The llm that will be used the generate the python code
        mm_llm (`MultiModalLLM`):
            The multimodal llm that will be used by the world model
        embedding: (`BaseEmbedding`)
            The embedder used by the python engine
        """
        self.llm = llm
        self.mm_llm = mm_llm
        self.embedding = embedding
        self.extraction_llm = extraction_llm or llm


def get_default_context() -> Context:
    try:
        from lavague.contexts.openai import OpenaiContext

        return OpenaiContext()
    except ImportError:
        raise ImportError(
            "`lavague-contexts-openai` package not found, "
            "please run `pip install lavague-contexts-openai`"
        )

```

### Core Architecture Module: `lavague-core/lavague/core/display.py`
```
from typing import Any


class Display:
    display: bool = False
    gradio_mode: bool = False
    image_display: Any = None
    objective: Any = None
    url_input: Any = None
    history: Any = None

    def set_display(self, display: bool):
        self.display = display

    def set_gradio_mode(
        self,
        gradio_mode: bool,
        objective,
        url_input,
        image_display,
        history,
    ):
        self.gradio_mode = gradio_mode
        self.image_display = image_display
        self.objective = objective
        self.url_input = url_input
        self.history = history

```

### Core Architecture Module: `lavague-core/lavague/core/evaluator.py`
```
from abc import ABC, abstractmethod
import pandas as pd
from typing import Dict
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.figure import Figure
from lavague.core.retrievers import BaseHtmlRetriever
from lavague.core.navigation import NavigationEngine
from lavague.drivers.selenium import SeleniumDriver
from tqdm import tqdm
from datetime import datetime
import yaml
from llama_index.core import QueryBundle
import traceback
import ast
from bs4 import BeautifulSoup
from tempfile import NamedTemporaryFile
import time


class Evaluator(ABC):
    @abstractmethod
    def evaluate(self) -> pd.DataFrame:
        pass

    def compare(
        self,
        results: Dict[str, pd.DataFrame],
        metrics: list,
    ) -> Figure:
        fig, axes = plt.subplots(1, len(metrics), figsize=(5 * len(metrics), 5))

        df = pd.DataFrame()
        for metric in metrics:
            if metric in metrics:
                df[metric] = [dfr[metric].mean() for dfr in results.values()]
        df["name"] = list(results.keys())

        count = 0
        for metric in metrics:
            if metric in metrics:
                plot = sns.barplot(data=df, x="name", y=metric, ax=axes[count])
                count += 1
                if metric == "time":
                    plot.set(xlabel="", ylabel="time (secs)")
                else:
                    plot.set(xlabel="")
        return fig


def parse_yaml(action):
    try:
        return yaml.safe_load(action)[0]["actions"][0]["action"]
    except:
        return None


def parse_viewport_size(vsize):
    vsize = ast.literal_eval(vsize)
    if type(vsize["width"]) is dict:
        return {
            "width": vsize["width"]["value"],
            "height": vsize["height"]["value"],
        }  # sometime viewport size is logged like this. idkw
    return vsize


def validate_action(action):
    try:
        _ = action["args"]["xpath"]
        _ = action["name"]
        return action["name"] != "fail"
    except:
        return False


def normalize_xpath(xpath: str):
    return xpath.replace("[1]", "")


def load_website_in_driver(driver, html, viewport_size, action):
    with NamedTemporaryFile(delete=False, mode="w", suffix=".html") as f:
        f.write(html)
    if viewport_size:
        driver.resize_driver(viewport_size["width"], viewport_size["height"])
    driver.get(f"file:{f.name}")
    driver.wait_for_idle()
    element = driver.resolve_xpath(action["args"]["xpath"])
    driver.execute_script(
        "arguments[0].scrollIntoView({block: 'center', behavior: 'instant'});", element
    )


FAIL_ACTION = {"args": {"xpath": "(string)"}, "name": "fail"}


class RetrieverEvaluator(Evaluator):
    def evaluate(
        self,
        retriever: BaseHtmlRetriever,
        dataset: pd.DataFrame,
        driver: SeleniumDriver = None,  # Optional, the driver passed to the retriever
        retriever_name: str = "",
        wait_for_scroll: int = 1,
    ) -> pd.DataFrame:
        result_filename = (
            (retriever_name if retriever_name else type(retriever).__name__)
            + "_evaluation_"
            + datetime.now().strftime("%Y-%m-%d_%H-%M")
            + ".csv"
        )
        results = dataset.loc[dataset["validated"]].copy()
        results.insert(len(results.columns), "result_nodes", None)
        results.insert(len(results.columns), "recall", None)
        results.insert(len(results.columns), "output_size", None)
        results.insert(len(results.columns), "time", None)
        results["dataset_index"] = results.index
        results.to_csv(result_filename, index=False)

        try:
            for i, row in tqdm(results.iterrows()):
                action = yaml.safe_load(row["action"])
                instruction = row["instruction"]
                try:
                    if driver:
                        driver.__init__()
                        viewport_size = parse_viewport_size(row["viewport_size"])
                        load_website_in_driver(
                            driver, row["html"], viewport_size, action
                        )
                        time.sleep(wait_for_scroll)
                    t_begin = datetime.now()
                    nodes = retriever.retrieve(
                        QueryBundle(query_str=instruction), [driver.get_html()]
                    )
                    t_end = datetime.now()
                except:
                    print("ERROR: ", i)
                    traceback.print_exc()
                    nodes = []
                if driver:
                    driver.destroy()
                nodes = "\n".join(nodes)
                results.at[i, "result_nodes"] = nodes
                results.at[i, "recall"] = (
                    1 if normalize_xpath(action["args"]["xpath"]) in nodes else 0
                )
                results.at[i, "output_size"] = len(nodes)
                results.at[i, "time"] = pd.Timedelta(t_end - t_begin).total_seconds()
            print("Evaluation terminated successfully.")
        except:
            traceback.print_exc()
            print(f"Evaluation stopped at row {i} because an exception was caught.")
        finally:
            results.to_csv(result_filename, index=False)
            print(f"Results are saved to {result_filename}")
            return results

    def compare(
        self,
        results: Dict[str, pd.DataFrame],
        metrics: list = ["recall", "output_size", "time"],
    ) -> Figure:
        return super().compare(results, metrics)


class NavigationEngineEvaluator(Evaluator):
    def evaluate(
        self,
        navigation_engine: NavigationEngine,
        dataset: pd.DataFrame,
        navigation_engine_name="",
    ) -> pd.DataFrame:
        result_filename = (
            (
                navigation_engine_name
                if navigation_engine_name
                else type(navigation_engine).__name__
            )
            + "_evaluation_"
            + datetime.now().strftime("%Y-%m-%d_%H-%M")
            + ".csv"
        )
        results = dataset.loc[dataset["validated"]].copy()
        results.insert(len(results.columns), "recall", None)
        results.insert(len(results.columns), "correct_action", None)
        results.insert(len(results.columns), "correct_xpath", None)
        results.insert(len(results.columns), "time", None)
        results["dataset_index"] = results.index
        results.to_csv(result_filename, index=False)

        try:
            for i, row in tqdm(results.iterrows()):
                action = yaml.safe_load(row["action"])
                viewport_size = parse_viewport_size(row["viewport_size"])
                instruction = row["instruction"]
                try:
                    load_website_in_driver(
                        navigation_engine.driver, row["html"], viewport_size, action
                    )
                    t_begin = datetime.now()
                    test_action = navigation_engine.execute_instruction(
                        instruction
                    ).code
                    test_action = parse_yaml(test_action)
                    if not validate_action(test_action):
                        test_action = FAIL_ACTION
                    t_end = datetime.now()
                except:
                    print("ERROR: ", i)
                    traceback.print_exc()
                    test_action = FAIL_ACTION
                results.at[i, "correct_action"] = action["name"] == test_action["name"]
                results.at[i, "correct_xpath"] = (
                    normalize_xpath(action["args"]["xpath"])
                    == test_action["args"]["xpath"]
                )
                results.at[i, "recall"] = (
                    results.at[i, "correct_action"] and results.at[i, "correct_xpath"]
                )
                results.at[i, "time"] = pd.Timedelta(t_end - t_begin).total_seconds()
            print("Evaluation terminated successfully.")
        except:
            traceback.print_exc()
            print(f"Evaluation stopped at row {i} because an exception was caught.")
        finally:
            results.to_csv(result_filename, index=False)
            print(f"Results are saved to {result_filename}")
            return results

    def compare(
        self,
        results: Dict[str, pd.DataFrame],
        metrics: list = ["recall", "correct_action", "correct_xpath", "time"],
    ) -> Figure:
        return super().compare(results, metrics)

```

### Core Architecture Module: `lavague-core/lavague/core/exceptions.py`
```
class NavigationException(Exception):
    pass


class CannotBackException(NavigationException):
    def __init__(self, message="History root reached, cannot go back"):
        super().__init__(message)


class RetrievalException(NavigationException):
    pass


class NoElementException(RetrievalException):
    def __init__(self, message="No element found"):
        super().__init__(message)


class AmbiguousException(RetrievalException):
    def __init__(self, message="Multiple elements could match"):
        super().__init__(message)


class HallucinatedException(RetrievalException):
    def __init__(self, xpath: str, message: str = None):
        super().__init__(message or f"Element was hallucinated: {xpath}")


class ElementOutOfContextException(RetrievalException):
    def __init__(self, xpath: str, message: str = None):
        super().__init__(message or f"Element exists but was not in context: {xpath}")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #588** (2024-08-27): **Handle where max tokens exceeded in Python Engine / Python Engine with default OpenAI LLM**
  *Symptoms*: If we extract a large text section with an LLM which doesn't have a big enough max tokens - it results in a un-extractable JSON object in response. We should find the best way to handle this so we can still get a confidence score and also get as much of the text as possible - while avoiding an extraction error:  https://github.com/lavague-ai/LaVague/actions/runs/10564929524/job/29268391288  I tested the Python Engine with Gemini: https://github.com/lavague-ai/LaVague/blob/main/examples/notebooks/lavague-tests-comaprison.ipynb - but we need to make sure it is robust with the OpenAI default LLM.    

- **Issue #575** (2024-08-19): **Agent should not destroy the driver upon run completion**
  *Symptoms*: Therefore this line should be removed:  https://github.com/lavague-ai/LaVague/blob/7d6a3d37ac8ed639410780c21e64872048fd84f9/lavague-core/lavague/core/agents.py#L523C13-L523C34  It might impact `BrowserbaseRemoteConnection` ; make sure when using it that driver is properly destroyed afterwards.

- **Issue #530** (2024-08-02): **Prevent BACK command if it would lead to blank page**
  *Symptoms*: We should raise an error if BACK command would lead to blank page.  Make sure an observation is made so the World Model is aware he cannot go back anymore.

- **Issue #473** (2024-08-01): **"BACK" navigation control instruction used on first step leading to crash**
  *Symptoms*: I had a dumb bug where the World Model couldn't find the information it wanted so it tried to go back straight away which caused LaVague to crash - I think because it was the first step so it couldn't go back.   Maybe we can add a protection so it won't crash if the back fails but continues
  **Post-Mortem & Fix Analysis**:
  > I had another crash related to the BACK command today in a different context @adeprez - haven't had time to debug yet.  ``` Next engine: Navigation Controls Instruction: BACK 2024-07-25 15:39:33,846 - ERROR - Error while running the agent: Message: unknown error: unhandled inspector error: {"code":-32000,"message":"Unable to capture screenshot"}   (Session info: chrome=122.0.6261.94) Stacktrace: #0 0x562411353f33 <unknown> #1 0x56241104bce6 <unknown> #2 0x562411033532 <unknown> #3 0x562411031863 <unknown> #4 0x562411031f1f <unknown> #5 0x562411057cfc <unknown> #6 0x5624110e5092 <unknown> #7 0x5624110b8eb2 <unknown> #8 0x5624110d7899 <unknown> #9 0x5624110b8c53 <unknown> #10 0x562411089db3 <unknown> #11 0x56241108a77e <unknown> #12 0x56241131986b <unknown> #13 0x56241131d885 <unknown> #14 0x562411307181 <unknown> #15 0x56241131e412 <unknown> #16 0x5624112eb25f <unknown> #17 0x562411342528 <unknown> #18 0x562411342723 <unknown> #19 0x5624113530e4 <unknown> #20
  > This is also a common error I & another user have seen with BACK the past few days @adeprez   ``` Next engine: Navigation Controls Instruction: BACK 2024-07-30 09:46:20,493 - ERROR - Error while running the agent: 'NoneType' object has no attribute 'replace' ```
  > I think this last error happens when we go BACK but we never navigated to another page, we then call `get_obs` which calls `get_current_screenshot` which will run:   ```python current_url = url.replace("://", "_").replace("/", "_")                   ^^^^^^^^^^^ AttributeError: 'NoneType' object has no attribute 'replace' ```  We can see this error if we do: ```python # Dispatch an instruction to the Navigation Engine engine_name = "Navigation Controls" instruction = "BACK"  # Execute the instruction and get the output if applicable output = action_engine.dispatch_instruction(engine_name, instruction) selenium_driver.get_current_screenshot_folder() ```  I think we may be able to remove this error by performing some kind of check before running BACK where we say if going back leads to a null URL, we don't do it. @adeprez 

- **Issue #465** (2024-07-29): **TokenCounter only supports OpenAI models**
  *Symptoms*: ### Context  - To listen to API calls and count tokens we use `TokenCountingHandler` from `llama-index` - `TokenCountingHandler` class requires a `tokenizer`.  - We currently use `tiktoken` as our only tokenizer.  - `tiktoken` only supports OpenAI models.   ### Impact - All token counting and cost estimation is currently limited to OpenAI models supported by both `tiktoken` and `llama-index`  ### Notes - There seem to be no general purpose tokenizers out there.  - There is `vertexai.preview.tokenization` for Gemini  ### Potential solutions - Let user define the `tokenizer`     - Only the following models are supported `Supported models: gemini-1.0-pro-001, gemini-1.0-pro-002, gemini-1.5-pro-001, gemini-1.5-flash-001.` 
  **Post-Mortem & Fix Analysis**:
  > Few issues here:  1. instantiating two llamaindex `TokenCountingHandler` to count calls from different models doesn't seem to function. Only one of those catches events.  2. In the case of passing a tokenizer from the `vertexai.preview` lib, we get this error inside llamaindex's token counting module: `TypeError: 'Tokenizer' object is not callable`  So it seems that our current approach using llama-index counter has a lot of limitations.   For 1, the whole point of creating several `TokenCountingHandler` was to pass an appropriate tokenizer to each. However since Google's tokenizer doesn't seem to work with llamaindex's token counting, we could:  - keep the current implementation of LaVague's `TokenCounter` (only one registers all LLM calls) - pass a default tokenizer all the time (`cl100k_base` ?) - compute pricing based on the llm/mm_llm  @adeprez @dhuynh95 what do you think ? 
  > Here's some tokenizer comparison:  ``` prompt: 14517 -------------------- gpt: 4522 cl100k: 4680 o200k: 4522 p50k: 5925 r50k: 6082 gpt2: 6082 -> gemini flash: 5201 -> gemini pro 1.5: 5201 ```  Since we can't support the real gemini tokenizer, what do you think about using `gpt` tokenizer and adding 15% to Gemini cost calculation ?    Code to run the comparison:   ```python from lavague.drivers.selenium.base import SELENIUM_PROMPT_TEMPLATE import tiktoken from vertexai.preview import tokenization  enc_gpt_4o = tiktoken.encoding_for_model("gpt-4o") enc_cl100k = tiktoken.get_encoding("cl100k_base")  enc_o200k = tiktoken.get_encoding("o200k_base") enc_p50k = tiktoken.get_encoding("p50k_base") enc_r50k = tiktoken.get_encoding("r50k_base") enc_gpt2 = tiktoken.get_encoding("gpt2") enc_gemini_flash = tokenization.get_tokenizer_for_model("gemini-1.5-flash-001") # gemini tokenizer from vertex api enc_gemini_pro = tokenization.get_tokenizer_for_model("gemini-1.5-pro
  > Temporary fix by PR: #467  - we'll use a default tokenizer and approximate Gemini tokens with a multiplier defined in the pricing config. 

- **Issue #444** (2024-07-22): **TokenCountingHandler records WorldModel prompt twice leading to wrong cost evaluations**
  *Symptoms*: When bumping `llama-index` to `0.10.55`, we fix the issue of not counting the WorldModel prompt (#442)  However, it now counts it twice. Notice the different call stacks, different ids but exact same content  ### First time ![image](https://github.com/user-attachments/assets/30262f49-1c73-481b-aefb-3d171414e33d)   ### Second time ![image](https://github.com/user-attachments/assets/a9e827b2-b827-4ead-b53d-adc1a4a77e06)   ## To reproduce:   1. Bump version of llama-index to 0.10.55 2. Create a debug config (launch.json in vscode). Set `"justMyCode"` to  `false` to be able to trigger breakpoints in llama-index code ```json {     "version": "0.2.0",     "configurations": [         {             "name": "Python Debugger: Current File",             "type": "debugpy",             "request": "launch",             "program": "${file}",             "console": "integratedTerminal",             "justMyCode": false         }     ] } ``` 3. Put breakpoints in `llama_index/core/callbacks/token_counting.py` at line 157 to see Events that are about to be recorded by the `TokenCountingHandler` 4. Create a Python file containing a token counter, make sure to initialize the token counter as the very first step in your code.  ```python tk_counter = init_token_counter() # ... more init code ... agent = WebAgent(world_model, action_engine, token_counter=tk_counter) ``` 5. Launch this file in Debug in VsCode 
  **Post-Mortem & Fix Analysis**:
  > We could:  - investigate further to understand why two events are triggered for a single call - let this run normally and deduplicate this WorldModel prompt counter twice before we save them to logs
  > Temporary fix #446: removes elements counted twice

- **Issue #442** (2024-07-17): **WorldModel is not counted by the token counter**
  *Symptoms*: It seems that the WorldModel prompt does not get recorded by the `TokenCountingHandler`.   After review with @adeprez, we think it's because multimodal models are not supported as part of the current implementation of this module by LlamaIndex.   Will investigate further. 
  **Post-Mortem & Fix Analysis**:
  > Can be fixed by a version bump of `llama-index` to `0.10.55`. Will let @JoFrost or @adeprez handle this ^^  Warning: bumping the version fixes this issue but now the `TokenCountingHandler` counts the tokens twice 🫠

- **Issue #390** (2024-07-17): **LaVague fails to compute the correct XPath**
  *Symptoms*: Identitied on : https://colab.research.google.com/drive/1zjO_VVw5NnrzzNPaodPPWvWn8tuAkBb7#scrollTo=IgXVnJ5MWab5  When you log in Tableau, a Welcome modal appears. It usually should be dismissed, but LaVague fails to click the "Continue button" because the XPath retrieved is invalid.  - XPath found : /html/body/div/div/form/div[6]/div[2]/div[1]/input (no element matches) - Expected XPath : /html/body/div[4]/div/div/div[4]/div[2]/div/button

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

### Incident Patch 1: `6d0b97e4` (2024-09-07)
**Commit Message**: fix: viewport interactive elements retrieval (#601)

**File**: `lavague-core/lavague/core/base_driver.py` (modified, +7/-7)
```diff
@@ -482,8 +482,8 @@ def js_wrap_function_call(fn: str):
 const windowHeight = (window.innerHeight || document.documentElement.clientHeight);
 const windowWidth = (window.innerWidth || document.documentElement.clientWidth);
 
-return (function() {
-    function getInteractions(e, in_viewport, foreground_only) {
+return (function(inViewport, foregroundOnly) {
+    function getInteractions(e) {
         const tag = e.tagName.toLowerCase();
         if (!e.checkVisibility() || e.hasAttribute('disabled') || e.hasAttribute('readonly')
           || (tag === 'input' && e.getAttribute('type') === 'hidden') || tag === 'body') {
@@ -524,7 +524,7 @@ def js_wrap_function_call(fn: str):
             //evts.push('SCROLL');
         }
 
-        if (in_viewport == true) {
+        if (inViewport) {
             const rect = e.getBoundingClientRect();
             let iframe = e.ownerDocument.defaultView.frameElement;
             while (iframe) {
@@ -543,10 +543,10 @@ def js_wrap_function_call(fn: str):
             if (elemCenter.x > windowWidth) return [];
             if (elemCenter.y < 0) return [];
             if (elemCenter.y > windowHeight) return [];
-            if (foreground_only !== true) return evts; // whenever to check for elements above
+            if (!foregroundOnly) return evts; // whenever to check for elements above
             let pointContainer = document.elementFromPoint(elemCenter.x, elemCenter.y);
             do {
-                if (pointContainer === element) return evts;
+                if (pointContainer === e) return evts;
                 if (pointContainer == null) return evts;
             } while (pointContainer = pointContainer.parentNode);
             return [];
@@ -558,7 +558,7 @@ def js_wrap_function_call(fn: str):
     const results = {};
     function traverse(node, xpath) {
         if (node.nodeType === Node.ELEMENT_NODE) {
-            const interactions = getInteractions(node, arguments?.[0], arguments?.[1]);
+            const interactions = getInteractions(node);
             if (interactions.length > 0) {
                 results[xpath] = interactions;
             }
@@ -589,7 +589,7 @@ def js_wrap_function_call(fn: str):
     }
     traverse(document.body, '/html/body');
     return results;
-})();
+})(arguments?.[0], arguments?.[1]);
 """
 
 JS_WAIT_DOM_IDLE = """
```

---

### Incident Patch 2: `69200e34` (2024-09-06)
**Commit Message**: fix CI workflow

**File**: `.github/workflows/publish.yaml` (modified, +2/-3)
```diff
@@ -60,9 +60,8 @@ jobs:
                 # Sleep to allow some time for pypi package to upload
                 echo "Waiting for version to update..."
                 sleep 60
-                
-                echo "Package updated!"
-                fi
+                              
+                echo "Package updated"
 
                 # Return to the root of the repository
                 cd - > /dev/null
```

---

### Incident Patch 3: `052c3638` (2024-09-06)
**Commit Message**: fix profiling bug

**File**: `lavague-core/lavague/core/utilities/profiling.py` (modified, +2/-0)
```diff
@@ -61,6 +61,8 @@ def time_profiler(
         if full_step_profiling:
             agent_steps.append(record)
         else:
+            if len(agent_events) == 0:
+                start_new_step()
             agent_events[-1].append(record)
 
 
```

---

### Incident Patch 4: `4e70c2c8` (2024-09-03)
**Commit Message**: iframe testing & fix (#593)

* fix: broken iframe exploration

* chore: ruff

* fix: prevent test errors

---------

Co-authored-by: Alexis Deprez <[REDACTED_EMAIL]>

**File**: `lavague-core/lavague/core/base_driver.py` (modified, +34/-40)
```diff
@@ -479,8 +479,11 @@ def js_wrap_function_call(fn: str):
 })();"""
 
 JS_GET_INTERACTIVES = """
+const windowHeight = (window.innerHeight || document.documentElement.clientHeight);
+const windowWidth = (window.innerWidth || document.documentElement.clientWidth);
+
 return (function() {
-    function getInteractions(e) {
+    function getInteractions(e, in_viewport, foreground_only) {
         const tag = e.tagName.toLowerCase();
         if (!e.checkVisibility() || e.hasAttribute('disabled') || e.hasAttribute('readonly')
           || (tag === 'input' && e.getAttribute('type') === 'hidden') || tag === 'body') {
@@ -520,13 +523,42 @@ def js_wrap_function_call(fn: str):
         if (hasEvent('scroll') || hasEvent('wheel')|| e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth) {
             //evts.push('SCROLL');
         }
+
+        if (in_viewport == true) {
+            const rect = e.getBoundingClientRect();
+            let iframe = e.ownerDocument.defaultView.frameElement;
+            while (iframe) {
+                const iframeRect = iframe.getBoundingClientRect();
+                rect.top += iframeRect.top;
+                rect.left += iframeRect.left;
+                rect.bottom += iframeRect.top;
+                rect.right += iframeRect.left;
+                iframe = iframe.ownerDocument.defaultView.frameElement;
+            }
+            const elemCenter = {
+                x: rect.left + rect.width / 2,
+                y: rect.top + rect.height / 2
+            };
+            if (elemCenter.x < 0) return [];
+            if (elemCenter.x > windowWidth) return [];
+            if (elemCenter.y < 0) return [];
+            if (elemCenter.y > windowHeight) return [];
+            if (foreground_only !== true) return evts; // whenever to check for elements above
+            let pointContainer = document.elementFromPoint(elemCenter.x, elemCenter.y);
+            do {
+                if (pointContainer === element) return evts;
+                if (pointContainer == null) return evts;
+            } while (pointContainer = pointContainer.parentNode);
+            return [];
+        }
+
         return evts;
     }
 
     const results = {};
     function traverse(node, xpath) {
         if (node.nodeType === Node.ELEMENT_NODE) {
-            const interactions = getInteractions(node);
+            const interactions = getInteractions(node, arguments?.[0], arguments?.[1]);
             if (interactions.length > 0) {
                 results[xpath] = interactions;
             }
@@ -560,44 +592,6 @@ def js_wrap_function_call(fn: str):
 })();
 """
 
-JS_GET_INTERACTIVES_IN_VIEWPORT = (
-    """
-const windowHeight = (window.innerHeight || document.documentElement.clientHeight);
-const windowWidth = (window.innerWidth || document.documentElement.clientWidth);
-return Object.fromEntries(Object.entries("""
-    + js_wrap_function_call(JS_GET_INTERACTIVES)
-    + """).filter(([xpath, evts]) => {
-    const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
-    if (!element) return false;
-    const rect = element.getBoundingClientRect();
-    let iframe = element.ownerDocument.defaultView.frameElement;
-    while (iframe) {
-        const iframeRect = iframe.getBoundingClientRect();
-        rect.top += iframeRect.top;
-        rect.left += iframeRect.left;
-        rect.bottom += iframeRect.top;
-        rect.right += iframeRect.left;
-        iframe = iframe.ownerDocument.defaultView.frameElement;
-    }
-    const elemCenter = {
-        x: rect.left + rect.width / 2,
-        y: rect.top + rect.height / 2
-    };
-    if (elemCenter.x < 0) return false;
-    if (elemCenter.x > windowWidth) return false;
-    if (elemCenter.y < 0) return false;
-    if (elemCenter.y > windowHeight) return false;
-    if (arguments?.[0] !== true) return true; // whenever to check for elements above
-    let pointContainer = document.elementFromPoint(elemCenter.x, elemCenter.y);
-    do {
-        if (pointContainer === element) return true;
-        if (pointContainer == null) return true;
-    } while (pointContainer = pointContainer.parentNode);
-    return false;
-}));
-"""
-)
-
 JS_WAIT_DOM_IDLE = """
 return new Promise(resolve => {
     const timeout = arguments[0] || 10000;
```

**File**: `lavague-core/lavague/core/retrievers.py` (modified, +2/-1)
```diff
@@ -192,7 +192,8 @@ def get_html_with_xpath(
                 filter_by_possible_interactions,
                 xpath_prefix + frame_xpath,
             )
-            iframe_tag.replace_with(frame_soup_str)
+            frame_soup = BeautifulSoup(frame_soup_str, "html.parser")
+            iframe_tag.replace_with(frame_soup)
             self.driver.switch_parent_frame()
         return str(soup)
 
```

**File**: `lavague-integrations/drivers/lavague-drivers-playwright/lavague/drivers/playwright/base.py` (modified, +2/-2)
```diff
@@ -8,7 +8,6 @@
 from lavague.core.base_driver import (
     BaseDriver,
     JS_GET_INTERACTIVES,
-    JS_GET_INTERACTIVES_IN_VIEWPORT,
     JS_WAIT_DOM_IDLE,
     PossibleInteractionsByXpath,
     InteractionType,
@@ -312,7 +311,8 @@ def get_possible_interactions(
         self, in_viewport=True, foreground_only=True
     ) -> PossibleInteractionsByXpath:
         exe: Dict[str, List[str]] = self.execute_script(
-            JS_GET_INTERACTIVES_IN_VIEWPORT if in_viewport else JS_GET_INTERACTIVES,
+            JS_GET_INTERACTIVES,
+            in_viewport,
             foreground_only,
         )
         res = dict()
```

**File**: `lavague-integrations/drivers/lavague-drivers-selenium/lavague/drivers/selenium/base.py` (modified, +96/-64)
```diff
@@ -1,3 +1,4 @@
+from abc import ABC
 from typing import Any, Optional, Callable, Mapping, Dict, List
 from selenium.webdriver.remote.webdriver import WebDriver
 from selenium.webdriver.common.by import By
@@ -15,7 +16,6 @@
 from lavague.core.base_driver import (
     BaseDriver,
     JS_GET_INTERACTIVES,
-    JS_GET_INTERACTIVES_IN_VIEWPORT,
     JS_WAIT_DOM_IDLE,
     JS_GET_SCROLLABLE_PARENT,
     PossibleInteractionsByXpath,
@@ -49,6 +49,20 @@
 )
 
 
+class XPathResolved(ABC):
+    def __init__(self, xpath: str, driver: any, element: WebElement) -> None:
+        self.xpath = xpath
+        self._driver = driver
+        self.element = element
+        super().__init__()
+
+    def __enter__(self):
+        return self
+
+    def __exit__(self, exc_type, exc_val, exc_tb):
+        self._driver.switch_default_frame()
+
+
 class SeleniumDriver(BaseDriver):
     driver: WebDriver
     last_hover_xpath: Optional[str] = None
@@ -208,10 +222,13 @@ def maximize_window(self) -> None:
 
     def check_visibility(self, xpath: str) -> bool:
         try:
-            element = self.resolve_xpath(xpath)
-            return (
+            # Done manually here to avoid issues
+            element = self.resolve_xpath(xpath).element
+            res = (
                 element is not None and element.is_displayed() and element.is_enabled()
             )
+            self.switch_default_frame()
+            return res
         except:
             return False
 
@@ -277,17 +294,18 @@ def switch_default_frame(self) -> None:
     def switch_parent_frame(self) -> None:
         self.driver.switch_to.parent_frame()
 
-    def resolve_xpath(self, xpath: Optional[str]) -> WebElement:
+    def resolve_xpath(self, xpath: Optional[str]) -> XPathResolved:
         if not xpath:
             raise NoSuchElementException("xpath is missing")
         before, sep, after = xpath.partition("iframe")
         if len(before) == 0:
             return None
         if len(sep) == 0:
-            return self.driver.find_element(By.XPATH, before)
+            res = self.driver.find_element(By.XPATH, before)
+            res = XPathResolved(xpath, self, res)
+            return res
         self.switch_frame(before + sep)
         element = self.resolve_xpath(after)
-        self.switch_default_frame()
         return element
 
     def exec_code(
@@ -348,18 +366,23 @@ def code_for_execute_script(self, js_code: str, *args) -> str:
         )
 
     def hover(self, xpath: str):
-        element = self.resolve_xpath(xpath)
-        self.last_hover_xpath = xpath
-        ActionChains(self.driver).move_to_element(element).perform()
+        with self.resolve_xpath(xpath) as element_resolved:
+            self.last_hover_xpath = xpath
+            ActionChains(self.driver).move_to_element(
+                element_resolved.element
+            ).perform()
 
     def scroll_page(self, direction: ScrollDirection = ScrollDirection.DOWN):
         self.driver.execute_script(direction.get_page_script())
 
     def get_scroll_anchor(self, xpath_anchor: Optional[str] = None) -> WebElement:
-        element = self.resolve_xpath(xpath_anchor or self.last_hover_xpath)
-        parent = self.driver.execute_script(JS_GET_SCROLLABLE_PARENT, element)
-        scroll_anchor = parent or element
-        return scroll_anchor
+        with self.resolve_xpath(
+            xpath_anchor or self.last_hover_xpath
+        ) as element_resolved:
+            element = element_resolved.element
+            parent = self.driver.execute_script(JS_GET_SCROLLABLE_PARENT, element)
+            scroll_anchor = parent or element
+            return scroll_anchor
 
     def get_scroll_container_size(self, scroll_anchor: WebElement):
         container = self.driver.execute_script(JS_GET_SCROLLABLE_PARENT, scroll_anchor)
@@ -421,39 +444,43 @@ def scroll(
             self.scroll_page(direction)
 
     def click(self, xpath: str):
-        element = self.resolve_xpath(xpath)
-        self.last_hover_xpath = xpath
-        try:
-            element.click()
-        except ElementClickInterceptedException:
+        with self.resolve_xpath(xpath) as element_resolved:
+            element = element_resolved.element
+            self.last_hover_xpath = xpath
             try:
-                # Move to the element and click at its position
-                ActionChains(self.driver).move_to_element(element).click().perform()
-            except WebDriverException as click_error:
+                element.click()
+            except ElementClickInterceptedException:
+                try:
+                    # Move to the element and click at its position
+                    ActionChains(self.driver).move_to_element(element).click().perform()
+                except WebDriverException as click_error:
+                    raise Exception(
+                        f"Failed to click at element coordinates of {xpath} : {str(click_error)}"
+                    )
+            except Except
```

**File**: `lavague-tests/lavague/tests/cli.py` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ def cli(
 
 
 def _load_sites(directory, site):
-    sites_to_test: List[Path] = []
+    sites_to_test: List[TestConfig] = []
     try:
         for item in os.listdir(directory):
             if (len(site) == 0 or item in site) and os.path.isfile(
```

**File**: `lavague-tests/lavague/tests/runner.py` (modified, +1/-4)
```diff
@@ -119,12 +119,9 @@ def __init__(
     def run(self) -> RunnerResult:
         results: List[RunResults] = []
         for site in self.sites:
-            try:
-                site.setup.start()
+            with site.setup:
                 task_results = self._run_tasks(site.tasks)
                 results.append(RunResults(site, task_results))
-            finally:
-                site.setup.stop()
 
         return RunnerResult(results)
 
```

**File**: `lavague-tests/lavague/tests/setup.py` (modified, +19/-10)
```diff
@@ -1,12 +1,19 @@
-from typing import Dict
+from typing import Dict, Optional, Any
 import http.server
 import socketserver
 import threading
 import os
 
 
 class Setup:
-    default_url: str = None
+    default_url: Optional[str] = None
+
+    def __enter__(self):
+        self.start()
+        return self
+
+    def __exit__(self, exc_type, exc_value, traceback):
+        self.stop()
 
     def start(self):
         pass
@@ -16,27 +23,29 @@ def stop(self):
 
     @staticmethod
     def parse(directory: str, args: Dict) -> "Setup":
-        if args.get("type", "web") == "web":
-            return Setup()
-
         if args["type"] == "static":
             directory = os.path.join(directory, args.get("directory", "www"))
             return StaticServer(directory, args.get("port", "8000"))
 
+        return Setup()
+
 
 class StaticServer(Setup):
     default_url = "http://localhost:8000"
-    httpd: socketserver.TCPServer = None
+    httpd: Optional[socketserver.TCPServer] = None
 
     def __init__(self, directory: str, port: int):
         self.directory = directory
         self.port = port
 
     def start(self):
-        def handler(*args, **kwargs):
-            http.server.SimpleHTTPRequestHandler(
-                *args, directory=self.directory, **kwargs
-            )
+        def handler(*args, **kwargs) -> Any:
+            try:
+                return http.server.SimpleHTTPRequestHandler(
+                    *args, directory=self.directory, **kwargs
+                )
+            except ConnectionResetError:
+                pass
 
         self.httpd = socketserver.TCPServer(("", self.port), handler)
         self.thread = threading.Thread(target=self.httpd.serve_forever)
```

**File**: `lavague-tests/sites/examples/config.yml` (modified, +1/-11)
```diff
@@ -2,20 +2,10 @@ type: static
 port: 8000
 directory: www
 tasks:
-
   - name: Navigate using link
     url: http://localhost:8000
     prompt: Go to the menu
     max_steps: 1
     expect:
       - URL is http://localhost:8000/menu.html
-      - HTML contains <h1>Menu</h1>
-
-  - name: Upload a file
-    url: http://localhost:8000/file.html
-    prompt: Upload my picture
-    max_steps: 1
-    user_data:
-      my_picture: dummy_file.png
-    expect:
-      - HTML contains File uploaded
\ No newline at end of file
+      - HTML contains <h1>Menu</h1>
\ No newline at end of file
```

---

### Incident Patch 5: `01450a55` (2024-09-02)
**Commit Message**: fix: params order for navigation engine (#597)

**File**: `lavague-core/lavague/core/action_engine.py` (modified, +1/-1)
```diff
@@ -49,14 +49,14 @@ def __init__(
         python_engine: BaseEngine = None,
         navigation_control: BaseEngine = None,
         llm: BaseLLM = None,
-        extraction_llm: Optional[BaseLLM] = None,
         embedding: BaseEmbedding = None,
         retriever: BaseHtmlRetriever = None,
         prompt_template: PromptTemplate = NAVIGATION_ENGINE_PROMPT_TEMPLATE.prompt_template,
         extractor: BaseExtractor = DynamicExtractor(),
         time_between_actions: float = 1.5,
         n_attempts: int = 5,
         logger: AgentLogger = None,
+        extraction_llm: Optional[BaseLLM] = None,
     ):
         if llm is None:
             llm = get_default_context().llm
```

---

### Incident Patch 6: `c0a7fc86` (2024-08-27)
**Commit Message**: #588 fix exceeded output tokens limit for extraction (#591)

* fix(#588): avoid extraction llm answer truncature

* chore: update doc

* fix: compress llm output

**File**: `docs/index.md` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ world_model = WorldModel()
 action_engine = ActionEngine(selenium_driver)
 agent = WebAgent(world_model, action_engine)
 agent.get("https://huggingface.co/docs")
-agent.run("Go on the installation page for PEFT")
+agent.run("Go on the quicktour of PEFT")
 
 # Launch Gradio Agent Demo
 agent.demo("Go on the quicktour of PEFT")
```

**File**: `lavague-core/lavague/core/action_engine.py` (modified, +6/-2)
```diff
@@ -1,5 +1,5 @@
 from __future__ import annotations
-from typing import Dict
+from typing import Dict, Optional
 from llama_index.core import PromptTemplate
 from llama_index.core.base.llms.base import BaseLLM
 from llama_index.core.base.embeddings.base import BaseEmbedding
@@ -49,6 +49,7 @@ def __init__(
         python_engine: BaseEngine = None,
         navigation_control: BaseEngine = None,
         llm: BaseLLM = None,
+        extraction_llm: Optional[BaseLLM] = None,
         embedding: BaseEmbedding = None,
         retriever: BaseHtmlRetriever = None,
         prompt_template: PromptTemplate = NAVIGATION_ENGINE_PROMPT_TEMPLATE.prompt_template,
@@ -63,6 +64,9 @@ def __init__(
         if embedding is None:
             embedding = get_default_context().embedding
 
+        if extraction_llm is None:
+            extraction_llm = get_default_context().extraction_llm
+
         self.driver = driver
 
         if retriever is None:
@@ -81,7 +85,7 @@ def __init__(
                 embedding=embedding,
             )
         if python_engine is None:
-            python_engine = PythonEngine(driver, llm, embedding)
+            python_engine = PythonEngine(driver, extraction_llm, embedding)
         if navigation_control is None:
             navigation_control = NavigationControl(
                 driver,
```

**File**: `lavague-core/lavague/core/context.py` (modified, +3/-0)
```diff
@@ -1,6 +1,7 @@
 from llama_index.core.llms import LLM
 from llama_index.core.multi_modal_llms import MultiModalLLM
 from llama_index.core.embeddings import BaseEmbedding
+from typing import Optional
 
 DEFAULT_MAX_TOKENS = 512
 DEFAULT_TEMPERATURE = 0.0
@@ -14,6 +15,7 @@ def __init__(
         llm: LLM,
         mm_llm: MultiModalLLM,
         embedding: BaseEmbedding,
+        extraction_llm: Optional[LLM] = None,
     ):
         """
         llm (`LLM`):
@@ -26,6 +28,7 @@ def __init__(
         self.llm = llm
         self.mm_llm = mm_llm
         self.embedding = embedding
+        self.extraction_llm = extraction_llm or llm
 
 
 def get_default_context() -> Context:
```

**File**: `lavague-core/lavague/core/extractors.py` (modified, +21/-13)
```diff
@@ -3,7 +3,7 @@
 from jsonschema import validate, ValidationError
 import yaml
 import json
-from typing import Any, Dict
+from typing import Any, Dict, Tuple
 
 
 def extract_xpaths_from_html(html):
@@ -59,11 +59,18 @@ def extract(self, markdown_text: str) -> str:
         if match:
             # Return the first matched group, which is the code inside the ```python ```
             yml_str = match.group(1).strip()
+        cleaned_yml = re.sub(r"^```.*\n|```$", "", yml_str, flags=re.DOTALL)
         try:
-            yaml.safe_load(yml_str)
-            return yml_str
+            yaml.safe_load(cleaned_yml)
+            return cleaned_yml
         except yaml.YAMLError:
-            return None
+            # retry with extra quote in case of truncated output
+            cleaned_yml += '"'
+            try:
+                yaml.safe_load(cleaned_yml)
+                return cleaned_yml
+            except yaml.YAMLError:
+                return None
 
     def extract_as_object(self, text: str):
         return yaml.safe_load(self.extract(text))
@@ -164,27 +171,28 @@ def __init__(self):
             "python": PythonFromMarkdownExtractor(),
         }
 
-    def get_type(self, text: str) -> str:
+    def get_type(self, text: str) -> Tuple[str, str]:
         types_pattern = "|".join(self.extractors.keys())
         pattern = rf"```({types_pattern}).*?```"
         match = re.search(pattern, text, re.DOTALL)
         if match:
-            return match.group(1).strip()
+            return match.group(1).strip(), text
         else:
-            # Try to auto-detect first matching extractor
+            # Try to auto-detect first matching extractor, and remove extra ```(type)``` wrappers
+            cleaned_text = re.sub(r"^```.*\n|```$", "", text, flags=re.DOTALL)
             for type, extractor in self.extractors.items():
                 try:
-                    value = extractor.extract(text)
+                    value = extractor.extract(cleaned_text)
                     if value:
-                        return type
+                        return type, value
                 except:
                     pass
             raise ValueError(f"No extractor pattern can be found from {text}")
 
     def extract(self, text: str) -> str:
-        type = self.get_type(text)
-        return self.extractors[type].extract(text)
+        type, target_text = self.get_type(text)
+        return self.extractors[type].extract(target_text)
 
     def extract_as_object(self, text: str) -> Any:
-        type = self.get_type(text)
-        return self.extractors[type].extract_as_object(text)
+        type, target_text = self.get_type(text)
+        return self.extractors[type].extract_as_object(target_text)
```

**File**: `lavague-core/lavague/core/python_engine.py` (modified, +12/-19)
```diff
@@ -1,4 +1,3 @@
-import json
 import shutil
 import time
 from io import BytesIO
@@ -20,7 +19,6 @@
 from llama_index.core import Document, VectorStoreIndex
 from llama_index.core.base.llms.base import BaseLLM
 from llama_index.core.embeddings import BaseEmbedding
-import re
 from lavague.core.extractors import DynamicExtractor
 
 DEFAULT_TEMPERATURE = 0.0
@@ -60,14 +58,14 @@ def __init__(
         temp_screenshots_path="./tmp_screenshots",
         n_search_attemps=10,
     ):
-        self.llm = llm or get_default_context().llm
+        self.llm = llm or get_default_context().extraction_llm
         self.embedding = embedding or get_default_context().embedding
         self.clean_html = clean_html
         self.driver = driver
         self.logger = logger
         self.display = display
         self.ocr_mm_llm = ocr_mm_llm or OpenAIMultiModal(
-            model="gpt-4o-mini", temperature=DEFAULT_TEMPERATURE
+            model="gpt-4o-mini", temperature=DEFAULT_TEMPERATURE, max_new_tokens=16384
         )
         self.ocr_llm = ocr_llm or self.llm
         self.batch_size = batch_size
@@ -80,15 +78,9 @@ def __init__(
     def from_context(cls, context: Context, driver: BaseDriver):
         return cls(llm=context.llm, embedding=context.embedding, driver=driver)
 
-    def extract_json(self, output: str) -> Optional[dict]:
+    def extract_structured_data(self, output: str) -> Optional[dict]:
         extractor = DynamicExtractor()
-        clean = extractor.extract(output)
-        try:
-            output_dict = json.loads(clean)
-        except json.JSONDecodeError as e:
-            print(f"Error extracting Json: {e}")
-            return None
-        return output_dict
+        return extractor.extract_as_object(output)
 
     def get_screenshots_batch(self) -> list[str]:
         screenshot_paths = []
@@ -149,7 +141,7 @@ def perform_fallback(self, prompt, instruction) -> str:
             output = self.ocr_mm_llm.complete(
                 image_documents=screenshots, prompt=prompt
             ).text.strip()
-            output_dict = self.extract_json(output)
+            output_dict = self.extract_structured_data(output)
             if output_dict:
                 context_score = output_dict.get("score", 0)
                 output = output_dict.get("ret")
@@ -193,17 +185,18 @@ def execute_instruction(self, instruction: str) -> ActionResult:
         query_engine = index.as_query_engine(llm=llm)
 
         prompt = f"""
-        Based on the context provided, you must respond to query with a JSON object in the following format:
-        {{
-            "ret": "[your answer]",
-            "score": [a float value between 0 and 1 on your confidence that you have enough context to answer the question]
-        }}
+        Based on the context provided, you must respond to query with a YAML object in the following format:
+        ```yaml
+        score: [a float value between 0 and 1 on your confidence that you have enough context to answer the question]
+        ret: "[your answer]"
+        ```
         If you do not have sufficient context, set 'ret' to 'Insufficient context' and 'score' to 0.
+        Keep the answer in 'ret' concise but informative.
         The query is: {instruction}
         """
 
         output = query_engine.query(prompt).response.strip()
-        output_dict = self.extract_json(output)
+        output_dict = self.extract_structured_data(output)
 
         try:
             if (
```

**File**: `lavague-integrations/contexts/lavague-contexts-openai/lavague/contexts/openai/base.py` (modified, +6/-0)
```diff
@@ -30,6 +30,12 @@ def __init__(
             ),
             OpenAIMultiModal(api_key=api_key, model=mm_llm),
             OpenAIEmbedding(api_key=api_key, model=embedding),
+            OpenAI(
+                api_key=api_key,
+                model=llm,
+                max_tokens=4096,
+                temperature=DEFAULT_TEMPERATURE,
+            ),
         )
 
 
```

---

### Incident Patch 7: `eb177eb7` (2024-08-27)
**Commit Message**: quick-patch (#589)

**File**: `docs/index.md` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ world_model = WorldModel()
 action_engine = ActionEngine(selenium_driver)
 agent = WebAgent(world_model, action_engine)
 agent.get("https://huggingface.co/docs")
-agent.run("Go on the quicktour of PEFT")
+agent.run("Go on the installation page for PEFT")
 
 # Launch Gradio Agent Demo
 agent.demo("Go on the quicktour of PEFT")
```

---

### Incident Patch 8: `e6a65882` (2024-08-22)
**Commit Message**: cicd: fix

**File**: `.github/workflows/publish.yaml` (modified, +2/-0)
```diff
@@ -55,6 +55,8 @@ jobs:
                 
                 poetry config pypi-token.pypi ${{ secrets.PYPI_TOKEN }}
 
+                poetry publish --build
+                
                 # Sleep to allow some time for pypi package to upload
                 echo "Waiting for version to update..."
                 sleep 60
```

---

### Incident Patch 9: `dfe2e0d0` (2024-08-22)
**Commit Message**: CI/CD: fix version verification in CD script

**File**: `.github/workflows/publish.yaml` (modified, +9/-2)
```diff
@@ -55,10 +55,17 @@ jobs:
                 
                 poetry config pypi-token.pypi ${{ secrets.PYPI_TOKEN }}
 
-                poetry publish --build
+                # Sleep to allow some time for pypi package to upload
+                echo "Waiting for version to update..."
+                sleep 60
                 
-                # Install the latest package and confirm the version is updated
+                # Install the latest package from PyPI
+                echo "Installing the latest version of $package_name from PyPI..."
+                pip install --upgrade "$package_name"
+                
+                # Confirm the installed version is the latest version
                 installed_version=$(pip show "$package_name" | grep '^Version:' | awk '{print $2}')
+                echo "Installed Version: $installed_version"
                 
                 if [ "$installed_version" == "$latest_version" ]; then
                     echo "Version successfully updated."
```

---

### Incident Patch 10: `2848691c` (2024-08-14)
**Commit Message**: fix: ignore scroll as interactive element

**File**: `lavague-core/lavague/core/base_driver.py` (modified, +1/-1)
```diff
@@ -504,7 +504,7 @@ def js_wrap_function_call(fn: str):
             evts.push('CLICK');
         }
         if (hasEvent('scroll') || hasEvent('wheel')|| e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth) {
-            evts.push('SCROLL');
+            //evts.push('SCROLL');
         }
         return evts;
     }
```

---

### Incident Patch 11: `8b68315d` (2024-08-12)
**Commit Message**: docs: code fix after CI run

**File**: `.github/workflows/docs-checker.yaml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ on:
     branches:
       - '*'
   schedule:
-    - cron: '0 10 * * 1'
+    - cron: '0 12 * * 1'
   workflow_dispatch:
 
 jobs:
```

**File**: `docs/docs/get-started/customization.md` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ from lavague.drivers.selenium import SeleniumDriver
 
 # Customize the LLM, multi-modal LLM and embedding models
 llm = Gemini(model_name="models/gemini-1.5-flash-latest")
-mm_llm =  AnthropicModal(model="claude-3-sonnet-20240229", max_tokens=3000)
+mm_llm =  AnthropicMultiModal(model="claude-3-sonnet-20240229", max_tokens=3000)
 
 # Initialize the Selenium driver
 selenium_driver = SeleniumDriver()
```

---

### Incident Patch 12: `e695cedb` (2024-08-12)
**Commit Message**: docs: fix links

**File**: `.github/workflows/docs-checker.yaml` (modified, +1/-7)
```diff
@@ -5,7 +5,7 @@ on:
     branches:
       - '*'
   schedule:
-    - cron: '0 9 * * 1'
+    - cron: '0 10 * * 1'
   workflow_dispatch:
 
 jobs:
@@ -124,7 +124,6 @@ jobs:
 
       - name: Extract Python code
         run: |
-          rm ./docs/docs/examples/qa-automation.md
           python .github/extract-python-code.py ./docs/docs/examples/*.md docs/docs/use-cases/*.md ./docs/docs/get-started/*.md  ./docs/docs/module-guides/*.md ./docs/docs/learn/*.md
 
       - name: Run extracted Python scripts
@@ -143,11 +142,6 @@ jobs:
             echo "No generated scripts found."
           fi
 
-      - name: Clean up
-        run: |
-          rm hf_knowledge.txt
-          rm -f generated_scripts.txt
-
   notify-docs-examples-failure:
     runs-on: ubuntu-latest
     needs: docs-examples-checker
```

**File**: `docs/docs/get-started/docs-chrome.md` (modified, +1/-2)
```diff
@@ -9,8 +9,7 @@ It is made up of two key components:
 - The [Chrome extension](https://chromewebstore.google.com/detail/lavague/johbmggagpndaefakonkdfjpcfdmbfbm) which you can install from the Chrome Web Store.
 - The `lavague-server` package & CLI tool, which enable you to launch the Agent that will be used by the extension.
 
-<iframe width="560" height="315" src="https://www.youtube.com/embed/O8CMSdj1a28
-" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
+<iframe width="560" height="315" src="https://www.youtube.com/embed/O8CMSdj1a28" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
 
 ### Install necessary packages
 
```

**File**: `docs/docs/get-started/quick-tour.md` (modified, +1/-2)
```diff
@@ -82,8 +82,7 @@ You can take a quick look at the `demo` feature in the video below:
 
 You can also run LaVague in-browser with our LaVague Chrome Extension:
 
-<iframe width="560" height="315"  src="https://www.youtube.com/embed/f7-pRFtT6hY
-" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
+<iframe width="560" height="315"  src="https://www.youtube.com/embed/f7-pRFtT6hY" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
 
 To learn how to install and get started with the Chrome extension, see our [LaVague extension docs](./docs-chrome.md)
 
```

**File**: `docs/docs/lavague-qa/usage.md` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ Contexts are used to define the set of LLMs that will be used by LaVague QA to g
 Contexts are defined in `.py` configuration files which instantiate the required `Context` object and a `TokenCounter` object.
 
 - By default we use our OpenaiContext which leverages OpenAI's `gpt-4o` and `text-embedding-3-small`
-- You can learn how to define a custom context with models of your choice [in this guide](https://docs.lavague.ai/en/latest/docs/learn/testing/#providing-a-custom-configuration-files)
+- You can learn how to define a custom context with models of your choice [in this guide](https://docs.lavague.ai/en/latest/docs/get-started/testing/#providing-a-custom-configuration-file)
 
 To run with a custom context, use the `--context` flag along with the path to the `.py` file creating the objects.
 
```

---

### Incident Patch 13: `f8479beb` (2024-08-08)
**Commit Message**: chore: fix version number on chrome ext

**File**: `extension_chrome/public/manifest.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
     "name": "LaVague",
     "description": "LaVague Web Agent",
-    "version": "0.5",
+    "version": "0.50",
     "manifest_version": 3,
     "minimum_chrome_version": "116",
     "action": {
```

---

### Incident Patch 14: `eaf3c933` (2024-08-08)
**Commit Message**: feat: refined ui & content script injected at install

**File**: `extension_chrome/src/app/App.tsx` (modified, +1/-10)
```diff
@@ -17,18 +17,9 @@ export default function App({ port }: { port: chrome.runtime.Port }) {
 }
 
 function MainContent() {
-    const { runningAgentState } = useContext(AppContext);
-
     return (
         <>
-            {runningAgentState === RunningAgentState.IDLE ? (
-                <img src="images/lavague.png" className="logo" />
-            ) : (
-                <Box display="flex" alignItems="center" justifyContent="center" className='logo'>
-                    <Spinner thickness='4px' speed='0.55s' emptyColor='gray.200' color='blue.500' width="35px" height='35px' />
-                    <Text fontSize="xl" ml={2}>Thinking...</Text>
-                </Box>
-            )}
+            {<img src="images/lavague.png" className="logo" />}
             <MainLayout />
         </>
     );
```

**File**: `extension_chrome/src/app/component/Logs.tsx` (modified, +35/-7)
```diff
@@ -28,7 +28,7 @@ const COMMAND_LABELS: { [key: string]: string } = {
 };
 
 export default function Logs({ logTypes }: { logTypes: LogType[] }) {
-    const { connector, setRunningAgentState } = useContext(AppContext);
+    const { connector, setRunningAgentState, runningAgentState } = useContext(AppContext);
     const [logs, setLogs] = useState<RepeatableLog[]>([]);
     const bottomElementRef = useRef<HTMLDivElement | null>(null);
 
@@ -40,15 +40,31 @@ export default function Logs({ logTypes }: { logTypes: LogType[] }) {
                     newLogs[newLogs.length - 1].count++;
                     setLogs(newLogs);
                 } else {
-                    setLogs([...logs, { ...log, count: 1 }]);
-                    setTimeout(() => bottomElementRef.current?.scrollIntoView({ behavior: 'smooth' }), 500);
+                    if (log.type == 'agent_log') {
+                        const index = logs.findIndex(log => log.type === 'agent_log' && log.log === "");
+                        const foundLog = index !== -1 ? logs[index] : undefined;
+                        if (foundLog === undefined) {
+                            setLogs([...logs, { ...log, count: 1 }]);
+                            setTimeout(() => bottomElementRef.current?.scrollIntoView({ behavior: 'smooth' }), 500);
+                        } 
+                        else {
+                            const newLogs = [...logs];
+                            newLogs[index].log = log.log;
+                            setLogs(newLogs);
+                        } 
+                    }
+                    else {
+                        setLogs([...logs, { ...log, count: 1 }]);
+                        setTimeout(() => bottomElementRef.current?.scrollIntoView({ behavior: 'smooth' }), 500);
+                    } 
                 }
             }
         },
         [logs, setLogs, bottomElementRef, logTypes]
     );
 
     useEffect(() => {
+        let check_last_entry = false
         const destructors = [
             connector.onError((err: any) => {
                 if (err instanceof Event && err.target instanceof WebSocket) {
@@ -63,17 +79,21 @@ export default function Logs({ logTypes }: { logTypes: LogType[] }) {
                 if (message.command) {
                     log = COMMAND_LABELS[message.command];
                 } else if (message.type === 'agent_log' && message.agent_log.world_model_output) {
-                    console.log(message);
                     const log_tmp = message.agent_log.world_model_output;
                     const engine = extractNextEngine(log_tmp);
                     if (engine === 'COMPLETE') {
                         const instruction = extractWorldModelInstruction(log_tmp);
                         log = instruction.indexOf('[NONE]') != -1 ? 'Objective reached' : 'Output:' + '\n' + instruction;
                     } else {
-                        log = 'Instruction: ' + extractWorldModelInstruction(log_tmp);
+                        log = extractWorldModelInstruction(log_tmp);
                     }
                     type = 'agent_log';
-                } else if (message.type === 'start') {
+                } else if (message.type === 'agent_log' && message.agent_log.current_state) {
+                    log = ""
+                    type = 'agent_log';
+                    check_last_entry = true
+                }
+                else if (message.type === 'start') {
                     setRunningAgentState(RunningAgentState.RUNNING);
                 } else if (message.type === 'stop') {
                     setRunningAgentState(RunningAgentState.IDLE);
@@ -84,6 +104,14 @@ export default function Logs({ logTypes }: { logTypes: LogType[] }) {
                 if (log) {
                     addLog({ log, type });
                 }
+                else if (check_last_entry) {
+                    const curr_logs = [...logs]
+                    if (curr_logs.length == 0 || curr_logs[curr_logs.length - 1].log != "")  {
+                        const lo: string = log!
+                        addLog({ log: lo, type });
+                    }
+                    check_last_entry = false                
+                }
             }),
             connector.onOutputMessage((message) => addLog({ log: message.args, type: 'userprompt' })),
             connector.onSystemMessage((message) => {
@@ -97,7 +125,7 @@ export default function Logs({ logTypes }: { logTypes: LogType[] }) {
         <div className="logs">
             {logs.map((log, index) => (
                 <Stack key={index} className={'log ' + log.type} direction="row">
-                    <Text>{log.log}</Text>
+                    <Text>{log.log.length == 0 && log.type == "agent_log" ? " Thinking of next steps..." : log.log}</Text>
                     {log.count > 1 && <Badge>{log.count}</Badge>}
                 </Stack>
             ))}
```

**File**: `extension_chrome/src/app/component/MainLayout.tsx` (modified, +2/-24)
```diff
@@ -1,5 +1,5 @@
 import React, { useCallback, useContext, useEffect, useState } from 'react';
-import { List, ListItem, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
+import { Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
 import Prompt from './Prompt';
 import Logs from './Logs';
 import Debug from './Debug';
@@ -27,36 +27,14 @@ export default function MainLayout() {
             }
             setRunningAgentState(RunningAgentState.IDLE);
         }
-    }, [serverState, setTabIndex, setFirstConnection, setRunningAgentState, firstConnection, connector, requestConnection]);
+    }, [serverState ,setTabIndex, setFirstConnection, setRunningAgentState, firstConnection, connector, requestConnection]);
 
     tabs.push({
         header: <>Agent</>,
         content: (
             <div className="chatbox">
                 <div className="wmlogs">
                     <div className="logs">
-                        <Stack className={'log agent_log'} direction="column">
-                            <Text>Welcome to the Lavague Chrome Extension!</Text>
-                            <Text mt={3}>To get started:</Text>
-                            <List mt={1}>
-                                <ListItem>
-                                    - Open your terminal and type <code>lavague-serve</code> to run the command ;
-                                </ListItem>
-                                <ListItem mt={1}>
-                                    - Go to the{' '}
-                                    <span style={{ cursor: 'pointer' }} onClick={() => requestConnection()}>
-                                        &quot;Connection&quot;
-                                    </span>{' '}
-                                    tab and enter the host you want to reach (e.g., 127.0.0.1:8000).
-                                </ListItem>
-                            </List>
-                            <Text mt={3}>
-                                For more information and details, visit{' '}
-                                <a href="https://docs.lavague.ai" target="_blank" rel="noreferrer">
-                                    https://docs.lavague.ai
-                                </a>
-                            </Text>
-                        </Stack>
                         <Logs logTypes={['userprompt', 'agent_log']} />
                     </div>
                 </div>
```

**File**: `extension_chrome/src/app/component/Prompt.tsx` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ export default function Prompt({ requestConnection }: { requestConnection: () =>
         if (serverState === AgentServerState.CONNECTED) {
             if (runningAgentState === RunningAgentState.IDLE) {
                 connector.sendPrompt('run', prompt);
+                connector.sendSystemMessage("")
             } else {
                 connector.disconnect();
                 connector.sendSystemMessage('The agent is now interrupted.');
```

**File**: `extension_chrome/src/background.ts` (modified, +26/-0)
```diff
@@ -3,8 +3,34 @@ import { DomActions } from './domactions';
 chrome.runtime.onInstalled.addListener(() => {
     const sidePanel = (chrome as any).sidePanel;
     sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
+    // Forcefully inject the RPC script on the open tabs, as chrome will usually only start to inject the code after the page is refreshed...
+    initRPCScript();
 });
 
+function injectIntoTab(tab: any) {
+    const manifest = chrome.runtime.getManifest();
+    const scripts = manifest.content_scripts![0].js;
+    const s = scripts!.length;
+    for (let i = 0; i < s; i++) {
+        chrome.scripting.executeScript({
+            target: { tabId: tab.id },
+            files: [scripts![i]],
+        });
+    }
+}
+
+function initRPCScript(): void {
+    chrome.windows.getAll({ populate: true }, (windows: chrome.windows.Window[]) => {
+        windows.forEach((currentWindow) => {
+            currentWindow.tabs?.forEach((currentTab) => {
+                if (currentTab.url && currentTab.url.match(/(file|http|https):\/\//gi)) {
+                    injectIntoTab(currentTab);
+                }
+            });
+        });
+    });
+}
+
 chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     if (message.action === 'getEventListeners_all') {
         const { xpath_list } = message;
```

---

### Incident Patch 15: `5fae68f4` (2024-08-07)
**Commit Message**: fix: use standard click from HTMLElement for chrome extension action

**File**: `extension_chrome/src/domactions.ts` (modified, +2/-28)
```diff
@@ -12,34 +12,8 @@ export function getNodeFromXPATH(xpath: string): Node | null {
 export function clickElementByXPath(xpath: string): boolean {
     const element = getNodeFromXPATH(xpath);
     if (element && element instanceof HTMLElement) {
-        if (element.tagName.toLowerCase() === 'a') {
-            const anchorElement = element as HTMLAnchorElement;
-            if (anchorElement.href) {
-                // Navigate to the href URL to ensure history update
-                console.log('Navigating to:', anchorElement.href);
-                window.location.href = anchorElement.href;
-            }
-        } else {
-            // Simulate a user-initiated click
-            const event = new MouseEvent('click', {
-                view: window,
-                bubbles: true,
-                cancelable: true,
-                buttons: 1,
-            });
-            element.dispatchEvent(event);
-            if (
-                element.tagName.toLowerCase() === 'button' ||
-                (element.tagName.toLowerCase() === 'input' && (element as HTMLInputElement).type === 'submit')
-            ) {
-                // Special handling for button and submit inputs to ensure form submission
-                if ((element as HTMLInputElement).form) {
-                    (element as HTMLInputElement).form!.submit();
-                }
-            }
-        }
-        console.log(element.textContent);
-        console.log('clicked!');
+        element.click();
+        console.log('click', element.textContent);
         return true;
     } else {
         console.log('failed to click!');
```

#### Recent Merged Pull Requests:
- **PR #649** (closed): Add video recording support to agent.run() (@aymenhmaidiwastaken)
- **PR #633** (2025-01-21): CI: drop cron schedule run (@lyie28)
- **PR #624** (closed): Assignment - Tree Search for Language Model Agents (@RomainSa)
- **PR #615** (2024-10-14): Add endpoints to compute and execute custom actions (@adeprez)
- **PR #613** (2024-10-03): feat: remove unused exceptions (@adeprez)
- **PR #612** (2024-10-04): Simplify base driver (@adeprez)
- **PR #611** (2024-10-01): better status (@mbrunel)
- **PR #610** (2024-10-15): Correct model name in OpenAI integration docs (@SH4DY)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
