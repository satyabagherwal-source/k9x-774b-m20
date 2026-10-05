# Forensic Learning Record (Deep Inspection): video-db/Director

> **Canonical Artifact**: `07_PROJECT_LEARNING/video-db-director-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/video-db/Director](https://github.com/video-db/Director))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:26:31.790Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `video-db/Director`
- **Description**: AI video agents framework for next-gen video interactions and workflows.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1543 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/director/core/reasoning.py`
```
import logging
from typing import List


from director.agents.base import BaseAgent, AgentStatus, AgentResponse
from director.core.session import (
    Session,
    OutputMessage,
    InputMessage,
    ContextMessage,
    RoleTypes,
    TextContent,
    MsgStatus,
)
from director.llm.base import LLMResponse
from director.llm import get_default_llm


logger = logging.getLogger(__name__)


REASONING_SYSTEM_PROMPT = """
SYSTEM PROMPT: The Director (v1.2)

1. **Task Handling**:
   - Identify and select agents based on user input and context.
   - Provide actionable instructions to agents to complete tasks.
   - Combine agent outputs with user input to generate meaningful responses.
   - Iterate until the request is fully addressed or the user specifies "stop."

2. **Fallback Behavior**:
   - If a task requires a video_id but one is unavailable:
     - For Stream URLs (m3u8), external URLs (e.g., YouTube links, direct video links, or videos hosted on other platforms):
       - Use the upload agent to generate a video_id.
       - Immediately proceed with the original task using the newly generated video_id.

3. **Identity**:
   - Respond to identity-related queries with: "I am The Director, your AI assistant for video workflows and management."
   - Provide descriptions of all the agents.

4. **Agent Usage**:
   - Always prioritize the appropriate agent for the task:
     - Use summarize_video for summarization requests unless search is explicitly requested.
     - For external video URLs, automatically upload and process them if required for further actions (e.g., summarization, indexing, or editing).
     - Use stream_video for video playback.
     - Ensure seamless workflows by automatically resolving missing dependencies (e.g., uploading external URLs for a missing video_id) without additional user intervention.

5. **Clarity and Safety**:
   - Confirm with the user if a request is ambiguous.
   - Avoid sharing technical details (e.g., code, video IDs, collection IDs) unless explicitly requested.
   - Keep the tone friendly and vibrant.

6. **LLM Knowledge Usage**:
   - Do not use knowledge from the LLM's training data unless the user explicitly requests it.
   - If the information is unavailable in the video or context:
     - Inform the user: "The requested information is not available in the current video or context."
     - Ask the user: "Would you like me to answer using knowledge from my training data?"

7. **Agent Descriptions**:
   - When asked, describe an agent's purpose, and provide an example query (use contextual video data when available).

8. **Context Awareness**:
   - Adapt responses based on conversation context to maintain relevance.
    """.strip()

SUMMARIZATION_PROMPT = """
FINAL CUT PROMPT: Generate a concise summary of the actions performed by the agents based on their responses.

1. Provide an overview of the tasks completed by each agent, listing the actions taken and their outcomes.
2. Exclude individual agent responses from the summary unless explicitly specified to include them.
3. Ensure the summary is user-friendly, succinct and avoids technical jargon unless requested by the user.
4. If there were any errors, incomplete tasks, or user confirmations required:
   - Clearly mention the issue in the summary.
   - Politely inform the user: "If you encountered any issues or have further questions, please don't hesitate to reach out to our team on [Discord](https://discord.com/invite/py9P639jGz). We're here to help!"
5. If the user seems dissatisfied or expresses unhappiness:
   - Acknowledge their concerns in a respectful and empathetic tone.
   - Include the same invitation to reach out on Discord for further assistance.
6. End the summary by inviting the user to ask further questions or clarify additional needs.

"""


class ReasoningEngine:
    """The Reasoning Engine is the core class that directly interfaces with the user. It interprets natural language input in any conversation and orchestrates agents to fulfill the user's requests. The primary functions of the Reasoning Engine are:

    * Maintain Context of Conversational History: Manage memory, context limits, input, and output experiences to ensure coherent and context-aware interactions.
    * Natural Language Understanding (NLU): Uses LLMs of your choice to have understanding of the task.
    * Intelligent Reference Deduction: Intelligently deduce references to previous messages, outputs, files, agents, etc., to provide relevant and accurate responses.
    * Agent Orchestration: Decide on agents and their workflows to fulfill requests. Multiple strategies can be employed to create agent workflows, such as step-by-step processes or chaining of agents provided by default.
    * Final Control Over Conversation Flow: Maintain ultimate control over the flow of conversation with the user, ensuring coherence and goal alignment."""

    def __init__(
        self,
        input_message: InputMessage,
        session: Session,
    ):
        """Initialize the ReasoningEngine with the input message and session.

        :param input_message: The input message to the reasoning engine.
        :param session: The session instance.
        """
        self.input_message = input_message
        self.session = session
        self.system_prompt = REASONING_SYSTEM_PROMPT
        self.max_iterations = 10
        self.llm = get_default_llm()
        self.agents: List[BaseAgent] = []
        self.stop_flag = False
        self.output_message: OutputMessage = self.session.output_message
        self.summary_content = None
        self.failed_agents = []

    def register_agents(self, agents: List[BaseAgent]):
        """Register an agents.

        :param agents: The list of agents to register.
        """
        self.agents.extend(agents)

    def build_context(self):
        """Build the context for the reasoning engine it adds the information about the video or collection to the reasoning context."""
        input_context = ContextMessage(
            content=self.input_message.content, role=RoleTypes.user
        )
        if self.session.reasoning_context:
            self.session.reasoning_context.append(input_context)
        else:
            if self.session.video_id:
                video = self.session.state["video"]
                self.session.reasoning_context.append(
                    ContextMessage(
                        content=self.system_prompt
                        + f"""\nThis is a video in the collection titled {self.session.state["collection"].name} collection_id is {self.session.state["collection"].id} \nHere is the video refer to this for search, summary and editing \n- title: {video.name}, video_id: {video.id}, media_description: {video.description}, length: {video.length}"""
                    )
                )
            else:
                videos = self.session.state["collection"].get_videos()
                video_title_list = []
                for video in videos:
                    video_title_list.append(
                        f"\n- title: {video.name}, video_id: {video.id}, media_description: {video.description}, length: {video.length}, video_stream: {video.stream_url}"
                    )
                video_titles = "\n".join(video_title_list)
                images = self.session.state["collection"].get_images()
                image_title_list = []
                for image in images:
                    image_title_list.append(
                        f"\n- title: {image.name}, image_id: {image.id}, url: {image.url}"
                    )
                image_titles = "\n".join(image_title_list)
                self.session.reasoning_context.append(
                    ContextMessage(
                        content=self.system_prompt
                        + f"""\nThis is a collection of videos and the collection description is {self.session.state["collection"].description} and collection_id is {self.session.state["collection"].id} \n\nHere are the videos in this collection user may refer to them for search, summary and editing {video_titles}\n\nHere are the images in this collection {image_titles}"""
                    )
                )
            self.session.reasoning_context.append(input_context)

    def get_current_run_context(self):
        for i in range(len(self.session.reasoning_context) - 1, -1, -1):
            if self.session.reasoning_context[i].role == RoleTypes.user:
                return self.session.reasoning_context[i:]
        return []

    def remove_summary_content(self):
        for i in range(len(self.output_message.content) - 1, -1, -1):
            if self.output_message.content[i].agent_name == "assistant":
                self.output_message.content.pop(i)
                self.summary_content = None

    def add_summary_content(self):
        self.summary_content = TextContent(agent_name="assistant")
        self.output_message.content.append(self.summary_content)
        self.summary_content.status_message = "Consolidating outcomes..."
        self.summary_content.status = MsgStatus.progress
        self.output_message.push_update()
        return self.summary_content

    def run_agent(self, agent_name: str, *args, **kwargs) -> AgentResponse:
        """Run an agent with the given name and arguments.

        :param str agent_name: The name of the agent to run
        :param args: The arguments to pass to the agent
        :param kwargs: The keyword arguments to pass to the agent
        :return: The response from the agent
        """
        print("-" * 40, f"Running {agent_name} Agent", "-" * 40)
        print(kwargs, "\n\n")

        agent = next(
            (agent for agent in self.agents if agent.agent_name == agent_name), None
        )
        self.output_message.actions.append(f"Running @{agent_name} agent")
        self.output_message.agents.append(agent_name)
        self.output_message.push_update()
        return agent.safe_call(*ar
```

