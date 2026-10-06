# Forensic Learning Record (Deep Inspection): Future-House/paper-qa

> **Canonical Artifact**: `07_PROJECT_LEARNING/future-house-paper-qa-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Future-House/paper-qa](https://github.com/Future-House/paper-qa))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:43:25.039Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Future-House/paper-qa`
- **Description**: High accuracy RAG for answering questions from scientific documents with citations
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 9316 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/paper-qa-pypdf/src/paperqa_pypdf/utils.py`
```
from collections import defaultdict


def cluster_bboxes(
    bboxes: list[tuple[float, float, float, float]], tolerance: float = 50
) -> list[tuple[float, float, float, float]]:
    """Cluster nearby bounding boxes into regions using spatial proximity.

    Uses union-find to cluster bboxes based on the input tolerance,
    then computes a merged bounding box for each cluster.

    Args:
        bboxes: List of (x0, y0, x1, y1) bounding boxes.
        tolerance: Maximum distance (inclusive) between bboxes to consider them
            part of the same cluster.

    Returns:
        List of (x0, y0, x1, y1) merged bounding boxes for each cluster.
    """
    parent = list(range(len(bboxes)))

    def find(i: int) -> int:
        if parent[i] != i:
            parent[i] = find(parent[i])
        return parent[i]

    def union(i: int, j: int) -> None:
        pi, pj = find(i), find(j)
        if pi != pj:
            parent[pi] = pj

    # Cluster bboxes that are within tolerance distance
    for i, b1 in enumerate(bboxes):
        for j in range(i + 1, len(bboxes)):
            b2 = bboxes[j]
            # Distance is 0 if they overlap, otherwise there's a gap between them
            x_dist = max(0, max(b1[0], b2[0]) - min(b1[2], b2[2]))
            y_dist = max(0, max(b1[1], b2[1]) - min(b1[3], b2[3]))
            if x_dist <= tolerance and y_dist <= tolerance:
                union(i, j)

    # Group bboxes by cluster and compute merged bbox
    clusters: dict[int, list[tuple[float, float, float, float]]] = defaultdict(list)
    for i, bbox in enumerate(bboxes):
        clusters[find(i)].append(bbox)
    return [
        (
            min(b[0] for b in cluster_bboxes),
            min(b[1] for b in cluster_bboxes),
            max(b[2] for b in cluster_bboxes),
            max(b[3] for b in cluster_bboxes),
        )
        for cluster_bboxes in clusters.values()
    ]

```

### Core Architecture Module: `src/paperqa/core.py`
```
import json
import logging
import re
from collections.abc import Callable, Sequence
from typing import Any, ClassVar

import litellm
from aviary.core import Message
from lmi import LLMModel, LLMResult
from pydantic import JsonValue

from paperqa.prompts import text_with_tables_prompt_template
from paperqa.types import Context, Text, create_multimodal_message
from paperqa.utils import extract_score, strip_citations

logger = logging.getLogger(__name__)


def llm_parse_json(text: str) -> dict[str, JsonValue]:
    """Read LLM output and extract JSON data from it."""
    # Removing <think> tags for reasoning models
    ptext = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    # fetches from markdown ```json if present
    ptext = ptext.split("```json")[-1].split("```")[0]

    # Fix specific case with raw fractions in relevance_score
    ptext = re.sub(
        r'"relevance_score"\s*:\s*(\d+)/(\d+)',
        lambda m: f'"relevance_score": {round(int(m.group(1)) / int(m.group(2)) * 10)}',
        ptext,
    )

    # Wrap non-JSON text in a dictionary
    if "{" not in ptext and "}" not in ptext:
        ptext = json.dumps({"summary": ptext})

    # Remove any introductory/closing text and ensure {} to make it a valid JSON
    ptext = ("{" + ptext.split("{", 1)[-1]).rsplit("}", 1)[0] + "}"

    def escape_newlines(match: re.Match) -> str:
        return match.group(0).replace("\n", "\\n")

    # Match anything between double quotes
    # including escaped quotes and other escaped characters.
    # https://regex101.com/r/VFcDmB/1
    ptext = re.sub(r'"(?:[^"\\]|\\.)*"', escape_newlines, ptext)

    # Ensure that any backslashes in the string that are not part
    # of a valid escape sequence are properly escaped
    # https://regex101.com/r/IzMDlI/1
    ptext = re.sub(r'\\([^"\\/bfnrtu])', r"\\\\\1", ptext)

    def fraction_replacer(match: re.Match) -> str:
        key = match.group(1)  # The key (unchanged)

        # Case 1: If quoted fraction `"5/10"`
        if match.group(2) and match.group(3):
            numerator = int(match.group(2))
            denominator = int(match.group(3))

        # Case 2: If unquoted fraction `5/10`
        elif match.group(4) and match.group(5):
            numerator = int(match.group(4))
            denominator = int(match.group(5))

        else:
            return match.group(0)  # No change if no fraction is found

        fraction_value = round(numerator / denominator * 10)  # Convert to integer
        return f"{key}{fraction_value}"

    # Replace X/Y scores with integer value from 0-10
    # e.g. "relevance_score": "8/10" -> "relevance_score": 8
    # e.g. "relevance_score": 3/5 -> "relevance_score": 6
    ptext = re.sub(
        r'("\s*(?:relevance|score)[\w\s\-]*"\s*:\s*)(?:"(\d+)\s*/\s*(\d+)"|(\d+)\s*/\s*(\d+))',
        fraction_replacer,
        ptext,
    )

    # Add missing commas after fields where another key follows
    ptext = re.sub(r'(?<=[}\]0-9"])\s*(?="[^"\\]*"\s*:)', ", ", ptext)

    # Remove extra commas
    ptext = re.sub(r",\s*,+", ",", ptext)  # Remove multiple consecutive commas
    ptext = re.sub(r",\s*}", "}", ptext)  # Remove trailing commas before closing brace
    ptext = re.sub(r"\{\s*,", "{", ptext)  # Remove leading commas inside object

    # Try to parse the JSON normally first
    try:
        data = json.loads(ptext)
    except json.JSONDecodeError as e:
        # If normal parsing fails, try to handle nested quotes case
        if "summary" in ptext and '"relevance_score"' in ptext:
            # Extract summary and relevance_score directly using regex
            summary_match = re.search(
                r'"summary"\s*:\s*"(.*?)",\s*"relevance_score"', ptext, re.DOTALL
            )
            score_match = re.search(r'"relevance_score"\s*:\s*"?(\d+)"?', ptext)
            if summary_match and score_match:
                return {
                    "summary": summary_match.group(1).replace(r"\'", "'"),
                    "relevance_score": int(score_match.group(1)),
                }

        raise ValueError(f"Failed to load JSON from text {text!r}.") from e

    # Handling incorrect key names for "relevance_score"
    for key in list(data):  # List is here to copy keys, since we're in-place mutating
        if re.search(r"relevance|score", key, re.IGNORECASE):
            data["relevance_score"] = data.pop(key)  # Renaming key

    # Handling float, str values for relevance_score
    if "relevance_score" in data and not isinstance(data["relevance_score"], int):
        try:
            data["relevance_score"] = round(float(data["relevance_score"]))
        except ValueError as exc:
            raise ValueError(
                f"Failed to extract 'relevance_score' of {data['relevance_score']!r}"
                " to an integer."
            ) from exc

    return data


class LLMContextError(ValueError):
    retryable: ClassVar[bool]
    help_message: ClassVar[str]  # Eventually passed to logger.exception

    def __init__(self, message: str, llm_results: list[LLMResult]) -> None:
        super().__init__(message)
        self.llm_results = llm_results  # House so we can cost track across retries


class LLMBadContextJSONError(LLMContextError):
    """Retryable exception for when the LLM gives back bad JSON."""

    retryable = True
    help_message = (
        "Abandoning this context creation."
        " Your model may not be capable of supporting JSON output"
        " or our parsing technique could use some work. Try"
        " a different model or specify `Settings(prompts={'use_json': False})`."
        " Or, feel free to just ignore this message, as many contexts are"
        " concurrently made and we're not attached to any one given context."
    )


class LLMContextTimeoutError(LLMContextError):
    """Non-retryable exception for when the LLM call times out."""

    retryable = False
    help_message = (
        "Timeout when creating a context, abandoning it."
        " If you see this error frequently, consider increasing the timeout in"
        " Settings(summary_llm_config=...). Or, feel free to just ignore this message,"
        " as many contexts are concurrently made and we're not attached to any one"
        " given context."
    )


class LLMContextRequestFailedError(LLMContextError):
    """Non-retryable exception for when the LLM provider fails to respond.

    Kind of a catch-all for intermittent failures, safety refusals, etc.
    Catches all litellm.BadRequestErrors and litellm.MidStreamFallbackErrors.
    """

    retryable = False
    help_message = (
        "Response error when creating a context, abandoning it."
        " If you see this error frequently, the summary_llm endpoint is either"
        " misconfigured or is having issues."
    )


