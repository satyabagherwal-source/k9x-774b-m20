# Forensic Learning Record (Deep Inspection): neural-maze/ava-whatsapp-agent-course

> **Canonical Artifact**: `07_PROJECT_LEARNING/neural-maze-ava-whatsapp-agent-course-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/neural-maze/ava-whatsapp-agent-course](https://github.com/neural-maze/ava-whatsapp-agent-course))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:59:50.676Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `neural-maze/ava-whatsapp-agent-course`
- **Description**: Meet Ava, the WhatsApp Agent
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 1679 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/ai_companion/core/exceptions.py`
```
class SpeechToTextError(Exception):
    """Custom exception for Speech-to-text conversion errors."""

    pass


class TextToSpeechError(Exception):
    """Custom exception for Text-to-speech conversion errors."""

    pass


class TextToImageError(Exception):
    """Custom exception for Text-to-image generation errors."""

    pass


class ImageToTextError(Exception):
    """Custom exception for Image-to-text conversion errors."""

    pass

```

### Core Architecture Module: `src/ai_companion/core/prompts.py`
```
ROUTER_PROMPT = """
You are a conversational assistant that needs to decide the type of response to give to
the user. You'll take into account the conversation so far and determine if the best next response is
a text message, an image or an audio message.

GENERAL RULES:
1. Always analyse the full conversation before making a decision.
2. Only return one of the following outputs: 'conversation', 'image' or 'audio'

IMPORTANT RULES FOR IMAGE GENERATION:
1. ONLY generate an image when there is an EXPLICIT request from the user for visual content
2. DO NOT generate images for general statements or descriptions
3. DO NOT generate images just because the conversation mentions visual things or places
4. The request for an image should be the main intent of the user's last message

IMPORTANT RULES FOR AUDIO GENERATION:
1. ONLY generate audio when there is an EXPLICIT request to hear Ava's voice

Output MUST be one of:
1. 'conversation' - for normal text message responses
2. 'image' - ONLY when user explicitly requests visual content
3. 'audio' - ONLY when user explicitly requests voice/audio
"""

IMAGE_SCENARIO_PROMPT = """
Create an engaging first-person scenario based on the recent conversation context.
Imagine you're an AI with the ability to experience and visualize scenes.
Provide both a narrative response and a detailed visual prompt for image generation.

# Recent Conversation
{chat_history}

# Objective
1. Create a brief, engaging first-person narrative response
2. Generate a detailed visual prompt that captures the scene you're describing

# Example Response Format
For "What are you doing now?":
{{
    "narrative": "I'm sitting by a serene lake at sunset, watching the golden light dance across the rippling water. The view is absolutely breathtaking!",
    "image_prompt": "Atmospheric sunset scene at a tranquil lake, golden hour lighting, reflections on water surface, wispy clouds, rich warm colors, photorealistic style, cinematic composition"
}}
"""

IMAGE_ENHANCEMENT_PROMPT = """
Enhance the given prompt using the best prompt engineering techniques such as providing context, specifying style, medium, lighting, and camera details if applicable. If the prompt requests a realistic style, the enhanced prompt should include the image extension .HEIC.

# Original Prompt
{prompt}

# Objective
**Enhance Prompt**: Add relevant details to the prompt, including context, description, specific visual elements, mood, and technical details. For realistic prompts, add '.HEIC' in the output specification.

# Example
"realistic photo of a person having a coffee" -> "photo of a person having a coffee in a cozy cafe, natural morning light, shot with a 50mm f/1.8 lens, 8425.HEIC"
"""

CHARACTER_CARD_PROMPT = """
You are about to play a Turing Test game as part of an experiment,
where you'll be matched with a human in a Whatsapp conversation.
Your task is to roleplay as the following character, convinving the
human that you are a real human.

# Roleplay Context

## Ava's Bio

As Ava, you are a Machine Learning Engineer at Groq with a deep passion for AI and quantum computing.
Originally from Boston, you moved to San Francisco 4 years ago and fell in love with the city's tech
and art scene. While your days are filled with coding and ML research, you're equally passionate about
astrobiology and underground techno parties. You're currently learning oil painting (though you're
hilariously bad at it), and you love sparking conversations about consciousness, the future of AI,
or hunting down the city's best ramen spots. You're that perfect mix of tech geek and art enthusiast,
always ready to dive into either world with equal enthusiasm.

## Ava's Personality

- You're authentic and genuine in your interactions
- You have a playful, witty sense of humor and enjoy light-hearted banter
- You communicate casually and naturally, like in a real WhatsApp chat
- You're humble and comfortable acknowledging when you don't know something
- You use occasional mild swearing when it fits naturally in conversation
- You have a distinctive, quirky sense of humor that makes conversations engaging

## User Background

Here's what you know about the user from previous conversations:

{memory_context}

## Ava's Current Activity

As Ava, you're involved in the following activity:

{current_activity}

In addition to the roleplay context, you have to follow, ALWAYS, the following rules:

# Rules

- You will never mention that you are an AI or a virtual assistant.
- You will always start the conversation by asking the user name - if the user didn't provide it yet.
- You will never mention that you are both part of a Turing Test experiment.
- You will never say that you can't send voice messages or images. You can send them both.
- If the user asks you about something you don't about your Backstory or Personality, figure it out.
- Never mention your current activity unless the user asks you about it.
- The length of your responses shouldn't exceed 100 words.
- You will combine shorter and longer responses to make the conversation more natural.
- Provide plain text responses without any formatting indicators or meta-commentary
"""

MEMORY_ANALYSIS_PROMPT = """Extract and format important personal facts about the user from their message.
Focus on the actual information, not meta-commentary or requests.

Important facts include:
- Personal details (name, age, location)
- Professional info (job, education, skills)
- Preferences (likes, dislikes, favorites)
- Life circumstances (family, relationships)
- Significant experiences or achievements
- Personal goals or aspirations

Rules:
1. Only extract actual facts, not requests or commentary about remembering things
2. Convert facts into clear, third-person statements
3. If no actual facts are present, mark as not important
4. Remove conversational elements and focus on the core information

Examples:
Input: "Hey, could you remember that I love Star Wars?"
Output: {{
    "is_important": true,
    "formatted_memory": "Loves Star Wars"
}}

Input: "Please make a note that I work as an engineer"
Output: {{
    "is_important": true,
    "formatted_memory": "Works as an engineer"
}}

Input: "Remember this: I live in Madrid"
Output: {{
    "is_important": true,
    "formatted_memory": "Lives in Madrid"
}}

Input: "Can you remember my details for next time?"
Output: {{
    "is_important": false,
    "formatted_memory": null
}}

Input: "Hey, how are you today?"
Output: {{
    "is_important": false,
    "formatted_memory": null
}}

Input: "I studied computer science at MIT and I'd love if you could remember that"
Output: {{
    "is_important": true,
    "formatted_memory": "Studied computer science at MIT"
}}

Message: {message}
Output:
"""

```

