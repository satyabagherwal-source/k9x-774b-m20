# Forensic Learning Record (Deep Inspection): adbar/trafilatura

> **Canonical Artifact**: `07_PROJECT_LEARNING/adbar-trafilatura-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/adbar/trafilatura](https://github.com/adbar/trafilatura))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:53:16.752Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `adbar/trafilatura`
- **Description**: Python & Command-line tool to gather text and metadata on the Web: Crawling, scraping, extraction, output as CSV, JSON, HTML, MD, TXT, XML
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 6914 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

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


def process_result(htmlstring: str, args: argparse.Namespace, counter: int, options: Extractor | None) -> int:
    "Extract text and metadata from a download webpage and eventually write out the result."
    # backup option
    fileslug = archive_html(htmlstring, args, counter) if args.backup_dir else ""
    # process
    result = examine(htmlstring, args, options=options)
    write_result(result, args, orig_filename=fileslug, counter=counter, new_filename=fileslug)
    # increment written file counter
    if counter >= 0 and result:
        counter += 1
    return counter


def download_queue_processing(
    url_store: UrlStore,
    args: argparse.Namespace,
    counter: int,
    options: Extractor,
) -> tuple[list[str], int]:
    "Implement a download queue consumer, single- or multi-threaded."
    errors = []
    sleep_time = options.config.getfloat("DEFAULT", "SLEEP_TIME")

    while not url_store.done:
        bufferlist, url_store = load_download_buffer(url_store, sleep_time)
        # process downloads
        for url, result in buffered_downloads(bufferlist, args.parallel, options=options):
            # handle result
            if result and isinstance(result, str):
                options.url = url
                counter = process_result(result, args, counter, options)
            else:
                LOGGER.warning("No result for URL: %s", url)
                errors.append(url)
    return errors, counter


def cli_discovery(args: argparse.Namespace) -> int:
    "Group CLI functions dedicated to URL discovery."
    url_store = load_input_dict(args)
    input_urls = url_store.dump_urls()
    if args.list:
        url_store.reset()

    options = args_to_extractor(args)
    func = partial(
        find_feed_urls if args.feed else sitemap_search,
        target_lang=args.target_language,
        external=options.config.getboolean("DEFAULT", "EXTERNAL_URLS"),
        sleep_time=options.config.getfloat("DEFAULT", "SLEEP_TIME"),
        config=options.config,
    )
    lock = RLock()

    # link discovery 
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
       algorithm, not just stricter rules, so it reaches content the rule-based retry cannot)
    Returns the body and comments elements with their text.

    Internal helper: its signature and 4-tuple return are not a stable API — call
    ``bare_extraction``/``extract`` instead.
    """
    is_forum = _forum_thread_page(tree)
    # raw-tree prune so the external extractors inherit it too: readability would otherwise
    # pick the longest appended article over the real one
    tree = prune_unwanted_nodes(tree, REMOVE_APPENDED_ARTICLES_XPATH + REMOVE_SHARE_WIDGETS_XPATH)
    # comments off: prune the raw tree so all stages inherit it
    if not options.comments and (options.focus == "precision" or not is_forum):
        tree = prune_unwanted_nodes(tree, REMOVE_COMMENTS_XPATH)
    cleaned_tree, cleaned_tree_backup = _prepare_tree(tree, options, url)

    commentsbody, temp_comments = Element("body"), ""
    forum_posts = None
    if options.comments:
        commentsbody, temp_comments, cleaned_tree = extract_comments(cleaned_tree, options)
        if temp_comments and is_forum:
            # thread-forum: the "comments" are the posts -> route into the body (backup predates
            # capture); keep the capture aside, salvaged below if the cascade drops the posts
            forum_posts = commentsbody
            commentsbody, temp_comments = Element("body"), ""
            cleaned_tree = convert_tags(copy(cleaned_tree_backup), options, url)
    if options.focus == "precision" and not is_forum:
        # NOT redundant with the raw-tree prune above: this runs POST-conversion, where
        # <ul id="comments"> has become <list ...> and now matches the xpath's self::list
        cleaned_tree = prune_unwanted_nodes(cleaned_tree, REMOVE_COMMENTS_XPATH)

    postbody, temp_text = _extract_and_compare(cleaned_tree, cleaned_tree_backup, tree, options)

    # 3. rescue: baseline on the original tree, accepted only if it adds text (#896)
    if len(temp_text) < options.min_extracted_size and options.focus != "precision":
        b_body, b_text, b
```

