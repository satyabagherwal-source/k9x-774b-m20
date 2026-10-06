# Forensic Learning Record (Deep Inspection): simular-ai/Agent-S

> **Canonical Artifact**: `07_PROJECT_LEARNING/simular-ai-agent-s-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/simular-ai/Agent-S](https://github.com/simular-ai/Agent-S))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:07:22.301Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `simular-ai/Agent-S`
- **Description**: Agent S: an open agentic framework that uses computers like a human
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12541 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `gui_agents/s1/core/AgentS.py`
```
import json
import logging
import os
from typing import Dict, List, Optional, Tuple
import platform

from gui_agents.s1.aci.ACI import ACI
from gui_agents.s1.core.Manager import Manager
from gui_agents.s1.core.Worker import Worker
from gui_agents.s1.utils.common_utils import Node
from gui_agents.utils import download_kb_data

logger = logging.getLogger("desktopenv.agent")


class UIAgent:
    """Base class for UI automation agents"""

    def __init__(
        self,
        engine_params: Dict,
        grounding_agent: ACI,
        platform: str = platform.system().lower(),
        action_space: str = "pyautogui",
        observation_type: str = "a11y_tree",
        search_engine: str = "perplexica",
    ):
        """Initialize UIAgent

        Args:
            engine_params: Configuration parameters for the LLM engine
            grounding_agent: Instance of ACI class for UI interaction
            platform: Operating system platform (macos, linux, windows)
            action_space: Type of action space to use (pyautogui, aci)
            observation_type: Type of observations to use (a11y_tree, mixed)
            engine: Search engine to use (perplexica, LLM)
        """
        self.engine_params = engine_params
        self.grounding_agent = grounding_agent
        self.platform = platform
        self.action_space = action_space
        self.observation_type = observation_type
        self.engine = search_engine

    def reset(self) -> None:
        """Reset agent state"""
        pass

    def predict(self, instruction: str, observation: Dict) -> Tuple[Dict, List[str]]:
        """Generate next action prediction

        Args:
            instruction: Natural language instruction
            observation: Current UI state observation

        Returns:
            Tuple containing agent info dictionary and list of actions
        """
        pass

    def update_narrative_memory(self, trajectory: str) -> None:
        """Update narrative memory with task trajectory

        Args:
            trajectory: String containing task execution trajectory
        """
        pass

    def update_episodic_memory(self, meta_data: Dict, subtask_trajectory: str) -> str:
        """Update episodic memory with subtask trajectory

        Args:
            meta_data: Metadata about current subtask execution
            subtask_trajectory: String containing subtask execution trajectory

        Returns:
            Updated subtask trajectory
        """
        pass


class GraphSearchAgent(UIAgent):
    """Agent that uses hierarchical planning and directed acyclic graph modeling for UI automation"""

    def __init__(
        self,
        engine_params: Dict,
        grounding_agent: ACI,
        platform: str = platform.system().lower(),
        action_space: str = "pyatuogui",
        observation_type: str = "mixed",
        search_engine: Optional[str] = None,
        memory_root_path: str = os.getcwd(),
        memory_folder_name: str = "kb_s1",
        kb_release_tag: str = "v0.2.2",
    ):
        """Initialize GraphSearchAgent

        Args:
            engine_params: Configuration parameters for the LLM engine
            grounding_agent: Instance of ACI class for UI interaction
            platform: Operating system platform (macos, ubuntu)
            action_space: Type of action space to use (pyautogui, other)
            observation_type: Type of observations to use (a11y_tree, screenshot, mixed)
            search_engine: Search engine to use (LLM, perplexica)
            memory_root_path: Path to memory directory. Defaults to current working directory.
            memory_folder_name: Name of memory folder. Defaults to "kb_s2".
            kb_release_tag: Release tag for knowledge base. Defaults to "v0.2.2".
        """
        super().__init__(
            engine_params,
            grounding_agent,
            platform,
            action_space,
            observation_type,
            search_engine,
        )

        self.memory_root_path = memory_root_path
        self.memory_folder_name = memory_folder_name
        self.kb_release_tag = kb_release_tag

        # Initialize agent's knowledge base on user's current working directory.
        print("Downloading knowledge base initial Agent-S knowledge...")
        self.local_kb_path = os.path.join(
            self.memory_root_path, self.memory_folder_name
        )

        if not os.path.exists(self.local_kb_path):
            download_kb_data(
                version="s1",
                release_tag=kb_release_tag,
                download_dir=self.local_kb_path,
                platform=self.platform,
            )
            print(
                f"Successfully completed download of knowledge base for version s1, tag {self.kb_release_tag}, platform {self.platform}."
            )
        else:
            print(
                f"Path local_kb_path {self.local_kb_path} already exists. Skipping download."
            )
            print(
                f"If you'd like to re-download the initial knowledge base, please delete the existing knowledge base at {self.local_kb_path}."
            )
            print(
                "Note, the knowledge is continually updated during inference. Deleting the knowledge base will wipe out all experience gained since the last knowledge base download."
            )

        self.reset()

    def reset(self) -> None:
        """Reset agent state and initialize components"""
        # Initialize core components
        self.planner = Manager(
            self.engine_params,
            self.grounding_agent,
            platform=self.platform,
            search_engine=self.engine,
            local_kb_path=self.local_kb_path,
        )
        self.executor = Worker(
            self.engine_params,
            self.grounding_agent,
            platform=self.platform,
            local_kb_path=self.local_kb_path,
        )

        # Reset state variables
        self.requires_replan: bool = True
        self.needs_next_subtask: bool = True
        self.step_count: int = 0
        self.turn_count: int = 0
        self.failure_feedback: str = ""
        self.should_send_action: bool = False
        self.completed_tasks: List[Node] = []
        self.current_subtask: Optional[Node] = None
        self.subtasks: List[Node] = []
        self.search_query: str = ""
        self.subtask_status: str = "Start"

    def reset_executor_state(self) -> None:
        """Reset executor and step counter"""
        self.executor.reset()
        self.step_count = 0

    def predict(self, instruction: str, observation: Dict) -> Tuple[Dict, List[str]]:
        """Predict next UI action sequence

        Args:
            instruction: Natural language instruction
            observation: Current UI state observation Dictionary {"accessibility_tree": str, "screenshot": bytes}
            info: Dictionary containing additional information.

        Returns:
            Tuple of (agent info dict, list of actions)
        """
        # Initialize the three info dictionaries
        planner_info = {}
        executor_info = {}
        evaluator_info = {
            "obs_evaluator_response": "",
            "num_input_tokens_evaluator": 0,
            "num_output_tokens_evaluator": 0,
            "evaluator_cost": 0.0,
        }
        actions = []

        # If the DONE response by the executor is for a subtask, then the agent should continue with the next subtask without sending the action to the environment
        while not self.should_send_action:
            self.subtask_status = "In"
            # if replan is true, generate a new plan. True at start, then true again after a failed plan
            if self.requires_replan:
                logger.info("(RE)PLANNING...")
                # failure feedback is the reason for the failure of the previous plan
                planner_info, self.subtasks = self.planner.get_action_queue(
                    instruction=instruction,
                    observation=observation,
                    failure_feedback=self.failure_feedback,
                )

                self.requires_replan = False
                if "search_query" in planner_info:
                    self.search_query = planner_info["search_query"]
                else:
                    self.search_query = ""

            # use the exectuor to complete the topmost subtask
            if self.needs_next_subtask:
                logger.info("GETTING NEXT SUBTASK...")
                self.current_subtask = self.subtasks.pop(0)
                logger.info(f"NEXT SUBTASK: {self.current_subtask}")
                self.needs_next_subtask = False
                self.subtask_status = "Start"

            # get the next action from the executor
            executor_info, actions = self.executor.generate_next_action(
                instruction=instruction,
                search_query=self.search_query,
                subtask=self.current_subtask.name,
                subtask_info=self.current_subtask.info,
                future_tasks=self.subtasks,
                done_task=self.completed_tasks,
                obs=observation,
            )

            self.step_count += 1

            # set the should_send_action flag to True if the executor returns an action
            self.should_send_action = True
            if "FAIL" in actions:
                self.requires_replan = True
                # set the failure feedback to the evaluator feedback
                self.failure_feedback = f"Completed subtasks: {self.completed_tasks}. The subtask {self.current_subtask} cannot be completed. Please try another approach. {executor_info['plan_code']}. Please replan."
                self.needs_next_subtask = True

                # reset the step count, executor, and evaluator
                self.reset_executor_state()

                # if more subtasks are remaining, we don't want to send DONE to the environment but move on t
```

### Core Architecture Module: `gui_agents/s1/core/BaseModule.py`
```
from typing import Dict, Optional

from gui_agents.s1.mllm.MultimodalAgent import LMMAgent


class BaseModule:
    def __init__(self, engine_params: Dict, platform: str):
        self.engine_params = engine_params
        self.platform = platform

    def _create_agent(
        self, system_prompt: str = None, engine_params: Optional[Dict] = None
    ) -> LMMAgent:
        """Create a new LMMAgent instance"""
        agent = LMMAgent(engine_params or self.engine_params)
        if system_prompt:
            agent.add_system_prompt(system_prompt)
        return agent

```

### Core Architecture Module: `gui_agents/s1/core/Knowledge.py`
```
import json
import os
from typing import Dict, Tuple

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from gui_agents.s1.core.BaseModule import BaseModule
from gui_agents.s1.core.ProceduralMemory import PROCEDURAL_MEMORY
from gui_agents.s1.mllm.MultimodalEngine import OpenAIEmbeddingEngine
from gui_agents.s1.utils.common_utils import (
    load_embeddings,
    load_knowledge_base,
    save_embeddings,
)
from gui_agents.s1.utils.query_perplexica import query_to_perplexica


class KnowledgeBase(BaseModule):
    def __init__(
        self,
        local_kb_path: str,
        platform: str,
        engine_params: Dict,
        use_image_for_search: bool = False,
    ):
        super().__init__(engine_params, platform)

        self.local_kb_path = local_kb_path

        # initialize embedding engine
        # TODO: Support other embedding engines
        self.embedding_engine = OpenAIEmbeddingEngine(
            api_key=(
                engine_params["api_key"]
                if "api_key" in engine_params
                else os.getenv("OPENAI_API_KEY")
            )
        )

        # Initialize paths for different memory types
        self.episodic_memory_path = os.path.join(
            self.local_kb_path, self.platform, "episodic_memory.json"
        )
        self.narrative_memory_path = os.path.join(
            self.local_kb_path, self.platform, "narrative_memory.json"
        )
        self.embeddings_path = os.path.join(
            self.local_kb_path, self.platform, "embeddings.pkl"
        )

        self.rag_module_system_prompt = PROCEDURAL_MEMORY.RAG_AGENT.replace(
            "CURRENT_OS", self.platform
        )

        # All three agent share a generic RAG prompt that ask agent to provide information for UI automation in CURRENT_OS
        self.query_formulator = self._create_agent(self.rag_module_system_prompt)
        self.llm_search_agent = self._create_agent(self.rag_module_system_prompt)
        self.knowledge_fusion_agent = self._create_agent(self.rag_module_system_prompt)

        self.use_image_for_search = use_image_for_search

    def retrieve_knowledge(
        self, instruction: str, search_query: str, search_engine: str = "llm"
    ) -> Tuple[str, str]:
        """Retrieve knowledge using search engine
        Args:
            instruction (str): task instruction
            observation (Dict): current observation
            search_engine (str): search engine to use"""

        # Use search engine to retrieve knowledge based on the formulated query
        search_results = self._search(instruction, search_query, search_engine)

        return search_query, search_results

    def formulate_query(self, instruction: str, observation: Dict) -> str:
        """Formulate search query based on instruction and current state"""
        query_path = os.path.join(
            self.local_kb_path, self.platform, "formulate_query.json"
        )
        try:
            with open(query_path, "r") as f:
                formulate_query = json.load(f)
        except:
            formulate_query = {}

        if instruction in formulate_query:
            return formulate_query[instruction]

        self.query_formulator.add_message(
            f"The task is: {instruction}\n"
            f"Accessibility tree of the current desktop UI state: {observation['linearized_accessibility_tree']}\n"
            "To use google search to get some useful information, first carefully analyze "
            "the accessibility tree of the current desktop UI state, then given the task "
            "instruction, formulate a question that can be used to search on the Internet "
            "for information in helping with the task execution.\n"
            "The question should not be too general or too specific. Please ONLY provide "
            "the question.\nQuestion:",
            image_content=(
                observation["screenshot"]
                if self.use_image_for_search and "screenshot" in observation
                else None
            ),
        )

        search_query = self.query_formulator.get_response().strip().replace('"', "")
        print("search query: ", search_query)
        formulate_query[instruction] = search_query
        with open(query_path, "w") as f:
            json.dump(formulate_query, f, indent=2)

        return search_query

    def _search(self, instruction: str, search_query: str, search_engine: str) -> str:
        """Execute search using specified engine"""

        # Default to perplexica rag knowledge to see if the query exists
        file = os.path.join(
            self.local_kb_path, self.platform, f"{search_engine}_rag_knowledge.json"
        )

        try:
            with open(file, "r") as f:
                exist_search_results = json.load(f)
        except:
            exist_search_results = {}

        if instruction in exist_search_results:
            return exist_search_results[instruction]
        if search_engine.lower() == "llm":
            # Use LLM's internal knowledge like a search engine
            self.llm_search_agent.add_message(search_query)
            search_results = self.llm_search_agent.get_response()
        elif search_engine.lower() == "perplexica":
            # Use perplexica to search for the query
            search_results = query_to_perplexica(search_query)
        else:
            raise ValueError(f"Unsupported search engine: {search_engine}")

        exist_search_results[instruction] = search_results.strip()
        with open(
            os.path.join(
                self.local_kb_path,
                self.platform,
                f"{search_engine}_rag_knowledge.json",
            ),
            "w",
        ) as f:
            json.dump(exist_search_results, f, indent=2)

        return search_results

    def retrieve_narrative_experience(self, instruction: str) -> Tuple[str, str]:
        """Retrieve narrative experience using embeddings"""
        knowledge_base = load_knowledge_base(self.narrative_memory_path)
        if not knowledge_base:
            return "None", "None"

        embeddings = load_embeddings(self.embeddings_path)

        # Get or create instruction embedding
        instruction_embedding = embeddings.get(instruction)

        if instruction_embedding is None:
            instruction_embedding = self.embedding_engine.get_embeddings(instruction)
            embeddings[instruction] = instruction_embedding

        # Get or create embeddings for knowledge base entries
        candidate_embeddings = []
        for key in knowledge_base:
            candidate_embedding = embeddings.get(key)
            if candidate_embedding is None:
                candidate_embedding = self.embedding_engine.get_embeddings(key)
                embeddings[key] = candidate_embedding

            candidate_embeddings.append(candidate_embedding)

        save_embeddings(self.embeddings_path, embeddings)

        similarities = cosine_similarity(
            instruction_embedding, np.vstack(candidate_embeddings)
        )[0]
        sorted_indices = np.argsort(similarities)[::-1]

        keys = list(knowledge_base.keys())
        idx = 1 if keys[sorted_indices[0]] == instruction else 0
        return keys[sorted_indices[idx]], knowledge_base[keys[sorted_indices[idx]]]

    def retrieve_episodic_experience(self, instruction: str) -> Tuple[str, str]:
        """Retrieve similar task experience using embeddings"""
        knowledge_base = load_knowledge_base(self.episodic_memory_path)
        if not knowledge_base:
            return "None", "None"

        embeddings = load_embeddings(self.embeddings_path)

        # Get or create instruction embedding
        instruction_embedding = embeddings.get(instruction)

        if instruction_embedding is None:
            instruction_embedding = self.embedding_engine.get_embeddings(instruction)
            embeddings[instruction] = instruction_embedding

        # Get or create embeddings for knowledge base entries
        candidate_embeddings = []
        for key in knowledge_base:
            candidate_embedding = embeddings.get(key)
            if candidate_embedding is None:
                candidate_embedding = self.embedding_engine.get_embeddings(key)
                embeddings[key] = candidate_embedding

            candidate_embeddings.append(candidate_embedding)

        save_embeddings(self.embeddings_path, embeddings)

        similarities = cosine_similarity(
            instruction_embedding, np.vstack(candidate_embeddings)
        )[0]
        sorted_indices = np.argsort(similarities)[::-1]

        keys = list(knowledge_base.keys())
        idx = 1 if keys[sorted_indices[0]] == instruction else 0
        return keys[sorted_indices[idx]], knowledge_base[keys[sorted_indices[idx]]]

    def knowledge_fusion(
        self,
        observation: Dict,
        instruction: str,
        web_knowledge: str,
        similar_task: str,
        experience: str,
    ) -> str:
        """Combine web knowledge with similar task experience"""
        self.knowledge_fusion_agent.add_message(
            f"Task: {instruction}\n"
            f"Accessibility tree of the current desktop UI state: {observation['linearized_accessibility_tree']}\n"
            f"**Web search result**:\n{web_knowledge}\n\n"
            f"**Retrieved similar task experience**:\n"
            f"Similar task:{similar_task}\n{experience}\n\n"
            f"Based on the web search result and the retrieved similar task experience, "
            f"if you think the similar task experience is indeed useful to the main task, "
            f"integrate it with the web search result. Provide the final knowledge in a numbered list.",
            image_content=(
                observation["screenshot"]
                if self.use_image_for_search and "screenshot" in observation
                else None
            ),
        )
        return self.knowledge_fusion_agent.get_response()

