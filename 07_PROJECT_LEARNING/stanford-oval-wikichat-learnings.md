# Forensic Learning Record (Deep Inspection): stanford-oval/WikiChat

> **Canonical Artifact**: `07_PROJECT_LEARNING/stanford-oval-wikichat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/stanford-oval/WikiChat](https://github.com/stanford-oval/WikiChat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:07:29.268Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `stanford-oval/WikiChat`
- **Description**: WikiChat is an improved RAG. It stops the hallucination of large language models by retrieving data from a corpus.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1619 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pipelines/dialogue_state.py`
```
import re
from typing import Optional

import tiktoken
from pydantic import BaseModel, Field

from retrieval.retrieval_commons import QueryResult, SearchResultBlock


tokenizer = tiktoken.encoding_for_model("gpt-4o")


def jaccard_similarity(tokens1: list[int], tokens2: list[int]) -> float:
    """Compute Jaccard similarity between two tokenized strings"""
    set1 = set(tokens1)
    set2 = set(tokens2)

    intersection = set1.intersection(set2)
    union = set1.union(set2)

    # Return the Jaccard similarity
    return len(intersection) / len(union) if len(union) > 0 else 0


def deduplicate_search_results(
    results: list[SearchResultBlock],
) -> list[SearchResultBlock]:
    tokenized_contents = tokenizer.encode_batch([r.content for r in results])
    deduplicated_indices = []
    for j in range(len(results)):
        similarity = 0
        for idx in deduplicated_indices:
            similarity = max(
                similarity,
                jaccard_similarity(tokenized_contents[j], tokenized_contents[idx]),
            )
            if similarity > 0.8:
                break
        if similarity < 0.8:
            deduplicated_indices.append(j)
    deduplicated_results = [results[i] for i in deduplicated_indices]
    # logger.info(
    #     f"Before deduplication: {len(results)} results, after deduplication: {len(deduplicated_results)} results"
    # )
    assert len(deduplicated_results) <= len(results)

    return deduplicated_results


class DialogueTurn(BaseModel):
    user_utterance: Optional[str] = None
    search_query: list[str] = []
    search_results: list[QueryResult] = []
    llm_claims: list[str] = []
    llm_claim_search_results: list[QueryResult] = []
    filtered_search_results: list[SearchResultBlock] = []
    draft_stage_output: Optional[str] = None
    agent_utterance: Optional[str] = None

    # @model_validator(mode="after")
    # def check_claims_and_results_length(cls, values):
    #     # Access fields directly from the instance (values)
    #     if len(values.llm_claims) != len(values.llm_claim_search_results):
    #         raise ValueError(
    #             "The number of claims must match the number of search results."
    #         )

    #     return values

    @property
    def all_single_search_results(self) -> list[SearchResultBlock]:
        results = []
        for r in self.search_results + self.llm_claim_search_results:
            results.extend(r.results)

        return deduplicate_search_results(results)


class ChatbotConfig(BaseModel):
    """A configuration class for setting up a chatbot with various parameters."""

    engine: str = Field(..., description="The LLM engine to use.")
    do_refine: bool = Field(..., description="Whether to refine the final response.")
    llm_corpus_description: str = Field(
        ...,
        description="The name and description of corpus to search for information, e.g. Multilingual Wikipedia.",
    )
    retriever_endpoint: str = Field(
        ..., description="The endpoint to send retrieval requests to."
    )
    do_reranking: bool = Field(
        ..., description="Whether we should rerank the search results."
    )
    query_pre_reranking_num: int = Field(
        ...,
        description="Number of passages to retrieve before reranking. Will have no effect if `do_reranking` is False.",
    )
    query_post_reranking_num: int = Field(
        ...,
        description="Number of passages to retrieve when searching for information.",
    )
    claim_pre_reranking_num: int = Field(
        ...,
        description="Number of evidences to retrieve per LLM claim before reranking. Will have no effect if `do_reranking` is False.",
    )
    claim_post_reranking_num: int = Field(
        ..., description="Number of evidences to retrieve per claim."
    )


class DialogueState(BaseModel):
    """A class to represent the state of a dialogue with a chatbot."""

    config: ChatbotConfig
    turns: list[DialogueTurn]

    @property
    def current_turn(self) -> DialogueTurn:
        return self.turns[-1]

    def history(self, num_turns: int) -> str:
        history = ""
        for t in self.turns[:-1][-num_turns:]:
            if t.user_utterance:
                history += "User: " + t.user_utterance + "\n"
            if t.agent_utterance:
                history += "Chatbot: " + t.agent_utterance + "\n"
        history += (
            "User: " + self.current_turn.user_utterance
        )  # current turn's user utterance

        # remove all citations, otherwise, chatbot might try to recite them
        citations = re.findall(r"\[\d+\]", history)
        for citation in citations:
            history = history.replace(citation, "")
        return history

```

### Core Architecture Module: `pipelines/utils.py`
```
import os
import pathlib

from rich.console import Console, Group
from rich.markdown import Markdown
from rich.panel import Panel
from rich.text import Text

from pipelines.dialogue_state import DialogueTurn

console = Console()  # rich


def print_chatbot_response(turn: DialogueTurn):
    # Create a Markdown formatted text for the chatbot's utterance
    panel_content = []

    # Format the citations with better styling
    for index, result in enumerate(turn.filtered_search_results, start=1):
        # Citation title in bold and yellow
        reference_title = Text(f"[{index}] {result.full_title}", style="bold yellow")
        # Add a hyperlink to the title
        reference_title.stylize(f"link {result.url}")
        reference_content = Text(result.content, style="dim")

        # Add the citation title and content to the panel
        panel_content.append(reference_title)
        panel_content.append(reference_content)

        if index < len(turn.filtered_search_results):
            panel_content.append(Text(""))

    # Print the chatbot's response
    console.print(
        Panel(Group(*panel_content), title="References", border_style="yellow")
    )

    # Format the chatbot's utterance in bold blue
    chatbot_markdown = Markdown(f"{turn.agent_utterance}", style="bold blue")
    console.print(chatbot_markdown)


def input_user() -> str:
    try:
        # Create a styled text for the prompt
        prompt_text = Text("User: ", style="bold magenta")

        # Get user input using rich's console.input() method
        user_utterance = console.input(prompt_text)

        # Ignore empty inputs
        while not user_utterance.strip():
            user_utterance = console.input(prompt_text)
    finally:
        pass

    return user_utterance.strip()


def make_parent_directories(file_name: str):
    """
    Creates the parent directories of `file_name` if they don't exist
    """
    pathlib.Path(os.path.dirname(file_name)).mkdir(parents=True, exist_ok=True)


def is_everything_verified(ver_out):
    """
    Everything is verified when 1) we have only one claim and it is supported or 2) all claims are supported.
    """
    for label_fix in ver_out:
        if label_fix["label"] != "SUPPORTS":
            return False
    return True


def dict_to_command_line(
    default_parameters: dict, overwritten_parameters: dict
) -> list[str]:
    """
    This function merges the default options set in a dictionary with options
    that need to be overwritten. It then creates a command line argument
    list of key-value options for those parameters. Boolean True values
    are represented only by the key name, False and None values are omitted.

    Parameters:
    - default_parameters (dict): A dictionary of key-value pairs representing
      the default options.
    - overwritten_parameters (dict): A dictionary of key-value pairs
      that need to overwrite the default options.

    Returns:
    - List[str]: A list of strings where each string is a command line
      argument in the form '--key=value'.
    """

    command_line = []
    parameters = default_parameters.copy()
    for k, v in overwritten_parameters.items():
        parameters[k] = v
    for k, v in parameters.items():
        if v is None:
            continue
        if not isinstance(v, bool):
            command_line.append(f"--{k}={v}")
        else:
            if v:
                command_line.append(f"--{k}")
    return command_line

```