### Core Architecture Module: `trafilatura/utils.py`
```
# pylint:disable-msg=E0611,I1101
"""
Module bundling functions related to HTML and text processing,
content filtering and language detection.
"""

import logging
import re
import sys
import zlib
from collections.abc import Callable, Iterable, Iterator, Mapping
from functools import lru_cache
from itertools import islice
from typing import TYPE_CHECKING, Any, Literal, TypeAlias, cast
from unicodedata import normalize

# response compression
try:
    import brotli

    # output_buffer_limit (brotli >= 1.2) is the only way to bound the output:
    # process() otherwise returns the whole expansion, which voids the bomb cap
    try:
        brotli.Decompressor().process(b"", output_buffer_limit=1)
        HAS_BROTLI = True
    except Exception:  # pragma: no cover
        HAS_BROTLI = False
except ImportError:
    HAS_BROTLI = False

# zstd: stdlib from 3.14 on, official backport before
try:
    if sys.version_info >= (3, 14):
        from compression import zstd  # pragma: no cover
    else:
        from backports import zstd  # type: ignore[no-redef]

    HAS_ZSTD = True
except ImportError:
    HAS_ZSTD = False

# language detection
try:
    import py3langid

    LANGID_FLAG = True
except ImportError:
    LANGID_FLAG = False

# CChardet is faster and can be more accurate
try:
    from cchardet import detect as cchardet_detect
except ImportError:
    cchardet_detect = None  # type: ignore[assignment]

from charset_normalizer import from_bytes
from courlan import fix_relative_urls, get_base_url
from lxml.etree import _Element
from lxml.html import HtmlElement, HTMLParser, fromstring

# response types
from urllib3.response import HTTPResponse

if TYPE_CHECKING:  # pragma: no cover
    from .settings import Document, Extractor


class Response:
    "Store information gathered in a HTTP response object."

    __slots__ = ["data", "headers", "html", "status", "url"]

    def __init__(self, data: bytes, status: int, url: str) -> None:
        self.data = data
        self.headers: dict[str, str] | None = None
        self.html: str | None = None
        self.status = status
        self.url = url

    def __bool__(self) -> bool:
        return self.data is not None

    def __repr__(self) -> str:
        return self.html or decode_file(self.data)

    def store_headers(self, headerdict: Mapping[str, str]) -> None:
        "Store response headers with lowercase names."
        self.headers = {k.lower(): v for k, v in headerdict.items()}

    def decode_data(self, decode: bool, max_size: int | None = None) -> None:
        "Decode the bytestring in data and store a string in html."
        if decode and self.data:
            self.html = decode_file(self.data, max_size)

    def as_dict(self) -> dict[str, Any]:
        "Convert the response object to a dictionary."
        # heterogeneous value types (bytes, int, dict, str, None)
        return {attr: getattr(self, attr) for attr in self.__slots__}


# accepted input for HTML loading
HtmlInput: TypeAlias = HtmlElement | HTTPResponse | Response | bytes | str

LOGGER = logging.getLogger(__name__)

UNICODE_ALIASES = {"utf-8", "utf_8"}

DOCTYPE_TAG = re.compile("^< ?! ?DOCTYPE[^>]*/[^<>]*>", re.IGNORECASE)
FAULTY_HTML = re.compile(r"(<html.*?)\s*/>", re.IGNORECASE)
HTML_STRIP_TAGS = re.compile(r"(<!--.*?-->|<[^>]*>)")
# control characters
INVALID_XML_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]")

# note: htmldate could use HTML comments
# huge_tree=True, remove_blank_text=True
HTML_PARSER = HTMLParser(collect_ids=False, default_doctype=False, encoding="utf-8", remove_comments=True, remove_pis=True)

LINES_TRIMMING = re.compile(r"(?<![p{P}>])\n", flags=re.UNICODE | re.MULTILINE)

URL_BLACKLIST_REGEX = re.compile(r"^https?://|/+$")

# Regex to check image file extensions
IMAGE_EXTENSION = re.compile(r"[^\s]+\.(avif|bmp|gif|hei[cf]|jpe?g|png|webp)(\b|$)", re.IGNORECASE)

FORMATTING_PROTECTED = {"cell", "head", "hi", "item", "p", "quote", "ref", "td"}
SPACING_PROTECTED = {"code", "pre"}

# https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Language
TARGET_LANG_ATTRS = ('http-equiv="content-language"', 'property="og:locale"')
RE_HTML_LANG = re.compile(r"([a-z]{2})")

# Mostly filters for social media (text-level analog of the xpaths social/share tokens)
RE_FILTER = re.compile(
    r"\W*(Drucken|E-?Mail|Facebook|Flipboard|Google|Instagram|"
    "Linkedin|Mail|PDF|Pinterest|Pocket|Print|QQ|Reddit|Twitter|"
    "WeChat|WeiBo|Whatsapp|Xing|Mehr zum Thema:?|More on this.{,8}$)$",
    flags=re.IGNORECASE,
)
# link text > this fraction of total text = link farm (htmlprocessing.link_density_test)
LINK_FARM_RATIO = 0.9


def _capped(chunks: Iterable[bytes], max_size: int) -> bytes:
    "Accumulate decompressed chunks, rejecting payloads over max_size."
    out = bytearray()
    for chunk in chunks:
        out += chunk
        if len(out) > max_size:
            raise ValueError("decompressed content exceeds MAX_FILE_SIZE")
    return bytes(out)


# bgzip output needs ~320 members for 20MB
MAX_MEMBERS = 1000


def _bounded_members(raw: bytes, make_dec: Callable[[], Any], max_size: int) -> bytes:
    "Decompress a concatenated multi-member stream, rejecting output over max_size."
    out = bytearray()
    for _ in range(MAX_MEMBERS):
        dec = make_dec()
        # single capped call, no flush(): pending input must stay compressed or the cap is void
        out += dec.decompress(raw, max_size + 1 - len(out))
        # covers cap-truncated, oversized, and incomplete streams
        if len(out) > max_size or not dec.eof:
            raise ValueError("oversized or incomplete compressed stream")
        raw = dec.unused_data.lstrip(b"\0")  # NUL padding as gzip.decompress, copied each round
        if not raw:
            return bytes(out)
    raise ValueError("too many compressed members")


def _bounded_inflate(raw: bytes, max_size: int) -> bytes:
    "Decompress a single zlib/deflate stream, ignoring trailing bytes as zlib.decompress does."
    dec = zlib.decompressobj(zlib.MAX_WBITS)
    out = dec.decompress(raw, max_size + 1)
    if len(out) > max_size or not dec.eof:
        raise ValueError("oversized or incomplete compressed stream")
    return out


def _bounded_unbrotli(raw: bytes, max_size: int) -> bytes:
    "Decompress a brotli stream, output-capped at max_size."
    dec = brotli.Decompressor()
    out: bytes = dec.process(raw, output_buffer_limit=max_size + 1)
    # is_finished(): non-brotli input can yield b"" without raising
    if len(out) > max_size or not dec.is_finished():
        raise ValueError("oversized or incomplete compressed stream")
    return out


def handle_compressed_file(filecontent: bytes, max_size: int | None = None) -> bytes:
    """
    Don't trust response headers and try to decompress a binary string
    with a cascade of installed packages, capped at max_size (the configured
    MAX_FILE_SIZE by default) to guard against decompression bombs.
    Use magic numbers when available.
    """
    if not isinstance(filecontent, bytes):
        return filecontent

    if max_size is None:
        # deferred: circular import (settings imports utils)
        from .settings import DEFAULT_CONFIG  # noqa: PLC0415

        max_size = DEFAULT_CONFIG.getint("DEFAULT", "MAX_FILE_SIZE")

    # magic-numbered formats are terminal: failure means a corrupt file, not another format
    # source: https://stackoverflow.com/questions/3703276/how-to-tell-if-a-file-is-gzip-compressed
    if filecontent[:3] == b"\x1f\x8b\x08":
        try:
            return _bounded_members(filecontent, lambda: zlib.decompressobj(31), max_size)  # 31 = gzip header
        except (zlib.error, ValueError):
            LOGGER.warning("invalid or oversized GZ file")
    elif HAS_ZSTD and filecontent[:4] == b"\x28\xb5\x2f\xfd":
        try:
            return _bounded_members(filecontent, zstd.ZstdDecompressor, max_size)
        except (zstd.ZstdError, ValueError):
            LOGGER.warning("invalid or oversized ZSTD file")
    # no magic numbers: try brotli, then zlib/deflate speculatively
    else:
        if HAS_BROTLI:
            try:
                return _bounded_unbrotli(filecontent, max_size)
            except (brotli.error, ValueError):
                pass
        # single stream: multi-member concatenation is a gzip/zstd property, not a deflate one
        try:
            return _bounded_inflate(filecontent, max_size)
        except (zlib.error, ValueError):
            pass

    # return content unchanged if decompression failed
    return filecontent


def detect_encoding(bytesobject: bytes) -> list[str]:
    """ "Read all input or first chunk and return a list of encodings"""
    # alternatives: https://github.com/scrapy/w3lib/blob/master/w3lib/encoding.py
    # unicode-test
    try:
        bytesobject.decode("UTF-8")
        return ["utf-8"]
    except UnicodeDecodeError:
        pass
    guesses = []
    # additional module
    if cchardet_detect is not None:
        cchardet_guess = cchardet_detect(bytesobject)["encoding"]
        if cchardet_guess is not None:
            guesses.append(cchardet_guess.lower())
    # try charset_normalizer on first part, fallback on full document
    if len(bytesobject) < 10000:
        detection_results = from_bytes(bytesobject)
    else:
        detection_results = from_bytes(bytesobject[:5000] + bytesobject[-5000:]) or from_bytes(bytesobject)
    # return alternatives
    guesses.extend(r.encoding for r in detection_results)
    # it cannot be utf-8 (tested above)
    return [g for g in guesses if g not in UNICODE_ALIASES]


def decode_file(filecontent: bytes | str, max_size: int | None = None) -> str:
    """Decompress the bytestring if necessary, guess its encoding and
    decode to a Unicode string, resorting to destructive conversion otherwise."""
    if isinstance(filecontent, str):
        return filecontent

    filecontent = handle_compressed_file(filecontent, max_size)
    # fast path: valid UTF-8
```

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
__version__ = "2.3.0"


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
    JSON content embedded in scripts or attributes (schema.org properties,
    Discourse forum posts), article tags, text paragraphs, schema.org teaser
    descriptions, and finally the raw text of the whole page body.

    Args:
        filecontent: HTML code as binary string or string (or LXML element;
            elements are copied, the input is left untouched).

    Returns:
        A LXML <body> element containing the extracted paragraphs,
        the main text as string, and its length as integer.

    """
    tree = load_html(filecontent)
    if tree is None:
        return Element("body"), "", 0
    if isinstance(filecontent, HtmlElement):
        tree = copy(tree)  # basic_cleaning below mutates the tree

    # scrape from embedded JSON: full-text properties first, teaser descriptions kept for
    # later. dedupe: pages often embed the same JSON-LD block twice (theme + SEO plugin)
    json_bodies, json_teasers = _collect_json_content(tree)
    if result := _attempt(map(_render_text, json_bodies), dedupe=True):
        return result

    tree = basic_cleaning(tree)

    # article tags: a dominant one relegates much smaller siblings to noise (related teasers),
    # similar-sized ones are all content (forum posts). Nested articles excluded (counted in ancestor)
    article_texts = [
        text
        for elem in tree.xpath(".//article[not(ancestor::article)]")
        if len(text := block_text(elem)) > _MIN_CONTENT_LENGTH
    ]
    if article_texts:
        # never None: the longest article passes both its own length gate and the cutoff
        cutoff = max(map(len, article_texts)) / 5
        if result := _attempt(text for text in article_texts if len(text) >= cutoff):
            return result

    # scrape from text paragraphs, dropping repeats: a nested element (e.g. <p> in
    # <blockquote>) duplicates part of its container's text, collected first in document order
    # skip any element whose ancestor is already in the scraped set (handles <p><code>, <blockquote><
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
    parsed = map_args(parser.parse_args(args))
    _validate_args(parser, parsed)
    return parsed


def map_args(args: argparse.Namespace) -> argparse.Namespace:
    """Map existing options to format and output choices."""
    # formats
    for otype in ("csv", "html", "json", "markdown", "xml", "xmltei"):
        if getattr(args, otype):
            args.output_format = otype
            break
    return args


def main() -> None:
    """Run as a command-line utility."""
    args = parse_args(sys.argv[1:])
    process_args(args)


def process_args(args: argparse.Namespace) -> None:
    """Perform the actual processing according to the arguments"""
    exit_code = 0

    level = logging.DEBUG if args.verbose >= 2 else logging.INFO if args.verbose == 1 else logging.WARNING
    logging.basicConfig(stream=sys.stderr, level=level)

    if args.blacklist:
        args.blacklist = load_blacklist(args.blacklist)

    # processing according to mutually exclusive options

    # fetch urls from a feed or a sitemap
    if args.explore or args.feed or args.sitemap:
        exit_code = cli_discovery(args)

    # activate crawler/spider
    elif args.crawl:
        cli_crawler(args)

    # probe and print only
    elif args.probe:
        probe_homepage(args)

    # read files from an input directory
    elif args.input_dir:
        file_processing_pipeline(args)

    # read url list from input file or process input URL
    elif args.input_file or args.URL:
        url_store = load_input_dict(args)
        exit_code = url_processing_pipeline(args, url_store)

    # read input on STDIN directly
    else:
        result = examine(sys.stdin.buffer.read(), args, url=args.URL)
        write_result(result, args)

    # change exit code if there are errors
    if exit_code != 0:
        sys.exit(exit_code)


if __name__ == "__main__":
    main()

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
            headers=_determine_headers(config),
            retries=_get_retry_strategy(config),
            timeout=config.getint("DEFAULT", "DOWNLOAD_TIMEOUT"),
            preload_content=False,
        )
        try:
            # stream() yields decoded chunks: the cap applies to decompressed bytes
            data = _capped(response.stream(2**17), config.getint("DEFAULT", "MAX_FILE_SIZE"))
        finally:
            response.release_conn()

        # necessary for standardization
        # geturl() returns the raw Location header after a redirect and the request
        # URI otherwise, both of which can be relative
        resp = Response(data, response.status, urljoin(url, response.geturl() or url))
        resp.store_headers(response.headers)
        return resp

    except (urllib3.exceptions.SSLError, urllib3.exceptions.MaxRetryError) as err:
        # handshake failures surface as MaxRetryError with an SSLError reason
        cause = err.reason if isinstance(err, urllib3.exceptions.MaxRetryError) else err
        if not no_ssl and isinstance(cause, urllib3.exceptions.SSLError):
            raise _SSLRetryError(str(err)) from err
        LOGGER.error("download error: %s %s", url, err)
    except Exception as err:
        LOGGER.error("download error: %s %s", url, err)  # sys.exc_info()[0]

    return None


def _is_suitable_response(url: str, response: Response, options: Extractor) -> bool:
    "Check if the response conforms to formal criteria."
    if response.status != 200:
        LOGGER.error("not a 200 response: %s for URL %s", response.status, url)
        return False
    return is_acceptable_length(len(response.html or response.data or ""), options)


def fetch_url(
    url: str,
    no_ssl: bool = False,
    config: ConfigParser = DEFAULT_CONFIG,
    options: Extractor | None = None,
) -> str | None:
    """Downloads a web page and seamlessly decodes the response.

    Args:
        url: URL of the page to fetch.
        no_ssl: Do not try to establish a secure
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
    seen_group_elems: set[_Element | None] = set()
    for tr in cleaned_tree.iter("tr"):
        parent = tr.getparent()
        if parent not in seen_group_elems and tr.find("th") is not None:
            seen_group_elems.add(parent)
            for c in tr.iterchildren("th"):
                c.set("role", "head")
    for elem in cleaned_tree.iter("td", "th", "tr"):
        elem.tag = "row" if elem.tag == "tr" else "cell"
    # 3. sanitize
    strip_tags(cleaned_tree, *({str(elem.tag) for elem in cleaned_tree.iter("*")} - TEI_VALID_TAGS))
    # 4. return
    return cleaned_tree, trim(" ".join(cleaned_tree.itertext()))

```

### Core Architecture Module: `trafilatura/feeds.py`
```
"""
Examining feeds and extracting links for further processing.
"""

import json
import logging
import re
from configparser import ConfigParser
from itertools import islice
from time import sleep

from courlan import (
    check_url,
    clean_url,
    filter_urls,
    get_hostinfo,
    is_valid_url,
)

