# Forensic Learning Record (Deep Inspection): om-ai-lab/OmAgent

> **Canonical Artifact**: `07_PROJECT_LEARNING/om-ai-lab-omagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/om-ai-lab/OmAgent](https://github.com/om-ai-lab/OmAgent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:10:34.099Z  
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

### Core Architecture Module: `examples/PoT/agent/input_interface/input_interface.py`
```
from pathlib import Path

from omagent_core.utils.registry import registry
from omagent_core.utils.general import read_image
from omagent_core.engine.worker.base import BaseWorker
from omagent_core.utils.logger import logging


CURRENT_PATH = Path(__file__).parents[0]


@registry.register_worker()
class PoTInputInterface(BaseWorker):
    """Input interface processor that handles user questions and example inputs.
    
    This processor manages the interactive input collection process for math problem solving:
    1. Collects a math word problem from the user
    2. Optionally collects example problems/solutions for few-shot learning
    3. Optionally collects multiple choice options if applicable
    4. Validates and formats all inputs appropriately
    5. Returns a structured dictionary containing the processed inputs
    
    The interface is designed to be flexible, allowing both basic question-only
    inputs as well as more complex scenarios with examples and multiple choice options.
    """

    def _run(self, *args, **kwargs):
        # Prompt user for the main math question and extract text content
        input = self.input.read_input(workflow_instance_id=self.workflow_instance_id, input_prompt='Please input a math related question:')
        content = input['messages'][-1]['content']
        for content_item in content:
            if content_item['type'] == 'text':
                query = content_item['data']
        
        # Collect optional example problems/solutions for few-shot learning
        # User can input "None" to skip this step
        input = self.input.read_input(workflow_instance_id=self.workflow_instance_id, input_prompt='Please input examples if you have, input "None" if you do not have:')
        content = input['messages'][-1]['content']
        for content_item in content:
            if content_item['type'] == 'text':
                examples = content_item['data']
        if examples == 'None':
            examples = None

        # Collect optional multiple choice options if this is a multiple choice question
        # User can input "None" for standard numerical answer questions
        input = self.input.read_input(workflow_instance_id=self.workflow_instance_id, input_prompt='Please input options if you are doing a multiple choice question, input "None" if you do not have:')
        content = input['messages'][-1]['content']
        for content_item in content:
            if content_item['type'] == 'text':
                options = content_item['data']
        if options == 'None':
            options = None
            
        # Return all collected inputs in a structured format
        inputs = {'query': query, 'examples': examples, 'options': options}
        logging.info(inputs)
        return inputs

```

### Core Architecture Module: `examples/PoT/compile_container.py`
```
# Import core modules and components
from omagent_core.utils.container import container

# Import workflow related modules
from pathlib import Path
from omagent_core.utils.registry import registry

# Set up path and import modules
CURRENT_PATH = root_path = Path(__file__).parents[0]
registry.import_module()

# Register required components
container.register_callback(callback='AppCallback')
container.register_input(input='AppInput')
# Compile container config
container.compile_config(CURRENT_PATH)




```

### Core Architecture Module: `examples/PoT/eval_aqua_zeroshot.py`
```
# Import required modules and components
import os
os.environ["OMAGENT_MODE"] = "lite"

from omagent_core.utils.container import container
from omagent_core.engine.workflow.conductor_workflow import ConductorWorkflow
from omagent_core.advanced_components.workflow.pot.workflow import PoTWorkflow
from pathlib import Path
from omagent_core.utils.registry import registry
from omagent_core.clients.devices.programmatic import ProgrammaticClient
from omagent_core.utils.logger import logging
import argparse
import json
import os


def parse_args():
    """Parse command line arguments for AQUA evaluation"""
    parser = argparse.ArgumentParser(description='Evaluate AQUA dataset using Program of Thought')
    parser.add_argument('--endpoint', type=str, default="https://api.openai.com/v1",
                        help='OpenAI API endpoint')
    parser.add_argument('--api_key', type=str, default=None,
                        help='OpenAI API key')
    parser.add_argument('--model_id', type=str, default="gpt-3.5-turbo",
                        help='Model ID to use')
    parser.add_argument('--dataset_path', type=str, default="aqua_test.jsonl",
                        help='Path to dataset')
    parser.add_argument('--output_path', type=str, default='output',
                        help='Path to output file. If not provided, will use default')
    return parser.parse_args()

