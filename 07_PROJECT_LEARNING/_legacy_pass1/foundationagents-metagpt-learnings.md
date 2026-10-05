# Forensic Learning Record (Deep Inspection): FoundationAgents/MetaGPT

> **Canonical Artifact**: `07_PROJECT_LEARNING/foundationagents-metagpt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:52:53.422Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FoundationAgents/MetaGPT`
- **Description**: 🌟 The Multi-Agent Framework: First AI Software Company, Towards Natural Language Programming
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 70705 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/aflow/optimize.py`
```
# -*- coding: utf-8 -*-
# @Date    : 8/23/2024 20:00 PM
# @Author  : didi
# @Desc    : Entrance of AFlow.

import argparse
from typing import Dict, List

from metagpt.configs.models_config import ModelsConfig
from metagpt.ext.aflow.data.download_data import download
from metagpt.ext.aflow.scripts.optimizer import Optimizer


class ExperimentConfig:
    def __init__(self, dataset: str, question_type: str, operators: List[str]):
        self.dataset = dataset
        self.question_type = question_type
        self.operators = operators


EXPERIMENT_CONFIGS: Dict[str, ExperimentConfig] = {
    "DROP": ExperimentConfig(
        dataset="DROP",
        question_type="qa",
        operators=["Custom", "AnswerGenerate", "ScEnsemble"],
    ),
    "HotpotQA": ExperimentConfig(
        dataset="HotpotQA",
        question_type="qa",
        operators=["Custom", "AnswerGenerate", "ScEnsemble"],
    ),
    "MATH": ExperimentConfig(
        dataset="MATH",
        question_type="math",
        operators=["Custom", "ScEnsemble", "Programmer"],
    ),
    "GSM8K": ExperimentConfig(
        dataset="GSM8K",
        question_type="math",
        operators=["Custom", "ScEnsemble", "Programmer"],
    ),
    "MBPP": ExperimentConfig(
        dataset="MBPP",
        question_type="code",
        operators=["Custom", "CustomCodeGenerate", "ScEnsemble", "Test"],
    ),
    "HumanEval": ExperimentConfig(
        dataset="HumanEval",
        question_type="code",
        operators=["Custom", "CustomCodeGenerate", "ScEnsemble", "Test"],
    ),
}


