# Forensic Learning Record (Deep Inspection): unclecode/crawl4ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/unclecode-crawl4ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/unclecode/crawl4ai](https://github.com/unclecode/crawl4ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T13:55:04.763Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `unclecode/crawl4ai`
- **Description**: Open-source web crawler and scraper for LLMs and AI agents: any website into clean, LLM-ready Markdown. Run it yourself, or use Crawl4AI Cloud with one key.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 84549 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crawl4ai/__init__.py`
```
# __init__.py
import warnings

from .async_webcrawler import AsyncWebCrawler, CacheMode
# MODIFIED: Add SeedingConfig and VirtualScrollConfig here
from .async_configs import BrowserConfig, CrawlerRunConfig, HTTPCrawlerConfig, LLMConfig, ProxyConfig, GeolocationConfig, SeedingConfig, VirtualScrollConfig, LinkPreviewConfig, MatchMode, DomainMapperConfig

from .content_scraping_strategy import (
    ContentScrapingStrategy,
    LXMLWebScrapingStrategy,
    WebScrapingStrategy,  # Backward compatibility alias
)
from .processors.pdf import PDFContentScrapingStrategy
from .async_logger import (
    AsyncLoggerBase,
    AsyncLogger,
)
from .proxy_strategy import (
    ProxyRotationStrategy,
    RoundRobinProxyStrategy,
)
from .extraction_strategy import (
    ExtractionStrategy,
    LLMExtractionStrategy,
    CosineStrategy,
    JsonCssExtractionStrategy,
    JsonXPathExtractionStrategy,
    JsonLxmlExtractionStrategy,
    RegexExtractionStrategy
)
from .chunking_strategy import ChunkingStrategy, RegexChunking
from .markdown_generation_strategy import DefaultMarkdownGenerator
from .table_extraction import (
    TableExtractionStrategy,
    DefaultTableExtraction,
    NoTableExtraction,
    LLMTableExtraction,
)
from .content_filter_strategy import (
    PruningContentFilter,
    BM25ContentFilter,
    LLMContentFilter,
    RelevantContentFilter,
)
from .content_filter_strategy_lxml import PruningContentFilterLXML
from .models import CrawlResult, MarkdownGenerationResult, DisplayMode
from .components.crawler_monitor import CrawlerMonitor
from .link_preview import LinkPreview
from .async_dispatcher import (
    MemoryAdaptiveDispatcher,
    SemaphoreDispatcher,
    RateLimiter,
    BaseDispatcher,
)
from .docker_client import Crawl4aiDockerClient
from .hub import CrawlerHub
from .browser_profiler import BrowserProfiler
from .deep_crawling import (
    DeepCrawlStrategy,
    BFSDeepCrawlStrategy,
    FilterChain,
    URLPatternFilter,
    DomainFilter,
    ContentTypeFilter,
    URLFilter,
    FilterStats,
    SEOFilter,
    KeywordRelevanceScorer,
    URLScorer,
    CompositeScorer,
    DomainAuthorityScorer,
    FreshnessScorer,
    PathDepthScorer,
    BestFirstCrawlingStrategy,
    DFSDeepCrawlStrategy,
    DeepCrawlDecorator,
    ContentRelevanceFilter,
    ContentTypeScorer,
)
# NEW: Import AsyncUrlSeeder
from .async_url_seeder import AsyncUrlSeeder
from .domain_mapper import DomainMapper
# Adaptive Crawler
from .adaptive_crawler import (
    AdaptiveCrawler,
    AdaptiveConfig,
    CrawlState,
    CrawlStrategy,
    StatisticalStrategy
)

# C4A Script Language Support
from .script import (
    compile as c4a_compile,
    validate as c4a_validate,
    compile_file as c4a_compile_file,
    CompilationResult,
    ValidationResult,
    ErrorDetail
)

# Browser Adapters
from .browser_adapter import (
    BrowserAdapter,
    PlaywrightAdapter,
    UndetectedAdapter
)

from .utils import (
    start_colab_display_server,
    setup_colab_environment,
    hooks_to_string
)

__all__ = [
    "AsyncLoggerBase",
    "AsyncLogger",
    "AsyncWebCrawler",
    "BrowserProfiler",
    "LLMConfig",
    "GeolocationConfig",
    # NEW: Add SeedingConfig and VirtualScrollConfig
    "SeedingConfig",
    "VirtualScrollConfig",
    # NEW: Add AsyncUrlSeeder
    "AsyncUrlSeeder",
    # DomainMapper
    "DomainMapper",
    "DomainMapperConfig",
    # Adaptive Crawler
    "AdaptiveCrawler",
    "AdaptiveConfig", 
    "CrawlState",
    "CrawlStrategy",
    "StatisticalStrategy",
    "DeepCrawlStrategy",
    "BFSDeepCrawlStrategy",
    "BestFirstCrawlingStrategy",
    "DFSDeepCrawlStrategy",
    "FilterChain",
    "URLPatternFilter",
    "ContentTypeFilter",
    "DomainFilter",
    "FilterStats",
    "URLFilter",
    "SEOFilter",
    "KeywordRelevanceScorer",
    "URLScorer",
    "CompositeScorer",
    "DomainAuthorityScorer",
    "FreshnessScorer",
    "PathDepthScorer",
    "DeepCrawlDecorator",
    "CrawlResult",
    "CrawlerHub",
    "CacheMode",
    "MatchMode",
    "ContentScrapingStrategy",
    "WebScrapingStrategy",
    "LXMLWebScrapingStrategy",
    "BrowserConfig",
    "CrawlerRunConfig",
    "HTTPCrawlerConfig",
    "ExtractionStrategy",
    "LLMExtractionStrategy",
    "CosineStrategy",
    "JsonCssExtractionStrategy",
    "JsonXPathExtractionStrategy",
    "JsonLxmlExtractionStrategy",
    "RegexExtractionStrategy",
    "ChunkingStrategy",
    "RegexChunking",
    "DefaultMarkdownGenerator",
    "TableExtractionStrategy",
    "DefaultTableExtraction",
    "NoTableExtraction",
    "LLMTableExtraction",
    "RelevantContentFilter",
    "PruningContentFilter",
    "PruningContentFilterLXML",
    "BM25ContentFilter",
    "LLMContentFilter",
    "BaseDispatcher",
    "MemoryAdaptiveDispatcher",
    "SemaphoreDispatcher",
    "RateLimiter",
    "CrawlerMonitor",
    "LinkPreview",
    "DisplayMode",
    "MarkdownGenerationResult",
    "Crawl4aiDockerClient",
    "ProxyRotationStrategy",
    "RoundRobinProxyStrategy",
    "ProxyConfig",
    "start_colab_display_server",
    "setup_colab_environment",
    "hooks_to_string",
    # C4A Script additions
    "c4a_compile",
    "c4a_validate", 
    "c4a_compile_file",
    "CompilationResult",
    "ValidationResult",
    "ErrorDetail",
    # Browser Adapters
    "BrowserAdapter",
    "PlaywrightAdapter", 
    "UndetectedAdapter",
    "LinkPreviewConfig"
]


# def is_sync_version_installed():
#     try:
#         import selenium # noqa

#         return True
#     except ImportError:
#         return False


# if is_sync_version_installed():
#     try:
#         from .web_crawler import WebCrawler

#         __all__.append("WebCrawler")
#     except ImportError:
#         print(
#             "Warning: Failed to import WebCrawler even though selenium is installed. This might be due to other missing dependencies."
#         )
# else:
#     WebCrawler = None
#     # import warnings
#     # print("Warning: Synchronous WebCrawler is not available. Install crawl4ai[sync] for synchronous support. However, please note that the synchronous version will be deprecated soon.")

# Disable all Pydantic warnings
warnings.filterwarnings("ignore", module="pydantic")
# pydantic_warnings.filter_warnings()
```

### Core Architecture Module: `crawl4ai/__version__.py`
```
# crawl4ai/__version__.py

# This is the version that will be used for stable releases
__version__ = "0.9.4"

# For nightly builds, this gets set during build process
__nightly_version__ = None


```

### Core Architecture Module: `crawl4ai/adaptive_crawler.py`
```
"""
Adaptive Web Crawler for Crawl4AI

This module implements adaptive information foraging for efficient web crawling.
It determines when sufficient information has been gathered to answer a query,
avoiding unnecessary crawls while ensuring comprehensive coverage.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Set, Tuple, Any, Union
from dataclasses import dataclass, field
import asyncio
import pickle
import os
import json
import math
from collections import defaultdict, Counter
import re
from pathlib import Path

from crawl4ai.async_webcrawler import AsyncWebCrawler
from crawl4ai.async_configs import CrawlerRunConfig, LinkPreviewConfig, LLMConfig
from crawl4ai.models import Link, CrawlResult
import numpy as np

@dataclass
class CrawlState:
    """Tracks the current state of adaptive crawling"""
    crawled_urls: Set[str] = field(default_factory=set)
    knowledge_base: List[CrawlResult] = field(default_factory=list)
    pending_links: List[Link] = field(default_factory=list)
    query: str = ""
    metrics: Dict[str, float] = field(default_factory=dict)
    
    # Statistical tracking
    term_frequencies: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    document_frequencies: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    documents_with_terms: Dict[str, Set[int]] = field(default_factory=lambda: defaultdict(set))
    total_documents: int = 0
    
    # History tracking for saturation
    new_terms_history: List[int] = field(default_factory=list)
    crawl_order: List[str] = field(default_factory=list)
    
    # Embedding-specific tracking (only if strategy is embedding)
    kb_embeddings: Optional[Any] = None  # Will be numpy array
    query_embeddings: Optional[Any] = None  # Will be numpy array
    expanded_queries: List[str] = field(default_factory=list)
    coverage_shape: Optional[Any] = None  # Alpha shape
    semantic_gaps: List[Tuple[List[float], float]] = field(default_factory=list)  # Serializable
    embedding_model: str = ""
    
    def save(self, path: Union[str, Path]):
        """Save state to disk for persistence"""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # Convert CrawlResult objects to dicts for serialization
        state_dict = {
            'crawled_urls': list(self.crawled_urls),
            'knowledge_base': [self._crawl_result_to_dict(cr) for cr in self.knowledge_base],
            'pending_links': [link.model_dump() for link in self.pending_links],
            'query': self.query,
            'metrics': self.metrics,
            'term_frequencies': dict(self.term_frequencies),
            'document_frequencies': dict(self.document_frequencies),
            'documents_with_terms': {k: list(v) for k, v in self.documents_with_terms.items()},
            'total_documents': self.total_documents,
            'new_terms_history': self.new_terms_history,
            'crawl_order': self.crawl_order,
            # Embedding-specific fields (convert numpy arrays to lists for JSON)
            'kb_embeddings': self.kb_embeddings.tolist() if self.kb_embeddings is not None else None,
            'query_embeddings': self.query_embeddings.tolist() if self.query_embeddings is not None else None,
            'expanded_queries': self.expanded_queries,
            'semantic_gaps': self.semantic_gaps,
            'embedding_model': self.embedding_model
        }
        
        with open(path, 'w') as f:
            json.dump(state_dict, f, indent=2)
    
    @classmethod
    def load(cls, path: Union[str, Path]) -> 'CrawlState':
        """Load state from disk"""
        path = Path(path)
        with open(path, 'r') as f:
            state_dict = json.load(f)
        
        state = cls()
        state.crawled_urls = set(state_dict['crawled_urls'])
        state.knowledge_base = [cls._dict_to_crawl_result(d) for d in state_dict['knowledge_base']]
        state.pending_links = [Link(**link_dict) for link_dict in state_dict['pending_links']]
        state.query = state_dict['query']
        state.metrics = state_dict['metrics']
        state.term_frequencies = defaultdict(int, state_dict['term_frequencies'])
        state.document_frequencies = defaultdict(int, state_dict['document_frequencies'])
        state.documents_with_terms = defaultdict(set, {k: set(v) for k, v in state_dict['documents_with_terms'].items()})
        state.total_documents = state_dict['total_documents']
        state.new_terms_history = state_dict['new_terms_history']
        state.crawl_order = state_dict['crawl_order']
        
        # Load embedding-specific fields (convert lists back to numpy arrays)
        
        state.kb_embeddings = np.array(state_dict['kb_embeddings']) if state_dict.get('kb_embeddings') is not None else None
        state.query_embeddings = np.array(state_dict['query_embeddings']) if state_dict.get('query_embeddings') is not None else None
        state.expanded_queries = state_dict.get('expanded_queries', [])
        state.semantic_gaps = state_dict.get('semantic_gaps', [])
        state.embedding_model = state_dict.get('embedding_model', '')
        
        return state
    
    @staticmethod
    def _crawl_result_to_dict(cr: CrawlResult) -> Dict:
        """Convert CrawlResult to serializable dict"""
        # Extract markdown content safely
        markdown_content = ""
        if hasattr(cr, 'markdown') and cr.markdown:
            if hasattr(cr.markdown, 'raw_markdown'):
                markdown_content = cr.markdown.raw_markdown
            else:
                markdown_content = str(cr.markdown)
        
        return {
            'url': cr.url,
            'content': markdown_content,
            'links': cr.links if hasattr(cr, 'links') else {},
            'metadata': cr.metadata if hasattr(cr, 'metadata') else {}
        }
    
    @staticmethod
    def _dict_to_crawl_result(d: Dict):
        """Convert dict back to CrawlResult"""
        # Create a mock object that has the minimal interface we need
        class MockMarkdown:
            def __init__(self, content):
                self.raw_markdown = content
        
        class MockCrawlResult:
            def __init__(self, url, content, links, metadata):
                self.url = url
                self.markdown = MockMarkdown(content)
                self.links = links
                self.metadata = metadata
        
        return MockCrawlResult(
            url=d['url'],
            content=d.get('content', ''),
            links=d.get('links', {}),
            metadata=d.get('metadata', {})
        )


@dataclass
class AdaptiveConfig:
    """Configuration for adaptive crawling"""
    confidence_threshold: float = 0.7
    max_depth: int = 5
    max_pages: int = 20
    top_k_links: int = 3
    min_gain_threshold: float = 0.1
    strategy: str = "statistical"  # statistical, embedding, llm
    
    # Advanced parameters
    saturation_threshold: float = 0.8
    consistency_threshold: float = 0.7
    coverage_weight: float = 0.4
    consistency_weight: float = 0.3
    saturation_weight: float = 0.3
    
    # Link scoring parameters
    relevance_weight: float = 0.5
    novelty_weight: float = 0.3
    authority_weight: float = 0.2
    
    # Persistence
    save_state: bool = False
    state_path: Optional[str] = None
    
    # Embedding strategy parameters
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_llm_config: Optional[Union[LLMConfig, Dict]] = None  # Separate config for embeddings
    query_llm_config: Optional[Union[LLMConfig, Dict]] = None  # Config for query expansion (chat completion)
    n_query_variations: int = 10
    coverage_threshold: float = 0.85
    alpha_shape_alpha: float = 0.5
    
    # Minimum confidence threshold for relevance
    embedding_min_confidence_threshold: float = 0.1  # Below this, content is considered completely irrelevant
    # Example: If confidence < 0
```

### Core Architecture Module: `crawl4ai/antibot_detector.py`
```
"""
Anti-bot detection heuristics for crawl results.

Examines HTTP status codes and HTML content patterns to determine
if a crawl was blocked by anti-bot protection.

Detection philosophy: false positives are cheap (the fallback mechanism
rescues them), false negatives are catastrophic (user gets garbage).
Err on the side of detection.

