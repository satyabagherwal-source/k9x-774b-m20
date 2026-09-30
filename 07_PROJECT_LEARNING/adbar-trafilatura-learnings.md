# Forensic Learning Record (Deep Inspection): adbar/trafilatura

> **Canonical Artifact**: `07_PROJECT_LEARNING/adbar-trafilatura-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/adbar/trafilatura](https://github.com/adbar/trafilatura))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:10:08.564Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `adbar/trafilatura`
- **Description**: Python & Command-line tool to gather text and metadata on the Web: Crawling, scraping, extraction, output as CSV, JSON, HTML, MD, TXT, XML
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 6894 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `trafilatura/__init__.py`
```
"""
Python & command-line tool to gather text on the Web:
web crawling/scraping, extraction of text, metadata, comments.
"""

__title__ = "Trafilatura"
__author__ = "Adrien Barbaresi and contributors"
__license__ = "Apache-2.0"
__copyright__ = "Copyright 2019-present, Adrien Barbaresi"
__version__ = "2.2.0"


import logging

from .baseline import baseline, html2txt
from .core import bare_extraction, extract, extract_with_metadata
from .downloads import fetch_response, fetch_url
from .metadata import extract_metadata
from .utils import load_html

logging.getLogger(__name__).addHandler(logging.NullHandler())

__all__ = [
    "bare_extraction",
    "baseline",
    "extract",
    "extract_metadata",
    "extract_with_metadata",
    "fetch_response",
    "fetch_url",
    "html2txt",
    "load_html",
]

```

### Core Architecture Module: `trafilatura/baseline.py`
```
"""
Module regrouping baseline and basic extraction functions.
"""
# pylint:disable-msg=E0611

import json
import re
from collections.abc import Iterable
from copy import copy
from html import unescape
from typing import Any

from lxml.etree import Element, SubElement, _Element
from lxml.html import HtmlElement, fragment_fromstring

from .settings import BASIC_CLEAN_XPATH, DEDUPE_SCAN_CAP, MIN_DUPLICATE_LENGTH
from .utils import HtmlInput, as_list, load_html, remove_control_characters, trim
from .xml import delete_element

# detection (not removal, unlike HTML_STRIP_TAGS): must not fire on comparison-operator prose
# ("i<b and c>d", b a tag name), only real tags -- closing, bare (<p>), self-closing (<br/>), or
# attribute-bearing (contains '='). The old `[^>]*` swallowed prose up to the next '>'.
_HTML_TAG_NAMES = (
    "a|abbr|address|article|aside|b|blockquote|body|br|caption|cite|code|dd|del|div|dl|dt|"
    "em|figcaption|figure|footer|h[1-6]|head|header|hr|html|i|img|ins|kbd|li|main|mark|nav|"
    "ol|p|pre|q|quote|s|section|small|span|strong|sub|summary|sup|table|tbody|td|tfoot|th|"
    "thead|time|title|tr|u|ul"
)
_HTML_MARKUP = re.compile(rf"</({_HTML_TAG_NAMES})>|<({_HTML_TAG_NAMES})(\s[^<>]*=[^<>]*)?/?>", re.IGNORECASE)


def basic_cleaning(tree: HtmlElement) -> HtmlElement:
    "Remove a few section types from the document."
    for elem in BASIC_CLEAN_XPATH(tree):
        delete_element(elem)
    return tree


# schema.org text properties usable as page content
_JSON_TEXT_KEYS = ("articleBody", "reviewBody")
# types whose description carries the page content (teaser tier: summaries, last resort)
_DESCRIPTION_TYPES = ("Product", "VideoObject")
# cheap script pre-filter, derived from what _walk_json consumes: bare strings match
# property names, quoted ones match @type values. "step" is deliberately not a hook
# (too generic a substring); a schema.org HowTo carrying it is caught via its @type
_JSON_HOOKS = (
    *_JSON_TEXT_KEYS,
    "recipeInstructions",
    "acceptedAnswer",
    *tuple(f'"{t}"' for t in (*_DESCRIPTION_TYPES, "HowTo")),
)
_JSON_HOOKS_RE = re.compile("|".join(re.escape(hook) for hook in _JSON_HOOKS))
# a strategy must accumulate more than this much text to be accepted (and a single
# <article> must carry more than this to count as content)
_MIN_CONTENT_LENGTH = 100


def _walk_json(node: Any, bodies: list[str], teasers: list[str]) -> None:
    """Collect schema.org text content from parsed JSON-LD (list-wrapped and @graph-nested
    nodes included). Teasers (Product/VideoObject descriptions) are short summaries,
    only usable when no full-text property exists.

    Note: json_metadata.py's `extract_json` also walks JSON-LD, for metadata rather than
    page content, with different (gated, one-level) traversal — see its docstring for why
    the two aren't unified. `as_list` (utils.py) is the shared building block between them.
    """
    for item in as_list(node):
        if not isinstance(item, dict):
            continue
        bodies.extend(item[key] for key in _JSON_TEXT_KEYS if isinstance(item.get(key), str) and item[key])
        # recipe/how-to instructions: a string, strings, or step objects carrying "text",
        # possibly one itemListElement level down (HowToDirection)
        for key in ("recipeInstructions", "step"):
            for step in as_list(item.get(key)):
                if isinstance(step, str):
                    bodies.append(step)
                elif isinstance(step, dict):
                    subs = [step, *as_list(step.get("itemListElement"))]
                    bodies.extend(sub["text"] for sub in subs if isinstance(sub, dict) and isinstance(sub.get("text"), str))
        # FAQ answers
        answer = item.get("acceptedAnswer")
        if isinstance(answer, dict) and isinstance(answer.get("text"), str):
            bodies.append(answer["text"])
        if any(t in str(item.get("@type", "")) for t in _DESCRIPTION_TYPES) and isinstance(item.get("description"), str):
            teasers.append(item["description"])
        for container in ("@graph", "mainEntity"):
            _walk_json(item.get(container), bodies, teasers)


def _discourse_texts(tree: HtmlElement) -> list[str]:
    "Extract post HTML from the JSON Discourse forums preload into an attribute (page body is empty)."
    node = tree.find('.//div[@id="data-preloaded"]')
    if node is None:
        return []
    try:
        preloaded = json.loads(node.get("data-preloaded") or "")
    except Exception:
        return []
    if not isinstance(preloaded, dict):
        return []
    texts: list[str] = []
    for key, value in preloaded.items():
        if not key.startswith("topic_"):
            continue
        try:
            posts = json.loads(value)["post_stream"]["posts"]
        except Exception:
            continue
        texts.extend(post["cooked"] for post in posts if isinstance(post, dict) and isinstance(post.get("cooked"), str))
    return texts


def _render_text(raw: str) -> str:
    "Derive clean text from an embedded-JSON value which may carry (escaped) HTML markup."
    # some sites HTML-escape the content ("&lt;p&gt;…"); unescape so markup is parsed, not leaked.
    # remove control chars after unescape (&#1; -> one char): strict=False JSON lets them through
    # and lxml rejects them in .text assignments
    raw = remove_control_characters(unescape(raw))
    if _HTML_MARKUP.search(raw):
        try:
            return block_text(fragment_fromstring(raw, create_parent="div"))
        except Exception:  # pragma: no cover
            pass
    return trim(raw)


def _build_body(texts: Iterable[str], dedupe: bool = False) -> tuple[_Element, str]:
    "Wrap one paragraph per text in a fresh body element, optionally dropping repeated content."
    postbody = Element("body")
    temp_text = ""
    for text in texts:
        # strip control chars lxml rejects in .text (element inputs skip load_html's cleaning)
        text = remove_control_characters(text)
        # keep short paragraphs (<= MIN_DUPLICATE_LENGTH) even if they recur -- only long substring
        # repeats (e.g. a <p> nested in its <blockquote>) are artifacts. Scan capped at
        # DEDUPE_SCAN_CAP; newline-joined (trimmed text has none) so no match spans two paragraphs
        if text and (
            not dedupe or len(text) <= MIN_DUPLICATE_LENGTH or len(temp_text) > DEDUPE_SCAN_CAP or text not in temp_text
        ):
            SubElement(postbody, "p").text = text
            temp_text += "\n" + text if temp_text else text
    return postbody, temp_text


def _attempt(texts: Iterable[str], dedupe: bool = False) -> tuple[_Element, str, int] | None:
    "Build a body from the texts and accept it if it carries enough content."
    postbody, temp_text = _build_body(texts, dedupe)
    return (postbody, temp_text, len(temp_text)) if len(temp_text) > _MIN_CONTENT_LENGTH else None


def _collect_json_content(tree: HtmlElement) -> tuple[list[str], list[str]]:
    "Gather raw text content embedded as JSON: (full-text bodies, teaser descriptions). Values may carry markup; render with _render_text at use time."
    bodies: list[str] = []
    teasers: list[str] = []
    for elem in tree.iterfind('.//script[@type="application/ld+json"]'):
        if elem.text and _JSON_HOOKS_RE.search(elem.text):
            try:
                # strict=False: real pages carry raw newlines/tabs inside JSON strings
                _walk_json(json.loads(elem.text, strict=False), bodies, teasers)
            except Exception:  # JSONDecodeError
                continue
    # Discourse forums render posts client-side but embed them as JSON in an attribute
    bodies.extend(_discourse_texts(tree))
    return bodies, teasers