### Core Architecture Module: `preprocessing/utils.py`
```
import asyncio
import os
import sys
from time import time
from urllib.parse import quote

import aiohttp
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from tqdm import trange
from tqdm.contrib.logging import logging_redirect_tqdm
from transformers.models.auto.tokenization_auto import AutoTokenizer
from retrieval.embedding_model_info import embedding_model_to_parameters

sys.path.insert(0, "./")
from tasks.defaults import DEFAULT_EMBEDDING_MODEL_NAME
from utils.logging import logger


tokenizer = None  # load when needed
translation_prefix = "(in English: "


def extract_english_translations(text):
    """
    Extracts all instances of substrings in the form "(in English: english_translation)"
    from the given text, supporting nested parentheses.

    Parameters:
    - text (str): The text from which to extract the substrings.

    Returns:
    - list of str: A list of extracted substrings in the format "(in English: english_translation)".
    """

    translations = []
    i = 0
    try:
        while True:
            # Detect the start of a potential translation
            i = text.find(translation_prefix, i)
            if i < 0:
                break
            start_index = i
            stack = []
            stack.append("(")
            i += len(translation_prefix)
            while True:
                if text[i] == "(":
                    stack.append(text[i])
                elif text[i] == ")" and stack:
                    stack.pop()
                    # If the stack is empty, we've found a complete translation
                    if not stack:
                        end_index = i + 1  # Include the closing parenthesis
                        break
                i += 1
            translations.append(text[start_index:end_index])
            i = end_index
    except IndexError:
        # this can happen if we truncate section_title too short
        logger.warning(f"Error while extracting English translations from text {text}")

    return translations


def replace_except_first(s, old, new):
    # Find position of the first occurrence
    pos = s.find(old)

    # If the substring is not found, return the original string
    if pos == -1:
        return s

    # Split the string into two parts
    # The first part is up to and including the first occurrence of the substring
    # The second part is the rest of the string
    first_part = s[: pos + len(old)]
    rest = s[pos + len(old) :]

    # Replace the substring in the rest of the string
    rest_replaced = rest.replace(old, new)

    # Concatenate the first part back with the modified rest of the string
    return first_part + rest_replaced


def get_from_translation_map(
    entity: str, inverse_redirection_map: dict, global_translation_map: dict
):
    if entity not in global_translation_map and (
        entity not in inverse_redirection_map
        or inverse_redirection_map[entity] not in global_translation_map
    ):
        return None
    if entity in global_translation_map and global_translation_map[entity] is not None:
        return global_translation_map[entity]
    else:
        return global_translation_map[inverse_redirection_map[entity]]


def load_translation_map(parquet_dataset_dir: str, language: str) -> dict:
    try:
        # Read the Parquet dataset, applying a filter for the 'language' partition
        table = pq.read_table(
            parquet_dataset_dir,
            filters=[("language", "=", language)],
        )

        # Extract the 'translation_key' and 'translation_value' columns directly from the PyArrow table
        translation_keys = table.column("translation_key").to_pylist()
        translation_values = table.column("translation_value").to_pylist()

        # Build the dictionary directly from the PyArrow columns
        translation_map = dict(zip(translation_keys, translation_values))

        # Log the number of translations loaded
        logger.info(
            f"Loaded {len(translation_map):,} Wikidata entity translations for language {language}"
        )
    except FileNotFoundError:
        logger.warning(
            f"Could not find the Wikidata translation map file at '{parquet_dataset_dir}'. Initializing the translation map as an empty dict."
        )
        translation_map = {}
    return translation_map


def append_to_translation_map(parquet_dataset_dir: str, new_rows: list[dict]):
    """
    Appends new translation rows to the existing translation map in a Parquet dataset.
    It doesn't deduplicate the new rows against the old rows due to efficiency reasons.
    However, when we load the translation map, we use the newest row for each translation_key.
    """
    # Convert the list of dictionaries to a PyArrow Table
    logger.info(
        f"Saving {len(new_rows)} new translation rows to '{parquet_dataset_dir}'"
    )

    # Convert the new rows to a pandas DataFrame and remove duplicates based on language and translation_key columns
    new_df = (
        pd.DataFrame(new_rows)
        .drop_duplicates(subset=["language", "translation_key"])
        .reset_index(drop=True)
    )

    # Convert the DataFrame to a PyArrow Table
    new_table = pa.Table.from_pandas(new_df)

    try:
        # Check if the dataset directory exists
        if os.path.exists(parquet_dataset_dir):
            logger.info(
                f"Appending new rows to the existing Parquet dataset at '{parquet_dataset_dir}'"
            )
        else:
            logger.info(f"Creating a new Parquet dataset at '{parquet_dataset_dir}'")

        # Write the new rows to the Parquet dataset, partitioned by the 'language' column
        pq.write_to_dataset(
            new_table,
            root_path=parquet_dataset_dir,
            partition_cols=["language"],
            use_dictionary=True,  # Use dictionary encoding for efficiency
            compression="snappy",  # Use snappy compression for efficient storage
        )

        logger.info("Successfully appended new translation rows to the Parquet dataset")

    except Exception as e:
        logger.warning(f"Failed to save translation map to '{parquet_dataset_dir}'")
        logger.exception(e)


async def get_wikidata_english_name(
    document_title: str, session, language: str, global_translation_map: dict
):
    """
    Returns
        (english_name: str, new_translation_dict: dict)
    """
    if (
        get_from_translation_map(
            document_title, {}, global_translation_map=global_translation_map
        )
        is not None
    ):
        return (
            get_from_translation_map(
                document_title, {}, global_translation_map=global_translation_map
            ),
            {},
        )
    try:
        # the API expects a user agent
        # labels cover more entity-languages, but are sometimes ambiguous. Therefore, we give priority to sitelinks and fallback to labels if needed.
        url = (
            f"https://www.wikidata.org/w/api.php?"
            f"action=wbgetentities&"
            f"normalize=0&"
            f"sites={language}wiki&"
            f"titles={quote(document_title, safe='')}&"
            f"format=json&"
            f"props=sitelinks|labels"  # sitelinks are Wikipedia pages in other languages, lables are Entity translations
        )
        async with session.get(
            url=url,
            headers={"User-Agent": "wikichat/1.0"},
        ) as response:
            a = await response.json()
            wikidata_entity = a["entities"]
            assert len(wikidata_entity) == 1, "found 0 or >1 Wikidata entities"

            wikidata_entity = list(wikidata_entity.items())[0][1]
            sitelinks = (
                wikidata_entity["sitelinks"] if "sitelinks" in wikidata_entity else {}
            )
            sitelink_dict = {}
            for site, v in sitelinks.items():
                if not site.endswith("wiki") or site in [
                    "Wikifunctionswiki",
                    "species",
                    "foundation",
                    "outreach",
                    "mediawiki",
                    "wikimania",
                    "wikifunctions",
                    "sources",
                    "wikidata",
                ]:
                    # These are sites that end with voyage, quote, news
                    continue
                lang = site[: -len("wiki")]
                sitelink_dict[lang] = v["title"]

            english_locale = None
            if "labels" not in wikidata_entity:
                logger.debug(
                    f"Did not find any labels in the Wikidata entry {wikidata_entity}"
                )
                return None, {language: {document_title: ""}}

            if "en" in sitelink_dict:
                english_name = sitelink_dict["en"]
            else:
                if "en" in wikidata_entity["labels"]:
                    english_locale = "en"
                elif "en-gb" in wikidata_entity["labels"]:
                    english_locale = "en-gb"
                elif "en-ca" in wikidata_entity["labels"]:
                    english_locale = "en-ca"
                else:
                    logger.debug(
                        f"Did not find any English labels in Wikidata for {document_title}"
                    )
                    return None, {language: {document_title: ""}}
                english_name = wikidata_entity["labels"][english_locale]["value"]

            new_translation_dict = {}
            set_of_available_languages = set(
                list(sitelink_dict.keys()) + list(wikidata_entity["labels"].keys())
            )

            # No need to include these in the translation map
            for lang in ["en", "en-gb", "en-ca", "commons", "simple"]:
                set_of_available_languages.discard(lang)

            for lang in set_of_available_languages:
                if lang in sitelink_dict:
                    new_translation_dict[lang
```

