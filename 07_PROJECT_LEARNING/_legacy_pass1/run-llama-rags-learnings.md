# Forensic Learning Record (Deep Inspection): run-llama/rags

> **Canonical Artifact**: `07_PROJECT_LEARNING/run-llama-rags-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/run-llama/rags](https://github.com/run-llama/rags))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:10:07.979Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `run-llama/rags`
- **Description**: Build ChatGPT over your data, all with natural language
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 6552 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `1_🏠_Home.py`
```
import streamlit as st
from streamlit_pills import pills

from st_utils import (
    add_builder_config,
    add_sidebar,
    get_current_state,
)

current_state = get_current_state()

####################
#### STREAMLIT #####
####################


st.set_page_config(
    page_title="Build a RAGs bot, powered by LlamaIndex",
    page_icon="🦙",
    layout="centered",
    initial_sidebar_state="auto",
    menu_items=None,
)
st.title("Build a RAGs bot, powered by LlamaIndex 💬🦙")
st.info(
    "Use this page to build your RAG bot over your data! "
    "Once the agent is finished creating, check out the `RAG Config` and "
    "`Generated RAG Agent` pages.\n"
    "To build a new agent, please make sure that 'Create a new agent' is selected.",
    icon="ℹ️",
)
if "metaphor_key" in st.secrets:
    st.info("**NOTE**: The ability to add web search is enabled.")


add_builder_config()
add_sidebar()


st.info(f"Currently building/editing agent: {current_state.cache.agent_id}", icon="ℹ️")

# add pills
selected = pills(
    "Outline your task!",
    [
        "I want to analyze this PDF file (data/invoices.pdf)",
        "I want to search over my CSV documents.",
    ],
    clearable=True,
    index=None,
)

if "messages" not in st.session_state.keys():  # Initialize the chat messages history
    st.session_state.messages = [
        {"role": "assistant", "content": "What RAG bot do you want to build?"}
    ]


def add_to_message_history(role: str, content: str) -> None:
    message = {"role": role, "content": str(content)}
    st.session_state.messages.append(message)  # Add response to message history


for message in st.session_state.messages:  # Display the prior chat messages
    with st.chat_message(message["role"]):
        st.write(message["content"])

# TODO: this is really hacky, only because st.rerun is jank
if prompt := st.chat_input(
    "Your question",
):  # Prompt for user input and save to chat history
    # TODO: hacky
    if "has_rerun" in st.session_state.keys() and st.session_state.has_rerun:
        # if this is true, skip the user input
        st.session_state.has_rerun = False
    else:
        add_to_message_history("user", prompt)
        with st.chat_message("user"):
            st.write(prompt)

        # If last message is not from assistant, generate a new response
        if st.session_state.messages[-1]["role"] != "assistant":
            with st.chat_message("assistant"):
                with st.spinner("Thinking..."):
                    response = current_state.builder_agent.chat(prompt)
                    st.write(str(response))
                    add_to_message_history("assistant", str(response))

        else:
            pass

        # check agent_ids again
        # if it doesn't match, add to directory and refresh
        agent_ids = current_state.agent_registry.get_agent_ids()
        # check diff between agent_ids and cur agent ids
        diff_ids = list(set(agent_ids) - set(st.session_state.cur_agent_ids))
        if len(diff_ids) > 0:
            # # clear streamlit cache, to allow you to generate a new agent
            # st.cache_resource.clear()
            st.session_state.has_rerun = True
            st.rerun()

else:
    # TODO: set has_rerun to False
    st.session_state.has_rerun = False

```

### Core Architecture Module: `core/__init__.py`
```
"""Init file."""

```

### Core Architecture Module: `core/callback_manager.py`
```
"""Streaming callback manager."""
from llama_index.callbacks.base_handler import BaseCallbackHandler
from llama_index.callbacks.schema import CBEventType

from typing import Optional, Dict, Any, List, Callable

STORAGE_DIR = "./storage"  # directory to cache the generated index
DATA_DIR = "./data"  # directory containing the documents to index


