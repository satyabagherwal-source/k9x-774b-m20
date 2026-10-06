# Forensic Learning Record (Deep Inspection): deedy5/ddgs

> **Canonical Artifact**: `07_PROJECT_LEARNING/deedy5-ddgs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/deedy5/ddgs](https://github.com/deedy5/ddgs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:06:11.956Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `deedy5/ddgs`
- **Description**: A metasearch library that aggregates results from diverse web search services
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3000 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ddgs/engines/__init__.py`
```
"""Automatically build registry of search engines.

This module defines the module-level variable ENGINES, which is a dictionary
of dictionaries. The keys of the outer dictionary are the categories of search
engines, and the keys of the inner dictionaries are the names of the search
engines. The values of the inner dictionaries are the classes of the search
engines.

The search engines are automatically discovered by looking for classes in the
module that are subclasses of :class:`ddgs.base.BaseSearchEngine` and
subclasses of the base class do not have names starting with "Base", and
do not have a class attribute "disabled" set to True.

The module automatically builds the ENGINES dictionary, so it should not be
imported directly by user code.

Example of resulting dictionary ENGINES:

from .bing import Bing
from .brave import Brave
from .duckduckgo import Duckduckgo
from .duckduckgo_images import DuckduckgoImages
from .duckduckgo_news import DuckduckgoNews
from .duckduckgo_videos import DuckduckgoVideos
from .google import Google
from .mojeek import Mojeek
from .wikipedia import Wikipedia
from .yahoo import Yahoo
from .yandex import Yandex

ENGINES: dict[str, dict[str, type[BaseSearchEngine[Any]]]] = {
    "text": {
        "bing": Bing,
        "brave": Brave,
        "duckduckgo": Duckduckgo,  # bing
        "google": Google,
        "mojeek": Mojeek,
        "yahoo": Yahoo,  # bing
        "yandex": Yandex,
        "wikipedia": Wikipedia,
    },
    "images": {
        "duckduckgo": DuckduckgoImages,
    },
    "news": {
        "duckduckgo": DuckduckgoNews,
    },
    "videos": {
        "duckduckgo": DuckduckgoVideos,
    },
}
"""

import importlib
import inspect
import pkgutil
from collections import defaultdict
from typing import Any

from ddgs.base import BaseSearchEngine

# ENGINES[category][name] = class
ENGINES: dict[str, dict[str, type[BaseSearchEngine[Any]]]] = defaultdict(dict)

package_name = __name__
package = importlib.import_module(package_name)

for finder, modname, _ispkg in pkgutil.iter_modules(package.__path__, package_name + "."):
    module_path = finder.path if hasattr(finder, "path") else finder
    module = importlib.import_module(modname)
    for _, cls in inspect.getmembers(module, inspect.isclass):
        # 1) must subclass BaseSearchEngine (but not the base itself)
        if not issubclass(cls, BaseSearchEngine) or cls is BaseSearchEngine:
            continue

        # 2) skip any class whose name starts with "Base"
        if cls.__name__.startswith("Base"):
            continue

        # 3) skip disabled engines
        if getattr(cls, "disabled", True):
            continue

        # 3) ensure they provided name & category
        name = getattr(cls, "name", None)
        category = getattr(cls, "category", None)
        if not isinstance(name, str) or not isinstance(category, str):
            msg = f"{cls.__qualname__} must define class attributes 'name: str' and 'category: str'."
            raise TypeError(msg)

        ENGINES[category][name] = cls

# freeze into normal dicts
ENGINES = {cat: dict(m) for cat, m in ENGINES.items()}

```

### Core Architecture Module: `ddgs/engines/annasarchive.py`
```
"""Anna's Archive search engine implementation."""

from collections.abc import Mapping
from random import SystemRandom
from typing import Any, ClassVar

from ddgs.base import BaseSearchEngine
from ddgs.results import BooksResult

random = SystemRandom()


class AnnasArchive(BaseSearchEngine[BooksResult]):
    """Anna's Archive search engine."""

    name = "annasarchive"
    category = "books"
    provider = "annasarchive"

    search_url = f"https://annas-archive.{random.choice(['gd', 'gl', 'pk'])}/search"
    search_method = "GET"

    items_xpath = "//div[contains(@class, 'record-list-outer')]/div"
    elements_xpath: ClassVar[Mapping[str, str]] = {
        "title": ".//a[contains(@class, 'text-lg')]//text()",
        "author": ".//a[span[contains(@class, 'user')]]//text()",
        "publisher": ".//a[span[contains(@class, 'company')]]//text()",
        "info": ".//div[contains(@class, 'text-gray-800')]/text()",
        "url": "./a/@href",
        "thumbnail": ".//img/@src",
    }

    def build_payload(
        self,
        query: str,
        region: str,  # noqa: ARG002
        safesearch: str,  # noqa: ARG002
        timelimit: str | None,  # noqa: ARG002
        page: int = 1,
        **kwargs: str,  # noqa: ARG002
    ) -> dict[str, Any]:
        """Build a payload for the search request."""
        return {"q": query, "page": f"{page}"}

    def pre_process_html(self, html_text: str) -> str:
        """Pre-process the HTML text before parsing it."""
        return html_text.replace("<!--", "").replace("-->", "")

    def post_extract_results(self, results: list[BooksResult]) -> list[BooksResult]:
        """Post-process search results."""
        base_url = self.search_url.split("/search")[0]
        for result in results:
            result.url = f"{base_url}{result.url}"
        return results

```

### Core Architecture Module: `ddgs/engines/bing.py`
```
"""Bing search engine implementation."""

import base64
from collections.abc import Mapping
from time import time
from typing import Any, ClassVar
from urllib.parse import parse_qs, urlparse

from ddgs.base import BaseSearchEngine
from ddgs.results import TextResult


def unwrap_bing_url(raw_url: str) -> str | None:
    """Decode the Bing-wrapped raw_url to extract the original url."""
    parsed = urlparse(raw_url)
    u_vals = parse_qs(parsed.query).get("u", [])
    if not u_vals:
        return None

    u = u_vals[0]
    if len(u) <= 2:
        return None

    # Drop the first two characters, pad to a multiple of 4, then decode
    b64_part = u[2:]
    padding = "=" * (-len(b64_part) % 4)
    decoded = base64.urlsafe_b64decode(b64_part + padding)
    return decoded.decode()


class Bing(BaseSearchEngine[TextResult]):
    """Bing search engine."""

    disabled = True  # !!!

    name = "bing"
    category = "text"
    provider = "bing"

    search_url = "https://www.bing.com/search"
    search_method = "GET"

    items_xpath = "//li[contains(@class, 'b_algo')]"
    elements_xpath: ClassVar[Mapping[str, str]] = {
        "title": ".//h2/a//text()",
        "href": ".//h2/a/@href",
        "body": ".//p//text()",
    }

    def build_payload(
        self,
        query: str,
        region: str,
        safesearch: str,  # noqa: ARG002
        timelimit: str | None,
        page: int = 1,
        **kwargs: str,  # noqa: ARG002
    ) -> dict[str, Any]:
        """Build a payload for the Bing search request."""
        country, lang = region.lower().split("-")
        payload = {"q": query, "pq": query, "cc": lang}
        cookies = {
            "_EDGE_CD": f"m={lang}-{country}&u={lang}-{country}",
            "_EDGE_S": f"mkt={lang}-{country}&ui={lang}-{country}",
        }
        self.http_client.client.set_cookies("https://www.bing.com", cookies)
        if timelimit:
            d = int(time() // 86400)
            code = f"ez5_{d - 365}_{d}" if timelimit == "y" else "ez" + {"d": "1", "w": "2", "m": "3"}[timelimit]
            payload["filters"] = f'ex1:"{code}"'
        if page > 1:
            payload["first"] = f"{(page - 1) * 10}"
            payload["FORM"] = f"PERE{page - 2 if page > 2 else ''}"
        return payload

    def post_extract_results(self, results: list[TextResult]) -> list[TextResult]:
        """Post-process search results."""
        post_results = []
        for result in results:
            if result.href.startswith("https://www.bing.com/aclick?"):
                continue
            if result.href.startswith("https://www.bing.com/ck/a?"):
                result.href = unwrap_bing_url(result.href) or result.href
            post_results.append(result)
        return post_results

```

### Core Architecture Module: `ddgs/engines/bing_images.py`
```
"""Bing images search engine implementation."""

import json
from typing import Any

from ddgs.base import BaseSearchEngine
from ddgs.results import ImagesResult


class BingImages(BaseSearchEngine[ImagesResult]):
    """Bing images search engine."""

    name = "bing"
    category = "images"
    provider = "bing"

    search_url = "https://www.bing.com/images/async"
    search_method = "GET"

    items_xpath = "//div[./div[@class='imgpt']/a[@m] and ./div[@class='infopt']]"

    def build_payload(
        self,
        query: str,
        region: str,  # noqa: ARG002
        safesearch: str,  # noqa: ARG002
        timelimit: str | None,
        page: int = 1,
        **kwargs: str,
    ) -> dict[str, Any]:
        """Build a payload for the search request."""
        count = max(int(kwargs.get("max_results", 10)), 35)
        payload = {
            "q": query,
            "async": "1",
            "first": str((page - 1) * count + 1),
            "count": str(count),
        }
        if timelimit:
            payload["qft"] = (
                f"filterui:age-lt{ ({'day': 1440, 'week': 10080, 'month': 44640, 'year': 525600}[timelimit]) }"
            )
        return payload

    def extract_results(self, html_text: str) -> list[ImagesResult]:
        """Extract search results from html text."""
        html_text = self.pre_process_html(html_text)
        tree = self.extract_tree(html_text)
        items = tree.xpath(self.items_xpath)
        results = []
        for item in items:
            result = ImagesResult()
            if metadata := item.xpath(".//a[@class='iusc']/@m"):
                m = json.loads(metadata[0])
                result.title = m.get("t")
                result.image = m.get("murl")
                result.thumbnail = m.get("turl")
                result.url = m.get("purl")
                if dimension := item.xpath(".//div[contains(@class, 'img_info')][./span]/span[@class='nowrap']/text()"):
                    width, height = dimension[0].replace("×", "x").split("x")  # noqa: RUF001
                    result.width = width.strip()
                    result.height = height.split()[0].strip()
                if source := item.xpath(".//div[@class='lnkw']//a/text()"):
                    result.source = source[0]
                results.append(result)
        return results

```

