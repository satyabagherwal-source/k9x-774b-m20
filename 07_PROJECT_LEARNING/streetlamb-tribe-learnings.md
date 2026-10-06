# Forensic Learning Record (Deep Inspection): StreetLamb/tribe

> **Canonical Artifact**: `07_PROJECT_LEARNING/streetlamb-tribe-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/StreetLamb/tribe](https://github.com/StreetLamb/tribe))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:54:47.337Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StreetLamb/tribe`
- **Description**: Low code tool to rapidly build and coordinate multi-agent teams
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1083 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/app/api/routes/utils.py`
```
from fastapi import APIRouter, Depends
from pydantic.networks import EmailStr

from app.api.deps import get_current_active_superuser
from app.models import Message
from app.utils import generate_test_email, send_email

router = APIRouter()


@router.post(
    "/test-email/",
    dependencies=[Depends(get_current_active_superuser)],
    status_code=201,
)
def test_email(email_to: EmailStr) -> Message:
    """
    Test emails.
    """
    email_data = generate_test_email(email_to=email_to)
    send_email(
        email_to=email_to,
        subject=email_data.subject,
        html_content=email_data.html_content,
    )
    return Message(message="Test email sent")

```

### Core Architecture Module: `backend/app/core/celery_app.py`
```
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.tasks"],
)

celery_app.conf.update(
    result_expires=3600,
)

```

### Core Architecture Module: `backend/app/core/config.py`
```
import secrets
import warnings
from typing import Annotated, Any, Literal

from psycopg.rows import dict_row
from pydantic import (
    AnyUrl,
    BeforeValidator,
    HttpUrl,
    PostgresDsn,
    computed_field,
    model_validator,
)
from pydantic_core import MultiHostUrl
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Self


def parse_cors(v: Any) -> list[str] | str:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, list | str):
        return v
    raise ValueError(v)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    # 60 minutes * 24 hours * 8 days = 8 days
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    DOMAIN: str = "localhost"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"

    @computed_field  # type: ignore[misc]
    @property
    def server_host(self) -> str:
        # Use HTTPS for anything other than local development
        if self.ENVIRONMENT == "local":
            return f"http://{self.DOMAIN}"
        return f"https://{self.DOMAIN}"

    BACKEND_CORS_ORIGINS: Annotated[
        list[AnyUrl] | str, BeforeValidator(parse_cors)
    ] = []

    PROJECT_NAME: str
    SENTRY_DSN: HttpUrl | None = None
    POSTGRES_SERVER: str
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str = ""

    @computed_field  # type: ignore[misc]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
        return MultiHostUrl.build(
            scheme="postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

    # For checkpointer
    SQLALCHEMY_CONNECTION_KWARGS: dict[str, Any] = {
        "autocommit": True,
        "prepare_threshold": 0,
        "row_factory": dict_row,
    }

    @computed_field  # type: ignore[misc]
    @property
    def PG_DATABASE_URI(self) -> str:
        multiHostUrl = MultiHostUrl.build(
            scheme="postgresql",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )
        return str(multiHostUrl)

    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    SMTP_PORT: int = 587
    SMTP_HOST: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    # TODO: update type to EmailStr when sqlmodel supports it
    EMAILS_FROM_EMAIL: str | None = None
    EMAILS_FROM_NAME: str | None = None

    @model_validator(mode="after")
    def _set_default_emails_from(self) -> Self:
        if not self.EMAILS_FROM_NAME:
            self.EMAILS_FROM_NAME = self.PROJECT_NAME
        return self

    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 48

    @computed_field  # type: ignore[misc]
    @property
    def emails_enabled(self) -> bool:
        return bool(self.SMTP_HOST and self.EMAILS_FROM_EMAIL)

    # TODO: update type to EmailStr when sqlmodel supports it
    EMAIL_TEST_USER: str = "test@example.com"
    # TODO: update type to EmailStr when sqlmodel supports it
    FIRST_SUPERUSER: str
    FIRST_SUPERUSER_PASSWORD: str
    USERS_OPEN_REGISTRATION: bool = False

    PROTECTED_NAMES: list[str] = ["user", "ignore", "error"]

    def _check_default_secret(self, var_name: str, value: str | None) -> None:
        if value == "changethis":
            message = (
                f'The value of {var_name} is "changethis", '
                "for security, please change it, at least for deployments."
            )
            if self.ENVIRONMENT == "local":
                warnings.warn(message, stacklevel=1)
            else:
                raise ValueError(message)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        self._check_default_secret("SECRET_KEY", self.SECRET_KEY)
        self._check_default_secret("POSTGRES_PASSWORD", self.POSTGRES_PASSWORD)
        self._check_default_secret(
            "FIRST_SUPERUSER_PASSWORD", self.FIRST_SUPERUSER_PASSWORD
        )

        return self

    # Qdrant
    QDRANT__SERVICE__API_KEY: str
    QDRANT_URL: str = "http://qdrant:6334"
    QDRANT_COLLECTION: str = "uploads"

    # Celery
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    # Embeddings
    DENSE_EMBEDDING_MODEL: str
    SPARSE_EMBEDDING_MODEL: str
    FASTEMBED_CACHE_PATH: str

    MAX_UPLOAD_SIZE: int = 50_000_000

    # LangGraph config
    RECURSION_LIMIT: int = 25


settings = Settings()  # type: ignore

```

### Core Architecture Module: `backend/app/core/db.py`
```
from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.core.graph.skills import managed_skills
from app.models import Skill, User, UserCreate

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/tiangolo/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # from app.core.engine import engine
    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user = crud.create_user(session=session, user_create=user_in)

    existing_skills = session.exec(select(Skill)).all()
    existing_skills_dict = {skill.name: skill for skill in existing_skills}

    current_skill_names = set(managed_skills.keys())

    # Add or update skills in the database
    for skill_name, skill_info in managed_skills.items():
        if skill_name in existing_skills_dict:
            existing_skill = existing_skills_dict[skill_name]
            if existing_skill.description != skill_info.description:
                # Update the existing skill's description
                existing_skill.description = skill_info.description
                session.add(existing_skill)  # Mark the modified object for saving
        else:
            new_skill = Skill(
                name=skill_name,
                description=skill_info.description,
                managed=True,
                owner_id=user.id,
            )
            session.add(new_skill)  # Prepare new skill for addition to the database

    # Delete skills that are no longer in the current code and are managed
    for skill_name in existing_skills_dict:
        if (
            skill_name not in current_skill_names
            and existing_skills_dict[skill_name].managed
        ):
            skill_to_delete = existing_skills_dict[skill_name]
            session.delete(skill_to_delete)

    session.commit()

```

### Core Architecture Module: `backend/app/core/graph/checkpoint/utils.py`
```
import json
from typing import Any
from uuid import uuid4

from langchain_core.documents import Document
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, ToolMessage
from langgraph.checkpoint.base import CheckpointTuple
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg import AsyncConnection

from app.core.config import settings
from app.core.graph.messages import ChatResponse


def convert_checkpoint_tuple_to_messages(
    checkpoint_tuple: CheckpointTuple,
) -> list[ChatResponse]:
    """
    Convert a checkpoint tuple to a list of ChatResponse messages.

    Args:
        checkpoint_tuple (CheckpointTuple): The checkpoint tuple to convert.

    Returns:
        list[ChatResponse]: A list of formatted messages.
    """
    checkpoint = checkpoint_tuple.checkpoint
    all_messages: list[AnyMessage] = (
        checkpoint["channel_values"]["all_messages"]
        + checkpoint["channel_values"]["messages"]
    )
    formatted_messages: list[ChatResponse] = []
    for message in all_messages:
        if (
            isinstance(message, HumanMessage)
            and message.id
            and message.name
            and isinstance(message.content, str)
        ):
            formatted_messages.append(
                ChatResponse(
                    type="human",
                    id=message.id,
                    name=message.name,
                    content=message.content,
                )
            )
        elif (
            isinstance(message, AIMessage)
            and message.id
            and message.name
            and isinstance(message.content, str)
        ):
            formatted_messages.append(
                ChatResponse(
                    type="ai",
                    id=message.id,
                    name=message.name,
                    tool_calls=message.tool_calls,
                    content=message.content,
                )
            )
        elif isinstance(message, ToolMessage) and message.name:
            documents: list[dict[str, Any]] = []
            if message.name == "KnowledgeBase":
                docs: list[Document] = message.artifact
                for doc in docs:
                    documents.append(
                        {
                            "score": doc.metadata["score"],
                            "content": doc.page_content,
                        }
                    )
            formatted_messages.append(
                ChatResponse(
                    type="tool",
                    id=message.tool_call_id,
                    name=message.name,
                    tool_output=json.dumps(message.content),
                    documents=json.dumps(documents),
                )
            )
        else:
            continue

    last_message = all_messages[-1]
    if last_message.type == "ai" and last_message.tool_calls:
        # Check if any tool in last message is asking for human input
        for tool_call in last_message.tool_calls:
            if tool_call["name"] == "AskHuman":
                formatted_messages.append(
                    ChatResponse(
                        type="interrupt",
                        name="human",
                        tool_calls=last_message.tool_calls,
                        id=str(uuid4()),
                    )
                )
                break
        else:
            formatted_messages.append(
                ChatResponse(
                    type="interrupt",
                    name="interrupt",
                    tool_calls=last_message.tool_calls,
                    id=str(uuid4()),
                )
            )
    return formatted_messages


async def get_checkpoint_tuples(thread_id: str) -> CheckpointTuple | None:
    """
    Retrieve the latest checkpoint tuple for a given thread ID.

    Args:
        thread_id (str): The ID of the thread.

    Returns:
        CheckpointTuple: The latest checkpoint tuple.
    """
    async with await AsyncConnection.connect(
        settings.PG_DATABASE_URI, **settings.SQLALCHEMY_CONNECTION_KWARGS
    ) as conn:
        checkpointer = AsyncPostgresSaver(conn=conn)
        checkpoint_tuple = await checkpointer.aget_tuple(
            {"configurable": {"thread_id": thread_id}}
        )
        return checkpoint_tuple

```

### Core Architecture Module: `backend/app/core/graph/members.py`
```
from collections.abc import Mapping, Sequence
from typing import Annotated, Any

from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, AnyMessage
from langchain_core.output_parsers.openai_tools import JsonOutputKeyToolsParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import (
    RunnableConfig,
    RunnableLambda,
    RunnableSerializable,
)
from langchain_core.tools import BaseTool
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langgraph.graph import add_messages
from pydantic import BaseModel, Field
from typing_extensions import NotRequired, TypedDict

from app.core.graph.rag.qdrant import QdrantStore
from app.core.graph.skills import managed_skills
from app.core.graph.skills.api_tool import dynamic_api_tool
from app.core.graph.skills.retriever_tool import create_retriever_tool


class GraphSkill(BaseModel):
    name: str = Field(description="The name of the skill")
    definition: dict[str, Any] | None = Field(
        description="The skill definition. For api tool calling. Optional."
    )
    managed: bool = Field("Whether the skill is managed or user created.")

    @property
    def tool(self) -> BaseTool:
        if self.managed:
            return managed_skills[self.name].tool
        elif self.definition:
            return dynamic_api_tool(self.definition)
        else:
            raise ValueError("Skill is not managed and no definition provided.")


class GraphUpload(BaseModel):
    name: str = Field(description="Name of the upload")
    description: str = Field(description="Description of the upload")
    owner_id: int = Field(description="Id of the user that owns this upload")
    upload_id: int = Field(description="Id of the upload")

    @property
    def tool(self) -> BaseTool:
        retriever = QdrantStore().retriever(self.owner_id, self.upload_id)
        return create_retriever_tool(retriever)


class GraphPerson(BaseModel):
    name: str = Field(description="The name of the person")
    role: str = Field(description="Role of the person")
    provider: str = Field(description="The provider for the llm model")
    model: str = Field(description="The llm model to use for this person")
    base_url: str | None = Field(
        default=None,
        description="Use a proxy to serve llm model",
    )
    temperature: float = Field(description="The temperature of the llm model")
    backstory: str = Field(
        description="Description of the person's experience, motives and concerns."
    )

    @property
    def persona(self) -> str:
        return f"<persona>\nName: {self.name}\nRole: {self.role}\nBackstory: {self.backstory}\n</persona>"


class GraphMember(GraphPerson):
    tools: list[GraphSkill | GraphUpload] = Field(
        description="The list of tools that the person can use."
    )
    interrupt: bool = Field(
        default=False,
        description="Whether to interrupt the person or not before skill use",
    )


# Create a Leader class so we can pass leader as a team member for team within team
class GraphLeader(GraphPerson):
    pass


class GraphTeam(BaseModel):
    name: str = Field(description="The name of the team")
    role: str = Field(description="Role of the team leader")
    backstory: str = Field(
        description="Description of the team leader's experience, motives and concerns."
    )
    members: dict[str, GraphMember | GraphLeader] = Field(
        description="The members of the team"
    )
    provider: str = Field(description="The provider of the team leader's llm model")
    model: str = Field(description="The llm model to use for this team leader")
    base_url: str | None = Field(
        default=None, description="Use a proxy to serve llm model"
    )
    temperature: float = Field(
        description="The temperature of the team leader's llm model"
    )

    @property
    def persona(self) -> str:
        return f"Name: {self.name}\nRole: {self.role}\nBackstory: {self.backstory}\n"


def add_or_replace_messages(
    messages: list[AnyMessage], new_messages: list[AnyMessage]
) -> list[AnyMessage]:
    """Add new messages to the state. If new_messages list is empty, clear messages instead."""
    if not new_messages:
        return []
    else:
        return add_messages(messages, new_messages)  # type: ignore[return-value, arg-type]


def format_messages(messages: list[AnyMessage]) -> str:
    """Format list of messages to string"""
    message_str: str = ""
    for message in messages:
        message_str += f"{message.name}: {message.content}\n\n"
    return message_str


class TeamState(TypedDict):
    all_messages: Annotated[
        list[AnyMessage], add_messages
    ]  # Stores all messages in this thread
    messages: Annotated[list[AnyMessage], add_or_replace_messages]
    history: Annotated[list[AnyMessage], add_messages]
    team: GraphTeam
    next: str
    main_task: list[AnyMessage]
    task: list[
        AnyMessage
    ]  # This is the current task to be perform by a team member. Its a list because Worker's MessagesPlaceholder only accepts list of messages.


# When returning teamstate, is it possible to exclude fields that you dont want to update
class ReturnTeamState(TypedDict):
    all_messages: NotRequired[list[AnyMessage]]
    messages: NotRequired[list[AnyMessage]]
    history: NotRequired[list[AnyMessage]]
    team: NotRequired[GraphTeam]
    next: NotRequired[str | None]  # Returning None is valid for sequential graphs only
    task: NotRequired[list[AnyMessage]]


class BaseNode:
    def __init__(
        self, provider: str, model: str, base_url: str | None, temperature: float
    ):
        # If using proxy, then we need to pass base url
        # TODO: Include ollama here once langchain-ollama bug is fixed
        if provider in ["openai"] and base_url:
            self.model = init_chat_model(
                model,
                model_provider=provider,
                temperature=temperature,
                base_url=base_url,
            )
        elif provider == "ollama":
            self.model = ChatOllama(
                model=model,
                temperature=temperature,
                base_url=base_url if base_url else "http://host.docker.internal:11434",
            )
        else:
            self.model = init_chat_model(
                model, model_provider=provider, temperature=0, streaming=True
            )
        self.final_answer_model = self.model

    def tag_with_name(self, ai_message: AIMessage, name: str) -> AIMessage:
        """Tag a name to the AI message"""
        ai_message.name = name
        return ai_message

    def get_team_members_name(
        self, team_members: Mapping[str, GraphMember | GraphLeader]
    ) -> str:
        """Get the names of all team members as a string"""
        return ",".join(list(team_members))


class WorkerNode(BaseNode):
    worker_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "You are a team member of {team_name} and you are one of the following team members: {team_members_name}.\n"
                    "Your team members (and other teams) will collaborate with you with their own set of skills. "
                    "You are chosen by one of your team member to perform this task. Try your best to perform it using your skills. "
                    "Stay true to your persona and role:\n{persona}\n"
                ),
            ),
            (
                "human",
                "Here is the task: \n\n {task_string} \n\n Here is the previous conversation: \n\n {history_string} \n\n Provide your response.",
            ),
            MessagesPlaceholder(variable_name="messages"),
        ]
    )

    def convert_output_to_ai_message(self, agent_output: dict[str, str]) -> AIMessage:
        """Convert agent executor output to ai message"""
        output = agent_output["output"]
        return AIMessage(content=output)

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:
        name = state["next"]
        member = state["team"].members[name]
        assert isinstance(member, GraphMember), "member is unexpectedly not a Member"
        team_members_name = self.get_team_members_name(state["team"].members)
        prompt = self.worker_prompt.partial(
            team_name=state["team"].name,
            team_members_name=team_members_name,
            persona=member.persona,
            history_string=format_messages(state["history"]),
            task_string=format_messages(state["task"]),
        )
        # If member has no tools, then use a regular model instead of an agent
        if len(member.tools) >= 1:
            tools: Sequence[BaseTool] = [tool.tool for tool in member.tools]
            chain = prompt | self.model.bind_tools(tools)
        else:
            chain: RunnableSerializable[dict[str, Any], AnyMessage] = (  # type: ignore[no-redef]
                prompt | self.model
            )
        work_chain: RunnableSerializable[dict[str, Any], Any] = chain | RunnableLambda(
            self.tag_with_name  # type: ignore[arg-type]
        ).bind(name=member.name)
        result: AIMessage = await work_chain.ainvoke(state, config)  # type: ignore[arg-type]
        if result.tool_calls:
            return {"messages": [result]}
        else:
            return {
                "history": [result],
                "messages": [],
                "all_messages": state["messages"] + [result],
            }