from .deduplication import is_similar_domain
from .downloads import fetch_url
from .settings import DEFAULT_CONFIG, MAX_FEEDS_CHECKED, MAX_LINKS
from .utils import load_html, safe_relative_url

LOGGER = logging.getLogger(__name__)

# https://www.iana.org/assignments/media-types/media-types.xhtml
# standard + potential types
FEED_TYPES = {
    "application/atom",  # not IANA-compatible
    "application/atom+xml",
    "application/feed+json",  # not IANA-compatible
    "application/json",
    "application/rdf",  # not IANA-compatible
    "application/rdf+xml",
    "application/rss",  # not IANA-compatible
    "application/rss+xml",
    "application/x.atom+xml",  # not IANA-compatible
    "application/x-atom+xml",  # not IANA-compatible
    "application/xml",
    "text/atom",  # not IANA-compatible
    "text/atom+xml",
    "text/plain",
    "text/rdf",  # not IANA-compatible
    "text/rdf+xml",
    "text/rss",  # not IANA-compatible
    "text/rss+xml",
    "text/xml",
}

FEED_OPENING = re.compile(r"<(feed|rss|\?xml)")

LINK_ATTRS = re.compile(r"""<link\s+(?:[^>"']|"[^"]*"|'[^']*')*["']?/?>""")
LINK_ATTRIBUTES = re.compile(r"""\s([\w:-]+)\s*=\s*(["'])(.*?)\2""", re.DOTALL)
LINK_ELEMENTS = re.compile(r"<link>(?:\s*)(?:<!\[CDATA\[)?(.+?)(?:\]\]>)?(?:\s*)</link>", re.DOTALL)

BLACKLIST = re.compile(r"\bcomments\b")  # no comment feed

LINK_VALIDATION_RE = re.compile(
    r"\.(?:atom|rdf|rss|xml)$|"
    r"\b(?:atom|rss)\b|"
    r"\?type=100$|"  # Typo3
    r"feeds/posts/default/?$|"  # Blogger
    r"\?feed=(?:atom|rdf|rss|rss2)|"
    r"feed$",  # Generic
)


class FeedParameters:
    "Store necessary information to proceed a feed."

    __slots__ = ["base", "domain", "ext", "lang", "ref"]

    def __init__(
        self,
        baseurl: str,
        domain: str,
        reference: str,
        external: bool = False,
        target_lang: str | None = None,
    ) -> None:
        self.base: str = baseurl
        self.domain: str = domain
        self.ext: bool = external
        self.lang: str | None = target_lang
        self.ref: str = reference


def is_potential_feed(feed_string: str) -> bool:
    "Check if the string could be a feed."
    if FEED_OPENING.match(feed_string):
        return True
    beginning = feed_string[:100]
    return "<rss" in beginning or "<feed" in beginning


def handle_link_list(linklist: list[str], params: FeedParameters) -> list[str]:
    """Examine links to determine if they are valid and
    lead to a web page"""
    output_links = []

    for item in sorted(set(linklist)):
        link = safe_relative_url(params.base, item)
        checked = check_url(link, language=params.lang)

        if checked is not None:
            if not params.ext and "feed" not in link and not is_similar_domain(params.domain, checked[1]):
                LOGGER.warning("Rejected, diverging domain names: %s %s", params.domain, checked[1])
            else:
                output_links.append(checked[0])
        # Feedburner/Google feeds
        elif "feedburner" in item or "feedproxy" in item:
            output_links.append(item)

    return output_links


def find_links(feed_string: str, params: FeedParameters) -> list[str]:
    "Try different feed types and return the corresponding links."
    if not is_potential_feed(feed_string):
        # JSON
        if feed_string.startswith("{"):
            try:
                # fallback: https://www.jsonfeed.org/version/1.1/
                items = json.loads(feed_string).get("items", [])
                if not isinstance(items, list):
                    return []
                candidates = []
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    for key in ("url", "id"):
                        candidate = item.get(key)
                        if isinstance(candidate, str) and candidate:
                            candidates.append(candidate)
                            break
                return candidates
            except (json.decoder.JSONDecodeError, RecursionError):
                LOGGER.debug("JSON decoding error: %s", params.domain)
        else:
            LOGGER.debug("Possibly invalid feed: %s", params.domain)
        return []

    # Atom
    if LINK_ATTRS.search(feed_string):
        links = []
        for match in islice(LINK_ATTRS.finditer(feed_string), MAX_LINKS):
            attributes = {attr[1]: attr[3] for attr in LINK_ATTRIBUTES.finditer(match[0])}
            if attributes.get("href") and attributes.get("rel") != "self" and "atom+xml" not in attributes.get("type", ""):
                links.append(attributes["href"])
        return links

    # RSS
    if "<link>" in feed_string:
        return [m[1].strip() for m in islice(LINK_ELEMENTS.finditer(feed_string), MAX_LINKS)]

    return []


def extract_links(feed_string: str, params: FeedParameters) -> list[str]:
    "Extract and refine links from Atom, RSS and JSON feeds."
    if not feed_string:
        LOGGER.debug("Empty feed: %s", params.domain)
        return []

    feed_links = find_links(feed_string.strip(), params)

    output_links = [link for link in handle_link_list(feed_links, params) if link != params.ref and link.count("/") > 2]

    if feed_links:
        LOGGER.debug("Links found: %s of which %s valid", len(feed_links), len(output_links))
    else:
        LOGGER.debug("Invalid feed for %s", params.domain)

    return output_links


def determine_feed(htmlstring: str, params: FeedParameters) -> list[str]:
    """Parse the HTML and try to extract feed URLs from the home page.
    Adapted from http://www.aaronsw.com/2002/feedfinder/"""
    tree = load_html(htmlstring)
    if tree is None:
        LOGGER.debug("Invalid HTML/Feed page: %s", params.base)
        return []

    # most common case + websites like geo.de
    feed_urls = [
        link.get("href", "")
        for link in tree.xpath('//link[@rel="alternate"][@href]')
        # normalize the type attribute (e.g. "application/rss+xml; charset=UTF-8")
        if link.get("type", "").split(";")[0].strip().lower() in FEED_TYPES or LINK_VALIDATION_RE.search(link.get("href", ""))
    ]

    # backup
    if not feed_urls:
        feed_urls = [
            link.get("href", "") for link in tree.xpath("//a[@href]") if LINK_VALIDATION_RE.search(link.get("href", ""))
        ]

    # refine
    output_urls = []
    for link in dict.fromkeys(feed_urls):
        link = safe_relative_url(params.base, link)
        link = clean_url(link)
        if link and link != params.ref and is_valid_url(link) and not BLACKLIST.search(link):
            output_urls.append(link)

    # log result
    LOGGER.debug("Feed URLs found: %s of which %s valid", len(feed_urls), len(output_urls))
    return output_urls


def probe_gnews(params: FeedParameters, urlfilter: str | None, config: ConfigParser = DEFAULT_CONFIG) -> list[str]:
    "Alternative way to gather feed links: Google News."
    if params.lang:
        downloaded = fetch_url(
            f"https://news.google.com/rss/search?q=site:{params.domain}&hl={params.lang}&scoring=n&num=100",
            config=config,
        )
        if downloaded:
            feed_links = extract_links(downloaded, params)
            feed_links = filter_urls(feed_links, urlfilter)
            LOGGER.debug("%s Google news links found for %s", len(feed_links), params.domain)
            return feed_links
    return []


def find_feed_urls(
    url: str,
    target_lang: str | None = None,
    external: bool = False,
    sleep_time: float = 2.0,
    config: ConfigParser = DEFAULT_CONFIG,
) -> list[str]:
    """Try to find feed URLs.

    Args:
        url: Webpage or feed URL as string.
             Triggers URL-based filter if the webpage isn't a homepage.
        target_lang: Define a language to filter URLs based on heuristics
                     (two-letter string, ISO 639-1 format).
        external: Similar hosts only or external URLs
                  (boolean, defaults to False).
        sleep_time: Wait between requests on the same website.
        config: Pass configuration values for download control.

    Returns:
        The extracted links as a list (sorted list of unique links).

    """
    domain, baseurl = get_hostinfo(url)
    if domain is None:
        LOGGER.warning("Invalid URL: %s", url)
        return []

    params = FeedParameters(baseurl, domain, url, external, target_lang)
    urlfilter = None
    downloaded = fetch_url(url, config=config)

    if downloaded is not None:
        # assume it's a feed
        feed_links = extract_links(downloaded, params)
        if not feed_links:
            # assume it's a web page
            for i, feed in enumerate(determine_feed(downloaded, params)[:MAX_FEEDS_CHECKED]):
                if i:
                    sleep(sleep_time)
                feed_string = fetch_url(feed, config=config)
                if feed_string:
                    feed_links.extend(extract_links(feed_string, params))
            # filter triggered, prepare it
            if len(url) > len(baseurl) + 2:
                urlfilter = url
        # return links found
        if feed_links:
            feed_links = filter_urls(feed_links, urlfilter)
            LOGGER.debug("%s feed links found for %s", len(feed_links), domain)
            return feed_links
        LOGGER.debug("No usable feed links found: %s", url)
    else:
        LOGGER.error("Could not download web page: %s", url)
        if url.strip("/") != baseurl:
            sleep(sleep_time)
            return try_homepage(baseurl, target_lang, external, sleep_time, config)

    return probe_gnews(params, urlfilter, config)


```

### Core Architecture Module: `trafilatura/htmlprocessing.py`
```
# pylint:disable-msg=C0301,E0611,I1101
"""
Functions to process nodes in HTML code.
"""

import logging
from copy import deepcopy

from lxml.etree import Element, SubElement, XPath, _Element, strip_tags, tostring
from lxml.html import HtmlElement

from .deduplication import duplicate_test
from .settings import (
    CUT_EMPTY_ELEMS,
    MANUALLY_CLEANED,
    MANUALLY_STRIPPED,
    Document,
    Extractor,
)
from .utils import LINK_FARM_RATIO, image_src, safe_base_url, safe_relative_url, textfilter, trim
from .xml import delete_element, meta_items, separates_inline

LOGGER = logging.getLogger(__name__)

REND_TAG_MAPPING = {
    **dict.fromkeys(("em", "i"), "#i"),
    **dict.fromkeys(("b", "strong"), "#b"),
    "u": "#u",
    **dict.fromkeys(("kbd", "samp", "tt", "var"), "#t"),
    "sub": "#sub",
    "sup": "#sup",
}

HTML_TAG_MAPPING = {v: k for k, v in REND_TAG_MAPPING.items()}

PRESERVE_IMG_CLEANING = {"figure", "picture", "source"}