class StreamlitFunctionsCallbackHandler(BaseCallbackHandler):
    """Callback handler that outputs streamlit components given events."""

    def __init__(self, msg_handler: Callable[[str], Any]) -> None:
        """Initialize the base callback handler."""
        self.msg_handler = msg_handler
        super().__init__([], [])

    def on_event_start(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        parent_id: str = "",
        **kwargs: Any,
    ) -> str:
        """Run when an event starts and return id of event."""
        if event_type == CBEventType.FUNCTION_CALL:
            if payload is None:
                raise ValueError("Payload cannot be None")
            arguments_str = payload["function_call"]
            tool_str = payload["tool"].name
            print_str = f"Calling function: {tool_str} with args: {arguments_str}\n\n"
            self.msg_handler(print_str)
        else:
            pass
        return event_id

    def on_event_end(
        self,
        event_type: CBEventType,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        **kwargs: Any,
    ) -> None:
        """Run when an event ends."""
        pass
        # TODO: currently we don't need to do anything here
        # if event_type == CBEventType.FUNCTION_CALL:
        #     response = payload["function_call_response"]
        #     # Add this to queue
        #     print_str = (
        #         f"\n\nGot output: {response}\n"
        #         "========================\n\n"
        #     )
        # elif event_type == CBEventType.AGENT_STEP:
        #     # put response into queue
        #     self._queue.put(payload["response"])

    def start_trace(self, trace_id: Optional[str] = None) -> None:
        """Run when an overall trace is launched."""
        pass

    def end_trace(
        self,
        trace_id: Optional[str] = None,
        trace_map: Optional[Dict[str, List[str]]] = None,
    ) -> None:
        """Run when an overall trace is exited."""
        pass

```

### Core Architecture Module: `core/constants.py`
```
from pathlib import Path

AGENT_CACHE_DIR = Path(__file__).parent.parent / "cache" / "agents"
MESSAGES_CACHE_DIR = Path(__file__).parent.parent / "cache" / "messages"

```

### Core Architecture Module: `core/param_cache.py`
```
"""Param cache."""

from pydantic import BaseModel, Field
from llama_index import (
    VectorStoreIndex,
    StorageContext,
    load_index_from_storage,
)
from typing import List, cast, Optional
from llama_index.chat_engine.types import BaseChatEngine
from pathlib import Path
import json
import uuid
from core.utils import (
    load_data,
    get_tool_objects,
    construct_agent,
    RAGParams,
    construct_mm_agent,
)


class ParamCache(BaseModel):
    """Cache for RAG agent builder.

    Created a wrapper class around a dict in case we wanted to more explicitly
    type different items in the cache.

    """

    # arbitrary types
    class Config:
        arbitrary_types_allowed = True

    # system prompt
    system_prompt: Optional[str] = Field(
        default=None, description="System prompt for RAG agent."
    )
    # data
    file_names: List[str] = Field(
        default_factory=list, description="File names as data source (if specified)"
    )
    urls: List[str] = Field(
        default_factory=list, description="URLs as data source (if specified)"
    )
    directory: Optional[str] = Field(
        default=None, description="Directory as data source (if specified)"
    )

    docs: List = Field(default_factory=list, description="Documents for RAG agent.")
    # tools
    tools: List = Field(
        default_factory=list, description="Additional tools for RAG agent (e.g. web)"
    )
    # RAG params
    rag_params: RAGParams = Field(
        default_factory=RAGParams, description="RAG parameters for RAG agent."
    )

    # agent params
    builder_type: str = Field(
        default="default", description="Builder type (default, multimodal)."
    )
    vector_index: Optional[VectorStoreIndex] = Field(
        default=None, description="Vector index for RAG agent."
    )
    agent_id: str = Field(
        default_factory=lambda: f"Agent_{str(uuid.uuid4())}",
        description="Agent ID for RAG agent.",
    )
    agent: Optional[BaseChatEngine] = Field(default=None, description="RAG agent.")

    def save_to_disk(self, save_dir: str) -> None:
        """Save cache to disk."""
        # NOTE: more complex than just calling dict() because we want to
        # only store serializable fields and be space-efficient

        dict_to_serialize = {
            "system_prompt": self.system_prompt,
            "file_names": self.file_names,
            "urls": self.urls,
            "directory": self.directory,
            # TODO: figure out tools
            "tools": self.tools,
            "rag_params": self.rag_params.dict(),
            "builder_type": self.builder_type,
            "agent_id": self.agent_id,
        }
        # store the vector store within the agent
        if self.vector_index is None:
            raise ValueError("Must specify vector index in order to save.")
        self.vector_index.storage_context.persist(Path(save_dir) / "storage")

        # if save_path directories don't exist, create it
        if not Path(save_dir).exists():
            Path(save_dir).mkdir(parents=True)
        with open(Path(save_dir) / "cache.json", "w") as f:
            json.dump(dict_to_serialize, f)

    @classmethod
    def load_from_disk(
        cls,
        save_dir: str,
    ) -> "ParamCache":
        """Load cache from disk."""
        with open(Path(save_dir) / "cache.json", "r") as f:
            cache_dict = json.load(f)

        storage_context = StorageContext.from_defaults(
            persist_dir=str(Path(save_dir) / "storage")
        )
        if cache_dict["builder_type"] == "multimodal":
            from llama_index.indices.multi_modal.base import MultiModalVectorStoreIndex

            vector_index: VectorStoreIndex = cast(
                MultiModalVectorStoreIndex, load_index_from_storage(storage_context)
            )
        else:
            vector_index = cast(
                VectorStoreIndex, load_index_from_storage(storage_context)
            )

        # replace rag params with RAGParams object
        cache_dict["rag_params"] = RAGParams(**cache_dict["rag_params"])

        # add in the missing fields
        # load docs
        cache_dict["docs"] = load_data(
            file_names=cache_dict["file_names"],
            urls=cache_dict["urls"],
            directory=cache_dict["directory"],
        )
        # load agent from index
        additional_tools = get_tool_objects(cache_dict["tools"])

        if cache_dict["builder_type"] == "multimodal":
            vector_index = cast(MultiModalVectorStoreIndex, vector_index)
            agent, _ = construct_mm_agent(
                cache_dict["system_prompt"],
                cache_dict["rag_params"],
                cache_dict["docs"],
                mm_vector_index=vector_index,
            )
        else:
            agent, _ = construct_agent(
                cache_dict["system_prompt"],
                cache_dict["rag_params"],
                cache_dict["docs"],
                vector_index=vector_index,
                additional_tools=additional_tools,
                # TODO: figure out tools
            )
        cache_dict["vector_index"] = vector_index
        cache_dict["agent"] = agent

        return cls(**cache_dict)

