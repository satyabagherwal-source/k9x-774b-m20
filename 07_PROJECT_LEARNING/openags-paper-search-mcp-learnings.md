# Forensic Learning Record (Deep Inspection): openags/paper-search-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/openags-paper-search-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openags/paper-search-mcp](https://github.com/openags/paper-search-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:08:30.294Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openags/paper-search-mcp`
- **Description**: MCP, CLI, Skills for searching and downloading academic papers from multiple sources like arXiv, PubMed, bioRxiv, etc.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2748 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `paper_search_mcp/_section_worker.py`
```
"""Private stdin/stdout worker; accepts bounded PDF bytes, never local paths."""
import json
import math
import sys

MAX_INPUT_BYTES = 20 * 1024 * 1024
MEMORY_LIMIT = 512 * 1024 * 1024
STREAM_LIMIT = 8 * 1024 * 1024


def _resource_limits(seconds):
    import resource
    for kind, cap in ((resource.RLIMIT_AS, MEMORY_LIMIT),
                      (resource.RLIMIT_CPU, math.ceil(seconds) + 1)):
        soft, hard = resource.getrlimit(kind)
        cap = min([cap] + [value for value in (soft, hard) if value != resource.RLIM_INFINITY])
        resource.setrlimit(kind, (cap, cap))


def _parser_configuration():
    import pypdf
    import pypdf.filters as filters
    from contextlib import nullcontext
    def no_external_decoder(*args, **kwargs):
        from .sections import SectionExtractionError
        raise SectionExtractionError("External image decoders are not supported for text extraction")
    filters.JBIG2Decode.decode = staticmethod(no_external_decoder)
    if hasattr(pypdf, "apply_configuration"):
        return pypdf.apply_configuration(
            maximum_declared_stream_length=STREAM_LIMIT,
            array_based_stream_maximum_output_length=STREAM_LIMIT,
            jbig2_maximum_output_length=STREAM_LIMIT, lzw_maximum_output_length=STREAM_LIMIT,
            run_length_maximum_output_length=STREAM_LIMIT, zlib_maximum_output_length=STREAM_LIMIT,
            zlib_maximum_recovery_input_length=100_000,
            image_maximum_buffer_size=STREAM_LIMIT, flate_maximum_row_length=STREAM_LIMIT,
            page_tree_maximum_entries=1000, page_tree_maximum_depth=50,
            xform_maximum_invocations_per_extraction=100, jbig2dec_binary=None,
        )
    # Locked installations currently use pypdf 6.9.2. Its legacy settings are
    # safe to lower here because this process has exactly one parser and dies
    # after the request; these changes never affect the MCP process or readers.
    for name in ("MAX_DECLARED_STREAM_LENGTH", "MAX_ARRAY_BASED_STREAM_OUTPUT_LENGTH",
                 "JBIG2_MAX_OUTPUT_LENGTH", "LZW_MAX_OUTPUT_LENGTH",
                 "RUN_LENGTH_MAX_OUTPUT_LENGTH", "ZLIB_MAX_OUTPUT_LENGTH"):
        if not hasattr(filters, name):
            raise RuntimeError("Required pypdf resource limit is unavailable")
        setattr(filters, name, STREAM_LIMIT)
    filters.ZLIB_MAX_RECOVERY_INPUT_LENGTH = 100_000
    return nullcontext()


def main():
    try:
        # Bound allocations even while receiving/parsing the request.
        _resource_limits(60)
        header = json.loads(sys.stdin.buffer.readline(4096))
        size = header.pop("size")
        if type(size) is not int or not 0 < size <= MAX_INPUT_BYTES:
            raise ValueError("Invalid input size")
        from .sections import _parse_pdf_sections, validate_limits, SectionExtractionError
        validate_limits(**header)
        _resource_limits(header["timeout_seconds"])
        data = sys.stdin.buffer.read(size + 1)
        if len(data) != size:
            raise ValueError("Invalid input size")
        with _parser_configuration():
            result = _parse_pdf_sections(data, **header)
        response = {"status": "ok", "result": result}
    except TimeoutError:
        response = {"status": "timeout"}
    except MemoryError:
        response = {"status": "error", "message": "The PDF exceeded the parser memory budget"}
    except Exception as exc:
        # Only our fixed, sanitized errors are forwarded. Parser exceptions and
        # process setup errors may include PDF strings, paths or environment.
        from .sections import SectionExtractionError
        message = str(exc) if isinstance(exc, SectionExtractionError) else "The isolated PDF parser could not process this input safely"
        response = {"status": "error", "message": message}
    sys.stdout.write(json.dumps(response, ensure_ascii=True, allow_nan=False))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `paper_search_mcp/academic_platforms/core.py`
```
# paper_search_mcp/academic_platforms/core.py
from typing import List, Optional, Dict, Any
import requests
import logging
import os
from datetime import datetime
from pathlib import Path
import time
from ..paper import Paper
from ..utils import extract_doi
from ..config import get_env
from .base import PaperSource
from pypdf import PdfReader

logger = logging.getLogger(__name__)


class CORESearcher(PaperSource):
    """Searcher for CORE (global open access research papers)"""

    BASE_URL = "https://api.core.ac.uk/v3"
    RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize CORE searcher.

        Args:
            api_key: CORE API key (optional, can also be set via CORE_API_KEY env var)
        """
        self.api_key = api_key or get_env("CORE_API_KEY", "")
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'paper-search-mcp/1.0 (mailto:openags@example.com)',
            'Accept': 'application/json'
        })
        if self.api_key:
            self.session.headers.update({'Authorization': f'Bearer {self.api_key}'})
        else:
            logger.warning("No CORE API key provided. Searches may be rate-limited or return limited results.")

    def search(self, query: str, max_results: int = 10, **kwargs) -> List[Paper]:
        """
        Search CORE for open access research papers.

        Args:
            query: Search query string
            max_results: Maximum results to return (CORE API default: 10, max: 100)
            **kwargs: Additional parameters:
                - year: Filter by year
                - language: Filter by language (e.g., 'en')
                - repository: Filter by repository
                - has_fulltext: Filter by full text availability (True/False)

        Returns:
            List[Paper]: List of found papers with metadata
        """
        papers = []

        try:
            # Prepare search parameters
            params = {
                'q': query,
                'limit': min(max_results, 100),  # CORE API max limit is 100
                'offset': 0,
            }

            # Add optional filters
            if 'year' in kwargs:
                params['year'] = kwargs['year']
            if 'language' in kwargs:
                params['language'] = kwargs['language']
            if 'repository' in kwargs:
                params['repository'] = kwargs['repository']
            if 'has_fulltext' in kwargs:
                params['has_fulltext'] = str(kwargs['has_fulltext']).lower()

            # Add other supported parameters
            supported_params = ['publishedAfter', 'publishedBefore', 'doi', 'issn', 'isbn']
            for param in supported_params:
                if param in kwargs:
                    params[param] = kwargs[param]

            response = None
            for attempt in range(3):
                try:
                    candidate = self.session.get(f"{self.BASE_URL}/search/works", params=params, timeout=30)

                    if candidate.status_code in self.RETRYABLE_STATUS_CODES:
                        wait_seconds = min(8, 2 ** attempt)
                        logger.warning(
                            "CORE request returned %s (attempt %s/3). Retrying in %ss",
                            candidate.status_code,
                            attempt + 1,
                            wait_seconds,
                        )
                        time.sleep(wait_seconds)
                        continue

                    if candidate.status_code in {401, 403} and self.api_key:
                        logger.warning(
                            "CORE API key was rejected (status=%s). Retrying once without key.",
                            candidate.status_code,
                        )
                        fallback_headers = {
                            'User-Agent': self.session.headers.get('User-Agent', ''),
                            'Accept': self.session.headers.get('Accept', 'application/json'),
                        }
                        candidate = requests.get(
                            f"{self.BASE_URL}/search/works",
                            params=params,
                            headers=fallback_headers,
                            timeout=30,
                        )

                    candidate.raise_for_status()
                    response = candidate
                    break
                except requests.Timeout:
                    wait_seconds = min(8, 2 ** attempt)
                    logger.warning(
                        "CORE request timed out (attempt %s/3). Retrying in %ss",
                        attempt + 1,
                        wait_seconds,
                    )
                    time.sleep(wait_seconds)

            if response is None:
                return papers

            data = response.json()

            # Parse results
            results = data.get('results', [])
            for item in results:
                try:
                    paper = self._parse_item(item)
                    if paper:
                        papers.append(paper)
                        if len(papers) >= max_results:
                            break
                except Exception as e:
                    logger.warning(f"Error parsing CORE item: {e}")
                    continue

            logger.info(f"CORE search returned {len(papers)} papers for query: {query}")

        except requests.RequestException as e:
            status_code = getattr(getattr(e, 'response', None), 'status_code', None)
            if status_code == 401:
                logger.error("CORE API authentication failed. Check your API key.")
            elif status_code == 429:
                logger.error("CORE API rate limit exceeded. Consider adding API key or reducing frequency.")
            else:
                logger.error(f"CORE search request error (status={status_code}): {e}")
        except Exception as e:
            logger.error(f"Unexpected error in CORE search: {e}")

        return papers

    def _parse_item(self, item: Dict[str, Any]) -> Optional[Paper]:
        """Parse a single CORE API result item into a Paper object."""
        try:
            # Extract core ID
            core_id = item.get('id', '')
            if not core_id:
                return None

            # Extract title
            title = item.get('title', '').strip()
            if not title:
                return None

            # Extract authors
            authors = []
            authors_data = item.get('authors', [])
            for author in authors_data:
                if isinstance(author, dict):
                    name = author.get('name', '')
                    if name:
                        authors.append(name)
                elif isinstance(author, str):
                    authors.append(author)

            # Extract abstract
            abstract = item.get('abstract', '')

            # Extract DOI
            doi = item.get('doi', '')
            if not doi and abstract:
                doi = extract_doi(abstract)

            # Extract publication date
            pub_date = None
            published_date = item.get('publishedDate')
            if published_date:
                try:
                    # CORE date format: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SSZ"
                    if 'T' in published_date:
                        pub_date = datetime.fromisoformat(published_date.replace('Z', '+00:00'))
                    else:
                        pub_date = datetime.strptime(published_date, '%Y-%m-%d')
                except ValueError:
                    try:
                        # Try just year
                        year = published_date[:4]
                        if year.isdigit():
                            pub_date = datetime(int(year), 1, 1)
                    except Exception:
                        pass

            # Extract URLs
            url = item.get('url', '')
            if not url and doi:
                url = f"https://doi.org/{doi}"

            # Extract PDF URL
            pdf_url = ''
            download_url = item.get('downloadUrl')
            if download_url and isinstance(download_url, str) and download_url.lower().endswith('.pdf'):
                pdf_url = download_url
            else:
                # Check full text URLs
                full_text_urls = item.get('fullTextUrls', [])
                for ft_url in full_text_urls:
                    if isinstance(ft_url, str) and ft_url.lower().endswith('.pdf'):
                        pdf_url = ft_url
                        break

            # Extract categories/subjects
            categories = []
            subjects = item.get('subjects', [])
            for subject in subjects:
                if isinstance(subject, dict):
                    subject_name = subject.get('name', '')
                    if subject_name:
                        categories.append(subject_name)
                elif isinstance(subject, str):
                    categories.append(subject)

            # Extract keywords
            keywords = []
            tags = item.get('tags', [])
            for tag in tags:
                if isinstance(tag, dict):
                    tag_name = tag.get('name', '')
                    if tag_name:
                        keywords.append(tag_name)
                elif isinstance(tag, str):
                    keywords.append(tag)

            # Extract repository information
            repository = item.get('repository', {})
            repository_name = repository.get('name', '') if isinstance(repository, dict) else ''

            # Create Paper object
            return Paper(
                paper_id=core_id,
                title=title,
                authors=authors,
                abstract=abstract,
       
```

### Core Architecture Module: `paper_search_mcp/cli_search_worker.py`
```
"""Private one-source CLI worker. JSON in/out, diagnostic messages on stderr."""

from __future__ import annotations

import json
import sys
from contextlib import redirect_stdout


def main() -> None:
    status = 0
    try:
        job = json.load(sys.stdin)
        # Redirection is safe here: this process executes just one source.
        with redirect_stdout(sys.stderr):
            from .cli import _get_searcher

            searcher = _get_searcher(job["source"])
            papers = searcher.search(job["query"], max_results=job["max_results"], **job["kwargs"])
            result = [paper.to_dict() for paper in papers]
    except Exception as exc:
        result = {"error": str(exc) or type(exc).__name__}
        status = 1
    print(json.dumps(result, default=str))
    raise SystemExit(status)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `paper_search_mcp/utils.py`
```
import re

def extract_doi(text: str) -> str:
    """Extract DOI from arbitrary text or URL if present."""
    if not text:
        return ""
    match = re.search(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", text, re.IGNORECASE)
    return match.group(0).rstrip(".,;)") if match else ""

```

### Core Architecture Module: `paper_search_mcp/__init__.py`
```
from .config import load_env_file

load_env_file()


```

### Core Architecture Module: `paper_search_mcp/academic_platforms/acm.py`
```
"""ACM Digital Library connector — keyless.

Since 1 January 2026 the entire ACM Digital Library is open access, and ACM
does not offer a public search API, so no API key exists for this source.
Search is served from Crossref restricted to ACM's DOI prefix (``10.1145``),
which covers every ACM-published work with full bibliographic metadata.

PDFs live at ``https://dl.acm.org/doi/pdf/<doi>`` and are free to read, but
dl.acm.org sits behind a Cloudflare browser challenge that rejects scripted
clients.  ``download_pdf`` tries the direct link first and, when blocked,
raises with the browser URL so the user (or ``download_with_fallback``) can
take over.
"""

from __future__ import annotations

import logging
import os
from typing import List, Optional

import requests

from .crossref import CrossRefSearcher
from ..paper import Paper

logger = logging.getLogger(__name__)

ACM_DOI_PREFIX = "10.1145"


class ACMSearcher(CrossRefSearcher):
    """ACM Digital Library search via Crossref's ACM DOI prefix."""

    PDF_URL_TEMPLATE = "https://dl.acm.org/doi/pdf/{doi}"
    PAGE_URL_TEMPLATE = "https://dl.acm.org/doi/{doi}"

    def search(self, query: str, max_results: int = 10, **kwargs) -> List[Paper]:
        prefix_filter = f"prefix:{ACM_DOI_PREFIX}"
        extra_filter = kwargs.pop("filter", "")
        kwargs["filter"] = f"{prefix_filter},{extra_filter}" if extra_filter else prefix_filter

        papers = super().search(query, max_results=max_results, **kwargs)
        for paper in papers:
            self._to_acm(paper)
        return papers

    def get_paper_by_doi(self, doi: str) -> Optional[Paper]:
        doi = self._validate_acm_doi(doi)
        paper = super().get_paper_by_doi(doi)
        if paper is not None:
            self._to_acm(paper)
        return paper

    def _to_acm(self, paper: Paper) -> None:
        paper.source = "acm"
        if paper.doi:
            paper.url = self.PAGE_URL_TEMPLATE.format(doi=paper.doi)
            paper.pdf_url = self.PDF_URL_TEMPLATE.format(doi=paper.doi)

    @staticmethod
    def _validate_acm_doi(paper_id: str) -> str:
        doi = paper_id.strip()
        for prefix in ("https://doi.org/", "http://doi.org/", "doi:"):
            if doi.lower().startswith(prefix):
                doi = doi[len(prefix):].strip()
                break
        if not doi.startswith(f"{ACM_DOI_PREFIX}/") or not doi[len(ACM_DOI_PREFIX) + 1:]:
            raise ValueError(f"Not an ACM DOI (expected {ACM_DOI_PREFIX}/...): {paper_id}")
        return doi

    def download_pdf(self, paper_id: str, save_path: str = "./downloads") -> str:
        """Download an ACM PDF by DOI (``10.1145/...``).

        Raises:
            ValueError: If ``paper_id`` is not an ACM DOI.
            IOError: If dl.acm.org blocks the scripted request.
        """
        doi = self._validate_acm_doi(paper_id)

        pdf_url = self.PDF_URL_TEMPLATE.format(doi=doi)
        response = requests.get(
            pdf_url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            timeout=30,
        )
        if response.status_code != 200 or not response.content.startswith(b"%PDF"):
            raise IOError(
                f"dl.acm.org blocked the automated download (HTTP {response.status_code}, "
                f"Cloudflare browser check). The paper is free to read: open {pdf_url} in a "
                f"browser, or call download_with_fallback(source='acm', paper_id='{doi}', "
                f"doi='{doi}') to try open repositories (arXiv, OpenAIRE, CORE, Unpaywall)."
            )

        os.makedirs(save_path, exist_ok=True)
        output_path = os.path.join(save_path, f"acm_{doi.replace('/', '_')}.pdf")
        with open(output_path, "wb") as file_obj:
            file_obj.write(response.content)
        return output_path

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        from pypdf import PdfReader

        pdf_path = self.download_pdf(paper_id, save_path)
        reader = PdfReader(pdf_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()

```

### Core Architecture Module: `paper_search_mcp/academic_platforms/arxiv.py`
```
# paper_search_mcp/sources/arxiv.py
import logging
import os
import re
import time
import tempfile
from datetime import datetime
from threading import Lock
from typing import List
from xml.etree import ElementTree

import feedparser
import requests
from pypdf import PdfReader

from ..paper import Paper
from ..utils import extract_doi
from .base import PaperSource


logger = logging.getLogger(__name__)


class ArxivSearcher(PaperSource):
    """Searcher for arXiv papers.

    arXiv TOU requires no more than 1 request per 3 seconds with a single
    concurrent connection (https://info.arxiv.org/help/api/tou.html). A shared
    lock and timestamp enforce that policy across all instances in this Python
    process. Cross-process and cross-machine pacing remain the caller's
    responsibility.
    """
    BASE_URL = "https://export.arxiv.org/api/query"
    MIN_INTERVAL_SEC = 3.0  # arXiv TOU minimum
    MAX_ATTEMPTS = 3
    RETRYABLE_STATUS_CODES = frozenset((429, 500, 502, 503, 504))
    _request_lock = Lock()
    _last_request_at = 0.0
    _FIELD_PREFIX_RE = re.compile(
        r"(?:^|\s)(ti|au|abs|co|jr|cat|rn|id|all):",
        re.IGNORECASE,
    )
    _BOOLEAN_OP_RE = re.compile(r"(?:^|\s)(AND|OR|ANDNOT)(?:\s|$)")
    _PAPER_ID_RE = re.compile(
        r"(?:[0-9]{4}\.[0-9]{4,5}|[a-z-]+(?:\.[A-Z]{2})?/[0-9]{7})(?:v[1-9][0-9]*)?"
    )
    MAX_PDF_BYTES = 100 * 1024 * 1024

    @classmethod
    def _pdf_path(cls, paper_id, save_path):
        if (not isinstance(paper_id, str) or len(paper_id) > 128
                or not cls._PAPER_ID_RE.fullmatch(paper_id)):
            raise ValueError("Expected a bare arXiv paper ID, optionally with a version")
        # Legacy category/number IDs retain their historical subdirectory path.
        return os.path.join(os.fspath(save_path), *paper_id.split("/")) + ".pdf"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'paper-search-mcp/1.0 (mailto:openags@example.com)',
            'Accept': 'application/atom+xml, application/xml;q=0.9, */*;q=0.8',
        })

    @classmethod
    def _pace_locked(cls):
        """Pace a request while the process-wide request lock is held."""
        now = time.monotonic()
        elapsed = now - cls._last_request_at
        if cls._last_request_at > 0 and elapsed < cls.MIN_INTERVAL_SEC:
            time.sleep(cls.MIN_INTERVAL_SEC - elapsed)
        cls._last_request_at = time.monotonic()

    @staticmethod
    def _is_soft_rate_limit(response: requests.Response) -> bool:
        """Detect arXiv's HTTP-200 ``Rate exceeded.`` response."""
        body_head = (response.content or b"")[:64]
        if isinstance(body_head, str):
            body_head = body_head.encode("utf-8", errors="ignore")
        return body_head.strip().lower().startswith(b"rate exceeded")

    @classmethod
    def _is_usable_406_feed(cls, response: requests.Response) -> bool:
        """Only recover nonempty, well-formed arXiv results behind a bad status.

        feedparser intentionally tolerates malformed XML and HTML, so parsing
        alone is not enough. Empty feeds and arXiv API error entries cannot
        establish that a 406 was a successful search.
        """
        try:
            root = ElementTree.fromstring(response.content)
            if root.tag != "{http://www.w3.org/2005/Atom}feed":
                return False
            feed = feedparser.parse(response.content)
            if feed.bozo or feed.version != "atom10" or not feed.entries:
                return False
            if not re.fullmatch(
                r"https?://arxiv\.org/api/[^\s]+", feed.feed.get("id", "")
            ):
                return False
            total = int(feed.feed.get("opensearch_totalresults", "0"))
            if total < len(feed.entries):
                return False
            for entry in feed.entries:
                if not re.fullmatch(
                    r"https?://arxiv\.org/abs/(?:[0-9]{4}\.[0-9]{4,5}|"
                    r"[a-z-]+(?:\.[A-Z]{2})?/[0-9]{7})(?:v[0-9]+)?",
                    entry.get("id", ""),
                ):
                    return False
                if not all(entry.get(field, "").strip() for field in ("title", "summary")):
                    return False
                if not entry.get("authors") or not entry.get("tags"):
                    return False
                # Verify every entry can actually be consumed, rather than
                # accepting a feed whose entries search() would silently skip.
                cls._paper_from_entry(entry)
            return True
        except (ElementTree.ParseError, ValueError, TypeError, AttributeError, KeyError):
            return False

    def _request_with_retries(self, params):
        """Issue one serialized, paced arXiv request sequence."""
        response = None
        saw_unusable_406 = False
        with self._request_lock:
            for attempt in range(self.MAX_ATTEMPTS):
                self._pace_locked()
                try:
                    response = self.session.get(
                        self.BASE_URL,
                        params=params,
                        timeout=30,
                    )
                except requests.RequestException:
                    response = None
                    if attempt < self.MAX_ATTEMPTS - 1:
                        time.sleep((attempt + 1) * 1.5)
                    continue

                if response.status_code == 200:
                    if not self._is_soft_rate_limit(response):
                        return response
                    if attempt < self.MAX_ATTEMPTS - 1:
                        time.sleep((attempt + 1) * 5.0)
                        continue
                    raise requests.RequestException(
                        "arxiv rate-limited: 'Rate exceeded.' body persisted "
                        f"across {self.MAX_ATTEMPTS} attempts"
                    )

                if response.status_code == 406:
                    if self._is_usable_406_feed(response):
                        return response
                    saw_unusable_406 = True
                    if attempt < self.MAX_ATTEMPTS - 1:
                        time.sleep((attempt + 1) * 1.5)
                    continue

                if response.status_code in self.RETRYABLE_STATUS_CODES:
                    if attempt < self.MAX_ATTEMPTS - 1:
                        time.sleep((attempt + 1) * 1.5)
                        continue
                    if response.status_code == 429:
                        raise requests.RequestException(
                            "arxiv rate-limited: HTTP 429 persisted "
                            f"across {self.MAX_ATTEMPTS} attempts"
                        )
                break
        if saw_unusable_406:
            raise requests.RequestException(
                "arxiv search failed: HTTP 406 without a usable arXiv Atom feed; "
                f"no successful response within {self.MAX_ATTEMPTS} attempts"
            )
        return response

    @staticmethod
    def _build_search_query(query: str) -> str:
        """Quote plain phrases while preserving arXiv's structured query syntax."""
        normalized = " ".join((query or "").split())
        if (
            '"' in normalized
            or ArxivSearcher._FIELD_PREFIX_RE.search(normalized)
            or ArxivSearcher._BOOLEAN_OP_RE.search(normalized)
        ):
            return normalized
        if re.search(r"\s", normalized):
            return f'all:"{normalized}"'
        return f'all:{normalized}'

    def search(self, query: str, max_results: int = 10, sort_by: str = 'relevance', sort_order: str = 'descending') -> List[Paper]:
        params = {
            'search_query': self._build_search_query(query),
            'max_results': max_results,
            'sortBy': sort_by,
            'sortOrder': sort_order,
        }
        response = self._request_with_retries(params)

        if response is None or response.status_code not in (200, 406):
            return []

        feed = feedparser.parse(response.content)
        papers = []
        for entry in feed.entries:
            try:
                papers.append(self._paper_from_entry(entry))
            except Exception as e:
                logger.warning("Error parsing arXiv entry: %s", e)
        return papers

    @staticmethod
    def _paper_from_entry(entry) -> Paper:
        authors = [author.name for author in entry.authors]
        published = datetime.strptime(entry.published, '%Y-%m-%dT%H:%M:%SZ')
        updated = datetime.strptime(entry.updated, '%Y-%m-%dT%H:%M:%SZ')
        pdf_url = next((link.href for link in entry.links if link.type == 'application/pdf'), '')

        # Try to extract DOI from entry.doi or links or summary
        doi = entry.get('doi', '') or extract_doi(entry.summary) or extract_doi(entry.id)
        for link in entry.links:
            if link.get('title') == 'doi':
                doi = doi or extract_doi(link.href)

        return Paper(
            # Legacy identifiers include the category (e.g. hep-th/9901001).
            paper_id=entry.id.split('/abs/', 1)[-1],
            title=entry.title,
            authors=authors,
            abstract=entry.summary,
            url=entry.id,
            pdf_url=pdf_url,
            published_date=published,
            updated_date=updated,
            source='arxiv',
            categories=[tag.term for tag in entry.tags],
            keywords=[],
            doi=doi
        )

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        output_file = self._pdf_path(paper_id, save_path)
        pdf_url = f"https://arxiv.org/pdf/{paper_id}.pdf"
        temporary_path = ""
        if not self._request_lock.acquire(timeout=30):
            raise requests.RequestException("arXiv download timed out waiting for its request slot")
        try:
            self._pace_locked()

```

### Core Architecture Module: `paper_search_mcp/academic_platforms/base.py`
```
"""Base class for all academic paper source searchers."""
from abc import ABC, abstractmethod
from typing import List
from ..paper import Paper


class PaperSource(ABC):
    """Abstract base class for academic paper sources."""

    @abstractmethod
    def search(self, query: str, **kwargs) -> List[Paper]:
        """Search papers matching the query.

        Args:
            query: Search query string.
            **kwargs: Source-specific parameters (e.g., max_results, year).

        Returns:
            List of Paper objects.
        """

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download the PDF for a given paper.

        Args:
            paper_id: Platform-specific paper identifier.
            save_path: Directory to save the downloaded PDF.

        Returns:
            Path to the saved PDF file.

        Raises:
            NotImplementedError: If the source does not support PDF downloads.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} does not support PDF downloads."
        )

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        """Download and extract text from a paper PDF.

        Args:
            paper_id: Platform-specific paper identifier.
            save_path: Directory where the PDF is/will be saved.

        Returns:
            Extracted text content of the paper.

        Raises:
            NotImplementedError: If the source does not support paper reading.
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} does not support reading paper content."
        )

```

### Core Architecture Module: `paper_search_mcp/academic_platforms/base_search.py`
```
# paper_search_mcp/academic_platforms/base_search.py
"""Searcher for BASE (Bielefeld Academic Search Engine).

BASE is one of the world's most voluminous search engines especially for
academic open access web resources. It provides OAI-PMH access to metadata
from thousands of repositories.

