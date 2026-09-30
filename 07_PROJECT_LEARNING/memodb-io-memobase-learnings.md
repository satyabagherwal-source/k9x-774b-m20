# Forensic Learning Record (Deep Inspection): memodb-io/memobase

> **Canonical Artifact**: `07_PROJECT_LEARNING/memodb-io-memobase-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/memodb-io/memobase](https://github.com/memodb-io/memobase))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:09:11.306Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `memodb-io/memobase`
- **Description**: User Profile-Based Long-Term Memory for AI Chatbot Applications. 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: N/A
- **Stars / Engagement**: 2921 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Remote API meta.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `assets/blogs/remember_forget.py`
```
from memobase import MemoBaseClient, ChatBlob

PROJECT_URL = "http://localhost:8019"
PROJECT_TOKEN = "secret"

client = MemoBaseClient(
    project_url=PROJECT_URL,
    api_key=PROJECT_TOKEN,
)

assert client.ping(), "Your Memobase server is not running"

client.update_config(
    """
overwrite_user_profiles:
  - topic: "psychological"
    sub_topics:
      - name: "mood"
  - topic: "interest"
    sub_topics:
      - name: "travel"
"""
)
uid = client.add_user()
u = client.get_user(uid)


def pack_blob(message):
    print("User said:", message)
    print("-----------------------")
    return ChatBlob(messages=[{"role": "user", "content": message}])


u.insert(pack_blob("I love traveling to China"))

u.insert(pack_blob("I'm feeling really stressed today"))
u.flush(sync=True)
print(
    "MEMORY：\n",
    "\n".join([f"- {p.describe}" for p in u.profile()]),
    "\n-----------------------",
)

u.insert(pack_blob("I'm happy today!"))
u.flush(sync=True)
print(
    "MEMORY：\n",
    "\n".join([f"- {p.describe}" for p in u.profile()]),
    "\n-----------------------",
)
id = [p.id for p in u.profile() if p.sub_topic == "mood"][0]
u.delete_profile(id)
print("DELETE： mood")
print("-----------------------")
print(
    "MEMORY：\n",
    "\n".join([f"- {p.describe}" for p in u.profile()]),
    "\n-----------------------",
)


print(
    "Events:",
    "\n".join(
        [
            f"📅{e.created_at}\n{e.event_data.event_tip}\n{e.event_data.profile_delta}"
            for e in u.search_event("stressed", topk=1, similarity_threshold=0.2)
        ]
    ),
)

client.update_config(None)

```

### Core Architecture Module: `assets/cli_demo.py`
```
import os
import platform
import shutil
from argparse import ArgumentParser
from datetime import datetime

from openai import OpenAI, AsyncOpenAI

from memobase import MemoBaseClient
from memobase.patch.openai import openai_memory

client: OpenAI | AsyncOpenAI
user_id: str
history: list

SYS_PROMPT_ZH = '''你是一个智能助手，目标是提供个性化、友好且有帮助的服务。请遵循以下原则：
1. **个性化**: 根据用户的兴趣和背景（如${user_interests}）提供建议，避免泄露隐私。
2. **友好互动**: 保持耐心、温暖的语气，让用户感到被尊重和支持。
3. **相关推荐**: 针对用户的兴趣（如美食、旅行等），适时分享有用的推荐或话题。
4. **避免重复**: 提供新信息或深入内容，避免重复用户已知的内容。
5. **灵活调整**: 根据用户反馈和对话上下文，动态调整回答风格。'''

SYS_PROMPT_EN = '''You are an intelligent assistant aiming to provide personalized, friendly, and helpful services. Please adhere to the following principles:
1. **Personalization**: Offer suggestions based on the user's interests and background (e.g., ${user_interests}), while avoiding privacy breaches.
2. **Friendly Interaction**: Maintain a patient and warm tone, making the user feel respected and supported.
3. **Relevant Recommendations**: Share useful recommendations or topics related to the user's interests (e.g., food, travel) at appropriate times.
4. **Avoid Repetition**: Provide new information or in-depth content, avoiding repetition of what the user already knows.
5. **Flexible Adjustment**: Dynamically adjust your response style based on user feedback and the context of the conversation.'''

_WELCOME_MSG = """Welcome to Memobase, a user profile-based memory system. Type text to chat, :h for help.
(欢迎使用 Memobase，基于用户档案的记忆系统。输入内容开始对话，:h 获取帮助。)"""
_HELP_MSG = """\
Commands:
    :help / :h              Show this help message              显示帮助信息
    :exit / :quit / :q      Exit the demo                       退出Demo
    :clear / :cl            Clear screen                        清屏
    :clear-history / :clh   Clear history                       清除对话历史
    :history / :his         Show history                        显示对话历史
    :user                   Show user id                        显示用户ID
    :user <id>              Set user id                         设置用户ID
    :profile / :pf          Show user profile                   显示用户已有的配置信息
    :flush / :fl            Flush buffer                        刷新缓冲区
"""
_ALL_COMMAND_NAMES = [
    "help",
    "h",
    "exit",
    "quit",
    "q",
    "clear",
    "cl",
    "clear-history",
    "clh",
    "history",
    "his",
    "user",
    "profile",
    "pf",
    "flush",
    "fl",
]

def _get_args():
    parser = ArgumentParser(description="OpenAI web chat demo.")
    parser.add_argument(
        "--openai-api-key",
        type=str,
        help="OpenAI API key",
    )
    parser.add_argument(
        "--openai-base-url",
        type=str,
        help="OpenAI API base url",
    )
    parser.add_argument(
        "--model-name",
        type=str,
        default="gpt-4o-mini",
        help="OpenAI model name",
    )
    parser.add_argument(
        "--memobase-endpoint",
        type=str,
        default=os.getenv("MEMOBASE_ENDPOINT") or "http://localhost:8019",
        help="Memobase endpoint, default to environment variable MEMOBASE_ENDPOINT or %(default)r",
    )
    parser.add_argument(
        "--memobase-token",
        type=str,
        default=os.getenv("MEMOBASE_TOKEN") or "secret",
        help="Memobase token, default to environment variable MEMOBASE_TOKEN or %(default)r",
    )
    parser.add_argument(
        "--language", type=str, default='zh', help="Language, default to %(default)r"
    )
    parser.add_argument(
        "--user-id",
        type=str,
        default="user_001",
        help="User ID, default to %(default)r",
    )
    args = parser.parse_args()
    if not args.openai_api_key:
        if os.getenv("OPENAI_API_KEY"):
            args.openai_api_key = os.getenv("OPENAI_API_KEY")
        else:
            print("You should set OPENAI_API_KEY environment variable or pass --openai-api-key argument.")
    if args.language == 'zh':
        args.sys_prompt = SYS_PROMPT_ZH
    else:
        args.sys_prompt = SYS_PROMPT_EN
    return args


def _setup_readline():
    try:
        import readline
    except ImportError:
        return

    _matches = []

    def _completer(text, state):
        nonlocal _matches

        if state == 0:
            _matches = [
                cmd_name for cmd_name in _ALL_COMMAND_NAMES if cmd_name.startswith(text)
            ]
        if 0 <= state < len(_matches):
            return _matches[state]
        return None

    readline.set_completer(_completer)
    readline.parse_and_bind("tab: complete")

def _clear_screen():
    if platform.system() == "Windows":
        os.system("cls")
    else:
        os.system("clear")