class SequentialWorkerNode(WorkerNode):
    """Perform Sequential Worker actions"""

    worker_prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "Perform the task given to you.\n"
                    "If you are unable to perform the task, that's OK, another member with different tools "
```

### Core Architecture Module: `backend/app/core/graph/messages.py`
```
import json
from typing import Any

from langchain_core.documents import Document
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    HumanMessage,
    HumanMessageChunk,
    ToolCall,
    ToolMessage,
    ToolMessageChunk,
)
from langchain_core.runnables.schema import StreamEvent
from pydantic import BaseModel


class ChatResponse(BaseModel):
    type: str  # ai | human | tool
    id: str
    name: str
    content: str | None = None
    tool_calls: list[ToolCall] | None = None
    tool_output: str | None = None
    documents: str | None = None
    next: str | None = None


def get_message_type(message: Any) -> str | None:
    """Return the message's type"""
    if isinstance(message, HumanMessage) or isinstance(message, HumanMessageChunk):
        return "human"
    elif isinstance(message, AIMessage) or isinstance(message, AIMessageChunk):
        return "ai"
    elif isinstance(message, ToolMessage) or isinstance(message, ToolMessageChunk):
        return "tool"
    else:
        return None


def event_to_response(event: StreamEvent, streaming: bool) -> ChatResponse | None:
    """Convert event to ChatResponse"""
    kind = event["event"]
    id = event["run_id"]
    # Either listen to stream or end based on streaming arg
    chat_model_event_kind = "on_chat_model_stream" if streaming else "on_chat_model_end"
    if kind == chat_model_event_kind:
        name = event["metadata"]["langgraph_node"]
        chat_message: AIMessage | AIMessageChunk = (
            event["data"]["chunk"]
            if kind == "on_chat_model_stream"
            else event["data"]["output"]
        )
        type = get_message_type(chat_message)
        content: str = ""
        if isinstance(chat_message.content, list):
            for c in chat_message.content:
                if isinstance(c, str):
                    content += c
                elif isinstance(c, dict):
                    content += c.get("text", "")
        else:
            content = chat_message.content
        tool_calls = chat_message.tool_calls
        if content and type:
            return ChatResponse(
                type=type, id=id, name=name, content=content, tool_calls=tool_calls
            )
    elif kind == "on_chat_model_end":
        message: AIMessage = event["data"]["output"]
        name = event["metadata"]["langgraph_node"]
        tool_calls = message.tool_calls
        if tool_calls:
            return ChatResponse(
                type="tool",
                id=id,
                name=name,
                tool_calls=tool_calls,
            )

    elif kind == "on_tool_end":
        tool_output: ToolMessage | None = event["data"].get("output")
        tool_name = event["name"]
        # If tool is , KnowledgeBase then serialise the documents in artifact
        documents: list[dict[str, Any]] = []
        if tool_output and tool_output.name == "KnowledgeBase":
            docs: list[Document] = tool_output.artifact
            for doc in docs:
                documents.append(
                    {
                        "score": doc.metadata["score"],
                        "content": doc.page_content,
                    }
                )
        if tool_output:
            return ChatResponse(
                type="tool",
                id=id,
                name=tool_name,
                tool_output=json.dumps(tool_output.content),
                documents=json.dumps(documents),
            )
    # elif kind == "on_parser_end":
    #     content: str = event["data"]["output"].get("task")
    #     next = event["data"]["output"].get("next")
    #     name = event["metadata"]["langgraph_node"]
    #     return ChatResponse(
    #         type=get_message_type(event["data"]["input"]),
    #         id=id,
    #         name=name,
    #         content=content,
    #         next=next,
    #     )
    return None

```

### Core Architecture Module: `backend/app/core/graph/rag/qdrant.py`
```
from collections.abc import Callable
from typing import Any

import pymupdf  # type: ignore[import-untyped]
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest

from app.core.config import settings
from app.core.graph.rag.qdrant_retriever import QdrantRetriever


class QdrantStore:
    """
    A class to handle uploading and searching documents in a Qdrant vector store.
    """

    collection_name = settings.QDRANT_COLLECTION
    url = settings.QDRANT_URL

    def __init__(self) -> None:
        self.client = self._create_collection()

    def add(
        self,
        file_path: str,
        upload_id: int,
        user_id: int,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        callback: Callable[[], None] | None = None,
    ) -> None:
        """
        Uploads a PDF document to the Qdrant vector store after converting it to markdown and splitting into chunks.

        Args:
            upload_name (str): The name of the upload (PDF file path).
            user_id (int): The ID of the user uploading the document.
            chunk_size (int, optional): The size of each text chunk. Defaults to 500.
            chunk_overlap (int, optional): The overlap size between chunks. Defaults to 50.
        """
        doc = pymupdf.open(file_path)
        documents = [
            Document(
                page_content=page.get_text().encode("utf8"),
                metadata={"user_id": user_id, "upload_id": upload_id},
            )
            for page in doc
        ]
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        docs = text_splitter.split_documents(documents)

        doc_texts: list[str] = []
        metadata: list[dict[Any, Any]] = []
        for doc in docs:
            doc_texts.append(doc.page_content)
            metadata.append(doc.metadata)

        self.client.add(
            collection_name=self.collection_name,
            documents=doc_texts,
            metadata=metadata,
        )

        callback() if callback else None

    def _create_collection(self) -> QdrantClient:
        """
        Creates a collection in Qdrant if it does not already exist, configured for hybrid search.

        The collection uses both dense and sparse vector models. Returns an instance of the Qdrant client.

        Returns:
            QdrantClient: An instance of the Qdrant client.
        """
        client = QdrantClient(
            url=self.url, api_key=settings.QDRANT__SERVICE__API_KEY, prefer_grpc=True
        )
        client.set_model(settings.DENSE_EMBEDDING_MODEL)
        client.set_sparse_model(settings.SPARSE_EMBEDDING_MODEL)
        if not client.collection_exists(self.collection_name):
            client.create_collection(
                collection_name=self.collection_name,
                vectors_config=client.get_fastembed_vector_params(),
                sparse_vectors_config=client.get_fastembed_sparse_vector_params(),
            )
        return client

    def delete(self, upload_id: int, user_id: int) -> None:
        """Delete points from collection where upload_id and user_id in metadata matches."""
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=rest.FilterSelector(
                filter=rest.Filter(
                    must=[
                        rest.FieldCondition(
                            key="user_id",
                            match=rest.MatchValue(value=user_id),
                        ),
                        rest.FieldCondition(
                            key="upload_id",
                            match=rest.MatchValue(value=upload_id),
                        ),
                    ]
                )
            ),
        )

    def update(
        self,
        file_path: str,
        upload_id: int,
        user_id: int,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        callback: Callable[[], None] | None = None,
    ) -> None:
        """Delete and re-upload the new PDF document to the Qdrant vector store"""
        self.delete(user_id, upload_id)
        self.add(file_path, upload_id, user_id, chunk_size, chunk_overlap)
        callback() if callback else None

    def retriever(self, user_id: int, upload_id: int) -> QdrantRetriever:
        """
        Creates a VectorStoreRetriever that retrieves results containing the specified user_id and upload_id in the metadata.

        Args:
            user_id (int): Filters the retriever results to only include those belonging to this user.
            upload_id (int): Filters the retriever results to only include those from this upload ID.

        Returns:
            VectorStoreRetriever: A VectorStoreRetriever instance.
        """
        retriever = QdrantRetriever(
            client=self.client,
            collection_name=self.collection_name,
            search_kwargs=rest.Filter(
                must=[
                    rest.FieldCondition(
                        key="user_id",
                        match=rest.MatchValue(value=user_id),
                    ),
                    rest.FieldCondition(
                        key="upload_id",
                        match=rest.MatchValue(value=upload_id),
                    ),
                ],
            ),
        )
        return retriever

    def search(self, user_id: int, upload_ids: list[int], query: str) -> list[Document]:
        """
        Performs a similarity search in the Qdrant vector store for a given query, filtered by user ID and upload names.

        Args:
            user_id (str): The ID of the user performing the search.
            upload_names (list[str]): A list of upload names to filter the search.
            query (str): The search query.

        Returns:
            List[Document]: A list of documents matching the search criteria.
        """
        search_results = self.client.query(
            collection_name=self.collection_name,
            query_text=query,
            query_filter=rest.Filter(
                must=[
                    rest.FieldCondition(
                        key="user_id",
                        match=rest.MatchValue(value=user_id),
                    ),
                    rest.FieldCondition(
                        key="upload_id",
                        match=rest.MatchAny(any=upload_ids),
                    ),
                ],
            ),
        )
        documents: list[Document] = []
        for result in search_results:
            document = Document(
                page_content=result.document,
                metadata={"score": result.score},
            )
            documents.append(document)
        return documents

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #142** (2024-09-13): **Fix bug with self.final_answer_model in members.py to resolve model configuration inconsistencies**
  *Symptoms*: fix final_answer_model in members.py to use the model configuration provided by user to resolve issues with configuration inconsistency between member models & final model.  This resolves issues where a user may specify the ollama model or any model that requires custom parameters like "base_url" that fail to be properly configured in the final_answer_model object thus resulting in errors (potentially due to final_answer_model resolving the wrong model to be used or due to it using defaults due to missing parameter configurations).  
  **Post-Mortem & Fix Analysis**:
  > Thank you!

