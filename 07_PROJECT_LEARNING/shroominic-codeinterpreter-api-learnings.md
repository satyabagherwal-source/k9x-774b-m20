# Forensic Learning Record (Deep Inspection): shroominic/codeinterpreter-api

> **Canonical Artifact**: `07_PROJECT_LEARNING/shroominic-codeinterpreter-api-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/shroominic/codeinterpreter-api](https://github.com/shroominic/codeinterpreter-api))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:22:28.409Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `shroominic/codeinterpreter-api`
- **Description**: 👾 Open source implementation of the ChatGPT Code Interpreter
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3843 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/frontend/utils.py`
```
import os
import shutil
import tempfile
from typing import Optional

import streamlit as st
from codeinterpreterapi import CodeInterpreterSession


def create_temp_folder() -> str:
    """
    Creates a temp folder
    """
    temp_folder = tempfile.mkdtemp()
    return temp_folder


async def get_images(prompt: str, files: Optional[list] = None) -> list:
    if files is None:
        files = []
    with st.chat_message("user"):  # type: ignore
        st.write(prompt)
    with st.spinner():
        async with CodeInterpreterSession(model="gpt-3.5-turbo") as session:
            response = await session.agenerate_response(prompt, files=files)

            with st.chat_message("assistant"):  # type: ignore
                st.write(response.content)

                # Showing Results
                for _file in response.files:
                    st.image(_file.get_image(), caption=prompt, use_column_width=True)

                # Allowing the download of the results
                if len(response.files) == 1:
                    st.download_button(
                        "Download Results",
                        response.files[0].content,
                        file_name=response.files[0].name,
                    )
                else:
                    target_path = tempfile.mkdtemp()
                    for _file in response.files:
                        _file.save(os.path.join(target_path, _file.name))

                    zip_path = os.path.join(os.path.dirname(target_path), "archive")
                    shutil.make_archive(zip_path, "zip", target_path)

                    with open(zip_path + ".zip", "rb") as f:
                        st.download_button(
                            "Download Results",
                            f,
                            file_name="archive.zip",
                        )
    return response.files

```

### Core Architecture Module: `examples/analyze_dataset.py`
```
from codeinterpreterapi import CodeInterpreterSession, File


async def main() -> None:
    # context manager for start/stop of the session
    async with CodeInterpreterSession() as session:
        # define the user request
        user_request = "Analyze this dataset and plot something interesting about it."
        files = [
            File.from_path("examples/assets/iris.csv"),
        ]

        # generate the response
        response = await session.agenerate_response(user_request, files=files)

        # output the response (text + image)
        response.show()


if __name__ == "__main__":
    import asyncio

    # run the async function
    asyncio.run(main())

```

### Core Architecture Module: `examples/anthropic_claude.py`
```
from codeinterpreterapi import CodeInterpreterSession

with CodeInterpreterSession(model="claude-2") as session:
    result = session.generate_response(
        "Plot the nvidea stock vs microsoft stock over the last 6 months."
    )
    result.show()

```

### Core Architecture Module: `examples/chat_cli.py`
```
from codeinterpreterapi import CodeInterpreterSession, settings

settings.MODEL = "gpt-4"

print(
    "AI: Hello, I am the "
    "code interpreter agent.\n"
    "Ask me todo something and "
    "I will use python to do it!\n"
)

with CodeInterpreterSession() as session:
    while True:
        session.generate_response_sync(input("\nUser: ")).show()

```

### Core Architecture Module: `examples/chat_history_backend.py`
```
import os

os.environ["HISTORY_BACKEND"] = "redis"
os.environ["REDIS_HOST"] = "redis://localhost:6379"

from codeinterpreterapi import CodeInterpreterSession  # noqa: E402


def main() -> None:
    session_id = None

    session = CodeInterpreterSession()
    session.start()

    print("Session ID:", session.session_id)
    session_id = session.session_id

    response = session.generate_response("Plot the bitcoin chart of 2023 YTD")
    response.show()

    del session

    assert session_id is not None
    session = CodeInterpreterSession.from_id(session_id)

    response = session.generate_response("Now for the last 5 years")
    response.show()

    session.stop()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/convert_file.py`
```
from codeinterpreterapi import CodeInterpreterSession, File

with CodeInterpreterSession() as session:
    user_request = "Convert this dataset to excel."
    files = [
        File.from_path("examples/assets/iris.csv"),
    ]

    response = session.generate_response(user_request, files)

    print("AI: ", response.content)
    for file in response.files:
        if file.name == "iris.xlsx":
            file.save("examples/assets/iris.xlsx")

```

### Core Architecture Module: `examples/frontend/app.py`
```
import asyncio
import sys

import streamlit as st
from codeinterpreterapi import File
from utils import get_images  # type: ignore

# Page configuration
st.set_page_config(layout="wide")

st.title("Code Interpreter API 🚀")

# This will create a sidebar
st.sidebar.title("Code Interpreter API 🚀")
st.sidebar.markdown("[Github Repo](https://github.com/shroominic/codeinterpreter-api)")


# This will create a textbox where you can input text
input_text = st.text_area("Write your prompt")
uploaded_files = st.file_uploader("Upload your files", accept_multiple_files=True) or []

uploaded_files_list = []
for uploaded_file in uploaded_files:
    bytes_data = uploaded_file.read()
    uploaded_files_list.append(File(name=uploaded_file.name, content=bytes_data))

# This will create a button
button_pressed = st.button("Run code interpreter api")

# This will display the images only when the button is pressed
if button_pressed and input_text != "":
    if sys.platform == "win32":
        loop = asyncio.ProactorEventLoop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(get_images(input_text, files=uploaded_files_list))
    else:
        asyncio.run(get_images(input_text, files=uploaded_files_list))

```

### Core Architecture Module: `examples/frontend/chainlitui.py`
```
import chainlit as cl  # type: ignore
from codeinterpreterapi import CodeInterpreterSession
from codeinterpreterapi import File as CIFile

UPLOADED_FILES: list[CIFile] = []


@cl.action_callback("upload_file")
async def on_action(action: cl.Action) -> None:
    files = None

    # Wait for the user to upload a file
    while files is None:
        files = await cl.AskFileMessage(
            content="Please upload a text file to begin!", accept=["text/csv"]
        ).send()
    # Decode the file
    text_file = files[0]
    text = text_file.content.decode("utf-8")

    UPLOADED_FILES.append(text_file)

    # Let the user know that the system is ready
    await cl.Message(
        content=f"`{text_file.name}` uploaded, it contains {len(text)} characters!"
    ).send()
    await action.remove()


@cl.on_chat_start
async def start_chat() -> None:
    actions = [
        cl.Action(name="upload_file", value="example_value", description="Upload file")
    ]

    await cl.Message(
        content="Hello, How can I assist you today", actions=actions
    ).send()


@cl.on_message
async def run_conversation(user_message: str) -> None:
    session = CodeInterpreterSession()
    await session.astart()

    files = [CIFile(name=it.name, content=it.content) for it in UPLOADED_FILES]

    response = await session.agenerate_response(user_message, files=files)
    elements = [
        cl.Image(
            content=file.content,
            name=f"code-interpreter-image-{file.name}",
            display="inline",
        )
        for file in response.files
    ]
    actions = [
        cl.Action(name="upload_file", value="example_value", description="Upload file")
    ]
    await cl.Message(
        content=response.content,
        elements=elements,
        actions=actions,
    ).send()

    await session.astop()

```

### Core Architecture Module: `examples/plot_sin_wave.py`
```
from codeinterpreterapi import CodeInterpreterSession


async def main() -> None:
    async with CodeInterpreterSession() as session:
        response = await session.agenerate_response(
            "Plot a sin wave and show it to me."
        )
        response.show()


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())

```

### Core Architecture Module: `examples/show_bitcoin_chart.py`
```
from datetime import datetime

from codeinterpreterapi import CodeInterpreterSession


def main() -> None:
    with CodeInterpreterSession(local=True) as session:
        currentdate = datetime.now().strftime("%Y-%m-%d")

        response = session.generate_response(
            f"Plot the bitcoin chart of 2023 YTD (today is {currentdate})"
        )

        # prints the text and shows the image
        response.show()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/use_additional_tools.py`