```

### Core Architecture Module: `core/utils.py`
```
"""Utils."""

from llama_index.llms import OpenAI, Anthropic, Replicate
from llama_index.llms.base import LLM
from llama_index.llms.utils import resolve_llm
from pydantic import BaseModel, Field
import os
from llama_index.agent import OpenAIAgent, ReActAgent
from llama_index.agent.react.prompts import REACT_CHAT_SYSTEM_HEADER
from llama_index import (
    VectorStoreIndex,
    SummaryIndex,
    ServiceContext,
    Document,
)
from typing import List, cast, Optional
from llama_index import SimpleDirectoryReader
from llama_index.embeddings.utils import resolve_embed_model
from llama_index.tools import QueryEngineTool, ToolMetadata
from llama_index.agent.types import BaseAgent
from llama_index.chat_engine.types import BaseChatEngine
from llama_index.agent.react.formatter import ReActChatFormatter
from llama_index.llms.openai_utils import is_function_calling_model
from llama_index.chat_engine import CondensePlusContextChatEngine
from core.builder_config import BUILDER_LLM
from typing import Dict, Tuple, Any
import streamlit as st

from llama_index.callbacks import CallbackManager, trace_method
from core.callback_manager import StreamlitFunctionsCallbackHandler
from llama_index.schema import ImageNode, NodeWithScore

### BETA: Multi-modal
from llama_index.indices.multi_modal.base import MultiModalVectorStoreIndex
from llama_index.multi_modal_llms.openai import OpenAIMultiModal
from llama_index.indices.multi_modal.retriever import (
    MultiModalVectorIndexRetriever,
)
from llama_index.llms import ChatMessage
from llama_index.query_engine.multi_modal import SimpleMultiModalQueryEngine
from llama_index.chat_engine.types import (
    AGENT_CHAT_RESPONSE_TYPE,
    StreamingAgentChatResponse,
    AgentChatResponse,
)
from llama_index.llms.base import ChatResponse
from typing import Generator


class RAGParams(BaseModel):
    """RAG parameters.

    Parameters used to configure a RAG pipeline.

    """

    include_summarization: bool = Field(
        default=False,
        description=(
            "Whether to include summarization in the RAG pipeline. (only for GPT-4)"
        ),
    )
    top_k: int = Field(
        default=2, description="Number of documents to retrieve from vector store."
    )
    chunk_size: int = Field(default=1024, description="Chunk size for vector store.")
    embed_model: str = Field(
        default="default", description="Embedding model to use (default is OpenAI)"
    )
    llm: str = Field(
        default="gpt-4-1106-preview", description="LLM to use for summarization."
    )