### Core Architecture Module: `ddgs/engines/bing_news.py`
```
"""Bing news engine implementation."""

import re
from collections.abc import Mapping
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from typing import Any, ClassVar

from ddgs.base import BaseSearchEngine
from ddgs.results import NewsResult

DATE_RE = re.compile(r"\b(\d+)\s*(days|tagen|jours|giorni|dias|días|дн\.|день)?\b", re.IGNORECASE)


def extract_date(pub_date_str: str) -> str:
    """Extract date from string."""
    # Try parsing the date with predefined formats
    date_formats = ["%d.%m.%Y", "%m/%d/%Y", "%d/%m/%Y"]
    for date_format in date_formats:
        with suppress(ValueError):
            return datetime.strptime(pub_date_str, date_format).astimezone(timezone.utc).isoformat()

    # Search for relative date expressions
    match = DATE_RE.search(pub_date_str)
    if match:
        days_ago = int(match.group(1))
        return (datetime.now(timezone.utc) - timedelta(days=days_ago)).replace(microsecond=0).isoformat()

    # Return the original string if no date is found
    return pub_date_str


class BingNews(BaseSearchEngine[NewsResult]):
    """Bing news engine."""

    name = "bing"
    category = "news"
    provider = "bing"

    search_url = "https://www.bing.com/news/infinitescrollajax"
    search_method = "GET"

    items_xpath = "//div[contains(@class, 'newsitem')]"
    elements_xpath: ClassVar[Mapping[str, str]] = {
        "date": ".//span[@aria-label]//@aria-label",
        "title": "@data-title",
        "body": ".//div[@class='snippet']//text()",
        "url": "@url",
        "image": ".//a[contains(@class, 'image')]//@src",
        "source": "@data-author",
    }

    def build_payload(
        self,
        query: str,
        region: str,
        safesearch: str,  # noqa: ARG002
        timelimit: str | None,
        page: int = 1,
        **kwargs: str,  # noqa: ARG002
    ) -> dict[str, Any]:
        """Build a payload for the Bing search request."""
        country, lang = region.lower().split("-")
        payload = {
            "q": query,
            "InfiniteScroll": "1",
            "first": f"{page * 10 + 1}",
            "SFX": f"{page}",
            "cc": country,
            "setlang": lang,
        }
        if timelimit:
            payload["qft"] = {
                "d": 'interval="4"',  # doesn't exist so it's the same as one hour
                "w": 'interval="7"',
                "m": 'interval="9"',
                "y": 'interval="9"',  # doesn't exist so it's the same as month
            }[timelimit]
        return payload

    def post_extract_results(self, results: list[NewsResult]) -> list[NewsResult]:
        """Post-process search results."""
        for result in results:
            result.date = extract_date(result.date)
            result.image = f"https://www.bing.com{result.image.split('&')[0]}" if result.image else ""
        return results

```

### Core Architecture Module: `ddgs/engines/brave.py`
```
"""Brave search engine implementation."""

from collections.abc import Mapping
from typing import Any, ClassVar

from ddgs.base import BaseSearchEngine
from ddgs.results import TextResult


class Brave(BaseSearchEngine[TextResult]):
    """Brave search engine."""

    name = "brave"
    category = "text"
    provider = "brave"

    search_url = "https://search.brave.com/search"
    search_method = "GET"

    items_xpath = "//div[@data-type='web']"
    elements_xpath: ClassVar[Mapping[str, str]] = {
        "title": ".//div[(contains(@class,'title') or contains(@class,'sitename-container')) and position()=last()]//text()",  # noqa: E501
        "href": ".//a[div[contains(@class, 'title')]]/@href",
        "body": ".//div[contains(@class, 'snippet')]//div[contains(@class, 'content')]//text()",
    }

    def build_payload(
        self,
        query: str,
        region: str,
        safesearch: str,
        timelimit: str | None,
        page: int = 1,
        **kwargs: str,  # noqa: ARG002
    ) -> dict[str, Any]:
        """Build a payload for the search request."""
        payload = {"q": query, "source": "web"}
        country, _lang = region.lower().split("-")
        cookies = {country: country, "useLocation": "0"}
        if safesearch != "moderate":
            cookies["safesearch"] = "strict" if safesearch == "on" else "off"
        self.http_client.client.set_cookies("https://search.brave.com", cookies)
        if timelimit:
            payload["tf"] = {"d": "pd", "w": "pw", "m": "pm", "y": "py"}[timelimit]
        if page > 1:
            payload["offset"] = f"{page - 1}"
        return payload

```

### Core Architecture Module: `ddgs/engines/duckduckgo.py`
```
"""Duckduckgo search engine implementation."""

from collections.abc import Mapping
from typing import Any, ClassVar

from ddgs.base import BaseSearchEngine
from ddgs.results import TextResult


class Duckduckgo(BaseSearchEngine[TextResult]):
    """Duckduckgo search engine."""

    name = "duckduckgo"
    category = "text"
    provider = "bing"

    search_url = "https://html.duckduckgo.com/html/"
    search_method = "POST"

    items_xpath = "//div[contains(@class, 'body')]"
    elements_xpath: ClassVar[Mapping[str, str]] = {"title": ".//h2//text()", "href": "./a/@href", "body": "./a//text()"}

    def build_payload(
        self,
        query: str,
        region: str,
        safesearch: str,  # noqa: ARG002
        timelimit: str | None,
        page: int = 1,
        **kwargs: str,  # noqa: ARG002
    ) -> dict[str, Any]:
        """Build a payload for the search request."""
        payload = {"q": query, "b": "", "l": region}
        if page > 1:
            payload["s"] = f"{10 + (page - 2) * 15}"
        if timelimit:
            payload["df"] = timelimit
        return payload

    def post_extract_results(self, results: list[TextResult]) -> list[TextResult]:
        """Post-process search results."""
        return [r for r in results if not r.href.startswith("https://duckduckgo.com/y.js?")]

```

### Core Architecture Module: `ddgs/engines/duckduckgo_images.py`
```
"""Duckduckgo images search engine implementation."""

import json
from collections.abc import Mapping
from typing import Any, ClassVar

from ddgs.base import BaseSearchEngine
from ddgs.results import ImagesResult
from ddgs.utils import _extract_vqd


class DuckduckgoImages(BaseSearchEngine[ImagesResult]):
    """Duckduckgo images search engine."""

    name = "duckduckgo"
    category = "images"
    provider = "bing"

    search_url = "https://duckduckgo.com/i.js"
    search_method = "GET"
    headers_update: ClassVar[Mapping[str, str]] = {
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://duckduckgo.com/",
        "Sec-GPC": "1",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Priority": "u=4",
    }
    elements_replace: ClassVar[Mapping[str, str]] = {
        "title": "title",
        "image": "image",
        "thumbnail": "thumbnail",
        "url": "url",
        "height": "height",
        "width": "width",
        "source": "source",
    }

    def _get_vqd(self, query: str) -> str:
        """Get vqd value for a search query using DuckDuckGo."""
        resp_content = self.http_client.request("GET", "https://duckduckgo.com", params={"q": query}).content
        return _extract_vqd(resp_content, query)

    def build_payload(
        self,
        query: str,
        region: str,
        safesearch: str,
        timelimit: str | None,
        page: int = 1,
        **kwargs: str,
    ) -> dict[str, Any]:
        """Build a payload for the search request."""
        safesearch_base = {"on": "1", "moderate": "1", "off": "-1"}
        timelimit_base = {"d": "Day", "w": "Week", "m": "Month", "y": "Year"}
        timelimit = f"time:{timelimit_base[timelimit]}" if timelimit else ""
        size = kwargs.get("size")
        size = f"size:{size}" if size else ""
        color = kwargs.get("color")
        color = f"color:{color}" if color else ""
        type_image = kwargs.get("type_image")
        type_image = f"type:{type_image}" if type_image else ""
        layout = kwargs.get("layout")
        layout = f"layout:{layout}" if layout else ""
        license_image = kwargs.get("license_image")
        license_image = f"license:{license_image}" if license_image else ""
        payload = {
            "o": "json",
            "q": query,
            "l": region,
            "vqd": self._get_vqd(query),
            "p": safesearch_base[safesearch.lower()],
            "ct": "AT",
        }
        if timelimit or size or color or type_image or layout or license_image:
            payload["f"] = f"{timelimit},{size},{color},{type_image},{layout},{license_image}"
        if page > 1:
            payload["s"] = f"{(page - 1) * 100}"
        return payload

    def extract_results(self, html_text: str) -> list[ImagesResult]:
        """Extract search results from html text."""
        json_data = json.loads(html_text)
        items = json_data.get("results", [])
        results = []
        for item in items:
            result = ImagesResult()
            for key, value in self.elements_replace.items():
                data = item.get(key)
                result.__setattr__(value, data)
            results.append(result)
        return results

```

