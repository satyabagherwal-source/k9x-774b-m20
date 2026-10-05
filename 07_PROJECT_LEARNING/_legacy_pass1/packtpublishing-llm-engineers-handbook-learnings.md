# Forensic Learning Record (Deep Inspection): PacktPublishing/LLM-Engineers-Handbook

> **Canonical Artifact**: `07_PROJECT_LEARNING/packtpublishing-llm-engineers-handbook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PacktPublishing/LLM-Engineers-Handbook](https://github.com/PacktPublishing/LLM-Engineers-Handbook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:13:03.631Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PacktPublishing/LLM-Engineers-Handbook`
- **Description**: The LLM's practical guide: From the fundamentals to deploying advanced LLM and RAG apps to AWS using LLMOps best practices
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5356 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `code_snippets/03_custom_odm_example.py`
```
from llm_engineering.domain.documents import ArticleDocument, UserDocument

if __name__ == "__main__":
    user = UserDocument.get_or_create(first_name="Paul", last_name="Iusztin")
    articles = ArticleDocument.bulk_find(author_id=str(user.id))

    print(f"User ID: {user.id}")  # noqa
    print(f"User name: {user.first_name} {user.last_name}")  # noqa
    print(f"Number of articles: {len(articles)}")  # noqa
    print("First article link:", articles[0].link)  # noqa

```

### Core Architecture Module: `code_snippets/03_orm.py`
```
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Create virtual environment, install dependencies and run the code:
# 1. Create: python3 -m venv orm_venv
# 2. Activate: source orm_venv/bin/activate
# 3. Install: pip install sqlalchemy==2.0.35
# 4. Run the code: python code_snippets/03_orm.py

if __name__ == "__main__":
    Base = declarative_base()

    # Define  a class that maps to the users table.
    class User(Base):
        __tablename__ = "users"

        id = Column(Integer, primary_key=True)
        name = Column(String)

    # Create an SQLite database in memory.
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    # Create a session used to interact with the database.
    Session = sessionmaker(bind=engine)
    session = Session()

    # Add a new user.
    new_user = User(name="Alice")
    session.add(new_user)
    session.commit()

    # Query the database.
    user = session.query(User).first()
    if user:
        print(f"User ID: {user.id}")  # noqa
        print(f"User name: {user.name}")  # noqa

```

### Core Architecture Module: `code_snippets/08_instructor_embeddings.py`
```
from sentence_transformers import SentenceTransformer

# Create virtual environment, install dependencies and run the code:
# 1. Create: python3 -m venv instructor_venv
# 2. Activate: source instructor_venv/bin/activate
# 3. Install: pip install sentence-transformers==3.3.0
# 4. Run the code: python code_snippets/08_instructor_embeddings.py

if __name__ == "__main__":
    model = SentenceTransformer("hkunlp/instructor-base")

    sentence = "RAG Fundamentals First"

    instruction = "Represent the title of an article about AI:"

    embeddings = model.encode([[instruction, sentence]])
    print(embeddings.shape)  # noqa
    # Output: (1, 768)

```

### Core Architecture Module: `code_snippets/08_text_embeddings.py`
```
from sentence_transformers import SentenceTransformer

# Leverage the Poetry virtual environment to run the code:
# poetry run python code_snippets/08_text_embeddings.py

if __name__ == "__main__":
    # 1. Load a pretrained Sentence Transformer model.
    model = SentenceTransformer("all-MiniLM-L6-v2")

    # The sentences to encode.
    sentences = ["The dog sits outside waiting for a treat.", "I am going swimming.", "The dog is swimming."]

    # 2. Calculate embeddings.
    embeddings = model.encode(sentences)
    print(embeddings.shape)  # noqa
    # Output: [3, 384]

    # 3. Calculate the embedding similarities using cosine similarity.
    similarities = model.similarity(embeddings, embeddings)
    print(similarities)  # noqa
    # Output:
    # tensor([[ 1.0000, -0.0389,  0.2692],
    #     [-0.0389,  1.0000,  0.3837],
    #     [ 0.2692,  0.3837,  1.0000]])
    #
    # similarities[0, 0] = The similarity between the first sentence and itself.
    # similarities[0, 1] = The similarity between the first and second sentence.
    # similarities[2, 1] = The similarity between the third and second sentence.

```

