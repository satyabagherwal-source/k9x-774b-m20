# Forensic Learning Record (Deep Inspection): Cinnamon/kotaemon

> **Canonical Artifact**: `07_PROJECT_LEARNING/cinnamon-kotaemon-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Cinnamon/kotaemon](https://github.com/Cinnamon/kotaemon))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:29:27.083Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Cinnamon/kotaemon`
- **Description**: An open-source RAG-based tool for chatting with your documents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 25795 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `libs/kotaemon/kotaemon/agents/utils.py`
```
from kotaemon.base import Document


def get_plugin_response_content(output) -> str:
    """
    Wrapper for AgentOutput content return
    """
    if isinstance(output, Document):
        return output.text
    else:
        return str(output)


def calculate_cost(model_name: str, prompt_token: int, completion_token: int) -> float:
    """
    Calculate the cost of a prompt and completion.

    Returns:
        float: Cost of the provided model name with provided token information
    """
    # TODO: to be implemented
    return 0.0

```

### Core Architecture Module: `libs/kotaemon/kotaemon/indices/qa/utils.py`
```
from difflib import SequenceMatcher


def find_text(search_span, context, min_length=5):
    search_span, context = search_span.lower(), context.lower()

    sentence_list = search_span.split("\n")
    context = context.replace("\n", " ")

    matches_span = []
    # don't search for small text
    if len(search_span) > min_length:
        for sentence in sentence_list:
            match_results = SequenceMatcher(
                None,
                sentence,
                context,
                autojunk=False,
            ).get_matching_blocks()

            matched_blocks = []
            for _, start, length in match_results:
                if length > max(len(sentence) * 0.25, min_length):
                    matched_blocks.append((start, start + length))

            if matched_blocks:
                start_index = min(start for start, _ in matched_blocks)
                end_index = max(end for _, end in matched_blocks)
                length = end_index - start_index

                if length > max(len(sentence) * 0.35, min_length):
                    matches_span.append((start_index, end_index))

    if matches_span:
        # merge all matches into one span
        final_span = min(start for start, _ in matches_span), max(
            end for _, end in matches_span
        )
        matches_span = [final_span]

    return matches_span


def find_start_end_phrase(
    start_phrase, end_phrase, context, min_length=5, max_excerpt_length=300
):
    start_phrase, end_phrase = start_phrase.lower(), end_phrase.lower()
    context = context.lower()

    context = context.replace("\n", " ")

    matches = []
    matched_length = 0
    for sentence in [start_phrase, end_phrase]:
        if sentence is None:
            continue

        match = SequenceMatcher(
            None, sentence, context, autojunk=False
        ).find_longest_match()
        if match.size > max(len(sentence) * 0.35, min_length):
            matches.append((match.b, match.b + match.size))
            matched_length += match.size

    # check if second match is before the first match
    if len(matches) == 2 and matches[1][0] < matches[0][0]:
        # if so, keep only the first match
        matches = [matches[0]]

    if matches:
        start_idx = min(start for start, _ in matches)
        end_idx = max(end for _, end in matches)

        # check if the excerpt is too long
        if end_idx - start_idx > max_excerpt_length:
            end_idx = start_idx + max_excerpt_length

        final_match = (start_idx, end_idx)
    else:
        final_match = None

    return final_match, matched_length


def replace_think_tag_with_details(text):
    text = text.replace(
        "<think>",
        '<details><summary><span style="color:grey">Thought</span></summary><blockquote>',  # noqa
    )
    text = text.replace("</think>", "</blockquote></details>")
    return text


def strip_think_tag(text):
    if "</think>" in text:
        text = text.split("</think>")[1]
    return text

```

### Core Architecture Module: `libs/kotaemon/kotaemon/loaders/utils/adobe.py`
```
# need pip install pdfservices-sdk==2.3.0

import base64
import json
import logging
import os
import tempfile
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Union

import pandas as pd
from decouple import config

from kotaemon.loaders.utils.gpt4v import generate_gpt4v


def request_adobe_service(file_path: str, output_path: str = "") -> str:
    """Main function to call the adobe service, and unzip the results.
    Args:
        file_path (str): path to the pdf file
        output_path (str): path to store the results

    Returns:
        output_path (str): path to the results

    """
    try:
        from adobe.pdfservices.operation.auth.credentials import Credentials
        from adobe.pdfservices.operation.exception.exceptions import (
            SdkException,
            ServiceApiException,
            ServiceUsageException,
        )
        from adobe.pdfservices.operation.execution_context import ExecutionContext
        from adobe.pdfservices.operation.io.file_ref import FileRef
        from adobe.pdfservices.operation.pdfops.extract_pdf_operation import (
            ExtractPDFOperation,
        )
        from adobe.pdfservices.operation.pdfops.options.extractpdf.extract_element_type import (  # noqa: E501
            ExtractElementType,
        )
        from adobe.pdfservices.operation.pdfops.options.extractpdf.extract_pdf_options import (  # noqa: E501
            ExtractPDFOptions,
        )
        from adobe.pdfservices.operation.pdfops.options.extractpdf.extract_renditions_element_type import (  # noqa: E501
            ExtractRenditionsElementType,
        )
    except ImportError:
        raise ImportError(
            "pdfservices-sdk is not installed. "
            "Please install it by running `pip install pdfservices-sdk"
            "@git+https://github.com/niallcm/pdfservices-python-sdk.git"
            "@bump-and-unfreeze-requirements`"
        )

    if not output_path:
        output_path = tempfile.mkdtemp()

    try:
        # Initial setup, create credentials instance.
        credentials = (
            Credentials.service_principal_credentials_builder()
            .with_client_id(config("PDF_SERVICES_CLIENT_ID", default=""))
            .with_client_secret(config("PDF_SERVICES_CLIENT_SECRET", default=""))
            .build()
        )

        # Create an ExecutionContext using credentials
        # and create a new operation instance.
        execution_context = ExecutionContext.create(credentials)
        extract_pdf_operation = ExtractPDFOperation.create_new()

        # Set operation input from a source file.
        source = FileRef.create_from_local_file(file_path)
        extract_pdf_operation.set_input(source)

        # Build ExtractPDF options and set them into the operation
        extract_pdf_options: ExtractPDFOptions = (
            ExtractPDFOptions.builder()
            .with_elements_to_extract(
                [ExtractElementType.TEXT, ExtractElementType.TABLES]
            )
            .with_elements_to_extract_renditions(
                [
                    ExtractRenditionsElementType.TABLES,
                    ExtractRenditionsElementType.FIGURES,
                ]
            )
            .build()
        )
        extract_pdf_operation.set_options(extract_pdf_options)

        # Execute the operation.
        result: FileRef = extract_pdf_operation.execute(execution_context)

        # Save the result to the specified location.
        zip_file_path = os.path.join(
            output_path, "ExtractTextTableWithFigureTableRendition.zip"
        )
        result.save_as(zip_file_path)
        # Open the ZIP file
        with zipfile.ZipFile(zip_file_path, "r") as zip_ref:
            # Extract all contents to the destination folder
            zip_ref.extractall(output_path)
    except (ServiceApiException, ServiceUsageException, SdkException):
        logging.exception("Exception encountered while executing operation")

    return output_path


def make_markdown_table(table_as_list: List[List[str]]) -> str:
    """
    Convert table from python list representation to markdown format.
    The input list consists of rows of tables, the first row is the header.

    Args:
        table_as_list: list of table rows
            Example: [["Name", "Age", "Height"],
                    ["Jake", 20, 5'10],
                    ["Mary", 21, 5'7]]
    Returns:
        markdown representation of the table
    """
    markdown = "\n" + str("| ")

    for e in table_as_list[0]:
        to_add = " " + str(e) + str(" |")
        markdown += to_add
    markdown += "\n"

    markdown += "| "
    for i in range(len(table_as_list[0])):
        markdown += str("--- | ")
    markdown += "\n"

    for entry in table_as_list[1:]:
        markdown += str("| ")
        for e in entry:
            to_add = str(e) + str(" | ")
            markdown += to_add
        markdown += "\n"

    return markdown + "\n"


def load_json(input_path: Union[str | Path]) -> dict:
    """Load json file"""
    with open(input_path, "r") as fi:
        data = json.load(fi)

    return data


def load_excel(input_path: Union[str | Path]) -> str:
    """Load excel file and convert to markdown"""

    df = pd.read_excel(input_path).fillna("")
    # Convert dataframe to a list of rows
    row_list = [df.columns.values.tolist()] + df.values.tolist()

    for item_id, item in enumerate(row_list[0]):
        if "Unnamed" in item:
            row_list[0][item_id] = ""

    for row in row_list:
        for item_id, item in enumerate(row):
            row[item_id] = str(item).replace("_x000D_", " ").replace("\n", " ").strip()

    markdown_str = make_markdown_table(row_list)
    return markdown_str


def encode_image_base64(image_path: Union[str | Path]) -> Union[bytes, str]:
    """Convert image to base64"""

    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


def parse_table_paths(file_paths: List[Path]) -> str:
    """Read the table stored in an excel file given the file path"""

    content = ""
    for path in file_paths:
        if path.suffix == ".xlsx":
            content = load_excel(path)
            break
    return content


def parse_figure_paths(file_paths: List[Path]) -> Union[bytes, str]:
    """Read and convert an image to base64 given the image path"""

    content = ""
    for path in file_paths:
        if path.suffix == ".png":
            base64_image = encode_image_base64(path)
            content = f"data:image/png;base64,{base64_image}"  # type: ignore
            break
    return content


def generate_single_figure_caption(vlm_endpoint: str, figure: str) -> str:
    output = ""

    """Summarize a single figure using GPT-4V"""
    if figure:
        try:
            output = generate_gpt4v(
                endpoint=vlm_endpoint,
                prompt="Provide a short 2 sentence summary of this image?",
                images=figure,
            )
            if "sorry" in output.lower():
                output = ""
        except Exception as e:
            print(f"Error generating caption: {e}")

    return output


def generate_figure_captions(
    vlm_endpoint: str, figures: List, max_figures_to_process: int
) -> List:
    """Summarize several figures using GPT-4V.
    Args:
        vlm_endpoint (str): endpoint to the vision language model service
        figures (List): list of base64 images
        max_figures_to_process (int): the maximum number of figures will be summarized,
        the rest are ignored.

    Returns:
        results (List[str]): list of all figure captions and empty strings for
        ignored figures.
    """
    to_gen_figures = figures[:max_figures_to_process]
    other_figures = figures[max_figures_to_process:]

    with ThreadPoolExecutor() as executor:
        futures = [
            executor.submit(
                lambda: generate_single_figure_caption(vlm_endpoint, figure)
            )
            for figure in to_gen_figures
        ]

    results = [future.result() for future in futures]
    return results + [""] * len(other_figures)

```

### Core Architecture Module: `libs/kotaemon/kotaemon/loaders/utils/box.py`
```
from typing import List, Tuple


def bbox_to_points(box: List[int]):
    """Convert bounding box to list of points"""
    x1, y1, x2, y2 = box
    return [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]


def points_to_bbox(points: List[Tuple[int, int]]):
    """Convert list of points to bounding box"""
    all_x = [p[0] for p in points]
    all_y = [p[1] for p in points]
    return [min(all_x), min(all_y), max(all_x), max(all_y)]