def baseline(filecontent: HtmlInput) -> tuple[_Element, str, int]:
    """Use baseline extraction function targeting content in embedded JSON or text elements.

    Tries a series of sources and takes the first that yields enough text:
    JSON content
```

### Core Architecture Module: `trafilatura/cli.py`
```
"""
Implementing a basic command-line interface.
"""

import argparse
import logging
import sys
from importlib.metadata import version
from platform import python_version

from .cli_utils import (
    cli_crawler,
    cli_discovery,
    examine,
    file_processing_pipeline,
    load_blacklist,
    load_input_dict,
    probe_homepage,
    url_processing_pipeline,
    write_result,
)
from .settings import PARALLEL_CORES, SUPPORTED_FMT_CLI

# options that --list neither downloads nor extracts, hence ignores
_LIST_IGNORED_OPTS = {
    "fast",
    "formatting",
    "precision",
    "recall",
    "images",
    "links",
    "with_metadata",
    "only_with_metadata",
    "comments",
    "tables",
    "deduplicate",
    "output_format",
    "archived",
    "backup_dir",
}

# fix output encoding on some systems
if sys.stdout.encoding != "UTF-8" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "UTF-8" and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def add_args(parser: argparse.ArgumentParser) -> argparse.ArgumentParser:
    "Add argument groups and arguments to parser."

    group1 = parser.add_argument_group("Input", "URLs, files or directories to process")
    group1_ex = group1.add_mutually_exclusive_group()
    group2 = parser.add_argument_group("Output", "Determines if and how files will be written")
    group3 = parser.add_argument_group("Navigation", "Link discovery and web crawling")
    group3_ex = group3.add_mutually_exclusive_group()
    group4 = parser.add_argument_group("Extraction", "Customization of text and metadata processing")
    group5 = parser.add_argument_group("Format", "Selection of the output format")
    group5_ex = group5.add_mutually_exclusive_group()

    group1_ex.add_argument("-i", "--input-file", help="name of input file for batch processing", type=str)
    group1_ex.add_argument("--input-dir", help="read files from a specified directory (relative path)", type=str)
    group1_ex.add_argument("-u", "--URL", help="custom URL download", type=str)

    group1.add_argument(
        "--parallel",
        help="specify a number of cores/threads for downloads and/or processing",
        type=int,
        default=PARALLEL_CORES,
    )
    group1.add_argument("-b", "--blacklist", help="file containing unwanted URLs to discard during processing", type=str)

    group2.add_argument("--list", help="display a list of URLs without downloading them", action="store_true")
    group2.add_argument("-o", "--output-dir", help="write results in a specified directory (relative path)", type=str)
    group2.add_argument("--backup-dir", help="preserve a copy of downloaded files in a backup directory", type=str)
    group2.add_argument("--keep-dirs", help="keep input directory structure and file names", action="store_true")

    group3_ex.add_argument(
        "--feed",
        help="look for feeds and/or pass a feed URL as input",
        nargs="?",
        const=True,
        default=False,
    )
    group3_ex.add_argument(
        "--sitemap",
        help="look for sitemaps for the given website and/or enter a sitemap URL",
        nargs="?",
        const=True,
        default=False,
    )
    group3_ex.add_argument(
        "--crawl",
        help="crawl a fixed number of pages within a website starting from the given URL",
        nargs="?",
        const=True,
        default=False,
    )
    group3_ex.add_argument(
        "--explore",
        help="explore the given websites (combination of sitemap and crawl)",
        nargs="?",
        const=True,
        default=False,
    )
    group3_ex.add_argument(
        "--probe",
        help="probe for extractable content (works best with target language)",
        nargs="?",
        const=True,
        default=False,
    )
    group3.add_argument(
        "--archived",
        help="try to fetch URLs from the Internet Archive if downloads fail",
        action="store_true",
    )
    group3.add_argument(
        "--url-filter",
        help="only process/output URLs containing these patterns (space-separated strings)",
        nargs="+",
        type=str,
    )
    # group3.add_argument('--no-ssl',
    #                    help="Disable secure connections (to prevent SSLError)",
    #                    action="store_true")

    group4.add_argument("-f", "--fast", help="fast (without fallback detection)", action="store_true")
    group4.add_argument("--formatting", help="include text formatting (bold, italic, etc.)", action="store_true", default=None)
    group4.add_argument("--links", help="include links along with their targets", action="store_true")
    group4.add_argument("--images", help="include image sources in output", action="store_true")
    group4.add_argument("--no-comments", dest="comments", help="don't output any comments", action="store_false")
    group4.add_argument("--no-tables", dest="tables", help="don't output any table elements", action="store_false")
    group4.add_argument(
        "--only-with-metadata",
        help="only output those documents with title, URL and date",
        action="store_true",
    )
    group4.add_argument("--with-metadata", help="extract and add metadata to the output", action="store_true")
    group4.add_argument("--target-language", help="select a target language (ISO 639-1 codes)", type=str)
    group4.add_argument("--deduplicate", help="filter out duplicate documents and sections", action="store_true")
    group4.add_argument("--config-file", help="override standard extraction parameters with a custom config file", type=str)
    group4.add_argument("--precision", help="favor extraction precision (less noise, possibly less text)", action="store_true")
    group4.add_argument("--recall", help="favor extraction recall (more text, possibly more noise)", action="store_true")

    # https://docs.python.org/3/library/argparse.html#argparse.ArgumentParser.add_mutually_exclusive_group
    group5_ex.add_argument("--output-format", help="determine output format", choices=SUPPORTED_FMT_CLI, default="txt")
    group5_ex.add_argument("--csv", help="shorthand for CSV output", action="store_true")
    group5_ex.add_argument("--html", help="shorthand for HTML output", action="store_true")
    group5_ex.add_argument("--json", help="shorthand for JSON output", action="store_true")
    group5_ex.add_argument("--markdown", help="shorthand for MD output", action="store_true")
    group5_ex.add_argument("--xml", help="shorthand for XML output", action="store_true")
    group5_ex.add_argument("--xmltei", help="shorthand for XML TEI output", action="store_true")
    group5.add_argument("--validate-tei", help="validate XML TEI output", action="store_true")

    parser.add_argument(
        "-v",
        "--verbose",
        action="count",
        default=0,
        help="increase logging verbosity (-v or -vv)",
    )
    parser.add_argument(
        "--version",
        help="show version information and exit",
        action="version",
        version=f"Trafilatura {version('trafilatura')} - Python {python_version()}",
    )

    return parser


def _validate_args(parser: argparse.ArgumentParser, args: argparse.Namespace) -> None:
    "Catch cross-group incompatibilities that argparse cannot express."
    if args.keep_dirs and not args.output_dir:
        parser.error("--keep-dirs requires an output directory (-o/--output-dir)")
    if args.list:
        ignored = sorted(o for o in _LIST_IGNORED_OPTS if getattr(args, o) != parser.get_default(o))
        if ignored:
            # emitted before logging is configured, so print directly
            print(f"--list only prints URLs; these options are ignored: {', '.join(ignored)}", file=sys.stderr)


def parse_args(args: list[str]) -> argparse.Namespace:
    """Define parser for command-line arguments"""
    parser = argparse.ArgumentParser(description="Command-line interface for Trafilatura")
    parser = add_args(parser)
```

### Core Architecture Module: `trafilatura/cli_utils.py`
```
"""
Functions dedicated to command-line processing.
"""

try:
    import gzip

    HAS_GZIP = True
except ImportError:
    HAS_GZIP = False

import argparse
import logging
import os
import random
import re
import string
import sys
import traceback
from base64 import urlsafe_b64encode
from collections.abc import Generator
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from datetime import datetime
from functools import partial
from pathlib import Path
from threading import RLock

from courlan import UrlStore, extract_domain, get_base_url  # validate_url

from trafilatura import spider

from .baseline import html2txt
from .core import extract
from .deduplication import generate_bow_hash
from .downloads import add_to_compressed_dict, buffered_downloads, buffered_response_downloads, load_download_buffer
from .feeds import find_feed_urls
from .meta import reset_caches
from .settings import (
    FILENAME_LEN,
    MAX_FILES_PER_DIRECTORY,
    Extractor,
    args_to_extractor,
)
from .sitemaps import sitemap_search
from .utils import (
    LANGID_FLAG,
    URL_BLACKLIST_REGEX,
    Response,
    is_acceptable_length,
    language_classifier,
    make_chunks,
)

LOGGER = logging.getLogger(__name__)

random.seed(345)  # make generated file names reproducible
CHAR_CLASS = string.ascii_letters + string.digits

STRIP_DIR = re.compile(r"[^/]+$")
STRIP_EXTENSION = re.compile(r"\.[a-z]{2,5}$")

CLEAN_XML = re.compile(r"<[^<]+?>")

INPUT_URLS_ARGS = ["URL", "crawl", "explore", "probe", "feed", "sitemap"]

EXTENSION_MAPPING = {
    "csv": ".csv",
    "json": ".json",
    "xml": ".xml",
    "xmltei": ".xml",
}


def load_input_urls(args: argparse.Namespace) -> list[str]:
    "Read list of URLs to process or derive one from command-line arguments."
    input_urls: list[str] = []

    if args.input_file:
        try:
            # optional: errors='strict', buffering=1
            with Path(args.input_file).open(encoding="utf-8") as inputfile:
                input_urls.extend(line.strip() for line in inputfile)
        except UnicodeDecodeError:
            sys.exit("ERROR: system, file type or buffer encoding")
    else:
        for arg in INPUT_URLS_ARGS:
            if getattr(args, arg):
                input_urls = [getattr(args, arg)]
                break

    if not input_urls:
        LOGGER.warning("No input provided")

    # uniq URLs while preserving order (important)
    return list(dict.fromkeys(input_urls))


def load_blacklist(filename: str) -> set[str]:
    "Read list of unwanted URLs."
    with Path(filename).open(encoding="utf-8") as inputfh:
        # if validate_url(url)[0] is True:
        return {URL_BLACKLIST_REGEX.sub("", line.strip()) for line in inputfh}


def load_input_dict(args: argparse.Namespace) -> UrlStore:
    "Read input list of URLs to process and build a domain-aware dictionary."
    inputlist = load_input_urls(args)
    # deduplicate, filter and convert to dict
    return add_to_compressed_dict(
        inputlist,
        blacklist=args.blacklist,
        compression=(args.sitemap and not args.list),
        url_filter=args.url_filter,
        verbose=args.verbose,
    )


def check_outputdir_status(directory: str) -> bool:
    "Check if the output directory is within reach and writable."
    # no is_dir precheck: unlike os.path.isdir, Path.is_dir raises on an unreadable parent
    try:
        Path(directory).mkdir(parents=True, exist_ok=True)
    except OSError:
        sys.stderr.write("ERROR: Destination directory cannot be created: " + directory + "\n")
        return False
    return True


def determine_counter_dir(dirname: str, c: int) -> str:
    "Return a destination directory based on a file counter."
    if c < 0:
        return dirname
    # os.path.join, not Path: pathlib rewrites the separators the caller passed in (test_sysoutput)
    return os.path.join(dirname, str(int(c / MAX_FILES_PER_DIRECTORY) + 1))


def get_writable_path(destdir: str, extension: str) -> tuple[str, str]:
    "Find a writable path and return it along with its random file name."
    while True:
        filename = "".join(random.choice(CHAR_CLASS) for _ in range(FILENAME_LEN))
        output_path = os.path.join(destdir, filename + extension)
        # not Path.exists: it raises on an unreadable parent, and the dir status is checked later
        if not os.path.exists(output_path):  # noqa: PTH110
            return output_path, filename


def generate_hash_filename(content: str) -> str:
    """Create a filename-safe string by hashing the given content
    after deleting potential XML tags."""
    return urlsafe_b64encode(generate_bow_hash(CLEAN_XML.sub("", content), 12)).decode()


def determine_output_path(
    args: argparse.Namespace,
    orig_filename: str,
    content: str,
    counter: int = -1,
    new_filename: str | None = None,
) -> tuple[str, str]:
    "Pick a directory based on selected options and a file name based on output type."
    # determine extension, TXT by default
    extension = EXTENSION_MAPPING.get(args.output_format, ".txt")

    if args.keep_dirs:
        # strip directory
        original_dir = STRIP_DIR.sub("", orig_filename)
        destination_dir = os.path.join(args.output_dir, original_dir)
        # strip extension
        filename = STRIP_EXTENSION.sub("", orig_filename)
    else:
        destination_dir = determine_counter_dir(args.output_dir, counter)
        # use cryptographic hash on file contents to define name
        filename = new_filename or generate_hash_filename(content)

    output_path = os.path.join(destination_dir, filename + extension)
    return output_path, destination_dir


def archive_html(htmlstring: str, args: argparse.Namespace, counter: int = -1) -> str:
    "Write a copy of raw HTML in backup directory."
    destination_directory = determine_counter_dir(args.backup_dir, counter)
    output_path, filename = get_writable_path(destination_directory, ".html.gz")
    # check the directory status
    if check_outputdir_status(destination_directory) is True and HAS_GZIP:
        # write
        with gzip.open(output_path, "wb") as outputfile:
            outputfile.write(htmlstring.encode("utf-8"))
    return filename


def write_result(
    result: str | None,
    args: argparse.Namespace,
    orig_filename: str = "",
    counter: int = -1,
    new_filename: str | None = None,
) -> None:
    """Deal with result (write to STDOUT or to file)"""
    if result is None:
        return
    if args.output_dir is None:
        sys.stdout.write(result + "\n")
    else:
        destination_path, destination_dir = determine_output_path(args, orig_filename, result, counter, new_filename)
        # check the directory status
        if check_outputdir_status(destination_dir) is True:
            with Path(destination_path).open(mode="w", encoding="utf-8") as outputfile:
                outputfile.write(result)


def generate_filelist(inputdir: str) -> Generator[str, None, None]:
    "Walk the directory tree and output all file names."
    # os.walk does not follow directory symlinks, unlike rglob on Python < 3.13
    for root, _, files in os.walk(inputdir):
        for filename in files:
            yield os.path.join(root, filename)


def file_processing(filename: str, args: argparse.Namespace, counter: int = -1, options: Extractor | None = None) -> None:
    "Aggregated functions to process a file in a list."
    if not options:
        options = args_to_extractor(args)
    options.source = filename

    with Path(filename).open("rb") as inputf:
        htmlstring = inputf.read()

    file_stat = Path(filename).stat()
    ref_timestamp = min(file_stat.st_ctime, file_stat.st_mtime)
    options.date_params["max_date"] = datetime.fromtimestamp(ref_timestamp).astimezone().strftime("%Y-%m-%d")

    result = examine(htmlstring, args, options=options)
    write_result(result, args, filename, counter, new_filename=None)


def process_result(htmlstring: str, args: argpars
```

### Core Architecture Module: `trafilatura/core.py`
```
# pylint:disable-msg=E0611,I1101
"""
Extraction configuration and processing functions.
"""

import json
import logging
import re
import warnings
from configparser import ConfigParser
from copy import copy
from typing import Any

from lxml.etree import Element, XPath, _Element, strip_tags
from lxml.html import HtmlElement

# own
from .baseline import baseline, html2txt
from .deduplication import LRUCache, content_fingerprint, duplicate_test
from .external import compare_extraction, justext_rescue
from .htmlprocessing import (
    build_html_output,
    convert_tags,
    prune_unwanted_nodes,
    tree_cleaning,
)
from .main_extractor import _elem_text, extract_comments, extract_content
from .metadata import Document, extract_metadata
from .settings import DEFAULT_CONFIG, Extractor, use_config
from .utils import (
    LANGID_FLAG,
    HtmlInput,
    check_html_lang,
    language_filter,
    load_html,
    normalize_unicode,
)
from .xml import build_json_output, control_xml_output, delete_element, keeps_empty, xmltocsv, xmltotxt
from .xpaths import REMOVE_APPENDED_ARTICLES_XPATH, REMOVE_COMMENTS_XPATH, REMOVE_SHARE_WIDGETS_XPATH

LOGGER = logging.getLogger(__name__)

# recall escalation (see trafilatura_sequence, stage 4): retry a short balanced extraction
# in recall mode. Calibrated as a set against the benchmark suite (own-bench/WMB/WCXB/AEB) —
# don't tune one value in isolation, and re-run the full suite after any change.
ESCALATION_MAX_LENGTH = 3000  # only consider extractions below this size
ESCALATION_PAGE_SHARE = 0.2  # ... covering less than this share of the page text
ESCALATION_ACCEPT_RATIO = 1.5  # accept the retry if it is this much longer
# justext tends to over-include (whole pricing tables, unrelated sections) rather than stop at
# page boundaries the way the rule-based retry does, so it needs a stricter bar than the
# retry's own 1.5x: swept 1.5-10x, 2.0x is the best balance across the full suite.
ESCALATION_JUSTEXT_RATIO = 2.0

TXT_FORMATS = {"markdown", "txt"}
_YAML_FIELDS = "title author url hostname description sitename date categories tags fingerprint id license".split()

# Metadata is emitted as a YAML-style Markdown header; values such as a title
# containing ": " (or a leading indicator, or a reserved word) otherwise produce
# invalid YAML or get reinterpreted as a non-string. See GH #814.
_YAML_RESERVED = frozenset({"true", "false", "yes", "no", "on", "off", "y", "n", "null", "none", "~"})


def _yaml_scalar(value: str) -> str:
    "Render a metadata string as a plain or double-quoted YAML-safe scalar."
    if (
        value
        and value == value.strip()
        and value[0].isalpha()
        and ": " not in value
        and " #" not in value
        and not value.endswith(":")
        and value.lower() not in _YAML_RESERVED
        and all(ch >= " " and ch != "\x7f" for ch in value)
    ):
        return value
    # a JSON string is always a valid, exactly round-tripping YAML double-quoted scalar
    return json.dumps(value, ensure_ascii=False)


def determine_returnstring(document: Document, options: Extractor) -> str:
    """Convert XML tree to chosen format, clean the result and output it as a string"""
    # XML (TEI) steps
    if "xml" in options.format:
        # last cleaning
        for element in document.body.iter("*"):
            if len(element) == 0 and not element.text and not element.tail and not keeps_empty(element):
                delete_element(element, keep_tail=False)
        # build output tree
        returnstring = control_xml_output(document, options)
    # CSV
    elif options.format == "csv":
        returnstring = xmltocsv(document, options.formatting)
    # JSON
    elif options.format == "json":
        returnstring = build_json_output(document, options.with_metadata)
    # HTML
    elif options.format == "html":
        returnstring = build_html_output(document, options.with_metadata)
    # Markdown and TXT
    else:
        header = ""
        if options.with_metadata:
            # categories/tags are lists, their repr is a valid flow sequence
            fields = "".join(
                f"{attr}: {_yaml_scalar(value) if isinstance(value, str) else value}\n"
                for attr in _YAML_FIELDS
                if (value := getattr(document, attr))
            )
            header = f"---\n{fields}---\n"
        returnstring = f"{header}{xmltotxt(document.body, options.formatting)}"
        if document.commentsbody is not None:
            returnstring = f"{returnstring}\n{xmltotxt(document.commentsbody, options.formatting)}".strip()
    # normalize Unicode format (defaults to NFC)
    return normalize_unicode(returnstring)


# matches "@type": "DiscussionForumPosting" or an @type array containing it, anchored to the
# key so it can't fire on the words appearing in ordinary prose (e.g. a description field)
_DISCUSSION_FORUM_POSTING_RE = re.compile(
    r'"@type"\s*:\s*"DiscussionForumPosting"|"@type"\s*:\s*\[[^\]]*"DiscussionForumPosting"'
)


def _forum_thread_page(tree: HtmlElement) -> bool:
    """Detect a thread-forum page where posts live in the same containers
    REMOVE_COMMENTS_XPATH would otherwise prune -- comments are content here, unlike on
    a blog or article. Seeded by schema.org DiscussionForumPosting alone. Q&A forums
    (StackExchange, schema.org QAPage) are deliberately not matched: their answers live
    outside comment containers. Misses forums that don't emit DiscussionForumPosting
    (e.g. old Reddit) -- an accepted gap. Meant as a reusable seed for a future page-type
    router, not a one-off check.
    """
    return any(
        script.text and _DISCUSSION_FORUM_POSTING_RE.search(script.text)
        for script in tree.iterfind('.//script[@type="application/ld+json"]')
    )


def _prepare_tree(tree: HtmlElement, options: Extractor, url: str | None) -> tuple[HtmlElement, HtmlElement]:
    "Clean and convert a raw tree, returning (converted, pre-conversion backup)."
    cleaned = tree_cleaning(copy(tree), options)
    backup = copy(cleaned)
    cleaned = convert_tags(cleaned, options, url)
    return cleaned, backup


def _extract_and_compare(
    cleaned_tree: HtmlElement, cleaned_tree_backup: HtmlElement, tree: HtmlElement, options: Extractor
) -> tuple[_Element, str]:
    "Cascade stages 1-2: main extractor, then the external comparison unless in fast mode."
    postbody, temp_text = extract_content(cleaned_tree, options)
    if not options.fast:
        postbody, temp_text = compare_extraction(cleaned_tree_backup, copy(tree), postbody, temp_text, options)
    return postbody, temp_text


def _recall_retry(esc_tree: HtmlElement, r_options: Extractor, url: str | None) -> tuple[_Element, str]:
    """Stage-4 retry: re-run cascade stages 1-2 in recall mode on the escalation input
    (arrives comment-pruned, or intact on a thread-forum where posts are content).
    Deliberately no comment capture, no baseline (it already ran on the full page; on a
    comment-pruned tree it only yields an indistinguishable boilerplate dump), no escalation."""
    return _extract_and_compare(*_prepare_tree(esc_tree, r_options, url), esc_tree, r_options)


def trafilatura_sequence(
    tree: HtmlElement,
    options: Extractor,
    url: str | None = None,
) -> tuple[_Element, str, _Element, str]:
    """Prepare the raw tree (cleaning, tag conversion, comment handling), then execute the
    standard cascade of extractors used by Trafilatura, each stage only engaging if the
    previous one under-delivered:
    1. main extractor (includes wild-text recovery for short documents)
    2. comparison with external extractors (readability/justext), skipped in fast mode
    3. baseline rescue on the original, uncleaned tree
    4. recall escalation, if the result still covers little of the page: stages 1-2 re-run
       in recall mode (_recall_retry), plus a justext candidate tried alongside (a different
       algorithm, not just stricter rules, so it reaches content the rule-ba
```

### Core Architecture Module: `trafilatura/deduplication.py`
```
"Code parts dedicated to duplicate removal and text similarity."

import re
import string
import unicodedata
from collections import OrderedDict
from difflib import SequenceMatcher
from functools import cache, lru_cache
from hashlib import blake2b
from operator import add
from threading import RLock
from typing import Any

from lxml.etree import _Element

from .settings import LRU_SIZE, Extractor
from .utils import trim

STRIP_EXTENSION = re.compile(r"\.[^/?#]{2,63}$")


@cache
def _punct_tbl() -> dict[int, str]:
    "Punctuation translation table, built lazily: scans all of Unicode (~90ms)."
    return str.maketrans({i: " " for i in range(0x10FFFF) if unicodedata.category(chr(i))[0] == "P"})


@lru_cache(maxsize=1024)
def is_similar_domain(reference: str, new_string: str, threshold: float = 0.5) -> bool:
    "Return the similarity ratio between two short strings, here domain names."
    reference = STRIP_EXTENSION.sub("", reference)
    new_string = STRIP_EXTENSION.sub("", new_string)
    return SequenceMatcher(None, reference, new_string).ratio() >= threshold


def sample_tokens(inputstring: str, length: int = 64) -> list[str]:
    """Split input into list of tokens and adjust length threshold to make sure
    there is enough data."""
    tokens = [t for token in inputstring.split() if (t := token.strip(string.punctuation)).isalnum()]
    if not tokens:
        # non-latin punctuation, e.g. mandarin 。
        tokens = [t for t in inputstring.translate(_punct_tbl()).split() if t.isalnum()]

    # tokens are non-empty, so a threshold of 0 would keep them all
    for i in range(4, 0, -1):
        sample = [t for t in tokens if len(t) > i]
        if len(sample) >= length / 2:
            return sample
    return tokens


def generate_bow_hash(inputstring: str, length: int = 24) -> bytes:
    "Create a bag of words and generate a hash for a given string."
    teststring = " ".join(sample_tokens(inputstring))
    return blake2b(teststring.encode(), digest_size=length).digest()


@lru_cache(maxsize=2**14)
def _vector_to_add(token: str, length: int) -> list[int]:
    "Token's contribution to a Simhash vector, cached across all instances."
    token_hash = int.from_bytes(blake2b(token.encode(), digest_size=8).digest(), "big")
    return [1 if token_hash & (1 << i) else -1 for i in range(length)]


class Simhash:
    "Implement a basic Charikar hashing approach of string similarity."

    __slots__ = ("hash", "length")

    def __init__(
        self,
        inputstring: str = "",
        length: int = 64,
        existing_hash: int | str | None = None,
    ) -> None:
        "Store length and existing or new hash."
        self.length = length
        self.hash = self.validate(existing_hash) or self.create_hash(inputstring)

    def create_hash(self, inputstring: str) -> int:
        """Calculates a Charikar simhash. References used:
        https://github.com/vilda/shash/
        https://github.com/sean-public/python-hashes/blob/master/hashes/simhash.py
        Optimized for Python by @adbar.
        """
        vector = [0] * self.length

        for token in sample_tokens(inputstring, self.length):
            vector = list(map(add, vector, _vector_to_add(token, self.length)))

        return sum(1 << i for i in range(self.length) if vector[i] >= 0)

    def to_hex(self) -> str:
        "Convert the numerical hash to a hexadecimal string."
        return f"{self.hash:x}"

    def validate(self, inputhash: int | str | None) -> int | None:
        "Validate the input hash and return it, or None otherwise."
        if isinstance(inputhash, str):
            # historical decimal representation, now hex via to_hex()
            if inputhash.isdecimal() and 18 <= len(inputhash) <= 22:
                inputhash = int(inputhash)
            else:
                try:
                    inputhash = int(inputhash, 16)
                except ValueError:
                    return None
        if type(inputhash) is int and 0 <= inputhash < (1 << self.length):
            return inputhash
        return None

    def similarity(self, other_hash: "Simhash") -> float:
        "Similarity to another simhash based on the Hamming distance, from 0.0 to 1.0."
        return (self.length - (self.hash ^ other_hash.hash).bit_count()) / self.length


def content_fingerprint(content: str) -> str:
    "Calculate a simhash hex value for meaningful bits of the content."
    return Simhash(content).to_hex()


class LRUCache:
    "Least Recently Used (LRU) cache backed by an OrderedDict."

    def __init__(self, maxsize: int = 128) -> None:
        if maxsize < 1:
            raise ValueError("maxsize must be at least 1")
        self.lock = RLock()
        self.maxsize = maxsize
        self.cache: OrderedDict[str, int] = OrderedDict()

    def __getstate__(self) -> dict[str, Any]:
        # RLock is not picklable, the cache is copied to avoid sharing it
        with self.lock:
            state = self.__dict__.copy()
            state["cache"] = self.cache.copy()
        del state["lock"]
        return state

    def __setstate__(self, state: dict[str, Any]) -> None:
        self.__dict__.update(state)
        self.lock = RLock()

    def __bool__(self) -> bool:
        "Always true, even when empty: instances passed as dedup option enable deduplication."
        return True

    def get(self, key: str) -> int:
        "Retrieve a value from the cache, or -1 if the key is absent."
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key)
                return self.cache[key]
        return -1

    def put(self, key: str, value: int) -> None:
        "Store a given key in the cache, evicting the oldest entry if full."
        with self.lock:
            self.cache[key] = value
            self.cache.move_to_end(key)
            if len(self.cache) > self.maxsize:
                self.cache.popitem(last=False)

    def increment(self, key: str) -> int:
        "Increment the stored count, return the previous count or -1."
        with self.lock:
            previous = self.cache.pop(key, -1)
            self.put(key, max(previous, 0) + 1)
            return previous

    def clear(self) -> None:
        "Delete all cache content."
        with self.lock:
            self.cache.clear()