CODE_INDICATORS = ["{", '("', "('", "\n    "]

# LaTeX source carried by MathML, in order of preference: the annotation holds the
# original markup, alttext a rendering of it. local-name() also matches XHTML pages
# where the subtree keeps its MathML namespace.
TEX_ANNOTATION_XPATH = XPath('.//*[local-name()="annotation"][@encoding="application/x-tex"]')


def recover_math(tree: HtmlElement) -> HtmlElement:
    "Turn MathML into its LaTeX source so formulas survive the cleaning of <math>."
    for element in tree.iter("math"):
        annotation = TEX_ANNOTATION_XPATH(element)
        latex = trim(annotation[0].text or "") if annotation else trim(element.get("alttext") or "")
        if not latex:
            continue
        # delimiters the Markdown converter understands, see _convert_math()
        opening, closing = ("\\[", "\\]") if element.get("display") == "block" else ("\\(", "\\)")
        # the tail is kept when the element is deleted further down, the subtree is not
        element.tail = f"{opening}{latex}{closing}{element.tail or ''}"
    return tree


def _handle_forms(tree: HtmlElement) -> None:
    """Delete <form> elements, keeping those that wrap the page's main content.

    Frameworks like ASP.NET WebForms put the whole document inside a single
    <form id="aspnetForm">, so dropping every form leaves nothing to extract.
    A form holding most of the remaining text is such a layout wrapper and gets
    demoted to a plain container; genuine widgets (search, login, newsletter)
    hold little text and are still removed.
    """
    forms = list(tree.iter("form"))
    if not forms:
        return
    # run after the other elements are gone, so script/head text cannot skew the ratio
    total = len(tree.text_content())
    for form in forms:
        if total and len(form.text_content()) > total / 2:
            form.tag = "div"
        else:
            delete_element(form)


def tree_cleaning(tree: HtmlElement, options: Extractor) -> HtmlElement:
    "Prune the tree by discarding unwanted elements."
    # salvage formulas before <math> is discarded along with its subtree
    recover_math(tree)
    # determine cleaning strategy, use lists to keep it deterministic
    cleaning_list, stripping_list = MANUALLY_CLEANED.copy(), MANUALLY_STRIPPED.copy()
    # forms are handled separately below, once the rest of the noise is gone. MANUALLY_CLEANED is
    # public API users mutate in place, so honour a removed "form" instead of assuming it is there.
    clean_forms = "form" in cleaning_list
    if clean_forms:
        cleaning_list.remove("form")
    if not options.tables:
        cleaning_list.extend(["table", "td", "th", "tr"])
    else:
        # figures holding a table (#301) and ARIA layout tables (role=presentation/none)
        for elem in tree.iter("figure", "table"):
            if elem.find(".//table") is not None if elem.tag == "figure" else elem.get("role") in ("presentation", "none"):
                elem.tag = "div"
    if options.images:
        # Many websites have <img> inside <figure> or <picture> or <source> tag
        cleaning_list = [e for e in cleaning_list if e not in PRESERVE_IMG_CLEANING]
        stripping_list.remove("img")

    # strip targeted elements
    strip_tags(tree, stripping_list)

    # recall: undo the deletions if they remove every paragraph (copy only if none can survive)
    tcopy = None
    if (
        options.focus == "recall"
        and tree.find(".//p") is not None
        and ("p" in cleaning_list or not any(next(p.iterancestors(cleaning_list), tree) is tree for p in tree.iter("p")))
    ):
        tcopy = deepcopy(tree)
    for expression in cleaning_list:
        for element in tree.iter(expression):
            delete_element(element)
    if tcopy is not None and tree.find(".//p") is None:
        tree = tcopy

    if clean_forms:
        _handle_forms(tree)

    return prune_html(tree, options.focus)


def prune_html(tree: HtmlElement, focus: str = "balanced") -> HtmlElement:
    "Delete selected empty elements to save space and processing time."
    tails = focus != "precision"
    for element in [e for e in tree.iterdescendants(CUT_EMPTY_ELEMS) if e.text is None and len(e) == 0]:
        delete_element(element, keep_tail=tails)
    return tree


def prune_unwanted_nodes(tree: HtmlElement, nodelist: list[XPath], with_backup: bool = False) -> HtmlElement:
    "Prune the HTML tree by removing unwanted sections."
    if with_backup:
        old_len = len(tree.text_content())
        backup = deepcopy(tree)

    for expression in nodelist:
        for subtree in expression(tree):
            delete_element(subtree)  # the tail text is preserved

    if with_backup:
        # todo: adjust for recall and precision settings
        if len(tree.text_content()) > old_len / 7:
            return tree
        # over-pruned: restore the backup in the document
        parent = tree.getparent()
        if parent is not None:
            parent.replace(tree, backup)
        return backup
    return tree


def collect_link_info(
    links_xpath: list[HtmlElement],
) -> tuple[int, int, int, list[str]]:
    "Collect heuristics on link text"
    mylist = [e for e in (trim(elem.text_content()) for elem in links_xpath) if e]
    lengths = list(map(len, mylist))
    # longer strings impact recall in favor of precision
    shortelems = sum(1 for length in lengths if length < 10)
    return sum(lengths), len(mylist), shortelems, mylist


def is_paragraph_listing(links_xpath: list[HtmlElement]) -> bool:
    "Tell a document listing (every link alone in its paragraph) from a farm (links running together)"
    for link in links_xpath:
        parent = link.getparent()
        if parent is None or parent.tag != "p" or len(parent.findall(".//ref")) > 1:
            return False
    return True


def link_density_test(element: HtmlElement, favor_precision: bool = False) -> tuple[bool, bool]:
    "Remove sections which are rich in links (probably boilerplate), flag short linked ones."
    links_xpath = element.findall(".//ref")
    if not links_xpath:
        return False, False
    # preserve image containers
    if element.find(".//graphic") is not None:
        return False, False
    text = trim(element.text_content())
    # shortcut
    if len(links_xpath) == 1:
        len_threshold = 10 if favor_precision else 100
        link_text = trim(links_xpath[0].text_content())
        if len(link_text) > len_threshold and len(link_text) > len(text) * 0.9:
            return True, False
    if element.tag == "p":
        limitlen = 60 if element.getnext() is None else 30
    elif element.getnext() is None:
        limitlen = 300
    else:
        limitlen = 100
    elemlen = len(text)
    if elemlen < limitlen:
        linklen, elemnum, shortelems, _ = collect_link_info(links_xpath)
        if elemnum == 0:
            return True, False
        LOGGER.debug(
            "list link text/total: %s/%s – short elems/total: %s/%s",
            linklen,
            elemlen,
            shortelems,
            elemnum,
        )
        return linklen > elemlen * 0.8 or (elemnum > 1 and shortelems / elemnum > 0.8), True
    # large near-total-link farms ("latest news" sidebars) at/above limitlen, which the size gate
    # above never tests (#584); small farms are already caught there at the plain 0.8 ratio.
    # >4: a farm is MANY links -- a handful of long sentence-links is editorial (knowtechie realworld test)
    if len(links_xpath) > 4:
        linklen, elemnum, _, _ = collect_link_info(links_xpath)
        # avg link len >= 100 => catalog/listing content (one link per card), not a farm: keep it
        if linklen > len(text) * LINK_FARM_RATIO and linklen < 100 * elemnum and not is_paragraph_listing(links_xpath):
            return True, False
    return False, False


def link_density_test_tables(element: HtmlElement) -> bool:
    "Remove tables which are rich in links (probably boilerplate)."
    links_xpath = element.findall(".//ref")

    if not links_xpath:
        return False

    elemlen = len(trim(element.text_content()))
    if elemlen < 200:
        return False

    # links with no text (e.g. icon/flag links wrapping images) yield linklen 0 -> not boilerplate
    linklen, _, _, _ = collect_link_info(links_xpath)
    LOGGER.debug("table link text: %s / total: %s", linklen, elemlen)
    return linklen > 0.8 * elemlen if elemlen < 1000 else linklen > 0.5 * elemlen