Detection is layered:
- HTTP 403/503 with HTML content → always blocked (these are never desired content)
- Tier 1 patterns (structural markers) trigger on any page size
- Tier 2 patterns (generic terms) trigger on short pages or any error status
- Tier 3 structural integrity catches silent blocks and empty shells
"""

import re
from typing import Optional, Tuple


# ---------------------------------------------------------------------------
# Tier 1: High-confidence structural markers (single signal sufficient)
# These are unique to block pages and virtually never appear in real content.
# ---------------------------------------------------------------------------
_TIER1_PATTERNS = [
    # Akamai — full reference pattern: Reference #18.2d351ab8.1557333295.a4e16ab
    (re.compile(r"Reference\s*#\s*[\d]+\.[0-9a-f]+\.\d+\.[0-9a-f]+", re.IGNORECASE),
     "Akamai block (Reference #)"),
    # Akamai — "Pardon Our Interruption" challenge page
    (re.compile(r"Pardon\s+Our\s+Interruption", re.IGNORECASE),
     "Akamai challenge (Pardon Our Interruption)"),
    # Cloudflare — challenge form with anti-bot token
    (re.compile(r'challenge-form.*?__cf_chl_f_tk=', re.IGNORECASE | re.DOTALL),
     "Cloudflare challenge form"),
    # Cloudflare — error code spans (1020 Access Denied, 1010, 1012, 1015)
    (re.compile(r'<span\s+class="cf-error-code">\d{4}</span>', re.IGNORECASE),
     "Cloudflare firewall block"),
    # Cloudflare — IUAM challenge script
    (re.compile(r'/cdn-cgi/challenge-platform/\S+orchestrate', re.IGNORECASE),
     "Cloudflare JS challenge"),
    # PerimeterX / HUMAN — block page with app ID assignment (not prose mentions)
    (re.compile(r"window\._pxAppId\s*=", re.IGNORECASE),
     "PerimeterX block"),
    # PerimeterX — captcha CDN
    (re.compile(r"captcha\.px-cdn\.net", re.IGNORECASE),
     "PerimeterX captcha"),
    # DataDome — captcha delivery domain (structural, not the word "datadome")
    (re.compile(r"captcha-delivery\.com", re.IGNORECASE),
     "DataDome captcha"),
    # Imperva/Incapsula — resource iframe
    (re.compile(r"_Incapsula_Resource", re.IGNORECASE),
     "Imperva/Incapsula block"),
    # Imperva/Incapsula — incident ID
    (re.compile(r"Incapsula\s+incident\s+ID", re.IGNORECASE),
     "Imperva/Incapsula incident"),
    # Sucuri firewall
    (re.compile(r"Sucuri\s+WebSite\s+Firewall", re.IGNORECASE),
     "Sucuri firewall block"),
    # Kasada
    (re.compile(r"KPSDK\.scriptStart\s*=\s*KPSDK\.now\(\)", re.IGNORECASE),
     "Kasada challenge"),
    # Network security block — Reddit and other platforms serve large SPA shells
    # with this message buried under 100KB+ of CSS/JS
    (re.compile(r"blocked\s+by\s+network\s+security", re.IGNORECASE),
     "Network security block"),
]

# ---------------------------------------------------------------------------
# Tier 2: Medium-confidence patterns — only match on SHORT pages (< 10KB)
# These terms appear in real content (articles, login forms, security blogs)
# so we require the page to be small to avoid false positives.
# ---------------------------------------------------------------------------
_TIER2_PATTERNS = [
    # Akamai / generic — "Access Denied" (extremely common on legit 403s too)
    (re.compile(r"Access\s+Denied", re.IGNORECASE),
     "Access Denied on short page"),
    # Cloudflare — "Just a moment" / "Checking your browser"
    (re.compile(r"Checking\s+your\s+browser", re.IGNORECASE),
     "Cloudflare browser check"),
    (re.compile(r"<title>\s*Just\s+a\s+moment", re.IGNORECASE),
     "Cloudflare interstitial"),
    # CAPTCHA on a block page (not a login form — login forms are big pages)
    (re.compile(r'class=["\']g-recaptcha["\']', re.IGNORECASE),
     "reCAPTCHA on block page"),
    (re.compile(r'class=["\']h-captcha["\']', re.IGNORECASE),
     "hCaptcha on block page"),
    # PerimeterX block page title
    (re.compile(r"Access\s+to\s+This\s+Page\s+Has\s+Been\s+Blocked", re.IGNORECASE),
     "PerimeterX block page"),
    # Generic block phrases (only on short pages to avoid matching articles)
    (re.compile(r"blocked\s+by\s+security", re.IGNORECASE),
     "Blocked by security"),
    (re.compile(r"Request\s+unsuccessful", re.IGNORECASE),
     "Request unsuccessful (Imperva)"),
]

_TIER2_MAX_SIZE = 10000  # Only check tier 2 patterns on pages under 10KB

# ---------------------------------------------------------------------------
# Tier 3: Structural integrity — catches silent blocks, anti-bot redirects,
# incomplete renders that pass pattern detection but are structurally broken
# ---------------------------------------------------------------------------
_STRUCTURAL_MAX_SIZE = 50000  # Only check pages under 50KB
_CONTENT_ELEMENTS_RE = re.compile(
    r'<(?:p|h[1-6]|article|section|li|td|a|pre)\b', re.IGNORECASE
)
_SCRIPT_TAG_RE = re.compile(r'<script\b', re.IGNORECASE)
_STYLE_TAG_RE = re.compile(r'<style\b[\s\S]*?</style>', re.IGNORECASE)
_SCRIPT_BLOCK_RE = re.compile(r'<script\b[\s\S]*?</script>', re.IGNORECASE)
_TAG_RE = re.compile(r'<[^>]+>')
_BODY_RE = re.compile(r'<body\b', re.IGNORECASE)

# ---------------------------------------------------------------------------
# Thresholds
# ---------------------------------------------------------------------------
_BLOCK_PAGE_MAX_SIZE = 5000   # 403 + short page = likely block
_EMPTY_CONTENT_THRESHOLD = 100  # 200 + near-empty = JS-blocked render


def _looks_like_data(html: str) -> bool:
    """Check if content looks like a JSON/XML API response (not an HTML block page)."""
    stripped = html.strip()
    if not stripped:
        return False
    # Raw JSON/XML (not wrapped in HTML)
    if stripped[0] in ('{', '['):
        return True
    # Browser-rendered JSON: browsers wrap raw JSON in <html><body><pre>{...}</pre>
    if stripped[:10].lower().startswith(('<html', '<!')):
        if re.search(r'<body[^>]*>\s*<pre[^>]*>\s*[{\[]', stripped[:500], re.IGNORECASE):
            return True
        return False
    # Other XML-like content
    return stripped[0] == '<'


def _structural_integrity_check(html: str) -> Tuple[bool, str]:
    """
    Tier 3: Structural integrity check for pages that pass pattern detection
    but are structurally broken — incomplete renders, anti-bot redirects, empty shells.

    Only applies to pages < 50KB that aren't JSON/XML.

    Returns:
        Tuple of (is_blocked, reason).
    """
    html_len = len(html)

    # Skip large pages (unlikely to be block pages) and data responses
    if html_len > _STRUCTURAL_MAX_SIZE or _looks_like_data(html):
        return False, ""

    signals = []

    # Signal 1: No <body> tag — definitive structural failure
    if not _BODY_RE.search(html):
        return True, f"Structural: no <body> tag ({html_len} bytes)"

    # Signal 2: Minimal visible text after stripping scripts/styles/tags
    body_match = re.search(r'<body\b[^>]*>([\s\S]*)</body>', html, re.IGNORECASE)
    body_content = body_match.group(1) if body_match else html
    stripped = _SCRIPT_BLOCK_RE.sub('', body_content)
    stripped = _STYLE_TAG_RE.sub('', stripped)
    visible_text = _TAG_RE.sub('', stripped).strip()
    visible_len = len(visible_text)
    if visible_len < 50:
        signals.append("minimal_text")

    # Signal 3: No content elements (semantic HTML)
    content_elements = len(_CONTENT_ELEMENTS_RE.findall(html))
    if content_elements == 0:
        signals.append("no_content_elements")

    # Signal 4: Script-heavy shell — scripts present but no content
    script_count = len(_SCRIPT_TAG_RE.findall(html))
    if script_count > 0 and content_elements == 0 and visible_len < 100:
        signals.append("script_heavy_shell"
```

### Core Architecture Module: `crawl4ai/async_configs.py`
```
import copy
import functools
import importlib
import os
import warnings
import requests
from .config import (
    DEFAULT_PROVIDER,
    DEFAULT_PROVIDER_API_KEY,
    MIN_WORD_THRESHOLD,
    IMAGE_DESCRIPTION_MIN_WORD_THRESHOLD,
    PROVIDER_MODELS,
    PROVIDER_MODELS_PREFIXES,
    SCREENSHOT_HEIGHT_TRESHOLD,
    PAGE_TIMEOUT,
    IMAGE_SCORE_THRESHOLD,
    SOCIAL_MEDIA_DOMAINS,
)

from .user_agent_generator import UAGen, ValidUAGenerator  # , OnlineUAGenerator
from .extraction_strategy import ExtractionStrategy, LLMExtractionStrategy
from .chunking_strategy import ChunkingStrategy, RegexChunking

from .markdown_generation_strategy import MarkdownGenerationStrategy, DefaultMarkdownGenerator
from .content_scraping_strategy import ContentScrapingStrategy, LXMLWebScrapingStrategy
from .deep_crawling import DeepCrawlStrategy
from .table_extraction import TableExtractionStrategy, DefaultTableExtraction

from .cache_context import CacheMode
from .proxy_strategy import ProxyRotationStrategy

import inspect
from typing import Any, Awaitable, Callable, Dict, List, Optional, Union
from enum import Enum

# Type alias for URL matching
UrlMatcher = Union[str, Callable[[str], bool], List[Union[str, Callable[[str], bool]]]]


def _with_defaults(cls):
    """Class decorator: adds set_defaults/get_defaults/reset_defaults classmethods.

    After decorating, every new instance resolves parameters as:
        explicit arg  >  class-level user defaults  >  hardcoded default

    Usage::

        BrowserConfig.set_defaults(headless=False, viewport_width=1920)
        cfg = BrowserConfig()          # headless=False, viewport_width=1920
        cfg = BrowserConfig(headless=True)  # explicit wins → headless=True
    """
    original_init = cls.__init__
    sig = inspect.signature(original_init)
    param_names = [p for p in sig.parameters if p != "self"]
    valid_params = frozenset(param_names)

    @functools.wraps(original_init)
    def wrapped_init(self, *args, **kwargs):
        user_defaults = type(self)._user_defaults
        if user_defaults:
            # Determine which params the caller passed explicitly
            explicit = set(kwargs.keys())
            for i in range(len(args)):
                if i < len(param_names):
                    explicit.add(param_names[i])
            # Inject user defaults for non-explicit params
            for key, value in user_defaults.items():
                if key not in explicit:
                    kwargs[key] = copy.deepcopy(value)
        original_init(self, *args, **kwargs)

    cls.__init__ = wrapped_init
    cls._user_defaults = {}

    @classmethod
    def set_defaults(klass, **kwargs):
        """Set class-level default overrides for new instances.

        Args:
            **kwargs: Parameter names and their default values.

        Raises:
            ValueError: If any key is not a valid ``__init__`` parameter.
        """
        invalid = set(kwargs) - valid_params
        if invalid:
            raise ValueError(
                f"Invalid parameter(s) for {klass.__name__}: {invalid}"
            )
        for k, v in kwargs.items():
            klass._user_defaults[k] = copy.deepcopy(v)

    @classmethod
    def get_defaults(klass):
        """Return a deep copy of the current class-level defaults."""
        return copy.deepcopy(klass._user_defaults)

    @classmethod
    def reset_defaults(klass, *names):
        """Clear class-level defaults.

        With no arguments, removes all overrides.
        With arguments, removes only the named overrides.
        """
        if names:
            for n in names:
                klass._user_defaults.pop(n, None)
        else:
            klass._user_defaults.clear()

    cls.set_defaults = set_defaults
    cls.get_defaults = get_defaults
    cls.reset_defaults = reset_defaults
    return cls


class MatchMode(Enum):
    OR = "or"
    AND = "and"

# from .proxy_strategy import ProxyConfig

# Allowlist of types that can be deserialized via from_serializable_dict().
# This prevents arbitrary class instantiation from untrusted input (e.g. API requests).
ALLOWED_DESERIALIZE_TYPES = {
    # Config classes
    "BrowserConfig", "CrawlerRunConfig", "HTTPCrawlerConfig",
    "LLMConfig", "ProxyConfig", "GeolocationConfig",
    "SeedingConfig", "VirtualScrollConfig", "LinkPreviewConfig", "DomainMapperConfig",
    # Extraction strategies
    "JsonCssExtractionStrategy", "JsonXPathExtractionStrategy",
    "JsonLxmlExtractionStrategy", "LLMExtractionStrategy",
    "CosineStrategy", "RegexExtractionStrategy",
    # Markdown / content
    "DefaultMarkdownGenerator",
    "PruningContentFilter", "PruningContentFilterLXML", "BM25ContentFilter", "LLMContentFilter",
    # Scraping
    "LXMLWebScrapingStrategy", "PDFContentScrapingStrategy",
    # Chunking
    "RegexChunking",
    # Deep crawl
    "BFSDeepCrawlStrategy", "DFSDeepCrawlStrategy", "BestFirstCrawlingStrategy",
    # Filters & scorers
    "FilterChain", "URLPatternFilter", "DomainFilter",
    "ContentTypeFilter", "URLFilter", "SEOFilter", "ContentRelevanceFilter",
    "KeywordRelevanceScorer", "URLScorer", "CompositeScorer",
    "DomainAuthorityScorer", "FreshnessScorer", "PathDepthScorer",
    # Enums
    "CacheMode", "MatchMode", "DisplayMode",
    # Dispatchers
    "MemoryAdaptiveDispatcher", "SemaphoreDispatcher",
    # Table extraction
    "DefaultTableExtraction", "NoTableExtraction", "LLMTableExtraction",
    # Proxy
    "RoundRobinProxyStrategy",
}


# ───────────────────────── untrusted-input trust boundary ─────────────────────────
# When a config is deserialized from an untrusted source (a network request body
# on the Docker server), it may only construct a strict subset of types and may
# only set scalar, non-power fields, which are then clamped. SDK / in-process use
# is TRUSTED by default, so this changes nothing for library callers.


class Provenance(Enum):
    """Where deserialized config data came from.

    TRUSTED   - SDK / in-process construction (unchanged behavior).
    UNTRUSTED - a network request body; gated by the allowlists below.
    """
    TRUSTED = "trusted"
    UNTRUSTED = "untrusted"


class UntrustedConfigError(ValueError):
    """An untrusted request tried to construct a forbidden type or set a
    forbidden power-field. The Docker layer maps this to HTTP 400."""


# Types an untrusted body may construct - a strict subset of
# ALLOWED_DESERIALIZE_TYPES. Deliberately EXCLUDES everything that can run code,
# read secrets, route traffic, or recurse the crawl: LLMConfig,
# LLMExtractionStrategy, LLMContentFilter, LLMTableExtraction, ProxyConfig,
# RoundRobinProxyStrategy, all DeepCrawl*/Filter/Scorer/Dispatcher classes,
# SeedingConfig and DomainMapperConfig.
UNTRUSTED_ALLOWED_TYPES = {
    "CrawlerRunConfig", "BrowserConfig", "HTTPCrawlerConfig",
    "GeolocationConfig", "VirtualScrollConfig", "LinkPreviewConfig",
    # non-LLM extraction / markdown / scraping / chunking strategies
    "JsonCssExtractionStrategy", "JsonXPathExtractionStrategy",
    "JsonLxmlExtractionStrategy", "RegexExtractionStrategy", "CosineStrategy",
    "DefaultMarkdownGenerator", "PruningContentFilter", "PruningContentFilterLXML", "BM25ContentFilter",
    "LXMLWebScrapingStrategy", "PDFContentScrapingStrategy",
    "RegexChunking",
    "DefaultTableExtraction", "NoTableExtraction",
    # safe scalar enums
    "CacheMode", "MatchMode", "DisplayMode",
}

# Fields that must NEVER come from an untrusted body. Presence => 400 (loud), so
# a client smuggling these gets an explicit error rather than a silent drop.
UNTRUSTED_FORBIDDEN_FIELDS = {
    "BrowserConfig": {
        "proxy", "proxy_config", "extra_args", "user_data_dir", "channel",
        "chrome_channel", "cdp_url", "debugging_port", "host", "storage_state",
        "cookies", "headers", "init_scripts", "browser_context_id", "target_id",
    },
    "CrawlerRunConfig": {
        "js_code", "js_code_before_wait", "c4a_script", "deep_crawl_strategy",
        "pr
```

### Core Architecture Module: `crawl4ai/async_crawler_strategy.py`
```
from __future__ import annotations

import asyncio
import base64
import time
from abc import ABC, abstractmethod
from typing import Callable, Dict, Any, List, Union
from typing import Optional, AsyncGenerator, Final
import os
from playwright.async_api import Page, Error
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import hashlib
import random
import uuid
from .js_snippet import load_js_script
from .models import AsyncCrawlResponse
from .config import SCREENSHOT_HEIGHT_TRESHOLD
from .async_configs import BrowserConfig, CrawlerRunConfig, HTTPCrawlerConfig
from .async_logger import AsyncLogger
from .ssl_certificate import SSLCertificate
from .user_agent_generator import ValidUAGenerator, UAGen
from .browser_manager import BrowserManager
from .browser_adapter import BrowserAdapter, PlaywrightAdapter, UndetectedAdapter

import aiofiles
import aiohttp
import chardet
from aiohttp.client import ClientTimeout
from urllib.parse import urlparse
from types import MappingProxyType
import contextlib
from functools import partial

class AsyncCrawlerStrategy(ABC):
    """
    Abstract base class for crawler strategies.
    Subclasses must implement the crawl method.
    """

    @abstractmethod
    async def crawl(self, url: str, **kwargs) -> AsyncCrawlResponse:
        pass  # 4 + 3

class AsyncPlaywrightCrawlerStrategy(AsyncCrawlerStrategy):
    """
    Crawler strategy using Playwright.

    Attributes:
        browser_config (BrowserConfig): Configuration object containing browser settings.
        logger (AsyncLogger): Logger instance for recording events and errors.
        _downloaded_files (List[str]): List of downloaded file paths.
        hooks (Dict[str, Callable]): Dictionary of hooks for custom behavior.
        browser_manager (BrowserManager): Manager for browser creation and management.

        Methods:
            __init__(self, browser_config=None, logger=None, **kwargs):
                Initialize the AsyncPlaywrightCrawlerStrategy with a browser configuration.
            __aenter__(self):
                Start the browser and initialize the browser manager.
            __aexit__(self, exc_type, exc_val, exc_tb):
                Close the browser and clean up resources.
            start(self):
                Start the browser and initialize the browser manager.
            close(self):
                Close the browser and clean up resources.
            kill_session(self, session_id):
                Kill a browser session and clean up resources.
            crawl(self, url, **kwargs):
                Run the crawler for a single URL.

    """

    def __init__(
        self, browser_config: BrowserConfig = None, logger: AsyncLogger = None, browser_adapter: BrowserAdapter = None, **kwargs
    ):
        """
        Initialize the AsyncPlaywrightCrawlerStrategy with a browser configuration.

        Args:
            browser_config (BrowserConfig): Configuration object containing browser settings.
                                          If None, will be created from kwargs for backwards compatibility.
            logger: Logger instance for recording events and errors.
            browser_adapter (BrowserAdapter): Browser adapter for handling browser-specific operations.
                                           If None, defaults to PlaywrightAdapter.
            **kwargs: Additional arguments for backwards compatibility and extending functionality.
        """
        # Initialize browser config, either from provided object or kwargs
        self.browser_config = browser_config or BrowserConfig.from_kwargs(kwargs)
        # Initialize with default logger if none provided to prevent NoneType errors
        self.logger = logger if logger is not None else AsyncLogger(verbose=False)
        
        # Initialize browser adapter
        self.adapter = browser_adapter or PlaywrightAdapter()

        # Initialize session management
        self._downloaded_files = []

        # Initialize hooks system
        self.hooks = {
            "on_browser_created": None,
            "on_page_context_created": None,
            "on_user_agent_updated": None,
            "on_execution_started": None,
            "on_execution_ended": None,
            "before_goto": None,
            "after_goto": None,
            "before_return_html": None,
            "before_retrieve_html": None,
        }

        # Initialize browser manager with config
        self.browser_manager = BrowserManager(
            browser_config=self.browser_config, 
            logger=self.logger,
            use_undetected=isinstance(self.adapter, UndetectedAdapter)
        )

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def start(self):
        """
        Start the browser and initialize the browser manager.
        """
        await self.browser_manager.start()
        await self.execute_hook(
            "on_browser_created",
            self.browser_manager.browser,
            context=self.browser_manager.default_context,
        )

    async def close(self):
        """
        Close the browser and clean up resources.
        """
        await self.browser_manager.close()
        # Explicitly reset the static Playwright instance (skip if using cached CDP)
        if not self.browser_manager._using_cached_cdp:
            BrowserManager._playwright_instance = None

    async def kill_session(self, session_id: str):
        """
        Kill a browser session and clean up resources.

        Args:
            session_id (str): The ID of the session to kill.

        Returns:
            None
        """
        # Log a warning message and no need kill session, in new version auto kill session
        self.logger.warning(
            message="Session auto-kill is enabled in the new version. No need to manually kill sessions.",
            tag="WARNING",
        )
        await self.browser_manager.kill_session(session_id)

    def set_hook(self, hook_type: str, hook: Callable):
        """
        Set a hook function for a specific hook type. Following are list of hook types:
        - on_browser_created: Called when a new browser instance is created.
        - on_page_context_created: Called when a new page context is created.
        - on_user_agent_updated: Called when the user agent is updated.
        - on_execution_started: Called when the execution starts.
        - before_goto: Called before a goto operation.
        - after_goto: Called after a goto operation.
        - before_return_html: Called before returning HTML content.
        - before_retrieve_html: Called before retrieving HTML content.

        All hooks except on_browser_created accepts a context and a page as arguments and **kwargs. However, on_browser_created accepts a browser and a context as arguments and **kwargs.

        Args:
            hook_type (str): The type of the hook.
            hook (Callable): The hook function to set.

        Returns:
            None
        """
        if hook_type in self.hooks:
            self.hooks[hook_type] = hook
        else:
            raise ValueError(f"Invalid hook type: {hook_type}")

    async def execute_hook(self, hook_type: str, *args, **kwargs):
        """
        Execute a hook function for a specific hook type.

        Args:
            hook_type (str): The type of the hook.
            *args: Variable length positional arguments.
            **kwargs: Keyword arguments.

        Returns:
            The return value of the hook function, if any.
        """
        hook = self.hooks.get(hook_type)
        if hook:
            if asyncio.iscoroutinefunction(hook):
                return await hook(*args, **kwargs)
            else:
                return hook(*args, **kwargs)
        return args[0] if args else None

    def u
```

### Core Architecture Module: `crawl4ai/async_database.py`
```
import os
import time
from pathlib import Path
import aiosqlite
import asyncio
from typing import Optional, Dict
from contextlib import asynccontextmanager
import json
from .models import CrawlResult, MarkdownGenerationResult, StringCompatibleMarkdown
import aiofiles
from .async_logger import AsyncLogger

from .utils import ensure_content_dirs, generate_content_hash
from .utils import VersionManager
from .utils import get_error_context, create_box_message

base_directory = DB_PATH = os.path.join(
    os.getenv("CRAWL4_AI_BASE_DIRECTORY", Path.home()), ".crawl4ai"
)
os.makedirs(DB_PATH, exist_ok=True)
DB_PATH = os.path.join(base_directory, "crawl4ai.db")


class AsyncDatabaseManager:
    def __init__(self, pool_size: int = 10, max_retries: int = 3):
        self.db_path = DB_PATH
        self.content_paths = ensure_content_dirs(os.path.dirname(DB_PATH))
        self.pool_size = pool_size
        self.max_retries = max_retries
        self.connection_pool: Dict[int, aiosqlite.Connection] = {}
        self.pool_lock = asyncio.Lock()
        self.init_lock = asyncio.Lock()
        self.connection_semaphore = asyncio.Semaphore(pool_size)
        self._initialized = False
        self.version_manager = VersionManager()
        self.logger = AsyncLogger(
            log_file=os.path.join(base_directory, ".crawl4ai", "crawler_db.log"),
            verbose=False,
            tag_width=10,
        )

    async def initialize(self):
        """Initialize the database and connection pool"""
        try:
            self.logger.info("Initializing database", tag="INIT")
            # Ensure the database file exists
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)

            # Check if version update is needed
            needs_update = self.version_manager.needs_update()

            # Always ensure base table exists
            await self.ainit_db()

            # Verify the table exists
            async with aiosqlite.connect(self.db_path, timeout=30.0) as db:
                async with db.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='crawled_data'"
                ) as cursor:
                    result = await cursor.fetchone()
                    if not result:
                        raise Exception("crawled_data table was not created")

            # If version changed or fresh install, run updates
            if needs_update:
                self.logger.info("New version detected, running updates", tag="INIT")
                await self.update_db_schema()
                from .migrations import (
                    run_migration,
                )  # Import here to avoid circular imports

                await run_migration()
                self.version_manager.update_version()  # Update stored version after successful migration
                self.logger.success(
                    "Version update completed successfully", tag="COMPLETE"
                )
            else:
                self.logger.success(
                    "Database initialization completed successfully", tag="COMPLETE"
                )

        except Exception as e:
            self.logger.error(
                message="Database initialization error: {error}",
                tag="ERROR",
                params={"error": str(e)},
            )
            self.logger.info(
                message="Database will be initialized on first use", tag="INIT"
            )

            raise

    async def cleanup(self):
        """Cleanup connections when shutting down"""
        async with self.pool_lock:
            for conn in self.connection_pool.values():
                await conn.close()
            self.connection_pool.clear()

    @asynccontextmanager
    async def get_connection(self):
        """Connection pool manager with enhanced error handling"""
        if not self._initialized:
            async with self.init_lock:
                if not self._initialized:
                    try:
                        await self.initialize()
                        self._initialized = True
                    except Exception as e:
                        import sys

                        error_context = get_error_context(sys.exc_info())
                        self.logger.error(
                            message="Database initialization failed:\n{error}\n\nContext:\n{context}\n\nTraceback:\n{traceback}",
                            tag="ERROR",
                            force_verbose=True,
                            params={
                                "error": str(e),
                                "context": error_context["code_context"],
                                "traceback": error_context["full_traceback"],
                            },
                        )
                        raise

        await self.connection_semaphore.acquire()
        task_id = id(asyncio.current_task())

        try:
            async with self.pool_lock:
                if task_id not in self.connection_pool:
                    try:
                        conn = await aiosqlite.connect(self.db_path, timeout=30.0)
                        await conn.execute("PRAGMA journal_mode = WAL")
                        await conn.execute("PRAGMA busy_timeout = 5000")

                        # Verify database structure
                        async with conn.execute(
                            "PRAGMA table_info(crawled_data)"
                        ) as cursor:
                            columns = await cursor.fetchall()
                            column_names = [col[1] for col in columns]
                            expected_columns = {
                                "url",
                                "html",
                                "cleaned_html",
                                "markdown",
                                "extracted_content",
                                "success",
                                "media",
                                "links",
                                "metadata",
                                "screenshot",
                                "response_headers",
                                "downloaded_files",
                            }
                            missing_columns = expected_columns - set(column_names)
                            if missing_columns:
                                raise ValueError(
                                    f"Database missing columns: {missing_columns}"
                                )

                        self.connection_pool[task_id] = conn
                    except Exception as e:
                        import sys

                        error_context = get_error_context(sys.exc_info())
                        error_message = (
                            f"Unexpected error in db get_connection at line {error_context['line_no']} "
                            f"in {error_context['function']} ({error_context['filename']}):\n"
                            f"Error: {str(e)}\n\n"
                            f"Code context:\n{error_context['code_context']}"
                        )
                        self.logger.error(
                            message="{error}",
                            tag="ERROR",
                            params={"error": str(error_message)},
                            boxes=["error"],
                        )

                        raise

            yield self.connection_pool[task_id]

        except Exception as e:
            import sys

            error_context = get_error_context(sys.exc_info())
            error_message = (
                f"Unexpected error in db get_connection at line {error_context['line_no']} "
                f"in {error_context['function']} ({error_context['filename']}):\n"
                f"Error: {str(e)}\n\n"
                f"Code context:\n{error_context['code_context']}"
            )
            self.logger.error(
          
```

### Core Architecture Module: `crawl4ai/async_dispatcher.py`
```
from typing import Dict, Optional, List, Tuple, Union
from .async_configs import CrawlerRunConfig
from .models import (
    CrawlResult,
    CrawlerTaskResult,
    CrawlStatus,
    DomainState,
)

from .components.crawler_monitor import CrawlerMonitor

from .types import AsyncWebCrawler

from collections.abc import AsyncGenerator

import time
import psutil
import asyncio
import uuid

from urllib.parse import urlparse
import random
from abc import ABC, abstractmethod

from .utils import get_true_memory_usage_percent


class RateLimiter:
    def __init__(
        self,
        base_delay: Tuple[float, float] = (1.0, 3.0),
        max_delay: float = 60.0,
        max_retries: int = 3,
        rate_limit_codes: List[int] = None,
    ):
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.max_retries = max_retries
        self.rate_limit_codes = rate_limit_codes or [429, 503]
        self.domains: Dict[str, DomainState] = {}

    def get_domain(self, url: str) -> str:
        return urlparse(url).netloc

    async def wait_if_needed(self, url: str) -> None:
        domain = self.get_domain(url)
        state = self.domains.get(domain)

        if not state:
            self.domains[domain] = DomainState()
            state = self.domains[domain]

        now = time.time()
        if state.last_request_time:
            wait_time = max(0, state.current_delay - (now - state.last_request_time))
            if wait_time > 0:
                await asyncio.sleep(wait_time)

        # Random delay within base range if no current delay
        if state.current_delay == 0:
            state.current_delay = random.uniform(*self.base_delay)

        state.last_request_time = time.time()

    def update_delay(self, url: str, status_code: int) -> bool:
        domain = self.get_domain(url)
        state = self.domains[domain]

        if status_code in self.rate_limit_codes:
            state.fail_count += 1
            if state.fail_count > self.max_retries:
                return False

            # Exponential backoff with random jitter
            state.current_delay = min(
                state.current_delay * 2 * random.uniform(0.75, 1.25), self.max_delay
            )
        else:
            # Gradually reduce delay on success
            state.current_delay = max(
                random.uniform(*self.base_delay), state.current_delay * 0.75
            )
            state.fail_count = 0

        return True



class BaseDispatcher(ABC):
    def __init__(
        self,
        rate_limiter: Optional[RateLimiter] = None,
        monitor: Optional[CrawlerMonitor] = None,
    ):
        self.crawler = None
        self._domain_last_hit: Dict[str, float] = {}
        self.concurrent_sessions = 0
        self.rate_limiter = rate_limiter
        self.monitor = monitor

    def select_config(self, url: str, configs: Union[CrawlerRunConfig, List[CrawlerRunConfig]]) -> Optional[CrawlerRunConfig]:
        """Select the appropriate config for a given URL.
        
        Args:
            url: The URL to match against
            configs: Single config or list of configs to choose from
            
        Returns:
            The matching config, or None if no match found
        """
        # Single config - return as is
        if isinstance(configs, CrawlerRunConfig):
            return configs
        
        # Empty list - return None
        if not configs:
            return None
        
        # Find first matching config
        for config in configs:
            if config.is_match(url):
                return config
        
        # No match found - return None to indicate URL should be skipped
        return None

    @abstractmethod
    async def crawl_url(
        self,
        url: str,
        config: Union[CrawlerRunConfig, List[CrawlerRunConfig]],
        task_id: str,
        monitor: Optional[CrawlerMonitor] = None,
    ) -> CrawlerTaskResult:
        pass

    @abstractmethod
    async def run_urls(
        self,
        urls: List[str],
        crawler: AsyncWebCrawler,  # noqa: F821
        config: Union[CrawlerRunConfig, List[CrawlerRunConfig]],
        monitor: Optional[CrawlerMonitor] = None,
    ) -> List[CrawlerTaskResult]:
        pass


class MemoryAdaptiveDispatcher(BaseDispatcher):
    def __init__(
        self,
        memory_threshold_percent: float = 90.0,
        critical_threshold_percent: float = 95.0,  # New critical threshold
        recovery_threshold_percent: float = 85.0,  # New recovery threshold
        check_interval: float = 1.0,
        max_session_permit: int = 20,
        fairness_timeout: float = 600.0,  # 10 minutes before prioritizing long-waiting URLs
        memory_wait_timeout: Optional[float] = 600.0,
        rate_limiter: Optional[RateLimiter] = None,
        monitor: Optional[CrawlerMonitor] = None,
    ):
        super().__init__(rate_limiter, monitor)
        self.memory_threshold_percent = memory_threshold_percent
        self.critical_threshold_percent = critical_threshold_percent
        self.recovery_threshold_percent = recovery_threshold_percent
        self.check_interval = check_interval
        self.max_session_permit = max_session_permit
        self.fairness_timeout = fairness_timeout
        self.memory_wait_timeout = memory_wait_timeout
        self.result_queue = asyncio.Queue()
        self.task_queue = asyncio.PriorityQueue()  # Priority queue for better management
        self.memory_pressure_mode = False  # Flag to indicate when we're in memory pressure mode
        self.current_memory_percent = 0.0  # Track current memory usage
        self._high_memory_start_time: Optional[float] = None
        
    async def _memory_monitor_task(self):
        """Background task to continuously monitor memory usage and update state"""
        while True:
            self.current_memory_percent = get_true_memory_usage_percent()

            # Enter memory pressure mode if we cross the threshold
            if self.current_memory_percent >= self.memory_threshold_percent:
                if not self.memory_pressure_mode:
                    self.memory_pressure_mode = True
                    self._high_memory_start_time = time.time()
                    if self.monitor:
                        self.monitor.update_memory_status("PRESSURE")
                else:
                    if self._high_memory_start_time is None:
                        self._high_memory_start_time = time.time()
                    if (
                        self.memory_wait_timeout is not None
                        and self._high_memory_start_time is not None
                        and time.time() - self._high_memory_start_time >= self.memory_wait_timeout
                    ):
                        raise MemoryError(
                            "Memory usage exceeded threshold for"
                            f" {self.memory_wait_timeout} seconds"
                        )

            # Exit memory pressure mode if we go below recovery threshold
            elif self.memory_pressure_mode and self.current_memory_percent <= self.recovery_threshold_percent:
                self.memory_pressure_mode = False
                self._high_memory_start_time = None
                if self.monitor:
                    self.monitor.update_memory_status("NORMAL")
            elif self.current_memory_percent < self.memory_threshold_percent:
                self._high_memory_start_time = None
            
            # In critical mode, we might need to take more drastic action
            if self.current_memory_percent >= self.critical_threshold_percent:
                if self.monitor:
                    self.monitor.update_memory_status("CRITICAL")
                # We could implement additional memory-saving measures here
                
            await asyncio.sleep(self.check_interval)
    
    def _get_priority_score(self, wait_time: float, retry_count: int) -> float:
        """Calculate p
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2281** (2026-09-23): **Release v0.9.4**
  *Symptoms*: ## Summary  Release v0.9.4. Already tagged and published to PyPI from `133e1d9`. This PR brings `main` up to the release.  - Security: closes three coordinated-disclosure advisories. Two SSRF paths (robots.txt fetch and link preview through the URL seeder) now go through the Docker server's pinning egress proxy, and the untrusted-config gate re-checks `{"type": "dict"}` wrappers. - Performance: adds `PruningContentFilterLXML`, about 10x faster pruning with identical output, now the default. `PruningContentFilter` is deprecated. - Bug fixes: deep-crawl speed, tables with `rowspan`/`colspan`, robots.txt rules, pooled browser recycling, and the Docker Playground.  No breaking changes.  Release notes: [docs/blog/release-v0.9.4.md](https://github.com/unclecode/crawl4ai/blob/release/v0.9.4/docs/blog/release-v0.9.4.md)  `origin/main` is an ancestor of this branch, so it merges as a fast-forward. 