LRU_TEST = LRUCache(maxsize=LRU_SIZE)


def duplicate_test(element: _Element, options: Extractor) -> bool:
    "Check for duplicate text with LRU cache."
    teststring = trim(" ".join(element.itertext()))
    lru = options.dedup if isinstance(options.dedup, LRUCache) else LRU_TEST
    previous = lru.increment(teststring)
    return len(teststring) > options.min_duplcheck_size and previous > options.max_repetitions

```

### Core Architecture Module: `trafilatura/downloads.py`
```
# pylint:disable-msg=E0611,I1101
"""
All functions needed to steer and execute downloads of web documents.
"""

import ipaddress
import logging
import os
import random
import socket
from collections.abc import Callable, Generator
from concurrent.futures import ThreadPoolExecutor, as_completed
from configparser import ConfigParser
from functools import partial
from importlib.metadata import version
from io import BytesIO
from time import sleep
from typing import Any
from urllib.parse import urljoin

import certifi
import urllib3
from courlan import UrlStore

from .settings import DEFAULT_CONFIG, Extractor
from .utils import (
    URL_BLACKLIST_REGEX,
    Response,
    _capped,
    is_acceptable_length,
    make_chunks,
)

try:
    from urllib3.contrib.socks import SOCKSProxyManager

    PROXY_URL = os.environ.get("http_proxy")