def main():
    """Main function to run AQUA evaluation"""
    # Parse command line arguments
    args = parse_args()

    # Set environment variables for API
    os.environ["custom_openai_endpoint"] = args.endpoint
    os.environ["custom_openai_key"] = args.api_key
    os.environ["model_id"] = args.model_id

    # Load dataset and setup variables
    dataset_path = args.dataset_path
    model_id = args.model_id
    dataset_name = 'aqua'

    # Read dataset from JSONL file
    datasets = []
    with open(dataset_path, 'r') as f:
        for line in f:
            datasets.append(json.loads(line))

    # Setup logging and paths
    logging.init_logger("omagent", "omagent", level="INFO")
    CURRENT_PATH = Path(__file__).parents[0]
    container.register_stm("SharedMemSTM")

    # Initialize agent modules and configuration
    registry.import_module(project_path=CURRENT_PATH.joinpath('agent'))
    container.from_config(CURRENT_PATH.joinpath('container.yaml'))

    # Setup Program of Thought workflow
    workflow = ConductorWorkflow(name='PoT')
    pot_workflow = PoTWorkflow()
    pot_workflow.set_input(query=workflow.input('query'), examples=workflow.input('examples'), options=workflow.input('options'))
    workflow >> pot_workflow
    workflow.register(overwrite=True)

    # Initialize programmatic client
    config_path = CURRENT_PATH.joinpath('configs')
    programmatic_client = ProgrammaticClient(processor=workflow, config_path=config_path)

    # Prepare batch processing inputs
    output_json = []
    workflow_input_list = []
    for question in datasets:
        workflow_input_list.append({
            "id": question['id'],
            "query": question['question'],
            "examples": None,
            "options": str(question['options'])
        })

    # Process questions in batches
    res = programmatic_client.start_batch_processor(workflow_input_list=workflow_input_list, max_tasks=5)

    # Collect results
    for r, w in zip(res, workflow_input_list):
        output_json.append({
            "id": w['id'],
            "question": w['query']+'\nOptions: '+str(question['options']),
            "last_output": r['last_output'],
            "prompt_tokens": r['prompt_tokens'],
            "completion_tokens": r['completion_tokens']
        })

    # Prepare final output
    final_output = {
        "dataset_name": dataset_name,
        "model_id": model_id,
        "alg": "POT",
        "model_result": output_json
    }

    # Save results to output file
    if not os.path.exists(args.output_path):
        os.makedirs(args.output_path)
    with open(f'{args.output_path}/{dataset_name}_{model_id.replace("/","-")}_POT_output.json', 'w') as f:
        json.dump(final_output, f, indent=4)

    # Cleanup
    programmatic_client.stop_processor()

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/PoT/eval_gsm8k_fewshot.py`
```
import os
os.environ["OMAGENT_MODE"] = "lite"

# Import required modules and components
from omagent_core.utils.container import container
from omagent_core.engine.workflow.conductor_workflow import ConductorWorkflow
from omagent_core.advanced_components.workflow.pot.workflow import PoTWorkflow
from pathlib import Path
from omagent_core.utils.registry import registry
from omagent_core.clients.devices.programmatic import ProgrammaticClient
from omagent_core.utils.logger import logging
import argparse
import json
import os


def parse_args():
    """Parse command line arguments for GSM8K evaluation"""
    parser = argparse.ArgumentParser(description='Evaluate GSM8K dataset using Program of Thought')
    parser.add_argument('--endpoint', type=str, default="https://api.openai.com/v1",
                        help='OpenAI API endpoint')
    parser.add_argument('--api_key', type=str, default=None,
                        help='OpenAI API key')
    parser.add_argument('--model_id', type=str, default="gpt-3.5-turbo",
                        help='Model ID to use')
    parser.add_argument('--dataset_path', type=str, default="gsm8k_test.jsonl",
                        help='Path to dataset')
    parser.add_argument('--examples', type=str, default=None,
                        help='Path to examples file. If not provided, will use default examples')
    parser.add_argument('--output_path', type=str, default='output',
                        help='Path to output file. If not provided, will use default')
    return parser.parse_args()

