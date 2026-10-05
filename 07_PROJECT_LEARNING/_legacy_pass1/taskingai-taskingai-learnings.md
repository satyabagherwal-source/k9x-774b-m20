# Forensic Learning Record (Deep Inspection): TaskingAI/TaskingAI

> **Canonical Artifact**: `07_PROJECT_LEARNING/taskingai-taskingai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TaskingAI/TaskingAI](https://github.com/TaskingAI/TaskingAI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:12:36.421Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TaskingAI/TaskingAI`
- **Description**: The open source platform for AI-native application development.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5407 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/app/__init__.py`
```
__VERSION__ = "v0.3.0"

```

### Core Architecture Module: `backend/app/config.py`
```
import os
from dotenv import load_dotenv
import logging

logger = logging.Logger(__name__)
load_dotenv()

default_env_values = {
    "MODE": "PROD",
    "PURPOSE": "API",
    "SERVICE_PORT": 8000,
    "HOST_URL": "http://localhost:8000",
    "POSTGRES_MAX_CONNECTIONS": 10,
    "AES_ENCRYPTION_KEY": "b90e4648ad699c3bdf62c0860e09eb9efc098ee75f215bf750847ae19d41e4b0",
    "JWT_SECRET_KEY": "dbefe42f34473990a3fa903a6a3283acdc3a910beb1ae271a6463ffa5a926bfb",
    "DEFAULT_ADMIN_USERNAME": "admin",
    "DEFAULT_ADMIN_PASSWORD": "TaskingAI321",
}


def load_str_env(name: str, required: bool = False) -> str:
    """
    Load environment variable as string
    :param name: name of the environment variable
    :param required: whether the environment variable is required
    """
    if os.environ.get(name):
        return os.environ.get(name)

    if default_env_values.get(name) is not None:
        return default_env_values.get(name)

    if required:
        raise Exception(f"Env {name} is not set")


def load_int_env(name: str, required: bool = False) -> int:
    """
    Load environment variable as int
    :param name: name of the environment variable
    :param required: whether the environment variable is required
    """
    if os.environ.get(name):
        return int(os.environ.get(name))

    if default_env_values.get(name) is not None:
        return default_env_values.get(name)

    if required:
        raise Exception(f"Env {name} is not set")


class Config:
    """Backend configuration"""

    def __init__(self):
        from app import __VERSION__

        logger.info(f"Init Config")

        # version
        self.VERSION = __VERSION__
        self.POSTGRES_SCHEMA_VERSION = 7

        # mode
        self.MODE = load_str_env("MODE", required=True)
        self.MODE = self.MODE.lower()
        logger.info(f"MODE = {self.MODE}")
        self.DEV = True if self.MODE == "dev" else False
        self.TEST = True if self.MODE == "test" else False
        self.PROD = True if self.MODE == "prod" else False

        # purpose
        self.PURPOSE = load_str_env("PURPOSE", required=True)
        self.PURPOSE = self.PURPOSE.lower()
        logger.info(f"PURPOSE = {self.PURPOSE}")
        self.WEB = True if self.PURPOSE == "web" else False
        self.API = True if self.PURPOSE == "api" else False

        # service
        self.SERVICE_PORT = load_int_env("SERVICE_PORT", required=True)
        self.HOST_URL = load_str_env("HOST_URL", required=True)
        self.WEB_ROUTE_PREFIX = "/api/v1"
        self.API_ROUTE_PREFIX = "/v1"

        # integrations
        self.TASKINGAI_INFERENCE_URL = load_str_env("TASKINGAI_INFERENCE_URL", required=True)
        self.TASKINGAI_PLUGIN_URL = load_str_env("TASKINGAI_PLUGIN_URL", required=True)

        # database
        self.POSTGRES_URL = load_str_env("POSTGRES_URL", required=True)
        self.POSTGRES_MAX_CONNECTIONS = load_int_env("POSTGRES_MAX_CONNECTIONS", required=True)
        self.REDIS_URL = load_str_env("REDIS_URL")

        # secret
        self.AES_ENCRYPTION_KEY = load_str_env("AES_ENCRYPTION_KEY", required=True)
        self.JWT_SECRET_KEY = load_str_env("JWT_SECRET_KEY", required=True)
        self.DEFAULT_ADMIN_USERNAME = load_str_env("DEFAULT_ADMIN_USERNAME", required=True)
        self.DEFAULT_ADMIN_PASSWORD = load_str_env("DEFAULT_ADMIN_PASSWORD", required=True)

        # currently only support en
        self.DEFAULT_LANG = "en"

        # storage
        self.S3_BUCKET_NAME = load_str_env("S3_BUCKET_NAME")
        self.S3_ACCESS_KEY_ID = load_str_env("S3_ACCESS_KEY_ID")
        self.S3_ACCESS_KEY_SECRET = load_str_env("S3_ACCESS_KEY_SECRET")
        self.S3_ENDPOINT = load_str_env("S3_ENDPOINT")
        self.S3_BUCKET_PUBLIC_DOMAIN = load_str_env("S3_BUCKET_PUBLIC_DOMAIN")
        self.OBJECT_STORAGE_TYPE = load_str_env("OBJECT_STORAGE_TYPE", required=True)
        self.PATH_TO_VOLUME = load_str_env("PATH_TO_VOLUME", required=True)
        self.PROJECT_ID = load_str_env("PROJECT_ID", required=True)