async def _map_fxn_summary(  # noqa: PLR0912
    text: Text,
    question: str,
    summary_llm_model: LLMModel | None,
    prompt_templates: tuple[str, str] | None,
    extra_prompt_data: dict[str, str] | None = None,
    parser: Callable[[str], dict[str, Any]] | None = None,
    callbacks: Sequence[Callable[[str], None]] | None = None,
    skip_citation_strip: bool = False,
    evidence_text_only_fallback: bool = False,
    _prior_attempt: LLMContextError | None = None,
) -> tuple[Context, list[LLMResult]]:
    """Parses the given text and returns a context object with the parser and prompt runner.

    The parser should at least return a dict with `summary`. A `relevant_score` will be used and any
    extra fields except `question` will be added to the context object. `question` is stripped
    because it can be incorrectly parsed from LLM outputs when parsing them as JSON.

    Args:
        text: The text to parse.
        question: The question to use for summarization.
        summary_llm_model: The LLM model to use for generating summaries.
        prompt_templates: Optional two-elements tuple containing templates for the user and system prompts.
            prompt_templates = (user_prompt_template, system_prompt_template)
        extra_prompt_data: Optional extra data to pass to the prompt template.
        parser: Optional parser function to parse LLM output into structured data.
            Should return dict with at least 'summary' field.
        callbacks: Optional sequence of callback functions to execute during LLM calls.
        skip_citation_strip: Optional skipping of citation stripping, if you want to keep in the context.
        evidence_text_only_fallback: Opt-in flag to allow retrying context creation
            without media in the completion.
        _prior_attempt: Optional failure from a prior attempt, for LLM result tracking.

    Returns:
        A two-tuple of the made Context, and any LLM results made along the way.
    """
    if _prior_attempt is not None:
        llm_results = _prior_attempt.llm_results
        append_msgs = [
            Message(
                content=(
                    "In a prior attempt, we failed with this failure message:"
                    f" {_prior_attempt!s}."
                )
            )
        ]
    else:
        llm_results, append_msgs = [], []
    extras: dict[str, Any] = {}
    citation = text.name + ": " + text.doc.formatted_citation
    used_text_only_fallback = False

    # Strip newlines in case chunking led to blank lines,
    # but not spaces, to preserve text alignment
    cleaned_text = text.text.strip("\n") or "(no text)"
    if summary_llm_model and prompt_templates:
        unique_media = list(dict.fromkeys(text.media))  # Preserve order
        table_texts: list[str] = [
            m.text for m in unique_media if m.info.get("type") == "table" and m.text
        ]
        data = {
            "question": question,
            "citation": citation,
            "text": (
                text_with_tables_prompt_template.format(
                    text=cleaned_text,
                    citation=citation,
                    tables="\n\n".join(table_texts),
```

### Core Architecture Module: `src/paperqa/utils.py`
```
import asyncio
import contextlib
import hashlib
import logging
import logging.config
import math
import os
import re
import unicodedata
from collections import Counter
from collections.abc import Awaitable, Callable, Collection, Iterable, Iterator, Mapping
from datetime import datetime
from functools import partial, reduce
from http import HTTPStatus
from pathlib import Path
from typing import Any, BinaryIO, ClassVar, TypeVar
from uuid import UUID, uuid4

import httpx
from lmi import configure_llm_logs
from pybtex.database import Person, parse_string
from pybtex.database.input.bibtex import Parser
from pybtex.style.formatting import unsrtalpha
from pybtex.style.template import FieldIsMissing
from tenacity import (
    AsyncRetrying,
    before_sleep_log,
    retry_if_exception,
    stop_after_attempt,
    wait_incrementing,
)

logger = logging.getLogger(__name__)

MAX_TEXT_ENTROPY = 8.0

T = TypeVar("T")


class ImpossibleParsingError(Exception):
    """Error to throw when a parsing is impossible."""

    LOG_METHOD_NAME: ClassVar[str] = "warning"


# UTF-8 encoding-related failures can be caught using this regex
INVALID_UNICODE_CHARS = re.compile(r"[\x00\uD800-\uDFFF]")
REPLACEMENT_CHAR = "\ufffd"  # �


def clean_invalid_unicode(text: str, repl: str = REPLACEMENT_CHAR) -> str:
    r"""Clean invalid Unicode chars by replacing them with the replacement character.

    Handles the following characters:
    - Null bytes (\\x00): Invalid in UTF-8 encoded databases.
    - Orphaned surrogates (U+D800 to U+DFFF): Reserved for UTF-16 encoding and
      should not appear in Unicode strings.
    """
    return INVALID_UNICODE_CHARS.sub(repl, text)


def name_in_text(name: str, text: str) -> bool:
    sname = name.strip()
    pattern = rf"\b({re.escape(sname)})\b(?!\w)"
    return bool(re.search(pattern, text))


def maybe_is_text(s: str, thresh: float = 2.5) -> bool:
    """
    Calculate the entropy of the string to discard files with excessively repeated symbols.

    PDF parsing sometimes represents horizontal distances between words on title pages
    and in tables with spaces, which should therefore not be included in this calculation.
    """
    if not s:
        return False

    s_wo_spaces = s.replace(" ", "")
    if not s_wo_spaces:
        return False

    counts = Counter(s_wo_spaces)
    entropy = 0.0
    length = len(s_wo_spaces)
    for count in counts.values():
        p = count / length
        entropy += -p * math.log2(p)

    # Check if the entropy is within a reasonable range for text
    return MAX_TEXT_ENTROPY > entropy > thresh


def maybe_is_pdf(file: BinaryIO) -> bool:
    magic_number = file.read(4)
    file.seek(0)
    return magic_number == b"%PDF"


def maybe_is_html(file: BinaryIO) -> bool:
    magic_number = file.read(4)
    file.seek(0)
    return magic_number in {b"<htm", b"<!DO", b"<xsl", b"<!X"}


def strings_similarity(s1: str, s2: str, case_insensitive: bool = True) -> float:
    if not s1 or not s2:
        return 0

    # break the strings into words
    ss1 = set(s1.lower().split()) if case_insensitive else set(s1.split())
    ss2 = set(s2.lower().split()) if case_insensitive else set(s2.split())

    # return the similarity ratio
    return len(ss1.intersection(ss2)) / len(ss1.union(ss2))


def hexdigest(data: str | bytes) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.md5(data).hexdigest()  # noqa: S324


def md5sum(file_path: str | os.PathLike) -> str:
    return hexdigest(Path(file_path).read_bytes())


def strip_citations(text: str) -> str:
    # Combined regex for identifying citations (see unit tests for examples)
    citation_regex = r"\b[\w\-]+\set\sal\.\s\([0-9]{4}\)|\((?:[^\)]*?[a-zA-Z][^\)]*?[0-9]{4}[^\)]*?)\)"
    # Remove the citations from the text
    return re.sub(citation_regex, "", text, flags=re.MULTILINE)


def extract_score(text: str) -> int:
    """
    Extract an integer score from the text in 0 to 10.

    Note: score is 1-10, and we use 0 as a sentinel for not applicable.
    """
    # Check for N/A, not applicable, not relevant.
    # Don't check for NA, as there can be genes containing "NA"
    last_line = text.rsplit("\n", maxsplit=1)[-1]
    if (
        "n/a" in last_line.lower()
        or "not applicable" in text.lower()
        or "not relevant" in text.lower()
    ):
        return 0

    score = re.search(r"[sS]core[:is\s]+([0-9]+)", text)
    if not score:
        score = re.search(r"\(([0-9])\w*\/", text)
    if not score:
        score = re.search(r"([0-9]+)\w*\/", text)
    if score:
        s = int(score.group(1))
        if s > 10:  # noqa: PLR2004
            s = int(s / 10)  # sometimes becomes out of 100
        return s
    last_few = text[-15:]
    scores = re.findall(r"([0-9]+)", last_few)
    if scores:
        s = int(scores[-1])
        if s > 10:  # noqa: PLR2004
            s = int(s / 10)  # sometimes becomes out of 100
        return s
    raise ValueError(f"Failed to extract score from text {text!r}.")


def get_parenthetical_substrings(text: str) -> list[str]:
    """
    Finds the all nested parenthetical substrings.

    Args:
        text: The input string to analyze.

    Returns:
        A list of parenthetical substrings.
    """
    substrings = []
    open_paren_indices = []
    for i, char in enumerate(text):
        if char == "(":
            open_paren_indices.append(i)
        elif char == ")" and open_paren_indices:
            start_index = open_paren_indices.pop()
            substrings.append(text[start_index : i + 1])
    return substrings


def get_citation_ids(text: str) -> list[str]:
    matches = re.findall(r"\bpqac-[a-zA-Z0-9]{8}\b", text)
    # remove duplicates while preserving order
    return list(dict.fromkeys(matches))


def extract_doi(reference: str) -> str:
    """
    Extracts DOI from the reference string using regex.

    :param reference: A string containing the reference.
    :return: A string containing the DOI link or a message if DOI is not found.
    """
    # DOI regex pattern
    doi_pattern = r"10.\d{4,9}/[-._;()/:A-Z0-9]+"
    doi_match = re.search(doi_pattern, reference, re.IGNORECASE)

    # If DOI is found in the reference, return the DOI link
    if doi_match:
        return "https://doi.org/" + doi_match.group()
    return ""


def batch_iter(iterable: list, n: int = 1) -> Iterator[list]:
    """
    Batch an iterable into chunks of size n.

    :param iterable: The iterable to batch
    :param n: The size of the batches
    :return: A list of batches
    """
    length = len(iterable)
    for ndx in range(0, length, n):
        yield iterable[ndx : min(ndx + n, length)]


def get_loop() -> asyncio.AbstractEventLoop:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop


def run_or_ensure(coro: Awaitable[T]) -> T | asyncio.Task[T]:
    """Run a coroutine or convert to a future if an event loop is running."""
    loop = get_loop()
    if loop.is_running():  # In async contexts (e.g., Jupyter notebook), return a Task
        return asyncio.ensure_future(coro)
    return loop.run_until_complete(coro)


def encode_id(value: str | bytes | UUID, maxsize: int | None = 16) -> str:
    """Encode a value (e.g. a DOI) optionally with a max length."""
    if isinstance(value, UUID):
        value = str(value)
    if isinstance(value, str):
        value = value.lower().encode()
    return hashlib.md5(value).hexdigest()[:maxsize]  # noqa: S324


def compute_unique_doc_id(doi: str | None, content_hash: str | None) -> str:
    if doi:
        value_to_encode: str = doi.lower() + (content_hash or "")
    else:
        value_to_encode = content_hash or str(uuid4())
    return encode_id(value_to_encode)


def get_year(ts: datetime | None = None) -> str:
    """Get the year from the input datetime, otherwise using the current datetime."""
    if ts is None:
        ts = datetime.now()
    return ts.strftime("%Y")


class CitationConversionError(Exception):
    """Exception to throw when we can't process a citation from a BibTeX."""


def clean_upbibtex(bibtex: str) -> str:

    if not bibtex:
        return bibtex

    mapping = {
        "None": "article",
        "Article": "article",
        "JournalArticle": "article",
        "Review": "article",
        "Book": "book",
        "BookSection": "inbook",
        "ConferencePaper": "inproceedings",
        "Conference": "inproceedings",
        "Dataset": "misc",
        "Dissertation": "phdthesis",
        "Journal": "article",
        "Patent": "patent",
        "Preprint": "article",
        "Report": "techreport",
        "Thesis": "phdthesis",
        "WebPage": "misc",
        "Plain": "article",
    }
    if "@None" in bibtex:
        return bibtex.replace("@None", "@article")
    match = re.findall(r"@\['(.*)'\]", bibtex)
    if not match:
        match = re.findall(r"@(\w+)\{", bibtex)
        bib_type = match[0]
        current = f"@{match[0]}"
    else:
        bib_type = match[0]
        current = f"@['{bib_type}']"
    for k, v in mapping.items():
        # can have multiple
        if k in bib_type:
            bibtex = bibtex.replace(current, f"@{v}")
            break
    return bibtex


def format_bibtex(
    bibtex: str,
    key: str | None = None,
    clean: bool = True,
    missing_replacements: Mapping[str, str | list[str]] | None = None,
) -> str:
    """Transform bibtex entry into a citation, potentially adding missing fields."""
    if missing_replacements is None:
        missing_replacements = {}
    if key is None:
        key = bibtex.split("{")[1].split(",")[0]
    style = unsrtalpha.Style()
    try:
        bd = parse_string(clean_upbibtex(bibtex) if clean else bibtex, "bibtex")
    except Exception:
        return "Ref " + key
    try:
        entry = bd.entries[key]
    except KeyError as exc:  # Let's check if key is a non-empty prefix
        try
```

### Core Architecture Module: `packages/paper-qa-docling/src/paperqa_docling/__init__.py`
```
"""Docling-backed readers for PaperQA."""

from .reader import parse_pdf_to_pages

__all__ = ["parse_pdf_to_pages"]

```

### Core Architecture Module: `packages/paper-qa-docling/src/paperqa_docling/reader.py`
```
import collections
import io
import json
import os
from collections.abc import Mapping
from importlib.metadata import version
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

import docling
from docling.backend.docling_parse_backend import DoclingParseDocumentBackend
from docling.datamodel.base_models import ConversionStatus
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.settings import DEFAULT_PAGE_RANGE
from docling.document_converter import DocumentConverter, InputFormat, PdfFormatOption
from docling.exceptions import ConversionError
from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline
from docling_core.types.doc import (
    DescriptionAnnotation,
    DocItem,
    FormulaItem,
    PictureItem,
    TableItem,
    TextItem,
)
from paperqa.types import ParsedMedia, ParsedMetadata, ParsedText
from paperqa.utils import ImpossibleParsingError

if TYPE_CHECKING:
    from docling.backend.abstract_backend import AbstractDocumentBackend

DOCLING_VERSION = version(docling.__name__)
DOCLING_IMAGES_SCALE_PER_DPI = (
    72  # SEE: https://github.com/docling-project/docling/issues/2405
)


def parse_pdf_to_pages(  # noqa: PLR0912
    path: str | os.PathLike,
    page_size_limit: int | None = None,
    page_range: int | tuple[int, int] | None = None,
    parse_media: bool = True,
    pipeline_cls: type = StandardPdfPipeline,
    dpi: int | None = None,
    custom_pipeline_options: Mapping[str, Any] | None = None,
    backend: "type[AbstractDocumentBackend]" = DoclingParseDocumentBackend,
    **_,
) -> ParsedText:
    """Parse a PDF.

    Args:
        path: Path to the PDF file to parse.
        page_size_limit: Sensible character limit one page's text,
            used to catch bad PDF reads.
        parse_media: Flag to also parse media (e.g. images, tables).
        pipeline_cls: Optional custom pipeline class for document conversion.
            Default is Docling's standard PDF pipeline.
        dpi: Optional DPI (dots per inch) for image resolution,
            if left unspecified Docling's default 1.0 scale will be employed.
        custom_pipeline_options: Optional keyword arguments to use to construct the
            PDF pipeline's options.
        page_range: Optional start_page or two-tuple of inclusive (start_page, end_page)
            to parse only specific pages, where pages are one-indexed.
            Leaving as the default of None will parse all pages.
        backend: PDF backend class to use for parsing, defaults to docling-parse.
        **_: Thrown away kwargs.
    """
    path = Path(path)

    if parse_media:
        pipeline_options = PdfPipelineOptions(
            generate_picture_images=True,
            generate_table_images=True,
            images_scale=1.0 if dpi is None else dpi / DOCLING_IMAGES_SCALE_PER_DPI,
            **(custom_pipeline_options or {}),
        )
    else:
        pipeline_options = PdfPipelineOptions(**(custom_pipeline_options or {}))

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=pipeline_options,
                pipeline_cls=pipeline_cls,
                backend=backend,
            )
        }
    )
    try:
        # NOTE: this conversion is synchronous, because many backends only support sync
        # https://github.com/docling-project/docling/issues/2229#issuecomment-3269019929
        result = converter.convert(
            path,
            page_range=(
                (page_range, page_range)
                if isinstance(page_range, int)
                else (page_range or DEFAULT_PAGE_RANGE)
            ),
        )
    except ConversionError as exc:
        raise ImpossibleParsingError(
            f"PDF reading via {docling.__name__} failed on the PDF at path {path!r},"
            " likely this PDF file is corrupt."
        ) from exc
    if result.status != ConversionStatus.SUCCESS:
        raise ImpossibleParsingError(
            f"Docling conversion failed with status {result.status.value!r}"
            f" for the PDF at path {path!r}."
        )

    doc = result.document

    # NOTE: the list value here is a two-item list of page text, page media.
    # It's mutable so we can append text and media as found
    content: dict[str, list] = collections.defaultdict(lambda: ["", []])
    total_length = count_media = 0

    for item, __ in doc.iterate_items():
        if not isinstance(item, DocItem) or not item.prov:
            raise NotImplementedError(
                f"Didn't yet handle the shape of node item {item}."
            )

        # NOTE: docling pages are 1-indexed
        page_nums = [prov.page_no for prov in item.prov]

        if isinstance(item, TextItem | FormulaItem):  # Handle items with text
            item_text = item.text
            if not item_text and isinstance(item, FormulaItem) and item.orig:
                # Sometimes the sanitization of formula text fails, so use the original
                item_text = item.orig
            for page_num in page_nums:
                new_text = (
                    item_text if not content[str(page_num)][0] else "\n\n" + item_text
                )
                total_length += len(new_text)
                if page_size_limit and total_length > page_size_limit:
                    raise ImpossibleParsingError(
                        f"The text in page {page_num} was {total_length} chars long,"
                        f" which exceeds the {page_size_limit} char limit"
                        f" for the PDF at path {path}."
                    )
                content[str(page_num)][0] += new_text

        if parse_media and isinstance(  # Handle images and formulae
            item, PictureItem | FormulaItem
        ):
            image_data = item.get_image(doc)
            if image_data:
                try:
                    (page_num,) = page_nums
                except ValueError as exc:
                    raise NotImplementedError(
                        f"Picture item spanning multiple pages {page_nums}"
                        " is not yet handled."
                    ) from exc

                # Convert PIL Image to bytes (PNG format)
                img_bytes = io.BytesIO()
                image_data.save(img_bytes, format="PNG")
                img_bytes.seek(0)  # Reset pointer before read to avoid empty data

                media_metadata = {
                    "type": "formula" if isinstance(item, FormulaItem) else "picture",
                    "width": image_data.width,
                    "height": image_data.height,
                    "bbox": item.prov[0].bbox.as_tuple(),
                    "images_scale": pipeline_options.images_scale,
                }
                annotations = [
                    x
                    for x in getattr(item, "annotations", [])
                    if isinstance(x, DescriptionAnnotation)
                ]
                if len(annotations) == 1:
                    # We don't set this text in ParsedMedia.text because it's
                    # a synthetic description, not actually text in the PDF,
                    # and we don't want citations going to synthetic text
                    media_metadata.update(
                        {
                            "description_text": annotations[0].text,
                            "description_provenance": annotations[0].provenance,
                        }
                    )
                elif len(annotations) > 1:
                    raise NotImplementedError(
                        f"Didn't yet handle 2+ picture description annotations {annotations}."
                    )

                media_metadata["info_hashable"] = json.dumps(
                    {
                        k: (
                            v
                            if k != "bbox"
                            # Enables bbox deduplication based on whole pixels,
                            # since <1-px differences are just noise
                            else tuple(round(x) for x in cast(tuple, v))
                        )
                        for k, v in media_metadata.items()
                    },
                    sort_keys=True,
                )
                # Add page number after info_hashable so differing pages
                # don't break the cache key
                media_metadata["page_num"] = page_num
                content[str(page_num)][1].append(
                    ParsedMedia(
                        index=len(content[str(page_num)][1]),
                        data=img_bytes.read(),
                        info=media_metadata,
                    )
                )
                count_media += 1

        elif parse_media and isinstance(item, TableItem):  # Handle tables
            table_image_data = item.get_image(doc)
            if table_image_data:
                try:
                    (page_num,) = page_nums
                except ValueError as exc:
                    raise NotImplementedError(
                        f"Table item spanning multiple pages {page_nums}"
                        " is not yet handled."
                    ) from exc

                img_bytes = io.BytesIO()
                table_image_data.save(img_bytes, format="PNG")
                img_bytes.seek(0)  # Reset pointer before read to avoid empty data

                media_metadata = {
                    "type": "table",
                    "width": table_image_data.width,
                    "height": table_image_data.height,
                    "bbox": item.prov[0].bbox.as_tuple(),
                    "images_scale": pipeline_options.images_scale,
                }
                media_metadata["info_hashable"] = json.dumps(
                    {
                        k: (
                            v
                            if k != "bbox"
                            # Enab
```

### Core Architecture Module: `packages/paper-qa-nemotron/src/paperqa_nemotron/__init__.py`
```
"""Nvidia nemotron-backed readers for PaperQA."""

from .reader import parse_pdf_to_pages

__all__ = ["parse_pdf_to_pages"]

```

### Core Architecture Module: `packages/paper-qa-nemotron/src/paperqa_nemotron/api.py`
```
"""
Driver for PaperQA using Nvidia's nemotron-parse VLM.

For more info on nemotron-parse, check out:
- Technical blog: https://developer.nvidia.com/blog/turn-complex-documents-into-usable-data-with-vlm-nvidia-nemotron-parse-1-1/
- Hugging Face weights: https://huggingface.co/nvidia/NVIDIA-Nemotron-Parse-v1.1
- Model card: https://build.nvidia.com/nvidia/nemotron-parse/modelcard
- API docs: https://docs.nvidia.com/nim/vision-language-models/1.5.0/examples/nemotron-parse/overview.html#nemotron-parse-overview
- Cookbook: https://github.com/NVIDIA-NeMo/Nemotron/blob/main/usage-cookbook/Nemotron-Parse-v1.1/build_general_usage_cookbook.ipynb
- AWS Marketplace: https://aws.amazon.com/marketplace/pp/prodview-ny2ngku2i4ge6
"""

import contextlib
import http
import json
import logging
import os
from enum import StrEnum, unique
from typing import (
    TYPE_CHECKING,
    Annotated,
    Literal,
    Self,
    TypeAlias,
    assert_never,
    cast,
    overload,
)
from unittest.mock import patch

import litellm
from aviary.core import Message, ToolCall
from lmi.rate_limiter import GLOBAL_LIMITER, GLOBAL_RATE_LIMITER_TIMEOUT
from pydantic import (
    AfterValidator,
    BaseModel,
    Field,
    TypeAdapter,
    ValidationError,
    ValidationInfo,
)
from tenacity import (
    RetryCallState,
    before_sleep_log,
    retry,
    retry_any,
    retry_if_exception,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

try:
    from aiobotocore.session import get_session
except ImportError:
    get_session = None  # type: ignore[assignment]

if TYPE_CHECKING:
    import numpy as np
    from limits import RateLimitItem

logger = logging.getLogger(__name__)

NVIDIA_API_NEMOTRON_PARSE_RATE_LIMIT = (
    "40 per 1 minute"  # Default rate for Nvidia's API
)


class NemotronLengthError(ValueError):
    r"""
    Error for nemotron-parse running out of context, indicated by the 'length' finish reason.

    This 'length' finish reason comes from the Nvidia NIM wrapping
    nemotron-parse version 1.1 when the model starts babbling (e.g. repeating '\\n').
    It's been seen with the markdown_bbox tool on large figures.
    Retrying is a possible method to skirt this error, but it's a bad idea
    as a 'length' finish reason means nemotron-parse ran out of context,
    and retrying until success just provides a flawed output.
    """


class NemotronBBoxError(ValueError):
    """
    Error for nemotron-parse returning an invalid bounding box.

    Examples include values outside of [0, 1] or a non-positive gap between min and max.
    """


NemotronParseToolName: TypeAlias = Literal[
    "markdown_bbox", "markdown_no_bbox", "detection_only"
]

# nemotron-parse resizes each input image (preserving aspect ratio) to fit within this
# target height x width canvas. These are the model's native input dimensions:
# https://huggingface.co/nvidia/NVIDIA-Nemotron-Parse-v1.1/blob/fd1e3c6ba0b61a6dcab5a905f0ff92c5b19f14a4/preprocessor_config.json#L22-L33
NEMOTRON_PARSE_TARGET_HEIGHT = 2048  # px
NEMOTRON_PARSE_TARGET_WIDTH = 1648  # px


class NemotronParseBBox(BaseModel):
    """
    Bounding box, values target the range [0, 1], origin is upper left corner.

    In practice, nemotron-parse commonly gives values outside of [0, 1]
    at temperature of 1, but a re-request can get values inside [0, 1].
    """

    @staticmethod
    def validate_min_less_than_max(v: float, info: ValidationInfo) -> float:
        if info.field_name in {"xmax", "ymax"}:
            min_field_name = info.field_name.replace("max", "min")
            with contextlib.suppress(KeyError):
                if info.data[min_field_name] >= v:
                    raise ValueError(
                        f"{min_field_name} must be less than {info.field_name}."
                    )
        return v

    xmin: float = Field(
        description="Lower bound, when looking right across (horizontally) the page.",
        examples=[0.33],
        ge=0,
        le=1,
    )
    xmax: Annotated[
        float,
        Field(
            description="Upper bound, when looking right across (horizontally) the page.",
            examples=[0.65],
            ge=0,
            le=1,
        ),
        AfterValidator(validate_min_less_than_max),
    ]
    ymin: float = Field(
        description="Lower bound, when looking down (vertically) the page.",
        examples=[0.26],
        ge=0,
        le=1,
    )
    ymax: Annotated[
        float,
        Field(
            description="Upper bound, when looking down (vertically) the page.",
            examples=[0.34],
            ge=0,
            le=1,
        ),
        AfterValidator(validate_min_less_than_max),
    ]

    @classmethod
    def from_coordinates(
        cls, coords: tuple[float, float, float, float]
    ) -> "NemotronParseBBox":
        """Create a bbox from a (xmin, xmax, ymin, ymax) tuple."""
        return cls(xmin=coords[0], xmax=coords[1], ymin=coords[2], ymax=coords[3])

    def to_page_coordinates(
        self, height: float, width: float
    ) -> tuple[float, float, float, float]:
        return (
            self.xmin * width,
            self.ymin * height,
            self.xmax * width,
            self.ymax * height,
        )

    def to_original_coordinates(
        self,
        height: float,
        width: float,
        target_height: int = NEMOTRON_PARSE_TARGET_HEIGHT,
        target_width: int = NEMOTRON_PARSE_TARGET_WIDTH,
    ) -> tuple[float, float, float, float]:
        """Map this canvas-normalized bbox to original-image pixel coordinates.

        Port of https://huggingface.co/nvidia/NVIDIA-Nemotron-Parse-v1.1/blob/fd1e3c6ba0b61a6dcab5a905f0ff92c5b19f14a4/postprocessing.py#L23-L53

        nemotron-parse resizes each input image (preserving aspect ratio)
        and center-pads it to a `target_height` x `target_width` canvas,
        then emits bounding boxes normalized to that padded canvas.
        SEE its image processor's LongestMaxSize resize:
        https://huggingface.co/nvidia/NVIDIA-Nemotron-Parse-v1.1/blob/fd1e3c6ba0b61a6dcab5a905f0ff92c5b19f14a4/hf_nemotron_parse_processor.py#L151-L170
        and its centered white PadIfNeeded:
        https://huggingface.co/nvidia/NVIDIA-Nemotron-Parse-v1.1/blob/fd1e3c6ba0b61a6dcab5a905f0ff92c5b19f14a4/hf_nemotron_parse_processor.py#L74-L82

        This method inverts that (the aspect-preserving resize, then centered padding)
        to recover original-image pixels. It is needed for the model's raw output,
        i.e. when you run the weights yourself via vLLM or HuggingFace `transformers`,
        as NVIDIA's example.py does:
        https://huggingface.co/nvidia/NVIDIA-Nemotron-Parse-v1.1/blob/fd1e3c6ba0b61a6dcab5a905f0ff92c5b19f14a4/example.py#L34

        NOTE: NVIDIA's hosted NIM returns coordinates already in input-image space,
        as opposed to the model's padded-canvas space, so NIM responses do not need it.
        Contrast `to_page_coordinates`, which just scales coordinates already relative to the page.

        Args:
            height: Original ("pre-letterbox") image height (px).
            width: Original ("pre-letterbox") image width (px).
            target_height: Canvas height (px) the model normalized coordinates against.
            target_width: Canvas width (px) the model normalized coordinates against.

        Returns:
            Four-tuple of (xmin, ymin, xmax, ymax), in original-image pixel coordinates.
                Returned coordinates can fall outside the image (negative, or past
                width/height) when the box overlaps the padded canvas region, matching
                NVIDIA's reference `transform_bbox_to_original`. Clamp the returned
                coordinates to the image bounds if you need in-bounds values.
        """
        aspect_ratio = width / height
        # Replicate the model's "LongestMaxSize" resize (only shrinks oversized inputs)
        resized_width, resized_height = width, height
        if height > target_height:
            resized_height = target_height
            resized_width = int(resized_height * aspect_ratio)
        if resized_width > target_width:
            resized_width = target_width
            resized_height = int(resized_width / aspect_ratio)
        # Centered padding (matching the Albumentations PadIfNeeded)
        # SEE: https://huggingface.co/nvidia/NVIDIA-Nemotron-Parse-v1.1/blob/fd1e3c6ba0b61a6dcab5a905f0ff92c5b19f14a4/hf_nemotron_parse_processor.py#L74-L82
        pad_left = (target_width - resized_width) // 2
        pad_top = (target_height - resized_height) // 2
        return (
            (self.xmin * target_width - pad_left) * width / resized_width,
            (self.ymin * target_height - pad_top) * height / resized_height,
            (self.xmax * target_width - pad_left) * width / resized_width,
            (self.ymax * target_height - pad_top) * height / resized_height,
        )

    def iou(self, other: "NemotronParseBBox") -> float:
        """Calculate the Intersection over Union (IoU) with another bounding box.

        Args:
            other: The other bounding box to compare with.

        Returns:
            IoU score in range [0, 1], where 1 means perfect overlap.
        """
        # Calculate intersection coordinates
        inter_xmin = max(self.xmin, other.xmin)
        inter_ymin = max(self.ymin, other.ymin)
        inter_xmax = min(self.xmax, other.xmax)
        inter_ymax = min(self.ymax, other.ymax)

        # Calculate intersection area (0 if no overlap) and then the union area
        intersection = max(0, inter_xmax - inter_xmin) * max(0, inter_ymax - inter_ymin)
        self_area = (self.xmax - self.xmin) * (self.ymax - self.ymin)
        other_area = (other.xmax - other.xmin) * (other.ymax - other.ymin)
        union = self_area + other_area - intersection
        return intersection / union if union > 0 else 0.0

    def union(self, other: "NemotronParseBBox") -> Self:
        """Create a sup
```

### Core Architecture Module: `packages/paper-qa-nemotron/src/paperqa_nemotron/reader.py`
```
"""Reader for PaperQA using Nvidia's nemotron-parse VLM."""

import asyncio
import io
import json
import logging
import os
from collections.abc import Awaitable, Mapping
from concurrent.futures import ProcessPoolExecutor
from contextlib import closing
from typing import Any, Literal, cast

import litellm
import numpy as np
import pypdfium2 as pdfium
from aviary.core import encode_image_to_base64
from lmi.utils import gather_with_concurrency
from paperqa.readers import PDFParserFn, resolve_page_range
from paperqa.settings import ParsingSettings
from paperqa.types import ParsedMedia, ParsedMetadata, ParsedText
from paperqa.utils import ImpossibleParsingError
from PIL import Image
from tenacity import RetryError

from paperqa_nemotron.api import (
    CLASSIFICATIONS_WITH_MEDIA,
    NemotronBBoxError,
    NemotronLengthError,
    NemotronParseAnnotatedBBox,
    NemotronParseClassification,
    NemotronParseMarkdownBBox,
    _call_nvidia_api,
    _call_sagemaker_api,
)

logger = logging.getLogger(__name__)

WHITE_RGB = (255, 255, 255)
# On DOI 10.1016/j.neuron.2011.12.023, 36-px was an insufficient border,
# then on DOI 10.1111/jnc.13398, 42-px was an insufficient border,
# then on DOI 10.1016/j.neuron.2011.12.023 (again), 56-px was an insufficient border,
# all with temperature of 0 and DPI 300
DEFAULT_BORDER_SIZE = 60  # pixels


def pad_image_with_border(
    image: "Image.Image",
    border: int | tuple[int, int] = DEFAULT_BORDER_SIZE,
    pad_color: float | tuple[float, ...] | str = WHITE_RGB,
) -> "tuple[Image.Image, int, int]":
    """Pad image with colored borders.

    Padding the border can improve nemotron-parse performance
    because now there's room to bound PDF artwork that extends to the edge of the PDF.
    Without a border margin, the bounding box can extend beyond [0, 1].

    Args:
        image: Image to pad.
        border: Border size (pixels) to add on all sides.
            If a two-tuple it's the x border and y border,
            otherwise both x and y borders are symmetric.
        pad_color: Color to use for padding, default is white.

    Returns:
        Three-tuple of padded image and x + y image offset (pixels), where offsets
            indicate where the original image starts in the padded image.
    """
    border_x, border_y = border if isinstance(border, tuple) else (border, border)

    # Create canvas with border on all sides, while not manipulating the original image
    orig_w, orig_h = image.size
    canvas = Image.new(
        image.mode, (orig_w + 2 * border_x, orig_h + 2 * border_y), pad_color  # type: ignore[arg-type]
    )
    # Paste original image onto canvas with border offset
    canvas.paste(image, (border_x, border_y))
    return canvas, border_x, border_y


def _render_page(
    path: str,
    page_num: int,
    dpi: int | None = 300,
    border: int | tuple[int, int] = DEFAULT_BORDER_SIZE,
    needs_bbox: bool = True,
    page_range: int | tuple[int, int] | None = None,
) -> tuple[int, str, "Image.Image", int, int, int, int]:
    """Render a single PDF page and pre-encode the API image as a base64 data URI.

    NOTE: keep this top-level for pickling support.

    Returns:
        Seven-tuple of (page_num, image_data_uri, rendered_page_pil,
            padded_height, padded_width, offset_x, offset_y).
    """
    pdf_doc = pdfium.PdfDocument(path)
    with closing(pdf_doc):
        try:
            page = pdf_doc[page_num]
        except pdfium.PdfiumError as pdfium_exc:
            if not 0 <= page_num < len(pdf_doc):
                raise ValueError(
                    f"Page range {page_range}'s value {page_num} is outside"
                    f" the size of document {path!r}."
                ) from pdfium_exc
            raise

        render_kwargs: dict[str, Any] = {}
        if dpi is not None:
            render_kwargs["scale"] = dpi / 72

        rendered_page = page.render(**render_kwargs)
        rendered_page_pil = rendered_page.to_pil()
        if needs_bbox:
            # Apply white border padding to increase bounding box reliability
            padded_pil, offset_x, offset_y = pad_image_with_border(
                rendered_page_pil, border
            )
            image_data_uri = encode_image_to_base64(padded_pil, format="PNG")
            padded_height, padded_width = padded_pil.height, padded_pil.width
        else:
            image_data_uri = encode_image_to_base64(rendered_page_pil, format="PNG")
            offset_x = offset_y = padded_height = padded_width = 0

    return (
        page_num,
        image_data_uri,
        rendered_page_pil,
        padded_height,
        padded_width,
        offset_x,
        offset_y,
    )


async def parse_pdf_to_pages(
    path: str | os.PathLike,
    page_size_limit: int | None = None,
    page_range: int | tuple[int, int] | None = None,
    parse_media: bool = True,
    full_page: bool = False,
    dpi: int | None = 300,
    api_params: Mapping[str, Any] | None = None,
    concurrency: int | asyncio.Semaphore | None = 128,
    border: int | tuple[int, int] = DEFAULT_BORDER_SIZE,
    failover_parser: str | PDFParserFn | None = None,
    num_workers: int = min(os.cpu_count() or 1, 4),
    **kwargs: Any,
) -> ParsedText:
    """Parse a PDF using Nvidia's nemotron-parse VLM.

    Args:
        path: Path to the PDF file to parse.
        page_size_limit: Sensible character limit one page's text,
            used to catch bad PDF reads.
        page_range: Optional start_page or two-tuple of inclusive (start_page, end_page)
            to parse only specific pages, where pages are one-indexed.
            Leaving as the default of None will parse all pages.
        parse_media: Flag to also parse media (e.g. images, tables).
        full_page: Set True to screenshot the entire page as one image,
            instead of parsing individual images or tables.
        dpi: Optional DPI (dots per inch) for image resolution,
            if set as None then pypdfium2's default 1 scale will be employed.
        api_params: Optional parameters to pass to the nemotron-parse API.
        concurrency: Optional concurrency semaphore on concurrent processing of pages,
            use to put a ceiling on memory usage. Default is 128 to prioritize reader
            speed over memory, but not get obliterated by huge 1000-page PDFs.
            Set as None to disable concurrency limits, processing all pages at once.
        border: Border size (pixels) to add on all sides.
            If a two-tuple it's the x border and y border,
            otherwise both x and y borders are symmetric.
        failover_parser: Optional PDF parser to use when nemotron-parse fails on a
            given page. Can be a callable or an importable fully qualified name.
            Any metadata from the failover reader is not used (as of now).
        num_workers: Number of worker processes for parallel page rendering,
            default targets 4 processes.
        **kwargs: Keyword arguments passed to the failover parser, if specified.
            Otherwise they are thrown away.

    Returns:
        ParsedText with parsed content and metadata.
    """
    if failover_parser is not None:
        failover_parser = ParsingSettings._resolve_parse_pdf(failover_parser)

    try:
        pdf_doc = pdfium.PdfDocument(path)
    except pdfium.PdfiumError as exc:
        raise ImpossibleParsingError(
            f"PDF reading via {pdfium.__name__} failed on the PDF at path {path!r},"
            " likely this PDF file is corrupt."
        ) from exc
    api_params = {"model_name": "nvidia/nemotron-parse"} | dict(api_params or {})
    if api_params["model_name"].startswith("sagemaker/"):
        api_params["model_name"] = api_params["model_name"].removeprefix("sagemaker/")
        call_fn = _call_sagemaker_api
    else:
        call_fn = _call_nvidia_api  # type: ignore[assignment]

    with closing(pdf_doc):
        page_count = len(pdf_doc)

    # Pre-render and send to model API in a pipeline
    needs_bbox = parse_media and not full_page
    path_str = str(path)
    render_args = [
        (path_str, i, dpi, border, needs_bbox, page_range)
        for i in resolve_page_range(page_range, page_count)
    ]
    render_kwargs: dict[str, Any] = {}
    if dpi is not None:
        render_kwargs["scale"] = dpi / 72

    async def call_failover(
        page_num: int, cause_exc: BaseException
    ) -> tuple[str, str | tuple[str, list[ParsedMedia]]]:
        logger.warning(
            f"Falling back to failover parser {failover_parser} for page {page_num}"
            f" of {path!r} due to {type(cause_exc).__name__}."
        )
        fallback_parsed_text = cast(PDFParserFn, failover_parser)(
            path,
            page_size_limit=page_size_limit,
            page_range=page_num,
            parse_media=parse_media,
            full_page=full_page,
            dpi=dpi,
            api_params=api_params,
            concurrency=concurrency,
            border=border,
            **kwargs,
        )
        if isinstance(fallback_parsed_text, Awaitable):
            fallback_parsed_text = await fallback_parsed_text
        if not isinstance(fallback_parsed_text.content, dict):
            raise NotImplementedError(
                f"Didn't yet handle the fallback parser {failover_parser}"
                " not giving dictionary content, got"
                f" {type(fallback_parsed_text.content).__name__}."
            ) from cause_exc
        return str(page_num), fallback_parsed_text.content[str(page_num)]

    async def process_page(
        i: int,
        image_data_uri: str,
        rendered_page_pil: "Image.Image",
        padded_height: int,
        padded_width: int,
        offset_x: int,
        offset_y: int,
    ) -> tuple[str, str | tuple[str, list[ParsedMedia]]]:
        """Process a pre-rendered page via the API and return its content."""
        tool_name: Literal["markdown_bbox", "markdown_no_bbox"] = (
            "markdow
```

### Core Architecture Module: `packages/paper-qa-pymupdf/src/paperqa_pymupdf/__init__.py`
```
from .reader import BLOCK_TEXT_INDEX, parse_pdf_to_pages, setup_pymupdf_python_logging

__all__ = [
    "BLOCK_TEXT_INDEX",
    "parse_pdf_to_pages",
    "setup_pymupdf_python_logging",
]

```

### Core Architecture Module: `packages/paper-qa-pymupdf/src/paperqa_pymupdf/reader.py`
```
import json
import os
from itertools import starmap
from multiprocessing import Pool

import pymupdf
from paperqa.readers import resolve_page_range
from paperqa.types import ParsedMedia, ParsedMetadata, ParsedText
from paperqa.utils import ImpossibleParsingError, clean_invalid_unicode
from pydantic import JsonValue


def setup_pymupdf_python_logging() -> None:
    """
    Configure PyMuPDF to use Python logging.

    SEE: https://pymupdf.readthedocs.io/en/latest/app3.html#diagnostics
    """
    pymupdf.set_messages(pylogging=True)


BLOCK_TEXT_INDEX = 4
# Attributes of pymupdf.Pixmap that contain useful metadata
PYMUPDF_PIXMAP_ATTRS = {
    "alpha",
    # YAGNI on "digest" because it's not JSON serializable
    "height",
    "irect",
    "is_monochrome",
    "is_unicolor",
    "n",
    "size",
    "stride",
    "width",
    "x",
    "xres",
    "y",
    "yres",
}


def _extract_page_text(
    file: pymupdf.Document,
    page_num: int,
    path: str | os.PathLike,
    use_block_parsing: bool,
    page_size_limit: int | None = None,
) -> tuple[pymupdf.Page, str]:
    """Load a PDF page and extract its text.

    Args:
        file: An open (assumed) PyMuPDF document.
        page_num: Zero-indexed page number to load.
        path: Path to the PDF file (used in error messages).
        use_block_parsing: If True, extract text block-wise,
            preserving the order of text blocks as they appear in the PDF.
        page_size_limit: Optional character limit for a single page's text.

    Returns:
        A two-tuple of loaded PyMuPDF page and extracted text.

    Raises:
        ImpossibleParsingError: If the page cannot be loaded or its text
            exceeds page_size_limit.
    """
    try:
        page = file.load_page(page_num)
    except pymupdf.mupdf.FzErrorFormat as exc:
        raise ImpossibleParsingError(
            f"Page loading via {pymupdf.__name__} failed on page {page_num} of"
            f" {file.page_count} for the PDF at path {path}, likely this PDF"
            " file is corrupt."
        ) from exc

    if use_block_parsing:
        # NOTE: this block-based parsing appears to be better, but until
        # fully validated on 1+ benchmarks, it's considered experimental

        # Extract text blocks from the page
        # Note: sort=False is important to preserve the order of text blocks
        # as they appear in the PDF
        blocks = page.get_text("blocks", sort=False)

        # Concatenate text blocks into a single string
        text = "\n".join(
            block[BLOCK_TEXT_INDEX] for block in blocks if len(block) > BLOCK_TEXT_INDEX
        )
    else:
        text = page.get_text("text", sort=True)

    if page_size_limit and len(text) > page_size_limit:
        raise ImpossibleParsingError(
            f"The text in page {page_num} of {file.page_count} was {len(text)}"
            f" chars long, which exceeds the {page_size_limit} char limit for"
            f" the PDF at path {path}."
        )
    return page, text


def _parse_single_page_screenshot(
    path: str,
    page_num: int,
    dpi: float | None,
    page_size_limit: int | None,
    use_block_parsing: bool,
) -> tuple[int, str, list[ParsedMedia]]:
    """Worker function for parallel full-page screenshot parsing.

    NOTE: must be top-level for pickling.
    """
    with pymupdf.open(path) as file:
        page, text = _extract_page_text(
            file, page_num, path, use_block_parsing, page_size_limit
        )
        pix = page.get_pixmap(dpi=dpi)
        media_metadata: dict[str, JsonValue] = {"type": "screenshot"} | {
            a: getattr(pix, a) for a in PYMUPDF_PIXMAP_ATTRS
        }
        media_metadata["info_hashable"] = json.dumps(media_metadata, sort_keys=True)
        # Add page number after info_hashable so differing pages
        # don't break the cache key
        media_metadata["page_num"] = page_num + 1
        media = [ParsedMedia(index=0, data=pix.tobytes(), info=media_metadata)]
    return page_num, text, media


def parse_pdf_to_pages(
    path: str | os.PathLike,
    page_size_limit: int | None = None,
    page_range: int | tuple[int, int] | None = None,
    use_block_parsing: bool = False,
    parse_media: bool = True,
    full_page: bool = False,
    image_cluster_tolerance: float | tuple[float, float] = 25,
    dpi: float | None = None,
    num_workers: int = min(os.cpu_count() or 1, 4),
    **_,
) -> ParsedText:
    """Parse a PDF.

    Args:
        path: Path to the PDF file to parse.
        page_size_limit: Sensible character limit one page's text,
            used to catch bad PDF reads.
        use_block_parsing: Opt-in flag to parse text block-wise.
        parse_media: Flag to also parse media (e.g. images, tables).
        full_page: Set True to screenshot the entire page as one image,
            instead of parsing individual images or tables.
        image_cluster_tolerance: Tolerance (points) passed to `Page.cluster_drawings`.
            Can be a single value to apply to both X and Y directions,
            or a two-tuple to specify X and Y directions separately.
            The default was chosen to perform well on image extraction from LitQA2 PDFs.
        dpi: Optional DPI (dots per inch) for image resolution,
            if left unspecified PyMuPDF's default resolution from
            pymupdf.Page.get_pixmap will be applied.
        page_range: Optional start_page or two-tuple of inclusive (start_page, end_page)
            to parse only specific pages, where pages are one-indexed.
            Leaving as the default of None will parse all pages.
        num_workers: Number of worker processes for parallel full-page screenshots,
            default targets 4 processes.
        **_: Thrown away kwargs.
    """
    x_tol, y_tol = (
        image_cluster_tolerance
        if isinstance(image_cluster_tolerance, tuple)
        else (image_cluster_tolerance, image_cluster_tolerance)
    )

    content: dict[str, str | tuple[str, list[ParsedMedia]]] = {}
    total_length = count_media = 0

    if full_page and parse_media:  # Capture the entire page as one image
        with pymupdf.open(path) as file:
            page_iter = resolve_page_range(page_range, file.page_count)
        path_str = str(path)
        args = [
            (path_str, i, dpi, page_size_limit, use_block_parsing) for i in page_iter
        ]
        if num_workers > 1:
            with Pool(num_workers) as pool:
                results = pool.starmap(_parse_single_page_screenshot, args)
        else:  # Avoid multiprocessing overhead when using just one process
            results = list(starmap(_parse_single_page_screenshot, args))
        for page_num, text, media in results:
            content[str(page_num + 1)] = text, media
            total_length += len(text)
            count_media += len(media)
    else:
        with pymupdf.open(path) as file:
            for i in resolve_page_range(page_range, file.page_count):
                page, text = _extract_page_text(
                    file, i, path, use_block_parsing, page_size_limit
                )
                media = []
                if parse_media:
                    # Capture drawings/figures
                    for box_i, box in enumerate(
                        page.cluster_drawings(
                            drawings=page.get_drawings(),
                            x_tolerance=x_tol,
                            y_tolerance=y_tol,
                        )
                    ):
                        pix = page.get_pixmap(clip=box, dpi=dpi)
                        media_metadata = {"bbox": tuple(box), "type": "drawing"} | {
                            a: getattr(pix, a) for a in PYMUPDF_PIXMAP_ATTRS
                        }
                        media_metadata["info_hashable"] = json.dumps(
                            media_metadata, sort_keys=True
                        )
                        # Add page number after info_hashable so differing pages
                        # don't break the cache key
                        media_metadata["page_num"] = i + 1
                        media.append(
                            ParsedMedia(
                                index=box_i, data=pix.tobytes(), info=media_metadata
                            )
                        )

                    # Capture tables
                    for table_i, table in enumerate(page.find_tables()):
                        pix = page.get_pixmap(clip=table.bbox, dpi=dpi)
                        media_metadata = {
                            "bbox": tuple(table.bbox),
                            "type": "table",
                        } | {a: getattr(pix, a) for a in PYMUPDF_PIXMAP_ATTRS}
                        media_metadata["info_hashable"] = json.dumps(
                            media_metadata, sort_keys=True
                        )
                        # Add page number after info_hashable so differing pages
                        # don't break the cache key
                        media_metadata["page_num"] = i + 1
                        media.append(
                            ParsedMedia(
                                index=table_i,
                                data=pix.tobytes(),
                                # On 9/14/2025, a `pymupdf.table.Table.to_markdown` stripped call returned:
                                # '|Col1|Col2|Col3|Col4|Col5|Col6|Col7|Col8|\n|---|---|---|---|---|---|---|---|\n||\x02\x03<br>|\x04\x05\x06\x07\x08<br> <br>|\x07\x08\x08<br>\n\x08<br>\x0e\x0f<br>\x17\x18\x18\x08<br>|\x02<br>\x0c\x10<br>\x11<br>\x19\r\x02\x1a\x00\x01\x02\x03<br>|\x11<br>\x12\x06\x05<br>\x0e\x13\x14\x15<br>\x04\x05\x06\x07<br>|\x05\x08<br>\x0c\x10<br>\x12\x06\x05<br>\x0e\x16\x13<br>|\x05\x08<br>\x0c\x10<br>\x12\x06\x05<br>\x0e\x16\x13<br>|'  # noqa: E501, W505
                                # This garbage led to `asyncpg==0.30.0` with a PostgreSQL 15 DB throwing:
                                # > asyncpg.e
```

### Core Architecture Module: `packages/paper-qa-pypdf/src/paperqa_pypdf/__init__.py`
```
from .reader import parse_pdf_to_pages

__all__ = [
    "parse_pdf_to_pages",
]

```

### Core Architecture Module: `packages/paper-qa-pypdf/src/paperqa_pypdf/reader.py`
```
import io
import json
import os
from contextlib import AbstractContextManager, closing, nullcontext
from enum import StrEnum, unique
from typing import TYPE_CHECKING, Any, cast

import pypdf
import pypdf.errors
from paperqa.readers import resolve_page_range
from paperqa.types import ParsedMedia, ParsedMetadata, ParsedText
from paperqa.utils import ImpossibleParsingError, clean_invalid_unicode

from .utils import cluster_bboxes

try:
    import pypdfium2 as pdfium
except ImportError:
    pdfium = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None  # type: ignore[assignment]

if TYPE_CHECKING:
    from PIL import Image


@unique
class MediaMode(StrEnum):
    """Mode for media extraction from PDFs."""

    NONE = ""  # No media extraction
    FULL_PAGE = "full-page"  # Screenshot entire page
    INDIVIDUAL_CLUSTERING = (  # Extract individual images then cluster
        "individual-clustering"
    )
    INDIVIDUAL = "individual"  # Extract individual images

    def __str__(self) -> str:
        return self.metadata_value

    @property
    def metadata_value(self) -> str:
        return self.value.removesuffix("-clustering")


# Attributes of pdfium.PdfBitmap that contain useful metadata
PDFIUM_BITMAP_ATTRS = {"width", "height", "stride", "n_channels", "mode"}


SCALE_TO_DPI = 72


def parse_pdf_to_pages(  # noqa: PLR0912
    path: str | os.PathLike,
    page_size_limit: int | None = None,
    page_range: int | tuple[int, int] | None = None,
    parse_media: bool = True,
    full_page: bool = False,
    image_cluster_tolerance: float = 50,
    image_cluster_padding: float = 10,
    dpi: float | None = None,
    **_: Any,
) -> ParsedText:
    """Parse a PDF.

    Args:
        path: Path to the PDF file to parse.
        page_size_limit: Sensible character limit one page's text,
            used to catch bad PDF reads.
        parse_media: Flag to also parse media (e.g. images, tables).
        full_page: Set True to screenshot the entire page as one image,
            instead of parsing individual images or tables. When False and
            pdfplumber is available, nearby images will be clustered into
            figure regions.
        page_range: Optional start_page or two-tuple of inclusive (start_page, end_page)
            to parse only specific pages, where pages are one-indexed.
            Leaving as the default of None will parse all pages.
        image_cluster_tolerance: Maximum distance (pixels) between images
            to consider them part of the same cluster (inclusive).
            Only used when not screenshotting pages and pdfplumber is available.
        image_cluster_padding: Padding (pixels) to add around clustered
            image regions when rendering.
            Only used when not screenshotting pages and pdfplumber is available.
        dpi: Optional DPI (dots per inch) for image resolution,
            if left unspecified pypdfium2's default 1.0 scale will be employed.
        **_: Thrown away kwargs.
    """
    render_kwargs = {}
    if dpi is not None:
        render_kwargs["scale"] = dpi / SCALE_TO_DPI
    with open(path, "rb") as file:  # noqa: PLR1702
        try:
            pdf_reader = pypdf.PdfReader(file)
        except pypdf.errors.PdfReadError as exc:
            raise ImpossibleParsingError(
                f"PDF reading via {pypdf.__name__} failed on the PDF at path {path!r},"
                " likely this PDF file is corrupt."
            ) from exc

        pages: dict[str, str | tuple[str, list[ParsedMedia]]] = {}
        total_length = count_media = 0

        match (parse_media, full_page, pdfplumber is not None):
            case (False, _, _):
                media_mode = MediaMode.NONE
            case (True, True, _):
                media_mode = MediaMode.FULL_PAGE
            case (True, False, True):
                media_mode = MediaMode.INDIVIDUAL_CLUSTERING
            case (True, False, False):
                media_mode = MediaMode.INDIVIDUAL

        if media_mode in {MediaMode.FULL_PAGE, MediaMode.INDIVIDUAL_CLUSTERING}:
            try:
                pdf_doc = pdfium.PdfDocument(str(path))
            except AttributeError as exc:
                raise ImportError(
                    "Media parsing requires 'pypdfium2' to be installed for rasterization support."
                    " Please install it via `pip install paper-qa-pypdf[media]`."
                ) from exc
            pdf_context: AbstractContextManager = closing(pdf_doc)
        else:
            pdf_context = nullcontext()

        if media_mode == MediaMode.INDIVIDUAL_CLUSTERING:
            plumber_pdf = pdfplumber.open(str(path))
            plumber_context: AbstractContextManager = plumber_pdf
        else:
            plumber_context = nullcontext()

        with pdf_context, plumber_context:
            for i in resolve_page_range(page_range, len(pdf_reader.pages)):
                page = pdf_reader.pages[i]
                # On 12/30/2025 with pypdf==6.4.2, a `PageObject.extract_text` call on
                # https://arxiv.org/pdf/1711.07566's page 3's Figure 2a's rasterization
                # example outputs an orphaned low surrogate (U+DC63), which is
                # interpreted as an incomplete UTF-16 surrogate pair downstream and causes:
                # > UnicodeEncodeError: 'utf-8' codec can't encode character '\udc63'
                # > in position 17404: surrogates not allowed
                # Thus, the extracted text is cleaned
                text = clean_invalid_unicode(page.extract_text())
                if page_size_limit and len(text) > page_size_limit:
                    raise ImpossibleParsingError(
                        f"The text in page {i} of {len(pdf_reader.pages)} was {len(text)} chars"
                        f" long, which exceeds the {page_size_limit} char limit for the PDF"
                        f" at path {path}."
                    )

                if media_mode == MediaMode.FULL_PAGE:
                    pdfium_page: pdfium.PdfPage = pdf_doc[i]
                    pdfium_rendered_page: pdfium.PdfBitmap = pdfium_page.render(
                        **render_kwargs
                    )
                    buf = io.BytesIO()
                    try:
                        pdfium_rendered_page.to_pil().save(buf, format="PNG")
                    except AttributeError as exc:
                        # Nice-ify pypdfium2's bad error message
                        raise ImportError(
                            "Full page media rendering requires 'Pillow' to be installed."
                            " Please install it via `pip install paper-qa-pypdf[media]`."
                        ) from exc
                    media_metadata = {
                        "type": "screenshot",
                        "page_width": pdfium_page.get_width(),
                        "page_height": pdfium_page.get_height(),
                    } | {
                        f"bitmap_{a}": getattr(pdfium_rendered_page, a)
                        for a in PDFIUM_BITMAP_ATTRS
                    }
                    del pdfium_rendered_page  # Free pdfium bitmap memory
                    media_metadata["info_hashable"] = json.dumps(
                        media_metadata, sort_keys=True
                    )
                    # Add page number after info_hashable so differing pages
                    # don't break the cache key
                    media_metadata["page_num"] = i + 1
                    pages[str(i + 1)] = text, [
                        ParsedMedia(index=0, data=buf.getvalue(), info=media_metadata)
                    ]
                    count_media += 1
                elif media_mode == MediaMode.INDIVIDUAL_CLUSTERING:
                    media_list: list[ParsedMedia] = []
                    plumber_page = plumber_pdf.pages[i]
                    page_width = plumber_page.width
                    page_height = plumber_page.height

                    # Cluster images into figure regions
                    pdfium_page = pdf_doc[i]
                    for cluster_idx, (x0, y0, x1, y1) in enumerate(
                        cluster_bboxes(
                            [
                                (img["x0"], img["top"], img["x1"], img["bottom"])
                                for img in plumber_page.images
                            ],
                            tolerance=image_cluster_tolerance,
                        )
                    ):
                        # Add padding around the figure region
                        x0 = max(0, x0 - image_cluster_padding)
                        y0 = max(0, y0 - image_cluster_padding)
                        x1 = min(page_width, x1 + image_cluster_padding)
                        y1 = min(page_height, y1 + image_cluster_padding)

                        # Calculate and render the cropped region
                        pix = pdfium_page.render(
                            crop=(
                                x0,
                                page_height - y1,
                                page_width - x1,
                                page_height - (page_height - y0),
                            ),
                            **render_kwargs,
                        )
                        buf = io.BytesIO()
                        try:
                            pix.to_pil().save(buf, format="PNG")
                        except AttributeError as exc:
                            raise ImportError(
                                "Figure rendering requires 'Pillow' to be installed."
                                " Please install it via `pip install paper-qa-pypdf[media]`."
                            ) from exc

                        media_metadata = {
                            "type": "picture",
                            "bbox": (x0, y0, x1, y1),
                            "width": pix.width,
                            "height": pix
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1335** (2026-06-05): **Add `NemotronParseBBox.to_original_coordinates` for raw nemotron-parse output**
  *Symptoms*: ## Why  `nemotron-parse` predicts bounding boxes in the space of its preprocessed input: each page is resized (aspect-preserving) and centered onto a target `2048x1648` (HxW) canvas with white padding, so the boxes are normalized to that padded canvas rather than to the page.  NVIDIA's hosted **NIM** undoes that and returns input-image coordinates, which is why PaperQA's current decode is correct against NIM. A consumer of the model's **raw** output, though, e.g. a self-hosted vLLM or HuggingFace `transformers` endpoint, receives canvas-space coordinates and draws every box shifted inward and compressed, worst at low DPI where the padding dominates. This adds a first-class way for such consumers to recover original-image coordinates, mirroring what NVIDIA's [`postprocessing.transform_bbox_to_original`](https://huggingface.co/nvidia/NVIDIA-Nemotron-Parse-v1.1/blob/fd1e3c6ba0b61a6dcab5a905f0ff92c5b19f14a4/postprocessing.py#L23-L53) and `example.py` do.  ## Notes  - **Opt-in, and intentionally not used on the existing NIM path.** NIM already returns input-image coordinates, so applying this there would double-transform. `to_original_coordinates` sits alongside `to_page_coordinates` for the raw-output case only. - Relation to #1271: that (closed) PR addressed the same mismatch from the *input* side, upsizing/pre-fitting pages to the training aspect ratio before sending. This is the complementary *output* side, and leaves the request path untouched. - Tests assert parity against N

- **Issue #1320** (2026-03-20): **Pulled in `PyMuPDF` typing fix**
  *Symptoms*: PyMuPDF fixed the typing on `Page.find_tables` in https://github.com/pymupdf/PyMuPDF/issues/4932

- **Issue #1316** (2026-03-12): **Add "et al." to invalid citation examples in prompt**
  *Symptoms*: ## Summary  `CITATION_KEY_CONSTRAINTS` lists invalid citation formats to steer LLMs toward using `pqac-*` citation keys. However, all the invalid examples only show wrong ways to format `pqac-*` keys themselves -- there is no example prohibiting academic-style author citations.  In practice, on long answers the answer LLM occasionally slips in citations like `Deschamps et al. (2004)` alongside otherwise correct `pqac-*` keys. The existing prompt instructions ("only use the valid keys") are not always sufficient to prevent this.  This PR adds `- Author et al. (2023)` as an invalid citation example so the constraint explicitly covers this failure mode.  Made with [Cursor](https://cursor.com)  <!-- CURSOR_SUMMARY --> ---  > [!NOTE] > **Low Risk** > Low risk: this only tweaks prompt text to further constrain LLM citation formatting, with no code-path, security, or data-handling changes. >  > **Overview** > Tightens `CITATION_KEY_CONSTRAINTS` in `prompts.py` by adding `Author et al. (2023)` as an explicit *invalid* citation example to reduce the model mixing academic-style citations with `pqac-*` keys. >  > Also fixes a missing trailing newline in the existing invalid example `- (pages pqac-d79ef6fa)` to keep formatting consistent. >  > <sup>Written by [Cursor Bugbot](https://cursor.com/dashboard?tab=bugbot) for commit 6abce43955f6b7e17bdb4e0c2b51aa9b4e81da72. Configure [here](https://cursor.com/dashboard?tab=bugbot).</sup> <!-- /CURSOR_SUMMARY -->

- **Issue #1313** (2026-03-11): **Pulling in `docling-core`, `docling`, `pymupdf` fixes**
  *Symptoms*: Pulling in: - `docling-core` fix: https://github.com/docling-project/docling-core/pull/520 - `docling` rename: https://github.com/docling-project/docling/pull/2872 - `pymupdf` typing fix: https://github.com/pymupdf/PyMuPDF/issues/4903  <!-- CURSOR_SUMMARY --> ---  > [!NOTE] > **Medium Risk** > Dependency upgrades and backend/API swaps may subtly change PDF parsing output/behavior and add heavier transitive requirements (e.g., `torch`), so parsing regression testing is important. >  > **Overview** > Updates `paper-qa-docling` to require `docling>=2.74`, drops the `docling-parse<5` downpin, and switches the default PDF backend from `DoclingParseV4DocumentBackend` to the renamed `DoclingParseDocumentBackend`. >  > Updates `paper-qa-pymupdf` to remove the dev-only PyMuPDF downpin and adjusts table extraction to use `pymupdf.table.find_tables(page)` instead of `page.find_tables()`. The lockfile is refreshed to newer `docling`/`docling-core`/`docling-parse` and `pymupdf` versions (including new transitive deps). >  > <sup>Written by [Cursor Bugbot](https://cursor.com/dashboard?tab=bugbot) for commit 32ee9672095efeaaca65678716c2d97fbf7229d9. Configure [here](https://cursor.com/dashboard?tab=bugbot).</sup> <!-- /CURSOR_SUMMARY -->

- **Issue #1312** (2026-03-04): **Fixing flaky PaSa figure 1 read assertions**
  *Symptoms*: Seen in [this CI run](https://github.com/Future-House/paper-qa/actions/runs/22643642432/job/65639899295):  ```none FAILED packages/paper-qa-pypdf/tests/test_paperqa_pypdf.py::test_parse_pdf_to_pages - AssertionError: Expected raw_answer_no_citations='There is one User Query blue box in the diagram. It is connected to the Paper Queue and the Selector .' to have ('two', '2') present ```  This PR generalizes our assertions to allow for the answer saying "paper queue" then "selector" OR "selector" then "paper queue".

- **Issue #1311** (2026-03-04): **Fixed CMYK images crashing PNG encoding in PyPDF reader**
  *Symptoms*: Closes #1310  ## Summary  - When Pillow can't save an image as PNG due to an unsupported color mode (e.g. CMYK from print-oriented PDFs), fall back to converting the image to RGB before re-encoding - Added a CMYK test case to `test_individual_mode_outputs_png` that reproduces the crash  Follow-up to #1298, which handled file **format** re-encoding but missed color **mode** incompatibility.  Made with [Cursor](https://cursor.com)

- **Issue #1310** (2026-03-04): **CMYK images in PDFs crash indexing with OSError**
  *Symptoms*: ## Bug  When indexing a directory containing PDFs that have CMYK images, `pqa index` crashes instead of skipping the problematic files.  ## Error  ``` OSError: cannot write mode CMYK as PNG ```  The crash originates in `paperqa_pypdf/reader.py:323`:  ```python pil_image.save(buf, format="PNG") ```  Pillow cannot save CMYK-mode images as PNG. The error propagates out of the `anyio.TaskGroup` in `get_directory_index` and kills the entire indexing process.  ## Steps to reproduce  1. Have a directory of PDFs where at least one contains a CMYK image (common in academic papers from print journals) 2. Run `pqa index /path/to/pdfs` 3. Indexing crashes with an `ExceptionGroup` containing the `OSError`  ## Expected behavior  The file-level error handler in `process_file` (search.py:521) should catch this and skip the file, logging a warning. Currently it does log "Error parsing ... skipping index for this file" but the exception still propagates and crashes the TaskGroup.  ## Workaround  Set `parsing.multimodal` to `"OFF"` in Settings to disable image extraction entirely.  ## Full traceback  ``` ExceptionGroup: unhandled errors in a TaskGroup (2 sub-exceptions) +-+---------------- 1 ----------------   | Traceback (most recent call last):   |   File ".../PIL/PngImagePlugin.py", line 1380, in _save   |     rawmode, bit_depth, color_type = _OUTMODES[outmode]   | KeyError: 'CMYK'   |   | The above exception was the direct cause of the following exception:   |   | Traceback (most recent cal
  **Post-Mortem & Fix Analysis**:
  > <!-- Greeting --> Hi @menyoung! I'm [Dosu](https://go.dosu.dev/dosubot) and I’m helping the paper-qa team.  <!-- Answer --> Thanks for the detailed bug report! Your analysis is correct — the issue stems from [PR #1298](https://github.com/Future-House/paper-qa/pull/1298) which added image format conversion to PNG but only checks the image format, not the color mode.  The suggested fix looks right:  ```python if pil_image.mode == "CMYK":     pil_image = pil_image.convert("RGB") pil_image.save(buf, format="PNG") ```  You might also consider handling other non-RGB modes that could fail (like `LAB` or `P` with transparency) by using a more general approach:  ```python if pil_image.mode not in ("RGB", "RGBA", "L", "LA"):     pil_image = pil_image.convert("RGB") ```  Regarding exception propagation: looking at [`process_file` in search.py](https://github.com/Future-House/paper-qa/blob/8221e3cf8b7ff7b2485cd9e05e44387dab183a0a/paperqa/agents/search.py#L529-L553), only `ValueError` and `Impossib

- **Issue #1309** (2026-03-03): **Fixing JSON schema export of `Settings`**
  *Symptoms*: Seen in dev logs when generating an OpenAPI spec:  ```none Traceback (most recent call last):   File "/srv/.venv/lib/python3.13/site-packages/uvicorn/protocols/http/httptools_impl.py", line 416, in run_asgi     result = await app(  # type: ignore[func-returns-value]   File "/srv/.venv/lib/python3.13/site-packages/uvicorn/middleware/proxy_headers.py", line 60, in __call__     return await self.app(scope, receive, send)   File "/srv/.venv/lib/python3.13/site-packages/fastapi/applications.py", line 1160, in __call__     await super().__call__(scope, receive, send)   File "/srv/.venv/lib/python3.13/site-packages/starlette/applications.py", line 107, in __call__     await self.middleware_stack(scope, receive, send)   File "/srv/.venv/lib/python3.13/site-packages/starlette/middleware/errors.py", line 186, in __call__     raise exc   File "/srv/.venv/lib/python3.13/site-packages/starlette/middleware/errors.py", line 164, in __call__     await self.app(scope, receive, _send)   File "/srv/.venv/lib/python3.13/site-packages/starlette/middleware/base.py", line 191, in __call__     with recv_stream, send_stream, collapse_excgroups():   File "/usr/local/lib/python3.13/contextlib.py", line 162, in __exit__     self.gen.throw(value)   File "/srv/.venv/lib/python3.13/site-packages/starlette/_utils.py", line 87, in collapse_excgroups     raise exc   File "/srv/.venv/lib/python3.13/site-packages/starlette/middleware/base.py", line 193, in __call__     response = await se

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

### Incident Patch 1: `d2c3c698` (2026-03-20)
**Commit Message**: Pulled in `PyMuPDF` typing fix (#1320)

**File**: `packages/paper-qa-pymupdf/pyproject.toml` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ requires-python = ">=3.11"
 
 [project.optional-dependencies]
 dev = [
+    "PyMuPDF>=1.27.2.2",  # Lower pin for typing fix on Page.find_tables
     "fhlmi>=0.39",  # Pin for bytes_to_string
     "paper-qa>=5.23",  # Pin for PDFParserFn
     "pytest-asyncio",
```

**File**: `packages/paper-qa-pymupdf/src/paperqa_pymupdf/reader.py` (modified, +1/-2)
```diff
@@ -8,7 +8,6 @@
 from paperqa.types import ParsedMedia, ParsedMetadata, ParsedText
 from paperqa.utils import ImpossibleParsingError, clean_invalid_unicode
 from pydantic import JsonValue
-from pymupdf.table import find_tables
 
 
 def setup_pymupdf_python_logging() -> None:
@@ -219,7 +218,7 @@ def parse_pdf_to_pages(
                         )
 
                     # Capture tables
-                    for table_i, table in enumerate(find_tables(page)):
+                    for table_i, table in enumerate(page.find_tables()):
                         pix = page.get_pixmap(clip=table.bbox, dpi=dpi)
                         media_metadata = {
                             "bbox": tuple(table.bbox),
```

**File**: `uv.lock` (modified, +14/-12)
```diff
@@ -3328,6 +3328,7 @@ dependencies = [
 dev = [
     { name = "fhlmi" },
     { name = "paper-qa" },
+    { name = "pymupdf" },
     { name = "pytest" },
     { name = "pytest-asyncio" },
 ]
@@ -3338,6 +3339,7 @@ requires-dist = [
     { name = "paper-qa", editable = "." },
     { name = "paper-qa", marker = "extra == 'dev'", editable = "." },
     { name = "pymupdf", specifier = ">=1.24.12" },
+    { name = "pymupdf", marker = "extra == 'dev'", specifier = ">=1.27.2.2" },
     { name = "pytest", marker = "extra == 'dev'", specifier = ">=8" },
     { name = "pytest-asyncio", marker = "extra == 'dev'" },
 ]
@@ -4138,18 +4140,18 @@ wheels = [
 
 [[package]]
 name = "pymupdf"
-version = "1.27.2"
-source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/a4/fb/d80374ab091ab7ad5a5e7981a45c877ae094db668c1ab4d30f1109a4ec6a/pymupdf-1.27.2.tar.gz", hash = "sha256:37fc9cedeafb40839f86a074d4d9feab725144bdd4bbfd20308ff8957e2b10af", size = 85353104, upload-time = "2026-03-10T12:53:01.697Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/98/ee/2c10b6bde83ee42f5150b690ace952a802a7e632776dadd42bbfe5b68601/pymupdf-1.27.2-cp310-abi3-macosx_10_9_x86_64.whl", hash = "sha256:a60ff9010d7025428e31d92ac2c9b4218c7c4844409d0b31a050565ea0a955fd", size = 23987468, upload-time = "2026-03-10T12:37:06.593Z" },
-    { url = "https://files.pythonhosted.org/packages/44/06/c8cc8c8ade83f5a75ac0f543edc2bc3c52d8c38c1d55d1e0713558258540/pymupdf-1.27.2-cp310-abi3-macosx_11_0_arm64.whl", hash = "sha256:5095efb242cfe1c46fec1c864a13f000098564829c98366582dde7ad9e61aa32", size = 23262964, upload-time = "2026-03-10T12:37:23.915Z" },
-    { url = "https://files.pythonhosted.org/packages/1a/8e/df2ab91a680a77c82bc4501cdca60767b3758d75552e4d2849647a16cbc0/pymupdf-1.27.2-cp310-abi3-manylinux_2_28_aarch64.whl", hash = "sha256:1081235fcfad268d801cd73a7b69c629939e2c46ed4d97035cb1bb7b5b90dc54", size = 24318675, upload-time = "2026-03-10T12:37:42.249Z" },
-    { url = "https://files.pythonhosted.org/packages/ab/56/c6c16fa2dcfe2476ec28a9aaaca773dc35c593699e81e573211c91442770/pymupdf-1.27.2-cp310-abi3-manylinux_2_28_x86_64.whl", hash = "sha256:917f4dd52daea504d5c60e1430c17d637b5014a43e66d068b4b356effe087dba", size = 24947974, upload-time = "2026-03-10T12:38:00.779Z" },
-    { url = "https://files.pythonhosted.org/packages/7b/4f/1659f1d80b5d2f5aad134c2ca63894c63daf47a3ffb7e18987fe25e49097/pymupdf-1.27.2-cp310-abi3-musllinux_1_2_x86_64.whl", hash = "sha256:9617d5e71c334937c804544fa201946c5f73d0a97b5842b96857bdabfefbc343", size = 25169417, upload-time = "2026-03-10T12:38:18.912Z" },
-    { url = "https://files.pythonhosted.org/packages/05/23/e34d704f7242885dd1d67cfbe1040051a04b4b7e2cf1cbd27af9bd4500a3/pymupdf-1.27.2-cp310-abi3-win32.whl", hash = "sha256:6deef49e06c9a5d8670bf5835a911ab887dac4b3ed4bd60ab7d93da6aa8ff6f1", size = 18008725, upload-time = "2026-03-10T12:38:31.915Z" },
-    { url = "https://files.pythonhosted.org/packages/f5/fb/a3f1f8813f6e93c65d1f7ebca6530a889f1ae109229b537f7a617b2aab57/pymupdf-1.27.2-cp310-abi3-win_amd64.whl", hash = "sha256:acdfdb7329882246545a0f6bc85f91739e2773ed81f9301c1687cffb826470f3", size = 19237944, upload-time = "2026-03-10T12:38:45.603Z" },
-    { url = "https://files.pythonhosted.org/packages/e6/a4/e9257882f0569a21d51207a58f7586a799e76dc6b4008029a04f2329194c/pymupdf-1.27.2-cp314-cp314t-manylinux_2_28_x86_64.whl", hash = "sha256:261c916915cede4c546559810d3210277f86f31b52dd3de138f1e12d95a4c6b6", size = 24985149, upload-time = "2026-03-10T12:39:02.636Z" },
+version = "1.27.2.2"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.pythonhosted.org/packages/f1/32/f6b645c51d79a188a4844140c5dabca7b487ad56c4be69c4bc782d0d11a9/pymupdf-1.27.2.2.tar.gz", hash = "sha256:ea8fdc3ab6671ca98f629d5ec3032d662c8cf1796b146996b7ad306ac7ed3335", size = 85354380, upload-time = "2026-03-20T09:47:58.386Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/90/88/d01992a50165e22dec057a1129826846c547feb4ba07f42720ac030ce438/pymupdf-1.27.2.2-cp310-abi3-macosx_10_9_x86_64.whl", hash = "sha256:800f43e60a6f01f644343c2213b8613db02eaf4f4ba235b417b3351fa99e01c0", size = 23987563, upload-time = "2026-03-19T12:35:42.989Z" },
+    { url = "https://files.pythonhosted.org/packages/6d/0e/9f526bc1d49d8082eff0d1547a69d541a0c5a052e71da625559efaba46a6/pymupdf-1.27.2.2-cp310-abi3-macosx_11_0_arm64.whl", hash = "sha256:8e2e4299ef1ac0c9dff9be096cbd22783699673abecfa7c3f73173ae06421d73", size = 23263089, upload-time = "2026-03-20T09:44:16.982Z" },
+    { url = "https://files.pythonhosted.org/packages/42/be/984f0d6343935b5dd30afaed6be04fc753146bf55709e63ef28bf9ef7497/pymupdf-1.27.2.2-cp310-abi3-manylinux_2_28_aarch64.whl", hash = "sha256:c5e3d54922db1c7da844f1208ac1db05704770988752311f81dd36694ae0a07b", size = 24318817, upload-time = "2026-03-20T09:44:33.209Z" },
+    { url = "https://files.pythonhosted.org/packages/22/8e/85e9d9f11dbf34036eb1df283805ef6b885f2005a
```

---

### Incident Patch 2: `c726f56f` (2026-03-18)
**Commit Message**: Pulled in `pyzotero` typing fix (#1319)

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -81,6 +81,7 @@ dev = [
     "pytest-xdist",
     "pytest>=8",  # Pin to keep recent
     "python-dotenv",
+    "pyzotero>=1.11.0",  # Lower pin for typing fix on Zotero.dump in https://github.com/urschrei/pyzotero/issues/298
     "refurb>=2",  # Pin to keep recent
     "typeguard",
     "vcrpy>=8",  # Pin for dropping unused requests support
```

**File**: `src/paperqa/contrib/zotero.py` (modified, +1/-2)
```diff
@@ -140,8 +140,7 @@ def get_pdf(self, item: dict) -> Path | None:
         if not pdf_path.exists():
             pdf_path.parent.mkdir(parents=True, exist_ok=True)
             self.logger.info(f"|  Downloading PDF for: {_get_citation_key(item)}")
-            # Can remove str-cast after https://github.com/urschrei/pyzotero/issues/298
-            self.dump(pdf_key, str(pdf_path))
+            self.dump(pdf_key, pdf_path)
 
         return pdf_path
 
```

**File**: `uv.lock` (modified, +10/-3)
```diff
@@ -3149,6 +3149,7 @@ requires-dist = [
     { name = "pytest-timer", extras = ["colorama"], marker = "extra == 'dev'" },
     { name = "pytest-xdist", marker = "extra == 'dev'" },
     { name = "python-dotenv", marker = "extra == 'dev'" },
+    { name = "pyzotero", marker = "extra == 'dev'", specifier = ">=1.11.0" },
     { name = "pyzotero", marker = "extra == 'zotero'" },
     { name = "qdrant-client", marker = "extra == 'qdrant'" },
     { name = "refurb", marker = "extra == 'dev'", specifier = ">=2" },
@@ -4599,17 +4600,17 @@ wheels = [
 
 [[package]]
 name = "pyzotero"
-version = "1.10.0"
+version = "1.11.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "bibtexparser" },
     { name = "feedparser" },
     { name = "httpx" },
     { name = "whenever" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/53/fc/dc2682ccbb6f4ada2c0b08252febd647723330d2f72c70bb070de32586ce/pyzotero-1.10.0.tar.gz", hash = "sha256:90ec4040e5a26182b9e2b0eaa7945464bcb4f57c710b1418c1ccd19bb5ccf7a7", size = 552138, upload-time = "2026-02-06T12:47:09.597Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/d5/c1/9604acb98817b0687eb2ff1eda0b3d765d08c70471064ff9526f63e10274/pyzotero-1.11.0.tar.gz", hash = "sha256:901e5ca297d44f46ba7fe7810cc8e2327374ca206ed44b62b214ffe5ea647fb3", size = 552101, upload-time = "2026-03-18T08:43:02.448Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/26/ad/648abae578d4b79dc7fd5368ba6f5c9d3a9cf3b78685f4dfab31ea8d37fe/pyzotero-1.10.0-py3-none-any.whl", hash = "sha256:454e3f3e7fbb4f98e1eaae7d90c78ee12b7c0ea386e21a8d9a12e73b38ee9fa0", size = 49453, upload-time = "2026-02-06T12:47:07.754Z" },
+    { url = "https://files.pythonhosted.org/packages/ea/7d/ee3e86bb9eecf157ab850f9cba3f675c6d900be8c16a6a9bf7c99ac060f9/pyzotero-1.11.0-py3-none-any.whl", hash = "sha256:54348c7332c79cd1acf531f2548fc8d8c6ea31e89e98c420232d97a193ad95b2", size = 49312, upload-time = "2026-03-18T08:43:00.761Z" },
 ]
 
 [[package]]
@@ -5795,6 +5796,12 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/0f/8b/4b61d6e13f7108f36910df9ab4b58fd389cc2520d54d81b88660804aad99/torch-2.10.0-2-cp311-none-macosx_11_0_arm64.whl", hash = "sha256:418997cb02d0a0f1497cf6a09f63166f9f5df9f3e16c8a716ab76a72127c714f", size = 79423467, upload-time = "2026-02-10T21:44:48.711Z" },
     { url = "https://files.pythonhosted.org/packages/d3/54/a2ba279afcca44bbd320d4e73675b282fcee3d81400ea1b53934efca6462/torch-2.10.0-2-cp312-none-macosx_11_0_arm64.whl", hash = "sha256:13ec4add8c3faaed8d13e0574f5cd4a323c11655546f91fbe6afa77b57423574", size = 79498202, upload-time = "2026-02-10T21:44:52.603Z" },
     { url = "https://files.pythonhosted.org/packages/ec/23/2c9fe0c9c27f7f6cb865abcea8a4568f29f00acaeadfc6a37f6801f84cb4/torch-2.10.0-2-cp313-none-macosx_11_0_arm64.whl", hash = "sha256:e521c9f030a3774ed770a9c011751fb47c4d12029a3d6522116e48431f2ff89e", size = 79498254, upload-time = "2026-02-10T21:44:44.095Z" },
+    { url = "https://files.pythonhosted.org/packages/36/ab/7b562f1808d3f65414cd80a4f7d4bb00979d9355616c034c171249e1a303/torch-2.10.0-3-cp311-cp311-manylinux_2_28_x86_64.whl", hash = "sha256:ac5bdcbb074384c66fa160c15b1ead77839e3fe7ed117d667249afce0acabfac", size = 915518691, upload-time = "2026-03-11T14:15:43.147Z" },
+    { url = "https://files.pythonhosted.org/packages/b3/7a/abada41517ce0011775f0f4eacc79659bc9bc6c361e6bfe6f7052a6b9363/torch-2.10.0-3-cp312-cp312-manylinux_2_28_x86_64.whl", hash = "sha256:98c01b8bb5e3240426dcde1446eed6f40c778091c8544767ef1168fc663a05a6", size = 915622781, upload-time = "2026-03-11T14:17:11.354Z" },
+    { url = "https://files.pythonhosted.org/packages/ab/c6/4dfe238342ffdcec5aef1c96c457548762d33c40b45a1ab7033bb26d2ff2/torch-2.10.0-3-cp313-cp313-manylinux_2_28_x86_64.whl", hash = "sha256:80b1b5bfe38eb0e9f5ff09f206dcac0a87aadd084230d4a36eea5ec5232c115b", size = 915627275, upload-time = "2026-03-11T14:16:11.325Z" },
+    { url = "https://files.pythonhosted.org/packages/d8/f0/72bf18847f58f877a6a8acf60614b14935e2f156d942483af1ffc081aea0/torch-2.10.0-3-cp313-cp313t-manylinux_2_28_x86_64.whl", hash = "sha256:46b3574d93a2a8134b3f5475cfb98e2eb46771794c57015f6ad1fb795ec25e49", size = 915523474, upload-time = "2026-03-11T14:17:44.422Z" },
+    { url = "https://files.pythonhosted.org/packages/f4/39/590742415c3030551944edc2ddc273ea1fdfe8ffb2780992e824f1ebee98/torch-2.10.0-3-cp314-cp314-manylinux_2_28_x86_64.whl", hash = "sha256:b1d5e2aba4eb7f8e87fbe04f86442887f9167a35f092afe4c237dfcaaef6e328", size = 915632474, upload-time = "2026-03-11T14:15:13.666Z" },
+    { url = "https://files.pythonhosted.org/packages/b6/8e/34949484f764dde5b222b7fe3fede43e4a6f0da9d7f8c370bb617d629ee2/torch-2.10.0-3-cp314-cp314t-manylinux_2_28_x86_64.whl", hash = "sha256:0228d20b06701c05a8f978357f657817a4a63984b0c90745def81c18aedfa591", size = 915523882, upload-time = "2026-03-11T14:14:46.311Z" },
     { url = "https://files.pythonhosted.org/packages/78/89/f5554b13ebd71e05c0b002f95148033
```

---

### Incident Patch 3: `4c9050fe` (2026-03-11)
**Commit Message**: Pulling in `docling-core`, `docling`, `pymupdf` fixes (#1313)

**File**: `packages/paper-qa-docling/pyproject.toml` (modified, +1/-3)
```diff
@@ -19,8 +19,7 @@ classifiers = [
 ]
 dependencies = [
     "docling-core>=2",  # Pin for v2 with DocItem, TextItem, etc.
-    "docling-parse<5",  # Downpin for https://github.com/docling-project/docling-parse/issues/226
-    "docling>=2",  # Pin for v2 introducing PdfPipelineOptions
+    "docling>=2.74",  # Pin for moving to DoclingParseDocumentBackend in https://github.com/docling-project/docling/pull/2872
     "paper-qa",
 ]
 description = "PaperQA readers implemented using Docling"
@@ -38,7 +37,6 @@ requires-python = ">=3.11"
 [project.optional-dependencies]
 dev = [
     "docling-ibm-models[opencv-python-headless]>=3.10.0",  # Lower pin and specify opencv after https://github.com/docling-project/docling-ibm-models/pull/130
-    "docling>=2.63",  # Pin for StandardPdfPipeline timeout fix
     "fhlmi>=0.39",  # Pin for bytes_to_string
     "paper-qa>=5.23",  # Pin for PDFParserFn
     "pytest-asyncio",
```

**File**: `packages/paper-qa-docling/src/paperqa_docling/reader.py` (modified, +3/-3)
```diff
@@ -8,7 +8,7 @@
 from typing import TYPE_CHECKING, Any, cast
 
 import docling
-from docling.backend.docling_parse_v4_backend import DoclingParseV4DocumentBackend
+from docling.backend.docling_parse_backend import DoclingParseDocumentBackend
 from docling.datamodel.base_models import ConversionStatus
 from docling.datamodel.pipeline_options import PdfPipelineOptions
 from docling.datamodel.settings import DEFAULT_PAGE_RANGE
@@ -43,7 +43,7 @@ def parse_pdf_to_pages(  # noqa: PLR0912
     pipeline_cls: type = StandardPdfPipeline,
     dpi: int | None = None,
     custom_pipeline_options: Mapping[str, Any] | None = None,
-    backend: "type[AbstractDocumentBackend]" = DoclingParseV4DocumentBackend,
+    backend: "type[AbstractDocumentBackend]" = DoclingParseDocumentBackend,
     **_,
 ) -> ParsedText:
     """Parse a PDF.
@@ -62,7 +62,7 @@ def parse_pdf_to_pages(  # noqa: PLR0912
         page_range: Optional start_page or two-tuple of inclusive (start_page, end_page)
             to parse only specific pages, where pages are one-indexed.
             Leaving as the default of None will parse all pages.
-        backend: PDF backend class to use for parsing, defaults to docling-parse v4.
+        backend: PDF backend class to use for parsing, defaults to docling-parse.
         **_: Thrown away kwargs.
     """
     path = Path(path)
```

**File**: `packages/paper-qa-pymupdf/pyproject.toml` (modified, +0/-1)
```diff
@@ -35,7 +35,6 @@ requires-python = ">=3.11"
 
 [project.optional-dependencies]
 dev = [
-    "PyMuPDF<1.27",  # Downpin for typing bug in https://github.com/pymupdf/PyMuPDF/issues/4903
     "fhlmi>=0.39",  # Pin for bytes_to_string
     "paper-qa>=5.23",  # Pin for PDFParserFn
     "pytest-asyncio",
```

**File**: `packages/paper-qa-pymupdf/src/paperqa_pymupdf/reader.py` (modified, +2/-1)
```diff
@@ -8,6 +8,7 @@
 from paperqa.types import ParsedMedia, ParsedMetadata, ParsedText
 from paperqa.utils import ImpossibleParsingError, clean_invalid_unicode
 from pydantic import JsonValue
+from pymupdf.table import find_tables
 
 
 def setup_pymupdf_python_logging() -> None:
@@ -218,7 +219,7 @@ def parse_pdf_to_pages(
                         )
 
                     # Capture tables
-                    for table_i, table in enumerate(t for t in page.find_tables()):
+                    for table_i, table in enumerate(find_tables(page)):
                         pix = page.get_pixmap(clip=table.bbox, dpi=dpi)
                         media_metadata = {
                             "bbox": tuple(table.bbox),
```

**File**: `uv.lock` (modified, +37/-39)
```diff
@@ -849,12 +849,13 @@ wheels = [
 
 [[package]]
 name = "docling"
-version = "2.73.1"
+version = "2.78.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "accelerate" },
     { name = "beautifulsoup4" },
     { name = "certifi" },
+    { name = "defusedxml" },
     { name = "docling-core", extra = ["chunking"] },
     { name = "docling-ibm-models" },
     { name = "docling-parse" },
@@ -878,12 +879,14 @@ dependencies = [
     { name = "requests" },
     { name = "rtree" },
     { name = "scipy" },
+    { name = "torch" },
+    { name = "torchvision" },
     { name = "tqdm" },
     { name = "typer" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/bb/e2/1492d9078b716c29e6de41de03e3641f3b7741b180801a2e735542e163a0/docling-2.73.1.tar.gz", hash = "sha256:76d2e787cfdc1f2780214066ffbf841c65566be255b5a1e5fd68fb9611e4c051", size = 344997, upload-time = "2026-02-13T15:36:07.361Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/02/e8/2147c9963efea2698b8fd983ae7f2acf290ce5246120e6e662a545ae4b21/docling-2.78.0.tar.gz", hash = "sha256:46ac9fb208cbbbbc9feba7bc650b660df4706a92f1ed6b26a952a9bcaf72cf04", size = 385012, upload-time = "2026-03-10T14:56:43.686Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/cc/5e/0514dec786d055d8fa26d88ad29d80fee4264d7cb328180ffb8fd375c4d2/docling-2.73.1-py3-none-any.whl", hash = "sha256:31e762166be0c3c3e97e28b1727e3aad09703160e04443ed1c24866977e157c1", size = 371533, upload-time = "2026-02-13T15:36:05.482Z" },
+    { url = "https://files.pythonhosted.org/packages/ee/26/bdc2dff2e8be4b178f2994b5a1eca61250ea0d234521d6f1b50ef87dbffd/docling-2.78.0-py3-none-any.whl", hash = "sha256:237ba66a253962c87e9278c15d872154c750e08ea424bccf8bc91adebaf45ddc", size = 415390, upload-time = "2026-03-10T14:56:41.76Z" },
 ]
 
 [[package]]
@@ -950,7 +953,7 @@ opencv-python-headless = [
 
 [[package]]
 name = "docling-parse"
-version = "4.7.3"
+version = "5.5.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "docling-core" },
@@ -959,24 +962,24 @@ dependencies = [
     { name = "pywin32", marker = "sys_platform == 'win32'" },
     { name = "tabulate" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/bb/7a/653c3b11920113217724fab9b4740f9f8964864f92a2a27590accecec5ac/docling_parse-4.7.3.tar.gz", hash = "sha256:5936e6bcb7969c2a13f38ecc75cada3b0919422dc845e96da4b0b7b3bbc394ce", size = 67646746, upload-time = "2026-01-14T14:18:19.376Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/e6/94/68453bf4136e82f7c94168f0332466822cdb5f226c8a0e1335de21c595ed/docling_parse-5.5.0.tar.gz", hash = "sha256:0914c7174f8fe497d406f4814a70cdfccb4e09d8b2ba90a6e92d02704f5a4a65", size = 57526362, upload-time = "2026-03-04T10:27:44.689Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/6c/81/dd317e0bce475153dc08a60a9a8615b1a04d4d3c9803175e6cb7b7e9b49b/docling_parse-4.7.3-cp311-cp311-macosx_14_0_arm64.whl", hash = "sha256:66896bbe925073e4d48f18ec29dcd611a390d6b2378fae72125e77b020cd5664", size = 14615974, upload-time = "2026-01-14T14:17:30.246Z" },
-    { url = "https://files.pythonhosted.org/packages/3a/b5/088590e0b32fd0a393ca419c644d1435a1c99fa6b2a87888eef4d0fdea33/docling_parse-4.7.3-cp311-cp311-manylinux_2_26_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:281347b3e937c1a5ffa6f8774ee603b64a0899fe8a6885573dec7eb48a3421d8", size = 14981051, upload-time = "2026-01-14T14:17:32.426Z" },
-    { url = "https://files.pythonhosted.org/packages/b7/63/2b6c9127924487573d5419d58ec77955f0b7c0a923c8232ad461d71039aa/docling_parse-4.7.3-cp311-cp311-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl", hash = "sha256:d3d86c51f9ce35a1b40b2f410f7271d9bd5fc58e7240f4cae7fdd2cef757e671", size = 15092586, upload-time = "2026-01-14T14:17:34.634Z" },
-    { url = "https://files.pythonhosted.org/packages/af/89/ed27a83eb113bdf0b0f82f3c30a0db3c005df58b236f6487b232dacdb57a/docling_parse-4.7.3-cp311-cp311-win_amd64.whl", hash = "sha256:3b04459cc97a8a4929622e341b9981e23987a63af07db599afc5e1c4d389060b", size = 16144866, upload-time = "2026-01-14T14:17:36.742Z" },
-    { url = "https://files.pythonhosted.org/packages/d6/26/9d86ae12699a25b7233f76ce062253e9c14e57781e00166b792b3a9d56db/docling_parse-4.7.3-cp312-cp312-macosx_14_0_arm64.whl", hash = "sha256:d89231aa4fba3e38b80c11beb8edc07569e934c1f3935b51f57904fefe958ba5", size = 14616739, upload-time = "2026-01-14T14:17:38.567Z" },
-    { url = "https://files.pythonhosted.org/packages/f2/fd/1aebb8a7f15d658f3be858ddbbc4ef7206089d540a7df0dcd4b846b99901/docling_parse-4.7.3-cp312-cp312-manylinux_2_26_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:dffd19ed373b0da5cea124606b183489a8686c3d18643e94485be1bdda5713ea", size = 14980782, upload-time = "2026-01-14T14:17:40.659Z" },
-    { url = "https://files.pythonhosted.org/packages/3e/47/a722527c9f89c65f69f8a463be4f12ad73bae18132f29d8de8b2d9f6f082/docling_parse-4.7.3-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.wh
```

---

### Incident Patch 4: `0e4a06e7` (2026-03-04)
**Commit Message**: Fixed CMYK images crashing PNG encoding in PyPDF reader (#1311)

**File**: `packages/paper-qa-pypdf/src/paperqa_pypdf/reader.py` (modified, +9/-1)
```diff
@@ -320,7 +320,15 @@ def parse_pdf_to_pages(  # noqa: PLR0912
                             # Re-encode as PNG because the image may be in a
                             # format LLM providers reject (e.g. JPEG2000)
                             buf = io.BytesIO()
-                            pil_image.save(buf, format="PNG")
+                            try:
+                                pil_image.save(buf, format="PNG")
+                            except OSError as exc:
+                                if "cannot write mode" not in str(exc):
+                                    raise  # Don't swallow unrelated IO errors
+                                # PNG doesn't support all color modes (e.g. CMYK
+                                # from print-oriented PDFs), so fall back to RGB
+                                buf = io.BytesIO()  # Reset after partial write
+                                pil_image.convert("RGB").save(buf, format="PNG")
                             data = buf.getvalue()
                         media_metadata = {
                             "type": "picture",
```

**File**: `packages/paper-qa-pypdf/tests/test_paperqa_pypdf.py` (modified, +11/-6)
```diff
@@ -344,16 +344,20 @@ def test_clustering() -> None:
 
 
 @pytest.mark.parametrize(
-    "img_format",
+    ("img_mode", "img_format", "expected_mode"),
     [
-        pytest.param("BMP", id="non_png_re_encodes"),
-        pytest.param("PNG", id="png_passthrough"),
+        pytest.param("RGB", "BMP", "RGB", id="non_png_re_encodes"),
+        pytest.param("RGB", "PNG", "RGB", id="png_passthrough"),
+        pytest.param("CMYK", "TIFF", "RGB", id="cmyk_converts_to_rgb"),
+        pytest.param("L", "BMP", "L", id="grayscale_preserves_mode"),
     ],
 )
-def test_individual_mode_outputs_png(img_format: str) -> None:
-    # Form an image in the input format
+def test_individual_mode_outputs_png(
+    img_mode: str, img_format: str, expected_mode: str
+) -> None:
+    # Form an image in the input format (and mode)
     raw_buf = io.BytesIO()
-    Image.new("RGB", (4, 4), "red").save(raw_buf, format=img_format)
+    Image.new(img_mode, (4, 4)).save(raw_buf, format=img_format)
     raw_bytes = raw_buf.getvalue()
     mock_img_obj = SimpleNamespace(
         image=Image.open(io.BytesIO(raw_bytes)), data=raw_bytes
@@ -377,6 +381,7 @@ def test_individual_mode_outputs_png(img_format: str) -> None:
     result_image = Image.open(io.BytesIO(media.data))
     assert result_image.format == "PNG"
     assert result_image.size == (4, 4)
+    assert result_image.mode == expected_mode
 
 
 class TestMediaMode:
```

---

### Incident Patch 5: `17a2bb8e` (2026-03-04)
**Commit Message**: Fixing flaky PaSa figure 1 read assertions (#1312)

**File**: `packages/paper-qa-docling/tests/test_paperqa_docling.py` (modified, +13/-9)
```diff
@@ -102,12 +102,12 @@ async def test_parse_pdf_to_pages() -> None:
     fig_1_text.text = "stub"  # Replace text to confirm multimodality works
     docs = Docs()
     assert await docs.aadd_texts(texts=[fig_1_text], doc=doc)
-    for query, substrings_min_counts in (
+    for query, answer_checks in (
         ("What actions can the Crawler take?", [(("search", "expand", "stop"), 2)]),
         ("What actions can the Selector take?", [(("select", "drop"), 2)]),
         (
             "How many User Query blue boxes are there, and what are they connected to?",
-            [(("two", "2"), 1), (("crawler", "selector"), 2)],
+            [r"two|2|(?=.*paper queue)(?=.*selector)"],
         ),
     ):
         session = await docs.aquery(query=query)
@@ -120,13 +120,17 @@ async def test_parse_pdf_to_pages() -> None:
         raw_answer_no_citations = session.raw_answer
         for key in get_citation_ids(session.raw_answer):
             raw_answer_no_citations = raw_answer_no_citations.replace(f"({key})", "")
-        for substrings, min_count in cast(
-            list[tuple[tuple[str, ...], int]], substrings_min_counts
-        ):
-            assert (
-                sum(x in raw_answer_no_citations.lower() for x in substrings)
-                >= min_count
-            ), f"Expected {raw_answer_no_citations=} to have {substrings} present"
+        for check in answer_checks:
+            answer_lower = raw_answer_no_citations.lower()
+            if isinstance(check, str):
+                assert re.search(
+                    check, answer_lower
+                ), f"Expected {raw_answer_no_citations=} to match pattern {check!r}"
+            else:
+                substrings, min_count = cast(tuple[tuple[str, ...], int], check)
+                assert (
+                    sum(x in answer_lower for x in substrings) >= min_count
+                ), f"Expected {raw_answer_no_citations=} to have {substrings} present"
 
     # Check the no-media behavior
     parsed_text_no_media = parse_pdf_to_pages(filepath, parse_media=False)
```

**File**: `packages/paper-qa-nemotron/tests/test_paperqa_nemotron.py` (modified, +13/-9)
```diff
@@ -118,12 +118,12 @@ async def test_parse_pdf_to_pages(api_params_base: dict[str, Any]) -> None:
     fig_1_text.text = "stub"  # Replace text to confirm multimodality works
     docs = Docs()
     assert await docs.aadd_texts(texts=[fig_1_text], doc=doc)
-    for query, substrings_min_counts in (
+    for query, answer_checks in (
         ("What actions can the Crawler take?", [(("search", "expand", "stop"), 2)]),
         ("What actions can the Selector take?", [(("select", "drop"), 2)]),
         (
             "How many User Query blue boxes are there, and what are they connected to?",
-            [(("two", "2"), 1), (("crawler", "selector"), 2)],
+            [r"two|2|(?=.*paper queue)(?=.*selector)"],
         ),
     ):
         session = await docs.aquery(query=query)
@@ -136,13 +136,17 @@ async def test_parse_pdf_to_pages(api_params_base: dict[str, Any]) -> None:
         raw_answer_no_citations = session.raw_answer
         for key in get_citation_ids(session.raw_answer):
             raw_answer_no_citations = raw_answer_no_citations.replace(f"({key})", "")
-        for substrings, min_count in cast(
-            list[tuple[tuple[str, ...], int]], substrings_min_counts
-        ):
-            assert (
-                sum(x in raw_answer_no_citations.lower() for x in substrings)
-                >= min_count
-            ), f"Expected {raw_answer_no_citations=} to have {substrings} present"
+        for check in answer_checks:
+            answer_lower = raw_answer_no_citations.lower()
+            if isinstance(check, str):
+                assert re.search(
+                    check, answer_lower
+                ), f"Expected {raw_answer_no_citations=} to match pattern {check!r}"
+            else:
+                substrings, min_count = cast(tuple[tuple[str, ...], int], check)
+                assert (
+                    sum(x in answer_lower for x in substrings) >= min_count
+                ), f"Expected {raw_answer_no_citations=} to have {substrings} present"
 
     # Let's check the full page parsing behavior
     parsed_text_full_page = await parse_pdf_to_pages(
```

**File**: `packages/paper-qa-pymupdf/tests/test_paperqa_pymupdf.py` (modified, +13/-9)
```diff
@@ -96,12 +96,12 @@ async def test_parse_pdf_to_pages() -> None:
     fig_1_text.text = "stub"  # Replace text to confirm multimodality works
     docs = Docs()
     assert await docs.aadd_texts(texts=[fig_1_text], doc=doc)
-    for query, substrings_min_counts in (
+    for query, answer_checks in (
         ("What actions can the Crawler take?", [(("search", "expand", "stop"), 2)]),
         ("What actions can the Selector take?", [(("select", "drop"), 2)]),
         (
             "How many User Query blue boxes are there, and what are they connected to?",
-            [(("two", "2"), 1), (("crawler", "selector"), 2)],
+            [r"two|2|(?=.*paper queue)(?=.*selector)"],
         ),
     ):
         session = await docs.aquery(query=query)
@@ -114,13 +114,17 @@ async def test_parse_pdf_to_pages() -> None:
         raw_answer_no_citations = session.raw_answer
         for key in get_citation_ids(session.raw_answer):
             raw_answer_no_citations = raw_answer_no_citations.replace(f"({key})", "")
-        for substrings, min_count in cast(
-            list[tuple[tuple[str, ...], int]], substrings_min_counts
-        ):
-            assert (
-                sum(x in raw_answer_no_citations.lower() for x in substrings)
-                >= min_count
-            ), f"Expected {raw_answer_no_citations=} to have {substrings} present"
+        for check in answer_checks:
+            answer_lower = raw_answer_no_citations.lower()
+            if isinstance(check, str):
+                assert re.search(
+                    check, answer_lower
+                ), f"Expected {raw_answer_no_citations=} to match pattern {check!r}"
+            else:
+                substrings, min_count = cast(tuple[tuple[str, ...], int], check)
+                assert (
+                    sum(x in answer_lower for x in substrings) >= min_count
+                ), f"Expected {raw_answer_no_citations=} to have {substrings} present"
 
     # Let's check the full page parsing behavior
     parsed_text_full_page = parse_pdf_to_pages(filepath, full_page=True)
```

**File**: `packages/paper-qa-pypdf/tests/test_paperqa_pypdf.py` (modified, +13/-9)
```diff
@@ -103,12 +103,12 @@ async def test_parse_pdf_to_pages() -> None:
     fig_1_text.text = "stub"  # Replace text to confirm multimodality works
     docs = Docs()
     assert await docs.aadd_texts(texts=[fig_1_text], doc=doc)
-    for query, substrings_min_counts in (
+    for query, answer_checks in (
         ("What actions can the Crawler take?", [(("search", "expand", "stop"), 2)]),
         ("What actions can the Selector take?", [(("select", "drop"), 2)]),
         (
             "How many User Query blue boxes are there, and what are they connected to?",
-            [(("two", "2"), 1), (("crawler", "selector"), 2)],
+            [r"two|2|(?=.*paper queue)(?=.*selector)"],
         ),
     ):
         session = await docs.aquery(query=query)
@@ -121,13 +121,17 @@ async def test_parse_pdf_to_pages() -> None:
         raw_answer_no_citations = session.raw_answer
         for key in get_citation_ids(session.raw_answer):
             raw_answer_no_citations = raw_answer_no_citations.replace(f"({key})", "")
-        for substrings, min_count in cast(
-            list[tuple[tuple[str, ...], int]], substrings_min_counts
-        ):
-            assert (
-                sum(x in raw_answer_no_citations.lower() for x in substrings)
-                >= min_count
-            ), f"Expected {raw_answer_no_citations=} to have {substrings} present"
+        for check in answer_checks:
+            answer_lower = raw_answer_no_citations.lower()
+            if isinstance(check, str):
+                assert re.search(
+                    check, answer_lower
+                ), f"Expected {raw_answer_no_citations=} to match pattern {check!r}"
+            else:
+                substrings, min_count = cast(tuple[tuple[str, ...], int], check)
+                assert (
+                    sum(x in answer_lower for x in substrings) >= min_count
+                ), f"Expected {raw_answer_no_citations=} to have {substrings} present"
 
     # Check the full page parsing behavior
     parsed_text_full_page = parse_pdf_to_pages(filepath, full_page=True)
```

---

### Incident Patch 6: `d9e817a7` (2026-03-03)
**Commit Message**: Fixing JSON schema export of `Settings` (#1309)

**File**: `src/paperqa/settings.py` (modified, +8/-5)
```diff
@@ -41,6 +41,7 @@
     model_serializer,
     model_validator,
 )
+from pydantic.json_schema import SkipJsonSchema
 from pydantic_core.core_schema import SerializationInfo
 from pydantic_settings import BaseSettings, CliSettingsSource, SettingsConfigDict
 
@@ -284,13 +285,13 @@ class ParsingSettings(BaseModel):
             " summarization."
         ),
     )
-    parse_pdf: PDFParserFn = Field(
+    parse_pdf: SkipJsonSchema[PDFParserFn] = Field(
         default_factory=get_default_pdf_parser,
         description="Function to parse PDF, or a fully qualified name to import.",
         examples=["paperqa_docling.parse_pdf_to_pages"],
         exclude=True,  # NOTE: a custom serializer is used below, so it's not excluded
     )
-    configure_pdf_parser: Callable[[], Any] = Field(
+    configure_pdf_parser: SkipJsonSchema[Callable[[], Any]] = Field(
         default=default_pdf_parser_configurator,
         description=(
             "Callable to configure the PDF parser within parse_pdf,"
@@ -576,7 +577,7 @@ class IndexSettings(BaseModel):
             " directory."
         ),
     )
-    files_filter: Callable[[anyio.Path | pathlib.Path], bool] = Field(
+    files_filter: SkipJsonSchema[Callable[[anyio.Path | pathlib.Path], bool]] = Field(
         default=lambda f: (
             f.suffix
             # TODO: add images after embeddings are supported
@@ -692,7 +693,9 @@ class AgentSettings(BaseModel):
         ),
     )
 
-    callbacks: Mapping[str, Sequence[Callable[[_EnvironmentState], Any]]] = Field(
+    callbacks: SkipJsonSchema[
+        Mapping[str, Sequence[Callable[[_EnvironmentState], Any]]]
+    ] = Field(
         default_factory=dict,
         description="""
             A mapping that associates callback names with lists of corresponding callable functions.
@@ -808,7 +811,7 @@ class Settings(BaseSettings):
             " logged."
         ),
     )
-    custom_context_serializer: AsyncContextSerializer | None = Field(
+    custom_context_serializer: SkipJsonSchema[AsyncContextSerializer | None] = Field(
         default=None,
         description=(
             "Function to turn settings and contexts into an answer context str."
```

**File**: `tests/test_configs.py` (modified, +4/-0)
```diff
@@ -68,6 +68,10 @@ def test_get_settings_missing_file() -> None:
 
 def test_settings_default_instantiation(tmpdir, subtests: SubTests) -> None:
     default_settings = Settings()
+
+    # Check we can export a JSON schema
+    Settings.model_json_schema()
+
     # Also let's check our default settings work fine with round-trip JSON serialization
     serde_default_settings = Settings(**default_settings.model_dump(mode="json"))
     for setting in (default_settings, serde_default_settings):
```

---

### Incident Patch 7: `b82fcf7d` (2026-02-26)
**Commit Message**: Fix acronym-led citation docname ingest failures (#1302)

Co-authored-by: pre-commit-ci-lite[bot] <117423508+pre-commit-ci-lite[bot]@users.noreply.github.com>

**File**: `.mailmap` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 Andrew White <andrew@futurehouse.org> <white.d.andrew@gmail.com>
+Ahmet Celebi <59479833+AmT42@users.noreply.github.com> At4 <59479833+AmT42@users.noreply.github.com>
 Anush008 <anushshetty90@gmail.com> Anush <anushshetty90@gmail.com>
 Dmitrii Magas <eamagea123@gmail.com> eamag
 Geemi Wellawatte <geemi@futurehouse.org> <gwellawatte@gmail.com>
```

**File**: `src/paperqa/utils.py` (modified, +6/-6)
```diff
@@ -611,16 +611,16 @@ def logging_filters(
 
 def citation_to_docname(citation: str) -> str:
     """Create a docname that follows MLA parenthetical in-text citation."""
-    # get first name and year from citation
+    # Prefer title-case token first to preserve existing behavior.
     match = re.search(r"([A-Z][a-z]+)", citation)
     if match is not None:
         author = match.group(1)
     else:
-        # panicking - no word??
-        raise ValueError(
-            f"Could not parse docname from citation {citation}. "
-            "Consider just passing key explicitly - e.g. docs.py "
-            "(path, citation, key='mykey')"
+        # Fall back to acronym/symbol-led starts like "CD47/SIRP-alpha ...".
+        match = re.search(r"([A-Z0-9]{2,})", citation)
+        # Final deterministic fallback for non-text-like citation strings.
+        author = (
+            match.group(1) if match is not None else f"Doc{hexdigest(citation)[:8]}"
         )
     year = ""
     match = re.search(r"(\d{4})", citation)
```

**File**: `tests/test_utils.py` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+from paperqa.utils import citation_to_docname
+
+
+def test_citation_to_docname_acronym_title() -> None:
+    citation = "CD47/SIRP\u03b1 axis: bridging innate and adaptive immunity, 2022"
+    assert citation_to_docname(citation) == "CD472022"
+
+
+def test_citation_to_docname_non_text_fallback_is_deterministic() -> None:
+    # Contrived edge-case input chosen to guarantee the final fallback branch:
+    # - no TitleCase token (e.g., "Smith")
+    # - no acronym token (e.g., "CD47")
+    # This models malformed/placeholder citation text from extraction failures.
+    citation = "___, n.d."
+    first = citation_to_docname(citation)
+    second = citation_to_docname(citation)
+
+    assert first == second, (
+        "Expected deterministic fallback: identical malformed input should yield the "
+        "same docname each call (regression guard against random/UUID-based suffixes)."
+    )
+    assert first.startswith("Doc"), (
+        "Expected malformed citations to use the explicit final fallback format "
+        "'Doc<hash8>' (for example, Docc7acc74a)."
+    )
```

---

### Incident Patch 8: `6e37e7d0` (2026-02-25)
**Commit Message**: Re-loosened `test_timeout_resilience` after LiteLLM fix (#1305)

**File**: `pyproject.toml` (modified, +1/-2)
```diff
@@ -64,8 +64,7 @@ dev = [
     "httpx-aiohttp>=0.1.11",  # Pin for raw headers fix
     "ipykernel>=6.29",  # For running Jupter notebooks, and pin to keep recent
     "ipython>=8",  # Pin to keep recent
-    "litellm>=1.71",  # Lower pin for aiohttp transport adoption
-    "litellm>=1.81.3",  # Lower pin for not retrying 4xx client errors in https://github.com/BerriAI/litellm/pull/19275
+    "litellm>=1.81.14",  # Lower pin for Anthropic empty system messages fix in https://github.com/BerriAI/litellm/pull/21630
     "mypy>=1.19",  # Pin for zip default detection
     "paper-qa[docling,image,ldp,memory,nemotron,pypdf-media,pymupdf,typing,zotero,local,qdrant,office]",
     "prek<0.2.15",  # Downpin for https://github.com/j178/prek/issues/1104
```

**File**: `tests/test_paperqa.py` (modified, +1/-4)
```diff
@@ -3475,10 +3475,7 @@ async def test_timeout_resilience() -> None:
         "text": text,
         "question": "The duck says",
         "summary_llm_model": llm,
-        # Placeholder prompt templates are required as due to
-        # https://github.com/BerriAI/litellm/issues/21622,
-        # empty system message content isn't allowed for Anthropic models
-        "prompt_templates": ("{question}", "{question}"),
+        "prompt_templates": ("", ""),
     }
     # This *should* raise
     with pytest.raises(LLMContextTimeoutError):
```

**File**: `uv.lock` (modified, +1/-2)
```diff
@@ -3084,8 +3084,7 @@ requires-dist = [
     { name = "ipykernel", marker = "extra == 'dev'", specifier = ">=6.29" },
     { name = "ipython", marker = "extra == 'dev'", specifier = ">=8" },
     { name = "ldp", marker = "extra == 'ldp'", specifier = ">=0.25.0,<1" },
-    { name = "litellm", marker = "extra == 'dev'", specifier = ">=1.71" },
-    { name = "litellm", marker = "extra == 'dev'", specifier = ">=1.81.3" },
+    { name = "litellm", marker = "extra == 'dev'", specifier = ">=1.81.14" },
     { name = "mypy", marker = "extra == 'dev'", specifier = ">=1.19" },
     { name = "numpy" },
     { name = "openreview-py", marker = "extra == 'openreview'" },
```

---

### Incident Patch 9: `e1d9339f` (2026-02-21)
**Commit Message**: Fixed PyPDF reader's failure to handle non-PNG data without `pdfplumber` (#1298)

**File**: `packages/paper-qa-pypdf/src/paperqa_pypdf/reader.py` (modified, +12/-6)
```diff
@@ -319,7 +319,17 @@ def parse_pdf_to_pages(  # noqa: PLR0912
                     # PyPDF will blow up here with a nice message
                     media_list = []
                     for img_idx, img_obj in enumerate(page.images):
-                        width, height = cast("Image.Image", img_obj.image).size
+                        pil_image = cast("Image.Image", img_obj.image)
+                        width, height = pil_image.size
+                        if pil_image.format == "PNG":
+                            # LLM providers accept PNG, so leave the image data as-is
+                            data: bytes = img_obj.data
+                        else:
+                            # Re-encode as PNG because the image may be in a
+                            # format LLM providers reject (e.g. JPEG2000)
+                            buf = io.BytesIO()
+                            pil_image.save(buf, format="PNG")
+                            data = buf.getvalue()
                         media_metadata = {
                             "type": "picture",
                             "width": width,
@@ -332,11 +342,7 @@ def parse_pdf_to_pages(  # noqa: PLR0912
                         # don't break the cache key
                         media_metadata["page_num"] = i + 1
                         media_list.append(
-                            ParsedMedia(
-                                index=img_idx,
-                                data=img_obj.data,
-                                info=media_metadata,
-                            )
+                            ParsedMedia(index=img_idx, data=data, info=media_metadata)
                         )
                     pages[str(i + 1)] = text, media_list
                     count_media += len(media_list)
```

**File**: `packages/paper-qa-pypdf/tests/test_paperqa_pypdf.py` (modified, +39/-0)
```diff
@@ -1,8 +1,10 @@
 import base64
+import io
 import json
 import re
 from collections.abc import Sequence
 from pathlib import Path
+from types import SimpleNamespace
 from typing import cast
 from unittest.mock import patch
 
@@ -11,6 +13,7 @@
 from paperqa import Doc, Docs
 from paperqa.readers import PDFParserFn, chunk_pdf
 from paperqa.utils import REPLACEMENT_CHAR, ImpossibleParsingError, get_citation_ids
+from PIL import Image
 
 from paperqa_pypdf import parse_pdf_to_pages
 from paperqa_pypdf.reader import MediaMode
@@ -336,6 +339,42 @@ def test_clustering() -> None:
     ), "Small tolerance should cluster less aggressively"
 
 
+@pytest.mark.parametrize(
+    "img_format",
+    [
+        pytest.param("BMP", id="non_png_re_encodes"),
+        pytest.param("PNG", id="png_passthrough"),
+    ],
+)
+def test_individual_mode_outputs_png(img_format: str) -> None:
+    # Form an image in the input format
+    raw_buf = io.BytesIO()
+    Image.new("RGB", (4, 4), "red").save(raw_buf, format=img_format)
+    raw_bytes = raw_buf.getvalue()
+    mock_img_obj = SimpleNamespace(
+        image=Image.open(io.BytesIO(raw_bytes)), data=raw_bytes
+    )
+
+    with (
+        patch("paperqa_pypdf.reader.pdfplumber", None),
+        patch(
+            "pypdf.PageObject.images",
+            new_callable=lambda: property(lambda _: [mock_img_obj]),
+        ),
+    ):
+        parsed_text = parse_pdf_to_pages(STUB_DATA_DIR / "paper.pdf", page_range=1)
+
+    assert isinstance(parsed_text.content, dict)
+    assert "1" in parsed_text.content
+    assert isinstance(parsed_text.content["1"], tuple)
+    _, (media,) = parsed_text.content["1"]
+
+    # Verify the output is valid PNG by round-tripping through PIL
+    result_image = Image.open(io.BytesIO(media.data))
+    assert result_image.format == "PNG"
+    assert result_image.size == (4, 4)
+
+
 class TestMediaMode:
 
     def test_same_member_is_equal(self) -> None:
```

---

### Incident Patch 10: `10f036a9` (2026-02-21)
**Commit Message**: Fixing Semantic Scholar crash on `max` over empty list (#1297)

**File**: `src/paperqa/clients/semantic_scholar.py` (modified, +5/-1)
```diff
@@ -265,9 +265,13 @@ async def s2_title_search(
             (strings_similarity(entry["title"], title), entry)
             for entry in data.get("data", data)
         )
+    except ValueError as exc:
+        # ValueError: S2 may return {"data": []} causing max() on an empty iterable to
+        # throw a ValueError
+        raise DOINotFoundError(f"No results found for title {title}.") from exc
     except (KeyError, IndexError) as exc:
         raise DOINotFoundError(
-            f"Unexpected Semantic Scholar search/match endpoint shape for {title}"
+            f"Unexpected Semantic Scholar search/match endpoint shape for title {title}"
             f" given data {data}."
         ) from exc
 
```

**File**: `tests/cassettes/test_s2_title_search_empty_data.yaml` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+interactions:
+  - request:
+      body: ""
+      headers:
+        accept:
+          - "*/*"
+        accept-encoding:
+          - gzip, deflate
+        connection:
+          - keep-alive
+        host:
+          - api.semanticscholar.org
+        user-agent:
+          - python-httpx/0.28.1
+      method: GET
+      uri: https://api.semanticscholar.org/graph/v1/paper/search/match?query=empty+results+edge+case+query&fields=authors%2CcitationCount%2CcitationStyles%2CexternalIds%2CinfluentialCitationCount%2CisOpenAccess%2Cjournal%2CopenAccessPdf%2CpublicationDate%2CpublicationTypes%2Ctitle%2Curl%2Cvenue%2Cyear
+    response:
+      body:
+        string: '{"data": []}'
+      headers:
+        Access-Control-Allow-Origin:
+          - "*"
+        Connection:
+          - keep-alive
+        Content-Length:
+          - "12"
+        Content-Type:
+          - application/json
+      status:
+        code: 200
+        message: OK
+version: 1
```

**File**: `tests/test_clients.py` (modified, +31/-0)
```diff
@@ -22,12 +22,14 @@
     SemanticScholarProvider,
 )
 from paperqa.clients.client_models import MetadataPostProcessor, MetadataProvider
+from paperqa.clients.exceptions import DOINotFoundError
 from paperqa.clients.journal_quality import (
     DEFAULT_JOURNAL_QUALITY_CSV_PATH,
     JournalQualityPostProcessor,
 )
 from paperqa.clients.openalex import OpenAlexProvider, reformat_name
 from paperqa.clients.retractions import RetractionDataPostProcessor
+from paperqa.clients.semantic_scholar import s2_title_search
 from paperqa.types import SOURCE_QUALITY_MESSAGES, DocDetails
 
 # Use to avoid flaky tests every time citation count changes
@@ -379,6 +381,35 @@ async def test_client_os_error() -> None:
         assert mock_get.call_count >= 1, "Expected the exception to have been thrown"
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    ("return_value", "match"),
+    [
+        pytest.param({"data": []}, "No results", id="empty-data"),
+        pytest.param({"data": [{}]}, "Unexpected", id="missing-title-key"),
+    ],
+)
+async def test_s2_title_search_edge_cases(
+    return_value: dict[str, Any], match: str
+) -> None:
+    async with httpx_aiohttp.HttpxAiohttpClient() as http_client:
+        with patch(
+            "paperqa.clients.semantic_scholar._s2_get_with_retrying",
+            return_value=return_value,
+        ):
+            with pytest.raises(DOINotFoundError, match=match):
+                await s2_title_search("some title", client=http_client)
+
+
+@pytest.mark.vcr
+@pytest.mark.asyncio
+async def test_s2_title_search_empty_data() -> None:
+    """Confirm an S2 match response with empty data raises DOINotFoundError."""
+    async with httpx_aiohttp.HttpxAiohttpClient() as http_client:
+        with pytest.raises(DOINotFoundError, match="No results"):
+            await s2_title_search("empty results edge case query", client=http_client)
+
+
 @pytest.mark.vcr
 @pytest.mark.asyncio
 async def test_bad_dois() -> None:
```

---

### Incident Patch 11: `e3de41c0` (2026-02-20)
**Commit Message**: Downpinning `docling-parse`, `PyMuPDF`, `pyzotero`, `litellm` bugs (#1295)

**File**: `packages/paper-qa-docling/pyproject.toml` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ classifiers = [
 ]
 dependencies = [
     "docling-core>=2",  # Pin for v2 with DocItem, TextItem, etc.
+    "docling-parse<5",  # Downpin for https://github.com/docling-project/docling-parse/issues/226
     "docling>=2",  # Pin for v2 introducing PdfPipelineOptions
     "paper-qa",
 ]
```

**File**: `packages/paper-qa-pymupdf/pyproject.toml` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ requires-python = ">=3.11"
 
 [project.optional-dependencies]
 dev = [
+    "PyMuPDF<1.27",  # Downpin for typing bug in https://github.com/pymupdf/PyMuPDF/issues/4903
     "fhlmi>=0.39",  # Pin for bytes_to_string
     "paper-qa>=5.23",  # Pin for PDFParserFn
     "pytest-asyncio",
```

**File**: `src/paperqa/contrib/zotero.py` (modified, +2/-1)
```diff
@@ -140,7 +140,8 @@ def get_pdf(self, item: dict) -> Path | None:
         if not pdf_path.exists():
             pdf_path.parent.mkdir(parents=True, exist_ok=True)
             self.logger.info(f"|  Downloading PDF for: {_get_citation_key(item)}")
-            self.dump(pdf_key, pdf_path)
+            # Can remove str-cast after https://github.com/urschrei/pyzotero/issues/298
+            self.dump(pdf_key, str(pdf_path))
 
         return pdf_path
 
```

**File**: `tests/test_paperqa.py` (modified, +4/-1)
```diff
@@ -3285,7 +3285,10 @@ async def test_timeout_resilience() -> None:
         "text": text,
         "question": "The duck says",
         "summary_llm_model": llm,
-        "prompt_templates": ("", ""),
+        # Placeholder prompt templates are required as due to
+        # https://github.com/BerriAI/litellm/issues/21622,
+        # empty system message content isn't allowed for Anthropic models
+        "prompt_templates": ("{question}", "{question}"),
     }
     # This *should* raise
     with pytest.raises(LLMContextTimeoutError):
```

**File**: `uv.lock` (modified, +4/-0)
```diff
@@ -2902,6 +2902,7 @@ source = { editable = "packages/paper-qa-docling" }
 dependencies = [
     { name = "docling" },
     { name = "docling-core" },
+    { name = "docling-parse" },
     { name = "paper-qa" },
 ]
 
@@ -2921,6 +2922,7 @@ requires-dist = [
     { name = "docling", marker = "extra == 'dev'", specifier = ">=2.63" },
     { name = "docling-core", specifier = ">=2" },
     { name = "docling-ibm-models", extras = ["opencv-python-headless"], marker = "extra == 'dev'", specifier = ">=3.10.0" },
+    { name = "docling-parse", specifier = "<5" },
     { name = "fhlmi", marker = "extra == 'dev'", specifier = ">=0.39" },
     { name = "paper-qa", editable = "." },
     { name = "paper-qa", marker = "extra == 'dev'", editable = "." },
@@ -3010,6 +3012,7 @@ dependencies = [
 dev = [
     { name = "fhlmi" },
     { name = "paper-qa" },
+    { name = "pymupdf" },
     { name = "pytest" },
     { name = "pytest-asyncio" },
 ]
@@ -3020,6 +3023,7 @@ requires-dist = [
     { name = "paper-qa", editable = "." },
     { name = "paper-qa", marker = "extra == 'dev'", editable = "." },
     { name = "pymupdf", specifier = ">=1.24.12" },
+    { name = "pymupdf", marker = "extra == 'dev'", specifier = "<1.27" },
     { name = "pytest", marker = "extra == 'dev'", specifier = ">=8" },
     { name = "pytest-asyncio", marker = "extra == 'dev'" },
 ]
```

---

### Incident Patch 12: `f8e9b12b` (2026-02-14)
**Commit Message**: Fixing `dockey`/`doc_id` mismatch when no metadata is found (#1288)

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `src/paperqa/clients/__init__.py` (modified, +9/-1)
```diff
@@ -251,5 +251,13 @@ async def upgrade_doc_to_doc_details(self, doc: Doc, **kwargs) -> DocDetails:
             return provided_doc_details + doc_details
 
         # if we can't get metadata, just return the doc, but don't overwrite any fields
-        orig_fields = doc.model_dump() | {"fields_to_overwrite_from_metadata": set()}
+        overwrite_fields: set[str] = set()
+        if doc.dockey == doc.content_hash:
+            # This allows DocDetails validator on fields_to_overwrite_from_metadata
+            # to sync dockey with doc_id. Otherwise, dockey remains the raw
+            # content_hash and won't match the computed doc_id.
+            overwrite_fields.add("doc_id")
+        orig_fields = doc.model_dump() | {
+            "fields_to_overwrite_from_metadata": overwrite_fields
+        }
         return DocDetails(**(orig_fields | provided_fields))
```

**File**: `tests/test_agents.py` (modified, +3/-1)
```diff
@@ -103,7 +103,9 @@ async def test_get_directory_index(
             results = await index.query(query="who is Frederick Bates?", min_score=5)
             assert results
             target_doc_path = (paper_dir / "bates.txt").absolute()
-            assert results[0].docs.keys() == {md5sum(target_doc_path)}, (
+            assert results[0].docs.keys() == {
+                compute_unique_doc_id(None, md5sum(target_doc_path))
+            }, (
                 f"Expected to find {target_doc_path.name!r}, got citations"
                 f" {[d.formatted_citation for d in results[0].docs.values()]}."
             )
```

---

### Incident Patch 13: `8685d9ff` (2026-02-12)
**Commit Message**: Fixing failing `test_equations[docling]` by caching Docling models before `pytest` (#1287)

**File**: `.github/workflows/tests.yml` (modified, +17/-5)
```diff
@@ -108,8 +108,21 @@ jobs:
           enable-cache: true
           python-version: ${{ matrix.python-version }}
       - run: uv sync
+      - name: Cache Docling models
+        id: cache-models
+        uses: actions/cache@v5
+        with:
+          path: &docling-cache-dir ~/.cache/docling
+          key: &docling-cache-key ${{ runner.os }}-docling-${{ hashFiles('uv.lock') }}
+          restore-keys: &docling-cache-restore-keys ${{ runner.os }}-docling-
+      - name: Pre-download Docling models # Avoid HuggingFace Hub requests during VCR cassette playback
+        if: steps.cache-models.outputs.cache-hit != 'true'
+        # RapidOCR is used for PDF pipeline's OCR, layout for layout analysis,
+        # tableformer for table structure
+        run: uv run docling-tools models download layout tableformer
       - run: uv run pytest -n auto tests
         env:
+          DOCLING_ARTIFACTS_PATH: &docling-artifacts-path ~/.cache/docling/models
           OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
           ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
           GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
@@ -133,18 +146,17 @@ jobs:
         id: cache-models
         uses: actions/cache@v5
         with:
-          path: |
-            ~/.cache/docling
-          key: ${{ runner.os }}-docling-${{ hashFiles('uv.lock') }}
-          restore-keys: ${{ runner.os }}-docling-
+          path: *docling-cache-dir
+          key: *docling-cache-key
+          restore-keys: *docling-cache-restore-keys
       - name: Pre-download Docling models # Avoid CI race conditions in filesystem on model download
         if: steps.cache-models.outputs.cache-hit != 'true'
         # RapidOCR is used for PDF pipeline's OCR, layout for layout analysis,
         # tableformer for table structure
         run: uv run docling-tools models download rapidocr layout tableformer
       - run: uv run pytest -n auto packages
         env:
-          DOCLING_ARTIFACTS_PATH: ~/.cache/docling/models # Work around https://github.com/docling-project/docling/issues/2500
+          DOCLING_ARTIFACTS_PATH: *docling-artifacts-path # Work around https://github.com/docling-project/docling/issues/2500
           OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
           ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
           GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

**File**: `tests/cassettes/test_equations[docling].yaml` (modified, +0/-120)
```diff
@@ -137,124 +137,4 @@ interactions:
       status:
         code: 404
         message: Not Found
-  - request:
-      body: null
-      headers:
-        Accept:
-          - "*/*"
-        Accept-Encoding:
-          - gzip, deflate
-        Connection:
-          - keep-alive
-        X-Amzn-Trace-Id:
-          - 9c419b46-5dbf-4d54-8fc7-ce2ebaa875d9
-        user-agent:
-          - unknown/None; hf_hub/0.36.0; python/3.13.5; torch/2.9.1
-      method: GET
-      uri: https://huggingface.co/api/models/docling-project/docling-layout-heron/revision/main
-    response:
-      body:
-        string: '{"_id":"67fe52e0b3a9473353b72227","id":"docling-project/docling-layout-heron","private":false,"tags":["safetensors","rt_detr_v2","arxiv:2509.11720","arxiv:2408.09869","license:apache-2.0","region:us"],"downloads":681238,"likes":25,"modelId":"docling-project/docling-layout-heron","author":"docling-project","sha":"54100edecdceb65a9d8204d2478ac4cc8d4ca68b","lastModified":"2026-01-05T13:52:29.000Z","gated":false,"disabled":false,"model-index":null,"config":{"architectures":["RTDetrV2ForObjectDetection"],"model_type":"rt_detr_v2"},"cardData":{"license":"apache-2.0"},"siblings":[{"rfilename":".gitattributes"},{"rfilename":"README.md"},{"rfilename":"config.json"},{"rfilename":"docling_heron_400.png"},{"rfilename":"model.safetensors"},{"rfilename":"preprocessor_config.json"}],"spaces":["thinkPy/Docling-Layout-Analysis"],"createdAt":"2025-04-15T12:36:48.000Z","safetensors":{"parameters":{"F32":42889979},"total":42889979},"usedStorage":514976988}'
-      headers:
-        Access-Control-Allow-Origin:
-          - https://huggingface.co
-        Access-Control-Expose-Headers:
-          - X-Repo-Commit,X-Request-Id,X-Error-Code,X-Error-Message,X-Total-Count,ETag,Link,Accept-Ranges,Content-Range,X-Linked-Size,X-Linked-ETag,X-Xet-Hash
-        Access-Control-Max-Age:
-          - "86400"
-        Connection:
-          - keep-alive
-        Content-Length:
-          - "950"
-        Content-Type:
-          - application/json; charset=utf-8
-        Date:
-          - Mon, 05 Jan 2026 19:41:58 GMT
-        ETag:
-          - W/"3b6-6euCfaFhDEaAsdvBiOOQ9lanlAI"
-        RateLimit:
-          - '"api";r=2997;t=101'
-        RateLimit-Policy:
-          - '"fixed window";"api";q=3000;w=300'
-        Referrer-Policy:
-          - strict-origin-when-cross-origin
-        Vary:
-          - Origin
-        Via:
-          - 1.1 f7597cc90ba7218b20a85a0785996e1c.cloudfront.net (CloudFront)
-        X-Amz-Cf-Id:
-          - jAbEn5FdfKGtpiBKnfg2NDoAdlVsAIE71_LEQXA1qMmzatU68jD9Kg==
-        X-Amz-Cf-Pop:
-          - SFO5-P1
-        X-Cache:
-          - Miss from cloudfront
-        X-Powered-By:
-          - huggingface-moon
-        X-Request-Id:
-          - Root=1-695c1406-1e433045790abd7b0d85197a;9c419b46-5dbf-4d54-8fc7-ce2ebaa875d9
-        cross-origin-opener-policy:
-          - same-origin
-      status:
-        code: 200
-        message: OK
-  - request:
-      body: null
-      headers:
-        Accept:
-          - "*/*"
-        Accept-Encoding:
-          - gzip, deflate
-        Connection:
-          - keep-alive
-        X-Amzn-Trace-Id:
-          - d89a67c6-9ae7-4af9-bf43-711868fafc52
-        user-agent:
-          - unknown/None; hf_hub/0.36.0; python/3.13.5; torch/2.9.1
-      method: GET
-      uri: https://huggingface.co/api/models/docling-project/docling-models/revision/v2.3.0
-    response:
-      body:
-        string: '{"_id":"6683f1e3bd6e5421c747a05f","id":"docling-project/docling-models","private":false,"library_name":"transformers","tags":["transformers","arxiv:2408.09869","arxiv:2206.01062","doi:10.57967/hf/3036","license:cdla-permissive-2.0","endpoints_compatible","region:us"],"downloads":775664,"likes":188,"modelId":"docling-project/docling-models","author":"docling-project","sha":"fc0f2d45e2218ea24bce5045f58a389aed16dc23","lastModified":"2025-07-23T11:23:06.000Z","gated":false,"disabled":false,"model-index":null,"config":{},"cardData":{"license":"cdla-permissive-2.0"},"transformersInfo":{"auto_model":"AutoModel"},"siblings":[{"rfilename":".gitattributes"},{"rfilename":".gitignore"},{"rfilename":"README.md"},{"rfilename":"config.json"},{"rfilename":"model_artifacts/tableformer/accurate/tableformer_accurate.safetensors"},{"rfilename":"model_artifacts/tableformer/accurate/tm_config.json"},{"rfilename":"model_artifacts/tableformer/fast/tableformer_fast.safetensors"},{"rfilename":"model_artifacts/tableformer/fast/tm_config.json"}],"spaces":[],"createdAt":"2024-07-02T12:26:11.000Z","usedStorage":2364186086}'
-      headers:
-        Access-Control-Allow-Origin:
-          - https://huggingface.co
-        Access-Control-Expose-Headers:
-          - X-Repo-Commit,X-Request-Id,X-Error-Code,X-Error-Message,X-Total-Count,ETag,Link,Accept-Ranges,Content-Range,X-Linked-Size,X-Linked-ETag,X-Xet-Hash
-        Access-Control-Max-Age:
-          - "86400"
-        Connection:
-          - keep-alive
-        C
```

**File**: `tests/conftest.py` (modified, +1/-0)
```diff
@@ -115,6 +115,7 @@ def fixture_vcr_config() -> dict[str, Any]:
             ANTHROPIC_API_KEY_HEADER,
             "cookie",
         ],
+        "ignore_hosts": ["huggingface.co"],
         "record_mode": "once" if not IN_GITHUB_ACTIONS else "none",
         "allow_playback_repeats": True,
         "cassette_library_dir": str(CASSETTES_DIR),
```

---

### Incident Patch 14: `ff4c7407` (2026-02-11)
**Commit Message**: Fixing `test_parse_office_doc` by modernizing Gemini model (#1286)

**File**: `tests/test_paperqa.py` (modified, +1/-1)
```diff
@@ -3402,7 +3402,7 @@ async def test_parse_office_doc(stub_data_dir: Path, filename: str, query: str)
 
     settings = Settings(
         llm="gemini/gemini-2.5-flash",
-        embedding="gemini/text-embedding-004",
+        embedding="gemini/gemini-embedding-001",
         summary_llm="gemini/gemini-2.5-flash",
         agent={"agent_llm": "gemini/gemini-2.5-flash"},
         parsing=ParsingSettings(use_doc_details=False),
```

---

### Incident Patch 15: `d44d33e1` (2026-01-30)
**Commit Message**: Fixing newly-added journal quality `4` causing `KeyError` (#1282)

**File**: `src/paperqa/clients/journal_quality.py` (modified, +8/-7)
```diff
@@ -98,6 +98,9 @@ def query_creator(self, doc_details: DocDetails, **kwargs) -> JournalQuery | Non
     "&col=lang_code2&col=Year_Start&col=Year_End&col=isScientific&col=isProfessional"
     "&col=isGeneral&col=Type_fi&col=Type_sv&col=Type_en&col=Jufo_History"
 )
+# Sometime in between 8/25/2025 and 1/27/2026, JUFO seemingly started using level 4
+# for undefined journal quality. So let's map 4 to be our undefined
+JUFO_LEVEL_ALIASES = {4: DocDetails.UNDEFINED_JOURNAL_QUALITY}
 
 
 async def download_file(
@@ -176,14 +179,12 @@ async def process_csv(
     records: dict[tuple[str, int], tuple[str, int]] = {}
     with progress:
         for row in csv.DictReader(lines):
-            data = (
-                row["Name"],
-                (
-                    int(row["Level"])
-                    if str(row.get("Level", "")).isdigit()
-                    else DocDetails.UNDEFINED_JOURNAL_QUALITY
-                ),
+            level = (
+                int(row["Level"])
+                if str(row.get("Level", "")).isdigit()
+                else DocDetails.UNDEFINED_JOURNAL_QUALITY
             )
+            data = (row["Name"], JUFO_LEVEL_ALIASES.get(level, level))
             records[data[0].lower(), data[1]] = data
             progress.update(task_id, advance=1)
     for row_override in override_allowlist or []:
```

**File**: `tests/test_clients.py` (modified, +21/-2)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import csv
 import logging
 import os
 import re
@@ -21,10 +22,13 @@
     SemanticScholarProvider,
 )
 from paperqa.clients.client_models import MetadataPostProcessor, MetadataProvider
-from paperqa.clients.journal_quality import JournalQualityPostProcessor
+from paperqa.clients.journal_quality import (
+    DEFAULT_JOURNAL_QUALITY_CSV_PATH,
+    JournalQualityPostProcessor,
+)
 from paperqa.clients.openalex import OpenAlexProvider, reformat_name
 from paperqa.clients.retractions import RetractionDataPostProcessor
-from paperqa.types import DocDetails
+from paperqa.types import SOURCE_QUALITY_MESSAGES, DocDetails
 
 # Use to avoid flaky tests every time citation count changes
 CITATION_COUNT_SENTINEL = "CITATION_COUNT_SENTINEL"
@@ -829,3 +833,18 @@ async def test_does_openalex_work(
             ), "Year should not be populated because we set fields"
         else:
             assert not openalex_details, "Should have failed"
+
+
+def test_journal_quality_csv_values_are_valid() -> None:
+    valid_quality_values = set(SOURCE_QUALITY_MESSAGES.keys()) | {
+        DocDetails.UNDEFINED_JOURNAL_QUALITY
+    }
+
+    with DEFAULT_JOURNAL_QUALITY_CSV_PATH.open(encoding="utf-8") as f:
+        invalid_values: list[tuple[str, int]] = []
+        for row in csv.DictReader(f):
+            quality = int(row["quality"])
+            if quality not in valid_quality_values:
+                invalid_values.append((row["clean_name"], quality))
+
+    assert not invalid_values
```

#### Recent Merged Pull Requests:
- **PR #1359** (closed): refactor: make corpus operations functional [AAI-766] (@ypicard)
- **PR #1339** (closed): docs: add DeepSeek API setup tutorial with Ollama embedding (@SilenWang)
- **PR #1337** (2026-08-12): Remove duplicated "words" in evidence-summary JSON system prompts (@chris234567)
- **PR #1335** (2026-06-05): Add `NemotronParseBBox.to_original_coordinates` for raw nemotron-parse output (@jamesbraza)
- **PR #1333** (closed): Add NemotronParseBBox.to_original_coordinates for raw nemotron-parse output (@jamesbraza)
- **PR #1332** (2026-06-04): Update j178/prek-action action to v2 (@renovate[bot])
- **PR #1331** (2026-06-04): Update astral-sh/setup-uv action to v8 (@renovate[bot])
- **PR #1328** (closed): Add missing test coverage (@AkhiChalasani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