```
"""
The exciting part about this example is
that the code interpreter has internet access
so it can download the bitcoin chart from yahoo finance
and plot it for you
"""
import csv
import io
from typing import Any

from codeinterpreterapi import CodeInterpreterSession
from langchain_core.tools import BaseTool


class ExampleKnowledgeBaseTool(BaseTool):
    name: str = "salary_database"
    description: str = "Use to get salary data of company employees"

    def _run(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError()

    async def _arun(self, *args: Any, **kwargs: Any) -> Any:
        f = io.StringIO()
        writer = csv.writer(f)
        writer.writerow(["month", "employee", "salary"])
        writer.writerow(["march 2022", "Jan", "1200"])
        writer.writerow(["march 2022", "Ola", "1500"])
        writer.writerow(["april 2022", "Jan", "1800"])
        writer.writerow(["april 2022", "Ola", "2000"])
        return f.getvalue()


async def main() -> None:
    async with CodeInterpreterSession(
        additional_tools=[ExampleKnowledgeBaseTool()]
    ) as session:
        response = await session.agenerate_response(
            "Plot chart of company employee salaries"
        )

        response.show()


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #61** (2023-08-23): **can not start jupyter kernel - raises NotImplementedError in asyncio\subprocess.py**
  *Symptoms*: Looks like there is something wrong with below code and how jupyter kernel is started under windows 10         self.subprocess = await asyncio.create_subprocess_exec(             "jupyter",             "kernelgateway",             "--KernelGatewayApp.ip='0.0.0.0'",             f"--KernelGatewayApp.port={self.port}",             stdout=out,             stderr=out,             cwd=".codebox"         )  >>>error log  Starting kernel... 2023-08-01 23:06:15.682 Uncaught app exception Traceback (most recent call last):   File "D:\myPython\codeInterpreter\lib\site-packages\streamlit\runtime\scriptrunner\script_runner.py", line 552, in _run_script     exec(code, module.__dict__)   File "D:\myPython\codeInterpreter\frontend\app.py", line 37, in <module>     asyncio.run(get_images(input_text, files=uploaded_files_list))   File "C:\Users\Amidamaru2\AppData\Local\Programs\Python\Python310\lib\asyncio\runners.py", line 44, in run     return loop.run_until_complete(main)   File "C:\Users\Amidamaru2\AppData\Local\Programs\Python\Python310\lib\asyncio\base_events.py", line 649, in run_until_complete     return future.result()   File "D:\myPython\codeInterpreter\frontend\utils.py", line 22, in get_images     async with CodeInterpreterSession(model='gpt-3.5-turbo') as session:   File "D:\myPython\codeInterpreter\codeinterpreterapi\session.py", line 204, in __aenter__     await self.astart()   File "D:\myPython\codeInterpreter\codeinterpreterapi\session.py", line 39, 
  **Post-Mortem & Fix Analysis**:
  > mee  too window 10,all version is newest
  > Ahh I think is has something todo with the differnce between Unix/Windows terminal. Maybe someone with windows can fix this and start a PR to codeboxapi 
  > I am facing the same bug. This bug seems to remain in v0.0.11.

- **Issue #53** (2023-08-14): **AzureOpenAI chat Support**
  *Symptoms*: I replaced ChatOpenAI with the following  AzureChatOpenAI(             model = 'gpt-4',             temperature=0.03,             openai_api_base='',             openai_api_version="2023-07-01-preview",             deployment_name='',             openai_api_key='',             openai_api_type="azure",             max_retries=3,             request_timeout=60*3         )  but it is throwing me this error.    File "/usr/local/lib/python3.10/dist-packages/langchain/chat_models/openai.py", line 103, in _convert_dict_to_message     content = _dict["content"] or ""  # OpenAI returns None for tool invocations KeyError: 'content'
  **Post-Mortem & Fix Analysis**:
  > you need to add the url for the endpoint to make this work  https://[YOUR-SUBDOMAIN].openai.azure.com/
  > Please note that `functions` is only tolerated by the `2023-07-01-preview` api version, and `0613` models in Azure.  See [here](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#functioncall).  I'm going to try to drop a version of this project on my fork that has a .env setting for Azure or OpenAI which should allow the user to switch between easily (assuming they're using a compatible Azure model). I hope this is helpful. Should be just a day more, or so.   `.env.example` for the version I'm working on here: ``` IMPLEMENTATION= "openai" # "openai" for openai api, "azure" for azure deployed openai models [hereafter 'ADOM'] AI_API_KEY= # your openai api key (required) AI_API_MODEL= "gpt-4" # your openai model (optional, for ADOM, 'engine' name, e.g. "my-deployed-gpt") AZURE_API_BASE= # your azure base url (optional, required for ADOM) AZURE_API_VERSION= # your azure version, e.g. "2023-03-15-preview" (optional, required for ADOM) CODEBOX_API_KEY= # your
  > I have this performing the first function call in `plot_sin_wave.py` and getting a `200` response. The responses between OpenAI and Azure in Postman for the same call appear largely identical but for Azure not including the `content: Null` key/value that OpenAI does when using a `function_call` (see below). Nonetheless, I'm getting the "Something went wrong while generating your response" error after that `200` code.  OpenAI Response per Postman: ``` {     "id": "<elided>",     "object": "chat.completion",     "created": <elided>,     "model": "gpt-4-0613",     "choices": [         {             "index": 0,             "message": {                 "role": "assistant",                 "content": null,                 "function_call": {                     "name": "python",                     "arguments": "import numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 2 * np.pi, 100)\ny = np.sin(x)\n\nplt.plot(x, y)\nplt.title('Sin Wave')\nplt.xlabel('x')\npl