CONFIG = Config()

```

### Core Architecture Module: `backend/app/database/__init__.py`
```
from .connection import *

```

### Core Architecture Module: `backend/app/database/connection.py`
```
import logging
import os

from app.config import CONFIG
from tkhelper.database.boto3.client import StorageClient
from tkhelper.database.postgres import PostgresDatabasePool
from tkhelper.database.redis import RedisConnection

logger = logging.Logger(__name__)

__all__ = [
    "postgres_pool",
    "redis_conn",
    "boto3_client",
    "init_database",
    "close_database",
]

pg_migration_script_dir = os.path.join(os.path.dirname(__file__), "pg_scripts/")
postgres_pool = PostgresDatabasePool(
    url=CONFIG.POSTGRES_URL,
    max_connections=CONFIG.POSTGRES_MAX_CONNECTIONS,
    migration_version=CONFIG.POSTGRES_SCHEMA_VERSION,
    migration_script_dir=pg_migration_script_dir,
    migration_script_filename_format=r"postgres_(\d+)(_\w+)*\.sql",
    clean_db_table_order=["c1_"],
)

redis_conn = RedisConnection(url=CONFIG.REDIS_URL)
boto3_client = StorageClient(
    service_name=CONFIG.OBJECT_STORAGE_TYPE,
    endpoint_url=CONFIG.S3_ENDPOINT,
    bucket_public_domain=CONFIG.S3_BUCKET_PUBLIC_DOMAIN,
    access_key_id=CONFIG.S3_ACCESS_KEY_ID,
    access_key_secret=CONFIG.S3_ACCESS_KEY_SECRET,
    path_to_volume=CONFIG.PATH_TO_VOLUME,
    host_url=CONFIG.HOST_URL,
)


# init postgres db pool instance
async def init_database():
    logger.info("Initializing postgres database connection pool..")
    await postgres_pool.init()

    logger.info("Initializing redis connection..")
    await redis_conn.init()


# close postgres db pool instance
async def close_database():
    logger.info("Closing postgres database connection pool..")
    await postgres_pool.close()

    logger.info("Closing redis connection..")
    await redis_conn.close()

```

### Core Architecture Module: `backend/app/database_ops/auth/admin/__init__.py`
```
from .get import get_admin_by_username
from .login import login_admin
from .logout import logout_admin
from .refresh_token import refresh_admin_token
from .register import register_admin

```

### Core Architecture Module: `backend/app/database_ops/auth/admin/get.py`
```
from app.database import postgres_pool
from app.models import Admin
import logging

logger = logging.getLogger(__name__)


async def get_admin_by_username(
    username: str,
):
    # 1. get from database
    async with postgres_pool.get_db_connection() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM app_admin WHERE username = $1",
            username,
        )

    # 2. write to redis and return
    if row:
        admin = Admin.build(row)
        return admin

    return None

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #262** (2024-07-23): **Bug in Anthropic Stream Mode with Function Call Handling**
  *Symptoms*: **Describe the bug**  The stream_handle_function_calls function in Anthropic's stream mode is currently only passing and not executing the intended functionality. This issue causes function calls within the stream mode to be ineffective.  **To Reproduce** Steps to reproduce the behavior:  1. Set up a request to initialize Anthropic's stream mode. 2. Configure the request to include a function call. 3. Send the request and observe that the stream_handle_function_calls function only passes and does not execute the function call as expected.  **Expected behavior**  The stream_handle_function_calls function should execute the function calls correctly within Anthropic's stream mode, allowing the function to perform its intended operations.  **Desktop (please complete the following information):**  - OS: Windows 
  **Post-Mortem & Fix Analysis**:
  > @LinkW77 Thanks we'll look into it and fix asap

- **Issue #123** (2024-05-29): **chat_completion function don't work properly**
  *Symptoms*: I can create an assistant and chat with it properly, so the model does work well, but can't run the chat_completion function using the example code in the doc: `chat_completion_result = taskingai.inference.chat_completion(     model_id=model_id,     messages=[         {"role": "system", "content": "You are a health advisor providing nutritional advice. You should always reply with a professional, kind, and patient tone."},         {"role": "user", "content": "How much suger can a woman take in a day?"},     ] )` Keep getting this error in the picture. ![微信图片_20240523165900](https://github.com/TaskingAI/TaskingAI/assets/71247215/eed1c9b5-a35b-4cb7-9f46-b1a415b4118f)
  **Post-Mortem & Fix Analysis**:
  > @o3o1 Thanks for your feedback. If the chat completion API works in the playgrorund, It seems to be a client issue. we'll look into it and and provide a quick fix 
  > @jameszyao The UI won't response when confirm model selection in the 'Playground-Chat Completion' interface, but it works fine if you start playground via actions in the 'Models' interface. The function issue seems to occur after I ran a gradio demo, not sure if it's relevant.
  > @o3o1 we have released a new client SDK version v0.2.5. Please upgrade your TaskingAI client version using pip and see if the chat completion works now :-)