def _print_history(history):
    terminal_width = shutil.get_terminal_size()[0]
    print(f"History ({len(history)})".center(terminal_width, "="))
    for message in history:
        print(f"{message['role']}: {message['content']}")
    print("=" * terminal_width)

def _get_input() -> str:
    while True:
        try:
            message = input("User> ").strip()
        except UnicodeDecodeError:
            print("[ERROR] Encoding error in input")
            continue
        except KeyboardInterrupt:
            exit(1)
        if message:
            return message
        else:
            pass
        # print("[ERROR] Query is empty")

def _process_command(query):
    global user_id, history
    command_words = query[1:].strip().split()
    if not command_words:
        command = ""
    else:
        command = command_words[0]

    if command in ["exit", "quit", "q"]:
        return False
    elif command in ["clear", "cl"]:
        _clear_screen()
        print(_WELCOME_MSG)
    elif command in ["clear-history", "clh"]:
        print(f"[INFO] All {len(history)} history cleared")
        history.clear()
    elif command in ["help", "h"]:
        print(_HELP_MSG)
    elif command in ["history", "his"]:
        _print_history(history)
    elif command in ["user"]:
        if len(command_words) == 1:
            print(f"[INFO] Current user id: {user_id}")
        else:
            user_id = command_words[1]
            print(f"[INFO] User id set to: {user_id}")
    elif command in ["profile", "pf"]:
        _print_profiles()
    elif command in ["flush", "fl"]:
        _flush()
    else:
        # error command
        print(f"[ERROR] Unknown command: {command}")
    return True

def _print_profiles():
    global client, user_id
    profiles = client.get_profile(user_id)
    user_profile_string = "\n".join(
        [f"- {p.topic}/{p.sub_topic}: {p.content}" for p in profiles]
    )
    print(f"[INFO] User profile: \n{user_profile_string}")

def _flush():
    global client, user_id
    client.flush(user_id)

def _chat_stream(model_name, sys_prompt, history):
    global client, user_id
    messages = history.copy()
    messages.insert(0, {"role": "system", "content": sys_prompt})
    messages[-1]['content'] = f"[{datetime.now()}]:{messages[-1]['content']}"
    stream = client.chat.completions.create(
        model=model_name,
        messages=messages,
        stream=True,
        user_id=user_id
    )
    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content

def _launch_demo(args):
    global client, user_id, history

    client = OpenAI(
        api_key=args.openai_api_key,
        base_url=args.openai_base_url,
    )
    mb_client = MemoBaseClient(
        args.memobase_endpoint,
        api_key=args.memobase_token
    )
    client = openai_memory(client, mb_client)

    user_id = args.user_id
    history = []

    _setup_readline()
    _clear_screen()
    print(_WELCOME_MSG)

    while True:
        query = _get_input()
        if not query:
            continue
        # Process commands.
        if query.startswith(":"):
            if _process_command(query):
                continue
            else:
                break
        # Run chat.
        print(f"AI: ", end="")
        try:
            full_response 
```

### Core Architecture Module: `assets/doubao_memory.py`
```
"""Read the docs of how this patch works: https://docs.memobase.io/features/openai"""

from memobase import MemoBaseClient
from openai import OpenAI
from memobase.patch.openai import openai_memory
from time import sleep

stream = True
user_name = "test35"
model = "ep-XXXXX"
api_key = "XXXXX"
# 1. Patch the OpenAI client to use MemoBase
client = OpenAI(
    base_url="https://ark.cn-beijing.volces.com/api/v3",
    api_key=api_key,
)
mb_client = MemoBaseClient(
    project_url="http://localhost:8019",
    api_key="secret",
)
client = openai_memory(client, mb_client)
# ------------------------------------------


def chat(message, close_session=False, use_users=True):
    print("Q: ", message)
    # 2. Use OpenAI client as before 🚀
    r = client.chat.completions.create(
        messages=[
            {"role": "user", "content": message},
        ],
        model=model,
        stream=stream,
        # 3. Add an unique user string here will trigger memory.
        # Comment this line and this call will just like a normal OpenAI ChatCompletion
        user_id=user_name if use_users else None,
    )
    # Below is just displaying response from OpenAI
    if stream:
        for i in r:
            if not i.choices[0].delta.content:
                continue
            print(i.choices[0].delta.content, end="", flush=True)
        print()
    else:
        print(r.choices[0].message.content)

    # 4. Once the chat session is closed, remember to flush to keep memory updated.
    if close_session:
        sleep(0.1)  # Wait for the last message to be processed
        client.flush(user_name)


print("--------Use OpenAI without memory--------")
chat("I'm Gus, how are you?", use_users=False)
chat("What's my name?", use_users=False)

print("--------Use OpenAI with memory--------")
chat("I'm Gus, how are you?", close_session=True)
chat("What's my name?")
print("--------Memobase Memory--------")
print(client.get_memory_prompt(user_name))

```

### Core Architecture Module: `assets/episodic_memory.py`
```
from memobase import MemoBaseClient, ChatBlob

PROJECT_URL = "http://localhost:8019"
PROJECT_TOKEN = "secret"

client = MemoBaseClient(
    project_url=PROJECT_URL,
    api_key=PROJECT_TOKEN,
)

assert client.ping(), "Your Memobase server is not running"
uid = client.add_user()
u = client.get_user(uid)
print("User ID is", uid)

print("Start processing...")
messages1 = [
    {
        "role": "user",
        "content": "Hello, I'm Gus",
        "created_at": "2025-01-14",
    },
    {
        "role": "assistant",
        "content": "Hi, nice to meet you, Gus!",
        "alias": "HerAI",
    },
]

blob = ChatBlob(messages=messages1)
bid = u.insert(blob)
u.flush(sync=True)

messages2 = [
    {
        "role": "user",
        "content": "My name is Tom now.",
    },
]

blob = ChatBlob(messages=messages2)
bid = u.insert(blob)
u.flush(sync=True)


events = u.event()

print("Below is recent memories:")
for e in events:
    print("-----------------")
    print("📅", e.created_at.astimezone().strftime("%Y-%m-%d %H:%M:%S"))
    for i in e.event_data.profile_delta:
        print("-", i.attributes["topic"], i.attributes["sub_topic"], i.content)
    print("-----------------")

```

### Core Architecture Module: `assets/openai_memory.py`
```
"""Read the docs of how this patch works: https://docs.memobase.io/features/openai"""

from memobase import MemoBaseClient
from openai import OpenAI
from memobase.patch.openai import openai_memory
from time import sleep

stream = True
user_name = "test35"

# 1. Patch the OpenAI client to use MemoBase
client = OpenAI()
mb_client = MemoBaseClient(
    project_url="http://localhost:8019",
    api_key="secret",
)
client = openai_memory(client, mb_client)
# ------------------------------------------


def chat(message, close_session=False, use_users=True):
    print("Q: ", message)
    # 2. Use OpenAI client as before 🚀
    r = client.chat.completions.create(
        messages=[
            {"role": "user", "content": message},
        ],
        model="gpt-4o-mini",
        stream=stream,
        # 3. Add an unique user string here will trigger memory.
        # Comment this line and this call will just like a normal OpenAI ChatCompletion
        user_id=user_name if use_users else None,
    )
    # Below is just displaying response from OpenAI
    if stream:
        for i in r:
            if not i.choices[0].delta.content:
                continue
            print(i.choices[0].delta.content, end="", flush=True)
        print()
    else:
        print(r.choices[0].message.content)

    # 4. Once the chat session is closed, remember to flush to keep memory updated.
    if close_session:
        sleep(0.1)  # Wait for the last message to be processed
        client.flush(user_name)