- **Issue #41** (2023-08-05): **Importing error **
  *Symptoms*: When importing I get a TypeError saying:   TypeError: issubclass() arg 1 must be a class  ![Screenshot 2023-07-21 at 11 34 24](https://github.com/shroominic/codeinterpreter-api/assets/38949526/a89b85e7-e1d6-49dd-b384-9693bef1a906)  This prevents me from using the tool at all. What to do?
  **Post-Mortem & Fix Analysis**:
  > try using python 3.10

- **Issue #35** (2023-07-21): **asyncio.run() cannot be called from a running event loop**
  *Symptoms*: I am running the following code but following error keep throwing: Code: ` async def main():     async with CodeInterpreterSession() as session:         response = await session.generate_response(             "Plot the relative performance of tech giants (Apple, Google, Microsoft, Amazon) in 2023."         )          print("AI: ", response.content)         for file in response.files:             file.show_image()   if __name__ == "__main__":     import asyncio      asyncio.run(main()) `  error: ![image](https://github.com/shroominic/codeinterpreter-api/assets/96944736/623d775f-b942-44ef-b215-6da7e30f515d)  
  **Post-Mortem & Fix Analysis**:
  > It seems that you are trying to run the code in Colab (or a Jupyten Notebook) If so, you should follow these instructions https://github.com/shroominic/codeinterpreter-api/issues/17. And specifically this example https://github.com/shroominic/codeinterpreter-api/issues/17#issuecomment-1638904221.

- **Issue #22** (2023-08-05): **Error communicating with OpenAI.**
  *Symptoms*: **After installing all required packages, I'm running the following code:**  ```python from codeinterpreterapi import CodeInterpreterSession, File   async def main():     # context manager for auto start/stop of the session     async with CodeInterpreterSession() as session:         # define the user request         user_request = "What are the headers?"         files = [             File.from_path("...... (Path censored intentionally"),         ]          # generate the response         response = await session.generate_response(             user_request, files=files         )          # output to the user         print("AI: ", response.content)         for file in response.files:             file.show_image()   if __name__ == "__main__":     import asyncio      asyncio.run(main()) ```  **I'm getting the following error:** ``` Retrying langchain.chat_models.openai.acompletion_with_retry.<locals>._completion_with_retry in 1.0 seconds as it raised APIConnectionError: Error communicating with OpenAI. ``` Any ideas of why this happens?  Thanks
  **Post-Mortem & Fix Analysis**:
  > This problem is with the openai api so maybe something is wrong with your payment details, your internet connection or your account. You can maybe try if the normal chatgpt API works and see if you get the same error.
  > got the same error
  > same error... I have tested my openai key and it is usable.

- **Issue #11** (2023-07-17): **TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'**
  *Symptoms*: I get the following error from site-packages\codeboxapi\config.py", line 14, in CodeBoxSettings    CODEBOX_API_KEY: str | None = None TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'   
  **Post-Mortem & Fix Analysis**:
  > Sorry I forgot that this feature is new in python3.10 so you need to use python3.10+ for now. But I try to change this soon so you can also use 3.9+ or maybe even 3.8+
  > @shroominic  Got it. Would be great If you could enable it for Python 3.9+ . Thanks
  > Should be working now in v0.0.6 👍🏼

- **Issue #1** (2023-07-28): **TypeError: issubclass() arg 1 must be a class**
  *Symptoms*: Running the demo on readme gives me this error. I'm on python 3.11.3
  **Post-Mortem & Fix Analysis**:
  > Hey, thanks for posting it!  Can you maybe post the entire traceback of the error or a screenshot of it? And the code you were trying to run this would help a lot  to get an idea on what went wrong :)

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

### Incident Patch 1: `9482d36f` (2024-11-07)
**Commit Message**: ⬆️ v0.1.20 - fix deprecations & lock dependencies due

**File**: `pyproject.toml` (modified, +3/-4)
```diff
@@ -1,13 +1,12 @@
 [project]
 name = "codeinterpreterapi"
-version = "0.1.19"
+version = "0.1.20"
 description = "CodeInterpreterAPI is an (unofficial) open source python interface for the ChatGPT CodeInterpreter."
 authors = [{ name = "Shroominic", email = "contact@shroominic.com" }]
 dependencies = [
-    "langchain-openai>=0.1.1",
-    "langchain-community>=0.2",
+    "langchain>=0.1, <0.2",
+    "langchain_openai",
     "codeboxapi==0.1.19",
-    "langchain>=0.1.14",
     "pyzmq==25.1.2",
 ]
 license = { file = "LICENSE" }
```

**File**: `requirements-dev.lock` (modified, +11/-15)
```diff
@@ -74,6 +74,7 @@ colorama==0.4.6
 comm==0.2.2
     # via ipykernel
 dataclasses-json==0.6.7
+    # via langchain
     # via langchain-community
 debugpy==1.8.7
     # via ipykernel
@@ -115,8 +116,6 @@ httpcore==1.0.6
 httpx==0.27.2
     # via langsmith
     # via openai
-httpx-sse==0.4.0
-    # via langchain-community
 identify==2.6.1
     # via pre-commit
 idna==3.10
@@ -191,19 +190,18 @@ jupyter-server-terminals==0.5.3
     # via jupyter-server
 jupyterlab-pygments==0.3.0
     # via nbconvert
-langchain==0.3.7
-    # via codeinterpreterapi
-    # via langchain-community
-langchain-community==0.3.5
+langchain==0.1.20
     # via codeinterpreterapi
-langchain-core==0.3.15
+langchain-community==0.0.38
+    # via langchain
+langchain-core==0.1.53
     # via langchain
     # via langchain-community
     # via langchain-openai
     # via langchain-text-splitters
-langchain-openai==0.2.5
+langchain-openai==0.1.7
     # via codeinterpreterapi
-langchain-text-splitters==0.3.2
+langchain-text-splitters==0.0.2
     # via langchain
 langsmith==0.1.139
     # via langchain
@@ -276,13 +274,13 @@ numpy==1.26.4
     # via pandas
     # via pydeck
     # via streamlit
-openai==1.53.0
+openai==1.54.3
     # via langchain-openai
 orjson==3.10.11
     # via langsmith
 overrides==7.7.0
     # via jupyter-server
-packaging==24.1
+packaging==23.2
     # via altair
     # via ipykernel
     # via jupyter-server
@@ -345,7 +343,6 @@ pydantic-core==2.23.4
     # via pydantic
 pydantic-settings==2.6.1
     # via codeboxapi
-    # via langchain-community
 pydeck==0.9.1
     # via streamlit
 pygments==2.18.0
@@ -438,7 +435,7 @@ stack-data==0.6.3
     # via ipython
 streamlit==1.39.0
     # via codeinterpreterapi
-tenacity==9.0.0
+tenacity==8.5.0
     # via langchain
     # via langchain-community
     # via langchain-core
@@ -464,7 +461,7 @@ tornado==6.4.1
     # via notebook
     # via streamlit
     # via terminado
-tqdm==4.66.6
+tqdm==4.67.0
     # via openai
 traitlets==5.14.3
     # via comm
@@ -486,7 +483,6 @@ typing-extensions==4.12.2
     # via altair
     # via anyio
     # via ipython
-    # via langchain-core
     # via multidict
     # via mypy
     # via openai
```

**File**: `requirements.lock` (modified, +12/-16)
```diff
@@ -37,6 +37,7 @@ charset-normalizer==3.4.0
 codeboxapi==0.1.19
     # via codeinterpreterapi
 dataclasses-json==0.6.7
+    # via langchain
     # via langchain-community
 distro==1.9.0
     # via openai
@@ -52,8 +53,6 @@ httpcore==1.0.6
 httpx==0.27.2
     # via langsmith
     # via openai
-httpx-sse==0.4.0
-    # via langchain-community
 idna==3.10
     # via anyio
     # via httpx
@@ -65,19 +64,18 @@ jsonpatch==1.33
     # via langchain-core
 jsonpointer==3.0.0
     # via jsonpatch
-langchain==0.3.7
-    # via codeinterpreterapi
-    # via langchain-community
-langchain-community==0.3.5
+langchain==0.1.20
     # via codeinterpreterapi
-langchain-core==0.3.15
+langchain-community==0.0.38
+    # via langchain
+langchain-core==0.1.53
     # via langchain
     # via langchain-community
     # via langchain-openai
     # via langchain-text-splitters
-langchain-openai==0.2.5
+langchain-openai==0.1.7
     # via codeinterpreterapi
-langchain-text-splitters==0.3.2
+langchain-text-splitters==0.0.2
     # via langchain
 langsmith==0.1.139
     # via langchain
@@ -93,11 +91,11 @@ mypy-extensions==1.0.0
 numpy==1.26.4
     # via langchain
     # via langchain-community
-openai==1.53.0
+openai==1.54.3
     # via langchain-openai
 orjson==3.10.11
     # via langsmith
-packaging==24.1
+packaging==23.2
     # via langchain-core
     # via marshmallow
 propcache==0.2.0
@@ -113,7 +111,6 @@ pydantic-core==2.23.4
     # via pydantic
 pydantic-settings==2.6.1
     # via codeboxapi
-    # via langchain-community
 python-dotenv==1.0.1
     # via pydantic-settings
 pyyaml==6.0.2
@@ -122,7 +119,7 @@ pyyaml==6.0.2
     # via langchain-core
 pyzmq==25.1.2
     # via codeinterpreterapi
-regex==2024.9.11
+regex==2024.11.6
     # via tiktoken
 requests==2.32.3
     # via codeboxapi
@@ -140,17 +137,16 @@ sniffio==1.3.1
 sqlalchemy==2.0.35
     # via langchain
     # via langchain-community
-tenacity==9.0.0
+tenacity==8.5.0
     # via langchain
     # via langchain-community
     # via langchain-core
 tiktoken==0.8.0
     # via langchain-openai
-tqdm==4.66.6
+tqdm==4.67.0
     # via openai
 typing-extensions==4.12.2
     # via anyio
-    # via langchain-core
     # via multidict
     # via openai
     # via pydantic
```

---

### Incident Patch 2: `4600bec4` (2024-11-07)
**Commit Message**: fix typing issue

**File**: `src/codeinterpreterapi/schema.py` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ def get_image(self) -> Any:
 
         # Convert image to RGB if it's not
         if img.mode not in ("RGB", "L"):  # L is for grayscale images
-            img = img.convert("RGB")
+            img = img.convert("RGB")  # type: ignore
 
         return img
 
```

---

### Incident Patch 3: `545f4131` (2024-11-07)
**Commit Message**: fix deprecation warnings and typing issues

**File**: `src/codeinterpreterapi/session.py` (modified, +10/-8)
```diff
@@ -139,7 +139,7 @@ def _choose_llm(self) -> BaseChatModel:
                 base_url=settings.AZURE_API_BASE,
                 api_version=settings.AZURE_API_VERSION,
                 azure_deployment=settings.AZURE_DEPLOYMENT_NAME,
-                api_key=settings.AZURE_OPENAI_API_KEY,
+                api_key=settings.AZURE_OPENAI_API_KEY,  # type: ignore
                 max_retries=settings.MAX_RETRY,
                 timeout=settings.REQUEST_TIMEOUT,
             )  # type: ignore
