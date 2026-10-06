# Forensic Learning Record (Deep Inspection): NanoNets/docext

> **Canonical Artifact**: `07_PROJECT_LEARNING/nanonets-docext-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NanoNets/docext](https://github.com/NanoNets/docext))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:19:57.669Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NanoNets/docext`
- **Description**: An on-premises, OCR-free unstructured data extraction, markdown conversion and benchmarking toolkit. (https://idp-leaderboard.org/)
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 2085 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `docext/app/utils.py`
```
from __future__ import annotations

import requests
from PIL import Image


def cleanup(signum, frame, vllm_server):
    print("\nReceived exit signal. Stopping vLLM server...")
    vllm_server.stop_server()
    exit(0)


def check_vllm_healthcheck(host: str, port: int):
    try:
        response = requests.get(f"http://{host}:{port}/health")
        return response.status_code == 200
    except Exception as e:
        return False


def check_ollama_healthcheck(host: str, port: int):
    try:
        response = requests.get(f"http://{host}:{port}")
        return response.status_code == 200
    except Exception as e:
        return False


if __name__ == "__main__":
    print(check_ollama_healthcheck("localhost", 11434))
    print(check_vllm_healthcheck("localhost", 8000))

```

### Core Architecture Module: `docext/benchmark/utils.py`
```
from __future__ import annotations

import base64

import yaml


def load_yaml(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

```

### Core Architecture Module: `docext/benchmark/vlm_datasets/utils.py`
```
from __future__ import annotations

import json
import os
from typing import List

from pdf2image import convert_from_path


def load_json(path: str):
    with open(path) as f:
        return json.load(f)


def convert_pdf2image(pdf_path: str, output_dir: str):
    """
    Convert a pdf file to a list of image files.
    Args:
        pdf_path: str, path to the pdf file. eg: "document.pdf"
        output_dir: str, path to the output directory. eg: "document_images"
    Returns:
        save_paths: list, paths to the image files. eg: ["document_images/document_0.jpeg", "document_images/document_1.jpeg", ...]
    """
    images = convert_from_path(pdf_path)
    base_filename = os.path.basename(pdf_path)
    save_paths = []
    for i, image in enumerate(images):
        save_path = os.path.join(output_dir, f"{base_filename}_{i}.jpeg")
        image.save(save_path, "JPEG")
        save_paths.append(save_path)
    return save_paths


def polygon_to_bbox(box: list[int]):
    """
    Convert 8-point polygon [x1, y1, x2, y2, x3, y3, x4, y4]
    to axis-aligned bounding box [x_min, y_min, x_max, y_max]
    Args:
        box: list of 8 integers.
    Returns:
        bbox: list of 4 integers.
    """
    x_coords = box[0::2]  # [x1, x2, x3, x4]
    y_coords = box[1::2]  # [y1, y2, y3, y4]

    x_min = min(x_coords)
    y_min = min(y_coords)
    x_max = max(x_coords)
    y_max = max(y_coords)

    return [x_min, y_min, x_max, y_max]


def get_enclosing_bbox(bboxes: list[list[int]]):
    """
    Get the enclosing bounding box of a list of bounding boxes.
    Args:
        bboxes: list of bounding boxes.
    Returns:
        enclosing_bbox: list of bounding box.
    """
    if len(bboxes) == 0:
        return []
    x_min = min(b[0] for b in bboxes)
    y_min = min(b[1] for b in bboxes)
    x_max = max(b[2] for b in bboxes)
    y_max = max(b[3] for b in bboxes)
    return [x_min, y_min, x_max, y_max]

```

### Core Architecture Module: `docext/core/__init__.py`
```
# Empty file to make docext.core a Python package
from __future__ import annotations

```

### Core Architecture Module: `docext/core/client.py`
```
from __future__ import annotations

import os

import requests
from litellm import completion


def sync_request(
    messages: list[dict],
    model_name: str = "hosted_vllm/Qwen/Qwen2.5-VL-3B-Instruct",
    max_tokens: int = 5000,
    num_completions: int = 1,
    format: dict | None = None,
):
    vlm_url = os.getenv("VLM_MODEL_URL", "")
    if vlm_url == "":
        raise ValueError(
            "VLM_MODEL_URL is not set. Please set it to the URL of the VLM model.",
        )
    completion_args = {
        "model": model_name,
        "messages": messages,
        "max_tokens": max_tokens,
        "n": num_completions,
        "temperature": 0,
        "api_base": vlm_url
        if model_name.startswith("hosted_vllm/") or model_name.startswith("ollama/")
        else None,
    }

    if model_name.startswith("hosted_vllm/") or model_name.startswith("ollama/"):
        completion_args["api_key"] = os.getenv("API_KEY", "EMPTY")

    # Only add format argument for Ollama models
    if model_name.startswith("ollama/") and format:
        completion_args["format"] = format
    # elif model_name.startswith("hosted_vllm/") and format: # TODO: Add this back, currently not working in colab
    #     completion_args["guided_json"] = format
    #     if "qwen" in model_name.lower():
    #         completion_args["guided_backend"] = "xgrammar:disable-any-whitespace"
    elif model_name.startswith("openrouter"):
        completion_args["response_format"] = format
    elif "gpt" in model_name.lower():
        # Only set response_format if the prompt mentions "json"
        if any("json" in m.get("text", "").lower() for m in messages if isinstance(m, dict)):
            completion_args["response_format"] = {"type": "json_object"}

    response = completion(**completion_args)
    return response.json()

```

### Core Architecture Module: `docext/core/confidence.py`
```
from __future__ import annotations


def get_fields_confidence_score_messages_binary(
    messages: list[dict],
    assistant_response: str,
    fields: list[str],
) -> list[dict]:
    messages.append({"role": "assistant", "content": assistant_response})
    output_format = {field: "High/Low" for field in fields}
    messages.append(
        {
            "role": "user",
            "content": f"For each field mentioned in the above answer, return 'High' if the extracted answer for the field is 100% correct and 'Low' otherwise. Return the result in the following JSON format: {output_format}. Do not give any explanation.",
        },
    )
    return messages


def get_fields_confidence_score_messages_numeric(
    messages: list[dict],
    assistant_response: str,
    fields: list[str],
) -> list[dict]:
    messages.append({"role": "assistant", "content": assistant_response})
    output_format = {field: "0-100" for field in fields}
    messages.append(
        {
            "role": "user",
            "content": f"For each field mentioned in the above answer, return the confidence score. Include a confidence score from 0 to 100, where 0 means no confidence and 100 means complete confidence in the accuracy of the answer. Return the result in the following JSON format: {output_format}. Do not give any explanation.",
        },
    )
    return messages

```

### Core Architecture Module: `docext/core/config.py`
```
from __future__ import annotations

TEMPLATES_FIELDS = {
    "invoice colab demo 🧾": [
        {"field_name": "invoice_number", "description": "Invoice number"},
        {"field_name": "invoice_date", "description": "Invoice date"},
        {"field_name": "invoice_amount", "description": "Invoice amount"},
        {
            "field_name": "seller_name",
            "description": "Seller name. If not explicitly mentioned, return ''",
        },
    ],
    "invoice 🧾": [
        {"field_name": "invoice_number", "description": "Invoice number"},
        {"field_name": "invoice_date", "description": "Invoice date"},
        {"field_name": "invoice_amount", "description": "Invoice amount"},
        {
            "field_name": "invoice_currency",
            "description": "Invoice currency. If not explicitly mentioned, return ''",
        },
        {
            "field_name": "document_type",
            "description": "Document type. If not explicitly mentioned, return ''",
        },
        {
            "field_name": "seller_name",
            "description": "Seller name. If not explicitly mentioned, return ''",
        },
        {"field_name": "buyer_name", "description": "Buyer name"},
        {"field_name": "seller_address", "description": "Seller address"},
        {"field_name": "buyer_address", "description": "Buyer address"},
        {"field_name": "seller_tax_id", "description": "Seller tax id"},
        {"field_name": "buyer_tax_id", "description": "Buyer tax id"},
    ],
    "passport 🎫": [
        {"field_name": "full_name", "description": "Full name"},
        {
            "field_name": "date_of_birth",
            "description": "Date of birth. Return in format YYYY-MM-DD",
        },
        {"field_name": "passport_number", "description": "Passport number"},
        {"field_name": "passport_type", "description": "Passport type"},
        {
            "field_name": "date_of_issue",
            "description": "Date of issue. Return in format YYYY-MM-DD",
        },
        {
            "field_name": "date_of_expiry",
            "description": "Date of expiry. Return in format YYYY-MM-DD",
        },
        {"field_name": "place_of_birth", "description": "Place of birth"},
        {"field_name": "nationality", "description": "Nationality"},
        {"field_name": "gender", "description": "Gender"},
    ],
}

TEMPLATES_TABLES = {
    "invoice colab demo 🧾": [
        {
            "field_name": "items_description",
            "description": "Description of the product",
        },
        {"field_name": "Unit Price", "description": "Unit price of the product"},
    ],
    "invoice 🧾": [
        {"field_name": "Quantity", "description": "Total quantity of the product"},
        {
            "field_name": "items_description",
            "description": "Description of the product",
        },
        {"field_name": "Unit Price", "description": "Unit price of the product"},
        {"field_name": "Total Price", "description": "Total price of the product"},
        {"field_name": "tax", "description": "tax amount"},
    ],
}

```

### Core Architecture Module: `docext/core/extract.py`
```
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Dict
from typing import Union

import json_repair
import mdpd
import pandas as pd
from loguru import logger

from docext.core.client import sync_request
from docext.core.confidence import get_fields_confidence_score_messages_binary
from docext.core.prompts import get_fields_messages
from docext.core.prompts import get_tables_messages
from docext.core.utils import convert_files_to_images
from docext.core.utils import resize_images
from docext.core.utils import validate_fields_and_tables
from docext.core.utils import validate_file_paths


def extract_fields_from_documents(
    file_paths: list[str],
    model_name: str,
    fields: list[dict],
):
    if len(fields) == 0:
        return pd.DataFrame()
    field_names = [field["name"] for field in fields]
    fields_description = [field.get("description", "") for field in fields]
    messages = get_fields_messages(field_names, fields_description, file_paths)

    format_fields = {
        "type": "object",
        "properties": {field_name: {"type": "string"} for field_name in field_names},
    }

    logger.info(f"Sending request to {model_name}")
    response = sync_request(messages, model_name, format=format_fields)["choices"][0][
        "message"
    ]["content"]
    logger.info(f"Response: {response}")

    # conf score
    messages = get_fields_confidence_score_messages_binary(
        messages,
        response,
        field_names,
    )

    format_fields_conf_score = {
        "type": "object",
        "properties": {
            field_name: {"type": "string", "enum": ["High", "Low"]}
            for field_name in field_names
        },
    }

    response_conf_score = sync_request(
        messages,
        model_name,
        format=format_fields_conf_score,
    )["choices"][0]["message"]["content"]
    logger.info(f"Response conf score: {response_conf_score}")

    extracted_fields = json_repair.loads(response)
    conf_scores = json_repair.loads(response_conf_score)

    logger.info(f"Extracted fields: {extracted_fields}")
    logger.info(f"Conf scores: {conf_scores}")

    # Handle both single dictionary and list of dictionaries
    if not isinstance(extracted_fields, list):
        extracted_fields = [extracted_fields]
    
    # Handle confidence scores similarly
    if not isinstance(conf_scores, list):
        conf_scores = [conf_scores] * len(extracted_fields)
    elif len(conf_scores) < len(extracted_fields):
        # If we have fewer confidence scores than documents, pad with the first confidence score
        conf_scores.extend([conf_scores[0]] * (len(extracted_fields) - len(conf_scores)))
    
    # Create a list of dataframes, one for each document
    dfs = []
    for idx, (doc_fields, doc_conf_scores) in enumerate(zip(extracted_fields, conf_scores)):
        df = pd.DataFrame(
            {
                "fields": field_names,
                "answer": [doc_fields.get(field, "") for field in field_names],
                "confidence": [doc_conf_scores.get(field, "Low") for field in field_names],
                "document_index": [idx] * len(field_names)
            },
        )
        dfs.append(df)
    
    # Concatenate all dataframes with a document index
    final_df = pd.concat(dfs, ignore_index=True)
    return final_df


def extract_tables_from_documents(
    file_paths: list[str],
    model_name: str,
    columns: list[dict],
):
    if len(columns) == 0:
        return pd.DataFrame()
    columns_names = [column["name"] for column in columns if column["type"] == "table"]
    columns_description = [
        column.get("description", "") for column in columns if column["type"] == "table"
    ]
    messages = get_tables_messages(columns_names, columns_description, file_paths)

    logger.info(f"Sending request to {model_name}")
    response = sync_request(messages, model_name)["choices"][0]["message"]["content"]
    logger.info(f"Response: {response}")

    response = response[response.index("|") : response.rindex("|") + 1]
    df = mdpd.from_md(response)

    return df


def extract_information(
    file_inputs: list[tuple],
    model_name: str,
    max_img_size: int,
    fields_and_tables: dict[str, list[dict]] | pd.DataFrame,
):
    fields_and_tables = validate_fields_and_tables(fields_and_tables)
    if len(fields_and_tables["fields"]) == 0 and len(fields_and_tables["tables"]) == 0:
        return pd.DataFrame(), pd.DataFrame()
    file_paths: list[str] = [
        file_input[0] if isinstance(file_input, tuple) else file_input
        for file_input in file_inputs
    ]
    validate_file_paths(file_paths)
    file_paths = convert_files_to_images(file_paths)
    resize_images(file_paths, max_img_size)

    # call fields and tables extraction in parallel
    with ThreadPoolExecutor() as executor:
        future_fields = executor.submit(
            extract_fields_from_documents,
            file_paths,
            model_name,
            fields_and_tables["fields"],
        )
        future_tables = executor.submit(
            extract_tables_from_documents,
            file_paths,
            model_name,
            fields_and_tables["tables"],
        )

        fields_df = future_fields.result()
        tables_df = future_tables.result()
    
    # Group fields by document_index for better display
    if not fields_df.empty and 'document_index' in fields_df.columns:
        fields_df = fields_df.sort_values(['document_index', 'fields'])
    
    return fields_df, tables_df

```

### Core Architecture Module: `docext/core/file_converters/file_converter.py`
```
from __future__ import annotations

from abc import ABC
from abc import abstractmethod


class FileConverter(ABC):
    @abstractmethod
    def convert_to_images(self, file_path: str):
        pass

```

### Core Architecture Module: `docext/core/file_converters/pdf_converter.py`
```
from __future__ import annotations

import os
import tempfile
from typing import Optional

from pdf2image import convert_from_path

from docext.core.file_converters.file_converter import FileConverter


class PDFConverter(FileConverter):
    def convert_to_images(self, file_path: str):
        return convert_from_path(file_path)

    def convert_and_save_images(self, file_path: str, output_folder: str | None = None):
        images = self.convert_to_images(file_path)
        if not output_folder:
            # set tmp folder as output folder
            output_folder = tempfile.gettempdir()
        os.makedirs(output_folder, exist_ok=True)
        # save images to output folder
        output_file_paths = []
        for i, image in enumerate(images):
            output_file_path = os.path.join(output_folder, f"page_{i}.png")
            image.save(output_file_path)
            output_file_paths.append(output_file_path)
        return output_file_paths

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #67** (2026-05-03): **Fixed documentation errors**
  *Symptoms*: Fixes #65 by adding the proper links to the documents and fixing the table of contents.
  **Post-Mortem & Fix Analysis**:
  > @mandalsouvik3333 Please have a look.

- **Issue #64** (2026-05-03): **Fix:added missing __init__.py file to benchmark/metrics**
  *Symptoms*: Fixes issue #40 by adding the missing __init__.py file in the benchmark/metrics folder. Ensures that pip install . works correctly and the docext.benchmark.metrics module can be imported without errors. Updates to ext_readme.md and contribution.md should be considered since uv pip install -e . is not required any longer.

- **Issue #61** (2025-08-25): **DOC: Fix README for server port and function parameters**
  *Symptoms*: Hi,  I noticed just a few remainders / outdated bits in the pdf -> markdown readme.

- **Issue #60** (2025-08-10): **How to run with model on open ai API access? (running on mac)**
  *Symptoms*: So on mac silicon I wasnt able to get docext running using default Nanonets-OCR-s model. However when imported to LM Studio in .GGUF format and hosted as API it works:  `from openai import OpenAI import base64  client = OpenAI(api_key="123", base_url="http://192.168.0.16:8000/v1")  model = "nanonets/Nanonets-OCR-s"  def encode_image(image_path):     with open(image_path, "rb") as image_file:         return base64.b64encode(image_file.read()).decode("utf-8") `  But now how to get that into the docext flow?  Since LM Studio is super universal I think this will beneficial for all kinds of use cases on strange / not CUDA hardware. 
  **Post-Mortem & Fix Analysis**:
  > 👋 Welcome! Thanks for opening your first issue. If you'd like to take a crack at fixing it, feel free to open a pull request — otherwise, we'll take a look as soon as we can!

- **Issue #59** (2025-09-02): **What dataset was used to train the models in Nanonets?**
  *Symptoms*: I was wondering what kind of datasets were used during the training of the models in Nanonets.   
  **Post-Mortem & Fix Analysis**:
  > 👋 Welcome! Thanks for opening your first issue. If you'd like to take a crack at fixing it, feel free to open a pull request — otherwise, we'll take a look as soon as we can!
  > Unfortunately, we don't have permission to share details about the datasets. There is some information present in the [release blog](https://nanonets.com/research/nanonets-ocr-s/). There is a plan to write a technical report after our next open model release, and some information will be there.

- **Issue #57** (2025-07-31): **Issue with documents containing images : Images are not described**
  *Symptoms*: When testing on this image, the figure is not described like shown in the blogpost.    ![Image](https://github.com/user-attachments/assets/28bf907e-1c8c-473e-a0b7-c0db3bda158f)  Instead I get something like this :    <img width="996" height="314" alt="Image" src="https://github.com/user-attachments/assets/f5522126-a0fc-440d-b664-88176a9b34eb" />
  **Post-Mortem & Fix Analysis**:
  > You will have to use the prompt mentioned on the HF page. https://huggingface.co/nanonets/Nanonets-OCR-s. The prompt we use in docext is slightly different from the HF one and works better for table extraction (but image description sometimes does not work). If you want to reproduce the results, you can run the transformer code snippet using the transformer lib provided in the HF page. 

- **Issue #47** (2025-06-30): **Fix: Add transformers version constraints to resolve TypeError**
  *Symptoms*: # Problem When attempting to run docext on a machine with a pre-existing or incompatible version of transformers, a conflict arises due to version mismatches. This leads to runtime errors that prevent the module from executing correctly.  ## Related Issue Closes #46   ## Specific Error ```TypeError: Qwen2_5_VLProcessor.init() got multiple values for argument 'image_processor'``` This error is typically caused by incompatibilities between the transformers version and the expected function signature used by vLLM.  # Solution Pin the appropriate transformers version in the requirements.txt file to ensure compatibility with the vLLM version used in the project. This prevents unexpected behavior and ensures consistent runtime across environments. 

- **Issue #46** (2025-06-30): **Initialization error**
  *Symptoms*: Encountered  an error when trying to run on RTX4080 16G by docker the docext application with the hosted_vllm: docker run --rm \   --env "..." \   -v ~/.cache/huggingface:/root/.cache/huggingface \   --network host \   --shm-size=20.24gb \   --gpus all \   nanonetsopensource/docext:v0.1.10 --model_name "hosted_vllm/Qwen/Qwen2.5-VL-7B-Instruct-AWQ"  The main error occurred during the initialization of the vLLM server with the Qwen2_5_VLProcessor class: TypeError: Qwen2_5_VLProcessor.__init__() got multiple values for argument 'image_processor'.  Here is an extract from setup log: ... ...ERROR 06-28 04:01:12 [core.py:390] EngineCore hit an exception: Traceback (most recent call last): ERROR 06-28 04:01:12 [core.py:390]   File "/app/.venv/lib/python3.11/site-packages/vllm/v1/engine/core.py", line 378, in run_engine_core ERROR 06-28 04:01:12 [core.py:390]     engine_core = EngineCoreProc(*args, **kwargs) ERROR 06-28 04:01:12 [core.py:390]                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ERROR 06-28 04:01:12 [core.py:390]   File "/app/.venv/lib/python3.11/site-packages/vllm/v1/engine/core.py", line 319, in __init__ ERROR 06-28 04:01:12 [core.py:390]     super().__init__(vllm_config, executor_class, log_stats) ERROR 06-28 04:01:12 [core.py:390]   File "/app/.venv/lib/python3.11/site-packages/vllm/v1/engine/core.py", line 71, in __init__ ERROR 06-28 04:01:12 [core.py:390]     self._initialize_kv_caches(vllm_config) ERROR 06-28 04:01:12 [core.py:390]   File "/app/.venv/lib/python3.1
  **Post-Mortem & Fix Analysis**:
  > 👋 Welcome! Thanks for opening your first issue. If you'd like to take a crack at fixing it, feel free to open a pull request — otherwise, we'll take a look as soon as we can!
  > same gpu, same question lol
  > I was able to replicate this issue. I fixed it by pinning the transformers version. Hopefully, once [this](https://github.com/NanoNets/docext/pull/47) PR is merged, the problem should be resolved.

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

### Incident Patch 1: `1f0a73e4` (2025-08-22)
**Commit Message**: DOC: Fix README for server port and function parameters

**File**: `PDF2MD_README.md` (modified, +2/-4)
```diff
@@ -57,7 +57,7 @@ python -m docext.app.app --model_name hosted_vllm/nanonets/Nanonets-OCR-s
 python -m docext.app.app --model_name hosted_vllm/nanonets/Nanonets-OCR-s --max_img_size 1024 --concurrency_limit 16 # `--help` for more options
 ```
 
-The interface will be available at `http://localhost:7860` with default credentials: (You can change the port by using `--ui_port` flag)
+The interface will be available at `http://localhost:7860` with default credentials: (You can change the port by using `--server_port` flag)
 
 - Username: `admin`
 - Password: `admin`
@@ -74,8 +74,7 @@ def convert_pdf_to_markdown(
     client_url: str,
     username: str,
     password: str,
-    file_paths: list[str],
-    model_name: str = "hosted_vllm/nanonets/Nanonets-OCR-s"
+    file_paths: list[str]
 ):
     """
     Convert PDF/images to markdown using the API
@@ -85,7 +84,6 @@ def convert_pdf_to_markdown(
         username: Authentication username
         password: Authentication password
         file_paths: List of file paths to convert
-        model_name: Model to use for conversion
 
     Returns:
         str: Converted markdown content
```

---

### Incident Patch 2: `841502f0` (2025-06-30)
**Commit Message**: Merge pull request #45 from kira-offgrid/fix-dockerfile.security.missing-user-entrypoint.missing-user-entrypoint-dockerfile-f3f9

Fix: Container Running with Dangerous Root User Privileges in Dockerfile

**File**: `Dockerfile` (modified, +2/-0)
```diff
@@ -34,4 +34,6 @@ RUN pip install --no-cache-dir flash-attn --no-build-isolation
 
 # Set working directory and entrypoint
 WORKDIR /app/
+RUN adduser --disabled-password --gecos '' --shell /bin/bash appuser
+USER appuser
 ENTRYPOINT ["/app/.venv/bin/python", "-m", "docext.app.app", "--no-share", "--ui_port", "7860"]
```

---

### Incident Patch 3: `66c4dd1e` (2025-06-30)
**Commit Message**: Merge pull request #47 from 28ananthaprakash/fix/type-error-during-initialization

Fix: Add transformers version constraints to resolve TypeError

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -172,3 +172,6 @@ cython_debug/
 
 # PyPI configuration file
 .pypirc
+
+# Gradio related files
+.gradio/
\ No newline at end of file
```

**File**: `requirements.txt` (modified, +4/-3)
```diff
@@ -6,14 +6,15 @@ loguru
 mdpd
 numpy
 pandas
+pdf2image
 PyMuPDF
 python-dotenv
 python-levenshtein==0.27.1
 requests
 setuptools
 tabulate
 tenacity
+transformers>=4.51.1,<4.53.0
 types-requests
-vllm==v0.8.3
-xgrammar==0.1.17
-pdf2image
+vllm==0.8.3
+xgrammar==0.1.17
\ No newline at end of file
```

---

### Incident Patch 4: `b02ac41b` (2025-06-30)
**Commit Message**: Merge pull request #32 from Bae-ChangHyun/fix/vllm_health_check

fix: update healthcheck endpoint in check_vllm_healthcheck function

**File**: `docext/app/utils.py` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ def cleanup(signum, frame, vllm_server):
 
 def check_vllm_healthcheck(host: str, port: int):
     try:
-        response = requests.get(f"http://{host}:{port}/healthcheck")
+        response = requests.get(f"http://{host}:{port}/health")
         return response.status_code == 200
     except Exception as e:
         return False
```

---

### Incident Patch 5: `81ee129a` (2025-06-26)
**Commit Message**: fix: dockerfile.security.missing-user-entrypoint.missing-user-entrypoint-Dockerfile

**File**: `Dockerfile` (modified, +2/-0)
```diff
@@ -34,4 +34,6 @@ RUN pip install --no-cache-dir flash-attn --no-build-isolation
 
 # Set working directory and entrypoint
 WORKDIR /app/
+RUN adduser --disabled-password --gecos '' --shell /bin/bash appuser
+USER appuser
 ENTRYPOINT ["/app/.venv/bin/python", "-m", "docext.app.app", "--no-share", "--ui_port", "7860"]
```

---

### Incident Patch 6: `c3058c89` (2025-06-18)
**Commit Message**: Fix UTF-8 decoding error on Windows (#34)

Closes #31

**File**: `setup.py` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
     author="Souvik Mandal",
     author_email="souvik@nanonets.com",
     description="Onprem information extraction from documents",
-    long_description=open("README.md").read(),
+    long_description=open("README.md", encoding='utf-8').read(),
     long_description_content_type="text/markdown",
     url="https://github.com/nanonets/docext",
     packages=find_packages(include=["docext", "docext.*"]),
```

---

### Incident Patch 7: `1f7d0e8e` (2025-06-17)
**Commit Message**: fix: update healthcheck endpoint in check_vllm_healthcheck function

**File**: `docext/app/utils.py` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ def cleanup(signum, frame, vllm_server):
 
 def check_vllm_healthcheck(host: str, port: int):
     try:
-        response = requests.get(f"http://{host}:{port}/healthcheck")
+        response = requests.get(f"http://{host}:{port}/health")
         return response.status_code == 200
     except Exception as e:
         return False
```

---

### Incident Patch 8: `53a1ed54` (2025-06-12)
**Commit Message**: rename ui_port to server_port, same as gradio

**File**: `docext/app/args.py` (modified, +2/-1)
```diff
@@ -26,8 +26,9 @@ def parse_args():
         help="Name of the model to use. Use 'ollama/' prefix for OLLAMA models and 'hosted_vllm/' prefix for hosted vLLM models.",
     )
     parser.add_argument(
-        "--ui_port",
+        "--server_port",
         type=int,
+        dest="ui_port",
         default=7860,
         help="Port for the gradio UI",
     )
```

---

### Incident Patch 9: `665d7d8c` (2025-06-12)
**Commit Message**: fix error logs

**File**: `docext/app/app.py` (modified, +1/-1)
```diff
@@ -342,9 +342,9 @@ def main(
             max_gen_tokens,
         )
     except (KeyboardInterrupt, Exception) as e:
+        logger.error(f"Error: {e}")
         if vllm_server:
             cleanup(None, None, vllm_server)
-        logger.error(f"Error: {e}")
 
 
 def docext_app():
```

---

### Incident Patch 10: `3a1b3875` (2025-06-12)
**Commit Message**: fix dtype

**File**: `docext/core/vllm.py` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ def start_server(self):
         logger.info("Starting vLLM server...")
         # Command to start the vLLM server
         is_awq = "awq" in self.model_name.lower()
-        dtype = dtype if not is_awq else "float16"
+        dtype = self.dtype if not is_awq else "float16"
         command = [
             "vllm",
             "serve",
```

---

### Incident Patch 11: `85250dd4` (2025-06-03)
**Commit Message**: fixed output for mutliple tables and fields extracted

**File**: `docext/app/app.py` (modified, +23/-2)
```diff
@@ -14,6 +14,7 @@
 from docext.core.config import TEMPLATES_FIELDS
 from docext.core.config import TEMPLATES_TABLES
 from docext.core.extract import extract_information
+from docext.core.utils import convert_files_to_images
 from docext.core.vllm import VLLMServer
 
 METADATA = []
@@ -139,8 +140,28 @@ def define_keys_and_extract(model_name: str, max_img_size: int, concurrency_limi
                 visible=False,
             )
 
-            images_input = gr.Gallery(label="Upload images", preview=True)
-            submit_btn = gr.Button("Submit")
+            file_input = gr.File(
+                label="Upload Documents",
+                file_types=[".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".gif", ".webp"],
+                file_count="multiple"
+            )
+            images_input = gr.Gallery(label="Document Preview", preview=True, visible=False)
+            submit_btn = gr.Button("Submit", visible=False)
+
+            def handle_file_upload(files):
+                if not files:
+                    return None, gr.update(visible=False), gr.update(visible=False)
+                
+                file_paths = [f.name for f in files]
+                # Convert PDFs to images if necessary and get all image paths
+                image_paths = convert_files_to_images(file_paths)
+                return image_paths, gr.update(visible=True, value=image_paths), gr.update(visible=True)
+
+            file_input.change(
+                handle_file_upload,
+                inputs=[file_input],
+                outputs=[images_input, images_input, submit_btn]
+            )
 
     with gr.Row():
         with gr.Column(scale=3):
```

**File**: `docext/core/client.py` (modified, +3/-1)
```diff
@@ -42,7 +42,9 @@ def sync_request(
     elif model_name.startswith("openrouter"):
         completion_args["response_format"] = format
     elif "gpt" in model_name.lower():
-        completion_args["response_format"] = {"type": "json_object"}
+        # Only set response_format if the prompt mentions "json"
+        if any("json" in m.get("text", "").lower() for m in messages if isinstance(m, dict)):
+            completion_args["response_format"] = {"type": "json_object"}
 
     response = completion(**completion_args)
     return response.json()
```

**File**: `docext/core/extract.py` (modified, +35/-8)
```diff
@@ -66,14 +66,36 @@ def extract_fields_from_documents(
     extracted_fields = json_repair.loads(response)
     conf_scores = json_repair.loads(response_conf_score)
 
-    df = pd.DataFrame(
-        {
-            "fields": field_names,
-            "answer": [extracted_fields.get(field, "") for field in field_names],
-            "confidence": [conf_scores.get(field, "Low") for field in field_names],
-        },
-    )
-    return df
+    logger.info(f"Extracted fields: {extracted_fields}")
+    logger.info(f"Conf scores: {conf_scores}")
+
+    # Handle both single dictionary and list of dictionaries
+    if not isinstance(extracted_fields, list):
+        extracted_fields = [extracted_fields]
+    
+    # Handle confidence scores similarly
+    if not isinstance(conf_scores, list):
+        conf_scores = [conf_scores] * len(extracted_fields)
+    elif len(conf_scores) < len(extracted_fields):
+        # If we have fewer confidence scores than documents, pad with the first confidence score
+        conf_scores.extend([conf_scores[0]] * (len(extracted_fields) - len(conf_scores)))
+    
+    # Create a list of dataframes, one for each document
+    dfs = []
+    for idx, (doc_fields, doc_conf_scores) in enumerate(zip(extracted_fields, conf_scores)):
+        df = pd.DataFrame(
+            {
+                "fields": field_names,
+                "answer": [doc_fields.get(field, "") for field in field_names],
+                "confidence": [doc_conf_scores.get(field, "Low") for field in field_names],
+                "document_index": [idx] * len(field_names)
+            },
+        )
+        dfs.append(df)
+    
+    # Concatenate all dataframes with a document index
+    final_df = pd.concat(dfs, ignore_index=True)
+    return final_df
 
 
 def extract_tables_from_documents(
@@ -133,4 +155,9 @@ def extract_information(
 
         fields_df = future_fields.result()
         tables_df = future_tables.result()
+    
+    # Group fields by document_index for better display
+    if not fields_df.empty and 'document_index' in fields_df.columns:
+        fields_df = fields_df.sort_values(['document_index', 'fields'])
+    
     return fields_df, tables_df
```

---

### Incident Patch 12: `9249d94d` (2025-05-13)
**Commit Message**: add grits for table eval, fix #14

**File**: `docext/benchmark/metrics/grits.py` (added, +543/-0)
```diff
@@ -0,0 +1,543 @@
+# code from https://github.com/microsoft/table-transformer/blob/main/src/grits.py
+from __future__ import annotations
+
+import itertools
+import xml.etree.ElementTree as ET
+from collections import defaultdict
+from difflib import SequenceMatcher
+
+import numpy as np
+from fitz import Rect
+
+
+def compute_fscore(num_true_positives, num_true, num_positives):
+    """
+    Compute the f-score or f-measure for a collection of predictions.
+
+    Conventions:
+    - precision is 1 when there are no predicted instances
+    - recall is 1 when there are no true instances
+    - fscore is 0 when recall or precision is 0
+    """
+    if num_positives > 0:
+        precision = num_true_positives / num_positives
+    else:
+        precision = 1
+    if num_true > 0:
+        recall = num_true_positives / num_true
+    else:
+        recall = 1
+
+    if precision + recall > 0:
+        fscore = 2 * precision * recall / (precision + recall)
+    else:
+        fscore = 0
+
+    return fscore, precision, recall
+
+
+def initialize_DP(sequence1_length, sequence2_length):
+    """
+    Helper function to initialize dynamic programming data structures.
+    """
+    # Initialize DP tables
+    scores = np.zeros((sequence1_length + 1, sequence2_length + 1))
+    pointers = np.zeros((sequence1_length + 1, sequence2_length + 1))
+
+    # Initialize pointers in DP table
+    for seq1_idx in range(1, sequence1_length + 1):
+        pointers[seq1_idx, 0] = -1
+
+    # Initialize pointers in DP table
+    for seq2_idx in range(1, sequence2_length + 1):
+        pointers[0, seq2_idx] = 1
+
+    return scores, pointers
+
+
+def traceback(pointers):
+    """
+    Dynamic programming traceback to determine the aligned indices
+    between the two sequences.
+
+    Traceback convention: -1 = up, 1 = left, 0 = diag up-left
+    """
+    seq1_idx = pointers.shape[0] - 1
+    seq2_idx = pointers.shape[1] - 1
+    aligned_sequence1_indices = []
+    aligned_sequence2_indices = []
+    while not (seq1_idx == 0 and seq2_idx == 0):
+        if pointers[seq1_idx, seq2_idx] == -1:
+            seq1_idx -= 1
+        elif pointers[seq1_idx, seq2_idx] == 1:
+            seq2_idx -= 1
+        else:
+            seq1_idx -= 1
+            seq2_idx -= 1
+            aligned_sequence1_indices.append(seq1_idx)
+            aligned_sequence2_indices.append(seq2_idx)
+
+    aligned_sequence1_indices = aligned_sequence1_indices[::-1]
+    aligned_sequence2_indices = aligned_sequence2_indices[::-1]
+
+    return aligned_sequence1_indices, aligned_sequence2_indices
+
+
+def align_1d(sequence1, sequence2, reward_lookup, return_alignment=False):
+    """
+    Dynamic programming alignment between two sequences,
+    with memoized rewards.
+
+    Sequences are represented as indices into the rewards lookup table.
+
+    Traceback convention: -1 = up, 1 = left, 0 = diag up-left
+    """
+    sequence1_length = len(sequence1)
+    sequence2_length = len(sequence2)
+
+    scores, pointers = initialize_DP(sequence1_length, sequence2_length)
+
+    for seq1_idx in range(1, sequence1_length + 1):
+        for seq2_idx in range(1, sequence2_length + 1):
+            reward = reward_lookup[sequence1[seq1_idx - 1] + sequence2[seq2_idx - 1]]
+            diag_score = scores[seq1_idx - 1, seq2_idx - 1] + reward
+            skip_seq2_score = scores[seq1_idx, seq2_idx - 1]
+            skip_seq1_score = scores[seq1_idx - 1, seq2_idx]
+
+            max_score = max(diag_score, skip_seq1_score, skip_seq2_score)
+            scores[seq1_idx, seq2_idx] = max_score
+            if diag_score == max_score:
+                pointers[seq1_idx, seq2_idx] = 0
+            elif skip_seq1_score == max_score:
+                pointers[seq1_idx, seq2_idx] = -1
+            else:  # skip_seq2_score == max_score
+                pointers[seq1_idx, seq2_idx] = 1
+
+    score = scores[-1, -1]
+
+    if not return_alignment:
+        return score
+
+    # Traceback
+    sequence1_indices, sequence2_indices = traceback(pointers)
+
+    return sequence1_indices, sequence2_indices, score
+
+
+def align_2d_outer(true_shape, pred_shape, reward_lookup):
+    """
+    Dynamic programming matrix alignment posed as 2D
+    sequence-of-sequences alignment:
+    Align two outer sequences whose entries are also sequences,
+    where the match reward between the inner sequence entries
+    is their 1D sequence alignment score.
+
+    Traceback convention: -1 = up, 1 = left, 0 = diag up-left
+    """
+
+    scores, pointers = initialize_DP(true_shape[0], pred_shape[0])
+
+    for row_idx in range(1, true_shape[0] + 1):
+        for col_idx in range(1, pred_shape[0] + 1):
+            reward = align_1d(
+                [(row_idx - 1, tcol) for tcol in range(true_shape[1])],
+                [(col_idx - 1, prow) for prow in range(pred_shape[1])],
+                reward_lookup,
+            )
+            diag_score = scores[row_idx - 1, col_idx - 1] + reward
+            same_
```

**File**: `docext/benchmark/metrics/tables.py` (modified, +1/-1)
```diff
@@ -1,8 +1,8 @@
 from __future__ import annotations
 
 import numpy as np
-from tabeval.grits import grits_from_df
 
+from docext.benchmark.metrics.grits import grits_from_df
 from docext.benchmark.vlm_datasets.ds import Prediction
 
 
```

**File**: `requirements.txt` (modified, +2/-0)
```diff
@@ -4,7 +4,9 @@ json-repair
 litellm
 loguru
 mdpd
+numpy
 pandas
+PyMuPDF
 python-dotenv
 python-levenshtein==0.27.1
 requests
```

---

### Incident Patch 13: `1fca449e` (2025-05-12)
**Commit Message**: fix for gemma system prompt support

**File**: `docext/benchmark/tasks.py` (modified, +20/-5)
```diff
@@ -95,6 +95,15 @@ def get_datasets(
     return all_datasets
 
 
+def get_image_encoding_type(image_path: str) -> str:
+    if image_path.endswith(".png"):
+        return "data:image/png;base64"
+    elif image_path.endswith(".jpg") or image_path.endswith(".jpeg"):
+        return "data:image/jpeg;base64"
+    else:
+        raise ValueError(f"Unsupported image format: {image_path}")
+
+
 def get_TABLE_messages(data: BenchmarkData, template: dict[str, Any]):
     system_prompt = template["system_prompt"]
     document_page_seperator = template["document_page_seperator"]
@@ -118,7 +127,7 @@ def get_TABLE_messages(data: BenchmarkData, template: dict[str, Any]):
                 {
                     "type": "image_url",
                     "image_url": {
-                        "url": f"data:image/jpeg;base64,{encode_image(filepath)}",
+                        "url": f"{get_image_encoding_type(filepath)},{encode_image(filepath)}",
                     },
                 },
             ],
@@ -152,7 +161,7 @@ def get_CLASSIFICATION_messages(data: BenchmarkData, template: dict[str, Any]):
                 {
                     "type": "image_url",
                     "image_url": {
-                        "url": f"data:image/jpeg;base64,{encode_image(filepath)}",
+                        "url": f"{get_image_encoding_type(filepath)},{encode_image(filepath)}",
                     },
                 },
             ],
@@ -189,7 +198,7 @@ def get_VQA_messages(data: BenchmarkData, template: dict[str, Any]):
                 {
                     "type": "image_url",
                     "image_url": {
-                        "url": f"data:image/jpeg;base64,{encode_image(filepath)}",
+                        "url": f"{get_image_encoding_type(filepath)},{encode_image(filepath)}",
                     },
                 },
             ],
@@ -218,7 +227,7 @@ def get_OCR_messages(data: BenchmarkData, template: dict[str, Any]):
                 {
                     "type": "image_url",
                     "image_url": {
-                        "url": f"data:image/jpeg;base64,{encode_image(image_path)}",
+                        "url": f"{get_image_encoding_type(image_path)},{encode_image(image_path)}",
                     },
                 },
             ],
@@ -255,7 +264,7 @@ def get_KIE_messages(data: BenchmarkData, template: dict[str, Any]):
                 {
                     "type": "image_url",
                     "image_url": {
-                        "url": f"data:image/jpeg;base64,{encode_image(filepath)}",
+                        "url": f"{get_image_encoding_type(filepath)},{encode_image(filepath)}",
                     },
                 },
             ],
@@ -269,3 +278,9 @@ def get_KIE_messages(data: BenchmarkData, template: dict[str, Any]):
         {"role": "user", "content": user_prompt},
     ]
     return messages
+
+
+def change_system_prompt(messages: list[dict[str, Any]], model_name: str):
+    if "gemma-3-27b-it" in model_name:
+        messages[0] = {"role": "user", "content": messages[0]["content"]}
+    return messages
```

---

### Incident Patch 14: `79fa2458` (2025-04-23)
**Commit Message**: fix rotated image

**File**: `docext/benchmark/vlm_datasets/ocr_hw.py` (modified, +2/-2)
```diff
@@ -11,9 +11,9 @@
 import random
 from typing import Optional
 
-from datasets import load_dataset
 from tqdm import tqdm
 
+from datasets import load_dataset
 from docext.benchmark.vlm_datasets.ds import BenchmarkData
 from docext.benchmark.vlm_datasets.ds import BenchmarkDataset
 from docext.benchmark.vlm_datasets.ds import ExtractionType
@@ -61,7 +61,7 @@ def _load_data(
             if self.rotation:
                 random.seed(i)
                 small_angle = random.choice(range(-5, 5))
-                image = image.rotate(small_angle)
+                image = image.rotate(small_angle, expand=True)
 
             # save the image
             image_path = os.path.join(cache_dir, f"{i}.png")
```

---

### Incident Patch 15: `3009e823` (2025-04-23)
**Commit Message**: fix for non dict prediction

**File**: `docext/benchmark/benchmark.py` (modified, +14/-8)
```diff
@@ -373,7 +373,11 @@ def _run_single_model_single_dataset(
         responses = list(futures)
         total_cost = 0
         for response, data in zip(responses, dataset.data):
-            total_cost += response["response_cost"]
+            total_cost += (
+                response["response_cost"]
+                if response["response_cost"] is not None
+                else 0
+            )
             # parse the response
             parsed_response = self._parse_response(response, dataset.task)
             if dataset.task == "KIE":
@@ -527,14 +531,16 @@ def _parse_response(self, response: dict, task: str):
             # merge all the keys into a single dict
             merged_dict = {}
             for item in parsed_json:
-                for key, value in item.items():
-                    if key not in merged_dict:
-                        merged_dict[key] = value
-                    else:
-                        if isinstance(merged_dict[key], list):
-                            merged_dict[key].append(value)
+                if isinstance(item, dict):
+                    for key, value in item.items():
+                        if key not in merged_dict:
+                            merged_dict[key] = value
                         else:
-                            merged_dict[key] = [merged_dict[key], value]
+                            if isinstance(merged_dict[key], list):
+                                merged_dict[key].append(value)
+                            else:
+                                merged_dict[key] = [merged_dict[key], value]
+                # we ignore the other types of objects, the model should not return them
             return merged_dict
 
         if parsed_json == "":
```

#### Recent Merged Pull Requests:
- **PR #67** (closed): Fixed documentation errors (@Labreo)
- **PR #64** (closed): Fix:added missing __init__.py file to benchmark/metrics (@Labreo)
- **PR #61** (2025-08-25): DOC: Fix README for server port and function parameters (@apbard)
- **PR #47** (2025-06-30): Fix: Add transformers version constraints to resolve TypeError (@28ananthaprakash)
- **PR #34** (2025-06-18): Fix UTF-8 decoding error on Windows (@mrexodia)
- **PR #32** (2025-06-30): fix: update healthcheck endpoint in check_vllm_healthcheck function (@Changroro)
- **PR #24** (2025-06-12): Add image & pdf 2 markdown support (@mandalsouvik3333)
- **PR #23** (2025-06-04): PDF Support, Multi File Support and Some Fixes (@sirius116)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