def _resolve_llm(llm_str: str) -> LLM:
    """Resolve LLM."""
    # TODO: make this less hardcoded with if-else statements
    # see if there's a prefix
    # - if there isn't, assume it's an OpenAI model
    # - if there is, resolve it
    tokens = llm_str.split(":")
    if len(tokens) == 1:
        os.environ["OPENAI_API_KEY"] = st.secrets.openai_key
        llm: LLM = OpenAI(model=llm_str)
    elif tokens[0] == "local":
        llm = resolve_llm(llm_str)
    elif tokens[0] == "openai":
        os.environ["OPENAI_API_KEY"] = st.secrets.openai_key
        llm = OpenAI(model=tokens[1])
    elif tokens[0] == "anthropic":
        os.environ["ANTHROPIC_API_KEY"] = st.secrets.anthropic_key
        llm = Anthropic(model=tokens[1])
    elif tokens[0] == "replicate":
        os.environ["REPLICATE_API_KEY"] = st.secrets.replicate_key
        llm = Replicate(model=tokens[1])
    else:
        raise ValueError(f"LLM {llm_str} not recognized.")
    return llm


def load_data(
    file_names: Optional[List[str]] = None,
    directory: Optional[str] = None,
    urls: Optional[List[str]] = None,
) -> List[Document]:
    """Load data."""
    file_names = file_names or []
    directory = directory or ""
    urls = urls or []

    # get number depending on whether specified
    num_specified = sum(1 for v in [file_names, urls, directory] if v)

    if num_specified == 0:
        raise ValueError("Must specify either file_names or urls or directory.")
    elif num_specified > 1:
        raise ValueError("Must specify only one of file_names or urls or directory.")
    elif file_names:
        reader = SimpleDirectoryReader(input_files=file_names)
        docs = reader.load_data()
    elif directory:
        reader = SimpleDirectoryReader(input_dir=directory)
        docs = reader.load_data()
    elif urls:
        from llama_hub.web.simple_web.base import SimpleWebPageReader

        # use simple web page reader from llamahub
        loader = SimpleWebPageReader()
        docs = loader.load_data(urls=urls)
    else:
        raise ValueError("Must specify either file_names or urls or directory.")

    return docs


def load_agent(
    tools: List,
    llm: LLM,
    system_prompt: str,
    extra_kwargs: Optional[Dict] = None,
    **kwargs: Any,
) -> BaseChatEngine:
    """Load agent."""
    extra_kwargs = extra_kwargs or {}
    if isinstance(llm, OpenAI) and is_function_calling_model(llm.model):
        # TODO: use default msg handler
        # TODO: separate this from agent_utils.py...
        def _msg_handler(msg: str) -> None:
            """Message handler."""
            st.info(msg)
            st.session_state.agent_messages.append(
                {"role": "assistant", "content": msg, "msg_type": "info"}
            )

        # add streamlit callbacks (to inject events)
        handler = StreamlitFunctionsCallbackHandler(_msg_handler)
        callback_manager = CallbackManager([handler])
        # get OpenAI Agent
        agent: BaseChatEngine = OpenAIAgent.from_tools(
            tools=tools,
            llm=llm,
            system_prompt=system_prompt,
            **kwargs,
            callback_manager=callback_manager,
        )
    else:
        if "vector_index" not in extra_kwargs:
            raise ValueError(
                "Must pass in vector index for CondensePlusContextChatEngine."
            )
        vector_index = cast(VectorStoreIndex, extra_kwargs["vector_index"])
        rag_params = cast(RAGParams, extra_kwargs["rag_params"])
        # use condense + context chat engine
        agent = CondensePlusContextChatEngine.from_defaults(
            vector_index.as_retriever(similarity_top_k=rag_params.top_k),
        )

    return agent


def load_meta_agent(
    tools: List,
    llm: LLM,
    system_prompt: str,
    extra_kwargs: Optional[Dict] = None,
    **kwargs: Any,
) -> BaseAgent:
    """Load meta agent.

    TODO: consolidate with load_agent.

    The meta-agent *has* to perform tool-use.

    """
    extra_kwargs = extra_kwargs or {}
    if isinstance(llm, OpenAI) and is_function_calling_model(llm.model):
        # get OpenAI Agent

        agent: BaseAgent = OpenAIAgent.from_tools(
            tools=tools,
            llm=llm,
            system_prompt=system_prompt,
            **kwargs,
        )
    else:
        agent = ReActAgent.from_tools(
            tools=tools,
            llm=llm,
            react_chat_formatter=ReActChatFormatter(
                system_header=system_prompt + "\n" + REACT_CHAT_SYSTEM_HEADER,
            ),
            **kwargs,
        )

    return agent