```

### Core Architecture Module: `gui_agents/s1/core/Manager.py`
```
import logging
from collections import defaultdict
from typing import Dict, List, Optional, Tuple
import platform

from gui_agents.s1.aci.ACI import ACI
from gui_agents.s1.core.BaseModule import BaseModule
from gui_agents.s1.core.Knowledge import KnowledgeBase
from gui_agents.s1.core.ProceduralMemory import PROCEDURAL_MEMORY
from gui_agents.s1.utils.common_utils import (
    Dag,
    Node,
    calculate_tokens,
    call_llm_safe,
    parse_dag,
)

logger = logging.getLogger("desktopenv.agent")

NUM_IMAGE_TOKEN = 1105  # Value set of screen of size 1920x1080 for openai vision


class Manager(BaseModule):
    def __init__(
        self,
        engine_params: Dict,
        grounding_agent: ACI,
        local_kb_path: str,
        search_engine: Optional[str] = None,
        multi_round: bool = False,
        platform: str = platform.system().lower(),
    ):
        # TODO: move the prompt to Procedural Memory
        super().__init__(engine_params, platform)

        # Initialize the ACI
        self.grounding_agent = grounding_agent

        # Initialize the submodules of the Manager
        self.generator_agent = self._create_agent(PROCEDURAL_MEMORY.MANAGER_PROMPT)
        self.dag_translator_agent = self._create_agent(
            PROCEDURAL_MEMORY.DAG_TRANSLATOR_PROMPT
        )
        self.narrative_summarization_agent = self._create_agent(
            PROCEDURAL_MEMORY.TASK_SUMMARIZATION_PROMPT
        )
        self.episode_summarization_agent = self._create_agent(
            PROCEDURAL_MEMORY.SUBTASK_SUMMARIZATION_PROMPT
        )

        self.local_kb_path = local_kb_path

        self.knowledge_base = KnowledgeBase(self.local_kb_path, platform, engine_params)

        self.planner_history = []

        self.turn_count = 0
        self.search_engine = search_engine
        self.multi_round = multi_round
        self.platform = platform

    def summarize_episode(self, trajectory):
        """Summarize the episode experience for lifelong learning reflection
        Args:
            trajectory: str: The episode experience to be summarized
        """

        # Create Reflection on whole trajectories for next round trial, keep earlier messages as exemplars
        self.episode_summarization_agent.add_message(trajectory)
        subtask_summarization = call_llm_safe(self.episode_summarization_agent)
        self.episode_summarization_agent.add_message(subtask_summarization)

        return subtask_summarization

    def summarize_narrative(self, trajectory):
        """Summarize the narrative experience for lifelong learning reflection
        Args:
            trajectory: str: The narrative experience to be summarized
        """
        # Create Reflection on whole trajectories for next round trial
        self.narrative_summarization_agent.add_message(trajectory)
        lifelong_learning_reflection = call_llm_safe(self.narrative_summarization_agent)

        return lifelong_learning_reflection

    def _generate_step_by_step_plan(
        self, observation: Dict, instruction: str, failure_feedback: str = ""
    ) -> Tuple[Dict, str]:
        agent = self.grounding_agent

        self.active_apps = agent.get_active_apps(observation)

        tree_input = agent.linearize_and_annotate_tree(observation)
        observation["linearized_accessibility_tree"] = tree_input

        # Perform Retrieval only at the first planning step
        if self.turn_count == 0:

            self.search_query = self.knowledge_base.formulate_query(
                instruction, observation
            )

            retrieved_experience = ""
            integrated_knowledge = ""
            # Retrieve most similar narrative (task) experience
            most_similar_task, retrieved_experience = (
                self.knowledge_base.retrieve_narrative_experience(instruction)
            )
            logger.info(
                "SIMILAR TASK EXPERIENCE: %s",
                most_similar_task + "\n" + retrieved_experience.strip(),
            )

            # Retrieve knowledge from the web if search_engine is provided
            if self.search_engine is not None:
                retrieved_knowledge = self.knowledge_base.retrieve_knowledge(
                    instruction=instruction,
                    search_query=self.search_query,
                    search_engine=self.search_engine,
                )
                logger.info("RETRIEVED KNOWLEDGE: %s", retrieved_knowledge)

                if retrieved_knowledge is not None:
                    # Fuse the retrieved knowledge and experience
                    integrated_knowledge = self.knowledge_base.knowledge_fusion(
                        observation=observation,
                        instruction=instruction,
                        web_knowledge=retrieved_knowledge,
                        similar_task=most_similar_task,
                        experience=retrieved_experience,
                    )
                    logger.info("INTEGRATED KNOWLEDGE: %s", integrated_knowledge)

            integrated_knowledge = integrated_knowledge or retrieved_experience

            # Add the integrated knowledge to the task instruction in the system prompt
            if integrated_knowledge:
                instruction += f"\nYou may refer to some retrieved knowledge if you think they are useful.{integrated_knowledge}"

            self.generator_agent.add_system_prompt(
                self.generator_agent.system_prompt.replace(
                    "TASK_DESCRIPTION", instruction
                )
            )

        generator_message = (
            f"Accessibility Tree: {tree_input}\n"
            f"The clipboard contains: {agent.clipboard}."
            f"The current open applications are {agent.get_active_apps(observation)}"
            + (
                f" Previous plan failed at step: {failure_feedback}"
                if failure_feedback
                else ""
            )
        )

        self.generator_agent.add_message(
            generator_message, image_content=observation.get("screenshot", None)
        )

        logger.info("GENERATING HIGH LEVEL PLAN")

        plan = call_llm_safe(self.generator_agent)

        if plan == "":
            raise Exception("Plan Generation Failed - Fix the Prompt")

        logger.info("HIGH LEVEL STEP BY STEP PLAN: %s", plan)

        self.generator_agent.add_message(plan)

        self.planner_history.append(plan)

        self.turn_count += 1

        input_tokens, output_tokens = calculate_tokens(self.generator_agent.messages)

        # Set Cost based on GPT-4o
        cost = input_tokens * (0.0050 / 1000) + output_tokens * (0.0150 / 1000)

        planner_info = {
            "search_query": self.search_query,
            "goal_plan": plan,
            "num_input_tokens_plan": input_tokens,
            "num_output_tokens_plan": output_tokens,
            "goal_plan_cost": cost,
        }

        assert type(plan) == str

        return planner_info, plan

    def _generate_dag(self, instruction: str, plan: str) -> Tuple[Dict, Dag]:
        # Add initial instruction and plan to the agent's message history
        self.dag_translator_agent.add_message(
            f"Instruction: {instruction}\nPlan: {plan}"
        )

        logger.info("GENERATING DAG")

        # Generate DAG
        dag_raw = call_llm_safe(self.dag_translator_agent)

        dag = parse_dag(dag_raw)

        logger.info("Generated DAG: %s", dag_raw)

        self.dag_translator_agent.add_message(dag_raw)

        input_tokens, output_tokens = calculate_tokens(
            self.dag_translator_agent.messages
        )

        # Set Cost based on GPT-4o
        cost = input_tokens * (0.0050 / 1000) + output_tokens * (0.0150 / 1000)

        dag_info = {
            "dag": dag_raw,
            "num_input_tokens_dag": input_tokens,
            "num_output_tokens_dag": output_tokens,
            "dag_cost": cost,
        }

        assert type(dag) == Dag

        return dag_info, dag

    def _topological_sort(self, dag: Dag) -> List[Node]:
        """Topological sort of the DAG using DFS
        dag: Dag: Object representation of the DAG with nodes and edges
        """

        def dfs(node_name, visited, stack):
            visited[node_name] = True
            for neighbor in adj_list[node_name]:
                if not visited[neighbor]:
                    dfs(neighbor, visited, stack)
            stack.append(node_name)

        # Convert edges to adjacency list
        adj_list = defaultdict(list)
        for u, v in dag.edges:
            adj_list[u.name].append(v.name)

        visited = {node.name: False for node in dag.nodes}
        stack = []

        for node in dag.nodes:
            if not visited[node.name]:
                dfs(node.name, visited, stack)

        # Return the nodes in topologically sorted order
        sorted_nodes = [
            next(n for n in dag.nodes if n.name == name) for name in stack[::-1]
        ]
        return sorted_nodes

    def get_action_queue(
        self,
        instruction: str,
        observation: Dict,
        failure_feedback: str = None,
    ):
        """Generate the action list based on the instruction
        instruction:str: Instruction for the task
        """
        # Generate the high level plan
        planner_info, plan = self._generate_step_by_step_plan(
            observation, instruction, failure_feedback
        )

        # Generate the DAG
        dag_info, dag = self._generate_dag(instruction, plan)

        # Topological sort of the DAG
        action_queue = self._topological_sort(dag)

        planner_info.update(dag_info)

        return planner_info, action_queue

```

### Core Architecture Module: `gui_agents/s1/core/ProceduralMemory.py`
```
import inspect
import textwrap