### Core Architecture Module: `retrieval/server_utils.py`
```
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
import re
import markdown
from slowapi import Limiter
from utils.logging import logger

markdown_converter = None


def convert_custom_markdown_table_to_html(markdown_table_string: str) -> str:
    """Converts the custom Markdown-like table string from _triplet_serialize to an HTML table."""
    # Remove the outer <Table> tags and strip whitespace
    content = (
        markdown_table_string.strip()
        .removeprefix("<Table>")
        .removesuffix("</Table>")
        .strip()
    )
    lines = content.split("\n")

    if len(lines) < 2:
        # Not enough lines for a header and separator
        return "<table><!-- Malformed custom table input --></table>"

    header_line = lines[0]
    # The separator line (lines[1]) is specific to Markdown and not needed for HTML
    data_lines = lines[2:]

    # --- Process Header ---
    # Use regex to handle potential empty cells or extra spacing
    header_cells_match = re.findall(r"\|\s*(.*?)\s*(?=\|)", header_line)
    if not header_cells_match:
        return "<table><!-- Invalid header format --></table>"
    header_cells = header_cells_match  # Already stripped by the regex group
    num_cols = len(header_cells)

    html_header = "<thead>\n  <tr>\n"
    for header in header_cells:
        html_header += f"    <th>{header}</th>\n"  # No strip needed
    html_header += "  </tr>\n</thead>"

    # --- Process Data Rows ---
    html_body = "<tbody>\n"
    for row_line in data_lines:
        row_line = row_line.strip()
        if not row_line:
            continue

        html_body += "  <tr>\n"
        # Check if it's a simplified "key: value" row (doesn't start with '|')
        if ":" in row_line and not row_line.startswith("|"):
            parts = row_line.split(":", 1)
            key = parts[0].strip()
            value = parts[1].strip() if len(parts) > 1 else ""
            html_body += f"    <td>{key}</td>\n"
            # Use colspan for the value if the original table had more than 1 column
            colspan_attr = f' colspan="{num_cols - 1}"' if num_cols > 1 else ""
            # Ensure at least one value cell even if num_cols is 1
            if num_cols > 1 or colspan_attr == "":
                html_body += f"    <td{colspan_attr}>{value}</td>\n"

        # Check if it's a standard Markdown table row
        elif row_line.startswith("|") and row_line.endswith("|"):
            # Extract cells using regex to handle potential empty cells correctly
            row_cells_match = re.findall(r"\|\s*(.*?)\s*(?=\|)", row_line)
            row_cells = row_cells_match  # Already stripped
            # Pad row with empty cells if it has fewer columns than the header
            row_cells.extend([""] * (num_cols - len(row_cells)))
            # Ensure we don't create more cells than header columns
            for i in range(num_cols):
                cell_content = row_cells[i] if i < len(row_cells) else ""
                html_body += f"    <td>{cell_content}</td>\n"
        else:
            # Handle unexpected row format, maybe treat as a single cell spanning the row
            html_body += f'    <td colspan="{num_cols}">{row_line}</td>\n'

        html_body += "  </tr>\n"
    html_body += "</tbody>"

    # --- Combine and Return ---
    html_table = f"<table>\n{html_header}\n{html_body}\n</table>"
    return html_table


def markdown_to_html(markdown_string: str) -> str:
    """
    Converts a Markdown string, potentially containing custom <Table> blocks, to HTML.

    Args:
        markdown_string: The input Markdown string.

    Returns:
        The converted HTML string.
    """

    def replace_table_match(match):
        """Helper function to pass to re.sub"""
        custom_table_block = match.group(0)  # The full <Table>...</Table> block
        return convert_custom_markdown_table_to_html(custom_table_block)

    # Find and replace all custom table blocks with their HTML equivalent
    # Use re.DOTALL so '.' matches newline characters within the table block
    # Use non-greedy matching '.*?' to handle multiple tables correctly
    processed_markdown = re.sub(
        r"<Table>.*?</Table>", replace_table_match, markdown_string, flags=re.DOTALL
    )

    # Convert the rest of the Markdown (including the inserted HTML tables) to HTML
    # The markdown library usually treats existing HTML tags as raw HTML.
    html_output = markdown.markdown(processed_markdown, extensions=["extra", "tables"])

    return html_output


limiter = Limiter(key_func=get_remote_address, storage_uri="redis://localhost:6379")
templates = Jinja2Templates(directory="public")


# Custom middleware to increase the maximum request size
class MaxSizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_body_size: int):
        super().__init__(app)
        self.max_body_size = max_body_size

    async def dispatch(self, request: Request, call_next):
        if request.method == "POST":
            # Check the content length of the request
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > self.max_body_size:
                return JSONResponse({"error": "File too large"}, status_code=413)
        return await call_next(request)


def exempt_from_rate_limit_when(request: Request):
    sender_ip = request.client.host
    logger.info(f"Request from IP: {sender_ip}")
    if sender_ip in [
        "127.0.0.1",  # Exempt requests from the front-end
        "20.83.187.209",
        "testclient",  # Exempt requests when testing
    ]:
        logger.debug("Exempt from rate limit")
        return True
    return False

```

### Core Architecture Module: `utils/cache.py`
```
import asyncio
import functools
import pickle


from diskcache import Cache


cache = Cache(directory="./.diskcache")


def diskcache_cache(func):
    """
    Decorator that caches the results of the decorated function.
    """
    if asyncio.iscoroutinefunction(func):

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            key = pickle.dumps(
                (func.__module__, func.__qualname__, args, tuple(kwargs.items()))
            )
            if key in cache:
                return pickle.loads(cache[key])
            result = await func(*args, **kwargs)
            cache[key] = pickle.dumps(result)
            return result

        return async_wrapper
    else:

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            key = pickle.dumps(
                (func.__module__, func.__qualname__, args, tuple(kwargs.items()))
            )
            if key in cache:
                return pickle.loads(cache[key])
            result = func(*args, **kwargs)
            cache[key] = pickle.dumps(result)
            return result

        return sync_wrapper

```