### Core Architecture Module: `backend/director/core/session.py`
```
import json

from enum import Enum
from datetime import datetime
from typing import Optional, List, Union

from flask_socketio import emit
from pydantic import BaseModel, Field, ConfigDict

from director.db.base import BaseDB


class RoleTypes(str, Enum):
    """Role types for the context message."""

    system = "system"
    user = "user"
    assistant = "assistant"
    tool = "tool"


class MsgStatus(str, Enum):
    """Message status for the message, for loading state."""

    progress = "progress"
    success = "success"
    error = "error"
    not_generated = "not_generated"
    overlimit = "overlimit"
    sessionlimit = "sessionlimit"


class MsgType(str, Enum):
    """Message type for the message. input is for the user input and output is for the director output."""

    input = "input"
    output = "output"


class ContentType(str, Enum):
    """Content type for the content in the input/output message."""

    text = "text"
    video = "video"
    videos = "videos"
    image = "image"
    search_results = "search_results"


class EventType(str, Enum):
    """Event types for WebSocket event emission."""

    update_data = "update_data"


class BaseEvent(BaseModel):
    """Base event class for the WebSocket event."""

    event_type: EventType


class CollectionsUpdateEvent(BaseEvent):
    """Collections update event class for the WebSocket event."""

    event_type: EventType = EventType.update_data
    update: str = "collections"


class VideosUpdateEvent(BaseEvent):
    """Videos update event class for the WebSocket event."""

    event_type: EventType = EventType.update_data
    update: str = "videos"
    collection_id: str


class BaseContent(BaseModel):
    """Base content class for the content in the message."""

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        use_enum_values=True,
        validate_default=True,
    )

    type: ContentType
    status: MsgStatus = MsgStatus.progress
    status_message: Optional[str] = None
    agent_name: Optional[str] = None


class TextContent(BaseContent):
    """Text content model class for text content."""

    text: str = ""
    type: ContentType = ContentType.text


class VideoData(BaseModel):
    """Video data model class for video content."""

    stream_url: Optional[str] = None
    external_url: Optional[str] = None
    player_url: Optional[str] = None
    id: Optional[str] = None
    collection_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    length: Optional[Union[int, float]] = None
    error: Optional[str] = None


class VideoContent(BaseContent):
    """Video content model class for video content."""

    video: Optional[VideoData] = None
    type: ContentType = ContentType.video


class VideosContentUIConfig(BaseModel):
    columns: Optional[int] = 4


class VideosContent(BaseContent):
    """Videos content model class for videos content."""

    videos: Optional[List[VideoData]] = None
    ui_config: VideosContentUIConfig = VideosContentUIConfig()
    type: ContentType = ContentType.videos


class ImageData(BaseModel):
    """Image data model class for image content."""

    url: str
    name: Optional[str] = None
    description: Optional[str] = None
    id: Optional[str] = None
    collection_id: Optional[str] = None


class ImageContent(BaseContent):
    """Image content model class for image content."""

    image: Optional[ImageData] = None
    type: ContentType = ContentType.image


class ShotData(BaseModel):
    """Shot data model class for search results content."""

    search_score: Union[int, float]
    start: Union[int, float]
    end: Union[int, float]
    text: str


class SearchData(BaseModel):
    """Search data model class for search results content."""

    video_id: str
    video_title: Optional[str] = None
    stream_url: str
    duration: Union[int, float]
    shots: List[ShotData]


class SearchResultsContent(BaseContent):
    search_results: Optional[List[SearchData]] = None
    type: ContentType = ContentType.search_results


class BaseMessage(BaseModel):
    """Base message class for the input/output message. All the input/output messages will be inherited from this class."""

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        use_enum_values=True,
        validate_default=True,
    )

    session_id: str
    conv_id: str
    msg_type: MsgType
    actions: List[str] = []
    agents: List[str] = []
    content: List[
        Union[
            dict,
            TextContent,
            ImageContent,
            VideoContent,
            VideosContent,
            SearchResultsContent,
        ]
    ] = []
    status: MsgStatus = MsgStatus.success
    msg_id: str = Field(
        default_factory=lambda: str(datetime.now().timestamp() * 100000)
    )


class InputMessage(BaseMessage):
    """Input message from the user. This class is used to create the input message from the user."""

    db: BaseDB
    msg_type: MsgType = MsgType.input

    def publish(self):
        """Store the message in the database. for conversation history."""
        self.db.add_or_update_msg_to_conv(**self.model_dump(exclude={"db"}))


class OutputMessage(BaseMessage):
    """Output message from the director. This class is used to create the output message from the director."""

    db: BaseDB = Field(exclude=True)
    msg_type: MsgType = MsgType.output
    status: MsgStatus = MsgStatus.progress

    def update_status(self, status: MsgStatus):
        """Update the status of the message and publish the message to the socket. for loading state."""
        self.status = status
        self._publish()

    def push_update(self):
        """Publish the message to the socket."""
        try:
            self._publish()
        except Exception as e:
            print(f"Error in emitting message: {str(e)}")

    def publish(self):
        """Store the message in the database. for conversation history and publish the message to the socket."""
        self._publish()

    def _publish(self):
        try:
            emit("chat", self.model_dump(), namespace="/chat")
        except Exception as e:
            print(f"Error in emitting message: {str(e)}")
        self.db.add_or_update_msg_to_conv(**self.model_dump())


def format_user_message(message: dict) -> dict:
    message_content = message.get("content")
    if isinstance(message_content, str):
        return message
    else:
        content_parts = message["content"]
        sanitized_content_parts = []

        for content_part in content_parts:
            sanitized_part = content_part
            if content_part["type"] == "image":
                sanitized_part = {
                    "type": "text",
                    "text": f"User has upload image with following details : {json.dumps(content_part)}",
                }
            sanitized_content_parts.append(sanitized_part)

        message["content"] = sanitized_content_parts
        return message


class ContextMessage(BaseModel):
    """Context message class. This class is used to create the context message for the reasoning context."""

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        validate_default=True,
        use_enum_values=True,
    )

    content: Optional[Union[List[dict], str]] = None
    tool_calls: Optional[List[dict]] = None
    tool_call_id: Optional[str] = None
    role: RoleTypes = RoleTypes.system

    def to_llm_msg(self):
        """Convert the context message to the llm message."""
        msg = {
            "role": self.role,
            "content": self.content,
        }
        if self.role == RoleTypes.system:
            return msg

        if self.role == RoleTypes.user:
            return format_user_message(msg)

        if self.role == RoleTypes.assistant:
            if self.tool_calls:
                msg["tool_calls"] = self.tool_calls
            if not self.content:
                msg["content"] = []
            return msg

        if self.role == RoleTypes.tool:
            msg["tool_call_id"] = self.tool_call_id
            return msg

    @classmethod
    def from_json(cls, json_data):
        """Create the context message from the json data."""
        return cls(**json_data)


class Session:
    """A class to manage and interact with a session in the database. The session is used to store the conversation and reasoning context messages."""

    def __init__(
        self,
        db: BaseDB,
        session_id: str = "",
        conv_id: str = "",
        collection_id: str = None,
        video_id: str = None,
        **kwargs,
    ):
        self.db = db
        self.session_id = session_id
        self.conv_id = conv_id
        self.conversations = []
        self.video_id = video_id
        self.collection_id = collection_id
        self.reasoning_context = []
        self.agent_context = {}
        self.state = {}
        self.output_message = OutputMessage(
            db=self.db, session_id=self.session_id, conv_id=self.conv_id
        )
        self.edited_context = kwargs.get("edited_context", None)

        self.get_context_messages()

    def save_context_messages(self):
        """Save the reasoning context messages to the database."""
        context = {
            "reasoning": [message.to_llm_msg() for message in self.reasoning_context],
        }
        if self.agent_context:
            for agent_name, agent_context in self.agent_context.items():
                context[agent_name] = [message.to_llm_msg() for message in agent_context]
        self.db.add_or_update_context_msg(self.session_id, context)

    def get_context_messages(self, agent_name: str = None):
        """Get the reasoning context messages from the database or use edited context if provided."""
        if agent_name:
            context = self.edited_context or self.db.get_context_messages(self.session_id)
            return [
              
```