@@ -148,7 +148,7 @@ def _choose_llm(self) -> BaseChatModel:
 
             return ChatOpenAI(
                 model=settings.MODEL,
-                api_key=settings.OPENAI_API_KEY,
+                api_key=settings.OPENAI_API_KEY,  # type: ignore
                 timeout=settings.REQUEST_TIMEOUT,
                 temperature=settings.TEMPERATURE,
                 max_retries=settings.MAX_RETRY,
@@ -192,7 +192,7 @@ def _choose_agent(self) -> BaseSingleActionAgent:
 
     def _history_backend(self) -> BaseChatMessageHistory:
         return (
-            CodeBoxChatMessageHistory(codebox=self.codebox)
+            CodeBoxChatMessageHistory(codebox=self.codebox)  # type: ignore
             if settings.HISTORY_BACKEND == "codebox"
             else RedisChatMessageHistory(
                 session_id=str(self.session_id),
@@ -263,7 +263,7 @@ def _run_handler(self, code: str) -> str:
             if self.verbose:
                 print("Error:", output.content)
 
-        elif modifications := get_file_modifications(code, self.llm):
+        elif modifications := get_file_modifications(code, self.llm):  # type: ignore
             for filename in modifications:
                 if filename in [file.name for file in self.input_files]:
                     continue
@@ -426,8 +426,8 @@ def generate_response(
         try:
             self._input_handler(user_request)
             assert self.agent_executor, "Session not initialized."
-            response = self.agent_executor.run(input=user_request.content)
-            return self._output_handler(response)
+            response = self.agent_executor.invoke({"input": user_request.content})
+            return self._output_handler(response["output"])
         except Exception as e:
             if self.verbose:
                 traceback.print_exc()
@@ -452,8 +452,10 @@ async def agenerate_response(
         try:
             await self._ainput_handler(user_request)
             assert self.agent_executor, "Session not initialized."
-            response = await self.agent_executor.arun(input=user_request.content)
-            return await self._aoutput_handler(response)
+            response = await self.agent_executor.ainvoke(
+                {"input": user_request.content}
+            )
+            return await self._aoutput_handler(response["output"])
         except Exception as e:
             if self.verbose:
                 traceback.print_exc()
```

---

### Incident Patch 4: `619dc432` (2024-11-07)
**Commit Message**: fix get_file_modifications detection issue

**File**: `src/codeinterpreterapi/chains/modifications_check.py` (modified, +10/-0)
```diff
@@ -19,6 +19,11 @@ def get_file_modifications(
     result = llm.invoke(prompt)
 
     try:
+        if isinstance(result.content, str):
+            if result.content.endswith("```"):
+                result.content = result.content[:-3]
+            if result.content.startswith("```"):
+                result.content = result.content[3:]
         result = json.loads(result.content)
     except json.JSONDecodeError:
         result = ""
@@ -40,6 +45,11 @@ async def aget_file_modifications(
     result = await llm.ainvoke(prompt)
 
     try:
+        if isinstance(result.content, str):
+            if result.content.endswith("```"):
+                result.content = result.content[:-3]
+            if result.content.startswith("```"):
+                result.content = result.content[3:]
         result = json.loads(result.content)
     except json.JSONDecodeError:
         result = ""
```

---

### Incident Patch 5: `39f9519c` (2024-11-02)
**Commit Message**: 🔧 fix dependency issues

**File**: `pyproject.toml` (modified, +2/-1)
```diff
@@ -1,10 +1,11 @@
 [project]
 name = "codeinterpreterapi"
-version = "0.1.18"
+version = "0.1.19"
 description = "CodeInterpreterAPI is an (unofficial) open source python interface for the ChatGPT CodeInterpreter."
 authors = [{ name = "Shroominic", email = "contact@shroominic.com" }]
 dependencies = [
     "langchain-openai>=0.1.1",
+    "langchain-community>=0.2",
     "codeboxapi==0.1.19",
     "langchain>=0.1.14",
     "pyzmq==25.1.2",
```

**File**: `requirements-dev.lock` (modified, +122/-121)
```diff
@@ -10,25 +10,26 @@
 #   universal: false
 
 -e file:.
-aiohttp==3.9.3
+aiohappyeyeballs==2.4.3
+    # via aiohttp
+aiohttp==3.10.10
     # via codeboxapi
     # via langchain
     # via langchain-community
 aiosignal==1.3.1
     # via aiohttp
-altair==5.3.0
+altair==5.4.1
     # via streamlit
-annotated-types==0.6.0
+annotated-types==0.7.0
     # via pydantic
-anyio==4.3.0
+anyio==4.6.2.post1
     # via httpx
     # via jupyter-server
     # via openai
 appnope==0.1.4
     # via ipykernel
 argon2-cffi==23.1.0
     # via jupyter-server
-    # via nbclassic
     # via notebook
 argon2-cffi-bindings==21.2.0
     # via argon2-cffi
@@ -39,29 +40,29 @@ asttokens==2.4.1
 async-timeout==4.0.3
     # via aiohttp
     # via langchain
-attrs==23.2.0
+attrs==24.2.0
     # via aiohttp
     # via jsonschema
     # via referencing
-babel==2.14.0
+babel==2.16.0
     # via mkdocs-material
 beautifulsoup4==4.12.3
     # via nbconvert
-bleach==6.1.0
+bleach==6.2.0
     # via nbconvert
-blinker==1.7.0
+blinker==1.8.2
     # via streamlit
-cachetools==5.3.3
+cachetools==5.5.0
     # via streamlit
-certifi==2024.2.2
+certifi==2024.8.30
     # via httpcore
     # via httpx
     # via requests
-cffi==1.16.0
+cffi==1.17.1
     # via argon2-cffi-bindings
 cfgv==3.4.0
     # via pre-commit
-charset-normalizer==3.3.2
+charset-normalizer==3.4.0
     # via requests
 click==8.1.7
     # via mkdocs
@@ -72,16 +73,15 @@ colorama==0.4.6
     # via mkdocs-material
 comm==0.2.2
     # via ipykernel
-dataclasses-json==0.6.4
-    # via langchain
+dataclasses-json==0.6.7
     # via langchain-community
-debugpy==1.8.1
+debugpy==1.8.7
     # via ipykernel
 decorator==5.1.1
     # via ipython
 defusedxml==0.7.1
     # via nbconvert
-distlib==0.3.8
+distlib==0.3.9
     # via virtualenv
 distro==1.9.0
     # via openai
@@ -91,15 +91,15 @@ exceptiongroup==1.2.2
     # via anyio
     # via ipython
     # via pytest
-executing==2.0.1
+executing==2.1.0
     # via stack-data
-fastjsonschema==2.19.1
+fastjsonschema==2.20.0
     # via nbformat
-filelock==3.13.4
+filelock==3.16.1
     # via virtualenv
 fqdn==1.5.1
     # via jsonschema
-frozenlist==1.4.1
+frozenlist==1.5.0
     # via aiohttp
     # via aiosignal
 ghp-import==2.1.0
@@ -110,13 +110,16 @@ gitpython==3.1.43
     # via streamlit
 h11==0.14.0
     # via httpcore
-httpcore==1.0.5
+httpcore==1.0.6
     # via httpx
-httpx==0.27.0
+httpx==0.27.2
+    # via langsmith
     # via openai
-identify==2.5.35
+httpx-sse==0.4.0
+    # via langchain-community
+identify==2.6.1
     # via pre-commit
-idna==3.6
+idna==3.10
     # via anyio
     # via httpx
     # via jsonschema
@@ -125,10 +128,11 @@ idna==3.6
 importlib-metadata==8.5.0
     # via markdown
     # via mkdocs
+    # via mkdocs-get-deps
     # via nbconvert
 iniconfig==2.0.0
     # via pytest
-ipykernel==6.29.4
+ipykernel==6.29.5
     # via nbclassic
     # via notebook
 ipython==8.18.1
@@ -141,40 +145,38 @@ isoduration==20.11.0
 isort==5.13.2
 jedi==0.19.1
     # via ipython
-jinja2==3.1.3
+jinja2==3.1.4
     # via altair
     # via jupyter-server
     # via mkdocs
     # via mkdocs-material
-    # via nbclassic
     # via nbconvert
     # via notebook
     # via pydeck
+jiter==0.7.0
+    # via openai
 jsonpatch==1.33
-    # via langchain
     # via langchain-core
-jsonpointer==2.4
+jsonpointer==3.0.0
     # via jsonpatch
     # via jsonschema
-jsonschema==4.21.1
+jsonschema==4.23.0
     # via altair
     # via jupyter-events
     # via nbformat
-jsonschema-specifications==2023.12.1
+jsonschema-specifications==2024.10.1
     # via jsonschema
 jupyter-client==7.4.9
     # via ipykernel
     # via jupyter-kernel-gateway
     # via jupyter-server
-    # via nbclassic
     # via nbclient
     # via notebook
 jupyter-core==5.7.2
     # via ipykernel
     # via jupyter-client
     # via jupyter-kernel-gateway
     # via jupyter-server
-    # via nbclassic
     # via nbclient
     # via nbconvert
     # via nbformat
@@ -183,74 +185,77 @@ jupyter-events==0.10.0
     # via jupyter-server
 jupyter-kernel-gateway==2.5.2
     # via codeboxapi
-jupyter-server==2.13.0
-    # via nbclassic
+jupyter-server==2.14.2
     # via notebook-shim
 jupyter-server-terminals==0.5.3
     # via jupyter-server
 jupyterlab-pygments==0.3.0
     # via nbconvert
-langchain==0.1.15
+langchain==0.3.7
     # via codeinterpreterapi
-langchain-community==0.0.32
-    # via langchain
-langchain-core==0.1.41
+    # via langchain-community
+langchain-community==0.3.5
+    # via codeinterpreterapi
+langchain-core==0.3.15
     # via langchain
     # via langchain-community
     # via langchain-openai
     # via langchain-text-splitters
-langchain-openai==0.1.2
+langchain-openai==0.2.5
     # via codeinterpreterapi
-langchain-text-splitters==0.0.1
+langchain-text-splitters==0.3.2
     # via langchain
-langsmith==0.1.43
+langsmith==0.1.139
     # via langchain
     # via langchain-community
     # via langchain-core
-markdown==3.6
+markdown==3.7
     # via mkdocs
     # via mkdocs-material
     #
```

**File**: `requirements.lock` (modified, +54/-40)
```diff
@@ -10,144 +10,158 @@
 #   universal: false
 
 -e file:.
-aiohttp==3.9.3
+aiohappyeyeballs==2.4.3
+    # via aiohttp
+aiohttp==3.10.10
     # via codeboxapi
     # via langchain
     # via langchain-community
 aiosignal==1.3.1
     # via aiohttp
-annotated-types==0.6.0
+annotated-types==0.7.0
     # via pydantic
-anyio==4.3.0
+anyio==4.6.2.post1
     # via httpx
     # via openai
 async-timeout==4.0.3
     # via aiohttp
     # via langchain
-attrs==23.2.0
+attrs==24.2.0
     # via aiohttp
-certifi==2024.2.2
+certifi==2024.8.30
     # via httpcore
     # via httpx
     # via requests
-charset-normalizer==3.3.2
+charset-normalizer==3.4.0
     # via requests
 codeboxapi==0.1.19
     # via codeinterpreterapi
-dataclasses-json==0.6.4
-    # via langchain
+dataclasses-json==0.6.7
     # via langchain-community
 distro==1.9.0
     # via openai
 exceptiongroup==1.2.2
     # via anyio
-frozenlist==1.4.1
+frozenlist==1.5.0
     # via aiohttp
     # via aiosignal
 h11==0.14.0
     # via httpcore
-httpcore==1.0.5
+httpcore==1.0.6
     # via httpx
-httpx==0.27.0
+httpx==0.27.2
+    # via langsmith
     # via openai
-idna==3.6
+httpx-sse==0.4.0
+    # via langchain-community
+idna==3.10
     # via anyio
     # via httpx
     # via requests
     # via yarl
+jiter==0.7.0
+    # via openai
 jsonpatch==1.33
-    # via langchain
     # via langchain-core
-jsonpointer==2.4
+jsonpointer==3.0.0
     # via jsonpatch
-langchain==0.1.15
+langchain==0.3.7
     # via codeinterpreterapi
-langchain-community==0.0.32
-    # via langchain
-langchain-core==0.1.41
+    # via langchain-community
+langchain-community==0.3.5
+    # via codeinterpreterapi
+langchain-core==0.3.15
     # via langchain
     # via langchain-community
     # via langchain-openai
     # via langchain-text-splitters
-langchain-openai==0.1.2
+langchain-openai==0.2.5
     # via codeinterpreterapi
-langchain-text-splitters==0.0.1
+langchain-text-splitters==0.3.2
     # via langchain
-langsmith==0.1.43
+langsmith==0.1.139
     # via langchain
     # via langchain-community
     # via langchain-core
-marshmallow==3.21.1
+marshmallow==3.23.1
     # via dataclasses-json
-multidict==6.0.5
+multidict==6.1.0
     # via aiohttp
     # via yarl
 mypy-extensions==1.0.0
     # via typing-inspect
 numpy==1.26.4
     # via langchain
     # via langchain-community
-openai==1.16.2
+openai==1.53.0
     # via langchain-openai
-orjson==3.10.0
+orjson==3.10.11
     # via langsmith
-packaging==23.2
+packaging==24.1
     # via langchain-core
     # via marshmallow
-pydantic==2.6.4
+propcache==0.2.0
+    # via yarl
+pydantic==2.9.2
     # via codeboxapi
     # via langchain
     # via langchain-core
     # via langsmith
     # via openai
     # via pydantic-settings
-pydantic-core==2.16.3
+pydantic-core==2.23.4
     # via pydantic
-pydantic-settings==2.2.1
+pydantic-settings==2.6.1
     # via codeboxapi
+    # via langchain-community
 python-dotenv==1.0.1
     # via pydantic-settings
-pyyaml==6.0.1
+pyyaml==6.0.2
     # via langchain
     # via langchain-community
     # via langchain-core
 pyzmq==25.1.2
     # via codeinterpreterapi
-regex==2023.12.25
+regex==2024.9.11
     # via tiktoken
-requests==2.31.0
+requests==2.32.3
     # via codeboxapi
     # via langchain
     # via langchain-community
     # via langsmith
+    # via requests-toolbelt
     # via tiktoken
+requests-toolbelt==1.0.0
+    # via langsmith
 sniffio==1.3.1
     # via anyio
     # via httpx
     # via openai
-sqlalchemy==2.0.29
+sqlalchemy==2.0.35
     # via langchain
     # via langchain-community
-tenacity==8.2.3
+tenacity==9.0.0
     # via langchain
     # via langchain-community
     # via langchain-core
-tiktoken==0.6.0
+tiktoken==0.8.0
     # via langchain-openai
-tqdm==4.66.2
+tqdm==4.66.6
     # via openai
-typing-extensions==4.11.0
+typing-extensions==4.12.2
     # via anyio
+    # via langchain-core
+    # via multidict
     # via openai
     # via pydantic
     # via pydantic-core
     # via sqlalchemy
     # via typing-inspect
 typing-inspect==0.9.0
     # via dataclasses-json
-urllib3==2.2.1
+urllib3==2.2.3
     # via requests
-websockets==12.0
+websockets==13.1
     # via codeboxapi
-yarl==1.9.4
+yarl==1.17.1
     # via aiohttp
```

**File**: `src/codeinterpreterapi/config.py` (modified, +4/-4)
```diff
@@ -1,7 +1,7 @@
 from typing import Optional
 
 from langchain_core.messages import SystemMessage
-from langchain_core.pydantic_v1 import BaseSettings, SecretStr
+from langchain_core.pydantic_v1 import BaseSettings
 
 from codeinterpreterapi.prompts import code_interpreter_system_message
 
@@ -14,12 +14,12 @@ class CodeInterpreterAPISettings(BaseSettings):
     DEBUG: bool = False
 
     # Models
-    OPENAI_API_KEY: Optional[SecretStr] = None
-    AZURE_OPENAI_API_KEY: Optional[SecretStr] = None
+    OPENAI_API_KEY: Optional[str] = None
+    AZURE_OPENAI_API_KEY: Optional[str] = None
     AZURE_API_BASE: Optional[str] = None
     AZURE_API_VERSION: Optional[str] = None
     AZURE_DEPLOYMENT_NAME: Optional[str] = None
-    ANTHROPIC_API_KEY: Optional[SecretStr] = None
+    ANTHROPIC_API_KEY: Optional[str] = None
 
     # LLM Settings
     MODEL: str = "gpt-3.5-turbo"
```

---

### Incident Patch 6: `df7c5bb6` (2024-04-04)
**Commit Message**: 📦 Update dependencies in requirements-dev.lock and requirements.lock

**File**: `requirements-dev.lock` (modified, +344/-12)
```diff
@@ -5,174 +5,506 @@
 #   pre: false
 #   features: []
 #   all-features: false
+#   with-sources: false
 
 -e file:.
 aiohttp==3.9.1
+    # via codeboxapi
+    # via langchain
+    # via langchain-community
 aiosignal==1.3.1
+    # via aiohttp
 altair==5.2.0
+    # via streamlit
 annotated-types==0.6.0
+    # via pydantic
 anyio==4.1.0
+    # via httpx
+    # via jupyter-server
+    # via openai
 appnope==0.1.3
+    # via ipykernel
 argon2-cffi==23.1.0
+    # via jupyter-server
+    # via nbclassic
+    # via notebook
 argon2-cffi-bindings==21.2.0
+    # via argon2-cffi
 arrow==1.3.0
+    # via isoduration
 asttokens==2.4.1
+    # via stack-data
 attrs==23.1.0
+    # via aiohttp
+    # via jsonschema
+    # via referencing
 babel==2.13.1
+    # via mkdocs-material
 beautifulsoup4==4.12.2
+    # via nbconvert
 bleach==6.1.0
+    # via nbconvert
 blinker==1.7.0
+    # via streamlit
 cachetools==5.3.2
+    # via streamlit
 certifi==2023.11.17
+    # via httpcore
+    # via httpx
+    # via requests
 cffi==1.16.0
+    # via argon2-cffi-bindings
 cfgv==3.4.0
+    # via pre-commit
 charset-normalizer==3.3.2
+    # via requests
 click==8.1.7
-codeboxapi==0.0.19
+    # via mkdocs
+    # via streamlit
+codeboxapi==0.1.19
+    # via codeinterpreterapi
 colorama==0.4.6
+    # via mkdocs-material
 comm==0.2.0
-dataclasses-json==0.6.3
+    # via ipykernel
+dataclasses-json==0.6.4
+    # via langchain
+    # via langchain-community
 debugpy==1.8.0
+    # via ipykernel
 decorator==5.1.1
+    # via ipython
 defusedxml==0.7.1
+    # via nbconvert
 distlib==0.3.8
+    # via virtualenv
 distro==1.8.0
+    # via openai
 entrypoints==0.4
+    # via jupyter-client
 executing==2.0.1
+    # via stack-data
 fastjsonschema==2.19.0
+    # via nbformat
 filelock==3.13.1
+    # via virtualenv
 fqdn==1.5.1
+    # via jsonschema
 frozenlist==1.4.0
+    # via aiohttp
+    # via aiosignal
 ghp-import==2.1.0
+    # via mkdocs
 gitdb==4.0.11
+    # via gitpython
 gitpython==3.1.40
+    # via streamlit
 h11==0.14.0
+    # via httpcore
 httpcore==1.0.2
+    # via httpx
 httpx==0.25.2
+    # via openai
 identify==2.5.33
+    # via pre-commit
 idna==3.6
+    # via anyio
+    # via httpx
+    # via jsonschema
+    # via requests
+    # via yarl
 importlib-metadata==6.11.0
+    # via streamlit
 iniconfig==2.0.0
+    # via pytest
 ipykernel==6.27.1
+    # via nbclassic
+    # via notebook
 ipython==8.18.1
+    # via ipykernel
 ipython-genutils==0.2.0
+    # via nbclassic
+    # via notebook
 isoduration==20.11.0
+    # via jsonschema
 isort==5.13.1
 jedi==0.19.1
+    # via ipython
 jinja2==3.1.2
+    # via altair
+    # via jupyter-server
+    # via mkdocs
+    # via mkdocs-material
+    # via nbclassic
+    # via nbconvert
+    # via notebook
+    # via pydeck
 jsonpatch==1.33
+    # via langchain
+    # via langchain-core
 jsonpointer==2.4
+    # via jsonpatch
+    # via jsonschema
 jsonschema==4.20.0
+    # via altair
+    # via jupyter-events
+    # via nbformat
 jsonschema-specifications==2023.11.2
+    # via jsonschema
 jupyter-client==7.4.9
+    # via ipykernel
+    # via jupyter-kernel-gateway
+    # via jupyter-server
+    # via nbclassic
+    # via nbclient
+    # via notebook
 jupyter-core==5.5.0
+    # via ipykernel
+    # via jupyter-client
+    # via jupyter-kernel-gateway
+    # via jupyter-server
+    # via nbclassic
+    # via nbclient
+    # via nbconvert
+    # via nbformat
+    # via notebook
 jupyter-events==0.9.0
+    # via jupyter-server
 jupyter-kernel-gateway==2.5.2
+    # via codeboxapi
 jupyter-server==2.12.1
+    # via nbclassic
+    # via notebook-shim
 jupyter-server-terminals==0.5.0
+    # via jupyter-server
 jupyterlab-pygments==0.3.0
-langchain==0.0.349
-langchain-community==0.0.1
-langchain-core==0.0.13
-langsmith==0.0.69
+    # via nbconvert
+langchain==0.1.14
+    # via codeinterpreterapi
+langchain-community==0.0.31
+    # via langchain
+langchain-core==0.1.40
+    # via langchain
+    # via langchain-community
+    # via langchain-openai
+    # via langchain-text-splitters
+langchain-openai==0.1.1
+    # via codeinterpreterapi
+langchain-text-splitters==0.0.1
+    # via langchain
+langsmith==0.1.40
+    # via langchain
+    # via langchain-community
+    # via langchain-core
 markdown==3.5.1
+    # via mkdocs
+    # via mkdocs-material
+    # via pymdown-extensions
 markdown-it-py==3.0.0
+    # via rich
 markupsafe==2.1.3
-marshmallow==3.20.1
+    # via jinja2
+    # via mkdocs
+    # via nbconvert
+marshmallow==3.21.1
+    # via dataclasses-json
 matplotlib-inline==0.1.6
+    # via ipykernel
+    # via ipython
 mdurl==0.1.2
+    # via markdown-it-py
 mergedeep==1.3.4
+    # via mkdocs
 mistune==3.0.2
+    # via nbconvert
 mkdocs==1.5.3
+    # via mkdocs-material
 mkdocs-material==9.5.2
 mkdocs-material-extensions==1.3.1
+    # via mkdocs-material
 multidict==6.0.4
+    # via aiohttp
+    # via yarl
 mypy==1.7.1
 mypy-extensions==1.0.0
+    # via mypy
+    # via typing-inspect
 nbclassic==1.0.0
+    # via noteb
```

**File**: `requirements.lock` (modified, +103/-11)
```diff
@@ -5,47 +5,139 @@
 #   pre: false
 #   features: []
 #   all-features: false
+#   with-sources: false
 
 -e file:.
 aiohttp==3.9.1
+    # via codeboxapi
+    # via langchain
+    # via langchain-community
 aiosignal==1.3.1
+    # via aiohttp
 annotated-types==0.6.0
+    # via pydantic
 anyio==4.1.0
+    # via httpx
+    # via openai
 attrs==23.1.0
+    # via aiohttp
 certifi==2023.11.17
+    # via httpcore
+    # via httpx
+    # via requests
 charset-normalizer==3.3.2
-codeboxapi==0.0.19
-dataclasses-json==0.6.3
+    # via requests
+codeboxapi==0.1.19
+    # via codeinterpreterapi
+dataclasses-json==0.6.4
+    # via langchain
+    # via langchain-community
 distro==1.8.0
+    # via openai
 frozenlist==1.4.0
+    # via aiohttp
+    # via aiosignal
 h11==0.14.0
+    # via httpcore
 httpcore==1.0.2
+    # via httpx
 httpx==0.25.2
+    # via openai
 idna==3.6
+    # via anyio
+    # via httpx
+    # via requests
+    # via yarl
 jsonpatch==1.33
+    # via langchain
+    # via langchain-core
 jsonpointer==2.4
-langchain==0.0.349
-langchain-community==0.0.1
-langchain-core==0.0.13
-langsmith==0.0.69
-marshmallow==3.20.1
+    # via jsonpatch
+langchain==0.1.14
+    # via codeinterpreterapi
+langchain-community==0.0.31
+    # via langchain
+langchain-core==0.1.40
+    # via langchain
+    # via langchain-community
+    # via langchain-openai
+    # via langchain-text-splitters
+langchain-openai==0.1.1
+    # via codeinterpreterapi
+langchain-text-splitters==0.0.1
+    # via langchain
+langsmith==0.1.40
+    # via langchain
+    # via langchain-community
+    # via langchain-core
+marshmallow==3.21.1
+    # via dataclasses-json
 multidict==6.0.4
+    # via aiohttp
+    # via yarl
 mypy-extensions==1.0.0
-numpy==1.26.2
-openai==1.3.8
+    # via typing-inspect
+numpy==1.26.4
+    # via langchain
+    # via langchain-community
+openai==1.16.1
+    # via langchain-openai
+orjson==3.10.0
+    # via langsmith
 packaging==23.2
+    # via langchain-core
+    # via marshmallow
 pydantic==2.5.2
+    # via codeboxapi
+    # via langchain
+    # via langchain-core
+    # via langsmith
+    # via openai
+    # via pydantic-settings
 pydantic-core==2.14.5
+    # via pydantic
 pydantic-settings==2.1.0
+    # via codeboxapi
 python-dotenv==1.0.0
+    # via pydantic-settings
 pyyaml==6.0.1
+    # via langchain
+    # via langchain-community
+    # via langchain-core
+regex==2023.12.25
+    # via tiktoken
 requests==2.31.0
+    # via codeboxapi
+    # via langchain
+    # via langchain-community
+    # via langsmith
+    # via tiktoken
 sniffio==1.3.0
-sqlalchemy==2.0.23
+    # via anyio
+    # via httpx
+    # via openai
+sqlalchemy==2.0.29
+    # via langchain
+    # via langchain-community
 tenacity==8.2.3
+    # via langchain
+    # via langchain-community
+    # via langchain-core
+tiktoken==0.6.0
+    # via langchain-openai
 tqdm==4.66.1
+    # via openai
 typing-extensions==4.9.0
+    # via openai
+    # via pydantic
+    # via pydantic-core
+    # via sqlalchemy
+    # via typing-inspect
 typing-inspect==0.9.0
+    # via dataclasses-json
 urllib3==2.1.0
-websockets==11.0.3
+    # via requests
+websockets==12.0
+    # via codeboxapi
 yarl==1.9.4
+    # via aiohttp
```

---

### Incident Patch 7: `918c201e` (2023-12-12)
**Commit Message**: 🔧 fix code-check



---

### Incident Patch 8: `aa44c602` (2023-12-12)
**Commit Message**: 🔧 pre-commit fix

**File**: `.pre-commit-config.yaml` (modified, +0/-5)
```diff
@@ -14,11 +14,6 @@ repos:
         args: [--ignore-missing-imports, --follow-imports=skip]
         additional_dependencies: [types-requests]
 
--   repo: https://github.com/pre-commit/mirrors-isort
-    rev: v5.10.1
-    hooks:
-    -   id: isort
-
 -   repo: https://github.com/astral-sh/ruff-pre-commit
     rev: v0.1.7
     hooks:
```

**File**: `roadmap.todo` (modified, +1/-1)
```diff
@@ -8,4 +8,4 @@
 
 [ ] - codeinterpreter-cli (cli chat)
 
-[ ] - 
\ No newline at end of file
+[ ] -
```

**File**: `src/codeinterpreterapi/parser.py` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 from __future__ import annotations
 
 import re
-from typing import Union, Any
+from typing import Any, Union
 
 from langchain.agents import AgentOutputParser
 from langchain.chat_models.base import BaseChatModel
```

**File**: `src/codeinterpreterapi/schema.py` (modified, +3/-3)
```diff
@@ -1,9 +1,9 @@
 import asyncio
-
 from typing import Any
-from langchain.schema import AIMessage, HumanMessage
-from langchain.pydantic_v1 import BaseModel
+
 from codeboxapi.schema import CodeBoxStatus
+from langchain.pydantic_v1 import BaseModel
+from langchain.schema import AIMessage, HumanMessage
 
 
 class File(BaseModel):
```

**File**: `src/codeinterpreterapi/session.py` (modified, +2/-2)
```diff
@@ -2,8 +2,8 @@
 import re
 import traceback
 from io import BytesIO
-from typing import Optional, Any, Type
 from types import TracebackType
+from typing import Any, Optional, Type
 from uuid import UUID, uuid4
 
 from codeboxapi import CodeBox  # type: ignore
@@ -14,6 +14,7 @@
     ConversationalAgent,
     ConversationalChatAgent,
 )
+from langchain.agents.openai_functions_agent.base import OpenAIFunctionsAgent
 from langchain.base_language import BaseLanguageModel
 from langchain.callbacks.base import Callbacks
 from langchain.chat_models import AzureChatOpenAI, ChatAnthropic, ChatOpenAI
@@ -27,7 +28,6 @@
 from langchain.prompts.chat import MessagesPlaceholder
 from langchain.schema import BaseChatMessageHistory
 from langchain.tools import BaseTool, StructuredTool
-from langchain.agents.openai_functions_agent.base import OpenAIFunctionsAgent
 
 from codeinterpreterapi.chains import (
     aget_file_modifications,
```

---

### Incident Patch 9: `8987cda7` (2023-12-12)
**Commit Message**: Chainlit Conversational UI (#133)

* made changes in function_agent.py file

* Chainlit UI added

---------

Co-authored-by: THEAVINASHREDDY <[REDACTED_EMAIL]>
Co-authored-by: Dominic <[REDACTED_EMAIL]>

**File**: `frontend/chainlitui.py` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+import chainlit as cl
+from codeinterpreterapi import CodeInterpreterSession
+from codeinterpreterapi import File as CIFile
+
+UPLOADED_FILES = []
+
+@cl.action_callback("upload_file")
+async def on_action(action):
+    files = None
+
+    # Wait for the user to upload a file
+    while files is None:
+        files = await cl.AskFileMessage(
+            content="Please upload a text file to begin!", accept=["text/csv"]
+        ).send()
+    # Decode the file
+    text_file = files[0]
+    text = text_file.content.decode("utf-8")
+
+    UPLOADED_FILES.append(text_file)
+
+    # Let the user know that the system is ready
+    await cl.Message(
+        content=f"`{text_file.name}` uploaded, it contains {len(text)} characters!"
+    ).send()
+    await action.remove()
+
+@cl.on_chat_start
+async def start_chat():
+    actions = [
+        cl.Action(name="upload_file", value="example_value", description="Upload file")
+    ]
+
+    await cl.Message(
+        content="Hello, How can I assist you today", actions=actions
+    ).send()
+
+@cl.on_message
+async def run_conversation(user_message: str):
+    session = CodeInterpreterSession()
+    await session.astart()
+
+    files = [CIFile(name=it.name, content=it.content) for it in UPLOADED_FILES]
+
+
+    response = await session.agenerate_response(user_message, files=files)
+    elements = [
+        cl.Image(
+            content=file.content,
+            name=f"code-interpreter-image-{file.name}",
+            display="inline",
+        )
+        for file in response.files
+    ]
+    actions = [
+        cl.Action(name="upload_file", value="example_value", description="Upload file")
+    ]
+    await cl.Message(
+        content=response.content,
+        elements=elements,
+        actions=actions,
+    ).send()
+
+    await session.astop()
\ No newline at end of file
```

---

### Incident Patch 10: `5d3b827b` (2023-10-18)
**Commit Message**: Fixed newline SyntaxError (#136)

* Update session.py

Resolves SyntaxError: unterminated string literal issue where multi-line code strings are not processed correctly if they're not formatted in compliance with Python's string literal rules. Specifically, the interpreter fails when the code string starts with a newline right after the opening quote or doesn't use triple quotes for multi-line code snippets. This leads to an unended string literal error because the interpreter expects a complete string format as per Python syntax rules.

* Fixed newline SyntaxError

Added some prompting to the python tool to resolve SyntaxError: unterminated string literal where multi-line code strings are not processed correctly if they're not formatted in compliance with Python's string literal rules. Specifically, the interpreter fails when the code string starts with a newline right after the opening quote or doesn't use triple quotes for multi-line code snippets. This leads to an unended string literal error because the interpreter expects a complete string format as per Python syntax rules.

**File**: `codeinterpreterapi/session.py` (modified, +3/-0)
```diff
@@ -108,6 +108,9 @@ def _tools(self, additional_tools: list[BaseTool]) -> list[BaseTool]:
                 description="Input a string of code to a ipython interpreter. "
                 "Write the entire code in a single string. This string can "
                 "be really long, so you can use the `;` character to split lines. "
+                "Start your code on the same line as the opening quote. "
+                "Do not start your code with a line break. "
+                "For example, do 'import numpy', not '\\nimport numpy'."
                 "Variables are preserved between runs. "
                 + (
                     (
```

---

### Incident Patch 11: `c7e242f0` (2023-10-10)
**Commit Message**: ⬆️ v0.0.14 - security update

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [tool.poetry]
 name = "codeinterpreterapi"
-version = "0.0.13"
+version = "0.0.14"
 authors = ["Shroominic <contact@shroominic.com>"]
 license = "MIT"
 description = "CodeInterpreterAPI is an (unofficial) open source python interface for the ChatGPT CodeInterpreter."
@@ -10,7 +10,7 @@ repository = "https://github.com/shroominic/codeinterpreter-api"
 
 [tool.poetry.dependencies]
 python = ">=3.9.7,<4.0"
-langchain = ">=0.0.300"
+langchain = ">=0.0.312"
 codeboxapi = ">=0.0.19"
 openai = "*"
 python-dotenv = "*"
```

---

### Incident Patch 12: `48b5ddee` (2023-09-29)
**Commit Message**: 🛠️ fix isort

**File**: `frontend/app.py` (modified, +1/-1)
```diff
@@ -2,9 +2,9 @@
 import sys
 
 import streamlit as st
+from utils import get_images  # type: ignore
 
 from codeinterpreterapi import File
-from utils import get_images
 
 # Page configuration
 st.set_page_config(layout="wide")
```

---

### Incident Patch 13: `5243f696` (2023-09-29)
**Commit Message**: fixes app.py to make it run (#122)

Co-authored-by: dgedgafo <[REDACTED_EMAIL]>
Co-authored-by: Dominic <[REDACTED_EMAIL]>

**File**: `frontend/app.py` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 import streamlit as st
 
 from codeinterpreterapi import File
-from frontend.utils import get_images
+from utils import get_images
 
 # Page configuration
 st.set_page_config(layout="wide")
```

---

### Incident Patch 14: `c290aa2f` (2023-09-29)
**Commit Message**: 🔨 fix tool error

**File**: `codeinterpreterapi/agents/functions_agent.py` (modified, +83/-116)
```diff
@@ -1,10 +1,13 @@
 """Module implements an agent that uses OpenAI's APIs function enabled API."""
 import json
-from dataclasses import dataclass
 from json import JSONDecodeError
 from typing import Any, List, Optional, Sequence, Tuple, Union
 
 from langchain.agents import BaseSingleActionAgent
+from langchain.agents.agent import AgentOutputParser
+from langchain.agents.format_scratchpad.openai_functions import (
+    format_to_openai_functions,
+)
 from langchain.callbacks.base import BaseCallbackManager
 from langchain.callbacks.manager import Callbacks  # type: ignore
 from langchain.chat_models.openai import ChatOpenAI
@@ -18,131 +21,91 @@
 from langchain.schema import (
     AgentAction,
     AgentFinish,
-    BasePromptTemplate,
-    OutputParserException,
-)
-from langchain.schema.language_model import BaseLanguageModel
-from langchain.schema.messages import (
     AIMessage,
     BaseMessage,
-    FunctionMessage,
+    BasePromptTemplate,
+    OutputParserException,
     SystemMessage,
 )
-from langchain.tools import BaseTool
-from langchain.tools.convert_to_openai import format_tool_to_openai_function
-
-
-@dataclass
-class _FunctionsAgentAction(AgentAction):
-    message_log: List[BaseMessage]
+from langchain.schema.agent import AgentActionMessageLog
+from langchain.schema.language_model import BaseLanguageModel
+from langchain.schema.output import ChatGeneration, Generation
+from langchain.tools.base import BaseTool
+from langchain.tools.render import format_tool_to_openai_function
 
 
-def _convert_agent_action_to_messages(
-    agent_action: AgentAction, observation: str
-) -> List[BaseMessage]:
-    """Convert an agent action to a message.
+class OpenAIFunctionsAgentOutputParser(AgentOutputParser):
+    """Parses a message into agent action/finish.
 
-    This code is used to reconstruct the original AI message from the agent action.
+    Is meant to be used with OpenAI models, as it relies on the specific
+    function_call parameter from OpenAI to convey what tools to use.
 
-    Args:
-        agent_action: Agent action to convert.
+    If a function_call parameter is passed, then that is used to get
+    the tool and tool input.
 
-    Returns:
-        AIMessage that corresponds to the original tool invocation.
-    """
-    if isinstance(agent_action, _FunctionsAgentAction):
-        return agent_action.message_log + [
-            _create_function_message(agent_action, observation)
-        ]
-    else:
-        return [AIMessage(content=agent_action.log)]
-
-
-def _create_function_message(
-    agent_action: AgentAction, observation: str
-) -> FunctionMessage:
-    """Convert agent action and observation into a function message.
-    Args:
-        agent_action: the tool invocation request from the agent
-        observation: the result of the tool invocation
-    Returns:
-        FunctionMessage that corresponds to the original tool invocation
-    """
-    if not isinstance(observation, str):
-        try:
-            content = json.dumps(observation, ensure_ascii=False)
-        except Exception:
-            content = str(observation)
-    else:
-        content = observation
-    return FunctionMessage(
-        name=agent_action.tool,
-        content=content,
-    )
-
-
-def _format_intermediate_steps(
-    intermediate_steps: List[Tuple[AgentAction, str]],
-) -> List[BaseMessage]:
-    """Format intermediate steps.
-    Args:
-        intermediate_steps: Steps the LLM has taken to date, along with observations
-    Returns:
-        list of messages to send to the LLM for the next prediction
+    If one is not passed, then the AIMessage is assumed to be the final output.
     """
-    messages = []
 
-    for intermediate_step in intermediate_steps:
-        agent_action, observation = intermediate_step
-        messages.extend(_convert_agent_action_to_messages(agent_action, observation))
-
-    return messages
-
-
-def _parse_ai_message(message: BaseMessage) -> Union[AgentAction, AgentFinish]:
-    """Parse an AI message."""
-    if not isinstance(message, AIMessage):
-        raise TypeError(f"Expected an AI message got {type(message)}")
-
-    function_call = message.additional_kwargs.get("function_call", {})
-
-    if function_call:
-        function_name = function_call["name"]
-        try:
-            _tool_input = json.loads(function_call["arguments"])
-        except JSONDecodeError:
-            if function_name == "python":
-                code = function_call["arguments"]
-                _tool_input = {
-                    "code": code,
-                }
+    @property
+    def _type(self) -> str:
+        return "openai-functions-agent"
+
+    @staticmethod
+    def _parse_ai_message(message: BaseMessage) -> Union[AgentAction, AgentFinish]:
+        """Parse an AI message."""
+        if not isinstance(message, AIMessage):
+            raise TypeError(f"Expected an AI message got {type(message)}")
+
+        function_call = message.additional_kwargs.get("f
```

---

### Incident Patch 15: `4f630cdd` (2023-09-29)
**Commit Message**: ✂️ fix schema

**File**: `codeinterpreterapi/config.py` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 from typing import Optional
 
 from dotenv import load_dotenv
-from langchain.pydantic_v1 import BaseSettings
+from langchain.pydantic_v1 import BaseSettings, SecretStr
 from langchain.schema import SystemMessage
 
 from codeinterpreterapi.prompts import code_interpreter_system_message
@@ -23,7 +23,7 @@ class CodeInterpreterAPISettings(BaseSettings):
     AZURE_API_BASE: Optional[str] = None
     AZURE_API_VERSION: Optional[str] = None
     AZURE_DEPLOYMENT_NAME: Optional[str] = None
-    ANTHROPIC_API_KEY: Optional[str] = None
+    ANTHROPIC_API_KEY: Optional[SecretStr] = None
 
     # LLM Settings
     MODEL: str = "gpt-3.5-turbo"
```

#### Recent Merged Pull Requests:
- **PR #148** (2023-12-12): Bump jupyter-server from 2.7.3 to 2.11.2 (@dependabot[bot])
- **PR #147** (2023-12-12): Bump aiohttp from 3.8.6 to 3.9.0 (@dependabot[bot])
- **PR #143** (2023-12-12): Bump langchain from 0.0.312 to 0.0.329 (@dependabot[bot])
- **PR #142** (2023-12-12): Bump pyarrow from 13.0.0 to 14.0.1 (@dependabot[bot])
- **PR #141** (closed): Bump langchain from 0.0.312 to 0.0.325 (@dependabot[bot])
- **PR #140** (closed): Bump langchain from 0.0.312 to 0.0.317 (@dependabot[bot])
- **PR #139** (2023-12-12): ⚙️ adding settings doc (@goudete)
- **PR #137** (2023-12-12): Bump urllib3 from 2.0.6 to 2.0.7 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
