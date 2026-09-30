# Forensic Learning Record (Deep Inspection): decodingai-magazine/llm-twin-course

> **Canonical Artifact**: `07_PROJECT_LEARNING/decodingai-magazine-llm-twin-course-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/decodingai-magazine/llm-twin-course](https://github.com/decodingai-magazine/llm-twin-course))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:33:10.560Z  
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

### Core Architecture Module: `src/bonus_superlinked_rag/config.py`
```
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Embeddings config
    EMBEDDING_MODEL_ID: str = "BAAI/bge-small-en-v1.5"

    # MQ config
    RABBITMQ_DEFAULT_USERNAME: str = "guest"
    RABBITMQ_DEFAULT_PASSWORD: str = "guest"
    RABBITMQ_HOST: str = "mq"  # or localhost if running outside Docker
    RABBITMQ_PORT: int = 5672
    RABBITMQ_QUEUE_NAME: str = "default"

    # Superlinked
    SUPERLINKED_SERVER_URL: str = (
        "http://executor:8080"  # # or http://localhost:8080 if running outside Docker
    )

    # OpenAI
    OPENAI_MODEL_ID: str = "gpt-4o-mini"
    OPENAI_API_KEY: str | None = None


settings = Settings()

```

### Core Architecture Module: `src/bonus_superlinked_rag/data_flow/stream_input.py`
```
import json
import time
from datetime import datetime
from typing import Generic, Iterable, List, Optional, TypeVar

from bytewax.inputs import FixedPartitionedSource, StatefulSourcePartition
from config import settings
from mq import RabbitMQConnection
from utils.logging import get_logger

logger = get_logger(__name__)

DataT = TypeVar("DataT")
MessageT = TypeVar("MessageT")


class RabbitMQSource(FixedPartitionedSource, Generic[DataT, MessageT]):
    def list_parts(self) -> List[str]:
        return ["single partition"]

    def build_part(
        self, now: datetime, for_part: str, resume_state: MessageT | None = None
    ) -> StatefulSourcePartition[DataT, MessageT]:
        return RabbitMQPartition(queue_name=settings.RABBITMQ_QUEUE_NAME)


class RabbitMQPartition(StatefulSourcePartition, Generic[DataT, MessageT]):
    """
    Class responsible for creating a connection between bytewax and rabbitmq that facilitates the transfer of data from mq to bytewax streaming piepline.
    Inherits StatefulSourcePartition for snapshot functionality that enables saving the state of the queue
    """

    def __init__(self, queue_name: str, resume_state: MessageT | None = None) -> None:
        self._in_flight_msg_ids = resume_state or set()
        self.queue_name = queue_name
        self.connection = RabbitMQConnection()

        try:
            self.connection.connect()
            self.channel = self.connection.get_channel()
        except Exception:
            logger.warning(
                f"Error while trying to connect to the queue and get the current channel {self.queue_name}",
            )

    def next_batch(self, sched: Optional[datetime]) -> Iterable[DataT]:
        try:
            method_frame, header_frame, body = self.channel.basic_get(
                queue=self.queue_name, auto_ack=True
            )
        except Exception:
            logger.warning(
                f"Error while fetching message from queue: {self.queue_name}", 
            )
            time.sleep(10)  # Sleep for 10 seconds before retrying to access the queue.

            self.connection.connect()
            self.channel = self.connection.get_channel()

            return []

        if method_frame:
            message_id = method_frame.delivery_tag
            self._in_flight_msg_ids.add(message_id)

            return [json.loads(body)]
        else:
            return []

    def snapshot(self) -> MessageT:
        return self._in_flight_msg_ids

    def garbage_collect(self, state):
        closed_in_flight_msg_ids = state
        for msg_id in closed_in_flight_msg_ids:
            self.channel.basic_ack(delivery_tag=msg_id)
            self._in_flight_msg_ids.remove(msg_id)

    def close(self):
        self.channel.close()

```

### Core Architecture Module: `src/bonus_superlinked_rag/data_flow/stream_output.py`
```
from bytewax.outputs import DynamicSink, StatelessSinkPartition
from models.documents import Document
from superlinked_client import SuperlinkedClient
from tqdm import tqdm
from utils.logging import get_logger

logger = get_logger(__name__)


class SuperlinkedOutputSink(DynamicSink):
    def __init__(self, client: SuperlinkedClient) -> None:
        self._client = client

    def build(self, worker_index: int, worker_count: int) -> StatelessSinkPartition:
        return SuperlinkedSinkPartition(client=self._client)


class SuperlinkedSinkPartition(StatelessSinkPartition):
    def __init__(self, client: SuperlinkedClient):
        self._client = client

    def write_batch(self, items: list[Document]) -> None:
        for item in tqdm(items, desc="Sending items to Superlinked..."):
            match item.type:
                case "repositories":
                    self._client.ingest_repository(item)
                case "posts":
                    self._client.ingest_post(item)
                case "articles":
                    self._client.ingest_article(item)
                case _:
                    logger.error(f"Unknown item type: {item.type}")

```

### Core Architecture Module: `src/bonus_superlinked_rag/data_logic/cleaning_data_handlers.py`
```
from abc import ABC, abstractmethod