- **Issue #110** (2024-07-17): **Model Tpd3Vtx6 is not a text embedding model**
  *Symptoms*: **Describe the bug** This problem arose when using the ollama model  **To Reproduce** Steps to reproduce the behavior:  1.After creating an ollama using gemma, select the console prompt when creating a chat 2.Model Tpd3Vtx6 is not a text embedding model   **Expected behavior** Changing a few versions didn't fix the issue  for 2.0-2.2    **Screenshots** ![1](https://github.com/TaskingAI/TaskingAI/assets/52629438/04d5685c-7dbd-43d2-9c7b-6de51fcfd623) ![2](https://github.com/TaskingAI/TaskingAI/assets/52629438/21ab0566-c065-4f6f-8cda-b2554df3c297) ![3](https://github.com/TaskingAI/TaskingAI/assets/52629438/1e2cb62d-4cc0-4753-9369-e13ff100e3cd)  **Desktop (please complete the following information):**  - OS: [e.g. Windows] - Browser [e.g. chrome,] - Version [e.g. 22]  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > @450220020 Thanks for your feedback. We have made a quick fix and released a beta backend version, v0.2.3-beta-1. You can use the latest Docker Compose file in the master branch to upgrade the pod. We will continue working on an official version release next week. Please stay tuned :-)
  > Great, surprise, I didn't expect it so soon. I tested this version and found that the problem has been resolved. There are a few more sequential questions to follow, which I will send out in the previous format

- **Issue #95** (2024-04-07): **fix: read num_chunk before record update**
  *Symptoms*: # Pull Request  ## PR Description  read num_chunk before record update  ## Type of Change  - [x] Bug fix - [ ] New feature - [x] Performance enhancement - [ ] Code refactor - [ ] Documentation update - [ ] Other, please describe:  ## Checklist  Before submitting this PR, please make sure:  - [x] I have read the [CONTRIBUTING.md](/CONTRIBUTING.md) guidelines. - [x] I have tested my changes locally to ensure they are effective. - [x] I have updated the necessary documentation (if applicable).

- **Issue #90** (2024-04-07): **fix: message generation stability**
  *Symptoms*: # Pull Request  ## PR Description  1. fix: add wildcard in provider model types 2. fix: raise message generation error when model not found 3. fix: remove JSONDecodeError log in chat_completion_stream 4. fix: auto restart redis client  ## Linked Issue  Resolves #82 #80 #41   ## Type of Change  - [x] Bug fix - [ ] New feature - [ ] Performance enhancement - [ ] Code refactor - [ ] Documentation update - [ ] Other, please describe:  ## Checklist  Before submitting this PR, please make sure:  - [x] I have read the [CONTRIBUTING.md](/CONTRIBUTING.md) guidelines. - [x] I have tested my changes locally to ensure they are effective. - [x] I have updated the necessary documentation (if applicable).  

- **Issue #86** (2024-07-16): **StabilityAI has bug**
  *Symptoms*: When the data returned by the image is obtained, an error is reported when passed to the model    async with ClientSession() as session:             async with session.post(url=url, headers=headers, json=data, proxy=CONFIG.PROXY) as response:                 if response.status == 200:                     data = await response.json()                     base64_image = data["artifacts"][0]["base64"]                     return PluginOutput(data={"base64_image": base64_image})                 else:                     data = await response.json()                     print(data)                     raise Exception(f"Error fetching data: {response.status}, {data}")
  **Post-Mortem & Fix Analysis**:
  > <img width="885" alt="image" src="https://github.com/TaskingAI/TaskingAI/assets/105403828/0b217c06-c863-4187-8c96-1db42f3e12c9"> <img width="715" alt="image" src="https://github.com/TaskingAI/TaskingAI/assets/105403828/2c30b1ed-8544-481f-b1cb-00c4cdfe98dd"> 
  > Thanks for the feedback YangZhiBo. This is a known issue to us. The cause of this issue is: the generated image returned from Stability's image generation API is in base64 string format. That base64 string will exceed the input token limit for most of the models.   We plan to introduce integration with image hosting service providers such as cloudfare to solve this issue. Once that is done, the base64 representation of Image will be uploaded to the image hosting service, and return a simple url instead, and eventually accepted by the LLM.  If you have better idea of how to solve this, please let us know. In the meantime, before we launch fix for this, please use dalle 3 instead for image generation.

- **Issue #82** (2024-04-07): **chat completion stream JSONDecodeError**
  *Symptoms*: At the end of the question, you will definitely report this JSONDecodeError
  **Post-Mortem & Fix Analysis**:
  > <img width="601" alt="image" src="https://github.com/TaskingAI/TaskingAI/assets/105403828/1b694569-859e-4a2b-a993-94d6694bdd81"> 
  > Thanks for your feedback. This will be fixed in our next release :-)

- **Issue #80** (2024-07-16): **Concurrent testing，asyncio.exceptions.CancelledError: Cancelled by cancel scope 10abec670**
  *Symptoms*: **Describe the bug** asyncio.exceptions.CancelledError  **To Reproduce** Steps to reproduce the behavior:  1. Concurrent test an assistant, create chat concurrently, create messages, and generate results 2. After the end, the server will report an error  **Expected behavior** A clear and concise description of what you expected to happen. INFO:     127.0.0.1:51131 - "POST /api/v1/assistants/X5lMSQinHLE8beIWz7mjDqxM/chats HTTP/1.1" 200 OK ERROR:    Exception in ASGI application Traceback (most recent call last):   File "/Users/yangzhibo/Projects/TaskingAI/backend/.venv/lib/python3.9/site-packages/aioredis/connection.py", line 860, in send_packed_command     await asyncio.wait_for(   File "/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/asyncio/tasks.py", line 442, in wait_for     return await fut   File "/Users/yangzhibo/Projects/TaskingAI/backend/.venv/lib/python3.9/site-packages/aioredis/connection.py", line 842, in _send_packed_command     await self._writer.drain()   File "/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/asyncio/streams.py", line 387, in drain     await self._protocol._drain_helper()   File "/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/asyncio/streams.py", line 190, in _drain_helper     raise ConnectionResetError('Connection lost') ConnectionResetError: Connection lost  Durin
  **Post-Mortem & Fix Analysis**:
  > Thanks for the feedback yangzhibo. We are aware of this issue, and have already fixed this in an un-released version. That version is estimated to be released in one week, along with several other features and improvements. Please stay tuned.
  > @YangZhiBoGreenHand In the v0.2.2 version, we have enhanced the stability of the redis client to avoid continued client downtime. Please check :-)

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