### Core Architecture Module: `code_snippets/08_text_image_embeddings.py`
```
from io import BytesIO

import requests
from PIL import Image
from sentence_transformers import SentenceTransformer

# Leverage the Poetry virtual environment to run the code:
# poetry run python code_snippets/08_text_image_embeddings.py

if __name__ == "__main__":
    # Load an image with a crazy cat.
    response = requests.get(
        "https://github.com/PacktPublishing/LLM-Engineering/blob/main/images/crazy_cat.jpg?raw=true"
    )
    image = Image.open(BytesIO(response.content))

    # Load CLIP model.
    model = SentenceTransformer("clip-ViT-B-32")

    # Encode the loaded image.
    img_emb = model.encode(image)

    # Encode text descriptions.
    text_emb = model.encode(
        [
            "A crazy cat smiling.",
            "A white and brown cat with a yellow bandana.",
            "A man eating in the garden.",
        ]
    )
    print(text_emb.shape)  # noqa
    # Output: (3, 512)

    # Compute similarities.
    similarity_scores = model.similarity(img_emb, text_emb)
    print(similarity_scores)  # noqa
    # Output: tensor([[0.3068, 0.3300, 0.1719]])

```

### Core Architecture Module: `llm_engineering/__init__.py`
```
from llm_engineering import application, domain, infrastructure
from llm_engineering.settings import settings

__all__ = ["settings", "application", "domain", "infrastructure"]

```

### Core Architecture Module: `llm_engineering/application/__init__.py`
```
from . import utils

__all__ = ["utils"]

```

### Core Architecture Module: `llm_engineering/application/crawlers/__init__.py`
```
from .dispatcher import CrawlerDispatcher
from .github import GithubCrawler
from .linkedin import LinkedInCrawler
from .medium import MediumCrawler

__all__ = ["CrawlerDispatcher", "GithubCrawler", "LinkedInCrawler", "MediumCrawler"]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #78** (2026-08-02): **feat: route LLM calls through a configurable OpenAI-compatible endpoint**
  *Symptoms*: Switch the default provider from OpenAI gpt-4o-mini to DeepSeek by adding a BASE_URL setting and threading it through every ChatOpenAI/OpenAI client:  - settings: add BASE_URL, default OPENAI_MODEL_ID to deepseek-v4-flash - rag: pass base_url in query expansion and self-query - dataset generation: pass base_url; switch the tokenizer to the fixed cl100k_base encoding, since tiktoken cannot resolve a non-OpenAI model id - evaluation: read BASE_URL/OPENAI_MODEL_ID from env and forward them to the SageMaker job environment instead of hardcoding gpt-4o-mini  Also adds a work-in-progress generate_instruct_dataset step, a Claude Code post-tool-call provenance hook, IDE project files, and typing-extensions.  Known broken in this commit (checkpoint, not a working tree): - steps/etl/crawl_links.py is empty, so steps.etl fails to import - get_or_create_user no longer returns its user document

- **Issue #66** (2025-09-11): **try claude code PR**
  *Symptoms*: @claude please help me see if the links in end_to_end_pipline.yaml are all still working or not

- **Issue #63** (2025-09-08): **Feature/trigger ci**
  *Symptoms*: TRY

- **Issue #54** (2025-05-11): **Env setup issue**
  *Symptoms*: I have been following the README in this repo to setup my local env but i see the following issue. This repo was listed for the book.  ```zsh Installing the current project: llm-engineering (0.1.0)  ➜  code-samples git:(main) poetry run pre-commit install pre-commit installed at .git/hooks/pre-commit  ➜  code-samples git:(main) poetry shell Spawning shell within /home/adilfulara/.cache/pypoetry/virtualenvs/llm-engineering-a1FkSGAR-py3.11  ➜  code-samples git:(main) emulate bash -c '. /home/adilfulara/.cache/pypoetry/virtualenvs/llm-engineering-a1FkSGAR-py3.11/ bin/activate'  (llm-engineering-py3.11) ➜  code-samples git:(main) poetry poe --help                                                  The requested command poe does not exist  (llm-engineering-py3.11) ➜  code-samples git:(main) poetry run local-infrastructure-up                                                                                                                                                                                                Command not found: local-infrastructure-up  ```  I am not a python expert. Poe tool is available globally  ```zsh  # install ➜ pipx install poe  ➜ poe --version Poe the Poet - version: 0.29.0  ```  My env currently (default python@3.10.8 is installed by brew and python@3.11.8 is installed by pyenv) ```zsh poetry debug info                                                                                                                                                           
  **Post-Mortem & Fix Analysis**:
  > Hello @adilfulara,  Did you install Poe the Poet as a `poetry` plugin?  Here is the command: ```shell poetry self add 'poethepoet[poetry_plugin]' ```  I don't use `poetry` but `pixi` (which uses `uv` underneath). I rewrote all the commands within `pyproject.toml` as a consequence. If you or someone want the `pixi` version, notify me.  Edit: You can find the rewrote commands with `pixi` [here](https://github.com/pabroux/llm-engineers-handbook).
  > @pabroux there are no instructions to install the said tool. so i am unsure of what to do.
  > ```shell poetry self add 'poethepoet[poetry_plugin]' ```  That command is described in chapter 2 of the book, page 29.  `pixi` on the other hand is an alternative to what proposed the authors (i.e. `poetry` with its plugin "Poe the Poet"), non listed in the suggested alternatives (page 29 too).