- **Issue #2280** (2026-09-23): **docs(security): list fixed issues and features per release through v0.9.3**
  *Symptoms*: ## Summary  Follow-up to #2216 / #2269. That PR fixed the supported-versions table. This PR brings the rest of `SECURITY.md` up to date, since the "Known Security Issues" and "Security Features" sections still stopped at v0.8.1.  - **Known Security Issues**: one table per release from v0.8.0 to v0.9.3, newest first. Each row has ID (GHSA / CVE where one exists), severity, component (Library or Docker API), description, and fix. Covers the 5 GHSA advisories in v0.9.3, the v0.9.0 secure-by-default rework, and the v0.8.5 to v0.8.9 patches. - **Security Features**: tagged by the version that introduced them (v0.9.3+, v0.9.0+, v0.8.7+ to v0.8.9+, v0.8.1+, v0.8.0+). v0.8.0 entries note what v0.9.0 replaced. - **Supported Versions**: one line under the table stating that fixes are not backported and 0.8.x users should upgrade. - **Best practices**: hooks note updated for declarative hooks in 0.9.x. - **Acknowledgments**: now points to `SECURITY-CREDITS.md` instead of a stale two-name list. - "Last updated" bumped to September 2026.  Every row was checked against `CHANGELOG.md`, the release notes in `docs/blog/`, `SECURITY-CREDITS.md`, the git log from v0.8.1 to v0.9.3, and the current code on `develop`.  ## List of files changed and why  - `SECURITY.md` - add per-release security fix tables, version-tagged feature list, no-backport note, and refreshed acknowledgments and date.  ## How Has This Been Tested?  Documentation only, no code change. Each claim was verifi