class PROCEDURAL_MEMORY:
    @staticmethod
    def construct_worker_procedural_memory(agent_class):
        procedural_memory = textwrap.dedent(f"""\
        You are an expert in graphical user interfaces and Python code. You are responsible for executing the current subtask: `SUBTASK_DESCRIPTION` of the larger goal: `TASK_DESCRIPTION`.
        IMPORTANT: ** The subtasks: ['DONE_TASKS'] have already been done. The future subtasks ['FUTURE_TASKS'] will be done in the future by me. You must only perform the current subtask: `SUBTASK_DESCRIPTION`. Do not try to do future subtasks. **
        You are working in CURRENT_OS. You must only complete the subtask provided and not the larger goal.
        You are provided with:
        1. A simplified accessibility tree of the UI at the current time step.
        2. A screenshot of the current time step.
        3. The history of your previous interactions with the UI.
        4. Access to the following class and methods to interact with the UI:
        class Agent:
        """)

        for attr_name in dir(agent_class):
            attr = getattr(agent_class, attr_name)
            if callable(attr) and hasattr(attr, "is_agent_action"):
                # Use inspect to get the full function signature
                signature = inspect.signature(attr)
                procedural_memory += f"""
    def {attr_name}{signature}:
    '''{attr.__doc__}'''
        """

        procedural_memory += textwrap.dedent("""
        Your response should be formatted like this:
        (Previous action verification)
        Carefully analyze based on the screenshot and the accessibility tree if the previous action was successful. If the previous action was not successful, provide a reason for the failure.

        (Screenshot Analysis)
        Closely examine and describe the current state of the desktop along with the currently open applications.

        (Next Action)
        Based on the current screenshot, the accessibility tree and the history of your previous interaction with the UI, decide on the next action in natural language to accomplish the given task.

        (Grounded Action)
        Translate the next action into code using the provided API methods. Format the code like this:
        ```python
        agent.click(123, 1, "left")
        ```
        Note for the code:
        1. Only perform one action at a time.
        2. Do not put anything other than python code in the block. You can only use one function call at a time. Do not put more than one function call in the block.
        3. You must use only the available methods provided above to interact with the UI, do not invent new methods.
        3. Only return one code block every time. There must be a single line of code in the code block.
        4. Please only use the available methods provided above to interact with the UI.
        5. If you think the task is already completed, you can return `agent.done()` in the code block.
        6. If you think the task cannot be completed, you can return `agent.fail()` in the code block.
        7. Do not do anything other than the exact specified task. Return with `agent.done()` immediately after the task is completed or `agent.fail()` if it cannot be completed.
        8. Whenever possible use hot-keys or typing rather than mouse clicks.
        9. My computer's password is 'password', feel free to use it when you need sudo rights
        """)
        return procedural_memory.strip()

    # MANAGER_PROMPT = """You are a planning agent for solving GUI navigation tasks. You will be provided the initial configuration of a system including accessibility, screenshot and other information. You need to solve the following task: TASK_DESCRIPTION. You will describe in as much detail as possible the steps required to complete the task by a GUI agent. Please do not include any verification steps in your plan that is not your responsibility. IMPORTANT: Your plan should be as concize as possible and should not include any unnecessary steps. Do not fine-tune, or embellish anything or cause any side effects. Generate the plan that can be accomplished in the shortest time. Please take the current state into account when generating the plan. Please provide the plan in a step-by-step format and make sure you do not include anything that's already done in the GUI in your plan."""

    # TODO: exploring this prompt
    MANAGER_PROMPT = """You are a planning agent for solving GUI navigation tasks. You will be provided the initial configuration of a system including accessibility, screenshot and other information. You need to solve the following task: TASK_DESCRIPTION. You will describe in as much detail as possible the steps required to complete the task by a GUI agent. Please do not include any verification steps in your plan that is not your responsibility. IMPORTANT: Your plan should be as concize as possible and should not include any unnecessary steps. Do not fine-tune, or embellish anything or cause any side effects. Generate the plan that can be accomplished in the shortest time. Please take the current state into account when generating the plan. Please provide the plan in a step-by-step format and make sure you do not include anything that's already done in the GUI in your plan. You don't need to arrange the steps in order just list out everything that needs to be done. You may follow a dependency structure. Note that the execution agent that will complete your plan can't actually see everything thats visible to you."""

    # NOTE: below prompt results in suboptimal initial plans
    # MANAGER_PROMPT = """You are an expert planning agent for GUI tasks. You will be provided with an initial state of the system including accessibility, screenshot and other information and the final state represented by the task: TASK_DESCRIPTION. Tell me everything that needs to be done in order to reach the goal state. You don't need to arrange the steps in order just list out everything that needs to be done. You may follow a dependency structure."""

    # USED IN OSWORLD EXPERIMENTS
    RAG_AGENT_OSWORLD = """
    Given a desktop computer task instruction, you are an agent which should provide useful information as requested, to help another agent follow the instruction and perform the task.
    The domain of the desktop computer task is from [CURRENT_OS, VLC, LibreOffice, Chrome, Thunderbird, VS Code, GIMP].
    The task is: TASK_DESCRIPTION
    The simplified accessibility tree of the current computer UI is: ACCESSIBLITY_TREE
    """

    RAG_AGENT = """
    Given a desktop computer task instruction, you are an agent which should provide useful information as requested, to help another agent follow the instruction and perform the task in CURRENT_OS.
    """

    # TODO: confirm this prompt
    REFLECTION_ON_TRAJECTORY = """
    You are a reflection agent designed to assist in task execution by analyzing a trajectory of task execution until this time step and providing feedback for the next step prediction.
    You have access to the Task Description and Current Trajectory, and the image for each step. The most recent image is what happened after the latest action in the trajectory.
    You should ONLY provide informative reflection feedback (potential mitigation alternatives) based on your expertise for the planning agent when you observe the abnormal trajectory (e.g., contain consecutive failures).
    Otherwise, let the agent continue to proceed as planned.
    Make sure to avoid providing any information about specific planning or actions and avoid generating repeated reflection feedbacks.
    Assume the grounded action is correct, do not judge about it.
    """

    TASK_SUMMARIZATION_PROMPT = """
    You are a summarization agent designed to analyze a trajectory of desktop task execution.
    You have access to the Task Description and Whole Trajectory including plan, verification and reflection at each step.
    Your summarized information will be referred to by another agent when performing the tasks.
    You should follow the below instructions:
    1. If the task is successfully executed, you should summarize the successful plan based on the whole trajectory to finish the task.
    2. Otherwise, provide the reasons why the task is failed and potential suggestions that may avoid this failure.

    **ATTENTION**
    1. Only extract the correct plan and do not provide redundant steps.
    2. Do not contain grounded actions in the plan.
    3. If there are the successfully used hot-keys, make sure to include them in the plan.
    4. The suggestions are for another agent not human, so they must be doable through the agent's action.
    5. Don't generate high-level suggestions (e.g., Implement Error Handling).
    """

    # DAG_TRANSLATOR_PROMPT = """You are a plan to Dependency Graph conversion agent. You will be provided a plan and you will generate a directed acyclic graph in the specified format for the plan. Each node in your graph should contain two fields name and subinfo. name is a one line description of each subtask. subinfo is all available information about executing that subtask available in the step by step plan. Please do not remove or edit any information out of the subinfo. The graph must be a directed acyclic graph. The graph must be connected. Do not include any repeated or optional steps in the graph, any extra info must go in the subinfo.
    # """

    DAG_TRANSLATOR_PROMPT = """You are a plan to Dependency Graph conversion agent. Your task is to analyze a given plan and generate a structured JSON output representing the plan and its corresponding directed acyclic graph (DAG).

The output should be a valid JSON object wrapped in <json></json> tags, with the following structure:

<json>
{
  "dag": {
    "nodes": [
      {
        "name": "Short name or brief description of the step",
        "info": "Detailed information about executing 
```

### Core Architecture Module: `gui_agents/s1/core/Worker.py`
```
import logging
import os
import re
from typing import Dict, List, Tuple
import platform

from gui_agents.s1.aci.ACI import ACI
from gui_agents.s1.core.BaseModule import BaseModule
from gui_agents.s1.core.Knowledge import KnowledgeBase
from gui_agents.s1.core.ProceduralMemory import PROCEDURAL_MEMORY
from gui_agents.s1.utils import common_utils
from gui_agents.s1.utils.common_utils import Node, calculate_tokens, call_llm_safe

logger = logging.getLogger("desktopenv.agent")


class Worker(BaseModule):
    def __init__(
        self,
        engine_params: Dict,
        grounding_agent: ACI,
        local_kb_path: str,
        platform: str = platform.system().lower(),
        search_engine: str = "perplexica",
        enable_reflection: bool = True,
        use_subtask_experience: bool = True,
    ):
        """
        Worker receives a subtask list and active subtask and generates the next action for the to execute.
        Args:
            engine_params: Dict
                Parameters for the multimodal engine
            grounding_agent: Agent
                The grounding agent to use
            local_kb_path: str
                Path to knowledge base
            search_engine: str
                The search engine to use
            enable_reflection: bool
                Whether to enable reflection
            use_subtask_experience: bool
                Whether to use subtask experience
        """
        super().__init__(engine_params, platform)

        self.grounding_agent = grounding_agent
        self.local_kb_path = local_kb_path
        self.enable_reflection = enable_reflection
        self.search_engine = search_engine
        self.use_subtask_experience = use_subtask_experience
        self.reset()

    def flush_messages(self, n):
        # After every max_trajectory_length trajectories, remove messages from the start except the system prompt
        for agent in [self.generator_agent]:
            if len(agent.messages) > 2 * n + 1:
                # Remove the user message and assistant message, both are 1 because the elements will move back after 1 pop
                agent.remove_message_at(1)
                agent.remove_message_at(1)

    def reset(self):
        self.generator_agent = self._create_agent(
            PROCEDURAL_MEMORY.construct_worker_procedural_memory(
                type(self.grounding_agent)
            ).replace("CURRENT_OS", self.platform)
        )
        self.reflection_agent = self._create_agent(
            PROCEDURAL_MEMORY.REFLECTION_ON_TRAJECTORY
        )

        self.knowledge_base = KnowledgeBase(
            local_kb_path=self.local_kb_path,
            platform=self.platform,
            engine_params=self.engine_params,
        )

        self.turn_count = 0
        self.planner_history = []
        self.reflections = []
        self.cost_this_turn = 0
        self.tree_inputs = []
        self.screenshot_inputs = []

    # TODO: Experimental
    def remove_ids_from_history(self):
        for message in self.generator_agent.messages:
            if message["role"] == "user":
                for content in message["content"]:
                    if content["type"] == "text":
                        # Regex pattern to match lines that start with a number followed by spaces and remove the number
                        pattern = r"^\d+\s+"

                        # Apply the regex substitution on each line
                        processed_lines = [
                            re.sub(pattern, "", line)
                            for line in content["text"].splitlines()
                        ]

                        # Join the processed lines back into a single string
                        result = "\n".join(processed_lines)

                        result = result.replace("id\t", "")

                        # replace message content
                        content["text"] = result

    def generate_next_action(
        self,
        instruction: str,
        search_query: str,
        subtask: str,
        subtask_info: str,
        future_tasks: List[Node],
        done_task: List[Node],
        obs: Dict,
    ) -> Tuple[Dict, List]:
        """
        Predict the next action(s) based on the current observation.
        """
        # Provide the top_app to the Grounding Agent to remove all other applications from the tree. At t=0, top_app is None
        agent = self.grounding_agent

        self.active_apps = agent.get_active_apps(obs)

        # Get RAG knowledge, only update system message at t=0
        if self.turn_count == 0:
            # TODO: uncomment and fix for subtask level RAG
            if self.use_subtask_experience:
                subtask_query_key = (
                    "Task:\n"
                    + search_query
                    + "\n\nSubtask: "
                    + subtask
                    + "\nSubtask Instruction: "
                    + subtask_info
                )
                retrieved_similar_subtask, retrieved_subtask_experience = (
                    self.knowledge_base.retrieve_episodic_experience(subtask_query_key)
                )
                logger.info(
                    "SIMILAR SUBTASK EXPERIENCE: %s",
                    retrieved_similar_subtask
                    + "\n"
                    + retrieved_subtask_experience.strip(),
                )
                instruction += "\nYou may refer to some similar subtask experience if you think they are useful. {}".format(
                    retrieved_similar_subtask + "\n" + retrieved_subtask_experience
                )

            self.generator_agent.add_system_prompt(
                self.generator_agent.system_prompt.replace(
                    "SUBTASK_DESCRIPTION", subtask
                )
                .replace("TASK_DESCRIPTION", instruction)
                .replace("FUTURE_TASKS", ", ".join([f.name for f in future_tasks]))
                .replace("DONE_TASKS", ",".join(d.name for d in done_task))
            )

        # Clear older messages - we keep full context. if you want to keep only the last n messages, you can use the flush_messages function
        # self.flush_messages(3) # flushes generator messages

        # Reflection generation
        reflection = None
        if self.enable_reflection and self.turn_count > 0:
            # TODO: reuse planner history
            self.reflection_agent.add_message(
                "Task Description: "
                + subtask
                + " Instruction: "
                + subtask_info
                + "\n"
                + "Current Trajectory: "
                + "\n\n".join(self.planner_history)
                + "\n"
            )
            reflection = call_llm_safe(self.reflection_agent)
            self.reflections.append(reflection)
            self.reflection_agent.add_message(reflection)

            logger.info("REFLECTION: %s", reflection)

        # Plan Generation
        tree_input = agent.linearize_and_annotate_tree(obs)

        self.remove_ids_from_history()

        # Bash terminal message.
        generator_message = (
            (
                f"\nYou may use the reflection on the previous trajectory: {reflection}\n"
                if reflection
                else ""
            )
            + f"Accessibility Tree: {tree_input}\n"
            f"Text Buffer = [{','.join(agent.notes)}]. "
            f"The current open applications are {agent.get_active_apps(obs)} and the active app is {agent.get_top_app(obs)}.\n"
        )

        print("ACTIVE APP IS: ", agent.get_top_app(obs))
        # Only provide subinfo in the very first message to avoid over influence and redundancy
        if self.turn_count == 0:
            generator_message += f"Remeber only complete the subtask: {subtask}\n"
            generator_message += f"You can use this extra information for completing the current subtask: {subtask_info}.\n"

        logger.info("GENERATOR MESSAGE: %s", generator_message)

        self.generator_agent.add_message(
            generator_message, image_content=obs["screenshot"]
        )

        plan = call_llm_safe(self.generator_agent)
        self.planner_history.append(plan)
        logger.info("PLAN: %s", plan)

        self.generator_agent.add_message(plan)

        # Calculate input and output tokens
        input_tokens, output_tokens = calculate_tokens(self.generator_agent.messages)

        # Set Cost based on GPT-4o
        cost = input_tokens * (0.0050 / 1000) + output_tokens * (0.0150 / 1000)
        self.cost_this_turn += cost
        logger.info("EXECTUOR COST: %s", self.cost_this_turn)

        # Extract code block from the plan
        plan_code = common_utils.parse_single_code_from_string(
            plan.split("Grounded Action")[-1]
        )
        plan_code = common_utils.sanitize_code(plan_code)
        plan_code = common_utils.extract_first_agent_function(plan_code)
        exec_code = eval(plan_code)

        # If agent selects an element that was out of range, it should not be executed just send a WAIT command.
        # TODO: should provide this as code feedback to the agent?
        if agent.index_out_of_range_flag:
            plan_code = "agent.wait(1.0)"
            exec_code = eval(plan_code)
            agent.index_out_of_range_flag = False

        executor_info = {
            "current_subtask": subtask,
            "current_subtask_info": subtask_info,
            "executor_plan": plan,
            "linearized_accessibility_tree": tree_input,
            "plan_code": plan_code,
            "reflection": reflection,
            "num_input_tokens_executor": input_tokens,
            "num_output_tokens_executor": output_tokens,
            "executor_cost": cost,
        }
        self.turn_count += 1

        self.tree_inputs.append(tree_input)
        self.screenshot_inputs.append(obs["screenshot"])

        return executor_info, [exec_code]

```

### Core Architecture Module: `gui_agents/s1/mllm/MultimodalEngine.py`
```
# Author: Saaket Agashe
# Date: 2021-09-15
# License: MIT

import os
import re
from io import BytesIO

import backoff
import numpy as np
import openai
import requests
from anthropic import Anthropic
from openai import APIConnectionError, APIError, AzureOpenAI, OpenAI, RateLimitError
from PIL import Image

# TODO: Import only if module exists, else ignore
# from llava.model.builder import load_pretrained_model
# from llava.mm_utils import (
#     process_images,
#     tokenizer_image_token,
#     get_model_name_from_path,
#     KeywordsStoppingCriteria,
# )
# from llava.constants import (
#     IMAGE_TOKEN_INDEX,
#     DEFAULT_IMAGE_TOKEN,
#     DEFAULT_IM_START_TOKEN,
#     DEFAULT_IM_END_TOKEN,
#     IMAGE_PLACEHOLDER,
# )
# from llava.conversation import conv_templates, SeparatorStyle


# from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


def image_parser(args):
    out = args.image_file.split(args.sep)
    return out


def load_image(image_file):
    if image_file.startswith("http") or image_file.startswith("https"):
        response = requests.get(image_file)
        image = Image.open(BytesIO(response.content)).convert("RGB")
    else:
        image = Image.open(image_file).convert("RGB")
    return image


def load_images(image_files):
    out = []
    for image_file in image_files:
        image = load_image(image_file)
        out.append(image)
    return out


class LMMEngine:
    pass


class LMMEngineOpenAI(LMMEngine):
    def __init__(self, api_key=None, model=None, rate_limit=-1, **kwargs):
        assert model is not None, "model must be provided"
        self.model = model

        api_key = api_key or os.getenv("OPENAI_API_KEY")
        if api_key is None:
            raise ValueError(
                "An API Key needs to be provided in either the api_key parameter or as an environment variable named OPENAI_API_KEY"
            )

        self.api_key = api_key
        self.request_interval = 0 if rate_limit == -1 else 60.0 / rate_limit

        self.llm_client = OpenAI(api_key=self.api_key)

    @backoff.on_exception(
        backoff.expo, (APIConnectionError, APIError, RateLimitError), max_time=60
    )
    def generate(self, messages, temperature=0.0, max_new_tokens=None, **kwargs):
        """Generate the next message based on previous messages"""
        return (
            self.llm_client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_new_tokens if max_new_tokens else 4096,
                temperature=temperature,
                **kwargs,
            )
            .choices[0]
            .message.content
        )


class LMMEngineAnthropic(LMMEngine):
    def __init__(self, api_key=None, model=None, **kwargs):
        assert model is not None, "model must be provided"
        self.model = model

        api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if api_key is None:
            raise ValueError(
                "An API Key needs to be provided in either the api_key parameter or as an environment variable named ANTHROPIC_API_KEY"
            )

        self.api_key = api_key

        self.llm_client = Anthropic(api_key=self.api_key)

    @backoff.on_exception(
        backoff.expo, (APIConnectionError, APIError, RateLimitError), max_time=60
    )
    def generate(self, messages, temperature=0.0, max_new_tokens=None, **kwargs):
        """Generate the next message based on previous messages"""
        return (
            self.llm_client.messages.create(
                system=messages[0]["content"][0]["text"],
                model=self.model,
                messages=messages[1:],
                max_tokens=max_new_tokens if max_new_tokens else 4096,
                temperature=temperature,
                **kwargs,
            )
            .content[0]
            .text
        )


class OpenAIEmbeddingEngine(LMMEngine):
    def __init__(
        self,
        api_key=None,
        rate_limit: int = -1,
        display_cost: bool = True,
    ):
        """Init an OpenAI Embedding engine

        Args:
            api_key (_type_, optional): Auth key from OpenAI. Defaults to None.
            rate_limit (int, optional): Max number of requests per minute. Defaults to -1.
            display_cost (bool, optional): Display cost of API call. Defaults to True.
        """
        self.model = "text-embedding-3-small"
        self.cost_per_thousand_tokens = 0.00002

        api_key = api_key or os.getenv("OPENAI_API_KEY")
        if api_key is None:
            raise ValueError(
                "An API Key needs to be provided in either the api_key parameter or as an environment variable named OPENAI_API_KEY"
            )
        self.api_key = api_key
        self.display_cost = display_cost
        self.request_interval = 0 if rate_limit == -1 else 60.0 / rate_limit

    @backoff.on_exception(
        backoff.expo,
        (
            APIError,
            RateLimitError,
            APIConnectionError,
        ),
    )
    def get_embeddings(self, text: str) -> np.ndarray:
        client = OpenAI(api_key=self.api_key)
        response = client.embeddings.create(model=self.model, input=text)
        if self.display_cost:
            total_tokens = response.usage.total_tokens
            cost = self.cost_per_thousand_tokens * total_tokens / 1000
            # print(f"Total cost for this embedding API call: {cost}")
        return np.array([data.embedding for data in response.data])


class LMMEngineAzureOpenAI(LMMEngine):
    def __init__(
        self,
        api_key=None,
        azure_endpoint=None,
        model=None,
        api_version=None,
        rate_limit=-1,
        **kwargs
    ):
        assert model is not None, "model must be provided"
        self.model = model

        assert api_version is not None, "api_version must be provided"
        self.api_version = api_version

        api_key = api_key or os.getenv("AZURE_OPENAI_API_KEY")
        if api_key is None:
            raise ValueError(
                "An API Key needs to be provided in either the api_key parameter or as an environment variable named AZURE_OPENAI_API_KEY"
            )

        self.api_key = api_key

        azure_endpoint = azure_endpoint or os.getenv("AZURE_OPENAI_API_BASE")
        if azure_endpoint is None:
            raise ValueError(
                "An Azure API endpoint needs to be provided in either the azure_endpoint parameter or as an environment variable named AZURE_OPENAI_API_BASE"
            )

        self.azure_endpoint = azure_endpoint
        self.request_interval = 0 if rate_limit == -1 else 60.0 / rate_limit

        self.llm_client = AzureOpenAI(
            azure_endpoint=self.azure_endpoint,
            api_key=self.api_key,
            api_version=self.api_version,
        )
        self.cost = 0.0

    # @backoff.on_exception(backoff.expo, (APIConnectionError, APIError, RateLimitError), max_tries=10)
    def generate(self, messages, temperature=0.0, max_new_tokens=None, **kwargs):
        """Generate the next message based on previous messages"""
        completion = self.llm_client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=max_new_tokens if max_new_tokens else 4096,
            temperature=temperature,
            **kwargs,
        )
        total_tokens = completion.usage.total_tokens
        self.cost += 0.02 * ((total_tokens + 500) / 1000)
        return completion.choices[0].message.content


class LMMEnginevLLM(LMMEngine):
    def __init__(
        self, base_url=None, api_key=None, model=None, rate_limit=-1, **kwargs
    ):
        assert model is not None, "model must be provided"
        self.model = model
        self.api_key = api_key

        self.base_url = base_url or os.getenv("vLLM_ENDPOINT_URL")
        if self.base_url is None:
            raise ValueError(
                "An endpoint URL needs to be provided in either the endpoint_url parameter or as an environment variable named vLLM_ENDPOINT_URL"
            )

        self.request_interval = 0 if rate_limit == -1 else 60.0 / rate_limit

        self.llm_client = OpenAI(base_url=self.base_url, api_key=self.api_key)

    # @backoff.on_exception(backoff.expo, (APIConnectionError, APIError, RateLimitError), max_tries=10)
    # TODO: Default params chosen for the Qwen model
    def generate(
        self,
        messages,
        temperature=0.0,
        top_p=0.8,
        repetition_penalty=1.05,
        max_new_tokens=512,
        **kwargs
    ):
        """Generate the next message based on previous messages"""
        completion = self.llm_client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=max_new_tokens if max_new_tokens else 4096,
            temperature=temperature,
            top_p=top_p,
            extra_body={"repetition_penalty": repetition_penalty},
        )
        return completion.choices[0].message.content

```

### Core Architecture Module: `gui_agents/s1/utils/common_utils.py`
```
import base64
import io
import json
import os
import pickle
import re
import tempfile
import time
import xml.etree.ElementTree as ET
from io import BytesIO
from typing import Dict, List, Tuple, Union
from xml.etree.ElementTree import Element

import numpy as np
import tiktoken
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, ValidationError


def find_leaf_nodes(xlm_file_str):
    if not xlm_file_str:
        return []

    root = ET.fromstring(xlm_file_str)

    # Recursive function to traverse the XML tree and collect leaf nodes
    def collect_leaf_nodes(node, leaf_nodes):
        # If the node has no children, it is a leaf node, add it to the list
        if not list(node):
            leaf_nodes.append(node)
        # If the node has children, recurse on each child
        for child in node:
            collect_leaf_nodes(child, leaf_nodes)

    # List to hold all leaf nodes
    leaf_nodes = []
    collect_leaf_nodes(root, leaf_nodes)
    return leaf_nodes


state_ns = "uri:deskat:state.at-spi.gnome.org"
component_ns = "uri:deskat:component.at-spi.gnome.org"


class Node(BaseModel):
    name: str
    info: str


class Dag(BaseModel):
    nodes: List[Node]
    edges: List[List[Node]]


NUM_IMAGE_TOKEN = 1105  # Value set of screen of size 1920x1080 for openai vision


def call_llm_safe(agent) -> Union[str, Dag]:
    # Retry if fails
    max_retries = 3  # Set the maximum number of retries
    attempt = 0
    response = ""
    while attempt < max_retries:
        try:
            response = agent.get_response()
            break  # If successful, break out of the loop
        except Exception as e:
            attempt += 1
            print(f"Attempt {attempt} failed: {e}")
            if attempt == max_retries:
                print("Max retries reached. Handling failure.")
        time.sleep(1.0)
    return response


def calculate_tokens(messages, num_image_token=NUM_IMAGE_TOKEN) -> Tuple[int, int]:

    num_input_images = 0
    output_message = messages[-1]

    input_message = messages[:-1]

    input_string = """"""
    for message in input_message:
        input_string += message["content"][0]["text"] + "\n"
        if len(message["content"]) > 1:
            num_input_images += 1

    input_text_tokens = get_input_token_length(input_string)

    input_image_tokens = num_image_token * num_input_images

    output_tokens = get_input_token_length(output_message["content"][0]["text"])

    return (input_text_tokens + input_image_tokens), output_tokens


def judge_node(node: Element, platform="ubuntu", check_image=False) -> bool:
    keeps: bool = (
        node.tag.startswith("document")
        or node.tag.endswith("item")
        or node.tag.endswith("button")
        or node.tag.endswith("heading")
        or node.tag.endswith("label")
        or node.tag.endswith("scrollbar")
        or node.tag.endswith("searchbox")
        or node.tag.endswith("textbox")
        or node.tag.endswith("link")
        or node.tag.endswith("tabelement")
        or node.tag.endswith("textfield")
        or node.tag.endswith("textarea")
        or node.tag.endswith("menu")
        or node.tag.endswith("menu-item")
        or node.tag
        in {
            "alert",
            "canvas",
            "check-box",
            "combo-box",
            "entry",
            "icon",
            "image",
            "paragraph",
            "scroll-bar",
            "section",
            "slider",
            "static",
            "table-cell",
            "terminal",
            "text",
            "netuiribbontab",
            "start",
            "trayclockwclass",
            "traydummysearchcontrol",
            "uiimage",
            "uiproperty",
            "uiribboncommandbar",
        }
    )

    keeps = (
        keeps
        and (
            platform == "ubuntu"
            and node.get("{{{:}}}showing".format(state_ns), "false") == "true"
            and node.get("{{{:}}}visible".format(state_ns), "false") == "true"
            or platform == "windows"
            and node.get("{{{:}}}visible".format(state_ns), "false") == "true"
        )
        and (
            node.get("name", "") != ""
            or node.text is not None
            and len(node.text) > 0
            or check_image
            and node.get("image", "false") == "true"
        )
    )
    # and (node.get("{{{:}}}enabled".format(state_ns), "false") == "true" \
    #      or node.get("{{{:}}}editable".format(state_ns), "false") == "true" \
    #      or node.get("{{{:}}}expandable".format(state_ns), "false") == "true" \
    #      or node.get("{{{:}}}checkable".format(state_ns), "false") == "true"
    #      ) \

    coordinates: Tuple[int, int] = eval(
        node.get("{{{:}}}screencoord".format(component_ns), "(-1, -1)")
    )
    sizes: Tuple[int, int] = eval(
        node.get("{{{:}}}size".format(component_ns), "(-1, -1)")
    )
    keeps = (
        keeps
        and coordinates[0] >= 0
        and coordinates[1] >= 0
        and sizes[0] > 0
        and sizes[1] > 0
    )
    return keeps


def filter_nodes(root: Element, platform="ubuntu", check_image=False):
    filtered_nodes = []
    all_nodes = []
    for node in root.iter():
        all_nodes.append(node)

    for node in root.iter():
        if judge_node(node, platform, check_image):
            filtered_nodes.append(node)

    return filtered_nodes


def draw_bounding_boxes(nodes, image_file_content, down_sampling_ratio=1.0):
    # Load the screenshot image
    image_stream = io.BytesIO(image_file_content)
    image = Image.open(image_stream)
    if float(down_sampling_ratio) != 1.0:
        image = image.resize(
            (
                int(image.size[0] * down_sampling_ratio),
                int(image.size[1] * down_sampling_ratio),
            )
        )
    draw = ImageDraw.Draw(image)
    marks = []
    drew_nodes = []
    text_informations: List[str] = ["index\ttag\tname\ttext"]

    try:
        # Adjust the path to the font file you have or use a default one
        font = ImageFont.truetype("arial.ttf", 15)
    except IOError:
        # Fallback to a basic font if the specified font can't be loaded
        font = ImageFont.load_default()

    index = 1

    # Loop over all the visible nodes and draw their bounding boxes
    for _node in nodes:
        coords_str = _node.attrib.get(
            "{uri:deskat:component.at-spi.gnome.org}screencoord"
        )
        size_str = _node.attrib.get("{uri:deskat:component.at-spi.gnome.org}size")

        if coords_str and size_str:
            try:
                # Parse the coordinates and size from the strings
                coords = tuple(map(int, coords_str.strip("()").split(", ")))
                size = tuple(map(int, size_str.strip("()").split(", ")))

                import copy

                original_coords = copy.deepcopy(coords)
                original_size = copy.deepcopy(size)

                if float(down_sampling_ratio) != 1.0:
                    # Downsample the coordinates and size
                    coords = tuple(int(coord * down_sampling_ratio) for coord in coords)
                    size = tuple(int(s * down_sampling_ratio) for s in size)

                # Check for negative sizes
                if size[0] <= 0 or size[1] <= 0:
                    raise ValueError(f"Size must be positive, got: {size}")

                # Calculate the bottom-right corner of the bounding box
                bottom_right = (coords[0] + size[0], coords[1] + size[1])

                # Check that bottom_right > coords (x1 >= x0, y1 >= y0)
                if bottom_right[0] < coords[0] or bottom_right[1] < coords[1]:
                    raise ValueError(
                        f"Invalid coordinates or size, coords: {coords}, size: {size}"
                    )

                # Check if the area only contains one color
                cropped_image = image.crop((*coords, *bottom_right))
                if len(set(list(cropped_image.getdata()))) == 1:
                    continue

                # Draw rectangle on image
                draw.rectangle([coords, bottom_right], outline="red", width=1)

                # Draw index number at the bottom left of the bounding box with black background
                text_position = (
                    coords[0],
                    bottom_right[1],
                )  # Adjust Y to be above the bottom right
                text_bbox: Tuple[int, int, int, int] = draw.textbbox(
                    text_position, str(index), font=font, anchor="lb"
                )
                # offset: int = bottom_right[1]-text_bbox[3]
                # text_bbox = (text_bbox[0], text_bbox[1]+offset, text_bbox[2], text_bbox[3]+offset)

                # draw.rectangle([text_position, (text_position[0] + 25, text_position[1] + 18)], fill='black')
                draw.rectangle(text_bbox, fill="black")
                draw.text(
                    text_position, str(index), font=font, anchor="lb", fill="white"
                )

                # each mark is an x, y, w, h tuple
                marks.append(
                    [
                        original_coords[0],
                        original_coords[1],
                        original_size[0],
                        original_size[1],
                    ]
                )
                drew_nodes.append(_node)

                if _node.text:
                    node_text = (
                        _node.text
                        if '"' not in _node.text
                        else '"{:}"'.format(_node.text.replace('"', '""'))
                    )
                elif _node.get(
                    "{uri:deskat:uia.windows.microsoft.org}class", ""
                ).endswith("EditWrapper") and _node.get(
                    "{uri:deskat:value.at-spi.gnome.org}value"
                ):
                    node_text: str = _node.get(
                        "{uri:deskat:value.
```

### Core Architecture Module: `gui_agents/s1/utils/ocr_server.py`
```
import base64
import gc
import io

import numpy as np
from fastapi import FastAPI
from paddleocr import PaddleOCR
from PIL import Image
from pydantic import BaseModel

app = FastAPI()
ocr_module = PaddleOCR(use_angle_cls=True, lang="en")


class ImageData(BaseModel):
    img_bytes: bytes


def text_cvt_orc_format_paddle(paddle_result):
    texts = []
    print("paddle_result: ", paddle_result)
    for i, line in enumerate(paddle_result[0]):
        points = np.array(line[0])
        print("points: ", points)
        location = {
            "left": int(min(points[:, 0])),
            "top": int(min(points[:, 1])),
            "right": int(max(points[:, 0])),
            "bottom": int(max(points[:, 1])),
        }
        print("location: ", location)
        content = line[1][0]
        texts.append((i, content, location))
    return texts


def ocr_results(screenshot):
    screenshot_img = Image.open(io.BytesIO(screenshot))
    result = ocr_module.ocr(np.array(screenshot_img), cls=True)
    return text_cvt_orc_format_paddle(result)


@app.post("/ocr/")
async def read_image(image_data: ImageData):
    image_bytes = base64.b64decode(image_data.img_bytes)
    results = ocr_results(image_bytes)

    # Explicitly delete unused variables and run garbage collector
    del image_bytes
    gc.collect()

    return {"results": results}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)

```

### Core Architecture Module: `gui_agents/s1/utils/query_perplexica.py`
```
import requests
import toml
import os


def query_to_perplexica(query):
    # Retrieve the URL from an environment variable
    url = os.getenv("PERPLEXICA_URL")
    if not url:
        raise ValueError(
            "PERPLEXICA_URL environment variable not set. It may take the form: 'http://localhost:{port}/api/search'. The port number is set in the config.toml in the Perplexica directory."
        )

    # Request Message
    message = {"focusMode": "webSearch", "query": query, "history": [["human", query]]}

    response = requests.post(url, json=message)

    if response.status_code == 200:
        return response.json()["message"]
    elif response.status_code == 400:
        raise ValueError(
            "The request is malformed or missing required fields, such as FocusModel or query"
        )
    else:
        raise ValueError("Internal Server Error")


# Test Code
if __name__ == "__main__":
    query = "What is Agent S?"
    response = query_to_perplexica(query)
    print(response)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #217** (2026-09-19): **Deleted**
  *Symptoms*: Deleted

- **Issue #215** (2026-09-05): **Update README.md**
  *Symptoms*: 

- **Issue #206** (2026-07-14): **Add observation-only Agent S MCP runtime**
  *Symptoms*: 

- **Issue #194** (2026-05-13): **chore: apply black formatting to gui_agents (unblock CI)**
  *Symptoms*: ## Summary - Runs `black gui_agents` to bring 8 long-unformatted files into compliance with the lint workflow. - Pure formatting — verified AST-identical to the prior state for every file. No behavior change.  ## Why now The `lint` workflow (`black --check gui_agents`) only runs when a push/PR touches `gui_agents/**`. From mid-January to last night, no `main` push hit that path, so accumulated formatting drift went unnoticed. The first `gui_agents/**` push of 2026 (Ollama merge #163) flipped main red, and the subsequent #157 merge stayed red.  ## Files reformatted - `gui_agents/s1/core/ProceduralMemory.py` - `gui_agents/s2/agents/worker.py` - `gui_agents/s2/memory/procedural_memory.py` - `gui_agents/s2_5/agents/worker.py` - `gui_agents/s2_5/memory/procedural_memory.py` - `gui_agents/s3/agents/worker.py` - `gui_agents/s3/bbon/behavior_narrator.py` - `gui_agents/s3/memory/procedural_memory.py`  ## Test plan - [x] `black --check gui_agents` is green locally (black 26.3.1, same version CI installs). - [x] AST-equality check across every modified file: identical before/after. - [ ] CI confirms green on this PR.

- **Issue #193** (2026-05-07): **Add Docker/KVM env backends + OSWorld provider scaffolds**
  *Symptoms*: Adds opt-in non-host environment backends to Agent-S so it can drive a podman/docker container or a KVM/libvirt guest in addition to the current local-display path.  ## Summary  - \`gui_agents/s3/utils/docker_env.py\` — \`DockerEnv\`/\`DockerController\` route bash + python execution into a docker or podman container via \`exec\`. \`screenshot()\` runs \`PIL.ImageGrab.grab()\` inside the container (fallback: \`xwd\`) and pipes a base64 PNG back. \`screen_size()\` uses \`xdpyinfo\`.  - \`gui_agents/s3/utils/kvm_env.py\` — \`KvmEnv\`/\`KvmController\` with two transports for KVM/libvirt guests:     - **ssh** (default, recommended): \`ssh user@host CMD\`. Most robust if the guest sshd is reachable.     - **qga**: \`virsh qemu-agent-command DOMAIN '{\"execute\":\"guest-exec\",...}'\` + poll \`guest-exec-status\`. No networking needed but requires \`qemu-guest-agent\` in the guest.   \`DISPLAY\` + \`XAUTHORITY\` env vars propagate to remote exec so generated \`pyautogui.click(...)\` lands on the guest's X session.  - \`gui_agents/s3/cli_app.py\`:     - \`--env_backend {local,docker,podman,kvm}\` + per-backend flags (\`--container\`, \`--container_user\`, \`--kvm_ssh_*\`, \`--kvm_display\`, \`--kvm_xauthority\`, ...).     - When \`code_env\` is set, screenshots and the generated pyautogui code go through the backend instead of the host display.     - **Bug fix**: skips the \`zenity --info \"Task Completed\"\` dialog when the host has no \`DISPLAY\`. zenity blocks ~25 s before faili
  **Post-Mortem & Fix Analysis**:
  > Closing — keeping the env-backend additions in our fork (vikranth22446/Agent-S @ add-env-backends) for now.

- **Issue #189** (2026-08-04): **Feature: Governance controls for computer-using agents**
  *Symptoms*: Computer-using agents have the highest risk surface of any agent type - they can interact with any GUI element. Runtime governance is critical: which apps can the agent access, which actions require approval, and is there proof of what the agent did.  asqav (pip install asqav) provides policy enforcement and signed audit trails. For Agent-S, this could gate screen interactions behind configurable policies and log every action cryptographically. Would you be interested in an integration?
  **Post-Mortem & Fix Analysis**:
  > Computer-using agents probably need stronger governance than ordinary tool-calling agents because the action space is open-ended and GUI state can hide side effects.  I would model controls at a few levels:  - app/window allowlists and deny lists - action class: observe, click, type, submit, delete, purchase, publish - confirmation gates for irreversible or external actions - screen/action receipts for replay - redaction rules before screenshots or OCR go back to the model  The important question is not only "did the agent do the task?" but "was it allowed to touch that surface in that state?"  I am working on a broader enterprise AI OS architecture where computer-use agents are one execution surface inside a governance/workflow/audit control plane: https://github.com/hegu-1/enterprise-ai-os-architecture

- **Issue #187** (2026-04-02): **Sidebar broken Windows 11**
  *Symptoms*: # Issue Report: Sidebar/Hamburger Menu Not Accessible in Windows App  | Field    | Detail                | |----------|-----------------------| | Date     | 2025-01-XX            | | Platform | Windows 11            | | App      | Simular Windows GUI   | | User     | simularuser           |  ---  ## Problem Summary  The left sidebar (conversation list) in the Simular Windows app is collapsed/hidden by default and cannot be expanded using any standard UI patterns or keyboard shortcuts.  ## Expected Behavior  User should be able to expand the sidebar to:  - View list of previous conversations - Switch between conversation threads - Access conversation search functionality  ## Actual Behavior  Sidebar is hidden with no visible way to expand it. All attempted methods failed.  ### Failed Expansion Methods  | Method | Result | |--------|--------| | Hamburger menu icon (three horizontal lines ☰) | Not visible/clickable at top-left | | Drag right edge of hidden sidebar | No grab handle visible | | Keyboard shortcut `Ctrl + B` | No effect | | Keyboard shortcut `Ctrl + Alt + B` | No effect | | View menu option | Not found in available menus | | Small arrow on left edge | Not present |  ## User Impact  - Cannot access previous conversation history - Cannot switch between conversation threads - Must use single conversation thread only - Makes app significantly less useful for ongoing multi-topic work  ## UI Context  - App appears to default to sidebar-hidden state - No visual indicator t
  **Post-Mortem & Fix Analysis**:
  > can close this issue, resolved with the user directly on discord

- **Issue #186** (2026-04-02): **Code execution tool broken**
  *Symptoms*: # Issue Report: Code Execution Tool Failure  | Field    | Value        | |----------|--------------| | Date     | 2025-01-XX   | | Platform | Windows 11   | | User     | simularuser  |  ---  ## Problem Summary  The JavaScript code execution tool (`execute`) is non-functional. All attempts to run JavaScript code return syntax errors at character position `1:8` to `1:11`, regardless of code validity.  ## Error Pattern  Every code execution attempt fails with:  ``` SyntaxError: Missing semicolon. (1:X) ```  Where `X` ranges from **8 to 11** depending on the command.  ---  ## Attempted Solutions (All Failed)  ### 1. Simple `exec()` commands  ```javascript var result = await exec({ command: "echo test" }); console.log(result); ```  **Result:** `SyntaxError at 1:10`  ### 2. Browser automation commands  ```javascript var tabs = await browser.listTabs(); console.log(tabs); ```  **Result:** `SyntaxError at 1:0`  ### 3. Desktop automation  ```javascript click({ concept: "button", mode: 'vision' }); ```  **Result:** `SyntaxError`  ### 4. Various escape patterns tried  - Single vs double quotes - Removing comments - Stripping special characters - Minimal one-liners - No semicolons, explicit semicolons  All resulted in the same syntax error.  ---  ## Impact  Complete inability to:  - Install software (attempted Notepad++) - Search filesystem for files - Read/write files to disk - Interact with browser tabs - Execute any shell commands - Access desktop UI elements  ### Working Operations  
  **Post-Mortem & Fix Analysis**:
  > @Hunta thanks for taking the time to file the report, I'll investigate into this. Please respond to my message on Discord. I need more information to investigate 
  > @chenchenSimular thank you, Discord username is: `crony_aliclan`.
  > can close this issue, resolved with the user directly on discord

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

### Incident Patch 1: `73ea1722` (2026-05-13)
**Commit Message**: chore: apply black formatting to gui_agents (#194)

Pure formatting pass: AST-identical for every file. Brings 8 long-drifted files back into compliance with the lint workflow so main goes green again.

**File**: `gui_agents/s1/core/ProceduralMemory.py` (modified, +4/-8)
```diff
@@ -5,8 +5,7 @@
 class PROCEDURAL_MEMORY:
     @staticmethod
     def construct_worker_procedural_memory(agent_class):
-        procedural_memory = textwrap.dedent(
-            f"""\
+        procedural_memory = textwrap.dedent(f"""\
         You are an expert in graphical user interfaces and Python code. You are responsible for executing the current subtask: `SUBTASK_DESCRIPTION` of the larger goal: `TASK_DESCRIPTION`.
         IMPORTANT: ** The subtasks: ['DONE_TASKS'] have already been done. The future subtasks ['FUTURE_TASKS'] will be done in the future by me. You must only perform the current subtask: `SUBTASK_DESCRIPTION`. Do not try to do future subtasks. **
         You are working in CURRENT_OS. You must only complete the subtask provided and not the larger goal.
@@ -16,8 +15,7 @@ def construct_worker_procedural_memory(agent_class):
         3. The history of your previous interactions with the UI.
         4. Access to the following class and methods to interact with the UI:
         class Agent:
-        """
-        )
+        """)
 
         for attr_name in dir(agent_class):
             attr = getattr(agent_class, attr_name)
@@ -29,8 +27,7 @@ def {attr_name}{signature}:
     '''{attr.__doc__}'''
         """
 