def construct_agent(
    system_prompt: str,
    rag_params: RAGParams,
    docs: List[Document],
    vector_index: Optional[VectorStoreIndex] = None,
    additional_tools: Optional[List] = None,
) -> Tuple[BaseChatEngine, Dict]:
    """Construct agent from docs / parameters / indices."""
    extra_info = {}
    additional_tools = additional_tools or []

    # first resolve llm and embedding model
    embed_model = resolve_embed_model(rag_params.embed_model)
    # llm = resolve_llm(rag_params.llm)
    # TODO: use OpenAI for now
    # llm = OpenAI(model=rag_params.llm)
    llm = _resolve_llm(rag_params.llm)

    # first let's index the data with the right parameters
    service_context = ServiceContext.from_defaults(
        chunk_size=rag_params.chunk_size,
        llm=llm,
        embed_model=embed_model,
    )

    if vector_index is None:
        vector_
```

### Core Architecture Module: `pages/2_⚙️_RAG_Config.py`
```
"""Streamlit page showing builder config."""
import streamlit as st

from core.param_cache import (
    RAGParams,
)
from core.agent_builder.loader import (
    RAGAgentBuilder,
    AgentCacheRegistry,
)
from st_utils import update_selected_agent_with_id, get_current_state, add_sidebar
from typing import cast


####################
#### STREAMLIT #####
####################


def update_agent() -> None:
    """Update agent."""
    if (
        "agent_builder" in st.session_state.keys()
        and st.session_state.agent_builder is not None
    ):
        additional_tools = st.session_state.additional_tools_st.strip().split(",")
        if additional_tools == [""]:
            additional_tools = []
        agent_builder = cast(RAGAgentBuilder, st.session_state.agent_builder)
        ### Update the agent
        agent_builder.update_agent(
            st.session_state.agent_id_st,
            system_prompt=st.session_state.sys_prompt_st,
            include_summarization=st.session_state.include_summarization_st,
            top_k=st.session_state.top_k_st,
            chunk_size=st.session_state.chunk_size_st,
            embed_model=st.session_state.embed_model_st,
            llm=st.session_state.llm_st,
            additional_tools=additional_tools,
        )

        # Update Radio Buttons: update selected agent to the new id
        update_selected_agent_with_id(agent_builder.cache.agent_id)
    else:
        raise ValueError("Agent builder is None. Cannot update agent.")


def delete_agent() -> None:
    """Delete agent."""
    if (
        "agent_builder" in st.session_state.keys()
        and st.session_state.agent_builder is not None
        and "agent_registry" in st.session_state.keys()
    ):
        agent_builder = cast(RAGAgentBuilder, st.session_state.agent_builder)
        agent_registry = cast(AgentCacheRegistry, st.session_state.agent_registry)
        ### Delete agent
        # remove saved agent from directory
        agent_registry.delete_agent_cache(agent_builder.cache.agent_id)
        # Update Radio Buttons: update selected agent to the new id
        update_selected_agent_with_id(None)
    else:
        raise ValueError("Agent builder is None. Cannot delete agent.")


st.set_page_config(
    page_title="RAG Pipeline Config",
    page_icon="🦙",
    layout="centered",
    initial_sidebar_state="auto",
    menu_items=None,
)
st.title("RAG Pipeline Config")

current_state = get_current_state()
add_sidebar()