- **Issue #2279** (2026-09-22): **chore(ci): drop the dead Google Apps Script stargazer step**
  *Symptoms*: ## What  Removes the `Send to Google Apps Script (Stars only)` step from `.github/workflows/main.yml`.  ## Why  The Apps Script endpoint behind `GOOGLE_SCRIPT_ENDPOINT` logged new stargazers to a Google Sheet (added in #1249). It has been returning HTTP 403 on every star, which is what #2255 reported, and the sheet is no longer used.  #2263 added `continue-on-error: true` so the failure stopped blocking the Discord notification. That unblocked the notification but left a curl that fails on every single star, forever. Since nothing consumes the sheet, the step should just go.  ## Effect  - Discord stargazer notification: unchanged, still fires. - All five triggers (`issues`, `issue_comment`, `pull_request`, `discussion`, `watch`): unchanged. - The `GOOGLE_SCRIPT_ENDPOINT` repo secret is now unreferenced anywhere in the repo and can be deleted. - The Apps Script deployment itself lives in a personal Google account and should be unpublished there separately.  ## Note on when this takes effect  `watch` events run the workflow from the **default branch (`main`)**. Both this change and the #2263 fix are on `develop`, so stars will keep failing until `develop` reaches `main`.  Refs #2255

- **Issue #2278** (2026-09-22): **fix(robots): don't patch robotparser on Python 3.14+**
  *Symptoms*: ## Summary  Follow-up to #2229, which fixed the `Disallow: /*?` half of #2225. This fixes two more bugs in the same block of code, both of which only bite on **Python 3.14+**.  Python 3.14 rewrote `urllib.robotparser`: native wildcards, `$`, and RFC 9309 longest-match ranking. Crawl4AI carries two workarounds for the *old* parser, and on 3.14 each one now makes correct stdlib behaviour worse.  ### 1. The wildcard monkey patch flattens rule ranking  `crawl4ai/utils.py` replaces `RuleLine.applies_to` unconditionally. On 3.14 that method returns the **match length**, used to rank competing rules; our patch returns a `bool`, so `True == 1` and every wildcard rule drops to the lowest possible priority.  ``` User-agent: * Disallow: / Allow: /public/*.html ```  | URL | 3.14 stdlib | 3.14 + patch | |---|---|---| | `/public/a.html` | allowed | **denied** 🐞 | | `/private/a.html` | denied | denied |  ### 2. The bare-`?` rewrite outranks a narrower `Allow:`  `_preserve_bare_query` rewrites `/*?` to `/*?*` so the `?` survives path normalization. Below 3.14 that is exactly right and still needed. On 3.14 it is wrong: `/*?*` matches to end of string, so it now **outranks** a narrower `Allow:` that the raw `/*?` would have lost to.  ``` User-agent: * Allow: /*?q= Disallow: /*? ```  | URL | 3.14 stdlib | 3.14 + rewrite | |---|---|---| | `/search?q=1` | allowed | **denied** 🐞 | | `/search?x=1` | denied | denied |  Net effect of both: on 3.14, Crawl4AI skipped pages robots.txt explicitly perm
  **Post-Mortem & Fix Analysis**:
  > Kept this separate from #2229 instead of rolling it in — it's really a different bug that just happens to sit in the same few lines. #2229 fixed the rule text; this one is about the patch itself doing the wrong thing on 3.14.  If you're on 3.14, this is the one to look at. The stdlib parser there is already RFC 9309 compliant, so we were overriding good behavior with worse. Nothing changes below 3.14.  Thanks @Nalhin for #2229 — the `/*?` → `/*?*` trick is what sent me digging here in the first place. 
  > Both findings were right — fixed in 7e17809.  **1 (medium).** Confirmed before fixing, on 3.14.7: with `Allow: /*?q=` + `Disallow: /*?`, the stdlib allows `/search?q=1` and we denied it. My last commit gated the monkey patch and left the rewrite running everywhere, which is half a fix — thanks for catching it. `_preserve_bare_query` is now behind the same `sys.version_info < (3, 14)`, and the docstring says why the two forms are only equivalent below 3.14.  Worth noting the split is real, not something to delete: on 3.12 the rewrite gives the right answers (`/search?q=1` allowed, `/search?x=1` denied), because those parsers take the first matching rule and length can't change the winner.  **2 (low).** Done — `RuleLine` import moved inside the branch, duplicate `import re` dropped. `import sys` stays at module scope since the condition needs it.  Added two tests. `test_query_allow_outranks_bare_query_disallow` is the regression for your case; reverting just the call-site gate fails it o

- **Issue #2269** (2026-09-22): **docs: list 0.9.x as supported**
  *Symptoms*: ## Summary  Add the current 0.9.x release line to the security policy's supported-version table while retaining support for 0.8.x.  Fixes #2216  ## List of files changed and why  - `SECURITY.md` — list the current 0.9.x stable line as supported.  ## How Has This Been Tested?  - `git diff --check` - A targeted Python check verified that the major/minor line in `crawl4ai/__version__.py` has a supported row in `SECURITY.md`.  ## Checklist:  - [x] My code follows the style guidelines of this project - [x] I have performed a self-review of my own code - [x] N/A — this documentation-only change has no code requiring comments - [x] I have made corresponding changes to the documentation - [x] N/A — no unit-testable runtime behavior changed - [x] N/A — the targeted documentation checks pass; existing unit tests are unaffected 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your contribution :)

- **Issue #2268** (2026-09-24): **fix(tables): keep th row headers and carry rowspan down**
  *Symptoms*: ## The bug  `DefaultTableExtraction.extract_table_data` read only `.//td` for body rows, so a `<th scope="row">` was dropped — the remaining cells shifted one place left and the row was padded with `""` on the right. `rowspan` was not handled at all, so the rows a spanning cell covers shifted left too.  Run against the issue's own markup, before:  ``` --- th row headers   headers: ['', 'Feature A', 'Feature B']   row:     ['yes', 'yes', '']          <- 'Item 1' is gone   row:     ['no', 'yes', '']           <- 'Item 2' is gone --- rowspan   headers: ['Group', 'Option X', 'Option Y']   row:     ['G1', 'x1', 'y1']   row:     ['x2', 'y2', '']            <- shifted under 'Group' ```  after:  ``` --- th row headers   row:     ['Item 1', 'yes', 'yes']   row:     ['Item 2', 'no', 'yes'] --- rowspan   row:     ['G1', 'x1', 'y1']   row:     ['G1', 'x2', 'y2'] --- plain (control)   headers: ['A', 'B']   row:     ['1', '2']   row:     ['3', '4']                  <- unchanged ```  For a documentation table whose first column is a product or parameter name, that column disappeared from `result.tables` entirely. This is the follow-up to #2007: since v0.9.1 the spans survive in `cleaned_html`, and the extractor now uses them.  ## Two things the change had to handle that the issue does not mention  **The header row becomes a body row.** Without a `thead` the first row supplies the headers, and it is also in `.//tr[not(ancestor::thead)]`. It used to be skipped by accident — it holds no `td`, 
  **Post-Mortem & Fix Analysis**:
  > Closing this: dd542e7 on main fixes #2258 with the same approach, laying each cell into the grid it spans and keeping the `<th scope="row">` key column. I ran this PR's 16 tests (`test_table_extraction_alignment.py`) against main's `table_extraction.py` and they all pass, so nothing here is left uncovered.

- **Issue #2266** (2026-09-14): **Keep malformed timeouts at the default ceiling**
  *Symptoms*: Follow-up to #2212. Three loose ends found in review of that PR.  ### `crawl4ai/async_configs.py` — malformed input inherited a raised ceiling  `_cap_timeout` returned the configured `ceiling` for any value that was non-numeric or `<= 0`. So raising `CRAWL4AI_MAX_TIMEOUT_MS` also raised what junk input became: with the ceiling at 300000, an untrusted caller sending `"page_timeout": 0` or `"abc"` got 300s of held browser page, where before it got 60s. That is cheap amplification on the one input an attacker controls for free.  Now it returns `min(_DEFAULT_MAX_TIMEOUT_MS, ceiling)` — the 60s default, still respecting a ceiling that has been *tightened* below it.  ### `deploy/docker/MIGRATION.md` — the documented example cannot work  The doc's `CRAWL4AI_MAX_TIMEOUT_MS=300000` collides with `limits.wall_clock_s` (default `300`, enforced in `deploy/docker/api.py`) and `crawler.timeouts.batch_process` (default `300.0`). An operator who followed the doc exactly and crawled a page taking 4 minutes still got a 504 at 300s — the raised `page_timeout` was unreachable. The section now says to raise those two alongside it.  ### `tests/test_config_defaults.py` — a case asserted the opposite of the truth  `"60_000"` was in the "not a positive integer" parametrize list, but `int("60_000") == 60000` in Python, so it was *accepted* as a valid ceiling, not refused. The test passed only because the accepted ceiling happened to equal the default — change the default and it fails for the wrong rea

- **Issue #2265** (2026-09-14): **fix(deep-crawl): drop the O(n²) parent scan and the duplicate best-first enqueue**
  *Symptoms*: Fixes #2242.  ## The two bugs  **1. BFS re-scanned the whole level to find each result's parent** — `bfs_strategy.py`, both `_arun_batch` and `_arun_stream`:  ```python parent_url = next((parent for (u, parent) in current_level if u == url), None) ```  `current_level` is already a list of `(url, parent)` pairs — a dict spelled as a list. Building it once per level next to the existing `urls` line makes this O(n) instead of O(n²). `reversed()` preserves the old first-parent-wins result if a resumed level repeats a URL.  **2. BestFirst could queue the same URL twice** — root cause is that `bff_strategy.py` marked a URL `visited` at *dequeue* time, so between discovery and dequeue several parents could each push it. BFS and DFS both already mark at *discovery* time; BFF was the odd one out. Fixed by matching them, which makes the dequeue guard unreachable — so it goes, rather than adding a second set to track the same fact.  Restoring a checkpoint now de-dupes the saved queue and folds queued URLs into `visited`, so states written by older builds (which recorded only crawled URLs and could hold a repeat) still resume without a duplicate crawl.  Net: 8 lines added, 5 removed.  ## Reproduced first  The offending lookup, in isolation:  | level size | time | growth per doubling | |---|---|---| | 1000 | 11.5 ms | — | | 2000 | 38.3 ms | 3.33x | | 4000 | 158.2 ms | 4.13x | | 8000 | 667.3 ms | 4.22x |  In a full mock crawl of an 8000-link level with no network at all, that one line was 
  **Post-Mortem & Fix Analysis**:
  > Confirmed, and fixed in e5e1011. Good catch — the repro reproduces exactly as described, 18 pages on develop vs 17 on the PR, and X frozen at depth 3.  The part I missed: **the duplicate enqueue was load-bearing.** It was doubling as the depth relaxation. Best-first does not visit levels in order, so a URL can be found at depth 3 down a high-scoring branch and only later at depth 2 down a slower one. Develop's second enqueue carried the shallower depth and won the priority tie, so X settled at depth 2. De-duplicating on identity threw that away and took the subtree under LEAF with it.  So the fix now de-duplicates on **depth** rather than on identity — the whole change to `bff_strategy.py` is one guard in `link_discovery`:  ```python queued_depth = depths.get(base_url) if queued_depth is not None and queued_depth <= new_depth:     continue ```  A URL already queued at an equal or shallower depth is skipped — that is the waste #2242 reported, and it covers the reported case, where two s

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