-        procedural_memory += textwrap.dedent(
-            """
+        procedural_memory += textwrap.dedent("""
         Your response should be formatted like this:
         (Previous action verification)
         Carefully analyze based on the screenshot and the accessibility tree if the previous action was successful. If the previous action was not successful, provide a reason for the failure.
@@ -57,8 +54,7 @@ def {attr_name}{signature}:
         7. Do not do anything other than the exact specified task. Return with `agent.done()` immediately after the task is completed or `agent.fail()` if it cannot be completed.
         8. Whenever possible use hot-keys or typing rather than mouse clicks.
         9. My computer's password is 'password', feel free to use it when you need sudo rights
-        """
-        )
+        """)
         return procedural_memory.strip()
 
     # MANAGER_PROMPT = """You are a planning agent for solving GUI navigation tasks. You will be provided the initial configuration of a system including accessibility, screenshot and other information. You need to solve the following task: TASK_DESCRIPTION. You will describe in as much detail as possible the steps required to complete the task by a GUI agent. Please do not include any verification steps in your plan that is not your responsibility. IMPORTANT: Your plan should be as concize as possible and should not include any unnecessary steps. Do not fine-tune, or embellish anything or cause any side effects. Generate the plan that can be accomplished in the shortest time. Please take the current state into account when generating the plan. Please provide the plan in a step-by-step format and make sure you do not include anything that's already done in the GUI in your plan."""