### Core Architecture Module: `utils/docker_utils.py`
```
import re
import time

import docker
from docker.errors import NotFound, APIError
from utils.logging import logger
from typing import Optional
from docker.models.containers import Container


def check_if_docker_container_is_running(
    docker_client: docker.DockerClient, container_name: str
) -> bool:
    """
    Checks if a Docker container with the exact name is currently running.

    Args:
        docker_client: An initialized Docker client instance.
        container_name: The exact name of the container to check.

    Returns:
        True if a container with the exact name is running, False otherwise.
        Returns False on API or unexpected errors during the check.
    """
    try:
        # Use filters for efficient lookup of *running* containers by exact name.
        # The regex anchors ^ and $ ensure exact match.
        # list() returns an empty list if no match, does not raise NotFound.
        running_containers = docker_client.containers.list(
            filters={"name": f"^{container_name}$", "status": "running"}
        )

        if running_containers:
            # This case should be rare with exact name matching but log if it occurs.
            if len(running_containers) > 1:
                logger.warning(
                    f"Multiple *running* containers found matching the exact name '{container_name}'. "
                    f"This is unusual. Returning True. IDs: {[c.id for c in running_containers]}"
                )
            else:
                logger.debug(
                    f"Found running container '{container_name}' (ID: {running_containers[0].id})."
                )
            return True
        else:
            logger.debug(
                f"No *running* container found with the exact name '{container_name}'."
            )
            return False

    except APIError as e:
        logger.error(
            f"API error checking running status for container '{container_name}': {e}"
        )
        return False
    except Exception as e:
        # Log other potential errors during listing
        logger.error(
            f"Unexpected error checking running status for container '{container_name}': {e}"
        )
        return False


def get_docker_container_by_name(
    docker_client: docker.DockerClient, container_name: str
) -> Optional[Container]:
    """
    Retrieves a Docker container (running or stopped) by its exact name.

    Args:
        docker_client: An initialized Docker client instance.
        container_name: The exact name of the container to retrieve.

    Returns:
        The container object if found, otherwise None. Returns None on API or
        unexpected errors during lookup.

    Note:
        While Docker typically prevents having multiple *running* containers
        with the exact same name, it's theoretically possible (though rare,
        perhaps involving stopped containers or edge cases) for the API
        to return multiple containers matching an exact name filter. This
        function handles that possibility by logging a warning and returning
        the first container found.
    """
    try:
        # Use filters for efficient lookup by exact name across all states.
        # The regex anchors ^ and $ ensure exact match.
        containers = docker_client.containers.list(
            all=True, filters={"name": f"^{container_name}$"}
        )

        if not containers:
            logger.debug(f"No container found with the exact name '{container_name}'.")
            return None

        if len(containers) > 1:
            # This case should be rare with exact name matching but log if it occurs.
            logger.warning(
                f"Multiple containers found matching the exact name '{container_name}'. "
                f"This is unusual. Returning the first one found (ID: {containers[0].id}). "
                f"Container IDs found: {[c.id for c in containers]}"
            )

        return containers[0]

    except APIError as e:
        logger.error(f"API error while retrieving container '{container_name}': {e}")
        return None
    except Exception as e:
        # Catch other potential errors during the listing process.
        logger.error(f"Unexpected error retrieving container '{container_name}': {e}")
        return None


def strip_ansi_codes(log_text: str) -> str:
    """Removes ANSI escape codes from a string."""
    ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
    return ansi_escape.sub("", log_text)


def wait_for_docker_container_to_be_ready(
    container, string_in_output: str = "", timeout: int = 600
):
    """
    Waits for the specified Docker container to be ready.

    Polls the container status and logs until the container is 'running'
    and, if `string_in_output` is provided, that string appears in the logs.

    Args:
        container: The Docker container instance.
        string_in_output (str): The string to look for in the container's output
                                to consider it ready. If empty, only status is checked.
        timeout (int): Maximum time to wait in seconds.

    Raises:
        RuntimeError: If the container does not become ready within the timeout,
                      exits unexpectedly, or is not found.
    """
    sleep_interval = 2  # Check every 2 seconds
    start_time = time.monotonic()
    logger.info(
        f"Waiting for container '{container.name}' to be ready "
        f"(timeout: {timeout}s)..."
    )

    last_log_length = 0
    container_id = container.id  # Store ID for logging in case of errors

    while time.monotonic() - start_time < timeout:
        try:
            # Reload the container's state from the server
            container.reload()
            status = container.status

            if status == "running":
                logs = ""
                try:
                    # Fetch logs only when running
                    # Use errors='replace' for robustness against decoding errors
                    logs = strip_ansi_codes(
                        container.logs().decode("utf-8", errors="replace")
                    )
                    new_logs = logs[last_log_length:]
                    if new_logs.strip():  # Log only if there's actual new content
                        logger.info(
                            f"Container '{container.name}' new logs:\n{new_logs.strip()}"
                        )
                    last_log_length = len(logs)
                except APIError as log_err:
                    logger.warning(
                        f"API error fetching logs for running container '{container.name}': {log_err}. Continuing wait."
                    )
                except Exception as log_err:
                    logger.warning(
                        f"Unexpected error fetching logs for running container '{container.name}': {log_err}. Continuing wait."
                    )

                # Check readiness condition: running and (no string needed OR string found)
                if not string_in_output or string_in_output in logs:
                    logger.info(f"Container '{container.name}' is ready.")
                    return  # Success: Container is ready

            elif status in ["exited", "dead"]:
                logger.error(
                    f"Container '{container.name}' exited unexpectedly with status '{status}'."
                )
                final_logs = ""
                try:
                    final_logs = strip_ansi_codes(
                        container.logs().decode("utf-8", errors="replace")
                    )
                    logger.error(
                        f"Final logs for '{container.name}':\n{final_logs.strip()}"
                    )
                except Exception as log_err:
                    logger.error(
                        f"Could not fetch final logs for exited container '{container.name}': {log_err}"
                    )
                raise RuntimeError(
                    f"Container '{container.name}' exited unexpectedly with status '{status}'."
                )
            # else: status is 'created', 'restarting', 'paused', 'removing' -> continue waiting loop

        except NotFound:
            logger.error(
                f"Container '{container.name}' (ID: {container_id}) not found."
            )
            raise RuntimeError(
                f"Container '{container.name}' (ID: {container_id}) not found during wait."
            )
        except APIError as api_err:
            # Catch Docker API errors during reload/status check
            logger.warning(
                f"API error checking container '{container.name}': {api_err}. Retrying..."
            )
        except Exception as e:
            # Catch other potential errors
            logger.warning(
                f"Unexpected error checking container '{container.name}': {e}. Retrying..."
            )

        # Wait before the next check
        time_left = timeout - (time.monotonic() - start_time)
        time.sleep(
            min(sleep_interval, max(0, time_left))
        )  # Avoid sleeping longer than remaining time

    # Loop finished: Timeout reached
    final_status = "unknown"
    final_logs = ""
    try:
        # Perform one final check after the loop exits
        container.reload()
        final_status = container.status
        if final_status == "running":
            final_logs = strip_ansi_codes(
                container.logs().decode("utf-8", errors="replace")
            )
            if not string_in_output or string_in_output in final_logs:
                logger.info(
                    f"Container '{container.name}' became ready just at the timeout limit."
                )
                return  # Success right at the end

    except Exception as e:
        logger.error(f"Error during final check for container '{container.name}': {e}")
        # Fall through to raise timeout error, including th
```

### Core Architecture Module: `utils/logging.py`
```
import logging
from loguru import logger
from rich.logging import RichHandler

import warnings

warnings.filterwarnings(
    "ignore", message="Valid config keys have changed in V2:.*", category=UserWarning
)


class LiteLLMFilter(logging.Filter):
    def filter(self, record):
        return not (record.name == "LiteLLM" and record.levelno == logging.INFO)


# Remove the default loguru handler
logger.remove()

# Add a new handler using RichHandler for console output
logger.add(
    RichHandler(markup=True, show_time=False),  # Enable rich markup for colored output
    level="INFO",  # Set the logging level
    format="{message}",
    backtrace=True,  # Include the backtrace in the log
    diagnose=True,  # Include diagnostic information in the log
)

# Add another handler for saving debug logs to a file
logger.add(
    "debug_logs.log",  # File path for the log file
    level="DEBUG",  # Set the logging level to DEBUG
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name} | {message}",  # Log format
    rotation="5 MB",  # Rotate the log file when it reaches 10 MB
    retention=2,  # Keep a maximum of 2 log files
    backtrace=True,  # Include the backtrace in the log
    diagnose=True,  # Include diagnostic information in the log
)

```

### Core Architecture Module: `backend_server.py`
```
import argparse
import random
import string

import chainlit as cl
from chainlit.input_widget import Select
from chainlite import Runnable

from chainlit_callback_handler import ChainlitCallbackHandler
from corpora import all_corpus_objects, corpus_name_to_corpus_object
from database import save_dialogue_to_db
from pipelines.chatbot import create_chain
from pipelines.dialogue_state import DialogueState, DialogueTurn
from pipelines.pipeline_arguments import (
    add_pipeline_arguments,
    check_pipeline_arguments,
)
from pipelines.utils import dict_to_command_line
from tasks.defaults import CHATBOT_DEFAULT_CONFIG
from utils.logging import logger


@cl.set_chat_profiles
async def chat_profile(current_user: cl.User | None):
    ret = []
    for corpus in all_corpus_objects:
        ret.append(
            cl.ChatProfile(
                name=corpus.name,
                icon=corpus.icon_path,
                markdown_description=corpus.human_description_markdown,
                starters=[
                    cl.Starter(
                        label=starter.display_label,
                        message=starter.chat_message,
                        icon=starter.icon_path,
                    )
                    for starter in corpus.chat_starters
                ],
            )
        )

    return ret


@cl.on_chat_start
async def start():
    await cl.ChatSettings(
        [
            Select(
                id="model",
                label="Model",
                values=["gpt-4o-mini", "gpt-4o"],
                initial_index=0,
                description="Select the large language model to use.",
            ),
        ]
    ).send()
    corpus_name = cl.user_session.get("chat_profile")
    assert isinstance(corpus_name, str), "Missing or invalid chat_profile"
    logger.debug(f"Using corpus with name '{corpus_name}'")

    parser = argparse.ArgumentParser()
    add_pipeline_arguments(parser)

    # set parameters
    args = parser.parse_args(
        dict_to_command_line(
            CHATBOT_DEFAULT_CONFIG,
            corpus_name_to_corpus_object(corpus_name).overwritten_parameters,
        )
    )
    check_pipeline_arguments(args)

    chatbot, dialogue_state = create_chain(args)

    cl.user_session.set("chatbot", chatbot)
    cl.user_session.set("dialogue_state", dialogue_state)
    cl.user_session.set(
        "dialogue_id",
        "".join(random.choices(string.ascii_letters + string.digits, k=8)),
    )  # 8-character random string as the unique dialogue_id


@cl.on_settings_update
async def setup_agent(settings):
    cl.user_session.set("model", settings["model"])


@cl.on_message
async def chat(message: cl.Message):
    chatbot_raw = cl.user_session.get("chatbot")
    assert isinstance(chatbot_raw, Runnable), "Missing or invalid chatbot in session"
    chatbot: Runnable = chatbot_raw
    dialogue_state_raw = cl.user_session.get("dialogue_state")
    assert isinstance(
        dialogue_state_raw, DialogueState
    ), "Missing or invalid dialogue_state in session"
    dialogue_state: DialogueState = dialogue_state_raw
    model = cl.user_session.get("model")
    if model:
        dialogue_state.config.engine = model

    dialogue_state.turns.append(DialogueTurn(user_utterance=message.content))
    await chatbot.ainvoke(
        dialogue_state,
        config={"callbacks": [ChainlitCallbackHandler(dialogue_state=dialogue_state)]},
    )
    new_agent_utterance = dialogue_state.current_turn.agent_utterance

    if not new_agent_utterance:
        new_agent_utterance = "I'm sorry, I don't have an answer for that."
    message = cl.Message(content=new_agent_utterance)
    await message.send()

    for ref_id, ref in enumerate(
        dialogue_state.current_turn.filtered_search_results, start=1
    ):
        summary = "\n".join([f"- {s}" for s in ref.summary])  # add bullet points
        m = cl.Text(
            name=f"[{ref_id}]",
            content=f"## [{ref.full_title}]({ref.url})\n\n**Summary:**\n{summary}\n\n**Full text:**\n\n{ref.content}",
            display="side",
        )
        await m.send(for_id=message.id)


@cl.on_chat_end
def on_chat_end():
    dialogue_state: DialogueState = cl.user_session.get("dialogue_state")
    dialogue_id: str = cl.user_session.get("dialogue_id")
    chat_profile: str = cl.user_session.get("chat_profile")
    if dialogue_state and dialogue_state.turns:
        save_dialogue_to_db(dialogue_state, dialogue_id, chat_profile)

```