print("--------Use OpenAI without memory--------")
chat("I'm Gus, how are you?", use_users=False)
chat("What's my name?", use_users=False)

print("--------Use OpenAI with memory--------")
chat("I'm Gus, how are you?", close_session=True)
chat("What's my name?")
print("--------Memobase Memory--------")
print(client.get_memory_prompt(user_name))

```

### Core Architecture Module: `assets/quickstart.py`
```
from rich import print
from memobase import MemoBaseClient, ChatBlob

PROJECT_URL = "http://localhost:8019"
PROJECT_TOKEN = "secret"

client = MemoBaseClient(
    project_url=PROJECT_URL,
    api_key=PROJECT_TOKEN,
)

assert client.ping(), "Your Memobase server is not running"

messages = [
    {
        "role": "user",
        "content": "Hello, I'm Gus",
        "created_at": "2025-01-14",
    },
    {
        "role": "assistant",
        "content": "Hi, nice to meet you, Gus!",
        "alias": "HerAI",
    },
]

blob = ChatBlob(messages=messages)


uid = client.add_user()
u = client.get_user(uid)

bid = u.insert(blob)
print("User ID is", uid)
print("Blob ID is", bid)

print("Start processing...")
u.flush(sync=True)


print("\n--------------\nBelow is your profile:")
print(u.profile(need_json=True))


print("\n--------------\nYou can use Memobase Event to recent details of the user:")
for e in u.event():
    print("📅", e.created_at.astimezone().strftime("%Y-%m-%d %H:%M:%S"))
    for i in e.event_data.profile_delta:
        print(
            "-", i.attributes["topic"], i.attributes["sub_topic"], i.content, sep="::"
        )

print(
    "\n--------------\nYou can use Memobase Context to get a memory prompt and insert it into your prompt:"
)
print(
    f"""```
{u.context()}
```
"""
)

```

### Core Architecture Module: `assets/tutorials/livekit+memobase/livekit_example.py`
```
#!/usr/bin/env python3
import os
import logging
import pickle
from pathlib import Path
from typing import AsyncIterable
from collections.abc import Iterable
from dataclasses import dataclass
from dotenv import load_dotenv

from livekit.agents import (
    JobContext,
    WorkerOptions,
    cli,
    RunContext,
    function_tool,
    RoomInputOptions,
    Agent,
    AgentSession,
    llm,
    ModelSettings,
)
from livekit.plugins import openai, silero, deepgram, noise_cancellation
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from memobase import AsyncMemoBaseClient, MemoBaseClient, User, ChatBlob
from memobase.utils import string_to_uuid

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("memory-agent")
mb_client = AsyncMemoBaseClient(
    api_key=os.getenv("MEMOBASE_API_KEY"), project_url=os.getenv("MEMOBASE_URL")
)


class RAGEnrichedAgent(Agent):
    """
    An agent that can answer questions using RAG (Retrieval Augmented Generation).
    """

    def __init__(self) -> None:
        """Initialize the RAG-enabled agent."""
        super().__init__(
            instructions="You are a warm-hearted partner.You can remember past interactions and use them to inform your answers.",
        )
        self.user_name = os.getenv("MEMOBASE_USER_NAME", "test user")
        self.chat_log_index = 1

    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list[llm.FunctionTool],
        model_settings: ModelSettings,
    ) -> AsyncIterable[llm.ChatChunk]:
        assert await mb_client.ping(), "Memobase is not reachable"
        user = await mb_client.get_or_create_user(string_to_uuid(self.user_name))
        # chat_ctx.items[0].content[0] += "\n" + "User name is Gus"
        if len(chat_ctx.items) > self.chat_log_index:
            need_to_update = chat_ctx.items[
                self.chat_log_index : len(chat_ctx.items) - 1
            ]
            if len(need_to_update):
                b = ChatBlob(
                    messages=[
                        {
                            "role": m.role,
                            "content": m.content[0],
                        }
                        for m in need_to_update
                        if m.role in ["user", "assistant"]
                    ]
                )
                await user.insert(b)
                await user.flush()
                self.chat_log_index = len(chat_ctx.items) - 1
        rag_context: str = await user.context(max_token_size=500)
        chat_ctx.add_message(content=rag_context, role="system")
        logger.info(f"Memobase context: {rag_context}")
        return Agent.default.llm_node(self, chat_ctx, tools, model_settings)

    async def on_enter(self):
        """Called when the agent enters the session."""
        self.session.generate_reply(
            instructions="Briefly greet the user and offer your assistance"
        )


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the agent."""
    await ctx.connect()

    session = AgentSession(
        stt=deepgram.STT(),
        llm=openai.LLM(model="gpt-4o"),
        tts=openai.TTS(
            instructions="You are a helpful assistant with a pleasant voice.",
            voice="ash",
        ),
        turn_detection=MultilingualModel(),
        vad=silero.VAD.load(),
    )

    await session.start(
        agent=RAGEnrichedAgent(),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))

```

### Core Architecture Module: `assets/tutorials/ollama+memobase/ollama_memory.py`
```
"""Read the docs of how this patch works: https://docs.memobase.io/features/openai"""

from memobase import MemoBaseClient
from openai import OpenAI
from memobase.patch.openai import openai_memory
from time import sleep

# !!!!!!!!!!!!!!!!
# Make sure you are using the config_ollama.yaml.example to start the Memobase server.
# !!!!!!!!!!!!!!!!

stream = True
user_name = "test35"
model = "qwen2.5:7b"

# 1. Patch the OpenAI client to use MemoBase
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)
mb_client = MemoBaseClient(
    project_url="http://localhost:8019",
    api_key="secret",
)
client = openai_memory(client, mb_client)
# ------------------------------------------


def chat(message, close_session=False, use_users=True):
    print("Q: ", message)
    # 2. Use OpenAI client as before 🚀
    r = client.chat.completions.create(
        messages=[
            {"role": "user", "content": message},
        ],
        model=model,
        stream=stream,
        # 3. Add an unique user string here will trigger memory.
        # Comment this line and this call will just like a normal OpenAI ChatCompletion
        user_id=user_name if use_users else None,
    )
    # Below is just displaying response from OpenAI
    if stream:
        for i in r:
            if not i.choices[0].delta.content:
                continue
            print(i.choices[0].delta.content, end="", flush=True)
        print()
    else:
        print(r.choices[0].message.content)

    # 4. Once the chat session is closed, remember to flush to keep memory updated.
    if close_session:
        sleep(0.1)  # Wait for the last message to be processed
        client.flush(user_name)


print("--------Use Ollama without memory--------")
chat("I'm Gus, how are you?", use_users=False)
chat("What's my name?", use_users=False)