def scale_points(points: List[Tuple[int, int]], scale_factor: float = 1.0):
    """Scale points by a scale factor"""
    return [(int(pos[0] * scale_factor), int(pos[1] * scale_factor)) for pos in points]


def union_points(points: List[Tuple[int, int]]):
    """Return union bounding box of list of points"""
    all_x = [p[0] for p in points]
    all_y = [p[1] for p in points]
    bbox = (min(all_x), min(all_y), max(all_x), max(all_y))
    return bbox


def scale_box(box: List[int], scale_factor: float = 1.0):
    """Scale box by a scale factor"""
    return [int(pos * scale_factor) for pos in box]


def box_h(box: List[int]):
    "Return box height"
    return box[3] - box[1]


def box_w(box: List[int]):
    "Return box width"
    return box[2] - box[0]


def box_area(box: List[int]):
    "Return box area"
    x1, y1, x2, y2 = box
    return (x2 - x1) * (y2 - y1)


def get_rect_iou(gt_box: List[tuple], pd_box: List[tuple], iou_type=0) -> int:
    """Intersection over union on layout rectangle

    Args:
        gt_box: List[tuple]
            A list contains bounding box coordinates of ground truth
        pd_box: List[tuple]
            A list contains bounding box coordinates of prediction
        iou_type: int
            0: intersection / union, normal IOU
            1: intersection / min(areas), useful when boxes are under/over-segmented

        Input format: [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
        Annotation for each element in bbox:
        (x1, y1)        (x2, y1)
            +-------+
            |       |
            |       |
            +-------+
        (x1, y2)        (x2, y2)

    Returns:
        Intersection over union value
    """

    assert iou_type in [0, 1], "Only support 0: origin iou, 1: intersection / min(area)"

    # determine the (x, y)-coordinates of the intersection rectangle
    # gt_box: [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
    # pd_box: [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]
    x_left = max(gt_box[0][0], pd_box[0][0])
    y_top = max(gt_box[0][1], pd_box[0][1])
    x_right = min(gt_box[2][0], pd_box[2][0])
    y_bottom = min(gt_box[2][1], pd_box[2][1])

    # compute the area of intersection rectangle
    interArea = max(0, x_right - x_left) * max(0, y_bottom - y_top)

    # compute the area of both the prediction and ground-truth
    # rectangles
    gt_area = (gt_box[2][0] - gt_box[0][0]) * (gt_box[2][1] - gt_box[0][1])
    pd_area = (pd_box[2][0] - pd_box[0][0]) * (pd_box[2][1] - pd_box[0][1])

    # compute the intersection over union by taking the intersection
    # area and dividing it by the sum of prediction + ground-truth
    # areas - the intersection area
    if iou_type == 0:
        iou = interArea / float(gt_area + pd_area - interArea)
    elif iou_type == 1:
        iou = interArea / max(min(gt_area, pd_area), 1)

    # return the intersection over union value
    return iou


def sort_funsd_reading_order(lines: List[dict], box_key_name: str = "box"):
    """Sort cell list to create the right reading order using their locations

    Args:
        lines: list of cells to sort

    Returns:
        a list of cell lists in the right reading order that contain
        no key or start with a key and contain no other key
    """
    sorted_list = []

    if len(lines) == 0:
        return lines

    while len(lines) > 1:
        topleft_line = lines[0]
        for line in lines[1:]:
            topleft_line_pos = topleft_line[box_key_name]
            topleft_line_center_y = (topleft_line_pos[1] + topleft_line_pos[3]) / 2
            x1, y1, x2, y2 = line[box_key_name]
            box_center_x = (x1 + x2) / 2
            box_center_y = (y1 + y2) / 2
            cell_h = y2 - y1
            if box_center_y <= topleft_line_center_y - cell_h / 2:
                topleft_line = line
                continue
            if (
                box_center_x < topleft_line_pos[2]
                and box_center_y < topleft_line_pos[3]
            ):
                topleft_line = line
                continue
        sorted_list.append(topleft_line)
        lines.remove(topleft_line)

    sorted_list.append(lines[0])

    return sorted_list

```

### Core Architecture Module: `libs/kotaemon/kotaemon/loaders/utils/gpt4v.py`
```
import json
import logging
from typing import Any, List

import requests
from decouple import config

logger = logging.getLogger(__name__)


def generate_gpt4v(
    endpoint: str,
    images: str | List[str],
    prompt: str,
    max_tokens: int = 512,
    max_images: int = 10,
) -> str:
    # OpenAI API Key
    api_key = config("AZURE_OPENAI_API_KEY", default="")
    headers = {"Content-Type": "application/json", "api-key": api_key}

    if isinstance(images, str):
        images = [images]

    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                ]
                + [
                    {
                        "type": "image_url",
                        "image_url": {"url": image},
                    }
                    for image in images[:max_images]
                ],
            }
        ],
        "max_tokens": max_tokens,
        "temperature": 0,
    }

    if len(images) > max_images:
        print(f"Truncated to {max_images} images (original {len(images)} images")

    response = requests.post(endpoint, headers=headers, json=payload)

    try:
        response.raise_for_status()
    except Exception as e:
        logger.exception(f"Error generating gpt4v: {response.text}; error {e}")
        return ""

    output = response.json()
    output = output["choices"][0]["message"]["content"]
    return output


def stream_gpt4v(
    endpoint: str,
    images: str | List[str],
    prompt: str,
    max_tokens: int = 512,
    max_images: int = 10,
) -> Any:
    # OpenAI API Key
    api_key = config("AZURE_OPENAI_API_KEY", default="")
    headers = {"Content-Type": "application/json", "api-key": api_key}

    if isinstance(images, str):
        images = [images]

    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                ]
                + [
                    {
                        "type": "image_url",
                        "image_url": {"url": image},
                    }
                    for image in images[:max_images]
                ],
            }
        ],
        "max_tokens": max_tokens,
        "stream": True,
        "logprobs": True,
        "temperature": 0,
    }
    if len(images) > max_images:
        print(f"Truncated to {max_images} images (original {len(images)} images")
    try:
        response = requests.post(endpoint, headers=headers, json=payload, stream=True)
        assert response.status_code == 200, str(response.content)
        output = ""
        logprobs = []
        for line in response.iter_lines():
            if line:
                if line.startswith(b"\xef\xbb\xbf"):
                    line = line[9:]
                else:
                    line = line[6:]
                try:
                    if line == "[DONE]":
                        break
                    line = json.loads(line.decode("utf-8"))
                except Exception:
                    break
                if len(line["choices"]):
                    if line["choices"][0].get("logprobs") is None:
                        _logprobs = []
                    else:
                        _logprobs = [
                            logprob["logprob"]
                            for logprob in line["choices"][0]["logprobs"].get(
                                "content", []
                            )
                        ]

                    output += line["choices"][0]["delta"].get("content", "")
                    logprobs += _logprobs
                    yield line["choices"][0]["delta"].get("content", ""), _logprobs

    except Exception as e:
        logger.error(f"Error streaming gpt4v {e}")
        logprobs = []
        output = ""

    return output, logprobs

```

### Core Architecture Module: `libs/kotaemon/kotaemon/loaders/utils/pdf_ocr.py`
```
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Union

from .box import (
    bbox_to_points,
    box_area,
    box_h,
    box_w,
    get_rect_iou,
    points_to_bbox,
    scale_box,
    scale_points,
    sort_funsd_reading_order,
    union_points,
)
from .table import table_cells_to_markdown

IOU_THRES = 0.5
PADDING_THRES = 1.1


def read_pdf_unstructured(input_path: Union[Path, str]):
    """Convert PDF from specified path to list of text items with
    location information

    Args:
        input_path: path to input file

    Returns:
        Dict page_number: list of text boxes
    """
    try:
        from unstructured.partition.auto import partition
    except ImportError as e:
        raise ImportError(
            "Please install unstructured PDF reader `pip install unstructured[pdf]`: "
            f"{e}"
        )

    page_items = defaultdict(list)
    items = partition(input_path)
    for item in items:
        page_number = item.metadata.page_number
        bbox = points_to_bbox(item.metadata.coordinates.points)
        coord_system = item.metadata.coordinates.system
        max_w, max_h = coord_system.width, coord_system.height
        page_items[page_number - 1].append(
            {
                "text": item.text,
                "box": bbox,
                "location": bbox_to_points(bbox),
                "page_shape": (max_w, max_h),
            }
        )

    return page_items


def merge_ocr_and_pdf_texts(
    ocr_list: List[dict], pdf_text_list: List[dict], debug_info=None
):
    """Merge PDF and OCR text using IOU overlapping location
    Args:
        ocr_list: List of OCR items {"text", "box", "location"}
        pdf_text_list: List of PDF items {"text", "box", "location"}

    Returns:
        Combined list of PDF text and non-overlap OCR text
    """
    not_matched_ocr = []

    # check for debug info
    if debug_info is not None:
        cv2, debug_im = debug_info

    for ocr_item in ocr_list:
        matched = False
        for pdf_item in pdf_text_list:
            if (
                get_rect_iou(ocr_item["location"], pdf_item["location"], iou_type=1)
                > IOU_THRES
            ):
                matched = True
                break

        color = (255, 0, 0)
        if not matched:
            ocr_item["matched"] = False
            not_matched_ocr.append(ocr_item)
            color = (0, 255, 255)

        if debug_info is not None:
            cv2.rectangle(
                debug_im,
                ocr_item["location"][0],
                ocr_item["location"][2],
                color=color,
                thickness=1,
            )

    if debug_info is not None:
        for pdf_item in pdf_text_list:
            cv2.rectangle(
                debug_im,
                pdf_item["location"][0],
                pdf_item["location"][2],
                color=(0, 255, 0),
                thickness=2,
            )

    return pdf_text_list + not_matched_ocr


