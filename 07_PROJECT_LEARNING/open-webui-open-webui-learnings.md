# Forensic Learning Record (Deep Inspection): open-webui/open-webui

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-webui-open-webui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-webui/open-webui](https://github.com/open-webui/open-webui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:18:34.407Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-webui/open-webui`
- **Description**: User-friendly AI Interface (Supports Ollama, OpenAI API, ...)
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 154026 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/open_webui/migrations/util.py`
```
from __future__ import annotations

"""Alembic migration utilities."""

from alembic import op  # noqa: E402 — alembic runtime context
from sqlalchemy import inspect  # metadata inspection


# --- database helper functions ---
def get_existing_tables() -> set[str]:
    """Return table names already present in the database."""
    conn = op.get_bind()
    return set(inspect(conn).get_table_names())


def get_revision_id() -> str:
    """Generate a short random revision identifier."""
    import uuid

    return uuid.uuid4().hex[:12]

```

### Core Architecture Module: `backend/open_webui/retrieval/utils.py`
```
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
import time
from typing import Awaitable, Optional, Union
from urllib.parse import quote

import aiohttp
import numpy as np
import requests
from fastapi import HTTPException
from langchain_classic.retrievers import (
    ContextualCompressionRetriever,
    EnsembleRetriever,
)
from langchain_core.documents import Document
from open_webui.config import (
    RAG_EMBEDDING_CONTENT_PREFIX,
    RAG_EMBEDDING_PREFIX_FIELD_NAME,
    RAG_EMBEDDING_QUERY_PREFIX,
    VECTOR_DB,
)
from open_webui.constants import ERROR_MESSAGES
from open_webui.env import (
    AIOHTTP_CLIENT_ALLOW_REDIRECTS,
    AIOHTTP_CLIENT_SESSION_SSL,
    AIOHTTP_CLIENT_TIMEOUT,
    BYPASS_RETRIEVAL_ACCESS_CONTROL,
    ENABLE_FORWARD_USER_INFO_HEADERS,
    ENABLE_RETRIEVAL_UNSCOPED_COLLECTIONS,
    MPS_INFERENCE_LOCK,
    OFFLINE_MODE,
    RAG_SOURCE_METADATA_KEYS,
    USE_SLIM,
)
from open_webui.models.access_grants import AccessGrants
from open_webui.models.chats import Chats
from open_webui.models.files import Files
from open_webui.models.folders import Folders
from open_webui.models.knowledge import Knowledges
from open_webui.models.notes import Notes
from open_webui.models.config import Config
from open_webui.models.users import UserModel
from open_webui.retrieval.loaders.youtube import YoutubeLoader
from open_webui.retrieval.vector.async_client import ASYNC_VECTOR_DB_CLIENT
from open_webui.retrieval.external import retrieve_external_knowledge
from open_webui.retrieval.vector.factory import get_vector_db_client
from open_webui.retrieval.vector.main import GetResult, SearchResult
from open_webui.retrieval.web.utils import get_web_loader
from open_webui.utils.access_control.files import get_owner_accessible_folder_files, has_access_to_file
from open_webui.utils.access_control.folders import has_folder_access
from open_webui.utils.headers import get_json_bearer_headers, include_user_info_headers
from open_webui.utils.misc import get_content_from_message, get_message_list

log = logging.getLogger(__name__)


from typing import Any

from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.retrievers import BaseRetriever


class BM25Retriever(BaseRetriever):
    docs: list[Document]
    vectorizer: Any
    k: int

    def _get_relevant_documents(self, query: str, *, run_manager: CallbackManagerForRetrieverRun) -> list[Document]:
        return self.vectorizer.get_top_n(query.split(), self.docs, n=self.k)


def is_youtube_url(url: str) -> bool:
    youtube_regex = r'^(https?://)?(www\.)?(youtube\.com|youtu\.be)/.+$'
    return re.match(youtube_regex, url) is not None


LOADER_CONFIG_KEYS = {
    'file_max_size': 'rag.file.max_size',
    'youtube_language': 'rag.youtube_loader_language',
    'youtube_proxy_url': 'rag.youtube_loader_proxy_url',
    'web_loader_ssl_verification': 'web.loader.ssl_verification',
    'web_loader_concurrent_requests': 'web.loader.concurrent_requests',
    'web_search_trust_env': 'web.search.trust_env',
    'web_loader_engine': 'web.loader.engine',
    'web_loader_timeout': 'web.loader.timeout',
    'playwright_ws_url': 'web.loader.playwright_ws_url',
    'playwright_timeout': 'web.loader.playwright_timeout',
    'firecrawl_api_key': 'web.loader.firecrawl_api_key',
    'firecrawl_api_url': 'web.loader.firecrawl_api_url',
    'firecrawl_timeout': 'web.loader.firecrawl_timeout',
    'tavily_api_key': 'web.search.tavily_api_key',
    'tavily_extract_depth': 'web.search.tavily_extract_depth',
    'microsoft_web_iq_api_base_url': 'web.search.microsoft_web_iq_api_base_url',
    'microsoft_web_iq_api_key': 'web.search.microsoft_web_iq_api_key',
    'microsoft_web_iq_language': 'web.search.microsoft_web_iq_language',
    'external_web_loader_url': 'web.loader.external_web_loader_url',
    'external_web_loader_api_key': 'web.loader.external_web_loader_api_key',
    'CONTENT_EXTRACTION_ENGINE': 'rag.content_extraction_engine',
    'DATALAB_MARKER_API_KEY': 'rag.datalab_marker_api_key',
    'DATALAB_MARKER_API_BASE_URL': 'rag.datalab_marker_api_base_url',
    'DATALAB_MARKER_ADDITIONAL_CONFIG': 'rag.datalab_marker_additional_config',
    'DATALAB_MARKER_SKIP_CACHE': 'rag.datalab_marker_skip_cache',
    'DATALAB_MARKER_FORCE_OCR': 'rag.datalab_marker_force_ocr',
    'DATALAB_MARKER_PAGINATE': 'rag.datalab_marker_paginate',
    'DATALAB_MARKER_STRIP_EXISTING_OCR': 'rag.datalab_marker_strip_existing_ocr',
    'DATALAB_MARKER_DISABLE_IMAGE_EXTRACTION': 'rag.datalab_marker_disable_image_extraction',
    'DATALAB_MARKER_FORMAT_LINES': 'rag.datalab_marker_format_lines',
    'DATALAB_MARKER_USE_LLM': 'rag.datalab_marker_use_llm',
    'DATALAB_MARKER_OUTPUT_FORMAT': 'rag.datalab_marker_output_format',
    'EXTERNAL_DOCUMENT_LOADER_URL': 'rag.external_document_loader_url',
    'EXTERNAL_DOCUMENT_LOADER_API_KEY': 'rag.external_document_loader_api_key',
    'EXTERNAL_DOCUMENT_LOADER_HEADERS': 'rag.external_document_loader_headers',
    'TIKA_SERVER_URL': 'rag.tika_server_url',
    'TIKA_SERVER_VERSION': 'rag.tika_server_version',
    'DOCLING_SERVER_URL': 'rag.docling_server_url',
    'DOCLING_API_KEY': 'rag.docling_api_key',
    'DOCLING_PARAMS': 'rag.docling_params',
    'PDF_EXTRACT_IMAGES': 'rag.pdf_extract_images',
    'PDF_LOADER_MODE': 'rag.pdf_loader_mode',
    'DOCUMENT_INTELLIGENCE_ENDPOINT': 'rag.document_intelligence_endpoint',
    'DOCUMENT_INTELLIGENCE_KEY': 'rag.document_intelligence_key',
    'DOCUMENT_INTELLIGENCE_MODEL': 'rag.document_intelligence_model',
    'MISTRAL_OCR_API_BASE_URL': 'rag.mistral_ocr_api_base_url',
    'MISTRAL_OCR_API_KEY': 'rag.mistral_ocr_api_key',
    'MISTRAL_OCR_USE_BASE64': 'rag.mistral_ocr_use_base64',
    'PADDLEOCR_VL_BASE_URL': 'rag.paddleocr_vl_base_url',
    'PADDLEOCR_VL_TOKEN': 'rag.paddleocr_vl_token',
    'MINERU_API_MODE': 'rag.mineru_api_mode',
    'MINERU_API_URL': 'rag.mineru_api_url',
    'MINERU_API_KEY': 'rag.mineru_api_key',
    'MINERU_API_TIMEOUT': 'rag.mineru_api_timeout',
    'MINERU_PARAMS': 'rag.mineru_params',
    'MINERU_FILE_EXTENSIONS': 'rag.mineru_file_extensions',
}


async def get_loader_config():
    values = await Config.get_many(*LOADER_CONFIG_KEYS.values())
    return {name: values.get(key) for name, key in LOADER_CONFIG_KEYS.items()}


def get_loader(request, url: str, config: dict):
    if is_youtube_url(url):
        return YoutubeLoader(
            url,
            language=config.get('youtube_language'),
            proxy_url=config.get('youtube_proxy_url'),
        )
    return get_web_loader(
        url,
        verify_ssl=config.get('web_loader_ssl_verification'),
        requests_per_second=config.get('web_loader_concurrent_requests'),
        trust_env=config.get('web_search_trust_env'),
        loader_config=config,
    )


def build_loader_from_config(request, config: dict):
    """Build a Loader instance with the admin's configured extraction engine settings."""
    from open_webui.retrieval.loaders.main import Loader

    loader_config = {key: config.get(key) for key in LOADER_CONFIG_KEYS if key.isupper()}
    loader_config['FILE_MAX_SIZE'] = config.get('file_max_size')
    return Loader(
        engine=loader_config['CONTENT_EXTRACTION_ENGINE'],
        **{key: value for key, value in loader_config.items() if key != 'CONTENT_EXTRACTION_ENGINE'},
    )


def _extract_text_from_binary_response(
    request, response: requests.Response, url: str, loader_config: dict
) -> tuple[str, list]:
    """Download response body to a temp file and extract text using the Loader pipeline."""
    import mimetypes
    import tempfile
    import urllib.parse

    content_type = response.headers.get('Content-Type', '').split(';')[0].strip()

    # Derive filename from URL path, falling back to Content-Disposition or mime guess
    url_path = urllib.parse.urlparse(url).path
    filename = os.path.basename(url_path) if url_path else ''

    if not filename or '.' not in filename:
        # Try Content-Disposition header
        cd = response.headers.get('Content-Disposition', '')
        if 'filename=' in cd:
            filename = cd.split('filename=')[-1].strip('"\'')

    if not filename or '.' not in filename:
        ext = mimetypes.guess_extension(content_type) or ''
        filename = f'download{ext}'

    suffix = '.' + filename.split('.')[-1].lower() if '.' in filename else ''

    max_size = loader_config.get('file_max_size')
    max_bytes = int(max_size) * 1024 * 1024 if max_size else 0

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        downloaded = 0
        # Stream to disk; response.content buffers the whole body in memory first.
        with os.fdopen(tmp_fd, 'wb') as tmp:
            for chunk in response.iter_content(64 * 1024):
                downloaded += len(chunk)
                if max_bytes and downloaded > max_bytes:
                    raise ValueError(ERROR_MESSAGES.FILE_TOO_LARGE(size=f'{max_size} MB'))
                tmp.write(chunk)

        loader = build_loader_from_config(request, loader_config)
        docs = loader.load(filename, content_type, tmp_path)
        for doc in docs:
            doc.metadata['source'] = url
        content = ' '.join([doc.page_content for doc in docs])
        return content, docs
    finally:
        os.remove(tmp_path)


TEXT_APPLICATION_CONTENT_TYPES = {
    'application/javascript',
    'application/json',
    'application/xml',
    'application/x-javascript',
}


def _is_text_content_type(content_type: str) -> bool:
    """Return True if the content type should be handled by the web loader."""
    ct = content_type.split(';')[0].strip().lower()
    if not ct:
        return True
    if ct.startswith('text/'):
        return True
    if ct in TEXT_APPLICATION_CONTENT_TYPES:
        return True
    return ct.endswith(('+xml', '+json'))


async def get_content_from_url(request, url: str) -> str:
    loader_config = await get_loader_config()

    # The rest 
```

### Core Architecture Module: `backend/open_webui/retrieval/vector/utils.py`
```
import datetime as dt
from typing import Any

from open_webui.env import RAG_METADATA_MAX_VALUE_CHARS
from open_webui.retrieval.vector.main import SearchResult
from open_webui.utils.misc import sanitize_text_for_db

KEYS_TO_EXCLUDE = [
    'content',
    'pages',
    'tables',
    'paragraphs',
    'sections',
    'figures',
    'documents',
    'keyValuePairs',
    'styles',
    'languages',
]


def filter_metadata(metadata: dict[str, any]) -> dict[str, any]:
    # Removes large/redundant fields from metadata dict.
    result = {}
    for key, value in metadata.items():
        if key in KEYS_TO_EXCLUDE:
            continue
        if RAG_METADATA_MAX_VALUE_CHARS is not None and isinstance(value, (list, dict)):
            try:
                if len(str(value)) > RAG_METADATA_MAX_VALUE_CHARS:
                    continue
            except (MemoryError, RecursionError, ValueError):
                continue
        result[key] = value
    return result


def process_metadata(
    metadata: dict[str, any],
) -> dict[str, any]:
    # Removes large fields, converts non-serializable types (datetime, list, dict) to strings,
    # and sanitizes strings for database storage (strips null bytes and invalid surrogates).
    result = {}
    for key, value in metadata.items():
        # Skip large fields
        if key in KEYS_TO_EXCLUDE:
            continue
        if value is None:
            continue
        if RAG_METADATA_MAX_VALUE_CHARS is not None and isinstance(value, (list, dict)):
            try:
                if len(str(value)) > RAG_METADATA_MAX_VALUE_CHARS:
                    continue
            except (MemoryError, RecursionError, ValueError):
                continue
        # Convert non-serializable fields to strings
        if isinstance(value, (dt.datetime, list, dict)):
            result[key] = sanitize_text_for_db(str(value))
        else:
            result[key] = sanitize_text_for_db(value)
    return result


def iter_filter_conditions(filter: dict[str, Any] | None):
    for key, value in (filter or {}).items():
        if isinstance(value, dict):
            if set(value) != {'$in'}:
                raise ValueError(f"Unsupported metadata filter for '{key}': {value}")
            yield key, '$in', list(value['$in'])
        else:
            yield key, '$eq', value


def normalize_filter(filter: dict[str, Any] | None) -> dict[str, Any]:
    return {key: {'$in': value} if op == '$in' else value for key, op, value in iter_filter_conditions(filter)}


def metadata_matches_filter(metadata: dict[str, Any], filter: dict[str, Any] | None) -> bool:
    if not isinstance(metadata, dict):
        return False
    for key, op, value in iter_filter_conditions(filter):
        actual = metadata.get(key)
        if op == '$in':
            if actual not in value:
                return False
        elif actual != value:
            return False
    return True


def merge_hybrid_search_results(
    vector_result: SearchResult | None,
    fts_results: list[dict[str, Any]],
    num_queries: int,
    limit: int,
    hybrid_bm25_weight: float,
) -> SearchResult:
    rank_constant = 60.0
    bm25_weight = min(max(hybrid_bm25_weight, 0.0), 1.0)
    vector_weight = 1.0 - bm25_weight

    ids = [[] for _ in range(num_queries)]
    distances = [[] for _ in range(num_queries)]
    documents = [[] for _ in range(num_queries)]
    metadatas = [[] for _ in range(num_queries)]

    for qid in range(num_queries):
        candidates: dict[str, dict[str, Any]] = {}

        if vector_result and vector_result.ids and qid < len(vector_result.ids):
            for rank, item_id in enumerate(vector_result.ids[qid] or [], start=1):
                score = vector_weight / (rank_constant + rank) if vector_weight > 0 else 0
                if score <= 0:
                    continue

                candidate = candidates.setdefault(
                    item_id,
                    {
                        'score': 0.0,
                        'document': vector_result.documents[qid][rank - 1],
                        'metadata': vector_result.metadatas[qid][rank - 1],
                    },
                )
                candidate['score'] += score

        for rank, row in enumerate(fts_results, start=1):
            score = bm25_weight / (rank_constant + rank) if bm25_weight > 0 else 0
            if score <= 0:
                continue

            item_id = row['id']
            candidate = candidates.setdefault(
                item_id,
                {
                    'score': 0.0,
                    'document': row['text'],
                    'metadata': row['vmetadata'],
                },
            )
            candidate['score'] += score

        ranked = sorted(candidates.items(), key=lambda item: item[1]['score'], reverse=True)[:limit]
        ids[qid] = [item_id for item_id, _ in ranked]
        distances[qid] = [candidate['score'] for _, candidate in ranked]
        documents[qid] = [candidate['document'] for _, candidate in ranked]
        metadatas[qid] = [candidate['metadata'] for _, candidate in ranked]

    return SearchResult(ids=ids, distances=distances, documents=documents, metadatas=metadatas)

```

### Core Architecture Module: `backend/open_webui/retrieval/web/utils.py`
```
import asyncio
import http.cookiejar
import ipaddress
import logging
import socket
import ssl
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from importlib import import_module
from typing import (
    Any,
    AsyncIterator,
    Dict,
    Iterable,
    Iterator,
    List,
    Literal,
    Optional,
    Sequence,
    Tuple,
    Union,
)

import aiohttp
import certifi
import requests
import urllib3.connection
import urllib3.connectionpool
import validators
from requests.adapters import HTTPAdapter
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from langchain_core.document_loaders import BaseLoader
from langchain_core.documents import Document
from open_webui.config import (
    ENABLE_LOCAL_WEB_FETCH,
    EXTERNAL_WEB_LOADER_API_KEY,
    EXTERNAL_WEB_LOADER_URL,
    FIRECRAWL_API_BASE_URL,
    FIRECRAWL_API_KEY,
    FIRECRAWL_TIMEOUT,
    MICROSOFT_WEB_IQ_API_BASE_URL,
    MICROSOFT_WEB_IQ_API_KEY,
    MICROSOFT_WEB_IQ_LANGUAGE,
    PLAYWRIGHT_TIMEOUT,
    PLAYWRIGHT_WS_URL,
    TAVILY_API_KEY,
    TAVILY_EXTRACT_DEPTH,
    WEB_FETCH_FILTER_LIST,
    WEB_LOADER_ENGINE,
    WEB_LOADER_TIMEOUT,
)
from open_webui.constants import ERROR_MESSAGES
from open_webui.env import (
    AIOHTTP_CLIENT_ALLOW_REDIRECTS,
    AIOHTTP_CLIENT_SESSION_SSL,
    AIOHTTP_CLIENT_SSL_CERT_FILE,
    AIOHTTP_CLIENT_TIMEOUT,
    USER_AGENT,
    USE_SLIM,
)
from open_webui.retrieval.loaders.external_web import ExternalWebLoader
from open_webui.retrieval.loaders.microsoft_web_iq import MicrosoftWebIQLoader
from open_webui.retrieval.loaders.tavily import TavilyLoader
from open_webui.retrieval.web.firecrawl import scrape_firecrawl_url
from open_webui.utils.misc import is_host_allowed, is_host_blocked

log = logging.getLogger(__name__)


def resolve_hostname(hostname):
    # Get address information
    addr_info = socket.getaddrinfo(hostname, None)

    # Extract IP addresses from address information
    ipv4_addresses = [info[4][0] for info in addr_info if info[0] == socket.AF_INET]
    ipv6_addresses = [info[4][0] for info in addr_info if info[0] == socket.AF_INET6]

    return ipv4_addresses, ipv6_addresses


def _embedded_ipv4(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> list[ipaddress.IPv4Address]:
    """The IPv4 addresses an IPv6 address carries: mapped, compatible, 6to4, teredo and NAT64."""
    if not isinstance(addr, ipaddress.IPv6Address):
        return []

    embedded = []
    if addr.ipv4_mapped:
        embedded.append(addr.ipv4_mapped)
    if addr.sixtofour:
        embedded.append(addr.sixtofour)
    if addr.teredo:
        embedded.extend(addr.teredo)

    b = addr.packed
    # Prefixes that put the address in the last four bytes: v4-compatible and NAT64 /96.
    if b[:12] in (b'\x00' * 12, b'\x00\x64\xff\x9b' + b'\x00' * 8):
        embedded.append(ipaddress.IPv4Address(b[12:]))
    elif b[:6] == b'\x00\x64\xff\x9b\x00\x01':
        embedded.append(ipaddress.IPv4Address(bytes((b[6], b[7], b[9], b[10]))))

    return embedded


def _assert_host_allowed(host: str | None) -> None:
    if WEB_FETCH_FILTER_LIST and not is_host_allowed(host, WEB_FETCH_FILTER_LIST):
        log.warning(f'Blocked by filter list: {host}')
        raise ValueError(ERROR_MESSAGES.INVALID_URL)


def _assert_addresses_allowed(addresses: Sequence[str]) -> None:
    # An IPv6 address can carry a blocked IPv4 address inside it, so judge both spellings.
    parsed = [ipaddress.ip_address(address) for address in addresses]
    candidates = [*parsed, *(ipv4 for address in parsed for ipv4 in _embedded_ipv4(address))]

    # Block entries only: an allow entry names a host, so judging a resolved address against one
    # would reject every allow-listed host.
    if is_host_blocked([str(address) for address in candidates], WEB_FETCH_FILTER_LIST):
        log.warning(f'Blocked by filter list: {", ".join(str(address) for address in candidates)}')
        raise ValueError(ERROR_MESSAGES.INVALID_URL)

    if not ENABLE_LOCAL_WEB_FETCH:
        for address in candidates:
            if not address.is_global:
                log.warning(f'Blocked non-global address: {address}')
                raise ValueError(ERROR_MESSAGES.INVALID_URL)


def validate_url(url: Union[str, Sequence[str]]):
    if isinstance(url, str):
        if isinstance(validators.url(url, simple_host=ENABLE_LOCAL_WEB_FETCH), validators.ValidationError):
            raise ValueError(ERROR_MESSAGES.INVALID_URL)

        # Reject parser-confusing chars: urlparse and requests/aiohttp split
        # on these differently, e.g. http://127.0.0.1\@1.1.1.1 → urlparse
        # extracts 1.1.1.1 (public, passes filter) while requests connects
        # to 127.0.0.1 (internal). Same shape with tab/CR/LF.
        if any(ch in url for ch in ('\\', '\t', '\n', '\r')):
            log.warning(f'Blocked URL with parser-confusing char: {url!r}')
            raise ValueError(ERROR_MESSAGES.INVALID_URL)

        parsed_url = urllib.parse.urlparse(url)

        # Protocol validation - only allow http/https
        if parsed_url.scheme not in ['http', 'https']:
            log.warning(f'Blocked non-HTTP(S) protocol: {parsed_url.scheme} in URL: {url}')
            raise ValueError(ERROR_MESSAGES.INVALID_URL)

        # Match on the parsed hostname, not the full URL: a path component would
        # otherwise let any URL slip past a hostname-based block/allow entry.
        _assert_host_allowed(parsed_url.hostname)

        try:
            ipv4_addresses, ipv6_addresses = resolve_hostname(parsed_url.hostname)
        except (socket.gaierror, UnicodeError) as e:
            # With local fetch on, a proxied deployment can carry names only the proxy resolves.
            if not ENABLE_LOCAL_WEB_FETCH:
                log.warning(f'Could not resolve host {parsed_url.hostname}: {e}')
                raise ValueError(ERROR_MESSAGES.INVALID_URL) from None
            ipv4_addresses, ipv6_addresses = [], []

        # A hostname match alone lets a DNS record point at a blocked address.
        # DNS rebinding is mitigated at the connection layer; see _SSRFSafeConnector / _SSRFSafeAdapter
        _assert_addresses_allowed(ipv4_addresses + ipv6_addresses)
        return True
    elif isinstance(url, Sequence):
        return all(validate_url(u) for u in url)
    else:
        return False


def safe_validate_urls(url: Sequence[str]) -> Sequence[str]:
    valid_urls = []
    for u in url:
        try:
            if validate_url(u):
                valid_urls.append(u)
        except Exception as e:
            log.debug('Invalid URL %s: %s', u, e)
            continue
    return valid_urls


def _ssrf_safe_new_conn(self):
    """Resolve DNS, screen every resolved address, connect to one of them.

    Replaces urllib3's _new_conn so the DNS lookup that feeds the actual TCP
    connect is the same one we validate — no second resolution, no rebinding
    window.
    """
    host = getattr(self, '_dns_host', self.host)
    port = self.port
    infos = socket.getaddrinfo(host, port, 0, socket.SOCK_STREAM)
    if not infos:
        raise OSError(f'getaddrinfo for {host!r} returned empty list')
    _assert_addresses_allowed([sa[0] for _, _, _, _, sa in infos])
    err = None
    for fam, typ, proto, _, sa in infos:
        sock = None
        try:
            sock = socket.socket(fam, typ, proto)
            if self.timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:
                sock.settimeout(self.timeout)
            if getattr(self, 'source_address', None):
                sock.bind(self.source_address)
            for opt in getattr(self, 'socket_options', None) or ():
                if len(opt) == 4 and isinstance(opt[3], str):
                    # urllib3-future per-protocol form: (level, optname, value, "tcp"/"udp")
                    if opt[3].lower() == 'tcp':
                        sock.setsockopt(*opt[:3])
                    continue
                sock.setsockopt(*opt)
            sock.connect(sa)
            return sock
        except OSError as exc:
            err = exc
            if sock is not None:
                sock.close()
    raise err or OSError(f'connect to {host!r}:{port} failed')


class _SafeHTTPConn(urllib3.connection.HTTPConnection):
    _new_conn = _ssrf_safe_new_conn


class _SafeHTTPSConn(urllib3.connection.HTTPSConnection):
    _new_conn = _ssrf_safe_new_conn


class _SafeHTTPPool(urllib3.connectionpool.HTTPConnectionPool):
    ConnectionCls = _SafeHTTPConn


class _SafeHTTPSPool(urllib3.connectionpool.HTTPSConnectionPool):
    ConnectionCls = _SafeHTTPSConn


class _SSRFSafeAdapter(HTTPAdapter):
    """requests adapter that rejects filter-listed request targets and non-global IPs at connect time."""

    def init_poolmanager(self, *args, **kwargs):
        super().init_poolmanager(*args, **kwargs)
        self.poolmanager.pool_classes_by_scheme = {
            'http': _SafeHTTPPool,
            'https': _SafeHTTPSPool,
        }

    def send(self, request, *args, **kwargs):
        # Per request, not per connection: the connection layer sees the proxy.
        _assert_host_allowed(urllib.parse.urlparse(request.url).hostname)
        return super().send(request, *args, **kwargs)


class _SSRFSafeConnector(aiohttp.TCPConnector):
    """Rejects filter-listed request targets, and non-global IPs on each new connection."""

    async def connect(self, req, traces, timeout):
        # Per request, not per connection: _resolve_host sees the proxy and pooled reuse skips it.
        _assert_host_allowed(req.url.host)
        return await super().connect(req, traces, timeout)

    async def _resolve_host(self, host, port, traces=None):
        # aiohttp answers IP-literal hosts itself without consulting a resolver.
        results = await super()._resolve_host(host, port, traces=traces)
        _assert_addresses_allowed([entry['host'] for entry in results])
        return results


def get_ssrf_safe_session(trus
```

### Core Architecture Module: `backend/open_webui/routers/utils.py`
```
from __future__ import annotations

import logging

import black
from fastapi import APIRouter, Depends, HTTPException, Request, status
from open_webui.config import DATA_DIR, ENABLE_ADMIN_EXPORT
from open_webui.constants import ERROR_MESSAGES
from open_webui.models.config import Config
from open_webui.utils.auth import get_admin_user, get_verified_user
from open_webui.utils.code_interpreter import execute_code_jupyter
from open_webui.utils.misc import get_gravatar_url
from pydantic import BaseModel
from starlette.responses import FileResponse

log = logging.getLogger(__name__)

router = APIRouter()


@router.get('/gravatar')
async def get_gravatar(email: str, user=Depends(get_verified_user)):
    return get_gravatar_url(email)


class CodeForm(BaseModel):
    code: str


@router.post('/code/format')
async def format_code(form_data: CodeForm, user=Depends(get_admin_user)):
    try:
        formatted_code = black.format_str(form_data.code, mode=black.Mode())
        return {'code': formatted_code}
    except black.NothingChanged:
        return {'code': form_data.code}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post('/code/execute')
async def execute_code(request: Request, form_data: CodeForm, user=Depends(get_verified_user)):
    if not await Config.get('code_execution.enable'):
        raise HTTPException(
            status_code=403,
            detail=ERROR_MESSAGES.FEATURE_DISABLED('Code execution'),
        )

    if await Config.get('code_execution.engine') == 'jupyter':
        output = await execute_code_jupyter(
            await Config.get('code_execution.jupyter.url'),
            form_data.code,
            (
                await Config.get('code_execution.jupyter.auth_token')
                if await Config.get('code_execution.jupyter.auth') == 'token'
                else None
            ),
            (
                await Config.get('code_execution.jupyter.auth_password')
                if await Config.get('code_execution.jupyter.auth') == 'password'
                else None
            ),
            await Config.get('code_execution.jupyter.timeout'),
        )

        return output
    else:
        raise HTTPException(
            status_code=400,
            detail=ERROR_MESSAGES.DEFAULT('Code execution engine not supported'),
        )


@router.get('/db/download')
async def download_db(user=Depends(get_admin_user)):
    """Download the raw SQLite database file (admin-only, SQLite deployments only)."""
    if not ENABLE_ADMIN_EXPORT:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=ERROR_MESSAGES.ACCESS_PROHIBITED)

    # Lazy import avoids circular dependency at module load time
    from open_webui.internal.db import engine

    if engine.name != 'sqlite':
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=ERROR_MESSAGES.DB_NOT_SQLITE)

    return FileResponse(
        str(engine.url.database),
        media_type='application/octet-stream',
        filename='webui.db',
    )

```

### Core Architecture Module: `backend/open_webui/socket/utils.py`
```
"""Redis-backed distributed data structures for WebSocket state management."""

from __future__ import annotations

import hashlib
import logging
import uuid

import pycrdt as Y
from open_webui.env import REDIS_KEY_PREFIX
from open_webui.utils.json_codec import JSONCodec
from open_webui.utils.redis import get_redis_connection
from redis.exceptions import RedisClusterException, RedisError

log = logging.getLogger(__name__)

YDOC_KEY_PREFIX = f'{REDIS_KEY_PREFIX}:ydoc:documents'
SCAN_BATCH_SIZE = 200


class RedisLock:
    """Distributed lock backed by a Redis SET with NX/EX semantics."""

    _RENEW_SCRIPT = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('expire', KEYS[1], ARGV[2])
    end
    return 0
    """
    _RELEASE_SCRIPT = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    end
    return 0
    """

    def __init__(
        self,
        redis_url,
        lock_name,
        timeout_secs,
        redis_sentinels=[],
        redis_cluster=False,
    ):
        self.lock_name = lock_name
        self.lock_id = str(uuid.uuid4())
        self.timeout_secs = timeout_secs
        self.lock_obtained = False
        self.redis = get_redis_connection(
            redis_url,
            redis_sentinels,
            redis_cluster=redis_cluster,
            decode_responses=True,
        )

    def aquire_lock(self):
        # nx=True will only set this key if it _hasn't_ already been set
        self.lock_obtained = self.redis.set(self.lock_name, self.lock_id, nx=True, ex=self.timeout_secs)
        return self.lock_obtained

    def renew_lock(self):
        return bool(self.redis.eval(self._RENEW_SCRIPT, 1, self.lock_name, self.lock_id, self.timeout_secs))

    def release_lock(self):
        try:
            self.redis.eval(self._RELEASE_SCRIPT, 1, self.lock_name, self.lock_id)
        except (RedisClusterException, RedisError) as e:
            log.warning('Failed to release lock %s; it expires on its own: %s', self.lock_name, e)


class RedisDict:
    def __init__(
        self,
        name,
        redis_url,
        redis_sentinels=[],
        redis_cluster=False,
        cache_set_signature=False,
    ):
        self.name = name
        self._signature_name = f'{name}:signature' if cache_set_signature else None
        self.redis = get_redis_connection(
            redis_url,
            redis_sentinels,
            redis_cluster=redis_cluster,
            decode_responses=True,
        )

    def __setitem__(self, key, value):
        serialized_value = JSONCodec.dumps(value)
        self.redis.hset(self.name, key, serialized_value)
        if self._signature_name:
            self.redis.delete(self._signature_name)

    def __getitem__(self, key):
        value = self.redis.hget(self.name, key)
        if value is None:
            raise KeyError(key)
        return JSONCodec.loads(value)

    def __delitem__(self, key):
        result = self.redis.hdel(self.name, key)
        if result == 0:
            raise KeyError(key)
        if self._signature_name:
            self.redis.delete(self._signature_name)

    def __contains__(self, key):
        return self.redis.hexists(self.name, key)

    def __len__(self):
        return self.redis.hlen(self.name)

    def keys(self):
        return self.redis.hkeys(self.name)

    def values(self):
        return [JSONCodec.loads(v) for v in self.redis.hvals(self.name)]

    def items(self):
        return [(k, JSONCodec.loads(v)) for k, v in self.redis.hgetall(self.name).items()]

    def scan_batches(self):
        """Yield lists of (key, value) pairs via incremental HSCAN; a field may repeat across batches."""
        cursor = 0
        while True:
            cursor, batch = self.redis.hscan(self.name, cursor, count=SCAN_BATCH_SIZE)
            if batch:
                yield [(k, JSONCodec.loads(v)) for k, v in batch.items()]
            if cursor == 0:
                break

    def delete_many(self, *keys):
        """Delete fields in one HDEL; no keys is a no-op (HDEL rejects an empty field list)."""
        if keys:
            self.redis.hdel(self.name, *keys)
            if self._signature_name:
                self.redis.delete(self._signature_name)

    def set(self, mapping: dict):
        if not mapping:
            self.clear()
            return

        # Serialize values once — reused for both the fingerprint and the write.
        serialized = {k: JSONCodec.dumps(v) for k, v in mapping.items()}
        digest = hashlib.sha256()
        for key in sorted(serialized):
            digest.update(key.encode())
            digest.update(b'\0')
            digest.update(serialized[key].encode())
            digest.update(b'\0')
        content_digest = digest.hexdigest()

        if self._signature_name:
            stored_signature = self.redis.get(self._signature_name)
            if stored_signature and stored_signature.startswith(f'{content_digest}:'):
                return
            # Cleared first so readers refetch while the hash is being rewritten.
            self.redis.delete(self._signature_name)

        # Fetch existing keys before writing so we know which ones to remove.
        # HKEYS is cheap — it transfers only short key strings, not large JSON values.
        existing_keys = set(self.redis.hkeys(self.name))
        new_keys = set(mapping.keys())
        keys_to_remove = existing_keys - new_keys

        # HSET first (add/update all new values), then HDEL (remove stale keys).
        # We never DELETE the whole hash — this eliminates the race window
        # where concurrent readers would see an empty models dict.
        self.redis.hset(self.name, mapping=serialized)
        if keys_to_remove:
            self.redis.hdel(self.name, *keys_to_remove)

        if self._signature_name:
            self.redis.set(self._signature_name, f'{content_digest}:{uuid.uuid4().hex}')

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def clear(self):
        if self._signature_name:
            self.redis.delete(self.name)
            self.redis.delete(self._signature_name)
        else:
            self.redis.delete(self.name)

    def update(self, other=None, **kwargs):
        if other is not None:
            for k, v in other.items() if hasattr(other, 'items') else other:
                self[k] = v
        for k, v in kwargs.items():
            self[k] = v

    def setdefault(self, key, default=None):
        if key not in self:
            self[key] = default
        return self[key]


class CachedRedisDict(RedisDict):
    """Answers reads from a per-worker cache of the hash, refetched whenever its signature changes."""

    def __init__(self, name: str, redis_url: str, redis_sentinels: list = [], redis_cluster: bool = False):
        super().__init__(name, redis_url, redis_sentinels, redis_cluster, cache_set_signature=True)
        self._cache: dict = {}
        self._cached_signature: str | None = None

    def _refresh_cache(self) -> dict:
        stored_signature = self.redis.get(self._signature_name)
        if stored_signature is None or stored_signature != self._cached_signature:
            self._cache = self.redis.hgetall(self.name)
            self._cached_signature = stored_signature
        return self._cache

    def __getitem__(self, key):
        value = self._refresh_cache().get(key)
        if value is None:
            raise KeyError(key)
        return JSONCodec.loads(value)

    def __contains__(self, key):
        return key in self._refresh_cache()

    def __len__(self):
        return len(self._refresh_cache())

    def keys(self):
        return list(self._refresh_cache().keys())

    def values(self):
        return [JSONCodec.loads(v) for v in self._refresh_cache().values()]

    def items(self):
        return [(k, JSONCodec.loads(v)) for k, v in self._refresh_cache().items()]


class YdocManager:
    COMPACTION_THRESHOLD = 500

    def __init__(
        self,
        redis=None,
        redis_key_prefix: str = YDOC_KEY_PREFIX,
    ):
        self._updates = {}
        self._users = {}
        self._redis = redis
        self._redis_key_prefix = redis_key_prefix

    async def append_to_updates(self, document_id: str, update: bytes):
        document_id = document_id.replace(':', '_')
        if self._redis:
            redis_key = f'{self._redis_key_prefix}:{document_id}:updates'
            await self._redis.rpush(redis_key, JSONCodec.dumps(list(update)))
            list_len = await self._redis.llen(redis_key)
            if list_len >= self.COMPACTION_THRESHOLD:
                await self._compact_updates_redis(document_id)
        else:
            if document_id not in self._updates:
                self._updates[document_id] = []
            self._updates[document_id].append(update)
            if len(self._updates[document_id]) >= self.COMPACTION_THRESHOLD:
                self._compact_updates_memory(document_id)

    async def _compact_updates_redis(self, document_id: str):
        """Rolling compaction: squash oldest half into one snapshot."""
        redis_key = f'{self._redis_key_prefix}:{document_id}:updates'
        all_updates = await self._redis.lrange(redis_key, 0, -1)
        if len(all_updates) <= 1:
            return
        mid = len(all_updates) // 2
        ydoc = Y.Doc()
        for raw in all_updates[:mid]:
            ydoc.apply_update(bytes(JSONCodec.loads(raw)))
        snapshot = JSONCodec.dumps(list(ydoc.get_update()))
        pipe = self._redis.pipeline()
        pipe.delete(redis_key)
        pipe.rpush(redis_key, snapshot, *all_updates[mid:])
        await pipe.execute()

    def _compact_updates_memory(self, document_id: str):
        """Rolling compaction: squash oldest half into one snapshot."""
        updates = self._updates.get(document_id, [])
        if len(updates) <= 1:
            return
      
```

### Core Architecture Module: `backend/open_webui/utils/access_control/__init__.py`
```
import logging
from typing import Any

from open_webui.config import DEFAULT_USER_PERMISSIONS
from open_webui.models.access_grants import (
    has_anyone_read_access_grant,
    has_public_read_access_grant,
    has_public_write_access_grant,
    has_user_access_grant,
    strip_anyone_access_grants,
    strip_user_access_grants,
)
from open_webui.models.groups import Groups
from open_webui.models.users import UserModel
from open_webui.utils.json_codec import JSONCodec
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


def fill_missing_permissions(permissions: dict[str, Any], default_permissions: dict[str, Any]) -> dict[str, Any]:
    """
    Recursively fills in missing properties in the permissions dictionary
    using the default permissions as a template.
    """
    for key, value in default_permissions.items():
        if key not in permissions:
            permissions[key] = value
        elif isinstance(value, dict) and isinstance(permissions[key], dict):  # Both are nested dictionaries
            permissions[key] = fill_missing_permissions(permissions[key], value)

    return permissions


async def get_permissions(
    user_id: str,
    default_permissions: dict[str, Any],
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    """
    Get all permissions for a user by combining the permissions of all groups the user is a member of.
    If a permission is defined in multiple groups, the most permissive value is used (True > False).
    Permissions are nested in a dict with the permission key as the key and a boolean as the value.
    """

    def combine_permissions(permissions: dict[str, Any], group_permissions: dict[str, Any]) -> dict[str, Any]:
        """Combine permissions from multiple groups by taking the most permissive value."""
        for key, value in group_permissions.items():
            if isinstance(value, dict):
                if key not in permissions:
                    permissions[key] = {}
                permissions[key] = combine_permissions(permissions[key], value)
            else:
                if key not in permissions:
                    permissions[key] = value
                else:
                    permissions[key] = permissions[key] or value  # Use the most permissive value (True > False)
        return permissions

    user_groups = await Groups.get_groups_by_member_id(user_id, db=db)

    # Deep copy default permissions to avoid modifying the original dict
    permissions = JSONCodec.loads(JSONCodec.dumps(default_permissions))

    # Combine permissions from all user groups
    for group in user_groups:
        permissions = combine_permissions(permissions, group.permissions or {})

    # Ensure all fields from default_permissions are present and filled in
    permissions = fill_missing_permissions(permissions, default_permissions)

    return permissions


async def has_permission(
    user_id: str,
    permission_key: str,
    default_permissions: dict[str, Any] = {},
    db: AsyncSession | None = None,
) -> bool:
    """
    Check if a user has a specific permission by checking the group permissions
    and fall back to default permissions if not found in any group.

    Permission keys can be hierarchical and separated by dots ('.').
    """

    def get_permission(permissions: dict[str, Any], keys: list[str]) -> bool:
        """Traverse permissions dict using a list of keys (from dot-split permission_key)."""
        for key in keys:
            if key not in permissions:
                return False  # If any part of the hierarchy is missing, deny access
            permissions = permissions[key]  # Traverse one level deeper

        return bool(permissions)  # Return the boolean at the final level

    permission_hierarchy = permission_key.split('.')

    # Retrieve user group permissions
    user_groups = await Groups.get_groups_by_member_id(user_id, db=db)

    for group in user_groups:
        if get_permission(group.permissions or {}, permission_hierarchy):
            return True

    # Check default permissions afterward if the group permissions don't allow it
    default_permissions = fill_missing_permissions(default_permissions, DEFAULT_USER_PERMISSIONS)
    return get_permission(default_permissions, permission_hierarchy)


async def has_access(
    user_id: str,
    permission: str = 'read',
    access_grants: list | None = None,
    user_group_ids: set[str] | None = None,
    db: AsyncSession | None = None,
) -> bool:
    """
    Check if a user has the specified permission using an in-memory access_grants list.

    Used for config-driven resources (arena models, tool servers) that store
    access control as JSON config rather than in the access_grant DB table.

    Semantics:
    - None or []  → private (owner-only, deny all)
    - [{"principal_type": "user", "principal_id": "*", "permission": "read"}] → public read
    - Specific grants → check user/group membership
    """
    if not access_grants:
        return False

    if user_group_ids is None:
        user_groups = await Groups.get_groups_by_member_id(user_id, db=db)
        user_group_ids = {group.id for group in user_groups}

    for grant in access_grants:
        if not isinstance(grant, dict):
            continue
        if grant.get('permission') != permission:
            continue
        principal_type = grant.get('principal_type')
        principal_id = grant.get('principal_id')
        if principal_type == 'user' and (principal_id == '*' or principal_id == user_id):
            return True
        if principal_type == 'group' and user_group_ids and principal_id in user_group_ids:
            return True

    return False


async def has_connection_access(
    user: UserModel,
    connection: dict,
    user_group_ids: set[str] | None = None,
) -> bool:
    """
    Check if a user can access a server connection (tool server, terminal, etc.)
    based on ``config.access_grants`` within the connection dict.

    - Admin with BYPASS_ADMIN_ACCESS_CONTROL → always allowed
    - Missing, None, or empty access_grants → private, admin-only
    - access_grants has entries → delegates to ``has_access``
    """
    from open_webui.config import BYPASS_ADMIN_ACCESS_CONTROL

    if user.role == 'admin' and BYPASS_ADMIN_ACCESS_CONTROL:
        return True

    access_grants = (connection.get('config') or {}).get('access_grants', [])
    if not access_grants:
        # No grants configured → private, admin-only: admins must keep access
        # to connections only they can configure, even when they do not bypass
        # access control globally.
        return user.role == 'admin'

    if user_group_ids is None:
        user_group_ids = {group.id for group in await Groups.get_groups_by_member_id(user.id)}

    return await has_access(user.id, 'read', access_grants, user_group_ids)


def migrate_access_control(data: dict, ac_key: str = 'access_control', grants_key: str = 'access_grants') -> None:
    """
    Auto-migrate a config dict in-place from legacy access_control dict to access_grants list.

    If `grants_key` already exists, does nothing.
    If `ac_key` exists (old format), converts it and stores as `grants_key`, then removes `ac_key`.
    """
    if grants_key in data:
        return

    access_control = data.get(ac_key)
    if access_control is None and ac_key not in data:
        return

    grants: list[dict[str, str]] = []
    if access_control and isinstance(access_control, dict):
        for perm in ['read', 'write']:
            perm_data = access_control.get(perm, {})
            if not perm_data:
                continue
            for group_id in perm_data.get('group_ids', []):
                grants.append(
                    {
                        'principal_type': 'group',
                        'principal_id': group_id,
                        'permission': perm,
                    }
                )
            for uid in perm_data.get('user_ids', []):
                grants.append(
                    {
                        'principal_type': 'user',
                        'principal_id': uid,
                        'permission': perm,
                    }
                )

    data[grants_key] = grants
    data.pop(ac_key, None)


async def filter_allowed_access_grants(
    default_permissions: dict[str, Any],
    user_id: str,
    user_role: str,
    access_grants: list,
    public_permission_key: str,
    anyone_permission_key: str | None = None,
    db: AsyncSession | None = None,
) -> list:
    """
    Checks if the user has the required permissions to grant access to a resource.
    Returns the filtered list of access grants if permissions are missing.
    """
    if not access_grants:
        return access_grants

    if has_anyone_read_access_grant(access_grants) and (
        not anyone_permission_key
        or (
            user_role != 'admin'
            and not await has_permission(
                user_id,
                anyone_permission_key,
                default_permissions,
                db=db,
            )
        )
    ):
        access_grants = strip_anyone_access_grants(access_grants)

    if user_role == 'admin':
        return access_grants

    # Check if user can share publicly
    if (
        has_public_read_access_grant(access_grants) or has_public_write_access_grant(access_grants)
    ) and not await has_permission(
        user_id,
        public_permission_key,
        default_permissions,
        db=db,
    ):
        access_grants = [
            grant
            for grant in access_grants
            if not (
                (grant.get('principal_type') if isinstance(grant, dict) else getattr(grant, 'principal_type', None))
                == 'user'
                and (grant.get('principal_id') if isinstance(grant, dict) else getattr(grant, 'principal_id', None))
                == '*'
            )
        ]

    # Strip individual user sharing if user lacks p
```

### Core Architecture Module: `backend/open_webui/utils/access_control/files.py`
```
import logging

from open_webui.models.access_grants import AccessGrants
from open_webui.models.channels import Channels
from open_webui.models.chats import Chats
from open_webui.models.files import Files
from open_webui.models.folders import FolderModel
from open_webui.models.groups import Groups
from open_webui.models.knowledge import Knowledges
from open_webui.models.models import Models
from open_webui.models.users import UserModel, Users
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)

FOLDER_FILE_TYPES = {'file', 'collection', 'note'}


async def has_access_to_file(
    file_id: str | None,
    access_type: str,
    user: UserModel,
    db: AsyncSession | None = None,
    user_group_ids: set[str] | None = None,
) -> bool:
    """
    Check if a user has the specified access to a file through any of:
    - Knowledge bases (ownership or access grants)
    - Shared workspace models that attach the file directly
    - Channels the user is a member of
    - Shared chats

    NOTE: This does NOT check direct file ownership — callers should check
    file.user_id == user.id separately before calling this.
    """
    file = await Files.get_file_by_id(file_id, db=db)
    log.debug('Checking if user has %s access to file', access_type)
    if not file:
        return False

    # Direct ownership
    if file.user_id == user.id:
        return True

    # Check if the file is associated with any knowledge bases the user has access to.
    # An object (knowledge base or workspace model) confers write/delete on a file only when
    # the object's OWNER owns that file; otherwise a read-only file laundered into an object
    # the user controls would gain write/delete on it (CWE-863). Read access is unaffected.
    knowledge_bases = await Knowledges.get_knowledges_by_file_id(file_id, db=db)
    if user_group_ids is None:
        user_group_ids = {group.id for group in await Groups.get_groups_by_member_id(user.id, db=db)}
    for knowledge_base in knowledge_bases:
        if (
            knowledge_base.user_id == user.id
            or await AccessGrants.has_access(
                user_id=user.id,
                resource_type='knowledge',
                resource_id=knowledge_base.id,
                permission=access_type,
                user_group_ids=user_group_ids,
                db=db,
            )
        ) and (access_type == 'read' or knowledge_base.user_id == file.user_id):
            return True

    # Check if the file is associated with any channels the user has access to
    channels = await Channels.get_channels_by_file_id_and_user_id(file_id, user.id, db=db)
    if access_type == 'read' and channels:
        return True

    # Check if the file is associated with any chats the user has access to
    shared_chat_ids = await Chats.get_shared_chat_ids_by_file_id(file_id, db=db)
    if access_type == 'read' and shared_chat_ids:
        accessible_ids = await AccessGrants.get_accessible_resource_ids(
            user_id=user.id,
            resource_type='shared_chat',
            resource_ids=shared_chat_ids,
            permission='read',
            user_group_ids=user_group_ids,
            db=db,
        )
        if accessible_ids:
            return True

    # Check if the file is directly attached to a shared workspace model (per the ownership
    # note above, model write is conferred only for files the model owner owns).
    model_owners = await Models.get_model_owner_ids_by_file_id(file.id, db=db, include_background=access_type == 'read')
    if access_type != 'read':
        model_owners = {model_id: owner_id for model_id, owner_id in model_owners.items() if owner_id == file.user_id}
    if user.id in model_owners.values():
        return True

    return bool(
        await AccessGrants.get_accessible_resource_ids(
            user_id=user.id,
            resource_type='model',
            resource_ids=list(model_owners),
            permission=access_type,
            user_group_ids=user_group_ids,
            db=db,
        )
    )


async def get_accessible_folder_files(
    entries: list[dict] | None,
    user: UserModel,
    db: AsyncSession | None = None,
    user_group_ids: set[str] | None = None,
) -> list[dict]:
    """Filter folder.data['files'] entries to those the caller can read.

    Entries carry a 'type' ('file', 'collection' or 'note') and 'id'. Entries of any other
    shape are dropped because they cannot be access-checked.
    """
    if not isinstance(entries, list):
        return []
    entries = [
        entry
        for entry in entries
        if isinstance(entry, dict) and entry.get('type') in FOLDER_FILE_TYPES and entry.get('id')
    ]
    if user.role == 'admin':
        return entries

    if user_group_ids is None:
        user_group_ids = {group.id for group in await Groups.get_groups_by_member_id(user.id, db=db)}

    accessible: list[dict] = []
    for entry in entries:
        entry_type = entry.get('type')
        entry_id = entry.get('id')
        if entry_type == 'file':
            if await has_access_to_file(entry_id, 'read', user, db=db, user_group_ids=user_group_ids):
                accessible.append(entry)
        elif entry_type == 'collection':
            if await Knowledges.check_access_by_user_id(
                entry_id, user.id, 'read', db=db, user_group_ids=user_group_ids
            ):
                accessible.append(entry)
        elif entry_type == 'note':
            # Owner has no self-grant (notes are private by default), so check ownership too.
            from open_webui.models.notes import Notes

            note = await Notes.get_note_by_id(entry_id, db=db)
            if note and (
                note.user_id == user.id
                or await AccessGrants.has_access(
                    user_id=user.id,
                    resource_type='note',
                    resource_id=entry_id,
                    permission='read',
                    user_group_ids=user_group_ids,
                    db=db,
                )
            ):
                accessible.append(entry)
    return accessible


async def can_read_all_folder_files(
    entries: list[dict] | None,
    user: UserModel,
    db: AsyncSession | None = None,
) -> bool:
    if entries is None:
        return True
    if not isinstance(entries, list):
        return False
    if not entries:
        return True

    return len(await get_accessible_folder_files(entries, user, db=db)) == len(entries)


async def get_owner_accessible_folder_files(folder: FolderModel, db: AsyncSession | None = None) -> list[dict]:
    """Return the folder entries its owner can still delegate."""
    files = (folder.data or {}).get('files') or []
    if not files:
        return []

    owner = await Users.get_user_by_id(folder.user_id, db=db)
    if not owner:
        return []

    return await get_accessible_folder_files(files, owner, db=db)

```

### Core Architecture Module: `backend/open_webui/utils/access_control/folders.py`
```
from open_webui.models.access_grants import AccessGrants
from open_webui.models.folders import FolderModel, Folders
from sqlalchemy.ext.asyncio import AsyncSession


async def has_folder_access(user_id: str, folder: FolderModel, permission: str, db: AsyncSession | None) -> bool:
    """Check if user has access to folder directly or via ancestor inheritance."""
    # A corrupt parent loop must not spin forever
    seen_ids = set()
    while folder and folder.id not in seen_ids:
        seen_ids.add(folder.id)

        if folder.user_id == user_id:
            return True

        if await AccessGrants.has_access(
            user_id=user_id,
            resource_type='folder',
            resource_id=folder.id,
            permission=permission,
            db=db,
        ):
            return True

        folder = await Folders.get_folder_by_id(folder.parent_id, db=db) if folder.parent_id else None
    return False


async def has_folder_write_access(user_id: str, folder_id: str, db: AsyncSession | None = None) -> bool:
    """Check write access on the folder with this id; False if no such folder exists."""
    folder = await Folders.get_folder_by_id(folder_id, db=db)
    if not folder:
        return False
    return await has_folder_access(user_id, folder, 'write', db)

```

### Core Architecture Module: `backend/open_webui/utils/actions.py`
```
import inspect
import logging
import sys
from typing import Any

from fastapi import Request
from open_webui.env import ENABLE_PLUGINS, GLOBAL_LOG_LEVEL
from open_webui.models.functions import Functions
from open_webui.models.users import UserModel
from open_webui.socket.main import get_event_call, get_event_emitter
from open_webui.utils.middleware import process_tool_result
from open_webui.utils.models import check_model_access, get_all_models
from open_webui.utils.plugin import get_function_module_from_cache

logging.basicConfig(stream=sys.stdout, level=GLOBAL_LOG_LEVEL)
log = logging.getLogger(__name__)


async def chat_action(request: Request, action_id: str, form_data: dict, user: Any):
    if not ENABLE_PLUGINS:
        raise Exception('Plugins are disabled by ENABLE_PLUGINS=false')

    if '.' in action_id:
        action_id, sub_action_id = action_id.split('.')
    else:
        sub_action_id = None

    action = await Functions.get_function_by_id(action_id)
    if not action:
        raise Exception(f'Action not found: {action_id}')

    if not request.app.state.MODELS:
        await get_all_models(request, user=user)

    if getattr(request.state, 'direct', False) and hasattr(request.state, 'model'):
        models = {
            request.state.model['id']: request.state.model,
        }
    else:
        models = request.app.state.MODELS

    data = form_data
    model_id = data['model']

    if model_id not in models:
        raise Exception('Model not found')
    model = models[model_id]

    # Availability gate — keep this route consistent with the actions a model
    # actually surfaces to the client. Executing admin-authored Function code is
    # intended; this only stops a disabled, unassigned, or access-restricted
    # action from being reached by calling the route with a raw action_id.
    if action.type != 'action' or not action.is_active:
        raise Exception(f'Action not available: {action_id}')

    # Direct connections carry a client-supplied model the caller already owns,
    # so scope the model-bound checks to server-resolved models.
    if not getattr(request.state, 'direct', False) and user.role != 'admin':
        await check_model_access(user, model)
        # model['actions'] entries are '<function_id>' or '<function_id>.<sub_id>';
        # the function id is always the prefix.
        surfaced_action_ids = {item.get('id', '').split('.', 1)[0] for item in model.get('actions', [])}
        if action_id not in surfaced_action_ids:
            raise Exception(f'Action not available: {action_id}')

    __event_emitter__ = await get_event_emitter(
        {
            'chat_id': data['chat_id'],
            'message_id': data['id'],
            'session_id': data['session_id'],
            'user_id': user.id,
        }
    )
    __event_call__ = await get_event_call(
        {
            'chat_id': data['chat_id'],
            'message_id': data['id'],
            'session_id': data['session_id'],
            'user_id': user.id,
        }
    )

    function_module, _, _ = await get_function_module_from_cache(request, action_id)

    if hasattr(function_module, 'valves') and hasattr(function_module, 'Valves'):
        valves = await Functions.get_function_valves_by_id(action_id)
        function_module.valves = function_module.Valves(**(valves if valves else {}))

    if hasattr(function_module, 'action'):
        try:
            action = function_module.action

            # Get the signature of the function
            sig = inspect.signature(action)
            params = {'body': data}

            # Extra parameters to be passed to the function
            extra_params = {
                '__model__': model,
                '__id__': sub_action_id if sub_action_id is not None else action_id,
                '__event_emitter__': __event_emitter__,
                '__event_call__': __event_call__,
                '__request__': request,
            }

            # Add extra params in contained in function signature
            for key, value in extra_params.items():
                if key in sig.parameters:
                    params[key] = value

            if '__user__' in sig.parameters:
                __user__ = user.model_dump() if isinstance(user, UserModel) else {}

                try:
                    if hasattr(function_module, 'UserValves'):
                        __user__['valves'] = function_module.UserValves(
                            **await Functions.get_user_valves_by_id_and_user_id(action_id, user.id)
                        )
                except Exception as e:
                    log.exception(f'Failed to get user values: {e}')

                params = {**params, '__user__': __user__}

            if inspect.iscoroutinefunction(action):
                data = await action(**params)
            else:
                data = action(**params)

            # Process action result for Rich UI embeds (HTMLResponse, tuple with headers)
            processed_result, _, action_embeds = await process_tool_result(
                request,
                action_id,
                data,
                'action',
            )

            if action_embeds:
                await __event_emitter__(
                    {
                        'type': 'embeds',
                        'data': {
                            'embeds': action_embeds,
                        },
                    }
                )
                # Replace data with the processed status dict so we don't
                # try to serialize the raw HTMLResponse / tuple back to the client
                data = processed_result

        except Exception as e:
            raise Exception(f'Error: {e}')

    return data

```

### Core Architecture Module: `backend/open_webui/utils/anthropic.py`
```
import logging

import aiohttp
from open_webui.env import (
    AIOHTTP_CLIENT_SESSION_SSL,
    AIOHTTP_CLIENT_TIMEOUT_MODEL_LIST,
    ENABLE_FORWARD_USER_INFO_HEADERS,
)
from open_webui.models.users import UserModel
from open_webui.utils.headers import include_user_info_headers
from open_webui.utils.json_codec import JSONCodec

log = logging.getLogger(__name__)

ANTHROPIC_VERSION = '2023-06-01'

ANTHROPIC_CONVERTED_REQUEST_PARAMS = {
    'model',
    'messages',
    'system',
    'max_tokens',
    'temperature',
    'top_p',
    'top_k',
    'stop_sequences',
    'stream',
    'metadata',
    'service_tier',
    'tools',
    'tool_choice',
    'reasoning_effort',
}


def is_anthropic_url(url: str) -> bool:
    """Check if the URL is an Anthropic API endpoint."""
    return 'api.anthropic.com' in url


async def get_anthropic_models(url: str, key: str, user: UserModel = None) -> dict:
    """
    Fetch models from Anthropic's /v1/models endpoint with pagination.
    Normalizes the response to OpenAI format.
    """
    timeout = aiohttp.ClientTimeout(total=AIOHTTP_CLIENT_TIMEOUT_MODEL_LIST)
    all_models = []
    after_id = None

    try:
        async with aiohttp.ClientSession(timeout=timeout, trust_env=True) as session:
            headers = {
                'x-api-key': key,
                'anthropic-version': ANTHROPIC_VERSION,
            }

            if ENABLE_FORWARD_USER_INFO_HEADERS and user:
                headers = include_user_info_headers(headers, user)

            while True:
                params = {'limit': 1000}
                if after_id:
                    params['after_id'] = after_id

                async with session.get(
                    f'{url}/models',
                    headers=headers,
                    params=params,
                    ssl=AIOHTTP_CLIENT_SESSION_SSL,
                ) as response:
                    if response.status != 200:
                        error_detail = f'HTTP Error: {response.status}'
                        try:
                            res = await response.json()
                            if 'error' in res:
                                error_detail = f'External Error: {res["error"]}'
                        except Exception:
                            pass
                        return {'object': 'list', 'data': [], 'error': error_detail}

                    data = await response.json()

                    for model in data.get('data', []):
                        all_models.append(
                            {
                                'id': model.get('id'),
                                'object': 'model',
                                'created': 0,
                                'owned_by': 'anthropic',
                                'name': model.get('display_name', model.get('id')),
                            }
                        )

                    if not data.get('has_more', False):
                        break
                    after_id = data.get('last_id')

    except Exception as e:
        log.error(f'Anthropic connection error: {e}')
        return None

    return {'object': 'list', 'data': all_models}


##############################
#
# Anthropic Messages API Conversion Utilities
#
##############################


def _copy_cache_control(source: dict, target: dict) -> dict:
    if isinstance(source, dict) and 'cache_control' in source:
        target['cache_control'] = source['cache_control']
    return target


def _has_cache_control(blocks: list) -> bool:
    return any(isinstance(block, dict) and 'cache_control' in block for block in blocks)


def _finalize_openai_content(blocks: list) -> str | list:
    if not blocks:
        return ''

    if len(blocks) == 1 and blocks[0].get('type') == 'text' and not _has_cache_control(blocks):
        return blocks[0].get('text', '')

    return blocks


def is_anthropic_messages_passthrough(url: str, api_config: dict | None = None) -> bool:
    api_config = api_config or {}
    provider = str(api_config.get('provider', '')).lower()

    return is_anthropic_url(url or '') or provider == 'litellm'


def convert_anthropic_to_openai_payload(
    anthropic_payload: dict, passthrough_params: list[str] | str | None = None
) -> dict:
    """
    Convert an Anthropic Messages API request to OpenAI Chat Completions format.

    Anthropic format:
        {model, messages: [{role, content}], system, max_tokens, ...}
    OpenAI format:
        {model, messages: [{role, content}], max_tokens, ...}
    """
    openai_payload = {}

    # Model
    openai_payload['model'] = anthropic_payload.get('model', '')

    # Build messages list
    messages = []

    # System prompt (Anthropic has it as top-level, OpenAI as a system message)
    system = anthropic_payload.get('system')
    if system:
        if isinstance(system, str):
            messages.append({'role': 'system', 'content': system})
        elif isinstance(system, list):
            openai_content = []
            for block in system:
                if isinstance(block, dict) and block.get('type') == 'text':
                    openai_content.append(
                        _copy_cache_control(
                            block,
                            {
                                'type': 'text',
                                'text': block.get('text', ''),
                            },
                        )
                    )
                elif isinstance(block, str):
                    openai_content.append({'type': 'text', 'text': block})
            messages.append({'role': 'system', 'content': _finalize_openai_content(openai_content)})

    # Convert messages
    for msg in anthropic_payload.get('messages', []):
        role = msg.get('role', 'user')
        content = msg.get('content')

        if isinstance(content, str):
            messages.append({'role': role, 'content': content})
        elif isinstance(content, list):
            # Convert Anthropic content blocks to OpenAI format
            openai_content = []
            tool_calls = []

            for block in content:
                block_type = block.get('type', 'text')

                if block_type == 'text':
                    openai_content.append(
                        _copy_cache_control(
                            block,
                            {
                                'type': 'text',
                                'text': block.get('text', ''),
                            },
                        )
                    )
                elif block_type in ('thinking', 'redacted_thinking'):
                    # Unsigned thinking cannot be replayed upstream
                    if block_type == 'redacted_thinking' or block.get('signature'):
                        openai_content.append(_copy_cache_control(block, dict(block)))
                elif block_type == 'image':
                    source = block.get('source', {})
                    if source.get('type') == 'base64':
                        media_type = source.get('media_type', 'image/png')
                        data = source.get('data', '')
                        openai_content.append(
                            _copy_cache_control(
                                block,
                                {
                                    'type': 'image_url',
                                    'image_url': {
                                        'url': f'data:{media_type};base64,{data}',
                                    },
                                },
                            )
                        )
                    elif source.get('type') == 'url':
                        openai_content.append(
                            _copy_cache_control(
                                block,
                                {
                                    'type': 'image_url',
                                    'image_url': {'url': source.get('url', '')},
                                },
                            )
                        )
                elif block_type == 'tool_use':
                    tool_calls.append(
                        {
                            'id': block.get('id', ''),
                            'type': 'function',
                            'function': {
                                'name': block.get('name', ''),
                                'arguments': (
                                    JSONCodec.dumps(block.get('input', {}))
                                    if isinstance(block.get('input'), dict)
                                    else str(block.get('input', '{}'))
                                ),
                            },
                        }
                    )
                elif block_type == 'tool_result':
                    # Tool results become separate tool messages in OpenAI format
                    tool_result_content = block.get('content', '')
                    tool_content: str | list = ''

                    if isinstance(tool_result_content, str):
                        tool_content = tool_result_content
                    elif isinstance(tool_result_content, list):
                        # Build a multimodal content array to preserve
                        # images and other non-text content types.
                        converted_parts = []
                        for content_block in tool_result_content:
                            if not isinstance(content_block, dict):
                                continue
                            content_type = content_block.get('type', 'text')

                            if content_type == 'text':
                                converted_parts.append(
                                    _copy_cache_control(
                                        content_block,
                                        {
                                            'type': 
```

### Core Architecture Module: `backend/open_webui/utils/asgi_middleware.py`
```
"""
Pure-ASGI replacements for the project's previous
`@app.middleware('http')` / `BaseHTTPMiddleware` middlewares.

Why this matters
----------------
Starlette's `BaseHTTPMiddleware` (which `@app.middleware('http')` is
sugar for) runs the downstream app inside an `anyio` task group. When
the wrapper exits — for any reason: response complete, client
disconnect, an outer middleware bailing out — the task group cancels
the inner task. That `CancelledError` then propagates into whatever
the inner task was doing, including in-flight DB queries, embedding
calls and disk I/O.

In Open WebUI this surfaces as:

* SQLAlchemy logging multi-page `NotImplementedError:
  terminate_force_close()` tracebacks at ERROR every time a request is
  cancelled mid-DB-call (the aiosqlite connector cleanup path).
* Spurious cancellations cascading through the four stacked
  `@app.middleware('http')` wrappers.

Pure ASGI middleware does not introduce a cancel scope around the
downstream app, so client disconnects propagate the way ASGI was
designed to (via `receive()` returning `http.disconnect`) instead of
being injected as `CancelledError` into arbitrary `await` points.

Reference: https://www.starlette.io/middleware/#limitations
"""

from __future__ import annotations

import logging
import re
import time
from urllib.parse import parse_qs, urlencode

from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials
from open_webui.env import CUSTOM_API_KEY_HEADER
from open_webui.internal.db import ScopedSession
from open_webui.utils.auth import get_http_authorization_cred
from open_webui.utils.security_headers import set_security_headers
from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

log = logging.getLogger(__name__)


class AppHTTPMiddleware:
    """Open WebUI's pure-ASGI HTTP middleware.

    Keeps the app's request-wide behavior in one middleware layer without
    hiding the old concerns behind a stack of wrappers:

    * reject malformed `/ws/socket.io` upgrade requests
    * stash bearer/cookie/API-key credentials on `request.state.token`
    * stamp `X-Process-Time` and configured security headers
    * serve the legacy `/watch` and `?shared=` redirects
    * commit and release the thread-local sync `ScopedSession`

    Most requests now use the async session; the sync ScopedSession is
    only touched by startup, healthchecks, and a handful of legacy
    helpers (notably the pgvector / opengauss vector-DB clients). The
    middleware exists so that PostgreSQL connections do not accumulate
    as "idle in transaction" and so that any pending sync work made
    inside the request is durably persisted.

    Failure semantics
    -----------------
    * Downstream raised → roll back any pending sync work, release the
      connection, and re-raise so the outer exception middleware can
      turn it into an error response. We never commit work on a
      request that did not complete successfully.
    * Downstream returned → commit pending sync work; on commit
      failure, log loudly, roll back, and re-raise. Note that in pure
      ASGI the response messages have already been emitted by the
      time `await self.app(...)` returns, so a commit failure cannot
      retroactively change what the client sees on the wire — but
      re-raising still surfaces the error in logs and to ASGI servers
      that expose it. We deliberately do not buffer the response to
      gate it on commit success, because that would defeat streaming
      responses (chat completions, SSE) which are core to the app.

    For request paths where commit-before-send is required, manage the
    sync session explicitly inside the handler instead of relying on
    this middleware.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        # Headers derive only from env vars, which are static for the process
        # lifetime — compute them once instead of per response.
        self._security_headers = list(set_security_headers().items())

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        if await self._reject_invalid_websocket(scope, receive, send):
            return

        start_time = time.monotonic()
        request = Request(scope)
        self._set_token(request)
        send_with_headers = self._send_with_headers(send, start_time)

        try:
            if await self._redirect_legacy_url(scope, receive, send_with_headers):
                pass
            # Keep health probes independent from sync session commit/remove so DB
            # pressure cannot delay or fail probe responses.
            elif scope.get('path', '') in {'/health', '/ready', '/health/db'}:
                await self.app(scope, receive, send_with_headers)
                return
            else:
                await self.app(scope, receive, send_with_headers)
        except BaseException:
            self._rollback_session('AppHTTPMiddleware: rollback failed after downstream error')
            raise

        self._commit_session()

    def _set_token(self, request: Request) -> None:
        token = get_http_authorization_cred(request.headers.get('Authorization'))
        if token is None and (cookie_token := request.cookies.get('token')):
            token = HTTPAuthorizationCredentials(scheme='Bearer', credentials=cookie_token)
        if token is None and (api_key := request.headers.get(CUSTOM_API_KEY_HEADER)):
            token = HTTPAuthorizationCredentials(scheme='Bearer', credentials=api_key)
        request.state.token = token

    def _send_with_headers(self, send: Send, start_time: float) -> Send:
        async def send_with_headers(message: Message) -> None:
            if message['type'] == 'http.response.start':
                headers = MutableHeaders(scope=message)
                headers['X-Process-Time'] = f'{time.monotonic() - start_time:.6f}'
                for key, value in self._security_headers:
                    headers[key] = value
            await send(message)

        return send_with_headers

    async def _reject_invalid_websocket(self, scope: Scope, receive: Receive, send: Send) -> bool:
        path = scope.get('path', '')
        if '/ws/socket.io' not in path:
            return False

        query_params = parse_qs(scope.get('query_string', b'').decode('latin-1', errors='replace'))
        if query_params.get('transport', [''])[0] != 'websocket':
            return False

        headers = _scope_headers(scope)
        upgrade = headers.get('upgrade', '').lower()
        connection_tokens = [token.strip() for token in headers.get('connection', '').lower().split(',')]
        if upgrade == 'websocket' and 'upgrade' in connection_tokens:
            return False

        response = JSONResponse(status_code=400, content={'detail': 'Invalid WebSocket upgrade request'})
        await response(scope, receive, send)
        return True

    async def _redirect_legacy_url(self, scope: Scope, receive: Receive, send: Send) -> bool:
        if scope.get('method', '').upper() != 'GET':
            return False

        path = scope.get('path', '')
        raw_query = scope.get('query_string', b'')
        # This middleware only acts on /watch?v= and ?shared= URLs; skip the
        # decode + parse_qs work for every other GET. (A false positive on the
        # substring check just falls through to the full parse below.)
        if not (path.endswith('/watch') or b'shared' in raw_query):
            return False

        query_params = parse_qs(raw_query.decode('latin-1', errors='replace'))

        redirect_params: dict[str, str] = {}
        if path.endswith('/watch') and 'v' in query_params and query_params['v']:
            redirect_params['youtube'] = query_params['v'][0]

        if 'shared' in query_params and query_params['shared']:
            text = query_params['shared'][0]
            if text:
                url_match = re.match(r'https://\S+', text)
                if url_match:
                    # Local import: youtube loader pulls heavy deps and is
                    # only needed when a share-target actually contains a
                    # YouTube URL.
                    from open_webui.retrieval.loaders.youtube import _parse_video_id

                    youtube_video_id = _parse_video_id(url_match[0])
                    if youtube_video_id:
                        redirect_params['youtube'] = youtube_video_id
                    else:
                        redirect_params['load-url'] = url_match[0]
                else:
                    redirect_params['q'] = text

        if redirect_params:
            redirect_url = f'/?{urlencode(redirect_params)}'
            response = RedirectResponse(url=redirect_url)
            await response(scope, receive, send)
            return True

        return False

    def _rollback_session(self, message: str) -> None:
        if not ScopedSession.registry.has():
            return

        try:
            ScopedSession.rollback()
        except Exception:
            log.exception(message)
        finally:
            ScopedSession.remove()

    def _commit_session(self) -> None:
        # Nothing in this request touched the sync session: committing would
        # only instantiate one to run an empty transaction.
        if not ScopedSession.registry.has():
            return

        try:
            ScopedSession.commit()
        except Exception:
            log.exception('AppHTTPMiddleware: post-request commit failed; response was already sent to client')
            try:
                ScopedSession.rollback()
            except Exception:
                log.exception('AppHTTPMiddleware: rollback failed after commit failure')
            
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #31942** (2026-10-05): **issue: with CHUNK_MIN_SIZE_TARGET set, page 2 text is cited with page 1's page number**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Docker  ### Open WebUI Version  v0.11.4 and `dev` at 4424ae6 (`ghcr.io/open-webui/open-webui:git-4424ae6`), tested 2026-10-05  ### Operating System  macOS 27.0.1 (arm64), Docker Desktop 4.76.0 (Engine 29.5.2)  ### Browser  Not browser-specific; reproduced through the API and through a chat session over the same socket connection the web UI uses.  ### Ollama Version  Not applicable (OpenAI-compatible endpoints).  ### Summary  With `CHUNK_MIN_SIZE_TARGET` set (it defaults to 0, so the default configuration is not affected), short chunks from pages 1 and 2 of a PDF are merged and keep only page 1's metadata. Text that is only on page 2 is stored and returned with `page: 0`, and the sources sent to the chat for it carry `page_label: "1"`. Reproduced on PGVector and Qdrant.  ### Expected Behavior  A chunk's page metadata matches its text: either chunks are not merged across pages, or the merged chunk records the page range.  ### Actual Behavior  Same on both versions, for a three-page PDF with a sentence that appears only on page 2: -
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#19595](https://github.com/open-webui/open-webui/issues/19595) **feat: Intelligent Minimum Chunk Merging (Token & Character Thresholds) to Prevent RAG Fragmentation**    *Related to the same chunk-merging mechanism in ingestion. That issue proposes minimum chunk merging to reduce micro-chunks, and the newly-opened bug shows a metadata side effect when merged chunks span multiple pages.*    *by Classic298*  2. 🟣 [#20435](https://github.com/open-webui/open-webui/issues/20435) **Chunk-level citation issue: Different citation markers show identical retrieved chunks in RAG answers**    *This is a citation/display bug in RAG answers. While it is not about page metadata specifically, it concerns how retrieved chunks are surfaced as citations, which is the visible symptom area affected by
  > This is literally documented behaviour. When small chunks are merged, the merged chunk keeps the metadata of the first chunk in the merge, so its citation points to the page where the chunk starts. That is described in the chunking section of the RAG docs: https://docs.openwebui.com/features/chat-conversations/rag#chunking-configuration  If exact per-page citations matter more than fewer, larger chunks, set `CHUNK_MIN_SIZE_TARGET` to `0`, which is the default. Every page then gets its own chunks with its own page number, as your second test shows.

- **Issue #31940** (2026-10-05): **issue: knowledge search returns no results instead of an error when the vector database is down**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Docker  ### Open WebUI Version  v0.11.4 and `dev` at 4424ae6 (`ghcr.io/open-webui/open-webui:git-4424ae6`), tested 2026-10-05  ### Operating System  macOS 27.0.1 (arm64), Docker Desktop 4.76.0 (Engine 29.5.2)  ### Browser  Not browser-specific; reproduced through the API and through a chat session over the same socket connection the web UI uses.  ### Ollama Version  Not applicable (OpenAI-compatible endpoints).  ### Summary  When the vector database is down (hybrid search off), knowledge search behaves as if there were nothing to find. `POST /api/v1/retrieval/query/collection` returns 200 with no documents for a knowledge base that returned 5 documents a moment earlier, and in chat the knowledge tool hands the model an empty list (`[]`), so the model answers without the knowledge base and the chat shows no error. On PGVector, which the docs call "officially supported and maintained", `/query/doc` also returns 200 (`null`).  ### Expected Behavior  A failed search is reported as a failure: the API returns an error (as `/query/doc` 
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#26311](https://github.com/open-webui/open-webui/issues/26311) **bug: [dev] Async knowledge retrieval crashes with 'NoneType' object has no attribute 'ids' on empty collection / vector DB error**    *This is the closest prior report of knowledge retrieval swallowing vector-DB failures and treating them like an empty result instead of an error. Your issue extends that same failure mode to the synchronous /query/collection path and to PGVector/Qdrant being down.*    *by jleinenbach*  2. 🟣 [#30133](https://github.com/open-webui/open-webui/issues/30133) **issue: a pgvector read that returns nothing never gives its connection back**    *This PGVector issue is directly related because it shows PGVector search can return an empty result path without properly signaling a failure, which is
  > > and the chat shows no error.  Should the chat error out when the Vector DB Is unreachable? I think the current behaviour is correct. Why should Open WebUI error out the chat here? Makes no sense. This turns a partial outage affecting only Vector DBs into a broader availability loss including many chats.

- **Issue #31939** (2026-10-05): **issue: re-processing an already processed file reports completed but keeps its old vectors**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Docker  ### Open WebUI Version  v0.11.4 and `dev` at 4424ae6 (`ghcr.io/open-webui/open-webui:git-4424ae6`), tested 2026-10-05  ### Operating System  macOS 27.0.1 (arm64), Docker Desktop 4.76.0 (Engine 29.5.2)  ### Browser  Not applicable; reproduced through the API.  ### Ollama Version  Not applicable (OpenAI-compatible embedding endpoint).  ### Summary  Re-processing a file to fix a bad extraction (`POST /api/v1/retrieval/process/file` with its `file_id`) stores the new text and hash and reports `completed`, but the file's vectors still hold the old text. Updating the file in its knowledge base copies the old vectors back, and uploading the corrected document again is then rejected as duplicate content. The knowledge base keeps answering from the old text, and the documented fix (re-upload) is blocked. Reproduced on PGVector and Qdrant.  ### Expected Behavior  After `completed`, the stored text, hash and vectors come from the same extraction, or the request is rejected before the file is changed.  ### Actual Behavior  Same on bo
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#31912](https://github.com/open-webui/open-webui/issues/31912) **Issue #31912**    *This report is closely related because it also concerns file-content updates not propagating correctly across storage/indexed representations. Both issues describe a successful API response while the underlying file state and retrieval state become inconsistent.*    *by unknown*  2. 🟢 [#27987](https://github.com/open-webui/open-webui/issues/27987) **issue: Silent failures in background knowledge file processing: orphaned files, sync/diff re-upload loop, and a duplicate-content race that links zero or two copies**    *This is related because it covers background knowledge-file processing and duplicate-content/re-upload failure modes in the same file ingestion pipeline. It discusses sync/re-upload lo
  > To get a file read again, delete it from the knowledge base and upload it again. That is also exactly what OIKB does when a source file changes: https://github.com/open-webui/oikb  I don't know what you did here. What you did is not how you reprocess a file in Open WebUI so this bug report does not hold.  Calling the process endpoint a second time on an already-processed file is a call pattern none of the supported tools use, so closing this. The duplicate-content rejection only happens because the old file is still in the knowledge base. Once it is removed, the new upload goes through.

- **Issue #31923** (2026-10-05): **issue: Deleting a group leaves its access grants behind, and the Access dialog hides them but saves them again**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Git Clone  ### Open WebUI Version  `dev` at 743a46b  ### Operating System  Linux  ### Browser  Firefox and Chromium  ### Ollama Version  0.35.1  ### Summary  When a group that a model is shared with is deleted, the model keeps its grant for that group. Admin Panel > Settings > Models then shows the model as **Shared**, but its Access dialog says **Private** with "No access grants. Private to you.", so there is nothing to remove. Saving the model as Private writes the deleted group's grant back, so the model stays **Shared** and the grant can't be removed from the UI.  ### Expected Behavior  Deleting a group removes what was shared with it, so a model shared only with that group becomes Private. At the least, the Access dialog shows the leftover grant so it can be removed, and saving as Private leaves no grants behind.  ### Actual Behavior  The grant for the deleted group stays on the model. The models list counts it and shows **Shared**, while the Access dialog leaves it out of the Access List, because there is no group left to s
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#26788](https://github.com/open-webui/open-webui/issues/26788) **issue: User Model Access for removed models persists**    *This is the closest match: it reports that access control rows persist after a model/provider is deleted, leaving phantom permissions behind. Your issue is the same persistence problem, but specifically for deleted groups and the model Access dialog.*    *by gregtakacs · `bug`*  2. 🟣 [#20701](https://github.com/open-webui/open-webui/issues/20701) **Issue: Group Sharing Permissions Bug and OAuth Group Duplication**    *This issue is about group-sharing permission handling bugs, including group duplication and visibility problems. It is related because your report involves group grants and how the UI/backend interpret group-based sharing state.*    *by ghost · 
  > This is a security and data integrity issue. Deleting a group but leaving access grants behind means users retain permissions they shouldn't have.  The fix is to cascade delete access grants when a group is deleted, or at least validate on save that all referenced groups exist.  Also the Access dialog should show orphaned grants with a warning instead of silently preserving them. This prevents accidental permission retention.
  > This is a stale-data cleanup and a misleading UI issue. Addressed in dev.

- **Issue #31913** (2026-10-05): **issue: context estimate counts inline base64 images in message files as text, triggering spurious compaction**
  *Symptoms*: ## Summary  `_estimate_messages_tokens` charges a message's `files` field through `_estimate_tokens`, which JSON-serializes the value and returns `len // 4`. Any inline `data:` URI stored in `files` is therefore billed as if it were plain text.  This is still present on `dev` as of `context_compaction.py` line 442:  ```python total += _estimate_tokens(message.get('files')) ```  and `_estimate_tokens` (line 446) does:  ```python return max(1, len(value) // 4) ```  So a base64 payload that should cost a flat image rate is billed at roughly 1 token per 4 base64 characters.  ## Why this is worth reopening  #29761 was closed on 2026-09-14 on the strength of #29765. That PR was never merged — its head branch `fix/tool-image-file-refs` no longer exists, and its only two files were `files.py` and `middleware.py`. `context_compaction.py` was never touched.  The 230x improvement in @tastyrice90's verification came from stopping base64 from being *persisted* in the first place, which addresses the symptom at the writer. But it leaves the estimator path itself unchanged, so the defect survives for any base64 that still reaches `files` by any other route — including messages already persisted by earlier builds, and any other `data:` URI field.  ## Impact  For a ~3 MB image (~4,197,680 base64 chars) in a single `files` entry:  - estimated: **~1,049,420 tokens** for one message - actual image cost: **~1,000 tokens** (the flat rate already used for `image` / `image_url` at line 434)  That is
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#29761](https://github.com/open-webui/open-webui/issues/29761) **bug: context usage estimator counts base64 image data URIs in message files as text, causing spurious auto-compaction**    *This is the same underlying bug report: the context estimator counts inline base64 image data stored in `files` as text via the `len // 4` fallback, which causes spurious auto-compaction. The new issue adds a specific explanation that `files` on `dev` still go through `_estimate_tokens`, but the core symptom and path are already documented here.*    *by tastyrice90 · `bug`, `confirmed issue`*  2. 🟢 [#29748](https://github.com/open-webui/open-webui/issues/29748) **feat: Include message timestamps and attachment placeholders in {{COMPACTED_MESSAGES}} serialization for context compaction**    *This
  > opened a PR to fix it. the writer side was already fixed in 0.11.4, new tool images in saved chats are stored as files now. what's left is images that were stored inline before that, plus images that could not be saved, and those still blew up the estimate. the PR leaves inline image data out of the count entirely.
  > https://github.com/open-webui/open-webui/pull/31915

- **Issue #31909** (2026-10-04): **bug: Removing a model from a connection's Model IDs allowlist leaves an orphaned model table row that keeps rendering in Admin → Settings → Models**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Docker  ### Open WebUI Version  v0.11.4 (latest release) AND current `dev` (checked immediately before submitting; dev image reports version 0.11.4)  ### Operating System  Linux (Ubuntu-based host, kernel 5.15), Docker Engine  ### Browser  Chrome (also reproduced via raw API calls, so it is not browser-specific)  ### Ollama Version  Not applicable (no Ollama in the repro; `[OI]`-compatible connection only)  ### Summary  Removing a model from an `[OI]`-compatible connection's **Model IDs** allowlist (Admin Panel → Settings → Connections → connection settings → minus button on a model → Save) does not delete that model's row from the `model` table. If the row exists (created earlier by any admin-panel interaction with that model, e.g. the visibility/access toggle), it becomes an orphaned stub after the removal, and the **Admin Panel → Settings → Models tab keeps rendering the removed model**. The model appears to "come back" after the removal, and re-opening the connection settings shows it in the allowlist UI again.  The connectio
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#26788](https://github.com/open-webui/open-webui/issues/26788) **issue: User Model Access for removed models persists**    *This is the closest prior bug: when a model/provider is removed, its access-control entries persist and become phantom data. Your report is the same class of stale state problem, but specifically for connection-derived model rows in the Admin Models tab.*    *by gregtakacs · `bug`*  2. 🟢 [#26812](https://github.com/open-webui/open-webui/issues/26812) **feat: Ability to clean up orphaned model permissions**    *This feature request explicitly describes the underlying need to clean up orphaned model permissions and references the stale-permissions behavior after models disappear. It aligns with your report’s root cause and proposed fix direction for orphaned co
  > Partly reproduced on the latest dev branch (743a46b): after a model is removed from a connection's Model IDs, its saved model entry stays and Admin Panel > Settings > Models still lists it. The connection's Model IDs list did not get the model back, including after a full page reload.  Steps I followed:  Setup: the `ghcr.io/open-webui/open-webui:dev` image at 743a46b in a fresh container, auth on, Ollama off, and one OpenAI-compatible connection to a stub server whose `/v1/models` returns `mock-model-alpha` and `mock-model-beta`.  1. Signed up the admin. `GET /api/models` listed both models. 2. `POST /api/v1/models/model/access/update` with `{"id": "mock-model-beta", "name": "mock-model-beta", "access_grants": []}` returned 200, and the `model` table then held `mock-model-beta`. 3. Removed `mock-model-beta` from the connection's Model IDs with `POST /openai/config/update` (`model_ids: ["mock-model-alpha"]`). Then I put both models back and removed it again in the UI: Admin Panel > Sett
  > Duplicate of https://github.com/open-webui/open-webui/issues/26812 ? @silentoplayz 

- **Issue #31907** (2026-10-03): **issue: fetch_url loops indefinitely with no log output**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Docker  ### Open WebUI Version  dev (45f680f2bb11)  ### Operating System  Debian version 12.5  ### Browser  _No response_  ### Ollama Version  _No response_  ### Summary  `fetch_url` sometimes loops indefinitely without log output. This is not a model loop-call -- this is an issue with the tool itself.  It does not happen consistently. Sometimes fetches work fine; sometimes a few of them hang. Sometimes all of them hang. Might be related to unhandled timeouts during domain resolution or connection attempts.  ### Expected Behavior  `fetch_url` either resolves, retries a few times, or simply times out. It cannot simply hang.  ### Actual Behavior  Some `fetch_url` calls hang indefinitely -- no log output whatsoever.  ### Steps to Reproduce  I used a test prompt in a capable model that says:      This is a test. Search for the “test” term in several different web search calls and fetch the pages that you find.     Do only web searches and fetches. Try fetching at least ten different pages so that I can stress test the backend.  The m
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#29773](https://github.com/open-webui/open-webui/issues/29773) **issue: fetch_url can remain stuck indefinitely with remote Playwright while browser and network are idle**    *This is the closest match: it reports fetch_url calls remaining in an executing state indefinitely, with the UI stuck on 'fetch_url executing...' and no completion or timeout. The new issue also describes fetch_url hanging indefinitely, intermittently, with no log output.*    *by feklandhd2-dev · `bug`*  2. 🟣 [#29741](https://github.com/open-webui/open-webui/issues/29741) **issue: Playwright Fetch URL becomes extremely slow / appears stuck on pages with many media resources**    *This issue describes fetch_url appearing to hang indefinitely in the Playwright-based loader when pages trigger many resource load
  > I have tested again using `GLOBAL_LOG_LEVEL=DEBUG`. The following shows up:  ``` 2026-10-03 13:55:56.943 | DEBUG    | urllib3.connectionpool:_new_conn:1081 - Starting new HTTPS connection (1): en.wikipedia.org:443 2026-10-03 13:55:57.099 | DEBUG    | urllib3.connectionpool:_make_request:550 - https://en.wikipedia.org:443 "GET /wiki/Test HTTP/1.1" 403 126 2026-10-03 13:55:57.113 | DEBUG    | open_webui.retrieval.web.utils:get_web_loader:1149 - Using WEB_LOADER_ENGINE SafeWebBaseLoader for 1 URLs 2026-10-03 13:55:57.117 | DEBUG    | urllib3.connectionpool:_new_conn:1081 - Starting new HTTPS connection (1): en.wikipedia.org:443 2026-10-03 13:55:57.308 | DEBUG    | urllib3.connectionpool:_make_request:550 - https://en.wikipedia.org:443 "GET /wiki/Test HTTP/1.1" 200 87333 2026-10-03 13:55:57.652 | DEBUG    | urllib3.connectionpool:_new_conn:1081 - Starting new HTTPS connection (1): www.merriam-webster.com:443 2026-10-03 13:56:01.280 | DEBUG    | urllib3.connectionpool:_make_request:550 - ht
  > This is the documented behaviour of the Default web loader when no timeout is set. Your debug log shows it: the request to wirple.com connects and the site never answers, and since no timeout is configured, the fetch waits forever.  Set a timeout in Admin Settings > Web Search > Timeout (only shown while the loader is Default), or with the env var:  ``` WEB_LOADER_TIMEOUT=15 ```  https://docs.openwebui.com/reference/env-configuration#web_loader_timeout

- **Issue #31876** (2026-10-05): **issue: Tap to interrupt in Voice mode only skips to the next sentence**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Git Clone  ### Open WebUI Version  `dev` at 7e6c8d7b6  ### Operating System  Linux, and iOS version 26.4 on an iPhone 13 Pro  ### Browser  Firefox on Linux, and Open WebUI added to the Home Screen on the iPhone  ### Ollama Version  N/A  ### Summary  In **Voice mode**, with **Response Splitting** set to **Punctuation**, tapping **Tap to interrupt** stops only the sentence being read. The next sentence of the same reply starts right away and the rest of the reply is read to the end. The screen already shows **Listening...** during this, so tapping again does nothing until the reply is finished.  ### Expected Behavior  **Tap to interrupt** stops the rest of the reply, as it does when **Response Splitting** is set to **None**.  ### Actual Behavior  Only the current sentence is stopped. The remaining sentences are read under **Listening...**, and they cannot be interrupted. **Paragraphs** behaves the same way, moving on to the next paragraph.  ### Steps to Reproduce  1. As an admin, set **Admin Panel** > **Settings** > **Audio** > **T
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#19861](https://github.com/open-webui/open-webui/issues/19861) **issue: TTS auto-playback (Read Aloud) drops sentences when Response Splitting is Punctuation or Paragraph**    *This is the closest prior bug report about response splitting with punctuation causing sentence-level TTS playback problems. Your issue is specifically about interruption not stopping the queued sentences, but both involve the punctuation-splitting Voice/Read Aloud path mishandling sentence sequencing.*    *by QuitHub · `bug`*  2. 🟢 [#30422](https://github.com/open-webui/open-webui/issues/30422) **feat: auto-playback should read responses sentence by sentence while streaming, like call mode**    *This open enhancement discusses the same Voice/Audio response-splitting pipeline and sentence-by-sentence playba
  > Opened as #31877.

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

### Incident Patch 1: `8bd8b4fa` (2026-09-21)
**Commit Message**: Merge pull request #29960 from open-webui/dev

0.11.4

**File**: `.dockerignore` (modified, +3/-0)
```diff
@@ -18,3 +18,6 @@ uploads
 **/*.db
 _test
 backend/data/*
+
+.venv
+.git
```

**File**: `.env.example` (modified, +3/-0)
```diff
@@ -22,6 +22,9 @@ ENABLE_RAG_CSV_SUMMARY=false
 # Set to true to preserve backing file records, storage blobs, and per-file vectors when files are removed from knowledge bases.
 ENABLE_KNOWLEDGE_FILE_RETENTION=false
 
+# Comma-separated chunk metadata keys to expose to the model alongside retrieved content.
+RAG_SOURCE_METADATA_KEYS=''
+
 # Set to false to disable workspace Tools and Functions.
 ENABLE_PLUGINS=true
 
```

**File**: `.github/ISSUE_TEMPLATE/bug_report.yaml` (modified, +3/-3)
```diff
@@ -12,6 +12,8 @@ body:
 
         Before submitting, search open and closed [Issues](https://github.com/open-webui/open-webui/issues) and [Discussions](https://github.com/open-webui/open-webui/discussions). The issue may already be reported or fixed on `dev`.
 
+        **Test on the latest release AND on `dev`, right before you submit this report, not last week.** A huge share of reports are for bugs already fixed on `dev`, sometimes weeks earlier, because the reporter only tested an old version and never rechecked. Reports that don't reproduce on latest and on current `dev` at submission time will be closed without further discussion, no exceptions.
+
         Please do not open a code pull request for this report unless a maintainer asks for one, or the change is only i18n/localization. If you want to share code as reference, include it here as a local diff or patch. Actionable reproduction details are the most useful next step.
 
         Security vulnerabilities must not be reported publicly. Use the [GitHub security page](https://github.com/open-webui/open-webui/security) instead.
@@ -23,12 +25,10 @@ body:
       options:
         - label: I searched open and closed issues and discussions for an existing report.
           required: true
-        - label: I checked whether this is already fixed on the `dev` branch or latest source.
+        - label: I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago.
           required: true
         - label: I understand that maintainers want a well-written issue before any code pull request.
           required: true
-        - label: I am using the latest available version of Open WebUI for my install method.
-          required: true
         - label: This is not a security vulnerability.
           required: true
 
```

**File**: `.github/pull_request_template.md` (modified, +13/-12)
```diff
@@ -1,31 +1,30 @@
 <!--
 Important checks for contributors:
-1. Target the `dev` branch. PRs targeting `main` will be closed.
-2. Code pull requests are not the default contribution path.
-3. Do not open a code PR as the first step. Start with a well-written Issue or Discussion unless a maintainer asked for the PR or the change is only i18n/localization.
-4. Do not delete the Contributor License Agreement section at the bottom. The CLA bot requires it.
+1. DO NOT OPEN A CODE PULL REQUEST unless a maintainer explicitly asked you to, or the change is strictly limited to i18n/localization.
+2. Target the `dev` branch. PRs targeting `main` will be closed.
+3. Do not delete the Contributor License Agreement section at the bottom. The CLA bot requires it.
 -->
 
 # Pull Request
 
-Thanks for wanting to improve Open WebUI. The most useful contribution is usually a clear, well-written Issue, not an unsolicited code pull request.
+**Do not open a code pull request unless a maintainer has explicitly requested it or the change is limited to i18n/localization.**
 
-Open a code pull request only when a maintainer asks for one, or when the change is only i18n/localization. For real, reproducible bugs, start with a well-described [Issue](https://github.com/open-webui/open-webui/issues). For feature requests, UI/UX changes, behavior changes, architecture changes, suspected fixes, or unconfirmed approaches, start with an active [Discussion](https://github.com/open-webui/open-webui/discussions).
+The most useful way to help is to give us a clear understanding of the problem: report reproducible bugs in [Issues](https://github.com/open-webui/open-webui/issues) and share proposals in [Discussions](https://github.com/open-webui/open-webui/discussions). We use that context to evaluate solutions and refine the implementation internally, accounting for the broader codebase and ongoing work. External implementations usually require substantial reworking to fit the project's standards, and coordinating those revisions usually takes more effort than developing the solution internally. Please follow this process before investing time in a pull request. PRs opened outside these guidelines are generally closed without review.
 
-Before continuing, make sure the linked Issue or Discussion explains the user-facing problem, the expected outcome, the affected workflow, and any examples, logs, screenshots, constraints, or reproduction details needed for maintainers to evaluate it.
+## Maintainer Request
 
-If you have implementation notes, include them as reference in the Issue or Discussion. If you want to share code as reference, include it there as a local diff, patch, or branch note. Do not open a pull request for reference code.
-
-Unsolicited PRs may be closed without review, especially when they introduce product, architecture, compatibility, dependency, or maintenance decisions that have not been discussed.
+Link the maintainer's request for this PR, or state that the change is limited to i18n/localization.
 
 ## Checklist
 
+- [ ] I have read and I understand the [contribution policy](https://docs.openwebui.com/contributing/#submit-code).
 - [ ] This PR targets the `dev` branch.
 - [ ] This PR links to a well-described, confirmed Issue or active Discussion: `Closes #___` / `Relates to #___`.
 - [ ] A maintainer explicitly asked me to open this PR, or this PR only updates i18n/localization.
 - [ ] The change is one logical unit with no unrelated commits.
 - [ ] I matched nearby code patterns and avoided unnecessary new settings, abstractions, or dependencies.
 - [ ] I manually tested the changed workflow and any nearby behavior that could be affected.
+- [ ] I have not added or rewritten automated tests, fixtures, snapshots, or testing infrastructure unless a maintainer explicitly requested them.
 - [ ] I updated relevant docs, including the [Open WebUI Docs Repository](https://github.com/open-webui/docs), if needed.
 - [ ] I added screenshots for UI changes, and a recording when motion or interaction matters.
 - [ ] I reviewed any AI-generated code before submitting it.
@@ -50,9 +49,11 @@ Use one of the following prefixes:
 
 Describe the change, the problem it solves, and the impact on users.
 
-## Testing
+## Verification
+
+Describe how you reproduced the problem and manually checked the behavior before and after the change. Include exact steps, setup details, and relevant logs, screenshots, or recordings. Report results from relevant existing checks and anything you could not verify.
 
-List the exact manual checks you ran. Include commands, setup details, screenshots, or recordings where helpful.
+Do not add or rewrite automated tests unless a maintainer explicitly requests them. Tests that repeat an implementation's assumptions can pass while preserving the same mistake; maintainers determine the regression coverage needed. Do not remove, disable, or weaken existing tests to make the change pass.
 
 ## Changelog Entry
 
```

**File**: `CHANGELOG.md` (modified, +248/-0)
```diff
@@ -5,6 +5,253 @@ All notable changes to this project will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
+## [0.11.4] - 2026-09-21
+
+### Added
+
+- 📉 **Far smaller slim image.** A slim build now comes down at around 175 MB, near enough 89% smaller than the last release, the local models, the packages around them and the tools that installed them all gone from it; what that changes about the way an instance behaves is set out under Changed below and in the documentation. [Commit](https://github.com/open-webui/open-webui/commit/cb942bb94c8dc7941336088fb3392e2398ff56c1), [Commit](https://github.com/open-webui/open-webui/commit/d27aa72ab4a7b5632b4ad49e8467081ad3d7ebb4)
+- 📦 **Smaller standard image.** The image no longer carries a second copy of Python, two sets of fonts nothing ever loaded, packages nothing imports, or the tool that installed them, taking about 170 MB off a standard build. [#29731](https://github.com/open-webui/open-webui/pull/29731), [#29723](https://github.com/open-webui/open-webui/pull/29723), [#29725](https://github.com/open-webui/open-webui/pull/29725), [#29726](https://github.com/open-webui/open-webui/pull/29726), [#29728](https://github.com/open-webui/open-webui/pull/29728), [Commit](https://github.com/open-webui/open-webui/commit/91f8775b28b52c9ae7f2ab990cf2490bda8055d6), [Commit](https://github.com/open-webui/open-webui/commit/98fcb844e1b19f7dd6289af26273cdec5447dc52), [Commit](https://github.com/open-webui/open-webui/commit/508de20779168003e538bb936b49a31d4a8fb8bb), [Commit](https://github.com/open-webui/open-webui/commit/a1c02098aa2687c72482a59117efe643b785df51)
+- 🧑‍💻 **Skills from a terminal.** Skills a connected terminal server offers now sit beside workspace skills everywhere skills are picked — the "$" and "/" menus, the integrations menu and the skills panel, each marked Terminal — and are used the same way: picking one puts its instructions, its folder and the files it ships with in front of the model, and a model that was only told a skill exists can open it itself. They follow whichever terminal is selected and clear when that changes. [Commit](https://github.com/open-webui/open-webui/commit/e69236bccb1e12d14045b09b76ebac0490014851)
+- 📔 **Terminal instructions file.** A model working with a terminal is now handed the AGENTS.md sitting in that terminal's home directory, read afresh at the start of every turn, so the instructions you keep beside your work reach the model without being pasted in. [Commit](https://github.com/open-webui/open-webui/commit/946be432375057dc18dbcc7c3513feb322a83a4b), [Commit](https://github.com/open-webui/open-webui/commit/f6922a4c4293449805938c80fbe54174994a1fc6)
+- 📇 **Automatic skill discovery.** Every skill you can reach is now listed to the model by name and description, and the full text of one is loaded only when it decides to use it; before, a skill you had not selected in the message box was invisible to it, and this applies to models with built-in tools on. [Commit](https://github.com/open-webui/open-webui/commit/e69236bccb1e12d14045b09b76ebac0490014851)
+- 🌄 **Model background images.** A workspace model can now carry a background image, uploaded in its editor and drawn behind the chat whenever that model is selected, sitting below a folder's own background and above your personal one, and it travels with the model through export and import. [Commit](https://github.com/open-webui/open-webui/commit/66addbd6b47bfb25cf9aa37ec70d24db5b28b6b6)
+- 📓 **Skill creation from a chat.** Typing "/skills:create" in a chat that already has content, with a terminal selected, turns the workflow you just went through into a reusable skill written to ".agents/skills" under that terminal's root working directory rather than whatever folder the shell happens to sit in, and authored to Open WebUI's skill standards. [Commit](https://github.com/open-webui/open-webui/commit/113c56fc8c1986359556107a20e206159ca32f59), [Commit](https://github.com/open-webui/open-webui/commit/924a4a10fbd0be508a69faf66bf08ac9761bc24d), [Commit](https://github.com/open-webui/open-webui/commit/58078ab3045cc7aee409d9215f68adf0e02c9165), [Commit](https://github.com/open-webui/open-webui/commit/d25f6c7135e0aee93dc2c840ce320d97617a6e47), [Commit](https://github.com/open-webui/open-webui/commit/a096961a31499be23890b98a040ecf2917405568)
+- 🖥️ **Terminal tabs per command.** The terminal pane now carries a tab for each command a model is running alongside your own shell, so you can watch them as they go, move between them and take the shell yourself, each tab opening with the command that produced it. Opening the pane puts you in a tab, starting your shell where nothing else is running, and closing the last tab folds the pane away again. [Commit](https://github.com/open-webui/open-webui/commit/54a7a7a7ce22725074c29c7e827446f5dce142
```

**File**: `CODE_OF_CONDUCT.md` (modified, +13/-2)
```diff
@@ -34,10 +34,21 @@ Examples of unacceptable behavior include:
 - **Spamming and promotional exploitation.** Sharing irrelevant product promotions or self-promotion in the community is not allowed unless it directly contributes value to the discussion.
 - Posting low-effort, hard to read, essay-length AI generated comments or other forms of low-quality, hard to parse content that puts the burden of understanding on the reader.
 
+### How We Develop the Project
+
+Development is led by the maintainers, and code pull requests are reserved for work we explicitly request or exceptional contributions we choose to consider at our discretion. We use actionable reports and concrete use cases to understand problems, then evaluate, revise, and implement the appropriate approach internally. We assess each change against the project's architecture, existing behavior, quality standards, and future direction before settling on an implementation. Resolving a reported problem requires that broader context, and a working external patch usually requires substantial rewriting to meet the project's standards. Reviewing the patch, explaining the required changes, and coordinating successive revisions usually takes more effort than developing the solution internally. Fragmented commit histories, branches that have not been rebased, unresolved conflicts, and lengthy or unverified AI-generated comments add cleanup and discussion that delay the underlying work. Maintainers remain responsible for testing, documenting, supporting, and maintaining every accepted change, so we choose the approach based on the whole product and its ongoing maintenance. Clear reports, reproduction details, and relevant context give us what we need to make those decisions and develop the solution. A polished implementation, clean commit history, or completed checklist does not establish an exception to this process, and opening an issue or discussion is not an invitation to submit a PR. Wait for an explicit maintainer request before investing in a PR; unsolicited submissions are generally closed without review, and requested PRs remain subject to maintainer judgment.
+
 ### Feedback and Community Engagement
 
-- **Constructive feedback is encouraged, but hostile or entitled behavior will result in immediate action.** If you disagree with elements of the project, we encourage you to offer meaningful improvements or fork the project if necessary. Healthy discussions and technical disagreements are welcome only when handled with professionalism.
-- **Respect contributors' time and efforts.** No one is entitled to personalized or on-demand assistance. This is a community built on collaboration and shared effort; demanding or demeaning behavior undermines that trust and will not be allowed.
+Participation should help maintainers understand a concrete problem while respecting the project's priorities and available capacity. Please follow the [issue templates](.github/ISSUE_TEMPLATE) and [pull request policy](.github/pull_request_template.md) before submitting anything.
+
+- **Make reports actionable.** Search existing issues and discussions, check the latest version and whether the problem is already addressed on `dev`, and use the appropriate template. Bug reports should describe a reproducible problem, the affected workflow, expected and actual behavior, and relevant evidence. Feature requests should explain the user-facing need; broader product, UX, architecture, or maintenance questions belong in Discussions. Report security concerns privately through the [security reporting process](https://github.com/open-webui/open-webui/security).
+- **Share the problem before investing in code.** Start with an actionable issue or discussion and leave implementation planning to the maintainers. An issue or discussion alone is not an invitation to submit a PR. Please wait for an explicit request before opening one; any exception is at the maintainers' discretion. Implementation notes, local diffs, or patches may be shared as reference in the relevant issue or discussion.
+- **Respect maintainers' discretion.** Submitting an issue, proposal, or pull request does not create an obligation to respond, review, implement, or merge it. Maintainers set the project's direction and defer or close submissions based on scope, quality, maintenance cost, or available capacity. Unsolicited pull requests are generally closed without review.
+- **Keep discussion focused and concise.** Provide new information when it helps evaluate the problem. Repeated bumps, duplicate submissions, unsolicited direct messages seeking attention, or pressure for timelines place an unnecessary burden on contributors.
+- **Respect decisions and boundaries.** Technical disagreement is welcome when expressed professionally. Reopening a declined request or continuing to press for a different outcome without new, relevant information is not constructive. You are free to explore a different direction in your own 
```

**File**: `Dockerfile` (modified, +32/-26)
```diff
@@ -26,6 +26,9 @@ ARG GID=0
 ######## WebUI frontend ########
 FROM --platform=$BUILDPLATFORM node:22-alpine3.20 AS build
 ARG BUILD_HASH
+ARG USE_SLIM
+ARG UID
+ARG GID
 
 # Set Node.js options (heap limit Allocation failed - JavaScript heap out of memory)
 # ENV NODE_OPTIONS="--max-old-space-size=4096"
@@ -40,7 +43,14 @@ RUN npm ci --force
 
 COPY . .
 ENV APP_BUILD_HASH=${BUILD_HASH}
-RUN npm run build
+RUN npm run build && \
+    if [ "$USE_SLIM" = "true" ]; then find build -type f -name '*.map' -delete; fi
+
+# Prepare backend ownership before the final copy so static assets occupy one layer.
+# Group 0 write access lets arbitrary OpenShift UIDs update these assets at startup.
+RUN chown -R $UID:$GID /app/backend && \
+    chgrp -R 0 /app/backend/open_webui/static && \
+    chmod -R g=u /app/backend/open_webui/static
 
 ######## WebUI backend ########
 FROM python:3.11-slim-bookworm AS base
@@ -123,24 +133,33 @@ RUN echo -n 00000000-0000-0000-0000-000000000000 > $HOME/.cache/chroma/telemetry
 # Make sure the user has access to the app and root directory
 RUN chown -R $UID:$GID /app $HOME
 
-# Install common system dependencies
+# Slim cannot bundle a local model server or GPU runtime.
+RUN if [ "$USE_SLIM" = "true" ] && { [ "$USE_CUDA" = "true" ] || [ "$USE_OLLAMA" = "true" ]; }; then \
+    echo "USE_SLIM cannot be combined with USE_CUDA or USE_OLLAMA" >&2; exit 1; fi
+
+# Keep the slim runtime free of local document/audio processing tools.
+# Git-based tool requirements require the standard image.
 RUN apt-get update && \
     apt-get install -y --no-install-recommends \
-    git build-essential pandoc gcc curl jq ca-certificates \
-    libmariadb-dev \
-    python3-dev \
-    ffmpeg libsm6 libxext6 zstd \
-    && rm -rf /var/lib/apt/lists/*
+    curl jq ca-certificates \
+    && if [ "$USE_SLIM" != "true" ]; then \
+    apt-get install -y --no-install-recommends \
+    git build-essential pandoc gcc libmariadb-dev ffmpeg libsm6 libxext6; \
+    fi && if [ "$USE_OLLAMA" = "true" ]; then \
+    apt-get install -y --no-install-recommends zstd; \
+    fi && rm -rf /var/lib/apt/lists/*
 
 # install python dependencies
-COPY --chown=$UID:$GID ./backend/requirements.txt ./requirements.txt
+COPY --chown=$UID:$GID ./backend/requirements*.txt ./
 
 # Set UV_LINK_MODE to copy to prevent 0-byte file corruption in QEMU arm64 cross-builds
 ENV UV_LINK_MODE=copy
 
-RUN set -e; \
-    pip3 install --no-cache-dir uv; \
-    if [ "$USE_CUDA" = "true" ]; then \
+RUN --mount=from=ghcr.io/astral-sh/uv:0.12.10,source=/uv,target=/bin/uv \
+    set -e; \
+    if [ "$USE_SLIM" = "true" ]; then \
+    uv pip install --system -r requirements-slim.txt --no-cache-dir; \
+    elif [ "$USE_CUDA" = "true" ]; then \
     # If you use CUDA the whisper and embedding model will be downloaded on first use
     # fix: pin torch<=2.9.1 - torch 2.10.0 aarch64 wheels cause SIGILL on ARM devices (RPi 4 Cortex-A72) #21349
     pip3 install 'torch<=2.9.1' torchvision torchaudio --index-url https://download.pytorch.org/whl/$USE_CUDA_DOCKER_VER --no-cache-dir; \
@@ -149,7 +168,6 @@ RUN set -e; \
     python -c "import os; from sentence_transformers import SentenceTransformer; SentenceTransformer(os.environ.get('AUXILIARY_EMBEDDING_MODEL', 'TaylorAI/bge-micro-v2'), device='cpu')"; \
     python -c "import os; from faster_whisper import WhisperModel; WhisperModel(os.environ['WHISPER_MODEL'], device='cpu', compute_type='int8', download_root=os.environ['WHISPER_MODEL_DIR'])"; \
     python -c "import os; import tiktoken; tiktoken.get_encoding(os.environ['TIKTOKEN_ENCODING_NAME'])"; \
-    python -c "import nltk; nltk.download('punkt_tab', download_dir='/usr/local/share/nltk_data')"; \
     else \
     pip3 install 'torch<=2.9.1' torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu --no-cache-dir; \
     uv pip install --system -r requirements.txt --no-cache-dir; \
@@ -158,7 +176,6 @@ RUN set -e; \
     python -c "import os; from sentence_transformers import SentenceTransformer; SentenceTransformer(os.environ.get('AUXILIARY_EMBEDDING_MODEL', 'TaylorAI/bge-micro-v2'), device='cpu')"; \
     python -c "import os; from faster_whisper import WhisperModel; WhisperModel(os.environ['WHISPER_MODEL'], device='cpu', compute_type='int8', download_root=os.environ['WHISPER_MODEL_DIR'])"; \
     python -c "import os; import tiktoken; tiktoken.get_encoding(os.environ['TIKTOKEN_ENCODING_NAME'])"; \
-    python -c "import nltk; nltk.download('punkt_tab', download_dir='/usr/local/share/nltk_data')"; \
     fi; \
     fi; \
     mkdir -p /app/backend/data; chown -R $UID:$GID /app/backend/data/; \
@@ -187,19 +204,8 @@ COPY --chown=$UID:$GID --from=build /app/build /app/build
 COPY --chown=$UID:$GID --from=build /app/CHANGELOG.md /app/CHANGELOG.md
 COPY --chown=$UID:$GID --from=build /app/package.json /app/package.json
 
-# copy backend files
-COPY --chown=$UID:$GID ./backend .
-
-# The backend rewrites its bundled static assets (favicons, splash, man
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ For more information, be sure to check out our [Open WebUI Documentation](https:
 
 - 🤖 **Models & Agents**: Wrap any base model with custom instructions, tools, and knowledge to build specialized agents. Supports dynamic variables, per-user/group access control, and community preset imports via [Open WebUI Community](https://openwebui.com/).
 
+- ⚡ **Agentic Execution with [Open Terminal](https://github.com/open-webui/open-terminal)**: Give your agents a terminal and filesystem to carry out multi-step tasks. Let them analyze data, run scripts, fix errors, and produce files directly in chat. Scale to teams with **[Terminals (Enterprise)](https://github.com/open-webui/terminals)** for per-user isolated environments, resource limits, and automatic lifecycle management.
+
 - 📝 **Notes**: A dedicated workspace for content outside conversations. Draft with a rich editor, use AI to rewrite selected text, and attach notes to any chat for full-context injection.
 
 - 📢 **Channels**: Real-time shared spaces where your team and AI models collaborate in one timeline. Tag models to draft or critique, with threads, reactions, pins, and access control.
```

---

### Incident Patch 2: `9530cc15` (2026-09-21)
**Commit Message**: i18n: restore placeholder names that were translated or lost their braces (#30326)

{{ models }} -> {{ modelli }} etc. in 10 locales, {{name}} -> {{nombre}} in
gl-ES, {{file}} -> {{arxiu}} in ca-ES, and single/unbalanced braces in kab-DZ,
nb-NO and ca-ES. 22 strings in 13 locales, tokens only.

**File**: `src/lib/i18n/locales/bs-BA/translation.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	"[Last] dddd [at] h:mm A": "[Prošle sedmice:] dddd [u] h:mm A",
 	"[Today at] h:mm A": "[Danas u] h:mm A",
 	"[Yesterday at] h:mm A": "[Jučer u] h:mm A",
-	"{{ models }}": "{{ modeli }}",
+	"{{ models }}": "{{ models }}",
 	"{{count}} added lines_one": "",
 	"{{count}} added lines_few": "",
 	"{{count}} added lines_other": "",
```

**File**: `src/lib/i18n/locales/ca-ES/translation.json` (modified, +3/-3)
```diff
@@ -1747,7 +1747,7 @@
 	"Quick Actions": "Accions ràpides",
 	"Ran {{COUNT}} analyses": "S'han executat {{COUNT}} anàlisis",
 	"Ran {{COUNT}} analysis": "S'han executat {{COUNT}} anàlisis",
-	"Rate {{rating}} out of 10": "Nota {{rating} sobre 10",
+	"Rate {{rating}} out of 10": "Nota {{rating}} sobre 10",
 	"Rating": "Valoració",
 	"Read": "Llegit",
 	"Read Aloud": "Llegir en veu alta",
@@ -3379,7 +3379,7 @@
 	"Upload Progress": "Progrés de càrrega",
 	"Uploaded files or images": "Arxius o imatges pujats",
 	"Uploading": "S'està carregant",
-	"Uploading {{current}}/{{total}}: {{file}}": "Pujant {{current}}/{{total}}: {{arxiu}}",
+	"Uploading {{current}}/{{total}}: {{file}}": "Pujant {{current}}/{{total}}: {{file}}",
 	"Uploading...": "Pujant...",
 	"URL": "URL",
 	"URL is required": "La URL és necessària",
@@ -3393,7 +3393,7 @@
 	"Use segmented retrieval for focused and relevant content extraction.": "Utilitzar la recuperació segmentada per a l'extracció de contingut centrada i rellevant.",
 	"Use segmented retrieval for focused and relevant context.": "Utilitzar la recuperació segmentada per a un context centrat i rellevant.",
 	"Use segmented retrieval for focused context.": "Utilitzar la recuperació segmentada per al context.",
-	"Use these in model system prompts as {{example}}.": "Utilitzar-los a les indicacions del sistema del model com a {{exemple}}.",
+	"Use these in model system prompts as {{example}}.": "Utilitzar-los a les indicacions del sistema del model com a {{example}}.",
 	"Use Web Search?": "Utilitzar la cerca web?",
 	"user": "usuari",
 	"User": "Usuari",
```

**File**: `src/lib/i18n/locales/da-DK/translation.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	"[Last] dddd [at] h:mm A": "[Sidste] dddd [kl.] h:mm A",
 	"[Today at] h:mm A": "[I dag kl.] h:mm A",
 	"[Yesterday at] h:mm A": "[I går kl.] h:mm A",
-	"{{ models }}": "{{ modeller }}",
+	"{{ models }}": "{{ models }}",
 	"{{count}} added lines_one": "",
 	"{{count}} added lines_other": "",
 	"{{COUNT}} Available Skills": "Tilgængelige færdigheder: {{COUNT}}",
```

**File**: `src/lib/i18n/locales/et-EE/translation.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	"[Last] dddd [at] h:mm A": "[Eelmisel] dddd [kell] h:mm A",
 	"[Today at] h:mm A": "[Täna kell] h:mm A",
 	"[Yesterday at] h:mm A": "[Eile kell] h:mm A",
-	"{{ models }}": "{{ mudelid }}",
+	"{{ models }}": "{{ models }}",
 	"{{count}} added lines_one": "",
 	"{{count}} added lines_other": "",
 	"{{COUNT}} Available Skills": "",
```

**File**: `src/lib/i18n/locales/fi-FI/translation.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	"[Last] dddd [at] h:mm A": "[Viimeisin] dddd h:mm A",
 	"[Today at] h:mm A": "[Tänään] h:mm A",
 	"[Yesterday at] h:mm A": "[Eilen] h:mm A",
-	"{{ models }}": "{{ mallit }}",
+	"{{ models }}": "{{ models }}",
 	"{{count}} added lines_one": "",
 	"{{count}} added lines_other": "",
 	"{{COUNT}} Available Skills": "{{COUNT}} taitoa käytettävissä",
```

**File**: `src/lib/i18n/locales/gl-ES/translation.json` (modified, +1/-1)
```diff
@@ -599,7 +599,7 @@
 	"Delete Version": "",
 	"Deleted": "",
 	"Deleted {{deleteModelTag}}": "Se borró {{deleteModelTag}}",
-	"Deleted {{name}}": "Eliminado {{nombre}}",
+	"Deleted {{name}}": "Eliminado {{name}}",
 	"Deleted {{ok}} of {{total}} items": "",
 	"Deleted User": "Usuario eliminado",
 	"Denied {{NAME}}": "",
```

**File**: `src/lib/i18n/locales/hr-HR/translation.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	"[Last] dddd [at] h:mm A": "[Prošlog tjedna:] dddd [u] h:mm A",
 	"[Today at] h:mm A": "[Danas u] h:mm A",
 	"[Yesterday at] h:mm A": "[Jučer u] h:mm A",
-	"{{ models }}": "{{ modeli }}",
+	"{{ models }}": "{{ models }}",
 	"{{count}} added lines_one": "",
 	"{{count}} added lines_few": "",
 	"{{count}} added lines_other": "",
```

**File**: `src/lib/i18n/locales/it-IT/translation.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	"[Last] dddd [at] h:mm A": "",
 	"[Today at] h:mm A": "",
 	"[Yesterday at] h:mm A": "",
-	"{{ models }}": "{{ modelli }}",
+	"{{ models }}": "{{ models }}",
 	"{{count}} added lines_one": "",
 	"{{count}} added lines_many": "",
 	"{{count}} added lines_other": "",
```

---

### Incident Patch 3: `46ea826e` (2026-09-21)
**Commit Message**: refac: keep rendered diagrams and SVG on same-origin resources (#30271)

Mermaid diagrams and the shared SVG sanitizer now accept only same-origin and data: references. Image URLs, class styles and directive config are checked on the parsed diagram before it renders, and the sanitizer drops attribute values and stylesheet rules that point at another origin. use elements keep local #id references only.

SVGPanZoom and the SVG file preview call the shared sanitizer instead of keeping their own configs, so SVG artifacts and uploaded SVG files follow the same rule. Uploaded SVGs that reference external sprites now render those parts blank, which is the point of the change.

A diagram that references an external resource now reports an error instead of rendering, and an SVG artifact keeps everything except the rules that reference one.

**File**: `src/lib/components/chat/FileNav/FilePreview.svelte` (modified, +2/-5)
```diff
@@ -5,7 +5,7 @@
 	import { settings, config } from '$lib/stores';
 	import { injectCsp } from '$lib/utils/csp';
 	import { isCodeFile } from '$lib/utils/codeHighlight';
-	import { initMermaid, renderMermaidDiagram } from '$lib/utils';
+	import { initMermaid, renderMermaidDiagram, sanitizeSvg } from '$lib/utils';
 	import Spinner from '../../common/Spinner.svelte';
 	import PdfPagesPreview from '../../common/PdfPagesPreview.svelte';
 	import PanzoomContainer from '../../common/PanzoomContainer.svelte';
@@ -478,10 +478,7 @@
 			</div>
 		{:else if isSvg && !showRaw && fileContent}
 			<div class="svg-preview w-full h-full flex items-center justify-center overflow-auto p-3">
-				{@html DOMPurify.sanitize(fileContent, {
-					USE_PROFILES: { svg: true, svgFilters: true },
-					ADD_TAGS: ['use']
-				})}
+				{@html sanitizeSvg(fileContent)}
 			</div>
 		{:else if isCode && !showRaw}
 			<div class="absolute inset-0">
```

**File**: `src/lib/components/common/SVGPanZoom.svelte` (modified, +2/-42)
```diff
@@ -4,12 +4,10 @@
 
 	import { toast } from 'svelte-sonner';
 
-	import DOMPurify from 'dompurify';
-
 	import { getContext } from 'svelte';
 	const i18n = getContext('i18n');
 
-	import { copyToClipboard } from '$lib/utils';
+	import { copyToClipboard, sanitizeSvg } from '$lib/utils';
 
 	import PanzoomContainer from './PanzoomContainer.svelte';
 	import Tooltip from './Tooltip.svelte';
@@ -37,45 +35,7 @@
 		bind:this={panzoomRef}
 		className="flex h-full max-h-full justify-center items-center"
 	>
-		{@html DOMPurify.sanitize(svg, {
-			USE_PROFILES: { svg: true, svgFilters: true }, // allow <svg>, <defs>, <filter>, etc.
-			WHOLE_DOCUMENT: false,
-			ADD_TAGS: ['style', 'foreignObject'], // include foreignObject if using HTML labels
-			ADD_ATTR: [
-				'class',
-				'style',
-				'id',
-				'data-*',
-				'viewBox',
-				'preserveAspectRatio',
-				// markers / arrows
-				'markerWidth',
-				'markerHeight',
-				'markerUnits',
-				'refX',
-				'refY',
-				'orient',
-				// hrefs (for gradients, markers, etc.)
-				'href',
-				'xlink:href',
-				// text positioning
-				'dominant-baseline',
-				'text-anchor',
-				// pattern / clip / mask units
-				'clipPathUnits',
-				'filterUnits',
-				'patternUnits',
-				'patternContentUnits',
-				'maskUnits',
-				// a11y niceties
-				'role',
-				'aria-label',
-				'aria-labelledby',
-				'aria-hidden',
-				'tabindex'
-			],
-			SANITIZE_DOM: true
-		})}
+		{@html sanitizeSvg(svg)}
 	</PanzoomContainer>
 
 	{#if content}
```

**File**: `src/lib/utils/index.ts` (modified, +149/-42)
```diff
@@ -1,7 +1,7 @@
 import type { Writable } from 'svelte/store';
 import { v4 as uuidv4 } from 'uuid';
 import sha256 from 'js-sha256';
-import DOMPurify from 'dompurify';
+import DOMPurify, { type UponSanitizeAttributeHookEvent } from 'dompurify';
 import { WEBUI_BASE_URL } from '$lib/constants';
 import type { FileNavOpenRequest } from '$lib/stores';
 import { normalizeDocumentTargetPage } from '$lib/utils/documentPreview';
@@ -2133,7 +2133,8 @@ export const initMermaid = async () => {
 		startOnLoad: false, // Should be false when using render API
 		theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
 		securityLevel: 'loose',
-		htmlLabels: false
+		htmlLabels: false,
+		secure: ['htmlLabels']
 	});
 	return mermaid;
 };
@@ -2148,43 +2149,133 @@ const cleanupMermaidTempElements = (id: string) => {
 	document.getElementById(`i${id}`)?.remove();
 };
 
+const isLocalResourceUrl = (url: string): boolean => {
+	try {
+		const resolved = new URL(url, document.baseURI);
+		return resolved.protocol === 'data:' || resolved.origin === location.origin;
+	} catch {
+		return false;
+	}
+};
+
+// Escapes and image-set() read as a plain url() to a browser, so match the parsed CSS, not the text.
+const CSS_URL_SYNTAX = /url\(|image-set\(|@import|\\/i;
+
+const cssRules = (css: string): string[] => {
+	const parsed = new DOMParser().parseFromString(`<style>${css}</style>`, 'text/html');
+	return [...(parsed.querySelector('style')?.sheet?.cssRules ?? [])].map((rule) => rule.cssText);
+};
+
+const referencesExternalCss = (css: string): boolean => {
+	if (!CSS_URL_SYNTAX.test(css)) {
+		return false;
+	}
+
+	// A value arrives as a stylesheet, a declaration list or a bare presentation value.
+	return [css, `a{${css}}`, `a{background-image:${css}}`].some((stylesheet) => {
+		const urls = cssRules(stylesheet)
+			.join('')
+			.matchAll(/url\(["']?([^"')]*)/g);
+		return [...urls].some(([, url]) => !isLocalResourceUrl(url));
+	});
+};
+
+const dropExternalResourceRefs = (node: Node, data: UponSanitizeAttributeHookEvent) => {
+	const tagName = node.nodeName.toLowerCase();
+	const isImageRef =
+		(tagName === 'image' || tagName === 'feimage') &&
+		(data.attrName === 'href' || data.attrName === 'xlink:href');
+
+	if (isImageRef && !isLocalResourceUrl(data.attrValue)) {
+		data.keepAttr = false;
+	}
+	if (!isImageRef && referencesExternalCss(data.attrValue)) {
+		data.keepAttr = false;
+	}
+};
+
+// use hrefs point at defs inside the same document (#id) or fetch another file, keep only the former.
+const dropExternalUseRefs = (node: Node, data: UponSanitizeAttributeHookEvent) => {
+	if (node.nodeName.toLowerCase() !== 'use') {
+		return;
+	}
+	if (data.attrName !== 'href' && data.attrName !== 'xlink:href') {
+		return;
+	}
+	if (!data.attrValue.trim().startsWith('#')) {
+		data.keepAttr = false;
+	}
+};
+
+const dropExternalStyleRules = (node: Node) => {
+	if (node.nodeName.toLowerCase() !== 'style') {
+		return;
+	}
+
+	const css = node.textContent ?? '';
+	if (!referencesExternalCss(css)) {
+		return;
+	}
+
+	node.textContent = cssRules(css)
+		.filter((rule) => !referencesExternalCss(rule))
+		.join('');
+};
+
 // Mermaid runs with securityLevel:'loose', which emits unsanitized SVG (raw javascript: hrefs,
 // HTML labels); strip active content before it reaches any innerHTML/{@html} sink.
-export const sanitizeSvg = (svg: string): string =>
-	DOMPurify.sanitize(svg, {
-		USE_PROFILES: { svg: true, svgFilters: true },
-		WHOLE_DOCUMENT: false,
-		ADD_TAGS: ['style', 'foreignObject'],
-		ADD_ATTR: [
-			'class',
-			'style',
-			'id',
-			'data-*',
-			'viewBox',
-			'preserveAspectRatio',
-			'markerWidth',
-			'markerHeight',
-			'markerUnits',
-			'refX',
-			'refY',
-			'orient',
-			'href',
-			'xlink:href',
-			'dominant-baseline',
-			'text-anchor',
-			'clipPathUnits',
-			'filterUnits',
-			'patternUnits',
-			'patternContentUnits',
-			'maskUnits',
-			'role',
-			'aria-label',
-			'aria-labelledby',
-			'aria-hidden',
-			'tabindex'
-		],
-		SANITIZE_DOM: true
-	});
+export const sanitizeSvg = (svg: string): string => {
+	DOMPurify.addHook('uponSanitizeAttribute', dropExternalResourceRefs);
+	DOMPurify.addHook('uponSanitizeElement', dropExternalStyleRules);
+	DOMPurify.addHook('uponSanitizeAttribute', dropExternalUseRefs);
+	try {
+		return DOMPurify.sanitize(svg, {
+			USE_PROFILES: { svg: true, svgFilters: true },
+			WHOLE_DOCUMENT: false,
+			ADD_TAGS: ['style', 'foreignObject', 'use'],
+			ADD_ATTR: [
+				'class',
+				'style',
+				'id',
+				'data-*',
+				'viewBox',
+				'preserveAspectRatio',
+				'markerWidth',
+				'markerHeight',
+				'markerUnits',
+				'refX',
+				'refY',
+				'orient',
+				'href',
+				'xlink:href',
+				'dominant-baseline',
+				'text-anchor',
+				'clipPathUnits',
+				'filterUnits',
+				'patternUnits',
+				'patternContentUnits',
+				'maskUnits',
+				'role',
+				'aria-label',
+				'aria-labelledby',
+				'aria-hidden',
+				'tabindex'
+			],
+			
```

---

### Incident Patch 4: `b988f06c` (2026-09-21)
**Commit Message**: fix: drop every local reference to a channel message that was deleted (#30314)

**File**: `src/lib/components/channel/Channel.svelte` (modified, +11/-1)
```diff
@@ -168,7 +168,17 @@
 					messages[idx] = data;
 				}
 			} else if (type === 'message:delete') {
-				messages = messages.filter((message) => message.id !== data.id);
+				messages = messages
+					.filter((message) => message.id !== data.id)
+					.map((message) =>
+						message?.reply_to_message?.id === data.id
+							? { ...message, reply_to_message: null }
+							: message
+					);
+
+				if (replyToMessage?.id === data.id) {
+					replyToMessage = null;
+				}
 
 				if (threadId === data.id) {
 					threadId = null;
```

**File**: `src/lib/components/channel/Thread.svelte` (modified, +11/-1)
```diff
@@ -92,7 +92,17 @@
 				}
 
 				if (messages) {
-					messages = messages.filter((message) => message.id !== data.id);
+					messages = messages
+						.filter((message) => message.id !== data.id)
+						.map((message) =>
+							message?.reply_to_message?.id === data.id
+								? { ...message, reply_to_message: null }
+								: message
+						);
+				}
+
+				if (replyToMessage?.id === data.id) {
+					replyToMessage = null;
 				}
 			} else if (type.includes('message:reaction')) {
 				if (messages) {
```

---

### Incident Patch 5: `4b61b86a` (2026-09-21)
**Commit Message**: fix: apply the knowledge File content filter on the first click (#30211)

**File**: `src/lib/components/workspace/Knowledge/KnowledgeBase.svelte` (modified, +1/-7)
```diff
@@ -1435,13 +1435,7 @@
 											currentPage = 1;
 										}}
 									>
-										<Checkbox
-											state={includeContent ? 'checked' : 'unchecked'}
-											on:change={(e) => {
-												includeContent = e.detail === 'checked';
-												currentPage = 1;
-											}}
-										/>
+										<Checkbox state={includeContent ? 'checked' : 'unchecked'} />
 										{$i18n.t('File content')}
 									</button>
 								</DropdownMenu>
```

---

### Incident Patch 6: `e8c26f83` (2026-09-21)
**Commit Message**: fix: stop the background memory review when memory is switched off (#30309)

With memories disabled instance-wide, or for a user barred from the feature,
the background review still ran every interval turn: it spent a task-model
call drafting memory operations and only then failed at the write, because
the router's permission check rejected it. The review now checks the
'memories.enable' switch and re-checks the 'features.memories' permission
the same way the context-injection path already does, so a model whose memory
capability is on no longer triggers memory work that can never land.

The permission lookup costs a groups query, so it runs last, after the free
config and interval gates; those stay on every turn's hot path.

**File**: `backend/open_webui/utils/memory.py` (modified, +8/-1)
```diff
@@ -8,6 +8,7 @@
 from fastapi import HTTPException
 from open_webui.models.config import Config
 from open_webui.models.memories import Memories
+from open_webui.utils.access_control import has_permission
 from open_webui.utils.json_codec import JSONCodec
 from open_webui.utils.misc import add_or_update_system_message, get_content_from_message
 
@@ -428,10 +429,12 @@ async def review_memory_after_turn(
         return
 
     config = await Config.get_many(
+        'memories.enable',
         'memories.background_review.enable',
         'memories.review_interval_turns',
+        'user.permissions',
     )
-    if not config.get('memories.background_review.enable'):
+    if not config.get('memories.enable') or not config.get('memories.background_review.enable'):
         return
 
     try:
@@ -443,6 +446,10 @@ async def review_memory_after_turn(
     if user_turns == 0 or user_turns % interval != 0:
         return
 
+    # features is client-supplied; re-check the permission the memory routes enforce.
+    if user.role != 'admin' and not await has_permission(user.id, 'features.memories', config.get('user.permissions')):
+        return
+
     task = asyncio.create_task(
         _review_memory(
             request=request,
```

---

### Incident Patch 7: `94eea41a` (2026-09-21)
**Commit Message**: fix: surface searchapi errors, news results and redirect links (#30308)

Web search via searchapi.io could come back empty or near-empty with no
hint of why: an invalid or expired API key turned into an empty result
set instead of an error, the google_news engine splits its results
between organic_results and top_stories and only the first block was
read, and google links came back as google.com/goto redirects the web
loader cannot fetch, so citations pointed at a redirect blob.

The search now reads both result blocks, asks google engines for
resolved destination links, raises on HTTP errors, carries a 30s request
timeout, skips result rows without a link, and logs the response body at
debug instead of dumping every search at info.

Fixes #30305

**File**: `backend/open_webui/retrieval/web/searchapi.py` (modified, +11/-4)
```diff
@@ -26,19 +26,26 @@ def search_searchapi(
     engine = engine or 'google'
 
     payload = {'engine': engine, 'q': query, 'api_key': api_key}
+    if engine.startswith('google'):
+        payload['link'] = 'resolved'
 
     url = f'{url}?{urlencode(payload)}'
-    response = requests.request('GET', url)
+    response = requests.request('GET', url, timeout=30)
+    response.raise_for_status()
 
     json_response = response.json()
-    log.info('results from searchapi search: %s', json_response)
+    log.debug('results from searchapi search: %s', json_response)
 
-    results = sorted(json_response.get('organic_results', []), key=lambda x: x.get('position', 0))
+    # top_stories entries carry no position, so the merged list keeps API order
+    results = [
+        *json_response.get('organic_results', []),
+        *json_response.get('top_stories', []),
+    ]
     if filter_list:
         results = get_filtered_results(results, filter_list)
     return [
         SearchResult(
-            link=result['link'],
+            link=result.get('link', ''),
             title=result.get('title'),
             snippet=result.get('snippet'),
         )
```

---

### Incident Patch 8: `9688d327` (2026-09-21)
**Commit Message**: fix: keep the background image chosen while creating a folder from the sidebar (#30218)

**File**: `src/lib/components/layout/Sidebar.svelte` (modified, +2/-1)
```diff
@@ -306,7 +306,7 @@
 		folders = folderMap;
 	};
 
-	const createFolder = async ({ name, data, parent_id }) => {
+	const createFolder = async ({ name, data, meta, parent_id }) => {
 		name = name?.trim();
 		if (!name) {
 			toast.error($i18n.t('Folder name cannot be empty.'));
@@ -343,6 +343,7 @@
 		const res = await createNewFolder(localStorage.token, {
 			name,
 			data,
+			meta,
 			parent_id
 		}).catch((error) => {
 			toast.error(`${error}`);
```

---

### Incident Patch 9: `c864e3ae` (2026-09-21)
**Commit Message**: fix: stop asking for chat variables a model's system prompt no longer declares (#30173)

**File**: `backend/open_webui/routers/models.py` (modified, +2/-0)
```diff
@@ -62,6 +62,8 @@ def add_chat_variables_schema(model_dict: dict) -> dict:
     schema = get_chat_variables_schema(system)
     if schema:
         model_dict.setdefault('meta', {})['chat_variables_schema'] = schema
+    elif isinstance(model_dict.get('meta'), dict):
+        model_dict['meta'].pop('chat_variables_schema', None)
     return model_dict
 
 
```

**File**: `backend/open_webui/utils/models.py` (modified, +4/-0)
```diff
@@ -187,6 +187,8 @@ async def get_all_models(request, refresh: bool = False, user: UserModel = None)
                     schema = get_chat_variables_schema(custom_model.params.model_dump().get('system'))
                     if schema:
                         model['info'].setdefault('meta', {})['chat_variables_schema'] = schema
+                    elif isinstance(model['info'].get('meta'), dict):
+                        model['info']['meta'].pop('chat_variables_schema', None)
 
                     action_ids = []
                     filter_ids = []
@@ -239,6 +241,8 @@ async def get_all_models(request, refresh: bool = False, user: UserModel = None)
             schema = get_chat_variables_schema(custom_model.params.model_dump().get('system'))
             if schema:
                 info.setdefault('meta', {})['chat_variables_schema'] = schema
+            elif isinstance(info.get('meta'), dict):
+                info['meta'].pop('chat_variables_schema', None)
             if 'params' in info:
                 # Remove params to avoid exposing sensitive info
                 del info['params']
```

---

### Incident Patch 10: `bc50026f` (2026-09-21)
**Commit Message**: fix: make the Delete Chat shortcut work whenever a chat is open, not only while its sidebar row is rendered (#30165)

**File**: `src/lib/components/chat/Navbar.svelte` (modified, +13/-0)
```diff
@@ -149,6 +149,19 @@
 									</button>
 								</Menu>
 							{/if}
+
+							{#if !$temporaryChatEnabled && ($user?.role === 'admin' || ($user?.permissions?.chat?.delete ?? true))}
+								<button
+									id="delete-chat-button"
+									aria-label={$i18n.t('Delete')}
+									class="hidden"
+									on:click={() => {
+										deleteChatHandler(chat.id);
+									}}
+								>
+									<EllipsisHorizontal className="size-4.5" strokeWidth="1.5" />
+								</button>
+							{/if}
 						</div>
 					{:else}
 						<div class="pointer-events-none invisible flex max-w-full min-w-0 items-center gap-2">
```

**File**: `src/lib/components/layout/Sidebar/ChatItem.svelte` (modified, +0/-14)
```diff
@@ -782,20 +782,6 @@
 							<MoreHorizontalIcon className="size-3.5" strokeWidth="2" />
 						</button>
 					</ChatMenu>
-
-					{#if id === $chatId && ($user?.role === 'admin' || ($user?.permissions?.chat?.delete ?? true))}
-						<!-- Shortcut support using "delete-chat-button" id -->
-						<button
-							id="delete-chat-button"
-							aria-label={$i18n.t('Delete')}
-							class="hidden"
-							on:click={() => {
-								showDeleteConfirm = true;
-							}}
-						>
-							<MoreHorizontalIcon className="size-3.5" strokeWidth="2" />
-						</button>
-					{/if}
 				</div>
 			{/if}
 		</div>
```

---

### Incident Patch 11: `438d9db8` (2026-09-21)
**Commit Message**: fix: correct recurrence rule parsing for schedules and calendar events (#29262)

* fix: correct recurrence rule parsing for schedules and calendar events

An automation set to repeat a limited number of times, say ten or a hundred, was treated as a one-shot and reported no repeat interval, because any count whose digits began with a one matched a text check for the one-shot case. The scheduler already answers that question correctly by asking the rule for its next two occurrences, so the text check is gone and the count is read as the number it is.

A recurrence rule that carries its start date on the same line as the repeat text kept that date when the automation was parsed, so the schedule ran from whatever date the rule happened to carry and ignored the start the user picked. The filter that drops the start date now splits the rule on any whitespace, the same way the rule parser itself does, so both agree on where one part of the rule ends and the next begins.

The same mismatch on the calendar path anchored a recurring event to the date inside its rule, so occurrences showed up before the event had begun and at the wrong time of day. That filter splits the rule the same way now

**File**: `backend/open_webui/utils/automations.py` (modified, +4/-6)
```diff
@@ -89,9 +89,9 @@ def _parse_rule(s: str, now: Optional[datetime] = None):
     rule = rules[0]
     start = rule._dtstart.replace(tzinfo=None)
     anchor = now or datetime.now()
-    lines = s.splitlines()
-    stripped = '\n'.join(line for line in lines if not line.upper().startswith('DTSTART')) or s
-    has_dtstart = any(line.upper().startswith('DTSTART') for line in lines)
+    parts = s.split()
+    stripped = '\n'.join(part for part in parts if not part.upper().startswith('DTSTART')) or s
+    has_dtstart = any(part.upper().startswith('DTSTART') for part in parts)
     step = {
         SECONDLY: timedelta(seconds=rule._interval),
         MINUTELY: timedelta(minutes=rule._interval),
@@ -183,9 +183,7 @@ def rrule_interval_seconds(s: str) -> Optional[int]:
     Returns None for one-shot (COUNT=1) schedules or rules
     with fewer than two future occurrences.
     """
-    if 'COUNT=1' in s:
-        return None
-    s = '\n'.join(line for line in s.splitlines() if not line.upper().startswith('DTSTART')) or s
+    s = '\n'.join(part for part in s.split() if not part.upper().startswith('DTSTART')) or s
     now = datetime.now()
     rule = _parse_rule(s, now)
     first = rule.after(now)
```

**File**: `backend/open_webui/utils/calendar.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ def to_local_datetime(timestamp_ns: int) -> dt.datetime:
 
     original_start_ns = event_dict['start_at']
     original_start = to_local_datetime(original_start_ns)
-    rule_str = '\n'.join(line for line in rrule_str.splitlines() if not line.upper().startswith('DTSTART')) or rrule_str
+    rule_str = '\n'.join(part for part in rrule_str.split() if not part.upper().startswith('DTSTART')) or rrule_str
 
     try:
         # Anchor to the event's real start so day-of-week / day-of-month are correct
```

---

### Incident Patch 12: `7fa86732` (2026-09-21)
**Commit Message**: fix: resolve this instance's own file URLs in edit_image regardless of the URL host (#29691)

The native edit_image tool fails with "400: [ERROR: Error loading image]" whenever the model hands it an absolute URL for an image Open WebUI already stores. Such a URL is treated as local only when its host string matches the incoming request's host exactly, so a default-port form, a container name or any host the model composed itself falls through to an outbound HTTP fetch instead. That fetch asks /api/v1/files/{id}/content without a session, gets a 401, and the user sees the generic 400.

Match the file URL on its path and let the existing local branch resolve it. Fetching that endpoint over the network can never succeed for a local or a remote instance, because it requires an authenticated user, so the host comparison only decided which way the request failed. Access control is unchanged: the local branch still goes through get_file_content_by_id, which enforces owner, admin or shared access.

Fixes #29220

**File**: `backend/open_webui/routers/images.py` (modified, +2/-5)
```diff
@@ -920,11 +920,8 @@ async def load_url_image(data):
 
             if data.startswith('http://') or data.startswith('https://'):
                 parsed = urlparse(data)
-                if (
-                    parsed.netloc == urlparse(str(request.base_url)).netloc
-                    and parsed.path.startswith('/api/v1/files/')
-                    and '/content' in parsed.path
-                ):
+                # Fetching /api/v1/files/{id}/content over the network would be unauthenticated.
+                if parsed.path.startswith('/api/v1/files/') and '/content' in parsed.path:
                     return await load_url_image(parsed.path)
 
                 # Validate URL to prevent SSRF attacks against local/private networks.
```

---

### Incident Patch 13: `d9ea46f9` (2026-09-21)
**Commit Message**: fix: hide Insert into note on a note the viewer may only read (#30223)

**File**: `src/lib/components/notes/NoteEditor.svelte` (modified, +1/-1)
```diff
@@ -1507,7 +1507,7 @@ ${content}
 				embeddedDraftKey={noteChatDraftKey}
 				suggestedPrompts={noteChatSuggestedPrompts}
 				selectedText={selectedContent?.text ?? ''}
-				onInsertToNote={insertHandler}
+				onInsertToNote={note?.write_access ? insertHandler : null}
 				onNewEmbeddedChat={createNoteChat}
 				onCreateEmbeddedChat={createNoteChatOnFirstMessage}
 				onSelectEmbeddedChat={(chatId) => {
```

---

### Incident Patch 14: `f40318c1` (2026-09-21)
**Commit Message**: fix: keep the live prompt unchanged when a version is saved without Set as Production (#30231)

**File**: `backend/open_webui/models/prompts.py` (modified, +9/-7)
```diff
@@ -506,14 +506,16 @@ async def update_prompt_by_id(
                 )
 
                 # Update prompt fields
-                prompt.name = form_data.name
                 prompt.command = form_data.command
-                prompt.content = form_data.content
-                prompt.data = form_data.data or prompt.data
-                prompt.meta = form_data.meta or prompt.meta
 
-                if form_data.tags is not None:
-                    prompt.tags = form_data.tags
+                if form_data.is_production:
+                    prompt.name = form_data.name
+                    prompt.content = form_data.content
+                    prompt.data = form_data.data or prompt.data
+                    prompt.meta = form_data.meta or prompt.meta
+
+                    if form_data.tags is not None:
+                        prompt.tags = form_data.tags
 
                 if form_data.access_grants is not None:
                     await AccessGrants.set_access_grants('prompt', prompt.id, form_data.access_grants, db=session)
@@ -531,7 +533,7 @@ async def update_prompt_by_id(
                         'command': prompt.command,
                         'data': form_data.data or {},
                         'meta': form_data.meta or {},
-                        'tags': prompt.tags or [],
+                        'tags': form_data.tags if form_data.tags is not None else (prompt.tags or []),
                         'access_grants': [grant.model_dump() for grant in current_access_grants],
                     }
 
```

---

### Incident Patch 15: `440d13e1` (2026-09-21)
**Commit Message**: fix: refresh the prompt editor after a version is set as production (#30233)

**File**: `src/lib/components/workspace/Prompts/PromptEditor.svelte` (modified, +8/-2)
```diff
@@ -181,9 +181,15 @@
 		}
 
 		try {
-			await setProductionPromptVersion(localStorage.token, prompt.id, historyEntry.id);
+			const res = await setProductionPromptVersion(localStorage.token, prompt.id, historyEntry.id);
 			// Update local prompt object to trigger reactivity
-			prompt = { ...prompt, version_id: historyEntry.id };
+			prompt = { ...prompt, ...(res ?? {}), version_id: historyEntry.id };
+
+			name = prompt.name || '';
+			content = prompt.content ?? '';
+			tags = (prompt.tags || []).map((tag) => ({ name: tag }));
+			originalName = name;
+			originalTags = tags;
 			toast.success($i18n.t('Production version updated'));
 		} catch (error) {
 			toast.error(`${error}`);
```

#### Recent Merged Pull Requests:
- **PR #31937** (closed): fix(ci): keep the Format & Build working tree clean (@dai123x)
- **PR #31936** (closed): fix(ci): keep the Format & Build working tree clean (@dai123x)
- **PR #31935** (closed): fix(ci): keep the Format & Build working tree clean (@dai123x)
- **PR #31934** (2026-10-05): i18n: fix zh-CN mistranslations and fill empty values (@fengyufeiyang-dot)
- **PR #31933** (closed): i18n: review zh-CN translation, fix terminology and fill missing keys (@fengyufeiyang-dot)
- **PR #31931** (closed): fix(redis): preserve Sentinel master name case in parse_redis_url (@TINGyu123644)
- **PR #31928** (closed): Fix external-KB citation title and numbering (@mike2307)
- **PR #31927** (closed): Cache external-KB query embeddings across knowledge bases (@mike2307)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
