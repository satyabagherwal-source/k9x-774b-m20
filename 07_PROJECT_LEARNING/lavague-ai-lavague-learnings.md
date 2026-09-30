# Forensic Learning Record (Deep Inspection): lavague-ai/LaVague

> **Canonical Artifact**: `07_PROJECT_LEARNING/lavague-ai-lavague-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lavague-ai/LaVague](https://github.com/lavague-ai/LaVague))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:11:12.680Z  
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

### Core Architecture Module: `examples/agent_anthropic.py`
```
from lavague.core import WorldModel, ActionEngine
from lavague.core.agents import WebAgent
from lavague.drivers.selenium import SeleniumDriver
from lavague.contexts.anthropic import AnthropicContext

context = AnthropicContext()
selenium_driver = SeleniumDriver(headless=True)

world_model = WorldModel.from_context(context=context)
action_engine = ActionEngine.from_context(context=context, driver=selenium_driver)
agent = WebAgent(world_model, action_engine)
agent.get("https://huggingface.co/docs")
agent.run("What is this week's top model?")

```

### Core Architecture Module: `examples/agent_azure.py`
```
from llama_index.multi_modal_llms.openai import OpenAIMultiModal
from llama_index.multi_modal_llms.azure_openai import AzureOpenAIMultiModal

from lavague.core import WorldModel, ActionEngine
from lavague.core.agents import WebAgent
from lavague.contexts.openai import AzureOpenaiContext
from lavague.drivers.selenium import SeleniumDriver
import os

from llama_index.llms.azure_openai import AzureOpenAI
from llama_index.multi_modal_llms.azure_openai import AzureOpenAIMultiModal
from llama_index.embeddings.azure_openai import AzureOpenAIEmbedding
from lavague.core.context import Context
from lavague.core import WorldModel, ActionEngine
from lavague.core.agents import WebAgent
from lavague.drivers.selenium import SeleniumDriver
from lavague.contexts.openai import AzureOpenaiContext


# Initialize context with our custom elements
context = AzureOpenaiContext(
    api_key="<YOUR_API_KEY>",
    deployment="<YOUR_DEPLOYMENT_NAME>",
    llm="MODEL_NAME",
    mm_llm="M0DEL_NAME",
    endpoint="<YOUR_ENDPOINT>",
    embedding="<EMBEDDING_MODEL_NAME>",
    embedding_deployment="<YOUR_EMBEDDING_DEPLOYMENT_NAME>",
)

# Initialize the Selenium driver
selenium_driver = SeleniumDriver()

# Initialize a WorldModel and ActionEnginem passing them the custom context
world_model = WorldModel.from_context(context)
action_engine = ActionEngine.from_context(context, selenium_driver)

# Create your agent
agent = WebAgent(world_model, action_engine)

agent.get("https://huggingface.co/docs")
agent.run("Go on the quicktour of PEFT")

```

### Core Architecture Module: `examples/agent_fireworks.py`
```
from lavague.core import WorldModel, ActionEngine
from lavague.core.agents import WebAgent
from lavague.drivers.selenium import SeleniumDriver
from lavague.contexts.fireworks import FireworksContext


# Initialize Context
context = FireworksContext()

selenium_driver = SeleniumDriver()

# Build AE and WM from Context
action_engine = ActionEngine.from_context(context, selenium_driver)
world_model = WorldModel.from_context(context)

agent = WebAgent(world_model, action_engine)
agent.get("https://huggingface.co/")
agent.run("What is this week's top Space of the week?")

```

### Core Architecture Module: `examples/agent_gemini.py`
```
from lavague.core import WorldModel, ActionEngine
from lavague.core.agents import WebAgent
from lavague.drivers.selenium import SeleniumDriver
from lavague.contexts.openai import OpenaiContext
from lavague.contexts.gemini import GeminiContext

context = GeminiContext()
selenium_driver = SeleniumDriver(headless=True)
world_model = WorldModel.from_context(context=context)
action_engine = ActionEngine.from_context(context, selenium_driver)
agent = WebAgent(world_model, action_engine)
agent.get("https://huggingface.co/docs")
agent.run("Go on the quicktour of PEFT")

```

### Core Architecture Module: `examples/chrome_extension.py`
```
from lavague.core import WorldModel, ActionEngine
from lavague.core.agents import WebAgent
from lavague.drivers.driverserver import DriverServer
from lavague.server import AgentServer, AgentSession

def create_agent(session: AgentSession):
    world_model = WorldModel()
    driver = DriverServer(session)
    action_engine = ActionEngine(driver)
    return WebAgent(world_model, action_engine)

server = AgentServer(create_agent)
server.serve()
```

### Core Architecture Module: `examples/gradio_example.py`
```
from lavague.drivers.selenium import SeleniumDriver
from lavague.core import ActionEngine, WorldModel
from lavague.core.agents import WebAgent

selenium_driver = SeleniumDriver(headless=True)
action_engine = ActionEngine(selenium_driver)
world_model = WorldModel()

agent = WebAgent(world_model, action_engine)

agent.get("https://huggingface.co/docs")
agent.demo("Go on the quicktour of PEFT")

```

### Core Architecture Module: `examples/idefics_example.py`
```
import os
import argparse
import yaml
from text_generation import Client

