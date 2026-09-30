# Forensic Learning Record (Deep Inspection): NanoNets/docext

> **Canonical Artifact**: `07_PROJECT_LEARNING/nanonets-docext-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NanoNets/docext](https://github.com/NanoNets/docext))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:12:58.609Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NanoNets/docext`
- **Description**: An on-premises, OCR-free unstructured data extraction, markdown conversion and benchmarking toolkit. (https://idp-leaderboard.org/)
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 2086 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `docext/__init__.py`
```
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

```

### Core Architecture Module: `docext/app/__init__.py`
```
# Empty file to make docext.app a Python package
from __future__ import annotations

```

### Core Architecture Module: `docext/app/app.py`
```
from __future__ import annotations

import os
import signal

import gradio as gr
import pandas as pd
from loguru import logger

from docext.app.args import parse_args
from docext.app.pdf2md import pdf_to_markdown_ui
from docext.app.utils import check_ollama_healthcheck
from docext.app.utils import check_vllm_healthcheck
from docext.app.utils import cleanup
from docext.core.config import TEMPLATES_FIELDS
from docext.core.config import TEMPLATES_TABLES
from docext.core.extract import extract_information
from docext.core.utils import convert_files_to_images
from docext.core.vllm import VLLMServer

METADATA = []


def add_field(field_name: str, type: str, description: str):
    global METADATA
    METADATA.append(
        {"field_name": field_name, "type": type, "description": description},
    )
    return update_fields_display()


def update_fields_display():
    dict_data = {"index": [], "type": [], "name": [], "description": []}
    for i, metadata in enumerate(METADATA):
        dict_data["index"].append(i)
        dict_data["type"].append(metadata["type"])
        dict_data["name"].append(metadata["field_name"])
        dict_data["description"].append(metadata["description"])
    return pd.DataFrame(dict_data)


def clear_fields():
    global METADATA
    METADATA = []
    return update_fields_display()


def remove_field(index):
    global METADATA
    if 0 <= index < len(METADATA):
        del METADATA[index]
    return update_fields_display()


def add_predefined_fields(doc_type):
    global METADATA
    fields = TEMPLATES_FIELDS.get(doc_type, [])
    fields = [
        {
            "field_name": field["field_name"],
            "type": "field",
            "description": field["description"],
        }
        for field in fields
    ]
    tables = TEMPLATES_TABLES.get(doc_type, [])
    tables = [
        {
            "field_name": table["field_name"],
            "type": "table",
            "description": table["description"],
        }
        for table in tables
    ]
    METADATA = fields + tables
    return update_fields_display()


def define_keys_and_extract(model_name: str, max_img_size: int, concurrency_limit: int):
    gr.Markdown(
        """### Add all the fields you want to extract information from the documents
        - Add a field by clicking the **`Add Field`** button. Description is optional.
        - You can also select predefined fields for a specific document type by selecting a template in **`Existing Templates`** dropdown.
        - List of fields will be displayed below in the **`Fields`** section.
        - Remove a field by clicking the **`Remove Field`** button. You will need to provide the index of the field to remove.
        - Clear all the fields by clicking the **`Clear All Fields`** button.
        """,
    )
    with gr.Row():
        add_predefined_fields_btn = gr.Dropdown(
            choices=["Select a template"] + list(TEMPLATES_FIELDS.keys()),
            label="Existing Templates",
        )

    gr.Markdown("""#### Add a new field/column""")
    with gr.Row():
        field_name = gr.Textbox(
            label="Field Name",
            placeholder="Enter field/column name",
        )
        type = gr.Dropdown(choices=["field", "table"], label="Type")
        description = gr.Textbox(label="Description", placeholder="Enter description")

    with gr.Row():
        add_btn = gr.Button("Add Field/Column ✚")
        clear_btn = gr.Button("Clear All Fields/Columns ❌")

    fields_display = gr.Dataframe(
        label="Fields/Columns",
        wrap=True,
        interactive=False,
        headers=["index", "type", "name", "description"],
    )

    gr.Markdown("""#### Remove a field/column""")
    with gr.Row():
        field_index = gr.Number(
            label="Field/Column Index to Remove",
            value=0,
            precision=0,
        )
        remove_btn = gr.Button("Remove Field/Column −")

    add_btn.click(add_field, [field_name, type, description], fields_display)
    clear_btn.click(clear_fields, None, fields_display)
    remove_btn.click(remove_field, field_index, fields_display)
    add_predefined_fields_btn.select(
        add_predefined_fields,
        add_predefined_fields_btn,
        fields_display,
    )

    gr.Markdown("""-----------------------------------------""")
    gr.Markdown("""### Upload images and extract information ⚙️""")
    with gr.Row():
        with gr.Column():
            # Create a hidden textbox for model_name
            model_input = gr.Textbox(value=model_name, visible=False)
            max_img_size_input = gr.Number(
                value=max_img_size,
                visible=False,
            )

            file_input = gr.File(
                label="Upload Documents",
                file_types=[
                    ".pdf",
                    ".jpg",
                    ".jpeg",
                    ".png",
                    ".tiff",
                    ".bmp",
                    ".gif",
                    ".webp",
                ],
                file_count="multiple",
            )
            images_input = gr.Gallery(
                label="Document Preview", preview=True, visible=False
            )
            submit_btn = gr.Button("Submit", visible=False)

            def handle_file_upload(files):
                if not files:
                    return None, gr.update(visible=False), gr.update(visible=False)

                file_paths = [f.name for f in files]
                # Convert PDFs to images if necessary and get all image paths
                image_paths = convert_files_to_images(file_paths)
                return (
                    image_paths,
                    gr.update(visible=True, value=image_paths),
                    gr.update(visible=True),
                )

            file_input.change(
                handle_file_upload,
                inputs=[file_input],
                outputs=[images_input, images_input, submit_btn],
            )

    with gr.Row():
        with gr.Column(scale=3):
            extracted_fields_output = gr.Dataframe(
                label="Extracted Fields",
                wrap=True,
                interactive=False,
                headers=["fields", "answer", "confidence"],
            )
        with gr.Column(scale=7):
            extracted_tables_output = gr.Dataframe(
                label="Extracted Tables",
                wrap=True,
                interactive=False,
                headers=["col1", "col2", "coln"],
            )

    submit_btn.click(
        extract_information,
        [images_input, model_name, max_img_size, fields_display],
        [extracted_fields_output, extracted_tables_output],
        concurrency_limit=concurrency_limit,
    )


def gradio_app(
    model_name: str,
    gradio_port: int,
    max_img_size: int,
    concurrency_limit: int,
    share: bool,
    vllm_server_host: str,
    vllm_server_port: int,
    max_gen_tokens: int,
):
    # set vlm_model_url env variable
    hosted_model_url = f"http://{vllm_server_host}:{vllm_server_port}"
    os.environ["VLM_MODEL_URL"] = (
        f"{hosted_model_url}/v1"
        if model_name.startswith("hosted_vllm/")
        else hosted_model_url
    )

    with gr.Blocks() as demo:
        with gr.Tabs():
            with gr.Tab("Information Extraction from documents"):
                instructions_md = """## Instructions 📖
                - Define the fields (and optionally the description) you want to extract from the document.
                - Upload a document (can be a single image or a list of images in case of multipage document).
                - Currently, we support only image files.
                - Currently, we only support maximum 5 images at a time. You can change this limit following the advanced instructions.
                -----------------------------------------
                """
                gr.Markdown(instructions_md)
                # Define the fields
                mo
```

### Core Architecture Module: `docext/app/args.py`
```
from __future__ import annotations

import argparse


def parse_args():
    parser = argparse.ArgumentParser(
        description="DocExt: Onprem information extraction from documents",
    )
    parser.add_argument(
        "--vlm_server_port",
        type=int,
        default=8000,
        help="Port for the vLLM/OLLAMA server",
    )
    parser.add_argument(
        "--vlm_server_host",
        type=str,
        default="127.0.0.1",
        help="Host for the vLLM/OLLAMA server",
    )
    parser.add_argument(
        "--model_name",
        type=str,
        default="hosted_vllm/Qwen/Qwen2.5-VL-7B-Instruct-AWQ",
        help="Name of the model to use. Use 'ollama/' prefix for OLLAMA models and 'hosted_vllm/' prefix for hosted vLLM models.",
    )
    parser.add_argument(
        "--server_port",
        type=int,
        dest="ui_port",
        default=7860,
        help="Port for the gradio UI",
    )
    parser.add_argument(
        "--max_model_len",
        type=int,
        default=15000,
        help="Maximum length of the model. Use small values for low memory devices.",
    )
    parser.add_argument(
        "--gpu_memory_utilization",
        type=float,
        default=0.9,
        help="GPU memory utilization. Use a value between 0 and 1.",
    )
    parser.add_argument(
        "--max_num_imgs",
        type=int,
        default=5,
        help="Maximum number of images to process in a single prompt.",
    )
    parser.add_argument(
        "--vllm_start_timeout",
        type=int,
        default=300,
        help="Timeout for the vLLM server to start.",
    )
    parser.add_argument(
        "--no-share",
        action="store_true",
        dest="share",  # This will set 'share' to False when --no-share is used
        help="Disable sharing of the UI on the web.",
    )
    parser.add_argument(
        "--log_level",
        type=str,
        default="debug",
        help="Log level. Can be 'debug', 'info', 'warning', 'error', 'critical'.",
    )
    parser.add_argument(
        "--max_img_size",
        type=int,
        default=2048,
        help="Maximum size of the image to process. Use 1024 for low memory devices.",
    )
    parser.add_argument(
        "--concurrency_limit",
        type=int,
        default=1,
        help="Maximum number of concurrent PDF to markdown conversion requests. Higher values allow more users to process documents simultaneously but require more memory and compute resources.",
    )
    parser.add_argument(
        "--dtype",
        type=str,
        default="bfloat16",
        help="Data type for the model. Can be 'bfloat16' or 'float16'.",
    )
    parser.add_argument(
        "--max_gen_tokens",
        type=int,
        default=10000,
        help="Maximum number of tokens to generate for the model.",
    )
    return parser.parse_args()

```

### Core Architecture Module: `docext/app/pdf2md.py`
```
from __future__ import annotations

import asyncio
import re
import time
import uuid
from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import gradio as gr

from docext.core.pdf2md.pdf2md import convert_to_markdown_stream
from docext.core.utils import convert_files_to_images


def process_tags(content: str) -> str:
    content = content.replace("<img>", "&lt;img&gt;")
    content = content.replace("</img>", "&lt;/img&gt;")
    content = content.replace("<watermark>", "&lt;watermark&gt;")
    content = content.replace("</watermark>", "&lt;/watermark&gt;")
    content = content.replace("<page_number>", "&lt;page_number&gt;")
    content = content.replace("</page_number>", "&lt;/page_number&gt;")
    content = content.replace("<signature>", "&lt;signature&gt;")
    content = content.replace("</signature>", "&lt;/signature&gt;")

    return content


def pdf_to_markdown_ui(
    model_name: str, max_img_size: int, concurrency_limit: int, max_gen_tokens: int
):
    with gr.Row():
        with gr.Column():
            # Add status indicator for concurrent processing
            gr.Markdown(
                """
Try Nanonets-OCR-s<br>
We’ve open-sourced Nanonets-OCR-s, A model for transforming documents into structured markdown with content recognition and semantic tagging.<br>
📖 [Release Blog](https://huggingface.co/nanonets/Nanonets-OCR-s) 🤗 [View on Hugging Face](https://huggingface.co/nanonets/Nanonets-OCR-s)
""",
                visible=True,
            ) if model_name != "hosted_vllm/nanonets/Nanonets-OCR-s" else None

            file_input = gr.File(
                label="Upload Documents",
                file_types=[
                    ".pdf",
                    ".jpg",
                    ".jpeg",
                    ".png",
                    ".tiff",
                    ".bmp",
                    ".gif",
                    ".webp",
                ],
                file_count="multiple",
            )
            images_input = gr.Gallery(
                label="Document Preview", preview=True, visible=False
            )
            submit_btn = gr.Button("Submit", visible=False)

            def handle_file_upload(files):
                if not files:
                    return None, gr.update(visible=False), gr.update(visible=False)

                file_paths = [f.name for f in files]
                # Convert PDFs to images if necessary and get all image paths
                image_paths = convert_files_to_images(file_paths)
                return (
                    image_paths,
                    gr.update(visible=True, value=image_paths),
                    gr.update(visible=True),
                )

            file_input.change(
                handle_file_upload,
                inputs=[file_input],
                outputs=[images_input, images_input, submit_btn],
            )

            formatted_output = gr.Markdown(
                label="Formatted model prediction",
                latex_delimiters=[
                    {"left": "$$", "right": "$$", "display": True},
                    {"left": "$", "right": "$", "display": False},
                    {
                        "left": "\\begin{align*}",
                        "right": "\\end{align*}",
                        "display": True,
                    },
                ],
                line_breaks=True,
                show_copy_button=True,
            )

            def process_markdown_streaming(images):
                """
                Process markdown with streaming updates (page by page)
                Optimized for concurrent processing of multiple requests
                """
                # Generate unique request ID for tracking
                request_id = str(uuid.uuid4())[:8]
                start_time = datetime.now().strftime("%H:%M:%S")

                # Initialize with a loading message including concurrent processing info
                num_pages = len(images) if images else 0

                # Stream the actual conversion
                current_page = 1
                try:
                    for markdown_content in convert_to_markdown_stream(
                        images,
                        model_name,
                        max_img_size,
                        concurrency_limit,
                        max_gen_tokens,
                    ):
                        # Add progress indicator at the top for multi-page documents
                        if num_pages > 1:
                            progress_header = f"📄 **Document Conversion Progress** `[Request {request_id}]` (Processing page {min(current_page, num_pages)} of {num_pages})\n\n"
                            yield progress_header + process_tags(markdown_content)
                        else:
                            yield process_tags(markdown_content)

                        # Estimate current page based on content length (rough approximation)
                        if "---" in markdown_content:
                            current_page = markdown_content.count("---") + 1

                        # Reduced delay for better concurrent performance
                        time.sleep(0.01)

                except Exception as e:
                    error_message = f"❌ **Error processing request {request_id}**: {str(e)}\n\nPlease try again or contact support if the issue persists."
                    yield error_message

            # Enable concurrent request processing by setting concurrency_limit
            # This allows multiple users to process documents simultaneously
            submit_btn.click(
                process_markdown_streaming,
                inputs=[images_input],
                outputs=[formatted_output],
                concurrency_limit=concurrency_limit,  # Allow multiple concurrent requests
                concurrency_id="pdf_to_markdown_conversion",  # Unique ID for this processing pipeline
            )

```

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

### Core Architecture Module: `docext/benchmark/benchmark.py`
```
"""
Start point for running the Nanonets IDP benchmark.


Checkout Nanonets for automating information extraction
from documents (like invoices, receipts, purchase orders, bills, etc) and automate workflows: https://nanonets.com/

Author: Souvik Mandal
"""
from __future__ import annotations

import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor
from itertools import repeat
from typing import Any

import json_repair
import mdpd
import pandas as pd
from litellm import completion
from loguru import logger
from tenacity import retry
from tenacity import stop_after_attempt
from tenacity import wait_exponential
from tqdm import tqdm

from docext.benchmark.metrics.classification import get_classification_metrics
from docext.benchmark.metrics.kie import get_kie_metrics
from docext.benchmark.metrics.ocr import get_ocr_metrics
from docext.benchmark.metrics.tables import get_table_metrics
from docext.benchmark.metrics.vqa import get_vqa__metric_for_multiple_possible_answers
from docext.benchmark.metrics.vqa import get_vqa_metrics
from docext.benchmark.tasks import change_system_prompt
from docext.benchmark.tasks import get_CLASSIFICATION_messages
from docext.benchmark.tasks import get_datasets
from docext.benchmark.tasks import get_KIE_messages
from docext.benchmark.tasks import get_OCR_messages
from docext.benchmark.tasks import get_TABLE_messages
from docext.benchmark.tasks import get_VQA_messages
from docext.benchmark.tasks import TABLE_DATASETS
from docext.benchmark.utils import load_yaml
from docext.benchmark.vlm_datasets.ds import BenchmarkData
from docext.benchmark.vlm_datasets.ds import BenchmarkDataset
from docext.benchmark.vlm_datasets.ds import Classification
from docext.benchmark.vlm_datasets.ds import PredField
from docext.benchmark.vlm_datasets.ds import Prediction
from docext.benchmark.vlm_datasets.ds import Table
from docext.benchmark.vlm_datasets.ds import VQA


class NanonetsIDPBenchmark:
    def __init__(
        self,
        benchmark_config_path: str,
    ):
        self.benchmark_config = load_yaml(benchmark_config_path)
        self._validate_benchmark_config(self.benchmark_config)

        # create the datasets
        self.datasets = self._get_datasets()

        for dataset in self.datasets:
            logger.info(f"Dataset {dataset.name} has {len(dataset.data)} samples")

        # create the models
        self.models = self.benchmark_config["models"]
        self.models = {model: self.benchmark_config[model] for model in self.models}

        # create the templates
        self.templates = {
            "KIE": self.benchmark_config["KIE_default_template"],
            "OCR": self.benchmark_config["OCR_default_template"],
            "VQA": self.benchmark_config["VQA_default_template"],
            "CLASSIFICATION": self.benchmark_config["CLASSIFICATION_default_template"],
            "TABLE": self.benchmark_config["TABLE_default_template"],
        }

        # run the benchmark, Note we cache each query. incase something fails, we can resume from the same point
        self.cache_dir = self.benchmark_config.get(
            "cache_dir",
            "./docext_benchmark_cache",
        )
        self.cache_dir = os.path.join(self.cache_dir, "prediction_cache")
        os.makedirs(self.cache_dir, exist_ok=True)

        self.max_workers = self.benchmark_config.get("max_workers", 1)
        self.ignore_cache = self.benchmark_config.get("ignore_cache", False)

    def _get_datasets(self):
        datasets = get_datasets(
            self.benchmark_config["tasks"],
            self.benchmark_config["datasets"],
        )

        init_datasets = []

        for dataset in datasets:
            if dataset.name == "docile":
                init_datasets.append(
                    dataset(
                        annot_path=self.benchmark_config["docile"]["annot_path"],
                        annotations_root=self.benchmark_config["docile"][
                            "annotations_root"
                        ],
                        pdf_root=self.benchmark_config["docile"]["pdf_root"],
                        max_samples=self.benchmark_config.get(
                            "max_samples_per_dataset",
                            None,
                        ),
                        cache_dir=self.benchmark_config.get("cache_dir", None),
                    ),
                )
            elif dataset.name == "handwritten_forms":
                init_datasets.append(
                    dataset(
                        hf_name=self.benchmark_config["handwritten_forms"]["hf_name"],
                        test_split=self.benchmark_config["handwritten_forms"][
                            "test_split"
                        ],
                        max_samples=self.benchmark_config.get(
                            "max_samples_per_dataset",
                            None,
                        ),
                        cache_dir=self.benchmark_config.get("cache_dir", None),
                    ),
                )

            elif dataset.name == "ocr_handwriting":
                max_samples = self.benchmark_config.get("max_samples_per_dataset", None)
                max_samples = min(
                    max_samples,
                    self.benchmark_config["ocr_handwriting"].get("max_samples", 1000),
                )
                init_datasets.append(
                    dataset(
                        hf_name=self.benchmark_config["ocr_handwriting"]["hf_name"],
                        test_split=self.benchmark_config["ocr_handwriting"][
                            "test_split"
                        ],
                        max_samples=max_samples,
                        cache_dir=self.benchmark_config.get("cache_dir", None),
                    ),
                )
            elif dataset.name == "ocr_handwriting_rotated":
                max_samples = self.benchmark_config.get("max_samples_per_dataset", None)
                max_samples = min(
                    max_samples,
                    self.benchmark_config["ocr_handwriting_rotated"].get(
                        "max_samples", 1000
                    ),
                )
                init_datasets.append(
                    dataset(
                        hf_name=self.benchmark_config["ocr_handwriting_rotated"][
                            "hf_name"
                        ],
                        test_split=self.benchmark_config["ocr_handwriting_rotated"][
                            "test_split"
                        ],
                        max_samples=max_samples,
                        cache_dir=self.benchmark_config.get("cache_dir", None),
                        rotation=True,
                    ),
                )
            elif dataset.name == "digital_ocr_diacritics":
                max_samples = self.benchmark_config.get("max_samples_per_dataset", None)
                max_samples = min(
                    max_samples,
                    self.benchmark_config["digital_ocr_diacritics"].get(
                        "max_samples",
                        1000,
                    ),
                )
                init_datasets.append(
                    dataset(
                        hf_name=self.benchmark_config["digital_ocr_diacritics"][
                            "hf_name"
                        ],
                        test_split=self.benchmark_config["digital_ocr_diacritics"][
                            "test_split"
                        ],
                        max_samples=max_samples,
                        cache_dir=self.benchmark_config.get("cache_dir", None),
                    ),
                )
            elif dataset.name == "chartqa":
                max_samples = self.benchmark_config.get("max_samples_per_dataset", None)
                max_samples = min(
                    max_samples,
                    self.benchmark_config["chartqa"].get("max_s
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

### Incident Patch 8: `665d7d8c` (2025-06-12)
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

### Incident Patch 9: `3a1b3875` (2025-06-12)
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

### Incident Patch 10: `85250dd4` (2025-06-03)
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