```

**File**: `gui_agents/s2/agents/worker.py` (modified, +2/-4)
```diff
@@ -159,13 +159,11 @@ def generate_next_action(
         if self.enable_reflection:
             # Load the initial subtask info
             if self.turn_count == 0:
-                text_content = textwrap.dedent(
-                    f"""
+                text_content = textwrap.dedent(f"""
                     Subtask Description: {subtask}
                     Subtask Information: {subtask_info}
                     Current Trajectory below:
-                    """
-                )
+                    """)
                 updated_sys_prompt = (
                     self.reflection_agent.system_prompt + "\n" + text_content
                 )
```

**File**: `gui_agents/s2/memory/procedural_memory.py` (modified, +12/-24)
```diff
@@ -6,8 +6,7 @@ class PROCEDURAL_MEMORY:
 
     @staticmethod
     def construct_worker_procedural_memory(agent_class, skipped_actions):
-        procedural_memory = textwrap.dedent(
-            f"""\
+        procedural_memory = textwrap.dedent(f"""\
         You are an expert in graphical user interfaces and Python code. You are responsible for executing the current subtask: `SUBTASK_DESCRIPTION` of the larger goal: `TASK_DESCRIPTION`.
         IMPORTANT: ** The subtasks: ['DONE_TASKS'] have already been done. The future subtasks ['FUTURE_TASKS'] will be done in the future by me. You must only perform the current subtask: `SUBTASK_DESCRIPTION`. Do not try to do future subtasks. **
         You are working in CURRENT_OS. You must only complete the subtask provided and not the larger goal.
@@ -16,8 +15,7 @@ def construct_worker_procedural_memory(agent_class, skipped_actions):
         2. The history of your previous interactions with the UI.
         3. Access to the following class and methods to interact with the UI:
         class Agent:
-        """
-        )
+        """)
 
         for attr_name in dir(agent_class):
             if attr_name in skipped_actions:
@@ -32,8 +30,7 @@ def {attr_name}{signature}:
     '''{attr.__doc__}'''
         """
 
-        procedural_memory += textwrap.dedent(
-            """
+        procedural_memory += textwrap.dedent("""
         Your response should be formatted like this:
         (Previous action verification)
         Carefully analyze based on the screenshot if the previous action was successful. If the previous action was not successful, provide a reason for the failure.
@@ -60,14 +57,12 @@ def {attr_name}{signature}:
         8. Whenever possible, your grounded action should use hot-keys with the agent.hotkey() action instead of clicking or dragging.
         9. My computer's password is 'password', feel free to use it when you need sudo rights.
         10. Do not use the "command" + "tab" hotkey on MacOS.
-        """
-        )
+        """)
 
         return procedural_memory.strip()
 
     # Manager prompt that generalizes to initial planning, re-planning after subtask completion, and re-planning after failure
-    COMBINED_MANAGER_PROMPT = textwrap.dedent(
-        """
+    COMBINED_MANAGER_PROMPT = textwrap.dedent("""
     You are an expert planning agent for solving GUI navigation tasks. You need to generate a plan for solving the following task: TASK_DESCRIPTION.
 
     You are provided with:
@@ -91,8 +86,7 @@ def {attr_name}{signature}:
       - If you feel the trajectory and future subtasks seem correct based on the current state of the desktop, you may re-use future subtasks.
       - If you feel some future subtasks are not detailed enough, use your observations from the desktop screenshot to update these subtasks to be more detailed.
       - If you feel some future subtasks are incorrect or unnecessary, feel free to modify or even remove them.
-    """
-    )
+    """)
 
     # USED IN OSWORLD EXPERIMENTS
     RAG_AGENT_OSWORLD = """
@@ -107,8 +101,7 @@ def {attr_name}{signature}:
     """
 
     # For reflection agent, post-action verification mainly for cycle detection
-    REFLECTION_ON_TRAJECTORY = textwrap.dedent(
-        """
+    REFLECTION_ON_TRAJECTORY = textwrap.dedent("""
     You are a reflection agent designed to assist in subtask execution by reflecting on the trajectory of a subtask and providing feedback for what the next step should be.
     You have access to the Subtask Description and the Current Trajectory of another computer agent. The Current Trajectory is a sequence of a desktop image, chain-of-thought reasoning, and a desktop action for each time step. The last image is the screen's display after the last action.
     Your task is to generate a reflection. Your generated reflection must fall under one of the two cases listed below:
@@ -120,8 +113,7 @@ def {attr_name}{signature}:
     - DO NOT suggest any specific future plans or actions. Your only goal is to provide a reflection, not an actual plan or action.
     - Any response that falls under Case 1 should explain why the trajectory is not going according to plan. You should especially lookout for cycles of actions that are continually repeated with no progress.
     - Any response that falls under Case 2 should be concise, since you just need to affirm the agent to continue with the current trajectory.
-    """
-    )
+    """)
 
     TASK_SUMMARIZATION_PROMPT = """
     You are a summarization agent designed to analyze a trajectory of desktop task execution.
@@ -178,8 +170,7 @@ def {attr_name}{signature}:
 Analyze the given plan and provide the output in this JSON format within the <json></json> tags. Ensure the JSON is valid and properly escaped.
 """
 
-    SUBTASK_SUMMARIZATION_PROMPT = textwrap.dedent(
-        """
+    SUBTASK_SUMMARIZATION_PROMPT = textwrap.dedent("""
     You are a summarization agent designed to analyze a trajectory of desktop task exec
```

**File**: `gui_agents/s2_5/agents/worker.py` (modified, +2/-4)
```diff
@@ -127,12 +127,10 @@ def generate_next_action(
         if self.enable_reflection:
             # Load the initial message
             if self.turn_count == 0:
-                text_content = textwrap.dedent(
-                    f"""
+                text_content = textwrap.dedent(f"""
                     Task Description: {instruction}
                     Current Trajectory below:
-                    """
-                )
+                    """)
                 updated_sys_prompt = (
                     self.reflection_agent.system_prompt + "\n" + text_content
                 )
```

**File**: `gui_agents/s2_5/memory/procedural_memory.py` (modified, +8/-16)
```diff
@@ -5,17 +5,15 @@
 class PROCEDURAL_MEMORY:
     @staticmethod
     def construct_simple_worker_procedural_memory(agent_class, skipped_actions):
-        procedural_memory = textwrap.dedent(
-            f"""\
+        procedural_memory = textwrap.dedent(f"""\
         You are an expert in graphical user interfaces and Python code. You are responsible for executing the task: `TASK_DESCRIPTION`.
         You are working in CURRENT_OS.
         You are provided with:
         1. A screenshot of the current time step.
         2. The history of your previous interactions with the UI.
         3. Access to the following class and methods to interact with the UI:
         class Agent:
-        """
-        )
+        """)
 
         for attr_name in dir(agent_class):
             if attr_name in skipped_actions:
@@ -30,8 +28,7 @@ def {attr_name}{signature}:
     '''{attr.__doc__}'''
         """
 
-        procedural_memory += textwrap.dedent(
-            """
+        procedural_memory += textwrap.dedent("""
         Your response should be formatted like this:
         (Previous action verification)
         Carefully analyze based on the screenshot if the previous action was successful. If the previous action was not successful, provide a reason for the failure.
@@ -58,14 +55,12 @@ def {attr_name}{signature}:
         8. Generate agent.fail() as your grounded action if you get exhaustively stuck on the task and believe it is impossible.
         9. Generate agent.done() as your grounded action when your believe the task is fully complete.
         10. Do not use the "command" + "tab" hotkey on MacOS.
-        """
-        )
+        """)
 
         return procedural_memory.strip()
 
     # For reflection agent, post-action verification mainly for cycle detection
-    REFLECTION_ON_TRAJECTORY = textwrap.dedent(
-        """
+    REFLECTION_ON_TRAJECTORY = textwrap.dedent("""
     You are an expert computer use agent designed to reflect on the trajectory of a task and provide feedback on what has happened so far.
     You have access to the Task Description and the Current Trajectory of another computer agent. The Current Trajectory is a sequence of a desktop image, chain-of-thought reasoning, and a desktop action for each time step. The last image is the screen's display after the last action.
     Your task is to generate a reflection. Your generated reflection must fall under one of the cases listed below:
@@ -79,11 +74,9 @@ def {attr_name}{signature}:
     - DO NOT suggest any specific future plans or actions. Your only goal is to provide a reflection, not an actual plan or action.
     - Any response that falls under Case 1 should explain why the trajectory is not going according to plan. You should especially lookout for cycles of actions that are continually repeated with no progress.
     - Any response that falls under Case 2 should be concise, since you just need to affirm the agent to continue with the current trajectory.
-    """
-    )
+    """)
 
-    PHRASE_TO_WORD_COORDS_PROMPT = textwrap.dedent(
-        """
+    PHRASE_TO_WORD_COORDS_PROMPT = textwrap.dedent("""
     You are an expert in graphical user interfaces. Your task is to process a phrase of text, and identify the most relevant word on the computer screen.
     You are provided with a phrase, a table with all the text on the screen, and a screenshot of the computer screen. You will identify the single word id that is best associated with the provided phrase.
     This single word must be displayed on the computer screenshot, and its location on the screen should align with the provided phrase.
@@ -94,5 +87,4 @@ def {attr_name}{signature}:
     2. Then, output the unique word id. Remember, the word id is the 1st number in each row of the text table.
     3. If there are multiple occurrences of the same word, use the surrounding context in the phrase to choose the correct one. Pay very close attention to punctuation and capitalization.
 
-    """
-    )
+    """)
```

**File**: `gui_agents/s3/agents/worker.py` (modified, +2/-4)
```diff
@@ -142,12 +142,10 @@ def _generate_reflection(self, instruction: str, obs: Dict) -> Tuple[str, str]:
         if self.enable_reflection:
             # Load the initial message
             if self.turn_count == 0:
-                text_content = textwrap.dedent(
-                    f"""
+                text_content = textwrap.dedent(f"""
                     Task Description: {instruction}
                     Current Trajectory below:
-                    """
-                )
+                    """)
                 updated_sys_prompt = (
                     self.reflection_agent.system_prompt + "\n" + text_content
                 )
```

**File**: `gui_agents/s3/bbon/behavior_narrator.py` (modified, +1/-3)
```diff
@@ -63,9 +63,7 @@ def place_text(label, color, x, y):
                     offset_x = 5
                 if y + offset_y < 0:  # Out of bounds on top
                     offset_y = 5
-                draw.text(
-                    (x + offset_x, y + offset_y), label, fill=color, font=font
-                )
+                draw.text((x + offset_x, y + offset_y), label, fill=color, font=font)
 
             if mouse_action.startswith("pyautogui.click"):
                 draw.circle((width, height), radius=3, fill=(255, 0, 0))
```

**File**: `gui_agents/s3/memory/procedural_memory.py` (modified, +18/-36)
```diff
@@ -4,17 +4,14 @@
 
 class PROCEDURAL_MEMORY:
 
-    FORMATTING_FEEDBACK_PROMPT = textwrap.dedent(
-        """
+    FORMATTING_FEEDBACK_PROMPT = textwrap.dedent("""
     Your previous response was not formatted correctly. You must respond again to replace your previous response. Do not make reference to this message while fixing the response. Please address the following issues below to improve the previous response:
     FORMATTING_FEEDBACK
-    """
-    )
+    """)
 
     @staticmethod
     def construct_simple_worker_procedural_memory(agent_class, skipped_actions):
-        procedural_memory = textwrap.dedent(
-            f"""\
+        procedural_memory = textwrap.dedent(f"""\
         You are an expert in graphical user interfaces and Python code. You are responsible for executing the task: `TASK_DESCRIPTION`.
         You are working in CURRENT_OS.
 
@@ -72,8 +69,7 @@ def construct_simple_worker_procedural_memory(agent_class, skipped_actions):
         2. The history of your previous interactions with the UI.
         3. Access to the following class and methods to interact with the UI:
         class Agent:
-        """
-        )
+        """)
 
         for attr_name in dir(agent_class):
             if attr_name in skipped_actions:
@@ -88,8 +84,7 @@ def {attr_name}{signature}:
     '''{attr.__doc__}'''
         """
 
-        procedural_memory += textwrap.dedent(
-            """
+        procedural_memory += textwrap.dedent("""
         Your response should be formatted like this:
         (Previous action verification)
         Carefully analyze based on the screenshot if the previous action was successful. If the previous action was not successful, provide a reason for the failure.
@@ -117,14 +112,12 @@ def {attr_name}{signature}:
         9. Generate agent.done() as your grounded action when your believe the task is fully complete.
         10. Do not use the "command" + "tab" hotkey on MacOS.
         11. Prefer hotkeys and application features over clicking on text elements when possible. Highlighting text is fine.
-        """
-        )
+        """)
 
         return procedural_memory.strip()
 
     # For reflection agent, post-action verification mainly for cycle detection
-    REFLECTION_ON_TRAJECTORY = textwrap.dedent(
-        """
+    REFLECTION_ON_TRAJECTORY = textwrap.dedent("""
     You are an expert computer use agent designed to reflect on the trajectory of a task and provide feedback on what has happened so far.
     You have access to the Task Description and the Current Trajectory of another computer agent. The Current Trajectory is a sequence of a desktop image, chain-of-thought reasoning, and a desktop action for each time step. The last image is the screen's display after the last action.
     
@@ -147,11 +140,9 @@ def {attr_name}{signature}:
     - Any response that falls under Case 2 should be concise, since you just need to affirm the agent to continue with the current trajectory.
     - IMPORTANT: Do not assume file modifications or application restarts are errors - they may be legitimate code agent actions
     - Consider whether observed changes align with the task requirements before determining if the trajectory is off-track
-    """
-    )
+    """)
 
-    PHRASE_TO_WORD_COORDS_PROMPT = textwrap.dedent(
-        """
+    PHRASE_TO_WORD_COORDS_PROMPT = textwrap.dedent("""
     You are an expert in graphical user interfaces. Your task is to process a phrase of text, and identify the most relevant word on the computer screen.
     You are provided with a phrase, a table with alxl the text on the screen, and a screenshot of the computer screen. You will identify the single word id that is best associated with the provided phrase.
     This single word must be displayed on the computer screenshot, and its location on the screen should align with the provided phrase.
@@ -162,11 +153,9 @@ def {attr_name}{signature}:
     2. Then, output the unique word id. Remember, the word id is the 1st number in each row of the text table.
     3. If there are multiple occurrences of the same word, use the surrounding context in the phrase to choose the correct one. Pay very close attention to punctuation and capitalization.
 
-    """
-    )
+    """)
 
-    CODE_AGENT_PROMPT = textwrap.dedent(
-        """\
+    CODE_AGENT_PROMPT = textwrap.dedent("""\
     You are a code execution agent with a limited step budget to complete tasks.
 
     # Core Guidelines:
@@ -281,11 +270,9 @@ def {attr_name}{signature}:
     - After in-place modifications, close/reopen files via GUI to show changes
 
     Focus on progress within your step budget.
-    """
-    )
+    """)
 
-    CODE_SUMMARY_AGENT_PROMPT = textwrap.dedent(
-        """\
+    CODE_SUMMARY_AGENT_PROMPT = textwrap.dedent("""\
     You are a code execution summarizer. Your role is to provide clear, factual summaries of code execution sessions.
 
     Key responsibilities:
@@ -305,11 +292,9 @@ def {attr_name}{signature}:
     - Thi
```

---

### Incident Patch 2: `231fc86e` (2026-05-13)
**Commit Message**: Fix missing time imports on Linux grounding actions and place_text closure (#157)

Adds missing `import time` for the Linux `open()` action and `UBUNTU_APP_SETUP` script, and refactors `place_text` in `behavior_narrator` to take explicit x,y parameters instead of capturing loop variables.

**File**: `gui_agents/s3/agents/grounding.py` (modified, +2/-1)
```diff
@@ -30,6 +30,7 @@ def agent_action(func):
 UBUNTU_APP_SETUP = f"""import subprocess;
 import difflib;
 import pyautogui;
+import time;
 pyautogui.press('escape');
 time.sleep(0.5);
 output = subprocess.check_output(['wmctrl', '-lx']);
@@ -394,7 +395,7 @@ def open(self, app_or_filename: str):
             app_or_filename:str, the name of the application or filename to open
         """
         if self.platform == "linux":
-            return f"import pyautogui; pyautogui.hotkey('win'); time.sleep(0.5); pyautogui.write({repr(app_or_filename)}); time.sleep(1.0); pyautogui.hotkey('enter'); time.sleep(0.5)"
+            return f"import pyautogui; import time; pyautogui.hotkey('win'); time.sleep(0.5); pyautogui.write({repr(app_or_filename)}); time.sleep(1.0); pyautogui.hotkey('enter'); time.sleep(0.5)"
         elif self.platform == "darwin":
             return f"import pyautogui; import time; pyautogui.hotkey('command', 'space', interval=0.5); pyautogui.typewrite({repr(app_or_filename)}); pyautogui.press('enter'); time.sleep(1.0)"
         elif self.platform == "windows":
```

**File**: `gui_agents/s3/bbon/behavior_narrator.py` (modified, +9/-9)
```diff
@@ -48,31 +48,31 @@ def mark_action(mouse_actions: list[str], img: Image):
             width = max(0, min(img.width - 1, width))
             height = max(0, min(img.height - 1, height))
 
-            def place_text(label, color):
+            def place_text(label, color, x, y):
                 bbox = draw.textbbox((0, 0), label, font=font)
                 text_w, text_h = (
                     bbox[2] - bbox[0],
                     bbox[3] - bbox[1],
                 )  # Measure text size
                 offset_x, offset_y = -5, 5  # Default offset
-                if width + offset_x + text_w > img.width:  # Out of bounds on right
+                if x + offset_x + text_w > img.width:  # Out of bounds on right
                     offset_x = -text_w - 5
-                if height + offset_y + text_h > img.height:  # Out of bounds on bottom
+                if y + offset_y + text_h > img.height:  # Out of bounds on bottom
                     offset_y = -text_h - 5
-                if width + offset_x < 0:  # Out of bounds on left
+                if x + offset_x < 0:  # Out of bounds on left
                     offset_x = 5
-                if height + offset_y < 0:  # Out of bounds on top
+                if y + offset_y < 0:  # Out of bounds on top
                     offset_y = 5
                 draw.text(
-                    (width + offset_x, height + offset_y), label, fill=color, font=font
+                    (x + offset_x, y + offset_y), label, fill=color, font=font
                 )
 
             if mouse_action.startswith("pyautogui.click"):
                 draw.circle((width, height), radius=3, fill=(255, 0, 0))
-                place_text("Click", (255, 0, 0))
+                place_text("Click", (255, 0, 0), width, height)
             if mouse_action.startswith("pyautogui.moveTo"):
                 draw.circle((width, height), radius=3, fill=(0, 0, 255))
-                place_text("MoveTo", (0, 0, 255))
+                place_text("MoveTo", (0, 0, 255), width, height)
                 drag_start_height, drag_start_width = height, width
             if mouse_action.startswith("pyautogui.dragTo"):
                 draw.line(
@@ -81,7 +81,7 @@ def place_text(label, color):
                     width=2,
                 )
                 draw.circle((width, height), radius=3, fill=(0, 255, 0))
-                place_text("DragTo", (0, 255, 0))
+                place_text("DragTo", (0, 255, 0), width, height)
 
     @staticmethod
     def get_mouse_action_representation(mouse_actions: list[str]) -> str:
```

---

### Incident Patch 3: `16135934` (2026-02-20)
**Commit Message**: Add OpenClaw integration for Agent-S GUI automation

Includes wrapper script, bash entry point, skill manifest, and
documentation for using Agent-S as an OpenClaw skill. Grounding
model env vars are marked as required to match the CLI contract.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `integrations/openclaw/README.md` (added, +289/-0)
```diff
@@ -0,0 +1,289 @@
+# Agent-S OpenClaw Integration
+
+This integration enables [OpenClaw](https://github.com/openclaw/openclaw) to use [Agent-S](https://github.com/simular-ai/Agent-S) for autonomous GUI automation tasks.
+
+## Overview
+
+Agent-S is a powerful autonomous agent that can control your computer's graphical interface to complete complex tasks. This integration provides a simple wrapper that allows OpenClaw agents to invoke Agent-S for GUI automation.
+
+## Prerequisites
+
+### Required Software
+
+1. **Agent-S**: Install the gui-agents package
+   ```bash
+   pip install gui-agents
+   ```
+
+2. **Tesseract**: Required for OCR functionality
+   ```bash
+   brew install tesseract  # macOS
+   # or
+   sudo apt install tesseract-ocr  # Linux
+   ```
+
+3. **OpenClaw**: This integration is designed to work with OpenClaw
+
+### Required Environment Variables
+
+You need at least one API key for your chosen provider:
+
+- **`ANTHROPIC_API_KEY`**: For Claude models (Anthropic provider)
+  ```bash
+  export ANTHROPIC_API_KEY="your-api-key-here"
+  ```
+
+- **`OPENAI_API_KEY`**: For GPT models (OpenAI provider)
+  ```bash
+  export OPENAI_API_KEY="your-api-key-here"
+  ```
+
+- **`GEMINI_API_KEY`**: For Gemini models (Google provider)
+  ```bash
+  export GEMINI_API_KEY="your-api-key-here"
+  ```
+
+By default, the wrapper uses Anthropic's Claude Sonnet 4.5. You can modify `agent_s_wrapper.py` to use a different provider and model.
+
+### Grounding Model Configuration (Required)
+
+Agent-S requires a grounding model for visual element detection. We recommend [UI-TARS-1.5-7B](https://huggingface.co/ByteDance-Seed/UI-TARS-1.5-7B):
+
+- **`AGENT_S_GROUND_URL`** (Required): Grounding model endpoint URL
+- **`AGENT_S_GROUND_MODEL`** (Required): Model name (default: "ui-tars-1.5-7b")
+- **`AGENT_S_GROUNDING_WIDTH`** (Required): Output coordinate width (default: "1920")
+- **`AGENT_S_GROUNDING_HEIGHT`** (Required): Output coordinate height (default: "1080")
+- **`AGENT_S_GROUND_API_KEY`** (Optional): API key for grounding endpoint
+
+Example configuration:
+```bash
+export AGENT_S_GROUND_URL="http://localhost:8080"
+export AGENT_S_GROUND_API_KEY="your-grounding-api-key"
+export AGENT_S_GROUND_MODEL="ui-tars-1.5-7b"
+export AGENT_S_GROUNDING_WIDTH="1920"
+export AGENT_S_GROUNDING_HEIGHT="1080"
+```
+
+See the [Agent-S documentation](https://github.com/simular-ai/Agent-S#grounding-models-required) for details on setting up grounding models.
+
+## Installation
+
+1. **Clone or copy this directory** to your OpenClaw skills folder:
+   ```bash
+   cp -r integrations/openclaw ~/.openclaw/workspace/skills/agent-s
+   ```
+
+2. **Make scripts executable**:
+   ```bash
+   chmod +x ~/.openclaw/workspace/skills/agent-s/agent_s_task
+   chmod +x ~/.openclaw/workspace/skills/agent-s/agent_s_wrapper.py
+   ```
+
+3. **Verify installation**:
+   ```bash
+   which agent_s
+   # Should show the path to agent_s executable
+   ```
+
+## Usage
+
+### From OpenClaw Agent
+
+The OpenClaw agent can invoke Agent-S by reading the SKILL.md file and using the bash tool:
+
+```bash
+~/.openclaw/workspace/skills/agent-s/agent_s_task "Open Safari and go to google.com"
+```
+
+### From Command Line
+
+You can test the integration directly:
+
+```bash
+# Basic usage
+./agent_s_task "Open System Preferences"
+
+# Using the Python wrapper with options
+./agent_s_wrapper.py "Open TextEdit and type Hello World" --max-steps 10 --json
+```
+
+### Advanced Options
+
+```bash
+# Custom max steps
+./agent_s_wrapper.py "complex task" --max-steps 30
+
+# Disable reflection (faster but less accurate)
+./agent_s_wrapper.py "simple task" --no-reflection
+
+# Enable local code environment (WARNING: executes arbitrary code)
+./agent_s_wrapper.py "task requiring code execution" --enable-local-env
+
+# JSON output (for programmatic use)
+./agent_s_wrapper.py "task" --json
+```
+
+## Testing
+
+### Quick Test
+
+Verify the integration works:
+
+```bash
+# Test 1: Check help
+./agent_s_wrapper.py --help
+
+# Test 2: Simple task (will actually execute)
+./agent_s_task "Open Calculator"
+```
+
+### Testing with OpenClaw Agent
+
+1. **Start OpenClaw**:
+   ```bash
+   openclaw
+   ```
+
+2. **Ask your agent** to use Agent-S:
+   - "Can you use Agent-S to open the Calculator app?"
+   - "I need you to use the Agent-S skill to open Safari and navigate to github.com"
+   - "Read the Agent-S skill documentation and then use it to open System Preferences"
+
+3. **Expected behavior**:
+   - Agent reads `SKILL.md` in the skills directory
+   - Agent executes `agent_s_task` command via bash tool
+   - Agent-S launches and completes the GUI task
+   - Results are returned to OpenClaw agent
+
+### Verification Checklist
+
+- [ ] `agent_s` executable is in PATH
+- [ ] `ANTHROPIC_API_KEY` is set
+- [ ] `AGENT_S_GROUND_URL` is set (grounding model endpoint)
+- [ ] Scripts are executable
+- [ ] OpenClaw agent can read skill files
+- [ ] Test task executes successfully
+
+## Con
```

**File**: `integrations/openclaw/SKILL.md` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+# Agent-S - Autonomous GUI Agent
+
+Agent-S is a powerful autonomous agent that can control your computer's graphical interface to complete complex tasks. It combines vision and action understanding to interact with any GUI element.
+
+## What It Does
+
+Agent-S can:
+- Navigate and interact with desktop applications
+- Fill forms, click buttons, and manipulate GUI elements
+- Complete multi-step workflows across different applications
+- Take screenshots and understand visual interfaces
+- Execute complex GUI automation tasks autonomously
+
+## When to Use
+
+Use Agent-S when you need to:
+- Automate GUI-based tasks that don't have CLI alternatives
+- Interact with desktop applications programmatically
+- Complete workflows that require visual understanding
+- Perform actions across multiple applications
+- Test GUI interfaces
+
+## How to Invoke
+
+Call the Agent-S wrapper via bash from the OpenClaw skills directory:
+
+```bash
+./agent_s_task "task description"
+```
+
+Or if installed in the default OpenClaw skills location:
+
+```bash
+~/.openclaw/workspace/skills/agent-s/agent_s_task "task description"
+```
+
+**Note**: Agent-S tasks can take 2-5 minutes to complete (up to 15 steps by default). The wrapper will wait for completion.
+
+## Parameters
+
+- `task` (required): Natural language description of the GUI task to complete
+- `max_steps` (optional): Maximum steps the agent can take (default: 15)
+- `enable_reflection` (optional): Enable self-reflection for better performance (default: true)
+
+## Examples
+
+```python
+# Basic navigation
+agent_s_task(task="Open Finder and create a new folder called 'Reports'")
+
+# Form filling
+agent_s_task(task="Open TextEdit, create a new document, and type 'Hello World'")
+
+# Multi-step workflows
+agent_s_task(task="Open Chrome, search for 'Python tutorials', and bookmark the first result")
+
+# Application interaction
+agent_s_task(task="Open System Preferences and check the current display resolution")
+```
+
+## Technical Details
+
+Agent-S uses:
+- **Main Model**: Claude Sonnet 4.5 for reasoning and planning
+- **Grounding Model**: UI-TARS-1.5-7B for visual grounding and coordinate extraction
+- **Screen Resolution**: Automatically scaled to 2400px max dimension
+- **Platform Support**: macOS, Linux, Windows
+
+## Safety
+
+- Agent-S has full GUI control - only use for trusted tasks
+- The agent will pause on Ctrl+C and can be resumed with Esc
+- Each action is logged to `~/workspace/Agent-S/logs/`
+- Tasks timeout after 15 steps by default
+
+## Configuration
+
+Agent-S requires configuration via environment variables:
+
+**Required:**
+- `ANTHROPIC_API_KEY`: API key for Claude model
+- `AGENT_S_GROUND_URL`: Grounding model endpoint URL
+- `AGENT_S_GROUND_MODEL`: Grounding model name (default: ui-tars-1.5-7b)
+- `AGENT_S_GROUNDING_WIDTH`: Output width (default: 1920)
+- `AGENT_S_GROUNDING_HEIGHT`: Output height (default: 1080)
+
+**Optional:**
+- `AGENT_S_GROUND_API_KEY`: API key for grounding endpoint
+
+See the README.md in this directory for detailed setup instructions.
+
+## Limitations
+
+- Cannot interact with system-level dialogs requiring admin approval
+- Performance depends on screen resolution and GUI complexity
+- Some applications may have accessibility restrictions
+- Voice/audio commands are not supported
+
+## Source
+
+Agent-S GitHub: https://github.com/simular-ai/Agent-S
+Installation: `pip install gui-agents`
```

**File**: `integrations/openclaw/agent_s_task` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+#!/bin/bash
+# Agent-S Task Executor for OpenClaw
+# Usage: agent_s_task "task description"
+
+TASK="$1"
+
+if [ -z "$TASK" ]; then
+    echo "Error: Task description required"
+    echo "Usage: agent_s_task \"task description\""
+    exit 1
+fi
+
+# Execute the Python wrapper using relative path
+SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
+exec "$SCRIPT_DIR/agent_s_wrapper.py" "$TASK"
```

**File**: `integrations/openclaw/agent_s_wrapper.py` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+#!/usr/bin/env python3
+"""
+Agent-S Wrapper for OpenClaw Integration
+
+This script provides a simple interface for OpenClaw to invoke Agent-S
+for GUI automation tasks.
+"""
+
+import argparse
+import json
+import subprocess
+import sys
+import os
+import shutil
+
+
+def run_agent_s(task, max_steps=15, enable_reflection=True, enable_local_env=False):
+    """
+    Execute an Agent-S task and return the result.
+
+    Args:
+        task: Natural language task description
+        max_steps: Maximum number of steps (default: 15)
+        enable_reflection: Enable reflection agent (default: True)
+        enable_local_env: Enable local code execution (default: False, WARNING: executes arbitrary code)
+
+    Returns:
+        Dictionary with status and message
+    """
+
+    # Path to agent_s executable - auto-detect or use environment variable
+    agent_s_path = os.environ.get("AGENT_S_PATH") or shutil.which("agent_s")
+    if not agent_s_path:
+        return {
+            "status": "error",
+            "message": "agent_s not found in PATH. Install with: pip install gui-agents",
+            "error": "agent_s executable not found"
+        }
+
+    # Build base command
+    cmd = [
+        agent_s_path,
+        "--provider", "anthropic",
+        "--model", "claude-sonnet-4-5",
+        "--model_temperature", "1.0",
+        "--max_trajectory_length", str(max_steps),
+        "--task", task,
+    ]
+    
+    # Add optional grounding configuration from environment variables
+    ground_url = os.environ.get("AGENT_S_GROUND_URL")
+    ground_api_key = os.environ.get("AGENT_S_GROUND_API_KEY")
+    ground_model = os.environ.get("AGENT_S_GROUND_MODEL", "ui-tars-1.5-7b")
+    grounding_width = os.environ.get("AGENT_S_GROUNDING_WIDTH", "1920")
+    grounding_height = os.environ.get("AGENT_S_GROUNDING_HEIGHT", "1080")
+    
+    if ground_url:
+        cmd.extend(["--ground_provider", "huggingface"])
+        cmd.extend(["--ground_url", ground_url])
+        cmd.extend(["--ground_model", ground_model])
+        cmd.extend(["--grounding_width", grounding_width])
+        cmd.extend(["--grounding_height", grounding_height])
+        if ground_api_key:
+            cmd.extend(["--ground_api_key", ground_api_key])
+
+    if enable_reflection:
+        cmd.append("--enable_reflection")
+
+    if enable_local_env:
+        cmd.append("--enable_local_env")
+
+    try:
+        # Run Agent-S
+        print(f"Starting Agent-S with task: {task}", file=sys.stderr)
+        print(f"Command: {' '.join(cmd)}", file=sys.stderr)
+
+        # Agent-S can take 2-5 minutes for complex tasks (15 steps max)
+        # Don't capture output - let it stream to allow real-time GUI interaction
+        result = subprocess.run(
+            cmd,
+            capture_output=False,  # Changed: let output stream
+            text=True,
+            timeout=600  # 10 minute timeout
+        )
+
+        if result.returncode == 0:
+            return {
+                "status": "success",
+                "message": f"Agent-S completed the task: {task}",
+                "logs_directory": os.path.expanduser("~/workspace/Agent-S/logs/"),
+                "note": "Output was streamed to terminal. Check logs for details."
+            }
+        else:
+            return {
+                "status": "error",
+                "message": f"Agent-S failed with return code {result.returncode}",
+                "logs_directory": os.path.expanduser("~/workspace/Agent-S/logs/"),
+                "note": "Check logs for error details."
+            }
+
+    except subprocess.TimeoutExpired:
+        return {
+            "status": "error",
+            "message": f"Agent-S timed out after 10 minutes for task: {task}",
+            "error": "Timeout expired"
+        }
+
+    except Exception as e:
+        return {
+            "status": "error",
+            "message": f"Failed to execute Agent-S: {str(e)}",
+            "error": str(e)
+        }
+
+
+def main():
+    parser = argparse.ArgumentParser(
+        description="OpenClaw wrapper for Agent-S GUI automation"
+    )
+    parser.add_argument(
+        "task",
+        type=str,
+        help="Natural language description of the GUI task to perform"
+    )
+    parser.add_argument(
+        "--max-steps",
+        type=int,
+        default=15,
+        help="Maximum number of agent steps (default: 15)"
+    )
+    parser.add_argument(
+        "--enable-reflection",
+        action="store_true",
+        default=True,
+        help="Enable reflection agent for better performance"
+    )
+    parser.add_argument(
+        "--no-reflection",
+        action="store_false",
+        dest="enable_reflection",
+        help="Disable reflection agent"
+    )
+    parser.add_argument(
+        "--enable-local-env",
+        action="store_true",
+        default=False,
+        help="Enable local code execution (WARNING: executes arbitrary code)"
+    )
+    parser.add_argument(
```

---

### Incident Patch 4: `000dd370` (2026-01-19)
**Commit Message**: fix: clean up test env and normalize ollama param checks

**File**: `gui_agents/s3/core/mllm.py` (modified, +2/-2)
```diff
@@ -37,7 +37,7 @@ def __init__(self, engine_params=None, system_prompt=None, engine=None):
                     self.engine = LMMEngineParasail(**engine_params)
                 elif engine_type == "ollama":
                     # Reuse LMMEngineOpenAI for Ollama
-                    if "base_url" not in engine_params:
+                    if not engine_params.get("base_url"):
                         import os
 
                         base_url = os.getenv("OLLAMA_HOST")
@@ -50,7 +50,7 @@ def __init__(self, engine_params=None, system_prompt=None, engine=None):
                             raise ValueError(
                                 "Ollama endpoint must be provided via 'base_url' parameter or 'OLLAMA_HOST' environment variable."
                             )
-                    if "api_key" not in engine_params:
+                    if not engine_params.get("api_key"):
                         engine_params["api_key"] = "ollama"
                     self.engine = LMMEngineOpenAI(**engine_params)
                 elif engine_type == "deepseek":
```

**File**: `tests/test_providers.py` (modified, +4/-0)
```diff
@@ -14,6 +14,10 @@ def setUp(self):
             del os.environ["DEEPSEEK_API_KEY"]
         if "QWEN_API_KEY" in os.environ:
             del os.environ["QWEN_API_KEY"]
+        if "DEEPSEEK_ENDPOINT_URL" in os.environ:
+            del os.environ["DEEPSEEK_ENDPOINT_URL"]
+        if "QWEN_ENDPOINT_URL" in os.environ:
+            del os.environ["QWEN_ENDPOINT_URL"]
 
     def test_ollama_missing_config(self):
         """Test that Ollama raises ValueError if no endpoint is provided"""
```

---

### Incident Patch 5: `b6601890` (2026-01-19)
**Commit Message**: fix: address review comments (robust params, url normalization, cleanup)

**File**: `gui_agents/s3/core/mllm.py` (modified, +9/-4)
```diff
@@ -60,8 +60,11 @@ def __init__(self, engine_params=None, system_prompt=None, engine=None):
                         base_url = os.getenv("DEEPSEEK_ENDPOINT_URL")
                         if not base_url:
                             base_url = "https://api.deepseek.com"
+                        if not base_url.endswith("/v1"):
+                            base_url = base_url.rstrip("/") + "/v1"
                         engine_params["base_url"] = base_url
-                    if "api_key" not in engine_params:
+
+                    if not engine_params.get("api_key"):
                         import os
 
                         api_key = os.getenv("DEEPSEEK_API_KEY")
@@ -73,16 +76,19 @@ def __init__(self, engine_params=None, system_prompt=None, engine=None):
 
                     self.engine = LMMEngineOpenAI(**engine_params)
                 elif engine_type == "qwen":
-                    if "base_url" not in engine_params:
+                    if not engine_params.get("base_url"):
                         import os
 
                         base_url = os.getenv("QWEN_ENDPOINT_URL")
                         if not base_url:
                             base_url = (
                                 "https://dashscope.aliyuncs.com/compatible-mode/v1"
                             )
+                        if not base_url.endswith("/v1"):
+                            base_url = base_url.rstrip("/") + "/v1"
                         engine_params["base_url"] = base_url
-                    if "api_key" not in engine_params:
+
+                    if not engine_params.get("api_key"):
                         import os
 
                         api_key = os.getenv("QWEN_API_KEY")
@@ -186,7 +192,6 @@ def add_message(
                 LMMEngineGemini,
                 LMMEngineOpenRouter,
                 LMMEngineParasail,
-                LMMEngineParasail,
             ),
         ):
             # infer role from previous message
```

**File**: `tests/test_providers.py` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ def test_deepseek_init(self):
             )
             self.assertIsInstance(agent.engine, LMMEngineOpenAI)
             # Default URL
-            self.assertEqual(agent.engine.base_url, "https://api.deepseek.com")
+            self.assertEqual(agent.engine.base_url, "https://api.deepseek.com/v1")
             # (Note: engine.py logic resolves default at generate() time or if client created,
             # but init just stores what's passed. Let's verify prompt generation to ensure it doesn't crash on init)
 
```

---

### Incident Patch 6: `8644eb88` (2026-01-14)
**Commit Message**: Merge pull request #170 from simular-ai/011425-bugfix-cli-app

fix to follow style guideline for our linter

**File**: `gui_agents/s3/cli_app.py` (modified, +1/-0)
```diff
@@ -393,5 +393,6 @@ def main():
         if response.lower() != "y":
             break
 
+
 if __name__ == "__main__":
     main()
```

---

### Incident Patch 7: `404f1e87` (2026-01-14)
**Commit Message**: fix to follow style guideline

**File**: `gui_agents/s3/cli_app.py` (modified, +1/-0)
```diff
@@ -393,5 +393,6 @@ def main():
         if response.lower() != "y":
             break
 
+
 if __name__ == "__main__":
     main()
```

---

### Incident Patch 8: `53c23628` (2026-01-14)
**Commit Message**: Merge pull request #169 from simular-ai/011425-bugfix-cli-app

fix undefined variable in cli app

**File**: `gui_agents/s3/cli_app.py` (modified, +1/-1)
```diff
@@ -378,7 +378,7 @@ def main():
     # handle query from command line
     if isinstance(task, str) and task.strip():
         agent.reset()
-        run_agent(agent, query, scaled_width, scaled_height)
+        run_agent(agent, task, scaled_width, scaled_height)
         return
 
     while True:
```

---

### Incident Patch 9: `bdebcc90` (2026-01-14)
**Commit Message**: fix undefined variable in cli app

**File**: `gui_agents/s3/cli_app.py` (modified, +1/-1)
```diff
@@ -378,7 +378,7 @@ def main():
     # handle query from command line
     if isinstance(task, str) and task.strip():
         agent.reset()
-        run_agent(agent, query, scaled_width, scaled_height)
+        run_agent(agent, task, scaled_width, scaled_height)
         return
 
     while True:
```

---

### Incident Patch 10: `234450bb` (2026-01-13)
**Commit Message**: fix: restore OLLAMA_HOST env var support

**File**: `gui_agents/s3/core/mllm.py` (modified, +8/-1)
```diff
@@ -39,7 +39,14 @@ def __init__(self, engine_params=None, system_prompt=None, engine=None):
                 elif engine_type == "ollama":
                     # Reuse LMMEngineOpenAI for Ollama, defaulting to localhost if not specified
                     if "base_url" not in engine_params:
-                        engine_params["base_url"] = "http://localhost:11434/v1"
+                        import os
+                        base_url = os.getenv("OLLAMA_HOST")
+                        if base_url:
+                            if not base_url.endswith("/v1"):
+                                base_url = base_url.rstrip("/") + "/v1"
+                            engine_params["base_url"] = base_url
+                        else:
+                            engine_params["base_url"] = "http://localhost:11434/v1"
                     if "api_key" not in engine_params:
                         engine_params["api_key"] = "ollama"
                     self.engine = LMMEngineOpenAI(**engine_params)
```

---

### Incident Patch 11: `c55f3947` (2025-12-30)
**Commit Message**: fix: forward **kwargs to chat.completions.create() for Ollama engine

This ensures consistency with other engine implementations (OpenAI, Gemini,
OpenRouter, etc.) and allows callers to pass additional parameters like
stop, top_p, etc.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `gui_agents/s3/core/engine.py` (modified, +1/-0)
```diff
@@ -487,5 +487,6 @@ def generate(
             messages=messages,
             max_tokens=max_new_tokens if max_new_tokens else 4096,
             temperature=temp,
+            **kwargs,
         )
         return completion.choices[0].message.content
```

---

### Incident Patch 12: `a680e270` (2025-10-30)
**Commit Message**: Fix typo in worker's system prompt

Fix the apostrophe typo

**File**: `gui_agents/s3/memory/procedural_memory.py` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ def construct_simple_worker_procedural_memory(agent_class, skipped_actions):
         - **Never use the code agent for charts, graphs, pivot tables, or visual elements—always use the GUI for those.**
         - If creating a new sheet with no name specified, use default sheet names (e.g., "Sheet1", "Sheet2", etc.).
         - After opening or reopening applications, wait at least 3 seconds for full loading.
-        - Don’t provide specific row/column numbers to the coding agent; let it infer the spreadsheet structure itself.
+        - Don't provide specific row/column numbers to the coding agent; let it infer the spreadsheet structure itself.
 
         Never assume a task is done based on appearances-always ensure the specific requested action has been performed and verify the modification. If you haven't executed any actions, the task is not complete.
 
```

---

### Incident Patch 13: `aaed16eb` (2025-10-30)
**Commit Message**: update procedural memory

**File**: `gui_agents/s3/memory/procedural_memory.py` (modified, +19/-0)
```diff
@@ -29,6 +29,10 @@ def construct_simple_worker_procedural_memory(agent_class, skipped_actions):
         ### Code Agent
         You have access to a code agent that can execute Python/Bash code for complex tasks.
 
+        Use code agent for:
+        - **ALL spreadsheet calculations**: sums, totals, averages, formulas, data filling, missing value calculations
+        - **ALL data manipulation tasks**: including calculations, data processing (filtering, sorting, replacing, cleanup), bulk operations (filling or transforming ranges), formatting changes (number/date/currency formats, styles), and large-scale data entry or editing
+
         **Usage Strategy**:
         - **Full Task**: Use `agent.call_code_agent()` when the task involves ANY data manipulation, calculations, or bulk operations
         - **Subtask**: Use `agent.call_code_agent("specific subtask")` for focused data tasks
@@ -52,6 +56,13 @@ def construct_simple_worker_procedural_memory(agent_class, skipped_actions):
         - ALWAYS verify code agent results with GUI actions before using agent.done(); NEVER trust code agent output alone. If verification or the code agent fails, use GUI actions to finish the task and only use agent.done() if results match expectations.
         - **CRITICAL**: Files modified by code agent may not show changes in currently open applications - you MUST close and reopen the entire application. Reloading the page/file is insufficient.
 
+        # General Task Guidelines
+        - For formatting tasks, always use the code agent for proper formatting.
+        - **Never use the code agent for charts, graphs, pivot tables, or visual elements—always use the GUI for those.**
+        - If creating a new sheet with no name specified, use default sheet names (e.g., "Sheet1", "Sheet2", etc.).
+        - After opening or reopening applications, wait at least 3 seconds for full loading.
+        - Don’t provide specific row/column numbers to the coding agent; let it infer the spreadsheet structure itself.
+
         Never assume a task is done based on appearances-always ensure the specific requested action has been performed and verify the modification. If you haven't executed any actions, the task is not complete.
 
         ### END OF GUIDELINES
@@ -177,6 +188,14 @@ def {attr_name}{signature}:
         - If verification fails (the modification did not work as intended), return to Step 3 and rewrite the modification code. Repeat until verification succeeds.
     - Do NOT write entire scripts in one step - focus on one small task per step
 
+    # CRITICAL: Data Format Guidelines
+    - Store dates as proper date objects, not text strings
+    - Store numbers as numeric values, not formatted text with symbols
+    - Preserve data types for calculations and evaluations
+    - When applying data validation to spreadsheet columns, limit the range to only the rows containing actual data, not entire columns
+    - When creating cross-sheet references, use cell references (e.g., =Sheet1!A1) instead of manually typing values
+    - When asked to create a new sheet and no specific name is provided, default to the default sheet name (e.g., "Sheet1", "Sheet2", etc.)
+
     # CRITICAL: File Modification Strategy
     - ALWAYS prioritize modifying existing open files IN PLACE rather than creating new files
     - The screenshot context shows which file is currently open and should be modified
```

---

### Incident Patch 14: `9597193b` (2025-10-04)
**Commit Message**: small bug fix

**File**: `gui_agents/s3/utils/common_utils.py` (modified, +5/-3)
```diff
@@ -72,9 +72,11 @@ def call_llm_formatted(generator, format_checkers, **kwargs):
     max_retries = 3  # Set the maximum number of retries
     attempt = 0
     response = ""
-    messages = (
-        generator.messages.copy()
-    )  # Copy messages to avoid modifying the original
+    if kwargs.get("messages") is None:
+        messages = generator.messages.copy()  # Copy messages to avoid modifying the original
+    else:
+        messages = kwargs["messages"]
+        del kwargs["messages"]  # Remove messages from kwargs to avoid passing it twice
     while attempt < max_retries:
         response = call_llm_safe(generator, messages=messages, **kwargs)
 
```

**File**: `osworld_setup/s3/bbon/generate_facts.py` (modified, +5/-1)
```diff
@@ -45,7 +45,11 @@ async def generate_single_fact_caption(
 
     # Generate fact caption using behavior narrator
     result = await asyncio.to_thread(
-        judge.judge, before_bytes, after_bytes, pyautogui_action
+        judge.judge,
+        screenshot_num=i + 1,
+        before_img_bytes=before_bytes,
+        after_img_bytes=after_bytes,
+        pyautogui_action=pyautogui_action,
     )
     result["screenshot_num"] = i + 1
 
```

---

### Incident Patch 15: `2e791299` (2025-10-03)
**Commit Message**: fix lint yml

**File**: `.github/workflows/lint.yml` (modified, +1/-1)
```diff
@@ -39,4 +39,4 @@ jobs:
 
     - name: Run Linter
       run: |
-        black --check gui_agents tests
+        black --check gui_agents
```

#### Recent Merged Pull Requests:
- **PR #215** (2026-09-05): Update README.md (@ziqi-lydia)
- **PR #206** (closed): Add observation-only Agent S MCP runtime (@mrdavtan)
- **PR #194** (2026-05-13): chore: apply black formatting to gui_agents (unblock CI) (@eric-xw)
- **PR #193** (closed): Add Docker/KVM env backends + OSWorld provider scaffolds (@vikranth22446)
- **PR #180** (closed): fix: replace 42 bare excepts with except Exception (@haosenwang1018)
- **PR #179** (2026-02-21): Add OpenClaw integration for Agent-S GUI automation (@simularhao)
- **PR #174** (2026-01-19): chore: Update setup.py version to 0.3.2 (@Mashiro-Ethereal)
- **PR #170** (2026-01-14): fix to follow style guideline for our linter (@Richard-Simular)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
