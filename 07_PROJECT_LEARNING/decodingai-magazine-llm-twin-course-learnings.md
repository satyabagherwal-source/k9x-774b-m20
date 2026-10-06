# Forensic Learning Record (Deep Inspection): decodingai-magazine/llm-twin-course

> **Canonical Artifact**: `07_PROJECT_LEARNING/decodingai-magazine-llm-twin-course-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/decodingai-magazine/llm-twin-course](https://github.com/decodingai-magazine/llm-twin-course))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:14:06.757Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `decodingai-magazine/llm-twin-course`
- **Description**: 🤖 𝗟𝗲𝗮𝗿𝗻 for 𝗳𝗿𝗲𝗲 how to 𝗯𝘂𝗶𝗹𝗱 an end-to-end 𝗽𝗿𝗼𝗱𝘂𝗰𝘁𝗶𝗼𝗻-𝗿𝗲𝗮𝗱𝘆 𝗟𝗟𝗠 & 𝗥𝗔𝗚 𝘀𝘆𝘀𝘁𝗲𝗺 using 𝗟𝗟𝗠𝗢𝗽𝘀 best practices: ~ 𝘴𝘰𝘶𝘳𝘤𝘦 𝘤𝘰𝘥𝘦 + 12 𝘩𝘢𝘯𝘥𝘴-𝘰𝘯 𝘭𝘦𝘴𝘴𝘰𝘯𝘴
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4390 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/bonus_superlinked_rag/models/utils.py`
```
from typing import Any, Callable, Dict, List, Optional

import pandas as pd
from pydantic import BaseModel

from models.documents import Document


def pydantic_models_to_dataframe(
    models: List[BaseModel], index_column: Optional[str] = "id"
) -> pd.DataFrame:
    """
    Converts a list of Pydantic models to a Pandas DataFrame.

    Args:
    models (List[BaseModel]): List of Pydantic models.

    Returns:
    pd.DataFrame: DataFrame containing the data from the Pydantic models.
    """

    if not models:
        return pd.DataFrame()

    # Convert each model to a dictionary and create a list of dictionaries
    data = [model.model_dump() for model in models]

    # Create a DataFrame from the list of dictionaries
    df = pd.DataFrame(data)

    if index_column in df.columns:
        df["index"] = df[index_column]
    else:
        raise RuntimeError(f"Index column '{index_column}' not found in DataFrame.")

    return df


def group_by_type(documents: list[Document]) -> Dict[str, list[Document]]:
    return _group_by(documents, selector=lambda doc: doc.type)


def _group_by(documents: list[Document], selector: Callable) -> Dict[Any, list]:
    grouped = {}
    for doc in documents:
        key = selector(doc)

        if key not in grouped:
            grouped[key] = []
        grouped[key].append(doc)

    return grouped

```

### Core Architecture Module: `src/bonus_superlinked_rag/server/runner/executor/app/util/fast_api_handler.py`
```
# Copyright 2024 Superlinked, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from typing import Any

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import Field
from superlinked.framework.common.util.immutable_model import ImmutableBaseModel
from superlinked.framework.dsl.executor.rest.rest_handler import RestHandler


class QueryResponse(ImmutableBaseModel):
    schema_: str = Field(..., alias="schema")
    results: list[dict[str, Any]]


class FastApiHandler:
    def __init__(self, rest_handler: RestHandler) -> None:
        self.__rest_handler = rest_handler

    async def ingest(self, request: Request) -> Response:
        payload = await request.json()
        self.__rest_handler._ingest_handler(payload, request.url.path)  # noqa: SLF001 private-member-access
        return Response(status_code=status.HTTP_202_ACCEPTED)

    async def query(self, request: Request) -> Response:
        payload = await request.json()
        result = self.__rest_handler._query_handler(payload, request.url.path)  # noqa: SLF001 private-member-access
        query_response = QueryResponse(
            schema=result.schema._schema_name,  # noqa: SLF001 private-member-access
            results=[
                {
                    "entity": {
                        "id": entry.entity.header.object_id,
                        "origin": (
                            {
                                "id": entry.entity.header.object_id,
                                "schema": entry.entity.header.schema_id,
                            }
                            if entry.entity.header.origin_id
                            else {}
                        ),
                    },
                    "obj": entry.stored_object,
                }
                for entry in result.entries
            ],
        )
        return JSONResponse(
            content=query_response.model_dump(by_alias=True),
            status_code=status.HTTP_200_OK,
        )

```

### Core Architecture Module: `src/bonus_superlinked_rag/server/runner/executor/app/util/open_api_description_util.py`
```
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


class OpenApiDescriptionUtil:
    @staticmethod
    def get_open_api_description_by_key(key: str, file_path: str | None = None) -> dict[str, Any]:
        if file_path is None:
            file_path = os.path.join(os.getcwd(), "executor/openapi/static_endpoint_descriptor.json")
        with open(file_path, encoding="utf-8") as file:
            data = json.load(file)
            open_api_description = data.get(key)
            if open_api_description is None:
                logger.warning("No OpenAPI description found for key: %s", key)
            return open_api_description

```

### Core Architecture Module: `src/bonus_superlinked_rag/server/runner/executor/app/util/registry_loader.py`
```
# Copyright 2024 Superlinked, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import logging
from importlib import import_module

from superlinked.framework.dsl.registry.superlinked_registry import SuperlinkedRegistry

logger = logging.getLogger(__name__)


class RegistryLoader:
    @staticmethod
    def get_registry(app_module_path: str) -> SuperlinkedRegistry | None:
        try:
            return import_module(app_module_path).SuperlinkedRegistry
        except ImportError:
            logger.exception("Module not found at: %s", app_module_path)
        except AttributeError:
            logger.exception("SuperlinkedRegistry not found in module: %s", app_module_path)
        except Exception:  # pylint: disable=broad-exception-caught
            logger.exception("An unexpected error occurred while loading the module at: %s", app_module_path)
        return None

```

### Core Architecture Module: `src/bonus_superlinked_rag/utils/__init__.py`
```
def flatten(nested_list: list) -> list:
    """Flatten a list of lists into a single list."""

    return [item for sublist in nested_list for item in sublist]

```

### Core Architecture Module: `src/bonus_superlinked_rag/utils/cleaning.py`
```
import re

from unstructured.cleaners.core import (
    clean,
    clean_non_ascii_chars,
    replace_unicode_quotes,
)


def unbold_text(text):
    # Mapping of bold numbers to their regular equivalents
    bold_numbers = {
        "𝟬": "0",
        "𝟭": "1",
        "𝟮": "2",
        "𝟯": "3",
        "𝟰": "4",
        "𝟱": "5",
        "𝟲": "6",
        "𝟳": "7",
        "𝟴": "8",
        "𝟵": "9",
    }

    # Function to convert bold characters (letters and numbers)
    def convert_bold_char(match):
        char = match.group(0)
        # Convert bold numbers
        if char in bold_numbers:
            return bold_numbers[char]
        # Convert bold uppercase letters
        elif "\U0001d5d4" <= char <= "\U0001d5ed":
            return chr(ord(char) - 0x1D5D4 + ord("A"))
        # Convert bold lowercase letters
        elif "\U0001d5ee" <= char <= "\U0001d607":
            return chr(ord(char) - 0x1D5EE + ord("a"))
        else:
            return char  # Return the character unchanged if it's not a bold number or letter

    # Regex for bold characters (numbers, uppercase, and lowercase letters)
    bold_pattern = re.compile(
        r"[\U0001D5D4-\U0001D5ED\U0001D5EE-\U0001D607\U0001D7CE-\U0001D7FF]"
    )
    text = bold_pattern.sub(convert_bold_char, text)

    return text


def unitalic_text(text):
    # Function to convert italic characters (both letters)
    def convert_italic_char(match):
        char = match.group(0)
        # Unicode ranges for italic characters
        if "\U0001d608" <= char <= "\U0001d621":  # Italic uppercase A-Z
            return chr(ord(char) - 0x1D608 + ord("A"))
        elif "\U0001d622" <= char <= "\U0001d63b":  # Italic lowercase a-z
            return chr(ord(char) - 0x1D622 + ord("a"))
        else:
            return char  # Return the character unchanged if it's not an italic letter

    # Regex for italic characters (uppercase and lowercase letters)
    italic_pattern = re.compile(r"[\U0001D608-\U0001D621\U0001D622-\U0001D63B]")
    text = italic_pattern.sub(convert_italic_char, text)

    return text


def remove_emojis_and_symbols(text):
    # Extended pattern to include specific symbols like ↓ (U+2193) or ↳ (U+21B3)
    emoji_and_symbol_pattern = re.compile(
        "["
        "\U0001f600-\U0001f64f"  # emoticons
        "\U0001f300-\U0001f5ff"  # symbols & pictographs
        "\U0001f680-\U0001f6ff"  # transport & map symbols
        "\U0001f1e0-\U0001f1ff"  # flags (iOS)
        "\U00002193"  # downwards arrow
        "\U000021b3"  # downwards arrow with tip rightwards
        "\U00002192"  # rightwards arrow
        "]+",
        flags=re.UNICODE,
    )

    return emoji_and_symbol_pattern.sub(r" ", text)


def replace_urls_with_placeholder(text, placeholder="[URL]"):
    # Regular expression pattern for matching URLs
    url_pattern = r"https?://\S+|www\.\S+"

    return re.sub(url_pattern, placeholder, text)


def remove_non_ascii(text: str) -> str:
    text = text.encode("ascii", "ignore").decode("ascii")
    return text


def clean_text(text_content: str) -> str:
    cleaned_text = unbold_text(text_content)
    cleaned_text = unitalic_text(cleaned_text)
    cleaned_text = remove_emojis_and_symbols(cleaned_text)
    cleaned_text = clean(cleaned_text)
    cleaned_text = replace_unicode_quotes(cleaned_text)
    cleaned_text = clean_non_ascii_chars(cleaned_text)
    cleaned_text = replace_urls_with_placeholder(cleaned_text)

    return cleaned_text

```

### Core Architecture Module: `src/bonus_superlinked_rag/utils/logging.py`
```
import structlog


def get_logger(cls: str):
    return structlog.get_logger().bind(cls=cls)
```

### Core Architecture Module: `src/core/__init__.py`
```
from . import db, logger_utils, opik_utils
from .logger_utils import get_logger

logger = get_logger(__file__)

try:
    from .opik_utils import configure_opik

    configure_opik()
except:
    logger.warning("Could not configure Opik.")

__all__ = ["get_logger", "logger_utils", "opik_utils", "db"]

```

### Core Architecture Module: `src/core/aws/__init__.py`
```


```

### Core Architecture Module: `src/core/aws/create_execution_role.py`
```
import json
from pathlib import Path

from core.logger_utils import get_logger

logger = get_logger(__file__)

try:
    import boto3
except ModuleNotFoundError:
    logger.warning(
        "Couldn't load AWS or SageMaker imports. Run 'poetry install --with aws' to support AWS."
    )

from core.config import settings


def create_sagemaker_execution_role(role_name: str):
    assert settings.AWS_REGION, "AWS_REGION is not set."
    assert settings.AWS_ACCESS_KEY, "AWS_ACCESS_KEY is not set."
    assert settings.AWS_SECRET_KEY, "AWS_SECRET_KEY is not set."

    # Create IAM client
    iam = boto3.client(
        "iam",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY,
        aws_secret_access_key=settings.AWS_SECRET_KEY,
    )

    # Define the trust relationship policy
    trust_relationship = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"Service": "sagemaker.amazonaws.com"},
                "Action": "sts:AssumeRole",
            }
        ],
    }

    try:
        # Create the IAM role
        role = iam.create_role(
            RoleName=role_name,
            AssumeRolePolicyDocument=json.dumps(trust_relationship),
            Description="Execution role for SageMaker",
        )

        # Attach necessary policies
        policies = [
            "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess",
            "arn:aws:iam::aws:policy/AmazonS3FullAccess",
            "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess",
            "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess",
        ]

        for policy in policies:
            iam.attach_role_policy(RoleName=role_name, PolicyArn=policy)

        logger.info(f"Role '{role_name}' created successfully.")
        logger.info(f"Role ARN: {role['Role']['Arn']}")

        return role["Role"]["Arn"]

    except iam.exceptions.EntityAlreadyExistsException:
        logger.warning(f"Role '{role_name}' already exists. Fetching its ARN...")
        role = iam.get_role(RoleName=role_name)

        return role["Role"]["Arn"]


if __name__ == "__main__":
    role_arn = create_sagemaker_execution_role("SageMakerExecutionRoleLLM")
    logger.info(role_arn)

    # Save the role ARN to a file
    with Path("sagemaker_execution_role.json").open("w") as f:
        json.dump({"RoleArn": role_arn}, f)

    logger.info("Role ARN saved to 'sagemaker_execution_role.json'")

```