### Core Architecture Module: `benchmark/scripts/get_wikipedia_articles_for_benchmark.py`
```
import argparse
import asyncio
import json
import sys
from typing import List
from urllib.parse import quote

import aiohttp
import orjsonl
import requests
from datasets import load_dataset
from tqdm import tqdm, trange
from tqdm.contrib.logging import logging_redirect_tqdm

sys.path.insert(0, "./")
from utils.logging import logger


def load_collection(collection_path: str, max_articles: int = None):
    all_wiki_titles_intros = {}
    for line in tqdm(orjsonl.stream(collection_path), desc="Loading collection"):
        if (
            line["block_type"] != "text"
            or line["document_title"] in all_wiki_titles_intros
        ):
            continue
        title = line["document_title"]
        all_wiki_titles_intros[title] = line["content"]
        if len(all_wiki_titles_intros) == max_articles:
            break
    logger.info(f"Loaded {len(all_wiki_titles_intros)} articles from collection")

    return all_wiki_titles_intros


def get_most_edited_wikipedia_titles(
    language: str,
    year: str,
    month: str,
    day: str = "all-days",
):
    a = requests.get(
        f"https://wikimedia.org/api/rest_v1/metrics/edited-pages/top-by-edits/{language}.wikipedia/all-editor-types/content/{year}/{month}/{day}"
    )
    results = a.json()["items"][0]["results"][0]["top"]
    titles = [result["page_title"].replace("_", " ") for result in results]
    return titles


def get_most_edited_wikipedia_articles(language: str, all_wiki_titles_intros):
    most_edited_titles = []
    most_edited_titles.extend(get_most_edited_wikipedia_titles(language, "2023", "11"))
    most_edited_titles.extend(get_most_edited_wikipedia_titles(language, "2023", "12"))
    most_edited_titles.extend(get_most_edited_wikipedia_titles(language, "2024", "01"))
    most_edited_titles.extend(get_most_edited_wikipedia_titles(language, "2024", "02"))
    most_edited_titles.extend(get_most_edited_wikipedia_titles(language, "2024", "03"))
    most_edited_titles.extend(get_most_edited_wikipedia_titles(language, "2024", "04"))

    logger.info(f"most_edited_titles = {most_edited_titles}")

    most_edited_titles_intros = {}
    for title in most_edited_titles:
        if title in most_edited_titles_intros:
            continue
        if title in all_wiki_titles_intros:
            most_edited_titles_intros[title] = all_wiki_titles_intros[title]
        else:
            logger.info(f"Missing article in collection: {title}")

    logger.info(
        f"Found {len(most_edited_titles_intros)} articles out of {len(most_edited_titles)}"
    )
    return most_edited_titles_intros


async def get_total_views(article: str, session, end_date: str, language: str):
    try:
        # we input year 2000 to year 3000, and the API will return from the beginning of statistics (2015) to the current unfinished month
        # the API expects a user agent
        url = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{language}.wikipedia.org/all-access/user/{quote(article, safe='')}/monthly/20000101/{end_date}"
        async with session.get(
            url=url,
            headers={"User-Agent": "wikichat/1.0"},
        ) as response:
            a = await response.json()
            if "items" not in a or ("title" in a and a["title"] == "Not found."):
                # logger.info(
                #     "Number of page views for article '%s' not found, probably due to it being too new.", article,
                # )
                return 0
            results = a["items"]
            views = [item["views"] for item in results]
            return sum(views)
    except Exception as e:
        logger.error(f"Unable to get views for request '{url}' due to error {str(e)}.")
        return -1


async def batch_get_total_views(articles: List[str], end_date: str, language: str):
    async with aiohttp.ClientSession() as session:
        with logging_redirect_tqdm():
            minibatch_size = 100  # The wikipedia API only allows 100 requests per second, so we batch the requests.
            all_outputs = []
            for i in trange(
                0, len(articles), minibatch_size, desc="getting view stats"
            ):
                batch = articles[i : i + minibatch_size]
                ret = await asyncio.gather(
                    *[
                        get_total_views(article, session, end_date, language)
                        for article in batch
                    ]
                )
                if -1 in ret:
                    # wait for longer if we get an rate limit error
                    await asyncio.sleep(5)
                all_outputs.extend(ret)
                await asyncio.sleep(1)

    return all_outputs


def get_most_and_least_viewed_articles(
    all_wiki_titles_intros,
    num_articles_to_search: int,
    num_articles_to_return: int,
    end_date: str,
    language: str,
):
    """
    num_articles: the number of articles to read from the collection. Due to API limitations, we cannot get all article views in a reasonable time.
    """
    assert num_articles_to_return * 2 <= num_articles_to_search

    all_wiki_titles = list(all_wiki_titles_intros.keys())[:num_articles_to_search]
    all_total_views = {}
    total_views = asyncio.run(
        batch_get_total_views(all_wiki_titles, end_date=end_date, language=language)
    )

    for i, title in enumerate(all_wiki_titles):
        all_total_views[title] = total_views[i]

    # ignore the articles we couldn't find
    all_total_views = [item for item in all_total_views.items() if item[1] > 0]
    # sort by total views
    all_total_views = sorted(all_total_views, key=lambda item: item[1], reverse=True)
    most_viewed_articles = {}
    for title, total_views in all_total_views[:num_articles_to_return]:
        most_viewed_articles[title] = all_wiki_titles_intros[title]

    least_viewed_articles = {}
    for title, total_views in all_total_views[-num_articles_to_return:]:
        least_viewed_articles[title] = all_wiki_titles_intros[title]

    return most_viewed_articles, least_viewed_articles


def get_hotpotqa_articles(all_wiki_titles_intros, num_articles_to_return: int):
    dataset = load_dataset("hotpot_qa", "fullwiki")["validation"]
    count = 0
    ret = []
    for i in range(len(dataset)):
        if count == num_articles_to_return:
            break
        example = dataset[i]
        if example["type"] == "comparison":
            question = example["question"]
            wiki_articles = list(set(example["supporting_facts"]["title"]))
            assert len(wiki_articles) == 2
            if (
                wiki_articles[0] in all_wiki_titles_intros
                and wiki_articles[1] in all_wiki_titles_intros
            ):
                ret.append(
                    {
                        "title_1": wiki_articles[0],
                        "paragraph_1": all_wiki_titles_intros[wiki_articles[0]],
                        "title_2": wiki_articles[1],
                        "paragraph_2": all_wiki_titles_intros[wiki_articles[1]],
                        "hotpot_question": question,
                    }
                )
                count += 1
    return ret


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--recent_output_file",
        type=str,
        required=True,
        help="Where to write the recent articles",
    )
    parser.add_argument(
        "--head_output_file",
        type=str,
        required=True,
        help="Where to write the most viewed articles",
    )
    parser.add_argument(
        "--tail_output_file",
        type=str,
        required=True,
        help="Where to write the least viewed articles",
    )
    parser.add_argument(
        "--multihop_output_file",
        type=str,
        required=True,
        help="Where to write the multihop articles",
    )
    parser.add_argument(
        "--collection_path",
        type=str,
        required=True,
        help="The .jsonl files containing wikipedia chunks.",
    )
    parser.add_argument(
        "--language",
        type=str,
        required=True,
        help="The .jsonl file containing wikipedia chunks.",
    )

    args = parser.parse_args()

    all_wiki_titles_intros = load_collection(args.collection_path)
    # hotpotqa_articles = get_hotpotqa_articles(
    # all_wiki_titles_intros, num_articles_to_return=1000
    # )
    # with open(args.multihop_output_file, "w") as f:
    # json.dump(hotpotqa_articles, f, indent=2, ensure_ascii=False)

    recent_articles = get_most_edited_wikipedia_articles(
        args.language, all_wiki_titles_intros
    )
    with open(args.recent_output_file, "w") as f:
        json.dump(recent_articles, f, indent=2, ensure_ascii=False)

    (
        most_viewed_articles,
        least_viewed_articles,
    ) = get_most_and_least_viewed_articles(
        all_wiki_titles_intros,
        num_articles_to_search=1000000,  # ~6.7M articles in Wikipedia
        num_articles_to_return=5000,
        end_date="20221231",  # end of 2022
        language=args.language,
    )

    with open(args.head_output_file, "w") as f:
        json.dump(most_viewed_articles, f, indent=2, ensure_ascii=False)
    with open(args.tail_output_file, "w") as f:
        json.dump(least_viewed_articles, f, indent=2, ensure_ascii=False)

```