def merge_table_cell_and_ocr(
    table_list: List[dict], ocr_list: List[dict], pdf_list: List[dict], debug_info=None
):
    """Merge table items with OCR text using IOU overlapping location
    Args:
        table_list: List of table items
            "type": ("table", "cell", "text"), "text", "box", "location"}
        ocr_list: List of OCR items {"text", "box", "location"}
        pdf_list: List of PDF items {"text", "box", "location"}

    Returns:
        all_table_cells: List of tables, each of table is represented
            by list of cells with combined text from OCR
        not_matched_items: List of PDF text which is not overlapped by table region
    """
    # check for debug info
    if debug_info is not None:
        cv2, debug_im = debug_info

    cell_list = [item for item in table_list if item["type"] == "cell"]
    table_list = [item for item in table_list if item["type"] == "table"]

    # sort table by area
    table_list = sorted(table_list, key=lambda item: box_area(item["bbox"]))

    all_tables = []
    matched_pdf_ids = []
    matched_cell_ids = []

    for table in table_list:
        if debug_info is not None:
            cv2.rectangle(
                debug_im,
                table["location"][0],
                table["location"][2],
                color=[0, 0, 255],
                thickness=5,
            )

        cur_table_cells = []
        for cell_id, cell in enumerate(cell_list):
            if cell_id in matched_cell_ids:
                continue

            if get_rect_iou(
                table["location"], cell["location"], iou_type=1
            ) > IOU_THRES and box_area(table["bbox"]) > box_area(cell["bbox"]):
                color = [128, 0, 128]
                # cell matched to table
                for item_list, item_type in [(pdf_list, "pdf"), (ocr_list, "ocr")]:
                    cell["ocr"] = []
                    for item_id, item in enumerate(item_list):
                        if item_type == "pdf" and item_id in matched_pdf_ids:
                            continue
                        if (
                            get_rect_iou(item["location"], cell["location"], iou_type=1)
                            > IOU_THRES
                        ):
                            cell["ocr"].append(item)
                            if item_type == "pdf":
                                matched_pdf_ids.append(item_id)

                    if len(cell["ocr"]) > 0:
                        # check if union of matched ocr does
                        # not extend over cell boundary,
                        # if True, continue to use OCR_list to match
                        all_box_points_in_cell = []
                        for item in cell["ocr"]:
                            all_box_points_in_cell.extend(item["location"])
                        union_box = union_points(all_box_points_in_cell)
                        cell_okay = (
                            box_h(union_box) <= box_h(cell["bbox"]) * PADDING_THRES
                            and box_w(union_box) <= box_w(cell["bbox"]) * PADDING_THRES
                        )
                    else:
                        cell_okay = False

                    if cell_okay:
                        if item_type == "pdf":
                            color = [255, 0, 255]
                        break

                if debug_info is not None:
                    cv2.rectangle(
                        debug_im,
                        cell["location"][0],
                        cell["location"][2],
                        color=color,
                        thickness=3,
                    )

                matched_cell_ids.append(cell_id)
                cur_table_cells.append(cell)

        all_tables.append(cur_table_cells)

    not_matched_items = [
        item for _id, item in enumerate(pdf_list) if _id not in matched_pdf_ids
    ]
    if debug_info is not None:
        for item in not_matched_items:
            cv2.rectangle(
                debug_im,
                item["location"][0],
                item["location"][2],
                color=[128, 128, 128],
                thickness=3,
            )

    return all_tables, not_matched_items


def parse_ocr_output(
    ocr_page_items: List[dict],
    pdf_page_items: Dict[int, List[dict]],
    artifact_path: Optional[str] = None,
    debug_path: Optional[str] = None,
):
    """Main function to combine OCR output and PDF text to
    form list of table / non-table regions
    Args:
        ocr_page_items: List of OCR items by page
        pdf_page_items: Dict of PDF texts (page number as key)
        debug_path: If specified, use OpenCV to plot debug image and save to debug_path
    """
    all_tables = []
    all_texts = []

    for page_id, page in enumerate(ocr_page_items):
        ocr_list = page["json"]["ocr"]
        table_list = page["json"]["table"]
        page_shape = page["image_shape"]
        pdf_item_list = pdf_page_items[page_id]

        # create bbox additional information
        for item in ocr_list:
            item["box"] = points_to_bbox(item["location"])

        # re-scale pdf items according to new image size
        for item in pdf_item_list:
            scale_factor = page_shape[0] / item["page_shape"][0]
            item["box"] = scale_box(item["box"], scale_factor=scale_factor)
            item["location"] = scale_points(item["location"], scale_factor=scale_factor)

        # if using debug mode, openCV must be installed
        if debug_path and artifact_path is not None:
            try:
                import cv2
            except ImportError:
                raise ImportError(
                    "Please install openCV first to use OCRReader debug mode"
                )
            image_path = Path(artifact_path) / page["image"]
            image = cv2.imread(str(image_path))
            debug_info = (cv2, image)
        else:
            debug_info = None

        new_pdf_list = merge_ocr_and_pdf_texts(
            ocr_list, pdf_item_list, debug_info=debug_info
        )

        # sort by reading order
        ocr_list = sort_funsd_reading_order(ocr_list)
        new_pdf_list = sort_funsd_reading_order(new_pdf_list)

        all_table_cells, non_table_text_list = merge_table_cell_and_ocr(
            table_list, ocr_list, new_pdf_list, debug_info=debug_info
        )

        table_texts = [table_cells_to_markdown(cells) for cells in all_table_cells]
        all_tables.extend([(page_id, text) for text in table_texts])
        all_texts.append(
            (page_id, " ".join(item["text"] for item in non_table_text_list))
        )

        # export debug image to debug_path
        if debug_path:
            cv2.imwrite(str(Path(debug_path) / "page_{}.png".format(page_id)), image)

    return all_tables, all_texts

```

### Core Architecture Module: `libs/kotaemon/kotaemon/loaders/utils/table.py`
```
import csv
from io import StringIO
from typing import List, Optional, Tuple

from .box import get_rect_iou


def check_col_conflicts(
    col_a: List[str], col_b: List[str], thres: float = 0.15
) -> bool:
    """Check if 2 columns A and B has non-empty content in the same row
    (to be used with merge_cols)

    Args:
        col_a: column A (list of str)
        col_b: column B (list of str)
        thres: percentage of overlapping allowed
    Returns:
        if number of overlapping greater than threshold
    """
    num_rows = len([cell for cell in col_a if cell])
    assert len(col_a) == len(col_b)
    conflict_count = 0
    for cell_a, cell_b in zip(col_a, col_b):
        if cell_a and cell_b:
            conflict_count += 1
    return conflict_count > num_rows * thres


def merge_cols(col_a: List[str], col_b: List[str]) -> List[str]:
    """Merge column A and B if they do not have conflict rows

    Args:
        col_a: column A (list of str)
        col_b: column B (list of str)
    Returns:
        merged column
    """
    for r_id in range(len(col_a)):
        if col_b[r_id]:
            col_a[r_id] = col_a[r_id] + " " + col_b[r_id]
    return col_a


def add_index_col(csv_rows: List[List[str]]) -> List[List[str]]:
    """Add index column as the first column of the table csv_rows

    Args:
        csv_rows: input table
    Returns:
        output table with index column
    """
    new_csv_rows = [["row id"] + [""] * len(csv_rows[0])]
    for r_id, row in enumerate(csv_rows):
        new_csv_rows.append([str(r_id + 1)] + row)
    return new_csv_rows


def compress_csv(csv_rows: List[List[str]]) -> List[List[str]]:
    """Compress table csv_rows by merging sparse columns (merge_cols)

    Args:
        csv_rows: input table
    Returns:
        output: compressed table
    """
    csv_cols = [[r[c_id] for r in csv_rows] for c_id in range(len(csv_rows[0]))]
    to_remove_col_ids = []
    last_c_id = 0
    for c_id in range(1, len(csv_cols)):
        if not check_col_conflicts(csv_cols[last_c_id], csv_cols[c_id]):
            to_remove_col_ids.append(c_id)
            csv_cols[last_c_id] = merge_cols(csv_cols[last_c_id], csv_cols[c_id])
        else:
            last_c_id = c_id

    csv_cols = [r for c_id, r in enumerate(csv_cols) if c_id not in to_remove_col_ids]
    csv_rows = [[c[r_id] for c in csv_cols] for r_id in range(len(csv_cols[0]))]
    return csv_rows


def get_table_from_ocr(ocr_list: List[dict], table_list: List[dict]):
    """Get list of text lines belong to table regions specified by table_list

    Args:
        ocr_list: list of OCR output in Casia format (Flax)
        table_list: list of table output in Casia format (Flax)

    Returns:
        _type_: _description_
    """
    table_texts = []
    for table in table_list:
        if table["type"] != "table":
            continue
        cur_table_texts = []
        for ocr in ocr_list:
            _iou = get_rect_iou(table["location"], ocr["location"], iou_type=1)
            if _iou > 0.8:
                cur_table_texts.append(ocr["text"])
        table_texts.append(cur_table_texts)

    return table_texts


def make_markdown_table(array: List[List[str]]) -> str:
    """Convert table rows in list format to markdown string

    Args:
        Python list with rows of table as lists
        First element as header.
        Example Input:
                [["Name", "Age", "Height"],
                ["Jake", 20, 5'10],
                ["Mary", 21, 5'7]]
    Returns:
        String to put into a .md file
    """
    array = compress_csv(array)
    array = add_index_col(array)
    markdown = "\n" + str("| ")

    for e in array[0]:
        to_add = " " + str(e) + str(" |")
        markdown += to_add
    markdown += "\n"

    markdown += "| "
    for i in range(len(array[0])):
        markdown += str("--- | ")
    markdown += "\n"

    for entry in array[1:]:
        markdown += str("| ")
        for e in entry:
            to_add = str(e) + str(" | ")
            markdown += to_add
        markdown += "\n"

    return markdown + "\n"


def parse_csv_string_to_list(csv_str: str) -> List[List[str]]:
    """Convert CSV string to list of rows

    Args:
        csv_str: input CSV string

    Returns:
        Output table in list format
    """
    io = StringIO(csv_str)
    csv_reader = csv.reader(io, delimiter=",")
    rows = [row for row in csv_reader]
    return rows


def format_cell(cell: str, length_limit: Optional[int] = None) -> str:
    """Format cell content by remove redundant character and enforce length limit

    Args:
        cell: input cell text
        length_limit: limit of text length.

    Returns:
        new cell text
    """
    cell = cell.replace("\n", " ")
    if length_limit:
        cell = cell[:length_limit]
    return cell


def extract_tables_from_csv_string(
    csv_content: str, table_texts: List[List[str]]
) -> Tuple[List[str], str]:
    """Extract list of table from FullOCR output
    (csv_content) with the specified table_texts

    Args:
        csv_content: CSV output from FullOCR pipeline
        table_texts: list of table texts extracted
        from get_table_from_ocr()

    Returns:
        List of tables and non-text content
    """
    rows = parse_csv_string_to_list(csv_content)
    used_row_ids = []
    table_csv_list = []
    for table in table_texts:
        cur_rows = []
        for row_id, row in enumerate(rows):
            scores = [
                any(cell in cell_reference for cell in table)
                for cell_reference in row
                if cell_reference
            ]
            score = sum(scores) / len(scores)
            if score > 0.5 and row_id not in used_row_ids:
                used_row_ids.append(row_id)
                cur_rows.append([format_cell(cell) for cell in row])
        if cur_rows:
            table_csv_list.append(make_markdown_table(cur_rows))
        else:
            print("table not matched", table)

    non_table_rows = [
        row for row_id, row in enumerate(rows) if row_id not in used_row_ids
    ]
    non_table_text = "\n".join(
        " ".join(format_cell(cell) for cell in row) for row in non_table_rows
    )
    return table_csv_list, non_table_text


def strip_special_chars_markdown(text: str) -> str:
    """Strip special characters from input text in markdown table format"""
    return text.replace("|", "").replace(":---:", "").replace("---", "")


def parse_markdown_text_to_tables(text: str) -> Tuple[List[str], List[str]]:
    """Convert markdown text to list of non-table spans and table spans

    Args:
        text: input markdown text

    Returns:
        list of table spans and non-table spans
    """
    # init empty tables and texts list
    tables = []
    texts = []

    # split input by line break
    lines = text.split("\n")
    cur_table = []
    cur_text: List[str] = []
    for line in lines:
        line = line.strip()
        if line.startswith("|"):
            if len(cur_text) > 0:
                texts.append(cur_text)
                cur_text = []
            cur_table.append(line)
        else:
            # add new table to the list
            if len(cur_table) > 0:
                tables.append(cur_table)
                cur_table = []
            cur_text.append(line)

    table_texts = ["\n".join(table) for table in tables]
    non_table_texts = ["\n".join(text) for text in texts]
    return table_texts, non_table_texts