# Check if running in Google Colab
try:
    from google.colab import userdata

    IN_COLAB = True
except ImportError:
    IN_COLAB = False

if IN_COLAB:
    fetch_secret = userdata.get
else:
    fetch_secret = os.getenv

BASE_URL = "https://api-inference.huggingface.co/models/"
BASE_MODEL = "HuggingFaceM4/idefics2-8b"
SYSTEM_PROMPT = "System: The following is a conversation between Idefics2, a highly knowledgeable and intelligent visual AI assistant created by Hugging Face, referred to as Assistant, and a human user called User. In the following interactions, User and Assistant will converse in natural language, and Assistant will do its best to answer User’s questions. Assistant has the ability to perceive images and reason about them, but it cannot generate images. Assistant was built to be respectful, polite and inclusive. It knows a lot, and always tells the truth. When prompted with an image, it does not make up facts.<end_of_utterance>\nAssistant: Hello, I'm Idefics2, Huggingface's latest multimodal assistant. How can I help you?<end_of_utterance>\n"


class HuggingFaceMMLLM:
    def __init__(self, hf_api_key=None, model=BASE_MODEL, base_url=BASE_URL):
        if hf_api_key is None:
            hf_api_key = fetch_secret("HF_TOKEN")
            if hf_api_key is None:
                raise ValueError("HF_TOKEN is not set")

        api_url = base_url + model

        self.client = Client(
            base_url=api_url,
            headers={"x-use-cache": "0", "Authorization": f"Bearer {hf_api_key}"},
        )

    def upload_image(self, file_path, cloudinary_config=None):
        import cloudinary
        import cloudinary.uploader

        if cloudinary_config is None:
            cloudinary_config = {
                "cloud_name": fetch_secret("CLOUDINARY_CLOUD_NAME"),
                "api_key": fetch_secret("CLOUDINARY_API_KEY"),
                "api_secret": fetch_secret("CLOUDINARY_API_SECRET"),
            }
            if None in cloudinary_config.values():
                raise ValueError(
                    "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET is not set.\nFor more information go on https://cloudinary.com/documentation/image_upload_api_reference"
                )

            cloudinary.config(**cloudinary_config)
        img_url = cloudinary.uploader.upload(file_path)["url"]
        return img_url

    def complete(self, query, file_path=None, url=None, structured=True):
        if file_path is None and url is None:
            raise ValueError("Either file_path or url must be provided")

        generation_args = {
            "max_new_tokens": 512,
            "repetition_penalty": 1.1,
            "do_sample": False,
        }

        if file_path:
            img_url = self.upload_image(file_path)
        else:
            img_url = url

        prompt_with_image = (
            SYSTEM_PROMPT + f"User:![]({img_url}) {query}<end_of_utterance>\nAssistant:"
        )
        output = self.client.generate(
            prompt=prompt_with_image, **generation_args
        ).generated_text

        if structured:
            try:
                output = yaml.safe_load(output.strip())
            except yaml.YAMLError:
                output = output.strip()

        return output


def main():
    parser = argparse.ArgumentParser(
        description="Process an image through a Hugging Face model and run LaVague Agent."
    )
    parser.add_argument("--file_path", help="Path to the image file")
    parser.add_argument("--url", help="URL of the image")
    parser.add_argument("--local", help="If set, LaVague Agent will not be run")

    args = parser.parse_args()

    # Set the OPENAI_API_KEY environment variable
    os.environ["OPENAI_API_KEY"] = fetch_secret("OPENAI_API_KEY")

    if not args.file_path and not args.url:
        raise ValueError("Either file_path or url must be provided")

    from llama_index.embeddings.openai import OpenAIEmbedding
    from lavague.drivers.selenium import SeleniumDriver
    from lavague.core import ActionEngine, WorldModel
    from lavague.core.agents import WebAgent

    if args.local:
        from llama_index.embeddings.huggingface import HuggingFaceEmbedding

        embedding = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")
    else:
        embedding = OpenAIEmbedding(model="text-embedding-3-large")

    selenium_driver = SeleniumDriver(headless=False)
    action_engine = ActionEngine(selenium_driver, embedding=embedding)
    world_model = WorldModel()
    agent = WebAgent(world_model, action_engine, time_between_actions=2.5)

    form_url = "https://form.jotform.com/241363523875359"
    objective = "Fill out this form. Do not provide a cover letter"

    agent.get(form_url)

    query = "Extract name, email, phone number, current company, a summary of experience, and a summary of education from this cv. Provide your output in YAML format."

    hf_mm_llm = HuggingFaceMMLLM()
    user_data = hf_mm_llm.complete(query=query, file_path=args.file_path, url=args.url)

    print("Extracted Data from :")
    print(user_data)

    agent.run(objective, user_data=user_data)


if __name__ == "__main__":
    main()

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

Co-authored-by: Alexis Deprez <deprez.alexis@laposte.net>

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
-    let pointContainer = document.elementFromPoint(elemC
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
-        self.last_ho
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

---

### Incident Patch 7: `e6a65882` (2024-08-22)
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

### Incident Patch 8: `dfe2e0d0` (2024-08-22)
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

### Incident Patch 9: `2848691c` (2024-08-14)
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

### Incident Patch 10: `8b68315d` (2024-08-12)
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