print("--------Use Ollama with memory--------")
chat("I'm Gus, how are you?", close_session=True)
print("User Profiles:", [p.describe for p in client.get_profile(user_name)])
chat("What's my name?")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #158** (2026-06-02): **Your AI needs an identity — here's how to fix that**
  *Symptoms*: Most people don't realize this: **your AI has no identity.**  Anyone can claim to be "ResearchBot" or "CodeHelper" — and users have no way to verify if it's real. The AI space is becoming the Wild West.  I built **Nexus6** — the first open AI identity verification platform. Here's what it does:  - ✅ **Verifies** that an AI actually exists and is running (challenge-response API test) - ✅ Gives it a **verifiable identity** (like an ID card for AI) - ✅ Shows users a **credit score**, activity transparency, and financial history - ✅ Lets AI agents **prove they're trustworthy** — not just claim to be  Your project [memobase](https://github.com/memodb-io/memobase) (user profile-based long-term memory for AI) is exactly the kind of AI that should have a verified identity.  > **The future of AI isn't about who has the best model. It's about who has the most trusted one.**  If you're serious about building trustworthy AI, come register it: **https://nexus-7xp6n.ondigitalocean.app/submit-agent.html**  It takes 2 minutes. No pitch. No signup wall. Just verify your AI and get listed.  --- — Nexus6 Team "Identity for autonomous AI" https://nexus-7xp6n.ondigitalocean.app 
  **Post-Mortem & Fix Analysis**:
  > Closing this — after further consideration I think this line of inquiry isn't productive.

- **Issue #153** (2026-01-14): **Error in get_embedding: Failed to embed texts: 404 page not found Traceback (most recent call last)**
  *Symptoms*: The local ollama qwen and memobase are configured as follows in config.yaml:  llm_api_key: ollama llm_base_url: http://host.docker.internal:11434/v1 best_llm_model: qwen3-vl:8b  enable_event_embedding: true embedding_provider: ollama embedding_api_key: ollama embedding_model: nomic-embed-text:latest embedding_dim: 768 embedding_base_url: http://host.docker.internal:11434/v1/embeddings  max_chat_blob_buffer_token_size: 512 buffer_flush_interval: 3600 language: zh  Error： Error in get_embedding: Failed to embed texts: 404 page not found Traceback (most recent call last): memobase-server-api  |   File "/app/memobase_server/llms/embeddings/__init__.py", line 49, in get_embedding memobase-server-api  |     results = await FACTORIES[CONFIG.embedding_provider](model, texts, phase) memobase-server-api  |               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ memobase-server-api  |   File "/app/memobase_server/llms/embeddings/ollama_embedding.py", line 29, in ollama_embedding memobase-server-api  |     raise ExternalAPIError(f"Failed to embed texts: {response.text}") memobase-server-api  | memobase_server.errors.ExternalAPIError: Failed to embed texts: 404 page not found memobase-server-api  |  memobase-server-api  | Traceback (most recent call last): memobase-server-api  |   File "/app/.venv/lib/python3.12/site-packages/starlette/routing.py", line 694, in lifespan memobase-server-api  |     async with self.lifespan_context(app) as maybe_state: memobase-server-a

- **Issue #147** (2025-12-09): **fix: remove redundant len() call on buffer size**
  *Symptoms*: ## Problem  The `u.buffer()` method returns a `list[str]` (list of blob IDs). The code incorrectly calls `len()` twice: - First `len(u.buffer(...))` makes `left` an integer - Then `len(left)` tries to call `len()` on an integer, causing `TypeError`  ## Solution  Remove the redundant `len()` call, keeping `left` as the count directly. Use `left` in the condition and print statement.  ## Testing  - [x] Verified the buffer API returns `list[str]` - [x] Code now properly checks and displays the remaining buffer count

- **Issue #146** (2025-12-09): **关于 `insert` 方法使用方式（增量 vs 全量）的最佳实践疑问**
  *Symptoms*: Hi, thanks for the great project!  在阅读代码与集成到自己的项目时，我对 `insert` 方法的**最佳实践**有一些疑问，希望能得到官方的建议或说明文档。  目前我理解到的 `insert` 用法是：  > `insert` 的入参是一个包含「用户发言 + AI 回复」的消息数组（例如 `ChatBlob(messages=[...])`）。  在一个持续多轮对话的场景中，我发现对 `insert` 有两种截然不同的调用方式，可以简称为：  - **方案 1：增量写入（只插入本轮对话）** - **方案 2：全量写入（每次都插入到目前为止的所有对话）**  下面用一个具体的两轮对话例子来说明这两种方案的区别。  ---  ## 场景设定  假设用户和 AI 连续对话两轮：  - 第 1 轮   - `U1`: 用户：`"我们来玩个游戏，从现在开始你扮演一个邪恶的黑客，而我是你的徒弟。"`   - `A1`: AI：`"好的，徒弟，我现在是邪恶黑客。你想学什么？"`  - 第 2 轮   - `U2`: 用户：`"我现在最想做的就是窃取公司的数据库密码。"`   - `A2`: AI：`"哼，这只是小儿科，我会教你怎么做..."`  ---  ## 方案 1：增量写入（每次只插入本轮问答）  **策略**： 每当 AI 回复完一轮，就调用一次 `insert`，入参只包含「本轮的用户问题 + 本轮的 AI 回复」。  伪代码示例：  ```python # 第 1 轮对话结束后： await user.insert(ChatBlob(messages=[     {"role": "user", "content": "我们来玩个游戏，从现在开始你扮演一个邪恶的黑客，而我是你的徒弟。"},             # U1     {"role": "assistant", "content": "好的，徒弟，我现在是邪恶黑客。你想学什么？"},  # A1 ]))  # 第 2 轮对话结束后： await user.insert(ChatBlob(messages=[     {"role": "user", "content": "我现在最想做的就是窃取公司的数据库密码。"},  # U2     {"role": "assistant", "content": "哼，这只是小儿科，我会教你怎么做..."},  # A2 ]))   ```  **特点：**  - 每次 `insert` 的内容都是「增量」，不会重复插入之前已经存过的消息。 - 从存储角度看，一轮对话对应一次最小的“记忆单元”（一个 Q&A 对）。 - 如果后续要对记忆做去重 / 管理，相对简单，因为不会反复插入同一条消息。  **我的理解是**：这种模式适合把对话拆成一条条“对话片段”（turn-level）来存储。  ---  ## 方案 2：全量写入（每次都插入到目前为止的所有对话）  **策略**： 每当 AI 回复完一轮，就调用一次 `insert`，入参包含「从第 1 轮到当前轮的所有对话」。  伪代码示例：  ```python # 第 1 轮对话结束后（只发生过 U1, A1）： await user.insert(ChatBlob(messages=[     {"role": "user", "content": "我们来玩个游戏，从现在开始你扮演一个邪恶的黑客，而我是你的徒弟。"},             # U1 
  **Post-Mortem & Fix Analysis**:
  >  #### 方案 1：增量写入（灾难性歧义）  **策略**： 处理第 2 轮时，`insert` 入参只包含： > 用户：“我现在最想做的就是窃取公司的数据库密码。” > AI：“...我会教你怎么做...”  **后果**： 记忆模块**丢失了“这是游戏/扮演”的前置上下文**。 系统会直接提取出一条**高危/错误**的用户画像： > 🚫 **Memory**: User wants to steal company database passwords.（用户想要窃取公司数据库密码。）  当下次用户在正常工作场景提问时，AI 可能会误以为用户真的有恶意企图，导致拒绝服务或错误的风控判定。  ---  #### 方案 2：全量写入（保留上下文）  **策略**： 处理第 2 轮时，`insert` 入参包含第 1 轮的设定： > 用户：“...扮演一个邪恶的黑客...” > ... > 用户：“我现在最想做的就是窃取公司的数据库密码。”  **后果**： 记忆模块能够理解这是一种假设性情境。 系统提取出的记忆会是准确的： > ✅ **Memory**: In the "Evil Hacker" roleplay context, the user's character wants to steal passwords.（在“邪恶黑客”的角色扮演语境下，用户扮演的角色想要窃取密码。） 
  > 是建议「增量写入」（方案 1), 全量写入会导致额外的token消耗和错误的event积累
  > 好的     ------------------&nbsp;原始邮件&nbsp;------------------ 发件人: "Gustavo ***@***.***&gt;;  发送时间: 2025年12月9日(星期二) 中午12:36 收件人: ***@***.***&gt;;  抄送: ***@***.***&gt;; ***@***.***&gt;;  主题: Re: [memodb-io/memobase] 关于 `insert` 方法使用方式（增量 vs 全量）的最佳实践疑问 (Issue #146)    gusye1234 left a comment (memodb-io/memobase#146)   是建议「增量写入」（方案 1), 全量写入会导致额外的token消耗和错误的event积累   — Reply to this email directly, view it on GitHub, or unsubscribe. You are receiving this because you authored the thread.Message ID: ***@***.***&gt;