- **Issue #53** (2025-04-11): **Cosine Distance range**
  *Symptoms*: I am confused regarding the range of Cosine Distance [-1,1] as stated in the book page 105.   <img width="1041" alt="Image" src="https://github.com/user-attachments/assets/10ea44e5-c8c2-4798-b1b0-fe35bf0aeebb" />   I think [-1,1] is the range of Cosine similarity and not the range of Cosine Distance, and 1- Cosine Similarity will make the range to be between [0,2].   
  **Post-Mortem & Fix Analysis**:
  > You are right @Hawar-Dzaee. I made a mistake.  The principles are the same, but here is how to interpret the formula: "With this formula, we are quantifying cosine distance with a range from 0 to 2. A cosine distance of 0 means the vectors are perfectly aligned (no angle between them), indicating maximum similarity, while a value closer to 2 suggests they are diametrically opposite, indicating maximum dissimilarity."

- **Issue #50** (2025-03-02): **[withdrawn] Init steven**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > I apologize for the incorrect pull request. This was meant for a different target repository. Closing this PR.

- **Issue #48** (2025-03-08): **Feature/bump zenml version**
  *Symptoms*: Update the recent version of Zen ML so that readers would be able to errors when local and remote ZenML versions are different (at least for some time)

- **Issue #47** (2025-03-08): **Feature/windows support**
  *Symptoms*: Without this addition all poetry commands which involves running ZenML would fail on Windows

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

### Incident Patch 1: `1944c7a3` (2025-03-08)
**Commit Message**: chore: Fix Type

**File**: `.env.example` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ HUGGINGFACE_ACCESS_TOKEN=str
 COMET_API_KEY=str
 
 # --- Required settings when deploying the code. ---
-# --- Otherwise, default values values work fine. ---
+# --- Otherwise, default values work fine. ---
 
 # MongoDB database
 DATABASE_HOST="mongodb://llm_engineering:llm_engineering@127.0.0.1:27017"
```

---

### Incident Patch 2: `e97ca808` (2025-03-08)
**Commit Message**: fix: Lock file

**File**: `poetry.lock` (modified, +90/-51)
```diff
@@ -1,4 +1,4 @@
-# This file is automatically @generated by Poetry 1.8.3 and should not be changed by hand.
+# This file is automatically @generated by Poetry 1.8.4 and should not be changed by hand.
 
 [[package]]
 name = "aiobotocore"