def main():
    """Main function to run GSM8K evaluation"""
    # Parse command line arguments
    args = parse_args()

    # Set environment variables for OpenAI API
    os.environ["custom_openai_endpoint"] = args.endpoint
    os.environ["custom_openai_key"] = args.api_key
    os.environ["model_id"] = args.model_id

    # Load examples for few-shot learning
    if args.examples:
        with open(args.examples) as f:
            ex = f.read()
    else:
        # Default examples if none provided - contains simple arithmetic problems
        ex = '''
Question: There are 15 trees in the grove. Grove workers will plant trees in the grove today. After they are done, there will be 21 trees. How many trees did the grove workers plant today?
# Python code, return ans
total_trees = 15
after_planted_trees = 21
ans = after_planted_trees - total_trees

Question: If there are 3 cars in the parking lot and 2 more cars arrive, how many cars are in the parking lot?
# Python code, return ans
total_cars = 3
more_arrived_cars = 2
ans = total_cars + more_arrived_cars

Question: Leah had 32 chocolates and her sister had 42. If they ate 35, how many pieces do they have left in total?
# Python code, return ans
num_of_Leah_chocolates = 32
num_of_sister_chocolates = 42
total_chocolates = num_of_Leah_chocolates + num_of_sister_chocolates
eaten_chocolates = 35
ans = total_chocolates - eaten_chocolates

Question: Jason had 20 lollipops. He gave Denny some lollipops. Now Jason has 12 lollipops. How many lollipops did Jason give to Denny?
# Python code, return ans
num_of_Jason_lollipops = 20
num_of_given_lollipops = 12
ans = num_of_Jason_lollipops - num_of_given_lollipops

Question: Shawn has five toys. For Christmas, he got two toys each from his mom and dad. How many toys does he have now?
# Python code, return ans
num_of_Shawn_toys = 5
num_of_toys_from_mom = 2
num_of_toys_from_dad = 2
ans = num_of_Shawn_toys + num_of_toys_from_mom + num_of_toys_from_dad

Question: There were nine computers in the server room. Five more computers were installed each day, from monday to thursday. How many computers are now in the server room?
# Python code, return ans
num_of_computers_in_server_room = 9
num_of_computers_installed_each_day = 5
num_of_days = 4
ans = num_of_computers_in_server_room + num_of_computers_installed_each_day * num_of_days

Question: Michael had 58 golf balls. On tuesday, he lost 23 golf balls. On wednesday, he lost 2 more. How many golf balls did he have at the end of wednesday?
# Python code, return ans
num_of_Michael_golf_balls = 58
num_of_golf_balls_lost_on_tuesday = 23
num_of_golf_balls_lost_on_wednesday = 2
ans = num_of_Michael_golf_balls - num_of_golf_balls_lost_on_tuesday - num_of_golf_balls_lost_on_wednesday

Question: Olivia has $23. She bought five bagels for $3 each. How much money does she have left?
# Python code, return ans
num_of_Olivia_money = 23
num_of_bagels = 5
cost_of_each_bagel = 3
ans = num_of_Olivia_money - num_of_bagels * cost_of_each_bagel
'''

    # Load dataset and setup variables
    dataset_path = args.dataset_path
    model_id = args.model_id
    dataset_name = 'gsm8k'

    # Read dataset from JSONL file
    datasets = []
    with open(dataset_path, 'r') as f:
        for line in f:
            datasets.append(json.loads(line))

    # Setup logging and paths
    logging.init_logger("omagent", "omagent", level="INFO")
    CURRENT_PATH = Path(__file__).parents[0]
    container.register_stm("SharedMemSTM")

    # Initialize agent modules and configuration
    registry.import_module(project_path=CURRENT_PATH.joinpath('agent'))
    container.from_config(CURRENT_PATH.joinpath('container.yaml'))

    # Setup Program of Thought workflow
    workflow = ConductorWorkflow(name='PoT')
    pot_workflow = PoTWorkflow()
    pot_workflow.set_input(query=workflow.input('query'), examples=workflow.input('examples'))
    workflow >> pot_workflow
    workflow.register(overwrite=True)

    # Initialize programmatic client
    config_path = CURRENT_PATH.joinpath('configs')
    programmatic_client = ProgrammaticClient(processor=workflow, config_path=config_path)

    # Prepare batch processing inputs
    output_json = []
    workflow_input_list = []
    for question in datasets[:10]:
        workflow_input_list.append({
            "id": question['id'], 
            "query": question['question'],
            "examples": ex
        })
    
    # Process questions in batches
    res = programmatic_client.start_batch_processor(workflow_input_list=workflow_input_list, max_tasks=5)
    
    # Collect results
    for r, w in zip(res, workflow_input_list):
        output_json.append({
            "id": w['id'],
            "question": w['query'],
            "last_output": r['last_output'],
            "prompt_tokens": r['prompt_tokens'],
            "completion_tokens": r['completion_tokens']
        })
        
    # Prepare final output
    final_output = {
        "dataset_name": dataset_name,
        "model_id": model_id,
        "alg": "POT",
        "model_result": output_json
    }

    # Save results to output file
    if not os.path.exists(args.output_path):
        os.makedirs(args.output_path)
    with open(f'{args.output_path}/{dataset_name}_{model_id.replace("/","-")}_POT_output.json', 'w') as f:
        json.dump(final_output, f, indent=4)

    # Cleanup
    programmatic_client.stop_processor()

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/PoT/run_cli.py`
```
# Import core modules and components for the Program of Thought (PoT) workflow
import os
os.environ["OMAGENT_MODE"] = "lite"