### Core Architecture Module: `benchmark/user_simulator.py`
```
"""
Uses an LLM to talk to our chatbot. Used for evaluation and model distillation.
"""

import argparse
import asyncio
import json
import logging
import random
import sys

import spacy
from tqdm import tqdm

sys.path.insert(0, "./")
from chainlite import get_total_cost, llm_generation_chain, write_prompt_logs_to_file

from utils.logging import logger, make_parent_directories
from pipelines.chatbot import create_chain, run_one_turn
from pipelines.dialogue_state import DialogueTurn
from pipelines.pipeline_arguments import (
    add_pipeline_arguments,
    all_configured_engines,
    check_pipeline_arguments,
)


spacy_nlp = spacy.load("en_core_web_sm")

user_characteristics = [
    "- Ask interesting follow-up questions when needed, and expand on the chatbot's responses using your life experiences.\n- Never volunteer information, and never correct chatbot's mistakes.",
    "- You are adversarially stress-testing the chatbot.\n- Never volunteer information, and never correct chatbot's mistakes.",
    "- You switch to other topics whenever possible.\n- Keep your inputs short.",
    "- Ask interesting questions about the recent things that happened about the topic.\n- Never volunteer information, and never correct chatbot's mistakes.",
    "- Always disagree with what the chatbot says.",
]


def remove_prefix(utterance: str):
    if utterance.startswith("User:"):
        utterance = utterance[len("User:") :].strip()

    return utterance


def user_simulation_chain(user_engine: str, user_temperature: float, language: str):
    return (
        llm_generation_chain(
            template_file="benchmark/prompts/user_with_passage.prompt",
            engine=user_engine,
            max_tokens=60,
            temperature=user_temperature,
            stop_tokens=["\n"],
            postprocess=False,
            bind_prompt_values={"language": language},
        )
        | remove_prefix
    )


async def simulate_dialogue(dialogue_inputs, args) -> list[DialogueTurn]:
    """
    Simulate one dialogue
    """
    user_character = random.choice(user_characteristics)
    chatbot, dialogue_state = create_chain(args)

    user_chain = user_simulation_chain(
        args.user_engine, args.user_temperature, args.language
    )
    try:
        for _ in range(args.num_turns):
            if args.mode == "topic":
                new_user_utterance = await user_chain.ainvoke(
                    {
                        "dlg": dialogue_state["dialogue_history"],
                        "user_character": user_character,
                        "topic": dialogue_inputs,
                    }
                )
            elif args.mode == "passage":
                new_user_utterance = await user_chain.ainvoke(
                    {
                        "dlg": dialogue_state["dialogue_history"],
                        "user_character": user_character,
                        "title": dialogue_inputs[0],
                        "passage": dialogue_inputs[1],
                    }
                )
            elif args.mode == "multihop":
                new_user_utterance = await user_chain.ainvoke(
                    {
                        "dlg": dialogue_state["dialogue_history"],
                        "user_character": user_character,
                        "title_1": dialogue_inputs["title_1"],
                        "paragraph_1": dialogue_inputs["paragraph_1"],
                        "title_2": dialogue_inputs["title_2"],
                        "paragraph_2": dialogue_inputs["paragraph_2"],
                    }
                )
            if new_user_utterance == "":
                logger.error("Simulated user utterance is empty.")
                return None
            new_agent_utterance, dialogue_state = await run_one_turn(
                chatbot, dialogue_state, new_user_utterance
            )

    except Exception:
        logger.exception(
            f"Skipping dialog due to exception. dialogue_inputs={str(dialogue_inputs)}"
        )
    return dialogue_state


def repeat_dialogue_inputs(dialogue_inputs, target_num_dialogues):
    """
    repeats dialogue_inputs if we don't have enough of them, truncates if there are too many
    """
    if target_num_dialogues == -1:
        target_num_dialogues = len(dialogue_inputs)
    full_rounds = target_num_dialogues // len(dialogue_inputs)
    dialogue_inputs = (
        dialogue_inputs * full_rounds
        + dialogue_inputs[: target_num_dialogues % len(dialogue_inputs)]
    )
    assert len(dialogue_inputs) == target_num_dialogues
    return dialogue_inputs


async def main(args):
    topics = []
    if args.mode == "topic":
        dialogue_inputs = []
        with open(args.input_file) as input_file:
            for line in input_file:
                line = line.strip()
                if len(line) > 0:
                    dialogue_inputs.append(line)

        dialogue_inputs = repeat_dialogue_inputs(dialogue_inputs, args.num_dialogues)
        topics = dialogue_inputs
    elif args.mode == "passage":
        with open(args.input_file) as input_file:
            dialogue_inputs = json.load(input_file)
        # only include the first sentence of the passage
        dialogue_inputs = [
            (title, list(spacy_nlp(passage).sents)[0])
            for title, passage in dialogue_inputs.items()
        ]

        dialogue_inputs = repeat_dialogue_inputs(dialogue_inputs, args.num_dialogues)
        topics = [tp[0] for tp in dialogue_inputs]
    elif args.mode == "multihop":
        with open(args.input_file) as input_file:
            dialogue_inputs = json.load(input_file)
            dialogue_inputs = repeat_dialogue_inputs(
                dialogue_inputs, args.num_dialogues
            )
            topics = [m["title_1"] + " and " + m["title_2"] for m in dialogue_inputs]
    else:
        raise ValueError(f"Unknown mode: {args.mode}")

    all_dialogues = []
    for i in tqdm(
        range(0, len(dialogue_inputs), args.batch_size), desc="Dialogue Batches"
    ):
        batch = dialogue_inputs[i : i + args.batch_size]
        batch_results = await asyncio.gather(
            *[simulate_dialogue(di, args=args) for di in batch]
        )
        all_dialogues.extend(batch_results)

    make_parent_directories(args.output_file)
    with open(args.output_file, "w") as output_file:
        for idx, dlg in enumerate(all_dialogues):
            if not dlg or not dlg["dialogue_history"]:
                logger.error(f'dialog with topic "{topics[idx]}" failed')
                # skip dialogs that failed
                continue
            output_file.write("Topic: " + topics[idx].strip() + "\n")
            for dlg_turn in dlg["dialogue_history"]:
                output_file.write(
                    "User: "
                    + dlg_turn.user_utterance
                    + "\nChatbot: "
                    + dlg_turn.agent_utterance
                    + "\n\n"
                )

                # turn_log = state_to_string(dlg)
                # log_file.write(turn_log)
                # log_file.write("\n")

            # dialog is finished
            output_file.write("=====\n")

    write_prompt_logs_to_file(args.output_file.strip("txt") + "log")
    logger.info(f"Total LLM cost: ${get_total_cost():.2f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    add_pipeline_arguments(parser)
    parser.add_argument(
        "--mode",
        type=str,
        required=True,
        default="topic",
        choices=["topic", "passage", "multihop"],
        help="What type of user simulation to do.",
    )
    parser.add_argument(
        "--user_engine",
        type=str,
        required=True,
        choices=all_configured_engines,
        help="Which LLM to use for user simulator.",
    )
    parser.add_argument(
        "--user_temperature",
        type=float,
        default=0.9,
        help="The temperature to use for the user simulator.",
    )
    parser.add_argument(
        "--input_file",
        type=str,
        required=True,
        help="Where to read conversation topics, or passages from.",
    )
    parser.add_argument(
        "--output_file", type=str, required=True, help="Where to write the outputs"
    )
    parser.add_argument(
        "--num_dialogues",
        type=int,
        required=True,
        help="The number of dialogues to generate. -1 means all topics.",
    )
    parser.add_argument(
        "--num_turns",
        type=int,
        required=True,
        help="The number of turns in each dialogue",
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=10,
        help="The number of dialogues to simulate in parallel",
    )
    parser.add_argument(
        "--language",
        type=str,
        required=True,
        help="Which language the user should speak in. E.g. `en` for English",
    )
    parser.add_argument("--no_logging", action="store_true", help="Disables logging")

    args = parser.parse_args()
    check_pipeline_arguments(args)

    if args.no_logging:
        logging.basicConfig(
            level=logging.ERROR, format=" %(name)s : %(levelname)-8s : %(message)s"
        )
    else:
        logging.basicConfig(
            level=logging.INFO, format=" %(name)s : %(levelname)-8s : %(message)s"
        )

    asyncio.run(main(args))

```