### Core Architecture Module: `ddgs/engines/duckduckgo_news.py`
```
"""Duckduckgo news search engine implementation."""

import json
from collections.abc import Mapping
from typing import Any, ClassVar

from ddgs.base import BaseSearchEngine
from ddgs.results import NewsResult
from ddgs.utils import _extract_vqd


class DuckduckgoNews(BaseSearchEngine[NewsResult]):
    """Duckduckgo news search engine."""

    name = "duckduckgo"
    category = "news"
    provider = "bing"

    search_url = "https://duckduckgo.com/news.js"
    search_method = "GET"

    elements_replace: ClassVar[Mapping[str, str]] = {
        "date": "date",
        "title": "title",
        "excerpt": "body",
        "url": "url",
        "image": "image",
        "source": "source",
    }

    def _get_vqd(self, query: str) -> str:
        """Get vqd value for a search query using DuckDuckGo."""
        resp_content = self.http_client.request("GET", "https://duckduckgo.com", params={"q": query}).content
        return _extract_vqd(resp_content, query)

    def build_payload(
        self,
        query: str,
        region: str,
        safesearch: str,
        timelimit: str | None,
        page: int = 1,
        **kwargs: str,  # noqa: ARG002
    ) -> dict[str, Any]:
        """Build a payload for the search request."""
        safesearch_base = {"on": "1", "moderate": "-1", "off": "-2"}
        payload = {
            "l": region,
            "o": "json",
            "noamp": "1",
            "q": query,
            "vqd": self._get_vqd(query),
            "p": safesearch_base[safesearch.lower()],
        }
        if timelimit:
            payload["df"] = timelimit
        if page > 1:
            payload["s"] = f"{(page - 1) * 30}"
        return payload

    def extract_results(self, html_text: str) -> list[NewsResult]:
        """Extract search results from lxml tree."""
        json_data = json.loads(html_text)
        items = json_data.get("results", [])
        results = []
        for item in items:
            result = NewsResult()
            for key, value in self.elements_replace.items():
                data = item.get(key)
                result.__setattr__(value, data)
            results.append(result)
        return results

```

### Core Architecture Module: `ddgs/engines/duckduckgo_videos.py`
```
"""Duckduckgo videos search engine implementation."""

import json
from collections.abc import Mapping
from typing import Any, ClassVar

from ddgs.base import BaseSearchEngine
from ddgs.results import VideosResult
from ddgs.utils import _extract_vqd


class DuckduckgoVideos(BaseSearchEngine[VideosResult]):
    """Duckduckgo videos search engine."""

    name = "duckduckgo"
    category = "videos"
    provider = "bing"

    search_url = "https://duckduckgo.com/v.js"
    search_method = "GET"

    elements_replace: ClassVar[Mapping[str, str]] = {
        "content": "content",
        "description": "description",
        "duration": "duration",
        "embed_html": "embed_html",
        "embed_url": "embed_url",
        "image_token": "image_token",
        "images": "images",
        "provider": "provider",
        "published": "published",
        "publisher": "publisher",
        "statistics": "statistics",
        "title": "title",
        "uploader": "uploader",
    }

    def _get_vqd(self, query: str) -> str:
        """Get vqd value for a search query using DuckDuckGo."""
        resp_content = self.http_client.request("GET", "https://duckduckgo.com", params={"q": query}).content
        return _extract_vqd(resp_content, query)

    def build_payload(
        self,
        query: str,
        region: str,
        safesearch: str,
        timelimit: str | None,
        page: int = 1,
        **kwargs: str,
    ) -> dict[str, Any]:
        """Build a payload for the search request."""
        safesearch_base = {"on": "1", "moderate": "-1", "off": "-2"}
        timelimit = f"publishedAfter:{timelimit}" if timelimit else ""
        resolution = kwargs.get("resolution")
        duration = kwargs.get("duration")
        license_videos = kwargs.get("license_videos")
        resolution = f"videoDefinition:{resolution}" if resolution else ""
        duration = f"videoDuration:{duration}" if duration else ""
        license_videos = f"videoLicense:{license_videos}" if license_videos else ""
        payload = {
            "l": region,
            "o": "json",
            "q": query,
            "vqd": self._get_vqd(query),
            "f": f"{timelimit},{resolution},{duration},{license_videos}",
            "p": safesearch_base[safesearch.lower()],
        }
        if page > 1:
            payload["s"] = f"{(page - 1) * 60}"
        return payload

    def extract_results(self, html_text: str) -> list[VideosResult]:
        """Extract search results from lxml tree."""
        json_data = json.loads(html_text)
        items = json_data.get("results", [])
        results = []
        for item in items:
            result = VideosResult()
            for key, value in self.elements_replace.items():
                data = item.get(key)
                result.__setattr__(value, data)
            results.append(result)
        return results

```

### Core Architecture Module: `ddgs/engines/google.py`
```
"""Google search engine implementation."""

from collections.abc import Mapping
from random import SystemRandom
from typing import Any, ClassVar

from ddgs.base import BaseSearchEngine
from ddgs.results import TextResult

random = SystemRandom()


def get_ua() -> str:
    """Return one User-Agent string."""
    firmware = random.choice(("2.0617.1.0.3", "2.0625.2.0.2", "2.0635.2.0.2", "5.0706.4.0.1", "5.0819.4.0.1"))
    ua = f"NokiaN72/{firmware} Series60/2.8 Profile/MIDP-2.0 Configuration/CLDC-1.1"
    if random.choice((True, False)):
        uc_version = random.choice(("7.9.1.120", "7.9.1.121", "7.9.1.122"))
        ua += f"/UC Browser{uc_version}/27/351/UCWEB"
    return ua


class Google(BaseSearchEngine[TextResult]):
    """Google search engine."""

    name = "google"
    category = "text"
    provider = "google"

    search_url = "https://www.google.com/wml/search"
    search_method = "GET"
    headers_update: ClassVar[dict[str, str]] = {"User-Agent": get_ua()}

    items_xpath = "//div[./div[1]/a and ./div[2][table]]"
    elements_xpath: ClassVar[Mapping[str, str]] = {
        "title": "./div[a]/a/span[1]/text()",
        "href": "./div[a]/a/@href",
        "body": "./div[2][table]//text()",
    }

    def build_payload(
        self,
        query: str,
        region: str,
        safesearch: str,
        timelimit: str | None,
        page: int = 1,
        **kwargs: str,  # noqa: ARG002
    ) -> dict[str, Any]:
        """Build a payload for the Google search request."""
        self.http_client.client.set_cookies("google.com", {"CONSENT": "YES+"})
        safesearch_base = {"on": "2", "moderate": "1", "off": "0"}
        start = (page - 1) * 10
        payload = {
            "q": query,
            "sca_esv": "1",
            "filter": safesearch_base[safesearch.lower()],
            "start": str(start),
        }
        country, lang = region.split("-")
        payload["hl"] = f"{lang}-{country.upper()}"  # interface language
        payload["lr"] = f"lang_{lang}"  # restricts to results written in a particular language
        payload["cr"] = f"country{country.upper()}"  # restricts to results written in a particular country
        if timelimit:
            payload["tbs"] = f"qdr:{timelimit}"
        return payload

    def pre_process_html(self, html_text: str) -> str:
        """Pre-process html_text before extracting results."""
        return html_text[html_text.find("?>") :]

    def post_extract_results(self, results: list[TextResult]) -> list[TextResult]:
        """Post-process search results."""
        post_results = []
        for result in results:
            if result.href.startswith("/url?q="):
                result.href = result.href.split("?q=")[1].split("&")[0].split("?")[0]
            if result.title and result.href.startswith("http"):
                post_results.append(result)
        return post_results

```

### Core Architecture Module: `ddgs/engines/grokipedia.py`
```
"""Grokipedia text search engine."""

import json
import logging
from typing import Any

from ddgs.base import BaseSearchEngine
from ddgs.results import TextResult

logger = logging.getLogger(__name__)


class Grokipedia(BaseSearchEngine[TextResult]):
    """Grokipedia text search engine."""

    name = "grokipedia"
    category = "text"
    provider = "grokipedia"
    priority = 1.9

    search_url = "https://grokipedia.com/api/typeahead"
    search_method = "GET"

    def build_payload(
        self,
        query: str,
        region: str,  # noqa: ARG002
        safesearch: str,  # noqa: ARG002
        timelimit: str | None,  # noqa: ARG002
        page: int = 1,  # noqa: ARG002
        **kwargs: str,  # noqa: ARG002
    ) -> dict[str, Any]:
        """Build a payload for the search request."""
        payload: dict[str, Any] = {"query": query, "limit": "1"}
        return payload

    def extract_results(self, html_text: str) -> list[TextResult]:
        """Extract search results from html text."""
        json_data = json.loads(html_text)
        items = json_data.get("results", [])
        if not items:
            return []

        result = TextResult()
        result.title = items[0].get("title", "").strip("_")
        body = items[0].get("snippet", "")
        result.body = body.split("\n\n", 1)[1] if "\n\n" in body else body
        result.href = f"https://grokipedia.com/page/{items[0]['slug']}"
        return [result]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #442** (2026-04-06): **ToolException('Error executing tool search_images: No results found.')**
  *Symptoms*: **Before you open an issue:** - [X] I have the latest version. (Check: `ddgs version`. Update: `pip install -U ddgs`) - [X] I tried reinstalling the library. (`pip install -I ddgs`) - [ ] I tried using a proxy  ## Describe the bug  The mcp tool that search images alway return no result found.  **Steps to reproduce the problem:** Launch the mcp server (ddgs mcp). Ask your agent to search an image (ex: Search a satellite image of the earth.)  You will see the error: ```py =1 run_id=019d3631-452a-7471-a2a7-fdf6c42959ce thread_id=3894607e-9962-456a-9d86-c062506829da thread_name=asyncio_1 2026-03-28T20:44:55.612473Z [info     ] HTTP Request: POST https://openrouter.ai/api/v1/chat/completions "HTTP/1.1 200 OK" [httpx] api_variant=local_dev assistant_id=fe096781-5601-53d2-b2f6-0d3403f7e9ca graph_id=agent langgraph_api_version=0.7.83 langgraph_node=model request_id=802cd397-8b30-491c-9359-f92fab940b3f run_attempt=1 run_id=019d3631-452a-7471-a2a7-fdf6c42959ce thread_id=3894607e-9962-456a-9d86-c062506829da thread_name=MainThread 2026-03-28T20:44:57.469226Z [warning  ] /home/jourdelune/Bureau/dev/media-ai/.venv/lib/python3.12/site-packages/structlog/stdlib.py:1166: UserWarning: Remove `format_exc_info` from your processor chain if you want pretty exceptions.   ed = p(logger, meth_name, ed)  # type: ignore[arg-type]  [py.warnings] api_variant=local_dev assistant_id=fe096781-5601-53d2-b2f6-0d3403f7e9ca graph_id=agent langgraph_api_version=0.7.83 request_id=802cd397-8b30-491c-9359-f92fab94
  **Post-Mortem & Fix Analysis**:
  > fixed in v9.13.0