### Core Architecture Module: `backend/director/utils/asyncio.py`
```
import asyncio


def is_event_loop_running():
    try:
        asyncio.get_running_loop()
        return True
    except RuntimeError:
        return False

```

### Core Architecture Module: `backend/director/utils/exceptions.py`
```
"""This module contains the exceptions used in the director package."""


class DirectorException(Exception):
    """Base class for exceptions in this module."""

    def __init__(self, message="An error occurred.", **kwargs):
        super(ValueError, self).__init__(message)


class AgentException(DirectorException):
    """Exception raised for errors in the agent."""

    def __init__(self, message="An error occurred in the agent", **kwargs):
        super(ValueError, self).__init__(message)


class ToolException(DirectorException):
    """Exception raised for errors in the tool."""

    def __init__(self, message="An error occurred in the tool", **kwargs):
        super(ValueError, self).__init__(message)

```

### Core Architecture Module: `backend/director/agents/audio_generation.py`
```
import logging
import os
import uuid
import base64
from typing import Optional

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, TextContent, MsgStatus
from director.tools.videodb_tool import VDBAudioGenerationTool, VideoDBTool
from director.tools.elevenlabs import (
    ElevenLabsTool,
    PARAMS_CONFIG as ELEVENLABS_PARAMS_CONFIG
)
from director.tools.beatoven import BeatovenTool

from director.constants import DOWNLOADS_PATH

logger = logging.getLogger(__name__)

SUPPORTED_ENGINES = ["elevenlabs", "beatoven", "videodb"]

AUDIO_GENERATION_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "The unique identifier of the collection to store audio",
        },
        "engine": {
            "type": "string",
            "description": """The engine to use for audio generation. Default is 'videodb'.`:
                - videodb: supports text_to_speech, sound_effect and create_music
                - elevenlabs: supports text_to_speech and sound_effect
                - beatoven: supports create_music""",
            "default": "videodb",
            "enum": SUPPORTED_ENGINES,
        },
        "job_type": {
            "type": "string",
            "enum": ["text_to_speech", "sound_effect", "create_music"],
            "description": """The type of audio generation to perform:
                - text_to_speech: converts text to speech (elevenlabs and videodb engine only)
                - sound_effect: creates sound effects (elevenlabs and videodb engine only)
                - create_music: creates background music (beatoven and videodb engine only)""",
        },
        "sound_effect": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "The prompt to generate the sound effect",
                },
                "duration": {
                    "type": "number",
                    "description": "Duration of the sound effect in seconds",
                    "default": 2,
                },
                "audio_config": {
                    "type": "object",
                    "properties": ELEVENLABS_PARAMS_CONFIG["sound_effect"],
                    "description": "Config for elevenlabs engine",
                },
            },
            "required": ["prompt"],
        },
        "create_music": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "The prompt to generate the music",
                },
                "duration": {
                    "type": "number",
                    "description": "Duration of the music in seconds",
                    "default": 30,
                },
            },
            "required": ["prompt"],
        },
        "text_to_speech": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The text to convert to speech",
                },
                "audio_config": {
                    "type": "object",
                    "properties": ELEVENLABS_PARAMS_CONFIG["text_to_speech"],
                },
            },
            "required": ["text"],
        },
    },
    "required": ["job_type", "collection_id", "engine"],
}


class AudioGenerationAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "audio_generation"
        self.description = (
            "Agent to generate speech, sound effects, and background music"
        )
        self.parameters = AUDIO_GENERATION_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        job_type: str,
        engine: str,
        sound_effect: Optional[dict] = None,
        text_to_speech: Optional[dict] = None,
        create_music: Optional[dict] = None,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Generates audio using various engines based on input.
        :param collection_id: The collection ID to store the generated audio
        :param job_type: The type of audio to generate
        :param engine: The engine to use for generation
        :param sound_effect: The sound effect parameters
        :param text_to_speech: The text to speech parameters
        :param create_music: The music generation parameters
        :return: Response containing the generated audio URL
        """
        try:
            media = None
            self.videodb_tool = VideoDBTool(collection_id=collection_id)

            if engine not in SUPPORTED_ENGINES:
                raise Exception(f"{engine} not supported")

            config_key = "audio_config"
            if engine == "elevenlabs":
                ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
                if not ELEVENLABS_API_KEY:
                    raise Exception("Elevenlabs API key not present in .env")
                audio_gen_tool = ElevenLabsTool(api_key=ELEVENLABS_API_KEY)
            elif engine == "beatoven":
                BEATOVEN_API_KEY = os.getenv("BEATOVEN_API_KEY")
                if not BEATOVEN_API_KEY:
                    raise Exception("Beatoven API key not present in .env")
                audio_gen_tool = BeatovenTool(api_key=BEATOVEN_API_KEY)
            elif engine == "videodb":
                audio_gen_tool = VDBAudioGenerationTool()    

            os.makedirs(DOWNLOADS_PATH, exist_ok=True)
            output_file_name = f"audio_{job_type}_{str(uuid.uuid4())}.mp3"
            output_path = f"{DOWNLOADS_PATH}/{output_file_name}"

            if job_type == "sound_effect":
                if engine == "beatoven":
                    raise Exception("Sound effects only supported with elevenlabs or videodb")
                prompt = sound_effect.get("prompt")
                duration = sound_effect.get("duration", 5)
                config = sound_effect.get(config_key, {})
                if prompt is None:
                    raise Exception("Prompt is required for sound effect")
                msg = f"Generating sound effect using <b>{engine}</b>"
                self.output_message.actions.append(
                    f"{msg} for prompt <i>{prompt}</i>"
                )
                self.output_message.push_update()
                media = audio_gen_tool.generate_sound_effect(
                    prompt=prompt,
                    save_at=output_path,
                    duration=duration,
                    config=config,
                )
            elif job_type == "create_music":
                if engine not in ["beatoven", "videodb"]:
                    raise Exception("Music creation only supported with beatoven")
                prompt = create_music.get("prompt")
                duration = create_music.get("duration", 30)
                if prompt is None:
                    raise Exception("Prompt is required for music generation")
                msg = f"Generating music using <b>{engine}</b>"
                self.output_message.actions.append(
                    f"{msg} for prompt <i>{prompt}</i>"
                )
                self.output_message.push_update()
                media = audio_gen_tool.generate_music(
                    prompt=prompt,
                    save_at=output_path,
                    duration=duration
                )
            elif job_type == "text_to_speech":
                if engine not in ["elevenlabs", "videodb"]:
                    raise Exception("Text to speech only supported with elevenlabs and videodb")
                text = text_to_speech.get("text")
                config = text_to_speech.get(config_key, {})
                msg = f"Using <b>{engine}</b> to convert text"
                self.output_message.actions.append(
                    f"{msg} <i>{text}</i> to speech"
                )
                self.output_message.push_update()
                media = audio_gen_tool.text_to_speech(
                    text=text,
                    save_at=output_path,
                    config=config,
                )

            self.output_message.push_update()

            if media is None:
                self.output_message.actions.append(
                    f"Generated audio saved at <i>{output_path}</i>"
                )
                media = self.videodb_tool.upload(
                    output_path,
                    source_type="file_path",
                    media_type="audio"
                )
                msg = "Uploaded generated audio to VideoDB"
            else:
                msg = "Generated audio stored in collection"
            self.output_message.actions.append(
                f"{msg} with Audio ID {media['id']}"
            )
            with open(os.path.abspath(output_path), "rb") as file:
                b64_data = base64.b64encode(file.read()).decode('utf-8')
                data_url = f"data:audio/mpeg;base64,{b64_data}"
                dl_link = (
                    f"<a href='{data_url}' "
                    f"download='{output_file_name}' "
                    f"target='_blank'>here</a>"
                )
                text_content = TextContent(
                    agent_name=self.agent_name,
                    status=MsgStatus.success,
                    status_message="Here is your generated audio",
                    text=f"Click {dl_link} to download the audio",
                )
            self.output_message.content.append(text_content)
            self.output_message.push_update()
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent: {e}")
            text_content = TextContent(
             
```

### Core Architecture Module: `backend/director/agents/base.py`
```
import logging

from abc import ABC, abstractmethod
from pydantic import BaseModel

from openai_function_calling import FunctionInferrer

from director.core.session import Session, OutputMessage

logger = logging.getLogger(__name__)


class AgentStatus:
    SUCCESS = "success"
    ERROR = "error"


class AgentResponse(BaseModel):
    """Data model for respones from agents."""

    status: str = AgentStatus.SUCCESS
    message: str = ""
    data: dict = {}


class BaseAgent(ABC):
    """Interface for all agents. All agents should inherit from this class."""

    def __init__(self, session: Session, **kwargs):
        self.session: Session = session
        self.output_message: OutputMessage = self.session.output_message

    def get_parameters(self):
        """Return the automatically inferred parameters for the function using the dcstring of the function."""
        function_inferrer = FunctionInferrer.infer_from_function_reference(self.run)
        function_json = function_inferrer.to_json_schema()
        parameters = function_json.get("parameters")
        if not parameters:
            raise Exception(
                "Failed to infere parameters, please define JSON instead of using this automated util."
            )

        parameters["properties"].pop("args", None)
        parameters["properties"].pop("kwargs", None)

        if "required" in parameters:
            parameters["required"] = [
                param
                for param in parameters["required"]
                if param not in ["args", "kwargs"]
            ]

        return parameters

    def to_llm_format(self):
        """Convert the agent to LLM tool format."""
        return {
            "name": self.agent_name,
            "description": self.description,
            "parameters": self.parameters,
        }

    @property
    def name(self):
        return self.agent_name

    @property
    def agent_description(self):
        return self.description

    def safe_call(self, *args, **kwargs):
        try:
            return self.run(*args, **kwargs)

        except Exception as e:
            logger.exception(f"error in {self.agent_name} agent: {e}")
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

    @abstractmethod
    def run(*args, **kwargs) -> AgentResponse:
        pass

```

### Core Architecture Module: `backend/director/agents/censor.py`
```
import json
import logging
import os

from videodb.asset import VideoAsset, AudioAsset

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    VideoContent,
    VideoData,
    ContextMessage,
    RoleTypes,
)
from director.llm import get_default_llm
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