except ImportError:
    PROXY_URL = None

try:
    import pycurl

    CURL_SHARE = pycurl.CurlShare()
    # available options:
    # https://curl.se/libcurl/c/curl_share_setopt.html
    CURL_SHARE.setopt(pycurl.SH_SHARE, pycurl.LOCK_DATA_DNS)
    CURL_SHARE.setopt(pycurl.SH_SHARE, pycurl.LOCK_DATA_SSL_SESSION)
    # not thread-safe
    # CURL_SHARE.setopt(pycurl.SH_SHARE, pycurl.LOCK_DATA_CONNECT)
    HAS_PYCURL = True
except ImportError:
    HAS_PYCURL = False


LOGGER = logging.getLogger(__name__)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
HTTP_POOL = None
NO_CERT_POOL = None


def create_pool(ssrf_protection: bool = True, **args: Any) -> urllib3.PoolManager | Any:
    "Configure urllib3 download pool according to user-defined settings."
    if PROXY_URL:
        return SOCKSProxyManager(proxy_url=PROXY_URL, num_pools=50, **args)
    manager_class = _SafePoolManager if ssrf_protection else urllib3.PoolManager
    return manager_class(num_pools=50, **args)


# proxies libcurl reads from the environment on its own
CURL_PROXY_VARS = ("http_proxy", "https_proxy", "HTTPS_PROXY", "all_proxy", "ALL_PROXY")


def _apply_curl_network(curl: "pycurl.Curl", config: ConfigParser) -> None:
    "Restrict the pycurl handle to HTTP(S), apply PROXY_URL and the SSRF hook."
    # also applies to redirects
    curl.setopt(pycurl.PROTOCOLS, pycurl.PROTO_HTTP | pycurl.PROTO_HTTPS)
    if PROXY_URL:
        curl.setopt(pycurl.PRE_PROXY, PROXY_URL)
    # the hook would vet the proxy address instead of the target
    if _ssrf_active(config) and not any(os.environ.get(var) for var in CURL_PROXY_VARS):
        curl.setopt(pycurl.OPENSOCKETFUNCTION, _ssrf_opensocket)


# advertises exactly the encodings urllib3 can decode
DEFAULT_HEADERS = urllib3.util.make_headers(accept_encoding=True)
USER_AGENT = "trafilatura/" + version("trafilatura") + " (+https://github.com/adbar/trafilatura)"
DEFAULT_HEADERS["User-Agent"] = USER_AGENT

# includes unofficial codes: https://en.wikipedia.org/wiki/List_of_HTTP_status_codes#Unofficial_codes
FORCE_STATUS = frozenset({429, 499, 500, 502, 503, 504, 509, 520, 521, 522, 523, 524, 525, 526, 527, 530, 598})

CURL_SSL_ERRORS = {35, 54, 58, 59, 60, 64, 66, 77, 82, 83, 91}

# cap in seconds for backoff and Retry-After sleeps
MAX_BACKOFF = 30

# status retries, kept apart from the redirect budget libcurl spends on MAXREDIRS
MAX_STATUS_RETRIES = 2


class _SSLRetryError(Exception):
    "Internal signal: the secure transfer failed for SSL reasons, retry without verification."