def table_cells_to_markdown(cells: List[dict]):
    """Convert list of cells with attached text to Markdown table"""

    if len(cells) == 0:
        return ""

    all_row_ids = []
    all_col_ids = []
    for cell in cells:
        all_row_ids.extend(cell["rows"])
        all_col_ids.extend(cell["columns"])

    num_rows, num_cols = max(all_row_ids) + 1, max(all_col_ids) + 1
    table_rows = [["" for c in range(num_cols)] for r in range(num_rows)]

    # start filling in the grid
    for cell in cells:
        cell_text = " ".join(item["text"] for item in cell["ocr"])
        start_row_id, end_row_id = cell["rows"]
        start_col_id, end_col_id = cell["columns"]
        span_cell = end_row_id != start_row_id or end_col_id != start_col_id

        # do not repeat long text in span cell to prevent context length issue
        if span_cell and len(cell_text.replace(" ", "")) < 20 and start_row_id > 0:
            for row in range(start_row_id, end_row_id + 1):
                for col in range(start_col_id, end_col_id + 1):
                    table_rows[row][col] += cell_text + " "
        else:
            table_rows[start_row_id][start_col_id] += cell_text + " "

    return make_markdown_table(table_rows)

```

### Core Architecture Module: `libs/ktem/ktem/db/engine.py`
```
from sqlmodel import create_engine
from theflow.settings import settings

engine = create_engine(settings.KH_DATABASE)

```

### Core Architecture Module: `libs/ktem/ktem/index/file/utils.py`
```
import os

import requests

# regex patterns for Arxiv URL
ARXIV_URL_PATTERNS = [
    "https://arxiv.org/abs/",
    "https://arxiv.org/pdf/",
]

ILLEGAL_NAME_CHARS = ["\\", "/", ":", "*", "?", '"', "<", ">", "|"]


def clean_name(name):
    for char in ILLEGAL_NAME_CHARS:
        name = name.replace(char, "_")
    return name


def is_arxiv_url(url):
    return any(url.startswith(pattern) for pattern in ARXIV_URL_PATTERNS)


# download PDF from Arxiv URL
def download_arxiv_pdf(url, output_path):
    if not is_arxiv_url(url):
        raise ValueError("Invalid Arxiv URL")

    is_abstract_url = "abs" in url
    if is_abstract_url:
        pdf_url = url.replace("abs", "pdf")
        abstract_url = url
    else:
        pdf_url = url
        abstract_url = url.replace("pdf", "abs")

    # get paper name from abstract url
    response = requests.get(abstract_url)

    # parse HTML response and get h1.title
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(response.content, "html.parser")
    name = clean_name(
        soup.find("h1", class_="title").text.strip().replace("Title:", "")
    )
    if not name:
        raise ValueError("Failed to get paper name")

    output_file_path = os.path.join(output_path, name + ".pdf")
    # prevent downloading if file already exists
    if not os.path.exists(output_file_path):
        response = requests.get(pdf_url)

        with open(output_file_path, "wb") as f:
            f.write(response.content)

    return output_file_path

```

### Core Architecture Module: `libs/ktem/ktem/utils/__init__.py`
```
from .conversation import (
    format_mentions_for_display,
    get_mentions_regex,
    get_urls,
    prepare_llm_query,
    strip_display_mentions,
)
from .lang import SUPPORTED_LANGUAGE_MAP

__all__ = [
    "SUPPORTED_LANGUAGE_MAP",
    "format_mentions_for_display",
    "get_mentions_regex",
    "get_urls",
    "prepare_llm_query",
    "strip_display_mentions",
]

```

### Core Architecture Module: `libs/ktem/ktem/utils/commands.py`
```
WEB_SEARCH_COMMAND = "WebSearch"

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #843** (2026-06-29): **[BUG]**
  *Symptoms*: ### Description  d  ### Reproduction steps  ```bash 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error d ```  ### Screenshots  ```bash <img width="1521" height="161" alt="image" src="https://github.com/user-attachments/assets/335056ce-aed3-43b8-8a34-8b69a93b210c" /> ```  ### Logs  ```bash  ```  ### Browsers  _No response_  ### OS  _No response_  ### Additional information  _No response_

- **Issue #842** (2026-06-29): **[Security] Unauthenticated RCE via Insecure Deserialization in /check_connection endpoint**
  *Symptoms*: ### Description   ## Summary  An unsafe deserialization vulnerability in the `/check_connection` Gradio API endpoint allows any unauthenticated attacker to execute arbitrary operating system commands on the server with the privileges of the application process. No credentials, session cookies, or API keys of any kind are required. The vulnerability exists because all Gradio event-handler endpoints are publicly reachable regardless of the application's login UI, and the endpoint deserializes attacker-controlled YAML/JSON into arbitrary Python classes using `importlib.import_module` + `getattr`.  - **Severity:** Critical (CVSS 3.1 score 10.0) - **Vector:** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H`  ---  ## Details  ### Root Cause 1 — Gradio architectural bypass (no server-side auth enforcement)  `libs/ktem/ktem/main.py`, lines 127–189: Access control is implemented as UI tab visibility toggling in `toggle_login_visibility()`. When a user is not logged in, the chat/settings tabs are hidden in the browser, but all 361 Gradio `fn=` event-handler endpoints remain callable as `HTTP POST /run/predict` or via the Gradio client SDK with no server-side gate. The application registers `check_connection` as a public API endpoint with no `user_id` input wired:  ```python # libs/ktem/ktem/llms/ui.py  lines 243-245 self._check_connection_btn.click(     self.check_connection,     inputs=[self.selected_llm_name, self.edit_spec],   # ← no user_id     ... ) ```  A grep of the entire `llms/u

- **Issue #810** (2026-02-10): **[BUG] .env modification in container not take effect**
  *Symptoms*: ### Description  I modified the .env file in container's  /app like this <img width="1388" height="212" alt="Image" src="https://github.com/user-attachments/assets/060c15bb-ef56-4003-abc6-f267756279dc" /> And I test the config in the container to make sure it's alright.  <img width="1494" height="204" alt="Image" src="https://github.com/user-attachments/assets/33310798-043b-4430-b9c4-c2b3f9cd1489" />  But when I uploaded a pdf file for indexing, it seems that the /app/lib/embedding/openai.py is not using the config above. (I add this logging in the  /app/lib/embedding/openai.py)  <img width="1379" height="203" alt="Image" src="https://github.com/user-attachments/assets/6aa63e95-25cf-4105-a207-6c6bb0963b15" />  Did I miss something? Thanks.  ### Reproduction steps  ```bash 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error ```  ### Screenshots  ```bash ![DESCRIPTION](LINK.png) ```  ### Logs  ```bash  ```  ### Browsers  _No response_  ### OS  _No response_  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Never mind.  Just figured out that there is conflict between .env file and settings in web ui.

- **Issue #783** (2025-09-09): **[BUG] ERROR:ktem.index.file.pipelines:HTTP Error 403: Forbidden**
  *Symptoms*: ### Description  When running the standard Kotaemon Docker image with the command :  ``` docker run -e GRADIO_SERVER_NAME=0.0.0.0 -e GRADIO_SERVER_PORT=7860 -v ./ktem_app_data:/app/ktem_app_data -p 7860:7860 -it --rm ghcr.io/cinnamon/kotaemon:main-full ``` I get an error when trying upload an index a docx file.   ### Reproduction steps  ```bash Goto files Click to upload Select the docx file  upload result :   ❌ | IBMF-REQ-000012 - test_document_V0.docx: HTTP Error 403: Forbidden  Upload info:  Indexing [1/1]: IBMF-REQ-000012 - test_document_V0.docx  => Converting IBMF-REQ-000012 - test_document_V0.docx to text  ```  ### Logs  ```bash docker run -e GRADIO_SERVER_NAME=0.0.0.0 -e GRADIO_SERVER_PORT=7860 -v ./ktem_app_data:/app/ktem_app_data -p 7860:7860 -it --rm ghcr.io/cinnamon/kotaemon:main-full /app/launch.sh: 20: ollama: not found [nltk_data] Downloading package punkt_tab to [nltk_data]     /usr/local/lib/python3.10/site- [nltk_data]     packages/llama_index/core/_static/nltk_cache... [nltk_data]   Package punkt_tab is already up-to-date! Nano-GraphRAG dependencies not installed. Try `pip install nano-graphrag` to install. Nano-GraphRAG retriever pipeline will not work properly. INFO:chromadb.telemetry.product.posthog:Anonymized telemetry enabled. See                     https://docs.trychroma.com/telemetry for more information. INFO:kotaemon:posthog.capture called with args: ('91a3fa9d-32d1-446a-870a-0e11b1ef6385', 'ClientStartEvent', {'batch_size': 1, 'in_colab': False, '
  **Post-Mortem & Fix Analysis**:
  > I had the same issue and my workaround was to update the unstructured package in the container: `docker exec -it CONTAINER_NAME pip install --upgrade unstructured`
  > Big thanks, this solved this issue !!

- **Issue #769** (2025-08-09): **[BUG]  error after installation**
  *Symptoms*: ### Description  Starting Kotaemon UI... (prebuilt PDF.js is at C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\libs\ktem\ktem\assets\prebuilt\pdfjs-4.0.379-dist) Traceback (most recent call last):   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\app.py", line 14, in <module>     from ktem.main import App  # noqa   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\main.py", line 6, in <module>     from ktem.pages.resources import ResourcesTab   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\pages\resources\__init__.py", line 4, in <module>     from ktem.embeddings.ui import EmbeddingManagement   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\embeddings\ui.py", line 10, in <module>     from .manager import embedding_models_manager   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\embeddings\manager.py", line 216, in <module>     embedding_models_manager = EmbeddingManager()   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\embeddings\manager.py", line 34, in __init__     self.load()   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\embeddings\manager.py", line 45, in load     self._models[item.name] = deserialize(item.spec, safe=False)   File "C:\Users\massimo\Downl
  **Post-Mortem & Fix Analysis**:
  > I have the same problem on Ubuntu 24.04.2 LTS.
  > Resolved. Comment Voyageai in .env.
  > Could you please give more details on how you resolved this? Commented the voyageai lines in .env but issue persists.

- **Issue #725** (2025-04-03): **[BUG] deployment failed on huggingface space with the latest docker image**
  *Symptoms*: ### Description  I was trying to deploy the kotaemon using Huggingface space. However, after the update to the latest version (March 30). the build continues to fail on the space side. I tried main-full, main-lite, and feat-nltk-build-lite. All failed with code 137.  It looks like the Docker build is OOM during the exporting cache phase. I also tried to upgrade my space RAM (32GB), but it didn't work.    ### Reproduction steps  Here is my huggingface space [site](https://huggingface.co/spaces/WFRaain/ad_rag_gui/tree/main).   ### Logs  ```bash build error Job failed with exit code: 137  ===== Build Queued at 2025-04-03 01:39:30 / Commit SHA: 59f0ef5 =====  --> FROM ghcr.io/cinnamon/kotaemon:main-lite@sha256:80dc9b3e3f3e55129e8d8dac5f4c7762665572114d749d663c35354b8d66e624 DONE 5.9s  DONE 6.0s  DONE 6.1s  DONE 21.3s  DONE 24.8s  DONE 24.8s  --> RUN apt update -qqy && apt install -y --no-install-recommends     bash     curl     wget     procps     git     git-lfs &&     apt-get clean && rm -rf /var/lib/apt/lists/*  WARNING: apt does not have a stable CLI interface. Use with caution in scripts.  1 package can be upgraded. Run 'apt list --upgradable' to see it.  WARNING: apt does not have a stable CLI interface. Use with caution in scripts.  Reading package lists... Building dependency tree... Reading state information... bash is already the newest version (5.2.15-2+b7). bash set to manually installed. curl is already the newest version (7.88.1-10+deb12u12). procps is already the n
  **Post-Mortem & Fix Analysis**:
  > Seem weird. Might be just occasional HF space issue. I just duplicate the space https://huggingface.co/spaces/cin-model/kotaemon_template for testing and it works fine.
  > Thanks, it works now!