def delete_by_link_density(
    subtree: HtmlElement,
    tagname: str,
    backtracking: bool = False,
    favor_precision: bool = False,
) -> HtmlElement:
    """Determine the link density of elements with respect to their length,
    and remove the elements identified as boilerplate."""
    deletions = []
    len_threshold = 200 if favor_precision else 100
    depth_threshold = 1 if favor_precision else 3

    for elem in subtree.iter(tagname):
        result, short_with_links = link_density_test(elem, favor_precision)
        if result or (
            backtracking
          
```

### Core Architecture Module: `trafilatura/json_metadata.py`
```
"""
Functions needed to scrape metadata from JSON-LD format.
For reference, here is the list of all JSON-LD types: https://schema.org/docs/full.html
"""

import json
import logging
import re
from html import unescape
from re import Pattern
from typing import Any

from .settings import Document
from .utils import HTML_STRIP_TAGS, as_list, trim

LOGGER = logging.getLogger(__name__)


JSON_ARTICLE_SCHEMA = {
    "article",
    "backgroundnewsarticle",
    "blogposting",
    "medicalscholarlyarticle",
    "newsarticle",
    "opinionnewsarticle",
    "reportagenewsarticle",
    "scholarlyarticle",
    "socialmediaposting",
    "liveblogposting",
}
JSON_OGTYPE_SCHEMA = {
    "aboutpage",
    "checkoutpage",
    "collectionpage",
    "contactpage",
    "faqpage",
    "itempage",
    "medicalwebpage",
    "profilepage",
    "qapage",
    "realestatelisting",
    "searchresultspage",
    "webpage",
    "website",
    "article",
    "advertisercontentarticle",
    "newsarticle",
    "analysisnewsarticle",
    "askpublicnewsarticle",
    "backgroundnewsarticle",
    "opinionnewsarticle",
    "reportagenewsarticle",
    "reviewnewsarticle",
    "report",
    "satiricalarticle",
    "scholarlyarticle",
    "medicalscholarlyarticle",
    "socialmediaposting",
    "blogposting",
    "liveblogposting",
    "discussionforumposting",
    "techarticle",
    "blog",
    "jobposting",
}
JSON_PUBLISHER_SCHEMA = {"newsmediaorganization", "organization", "webpage", "website"}
JSON_SCHEMA_TYPES = JSON_ARTICLE_SCHEMA | JSON_OGTYPE_SCHEMA | JSON_PUBLISHER_SCHEMA | {"person"}
JSON_AUTHOR_1 = re.compile(r'"author":[^}[]+?"name?\\?": ?\\?"([^"\\]+)|"author"[^}[]+?"names?".+?"([^"]+)', re.DOTALL)
JSON_AUTHOR_2 = re.compile(r'"[Pp]erson"[^}]+?"names?".+?"([^"]+)', re.DOTALL)
JSON_AUTHOR_REMOVE = re.compile(
    r',?(?:"\w+":?[:|,\[])?{?"@type":"(?:[Ii]mageObject|[Oo]rganization|[Ww]eb[Pp]age)",[^}[]+}[\]|}]?'
)
JSON_PUBLISHER = re.compile(r'"publisher":[^}]+?"name?\\?": ?\\?"([^"\\]+)', re.DOTALL)
JSON_TYPE = re.compile(r'"@type"\s*:\s*"([^"]*)"', re.DOTALL)
JSON_CATEGORY = re.compile(r'"articleSection": ?"([^"\\]+)', re.DOTALL)
JSON_SCHEMA_ORG = re.compile(r"^https?://schema\.org", flags=re.IGNORECASE)
JSON_UNICODE_REPLACE = re.compile(r"\\u([0-9a-fA-F]{4})")

AUTHOR_ATTRS = ("givenName", "additionalName", "familyName")

JSON_NAME = re.compile(r'"@type":"[Aa]rticle", ?"name": ?"([^"\\]+)', re.DOTALL)
JSON_HEADLINE = re.compile(r'"headline": ?"([^"\\]+)', re.DOTALL)
JSON_SEQ = [('"name"', JSON_NAME), ('"headline"', JSON_HEADLINE)]

AUTHOR_PREFIX = re.compile(r"^([a-zäöüß]+(ed|t))? ?(written by|words by|words|by|von|from) ", flags=re.IGNORECASE)
AUTHOR_REMOVE_NUMBERS = re.compile(r"\d.+?$")
AUTHOR_TWITTER = re.compile(r"@[\w]+")
AUTHOR_REPLACE_JOIN = re.compile(r"[._+]")
AUTHOR_REMOVE_NICKNAME = re.compile(r'["‘({\[’\'][^"]+?[‘’"\')\]}]')
AUTHOR_REMOVE_SPECIAL = re.compile(r"[^\w]+$|[:()?*$#!%/<>{}~¿]")
AUTHOR_REMOVE_PREPOSITION = re.compile(r"\b\s+(am|on|for|at|in|to|from|of|via|with|—|-|–)\s+(.*)", flags=re.IGNORECASE)
AUTHOR_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
AUTHOR_SPLIT = re.compile(r"/|;|,|\||&|(?:^|\W)[ua]nd(?:$|\W)", flags=re.IGNORECASE)
AUTHOR_EMOJI_REMOVE = re.compile(
    "["
    "\U00002700-\U000027be"  # Dingbats
    "\U0001f600-\U0001f64f"  # Emoticons
    "\U00002600-\U000026ff"  # Miscellaneous Symbols
    "\U0001f300-\U0001f5ff"  # Miscellaneous Symbols And Pictographs
    "\U0001f900-\U0001f9ff"  # Supplemental Symbols and Pictographs
    "\U0001fa70-\U0001faff"  # Symbols and Pictographs Extended-A
    "\U0001f680-\U0001f6ff"  # Transport and Map Symbols
    "]+",
    flags=re.UNICODE,
)


def is_plausible_sitename(metadata: Document, candidate: Any, content_type: str | None = None) -> bool:
    """Determine if the candidate should be used as sitename."""
    if candidate and isinstance(candidate, str):
        if not metadata.sitename or (len(metadata.sitename) < len(candidate) and content_type != "webpage"):
            return True
        if metadata.sitename and metadata.sitename.startswith("http") and not candidate.startswith("http"):
            return True
    return False


def process_parent(parent: Any, metadata: Document) -> Document:
    "Find and extract selected metadata from JSON parts."
    content: dict[str, Any]
    for content in filter(None, parent):
        # publisher may be a bare string, not a dict
        publisher = content.get("publisher")
        if isinstance(publisher, dict) and is_plausible_sitename(metadata, publisher.get("name")):
            metadata.sitename = publisher["name"]

        if "@type" not in content or not content["@type"]:
            continue

        # Prefer the first recognized type, preserving order among recognized types.
        content_types = as_list(content["@type"])
        content_type = next(
            (
                schema_type
                for schema_type in content_types
                if isinstance(schema_type, str) and schema_type.lower() in JSON_SCHEMA_TYPES
            ),
            content_types[0],
        ).lower()

        # The "pagetype" should only be returned if the page is some kind of an article, category, website...
        if content_type in JSON_OGTYPE_SCHEMA and not metadata.pagetype:
            metadata.pagetype = normalize_json(content_type)

        if content_type in JSON_PUBLISHER_SCHEMA:
            candidate = content.get("name") or content.get("legalName") or content.get("alternateName")
            if is_plausible_sitename(metadata, candidate, content_type):
                metadata.sitename = candidate

        elif content_type == "person":
            if isinstance(content.get("name"), str) and not content["name"].startswith("http"):
                metadata.author = normalize_authors(metadata.author, content["name"])

        elif content_type in JSON_ARTICLE_SCHEMA:
            # author and person
            if "author" in content:
                list_authors = content["author"]
                if isinstance(list_authors, str):
                    # try to convert to json object
                    try:
                        list_authors = json.loads(list_authors)
                    except json.JSONDecodeError:
                        # it is a normal string
                        metadata.author = normalize_authors(metadata.author, list_authors)

                for author in as_list(list_authors):
                    if isinstance(author, str):
                        author = {"name": author}
                    if "@type" not in author or "Person" in as_list(author["@type"]):
                        author_name = None
                        # error thrown: author['name'] can be a list (?)
                        if "name" in author:
                            author_name = author.get("name")
                            if isinstance(author_name, list):
                                author_name = "; ".join(author_name).strip("; ")
                            elif isinstance(author_name, dict) and "name" in author_name:
                                author_name = author_name["name"]
                        elif "givenName" in author and "familyName" in author:
                            author_name = " ".join(author[x] for x in AUTHOR_ATTRS if x in author)
                        # additional check to prevent bugs
                        if isinstance(author_name, str):
                            metadata.author = normalize_authors(metadata.author, author_name)

            # category
            if not metadata.categories and "articleSection" in content:
                if isinstance(content["articleSection"], str):
                    metadata.categories = [content["articleSection"]]
                else:
                    metadata.categories = list(filter(None, content["articleSection"]))

            # try to extract title
            if not metadata.title:
                if "name" in content and content_type == "article":
                    metadata.title = content["name"]
                elif "headline" in content:
                    metadata.title = content["headline"]
    return metadata


def extract_json(schema: list[Any] | dict[str, str], metadata: Document) -> Document:
    """Parse and extract metadata from JSON-LD data.

    Note: baseline.py's `_walk_json` also walks JSON-LD, for page content rather than
    metadata, and is intentionally not shared with this function: this one flattens one
    level, gated per container, since metadata extraction should stay conservative, while
    `_walk_json` recurses unconditionally since content rescue is a last resort.
    """
    schema = as_list(schema)

    # collect content from every valid block, then process once (no short-circuit on a flat object)
    parents: list[Any] = []
    for parent in schema:
        context = parent.get("@context")

        if context and isinstance(context, str) and JSON_SCHEMA_ORG.match(context):
            if "@graph" in parent:
                parents.extend(as_list(parent["@graph"]))
            elif (
                "@type" in parent
                and isinstance(parent["@type"], str)
                and "liveblogposting" in parent["@type"].lower()
                and "liveBlogUpdate" in parent
            ):
                parents.extend(as_list(parent["liveBlogUpdate"]))
            else:
                parents.append(parent)

    return process_parent(parents, metadata)


def extract_json_author(elemtext: str, regular_expression: Pattern[str]) -> str | None:
    """Crudely extract author names from JSON-LD data"""
    authors = None
    mymatch = regular_expression.search(elemtext)
    while mymatch:
        # first matching group (JSON_AUTHOR_1 has two)
        name = next(filter(None, mymatch.groups()), None)
        if not name or " " not in name:
            break
        authors = normalize_authors(authors, name)
        elemtext = regular_expression.su
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

### Incident Patch 1: `94b8235e` (2026-10-02)
**Commit Message**: docs: link URL discovery tools from extraction guidance (#944)

* docs: explain link discovery before article extraction on listing pages

* docs: replace listing example with URL discovery references

---------

Co-authored-by: workstonedai-collab <[REDACTED_EMAIL]>

**File**: `docs/usage-python.rst` (modified, +11/-0)
```diff
@@ -48,6 +48,17 @@ Simpler alternatives (no cascade, faster):
 - ``html2txt``: Extracts all text in the document, including navigation and footers
 
 
+.. note::
+
+    For article lists or category pages, discover URLs with
+    `Courlan's link extraction <url-management.html#extracting-links-from-a-page>`_
+    or Trafilatura's `feeds`_, `sitemaps`_ and
+    `web crawler <crawls.html>`_, then extract each article separately.
+    ``include_links=True`` only keeps links in the extracted content; it is not
+    a link discovery function.
+
+
+
 Output
 ^^^^^^
 
```

---

### Incident Patch 2: `9123b5a4` (2026-10-02)
**Commit Message**: fix: add the record ID and fingerprint to the TXT/Markdown header (#947)

With with_metadata=True the TXT and Markdown header lists the id and
fingerprint fields, but both were only set for the other output formats,
so a record_id passed to extract() never reached the header. Set them
whenever the metadata is output.

**File**: `tests/unit_tests.py` (modified, +9/-1)
```diff
@@ -454,7 +454,15 @@ def test_formatting(options):
 
     meta_string = "<html><head><title>Test</title></head><body><p>ABC.</p></body></html>"
     meta_result = extract(meta_string, output_format="markdown", config=ZERO_CONFIG, with_metadata=True)
-    assert " ".join(meta_result.split()) == "--- title: Test --- ABC."
+    assert meta_result.startswith("---\ntitle: Test\nfingerprint: ")
+    assert meta_result.endswith("---\nABC.")
+    # the record ID and fingerprint are in the header, as in the other formats
+    json_result = json.loads(
+        extract(meta_string, output_format="json", config=ZERO_CONFIG, with_metadata=True, record_id="doc-1")
+    )
+    for fmt in ("markdown", "txt"):
+        meta_result = extract(meta_string, output_format=fmt, config=ZERO_CONFIG, with_metadata=True, record_id="doc-1")
+        assert f"\nfingerprint: {json_result['fingerprint']}\nid: doc-1\n" in meta_result
 
     # space between paragraphs
     my_document = html.fromstring(
```

**File**: `trafilatura/core.py` (modified, +2/-1)
```diff
@@ -704,7 +704,8 @@ def _internal_extraction(
     if not document or not isinstance(document, Document):
         return None
 
-    if options.format not in TXT_FORMATS:
+    # TXT formats only output the ID and fingerprint in their metadata header
+    if options.format not in TXT_FORMATS or options.with_metadata:
         # control output
         if options.format == "python":
             raise ValueError("'python' format only usable in bare_extraction() function")
```

---

### Incident Patch 3: `f0522a59` (2026-09-30)
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

### Incident Patch 4: `2e2de796` (2026-09-30)
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

### Incident Patch 5: `7afa9441` (2026-09-30)
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

### Incident Patch 6: `1e31e3e9` (2026-09-25)
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

**File**: `tests/cli_tests.py` (modified, +24/-6)
```diff
@@ -9,7 +9,6 @@
 import subprocess
 import sys
 from contextlib import redirect_stdout
-from datetime import datetime
 from os import path
 from tempfile import gettempdir
 from unittest.mock import patch
@@ -18,7 +17,7 @@
 from courlan import UrlStore
 
 from trafilatura import cli, cli_utils, settings, spider
-from trafilatura.downloads import add_to_compressed_dict, fetch_url
+from trafilatura.downloads import Response, add_to_compressed_dict, fetch_response, fetch_url
 from trafilatura.utils import LANGID_FLAG
 
 logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
@@ -334,12 +333,8 @@ def test_cli_pipeline():
     ]
     args = cli.parse_args(testargs[1:])
     assert args.blacklist is not None
-    # test backoff between domain requests
     url_store = add_to_compressed_dict(my_urls, args.blacklist, None, None)
-    reftime = datetime.now().astimezone()
     cli_utils.url_processing_pipeline(args, url_store)
-    delta = (datetime.now().astimezone() - reftime).total_seconds()
-    assert delta > 2
     # test blacklist and empty dict
     args.blacklist = cli_utils.load_blacklist(args.blacklist)
     assert len(args.blacklist) == 3
@@ -549,6 +544,29 @@ def test_crawling():
     assert len(f.getvalue().split("\n")) in (2, 6)
     spider.URL_STORE = UrlStore(compressed=False, strict=False)
 
+    # responses from an unregistered base (e.g. cross-host redirect) are skipped
+    spider.URL_STORE = UrlStore(compressed=False, strict=False)
+    start = fetch_response("https://httpbun.com/links/2/2")
+    extra = [
+        ("https://stray.example/", Response(b"<html><body><a href='/x'>x</a></body></html>", 200, "https://stray.example/")),
+        (start.url, start),
+    ]
+    real_downloads = cli_utils.buffered_response_downloads
+
+    def with_stray(bufferlist, threads, options=None):
+        while extra:
+            yield extra.pop()
+        yield from real_downloads(bufferlist, threads, options=options)
+
+    args = cli.parse_args(["--crawl", "https://httpbun.com/links/2/2", "--list"])
+    with patch.object(cli_utils, "buffered_response_downloads", with_stray), redirect_stdout(io.StringIO()):
+        with patch.object(cli_utils.LOGGER, "warning") as mock_warning:
+            cli_utils.cli_crawler(args)
+    mock_warning.assert_called_once_with("no crawl parameters for %s", "https://stray.example/")
+    assert "https://httpbun.com/links/2/0" in spider.URL_STORE.find_known_urls("https://httpbun.com")
+    assert not spider.URL_STORE.find_known_urls("https://stray.example")
+    spider.URL_STORE = UrlStore(compressed=False, strict=False)
+
     # Exploration (Sitemap + Crawl)
     testargs = ["", "--explore", "https://httpbun.com/html", "--list"]
     args = cli.parse_args(testargs[1:])
```

**File**: `tests/conftest.py` (modified, +36/-3)
```diff
@@ -1,11 +1,13 @@
 """Canned-response fixture: opt in per module with
-`pytestmark = pytest.mark.usefixtures("mock_network")`."""
+`pytestmark = pytest.mark.usefixtures("mock_network")`.
+Politeness delays are disabled suite-wide."""
 
 from pathlib import Path
 
 import pytest
 
 import trafilatura.downloads as dl
+from trafilatura import feeds, settings, sitemaps, spider
 from trafilatura.downloads import Response
 
 RESOURCES_DIR = Path(__file__).parent / "resources"
@@ -46,6 +48,23 @@ def _resource(name):
         b'<feed xmlns="http://www.w3.org/2005/Atom"><title>Blog feed</title>'
         b'<entry><link href="https://example.com/blog/post-1"/></entry></feed>'
     ),
+    # two candidate feeds
+    "https://multi.example.com/": (
+        b"<html><head><title>Multi</title>"
+        b'<link rel="alternate" type="application/rss+xml" href="https://multi.example.com/feed1.xml"/>'
+        b'<link rel="alternate" type="application/atom+xml" href="https://multi.example.com/feed2.xml"/>'
+        b"</head><body><p>posts</p></body></html>"
+    ),
+    "https://multi.example.com/feed1.xml": (
+        b'<?xml version="1.0" encoding="utf-8"?>'
+        b'<feed xmlns="http://www.w3.org/2005/Atom"><title>First feed</title>'
+        b'<entry><link href="https://multi.example.com/post-1"/></entry></feed>'
+    ),
+    "https://multi.example.com/feed2.xml": (
+        b'<?xml version="1.0" encoding="utf-8"?>'
+        b'<feed xmlns="http://www.w3.org/2005/Atom"><title>Second feed</title>'
+        b'<entry><link href="https://multi.example.com/post-2"/></entry></feed>'
+    ),
     # a plain page with no feeds at all (exercises the "no usable feed links" path)
     "https://example.com/plain": b"<html><head><title>Plain</title></head><body><p>nothing</p></body></html>",
     # Google News fallback feed
@@ -62,15 +81,15 @@ def _resource(name):
 }
 
 
-def _fake_send(url, no_ssl, with_headers, config):
+def _fake_send(url, no_ssl, config):
     canned = CANNED_RESPONSES.get(url)
     if canned is None:
         return None
     data, final_url = canned if isinstance(canned, tuple) else (canned, url)
     return Response(data, 200, final_url)
 
 
-def _fake_is_live(url):
+def _fake_is_live(url, config=None):
     return any(known.startswith(url.rstrip("/")) for known in CANNED_RESPONSES)
 
 
@@ -80,3 +99,17 @@ def mock_network(monkeypatch):
     monkeypatch.setattr(dl, "_send_pycurl_request", _fake_send)
     monkeypatch.setattr(dl, "_urllib3_is_live_page", _fake_is_live)
     monkeypatch.setattr(dl, "_pycurl_is_live_page", _fake_is_live)
+
+
+def _zero_sleep(config):
+    config.set("DEFAULT", "SLEEP_TIME", "0")
+    return config
+
+
+@pytest.fixture(autouse=True)
+def no_politeness_delay(monkeypatch):
+    "Politeness waits only slow the suite down."
+    for module in (feeds, sitemaps, spider):
+        monkeypatch.setattr(module, "sleep", lambda s: None)
+    use_config = settings.use_config
+    monkeypatch.setattr(settings, "use_config", lambda filename=None: _zero_sleep(use_config(filename)))
```

**File**: `tests/downloads_tests.py` (modified, +351/-41)
```diff
@@ -17,19 +17,25 @@
     HAS_BROTLI = False
 
 try:
-    import zstandard
+    if sys.version_info >= (3, 14):
+        from compression import zstd
+    else:
+        from backports import zstd
 
     HAS_ZSTD = True
 except ImportError:
     HAS_ZSTD = False
 
+from configparser import ConfigParser
+from pathlib import Path
 from time import sleep
 from unittest.mock import MagicMock, patch
 
 import pytest
 from courlan import UrlStore
 
 import trafilatura.downloads as dl
+from trafilatura import utils
 from trafilatura.cli import parse_args
 from trafilatura.cli_utils import download_queue_processing, url_processing_pipeline
 from trafilatura.core import Extractor, extract
@@ -41,7 +47,7 @@
     _determine_headers,
     _initiate_pool,
     _is_suitable_response,
-    _parse_config,
+    _parse_curl_headers,
     _pycurl_is_live_page,
     _send_pycurl_request,
     _send_urllib_request,
@@ -52,11 +58,12 @@
     load_download_buffer,
 )
 from trafilatura.settings import DEFAULT_CONFIG, args_to_extractor, use_config
-from trafilatura.utils import decode_file, handle_compressed_file, load_html
+from trafilatura.utils import MAX_MEMBERS, decode_file, handle_compressed_file, load_html
 
 logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
 
-ZERO_CONFIG = DEFAULT_CONFIG
+# independent copy: must not mutate the session-wide DEFAULT_CONFIG
+ZERO_CONFIG = use_config()
 ZERO_CONFIG["DEFAULT"]["MIN_OUTPUT_SIZE"] = "0"
 ZERO_CONFIG["DEFAULT"]["MIN_EXTRACTED_SIZE"] = "0"
 
@@ -73,12 +80,12 @@ def _reset_downloads_global_objects():
     dl.PROXY_URL = None
     dl.HTTP_POOL = None
     dl.NO_CERT_POOL = None
-    dl.RETRY_STRATEGY = None
 
 
 @pytest.fixture(autouse=True)
 def _reset_downloads_globals():
-    "Reset cached download globals (pools, retry strategy) after every test."
+    "Reset cached download globals (pools, proxy) before and after every test."
+    _reset_downloads_global_objects()
     yield
     _reset_downloads_global_objects()
 
@@ -89,7 +96,7 @@ def test_urllib_request_releases_conn_on_oversize():
     resp.stream.return_value = iter([b"x" * (2**17)] * 1000)  # exceeds MAX_FILE_SIZE → ValueError mid-stream
     pool = MagicMock(request=MagicMock(return_value=resp))
     with patch.object(dl, "_initiate_pool", return_value=pool):
-        assert _send_urllib_request("https://example.org", False, False, DEFAULT_CONFIG) is None
+        assert _send_urllib_request("https://example.org", False, DEFAULT_CONFIG) is None
     resp.release_conn.assert_called_once()
 
 
@@ -110,7 +117,7 @@ def test_urllib_request_resolves_relative_url(geturl_result, expected):
     resp.geturl.return_value = geturl_result
     pool = MagicMock(request=MagicMock(return_value=resp))
     with patch.object(dl, "_initiate_pool", return_value=pool):
-        result = _send_urllib_request("https://example.org/news/news", False, False, DEFAULT_CONFIG)
+        result = _send_urllib_request("https://example.org/news/news", False, DEFAULT_CONFIG)
     assert result.url == expected
 
 
@@ -160,7 +167,7 @@ def test_is_live_page():
 def test_fetch():
     """Test URL fetching."""
     # sanity check
-    assert _send_urllib_request("", True, False, DEFAULT_CONFIG) is None
+    assert _send_urllib_request("", True, DEFAULT_CONFIG) is None
 
     # fetch_url
     assert fetch_url("#@1234") is None
@@ -169,12 +176,12 @@ def test_fetch():
     # no SSL, no decoding
     url = "https://httpbun.com/status/200"
     for no_ssl in (True, False):
-        response = _send_urllib_request(url, no_ssl, True, DEFAULT_CONFIG)
+        response = _send_urllib_request(url, no_ssl, DEFAULT_CONFIG)
         assert b"200" in response.data
         assert b"OK" in response.data
         assert response.headers["x-powered-by"].startswith("httpbun")
     if HAS_PYCURL:
-        response1 = _send_pycurl_request(url, True, True, DEFAULT_CONFIG)
+        response1 = _send_pycurl_request(url, True, DEFAULT_CONFIG)
         assert response1.headers["x-powered-by"].startswith("httpbun")
         assert _is_suitable_response(url, response1, DEFAULT_OPTS) is True
         assert _is_suitable_response(url, response, DEFAULT_OPTS) is True
@@ -186,33 +193,142 @@ def test_fetch():
     new_config = use_config()  # get a new config instance to avoid mutating the default one
     # patch max directs: limit to 0. We won't fetch any page as a result
     new_config.set("DEFAULT", "MAX_REDIRECTS", "0")
-    _reset_downloads_global_objects()  # force Retry strategy and PoolManager to be recreated with the new config value
     res = fetch_url("https://httpbun.com/redirect/1", config=new_config)
     assert res is None
     # also test max redir implementation on pycurl if available
     if HAS_PYCURL:
-        assert _send_pycurl_request("https://httpbun.com/redirect/1", True, False, new_config) is None
+        assert _send_pycurl_request("https://httpbun.com/redirect/1", True, new_config) is None
 
     # test timeout
     new_config.set("DEFAULT", "DOWNLOA
```

---

### Incident Patch 7: `9c99a932` (2026-09-25)
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

### Incident Patch 8: `07fe0d64` (2026-09-25)
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

### Incident Patch 9: `13f8711b` (2026-09-25)
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

### Incident Patch 10: `7a6bf76c` (2026-09-25)
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

### Incident Patch 11: `590a8f3f` (2026-09-25)
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

### Incident Patch 12: `c852cae9` (2026-09-21)
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
+def test_json_node_type_arrays(node_type, author, pagetype, sitename):
+    "Recognize supported node types without changing precedence among known types."
+    schema = {
+        "@context": "https://schema.org",
+        "@type": node_type,
+        "name": "Example Name",
+        "author": {"@type": "Person", "name": "Nested Author"},
+    }
+    metadata = extract_metadata(f'<html><head><script type="application/ld+json">{json.dumps(schema)}</script></head></html>')
+    assert metadata is not None
+    assert (metadata.author, metadata.pagetype, metadata.sitename) == (author, pagetype, sitename)
+
+
 def test_extract_json_processes_list_once():
     "A flat list of @context objects is processed once, not once per item."
     import trafilatura.json_metadata as jm
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

---

### Incident Patch 13: `33805cf9` (2026-09-21)
**Commit Message**: fix: resolve sitemap locations by XML namespace (#926)

* Resolve sitemap locations by XML namespace

* Cover malformed XML and missing-root sitemap input

Exercises both parser failure exits with real XML inputs. The 23 sitemap tests pass and cover the new error-handling lines; this test-only follow-up has no user-documentation impact.

**File**: `docs/tutorial-corpus.rst` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@ In order to gather web documents it can be useful to download the portions of a
 
 A comprehensive overview of the available documents can be obtained faster and more efficiently using sitemaps and feeds than by systematically crawling. These formats are machine-readable and can reveal content that may not be reachable through the browsable interface. However, link inspection and filtering prior to download is recommended to avoid undesired content — see `link filtering`_ below.
 
+XML sitemap locations are resolved by namespace, so default and prefixed sitemap namespaces are supported. Location tags in extension namespaces (such as image sitemaps) are ignored. Legacy XML without a namespace is also supported.
+
 In addition, Trafilatura supports multilingual and multinational sitemaps, for example when a site targets different languages through paths like ``/en/…`` and ``/de/…``.
 
 .. hint::
```

**File**: `tests/sitemaps_tests.py` (modified, +70/-0)
```diff
@@ -220,3 +220,73 @@ def test_whole():
     trafilatura.settings.MAX_SITEMAPS_SEEN = 1
     results = sitemaps.sitemap_search("https://www.sitemaps.org", target_lang="de")
     assert len(results) == 8
+
+
+@pytest.mark.parametrize("prefix", ["", "sm:", "site-map:"])
+@pytest.mark.parametrize("declaration", ["", '<?xml version="1.0" encoding="UTF-8"?>'])
+@pytest.mark.parametrize("index", [False, True])
+def test_sitemap_namespaces(prefix, declaration, index):
+    """Namespace prefixes do not change page or nested sitemap discovery."""
+    root, child = ("sitemapindex", "sitemap") if index else ("urlset", "url")
+    namespace = f'xmlns{":" + prefix[:-1] if prefix else ""}="http://www.sitemaps.org/schemas/sitemap/0.9"'
+    url = "https://example.org/nested.xml" if index else "https://example.org/page"
+    sitemap = sitemaps.SitemapObject("https://example.org", "example.org", [])
+    sitemap.current_url = "https://example.org/sitemap.xml"
+    sitemap.content = (
+        f"{declaration}<{prefix}{root} {namespace}>"
+        f"<{prefix}{child}><{prefix}loc><![CDATA[{url}]]></{prefix}loc></{prefix}{child}>"
+        f"</{prefix}{root}>"
+    )
+    sitemap.process()
+    assert (sitemap.sitemap_urls, sitemap.urls) == (([url], []) if index else ([], [url]))
+
+
+def test_sitemap_namespace_scope():
+    """Ignore extension locations even when a prefix is rebound locally."""
+    sitemap = sitemaps.SitemapObject("https://example.org", "example.org", [])
+    sitemap.current_url = "https://example.org/sitemap.xml"
+    sitemap.content = (
+        '<s:urlset xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="urn:image">'
+        "<s:url><s:loc>https://example.org/page</s:loc>"
+        "<image:loc>https://example.org/image</image:loc>"
+        '<s:loc xmlns:s="urn:other">https://example.org/other</s:loc>'
+        "</s:url></s:urlset>"
+    )
+    sitemap.process()
+    assert sitemap.urls == ["https://example.org/page"]
+
+
+@pytest.mark.parametrize("location", ["&external;", "https://example.org/&external;", "https://example.org/<nested/>"])
+def test_sitemap_locations_do_not_expand_entities(location):
+    """Location extraction does not resolve entities or concatenate child markup."""
+    sitemap = sitemaps.SitemapObject("https://example.org", "example.org", [])
+    sitemap.content = (
+        '<!DOCTYPE urlset [<!ENTITY external SYSTEM "file:///not-a-sitemap-resource">]>'
+        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
+        f"<url><loc>{location}</loc></url></urlset>"
+    )
+    sitemap.extract_sitemap_links()
+    assert not sitemap.urls
+
+
+def test_sitemap_namespace_link_limit(monkeypatch):
+    """Namespaced extraction keeps the existing maximum-location bound."""
+    monkeypatch.setattr(sitemaps, "MAX_LINKS", 1)
+    sitemap = sitemaps.SitemapObject("https://example.org", "example.org", [])
+    sitemap.content = (
+        '<s:urlset xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">'
+        "<s:url><s:loc>https://example.org/first?a=1&amp;b=2</s:loc></s:url>"
+        "<s:url><s:loc>https://example.org/second</s:loc></s:url></s:urlset>"
+    )
+    sitemap.extract_sitemap_links()
+    assert sitemap.urls == ["https://example.org/first?a=1&b=2"]
+
+
+@pytest.mark.parametrize("content", ["", "not an XML document"])
+def test_sitemap_xml_without_a_root_is_ignored(content):
+    """Malformed input cannot yield a sitemap location."""
+    sitemap = sitemaps.SitemapObject("https://example.org", "example.org", [])
+    sitemap.content = content
+    sitemap.extract_sitemap_links()
+    assert sitemap.urls == []
+    assert sitemap.sitemap_urls == []
```

**File**: `trafilatura/sitemaps.py` (modified, +15/-4)
```diff
@@ -17,21 +17,22 @@
     get_hostinfo,
     lang_filter,
 )
+from lxml import etree
 
 from .deduplication import is_similar_domain
 from .downloads import fetch_url, is_live_page
 from .settings import MAX_LINKS, MAX_SITEMAPS_SEEN
 
 LOGGER = logging.getLogger(__name__)
 
-LINK_REGEX = re.compile(r"<loc>(?:<!\[CDATA\[)?(http.+?)(?:\]\]>)?</loc>")
+SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"
 XHTML_REGEX = re.compile(r"<xhtml:link.+?>", re.DOTALL)
 HREFLANG_REGEX = re.compile(r'href=["\'](.+?)["\']')
 WHITELISTED_PLATFORMS = re.compile(
     r"(?:blogger|blogpost|ghost|hubspot|livejournal|medium|typepad|squarespace|tumblr|weebly|wix|wordpress)\."
 )
 
-SITEMAP_FORMAT = re.compile(r"^.{0,5}<\?xml|<sitemap|<urlset")
+SITEMAP_FORMAT = re.compile(r"^.{0,5}<\?xml|<(?:[\w.-]+:)?(?:sitemapindex|sitemap|urlset)\b")
 DETECT_SITEMAP_LINK = re.compile(r"\.xml(\..{2,4})?$|\.xml[?#]")
 DETECT_LINKS = re.compile(r'https?://[^\s<"]+')
 SCRUB_REGEX = re.compile(r"\?.*$|#.*$")
@@ -141,8 +142,18 @@ def handle_lang_link(attrs: str) -> None:
         self.extract_links(XHTML_REGEX, 0, handle_lang_link)
 
     def extract_sitemap_links(self) -> None:
-        "Extract sitemap links and web page links from a sitemap file."
-        self.extract_links(LINK_REGEX, 1, self.handle_link)  # process middle part of the match tuple
+        "Extract locations in the sitemap namespace (or legacy unnamespaced XML)."
+        parser = etree.XMLParser(encoding="utf-8", resolve_entities=False, no_network=True, recover=True)
+        try:
+            tree = etree.fromstring(self.content.encode("utf-8"), parser)
+        except etree.XMLSyntaxError:
+            return
+        if tree is None:
+            return
+        for element in islice(tree.iter("loc", f"{{{SITEMAP_NAMESPACE}}}loc"), MAX_LINKS):
+            # Entity references and nested markup are not part of a location URL.
+            if len(element) == 0 and element.text and element.text.startswith("http"):
+                self.handle_link(element.text)
 
     def process(self) -> None:
         "Download a sitemap and extract the links it contains."
```

---

### Incident Patch 14: `eb04027c` (2026-09-11)
**Commit Message**: fix: preserve inline links in text-bearing divs (#927)

**File**: `tests/unit_tests.py` (modified, +63/-0)
```diff
@@ -36,6 +36,7 @@
 )
 from trafilatura.meta import reset_caches
 from trafilatura.metadata import Document
+from trafilatura.readability_lxml import Document as ReadabilityDocument
 from trafilatura.readability_lxml import is_probably_readerable
 from trafilatura.settings import TAG_CATALOG, use_config
 from trafilatura.utils import (
@@ -1372,6 +1373,68 @@ def test_htmlprocessing(options):
     assert " tail" in hi.text
 
 
+@pytest.mark.parametrize(
+    "link",
+    ['<a href="https://example.org/plots">three plots</a>', '<a href="https://example.org/plots"><b>three plots</b></a>'],
+)
+def test_readability_div_keeps_inline_link(link):
+    "An inline anchor must not split a div's sentence into separate paragraphs (#585)."
+    sentence = f"The garden team measured {link} before planting the seeds."
+    tree = html.fromstring(f"<html><body><div>{sentence}</div></body></html>")
+    ReadabilityDocument(tree).transform_misused_divs_into_paragraphs()
+    paragraph = tree.find(".//body/p")
+    assert paragraph is not None
+    assert paragraph.text_content() == "The garden team measured three plots before planting the seeds."
+    assert paragraph.find("a").get("href") == "https://example.org/plots"
+    assert paragraph.find("p") is None
+
+
+@pytest.mark.parametrize("block", ["div", "p", "blockquote", "article", "aside", "address"])
+def test_readability_div_keeps_linked_blocks(block):
+    "A link wrapping a block still prevents conversion of its containing div to a paragraph."
+    tree = html.fromstring(
+        f'<html><body><div><a href="https://example.org/plots"><{block}>Plot measurements</{block}></a></div></body></html>'
+    )
+    ReadabilityDocument(tree).transform_misused_divs_into_paragraphs()
+    assert tree.find(".//body/div/a") is not None
+
+
+@pytest.mark.parametrize(
+    "content",
+    [
+        '<a href="https://example.org/plots">Plot measurements</a>',
+        '<span>Garden plan</span><span><a href="https://example.org/plots">Plot measurements</a></span>',
+    ],
+)
+def test_readability_div_keeps_link_wrappers(content):
+    "Containers without loose text retain their existing role in Readability's scoring."
+    tree = html.fromstring(f"<html><body><div>{content}</div></body></html>")
+    ReadabilityDocument(tree).transform_misused_divs_into_paragraphs()
+    assert tree.find(".//body/div") is not None
+
+
+def test_extract_div_keeps_inline_link():
+    "Exercise the Readability fallback with default size thresholds and self-created HTML."
+    following = (
+        " before planting the seeds. They recorded the width of each plot, checked the soil, "
+        "and marked every corner with a wooden stake. The measurements will help the volunteers "
+        "leave enough space between rows when they return to plant beans next week."
+    )
+    document = (
+        '<html><body><div>The garden team measured <a href="https://example.org/plots">three plots</a>'
+        f"{following}</div></body></html>"
+    )
+    assert extract(document, output_format="markdown", include_links=True, config=use_config()) == (
+        f"The garden team measured [three plots](https://example.org/plots){following}"
+    )
+    result = etree.fromstring(extract(document, output_format="xml", include_links=True, config=use_config()))
+    link = result.find(".//ref")
+    assert link is not None
+    assert link.getparent().tag == "p"
+    assert link.getparent().text == "The garden team measured "
+    assert link.tail == following
+
+
 def test_extraction_options():
     """Test the different parameters available in extract() and bare_extraction()"""
     my_html = '<html><head><meta http-equiv="content-language" content="EN"/></head><body><div="article-body"><p>Text.<!-- comment --><?php echo "This is a PHP processing instruction"; ?></p></div></body></html>'
```

**File**: `trafilatura/readability_lxml.py` (modified, +7/-2)
```diff
@@ -60,7 +60,8 @@ def _tostring(string: HtmlElement) -> str:
         r"button|combx|comment|com-|contact|figure|foot|footer|footnote|form|input|masthead|media|meta|outbrain|promo|related|scroll|shoutbox|sidebar|sponsor|shopping|tags|tool|widget",
         re.IGNORECASE,
     ),
-    "divToPElementsRe": re.compile(r"<(?:a|blockquote|dl|div|img|ol|p|pre|table|ul)", re.IGNORECASE),
+    # Anchors are inline; their block descendants still prevent paragraph conversion.
+    "divToPElementsRe": re.compile(r"<(?:address|article|aside|audio|blockquote|dl|div|img|ol|p|pre|table|ul)", re.IGNORECASE),
     "videoRe": re.compile(r"https?:\/\/(?:www\.)?(?:youtube|vimeo)\.com", re.IGNORECASE),
 }
 
@@ -273,7 +274,11 @@ def transform_misused_divs_into_paragraphs(self) -> None:
             # buried within an <a> for example
             # hurts precision:
             # if not any(e.tag in DIV_TO_P_ELEMS for e in list(elem)):
-            if not REGEXES["divToPElementsRe"].search("".join(map(_tostring, list(elem)))):
+            # Keep link wrappers' scoring unchanged; only join anchors into paragraphs
+            # when the div has loose text that would otherwise be split around them.
+            if not REGEXES["divToPElementsRe"].search("".join(map(_tostring, list(elem)))) and (
+                elem.find(".//a") is None or elem.xpath("text()[normalize-space()]")
+            ):
                 elem.tag = "p"
 
         for elem in self.doc.findall(".//div"):
```

---

### Incident Patch 15: `bf4194f6` (2026-09-11)
**Commit Message**: fix: drop Al Jazeera "Recommended Stories" widget from the text (#929)

The "more-on" section (heading "Recommended Stories" plus a linked article
list) sits between body paragraphs and was not covered by any existing
discard token, so its heading and list items leaked into the extracted text.
Added "more-on" to _RELATED_CLASS_TOKENS.

Co-authored-by: Christiaan van Luik <[REDACTED_EMAIL]>
Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `tests/realworld_tests.py` (modified, +9/-0)
```diff
@@ -41,6 +41,7 @@
     "https://kulu-media.com/meta-outage-hits-facebook-instagram-and-messenger/": "kulu-media.com.meta-outage.html",
     "https://www.infobae.com/colombia/2026/08/24/terremoto-sacudio-el-bolsillo-de-los-colombianos-el-consumo-cayo-89-tras-el-fuerte-sismo-del-10-de-agosto/": "infobae.com.terremoto.html",
     "https://www.eluniverso.com/noticias/seguridad/kenia-brindara-apoyo-para-repatriar-restos-de-michele-sensi-contugi-y-su-esposa-tras-accidente-de-helicoptero-nota/": "eluniverso.com.repatriar.html",
+    "https://www.aljazeera.com/news/2026/6/11/thousands-of-malawians-flee-homes-in-south-africa-amid-xenophobic-threats": "aljazeera.com.malawians.html",
     "http://www.rs-ingenieure.de/de/hochbau/leistungen/tragwerksplanung": "rs-ingenieure.de.tragwerksplanung.html",
     "http://www.simplyscience.ch/teens-liesnach-archiv/articles/wie-entsteht-erdoel.html": "simplyscience.ch.erdoel.html",
     "http://www.shingon-reiki.de/reiki-und-schamanismus/": "shingon-reiki.de.schamanismus.html",
@@ -381,6 +382,14 @@ def test_extract(xmloutput, formatting):
     assert "Kenia facilitará el apoyo necesario" in result
     assert "Publicidad" not in result
 
+    # "Recommended Stories" widget ("more-on" section) interleaved between article paragraphs
+    result = do_load_page(
+        "https://www.aljazeera.com/news/2026/6/11/thousands-of-malawians-flee-homes-in-south-africa-amid-xenophobic-threats"
+    )
+    assert "More than 3,000 Malawians" in result
+    assert "Recommended Stories" not in result
+    assert "Fearful foreign nationals in South Africa forced out of their homes" not in result
+
     # justext performs better here
     result = do_load_page("http://schleifen.ucoz.de/blog/briefe/2010-10-26-18")
     assert "Es war gesagt," in result
```

**File**: `trafilatura/xpaths.py` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@ def _alt(tokens: tuple[str, ...]) -> str:
 _SHARE_CLASS_TOKENS = ("share-", "sociable", "embedded", "embed")
 _TAGS_CLASS_TOKENS = ("tag-list",)
 _CONSENT_CLASS_TOKENS = ("consent", "modal-content", "permission")
-_RELATED_CLASS_TOKENS = ("elated", "next-", "-stories", "most-popular")
+_RELATED_CLASS_TOKENS = ("elated", "next-", "-stories", "most-popular", "more-on")
 _UI_META_CLASS_TOKENS = (
     "meta",
     "rating",
```

#### Recent Merged Pull Requests:
- **PR #950** (2026-10-02): maintenance: prepare version 2.3.0 (@adbar)
- **PR #947** (2026-10-02): fix: add the record ID and fingerprint to the TXT/Markdown header (@MohammadHijjawi97)
- **PR #945** (closed): build(deps): bump urllib3 from 2.7.0 to 2.8.0 (@dependabot[bot])
- **PR #944** (2026-10-02): docs: link URL discovery tools from extraction guidance (@workstonedai-collab)
- **PR #942** (2026-09-30): fix: resolve protocol-relative canonical URLs in metadata (@MohammadHijjawi97)
- **PR #941** (2026-09-30): fix: join list metadata in HTML output instead of crashing (@MohammadHijjawi97)
- **PR #940** (2026-09-30): fix: keep text that directly follows a list, table, quote or code block (@r0h1tb)
- **PR #938** (2026-09-30): maintenance: simplify document handling code (@adbar)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