### Core Architecture Module: `chainlit_callback_handler.py`
```
from typing import Optional

from chainlit import LangchainCallbackHandler, Step
from chainlit.context import context_var
from langchain.callbacks.tracers.schemas import Run
from literalai.helper import utc_now

from pipelines.dialogue_state import DialogueState
from retrieval.retrieval_commons import QueryResult

step_name_mapping = {
    "LangGraph": "Steps",
    "query_stage": "Query",
    "generate_stage": "Generate Claims w/ LLM",
    "search_stage": "Search",
    "llm_claim_search_stage": "Search Claims",
    "filter_information_stage": "Filter Information",
    "draft_stage": "Draft",
    # "refine_stage": "Refine",
}


class ChainlitCallbackHandler(LangchainCallbackHandler):
    def __init__(
        self,
        dialogue_state: DialogueState,
    ):
        """
        step_name_mapping: Steps without a mapping are excluded from the front-end
        """

        super().__init__(
            to_ignore=None,
            to_keep=None,
        )
        self.dialogue_state = dialogue_state

    def _should_ignore_run(self, run: Run) -> tuple[bool, Optional[str]]:
        if run.name not in step_name_mapping or (
            run.tags and not run.tags[0].startswith("graph:")
        ):
            # steps that don't start with graph: are function names associated with graph steps, and are therefore duplicates
            return True, None
        return super()._should_ignore_run(run)

    def _start_trace(self, run: Run) -> None:
        super()._start_trace(run)
        context_var.set(self.context)

        ignore, parent_id = self._should_ignore_run(run)

        if run.run_type in ["chain", "prompt"]:
            self.generation_inputs[str(run.id)] = self.ensure_values_serializable(
                run.inputs
            )

        if ignore:
            return

        step_type = "undefined"
        if run.run_type == "agent":
            step_type = "run"
        elif run.run_type == "chain":
            pass
        elif run.run_type == "llm":
            step_type = "llm"
        elif run.run_type == "retriever":
            step_type = "retrieval"
        elif run.run_type == "tool":
            step_type = "tool"
        elif run.run_type == "embedding":
            step_type = "embedding"

        if not self.steps:
            step_type = "run"

        step = Step(
            id=str(run.id),
            name=(
                step_name_mapping[run.name]
                if run.name in step_name_mapping
                else run.name
            ),
            type=step_type,
            parent_id=parent_id,
            show_input=False,
        )
        step.start = utc_now()

        self.steps[str(run.id)] = step

        self._run_sync(step.send())

    def _on_run_update(self, run: Run) -> None:
        """Process a run upon update."""
        context_var.set(self.context)

        ignore, parent_id = self._should_ignore_run(run)

        if ignore:
            return

        current_step = self.steps.get(str(run.id), None)

        if current_step:
            step_output = None
            if run.name == "query_stage":
                step_output = "\n".join(self.dialogue_state.current_turn.search_query)
                if not step_output:
                    step_output = "_Did not search for anything._"
            elif run.name == "generate_stage":
                step_output = "\n".join(
                    [f"- {c}" for c in self.dialogue_state.current_turn.llm_claims]
                )
                if not step_output:
                    step_output = "_LLM did not generate any claims._"
            elif run.name == "search_stage":
                step_output = "\n".join(
                    [
                        QueryResult.to_markdown(r)
                        for r in self.dialogue_state.current_turn.search_results
                    ]
                )
                if not step_output:
                    step_output = "_No search results._"
            elif run.name == "llm_claim_search_stage":
                step_output = ""
                for claim, search_result in zip(
                    self.dialogue_state.current_turn.llm_claims,
                    self.dialogue_state.current_turn.llm_claim_search_results,
                ):
                    step_output += f"### Claim: {claim}\n{QueryResult.to_markdown(search_result)}\n\n"
                if not step_output:
                    step_output = "_No search results for LLM claims._"
            elif run.name == "filter_information_stage":
                step_output = ""
                for ref in self.dialogue_state.current_turn.filtered_search_results:
                    summary = "\n".join(
                        [f"- {s}" for s in ref.summary]
                    )  # add bullet points
                    step_output += f"#### [{ref.full_title}]({ref.url})\n\n**Summary:**\n{summary}\n\n**Full text:**\n\n{ref.content}\n\n"
            elif run.name == "draft_stage":
                step_output = self.dialogue_state.current_turn.draft_stage_output

            if step_output:
                current_step.output = step_output
                self._run_sync(current_step.update())
            current_step.end = utc_now()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #59** (2026-03-15): **feat: Add Retrieval Quality Evaluation Framework and Hallucination Detection Module**
  *Symptoms*: ## Summary  This PR introduces two new purely additive modules for research and evaluation purposes.  ### 1. Retrieval Quality Evaluation Framework (`evaluation/`)  A comprehensive framework for evaluating retrieval quality:  - **`retrieval_metrics.py`**: Standard IR metrics implementation   - Precision@K, Recall@K, MRR, NDCG   - Semantic similarity (cosine similarity between query and results)   - Diversity metrics (pairwise dissimilarity among results)  - **`ground_truth_builder.py`**: Tools for building evaluation datasets   - Manual annotation support with graded relevance labels   - LLM-assisted relevance labeling   - Import/export for sharing datasets  - **`eval_runner.py`**: Batch evaluation and reporting   - Evaluate retrieval results against ground truth   - Generate comparison reports across configurations   - Save detailed metrics to JSON  ### 2. Hallucination Detection Module (`verification/`)  Post-hoc verification of generated claims against retrieved evidence:  - **`claim_verifier.py`**: Extract and verify claims   - Simple and LLM-based claim extraction   - Verification against retrieved evidence   - Integration with WikiChat's `DialogueTurn` structure  - **`factuality_scorer.py`**: Track factuality across dialogues   - Per-turn and aggregate factuality scores   - Identify problematic claims for review   - Generate human-readable reports  - **`nli_adapter.py`**: Unified NLI interface   - Support for HuggingFace transformer

- **Issue #58** (2026-01-31): **Update README**
  *Symptoms*: I was reading the documentation and found three very small outdated lines. Nothing big, but happy to contribute even these small changes :)
  **Post-Mortem & Fix Analysis**:
  > Thanks!
  > But how about fixing Wikichat first of all?? Hasn't been working for me for _weeks_ now...... 🤨😒😒  <img width="924" height="648" alt="screenshot" src="https://github.com/user-attachments/assets/a9f6d9a2-6675-4063-a766-ca1a53817a7f" /> 
  > > But how about fixing Wikichat first of all?? Hasn't been working for me for _weeks_ now...... 🤨😒😒 >  > <img alt="screenshot" width="924" height="648" src="https://private-user-images.githubusercontent.com/20766261/543262098-a9f6d9a2-6675-4063-a766-ca1a53817a7f.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3Njk4OTE0OTMsIm5iZiI6MTc2OTg5MTE5MywicGF0aCI6Ii8yMDc2NjI2MS81NDMyNjIwOTgtYTlmNmQ5YTItNjY3NS00MDYzLWE3NjYtY2ExYTUzODE3YTdmLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjAxMzElMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwMTMxVDIwMjYzM1omWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTE0MzY1ODI5ZDlmMjk5NzBhODJmZjZkMTU4ZWM2NGViNDEyMGI2YzM3ZDIxZTg3OGE0NzgwYzljYTY4NzcyNzQmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.jvlT7baLp5Fh86ytQDDaNKfXRYIrfsb2ZaOvHm3W1QU">  Should be working now.

- **Issue #57** (2025-10-24): **Add PersuaBot implementation based on arXiv:2407.03585**
  *Symptoms*: Implemented PersuaBot, a zero-shot persuasive chatbot with LLM-generated strategies and information retrieval, based on the paper by Furumai et al. (2024).  Key features: - Dual-module architecture: Question Handling Module (QHM) and Strategy Maintenance Module (SMM) - Strategy decomposition to identify distinct persuasion strategies - Fact-checking pipeline to ensure factual accuracy - Information retrieval to substantiate claims with verified facts - Zero-shot operation without domain-specific training data  Implementation includes: - Core pipeline in pipelines/persuabot.py with all SMM and QHM stages - Dialogue state management in pipelines/persuabot_dialogue_state.py - Six prompt templates for different pipeline stages - Command-line interface in command_line_persuabot.py - Invoke task for easy execution: inv persuabot - Comprehensive documentation in PERSUABOT.md  The implementation follows the WikiChat architecture pattern and integrates seamlessly with the existing retrieval infrastructure.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #53** (2025-04-29): **Minor fixes**
  *Symptoms*: Automated changes by [create-pull-request](https://github.com/peter-evans/create-pull-request) GitHub action

- **Issue #52** (2025-04-29): **Update README**
  *Symptoms*: Automated changes by [create-pull-request](https://github.com/peter-evans/create-pull-request) GitHub action

- **Issue #51** (2025-04-29): **WikiChat 2.1**
  *Symptoms*: Automated changes by [create-pull-request](https://github.com/peter-evans/create-pull-request) GitHub action

- **Issue #50** (2025-04-29): **WikiChat 2.1**
  *Symptoms*: Automated changes by [create-pull-request](https://github.com/peter-evans/create-pull-request) GitHub action

- **Issue #49** (2025-04-29): **Auto-sync**
  *Symptoms*: Automated changes by [create-pull-request](https://github.com/peter-evans/create-pull-request) GitHub action

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

### Incident Patch 1: `ce8eeec5` (2025-04-29)
**Commit Message**: Minor fixes

**File**: `public/js/search.js` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ document.addEventListener('DOMContentLoaded', function () {
         if (words.length === 0) return snippet;
         const escapedWords = words.map(word => escapeRegExp(word));
         const regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
-        return snippet.replace(regex, '<mark class="bg-yellow-100">$1</mark>');
+        const highlightedSnippet = snippet.replace(regex, '<mark class="bg-yellow-100">$1</mark>');
+        return highlightedSnippet;
     }
 
     if (typeof window.toggleMetadata !== 'function') {
```