- **Issue #721** (2025-04-02): **[BUG] new docker main-ollama: ModuleNotFoundError: No module named 'lance'**
  *Symptoms*: ### Description  starting docker  ``` docker run \ -e GRADIO_SERVER_NAME=0.0.0.0 \ -e GRADIO_SERVER_PORT=7860 \ -e USE_LIGHTRAG=true \ -e USE_MS_GRAPHRAG=false \ -e USE_NANO_GRAPHRAG=false \ -e OPENAI_API_KEY=sk-... \ -e LOCAL_MODEL=qwen2.5:7b \ -e KH_OLLAMA_URL=http://host.docker.internal:11434/v1/ \ -e COHERE_API_KEY=0... \ -v ./ktem_app_data:/app/ktem_app_data \ -p 7860:7860 -it --rm \ ghcr.io/cinnamon/kotaemon:main-ollama ``` and uploading file gives an error: ModuleNotFoundError: No module named 'lance'   ### Reproduction steps  ```bash delete old docker stuff and provoke new download:   docker run \ -e GRADIO_SERVER_NAME=0.0.0.0 \ -e GRADIO_SERVER_PORT=7860 \ -e USE_LIGHTRAG=true \ -e USE_MS_GRAPHRAG=false \ -e USE_NANO_GRAPHRAG=false \ -e OPENAI_API_KEY=sk-... \ -e LOCAL_MODEL=qwen2.5:7b \ -e KH_OLLAMA_URL=http://host.docker.internal:11434/v1/ \ -e COHERE_API_KEY=0... \ -v ./ktem_app_data:/app/ktem_app_data \ -p 7860:7860 -it --rm \ ghcr.io/cinnamon/kotaemon:main-ollama   upload file to koteamon in Files/File Collection ```  ### Screenshots  ```bash ![DESCRIPTION](LINK.png) ```  ### Logs  ```bash ❯ docker run \ -e GRADIO_SERVER_NAME=0.0.0.0 \ -e GRADIO_SERVER_PORT=7860 \ -e USE_LIGHTRAG=true \ -e USE_MS_GRAPHRAG=false \ -e USE_NANO_GRAPHRAG=false \ -e OPENAI_API_KEY=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 \ -e LOCAL_MODEL=qwen2.5:7b \ -e KH_OLLAMA_URL=http://host.docker.internal:11434/v1/ \ -e COHERE_API_KEY=0wcJGpDBl68zCbuMzeCwshp38bJJr7zUgdc9F5rw \ -v ./k
  **Post-Mortem & Fix Analysis**:
  > the api keys are not a joke for 1st April... they are revoked 
  > @bennoloeffler this has been fixed in latest image. Please remove and pull new one.