@@ -3645,13 +3645,12 @@ files = [
 
 [[package]]
 name = "nvidia-cudnn-cu12"
-version = "9.1.0.70"
+version = "8.9.2.26"
 description = "cuDNN runtime libraries"
 optional = false
 python-versions = ">=3"
 files = [
-    {file = "nvidia_cudnn_cu12-9.1.0.70-py3-none-manylinux2014_x86_64.whl", hash = "sha256:165764f44ef8c61fcdfdfdbe769d687e06374059fbb388b6c89ecb0e28793a6f"},
-    {file = "nvidia_cudnn_cu12-9.1.0.70-py3-none-win_amd64.whl", hash = "sha256:6278562929433d68365a07a4a1546c237ba2849852c0d4b2262a486e805b977a"},
+    {file = "nvidia_cudnn_cu12-8.9.2.26-py3-none-manylinux1_x86_64.whl", hash = "sha256:5ccb288774fdfb07a7e7025ffec286971c06d8d7b4fb162525334616d7629ff9"},
 ]
 
 [package.dependencies]
@@ -3711,13 +3710,12 @@ nvidia-nvjitlink-cu12 = "*"
 
 [[package]]
 name = "nvidia-nccl-cu12"
-version = "2.20.5"
+version = "2.19.3"
 description = "NVIDIA Collective Communication Library (NCCL) Runtime"
 optional = false
 python-versions = ">=3"
 files = [
-    {file = "nvidia_nccl_cu12-2.20.5-py3-none-manylinux2014_aarch64.whl", hash = "sha256:1fc150d5c3250b170b29410ba682384b14581db722b2531b0d8d33c595f33d01"},
-    {file = "nvidia_nccl_cu12-2.20.5-py3-none-manylinux2014_x86_64.whl", hash = "sha256:057f6bf9685f75215d0c53bf3ac4a10b3e6578351de307abad9e18a99182af56"},
+    {file = "nvidia_nccl_cu12-2.19.3-py3-none-manylinux1_x86_64.whl", hash = "sha256:a9734707a2c96443331c1e48c717024aa6678a0e2a4cb66b2c364d18cee6b48d"},
 ]
 
 [[package]]
@@ -5283,6 +5281,20 @@ urllib3 = ">=1.21.1,<3"
 socks = ["PySocks (>=1.5.6,!=1.5.7)"]
 use-chardet-on-py3 = ["chardet (>=3.0.2,<6)"]
 
+[[package]]
+name = "requests-file"
+version = "2.1.0"
+description = "File transport adapter for Requests"
+optional = false
+python-versions = "*"
+files = [
+    {file = "requests_file-2.1.0-py2.py3-none-any.whl", hash = "sha256:cf270de5a4c5874e84599fc5778303d496c10ae5e870bfa378818f35d21bda5c"},
+    {file = "requests_file-2.1.0.tar.gz", hash = "sha256:0f549a3f3b0699415ac04d167e9cb39bccfb730cb832b4d20be3d9867356e658"},
+]
+
+[package.dependencies]
+requests = ">=1.0.0"
+
 [[package]]
 name = "requests-oauthlib"
 version = "2.0.0"
@@ -6424,6 +6436,27 @@ requests = ">=2.26.0"
 [package.extras]
 blobfile = ["blobfile (>=2)"]
 
+[[package]]
+name = "tldextract"
+version = "5.1.3"
+description = "Accurately separates a URL's subdomain, domain, and public suffix, using the Public Suffix List (PSL). By default, this includes the public ICANN TLDs and their exceptions. You can optionally support the Public Suffix List's private domains as well."
+optional = false
+python-versions = ">=3.9"
+files = [
+    {file = "tldextract-5.1.3-py3-none-any.whl", hash = "sha256:78de310cc2ca018692de5ddf320f9d6bd7c5cf857d0fd4f2175f0cdf4440ea75"},
+    {file = "tldextract-5.1.3.tar.gz", hash = "sha256:d43c7284c23f5dc8a42fd0fee2abede2ff74cc622674e4cb07f514ab3330c338"},
+]
+
+[package.dependencies]
+filelock = ">=3.0.8"
+idna = "*"
+requests = ">=2.1.0"
+requests-file = ">=1.4"
+
+[package.extras]
+release = ["build", "twine"]
+testing = ["mypy", "pytest", "pytest-gitignore", "pytest-mock", "responses", "ruff", "syrupy", "tox", "tox-uv", "types-filelock", "types-requests"]
+
 [[package]]
 name = "tokenizers"
 version = "0.19.1"
@@ -6543,31 +6576,36 @@ testing = ["black (==22.3)", "datasets", "numpy", "pytest", "requests", "ruff"]
 
 [[package]]
 name = "torch"
-version = "2.4.0"
+version = "2.2.2"
 description = "Tensors and Dynamic neural networks in Python with strong GPU acceleration"
 optional = false
 python-versions = ">=3.8.0"
 files = [
-    {file = "torch-2.4.0-cp310-cp310-manylinux1_x86_64.whl", hash = "sha256:4ed94583e244af51d6a8d28701ca5a9e02d1219e782f5a01dd401f90af17d8ac"},
-    {file = "torch-2.4.0-cp310-cp310-manylinux2014_aarch64.whl", has
```

**File**: `pyproject.toml` (modified, +8/-4)
```diff
@@ -16,6 +16,7 @@ rich = "^13.7.1"
 numpy = "^1.26.4"
 poethepoet = "0.29.0"
 datasets = "^3.0.1"
+torch = "2.2.2"
 
 # Digital data ETL
 selenium = "^4.21.0"
@@ -41,7 +42,6 @@ langchain-community = "^0.2.11"
 fastapi = ">=0.100,<=0.110"
 uvicorn = "^0.30.6"
 opik = "^0.2.2"
-torch = "2.2.2"
 
 
 [tool.poetry.group.dev.dependencies]
@@ -99,7 +99,7 @@ call-inference-ml-service = "curl -X POST 'http://127.0.0.1:8000/rag' -H 'Conten
 ## Local infrastructure
 local-docker-infrastructure-up = "docker compose up -d"
 local-docker-infrastructure-down = "docker compose stop"
-local-zenml-server-down = "poetry run zenml down"
+local-zenml-server-down = "poetry run zenml logout --local"
 local-infrastructure-up = [
     "local-docker-infrastructure-up",
     "local-zenml-server-down",
@@ -144,10 +144,14 @@ control.expr = "sys.platform"
 [[tool.poe.tasks.local-zenml-server-up.switch]]
 case = "darwin"
 env = { OBJC_DISABLE_INITIALIZE_FORK_SAFETY = "YES" }
-cmd = "poetry run zenml up"
+cmd = "poetry run zenml login --local"
+
+[[tool.poe.tasks.local-zenml-server-up.switch]]
+case = "win32"
+cmd = "poetry run zenml login --local --blocking"
 
 [[tool.poe.tasks.local-zenml-server-up.switch]]
-cmd = "poetry run zenml up"
+cmd = "poetry run zenml login --local"
 
 # Tests
 [tool.poe.tasks.test]
```

---

### Incident Patch 3: `b4211d9b` (2025-03-08)
**Commit Message**: Merge pull request #40 from kd2718/format_fix

fixing issue where examples were not injected intot he prompt

**File**: `llm_engineering/application/dataset/generation.py` (modified, +2/-2)
```diff
@@ -191,7 +191,7 @@ class InstructionDatasetGenerator(DatasetGenerator):
 ]
 
 Extract:
-{extract}
+{{extract}}
 """
 
     @classmethod
@@ -232,7 +232,7 @@ class PreferenceDatasetGenerator(DatasetGenerator):
 ]
 
 Extract:
-{extract}
+{{extract}}
 """
 
     @classmethod
```

---

### Incident Patch 4: `aacee321` (2025-02-19)
**Commit Message**: Fix torch version

**File**: `pyproject.toml` (modified, +1/-4)
```diff
@@ -41,6 +41,7 @@ langchain-community = "^0.2.11"
 fastapi = ">=0.100,<=0.110"
 uvicorn = "^0.30.6"
 opik = "^0.2.2"
+torch = "2.2.2"
 
 
 [tool.poetry.group.dev.dependencies]
@@ -145,10 +146,6 @@ case = "darwin"
 env = { OBJC_DISABLE_INITIALIZE_FORK_SAFETY = "YES" }
 cmd = "poetry run zenml up"
 
-[[tool.poe.tasks.local-zenml-server-up.switch]]
-case = "win32"
-cmd = "poetry run zenml up --blocking"
-
 [[tool.poe.tasks.local-zenml-server-up.switch]]
 cmd = "poetry run zenml up"
 
```

---

### Incident Patch 5: `33c437bf` (2025-02-19)
**Commit Message**: revert to previous state

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ FROM python:3.11-slim-bullseye AS release
 ENV WORKSPACE_ROOT=/app/
 ENV PYTHONDONTWRITEBYTECODE=1
 ENV PYTHONUNBUFFERED=1
-ENV POETRY_VERSION=2.0.1
+ENV POETRY_VERSION=1.8.3
 ENV DEBIAN_FRONTEND=noninteractive
 ENV POETRY_NO_INTERACTION=1
 
```

**File**: `configs/digital_data_etl_maxime_labonne.yaml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 settings:
   docker:
-    parent_image: 122610508479.dkr.ecr.us-east-1.amazonaws.com/zenml-lbynmz
+    parent_image: 992382797823.dkr.ecr.eu-central-1.amazonaws.com/zenml-rlwlcs:latest
     skip_build: True
   orchestrator.sagemaker:
     synchronous: false
```

**File**: `configs/digital_data_etl_paul_iusztin.yaml` (modified, +6/-6)
```diff
@@ -1,6 +1,6 @@
 settings:
   docker:
-    parent_image: 122610508479.dkr.ecr.us-east-1.amazonaws.com/zenml-lbynmz
+    parent_image: 992382797823.dkr.ecr.eu-central-1.amazonaws.com/zenml-rlwlcs:latest
     skip_build: True
   orchestrator.sagemaker:
     synchronous: false
@@ -9,11 +9,11 @@ parameters:
   user_full_name: Paul Iusztin # [First Name(s)] [Last Name]
   links:
     # Medium (only articles that are not under the paid wall work)
-    # - https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f
-    # - https://medium.com/decodingml/a-real-time-retrieval-system-for-rag-on-social-media-data-9cc01d50a2a0
-    # - https://medium.com/decodingml/sota-python-streaming-pipelines-for-fine-tuning-llms-and-rag-in-real-time-82eb07795b87
-    # - https://medium.com/decodingml/the-4-advanced-rag-algorithms-you-must-know-to-implement-5d0c7f1199d2
-    # - https://medium.com/decodingml/architect-scalable-and-cost-effective-llm-rag-inference-pipelines-73b94ef82a99
+    - https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f
+    - https://medium.com/decodingml/a-real-time-retrieval-system-for-rag-on-social-media-data-9cc01d50a2a0
+    - https://medium.com/decodingml/sota-python-streaming-pipelines-for-fine-tuning-llms-and-rag-in-real-time-82eb07795b87
+    - https://medium.com/decodingml/the-4-advanced-rag-algorithms-you-must-know-to-implement-5d0c7f1199d2
+    - https://medium.com/decodingml/architect-scalable-and-cost-effective-llm-rag-inference-pipelines-73b94ef82a99
     # Substack
     - https://decodingml.substack.com/p/real-time-feature-pipelines-with?r=1ttoeh
     - https://decodingml.substack.com/p/building-ml-systems-the-right-way?r=1ttoeh
```

**File**: `configs/end_to_end_data.yaml` (modified, +8/-8)
```diff
@@ -1,6 +1,6 @@
 settings:
   docker:
-    parent_image: 122610508479.dkr.ecr.us-east-1.amazonaws.com/zenml-lbynmz
+    parent_image: 992382797823.dkr.ecr.eu-central-1.amazonaws.com/zenml-rlwlcs:latest
     skip_build: True
   orchestrator.sagemaker:
     synchronous: false
@@ -11,11 +11,11 @@ parameters:
     - user_full_name: Paul Iusztin # [First Name(s)] [Last Name]
       links:
         # Medium (only articles that are not under the paid wall work)
-        # - https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f
-        # - https://medium.com/decodingml/a-real-time-retrieval-system-for-rag-on-social-media-data-9cc01d50a2a0
-        # - https://medium.com/decodingml/sota-python-streaming-pipelines-for-fine-tuning-llms-and-rag-in-real-time-82eb07795b87
-        # - https://medium.com/decodingml/the-4-advanced-rag-algorithms-you-must-know-to-implement-5d0c7f1199d2
-        # - https://medium.com/decodingml/architect-scalable-and-cost-effective-llm-rag-inference-pipelines-73b94ef82a99
+        - https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f
+        - https://medium.com/decodingml/a-real-time-retrieval-system-for-rag-on-social-media-data-9cc01d50a2a0
+        - https://medium.com/decodingml/sota-python-streaming-pipelines-for-fine-tuning-llms-and-rag-in-real-time-82eb07795b87
+        - https://medium.com/decodingml/the-4-advanced-rag-algorithms-you-must-know-to-implement-5d0c7f1199d2
+        - https://medium.com/decodingml/architect-scalable-and-cost-effective-llm-rag-inference-pipelines-73b94ef82a99
         # Substack
         - https://decodingml.substack.com/p/a-blueprint-for-designing-production?r=1ttoeh
         - https://decodingml.substack.com/p/the-difference-between-development?r=1ttoeh
@@ -83,5 +83,5 @@ parameters:
   # Generate instruct dataset pipeline parameters
   test_split_size: 0.1
   push_to_huggingface: true
-  dataset_id: Oysiyl/llmtwin
-  mock: true
\ No newline at end of file
+  dataset_id: pauliusztin/llmtwin
+  mock: false
\ No newline at end of file
```

**File**: `configs/evaluating.yaml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 settings:
   docker:
-    parent_image: 122610508479.dkr.ecr.us-east-1.amazonaws.com/zenml-lbynmz
+    parent_image: 992382797823.dkr.ecr.eu-central-1.amazonaws.com/zenml-rlwlcs:latest
     skip_build: True
   orchestrator.sagemaker:
     synchronous: false
```

---

### Incident Patch 6: `ab35de63` (2025-01-20)
**Commit Message**: fixing issue where examples were not injected intot he prompt

**File**: `llm_engineering/application/dataset/generation.py` (modified, +2/-2)
```diff
@@ -191,7 +191,7 @@ class InstructionDatasetGenerator(DatasetGenerator):
 ]
 
 Extract:
-{extract}
+{{extract}}
 """
 
     @classmethod
@@ -232,7 +232,7 @@ class PreferenceDatasetGenerator(DatasetGenerator):
 ]
 
 Extract:
-{extract}
+{{extract}}
 """
 
     @classmethod
```

---

### Incident Patch 7: `e11083a8` (2025-01-09)
**Commit Message**: fix opik links

**File**: `README.md` (modified, +5/-5)
```diff
@@ -52,8 +52,8 @@ The code also uses and depends on the following cloud services. For now, you don
 | Service | Purpose |
 |---------|---------|
 | [HuggingFace](https://huggingface.com/) | Model registry |
-| [Comet ML](https://www.comet.com/site/) | Experiment tracker |
-| [Opik](https://www.comet.com/site/products/opik/) | Prompt monitoring |
+| [Comet ML](https://www.comet.com/site/products/opik/?utm_source=llm_handbook&utm_medium=github&utm_campaign=opik) | Experiment tracker |
+| [Opik](https://www.comet.com/site/products/opik/?utm_source=llm_handbook&utm_medium=github&utm_campaign=opik) | Prompt monitoring |
 | [ZenML](https://www.zenml.io/) | Orchestrator and artifacts layer |
 | [AWS](https://aws.amazon.com/) | Compute and storage |
 | [MongoDB](https://www.mongodb.com/) | NoSQL database |
@@ -269,7 +269,7 @@ To authenticate to Comet ML (required only during training) and Opik, you must f
 COMET_API_KEY=your_api_key_here
 ```
 
-→ Check out this [tutorial](https://www.comet.com/docs/v2/api-and-sdk/rest-api/overview/) to learn how to get the Comet ML variables from above. You can also access Opik's dashboard using 🔗[this link](https://www.comet.com/opik).
+→ Check out this [tutorial](https://www.comet.com/docs/opik/?utm_source=llm_handbook&utm_medium=github&utm_campaign=opik) to learn how to get started with Opik. You can also access Opik's dashboard using 🔗[this link](https://www.comet.com/opik?utm_source=llm_handbook&utm_medium=github&utm_content=opik).
 
 ### 6. Deployment Setup
 
@@ -466,8 +466,8 @@ Also, we provide instructions on how to set everything up in **Chapter 11**, sec
 #### Comet ML & Opik
 
 You can visualize the results on their self-hosted dashboards if you create a Comet account and correctly set the `COMET_API_KEY` env var. As Opik is powered by Comet, you don't have to set up anything else along Comet:
-- [Comet ML (for experiment tracking)](https://www.comet.com/)
-- [Opik (for prompt monitoring)](https://www.comet.com/opik)
+- [Comet ML (for experiment tracking)](https://www.comet.com/?utm_source=llm_handbook&utm_medium=github&utm_campaign=opik)
+- [Opik (for prompt monitoring)](https://www.comet.com/opik?utm_source=llm_handbook&utm_medium=github&utm_campaign=opik)
 
 ## ⚡ Pipelines
 
```

---

### Incident Patch 8: `80d9ec65` (2025-01-02)
**Commit Message**: Merge pull request #16 from intertwine/fix-instructor-embeddings

Fix instructor embeddings

**File**: `code_snippets/08_instructor_embeddings.py` (modified, +3/-3)
```diff
@@ -1,13 +1,13 @@
-from InstructorEmbedding import INSTRUCTOR
+from sentence_transformers import SentenceTransformer
 
 # Create virtual environment, install dependencies and run the code:
 # 1. Create: python3 -m venv instructor_venv
 # 2. Activate: source instructor_venv/bin/activate
-# 3. Install: pip install sentence-transformers==2.2.2 InstructorEmbedding==1.0.1
+# 3. Install: pip install sentence-transformers==3.3.0
 # 4. Run the code: python code_snippets/08_instructor_embeddings.py
 
 if __name__ == "__main__":
-    model = INSTRUCTOR("hkunlp/instructor-base")
+    model = SentenceTransformer("hkunlp/instructor-base")
 
     sentence = "RAG Fundamentals First"
 
```

---

### Incident Patch 9: `ec6717fd` (2024-11-30)
**Commit Message**: fix: Fine-tuning and evaluation minor fixes

**File**: `README.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ The goal of this book is to create your own end-to-end LLM-based system using be
 You can download and use the final trained model on [Hugging Face](https://huggingface.co/mlabonne/TwinLlama-3.1-8B-DPO).
 
 > [!IMPORTANT]
-> The code in this GitHub repository is actively maintained and may contain updates not reflected in the book. Always refer to this repository for the latest version of the code.
+> The code in this GitHub repository is actively maintained and may contain updates not reflected in the book. **Always refer to this repository for the latest version of the code.**
 
 ## 🔗 Dependencies
 
```

---

### Incident Patch 10: `ee785422` (2024-11-30)
**Commit Message**: fix: Fine-tuning and evaluation minor fixes

**File**: `README.md` (modified, +3/-0)
```diff
@@ -23,6 +23,9 @@ The goal of this book is to create your own end-to-end LLM-based system using be
 
 You can download and use the final trained model on [Hugging Face](https://huggingface.co/mlabonne/TwinLlama-3.1-8B-DPO).
 
+> [!IMPORTANT]
+> The code in this GitHub repository is actively maintained and may contain updates not reflected in the book. Always refer to this repository for the latest version of the code.
+
 ## 🔗 Dependencies
 
 ### Local dependencies
```

**File**: `llm_engineering/model/evaluation/evaluate.py` (modified, +4/-1)
```diff
@@ -30,7 +30,10 @@ def format(sample):
 
     dataset = load_dataset(dataset_name, split="test")
     if IS_DUMMY:
-        dataset = dataset.select(range(10))
+        try:
+            dataset = dataset.select(range(10))
+        except Exception:
+            print("Dummy mode active. Failed to trim the dataset to 10 samples.")  # noqa
     print(f"Dataset size: {len(dataset)}")  # noqa
     dataset = dataset.map(lambda sample: {"prompt": format(sample)})
 
```

**File**: `llm_engineering/model/evaluation/requirements.txt` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@ transformers==4.43.3
 datasets==2.20.0
 vllm==0.6.1.post2
 tqdm==4.66.4
-openai==1.52.0
\ No newline at end of file
+openai==1.55.3
\ No newline at end of file
```

**File**: `llm_engineering/model/finetuning/finetune.py` (modified, +2/-2)
```diff
@@ -105,7 +105,7 @@ def format_samples_sft(examples):
             try:
                 dataset = dataset.select(range(400))
             except Exception:
-                print("Dummy mode active. Could not trim the dataset.")  # noqa
+                print("Dummy mode active. Failed to trim the dataset to 400 samples.")  # noqa
         print(f"Loaded dataset with {len(dataset)} samples.")  # noqa
 
         dataset = dataset.map(format_samples_sft, batched=True, remove_columns=dataset.column_names)
@@ -156,7 +156,7 @@ def format_samples_dpo(example):
             try:
                 dataset = dataset.select(range(400))
             except Exception:
-                print("Dummy mode active. Could not trim the dataset.")  # noqa
+                print("Dummy mode active. Failed to trim the dataset to 400 samples.")  # noqa
         print(f"Loaded dataset with {len(dataset)} samples.")  # noqa
 
         dataset = dataset.map(format_samples_dpo)
```

#### Recent Merged Pull Requests:
- **PR #78** (closed): feat: route LLM calls through a configurable OpenAI-compatible endpoint (@Osami2020)
- **PR #66** (closed): try claude code PR (@howard31526)
- **PR #63** (closed): Feature/trigger ci (@howard31526)
- **PR #50** (closed): [withdrawn] Init steven (@stevenmichiels)
- **PR #48** (2025-03-08): Feature/bump zenml version (@dmitriy-kisil)
- **PR #47** (2025-03-08): Feature/windows support (@dmitriy-kisil)
- **PR #46** (2025-03-08): Feature/error with torch on windows (@dmitriy-kisil)
- **PR #44** (closed): CI 파이프라인 테스트: 문서 수정 (@inrap8206)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