**File**: `public/templates/base.jinja2` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
         <meta name="keywords"
               content="Search API, Knowledge, Wikipedia, Large Language Models">
         <title>{{ title }}</title>
-        <link rel="icon" href="/public/img/favicon.png" type="image/x-icon">
+        <link rel="icon" href="/public/favicon.png" type="image/x-icon">
         <!-- Include Tailwind CSS CDN -->
         <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.0.2/dist/tailwind.min.css"
               rel="stylesheet">
```

---

### Incident Patch 2: `cbcd3981` (2025-04-29)
**Commit Message**: Minor fixes

**File**: `public/js/search.js` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ document.addEventListener('DOMContentLoaded', function () {
         if (words.length === 0) return snippet;
         const escapedWords = words.map(word => escapeRegExp(word));
         const regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
-        return snippet.replace(regex, '<mark class="bg-yellow-100">$1</mark>');
+        const highlightedSnippet = snippet.replace(regex, '<mark class="bg-yellow-100">$1</mark>');
+        return highlightedSnippet;
     }
 
     if (typeof window.toggleMetadata !== 'function') {
```

**File**: `public/templates/base.jinja2` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
         <meta name="keywords"
               content="Search API, Knowledge, Wikipedia, Large Language Models">
         <title>{{ title }}</title>
-        <link rel="icon" href="/public/img/favicon.png" type="image/x-icon">
+        <link rel="icon" href="/public/favicon.png" type="image/x-icon">
         <!-- Include Tailwind CSS CDN -->
         <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.0.2/dist/tailwind.min.css"
               rel="stylesheet">
```

---

### Incident Patch 3: `35603203` (2025-04-29)
**Commit Message**: Fix for code scanning alert no. 6: Useless regular-expression character escape

Co-authored-by: Copilot Autofix powered by AI <62310815+github-advanced-security[bot]@users.noreply.github.com>

**File**: `public/js/search.js` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ document.addEventListener('DOMContentLoaded', function () {
         words = words.filter(word => word.length >= 3 && !['the', 'he', 'she', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very'].includes(word.toLowerCase()));
         if (words.length === 0) return snippet;
         const escapedWords = words.map(word => escapeRegExp(word));
-        const regex = new RegExp(`\b(${escapedWords.join('|')})\b`, 'gi');
+        const regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
         return snippet.replace(regex, '<mark class="bg-yellow-100">$1</mark>');
     }
 
```

---

### Incident Patch 4: `87705cbb` (2024-01-09)
**Commit Message**: Fix minor bug

**File**: `llm/global_variables.py` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@
         a["api_key"] = os.getenv(a["api_key"])
 
 all_llm_endpoints = [
-    a for a in all_llm_endpoints if "api_key" not in a or a["api_key"] is not None
+    a for a in all_llm_endpoints if "api_key" not in a or (a["api_key"] is not None and len(a["api_key"]) > 0)
 ]  # remove resources for which we don't have a key
 # print("all_llm_endpoints = ", all_llm_endpoints)
 
```

**File**: `llm_config.yaml` (modified, +4/-4)
```diff
@@ -10,8 +10,8 @@ llm_endpoints:
   # Use this endpoint if you are accessing OpenAI models via Azure
   - api_type: azure
     api_version: "2023-07-01-preview"
-    api_base: https://ovalopenairesource.openai.azure.com # Replace [resource] with your Azure OpenAI resource name
-    api_key: OPENAI_API_KEY # This is the the name of the environment variable that contains your Azure OpenAI API key
+    api_base: https://[resource].openai.azure.com # Replace [resource] with your Azure OpenAI resource name
+    api_key: AZURE_OPENAI_API_KEY # This is the the name of the environment variable that contains your Azure OpenAI API key
     engine_map: # For Azure OpenAI, the value on the right hand side should be the "Deployment name" of your model
       text-davinci-003: text-davinci-003
       gpt-35-turbo-instruct: gpt-35-turbo-instruct
@@ -22,7 +22,7 @@ llm_endpoints:
   - api_type: open_ai
     api_version: null
     api_base: https://api.openai.com/v1
-    api_key: OPENAI_API_KEY_BACKUP # This is the the name of the environment variable that contains your OpenAI API key
+    api_key: OPENAI_API_KEY # This is the the name of the environment variable that contains your OpenAI API key
     engine_map:
       text-davinci-003: text-davinci-003
       gpt-35-turbo-instruct: gpt-3.5-turbo-instruct
@@ -40,7 +40,7 @@ llm_endpoints:
   # Use this endpoint if you are hosting your language model locally, e.g. via HuggingFace's text-generation-inference library
   - api_type: local
     api_version: null
-    api_base: http://127.0.0.1:[port] # replace [port] with the port number where your local inference server is running
+    api_base: http://[ip]:[port] # replace [ip] and [port] with the ip and port number where your inference server is running. You can use 0.0.0.0 for the IP address if your inference server is running on this machine.
     prompt_format: simple # One of simple, alpaca or none. Use simple if you are using zero-shot or few-shot prompting. Use simple or alpaca  if you are using a distilled model, depending on what format the model has been trained with.
     engine_map:
       local: local
```

**File**: `pipelines/prompts/verify.prompt` (modified, +1/-1)
```diff
@@ -99,4 +99,4 @@ You rewrite your claim: King Charles III is 75 years old as of {{ today }}.{% en
 
 {% endfor %}
 ]
-Fact-check the claim "{{ claim }}". You think step by step:{{input_end}}{% endblock %}
\ No newline at end of file
+Fact-check the claim "{{ claim }}".{% endblock %} You think step by step:{{input_end}} {# Outside the input block because distilled models don't think step-by-step. #}
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #59** (closed): feat: Add Retrieval Quality Evaluation Framework and Hallucination Detection Module (@Rakshitha-Ireddi)
- **PR #58** (2026-01-31): Update README (@diegodlh)
- **PR #57** (closed): Add PersuaBot implementation based on arXiv:2407.03585 (@shuojiafu)
- **PR #53** (2025-04-29): Minor fixes (@s-jse)
- **PR #52** (2025-04-29): Update README (@s-jse)
- **PR #51** (2025-04-29): WikiChat 2.1 (@s-jse)
- **PR #50** (closed): WikiChat 2.1 (@s-jse)
- **PR #49** (closed): Auto-sync (@s-jse)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