- **Issue #715** (2025-03-31): **[BUG] fails to launch when building docker image**
  *Symptoms*: i noticed that the official image is a few months old and some versions behind the latest release  any tips on building for docker?  I'm using a workflow that pulls the dockerfile whenever a new release is pushed and builds the image, no modification just the full fat dockerfile   and i can't launch the docker image built from the dockerfile   running on arm64v8  full install of everything except graphrag(it's disabled for arm on the dockerfile but why, the app is super lightweight)?    ### Logs  [kotaemon.log (3).txt](https://github.com/user-attachments/files/19527064/kotaemon.log.3.txt)  here's the workflow script [build.kotaemon.yml.txt](https://github.com/user-attachments/files/19527058/build.kotaemon.yml.txt)
  **Post-Mortem & Fix Analysis**:
  > [kotaemon.log (3).txt](https://github.com/user-attachments/files/19527030/kotaemon.log.3.txt)   building with the provided dockerfile causes the image to not launch, any help is appreciated 🙏
  > @Fuckingnameless I will update a new Docker build soon with a new release.
  > Done

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

### Incident Patch 1: `9ad3e4e4` (2026-05-30)
**Commit Message**: feat: integrate PaddleOCR as document loaders + enhance chat/index UX (#814)

* docs: typo

* fix: enhance mention @ (file, websearch) in chat

* fix: shorter placeholder guide in chat

* fix: enhance UI (file filter, chunks preview, lightrag reader settings)

* feat: feat: integrate paddleocr (PaddleOCR-VL, PP-StructureV3)

* fix: import

* fix: support both urls and mention files when chatting

* feat: restore the test connection panel in resources

* fix: paddleocr output adapter

* tests: update

* fix: parse image block content

* fix: docker gpu stage for paddleocr

* tests: update unit tests

* tests: add skip_when_paddleocr_not_installed

* fix: reset chunk preview filter when re-selecting file

* fix: paddleocr[all] -> paddleocr[doc-parser]

* fix: allow configure paddleocr device with env

* feat: parameterize CUDA version in Dockerfile for paddlepaddle installation

* docs: add integration guides for PaddleOCR and Docling

* fix: updating mcp server must reflect in the tool choice UI

* fix: disable enable_mkldnn for cpu inference

* docs: update installation doc with uv

* fix: use chat_input_text for llm input instead of the UI display message

* fix: render file menti

**File**: `.env.example` (modified, +3/-0)
```diff
@@ -47,6 +47,9 @@ PDF_SERVICES_CLIENT_SECRET=
 # settings for PDF.js
 PDFJS_VERSION_DIST="pdfjs-4.0.379-dist"
 
+# settings for PaddleOCR
+PADDLE_DEVICE=gpu
+
 # variable for authentication method selection
 # for authentication with google leave empty
 # for authentication with keycloak :
```

**File**: `.pre-commit-config.yaml` (modified, +2/-1)
```diff
@@ -26,14 +26,15 @@ repos:
         args: ["--profile", "black"]
         language_version: python3.10
   - repo: https://github.com/pycqa/flake8
-    rev: 4.0.1
+    rev: 7.0.0
     hooks:
       - id: flake8
         args: ["--max-line-length", "88", "--extend-ignore", "E203"]
   - repo: https://github.com/myint/autoflake
     rev: v1.4
     hooks:
       - id: autoflake
+        additional_dependencies: [setuptools]
         args:
           [
             "--in-place",
```

**File**: `Dockerfile` (modified, +23/-8)
```diff
@@ -1,5 +1,5 @@
 # Lite version
-FROM python:3.10-slim AS lite
+FROM python:3.11-slim AS lite
 
 # Common dependencies
 RUN apt-get update -qqy && \
@@ -76,24 +76,39 @@ RUN --mount=type=ssh  \
     --mount=type=cache,target=/root/.cache/uv  \
     uv pip install --python .venv torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
 
-# Install additional pip packages
+# Install additional pip packages (adv + unstructured)
 RUN --mount=type=ssh  \
     --mount=type=cache,target=/root/.cache/uv  \
     uv pip install --python .venv "libs/kotaemon[adv]" \
     && uv pip install --python .venv unstructured[all-docs]
 
-# Install lightRAG
-ENV USE_LIGHTRAG=true
+# Download NLTK data from LlamaIndex
+RUN /app/.venv/bin/python -c "from llama_index.core.readers.base import BaseReader"
+
+# Optional reader: docling
 RUN --mount=type=ssh  \
     --mount=type=cache,target=/root/.cache/uv  \
-    uv pip install --python .venv aioboto3 nano-vectordb ollama xxhash "lightrag-hku<=1.3.0"
+    uv pip install --python .venv "libs/kotaemon[docling]"
 
+# Optional RAG: lightRAG
+ENV USE_LIGHTRAG=true
 RUN --mount=type=ssh  \
     --mount=type=cache,target=/root/.cache/uv  \
-    uv pip install --python .venv "docling<=2.5.2"
+    uv pip install --python .venv "libs/kotaemon[lightrag]"
 
-# Download NLTK data from LlamaIndex
-RUN /app/.venv/bin/python -c "from llama_index.core.readers.base import BaseReader"
+ENTRYPOINT ["sh", "/app/launch.sh"]
+
+# PaddleOCR version (GPU-only)
+FROM full AS paddle
+
+ARG CUDA_VERSION=130
+
+# Install paddlepaddle and paddleocr
+RUN --mount=type=ssh  \
+    --mount=type=cache,target=/root/.cache/uv  \
+    uv pip install --python .venv paddlepaddle-gpu==3.3.0 \
+        -i "https://www.paddlepaddle.org.cn/packages/stable/cu${CUDA_VERSION}/" \
+    && uv pip install --python .venv "libs/kotaemon[paddleocr]"
 
 ENTRYPOINT ["sh", "/app/launch.sh"]
 
```

**File**: `README.md` (modified, +26/-38)
```diff
@@ -100,7 +100,7 @@ documents and developers who want to build their own RAG pipeline.
 
    - To use the `full` version.
 
-     ```bash
+     ```shell
      docker run \
      -e GRADIO_SERVER_NAME=0.0.0.0 \
      -e GRADIO_SERVER_PORT=7860 \
@@ -111,21 +111,21 @@ documents and developers who want to build their own RAG pipeline.
 
    - To use the `full` version with bundled **Ollama** for _local / private RAG_.
 
-     ```bash
+     ```shell
      # change image name to
      docker run <...> ghcr.io/cinnamon/kotaemon:main-ollama
      ```
 
    - To use the `lite` version.
 
-   ```bash
+   ```shell
     # change image name to
     docker run <...> ghcr.io/cinnamon/kotaemon:main-lite
    ```
 
 2. We currently support and test two platforms: `linux/amd64` and `linux/arm64` (for newer Mac). You can specify the platform by passing `--platform` in the `docker run` command. For example:
 
-   ```bash
+   ```shell
    # To run docker with platform linux/arm64
    docker run \
    -e GRADIO_SERVER_NAME=0.0.0.0 \
@@ -142,53 +142,41 @@ documents and developers who want to build their own RAG pipeline.
 
 ### Without Docker
 
-#### Option 1: Using uv (Recommended for faster installation)
-
-1. Clone the repository and run the uv installation script:
+1. Clone the repository:
 
    ```shell
-   # clone this repo
    git clone https://github.com/Cinnamon/kotaemon
    cd kotaemon
-
-   # run the uv installation script (installs uv automatically if not present)
-   bash scripts/run_uv.sh
    ```
 
-   This script will:
+2. Setup the environment:
 
-   - Install uv package manager if not present
-   - Create a virtual environment with Python 3.10
-   - Install all dependencies using uv (significantly faster than conda/pip)
-   - Set up PDF.js viewer
-   - Launch the application
+- **Option 1: Using [uv](https://docs.astral.sh/uv/getting-started/installation/) (recommended)**
 
-#### Option 2: Using conda (Traditional method)
+  ```shell
+  uv sync --python 3.10
+  source .venv/bin/activate
+  ```
 
-1. Clone and install required packages on a fresh python environment.
+- **Option 2: Using conda**
 
-   ```shell
-   # optional (setup env)
-   conda create -n kotaemon python=3.10
-   conda activate kotaemon
-
-   # clone this repo
-   git clone https://github.com/Cinnamon/kotaemon
-   cd kotaemon
+  ```shell
+  conda create -n kotaemon python=3.10
+  conda activate kotaemon
 
-   pip install -e "libs/kotaemon[all]"
-   pip install -e "libs/ktem"
-   ```
+  pip install -e "libs/kotaemon[all]"
+  pip install -e "libs/ktem"
+  ```
 
-2. Create a `.env` file in the root of this project. Use `.env.example` as a template
+3. Create a `.env` file in the root of this project. Use `.env.example` as a template.
 
    The `.env` file is there to serve use cases where users want to pre-config the models before starting up the app (e.g. deploy the app on HF hub). The file will only be used to populate the db once upon the first run, it will no longer be used in consequent runs.
 
-3. (Optional) To enable in-browser `PDF_JS` viewer, download [PDF_JS_DIST](https://github.com/mozilla/pdf.js/releases/download/v4.0.379/pdfjs-4.0.379-dist.zip) then extract it to `libs/ktem/ktem/assets/prebuilt`
+4. (Optional) To enable in-browser `PDF_JS` viewer, download [PDF_JS_DIST](https://github.com/mozilla/pdf.js/releases/download/v4.0.379/pdfjs-4.0.379-dist.zip) then extract it to `libs/ktem/ktem/assets/prebuilt`.
 
-<img src="https://raw.githubusercontent.com/Cinnamon/kotaemon/main/docs/images/pdf-viewer-setup.png" alt="pdf-setup" width="300">
+   <img src="https://raw.githubusercontent.com/Cinnamon/kotaemon/main/docs/images/pdf-viewer-setup.png" alt="pdf-setup" width="300">
 
-4. Start the web server:
+5. Start the web server:
 
    ```shell
    python app.py
@@ -199,7 +187,7 @@ documents and developers who want to build their own RAG pipeline.
 
    ![Chat tab](https://raw.githubusercontent.com/Cinnamon/kotaemon/main/docs/images/chat-tab.png)
 
-5. Check the `Resources` tab and `LLMs and Embeddings` and ensure that your `api_key` value is set correctly from your `.env` file. If it is not set, you can set it there.
+6. Check the `Resources` tab and `LLMs and Embeddings` and ensure that your `api_key` value is set correctly from your `.env` file. If it is not set, you can set it there.
 
 ### Setup GraphRAG
 
@@ -256,8 +244,8 @@ These options are available:
 
 - [Azure Document Intelligence (API)](https://azure.microsoft.com/en-us/products/ai-services/ai-document-intelligence)
 - [Adobe PDF Extract (API)](https://developer.adobe.com/document-services/docs/overview/pdf-extract-api/)
-- [Docling (local, open-source)](https://github.com/DS4SD/docling)
-  - To use Docling, first install required dependencies: `pip install docling`
+- [Docling (local, open-source)](https://github.com/DS4SD/docling) – see [integrations/docling.md](./docs/integrations/docling.md) for Kotaemon-specific setup.
+- [PaddleOCR (local, open-source)](https://github.com/PADDLE
```

**File**: `docs/integrations/docling.md` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+# Docling
+
+Kotaemon provides a [Docling](https://github.com/DS4SD/docling) reader to enable local document ingestion with structure-aware parsing, including text, tables, and figures.
+The reader is located under `kotaemon/loaders/docling_loader`.
+
+## Prerequisites
+
+- Install Docling:
+
+```bash
+uv pip install -e "libs/kotaemon[docling]"
+```
+
+- Configure optional figure captioning:
+
+Docling can generate figure captions when a VLM endpoint is available. Set `KH_VLM_ENDPOINT` in your `.env` file or application settings to enable captioning.
+
+```bash
+KH_VLM_ENDPOINT=http://your-vlm-endpoint
+```
+
+If `KH_VLM_ENDPOINT` is not set, Docling will still extract text, tables, and figure metadata, but it will skip generated figure captions.
+
+## Configure the loader
+
+1. Run Kotaemon and open the app UI.
+2. Navigate to Settings → Retrieval Settings → File loader.
+3. Select `Docling (figure+table extraction)`.
+4. Save the settings, then upload or ingest a document. Kotaemon will use Docling during indexing and convert extracted content into `Document` objects.
```

**File**: `docs/integrations/paddle_ocr.md` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+# PaddleOCR
+
+Kotaemon provides two [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) readers to enable document ingestion with full layout understanding, including multilingual text, tables, figures, formulas, and seals.
+
+- `PaddleOCRVLReader`: Wraps the PaddleOCR-VL 1.5 visual-language model for robust layout and VQA-based parsing.
+- `PPStructureV3Reader`: Uses the PPStructureV3 pipeline for structured layout analysis, including table and chart detection.
+
+Both readers are located under `kotaemon/loaders/paddleocr_loader`.
+
+## Prerequisites
+
+- Install PaddlePaddle:
+  - Ensure that the installed PaddlePaddle version matches your system configuration and hardware (CPU/GPU). For additional wheel options, refer to the [PaddlePaddle official website](https://www.paddlepaddle.org.cn/install/quick?docurl=undefined).
+  - Check device support for [PaddleOCR-VL](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/PaddleOCR-VL.html#inference-device-support-for-paddleocr-vl).
+
+```bash
+# CPU
+uv pip install paddlepaddle==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
+
+# gpu，requires GPU driver version ≥550.54.14 (Linux) or ≥550.54.14 (Windows)
+uv pip install paddlepaddle-gpu==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cu130/
+```
+
+- Install the PaddleOCR doc parser extras:
+
+```bash
+uv pip install -e "libs/kotaemon[paddleocr]"
+```
+
+- Configure the device: You can set the `PADDLE_DEVICE` environment variable in your .env file to control the execution device.
+
+```bash
+PADDLE_DEVICE=gpu # cpu, gpu:0
+```
+
+## Configure the loader
+
+1. Run Kotaemon and open the app UI.
+2. Navigate to Settings → File Loader (under indexing or ingestion settings).
+3. Select one of the PaddleOCR loaders:
+   - `PaddleOCR PPStructureV3 (table+figure extraction)`
+   - `PaddleOCR-VL (VLM document parsing)`
+4. Save the settings, then upload or ingest a document. Kotaemon will automatically use the selected PaddleOCR loader during indexing and convert extracted content into Document objects.
```

**File**: `docs/usage.md` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ OPENAI_EMBEDDINGS_MODEL=text-embedding-ada-002
 ### Azure OpenAI
 
 For OpenAI models via Azure platform, you need to provide your Azure endpoint and API
-key. Your might also need to provide your developments' name for the chat model and the
+key. You might also need to provide your developments' name for the chat model and the
 embedding model depending on how you set up Azure development.
 
 ```shell
```

**File**: `libs/kotaemon/kotaemon/indices/ingests/files.py` (modified, +6/-0)
```diff
@@ -18,8 +18,10 @@
     MathpixPDFReader,
     MhtmlReader,
     OCRReader,
+    PaddleOCRVLReader,
     PandasExcelReader,
     PDFThumbnailReader,
+    PPStructureV3Reader,
     TxtReader,
     UnstructuredReader,
     WebReader,
@@ -38,6 +40,10 @@
     azure_reader.vlm_endpoint
 ) = docling_reader.vlm_endpoint = getattr(flowsettings, "KH_VLM_ENDPOINT", "")
 
+paddle_device = str(config("PADDLE_DEVICE", default="gpu"))
+paddle_struct_reader = PPStructureV3Reader(device=paddle_device)
+paddle_vl_reader = PaddleOCRVLReader(device=paddle_device)
+
 
 KH_DEFAULT_FILE_EXTRACTORS: dict[str, BaseReader] = {
     ".xlsx": PandasExcelReader(),
```

---

### Incident Patch 2: `4015bb0f` (2026-03-28)
**Commit Message**: fix: update default Cohere rerank model to rerank-v4.0-fast

**File**: `flowsettings.py` (modified, +1/-1)
```diff
@@ -310,7 +310,7 @@
 KH_RERANKINGS["cohere"] = {
     "spec": {
         "__type__": "kotaemon.rerankings.CohereReranking",
-        "model_name": "rerank-multilingual-v2.0",
+        "model_name": "rerank-v4.0-fast",
         "cohere_api_key": config("COHERE_API_KEY", default=""),
     },
     "default": True,
```

**File**: `libs/kotaemon/kotaemon/indices/rankings/cohere.py` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 
 class CohereReranking(BaseReranking):
-    model_name: str = "rerank-multilingual-v2.0"
+    model_name: str = "rerank-v4.0-fast"
     cohere_api_key: str = config("COHERE_API_KEY", "")
     use_key_from_ktem: bool = False
 
```

**File**: `libs/kotaemon/kotaemon/rerankings/cohere.py` (modified, +4/-3)
```diff
@@ -13,10 +13,11 @@ class CohereReranking(BaseReranking):
     """Cohere Reranking model"""
 
     model_name: str = Param(
-        "rerank-multilingual-v2.0",
+        "rerank-v4.0-fast",
         help=(
-            "ID of the model to use. You can go to [Supported Models]"
-            "(https://docs.cohere.com/docs/rerank-2) to see the supported models"
+            "ID of the model to use. See [Cohere Rerank models]"
+            "(https://docs.cohere.com/docs/models#rerank) for supported IDs "
+            "(e.g. rerank-v4.0-fast, rerank-v4.0-pro, rerank-multilingual-v3.0)."
         ),
         required=True,
     )
```

**File**: `libs/ktem/ktem/pages/setup.py` (modified, +1/-1)
```diff
@@ -226,7 +226,7 @@ def update_model(
                     name="cohere",
                     spec={
                         "__type__": "kotaemon.rerankings.CohereReranking",
-                        "model_name": "rerank-multilingual-v2.0",
+                        "model_name": "rerank-v4.0-fast",
                         "cohere_api_key": cohere_api_key,
                     },
                     default=True,
```

---

### Incident Patch 3: `fe52d208` (2026-02-27)
**Commit Message**: ✨ feat(build): add uv package manager support for faster installation (#790)

- Add uv workspace configuration to pyproject.toml
- Create run_uv.sh script for automated uv-based installation
- Update README with uv installation option (10-100x faster than conda)
- Add uv.lock for reproducible builds
- Maintain backward compatibility with existing conda setup
- Fix known dependency conflicts (hnswlib, chroma-hnswlib)

Benefits:
- Faster dependency resolution (seconds vs minutes)
- Simplified installation process (~50 lines vs 200+ lines)
- Cross-platform compatibility
- Reproducible builds with lock file
- Better development experience
- Automatic Python version management

Co-authored-by: Your Name <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +22/-0)
```diff
@@ -142,6 +142,28 @@ documents and developers who want to build their own RAG pipeline.
 
 ### Without Docker
 
+#### Option 1: Using uv (Recommended for faster installation)
+
+1. Clone the repository and run the uv installation script:
+
+   ```shell
+   # clone this repo
+   git clone https://github.com/Cinnamon/kotaemon
+   cd kotaemon
+
+   # run the uv installation script (installs uv automatically if not present)
+   bash scripts/run_uv.sh
+   ```
+
+   This script will:
+   - Install uv package manager if not present
+   - Create a virtual environment with Python 3.10
+   - Install all dependencies using uv (significantly faster than conda/pip)
+   - Set up PDF.js viewer
+   - Launch the application
+
+#### Option 2: Using conda (Traditional method)
+
 1. Clone and install required packages on a fresh python environment.
 
    ```shell
```

**File**: `pyproject.toml` (modified, +22/-2)
```diff
@@ -18,8 +18,8 @@ dynamic = ["version"]
 requires-python = ">= 3.10"
 description = "Kotaemon App"
 dependencies = [
-    "kotaemon @ git+https://github.com/Cinnamon/kotaemon.git@main#subdirectory=libs/kotaemon",
-    "ktem @ git+https://github.com/Cinnamon/kotaemon.git@main#subdirectory=libs/ktem"
+    "kotaemon",
+    "ktem"
 ]
 authors = [
     { name = "@trducng", email = "john@cinnamon.is" },
@@ -32,6 +32,26 @@ classifiers = [
     "Operating System :: OS Independent",
 ]
 
+[tool.uv.sources]
+kotaemon = { workspace = true }
+ktem = { workspace = true }
+
+# uv workspace configuration
+[tool.uv.workspace]
+members = ["libs/kotaemon", "libs/ktem"]
+
+[dependency-groups]
+dev = [
+    "black",
+    "coverage",  
+    "flake8",
+    "ipython",
+    "pre-commit",
+    "pytest",
+    "pytest-mock",
+    "sphinx"
+]
+
 [project.urls]
 Homepage = "https://cinnamon.github.io/kotaemon/"
 Repository = "https://github.com/Cinnamon/kotaemon/"
```

**File**: `scripts/run_uv.sh` (added, +187/-0)
```diff
@@ -0,0 +1,187 @@
+#!/bin/bash
+
+# Kotaemon UV Installation Script
+# This script provides a faster and simpler alternative to conda-based installation
+
+set -euo pipefail
+
+# Colors for output
+RED='\033[0;31m'
+GREEN='\033[0;32m'  
+YELLOW='\033[1;33m'
+BLUE='\033[0;34m'
+NC='\033[0m' # No Color
+
+function print_header() {
+    echo -e "\n${BLUE}======================================================${NC}"
+    echo -e "${BLUE}$1${NC}"
+    echo -e "${BLUE}======================================================${NC}\n"
+}
+
+function print_success() {
+    echo -e "${GREEN}✓ $1${NC}"
+}
+
+function print_warning() {
+    echo -e "${YELLOW}⚠ $1${NC}"
+}
+
+function print_error() {
+    echo -e "${RED}✗ $1${NC}"
+}
+
+function check_path_for_spaces() {
+    if [[ $PWD =~ \  ]]; then
+        print_error "The current workdir has whitespace which can lead to unintended behaviour. Please modify your path and continue later."
+        exit 1
+    fi
+}
+
+function check_python_version() {
+    print_success "uv will automatically manage Python 3.10 - no manual Python installation needed!"
+}
+
+function install_uv() {
+    if command -v uv &> /dev/null; then
+        print_success "uv is already installed"
+        return 0
+    fi
+    
+    print_header "Installing uv package manager"
+    
+    if command -v curl &> /dev/null; then
+        curl -LsSf https://astral.sh/uv/install.sh | sh
+    elif command -v wget &> /dev/null; then
+        wget -qO- https://astral.sh/uv/install.sh | sh
+    else
+        print_error "Neither curl nor wget is available. Please install one of them."
+        exit 1
+    fi
+    
+    # Add uv to PATH for current session
+    export PATH="$HOME/.local/bin:$PATH"
+    
+    if command -v uv &> /dev/null; then
+        print_success "uv installed successfully"
+    else
+        print_error "uv installation failed"
+        exit 1
+    fi
+}
+
+function setup_environment() {
+    print_header "Setting up Python environment with uv"
+    
+    # Create virtual environment with Python 3.10 (uv will download Python if needed)
+    if [[ ! -d ".venv" ]]; then
+        print_success "Creating virtual environment with Python 3.10 (uv will download if needed)..."
+        uv venv --python 3.10
+        print_success "Created virtual environment"
+    else
+        print_warning "Virtual environment already exists"
+    fi
+    
+    # Activate virtual environment
+    source .venv/bin/activate
+    print_success "Activated virtual environment"
+}
+
+function install_dependencies() {
+    print_header "Installing dependencies"
+    
+    # Use the exact same approach as conda scripts for compatibility
+    print_success "Installing kotaemon with exact dependency resolution..."
+    
+    # Install in the exact same order as the original conda script
+    uv pip install -e "libs/kotaemon[all]"
+    uv pip install -e "libs/ktem"
+    
+    # Fix known version conflicts mentioned in the README
+    print_success "Resolving known version conflicts..."
+    uv pip uninstall hnswlib chroma-hnswlib -y 2>/dev/null || true
+    uv pip install chroma-hnswlib
+    
+    print_success "Dependencies installed successfully"
+}
+
+function setup_pdfjs() {
+    print_header "Setting up PDF.js viewer"
+    
+    local pdfjs_dir="libs/ktem/ktem/assets/prebuilt/pdfjs-4.0.379-dist"
+    
+    if [[ -d "$pdfjs_dir" ]]; then
+        print_warning "PDF.js already exists, skipping download"
+        return 0
+    fi
+    
+    if [[ -f "scripts/download_pdfjs.sh" ]]; then
+        bash scripts/download_pdfjs.sh "$pdfjs_dir"
+        print_success "PDF.js setup completed"
+    else
+        print_warning "PDF.js download script not found. You may need to set this up manually."
+    fi
+}
+
+function setup_env_file() {
+    print_header "Setting up environment configuration"
+    
+    if [[ ! -f ".env" && -f ".env.example" ]]; then
+        cp .env.example .env
+        print_success "Created .env file from template"
+        print_warning "Please edit .env file to configure your API keys"
+    elif [[ -f ".env" ]]; then
+        print_warning ".env file already exists"
+    else
+        print_warning "No .env.example found. You may need to configure environment variables manually."
+    fi
+}
+
+function launch_app() {
+    print_header "Launching Kotaemon"
+    
+    print_success "Starting the application..."
+    print_warning "The app will be automatically launched in your browser"
+    print_warning "Default username and password are both 'admin'"
+    
+    # Set PDF.js environment variable if directory exists
+    local pdfjs_dir="libs/ktem/ktem/assets/prebuilt/pdfjs-4.0.379-dist"
+    if [[ -d "$pdfjs_dir" ]]; then
+        export PDFJS_PREBUILT_DIR="$pdfjs_dir"
+    fi
+    
+    python app.py
+}
+
+function main() {
+    print_header "Kotaemon UV-based Installation"
+    
+    # Move to project root
+    cd "$(dirname "${BASH_SOURCE[0]}")" && cd ..
+    
+    check_path_for_spaces
+    check_pyth
```

---

### Incident Patch 4: `37cdc28c` (2025-07-02)
**Commit Message**: fix: add validation to avoid path-traversal vulnerabilities (#755)

* fix: add validation to avoid path-traversal vulnerabilities

* fix: update init value is_safe

Co-authored-by: Copilot <[REDACTED_EMAIL]>

* refactor: extract zip check

* fix: dont need to check relative path

* fix: disable check zip file (zipfile have taken it)

---------

Co-authored-by: kan_cin <[REDACTED_EMAIL]>
Co-authored-by: Copilot <[REDACTED_EMAIL]>
Co-authored-by: phv2312 <[REDACTED_EMAIL]>

**File**: `libs/ktem/ktem/index/file/ui.py` (modified, +23/-10)
```diff
@@ -1059,15 +1059,18 @@ def _may_extract_zip(self, files, zip_dir: str):
         """Handle zip files"""
         zip_files = [file for file in files if file.endswith(".zip")]
         remaining_files = [file for file in files if not file.endswith("zip")]
+        errors: list[str] = []
 
         # Clean-up <zip_dir> before unzip to remove old files
         shutil.rmtree(zip_dir, ignore_errors=True)
 
+        # Unzip
         for zip_file in zip_files:
             # Prepare new zip output dir, separated for each files
             basename = os.path.splitext(os.path.basename(zip_file))[0]
             zip_out_dir = os.path.join(zip_dir, basename)
             os.makedirs(zip_out_dir, exist_ok=True)
+
             with zipfile.ZipFile(zip_file, "r") as zip_ref:
                 zip_ref.extractall(zip_out_dir)
 
@@ -1084,7 +1087,7 @@ def _may_extract_zip(self, files, zip_dir: str):
         if n_zip_file > 0:
             print(f"Update zip files: {n_zip_file}")
 
-        return remaining_files
+        return remaining_files, errors
 
     def index_fn(
         self, files, urls, reindex: bool, settings, user_id
@@ -1100,20 +1103,22 @@ def index_fn(
         """
         if urls:
             files = [it.strip() for it in urls.split("\n")]
-            errors = []
+            errors = self.validate_urls(files)
         else:
             if not files:
                 gr.Info("No uploaded file")
                 yield "", ""
                 return
+            files, unzip_errors = self._may_extract_zip(
+                files, flowsettings.KH_ZIP_INPUT_DIR
+            )
+            errors = self.validate_files(files)
+            errors.extend(unzip_errors)
 
-            files = self._may_extract_zip(files, flowsettings.KH_ZIP_INPUT_DIR)
-
-            errors = self.validate(files)
-            if errors:
-                gr.Warning(", ".join(errors))
-                yield "", ""
-                return
+        if errors:
+            gr.Warning(", ".join(errors))
+            yield "", ""
+            return
 
         gr.Info(f"Start indexing {len(files)} files...")
 
@@ -1569,7 +1574,7 @@ def interact_group_list(self, list_groups, ev: gr.SelectData):
             selected_item["files"],
         )
 
-    def validate(self, files: list[str]):
+    def validate_files(self, files: list[str]):
         """Validate if the files are valid"""
         paths = [Path(file) for file in files]
         errors = []
@@ -1598,6 +1603,14 @@ def validate(self, files: list[str]):
 
         return errors
 
+    def validate_urls(self, urls: list[str]):
+        """Validate if the urls are valid"""
+        errors = []
+        for url in urls:
+            if not url.startswith("http") and not url.startswith("https"):
+                errors.append(f"Invalid url `{url}`")
+        return errors
+
 
 class FileSelector(BasePage):
     """File selector UI in the Chat page"""
```

---

### Incident Patch 5: `ec1f6abd` (2025-07-01)
**Commit Message**: fix: typo lancedb (#760)

**File**: `libs/kotaemon/kotaemon/rerankings/cohere.py` (modified, +7/-2)
```diff
@@ -1,6 +1,7 @@
 from __future__ import annotations
 
 import os
+
 from decouple import config
 
 from kotaemon.base import Document, Param
@@ -25,7 +26,9 @@ class CohereReranking(BaseReranking):
         required=True,
     )
     base_url: str = Param(
-        None, help="Rerank API base url. Default is https://api.cohere.com", required=False
+        None,
+        help="Rerank API base url. Default is https://api.cohere.com",
+        required=False,
     )
 
     def run(self, documents: list[Document], query: str) -> list[Document]:
@@ -42,7 +45,9 @@ def run(self, documents: list[Document], query: str) -> list[Document]:
             print("Cohere API key not found. Skipping rerankings.")
             return documents
 
-        cohere_client = cohere.Client(self.cohere_api_key, base_url=self.base_url or os.getenv("CO_API_URL"))
+        cohere_client = cohere.Client(
+            self.cohere_api_key, base_url=self.base_url or os.getenv("CO_API_URL")
+        )
         compressed_docs: list[Document] = []
 
         if not documents:  # to avoid empty api call
```

**File**: `libs/kotaemon/kotaemon/storages/docstores/lancedb.py` (modified, +3/-2)
```diff
@@ -114,10 +114,11 @@ def get(self, ids: Union[List[str], str]) -> List[Document]:
         except (ValueError, FileNotFoundError):
             docs = []
 
-        # return the documents using the order of original ids (which were ordered by score)
+        # return the documents using the order of original
+        # ids (which were ordered by score)
         doc_dict = {
             doc["id"]: Document(
-                d_=doc["id"],
+                id_=doc["id"],
                 text=doc["text"] if doc["text"] else "<empty>",
                 metadata=json.loads(doc["attributes"]),
             )
```

---

### Incident Patch 6: `833982ac` (2025-06-05)
**Commit Message**: fix(docstore): preserve retrieval ranking order in lancedb get() (#745)

**File**: `libs/kotaemon/kotaemon/storages/docstores/lancedb.py` (modified, +7/-4)
```diff
@@ -113,14 +113,17 @@ def get(self, ids: Union[List[str], str]) -> List[Document]:
             )
         except (ValueError, FileNotFoundError):
             docs = []
-        return [
-            Document(
-                id_=doc["id"],
+
+        # return the documents using the order of original ids (which were ordered by score)
+        doc_dict = {
+            doc["id"]: Document(
+                d_=doc["id"],
                 text=doc["text"] if doc["text"] else "<empty>",
                 metadata=json.loads(doc["attributes"]),
             )
             for doc in docs
-        ]
+        }
+        return [doc_dict[_id] for _id in ids if _id in doc_dict]
 
     def delete(self, ids: Union[List[str], str], refresh_indices: bool = True):
         """Delete document by id"""
```

---

### Incident Patch 7: `ddb51872` (2025-06-05)
**Commit Message**: fix: scope is not passd to vector store query (#747)

**File**: `libs/kotaemon/kotaemon/indices/vectorindex.py` (modified, +2/-2)
```diff
@@ -168,7 +168,7 @@ def run(
         if self.retrieval_mode == "vector":
             emb = self.embedding(text)[0].embedding
             _, scores, ids = self.vector_store.query(
-                embedding=emb, top_k=top_k_first_round, **kwargs
+                embedding=emb, top_k=top_k_first_round, doc_ids=scope, **kwargs
             )
             docs = self.doc_store.get(ids)
             result = [
@@ -197,7 +197,7 @@ def query_vectorstore():
 
                 assert self.doc_store is not None
                 _, vs_scores, vs_ids = self.vector_store.query(
-                    embedding=emb, top_k=top_k_first_round, **kwargs
+                    embedding=emb, top_k=top_k_first_round, doc_ids=scope, **kwargs
                 )
                 if vs_ids:
                     vs_docs = self.doc_store.get(vs_ids)
```

---

### Incident Patch 8: `6f4acc97` (2025-04-15)
**Commit Message**: fix: update Docling call to generate figure caption #729 #none

**File**: `libs/kotaemon/kotaemon/loaders/docling_loader.py` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ def load_data(
             else:
                 gen_caption_count += 1
                 gen_caption = generate_single_figure_caption(
-                    img_base64, self.vlm_endpoint
+                    figure=img_base64, vlm_endpoint=self.vlm_endpoint
                 )
 
             # join the extractive and generative captions
```

---

### Incident Patch 9: `a3e2e207` (2025-04-01)
**Commit Message**: fix: comfort CI

**File**: `libs/ktem/ktem/index/file/graph/lightrag_pipelines.py` (modified, +3/-4)
```diff
@@ -29,10 +29,9 @@
 
 try:
     from lightrag import LightRAG, QueryParam
-    
-    # newer verisons of LightRAG needs to be initialized before using
-    from lightrag.kg.shared_storage import initialize_pipeline_status
 
+    # newer versions of LightRAG needs to be initialized before using
+    from lightrag.kg.shared_storage import initialize_pipeline_status
     from lightrag.operate import (
         _find_most_related_edges_from_entities,
         _find_most_related_text_unit_from_entities,
@@ -240,7 +239,7 @@ def build_graphrag(working_dir, llm_func, embedding_func):
         embedding_func=embedding_func,
     )
 
-    # newer verisons of LightRAG needs to be initialized before using
+    # newer versions of LightRAG needs to be initialized before using
     asyncio.run(graphrag_func.initialize_storages())
     asyncio.run(initialize_pipeline_status())
 
```

---

### Incident Patch 10: `911b20ca` (2025-04-01)
**Commit Message**: fix: error 'history_messages' with LightRAG latest version (#719) bump:patch

* fix: Error: 'history_messages' with LightRAG

* added comment

**File**: `libs/ktem/ktem/index/file/graph/lightrag_pipelines.py` (modified, +9/-0)
```diff
@@ -29,6 +29,10 @@
 
 try:
     from lightrag import LightRAG, QueryParam
+    
+    # newer verisons of LightRAG needs to be initialized before using
+    from lightrag.kg.shared_storage import initialize_pipeline_status
+
     from lightrag.operate import (
         _find_most_related_edges_from_entities,
         _find_most_related_text_unit_from_entities,
@@ -235,6 +239,11 @@ def build_graphrag(working_dir, llm_func, embedding_func):
         llm_model_func=llm_func,
         embedding_func=embedding_func,
     )
+
+    # newer verisons of LightRAG needs to be initialized before using
+    asyncio.run(graphrag_func.initialize_storages())
+    asyncio.run(initialize_pipeline_status())
+
     return graphrag_func
 
 
```

---

### Incident Patch 11: `79a5f064` (2025-04-01)
**Commit Message**: fix: rename nonexistent function call in update_macos.sh script (#687) #none

**File**: `scripts/update_macos.sh` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@ function update_latest() {
 
     if [ -f "pyproject.toml" ]; then
         echo "Source files detected. Please perform git pull manually."
-        deactivate_environment
+        deactivate_conda_env
         exit 1
     else
         echo "Installing version: $app_version"
@@ -51,7 +51,7 @@ function update_latest() {
         if [ $? -ne 0 ]; then
             echo
             echo "Update failed. You may need to run the update again."
-            deactivate_environment
+            deactivate_conda_env
             exit 1
         fi
     fi
```

---

### Incident Patch 12: `edec6142` (2025-03-31)
**Commit Message**: fix: add pylance req for local script-based install bump:patch

**File**: `libs/kotaemon/pyproject.toml` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@ dependencies = [
     "plotly<6.0.0",
     "PyMuPDF>=1.23,<=1.24.11",
     "pypdf>=4.2.0,<4.3",
+    "pylance",
     "python-decouple", # for theflow
     "python-docx>=1.1.0,<1.2",
     "python-dotenv>=1.0.1,<1.1",
```

---

### Incident Patch 13: `fbc2cd4c` (2025-03-31)
**Commit Message**: fix: add matplotlib req for Colab install bump:patch

**File**: `libs/kotaemon/pyproject.toml` (modified, +2/-0)
```diff
@@ -43,6 +43,8 @@ dependencies = [
     "llama-index-vector-stores-chroma>=0.1.9",
     "llama-index-vector-stores-lancedb",
     "openai>=1.23.6,<2",
+    "matplotlib",
+    "matplotlib-inline",
     "openpyxl>=3.1.2,<3.2",
     "opentelemetry-exporter-otlp-proto-grpc>=1.25.0", # https://github.com/chroma-core/chroma/issues/2571
     "pandas>=2.2.2,<2.3",
```

---

### Incident Patch 14: `86b3ee8b` (2025-03-31)
**Commit Message**: fix: update Dockerfile (#718) #none

**File**: `Dockerfile` (modified, +4/-0)
```diff
@@ -92,6 +92,10 @@ RUN --mount=type=ssh  \
     --mount=type=cache,target=/root/.cache/pip  \
     pip install "docling<=2.5.2"
 
+
+# Download NLTK data from LlamaIndex
+RUN python -c "from llama_index.core.readers.base import BaseReader"
+
 # Clean up
 RUN apt-get autoremove \
     && apt-get clean \
```

**File**: `libs/kotaemon/pyproject.toml` (modified, +1/-0)
```diff
@@ -57,6 +57,7 @@ dependencies = [
     "trogon>=0.5.0,<0.6",
     "umap-learn==0.5.5",
     "tavily-python>=0.4.0",
+    "pydantic<=2.10.6",
 ]
 readme = "README.md"
 authors = [
```

---

### Incident Patch 15: `8f87ddfb` (2025-02-14)
**Commit Message**: fix: update default params in sso mode #none

**File**: `sso_app.py` (modified, +5/-5)
```diff
@@ -8,7 +8,7 @@
 
 KH_APP_DATA_DIR = getattr(flowsettings, "KH_APP_DATA_DIR", ".")
 GRADIO_TEMP_DIR = os.getenv("GRADIO_TEMP_DIR", None)
-AUTHENTICATION_METHOD = config("AUTHENTICATION_METHOD")
+AUTHENTICATION_METHOD = config("AUTHENTICATION_METHOD", "GOOGLE")
 
 # override GRADIO_TEMP_DIR if it's not set
 if GRADIO_TEMP_DIR is None:
@@ -20,10 +20,10 @@
 GOOGLE_CLIENT_SECRET = config("GOOGLE_CLIENT_SECRET", default="")
 
 # for authentication with Open ID by keycloak
-KEYCLOAK_SERVER_URL = config("KEYCLOAK_SERVER_URL")
-KEYCLOAK_REALM = config("KEYCLOAK_REALM")
-KEYCLOAK_CLIENT_ID = config("KEYCLOAK_CLIENT_ID")
-KEYCLOAK_CLIENT_SECRET = config("KEYCLOAK_CLIENT_SECRET")
+KEYCLOAK_SERVER_URL = config("KEYCLOAK_SERVER_URL", default="")
+KEYCLOAK_REALM = config("KEYCLOAK_REALM", default="")
+KEYCLOAK_CLIENT_ID = config("KEYCLOAK_CLIENT_ID", default="")
+KEYCLOAK_CLIENT_SECRET = config("KEYCLOAK_CLIENT_SECRET", default="")
 
 from ktem.main import App  # noqa
 
```

#### Recent Merged Pull Requests:
- **PR #849** (closed): Agent/harden minimal baseline (@SwartzMss)
- **PR #840** (closed): feat: benchmark structure and score method update (@262412)
- **PR #829** (closed): docs: update uv installation instructions to remove missing run_uv.sh (@octo-patch)
- **PR #824** (closed): feat: enhance logging configuration and improve log messages across the application (@KudoKhang)
- **PR #823** (2026-03-28): fix: update default Cohere rerank model to rerank-v4.0-fast (@KudoKhang)
- **PR #818** (closed): feat: add Novita AI as LLM provider (@Alex-yang00)
- **PR #816** (closed): Dev (@262412)
- **PR #814** (2026-05-30): feat: integrate PaddleOCR as document loaders + enhance chat/index UX (@niko-nnkn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