### Incident Patch 1: `133e1d92` (2026-09-23)
**Commit Message**: docs: release notes, changelog, README, and security credits for v0.9.4

Bump the version to 0.9.4 and add the v0.9.4 fixes to SECURITY.md.

**File**: `CHANGELOG.md` (modified, +57/-0)
```diff
@@ -5,6 +5,63 @@ All notable changes to Crawl4AI will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
+## [0.9.4] - 2026-09-23
+
+0.9.4 is a security release. It closes three coordinated-disclosure advisories: two SSRF paths that bypassed the Docker server's egress controls, and a trust-boundary bypass that let a non-admin API client read server environment variables. It also makes content pruning about 10x faster with the new lxml-native `PruningContentFilterLXML`, now the default, and ships the bug fixes that accumulated on `develop` since 0.9.3. There are no breaking changes. Users who self-host the Docker server should upgrade.
+
+### Security
+
+- **Blind SSRF via the robots.txt fetch (CWE-918, medium)**: `RobotsParser.can_fetch()` fetched `/robots.txt` on a bare `aiohttp` client that followed redirects and re-resolved the host, so `check_robots_txt` in an untrusted request body could make the Docker server reach internal, loopback, and cloud-metadata addresses. The fetch now goes through the server's pinning egress proxy, which checks every hop and dials the pinned IP. Credit: [arpe1618](https://github.com/arpe1618). (GHSA-f77g-77vp-r96v)
+- **SSRF with response disclosure via `link_preview_config` (CWE-918, high)**: the URL seeder fetched every link on a crawled page with its own `httpx` client, outside the egress controls, and returned each page's parsed `<head>` to the caller. The seeder's fetches now go through the same pinning egress proxy, and `LinkPreviewConfig` gets caps on `max_links`, `concurrency`, and `timeout` for untrusted bodies. Credit: Ibrahim AlJaafreh ([LinkedIn](https://www.linkedin.com/in/ibrahim-aljaafreh-glitch/)), Cystack RedTeam ([cystack.ps](https://cystack.ps)). (GHSA-wh5w-hmj3-vgg7)
+- **Untrusted-config gate bypass via dict-wrapper laundering (CWE-501, high)**: wrapping a forbidden typed object such as `LLMConfig` in `{"type": "dict", "value": {...}}` slipped it past `UNTRUSTED_ALLOWED_TYPES`, and `from_kwargs` then rebuilt it as trusted. A non-admin client could read any server environment variable, including LLM keys and `SECRET_KEY`. The unwrapped value is now re-checked under the untrusted gate, and `from_kwargs` carries the caller's provenance instead of defaulting to trusted. Credit: Adam Jordan ([adamyordan](https://github.com/adamyordan)). (GHSA-5w5p-vcv6-mm3f)
+
+The two SSRF fixes share one mechanism: the new `crawl4ai/egress_policy.py` holds a process-wide egress proxy URL for the library's own HTTP clients. The Docker server registers its existing `PinningProxy` there at boot. A plain library caller sets nothing and sees no change.
+
+All reporters are credited in `SECURITY-CREDITS.md`. GitHub Security Advisories accompany this release.
+
+### Added
+
+- `PruningContentFilterLXML`: an lxml-native pruning filter. It computes every per-node metric in one bottom-up pass instead of re-walking each subtree, so pruning is O(N) instead of super-linear. Output is byte-identical to `PruningContentFilter`. Measured pruning time: medium page 134 to 13 ms, 6000-card page 2200 to 260 ms. It is now the default for the Docker server's fit filter and the CLI pruning filter.
+- `CRAWL4AI_MAX_TIMEOUT_MS` sets the ceiling for `page_timeout`, `wait_for_timeout`, and `body_visibility_timeout` on untrusted configs. The default stays 60000 ms. (#2212, thanks @damusix; #2266)
+- Docker server: `crawler.pool.max_pages_before_recycle` (default 200) recycles a pooled browser context after it serves that many pages. A context gets slower with sustained use, and the idle janitor never fires on a busy server. Set it to 0 to disable. (#2232, issue #2231)
+
+### Deprecated
+
+- `PruningContentFilter` emits a `DeprecationWarning` on direct use. Switch to `PruningContentFilterLXML`, which takes the same arguments and gives the same output. Existing import paths ke
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 FROM python:3.12-slim-bookworm AS build
 
 # C4ai version
-ARG C4AI_VER=0.9.3
+ARG C4AI_VER=0.9.4
 ENV C4AI_VERSION=$C4AI_VER
 LABEL c4ai.version=$C4AI_VER
 
```

**File**: `README.md` (modified, +21/-2)
```diff
@@ -37,9 +37,11 @@ Limited slots._
 
 Crawl4AI turns the web into clean, LLM ready Markdown for RAG, agents, and data pipelines. Fast, controllable, battle tested by a 50k+ star community.
 
-[✨ Check out latest update v0.9.3](#-recent-updates)
+[✨ Check out latest update v0.9.4](#-recent-updates)
 
-✨ **New in v0.9.3**: Security release. Closes five coordinated-disclosure advisories: arbitrary file write, SSRF, and denial of service in the PDF processing path, plus two XSS issues in the Docker Playground. Also ships 33 bug fixes across the Docker server, crawler, and PDF handling. No new features, no breaking changes. [Release notes →](https://github.com/unclecode/crawl4ai/blob/main/docs/blog/release-v0.9.3.md)
+✨ **New in v0.9.4**: Security release. Closes three coordinated-disclosure advisories: two SSRF paths (robots.txt and link preview) that bypassed the Docker server's egress controls, and a config trust-boundary bypass that leaked server environment variables. Also adds `PruningContentFilterLXML`, about 10x faster pruning, now the default. No breaking changes. [Release notes →](https://github.com/unclecode/crawl4ai/blob/main/docs/blog/release-v0.9.4.md)
+
+✨ Recent v0.9.3: Security release. Closes five coordinated-disclosure advisories: arbitrary file write, SSRF, and denial of service in the PDF processing path, plus two XSS issues in the Docker Playground. Also ships 33 bug fixes across the Docker server, crawler, and PDF handling. No new features, no breaking changes. [Release notes →](https://github.com/unclecode/crawl4ai/blob/main/docs/blog/release-v0.9.3.md)
 
 ✨ Recent v0.9.2: Maintenance patch release. Fixes a `MemoryAdaptiveDispatcher` task/page leak when a streaming crawl is closed, Docker Playground "Advanced Config" and Monitor WebSocket auth, Playwright headless-shell packaging, and GPU (`ENABLE_GPU=true`) Docker builds. [Release notes →](https://github.com/unclecode/crawl4ai/blob/main/docs/blog/release-v0.9.2.md)
 
@@ -567,6 +569,23 @@ async def test_news_crawl():
 ## ✨ Recent Updates
 
 <details open>
+<summary><strong>Version 0.9.4 Release Highlights - Security Release and Faster Pruning</strong></summary>
+
+A security release closing three coordinated-disclosure advisories. Two are SSRF paths that did not go through the Docker server's egress rule: the robots.txt fetch behind `check_robots_txt`, and the URL seeder behind `link_preview_config`, which also returned the fetched `<head>` to the caller. Both now go through the server's pinning egress proxy. The third is a bypass of the untrusted-config gate: a `{"type": "dict"}` wrapper let a forbidden `LLMConfig` through, so a non-admin client could read server environment variables.
+
+It also adds `PruningContentFilterLXML`, an lxml-native pruning filter that is about 10x faster and gives byte-identical output. It is now the default, and `PruningContentFilter` is deprecated. Bug fixes cover deep-crawl speed, tables with `rowspan`/`colspan`, robots.txt rules, pooled browser recycling, and the Docker Playground.
+
+No breaking changes.
+
+```bash
+pip install -U crawl4ai
+```
+
+[Full v0.9.4 Release Notes →](https://github.com/unclecode/crawl4ai/blob/main/docs/blog/release-v0.9.4.md)
+
+</details>
+
+<details>
 <summary><strong>Version 0.9.3 Release Highlights - Security Release</strong></summary>
 
 A security release closing five coordinated-disclosure advisories. Four are in the PDF processing path: an arbitrary file write through `PDFContentScrapingStrategy` image-write fields, an SSRF where the PDF download followed redirects into internal addresses, a denial of service from unbounded PDF size and page count, and an XSS from unescaped PDF text in `cleaned_html`. The fifth is a DOM-based XSS in the Docker Playground that could expose the operator's API token.
```

**File**: `SECURITY-CREDITS.md` (modified, +4/-0)
```diff
@@ -21,3 +21,7 @@ We thank the following security researchers for their responsible disclosure:
 | Zhixi "Jace" Sun | GitHub: [manus-use](https://github.com/manus-use) | Arbitrary file write via unconfined PDFContentScrapingStrategy image-write fields in untrusted config bodies (0.9.3) | 2026-08-24 |
 | Nguyen Tran Thanh Lam | GitHub: [c240030](https://github.com/c240030) | SSRF via PDF download redirects, DoS via unbounded PDF size and page count, XSS via unescaped PDF text in cleaned_html (0.9.3) | 2026-07-27 |
 | e1codes | GitHub: [e1codes](https://github.com/e1codes) | DOM-based XSS in the Docker Playground leading to operator API-token theft (0.9.3) | 2026-07-24 |
+| x0root | GitHub: [x0root](https://github.com/x0root) | SSRF in the hosted service at stage.crawl4ai.com | 2026-09-02 |
+| arpe1618 | GitHub: [arpe1618](https://github.com/arpe1618) | Blind SSRF via the robots.txt fetch in RobotsParser.can_fetch bypassing the Docker egress controls (0.9.4) | 2026-09-04 |
+| Ibrahim AlJaafreh - Cystack RedTeam | [LinkedIn](https://www.linkedin.com/in/ibrahim-aljaafreh-glitch/), [cystack.ps](https://cystack.ps) | SSRF with response disclosure via link_preview_config through the URL seeder (0.9.4) | 2026-09-04 |
+| Adam Jordan | GitHub: [adamyordan](https://github.com/adamyordan) | Untrusted-config gate bypass via dict-wrapper laundering, leaking server env vars (0.9.4) | 2026-09-08 |
```

**File**: `SECURITY.md` (modified, +14/-0)
```diff
@@ -96,6 +96,14 @@ When using Crawl4AI as a Python library:
 
 All issues below are fixed in the version named. Advisories with a GHSA id are published under [Security Advisories](https://github.com/unclecode/crawl4ai/security/advisories). Full detail for every release is in [CHANGELOG.md](CHANGELOG.md); reporter credits are in [SECURITY-CREDITS.md](SECURITY-CREDITS.md).
 
+### Fixed in v0.9.4 (2026-09-23)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| GHSA-f77g-77vp-r96v | MEDIUM | Library + Docker API | Blind SSRF via the robots.txt fetch in `RobotsParser.can_fetch`, outside the egress controls; redirects followed, DNS re-resolved (CWE-918) | Fetch routed through the pinning egress proxy; TLS verification restored |
+| GHSA-wh5w-hmj3-vgg7 | HIGH | Library + Docker API | SSRF with response disclosure via `link_preview_config`: the URL seeder fetched every link outside the egress controls and returned the parsed `<head>` (CWE-918) | Seeder fetches routed through the pinning egress proxy; `LinkPreviewConfig` caps `max_links`, `concurrency`, `timeout` for untrusted bodies |
+| GHSA-5w5p-vcv6-mm3f | HIGH | Docker API | Untrusted-config gate bypass via `{"type": "dict"}` wrapper laundering, leaking server env vars such as LLM keys and `SECRET_KEY` (CWE-501) | Unwrapped value re-checked under the untrusted gate; `from_kwargs` carries the caller's provenance |
+
 ### Fixed in v0.9.3 (2026-08-31)
 
 | ID | Severity | Component | Description | Fix |
@@ -191,6 +199,12 @@ Secure-by-default rework of the Docker API server. The pip library is unchanged.
 
 ## Security Features
 
+### v0.9.4+
+
+- **Library egress proxy**: `crawl4ai/egress_policy.py` routes the library's own HTTP clients (URL seeder, robots.txt) through the Docker server's pinning proxy, so they get the same resolve-and-pin rule as the browser
+- **Link preview caps**: `LinkPreviewConfig` `max_links` (100), `concurrency` (10), and `timeout` (10 s) clamped for untrusted bodies
+- **Nested typed objects gated**: `{"type": "dict"}` wrappers are re-checked against `UNTRUSTED_ALLOWED_TYPES`
+
 ### v0.9.3+
 
 - **PDF egress policy**: PDF downloads validate every redirect hop and the peer IP actually read, so the Docker SSRF policy also covers the out-of-browser `requests` path
```

---

### Incident Patch 2: `e668bb7b` (2026-09-23)
**Commit Message**: Merge pull request #2280 from unclecode/docs-security-md-known-issues

docs(security): list fixed issues and features per release through v0.9.3

**File**: `SECURITY.md` (modified, +134/-21)
```diff
@@ -9,6 +9,8 @@
 | 0.7.x   | :x: (upgrade recommended) |
 | < 0.7   | :x:                |
 
+Fixes are not backported to earlier lines. The 0.9.3 advisories listed below are not patched in any 0.8.x release; if you run 0.8.x, upgrade.
+
 ## Reporting a Vulnerability
 
 We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.
@@ -68,9 +70,9 @@ If you're running the Crawl4AI Docker API in production:
    export SECRET_KEY="your-secure-random-key-here"
    ```
 
-2. **Hooks are Disabled by Default** (v0.8.0+)
-   - Only enable if you trust all API users
-   - Set `CRAWL4AI_HOOKS_ENABLED=true` only when necessary
+2. **Hooks are Declarative** (v0.9.0+)
+   - Request-supplied hook code is no longer accepted; only the fixed action set in `GET /hooks/info`
+   - On 0.8.x, hooks are disabled by default; set `CRAWL4AI_HOOKS_ENABLED=true` only if you trust all API users
 
 3. **Network Security**
    - Run behind a reverse proxy (nginx, traefik)
@@ -92,44 +94,155 @@ When using Crawl4AI as a Python library:
 
 ## Known Security Issues
 