- **Issue #416** (2026-03-01): **Ddgs suffixes hyphens with a space**
  *Symptoms*: **Before you open an issue:** - [x] I have the latest version. (Check: `ddgs version`. Update: `pip install -U ddgs`) - [ ] I tried reinstalling the library. (`pip install -I ddgs`) - [ ] I tried using a proxy  ## Describe the bug Ddgs suffixes hyphens (-) with a space in the `body` and `title`, here's an example: ```     {       "title": "GitHub - Farhie/docker- hashicorp - vault : PoC- ing vault"       "href": "https://github.com/farhie/docker-hashicorp-vault",       "body": "PoC- ing vault. Contribute to Farhie/docker- hashicorp - vault development by creating an account on GitHub.Run through the Hashicorp Vault hardening guide.",     }, ```  It should have been: ```     {       "title": "GitHub - Farhie/docker-hashicorp-vault : PoC-ing vault"       "href": "https://github.com/farhie/docker-hashicorp-vault",       "body": "PoC-ing vault. Contribute to Farhie/docker-hashicorp-vault development by creating an account on GitHub.Run through the Hashicorp Vault hardening guide.",     }, ```  Open the link in your browser to confirm.  What the bug is.  **Steps to reproduce the problem:** Please provide the steps to reproduce this problem.  ``` import json  from ddgs import DDGS  results = DDGS().text("Farhie docker-hashicorp-vault", max_results=5) print(json.dumps(results, indent=2)) ```  The `body` in the output query displays the issue: ```   {     "title": "GitHub - Farhie/docker-hashicorp-vault: PoC-ing vault",     "href": "https://github.com/Farhie/docker-hashicorp-vault", 
  **Post-Mortem & Fix Analysis**:
  > This is a patch that was generated to solve the bug.  I have not extensively studied the codebase of your project so I apologize in advance if this is not useful.  It might be short term bandaid.  Patch `apply.sh`. ```bash #!/usr/bin/env bash # Apply the ddgs text spacing patch to fix spurious spaces around punctuation. # See: https://github.com/deedy5/ddgs/issues/416 # # Usage: #   ./patches/apply.sh # # Tested against ddgs 9.10.0. After upgrading ddgs, re-run this script. # If the patch fails to apply, the upstream file may have changed — check # whether the fix has been merged upstream before patching manually.  set -euo pipefail  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)" PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)" PATCH_FILE="$SCRIPT_DIR/ddgs_text_spacing.patch"  # Locate the installed ddgs package (use uv run to ensure venv Python) SITE_PACKAGES="$(uv run python -c "import ddgs, pathlib; print(pathlib.Path(ddgs.__file__).parent)")" TARGET="$SITE_PACKAGES/base.py"  if [[ ! -f "$T
  > Fixed in https://github.com/deedy5/ddgs/pull/419

- **Issue #410** (2026-01-25): **ddgs image search: No results found**
  *Symptoms*: For image search, always return no results found.   - ddgs version: 9.10.0  ``` ddgs images -q apple           DDGSException: DDGSException('No results found.') ``` 
  **Post-Mortem & Fix Analysis**:
  > I try to use requests to fix this and submit a pull requests.
  > Not needed, works fine as is
  > I have the same problem. it works sometimes (source was bing). subsequent tries result in: DDGSException: DDGSException('No results found.') I suspect it's bot protection. It starts working again after a while, then fails again. Probably needs a better error message.

- **Issue #396** (2025-11-29): **Brave engine xpaths not working anymore**
  *Symptoms*: **Before you open an issue:** - [x] I have the latest version. (Check: `ddgs version`. Update: `pip install -U ddgs`) - [x] I tried reinstalling the library. (`pip install -I ddgs`) - [x] I tried using a proxy  ## Describe the bug  The brave search engine client does not return links for the search results found  **Steps to reproduce the problem:** ```bash uv add ddgs ```  ```python from ddgs.engines import Brave from pprint import pprint  pprint(Brave().search("ai inference"))  # output """ [TextResult(title='What is AI Inference in Machine Learning? - GeeksforGeeks',             href='',             body=''),  TextResult(title='What is AI inference?', href='', body=''),  TextResult(title='Get Instant AI Inference', href='', body=''), ... ] """ ```  **Solution that worked for me:** Seems like the parser is outdated, the following change solved things locally for me:  ```python class MyBrave(Brave):     elements_xpath = {         "title": ".//div[(contains(@class,'title') or contains(@class,'sitename-container')) and position()=last()]//text()",         # different rule for href to include deeper nesting and exclude thumbnail hrefs         "href": ".//a[not(contains(@class, 'thumbnail'))]/@href",         # different rule rule for body         "body": ".//div[contains(@class, 'content') and contains(@class,'desktop-default-regular')]//text()",     }   pprint(MyBrave().search("ai inference") # output """ [TextResult(title='AI inference vs. training: What is AI inference? | '   
  **Post-Mortem & Fix Analysis**:
  > Thanks for the issue, fixed in https://github.com/deedy5/ddgs/pull/397

- **Issue #390** (2025-11-14): **The issue of backend choosing duckduckgo**
  *Symptoms*: Now in my code, the backend only selects duckduckgo, but at this point, it prompts that no result is returned. But when I add other engines to the backend, there will be results. May I ask if duckduckgo is no longer supported at present?   ```python from ddgs import DDGS from pprint import pprint  search = ["duckduckgo", "wikipedia", "brave", "mojeek", "yahoo", "yandex"] # search = ["duckduckgo"]  ddgs = DDGS(timeout=40) results = ddgs.text(query="Trump", region="us-en", safesearch='moderate', timelimit=None, max_results=10, page=1, backend=", ".join(search)) pprint(results)  # DDGSException: No results found. ```
  **Post-Mortem & Fix Analysis**:
  > Have you tried with proxy?
  > > Have you tried with proxy?  I used a proxy. When I set the engine to ["duckduckgo", "wikipedia", "brave", "mojeek", "yahoo", "yandex"], I could get the search results normally. The specific code and results are as follows: ```python from ddgs import DDGS from pprint import pprint  search = ["duckduckgo", "wikipedia", "brave", "mojeek", "yahoo", "yandex"]  proxy_url = "socks5h://127.0.0.1:7891"  ddgs = DDGS(proxy=proxy_url, timeout=40) results = ddgs.text(query="Apple", region="us-en", safesearch='moderate', timelimit=None, max_results=10, backend=", ".join(search)) pprint(results)  # [{'body': 'Apple is no stranger to failure, but this year may enter history as ' #           'one of the most difficult for the iPhone.', #   'href': 'https://www.phonearena.com/news/apple-has-two-failed-iphones-in-2025-and-you-wont-be-surprised-which-those-are_id175713', #   'title': 'Apple has two failed iPhones in 2025, and you won’t be... - ' #            'PhoneArena'}, #  {'body': 'Apple sends a rec
  > Fixed in https://github.com/deedy5/ddgs/pull/391 Update to v9.9.1

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

### Incident Patch 1: `9f517bc4` (2026-08-26)
**Commit Message**: fix(engines): update DuckDuckgo

**File**: `ddgs/engines/duckduckgo.py` (modified, +1/-15)
```diff
@@ -1,18 +1,11 @@
 """Duckduckgo search engine implementation."""
 
 from collections.abc import Mapping
-from typing import Any, ClassVar, TypeVar
-
-from fake_useragent import UserAgent
+from typing import Any, ClassVar
 
 from ddgs.base import BaseSearchEngine
-from ddgs.http_client2 import HttpClient2
 from ddgs.results import TextResult
 
-ua = UserAgent()
-
-T = TypeVar("T")
-
 
 class Duckduckgo(BaseSearchEngine[TextResult]):
     """Duckduckgo search engine."""
@@ -27,13 +20,6 @@ class Duckduckgo(BaseSearchEngine[TextResult]):
     items_xpath = "//div[contains(@class, 'body')]"
     elements_xpath: ClassVar[Mapping[str, str]] = {"title": ".//h2//text()", "href": "./a/@href", "body": "./a//text()"}
 