if current_state.agent_builder is not None:

    st.info(f"Viewing config for agent: {current_state.cache.agent_id}", icon="ℹ️")

    agent_id_st = st.text_input(
        "Agent ID", value=current_state.cache.agent_id, key="agent_id_st"
    )

    if current_state.cache.system_prompt is None:
        system_prompt = ""
    else:
        system_prompt = current_state.cache.system_prompt
    sys_prompt_st = st.text_area(
        "System Prompt", value=system_prompt, key="sys_prompt_st"
    )

    rag_params = cast(RAGParams, current_state.cache.rag_params)

    with st.expander("Loaded Data (Expand to view)"):
        file_names = st.text_input(
            "File names (not editable)",
            value=",".join(current_state.cache.file_names),
            disabled=True,
        )
        directory = st.text_input(
            "Directory (not editable)",
            value=current_state.cache.directory,
            disabled=True,
        )
        urls = st.text_input(
            "URLs (not editable)",
            value=",".join(current_state.cache.urls),
            disabled=True,
        )

    include_summarization_st = st.checkbox(
        "Include Summarization (only works for GPT-4)",
        value=rag_params.include_summarization,
        key="include_summarization_st",
    )

    # add web tool
    additional_tools_st = st.text_input(
        "Additional tools (currently only supports 'web_search')",
        value=",".join(current_state.cache.tools),
        key="additional_tools_st",
    )

    top_k_st = st.number_input("Top K", value=rag_params.top_k, key="top_k_st")
    chunk_size_st = st.number_input(
        "Chunk Size", value=rag_params.chunk_size, key="chunk_size_st"
    )
    embed_model_st = st.text_input(
        "Embed Model", value=rag_params.embed_model, key="embed_model_st"
    )
    llm_st = st.text_input("LLM", value=rag_params.llm, key="llm_st")
    if current_state.cache.agent is not None:
        st.button("Update Agent", on_click=update_agent)
        st.button(":red[Delete Agent]", on_click=delete_agent)
    else:
        # show text saying "agent not created"
        st.info("Agent not created. Please create an agent in the above section.")

else:
    st.info("No agent builder found. Please create an agent in the above section.")

```

### Core Architecture Module: `pages/3_🤖_Generated_RAG_Agent.py`
```
"""Streamlit page showing builder config."""
import streamlit as st
from st_utils import add_sidebar, get_current_state
from core.utils import get_image_and_text_nodes
from llama_index.schema import MetadataMode
from llama_index.chat_engine.types import AGENT_CHAT_RESPONSE_TYPE
from typing import Dict, Optional
import pandas as pd


####################
#### STREAMLIT #####
####################


st.set_page_config(
    page_title="Generated RAG Agent",
    page_icon="🦙",
    layout="centered",
    initial_sidebar_state="auto",
    menu_items=None,
)
st.title("Generated RAG Agent")

current_state = get_current_state()
add_sidebar()

if (
    "agent_messages" not in st.session_state.keys()
):  # Initialize the chat messages history
    st.session_state.agent_messages = [
        {"role": "assistant", "content": "Ask me a question!"}
    ]


def display_sources(response: AGENT_CHAT_RESPONSE_TYPE) -> None:
    image_nodes, text_nodes = get_image_and_text_nodes(response.source_nodes)
    if len(image_nodes) > 0 or len(text_nodes) > 0:
        with st.expander("Sources"):
            # get image nodes
            if len(image_nodes) > 0:
                st.subheader("Images")
                for image_node in image_nodes:
                    st.image(image_node.metadata["file_path"])

            if len(text_nodes) > 0:
                st.subheader("Text")
                sources_df_list = []
                for text_node in text_nodes:
                    sources_df_list.append(
                        {
                            "ID": text_node.id_,
                            "Text": text_node.node.get_content(
                                metadata_mode=MetadataMode.ALL
                            ),
                        }
                    )
                sources_df = pd.DataFrame(sources_df_list)
                st.dataframe(sources_df)


def add_to_message_history(
    role: str, content: str, extra: Optional[Dict] = None
) -> None:
    message = {"role": role, "content": str(content), "extra": extra}
    st.session_state.agent_messages.append(message)  # Add response to message history


def display_messages() -> None:
    """Display messages."""
    for message in st.session_state.agent_messages:  # Display the prior chat messages
        with st.chat_message(message["role"]):
            msg_type = message["msg_type"] if "msg_type" in message.keys() else "text"
            if msg_type == "text":
                st.write(message["content"])
            elif msg_type == "info":
                st.info(message["content"], icon="ℹ️")
            else:
                raise ValueError(f"Unknown message type: {msg_type}")

            # display sources
            if "extra" in message and isinstance(message["extra"], dict):
                if "response" in message["extra"].keys():
                    display_sources(message["extra"]["response"])