### Incident Patch 1: `c33aa1df` (2024-09-19)
**Commit Message**: fix: fix error message

**File**: `plugin/app/routes/verify.py` (modified, +2/-4)
```diff
@@ -38,23 +38,21 @@ async def api_verify_credentials(
     bundle_handler: BundleHandler = get_bundle_handler(data.bundle_id)
     if not bundle_handler:
         raise_http_error(ErrorCode.OBJECT_NOT_FOUND, f"Bundle {data.bundle_id} not found.")
-
     try:
-
         await bundle_handler.verify(data.credentials)
 
     except TKHttpException as e:
         if isinstance(getattr(e, "detail"), dict):
             message = e.detail.get("message")
             if message:
                 message = " " + message
-            e.detail["message"] = f"Model credentials validation failed.{message}"
+            e.detail["message"] = f"Plugin credentials validation failed.{message}"
         raise e
 
     except Exception as e:
         raise_http_error(
             ErrorCode.CREDENTIALS_VALIDATION_ERROR,
-            message="Model credentials validation failed, please check if your credentials are correct.",
+            message="Plugin credentials validation failed, please check if your credentials are correct.",
         )
 
     data.credentials.encrypt()
```

---

### Incident Patch 2: `add30eb0` (2024-10-08)
**Commit Message**: feat: add debug-chat-completion-delay30s model

**File**: `inference/providers/debug/chat_completion.py` (modified, +17/-0)
```diff
@@ -53,6 +53,15 @@ async def chat_completion(
     ):
         if provider_model_id == "debug-error" and messages[-1].content != "Only say your name":
             raise_http_error(ErrorCode.PROVIDER_ERROR, "Debug error for test")
+
+        if provider_model_id == "debug-chat-completion-delay":
+            # content format should be "#number#some other content"
+            message = messages[-1].content
+            second = int(message.split("#")[1]) if message.startswith("#") else 30
+            import asyncio
+
+            await asyncio.sleep(second)
+
         input_tokens = estimate_input_tokens(
             [message.model_dump() for message in messages],
             [function.model_dump() for function in functions] if functions else None,
@@ -99,6 +108,14 @@ async def chat_completion_stream(
         if provider_model_id == "debug-error":
             raise_http_error(ErrorCode.PROVIDER_ERROR, "Debug error for test")
 
+        if provider_model_id == "debug-chat-completion-delay":
+            # content format should be "#number#some other content"
+            message = messages[-1].content
+            second = int(message.split("#")[1]) if message.startswith("#") else 30
+            import asyncio
+
+            await asyncio.sleep(second)
+
         if provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.user:
             output_message = create_tool_call_hallucination_message()
             finish_reason = ChatCompletionFinishReason.function_calls
```

**File**: `inference/providers/debug/resources/i18n/en.yml` (modified, +3/-0)
```diff
@@ -5,6 +5,9 @@ debug_api_key_description: "debug"
 debug_chat_completion_name: "Debug Chat Completion"
 debug_chat_completion_description: "Debug chat completion model for testing purposes."
 
+debug_chat_completion_delay_name: "Debug Chat Completion Delay"
+debug_chat_completion_delay_description: "Chat completion model with a delay for testing response latency and behavior."
+
 debug_error_name: "Debug Error"
 debug_error_description: "Debug error model for testing purposes."
 
```

**File**: `inference/providers/debug/resources/models/debug-chat-completion-delay.yml` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+model_schema_id: debug/debug-chat-completion-delay
+provider_model_id: debug-chat-completion-delay
+type: chat_completion
+name: "i18n:debug_chat_completion_delay_name"
+description: "i18n:debug_chat_completion_delay_description"
+default_endpoint_url:
+
+
+properties:
+  function_call: false
+  streaming: true
+  input_token_limit: 8096
+  output_token_limit: 8096
+
+config_schemas:
+  - config_id: temperature
+  - config_id: top_p
+  - config_id: max_tokens
+  - config_id: stop
+  - config_id: top_k
+
+pricing:
+  input_token: 0
+  output_token: 0
+  unit: 1000
+  currency: USD
```

**File**: `inference/providers/debug/resources/models/debug-error.yml` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ default_endpoint_url:
 
 
 properties:
-  function_call: false
+  function_call: true
   streaming: true
   input_token_limit: 8096
   output_token_limit: 8096
```