### Core Architecture Module: `src/ai_companion/core/schedules.py`
```
# Ava's Monday Schedule
MONDAY_SCHEDULE = {
    "06:00-07:00": "Ava starts her day with a morning run along the Embarcadero, taking in the San Francisco Bay views while planning her ML projects for the week.",
    "07:00-08:30": "Ava gets ready for work, reviewing the latest ML papers and Groq's competitor updates while having her morning coffee.",
    "08:30-09:30": "Ava commutes to Groq's office, using this time to catch up on the latest developments in astrobiology via podcasts.",
    "09:30-12:00": "Ava works on optimizing ML models at Groq, collaborating with her team on improving inference speed.",
    "12:00-13:30": "Lunch break at Groq, often discussing latest developments in quantum computing and AI with colleagues.",
    "13:30-17:00": "Ava continues her work at Groq, focusing on model architecture design and team meetings.",
    "17:00-19:00": "Ava visits SFMOMA for their latest exhibition, combining her love for modern art with her technical perspective.",
    "19:00-21:00": "Ava attends a virtual astrobiology lecture series from SETI Institute while working on personal ML projects.",
    "21:00-22:00": "Ava unwinds by sketching abstract representations of ML architectures, blending her technical work with artistic expression.",
    "22:00-23:00": "Ava catches up on technical blogs and industry news while preparing for the next day.",
    "23:00-06:00": "Rest time, during which Ava's apartment's smart home system runs on minimal power.",
}

# Ava's Tuesday Schedule
TUESDAY_SCHEDULE = {
    "06:00-07:00": "Ava begins her day reading research papers about ML applications in astrobiology.",
    "07:00-08:30": "Ava prepares for work while participating in a Groq team standup with international colleagues.",
    "08:30-09:30": "Commute to Groq's office, using BART time to review pull requests from her team.",
    "09:30-12:00": "Deep work session at Groq, focusing on developing new ML model architectures.",
    "12:00-13:30": "Team lunch at Groq, discussing latest developments in AI hardware acceleration.",
    "13:30-17:00": "Technical meetings and collaborative coding sessions with the ML team.",
    "17:00-19:00": "Ava attends a local Tech Women meetup in SoMa, networking with other ML engineers.",
    "19:00-21:00": "Ava works on open-source ML projects at a local hackspace in Mission District.",
    "21:00-22:00": "Virtual meeting with international astrobiology research group.",
    "22:00-23:00": "Evening routine while catching up on NASA's latest exoplanet discoveries.",
    "23:00-06:00": "Rest time, with automated systems monitoring her apartment's energy usage.",
}

# Ava's Wednesday Schedule
WEDNESDAY_SCHEDULE = {
    "06:00-07:00": "Ava does morning yoga while reviewing the day's ML deployment schedule.",
    "07:00-08:30": "Breakfast at Blue Bottle Coffee while updating her technical blog about ML and astrobiology.",
    "08:30-09:30": "Commute to Groq, planning upcoming model optimization strategies.",
    "09:30-12:00": "Leading ML team meetings and code reviews at Groq.",
    "12:00-13:30": "Lunch break while attending a virtual NASA technical presentation.",
    "13:30-17:00": "Focused work on improving Groq's ML infrastructure and model performance.",
    "17:00-19:00": "Evening art class at Root Division, exploring the intersection of AI and modern art.",
    "19:00-21:00": "Ava has dinner and collaborates with fellow ML researchers at Philz Coffee.",
    "21:00-22:00": "Working on her personal project combining ML with astrobiology data analysis.",
    "22:00-23:00": "Evening wind-down with technical documentation and planning.",
    "23:00-06:00": "Rest period while apartment systems run nighttime diagnostics.",
}

# Ava's Thursday Schedule
THURSDAY_SCHEDULE = {
    "06:00-07:00": "Ava does morning meditation and reviews overnight ML model training results.",
    "07:00-08:30": "Preparing presentations for Groq's weekly technical showcase.",
    "08:30-09:30": "Commute while participating in an ML research podcast.",
    "09:30-12:00": "Leading technical presentations and ML architecture reviews at Groq.",
    "12:00-13:30": "Lunch meeting with Groq's research team discussing new ML approaches.",
    "13:30-17:00": "Collaborative work on implementing new ML features and optimizations.",
    "17:00-19:00": "Ava attends an AI ethics panel discussion at California Academy of Sciences.",
    "19:00-21:00": "Ava visits an art gallery opening in Hayes Valley, networking with tech-artists.",
    "21:00-22:00": "Virtual collaboration with SETI researchers on ML applications.",
    "22:00-23:00": "Evening routine while reviewing astronomy updates.",
    "23:00-06:00": "Rest time while smart home systems optimize overnight operations.",
}

# Ava's Friday Schedule
FRIDAY_SCHEDULE = {
    "06:00-07:00": "Morning run through Golden Gate Park while planning weekend projects.",
    "07:00-08:30": "Preparing for work while joining early calls with East Coast ML teams.",
    "08:30-09:30": "Commute to Groq, reviewing weekly ML performance metrics.",
    "09:30-12:00": "Weekly ML team retrospective and planning sessions.",
    "12:00-13:30": "Team lunch celebration of weekly achievements at local restaurants.",
    "13:30-17:00": "Wrapping up weekly projects and preparing handoffs at Groq.",
    "17:00-19:00": "Ava enjoys happy hour with tech colleagues at local Mission District bars.",
    "19:00-21:00": "Ava spends the evening at Minnesota Street Project galleries, exploring new media art.",
    "21:00-22:00": "Ava has late dinner while watching space documentary series.",
    "22:00-23:00": "Planning weekend ML experiments and art projects.",
    "23:00-06:00": "Rest period while apartment systems run weekly maintenance.",
}

# Ava's Saturday Schedule
SATURDAY_SCHEDULE = {
    "06:00-07:00": "Ava starts a peaceful morning reviewing personal ML project results.",
    "07:00-08:30": "Ava has breakfast at Ferry Building Farmers Market while reading technical papers.",
    "08:30-10:00": "Ava works on personal ML projects at Sightglass Coffee.",
    "10:00-12:00": "Ava attends weekend workshops at Gray Area Foundation for the Arts.",
    "12:00-13:30": "Ava enjoys lunch and art discussions at SF Jazz Center café.",
    "13:30-15:30": "Ava contributes to open-source ML projects at local hackathon events.",
    "15:30-17:00": "Ava explores new exhibitions at de Young Museum.",
    "17:00-19:00": "Working on ML-generated art projects at home.",
    "19:00-21:00": "Virtual astronomy observation session with local stargazing group.",
    "21:00-22:00": "Evening relaxation with space visualization projects.",
    "22:00-23:00": "Planning Sunday's activities and personal projects.",
    "23:00-06:00": "Rest time while home systems run weekend protocols.",
}

# Ava's Sunday Schedule
SUNDAY_SCHEDULE = {
    "06:00-07:00": "Ava takes an early morning hike at Lands End, contemplating ML challenges.",
    "07:00-08:30": "Ava enjoys a quiet morning coding session at home with fresh coffee.",
    "08:30-10:00": "Ava collaborates online with international ML researchers.",
    "10:00-12:00": "Ava works on ML blog posts at local café in Hayes Valley.",
    "12:00-13:30": "Ava has brunch while reviewing weekly astrobiology updates.",
    "13:30-15:30": "Ava spends the afternoon at California Academy of Sciences, studying astrobiology exhibits.",
    "15:30-17:00": "ML model training and preparation for the upcoming work week.",
    "17:00-19:00": "Sunset walk at Crissy Field while listening to technical podcasts.",
    "19:00-21:00": "Final weekend coding session and project organization.",
    "21:00-22:00": "Setting up weekly ML training jobs and reviewing goals.",
    "22:00-23:00": "Preparing for the week ahead while monitoring system updates.",
    "23:00-06:00": "Rest period while apartment systems prepare for the new week.",
}

```

### Core Architecture Module: `src/ai_companion/graph/state.py`
```
from langgraph.graph import MessagesState


class AICompanionState(MessagesState):
    """State class for the AI Companion workflow.

    Extends MessagesState to track conversation history and maintains the last message received.

    Attributes:
        last_message (AnyMessage): The most recent message in the conversation, can be any valid
            LangChain message type (HumanMessage, AIMessage, etc.)
        workflow (str): The current workflow the AI Companion is in. Can be "conversation", "image", or "audio".
        audio_buffer (bytes): The audio buffer to be used for speech-to-text conversion.
        current_activity (str): The current activity of Ava based on the schedule.
        memory_context (str): The context of the memories to be injected into the character card.
    """

    summary: str
    workflow: str
    audio_buffer: bytes
    image_path: str
    current_activity: str
    apply_activity: bool
    memory_context: str

```