def _normalize_ip(addr: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    "Parse an IP string, mapping IPv4-mapped IPv6 to plain IPv4."
    ip = ipaddress.ip_address(addr)
    return getattr(ip, "ipv4_mapped", None) or ip


def _ssrf_active(config: ConfigParser) -> bool:
    "SSRF filtering applies only to direct connections: with a proxy, the vetted address would be the proxy's."
    return not PROXY_URL and config.getboolean("DEFAULT", "SSRF_PROTECTION", fallback=True)


def _vet_peer(host: str) -> None:
    "Raise on a non-global peer address."
    if not _normalize_ip(host).is_global:
        raise OSError(f"SSRF protection: connection to non-public address blocked: {host}")


def _ssrf_opensocket(_purpose: int, address: Any) -> socket.socket | int:
    "pycurl OPENSOCKETFUNCTION that rejects non-global resolved IPs."
    try:
        _vet_peer(address.addr[0])
    except OSError as err:
        # pycurl only prints exceptions raised here
        LOGGER.warning("%s", err)
        return int(pycurl.SOCKET_BAD)
    return socket.socket(address.family, address.socktype, address.protocol)


class _SafeHTTPConnection(urllib3.connection.HTTPConnection):
    "Connection rejecting non-global peers, vetted post-connect so DNS rebinding cannot bypass it."

    def _new_conn(self) -> socket.socket:
        sock = super()._new_conn()
        try:
            _vet_peer(sock.getpeername()[0].split("%", 1)[0])  # strip IPv6 zone id
        except OSError as err:
            sock.close()
            # a connect error: aborts immediately under Retry(connect=0)
            raise urllib3.exceptions.NewConnectionError(self, str(err)) from err
        return sock


class _SafeHTTPSConnection(_SafeHTTPConnection, urllib3.connection.HTTPSConnection):
    pass


class _SafeHTTPConnectionPool(urllib3.HTTPConnectionPool):
    ConnectionCls = _SafeHTTPConnection


class _SafeHTTPSConnectionPool(urllib3.HTTPSConnectionPool):
    ConnectionCls = _SafeHTTPSConnection


class _SafePoolManager(urllib3.PoolManager):
    "PoolManager whose connections reject non-global IP addresses on every hop."

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.pool_classes_by_scheme = {"http": _SafeHTTPConnectionPool, "https": _SafeHTTPSConnectionPool}


def _determine_headers(config: ConfigParser) -> dict[str, str]:
    "Overlay user-agent and cookie from the config file on the default headers."
    headers = dict(DEFAULT_HEADERS)
    # rotate over a series of user-agents
    if myagents := config.get("DEFAULT", "USER_AGENTS", fallback="").strip():
        headers["User-Agent"] = random.choice(myagents.splitlines())
    # https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
    # todo: support for several cookies?
    if mycookie := config.get("DEFAULT", "COOKIE", fallback=None):
        headers["Cookie"] = mycookie
    return headers


def _get_retry_strategy(config: ConfigParser) -> urllib3.util.Retry:
    "Define a retry strategy according to the config file."
    max_redirects = config.getint("DEFAULT", "MAX_REDIRECTS")
    return urllib3.util.Retry(
        total=max_redirects,
        redirect=max_redirects,  # raise_on_redirect=False,
        connect=0,
        backoff_factor=config.getint("DEFAULT", "DOWNLOAD_TIMEOUT") / 2,
        backoff_max=MAX_BACKOFF,
        retry_after_max=MAX_BACKOFF,
        status_forcelist=FORCE_STATUS,
    )


def _initiate_pool(config: ConfigParser, no_ssl: bool = False) -> urllib3.PoolManager | Any:
    "Create a urllib3 pool manager according to options in the config file and HTTPS setting."
    global HTTP_POOL, NO_CERT_POOL
    ssrf_protection = _ssrf_active(config)
    pool = NO_CERT_POOL if no_ssl else HTTP_POOL

    # never latch the SSRF setting
    if pool is None or isinstance(pool, _SafePoolManager) != ssrf_protection:
        pool = create_pool(
            ssrf_protection=ssrf_protection,
            ca_certs=None if no_ssl else certifi.where(),
            cert_reqs="CERT_NONE" if no_ssl else "CERT_REQUIRED",
        )
        if no_ssl:
            NO_CERT_POOL = pool
        else:
            HTTP_POOL = pool

    return pool


def _send_urllib_request(url: str, no_ssl: bool, config: ConfigParser) -> Response | None:
    "Internal function to robustly send a request (SSL or not) and return its result."
    try:
        pool_manager = _initiate_pool(config, no_ssl=no_ssl)

        # execute request, stop downloading as soon as MAX_FILE_SIZE is reached
        response = pool_manager.request(
            "GET",
            url,
            header
```

### Core Architecture Module: `trafilatura/external.py`
```
# pylint:disable-msg=E0611,I1101
"""
Functions grounding on third-party software.
"""

import logging

# third-party
from justext.core import ParagraphMaker, classify_paragraphs, revise_paragraph_classification
from justext.utils import get_stoplist, get_stoplists
from lxml.etree import Element, SubElement, _Element, strip_tags, tostring
from lxml.html import HtmlElement

# own
from .baseline import basic_cleaning
from .htmlprocessing import convert_tags, prune_unwanted_nodes, tree_cleaning
from .main_extractor import handle_image
from .readability_lxml import Document as ReadabilityDocument  # fork
from .settings import JUSTEXT_LANGUAGES, Extractor
from .utils import fromstring_bytes, trim
from .xml import TEI_VALID_TAGS, delete_element
from .xpaths import OVERALL_DISCARD_XPATH

LOGGER = logging.getLogger(__name__)

JT_STOPLIST = None

SANITIZED_XPATH = ".//aside|.//audio|.//button|.//fencedframe|.//fieldset|.//figure|.//footer|.//iframe|.//input|.//label|.//link|.//nav|.//noindex|.//noscript|.//object|.//option|.//select|.//source|.//svg|.//time"

# adopt justext only when the text it replaces is at most this much longer (swept 2-4: every
# (3, 4]-band page was justext wrongly replacing a longer, closer-to-target extraction)
JUSTEXT_OVERRIDE_RATIO = 3


def try_readability(htmlinput: HtmlElement) -> HtmlElement:
    """Safety net: try with the generic algorithm readability"""
    try:
        doc = ReadabilityDocument(htmlinput, min_text_length=25)
        # force conversion to utf-8 (see #319)
        summary = fromstring_bytes(doc.summary())
        return summary if summary is not None else HtmlElement()
    except Exception as err:
        LOGGER.warning("readability_lxml failed: %s", err)
        return HtmlElement()


def _prefer_readability(
    body: _Element,
    algo_body: HtmlElement,
    algo_text: str,
    len_text: int,
    len_algo: int,
    options: Extractor,
) -> bool:
    """Decide whether the readability output should replace the own extraction."""
    # readability empty, or same length as the own extraction (assumed same content)
    if len_algo in (0, len_text):
        return False
    # own extraction much longer
    if len_text > 2 * len_algo:
        return False
    return (
        # own text empty
        len_text == 0
        # readability much longer, unless it grabbed raw JSON (#632)
        or (len_algo > 2 * len_text and not algo_text.startswith("{"))
        # own extraction structurally deficient: no paragraph text or table-dominated
        or (
            len_algo > options.min_extracted_size * 2
            and (not body.xpath(".//p//text()") or len(body.findall(".//table")) > len(body.findall(".//p")))
        )
        # recall mode: readability output substantially longer
        or (options.focus == "recall" and len_algo > 1.5 * len_text and not algo_text.startswith("{"))
        # recall mode: readability recovers a headed article (#354)
        or (
            options.focus == "recall"
            and not body.xpath(".//head")
            and next(algo_body.iter("h2", "h3", "h4"), None) is not None
            and len_algo > len_text
        )
    )


def compare_extraction(
    cleaned_tree: HtmlElement,
    raw_tree: HtmlElement,
    body: _Element,
    text: str,
    options: Extractor,
) -> tuple[_Element, str]:
    """Decide whether to choose own or external extraction based on a series of heuristics.
    ``raw_tree`` (uncleaned) feeds readability; ``cleaned_tree`` (tree_cleaning'd, unconverted)
    feeds justext."""
    len_text = len(text)
    # bypass for recall
    if options.focus == "recall" and len_text > options.min_extracted_size * 10:
        return body, text

    # prior cleaning
    if options.focus == "precision":
        raw_tree = prune_unwanted_nodes(raw_tree, OVERALL_DISCARD_XPATH)

    # try with readability
    temppost_algo = try_readability(raw_tree)
    # unicode fix necessary on certain systems (#331)
    algo_text = trim(tostring(temppost_algo, method="text", encoding="utf-8").decode("utf-8"))
    len_algo = len(algo_text)
    LOGGER.debug("extracted length: %s (algorithm) %s (extraction)", len_algo, len_text)

    use_readability = _prefer_readability(body, temppost_algo, algo_text, len_text, len_algo, options)
    if use_readability:
        body, text, len_text = temppost_algo, algo_text, len_algo
    LOGGER.debug("using %s extraction: %s", "generic" if use_readability else "custom", options.source)

    # override faulty extraction: try with justext
    unclean = bool(body.xpath(SANITIZED_XPATH))
    if unclean or len_text < options.min_extracted_size:
        LOGGER.debug("unclean or short document triggering justext examination: %s", options.source)
        body2, text2 = justext_rescue(cleaned_tree, options)
        len_text2 = len(text2)
        # unclean: allow shorter (boilerplate dropped), guard image-heavy pages;
        # merely short: must add text, len_text2 > len_text is implied (#896)
        if unclean:
            accept = len_text <= JUSTEXT_OVERRIDE_RATIO * len_text2 and (
                len_text2 > len_text or not options.images or body.find(".//graphic") is None
            )
        else:
            accept = len_text < len_text2
        if text2 and accept:
            LOGGER.debug("using justext, length: %s", len_text2)
            body, text, len_text = body2, text2, len_text2
            use_readability = False

    # post-processing: remove unwanted sections
    if use_readability:
        body, text = sanitize_tree(body, options)  # type: ignore[arg-type]

    return body, text


def jt_stoplist_init() -> tuple[str]:
    "Retrieve and return the content of all JusText stoplists"
    global JT_STOPLIST
    JT_STOPLIST = tuple({word for language in get_stoplists() for word in get_stoplist(language)})
    return JT_STOPLIST


def try_justext(tree: HtmlElement, url: str | None, target_language: str | None) -> _Element:
    """Second safety net: try with the generic algorithm justext"""
    # init
    result_body = Element("body")
    # determine language
    if target_language in JUSTEXT_LANGUAGES:
        justext_stoplist = get_stoplist(JUSTEXT_LANGUAGES[target_language])
    else:
        justext_stoplist = JT_STOPLIST or jt_stoplist_init()
    # extract
    try:
        paragraphs = ParagraphMaker.make_paragraphs(tree)
        classify_paragraphs(paragraphs, justext_stoplist, 50, 150, 0.1, 0.2, 0.25, True)
        revise_paragraph_classification(paragraphs, 150)
    except Exception as err:
        LOGGER.error("justext %s %s", err, url)
    else:
        for paragraph in paragraphs:
            if not paragraph.is_boilerplate:
                SubElement(result_body, "p").text = paragraph.text
    return result_body


def justext_rescue(tree: HtmlElement, options: Extractor) -> tuple[_Element, str]:
    """Try to use justext algorithm as a second fallback"""
    temppost_algo = try_justext(basic_cleaning(tree), options.url, options.lang)
    return temppost_algo, trim(" ".join(temppost_algo.itertext()))


def sanitize_tree(tree: HtmlElement, options: Extractor) -> tuple[HtmlElement, str]:
    """Convert and sanitize the output from the generic algorithm (post-processing)"""
    # 1. clean
    cleaned_tree = tree_cleaning(tree, options)
    strip_tags(cleaned_tree, "span", *(() if options.links else ("a",)))
    # 2. convert (pass url so relative links are absolutized on the fallback path)
    cleaned_tree = convert_tags(cleaned_tree, options, options.url)
    for elem in list(cleaned_tree.iter("graphic")):
        image = handle_image(elem, options)
        if image is None:
            delete_element(elem)
        else:
            elem.attrib.clear()
            elem.attrib.update(image.attrib)
    # Mark first <th>-containing row per parent group as head (mirrors handle_table logic).
    # Groups by direct parent (the enclosing table once tbody/thead/tfoot are stripped upstream);
    # nested tables form their own group.
    seen_group_e
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #914** (2026-08-28): **Markdown output: literal CommonMark syntax characters in extracted text are misrendered (asterisks, brackets, headings, etc.)**
  *Symptoms*: ## Summary  `xmltotxt()` (markdown mode, `include_formatting=True`) emits CommonMark-meaningful characters — `*`, `_`, `` ` ``, `~`, `[`, `]`, `<` — verbatim whenever they occur in extracted prose, instead of escaping them. Any renderer consuming trafilatura's markdown output misinterprets these as emphasis, code spans, link/image brackets, or raw HTML/autolinks instead of literal characters from the source page.  Separately, a paragraph, list item, or blockquote whose text happens to *start* with `#`, `>`, `-`, `+`, or a digit run followed by `.`/`)` is misread as a heading, blockquote, or list marker, because nothing distinguishes "real" block syntax (added by trafilatura itself) from a line that merely starts with the same character by coincidence.  This affects any consumer that renders trafilatura's `markdown` output format through a CommonMark parser (docs pipelines, chat/RAG ingestion, static site generators, etc.).  ## Example failures  **1. Inline asterisks read as emphasis** Source HTML: `This *should* not be italic and 3*4=12` Markdown emitted: `This *should* not be italic and 3*4=12` Rendered HTML: "This <em>should</em> not be italic and 3<em>4=12"</em> — the literal asterisks from the source page are silently turned into italics and an unclosed emphasis run.  **2. Leading character read as block syntax** Source HTML: `# not a heading` (e.g. a tweet or comment quoting a hashtag-like string) Markdown emitted: `# not a heading` Rendered HTML: `<h1>not a heading</h1>
  **Post-Mortem & Fix Analysis**:
  > This is a really good report — and the two halves are genuinely different bugs needing different fixes, so splitting them like this is the right instinct.  **The design property that makes both tractable:** trafilatura generates its own block/inline markup from the XML tree (`<head>`, `<list>`, `<hi rend="...">`), while the offending characters always arrive in *text nodes*. So you can escape at text-node serialization time without ever touching trafilatura's own generated markup — a post-processing pass over the markdown string can't make that distinction reliably, but the walker can.  **1. Inline escapes.** CommonMark's backslash-escape rule is "ASCII punctuation", so the escape set is well-defined: `\* \_ \` \[ \] \< \> \# \+ \- \. \! \| \~`. Apply it to text-node content except inside code spans (where literal chars are safe and escaping would corrupt them — so `<code>`/`<hi rend="code">` children should pass through untouched). One subtlety: escape the whole run of meaningful char

- **Issue #912** (2026-09-11): **zstd responses without a declared content size are silently returned undecompressed**
  *Symptoms*: ### Summary  When `zstandard` is importable, trafilatura advertises `zstd` in `Accept-Encoding`. If the server then returns a zstd frame **without a declared content size** — which is what streaming/dynamic origins produce — `fetch_url()` returns the still-compressed bytes, lossily decoded to a `str`. `extract()` and `extract_metadata()` then return `None`, with no error raised and nothing logged above `WARNING`.  The failure is silent: you get a plausible-looking non-empty `str` back, so a caller has no signal that anything went wrong short of noticing the extraction is empty.  ### Environment  - trafilatura 2.2.0 (relevant code identical on current `master`) - Python 3.14.7, Linux x86_64 - zstandard 0.25.0, urllib3 2.7.0, pycurl 7.45.7 / libcurl 8.18.0  ### Reproduction  ```python import trafilatura  dl = trafilatura.fetch_url("https://interconnected.org/home/2023/03/16/singularity") print(dl.encode("utf-8", "surrogateescape")[:4])  # b'(\xb5/\xfd'  -> zstd magic print(trafilatura.extract(dl))                    # None ```  Reproduces identically on `https://simonwillison.net/`, `https://waxy.org/` and `https://kottke.org/`. On all four, `zstandard.get_frame_parameters(body).content_size` is `CONTENTSIZE_UNKNOWN`.  Expected: the decompressed HTML, and article text from `extract()`. Fetching the same URL with `urllib.request` + `Accept-Encoding: gzip` and decompressing explicitly yields 11,152 characters of correctly extracted text, so neither the page nor the extractor is a
  **Post-Mortem & Fix Analysis**:
  > (the issue was submitted by AI on my behalf)

- **Issue #910** (2026-09-25): **Security: request to open a private disclosure channel**
  *Symptoms*: Hi — I'm a security researcher (mohammad adnan, CyStack red team). I've identified what I believe is an SSRF issue in trafilatura (affecting the current release, in the URL-fetch path) and would like to report it privately and responsibly.  I couldn't find a private channel: this repo's GitHub **Private Vulnerability Reporting** appears to be disabled (Security → Advisories → *Report a vulnerability* returns 404) and I didn't find a SECURITY.md contact. Could you either:  1. Enable Private Vulnerability Reporting (Settings → Security → *Private vulnerability reporting*), or 2. Share a security email / preferred private channel?  I have a runtime-verified proof-of-concept and a suggested fix ready to share privately. I'm deliberately not posting details here to avoid public exposure before a fix. Thank you!
  **Post-Mortem & Fix Analysis**:
  > Hi @mohammedix88, I enabled private reporting
  > Thanks @adbar, submitted it through Private Vulnerability Reporting just now (you'll see it under Security > Advisories). It's the fetch_url SSRF: it follows redirects to loopback/link-local with no internal-IP filtering. Full details and a suggested fix are in the advisory. Happy to discuss there.
  > Partially addressed by #921 

- **Issue #900** (2026-08-14): **2.1.0 -> 2.2.0 regression: extraction stops at first sibling content block under <article>**
  *Symptoms*: ## Describe the bug  On a page whose real content lives entirely inside a single `<article>`, but as a flat sequence of independent sibling `<div>` blocks (no shared class, no wrapping `<section>` — the shape Squarespace's page builder produces), extraction stops after the *first* sibling block in 2.2.0. 2.1.0, given byte-identical input and identical `extract()` options, continues through the rest.  This looks like the same failure class as #85, fixed by #163 in 2022 ("on finding a subtree whose first node is valid, [walk] all of the remaining nodes in that subtree, not just [stop at] the first child") — possibly reintroduced by a later refactor.  ## To Reproduce  Real-world page: https://www.fmck.se/mc-258 (captured 2026-08-09, Swedish motorcycle-club maintenance notice + manual/parts-catalog links). Reduced to a self-contained, valid HTML5 document below (scripts/styles/tracking attributes stripped; doctype and charset added back; verified the reduction preserves the exact same divergence as the original 264 KB capture).  Relevant structure:  ```html <article>   <div><p>...admin notice, ends with "renovering."</p></div>   <!-- first sibling block -->   <div><h4>Instruktionsbok MC 258</h4></div>                    <!-- later sibling blocks -->   <div><h4>Verkstadshandbok MC 258</h4></div>   <div><ul>...download links...</ul></div> </article> ```  Test case (pytest):  ```python import os import trafilatura  FIXTURE = os.path.join(os.path.dirname(__file__), "fmck-mc258-stripp

- **Issue #896** (2026-08-28): **Short documents (< MIN_EXTRACTED_SIZE) lose all Markdown structure in 2.2.0: baseline rescue replaces a valid formatted extraction with fused text_content**
  *Symptoms*: ## Describe the bug  Since 2.2.0, extracting a short but perfectly valid static page with `output_format="markdown"` and `include_formatting=True` returns a single unformatted blob: heading markers and paragraph breaks are gone, and the heading text is fused with the body text **without any separator** ("Notice TitleThis municipal notice…"). The same input on 2.1.0 kept the Markdown structure.  ## To Reproduce  ```python import trafilatura  body = ("This municipal notice is short but perfectly valid static content "         "that a reader would expect to keep its structure. ") * 2 html = (     "<html><head><title>Notice</title></head><body><article>"     f"<h1>Notice Title</h1><p>{body}</p>"     "</article></body></html>" ) print(trafilatura.extract(html, output_format="markdown", include_formatting=True)) ```  - 2.1.0 → `# Notice Title\n\nThis municipal notice …` (structured; 2.1.0 also   duplicated the paragraph via the recovery path, which #634 fixed) - 2.2.0 → `Notice TitleThis municipal notice … structure.` (no `#`, no   newlines, heading fused into the first word of the body)  ## Analysis  The main extractor produces a correct, structured result for this page, but its text length (~240 chars) is below `MIN_EXTRACTED_SIZE` (250), so stage 3 of the cascade in `core.py` (`if len_text < options.min_extracted_size …  baseline(tree)`) **replaces** it with `baseline()`'s output. For a page with an `<article>` tag, `baseline()` returns `trim(article.text_content())` in a single
  **Post-Mortem & Fix Analysis**:
  > Reproduced on current main (`c1bc9531`) in a clean `python:3.12-slim` container, and confirmed the 2.1.0 comparison by installing that release in the same image:  ``` 2.2.0 (main)  'Notice TitleThis municipal notice is short but perfectly valid ...'   len 243 2.1.0         '# Notice Title\n\nThis municipal notice is short but perfectly valid ...' ```  The rescue at `core.py:234-235` is doing what you describe, but it is the second of two substitutions, not the first, and that changes what a fix has to cover. Instrumenting the cascade on your input:  ``` main_extractor._extract        len_text=244  <body><head rend="h1">Notice Title</head><p>... core.py:224 compare_extraction len_text=231  <body><p>...            (heading gone) core.py:235 baseline rescue    len_text=243  <body><p>Notice TitleThis...  (fused) ```  So the structured result exists, and it is the external-extractor comparison at stage 2 that discards the heading, before `len_text` ever reaches the rescue. The rescue then c
  > Thanks for your detailed comments. The bug isn't actually new, it just got discoverable in version 2.2.0 because the extraction code is actually better.
  > Reproduced on 2.2.0 (Python 3.12, lxml 6.1.1) and confirmed the 2.1.0 comparison:  ``` 2.2.0  len=243  'Notice TitleThis municipal notice ...' 2.1.0  len=480  '# Notice Title\n\nThis municipal notice ...' ```  The 2.1.0 output does contain the duplicated paragraph, which is what carried `len_text` past 250 — consistent with @ebarkhordar's reading.  On the fusion half, one detail I did not see mentioned yet: **the spacing fix for this already exists in the same file, and the `<article>` tier is the only place that skips it.**  `html2txt()` spaces block boundaries before calling `text_content()` (`baseline.py:296-301`), with a comment naming this exact failure mode:  ```python # space block boundaries so adjacent runs don't stick (minified pages). for elem in body.iter(*_BLOCK_ELEMS):     elem.text = f" {remove_control_characters(elem.text)}" if elem.text else " "     elem.tail = f" {remove_control_characters(elem.tail)}" if elem.tail else " " ```  The other baseline tiers avoid the prob

- **Issue #890** (2026-07-31): **recover_wild_text drops a paragraph's inline clauses and tail text under a layout-table ancestor (wrapper-less pages)**
  *Symptoms*: ## inline clause (and its tail text) dropped from a paragraph on wrapper-less pages  ### Summary On a page with no recognized content wrapper (no `<article>`/`<main>`/known content container), extraction falls to the `recover_wild_text` path. When the body content sits inside a layout `<table>` and a paragraph contains two or more inline elements (`<i>`, `<b>`, …), everything in that paragraph after the first inline element — including the inline elements themselves and the plain-text tails between them — is dropped. The paragraph is silently truncated.  ### Minimal repro ```python import trafilatura  html = """<!DOCTYPE html><html><head><title>Gears</title></head> <body> <table class="maintable"><tr> <td class="sidebar"><a href="/">Home</a> <a href="/archive">Archive</a></td> <td class="content"> <h1>Gears</h1> <p>Mount a size 1/2 gear on the left knob and a size 1/3 gear on the right knob to begin the demonstration of the rates involved here. <p>If the left knob turns at rate <i>r</i>, the middle gear turns at rate -3<i>r</i> and the right knob turns at rate 3<i>r</i>/2. This produces a line with slope 3/2, about a 56-degree angle. <p>Or put in another socket for the axle peg, and then mount size 1/2, size 1/3, and size 1/6 gears, in that order, to see the effect on the resulting slope. </td></tr></table> </body></html>"""  print(trafilatura.extract(html, output_format="markdown", favor_recall=True)) ```  ### Observed The second paragraph is truncated at the first inline el
  **Post-Mortem & Fix Analysis**:
  > Fixed in the last release.

- **Issue #889** (2026-07-29): **Markdown output: <sup>/<sub> text concatenates with no marker (100²=10000 becomes 1002=10000)**
  *Symptoms*: ## `<sup>` and `<sub>` text concatenates with no separator  ### Summary Superscript and subscript content is emitted directly adjacent to the surrounding text, with no marker, so `100<sup>2</sup>=10000` becomes the unreadable run-on `1002=10000` and a dated annotation `2011<sub>15ya</sub>` becomes `201115ya`. The distinction between base and exponent/index is lost, and the numbers are silently wrong.  ### Minimal repro ```python import trafilatura  html = """<!DOCTYPE html><html><head><title>Exponents</title></head><body> <article> <p>The deepest layer has 100<sup>2</sup>=10000 terminal nodes.</p> <p>Written 2011<sub>15ya</sub> during a long winter.</p> </article></body></html>"""  print(trafilatura.extract(html, output_format="markdown", favor_recall=True)) ```  ### Observed ``` The deepest layer has 1002=10000 terminal nodes.  Written 201115ya during a long winter. ```  ### Expected Some separator that preserves the sup/sub boundary, e.g. `100^{2}=10000` and `2011_{15ya}` (or `100^2`, `2011~15ya~`, etc.). Any marker is better than none; the current output changes the numeric meaning.  ### Root cause / pointer `trafilatura/htmlprocessing.py:36-37` maps `sub` → `#sub` and `sup` → `#sup` as `rend` values on `hi` elements. The Markdown serializer in `trafilatura/xml.py` only wraps a `hi` element's text when its `rend` is a key of `HI_FORMATTING`:  - `trafilatura/xml.py:80` — `HI_FORMATTING = {"#b": "**", "#i": "*", "#u": "__", "#t": "`"}` (no `#sup`/`#sub`) - `trafilatura/xml.p

- **Issue #883** (2026-07-31): **All content is flattened into huge blobs**
  *Symptoms*: With the following code:  ```py     downloaded = trafilatura.fetch_url(url)     if not downloaded:         raise RuntimeError(f"Could not fetch {url}")      content_html = trafilatura.extract(         downloaded,         url=url,         output_format="html",         with_metadata=True,         include_images=True,         include_links=False,         favor_recall=True,     )     if not content_html:         raise RuntimeError("Trafilatura extraction failed.")      meta = trafilatura.extract_metadata(downloaded, default_url=url) ```  And using a URL like https://www.rfc-editor.org/rfc/rfc8030.html, titles, parragraphs, and separate lines are all mangled into one huge blob with no newlines in the middle.
  **Post-Mortem & Fix Analysis**:
  > Already fixed on the main branch, release pending.

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

### Incident Patch 1: `f0522a59` (2026-09-30)
**Commit Message**: fix: resolve protocol-relative canonical URLs in metadata (#942)

A canonical link like href="//example.org/p" was treated as a
root-relative path: it was either dropped (no og:/twitter: base) or
appended to the host of the first og:/twitter: URL, e.g. an og:image on
a CDN gave "https://cdn.example.net/example.org/p" as the document URL
and a wrong hostname. Only the scheme is missing, so add it instead.

**File**: `tests/metadata_tests.py` (modified, +6/-0)
```diff
@@ -274,6 +274,12 @@ def test_url():
         )
         == "https://example.org/p"
     )
+    # protocol-relative canonical keeps its own host
+    for doc in (
+        '<html><head><link rel="canonical" href="//example.org/p"/></head><body></body></html>',
+        '<html><head><link rel="canonical" href="//example.org/p"/><meta property="og:image" content="https://cdn.example.net/i.png"/></head><body></body></html>',
+    ):
+        assert extract_url(html.fromstring(doc)) == "https://example.org/p"
 
 
 def test_description():
```

**File**: `trafilatura/metadata.py` (modified, +4/-1)
```diff
@@ -359,8 +359,11 @@ def extract_url(tree: HtmlElement, default_url: str | None = None) -> str | None
         if url:
             break
 
+    # protocol-relative URL: only the scheme is missing
+    if url and url.startswith("//"):
+        url = f"https:{url}"
     # fix relative URLs
-    if url and url.startswith("/"):
+    elif url and url.startswith("/"):
         for element in tree.iterfind(".//head//meta[@content]"):
             attrtype = element.get("name") or element.get("property") or ""
             if attrtype.startswith(("og:", "twitter:")):
```

---

### Incident Patch 2: `2e2de796` (2026-09-30)
**Commit Message**: fix: join list metadata in HTML output instead of crashing (#941)

extract(..., output_format="html", with_metadata=True) raised
"TypeError: Argument must be bytes or unicode, got 'list'" whenever the
page had tags or categories, since those are lists and were passed as-is
to the <meta content> attribute. Join them with ";" as the XML and JSON
outputs already do.

**File**: `tests/unit_tests.py` (modified, +5/-0)
```diff
@@ -4109,6 +4109,11 @@ def test_html_conversion():
     result = extract(html, output_format="html", config=ZERO_CONFIG, with_metadata=True)
     assert result == excepted_html
 
+    # list-valued metadata (tags, categories) is joined as in the XML output
+    html = '<html><head><meta name="keywords" content="k1"/><meta property="article:tag" content="k2"/></head><body><article><h1>Title 1</h1><p>Text.</p></article></body></html>'
+    result = extract(html, output_format="html", config=ZERO_CONFIG, with_metadata=True)
+    assert '<meta name="tags" content="k1;k2"/>' in result
+
     # regression #819/#777: row->tr, head cell->th, plain cell->td, span/role dropped
     table_xml = (
         "<body><table>"
```

**File**: `trafilatura/htmlprocessing.py` (modified, +2/-1)
```diff
@@ -548,7 +548,8 @@ def build_html_output(document: Document, with_metadata: bool = False) -> str:
         head = Element("head")
         for item in META_ATTRIBUTES:
             if value := getattr(document, item):
-                SubElement(head, "meta", name=item, content=value)
+                # categories and tags are lists
+                SubElement(head, "meta", name=item, content=value if isinstance(value, str) else ";".join(value))
         html_tree.insert(0, head)
 
     return tostring(html_tree, pretty_print=True, encoding="unicode").strip()
```

---

### Incident Patch 3: `7afa9441` (2026-09-30)
**Commit Message**: fix: keep text that directly follows a list, table, quote or code block (#940)

_extract() rebuilds these blocks as new elements, so the text after the
closing tag (the source element's tail) was left behind and silently
dropped, for example a "Source: ..." line after a table or a sentence
following a list without its own <p>.

Emit that text as a paragraph of its own, filtered like an <lb> tail.

**File**: `tests/unit_tests.py` (modified, +24/-0)
```diff
@@ -1793,6 +1793,30 @@ def test_no_duplicate_paragraph_from_lb_tail():
     assert not any(line and line.isspace() for line in result.split("\n"))
 
 
+@pytest.mark.parametrize(
+    "block",
+    [
+        "<ul><li>Improve the tram network</li><li>Expand the bicycle lanes</li></ul>",
+        "<table><tr><td>Budget</td><td>40</td></tr><tr><td>Staff</td><td>12</td></tr></table>",
+        "<blockquote><p>We will deliver the plan on time and on budget.</p></blockquote>",
+        "<pre>total = sum(values)</pre>",
+    ],
+)
+def test_text_after_block_is_kept(block):
+    "regression: text directly after a list, table, quote or code block (its tail) was dropped: \
+    _extract() rebuilds those blocks as new elements and left the source tail behind. It is now \
+    kept as a paragraph of its own, exactly once."
+    html = (
+        "<html><body><article><h1>Headline</h1>"
+        f"<p>{'The committee reviewed the proposal over several sessions. ' * 4}</p>"
+        f"{block}These totals include every department that submitted figures in time."
+        f"<p>{'The findings were published together with the underlying data. ' * 4}</p>"
+        "</article></body></html>"
+    )
+    result = extract(html, config=ZERO_CONFIG)
+    assert result.count("These totals include every department") == 1
+
+
 def test_body_xpath_fulltext_class():
     "GH#780: BODY_XPATH's fulltext-class rule (re:test(@class,'fulltext','i'), replacing an \
     obscure translate()-based case-fold hack) must still match every capitalization of a \
```

**File**: `trafilatura/main_extractor.py` (modified, +10/-0)
```diff
@@ -42,6 +42,8 @@
 # meaningful internal attributes to carry onto a rewired sub-element (drop stray class/style/width/etc.)
 KEEP_ATTRS = {"rend", "role", "target", "src", "alt", "title"}
 CODES_QUOTES = {"code", "quote"}
+# blocks rebuilt as new elements by handle_textelem(), which leaves the source tail behind
+REBUILT_BLOCKS = CODES_QUOTES | {"list", "table"}
 NOT_AT_THE_END = {"head", "ref"}
 # tags allowed inside a blockquote paragraph
 _QUOTE_TAGS = set(TAG_CATALOG) | {"ref", "graphic"}
@@ -798,9 +800,17 @@ def _extract(tree: HtmlElement, options: Extractor) -> tuple[_Element, str, set[
             # marks the children it consumes "done"; this covers the elements it cannot retag.
             if elem.getroottree().getroot() is result_body:
                 continue
+            # handlers may rename the element to "done", so read these first
+            tag, tail = elem.tag, elem.tail
             processed_elem = handle_textelem(elem, potential_tags, options)
             if processed_elem is not None:
                 result_body.append(processed_elem)
+            # text right after a rebuilt block is a paragraph of its own, like an <lb> tail
+            if tag in REBUILT_BLOCKS and text_chars_test(tail):
+                tail_elem = Element("p")
+                tail_elem.text = tail
+                if process_node(tail_elem, options) is not None:
+                    result_body.append(tail_elem)
         # remove trailing titles
         while len(result_body) > 0 and (result_body[-1].tag in NOT_AT_THE_END):
             delete_element(result_body[-1], keep_tail=False)
```

---

### Incident Patch 4: `1e31e3e9` (2026-09-25)
**Commit Message**: fix: downloads and decompression overhaul (#921)

* fix: downloads and decompression overhaul

* fix merge conflicts and update the branch

* more robust code

* faster tests and more robust code

* code hardening

**File**: `docs/downloads.rst` (modified, +3/-3)
```diff
@@ -44,7 +44,7 @@ For efficiency reasons the function makes use of a connection pool where connect
 
 The content retrieved by ``fetch_url()`` (stored here in the variable ``downloaded``) is seamlessly decoded to a Unicode string.
 
-Using the ``fetch_response()`` function instead provides access to more information stored in a ``Response`` object which comprises the attributes ``data`` (bytestring), ``headers`` (optional dict), ``html`` (optional str), ``status``, and ``url``:
+Using the ``fetch_response()`` function instead provides access to more information stored in a ``Response`` object which comprises the attributes ``data`` (bytestring), ``headers`` (dict), ``html`` (optional str), ``status``, and ``url``:
 
 .. code-block:: python
 
@@ -56,8 +56,8 @@ Using the ``fetch_response()`` function instead provides access to more informat
     'https://www.example.org'
     >>> response.data
     # raw HTML in binary format
-    >>> response = fetch_response('https://www.example.org', decode=True, with_headers=True)
-    # headers and html attributes used
+    >>> response = fetch_response('https://www.example.org', decode=True)
+    # html attribute populated, headers are always stored
 
 .. note::
     New in version 1.7.0.
```

**File**: `docs/installation.rst` (modified, +4/-3)
```diff
@@ -117,7 +117,8 @@ A few additional libraries can be installed for extended functionality and faste
 
 
 brotli
-    Additional compression algorithm for downloads
+    Additional compression algorithm for downloads, version 1.2 or higher
+    (earlier versions cannot bound the decompressed output and are not used)
 faust-cchardet
     Faster encoding detection, also possibly more accurate (especially for encodings used in Asia)
 htmldate[all] / htmldate[speed]
@@ -128,8 +129,8 @@ pycurl
     Faster downloads, useful where urllib3 fails
 urllib3[socks]
     Downloads through SOCKS proxy with urllib3
-zstandard
-    Additional compression algorithm for downloads
+backports.zstd
+    Zstandard compression algorithm for downloads (Python < 3.14 only, part of the standard library afterwards)
 
 .. seealso::
     `Quickstart <quickstart.html>`_
```

**File**: `docs/settings.rst` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@ The default file included in the package is `settings.cfg <https://github.com/ad
    * ``DOWNLOAD_TIMEOUT = 30`` the time (in seconds) before requests are dropped
    * ``SLEEP_TIME = 5`` time between requests (higher is better to avoid detection)
    * ``USER_AGENTS`` and ``COOKIE`` are empty by default
+   * ``SSRF_PROTECTION = on`` block requests to non-public IP addresses, set to ``off`` for intranet use cases. Inactive when a proxy is configured, and for pycurl downloads when a proxy is set by environment variables such as ``https_proxy``: hosts listed in ``no_proxy`` (e.g. ``169.254.169.254``) are then reached unchecked
+   * ``INSECURE_SSL_FALLBACK = on`` retry without certificate verification after an SSL error. This keeps sites with broken certificates reachable but lets an attacker on the network path read or alter the download, including a configured ``COOKIE``. Set to ``off`` to refuse unverified connections
 - Input
    * ``MAX_FILE_SIZE = 20000000`` maximum acceptable size of input (in bytes)
    * ``MIN_FILE_SIZE = 10`` minimum acceptable size of input (in bytes)
```

**File**: `docs/troubleshooting.rst` (modified, +1/-1)
```diff
@@ -117,7 +117,7 @@ Encoding issues
 
 If the output contains garbled characters (mojibake), the HTML encoding was not detected correctly. Trafilatura handles encoding automatically via ``charset_normalizer``, but edge cases exist:
 
-- **Force re-encoding:** download with ``fetch_response(url, decode=True, with_headers=True)`` and check ``response.headers.get("content-type")`` for a declared charset, or use the already-decoded ``response.html`` string directly instead of the raw ``response.data`` bytes.
+- **Force re-encoding:** download with ``fetch_response(url, decode=True)`` and check ``response.headers.get("content-type")`` for a declared charset, or use the already-decoded ``response.html`` string directly instead of the raw ``response.data`` bytes.
 - **Provide the HTML as a properly decoded string:** if you download with another tool, make sure you decode the bytes with the correct encoding before passing to ``extract()``.
 - **Install optional dependencies:** ``pip install trafilatura[all]`` includes ``pycurl`` which may handle encoding better for certain servers.
 
```

**File**: `pyproject.toml` (modified, +3/-2)
```diff
@@ -106,7 +106,8 @@ all = [
     "py3langid == 0.3.0",
     "pycurl == 7.47.0",
     "urllib3[socks] == 2.7.0",
-    "zstandard == 0.25.0",
+    # stdlib compression.zstd backport, same detection as urllib3, self-retires with 3.14
+    "backports.zstd == 1.7.0; python_version < '3.14'",
 ]
 # Benchmark deps for tests/evaluate.py, which skips the competitors it cannot import.
 eval = [
@@ -204,7 +205,7 @@ strict = true
 
 # third-party packages without type stubs
 [[tool.mypy.overrides]]
-module = ["brotli", "py3langid", "cchardet", "justext.*", "zstandard"]
+module = ["backports.*", "brotli", "py3langid", "cchardet", "justext.*"]
 ignore_missing_imports = true
 
 [[tool.mypy.overrides]]
```

---

### Incident Patch 5: `9c99a932` (2026-09-25)
**Commit Message**: fix: extract article tags when OpenGraph metadata is complete (#934)

**File**: `tests/metadata_tests.py` (modified, +20/-0)
```diff
@@ -26,6 +26,26 @@
 logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
 
 
+def test_tags_with_complete_opengraph_metadata():
+    document = """<html><head>
+        <meta property="og:title" content="Example article"/>
+        <meta property="og:author" content="Jane Smith"/>
+        <meta property="og:url" content="https://example.org/post"/>
+        <meta property="og:description" content="Example description"/>
+        <meta property="og:site_name" content="Example News"/>
+        <meta property="og:image" content="https://example.org/image.jpg"/>
+        <meta name="keywords" content="science, research"/>
+        <meta property="article:tag" content="astronomy"/>
+        <meta name="twitter:title" content="Alternative title"/>
+        </head><body><article>Example article content.</article></body></html>"""
+
+    metadata = extract_metadata(document)
+    assert metadata.tags == ["science, research", "astronomy"]
+    assert metadata.title == "Example article"
+    assert metadata.author == "Jane Smith"
+    assert metadata.image == "https://example.org/image.jpg"
+
+
 def test_titles():
     """Test the extraction of titles"""
     tests = [
```

**File**: `trafilatura/metadata.py` (modified, +0/-13)
```diff
@@ -208,19 +208,6 @@ def examine_meta(tree: HtmlElement) -> Document:
     # bootstrap from potential OpenGraph tags
     metadata = Document().from_dict(extract_opengraph(tree))
 
-    # test if all values not assigned in the following have already been assigned
-    if all(
-        (
-            metadata.title,
-            metadata.author,
-            metadata.url,
-            metadata.description,
-            metadata.sitename,
-            metadata.image,
-        )
-    ):  # tags
-        return metadata
-
     tags, backup_sitename = [], None
 
     # iterate through meta tags
```

---

### Incident Patch 6: `07fe0d64` (2026-09-25)
**Commit Message**: fix: do not duplicate the first item of a nested list (#937)

handle_lists() walks every descendant <item> of a list and relies on
the recursive call for a nested list to rename that list's items to
"done" so the outer loop skips them. lxml's iterator fetches the next
matching element before the loop body runs, so the first item of a
nested list is still yielded after the nested call processed it.

A leaf item is dropped by process_node(), which returns None for
"done" elements, but an item with child elements goes through
process_nested_elements() and its text is emitted a second time as an
item of the parent list. A three-level list thus gains a stray copy of
its middle item, and a nested item with text before a link (with
include_links) leaves a partial copy.

Skip items already marked "done", as the table cell loop does.

**File**: `tests/unit_tests.py` (modified, +15/-0)
```diff
@@ -3254,6 +3254,21 @@ def test_list_processing(options):
     assert target_element.tail == "tail"
 
 
+def test_nested_list_first_item_not_duplicated(options):
+    "regression: the first item of a nested list must not come back as an extra item of the parent list."
+    # it has to carry child elements: a leaf item marked "done" was already dropped by process_node
+    nested = html.fromstring("<list><item>a<list><item>b<list><item>c</item></list></item></list></item></list>")
+    processed_list = handle_lists(nested, options)
+    assert [item.text for item in processed_list.iterchildren("item")] == ["a"]
+
+    three_levels = "<ul><li>a<ul><li>b<ul><li>c</li></ul></li><li>b2</li></ul></li><li>d</li></ul>"
+    assert _extract_doc(three_levels) == f"{_INTRO}\n- a\n  - b\n    - c\n  - b2\n- d"
+    assert "<item>b</item>" not in _extract_doc(three_levels, output_format="xml")
+
+    with_link = "<ul><li>a<ul><li>see <a href='https://example.org/x'>link</a></li><li>c</li></ul></li><li>d</li></ul>"
+    assert _extract_doc(with_link, include_links=True) == f"{_INTRO}\n- a\n  - see [link](https://example.org/x)\n  - c\n- d"
+
+
 def test_code_blocks():
     highlightjs = """<div class="s-prose js-post-body" itemprop="text">
 <p>Code:</p>
```

**File**: `trafilatura/main_extractor.py` (modified, +4/-0)
```diff
@@ -198,6 +198,10 @@ def handle_lists(element: _Element, options: Extractor) -> _Element | None:
     #    processed_element.tail = element.text
 
     for child in element.iterdescendants("item"):
+        # items of a nested list are processed by the recursive call and renamed "done",
+        # but lxml fetches the first of them before that happens: skip it here
+        if child.tag == "done":
+            continue
         new_child_elem = Element("item")
         if len(child) == 0:
             processed_child = process_node(child, options)
```

---

### Incident Patch 7: `13f8711b` (2026-09-25)
**Commit Message**: fix: recognize license links in rel token lists (#936)

**File**: `tests/metadata_tests.py` (modified, +16/-0)
```diff
@@ -5,6 +5,7 @@
 import logging
 import sys
 
+import pytest
 from lxml import html
 from lxml.etree import XPath
 
@@ -483,6 +484,21 @@ def test_process_parent_keeps_good_sitename():
     assert metadata.sitename == "A Long Established Site Name"
 
 
+@pytest.mark.parametrize("rel", ["license noopener", "noopener license noreferrer", "LICENSE", "\tlicense\nnoopener"])
+def test_license_rel_tokens(rel):
+    metadata = extract_metadata(
+        f'<html><body><a href="https://example.org/terms" rel="{rel}">Publication terms</a></body></html>'
+    )
+    assert metadata.license == "Publication terms"
+
+
+def test_license_rel_requires_complete_token():
+    metadata = extract_metadata(
+        '<html><body><a href="https://example.org/terms" rel="not-license">Publication terms</a></body></html>'
+    )
+    assert metadata.license is None
+
+
 def test_license():
     """Test extraction of CC licenses"""
     # a rel
```

**File**: `trafilatura/metadata.py` (modified, +3/-1)
```diff
@@ -441,7 +441,9 @@ def parse_license_element(element: HtmlElement, strict: bool = False) -> str | N
 def extract_license(tree: HtmlElement) -> str | None:
     """Search the HTML code for license information and parse it."""
     # look for links labeled as license
-    for element in tree.findall('.//a[@rel="license"][@href]'):
+    for element in tree.findall(".//a[@rel][@href]"):
+        if "license" not in element.get("rel", "").lower().split():
+            continue
         result = parse_license_element(element, strict=False)
         if result is not None:
             return result
```

---

### Incident Patch 8: `7a6bf76c` (2026-09-25)
**Commit Message**: fix: skip malformed JSON feed entries during link discovery (#935)

**File**: `tests/feeds_tests.py` (modified, +18/-0)
```diff
@@ -176,6 +176,24 @@ def test_json_extraction():
     assert len(links) == 1
 
 
+@pytest.mark.parametrize("items", ["null", "false", '"invalid"', "{}"])
+def test_json_feed_invalid_items_container(items):
+    params = FeedParameters("https://example.org", "example.org", "")
+    assert extract_links(f'{{"items": {items}}}', params) == []
+
+
+def test_json_feed_skips_invalid_entries():
+    params = FeedParameters("https://example.org", "example.org", "")
+    feed = """{"items": [
+        null, 42, "invalid", {},
+        {"url": ["https://example.org/not-a-string"]},
+        {"url": 123},
+        {"url": "https://example.org/first"},
+        {"url": false, "id": "https://example.org/second"}
+    ]}"""
+    assert extract_links(feed, params) == ["https://example.org/first", "https://example.org/second"]
+
+
 def test_feeds_helpers():
     """Test helper functions for feed extraction"""
     params = FeedParameters("https://example.org", "example.org", "https://example.org")
```

**File**: `trafilatura/feeds.py` (modified, +13/-2)
```diff
@@ -122,8 +122,19 @@ def find_links(feed_string: str, params: FeedParameters) -> list[str]:
         if feed_string.startswith("{"):
             try:
                 # fallback: https://www.jsonfeed.org/version/1.1/
-                candidates = [item.get("url") or item.get("id") for item in json.loads(feed_string).get("items", [])]
-                return [c for c in candidates if c is not None]
+                items = json.loads(feed_string).get("items", [])
+                if not isinstance(items, list):
+                    return []
+                candidates = []
+                for item in items:
+                    if not isinstance(item, dict):
+                        continue
+                    for key in ("url", "id"):
+                        candidate = item.get(key)
+                        if isinstance(candidate, str) and candidate:
+                            candidates.append(candidate)
+                            break
+                return candidates
             except json.decoder.JSONDecodeError:
                 LOGGER.debug("JSON decoding error: %s", params.domain)
         else:
```

---

### Incident Patch 9: `590a8f3f` (2026-09-25)
**Commit Message**: fix: parse Atom link attributes independently of quote style and order (#933)

**File**: `tests/feeds_tests.py` (modified, +21/-0)
```diff
@@ -82,6 +82,27 @@ def test_atom_extraction():
     ]  # TODO: remove slash?
 
 
+@pytest.mark.parametrize(
+    "link, expected",
+    [
+        ("<link href='https://example.org/post' rel='alternate'/>", ["https://example.org/post"]),
+        ('<link\nhref="https://example.org/post"/>', ["https://example.org/post"]),
+        ('<link href = "https://example.org/post"/>', ["https://example.org/post"]),
+        ('<link title="One > zero" href="https://example.org/post"/>', ["https://example.org/post"]),
+        (
+            '<link href="https://example.org/post" title="See href=\'https://example.org/other\'"/>',
+            ["https://example.org/post"],
+        ),
+        ('<link href="https://example.org/updates/latest" rel="self"/>', []),
+        ("<link rel='self' href='https://example.org/updates/latest'/>", []),
+        ('<link href="https://example.org/updates/latest" type="application/atom+xml"/>', []),
+    ],
+)
+def test_atom_link_attributes(link, expected):
+    params = FeedParameters("https://example.org", "example.org", "")
+    assert extract_links(f"<feed>{link}</feed>", params) == expected
+
+
 def test_rss_extraction():
     """Test link extraction from a RSS feed"""
     params = FeedParameters("http://example.org/", "example.org", "")
```

**File**: `trafilatura/feeds.py` (modified, +9/-10)
```diff
@@ -50,8 +50,8 @@
 
 FEED_OPENING = re.compile(r"<(feed|rss|\?xml)")
 
-LINK_ATTRS = re.compile(r'<link .*?href=".+?"')
-LINK_HREF = re.compile(r'href="(.+?)"')
+LINK_ATTRS = re.compile(r"""<link\s+(?:[^>"']|"[^"]*"|'[^']*')*["']?/?>""")
+LINK_ATTRIBUTES = re.compile(r"""\s([\w:-]+)\s*=\s*(["'])(.*?)\2""", re.DOTALL)
 LINK_ELEMENTS = re.compile(r"<link>(?:\s*)(?:<!\[CDATA\[)?(.+?)(?:\]\]>)?(?:\s*)</link>", re.DOTALL)
 
 BLACKLIST = re.compile(r"\bcomments\b")  # no comment feed
@@ -131,14 +131,13 @@ def find_links(feed_string: str, params: FeedParameters) -> list[str]:
         return []
 
     # Atom
-    if "<link " in feed_string:
-        return [
-            LINK_HREF.search(link)[1]  # type: ignore[index]
-            for link in (m[0] for m in islice(LINK_ATTRS.finditer(feed_string), MAX_LINKS))
-            if "atom+xml" not in link and 'rel="self"' not in link
-        ]
-        # if '"' in feedlink:
-        #    feedlink = feedlink.split('"')[0]
+    if LINK_ATTRS.search(feed_string):
+        links = []
+        for match in islice(LINK_ATTRS.finditer(feed_string), MAX_LINKS):
+            attributes = {attr[1]: attr[3] for attr in LINK_ATTRIBUTES.finditer(match[0])}
+            if attributes.get("href") and attributes.get("rel") != "self" and "atom+xml" not in attributes.get("type", ""):
+                links.append(attributes["href"])
+        return links
 
     # RSS
     if "<link>" in feed_string:
```

---

### Incident Patch 10: `c852cae9` (2026-09-21)
**Commit Message**: fix: extract JSON-LD metadata with array-valued types (#932)

* fix: extract JSON-LD authors with array-valued types

* fix: recognize JSON-LD node types in arrays

**File**: `tests/json_metadata_tests.py` (modified, +95/-0)
```diff
@@ -2,9 +2,11 @@
 Unit tests for JSON metadata extraction.
 """
 
+import json
 import logging
 import sys
 
+import pytest
 from lxml import html
 
 from trafilatura.json_metadata import (
@@ -1157,6 +1159,99 @@ def test_json_metadata_robustness():
     assert extract_metadata('<html><body><script type="application/ld+json">[123]</script></body></html>') is not None
 
 
+@pytest.mark.parametrize("as_array", [False, True])
+@pytest.mark.parametrize(
+    ("author", "expected"),
+    [
+        ({"name": "Jane Doe"}, "Jane Doe"),
+        ({"@type": "Person", "name": "Jane Doe"}, "Jane Doe"),
+        ({"@type": ["Person"], "name": "Jane Doe"}, "Jane Doe"),
+        ({"@type": ["Thing", "Person"], "name": "Jane Doe"}, "Jane Doe"),
+        ({"@type": ["Person", "Thing"], "name": "Jane Doe"}, "Jane Doe"),
+        ({"@type": "Organization", "name": "Example News"}, None),
+        ({"@type": ["Organization"], "name": "Example News"}, None),
+        ({"@type": [], "name": "Jane Doe"}, None),
+        ({"@type": None, "name": "Jane Doe"}, None),
+    ],
+)
+def test_json_author_type_arrays(author, expected, as_array):
+    "Extract Person authors regardless of whether their type is a string or an array."
+    schema = {
+        "@context": "https://schema.org",
+        "@type": "NewsArticle",
+        "author": [author] if as_array else author,
+    }
+    metadata = extract_metadata(f'<html><head><script type="application/ld+json">{json.dumps(schema)}</script></head></html>')
+    assert metadata is not None
+    assert metadata.author == expected
+
+
+@pytest.mark.parametrize("author_type", ["Person", ["Person"]])
+@pytest.mark.parametrize(
+    ("article_type", "pagetype"),
+    [
+        ("NewsArticle", "newsarticle"),
+        (["NewsArticle"], "newsarticle"),
+        (["NewsArticle", "Thing"], "newsarticle"),
+        (["Thing", "NewsArticle"], "newsarticle"),
+        (["CreativeWork", "Article"], "article"),
+        (["Thing", "nEwSaRtIcLe"], "newsarticle"),
+    ],
+)
+def test_json_article_type_arrays(article_type, pagetype, author_type):
+    "Extract article metadata when an unrecognized type precedes the article type."
+    schema = {
+        "@context": "https://schema.org",
+        "@type": article_type,
+        "author": {"@type": author_type, "name": "Jane Doe"},
+        "publisher": {"@type": "Organization", "name": "Example News"},
+        "headline": "Example headline",
+        "articleSection": "News",
+    }
+    metadata = extract_metadata(f'<html><head><script type="application/ld+json">{json.dumps(schema)}</script></head></html>')
+    assert metadata is not None
+    assert metadata.author == "Jane Doe"
+    assert metadata.pagetype == pagetype
+    assert metadata.sitename == "Example News"
+    assert metadata.title == "Example headline"
+    assert metadata.categories == ["News"]
+
+
+@pytest.mark.parametrize(
+    ("node_type", "author", "pagetype", "sitename"),
+    [
+        ("Person", "Example Name", None, None),
+        (["Person"], "Example Name", None, None),
+        (["Thing", "Person"], "Example Name", None, None),
+        (["Thing", "Organization"], None, None, "Example Name"),
+        (["Thing", "WebSite"], None, "website", "Example Name"),
+        (["Thing", "FAQPage"], None, "faqpage", None),
+        (["Person", "Article"], "Example Name", None, None),
+        (["Article", "Person"], "Nested Author", "article", None),
+        (["WebPage", "NewsArticle"], None, "webpage", "Example Name"),
+        (["NewsArticle", "WebPage"], "Nested Author", "newsarticle", None),
+        (["TechArticle", "Article"], None, "techarticle", None),
+        (["NewsArticle", None], "Nested Author", "newsarticle", None),
+        (["Thing", "Unknown"], None, None, None),
+        (["Thing", None], None, None, None),
+        ("Thing", None, None, None),
+        ([], None, None, None),
+        (None, None, None, None),
+    ],
+)
+def test_json_node_type_arrays(node_type, author, pagetype, 
```

**File**: `trafilatura/json_metadata.py` (modified, +12/-4)
```diff
@@ -64,6 +64,7 @@
     "jobposting",
 }
 JSON_PUBLISHER_SCHEMA = {"newsmediaorganization", "organization", "webpage", "website"}
+JSON_SCHEMA_TYPES = JSON_ARTICLE_SCHEMA | JSON_OGTYPE_SCHEMA | JSON_PUBLISHER_SCHEMA | {"person"}
 JSON_AUTHOR_1 = re.compile(r'"author":[^}[]+?"name?\\?": ?\\?"([^"\\]+)|"author"[^}[]+?"names?".+?"([^"]+)', re.DOTALL)
 JSON_AUTHOR_2 = re.compile(r'"[Pp]erson"[^}]+?"names?".+?"([^"]+)', re.DOTALL)
 JSON_AUTHOR_REMOVE = re.compile(
@@ -126,9 +127,16 @@ def process_parent(parent: Any, metadata: Document) -> Document:
         if "@type" not in content or not content["@type"]:
             continue
 
-        # some websites are using ['Person'] as type
-        content_type = content["@type"][0] if isinstance(content["@type"], list) else content["@type"]
-        content_type = content_type.lower()
+        # Prefer the first recognized type, preserving order among recognized types.
+        content_types = as_list(content["@type"])
+        content_type = next(
+            (
+                schema_type
+                for schema_type in content_types
+                if isinstance(schema_type, str) and schema_type.lower() in JSON_SCHEMA_TYPES
+            ),
+            content_types[0],
+        ).lower()
 
         # The "pagetype" should only be returned if the page is some kind of an article, category, website...
         if content_type in JSON_OGTYPE_SCHEMA and not metadata.pagetype:
@@ -158,7 +166,7 @@ def process_parent(parent: Any, metadata: Document) -> Document:
                 for author in as_list(list_authors):
                     if isinstance(author, str):
                         author = {"name": author}
-                    if "@type" not in author or author["@type"] == "Person":
+                    if "@type" not in author or "Person" in as_list(author["@type"]):
                         author_name = None
                         # error thrown: author['name'] can be a list (?)
                         if "name" in author:
```

#### Recent Merged Pull Requests:
- **PR #942** (2026-09-30): fix: resolve protocol-relative canonical URLs in metadata (@MohammadHijjawi97)
- **PR #941** (2026-09-30): fix: join list metadata in HTML output instead of crashing (@MohammadHijjawi97)
- **PR #940** (2026-09-30): fix: keep text that directly follows a list, table, quote or code block (@r0h1tb)
- **PR #938** (2026-09-30): maintenance: simplify document handling code (@adbar)
- **PR #937** (2026-09-25): fix: do not duplicate the first item of a nested list (@SulimanAbdulrazzaq)
- **PR #936** (2026-09-25): Recognize license links in rel token lists (@mfurkanakinci)
- **PR #935** (2026-09-25): Skip malformed JSON feed entries during link discovery (@mfurkanakinci)
- **PR #934** (2026-09-25): Extract article tags when OpenGraph metadata is complete (@mfurkanakinci)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