**File**: `inference/test/test_chat_completion.py` (modified, +4/-3)
```diff
@@ -97,7 +97,7 @@ async def test_chat_completion_by_normal_function_call(self, test_data):
         message = test_data["message"]
         function_call = test_data["function_call"]
 
-        if not function_call or "azure" in model_schema_id or "openrouter" in model_schema_id:
+        if not function_call or "azure" in model_schema_id or "openrouter" or "debug-error" in model_schema_id:
             pytest.skip("Skip the test case without function call.")
         configs = {
             "temperature": 0.5,
@@ -287,6 +287,7 @@ async def test_chat_completion_by_stream_and_function_call(self, test_data):
             or not stream
             or "azure" in model_schema_id
             or "openrouter" in model_schema_id
+            or "debug-error" in model_schema_id
             or "togetherai" in model_schema_id
         ):
             pytest.skip("Skip the test case without function call or stream.")
@@ -384,7 +385,7 @@ async def test_chat_completion_by_function_call_and_length(self, test_data):
         if (
             not function_call
             or "google_gemini" in model_schema_id
-            or "debug-tool-call-hallucinations" in model_schema_id
+            or "debug" in model_schema_id
             or "sensetime" in model_schema_id
             or "openrouter" in model_schema_id
         ):
@@ -445,7 +446,7 @@ async def test_chat_completion_by_stream_and_function_call_and_length(self, test
             not function_call
             or not stream
             or "azure" in model_schema_id
-            or "debug-tool-call-hallucinations" in model_schema_id
+            or "debug" in model_schema_id
             or "mistralai" in model_schema_id
             or "google_gemini" in model_schema_id
             or "sensetime" in model_schema_id
```

---

### Incident Patch 3: `38a9d324` (2024-10-10)
**Commit Message**: fix: fix test-inference ci

**File**: `.github/workflows/test-inference.yml` (modified, +2/-1)
```diff
@@ -96,4 +96,5 @@ jobs:
         run: |
           cd ${{ env.WORKING_DIRECTORY }}
           export PROVIDER_URL_BLACK_LIST="tasking.ai"
-          bash ./test/run_test.sh /tmp/changed_files.txt
\ No newline at end of file
+          export MODE=test
+          bash ./test/run_test.sh /tmp/changed_files.txt
```

**File**: `inference/test/utils/wildcard_test_cases.yml` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ wildcard_test_cases:
   - provider_id: "openrouter"
     cases:
       - model_schema_id: "openrouter/wildcard"
-        provider_model_id: "mattshumer/reflection-70b:free"
+        provider_model_id: "qwen/qwen-2-7b-instruct:free"
         model_type: "chat_completion"
         streaming: True
         function_call: True
```

---

### Incident Patch 4: `078c494d` (2024-09-11)
**Commit Message**: feat: add debug-tool-call-hallucinations

**File**: `inference/providers/debug/chat_completion.py` (modified, +17/-15)
```diff
@@ -15,17 +15,19 @@ def _build_debug_response(message: ChatCompletionMessage):
     return message.content
 
 