- **Issue #134** (2024-08-29): **Fix threads table overflowing if query text is long**
  *Symptoms*: 

- **Issue #133** (2024-08-29): **Set max-memory-per-child value for celery to fix memory leak issue**
  *Symptoms*: Fix potential memory leak issue in celery container by setting a max memory limit for the celery worker process so that it is replaced if memory exceeds.

- **Issue #121** (2024-08-17): **Fix unable to delete thread bug**
  *Symptoms*: Fixes #120. Unable to delete threads due to foreign key constraint not set to cascade delete.

- **Issue #108** (2024-08-07): **Get an error "self.crypto.randomUUID is not a function"**
  *Symptoms*: ### Discussed in https://github.com/StreetLamb/tribe/discussions/106  <div type='discussions-op-text'>  <sup>Originally posted by **aznoks** August  7, 2024</sup> I get an error to any questions in chat when stack deployed with custom domain or IP, based on deployment process in https://github.com/StreetLamb/tribe/blob/master/development.md: <img width="577" alt="image" src="https://github.com/user-attachments/assets/f3f6ddbb-bef4-4440-8587-e2aa9c8a81ac">  env file: ``` # Domain # This would be set to the production domain with an env var on deployment DOMAIN=tribe.example.com  # Username and Password for Traefik HTTP Basic Auth USERNAME=admin HASHED_PASSWORD=$apr1$7UvB4Qa3$9W8H0tmwFbQ9MYljwkbCJ. # password=changethis  # Environment: local, staging, production ENVIRONMENT=local  PROJECT_NAME="Tribe" STACK_NAME=tribe  # Backend BACKEND_CORS_ORIGINS="http://localhost,http://localhost:5173,https://localhost,https://localhost:5173,http://localhost.tribe.com,http://tribe.example.com,http://tribe.example.com:5173,https://tribe.example.com" SECRET_KEY=q-Fc8nmLGFN_NWoJj2lk8r32aTejCjKfT0jqOaRcWHw FIRST_SUPERUSER=admin@tribe.com FIRST_SUPERUSER_PASSWORD=password USERS_OPEN_REGISTRATION=False MAX_UPLOAD_SIZE=50_000_000 MAX_WORKERS=1 # Sets the number of processes  # llm provider keys. Add only to models that you want to use OPENAI_API_KEY= ANTHROPIC_API_KEY=  # Embedding model. See the list of supported models: https://qdrant.github.io/fastembed/exam

- **Issue #107** (2024-08-07): **Use uuid library instead of self.crypto.randomUUID()**
  *Symptoms*: Fixes #108   [self.crypto.randomUUID()](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) is available only in secure context (HTTPS). This might break the app if running on non-secure origin. Use uuid library to prevent issues.

- **Issue #104** (2024-08-04): **show uploads selected as tags on MemberNode and FreelancerNode**
  *Symptoms*: 

- **Issue #99** (2024-08-03): **Fix read threads result order**
  *Symptoms*: Threads listed in threads page is not in descending order for non-admins

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