OAI-PMH Endpoint: https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi
Documentation: https://www.base-search.net/about/en/about_sources_date.php
"""

from typing import List, Optional, Dict, Any
import logging
from .oaipmh import OAIPMHSearcher
from ..paper import Paper

logger = logging.getLogger(__name__)


class BASESearcher(OAIPMHSearcher):
    """Searcher for BASE (Bielefeld Academic Search Engine)."""

    def __init__(self):
        """Initialize BASE searcher with OAI-PMH endpoint."""
        super().__init__(
            base_url="https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi",
            metadata_prefix="oai_dc"
        )
        # Update User-Agent for BASE
        self.session.headers.update({
            'User-Agent': 'paper-search-mcp/0.1.3 (BASE OAI-PMH client; https://github.com/openags/paper-search-mcp)'
        })

    def search(self, query: str, max_results: int = 10, **kwargs) -> List[Paper]:
        """Search BASE using OAI-PMH with query filtering.

        Args:
            query: Search query string
            max_results: Maximum number of results to return
            **kwargs: Additional parameters:
                - set: OAI-PMH set specification (e.g., 'pubtype:article')
                - from_date: Harvest from date (YYYY-MM-DD)
                - until_date: Harvest until date (YYYY-MM-DD)
                - language: Filter by language (e.g., 'en', 'de')
                - subject: Filter by subject category
                - has_fulltext: Filter for fulltext availability (True/False)
                - open_access: Filter for open access content (True/False)

        Returns:
            List of Paper objects
        """
        # BASE-specific sets
        if 'has_fulltext' in kwargs and kwargs['has_fulltext']:
            kwargs['set'] = kwargs.get('set', '') + ' dcterms:accessRights:open'
        if 'open_access' in kwargs and kwargs['open_access']:
            kwargs['set'] = kwargs.get('set', '') + ' dcterms:accessRights:open'

        # Call parent OAI-PMH search
        papers = super().search(query, max_results, **kwargs)

        # Apply additional BASE-specific filtering
        filtered_papers = []
        for paper in papers:
            if self._filter_paper(paper, kwargs):
                filtered_papers.append(paper)
            if len(filtered_papers) >= max_results:
                break

        return filtered_papers[:max_results]

    def _filter_paper(self, paper: Paper, filters: Dict[str, Any]) -> bool:
        """Apply BASE-specific filters to paper.

        Args:
            paper: Paper object
            filters: Filter parameters

        Returns:
            True if paper passes all filters
        """
        # Language filter
        if 'language' in filters and filters['language']:
            paper_lang = paper.extra.get('language', '').lower() if paper.extra else ''
            if not paper_lang or paper_lang != filters['language'].lower():
                return False

        # Subject filter
        if 'subject' in filters and filters['subject']:
            subject_lower = filters['subject'].lower()
            in_categories = any(subject_lower in cat.lower() for cat in paper.categories)
            in_keywords = any(subject_lower in kw.lower() for kw in paper.keywords)
            if not in_categories and not in_keywords:
                return False

        # Open access filter (already handled in OAI-PMH set)
        # Fulltext filter
        if 'has_fulltext' in filters and filters['has_fulltext']:
            if not paper.pdf_url and not paper.url:
                return False

        return True

    def _enrich_paper_from_oai(self, paper: Paper, dc_root):
        """Enrich Paper object with BASE-specific metadata.

        Overrides parent method to extract BASE-specific fields.

        Args:
            paper: Paper object to enrich
            dc_root: Dublin Core XML element
        """
        super()._enrich_paper_from_oai(paper, dc_root)

        # BASE-specific fields
        if not paper.extra:
            paper.extra = {}

        # Extract BASE-specific identifiers
        import xml.etree.ElementTree as ET
        identifiers = dc_root.findall('.//{http://purl.org/dc/elements/1.1/}identifier') or \
                     dc_root.findall('identifier')

        for ident_elem in identifiers:
            if ident_elem.text:
                ident_text = ident_elem.text.lower()
                if 'base-search.net' in ident_text:
                    paper.extra['base_id'] = ident_text
                elif 'urn:nbn:' in ident_text:
                    paper.extra['urn'] = ident_text
                elif 'hdl.handle.net' in ident_text:
                    paper.extra['handle'] = ident_text

        # Extract rights information
        rights_elems = dc_root.findall('.//{http://purl.org/dc/elements/1.1/}rights') or \
                      dc_root.findall('rights')
        if rights_elems:
            paper.extra['rights'] = [elem.text for elem in rights_elems if elem.text]

        # Extract source repository
        source_elems = dc_root.findall('.//{http://purl.org/dc/elements/1.1/}source') or \
                      dc_root.findall('source')
        if source_elems:
            paper.extra['repository'] = source_elems[0].text if source_elems[0].text else ''

        # Try to extract PDF URL from identifiers
        if not paper.pdf_url:
            for ident_elem in identifiers:
                if ident_elem.text and ident_elem.text.lower().endswith('.pdf'):
                    paper.pdf_url = ident_elem.text
                    break

        # Extract BASE relevance score if available
        # (BASE doesn't provide relevance scores in OAI-PMH, but we might add it from other sources)

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download PDF for a BASE record.

        BASE often provides direct PDF links in metadata.

        Args:
            paper_id: BASE identifier or OAI-PMH identifier
            save_path: Directory to save PDF

        Returns:
            Path to saved PDF file

        Raises:
            NotImplementedError: If PDF cannot be downloaded
        """
        # Try parent method first (searches for PDF URL)
        try:
            return super().download_pdf(paper_id, save_path)
        except Exception as e:
            logger.warning(f"Parent download failed: {e}")

        # Try alternative approach: search for paper and use first PDF link
        papers = self.search(paper_id, max_results=1)
        if not papers:
            raise ValueError(f"BASE record not found: {paper_id}")

        paper = papers[0]
        if paper.pdf_url:
            import os
            import requests
            response = self.session.get(paper.pdf_url, timeout=30)
            response.raise_for_status()
            os.makedirs(save_path, exist_ok=True)

            # Create safe filename
            safe_id = paper_id.replace('/', '_').replace(':', '_')
            filename = f"base_{safe_id}.pdf"
            output_file = os.path.join(save_path, filename)

            with open(output_file, 'wb') as f:
                f.write(response.content)

            logger.info(f"Downloaded PDF to {output_file}")
            return output_file

        raise NotImplementedError(
            f"No PDF available for BASE record: {paper_id}"
        )

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        """Read paper text from PDF.

        Args:
            paper_id: Paper identifier
            save_path: Directory where PDF is/will be saved

        Returns:
            Extracted text content

        Raises:
            NotImplementedError: If PDF cannot be read
        """
        try:
            return super().read_paper(paper_id, save_path)
        except Exception as e:
            logger.error(f"Error reading BASE paper {paper_id}: {e}")
            raise NotImplementedError(
                f"Cannot read paper from BASE: {e}"
            )


if __name__ == "__main__":
    """Test the BASESearcher."""
    import logging
    logging.basicConfig(level=logging.INFO)

    searcher = BASESearcher()

    # Test search
    print("Testing BASE search...")

    # Test queries
    test_queries = [
        "machine learning",
        "artificial intelligence",
        "data science"
    ]

    for query in test_queries[:1]:  # Test first query only
        print(f"\nSearching BASE for: '{query}'")
        papers = searcher.search(query, max_results=3)
        print(f"Found {len(papers)} papers")
        for i, paper in enumerate(papers):
            print(f"{i+1}. {paper.title}")
            print(f"   Authors: {', '.join(paper.authors[:3])}")
            print(f"   Source: {paper.source}")
            print(f"   PDF: {'Yes' if paper.pdf_url else 'No'}")
            print(f"   URL: {paper.url}")
            print()
```

### Core Architecture Module: `paper_search_mcp/academic_platforms/biorxiv.py`
```
import logging
import os
import re
from datetime import date, datetime, time, timedelta
from urllib.parse import urlencode

import requests
from pypdf import PdfReader

from ..paper import Paper
from ..utils import extract_doi
from .base import PaperSource

logger = logging.getLogger(__name__)


class BioRxivSearcher(PaperSource):
    """Searcher for bioRxiv papers"""

    BASE_URL = "https://api.biorxiv.org/details/biorxiv"
    DATE_RANGE_PATTERN = re.compile(
        r"^\s*(\d{4}-\d{2}-\d{2})\s*(?:/|:|\.\.|to)\s*(\d{4}-\d{2}-\d{2})\s*$",
        re.IGNORECASE,
    )

    def __init__(self):
        self.session = requests.Session()
        self.session.proxies = {"http": None, "https": None}
        self.timeout = 30
        self.max_retries = 3

    @staticmethod
    def _normalize_category(category: str) -> str:
        return re.sub(r"[\s-]+", "_", category.strip().lower())

    def _resolve_query_mode(
        self, query: str, days: int
    ) -> tuple[str, str, str, str | None]:
        """Resolve a query into (mode, start_or_doi, end_or_na, category)."""
        normalized_query = (query or "").strip()
        doi = extract_doi(normalized_query)
        if doi:
            return "doi", doi, "na", None

        date_match = self.DATE_RANGE_PATTERN.match(normalized_query)
        if date_match:
            start_date, end_date = date_match.groups()
            parsed_start = date.fromisoformat(start_date)
            parsed_end = date.fromisoformat(end_date)
            if parsed_start > parsed_end:
                raise ValueError("bioRxiv date range start must not be after its end")
            return "interval", start_date, end_date, None

        if days < 1:
            raise ValueError("days must be at least 1")

        today = date.today()
        end_date = today.isoformat()
        start_date = (today - timedelta(days=days)).isoformat()
        category = (
            self._normalize_category(normalized_query) if normalized_query else None
        )
        return "interval", start_date, end_date, category

    def _request_json(self, url: str) -> dict | None:
        for attempt in range(1, self.max_retries + 1):
            try:
                response = self.session.get(url, timeout=self.timeout)
                response.raise_for_status()
                return response.json()
            except (requests.exceptions.RequestException, ValueError) as exc:
                if attempt == self.max_retries:
                    logger.warning(
                        "bioRxiv request failed after %d attempts: %s",
                        self.max_retries,
                        exc,
                    )
                    return None
                logger.info(
                    "bioRxiv request attempt %d failed; retrying: %s",
                    attempt,
                    exc,
                )
        return None

    @staticmethod
    def _parse_papers(collection: list) -> list[Paper]:
        papers = []
        for item in collection:
            try:
                doi = str(item.get("doi") or "").strip()
                title = str(item.get("title") or "").strip()
                if not doi or not title:
                    raise ValueError("missing DOI or title")

                published_date = datetime.combine(
                    date.fromisoformat(item["date"]),
                    time.min,
                )
                version = str(item.get("version") or "1")
                authors = [
                    author.strip()
                    for author in str(item.get("authors") or "").split(";")
                    if author.strip()
                ]
                category = str(item.get("category") or "").strip()

                papers.append(
                    Paper(
                        paper_id=doi,
                        title=title,
                        authors=authors,
                        abstract=str(item.get("abstract") or ""),
                        url=f"https://www.biorxiv.org/content/{doi}v{version}",
                        pdf_url=(
                            f"https://www.biorxiv.org/content/{doi}v{version}.full.pdf"
                        ),
                        published_date=published_date,
                        updated_date=published_date,
                        source="biorxiv",
                        categories=[category] if category else [],
                        keywords=[],
                        doi=doi,
                    )
                )
            except (KeyError, TypeError, ValueError) as exc:
                logger.warning("Failed to parse bioRxiv entry: %s", exc)
        return papers

    def search(self, query: str, max_results: int = 10, days: int = 30) -> list[Paper]:
        """Search by DOI, date range, category, or recent-paper interval."""
        if max_results <= 0:
            return []

        mode, start, end, category = self._resolve_query_mode(query, days)
        if mode == "doi":
            data = self._request_json(f"{self.BASE_URL}/{start}/{end}/json")
            if not data:
                return []
            return self._parse_papers(data.get("collection") or [])[:max_results]

        papers: list[Paper] = []
        cursor = 0
        while len(papers) < max_results:
            url = f"{self.BASE_URL}/{start}/{end}/{cursor}/json"
            if category:
                url = f"{url}?{urlencode({'category': category})}"

            data = self._request_json(url)
            if not data:
                break

            collection = data.get("collection") or []
            if not collection:
                break

            papers.extend(self._parse_papers(collection))
            if len(collection) < 100:
                break
            cursor += 100

        return papers[:max_results]

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """
        Download a PDF for a given paper ID from bioRxiv.

        Args:
            paper_id: The DOI of the paper.
            save_path: Directory to save the PDF.

        Returns:
            Path to the downloaded PDF file.
        """
        if not paper_id:
            raise ValueError("Invalid paper_id: paper_id is empty")

        pdf_url = f"https://www.biorxiv.org/content/{paper_id}v1.full.pdf"
        tries = 0
        while tries < self.max_retries:
            try:
                # Add User-Agent to avoid potential 403 errors
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
                response = self.session.get(
                    pdf_url, timeout=self.timeout, headers=headers
                )
                response.raise_for_status()
                os.makedirs(save_path, exist_ok=True)
                output_file = f"{save_path}/{paper_id.replace('/', '_')}.pdf"
                with open(output_file, "wb") as f:
                    f.write(response.content)
                return output_file
            except requests.exceptions.RequestException as e:
                tries += 1
                if tries == self.max_retries:
                    raise Exception(
                        f"Failed to download PDF after {self.max_retries} attempts: {e}"
                    )
                logger.warning("Attempt %s failed, retrying...", tries)

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        """
        Read a paper and convert it to text format.

        Args:
            paper_id: bioRxiv DOI
            save_path: Directory where the PDF is/will be saved

        Returns:
            str: The extracted text content of the paper
        """
        pdf_path = f"{save_path}/{paper_id.replace('/', '_')}.pdf"
        if not os.path.exists(pdf_path):
            pdf_path = self.download_pdf(paper_id, save_path)

        try:
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
        except Exception as e:
            logger.error("Error reading PDF for paper %s: %s", paper_id, e)
            return ""

```

### Core Architecture Module: `paper_search_mcp/academic_platforms/chemrxiv.py`
```
# paper_search_mcp/academic_platforms/chemrxiv.py
"""Searcher for ChemRxiv chemistry preprint server.

ChemRxiv (Chemical Preprint Server) is a free submission, distribution,
and archive service for unpublished preprints in chemistry and related fields.

This searcher uses the Crossref API filtered for ChemRxiv preprints.
"""

from typing import List, Optional
import logging
from .crossref import CrossRefSearcher
from ..paper import Paper

logger = logging.getLogger(__name__)


class ChemRxivSearcher(CrossRefSearcher):
    """Searcher for ChemRxiv chemistry preprints."""

    def __init__(self):
        """Initialize ChemRxiv searcher."""
        super().__init__()
        self.preprint_server = "chemrxiv"
        self.server_name = "ChemRxiv"
        self.server_url = "https://chemrxiv.org"

    def search(self, query: str, max_results: int = 10, **kwargs) -> List[Paper]:
        """Search ChemRxiv for chemistry preprints.

        Args:
            query: Search query string
            max_results: Maximum number of results to return
            **kwargs: Additional parameters:
                - year: Filter by year
                - author: Filter by author
                - subject: Filter by subject area

        Returns:
            List of Paper objects from ChemRxiv
        """
        # Build Crossref filter for ChemRxiv preprints
        base_filter = f"type:posted-content,from-publisher:{self.preprint_server}"

        # Add subject filter for chemistry if not already specified
        if 'subject' not in kwargs:
            # Chemistry-related subjects
            chemistry_subjects = [
                'chemistry', 'chemical', 'biochemistry', 'organic chemistry',
                'inorganic chemistry', 'physical chemistry', 'analytical chemistry'
            ]
            # But we'll let Crossref handle subject filtering
            pass

        # Update kwargs with ChemRxiv-specific filter
        if 'filter' in kwargs:
            kwargs['filter'] = f"{kwargs['filter']},{base_filter}"
        else:
            kwargs['filter'] = base_filter

        # Call parent Crossref search
        papers = super().search(query, max_results, **kwargs)

        # Add ChemRxiv-specific metadata
        for paper in papers:
            paper.source = 'chemrxiv'
            if not paper.extra:
                paper.extra = {}
            paper.extra['preprint_server'] = self.preprint_server
            paper.extra['server_name'] = self.server_name
            paper.extra['server_url'] = self.server_url

            # Ensure URL points to ChemRxiv if possible
            if not paper.url or 'chemrxiv' not in paper.url:
                if paper.doi:
                    # Try to construct ChemRxiv URL from DOI
                    paper.url = f"https://doi.org/{paper.doi}"
                # Crossref should already provide publisher URLs

        return papers

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download PDF for a ChemRxiv preprint.

        Args:
            paper_id: DOI or ChemRxiv identifier
            save_path: Directory to save PDF

        Returns:
            Path to saved PDF file

        Raises:
            NotImplementedError: If PDF cannot be downloaded
        """
        # Try parent method first (uses Crossref links)
        try:
            return super().download_pdf(paper_id, save_path)
        except Exception as e:
            logger.warning(f"Crossref download failed: {e}")

        # Try ChemRxiv-specific approach
        # ChemRxiv PDFs are typically at: https://chemrxiv.org/engage/chemrxiv/article-details/{id}
        # But we need the article ID

        # Search for the paper first
        papers = self.search(paper_id, max_results=1)
        if not papers:
            raise ValueError(f"ChemRxiv preprint not found: {paper_id}")

        paper = papers[0]
        if paper.pdf_url:
            import os
            import requests
            response = self.session.get(paper.pdf_url, timeout=30)
            response.raise_for_status()
            os.makedirs(save_path, exist_ok=True)

            # Create safe filename
            safe_id = paper_id.replace('/', '_').replace(':', '_')
            filename = f"chemrxiv_{safe_id}.pdf"
            output_file = os.path.join(save_path, filename)

            with open(output_file, 'wb') as f:
                f.write(response.content)

            logger.info(f"Downloaded PDF to {output_file}")
            return output_file

        raise NotImplementedError(
            f"No PDF available for ChemRxiv preprint: {paper_id}"
        )

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        """Read preprint text from PDF.

        Args:
            paper_id: Paper identifier
            save_path: Directory where PDF is/will be saved

        Returns:
            Extracted text content

        Raises:
            NotImplementedError: If PDF cannot be read
        """
        try:
            return super().read_paper(paper_id, save_path)
        except Exception as e:
            logger.error(f"Error reading ChemRxiv preprint {paper_id}: {e}")
            raise NotImplementedError(
                f"Cannot read preprint from ChemRxiv: {e}"
            )


if __name__ == "__main__":
    """Test the ChemRxivSearcher."""
    import logging
    logging.basicConfig(level=logging.INFO)

    searcher = ChemRxivSearcher()

    # Test search
    print("Testing ChemRxiv search...")

    # Chemistry-related queries
    test_queries = [
        "catalysis",
        "organic synthesis",
        "nanomaterials",
        "protein structure"
    ]

    for query in test_queries[:1]:  # Test first query only
        print(f"\nSearching ChemRxiv for: '{query}'")
        papers = searcher.search(query, max_results=3)
        print(f"Found {len(papers)} preprints")
        for i, paper in enumerate(papers):
            print(f"{i+1}. {paper.title}")
            print(f"   Authors: {', '.join(paper.authors[:3])}")
            print(f"   Year: {paper.published_date.year if paper.published_date else 'Unknown'}")
            print(f"   DOI: {paper.doi}")
            print(f"   PDF: {'Yes' if paper.pdf_url else 'No'}")
            print()
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #148** (2026-10-02): **feat(cli): add opt-in source search deadlines**
  *Symptoms*: ## Summary  Add an opt-in `paper-search search QUERY --source-timeout SECONDS` for slow sources discovered while dogfooding the CLI after #146.  - Run at most four selected sources in isolated Python workers - Kill, drain, and reap timed-out or cancelled workers so blocking network calls cannot hold CLI interpreter shutdown open - Keep successful-source results, existing source labels/kwargs, JSON fields, sorting, and partial-result exit status - Preserve the existing default search path and both workflow files  The per-source budget includes worker initialization, search, serialization, and exit. OS process creation, queue time, and cleanup add overhead; this is not a whole-command deadline.  ## Validation  - Exact existing deterministic CI allowlist: 1,069 tests plus 8 subtests passed on each of Python 3.10, 3.12, and 3.13 - 21 new offline regressions in the already-selected timeout suite cover actual CLI process exit, SIGTERM-resistant sleepers, successful-source retention, full pipes, Ctrl-C, cancellation during process creation, bounded concurrency, fresh queued budgets, and descriptor cleanup - Source compilation and whitespace checks passed - All failure tests use deterministic local workers; outbound-network guards recorded no requests - Windows execution and live-provider validation were not performed  ## Scope  Five files only. No dependencies, credentials, workflow changes, package release, or deployment.

- **Issue #147** (2026-10-02): **fix(arxiv): validate downloads before replacement and surface read errors**
  *Symptoms*: ## Summary Follow-up to the concrete arXiv artifact/read issues identified during practical CLI dogfooding after #146.  - Validate bare modern and legacy arXiv IDs before path or network use. - Serialize and pace downloads using the existing process request lock, with a bounded lock wait and explicit connect/read timeouts. - Stream at most 100 MiB to a same-directory temporary file. Require HTTP 200, a PDF header and basic pypdf parsing before atomic replacement. - Preserve the previous destination on HTTP errors, invalid/truncated PDF responses, stream failures, size-limit and replace failures; clean owned partial files. - Surface invalid, encrypted or image-only read failures as CLI/MCP errors rather than empty successful text; preserve legitimate pages with no text within readable documents.  ## Verification Complete existing deterministic CI allowlist: **1,047 tests + 8 subtests** passed on each of Python **3.10, 3.12 and 3.13** in task-local environments pointing to this exact checkout. Final runs used external DNS/Requests/HTTPX transport guards, with no outbound attempt recorded. Tests include real generated PDFs plus offline HTTP/error/partial-stream fixtures; no new live arXiv requests were made for this patch. A setup attempt accidentally selected a legacy live test before the exact class-qualified CI selection was corrected; its external request was blocked and that failed run is not included in the final result.  ## Boundaries No dependency, credential, release/CI
  **Post-Mortem & Fix Analysis**:
  > Follow-up review found that arXiv search discarded the category prefix of legacy IDs (for example, hep-th/9901001v1). Commit 4c210a63c864d29dea6cde1e0af4dcf590bcea83 preserves that ID through the search-to-download path and adds a regression.  Final exact local tree 7b5035f288f60a00f7b2300c9fede3a9d557767e passed the existing deterministic CI allowlist: 1,048 tests + 8 subtests on each Python 3.10/3.12/3.13. External transport guards recorded no outbound attempts in these final runs. Both workflow files remain byte-identical to the base. Exact-head CI is being verified separately before merge.

- **Issue #146** (2026-10-02): **fix(cli): reject unsuccessful PDF download results**
  *Symptoms*: ## Problem Dogfooding the public-source research workflow exposed a misleading CLI contract: some connectors return explanatory error strings instead of raising, and `paper-search download` reported those strings as `status: "ok"` / a path, with exit code 0. A saved HTML access-error page also qualified as success.  The error-string regression was reproduced offline with the actual SemanticSearcher no-PDF return branch, stubbing only its metadata lookup. This is not a claim that a live Semantic download failed during this run.  ## Change - Require the returned path to be a readable regular file with a PDF header before emitting success - Report connector error strings, missing/empty/directory/unreadable artifacts, and saved HTML as JSON errors with exit code 1 - Preserve relative paths, paths with spaces, and legitimate filenames that resemble error messages - Keep the check lightweight: no claim of complete PDF integrity or requested-paper identity, and no deleting or rewriting rejected artifacts - Leave search behavior, MCP registry, and read-result contracts unchanged  ## Verification - Based on main `111bad07c5f1247c83adeed3e38896cf2c799037`, preserving the PDF-section work from #145 - Complete deterministic CI allowlist: **1,022 passed + 8 subtests** on each of Python **3.10, 3.12, and 3.13** on Linux; compileall and diff checks passed - Tests cover the real connector error-string contract, missing/empty/directory/invalid/unreadable paths, HTML responses, relative/spaced

- **Issue #145** (2026-10-02): **feat: add resource-limited local PDF section extraction**
  *Symptoms*: ## Summary Add `extract_sections` as a focused, evidence-preserving slice of [#94](https://github.com/openags/paper-search-mcp/issues/94), available through MCP and the existing generic CLI. It segments already-downloaded PDFs at recognized standalone English headings, preserving text order, repeated headings, exact body slices and page spans. Unknown text stays unclassified; cutoff fragments never become invented headings. Returned labels are explicitly heuristic.  ## Access and resource boundaries - Only relative `.pdf` paths below an operator-controlled `PAPER_SEARCH_MCP_SECTION_PDF_ROOT` (default `./downloads`). No caller root parameter, absolute/drive/UNC paths, traversal, symlinks/junctions, special files or non-PDF content. - Input capped at 20 MiB; default 30 pages / 60,000 characters / 50 sections / 30s, with ceilings of 100 pages / 200,000 characters / 100 sections / 60s. Explicit truncation and incomplete-line metadata. - **POSIX-only resource isolation**: single-use parser subprocess, 512 MiB address-space cap, CPU guard, 8 MiB stream/stream-array expansion limits, parent deadline termination/reaping and cancellation cleanup. Unsupported resource-limit platforms fail closed before reading a PDF. - Two admitted parser jobs and dedicated supervision, separate from the provider search pool. Minimal child environment; the parser receives bounded bytes and scalar options, not the PDF path or credentials. No network, OCR, model calls, external image decoders or new depe

- **Issue #144** (2026-10-02): **fix: respect Scholar session cooldown and report timeouts honestly**
  *Symptoms*: ## Summary - Extend the existing Scholar error handling from #74 with process-local cross-query cooldown and a serialized shared session, avoiding repeated requests after an upstream block. - Honor Retry-After seconds/HTTP dates. Delays over 30 seconds are carried across calls without sleeping in a worker; instructions over the supported 24-hour scheduling range defer all automatic requests for this connector's lifetime instead of retrying early. Consecutive blocked searches use 60/120/240/480/900-second cooldowns, extended by Retry-After. - Stop on CAPTCHA even when the response arrives after the deadline. Keep one identity within the session; no CAPTCHA solving, proxy rotation, session resets, or bypass. - Report direct MCP and connector timeouts as source errors instead of successful empty results. Unified searches keep correctly labeled results from explicitly selected alternative public sources.  ## Scope and limits This mitigates repeated calls and misleading feedback; it cannot guarantee Google Scholar access, a fixed quota, or recovery after a cooldown. State is process-local. Successful result lists retain their existing shape; upstream failure/cooldown/timeout raises GoogleScholarSearchError. Zero-result limits and an already-expired synchronous deadline remain no-request calls. No paid service, dependency, credential, source expansion, deployment, or release is added. #74 remains open pending broader live acceptance.  ## Verification - Complete CI deterministic all

- **Issue #143** (2026-10-02): **feat: integrate approved paper-search improvements with regression coverage**
  *Symptoms*: ## Approved scope Integrates reviewed components #134–#142: reliable PDF saves, shared CLI/MCP tool access, explicit WoS/Scopus, public OpenReview/SSRN/IEEE improvements, bounded OpenAlex relationships, optional local cache, optional OAuth protected-resource mode, and verified DSH/Skill packaging.  No billing, promotional links, medical-only pivot, new Anna's Archive integration, production deployment, credential setup or PyPI release. Institutional/full-text/cache/auth features retain explicit opt-in boundaries.  ## Combined validation Python3.12 and3.13 each passed 893 deterministic tests and8 subtests. Verified .pth-backed Requests/HTTPX/socket guards intercept before proxy routing, with zero outbound attempts in final runs. Earlier mixed-network/ineffective-guard attempts are excluded from this final proof. Legacy live-test collection is not run.  All60 existing MCP schemas/annotations remain unchanged;70 tools are available. Real combined-registry stdio/SSE/StreamableHTTP checks, cross-user OAuth session tests, CLI/cache integration checks, lock/dependency/build/wheel/source-byte/ZIP/npm-pack/compile and Python3.10 grammar checks pass. An isolated DSH0.2.0-rc.2 profile discovers70 tools and executes a registry call without model credentials or prompts. Exact-head remote CI must pass before merge.  ## Integration fixes Preserve both OpenAlex implementations, all CLI/source options, and additive configuration/docs. Synchronize the complete PR/release allowlist. Bypass cach

- **Issue #142** (2026-10-02): **feat: verify DSH integration and standalone skill packaging**
  *Symptoms*: ## Summary Reconcile #97 with current main. Pin DSH and its MCP client to 0.2.0-rc.2, clarify checkout versus cached PyPI launches, update keyless ACM guidance, preserve release tests and add matching read-only PR CI. Add a standalone Skill ZIP builder with explicit overwrite control, related to #66.  ## Validation 202 deterministic release-selected tests and 5 subtests passed on Python 3.12 and 3.13. Bundle/ZIP targeted checks, package build and stdio initialize/list/call passed. Actual isolated DSH 0.2.0-rc.2 profile installation, composition, boot, discovery of all 60 base MCP tools and a registry tool call passed on Node24. The daemon was stopped with a bounded timeout after the success marker. No model prompt or model credentials were supplied.  Old DSH0.1.0-rc.6 reached MCP discovery but failed in its resolved upstream HMR stack; the verified preview pin avoids that observed mismatch. npm installation exhausted its JS heap; official pnpm installation succeeded. These environment/upstream attempts are not represented as successful old-version tests.  ## Remaining acceptance boundary Claude web stayed on its security-verification page in the cloud browser after one reload, so actual upload/execution was not tested. The ZIP layout/content tests and reusable builder pass; they do not establish Claude web runtime capabilities. No CAPTCHA bypass or account setup occurred. Live model-mediated DSH calls remain separate from the registry smoke test.  ## Attribution Source https:

- **Issue #141** (2026-10-02): **feat(auth): add opt-in OAuth protected-resource mode**
  *Symptoms*: ## Summary - Add opt-in `--auth oauth` / `PAPER_SEARCH_MCP_AUTH=oauth` for both HTTP transports - Reuse MCP SDK protected-resource metadata, bearer/scope middleware and session identity, plus FastMCP JWKS/signature verification and joserfc standard claims validation - Require a trusted external HTTPS issuer/JWKS and exact resource/audience binding; reject malformed/missing configuration instead of starting open - Keep stdio and loopback defaults, and preserve open local HTTP when no OAuth configuration is supplied - Publish a concrete configuration/deployment contract without an auth server, database, bearer secret or Laravel dependency  ## Security validation - Missing, malformed, expired, wrong-issuer, wrong-audience, missing-scope and malformed signed claims on both transports - Public metadata and scope/discovery challenges; SSE inbound messages and all Streamable HTTP methods guarded - Algorithm/kid/critical-header rejection, token jku/x5u ignored, JWKS cache/rotation/outage/malformed responses - Real loopback MCP initialize/list/call on both transports, plus cross-subject session-ID rejection on both - Real stdio session succeeds despite malformed HTTP auth environment - DNS-rebinding protection remains enabled  ## Testing - Locked FastMCP 3.4.2 / MCP 1.27.2: 359 deterministic tests and 5 subtests passed on Python 3.12.14 and Python 3.13.5 - FastMCP 3.4.7 / MCP 1.30.0 compatibility: 140 OAuth tests passed (one installed-package stdio test intentionally deselected on the

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

### Incident Patch 1: `4c210a63` (2026-10-02)
**Commit Message**: fix(arxiv): retain legacy category identifiers from search

**File**: `paper_search_mcp/academic_platforms/arxiv.py` (modified, +2/-1)
```diff
@@ -222,7 +222,8 @@ def _paper_from_entry(entry) -> Paper:
                 doi = doi or extract_doi(link.href)
 
         return Paper(
-            paper_id=entry.id.split('/')[-1],
+            # Legacy identifiers include the category (e.g. hep-th/9901001).
+            paper_id=entry.id.split('/abs/', 1)[-1],
             title=entry.title,
             authors=authors,
             abstract=entry.summary,
```

**File**: `tests/test_arxiv_406.py` (modified, +11/-0)
```diff
@@ -59,6 +59,17 @@ def test_valid_406_arxiv_feed_returns_papers_without_retry(paced_searcher):
     assert searcher.session.get.call_args.kwargs["timeout"] == 30
 
 
+def test_search_retains_legacy_id_for_download(paced_searcher):
+    searcher, _, _ = paced_searcher
+    feed = ARXIV_FEED.replace(b"2401.12345v1", b"hep-th/9901001v1")
+    searcher.session.get = Mock(return_value=response_with(feed))
+    papers = searcher.search("legacy paper")
+    assert papers[0].paper_id == "hep-th/9901001v1"
+    assert searcher._pdf_path(papers[0].paper_id, "downloads").endswith(
+        arxiv.os.path.join("hep-th", "9901001v1.pdf")
+    )
+
+
 @pytest.mark.parametrize("body", [
     b"",
     b"<html><body>Not Acceptable</body></html>",
```

---

### Incident Patch 2: `e69d3a42` (2026-10-02)
**Commit Message**: fix(arxiv): preserve PDF artifacts and report failed reads

**File**: `README.md` (modified, +11/-0)
```diff
@@ -196,6 +196,17 @@ OCR, medical inference or new dependency is added. Labels are heuristic and may
 be uncertain. See [bounded PDF sections](docs/PDF_SECTIONS.md) for access rules,
 CLI usage and parser limitations.
 
+### arXiv PDF downloads and reads
+
+arXiv downloads validate bare modern/legacy paper IDs, serialize and pace requests,
+check HTTP status, stream at most 100 MiB to a same-directory temporary file, and
+check the PDF header and parser before atomically replacing the destination.
+A failed transfer or invalid PDF leaves an existing file unchanged. Downloads
+use 10-second connect and 30-second read timeouts, not a hard total transfer
+or parser runtime limit, and do not automatically retry denied responses.
+`read arxiv` reports invalid/encrypted/image-only PDFs as errors rather than
+successful empty output; it does not perform OCR or delete invalid cached files.
+
 ## Optional Paid Platform Connectors (Phase 3)
 
 IEEE Xplore provides **opt-in metadata search**, disabled until an existing API key is configured.
```

**File**: `paper_search_mcp/academic_platforms/arxiv.py` (modified, +67/-9)
```diff
@@ -3,6 +3,7 @@
 import os
 import re
 import time
+import tempfile
 from datetime import datetime
 from threading import Lock
 from typing import List
@@ -40,6 +41,18 @@ class ArxivSearcher(PaperSource):
         re.IGNORECASE,
     )
     _BOOLEAN_OP_RE = re.compile(r"(?:^|\s)(AND|OR|ANDNOT)(?:\s|$)")
+    _PAPER_ID_RE = re.compile(
+        r"(?:[0-9]{4}\.[0-9]{4,5}|[a-z-]+(?:\.[A-Z]{2})?/[0-9]{7})(?:v[1-9][0-9]*)?"
+    )
+    MAX_PDF_BYTES = 100 * 1024 * 1024
+
+    @classmethod
+    def _pdf_path(cls, paper_id, save_path):
+        if (not isinstance(paper_id, str) or len(paper_id) > 128
+                or not cls._PAPER_ID_RE.fullmatch(paper_id)):
+            raise ValueError("Expected a bare arXiv paper ID, optionally with a version")
+        # Legacy category/number IDs retain their historical subdirectory path.
+        return os.path.join(os.fspath(save_path), *paper_id.split("/")) + ".pdf"
 
     def __init__(self):
         self.session = requests.Session()
@@ -224,12 +237,53 @@ def _paper_from_entry(entry) -> Paper:
         )
 
     def download_pdf(self, paper_id: str, save_path: str) -> str:
+        output_file = self._pdf_path(paper_id, save_path)
         pdf_url = f"https://arxiv.org/pdf/{paper_id}.pdf"
-        response = requests.get(pdf_url)
-        os.makedirs(save_path, exist_ok=True)
-        output_file = f"{save_path}/{paper_id}.pdf"
-        with open(output_file, 'wb') as f:
-            f.write(response.content)
+        temporary_path = ""
+        if not self._request_lock.acquire(timeout=30):
+            raise requests.RequestException("arXiv download timed out waiting for its request slot")
+        try:
+            self._pace_locked()
+            # Connect/read timeouts are not a hard total transfer deadline.
+            # Do not retry access failures or change the caller's identity.
+            with requests.get(pdf_url, stream=True, timeout=(10, 30)) as response:
+                if response.status_code != 200:
+                    raise requests.RequestException(
+                        f"arXiv download failed: HTTP {response.status_code}"
+                    )
+                directory = os.path.dirname(output_file) or "."
+                os.makedirs(directory, exist_ok=True)
+                with tempfile.NamedTemporaryFile(
+                    mode="wb", dir=directory, prefix=".arxiv-", suffix=".part", delete=False
+                ) as temporary:
+                    temporary_path = temporary.name
+                    size = 0
+                    for chunk in response.iter_content(chunk_size=64 * 1024):
+                        if not chunk:
+                            continue
+                        size += len(chunk)
+                        if size > self.MAX_PDF_BYTES:
+                            raise requests.RequestException("arXiv PDF exceeds the 100 MiB limit")
+                        temporary.write(chunk)
+                with open(temporary_path, "rb") as downloaded:
+                    if not re.match(
+                        rb"\s*(?:\xef\xbb\xbf)?\s*%PDF-\d\.\d(?:\s|$)", downloaded.read(1024)
+                    ):
+                        raise requests.RequestException("arXiv response does not contain a PDF header")
+                    downloaded.seek(0)
+                    try:
+                        PdfReader(downloaded)
+                    except Exception as exc:
+                        raise requests.RequestException("arXiv downloaded PDF could not be parsed") from exc
+                os.replace(temporary_path, output_file)
+                temporary_path = ""
+        finally:
+            self._request_lock.release()
+            if temporary_path:
+                try:
+                    os.remove(temporary_path)
+                except OSError:
+                    logger.warning("Could not remove temporary arXiv download")
         return output_file
 
     def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
@@ -243,7 +297,7 @@ def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
             str: The extracted text content of the paper
         """
         # First ensure we have the PDF