BEEP_AUDIO_ID = os.getenv("BEEP_AUDIO_ID")
DEFAULT_CENSOR_PROMPT = """
Given the following transcript give the list of timestamps where profanity is there for censoring.
"""
OUTPUT_PROMPT = """
Expected output format is json like {"timestamps": [(start, end), (start, end)]} where start and end are float in seconds
"""


class CensorAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "censor"
        # TODO: When audios are added in context rework in description will be needed to make sure that the existing beep id is being passed
        self.description = (
            "This agent beeps the profanities in the given video and returns the updated video stream. "
            "Take the `beep_audio_id` from the context, if no beep audio found send it as `None` so defaults are picked from the environment."
        )
        self.parameters = self.get_parameters()
        self.llm = get_default_llm()
        super().__init__(session=session, **kwargs)

    def add_beep(
        self, videodb_tool, video_id, beep_audio_id, beep_audio_length, timestamps
    ):
        beep_audio_length = float(beep_audio_length)
        timeline = videodb_tool.get_and_set_timeline()
        video_asset = VideoAsset(asset_id=video_id)
        timeline.add_inline(video_asset)
        for start, end in timestamps:
            # NOTES: when words are very small (sub seconds) we need to add some padding
            # Taking min with audio will make sure that we don't overflow
            buffered_start = start - 0.4
            buffered_end = end + 0.4
            length = min(beep_audio_length, (buffered_end - buffered_start))
            beep = AudioAsset(asset_id=beep_audio_id, end=length)
            # Slight adjustment to land on the word
            # TODO: Check if it can be handled in a better / dynamic way
            adjusted_start = start - 0.4
            timeline.add_overlay(start=adjusted_start, asset=beep)
        stream_url = timeline.generate_stream()
        return stream_url

    def run(
        self,
        collection_id: str,
        video_id: str,
        beep_audio_id: str = None,
        censor_prompt: str = "",
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Process the video to remove the profanities by overlaying beep.

        :param str collection_id: collection id in which the source video is present.
        :param str video_id: video_id on which adding censor needs to run.
        :param str beep_audio_id: audio id of beep asset in videodb, defaults to BEEP_AUDIO_ID
        :param str censor_prompt: direction by users on what to censor
        :param args: Additional positional arguments.
        :param kwargs: Additional keyword arguments.
        :return: The response containing information about the sample processing operation.
        :rtype: AgentResponse
        """
        try:
            video_content = VideoContent(
                agent_name=self.agent_name, status=MsgStatus.progress
            )
            video_content.status_message = "Generating clean stream.."
            self.output_message.actions.append("Started process to censor..")
            self.output_message.push_update()
            videodb_tool = VideoDBTool(collection_id=collection_id)
            beep_audio_id = beep_audio_id or BEEP_AUDIO_ID
            if not beep_audio_id:
                self.output_message.actions.append(
                    "Beep audio ID not passed, finding in the collection.."
                )
                self.output_message.push_update()
                # Find beep in the users context
                # TODO: This can be better by passing the context to LLM to find the auido ID
                audios = videodb_tool.get_audios()
                for audio in audios:
                    if "beep" in audio.get("name", "").lower():
                        beep_audio_id = audio.get("id")
                        beep_audio_length = audio.get("length")
                        self.output_message.actions.append(
                            "Found existing beep in the collection."
                        )
                        self.output_message.push_update()
                        break
                else:
                    # Upload if not found
                    self.output_message.actions.append(
                        "Couldn't find beep in the collection, uploading.."
                    )
                    self.output_message.push_update()
                    beep_audio = videodb_tool.upload(
                        "https://www.youtube.com/watch?v=GvXbEO5Kbgc",
                        media_type="audio",
                        name="beep",
                    )
                    beep_audio_id = beep_audio.get("id")
                    beep_audio_length = beep_audio.get("length")
            else:
                beep_audio = videodb_tool.get_audio(beep_audio_id)
                beep_audio_id = beep_audio.get("id")
                beep_audio_length = beep_audio.get("length")
            try:
                transcript = videodb_tool.get_transcript(video_id, text=False)
            except Exception:
                logger.error("Failed to get transcript, indexing")
                self.output_message.actions.append("Indexing the video..")
                self.output_message.push_update()
                videodb_tool.index_spoken_words(video_id)
                transcript = videodb_tool.get_transcript(video_id, text=False)
            if not censor_prompt:
                censor_prompt = DEFAULT_CENSOR_PROMPT
            self.output_message.actions.append(
                f"Censoring the video with prompt: '{censor_prompt[:1000]}..'"
            )
            self.output_message.push_update()
            final_censor_prompt = (
                f"{censor_prompt}{OUTPUT_PROMPT}\n\ntranscript: {transcript}"
            )
            censor_llm_message = ContextMessage(
                content=final_censor_prompt,
                role=RoleTypes.user,
            )
            llm_response = self.llm.chat_completions(
                [censor_llm_message.to_llm_msg()],
                response_format={"type": "json_object"},
            )
            censor_timeline_response = json.loads(llm_response.content)
            censor_timeline = censor_timeline_response.get("timestamps")
            clean_stream = self.add_beep(
                videodb_tool,
                video_id,
                beep_audio_id,
                beep_audio_length,
                censor_timeline,
            )
            video_content.video = VideoData(stream_url=clean_stream)
            video_content.status = MsgStatus.success
            video_content.status_message = "Here is the clean stream"
            self.output_message.content.append(video_content)
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Failed to generate clean stream"
            self.output_message.publish()
            error_message = f"Error in generating the clean stream due to {e}."
            return AgentResponse(status=AgentStatus.ERROR, message=error_message)
        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message=f"Agent {self.name} completed successfully.",
            data={"stream_url": clean_stream},
        )

```

### Core Architecture Module: `backend/director/agents/clone_voice.py`
```
import logging
import os
import requests
import uuid
import base64
from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, TextContent
from director.tools.elevenlabs import ElevenLabsTool
from director.tools.videodb_tool import VideoDBTool
from director.constants import DOWNLOADS_PATH

logger = logging.getLogger(__name__)

CLONE_VOICE_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "audio_source": {
            "type": "object",
            "properties": {
                "audio_url": {
                    "type": "string",
                    "format": "uri",
                    "description": "A direct URL to the audio file to clone the voice from."
                },
                "video_id": {
                    "type": "string",
                    "description": "ID of the video from which the audio should be extracted."
                }, 
                "start_time": {
                    "type": "number",
                    "description": "The start time (in seconds)."
                },
                "end_time": {
                    "type": "number",
                    "description": "The end time (in seconds)."
                },
                "collection_id": {
                    "type": "string",
                    "description": "ID of the collection where the sample video is stored."
                }
            },
            "required": [],
            "description": "Provide either an audio URL or a video ID, but not both. If video_id is provided, collection_id is required."
        },
        "text_to_synthesis": {
            "type": "string",
            "description": "The text which the user wants to convert into audio in the given voice.",
        },
        "name_of_voice": {
            "type": "string",
            "description": "The name to give to the voice.",
        },
        "description": {
            "type": "string",
            "description": "Description of how the voice sounds, e.g., 'old person', 'childlike and cute', etc."
        },
        "is_authorized_to_clone_voice": {
            "type": "boolean",
            "description": "This is a flag to check if the user is authorised to clone the voice or not. If the user has explicitly mentioned that they are authorised to clone the voice, then the flag is TRUE else FALSE. Make sure to confirm that the user is authorised or not. If not specified explicitly or not specified at all, the flag should be FALSE"
        },
        "cloned_voice_id": {
            "type": "string",
            "description": "This is the ID of the voice which is present if the user has already cloned a voice before. The cloned_voice_id can be taken from the previous results of cloning if the audio URL is not changed"
        },
        "collection_id": {
            "type": "string",
            "description": "the ID of the collection to store the output audio file",
        }
    },
    "required": ["audio_source", "text_to_synthesis", "is_authorized_to_clone_voice", "collection_id", "name_of_voice"],
}

class CloneVoiceAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "clone_voice"
        self.description = "This agent is used to clone the voice of the given by the user. The user must be authorised to clone the voice"
        self.parameters = CLONE_VOICE_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)
        

    def _download_audio_file(self, audio_url: str) -> str | None:
        os.makedirs(DOWNLOADS_PATH, exist_ok=True)
        try:
            self.output_message.actions.append("Downloading sample audio URL")
            self.output_message.push_update()
            response = requests.get(audio_url, stream=True)
            response.raise_for_status()

            if not response.headers.get('Content-Type', '').startswith('audio'):
                raise ValueError(f"The URL does not point to an MP3 file: {audio_url}")

            download_file_name = f"audio_clone_voice_download_{str(uuid.uuid4())}.mp3"
            local_path = os.path.join(DOWNLOADS_PATH, download_file_name)

            with open(local_path, 'wb') as file:
                for chunk in response.iter_content(chunk_size=8192):
                    file.write(chunk)

            return local_path
        except Exception as e:
            logger.error(f"Failed to download {audio_url}: {e}")
            return None
        
    def _download_video_file(self, video_url: str) -> str | None:
        os.makedirs(DOWNLOADS_PATH, exist_ok=True)

        try:
            response = requests.get(video_url, stream=True)
            response.raise_for_status()

            if not response.headers.get('Content-Type', '').startswith('video'):
                raise ValueError(f"The URL does not point to a video file: {video_url}")

            download_file_name = f"video_download_{str(uuid.uuid4())}.mp4"
            local_path = os.path.join(DOWNLOADS_PATH, download_file_name)

            with open(local_path, 'wb') as file:
                for chunk in response.iter_content(chunk_size=65536):
                    file.write(chunk)

            return local_path

        except Exception as e:
            print(f"Failed to download {video_url}: {e}")
            return None
        
    def _download_audio_from_video(self, audio_source: dict) -> str | None:
        required_keys = {"video_id", "collection_id", "start_time", "end_time"}
        if not isinstance(audio_source, dict) or not required_keys.issubset(audio_source.keys()):
            return None
        video_id = audio_source["video_id"]
        collection_id = audio_source["collection_id"]
        start_time = audio_source.get("start_time", 0)
        end_time =  audio_source.get("end_time", 90)
        try:
            videodb_tool = VideoDBTool(collection_id)
            self.output_message.actions.append("Generating the video stream for the sample")
            self.output_message.push_update()
            video_stream = videodb_tool.generate_video_stream(video_id, [(start_time, end_time)])
            download_response = videodb_tool.download(video_stream)
            download_url = download_response["download_url"]
            video_path = self._download_video_file(download_url)
            if not video_path:
                return None
            self.output_message.actions.append("Extracting the audio from the sample video")
            self.output_message.push_update()
            uploaded_audio = videodb_tool.upload(source=video_path, source_type="file_path", media_type="audio")
            audio = videodb_tool.get_audio(uploaded_audio["id"])
            audio_url = audio["url"]

            response = requests.get(audio_url, stream=True)
            response.raise_for_status()

            download_file_name = f"audio_clone_voice_download_{str(uuid.uuid4())}.mp3"
            local_path = os.path.join(DOWNLOADS_PATH, download_file_name)

            with open(local_path, 'wb') as file:
                for chunk in response.iter_content(chunk_size=8192):
                    file.write(chunk)

            return local_path
        except Exception as e:
            logger.error(f"Failed to download audio from video: {e}")
            return None

    def validate_audio_source(self, audio_source: dict):
        """Ensure that either 'audio_url' or 'video_id' is provided, but not both."""
        has_audio_url = "audio_url" in audio_source and bool(audio_source["audio_url"])
        has_video_id = "video_id" in audio_source and bool(audio_source["video_id"])

        if has_audio_url and has_video_id:
            raise ValueError("Provide either 'audio_url' or 'video_id', but not both.")

        if not has_audio_url and not has_video_id:
            raise ValueError("Either 'audio_url' or 'video_id' must be provided.")

        if has_video_id:
            audio_source.setdefault("start_time", 0)
            audio_source.setdefault("end_time", 90)
            if "collection_id" not in audio_source:
                raise ValueError("'collection_id' is required when using 'video_id'.")

        return audio_source

    def run(
            self,
            audio_source: dict,
            text_to_synthesis: str,
            name_of_voice: str,
            is_authorized_to_clone_voice: bool,
            collection_id: str = "default",
            description="",
            cloned_voice_id=None,
            *args, 
            **kwargs) -> AgentResponse:
        """
        Clone the given audio file and synthesis the given text

        :param list sample_audios: The urls of the video given to clone
        :param str text_to_synthesis: The given text which needs to be synthesised in the cloned voice
        :param bool is_authorized_to_clone_voice: The flag which tells whether the user is authorised to clone the audio or not
        :param str name_of_voice: The name to be given to the cloned voice
        :param str descrption: The description about how the voice sounds like
        :param str collection_id: The collection id to store generated voice
        :param str cloned_voice_id: The voice ID generated from the previously given voice which can be used for cloning
        :param args: Additional positional arguments.
        :param kwargs: Additional keyword arguments.
        :return: The response containing information about voice cloning.
        :rtype: AgentResponse
        """
        try:
            if not is_authorized_to_clone_voice:
                return AgentResponse(status=AgentStatus.ERROR, message="Not authorised to clone the voice")
            
            audio_source = self.validate_audio_source(audio_source)

            ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
            if not ELEVENLABS_API_KEY:
                    raise Exception("Elevenlabs API key not present in .env")
            
            
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #123** (2025-02-27): **Unbale to merge clips from two search results**
  *Symptoms*: ### Confirm this is a new bug report  - [X] I've checked the current issues, and there's no record of this bug  ### Current Behavior  The search agent does not return the timestamps and video IDs of the search results. As a result, queries like `merge the above two search clips` fail to execute because the editing agent lacks the necessary context to perform the merge operation.  ### Expected Behavior  The search agent should expose timestamps and video IDs in the search results. This would enable the other agents to utilize the context of search results.   ### Steps to Reproduce  1. Search 'xyz' 2. Search 'abc' 3. Merge above clips  ### Relevant Logs and/or Screenshots  -   ### Environment  - OS: NA - Python: NA - VideoDB: NA   ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Closed with the pr https://github.com/video-db/Director/pull/126

- **Issue #73** (2024-11-25): **Download Agent: Download links not being returned in Final cut sometimes.**
  *Symptoms*: ### Confirm this is a new bug report  - [x] I've checked the current issues, and there's no record of this bug  ### Current Behavior  In some cases reasoning engine is not following `Download successful but not dispalyed, send it in the summary.` And, in case where summary is failed the download link is lost.  Solution: Emit TextComponent from the Download agent with link.  ### Expected Behavior  Download link should always be sent to user.  ### Steps to Reproduce  Not deterministic.  ### Relevant Logs and/or Screenshots  -  ### Environment  - OS: Linux - Python: 3.12 - VideoDB: 0.2.6   ### Additional Context  _No response_

- **Issue #64** (2025-03-12): **Subtitle Agent adds an error message in chat if video is not indexed**
  *Symptoms*: ### Confirm this is a new bug report  - [X] I've checked the current issues, and there's no record of this bug  ### Current Behavior  If a video is not indexed and subtitle agent is ran against that video, it add a error message in chat. Even though it tries to fix and runs index agent and then re-runs subtitle agent.  One possible side effect of this error is that it make Final Cut's status as errored even though reasoning engine was able to index and re-run subtitle agent   Director's log <img width="791" alt="image" src="https://github.com/user-attachments/assets/3814335b-bd06-426d-b0f8-e10cf7ccdff2">  Error message due to video not indexed. <img width="783" alt="image" src="https://github.com/user-attachments/assets/112b87a0-ddd1-452c-8b54-f7f6c7208e32">  Side Effect of this, even though end result was available and was correct <img width="1111" alt="image" src="https://github.com/user-attachments/assets/ba438ca9-eaf7-4785-990f-d5bd2eaa3404">    ### Expected Behavior  It should not have error messages in the Chat.  ### Steps to Reproduce  Try this query  `dub {XYZ_VIDEO} to hindi and add french subtitles on dubbed video`   ### Relevant Logs and/or Screenshots  _No response_  ### Environment  - OS:  - Python:  - VideoDB:    ### Additional Context  _No response_

- **Issue #62** (2024-11-28): **Add link to `Create custom agents` on home page.**
  *Symptoms*: ### Confirm this is a new bug report  - [x] I've checked the current issues, and there's no record of this bug  ### Current Behavior  No link.  ### Expected Behavior  Redirect to https://github.com/video-db/Director?tab=readme-ov-file#-creating-a-new-agent  ### Steps to Reproduce  NA  ### Relevant Logs and/or Screenshots  NA  ### Environment  NA  ### Additional Context  NA
  **Post-Mortem & Fix Analysis**:
  > Not needed.

- **Issue #42** (2025-03-12): **Skip LLM Translation if the requested subtitles language is indexed spoken language**
  *Symptoms*: ### Confirm this is a new bug report  - [X] I've checked the current issues, and there's no record of this bug  ### Current Behavior  If a video's spoken index in english language then also it passes the language to OpenAI for translation  ### Expected Behavior  In a scenerio when the target subtitle language is already available in spoken index, then `Video.add_subtitles()`  can be used instead of this workflow - Fetch Transcript - Translate into target language  - Use `TextAssets`    ### Steps to Reproduce  - First run a Spoken index on a video which has english audio - Ask Subtitle agent to add english subtitles  ### Relevant Logs and/or Screenshots  _No response_  ### Environment  _No response_  ### Additional Context  _No response_

- **Issue #30** (2024-12-07): **Removing agent doesn't remove it from context**
  *Symptoms*: ![Screenshot 2024-10-29 at 12 08 15 PM](https://github.com/user-attachments/assets/4bf4d8d0-9258-4dd8-b5d7-6ee8e422a6b8)  
  **Post-Mortem & Fix Analysis**:
  > Irrelevant with new UI changes.

- **Issue #27** (2024-10-29): **Reasoning engine error state is missing**
  *Symptoms*: When OPENAI or any other LLM's quota is breached, reasoning engine doesn't show the error message.  ![Screenshot 2024-10-29 at 12 03 47 PM](https://github.com/user-attachments/assets/18d139bf-37f8-4ef7-8cf4-0f46ddd1d9df) ``` {'error': {'message': 'You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.', 'type': 'insufficient_quota', 'param': None, 'code': 'insufficient_quota'}}" ```

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

### Incident Patch 1: `e323157e` (2025-07-25)
**Commit Message**: Merge pull request #179 from omgate234/fix/sorting-messages

feat: sorting messages by `created_at`

**File**: `backend/director/db/postgres/db.py` (modified, +2/-1)
```diff
@@ -131,7 +131,8 @@ def add_or_update_msg_to_conv(
 
     def get_conversations(self, session_id: str) -> list:
         self.cursor.execute(
-            "SELECT * FROM conversations WHERE session_id = %s", (session_id,)
+            "SELECT * FROM conversations WHERE session_id = %s ORDER BY created_at ASC",
+            (session_id,),
         )
         rows = self.cursor.fetchall()
         conversations = []
```

**File**: `backend/director/db/sqlite/db.py` (modified, +2/-1)
```diff
@@ -153,7 +153,8 @@ def add_or_update_msg_to_conv(
 
     def get_conversations(self, session_id: str) -> list:
         self.cursor.execute(
-            "SELECT * FROM conversations WHERE session_id = ?", (session_id,)
+            "SELECT * FROM conversations WHERE session_id = ? ORDER BY created_at ASC",
+            (session_id,),
         )
         rows = self.cursor.fetchall()
         conversations = []
```

---

### Incident Patch 2: `9483e862` (2025-06-20)
**Commit Message**: Merge pull request #178 from omgate234/fix/collection-route

fix: removed redundant arg

**File**: `backend/director/handler.py` (modified, +3/-3)
```diff
@@ -70,7 +70,7 @@ def __init__(self, db, **kwargs):
             CodeAssistantAgent,
             WebSearchAgent,
             VoiceReplacementAgent,
-            PricingAgent
+            PricingAgent,
         ]
 
     def add_videodb_state(self, session):
@@ -148,7 +148,7 @@ def __init__(self, collection_id="default"):
     def upload(self, source, source_type="url", media_type="video", name=None):
         return self.videodb_tool.upload(source, source_type, media_type, name)
 
-    def get_collection(self, collection_id):
+    def get_collection(self):
         """Get a collection by ID."""
         return self.videodb_tool.get_collection()
 
@@ -213,7 +213,7 @@ def check(self):
         """Check the configuration of the server."""
         videodb_configured = True if os.getenv("VIDEO_DB_API_KEY") else False
 
-        db = load_db(os.getenv("SERVER_DB_TYPE",  os.getenv("DB_TYPE", "sqlite")))
+        db = load_db(os.getenv("SERVER_DB_TYPE", os.getenv("DB_TYPE", "sqlite")))
         db_configured = db.health_check()
         return {
             "videodb_configured": videodb_configured,
```

---

### Incident Patch 3: `640e06ac` (2025-06-20)
**Commit Message**: fix: removed redundant arg

**File**: `backend/director/handler.py` (modified, +3/-3)
```diff
@@ -70,7 +70,7 @@ def __init__(self, db, **kwargs):
             CodeAssistantAgent,
             WebSearchAgent,
             VoiceReplacementAgent,
-            PricingAgent
+            PricingAgent,
         ]
 
     def add_videodb_state(self, session):
@@ -148,7 +148,7 @@ def __init__(self, collection_id="default"):
     def upload(self, source, source_type="url", media_type="video", name=None):
         return self.videodb_tool.upload(source, source_type, media_type, name)
 
-    def get_collection(self, collection_id):
+    def get_collection(self):
         """Get a collection by ID."""
         return self.videodb_tool.get_collection()
 
@@ -213,7 +213,7 @@ def check(self):
         """Check the configuration of the server."""
         videodb_configured = True if os.getenv("VIDEO_DB_API_KEY") else False
 
-        db = load_db(os.getenv("SERVER_DB_TYPE",  os.getenv("DB_TYPE", "sqlite")))
+        db = load_db(os.getenv("SERVER_DB_TYPE", os.getenv("DB_TYPE", "sqlite")))
         db_configured = db.health_check()
         return {
             "videodb_configured": videodb_configured,
```

---

### Incident Patch 4: `014bded4` (2025-05-30)
**Commit Message**: Merge pull request #175 from video-db/ankit/fix-vite

Ankit/fix vite

**File**: `docs/get_started/railway.md` (modified, +0/-1)
```diff
@@ -60,7 +60,6 @@
 * After deployment, go to the [Railway project dashboard](https://railway.app/dashboard), and under the backend service, update the environment variables:
     ``` 
     VIDEO_DB_API_KEY="your_video_db_api_key"
-    OPENAI_API_KEY="your_openai_api_key"
     ```
 
 * Go to Settings → Networking → Public Networking, generate a domain, and copy the domain. You will need to use this domain in the frontend service configuration.
```

**File**: `docs/get_started/render.md` (modified, +0/-1)
```diff
@@ -11,7 +11,6 @@
 After deployment, update the backend environment variables:
     ``` 
     VIDEO_DB_API_KEY="your_video_db_api_key"
-    OPENAI_API_KEY="your_openai_api_key"
     ```
 
 ### Frontend Configuration
```

**File**: `frontend/package.json` (modified, +1/-1)
```diff
@@ -26,6 +26,6 @@
     "autoprefixer": "^10.4.20",
     "postcss": "^8.4.41",
     "tailwindcss": "^3.4.10",
-    "vite": "^5.4.1"
+    "vite": "5.4.1"
   }
 }
```

---

### Incident Patch 5: `592687af` (2025-05-30)
**Commit Message**: Revert "fix: fn server"

This reverts commit 12eae65c5a0bcf56bbab5d8841bf66e559ce920e.

**File**: `frontend/Dockerfile` (modified, +1/-2)
```diff
@@ -5,7 +5,6 @@ WORKDIR /app
 COPY . /app/
 
 RUN npm install
-RUN npm run build
 
 EXPOSE 8080
-CMD ["npm", "run", "preview"]
\ No newline at end of file
+CMD ["npm", "run", "dev"]
\ No newline at end of file
```

---

### Incident Patch 6: `12eae65c` (2025-05-30)
**Commit Message**: fix: fn server

**File**: `frontend/Dockerfile` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@ WORKDIR /app
 COPY . /app/
 
 RUN npm install
+RUN npm run build
 
 EXPOSE 8080
-CMD ["npm", "run", "dev"]
\ No newline at end of file
+CMD ["npm", "run", "preview"]
\ No newline at end of file
```

---

### Incident Patch 7: `b0e64a4e` (2025-05-30)
**Commit Message**: fix: vite v

**File**: `frontend/package.json` (modified, +1/-1)
```diff
@@ -26,6 +26,6 @@
     "autoprefixer": "^10.4.20",
     "postcss": "^8.4.41",
     "tailwindcss": "^3.4.10",
-    "vite": "^5.4.1"
+    "vite": "5.4.1"
   }
 }
```

---

### Incident Patch 8: `64a3a371` (2025-05-19)
**Commit Message**: fix: config for gen ai agents

**File**: `backend/director/agents/audio_generation.py` (modified, +4/-4)
```diff
@@ -17,7 +17,7 @@
 
 logger = logging.getLogger(__name__)
 
-SUPPORTED_ENGINES = ["elevenlabs", "beatoven"]
+SUPPORTED_ENGINES = ["elevenlabs", "beatoven", "videodb"]
 
 AUDIO_GENERATION_AGENT_PARAMETERS = {
     "type": "object",
@@ -33,7 +33,7 @@
                 - elevenlabs: supports text_to_speech and sound_effect
                 - beatoven: supports create_music""",
             "default": "videodb",
-            "enum": ["elevenlabs", "beatoven", "videodb"],
+            "enum": SUPPORTED_ENGINES,
         },
         "job_type": {
             "type": "string",
@@ -189,8 +189,8 @@ def run(
                     config={},
                 )
             elif job_type == "text_to_speech":
-                if engine != "elevenlabs":
-                    raise Exception("Text to speech only supported with elevenlabs")
+                if engine != "elevenlabs" and engine != "videodb":
+                    raise Exception("Text to speech only supported with elevenlabs and videodb")
                 text = text_to_speech.get("text")
                 config = text_to_speech.get(config_key, {})
                 msg = f"Using <b>{engine}</b> to convert text"
```

**File**: `backend/director/agents/image_generation.py` (modified, +4/-24)
```diff
@@ -55,36 +55,16 @@
             "properties": {
                 "engine": {
                     "type": "string",
-                    "description": "The engine to use for image generation. Possible values: 'videodb' and 'flux'.",
+                    "description": "The engine to use for image generation. Possible values: 'videodb' and 'flux'. Must be present if job_type is 'text_to_image'.",
                     "default": "videodb",
                     "enum": ["videodb", "flux"],
                 },
             },
         },
     },
     "required": ["collection_id", "job_type", "prompt"],