def parse_args():
    parser = argparse.ArgumentParser(description="AFlow Optimizer")
    parser.add_argument(
        "--dataset",
        type=str,
        choices=list(EXPERIMENT_CONFIGS.keys()),
        required=True,
        help="Dataset type",
    )
    parser.add_argument("--sample", type=int, default=4, help="Sample count")
    parser.add_argument(
        "--optimized_path",
        type=str,
        default="metagpt/ext/aflow/scripts/optimized",
        help="Optimized result save path",
    )
    parser.add_argument("--initial_round", type=int, default=1, help="Initial round")
    parser.add_argument("--max_rounds", type=int, default=20, help="Max iteration rounds")
    parser.add_argument("--check_convergence", type=bool, default=True, help="Whether to enable early stop")
    parser.add_argument("--validation_rounds", type=int, default=5, help="Validation rounds")
    parser.add_argument(
        "--if_first_optimize",
        type=lambda x: x.lower() == "true",
        default=True,
        help="Whether to download dataset for the first time",
    )
    parser.add_argument(
        "--opt_model_name",
        type=str,
        default="claude-3-5-sonnet-20240620",
        help="Specifies the name of the model used for optimization tasks.",
    )
    parser.add_argument(
        "--exec_model_name",
        type=str,
        default="gpt-4o-mini",
        help="Specifies the name of the model used for execution tasks.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    config = EXPERIMENT_CONFIGS[args.dataset]

    models_config = ModelsConfig.default()
    opt_llm_config = models_config.get(args.opt_model_name)
    if opt_llm_config is None:
        raise ValueError(
            f"The optimization model '{args.opt_model_name}' was not found in the 'models' section of the configuration file. "
            "Please add it to the configuration file or specify a valid model using the --opt_model_name flag. "
        )

    exec_llm_config = models_config.get(args.exec_model_name)
    if exec_llm_config is None:
        raise ValueError(
            f"The execution model '{args.exec_model_name}' was not found in the 'models' section of the configuration file. "
            "Please add it to the configuration file or specify a valid model using the --exec_model_name flag. "
        )

    download(["datasets", "initial_rounds"], if_first_download=args.if_first_optimize)

    optimizer = Optimizer(
        dataset=config.dataset,
        question_type=config.question_type,
        opt_llm_config=opt_llm_config,
        exec_llm_config=exec_llm_config,
        check_convergence=args.check_convergence,
        operators=config.operators,
        optimized_path=args.optimized_path,
        sample=args.sample,
        initial_round=args.initial_round,
        max_rounds=args.max_rounds,
        validation_rounds=args.validation_rounds,
    )

    # Optimize workflow via setting the optimizer's mode to 'Graph'
    optimizer.optimize("Graph")

    # Test workflow via setting the optimizer's mode to 'Test'
    # optimizer.optimize("Test")

```

### Core Architecture Module: `examples/agent_creator.py`
```
"""
Filename: MetaGPT/examples/agent_creator.py
Created Date: Tuesday, September 12th 2023, 3:28:37 pm
Author: garylin2099
"""
import re

from metagpt.actions import Action
from metagpt.config2 import config
from metagpt.const import METAGPT_ROOT
from metagpt.logs import logger
from metagpt.roles import Role
from metagpt.schema import Message

EXAMPLE_CODE_FILE = METAGPT_ROOT / "examples/build_customized_agent.py"
MULTI_ACTION_AGENT_CODE_EXAMPLE = EXAMPLE_CODE_FILE.read_text()


class CreateAgent(Action):
    PROMPT_TEMPLATE: str = """
    ### BACKGROUND
    You are using an agent framework called metagpt to write agents capable of different actions,
    the usage of metagpt can be illustrated by the following example:
    ### EXAMPLE STARTS AT THIS LINE
    {example}
    ### EXAMPLE ENDS AT THIS LINE
    ### TASK
    Now you should create an agent with appropriate actions based on the instruction, consider carefully about
    the PROMPT_TEMPLATE of all actions and when to call self._aask()
    ### INSTRUCTION
    {instruction}
    ### YOUR CODE
    Return ```python your_code_here ``` with NO other texts, your code:
    """

    async def run(self, example: str, instruction: str):
        prompt = self.PROMPT_TEMPLATE.format(example=example, instruction=instruction)
        # logger.info(prompt)

        rsp = await self._aask(prompt)

        code_text = CreateAgent.parse_code(rsp)

        return code_text

    @staticmethod
    def parse_code(rsp):
        pattern = r"```python(.*)```"
        match = re.search(pattern, rsp, re.DOTALL)
        code_text = match.group(1) if match else ""
        config.workspace.path.mkdir(parents=True, exist_ok=True)
        new_file = config.workspace.path / "agent_created_agent.py"
        new_file.write_text(code_text)
        return code_text


class AgentCreator(Role):
    name: str = "Matrix"
    profile: str = "AgentCreator"
    agent_template: str = MULTI_ACTION_AGENT_CODE_EXAMPLE

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_actions([CreateAgent])

    async def _act(self) -> Message:
        logger.info(f"{self._setting}: to do {self.rc.todo}({self.rc.todo.name})")
        todo = self.rc.todo
        msg = self.rc.memory.get()[-1]

        instruction = msg.content
        code_text = await CreateAgent().run(example=self.agent_template, instruction=instruction)
        msg = Message(content=code_text, role=self.profile, cause_by=todo)

        return msg


if __name__ == "__main__":
    import asyncio

    async def main():
        agent_template = MULTI_ACTION_AGENT_CODE_EXAMPLE

        creator = AgentCreator(agent_template=agent_template)

        msg = """
        Write an agent called SimpleTester that will take any code snippet (str) and do the following:
        1. write a testing code (str) for testing the given code snippet, save the testing code as a .py file in the current working directory;
        2. run the testing code.
        You can use pytest as the testing framework.
        """
        await creator.run(msg)

    asyncio.run(main())

```

### Core Architecture Module: `examples/android_assistant/run_assistant.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Desc   : the entry of android assistant including learning and acting stage
#           See the usage README inside `metagpt/ext/android_assistant`
#           README see `metagpt/ext/android_assistant/README.md`

import asyncio
from pathlib import Path

import typer

from metagpt.config2 import config
from metagpt.environment.android.android_env import AndroidEnv
from metagpt.ext.android_assistant.roles.android_assistant import AndroidAssistant
from metagpt.team import Team

app = typer.Typer(add_completion=False, pretty_exceptions_show_locals=False)


@app.command("", help="Run a Android Assistant")
def startup(
    task_desc: str = typer.Argument(help="the task description you want the android assistant to learn or act"),
    n_round: int = typer.Option(default=20, help="The max round to do an app operation task."),
    stage: str = typer.Option(default="learn", help="stage: learn / act"),
    mode: str = typer.Option(default="auto", help="mode: auto / manual , when state=learn"),
    app_name: str = typer.Option(default="demo", help="the name of app you want to run"),
    investment: float = typer.Option(default=5.0, help="Dollar amount to invest in the AI company."),
    refine_doc: bool = typer.Option(
        default=False, help="Refine existing operation docs based on the latest observation if True."
    ),
    min_dist: int = typer.Option(
        default=30, help="The minimum distance between elements to prevent overlapping during the labeling process."
    ),
    android_screenshot_dir: str = typer.Option(
        default="/sdcard/Pictures/Screenshots",
        help="The path to store screenshots on android device. Make sure it exists.",
    ),
    android_xml_dir: str = typer.Option(
        default="/sdcard",
        help="The path to store xml files for determining UI elements localtion. Make sure it exists.",
    ),
    device_id: str = typer.Option(default="emulator-5554", help="The Android device_id"),
):
    config.extra = {
        "stage": stage,
        "mode": mode,
        "app_name": app_name,
        "task_desc": task_desc,
        "refine_doc": refine_doc,
        "min_dist": min_dist,
        "android_screenshot_dir": android_screenshot_dir,
        "android_xml_dir": android_xml_dir,
        "device_id": device_id,
    }

    team = Team(
        env=AndroidEnv(
            device_id=device_id,
            xml_dir=Path(android_xml_dir),
            screenshot_dir=Path(android_screenshot_dir),
        )
    )

    team.hire([AndroidAssistant(output_root_dir=Path(__file__).parent)])
    team.invest(investment)
    team.run_project(idea=task_desc)
    asyncio.run(team.run(n_round=n_round))


if __name__ == "__main__":
    app()

```

### Core Architecture Module: `examples/cr.py`
```
import fire

from metagpt.roles.di.engineer2 import Engineer2
from metagpt.tools.libs.cr import CodeReview


async def main(msg):
    role = Engineer2(tools=["Plan", "Editor:write,read", "RoleZero", "ValidateAndRewriteCode", "CodeReview"])
    cr = CodeReview()
    role.tool_execution_map.update({"CodeReview.review": cr.review, "CodeReview.fix": cr.fix})
    await role.run(msg)


if __name__ == "__main__":
    fire.Fire(main)

```

### Core Architecture Module: `examples/dalle_gpt4v_agent.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Desc   : use gpt4v to improve prompt and draw image with dall-e-3

"""set `model: "gpt-4-vision-preview"` in `config2.yaml` first"""

import asyncio

from PIL import Image

from metagpt.actions.action import Action
from metagpt.logs import logger
from metagpt.roles.role import Role
from metagpt.schema import Message
from metagpt.utils.common import encode_image


class GenAndImproveImageAction(Action):
    save_image: bool = True

    async def generate_image(self, prompt: str) -> Image:
        imgs = await self.llm.gen_image(model="dall-e-3", prompt=prompt)
        return imgs[0]

    async def refine_prompt(self, old_prompt: str, image: Image) -> str:
        msg = (
            f"You are a creative painter, with the given generated image and old prompt: {old_prompt}, "
            f"please refine the prompt and generate new one. Just output the new prompt."
        )
        b64_img = encode_image(image)
        new_prompt = await self.llm.aask(msg=msg, images=[b64_img])
        return new_prompt

    async def evaluate_images(self, old_prompt: str, images: list[Image]) -> str:
        msg = (
            "With the prompt and two generated image, to judge if the second one is better than the first one. "
            "If so, just output True else output False"
        )
        b64_imgs = [encode_image(img) for img in images]
        res = await self.llm.aask(msg=msg, images=b64_imgs)
        return res

    async def run(self, messages: list[Message]) -> str:
        prompt = messages[-1].content

        old_img: Image = await self.generate_image(prompt)
        new_prompt = await self.refine_prompt(old_prompt=prompt, image=old_img)
        logger.info(f"original prompt: {prompt}")
        logger.info(f"refined prompt: {new_prompt}")
        new_img: Image = await self.generate_image(new_prompt)
        if self.save_image:
            old_img.save("./img_by-dall-e_old.png")
            new_img.save("./img_by-dall-e_new.png")
        res = await self.evaluate_images(old_prompt=prompt, images=[old_img, new_img])
        opinion = f"The second generated image is better than the first one: {res}"
        logger.info(f"evaluate opinion: {opinion}")
        return opinion


class Painter(Role):
    name: str = "MaLiang"
    profile: str = "Painter"
    goal: str = "to generate fine painting"

    def __init__(self, **data):
        super().__init__(**data)

        self.set_actions([GenAndImproveImageAction])


async def main():
    role = Painter()
    await role.run(with_message="a girl with flowers")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/debate.py`
```
"""
Filename: MetaGPT/examples/debate.py
Created Date: Tuesday, September 19th 2023, 6:52:25 pm
Author: garylin2099
@Modified By: mashenquan, 2023-11-1. In accordance with Chapter 2.1.3 of RFC 116, modify the data type of the `send_to`
        value of the `Message` object; modify the argument type of `get_by_actions`.
"""

import asyncio
import platform
from typing import Any

import fire

from metagpt.actions import Action, UserRequirement
from metagpt.logs import logger
from metagpt.roles import Role
from metagpt.schema import Message
from metagpt.team import Team


class SpeakAloud(Action):
    """Action: Speak out aloud in a debate (quarrel)"""

    PROMPT_TEMPLATE: str = """
    ## BACKGROUND
    Suppose you are {name}, you are in a debate with {opponent_name}.
    ## DEBATE HISTORY
    Previous rounds:
    {context}
    ## YOUR TURN
    Now it's your turn, you should closely respond to your opponent's latest argument, state your position, defend your arguments, and attack your opponent's arguments,
    craft a strong and emotional response in 80 words, in {name}'s rhetoric and viewpoints, your will argue:
    """
    name: str = "SpeakAloud"

    async def run(self, context: str, name: str, opponent_name: str):
        prompt = self.PROMPT_TEMPLATE.format(context=context, name=name, opponent_name=opponent_name)
        # logger.info(prompt)

        rsp = await self._aask(prompt)

        return rsp


class Debator(Role):
    name: str = ""
    profile: str = ""
    opponent_name: str = ""

    def __init__(self, **data: Any):
        super().__init__(**data)
        self.set_actions([SpeakAloud])
        self._watch([UserRequirement, SpeakAloud])

    async def _observe(self) -> int:
        await super()._observe()
        # accept messages sent (from opponent) to self, disregard own messages from the last round
        self.rc.news = [msg for msg in self.rc.news if msg.send_to == {self.name}]
        return len(self.rc.news)

    async def _act(self) -> Message:
        logger.info(f"{self._setting}: to do {self.rc.todo}({self.rc.todo.name})")
        todo = self.rc.todo  # An instance of SpeakAloud

        memories = self.get_memories()
        context = "\n".join(f"{msg.sent_from}: {msg.content}" for msg in memories)
        # print(context)

        rsp = await todo.run(context=context, name=self.name, opponent_name=self.opponent_name)

        msg = Message(
            content=rsp,
            role=self.profile,
            cause_by=type(todo),
            sent_from=self.name,
            send_to=self.opponent_name,
        )
        self.rc.memory.add(msg)

        return msg


async def debate(idea: str, investment: float = 3.0, n_round: int = 5):
    """Run a team of presidents and watch they quarrel. :)"""
    Biden = Debator(name="Biden", profile="Democrat", opponent_name="Trump")
    Trump = Debator(name="Trump", profile="Republican", opponent_name="Biden")
    team = Team()
    team.hire([Biden, Trump])
    team.invest(investment)
    team.run_project(idea, send_to="Biden")  # send debate topic to Biden and let him speak first
    await team.run(n_round=n_round)


def main(idea: str, investment: float = 3.0, n_round: int = 10):
    """
    :param idea: Debate topic, such as "Topic: The U.S. should commit more in climate change fighting"
                 or "Trump: Climate change is a hoax"
    :param investment: contribute a certain dollar amount to watch the debate
    :param n_round: maximum rounds of the debate
    :return:
    """
    if platform.system() == "Windows":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(debate(idea, investment, n_round))


if __name__ == "__main__":
    fire.Fire(main)  # run as python debate.py --idea="TOPIC" --investment=3.0 --n_round=5

```

### Core Architecture Module: `examples/debate_simple.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@Time    : 2023/12/22
@Author  : alexanderwu
@File    : debate_simple.py
"""
import asyncio

from metagpt.actions import Action
from metagpt.config2 import Config
from metagpt.environment import Environment
from metagpt.roles import Role
from metagpt.team import Team

gpt35 = Config.default()
gpt35.llm.model = "gpt-3.5-turbo"
gpt4 = Config.default()
gpt4.llm.model = "gpt-4-turbo"
action1 = Action(config=gpt4, name="AlexSay", instruction="Express your opinion with emotion and don't repeat it")
action2 = Action(config=gpt35, name="BobSay", instruction="Express your opinion with emotion and don't repeat it")
alex = Role(name="Alex", profile="Democratic candidate", goal="Win the election", actions=[action1], watch=[action2])
bob = Role(name="Bob", profile="Republican candidate", goal="Win the election", actions=[action2], watch=[action1])
env = Environment(desc="US election live broadcast")
team = Team(investment=10.0, env=env, roles=[alex, bob])

asyncio.run(team.run(idea="Topic: climate change. Under 80 words per message.", send_to="Alex", n_round=5))

```

### Core Architecture Module: `examples/di/InfiAgent-DABench/DABench.py`
```
import asyncio
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple, Union

import nest_asyncio

from examples.di.requirements_prompt import DABENCH
from metagpt.const import DABENCH_PATH
from metagpt.logs import logger
from metagpt.utils.exceptions import handle_exception


def evaluate_accuracy_by_question(results: dict) -> float:
    """
    Calculate the accuracy of results based on complete correctness of each question.
    This function is referenced from https://github.com/InfiAgent/InfiAgent/blob/main/examples/DA-Agent/eval_closed_form.py
    This function checks whether each result is entirely correct, meaning all sub-questions
    within that result are answered correctly. It computes the proportion of correct results
    by dividing the number of fully correct results by the total number of results.

    Args:
        results (dict): A collection of results where each result may contain a 'correctness' field.

    Returns:
        float: The proportion of correct results, rounded to four decimal places.
               Returns 0 if there are no results.
    """
    correct = sum("correctness" in result and all(result["correctness"].values()) for result in results)
    total = len(results)
    return round(correct / total, 4) if total > 0 else 0


def evaluate_accuracy_by_sub_question(results: dict) -> float:
    """
    Evaluate the correctness of all sub-questions across the results.
    This function is referenced from https://github.com/InfiAgent/InfiAgent/blob/main/examples/DA-Agent/eval_closed_form.py
    This function calculates the total number of correct sub-questions and the overall
    number of sub-questions present in all results. It returns the ratio of correct
    sub-questions to the total number of sub-questions.

    Args:
        results (dict): A collection of results where each result may contain a 'correctness' field.

    Returns:
        float: The ratio of correct sub-questions, rounded to four decimal places.
               Returns 0 if there are no sub-questions.
    """
    correct = sum(sum(result["correctness"].values()) for result in results if "correctness" in result)
    total = sum(len(result["correctness"]) for result in results if "correctness" in result)
    return round(correct / total, 4) if total > 0 else 0


def evaluate_accuracy_proportional_by_sub_question_adjusted(results: dict) -> float:
    """
    Adjust the score based on the number of sub-questions in each result.
    This function is referenced from https://github.com/InfiAgent/InfiAgent/blob/main/examples/DA-Agent/eval_closed_form.py
    This function calculates a score for each result by considering the number of sub-questions
    it contains. Each sub-question is assigned a score of 1 divided by the number of sub-questions.
    The total score for each result is computed as the sum of all correct sub-questions multiplied
    by the score per sub-question. Finally, it returns the average score across all results.

    Args:
        results (dict): A collection of results where each result may contain a 'correctness' field.

    Returns:
        float: The average score across all results, rounded to four decimal places.
               Returns 0 if there are no results.
    """
    total_score = 0
    for result in results:
        if "correctness" in result:
            sub_question_count = len(result["correctness"])
            score_per_sub_question = 1 / sub_question_count if sub_question_count > 0 else 0
            question_score = sum(result["correctness"].values()) * score_per_sub_question
            total_score += question_score
    return round(total_score / len(results), 4) if results else 0


async def reformat(question: str, format: str, response: str) -> str:
    """
    Asynchronously reformats a given response based on specified formatting requirements.
    This function is referenced from https://github.com/InfiAgent/InfiAgent/blob/main/examples/DA-Agent/reformat.py
    This function constructs a prompt for the LLM (Large Language Model) to reformat
    the provided response according to the specified format. It includes a system prompt
    to guide the LLM's behavior and a template that outlines the expected output structure.

    Args:
        question (str): The original question posed by the user.
        format (str): The specific formatting requirements that the response must adhere to.
        response (str): The initial response from the LLM that needs to be reformatted.

    Returns:
        str: The reformatted response generated by the LLM based on the provided question
             and formatting requirements.
    """
    system_prompt = "You are a helpful assistant."
    demons = """\Format{{
        @shapiro_wilk_statistic[test_statistic]
        @shapiro_wilk_p_value[p_value]
        where "test_statistic" is a number between 0 and 1 representing the Shapiro-Wilk test statistic. Rounding off the answer to two decimal places.
        where "p_value" is a number between 0 and 1 representing the p-value from the Shapiro-Wilk test. Rounding off the answer to four decimal places.
        }}
        \Answer{{
        @shapiro_wilk_statistic[0.56]
        @shapiro_wilk_p_value[0.0002]   
        }}

        \Format{{
        @total_votes_outliers_num[outlier_num]
        where "outlier_num" is an integer representing the number of values considered outliers in the 'total_votes' column.
        }}
        \Answer{{
        @total_votes_outliers[10]   
        }}
        """
    reformat_template = """You should strictly follow the output requirements in the Format part. Here're some examples: {demons}. 
    Your answer should contain all the \"@answer_name[answer]\" in the order mentioned, each \"answer\" should be in the range of value as required. You need to keep the original numbers and text, just reformat without making any changes.
    The format requirements of this question is:
    {format}. You need to keep the original numbers and text, just reformat without making any changes. Please give your answer:"""
    messages = [
        {"role": "user", "content": question},
        {"role": "assistant", "content": response},
        {"role": "user", "content": reformat_template.format(demons=demons, format=format)},
    ]
    rsp = await ask(messages, system_prompt)
    return rsp


def load_jsonl(file_path: Union[Path, str]) -> List[Dict[str, Any]]:
    """
    Load data from a JSONL file into a list of dictionaries.

    Args:
        file_path (Union[Path, str]): The path to the JSONL file to be loaded.

    Returns:
        List[Dict[str, Any]]: A list of dictionaries containing the data from the JSONL file.
    """
    # Convert file_path to Path if it's a string
    if isinstance(file_path, str):
        file_path = Path(file_path)

    data = []
    with open(file_path, "r", encoding="utf-8") as file:
        for line in file:
            data.append(json.loads(line))
    return data


def compare_predictions(pred_dict: dict, true_label: list) -> bool:
    """
    Compares each prediction against the corresponding true label.

    This function checks whether the predicted values match the true values for each
    metric. It sorts the true labels to ensure the comparison is made in the correct
    order. The function returns True if all predictions are accurate within a small
    tolerance for numerical values, or if string values match case-insensitively.

    Args:
        pred_dict (dict): A dictionary of predicted metrics and their values.
        true_label (list): A list of tuples containing true metrics and their values.

    Returns:
        bool: True if all predictions match the true labels, False otherwise.
    """
    sorted_true_label = sorted(true_label, key=lambda x: x[0])  # Sort true labels by metric name

    for metric, true_value in sorted_true_label:
        try:
            true_value = float(true_value)  # Attempt to convert the true value to flo
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

### Incident Patch 6: `feec34ca` (2025-03-10)
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

### Incident Patch 7: `de368d81` (2025-03-09)
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

### Incident Patch 8: `178ddaec` (2025-02-28)
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

### Incident Patch 9: `9e989af3` (2025-02-28)
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

### Incident Patch 10: `b2aac3eb` (2025-02-28)
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