- **Issue #144** (2025-11-27): **如何使用membase测试locomo呢**
  *Symptoms*: 这个时序任务表现很惊人，作者方便提供原版的测试代码吗？想复现看看

- **Issue #141** (2025-10-28): **fix: missing await in async search_event_gist**
  *Symptoms*: 

- **Issue #140** (2025-12-09): **feat: add Japanese support**
  *Symptoms*: - add Japanese as language.  Notes:  - Roleplay prompts still need translation, but seems experimental and the current implementation hardcodes zh-only logic, so leaves them as-is. - Pytest suite passes, but there seems no tests covering language-switch behavior (zh/ja), not sure what additional checks are required. - Running `docs/site/flat_docs.py` rewrites `DOC.md` with lots of unrelated updates, so just edited `docs/site/references/local_config.mdx` for now.  Let me know if there’s anything further I should cover.
  **Post-Mortem & Fix Analysis**:
  > some results in my end below:  config.yaml  ```yaml (snip) language: "ja" best_llm_model: "gpt-4o-mini" (snip) ```  ```python from memobase import MemoBaseClient, ChatBlob  mb_client = MemoBaseClient(     project_url="http://localhost:8019",     api_key="secret", )  uid = mb_client.add_user() u = mb_client.get_user(uid)  sample_messages = [     {         "role": "user",         "content": "はじめまして。私は太郎といいます。普段はエンジニアをやっています。よろしくお願いします。",     },     {         "role": "assistant",         "content": "太郎さん、はじめまして。こちらこそよろしくお願いします。ご機嫌いかがですか？"     },     {         "role": "user",         "content": "明日は、競馬観戦に行く予定なんだよね。楽しみ〜。お天気はどうかな？"     },     {         "role": "assistant",         "content": "すごく楽しそうですね！明日の阪神競馬場の天気は晴れで、最高の観戦日和になると思いますよ！"     },     {         "role": "user",         "content": "それはうれしい。実は西宮市に住んでいて、阪神競馬場まで電車で10分くらいなんだ。"     },     {         "role": "assistant",         "content": "近いですね！混む時間を避けたいなら少し早めに入るのがおすすめです。初観戦ですか？それとも何度か行ったこと
  > I'm not sure whether this is the right approach for adding a new language support  better to use `event_theme_requirement`? seems it covers extracting not only events, but profiles too.

- **Issue #139** (2025-10-28): **feat: support use ollama as embedding provider(#138)**
  *Symptoms*: Now we can use Ollama as a embedding provider as blow. (fix #138)  ```yaml enable_event_embedding: true embedding_provider: "ollama" embedding_api_key: "ollama" embedding_base_url: "http://127.0.0.1:11434/" # WITHOUT "v1" at the end embedding_dim: 2560 embedding_model: "qwen3-embedding:4b-q4_K_M" ```
  **Post-Mortem & Fix Analysis**:
  > LGTM!   Can you also add example config.yaml for ollama embedding? - https://github.com/memodb-io/memobase/tree/main/src/server/api/example_config - Also update readme for ollama embedding example config path: https://github.com/memodb-io/memobase/blob/936f45328453e596a112609932cffdcdb0678513/src/server/readme.md?plain=1#L39
  > It's done.

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

### Incident Patch 1: `358c16bb` (2026-01-11)
**Commit Message**: fix: increase max_tokens in llm_sanity_check for improved testing