from omagent_core.utils.container import container
from omagent_core.engine.workflow.conductor_workflow import ConductorWorkflow
from omagent_core.engine.workflow.task.simple_task import simple_task
from agent.input_interface.input_interface import PoTInputInterface
from omagent_core.advanced_components.workflow.pot.workflow import PoTWorkflow
from pathlib import Path
from omagent_core.utils.registry import registry
from omagent_core.clients.devices.cli import DefaultClient

from omagent_core.utils.logger import logging


# Initialize logging with INFO level
logging.init_logger("omagent", "omagent", level="INFO")

# Get the root directory path
CURRENT_PATH = Path(__file__).parents[0]

# Load custom agent modules from the project directory
registry.import_module(project_path=CURRENT_PATH.joinpath('agent'))

# Load container configuration from YAML file
container.from_config(CURRENT_PATH.joinpath('container.yaml'))


# Initialize the main Program of Thought workflow
workflow = ConductorWorkflow(name='PoT')

# Create input interface task to handle user interactions
client_input_task = simple_task(task_def_name=PoTInputInterface, task_reference_name='PoT_input_interface')

# Initialize PoT workflow and connect it with input task outputs
pot_workflow = PoTWorkflow()
pot_workflow.set_input(query=client_input_task.output('query'), examples=client_input_task.output('examples'), options=client_input_task.output('options'))

# Chain tasks together: Input Interface -> PoT Workflow
workflow >> client_input_task >> pot_workflow

# Register workflow with overwrite option enabled
workflow.register(overwrite=True)

# Initialize and start CLI client with configured workflow
config_path = CURRENT_PATH.joinpath('configs')
cli_client = DefaultClient(interactor=workflow, config_path=config_path, workers=[PoTInputInterface()])
cli_client.start_interactor()

```

### Core Architecture Module: `examples/PoT/run_programmatic.py`
```
# Import core modules and components for the Program of Thought (PoT) workflow
import os
os.environ["OMAGENT_MODE"] = "lite"

from omagent_core.utils.container import container
from omagent_core.engine.workflow.conductor_workflow import ConductorWorkflow
from omagent_core.advanced_components.workflow.pot.workflow import PoTWorkflow
from pathlib import Path
from omagent_core.utils.registry import registry
from omagent_core.clients.devices.programmatic import ProgrammaticClient
from omagent_core.utils.logger import logging


# Initialize logging with INFO level
logging.init_logger("omagent", "omagent", level="INFO")

# Get the root directory path
CURRENT_PATH = Path(__file__).parents[0]

# Load custom agent modules from the project directory
registry.import_module(project_path=CURRENT_PATH.joinpath('agent'))

container.register_stm("SharedMemSTM")

# Load container configuration from YAML file
container.from_config(CURRENT_PATH.joinpath('container.yaml'))


# Initialize the main Program of Thought workflow
workflow = ConductorWorkflow(name='PoT')
pot_workflow = PoTWorkflow()
pot_workflow.set_input(query=workflow.input('query'), examples=workflow.input('examples'))
workflow >> pot_workflow
workflow.register(overwrite=True)

# Initialize programmatic client
config_path = CURRENT_PATH.joinpath('configs')
programmatic_client = ProgrammaticClient(processor=workflow, config_path=config_path)

# Prepare batch processing inputs
workflow_input_list = [
    {"query": "Tom gets 4 car washes a month.  If each car wash costs $15 how much does he pay in a year?", "examples": None, "options": None}
]

# Process questions in batches
res = programmatic_client.start_batch_processor(workflow_input_list=workflow_input_list, max_tasks=5)

print(res)

# Cleanup
programmatic_client.stop_processor()
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
             shm = share
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