# if agent is created, then we can chat with it
if current_state.cache is not None and current_state.cache.agent is not None:
    st.info(f"Viewing config for agent: {current_state.cache.agent_id}", icon="ℹ️")
    agent = current_state.cache.agent

    # display prior messages
    display_messages()

    # don't process selected for now
    if prompt := st.chat_input(
        "Your question"
    ):  # Prompt for user input and save to chat history
        add_to_message_history("user", prompt)
        with st.chat_message("user"):
            st.write(prompt)

    # If last message is not from assistant, generate a new response
    if st.session_state.agent_messages[-1]["role"] != "assistant":
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                response = agent.chat(str(prompt))
                st.write(str(response))

                # display sources
                # Multi-modal: check if image nodes are present
                display_sources(response)

                add_to_message_history(
                    "assistant", str(response), extra={"response": response}
                )
else:
    st.info("Agent not created. Please create an agent in the above section.")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #64** (2024-02-25): **Add docker**
  *Symptoms*: Sorry, I made a mistake.

- **Issue #62** (2024-02-02): **Create test_rags.py**
  *Symptoms*: 

- **Issue #61** (2024-02-02): **any way to support micorosft azure open ai?and how to config?**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > use  from llama_index.llms import OpenAI from llama_index.llms import AzureOpenAI