-TOOL_CALL_HALLUCINATION_MESSAGE = ChatCompletionAssistantMessage(
-    content=None,
-    role=ChatCompletionRole.assistant,
-    function_calls=[
-        {
-            "id": "P3lffDFvUpOJW3PxfB8ecoqw",
-            "name": "make_scatter_plot",
-            "arguments": {"x_values": [1, 2], "y_values": [3, 4]},
-        }
-    ],
-)
+def create_tool_call_hallucination_message():
+    return ChatCompletionAssistantMessage(
+        content=None,
+        role=ChatCompletionRole.assistant,
+        function_calls=[
+            {
+                "id": generate_random_function_call_id(),
+                "name": "make_scatter_plot",
+                "arguments": {"x_values": [1, 2], "y_values": [3, 4]},
+            }
+        ],
+    )
+
 
 ASSISTANT_CONTENT_DEBUG_MESSAGE = ChatCompletionAssistantMessage(
     content="Test Message",
@@ -58,13 +60,13 @@ async def chat_completion(
         )
         if provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.user:
             finish_reason = ChatCompletionFinishReason.function_calls
-            message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            message = create_tool_call_hallucination_message()
         elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
             finish_reason = ChatCompletionFinishReason.stop
             message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
         elif provider_model_id == "debug-tool-call-hallucinations-2":
             finish_reason = ChatCompletionFinishReason.function_calls
-            message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            message = create_tool_call_hallucination_message()
         else:
             finish_reason = ChatCompletionFinishReason.stop
             message_content = _build_debug_response(messages[-1])
@@ -98,13 +100,13 @@ async def chat_completion_stream(
             raise_http_error(ErrorCode.PROVIDER_ERROR, "Debug error for test")
 
         if provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.user:
-            output_message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            output_message = create_tool_call_hallucination_message()
             finish_reason = ChatCompletionFinishReason.function_calls
         elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
             output_message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
             finish_reason = ChatCompletionFinishReason.stop
         elif provider_model_id == "debug-tool-call-hallucinations-2":
-            output_message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            output_message = create_tool_call_hallucination_message()
             finish_reason = ChatCompletionFinishReason.function_calls
         else:
             # Extract the last message
```

---

### Incident Patch 5: `93d1eee6` (2024-09-11)
**Commit Message**: feat: add debug-tool-call-hallucinations-2

**File**: `inference/providers/debug/chat_completion.py` (modified, +6/-0)
```diff
@@ -62,6 +62,9 @@ async def chat_completion(
         elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
             finish_reason = ChatCompletionFinishReason.stop
             message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
+        elif provider_model_id == "debug-tool-call-hallucinations-2":
+            finish_reason = ChatCompletionFinishReason.function_calls
+            message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
         else:
             finish_reason = ChatCompletionFinishReason.stop
             message_content = _build_debug_response(messages[-1])
@@ -100,6 +103,9 @@ async def chat_completion_stream(
         elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
             output_message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
             finish_reason = ChatCompletionFinishReason.stop
+        elif provider_model_id == "debug-tool-call-hallucinations-2":
+            output_message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            finish_reason = ChatCompletionFinishReason.function_calls
         else:
             # Extract the last message
             message_content = _build_debug_response(messages[-1])
```

**File**: `inference/providers/debug/resources/i18n/en.yml` (modified, +3/-0)
```diff
@@ -11,6 +11,9 @@ debug_error_description: "Debug error model for testing purposes."
 debug_tool_call_hallucinations_name: "Debug Tool Call Hallucinations"
 debug_tool_call_hallucinations_description: "Debug chat completion model with tool call hallucinations for testing purposes."
 
+debug_tool_call_hallucinations_2_name: "Debug Tool Call Hallucinations 2"
+debug_tool_call_hallucinations_2_description: "Debug chat completion model with tool call hallucinations 2 for testing purposes."
+
 debug_text_embedding_256_name: "Debug Text Embedding 256"
 debug_text_embedding_256_description: "Debug text embedding model with 256 dimensions for testing purposes."
 
```

**File**: `inference/providers/debug/resources/models/debug-tool-call-hallucinations-2.yml` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+model_schema_id: debug/debug-tool-call-hallucinations-2
+provider_model_id: debug-tool-call-hallucinations-2
+type: chat_completion
+name: "i18n:debug_tool_call_hallucinations_2_name"
+description: "i18n:debug_tool_call_hallucinations_2_description"
+default_endpoint_url:
+
+
+properties:
+  function_call: true
+  streaming: true
+  input_token_limit: 8096
+  output_token_limit: 8096
+
+config_schemas:
+  - config_id: temperature
+  - config_id: top_p
+  - config_id: max_tokens
+  - config_id: stop
+  - config_id: top_k
+
+pricing:
+  input_token: 0
+  output_token: 0
+  unit: 1000
+  currency: USD
```

---

### Incident Patch 6: `3d951e56` (2024-09-11)
**Commit Message**: feat: add debug-tool-call-result

**File**: `inference/providers/debug/chat_completion.py` (modified, +13/-3)
```diff
@@ -27,6 +27,11 @@ def _build_debug_response(message: ChatCompletionMessage):
     ],
 )
 
+ASSISTANT_CONTENT_DEBUG_MESSAGE = ChatCompletionAssistantMessage(
+    content="Test Message",
+    role=ChatCompletionRole.assistant,
+)
+
 
 class DebugChatCompletionModel(BaseChatCompletionModel):
     def __init__(self):
@@ -51,9 +56,12 @@ async def chat_completion(
             [function.model_dump() for function in functions] if functions else None,
             function_call,
         )
-        if provider_model_id == "debug-tool-call-hallucinations":
+        if provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.user:
             finish_reason = ChatCompletionFinishReason.function_calls
             message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+        elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
+            finish_reason = ChatCompletionFinishReason.stop
+            message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
         else:
             finish_reason = ChatCompletionFinishReason.stop
             message_content = _build_debug_response(messages[-1])
@@ -86,10 +94,12 @@ async def chat_completion_stream(
         if provider_model_id == "debug-error":
             raise_http_error(ErrorCode.PROVIDER_ERROR, "Debug error for test")
 
-        if provider_model_id == "debug-tool-call-hallucinations":
+        if provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.user:
             output_message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
             finish_reason = ChatCompletionFinishReason.function_calls
-
+        elif provider_model_id == "debug-tool-call-hallucinations" and messages[-1].role == ChatCompletionRole.function:
+            output_message = copy.deepcopy(ASSISTANT_CONTENT_DEBUG_MESSAGE)
+            finish_reason = ChatCompletionFinishReason.stop
         else:
             # Extract the last message
             message_content = _build_debug_response(messages[-1])
```

**File**: `inference/test/test_chat_completion.py` (modified, +8/-1)
```diff
@@ -51,7 +51,12 @@ class TestChatCompletion:
     async def test_chat_completion_by_normal(self, test_data):
         model_schema_id = test_data["model_schema_id"]
         message = [{"role": "user", "content": "Hello, nice to meet you, what is your name"}]
-        if "debug-error" in model_schema_id or "azure" in model_schema_id or "hugging_face" in model_schema_id:
+        if (
+            "debug-error" in model_schema_id
+            or "azure" in model_schema_id
+            or "hugging_face" in model_schema_id
+            or "debug-tool-call-hallucinations" in model_schema_id
+        ):
             pytest.skip("Skip the test case with debug-error.")
         configs = {
             "temperature": 0.5,
@@ -379,6 +384,7 @@ async def test_chat_completion_by_function_call_and_length(self, test_data):
         if (
             not function_call
             or "google_gemini" in model_schema_id
+            or "debug-tool-call-hallucinations" in model_schema_id
             or "sensetime" in model_schema_id
             or "openrouter" in model_schema_id
         ):
@@ -439,6 +445,7 @@ async def test_chat_completion_by_stream_and_function_call_and_length(self, test
             not function_call
             or not stream
             or "azure" in model_schema_id
+            or "debug-tool-call-hallucinations" in model_schema_id
             or "mistralai" in model_schema_id
             or "google_gemini" in model_schema_id
             or "sensetime" in model_schema_id
```

---

### Incident Patch 7: `b52d6141` (2024-09-11)
**Commit Message**: fix: fix verify credentials for debug-tool-call

**File**: `inference/app/routes/verify/route.py` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ async def api_verify_credentials(
                     proxy=data.proxy,
                     custom_headers=data.custom_headers,
                 )
-                if response.message.content is None:
+                if not response.message.content and not response.message.function_calls:
                     raise_http_error(ErrorCode.CREDENTIALS_VALIDATION_ERROR, error_message)
         elif model_type == ModelType.TEXT_EMBEDDING:
             from ..text_embedding.route import embed_text
```

---

### Incident Patch 8: `8240f3e5` (2024-09-06)
**Commit Message**: feat: add debug-tool-call-hallucinations

**File**: `inference/providers/debug/chat_completion.py` (modified, +45/-22)
```diff
@@ -1,4 +1,5 @@
 from app.models import ModelSchema
+import copy
 from provider_dependency.chat_completion import *
 from app.models.tokenizer import estimate_input_tokens, estimate_response_tokens
 from typing import List, Dict, Optional
@@ -14,6 +15,19 @@ def _build_debug_response(message: ChatCompletionMessage):
     return message.content
 
 
+TOOL_CALL_HALLUCINATION_MESSAGE = ChatCompletionAssistantMessage(
+    content=None,
+    role=ChatCompletionRole.assistant,
+    function_calls=[
+        {
+            "id": "P3lffDFvUpOJW3PxfB8ecoqw",
+            "name": "make_scatter_plot",
+            "arguments": {"x_values": [1, 2], "y_values": [3, 4]},
+        }
+    ],
+)
+
+
 class DebugChatCompletionModel(BaseChatCompletionModel):
     def __init__(self):
         super().__init__()
@@ -37,11 +51,14 @@ async def chat_completion(
             [function.model_dump() for function in functions] if functions else None,
             function_call,
         )
-
-        finish_reason = ChatCompletionFinishReason.stop
-        message_content = _build_debug_response(messages[-1])
-        message_content = message_content[(len(message_content) // 2) :].strip()
-        message = ChatCompletionAssistantMessage(content=message_content)
+        if provider_model_id == "debug-tool-call-hallucinations":
+            finish_reason = ChatCompletionFinishReason.function_calls
+            message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+        else:
+            finish_reason = ChatCompletionFinishReason.stop
+            message_content = _build_debug_response(messages[-1])
+            message_content = message_content[(len(message_content) // 2) :].strip()
+            message = ChatCompletionAssistantMessage(content=message_content)
         output_tokens = estimate_response_tokens(message.model_dump())
         response = ChatCompletion(
             finish_reason=finish_reason,
@@ -69,32 +86,38 @@ async def chat_completion_stream(
         if provider_model_id == "debug-error":
             raise_http_error(ErrorCode.PROVIDER_ERROR, "Debug error for test")
 
+        if provider_model_id == "debug-tool-call-hallucinations":
+            output_message = copy.deepcopy(TOOL_CALL_HALLUCINATION_MESSAGE)
+            finish_reason = ChatCompletionFinishReason.function_calls
+
+        else:
+            # Extract the last message
+            message_content = _build_debug_response(messages[-1])
+            message_content = message_content[(len(message_content) // 2) :].strip()
+            # Split the message content into words
+            words = message_content.split()
+
+            # Simulate the streaming response by yielding each word
+            for i, word in enumerate(words):
+                yield ChatCompletionChunk(
+                    created_timestamp=get_current_timestamp_int(),
+                    index=i,
+                    delta=word,
+                )
+            output_message = ChatCompletionAssistantMessage(content=message_content)
+            finish_reason = ChatCompletionFinishReason.stop
+
         input_tokens = estimate_input_tokens(
             [message.model_dump() for message in messages],
             [function.model_dump() for function in functions] if functions else None,
             function_call,
         )
-        # Extract the last message
-        message_content = _build_debug_response(messages[-1])
-        message_content = message_content[(len(message_content) // 2) :].strip()
-        # Split the message content into words
-        words = message_content.split()
-
-        # Simulate the streaming response by yielding each word
-        for i, word in enumerate(words):
-            yield ChatCompletionChunk(
-                created_timestamp=get_current_timestamp_int(),
-                index=i,
-                delta=word,
-            )
-        message = ChatCompletionAssistantMessage(content=message_content)
-        output_tokens = estimate_response_tokens(me
```

**File**: `inference/providers/debug/resources/i18n/en.yml` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@ debug_chat_completion_description: "Debug chat completion model for testing purp
 debug_error_name: "Debug Error"
 debug_error_description: "Debug error model for testing purposes."
 
+debug_tool_call_hallucinations_name: "Debug Tool Call Hallucinations"
+debug_tool_call_hallucinations_description: "Debug chat completion model with tool call hallucinations for testing purposes."
+
 debug_text_embedding_256_name: "Debug Text Embedding 256"
 debug_text_embedding_256_description: "Debug text embedding model with 256 dimensions for testing purposes."
 
```

**File**: `inference/providers/debug/resources/models/debug-tool-call-hallucinations.yml` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+model_schema_id: debug/debug-tool-call-hallucinations
+provider_model_id: debug-tool-call-hallucinations
+type: chat_completion
+name: "i18n:debug_tool_call_hallucinations_name"
+description: "i18n:debug_tool_call_hallucinations_description"
+default_endpoint_url:
+
+
+properties:
+  function_call: true
+  streaming: true
+  input_token_limit: 8096
+  output_token_limit: 8096
+
+config_schemas:
+  - config_id: temperature
+  - config_id: top_p
+  - config_id: max_tokens
+  - config_id: stop
+  - config_id: top_k
+
+pricing:
+  input_token: 0
+  output_token: 0
+  unit: 1000
+  currency: USD
```

---

### Incident Patch 9: `98137dc5` (2024-08-23)
**Commit Message**: fix: resolved a bug for the number generator

**File**: `plugin/bundles/random_number_generator/plugins/generate_random_integers/plugin.py` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ class GenerateRandomIntegers(PluginHandler):
     async def execute(self, credentials: BundleCredentials, plugin_input: PluginInput) -> PluginOutput:
         min: int = plugin_input.input_params.get("min")
         max: int = plugin_input.input_params.get("max")
-        number: int = plugin_input.input_params.get("number")
+        number: int = plugin_input.input_params.get("number", 1)
 
         if min >= max:
             raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, "min should be less than max")
```

---

### Incident Patch 10: `74b0e95e` (2024-08-09)
**Commit Message**: fix: handle stream mode for Hugging Face

**File**: `inference/providers/hugging_face/chat_completion.py` (modified, +33/-3)
```diff
@@ -45,6 +45,7 @@ def _build_hugging_face_text_generation_payload(
             "max_new_tokens": configs.max_tokens,
             "top_k": configs.top_k,
         },
+        "stream": stream,
     }
     return payload
 
@@ -70,8 +71,6 @@ async def prepare_request(
         base_url = "https://api-inference.huggingface.co/models/PLACE_HOLDER_MODEL_ID"
         api_url = base_url.replace("PLACE_HOLDER_MODEL_ID", provider_model_id)
         headers = _build_hugging_face_header(credentials)
-        if stream:
-            raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, "Hugging Face does not support streaming.")
         if functions:
             raise_http_error(ErrorCode.REQUEST_VALIDATION_ERROR, "Hugging Face does not support function calls.")
         payload = _build_hugging_face_text_generation_payload(messages, stream, provider_model_id, configs)
@@ -92,4 +91,35 @@ def extract_function_calls(self, data: Dict, **kwargs) -> Optional[List[ChatComp
         pass
 
     def extract_finish_reason(self, data: Dict, **kwargs) -> Optional[ChatCompletionFinishReason]:
-        return ChatCompletionFinishReason.unknown
+        return ChatCompletionFinishReason.stop
+
+    # ------------------- handle stream chat completion response -------------------
+
+    def stream_check_error(self, sse_data: Dict, **kwargs):
+        if sse_data.get("error"):
+            raise_provider_api_error(sse_data["error"])
+
+    def stream_extract_chunk_data(self, sse_data: Dict, **kwargs) -> Optional[Dict]:
+        if not sse_data.get("generated_text"):
+            return None
+        return sse_data
+
+    def stream_extract_chunk(
+        self, index: int, chunk_data: Dict, text_content: str, **kwargs
+    ) -> Tuple[int, Optional[ChatCompletionChunk]]:
+        content = chunk_data.get("generated_text", None)
+        if content:
+            return index + 1, ChatCompletionChunk(
+                created_timestamp=get_current_timestamp_int(),
+                index=index,
+                delta=content,
+            )
+        return index, None
+
+    def stream_extract_finish_reason(self, chunk_data: Dict, **kwargs) -> Optional[ChatCompletionFinishReason]:
+        return ChatCompletionFinishReason.stop
+
+    def stream_handle_function_calls(
+        self, chunk_data: Dict, function_calls_content: ChatCompletionFunctionCallsContent, **kwargs
+    ) -> Optional[ChatCompletionFunctionCallsContent]:
+        pass
```

**File**: `inference/providers/hugging_face/resources/provider.yml` (modified, +3/-0)
```diff
@@ -3,6 +3,9 @@ name: "i18n:hugging_face_name"
 description: "i18n:hugging_face_description"
 updated_timestamp: 1707152831000
 
+return_token_usage: false
+return_stream_token_usage: false
+
 credentials_schema:
   type: object
   properties:
```

#### Recent Merged Pull Requests:
- **PR #379** (closed): docs(inference): add DaoXE Custom Host OpenAI-compatible example (@seven7763)
- **PR #378** (closed): feat: add DaoXE OpenAI-compatible model provider (@seven7763)
- **PR #369** (closed): done (@darryk10)
- **PR #356** (closed): feat: add a new provider xAI (@LinkW77)
- **PR #355** (2024-10-31): chore: update plugin version (@SimsonW)
- **PR #353** (closed): feat: add a new plugin vectorizer ai (@LinkW77)
- **PR #352** (closed): feat: add a new plugin tavily (@LinkW77)
- **PR #351** (closed): feat: add a new plugin serply (@LinkW77)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