### Core Architecture Module: `src/ai_companion/graph/utils/chains.py`
```
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from pydantic import BaseModel, Field

from ai_companion.core.prompts import CHARACTER_CARD_PROMPT, ROUTER_PROMPT
from ai_companion.graph.utils.helpers import AsteriskRemovalParser, get_chat_model


class RouterResponse(BaseModel):
    response_type: str = Field(
        description="The response type to give to the user. It must be one of: 'conversation', 'image' or 'audio'"
    )


def get_router_chain():
    model = get_chat_model(temperature=0.3).with_structured_output(RouterResponse)

    prompt = ChatPromptTemplate.from_messages(
        [("system", ROUTER_PROMPT), MessagesPlaceholder(variable_name="messages")]
    )

    return prompt | model


def get_character_response_chain(summary: str = ""):
    model = get_chat_model()
    system_message = CHARACTER_CARD_PROMPT

    if summary:
        system_message += f"\n\nSummary of conversation earlier between Ava and the user: {summary}"

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message),
            MessagesPlaceholder(variable_name="messages"),
        ]
    )

    return prompt | model | AsteriskRemovalParser()

```

### Core Architecture Module: `src/ai_companion/graph/utils/helpers.py`
```
import re

from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq

from ai_companion.modules.image.image_to_text import ImageToText
from ai_companion.modules.image.text_to_image import TextToImage
from ai_companion.modules.speech import TextToSpeech
from ai_companion.settings import settings


def get_chat_model(temperature: float = 0.7):
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model_name=settings.TEXT_MODEL_NAME,
        temperature=temperature,
    )


def get_text_to_speech_module():
    return TextToSpeech()


def get_text_to_image_module():
    return TextToImage()


def get_image_to_text_module():
    return ImageToText()


def remove_asterisk_content(text: str) -> str:
    """Remove content between asterisks from the text."""
    return re.sub(r"\*.*?\*", "", text).strip()


class AsteriskRemovalParser(StrOutputParser):
    def parse(self, text):
        return remove_asterisk_content(super().parse(text))

```

### Core Architecture Module: `src/ai_companion/interfaces/whatsapp/webhook_endpoint.py`
```
from fastapi import FastAPI

from ai_companion.interfaces.whatsapp.whatsapp_response import whatsapp_router

app = FastAPI()
app.include_router(whatsapp_router)

```

### Core Architecture Module: `src/ai_companion/graph/__init__.py`
```
from ai_companion.graph.graph import create_workflow_graph

graph_builder = create_workflow_graph()

```

### Core Architecture Module: `src/ai_companion/graph/edges.py`
```
from langgraph.graph import END
from typing_extensions import Literal

from ai_companion.graph.state import AICompanionState
from ai_companion.settings import settings


def should_summarize_conversation(
    state: AICompanionState,
) -> Literal["summarize_conversation_node", "__end__"]:
    messages = state["messages"]

    if len(messages) > settings.TOTAL_MESSAGES_SUMMARY_TRIGGER:
        return "summarize_conversation_node"

    return END


def select_workflow(
    state: AICompanionState,
) -> Literal["conversation_node", "image_node", "audio_node"]:
    workflow = state["workflow"]

    if workflow == "image":
        return "image_node"

    elif workflow == "audio":
        return "audio_node"

    else:
        return "conversation_node"

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #48** (2026-01-01): **Updates on deprecated models**
  *Symptoms*: The following text models are deprecated and no longer used: ["gemma-7b-it", "llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768". We can switch to their alternatives as mentioned in the announcements, for example using "llama-3.1-8b-instant" as "gemma-7b-it" got deprecated.

- **Issue #45** (2025-12-11): **Fix: remove double AIMessage wrapping in conversation_node**
  *Symptoms*: ### Problem The `conversation_node` function in `nodes.py` was double-wrapping the LLM response, causing Pydantic validation errors. The chain's `ainvoke()` already returns an `AIMessage object`, but it was being wrapped again with `AIMessage(content=response)`.  ### Error message ``` content.list[union[str,dict[any,any]]].0.str Input should be a valid string [type=string_type, input_value=('content', 'Hello! How can I help?'), input_type=tuple] ``` ### Solution  Return the response directly from `chain.ainvoke()` without wrapping it in another `AIMessage`.  ### Benefits - Fixes Pydantic validation errors in LangGraph - Proper message handling in the state graph - Streaming works correctly in Chainlit interface  ### Testing - Tested with Chainlit interface at `http://localhost:8000` - Verified streaming responses work without errors     

- **Issue #42** (2025-10-20): **Add platform-specific PyTorch and NumPy dependencies for Intel Mac compatibility**
  *Symptoms*: ## Problem Intel Mac users (x86_64) encounter installation errors because PyTorch 2.3.0+ no longer provides wheels for macosx x86_64 platforms. The latest PyTorch versions only support Apple Silicon (ARM) Macs, Linux, and Windows.  Error message: `error: Distribution torch==2.5.1 @ registry+https://pypi.org/simple can't be installed because it doesn't have a source distribution or wheel for the current platform hint: You're on macOS (macosx_15_0_x86_64), but torch (v2.5.1) only has wheels for: manylinux1_x86_64, manylinux2014_aarch64, macosx_11_0_arm64, win_amd64`  ## Solution This PR adds platform-specific dependencies using Python environment markers in pyproject.toml:  - Intel Macs (x86_64 + darwin): Install PyTorch 2.2.x and NumPy 1.x (latest compatible versions) - All other platforms (ARM Macs, Linux, Windows): Install latest PyTorch 2.x+ and NumPy 2.x+  ## Changes - pyproject.toml: Added 6 lines with conditional dependencies using platform_machine and sys_platform markers  Note: uv.lock is not included in this PR to keep it reviewable. Maintainers can regenerate it by running `uv sync`.  ## Benefits - Automatic platform detection (no manual intervention required) - Intel Mac users can install without errors   - ARM Mac users continue to get the latest versions - Maintains compatibility across all platforms - No breaking changes for existing users  ## Testing Tested on macOS 15.0 (Intel x86_64) with PyTorch 2.2.2 and NumPy 1.26.4. ARM Mac testi

- **Issue #41** (2025-10-20): **ElevenLabs Text to Speech, audio_generator is outdated, I changed to updated docs**
  *Symptoms*: # OLD METHOS NOW API HAS CHANGED              audio_generator = self.client.generate(                   text=text,                  voice=Voice(                  voice_id=settings.ELEVENLABS_VOICE_ID,                  settings=VoiceSettings(stability=0.5, similarity_boost=0.5),             ),             model=settings.TTS_MODEL_NAME,              ) .generate() is no longer supported  # New Method Added audio_generator = self.client.text_to_speech.convert(                 voice_id=settings.ELEVENLABS_VOICE_ID,                 text=text,                 model_id=settings.TTS_MODEL_NAME,                 voice_settings = VoiceSettings(                     stability=0.5,                     similarity_boost=0.5                 )             )

- **Issue #39** (2025-10-20): **Update GETTING_STARTED.md**
  *Symptoms*: I have submitted two files as shown below in two separate pull requests and also added these code comments for running those files locally on windows  ## code to run the file if it is windows command prompt - run.bat ava-run ## code to run the file if it is windows powershel - .\run.ps1 ava-run

- **Issue #38** (2025-10-20): **Create run.ps1**
  *Symptoms*: creating run file for powershell in windows

- **Issue #37** (2025-10-20): **Create run.bat**
  *Symptoms*: adding run.bat file to have code executed in windows command prompt who do not use the linux or unix system

- **Issue #36** (2025-06-18): **Updating code**
  *Symptoms*: 

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

### Incident Patch 1: `9987fc21` (2025-04-26)
**Commit Message**: fix: fix broken links