### Incident Patch 1: `0cb599a3` (2024-08-29)
**Commit Message**: Fix threads table overflowing if query text is long (#134)

**File**: `frontend/src/components/Teams/ViewThreads.tsx` (modified, +2/-5)
```diff
@@ -1,7 +1,6 @@
 import {
   Flex,
   Spinner,
-  Container,
   TableContainer,
   Table,
   Thead,
@@ -84,7 +83,6 @@ const ChatHistory = ({ teamId, updateTabIndex }: ChatHistoryProps) => {
         </Flex>
       ) : (
         threads && (
-          <Container maxW="full">
             <TableContainer>
               <Table size={{ base: "sm", md: "md" }}>
                 <Thead>
@@ -95,7 +93,7 @@ const ChatHistory = ({ teamId, updateTabIndex }: ChatHistoryProps) => {
                     <Th>Actions</Th>
                   </Tr>
                 </Thead>
-                <Tbody>
+                <Tbody width={"2rem"}>
                   {threads.data.map((thread) => (
                     <Tr
                       key={thread.id}
@@ -104,7 +102,7 @@ const ChatHistory = ({ teamId, updateTabIndex }: ChatHistoryProps) => {
                       cursor={"pointer"}
                     >
                       <Td>{new Date(thread.updated_at).toLocaleString()}</Td>
-                      <Td>{thread.query}</Td>
+                      <Td maxW="20rem" overflow="hidden" textOverflow="ellipsis">{thread.query}</Td>
                       <Td>{thread.id}</Td>
                       <Td>
                         <IconButton
@@ -119,7 +117,6 @@ const ChatHistory = ({ teamId, updateTabIndex }: ChatHistoryProps) => {
                 </Tbody>
               </Table>
             </TableContainer>
-          </Container>
         )
       )}
     </>
```

---

### Incident Patch 2: `f6341956` (2024-08-29)
**Commit Message**: Set max-memory-per-child value for celery to fix memory leak issue (#133)

**File**: `.env.example` (modified, +3/-0)
```diff
@@ -66,3 +66,6 @@ QDRANT__SERVICE__API_KEY=changethis
 
 # Flower
 FLOWER_BASIC_AUTH=admin:changethis
+
+# Celery
+MAX_MEMORY_PER_CHILD='512000' # Useful for potential memory leaks - default 500MB
```

**File**: `docker-compose.yml` (modified, +1/-1)
```diff
@@ -143,7 +143,7 @@ services:
     volumes:
       - app-backend-model-cache:/app/cache
       - app-upload-data:/app/upload-data
-    command: poetry run celery -A app.core.celery_app.celery_app worker --loglevel=info --uid=celery --gid=celery
+    command: poetry run celery -A app.core.celery_app.celery_app worker --loglevel=info --uid=celery --gid=celery --max-memory-per-child=${MAX_MEMORY_PER_CHILD?Varible not set}
     depends_on:
       - redis
       - backend
```

---

### Incident Patch 3: `458f9f24` (2024-08-17)
**Commit Message**: Fix CheckpointBlobs relationship with Thread model (#121)

**File**: `backend/app/models.py` (modified, +4/-0)
```diff
@@ -206,6 +206,9 @@ class Thread(ThreadBase, table=True):
     checkpoints: list["Checkpoint"] = Relationship(
         back_populates="thread", sa_relationship_kwargs={"cascade": "delete"}
     )
+    checkpoint_blobs: list["CheckpointBlobs"] = Relationship(
+        back_populates="thread", sa_relationship_kwargs={"cascade": "delete"}
+    )
     writes: list["Write"] = Relationship(
         back_populates="thread", sa_relationship_kwargs={"cascade": "delete"}
     )
@@ -406,6 +409,7 @@ class CheckpointBlobs(SQLModel, table=True):
     version: str = Field(primary_key=True)
     type: str
     blob: bytes | None
+    thread: Thread = Relationship(back_populates="checkpoint_blobs")
 
 
 class CheckpointOut(SQLModel):
```

---

### Incident Patch 4: `376fd993` (2024-08-07)
**Commit Message**: Use uuid library instead of self.crypto.randomUUID() to prevent crash in non-secure context (#107)

**File**: `frontend/package-lock.json` (modified, +31/-0)
```diff
@@ -26,6 +26,7 @@
         "react-markdown": "^9.0.1",
         "react-query": "3.39.3",
         "reactflow": "^11.11.1",
+        "uuid": "^10.0.0",
         "zustand": "4.5.0"
       },
       "devDependencies": {
@@ -35,6 +36,7 @@
         "@types/node": "20.10.5",
         "@types/react": "^18.2.37",
         "@types/react-dom": "^18.2.15",
+        "@types/uuid": "^10.0.0",
         "@vitejs/plugin-react-swc": "^3.5.0",
         "openapi-typescript-codegen": "0.25.0",
         "typescript": "^5.2.2",
@@ -3051,6 +3053,12 @@
       "resolved": "https://registry.npmjs.org/@types/unist/-/unist-3.0.2.tgz",
       "integrity": "sha512-dqId9J8K/vGi5Zr7oo212BGii5m3q5Hxlkwy3WpYuKPklmBEvsbMYYyLxAQpSffdLl/gdW0XUpKWFvYmyoWCoQ=="
     },
+    "node_modules/@types/uuid": {
+      "version": "10.0.0",
+      "resolved": "https://registry.npmjs.org/@types/uuid/-/uuid-10.0.0.tgz",
+      "integrity": "sha512-7gqG38EyHgyP1S+7+xomFtL+ZNHcKv6DwNaCZmJmo1vgMugyF3TCnXVg4t1uk89mLNwnLtnY3TpOpCOyp1/xHQ==",
+      "dev": true
+    },
     "node_modules/@ungap/structured-clone": {
       "version": "1.2.0",
       "resolved": "https://registry.npmjs.org/@ungap/structured-clone/-/structured-clone-1.2.0.tgz",
@@ -5794,6 +5802,18 @@
         "react": "^16.8.0 || ^17.0.0 || ^18.0.0"
       }
     },
+    "node_modules/uuid": {
+      "version": "10.0.0",
+      "resolved": "https://registry.npmjs.org/uuid/-/uuid-10.0.0.tgz",
+      "integrity": "sha512-8XkAphELsDnEGrDxUOHB3RGvXz6TeuYSGEZBOjtTtPm2lwhGBjLgOzLHB63IUWfBpNucQjND6d3AOudO+H3RWQ==",
+      "funding": [
+        "https://github.com/sponsors/broofa",
+        "https://github.com/sponsors/ctavan"
+      ],
+      "bin": {
+        "uuid": "dist/bin/uuid"
+      }
+    },
     "node_modules/vfile": {
       "version": "6.0.1",
       "resolved": "https://registry.npmjs.org/vfile/-/vfile-6.0.1.tgz",
@@ -8081,6 +8101,12 @@
       "resolved": "https://registry.npmjs.org/@types/unist/-/unist-3.0.2.tgz",
       "integrity": "sha512-dqId9J8K/vGi5Zr7oo212BGii5m3q5Hxlkwy3WpYuKPklmBEvsbMYYyLxAQpSffdLl/gdW0XUpKWFvYmyoWCoQ=="
     },
+    "@types/uuid": {
+      "version": "10.0.0",
+      "resolved": "https://registry.npmjs.org/@types/uuid/-/uuid-10.0.0.tgz",
+      "integrity": "sha512-7gqG38EyHgyP1S+7+xomFtL+ZNHcKv6DwNaCZmJmo1vgMugyF3TCnXVg4t1uk89mLNwnLtnY3TpOpCOyp1/xHQ==",
+      "dev": true
+    },
     "@ungap/structured-clone": {
       "version": "1.2.0",
       "resolved": "https://registry.npmjs.org/@ungap/structured-clone/-/structured-clone-1.2.0.tgz",
@@ -9948,6 +9974,11 @@
       "integrity": "sha512-eEgnFxGQ1Ife9bzYs6VLi8/4X6CObHMw9Qr9tPY43iKwsPw8xE8+EFsf/2cFZ5S3esXgpWgtSCtLNS41F+sKPA==",
       "requires": {}
     },
+    "uuid": {
+      "version": "10.0.0",
+      "resolved": "https://registry.npmjs.org/uuid/-/uuid-10.0.0.tgz",
+      "integrity": "sha512-8XkAphELsDnEGrDxUOHB3RGvXz6TeuYSGEZBOjtTtPm2lwhGBjLgOzLHB63IUWfBpNucQjND6d3AOudO+H3RWQ=="
+    },
     "vfile": {
       "version": "6.0.1",
       "resolved": "https://registry.npmjs.org/vfile/-/vfile-6.0.1.tgz",
```

**File**: `frontend/package.json` (modified, +2/-0)
```diff
@@ -29,6 +29,7 @@
     "react-markdown": "^9.0.1",
     "react-query": "3.39.3",
     "reactflow": "^11.11.1",
+    "uuid": "^10.0.0",
     "zustand": "4.5.0"
   },
   "devDependencies": {
@@ -38,6 +39,7 @@
     "@types/node": "20.10.5",
     "@types/react": "^18.2.37",
     "@types/react-dom": "^18.2.15",
+    "@types/uuid": "^10.0.0",
     "@vitejs/plugin-react-swc": "^3.5.0",
     "openapi-typescript-codegen": "0.25.0",
     "typescript": "^5.2.2",
```

**File**: `frontend/src/components/Teams/ChatTeam.tsx` (modified, +2/-1)
```diff
@@ -49,6 +49,7 @@ import { IoCreateOutline } from "react-icons/io5"
 import { FaCheck, FaTimes } from "react-icons/fa"
 import { fetchEventSource } from "@microsoft/fetch-event-source"
 import { FiCopy } from "react-icons/fi"
+import { v4 } from "uuid"
 
 // possible message types: "ai" | "human" | "tool" | "error" | "interrupt"
 
@@ -366,7 +367,7 @@ const ChatTeam = () => {
       ...prev,
       {
         type: "human",
-        id: self.crypto.randomUUID(),
+        id: v4(),
         content: data.messages[0].content,
         name: "user",
       },
```

---

### Incident Patch 5: `73b75c15` (2024-08-03)
**Commit Message**: Fix read threads order for non-admins (#99)

**File**: `backend/app/api/routes/threads.py` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@ def read_threads(
             .where(Team.owner_id == current_user.id, Thread.team_id == team_id)
             .offset(skip)
             .limit(limit)
+            .order_by(col(Thread.updated_at).desc())
         )
         threads = session.exec(statement).all()
     return ThreadsOut(data=threads, count=count)
```

---

### Incident Patch 6: `fba63e3c` (2024-08-02)
**Commit Message**: Use MultiHostUrl build method to compute PG_DATABASE_URI (#97)

**File**: `backend/app/core/config.py` (modified, +9/-1)
```diff
@@ -69,7 +69,15 @@ def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
     @computed_field  # type: ignore[misc]
     @property
     def PG_DATABASE_URI(self) -> str:
-        return f"postgres://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
+        multiHostUrl = MultiHostUrl.build(
+            scheme="postgresql",
+            username=self.POSTGRES_USER,
+            password=self.POSTGRES_PASSWORD,
+            host=self.POSTGRES_SERVER,
+            port=self.POSTGRES_PORT,
+            path=self.POSTGRES_DB,
+        )
+        return str(multiHostUrl)
 
     SMTP_TLS: bool = True
     SMTP_SSL: bool = False
```

---

### Incident Patch 7: `d583f23f` (2024-08-01)
**Commit Message**: Enhance nodes UI to display useful information at a glance (#93)

* Enhance ui for freelancer, member and root nodes

* Add label on sequential node handle to show if interrupt is enabled

* Change edit member button color to same as connnection line. Make interrupt text smaller but bold

**File**: `frontend/src/components/ReactFlow/Nodes/FreelancerNode.tsx` (modified, +69/-24)
```diff
@@ -1,18 +1,17 @@
 import {
-  Box,
-  Icon,
   IconButton,
-  Stack,
   useColorModeValue,
   useDisclosure,
   Text,
+  Grid,
+  GridItem,
+  Tag,
 } from "@chakra-ui/react"
 import type { NodeProps } from "reactflow"
 import { Position } from "reactflow"
 import { EditMember } from "../../Members/EditMember"
 import type { MemberOut } from "../../../client"
 import { FiEdit2 } from "react-icons/fi"
-import { GrUserWorker } from "react-icons/gr"
 import LimitConnectionHandle from "../Handles/LimitConnectionHandle"
 
 export type FreelancerNodeData = {
@@ -25,32 +24,64 @@ export function FreelancerNode({ data }: NodeProps<FreelancerNodeData>) {
   const bgColor = useColorModeValue("gray.50", "ui.darkSlate")
 
   return (
-    <Box w="15rem" p={2} boxShadow="base" borderRadius="lg" bgColor={bgColor}>
-      <Stack direction="row" spacing={2} align="center" w="full">
-        <Icon as={GrUserWorker} boxSize={5} color="gray.400" />
-        <Stack spacing={0} w="70%">
-          <Text fontWeight="bold" noOfLines={1}>
-            {data.member.name}
-          </Text>
-          <Text fontSize="x-small" noOfLines={2}>
-            {data.member.role}
-          </Text>
-        </Stack>
+    <Grid
+      w="15rem"
+      templateColumns={"repeat(6,1fr)"}
+      templateRows={"repeat(auto-fill, 0.5fr)"}
+      p={1.5}
+      boxShadow="base"
+      borderRadius="lg"
+      bgColor={bgColor}
+      gap={1}
+    >
+      <GridItem colSpan={5}>
+        <Text fontWeight={"bold"} noOfLines={1}>
+          {data.member.name}
+        </Text>
+      </GridItem>
+      <GridItem colStart={6} justifySelf={"end"}>
         <IconButton
+          color="#009688"
           size="xs"
+          fontSize={"xx-small"}
           aria-label="Edit Member"
           icon={<FiEdit2 />}
           onClick={editMemberModal.onOpen}
           variant="outline"
           colorScheme="blue"
         />
-      </Stack>
-      <EditMember
-        isOpen={editMemberModal.isOpen}
-        onClose={editMemberModal.onClose}
-        teamId={data.teamId}
-        member={data.member}
-      />
+        <EditMember
+          isOpen={editMemberModal.isOpen}
+          onClose={editMemberModal.onClose}
+          teamId={data.teamId}
+          member={data.member}
+        />
+      </GridItem>
+      <GridItem colSpan={6}>
+        <Text fontSize="xx-small" noOfLines={2}>
+          {data.member.role}
+        </Text>
+      </GridItem>
+      <GridItem colSpan={6} maxW={"full"}>
+        <Tag size="sm" colorScheme="blue" mt="0.2rem" mb={0}>
+          <Text fontSize="xx-small" noOfLines={1}>
+            {data.member.model}
+          </Text>
+        </Tag>
+      </GridItem>
+      <GridItem colSpan={6} maxW={"full"} noOfLines={1}>
+        {data.member.skills.map((skill, index) => (
+          <Tag
+            key={index}
+            size="sm"
+            fontSize="xx-small"
+            colorScheme="purple"
+            mr={0.5}
+          >
+            {skill.name}
+          </Tag>
+        ))}
+      </GridItem>
       {data.member.type !== "freelancer_root" && (
         <LimitConnectionHandle
           type="target"
@@ -62,7 +93,21 @@ export function FreelancerNode({ data }: NodeProps<FreelancerNodeData>) {
         type="source"
         position={Position.Bottom}
         connectionLimit={1}
-      />
-    </Box>
+      >
+        {data.member.interrupt && (
+          <Text
+            fontSize="xx-small"
+            fontWeight={"bold"}
+            color="orange"
+            position={"absolute"}
+            left="3"
+            top="1"
+            width="10rem"
+          >
+            Approval Required
+          </Text>
+        )}
+      </LimitConnectionHandle>
+    </Grid>
   )
 }
```

**File**: `frontend/src/components/ReactFlow/Nodes/MemberNode.tsx` (modified, +59/-30)
```diff
@@ -1,18 +1,17 @@
 import {
-  Box,
-  Icon,
   IconButton,
-  Stack,
   useColorModeValue,
   useDisclosure,
   Text,
+  Grid,
+  Tag,
+  GridItem,
 } from "@chakra-ui/react"
 import type { NodeProps } from "reactflow"
 import { Handle, Position } from "reactflow"
 import { EditMember } from "../../Members/EditMember"
 import type { MemberOut } from "../../../client"
 import { FiEdit2 } from "react-icons/fi"
-import { GrUserManager, GrUserWorker } from "react-icons/gr"
 import LimitConnectionHandle from "../Handles/LimitConnectionHandle"
 
 export type MemberNodeData = {
@@ -24,45 +23,75 @@ export function MemberNode({ data }: NodeProps<MemberNodeData>) {
   const editMemberModal = useDisclosure()
   const bgColor = useColorModeValue("gray.50", "ui.darkSlate")
 
+  const isLeader = data.member.type === "leader"
+
   return (
-    <Box w="15rem" p={2} boxShadow="base" borderRadius="lg" bgColor={bgColor}>
-      <Stack direction="row" spacing={2} align="center" w="full">
-        {data.member.type === "worker" ? (
-          <Icon as={GrUserWorker} boxSize={5} color="gray.400" />
-        ) : (
-          <Icon as={GrUserManager} boxSize={5} color="gray.400" />
-        )}
-        <Stack spacing={0} w="70%">
-          <Text fontWeight={"bold"} noOfLines={1}>
-            {data.member.name}
-          </Text>
-          <Text fontSize={"x-small"} noOfLines={2}>
-            {data.member.role}
-          </Text>
-        </Stack>
+    <Grid
+      w="15rem"
+      templateColumns={"repeat(6,1fr)"}
+      templateRows={"repeat(auto-fill, 0.5fr)"}
+      p={1.5}
+      boxShadow="base"
+      borderRadius="lg"
+      bgColor={bgColor}
+      gap={1}
+    >
+      <GridItem colSpan={5}>
+        <Text fontWeight={"bold"} noOfLines={1}>
+          {data.member.name}
+        </Text>
+      </GridItem>
+      <GridItem colStart={6} justifySelf={"end"}>
         <IconButton
+          color="#009688"
           size="xs"
+          fontSize={"xx-small"}
           aria-label="Edit Member"
           icon={<FiEdit2 />}
           onClick={editMemberModal.onOpen}
           variant="outline"
           colorScheme="blue"
         />
-      </Stack>
-      <EditMember
-        isOpen={editMemberModal.isOpen}
-        onClose={editMemberModal.onClose}
-        teamId={data.teamId}
-        member={data.member}
-      />
+        <EditMember
+          isOpen={editMemberModal.isOpen}
+          onClose={editMemberModal.onClose}
+          teamId={data.teamId}
+          member={data.member}
+        />
+      </GridItem>
+      <GridItem colSpan={6}>
+        <Text fontSize="xx-small" noOfLines={2}>
+          {data.member.role}
+        </Text>
+      </GridItem>
+      <GridItem colSpan={6} maxW={"full"}>
+        <Tag size="sm" colorScheme="blue" mt="0.2rem" mb={0}>
+          <Text fontSize="xx-small" noOfLines={1}>
+            {data.member.model}
+          </Text>
+        </Tag>
+      </GridItem>
+      {!isLeader && (
+        <GridItem colSpan={6} maxW={"full"} noOfLines={1}>
+          {data.member.skills.map((skill, index) => (
+            <Tag
+              key={index}
+              size="sm"
+              fontSize="xx-small"
+              colorScheme="purple"
+              mr={0.5}
+            >
+              {skill.name}
+            </Tag>
+          ))}
+        </GridItem>
+      )}
       <LimitConnectionHandle
         type="target"
         position={Position.Top}
         connectionLimit={1}
       />
-      {data.member.type === "leader" && (
-        <Handle type="source" position={Position.Bottom} />
-      )}
-    </Box>
+      {isLeader && <Handle type="source" position={Position.Bottom} />}
+    </Grid>
   )
 }
```

**File**: `frontend/src/components/ReactFlow/Nodes/RootNode.tsx` (modified, +41/-23)
```diff
@@ -1,18 +1,17 @@
 import {
-  Box,
-  Icon,
   IconButton,
-  Stack,
   useColorModeValue,
   useDisclosure,
   Text,
+  Grid,
+  GridItem,
+  Tag,
 } from "@chakra-ui/react"
 import type { NodeProps } from "reactflow"
 import { Handle, Position } from "reactflow"
 import { EditMember } from "../../Members/EditMember"
 import type { MemberOut } from "../../../client"
 import { FiEdit2 } from "react-icons/fi"
-import { GrUserManager } from "react-icons/gr"
 
 export type RootNodeData = {
   teamId: number
@@ -24,33 +23,52 @@ export function RootNode({ data }: NodeProps<RootNodeData>) {
   const bgColor = useColorModeValue("gray.50", "ui.darkSlate")
 
   return (
-    <Box w="15rem" p={2} boxShadow="base" borderRadius="lg" bgColor={bgColor}>
-      <Stack direction="row" spacing={2} align="center" w="full">
-        <Icon as={GrUserManager} boxSize={5} color="gray.400" />
-        <Stack spacing={0} w="70%">
-          <Text fontWeight="bold" noOfLines={1}>
-            {data.member.name}
-          </Text>
-          <Text fontSize="x-small" noOfLines={2}>
-            {data.member.role}
-          </Text>
-        </Stack>
+    <Grid
+      w="15rem"
+      templateColumns={"repeat(6,1fr)"}
+      templateRows={"repeat(auto-fill, 0.5fr)"}
+      p={1.5}
+      boxShadow="base"
+      borderRadius="lg"
+      bgColor={bgColor}
+      gap={1}
+    >
+      <GridItem colSpan={5}>
+        <Text fontWeight={"bold"} noOfLines={1}>
+          {data.member.name}
+        </Text>
+      </GridItem>
+      <GridItem colStart={6} justifySelf={"end"}>
         <IconButton
+          color="#009688"
           size="xs"
+          fontSize={"xx-small"}
           aria-label="Edit Member"
           icon={<FiEdit2 />}
           onClick={editMemberModal.onOpen}
           variant="outline"
           colorScheme="blue"
         />
-      </Stack>
-      <EditMember
-        isOpen={editMemberModal.isOpen}
-        onClose={editMemberModal.onClose}
-        teamId={data.teamId}
-        member={data.member}
-      />
+        <EditMember
+          isOpen={editMemberModal.isOpen}
+          onClose={editMemberModal.onClose}
+          teamId={data.teamId}
+          member={data.member}
+        />
+      </GridItem>
+      <GridItem colSpan={6}>
+        <Text fontSize="xx-small" noOfLines={2}>
+          {data.member.role}
+        </Text>
+      </GridItem>
+      <GridItem colSpan={6} maxW={"full"}>
+        <Tag size="sm" colorScheme="blue" mt="0.2rem" mb={0}>
+          <Text fontSize="xx-small" noOfLines={1}>
+            {data.member.model}
+          </Text>
+        </Tag>
+      </GridItem>
       <Handle type="source" position={Position.Bottom} />
-    </Box>
+    </Grid>
   )
 }
```

---

### Incident Patch 8: `890b4b41` (2024-07-25)
**Commit Message**: 🐛 Fix local Traefik proxy network config to fix Gateway Timeouts  (#86)

* 🐛 Fix local Traefik proxy network config to fix Gateway Timeouts (#1184)

* Fix proxy netwrok config for local deployment to fix Gateway Timeouts

---------

Co-authored-by: Joel Gotsch <[REDACTED_EMAIL]>

**File**: `docker-compose.local.yml` (modified, +3/-0)
```diff
@@ -24,6 +24,9 @@ services:
       - traefik.http.routers.traefik-dashboard-http.service=api@internal
       - traefik.http.middlewares.admin-auth.basicauth.users=${USERNAME?Variable not set}:${HASHED_PASSWORD?Variable not set}
       - traefik.http.routers.traefik-dashboard-http.middlewares=admin-auth
+    networks:
+      - traefik-public
+      - default
 
   frontend:
     build:
```

**File**: `docker-compose.override.yml` (modified, +3/-0)
```diff
@@ -35,6 +35,9 @@ services:
       # Dummy https-redirect middleware that doesn't really redirect, only to
       # allow running it locally
       - traefik.http.middlewares.https-redirect.contenttype.autodetect=false
+    networks:
+      - traefik-public
+      - default
 
   db:
     restart: "no"
```

---

### Incident Patch 9: `9fc1b71a` (2024-07-20)
**Commit Message**: Fix bug when streaming tool output (#83)

* Fix bug when streaming tool output

* Fix mypy issue

**File**: `backend/app/core/graph/messages.py` (modified, +8/-7)
```diff
@@ -73,14 +73,15 @@ def event_to_response(event: StreamEvent) -> ChatResponse | None:
             )
 
     elif kind == "on_tool_end":
-        tool_output = event["data"].get("output")
+        tool_output: ToolMessage | None = event["data"].get("output")
         tool_name = event["name"]
-        return ChatResponse(
-            type="tool",
-            id=id,
-            name=tool_name,
-            tool_output=json.dumps(tool_output),
-        )
+        if tool_output:
+            return ChatResponse(
+                type="tool",
+                id=id,
+                name=tool_name,
+                tool_output=json.dumps(tool_output.content),
+            )
     elif kind == "on_retriever_end":
         name = "documents"
         docs: list[Document] = event["data"]["output"]
```

---

### Incident Patch 10: `a3652713` (2024-07-19)
**Commit Message**: Fix looping conversations (#80)

* Upgrade langchain libraries

* Enhance prompt to prevent recursive messages during chat

**File**: `backend/app/core/graph/members.py` (modified, +4/-1)
```diff
@@ -310,7 +310,10 @@ class LeaderNode(BaseNode):
             ),
             (
                 "human",
-                "Here is the team's task: \n\n {team_task} \n\n Here is the previous conversation: \n\n {history_string} \n\n",
+                (
+                    "Here is the team's task: \n\n {team_task} \n\n Here is the previous conversation: \n\n {history_string} \n\n"
+                    "Given the conversation, decide who should act next. Or should we FINISH? Select one of: {options}."
+                ),
             ),
         ]
     )
```

**File**: `backend/poetry.lock` (modified, +90/-89)
```diff
@@ -1,4 +1,4 @@
-# This file is automatically @generated by Poetry 1.8.3 and should not be changed by hand.
+# This file is automatically @generated by Poetry 1.8.2 and should not be changed by hand.
 
 [[package]]
 name = "aiohttp"
@@ -156,20 +156,20 @@ files = [
 
 [[package]]
 name = "anthropic"
-version = "0.26.1"
+version = "0.31.2"
 description = "The official Python library for the anthropic API"
 optional = false
 python-versions = ">=3.7"
 files = [
-    {file = "anthropic-0.26.1-py3-none-any.whl", hash = "sha256:2812b9b250b551ed8a1f0a7e6ae3f005654098994f45ebca5b5808bd154c9628"},
-    {file = "anthropic-0.26.1.tar.gz", hash = "sha256:26680ff781a6f678a30a1dccd0743631e602b23a47719439ffdef5335fa167d8"},
+    {file = "anthropic-0.31.2-py3-none-any.whl", hash = "sha256:28d176b98c72615bfae30f0a9eee6297cc33bf52535d38156fc2805556e2f09b"},
+    {file = "anthropic-0.31.2.tar.gz", hash = "sha256:0134b73df8d1f142fc68675fbadb75e920054e9e3437b99df63f10f0fc6ac26f"},
 ]
 
 [package.dependencies]
 anyio = ">=3.5.0,<5"
 distro = ">=1.7.0,<2"
 httpx = ">=0.23.0,<1"
-jiter = ">=0.1.0,<1"
+jiter = ">=0.4.0,<1"
 pydantic = ">=1.9.0,<3"
 sniffio = "*"
 tokenizers = ">=0.13.0"
@@ -1964,72 +1964,72 @@ i18n = ["Babel (>=2.7)"]
 
 [[package]]
 name = "jiter"
-version = "0.1.0"
-description = ""
+version = "0.5.0"
+description = "Fast iterable JSON parser."
 optional = false
 python-versions = ">=3.8"
 files = [
-    {file = "jiter-0.1.0-cp310-cp310-macosx_10_12_x86_64.whl", hash = "sha256:3aa466e89664cb94e69571df326f0c28e25e2e728f90fa4c3c235bbd35b40609"},
-    {file = "jiter-0.1.0-cp310-cp310-macosx_11_0_arm64.whl", hash = "sha256:46eed20f7d9642787eed4143f7b25e16cf9915bb45656980cc9b966bb1e00f59"},
-    {file = "jiter-0.1.0-cp310-cp310-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:51fcd4bdb23de3a26c2b64f7bd87e9e43c82f1171145ba13434a654d7c8e9aa9"},
-    {file = "jiter-0.1.0-cp310-cp310-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:657ca4cf8d99e2e899a5ef778daed5f42eff6de6f23403a6225b6d6bafb55f38"},
-    {file = "jiter-0.1.0-cp310-cp310-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:5da72cf6582049d2b802e48dd647a096103994a21a7a762fe813b727565ac0ef"},
-    {file = "jiter-0.1.0-cp310-cp310-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:148ae1c97be312f1e969d76fbf507818d53e2867e90cf3c7f78941a199d5b84c"},
-    {file = "jiter-0.1.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:f12ce8243d1adb4657cfd9f23ec73fbd206bd5387bea0ebb5514c41fd268a1c1"},
-    {file = "jiter-0.1.0-cp310-cp310-manylinux_2_5_i686.manylinux1_i686.whl", hash = "sha256:067cc20889627a0afcaf6b465e942990b9f32d1ad88b0a083ece74becc3831b0"},
-    {file = "jiter-0.1.0-cp310-cp310-musllinux_1_1_aarch64.whl", hash = "sha256:ce5866bb5ff7dc14d036fede7e7ddb86b3b67064dc66dde15de4771e2697e539"},
-    {file = "jiter-0.1.0-cp310-cp310-musllinux_1_1_x86_64.whl", hash = "sha256:f446f1f5e8466fc4dfe775f9c5d8b6c3f0b8b07dc24d4ce76d8de3468d7447a8"},
-    {file = "jiter-0.1.0-cp310-none-win32.whl", hash = "sha256:47c1e12bd0789bd4f76cc4973a04d512832568a2a4925cd0b52d0ed413aa5e8d"},
-    {file = "jiter-0.1.0-cp310-none-win_amd64.whl", hash = "sha256:0316fa82ee4dab455bac2ec05362f3ac19d77e3139225683289c366ce35605b9"},
-    {file = "jiter-0.1.0-cp311-cp311-macosx_10_12_x86_64.whl", hash = "sha256:f47eb274aae20ee3b565886ab315c3f16f9831c0e4fd6722dc100a2dbc0923f9"},
-    {file = "jiter-0.1.0-cp311-cp311-macosx_11_0_arm64.whl", hash = "sha256:80d1bf437ea70f43c0976f96cd83fa4618aceb526ba3eaccf9f736d0c3185f5c"},
-    {file = "jiter-0.1.0-cp311-cp311-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:215ca1178d30e7a652849b9ca145a4666e1ed0941aef0c61bbaf88a0cd084b66"},
-    {file = "jiter-0.1.0-cp311-cp311-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:08d7401e20fc660871a02ec05dda9dd93c95052a3c1588385230bca59d9d525b"},
-    {file = "jiter-0.1.0-cp311-cp311-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:8cd365396e9c50b1c458bad0b21452f4c33fea222413aea78826bca98097f487"},
-    {file = "jiter-0.1.0-cp311-cp311-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:050252cde3ae0b0a1eca028a30d953ce2d90e0150c1eef0e5ad75ce163d32484"},
-    {file = "jiter-0.1.0-cp311-cp311-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:bfcf0996949a9435a2ebba2455934ad72d9faa1de2069c65aeaeaa8c6219820d"},
-    {file = "jiter-0.1.0-cp311-cp311-manylinux_2_5_i686.manylinux1_i686.whl", hash = "sha256:cfce158151a3a7d0b8f8af549540e1d8328a9dce4ee61c2fb10b12f269d68b6d"},
-    {file = "jiter-0.1.0-cp311-cp311-musllinux_1_1_aarch64.whl", hash = "sha256:c22d684e663cc99f887c3133a7714c5ecba73524438bc3c93e6bb868c55a9097"},
-    {file = "jiter-0.1.0-cp311-cp311-musllinux_1_1_x86_64.whl", hash = "sha256:fe94ab7e548e492dfd35118de7de613078b7e4ddc276976e8fa2f0f37029cad5"},
-    {file = "jiter-0.1.0-cp311-none-win32.whl", hash = "sha256:1c41463f82b67d2efa8f269f7cd150c6c16c5902a0508
```

**File**: `backend/pyproject.toml` (modified, +4/-4)
```diff
@@ -25,20 +25,20 @@ sqlmodel = "^0.0.16"
 bcrypt = "4.0.1"
 pydantic-settings = "^2.2.1"
 sentry-sdk = {extras = ["fastapi"], version = "^2.8.0"}
-langgraph = "0.1.8"
+langgraph = "0.1.9"
 langserve = {extras = ["server"], version = "^0.0.51"}
-langchain-openai = "^0.1.1"
+langchain-openai = "0.1.17"
 grandalf = "^0.8"
 langchain = "0.2.7"
 langchain-community = "0.2.7"
 duckduckgo-search = "6.1.0"
 wikipedia = "^1.4.0"
-langchain-anthropic = "^0.1.11"
+langchain-anthropic = "0.1.20"
 langchain-cohere = "^0.1.4"
 langchain-google-genai = "^1.0.2"
 google-search-results = "^2.4.2"
 yfinance = "^0.2.38"
-langchain-core = "0.2.17"
+langchain-core = "0.2.21"
 pyjwt = "^2.8.0"
 psycopg2 = "^2.9.9"
 asyncpg = "^0.29.0"
```

---

### Incident Patch 11: `2cceff22` (2024-07-19)
**Commit Message**: Fix handling of messages from Anthropic models (#79)

**File**: `backend/app/core/graph/messages.py` (modified, +12/-6)
```diff
@@ -44,15 +44,21 @@ def event_to_response(event: StreamEvent) -> ChatResponse | None:
     id = event["run_id"]
     if kind == "on_chat_model_stream":
         name = event["metadata"]["langgraph_node"]
-        message_chunk = event["data"]["chunk"]
-        content: str = message_chunk.content
+        message_chunk: AIMessageChunk = event["data"]["chunk"]
         type = get_message_type(message_chunk)
+        content: str = ""
+        if isinstance(message_chunk.content, list):
+            for c in message_chunk.content:
+                if isinstance(c, str):
+                    content += c
+                elif isinstance(c, dict):
+                    content += c.get("text", "")
+        else:
+            content = message_chunk.content
+        tool_calls = message_chunk.tool_calls
         if content and type:
             return ChatResponse(
-                type=type,
-                id=id,
-                name=name,
-                content=content,
+                type=type, id=id, name=name, content=content, tool_calls=tool_calls
             )
     elif kind == "on_chat_model_end":
         message: AIMessage = event["data"]["output"]
```

**File**: `frontend/src/components/Teams/ChatTeam.tsx` (modified, +2/-2)
```diff
@@ -97,7 +97,7 @@ const MessageBox = ({ message, onResume }: MessageBoxProps) => {
       <Container pt={2}>
         {content && <Markdown>{content}</Markdown>}
         {tool_calls?.map((tool_call, index) => (
-          <Box key={index}>
+          <Box key={index} mt={4}>
             <Tag colorScheme="purple" mb={2}>
               {tool_call.name}
             </Tag>
@@ -269,7 +269,7 @@ const ChatTeam = () => {
           // only content is streamable in chunks
           content: currentMessage.content
             ? currentMessage.content + response.content
-            : null,
+            : "",
           tool_output: response.tool_output,
         }
       } else {
```

---

### Incident Patch 12: `08d9661b` (2024-07-18)
**Commit Message**: Enhance handling of streaming, messages and memory (#75)

* Upgrade langgraph to 0.1.8 and langchain-core to 0.2.17

* Enhance how agents pass states to one another and stream final response.

- Create a new history state to store past conversations with other agents and use messages to handle conversation with itself
- Modify streaming logic to return multiple event types in new format.

* Create writes table, set Upload status to be not nullable

* install psycopg-pool

* Upgrade PostgresSaver class

* Update read_thread route to return list of messages instead of last checkpoint

- Create get_checkpoint_tuples fn to retrieve last checkpoint of thread id
- Create convert_checkpoint_tuple_to_messages fn to convert the last checkpoint into list of messages

* Sync client models with read_thread response

* Create functions to convert events and checkpoints to ChatResponse

* Remove GraphResponse and set ThreadRead messages to list of ChatResponse

* Remove aiopostgres.py as its no longer in use, refactor postgres.py.

* Improve state handling, persistence and streaming

- Add 'all_mesages' into TeamState to keep track of agents' messages.
- Use updated 

**File**: `backend/app/alembic/versions/0a354b5c6f6c_create_writes_table.py` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+"""Create writes table
+
+Revision ID: 0a354b5c6f6c
+Revises: bfa5449b6bba
+Create Date: 2024-07-15 06:08:02.686420
+
+"""
+from alembic import op
+import sqlalchemy as sa
+import sqlmodel.sql.sqltypes
+
+
+# revision identifiers, used by Alembic.
+revision = '0a354b5c6f6c'
+down_revision = 'bfa5449b6bba'
+branch_labels = None
+depends_on = None
+
+
+def upgrade():
+    # ### commands auto generated by Alembic - please adjust! ###
+    op.create_table('writes',
+    sa.Column('thread_id', sqlmodel.sql.sqltypes.GUID(), nullable=False),
+    sa.Column('thread_ts', sqlmodel.sql.sqltypes.GUID(), nullable=False),
+    sa.Column('task_id', sqlmodel.sql.sqltypes.GUID(), nullable=False),
+    sa.Column('idx', sa.Integer(), nullable=False),
+    sa.Column('channel', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
+    sa.Column('value', sa.LargeBinary(), nullable=False),
+    sa.ForeignKeyConstraint(['thread_id'], ['thread.id'], ),
+    sa.PrimaryKeyConstraint('thread_id', 'thread_ts', 'task_id', 'idx')
+    )
+    # ### end Alembic commands ###
+
+
+def downgrade():
+    # ### commands auto generated by Alembic - please adjust! ###
+    op.drop_table('writes')
+    # ### end Alembic commands ###
```

**File**: `backend/app/api/routes/threads.py` (modified, +14/-12)
```diff
@@ -6,14 +6,17 @@
 from sqlmodel import col, func, select
 
 from app.api.deps import CurrentUser, SessionDep
+from app.core.graph.checkpoint.utils import (
+    convert_checkpoint_tuple_to_messages,
+    get_checkpoint_tuples,
+)
 from app.models import (
-    Checkpoint,
-    CreateThreadOut,
     Message,
     Team,
     Thread,
     ThreadCreate,
     ThreadOut,
+    ThreadRead,
     ThreadsOut,
     ThreadUpdate,
 )
@@ -63,8 +66,8 @@ def read_threads(
     return ThreadsOut(data=threads, count=count)
 
 
-@router.get("/{id}", response_model=CreateThreadOut)
-def read_thread(
+@router.get("/{id}", response_model=ThreadRead)
+async def read_thread(
     session: SessionDep, current_user: CurrentUser, team_id: int, id: UUID
 ) -> Any:
     """
@@ -95,17 +98,16 @@ def read_thread(
     if not thread:
         raise HTTPException(status_code=404, detail="Thread not found")
 
-    checkpoint_statement = (
-        select(Checkpoint)
-        .where(Checkpoint.thread_id == thread.id)
-        .order_by(col(Checkpoint.created_at).desc())
-    )
-    checkpoint = session.exec(checkpoint_statement).first()
+    checkpoint_tuple = await get_checkpoint_tuples(str(thread.id))
+    if checkpoint_tuple:
+        messages = convert_checkpoint_tuple_to_messages(checkpoint_tuple)
+    else:
+        messages = []
 
-    return CreateThreadOut(
+    return ThreadRead(
         id=thread.id,
         query=thread.query,
-        last_checkpoint=checkpoint,
+        messages=messages,
         updated_at=thread.updated_at,
     )
 
```

**File**: `backend/app/core/graph/build.py` (modified, +108/-91)
```diff
@@ -1,11 +1,16 @@
 import asyncio
-import json
 from collections import defaultdict, deque
-from collections.abc import AsyncGenerator, Mapping
+from collections.abc import AsyncGenerator, Hashable, Mapping
 from functools import partial
 from typing import Any, cast
+from uuid import uuid4
 
-from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, ToolMessage
+from langchain_core.messages import (
+    AIMessage,
+    AnyMessage,
+    HumanMessage,
+    ToolMessage,
+)
 from langchain_core.runnables import RunnableLambda
 from langchain_core.runnables.config import RunnableConfig
 from langgraph.checkpoint import BaseCheckpointSaver
@@ -14,9 +19,10 @@
 from langgraph.prebuilt import (
     ToolNode,
 )
+from psycopg import AsyncConnection
 
 from app.core.config import settings
-from app.core.graph.checkpoint.aiopostgres import AsyncPostgresSaver
+from app.core.graph.checkpoint.postgres import PostgresSaver
 from app.core.graph.members import (
     GraphLeader,
     GraphMember,
@@ -29,6 +35,7 @@
     TeamState,
     WorkerNode,
 )
+from app.core.graph.messages import ChatResponse, event_to_response
 from app.models import ChatMessage, InterruptDecision, Member, Team
 
 
@@ -222,25 +229,22 @@ def exit_chain(state: TeamState) -> dict[str, list[AnyMessage]]:
     """
     Pass the final response back to the top-level graph's state.
     """
-    answer = state["messages"][-1]
-    return {"messages": [answer]}
+    answer = state["history"][-1]
+    return {"history": [answer], "all_messages": state["all_messages"]}
 
 
 def should_continue(state: TeamState) -> str:
     """Determine if graph should go to tool node or not. For tool calling agents."""
     messages: list[AnyMessage] = state["messages"]
-    last_message = messages[-1]
-    # If there is no function call, then we finish
-    if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
-        return "continue"
-    # Otherwise if there is, we continue
-    else:
+    if messages and isinstance(messages[-1], AIMessage) and messages[-1].tool_calls:
         return "call_tools"
+    else:
+        return "continue"
 
 
 def create_tools_condition(
     current_member_name: str, next_member_name: str
-) -> dict[str, str]:
+) -> dict[Hashable, str]:
     """Creates the mapping for conditional edges
     The tool node must be in format: '{current_member_name}_tools'
 
@@ -259,7 +263,7 @@ def create_tools_condition(
 def create_hierarchical_graph(
     teams: dict[str, GraphTeam],
     leader_name: str,
-    memory: BaseCheckpointSaver | None = None,
+    checkpointer: BaseCheckpointSaver | None = None,
 ) -> CompiledGraph:
     """Create the team's graph.
 
@@ -325,7 +329,9 @@ def create_hierarchical_graph(
                     interrupt_member_names.append(f"{name}_tools")
         elif isinstance(member, GraphLeader):
             # subgraphs do not require memory
-            subgraph = create_hierarchical_graph(teams, leader_name=name, memory=None)
+            subgraph = create_hierarchical_graph(
+                teams, leader_name=name, checkpointer=checkpointer
+            )
             enter = partial(enter_chain, team=teams[name])
             build.add_node(
                 name,
@@ -343,18 +349,20 @@ def create_hierarchical_graph(
                 interrupt_member_names.append(f"{member.name}_tools")
         else:
             build.add_edge(name, leader_name)
-    conditional_mapping = {v: v for v in members}
+    conditional_mapping: dict[Hashable, str] = {v: v for v in members}
     conditional_mapping["FINISH"] = "FinalAnswer"
     build.add_conditional_edges(leader_name, router, conditional_mapping)
 
     build.set_entry_point(leader_name)
     build.set_finish_point("FinalAnswer")
-    graph = build.compile(checkpointer=memory, interrupt_before=interrupt_member_names)
+    graph = build.compile(
+        checkpointer=checkpointer, interrupt_before=interrupt_member_names
+    )
     return graph
 
 
 def create_sequential_graph(
-    team: Mapping[str, GraphMember], memory: BaseCheckpointSaver
+    team: Mapping[str, GraphMember], checkpointer: BaseCheckpointSaver
 ) -> CompiledGraph:
     """
     Creates a sequential graph from a list of team members.
@@ -413,14 +421,16 @@ def create_sequential_graph(
     else:
         graph.add_edge(members[-1].name, END)
     graph.set_entry_point(members[0].name)
-    return graph.compile(checkpointer=memory, interrupt_before=interrupt_member_names)
+    return graph.compile(
+        checkpointer=checkpointer, interrupt_before=interrupt_member_names
+    )
 
 
 def convert_messages_and_tasks_to_dict(data: Any) -> Any:
     if isinstance(data, dict):
         new_data = {}
         for key, value in data.items():
-            if key == "messages" or key == "task":
+            if key == "messages" or key == "history" or key == "task":
                 if isinstance(value, list):
                     new_data[key] = [message.dict() for message in value]
  
```

**File**: `backend/app/core/graph/checkpoint/aiopostgres.py` (removed, +0/-421)
```diff
@@ -1,421 +0,0 @@
-import asyncio
-import functools
-from collections.abc import AsyncIterator, Iterator
-from contextlib import AbstractAsyncContextManager
-from types import TracebackType
-from typing import TypeVar
-
-import asyncpg
-from langchain_core.runnables import RunnableConfig
-from langgraph.checkpoint.base import (
-    BaseCheckpointSaver,
-    Checkpoint,
-    CheckpointMetadata,
-    CheckpointTuple,
-)
-from langgraph.serde.base import SerializerProtocol
-from typing_extensions import Self
-
-from app.core.graph.checkpoint.postgres import JsonPlusSerializerCompat, search_where
-
-T = TypeVar("T", bound=callable)  # type: ignore[valid-type]
-
-
-def not_implemented_sync_method(func: T) -> T:
-    @functools.wraps(func)
-    def wrapper(*args, **kwargs):  # type: ignore[no-untyped-def]
-        raise NotImplementedError(
-            "The AsyncPostgresSaver does not support synchronous methods. "
-            "Consider using the PostgresSaver instead.\n"
-            "from langgraph.checkpoint.postgres import PostgresSaver\n"
-            "See https://langchain-ai.github.io/langgraph/reference/checkpoints/#postgressaver "
-            "for more information."
-        )
-
-    return wrapper  # type: ignore[return-value]
-
-
-class AsyncPostgresSaver(BaseCheckpointSaver, AbstractAsyncContextManager):  # type: ignore[type-arg]
-    """An asynchronous checkpoint saver that stores checkpoints in a PostgreSQL database.
-
-    Tip:
-        Requires the [asyncpg](https://pypi.org/project/asyncpg/) package.
-        Install it with `pip install asyncpg`.
-
-    Args:
-        conn (asyncpg.Connection): The asynchronous PostgreSQL database connection.
-        serde (Optional[SerializerProtocol]): The serializer to use for serializing and deserializing checkpoints. Defaults to JsonPlusSerializerCompat.
-
-    Examples:
-        Usage within a StateGraph:
-        ```pycon
-        >>> import asyncio
-        >>> import asyncpg
-        >>>
-        >>> from langgraph.checkpoint.postgres import AsyncPostgresSaver
-        >>> from langgraph.graph import StateGraph
-        >>>
-        >>> builder = StateGraph(int)
-        >>> builder.add_node("add_one", lambda x: x + 1)
-        >>> builder.set_entry_point("add_one")
-        >>> builder.set_finish_point("add_one")
-        >>> memory = AsyncPostgresSaver.from_conn_string("postgresql://user:password@localhost/dbname")
-        >>> graph = builder.compile(checkpointer=memory)
-        >>> coro = graph.ainvoke(1, {"configurable": {"thread_id": "thread-1"}})
-        >>> asyncio.run(coro)
-        Output: 2
-        ```
-
-        Raw usage:
-        ```pycon
-        >>> import asyncio
-        >>> import asyncpg
-        >>> from langgraph.checkpoint.postgres import AsyncPostgresSaver
-        >>>
-        >>> async def main():
-        >>>     conn = await asyncpg.connect("postgresql://user:password@localhost/dbname")
-        ...     saver = AsyncPostgresSaver(conn)
-        ...     config = {"configurable": {"thread_id": "1"}}
-        ...     checkpoint = {"ts": "2023-05-03T10:00:00Z", "data": {"key": "value"}}
-        ...     saved_config = await saver.aput(config, checkpoint)
-        ...     print(saved_config)
-        >>> asyncio.run(main())
-        {"configurable": {"thread_id": "1", "thread_ts": "2023-05-03T10:00:00Z"}}
-        ```
-    """
-
-    serde = JsonPlusSerializerCompat()
-
-    conn: asyncpg.Connection  # type: ignore[type-arg]
-    conn_string: str
-    lock: asyncio.Lock
-    is_setup: bool
-
-    def __init__(
-        self,
-        conn: asyncpg.Connection,  # type: ignore[type-arg]
-        conn_string: str,
-        *,
-        serde: SerializerProtocol | None = None,
-    ):
-        super().__init__(serde=serde)
-        self.conn = conn
-        self.conn_string = conn_string
-        self.lock = asyncio.Lock()
-        self.is_setup = False
-
-    @classmethod
-    async def from_conn_string(cls, conn_string: str) -> "AsyncPostgresSaver":
-        """Create a new AsyncPostgresSaver instance from a connection string.
-
-        Args:
-            conn_string (str): The PostgreSQL connection string.
-
-        Returns:
-            AsyncPostgresSaver: A new AsyncPostgresSaver instance.
-        """
-        conn = await asyncpg.connect(conn_string)
-        return AsyncPostgresSaver(conn=conn, conn_string=conn_string)
-
-    async def __aenter__(self) -> Self:
-        return self
-
-    async def __aexit__(
-        self,
-        __exc_type: type[BaseException] | None,
-        __exc_value: BaseException | None,
-        __traceback: TracebackType | None,
-    ) -> bool | None:
-        if self.is_setup:
-            await self.conn.close()
-        return None
-
-    @not_implemented_sync_method
-    def get_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
-        """Get a checkpoint tuple from the database.
-
-        Note:
-            This method is not implemented for the AsyncPostgresSaver. Use
```

**File**: `backend/app/core/graph/checkpoint/postgres.py` (modified, +510/-517)
```diff
@@ -1,585 +1,578 @@
-import json
-import pickle
-from collections.abc import AsyncIterator, Iterator
-from contextlib import AbstractContextManager, contextmanager
-from threading import Lock
-from types import TracebackType
-from typing import Any
-
-import psycopg2
+"""Implementation of a langgraph checkpoint saver using Postgres."""
+from collections.abc import AsyncGenerator, AsyncIterator, Generator, Sequence
+from contextlib import asynccontextmanager, contextmanager
+from typing import Any, List  # noqa: UP035
+
+import psycopg
 from langchain_core.runnables import RunnableConfig
-from langgraph.checkpoint.base import (
-    BaseCheckpointSaver,
-    Checkpoint,
-    CheckpointMetadata,
-    CheckpointTuple,
-)
-from langgraph.serde.base import SerializerProtocol
+from langgraph.checkpoint import BaseCheckpointSaver
+from langgraph.checkpoint.base import Checkpoint, CheckpointMetadata, CheckpointTuple
 from langgraph.serde.jsonplus import JsonPlusSerializer
-from typing_extensions import Self
-
-
-class JsonPlusSerializerCompat(JsonPlusSerializer):
-    """A serializer that supports loading pickled checkpoints for backwards compatibility.
-
-    This serializer extends the JsonPlusSerializer and adds support for loading pickled
-    checkpoints. If the input data starts with b"\x80" and ends with b".", it is treated
-    as a pickled checkpoint and loaded using pickle.loads(). Otherwise, the default
-    JsonPlusSerializer behavior is used.
-
-    Examples:
-        >>> import pickle
-        >>> from langgraph.checkpoint.postgres import JsonPlusSerializerCompat
-        >>>
-        >>> serializer = JsonPlusSerializerCompat()
-        >>> pickled_data = pickle.dumps({"key": "value"})
-        >>> loaded_data = serializer.loads(pickled_data)
-        >>> print(loaded_data)  # Output: {"key": "value"}
-        >>>
-        >>> json_data = '{"key": "value"}'.encode("utf-8")
-        >>> loaded_data = serializer.loads(json_data)
-        >>> print(loaded_data)  # Output: {"key": "value"}
-    """
+from psycopg_pool import AsyncConnectionPool, ConnectionPool
 
-    def loads(self, data: bytes) -> Any:
-        if data.startswith(b"\x80") and data.endswith(b"."):
-            return pickle.loads(data)
-        return super().loads(data)
-
-
-_AIO_ERROR_MSG = (
-    "The PostgresSaver does not support async methods. "
-    "Consider using AsyncPostgresSaver instead.\n"
-    "Note: AsyncPostgresSaver requires an async PostgreSQL driver to use.\n"
-    "See https://langchain-ai.github.io/langgraph/reference/checkpoints/#asyncpostgressaver"
-    "for more information."
-)
-
-
-class PostgresSaver(BaseCheckpointSaver, AbstractContextManager):  # type: ignore[type-arg]
-    """A checkpoint saver that stores checkpoints in a PostgreSQL database.
-
-    Note:
-        This class is meant for lightweight, synchronous use cases
-        (demos and small projects) and does not
-        scale to multiple threads.
-        For a similar PostgreSQL saver with `async` support,
-        consider using AsyncPostgresSaver.
-
-    Args:
-        conn (psycopg2.extensions.connection): The PostgreSQL database connection.
-        serde (Optional[SerializerProtocol]): The serializer to use for serializing and deserializing checkpoints. Defaults to JsonPlusSerializerCompat.
-
-    Examples:
-
-        >>> import psycopg2
-        >>> from langgraph.checkpoint.postgres import PostgresSaver
-        >>> from langgraph.graph import StateGraph
-        >>>
-        >>> builder = StateGraph(int)
-        >>> builder.add_node("add_one", lambda x: x + 1)
-        >>> builder.set_entry_point("add_one")
-        >>> builder.set_finish_point("add_one")
-        >>> conn = psycopg2.connect("dbname=test user=postgres password=secret")
-        >>> memory = PostgresSaver(conn)
-        >>> graph = builder.compile(checkpointer=memory)
-        >>> config = {"configurable": {"thread_id": "1"}}
-        >>> graph.get_state(config)
-        >>> result = graph.invoke(3, config)
-        >>> graph.get_state(config)
-        StateSnapshot(values=4, next=(), config={'configurable': {'thread_id': '1', 'thread_ts': '2024-05-04T06:32:42.235444+00:00'}}, parent_config=None)
-    """  # noqa
-
-    serde = JsonPlusSerializerCompat()
-
-    conn: psycopg2.extensions.connection
-    is_setup: bool
-
-    def __init__(
-        self,
-        conn: psycopg2.extensions.connection,
-        *,
-        serde: SerializerProtocol | None = None,
-    ) -> None:
-        super().__init__(serde=serde)
-        self.conn = conn
-        self.is_setup = False
-        self.lock = Lock()
 
-    @classmethod
-    def from_conn_string(cls, conn_string: str) -> "PostgresSaver":
-        """Create a new PostgresSaver instance from a connection string.
+class JsonAndBinarySerializer(JsonPlusSerializer):
+    def _default(self, obj: Any) -> Any:
+        if isinstance(obj, bytes | bytearray):
+            return self._encode_constructor_args(
+                obj.__class_
```

**File**: `backend/app/core/graph/checkpoint/utils.py` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+import json
+from uuid import uuid4
+
+from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, ToolMessage
+from langgraph.checkpoint.base import CheckpointTuple
+from psycopg import AsyncConnection
+
+from app.core.config import settings
+from app.core.graph.checkpoint.postgres import PostgresSaver
+from app.core.graph.messages import ChatResponse
+
+
+def convert_checkpoint_tuple_to_messages(
+    checkpoint_tuple: CheckpointTuple,
+) -> list[ChatResponse]:
+    """
+    Convert a checkpoint tuple to a list of ChatResponse messages.
+
+    Args:
+        checkpoint_tuple (CheckpointTuple): The checkpoint tuple to convert.
+
+    Returns:
+        list[ChatResponse]: A list of formatted messages.
+    """
+    checkpoint = checkpoint_tuple.checkpoint
+    all_messages: list[AnyMessage] = (
+        checkpoint["channel_values"]["all_messages"]
+        + checkpoint["channel_values"]["messages"]
+    )
+    formatted_messages: list[ChatResponse] = []
+    for message in all_messages:
+        if (
+            isinstance(message, HumanMessage)
+            and message.id
+            and message.name
+            and isinstance(message.content, str)
+        ):
+            formatted_messages.append(
+                ChatResponse(
+                    type="human",
+                    id=message.id,
+                    name=message.name,
+                    content=message.content,
+                )
+            )
+        elif (
+            isinstance(message, AIMessage)
+            and message.id
+            and message.name
+            and isinstance(message.content, str)
+        ):
+            formatted_messages.append(
+                ChatResponse(
+                    type="ai",
+                    id=message.id,
+                    name=message.name,
+                    tool_calls=message.tool_calls,
+                    content=message.content,
+                )
+            )
+        elif isinstance(message, ToolMessage) and message.name:
+            formatted_messages.append(
+                ChatResponse(
+                    type="tool",
+                    id=message.tool_call_id,
+                    name=message.name,
+                    tool_output=json.dumps(message.content),
+                )
+            )
+        else:
+            continue
+
+    last_message = all_messages[-1]
+    if last_message.type == "ai" and last_message.tool_calls:
+        formatted_messages.append(
+            ChatResponse(
+                type="interrupt",
+                name="interrupt",
+                tool_calls=last_message.tool_calls,
+                id=str(uuid4()),
+            )
+        )
+    return formatted_messages
+
+
+async def get_checkpoint_tuples(thread_id: str) -> CheckpointTuple | None:
+    """
+    Retrieve the latest checkpoint tuple for a given thread ID.
+
+    Args:
+        thread_id (str): The ID of the thread.
+
+    Returns:
+        CheckpointTuple: The latest checkpoint tuple.
+    """
+    async with await AsyncConnection.connect(settings.PG_DATABASE_URI) as conn:
+        checkpointer = PostgresSaver(async_connection=conn)
+        checkpoint_tuple = await checkpointer.aget_tuple(
+            {"configurable": {"thread_id": thread_id}}
+        )
+        return checkpoint_tuple
```

**File**: `backend/app/core/graph/members.py` (modified, +79/-63)
```diff
@@ -1,13 +1,17 @@
-import operator
 from collections.abc import Mapping, Sequence
 from typing import Annotated, Any
 
 from langchain.tools.retriever import create_retriever_tool
-from langchain_core.messages import AIMessage, AnyMessage, HumanMessage
+from langchain_core.messages import AIMessage, AnyMessage
 from langchain_core.output_parsers.openai_tools import JsonOutputKeyToolsParser
 from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
-from langchain_core.runnables import RunnableLambda, RunnableSerializable
+from langchain_core.runnables import (
+    RunnableConfig,
+    RunnableLambda,
+    RunnableSerializable,
+)
 from langchain_core.tools import BaseTool
+from langgraph.graph import add_messages
 from pydantic import BaseModel, Field
 from typing_extensions import NotRequired, TypedDict
 
@@ -98,29 +102,30 @@ def persona(self) -> str:
         return f"Name: {self.name}\nRole: {self.role}\nBackstory: {self.backstory}\n"
 
 
-def add_messages(
+def add_or_replace_messages(
     messages: list[AnyMessage], new_messages: list[AnyMessage]
 ) -> list[AnyMessage]:
-    """Add new messages to the state"""
-    # Fix consecutive AI message.
-    if (
-        messages
-        and new_messages
-        and isinstance(messages[-1], AIMessage)
-        and not messages[-1].tool_calls
-        and isinstance(new_messages[0], AIMessage)
-    ):
-        messages.append(HumanMessage(content=".", name="ignore"))
-    # Fix empty messages
-    if not new_messages[-1].content:
-        new_messages[-1].content = "None"
-
-    updated_messages: list[AnyMessage] = operator.add(messages, new_messages)
-    return updated_messages
+    """Add new messages to the state. If new_messages list is empty, clear messages instead."""
+    if not new_messages:
+        return []
+    else:
+        return add_messages(messages, new_messages)  # type: ignore[return-value, arg-type]
+
+
+def format_messages(messages: list[AnyMessage]) -> str:
+    """Format list of messages to string"""
+    message_str: str = ""
+    for message in messages:
+        message_str += f"{message.name}: {message.content}\n\n"
+    return message_str
 
 
 class TeamState(TypedDict):
-    messages: Annotated[list[AnyMessage], add_messages]
+    all_messages: Annotated[
+        list[AnyMessage], add_messages
+    ]  # Stores all messages in this thread
+    messages: Annotated[list[AnyMessage], add_or_replace_messages]
+    history: Annotated[list[AnyMessage], add_messages]
     team: GraphTeam
     next: str
     main_task: list[AnyMessage]
@@ -131,16 +136,22 @@ class TeamState(TypedDict):
 
 # When returning teamstate, is it possible to exclude fields that you dont want to update
 class ReturnTeamState(TypedDict):
-    messages: list[AnyMessage]
+    all_messages: NotRequired[list[AnyMessage]]
+    messages: NotRequired[list[AnyMessage]]
+    history: NotRequired[list[AnyMessage]]
     team: NotRequired[GraphTeam]
     next: NotRequired[str | None]  # Returning None is valid for sequential graphs only
     task: NotRequired[list[AnyMessage]]
 
 
 class BaseNode:
     def __init__(self, provider: str, model: str, temperature: float):
-        self.model = all_models[provider](model=model, temperature=temperature)  # type: ignore[call-arg]
-        self.final_answer_model = all_models[provider](model=model, temperature=0)  # type: ignore[call-arg]
+        self.model = all_models[provider](
+            model=model, temperature=temperature, streaming=True
+        )  # type: ignore[call-arg]
+        self.final_answer_model = all_models[provider](
+            model=model, temperature=0, streaming=True
+        )  # type: ignore[call-arg]
 
     def tag_with_name(self, ai_message: AIMessage, name: str) -> AIMessage:
         """Tag a name to the AI message"""
@@ -164,17 +175,13 @@ class WorkerNode(BaseNode):
                     "Your team members (and other teams) will collaborate with you with their own set of skills. "
                     "You are chosen by one of your team member to perform this task. Try your best to perform it using your skills. "
                     "Stay true to your persona and role:\n{persona}\n"
-                    "<messages>"
                 ),
             ),
-            MessagesPlaceholder(variable_name="task"),
-            MessagesPlaceholder(variable_name="messages"),
             (
                 "human",
-                "</messages>\n"
-                "Remember to stay true to your persona and role:\n{persona}\n"
-                "BEGIN!",
+                "Here is the task: \n\n {task_string} \n\n Here is the previous conversation: \n\n {history_string} \n\n Provide your response.",
             ),
+            MessagesPlaceholder(variable_name="messages"),
         ]
     )
 
@@ -183,7 +190,7 @@ def convert_output_to_ai_message(self, agent_output: dict[str, str]) -> AIMessag
         output = agent_output["output"]
         return AIMessage(content=output)
 
-    async def wor
```

**File**: `backend/app/core/graph/messages.py` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+import json
+from typing import Any
+
+from langchain_core.documents import Document
+from langchain_core.messages import (
+    AIMessage,
+    AIMessageChunk,
+    HumanMessage,
+    HumanMessageChunk,
+    ToolCall,
+    ToolMessage,
+    ToolMessageChunk,
+)
+from langchain_core.runnables.schema import StreamEvent
+from pydantic import BaseModel
+
+
+class ChatResponse(BaseModel):
+    type: str  # ai | human | tool
+    id: str
+    name: str
+    content: str | None = None
+    tool_calls: list[ToolCall] | None = None
+    tool_output: str | None = None
+    documents: str | None = None
+    next: str | None = None
+
+
+def get_message_type(message: Any) -> str | None:
+    """Return the message's type"""
+    if isinstance(message, HumanMessage) or isinstance(message, HumanMessageChunk):
+        return "human"
+    elif isinstance(message, AIMessage) or isinstance(message, AIMessageChunk):
+        return "ai"
+    elif isinstance(message, ToolMessage) or isinstance(message, ToolMessageChunk):
+        return "tool"
+    else:
+        return None
+
+
+def event_to_response(event: StreamEvent) -> ChatResponse | None:
+    """Convert event to ChatResponse"""
+    kind = event["event"]
+    id = event["run_id"]
+    if kind == "on_chat_model_stream":
+        name = event["metadata"]["langgraph_node"]
+        message_chunk = event["data"]["chunk"]
+        content: str = message_chunk.content
+        type = get_message_type(message_chunk)
+        if content and type:
+            return ChatResponse(
+                type=type,
+                id=id,
+                name=name,
+                content=content,
+            )
+    elif kind == "on_chat_model_end":
+        message: AIMessage = event["data"]["output"]
+        name = event["metadata"]["langgraph_node"]
+        tool_calls = message.tool_calls
+        if tool_calls:
+            return ChatResponse(
+                type="tool",
+                id=id,
+                name=name,
+                tool_calls=tool_calls,
+            )
+
+    elif kind == "on_tool_end":
+        tool_output = event["data"].get("output")
+        tool_name = event["name"]
+        return ChatResponse(
+            type="tool",
+            id=id,
+            name=tool_name,
+            tool_output=json.dumps(tool_output),
+        )
+    elif kind == "on_retriever_end":
+        name = "documents"
+        docs: list[Document] = event["data"]["output"]
+        documents: list[dict[str, Any]] = []
+        for doc in docs:
+            documents.append(
+                {
+                    "score": doc.metadata["score"],
+                    "content": doc.page_content,
+                }
+            )
+        return ChatResponse(
+            type="retriever", id=id, name=name, documents=json.dumps(documents)
+        )
+    # elif kind == "on_parser_end":
+    #     content: str = event["data"]["output"].get("task")
+    #     next = event["data"]["output"].get("next")
+    #     name = event["metadata"]["langgraph_node"]
+    #     return ChatResponse(
+    #         type=get_message_type(event["data"]["input"]),
+    #         id=id,
+    #         name=name,
+    #         content=content,
+    #         next=next,
+    #     )
+    return None
```

---

### Incident Patch 13: `f7f15ff2` (2024-07-12)
**Commit Message**: Fix agent prompts (#71)

**File**: `backend/app/core/graph/members.py` (modified, +5/-5)
```diff
@@ -164,14 +164,14 @@ class WorkerNode(BaseNode):
                     "Your team members (and other teams) will collaborate with you with their own set of skills. "
                     "You are chosen by one of your team member to perform this task. Try your best to perform it using your skills. "
                     "Stay true to your persona and role:\n{persona}\n"
-                    "<conversation>"
+                    "<messages>"
                 ),
             ),
             MessagesPlaceholder(variable_name="task"),
             MessagesPlaceholder(variable_name="messages"),
             (
                 "human",
-                "</conversation>\n"
+                "</messages>\n"
                 "Remember to stay true to your persona and role:\n{persona}\n"
                 "BEGIN!",
             ),
@@ -221,13 +221,13 @@ class SequentialWorkerNode(WorkerNode):
                     "will help where you left off. Do not attempt to communicate with other members. "
                     "Execute what you can to make progress. "
                     "Stay true to your persona and role:\n{persona}\n"
-                    "<conversation>"
+                    "<messages>"
                 ),
             ),
             MessagesPlaceholder(variable_name="messages"),
             (
                 "human",
-                "</conversation>\n"
+                "</messages>\n"
                 "Remember to stay true to your persona and role:\n{persona}\n"
                 "BEGIN!",
             ),
@@ -291,7 +291,7 @@ class LeaderNode(BaseNode):
                     "\n\n{team_task}\n\n"
                     "Stay true to your persona:"
                     "\n\n{persona}\n\n"
-                    "Given the conversation below, who should act next? Or should we FINISH? Select one of: {options}."
+                    "Given the messages below, who should act next? Or should we FINISH? Select one of: {options}."
                 ),
             ),
             MessagesPlaceholder(variable_name="main_task"),
```

---

### Incident Patch 14: `d3e596b9` (2024-07-02)
**Commit Message**: Fix sequential agents unable to use skills and uploads. (#65)

- Use `memberModel` instead of `member` when populating tools.
- Refactor `convert_sequential_team_to_dict` to take a list of members instead of team.

**File**: `backend/app/core/graph/build.py` (modified, +5/-7)
```diff
@@ -139,14 +139,13 @@ def convert_hierarchical_team_to_dict(
     return teams
 
 
-def convert_sequential_team_to_dict(team: Team) -> Mapping[str, GraphMember]:
+def convert_sequential_team_to_dict(members: list[Member]) -> Mapping[str, GraphMember]:
     team_dict: dict[str, GraphMember] = {}
 
     in_counts: defaultdict[int, int] = defaultdict(int)
     out_counts: defaultdict[int, list[int]] = defaultdict(list[int])
     members_lookup: dict[int, Member] = {}
-
-    for member in team.members:
+    for member in members:
         assert member.id is not None, "member.id is unexpectedly None"
         if member.source:
             in_counts[member.id] += 1
@@ -171,7 +170,7 @@ def convert_sequential_team_to_dict(team: Team) -> Mapping[str, GraphMember]:
                 managed=skill.managed,
                 definition=skill.tool_definition,
             )
-            for skill in member.skills
+            for skill in memberModel.skills
         ]
         tools += [
             GraphUpload(
@@ -180,7 +179,7 @@ def convert_sequential_team_to_dict(team: Team) -> Mapping[str, GraphMember]:
                 owner_id=upload.owner_id,
                 upload_id=cast(int, upload.id),
             )
-            for upload in member.uploads
+            for upload in memberModel.uploads
             if upload.owner_id is not None
         ]
         graph_member = GraphMember(
@@ -453,7 +452,6 @@ async def generator(
 
     try:
         memory = await AsyncPostgresSaver.from_conn_string(settings.PG_DATABASE_URI)
-
         if team.workflow == "hierarchical":
             teams = convert_hierarchical_team_to_dict(team, members)
             team_leader = list(teams.keys())[0]
@@ -466,7 +464,7 @@ async def generator(
                 "main_task": formatted_messages,
             }
         else:
-            member_dict = convert_sequential_team_to_dict(team)
+            member_dict = convert_sequential_team_to_dict(members)
             root = create_sequential_graph(member_dict, memory)
             first_member = list(member_dict.values())[0]
             state = {
```

---

### Incident Patch 15: `b9af2271` (2024-06-29)
**Commit Message**: Fix potential out of memory issue by setting max workers in backend container (#63)

**File**: `.env.example` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ FIRST_SUPERUSER=admin@example.com
 FIRST_SUPERUSER_PASSWORD=changethis
 USERS_OPEN_REGISTRATION=False
 MAX_UPLOAD_SIZE=50_000_000
+MAX_WORKERS=4
 
 # llm provider keys. Add only to models that you want to use
 OPENAI_API_KEY=
```

**File**: `docker-compose.yml` (modified, +1/-0)
```diff
@@ -66,6 +66,7 @@ services:
     env_file:
       - .env
     environment:
+      - MAX_WORKERS=${MAX_WORKERS}
       - DOMAIN=${DOMAIN}
       - ENVIRONMENT=${ENVIRONMENT}
       - BACKEND_CORS_ORIGINS=${BACKEND_CORS_ORIGINS}
```

**File**: `local-deployment.md` (modified, +1/-0)
```diff
@@ -83,5 +83,6 @@ Once the containers are running, you can access various services through the fol
 - **Adminer**: [http://adminer.localhost/](http://adminer.localhost/)
 
 ## Troubleshooting
+- **Out of Memory**: If you are getting the `Worker (pid:14) was sent SIGKILL! Perhaps out of memory?` error, this is due to the number of processes started for the backend container consuming more memory than what is available. You can fix this by decreasing `MAX_WORKERS` in your `.env` file.
 - **Unable to login to Traefik Dashboard**: Ensure that username and password is correct. If you are using zsh, `USERNAME` environment variable corresponds to the real user ID of the shell process, so you shold use your user ID as the username.
 - **Cannot login to Adminer**: Set 'System' to `PostgreSQL` and set the 'server' field should be `db`. The other fields should follow the values in your `.env` file.
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #161** (closed): Codex/add image and file loading support (@zzzzzzzzzzzzz)
- **PR #157** (closed): Russification (@zzzzzzzzzzzzz)
- **PR #154** (closed): ⬆ Bump actions/download-artifact from 4 to 5 (@dependabot[bot])
- **PR #153** (2025-01-19): Update README.md (@StreetLamb)
- **PR #152** (2025-01-12): Update README.md (@StreetLamb)
- **PR #150** (2024-11-21): Bump aiohttp from 3.10.2 to 3.10.11 in /backend (@dependabot[bot])
- **PR #149** (2024-11-21): Bump onnx from 1.16.1 to 1.17.0 in /backend (@dependabot[bot])
- **PR #147** (2024-10-07): Bump vite from 5.0.13 to 5.4.8 in /frontend (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
