# Forensic Learning Record (Deep Inspection): openags/paper-search-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/openags-paper-search-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openags/paper-search-mcp](https://github.com/openags/paper-search-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:42:34.723Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openags/paper-search-mcp`
- **Description**: MCP, CLI, Skills for searching and downloading academic papers from multiple sources like arXiv, PubMed, bioRxiv, etc.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2724 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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
import os
import re
import time
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
                print(f"Error parsing arXiv entry: {e}")
        return papers

    @staticmethod
    def _paper_from_entry(entry) -> Paper:
        authors = [author.name for author in entry.authors]
        published = datetime.strptime(entry.published, '%Y-%m-%dT%H:%M:%SZ')
        updated = datetime.strptime(entry.updated, '%Y-%m-%dT%H
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
            Extract
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
                print(f"Attempt {tries} failed, retrying...")

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
            reader
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
- **Issue #128** (2026-09-30): **feat: enable keyless ACM search with validated DOI and safe tool metadata**
  *Symptoms*: ## Summary Build on #123's keyless ACM search, with a focused hardening follow-up: - Mark PDF-reading tools accurately as file-writing operations - Run blocking ACM reads off the event loop - Reject non-ACM DOI lookups - Update README, environment example and CLI skill for keyless ACM  ## Validation 76 targeted tests and 3 subtests passed. The combined maintenance set passed 169 deterministic tests and 8 subtests on Python 3.12, with socket connections disabled. Wheel/sdist build and installed-wheel smoke checks passed. No live publisher-download claim.  ## Attribution This branch directly descends from original #123 commit 889e1b5d41b7d3eea232cea9f362053f90d587fa, preserving ChrisPrapas's original history. The follow-up commit also includes the verified Co-authored-by trailer for ChrisPrapas. Please retain that trailer in any squash message.  Source: https://github.com/openags/paper-search-mcp/pull/123  Do not close #123 as superseded until this replacement is merged and contributor credit is verified on main.

- **Issue #127** (2026-09-30): **docs: clarify HTTP authorization and skill ZIP packaging**
  *Symptoms*: ## Summary - Correct the stale stdio-only description: SSE and streamable HTTP are supported, native OAuth protected-resource support is not - Explain standalone skill ZIP layout using current official documentation - Distinguish packaging from runtime capabilities and MCP connection setup  Related: #25, #66. This does not implement native OAuth or establish Claude web runtime compatibility.  ## Validation A deterministic test executes the exact packaging example and checks archive layout/content. unittest and diff checks passed. No live uploader validation.  ## Attribution Thanks to the reporters of #25 and #66. No external implementation copied.

- **Issue #126** (2026-09-30): **feat(cli): sort retrieved papers by citations or date**
  *Symptoms*: ## Summary - Add --sort citations/date/relevance while preserving existing defaults and source queries - Stable sorting after deduplication; tolerate missing citation/date metadata - Document that sorting applies only to retrieved results  Addresses the sorting request in #67.  ## Validation 61 deterministic tests passed, including 13 new CLI tests. compileall and diff checks passed. Live-network tests are separate.  ## Remaining scope JSON is already the default; no --json flag is introduced. Provider diagnostics printed to stdout remain a separate follow-up and are not claimed fixed.  ## Attribution Thanks to the reporter of #67. No earlier PR code was incorporated.

- **Issue #125** (2026-09-30): **fix: recover valid arXiv 406 feeds and surface failed searches**
  *Symptoms*: ## Summary - Recover only strictly validated, nonempty arXiv Atom feeds returned with HTTP 406 - Retry unusable 406 responses with existing pacing, then surface an explicit failure instead of false zero results - Preserve network-only empty-result behavior and existing rate-limit contracts - Add deterministic regression coverage to the release test selection  Fixes #121.  ## Validation - 77 deterministic tests passed in the implementation checkout - Independent focused verification: 38 tests passed - compileall and diff checks passed - Intermittent live arXiv behavior was not reproduced; live-network validation is separate from mocked coverage  ## Attribution Thanks to @avvohacker for the detailed report in #121. Implementation and tests were written for this fix; no earlier PR code was copied.

- **Issue #124** (2026-09-30): **feat: add arXiv as an OA-repository fallback source**
  *Symptoms*: ## Summary - `download_with_fallback`'s repository-fallback chain (`openaire`, `core`, `europepmc`, `pmc`, tried in `_try_repository_fallback`) ran before Unpaywall and Sci-Hub, but never checked arXiv itself — even though an arXiv postprint is very often the free copy for a non-arXiv-sourced DOI, especially for ML/CS papers. - Adds `arxiv_searcher` to `_try_repository_fallback`'s `repository_searchers` list, first in the list since it is typically both the fastest and the most likely hit for papers in this population. - Reuses the existing title-similarity/DOI-match prefilter and PDF content verification unchanged, so a mismatched arXiv preprint is rejected the exact same way a mismatched OpenAIRE/CORE/EuropePMC/PMC candidate already is — no new identity-verification logic needed.  This is one of several independent micro-fixes found while building a downstream benchmark on top of this server; each is being proposed as its own focused PR per this repo's CONTRIBUTING.md guidance to keep changes scoped to one problem. (See #123 for the first one, an unrelated ACM connector fix.)  ## Test plan - [x] `pytest tests/test_fallback.py -v` — 29/29 pass, including a new `test_arxiv_is_tried_before_other_repositories` that asserts arXiv is queried first and, on a match, the other repositories are never reached - [x] Updated `TestRepositoryFallback`'s existing tests to patch `arxiv_searcher` to an empty stub — previously unpatched, so they would have hit the network on the real searcher

- **Issue #123** (2026-09-30): **feat: make ACM Digital Library search keyless via Crossref**
  *Symptoms*: ## Summary - ACM DL has been fully open access since 2026-01-01 and has no public search API, so `PAPER_SEARCH_MCP_ACM_API_KEY` (or legacy `ACM_API_KEY`) can never actually be set to a real value — the existing `acm.py` skeleton always raised `NotImplementedError`, making the source permanently dead. - Rewrites `ACMSearcher` on top of `CrossRefSearcher`, restricted to ACM's DOI prefix (`10.1145`), which covers every ACM-published work with full bibliographic metadata. No key required, so it's now registered unconditionally in `server.py` and `cli.py`, matching every other keyless source. - `download_pdf` still tries the direct `dl.acm.org/doi/pdf/<doi>` link, but `dl.acm.org` sits behind a Cloudflare browser challenge that blocks scripted clients; on a block it raises with the browser URL and a `download_with_fallback(source='acm', ...)` suggestion so callers can fall back to open repositories (arXiv, OpenAIRE, CORE, Unpaywall). - Updates `tests/test_tool_schema_compat.py`'s read-only-read-tools set to include `read_acm_paper`, since it's now always registered.  This is one of several independent micro-fixes found while building a downstream benchmark on top of this server; each is being proposed as its own focused PR per this repo's CONTRIBUTING.md guidance to keep changes scoped to one problem.  ## Test plan - [x] `pytest tests/test_acm.py -v` — 6/6 pass - [x] `pytest tests/test_tool_schema_compat.py tests/test_ieee.py tests/test_acm.py -q` with `IEEE_API_KEY`/`PAPER_SEARCH

- **Issue #121** (2026-09-30): **search_arxiv silently returns 0 results when the arXiv export API answers intermittent HTTP 406 — sometimes carrying a valid Atom feed in the body**
  *Symptoms*: Hi! Long-time user of the server — thanks for the excellent work. Reporting something we hit in real use, in the same spirit as #111 ("surfacing API failures instead of reporting false zero results"): under certain conditions the arXiv export API answers **HTTP 406**, the connector treats it like a normal end of search, and the user/agent sees **"0 results" with no error anywhere** — which reads as "this topic has no papers on arXiv".  ## What we observed (2026-09-24, two separate windows, CEST)  The 406 is **intermittent and not reproducible on demand**, so here is the evidence table from two capture windows on the same day/machine (macOS, residential network, no proxy, clean env; `main` at `808e462`). The raw captures behind this table are inlined below, verbatim:  | Probe | Window 1 (evening, ~22:47 CEST) | Window 2 (~23:20 CEST) | |---|---|---| | connector, via `search()` (its own session) | **406, 0 bytes** → `[]` | **406 ×3 in a row** (same venv, minutes after the probes below all passed) | | `requests` default headers | 406, 0 bytes | **200 ×6** (5250 bytes) | | `httpx` default | 406, 0 bytes | not captured | | `urllib` (minimal headers) | 200, 5250 bytes | 200 ×6 | | `curl` | 200, 5250 bytes | 200 ×3 |  The smoking gun from Window 1: when the 406 body was **not** empty, it was a **valid Atom feed** — 5250 bytes, `Content-Type: application/atom+xml`, 2 entries, `feedparser` bozo=False. The anomalous response's header block, as received (quoting the non-standard headers

- **Issue #120** (2026-09-22): **feat(mcp): publish accurate tool annotations**
  *Symptoms*: Supersedes #86 on current main while preserving the original annotation commit authored by @lemenkov (Peter Lemenkov).  Changes: - publish MCP ToolAnnotations for every core tool - mark search and lookup tools read-only and open-world - mark download tools as local-file-writing and potentially destructive because existing paths may be overwritten - distinguish read tools that may download/cache PDFs from read tools that only return metadata or unsupported messages - apply the same annotation rules to optional IEEE and ACM tools - add protocol-model tests for all 57 default tools and a fresh-process test for the six optional tools  This follows the MCP annotation semantics described at https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/.  Validation: - 9/9 tool schema and annotation tests passed - 15/15 server and transport tests passed, plus 5 subtests - real stdio MCP initialize + tools/list succeeded; the client received all 57 tools and the expected annotations - full suite reached 202 passed, 17 skipped, and 14 subtests passed; the remaining two failures were unrelated live/integration conditions (Semantic Scholar HTTP 429 and a pre-existing shared-download-directory cleanup assumption) - the MedRxiv cleanup failure passed when rerun from an isolated working directory - Python compileall passed

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

### Incident Patch 1: `260611ff` (2026-09-30)
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
 
@@ -240,6 +238,24 @@ Create `~/.config/paper-search-mcp/.
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
-            "ACM DL sear
```

---

### Incident Patch 2: `ed9af46e` (2026-09-30)
**Commit Message**: fix: harden keyless ACM search integration

Build directly on PR #123, retaining its original commit and contributor
history. Correct read tool write annotations, move blocking PDF reading
onto a worker thread, validate ACM DOI lookups, and update configuration
and skill documentation.

Validation: 76 targeted tests and 3 subtests passed; the combined repair
set passed 169 deterministic tests and 8 subtests on Python 3.12.

Source: https://github.com/openags/paper-search-mcp/pull/123

Co-authored-by: ChrisPrapas <chris.l.prapas@gmail.com>

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
 
@@ -284,8 +282,7 @@ curl -LsSf https://astral.sh/uv/insta
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

---

### Incident Patch 3: `63bf37d7` (2026-09-30)
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
         r
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
+    searcher.session.get = Mock(side_effect=[response_with
```

---

### Incident Patch 4: `7be561fa` (2026-09-22)
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
+@mcp.tool(annotations={"readOnlyH
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
+        assert annotations[name]["destru
```

---

### Incident Patch 5: `7957991e` (2026-09-22)
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
+           
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
+                side_effect
```

---

### Incident Patch 6: `a5a07f3d` (2026-09-21)
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
+            filter="publica
```

---

### Incident Patch 7: `1aae1611` (2026-09-21)
**Commit Message**: Merge pull request #93 from heliowap/fix/phantom-papers-fallback-validation

Validate fallback PDF identity and filter non-paper CrossRef artifacts

**File**: `paper_search_mcp/academic_platforms/crossref.py` (modified, +28/-5)
```diff
@@ -3,7 +3,6 @@
 from datetime import datetime
 import requests
 import time
-import random
 from ..paper import Paper
 from .base import PaperSource
 import logging
@@ -12,11 +11,24 @@
 
 class CrossRefSearcher(PaperSource):
     """Searcher for CrossRef database papers"""
-    
+
     BASE_URL = "https://api.crossref.org"
-    
+
     # User agent for polite API usage as per CrossRef etiquette
     USER_AGENT = "paper-search-mcp/0.1.3 (https://github.com/Dragonatorul/paper-search-mcp; mailto:paper-search@example.org)"
+
+    # Only filter types that unambiguously describe review artifacts or pieces
+    # of another work. Datasets, reports, and standards remain valid citable
+    # research outputs and must not be hidden by a generic paper search.
+    NON_PAPER_TYPES = frozenset(
+        {
+            "peer-review",
+            "peer-review-material",
+            "component",
+            "report-component",
+            "figure",
+        }
+    )
     
     def __init__(self):
         self.session = requests.Session()
@@ -90,8 +102,19 @@ def search(self, query: str, max_results: int = 10, **kwargs) -> List[Paper]:
             return []
     
     def _parse_crossref_item(self, item: Dict[str, Any]) -> Optional[Paper]:
-        """Parse a CrossRef API item into a Paper object."""
+        """Parse a CrossRef API item into a Paper object.
+
+        Returns None for non-paper types (peer-review, component, figure, etc.)
+        so they are excluded from search results.
+        """
         try:
+            # Filter out non-paper types (peer-review material, figures, etc.)
+            item_type = str(item.get('type') or '').strip().lower()
+            if item_type in self.NON_PAPER_TYPES:
+                logger.debug("Filtering out non-paper CrossRef item (type=%s, DOI=%s)",
+                             item_type, item.get('DOI', 'unknown'))
+                return None
+
             # Extract basic information
             doi = item.get('DOI', '')
             title = self._extract_title(item)
@@ -351,4 +374,4 @@ def get_paper_by_doi(self, doi: str) -> Optional[Paper]:
         print("\nTesting paper reading functionality...")
         paper_id = papers[0].doi
         message = searcher.read_paper(paper_id)
-        print(f"Message: {message}")
\ No newline at end of file
+        print(f"Message: {message}")
```

**File**: `paper_search_mcp/server.py` (modified, +258/-18)
```diff
@@ -1,15 +1,19 @@
 # paper_search_mcp/server.py
 import argparse
 import asyncio
+import io
 import logging
 import os
 import re
+import tempfile
 import threading
 import time
+import unicodedata
 from collections.abc import Awaitable
 from concurrent.futures import Future, ThreadPoolExecutor
 from threading import BoundedSemaphore
 from typing import Any, Dict, List, Optional
+from urllib.parse import unquote
 
 import httpx
 from mcp.server.fastmcp import FastMCP
@@ -240,13 +244,20 @@ def _safe_filename(filename_hint: str, default: str = "paper") -> str:
     return safe[:120]
 
 
-async def _download_from_url(pdf_url: str, save_path: str, filename_hint: str = "paper") -> Optional[str]:
+async def _download_from_url(
+    pdf_url: str,
+    save_path: str,
+    filename_hint: str = "paper",
+    expected_title: str = "",
+    expected_doi: str = "",
+) -> Optional[str]:
+    """Download and, when identity hints are present, verify a fallback PDF."""
     if not pdf_url:
         return None
 
-    os.makedirs(save_path, exist_ok=True)
     output_name = f"{_safe_filename(filename_hint)}.pdf"
     output_path = os.path.join(save_path, output_name)
+    temporary_path = ""
 
     try:
         async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
@@ -255,35 +266,204 @@ async def _download_from_url(pdf_url: str, save_path: str, filename_hint: str =
         if response.status_code >= 400 or not response.content:
             return None
 
+        content = bytes(response.content)
         content_type = (response.headers.get("content-type") or "").lower()
-        is_pdf = "pdf" in content_type or response.content.startswith(b"%PDF") or pdf_url.lower().endswith(".pdf")
-        if not is_pdf:
-            logger.warning("Resolved URL is not a PDF candidate: %s (content-type=%s)", pdf_url, content_type)
+        if not _looks_like_pdf(content):
+            logger.warning(
+                "Resolved URL did not return PDF bytes: %s (content-type=%s)",
+                pdf_url,
+                content_type,
+            )
             return None
 
-        with open(output_path, "wb") as file_obj:
-            file_obj.write(response.content)
-
+        if expected_title or expected_doi:
+            matches = await asyncio.to_thread(
+                _pdf_matches_expected,
+                content,
+                expected_title,
+                expected_doi,
+            )
+            if not matches:
+                logger.warning(
+                    "Downloaded PDF from %s could not be verified as title=%r DOI=%r",
+                    pdf_url,
+                    expected_title[:120],
+                    expected_doi,
+                )
+                return None
+
+        os.makedirs(save_path, exist_ok=True)
+        with tempfile.NamedTemporaryFile(
+            mode="wb",
+            prefix=f".{output_name}.",
+            suffix=".part",
+            dir=save_path,
+            delete=False,
+        ) as file_obj:
+            temporary_path = file_obj.name
+            file_obj.write(content)
+        os.replace(temporary_path, output_path)
+        temporary_path = ""
         return output_path
     except Exception as exc:
         logger.warning("Direct URL download failed for %s: %s", pdf_url, exc)
         return None
+    finally:
+        if temporary_path:
+            try:
+                os.remove(temporary_path)
+            except OSError:
+                pass
+
+
+def _looks_like_pdf(content: bytes) -> bool:
+    """Check the PDF header instead of trusting a URL suffix or content type."""
+    return bool(content) and b"%PDF-" in content[:1024]
+
+
+_TITLE_STOPWORDS = frozenset(
+    {
+        "about",
+        "after",
+        "among",
+        "based",
+        "between",
+        "from",
+        "into",
+        "study",
+        "that",
+        "their",
+        "through",
+        "using",
+        "with",
+    }
+)
+
+
+def _normalize_text(value: str) -> s
```

**File**: `tests/test_crossref.py` (modified, +49/-2)
```diff
@@ -1,6 +1,5 @@
 # tests/test_crossref.py
 import unittest
-import os
 import requests
 from paper_search_mcp.academic_platforms.crossref import CrossRefSearcher
 
@@ -101,5 +100,53 @@ def test_user_agent_header(self):
         self.assertIn("paper-search-mcp", self.searcher.session.headers.get('User-Agent', ''))
         self.assertIn("mailto:", self.searcher.session.headers.get('User-Agent', ''))
 
+    def test_non_paper_types_are_filtered(self):
+        """Regression: CrossRef returns peer-review material, figures, and other
+        sub-components with real DOIs. Without filtering they pollute search
+        results as 'phantom papers' that have a DOI but no citable content.
+        Bug observed: search for 'myodural bridge' returned multiple
+        'Review for ...' and 'Figure 5: ...' entries as if they were papers."""
+        for item_type in (
+            "peer-review",
+            "peer-review-material",
+            "component",
+            "report-component",
+            "figure",
+        ):
+            with self.subTest(item_type=item_type):
+                item = {
+                    'DOI': f'10.1000/{item_type}',
+                    'type': item_type.upper(),
+                    'title': [f'Artifact of type {item_type}'],
+                }
+                self.assertIsNone(self.searcher._parse_crossref_item(item))
+
+    def test_journal_article_passes_filter(self):
+        """Sanity check: real journal-article types must still pass through."""
+        journal_item = {
+            'DOI': '10.1002/ca.21261',
+            'type': 'journal-article',
+            'title': ['Connection between the spinal dura mater and suboccipital musculature'],
+            'author': [{'given': 'Kourosh', 'family': 'Kahkeshani'}],
+            'is-referenced-by-count': 57,
+        }
+        paper = self.searcher._parse_crossref_item(journal_item)
+        self.assertIsNotNone(paper, "journal-article must pass the filter")
+        self.assertEqual(paper.doi, '10.1002/ca.21261')
+        self.assertTrue(any('Kahkeshani' in a for a in paper.authors),
+                        f"authors must contain 'Kahkeshani', got {paper.authors}")
+
+    def test_citable_non_article_outputs_are_not_filtered(self):
+        for item_type in ("dataset", "report", "standard", "dissertation"):
+            with self.subTest(item_type=item_type):
+                item = {
+                    'DOI': f'10.1000/{item_type}',
+                    'type': item_type,
+                    'title': [f'Citable output of type {item_type}'],
+                }
+                paper = self.searcher._parse_crossref_item(item)
+                self.assertIsNotNone(paper)
+                self.assertEqual(paper.extra['crossref_type'], item_type)
+
 if __name__ == '__main__':
-    unittest.main()
\ No newline at end of file
+    unittest.main()
```

**File**: `tests/test_fallback.py` (modified, +548/-35)
```diff
@@ -1,16 +1,53 @@
 import asyncio
+import os
+import tempfile
 import unittest
-from unittest.mock import AsyncMock, patch
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, MagicMock, patch
 
 from paper_search_mcp import server
 
 
+class _FakeAsyncClient:
+    def __init__(self, response):
+        self.response = response
+
+    async def __aenter__(self):
+        return self
+
+    async def __aexit__(self, exc_type, exc, traceback):
+        return False
+
+    async def get(self, url):
+        return self.response
+
+
+def _empty_searcher():
+    return SimpleNamespace(search=lambda query, max_results=3: [])
+
+
 class TestDownloadWithFallback(unittest.TestCase):
     def test_scihub_is_disabled_by_default(self):
-        with patch.object(server.arxiv_searcher, "download_pdf", side_effect=Exception("primary failed")), \
-             patch("paper_search_mcp.server._try_repository_fallback", new=AsyncMock(return_value=(None, "repo failed"))), \
-             patch.object(server.unpaywall_resolver, "resolve_best_pdf_url", return_value=None), \
-             patch("paper_search_mcp.server.SciHubFetcher.download_pdf", side_effect=AssertionError("Sci-Hub should not be called")):
+        with (
+            patch.object(
+                server.arxiv_searcher,
+                "download_pdf",
+                side_effect=Exception("primary failed"),
+            ),
+            patch(
+                "paper_search_mcp.server._try_repository_fallback",
+                new=AsyncMock(return_value=(None, "repo failed")),
+            ),
+            patch.object(
+                server.unpaywall_resolver,
+                "resolve_best_pdf_url",
+                return_value=None,
+            ),
+            patch(
+                "paper_search_mcp.server.SciHubFetcher.download_pdf",
+                side_effect=AssertionError("Sci-Hub should not be called"),
+            ),
+        ):
             result = asyncio.run(
                 server.download_with_fallback(
                     source="arxiv",
@@ -23,9 +60,21 @@ def test_scihub_is_disabled_by_default(self):
         self.assertIn("OA fallback chain", result)
 
     def test_repository_fallback_before_scihub(self):
-        with patch.object(server.arxiv_searcher, "download_pdf", side_effect=Exception("primary failed")), \
-             patch("paper_search_mcp.server._try_repository_fallback", new=AsyncMock(return_value=("/tmp/repo.pdf", ""))), \
-             patch("paper_search_mcp.server.SciHubFetcher.download_pdf", side_effect=AssertionError("Sci-Hub should not be called")):
+        with (
+            patch.object(
+                server.arxiv_searcher,
+                "download_pdf",
+                side_effect=Exception("primary failed"),
+            ),
+            patch(
+                "paper_search_mcp.server._try_repository_fallback",
+                new=AsyncMock(return_value=("/tmp/repo.pdf", "")),
+            ),
+            patch(
+                "paper_search_mcp.server.SciHubFetcher.download_pdf",
+                side_effect=AssertionError("Sci-Hub should not be called"),
+            ),
+        ):
             result = asyncio.run(
                 server.download_with_fallback(
                     source="arxiv",
@@ -35,28 +84,60 @@ def test_repository_fallback_before_scihub(self):
                     use_scihub=True,
                 )
             )
-            self.assertEqual(result, "/tmp/repo.pdf")
+        self.assertEqual(result, "/tmp/repo.pdf")
 
     def test_unpaywall_fallback_after_repositories(self):
-        with patch.object(server.arxiv_searcher, "download_pdf", side_effect=Exception("primary failed")), \
-             patch("paper_search_mcp.server._try_repository_fallback", new=AsyncMock(return_value=(None, "repo failed"))), \
-             patch.object(server.unpaywall_resolver, "resolve_best_pdf_url", return_value="https://example.org/oa.pdf"), \
-             patch("paper_search_mcp.s
```

---

### Incident Patch 8: `d0919411` (2026-09-21)
**Commit Message**: fix: harden fallback PDF identity validation

**File**: `paper_search_mcp/academic_platforms/crossref.py` (modified, +14/-24)
```diff
@@ -3,7 +3,6 @@
 from datetime import datetime
 import requests
 import time
-import random
 from ..paper import Paper
 from .base import PaperSource
 import logging
@@ -18,27 +17,18 @@ class CrossRefSearcher(PaperSource):
     # User agent for polite API usage as per CrossRef etiquette
     USER_AGENT = "paper-search-mcp/0.1.3 (https://github.com/Dragonatorul/paper-search-mcp; mailto:paper-search@example.org)"
 
-    # CrossRef "type" values that are NOT standalone papers and should be
-    # filtered out of search results. These are sub-components (figures,
-    # peer-review materials, decision letters, etc.) that pollute search
-    # output with non-citable items.
-    # Ref: https://api.crossref.org/swagger-ui/index.html#/Works/get_works
-    NON_PAPER_TYPES = frozenset({
-        "peer-review",
-        "peer-review-material",
-        "review",  # ambiguous — kept conservative, only filters review sub-types
-        "component",
-        "figure",
-        "dataset",
-        "report",
-        "report-component",
-        "standard",
-        "standard-series",
-    })
-
-    # Default include set when caller does not override. Conservative: keeps
-    # the most common citable types. Set to None to disable filtering.
-    DEFAULT_INCLUDE_TYPES = None  # None => use NON_PAPER_TYPES denylist
+    # Only filter types that unambiguously describe review artifacts or pieces
+    # of another work. Datasets, reports, and standards remain valid citable
+    # research outputs and must not be hidden by a generic paper search.
+    NON_PAPER_TYPES = frozenset(
+        {
+            "peer-review",
+            "peer-review-material",
+            "component",
+            "report-component",
+            "figure",
+        }
+    )
     
     def __init__(self):
         self.session = requests.Session()
@@ -119,7 +109,7 @@ def _parse_crossref_item(self, item: Dict[str, Any]) -> Optional[Paper]:
         """
         try:
             # Filter out non-paper types (peer-review material, figures, etc.)
-            item_type = item.get('type', '')
+            item_type = str(item.get('type') or '').strip().lower()
             if item_type in self.NON_PAPER_TYPES:
                 logger.debug("Filtering out non-paper CrossRef item (type=%s, DOI=%s)",
                              item_type, item.get('DOI', 'unknown'))
@@ -384,4 +374,4 @@ def get_paper_by_doi(self, doi: str) -> Optional[Paper]:
         print("\nTesting paper reading functionality...")
         paper_id = papers[0].doi
         message = searcher.read_paper(paper_id)
-        print(f"Message: {message}")
\ No newline at end of file
+        print(f"Message: {message}")
```

**File**: `paper_search_mcp/server.py` (modified, +190/-90)
```diff
@@ -1,15 +1,19 @@
 # paper_search_mcp/server.py
 import argparse
 import asyncio
+import io
 import logging
 import os
 import re
+import tempfile
 import threading
 import time
+import unicodedata
 from collections.abc import Awaitable
 from concurrent.futures import Future, ThreadPoolExecutor
 from threading import BoundedSemaphore
 from typing import Any, Dict, List, Optional
+from urllib.parse import unquote
 
 import httpx
 from mcp.server.fastmcp import FastMCP
@@ -247,20 +251,13 @@ async def _download_from_url(
     expected_title: str = "",
     expected_doi: str = "",
 ) -> Optional[str]:
-    """Download a PDF from a URL and optionally verify it matches the expected paper.
-
-    When `expected_title` is provided, the downloaded PDF's first-page text is
-    extracted and checked for token overlap with the title. If the overlap is
-    below threshold, the file is removed and None is returned — this prevents
-    fallback chains from returning an unrelated PDF (a known failure mode where
-    OpenAIRE/CORE/Unpaywall resolve to a different paper).
-    """
+    """Download and, when identity hints are present, verify a fallback PDF."""
     if not pdf_url:
         return None
 
-    os.makedirs(save_path, exist_ok=True)
     output_name = f"{_safe_filename(filename_hint)}.pdf"
     output_path = os.path.join(save_path, output_name)
+    temporary_path = ""
 
     try:
         async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
@@ -269,114 +266,174 @@ async def _download_from_url(
         if response.status_code >= 400 or not response.content:
             return None
 
+        content = bytes(response.content)
         content_type = (response.headers.get("content-type") or "").lower()
-        is_pdf = "pdf" in content_type or response.content.startswith(b"%PDF") or pdf_url.lower().endswith(".pdf")
-        if not is_pdf:
-            logger.warning("Resolved URL is not a PDF candidate: %s (content-type=%s)", pdf_url, content_type)
+        if not _looks_like_pdf(content):
+            logger.warning(
+                "Resolved URL did not return PDF bytes: %s (content-type=%s)",
+                pdf_url,
+                content_type,
+            )
             return None
 
-        with open(output_path, "wb") as file_obj:
-            file_obj.write(response.content)
-
-        # Content verification: reject PDFs that don't mention the expected title.
-        # This catches the phantom-PDF bug where a fallback URL resolves to an
-        # unrelated document (e.g. wrong paper due to DOI mis-resolution).
-        if expected_title:
-            if not _pdf_matches_expected(output_path, expected_title, expected_doi):
+        if expected_title or expected_doi:
+            matches = await asyncio.to_thread(
+                _pdf_matches_expected,
+                content,
+                expected_title,
+                expected_doi,
+            )
+            if not matches:
                 logger.warning(
-                    "Downloaded PDF from %s does not match expected title '%s'; discarding.",
-                    pdf_url, expected_title[:120],
+                    "Downloaded PDF from %s could not be verified as title=%r DOI=%r",
+                    pdf_url,
+                    expected_title[:120],
+                    expected_doi,
                 )
-                try:
-                    os.remove(output_path)
-                except OSError:
-                    pass
                 return None
 
+        os.makedirs(save_path, exist_ok=True)
+        with tempfile.NamedTemporaryFile(
+            mode="wb",
+            prefix=f".{output_name}.",
+            suffix=".part",
+            dir=save_path,
+            delete=False,
+        ) as file_obj:
+            temporary_path = file_obj.name
+            file_obj.write(content)
+        os.replace(temporary_path, output_path)
+        temporary_path = ""
         return output_path
     except Exception as exc
```

**File**: `tests/test_crossref.py` (modified, +26/-33)
```diff
@@ -1,6 +1,5 @@
 # tests/test_crossref.py
 import unittest
-import os
 import requests
 from paper_search_mcp.academic_platforms.crossref import CrossRefSearcher
 
@@ -107,32 +106,20 @@ def test_non_paper_types_are_filtered(self):
         results as 'phantom papers' that have a DOI but no citable content.
         Bug observed: search for 'myodural bridge' returned multiple
         'Review for ...' and 'Figure 5: ...' entries as if they were papers."""
-        # peer-review material — must be filtered out
-        peer_review_item = {
-            'DOI': '10.1002/jmor.21431/v1/review1',
-            'type': 'peer-review',
-            'title': ['Review for "The morphology of the suboccipital region"'],
-        }
-        self.assertIsNone(self.searcher._parse_crossref_item(peer_review_item),
-                          "peer-review type must be filtered out")
-
-        # figure component — must be filtered out
-        figure_item = {
-            'DOI': '10.7717/peerj.9716/fig-5',
-            'type': 'figure',
-            'title': ['Figure 5: The myodural bridge.'],
-        }
-        self.assertIsNone(self.searcher._parse_crossref_item(figure_item),
-                          "figure type must be filtered out")
-
-        # dataset — must be filtered out
-        dataset_item = {
-            'DOI': '10.5281/zenodo.123456',
-            'type': 'dataset',
-            'title': ['Dataset: myodural bridge measurements'],
-        }
-        self.assertIsNone(self.searcher._parse_crossref_item(dataset_item),
-                          "dataset type must be filtered out")
+        for item_type in (
+            "peer-review",
+            "peer-review-material",
+            "component",
+            "report-component",
+            "figure",
+        ):
+            with self.subTest(item_type=item_type):
+                item = {
+                    'DOI': f'10.1000/{item_type}',
+                    'type': item_type.upper(),
+                    'title': [f'Artifact of type {item_type}'],
+                }
+                self.assertIsNone(self.searcher._parse_crossref_item(item))
 
     def test_journal_article_passes_filter(self):
         """Sanity check: real journal-article types must still pass through."""
@@ -149,11 +136,17 @@ def test_journal_article_passes_filter(self):
         self.assertTrue(any('Kahkeshani' in a for a in paper.authors),
                         f"authors must contain 'Kahkeshani', got {paper.authors}")
 
-    def test_non_paper_types_constant_covers_observed_phantom_types(self):
-        """Lock the denylist to the types we observed causing phantom results."""
-        required = {"peer-review", "component", "figure", "dataset"}
-        self.assertTrue(required.issubset(CrossRefSearcher.NON_PAPER_TYPES),
-                        f"NON_PAPER_TYPES must include at least {required}")
+    def test_citable_non_article_outputs_are_not_filtered(self):
+        for item_type in ("dataset", "report", "standard", "dissertation"):
+            with self.subTest(item_type=item_type):
+                item = {
+                    'DOI': f'10.1000/{item_type}',
+                    'type': item_type,
+                    'title': [f'Citable output of type {item_type}'],
+                }
+                paper = self.searcher._parse_crossref_item(item)
+                self.assertIsNotNone(paper)
+                self.assertEqual(paper.extra['crossref_type'], item_type)
 
 if __name__ == '__main__':
-    unittest.main()
\ No newline at end of file
+    unittest.main()
```

**File**: `tests/test_fallback.py` (modified, +500/-257)
```diff
@@ -2,23 +2,52 @@
 import os
 import tempfile
 import unittest
-from unittest.mock import AsyncMock, patch
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, MagicMock, patch
 
 from paper_search_mcp import server
-from paper_search_mcp.server import (
-    _title_similarity,
-    _pdf_matches_expected,
-    _download_from_url,
-    _try_repository_fallback,
-)
+
+
+class _FakeAsyncClient:
+    def __init__(self, response):
+        self.response = response
+
+    async def __aenter__(self):
+        return self
+
+    async def __aexit__(self, exc_type, exc, traceback):
+        return False
+
+    async def get(self, url):
+        return self.response
+
+
+def _empty_searcher():
+    return SimpleNamespace(search=lambda query, max_results=3: [])
 
 
 class TestDownloadWithFallback(unittest.TestCase):
     def test_scihub_is_disabled_by_default(self):
-        with patch.object(server.arxiv_searcher, "download_pdf", side_effect=Exception("primary failed")), \
-             patch("paper_search_mcp.server._try_repository_fallback", new=AsyncMock(return_value=(None, "repo failed"))), \
-             patch.object(server.unpaywall_resolver, "resolve_best_pdf_url", return_value=None), \
-             patch("paper_search_mcp.server.SciHubFetcher.download_pdf", side_effect=AssertionError("Sci-Hub should not be called")):
+        with (
+            patch.object(
+                server.arxiv_searcher,
+                "download_pdf",
+                side_effect=Exception("primary failed"),
+            ),
+            patch(
+                "paper_search_mcp.server._try_repository_fallback",
+                new=AsyncMock(return_value=(None, "repo failed")),
+            ),
+            patch.object(
+                server.unpaywall_resolver,
+                "resolve_best_pdf_url",
+                return_value=None,
+            ),
+            patch(
+                "paper_search_mcp.server.SciHubFetcher.download_pdf",
+                side_effect=AssertionError("Sci-Hub should not be called"),
+            ),
+        ):
             result = asyncio.run(
                 server.download_with_fallback(
                     source="arxiv",
@@ -31,9 +60,21 @@ def test_scihub_is_disabled_by_default(self):
         self.assertIn("OA fallback chain", result)
 
     def test_repository_fallback_before_scihub(self):
-        with patch.object(server.arxiv_searcher, "download_pdf", side_effect=Exception("primary failed")), \
-             patch("paper_search_mcp.server._try_repository_fallback", new=AsyncMock(return_value=("/tmp/repo.pdf", ""))), \
-             patch("paper_search_mcp.server.SciHubFetcher.download_pdf", side_effect=AssertionError("Sci-Hub should not be called")):
+        with (
+            patch.object(
+                server.arxiv_searcher,
+                "download_pdf",
+                side_effect=Exception("primary failed"),
+            ),
+            patch(
+                "paper_search_mcp.server._try_repository_fallback",
+                new=AsyncMock(return_value=("/tmp/repo.pdf", "")),
+            ),
+            patch(
+                "paper_search_mcp.server.SciHubFetcher.download_pdf",
+                side_effect=AssertionError("Sci-Hub should not be called"),
+            ),
+        ):
             result = asyncio.run(
                 server.download_with_fallback(
                     source="arxiv",
@@ -43,28 +84,60 @@ def test_repository_fallback_before_scihub(self):
                     use_scihub=True,
                 )
             )
-            self.assertEqual(result, "/tmp/repo.pdf")
+        self.assertEqual(result, "/tmp/repo.pdf")
 
     def test_unpaywall_fallback_after_repositories(self):
-        with patch.object(server.arxiv_searcher, "download_pdf", side_effect=Exception("primary failed")), \
-             patch("paper_search_mcp.server._try_repository_fallback", new=AsyncMock(return_value=(None, "repo failed"))), \
-             patch.object(se
```

---

### Incident Patch 9: `2ad62e0d` (2026-09-21)
**Commit Message**: Merge pull request #114 from popkir/fix/stdio-orphan-and-http

Exit stdio server when its client dies; add optional streamable-http transport

**File**: `.env.example` (modified, +6/-0)
```diff
@@ -2,6 +2,12 @@
 # Copy this file to ~/.config/paper-search-mcp/.env and fill in the values you need.
 # Preferred format: PAPER_SEARCH_MCP_<NAME>
 
+# Optional MCP server transport (stdio remains the default)
+# PAPER_SEARCH_MCP_TRANSPORT=streamable-http
+# PAPER_SEARCH_MCP_HOST=127.0.0.1
+# PAPER_SEARCH_MCP_PORT=8000
+# PAPER_SEARCH_MCP_PATH=/mcp
+
 # Core optional keys/tokens
 PAPER_SEARCH_MCP_SEMANTIC_SCHOLAR_API_KEY=
 PAPER_SEARCH_MCP_CORE_API_KEY=
```

**File**: `README.md` (modified, +14/-0)
```diff
@@ -463,6 +463,20 @@ For example, if you cloned to `/Users/mac/Pengsong/paper-search-mcp`:
 
 > `uv run` automatically installs dependencies into an isolated environment on first run — no `pip install` or `venv` needed.
 
+To run one shared network server instead of one stdio process per client:
+
+```bash
+paper-search-mcp --transport streamable-http --host 127.0.0.1 --port 8000 --path /mcp
+```
+
+The available transports are `stdio`, `sse`, and `streamable-http`. The default
+remains `stdio`. The same network settings can be supplied with
+`PAPER_SEARCH_MCP_TRANSPORT`, `PAPER_SEARCH_MCP_HOST`,
+`PAPER_SEARCH_MCP_PORT`, and `PAPER_SEARCH_MCP_PATH`; command-line options take
+precedence. Binding to a non-loopback host such as `0.0.0.0` exposes an
+unauthenticated server, so place it behind an authenticated gateway rather than
+publishing it directly to the internet.
+
 For active development, optionally install an editable copy:
 
 ```bash
```

**File**: `paper_search_mcp/server.py` (modified, +159/-3)
```diff
@@ -1,8 +1,11 @@
 # paper_search_mcp/server.py
+import argparse
 import asyncio
 import logging
 import os
 import re
+import threading
+import time
 from collections.abc import Awaitable
 from concurrent.futures import Future, ThreadPoolExecutor
 from threading import BoundedSemaphore
@@ -33,7 +36,7 @@
 from .academic_platforms.ssrn import SSRNSearcher
 from .academic_platforms.unpaywall import UnpaywallResolver, UnpaywallSearcher
 from .academic_platforms.zenodo import ZenodoSearcher
-from .config import get_env
+from .config import get_env, load_env_file
 
 # Initialize MCP server
 mcp = FastMCP("paper_search_server")
@@ -1475,8 +1478,161 @@ async def read_acm_paper(paper_id: str, save_path: str = "./downloads") -> str:
         return acm_searcher.read_paper(paper_id, save_path)
 
 
-def main():
-    mcp.run(transport="stdio")
+def _wait_for_windows_process_exit(process_id: int) -> bool:
+    """Wait for a Windows process handle to become signalled."""
+    import ctypes
+    from ctypes import wintypes
+
+    synchronize = 0x00100000
+    infinite = 0xFFFFFFFF
+    wait_object_0 = 0x00000000
+    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
+    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
+    kernel32.OpenProcess.restype = wintypes.HANDLE
+    kernel32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
+    kernel32.WaitForSingleObject.restype = wintypes.DWORD
+    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
+    kernel32.CloseHandle.restype = wintypes.BOOL
+
+    handle = kernel32.OpenProcess(synchronize, False, process_id)
+    if not handle:
+        logger.warning(
+            "Could not watch MCP client process %s (Windows error %s)",
+            process_id,
+            ctypes.get_last_error(),
+        )
+        return False
+
+    try:
+        result = kernel32.WaitForSingleObject(handle, infinite)
+    finally:
+        kernel32.CloseHandle(handle)
+
+    if result != wait_object_0:
+        logger.warning(
+            "Waiting for MCP client process %s failed (result %#x)",
+            process_id,
+            result,
+        )
+        return False
+    return True
+
+
+def _exit_when_orphaned(poll_seconds: float = 5.0) -> None:
+    """Exit if the MCP client that spawned this stdio server goes away.
+
+    A stdio server is owned by exactly one client. When that client dies without
+    closing the pipe cleanly, ``mcp.run`` keeps blocking on stdin and the process
+    survives indefinitely, re-adopted by init. They accumulate: nine of these had
+    piled up on one developer machine, the oldest running for over a day.
+
+    Watch for reparenting and leave.
+    """
+    original_ppid = os.getppid()
+    if os.name == "nt":
+        # Windows keeps reporting the original parent PID after that process has
+        # exited, so polling getppid() cannot detect orphaning. A process handle
+        # becomes signalled at termination and works without an extra dependency.
+        if not _wait_for_windows_process_exit(original_ppid):
+            return
+        logger.info("MCP client process %s exited; shutting down", original_ppid)
+        os._exit(0)
+        return
+
+    while True:
+        time.sleep(poll_seconds)
+        ppid = os.getppid()
+        if ppid == 1 or ppid != original_ppid:
+            logger.info(
+                "MCP client gone (ppid %s -> %s); shutting down", original_ppid, ppid
+            )
+            os._exit(0)
+            return
+
+
+def _server_env(name: str, default: str) -> str:
+    """Return a server setting, preferring the repository-wide env prefix."""
+    load_env_file()
+    for key in (f"PAPER_SEARCH_MCP_{name}", f"PAPER_SEARCH_{name}"):
+        value = os.environ.get(key)
+        if value is not None and value.strip():
+            return value.strip()
+    return default
+
+
+def _valid_port(raw: str) -> int:
+    try:
+        port = int(raw)
+    except (TypeError, ValueError) as exc:
```

**File**: `pyproject.toml` (modified, +4/-1)
```diff
@@ -35,7 +35,7 @@ dependencies = [
     "feedparser",
     "fastmcp",
     "pypdf",
-    "mcp[cli]>=1.6.0,<2",
+    "mcp[cli]>=1.8.0,<2",
     "beautifulsoup4>=4.12.0",
     "lxml>=4.9.0",
     "httpx[socks]>=0.28.1",
@@ -57,3 +57,6 @@ paper-search = "paper_search_mcp.cli:main"
 
 [tool.hatch.build.targets.wheel]
 packages = ["paper_search_mcp"]
+
+[tool.pytest.ini_options]
+python_files = ["test_*.py"]
```

**File**: `tests/test_biorxiv.py` (modified, +16/-18)
```diff
@@ -1,16 +1,21 @@
-import unittest
 import os
+import tempfile
+import unittest
+
 import requests
+
 from paper_search_mcp.academic_platforms.biorxiv import BioRxivSearcher
 
+
 def check_api_accessible():
     """检查 bioRxiv API 是否可访问"""
     try:
         response = requests.get("https://api.biorxiv.org/details/biorxiv/0/1", timeout=5)
         return response.status_code == 200
-    except:
+    except requests.RequestException:
         return False
 
+
 class TestBioRxivSearcher(unittest.TestCase):
     @classmethod
     def setUpClass(cls):
@@ -25,8 +30,10 @@ def test_search(self):
         if not self.api_accessible:
             self.skipTest("bioRxiv API is not accessible")
         
-        papers = self.searcher.search("machine learning", max_results=10)
-        print(f"Found {len(papers)} papers for query 'machine learning':")
+        papers = self.searcher.search("bioinformatics", max_results=10)
+        if not papers:
+            self.skipTest("bioRxiv returned no papers (unavailable or rate-limited)")
+        print(f"Found {len(papers)} papers in the 'bioinformatics' category:")
         for i, paper in enumerate(papers, 1):
             print(f"{i}. {paper.title} (ID: {paper.paper_id})")
         self.assertTrue(len(papers) > 0)
@@ -36,26 +43,17 @@ def test_download_and_read(self):
         if not self.api_accessible:
             self.skipTest("bioRxiv API is not accessible")
             
-        papers = self.searcher.search("machine learning", max_results=1)
+        papers = self.searcher.search("bioinformatics", max_results=1)
         if not papers:
             self.skipTest("No papers found for testing download")
-            
-        save_path = "./downloads"
-        os.makedirs(save_path, exist_ok=True)
+
         paper = papers[0]
-        pdf_path = None
-        
-        try:
+        with tempfile.TemporaryDirectory() as save_path:
             pdf_path = self.searcher.download_pdf(paper.paper_id, save_path)
             self.assertTrue(os.path.exists(pdf_path))
-            
+
             text_content = self.searcher.read_paper(paper.paper_id, save_path)
             self.assertTrue(len(text_content) > 0)
-        finally:
-            if pdf_path and os.path.exists(pdf_path):
-                os.remove(pdf_path)
-            if os.path.exists(save_path):
-                os.rmdir(save_path)
 
 if __name__ == '__main__':
-    unittest.main()
\ No newline at end of file
+    unittest.main()
```

---

### Incident Patch 10: `8be56320` (2026-09-20)
**Commit Message**: fix: improve MCP compatibility and search reliability (#116)

Add non-nullable MCP schemas, bounded provider execution, Google Scholar deadlines, and documented bioRxiv query modes with regression coverage.

**File**: `.github/workflows/publish.yml` (modified, +10/-1)
```diff
@@ -30,7 +30,16 @@ jobs:
         run: python -m compileall -q paper_search_mcp tests
 
       - name: Run deterministic tests
-        run: python -m pytest tests/test_package_entrypoints.py tests/test_config_env.py tests/test_unpaywall.py tests/test_unpaywall_source.py -q --tb=short
+        run: >
+          python -m pytest
+          tests/test_package_entrypoints.py
+          tests/test_config_env.py
+          tests/test_unpaywall.py
+          tests/test_unpaywall_source.py
+          tests/test_tool_schema_compat.py
+          tests/test_search_timeouts.py
+          tests/test_biorxiv_search_modes.py
+          -q --tb=short
 
       - name: Build package
         run: uv build
```

**File**: `paper_search_mcp/academic_platforms/biorxiv.py` (modified, +154/-72)
```diff
@@ -1,85 +1,163 @@
-from typing import List
-import requests
+import logging
 import os
-from datetime import datetime, timedelta
+import re
+from datetime import date, datetime, time, timedelta
+from urllib.parse import urlencode
+
+import requests
+from pypdf import PdfReader
+
 from ..paper import Paper
+from ..utils import extract_doi
 from .base import PaperSource
-from pypdf import PdfReader
+
+logger = logging.getLogger(__name__)
+
 
 class BioRxivSearcher(PaperSource):
     """Searcher for bioRxiv papers"""
+
     BASE_URL = "https://api.biorxiv.org/details/biorxiv"
+    DATE_RANGE_PATTERN = re.compile(
+        r"^\s*(\d{4}-\d{2}-\d{2})\s*(?:/|:|\.\.|to)\s*(\d{4}-\d{2}-\d{2})\s*$",
+        re.IGNORECASE,
+    )
 
     def __init__(self):
         self.session = requests.Session()
-        self.session.proxies = {'http': None, 'https': None}
+        self.session.proxies = {"http": None, "https": None}
         self.timeout = 30
         self.max_retries = 3
 
-    def search(self, query: str, max_results: int = 10, days: int = 30) -> List[Paper]:
-        """
-        Search for papers on bioRxiv by category within the last N days.
+    @staticmethod
+    def _normalize_category(category: str) -> str:
+        return re.sub(r"[\s-]+", "_", category.strip().lower())
 
-        Args:
-            query: Category name to search for (e.g., "cell biology").
-            max_results: Maximum number of papers to return.
-            days: Number of days to look back for papers.
+    def _resolve_query_mode(
+        self, query: str, days: int
+    ) -> tuple[str, str, str, str | None]:
+        """Resolve a query into (mode, start_or_doi, end_or_na, category)."""
+        normalized_query = (query or "").strip()
+        doi = extract_doi(normalized_query)
+        if doi:
+            return "doi", doi, "na", None
 
-        Returns:
-            List of Paper objects matching the category within the specified date range.
-        """
-        # Calculate date range: last N days
-        end_date = datetime.now().strftime('%Y-%m-%d')
-        start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
-        
-        # Format category: lowercase and replace spaces with underscores
-        category = query.lower().replace(' ', '_')
-        
+        date_match = self.DATE_RANGE_PATTERN.match(normalized_query)
+        if date_match:
+            start_date, end_date = date_match.groups()
+            parsed_start = date.fromisoformat(start_date)
+            parsed_end = date.fromisoformat(end_date)
+            if parsed_start > parsed_end:
+                raise ValueError("bioRxiv date range start must not be after its end")
+            return "interval", start_date, end_date, None
+
+        if days < 1:
+            raise ValueError("days must be at least 1")
+
+        today = date.today()
+        end_date = today.isoformat()
+        start_date = (today - timedelta(days=days)).isoformat()
+        category = (
+            self._normalize_category(normalized_query) if normalized_query else None
+        )
+        return "interval", start_date, end_date, category
+
+    def _request_json(self, url: str) -> dict | None:
+        for attempt in range(1, self.max_retries + 1):
+            try:
+                response = self.session.get(url, timeout=self.timeout)
+                response.raise_for_status()
+                return response.json()
+            except (requests.exceptions.RequestException, ValueError) as exc:
+                if attempt == self.max_retries:
+                    logger.warning(
+                        "bioRxiv request failed after %d attempts: %s",
+                        self.max_retries,
+                        exc,
+                    )
+                    return None
+                logger.info(
+                    "bioRxiv request attempt %d failed; retrying: %s",
+                    attempt,
+                    exc,
+                )
+        return 
```

**File**: `paper_search_mcp/academic_platforms/google_scholar.py` (modified, +52/-4)
```diff
@@ -53,6 +53,26 @@ def _setup_session(self):
     def _rotate_user_agent(self):
         self.session.headers.update({'User-Agent': random.choice(self.BROWSERS)})
 
+    @staticmethod
+    def _remaining_timeout(deadline: Optional[float], maximum: float) -> Optional[float]:
+        if deadline is None:
+            return maximum
+        remaining = deadline - time.monotonic()
+        if remaining <= 0:
+            return None
+        return min(maximum, remaining)
+
+    @staticmethod
+    def _sleep_with_deadline(delay: float, deadline: Optional[float]) -> bool:
+        if deadline is None:
+            time.sleep(delay)
+            return True
+        remaining = deadline - time.monotonic()
+        if remaining <= 0:
+            return False
+        time.sleep(min(delay, remaining))
+        return time.monotonic() < deadline
+
     @staticmethod
     def _is_captcha_page(soup: BeautifulSoup, page_text: Optional[str] = None) -> bool:
         if page_text is None:
@@ -127,16 +147,29 @@ def _parse_paper(self, item) -> Optional[Paper]:
             logger.warning(f"Failed to parse paper: {e}")
             return None
 
-    def search(self, query: str, max_results: int = 10) -> List[Paper]:
+    def search(
+        self,
+        query: str,
+        max_results: int = 10,
+        timeout_seconds: Optional[float] = None,
+    ) -> List[Paper]:
         """
         Search Google Scholar with custom parameters
         """
         papers = []
         start = 0
         results_per_page = min(10, max_results)
         consent_retry_attempted = False
+        deadline = (
+            time.monotonic() + max(0.0, timeout_seconds)
+            if timeout_seconds is not None
+            else None
+        )
 
         while len(papers) < max_results:
+            if deadline is not None and time.monotonic() >= deadline:
+                logger.warning("Google Scholar search deadline reached")
+                break
             try:
                 # Construct search parameters
                 params = {
@@ -149,9 +182,19 @@ def search(self, query: str, max_results: int = 10) -> List[Paper]:
                 response = None
                 for attempt in range(self.max_retries):
                     self._rotate_user_agent()
-                    time.sleep(random.uniform(1.0, 2.5))
+                    if not self._sleep_with_deadline(
+                        random.uniform(1.0, 2.5), deadline
+                    ):
+                        break
 
-                    response = self.session.get(self.SCHOLAR_URL, params=params, timeout=30)
+                    request_timeout = self._remaining_timeout(deadline, 30.0)
+                    if request_timeout is None:
+                        break
+                    response = self.session.get(
+                        self.SCHOLAR_URL,
+                        params=params,
+                        timeout=request_timeout,
+                    )
                     if response.status_code == 200:
                         break
 
@@ -165,12 +208,17 @@ def search(self, query: str, max_results: int = 10) -> List[Paper]:
                             self.max_retries,
                             wait_time,
                         )
-                        time.sleep(wait_time)
+                        if not self._sleep_with_deadline(wait_time, deadline):
+                            break
                         continue
 
                     logger.error("Search failed with non-retryable status %s", response.status_code)
                     break
 
+                if deadline is not None and time.monotonic() >= deadline:
+                    logger.warning("Google Scholar search deadline reached")
+                    break
+
                 if response is None or response.status_code != 200:
                     logger.error("Google Scholar search aborted after retries")
                     break
```

**File**: `paper_search_mcp/academic_platforms/iacr.py` (modified, +10/-3)
```diff
@@ -2,7 +2,6 @@
 from datetime import datetime
 import requests
 from bs4 import BeautifulSoup
-import time
 import random
 from ..paper import Paper
 from ..utils import extract_doi
@@ -19,6 +18,7 @@ class IACRSearcher(PaperSource):
 
     IACR_SEARCH_URL = "https://eprint.iacr.org/search"
     IACR_BASE_URL = "https://eprint.iacr.org"
+    REQUEST_TIMEOUT_SECONDS = 30
     BROWSERS = [
         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
         "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
@@ -160,7 +160,11 @@ def search(
             params = {"q": query}
 
             # Make request
-            response = self.session.get(self.IACR_SEARCH_URL, params=params)
+            response = self.session.get(
+                self.IACR_SEARCH_URL,
+                params=params,
+                timeout=self.REQUEST_TIMEOUT_SECONDS,
+            )
 
             if response.status_code != 200:
                 logger.error(f"IACR search failed with status {response.status_code}")
@@ -313,7 +317,10 @@ def get_paper_details(self, paper_id: str) -> Optional[Paper]:
                 paper_url = f"{self.IACR_BASE_URL}/{paper_id}"
 
             # Make request
-            response = self.session.get(paper_url)
+            response = self.session.get(
+                paper_url,
+                timeout=self.REQUEST_TIMEOUT_SECONDS,
+            )
 
             if response.status_code != 200:
                 logger.error(
```

**File**: `paper_search_mcp/academic_platforms/pubmed.py` (modified, +12/-4)
```diff
@@ -6,12 +6,12 @@
 from ..paper import Paper
 from ..utils import extract_doi
 from .base import PaperSource
-import os
 
 class PubMedSearcher(PaperSource):
     """Searcher for PubMed papers"""
     SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
     FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
+    REQUEST_TIMEOUT_SECONDS = 30
 
     def search(self, query: str, max_results: int = 10, sort: str = 'relevance') -> List[Paper]:
         search_params = {
@@ -21,7 +21,11 @@ def search(self, query: str, max_results: int = 10, sort: str = 'relevance') ->
             'retmode': 'xml',
             'sort': sort,
         }
-        search_response = requests.get(self.SEARCH_URL, params=search_params)
+        search_response = requests.get(
+            self.SEARCH_URL,
+            params=search_params,
+            timeout=self.REQUEST_TIMEOUT_SECONDS,
+        )
         search_root = ET.fromstring(search_response.content)
         ids = [id.text for id in search_root.findall('.//Id') if id.text]
         if not ids:
@@ -32,7 +36,11 @@ def search(self, query: str, max_results: int = 10, sort: str = 'relevance') ->
             'id': ','.join(ids),
             'retmode': 'xml'
         }
-        fetch_response = requests.get(self.FETCH_URL, params=fetch_params)
+        fetch_response = requests.get(
+            self.FETCH_URL,
+            params=fetch_params,
+            timeout=self.REQUEST_TIMEOUT_SECONDS,
+        )
         fetch_root = ET.fromstring(fetch_response.content)
         
         papers = []
@@ -160,4 +168,4 @@ def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
             message = searcher.read_paper(paper_id)
             print(f"Response: {message}")
         except Exception as e:
-            print(f"Error during paper reading: {e}")
\ No newline at end of file
+            print(f"Error during paper reading: {e}")
```

#### Recent Merged Pull Requests:
- **PR #128** (2026-09-30): feat: enable keyless ACM search with validated DOI and safe tool metadata (@universea)
- **PR #127** (2026-09-30): docs: clarify HTTP authorization and skill ZIP packaging (@universea)
- **PR #126** (2026-09-30): feat(cli): sort retrieved papers by citations or date (@universea)
- **PR #125** (2026-09-30): fix: recover valid arXiv 406 feeds and surface failed searches (@universea)
- **PR #124** (2026-09-30): feat: add arXiv as an OA-repository fallback source (@ChrisPrapas)
- **PR #123** (2026-09-30): feat: make ACM Digital Library search keyless via Crossref (@ChrisPrapas)
- **PR #120** (2026-09-22): feat(mcp): publish accurate tool annotations (@universea)
- **PR #119** (2026-09-22): fix(arxiv): serialize and surface rate-limit responses (@universea)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