### Core Architecture Module: `src/core/aws/create_sagemaker_role.py`
```
import json
from pathlib import Path

from logger_utils import get_logger

logger = get_logger(__file__)

try:
    import boto3
except ModuleNotFoundError:
    logger.warning(
        "Couldn't load AWS or SageMaker imports. Run 'poetry install --with aws' to support AWS."
    )

from config import settings


def create_sagemaker_user(username: str):
    assert settings.AWS_REGION, "AWS_REGION is not set."
    assert settings.AWS_ACCESS_KEY, "AWS_ACCESS_KEY is not set."
    assert settings.AWS_SECRET_KEY, "AWS_SECRET_KEY is not set."

    # Create IAM client
    iam = boto3.client(
        "iam",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY,
        aws_secret_access_key=settings.AWS_SECRET_KEY,
    )

    # Create user
    iam.create_user(UserName=username)

    # Attach necessary policies
    policies = [
        "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess",
        "arn:aws:iam::aws:policy/AWSCloudFormationFullAccess",
        "arn:aws:iam::aws:policy/IAMFullAccess",
        "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess",
        "arn:aws:iam::aws:policy/AmazonS3FullAccess",
    ]

    for policy in policies:
        iam.attach_user_policy(UserName=username, PolicyArn=policy)

    # Create access key
    response = iam.create_access_key(UserName=username)
    access_key = response["AccessKey"]

    logger.info(f"User '{username}' successfully created.")
    logger.info("Access Key ID and Secret Access Key successfully created.")

    return {
        "AccessKeyId": access_key["AccessKeyId"],
        "SecretAccessKey": access_key["SecretAccessKey"],
    }


if __name__ == "__main__":
    new_user = create_sagemaker_user("sagemaker-deployer")

    with Path("sagemaker_user_credentials.json").open("w") as f:
        json.dump(new_user, f)

logger.info("Credentials saved to 'sagemaker_user_credentials.json'")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #50** (2025-02-06): **What is the difference between the book project and this one? Is this more updated or more complete?**
  *Symptoms*: Hello, I'm reading the book and found it amazing. Later, I found this repository that seems to be more updated and maybe more complete, with chapters that I think are not in the book. How does the project of this repository align with the project of the book? Is one more complete, or do they complement each other?
  **Post-Mortem & Fix Analysis**:
  > Hello @rhuanbarros ,  This is a subset of what you will find in the book.  Some parts, such as the streaming pipeline, are found only here and not in the book. There are some overlaps, but the idea is that code bases are different: this code is a subset of the one found in the book. 
  > Nice, thank you

- **Issue #46** (2024-12-09): **Deploy-inference-pipeline **
  *Symptoms*: I cannot find the code for deploying the inference pipeline In AWS sage maker. There is only code for deploying the Fine-tuned model in cloud. I think the code is missing in the repo.
  **Post-Mortem & Fix Analysis**:
  > Hello @sandeshchand87 ,  We support AWS SageMaker deployments.  Please check out these resources: - Lesson 9: https://medium.com/decodingml/beyond-proof-of-concept-building-rag-systems-that-scale-e537d0eb063a - Code: https://github.com/decodingml/llm-twin-course/blob/main/src/inference_pipeline/aws/deploy_sagemaker_endpoint.py

- **Issue #45** (2024-11-21): **Fix typos**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > There's some methods and variables with wrong names (`embedd_text` / `articles_space_plaform`) but I figured the code needs a bit more stability given that it might be reproduced in the book etc.
  > Thanks for contributing @strickvl !  Missed these ones.
  > Accepted!

- **Issue #44** (2024-11-19): ** Source Code and Tutorials are not aligned**
  *Symptoms*: I have checked the “Inference pipeline: Serve your LLM Twin” tutorial, Chapter 9 (Architect scalable and cost-effective LLM & RAG inference pipelines). I could not find the code for the inference pipeline in the GitHub repository at src/inference_pipeline/llm_twin.py. Have you updated the code on GitHub?
  **Post-Mortem & Fix Analysis**:
  > Hello @sandeshchand87,  I just remaster the whole course, here is the inference pipeline lesson equivalent: https://medium.com/decodingml/beyond-proof-of-concept-building-rag-systems-that-scale-e537d0eb063a  Everything is smoother and easier to run now

- **Issue #43** (2024-11-15): **fix: Training & evaluation mintor bugs**
  *Symptoms*: 

- **Issue #42** (2024-11-12): **Feat/integrate opik**
  *Symptoms*: 

- **Issue #41** (2024-11-19): **running crawler on AWS Lambda**
  *Symptoms*: Hello,  Thanks a lot for the nice course. I'm following along and trying to make everything work. I can't get the AWS Lambda to work (it's timing out). I guess that's because I haven't figured out how to connect it with MongoDB. Everything works locally with Docker Compose since MongoDB has 3 separate containers, ports are mapped to crawler etc, but from what I can see, deploying the crawler to AWS only creates the crawler container, so there's not MongoDB to talk to. It would be good to have more details on how to make this part of the pipeline run on the cloud as well.
  **Post-Mortem & Fix Analysis**:
  > Hello,  Unfortunately, we don't support full AWS deployment anymore.

- **Issue #39** (2024-11-19): **TypeError: No constructor defined**
  *Symptoms*: I am encountering a TypeError: No constructor defined error when using the flat_map_batch operator in Bytewax. The error occurs during the execution of my data flow pipeline, which uses a series of custom dispatchers for data processing. The error message provided by the runtime is as follows: ``` TypeError: (src/operators.rs:206:80) error calling `mapper` in step "Stream Ingestion Pipeline.Raw Dispatcher.flat_map_batch" Caused by => TypeError: No constructor defined ``` ### Error Details Below is the full stack trace of the error: ``` comet_ml is installed but `COMET_API_KEY` is not set. 2024-09-17 17:18:20 [info     ] Received message.              cls=app.feature_pipeline.data_logic.dispatchers data_type=posts thread '<unnamed>' panicked at src/operators.rs:198:33: Box<dyn Any> stack backtrace:    0:     0x7ab1e936cb7c - std::backtrace_rs::backtrace::libunwind::trace::ha69d38c49f1bf263    ... Traceback (most recent call last):   File "<frozen runpy>", line 198, in _run_module_as_main   File "<frozen runpy>", line 88, in _run_code   File "/home/weyon2/miniconda3/envs/job_recom/lib/python3.11/site-packages/bytewax/run.py", line 355, in <module>     cli_main(**kwargs) TypeError: (src/operators.rs:206:80) error calling `mapper` in step "Stream Ingestion Pipeline.Raw Dispatcher.flat_map_batch" Caused by => TypeError: No constructor defined ``` 
  **Post-Mortem & Fix Analysis**:
  > Hello,  We remastered the course and fixed all these issues in the last commit

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

### Incident Patch 1: `0775ac1f` (2024-12-25)
**Commit Message**: fix: None type on cleaning data

**File**: `INSTALL_AND_USAGE.md` (modified, +16/-3)
```diff
@@ -47,7 +47,7 @@ Go to the root of the repository and copy our `.env.example` file as follows:
 ```shell
 cp .env.example .env
 ```
-Now fill it with your credentials.
+Now fill it with your credentials, following the suggestions from the next section.
 
 ### Getting credentials for cloud services
 
@@ -88,6 +88,10 @@ COMET_WORKSPACE=your_workspace_name_here
 
 Required only for fine-tuning and inference, which we will show how to set up later in the document.
 
+#### Qdrant
+
+Optional, only if you want to use Qdrant cloud. Otherwise, you can complete the course using the local version of Qdrant.
+
 ## Install local dependencies
 
 You can create a Python virtual environment and install all the necessary dependencies using Poetry, by running:
@@ -97,7 +101,7 @@ make install
 > [!IMPORTANT] 
 > You need Python 3.11 installed! You can either install it globally or install [pyenv](https://github.com/pyenv/pyenv) to manage multiple Python dependencies. The `.python-version` file will signal to `pyenv` what Python version it needs to use in this particular project.
 
-After installing the dependencies into the Poetry virtual environment, you can run the following to activate it into your current CLI:
+After installing the dependencies into the Poetry virtual environment, you can activate your virtual environment into your current CLI by running:
 ```bash
 poetry shell
 ```
@@ -169,6 +173,10 @@ You can check the logs from the crawler Docker image, by running:
 ```bash
 docker logs llm-twin-data-crawlers
 ``` 
+You should see something similar to:
+```text
+{"level":"INFO","location":"extract:53","message":"Finished scrapping custom article: https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f","timestamp":"2024-12-25 17:13:33,630+0000","service":"llm-twin-course/crawler"}
+```
 
 ### Step 2: Feature engineering & Vector DB
 
@@ -180,6 +188,12 @@ To do so, check the logs of the `llm-twin-feature-pipeline` Docker container by
 ```shell
 docker logs llm-twin-feature-pipeline
 ```
+You should see something similar to:
+```text
+2024-12-25 16:53:45 [info     ] Cleaned content chunked successfully. cls=data_logic.dispatchers data_type=repositories num=955
+2024-12-25 16:53:45 [info     ] Chunk embedded successfully.   cls=data_logic.dispatchers data_type=repositories embedding_len=384
+2024-12-25 16:53:45 [info     ] Chunk embedded successfully.   cls=data_logic.dispatchers data_type=repositories embedding_len=384
+```
 Also, you can check the logs of the CDC and RabbitMQ Docker containers, by running:
 ```bash
 docker logs llm-twin-data-cdc # CDC service
@@ -192,7 +206,6 @@ To check that the Qdrant `vector DB` is populated successfully, go to its dashbo
 
 ![Qdrant Example](media/qdrant-example.png)
 
-
 > [!NOTE]
 > If using the cloud version of Qdrant, go to your Qdrant account and cluster to see the same thing as in the local dashboard.
 
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -157,6 +157,7 @@ llm-twin-course/
 ├── pyproject.toml           # Project dependencies
 ```
 
+
 ## 🚀 Install & Usage
 
 To understand how to **install and run the LLM Twin code end-to-end**, go to the [INSTALL_AND_USAGE](https://github.com/decodingml/llm-twin-course/blob/main/INSTALL_AND_USAGE.md) dedicated document.
```

**File**: `src/feature_pipeline/data_logic/cleaning_data_handlers.py` (modified, +15/-3)
```diff
@@ -19,10 +19,14 @@ def clean(self, data_model: DataModel) -> DataModel:
 
 class PostCleaningHandler(CleaningDataHandler):
     def clean(self, data_model: PostsRawModel) -> PostCleanedModel:
+        joined_text = (
+            "".join(data_model.content.values()) if data_model and data_model.content else None
+        )
+
         return PostCleanedModel(
             entry_id=data_model.entry_id,
             platform=data_model.platform,
-            cleaned_content=clean_text("".join(data_model.content.values())),
+            cleaned_content=clean_text(joined_text),
             author_id=data_model.author_id,
             image=data_model.image if data_model.image else None,
             type=data_model.type,
@@ -31,23 +35,31 @@ def clean(self, data_model: PostsRawModel) -> PostCleanedModel:
 
 class ArticleCleaningHandler(CleaningDataHandler):
     def clean(self, data_model: ArticleRawModel) -> ArticleCleanedModel:
+        joined_text = (
+            "".join(data_model.content.values()) if data_model and data_model.content else None
+        )
+
         return ArticleCleanedModel(
             entry_id=data_model.entry_id,
             platform=data_model.platform,
             link=data_model.link,
-            cleaned_content=clean_text("".join(data_model.content.values())),
+            cleaned_content=clean_text(joined_text),
             author_id=data_model.author_id,
             type=data_model.type,
         )
 
 
 class RepositoryCleaningHandler(CleaningDataHandler):
     def clean(self, data_model: RepositoryRawModel) -> RepositoryCleanedModel:
+        joined_text = (
+            "".join(data_model.content.values()) if data_model and data_model.content else None
+        )
+
         return RepositoryCleanedModel(
             entry_id=data_model.entry_id,
             name=data_model.name,
             link=data_model.link,
-            cleaned_content=clean_text("".join(data_model.content.values())),
+            cleaned_content=clean_text(joined_text),
             owner_id=data_model.owner_id,
             type=data_model.type,
         )
```

**File**: `src/feature_pipeline/utils/cleaning.py` (modified, +4/-1)
```diff
@@ -95,7 +95,10 @@ def remove_non_ascii(text: str) -> str:
     return text
 
 
-def clean_text(text_content: str) -> str:
+def clean_text(text_content: str | None) -> str:
+    if text_content is None:
+        return ""
+
     cleaned_text = unbold_text(text_content)
     cleaned_text = unitalic_text(cleaned_text)
     cleaned_text = remove_emojis_and_symbols(cleaned_text)
```

**File**: `src/training_pipeline/download_dataset.py` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ def _download_artifact(self, artifact_name: str, experiment) -> Artifact:
 
             raise
 
-        print(f"Successfully downloaded  {artifact_name} at location {self.output_dir}")
+        print(f"Successfully downloaded  '{artifact_name}' at location '{self.output_dir}'")
 
         return artifact
 
```

---

### Incident Patch 2: `d5ce0989` (2024-11-30)
**Commit Message**: fix: Base model_id. Opik config

**File**: `README.md` (modified, +9/-10)
```diff
@@ -148,19 +148,18 @@ At Decoding ML we teach how to build production ML systems, thus the course foll
 
 ```text
 llm-twin-course/
-├── src/ # Source code for all microservices
-│ ├── data_crawling/ # Data collection pipeline code
-│ ├── data_cdc/ # Change Data Capture pipeline code
-│ ├── feature_pipeline/ # Feature engineering pipeline code
-│ ├── training_pipeline/ # Training pipeline code
-│ ├── inference_pipeline/ # Inference service code
+├── src/                     # Source code for all microservices
+│ ├── data_crawling/         # Data collection pipeline code
+│ ├── data_cdc/              # Change Data Capture pipeline code
+│ ├── feature_pipeline/      # Feature engineering pipeline code
+│ ├── training_pipeline/     # Training pipeline code
+│ ├── inference_pipeline/    # Inference service code
 │ └── bonus_superlinked_rag/ # Bonus RAG optimization code
-├── .env.example # Example environment variables template
-├── Makefile # Commands to build and run the project
-├── pyproject.toml # Project dependencies
+├── .env.example             # Example environment variables template
+├── Makefile                 # Commands to build and run the project
+├── pyproject.toml           # Project dependencies
 ```
 
-
 ## Install & Usage
 
 To understand how to **install and run the LLM Twin code end-to-end**, go to the [INSTALL_AND_USAGE](https://github.com/decodingml/llm-twin-course/blob/main/INSTALL_AND_USAGE.md) dedicated document.
```

**File**: `src/core/config.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ class AppSettings(BaseSettings):
 
     # LLM Model config
     HUGGINGFACE_ACCESS_TOKEN: str | None = None
-    MODEL_ID: str = "pauliusztin/LLMTwin-Meta-Llama-3.1-8B"
+    MODEL_ID: str = "pauliusztin/LLMTwin-Llama-3.1-8B"
     DEPLOYMENT_ENDPOINT_NAME: str = "twin"
 
     MAX_INPUT_TOKENS: int = 1536  # Max length of input text.
```

**File**: `src/core/opik_utils.py` (modified, +2/-2)
```diff
@@ -126,9 +126,9 @@ def create_dataset(name: str, description: str, items: list[dict]) -> opik.Datas
 
 
 def add_to_dataset_with_sampling(item: dict, dataset_name: str) -> bool:
-    if "1" in random.choices(["0", "1"], weights=[0.5, 0.5]):
+    if "1" in random.choices(["0", "1"], weights=[0.3, 0.7]):
         client = opik.Opik()
-        dataset = client.get_dataset(name=dataset_name)
+        dataset = client.get_or_create_dataset(name=dataset_name)
         dataset.insert([item])
 
         return True
```

**File**: `src/core/rag/self_query.py` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ def generate_response(query: str) -> str | None:
         first_name, last_name = lib.split_user_full_name(user_full_name)
         logger.info(
             f"Successfully extracted the user first and last name from the query.",
-            user_full_name=first_name,
+            first_name=first_name,
             last_name=last_name,
         )
         user_id = UserDocument.get_or_create(first_name=first_name, last_name=last_name)
```

**File**: `src/inference_pipeline/config.py` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ class Settings(BaseSettings):
 
     # LLM Model config
     HUGGINGFACE_ACCESS_TOKEN: str | None = None
-    MODEL_ID: str = "pauliusztin/LLMTwin-Meta-Llama-3.1-8B"
+    MODEL_ID: str = "pauliusztin/LLMTwin-Llama-3.1-8B"
     DEPLOYMENT_ENDPOINT_NAME: str = "twin"
 
     MAX_INPUT_TOKENS: int = 1536  # Max length of input text.
```

**File**: `src/inference_pipeline/main.py` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@
         """
 
     response = inference_endpoint.generate(
-        query=query, enable_rag=True, sample_for_evaluation=False
+        query=query, enable_rag=True, sample_for_evaluation=True
     )
 
     logger.info("=" * 50)
```

**File**: `src/training_pipeline/finetune.py` (modified, +1/-1)
```diff
@@ -267,7 +267,7 @@ def save_model(
     parser = argparse.ArgumentParser()
 
     parser.add_argument(
-        "--base_model_name", type=str, default="meta-llama/Meta-Llama-3.1-8B"
+        "--base_model_name", type=str, default="meta-llama/Llama-3.1-8B"
     )
     parser.add_argument("--dataset_id", type=str)
     parser.add_argument("--num_train_epochs", type=int, default=3)
```

---

### Incident Patch 3: `4a1bdc70` (2024-11-21)
**Commit Message**: fix: Merge conflict

**File**: `INSTALL_AND_USAGE.md` (modified, +3/-3)
```diff
@@ -79,7 +79,7 @@ COMET_WORKSPACE=your_workspace_name_here
 
 ## Install local dependencies
 
-You can create a Python virtual environment and install all the necesary dependencies using Poetry, by running:
+You can create a Python virtual environment and install all the necessary dependencies using Poetry, by running:
 ```shell
 make install
 ```
@@ -128,7 +128,7 @@ make local-stop
 
 # Usage: Run an end-to-end flow
 
-Now that we have configured our credentials, local environemnt and Docker infrastructure let's look at how to run an end-to-end flow of the LLM Twin course.
+Now that we have configured our credentials, local environment and Docker infrastructure let's look at how to run an end-to-end flow of the LLM Twin course.
 
 > [!IMPORTANT]
 > Note that we won't go into the details of the system here. To fully understand it, check out our free lessons, which explains everything step-by-step: [LLM Twin articles series](https://medium.com/decodingml/llm-twin-course/home).
@@ -260,7 +260,7 @@ Now, we can move on to the fine-tunine and inference pipelines, which use AWS Sa
 
 ### Step 7: Starting the fine-tuning pipeline
 
-After setting up everything necesary for AWS SageMaker, to kick of the training in dummy mode, is as easy as. The dummy mode will reduce the dataset size and epochs to quickly see that everything works fine:
+After setting up everything necessary for AWS SageMaker, to kick of the training in dummy mode, is as easy as. The dummy mode will reduce the dataset size and epochs to quickly see that everything works fine:
 ```bash
 make start-training-pipeline-dummy-mode
 ```
```

**File**: `LICENSE` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 MIT License
 
-Copyright (c) 2024 Decoding ML
+Copyright (c) 2024 Decoding ML by Crafted Intelligence S.R.L.
 
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
```

**File**: `Makefile` (modified, +2/-2)
```diff
@@ -97,7 +97,7 @@ install-superlinked: # Create a local Poetry virtual environment and install all
 	poetry env use 3.11
 	poetry install
 
-local-start-superlinked: # Buil and start local infrastructure used in the Superlinked series.
+local-start-superlinked: # Build and start local infrastructure used in the Superlinked series.
 	docker compose -f docker-compose-superlinked.yml up --build -d
 
 local-stop-superlinked: # Stop local infrastructure used in the Superlinked series.
@@ -110,4 +110,4 @@ local-bytewax-superlinked: # Run the Bytewax streaming pipeline powered by Super
 	RUST_BACKTRACE=full poetry run python -m bytewax.run src/bonus_superlinked_rag/main.py
 
 local-test-retriever-superlinked: # Call the retrieval module and query the Superlinked server & vector DB
-	docker exec -it llm-twin-bytewax-superlinked python -m retriever
\ No newline at end of file
+	docker exec -it llm-twin-bytewax-superlinked python -m retriever
```

**File**: `src/bonus_superlinked_rag/README.md` (modified, +2/-2)
```diff
@@ -18,7 +18,7 @@ brew install pyenv
 
 Now, let's start the Superlinked server by running the following commands:
 ```shell
-# Create a virtual environment and install all necesary dependencies to deploy the server.
+# Create a virtual environment and install all necessary dependencies to deploy the server.
 cd 6-bonus-superlinked-rag/server
 ./tools/init-venv.sh
 cd runner
@@ -82,4 +82,4 @@ make local-test-retriever-superlinked
 
 If you enjoyed our [Superlinked](https://rebrand.ly/superlinked-github) bonus series, we recommend checking out their site for more examples. As Superlinked is not just a RAG tool but a general vector compute engine, you can build other awesome stuff with it, such as recommender systems. 
 
-→ 🔗 More on [Superlinked](https://rebrand.ly/superlinked-github) ←
\ No newline at end of file
+→ 🔗 More on [Superlinked](https://rebrand.ly/superlinked-github) ←
```

**File**: `src/bonus_superlinked_rag/llm/prompt_templates.py` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ class QueryExpansionTemplate(BasePromptTemplate):
     different versions of the given user question to retrieve relevant documents from a vector
     database. By generating multiple perspectives on the user question, your goal is to help
     the user overcome some of the limitations of the distance-based similarity search.
-    Provide these alternative questions seperated by '{separator}'.
+    Provide these alternative questions separated by '{separator}'.
     Original question: {question}"""
 
     @property
```

**File**: `src/core/rag/prompt_templates.py` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ class QueryExpansionTemplate(BasePromptTemplate):
     different versions of the given user question to retrieve relevant documents from a vector
     database. By generating multiple perspectives on the user question, your goal is to help
     the user overcome some of the limitations of the distance-based similarity search.
-    Provide these alternative questions seperated by '{separator}'.
+    Provide these alternative questions separated by '{separator}'.
     Original question: {question}"""
 
     @property
```

---

### Incident Patch 4: `88ade96c` (2024-11-20)
**Commit Message**: fix typos

**File**: `INSTALL_AND_USAGE.md` (modified, +3/-3)
```diff
@@ -79,7 +79,7 @@ COMET_WORKSPACE=your_workspace_name_here
 
 ## Install local dependencies
 
-You can create a Python virtual environment and install all the necesary dependencies using Poetry, by running:
+You can create a Python virtual environment and install all the necessary dependencies using Poetry, by running:
 ```shell
 make install
 ```
@@ -128,7 +128,7 @@ make local-stop
 
 # Usage: Run an end-to-end flow
 
-Now that we have configured our credentials, local environemnt and Docker infrastructure let's look at how to run an end-to-end flow of the LLM Twin course.
+Now that we have configured our credentials, local environment and Docker infrastructure let's look at how to run an end-to-end flow of the LLM Twin course.
 
 > [!IMPORTANT]
 > Note that we won't go into the details of the system here. To fully understand it, check out our free lessons, which explains everything step-by-step: [LLM Twin articles series](https://medium.com/decodingml/llm-twin-course/home).
@@ -260,7 +260,7 @@ Now, we can move on to the fine-tunine and inference pipelines, which use AWS Sa
 
 ### Step 7: Starting the fine-tuning pipeline
 
-After setting up everything necesary for AWS SageMaker, to kick of the training in dummy mode, is as easy as. The dummy mode will reduce the dataset size and epochs to quickly see that everything works fine:
+After setting up everything necessary for AWS SageMaker, to kick of the training in dummy mode, is as easy as. The dummy mode will reduce the dataset size and epochs to quickly see that everything works fine:
 ```bash
 make start-training-pipeline-dummy-mode
 ```
```

**File**: `Makefile` (modified, +2/-2)
```diff
@@ -97,7 +97,7 @@ install-superlinked: # Create a local Poetry virtual environment and install all
 	poetry env use 3.11
 	poetry install
 
-local-start-superlinked: # Buil and start local infrastructure used in the Superlinked series.
+local-start-superlinked: # Build and start local infrastructure used in the Superlinked series.
 	docker compose -f docker-compose-superlinked.yml up --build -d
 
 local-stop-superlinked: # Stop local infrastructure used in the Superlinked series.
@@ -110,4 +110,4 @@ local-bytewax-superlinked: # Run the Bytewax streaming pipeline powered by Super
 	RUST_BACKTRACE=full poetry run python -m bytewax.run src/bonus_superlinked_rag/main.py
 
 local-test-retriever-superlinked: # Call the retrieval module and query the Superlinked server & vector DB
-	docker exec -it llm-twin-bytewax-superlinked python -m retriever
\ No newline at end of file
+	docker exec -it llm-twin-bytewax-superlinked python -m retriever
```

**File**: `src/bonus_superlinked_rag/README.md` (modified, +2/-2)
```diff
@@ -18,7 +18,7 @@ brew install pyenv
 
 Now, let's start the Superlinked server by running the following commands:
 ```shell
-# Create a virtual environment and install all necesary dependencies to deploy the server.
+# Create a virtual environment and install all necessary dependencies to deploy the server.
 cd 6-bonus-superlinked-rag/server
 ./tools/init-venv.sh
 cd runner
@@ -82,4 +82,4 @@ make local-test-retriever-superlinked
 
 If you enjoyed our [Superlinked](https://rebrand.ly/superlinked-github) bonus series, we recommend checking out their site for more examples. As Superlinked is not just a RAG tool but a general vector compute engine, you can build other awesome stuff with it, such as recommender systems. 
 
-→ 🔗 More on [Superlinked](https://rebrand.ly/superlinked-github) ←
\ No newline at end of file
+→ 🔗 More on [Superlinked](https://rebrand.ly/superlinked-github) ←
```

**File**: `src/bonus_superlinked_rag/llm/prompt_templates.py` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ class QueryExpansionTemplate(BasePromptTemplate):
     different versions of the given user question to retrieve relevant documents from a vector
     database. By generating multiple perspectives on the user question, your goal is to help
     the user overcome some of the limitations of the distance-based similarity search.
-    Provide these alternative questions seperated by '{separator}'.
+    Provide these alternative questions separated by '{separator}'.
     Original question: {question}"""
 
     @property
```

**File**: `src/core/rag/prompt_templates.py` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ class QueryExpansionTemplate(BasePromptTemplate):
     different versions of the given user question to retrieve relevant documents from a vector
     database. By generating multiple perspectives on the user question, your goal is to help
     the user overcome some of the limitations of the distance-based similarity search.
-    Provide these alternative questions seperated by '{separator}'.
+    Provide these alternative questions separated by '{separator}'.
     Original question: {question}"""
 
     @property
```

**File**: `src/training_pipeline/README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Introduction
 
-This module reflects the LLM fine-tuning pipeline where we download versioned datsets from CometML and manage the deployment at scale using Qwak.
+This module reflects the LLM fine-tuning pipeline where we download versioned datasets from CometML and manage the deployment at scale using Qwak.
 **Completing this lesson**, you'll gain a solid understanding of the following:
 
 - what is Qwak AI and how does it help solve MLOps challenges
```

---

### Incident Patch 5: `42904878` (2024-11-15)
**Commit Message**: feat: Add Gradio UI

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -169,6 +169,7 @@ output
 generated_dataset
 finetuning_dataset
 .cache
+.gradio
 training_pipeline_output
 mistral_instruct_generation
 cache
```

**File**: `INSTALL_AND_USAGE.md` (modified, +37/-3)
```diff
@@ -218,9 +218,24 @@ make start-training-pipeline
 > If you get any `Service Quotas` errors, you must increase your AWS quotas for `ml.g5.2xlarge` instances. More exactly, you have to go to your AWS account -> Service Quatas -> AWS services -> search `SageMaker` -> search `ml.g5.2xlarge`, then increase the quotas to 1 for `ml.g5.2xlarge for training job usage` (training jobs) and `ml.g5.2xlarge for endpoint usage` (inference jobs). More details on changing service quotas are in [this article](https://docs.aws.amazon.com/servicequotas/latest/userguide/request-quota-increase.html).
 
 
-### Step 8: Testing the inference pipeline
+### Step 8: Ruuning the evaluation pipelines
 
-After you have finetuned your model, the first step is to deploy the LLM to AWS SageMaker as a REST API service:
+After you have finetuned your LLM, you can start the LLM evaluation pipeline by running:
+```shell
+make evaluate-llm
+```
+
+To start the RAG evaluation pipeline, run:
+```shell
+make evaluate-rag
+```
+
+Next, check the evaluation datasets and experiment results in [Opik's Dashboard](https://www.comet.com/opik).
+
+
+### Step 9: Testing the inference pipeline
+
+After you have finetuned and evaluated your model, the first step is to deploy the LLM to AWS SageMaker as a REST API service:
 ```shell
 make deploy-inference-pipeline 
 ```
@@ -233,7 +248,26 @@ After the deployment is finished (it will take a few minutes), you can call it w
 make call-inference-pipeline
 ```
 
-Ultimately, after testing it, you can delete the AWS SageMaker deployment, by running:
+After testing the inference pipeline from the CLI, you can start playing around with the LLM Twin from our GUI, by running:
+```shell
+make local-start-ui
+```
+
+Now you can access the GUI at **[http://localhost:7860](http://localhost:7860)** and start asking the LLM Twin to generate some content for you, such as: **"Draft a post about RAG systems."** as in the example below:
+
+![UI Example](media/ui-example.png)
+
+After playing around with the model, you will start collecting and monitoring your prompts which you can visualize again in [Opik's Dashboard](https://www.comet.com/opik).
+
+Also, you can kick off the monitoring LLM evaluation pipeline by running:
+```bash
+make evaluate-llm-monitoring
+```
+
+> [!WARNING]
+> Clear up your AWS resources to avoid any unexpected costs.
+
+Ultimately, after testing the inference pipeline, you can delete the AWS SageMaker deployment, by running:
 ```shell
 make delete-inference-pipeline-deployment
 ```
```

**File**: `Makefile` (modified, +7/-13)
```diff
@@ -2,17 +2,8 @@ include .env
 
 $(eval export $(shell sed -ne 's/ *#.*$$//; /./ s/=.*$$// p' .env))
 
-AWS_CURRENT_REGION_ID := $(shell aws configure get region)
-AWS_CURRENT_ACCOUNT_ID := $(shell aws sts get-caller-identity --query "Account" --output text)
-
 PYTHONPATH := $(shell pwd)/src
 
-RED := \033[0;31m
-BLUE := \033[0;34m
-GREEN := \033[0;32m
-YELLOW := \033[0;33m
-RESET := \033[0m
-
 install: # Create a local Poetry virtual environment and install all required Python dependencies.
 	poetry env use 3.11
 	poetry install --without superlinked_rag
@@ -86,20 +77,23 @@ call-inference-pipeline: # Call the inference pipeline client using your Poetry
 delete-inference-pipeline-deployment: # Delete the deployment of the AWS SageMaker inference pipeline.
 	cd src/inference_pipeline && PYTHONPATH=$(PYTHONPATH) poetry run python -m aws.delete_sagemaker_endpoint
 
-evaluate-llm:
+local-start-ui: # Start the Gradio UI for chatting with your LLM Twin using your Poetry env.
+	cd src/inference_pipeline && poetry run python -m ui
+
+evaluate-llm: # Run evaluation tests on the LLM model's performance using your Poetry env.
 	cd src/inference_pipeline && poetry run python -m evaluation.evaluate
 
-evaluate-rag:
+evaluate-rag: # Run evaluation tests specifically on the RAG system's performance using your Poetry env.
 	cd src/inference_pipeline && poetry run python -m evaluation.evaluate_rag
 
-evaluate-llm-monitoring:
+evaluate-llm-monitoring: # Run evaluation tests for monitoring the LLM system using your Poetry env.
 	cd src/inference_pipeline && poetry run python -m evaluation.evaluate_monitoring
 
 # ======================================
 # ------ Superlinked Bonus Series ------
 # ======================================
 
-install-superlinked:
+install-superlinked: # Create a local Poetry virtual environment and install all required Python dependencies (with Superlinked enabled).
 	poetry env use 3.11
 	poetry install
 
```

**File**: `README.md` (modified, +6/-5)
```diff
@@ -56,6 +56,10 @@ You will also **learn** to **leverage MLOps best practices**, such as experiment
 
 ## The architecture of the LLM twin is split into 4 Python microservices:
 
+<p align="center">
+  <img src="media/architecture.png" alt="LLM Twin Architecture">
+</p>
+
 ### The data collection pipeline
 
 - Crawl your digital data from various social media platforms.
@@ -87,15 +91,12 @@ You will also **learn** to **leverage MLOps best practices**, such as experiment
 - Monitor the LLM using [Comet's](https://www.comet.com/signup/?framework=llm&utm_source=decoding_ml&utm_medium=partner&utm_content=github) prompt monitoring dashboard.
 - In the bonus series, we refactor the advanced RAG layer to write more optimal queries using [Superlinked](https://rebrand.ly/superlinked-github).
 - ☁️ Deployed on [Qwak](https://www.qwak.com/lp/end-to-end-mlops/?utm_source=github&utm_medium=referral&utm_campaign=decodingml).
-
-</br>
+- Wrap up everything with a Gradio UI (as seen below) where you can start playing around with the LLM Twin.
 
 <p align="center">
-  <img src="media/architecture.png" alt="Your image description">
+  <img src="media/ui-example.png" alt="Gradio UI">
 </p>
 
-</br>
-
 Along the 4 microservices, you will learn to integrate 3 serverless tools:
 
 * [Comet ML](https://www.comet.com/signup/?utm_source=decoding_ml&utm_medium=partner&utm_content=github) as your ML Platform;
```

**File**: `poetry.lock` (modified, +363/-67)
```diff
@@ -1,5 +1,16 @@
 # This file is automatically @generated by Poetry 1.8.4 and should not be changed by hand.
 
+[[package]]
+name = "aiofiles"
+version = "23.2.1"
+description = "File support for asyncio."
+optional = false
+python-versions = ">=3.7"
+files = [
+    {file = "aiofiles-23.2.1-py3-none-any.whl", hash = "sha256:19297512c647d4b27a2cf7c34caa7e405c0d60b5560618a29a9fe027b18b0107"},
+    {file = "aiofiles-23.2.1.tar.gz", hash = "sha256:84ec2218d8419404abcb9f0c02df3f34c6e0a68ed41072acfb1cef5cbc29051a"},
+]
+
 [[package]]
 name = "aiohappyeyeballs"
 version = "2.4.3"
@@ -1106,6 +1117,37 @@ configobj = {version = "*", optional = true, markers = "extra == \"ini\""}
 ini = ["configobj"]
 yaml = ["PyYAML"]
 
+[[package]]
+name = "fastapi"
+version = "0.115.5"
+description = "FastAPI framework, high performance, easy to learn, fast to code, ready for production"
+optional = false
+python-versions = ">=3.8"
+files = [
+    {file = "fastapi-0.115.5-py3-none-any.whl", hash = "sha256:596b95adbe1474da47049e802f9a65ab2ffa9c2b07e7efee70eb8a66c9f2f796"},
+    {file = "fastapi-0.115.5.tar.gz", hash = "sha256:0e7a4d0dc0d01c68df21887cce0945e72d3c48b9f4f79dfe7a7d53aa08fbb289"},
+]
+
+[package.dependencies]
+pydantic = ">=1.7.4,<1.8 || >1.8,<1.8.1 || >1.8.1,<2.0.0 || >2.0.0,<2.0.1 || >2.0.1,<2.1.0 || >2.1.0,<3.0.0"
+starlette = ">=0.40.0,<0.42.0"
+typing-extensions = ">=4.8.0"
+
+[package.extras]
+all = ["email-validator (>=2.0.0)", "fastapi-cli[standard] (>=0.0.5)", "httpx (>=0.23.0)", "itsdangerous (>=1.1.0)", "jinja2 (>=2.11.2)", "orjson (>=3.2.1)", "pydantic-extra-types (>=2.0.0)", "pydantic-settings (>=2.0.0)", "python-multipart (>=0.0.7)", "pyyaml (>=5.3.1)", "ujson (>=4.0.1,!=4.0.2,!=4.1.0,!=4.2.0,!=4.3.0,!=5.0.0,!=5.1.0)", "uvicorn[standard] (>=0.12.0)"]
+standard = ["email-validator (>=2.0.0)", "fastapi-cli[standard] (>=0.0.5)", "httpx (>=0.23.0)", "jinja2 (>=2.11.2)", "python-multipart (>=0.0.7)", "uvicorn[standard] (>=0.12.0)"]
+
+[[package]]
+name = "ffmpy"
+version = "0.4.0"
+description = "A simple Python wrapper for FFmpeg"
+optional = false
+python-versions = "<4.0.0,>=3.8.1"
+files = [
+    {file = "ffmpy-0.4.0-py3-none-any.whl", hash = "sha256:39c0f20c5b465e7f8d29a5191f3a7d7675a8c546d9d985de8921151cd9b59e14"},
+    {file = "ffmpy-0.4.0.tar.gz", hash = "sha256:131b57794e802ad555f579007497f7a3d0cab0583d37496c685b8acae4837b1d"},
+]
+
 [[package]]
 name = "filelock"
 version = "3.16.1"
@@ -1474,6 +1516,67 @@ files = [
 [package.dependencies]
 six = "*"
 
+[[package]]
+name = "gradio"
+version = "5.5.0"
+description = "Python library for easily interacting with trained machine learning models"
+optional = false
+python-versions = ">=3.10"
+files = [
+    {file = "gradio-5.5.0-py3-none-any.whl", hash = "sha256:48ea11ae1376d9506eb295dbeb4d3ff962830a6e2d8aa9085e025cce3c04e544"},
+]
+
+[package.dependencies]
+aiofiles = ">=22.0,<24.0"
+anyio = ">=3.0,<5.0"
+fastapi = ">=0.115.2,<1.0"
+ffmpy = "*"
+gradio-client = "1.4.2"
+httpx = ">=0.24.1"
+huggingface-hub = ">=0.25.1"
+jinja2 = "<4.0"
+markupsafe = ">=2.0,<3.0"
+numpy = ">=1.0,<3.0"
+orjson = ">=3.0,<4.0"
+packaging = "*"
+pandas = ">=1.0,<3.0"
+pillow = ">=8.0,<12.0"
+pydantic = ">=2.0"
+pydub = "*"
+python-multipart = "0.0.12"
+pyyaml = ">=5.0,<7.0"
+ruff = {version = ">=0.2.2", markers = "sys_platform != \"emscripten\""}
+safehttpx = ">=0.1.1,<1.0"
+semantic-version = ">=2.0,<3.0"
+starlette = {version = ">=0.40.0,<1.0", markers = "sys_platform != \"emscripten\""}
+tomlkit = "0.12.0"
+typer = {version = ">=0.12,<1.0", markers = "sys_platform != \"emscripten\""}
+typing-extensions = ">=4.0,<5.0"
+urllib3 = {version = ">=2.0,<3.0", markers = "sys_platform == \"emscripten\""}
+uvicorn = {version = ">=0.14.0", markers = "sys_platform != \"emscripten\""}
+
+[package.extras]
+oauth = ["authlib", "itsdangerous"]
+
+[[package]]
+name = "gradio-client"
+version = "1.4.2"
+description = "Python library for easily interacting with trained machine learning models"
+optional = false
+python-versions = ">=3.10"
+files = [
+    {file = "gradio_client-1.4.2-py3-none-any.whl", hash = "sha256:76a34996b4580939a3fbd10144fde04eced586c033b6cdcb315d69b1459136d1"},
+    {file = "gradio_client-1.4.2.tar.gz", hash = "sha256:07c5184ad6385f50f9e6eae3a262ad6afcf9380b6a400d070652f76e14222dbd"},
+]
+
+[package.dependencies]
+fsspec = "*"
+httpx = ">=0.24.1"
+huggingface-hub = ">=0.19.3"
+packaging = "*"
+typing-extensions = ">=4.0,<5.0"
+websockets = ">=10.0,<13.0"
+
 [[package]]
 name = "graphene"
 version = "3.4.1"
@@ -1852,13 +1955,13 @@ zstd = ["zstandard (>=0.18.0)"]
 
 [[package]]
 name = "huggingface-hub"
-version = "0.25.0"
+version = "0.25.1"
 description = "Client library to download and publish models, datasets and other repos on the huggingface.co hub"
 optional = false
 python-versions = ">=3.8.0"
 files = [
-    {file = "huggingface_hub-0.25.0-py3-none-any.whl", hash = "sha256:e2f357b35d72d5012cfd127108c4e14abcd61ba4ebc90a5a374dc2456cb34e12"},
-    {file = "huggingface_hu
```

**File**: `pyproject.toml` (modified, +2/-1)
```diff
@@ -42,9 +42,10 @@ langchain = "^0.2.11"
 langchain-openai = "^0.1.3"
 langchain-community = "^0.2.11"
 html2text = "^2024.2.26"
-huggingface-hub = "0.25.0"
+huggingface-hub = "0.25.1"
 sagemaker = ">=2.232.2"
 sentence-transformers = "^2.2.2"
+gradio = "^5.5.0"
 
 [tool.poetry.group.feature_pipeline.dependencies]
 bytewax = "0.18.2"
```

**File**: `src/inference_pipeline/ui.py` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import sys
+from pathlib import Path
+
+# To mimic using multiple Python modules, such as 'core' and 'feature_pipeline',
+# we will add the './src' directory to the PYTHONPATH. This is not intended for
+# production use cases but for development and educational purposes.
+ROOT_DIR = str(Path(__file__).parent.parent)
+sys.path.append(ROOT_DIR)
+
+from core.config import settings
+from llm_twin import LLMTwin
+
+settings.patch_localhost()
+
+
+import gradio as gr
+from inference_pipeline.llm_twin import LLMTwin
+
+llm_twin = LLMTwin(mock=False)
+
+
+def predict(message: str, history: list[list[str]], author: str) -> str:
+    """
+    Generates a response using the LLM Twin, simulating a conversation with your digital twin.
+
+    Args:
+        message (str): The user's input message or question.
+        history (List[List[str]]): Previous conversation history between user and twin.
+        about_me (str): Personal context about the user to help personalize responses.
+
+    Returns:
+        str: The LLM Twin's generated response.
+    """
+
+    query = f"I am {author}. Write about: {message}"
+    response = llm_twin.generate(
+        query=query, enable_rag=True, sample_for_evaluation=False
+    )
+
+    return response["answer"]
+
+
+demo = gr.ChatInterface(
+    predict,
+    textbox=gr.Textbox(
+        placeholder="Chat with your digital twin",
+        label="Message",
+        container=False,
+        scale=7,
+    ),
+    additional_inputs=[
+        gr.Textbox(
+            "Paul Iusztin",
+            label="Who are you?",
+        )
+    ],
+    title="Your LLM Twin",
+    description="""
+    Chat with your personalized LLM Twin! This AI assistant will help you write content incorporating your style and voice.
+    """,
+    theme="soft",
+    examples=[
+        [
+            "Draft a post about RAG systems.",
+            "Paul Iusztin",
+        ],
+        [
+            "Draft an article paragraph about vector databases.",
+            "Paul Iusztin",
+        ],
+        [
+            "Draft a post about LLM chatbots.",
+            "Paul Iusztin",
+        ],
+    ],
+    cache_examples=False,
+)
+
+
+if __name__ == "__main__":
+    demo.queue().launch(server_name="0.0.0.0", server_port=7860, share=True)
```

---

### Incident Patch 6: `a809583c` (2024-11-14)
**Commit Message**: fix: Training & evaluation mintor bugs

**File**: `INSTALL_AND_USAGE.md` (modified, +2/-2)
```diff
@@ -119,7 +119,7 @@ docker logs llm-twin-feature-pipeline
 ```
 You should see logs reflecting the cleaning, chunking, and embedding operations (without any errors, of course).
 
-To check that the Qdrant `vector DB` is populated successfully, go to its dashboard at [localhost:6333/dashboard](localhost:6333/dashboard). There, you should see the repositories or article collections created and populated.
+To check that the Qdrant `vector DB` is populated successfully, go to its dashboard at **[localhost:6333/dashboard](localhost:6333/dashboard)**. There, you should see the repositories or article collections created and populated.
 
 > [!NOTE]
 > If using the cloud version of Qdrant, go to your Qdrant account and cluster to see the same thing as in the local dashboard.
@@ -222,7 +222,7 @@ make start-training-pipeline
 
 After you have finetuned your model, the first step is to deploy the LLM to AWS SageMaker as a REST API service:
 ```shell
-deploy-inference-pipeline 
+make deploy-inference-pipeline 
 ```
 
 > [!NOTE]
```

**File**: `Makefile` (modified, +10/-1)
```diff
@@ -74,7 +74,7 @@ start-training-pipeline-dummy-mode: # Start the training pipeline in AWS SageMak
 start-training-pipeline: # Start the training pipeline in AWS SageMaker.
 	cd src/training_pipeline && poetry run python run_on_sagemaker.py
 
-local-test-training-pipeline: # Start the training pipeline in your Poetry env.
+local-start-training-pipeline: # Start the training pipeline in your Poetry env.
 	cd src/training_pipeline && poetry run python -m finetune
 
 deploy-inference-pipeline: # Deploy the inference pipeline to AWS SageMaker.
@@ -86,6 +86,15 @@ call-inference-pipeline: # Call the inference pipeline client using your Poetry
 delete-inference-pipeline-deployment: # Delete the deployment of the AWS SageMaker inference pipeline.
 	cd src/inference_pipeline && PYTHONPATH=$(PYTHONPATH) poetry run python -m aws.delete_sagemaker_endpoint
 
+evaluate-llm:
+	cd src/inference_pipeline && poetry run python -m evaluation.evaluate
+
+evaluate-rag:
+	cd src/inference_pipeline && poetry run python -m evaluation.evaluate_rag
+
+evaluate-llm-monitoring:
+	cd src/inference_pipeline && poetry run python -m evaluation.evaluate_monitoring
+
 # ======================================
 # ------ Superlinked Bonus Series ------
 # ======================================
```

**File**: `src/bonus_superlinked_rag/server/runner/executor/app/util/fast_api_handler.py` (modified, +0/-2)
```diff
@@ -20,8 +20,6 @@
 from superlinked.framework.common.util.immutable_model import ImmutableBaseModel
 from superlinked.framework.dsl.executor.rest.rest_handler import RestHandler
 
-# TODO: resolve the noqa comments [ENG-1767]
-
 
 class QueryResponse(ImmutableBaseModel):
     schema_: str = Field(..., alias="schema")
```

**File**: `src/core/config.py` (modified, +9/-0)
```diff
@@ -42,6 +42,15 @@ class AppSettings(BaseSettings):
     AWS_SECRET_KEY: str | None = None
     AWS_ARN_ROLE: str | None = None
 
+    # LLM Model config
+    HUGGINGFACE_ACCESS_TOKEN: str | None = None
+    MODEL_ID: str = "pauliusztin/LLMTwin-Meta-Llama-3.1-8B"
+    DEPLOYMENT_ENDPOINT_NAME: str = "twin"
+
+    MAX_INPUT_TOKENS: int = 1536  # Max length of input text.
+    MAX_TOTAL_TOKENS: int = 2048  # Max length of the generation (including input text).
+    MAX_BATCH_TOTAL_TOKENS: int = 2048  # Limits the number of tokens that can be processed in parallel during the generation.
+
     # Embeddings config
     EMBEDDING_MODEL_ID: str = "BAAI/bge-small-en-v1.5"
     EMBEDDING_MODEL_MAX_INPUT_LENGTH: int = 512
```

**File**: `src/core/opik_utils.py` (modified, +9/-6)
```diff
@@ -84,9 +84,14 @@ def create_dataset_from_artifacts(
 
                 continue
 
-            # TODO: Grab only testing data
-            artifact_file = list(artifact_dir.glob("*"))[0]
-            with open(artifact_file, "r") as file:
+            testing_artifact_file = list(artifact_dir.glob("*_testing.json"))
+            assert (
+                len(testing_artifact_file) == 1
+            ), "Expected exactly one testing artifact file."
+            testing_artifact_file = testing_artifact_file[0]
+
+            logger.info(f"Loading testing data from: {testing_artifact_file}")
+            with open(testing_artifact_file, "r") as file:
                 items = json.load(file)
 
             enhanced_items = [
@@ -95,7 +100,7 @@ def create_dataset_from_artifacts(
             dataset_items.extend(enhanced_items)
     experiment.end()
 
-    if len(dataset_name) == 0:
+    if len(dataset_items) == 0:
         logger.warning("No items found in the artifacts. Dataset creation skipped.")
 
         return None
@@ -113,8 +118,6 @@ def create_dataset(name: str, description: str, items: list[dict]) -> opik.Datas
     client = opik.Opik()
 
     dataset = client.get_or_create_dataset(name=name, description=description)
-    # TODO: Delete this
-    items = items[:10]
     dataset.insert(items)
 
     dataset = client.get_dataset(name=name)
```

**File**: `src/inference_pipeline/evaluation/__init__.py` (modified, +14/-4)
```diff
@@ -1,5 +1,15 @@
-from .llm import evaluate as evaluate_llm
-from .rag import evaluate as evaluate_rag
-from .style import Style
+import sys
+from pathlib import Path
 
-__all__ = ["evaluate_llm", "evaluate_rag", "Style"]
+# To mimic using multiple Python modules, such as 'core' and 'feature_pipeline',
+# we will add the './src' directory to the PYTHONPATH. This is not intended for
+# production use cases but for development and educational purposes.
+ROOT_DIR = str(Path(__file__).parent.parent.parent)
+sys.path.append(ROOT_DIR)
+
+from core import logger_utils
+
+logger = logger_utils.get_logger(__name__)
+logger.info(
+    f"Added the following directory to PYTHONPATH to simulate multiple modules: {ROOT_DIR}"
+)
```

**File**: `src/inference_pipeline/evaluation/evaluate.py` (modified, +5/-16)
```diff
@@ -1,36 +1,28 @@
 import argparse
 
+from config import settings
 from core.logger_utils import get_logger
 from core.opik_utils import create_dataset_from_artifacts
 from llm_twin import LLMTwin
 from opik.evaluation import evaluate
-from opik.evaluation.metrics import (
-    ContextPrecision,
-    ContextRecall,
-    Hallucination,
-    LevenshteinRatio,
-    Moderation,
-)
+from opik.evaluation.metrics import Hallucination, LevenshteinRatio, Moderation
 
-from config import settings
-from evaluation import Style
+from .style import Style
 
 logger = get_logger(__name__)
 
 
 def evaluation_task(x: dict) -> dict:
-    inference_pipeline = LLMTwin(mock=True)
+    inference_pipeline = LLMTwin(mock=False)
     result = inference_pipeline.generate(
         query=x["instruction"],
-        enable_rag=True,
+        enable_rag=False,
     )
     answer = result["answer"]
-    context = result["context"]
 
     return {
         "input": x["instruction"],
         "output": answer,
-        "context": context,
         "expected_output": x["content"],
         "reference": x["content"],
     }
@@ -55,7 +47,6 @@ def main() -> None:
         dataset_name="LLMTwinArtifactTestDataset",
         artifact_names=[
             "articles-instruct-dataset",
-            "posts-instruct-dataset",
             "repositories-instruct-dataset",
         ],
     )
@@ -70,8 +61,6 @@ def main() -> None:
         LevenshteinRatio(),
         Hallucination(),
         Moderation(),
-        ContextRecall(),
-        ContextPrecision(),
         Style(),
     ]
     evaluate(
```

**File**: `src/inference_pipeline/evaluation/evaluate_monitoring.py` (modified, +2/-2)
```diff
@@ -2,11 +2,11 @@
 
 import opik
 from config import settings
-from evaluation import Style
+from core.logger_utils import get_logger
 from opik.evaluation import evaluate
 from opik.evaluation.metrics import AnswerRelevance, Hallucination, Moderation
 
-from core.logger_utils import get_logger
+from .style import Style
 
 logger = get_logger(__name__)
 
```

---

### Incident Patch 7: `6341f05e` (2024-11-12)
**Commit Message**: fix: Fine-tuning dataset loading

**File**: `src/inference_pipeline/config.py` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ class Settings(BaseSettings):
 
     # LLM Model config
     HUGGINGFACE_ACCESS_TOKEN: str | None = None
-    MODEL_ID: str = "pauliusztin/LLMTwinLlama-3.1-8B"
+    MODEL_ID: str = "pauliusztin/LLMTwin-Meta-Llama-3.1-8B"
     DEPLOYMENT_ENDPOINT_NAME: str = "twin"
 
     MAX_INPUT_TOKENS: int = 1536  # Max length of input text.
```

**File**: `src/training_pipeline/finetune.py` (modified, +14/-14)
```diff
@@ -32,19 +32,15 @@ def __init__(
         self.output_dir = output_dir
         self.output_dir.mkdir(parents=True, exist_ok=True)
 
-    def download_dataset(self, dataset_id: str) -> Dataset:
-        # self.experiment = Experiment(
-        #     api_key=settings.COMET_API_KEY,
-        #     workspace=settings.COMET_WORKSPACE,
-        #     project_name=settings.COMET_PROJECT,
-        # )
+    def download_dataset(self, dataset_id: str, split: str = "train") -> Dataset:
+        assert split in ["train", "test"], "Split must be either 'train' or 'test'"
 
         if "/" in dataset_id:
             tokens = dataset_id.split("/")
             assert (
                 len(tokens) == 2
             ), f"Wrong format for the {dataset_id}. It should have a maximum one '/' character following the next template: 'comet_ml_workspace/comet_ml_artiface_name'"
-            workspace, artifact_name = dataset_id
+            workspace, artifact_name = tokens
 
             experiment = Experiment(workspace=workspace)
         else:
@@ -53,7 +49,7 @@ def download_dataset(self, dataset_id: str) -> Dataset:
             experiment = Experiment()
 
         artifact = self._download_artifact(artifact_name, experiment)
-        asset = self._artifact_to_asset(artifact)
+        asset = self._artifact_to_asset(artifact, split)
         dataset = self._load_data(asset)
 
         experiment.end()
@@ -73,13 +69,16 @@ def _download_artifact(self, artifact_name: str, experiment) -> Artifact:
 
         return artifact
 
-    def _artifact_to_asset(self, artifact: Artifact) -> ArtifactAsset:
+    def _artifact_to_asset(self, artifact: Artifact, split: str) -> ArtifactAsset:
         if len(artifact.assets) == 0:
             raise RuntimeError("Artifact has no assets")
-        elif len(artifact.assets) > 1:
-            raise RuntimeError("Artifact has more than one asset")
-        else:
-            asset = artifact.assets[0]
+        elif len(artifact.assets) != 2:
+            raise RuntimeError(
+                f"Artifact has more {len(artifact.assets)} assets, which is invalid. It should have only 2."
+            )
+
+        print(f"Picking split = '{split}'")
+        asset = [asset for asset in artifact.assets if split in asset.logical_path][0]
 
         return asset
 
@@ -334,8 +333,9 @@ def check_if_huggingface_model_exists(
     )
     inference(model, tokenizer)
 
+    base_model_suffix = args.base_model_name.split("/")[-1]
     sft_output_model_repo_id = (
-        f"{args.model_output_huggingface_workspace}/LLMTwin{args.base_model_name}"
+        f"{args.model_output_huggingface_workspace}/LLMTwin-{base_model_suffix}"
     )
     save_model(
         model,
```

---

### Incident Patch 8: `176a47bf` (2024-11-11)
**Commit Message**: fix: Config issues

**File**: `INSTALL_AND_USAGE.md` (modified, +0/-1)
```diff
@@ -165,7 +165,6 @@ For your AWS set-up to work correctly, you need the AWS CLI installed on your lo
 
 With the same configuration used to set up your AWS CLI, also fill in the following environment variables from your `.env` file:
 ```bash
-AWS_ARN_ROLE=str
 AWS_REGION=eu-central-1
 AWS_ACCESS_KEY=str
 AWS_SECRET_KEY=str
```

---

### Incident Patch 9: `c0913740` (2024-11-11)
**Commit Message**: fix: Config issues

**File**: `INSTALL_AND_USAGE.md` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ Behind the scenes it will build and run all the Docker images defined in the [do
 > 127.0.0.1       mongo3
 > ```
 >
-> From what we know, on `Windows`, it `works out-of-the-box`. For more details, check out this article: https://medium.com/workleap/the-only-local-mongodb-replica-set-with-docker-compose-guide-youll-ever-need-2f0b74dd8384
+> From what we know, on `Windows`, it `works out-of-the-box`. For more details, check out this [article](https://medium.com/workleap/the-only-local-mongodb-replica-set-with-docker-compose-guide-youll-ever-need-2f0b74dd8384)
 
 > [!WARNING]
 > For `arm` users (e.g., `M macOS devices`), go to your Docker desktop application and enable `Use Rosetta for x86_64/amd64 emulation on Apple Silicon` from the Settings. There is a checkbox you have to check.
```

---

### Incident Patch 10: `935efd19` (2024-11-11)
**Commit Message**: fix: Config issues

**File**: `INSTALL_AND_USAGE.md` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ Run the following `Make` command to tear down all your docker containers:
 make local-stop
 ```
 
-## Run an end-to-end flow
+# Usage: Run an end-to-end flow
 
 Now that we have configured our credentials, local environemnt and Docker infrastructure let's look at how to run an end-to-end flow of the LLM Twin course.
 
```

---

### Incident Patch 11: `33909306` (2024-11-11)
**Commit Message**: fix: Config issues

**File**: `.env.example` (modified, +21/-16)
```diff
@@ -1,21 +1,26 @@
-# ============ Data Crawling ============
-# Optional LinkedIn credentials for scraping your profile
-LINKEDIN_USERNAME=
-LINKEDIN_PASSWORD=
 
-# ============ Feature engineering and Inference pipelines ============
-OPENAI_API_KEY=
+# --- Required settings even when working locally. ---
 
-# Optional in case you use the cloud version of Qdrant (and not the Docker one)
-USE_QDRANT_CLOUD=false
-QDRANT_CLOUD_URL=
-QDRANT_APIKEY=
+# OpenAI API Config
+OPENAI_MODEL_ID=gpt-4o-mini
+OPENAI_API_KEY=str
+
+# Huggingface API Config
+HUGGINGFACE_ACCESS_TOKEN=str
 
-# ============ Model training and evaluation ============
-COMET_API_KEY=
-COMET_WORKSPACE=
-COMET_PROJECT=
+# Comet ML (during training and inference) 
+COMET_API_KEY=str
+COMET_WORKSPACE=str # such as your Comet username
 
-HUGGINGFACE_ACCESS_TOKEN=
+# --- Required settings when using Qdrant Cloud and AWS SageMaker ---
+
+# Qdrant vector database
+USE_QDRANT_CLOUD=false
+QDRANT_CLOUD_URL=str
+QDRANT_APIKEY=str
 
-QWAK_DEPLOYMENT_MODEL_ID="llm_twin"
+# AWS Authentication
+AWS_ARN_ROLE=str
+AWS_REGION=eu-central-1
+AWS_ACCESS_KEY=str
+AWS_SECRET_KEY=str
```

**File**: `GENERATE_INSTRUCT_DATASET.md` (removed, +0/-22)
```diff
@@ -1,22 +0,0 @@
-# Generate Data for LLM finetuning task component
-
-## Component Structure
-
-### File Handling
-- `file_handler.py`: Manages file I/O operations, enabling reading and writing of JSON formatted data.
-
-### LLM Communication
-- `llm_communication.py`: Handles communication with OpenAI's LLMs, sending prompts and processing responses.
-
-### Data Generation
-- `generate_data.py`: Orchestrates the generation of training data by integrating file handling, LLM communication, and data formatting.
-
-
-### Usage
-
-The project includes a `Makefile` for easy management of common tasks. Here are the main commands you can use:
-
-- `make help`: Displays help for each make command.
-- `make local-start`: Build and start mongodb, mq and qdrant.
-- `make local-test-github`: Insert data to mongodb
-- `make generate-dataset`: Generate dataset for finetuning and version it in CometML
\ No newline at end of file
```

**File**: `INSTALL_AND_USAGE.md` (modified, +132/-45)
```diff
@@ -1,48 +1,65 @@
-# Local Install
+# Install 
 
 ## System dependencies
 
 Before starting to install the LLM Twin project, make sure you have installed the following dependencies on your system:
 
-- [Docker ">=v27.0.3"](https://www.docker.com/)
+- [Python "3.11"](https://www.python.org/downloads/)
+- [Poetry ">=1.8.4"](https://python-poetry.org/docs/)
 - [GNU Make ">=3.81"](https://www.gnu.org/software/make/)
+- [Docker ">=v27.0.3"](https://www.docker.com/)
+- [aws CLI ">=2.18.5"](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
+
+## Cloud / services dependencies
+
+
+
+## Supported commands
 
-The whole LLM Twin application will be run locally using Docker. 
+We will use `GNU Make` to install and run our application.
+
+To see all our supported commands, run the following:
+```shell
+make help
+```
 
 ## Configure
 
-All the sensitive credentials are placed in a `.env` file that will always sit on your hardware.
+All the sensitive credentials are placed in a `.env` file that will always sit at the root of your directory, at the same level with the `.env.example` file.
 
 Go to the root of the repository, copy our `.env.example` file and fill it with your credentials:
 ```shell
 cp .env.example .env
 ```
 
-## Supported commands
-
-We will use `GNU Make` to install and run our application.
+## Install local dependencies
 
-To see all our supported commands, run the following:
+You can create a Python virtual environment and install all the necesary dependencies using Poetry, by running:
 ```shell
-make help
+make install
 ```
+**NOTE:** You need Python 3.11 installed. You can either install it globally or install [pyenv](https://github.com/pyenv/pyenv) to manage multiple Python dependencies. The `.python-version` file will signal to `pyenv` what Python version it needs to use in this particular project.
 
-## Set up the infrastructure
+After installing the dependencies into the Poetry virtual environment, you can run the following to activate it into your current CLI:
+```bash
+poetry shell
+```
 
-### Spin up the infrastructure
+## Set up the data infrastructure
+
+We support running the entire data infrastructure (crawling, CDC, MongoDB, and Qdrant) through Docker. Thus, with a few commands you can quickly populate the data warehouse and vector DB with relevant data to test out the RAG, training, and inference parts of the course.
 
-Now, the whole infrastructure can be spun up using a simple Make command:
+### Spin up the infrastructure
 
+You can start all the required Docker containers, by running:
 ```shell
 make local-start
 ```
 
 Behind the scenes it will build and run all the Docker images defined in the [docker-compose.yml](https://github.com/decodingml/llm-twin-course/blob/main/docker-compose.yml) file.
 
-## Read this before starting 🚨 
-
 > [!CAUTION]
-> For `Mongo` to work with multiple replicas (as we use it in our Docker setup) on `macOS` or `Linux` systems, you have to add the following lines of code to `/etc/hosts`:
+> For `MongoDB` to work with multiple replicas (as we use it in our Docker setup) on `macOS` or `Linux` systems, you have to add the following lines of code to `/etc/hosts`:
 >
 > ```
 > 127.0.0.1       mongo1
@@ -53,7 +70,7 @@ Behind the scenes it will build and run all the Docker images defined in the [do
 > From what we know, on `Windows`, it `works out-of-the-box`. For more details, check out this article: https://medium.com/workleap/the-only-local-mongodb-replica-set-with-docker-compose-guide-youll-ever-need-2f0b74dd8384
 
 > [!WARNING]
-> For `arm` users (e.g., `M1/M2/M3 macOS devices`), go to your Docker desktop application and enable `Use Rosetta for x86_64/amd64 emulation on Apple Silicon` from the Settings. There is a checkbox you have to check.
+> For `arm` users (e.g., `M macOS devices`), go to your Docker desktop application and enable `Use Rosetta for x86_64/amd64 emulation on Apple Silicon` from the Settings. There is a checkbox you have to check.
 > Otherwise, your Docker containers will crash.
 
 ### Tear down the infrastructure
@@ -66,29 +83,39 @@ make local-stop
 
 ## Run an end-to-end flow
 
-Now that we have configured our credentials and started our infrastructure let's look at how to run an end-to-end flow of the LLM Twin application.
+Now that we have configured our credentials, local environemnt and Docker infrastructure let's look at how to run an end-to-end flow of the LLM Twin course.
 
 > [!IMPORTANT]
-> Note that we won't go into the details of the system here. To fully understand it, check out our free article series, which explains everything step-by-step: [LLM Twin articles series](https://medium.com/decodingml/llm-twin-course/home).
+> Note that we won't go into the details of the system here. To fully understand it, check out our free lessons, which explains everything step-by-step: [LLM Twin articles series](https://medium.com/decodingml/llm-twin-course/home).
 
-### Step 1: Crawlers
+### Step 1: Crawling 
```

**File**: `Makefile` (modified, +25/-55)
```diff
@@ -13,46 +13,36 @@ GREEN := \033[0;32m
 YELLOW := \033[0;33m
 RESET := \033[0m
 
-install:
+install: # Create a local Poetry virtual environment and install all required Python dependencies.
 	poetry env use 3.11
 	poetry install --without superlinked_rag
 
 help:
 	@grep -E '^[a-zA-Z0-9 -]+:.*#'  Makefile | sort | while read -r l; do printf "\033[1;32m$$(echo $$l | cut -f 1 -d':')\033[00m:$$(echo $$l | cut -f 2- -d'#')\n"; done
 
 # ======================================
-# ---------- Infrastructure ------------
+# ------- Docker Infrastructure --------
 # ======================================
 
-push: # Build & push image to docker ECR (e.g make push IMAGE_TAG=latest)
-	echo "Logging into AWS ECR..."
-	aws ecr get-login-password --region $(AWS_CURRENT_REGION_ID) | docker login --username AWS --password-stdin $(AWS_CURRENT_ACCOUNT_ID).dkr.ecr.$(AWS_CURRENT_REGION_ID).amazonaws.com
-	echo "Build & Push Docker image..."
-	docker buildx build --platform linux/amd64 -t $(AWS_CURRENT_ACCOUNT_ID).dkr.ecr.$(AWS_CURRENT_REGION_ID).amazonaws.com/crawler:$(IMAGE_TAG) .
-	echo "Push completed successfully."
-
-local-start: # Buil and start local infrastructure.
+local-start: # Build and start your local Docker infrastructure.
 	docker compose -f docker-compose.yml up --build -d
 
-local-stop: # Stop local infrastructure.
+local-stop: # Stop your local Docker infrastructure.
 	docker compose -f docker-compose.yml down --remove-orphans
 
-create-sagemaker-execution-role: # Create SageMaker execution role.
-	cd src && poetry run python -m core.aws.create_execution_role
-
 # ======================================
-# ------------- Crawler ----------------
+# ---------- Crawling Data -------------
 # ======================================
 
-local-test-medium: # Send test command on local to test the lambda with a Medium article
+local-test-medium: # Make a call to your local AWS Lambda (hosted in Docker) to crawl a Medium article.
 	curl -X POST "http://localhost:9010/2015-03-31/functions/function/invocations" \
 	  	-d '{"user": "Paul Iusztin", "link": "https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f"}'
 
-local-test-github: # Send test command on local to test the lambda with a Github repository
+local-test-github: # Make a call to your local AWS Lambda (hosted in Docker) to crawl a Github repository.
 	curl -X POST "http://localhost:9010/2015-03-31/functions/function/invocations" \
 	  	-d '{"user": "Paul Iusztin", "link": "https://github.com/decodingml/llm-twin-course"}'
 
-local-ingest-data: # Ingest all links from data/links.txt file
+local-ingest-data: # Ingest all links from data/links.txt by calling your local AWS Lambda hosted in Docker.
 	while IFS= read -r link; do \
 		echo "Processing: $$link"; \
 		curl -X POST "http://localhost:9010/2015-03-31/functions/function/invocations" \
@@ -61,61 +51,41 @@ local-ingest-data: # Ingest all links from data/links.txt file
 		sleep 2; \
 	done < data/links.txt
 
-cloud-test-medium: # Send command to the cloud lambda with a Github repository
-	aws lambda invoke \
-		--function-name crawler \
-		--cli-binary-format raw-in-base64-out \
-		--payload '{"user": "Paul Iusztin", "link": "https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f"}' \
-		response.json
-
 # ======================================
 # -------- RAG Feature Pipeline --------
 # ======================================
 
-local-feature-pipeline: # Run the RAG feature pipeline
-	RUST_BACKTRACE=full poetry run python -m bytewax.run src/feature_pipeline/main.py
-
-local-test-retriever: # Test retriever
-	docker exec -it llm-twin-bytewax python -m retriever
-
-generate-dataset: # Generate dataset for finetuning and version it in Comet ML
-	docker exec -it llm-twin-bytewax python -m finetuning.generate_data
-
-# ======================================
-# ------ AWS SageMaker: Training pipeline ------
-# ======================================
+local-test-retriever: # Test the RAG retriever using your Poetry env
+	cd src/feature_pipeline && poetry run python -m retriever
 
-generate-instruct-dataset:
+local-generate-instruct-dataset: # Generate the fine-tuning instruct dataset using your Poetry env.
 	cd src/feature_pipeline && poetry run python -m generate_dataset.generate
 
-start-training-pipeline:
-	cd src/training_pipeline && poetry run python run_on_sagemaker.py
+# ===================================================
+# -- AWS SageMaker: Training & Inference pipelines --
+# ===================================================
 
-create-qwak-project: # Create Qwak project for serving the model
-	@echo "$(YELLOW)Creating Qwak project...$(RESET)"
-	qwak models create "llm_twin" --project "llm-twin-course"
+create-sagemaker-execution-role: # Create an AWS SageMaker execution role you need for the training and inference pipelines.
+	cd src && PYTHONPATH=$(PYTHONPATH) po
```

**File**: `RAG.md` (removed, +0/-212)
```diff
@@ -1,212 +0,0 @@
-# RAG component
-A production RAG system is split into 3 main components:
-
-    - ingestion: clean, chunk, embed, and load your data to a vector DB
-    - retrieval: query your vector DB for context
-    - generation: attach the retrieved context to your prompt and pass it to an LLM
-
-The ingestion component sits in the feature pipeline, while the retrieval and generation components are implemented inside the inference pipeline.
-
-You can also use the retrieval and generation components in your training pipeline to fine-tune your LLM further on domain-specific prompts.
-
-You can apply advanced techniques to optimize your RAG system for ingestion, retrieval and generation.
-
-That being said, there are 3 main types of advanced RAG techniques:
-
-    - Pre-retrieval optimization [ingestion]: tweak how you create the chunks
-    - Retrieval optimization [retrieval]: improve the queries to your vector DB
-    - Post-retrieval optimization [retrieval]: process the retrieved chunks to filter out the noise
-
-You can learn more about RAG from Decoding ML LLM Twin Course: 
-- Lesson 4: [SOTA Python Streaming Pipelines for Fine-tuning LLMs and RAG — in Real-Time!](https://medium.com/decodingml/sota-python-streaming-pipelines-for-fine-tuning-llms-and-rag-in-real-time-82eb07795b87)
-- Lesson 5: [The 4 Advanced RAG Algorithms You Must Know to Implement](https://medium.com/decodingml/the-4-advanced-rag-algorithms-you-must-know-to-implement-5d0c7f1199d2)
-
-![Advanced RAG architecture](https://miro.medium.com/v2/resize:fit:720/format:webp/1*ui2cQRlRDVnKrXPXk7COLA.png "Advanced RAG architecture")
-
-
-# Finetuning dataset preparation component
-The finetuning dataset preparation module automates the generation of datasets specifically formatted for training and fine-tuning Large Language Models (LLMs). It interfaces with Qdrant, sends structured prompts to LLMs, and manages data with Comet ML for experiment tracking and artifact logging.
-
-### Why is fine-tuning important?
-1. **Model Customization**: Tailors the LLM's responses to specific domains or tasks.
-2. **Improved Accuracy**: Enhances the model's understanding of nuanced language used in specialized fields.
-3. **Efficiency**: Reduces the need for extensive post-processing by producing more relevant outputs directly.
-4. **Adaptability**: Allows models to continuously learn from new data, staying relevant as language and contexts evolve.
-
-TBD add about lesson
-![Finetuning Dataset Preparation Flow](https://cdn-images-1.medium.com/max/800/1*gufpoEo92ZtuGQlVx6HVTw.png "Finetuning Dataset Preparation Flow")
-
-
-# Dependencies
-## Installation and Setup
-To prepare your environment for these components, follow these steps:
-- `poetry init`
-- `poetry install`
-
-## Docker Settings
-### Host Configuration
-To ensure that your Docker containers can communicate with each other you need to update your `/etc/hosts` file. 
-Add the following entries to map the hostnames to your local machine:
-
-```plaintext
-# Docker MongoDB Hosts Configuration
-127.0.0.1       mongo1
-127.0.0.1       mongo2
-127.0.0.1       mongo3
-```
-
-For Windows users check this article: https://medium.com/workleap/the-only-local-mongodb-replica-set-with-docker-compose-guide-youll-ever-need-2f0b74dd8384
-
-# CometML Integration
-
-## Overview
-[CometML](https://www.comet.com/signup/?utm_source=decoding_ml&utm_medium=partner&utm_content=github) is a cloud-based platform that provides tools for tracking, comparing, explaining, and optimizing experiments and models in machine learning. CometML helps data scientists and teams to better manage and collaborate on machine learning experiments.
-
-## Why Use CometML?
-- **Experiment Tracking**: CometML automatically tracks your code, experiments, and results, allowing you to compare between different runs and configurations visually.
-- **Model Optimization**: It offers tools to compare different models side by side, analyze hyperparameters, and track model performance across various metrics.
-- **Collaboration and Sharing**: Share findings and models with colleagues or the ML community, enhancing team collaboration and knowledge transfer.
-- **Reproducibility**: By logging every detail of the experiment setup, CometML ensures experiments are reproducible, making it easier to debug and iterate.
-
-## CometML Variables
-When integrating CometML into your projects, you'll need to set up several environment variables to manage the authentication and configuration:
-
-- `COMET_API_KEY`: Your unique API key that authenticates your interactions with the CometML API.
-- `COMET_PROJECT`: The project name under which your experiments will be logged.
-- `COMET_WORKSPACE`: The workspace name that organizes various projects and experiments.
-
-## Obtaining CometML Variables
-
-To access and set up the necessary CometML variables for your project, follow these steps:
-
-1. **Create an Account or Log In**:
-   - Visit [CometML's website](https:
```

**File**: `poetry.lock` (modified, +1/-1)
```diff
@@ -7032,4 +7032,4 @@ type = ["pytest-mypy"]
 [metadata]
 lock-version = "2.0"
 python-versions = "~3.11"
-content-hash = "932e35919c2a148ec17d0dad241010c0021502af8f59f5a22efcdaadd594e094"
+content-hash = "685a390a4315243d8b04b64926a9960aad374bcb5f8406887925c7b842a2574f"
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ langchain-community = "^0.2.11"
 html2text = "^2024.2.26"
 huggingface-hub = "0.25.0"
 sagemaker = ">=2.232.2"
+sentence-transformers = "^2.2.2"
 
 [tool.poetry.group.feature_pipeline.dependencies]
 bytewax = "0.18.2"
```

**File**: `src/bonus_superlinked_rag/config.py` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 
 class Settings(BaseSettings):
     # Embeddings config
-    EMBEDDING_MODEL_ID: str = "sentence-transformers/all-mpnet-base-v2"
+    EMBEDDING_MODEL_ID: str = "BAAI/bge-small-en-v1.5"
 
     # MQ config
     RABBITMQ_DEFAULT_USERNAME: str = "guest"
```

---

### Incident Patch 12: `bc66eb22` (2024-08-01)
**Commit Message**: fix: Media



---

### Incident Patch 13: `e0f268d4` (2024-08-01)
**Commit Message**: docs: Add end-to-end docs. Fix small bugs

**File**: `3-feature-pipeline/db.py` (modified, +2/-2)
```diff
@@ -62,8 +62,8 @@ def search(
         self,
         collection_name: str,
         query_vector: list,
-        query_filter: models.Filter,
-        limit: int,
+        query_filter: models.Filter | None = None,
+        limit: int = 3,
     ) -> list:
         return self._instance.search(
             collection_name=collection_name,
```

**File**: `3-feature-pipeline/finetuning/generate_data.py` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@
 from comet_ml import Artifact, Experiment
 
 from utils.logging import get_logger
-from db.qdrant import QdrantDatabaseConnector
+from db import QdrantDatabaseConnector
 from finetuning.file_handler import FileHandler
 from finetuning.llm_communication import GptCommunicator
 from config import settings
@@ -126,7 +126,7 @@ def fetch_all_cleaned_content(self, collection_name: str) -> list:
     data_formatter = DataFormatter()
     dataset_generator = DatasetGenerator(file_handler, api_communicator, data_formatter)
 
-    collections = [("cleaned_articles", "articles"), ("cleaned_posts", "posts")]
+    collections = [("cleaned_articles", "articles"), ("cleaned_posts", "posts"), ("cleaned_repositories", "repositories")]
     for (collection_name, data_type) in collections:
         logger.info("Generating training data.", collection_name=collection_name, data_type=data_type)
         
```

**File**: `3-feature-pipeline/finetuning/llm_communication.py` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 from openai import OpenAI
 
 from utils.logging import get_logger
-from ..config import settings
+from config import settings
 
 MAX_LENGTH = 16384
 SYSTEM_PROMPT = (
```

**File**: `3-feature-pipeline/llm/prompt_templates.py` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ class SelfQueryTemplate(BasePromptTemplate):
     prompt: str = """You are an AI language model assistant. Your task is to extract information from a user question.
     The required information that needs to be extracted is the user or author id. 
     Your response should consists of only the extracted id (e.g. 1345256), nothing else.
+    If you cannot find the author id, return the string "None".
     User question: {question}"""
 
     def create_template(self) -> PromptTemplate:
```

**File**: `3-feature-pipeline/rag/retriever.py` (modified, +12/-9)
```diff
@@ -2,7 +2,7 @@
 
 from utils.logging import get_logger
 import utils
-from db.qdrant import QdrantDatabaseConnector
+from db import QdrantDatabaseConnector
 from qdrant_client import models
 from rag.query_expanison import QueryExpansion
 from rag.reranking import Reranker
@@ -27,7 +27,7 @@ def __init__(self, query: str):
         self._reranker = Reranker()
 
     def _search_single_query(
-        self, generated_query: str, metadata_filter_value: str, k: int
+        self, generated_query: str, metadata_filter_value: str | None, k: int
     ):
         assert k > 3, "k should be greater than 3"
 
@@ -44,7 +44,7 @@ def _search_single_query(
                             ),
                         )
                     ]
-                ),
+                ) if metadata_filter_value else None,
                 query_vector=query_vector,
                 limit=k // 3,
             ),
@@ -59,7 +59,7 @@ def _search_single_query(
                             ),
                         )
                     ]
-                ),
+                ) if metadata_filter_value else None,
                 query_vector=query_vector,
                 limit=k // 3,
             ),
@@ -74,7 +74,7 @@ def _search_single_query(
                             ),
                         )
                     ]
-                ),
+                ) if metadata_filter_value else None,
                 query_vector=query_vector,
                 limit=k // 3,
             ),
@@ -92,10 +92,13 @@ def retrieve_top_k(self, k: int, to_expand_to_n_queries: int) -> list:
         )
 
         author_id = self._metadata_extractor.generate_response(self.query)
-        logger.info(
-            "Successfully extracted the author_id from the query.",
-            author_id=author_id,
-        )
+        if author_id:
+            logger.info(
+                "Successfully extracted the author_id from the query.",
+                author_id=author_id,
+            )
+        else:
+            logger.info("Couldn't extract the author_id from the query.")
 
         with concurrent.futures.ThreadPoolExecutor() as executor:
             search_tasks = [
```

**File**: `3-feature-pipeline/rag/self_query.py` (modified, +5/-2)
```diff
@@ -6,7 +6,7 @@
 
 class SelfQuery:
     @staticmethod
-    def generate_response(query: str) -> str:
+    def generate_response(query: str) -> str | None:
         prompt = SelfQueryTemplate().create_template()
         model = ChatOpenAI(model=settings.OPENAI_MODEL_ID, temperature=0)
 
@@ -15,6 +15,9 @@ def generate_response(query: str) -> str:
         )
 
         response = chain.invoke({"question": query})
-        result = response["metadata_filter_value"]
+        result = response.get("metadata_filter_value", "none")
+        
+        if result.lower() == "none":
+            return None
 
         return result
```

**File**: `3-feature-pipeline/retriever.py` (modified, +0/-2)
```diff
@@ -11,8 +11,6 @@
 if __name__ == "__main__":
     load_dotenv()
     query = """
-        Hello my author_id is 1.
-        
         Could you please draft a LinkedIn post discussing RAG systems?
         I'm particularly interested in how RAG works and how it is integrated with vector DBs and large language models (LLMs).
         """
```

**File**: `4-finetuning/README.md` (modified, +2/-2)
```diff
@@ -223,9 +223,9 @@ verbose: 0
 The project includes a `Makefile` for easy management of common tasks. Here are the main commands you can use:
 
 - `make help`: Displays help for each make command.
-- `make test`: Runs tests on local-qwak deployment.
+- `make local-test-inference-pipeline`: Runs tests on local-qwak deployment.
 - `make create-qwak-project`: Create a Qwak project to deploy the model.
-- `make deploy`: Triggers a new fine-tuning job to Qwak remotely, using the configuration specified in `build_config.yaml`
+- `make deploy-inference-pipeline`: Triggers a new fine-tuning job to Qwak remotely, using the configuration specified in `build_config.yaml`
 
 ------
 
```

---

### Incident Patch 14: `1ce22971` (2024-07-31)
**Commit Message**: docs: Fix typos

**File**: `INSTALL_AND_USAGE.md` (modified, +3/-3)
```diff
@@ -4,8 +4,8 @@
 
 Before starting to install the LLM Twin project, make sure you have installed the following dependencies on your system:
 
-- (Docker ">=v27.0.3")[https://www.docker.com/]
-- (GNU Make ">=3.81")[https://www.gnu.org/software/make/]
+- [Docker ">=v27.0.3"](https://www.docker.com/)
+- [GNU Make ">=3.81"](https://www.gnu.org/software/make/)
 
 The whole LLM Twin application will be run locally using Docker. 
 
@@ -92,7 +92,7 @@ docker logs llm-twin-bytewax
 ```
 You should see logs reflecting the cleaning, chunking, and embedding operations (without any errors, of course).
 
-To check that the Qdrant `vector DB` is populated successfully, go to its dashboard at localhost:6333/dashboard. There, you should see the repositories or article collections created and populated.
+To check that the Qdrant `vector DB` is populated successfully, go to its dashboard at [localhost:6333/dashboard](localhost:6333/dashboard). There, you should see the repositories or article collections created and populated.
 
 > [!NOTE]
 > If using the cloud version of Qdrant, go to your Qdrant account and cluster to see the same thing as in the local dashboard.
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 <div align="center">
     <h2>LLM Twin Course: Building Your Production-Ready AI Replica</h2>
-    <h1>Learn to build an end-to-end system for production-ready LLM & RAG systems by building your LLM Twin</h1>
+    <h1>Learn to architect and implement a production-ready LLM & RAG system by building your LLM Twin</h1>
     <h3>From data gathering to productionizing LLMs using LLMOps good practices.</h3>
     <i>by <a href="https://github.com/iusztinpaul">Paul Iusztin</a>, <a href="https://github.com/alexandruvesa">Alexandru Vesa</a> and <a href="https://github.com/Joywalker">Alexandru Razvant</a></i>
 </div>
@@ -153,7 +153,7 @@ To understand how to install and run the LLM Twin code, go to the [INSTALL_AND_U
 
 The bonus Superlinked series has an extra dedicated [README](https://github.com/decodingml/llm-twin-course/blob/main/6-bonus-superlinked-rag/README.md) that you can access under the [6-bonus-superlinked-rag](https://github.com/decodingml/llm-twin-course/tree/main/6-bonus-superlinked-rag) directory.
 
-Here we explain all the changes made to the code to run it with the improved RAG layer powered by [Superlinked](https://rebrand.ly/superlinked-github).
+In that section, we explain how to run it with the improved RAG layer powered by [Superlinked](https://rebrand.ly/superlinked-github).
 
 ## Meet your teachers!
 
```

#### Recent Merged Pull Requests:
- **PR #45** (2024-11-21): Fix typos (@strickvl)
- **PR #43** (2024-11-15): fix: Training & evaluation mintor bugs (@iusztinpaul)
- **PR #42** (2024-11-12): Feat/integrate opik (@iusztinpaul)
- **PR #37** (2024-08-20): feat: Implement advanced RAG retrieval steps using Superlinked (@iusztinpaul)
- **PR #28** (closed): Small fixes for running module-1-crawlers on github actions (@abulhawa)
- **PR #27** (2024-07-18): feat: Add Superlinked skeleton (@iusztinpaul)
- **PR #26** (2024-07-05): Restructure repository (@rsergiuistoc)
- **PR #24** (2024-06-09): RAG evaluation using RAGAs (@arazvant)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