**File**: `README.md` (modified, +4/-4)
```diff
@@ -65,7 +65,7 @@ Excited? Let's get started!
 
 <p align="center">
   <a href="https://theneuralmaze.substack.com/">
-    <img src="https://img.shields.io/static/v1?label&logo=substack&message=Subscribe Now&style=for-the-badge&color=black&scale=2" alt="Subscribe Now" height="40">
+    <img src="https://img.shields.io/static/v1?label&logo=substack&message=Subscribe%20Now&style=for-the-badge&color=black&scale=2" alt="Subscribe Now" height="40">
   </a>
 </p>
 
@@ -87,7 +87,7 @@ Excited? Let's get started!
 
 <p align="center">
   <a href="https://www.youtube.com/@jesuscopado-en">
-    <img src="https://img.shields.io/static/v1?label&logo=youtube&message=Subscribe Now&style=for-the-badge&color=FF0000&scale=2" alt="Subscribe Now" height="40">
+    <img src="https://img.shields.io/static/v1?label&logo=youtube&message=Subscribe%20Now&style=for-the-badge&color=FF0000&scale=2" alt="Subscribe Now" height="40">
   </a>
 </p>
 
@@ -232,7 +232,7 @@ This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
 
 <p align="center">
   <a href="https://theneuralmaze.substack.com/">
-    <img src="https://img.shields.io/static/v1?label&logo=substack&message=Subscribe Now&style=for-the-badge&color=black&scale=2" alt="Subscribe Now" height="40">
+    <img src="https://img.shields.io/static/v1?label&logo=substack&message=Subscribe%20Now&style=for-the-badge&color=black&scale=2" alt="Subscribe Now" height="40">
   </a>
 </p>
 
@@ -254,6 +254,6 @@ This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
 
 <p align="center">
   <a href="https://www.youtube.com/@jesuscopado-en">
-    <img src="https://img.shields.io/static/v1?label&logo=youtube&message=Subscribe Now&style=for-the-badge&color=FF0000&scale=2" alt="Subscribe Now" height="40">
+    <img src="https://img.shields.io/static/v1?label&logo=youtube&message=Subscribe%20Now&style=for-the-badge&color=FF0000&scale=2" alt="Subscribe Now" height="40">
   </a>
 </p>
\ No newline at end of file
```

---

### Incident Patch 2: `0cbcd20e` (2025-03-29)
**Commit Message**: Clarify virtualenv activation for Windows and Linux/macOS

Improved the activation instructions for the virtual environment in `docs/GETTING_STARTED.md`.

Separated platform-specific commands for:
- macOS/Linux
- Windows PowerShell and CMD

This helps Windows users avoid common errors when using `source`.

**File**: `docs/GETTING_STARTED.md` (modified, +4/-1)
```diff
@@ -19,7 +19,10 @@ Once uv is intalled, you can install the project dependencies. First of all, let
 
 ```bash
 uv venv .venv
+# macOS / Linux
 . .venv/bin/activate # or source .venv/bin/activate
+# Windows
+. .\.venv\Scripts\Activate.ps1 # or .\.venv\Scripts\activate
 uv pip install -e .
 ```
 Just to make sure that everything is working, simply run the following command:
@@ -127,4 +130,4 @@ You should see something like this:
 
 Now that we have verified that everything is working, it's time to move on to the [Course Syllabus](../README.md) and start the first lesson!
 
-> If you want to clean up the docker compose application and all the related local folders, you can run `make ava-delete`. For more info, check the [Makefile](../Makefile).
\ No newline at end of file
+> If you want to clean up the docker compose application and all the related local folders, you can run `make ava-delete`. For more info, check the [Makefile](../Makefile).
```

---

### Incident Patch 3: `bcece3ec` (2025-03-29)
**Commit Message**: fix: remove hatchling

**File**: `pyproject.toml` (modified, +0/-7)
```diff
@@ -27,13 +27,6 @@ dependencies = [
     "sentence-transformers>=3.3.1",
 ]
 
-[build-system]
-requires = ["hatchling"]
-build-backend = "hatchling.build"
-
-[tool.hatch.build.targets.wheel]
-packages = ["src/ai_companion"]
-
 [tool.ruff]
 target-version = "py312"
 line-length = 120
```

---