from models.documents import ArticleDocument, Document, PostDocument, RepositoryDocument
from models.raw import ArticleRawModel, PostsRawModel, RawModel, RepositoryRawModel
from utils.cleaning import clean_text

from .splitters import split_text


class CleaningDataHandler(ABC):
    """
    Abstract class for all cleaning data handlers.
    All data transformations logic for the cleaning step is done here
    """

    @abstractmethod
    def clean(self, data_model: RawModel) -> list[Document]:
        pass


class PostCleaningHandler(CleaningDataHandler):
    def clean(self, data_model: PostsRawModel) -> list[PostDocument]:
        documents = []
        cleaned_text = clean_text("".join(data_model.content.values()))
        for post_subsection in split_text(cleaned_text):
            documents.append(
                PostDocument(
                    id=data_model.id,
                    platform=data_model.platform,
                    content=post_subsection,
                    author_id=data_model.author_id,
                    type=data_model.type,
                )
            )

        return documents


class ArticleCleaningHandler(CleaningDataHandler):
    def clean(self, data_model: ArticleRawModel) -> list[ArticleDocument]:
        documents = []
        cleaned_text = clean_text("".join(data_model.content.values()))
        for article_subsection in split_text(cleaned_text):
            documents.append(
                ArticleDocument(
                    id=data_model.id,
                    platform=data_model.platform,
                    link=data_model.link,
                    content=article_subsection,
                    author_id=data_model.author_id,
                    type=data_model.type,
                )
            )

        return documents


class RepositoryCleaningHandler(CleaningDataHandler):
    def clean(self, data_model: RepositoryRawModel) -> list[RepositoryDocument]:
        documents = []
        for file_name, file_content in data_model.content.items():
            cleaned_file_content = clean_text(file_content)
            for file_subsection in split_text(cleaned_file_content):
                documents.append(
                    RepositoryDocument(
                        id=data_model.id,
                        platform=data_model.platform,
                        name=f"{data_model.name}:{file_name}",
                        link=data_model.link,
                        content=file_subsection,
                        author_id=data_model.owner_id,
                        type=data_model.type,
                    )
                )

        return documents

```

### Core Architecture Module: `src/bonus_superlinked_rag/data_logic/dispatchers.py`
```
from data_logic.cleaning_data_handlers import (
    ArticleCleaningHandler,
    CleaningDataHandler,
    PostCleaningHandler,
    RepositoryCleaningHandler,
)
from models.documents import Document
from models.raw import ArticleRawModel, PostsRawModel, RawModel, RepositoryRawModel
from utils.logging import get_logger

logger = get_logger(__name__)


class RawDispatcher:
    @staticmethod
    def handle_mq_message(message: dict) -> RawModel:
        data_type = message.get("type")

        logger.info("Received raw message.", data_type=data_type)

        if data_type == "posts":
            return PostsRawModel(**message)
        elif data_type == "articles":
            return ArticleRawModel(**message)
        elif data_type == "repositories":
            return RepositoryRawModel(**message)
        else:
            raise ValueError(f"Unsupported data type: {data_type}")


class CleaningHandlerFactory:
    @staticmethod
    def create_handler(data_type: str) -> CleaningDataHandler:
        if data_type == "posts":
            return PostCleaningHandler()
        elif data_type == "articles":
            return ArticleCleaningHandler()
        elif data_type == "repositories":
            return RepositoryCleaningHandler()
        else:
            raise ValueError("Unsupported data type")


class CleaningDispatcher:
    cleaning_factory = CleaningHandlerFactory()

    @classmethod
    def dispatch_cleaner(cls, data_model: RawModel) -> list[Document]:
        logger.info("Cleaning data.", data_type=data_model.type)

        data_type = data_model.type
        handler = cls.cleaning_factory.create_handler(data_type)
        cleaned_models = handler.clean(data_model)

        logger.info(
            "Data cleaned successfully.",
            data_type=data_type,
            len_cleaned_documents=len(cleaned_models),
            len_content=sum([len(doc.content) for doc in cleaned_models]),
        )

        return cleaned_models

```

### Core Architecture Module: `src/bonus_superlinked_rag/data_logic/splitters.py`
```
from langchain_text_splitters import RecursiveCharacterTextSplitter


def split_text(text: str) -> list[str]:
    character_splitter = RecursiveCharacterTextSplitter(
        separators=["\n\n"], chunk_size=2000, chunk_overlap=0
    )
    chunks = character_splitter.split_text(text)

    return chunks

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

---

### Incident Patch 5: `a809583c` (2024-11-14)
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

---

### Incident Patch 6: `6341f05e` (2024-11-12)
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

### Incident Patch 7: `176a47bf` (2024-11-11)
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

### Incident Patch 8: `c0913740` (2024-11-11)
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

### Incident Patch 9: `935efd19` (2024-11-11)
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

### Incident Patch 10: `33909306` (2024-11-11)
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
+> For `arm` users (e.g., `M macOS devices`), go to your Docker desktop application and enable `Use Rosetta for x86_64/amd64 emulation on Apple Silicon` from the Settings. There is a checkbox you have to check
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
-# ------ AWS SageMaker: Training p
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
-- **Model Optimization**: It offers tools to compare different models side by side, analyze hyperparameters, and trac
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