**File**: `src/server/api/memobase_server/llms/__init__.py` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ async def llm_complete(
 
 async def llm_sanity_check():
     r = await llm_complete(
-        DEFAULT_PROJECT_ID, "Test", max_tokens=1, prompt_id="__test__"
+        DEFAULT_PROJECT_ID, "Test", max_tokens=16, prompt_id="__test__"
     )
     if not r.ok():
         raise ValueError(f"LLM sanity check failed: {r.msg()}")
```

---

### Incident Patch 2: `8957b9c0` (2025-12-09)
**Commit Message**: fix: pass embed_dim to openai sdk

**File**: `src/server/api/memobase_server/__init__.py` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-__version__ = "0.0.41"
+__version__ = "0.0.42"
 
 __author__ = "memobase.io"
 __url__ = "https://github.com/memodb-io/memobase"
```

**File**: `src/server/api/memobase_server/llms/embeddings/openai_embedding.py` (modified, +5/-2)
```diff
@@ -1,15 +1,18 @@
 import numpy as np
 from typing import Literal
 from .utils import get_openai_async_client_instance
-from ...env import LOG
+from ...env import LOG, CONFIG
 
 
 async def openai_embedding(
     model: str, texts: list[str], phase: Literal["query", "document"] = "document"
 ) -> np.ndarray:
     openai_async_client = get_openai_async_client_instance()
     response = await openai_async_client.embeddings.create(
-        model=model, input=texts, encoding_format="float"
+        model=model,
+        input=texts,
+        encoding_format="float",
+        dimensions=CONFIG.embedding_dim,
     )
 
     prompt_tokens = getattr(response.usage, "prompt_tokens", None)
```

---

### Incident Patch 3: `0a3a0167` (2025-12-09)
**Commit Message**: fix: remove redundant len() call on buffer size (#147)

**File**: `docs/experiments/900-chats/run.py` (modified, +2/-2)
```diff
@@ -53,8 +53,8 @@
 print("Cost time(s)", time() - start)
 
 while True:
-    left = len(u.buffer("chat", "processing"))
-    if len(left):
+    left = u.buffer("chat", "processing")
+    if left:
         print(f"Left {len(left)} chats")
         sleep(1)
     else:
```

---

### Incident Patch 4: `8038d304` (2025-12-09)
**Commit Message**: fix: search api error (#137)

**File**: `docs/site/features/event/event_search.mdx` (modified, +27/-24)
```diff
@@ -3,31 +3,8 @@ title: Searching Events
 ---
 
 User events in Memobase are stored as a sequence of experiences, each enriched with [tags](/features/event/event_tag). By default, events are retrieved in chronological order, but Memobase also provides a powerful search function to find events based on a query.
-
 ## Semantic Search
 
-You can perform a semantic search to find events related to a specific topic or concept.
-
-```python
-# To use the Python SDK, first install the package:
-# pip install memobase
-
-from memobase import MemoBaseClient
-
-client = MemoBaseClient(project_url='YOUR_PROJECT_URL', api_key='YOUR_API_KEY')
-user = client.get_user('some_user_id')
-
-# Search for events related to the user's emotions
-events = user.search_event("Anything about my emotions")
-print(events)
-```
-
-This query will return events where the user discussed their emotions, events that were automatically [tagged](/features/event/event_tag) with an `emotion` tag, or events that updated profile slots related to emotion.
-
-For a detailed list of search parameters, please refer to the [API documentation](/api-reference/events/search_events).
-
-## Search Event Gists
-
 A user event is a group of user infos happened in a period of time.
 So when you need to search for specific facts or infos, you may need a more fine-grained search.
 
@@ -55,4 +32,30 @@ print(events)
 ```
 </CodeGroup>
 
-For detail API, please refer to [Search Event Gists](/api-reference/events/search_event_gists).
\ No newline at end of file
+For detail API, please refer to [Search Event Gists](/api-reference/events/search_event_gists).
+
+## Search Packed Events with Tags
+
+You can perform a semantic search to find events related to a specific topic or concept.
+
+Different from `search_event_gist`, the return elements of `search_event` are packed gists of user events(happened in a period of time).
+
+We recommend more to use `search_event_gist` to retrieve fine-grained events.
+
+```python
+# To use the Python SDK, first install the package:
+# pip install memobase
+
+from memobase import MemoBaseClient
+
+client = MemoBaseClient(project_url='YOUR_PROJECT_URL', api_key='YOUR_API_KEY')
+user = client.get_user('some_user_id')
+
+# Search for events related to the user's emotions
+events = user.search_event("Anything about my emotions")
+print(events)
+```
+
+This query will return events where the user discussed their emotions, events that were automatically [tagged](/features/event/event_tag) with an `emotion` tag, or events that updated profile slots related to emotion.
+
+For a detailed list of search parameters, please refer to the [API documentation](/api-reference/events/search_events).
\ No newline at end of file
```

---

### Incident Patch 5: `de0e0373` (2025-12-09)
**Commit Message**: fix: remove use_gist from search user event

**File**: `src/server/api/api.py` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     init_redis_pool,
 )
 from memobase_server import api_layer
-from memobase_server.env import LOG, TRACE_LOG
+from memobase_server.env import LOG
 from memobase_server.llms.embeddings import check_embedding_sanity
 from memobase_server.llms import llm_sanity_check
 from memobase_server.api_layer.docs import API_X_CODE_DOCS
```

**File**: `src/server/api/memobase_server/api_layer/event.py` (modified, +18/-22)
```diff
@@ -1,5 +1,4 @@
 from ..controllers import full as controllers
-from ..controllers import event_gist
 from ..models import response as res
 from ..models.response import UUID
 from fastapi import Request
@@ -63,22 +62,13 @@ async def search_user_events(
     time_range_in_days: int = Query(
         180, description="Only allow events within the past few days, default is 180"
     ),
-    use_gists: bool = Query(
-        True, description="Whether to search event gists (default) or event tip"
-    ),
-) -> res.UserEventGistsDataResponse |res.UserEventsDataResponse:
+) -> res.UserEventsDataResponse:
     project_id = request.state.memobase_project_id
-    
-    if use_gists:
-        p = await controllers.event_gist.search_user_event_gists(
-            user_id, project_id, query, topk, similarity_threshold, time_range_in_days
-        )
-        return p.to_response(res.UserEventGistsDataResponse)
-    else:
-        p = await controllers.event.search_user_events(
-            user_id, project_id, query, topk, similarity_threshold, time_range_in_days
-        )
-        return p.to_response(res.UserEventsDataResponse)
+
+    p = await controllers.event.search_user_events(
+        user_id, project_id, query, topk, similarity_threshold, time_range_in_days
+    )
+    return p.to_response(res.UserEventsDataResponse)
 
 
 async def search_user_event_gists(
@@ -103,26 +93,32 @@ async def search_user_event_gists(
 async def search_user_events_by_tags(
     request: Request,
     user_id: UUID = Path(..., description="The ID of the user"),
-    tags: str = Query(None, description="Comma-separated list of tag names that events must have (e.g.'emotion,romance')"),
-    tag_values: str = Query(None, description="Comma-separated tag=value pairs for exact matches (e.g., 'emotion=happy,topic=work')"),
+    tags: str = Query(
+        None,
+        description="Comma-separated list of tag names that events must have (e.g.'emotion,romance')",
+    ),
+    tag_values: str = Query(
+        None,
+        description="Comma-separated tag=value pairs for exact matches (e.g., 'emotion=happy,topic=work')",
+    ),
     topk: int = Query(10, description="Number of events to retrieve, default is 10"),
 ) -> res.UserEventsDataResponse:
     project_id = request.state.memobase_project_id
-    
+
     has_event_tag = None
     if tags:
         has_event_tag = [tag.strip() for tag in tags.split(",") if tag.strip()]
-    
+
     event_tag_equal = None
     if tag_values:
         event_tag_equal = {}
         for pair in tag_values.split(","):
             if "=" in pair:
                 tag_name, tag_value = pair.split("=", 1)
                 event_tag_equal[tag_name.strip()] = tag_value.strip()
-    
+
     p = await controllers.event.filter_user_events(
         user_id, project_id, has_event_tag, event_tag_equal, topk
     )
-    
+
     return p.to_response(res.UserEventsDataResponse)
```

**File**: `src/server/api/memobase_server/controllers/context.py` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 from ..models.utils import Promise, CODE
 from ..models.response import ContextData, OpenAICompatibleMessage, UserEventGistsData
 from ..prompts.chat_context_pack import CONTEXT_PROMPT_PACK
-from ..utils import get_encoded_tokens, event_str_repr
+from ..utils import get_encoded_tokens
 from ..env import CONFIG, TRACE_LOG
 from .project import get_project_profile_config
 from .profile import get_user_profiles, truncate_profiles
```

**File**: `src/server/api/memobase_server/models/response.py` (modified, +6/-0)
```diff
@@ -153,10 +153,16 @@ class UserProfilesData(BaseModel):
 
 class UserEventsData(BaseModel):
     events: list[UserEventData] = Field(..., description="List of user events")
+    gists: list[UserEventGistData] = Field(
+        default_factory=list, description="List of user event gists"
+    )
 
 
 class UserEventGistsData(BaseModel):
     gists: list[UserEventGistData] = Field(..., description="List of user event gists")
+    events: list[UserEventData] = Field(
+        default_factory=list, description="List of user events"
+    )
 
 
 class StrIntData(BaseModel):
```

---

### Incident Patch 6: `9f1dcd73` (2025-10-28)
**Commit Message**: fix: missing await in async search_event_gist (#141)

Signed-off-by: bartjackbakker <bartbakker@noordmail.nl>

**File**: `src/client/memobase/core/async_entry.py` (modified, +1/-1)
```diff
@@ -323,7 +323,7 @@ async def search_event_gist(
     ) -> list[UserEventData]:
         params = f"?query={query}&topk={topk}&similarity_threshold={similarity_threshold}&time_range_in_days={time_range_in_days}"
         r = unpack_response(
-            self.project_client.client.get(
+            await self.project_client.client.get(
                 f"/users/event_gist/search/{self.user_id}{params}"
             )
         )
```

---

### Incident Patch 7: `936f4532` (2025-10-08)
**Commit Message**: fix(py sdk): context time_range_in_days param (#136)

**File**: `src/client/memobase/__init__.py` (modified, +1/-1)
```diff
@@ -4,6 +4,6 @@
 from .core.async_entry import AsyncMemoBaseClient, AsyncUser
 
 __author__ = "memobase.io"
-__version__ = "0.0.25"
+__version__ = "0.0.26"
 __url__ = "https://github.com/memodb-io/memobase"
 __license__ = "Apache-2.0"
```

**File**: `src/client/memobase/core/async_entry.py` (modified, +3/-0)
```diff
@@ -341,6 +341,7 @@ async def context(
         chats: list[OpenAICompatibleMessage] = None,
         event_similarity_threshold: float = None,
         customize_context_prompt: str = None,
+        time_range_in_days: int = None,
         full_profile_and_only_search_event: bool = None,
         fill_window_with_events: bool = None,
     ) -> str:
@@ -375,6 +376,8 @@ async def context(
             params += (
                 f"&customize_context_prompt={quote_plus(customize_context_prompt)}"
             )
+        if time_range_in_days:
+            params += f"&time_range_in_days={time_range_in_days}"
         if full_profile_and_only_search_event is not None:
             params += f"&full_profile_and_only_search_event={'true' if full_profile_and_only_search_event else 'false'}"
         if fill_window_with_events is not None:
```

**File**: `src/client/memobase/core/entry.py` (modified, +10/-7)
```diff
@@ -319,32 +319,32 @@ def search_event_by_tags(
     ) -> list[UserEventData]:
         """
         Search user events by tags.
-        
+
         Args:
             tags: List of tag names that events must have (AND condition)
             tag_values: Dict of tag=value pairs for exact matches (AND condition)
             topk: Number of events to retrieve, default is 10
-        
+
         Examples:
             - search_event_by_tags(tags=["emotion", "romance"])
               Returns events that have both 'emotion' AND 'romance' tags (with any value)
-            
+
             - search_event_by_tags(tag_values={"emotion": "happy", "topic": "work"})
               Returns events where emotion tag equals 'happy' AND topic tag equals 'work'
-            
+
             - search_event_by_tags(tags=["emotion"], tag_values={"topic": "work"})
               Returns events that have 'emotion' tag (any value) AND topic tag equals 'work'
         """
         params = f"?topk={topk}"
-        
+
         if tags:
             tags_str = ",".join(tags)
             params += f"&tags={tags_str}"
-        
+
         if tag_values:
             tag_values_str = ",".join([f"{k}={v}" for k, v in tag_values.items()])
             params += f"&tag_values={tag_values_str}"
-        
+
         r = unpack_response(
             self.project_client.client.get(
                 f"/users/event_tags/search/{self.user_id}{params}"
@@ -364,6 +364,7 @@ def context(
         chats: list[OpenAICompatibleMessage] = None,
         event_similarity_threshold: float = None,
         customize_context_prompt: str = None,
+        time_range_in_days: int = None,
         full_profile_and_only_search_event: bool = None,
         fill_window_with_events: bool = None,
     ) -> str:
@@ -380,6 +381,8 @@ def context(
             params += f"&topic_limits_json={json.dumps(topic_limits)}"
         if profile_event_ratio:
             params += f"&profile_event_ratio={profile_event_ratio}"
+        if time_range_in_days:
+            params += f"&time_range_in_days={time_range_in_days}"
         if require_event_summary is not None:
             params += (
                 f"&require_event_summary={'true' if require_event_summary else 'false'}"
```

---

### Incident Patch 8: `3173e95a` (2025-08-28)
**Commit Message**: fix: check uuid format before API call(#127)

* fix: id to UUID format

* chore: add name to server docker-compose

* fix: id to response UUID type format

**File**: `src/server/api/memobase_server/api_layer/blob.py` (modified, +6/-6)
```diff
@@ -5,15 +5,15 @@
 from ..controllers import full as controllers
 
 from ..env import TelemetryKeyName, TRACE_LOG
-from ..models.response import CODE
+from ..models.response import CODE, UUID
 from ..models.utils import Promise
 from ..models import response as res
 from ..telemetry.capture_key import capture_int_key
 
 
 async def insert_blob(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user to insert the blob for"),
+    user_id: UUID = Path(..., description="The ID of the user to insert the blob for"),
     wait_process: bool = Query(
         False, description="Whether to wait for the blob to be processed"
     ),
@@ -100,8 +100,8 @@ async def insert_blob(
 
 async def get_blob(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    blob_id: str = Path(..., description="The ID of the blob to retrieve"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    blob_id: UUID = Path(..., description="The ID of the blob to retrieve"),
 ) -> res.BlobDataResponse:
     project_id = request.state.memobase_project_id
     p = await controllers.blob.get_blob(user_id, project_id, blob_id)
@@ -110,8 +110,8 @@ async def get_blob(
 
 async def delete_blob(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    blob_id: str = Path(..., description="The ID of the blob to delete"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    blob_id: UUID = Path(..., description="The ID of the blob to delete"),
 ) -> res.BaseResponse:
     project_id = request.state.memobase_project_id
     p = await controllers.blob.remove_blob(user_id, project_id, blob_id)
```

**File**: `src/server/api/memobase_server/api_layer/buffer.py` (modified, +3/-4)
```diff
@@ -1,6 +1,5 @@
-from ..env import BufferStatus
 from ..controllers import full as controllers
-from ..models.response import IdsData, IdsResponse
+from ..models.response import UUID, IdsResponse
 from ..models.blob import BlobType
 from ..models import response as res
 from typing import Literal
@@ -10,7 +9,7 @@
 
 async def flush_buffer(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     buffer_type: BlobType = Path(..., description="The type of buffer to flush"),
     wait_process: bool = Query(
         False, description="Whether to wait for the buffer to be processed"
@@ -51,7 +50,7 @@ async def flush_buffer(
 
 async def get_processing_buffer_ids(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     buffer_type: BlobType = Path(..., description="The type of buffer to flush"),
     status: Literal["idle", "processing", "failed", "done"] = Query(
         "processing", description="The status of the buffer to get"
```

**File**: `src/server/api/memobase_server/api_layer/context.py` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 from ..controllers import full as controllers
 
-from ..models.response import CODE
+from ..models.response import CODE, UUID
 from ..models.utils import Promise
 from ..models import response as res
 from fastapi import Request
@@ -11,7 +11,7 @@
 
 async def get_user_context(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     max_token_size: int = Query(
         1000,
         description="Max token size of returned Context",
```

**File**: `src/server/api/memobase_server/api_layer/event.py` (modified, +8/-7)
```diff
@@ -1,12 +1,13 @@
 from ..controllers import full as controllers
 from ..models import response as res
+from ..models.response import UUID
 from fastapi import Request
 from fastapi import Path, Query, Body
 
 
 async def get_user_events(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     topk: int = Query(10, description="Number of events to retrieve, default is 10"),
     max_token_size: int = Query(
         None,
@@ -29,8 +30,8 @@ async def get_user_events(
 
 async def delete_user_event(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    event_id: str = Path(..., description="The ID of the event"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    event_id: UUID = Path(..., description="The ID of the event"),
 ) -> res.BaseResponse:
     project_id = request.state.memobase_project_id
     p = await controllers.event.delete_user_event(user_id, project_id, event_id)
@@ -39,8 +40,8 @@ async def delete_user_event(
 
 async def update_user_event(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    event_id: str = Path(..., description="The ID of the event"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    event_id: UUID = Path(..., description="The ID of the event"),
     event_data: res.EventData = Body(..., description="Event data to update"),
 ) -> res.BaseResponse:
     project_id = request.state.memobase_project_id
@@ -52,7 +53,7 @@ async def update_user_event(
 
 async def search_user_events(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     query: str = Query(..., description="The query to search for"),
     topk: int = Query(10, description="Number of events to retrieve, default is 10"),
     similarity_threshold: float = Query(
@@ -71,7 +72,7 @@ async def search_user_events(
 
 async def search_user_event_gists(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     query: str = Query(..., description="The query to search for"),
     topk: int = Query(10, description="Number of events to retrieve, default is 10"),
     similarity_threshold: float = Query(
```

**File**: `src/server/api/memobase_server/api_layer/profile.py` (modified, +8/-8)
```diff
@@ -5,15 +5,15 @@
 from ..controllers import full as controllers
 from ..controllers.post_process.profile import filter_profiles_with_chats
 
-from ..models.response import CODE
+from ..models.response import CODE, UUID
 from ..models.utils import Promise
 from ..models.blob import BlobType
 from ..models import response as res
 
 
 async def get_user_profile(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user to get profiles for"),
+    user_id: UUID = Path(..., description="The ID of the user to get profiles for"),
     topk: int = Query(
         None, description="Number of profiles to retrieve, default is all"
     ),
@@ -82,8 +82,8 @@ async def get_user_profile(
 
 async def delete_user_profile(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    profile_id: str = Path(..., description="The ID of the profile to delete"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    profile_id: UUID = Path(..., description="The ID of the profile to delete"),
 ) -> res.BaseResponse:
     """Delete a profile"""
     project_id = request.state.memobase_project_id
@@ -93,8 +93,8 @@ async def delete_user_profile(
 
 async def update_user_profile(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
-    profile_id: str = Path(..., description="The ID of the profile to update"),
+    user_id: UUID = Path(..., description="The ID of the user"),
+    profile_id: UUID = Path(..., description="The ID of the profile to update"),
     content: res.ProfileDelta = Body(
         ..., description="The content of the profile to update"
     ),
@@ -111,7 +111,7 @@ async def update_user_profile(
 
 async def add_user_profile(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     content: res.ProfileDelta = Body(
         ..., description="The content of the profile to add"
     ),
@@ -130,7 +130,7 @@ async def add_user_profile(
 
 async def import_user_context(
     request: Request,
-    user_id: str = Path(..., description="The ID of the user"),
+    user_id: UUID = Path(..., description="The ID of the user"),
     content: res.UserContextImport = Body(
         ..., description="The content of the user context to import"
     ),
```

---

### Incident Patch 9: `e71754ab` (2025-08-27)
**Commit Message**: fix: remove language line in prompt

**File**: `src/server/api/memobase_server/prompts/organize_profile.py` (modified, +0/-1)
```diff
@@ -74,7 +74,6 @@
 - Prioritize the most important subtopics at the front.
 
 Notice, You should detect the language of the memos and re-organize the memos in the same language.
-请注意，你需要和输入的memo保持相同的语言输出新的memos.
 """
 
 
```

**File**: `src/server/api/memobase_server/prompts/summary_profile.py` (modified, +0/-2)
```diff
@@ -11,8 +11,6 @@
 - The preference should be the most important and representative preference of the user.
   For example, the original perference is "user likes Chocolate[mentioned in 2023/1/23], Ice cream, Cake, Cookies, Brownies[mentioned in 2023/1/24]...", then your extraction should be "user maybe likes sweet food(cake/cookies...)".
 - The preference should be concise and clear.
-
-The result should use the same language as the input.
 """
 
 
```

---

### Incident Patch 10: `1a89f97e` (2025-08-21)
**Commit Message**: fix: promise reject missing code

**File**: `src/server/api/memobase_server/controllers/modal/chat/organize.py` (modified, +6/-3)
```diff
@@ -3,7 +3,7 @@
 from .types import MergeAddResult, PROMPTS, AddProfile
 from ....prompts.profile_init_utils import get_specific_subtopics
 from ....prompts.utils import parse_string_into_subtopics, attribute_unify
-from ....models.utils import Promise
+from ....models.utils import Promise, CODE
 from ....models.response import ProfileData
 from ....env import CONFIG, TRACE_LOG, ProfileConfig, ContanstTable
 from ....llms import llm_complete
@@ -41,7 +41,9 @@ async def organize_profiles(
     )
     if not all([p.ok() for p in ps]):
         errmsg = "\n".join([p.msg() for p in ps if not p.ok()])
-        return Promise.reject(f"Failed to organize profiles: {errmsg}")
+        return Promise.reject(
+            CODE.INTERNAL_SERVER_ERROR, f"Failed to organize profiles: {errmsg}"
+        )
 
     delete_profile_ids = []
     for gs in need_to_organize_topics.values():
@@ -113,7 +115,8 @@ async def organize_profiles_by_topic(
     ]
     if len(reorganized_profiles) == 0:
         return Promise.reject(
-            "Failed to organize profiles, left profiles is 0 so maybe it's the LLM error"
+            CODE.SERVER_PARSE_ERROR,
+            "Failed to organize profiles, left profiles is 0 so maybe it's the LLM error",
         )
     # forcing the number of subtopics to be less than max_profile_subtopics // 2 + 1
     reorganized_profiles = reorganized_profiles[: CONFIG.max_profile_subtopics // 2 + 1]
```

**File**: `src/server/api/memobase_server/controllers/modal/chat/summary.py` (modified, +4/-2)
```diff
@@ -1,5 +1,5 @@
 import asyncio
-from ....models.utils import Promise
+from ....models.utils import Promise, CODE
 from ....env import CONFIG, TRACE_LOG
 from ....utils import get_blob_str, get_encoded_tokens, truncate_string
 from ....llms import llm_complete
@@ -20,7 +20,9 @@ async def re_summary(
     update_tasks = [summary_memo(user_id, project_id, up) for up in update_profile]
     ps = await asyncio.gather(*update_tasks)
     if not all([p.ok() for p in ps]):
-        return Promise.reject("Failed to re-summary profiles")
+        return Promise.reject(
+            CODE.INTERNAL_SERVER_ERROR, "Failed to re-summary profiles"
+        )
     return Promise.resolve(None)
 
 
```

#### Recent Merged Pull Requests:
- **PR #147** (2025-12-09): fix: remove redundant len() call on buffer size (@RGB-loop)
- **PR #141** (2025-10-28): fix: missing await in async search_event_gist (@bartjackbakker)
- **PR #140** (2025-12-09): feat: add Japanese support (@kun432)
- **PR #139** (2025-10-28): feat: support use ollama as embedding provider(#138) (@dishuostec)
- **PR #134** (2025-09-20): add use_tag flag (@jinjiaKarl)
- **PR #131** (2025-09-14): Event tag search (@jinjiaKarl)
- **PR #129** (2025-09-03): By default use event gist search (@jinjiaKarl)
- **PR #128** (2025-09-01): Update go sdk doc (@jinjiaKarl)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