-    "allOf": [
-        {
-            "if": {
-                "properties": {
-                    "job_type": {"const": "image_to_image"}
-                }
-            },
-            "then": {
-                "required": ["image_to_image"]
-            }
-        },
-        {
-            "if": {
-                "properties": {
-                    "job_type": {"const": "text_to_image"}
-                }
-            },
-            "then": {
-                "required": ["text_to_image"]
-            }
-        }
-    ]
+    "if": {"properties": {"job_type": {"const": "image_to_image"}}},
+    "then": {"required": ["image_to_image"]},
 }
 
 class ImageGenerationAgent(BaseAgent):
@@ -126,7 +106,7 @@ def run(
 
             output_image_url = ""
             if job_type == "text_to_image":
-                engine = text_to_image.get("engine", "videodb")
+                engine = text_to_image.get("engine", "videodb") if text_to_image else "videodb"
                 if engine == "flux":
                     flux_output = flux_dev(prompt)
                     if not flux_output:
```

**File**: `backend/director/agents/text_to_movie.py` (modified, +7/-0)
```diff
@@ -146,6 +146,12 @@ def __init__(self, session: Session, **kwargs):
                 preferred_style="photorealistic",
                 prompt_format="concise",
             ),
+            "videodb": EngineConfig(
+                name="kling",
+                max_duration=6,
+                preferred_style="cinematic",
+                prompt_format="detailed",
+            ),
         }
         super().__init__(session=session, **kwargs)
 