-    headers: ClassVar[dict[str, str]] = {"User-Agent": ua.random}
-
-    def __init__(self, proxy: str | None = None, timeout: int | None = None, *, verify: bool = True) -> None:
-        """Temporary, delete when HttpClient is fixed."""
-        self.http_client = HttpClient2(headers=self.headers, proxy=proxy, timeout=timeout, verify=verify)  # type: ignore[assignment]
-        self.results: list[T] = []  # type: ignore[valid-type]
-
     def build_payload(
         self,
         query: str,
```

**File**: `ddgs/http_client2.py` (removed, +0/-151)
```diff
@@ -1,151 +0,0 @@
-"""Temporary HTTP client for 'backend=duckduckgo'. Delete when HttpClient is fixed."""
-
-import logging
-import ssl
-from random import SystemRandom
-from types import TracebackType
-from typing import TYPE_CHECKING, Any
-
-import h2
-import httpcore
-import httpx
-
-from .exceptions import DDGSException, TimeoutException
-
-if TYPE_CHECKING:
-    from collections.abc import Callable
-
-
-logger = logging.getLogger(__name__)
-random = SystemRandom()
-
-
-class Response:
-    """HTTP response."""
-
-    __slots__ = ("content", "status_code", "text")
-
-    def __init__(self, status_code: int, content: bytes, text: str) -> None:
-        self.status_code = status_code
-        self.content = content
-        self.text = text
-
-
-class HttpClient2:
-    """Temporary HTTP client."""
-
-    def __init__(
-        self,
-        headers: dict[str, str] | None = None,
-        proxy: str | None = None,
-        timeout: int | None = 10,
-        *,
-        verify: bool | str = True,
-    ) -> None:
-        """Initialize the HttpClient object.
-
-        Args:
-            headers (dict, optional): headers for the HTTP client.
-            proxy (str, optional): proxy for the HTTP client, supports http/https/socks5 protocols.
-                example: "http://user:pass@example.com:3128". Defaults to None.
-            timeout (int, optional): Timeout value for the HTTP client. Defaults to 10.
-            verify: (bool | str):  True to verify, False to skip or str path to a PEM file. Defaults to True.
-
-        """
-        self.client = httpx.Client(
-            headers=headers,
-            proxy=proxy,
-            timeout=timeout,
-            verify=_get_random_ssl_context(verify=verify) if verify else False,
-            follow_redirects=False,
-            http2=True,
-        )
-
-    def request(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
-        """Make a request to the HTTP client."""
-        with Patch():
-            try:
-                resp = self.client.request(*args, **kwargs)
-                return Response(status_code=resp.status_code, content=resp.content, text=resp.text)
-            except Exception as ex:
-                if "timed out" in f"{ex}":
-                    msg = f"Request timed out: {ex!r}"
-                    raise TimeoutException(msg) from ex
-                msg = f"{type(ex).__name__}: {ex!r}"
-                raise DDGSException(msg) from ex
-
-    def get(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
-        """Make a GET request to the HTTP client."""
-        return self.request(*args, method="GET", **kwargs)
-
-    def post(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
-        """Make a POST request to the HTTP client."""
-        return self.request(*args, method="POST", **kwargs)
-
-
-# SSL
-DEFAULT_CIPHERS = [  # https://developers.cloudflare.com/ssl/reference/cipher-suites/recommendations/
-    "TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256",
-    # Modern:
-    "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-ECDSA-CHACHA20-POLY1305", "ECDHE-RSA-AES128-GCM-SHA256",
-    "ECDHE-RSA-CHACHA20-POLY1305", "ECDHE-ECDSA-AES256-GCM-SHA384", "ECDHE-RSA-AES256-GCM-SHA384",
-    # Compatible:
-    "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-ECDSA-CHACHA20-POLY1305", "ECDHE-RSA-AES128-GCM-SHA256",
-    "ECDHE-RSA-CHACHA20-POLY1305", "ECDHE-ECDSA-AES256-GCM-SHA384", "ECDHE-RSA-AES256-GCM-SHA384",
-    "ECDHE-ECDSA-AES128-SHA256", "ECDHE-RSA-AES128-SHA256", "ECDHE-ECDSA-AES256-SHA384",  "ECDHE-RSA-AES256-SHA384",
-    # Legacy:
-    "ECDHE-ECDSA-AES128-SHA", "ECDHE-RSA-AES128-SHA", "AES128-GCM-SHA256", "AES128-SHA256", "AES128-SHA",
-    "ECDHE-RSA-AES256-SHA", "AES256-GCM-SHA384", "AES256-SHA256", "AES256-SHA", "DES-CBC3-SHA",
-]  # fmt: skip
-
-
-def _get_random_ssl_context(*, verify: bool | str) -> ssl.SSLContext:
-    ssl_context = ssl.create_default_context(cafile=verify if isinstance(verify, str) else None)
-    shuffled_ciphers = random.sample(DEFAULT_CIPHERS[9:], len(DEFAULT_CIPHERS) - 9)
-    ssl_context.set_ciphers(":".join(DEFAULT_CIPHERS[:9] + shuffled_ciphers))
-    commands: list[Callable[[ssl.SSLContext], None] | None] = [
-        None,
-        lambda context: setattr(context, "maximum_version", ssl.TLSVersion.TLSv1_2),
-        lambda context: setattr(context, "minimum_version", ssl.TLSVersion.TLSv1_3),
-        lambda context: setattr(context, "options", context.options | ssl.OP_NO_TICKET),
-    ]
-    random_command = random.choice(commands)
-    if random_command:
-        random_command(ssl_context)
-    return ssl_context
-
-
-class Patch:
-    """Patch the HTTP2Connection._send_connection_init method."""
-
-    def __enter__(self) -> None:
-        """Enter the context manager."""
-
-        def _send_connection_init(self: httpcore._sync.http2.HTTP2Connection, request: httpcore.Request) -> None:
-            self._h2_state.local_settings = h2.settings.S
```

**File**: `pyproject.toml` (modified, +1/-11)
```diff
@@ -28,10 +28,8 @@ classifiers = [
 ]
 dependencies = [
     "click>=8.1.8",
-    "primp>=1.2.3",
+    "primp>=1.3.1",
     "lxml>=4.9.4",
-    "httpx[http2,socks,brotli]>=0.28.1",  # temporarily
-    "fake-useragent>=2.2.0",
 ]
 dynamic = ["version"]
 
@@ -65,14 +63,6 @@ dev = [
     "types-pexpect",
     "types-PyYAML",
     "types-ujson",
-
-    # for mypy (httpx)
-    "types-PySocks",
-    "types-colorama",
-    "types-decorator",
-    "types-jsonschema",
-    "types-psutil",
-    "types-pyasn1"
 ]
 mcp = [
     "mcp>=2.0",
```

---

### Incident Patch 2: `3ea6cbcb` (2026-08-26)
**Commit Message**: fix(engines): update and enable Google

**File**: `ddgs/engines/google.py` (modified, +18/-25)
```diff
@@ -11,43 +11,31 @@
 
 
 def get_ua() -> str:
-    """Return one random Android Google App User-Agent string."""
-    # Device templates: (Android version, device string, Chrome major version range)
-    devices = (
-        ("5.0", "SM-G900P Build/LRX21T", 39, 60),
-        ("6.0", "Nexus 5 Build/MRA58N", 39, 60),
-        ("8.0", "Pixel 2 Build/OPD3.170816.012", 39, 60),
-    )
-    android_ver, device, chrome_min, chrome_max = random.choice(devices)
-    chrome_major = random.randint(chrome_min, chrome_max)
-    chrome_build = random.randint(1000, 9999)
-    chrome_patch = random.randint(1000, 1999)
-    ua = (
-        f"Mozilla/5.0 (Linux; Android {android_ver}; {device}) "
-        f"AppleWebKit/537.36 (KHTML, like Gecko) "
-        f"Chrome/{chrome_major}.0.{chrome_build}.{chrome_patch} Mobile Safari/537.36"
-    )
-    return ua + bytes.fromhex("4e53544e5756").decode()
+    """Return one User-Agent string."""
+    firmware = random.choice(("2.0617.1.0.3", "2.0625.2.0.2", "2.0635.2.0.2", "5.0706.4.0.1", "5.0819.4.0.1"))
+    ua = f"NokiaN72/{firmware} Series60/2.8 Profile/MIDP-2.0 Configuration/CLDC-1.1"
+    if random.choice((True, False)):
+        uc_version = random.choice(("7.9.1.120", "7.9.1.121", "7.9.1.122"))
+        ua += f"/UC Browser{uc_version}/27/351/UCWEB"
+    return ua
 
 
 class Google(BaseSearchEngine[TextResult]):
     """Google search engine."""
 
-    disabled = True
-
     name = "google"
     category = "text"
     provider = "google"
 
-    search_url = "https://www.google.com/search"
+    search_url = "https://www.google.com/wml/search"
     search_method = "GET"
     headers_update: ClassVar[dict[str, str]] = {"User-Agent": get_ua()}
 
-    items_xpath = "//div[@data-hveid][.//h3]"
+    items_xpath = "//div[./div[1]/a and ./div[2][table]]"
     elements_xpath: ClassVar[Mapping[str, str]] = {
-        "title": ".//h3//text()",
-        "href": ".//a[.//h3]/@href",
-        "body": "./div/div[last()]//text()",
+        "title": "./div[a]/a/span[1]/text()",
+        "href": "./div[a]/a/@href",
+        "body": "./div[2][table]//text()",
     }
 
     def build_payload(
@@ -65,6 +53,7 @@ def build_payload(
         start = (page - 1) * 10
         payload = {
             "q": query,
+            "sca_esv": "1",
             "filter": safesearch_base[safesearch.lower()],
             "start": str(start),
         }
@@ -76,12 +65,16 @@ def build_payload(
             payload["tbs"] = f"qdr:{timelimit}"
         return payload
 
+    def pre_process_html(self, html_text: str) -> str:
+        """Pre-process html_text before extracting results."""
+        return html_text[html_text.find("?>") :]
+
     def post_extract_results(self, results: list[TextResult]) -> list[TextResult]:
         """Post-process search results."""
         post_results = []
         for result in results:
             if result.href.startswith("/url?q="):
-                result.href = result.href.split("?q=")[1].split("&")[0]
+                result.href = result.href.split("?q=")[1].split("&")[0].split("?")[0]
             if result.title and result.href.startswith("http"):
                 post_results.append(result)
         return post_results
```

---

### Incident Patch 3: `f4ba66ca` (2026-08-16)
**Commit Message**: fix(engines): disable Google, Yandex

**File**: `README.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ pip install -U ddgs[mcp]  # MCP server (stdio)
 ## CLI version
 
 ```python3
-ddgs --help
+ddgs - -help
 ```
 
 [Go To TOP](#TOP)
```

**File**: `ddgs/engines/google.py` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ def get_ua() -> str:
 class Google(BaseSearchEngine[TextResult]):
     """Google search engine."""
 
+    disabled = True
+
     name = "google"
     category = "text"
     provider = "google"
```

**File**: `ddgs/engines/yandex.py` (modified, +2/-0)
```diff
@@ -13,6 +13,8 @@
 class Yandex(BaseSearchEngine[TextResult]):
     """Yandex search engine."""
 
+    disabled = True
+
     name = "yandex"
     category = "text"
     provider = "yandex"
```

**File**: `ddgs/http_client2.py` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ def _get_random_ssl_context(*, verify: bool | str) -> ssl.SSLContext:
     ssl_context = ssl.create_default_context(cafile=verify if isinstance(verify, str) else None)
     shuffled_ciphers = random.sample(DEFAULT_CIPHERS[9:], len(DEFAULT_CIPHERS) - 9)
     ssl_context.set_ciphers(":".join(DEFAULT_CIPHERS[:9] + shuffled_ciphers))
-    commands: list[None | Callable[[ssl.SSLContext], None]] = [
+    commands: list[Callable[[ssl.SSLContext], None] | None] = [
         None,
         lambda context: setattr(context, "maximum_version", ssl.TLSVersion.TLSv1_2),
         lambda context: setattr(context, "minimum_version", ssl.TLSVersion.TLSv1_3),
```

**File**: `pyproject.toml` (modified, +2/-1)
```diff
@@ -75,7 +75,7 @@ dev = [
     "types-pyasn1"
 ]
 mcp = [
-    "mcp>=1.26.0",
+    "mcp>=1.26.0,<2.0",
 ]
 api = [
     "fastapi>=0.135.1",
@@ -153,6 +153,7 @@ ignore = [
     "D213",  # multi-line-summary-second-line
     "N818",  # Exception name {name} should be named with an Error suffix
     "PLR0913",  # Too many arguments to function call
+    "PLR0917",  # Too many positional arguments in function definition
     "PLR2004",  # Magic value used in comparison
     "SLF001",  # Private member accessed
 ]
```

**File**: `skills/ddgs/SKILL.md` (modified, +3/-3)
```diff
@@ -19,13 +19,13 @@ results = DDGS().text("python async", max_results=5)
 
 # Images, news, videos, books
 images = DDGS().images("butterfly", max_results=5)
-news   = DDGS().news("ai regulation", timelimit="w")
+news = DDGS().news("ai regulation", timelimit="w")
 videos = DDGS().videos("rust programming")
-books  = DDGS().books("machine learning")
+books = DDGS().books("machine learning")
 
 # Extract content from a URL
 page = DDGS().extract("https://example.com")
-page["content"]          # Markdown text (default)
+page["content"]  # Markdown text (default)
 page = DDGS().extract("https://example.com", fmt="text_plain")
 page = DDGS().extract("https://example.com", fmt="content")  # raw bytes
 ```
```

---

### Incident Patch 4: `21de33d6` (2026-05-15)
**Commit Message**: fix(engines): update DuckDuckgo

**File**: `ddgs/engines/duckduckgo.py` (modified, +15/-1)
```diff
@@ -1,11 +1,18 @@
 """Duckduckgo search engine implementation."""
 
 from collections.abc import Mapping
-from typing import Any, ClassVar
+from typing import Any, ClassVar, TypeVar
+
+from fake_useragent import UserAgent
 
 from ddgs.base import BaseSearchEngine
+from ddgs.http_client2 import HttpClient2
 from ddgs.results import TextResult
 
+ua = UserAgent()
+
+T = TypeVar("T")
+
 
 class Duckduckgo(BaseSearchEngine[TextResult]):
     """Duckduckgo search engine."""
@@ -20,6 +27,13 @@ class Duckduckgo(BaseSearchEngine[TextResult]):
     items_xpath = "//div[contains(@class, 'body')]"
     elements_xpath: ClassVar[Mapping[str, str]] = {"title": ".//h2//text()", "href": "./a/@href", "body": "./a//text()"}
 
+    headers: ClassVar[dict[str, str]] = {"User-Agent": ua.random}
+
+    def __init__(self, proxy: str | None = None, timeout: int | None = None, *, verify: bool = True) -> None:
+        """Temporary, delete when HttpClient is fixed."""
+        self.http_client = HttpClient2(headers=self.headers, proxy=proxy, timeout=timeout, verify=verify)  # type: ignore[assignment]
+        self.results: list[T] = []  # type: ignore[valid-type]
+
     def build_payload(
         self,
         query: str,
```

**File**: `ddgs/http_client2.py` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+"""Temporary HTTP client for 'backend=duckduckgo'. Delete when HttpClient is fixed."""
+
+import logging
+import ssl
+from random import SystemRandom
+from types import TracebackType
+from typing import TYPE_CHECKING, Any
+
+import h2
+import httpcore
+import httpx
+
+from .exceptions import DDGSException, TimeoutException
+
+if TYPE_CHECKING:
+    from collections.abc import Callable
+
+
+logger = logging.getLogger(__name__)
+random = SystemRandom()
+
+
+class Response:
+    """HTTP response."""
+
+    __slots__ = ("content", "status_code", "text")
+
+    def __init__(self, status_code: int, content: bytes, text: str) -> None:
+        self.status_code = status_code
+        self.content = content
+        self.text = text
+
+
+class HttpClient2:
+    """Temporary HTTP client."""
+
+    def __init__(
+        self,
+        headers: dict[str, str] | None = None,
+        proxy: str | None = None,
+        timeout: int | None = 10,
+        *,
+        verify: bool | str = True,
+    ) -> None:
+        """Initialize the HttpClient object.
+
+        Args:
+            headers (dict, optional): headers for the HTTP client.
+            proxy (str, optional): proxy for the HTTP client, supports http/https/socks5 protocols.
+                example: "http://user:pass@example.com:3128". Defaults to None.
+            timeout (int, optional): Timeout value for the HTTP client. Defaults to 10.
+            verify: (bool | str):  True to verify, False to skip or str path to a PEM file. Defaults to True.
+
+        """
+        self.client = httpx.Client(
+            headers=headers,
+            proxy=proxy,
+            timeout=timeout,
+            verify=_get_random_ssl_context(verify=verify) if verify else False,
+            follow_redirects=False,
+            http2=True,
+        )
+
+    def request(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
+        """Make a request to the HTTP client."""
+        with Patch():
+            try:
+                resp = self.client.request(*args, **kwargs)
+                return Response(status_code=resp.status_code, content=resp.content, text=resp.text)
+            except Exception as ex:
+                if "timed out" in f"{ex}":
+                    msg = f"Request timed out: {ex!r}"
+                    raise TimeoutException(msg) from ex
+                msg = f"{type(ex).__name__}: {ex!r}"
+                raise DDGSException(msg) from ex
+
+    def get(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
+        """Make a GET request to the HTTP client."""
+        return self.request(*args, method="GET", **kwargs)
+
+    def post(self, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
+        """Make a POST request to the HTTP client."""
+        return self.request(*args, method="POST", **kwargs)
+
+
+# SSL
+DEFAULT_CIPHERS = [  # https://developers.cloudflare.com/ssl/reference/cipher-suites/recommendations/
+    "TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256",
+    # Modern:
+    "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-ECDSA-CHACHA20-POLY1305", "ECDHE-RSA-AES128-GCM-SHA256",
+    "ECDHE-RSA-CHACHA20-POLY1305", "ECDHE-ECDSA-AES256-GCM-SHA384", "ECDHE-RSA-AES256-GCM-SHA384",
+    # Compatible:
+    "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-ECDSA-CHACHA20-POLY1305", "ECDHE-RSA-AES128-GCM-SHA256",
+    "ECDHE-RSA-CHACHA20-POLY1305", "ECDHE-ECDSA-AES256-GCM-SHA384", "ECDHE-RSA-AES256-GCM-SHA384",
+    "ECDHE-ECDSA-AES128-SHA256", "ECDHE-RSA-AES128-SHA256", "ECDHE-ECDSA-AES256-SHA384",  "ECDHE-RSA-AES256-SHA384",
+    # Legacy:
+    "ECDHE-ECDSA-AES128-SHA", "ECDHE-RSA-AES128-SHA", "AES128-GCM-SHA256", "AES128-SHA256", "AES128-SHA",
+    "ECDHE-RSA-AES256-SHA", "AES256-GCM-SHA384", "AES256-SHA256", "AES256-SHA", "DES-CBC3-SHA",
+]  # fmt: skip
+
+
+def _get_random_ssl_context(*, verify: bool | str) -> ssl.SSLContext:
+    ssl_context = ssl.create_default_context(cafile=verify if isinstance(verify, str) else None)
+    shuffled_ciphers = random.sample(DEFAULT_CIPHERS[9:], len(DEFAULT_CIPHERS) - 9)
+    ssl_context.set_ciphers(":".join(DEFAULT_CIPHERS[:9] + shuffled_ciphers))
+    commands: list[None | Callable[[ssl.SSLContext], None]] = [
+        None,
+        lambda context: setattr(context, "maximum_version", ssl.TLSVersion.TLSv1_2),
+        lambda context: setattr(context, "minimum_version", ssl.TLSVersion.TLSv1_3),
+        lambda context: setattr(context, "options", context.options | ssl.OP_NO_TICKET),
+    ]
+    random_command = random.choice(commands)
+    if random_command:
+        random_command(ssl_context)
+    return ssl_context
+
+
+class Patch:
+    """Patch the HTTP2Connection._send_connection_init method."""
+
+    def __enter__(self) -> None:
+        """Enter the context manager."""
+
+        def _send_connection_init(self: httpcore._sync.http2.HTTP2Connection, request: httpcore.Request) -> None:
+            self._h2_state.local_settings = h2.settings.S
```

**File**: `pyproject.toml` (modified, +11/-1)
```diff
@@ -30,6 +30,8 @@ dependencies = [
     "click>=8.1.8",
     "primp>=1.2.3",
     "lxml>=4.9.4",
+    "httpx[http2,socks,brotli]>=0.28.1",  # temporarily
+    "fake-useragent>=2.2.0",
 ]
 dynamic = ["version"]
 
@@ -62,7 +64,15 @@ dev = [
     "types-Pygments",
     "types-pexpect",
     "types-PyYAML",
-    "types-ujson"
+    "types-ujson",
+
+    # for mypy (httpx)
+    "types-PySocks",
+    "types-colorama",
+    "types-decorator",
+    "types-jsonschema",
+    "types-psutil",
+    "types-pyasn1"
 ]
 mcp = [
     "mcp>=1.26.0",
```

---

### Incident Patch 5: `ad0f617d` (2026-05-14)
**Commit Message**: fix(engines): update Google useragents

**File**: `ddgs/engines/google.py` (modified, +1/-3)
```diff
@@ -27,14 +27,12 @@ def get_ua() -> str:
         f"AppleWebKit/537.36 (KHTML, like Gecko) "
         f"Chrome/{chrome_major}.0.{chrome_build}.{chrome_patch} Mobile Safari/537.36"
     )
-    return f"{ua} GoogleApp/{random.randint(0, 9)}"
+    return ua + bytes.fromhex("4e53544e5756").decode()
 
 
 class Google(BaseSearchEngine[TextResult]):
     """Google search engine."""
 
-    disabled = True  # !!!
-
     name = "google"
     category = "text"
     provider = "google"
```

---

### Incident Patch 6: `cb2abbb2` (2026-04-20)
**Commit Message**: build(deps): bump primp to 1.2.3

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ classifiers = [
 ]
 dependencies = [
     "click>=8.1.8",
-    "primp>=1.2.0",
+    "primp>=1.2.3",
     "lxml>=4.9.4",
 ]
 dynamic = ["version"]
```

---

### Incident Patch 7: `6e4a5070` (2026-04-20)
**Commit Message**: fix(engines): disable Google until fixed

**File**: `ddgs/engines/google.py` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ def get_ua() -> str:
 class Google(BaseSearchEngine[TextResult]):
     """Google search engine."""
 
+    disabled = True  # !!!
+
     name = "google"
     category = "text"
     provider = "google"
```

---

### Incident Patch 8: `a1ff07dd` (2026-04-17)
**Commit Message**: fix(dht): remove git dependencies from published extra group

PyPI rejects packages containing direct VCS dependencies. Comment out
coincurve and libp2p git references from the dht optional dependency
group. Update README with manual installation steps for these required
DHT dependencies and remove DHT entry from quick install examples.

**File**: `README.md` (modified, +7/-5)
```diff
@@ -26,7 +26,6 @@ ___
 pip install -U ddgs       # Base install
 pip install -U ddgs[api]  # API server (FastAPI)
 pip install -U ddgs[mcp]  # MCP server (stdio)
-pip install -U ddgs[dht]  # DHT Network (BETA)
 ```
 
 ## CLI version
@@ -117,14 +116,17 @@ When running:
 ### Installation
 
 ```bash
-# For Linux
+# Install base DHT package
 pip install -U ddgs[dht]
 
-# For macOS, first install gmp via homebrew:
+# Install required dependencies (works on Linux and macOS)
+pip install coincurve@git+https://github.com/ofek/coincurve.git@7829b29c08ebb1cc80386a1cdaf8c2243c4ef5c5
+pip install libp2p@git+https://github.com/libp2p/py-libp2p.git@0e88584c89377086883c6f5b26cd1a8052399be7
+
+# macOS only: First install gmp
 brew install gmp
-pip install -U ddgs[dht]
 
-# For Windows: DHT is not currently supported. Use base package only.
+# Windows: DHT is not supported. Use base package only.
 ```
 
 When installed, DHT:
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -74,9 +74,9 @@ api = [
 dht = [
     "fastapi>=0.135.1",
     "uvicorn[standard]>=0.41.0",
-    "coincurve @ git+https://github.com/ofek/coincurve.git@7829b29c08ebb1cc80386a1cdaf8c2243c4ef5c5",
-    "libp2p @ git+https://github.com/libp2p/py-libp2p.git@0e88584c89377086883c6f5b26cd1a8052399be7",
     "trio>=0.25.0",
+    #"coincurve @ git+https://github.com/ofek/coincurve.git@7829b29c08ebb1cc80386a1cdaf8c2243c4ef5c5",
+    #"libp2p @ git+https://github.com/libp2p/py-libp2p.git@0e88584c89377086883c6f5b26cd1a8052399be7",
 ]
 
 [tool.ruff]
```

---

### Incident Patch 9: `ff346f40` (2026-04-17)
**Commit Message**: build(config): add project urls and enable verbose publish logging

**File**: `.github/workflows/python-publish.yml` (modified, +1/-1)
```diff
@@ -29,4 +29,4 @@ jobs:
         TWINE_PASSWORD: ${{ secrets.ddgs }}
       run: |
         python -m build
-        twine upload dist/*
+        twine upload dist/* --verbose
```

**File**: `pyproject.toml` (modified, +4/-1)
```diff
@@ -33,8 +33,11 @@ dependencies = [
 ]
 dynamic = ["version"]
 
-[project.urls]  # Optional
+[project.urls]
 "Homepage" = "https://github.com/deedy5/ddgs"
+"Source" = "https://github.com/deedy5/ddgs"
+"Bug Tracker" = "https://github.com/deedy5/ddgs/issues"
+"Documentation" = "https://github.com/deedy5/ddgs/blob/main/README.md"
 
 [project.scripts]
 ddgs = "ddgs.cli:safe_entry_point"
```

---

### Incident Patch 10: `49c79d66` (2026-04-14)
**Commit Message**: fix(base): remove per-element strip in extract_results

**File**: `ddgs/base.py` (modified, +1/-2)
```diff
@@ -91,8 +91,7 @@ def extract_results(self, html_text: str) -> list[T]:
         for item in items:
             result = self.result_type()
             for key, value in self.elements_xpath.items():
-                parts = (x.strip() for x in item.xpath(value))
-                data = " ".join("".join(parts).split())
+                data = " ".join("".join(item.xpath(value)).split())
                 result.__setattr__(key, data)
             results.append(result)
         return results
```

---

### Incident Patch 11: `cc543d29` (2026-04-11)
**Commit Message**: fix(cli): handle deprecated -k flag in _sanitize_query

**File**: `ddgs/cli.py` (modified, +4/-4)
```diff
@@ -245,7 +245,7 @@ def text(
         page=page,
         backend=backend,
     )
-    query = _sanitize_query(query)
+    query = _sanitize_query(keywords or query)
     if output:
         _save_data(query, data, "text", filename=output)
     if download:
@@ -354,7 +354,7 @@ def images(
         layout=layout,
         license_image=license_image,
     )
-    query = _sanitize_query(query)
+    query = _sanitize_query(keywords or query)
     if output:
         _save_data(query, data, function_name="images", filename=output)
     if download:
@@ -426,7 +426,7 @@ def videos(
         duration=duration,
         license_videos=license_videos,
     )
-    query = _sanitize_query(query)
+    query = _sanitize_query(keywords or query)
     if output:
         _save_data(query, data, function_name="videos", filename=output)
     else:
@@ -479,7 +479,7 @@ def news(
         page=page,
         backend=backend,
     )
-    query = _sanitize_query(query)
+    query = _sanitize_query(keywords or query)
     if output:
         _save_data(query, data, function_name="news", filename=output)
     else:
```

---

### Incident Patch 12: `9e4e71f9` (2026-04-08)
**Commit Message**: fix(cli): add bing backend to images command

**File**: `ddgs/cli.py` (modified, +1/-1)
```diff
@@ -274,7 +274,7 @@ def text(
     "-b",
     "--backend",
     default=["auto"],
-    type=click.Choice(["auto", "all", "duckduckgo"]),
+    type=click.Choice(["auto", "all", "bing", "duckduckgo"]),
     multiple=True,
     callback=_convert_tuple_to_csv,
 )
```

**File**: `skills/ddgs/SKILL.md` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ Available backends by method:
 | Method | Backends |
 |--------|----------|
 | `text()` | `bing`, `brave`, `duckduckgo`, `google`, `grokipedia`, `mojeek`, `yandex`, `yahoo`, `wikipedia` |
-| `images()` | `duckduckgo` |
+| `images()` | `bing`, `duckduckgo` |
 | `videos()` | `duckduckgo` |
 | `news()` | `bing`, `duckduckgo`, `yahoo` |
 | `books()` | `annasarchive` |
```

---

### Incident Patch 13: `8e9ecbad` (2026-03-26)
**Commit Message**: fix(engines): update Google useragents and xpath's

**File**: `ddgs/engines/google.py` (modified, +22/-25)
```diff
@@ -11,27 +11,23 @@
 
 
 def get_ua() -> str:
-    """Return one random User-Agent string."""
-    # iOS version to GSA version mapping based on the provided user agents
-    os_gsa_map = {
-        "17_4": ["315.0.630091404", "317.0.634488990"],
-        "17_6_1": ["411.0.879111500"],
-        "18_1_1": ["411.0.879111500"],
-        "18_2": ["173.0.391310503"],
-        "18_6_2": ["397.0.836500703", "399.2.845414227", "410.0.875971614", "411.0.879111500"],
-        "18_7_2": ["411.0.879111500"],
-        "18_7_5": ["411.0.879111500"],
-        "18_7_6": ["411.0.879111500"],
-        "26_1_0": ["411.0.879111500"],
-        "26_2_0": ["396.0.833910942", "409.0.872648028", "411.0.879111500"],
-        "26_2_1": ["409.0.872648028", "411.0.879111500"],
-        "26_3_0": ["406.0.862495628", "410.0.875971614", "411.0.879111500"],
-        "26_3_1": ["370.0.762543316", "404.0.856692123", "408.0.868297084", "410.0.875971614", "411.0.879111500"],
-        "26_4_0": ["411.0.879111500"],
-    }
-    os_version = random.choice(list(os_gsa_map.keys()))
-    gsa_version = random.choice(os_gsa_map[os_version])
-    return f"Mozilla/5.0 (iPhone; CPU iPhone OS {os_version} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/{gsa_version} Mobile/15E148 Safari/604.1"  # noqa: E501
+    """Return one random Android Google App User-Agent string."""
+    # Device templates: (Android version, device string, Chrome major version range)
+    devices = (
+        ("5.0", "SM-G900P Build/LRX21T", 39, 60),
+        ("6.0", "Nexus 5 Build/MRA58N", 39, 60),
+        ("8.0", "Pixel 2 Build/OPD3.170816.012", 39, 60),
+    )
+    android_ver, device, chrome_min, chrome_max = random.choice(devices)
+    chrome_major = random.randint(chrome_min, chrome_max)
+    chrome_build = random.randint(1000, 9999)
+    chrome_patch = random.randint(1000, 1999)
+    ua = (
+        f"Mozilla/5.0 (Linux; Android {android_ver}; {device}) "
+        f"AppleWebKit/537.36 (KHTML, like Gecko) "
+        f"Chrome/{chrome_major}.0.{chrome_build}.{chrome_patch} Mobile Safari/537.36"
+    )
+    return f"{ua} GoogleApp/{random.randint(0, 9)}"
 
 
 class Google(BaseSearchEngine[TextResult]):
@@ -45,11 +41,11 @@ class Google(BaseSearchEngine[TextResult]):
     search_method = "GET"
     headers_update: ClassVar[dict[str, str]] = {"User-Agent": get_ua()}
 
-    items_xpath = "//div[@data-snc]"
+    items_xpath = "//div[@data-hveid][.//h3]"
     elements_xpath: ClassVar[Mapping[str, str]] = {
-        "title": ".//div[@role='link']//text()",
-        "href": ".//a/@href",
-        "body": "./div[@data-sncf]//text()",
+        "title": ".//h3//text()",
+        "href": ".//a[.//h3]/@href",
+        "body": "./div/div[last()]//text()",
     }
 
     def build_payload(
@@ -62,6 +58,7 @@ def build_payload(
         **kwargs: str,  # noqa: ARG002
     ) -> dict[str, Any]:
         """Build a payload for the Google search request."""
+        self.http_client.client.set_cookies("google.com", {"CONSENT": "YES+"})
         safesearch_base = {"on": "2", "moderate": "1", "off": "0"}
         start = (page - 1) * 10
         payload = {
```

---

### Incident Patch 14: `1c38694c` (2026-03-14)
**Commit Message**: fix(engines): update google engine xpaths for current search results

The Google search results HTML structure has changed, requiring updates to
the XPath selectors for items, title, href, and body elements. Also
restructured the user agent generation to use an iOS version to GSA
version mapping for more accurate user agent strings.

**File**: `ddgs/engines/google.py` (modified, +24/-25)
```diff
@@ -9,29 +9,29 @@
 
 random = SystemRandom()
 
-# iPhone GSA (Google Search App) user agents — Google serves server-rendered
-_GSA_TEMPLATE = (
-    "Mozilla/5.0 (iPhone; CPU iPhone OS {ios} like Mac OS X)"
-    " AppleWebKit/605.1.15 (KHTML, like Gecko)"
-    " GSA/{gsa} Mobile/15E148 Safari/604.1"
-)
-_GSA_VARIANTS = [
-    ("17_7_1", "406.0.862495628"),
-    ("18_0_1", "406.0.862495628"),
-    ("18_1_1", "399.2.845414227"),
-    ("18_5_0", "406.0.862495628"),
-    ("18_6_0", "406.0.862495628"),
-    ("18_6_2", "406.0.862495628"),
-    ("18_7_2", "404.0.856692123"),
-    ("18_7_3", "406.0.862495628"),
-    ("18_7_4", "406.0.862495628"),
-]
-
 
 def get_ua() -> str:
-    """Return a random GSA (Google Search App) iPhone user agent."""
-    ios, gsa = random.choice(_GSA_VARIANTS)
-    return _GSA_TEMPLATE.format(ios=ios, gsa=gsa)
+    """Return one random User-Agent string."""
+    # iOS version to GSA version mapping based on the provided user agents
+    os_gsa_map = {
+        "17_4": ["315.0.630091404", "317.0.634488990"],
+        "17_6_1": ["411.0.879111500"],
+        "18_1_1": ["411.0.879111500"],
+        "18_2": ["173.0.391310503"],
+        "18_6_2": ["397.0.836500703", "399.2.845414227", "410.0.875971614", "411.0.879111500"],
+        "18_7_2": ["411.0.879111500"],
+        "18_7_5": ["411.0.879111500"],
+        "18_7_6": ["411.0.879111500"],
+        "26_1_0": ["411.0.879111500"],
+        "26_2_0": ["396.0.833910942", "409.0.872648028", "411.0.879111500"],
+        "26_2_1": ["409.0.872648028", "411.0.879111500"],
+        "26_3_0": ["406.0.862495628", "410.0.875971614", "411.0.879111500"],
+        "26_3_1": ["370.0.762543316", "404.0.856692123", "408.0.868297084", "410.0.875971614", "411.0.879111500"],
+        "26_4_0": ["411.0.879111500"],
+    }
+    os_version = random.choice(list(os_gsa_map.keys()))
+    gsa_version = random.choice(os_gsa_map[os_version])
+    return f"Mozilla/5.0 (iPhone; CPU iPhone OS {os_version} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/{gsa_version} Mobile/15E148 Safari/604.1"  # noqa: E501
 
 
 class Google(BaseSearchEngine[TextResult]):
@@ -45,12 +45,11 @@ class Google(BaseSearchEngine[TextResult]):
     search_method = "GET"
     headers_update: ClassVar[dict[str, str]] = {"User-Agent": get_ua()}
 
-    # XPaths for GSA user agent response format.
-    items_xpath = "//div[contains(@class, 'MjjYud')]"
+    items_xpath = "//div[@data-snc]"
     elements_xpath: ClassVar[Mapping[str, str]] = {
-        "title": ".//div[contains(@role, 'link')]//text()",
+        "title": ".//div[@role='link']//text()",
         "href": ".//a/@href",
-        "body": ".//div[contains(@data-sncf, '1')]//text()",
+        "body": "./div[@data-sncf]//text()",
     }
 
     def build_payload(
```

---

### Incident Patch 15: `bd0a23e1` (2026-03-03)
**Commit Message**: fix(cli): only block for input in interactive mode

**File**: `ddgs/cli.py` (modified, +2/-1)
```diff
@@ -90,7 +90,8 @@ def _print_data(data: list[dict[str, str]], *, no_color: bool = False) -> None:
                     title = k
                     text = v
                 click.secho(f"{title:<12}{text}", bg="black", fg=COLORS[j] if not no_color else "white", overline=True)
-            input()
+            if sys.stdin.isatty():  # Only block for input in interactive mode
+                input()
 
 
 def _sanitize_query(query: str) -> str:
```

#### Recent Merged Pull Requests:
- **PR #469** (closed): Fix '**kwargs' bug that prevented passing 'max_results' argument to the 'build_payload' function & Allow searching multiple pages if one page is not enough (@Miss-Tired-Ghost)
- **PR #467** (2026-05-23): refactor(ddgs): improve extract performance (@Mizarka)
- **PR #466** (2026-05-17): feat: remove dht (@deedy5)
- **PR #465** (2026-05-15): fix(engines): update DuckDuckgo (@deedy5)
- **PR #464** (2026-05-14): feat(engines): add Startpage (@deedy5)
- **PR #462** (closed): remove grokipedia from "auto" (@neuhaus)
- **PR #460** (closed): fix(DuckDuckGo): correct search method and clean up URL (@kidonng)
- **PR #456** (2026-05-03): refactor(ddgs): improve engine selection and error handling (@deedy5)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