-### Fixed in v0.8.0
+All issues below are fixed in the version named. Advisories with a GHSA id are published under [Security Advisories](https://github.com/unclecode/crawl4ai/security/advisories). Full detail for every release is in [CHANGELOG.md](CHANGELOG.md); reporter credits are in [SECURITY-CREDITS.md](SECURITY-CREDITS.md).
+
+### Fixed in v0.9.3 (2026-08-31)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| GHSA-xpp7-j28w-2gvx | HIGH | Library + Docker API | Arbitrary file write via `PDFContentScrapingStrategy` image-write fields in untrusted config bodies (CWE-22) | `save_images_locally` / `image_save_dir` filtered at the trust boundary; `extract_images` forced off for untrusted bodies |
+| GHSA-q5rj-45vw-vp2g | HIGH | Library | SSRF via PDF download redirects; DNS rebinding (CWE-918) | Redirects resolved manually with a per-hop destination check (max 5 hops); peer IP of the read response validated |
+| GHSA-v2rm-hvrj-2x9q | MEDIUM | Library | Denial of service via unbounded PDF size and page count (CWE-400) | `max_pdf_bytes` (100 MiB) and `max_pdf_pages` (2000) caps; untrusted bodies cannot raise them |
+| GHSA-7g3g-vhm6-79f3 | MEDIUM | Library | XSS via unescaped PDF paragraph text in `cleaned_html` (CWE-79) | Paragraph text escaped like every other sink |
+| GHSA-m446-hp3q-qfxp | HIGH | Docker Playground | DOM-based XSS via `innerHTML` round-trip in the result viewer, leading to API token theft (CWE-79) | Round-trip removed; highlight.js renders from `textContent` |
+
+### Fixed in v0.9.2 (2026-07-15)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | LOW | Docker API | `/monitor/ws` WebSocket returned 500 under JWT auth because the router-level token dependency cannot run on WebSocket scopes | Auth enforced by `AuthGateMiddleware`; admin routes keep `require_admin` |
+
+### Fixed in v0.9.1 (2026-07-08)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | MEDIUM | Docker API | Rate-limit Redis storage connected without the configured password | Rate limiter authenticates to Redis |
+
+### Fixed in v0.9.0 (2026-06-18)
+
+Secure-by-default rework of the Docker API server. The pip library is unchanged. See `deploy/docker/MIGRATION.md`.
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | CRITICAL | Docker API | Unauthenticated API served on `0.0.0.0` by default (CWE-306) | Auth on by default; loopback bind unless `CRAWL4AI_API_TOKEN` is set |
+| - | CRITICAL | Docker API | Request-supplied hook code executed on the server (CWE-94) | `hooks.code` removed; fixed set of declarative hook actions |
+| - | HIGH | Docker API | Chromium launch-arg injection via request-supplied `browser_config.extra_args` (CWE-94) | `extra_a
```

---

### Incident Patch 3: `06c8acfb` (2026-09-23)
**Commit Message**: docs(security): list fixed issues and features per release through v0.9.3

SECURITY.md stopped at v0.8.1; add per-release tables for v0.8.5 to v0.9.3, tag features by version, and note that fixes are not backported.

**File**: `SECURITY.md` (modified, +134/-21)
```diff
@@ -9,6 +9,8 @@
 | 0.7.x   | :x: (upgrade recommended) |
 | < 0.7   | :x:                |
 
+Fixes are not backported to earlier lines. The 0.9.3 advisories listed below are not patched in any 0.8.x release; if you run 0.8.x, upgrade.
+
 ## Reporting a Vulnerability
 
 We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.
@@ -68,9 +70,9 @@ If you're running the Crawl4AI Docker API in production:
    export SECRET_KEY="your-secure-random-key-here"
    ```
 
-2. **Hooks are Disabled by Default** (v0.8.0+)
-   - Only enable if you trust all API users
-   - Set `CRAWL4AI_HOOKS_ENABLED=true` only when necessary
+2. **Hooks are Declarative** (v0.9.0+)
+   - Request-supplied hook code is no longer accepted; only the fixed action set in `GET /hooks/info`
+   - On 0.8.x, hooks are disabled by default; set `CRAWL4AI_HOOKS_ENABLED=true` only if you trust all API users
 
 3. **Network Security**
    - Run behind a reverse proxy (nginx, traefik)
@@ -92,44 +94,155 @@ When using Crawl4AI as a Python library:
 
 ## Known Security Issues
 
-### Fixed in v0.8.0
+All issues below are fixed in the version named. Advisories with a GHSA id are published under [Security Advisories](https://github.com/unclecode/crawl4ai/security/advisories). Full detail for every release is in [CHANGELOG.md](CHANGELOG.md); reporter credits are in [SECURITY-CREDITS.md](SECURITY-CREDITS.md).
+
+### Fixed in v0.9.3 (2026-08-31)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| GHSA-xpp7-j28w-2gvx | HIGH | Library + Docker API | Arbitrary file write via `PDFContentScrapingStrategy` image-write fields in untrusted config bodies (CWE-22) | `save_images_locally` / `image_save_dir` filtered at the trust boundary; `extract_images` forced off for untrusted bodies |
+| GHSA-q5rj-45vw-vp2g | HIGH | Library | SSRF via PDF download redirects; DNS rebinding (CWE-918) | Redirects resolved manually with a per-hop destination check (max 5 hops); peer IP of the read response validated |
+| GHSA-v2rm-hvrj-2x9q | MEDIUM | Library | Denial of service via unbounded PDF size and page count (CWE-400) | `max_pdf_bytes` (100 MiB) and `max_pdf_pages` (2000) caps; untrusted bodies cannot raise them |
+| GHSA-7g3g-vhm6-79f3 | MEDIUM | Library | XSS via unescaped PDF paragraph text in `cleaned_html` (CWE-79) | Paragraph text escaped like every other sink |
+| GHSA-m446-hp3q-qfxp | HIGH | Docker Playground | DOM-based XSS via `innerHTML` round-trip in the result viewer, leading to API token theft (CWE-79) | Round-trip removed; highlight.js renders from `textContent` |
+
+### Fixed in v0.9.2 (2026-07-15)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | LOW | Docker API | `/monitor/ws` WebSocket returned 500 under JWT auth because the router-level token dependency cannot run on WebSocket scopes | Auth enforced by `AuthGateMiddleware`; admin routes keep `require_admin` |
+
+### Fixed in v0.9.1 (2026-07-08)
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | MEDIUM | Docker API | Rate-limit Redis storage connected without the configured password | Rate limiter authenticates to Redis |
+
+### Fixed in v0.9.0 (2026-06-18)
+
+Secure-by-default rework of the Docker API server. The pip library is unchanged. See `deploy/docker/MIGRATION.md`.
+
+| ID | Severity | Component | Description | Fix |
+|----|----------|-----------|-------------|-----|
+| - | CRITICAL | Docker API | Unauthenticated API served on `0.0.0.0` by default (CWE-306) | Auth on by default; loopback bind unless `CRAWL4AI_API_TOKEN` is set |
+| - | CRITICAL | Docker API | Request-supplied hook code executed on the server (CWE-94) | `hooks.code` removed; fixed set of declarative hook actions |
+| - | HIGH | Docker API | Chromium launch-arg injection via request-supplied `browser_config.extra_args` (CWE-94) | `extra_a
```

---

### Incident Patch 4: `a7d4fbfb` (2026-09-23)
**Commit Message**: Merge security fixes for 0.9.4

**File**: `crawl4ai/async_configs.py` (modified, +55/-12)
```diff
@@ -298,6 +298,9 @@ class UntrustedConfigError(ValueError):
 _MAX_VIEWPORT = 4000
 _MAX_PDF_BYTES = 100 * 1024 * 1024
 _MAX_PDF_PAGES = 2000
+_MAX_LINK_PREVIEW_LINKS = 100      # the class default
+_MAX_LINK_PREVIEW_CONCURRENCY = 10  # the class default
+_MAX_LINK_PREVIEW_TIMEOUT_S = 10    # seconds here, not ms
 
 
 def _max_timeout_ms() -> int:
@@ -384,6 +387,18 @@ def _cap_timeout(v):
         # Rasterizing every page is the most expensive thing this strategy can
         # do, and nothing about untrusted crawling needs it.
         params["extract_images"] = False
+    elif type_name == "LinkPreviewConfig":
+        # Also no field allowlist, and each link is a separate outbound fetch:
+        # unclamped, one request body can order millions of them at any
+        # concurrency it likes.
+        for f, cap in (
+            ("max_links", _MAX_LINK_PREVIEW_LINKS),
+            ("concurrency", _MAX_LINK_PREVIEW_CONCURRENCY),
+            ("timeout", _MAX_LINK_PREVIEW_TIMEOUT_S),
+        ):
+            if f in params:
+                v = params[f]
+                params[f] = cap if not isinstance(v, int) or v <= 0 else min(v, cap)
     return params
 
 
@@ -473,6 +488,21 @@ def to_serializable_dict(obj: Any, ignore_default_value : bool = False):
     return str(obj)
 
 
+def _is_typed_shape(data: Any) -> bool:
+    """True for the dict shapes to_serializable_dict() emits:
+    {"type": "<ClassName>", "params": {...}} or {"type": "dict", "value": {...}}.
+
+    Plain business dicts that happen to carry a "type" key (JSON-Schema
+    fragments, JsonCss field specs like {"type": "text", "name": "..."}) have
+    neither "params" nor "value" and are not typed shapes.
+    """
+    return (
+        isinstance(data, dict)
+        and "type" in data
+        and ("params" in data or (data["type"] == "dict" and "value" in data))
+    )
+
+
 def from_serializable_dict(data: Any, provenance: "Provenance" = None) -> Any:
     """
     Recursively convert a serializable dictionary back to an object instance.
@@ -498,14 +528,23 @@ def from_serializable_dict(data: Any, provenance: "Provenance" = None) -> Any:
     # carry a "type" key (e.g. JSON-Schema fragments, JsonCss field specs like
     # {"type": "text", "name": "..."}) have neither "params" nor "value" and
     # must fall through to the raw-dict path below so they are passed as data.
-    if (
-        isinstance(data, dict)
-        and "type" in data
-        and ("params" in data or (data["type"] == "dict" and "value" in data))
-    ):
+    if _is_typed_shape(data):
         # Handle plain dictionaries
         if data["type"] == "dict" and "value" in data:
-            return {k: from_serializable_dict(v, provenance) for k, v in data["value"].items()}
+            unwrapped = {
+                k: from_serializable_dict(v, provenance) for k, v in data["value"].items()
+            }
+            # The unwrap above recurses over .items(), so data["value"] is never
+            # seen as a whole typed object and the type gate below never fires
+            # for it. Without this check an untrusted body launders a forbidden
+            # type past the gate by wrapping it:
+            #   {"type": "dict", "value": {"type": "LLMConfig", "params": {...}}}
+            if provenance == Provenance.UNTRUSTED and _is_typed_shape(unwrapped):
+                raise UntrustedConfigError(
+                    "an untrusted request may not wrap a typed object in "
+                    "{'type': 'dict', 'value': ...}"
+                )
+            return unwrapped
 
         # Security: only allow known-safe types to be deserialized.
         # Unknown types (e.g. logging.Logger serialized by older clients) are
@@ -1012,11 +1051,13 @@ def __init__(
             )
 
     @staticmethod
-    def from_kwargs(kwargs: dict) -> "BrowserConfig":
+    def from_kwargs(kwargs: dict, provenance: "Provenance" = None) -> "BrowserConfig":
         # Auto-deserialize any dict values that use the
```

**File**: `crawl4ai/async_url_seeder.py` (modified, +7/-2)
```diff
@@ -53,6 +53,7 @@
 # You might need to adjust this import based on your exact file structure
 # Import AsyncLogger for default if needed
 from .async_logger import AsyncLoggerBase, AsyncLogger
+from .egress_policy import proxy_url
 
 # Import SeedingConfig for type hints
 from typing import TYPE_CHECKING
@@ -303,7 +304,11 @@ def __init__(
     ):
         self.ttl = ttl
         self._owns_client = client is None  # Track if we created the client
-        self.client = client or httpx.AsyncClient(http2=True, timeout=20, headers={
+        # proxy=None unless an embedder installed one (the Docker server does).
+        # Every request in this class goes through self.client, so this single
+        # kwarg puts the seeder's whole fan-out -- sitemaps, robots, link heads,
+        # and each redirect hop -- behind the egress policy.
+        self.client = client or httpx.AsyncClient(http2=True, timeout=20, proxy=proxy_url(), headers={
             "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) +AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
         })
         self.logger = logger  # Store the logger instance
@@ -1772,7 +1777,7 @@ async def _latest_index(self) -> str:
         self._log("info", "Fetching latest Common Crawl index from {url}",
                   params={"url": COLLINFO_URL}, tag="URL_SEED")
         try:
-            async with httpx.AsyncClient() as c:
+            async with httpx.AsyncClient(proxy=proxy_url()) as c:
                 j = await c.get(COLLINFO_URL, timeout=10)
                 j.raise_for_status()  # Raise an exception for bad status codes
                 idx = j.json()[0]["id"]
```

**File**: `crawl4ai/egress_policy.py` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+"""Process-wide egress proxy for the library's own HTTP clients.
+
+The library deliberately has no egress policy of its own: as a plain library
+the caller already chooses the URL, so there is nothing to defend against.
+It matters when the URL comes from an untrusted API client, which is the
+Docker server's situation -- deploy/docker/server.py starts a pinning forward
+proxy (egress_proxy.PinningProxy) and registers it here at boot, so the
+seeder and robots.txt fetches go through the same resolve-and-pin rule the
+browser path already gets.
+
+A proxy rather than a validator hook (the shape used by
+crawl4ai/processors/pdf) because a validator resolves the name, checks it and
+then throws the address away -- the client re-resolves when it dials, which is
+the DNS-rebinding window egress_broker.py exists to close. The proxy resolves,
+pins and dials the same address, and re-validates every redirect hop because
+each hop is a fresh proxied request.
+
+Unset (the plain-library case) means proxy_url() is None, which is the default
+value of the `proxy=` kwarg on both httpx and aiohttp: no behaviour change.
+"""
+
+from typing import Optional
+
+_proxy_url: Optional[str] = None
+
+
+def set_egress_proxy(url: Optional[str]) -> None:
+    """Route the library's own HTTP clients through `url` (None = direct)."""
+    global _proxy_url
+    _proxy_url = url
+
+
+def proxy_url() -> Optional[str]:
+    """The installed egress proxy, or None for a direct connection."""
+    return _proxy_url
```

**File**: `crawl4ai/utils.py` (modified, +11/-2)
```diff
@@ -36,6 +36,7 @@
 
 from packaging import version
 from . import __version__
+from .egress_policy import proxy_url
 from typing import Sequence
 
 from itertools import chain
@@ -369,8 +370,16 @@ async def can_fetch(self, url: str, user_agent: str = "*") -> bool:
                 scheme = parsed.scheme or 'http'
                 robots_url = f"{scheme}://{domain}/robots.txt"
                 
-                async with aiohttp.ClientSession() as session:
-                    async with session.get(robots_url, timeout=2, ssl=False) as response:
+                # proxy=None unless an embedder installed one (the Docker
+                # server does). Without it this fetch is a caller-chosen URL on
+                # an unguarded client: it reached internal hosts directly and
+                # followed redirects into them.
+                # ssl=False is gone: a bad certificate now raises, and the
+                # except below fails open, so robots is ignored rather than
+                # respected -- more crawling, never a broken crawl.
+                timeout = aiohttp.ClientTimeout(total=2)
+                async with aiohttp.ClientSession(timeout=timeout) as session:
+                    async with session.get(robots_url, proxy=proxy_url()) as response:
                         if response.status == 200:
                             rules = await response.text()
                             self._cache_rules(domain, rules)
```

**File**: `deploy/docker/egress_proxy.py` (modified, +14/-4)
```diff
@@ -103,6 +103,14 @@ def _bracket(ip: str) -> str:
     return f"[{ip}]" if ":" in ip else ip
 
 
+def _drop_connection_header(headers: bytes) -> bytes:
+    """Strip any Connection: header so the caller can set its own."""
+    return b"".join(
+        ln + b"\r\n" for ln in headers.split(b"\r\n")
+        if ln and not ln.lower().startswith(b"connection:")
+    )
+
+
 class PinningProxy:
     """Async HTTP forward-proxy that connects only to pinned, global IPs."""
 
@@ -219,17 +227,19 @@ async def _handle_absolute(self, method, target, request_line, client_reader, cl
         # upstream proxy (which then needs no DNS lookup of its own).
         if upstream is None:
             out = f"{method} {path} HTTP/1.1\r\n".encode("latin-1")
+            # One validated request per origin connection. After this the bytes
+            # are spliced raw, and a keep-alive client would put its next
+            # request on the wire in absolute form (it still thinks it is
+            # talking to a proxy), which some origins answer with 400.
+            headers = _drop_connection_header(headers) + b"Connection: close\r\n"
         else:
             out = f"{method} http://{_bracket(pin.ip)}:{port}{path} HTTP/1.1\r\n".encode("latin-1")
             if upstream[2]:
                 out += upstream[2]
             # One validated request per upstream connection: only this first
             # request is pinned/rewritten, so force close to keep a reused
             # client connection from smuggling unvalidated requests upstream.
-            headers = b"".join(
-                ln + b"\r\n" for ln in headers.split(b"\r\n")
-                if ln and not ln.lower().startswith(b"connection:")
-            ) + b"Connection: close\r\n"
+            headers = _drop_connection_header(headers) + b"Connection: close\r\n"
         out += b"Host: " + sp.hostname.encode("latin-1")
         if sp.port:
             out += f":{sp.port}".encode("latin-1")
```

---

### Incident Patch 5: `6218bb81` (2026-09-22)
**Commit Message**: fix(robots): don't patch robotparser on Python 3.14+ (#2278)

* fix(robots): don't patch robotparser on Python 3.14+

The wildcard monkey patch in utils.py overrides RuleLine.applies_to
unconditionally. Python 3.14 rewrote urllib.robotparser with native
wildcard, '$' and RFC 9309 longest-match support, where applies_to
returns the match *length* used to rank competing rules. The patch
returns a bool, so every wildcard rule collapses to the lowest
priority and Allow: overrides stop working:

    User-agent: *
    Disallow: /
    Allow: /public/*.html

denied /public/a.html on 3.14. Gate the patch to Python < 3.14, where
robotparser has no wildcard support and still needs it.

Follow-up to #2229, which fixed the 'Disallow: /*?' half of #2225.

Refs #2225

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

* fix(robots): don't rewrite bare-'?' rules on Python 3.14+ either

Review follow-up on the previous commit, which gated the RuleLine
monkey patch but left _preserve_bare_query running on every Python.

On 3.14 that rewrite is not just unnecessary, it is wrong. The stdlib
ranks rules by match length, and '/*?*' matches to end of string, so
it outranks a narrower com

**File**: `crawl4ai/utils.py` (modified, +42/-26)
```diff
@@ -50,27 +50,34 @@
 import inspect
 
 
-# Monkey patch to fix wildcard handling in urllib.robotparser
-from urllib.robotparser import RuleLine
-import re
-
-original_applies_to = RuleLine.applies_to
-
-def patched_applies_to(self, filename):
-   # Handle wildcards in paths
-   if '*' in self.path or '%2A' in self.path or self.path in ("*", "%2A"):
-       pattern = self.path.replace('%2A', '*')
-       pattern = re.escape(pattern).replace('\\*', '.*')
-       pattern = '^' + pattern
-       if pattern.endswith('\\$'):
-           pattern = pattern[:-2] + '$'
-       try:
-           return bool(re.match(pattern, filename))
-       except re.error:
-           return original_applies_to(self, filename)
-   return original_applies_to(self, filename)
-
-RuleLine.applies_to = patched_applies_to
+# Monkey patch to fix wildcard handling in urllib.robotparser.
+# Python 3.14 rewrote robotparser with native wildcard, '$' and RFC 9309
+# longest-match support, and its applies_to returns a match *length* used to
+# rank rules. Patching it there returns a bool, which collapses every wildcard
+# rule to the lowest priority and breaks Allow: overrides -- so only patch the
+# older implementation, which has no wildcard support at all.
+import sys
+
+if sys.version_info < (3, 14):
+    from urllib.robotparser import RuleLine
+
+    original_applies_to = RuleLine.applies_to
+
+    def patched_applies_to(self, filename):
+       # Handle wildcards in paths
+       if '*' in self.path or '%2A' in self.path or self.path in ("*", "%2A"):
+           pattern = self.path.replace('%2A', '*')
+           pattern = re.escape(pattern).replace('\\*', '.*')
+           pattern = '^' + pattern
+           if pattern.endswith('\\$'):
+               pattern = pattern[:-2] + '$'
+           try:
+               return bool(re.match(pattern, filename))
+           except re.error:
+               return original_applies_to(self, filename)
+       return original_applies_to(self, filename)
+
+    RuleLine.applies_to = patched_applies_to
 # Monkey patch ends
 
 def chunk_documents(
@@ -252,8 +259,14 @@ def needs_update(self):
 def _preserve_bare_query(rules_text: str) -> str:
     """Append '*' to Allow/Disallow values ending in a bare '?' (e.g. '/*?').
 
-    '/*?' and '/*?*' allow/deny exactly the same URLs; the rewrite only
-    survives parsers that would otherwise drop the trailing '?'.
+    Only correct below Python 3.14, and only called there. Those parsers drop a
+    trailing '?' when normalizing the rule path, collapsing '/*?' to '/*' and
+    blocking the whole site; they also take the first matching rule, so making a
+    rule longer cannot change which one wins.
+
+    From 3.14 the stdlib keeps the '?' and ranks rules by match length, and the
+    rewrite becomes actively wrong: '/*?*' matches to end of string, so it
+    outranks a competing 'Allow: /*?q=' that the raw '/*?' would have lost to.
     """
     fixed = []
     for raw_line in rules_text.splitlines():
@@ -372,9 +385,12 @@ async def can_fetch(self, url: str, user_agent: str = "*") -> bool:
 
         # Create parser for this check
         parser = RobotFileParser()
-        # Old Pythons drop a trailing '?' from rules, so '/*?' becomes
-        # '/*' and blocks the whole site. '/*?*' matches the same URLs.
-        parser.parse(_preserve_bare_query(rules).splitlines())
+        # Below 3.14, rewrite rules ending in a bare '?' so they survive path
+        # normalization. From 3.14 the stdlib handles them, and the rewrite
+        # would skew its longest-match ranking -- see _preserve_bare_query.
+        if sys.version_info < (3, 14):
+            rules = _preserve_bare_query(rules)
+        parser.parse(rules.splitlines())
         
         # If parser can't read rules, allow access
         if not parser.mtime():
```

**File**: `tests/unit/test_robots_query_rules.py` (modified, +75/-0)
```diff
@@ -6,6 +6,7 @@
 """
 
 import asyncio
+import sys
 
 import pytest
 
@@ -86,3 +87,77 @@ def test_ordinary_rules_still_apply(tmp_path):
     rules = "User-agent: *\nDisallow: /private/\nAllow: /public/\n"
     assert _can_fetch(rules, "/public/page", tmp_path) is True
     assert _can_fetch(rules, "/private/secret", tmp_path) is False
+
+
+def test_wildcard_patch_is_scoped_to_old_pythons():
+    """The patch must be installed exactly where it is needed, and nowhere else.
+
+    Python 3.14 supports wildcards natively and ranks rules by match length; the
+    patch returns a bool, which would flatten that ranking (see crawl4ai.utils).
+    """
+    from urllib.robotparser import RuleLine
+
+    is_patched = RuleLine.applies_to.__name__ == "patched_applies_to"
+    assert is_patched == (sys.version_info < (3, 14))
+
+
+@pytest.mark.parametrize(
+    "path, expected",
+    [("/a.php", False), ("/deep/a.php", False), ("/a.html", True)],
+)
+def test_wildcard_rules_work_on_every_python(path, expected, tmp_path):
+    """Wildcard support is the whole point of the patch - it must survive the gate."""
+    rules = "User-agent: *\nDisallow: /*.php\n"
+    assert _can_fetch(rules, path, tmp_path) is expected
+
+
+@pytest.mark.skipif(
+    sys.version_info < (3, 14),
+    reason="longest-match Allow precedence only exists in the 3.14+ stdlib parser",
+)
+@pytest.mark.parametrize(
+    "path, expected",
+    [("/public/a.html", True), ("/private/a.html", False), ("/public/a.txt", False)],
+)
+def test_allow_overrides_broad_disallow(path, expected, tmp_path):
+    """Regression: the old unconditional patch denied /public/a.html on 3.14."""
+    rules = "User-agent: *\nDisallow: /\nAllow: /public/*.html\n"
+    assert _can_fetch(rules, path, tmp_path) is expected
+
+
+# A narrower Allow: competing with the bare-'?' Disallow:. On 3.14 the stdlib
+# ranks rules by match length, and rewriting '/*?' to '/*?*' makes the Disallow
+# match to end of string -- so the rewrite would beat the Allow: and deny a URL
+# robots.txt permits. Below 3.14 the first matching rule wins regardless of
+# length, so the rewrite is safe there and the Allow: still loses to nothing.
+COMPETING_RULES = "User-agent: *\nAllow: /*?q=\nDisallow: /*?\n"
+
+
+@pytest.mark.skipif(
+    sys.version_info < (3, 14),
+    reason="longest-match Allow precedence only exists in the 3.14+ stdlib parser",
+)
+@pytest.mark.parametrize(
+    "path, expected",
+    [("/search?q=1", True), ("/search?x=1", False), ("/search", True)],
+)
+def test_query_allow_outranks_bare_query_disallow(path, expected, tmp_path):
+    """Regression: _preserve_bare_query must not run on 3.14.
+
+    '/*?*' matches longer than '/*?q=', so the rewrite would flip /search?q=1
+    from allowed to denied.
+    """
+    assert _can_fetch(COMPETING_RULES, path, tmp_path) is expected
+
+
+@pytest.mark.skipif(
+    sys.version_info >= (3, 14),
+    reason="pre-3.14 parsers take the first matching rule, not the longest",
+)
+@pytest.mark.parametrize(
+    "path, expected",
+    [("/search?q=1", True), ("/search?x=1", False), ("/search", True)],
+)
+def test_query_allow_still_wins_below_py314(path, expected, tmp_path):
+    """The same rules must give the same answers below 3.14, via the rewrite."""
+    assert _can_fetch(COMPETING_RULES, path, tmp_path) is expected
```

---

### Incident Patch 6: `a18b08fc` (2026-09-22)
**Commit Message**: Merge pull request #2232 from unclecode/fix/issue-2231-pooled-context-recycle

fix(docker): recycle pooled browser contexts by pages served (#2231)

**File**: `deploy/docker/config.yml` (modified, +8/-0)
```diff
@@ -84,6 +84,14 @@ crawler:
   pool:
     max_pages: 40                          # ← GLOBAL_SEM permits
     idle_ttl_sec: 300                     # ← 30 min janitor cutoff
+    # Pooled browsers are long-lived and reuse one browser context per config.
+    # Real sites leave state in that context (cookies, localStorage, service
+    # workers) which is never cleared, and navigation gets measurably slower as
+    # it builds up. Recycling by pages served bounds it: the context is replaced
+    # inside the same Chromium process, old contexts drain on their own, and it
+    # works under sustained load — unlike the janitor, which only closes *idle*
+    # browsers and so never fires on a busy server. 0 disables. See #2231.
+    max_pages_before_recycle: 200
   browser:
     kwargs:
       headless: true
```

**File**: `deploy/docker/crawler_pool.py` (modified, +19/-2)
```diff
@@ -20,9 +20,26 @@
 # Config
 MEM_LIMIT = CONFIG.get("crawler", {}).get("memory_threshold_percent", 95.0)
 BASE_IDLE_TTL = CONFIG.get("crawler", {}).get("pool", {}).get("idle_ttl_sec", 300)
+RECYCLE_PAGES = CONFIG.get("crawler", {}).get("pool", {}).get("max_pages_before_recycle", 0)
 DEFAULT_CONFIG_SIG = None  # Cached sig for default config
 
 
+def _apply_pool_defaults(cfg: BrowserConfig) -> BrowserConfig:
+    """Apply pool-owned policy to a browser config before it is pooled.
+
+    Browsers handed out by this pool are long-lived, and the endpoints build
+    their BrowserConfig from the request body (see api.py handle_crawl_request),
+    so config.yml's browser kwargs never reach them. Pooling is what makes a
+    browser long-lived, so the pool is where its recycling policy belongs.
+
+    Applied before _sig() so every request shares one signature and pooling is
+    unaffected. An explicit per-request value wins. See #2231.
+    """
+    if RECYCLE_PAGES and not cfg.max_pages_before_recycle:
+        cfg.max_pages_before_recycle = RECYCLE_PAGES
+    return cfg
+
+
 def get_pool_snapshot() -> dict:
     """Return a point-in-time snapshot of pool state for monitoring.
 
@@ -54,7 +71,7 @@ def _is_default_config(sig: str) -> bool:
 
 async def get_crawler(cfg: BrowserConfig) -> AsyncWebCrawler:
     """Get crawler from pool with tiered strategy."""
-    sig = _sig(cfg)
+    sig = _sig(_apply_pool_defaults(cfg))
     async with LOCK:
         # Check permanent browser for default config
         if PERMANENT and _is_default_config(sig):
@@ -135,7 +152,7 @@ async def init_permanent(cfg: BrowserConfig):
     async with LOCK:
         if PERMANENT:
             return
-        DEFAULT_CONFIG_SIG = _sig(cfg)
+        DEFAULT_CONFIG_SIG = _sig(_apply_pool_defaults(cfg))
         logger.info("🔥 Creating permanent default browser")
         PERMANENT = AsyncWebCrawler(config=cfg, thread_safe=False)
         await PERMANENT.start()
```

**File**: `deploy/docker/utils.py` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ class FilterType(str, Enum):
         "memory_threshold_percent": 95.0,
         "rate_limiter": {"enabled": True, "base_delay": [1.0, 2.0]},
         "timeouts": {"stream_init": 30.0, "batch_process": 300.0},
-        "pool": {"max_pages": 40, "idle_ttl_sec": 300},
+        "pool": {"max_pages": 40, "idle_ttl_sec": 300, "max_pages_before_recycle": 200},
         "browser": {
             "kwargs": {"headless": True, "text_mode": True},
             "extra_args": [
```

**File**: `tests/docker/test_pool_recycle_config.py` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+"""Pooled browsers must recycle their context by pages served (#2231).
+
+The pool's janitor only closes *idle* browsers, so a server under sustained
+load never recycles one. Recycling by page count is what bounds the context
+state (cookies/localStorage/service workers) that slows navigation down.
+
+The policy has to be applied by the pool, not by config.yml's browser kwargs:
+/crawl and /crawl/stream build their BrowserConfig from the request body
+(api.py handle_crawl_request), so those kwargs never reach them.
+"""
+import sys
+from pathlib import Path
+
+import pytest
+import yaml
+
+from crawl4ai import BrowserConfig
+
+ROOT = Path(__file__).resolve().parents[2]
+DOCKER_DIR = ROOT / "deploy" / "docker"
+sys.path.insert(0, str(DOCKER_DIR))
+
+pool = pytest.importorskip("crawler_pool", reason="docker server deps not installed")
+
+
+def test_config_enables_recycling():
+    cfg = yaml.safe_load((DOCKER_DIR / "config.yml").read_text())
+    assert cfg["crawler"]["pool"].get("max_pages_before_recycle", 0) > 0, (
+        "config.yml must set crawler.pool.max_pages_before_recycle > 0, else "
+        "pooled contexts are never recycled under sustained load (#2231)."
+    )
+
+
+def test_pool_applies_recycling_to_a_request_supplied_config():
+    """A config off the wire carries no recycle setting; the pool must add it."""
+    from_request = BrowserConfig()
+    assert from_request.max_pages_before_recycle == 0  # guard the premise
+
+    pool._apply_pool_defaults(from_request)
+    assert from_request.max_pages_before_recycle == pool.RECYCLE_PAGES > 0
+
+
+def test_explicit_caller_value_wins():
+    cfg = BrowserConfig(max_pages_before_recycle=7)
+    pool._apply_pool_defaults(cfg)
+    assert cfg.max_pages_before_recycle == 7
+
+
+@pytest.mark.asyncio
+async def test_get_crawler_applies_it(monkeypatch):
+    """The call site matters, not just the helper: a config handed to
+    get_crawler() must come back carrying the pool's recycle policy."""
+    class _FakeCrawler:
+        def __init__(self, config, **kw):
+            self.config = config
+
+        async def start(self):
+            return self
+
+    monkeypatch.setattr(pool, "AsyncWebCrawler", _FakeCrawler)
+    monkeypatch.setattr(pool, "COLD_POOL", {})
+    monkeypatch.setattr(pool, "HOT_POOL", {})
+    monkeypatch.setattr(pool, "PERMANENT", None)
+    monkeypatch.setattr(pool, "get_container_memory_percent", lambda: 10.0)
+
+    cfg = BrowserConfig()
+    await pool.get_crawler(cfg)
+    assert cfg.max_pages_before_recycle == pool.RECYCLE_PAGES > 0
+
+
+def test_signature_is_stable_across_requests():
+    """Applying the default must not split the pool into two signatures."""
+    a, b = BrowserConfig(), BrowserConfig()
+    assert pool._sig(pool._apply_pool_defaults(a)) == pool._sig(pool._apply_pool_defaults(b))
+
+
+if __name__ == "__main__":
+    sys.exit(pytest.main([__file__, "-v"]))
```

---

### Incident Patch 7: `15f4b29b` (2026-09-22)
**Commit Message**: fix: default max_pages_before_recycle in DEFAULT_CONFIG

load_config() deep-merges config.yml over DEFAULT_CONFIG, so a mounted
custom config.yml without the new key left RECYCLE_PAGES at 0 and kept
the #2231 bug after upgrade. An explicit 0 in config.yml still disables
recycling.

**File**: `deploy/docker/utils.py` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ class FilterType(str, Enum):
         "memory_threshold_percent": 95.0,
         "rate_limiter": {"enabled": True, "base_delay": [1.0, 2.0]},
         "timeouts": {"stream_init": 30.0, "batch_process": 300.0},
-        "pool": {"max_pages": 40, "idle_ttl_sec": 300},
+        "pool": {"max_pages": 40, "idle_ttl_sec": 300, "max_pages_before_recycle": 200},
         "browser": {
             "kwargs": {"headless": True, "text_mode": True},
             "extra_args": [
```

---

### Incident Patch 8: `64f124c5` (2026-09-22)
**Commit Message**: Merge pull request #2229 from Nalhin/fix-robots-parsing

fix: preventing disallow: /*? from blocking the whole website.

**File**: `crawl4ai/utils.py` (modified, +20/-2)
```diff
@@ -249,6 +249,22 @@ def needs_update(self):
         return installed is None or installed < current
 
 
+def _preserve_bare_query(rules_text: str) -> str:
+    """Append '*' to Allow/Disallow values ending in a bare '?' (e.g. '/*?').
+
+    '/*?' and '/*?*' allow/deny exactly the same URLs; the rewrite only
+    survives parsers that would otherwise drop the trailing '?'.
+    """
+    fixed = []
+    for raw_line in rules_text.splitlines():
+        body, _, _ = raw_line.partition("#")
+        key, sep, value = body.partition(":")
+        if sep and key.strip().lower() in ("allow", "disallow") and value.strip().endswith("?"):
+            raw_line = f"{key.strip()}: {value.strip()}*"
+        fixed.append(raw_line)
+    return "\n".join(fixed)
+
+
 class RobotsParser:
     # Default 7 days cache TTL
     CACHE_TTL = 7 * 24 * 60 * 60
@@ -355,8 +371,10 @@ async def can_fetch(self, url: str, user_agent: str = "*") -> bool:
             return True
 
         # Create parser for this check
-        parser = RobotFileParser() 
-        parser.parse(rules.splitlines())
+        parser = RobotFileParser()
+        # Old Pythons drop a trailing '?' from rules, so '/*?' becomes
+        # '/*' and blocks the whole site. '/*?*' matches the same URLs.
+        parser.parse(_preserve_bare_query(rules).splitlines())
         
         # If parser can't read rules, allow access
         if not parser.mtime():
```

**File**: `tests/general/test_robot_parser.py` (modified, +39/-0)
```diff
@@ -123,6 +123,45 @@ async def giant_robots(request):
         finally:
             await runner.cleanup()
 
+        # 4b. Test query-string disallow (Disallow: /*?) on a separate host port.
+        # Plain URLs must stay crawlable while query URLs are denied (RFC 9309).
+        async def start_query_server():
+            query_app = web.Application()
+
+            async def query_robots(request):
+                return web.Response(text="User-agent: *\nDisallow: /*?\n")
+
+            query_app.router.add_get('/robots.txt', query_robots)
+            query_runner = web.AppRunner(query_app)
+            await query_runner.setup()
+            query_site = web.TCPSite(query_runner, '127.0.0.1', 0)
+            await query_site.start()
+            query_port = query_runner.addresses[0][1]
+            return query_runner, query_port
+
+        query_runner, query_port = await start_query_server()
+        try:
+            print("\n4b. Testing query-string robots.txt rules...")
+            query_base = f"http://127.0.0.1:{query_port}"
+
+            result = await parser.can_fetch(f"{query_base}/", "bot")
+            print(f"Plain root (/): {'allowed' if result else 'denied'}")
+            assert result, "Plain root should be allowed with Disallow: /*?"
+
+            result = await parser.can_fetch(f"{query_base}/article", "bot")
+            print(f"Plain page (/article): {'allowed' if result else 'denied'}")
+            assert result, "Plain page should be allowed with Disallow: /*?"
+
+            result = await parser.can_fetch(f"{query_base}/?page=2", "bot")
+            print(f"Query root (/?page=2): {'allowed' if result else 'denied'}")
+            assert not result, "Query root should be denied with Disallow: /*?"
+
+            result = await parser.can_fetch(f"{query_base}/article?ref=x", "bot")
+            print(f"Query page (/article?ref=x): {'allowed' if result else 'denied'}")
+            assert not result, "Query page should be denied with Disallow: /*?"
+        finally:
+            await query_runner.cleanup()
+
         # 5. Cache manipulation
         print("\n5. Testing cache manipulation...")
         
```

**File**: `tests/unit/test_robots_query_rules.py` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+"""Unit tests for robots.txt rules ending in a bare '?' (e.g. 'Disallow: /*?').
+
+urllib drops the trailing '?', which the wildcard patch in crawl4ai.utils turns
+into the regex '^/.*' - disallowing the whole site. _preserve_bare_query rewrites
+the rule to the equivalent '/*?*', which survives the round trip.
+"""
+
+import asyncio
+
+import pytest
+
+from crawl4ai.utils import RobotsParser, _preserve_bare_query
+
+QUERY_RULES = "User-agent: *\nDisallow: /*?\n"
+
+
+@pytest.mark.parametrize(
+    "line, expected",
+    [
+        # A bare trailing '?' gains an explicit '*'
+        ("Disallow: /*?", "Disallow: /*?*"),
+        ("Allow: /*?", "Allow: /*?*"),
+        ("Disallow: /search?", "Disallow: /search?*"),
+        # Case and spacing are normalised, not required
+        ("disallow: /*?", "disallow: /*?*"),
+        ("DISALLOW:/*?", "DISALLOW: /*?*"),
+        ("Disallow:   /*?   ", "Disallow: /*?*"),
+        # Already explicit, or no trailing '?': left alone
+        ("Disallow: /*?*", "Disallow: /*?*"),
+        ("Disallow: /private/", "Disallow: /private/"),
+        ("Allow: /public/", "Allow: /public/"),
+        # Non-rule directives are never rewritten, even ending in '?'
+        ("User-agent: *", "User-agent: *"),
+        ("Sitemap: https://example.com/sitemap.xml?", "Sitemap: https://example.com/sitemap.xml?"),
+        ("", ""),
+        ("# just a comment", "# just a comment"),
+    ],
+)
+def test_preserve_bare_query_line_rewriting(line, expected):
+    assert _preserve_bare_query(line) == expected
+
+
+def test_preserve_bare_query_keeps_document_structure():
+    """Untouched lines, blank lines and ordering survive verbatim.
+
+    Compared line by line, since the only caller re-splits the result
+    immediately; whether a trailing newline survives is deliberately unpinned.
+    """
+    source = "User-agent: *\nDisallow: /private/\n\nDisallow: /*?\nAllow: /public/\n"
+    assert _preserve_bare_query(source).splitlines() == [
+        "User-agent: *", "Disallow: /private/", "", "Disallow: /*?*", "Allow: /public/",
+    ]
+
+
+def test_preserve_bare_query_is_idempotent():
+    once = _preserve_bare_query(QUERY_RULES)
+    assert _preserve_bare_query(once) == once
+
+
+def _can_fetch(rules, path, tmp_path):
+    """Answer can_fetch for a host whose rules are pre-seeded in the cache.
+
+    Nothing listens on the host, and can_fetch falls back to 'allowed' whenever a
+    fetch fails, so any denial below can only have come from the cached rules.
+    """
+    host = "localhost:8098"
+    parser = RobotsParser(cache_dir=str(tmp_path))
+    parser._cache_rules(host, rules)
+    assert parser._get_cached_rules(host)[1], "seeded rules should be fresh"
+    return asyncio.run(parser.can_fetch(f"http://{host}{path}", "bot"))
+
+
+@pytest.mark.parametrize("path", ["/", "/article", "/a/b/c"])
+def test_query_disallow_keeps_plain_urls_crawlable(path, tmp_path):
+    """'Disallow: /*?' must not take the whole site down."""
+    assert _can_fetch(QUERY_RULES, path, tmp_path) is True
+
+
+@pytest.mark.parametrize("path", ["/?page=2", "/article?ref=x", "/a/b?x=1&y=2"])
+def test_query_disallow_denies_query_urls(path, tmp_path):
+    assert _can_fetch(QUERY_RULES, path, tmp_path) is False
+
+
+def test_ordinary_rules_still_apply(tmp_path):
+    """The rewrite must not disturb rules that never had a trailing '?'."""
+    rules = "User-agent: *\nDisallow: /private/\nAllow: /public/\n"
+    assert _can_fetch(rules, "/public/page", tmp_path) is True
+    assert _can_fetch(rules, "/private/secret", tmp_path) is False
```

---

### Incident Patch 9: `673171ad` (2026-09-22)
**Commit Message**: Merge pull request #2269 from nightcityblade/docs-security-supported-versions-v2

docs: list 0.9.x as supported

**File**: `SECURITY.md` (modified, +2/-1)
```diff
@@ -4,7 +4,8 @@
 
 | Version | Supported          |
 | ------- | ------------------ |
-| 0.8.x   | :white_check_mark: |
+| 0.9.x   | :white_check_mark: |
+| 0.8.x   | :x: (upgrade recommended) |
 | 0.7.x   | :x: (upgrade recommended) |
 | < 0.7   | :x:                |
 
```

---

### Incident Patch 10: `2740268e` (2026-09-14)
**Commit Message**: Merge pull request #2265 from unclecode/fix/2242-deep-crawl-perf

fix(deep-crawl): drop the O(n²) parent scan and the duplicate best-first enqueue

**File**: `crawl4ai/deep_crawling/bff_strategy.py` (modified, +7/-0)
```diff
@@ -179,6 +179,13 @@ async def link_discovery(
             base_url = normalize_url_for_deep_crawl(url, source_url)
             if base_url in visited:
                 continue
+            # Already queued at an equal or shallower depth: a second entry would
+            # be scored and dropped for nothing. A strictly shallower find still
+            # has to re-queue, so the URL is crawled at its true distance from the
+            # start and its own children stay inside max_depth.
+            queued_depth = depths.get(base_url)
+            if queued_depth is not None and queued_depth <= new_depth:
+                continue
             if not await self.can_process_url(base_url, new_depth):
                 self.stats.urls_skipped += 1
                 continue
```

**File**: `crawl4ai/deep_crawling/bfs_strategy.py` (modified, +6/-2)
```diff
@@ -248,6 +248,8 @@ async def _arun_batch(
 
             next_level: List[Tuple[str, Optional[str]]] = []
             urls = [url for url, _ in current_level]
+            # reversed() keeps first-parent-wins if a resumed level repeats a URL
+            parents = dict(reversed(current_level))
 
             # Clone the config to disable deep crawling recursion and enforce batch mode.
             batch_config = config.clone(deep_crawl_strategy=None, stream=False)
@@ -258,7 +260,7 @@ async def _arun_batch(
                 depth = depths.get(url, 0)
                 result.metadata = result.metadata or {}
                 result.metadata["depth"] = depth
-                parent_url = next((parent for (u, parent) in current_level if u == url), None)
+                parent_url = parents.get(url)
                 result.metadata["parent_url"] = parent_url
                 results.append(result)
 
@@ -336,6 +338,8 @@ async def _arun_stream(
 
             next_level: List[Tuple[str, Optional[str]]] = []
             urls = [url for url, _ in current_level]
+            # reversed() keeps first-parent-wins if a resumed level repeats a URL
+            parents = dict(reversed(current_level))
             visited.update(urls)
 
             stream_config = config.clone(deep_crawl_strategy=None, stream=True)
@@ -348,7 +352,7 @@ async def _arun_stream(
                 depth = depths.get(url, 0)
                 result.metadata = result.metadata or {}
                 result.metadata["depth"] = depth
-                parent_url = next((parent for (u, parent) in current_level if u == url), None)
+                parent_url = parents.get(url)
                 result.metadata["parent_url"] = parent_url
                 
                 # Count only successful crawls
```

**File**: `tests/deep_crawling/test_deep_crawl_perf_2242.py` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+"""Regression tests for issue #2242.
+
+1. BFS matched a fetched result back to its parent by re-scanning the whole
+   level, which is O(n^2) per level.
+2. Best-First only marked a URL visited when it was dequeued, so two pages
+   linking to the same third page pushed it onto the priority queue twice.
+"""
+
+import asyncio
+from collections import Counter
+from typing import Any, Dict, List
+from unittest.mock import MagicMock
+
+import pytest
+
+from crawl4ai.deep_crawling import BFSDeepCrawlStrategy, BestFirstCrawlingStrategy
+
+
+def make_config(stream: bool = False):
+    config = MagicMock()
+    config.clone = MagicMock(return_value=config)
+    config.stream = stream
+    return config
+
+
+class FakeResult:
+    """Cheap stand-in for CrawlResult (MagicMock is too slow to time against)."""
+
+    def __init__(self, url: str, children: List[str]):
+        self.url = url
+        self.success = True
+        self.metadata: Dict[str, Any] = {}
+        self.links = {
+            "internal": [{"href": child} for child in children],
+            "external": [],
+        }
+
+
+def make_crawler(link_map: Dict[str, List[str]]):
+    """Mock crawler serving a fixed url -> child urls map."""
+
+    async def arun_many(urls, config):
+        results = [FakeResult(url, link_map.get(url, [])) for url in urls]
+
+        if config.stream:
+            async def gen():
+                for result in results:
+                    yield result
+            return gen()
+        return results
+
+    crawler = MagicMock()
+    crawler.arun_many = arun_many
+    return crawler
+
+
+ROOT = "https://example.com"
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("stream", [False, True])
+async def test_bfs_parent_url_is_correct_for_every_child(stream):
+    """Parent bookkeeping must stay correct now that it uses a lookup table."""
+    children = [f"{ROOT}/p{i}" for i in range(50)]
+    link_map = {ROOT: children, **{c: [f"{c}/leaf"] for c in children}}
+
+    strategy = BFSDeepCrawlStrategy(max_depth=1, max_pages=100)
+    crawler, config = make_crawler(link_map), make_config(stream=stream)
+
+    if stream:
+        results = [r async for r in strategy._arun_stream(ROOT, crawler, config)]
+    else:
+        results = await strategy._arun_batch(ROOT, crawler, config)
+
+    parents = {r.url: r.metadata["parent_url"] for r in results}
+    assert parents[ROOT] is None
+    assert len(results) == len(children) + 1
+    for child in children:
+        assert parents[child] == ROOT
+
+
+@pytest.mark.asyncio
+async def test_bfs_level_bookkeeping_scales_linearly():
+    """Matching results back to parents must not re-scan the level per result.
+
+    max_depth=0 keeps link discovery out of the loop and resume_state seeds a
+    level of arbitrary width, so the only per-result work left is the parent
+    lookup. Quadratic bookkeeping shows up as a ~4x cost for 2x the URLs.
+    """
+
+    async def run(n: int) -> float:
+        urls = [f"{ROOT}/p{i}" for i in range(n)]
+        strategy = BFSDeepCrawlStrategy(
+            max_depth=0,
+            max_pages=n + 1,
+            resume_state={
+                "visited": urls,
+                "pending": [{"url": u, "parent_url": ROOT} for u in urls],
+                "depths": {u: 1 for u in urls},
+                "pages_crawled": 0,
+            },
+        )
+        crawler, config = make_crawler({}), make_config()
+        loop = asyncio.get_running_loop()
+        start = loop.time()
+        results = await strategy._arun_batch(ROOT, crawler, config)
+        elapsed = loop.time() - start
+        assert len(results) == n
+        return elapsed
+
+    async def best_of(n: int, rounds: int = 3) -> float:
+        return min([await run(n) for _ in range(rounds)])
+
+    await run(200)  # warm up
+    small = await best_of(2000)
+    large = await best_of(4000)
+
+    # 2x the URLs: linear is ~2x, the old full-level scan was ~4x.
+    assert large / small < 3,
```

#### Recent Merged Pull Requests:
- **PR #2281** (2026-09-23): Release v0.9.4 (@ntohidi)
- **PR #2280** (2026-09-23): docs(security): list fixed issues and features per release through v0.9.3 (@SohamKukreti)
- **PR #2279** (2026-09-22): chore(ci): drop the dead Google Apps Script stargazer step (@ntohidi)
- **PR #2278** (2026-09-22): fix(robots): don't patch robotparser on Python 3.14+ (@ntohidi)
- **PR #2269** (2026-09-22): docs: list 0.9.x as supported (@nightcityblade)
- **PR #2268** (closed): fix(tables): keep th row headers and carry rowspan down (@L4XB)
- **PR #2266** (2026-09-14): Keep malformed timeouts at the default ceiling (@ntohidi)
- **PR #2265** (2026-09-14): fix(deep-crawl): drop the O(n²) parent scan and the duplicate best-first enqueue (@ntohidi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