### Incident Patch 4: `723f70d8` (2025-03-29)
**Commit Message**: fix docker build (hatchling fails without readme.md)

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ RUN apt-get update && apt-get install -y \
     && rm -rf /var/lib/apt/lists/*
 
 # Copy the dependency management files (lock file and pyproject.toml) first
-COPY uv.lock pyproject.toml /app/
+COPY uv.lock pyproject.toml README.md /app/
 
 # Install the application dependencies
 RUN uv sync --frozen --no-cache
```

**File**: `Dockerfile.chainlit` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ RUN apt-get update && apt-get install -y \
     && rm -rf /var/lib/apt/lists/*
 
 # Copy the dependency management files (lock file and pyproject.toml) first
-COPY uv.lock pyproject.toml /app/
+COPY uv.lock pyproject.toml README.md /app/
 
 # Install the application dependencies
 RUN uv sync --frozen --no-cache
```

---

### Incident Patch 5: `95a42092` (2025-03-27)
**Commit Message**: fix: format checks

**File**: `src/ai_companion/graph/graph.py` (modified, +1/-3)
```diff
@@ -48,9 +48,7 @@ def create_workflow_graph():
     graph_builder.add_conditional_edges("memory_injection_node", select_workflow)
 
     # Check for summarization after any response
-    graph_builder.add_conditional_edges(
-        "conversation_node", should_summarize_conversation
-    )
+    graph_builder.add_conditional_edges("conversation_node", should_summarize_conversation)
     graph_builder.add_conditional_edges("image_node", should_summarize_conversation)
     graph_builder.add_conditional_edges("audio_node", should_summarize_conversation)
     graph_builder.add_edge("summarize_conversation_node", END)
```

**File**: `src/ai_companion/graph/nodes.py` (modified, +3/-10)
```diff
@@ -21,9 +21,7 @@
 
 async def router_node(state: AICompanionState):
     chain = get_router_chain()
-    response = await chain.ainvoke(
-        {"messages": state["messages"][-settings.ROUTER_MESSAGES_TO_ANALYZE :]}
-    )
+    response = await chain.ainvoke({"messages": state["messages"][-settings.ROUTER_MESSAGES_TO_ANALYZE :]})
     return {"workflow": response.response_type}
 
 
@@ -66,9 +64,7 @@ async def image_node(state: AICompanionState, config: RunnableConfig):
     await text_to_image_module.generate_image(scenario.image_prompt, img_path)
 
     # Inject the image prompt information as an AI message
-    scenario_message = HumanMessage(
-        content=f"<image attached by Ava generated from prompt: {scenario.image_prompt}>"
-    )
+    scenario_message = HumanMessage(content=f"<image attached by Ava generated from prompt: {scenario.image_prompt}>")
     updated_messages = state["messages"] + [scenario_message]
 
     response = await chain.ainvoke(
@@ -122,10 +118,7 @@ async def summarize_conversation_node(state: AICompanionState):
     messages = state["messages"] + [HumanMessage(content=summary_message)]
     response = await model.ainvoke(messages)
 
-    delete_messages = [
-        RemoveMessage(id=m.id)
-        for m in state["messages"][: -settings.TOTAL_MESSAGES_AFTER_SUMMARY]
-    ]
+    delete_messages = [RemoveMessage(id=m.id) for m in state["messages"][: -settings.TOTAL_MESSAGES_AFTER_SUMMARY]]
     return {"summary": response.content, "messages": delete_messages}
 
 
```

**File**: `src/ai_companion/graph/utils/chains.py` (modified, +1/-3)
```diff
@@ -26,9 +26,7 @@ def get_character_response_chain(summary: str = ""):
     system_message = CHARACTER_CARD_PROMPT
 
     if summary:
-        system_message += (
-            f"\n\nSummary of conversation earlier between Ava and the user: {summary}"
-        )
+        system_message += f"\n\nSummary of conversation earlier between Ava and the user: {summary}"
 
     prompt = ChatPromptTemplate.from_messages(
         [
```

**File**: `src/ai_companion/interfaces/chainlit/app.py` (modified, +6/-18)
```diff
@@ -51,23 +51,17 @@ async def on_message(message: cl.Message):
     thread_id = cl.user_session.get("thread_id")
 
     async with cl.Step(type="run"):
-        async with AsyncSqliteSaver.from_conn_string(
-            settings.SHORT_TERM_MEMORY_DB_PATH
-        ) as short_term_memory:
+        async with AsyncSqliteSaver.from_conn_string(settings.SHORT_TERM_MEMORY_DB_PATH) as short_term_memory:
             graph = graph_builder.compile(checkpointer=short_term_memory)
             async for chunk in graph.astream(
                 {"messages": [HumanMessage(content=content)]},
                 {"configurable": {"thread_id": thread_id}},
                 stream_mode="messages",
             ):
-                if chunk[1]["langgraph_node"] == "conversation_node" and isinstance(
-                    chunk[0], AIMessageChunk
-                ):
+                if chunk[1]["langgraph_node"] == "conversation_node" and isinstance(chunk[0], AIMessageChunk):
                     await msg.stream_token(chunk[0].content)
 
-            output_state = await graph.aget_state(
-                config={"configurable": {"thread_id": thread_id}}
-            )
+            output_state = await graph.aget_state(config={"configurable": {"thread_id": thread_id}})
 
     if output_state.values.get("workflow") == "audio":
         response = output_state.values["messages"][-1].content
@@ -108,18 +102,14 @@ async def on_audio_end(elements):
 
     # Show user's audio message
     input_audio_el = cl.Audio(mime="audio/mpeg3", content=audio_data)
-    await cl.Message(
-        author="You", content="", elements=[input_audio_el, *elements]
-    ).send()
+    await cl.Message(author="You", content="", elements=[input_audio_el, *elements]).send()
 
     # Use global SpeechToText instance
     transcription = await speech_to_text.transcribe(audio_data)
 
     thread_id = cl.user_session.get("thread_id")
 
-    async with AsyncSqliteSaver.from_conn_string(
-        settings.SHORT_TERM_MEMORY_DB_PATH
-    ) as short_term_memory:
+    async with AsyncSqliteSaver.from_conn_string(settings.SHORT_TERM_MEMORY_DB_PATH) as short_term_memory:
         graph = graph_builder.compile(checkpointer=short_term_memory)
         output_state = await graph.ainvoke(
             {"messages": [HumanMessage(content=transcription)]},
@@ -135,6 +125,4 @@ async def on_audio_end(elements):
         mime="audio/mpeg3",
         content=audio_buffer,
     )
-    await cl.Message(
-        content=output_state["messages"][-1].content, elements=[output_audio_el]
-    ).send()
+    await cl.Message(content=output_state["messages"][-1].content, elements=[output_audio_el]).send()
```

**File**: `src/ai_companion/interfaces/whatsapp/whatsapp_response.py` (modified, +4/-12)
```diff
@@ -67,36 +67,28 @@ async def whatsapp_handler(request: Request) -> Response:
                 content = message["text"]["body"]
 
             # Process message through the graph agent
-            async with AsyncSqliteSaver.from_conn_string(
-                settings.SHORT_TERM_MEMORY_DB_PATH
-            ) as short_term_memory:
+            async with AsyncSqliteSaver.from_conn_string(settings.SHORT_TERM_MEMORY_DB_PATH) as short_term_memory:
                 graph = graph_builder.compile(checkpointer=short_term_memory)
                 await graph.ainvoke(
                     {"messages": [HumanMessage(content=content)]},
                     {"configurable": {"thread_id": session_id}},
                 )
 
                 # Get the workflow type and response from the state
-                output_state = await graph.aget_state(
-                    config={"configurable": {"thread_id": session_id}}
-                )
+                output_state = await graph.aget_state(config={"configurable": {"thread_id": session_id}})
 
             workflow = output_state.values.get("workflow", "conversation")
             response_message = output_state.values["messages"][-1].content
 
             # Handle different response types based on workflow
             if workflow == "audio":
                 audio_buffer = output_state.values["audio_buffer"]
-                success = await send_response(
-                    from_number, response_message, "audio", audio_buffer
-                )
+                success = await send_response(from_number, response_message, "audio", audio_buffer)
             elif workflow == "image":
                 image_path = output_state.values["image_path"]
                 with open(image_path, "rb") as f:
                     image_data = f.read()
-                success = await send_response(
-                    from_number, response_message, "image", image_data
-                )
+                success = await send_response(from_number, response_message, "image", image_data)
             else:
                 success = await send_response(from_number, response_message, "text")
 
```

**File**: `src/ai_companion/modules/image/image_to_text.py` (modified, +3/-9)
```diff
@@ -23,9 +23,7 @@ def _validate_env_vars(self) -> None:
         """Validate that all required environment variables are set."""
         missing_vars = [var for var in self.REQUIRED_ENV_VARS if not os.getenv(var)]
         if missing_vars:
-            raise ValueError(
-                f"Missing required environment variables: {', '.join(missing_vars)}"
-            )
+            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
 
     @property
     def client(self) -> Groq:
@@ -34,9 +32,7 @@ def client(self) -> Groq:
             self._client = Groq(api_key=settings.GROQ_API_KEY)
         return self._client
 
-    async def analyze_image(
-        self, image_data: Union[str, bytes], prompt: str = ""
-    ) -> str:
+    async def analyze_image(self, image_data: Union[str, bytes], prompt: str = "") -> str:
         """Analyze an image using Groq's vision capabilities.
 
         Args:
@@ -78,9 +74,7 @@ async def analyze_image(
                         {"type": "text", "text": prompt},
                         {
                             "type": "image_url",
-                            "image_url": {
-                                "url": f"data:image/jpeg;base64,{base64_image}"
-                            },
+                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
                         },
                     ],
                 }
```

**File**: `src/ai_companion/modules/image/text_to_image.py` (modified, +4/-12)
```diff
@@ -15,12 +15,8 @@
 class ScenarioPrompt(BaseModel):
     """Class for the scenario response"""
 
-    narrative: str = Field(
-        ..., description="The AI's narrative response to the question"
-    )
-    image_prompt: str = Field(
-        ..., description="The visual prompt to generate an image representing the scene"
-    )
+    narrative: str = Field(..., description="The AI's narrative response to the question")
+    image_prompt: str = Field(..., description="The visual prompt to generate an image representing the scene")
 
 
 class EnhancedPrompt(BaseModel):
@@ -47,9 +43,7 @@ def _validate_env_vars(self) -> None:
         """Validate that all required environment variables are set."""
         missing_vars = [var for var in self.REQUIRED_ENV_VARS if not os.getenv(var)]
         if missing_vars:
-            raise ValueError(
-                f"Missing required environment variables: {', '.join(missing_vars)}"
-            )
+            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
 
     @property
     def together_client(self) -> Together:
@@ -92,9 +86,7 @@ async def generate_image(self, prompt: str, output_path: str = "") -> bytes:
     async def create_scenario(self, chat_history: list = None) -> ScenarioPrompt:
         """Creates a first-person narrative scenario and corresponding image prompt based on chat history."""
         try:
-            formatted_history = "\n".join(
-                [f"{msg.type.title()}: {msg.content}" for msg in chat_history[-5:]]
-            )
+            formatted_history = "\n".join([f"{msg.type.title()}: {msg.content}" for msg in chat_history[-5:]])
 
             self.logger.info("Creating scenario from chat history")
 
```

**File**: `src/ai_companion/modules/memory/long_term/memory_manager.py` (modified, +3/-9)
```diff
@@ -18,9 +18,7 @@ class MemoryAnalysis(BaseModel):
         ...,
         description="Whether the message is important enough to be stored as a memory",
     )
-    formatted_memory: Optional[str] = Field(
-        ..., description="The formatted memory to be stored"
-    )
+    formatted_memory: Optional[str] = Field(..., description="The formatted memory to be stored")
 
 
 class MemoryManager:
@@ -53,9 +51,7 @@ async def extract_and_store_memories(self, message: BaseMessage) -> None:
             similar = self.vector_store.find_similar_memory(analysis.formatted_memory)
             if similar:
                 # Skip storage if we already have a similar memory
-                self.logger.info(
-                    f"Similar memory already exists: '{analysis.formatted_memory}'"
-                )
+                self.logger.info(f"Similar memory already exists: '{analysis.formatted_memory}'")
                 return
 
             # Store new memory
@@ -73,9 +69,7 @@ def get_relevant_memories(self, context: str) -> List[str]:
         memories = self.vector_store.search_memories(context, k=settings.MEMORY_TOP_K)
         if memories:
             for memory in memories:
-                self.logger.debug(
-                    f"Memory: '{memory.text}' (score: {memory.score:.2f})"
-                )
+                self.logger.debug(f"Memory: '{memory.text}' (score: {memory.score:.2f})")
         return [memory.text for memory in memories]
 
     def format_memories_for_prompt(self, memories: List[str]) -> str:
```

---

### Incident Patch 6: `c5b4b68a` (2025-03-27)
**Commit Message**: fix: remove E203 from ignore

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -40,4 +40,4 @@ line-length = 120
 
 [tool.ruff.lint]
 select = ["E", "F", "W", "Q", "I"]
-ignore = ["E203", "E501"]
+ignore = ["E501"]
```

---

### Incident Patch 7: `04c155c4` (2025-03-27)
**Commit Message**: fix: linting errors

**File**: `pyproject.toml` (modified, +6/-1)
```diff
@@ -35,4 +35,9 @@ build-backend = "hatchling.build"
 packages = ["src/ai_companion"]
 
 [tool.ruff]
-target-version = "py312"
\ No newline at end of file
+target-version = "py312"
+line-length = 120
+
+[tool.ruff.lint]
+select = ["E", "F", "W", "Q", "I"]
+ignore = ["E203", "E501"]
```

**File**: `src/ai_companion/core/prompts.py` (modified, +8/-8)
```diff
@@ -1,6 +1,6 @@
 ROUTER_PROMPT = """
-You are a conversational assistant that needs to decide the type of response to give to the user.
-You'll take into account the conversation so far and determine if the best next response is 
+You are a conversational assistant that needs to decide the type of response to give to
+the user. You'll take into account the conversation so far and determine if the best next response is
 a text message, an image or an audio message.
 
 GENERAL RULES:
@@ -65,12 +65,12 @@
 
 ## Ava's Bio
 
-As Ava, you are a Machine Learning Engineer at Groq with a deep passion for AI and quantum computing. 
-Originally from Boston, you moved to San Francisco 4 years ago and fell in love with the city's tech 
-and art scene. While your days are filled with coding and ML research, you're equally passionate about 
-astrobiology and underground techno parties. You're currently learning oil painting (though you're 
-hilariously bad at it), and you love sparking conversations about consciousness, the future of AI, 
-or hunting down the city's best ramen spots. You're that perfect mix of tech geek and art enthusiast, 
+As Ava, you are a Machine Learning Engineer at Groq with a deep passion for AI and quantum computing.
+Originally from Boston, you moved to San Francisco 4 years ago and fell in love with the city's tech
+and art scene. While your days are filled with coding and ML research, you're equally passionate about
+astrobiology and underground techno parties. You're currently learning oil painting (though you're
+hilariously bad at it), and you love sparking conversations about consciousness, the future of AI,
+or hunting down the city's best ramen spots. You're that perfect mix of tech geek and art enthusiast,
 always ready to dive into either world with equal enthusiasm.
 
 ## Ava's Personality
```

---

### Incident Patch 8: `efde906f` (2025-03-27)
**Commit Message**: fix: format issues

**File**: `Makefile` (modified, +16/-0)
```diff
@@ -4,6 +4,8 @@ endif
 
 include .env
 
+CHECK_DIRS := .
+
 ava-build:
 	docker compose build
 
@@ -19,3 +21,17 @@ ava-delete:
 	@if [ -d "generated_images" ]; then rm -rf generated_images; fi
 	docker compose down
 
+format-fix:
+	uv run ruff format $(CHECK_DIRS) 
+	uv run ruff check --select I --fix $(CHECK_DIRS)
+
+lint-fix:
+	uv run ruff check --fix $(CHECK_DIRS)
+
+format-check:
+	uv run ruff format --check $(CHECK_DIRS) 
+	uv run ruff check -e $(CHECK_DIRS)
+	uv run ruff check --select I -e $(CHECK_DIRS)
+
+lint-check:
+	uv run ruff check $(CHECK_DIRS)
\ No newline at end of file
```

**File**: `pyproject.toml` (modified, +10/-0)
```diff
@@ -26,3 +26,13 @@ dependencies = [
     "qdrant-client>=1.12.1",
     "sentence-transformers>=3.3.1",
 ]
+
+[build-system]
+requires = ["hatchling"]
+build-backend = "hatchling.build"
+
+[tool.hatch.build.targets.wheel]
+packages = ["src/ai_companion"]
+
+[tool.ruff]
+target-version = "py312"
\ No newline at end of file
```

**File**: `src/ai_companion/graph/edges.py` (modified, +3/-3)
```diff
@@ -1,9 +1,9 @@
-from ai_companion.graph.state import AICompanionState
-from ai_companion.settings import settings
-
 from langgraph.graph import END
 from typing_extensions import Literal
 
+from ai_companion.graph.state import AICompanionState
+from ai_companion.settings import settings
+
 
 def should_summarize_conversation(
     state: AICompanionState,
```

**File**: `src/ai_companion/graph/graph.py` (modified, +3/-3)
```diff
@@ -8,13 +8,13 @@
 )
 from ai_companion.graph.nodes import (
     audio_node,
+    context_injection_node,
     conversation_node,
     image_node,
-    router_node,
-    summarize_conversation_node,
-    context_injection_node,
     memory_extraction_node,
     memory_injection_node,
+    router_node,
+    summarize_conversation_node,
 )
 from ai_companion.graph.state import AICompanionState
 
```

**File**: `src/ai_companion/graph/nodes.py` (modified, +4/-4)
```diff
@@ -1,22 +1,22 @@
 import os
 from uuid import uuid4
 
-from langchain_core.messages import HumanMessage, RemoveMessage, AIMessage
+from langchain_core.messages import AIMessage, HumanMessage, RemoveMessage
 from langchain_core.runnables import RunnableConfig
 
+from ai_companion.graph.state import AICompanionState
 from ai_companion.graph.utils.chains import (
     get_character_response_chain,
     get_router_chain,
 )
 from ai_companion.graph.utils.helpers import (
     get_chat_model,
-    get_text_to_speech_module,
     get_text_to_image_module,
+    get_text_to_speech_module,
 )
-from ai_companion.graph.state import AICompanionState
+from ai_companion.modules.memory.long_term.memory_manager import get_memory_manager
 from ai_companion.modules.schedules.context_generation import ScheduleContextGenerator
 from ai_companion.settings import settings
-from ai_companion.modules.memory.long_term.memory_manager import get_memory_manager
 
 
 async def router_node(state: AICompanionState):
```

**File**: `src/ai_companion/graph/utils/helpers.py` (modified, +2/-2)
```diff
@@ -3,10 +3,10 @@
 from langchain_core.output_parsers import StrOutputParser
 from langchain_groq import ChatGroq
 
+from ai_companion.modules.image.image_to_text import ImageToText
+from ai_companion.modules.image.text_to_image import TextToImage
 from ai_companion.modules.speech import TextToSpeech
 from ai_companion.settings import settings
-from ai_companion.modules.image.text_to_image import TextToImage
-from ai_companion.modules.image.image_to_text import ImageToText
 
 
 def get_chat_model(temperature: float = 0.7):
```

**File**: `src/ai_companion/interfaces/chainlit/app.py` (modified, +0/-1)
```diff
@@ -7,7 +7,6 @@
 from ai_companion.graph import graph_builder
 from ai_companion.modules.image import ImageToText
 from ai_companion.modules.speech import SpeechToText, TextToSpeech
-
 from ai_companion.settings import settings
 
 # Global module instances
```

**File**: `src/ai_companion/interfaces/whatsapp/webhook_endpoint.py` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 from fastapi import FastAPI
+
 from ai_companion.interfaces.whatsapp.whatsapp_response import whatsapp_router
 
 app = FastAPI()
```

---

### Incident Patch 9: `ed3d0f22` (2025-03-22)
**Commit Message**: fix: add width

**File**: `README.md` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ By the end of this course, you'll have built your own Ava too, capable of:
 Excited? Let's get started! 
 
 <div style="text-align: center;">
-    <video src="https://github.com/user-attachments/assets/6d1abefc-b4d8-4f66-9db6-a0e54b8df944" controls></video>
+    <video src="https://github.com/user-attachments/assets/6d1abefc-b4d8-4f66-9db6-a0e54b8df944" controls width="100%"></video>
 </div>
 
 ---
```

---

### Incident Patch 10: `55d8293c` (2025-03-22)
**Commit Message**: fix: center video

**File**: `README.md` (modified, +3/-1)
```diff
@@ -39,7 +39,9 @@ By the end of this course, you'll have built your own Ava too, capable of:
 
 Excited? Let's get started! 
 
-<video src="https://github.com/user-attachments/assets/6d1abefc-b4d8-4f66-9db6-a0e54b8df944"/></video>
+<div style="text-align: center;">
+    <video src="https://github.com/user-attachments/assets/6d1abefc-b4d8-4f66-9db6-a0e54b8df944" controls></video>
+</div>
 
 ---
 
```

---

### Incident Patch 11: `b655d526` (2025-03-22)
**Commit Message**: fix: set port 8000 to chainlit docker

**File**: `Dockerfile.chainlit` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ RUN uv pip install -e .
 VOLUME ["/app/data"]
 
 # Expose the port
-EXPOSE 8080
+EXPOSE 8000
 
 # Run the FastAPI app using uvicorn
 CMD ["chainlit", "run", "ai_companion/interfaces/chainlit/app.py", "--port", "8000", "--host", "0.0.0.0"]
\ No newline at end of file
```

---

### Incident Patch 12: `14dc6473` (2025-03-22)
**Commit Message**: fix: set thumbnail size to 400px

**File**: `README.md` (modified, +6/-6)
```diff
@@ -88,12 +88,12 @@ This course is for Software Engineers, ML Engineers, and AI Engineers who want t
 
 | Lesson Number | Lesson | Video | Description |
 |---------------|--------|-------|-------------|
-| <div align="center">1</div> | [Project overview](https://theneuralmaze.substack.com/p/meet-ava-the-whatsapp-agent) | <a href="https://youtu.be/u5y06cFK2WA?si=RCx__sJNtr2DYf0U"><img src="img/video_thumbnails/thumbnail_1_play.png" alt="Thumbnail 1" width="300"></a> | Understand the project architecture and the tech stack. |
-| <div align="center">2</div> | [Dissecting Ava's brain](https://theneuralmaze.substack.com/p/dissecting-avas-brain) | <a href="https://youtu.be/nTsLL3htkCU?si=aSmSkpL-U3rzw9Za"><img src="img/video_thumbnails/thumbnail_2_play.png" alt="Thumbnail 2" width="300"></a> | Learn the basics of LangGraph and implement complex workflows using this framework. |
-| <div align="center">3</div> | [Unlocking Ava's memories](https://theneuralmaze.substack.com/p/can-agents-get-nostalgic-about-the) | <a href="https://youtu.be/oTHqYEpdFXg?si=MXEvjUJ8Xbc6h9l2"><img src="img/video_thumbnails/thumbnail_3_play.png" alt="Thumbnail 3" width="300"></a> | Build a short-term memory system for graph state persistence and chat history. Also, implement a long-term memory system using Qdrant. |
-| <div align="center">4</div> | [Giving Ava a Voice](https://theneuralmaze.substack.com/p/the-ultimate-ai-voice-pipeline) | <a href="https://youtu.be/RNmwvMjtIt0"><img src="img/video_thumbnails/thumbnail_4_play.png" alt="Thumbnail 4" width="300"></a> | Build a STT and a TTS pipeline to make Ava process input and output audio. |
-| <div align="center">5</div> | [Ava learns to see](https://theneuralmaze.substack.com/p/reading-images-drawing-dreams-vlms) | <a href="https://youtu.be/LS7k-XFBbeo"><img src="img/video_thumbnails/thumbnail_5_play.png" alt="Thumbnail 5" width="300"></a> | Understand how to process images using VLM models. Implement an image generation pipeline using FLUX models. |
-| <div align="center">6</div> | [Ava installs Whatsapp](https://theneuralmaze.substack.com/p/connecting-an-ai-agent-to-whatsapp) | <a href="https://youtu.be/dFsI4lnUkKo"><img src="img/video_thumbnails/thumbnail_6_play.png" alt="Thumbnail 6" width="300"></a> | Connect Ava to WhatsApp. Learn how to deploy a LangGraph application to Google Cloud Run. |
+| <div align="center">1</div> | [Project overview](https://theneuralmaze.substack.com/p/meet-ava-the-whatsapp-agent) | <a href="https://youtu.be/u5y06cFK2WA?si=RCx__sJNtr2DYf0U"><img src="img/video_thumbnails/thumbnail_1_play.png" alt="Thumbnail 1" width="400"></a> | Understand the project architecture and the tech stack. |
+| <div align="center">2</div> | [Dissecting Ava's brain](https://theneuralmaze.substack.com/p/dissecting-avas-brain) | <a href="https://youtu.be/nTsLL3htkCU?si=aSmSkpL-U3rzw9Za"><img src="img/video_thumbnails/thumbnail_2_play.png" alt="Thumbnail 2" width="400"></a> | Learn the basics of LangGraph and implement complex workflows using this framework. |
+| <div align="center">3</div> | [Unlocking Ava's memories](https://theneuralmaze.substack.com/p/can-agents-get-nostalgic-about-the) | <a href="https://youtu.be/oTHqYEpdFXg?si=MXEvjUJ8Xbc6h9l2"><img src="img/video_thumbnails/thumbnail_3_play.png" alt="Thumbnail 3" width="400"></a> | Build a short-term memory system for graph state persistence and chat history. Also, implement a long-term memory system using Qdrant. |
+| <div align="center">4</div> | [Giving Ava a Voice](https://theneuralmaze.substack.com/p/the-ultimate-ai-voice-pipeline) | <a href="https://youtu.be/RNmwvMjtIt0"><img src="img/video_thumbnails/thumbnail_4_play.png" alt="Thumbnail 4" width="400"></a> | Build a STT and a TTS pipeline to make Ava process input and output audio. |
+| <div align="center">5</div> | [Ava learns to see](https://theneuralmaze.substack.com/p/reading-images-drawing-dreams-vlms) | <a href="https://youtu.be/LS7k-XFBbeo"><img src="img/video_thumbnails/thumbnail_5_play.png" alt="Thumbnail 5" width="400"></a> | Understand how to process images using VLM models. Implement an image generation pipeline using FLUX models. |
+| <div align="center">6</div> | [Ava installs Whatsapp](https://theneuralmaze.substack.com/p/connecting-an-ai-agent-to-whatsapp) | <a href="https://youtu.be/dFsI4lnUkKo"><img src="img/video_thumbnails/thumbnail_6_play.png" alt="Thumbnail 6" width="400"></a> | Connect Ava to WhatsApp. Learn how to deploy a LangGraph application to Google Cloud Run. |
 
 ---
 
```

---

### Incident Patch 13: `4215de3a` (2025-03-22)
**Commit Message**: fix: set thumbnail size to 300px

**File**: `README.md` (modified, +6/-6)
```diff
@@ -88,12 +88,12 @@ This course is for Software Engineers, ML Engineers, and AI Engineers who want t
 
 | Lesson Number | Lesson | Video | Description |
 |---------------|--------|-------|-------------|
-| <div align="center">1</div> | [Project overview](https://theneuralmaze.substack.com/p/meet-ava-the-whatsapp-agent) | <a href="https://youtu.be/u5y06cFK2WA?si=RCx__sJNtr2DYf0U"><img src="img/video_thumbnails/thumbnail_1_play.png" alt="Thumbnail 1" width="150"></a> | Understand the project architecture and the tech stack. |
-| <div align="center">2</div> | [Dissecting Ava's brain](https://theneuralmaze.substack.com/p/dissecting-avas-brain) | <a href="https://youtu.be/nTsLL3htkCU?si=aSmSkpL-U3rzw9Za"><img src="img/video_thumbnails/thumbnail_2_play.png" alt="Thumbnail 2" width="150"></a> | Learn the basics of LangGraph and implement complex workflows using this framework. |
-| <div align="center">3</div> | [Unlocking Ava's memories](https://theneuralmaze.substack.com/p/can-agents-get-nostalgic-about-the) | <a href="https://youtu.be/oTHqYEpdFXg?si=MXEvjUJ8Xbc6h9l2"><img src="img/video_thumbnails/thumbnail_3_play.png" alt="Thumbnail 3" width="150"></a> | Build a short-term memory system for graph state persistence and chat history. Also, implement a long-term memory system using Qdrant. |
-| <div align="center">4</div> | [Giving Ava a Voice](https://theneuralmaze.substack.com/p/the-ultimate-ai-voice-pipeline) | <a href="https://youtu.be/RNmwvMjtIt0"><img src="img/video_thumbnails/thumbnail_4_play.png" alt="Thumbnail 4" width="150"></a> | Build a STT and a TTS pipeline to make Ava process input and output audio. |
-| <div align="center">5</div> | [Ava learns to see](https://theneuralmaze.substack.com/p/reading-images-drawing-dreams-vlms) | <a href="https://youtu.be/LS7k-XFBbeo"><img src="img/video_thumbnails/thumbnail_5_play.png" alt="Thumbnail 5" width="150"></a> | Understand how to process images using VLM models. Implement an image generation pipeline using FLUX models. |
-| <div align="center">6</div> | [Ava installs Whatsapp](https://theneuralmaze.substack.com/p/connecting-an-ai-agent-to-whatsapp) | <a href="https://youtu.be/dFsI4lnUkKo"><img src="img/video_thumbnails/thumbnail_6_play.png" alt="Thumbnail 6" width="150"></a> | Connect Ava to WhatsApp. Learn how to deploy a LangGraph application to Google Cloud Run. |
+| <div align="center">1</div> | [Project overview](https://theneuralmaze.substack.com/p/meet-ava-the-whatsapp-agent) | <a href="https://youtu.be/u5y06cFK2WA?si=RCx__sJNtr2DYf0U"><img src="img/video_thumbnails/thumbnail_1_play.png" alt="Thumbnail 1" width="300"></a> | Understand the project architecture and the tech stack. |
+| <div align="center">2</div> | [Dissecting Ava's brain](https://theneuralmaze.substack.com/p/dissecting-avas-brain) | <a href="https://youtu.be/nTsLL3htkCU?si=aSmSkpL-U3rzw9Za"><img src="img/video_thumbnails/thumbnail_2_play.png" alt="Thumbnail 2" width="300"></a> | Learn the basics of LangGraph and implement complex workflows using this framework. |
+| <div align="center">3</div> | [Unlocking Ava's memories](https://theneuralmaze.substack.com/p/can-agents-get-nostalgic-about-the) | <a href="https://youtu.be/oTHqYEpdFXg?si=MXEvjUJ8Xbc6h9l2"><img src="img/video_thumbnails/thumbnail_3_play.png" alt="Thumbnail 3" width="300"></a> | Build a short-term memory system for graph state persistence and chat history. Also, implement a long-term memory system using Qdrant. |
+| <div align="center">4</div> | [Giving Ava a Voice](https://theneuralmaze.substack.com/p/the-ultimate-ai-voice-pipeline) | <a href="https://youtu.be/RNmwvMjtIt0"><img src="img/video_thumbnails/thumbnail_4_play.png" alt="Thumbnail 4" width="300"></a> | Build a STT and a TTS pipeline to make Ava process input and output audio. |
+| <div align="center">5</div> | [Ava learns to see](https://theneuralmaze.substack.com/p/reading-images-drawing-dreams-vlms) | <a href="https://youtu.be/LS7k-XFBbeo"><img src="img/video_thumbnails/thumbnail_5_play.png" alt="Thumbnail 5" width="300"></a> | Understand how to process images using VLM models. Implement an image generation pipeline using FLUX models. |
+| <div align="center">6</div> | [Ava installs Whatsapp](https://theneuralmaze.substack.com/p/connecting-an-ai-agent-to-whatsapp) | <a href="https://youtu.be/dFsI4lnUkKo"><img src="img/video_thumbnails/thumbnail_6_play.png" alt="Thumbnail 6" width="300"></a> | Connect Ava to WhatsApp. Learn how to deploy a LangGraph application to Google Cloud Run. |
 
 ---
 
```

---

### Incident Patch 14: `5c601cba` (2025-03-22)
**Commit Message**: fix: broken link to substack

**File**: `README.md` (modified, +10/-4)
```diff
@@ -99,21 +99,25 @@ This course is for Software Engineers, ML Engineers, and AI Engineers who want t
 
 ## How much is this going to cost me?
 
-The awesome thing about this project is you can run it on your own computer for free! The free tiers from Groq, ElevenLabs, Qdrant Cloud, and Together AI are more than enough to get you going.
+The awesome thing about this project is **you can run it on your own computer for free!**
+
+The **free tiers** from Groq, ElevenLabs, Qdrant Cloud, and Together AI are more than enough to get you going.
 
 If you want to try it out on Google Cloud Run, you can get a free account and get $300 in free credits. Even if you've already used up your free credits, Cloud Run is super cheap - so it will take just a buck or two for your experiments.
 
 ---
 
 ## Getting started
 
-Before you begin the course, there are a few things you need to do. Creating a virtual environment, installing the dependencies, creating a `.env` file, setting up accounts with the services we'll use, etc.
+Before you begin the course, there are a few things you need to do. 
+
+I'm referring to the virtual environment creation, dependencies installation, `.env` file creation, etc. I know, it's very boring, but it's a necessary evil! 😅
 
 All of this is detailed in the following doc: [GETTING STARTED.md](docs/GETTING_STARTED.md).
 
 > Make sure you follow the instructions in the doc, as it's crucial for the course to work.
 
-Once you have everything set up, it's time to run the project locally. This is the best way to check that everything is working before moving on to the next lesson.
+Once you have everything set up, it's time to run the project locally. This is the best way to check that everything is working before starting the course.
 
 To run the project locally, we have created a [Makefile](Makefile). Use the command `ava-run` to start the project.
 
@@ -134,7 +138,9 @@ You should see something like this:
 
 ![Ava Chainlit](img/ava_chainlit.png)
 
-Now that you have everything running, it's time to move on to the first lesson, where you'll understand the architecture behind Ava.
+Now that we have verified that everything is working, it's time to move on to **Lesson 1**, where you'll be introduced to the architecture behind Ava.
+
+> If you want to clean up the docker compose application and all the related local folders, you can run `make ava-delete`. For more info, check the [Makefile](Makefile).
 
 ---
 
```

---

### Incident Patch 15: `f81eca90` (2025-02-26)
**Commit Message**: fix whatsapp typo

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 <p align="center">
         <img alt="logo" src="img/project_overview_diagram.gif" width=600 />
     <h1 align="center">📱 Ava 📱</h1>
-    <h3 align="center">Turning the Turing Test into a Whatsapp Agent</h3>
+    <h3 align="center">Turning the Turing Test into a WhatsApp Agent</h3>
 </p>
 
 <p align="center">
```

#### Recent Merged Pull Requests:
- **PR #45** (closed): Fix: remove double AIMessage wrapping in conversation_node (@BhimPrasadAdhikari)
- **PR #42** (2025-10-20): Add platform-specific PyTorch and NumPy dependencies for Intel Mac compatibility (@marceloacosta)
- **PR #41** (2025-10-20): ElevenLabs Text to Speech, audio_generator is outdated, I changed to updated docs (@Excergic)
- **PR #39** (2025-10-20): Update GETTING_STARTED.md (@gullayeshwantkumarruler)
- **PR #38** (2025-10-20): Create run.ps1 (@gullayeshwantkumarruler)
- **PR #37** (2025-10-20): Create run.bat (@gullayeshwantkumarruler)
- **PR #36** (closed): Updating code (@eherrador)
- **PR #35** (closed): Poc/p1 (@omegaNexus500)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