- **Issue #55** (2024-01-04): **[ENH] can we use azure openai endpoints?**
  *Symptoms*: Hi.  What would be needed in order to use azure openai endpoints? I think some changes in utils/_resolve_llm are certainly needed?  Any advice? I'd like to work on this topic, but I was thinking that someone else might have alreadt thought about that and could provide some feedback.  Cheers 
  **Post-Mortem & Fix Analysis**:
  > +1
  > You can check the documentation on [Azure OpenAI](https://docs.llamaindex.ai/en/stable/examples/llm/azure_openai.html) for which we have already an integration and can be used straightforwardly.

- **Issue #53** (2023-12-07): **"Update Agent" creates an error and deletes the Agent**
  *Symptoms*: After creating an agent and navigating to "RAG Config" for the purpose of selecting the checkbox labeled "Include Summarization (only works for GPT-4)" an error is produced and the Agent is deleted after clicking "Update Agent".  Error: ![image](https://github.com/run-llama/rags/assets/133713208/90d3a231-d324-4406-a3dd-70d573fc6dfa) 
  **Post-Mortem & Fix Analysis**:
  > The only way I have been able to get this to work is by asking for it to:  ```Please "Include Summarization" for this agent.```  However when the browser is refreshed, it reverts to an unchecked state.
  > > The only way I have been able to get this to work is by asking for it to: >  > `Please "Include Summarization" for this agent.` >  > However when the browser is refreshed, it reverts to an unchecked state.  Just to be sure - are you sure that your openai key is loaded up and that when you make your change you are hitting the update button ![image](https://github.com/run-llama/rags/assets/1598572/643184d7-3852-4d60-85b6-e64d31af5ce6) 
  > That isn't/wasn't the issue, however this seems to have been fixed in the latest update. 

- **Issue #49** (2023-12-05): **upgrade v3**
  *Symptoms*: - support multi-modality - allow loading an entire directory (and all the files in the directory)  - add sources in the response

- **Issue #47** (2023-12-05): **BadRequestError: Error code: 400 & General Observations**
  *Symptoms*: @jerryjliu was having a great session building out a bot. then things started to get weird. the conversation on Home - setting up the  bot - I could not really tell if I was getting RAGs advice and information or general GPT4. That is, after a while it seemed the setup process was being hallucinated. I then went to Generated RAG Agent to test how much of the system prompt conversation was internalized. The results we pretty poor. I copied and pasted the conversation from the generated agent and fed to the Home (need to have names for these different actors, it's confusing) and asked home if they were good responses or not. I says that they were not. we talk about modifications. it does them. the results are no better so we do the same and when I go to test the latest tweak, I go to GenRAG and my first prompt is can you try that last one again.. then poof   BadRequestError: Error code: 400 - {'error': {'message': "Invalid value for 'content': expected a string, got null.", 'type': 'invalid_request_error', 'param': 'messages.[122].content', 'code': None}}  While this is probably some trivial issue, I believe there are issues to address regarding the general behavior of the system and how some aspects present to the user.   To that end, I have attached my project (minus the .toml with my key) I have also copy/pasted the conversations from both Home and GenRAG - they are in the folder _trouble.  Please let me know if there is anyway I can be helpful. I need this to be awe
  **Post-Mortem & Fix Analysis**:
  > closing this as it has not happened again 

- **Issue #46** (2023-12-03): **refactor code **
  *Symptoms*: refactored agent_utils.py into separate files, improved state-handling logic within the streamlit files themselves   bump version to 0.0.4

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

### Incident Patch 1: `cbf4ad94` (2023-11-23)
**Commit Message**: hotfix non-openai LLMs  (#20)

**File**: `agent_utils.py` (modified, +14/-9)
```diff
@@ -20,6 +20,7 @@
 from llama_index.agent.types import BaseAgent
 from llama_index.agent.react.formatter import ReActChatFormatter
 from llama_index.llms.openai_utils import is_function_calling_model
+from llama_index.chat_engine import CondensePlusContextChatEngine
 from builder_config import BUILDER_LLM
 from typing import Dict, Tuple, Any
 import streamlit as st
@@ -88,9 +89,11 @@ def load_agent(
     tools: List, 
     llm: LLM, 
     system_prompt: str,
+    extra_kwargs: Optional[Dict] = None,
     **kwargs: Any
 ) -> BaseAgent:
     """Load agent."""
+    extra_kwargs = extra_kwargs or {}
     if isinstance(llm, OpenAI) and is_function_calling_model(llm.model):
         # get OpenAI Agent
         agent = OpenAIAgent.from_tools(
@@ -100,14 +103,15 @@ def load_agent(
             **kwargs
         )
     else:
-        agent = ReActAgent.from_tools(
-            tools=tools,
-            llm=llm,
-            react_chat_formatter=ReActChatFormatter(
-                system_header=system_prompt + "\n" + REACT_CHAT_SYSTEM_HEADER,
-            ),
-            **kwargs
+        if "vector_index" not in extra_kwargs:
+            raise ValueError("Must pass in vector index for CondensePlusContextChatEngine.")
+        vector_index = cast(VectorStoreIndex, extra_kwargs["vector_index"])
+        rag_params = cast(RAGParams, extra_kwargs["rag_params"])
+        # use condense + context chat engine
+        agent = CondensePlusContextChatEngine.from_defaults(
+            vector_index.as_retriever(similarity_top_k=rag_params.top_k),
         )
+        
     return agent
 
 
@@ -117,7 +121,7 @@ class RAGParams(BaseModel):
     Parameters used to configure a RAG pipeline.
     
     """
-    include_summarization: bool = Field(default=False, description="Whether to include summarization in the RAG pipeline.")
+    include_summarization: bool = Field(default=False, description="Whether to include summarization in the RAG pipeline. (only for GPT-4)")
     top_k: int = Field(default=2, description="Number of documents to retrieve from vector store.")
     chunk_size: int = Field(default=1024, description="Chunk size for vector store.")
     embed_model: str = Field(
@@ -315,7 +319,8 @@ def create_agent(self) -> None:
             return "System prompt not set yet. Please set system prompt first."
 
         agent = load_agent(
-            all_tools, llm=llm, system_prompt=self._cache.system_prompt, verbose=True
+            all_tools, llm=llm, system_prompt=self._cache.system_prompt, verbose=True,
+            extra_kwargs={"vector_index": vector_index, "rag_params": rag_params}
         )
 
         self._cache.agent = agent
```

**File**: `pages/2_⚙️_RAG_Config.py` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
         value=",".join(agent_builder.cache.file_paths),
         disabled=True
     )
-    include_summarization_st = st.checkbox("Include Summarization", value=rag_params.include_summarization)
+    include_summarization_st = st.checkbox("Include Summarization (only works for GPT-4)", value=rag_params.include_summarization)
     top_k_st = st.number_input("Top K", value=rag_params.top_k)
     chunk_size_st = st.number_input("Chunk Size", value=rag_params.chunk_size)
     embed_model_st = st.text_input("Embed Model", value=rag_params.embed_model)
```

#### Recent Merged Pull Requests:
- **PR #64** (closed): Add docker (@nogawanogawa)
- **PR #62** (closed): Create test_rags.py (@z-chchen)
- **PR #49** (2023-12-05): upgrade v3 (@jerryjliu)
- **PR #46** (2023-12-03): refactor code  (@jerryjliu)
- **PR #45** (closed): Update README.md with instructions about raising an issue. (@alexfilothodoros)
- **PR #42** (closed): add Docker support (@kun432)
- **PR #40** (2023-11-30): upgrade: add web search!  (@jerryjliu)
- **PR #33** (2023-11-27): add links  (@jerryjliu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