@@ -197,6 +203,7 @@ def run(
                 self.video_gen_config_key = "video_kling_config"
 
             elif engine == "videodb":
+                self.video_gen_config_key = "video_kling_config"
                 self.video_gen_tool = VDBVideoGenerationTool()
             else:
                 raise Exception(f"{engine} not supported")
```

**File**: `backend/director/agents/web_search_agent.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@
     "properties": {
         "engine": {
             "type": "string",
-            "description": "Engine to use for the search. Currently supports 'videodb' and 'serp'.",
+            "description": "Engine to use for the search. Currently supports 'videodb' and 'serp'. Default is 'videodb'",
             "enum": SUPPORTED_ENGINES,
             "default": "videodb",
         },
```

---

### Incident Patch 9: `04465826` (2025-05-16)
**Commit Message**: Merge pull request #171 from omgate234/fix/editing-agent-text-asset

feat: fix editing agent text asset

**File**: `backend/director/agents/editing.py` (modified, +14/-5)
```diff
@@ -1,4 +1,5 @@
 import logging
+from videodb import TextStyle
 from director.agents.base import BaseAgent, AgentResponse, AgentStatus
 from director.llm.base import LLMResponse
 from director.core.session import (
@@ -88,7 +89,7 @@
                text : (string) the text to display
           - Optional:
                duration: (number) how long the text stays visible (seconds)
-               style: (object) e.g. { "font_size": 24, "text_color": "white", "alpha": 0.8, "x_coord": 100, "y_coord": 50 }
+               style: (object) e.g. { "fontsize": 18, "fontcolor": "white", "alpha": 0.7, "boxcolor": "black", "x": 50, "y": 50 } // "x" and "y" are the position of the text on the screen
         - These parameter as Asset's configuration 
 
 3. Final Editing 
@@ -275,13 +276,21 @@ def do_editing(self, inline_assets, overlay_assets):
                 overlay_at = overlay_asset.get("overlay_at", 0)
                 timeline.add_overlay(overlay_at, audio_asset)
             if overlay_asset.get("asset_type") == "image_asset":
-                audio_asset = ImageAsset(**overlay_asset.get("asset_config", {}))
+                image_asset = ImageAsset(**overlay_asset.get("asset_config", {}))
                 overlay_at = overlay_asset.get("overlay_at", 0)
-                timeline.add_overlay(overlay_at, audio_asset)
+                timeline.add_overlay(overlay_at, image_asset)
             if overlay_asset.get("asset_type") == "text_asset":
-                audio_asset = TextAsset(**overlay_asset.get("asset_config", {}))
+                asset_config = overlay_asset.get("asset_config", {}).copy()
+                if asset_config.get("style"):
+                    style_dict = asset_config.get("style", {}).copy() 
+                    style = TextStyle(**style_dict)
+                    asset_config["style"] = style
+
+                if not asset_config.get("duration"):
+                    asset_config["duration"] = 5
+                text_asset = TextAsset(**asset_config)
                 overlay_at = overlay_asset.get("overlay_at", 0)
-                timeline.add_overlay(overlay_at, audio_asset)
+                timeline.add_overlay(overlay_at, text_asset)
         stream_url = timeline.generate_stream()
         data = {
             "inline_assets": inline_assets,
```

---

### Incident Patch 10: `9ad7b298` (2025-05-14)
**Commit Message**: Merge pull request #172 from omgate234/fix/incompatible-dependencies

deps: upgrade `openai-function-calling` version

**File**: `backend/requirements.txt` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ Flask-Cors==4.0.1
 openai==1.55.3
 PyJWT==2.10.0
 Pillow==11.0.0
-openai-function-calling==2.4.0
+openai-function-calling==2.6.0
 pydantic==2.8.2
 pydantic-settings==2.4.0
 python-dotenv==1.0.1
```

---

### Incident Patch 11: `5911eddd` (2025-05-14)
**Commit Message**: feat: fix editing agent text asset

**File**: `backend/director/agents/editing.py` (modified, +13/-5)
```diff
@@ -1,4 +1,6 @@
+import json
 import logging
+from videodb import TextStyle
 from director.agents.base import BaseAgent, AgentResponse, AgentStatus
 from director.llm.base import LLMResponse
 from director.core.session import (
@@ -88,7 +90,7 @@
                text : (string) the text to display
           - Optional:
                duration: (number) how long the text stays visible (seconds)
-               style: (object) e.g. { "font_size": 24, "text_color": "white", "alpha": 0.8, "x_coord": 100, "y_coord": 50 }
+               style: (object) e.g. { "fontsize": 24, "fontcolor": "white", "alpha": 0.8, "x": 100, "y": 50 } // "x" and "y" are the position of the text on the screen
         - These parameter as Asset's configuration 
 
 3. Final Editing 
@@ -275,13 +277,19 @@ def do_editing(self, inline_assets, overlay_assets):
                 overlay_at = overlay_asset.get("overlay_at", 0)
                 timeline.add_overlay(overlay_at, audio_asset)
             if overlay_asset.get("asset_type") == "image_asset":
-                audio_asset = ImageAsset(**overlay_asset.get("asset_config", {}))
+                image_asset = ImageAsset(**overlay_asset.get("asset_config", {}))
                 overlay_at = overlay_asset.get("overlay_at", 0)
-                timeline.add_overlay(overlay_at, audio_asset)
+                timeline.add_overlay(overlay_at, image_asset)
             if overlay_asset.get("asset_type") == "text_asset":
-                audio_asset = TextAsset(**overlay_asset.get("asset_config", {}))
+                asset_config = overlay_asset.get("asset_config", {}).copy()
+                if asset_config.get("style"):
+                    style_dict = asset_config.get("style", {}).copy() 
+                    style = TextStyle(**style_dict)
+                    asset_config["style"] = style
+
+                text_asset = TextAsset(**asset_config)
                 overlay_at = overlay_asset.get("overlay_at", 0)
-                timeline.add_overlay(overlay_at, audio_asset)
+                timeline.add_overlay(overlay_at, text_asset)
         stream_url = timeline.generate_stream()
         data = {
             "inline_assets": inline_assets,
```

---

### Incident Patch 12: `6fbe3b74` (2025-05-13)
**Commit Message**: fix: show media type in agent response

Signed-off-by: Emmanuel Ferdman <[REDACTED_EMAIL]>

**File**: `backend/director/agents/upload.py` (modified, +1/-1)
```diff
@@ -143,7 +143,7 @@ def _upload_yt_playlist(self, playlist_info: dict, media_type):
                 logger.exception(f"Error in uploading {media['title']}: {e}")
         return AgentResponse(
             status=AgentStatus.SUCCESS,
-            message="All the videos in the playlist uploaded successfully as {media_type}",
+            message=f"All the videos in the playlist uploaded successfully as {media_type}",
         )
 
     def run(
```

---

### Incident Patch 13: `537dbfc5` (2025-04-09)
**Commit Message**: Merge pull request #167 from video-db/fix-editing-agent-default-llm

fix editing agent to use default llm

**File**: `backend/director/agents/editing.py` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@
     RoleTypes,
 )
 from director.tools.videodb_tool import VideoDBTool
-from director.llm.videodb_proxy import VideoDBProxy
+from director.llm import get_default_llm
 
 from videodb.asset import VideoAsset, AudioAsset, ImageAsset, TextAsset
 
@@ -151,7 +151,7 @@ def __init__(self, session: Session, **kwargs):
         self.editing_response = None
 
         # TODO: benchmark different llm
-        self.llm = VideoDBProxy()
+        self.llm = get_default_llm()
 
         # TODO: find a way to get the tool description from function/tool and not hardcode here
         self.tools = [
```

---

### Incident Patch 14: `114996ba` (2025-04-09)
**Commit Message**: fix editing agent to use default llm

**File**: `backend/director/agents/editing.py` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@
     RoleTypes,
 )
 from director.tools.videodb_tool import VideoDBTool
-from director.llm.videodb_proxy import VideoDBProxy
+from director.llm import get_default_llm
 
 from videodb.asset import VideoAsset, AudioAsset, ImageAsset, TextAsset
 
@@ -151,7 +151,7 @@ def __init__(self, session: Session, **kwargs):
         self.editing_response = None
 
         # TODO: benchmark different llm
-        self.llm = VideoDBProxy()
+        self.llm = get_default_llm()
 
         # TODO: find a way to get the tool description from function/tool and not hardcode here
         self.tools = [
```

---

### Incident Patch 15: `e2efdf31` (2025-03-19)
**Commit Message**: fix: frame typo

Signed-off-by: royalpinto007 <[REDACTED_EMAIL]>

**File**: `backend/director/agents/frame.py` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ def run(
             )
             image_content.image = ImageData(**frame_data)
             image_content.status = MsgStatus.success
-            image_content.status_message = "Here is your frane."
+            image_content.status_message = "Here is your frame."
             self.output_message.publish()
 
         except Exception as e:
```

#### Recent Merged Pull Requests:
- **PR #192** (closed): feat: add stop generation feature (@skalkii)
- **PR #191** (closed): feat: sliding window context management for long sessions (closes #116) (@skalkii)
- **PR #189** (closed): feat: Add SceneIndexAgent to display indexed scene descriptions (@skalkii)
- **PR #188** (closed): feat: OpenRouter LLM, null-safe payloads, videodb UI warnings (@dallascrilley)
- **PR #185** (2026-01-23): feat: editing and subtitle agents using `videodb.editor` (@omgate234)
- **PR #179** (2025-07-25): feat: sorting messages by `created_at` (@omgate234)
- **PR #178** (2025-06-20): fix: removed redundant arg (@omgate234)
- **PR #177** (2025-06-10): feat: remove model name support (@omgate234)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