-        pdf_path = f"{save_path}/{paper_id}.pdf"
+        pdf_path = self._pdf_path(paper_id, save_path)
         if not os.path.exists(pdf_path):
             pdf_path = self.download_pdf(paper_id, save_path)
         
@@ -254,12 +308,16 @@ def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
             
             # Extract text from each page
             for page in reader.pages:
-                text += page.extract_text() + "\n"
+                text += (page.extract_text() or "") + "\n"
+
+            if not text.strip():
+                raise ValueError("No extractable text; an image-only PDF may require OCR")
             
             return text.strip()
         except Exception as e:
-            logger.error("Error reading PDF for pa
```

**File**: `tests/test_arxiv_406.py` (modified, +135/-0)
```diff
@@ -133,3 +133,138 @@ def test_unified_search_reports_406_as_source_error(paced_searcher):
     assert "HTTP 406" in result["errors"]["arxiv"]
     assert result["source_results"] == {"arxiv": 0}
     assert result["papers"] == []
+
+
+# Artifact integrity regressions use the existing deterministic arXiv test entry.
+import io
+from types import SimpleNamespace
+from unittest.mock import MagicMock, Mock
+
+import pytest
+import requests
+from pypdf import PdfWriter
+
+from paper_search_mcp.academic_platforms import arxiv
+
+
+@pytest.fixture
+def pdf_bytes():
+    output = io.BytesIO()
+    writer = PdfWriter()
+    writer.add_blank_page(width=100, height=100)
+    writer.write(output)
+    return output.getvalue()
+
+
+@pytest.fixture
+def searcher(monkeypatch):
+    monkeypatch.setattr(arxiv.ArxivSearcher, '_pace_locked', Mock())
+    return arxiv.ArxivSearcher()
+
+
+def response(monkeypatch, chunks, status=200):
+    result = MagicMock()
+    result.__enter__.return_value = result
+    result.status_code = status
+    result.iter_content.return_value = iter(chunks)
+    get = Mock(return_value=result)
+    monkeypatch.setattr(arxiv.requests, 'get', get)
+    return get
+
+
+@pytest.mark.parametrize('paper_id', ['2406.17835', '2406.17835v2', 'hep-th/9901001v1'])
+def test_success_is_paced_streamed_and_atomically_saved(searcher, monkeypatch, tmp_path, pdf_bytes, paper_id):
+    get = response(monkeypatch, [pdf_bytes[:11], b'', pdf_bytes[11:]])
+    path = searcher.download_pdf(paper_id, str(tmp_path / 'with spaces'))
+    assert open(path, 'rb').read() == pdf_bytes
+    assert get.call_args.kwargs == {'stream': True, 'timeout': (10, 30)}
+    searcher._pace_locked.assert_called_once_with()
+    assert not list(tmp_path.rglob('*.part'))
+
+
+@pytest.mark.parametrize('status', [403, 404, 429, 500, 503])
+def test_http_failure_preserves_old_file_without_retry(searcher, monkeypatch, tmp_path, status):
+    target = tmp_path / '2406.17835.pdf'
+    target.write_bytes(b'old preserved bytes')
+    get = response(monkeypatch, [b'<html>denied</html>'], status)
+    with pytest.raises(requests.RequestException, match=f'HTTP {status}'):
+        searcher.download_pdf('2406.17835', str(tmp_path))
+    assert target.read_bytes() == b'old preserved bytes'
+    assert get.call_count == 1
+    assert not list(tmp_path.glob('*.part'))
+
+
+@pytest.mark.parametrize('body', [b'', b'<html>denied</html>', b'%PDF-1.7\ntruncated'])
+def test_invalid_body_preserves_old_pdf(searcher, monkeypatch, tmp_path, body, pdf_bytes):
+    target = tmp_path / '2406.17835.pdf'
+    target.write_bytes(pdf_bytes)
+    response(monkeypatch, [body])
+    with pytest.raises(requests.RequestException, match='PDF'):
+        searcher.download_pdf('2406.17835', str(tmp_path))
+    assert target.read_bytes() == pdf_bytes
+    assert not list(tmp_path.glob('*.part'))
+
+
+def test_partial_stream_timeout_cleans_temp_and_preserves_old(searcher, monkeypatch, tmp_path, pdf_bytes):
+    target = tmp_path / '2406.17835.pdf'
+    target.write_bytes(pdf_bytes)
+    def interrupted():
+        yield b'%PDF-1.7\n'
+        raise requests.Timeout('mock read timeout')
+    response(monkeypatch, interrupted())
+    with pytest.raises(requests.Timeout):
+        searcher.download_pdf('2406.17835', str(tmp_path))
+    assert target.read_bytes() == pdf_bytes
+    assert not list(tmp_path.glob('*.part'))
+    assert searcher._request_lock.acquire(blocking=False)
+    searcher._request_lock.release()
+
+
+def test_size_limit_cleans_partial_without_replacing_target(searcher, monkeypatch, tmp_path, pdf_bytes):
+    monkeypatch.setattr(searcher, 'MAX_PDF_BYTES', 10)
+    target = tmp_path / '2406.17835.pdf'
+    target.write_bytes(pdf_bytes)
+    response(monkeypatch, [b'%PDF-1.7\nmore'])
+    with pytest.raises(requests.RequestException, match='limit'):
+        searcher.download_pdf('2406.17835', str(tmp_path))
+    assert target.read_bytes() == pdf_bytes
+    assert not list(tmp_path.glob('*.part'))
+
+
+@pytest.mark.parametrize('paper_id', ['../secret', '/etc/passwd', '2406.17835/../../x', 'x?y=z', '2406.17835.pdf', '2406.17835v0', None])
+def test_invalid_id_rejected_before_network_or_directory(searcher, monkeypatch, tmp_path, paper_id):
+    get = Mock()
+    monkeypatch.setattr(arxiv.requests, 'get', get)
+    for method in (searcher.download_pdf, searcher.read_paper):
+        with pytest.raises(ValueError, match='arXiv paper ID'):
+            method(paper_id, str(tmp_path / 'absent'))
+    get.assert_not_called()
+    assert not (tmp_path / 'absent').exists()
+
+
+def test_replace_failure_keeps_previous_file_and_removes_partial(searcher, monkeypatch, tmp_path, pdf_bytes):
+    target = tmp_path / '2406.17835.pdf'
+    target.write_bytes(b'previous')
+    response(monkeypatch, [pdf_bytes])
+    monkeypatch.setattr(arxiv.os, 'replace', Mock(side_effect=PermissionError('locked')))
+    with pytest.raises(PermissionError):
+        searcher.download_pdf('2406.17835'
```

**File**: `tests/test_cli_diagnostics.py` (modified, +9/-1)
```diff
@@ -213,7 +213,6 @@ def test_download_retry_leaves_one_json_result(
 @pytest.mark.parametrize(
     ("module", "searcher_class"),
     [
-        (arxiv, arxiv.ArxivSearcher),
         (biorxiv, biorxiv.BioRxivSearcher),
         (medrxiv, medrxiv.MedRxivSearcher),
     ],
@@ -233,6 +232,15 @@ def test_read_failure_diagnostic_does_not_become_paper_text(
     assert "Error reading PDF for paper example: bad PDF" in caplog.text
 
 
+def test_arxiv_read_failure_is_a_cli_error(monkeypatch, tmp_path, capsys):
+    (tmp_path / "2406.17835.pdf").write_bytes(b"invalid PDF")
+    monkeypatch.setattr(cli, "SEARCHERS", {"arxiv": arxiv.ArxivSearcher()})
+    assert run_command("read", "arxiv", "2406.17835", "-o", str(tmp_path)) == 1
+    result = json.loads(capsys.readouterr().out)
+    assert result["status"] == "error"
+    assert "could not be read as text" in result["message"]
+
+
 @pytest.mark.parametrize("command", ["search", "download"])
 def test_default_logging_goes_to_stderr_in_cli_process(command, tmp_path):
     # A fresh interpreter verifies default logging without pytest log handlers.
```

---

### Incident Patch 3: `bbf078f6` (2026-10-02)
**Commit Message**: fix(cli): reject unsuccessful PDF download results

Require the returned download path to be a readable regular file with a PDF
header before reporting success. Preserve connector diagnostics as errors,
including missing files and saved HTML error pages, without altering files.

Add deterministic regression coverage for error returns, invalid artifacts,
read errors, relative paths, and portable error-like filenames. Document the
lightweight validation boundary; this does not prove PDF integrity or identity.

**File**: `README.md` (modified, +6/-0)
```diff
@@ -278,6 +278,12 @@ Create `~/.config/paper-search-mcp/.env` for optional API keys (see [Environment
 
 The skill uses a CLI (`paper-search`) that wraps the same library as the MCP server, outputting JSON for search/download and plain text for read.
 
+`paper-search download` reports `status: "ok"` only when the returned path is a
+readable, non-empty regular file with a PDF header. Connector error strings,
+missing files, and saved HTML error pages produce a JSON error and exit code 1.
+This lightweight check does not establish complete PDF integrity or paper identity;
+those checks remain the responsibility of the source connector and the reader.
+
 Choose sources explicitly when latency matters:
 
 ```bash
```

**File**: `paper_search_mcp/cli.py` (modified, +23/-1)
```diff
@@ -6,9 +6,12 @@
 import argparse
 import asyncio
 import json
+import os
+import re
 import sys
 from datetime import date, datetime, timezone
 from decimal import Decimal, InvalidOperation
+from pathlib import Path
 from typing import Any, Dict, List
 
 from .config import get_env
@@ -285,7 +288,26 @@ async def cmd_download(args: argparse.Namespace) -> int:
     searcher = _get_searcher(source)
     try:
         result = await asyncio.to_thread(searcher.download_pdf, args.paper_id, args.save_path)
-        print(json.dumps({"status": "ok", "path": result}))
+        # Some connectors return an explanatory error string instead of
+        # raising. A successful call alone does not prove a file was saved.
+        if not isinstance(result, (str, os.PathLike)):
+            raise RuntimeError("Download did not return a file path")
+        path = Path(result)
+        try:
+            saved = False
+            if path.is_file():
+                with path.open("rb") as downloaded:
+                    # Match the PDF-header policy used by the Semantic
+                    # connector. HTML error pages are not download successes.
+                    saved = bool(re.match(
+                        rb"\s*(?:\xef\xbb\xbf)?\s*%PDF-\d\.\d(?:\s|$)",
+                        downloaded.read(1024),
+                    ))
+        except (OSError, ValueError):
+            saved = False
+        if not saved:
+            raise RuntimeError(f"Download did not produce a readable PDF file: {result}")
+        print(json.dumps({"status": "ok", "path": str(result)}))
         return 0
     except Exception as e:
         print(json.dumps({"status": "error", "message": str(e)}))
```

**File**: `tests/test_cli_diagnostics.py` (modified, +99/-2)
```diff
@@ -14,6 +14,7 @@
 
 from paper_search_mcp import cli, config
 from paper_search_mcp.academic_platforms import arxiv, biorxiv, medrxiv
+from paper_search_mcp.academic_platforms.semantic import SemanticSearcher
 
 
 def run_command(command, *args):
@@ -34,6 +35,102 @@ def test_listing_sources_avoids_constructor_warnings(monkeypatch, capsys, caplog
     assert cli.SEARCHERS == {}
 
 
+def test_download_connector_error_string_is_not_a_success(monkeypatch, tmp_path, capsys):
+    # Exercise the real connector's no-PDF return contract without networking.
+    searcher = SemanticSearcher()
+    monkeypatch.setattr(searcher, "get_paper_details", Mock(return_value=None))
+    monkeypatch.setattr(cli, "SEARCHERS", {"semantic": searcher})
+
+    assert run_command("download", "semantic", "ARXIV:2503.22444v2", "-o", str(tmp_path)) == 1
+
+    output = json.loads(capsys.readouterr().out)
+    assert output["status"] == "error"
+    assert "Could not find PDF URL" in output["message"]
+    assert "path" not in output
+    assert list(tmp_path.iterdir()) == []
+
+
+@pytest.mark.parametrize("result_kind", ["missing", "empty", "directory", "invalid", "none"])
+def test_download_requires_a_saved_file(result_kind, monkeypatch, tmp_path, capsys):
+    path = tmp_path / "paper.pdf"
+    if result_kind == "empty":
+        path.touch()
+    elif result_kind == "directory":
+        path.mkdir()
+    result = {"invalid": "bad\0path", "none": None}.get(result_kind, str(path))
+    searcher = Mock()
+    searcher.download_pdf.return_value = result
+    monkeypatch.setattr(cli, "SEARCHERS", {"arxiv": searcher})
+
+    assert run_command("download", "arxiv", "example", "-o", str(tmp_path)) == 1
+    output = json.loads(capsys.readouterr().out)
+    assert output["status"] == "error"
+    assert "path" not in output
+
+
+def test_download_unreadable_file_is_an_error(monkeypatch, tmp_path, capsys):
+    path = tmp_path / "paper.pdf"
+    path.write_bytes(b"%PDF-1.7\nmock")
+    searcher = Mock()
+    searcher.download_pdf.return_value = str(path)
+    monkeypatch.setattr(cli, "SEARCHERS", {"arxiv": searcher})
+    monkeypatch.setattr(Path, "open", Mock(side_effect=PermissionError("unreadable")))
+
+    assert run_command("download", "arxiv", "example", "-o", str(tmp_path)) == 1
+    output = json.loads(capsys.readouterr().out)
+    assert output["status"] == "error"
+    assert "readable PDF file" in output["message"]
+
+
+@pytest.mark.parametrize("path_object", [False, True])
+def test_download_success_preserves_relative_path(path_object, monkeypatch, tmp_path, capsys):
+    monkeypatch.chdir(tmp_path)
+    path = Path("a directory") / "paper.pdf"
+    path.parent.mkdir()
+    path.write_bytes(b"%PDF-1.7\nmock")
+    searcher = Mock()
+    searcher.download_pdf.return_value = path if path_object else str(path)
+    monkeypatch.setattr(cli, "SEARCHERS", {"arxiv": searcher})
+
+    assert run_command("download", "arxiv", "example", "-o", "a directory") == 0
+    assert json.loads(capsys.readouterr().out) == {"status": "ok", "path": str(path)}
+
+
+@pytest.mark.parametrize("body", [b"<html>Access denied</html>", b"<html>%PDF-1.7\n</html>", b"%PDF-not-a-version"])
+def test_download_rejects_saved_non_pdf_body(body, monkeypatch, tmp_path, capsys):
+    path = tmp_path / "paper.pdf"
+    path.write_bytes(body)
+    searcher = Mock()
+    searcher.download_pdf.return_value = str(path)
+    monkeypatch.setattr(cli, "SEARCHERS", {"arxiv": searcher})
+
+    assert run_command("download", "arxiv", "example", "-o", str(tmp_path)) == 1
+    assert json.loads(capsys.readouterr().out)["status"] == "error"
+    # Checking a returned artifact must not delete or rewrite it.
+    assert path.read_bytes() == body
+
+
+@pytest.mark.parametrize("filename", [
+    "Error downloading PDF example.pdf",
+    pytest.param(
+        "Error downloading PDF: example.pdf",
+        marks=pytest.mark.skipif(
+            sys.platform == "win32", reason="Colon filenames are valid on POSIX, not Windows"
+        ),
+    ),
+])
+def test_download_accepts_real_path_that_looks_like_an_error(filename, monkeypatch, tmp_path, capsys):
+    monkeypatch.chdir(tmp_path)
+    path = Path(filename)
+    path.write_bytes(b" \xef\xbb\xbf\n%PDF-1.7\nmock")
+    searcher = Mock()
+    searcher.download_pdf.return_value = str(path)
+    monkeypatch.setattr(cli, "SEARCHERS", {"arxiv": searcher})
+
+    assert run_command("download", "arxiv", "example", "-o", ".") == 0
+    assert json.loads(capsys.readouterr().out) == {"status": "ok", "path": str(path)}
+
+
 def test_concurrent_search_parse_errors_leave_stdout_untouched(
     monkeypatch, capsys, caplog
 ):
@@ -94,7 +191,7 @@ def test_download_retry_leaves_one_json_result(
     searcher = (
         module.BioRxivSearcher() if source == "biorxiv" else module.MedRxivSearcher()
     )
-    response = Mock(content=b"%PDF-mock")
+    response = Mock(content=b"%PDF-1.7\nmock")
     failure = requests.ConnectionError("offline")
     attemp
```

**File**: `tests/test_cli_sources.py` (modified, +5/-1)
```diff
@@ -2,6 +2,7 @@
 
 import asyncio
 import json
+from pathlib import Path
 from unittest.mock import Mock
 
 import pytest
@@ -104,7 +105,10 @@ def test_get_searcher_only_initializes_requested_source_and_caches(monkeypatch):
     ("download", "download_pdf", "/tmp/example.pdf"),
     ("read", "read_paper", "Paper text"),
 ])
-def test_single_source_commands_are_lazy(command, method, result, monkeypatch, capsys):
+def test_single_source_commands_are_lazy(command, method, result, monkeypatch, capsys, tmp_path):
+    if command == "download":
+        result = str(tmp_path / "example.pdf")
+        Path(result).write_bytes(b"%PDF-1.7\nmock")
     searcher = Mock()
     getattr(searcher, method).return_value = result
     constructor = Mock(return_value=searcher)
```

---

### Incident Patch 4: `eaceccea` (2026-10-02)
**Commit Message**: fix: respect Google Scholar session backoff and deadlines

Honor provider Retry-After instructions, defer over-horizon requests without early retries, share cooldown and pacing across concurrent searches, and surface timeouts as errors. Keep source labels honest and recommend explicit public alternatives without silent substitution or CAPTCHA/identity evasion.

Thanks-to: issue #74 (https://github.com/openags/paper-search-mcp/issues/74).

**File**: `README.md` (modified, +19/-2)
```diff
@@ -167,8 +167,25 @@ and CLI search, while successful sources still return their papers. Direct
 Scholar searches raise `GoogleScholarSearchError` for those failures. A normal
 empty result page still returns an empty list. If a later page fails, the source
 is reported as failed rather than returning its earlier pages as complete.
-Existing tool/deadline timeout behavior is unchanged. These diagnostics do not
-guarantee access to Scholar or a fixed number of queries per session.
+Timeouts also raise a source error rather than implying that no papers exist.
+After exhausted HTTP 403/429/503 retries or a CAPTCHA, the shared Scholar
+connector enters a 60-second cooldown. Consecutive blocked searches extend it
+exponentially up to 15 minutes; a valid upstream `Retry-After` can extend this
+interval. A successful page resets the streak. Calls during cooldown fail
+immediately with a retry interval and do not contact Scholar. Retries honor
+valid `Retry-After` seconds or HTTP dates up to 24 hours. Longer instructions
+pause automatic requests for the lifetime of this connector instead of retrying
+earlier than the provider requested. Delays above 30 seconds are carried across
+calls without sleeping in a worker. Concurrent calls share the same paced session. The connector does not rotate
+identity between requests or solve CAPTCHAs. Cooldown state is process-local,
+not a guarantee of an upstream quota or recovery after that interval.
+
+For a survey, select alternative sources explicitly, for example MCP
+`search_papers(query, sources="google_scholar,openalex,semantic,crossref")` or CLI
+`paper-search search "query" -s google_scholar,openalex,semantic,crossref`.
+Successful providers keep their own source labels and their papers even when
+Scholar is cooling down. Alternatives have their own access/rate limits; they
+are never silently returned as Google Scholar results.
 
 ## Optional Paid Platform Connectors (Phase 3)
 
```

**File**: `paper_search_mcp/academic_platforms/google_scholar.py` (modified, +105/-25)
```diff
@@ -1,5 +1,8 @@
 from typing import List, Optional
-from datetime import datetime
+from datetime import datetime, timezone
+from email.utils import parsedate_to_datetime
+from threading import Lock
+import math
 import requests
 from bs4 import BeautifulSoup
 import time
@@ -23,6 +26,13 @@ class GoogleScholarSearcher(PaperSource):
     
     SCHOLAR_URL = "https://scholar.google.com/scholar"
     CONSENT_COOKIE_VALUE = "YES+"
+    COOLDOWN_SECONDS = 60.0
+    MAX_COOLDOWN_SECONDS = 900.0
+    MAX_RETRY_AFTER_SECONDS = 86400.0
+    FALLBACK_HINT = (
+        "Use search_papers with sources=\"openalex,semantic,crossref\" "
+        "for explicitly labeled alternative sources."
+    )
     BROWSERS = [
         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
         "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
@@ -33,6 +43,10 @@ def __init__(self, max_retries: int = 3, retry_delay: float = 2.0, proxy_url: Op
         self.max_retries = max(1, max_retries)
         self.retry_delay = max(0.5, retry_delay)
         self.proxy_url = (proxy_url or get_env("GOOGLE_SCHOLAR_PROXY_URL", "")).strip()
+        # A shared requests.Session and its backoff state are not thread-safe.
+        self._search_lock = Lock()
+        self._cooldown_until = 0.0
+        self._consecutive_blocks = 0
         self._setup_session()
 
     def _setup_session(self):
@@ -55,8 +69,47 @@ def _setup_session(self):
                 'https': self.proxy_url
             })
 
-    def _rotate_user_agent(self):
-        self.session.headers.update({'User-Agent': random.choice(self.BROWSERS)})
+    @classmethod
+    def _retry_after(cls, response) -> float:
+        """Parse Retry-After delta-seconds or an HTTP date, never response text."""
+        value = (getattr(response, "headers", None) or {}).get("Retry-After", "")
+        if not isinstance(value, str) or not value.strip():
+            return 0.0
+        value = value.strip()
+        try:
+            if value.isascii() and value.isdigit():
+                # Bound untrusted numeric conversion and scheduling state.
+                digits = value.lstrip("0") or "0"
+                delay = float(digits) if len(digits) <= 10 else math.inf
+            else:
+                retry_at = parsedate_to_datetime(value)
+                if retry_at.tzinfo is None:
+                    return 0.0
+                delay = (retry_at - datetime.now(timezone.utc)).total_seconds()
+            # An over-horizon instruction is a deferred state, not permission
+            # to contact Scholar early when our bounded horizon expires.
+            return math.inf if delay > cls.MAX_RETRY_AFTER_SECONDS else max(0.0, delay)
+        except (TypeError, ValueError, OverflowError):
+            return 0.0
+
+    def _begin_cooldown(self, response=None) -> None:
+        self._consecutive_blocks = min(self._consecutive_blocks + 1, 5)
+        delay = min(
+            self.COOLDOWN_SECONDS * (2 ** (self._consecutive_blocks - 1)),
+            self.MAX_COOLDOWN_SECONDS,
+        )
+        if response is not None:
+            delay = max(delay, self._retry_after(response))
+        self._cooldown_until = max(self._cooldown_until, time.monotonic() + delay)
+
+    def _cooldown_hint(self) -> str:
+        if math.isinf(self._cooldown_until):
+            return (
+                "The upstream Retry-After exceeds the supported 24-hour scheduling range; "
+                "automatic requests are paused for this process. " + self.FALLBACK_HINT
+            )
+        remaining = max(0, math.ceil(self._cooldown_until - time.monotonic()))
+        return f"Retry after {remaining} seconds. {self.FALLBACK_HINT}"
 
     @staticmethod
     def _remaining_timeout(deadline: Optional[float], maximum: float) -> Optional[float]:
@@ -166,20 +219,36 @@ def search(
                 persistent consent interstitial prevents a successful search.
                 Already fetched pages are not returned as a complete result.
         """
+        if max_results <= 0 or (timeout_seconds is not None and timeout_seconds <= 0):
+            return []
+        deadline = (
+            time.monotonic() + timeout_seconds if timeout_seconds is not None else None
+        )
+        remaining = self._remaining_timeout(deadline, 30.0)
+        if not self._search_lock.acquire(timeout=remaining if remaining is not None else 0):
+            raise GoogleScholarSearchError(
+                "Google Scholar is busy; search timed out waiting for its session. "
+                + self.FALLBACK_HINT
+            )
+        try:
+            if time.monotonic() < self._cooldown_until:
+                raise GoogleScholarSearchError(
+                    "Google Scholar is cooling down after an upstream access limit. "
+                    + self._cooldown_hint()
+                )
+            return self._search_locked(query, max_results, deadline)
+        finally:
+            self._search_lock.release()
+
+    def _search
```

**File**: `paper_search_mcp/server.py` (modified, +6/-8)
```diff
@@ -27,7 +27,7 @@
 from .academic_platforms.dblp import DBLPSearcher
 from .academic_platforms.doaj import DOAJSearcher
 from .academic_platforms.europepmc import EuropePMCSearcher
-from .academic_platforms.google_scholar import GoogleScholarSearcher
+from .academic_platforms.google_scholar import GoogleScholarSearchError, GoogleScholarSearcher
 from .academic_platforms.hal import HALSearcher
 from .academic_platforms.iacr import IACRSearcher
 from .academic_platforms.medrxiv import MedRxivSearcher
@@ -831,13 +831,11 @@ async def search_google_scholar(query: str, max_results: int = 10) -> List[Dict]
             ),
             timeout_seconds=GOOGLE_SCHOLAR_TOOL_TIMEOUT_SECONDS,
         )
-    except TimeoutError:
-        logger.warning(
-            "Google Scholar search timed out after %.1fs for query=%r; returning no results.",
-            GOOGLE_SCHOLAR_TOOL_TIMEOUT_SECONDS,
-            query,
-        )
-        return []
+    except TimeoutError as exc:
+        raise GoogleScholarSearchError(
+            f"Google Scholar search timed out after {GOOGLE_SCHOLAR_TOOL_TIMEOUT_SECONDS:g}s. "
+            + GoogleScholarSearcher.FALLBACK_HINT
+        ) from exc
     return papers if papers else []
 
 
```

**File**: `tests/test_google_scholar_errors.py` (modified, +187/-2)
```diff
@@ -28,8 +28,8 @@
 CONSENT_HTML = "<html><body>Before you continue to Google Scholar</body></html>"
 
 
-def response(status=200, text=EMPTY_HTML):
-    return SimpleNamespace(status_code=status, text=text)
+def response(status=200, text=EMPTY_HTML, headers=None):
+    return SimpleNamespace(status_code=status, text=text, headers=headers or {})
 
 
 @pytest.fixture
@@ -223,3 +223,188 @@ def test_live_smoke_test_skips_only_expected_upstream_failure():
     smoke.searcher.search.side_effect = AssertionError("Unexpected regression")
     with pytest.raises(AssertionError, match="Unexpected regression"):
         smoke.test_search()
+
+
+@pytest.mark.parametrize("status", [403, 429, 503])
+def test_exhausted_backoff_blocks_following_queries_without_requests(searcher, status):
+    searcher.session.get.return_value = response(status)
+    with pytest.raises(GoogleScholarSearchError, match=f"HTTP {status}"):
+        searcher.search("first")
+    calls = searcher.session.get.call_count
+    sleeps = list(searcher.test_clock.sleeps)
+    with pytest.raises(GoogleScholarSearchError, match="cooling down.*Retry after 60 seconds"):
+        searcher.search("different query")
+    assert searcher.session.get.call_count == calls
+    assert searcher.test_clock.sleeps == sleeps
+
+
+@pytest.mark.parametrize("status", [200, 403, 429, 503])
+def test_captcha_cooldown_never_retries_or_rotates_identity(searcher, status):
+    original_ua = searcher.session.headers["User-Agent"]
+    searcher.session.get.return_value = response(status, text="<input name='captcha'>")
+    with pytest.raises(GoogleScholarSearchError, match="captcha"):
+        searcher.search("first")
+    with pytest.raises(GoogleScholarSearchError, match="cooling down"):
+        searcher.search("second")
+    assert searcher.session.get.call_count == 1
+    assert searcher.session.headers["User-Agent"] == original_ua
+
+
+def test_cooldown_expires_and_success_resets_exponential_streak(searcher):
+    searcher.max_retries = 1
+    searcher.session.get.return_value = response(429)
+    for expected in (60, 120, 240, 480, 900, 900):
+        with pytest.raises(GoogleScholarSearchError, match=f"Retry after {expected} seconds"):
+            searcher.search("blocked")
+        searcher.test_clock.now += expected
+    searcher.session.get.return_value = response(text=RESULT_HTML)
+    assert len(searcher.search("recovered", max_results=1)) == 1
+    assert searcher._consecutive_blocks == 0
+    searcher.session.get.return_value = response(429)
+    with pytest.raises(GoogleScholarSearchError, match="Retry after 60 seconds"):
+        searcher.search("blocked again")
+
+
+def test_retry_after_seconds_paces_retry_without_rotating_identity(searcher):
+    original_ua = searcher.session.headers["User-Agent"]
+    searcher.session.get.side_effect = [response(429, headers={"Retry-After": "7"}), response()]
+    assert searcher.search("retry") == []
+    assert searcher.test_clock.sleeps == [1.0, 7.0, 1.0]
+    assert searcher.session.headers["User-Agent"] == original_ua
+
+
+def test_retry_after_http_date_is_honored(searcher, monkeypatch):
+    from datetime import datetime, timezone
+    from email.utils import format_datetime
+    now = datetime(2026, 10, 2, tzinfo=timezone.utc)
+    class FixedDateTime(datetime):
+        @classmethod
+        def now(cls, tz=None):
+            return now
+    monkeypatch.setattr(google_scholar, "datetime", FixedDateTime)
+    retry_at = datetime(2026, 10, 2, 0, 2, tzinfo=timezone.utc)
+    searcher.max_retries = 1
+    searcher.session.get.return_value = response(503, headers={"Retry-After": format_datetime(retry_at)})
+    with pytest.raises(GoogleScholarSearchError, match="Retry after 120 seconds"):
+        searcher.search("retry")
+
+
+@pytest.mark.parametrize("header,expected", [
+    ("", 0), ("garbage", 0), ("-1", 0), ("nan", 0), ("inf", 0),
+    ("1.5", 0), ("99999999999999999", float("inf")), ("86401", float("inf")),
+    ("Wed, 21 Oct 2015 07:28:00 GMT", 0), (None, 0), (" 7 ", 7),
+])
+def test_retry_after_untrusted_values_are_bounded(header, expected):
+    assert GoogleScholarSearcher._retry_after(response(429, headers={"Retry-After": header})) == expected
+
+
+def test_retry_after_beyond_deadline_carries_over_to_next_search(searcher):
+    searcher.session.get.return_value = response(429, headers={"Retry-After": "120"})
+    with pytest.raises(GoogleScholarSearchError, match="HTTP 429"):
+        searcher.search("first", timeout_seconds=3)
+    assert searcher.test_clock.now == 1  # A long Retry-After fails fast.
+    with pytest.raises(GoogleScholarSearchError, match="cooling down"):
+        searcher.search("second", timeout_seconds=3)
+    assert searcher.session.get.call_count == 1
+
+
+def test_cooldown_survives_network_error_during_retry(searcher):
+    searcher.session.get.side_effect = [response(429), requests.ConnectionError("private")]
+    with pytest.raises(GoogleScholarSearchError, match="request failed"):
```

**File**: `tests/test_search_timeouts.py` (modified, +3/-6)
```diff
@@ -70,7 +70,7 @@ def test_google_scholar_tool_returns_results_before_timeout():
     )
 
 
-def test_google_scholar_tool_returns_empty_list_on_timeout():
+def test_google_scholar_tool_reports_timeout_instead_of_empty_success():
     async def slow_search(*args, **kwargs):
         await asyncio.sleep(0.05)
         return [{"paper_id": "1", "title": "paper"}]
@@ -79,11 +79,8 @@ async def slow_search(*args, **kwargs):
         patch.object(server, "GOOGLE_SCHOLAR_TOOL_TIMEOUT_SECONDS", 0.01),
         patch.object(server, "async_search", AsyncMock(side_effect=slow_search)),
     ):
-        result = asyncio.run(
-            server.search_google_scholar("machine learning", max_results=5)
-        )
-
-    assert result == []
+        with pytest.raises(server.GoogleScholarSearchError, match="timed out after"):
+            asyncio.run(server.search_google_scholar("machine learning", max_results=5))
 
 
 def test_timed_out_blocking_search_keeps_capacity_until_worker_exits():
```

**File**: `tests/test_stabilization_regressions.py` (modified, +0/-1)
```diff
@@ -159,7 +159,6 @@ def test_google_scholar_retries_consent_page_once():
             "get",
             side_effect=[consent_response, result_response],
         ) as session_get,
-        patch.object(searcher, "_rotate_user_agent"),
         patch(
             "paper_search_mcp.academic_platforms.google_scholar.time.sleep"
         ),
```

---

### Incident Patch 5: `c318c0b1` (2026-10-01)
**Commit Message**: fix: avoid cache write-lock contention on concurrent reads

Initialize SQLite schema only for a new cache and recheck ownership after obtaining the initialization write lock. Read cached value and clear-generation from one deferred snapshot; prune expired entries during successful writes. Preserve the existing 100 ms lock cap, credential/netrc bypasses, bounded storage, and clear-vs-inflight semantics.

Add deterministic held-writer and SQL-trace regressions, synchronized initialization coverage, and repeated cold/warm thread and process tests for the PR #143 Python 3.10 CI failure.

**File**: `docs/SEARCH_CACHE.md` (modified, +6/-3)
```diff
@@ -28,7 +28,8 @@ added. Simultaneous misses can still issue separate provider calls.
 
 - MCP `get_search_cache_status()` shows enabled state, configured path/limits,
   stored entry count, and whether the database can be opened. It never lists
-  queries. Expired entries may count until the next lookup prunes them.
+  queries. Expired entries may count until the next successful cache write
+  prunes them.
 - MCP `clear_search_cache()` removes all result rows and reports how many were
   cleared. It works while disabled and does not create a missing database.
   A generation counter prevents already-running searches from repopulating the
@@ -88,8 +89,10 @@ file. If a limit is lowered below an existing file's size, searches bypass that
 cache; clear remains available. To reclaim disk space, stop all server processes
 and remove only the configured cache database after clearing it.
 
-SQLite transactions synchronize threads and processes. Lock waits are capped at
-100 ms; contention can skip caching rather than stall provider work. A corrupt,
+SQLite transactions synchronize threads and processes. Warm lookups use one
+read snapshot; schema creation happens only on initialization, and successful
+writes prune expired entries. Lock waits are capped at 100 ms; contention can
+skip caching rather than stall provider work. A corrupt,
 incompatible, or unrelated existing database is not overwritten or repaired.
 
 ## Verification and provenance
```

**File**: `paper_search_mcp/search_cache.py` (modified, +47/-24)
```diff
@@ -187,30 +187,49 @@ def _connection(self, create=False):
             raise sqlite3.DatabaseError("cache exceeds configured disk limit")
         connection = sqlite3.connect(str(path), timeout=0.1)
         try:
-            connection.execute("BEGIN")
+            # A warm cache must not take a write lock merely to open it. In
+            # particular, rewriting application_id/schema on every operation
+            # adds fsyncs and can starve concurrent lookups of their 100 ms budget.
             app_id = connection.execute("PRAGMA application_id").fetchone()[0]
             if app_id != _APPLICATION_ID:
-                tables = connection.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
-                if app_id or tables:
+                if app_id:
                     raise sqlite3.DatabaseError("path is not a paper-search cache")
                 if not create:
-                    yield None
-                    return
-            connection.commit()
+                    # Check ownership and schema in the same read snapshot.
+                    connection.execute("BEGIN")
+                    app_id = connection.execute("PRAGMA application_id").fetchone()[0]
+                    tables = connection.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
+                    connection.commit()
+                    if app_id != _APPLICATION_ID:
+                        if app_id or tables:
+                            raise sqlite3.DatabaseError("path is not a paper-search cache")
+                        yield None
+                        return
+                else:
+                    # Serialize first initialization across processes, then
+                    # recheck: another initializer may have won while we waited.
+                    connection.execute("BEGIN IMMEDIATE")
+                    app_id = connection.execute("PRAGMA application_id").fetchone()[0]
+                    if app_id != _APPLICATION_ID:
+                        tables = connection.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
+                        if app_id or tables:
+                            raise sqlite3.DatabaseError("path is not a paper-search cache")
+                        connection.execute(f"PRAGMA application_id={_APPLICATION_ID}")
+                        connection.execute("""CREATE TABLE cache_entries (
+                            key TEXT PRIMARY KEY, created REAL NOT NULL, expires REAL NOT NULL,
+                            payload TEXT NOT NULL, size INTEGER NOT NULL)""")
+                        connection.execute("""CREATE TABLE cache_meta (
+                            id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL)""")
+                        connection.execute("INSERT INTO cache_meta VALUES (1, 0)")
+                    connection.commit()
             connection.execute("PRAGMA secure_delete=ON")
             page_size = connection.execute("PRAGMA page_size").fetchone()[0]
             connection.execute(f"PRAGMA max_page_count={self.settings.max_bytes // page_size}")
-            # DELETE mode keeps transient journal storage bounded by the database.
-            connection.execute("PRAGMA journal_mode=DELETE")
-            connection.execute("BEGIN IMMEDIATE")
-            connection.execute(f"PRAGMA application_id={_APPLICATION_ID}")
-            connection.execute("""CREATE TABLE IF NOT EXISTS cache_entries (
-                key TEXT PRIMARY KEY, created REAL NOT NULL, expires REAL NOT NULL,
-                payload TEXT NOT NULL, size INTEGER NOT NULL)""")
-            connection.execute("""CREATE TABLE IF NOT EXISTS cache_meta (
-                id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL)""")
-            connection.execute("INSERT OR IGNORE INTO cache_meta VALUES (1, 0)")
-            connection.commit()
+            # Newly created SQLite files already use DELETE mode. Repeatedly
+            # setting journal_mode can contend with active writers; only verify
+            # it here, and reject externally changed modes rather than growing WAL.
+            if connection.execute("PRAGMA journal_mode").fetchone()[0] != "delete":
+                raise sqlite3.DatabaseError("unsupported search cache journal mode")
             yield connection
         finally:
             connection.close()
@@ -220,13 +239,17 @@ def lookup(self, key):
             return None, None
         try:
             with self._connection(create=True) as con:
-                # One transaction captures value and generation consistently with clear.
-                con.execute("BEGIN IMMEDIATE")
+                # Read value and generation from one snapshot without reserving
+                # a write lock. A concurrent clear still invalidates late puts.
+                # Expired rows are excluded here and pruned by the next put.
+                con.execute("BEGIN")
                 now = time.
```

**File**: `tests/test_search_cache.py` (modified, +140/-0)
```diff
@@ -384,3 +384,143 @@ def test_dynamic_semantic_key_is_not_cached():
 def test_public_builtin_without_credentials_is_cacheable():
     from paper_search_mcp.academic_platforms.openalex import OpenAlexSearcher
     assert search_key(OpenAlexSearcher(api_key="", email=""), "Q", 10, {}) is not None
+
+
+def test_warm_lookup_and_status_read_committed_snapshot_while_writer_is_reserved(cache):
+    """Regression: opening/reading a cache must not compete for a write lock."""
+    write(cache, "key", [{"title": "committed"}])
+    _, generation = cache.lookup("key")
+    with sqlite3.connect(cache.settings.path) as writer:
+        writer.execute("BEGIN IMMEDIATE")
+        writer.execute("UPDATE cache_entries SET payload=? WHERE key=?",
+                       ('[{"title":"uncommitted"}]', "key"))
+        writer.execute("UPDATE cache_meta SET generation=generation+1 WHERE id=1")
+        # SQLite RESERVED locks allow readers. Keep the writer open until these
+        # calls finish: the old implementation deterministically exhausted its
+        # 100 ms timeout here and returned (None, None), even on a cache hit.
+        assert SearchCache(cache.settings).lookup("key") == ([{"title": "committed"}], generation)
+        assert SearchCache(cache.settings).status()["available"] is True
+        writer.rollback()
+    assert cache.lookup("key") == ([{"title": "committed"}], generation)
+
+
+def test_warm_lookup_does_not_reinitialize_schema_or_prune_with_write_locks(cache):
+    write(cache)
+    statements = []
+    original_connect = sqlite3.connect
+
+    def traced_connect(*args, **kwargs):
+        con = original_connect(*args, **kwargs)
+        con.set_trace_callback(statements.append)
+        return con
+
+    with patch("paper_search_mcp.search_cache.sqlite3.connect", traced_connect):
+        assert SearchCache(cache.settings).lookup("key")[0] == [{"title": "key"}]
+        assert SearchCache(cache.settings).status()["available"]
+    prohibited = ("BEGIN IMMEDIATE", "CREATE ", "INSERT ", "UPDATE ", "DELETE ",
+                  "PRAGMA application_id=", "PRAGMA journal_mode=")
+    assert not [sql for sql in statements if sql.startswith(prohibited)]
+
+
+def test_expired_lookup_is_read_only_and_next_write_prunes_shortened_ttl(cache):
+    with patch("paper_search_mcp.search_cache.time.time", return_value=100):
+        write(cache, "expired")
+    shortened = SearchCache(replace(cache.settings, ttl_seconds=10))
+    with patch("paper_search_mcp.search_cache.time.time", return_value=111):
+        with sqlite3.connect(cache.settings.path) as writer:
+            writer.execute("BEGIN IMMEDIATE")
+            assert shortened.lookup("expired") == (None, 0)
+            writer.rollback()
+        assert shortened.status()["entries"] == 1
+        write(shortened, "fresh")
+        assert shortened.status()["entries"] == 1
+        assert shortened.lookup("expired")[0] is None
+        assert shortened.lookup("fresh")[0] == [{"title": "fresh"}]
+
+
+def test_simultaneous_initializers_recheck_ownership_after_obtaining_write_lock(cache):
+    from threading import Barrier, local
+    barrier = Barrier(2)
+    state = local()
+    original_connect = sqlite3.connect
+
+    class SynchronizedConnection(sqlite3.Connection):
+        def execute(self, sql, *args, **kwargs):
+            cursor = super().execute(sql, *args, **kwargs)
+            if sql == "PRAGMA application_id" and not getattr(state, "observed", False):
+                # Force both callers to see the same uninitialized database.
+                value = cursor.fetchone()
+                cursor.close()
+                assert value == (0,)
+                state.observed = True
+                barrier.wait(timeout=5)
+                return SimpleNamespace(fetchone=lambda: value)
+            return cursor
+
+    def connect(*args, **kwargs):
+        return original_connect(*args, **kwargs, factory=SynchronizedConnection)
+
+    with patch("paper_search_mcp.search_cache.sqlite3.connect", connect):
+        with ThreadPoolExecutor(max_workers=2) as pool:
+            results = list(pool.map(lambda _: SearchCache(cache.settings).lookup("missing"), range(2)))
+    assert results == [(None, 0), (None, 0)]
+    write(cache, "subsequent")
+    assert cache.lookup("subsequent")[0] == [{"title": "subsequent"}]
+
+
+@pytest.mark.parametrize("warm", [False, True])
+def test_repeated_simultaneous_thread_initialization_and_writes(tmp_path, warm):
+    from threading import Barrier
+    for iteration in range(10):
+        settings = CacheSettings(enabled=True, path=tmp_path / f"cache-{iteration}.db")
+        if warm:
+            assert SearchCache(settings).lookup("initialize") == (None, 0)
+        barrier = Barrier(5)
+
+        def run(number):
+            barrier.wait(timeout=5)
+            other = SearchCache(settings)
+            for item in range(4):
+                key = f"{number}:{item}"
+                assert other.lookup(key) == (None, 0
```

---

### Incident Patch 6: `d4116060` (2026-10-01)
**Commit Message**: fix(auth): preserve exact issuer identifiers in OAuth metadata

Use public Pydantic 2.12 empty-path preservation without rewriting JWT issuer identities. Retain strict resource/audience binding and reject slash-altered issuer claims. Add regression coverage for valid origin-only issuers and exact metadata serialization.

**File**: `docs/OAUTH_PROTECTED_RESOURCE.md` (modified, +9/-6)
```diff
@@ -46,12 +46,15 @@ configuration comes from the environment.
 | `OAUTH_ALGORITHM` | Optional; defaults to `RS256`; supported values: `RS256`, `RS384`, `RS512`, `PS256`, `PS384`, `PS512`, `ES256`, `ES384`, `ES512` |
 
 URLs must be canonical, without user information, query strings or fragments.
-Origin-only URLs include the trailing slash, for example
-`https://login.example.org/`. This avoids silently changing the issuer string
-between JWT validation and SDK-generated metadata. If an issuer actually uses a
-non-canonical identifier, this version deliberately rejects that configuration;
-do not change the issuer claim yourself to work around it. Use a compatible
-issuer configuration or a separately reviewed adapter.
+Issuer identifiers are preserved exactly, including whether an origin-only URL
+has a trailing slash. For example, `https://accounts.google.com` and
+`https://accounts.google.com/` are distinct issuers. Set `OAUTH_ISSUER` to the exact
+identifier published by your authorization server; never add a slash to make a
+token match. The same exact value is advertised in protected-resource metadata.
+This uses Pydantic 2.12's empty-path preservation, with an explicit dependency
+minimum. Other URL canonicalization rules and exact resource/audience matching
+remain unchanged. A syntactically accepted issuer does not establish that it
+supports the required MCP access-token audience and client-registration flow.
 
 HTTP is accepted only for a loopback **resource URL** during local development.
 Issuer and JWKS URLs always require HTTPS. Neither `none` nor shared-secret HS*
```

**File**: `paper_search_mcp/http_auth.py` (modified, +18/-6)
```diff
@@ -12,6 +12,7 @@
 import re
 import time
 from dataclasses import dataclass
+from typing import Annotated
 from urllib.parse import urlsplit
 
 import httpx
@@ -26,7 +27,7 @@
 )
 from mcp.server.fastmcp import FastMCP
 from mcp.server.transport_security import TransportSecuritySettings
-from pydantic import AnyHttpUrl
+from pydantic import AnyHttpUrl, TypeAdapter, UrlConstraints
 from starlette.applications import Starlette
 from starlette.middleware import Middleware
 from starlette.middleware.authentication import AuthenticationMiddleware
@@ -43,18 +44,27 @@
     "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512",
 })
 _SCOPE = re.compile(r"[\x21\x23-\x5b\x5d-\x7e]+\Z")
+# An issuer is an exact identifier: https://issuer.example and its slash-suffixed
+# variant must not be conflated by URL validation or SDK metadata serialization.
+_ISSUER_URL = TypeAdapter(Annotated[AnyHttpUrl, UrlConstraints(preserve_empty_path=True)])
 
 
 class AuthConfigurationError(ValueError):
     """An unsafe or incomplete HTTP auth configuration; never fall back to open."""
 
 
-def _public_url(value: str, name: str, *, loopback_http: bool = False) -> str:
+def _public_url(
+    value: str, name: str, *, loopback_http: bool = False,
+    preserve_empty_path: bool = False,
+) -> str:
     """Validate operator-supplied URLs without network lookups or normalization."""
     try:
         parsed = urlsplit(value)
         # Do not silently rewrite the audience/resource/issuer identity.
-        if str(AnyHttpUrl(value)) != value:
+        validated = (
+            _ISSUER_URL.validate_python(value) if preserve_empty_path else AnyHttpUrl(value)
+        )
+        if str(validated) != value:
             raise ValueError("URL is not canonical")
         loopback = parsed.hostname == "localhost"
         if parsed.hostname and not loopback:
@@ -76,7 +86,7 @@ def _public_url(value: str, name: str, *, loopback_http: bool = False) -> str:
         suffix = " (HTTP is allowed only for a loopback resource)" if loopback_http else ""
         raise AuthConfigurationError(
             f"{_PREFIX}{name} must be a canonical HTTPS URL without credentials, "
-            f"query or fragment{suffix}; origin-only URLs must end with '/'"
+            f"query or fragment{suffix}"
         ) from exc
     return value
 
@@ -110,7 +120,9 @@ def load_http_auth_config(auth_mode: str | None, endpoint_path: str) -> OAuthCon
         raise AuthConfigurationError(
             "Missing OAuth settings: " + ", ".join(_PREFIX + name for name in missing)
         )
-    issuer = _public_url(configured["OAUTH_ISSUER"], "OAUTH_ISSUER")
+    issuer = _public_url(
+        configured["OAUTH_ISSUER"], "OAUTH_ISSUER", preserve_empty_path=True
+    )
     jwks_uri = _public_url(configured["OAUTH_JWKS_URI"], "OAUTH_JWKS_URI")
     resource_url = _public_url(
         configured["OAUTH_RESOURCE_URL"], "OAUTH_RESOURCE_URL", loopback_http=True
@@ -255,7 +267,7 @@ def create_protected_http_app(server: FastMCP, transport: str, config: OAuthConf
     return Starlette(
         routes=[
             *create_protected_resource_routes(
-                resource_url=resource, authorization_servers=[AnyHttpUrl(config.issuer)],
+                resource_url=resource, authorization_servers=[_ISSUER_URL.validate_python(config.issuer)],
                 scopes_supported=list(config.scopes), resource_name="Paper Search MCP",
             ),
             Mount("/", app=protected),
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ dependencies = [
     "lxml>=4.9.0",
     "httpx[socks]>=0.28.1",
     "joserfc>=1.6,<2",
+    "pydantic>=2.12,<3",
 ]
 
 [project.optional-dependencies]
```

**File**: `tests/test_http_auth.py` (modified, +36/-1)
```diff
@@ -114,7 +114,7 @@ def test_config_default_is_open_and_complete_oauth_is_opt_in(monkeypatch):
     {"AUTH": "oath"}, {"AUTH": "none"}, {"OAUTH_ISSUER": None},
     {"OAUTH_JWKS_URI": ""}, {"OAUTH_AUDIENCE": None}, {"OAUTH_RESOURCE_URL": None},
     {"OAUTH_SCOPES": ""}, {"OAUTH_AUDIENCE": "https://another-api.example/"},
-    {"OAUTH_ISSUER": "http://issuer.example/"}, {"OAUTH_ISSUER": "https://issuer.example"},
+    {"OAUTH_ISSUER": "http://issuer.example/"},
     {"OAUTH_ISSUER": "https://user:password@issuer.example/"},
     {"OAUTH_JWKS_URI": "https://issuer.example/jwks?key=secret"},
     {"OAUTH_JWKS_URI": "https://issuer.example/jwks#fragment"},
@@ -437,3 +437,38 @@ async def run():
             verifier._jwks_cache_time = 0
             assert await verifier.verify_token(credential) is None
     asyncio.run(run())
+
+
+@pytest.mark.parametrize("issuer", [
+    "https://accounts.google.com", "https://accounts.google.com/",
+    "https://issuer.example/tenant", "https://issuer.example/tenant/",
+])
+@pytest.mark.parametrize("transport", ["sse", "streamable-http"])
+def test_issuer_identifier_is_preserved_in_config_metadata_and_token_validation(
+    keys, monkeypatch, issuer, transport,
+):
+    path = "/sse" if transport == "sse" else "/mcp"
+    resource = "https://papers.example" + path
+    configure_env(monkeypatch, OAUTH_ISSUER=issuer, OAUTH_RESOURCE_URL=resource,
+                  OAUTH_AUDIENCE=resource)
+    cfg = load_http_auth_config(None, path)
+    assert cfg.issuer == issuer
+    with app_fixture(keys, monkeypatch, transport, cfg=cfg) as (app, _, _, _):
+        with TestClient(app, base_url="https://papers.example") as client:
+            metadata = client.get("/.well-known/oauth-protected-resource" + path)
+            assert metadata.status_code == 200
+            assert metadata.json()["authorization_servers"] == [issuer]
+            assert metadata.json()["resource"] == resource
+            valid = token(keys, cfg=cfg)
+            altered_issuer = issuer.rstrip("/") if issuer.endswith("/") else issuer + "/"
+            wrong = token(keys, cfg=cfg, changes={"iss": altered_issuer})
+            endpoint = "/messages/?session_id=00000000000000000000000000000000" if transport == "sse" else path
+            request = {"jsonrpc": "2.0", "id": 1, "method": "initialize",
+                       "params": {"protocolVersion": "2025-11-25", "capabilities": {},
+                                  "clientInfo": {"name": "test", "version": "1"}}}
+            for credential, status in [(valid, 404 if transport == "sse" else 200), (wrong, 401)]:
+                response = client.post(endpoint, json=request, headers={
+                    "Authorization": "Bearer " + credential,
+                    "Accept": "application/json, text/event-stream",
+                })
+                assert response.status_code == status, response.text
```

**File**: `uv.lock` (modified, +2/-0)
```diff
@@ -1004,6 +1004,7 @@ dependencies = [
     { name = "joserfc" },
     { name = "lxml" },
     { name = "mcp", extra = ["cli"] },
+    { name = "pydantic" },
     { name = "pypdf" },
     { name = "requests" },
 ]
@@ -1022,6 +1023,7 @@ requires-dist = [
     { name = "joserfc", specifier = ">=1.6,<2" },
     { name = "lxml", specifier = ">=4.9.0" },
     { name = "mcp", extras = ["cli"], specifier = ">=1.27.2,<2" },
+    { name = "pydantic", specifier = ">=2.12,<3" },
     { name = "pypdf" },
     { name = "pytest", marker = "extra == 'dev'", specifier = ">=8.0" },
     { name = "requests" },
```

---

### Incident Patch 7: `70209d74` (2026-10-01)
**Commit Message**: fix(semantic): validate PDF downloads before replacing cache

Reject empty, HTML, and malformed responses before saving Semantic Scholar
PDF downloads. Share validation and atomic replacement with the uncached
read path while preserving existing cached files and public error shapes.

Add deterministic coverage for realistic and encrypted PDFs, misleading
response types, cache reuse, write failures, and long paper identifiers.

Thanks-to: @Fr4nzz for the Semantic Scholar download issue reported in
https://github.com/openags/paper-search-mcp/pull/70

**File**: `.github/workflows/publish.yml` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ jobs:
           tests/test_cli_sort.py
           tests/test_cli_sources.py
           tests/test_semantic_rate_limits.py
+          tests/test_semantic_pdf_validation.py
           tests/test_cli_diagnostics.py
           tests/test_config_env.py
           tests/test_unpaywall.py
```

**File**: `paper_search_mcp/academic_platforms/semantic.py` (modified, +45/-15)
```diff
@@ -1,6 +1,8 @@
 from typing import List, Optional
 from datetime import datetime
+from io import BytesIO
 import os
+import tempfile
 import requests
 from bs4 import BeautifulSoup
 import time
@@ -390,6 +392,47 @@ def search(
 
         return papers[:max_results]
 
+    @staticmethod
+    def _download_pdf_file(pdf_url: str, pdf_path: str) -> None:
+        """Validate response bytes before atomically replacing the destination."""
+        response = requests.get(pdf_url, timeout=30)
+        response.raise_for_status()
+        content = response.content
+        if not content:
+            raise requests.RequestException("Downloaded PDF is empty")
+        # Allow a BOM/leading whitespace, but not HTML containing a PDF marker.
+        # Neither a .pdf URL nor application/pdf MIME type proves the body is PDF.
+        if not re.match(rb"\s*(?:\xef\xbb\xbf)?\s*%PDF-\d\.\d(?:\s|$)", content[:1024]):
+            raise requests.RequestException("Response does not contain a PDF header")
+        try:
+            # A plausible header alone also occurs in truncated/bogus responses.
+            # Parse without requiring text extraction or decrypting valid PDFs.
+            PdfReader(BytesIO(content))
+        except Exception as exc:
+            raise requests.RequestException("Downloaded PDF could not be parsed") from exc
+
+        directory = os.path.dirname(pdf_path)
+        os.makedirs(directory, exist_ok=True)
+        temporary_path = ""
+        try:
+            with tempfile.NamedTemporaryFile(
+                mode="wb",
+                dir=directory,
+                prefix=".semantic-",
+                suffix=".part",
+                delete=False,
+            ) as temporary:
+                temporary_path = temporary.name
+                temporary.write(content)
+            os.replace(temporary_path, pdf_path)
+            temporary_path = ""
+        finally:
+            if temporary_path:
+                try:
+                    os.remove(temporary_path)
+                except OSError:
+                    logger.warning("Could not remove partial PDF: %s", temporary_path)
+
     def download_pdf(self, paper_id: str, save_path: str) -> str:
         """
         Download PDF from Semantic Scholar
@@ -413,18 +456,9 @@ def download_pdf(self, paper_id: str, save_path: str) -> str:
             paper = self.get_paper_details(paper_id)
             if not paper or not paper.pdf_url:
                 return f"Error: Could not find PDF URL for paper {paper_id}"
-            pdf_url = paper.pdf_url
-            pdf_response = requests.get(pdf_url, timeout=30)
-            pdf_response.raise_for_status()
-
-            # Create download directory if it doesn't exist
-            os.makedirs(save_path, exist_ok=True)
-
             filename = f"semantic_{paper_id.replace('/', '_')}.pdf"
             pdf_path = os.path.join(save_path, filename)
-
-            with open(pdf_path, "wb") as f:
-                f.write(pdf_response.content)
+            self._download_pdf_file(paper.pdf_url, pdf_path)
             return pdf_path
         except Exception as e:
             logger.error(f"PDF download error: {e}")
@@ -459,11 +493,7 @@ def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
                 if not paper or not paper.pdf_url:
                     return f"Error: Could not find PDF URL for paper {paper_id}"
 
-                pdf_response = requests.get(paper.pdf_url, timeout=30)
-                pdf_response.raise_for_status()
-
-                with open(pdf_path, "wb") as f:
-                    f.write(pdf_response.content)
+                self._download_pdf_file(paper.pdf_url, pdf_path)
             else:
                 paper = self.get_paper_details(paper_id)
 
```

**File**: `tests/test_semantic.py` (modified, +8/-2)
```diff
@@ -2,9 +2,11 @@
 import os
 import requests
 import tempfile
+from io import BytesIO
 from pathlib import Path
 from types import SimpleNamespace
 from unittest.mock import Mock, patch
+from pypdf import PdfWriter
 from paper_search_mcp.academic_platforms.semantic import SemanticSearcher
 
 
@@ -32,7 +34,11 @@ def setUp(self):
     def test_download_pdf_saves_file_when_pdf_url_available(self):
         paper = SimpleNamespace(pdf_url="https://example.com/paper.pdf")
         response = Mock()
-        response.content = b"%PDF-1.4 test content"
+        stream = BytesIO()
+        writer = PdfWriter()
+        writer.add_blank_page(width=100, height=100)
+        writer.write(stream)
+        response.content = stream.getvalue()
         response.raise_for_status.return_value = None
 
         with tempfile.TemporaryDirectory(prefix="semantic_mock_download_") as test_dir:
@@ -43,7 +49,7 @@ def test_download_pdf_saves_file_when_pdf_url_available(self):
             expected_path = Path(test_dir) / "semantic_paper_123.pdf"
             self.assertEqual(result, str(expected_path))
             self.assertTrue(expected_path.exists())
-            self.assertEqual(expected_path.read_bytes(), b"%PDF-1.4 test content")
+            self.assertEqual(expected_path.read_bytes(), response.content)
 
     def test_parse_paper_handles_missing_publication_date(self):
         item = {
```

**File**: `tests/test_semantic_pdf_validation.py` (added, +305/-0)
```diff
@@ -0,0 +1,305 @@
+"""Offline regressions for Semantic Scholar PDF downloads and cache safety."""
+
+from io import BytesIO
+from pathlib import Path
+from types import SimpleNamespace
+from unittest.mock import Mock
+
+import pytest
+import requests
+from pypdf import PdfReader, PdfWriter
+
+from paper_search_mcp.academic_platforms import semantic
+
+
+@pytest.fixture
+def pdf_bytes():
+    stream = BytesIO()
+    writer = PdfWriter()
+    writer.add_blank_page(width=100, height=100)
+    writer.write(stream)
+    content = stream.getvalue()
+    assert len(PdfReader(BytesIO(content)).pages) == 1
+    return content
+
+
+@pytest.fixture
+def searcher(monkeypatch):
+    instance = semantic.SemanticSearcher()
+    paper = SimpleNamespace(
+        pdf_url="https://example.org/paper.pdf",
+        title="Test paper",
+        authors=["Test Author"],
+        published_date=None,
+        url="https://example.org/paper",
+    )
+    monkeypatch.setattr(instance, "get_paper_details", Mock(return_value=paper))
+    # Every download must opt into a response below, never the real network.
+    monkeypatch.setattr(
+        semantic.requests, "get", Mock(side_effect=AssertionError("Unexpected request"))
+    )
+    return instance
+
+
+def mock_response(monkeypatch, content, content_type="application/pdf", status=200):
+    response = requests.Response()
+    response.status_code = status
+    response.url = "https://example.org/paper.pdf"
+    response._content = content
+    if content_type is not None:
+        response.headers["Content-Type"] = content_type
+    get = Mock(return_value=response)
+    monkeypatch.setattr(semantic.requests, "get", get)
+    return get
+
+
+@pytest.mark.parametrize("method", ["download_pdf", "read_paper"])
+@pytest.mark.parametrize(
+    "content,content_type",
+    [
+        (b"", "application/pdf"),
+        (b" \r\n\t", "application/pdf"),
+        (b"<html>Sign in to download</html>", "text/html"),
+        (b"<html>Sign in to download</html>", "application/pdf"),
+        (b"<!DOCTYPE html><title>Login</title>", None),
+        (b"<html><code>%PDF-1.7</code></html>", "application/pdf"),
+        (b'{"error": "access denied"}', "application/pdf"),
+        (b"%PDF-", "application/pdf"),
+        (b"%PDF-not-a-version\n", "application/pdf"),
+        (b"%PDF-1.7HTML", "application/pdf"),
+        (b" " * 1024 + b"%PDF-1.7\n", "application/pdf"),
+    ],
+)
+def test_invalid_response_is_not_saved(
+    searcher, monkeypatch, tmp_path, method, content, content_type
+):
+    get = mock_response(monkeypatch, content, content_type)
+    reader = Mock(side_effect=AssertionError("Invalid bytes must not reach PdfReader"))
+    monkeypatch.setattr(semantic, "PdfReader", reader)
+
+    result = getattr(searcher, method)("paper/123", str(tmp_path))
+
+    assert result.startswith("Error downloading PDF:")
+    assert "PDF" in result
+    assert list(tmp_path.iterdir()) == []
+    get.assert_called_once_with("https://example.org/paper.pdf", timeout=30)
+    reader.assert_not_called()
+
+
+@pytest.mark.parametrize("content_type", ["application/pdf", "text/html", None])
+@pytest.mark.parametrize("prefix", [b"", b"\r\n \t", b"\xef\xbb\xbf", b"\xef\xbb\xbf\r\n"])
+@pytest.mark.parametrize("version", [b"1.4", b"1.7", b"2.0"])
+def test_pdf_bytes_are_saved_regardless_of_url_or_mime(
+    searcher, monkeypatch, tmp_path, pdf_bytes, content_type, prefix, version
+):
+    # A header signature, not a .pdf suffix or MIME assertion, establishes type.
+    searcher.get_paper_details.return_value.pdf_url = "https://example.org/download?id=123"
+    content = prefix + pdf_bytes.replace(b"%PDF-1.3", b"%PDF-" + version, 1)
+    get = mock_response(monkeypatch, content, content_type)
+    save_path = tmp_path / "new" / "downloads"
+
+    result = searcher.download_pdf("paper/123", str(save_path))
+
+    expected = save_path / "semantic_paper_123.pdf"
+    assert result == str(expected)
+    assert expected.read_bytes() == content
+    assert list(save_path.iterdir()) == [expected]
+    get.assert_called_once_with("https://example.org/download?id=123", timeout=30)
+
+
+def test_read_paper_downloads_valid_pdf_and_keeps_existing_result_format(
+    searcher, monkeypatch, tmp_path, pdf_bytes
+):
+    mock_response(monkeypatch, pdf_bytes)
+
+    result = searcher.read_paper("paper/123", str(tmp_path))
+
+    expected = tmp_path / "semantic_paper_123.pdf"
+    assert expected.read_bytes() == pdf_bytes
+    assert result == f"PDF downloaded to {expected}, but unable to extract readable text"
+
+
+def test_read_paper_reuses_cached_file_and_metadata_format(
+    searcher, monkeypatch, tmp_path, pdf_bytes
+):
+    cached = tmp_path / "semantic_paper_123.pdf"
+    cached.write_bytes(pdf_bytes)
+    reader = Mock(return_value=SimpleNamespace(pages=[Mock(extract_text=lambda: "Paper text")]))
+    monkeypatch.setattr(semantic, "PdfReader", reader)
+
+    result = searcher.read_paper("paper/123", str(tmp_path))
+
+    s
```

---

### Incident Patch 8: `d133e8ec` (2026-09-30)
**Commit Message**: fix(scholar): surface upstream failures instead of empty results

Expose HTTP/network failures, CAPTCHA, and persistent consent pages via the existing CLI and MCP source-error contract. Keep genuine empty pages successful, retain bounded request pacing, and add deterministic HTTP, CAPTCHA, consent, network, deadline, and aggregation regressions.

Refs: https://github.com/openags/paper-search-mcp/issues/74

Thanks-to: @simplecaryu for the failure report in #74. No third-party PR code or tests were incorporated.

**File**: `.github/workflows/publish.yml` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ jobs:
           tests/test_unpaywall_source.py
           tests/test_tool_schema_compat.py
           tests/test_search_timeouts.py
+          tests/test_google_scholar_errors.py
           tests/test_arxiv_406.py
           tests/test_arxiv.py::TestArxivRateLimiting
           tests/test_biorxiv_search_modes.py
```

**File**: `README.md` (modified, +11/-3)
```diff
@@ -95,7 +95,7 @@ This matrix reflects **verified live-integration results** from functional and e
 | PubMed | ✅ | ❌ | ⚠️ info-only | Open API; reliable |
 | bioRxiv | ✅ | ✅ | ✅ | Open API; reliable |
 | medRxiv | ✅ | ✅ | ✅ | Open API; reliable |
-| Google Scholar | ⚠️ | ❌ | ❌ | Bot-detection active; set `PAPER_SEARCH_MCP_GOOGLE_SCHOLAR_PROXY_URL` |
+| Google Scholar | ⚠️ | ❌ | ❌ | Upstream bot-detection/rate limits can prevent search; reported as source errors |
 | IACR | ✅ | ✅ | ✅ | Open API; reliable |
 | Semantic Scholar | ✅ | ✅ (OA) | ✅ (OA) | Works without key (rate-limited); key improves limits; key rejection (403) retried automatically without key |
 | Crossref | ✅ | ❌ | ⚠️ info-only | Open API; reliable |
@@ -131,7 +131,7 @@ All keys are **optional** unless noted. Configure them in `~/.config/paper-searc
 | `PAPER_SEARCH_MCP_SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar | Optional | Free at [semanticscholar.org](https://www.semanticscholar.org/product/api) — improves rate limits |
 | `PAPER_SEARCH_MCP_OPENALEX_API_KEY` | OpenAlex | Optional | Free at [openalex.org/settings/api](https://openalex.org/settings/api); increases the keyless daily budget 10x |
 | `PAPER_SEARCH_MCP_OPENALEX_EMAIL` | OpenAlex | Optional | Contact email used in the OpenAlex `User-Agent` |
-| `PAPER_SEARCH_MCP_GOOGLE_SCHOLAR_PROXY_URL` | Google Scholar | Optional | Your HTTP/HTTPS proxy URL — bypasses bot-detection |
+| `PAPER_SEARCH_MCP_GOOGLE_SCHOLAR_PROXY_URL` | Google Scholar | Optional | Your HTTP/HTTPS proxy URL; does not guarantee access or remove provider limits |
 | `PAPER_SEARCH_MCP_DOAJ_API_KEY` | DOAJ | Optional | Free at [doaj.org](https://doaj.org/apply-for-api-key/) — raises hourly rate limit |
 | `PAPER_SEARCH_MCP_ZENODO_ACCESS_TOKEN` | Zenodo | Optional | Free at [zenodo.org](https://zenodo.org/account/settings/applications/) — required for private records |
 | `PAPER_SEARCH_MCP_IEEE_API_KEY` | IEEE Xplore | **Required to activate** | Free at [developer.ieee.org](https://developer.ieee.org/) |
@@ -146,7 +146,7 @@ Some search failures are caused by external provider instability, not by bugs in
 
 | Source | Symptom | Cause | Workaround |
 |---|---|---|---|
-| Google Scholar | Returns 0 results / empty HTML | Bot-detection (CAPTCHA) | Set `PAPER_SEARCH_MCP_GOOGLE_SCHOLAR_PROXY_URL` to a proxy |
+| Google Scholar | Source error for HTTP/network failures, CAPTCHA, or persistent consent pages | Upstream rate limits, access checks, or connectivity | Reduce request frequency or use another public source; CAPTCHA is not solved automatically |
 | Semantic Scholar | 429 rate-limited responses | Anonymous access rate limit | Set `PAPER_SEARCH_MCP_SEMANTIC_SCHOLAR_API_KEY`; if key is rejected (403) connector automatically retries without key |
 | OpenAlex | 403/429 or daily quota errors | Anonymous access daily limit | Set `PAPER_SEARCH_MCP_OPENALEX_API_KEY` |
 | CORE | 500 / timeout errors | Unauthenticated rate limiting | Set `PAPER_SEARCH_MCP_CORE_API_KEY` (free); connector retries with exponential backoff and falls back to key-less on 401/403 |
@@ -157,6 +157,14 @@ Some search failures are caused by external provider instability, not by bugs in
 | PMC / Europe PMC | PDF download ProxyError | Local proxy blocking direct HTTPS PDF download | Disable proxy or use `download_with_fallback` instead |
 | Unpaywall | Skipped entirely | `UNPAYWALL_EMAIL` env var not set | Set `PAPER_SEARCH_MCP_UNPAYWALL_EMAIL` in `~/.config/paper-search-mcp/.env` |
 
+Google Scholar failures are exposed in `errors.google_scholar` by unified MCP
+and CLI search, while successful sources still return their papers. Direct
+Scholar searches raise `GoogleScholarSearchError` for those failures. A normal
+empty result page still returns an empty list. If a later page fails, the source
+is reported as failed rather than returning its earlier pages as complete.
+Existing tool/deadline timeout behavior is unchanged. These diagnostics do not
+guarantee access to Scholar or a fixed number of queries per session.
+
 ## Optional Paid Platform Connectors (Phase 3)
 
 IEEE Xplore is an **opt-in skeleton**, disabled until its API key is configured.
```

**File**: `paper_search_mcp/academic_platforms/google_scholar.py` (modified, +34/-9)
```diff
@@ -13,6 +13,11 @@
 
 logger = logging.getLogger(__name__)
 
+
+class GoogleScholarSearchError(RuntimeError):
+    """An upstream failure must not be mistaken for a successful empty search."""
+
+
 class GoogleScholarSearcher(PaperSource):
     """Custom implementation of Google Scholar paper search"""
     
@@ -155,6 +160,11 @@ def search(
     ) -> List[Paper]:
         """
         Search Google Scholar with custom parameters
+
+        Raises:
+            GoogleScholarSearchError: HTTP/network failure, CAPTCHA, or a
+                persistent consent interstitial prevents a successful search.
+                Already fetched pages are not returned as a complete result.
         """
         papers = []
         start = 0
@@ -199,6 +209,8 @@ def search(
                         break
 
                     if response.status_code in (403, 429, 503):
+                        if attempt == self.max_retries - 1:
+                            break
                         wait_time = self.retry_delay * (2 ** attempt)
                         wait_time += random.uniform(0, 0.5)
                         logger.warning(
@@ -215,12 +227,19 @@ def search(
                     logger.error("Search failed with non-retryable status %s", response.status_code)
                     break
 
+                # Check a known upstream failure before the deadline: running
+                # out of time during backoff must not turn a 429 into success.
+                if response is not None and response.status_code != 200:
+                    raise GoogleScholarSearchError(
+                        f"Google Scholar search failed: HTTP {response.status_code}; "
+                        "reduce request frequency or use another source."
+                    )
+
                 if deadline is not None and time.monotonic() >= deadline:
                     logger.warning("Google Scholar search deadline reached")
                     break
 
-                if response is None or response.status_code != 200:
-                    logger.error("Google Scholar search aborted after retries")
+                if response is None:
                     break
 
                 # Parse results
@@ -239,18 +258,16 @@ def search(
                             "Google Scholar consent page detected; retrying search"
                         )
                         continue
-                    logger.warning(
-                        "Google Scholar returned a consent page after retry"
+                    raise GoogleScholarSearchError(
+                        "Google Scholar returned a consent page after retry; "
+                        "use another source until Scholar is accessible."
                     )
-                    break
 
                 if self._is_captcha_page(soup, page_text):
-                    logger.warning(
+                    raise GoogleScholarSearchError(
                         "Google Scholar returned a bot-detection/captcha page. "
-                        "Set PAPER_SEARCH_MCP_GOOGLE_SCHOLAR_PROXY_URL/GOOGLE_SCHOLAR_PROXY_URL "
-                        "or reduce request frequency."
+                        "Reduce request frequency or use another source."
                     )
-                    break
 
                 results = soup.find_all('div', class_='gs_ri')
 
@@ -268,6 +285,14 @@ def search(
 
                 start += results_per_page
 
+            except GoogleScholarSearchError:
+                raise
+            except requests.RequestException as e:
+                # Do not include request/proxy URLs or response bodies in the
+                # error presented to MCP clients and CLI consumers.
+                raise GoogleScholarSearchError(
+                    "Google Scholar request failed; check connectivity or use another source."
+                ) from e
             except Exception as e:
                 logger.error(f"Search error: {e}")
                 break
```

**File**: `tests/test_google_scholar.py` (modified, +9/-3)
```diff
@@ -1,7 +1,10 @@
 import unittest
 import os
 import requests
-from paper_search_mcp.academic_platforms.google_scholar import GoogleScholarSearcher
+from paper_search_mcp.academic_platforms.google_scholar import (
+    GoogleScholarSearchError,
+    GoogleScholarSearcher,
+)
 
 def check_scholar_accessible():
     """检查 Google Scholar 是否可访问"""
@@ -25,7 +28,10 @@ def test_search(self):
         if not self.scholar_accessible:
             self.skipTest("Google Scholar is not accessible")
             
-        papers = self.searcher.search("machine learning", max_results=5)
+        try:
+            papers = self.searcher.search("machine learning", max_results=5)
+        except GoogleScholarSearchError as exc:
+            self.skipTest(f"Google Scholar is unavailable: {exc}")
         print(f"\nFound {len(papers)} papers for query 'machine learning':")
         if len(papers) == 0:
             self.skipTest("Google Scholar returned 0 results (likely bot-detection/rate-limit)")
@@ -56,4 +62,4 @@ def test_retry_configuration(self):
         self.assertEqual(retry_searcher.retry_delay, 3.0)
 
 if __name__ == '__main__':
-    unittest.main()
\ No newline at end of file
+    unittest.main()
```

**File**: `tests/test_google_scholar_errors.py` (added, +226/-0)
```diff
@@ -0,0 +1,226 @@
+"""Offline source-error regressions for Google Scholar issue #74."""
+
+import asyncio
+import json
+import unittest
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, Mock
+
+import pytest
+import requests
+
+from paper_search_mcp import cli, server
+from paper_search_mcp.academic_platforms import google_scholar
+from paper_search_mcp.academic_platforms.google_scholar import (
+    GoogleScholarSearchError,
+    GoogleScholarSearcher,
+)
+
+
+RESULT_HTML = """
+<html><body><div class="gs_ri">
+  <h3 class="gs_rt"><a href="https://example.test/paper">Test Paper</a></h3>
+  <div class="gs_a">Ada Lovelace - Journal, 2024</div>
+  <div class="gs_rs">Abstract</div>
+</div></body></html>
+"""
+EMPTY_HTML = "<html><body>Your search did not match any articles.</body></html>"
+CONSENT_HTML = "<html><body>Before you continue to Google Scholar</body></html>"
+
+
+def response(status=200, text=EMPTY_HTML):
+    return SimpleNamespace(status_code=status, text=text)
+
+
+@pytest.fixture
+def searcher(monkeypatch):
+    # Advance a simulated clock: all pacing/backoff/deadline tests stay offline
+    # and do not rely on wall-clock sleeps or patch another thread's clock.
+    clock = SimpleNamespace(now=0.0, sleeps=[])
+
+    def sleep(delay):
+        clock.sleeps.append(delay)
+        clock.now += delay
+
+    monkeypatch.setattr(
+        google_scholar, "time",
+        SimpleNamespace(monotonic=lambda: clock.now, sleep=sleep),
+    )
+    monkeypatch.setattr(google_scholar.random, "uniform", lambda low, high: low)
+    searcher = GoogleScholarSearcher()
+    searcher.session.get = Mock(return_value=response())
+    searcher.test_clock = clock
+    return searcher
+
+
+@pytest.mark.parametrize("status", [403, 429, 503])
+def test_retry_exhaustion_raises_source_error(searcher, status):
+    searcher.session.get.return_value = response(status)
+
+    with pytest.raises(GoogleScholarSearchError, match=f"HTTP {status}"):
+        searcher.search("test")
+
+    assert searcher.session.get.call_count == searcher.max_retries
+    # Pacing before each attempt; backoff only when another retry remains.
+    assert searcher.test_clock.sleeps == [1.0, 2.0, 1.0, 4.0, 1.0]
+
+
+@pytest.mark.parametrize("status", [400, 404, 500, 502])
+def test_nonretryable_http_error_fails_without_extra_requests(searcher, status):
+    searcher.session.get.return_value = response(status)
+
+    with pytest.raises(GoogleScholarSearchError, match=f"HTTP {status}"):
+        searcher.search("test")
+
+    assert searcher.session.get.call_count == 1
+
+
+@pytest.mark.parametrize("text,expected", [(EMPTY_HTML, []), (RESULT_HTML, ["Test Paper"])])
+def test_retry_can_recover_to_genuine_empty_or_nonempty_results(searcher, text, expected):
+    searcher.session.get.side_effect = [response(429), response(text=text)]
+
+    papers = searcher.search("test", max_results=1)
+
+    assert [paper.title for paper in papers] == expected
+    assert searcher.session.get.call_count == 2
+
+
+def test_genuine_empty_result_is_still_successful(searcher):
+    assert searcher.search("no such paper") == []
+    assert searcher.session.get.call_count == 1
+
+
+@pytest.mark.parametrize("text", [
+    '<form id="gs_captcha_f"></form>',
+    '<form><input name="captcha"></form>',
+    "Please show you're not a robot",
+    "Unusual traffic from your computer network",
+])
+def test_captcha_is_reported_without_retry_or_solving(searcher, text):
+    searcher.session.get.return_value = response(text=text)
+
+    with pytest.raises(GoogleScholarSearchError, match="bot-detection/captcha"):
+        searcher.search("test")
+
+    assert searcher.session.get.call_count == 1
+
+
+def test_persistent_consent_is_reported_after_one_retry(searcher):
+    searcher.session.get.return_value = response(text=CONSENT_HTML)
+
+    with pytest.raises(GoogleScholarSearchError, match="consent page after retry"):
+        searcher.search("test")
+
+    assert searcher.session.get.call_count == 2
+
+
+def test_consent_retry_can_recover(searcher):
+    searcher.session.get.side_effect = [response(text=CONSENT_HTML), response(text=RESULT_HTML)]
+    assert [p.title for p in searcher.search("test", max_results=1)] == ["Test Paper"]
+    assert searcher.session.get.call_count == 2
+
+
+@pytest.mark.parametrize("error", [requests.Timeout, requests.ConnectionError, requests.exceptions.ProxyError])
+def test_network_failure_is_observable_without_exposing_request_details(searcher, error):
+    searcher.session.get.side_effect = error("https://user:secret@proxy.example")
+
+    with pytest.raises(GoogleScholarSearchError, match="request failed") as caught:
+        searcher.search("test")
+
+    assert "secret" not in str(caught.value)
+    assert searcher.session.get.call_count == 1
+
+
+def test_network_failure_after_429_is_not_false_empty_success(searcher):
+    searcher.session.get.side_effect = [response(429), requests.ConnectionError("offline")]
+
+    with pyt
```

---

### Incident Patch 9: `307d11b7` (2026-09-30)
**Commit Message**: fix: keep library diagnostics out of CLI stdout

Route arXiv, bioRxiv and medRxiv diagnostics through module logging. Preserve payload output, concurrent searches, and arXiv 406 handling.

Refs #67. Validated with 109 deterministic tests and 5 subtests.

**File**: `.github/workflows/publish.yml` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@ jobs:
           python -m pytest
           tests/test_package_entrypoints.py
           tests/test_cli_sort.py
+          tests/test_cli_diagnostics.py
           tests/test_config_env.py
           tests/test_unpaywall.py
           tests/test_unpaywall_source.py
```

**File**: `paper_search_mcp/academic_platforms/arxiv.py` (modified, +6/-2)
```diff
@@ -1,4 +1,5 @@
 # paper_search_mcp/sources/arxiv.py
+import logging
 import os
 import re
 import time
@@ -16,6 +17,9 @@
 from .base import PaperSource
 
 
+logger = logging.getLogger(__name__)
+
+
 class ArxivSearcher(PaperSource):
     """Searcher for arXiv papers.
 
@@ -188,7 +192,7 @@ def search(self, query: str, max_results: int = 10, sort_by: str = 'relevance',
             try:
                 papers.append(self._paper_from_entry(entry))
             except Exception as e:
-                print(f"Error parsing arXiv entry: {e}")
+                logger.warning("Error parsing arXiv entry: %s", e)
         return papers
 
     @staticmethod
@@ -254,7 +258,7 @@ def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
             
             return text.strip()
         except Exception as e:
-            print(f"Error reading PDF for paper {paper_id}: {e}")
+            logger.error("Error reading PDF for paper %s: %s", paper_id, e)
             return ""
 
 if __name__ == "__main__":
```

**File**: `paper_search_mcp/academic_platforms/biorxiv.py` (modified, +2/-2)
```diff
@@ -198,7 +198,7 @@ def download_pdf(self, paper_id: str, save_path: str) -> str:
                     raise Exception(
                         f"Failed to download PDF after {self.max_retries} attempts: {e}"
                     )
-                print(f"Attempt {tries} failed, retrying...")
+                logger.warning("Attempt %s failed, retrying...", tries)
 
     def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
         """
@@ -222,5 +222,5 @@ def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
                 text += page.extract_text() + "\n"
             return text.strip()
         except Exception as e:
-            print(f"Error reading PDF for paper {paper_id}: {e}")
+            logger.error("Error reading PDF for paper %s: %s", paper_id, e)
             return ""
```

**File**: `paper_search_mcp/academic_platforms/medrxiv.py` (modified, +9/-5)
```diff
@@ -1,3 +1,4 @@
+import logging
 from typing import List
 import requests
 import os
@@ -6,6 +7,9 @@
 from .base import PaperSource
 from pypdf import PdfReader
 
+logger = logging.getLogger(__name__)
+
+
 class MedRxivSearcher(PaperSource):
     """Searcher for medRxiv papers"""
     BASE_URL = "https://api.biorxiv.org/details/medrxiv"
@@ -67,17 +71,17 @@ def search(self, query: str, max_results: int = 10, days: int = 30) -> List[Pape
                                 doi=item['doi']
                             ))
                         except Exception as e:
-                            print(f"Error parsing medRxiv entry: {e}")
+                            logger.warning("Error parsing medRxiv entry: %s", e)
                     if len(collection) < 100:
                         break  # No more results
                     cursor += 100
                     break  # Exit retry loop on success
                 except requests.exceptions.RequestException as e:
                     tries += 1
                     if tries == self.max_retries:
-                        print(f"Failed to connect to medRxiv API after {self.max_retries} attempts: {e}")
+                        logger.error("Failed to connect to medRxiv API after %s attempts: %s", self.max_retries, e)
                         break
-                    print(f"Attempt {tries} failed, retrying...")
+                    logger.warning("Attempt %s failed, retrying...", tries)
             else:
                 continue
             break
@@ -117,7 +121,7 @@ def download_pdf(self, paper_id: str, save_path: str) -> str:
                 tries += 1
                 if tries == self.max_retries:
                     raise Exception(f"Failed to download PDF after {self.max_retries} attempts: {e}")
-                print(f"Attempt {tries} failed, retrying...")
+                logger.warning("Attempt %s failed, retrying...", tries)
     
     def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
         """
@@ -141,5 +145,5 @@ def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
                 text += page.extract_text() + "\n"
             return text.strip()
         except Exception as e:
-            print(f"Error reading PDF for paper {paper_id}: {e}")
+            logger.error("Error reading PDF for paper %s: %s", paper_id, e)
             return ""
\ No newline at end of file
```

**File**: `tests/test_cli_diagnostics.py` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+"""Library diagnostics must leave CLI stdout available for the result payload."""
+
+import asyncio
+import json
+import sys
+import subprocess
+from pathlib import Path
+from threading import Barrier
+from types import SimpleNamespace
+from unittest.mock import Mock
+
+import pytest
+import requests
+
+from paper_search_mcp import cli, config
+from paper_search_mcp.academic_platforms import arxiv, biorxiv, medrxiv
+
+
+def run_command(command, *args):
+    namespace = cli.build_parser().parse_args([command, *args])
+    return asyncio.run(getattr(cli, f"cmd_{command}")(namespace))
+
+
+def test_constructor_warnings_leave_sources_json_clean(monkeypatch, capsys, caplog):
+    monkeypatch.setattr(cli, "SEARCHERS", {})
+    monkeypatch.delenv("CORE_API_KEY", raising=False)
+    monkeypatch.delenv("PAPER_SEARCH_MCP_CORE_API_KEY", raising=False)
+    monkeypatch.setattr(config, "_ENV_LOADED", True)
+
+    assert run_command("sources") == 0
+
+    assert "core" in json.loads(capsys.readouterr().out)["sources"]
+    assert "No CORE API key provided" in caplog.text
+
+
+def test_concurrent_search_parse_errors_leave_stdout_untouched(
+    monkeypatch, capsys, caplog
+):
+    arxiv_searcher = arxiv.ArxivSearcher()
+    medrxiv_searcher = medrxiv.MedRxivSearcher()
+    monkeypatch.setattr(
+        cli, "SEARCHERS", {"arxiv": arxiv_searcher, "medrxiv": medrxiv_searcher}
+    )
+    # Both actual search methods must overlap. Checking stdout inside both
+    # workers catches process-global redirection around asyncio.to_thread.
+    rendezvous = Barrier(2, timeout=5)
+    original_stdout = sys.stdout
+
+    def response_for(*args, **kwargs):
+        assert sys.stdout is original_stdout
+        rendezvous.wait()
+        assert sys.stdout is original_stdout
+        response = Mock(status_code=200, content=b"mock feed")
+        response.json.return_value = {"collection": [{}]}
+        return response
+
+    monkeypatch.setattr(arxiv_searcher, "_request_with_retries", response_for)
+    monkeypatch.setattr(medrxiv_searcher.session, "get", response_for)
+    monkeypatch.setattr(
+        arxiv.feedparser, "parse", lambda _: SimpleNamespace(entries=[SimpleNamespace()])
+    )
+
+    assert run_command("search", "biology", "-s", "arxiv,medrxiv") == 0
+
+    result = json.loads(capsys.readouterr().out)
+    assert result["source_results"] == {"arxiv": 0, "medrxiv": 0}
+    assert result["errors"] == {}
+    assert "Error parsing arXiv entry" in caplog.text
+    assert "Error parsing medRxiv entry" in caplog.text
+    assert sys.stdout is original_stdout
+
+
+def test_search_retry_and_terminal_error_leave_json_clean(monkeypatch, capsys, caplog):
+    searcher = medrxiv.MedRxivSearcher()
+    monkeypatch.setattr(cli, "SEARCHERS", {"medrxiv": searcher})
+    monkeypatch.setattr(
+        searcher.session, "get", Mock(side_effect=requests.ConnectionError("offline"))
+    )
+
+    assert run_command("search", "biology", "-s", "medrxiv") == 0
+
+    assert json.loads(capsys.readouterr().out)["total"] == 0
+    assert "Attempt 1 failed, retrying..." in caplog.text
+    assert "Failed to connect to medRxiv API after 3 attempts: offline" in caplog.text
+
+
+@pytest.mark.parametrize("module", [biorxiv, medrxiv])
+@pytest.mark.parametrize("succeeds", [True, False])
+def test_download_retry_leaves_one_json_result(
+    module, succeeds, monkeypatch, tmp_path, capsys, caplog
+):
+    source = module.__name__.rsplit(".", 1)[-1]
+    searcher = (
+        module.BioRxivSearcher() if source == "biorxiv" else module.MedRxivSearcher()
+    )
+    response = Mock(content=b"%PDF-mock")
+    failure = requests.ConnectionError("offline")
+    attempts = [failure, response] if succeeds else [failure] * searcher.max_retries
+    monkeypatch.setattr(searcher.session, "get", Mock(side_effect=attempts))
+    monkeypatch.setattr(cli, "SEARCHERS", {source: searcher})
+
+    assert run_command("download", source, "10.1101/example", "-o", str(tmp_path)) == (
+        0 if succeeds else 1
+    )
+
+    result = json.loads(capsys.readouterr().out)
+    assert result["status"] == ("ok" if succeeds else "error")
+    assert "Attempt 1 failed, retrying..." in caplog.text
+    if succeeds:
+        assert (tmp_path / "10.1101_example.pdf").read_bytes() == b"%PDF-mock"
+    else:
+        assert "Failed to download PDF after 3 attempts" in result["message"]
+
+
+@pytest.mark.parametrize(
+    ("module", "searcher_class"),
+    [
+        (arxiv, arxiv.ArxivSearcher),
+        (biorxiv, biorxiv.BioRxivSearcher),
+        (medrxiv, medrxiv.MedRxivSearcher),
+    ],
+)
+def test_read_failure_diagnostic_does_not_become_paper_text(
+    module, searcher_class, monkeypatch, tmp_path, capsys, caplog
+):
+    source = module.__name__.rsplit(".", 1)[-1]
+    (tmp_path / "example.pdf").write_bytes(b"invalid PDF")
+    monkeypatch.setattr(cli, "SEARCHERS", {source: searcher_class()})
+    monkeypatch.setattr(module, "PdfReader", Mock(side_effect=Value
```

---

### Incident Patch 10: `260611ff` (2026-09-30)
**Commit Message**: Merge main into documentation fix, preserving sorting and skill ZIP sections

Resolve the additive README conflict without dropping either section. Validated resolved tree with 169 deterministic tests and 8 subtests.

**File**: `.env.example` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ PAPER_SEARCH_MCP_GOOGLE_SCHOLAR_PROXY_URL=
 PAPER_SEARCH_MCP_OPENAIRE_API_KEY=
 PAPER_SEARCH_MCP_CITESEERX_API_KEY=
 PAPER_SEARCH_MCP_IEEE_API_KEY=
-PAPER_SEARCH_MCP_ACM_API_KEY=
+# ACM Digital Library search is keyless; legacy ACM_API_KEY settings are unused.
 
 # Optional: override env file path if needed
 # PAPER_SEARCH_MCP_ENV_FILE=/absolute/path/to/.env
```

**File**: `.github/workflows/publish.yml` (modified, +3/-0)
```diff
@@ -33,11 +33,14 @@ jobs:
         run: >
           python -m pytest
           tests/test_package_entrypoints.py
+          tests/test_cli_sort.py
           tests/test_config_env.py
           tests/test_unpaywall.py
           tests/test_unpaywall_source.py
           tests/test_tool_schema_compat.py
           tests/test_search_timeouts.py
+          tests/test_arxiv_406.py
+          tests/test_arxiv.py::TestArxivRateLimiting
           tests/test_biorxiv_search_modes.py
           -q --tb=short
 
```

**File**: `README.md` (modified, +30/-20)
```diff
@@ -114,7 +114,7 @@ This matrix reflects **verified live-integration results** from functional and e
 | Unpaywall | ✅ (DOI lookup) | ❌ | ❌ | **Requires** `PAPER_SEARCH_MCP_UNPAYWALL_EMAIL` |
 | Sci-Hub (optional) | ⚠️ fallback-only | ✅ | ❌ | Optional; unstable mirrors; user responsibility |
 | **IEEE Xplore** 🔑 | 🚧 skeleton | 🚧 skeleton | 🚧 skeleton | Requires `PAPER_SEARCH_MCP_IEEE_API_KEY` to activate |
-| **ACM DL** 🔑 | 🚧 skeleton | 🚧 skeleton | 🚧 skeleton | Requires `PAPER_SEARCH_MCP_ACM_API_KEY` to activate |
+| **ACM DL** | ✅ (Crossref metadata) | ⚠️ | ⚠️ | Keyless search; direct PDF/read may be blocked by browser challenges; use OA fallback |
 
 > ✅ = reliable in live tests.  ⚠️ = works but subject to upstream instability or access restrictions.  ❌ = not supported.  🔑 = key required.  🚧 = skeleton only.
 
@@ -135,7 +135,6 @@ All keys are **optional** unless noted. Configure them in `~/.config/paper-searc
 | `PAPER_SEARCH_MCP_DOAJ_API_KEY` | DOAJ | Optional | Free at [doaj.org](https://doaj.org/apply-for-api-key/) — raises hourly rate limit |
 | `PAPER_SEARCH_MCP_ZENODO_ACCESS_TOKEN` | Zenodo | Optional | Free at [zenodo.org](https://zenodo.org/account/settings/applications/) — required for private records |
 | `PAPER_SEARCH_MCP_IEEE_API_KEY` | IEEE Xplore | **Required to activate** | Free at [developer.ieee.org](https://developer.ieee.org/) |
-| `PAPER_SEARCH_MCP_ACM_API_KEY` | ACM DL | **Required to activate** | See [libraries.acm.org/digital-library/acm-open](https://libraries.acm.org/digital-library/acm-open) |
 
 All variables follow the `PAPER_SEARCH_MCP_<NAME>` prefix scheme. Legacy names without the prefix (e.g. `CORE_API_KEY`, `UNPAYWALL_EMAIL`) are still supported for backward compatibility.
 
@@ -160,24 +159,23 @@ Some search failures are caused by external provider instability, not by bugs in
 
 ## Optional Paid Platform Connectors (Phase 3)
 
-IEEE Xplore and ACM Digital Library connectors are included as **opt-in skeletons**.
-They are **disabled by default** — no API calls are made unless you explicitly configure the corresponding keys.
+IEEE Xplore is an **opt-in skeleton**, disabled until its API key is configured.
+ACM Digital Library search is **keyless and enabled by default**, using Crossref metadata restricted to ACM DOI prefix `10.1145`.
 
 | Platform | Env Var | Status |
 |---|---|---|
 | IEEE Xplore | `PAPER_SEARCH_MCP_IEEE_API_KEY` | 🚧 skeleton — search registered, download/read raise `NotImplementedError` |
-| ACM Digital Library | `PAPER_SEARCH_MCP_ACM_API_KEY` | 🚧 skeleton — search registered, download/read raise `NotImplementedError` |
+| ACM Digital Library | None | Crossref-backed search; PDF download/read depend on publisher access |
 
 **How to enable:**
 
 ```bash
 export PAPER_SEARCH_MCP_IEEE_API_KEY=<your_ieee_key>       # free key at https://developer.ieee.org/
-export PAPER_SEARCH_MCP_ACM_API_KEY=<your_acm_key>         # see https://libraries.acm.org/digital-library
 ```
 
-Once a key is set, the corresponding source is automatically added to `ALL_SOURCES` and its MCP tools (`search_ieee` / `search_acm`, `download_ieee` / `download_acm`, `read_ieee_paper` / `read_acm_paper`) are registered at server startup.
+With an IEEE key, `ieee` and its tools are registered at startup. ACM (`acm`, `search_acm`, `download_acm`, and `read_acm_paper`) is always available. Legacy `PAPER_SEARCH_MCP_ACM_API_KEY` / `ACM_API_KEY` settings are no longer used and can be removed.
 
-Without a key the connectors log a startup warning only — the rest of the server is unaffected.
+ACM downloads require an ACM DOI such as `10.1145/...`. Publisher browser challenges may block scripted access; use `download_with_fallback(source="acm", paper_id="10.1145/...", doi="10.1145/...")` to try open repositories. `read_acm_paper` downloads a PDF into `save_path` before extracting text and can overwrite that file.
 
 ## Free Source Expansion (Phase 4)
 
@@ -240,6 +238,24 @@ Create `~/.config/paper-search-mcp/.env` for optional API keys (see [Environment
 
 The skill uses a CLI (`paper-search`) that wraps the same library as the MCP server, outputting JSON for search/download and plain text for read.
 
+Sort search results by citation count or publication date:
+
+```bash
+paper-search search "transformer attention" --sources arxiv,semantic --sort citations
+paper-search search "CRISPR" --sort date
+```
+
+`--sort relevance` (the default) preserves the existing order: selected sources
+in order, with each source's returned order unchanged. It does not compute a
+cross-source relevance score. `--sort citations` orders highest counts first;
+`--sort date` orders newest publication dates first. Sorting is client-side,
+after deduplication, and only covers retrieved results (`--max-results` is per
+source); it does not change source queries or search the full source collection
+for its most-cited/newest papers. Ties retain their original order. Missing or
+invalid values sort last; numeric citat
```

**File**: `claude-code/SKILL.md` (modified, +2/-2)
```diff
@@ -47,9 +47,9 @@ paper-search sources
 
 ## Sources
 
-arxiv, pubmed, biorxiv, medrxiv, google_scholar, iacr, semantic, crossref, openalex, pmc, core, europepmc, dblp, openaire, citeseerx, doaj, base, zenodo, hal, ssrn, unpaywall
+arxiv, pubmed, biorxiv, medrxiv, google_scholar, iacr, semantic, crossref, openalex, pmc, core, europepmc, dblp, openaire, citeseerx, doaj, base, zenodo, hal, ssrn, unpaywall, acm
 
-Optional (env vars): ieee (`IEEE_API_KEY`), acm (`ACM_API_KEY`)
+Optional (env vars): ieee (`IEEE_API_KEY`). ACM search is keyless and uses Crossref metadata; publisher PDF access may require the OA fallback.
 
 ## Workflow
 
```

**File**: `paper_search_mcp/academic_platforms/acm.py` (modified, +85/-93)
```diff
@@ -1,113 +1,105 @@
-"""ACM Digital Library connector — optional, requires API key env.
-
-This module is a **skeleton only**.  No real ACM DL API requests are made
-unless the ``PAPER_SEARCH_MCP_ACM_API_KEY`` (or legacy ``ACM_API_KEY``)
-environment variable is configured.  All methods
-raise :class:`NotImplementedError` with a descriptive message when accessed
-without a valid key so that the rest of the platform continues to work without
-any paid credentials.
-
-Enable usage::
-
-    export PAPER_SEARCH_MCP_ACM_API_KEY=<your_acm_api_key>
-
-.. note::
-    ACM recently opened a limited metadata API.  Check
-    https://libraries.acm.org/digital-library/acm-open for Open Access content
-    that does NOT require a key.  Full-text/PDF download requires ACM membership
-    or institutional access.
+"""ACM Digital Library connector — keyless.
+
+Since 1 January 2026 the entire ACM Digital Library is open access, and ACM
+does not offer a public search API, so no API key exists for this source.
+Search is served from Crossref restricted to ACM's DOI prefix (``10.1145``),
+which covers every ACM-published work with full bibliographic metadata.
+
+PDFs live at ``https://dl.acm.org/doi/pdf/<doi>`` and are free to read, but
+dl.acm.org sits behind a Cloudflare browser challenge that rejects scripted
+clients.  ``download_pdf`` tries the direct link first and, when blocked,
+raises with the browser URL so the user (or ``download_with_fallback``) can
+take over.
 """
 
 from __future__ import annotations
 
 import logging
-from typing import List
+import os
+from typing import List, Optional
+
+import requests
 
-from .base import PaperSource
+from .crossref import CrossRefSearcher
 from ..paper import Paper
-from ..config import get_env
 
 logger = logging.getLogger(__name__)
 
-_NOT_CONFIGURED_MSG = (
-    "ACM Digital Library is not configured.  Set PAPER_SEARCH_MCP_ACM_API_KEY "
-    "(or legacy ACM_API_KEY) environment "
-    "variable to enable ACM DL search.  "
-    "See https://libraries.acm.org/digital-library/acm-open for access options."
-)
-
-
-class ACMSearcher(PaperSource):
-    """Skeleton connector for ACM Digital Library.
-
-    Instantiating this class without ``PAPER_SEARCH_MCP_ACM_API_KEY``
-    (or ``ACM_API_KEY``) set will log a warning
-    but will NOT raise an error.  All actual operations raise
-    :class:`NotImplementedError` with a clear message directing the user to
-    configure their API key.
-    """
-
-    # ACM DL base URL (placeholder — real endpoint TBD once API key is available)
-    BASE_URL = "https://dl.acm.org/action/doSearch"
-
-    def __init__(self) -> None:
-        self.api_key: str = get_env("ACM_API_KEY", "")
-        if not self.api_key:
-            logger.warning(
-                "ACMSearcher initialised without PAPER_SEARCH_MCP_ACM_API_KEY/ACM_API_KEY.  "
-                "All calls will raise NotImplementedError until the key is set."
-            )
-
-    # ------------------------------------------------------------------
-    # Public helpers
-    # ------------------------------------------------------------------
-
-    def is_configured(self) -> bool:
-        """Return True only when a non-empty ACM API key is available."""
-        return bool(self.api_key)
-
-    # ------------------------------------------------------------------
-    # PaperSource interface
-    # ------------------------------------------------------------------
-
-    def search(self, query: str, max_results: int = 10, **kwargs) -> List[Paper]:  # type: ignore[override]
-        """Search ACM Digital Library — requires PAPER_SEARCH_MCP_ACM_API_KEY or ACM_API_KEY.
-
-        Raises:
-            NotImplementedError: Always, when ACM API key env is not set.
-        """
-        if not self.is_configured():
-            raise NotImplementedError(_NOT_CONFIGURED_MSG)
-
-        # TODO: implement real ACM DL API call here once key is available
-        raise NotImplementedError(
-            "ACM DL search is not yet implemented.  "
-            "Contribute at https://github.com/your-repo/paper-search-mcp."
-        )
+ACM_DOI_PREFIX = "10.1145"
+
+
+class ACMSearcher(CrossRefSearcher):
+    """ACM Digital Library search via Crossref's ACM DOI prefix."""
+
+    PDF_URL_TEMPLATE = "https://dl.acm.org/doi/pdf/{doi}"
+    PAGE_URL_TEMPLATE = "https://dl.acm.org/doi/{doi}"
+
+    def search(self, query: str, max_results: int = 10, **kwargs) -> List[Paper]:
+        prefix_filter = f"prefix:{ACM_DOI_PREFIX}"
+        extra_filter = kwargs.pop("filter", "")
+        kwargs["filter"] = f"{prefix_filter},{extra_filter}" if extra_filter else prefix_filter
+
+        papers = super().search(query, max_results=max_results, **kwargs)
+        for paper in papers:
+            self._to_acm(paper)
+        return papers
+
+    def get_paper_by_doi(self, doi: str) -> Optional[Paper]:
+        doi = self._validate_acm_doi(doi)
+        paper = super().get_paper_by_doi(doi)
+        if paper is not No
```

**File**: `paper_search_mcp/academic_platforms/arxiv.py` (modified, +86/-27)
```diff
@@ -5,6 +5,7 @@
 from datetime import datetime
 from threading import Lock
 from typing import List
+from xml.etree import ElementTree
 
 import feedparser
 import requests
@@ -60,9 +61,50 @@ def _is_soft_rate_limit(response: requests.Response) -> bool:
             body_head = body_head.encode("utf-8", errors="ignore")
         return body_head.strip().lower().startswith(b"rate exceeded")
 
+    @classmethod
+    def _is_usable_406_feed(cls, response: requests.Response) -> bool:
+        """Only recover nonempty, well-formed arXiv results behind a bad status.
+
+        feedparser intentionally tolerates malformed XML and HTML, so parsing
+        alone is not enough. Empty feeds and arXiv API error entries cannot
+        establish that a 406 was a successful search.
+        """
+        try:
+            root = ElementTree.fromstring(response.content)
+            if root.tag != "{http://www.w3.org/2005/Atom}feed":
+                return False
+            feed = feedparser.parse(response.content)
+            if feed.bozo or feed.version != "atom10" or not feed.entries:
+                return False
+            if not re.fullmatch(
+                r"https?://arxiv\.org/api/[^\s]+", feed.feed.get("id", "")
+            ):
+                return False
+            total = int(feed.feed.get("opensearch_totalresults", "0"))
+            if total < len(feed.entries):
+                return False
+            for entry in feed.entries:
+                if not re.fullmatch(
+                    r"https?://arxiv\.org/abs/(?:[0-9]{4}\.[0-9]{4,5}|"
+                    r"[a-z-]+(?:\.[A-Z]{2})?/[0-9]{7})(?:v[0-9]+)?",
+                    entry.get("id", ""),
+                ):
+                    return False
+                if not all(entry.get(field, "").strip() for field in ("title", "summary")):
+                    return False
+                if not entry.get("authors") or not entry.get("tags"):
+                    return False
+                # Verify every entry can actually be consumed, rather than
+                # accepting a feed whose entries search() would silently skip.
+                cls._paper_from_entry(entry)
+            return True
+        except (ElementTree.ParseError, ValueError, TypeError, AttributeError, KeyError):
+            return False
+
     def _request_with_retries(self, params):
         """Issue one serialized, paced arXiv request sequence."""
         response = None
+        saw_unusable_406 = False
         with self._request_lock:
             for attempt in range(self.MAX_ATTEMPTS):
                 self._pace_locked()
@@ -89,6 +131,14 @@ def _request_with_retries(self, params):
                         f"across {self.MAX_ATTEMPTS} attempts"
                     )
 
+                if response.status_code == 406:
+                    if self._is_usable_406_feed(response):
+                        return response
+                    saw_unusable_406 = True
+                    if attempt < self.MAX_ATTEMPTS - 1:
+                        time.sleep((attempt + 1) * 1.5)
+                    continue
+
                 if response.status_code in self.RETRYABLE_STATUS_CODES:
                     if attempt < self.MAX_ATTEMPTS - 1:
                         time.sleep((attempt + 1) * 1.5)
@@ -98,7 +148,12 @@ def _request_with_retries(self, params):
                             "arxiv rate-limited: HTTP 429 persisted "
                             f"across {self.MAX_ATTEMPTS} attempts"
                         )
-                return response
+                break
+        if saw_unusable_406:
+            raise requests.RequestException(
+                "arxiv search failed: HTTP 406 without a usable arXiv Atom feed; "
+                f"no successful response within {self.MAX_ATTEMPTS} attempts"
+            )
         return response
 
     @staticmethod
@@ -124,42 +179,46 @@ def search(self, query: str, max_results: int = 10, sort_by: str = 'relevance',
         }
         response = self._request_with_retries(params)
 
-        if response is None or response.status_code != 200:
+        if response is None or response.status_code not in (200, 406):
             return []
 
         feed = feedparser.parse(response.content)
         papers = []
         for entry in feed.entries:
             try:
-                authors = [author.name for author in entry.authors]
-                published = datetime.strptime(entry.published, '%Y-%m-%dT%H:%M:%SZ')
-                updated = datetime.strptime(entry.updated, '%Y-%m-%dT%H:%M:%SZ')
-                pdf_url = next((link.href for link in entry.links if link.type == 'application/pdf'), '')
-                
-                # Try to extract DOI from entry.doi or links or summary
-                doi = entry.get('doi', '') or extract_doi(entry.summary) or extract_doi(entry.id)
-                for link in entry.links:
-                    if link.get('title') == 'doi':
-                        doi = doi or ext
```

**File**: `paper_search_mcp/cli.py` (modified, +52/-5)
```diff
@@ -7,6 +7,8 @@
 import asyncio
 import json
 import sys
+from datetime import date, datetime, timezone
+from decimal import Decimal, InvalidOperation
 from typing import Any, Dict, List
 
 from .config import get_env
@@ -73,10 +75,10 @@ def _init_searchers() -> None:
         from .academic_platforms.ieee import IEEESearcher
         SEARCHERS["ieee"] = IEEESearcher()
 
-    acm_key = get_env("ACM_API_KEY", "")
-    if acm_key:
-        from .academic_platforms.acm import ACMSearcher
-        SEARCHERS["acm"] = ACMSearcher()
+    # ACM Digital Library is keyless (open access since 2026-01-01, served via
+    # Crossref) and always registered.
+    from .academic_platforms.acm import ACMSearcher
+    SEARCHERS["acm"] = ACMSearcher()
 
 
 ALL_SOURCES = [
@@ -116,6 +118,46 @@ def _dedupe(papers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
     return out
 
 
+def _citation_sort_key(paper: Dict[str, Any]) -> tuple[bool, Decimal]:
+    """Put valid nonnegative counts first, including numeric strings."""
+    value = paper.get("citations")
+    try:
+        count = Decimal(str(value))
+    except InvalidOperation:
+        return False, Decimal(0)
+    if not count.is_finite() or count < 0:
+        return False, Decimal(0)
+    return True, count
+
+
+def _date_sort_key(paper: Dict[str, Any]) -> tuple[bool, datetime]:
+    """Compare ISO dates/timestamps consistently; treat naive values as UTC."""
+    value = paper.get("published_date")
+    try:
+        if isinstance(value, datetime):
+            parsed = value
+        elif isinstance(value, date):
+            parsed = datetime.combine(value, datetime.min.time())
+        elif isinstance(value, str):
+            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
+        else:
+            raise ValueError("Missing or unsupported date")
+        if parsed.tzinfo is None:
+            parsed = parsed.replace(tzinfo=timezone.utc)
+        return True, parsed
+    except ValueError:
+        return False, datetime.min.replace(tzinfo=timezone.utc)
+
+
+def _sort_papers(papers: List[Dict[str, Any]], order: str) -> List[Dict[str, Any]]:
+    """Sort retrieved papers stably, without changing connector queries."""
+    if order == "citations":
+        return sorted(papers, key=_citation_sort_key, reverse=True)
+    if order == "date":
+        return sorted(papers, key=_date_sort_key, reverse=True)
+    return papers
+
+
 # ---------------------------------------------------------------------------
 # Async helpers
 # ---------------------------------------------------------------------------
@@ -165,7 +207,7 @@ async def cmd_search(args: argparse.Namespace) -> int:
                     p["source"] = name
                 merged.append(p)
 
-    deduped = _dedupe(merged)
+    deduped = _sort_papers(_dedupe(merged), getattr(args, "sort", "relevance"))
 
     output = {
         "query": args.query,
@@ -241,6 +283,11 @@ def build_parser() -> argparse.ArgumentParser:
     p_search.add_argument("-y", "--year", default=None,
                           help="Year filter for Semantic Scholar (e.g. '2020', '2018-2022')")
 
+    p_search.add_argument("--sort", choices=("relevance", "citations", "date"),
+                          default="relevance",
+                          help="Order retrieved results: relevance preserves source order (default); "
+                               "citations sorts highest first; date sorts newest first")
+
     # download
     p_dl = sub.add_parser("download", help="Download a paper PDF")
     p_dl.add_argument("source", help="Source platform (e.g. arxiv, semantic)")
```

**File**: `paper_search_mcp/server.py` (modified, +42/-42)
```diff
@@ -169,11 +169,10 @@ async def _run_search_with_timeout(
 
 # ---------------------------------------------------------------------------
 # Optional paid-platform connectors (disabled by default)
-# Set PAPER_SEARCH_MCP_IEEE_API_KEY / PAPER_SEARCH_MCP_ACM_API_KEY to activate
-# (legacy IEEE_API_KEY / ACM_API_KEY are also supported).
+# Set PAPER_SEARCH_MCP_IEEE_API_KEY to activate IEEE Xplore
+# (legacy IEEE_API_KEY is also supported).
 # ---------------------------------------------------------------------------
 _ieee_api_key = get_env("IEEE_API_KEY", "")
-_acm_api_key = get_env("ACM_API_KEY", "")
 
 if _ieee_api_key:
     from .academic_platforms.ieee import IEEESearcher
@@ -183,13 +182,12 @@ async def _run_search_with_timeout(
 else:
     ieee_searcher = None
 
-if _acm_api_key:
-    from .academic_platforms.acm import ACMSearcher
-    acm_searcher = ACMSearcher()
-    ALL_SOURCES.append("acm")
-    logger.info("ACM Digital Library enabled via configured environment key.")
-else:
-    acm_searcher = None
+# ACM Digital Library has been open access since 2026-01-01 and has no public
+# search API, so it is served from Crossref (no key required) and enabled by
+# default.
+from .academic_platforms.acm import ACMSearcher
+acm_searcher = ACMSearcher()
+ALL_SOURCES.append("acm")
 
 
 def _parse_sources(sources: str) -> List[str]:
@@ -443,6 +441,7 @@ async def _try_repository_fallback(
     `_download_from_url` so the downloaded PDF's content is also verified.
     """
     repository_searchers = [
+        ("arxiv", arxiv_searcher),
         ("openaire", openaire_searcher),
         ("core", core_searcher),
         ("europepmc", europepmc_searcher),
@@ -1691,44 +1690,45 @@ async def read_ieee_paper(paper_id: str, save_path: str = "./downloads") -> str:
 
 
 # ---------------------------------------------------------------------------
-# Optional ACM Digital Library tools — registered only when API key is set
+# ACM Digital Library tools — keyless, served via Crossref (see acm.py)
 # ---------------------------------------------------------------------------
-if acm_searcher is not None:
-    @mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
-    async def search_acm(query: str, max_results: int = 10) -> List[Dict]:
-        """Search ACM Digital Library for papers.  Requires PAPER_SEARCH_MCP_ACM_API_KEY (or ACM_API_KEY).
+@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
+async def search_acm(query: str, max_results: int = 10) -> List[Dict]:
+    """Search ACM Digital Library for papers.
 
-        Args:
-            query: Search query string.
-            max_results: Maximum number of results (default: 10).
-        Returns:
-            List of paper dicts from ACM DL.
-        """
-        return await async_search(acm_searcher, query, max_results)
+    Args:
+        query: Search query string.
+        max_results: Maximum number of results (default: 10).
+    Returns:
+        List of paper dicts from ACM DL.
+    """
+    return await async_search(acm_searcher, query, max_results)
 
-    @mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
-    async def download_acm(paper_id: str, save_path: str = "./downloads") -> str:
-        """Download a PDF from ACM Digital Library.  Requires PAPER_SEARCH_MCP_ACM_API_KEY (or ACM_API_KEY) and institutional access.
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
+async def download_acm(paper_id: str, save_path: str = "./downloads") -> str:
+    """Download a PDF from ACM Digital Library.  dl.acm.org sits behind a
+    Cloudflare browser challenge that blocks scripted downloads; on a block,
+    raises with the browser URL and a download_with_fallback suggestion.
 
-        Args:
-            paper_id: ACM DL paper identifier.
-            save_path: Directory to save the PDF (default: './downloads').
-        Returns:
-            str: Path to saved PDF or error message.
-        """
-        return await asyncio.to_thread(acm_searcher.download_pdf, paper_id, save_path)
+    Args:
+        paper_id: ACM DOI (e.g. '10.1145/...').
+        save_path: Directory to save the PDF (default: './downloads').
+    Returns:
+        str: Path to saved PDF or error message.
+    """
+    return await asyncio.to_thread(acm_searcher.download_pdf, paper_id, save_path)
 
-    @mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
-    async def read_acm_paper(paper_id: str, save_path: str = "./downloads") -> str:
-        """Download and read an ACM Digital Library paper.  Requires PAPER_SEARCH_MCP_ACM_API_KEY (or ACM_API_KEY).
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
+async def read_acm_paper(paper_id: str, save_path: str = "./downloads") -> str:
+    """Download and read an ACM Digital Library paper.
 
-        Args:
-            paper_id: ACM DL paper identifier.
-            s
```

---

### Incident Patch 11: `ed9af46e` (2026-09-30)
**Commit Message**: fix: harden keyless ACM search integration

Build directly on PR #123, retaining its original commit and contributor
history. Correct read tool write annotations, move blocking PDF reading
onto a worker thread, validate ACM DOI lookups, and update configuration
and skill documentation.

Validation: 76 targeted tests and 3 subtests passed; the combined repair
set passed 169 deterministic tests and 8 subtests on Python 3.12.

Source: https://github.com/openags/paper-search-mcp/pull/123

Co-authored-by: ChrisPrapas <[REDACTED_EMAIL]>

**File**: `.env.example` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ PAPER_SEARCH_MCP_GOOGLE_SCHOLAR_PROXY_URL=
 PAPER_SEARCH_MCP_OPENAIRE_API_KEY=
 PAPER_SEARCH_MCP_CITESEERX_API_KEY=
 PAPER_SEARCH_MCP_IEEE_API_KEY=
-PAPER_SEARCH_MCP_ACM_API_KEY=
+# ACM Digital Library search is keyless; legacy ACM_API_KEY settings are unused.
 
 # Optional: override env file path if needed
 # PAPER_SEARCH_MCP_ENV_FILE=/absolute/path/to/.env
```

**File**: `README.md` (modified, +12/-20)
```diff
@@ -114,7 +114,7 @@ This matrix reflects **verified live-integration results** from functional and e
 | Unpaywall | ✅ (DOI lookup) | ❌ | ❌ | **Requires** `PAPER_SEARCH_MCP_UNPAYWALL_EMAIL` |
 | Sci-Hub (optional) | ⚠️ fallback-only | ✅ | ❌ | Optional; unstable mirrors; user responsibility |
 | **IEEE Xplore** 🔑 | 🚧 skeleton | 🚧 skeleton | 🚧 skeleton | Requires `PAPER_SEARCH_MCP_IEEE_API_KEY` to activate |
-| **ACM DL** 🔑 | 🚧 skeleton | 🚧 skeleton | 🚧 skeleton | Requires `PAPER_SEARCH_MCP_ACM_API_KEY` to activate |
+| **ACM DL** | ✅ (Crossref metadata) | ⚠️ | ⚠️ | Keyless search; direct PDF/read may be blocked by browser challenges; use OA fallback |
 
 > ✅ = reliable in live tests.  ⚠️ = works but subject to upstream instability or access restrictions.  ❌ = not supported.  🔑 = key required.  🚧 = skeleton only.
 
@@ -135,7 +135,6 @@ All keys are **optional** unless noted. Configure them in `~/.config/paper-searc
 | `PAPER_SEARCH_MCP_DOAJ_API_KEY` | DOAJ | Optional | Free at [doaj.org](https://doaj.org/apply-for-api-key/) — raises hourly rate limit |
 | `PAPER_SEARCH_MCP_ZENODO_ACCESS_TOKEN` | Zenodo | Optional | Free at [zenodo.org](https://zenodo.org/account/settings/applications/) — required for private records |
 | `PAPER_SEARCH_MCP_IEEE_API_KEY` | IEEE Xplore | **Required to activate** | Free at [developer.ieee.org](https://developer.ieee.org/) |
-| `PAPER_SEARCH_MCP_ACM_API_KEY` | ACM DL | **Required to activate** | See [libraries.acm.org/digital-library/acm-open](https://libraries.acm.org/digital-library/acm-open) |
 
 All variables follow the `PAPER_SEARCH_MCP_<NAME>` prefix scheme. Legacy names without the prefix (e.g. `CORE_API_KEY`, `UNPAYWALL_EMAIL`) are still supported for backward compatibility.
 
@@ -160,24 +159,23 @@ Some search failures are caused by external provider instability, not by bugs in
 
 ## Optional Paid Platform Connectors (Phase 3)
 
-IEEE Xplore and ACM Digital Library connectors are included as **opt-in skeletons**.
-They are **disabled by default** — no API calls are made unless you explicitly configure the corresponding keys.
+IEEE Xplore is an **opt-in skeleton**, disabled until its API key is configured.
+ACM Digital Library search is **keyless and enabled by default**, using Crossref metadata restricted to ACM DOI prefix `10.1145`.
 
 | Platform | Env Var | Status |
 |---|---|---|
 | IEEE Xplore | `PAPER_SEARCH_MCP_IEEE_API_KEY` | 🚧 skeleton — search registered, download/read raise `NotImplementedError` |
-| ACM Digital Library | `PAPER_SEARCH_MCP_ACM_API_KEY` | 🚧 skeleton — search registered, download/read raise `NotImplementedError` |
+| ACM Digital Library | None | Crossref-backed search; PDF download/read depend on publisher access |
 
 **How to enable:**
 
 ```bash
 export PAPER_SEARCH_MCP_IEEE_API_KEY=<your_ieee_key>       # free key at https://developer.ieee.org/
-export PAPER_SEARCH_MCP_ACM_API_KEY=<your_acm_key>         # see https://libraries.acm.org/digital-library
 ```
 
-Once a key is set, the corresponding source is automatically added to `ALL_SOURCES` and its MCP tools (`search_ieee` / `search_acm`, `download_ieee` / `download_acm`, `read_ieee_paper` / `read_acm_paper`) are registered at server startup.
+With an IEEE key, `ieee` and its tools are registered at startup. ACM (`acm`, `search_acm`, `download_acm`, and `read_acm_paper`) is always available. Legacy `PAPER_SEARCH_MCP_ACM_API_KEY` / `ACM_API_KEY` settings are no longer used and can be removed.
 
-Without a key the connectors log a startup warning only — the rest of the server is unaffected.
+ACM downloads require an ACM DOI such as `10.1145/...`. Publisher browser challenges may block scripted access; use `download_with_fallback(source="acm", paper_id="10.1145/...", doi="10.1145/...")` to try open repositories. `read_acm_paper` downloads a PDF into `save_path` before extracting text and can overwrite that file.
 
 ## Free Source Expansion (Phase 4)
 
@@ -284,8 +282,7 @@ curl -LsSf https://astral.sh/uv/install.sh | sh
         "PAPER_SEARCH_MCP_SEMANTIC_SCHOLAR_API_KEY": "",
         "PAPER_SEARCH_MCP_ZENODO_ACCESS_TOKEN": "",
         "PAPER_SEARCH_MCP_GOOGLE_SCHOLAR_PROXY_URL": "",
-        "PAPER_SEARCH_MCP_IEEE_API_KEY": "",
-        "PAPER_SEARCH_MCP_ACM_API_KEY": ""
+        "PAPER_SEARCH_MCP_IEEE_API_KEY": ""
       }
     }
   }
@@ -314,8 +311,7 @@ uv tool install paper-search-mcp
         "PAPER_SEARCH_MCP_SEMANTIC_SCHOLAR_API_KEY": "",
         "PAPER_SEARCH_MCP_ZENODO_ACCESS_TOKEN": "",
         "PAPER_SEARCH_MCP_GOOGLE_SCHOLAR_PROXY_URL": "",
-        "PAPER_SEARCH_MCP_IEEE_API_KEY": "",
-        "PAPER_SEARCH_MCP_ACM_API_KEY": ""
+        "PAPER_SEARCH_MCP_IEEE_API_KEY": ""
       }
     }
   }
@@ -344,8 +340,7 @@ pip install paper-search-mcp
         "PAPER_SEARCH_MCP_SEMANTIC_SCHOLAR_API_KEY": "",
         "PAPER_SEARCH_MCP_ZENODO_ACCESS_TOKEN": "",
         "PAPER_SEARCH_MCP_GOOGLE_SCHOLAR_PROXY_URL": "",
-        "PAPER_SEARCH_MCP_IEEE_API_KEY": "",
-        "PAPER_SEARCH
```

**File**: `claude-code/SKILL.md` (modified, +2/-2)
```diff
@@ -47,9 +47,9 @@ paper-search sources
 
 ## Sources
 
-arxiv, pubmed, biorxiv, medrxiv, google_scholar, iacr, semantic, crossref, openalex, pmc, core, europepmc, dblp, openaire, citeseerx, doaj, base, zenodo, hal, ssrn, unpaywall
+arxiv, pubmed, biorxiv, medrxiv, google_scholar, iacr, semantic, crossref, openalex, pmc, core, europepmc, dblp, openaire, citeseerx, doaj, base, zenodo, hal, ssrn, unpaywall, acm
 
-Optional (env vars): ieee (`IEEE_API_KEY`), acm (`ACM_API_KEY`)
+Optional (env vars): ieee (`IEEE_API_KEY`). ACM search is keyless and uses Crossref metadata; publisher PDF access may require the OA fallback.
 
 ## Workflow
 
```

**File**: `paper_search_mcp/academic_platforms/acm.py` (modified, +13/-3)
```diff
@@ -45,6 +45,7 @@ def search(self, query: str, max_results: int = 10, **kwargs) -> List[Paper]:
         return papers
 
     def get_paper_by_doi(self, doi: str) -> Optional[Paper]:
+        doi = self._validate_acm_doi(doi)
         paper = super().get_paper_by_doi(doi)
         if paper is not None:
             self._to_acm(paper)
@@ -56,16 +57,25 @@ def _to_acm(self, paper: Paper) -> None:
             paper.url = self.PAGE_URL_TEMPLATE.format(doi=paper.doi)
             paper.pdf_url = self.PDF_URL_TEMPLATE.format(doi=paper.doi)
 
+    @staticmethod
+    def _validate_acm_doi(paper_id: str) -> str:
+        doi = paper_id.strip()
+        for prefix in ("https://doi.org/", "http://doi.org/", "doi:"):
+            if doi.lower().startswith(prefix):
+                doi = doi[len(prefix):].strip()
+                break
+        if not doi.startswith(f"{ACM_DOI_PREFIX}/") or not doi[len(ACM_DOI_PREFIX) + 1:]:
+            raise ValueError(f"Not an ACM DOI (expected {ACM_DOI_PREFIX}/...): {paper_id}")
+        return doi
+
     def download_pdf(self, paper_id: str, save_path: str = "./downloads") -> str:
         """Download an ACM PDF by DOI (``10.1145/...``).
 
         Raises:
             ValueError: If ``paper_id`` is not an ACM DOI.
             IOError: If dl.acm.org blocks the scripted request.
         """
-        doi = paper_id.strip().removeprefix("https://doi.org/")
-        if not doi.startswith(f"{ACM_DOI_PREFIX}/"):
-            raise ValueError(f"Not an ACM DOI (expected {ACM_DOI_PREFIX}/...): {paper_id}")
+        doi = self._validate_acm_doi(paper_id)
 
         pdf_url = self.PDF_URL_TEMPLATE.format(doi=doi)
         response = requests.get(
```

**File**: `paper_search_mcp/server.py` (modified, +2/-2)
```diff
@@ -1717,7 +1717,7 @@ async def download_acm(paper_id: str, save_path: str = "./downloads") -> str:
     """
     return await asyncio.to_thread(acm_searcher.download_pdf, paper_id, save_path)
 
-@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
 async def read_acm_paper(paper_id: str, save_path: str = "./downloads") -> str:
     """Download and read an ACM Digital Library paper.
 
@@ -1727,7 +1727,7 @@ async def read_acm_paper(paper_id: str, save_path: str = "./downloads") -> str:
     Returns:
         str: Extracted text content.
     """
-    return acm_searcher.read_paper(paper_id, save_path)
+    return await asyncio.to_thread(acm_searcher.read_paper, paper_id, save_path)
 
 
 def _wait_for_windows_process_exit(process_id: int) -> bool:
```

**File**: `tests/test_acm.py` (modified, +32/-0)
```diff
@@ -1,4 +1,6 @@
 """Tests for the keyless ACM Digital Library connector (Crossref prefix 10.1145)."""
+import asyncio
+import threading
 import unittest
 import unittest.mock
 
@@ -36,6 +38,23 @@ def test_search_restricts_to_acm_prefix_and_relabels(self):
         self.assertEqual(paper.url, "https://dl.acm.org/doi/10.1145/3654522.3654560")
         self.assertEqual(paper.pdf_url, "https://dl.acm.org/doi/pdf/10.1145/3654522.3654560")
 
+    def test_lookup_rejects_non_acm_doi_before_request(self):
+        searcher = ACMSearcher()
+        with unittest.mock.patch.object(searcher.session, "get") as get:
+            for doi in ("10.1109/5.771073", "https://doi.org/10.1000/test", "10.1145/"):
+                with self.subTest(doi=doi), self.assertRaises(ValueError):
+                    searcher.get_paper_by_doi(doi)
+            get.assert_not_called()
+
+    def test_lookup_normalizes_acm_doi(self):
+        searcher = ACMSearcher()
+        response = _crossref_response([])
+        response.json.return_value = {"message": CROSSREF_ITEM}
+        with unittest.mock.patch.object(searcher.session, "get", return_value=response) as get:
+            paper = searcher.get_paper_by_doi("https://doi.org/10.1145/3654522.3654560")
+        self.assertEqual(paper.source, "acm")
+        self.assertTrue(get.call_args.args[0].endswith("/10.1145/3654522.3654560"))
+
     def test_search_merges_extra_filter(self):
         searcher = ACMSearcher()
         with unittest.mock.patch.object(
@@ -75,6 +94,19 @@ def test_successful_download_writes_pdf(self):
             self.assertEqual(os.path.basename(path), "acm_10.1145_3292500.3330701.pdf")
 
 
+class TestACMReadTool(unittest.TestCase):
+    def test_read_runs_off_event_loop_thread(self):
+        from paper_search_mcp import server
+        caller_thread = threading.get_ident()
+        def read(paper_id, save_path):
+            self.assertNotEqual(threading.get_ident(), caller_thread)
+            self.assertEqual((paper_id, save_path), ("10.1145/example", "/tmp/acm-test"))
+            return "paper text"
+        with unittest.mock.patch.object(server.acm_searcher, "read_paper", side_effect=read):
+            result = asyncio.run(server.read_acm_paper("10.1145/example", "/tmp/acm-test"))
+        self.assertEqual(result, "paper text")
+
+
 class TestACMAlwaysEnabled(unittest.TestCase):
     def test_in_all_sources_without_key(self):
         import importlib
```

**File**: `tests/test_tool_schema_compat.py` (modified, +3/-3)
```diff
@@ -62,6 +62,7 @@ def test_search_and_lookup_tools_are_annotated_read_only():
 def test_file_writing_tools_disclose_destructive_local_updates():
     tools = asyncio.run(server.mcp.list_tools())
     side_effecting_read_tools = {
+        "read_acm_paper",
         "read_arxiv_paper",
         "read_biorxiv_paper",
         "read_citeseerx_paper",
@@ -103,7 +104,6 @@ def test_non_writing_read_tools_are_annotated_read_only():
     ]
 
     assert {tool.name for tool in read_only_read_tools} == {
-        "read_acm_paper",
         "read_base_paper",
         "read_crossref_paper",
         "read_dblp_paper",
@@ -155,10 +155,10 @@ def test_optional_ieee_and_acm_tools_publish_annotations():
         "download_acm",
         "read_acm_paper",
     }
-    for name in ("search_ieee", "read_ieee_paper", "search_acm", "read_acm_paper"):
+    for name in ("search_ieee", "read_ieee_paper", "search_acm"):
         assert annotations[name]["readOnlyHint"] is True
         assert annotations[name]["openWorldHint"] is True
-    for name in ("download_ieee", "download_acm"):
+    for name in ("download_ieee", "download_acm", "read_acm_paper"):
         assert annotations[name]["readOnlyHint"] is False
         assert annotations[name]["destructiveHint"] is True
         assert annotations[name]["openWorldHint"] is True
```

---

### Incident Patch 12: `63bf37d7` (2026-09-30)
**Commit Message**: fix(arxiv): recover verified 406 feeds and surface exhausted failures

Retry unusable HTTP 406 responses within the existing serialized and paced request sequence. Consume only well-formed, nonempty arXiv Atom responses whose entries can be converted; report failures instead of false zero results. Preserve network-only and unrelated HTTP failure contracts.

Add deterministic recovery, rejection, retry, and unified-search error regressions, and run these and existing rate-limit tests in release CI. No third-party code or tests were incorporated.

Thanks-to: avvohacker for the report and observations in https://github.com/openags/paper-search-mcp/issues/121

**File**: `.github/workflows/publish.yml` (modified, +2/-0)
```diff
@@ -38,6 +38,8 @@ jobs:
           tests/test_unpaywall_source.py
           tests/test_tool_schema_compat.py
           tests/test_search_timeouts.py
+          tests/test_arxiv_406.py
+          tests/test_arxiv.py::TestArxivRateLimiting
           tests/test_biorxiv_search_modes.py
           -q --tb=short
 
```

**File**: `paper_search_mcp/academic_platforms/arxiv.py` (modified, +86/-27)
```diff
@@ -5,6 +5,7 @@
 from datetime import datetime
 from threading import Lock
 from typing import List
+from xml.etree import ElementTree
 
 import feedparser
 import requests
@@ -60,9 +61,50 @@ def _is_soft_rate_limit(response: requests.Response) -> bool:
             body_head = body_head.encode("utf-8", errors="ignore")
         return body_head.strip().lower().startswith(b"rate exceeded")
 
+    @classmethod
+    def _is_usable_406_feed(cls, response: requests.Response) -> bool:
+        """Only recover nonempty, well-formed arXiv results behind a bad status.
+
+        feedparser intentionally tolerates malformed XML and HTML, so parsing
+        alone is not enough. Empty feeds and arXiv API error entries cannot
+        establish that a 406 was a successful search.
+        """
+        try:
+            root = ElementTree.fromstring(response.content)
+            if root.tag != "{http://www.w3.org/2005/Atom}feed":
+                return False
+            feed = feedparser.parse(response.content)
+            if feed.bozo or feed.version != "atom10" or not feed.entries:
+                return False
+            if not re.fullmatch(
+                r"https?://arxiv\.org/api/[^\s]+", feed.feed.get("id", "")
+            ):
+                return False
+            total = int(feed.feed.get("opensearch_totalresults", "0"))
+            if total < len(feed.entries):
+                return False
+            for entry in feed.entries:
+                if not re.fullmatch(
+                    r"https?://arxiv\.org/abs/(?:[0-9]{4}\.[0-9]{4,5}|"
+                    r"[a-z-]+(?:\.[A-Z]{2})?/[0-9]{7})(?:v[0-9]+)?",
+                    entry.get("id", ""),
+                ):
+                    return False
+                if not all(entry.get(field, "").strip() for field in ("title", "summary")):
+                    return False
+                if not entry.get("authors") or not entry.get("tags"):
+                    return False
+                # Verify every entry can actually be consumed, rather than
+                # accepting a feed whose entries search() would silently skip.
+                cls._paper_from_entry(entry)
+            return True
+        except (ElementTree.ParseError, ValueError, TypeError, AttributeError, KeyError):
+            return False
+
     def _request_with_retries(self, params):
         """Issue one serialized, paced arXiv request sequence."""
         response = None
+        saw_unusable_406 = False
         with self._request_lock:
             for attempt in range(self.MAX_ATTEMPTS):
                 self._pace_locked()
@@ -89,6 +131,14 @@ def _request_with_retries(self, params):
                         f"across {self.MAX_ATTEMPTS} attempts"
                     )
 
+                if response.status_code == 406:
+                    if self._is_usable_406_feed(response):
+                        return response
+                    saw_unusable_406 = True
+                    if attempt < self.MAX_ATTEMPTS - 1:
+                        time.sleep((attempt + 1) * 1.5)
+                    continue
+
                 if response.status_code in self.RETRYABLE_STATUS_CODES:
                     if attempt < self.MAX_ATTEMPTS - 1:
                         time.sleep((attempt + 1) * 1.5)
@@ -98,7 +148,12 @@ def _request_with_retries(self, params):
                             "arxiv rate-limited: HTTP 429 persisted "
                             f"across {self.MAX_ATTEMPTS} attempts"
                         )
-                return response
+                break
+        if saw_unusable_406:
+            raise requests.RequestException(
+                "arxiv search failed: HTTP 406 without a usable arXiv Atom feed; "
+                f"no successful response within {self.MAX_ATTEMPTS} attempts"
+            )
         return response
 
     @staticmethod
@@ -124,42 +179,46 @@ def search(self, query: str, max_results: int = 10, sort_by: str = 'relevance',
         }
         response = self._request_with_retries(params)
 
-        if response is None or response.status_code != 200:
+        if response is None or response.status_code not in (200, 406):
             return []
 
         feed = feedparser.parse(response.content)
         papers = []
         for entry in feed.entries:
             try:
-                authors = [author.name for author in entry.authors]
-                published = datetime.strptime(entry.published, '%Y-%m-%dT%H:%M:%SZ')
-                updated = datetime.strptime(entry.updated, '%Y-%m-%dT%H:%M:%SZ')
-                pdf_url = next((link.href for link in entry.links if link.type == 'application/pdf'), '')
-                
-                # Try to extract DOI from entry.doi or links or summary
-                doi = entry.get('doi', '') or extract_doi(entry.summary) or extract_doi(entry.id)
-                for link in entry.links:
-                    if link.get('title') == 'doi':
-                        doi = doi or ext
```

**File**: `tests/test_arxiv_406.py` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+"""Deterministic coverage of anomalous arXiv HTTP 406 responses (#121)."""
+import asyncio
+from unittest.mock import Mock, patch
+
+import pytest
+import requests
+
+from paper_search_mcp import server
+from paper_search_mcp.academic_platforms.arxiv import ArxivSearcher
+from tests.test_arxiv import EMPTY_ATOM_FEED, response_with
+
+
+ARXIV_FEED = b'''<?xml version="1.0" encoding="UTF-8"?>
+<feed xmlns="http://www.w3.org/2005/Atom"
+      xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
+  <id>http://arxiv.org/api/test-query</id>
+  <title>ArXiv Query</title>
+  <updated>2026-09-24T00:00:00Z</updated>
+  <opensearch:totalResults>1</opensearch:totalResults>
+  <opensearch:startIndex>0</opensearch:startIndex>
+  <opensearch:itemsPerPage>1</opensearch:itemsPerPage>
+  <entry>
+    <id>http://arxiv.org/abs/2401.12345v1</id>
+    <title>Machine unlearning</title>
+    <summary>A paper about machine unlearning.</summary>
+    <published>2024-01-24T10:00:00Z</published>
+    <updated>2024-01-24T10:00:00Z</updated>
+    <author><name>Example Author</name></author>
+    <link href="http://arxiv.org/abs/2401.12345v1" type="text/html"/>
+    <link href="http://arxiv.org/pdf/2401.12345v1" type="application/pdf"/>
+    <category term="cs.LG"/>
+  </entry>
+</feed>'''
+
+
+@pytest.fixture
+def paced_searcher():
+    searcher = ArxivSearcher()
+    with (
+        patch.object(ArxivSearcher, "_pace_locked") as pace,
+        patch("paper_search_mcp.academic_platforms.arxiv.time.sleep") as wait,
+    ):
+        yield searcher, pace, wait
+
+
+def test_valid_406_arxiv_feed_returns_papers_without_retry(paced_searcher):
+    searcher, pace, wait = paced_searcher
+    searcher.session.get = Mock(return_value=response_with(ARXIV_FEED, 406))
+
+    papers = searcher.search("machine unlearning")
+
+    assert len(papers) == 1
+    assert papers[0].paper_id == "2401.12345v1"
+    assert papers[0].authors == ["Example Author"]
+    assert papers[0].source == "arxiv"
+    assert papers[0].abstract == "A paper about machine unlearning."
+    pace.assert_called_once_with()
+    wait.assert_not_called()
+    assert searcher.session.get.call_args.kwargs["timeout"] == 30
+
+
+@pytest.mark.parametrize("body", [
+    b"",
+    b"<html><body>Not Acceptable</body></html>",
+    b"Rate exceeded.",
+    EMPTY_ATOM_FEED,
+    ARXIV_FEED.replace(b"<opensearch:totalResults>1", b"<opensearch:totalResults>0"),
+    ARXIV_FEED.replace(b"</feed>", b""),
+    ARXIV_FEED.replace(b"http://www.w3.org/2005/Atom", b"urn:other"),
+    ARXIV_FEED.replace(b"http://arxiv.org/api/", b"http://example.org/api/"),
+    ARXIV_FEED.replace(b"http://arxiv.org/abs/2401.12345v1", b"http://arxiv.org/api/errors#bad_query"),
+    ARXIV_FEED.replace(b"http://arxiv.org/abs/", b"http://arxiv.org.evil.example/abs/"),
+    ARXIV_FEED.replace(b"2024-01-24T10:00:00Z", b"bad-date"),
+    ARXIV_FEED.replace(b"<author><name>Example Author</name></author>", b""),
+], ids=["empty-body", "html", "soft-limit", "empty-feed", "zero-total", "truncated",
+        "wrong-namespace", "unrelated-feed", "api-error", "wrong-host", "invalid-entry", "no-authors"])
+def test_unusable_406_retries_then_raises(body, paced_searcher):
+    searcher, pace, wait = paced_searcher
+    searcher.session.get = Mock(return_value=response_with(body, 406))
+
+    with pytest.raises(requests.RequestException, match="HTTP 406.*usable arXiv Atom"):
+        searcher.search("test")
+
+    assert searcher.session.get.call_count == ArxivSearcher.MAX_ATTEMPTS
+    assert pace.call_count == ArxivSearcher.MAX_ATTEMPTS
+    assert [call.args for call in wait.call_args_list] == [(1.5,), (3.0,)]
+
+
+@pytest.mark.parametrize("body,status,expected", [
+    (ARXIV_FEED, 200, 1),
+    (ARXIV_FEED, 406, 1),
+    (EMPTY_ATOM_FEED, 200, 0),
+])
+def test_unusable_406_can_recover(body, status, expected, paced_searcher):
+    searcher, pace, wait = paced_searcher
+    searcher.session.get = Mock(side_effect=[response_with(b"", 406), response_with(body, status)])
+
+    assert len(searcher.search("test")) == expected
+    assert pace.call_count == 2
+    wait.assert_called_once_with(1.5)
+
+
+@pytest.mark.parametrize("last_response", [requests.ConnectionError("offline"), response_with(b"", 503)])
+def test_406_followed_by_failures_cannot_become_false_zero(last_response, paced_searcher):
+    searcher, _, _ = paced_searcher
+    searcher.session.get = Mock(side_effect=[response_with(b"", 406), last_response, last_response])
+    with pytest.raises(requests.RequestException, match="HTTP 406"):
+        searcher.search("test")
+    assert searcher.session.get.call_count == 3
+
+
+def test_normal_200_empty_feed_is_still_successful(paced_searcher):
+    searcher, pace, wait = paced_searcher
+    searcher.session.get = Mock(return_value=response_with(EMPTY_ATOM_FEED))
+    assert searcher.search("test") == []
+    pace.assert_called_once_with()
+    wait.assert_not_called()
+
+
+@pytest.mark.parametrize("stat
```

---

### Incident Patch 13: `7be561fa` (2026-09-22)
**Commit Message**: fix(mcp): correct tool side-effect annotations

**File**: `paper_search_mcp/server.py` (modified, +30/-30)
```diff
@@ -767,7 +767,7 @@ async def search_iacr(
     return [paper.to_dict() for paper in papers] if papers else []
 
 
-@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
 async def download_arxiv(paper_id: str, save_path: str = "./downloads") -> str:
     """Download PDF of an arXiv paper.
 
@@ -780,7 +780,7 @@ async def download_arxiv(paper_id: str, save_path: str = "./downloads") -> str:
     return await asyncio.to_thread(arxiv_searcher.download_pdf, paper_id, save_path)
 
 
-@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
 async def download_pubmed(paper_id: str, save_path: str = "./downloads") -> str:
     """Attempt to download PDF of a PubMed paper.
 
@@ -796,7 +796,7 @@ async def download_pubmed(paper_id: str, save_path: str = "./downloads") -> str:
         return str(e)
 
 
-@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
 async def download_biorxiv(paper_id: str, save_path: str = "./downloads") -> str:
     """Download PDF of a bioRxiv paper.
 
@@ -809,7 +809,7 @@ async def download_biorxiv(paper_id: str, save_path: str = "./downloads") -> str
     return biorxiv_searcher.download_pdf(paper_id, save_path)
 
 
-@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
 async def download_medrxiv(paper_id: str, save_path: str = "./downloads") -> str:
     """Download PDF of a medRxiv paper.
 
@@ -822,7 +822,7 @@ async def download_medrxiv(paper_id: str, save_path: str = "./downloads") -> str
     return medrxiv_searcher.download_pdf(paper_id, save_path)
 
 
-@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
 async def download_iacr(paper_id: str, save_path: str = "./downloads") -> str:
     """Download PDF of an IACR ePrint paper.
 
@@ -835,7 +835,7 @@ async def download_iacr(paper_id: str, save_path: str = "./downloads") -> str:
     return iacr_searcher.download_pdf(paper_id, save_path)
 
 
-@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
 async def read_arxiv_paper(paper_id: str, save_path: str = "./downloads") -> str:
     """Read and extract text content from an arXiv paper PDF.
 
@@ -865,7 +865,7 @@ async def read_pubmed_paper(paper_id: str, save_path: str = "./downloads") -> st
     return pubmed_searcher.read_paper(paper_id, save_path)
 
 
-@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
 async def read_biorxiv_paper(paper_id: str, save_path: str = "./downloads") -> str:
     """Read and extract text content from a bioRxiv paper PDF.
 
@@ -882,7 +882,7 @@ async def read_biorxiv_paper(paper_id: str, save_path: str = "./downloads") -> s
         return ""
 
 
-@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
 async def read_medrxiv_paper(paper_id: str, save_path: str = "./downloads") -> str:
     """Read and extract text content from a medRxiv paper PDF.
 
@@ -899,7 +899,7 @@ async def read_medrxiv_paper(paper_id: str, save_path: str = "./downloads") -> s
         return ""
 
 
-@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
 async def read_iacr_paper(paper_id: str, save_path: str = "./downloads") -> str:
     """Read and extract text content from an IACR ePrint paper PDF.
 
@@ -934,7 +934,7 @@ async def search_semantic(query: str, year: str = "", max_results: int = 10) ->
     return papers if papers else []
 
 
-@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
 async def download_semantic(paper_id: str, save_path: str = "./downloads") -> str:
     """Download PDF of a Semantic Scholar paper.    
 
@@ -955,7 +955,7 @@ async def download_semantic(paper_id: str, save_path: str = "./downloads") -> st
     return semantic_searcher.download_pdf(paper_id, save_path)
 
 
-@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
+@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, 
```

**File**: `tests/test_tool_schema_compat.py` (modified, +136/-0)
```diff
@@ -1,4 +1,8 @@
 import asyncio
+import json
+import os
+import subprocess
+import sys
 from unittest.mock import AsyncMock, patch
 
 from paper_search_mcp import server
@@ -27,6 +31,138 @@ def test_tool_input_schemas_do_not_expose_nullable_unions():
     assert nullable_tools == []
 
 
+def test_all_tools_declare_open_world_annotations():
+    tools = asyncio.run(server.mcp.list_tools())
+
+    missing = [
+        tool.name
+        for tool in tools
+        if tool.annotations is None or tool.annotations.openWorldHint is not True
+    ]
+
+    assert missing == []
+
+
+def test_search_and_lookup_tools_are_annotated_read_only():
+    tools = asyncio.run(server.mcp.list_tools())
+    read_only_tools = [
+        tool
+        for tool in tools
+        if tool.name.startswith(("search_", "get_"))
+    ]
+
+    assert read_only_tools
+    assert [
+        tool.name
+        for tool in read_only_tools
+        if tool.annotations is None or tool.annotations.readOnlyHint is not True
+    ] == []
+
+
+def test_file_writing_tools_disclose_destructive_local_updates():
+    tools = asyncio.run(server.mcp.list_tools())
+    side_effecting_read_tools = {
+        "read_arxiv_paper",
+        "read_biorxiv_paper",
+        "read_citeseerx_paper",
+        "read_doaj_paper",
+        "read_hal_paper",
+        "read_iacr_paper",
+        "read_medrxiv_paper",
+        "read_semantic_paper",
+        "read_ssrn_paper",
+        "read_zenodo_paper",
+    }
+    tool_names = {tool.name for tool in tools}
+    file_tools = [
+        tool
+        for tool in tools
+        if tool.name.startswith("download_")
+        or tool.name in side_effecting_read_tools
+    ]
+
+    assert side_effecting_read_tools <= tool_names
+    assert file_tools
+    assert [
+        tool.name
+        for tool in file_tools
+        if tool.annotations is None
+        or tool.annotations.readOnlyHint is not False
+        or tool.annotations.destructiveHint is not True
+    ] == []
+
+
+def test_non_writing_read_tools_are_annotated_read_only():
+    tools = asyncio.run(server.mcp.list_tools())
+    read_only_read_tools = [
+        tool
+        for tool in tools
+        if tool.name.startswith("read_")
+        and tool.annotations is not None
+        and tool.annotations.readOnlyHint is True
+    ]
+
+    assert {tool.name for tool in read_only_read_tools} == {
+        "read_base_paper",
+        "read_crossref_paper",
+        "read_dblp_paper",
+        "read_openalex_paper",
+        "read_openaire_paper",
+        "read_pubmed_paper",
+    }
+
+
+def test_optional_ieee_and_acm_tools_publish_annotations():
+    env = os.environ.copy()
+    env.update(
+        {
+            "PAPER_SEARCH_MCP_IEEE_API_KEY": "test-key",
+            "PAPER_SEARCH_MCP_ACM_API_KEY": "test-key",
+        }
+    )
+    script = """
+import asyncio
+import json
+from paper_search_mcp import server
+
+names = {
+    "search_ieee", "download_ieee", "read_ieee_paper",
+    "search_acm", "download_acm", "read_acm_paper",
+}
+tools = asyncio.run(server.mcp.list_tools())
+print(json.dumps({
+    tool.name: tool.annotations.model_dump()
+    for tool in tools
+    if tool.name in names
+}))
+"""
+
+    completed = subprocess.run(
+        [sys.executable, "-c", script],
+        capture_output=True,
+        check=True,
+        env=env,
+        text=True,
+    )
+    annotations = json.loads(completed.stdout.strip().splitlines()[-1])
+
+    assert set(annotations) == {
+        "search_ieee",
+        "download_ieee",
+        "read_ieee_paper",
+        "search_acm",
+        "download_acm",
+        "read_acm_paper",
+    }
+    for name in ("search_ieee", "read_ieee_paper", "search_acm", "read_acm_paper"):
+        assert annotations[name]["readOnlyHint"] is True
+        assert annotations[name]["openWorldHint"] is True
+    for name in ("download_ieee", "download_acm"):
+        assert annotations[name]["readOnlyHint"] is False
+        assert annotations[name]["destructiveHint"] is True
+        assert annotations[name]["openWorldHint"] is True
+
+
 def test_empty_string_preserves_optional_semantic_year_behavior():
     with patch.object(server, "async_search", new=AsyncMock(return_value=[])) as search:
         asyncio.run(server.search_semantic("test", year="", max_results=3))
```

---

### Incident Patch 14: `7957991e` (2026-09-22)
**Commit Message**: fix(arxiv): serialize rate-limited requests

**File**: `paper_search_mcp/academic_platforms/arxiv.py` (modified, +66/-44)
```diff
@@ -3,6 +3,7 @@
 import re
 import time
 from datetime import datetime
+from threading import Lock
 from typing import List
 
 import feedparser
@@ -18,14 +19,17 @@ class ArxivSearcher(PaperSource):
     """Searcher for arXiv papers.
 
     arXiv TOU requires no more than 1 request per 3 seconds with a single
-    concurrent connection (https://info.arxiv.org/help/api/tou.html). We
-    enforce this with an instance-level last-call timestamp; bulk runs from
-    saturate.py serialize correctly because they reuse the same searcher.
-    Cross-process pacing is the user's responsibility (don't run two saturates
-    in parallel).
+    concurrent connection (https://info.arxiv.org/help/api/tou.html). A shared
+    lock and timestamp enforce that policy across all instances in this Python
+    process. Cross-process and cross-machine pacing remain the caller's
+    responsibility.
     """
     BASE_URL = "https://export.arxiv.org/api/query"
     MIN_INTERVAL_SEC = 3.0  # arXiv TOU minimum
+    MAX_ATTEMPTS = 3
+    RETRYABLE_STATUS_CODES = frozenset((429, 500, 502, 503, 504))
+    _request_lock = Lock()
+    _last_request_at = 0.0
     _FIELD_PREFIX_RE = re.compile(
         r"(?:^|\s)(ti|au|abs|co|jr|cat|rn|id|all):",
         re.IGNORECASE,
@@ -38,15 +42,64 @@ def __init__(self):
             'User-Agent': 'paper-search-mcp/1.0 (mailto:openags@example.com)',
             'Accept': 'application/atom+xml, application/xml;q=0.9, */*;q=0.8',
         })
-        self._last_call_at = 0.0  # monotonic seconds; 0 = never
 
-    def _pace(self):
-        """Sleep just long enough to respect the arXiv TOU rate-limit."""
+    @classmethod
+    def _pace_locked(cls):
+        """Pace a request while the process-wide request lock is held."""
         now = time.monotonic()
-        elapsed = now - self._last_call_at
-        if self._last_call_at > 0 and elapsed < self.MIN_INTERVAL_SEC:
-            time.sleep(self.MIN_INTERVAL_SEC - elapsed)
-        self._last_call_at = time.monotonic()
+        elapsed = now - cls._last_request_at
+        if cls._last_request_at > 0 and elapsed < cls.MIN_INTERVAL_SEC:
+            time.sleep(cls.MIN_INTERVAL_SEC - elapsed)
+        cls._last_request_at = time.monotonic()
+
+    @staticmethod
+    def _is_soft_rate_limit(response: requests.Response) -> bool:
+        """Detect arXiv's HTTP-200 ``Rate exceeded.`` response."""
+        body_head = (response.content or b"")[:64]
+        if isinstance(body_head, str):
+            body_head = body_head.encode("utf-8", errors="ignore")
+        return body_head.strip().lower().startswith(b"rate exceeded")
+
+    def _request_with_retries(self, params):
+        """Issue one serialized, paced arXiv request sequence."""
+        response = None
+        with self._request_lock:
+            for attempt in range(self.MAX_ATTEMPTS):
+                self._pace_locked()
+                try:
+                    response = self.session.get(
+                        self.BASE_URL,
+                        params=params,
+                        timeout=30,
+                    )
+                except requests.RequestException:
+                    response = None
+                    if attempt < self.MAX_ATTEMPTS - 1:
+                        time.sleep((attempt + 1) * 1.5)
+                    continue
+
+                if response.status_code == 200:
+                    if not self._is_soft_rate_limit(response):
+                        return response
+                    if attempt < self.MAX_ATTEMPTS - 1:
+                        time.sleep((attempt + 1) * 5.0)
+                        continue
+                    raise requests.RequestException(
+                        "arxiv rate-limited: 'Rate exceeded.' body persisted "
+                        f"across {self.MAX_ATTEMPTS} attempts"
+                    )
+
+                if response.status_code in self.RETRYABLE_STATUS_CODES:
+                    if attempt < self.MAX_ATTEMPTS - 1:
+                        time.sleep((attempt + 1) * 1.5)
+                        continue
+                    if response.status_code == 429:
+                        raise requests.RequestException(
+                            "arxiv rate-limited: HTTP 429 persisted "
+                            f"across {self.MAX_ATTEMPTS} attempts"
+                        )
+                return response
+        return response
 
     @staticmethod
     def _build_search_query(query: str) -> str:
@@ -69,41 +122,10 @@ def search(self, query: str, max_results: int = 10, sort_by: str = 'relevance',
             'sortBy': sort_by,
             'sortOrder': sort_order,
         }
-        response = None
-        for attempt in range(3):
-            self._pace()
-            try:
-                response = self.session.get(self.BASE_URL, params=params, timeout=30)
-            except requests.RequestException:
-                time.sleep((attempt + 1) * 1.5)
-                continue
-            if respon
```

**File**: `tests/test_arxiv.py` (modified, +159/-0)
```diff
@@ -1,7 +1,166 @@
 # tests/test_arxiv.py
 import unittest
+from concurrent.futures import ThreadPoolExecutor
+from threading import Lock
+from time import sleep
+from unittest.mock import Mock, patch
+
+import requests
+
 from paper_search_mcp.academic_platforms.arxiv import ArxivSearcher
 
+
+EMPTY_ATOM_FEED = b"""<?xml version="1.0" encoding="UTF-8"?>
+<feed xmlns="http://www.w3.org/2005/Atom"></feed>
+"""
+
+
+def response_with(content: bytes, status_code: int = 200):
+    response = Mock(spec=requests.Response)
+    response.content = content
+    response.status_code = status_code
+    return response
+
+
+class TestArxivRateLimiting(unittest.TestCase):
+    def setUp(self):
+        ArxivSearcher._last_request_at = 0.0
+
+    def tearDown(self):
+        ArxivSearcher._last_request_at = 0.0
+
+    def test_soft_rate_limit_retries_then_succeeds(self):
+        searcher = ArxivSearcher()
+        searcher.session.get = Mock(side_effect=[
+            response_with(b"  Rate exceeded.\n"),
+            response_with(EMPTY_ATOM_FEED),
+        ])
+
+        with (
+            patch.object(ArxivSearcher, "_pace_locked") as pace,
+            patch("paper_search_mcp.academic_platforms.arxiv.time.sleep") as wait,
+        ):
+            self.assertEqual(searcher.search("test"), [])
+
+        self.assertEqual(searcher.session.get.call_count, 2)
+        self.assertEqual(pace.call_count, 2)
+        wait.assert_called_once_with(5.0)
+
+    def test_persistent_soft_rate_limit_raises_without_final_sleep(self):
+        searcher = ArxivSearcher()
+        searcher.session.get = Mock(
+            side_effect=[response_with(b"Rate exceeded.")] * 3
+        )
+
+        with (
+            patch.object(ArxivSearcher, "_pace_locked"),
+            patch("paper_search_mcp.academic_platforms.arxiv.time.sleep") as wait,
+            self.assertRaisesRegex(requests.RequestException, "Rate exceeded"),
+        ):
+            searcher.search("test")
+
+        self.assertEqual(
+            [call.args for call in wait.call_args_list],
+            [(5.0,), (10.0,)],
+        )
+
+    def test_http_429_retry_exhaustion_raises(self):
+        searcher = ArxivSearcher()
+        searcher.session.get = Mock(
+            side_effect=[response_with(b"", status_code=429)] * 3
+        )
+
+        with (
+            patch.object(ArxivSearcher, "_pace_locked"),
+            patch("paper_search_mcp.academic_platforms.arxiv.time.sleep") as wait,
+            self.assertRaisesRegex(requests.RequestException, "HTTP 429"),
+        ):
+            searcher.search("test")
+
+        self.assertEqual(
+            [call.args for call in wait.call_args_list],
+            [(1.5,), (3.0,)],
+        )
+
+    def test_network_failure_keeps_existing_empty_result_behavior(self):
+        searcher = ArxivSearcher()
+        searcher.session.get = Mock(
+            side_effect=requests.ConnectionError("offline")
+        )
+
+        with (
+            patch.object(ArxivSearcher, "_pace_locked"),
+            patch("paper_search_mcp.academic_platforms.arxiv.time.sleep") as wait,
+        ):
+            self.assertEqual(searcher.search("test"), [])
+
+        self.assertEqual(searcher.session.get.call_count, 3)
+        self.assertEqual(
+            [call.args for call in wait.call_args_list],
+            [(1.5,), (3.0,)],
+        )
+
+    def test_soft_limit_detection_does_not_decode_response_text(self):
+        class ContentOnlyResponse:
+            content = b"Rate exceeded. Please try again later."
+
+            @property
+            def text(self):
+                raise AssertionError("response.text must not be accessed")
+
+        self.assertTrue(ArxivSearcher._is_soft_rate_limit(ContentOnlyResponse()))
+
+    def test_pacing_uses_shared_timestamp(self):
+        ArxivSearcher._last_request_at = 10.0
+
+        with (
+            patch(
+                "paper_search_mcp.academic_platforms.arxiv.time.monotonic",
+                side_effect=[11.0, 13.0],
+            ),
+            patch("paper_search_mcp.academic_platforms.arxiv.time.sleep") as wait,
+        ):
+            ArxivSearcher._pace_locked()
+
+        wait.assert_called_once_with(2.0)
+        self.assertEqual(ArxivSearcher._last_request_at, 13.0)
+
+    def test_requests_from_different_instances_are_serialized(self):
+        state_lock = Lock()
+        active_requests = 0
+        maximum_active_requests = 0
+
+        def get_response(*args, **kwargs):
+            nonlocal active_requests, maximum_active_requests
+            with state_lock:
+                active_requests += 1
+                maximum_active_requests = max(
+                    maximum_active_requests,
+                    active_requests,
+                )
+            sleep(0.05)
+            with state_lock:
+                active_requests -= 1
+            return response_with(EMPTY_ATOM_FEED)
+
+        first = ArxivSearcher()
+        second = ArxivSearcher()
+        first
```

---

### Incident Patch 15: `a5a07f3d` (2026-09-21)
**Commit Message**: fix: validate OpenAlex filter passthrough

**File**: `paper_search_mcp/academic_platforms/openalex.py` (modified, +13/-7)
```diff
@@ -1,4 +1,4 @@
-from typing import Any, List, Optional
+from typing import List
 from datetime import datetime
 import requests
 import logging
@@ -40,14 +40,19 @@ def _reconstruct_abstract(self, inverted_index: dict) -> str:
             logger.warning(f"Error reconstructing OpenAlex abstract: {e}")
             return ""
 
-    def search(self, query: str, max_results: int = 10, **kwargs: Any) -> List[Paper]:
+    def search(
+        self,
+        query: str,
+        max_results: int = 10,
+        filter: str = "",
+    ) -> List[Paper]:
         """
         Search OpenAlex works. Uses the 'search' filter.
 
         Args:
             query: Search query string
-            max_results: Maximum results to return (natively max 200 per page)
-            **kwargs: Additional OpenAlex parameters like `filter`.
+            max_results: Maximum results to return (natively max 100 per page)
+            filter: Optional OpenAlex works filter expression.
 
         Returns:
             List[Paper]: List of found papers with metadata.
@@ -57,10 +62,11 @@ def search(self, query: str, max_results: int = 10, **kwargs: Any) -> List[Paper
         try:
             params = {
                 "search": query,
-                "per_page": min(max_results, 200),
+                "per_page": min(max_results, 100),
             }
-            if "filter" in kwargs:
-                params["filter"] = kwargs["filter"]
+            filter_value = (filter or "").strip()
+            if filter_value:
+                params["filter"] = filter_value
 
             response = self.session.get(self.BASE_URL, params=params, timeout=30)
             
```

**File**: `paper_search_mcp/server.py` (modified, +6/-5)
```diff
@@ -1209,7 +1209,7 @@ async def read_crossref_paper(paper_id: str, save_path: str = "./downloads") ->
 async def search_openalex(
     query: str,
     max_results: int = 10,
-    filter: Optional[str] = None,
+    filter: str = "",
 ) -> List[Dict]:
     """Search academic papers from OpenAlex.
 
@@ -1218,15 +1218,16 @@ async def search_openalex(
         max_results: Maximum number of papers to return (default: 10).
         filter: OpenAlex filter string.
             Examples:
-            - 'is_oa:true,from_publication_date:2024-01-01'
-            - 'has_pdf_url:true,publication_year:2024'
+            - 'open_access.is_oa:true,from_publication_date:2024-01-01'
+            - 'publication_year:2024,type:article'
             - 'primary_location.source.id:S137773608' for Nature
-            See https://docs.openalex.org/api-entities/works/filter-works
+            See https://help.openalex.org/api/filtering/
             for the full list of supported work filters.
     Returns:
         List of paper metadata in dictionary format.
     """
-    extra = {k: v for k, v in {"filter": filter}.items() if v is not None}
+    filter_value = (filter or "").strip()
+    extra = {"filter": filter_value} if filter_value else {}
     papers = await async_search(openalex_searcher, query, max_results, **extra)
     return papers if papers else []
 
```

**File**: `tests/test_openalex.py` (modified, +121/-32)
```diff
@@ -1,51 +1,140 @@
+import asyncio
 import unittest
+from unittest.mock import AsyncMock, Mock, patch
 
-import requests
-
+from paper_search_mcp import server
 from paper_search_mcp.academic_platforms.openalex import OpenAlexSearcher
 
 
-def check_api_accessible() -> bool:
-    """Check whether the OpenAlex API is reachable."""
-    try:
-        response = requests.get("https://api.openalex.org/works?per_page=1", timeout=5)
-        return response.status_code == 200
-    except requests.RequestException:
-        return False
-
-
 class TestOpenAlexSearcher(unittest.TestCase):
-    @classmethod
-    def setUpClass(cls):
-        cls.api_accessible = check_api_accessible()
-        if not cls.api_accessible:
-            print("\nWarning: OpenAlex API is not accessible, some tests will be skipped")
-
     def setUp(self):
         self.searcher = OpenAlexSearcher()
 
-    def test_search(self):
-        if not self.api_accessible:
-            self.skipTest("OpenAlex API is not accessible")
+    @staticmethod
+    def _response(results=None, status_code=200):
+        response = Mock(status_code=status_code)
+        response.json.return_value = {"results": results or []}
+        return response
 
-        papers = self.searcher.search("machine learning", max_results=5)
-        self.assertGreater(len(papers), 0)
-        self.assertTrue(papers[0].title)
-
-    def test_search_with_filter(self):
-        if not self.api_accessible:
-            self.skipTest("OpenAlex API is not accessible")
+    def test_search_passes_filter_and_uses_supported_page_limit(self):
+        response = self._response()
+        self.searcher.session.get = Mock(return_value=response)
 
         papers = self.searcher.search(
             "artificial intelligence",
-            max_results=3,
-            filter="is_oa:true,has_pdf_url:true",
+            max_results=250,
+            filter=" publication_year:2024,open_access.is_oa:true ",
+        )
+
+        self.assertEqual(papers, [])
+        self.searcher.session.get.assert_called_once_with(
+            self.searcher.BASE_URL,
+            params={
+                "search": "artificial intelligence",
+                "per_page": 100,
+                "filter": "publication_year:2024,open_access.is_oa:true",
+            },
+            timeout=30,
+        )
+
+    def test_search_omits_empty_filter(self):
+        response = self._response()
+        self.searcher.session.get = Mock(return_value=response)
+
+        self.searcher.search("machine learning", max_results=5, filter="  ")
+
+        request_params = self.searcher.session.get.call_args.kwargs["params"]
+        self.assertEqual(
+            request_params,
+            {"search": "machine learning", "per_page": 5},
+        )
+
+    def test_search_parses_filtered_result(self):
+        response = self._response(
+            [
+                {
+                    "id": "https://openalex.org/W123",
+                    "title": "A filtered paper",
+                    "authorships": [
+                        {"author": {"display_name": "Ada Lovelace"}}
+                    ],
+                    "abstract_inverted_index": {
+                        "Filtered": [0],
+                        "abstract": [1],
+                    },
+                    "doi": "https://doi.org/10.1000/example",
+                    "primary_location": {
+                        "landing_page_url": "https://example.org/paper",
+                        "pdf_url": "https://example.org/paper.pdf",
+                    },
+                    "open_access": {"is_oa": True},
+                    "publication_date": "2024-02-03",
+                    "concepts": [{"display_name": "Computer science"}],
+                    "cited_by_count": 7,
+                }
+            ]
+        )
+        self.searcher.session.get = Mock(return_value=response)
+
+        papers = self.searcher.search(
+            "filtered",
+            filter="publication_year:2024",
+        )
+
+        self.assertEqual(len(papers), 1)
+        paper = papers[0]
+        self.assertEqual(paper.paper_id, "W123")
+        self.assertEqual(paper.title, "A filtered paper")
+        self.assertEqual(paper.authors, ["Ada Lovelace"])
+        self.assertEqual(paper.abstract, "Filtered abstract")
+        self.assertEqual(paper.doi, "10.1000/example")
+        self.assertEqual(paper.published_date.year, 2024)
+        self.assertEqual(paper.citations, 7)
+
+    def test_non_success_response_returns_no_results(self):
+        self.searcher.session.get = Mock(return_value=self._response(status_code=429))
+
+        self.assertEqual(
+            self.searcher.search("machine learning", filter="publication_year:2024"),
+            [],
         )
-        self.assertGreaterEqual(len(papers), 0)
 
     def test_user_agent_header(self):
-        self.assertIn("paper-search-mcp", self.searcher.session.headers.get("User-Agent", ""))
-        self.assertIn("mail
```

#### Recent Merged Pull Requests:
- **PR #148** (2026-10-02): feat(cli): add opt-in source search deadlines (@universea)
- **PR #147** (2026-10-02): fix(arxiv): validate downloads before replacement and surface read errors (@universea)
- **PR #146** (2026-10-02): fix(cli): reject unsuccessful PDF download results (@universea)
- **PR #145** (2026-10-02): feat: add resource-limited local PDF section extraction (@universea)
- **PR #144** (2026-10-02): fix: respect Scholar session cooldown and report timeouts honestly (@universea)
- **PR #143** (2026-10-02): feat: integrate approved paper-search improvements with regression coverage (@universea)
- **PR #142** (2026-10-02): feat: verify DSH integration and standalone skill packaging (@universea)
- **PR #141** (2026-10-02): feat(auth): add opt-in OAuth protected-resource mode (@universea)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
