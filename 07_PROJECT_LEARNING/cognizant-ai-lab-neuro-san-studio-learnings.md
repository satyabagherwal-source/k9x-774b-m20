# Forensic Learning Record (Deep Inspection): cognizant-ai-lab/neuro-san-studio

> **Canonical Artifact**: `07_PROJECT_LEARNING/cognizant-ai-lab-neuro-san-studio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cognizant-ai-lab/neuro-san-studio](https://github.com/cognizant-ai-lab/neuro-san-studio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:39:36.714Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cognizant-ai-lab/neuro-san-studio`
- **Description**: A playground for neuro-san
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1130 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `middleware/agent_network_designer/persistence/hocon_storability_util.py`
```
# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# END COPYRIGHT

from typing import Any
from typing import ClassVar


class HoconStorabilityUtil:
    """
    Static rules for what survives the trip through a generated agent network HOCON file.

    The designer writes a network's metadata block as one JSON object inside the HOCON header,
    and neuro-san reads the file back with AbstractAsyncConfigRestorer, which parses through
    leaf-common's HoconSerializationFormat and therefore pyhocon. Three pyhocon behaviours make
    a written entry differ from what is read back, and these predicates name them so that
    AgentNetworkMetadataBlock can drop such entries before they are written:

    - keys come back raw, without decoding JSON escapes, so a key holding a double quote, a
      backslash or a control character comes back changed or split into a path;
    - only the tab, newline and carriage-return escapes are decoded inside a string value; any
      other control character is read back as its escape text;
    - empty strings inside a list are dropped by the parser (the block class handles that one,
      since it is about the position of the value, not the value itself).

    Everything else reads back as written, dotted and URL-shaped keys included: the restorer
    converts with as_plain_ordered_dict(), which removes the quotes pyhocon keeps around such
    keys. Verified with pyhocon 0.3.63 and leaf-common 1.4.2 through the assembler and the
    restorer for every C0 control character, DEL, NEL and the Unicode line separators.

    Every method is static and the class holds no state, hence the Util name.
    """

    # The control characters pyhocon decodes inside a quoted string value.
    DECODED_CONTROL_CHARS: ClassVar[str] = "\t\n\r"

    @staticmethod
    def is_storable_key(key: Any) -> bool:
        """
        Tell whether an object key reads back from a HOCON file exactly as written.

        :param key: The key to check
        :return: True for a str without a double quote, a backslash or a control character;
                False for any other str and for a non-str key, which would come back as a str
        """
        if not isinstance(key, str):
            return False
        for char in key:
            if char in '"\\' or ord(char) < 32:
                return False
        return True

    @staticmethod
    def is_storable_string(text: str) -> bool:
        """
        Tell whether a string value reads back from a HOCON file exactly as written.

        :param text: The string value to check
        :return: True when every control character in text is one pyhocon decodes (tab,
                newline, carriage return); the empty string is storable as a value
        """
        for char in text:
            if ord(char) < 32 and char not in HoconStorabilityUtil.DECODED_CONTROL_CHARS:
                return False
        return True

```

### Core Architecture Module: `neuro_san_studio/coded_tools/utils/global_only_resolver.py`
```
# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# END COPYRIGHT

from ipaddress import IPv4Address
from ipaddress import IPv6Address
from ipaddress import ip_address
from socket import AF_INET

# AddressFamily exists at runtime (created dynamically as an IntEnum), but pylint
# cannot see it in the socket module stubs.
from socket import AddressFamily  # pylint: disable=no-name-in-module

from aiohttp import DefaultResolver
from aiohttp.abc import AbstractResolver
from aiohttp.abc import ResolveResult


class GlobalOnlyResolver(AbstractResolver):
    """DNS resolver that only returns globally routable addresses.

    Wraps aiohttp's DefaultResolver and requires every resolved address to be
    globally routable (rejects private/loopback/link-local/multicast/reserved
    ranges), raising ValueError with a url_not_allowed prefix otherwise.

    Why a resolver instead of a pre-fetch DNS check: validating a hostname
    *before* the fetch leaves a DNS-rebinding gap. The HTTP client re-resolves
    the hostname at connection time, so an attacker-controlled DNS server can
    return a safe address during validation and an internal one (e.g.
    169.254.169.254) for the actual connection. This resolver runs *inside*
    aiohttp's TCPConnector at connection time, so the addresses validated here
    are exactly the addresses the client connects to — there is no window in
    which the answer can change.

    Usage — disable the connector's DNS cache so every new connection
    re-validates instead of reusing a previously cached answer:

        TCPConnector(resolver=GlobalOnlyResolver(), use_dns_cache=False)

    Limitations:
    - aiohttp's TCPConnector short-circuits IP-literal hosts and never calls
      the resolver for them (see TCPConnector._resolve_host), so IP literals
      must be validated before the fetch (see UrlPolicy.validate_hostname_safety,
      which shares ensure_global_address for that check).
    - DNS is not the only rebinding vector: this does not protect requests made
      outside the connector this resolver is attached to.
    """

    def __init__(self) -> None:
        # DefaultResolver performs the actual lookup via the event loop's
        # non-blocking getaddrinfo (type=SOCK_STREAM) and builds the
        # ResolveResult dicts that TCPConnector expects, including IPv6
        # edge-case handling — no need to reimplement that here.
        self._resolver: DefaultResolver = DefaultResolver()

    @staticmethod
    def ensure_global_address(hostname: str, address: IPv4Address | IPv6Address) -> None:
        """Raise ValueError with url_not_allowed if the address is not globally routable.

        is_global is False for private (10/8, 172.16/12, 192.168/16), loopback
        (127/8, ::1), link-local (169.254/16, fe80::/10), CGNAT (100.64/10),
        multicast, unspecified (0.0.0.0, ::), and other reserved ranges.

        :param hostname: The hostname being validated; only used in the error message.
        :param address: The IP address to check.
        """
        if not address.is_global:
            raise ValueError(
                f"url_not_allowed: Host '{hostname}' uses IP address '{address}', "
                "which is not a globally routable address."
            )

    async def resolve(self, host: str, port: int = 0, family: AddressFamily = AF_INET) -> list[ResolveResult]:
        """Resolve the host and raise ValueError if any address is not globally routable.

        :param host: The hostname to resolve (never an IP literal; aiohttp
                     short-circuits those before calling the resolver).
        :param port: The port to include in the resolved results.
        :param family: The address family to resolve for (AF_INET, AF_INET6, or AF_UNSPEC).
        :return: The resolved addresses, all verified to be globally routable.
        :raises ValueError: url_not_allowed when resolution fails, yields no
                            addresses, or yields any non-global address.
        """
        try:
            results: list[ResolveResult] = await self._resolver.resolve(host, port, family)
        except OSError as dns_exc:
            # DefaultResolver raises OSError/gaierror on lookup failure. Convert to
            # the tool's ValueError contract here: TCPConnector only wraps OSError
            # (into ClientConnectorError), so this ValueError propagates unchanged
            # out of session.get()/head() and surfaces as url_not_allowed.
            raise ValueError(f"url_not_allowed: Host '{host}' could not be resolved.") from dns_exc

        if not results:
            raise ValueError(f"url_not_allowed: Host '{host}' doesn't resolve to an IP address.")

        # Every address must be global: the connector may connect to any of the
        # returned records (including fallback across them), so a single
        # non-global record makes the host unsafe.
        for entry in results:
            # Strip an IPv6 zone id (e.g. "fe80::1%eth0") so ip_address() can
            # parse the string; zoned addresses are link-local, so they are
            # rejected as non-global right after.
            ip_string: str = entry["host"].split("%", 1)[0]
            try:
                address: IPv4Address | IPv6Address = ip_address(ip_string)
            except ValueError as parse_exc:
                # Fail closed: an address we cannot parse is an address we
                # cannot vouch for.
                raise ValueError(
                    f"url_not_allowed: Host '{host}' resolved to unparseable address '{entry['host']}'."
                ) from parse_exc
            self.ensure_global_address(host, address)

        return results

    async def close(self) -> None:
        """Release resources held by the wrapped resolver."""
        await self._resolver.close()

```

### Core Architecture Module: `neuro_san_studio/coded_tools/utils/pdf_utils.py`
```
# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# END COPYRIGHT

from io import BytesIO

from pypdf import PdfReader

# How many leading bytes has_pdf_header inspects for the "%PDF-" marker. Adobe's
# PDF implementation notes allow the header to appear anywhere within the first
# 1024 bytes of the file (not only at offset 0), and pypdf tolerates that leading
# junk (it logs "invalid pdf header" and still parses the document). A strict
# startswith(b"%PDF-") check would therefore reject files pypdf reads fine.
PDF_HEADER_WINDOW: int = 1024


class PdfUtils:
    """Shared helpers for extracting text from PDF documents."""

    @staticmethod
    def has_pdf_header(head: bytes) -> bool:
        """
        Report whether the leading bytes of a file carry a PDF header marker.

        Cheap sanity check meant to run BEFORE a file is read in full or handed to
        pypdf: it lets callers reject an HTML error page saved as report.pdf, a NUL
        stream, or an empty file with a clear message instead of pypdf's
        "Stream has ended unexpectedly". It is not proof of a valid PDF; pypdf
        remains the authority on whether the bytes actually parse.

        :param head: The leading bytes of the candidate file (at least
            PDF_HEADER_WINDOW bytes when the file is that long; extra bytes are ignored).
        :return: True when "%PDF-" occurs within the first PDF_HEADER_WINDOW bytes.
        """
        return b"%PDF-" in head[:PDF_HEADER_WINDOW]

    @staticmethod
    def parse_pdf_bytes(data: bytes) -> str:
        """
        Extract text from in-memory PDF bytes, joining pages with newlines.

        :param data: The raw PDF bytes.
        :return: The extracted text of all pages, separated by newlines.
        """
        return "\n".join(PdfUtils.parse_pdf_bytes_per_page(data))

    @staticmethod
    def parse_pdf_bytes_per_page(data: bytes) -> list[str]:
        """
        Extract text from in-memory PDF bytes, one string per page.

        Callers that need page-level granularity (e.g. RAG loaders that record a
        page number in each Document's metadata) use this directly;
        parse_pdf_bytes is the joined-text convenience built on top of it.

        :param data: The raw PDF bytes.
        :return: The extracted text of each page, in page order.
        """
        reader = PdfReader(BytesIO(data))
        page_texts: list[str] = []
        for page in reader.pages:
            # extract_text() is typed Optional[str] in newer pypdf and can return
            # None for pages without extractable text (e.g. scanned images);
            # coerce to "" so callers never mix None into the page list.
            page_texts.append(page.extract_text() or "")
        return page_texts

```

### Core Architecture Module: `neuro_san_studio/coded_tools/utils/safe_fetch.py`
```
# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# END COPYRIGHT

import os
from asyncio import TimeoutError as AsyncTimeoutError
from asyncio import to_thread
from collections.abc import AsyncGenerator
from contextlib import AbstractAsyncContextManager
from contextlib import asynccontextmanager
from http import HTTPStatus
from typing import Any
from typing import NoReturn
from urllib.parse import ParseResult
from urllib.parse import parse_qs
from urllib.parse import urljoin
from urllib.parse import urlparse

from aiohttp import ClientError
from aiohttp import ClientResponseError
from aiohttp import ClientSession
from aiohttp import ClientTimeout
from aiohttp import DummyCookieJar
from aiohttp import RequestInfo
from aiohttp import TCPConnector
from bs4 import BeautifulSoup
from yarl import URL

from neuro_san_studio.coded_tools.utils.global_only_resolver import GlobalOnlyResolver
from neuro_san_studio.coded_tools.utils.pdf_utils import PDF_HEADER_WINDOW
from neuro_san_studio.coded_tools.utils.pdf_utils import PdfUtils
from neuro_san_studio.coded_tools.utils.url_policy import UrlPolicy

# Maximum bytes accepted via Content-Length header before downloading; also the
# running cap enforced on streamed response bodies (text and PDF alike). One
# shared limit for every tool on this path: large enough for real-world PDF
# corpora (tens of MB), while still bounding peak memory — the RAG loaders cap
# how many bodies they hold in flight at once (see their semaphore constants).
MAX_RESPONSE_BYTES: int = 50 * 1024 * 1024  # 50 MB
# Read size per iteration when streaming a response body.
DOWNLOAD_CHUNK_BYTES: int = 64 * 1024
TIMEOUT_SECONDS: int = 15
# Maximum number of 3xx hops followed per fetch before giving up with url_not_allowed.
# The chain MUST be bounded: a loop (A -> B -> A ...) or an arbitrarily long chain
# would otherwise let a remote server drive an unbounded number of requests from this
# host (a DoS vector, and a cheap way to probe our SSRF policy one hop at a time).
# 5 is far below the ~20 browsers tolerate: http -> https, bare-host -> www and a
# moved page fit within it with room to spare. Wall-clock cost: open_session applies
# TIMEOUT_SECONDS per request, not per chain, so a server slow-dripping 3xx answers
# can hold one chain for (MAX_REDIRECTS + 1) * TIMEOUT_SECONDS (90 s today), and one
# WebFetch call runs up to three chains (HEAD probe, GET fallback, content fetch).
# Bounded, and the price of re-validating each hop; keep it in mind before raising either.
MAX_REDIRECTS: int = 5
# Generic "download" media types that carry no real format information. When a server
# declares one of these (or no Content-Type at all), is_pdf falls back to sniffing
# the URL for a ".pdf" filename; any other concrete declared type is trusted as-is.
GENERIC_DOWNLOAD_CONTENT_TYPES: frozenset[str] = frozenset(
    {
        "application/octet-stream",
        "binary/octet-stream",
        "application/x-download",
        "application/force-download",
    }
)


class SafeFetch:
    """
    Shared SSRF-hardened URL fetching for coded tools that retrieve remote content.

    Used by WebFetch, WebpageRag and PdfRag.

    SSRF protection blocks private/loopback/reserved ranges and localhost.
    The URL-level rules live in UrlPolicy (scheme, MAX_URL_LENGTH, hostname
    canonicalization, the caller's allowed_domains / blocked_domains, and the
    up-front rejection of localhost names and IP literals); validate_url on this
    class delegates to it. Ordinary hostnames are validated at connection time by
    GlobalOnlyResolver, which requires every DNS record to be globally routable and
    closes the DNS-rebinding gap. Every network method (get_content_type, fetch_raw,
    download_pdf_bytes, and the fetch_text/fetch_pdf_text wrappers built on them)
    re-validates the URL at entry, so the SSRF policy holds even for a caller that
    skipped validate_url; all requests must still go through a session created by
    open_session to inherit the connection-time resolver check.
    Redirects are followed manually, up to MAX_REDIRECTS hops, and every Location
    target is re-validated with validate_url (including the caller's domain rules)
    before it is requested; a hop that fails validation, a 3xx without a Location,
    or a chain longer than MAX_REDIRECTS raises url_not_allowed
    (see _open_following_redirects). An https -> http downgrade hop is refused, and
    sessions store no cookies (DummyCookieJar).
    The byte cap (MAX_RESPONSE_BYTES) is enforced both via the Content-Length header
    (pre-check) and on the actual streamed bytes, for text fetches and PDF downloads
    alike, so a server that lies about or omits Content-Length cannot deliver an
    oversized body. A PDF download is also sniffed for a "%PDF-" header within its
    first PDF_HEADER_WINDOW bytes and refused (not_a_pdf) before the rest is read.

    Every URL named in an error message is reduced to scheme, host and path
    (UrlPolicy.redact_for_log): redirect targets are server-controlled and routinely carry a
    bearer credential in their query string, and these messages end up in logs.

    Error types (raised as ValueError or aiohttp.ClientResponseError or aiohttp.ClientError with the specified message)
        invalid_input            – URL is missing, not a valid http/https URL, or a parameter has an invalid type.
        url_too_long             – URL exceeds MAX_URL_LENGTH characters.
        url_not_allowed          – URL targets a private/reserved host, is blocked by domain rules,
                                    or a redirect hop fails those checks / the chain exceeds MAX_REDIRECTS.
        url_not_accessible       – HTTP error or network failure while fetching the page.
        too_many_requests        – Server returned HTTP 429.
        response_too_large       – Content-Length header or streamed body exceeds MAX_RESPONSE_BYTES.
        not_a_pdf                – PDF download has no "%PDF-" header in its first PDF_HEADER_WINDOW bytes.
    """

    @staticmethod
    def open_session() -> ClientSession:
        """
        Create a ClientSession that enforces the SSRF policy on every connection.

        GlobalOnlyResolver enforces the SSRF policy on the exact addresses the
        client connects to (anti DNS-rebinding). The connector's DNS cache is
        disabled so every new connection re-validates instead of reusing a
        previously cached answer.

        The session stores no cookies (DummyCookieJar). SafeFetch is a stateless
        content fetcher, and a cookie set by one response must never be replayed on
        a later request: other hops of a redirect chain and unrelated URLs fetched
        through one RAG session would otherwise share state.

        :return: A new ClientSession whose connector validates every resolved
                 address and disables DNS caching, and which stores no cookies. The
                 caller owns the session and must close it (use it as an async
                 context manager).
        """
        timeout = ClientTimeout(total=TIMEOUT_SECONDS)
        connector = TCPConnector(resolver=GlobalOnlyResolver(), use_dns_cache=False)
        # Honor the USER_AGENT environment variable, like the langchain
        # WebBaseLoader this path replaced: some sites answer 403 to aiohttp's
        # default "Python/x.y aiohttp/x.y.z" User-Agent, and operators already
        # use this variable to identify their crawlers.
        headers: dict[str, str] | None = None
        user_agent: str | None = os.environ.get("USER_AGENT")
        if user_agent:
            headers = {"User-Agent": user_agent}
        # DummyCookieJar: never store Set-Cookie. aiohttp's default CookieJar would
        # replay matching cookies on later requests, including other hops of a redirect
        # chain and unrelated URLs fetched through one RAG session; nothing here needs them.
        session: ClientSession = ClientSession(
            timeout=timeout, connector=connector, headers=headers, cookie_jar=DummyCookieJar()
        )
        # Mark the session so the network methods can reject a caller-supplied default
        # session, which would skip GlobalOnlyResolver and reopen the SSRF hole.
        # open_session is the only sanctioned constructor and always wires the
        # protected connector above, so the marker reliably implies the resolver is
        # present (see _require_protected_session and the open_session wiring test).
        session._safe_fetch_protected = True  # pylint: disable=protected-access
        return session

    @staticmethod
    def _require_protected_session(session: ClientSession) -> None:
        """
        Reject a session that was not created by open_session.

        SafeFetch's SSRF protection lives entirely in the connector open_session wires
        (GlobalOnlyResolver + no DNS cache); validate_url deliberately defers ordinary
        hostname resolution to that resolver. A caller passing a default ClientSession
        would skip the check and could reach a private address via a hostname that
        resolves to it, so every network method refuses an unmarked session up front.

        :param session: The session handed to a network method.
        :raises ValueError: when the session was not built by SafeFetch.open_session.
        """
        # getattr default is False for a real default session; a m
```

### Core Architecture Module: `neuro_san_studio/coded_tools/utils/url_policy.py`
```
# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# END COPYRIGHT

"""URL-level SSRF policy (scheme, length, hostname canonicalization, domain rules) behind SafeFetch."""

import re
from ipaddress import IPv4Address
from ipaddress import IPv6Address
from ipaddress import ip_address
from typing import Any
from urllib.parse import ParseResult
from urllib.parse import urlparse
from urllib.parse import urlunparse

import idna
from aiohttp.helpers import is_ip_address

from neuro_san_studio.coded_tools.utils.global_only_resolver import GlobalOnlyResolver

# Maximum accepted URL length, shared by every tool on this path (WebFetch and
# the RAG loaders) so they all accept the same URLs. 2000 is what browsers and
# CDNs commonly tolerate, and it leaves room for presigned object-store links
# (S3/Azure SAS), which routinely run 300-1000+ characters; anything longer is
# far more likely malformed or hostile than legitimate.
MAX_URL_LENGTH: int = 2000
# Characters permitted in a canonical (post-IDNA, lower-cased) DNS hostname. IP
# literals are validated separately; a genuine hostname containing anything outside
# this set means IDNA could not canonicalize it and it is not a usable DNS name.
HOSTNAME_ALLOWED_CHARS: frozenset[str] = frozenset("abcdefghijklmnopqrstuvwxyz0123456789.-_")
# A URL with an authority ("scheme://...") embedded in free text, such as an error message. Any
# scheme is matched, not only http(s), and the match runs to the next whitespace: a URL may itself
# contain quotes or brackets, so stopping at one would leave its query behind. Whatever quoting or
# punctuation the surrounding text closed the URL with is peeled off again in _redact_match.
# Case-insensitive because validate_url accepts an upper-case scheme and hands the spelling on.
URL_IN_TEXT_PATTERN: re.Pattern[str] = re.compile(r"[a-z][a-z0-9+.-]*://\S+", re.IGNORECASE)
# Characters that surrounding prose may attach to the end of a quoted URL; they are not part of it.
URL_TRAILING_CHARS: frozenset[str] = frozenset(".,;:)]>'\"")


class UrlPolicy:
    """
    URL-level SSRF policy for the coded tools that fetch through SafeFetch (WebFetch, WebpageRag and PdfRag).

    Answers one question, with no network access: is this URL string allowed under
    these domain rules? validate_url checks the scheme, the length (MAX_URL_LENGTH),
    the port, the presence and canonical form of the hostname (IDNA, Unicode dot
    separators, the DNS root-label dot), the caller's allowed_domains / blocked_domains, and
    finally hands the host to validate_hostname_safety, which rejects localhost names
    and IP literals that are not globally routable. Ordinary hostnames are
    deliberately NOT resolved here: their DNS records are validated at connection
    time by GlobalOnlyResolver on the SafeFetch session, which closes the
    DNS-rebinding gap (see that class for why a pre-fetch lookup is not enough).

    SafeFetch exposes validate_url, validate_hostname_safety and validate_domain_list
    as one-line delegations to this class, so the tools keep a single entry point;
    SafeFetch's network methods and redirect follower call this class directly.
    Split out of SafeFetch in #1442.

    Error types (raised as ValueError with the specified message prefix)
        invalid_input    – URL is not a string, empty, malformed, not http/https, has no or an
                            invalid hostname or port, or a domain-list parameter has an invalid type.
        url_too_long     – URL exceeds MAX_URL_LENGTH characters.
        url_not_allowed  – Host is localhost, an unsupported or non-global IP literal, outside
                            allowed_domains, or inside blocked_domains.
    """

    @staticmethod
    def validate_url(url_value: Any, allowed_domains: Any = None, blocked_domains: Any = None) -> str:
        """
        Validate a URL's format, length, and domain rules and return the cleaned URL.

        :param url_value: The candidate URL; must be an http/https string.
        :param allowed_domains: Optional allow-list (str or list[str]); if non-empty,
                                the host must equal or be a subdomain of one entry.
        :param blocked_domains: Optional block-list (str or list[str]); the host must
                                not equal or be a subdomain of any entry.
        :return: The stripped, validated URL.
        :raises ValueError: invalid_input, url_too_long, or url_not_allowed when the
                URL fails any format, length, domain, or hostname-safety check.
        """
        if not isinstance(url_value, str):
            raise ValueError(f"invalid_input: 'url' must be a string, got {url_value!r}.")

        url: str = url_value.strip()
        if not url:
            raise ValueError("invalid_input: No 'url' provided.")

        # urlparse itself raises ValueError on some malformed authorities (e.g. an
        # unmatched IPv6 bracket "https://[::1/"); translate it to invalid_input
        # rather than let the raw ValueError escape the documented contract.
        try:
            parsed: ParseResult = urlparse(url)
        except ValueError as exc:
            raise ValueError(f"invalid_input: URL is malformed: {exc}") from exc

        if parsed.scheme not in ("http", "https"):
            raise ValueError(f"invalid_input: URL must use http or https scheme, got '{parsed.scheme}'.")

        if len(url) > MAX_URL_LENGTH:
            raise ValueError(f"url_too_long: URL exceeds maximum length of {MAX_URL_LENGTH} characters.")

        raw_hostname: str | None = parsed.hostname
        if not raw_hostname:
            raise ValueError("invalid_input: URL must include a hostname.")

        # urlparse defers port validation until parsed.port is accessed, so a
        # non-numeric or out-of-range port would otherwise slip through and fail
        # later inside aiohttp with an untranslated ValueError.
        try:
            _ = parsed.port
        except ValueError as exc:
            raise ValueError(f"invalid_input: URL has an invalid port: {exc}") from exc

        # Canonicalize the host the same way aiohttp/yarl will before connecting, so
        # every domain and safety check runs on the exact form the request targets.
        # parsed.hostname strips the port/credentials; _to_ascii_host applies IDNA
        # (Unicode IDN -> punycode) and maps Unicode dot separators (U+3002 and
        # friends) to ASCII '.'.
        hostname: str = UrlPolicy._to_ascii_host(raw_hostname.lower())
        # Strip the DNS root-label dot only AFTER IDNA encoding: a Unicode trailing
        # dot becomes a strippable ASCII '.' during encoding. Doing this before the
        # domain and hostname-safety checks stops DNS-equivalent spellings
        # ("example.com.", "example.com。", "localhost。") from bypassing the block
        # list or the loopback guard.
        hostname = hostname.rstrip(".")
        # A root-only authority ("http://./", "http://../") has a non-empty
        # parsed.hostname but canonicalizes to an empty string here; reject it as
        # invalid_input rather than let an empty host slip past the checks and reach
        # DNS.
        if not hostname:
            raise ValueError("invalid_input: URL must include a valid hostname.")

        allowed: list[str] = UrlPolicy.validate_domain_list(allowed_domains, "allowed_domains")
        if allowed and not UrlPolicy._hostname_matches_any(hostname, allowed):
            raise ValueError(f"url_not_allowed: Domain '{hostname}' is not in the allowed_domains list.")

        blocked: list[str] = UrlPolicy.validate_domain_list(blocked_domains, "blocked_domains")
        if blocked and UrlPolicy._hostname_matches_any(hostname, blocked):
            raise ValueError(f"url_not_allowed: Domain '{hostname}' is blocked.")

        UrlPolicy.validate_hostname_safety(hostname)

        return url

    @staticmethod
    def _hostname_matches_any(hostname: str, domains: list[str]) -> bool:
        """
        Return whether a hostname matches any domain under a strict boundary.

        A domain entry "example.com" matches the host "example.com" and any
        subdomain "sub.example.com", but not "badexample.com". Matching is
        case-insensitive.

        :param hostname: The host to test, already canonicalized by validate_url
                (lower-cased, IDNA-ASCII, root-label dot stripped).
        :param domains: The domain entries to test against.
        :return: True if the hostname equals or is a subdomain of any entry.
        """
        # Canonicalize each entry the same way the host was (IDNA-ASCII + trailing
        # dot stripped) so both sides compare in the form aiohttp connects to; a
        # Unicode IDN spelling and its punycode entry (or a "example.com." FQDN
        # entry) would otherwise miss and bypass the configured block/allow rule.
        for domain in domains:
            lowered: str = UrlPolicy._to_ascii_host(domain.lower()).rstrip(".")
            if hostname == lowered or hostname.endswith("." + lowered):
                return True
        return False

    @staticmethod
    def _to_ascii_host(host: str) -> str:
        """
        Return the IDNA (punycode) ASCII form of a host for domain-policy matching.

        aiohttp/yarl connect to the IDNA-ASCII form of a Unicode host, and yarl uses
        this same "idna" package, so matching in its UTS#46 form g
```

### Core Architecture Module: `neuro_san_studio/utils/cli_prompt.py`
```
# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# END COPYRIGHT

"""Shared key-binding helpers for questionary prompts.

Esc is bound ``eager=True`` so the binding fires on a bare Escape press without
waiting out the prompt_toolkit Esc-as-meta-prefix timeout. Composite keys (arrow
keys, etc.) arrive at prompt_toolkit pre-assembled by the terminal, so they
aren't affected by the eager binding.
"""

from typing import Any

from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.key_binding import merge_key_bindings
from prompt_toolkit.key_binding.key_processor import KeyPressEvent
from prompt_toolkit.keys import Keys


class CliPrompt:
    """Bind extra keys onto a ``questionary`` prompt before ``.ask()`` is called.

    Two flavours:

    - :py:meth:`bind_back_keys` — ← / Esc resolve a sub-menu prompt to a caller-supplied
      back sentinel. The two keys play the same role ("go back one screen") so they
      share a binding entry-point.
    - :py:meth:`bind_exit_on_esc` — Esc resolves a top-level prompt to :data:`EXIT`,
      meaning "abort the entire flow". Use on screens where there's nothing to back up
      to (top menu, final confirm).
    """

    EXIT = "__exit__"

    @classmethod
    def bind_back_keys(cls, question: Any, back_sentinel: str) -> Any:
        """Bind ← and Esc → ``back_sentinel`` on a sub-menu prompt. Returns ``question``."""
        cls._bind(question, Keys.Left, back_sentinel)
        cls._bind(question, Keys.Escape, back_sentinel, eager=True)
        return question

    @classmethod
    def bind_exit_on_esc(cls, question: Any) -> Any:
        """Bind Esc → :data:`EXIT` on a prompt with no back target. Returns ``question``."""
        cls._bind(question, Keys.Escape, cls.EXIT, eager=True)
        return question

    @staticmethod
    def _bind(question: Any, key: Keys, sentinel: str, *, eager: bool = False) -> None:
        """Register ``key`` to resolve the prompt to ``sentinel`` via ``event.app.exit``.

        Some questionary prompts (e.g. ``confirm``) expose a read-only ``_MergedKeyBindings``
        on their application — we can't ``.add`` to that directly. Build a fresh writable
        registry, merge it on top of whatever's there, and reassign. This works uniformly
        for both writable and read-only registries.
        """
        extra = KeyBindings()
        registrar = extra.add(key, eager=eager)
        registrar(lambda event: CliPrompt._resolve(event, sentinel))
        # Order matters: put our extra first so it wins over any existing handler for
        # the same key. (questionary.confirm already binds Esc to "no answer / None"; we
        # want our EXIT sentinel to take precedence so the caller can distinguish.)
        existing = question.application.key_bindings
        question.application.key_bindings = merge_key_bindings([extra, existing]) if existing else extra

    @staticmethod
    def _resolve(event: KeyPressEvent, sentinel: str) -> None:
        """Resolve the prompt to ``sentinel`` (questionary returns this from ``ask()``)."""
        event.app.exit(result=sentinel)

```

### Core Architecture Module: `neuro_san_studio/utils/cli_status.py`
```
# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# END COPYRIGHT

"""Shared status-line helpers for ``ns`` CLI commands.

The init/import/export commands all surface step-by-step progress with the same prefixed
style — ``[ok]``, ``[skip]``, ``[warn]``, ``[err]``, ``[info]``. Centralizing the helpers
keeps the column alignment and Rich color scheme consistent across commands; emoji are
intentionally avoided so the output renders the same in CI logs, plain terminals, and
copy-pasted tickets.

Rich treats bare ``[xxx]`` as markup, so the leading bracket is escaped with a backslash
in each format string.
"""

from rich.console import Console


class CliStatus:
    """Shared status-line printers for ``ns`` CLI commands."""

    # Class-level Console — Rich is happy to share one across writers, and the
    # printers stay cheap to call from any command module.
    _console = Console()

    @classmethod
    def ok(cls, msg: str) -> None:
        """Successful step (file copied, action completed)."""
        cls._console.print(f"[green]\\[ok][/green]    {msg}")

    @classmethod
    def skip(cls, msg: str) -> None:
        """Step intentionally skipped (idempotent re-run, already-present target)."""
        cls._console.print(f"[yellow]\\[skip][/yellow]  {msg}")

    @classmethod
    def warn(cls, msg: str) -> None:
        """Recoverable issue worth surfacing (missing dep, unknown spec) but not fatal."""
        cls._console.print(f"[yellow]\\[warn][/yellow]  {msg}")

    @classmethod
    def err(cls, msg: str) -> None:
        """Failure that aborts the action — typically followed by ``sys.exit(1)``."""
        cls._console.print(f"[red]\\[err][/red]   {msg}")

    @classmethod
    def info(cls, msg: str) -> None:
        """Neutral progress line (analyzing, importing, summarizing)."""
        cls._console.print(f"[cyan]\\[info][/cyan]  {msg}")

```

### Core Architecture Module: `neuro_san_studio/utils/hocon_text.py`
```
# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# END COPYRIGHT

from typing import Optional


class HoconText:
    """Brace/string/comment-aware scanning helpers for editing HOCON source text in place.

    Operating on raw text (rather than a parsed model) keeps ``include`` directives,
    ``${substitutions}``, and comments intact, which a pyhocon parse/re-emit would drop.
    """

    @staticmethod
    def skip_line(text: str, i: int) -> int:
        """Advance past the rest of the current line (used to skip ``# ...`` comments)."""
        n = len(text)
        while i < n and text[i] != "\n":
            i += 1
        return i + 1 if i < n else i

    @classmethod
    def first_significant_index(cls, text: str) -> int:
        """Index of the first char that isn't whitespace, a ``#``/``//`` comment, or an
        ``include`` directive line. Returns ``len(text)`` if there's nothing significant."""
        n = len(text)
        i = 0
        while i < n:
            char = text[i]
            if char in " \t\r\n":
                i += 1
                continue
            if char == "#" or text.startswith("//", i):
                i = cls.skip_line(text, i)
                continue
            if text.startswith("include", i):
                i = cls.skip_line(text, i)
                continue
            return i
        return n

    @staticmethod
    def find_string_end(text: str, start: int) -> int:
        """Given ``text[start] == '"'``, return the index of the closing quote (-1 if unterminated)."""
        n = len(text)
        j = start + 1
        while j < n:
            if text[j] == "\\" and j + 1 < n:
                j += 2
                continue
            if text[j] == '"':
                return j
            j += 1
        return -1

    @staticmethod
    def find_triple_string_end(text: str, start: int) -> int:
        """Given ``text[start:start+3] == '\"\"\"'``, return the index of the last quote of the
        closing ``\"\"\"`` (-1 if unterminated). HOCON triple-quoted strings have no escaping."""
        close = text.find('"""', start + 3)
        if close == -1:
            return -1
        # A run of >3 quotes closes at the last one (e.g. ``\"\"\"x\"\"\"\"`` ends the string at the
        # 4th quote), matching HOCON/JSON-superset behavior.
        end = close + 2
        while end + 1 < len(text) and text[end + 1] == '"':
            end += 1
        return end

    @classmethod
    def skip_string(cls, text: str, start: int) -> int:
        """Given ``text[start] == '"'``, return the index just past the string (triple- or
        single-quoted). Returns -1 if the string is unterminated."""
        if text.startswith('"""', start):
            end = cls.find_triple_string_end(text, start)
        else:
            end = cls.find_string_end(text, start)
        return -1 if end == -1 else end + 1

    @classmethod
    def match_closing_brace(cls, text: str, open_index: int) -> Optional[int]:
        """Given ``text[open_index] == '{'``, return the index just past its matching ``}``.

        Tracks single- and triple-quoted strings and ``#`` comments so braces inside those
        don't throw off the count. Returns ``None`` if the brace is never closed.
        """
        n = len(text)
        depth = 1
        k = open_index + 1
        while k < n and depth > 0:
            char = text[k]
            if char == '"':
                after = cls.skip_string(text, k)
                if after == -1:
                    return None
                k = after
                continue
            if char == "#":
                k = cls.skip_line(text, k)
                continue
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return k + 1
            k += 1
        return None

```

### Core Architecture Module: `neuro_san_studio/utils/import_reporter.py`
```
# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# END COPYRIGHT

"""Console rendering for a batch of agent-network imports.

`ns init` and `ns import` run the same batch through
``AgentNetworkImporter.import_networks``; they report it the same way too. Keeping the
rendering here -- rather than in either command -- means the importer stays silent and
testable without capturing stdout, and the two commands cannot drift on what a batch
looks like when it finishes.
"""

from typing import List

from neuro_san_studio.importer.bulk_import_result import BulkImportResult
from neuro_san_studio.utils.cli_status import CliStatus

# Long lists of near-identical warnings bury the summary they belong to. Show a handful
# and count the rest; the full detail is on the failing network itself.
MAX_LISTED = 5


class ImportReporter:
    """Print per-network progress and the closing summary for an import batch."""

    @staticmethod
    def announce(hocon_path: str) -> None:
        """Progress line for one network, printed before its work starts."""
        CliStatus.info(f"Importing {hocon_path}...")

    @classmethod
    def report(cls, bulk: BulkImportResult) -> None:
        """
        Print the copied/skipped totals, any warnings and errors, then the MCP deltas.

        Only skips of files that genuinely predate the batch are reported: networks in a
        batch re-offer files a sibling already copied (shared includes, transitively-copied
        sub-networks), and counting those as "already exist" made a fresh `ns init` in an
        empty directory report dozens of skips as if it had found prior state.

        :param bulk: The aggregate outcome of the import batch to render.
        """
        print()
        CliStatus.info("Summary:")
        CliStatus.ok(f"Copied: {bulk.copied} files")
        if bulk.skipped_preexisting:
            CliStatus.skip(f"Skipped: {bulk.skipped_preexisting} files (already exist)")
        cls._print_list("Warnings", bulk.warnings, CliStatus.warn)
        cls._print_list("Errors", bulk.all_errors, CliStatus.err)
        cls._print_mcp(bulk)

    @staticmethod
    def _print_list(label: str, items: List[str], header) -> None:
        """Print at most MAX_LISTED entries under a counted header, or nothing when empty."""
        if not items:
            return
        print()
        header(f"{label} ({len(items)}):")
        for item in items[:MAX_LISTED]:
            print(f"        - {item}")
        if len(items) > MAX_LISTED:
            print(f"        ... and {len(items) - MAX_LISTED} more")

    @staticmethod
    def _print_mcp(bulk: BulkImportResult) -> None:
        """List MCP servers merged into <project>/mcp/mcp_info.hocon, plus any left untouched."""
        if bulk.mcp_added:
            print()
            CliStatus.info(f"MCP servers added to mcp/mcp_info.hocon ({len(bulk.mcp_added)}):")
            for url in bulk.mcp_added:
                print(f"        - {url}")
        if bulk.mcp_skipped:
            print()
            CliStatus.info(f"MCP servers already configured, left untouched ({len(bulk.mcp_skipped)}):")
            for url in bulk.mcp_skipped:
                print(f"        - {url}")

```

### Core Architecture Module: `neuro_san_studio/utils/package_paths.py`
```
# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# END COPYRIGHT

"""Locate the installed neuro-san-studio library on disk."""

import os

import neuro_san_studio


class PackagePaths:  # pylint: disable=too-few-public-methods
    """Resolve filesystem paths owned by the installed neuro-san-studio package."""

    @staticmethod
    def installed_library_root() -> str:
        """Return the directory that contains the library's bundled ``registries/``.

        Anchors on the ``neuro_san_studio`` package — a regular package whose
        ``__file__`` unambiguously points at the install location — rather than the
        ``registries`` namespace package, which gets shadowed by any ``registries/``
        directory on ``sys.path``, including the one ``ns init`` creates in the
        user's project.
        """
        pkg_dir = os.path.dirname(os.path.abspath(neuro_san_studio.__file__))
        install_root = os.path.dirname(pkg_dir)
        if os.path.exists(os.path.join(install_root, "registries", "manifest.hocon")):
            return install_root
        raise FileNotFoundError(
            "Cannot find neuro-san-studio installation. Make sure neuro-san-studio is installed via pip."
        )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1452** (2026-09-24): **#1440: Report malformed agent network config files as parse failures**
  *Symptoms*: ## Summary  Fixes the config-loading bug where malformed HOCON/JSON files were reported as unsupported file types instead of parse failures.  ## Changes - Screen unsupported extensions before calling the restorer. - Keep unsupported file types as the real unsupported case. - Report ValueError parse failures as parse errors. - Add regression tests for malformed HOCON, malformed JSON, unresolved substitutions, unsupported extension, and missing file.  ## Validation - .venv/bin/python -m pytest tests/middleware/agent_network_designer/test_agent_network_definition_middleware.py -q - Result: 18 passed  Fixes #1440

- **Issue #1440** (2026-09-24): **ANDe definition middleware: the ParseException branch in _hocon_to_config is unreachable, so a malformed network file is reported as "Unsupported"**
  *Symptoms*: Noticed while answering the Copilot review of #1434 (part 2 of #1398), which kept pointing at this branch as the model for how parse errors surface. Pre-existing on `main`, not introduced there.  ## The `ParseException` branch in `_hocon_to_config` is dead, and parse failures get the wrong message  `AgentNetworkDefinitionMiddleware._hocon_to_config` (`middleware/agent_network_designer/agent_network_definition_middleware.py:552-596`) reads a network file through `AbstractAsyncConfigRestorer.async_restore` and has four handlers: `FileNotFoundError`, `OSError`, `ValueError` ("Unsupported agent network config file", commented as the wrong-extension case, `:584-589`) and `ParseException` ("Failed to parse agent network config file", `:590-595`, commented as the case where the restorer "wraps HOCON/JSON parse failures ... into ParseException").  That last comment was true when the branch was added (bbe057d5, 2026-05-09, against `neuro-san==0.6.49`). neuro-san b675c7b0 ("Don't hang when loading MCP servers info config fails", first released in 0.6.57) changed the restorer to re-raise those failures as `ValueError` instead, on purpose (`neuro_san/internals/persistence/abstract_async_config_restorer.py:184-209` in 0.7.0: "Re-raise as ValueError, not pyparsing.ParseException"). The studio pin passed 0.6.57 on 2026-06-01 (ee64cf03) and sits at 0.7.0 now, so since then:  - the `except ParseException` branch can never run, because nothing leaving `async_restore` is a `ParseException` any 

- **Issue #1386** (2026-09-03): **FileSystemAgentNetworkPersistor splits AGENT_MANIFEST_FILE on whitespace instead of os.pathsep**
  *Symptoms*: ## Bug  `FileSystemAgentNetworkPersistor` derives its output location from the first entry of `AGENT_MANIFEST_FILE`, but splits the value on whitespace:  https://github.com/cognizant-ai-lab/neuro-san-studio/blob/main/middleware/agent_network_designer/persistence/file_system_agent_network_persistor.py#L50-L58  ```python parts: list[str] = agent_manifest_file.split() ```  `AGENT_MANIFEST_FILE` is a `PATH`-style, `os.pathsep`-separated list. That is how neuro-san's `RegistryManifestRestorer` parses the same env var (`manifest_file.split(pathsep)`):  https://github.com/cognizant-ai-lab/neuro-san/blob/main/neuro_san/internals/graph/persistence/registry_manifest_restorer.py  ## Impact  With a multi-entry value such as `registries/manifest.hocon:/somewhere/else/manifest.hocon`, whitespace-splitting treats the whole value as a single token, so:  - `output_path` becomes a directory name containing a literal `:`, and generated networks are silently saved to that wrong location. - `main_manifest_path` points at a nonexistent file, so the main-manifest include update silently no-ops.  This is also load-bearing for the AND packaging refactor: Phase 2 (#1372) relies on "generated output goes to the first `AGENT_MANIFEST_FILE` entry" working with a multi-entry list.  ## Fix  Split on `os.pathsep`, matching `RegistryManifestRestorer`:  ```python parts: list[str] = agent_manifest_file.split(os.pathsep) ```  Not a hardcoded `":"`: `os.pathsep` is `;` on Windows, and splitting on `:` there woul

- **Issue #1321** (2026-08-12): **expertise_scoping_instructions.hocon not imported during `ns import` causing the server to fail upon startup**
  *Symptoms*: **Describe the bug** When importing the Root agnet network group, `registries/expertise_scoping_instructions.hocon` is not imported, causing the server to fail upon startup.  **To Reproduce** Follow the instructions here (https://github.com/cognizant-ai-lab/neuro-san-studio#install) Everything runs fine up to and including `ns import` I import `Root` to pull in AND. When I start the server via `ns run` , I get these errors:  ``` [2026-08-12 15:44:21 EDT] ERROR    NeuroSan - Parse error in registry item music_nerd.hocon. Skipping. - Cannot                                    resolve variable ${expertise_scoping_instructions} (line: 61, col: 29) [2026-08-12 15:44:21 EDT] ERROR    NeuroSan - manifest registry music_nerd.hocon not found in                                    /Users/970591/Projects/NSAgents/registries/manifest.hocon [2026-08-12 15:44:21 EDT] ERROR    NeuroSan - Parse error in registry item agent_network_query_generator.hocon.                                    Skipping. - Cannot resolve variable ${expertise_scoping_instructions} (line:                                    56, col: 29) [2026-08-12 15:44:21 EDT] ERROR    NeuroSan - manifest registry agent_network_query_generator.hocon not found in                                    /Users/970591/Projects/NSAgents/registries/manifest.hocon [2026-08-12 15:44:21 EDT] ERROR    NeuroSan - Parse error in registry item agent_network_test_generator.hocon.                                    Skipping. - Cannot resolve variable ${
  **Post-Mortem & Fix Analysis**:
  > This PR by @kaushik-cognizant has a fix for the issue: https://github.com/cognizant-ai-lab/neuro-san-studio/pull/1315

- **Issue #1310** (2026-08-07): **AND is sporadically broken**
  *Symptoms*: Error in [datadog](https://app.datadoghq.com/logs?query=service%3Aneuro-san-studio%20error&agg_m=count&agg_m_source=base&agg_t=count&cols=host%2Cservice&event=AwAAAZ_dUfNDzDI-DgAAABhBWl9kVWdidkFBQWI4T0xEeGpPSGFBQUEAAAAkZjE5ZmRkNTItMTUyYS00YzI3LThlMmYtOWU5N2E4ZTBhZDU0AAABYQ&fromUser=true&messageDisplay=inline&refresh_mode=sliding&storage=hot&stream_sort=desc&viz=stream&from_ts=1786123794076&to_ts=1786124694076&live=true):  ``` S3ReservationsReader: S3 error processing reservation object tech_news_aggregation_network-9d972ce2-10fd-432a-8f12-4c683f43ce2e during sync: An error occurred (InvalidToken) when calling the GetObject operation: The provided token is malformed or otherwise invalid. ```  That was a network I created on prod.  When this happens, the network is created, but when you click on it in the Sidebar, it's not found. This means the server sends the frontend a network ID, but when the frontend queries that network ID, it's not found. Nor reported before that network IDs like this aren't actually saved in S3.  Screenshot from Babak, who noticed this today:  <img width="924" height="537" alt="Image" src="https://github.com/user-attachments/assets/2bdb9e07-264d-424a-a10e-cc151634b35b" /> 
  **Post-Mortem & Fix Analysis**:
  > Further information: when this happens, the `function` call succeeds (probably because it's hitting the temp network cache, not using S3?)  ```json curl 'https://neuro-san-prod.decisionai.ml/api/v1/horoscope_agent_network-82abe051-6cf8-4cb1-8283-628262c264e5/function' \ ... {"function": {"description": "Collects birth details and user preferences, asks targeted clarifying questions when needed, and routes the request through a\nsafety/ethics gate before commissioning an astrology-style horoscope reading.", "parameters": {"type": "object", "properties": {"inquiry": {"type": "string", "description": "The inquiry"}, "mode": {"type": "string", "description": "\n'Determine' to ask the agent if the inquiry belongs to it, in its entirety or in part.\n'Fulfill' to ask the agent to fulfill the inquiry, if it can.\n'Follow up' to ask the agent to respond to a follow up.\n                    "}}, "required": ["inquiry", "mode"]}}} ```  but the subsequent `connectivity` call (which _does_ hit S3?)

- **Issue #1257** (2026-07-26): **[Corner case] AND progress throttle can drop the final progress update — UI graph left incomplete**
  *Symptoms*: Summary The 2s progress throttle added in PR #1254 ("Throttle the AND ProgressHandler", merged to main as 3d8d0c67) has no guaranteed final flush. Because ProgressHandler.should_report() only allows a report when ≥2s have elapsed since the last one and silently drops (never resends) any report inside that window, the last progress update of a build can be dropped whenever the final edit happens <2s after the previous sent update. When that happens, the client/UI never receives the completed graph, and its live view is left showing a stale, one-or-two-edits-short state.  The agent network the server returns is still correct and complete — only the streamed progress view is stale.  example: So whether any given update — including the final one — is sent depends purely on timing: was it ≥2s since the last one was sent?  If the build's last edit happens <2s after the previous send, should_report() returns False, and that final update is dropped — the client never sees the completed graph. last_progress = now

- **Issue #1256** (2026-08-10): **Stage runs music_nerd_pro agent twice per request (Langfuse shows tools 2×); Solo runs once**
  *Symptoms*: **Note:** The tool info is exactly the same at the top and bottom.  On Stage, a single basic/music_nerd_pro request executes the entire agent graph twice end-to-end. Langfuse/APM shows two full NeuroSanRunnable → …:MusicNerdPro (agent) → RunContextRunnable → LangGraph → model → tools subtrees under one trace, and the LangGraph view reports model (4/4) and tools (2/2). On Solo, the same request runs once — a single subtree with model (2/2) and tools called once, as expected.  This is a duplicate full-agent invocation on Stage only: roughly 2× the model calls, 2× tool calls, and 2× the LLM cost/latency per request.  <img width="1611" height="1282" alt="Image" src="https://github.com/user-attachments/assets/e8aef781-e9c6-4258-9b7f-25216061b72a" />  Langfuse link: https://langfuse.evolution.ml/project/cmox9vndk000ddy073waodrcd/traces
  **Post-Mortem & Fix Analysis**:
  > This can happen at a high-level retry level. The question is one of frequency: Did this happen once? A couple of times?  Almost all the time?  Absolutely all the time?

- **Issue #1202** (2026-07-02): **Agent Network Designer fails to produce reservation_id under high concurrency with Lite LLM (1/500 requests)**
  *Symptoms*: 1 out of 500 requests (request_111) completed without producing a reservation_id. The agent successfully designed the network and returned without the agent_reservations block.  See the copy and paste below. 
  **Post-Mortem & Fix Analysis**:
  > ``## Sample queries (3–4) 1) “A new member joined today—set up onboarding, app access, and book their first class this week.” 2) “We need to cancel tomorrow’s 6pm HIIT due to instructor illness—find coverage or notify members and update all calendars.” 3) “A member says they were double-charged last month and wants a refund—investigate, confirm policy eligibility, and respond with next steps.” 4) “Create a 4-week lead-gen campaign for summer with a trial offer; include tracking plan, follow-up SLA, and weekly KPI report format.”  If you want, I can modify this network for your exact setup (single-site vs multi-site, specific billing/class software, approval limits, and policies). Returned sly_data is: {     "agent_network_definition": {         "/generated/fitness_gym_ops": {             "description": "Central orchestrator that triages gym requests, delegates work to the appropriate specialist agents, coordinates multi-step workflows,\nand returns a single consolidated action plan wit
  > [request_111_stdout.txt.zip](https://github.com/user-attachments/files/29577195/request_111_stdout.txt.zip)
  > Root cause spans two repos.  **Studio side (this issue):** the designer's node-creating tools (`create_network`, `add_agent`) let the model create a node keyed like an external agent/subnetwork (e.g. `/generated/fitness_gym_ops`) with `instructions`/`description`/`tools`, and `update_agent` could attach tools to such a node from a malformed input network. Added an `AgentNameGuard` shared helper and wired it into all three tools (guarding node **keys** only — `/`-refs remain valid inside a `tools` list). `create_network` now collects all bad names and no longer wipes the existing network on an invalid input.  **Framework side (neuro-san):** the real gap is that `StructureNetworkValidator` — which the designer's structure-validation middleware runs — does no node-name validation, so external/URL/invalid node keys slip through. The validator that would catch it (`ToolNameNetworkValidator`) isn't in that composite, and additionally crashes on the designer's `name → spec` format. Filed a co

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

### Incident Patch 1: `bf1fb563` (2026-10-01)
**Commit Message**: Merge pull request #1478 from cognizant-ai-lab/devin/1790863433-bump-build-common

Bump build-common to 1.0.13

**File**: `.github/workflows/agent_network_designer.yml` (modified, +2/-2)
```diff
@@ -12,8 +12,8 @@ jobs:
   agent-network-designer-test:
     # don't run this job in sync'd clones
     if: github.repository == 'cognizant-ai-lab/neuro-san-studio'
-    # cognizant-ai-lab/build-common 1.0.12
-    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+    # cognizant-ai-lab/build-common 1.0.13
+    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
     with:
       python-version: '3.12'
       # Required by build_scripts/server_start.sh:
```

**File**: `.github/workflows/checkmarx.yml` (modified, +4/-4)
```diff
@@ -12,11 +12,11 @@ on:
 
 jobs:
     checkmarx:
-        # 1.0.12
-        uses: cognizant-ai-lab/build-common/.github/workflows/_checkmarx.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+        # 1.0.13
+        uses: cognizant-ai-lab/build-common/.github/workflows/_checkmarx.yml@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
         with:
-            # 1.0.12
-            build-common-ref: "3f4cdab31b6ac10382c99452b720eb0b8b2dab8f"
+            # 1.0.13
+            build-common-ref: "e11ab4d3725a79bd8b28c3f7fb0785615290cf24"
             base-uri: ${{ vars.CX_BASE_URI }}
             cx-tenant: ${{ vars.CX_TENANT }}
             cx-client-id: ${{ vars.CX_CLIENT_ID }}
```

**File**: `.github/workflows/integration.yml` (modified, +2/-2)
```diff
@@ -10,8 +10,8 @@ permissions:
 
 jobs:
   test:
-    # cognizant-ai-lab/build-common 1.0.12
-    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+    # cognizant-ai-lab/build-common 1.0.13
+    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
     with:
       python-version: '3.12'
       # No lint steps in the original workflow
```

**File**: `.github/workflows/packaging_smoke.yml` (modified, +2/-2)
```diff
@@ -13,8 +13,8 @@ jobs:
   packaged-install-smoke-test:
     # don't run this job in sync'd clones
     if: github.repository == 'cognizant-ai-lab/neuro-san-studio'
-    # cognizant-ai-lab/build-common 1.0.12
-    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+    # cognizant-ai-lab/build-common 1.0.13
+    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
     with:
       python-version: '3.12'
       # Every version the package claims support for: what the wheel ships, and whether its
```

**File**: `.github/workflows/publish.yml` (modified, +4/-4)
```diff
@@ -24,8 +24,8 @@ jobs:
         uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
 
       - name: Setup Python environment
-        # 1.0.12
-        uses: cognizant-ai-lab/build-common/actions/setup-python-env@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+        # 1.0.13
+        uses: cognizant-ai-lab/build-common/actions/setup-python-env@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
         with:
           python-version: '3.12'
           requirements-file: ''
@@ -41,8 +41,8 @@ jobs:
 
       - name: Notify Slack
         if: ${{ !cancelled() }}
-        # 1.0.12
-        uses: cognizant-ai-lab/build-common/actions/slack-notify@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+        # 1.0.13
+        uses: cognizant-ai-lab/build-common/actions/slack-notify@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
         with:
           status: ${{ job.status }}
           webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**File**: `.github/workflows/tests.yml` (modified, +2/-2)
```diff
@@ -17,8 +17,8 @@ jobs:
       (github.event_name == 'push' && github.ref != 'refs/heads/main') ||
       (github.event_name == 'pull_request' &&
         github.event.pull_request.head.repo.full_name != github.repository)
-    # 1.0.12
-    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+    # 1.0.13
+    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
     with:
       python-version: '3.12'
       test-python-versions: '["3.12", "3.13", "3.14"]'
```

---

### Incident Patch 2: `8876d7ab` (2026-10-01)
**Commit Message**: Bump build-common to 1.0.13

Co-Authored-By: donn.goodhew <[REDACTED_EMAIL]>

**File**: `.github/workflows/agent_network_designer.yml` (modified, +2/-2)
```diff
@@ -12,8 +12,8 @@ jobs:
   agent-network-designer-test:
     # don't run this job in sync'd clones
     if: github.repository == 'cognizant-ai-lab/neuro-san-studio'
-    # cognizant-ai-lab/build-common 1.0.12
-    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+    # cognizant-ai-lab/build-common 1.0.13
+    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
     with:
       python-version: '3.12'
       # Required by build_scripts/server_start.sh:
```

**File**: `.github/workflows/checkmarx.yml` (modified, +4/-4)
```diff
@@ -12,11 +12,11 @@ on:
 
 jobs:
     checkmarx:
-        # 1.0.12
-        uses: cognizant-ai-lab/build-common/.github/workflows/_checkmarx.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+        # 1.0.13
+        uses: cognizant-ai-lab/build-common/.github/workflows/_checkmarx.yml@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
         with:
-            # 1.0.12
-            build-common-ref: "3f4cdab31b6ac10382c99452b720eb0b8b2dab8f"
+            # 1.0.13
+            build-common-ref: "e11ab4d3725a79bd8b28c3f7fb0785615290cf24"
             base-uri: ${{ vars.CX_BASE_URI }}
             cx-tenant: ${{ vars.CX_TENANT }}
             cx-client-id: ${{ vars.CX_CLIENT_ID }}
```

**File**: `.github/workflows/integration.yml` (modified, +2/-2)
```diff
@@ -10,8 +10,8 @@ permissions:
 
 jobs:
   test:
-    # cognizant-ai-lab/build-common 1.0.12
-    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+    # cognizant-ai-lab/build-common 1.0.13
+    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
     with:
       python-version: '3.12'
       # No lint steps in the original workflow
```

**File**: `.github/workflows/packaging_smoke.yml` (modified, +2/-2)
```diff
@@ -13,8 +13,8 @@ jobs:
   packaged-install-smoke-test:
     # don't run this job in sync'd clones
     if: github.repository == 'cognizant-ai-lab/neuro-san-studio'
-    # cognizant-ai-lab/build-common 1.0.12
-    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+    # cognizant-ai-lab/build-common 1.0.13
+    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
     with:
       python-version: '3.12'
       # Every version the package claims support for: what the wheel ships, and whether its
```

**File**: `.github/workflows/publish.yml` (modified, +4/-4)
```diff
@@ -24,8 +24,8 @@ jobs:
         uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
 
       - name: Setup Python environment
-        # 1.0.12
-        uses: cognizant-ai-lab/build-common/actions/setup-python-env@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+        # 1.0.13
+        uses: cognizant-ai-lab/build-common/actions/setup-python-env@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
         with:
           python-version: '3.12'
           requirements-file: ''
@@ -41,8 +41,8 @@ jobs:
 
       - name: Notify Slack
         if: ${{ !cancelled() }}
-        # 1.0.12
-        uses: cognizant-ai-lab/build-common/actions/slack-notify@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+        # 1.0.13
+        uses: cognizant-ai-lab/build-common/actions/slack-notify@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
         with:
           status: ${{ job.status }}
           webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**File**: `.github/workflows/tests.yml` (modified, +2/-2)
```diff
@@ -17,8 +17,8 @@ jobs:
       (github.event_name == 'push' && github.ref != 'refs/heads/main') ||
       (github.event_name == 'pull_request' &&
         github.event.pull_request.head.repo.full_name != github.repository)
-    # 1.0.12
-    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+    # 1.0.13
+    uses: cognizant-ai-lab/build-common/.github/workflows/_python-quality-gate.yml@e11ab4d3725a79bd8b28c3f7fb0785615290cf24
     with:
       python-version: '3.12'
       test-python-versions: '["3.12", "3.13", "3.14"]'
```

---

### Incident Patch 3: `c3f86863` (2026-09-30)
**Commit Message**: Merge pull request #1467 from cognizant-ai-lab/fix/1458-unwrap-designer-instructions

#1458: ANDe strip common instructions from agent_network_definition instructions

**File**: `docs/examples/agent_network_designer.md` (modified, +10/-0)
```diff
@@ -340,6 +340,16 @@ any `agent_network_metadata` sent with the same request
 - A load that yields no agent (a `tools` list that is missing, not a list, empty, or whose every entry is skipped)
 ends the turn with an error message, as a missing or unparseable file does. `agent_network_name` is set from the
 file name or the reservation id only once the load has produced a definition
+- Each agent's `instructions` in the `agent_network_definition` hold only its custom instructions, the agent's own
+text, since every save adds the common instructions again: the instructions prefix, the front man's fixed lines, the
+demo mode sentence and the AAOSA instructions. Copies of the common instructions already in the instructions, such
+as the resolved text of a saved network sent back by a client, are removed before the definition is validated, shown
+to the LLM or saved, so a save writes one copy instead of adding another. Every piece is removed from every agent,
+whatever its role and whatever `AGENT_NETWORK_DESIGNER_DEMO_MODE` is set to, and the save adds back the ones the
+agent's role calls for. So a hand-written network that gives its leaves the AAOSA instructions loses them from those
+leaves once loaded. An agent whose instructions are nothing but common instructions keeps one copy of each piece.
+Only the current wording of each piece is recognized: after a wording changes, a copy of the old wording that a
+client sends back stays in the agent's own text, once, and does not grow
 
 #### Persistence (Middleware)
 
```

**File**: `middleware/agent_network_designer/agent_network_definition_middleware.py` (modified, +119/-2)
```diff
@@ -51,6 +51,7 @@
 from coded_tools.agent_network_editor.progress_handler import ProgressHandler
 from coded_tools.agent_network_editor.sly_data_lock import SlyDataLock
 from middleware.agent_network_designer.persistence.agent_network_metadata_block import AgentNetworkMetadataBlock
+from middleware.agent_network_designer.persistence.common_instruction_stripper import CommonInstructionStripper
 from middleware.agent_network_designer.persistence.file_system_agent_network_persistor import DEFAULT_REGISTRIES_DIR
 from middleware.agent_network_designer.persistence.file_system_agent_network_persistor import (
     FileSystemAgentNetworkPersistor,
@@ -61,6 +62,8 @@
 AGENT_RESERVATIONS: str = "agent_reservations"
 RESERVATION_ID: str = "reservation_id"
 SKIP_DESIGNER: str = "skip_designer"
+# The file every generated network includes for its AAOSA instructions, relative to the working directory.
+AAOSA_FILE: str = "registries/aaosa.hocon"
 
 
 class AgentNetworkDefinitionMiddleware(AgentMiddleware):
@@ -76,8 +79,15 @@ class AgentNetworkDefinitionMiddleware(AgentMiddleware):
     ProgressHandler's throttle suppressed during the run (see flush_pending()).
     A network that wires the editor tools without registering this middleware
     silently loses that end-of-run flush.
+
+    Before anything reads the definition, it also strips the copies of the designer's common
+    instructions that the instructions already hold (see _strip_common_instructions).
     """
 
+    # The AAOSA instructions _strip_common_instructions strips, read once per process by
+    # _read_aaosa_instructions; None until then.
+    _aaosa_instructions: str | None = None
+
     def __init__(self, sly_data: dict[str, Any], progress_reporter: AgentProgressReporter | None = None) -> None:
         """
         Initialize agent network definition middleware.
@@ -115,8 +125,12 @@ async def abefore_model(self, state: AgentState[Any], runtime: Any) -> dict[str,
         If loading from a HOCON file or S3 reservation fails, or if the agent network name is
         missing or invalid, reports the error back to the client and jumps to end.
 
-        If skip_designer is set, normalizes the definition and jumps to end immediately so the
-        persistence middleware can save the user-modified network without LLM involvement.
+        Whatever its source, the definition is normalized to dict format and cleared of the copies of the
+        designer's common instructions its instructions already hold (see _strip_common_instructions), so the
+        persistence middleware and the LLM both get each agent's custom instructions.
+
+        If skip_designer is set, jumps to end right after that, so the persistence middleware can save the
+        user-modified network without LLM involvement.
 
         Note that this is done before model, not before agent, because the definition may change
         between each model call (e.g., when the agent calls a tool that updates the network definition).
@@ -167,6 +181,9 @@ async def abefore_model(self, state: AgentState[Any], runtime: Any) -> dict[str,
         # middleware as a list and crash validators that expect a dict (e.g. network_def.items()).
         if self.network_def:
             self.network_def = self._normalize_network_def(self.network_def)
+            # Before the skip_designer hand-off below, so the persistence middleware validates and saves the
+            # stripped definition, and before awrap_model_call, so the LLM sees it too.
+            self.network_def = await self._strip_common_instructions(self.network_def)
 
             # This is used for manual editing where users modify the agent network definition and only want to use the
             # agent network designer to persist the changes, skipping the LLM entirely.
@@ -422,6 +439,106 @@ def _normalize_network_def(self, network_def: dict[str, Any] | list[dict[str, An
         self.sly_data[AGENT_NETWORK_DEFINITION] = network_def
         return network_def
 
+    async def _strip_common_instructions(self, network_def: dict[str, Any]) -> dict[str, Any]:
+        """
+        Strip the copies of the designer's common instructions that the definition's instructions already hold.
+
+        The instructions in agent_network_definition are each agent's custom instructions, and every save adds
+        the common instructions again. A client that read a saved network with its HOCON substitutions resolved
+        sends them back inlined, and each save used to add one more copy. Every piece is stripped
+        from every agent, whatever its role and whether demo mode is on; see CommonInstructionStripper for the
+        rules.
+
+        Runs on every model call and for every source of the definition (sly_data, a HOCON file or an S3
+        reservation), so the validators, the LLM, both assemblers and the definition returned to the client all
+        see the same text. Stripping is idempotent, so a definition that is already clean comes thro
```

**File**: `middleware/agent_network_designer/persistence/common_instruction_stripper.py` (added, +376/-0)
```diff
@@ -0,0 +1,376 @@
+# Copyright © 2026 Cognizant Technology Solutions Corp, www.cognizant.com.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+#
+# END COPYRIGHT
+"""
+Removal of copies of the designer's common instructions from the instructions in an agent network definition.
+"""
+
+import re
+from typing import Any
+
+from middleware.agent_network_designer.persistence.designer_common_instructions import DesignerCommonInstructions
+
+
+class CommonInstructionStripper:
+    """
+    Strips copies of the designer's common instructions from agent instructions, so that a save adds exactly one.
+
+    The instructions in agent_network_definition are meant to hold only each agent's custom instructions, its own
+    text: every save adds the common instructions again, which are the prefix, the front man's lines, the demo
+    sentence and the AAOSA instructions (see DesignerCommonInstructions). A client that reads a saved network with
+    its HOCON substitutions resolved gets them inlined in every agent's instructions. Sending that text back as
+    the definition used to add one more copy of each piece per save.
+
+    All four pieces are stripped from every agent, whatever its role and whether demo mode is on. The definition
+    never needs them, since each save adds back the ones the agent's role calls for. Stripping only those would
+    leave a piece behind as own text whenever an agent's role or the demo setting changed between saves: a leaf
+    that gained tools would keep the demo sentence, an agent that lost its tools the AAOSA instructions, and a
+    network saved in demo mode would keep its demo sentences once demo mode was turned off. Hand-written networks
+    that give leaves the AAOSA instructions on purpose (registries/basic/smart_home.hocon, for one) lose them there
+    once loaded into the designer, and after a save their leaves work like the ones the designer writes.
+
+    Each piece is matched in one wording only: the one the save writes today, read from DesignerCommonInstructions
+    and registries/aaosa.hocon exactly as the save reads them, so a change there changes what is stripped at the
+    same time. Old wordings are not kept. A copy in a wording no save writes any more (the prefix of networks
+    generated before October 2025, or the AAOSA text as it was before an edit of aaosa.hocon) is not recognized and
+    stays in the agent's custom instructions, once. It cannot multiply: only what a save adds can come back again,
+    and that is the current wording, which is what gets stripped. Hand-written prefixes that resemble a piece stay
+    for the same reason ("You are part of a smart home network of assistants." in registries/basic/smart_home.hocon).
+
+    How copies are matched:
+
+    - Word by word, so copies that differ only in whitespace (indentation, line breaks) match; the text that
+      remains keeps its own whitespace exactly as written.
+    - Whole copies only, anchored at the start for the prefix, the front man's lines and the demo sentence, and
+      at the end for the AAOSA instructions. A text that ends with the prefix's rules
+      (registries/basic/wolfram_mcp.hocon) or quotes one of their sentences in the middle is left alone.
+    - Every copy, however many there are and in whatever order: after several saves the leading pieces
+      interleave (prefix, front man's lines, prefix, front man's lines, ...).
+    - The prefix under any network name of up to MAX_NAME_WORDS words, followed by the period a save writes
+      after it, since a copy carries the name the network was saved under, which can differ from the name of
+      this save.
+    - Only the words at the two ends of the text are ever read, and only the end is copied, to be read backwards
+      (see _trailing_copy), so the cost grows with the copies stripped, not with the length of the text. The words
+      are compared one by one rather than with a regular expression: a pattern anchored at the end of the text is
+      quadratic when many copies of the AAOSA instructions come before other text, and this runs on the event loop
+      before every model call.
+
+    A text holding none of the common instructions is returned unchanged, byte for byte. A text holding nothing
+    but copies of them keeps one copy of each piece found instead of becoming empty: an empty text fails the designer's
+    validation (turning a plain save into an LLM run), and an empty leaf would be written as a toolbo
```

**File**: `middleware/agent_network_designer/persistence/designer_common_instructions.py` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+# Copyright © 2026 Cognizant Technology Solutions Corp, www.cognizant.com.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+#
+# END COPYRIGHT
+"""
+The common instructions: the fixed texts the agent network designer adds to every agent's custom instructions on
+save.
+"""
+
+
+class DesignerCommonInstructions:  # pylint: disable=too-few-public-methods
+    """
+    The wording of the common instructions the designer adds to each agent's custom instructions on save.
+
+    An agent's "instructions" in agent_network_definition hold only its custom instructions, the agent's own
+    text. Every save adds the common instructions back, and which pieces an agent gets depends on its role:
+
+    - the prefix, for every LLM agent;
+    - the front man's three fixed lines, for the top agent;
+    - the demo sentence, for leaf agents when demo mode is on;
+    - the AAOSA instructions, for the top agent and agents with tools. Their text lives in
+      registries/aaosa.hocon, the file every generated network includes, so it is not repeated here.
+
+    HoconAgentNetworkAssembler builds its header and top-agent template from these constants, and
+    CommonInstructionStripper matches copies by the same constants, so a change here changes what is written and
+    what is stripped at once. deployable_template.hocon and deployable_template_demo.hocon are HOCON and cannot
+    import them; a test pins their copies to these values.
+
+    Changing a wording is a deliberate step, and a test pins each wording so that it is made knowingly. The
+    stripper keeps no old wordings: a network saved under the old wording and sent back with its substitutions
+    resolved keeps one copy of the old text in the agent's custom instructions, and that copy does not grow (see
+    CommonInstructionStripper).
+
+    Data only: the rules for stripping the texts belong to CommonInstructionStripper.
+    """
+
+    # The words the prefix opens with. The network name and a period follow them, then PREFIX_RULES, so the file
+    # for a network called coffee_shop starts every agent with
+    # "You are part of a team of assistants in coffee_shop." and the rules.
+    PREFIX_OPENING: str = "You are part of a team of assistants in"
+
+    # The three lines after the prefix's opening sentence.
+    PREFIX_RULES: str = (
+        "Only answer inquiries that are directly within your area of expertise.\n"
+        "Do not try to help for other matters.\n"
+        "Do not mention what you can NOT do. Only mention what you can do."
+    )
+
+    # The lines the top-agent template writes inside the front man's own triple-quoted body, ahead of its text.
+    FRONT_MAN_LINES: str = (
+        "Never express irrelevance unless you have first consulted all your tools.\n"
+        "Once you have determined the relevant tools, do not express that to the user, rather,\n"
+        "call all the relevant tools and make sure the command is fully serviced and express the end result."
+    )
+
+    # The value of the "demo_mode" key a generated network defines when demo mode is on, which the leaf template
+    # puts between the prefix and the leaf's own text. It holds no double quote or backslash, so the header can
+    # write it as a double-quoted HOCON string as is.
+    DEMO_SENTENCE: str = (
+        "You are part of a demo system, so when queried, make up a realistic response as if you are actually "
+        "grounded in real data or you are operating a real application API or microservice."
+    )
```

**File**: `middleware/agent_network_designer/persistence/hocon_agent_network_assembler.py` (modified, +12/-14)
```diff
@@ -25,7 +25,10 @@
 )
 from middleware.agent_network_designer.persistence.agent_network_assembler import AgentNetworkAssembler
 from middleware.agent_network_designer.persistence.agent_network_metadata_block import AgentNetworkMetadataBlock
+from middleware.agent_network_designer.persistence.designer_common_instructions import DesignerCommonInstructions
 
+# The common instructions in the header and templates below come from DesignerCommonInstructions, which
+# CommonInstructionStripper reads as well to strip copies of them from a definition.
 HOCON_HEADER_START = (
     "{\n"
     "# Importing content from other HOCON files\n"
@@ -52,18 +55,17 @@
     "\n"
     f'    "max_execution_seconds": {GENERATED_NETWORK_MAX_EXECUTION_SECONDS},\n'
     "\n"
-    '   "instructions_prefix": """\n'
-    "You are part of a team of assistants in "
+    '   "instructions_prefix": """\n' + DesignerCommonInstructions.PREFIX_OPENING + " "
 )
 HOCON_HEADER_REMAINDER = (
-    ".\n"
-    "Only answer inquiries that are directly within your area of expertise.\n"
-    "Do not try to help for other matters.\n"
-    "Do not mention what you can NOT do. Only mention what you can do.\n"
+    ".\n" + DesignerCommonInstructions.PREFIX_RULES + "\n"
     '""",\n'
+    # The slot for the "demo_mode" entry, empty when demo mode is off (see _build_header).
     "%s"
     '   "tools": [\n'
 )
+# The top-agent template indents the front man's lines by this much inside the triple-quoted body.
+FRONT_MAN_LINES_INDENT: str = " " * 12
 TOP_AGENT_TEMPLATE = (
     "        {\n"
     '            "name": "%s",\n'
@@ -76,9 +78,9 @@
     '                """%s\n'
     "            },\n"
     '            "instructions": ${instructions_prefix} """\n'
-    "            Never express irrelevance unless you have first consulted all your tools.\n"
-    "            Once you have determined the relevant tools, do not express that to the user, rather,\n"
-    "            call all the relevant tools and make sure the command is fully serviced and express the end result.\n"
+    + FRONT_MAN_LINES_INDENT
+    + DesignerCommonInstructions.FRONT_MAN_LINES.replace("\n", "\n" + FRONT_MAN_LINES_INDENT)
+    + "\n"
     "%s\n"
     '""" ${aaosa_instructions},\n'
     '            "tools": [%s]\n'
@@ -220,11 +222,7 @@ def _build_header(self, agent_network_name: str, metadata: dict[str, Any]) -> st
         # (see _render_json_block for what pyhocon still cannot read back).
         metadata_block: str = self._render_json_block(metadata, " " * 4)
         demo_mode_block: str = (
-            '   "demo_mode": "You are part of a demo system, so when queried, make up a realistic '
-            "response as if you are actually grounded in real data or you are operating a real "
-            'application API or microservice.",\n'
-            if self.demo_mode
-            else ""
+            f'   "demo_mode": "{DesignerCommonInstructions.DEMO_SENTENCE}",\n' if self.demo_mode else ""
         )
 
         return HOCON_HEADER_START % metadata_block + agent_network_name + HOCON_HEADER_REMAINDER % demo_mode_block
```

**File**: `registries/agent_network_designer.hocon` (modified, +12/-2)
```diff
@@ -111,7 +111,13 @@
                     "properties": {
                         "agent_network_definition": {
                             "type": "object",
-                            "description": "An internal representation of the agent network used for further iteration."
+                            "description": """
+An internal representation of the agent network used for further iteration.
+Each agent's instructions are meant to hold only its custom instructions, the agent's own text: every save adds the
+common instructions the agent's role calls for again (the instructions prefix, the front man's fixed lines, the demo
+mode sentence and the AAOSA instructions). Copies of any of those at the start or end of any agent's instructions,
+such as the resolved text of a saved network, are removed before the definition is used.
+"""
                         },
                         "agent_network_hocon_file": {
                             "type": "string",
@@ -200,7 +206,11 @@ Send agent_network_metadata back with it so the saved network keeps its metadata
                     "properties": {
                         "agent_network_definition": {
                             "type": "object",
-                            "description": "An internal representation of the agent network used for further iteration."
+                            "description": """
+An internal representation of the agent network used for further iteration.
+Send it back as it is: each agent's instructions are its custom instructions, and the next save adds the common
+instructions again.
+"""
                         },
                         "agent_network_hocon_text": {
                             "type": "string",
```

**File**: `tests/middleware/agent_network_designer/persistence/test_agent_network_persistence_middleware.py` (modified, +76/-2)
```diff
@@ -18,10 +18,15 @@
 Tests for AgentNetworkPersistenceMiddleware.aafter_agent: validation gating and the stateless
 handling of the persisted metadata block (issue #1398) in both file mode and reservations mode,
 including the compatibility fallback that reads the block of the network about to be overwritten
-when the client sent no agent_network_metadata key at all, and the surfacing of a failed
-temporary-network deployment (issue #1425).
+when the client sent no agent_network_metadata key at all, the surfacing of a failed
+temporary-network deployment (issue #1425), and the single copy of the common instructions a
+skip_designer save writes for resolved instructions sent back.
 """
 
+# This is the one-class test module for AgentNetworkPersistenceMiddleware (one file per class,
+# per the repo convention), so it legitimately exceeds pylint's default line limit.
+# pylint: disable=too-many-lines
+
 import json
 import os
 import shutil
@@ -48,11 +53,13 @@
 from coded_tools.agent_network_editor.get_toolbox import GetToolbox
 from coded_tools.agent_network_editor.globals import ProcessGlobals
 from coded_tools.agent_network_editor.mcp_servers_load import McpServersLoad
+from middleware.agent_network_designer.agent_network_definition_middleware import AgentNetworkDefinitionMiddleware
 from middleware.agent_network_designer.persistence import agent_network_persistence_middleware as persistence_module
 from middleware.agent_network_designer.persistence.agent_network_persistence_middleware import (
     AgentNetworkPersistenceMiddleware,
 )
 from middleware.agent_network_designer.persistence.agent_network_persistor import AgentNetworkPersistor
+from middleware.agent_network_designer.persistence.designer_common_instructions import DesignerCommonInstructions
 from middleware.agent_network_designer.persistence.file_system_agent_network_persistor import (
     FileSystemAgentNetworkPersistor,
 )
@@ -101,6 +108,9 @@
 ]
 # What the fake Reservation reports, echoed by the persistor into sly_data["agent_reservations"].
 RESERVATION_ID: str = "probe_net-0123abcd"
+# Words that occur once in registries/aaosa.hocon and once in the front man's lines, for counting copies.
+AAOSA_MARKER: str = "When you receive an inquiry, you will:"
+FRONT_MAN_MARKER: str = "Never express irrelevance"
 LIFETIME_SECONDS: float = 3600.0
 EXPIRATION_SECONDS: float = 1_800_000_000.0
 
@@ -360,6 +370,36 @@ async def _save_from_repo_root(sly_data: dict[str, Any]) -> dict[str, Any] | Non
         finally:
             os.chdir(cwd)
 
+    @staticmethod
+    async def _strip_from_repo_root(sly_data: dict[str, Any]) -> dict[str, Any] | None:
+        """
+        Run AgentNetworkDefinitionMiddleware.abefore_model over the given sly_data with the repo root as CWD.
+
+        The hook reads registries/aaosa.hocon relative to the CWD for the AAOSA instructions it strips, as the
+        server does from the project root.
+
+        :param sly_data: The request's sly_data, mutated in place by the hook
+        :return: What abefore_model returned: a jump to end for a skip_designer request
+        """
+        cwd: str = os.getcwd()
+        os.chdir(REPO_ROOT)
+        try:
+            return await AgentNetworkDefinitionMiddleware(sly_data).abefore_model({}, None)
+        finally:
+            os.chdir(cwd)
+
+    def _read_resolved_definition(self) -> dict[str, Any]:
+        """
+        Read the persisted HOCON back as nsflow's editor does, with its substitutions resolved.
+
+        :return: _network_def() with each agent's instructions replaced by the resolved text the file gives it
+        """
+        text: str = self._generated_path().read_text(encoding="utf-8")
+        definition: dict[str, Any] = self._network_def()
+        for agent in ConfigFactory.parse_string(text, basedir=str(REPO_ROOT)).get("tools"):
+            definition.get(agent.get("name"))["instructions"] = agent.get("instructions")
+        return definition
+
     def _spy_on_restore(self, persistor_class: type[AgentNetworkPersistor]) -> Any:
         """
         Wrap persistor_class.async_restore_metadata for the rest of the test so it still runs its
@@ -995,3 +1035,37 @@ def test_utc_now_iso_is_a_timezone_aware_utc_stamp(self) -> None:
         self.assertTrue(first.endswith("+00:00"))
         # isoformat() keeps a fixed field order and zero-pads every field, so string order is time order.
         self.assertLessEqual(first, second)
+
+    # ------------------------------------------------------------------ common instructions
+
+    async def test_skip_designer_saves_of_resolved_text_keep_one_copy_of_the_common_instructions(self) -> None:
+        """
+        A client that reads every save back with its substitutions resolved and sends the instructions straight
+        back with skip_designer gets a file with one copy of the common instructions each time, and the agents'
+        custom instructions back:
+        AgentNetworkDefinitionMiddleware strips the copies 
```

**File**: `tests/middleware/agent_network_designer/persistence/test_common_instruction_stripper.py` (added, +493/-0)
```diff
@@ -0,0 +1,493 @@
+# Copyright © 2026 Cognizant Technology Solutions Corp, www.cognizant.com.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+#
+# END COPYRIGHT
+
+"""Tests for CommonInstructionStripper: one copy of the common instructions per save, own text kept as written."""
+
+import time
+import tracemalloc
+from copy import deepcopy
+from pathlib import Path
+from typing import Any
+from unittest import IsolatedAsyncioTestCase
+
+from pyhocon import ConfigFactory
+from pyhocon import ConfigTree
+
+from middleware.agent_network_designer.persistence.common_instruction_stripper import CommonInstructionStripper
+from middleware.agent_network_designer.persistence.deployable_agent_network_assembler import (
+    DeployableAgentNetworkAssembler,
+)
+from middleware.agent_network_designer.persistence.designer_common_instructions import DesignerCommonInstructions
+from middleware.agent_network_designer.persistence.hocon_agent_network_assembler import HoconAgentNetworkAssembler
+
+REPO_ROOT: Path = Path(__file__).resolve().parents[4]
+
+# A definition holding only the agents' own text, as the designer's contract has it: a front man, an agent with
+# tools whose text spans indented lines, a leaf with a blank line in its text and a toolbox reference.
+DEFINITION: dict[str, Any] = {
+    "front": {"instructions": "Route travel requests.", "tools": ["booker", "weather", "search"]},
+    "booker": {"instructions": "Book trips.\n  - flights\n    - direct only\n  - hotels", "tools": ["weather"]},
+    "weather": {"instructions": "Report the weather.\n\nUse Celsius."},
+    "search": {},
+}
+NETWORK_NAME: str = "travel"
+
+# Words that occur once in each piece of the common instructions and nowhere in DEFINITION, for counting copies.
+PREFIX_MARKER: str = DesignerCommonInstructions.PREFIX_OPENING
+FRONT_MAN_MARKER: str = "Never express irrelevance"
+DEMO_MARKER: str = "You are part of a demo system"
+AAOSA_MARKER: str = "When you receive an inquiry, you will:"
+
+
+class TestCommonInstructionStripper(IsolatedAsyncioTestCase):
+    """
+    Tests for CommonInstructionStripper.
+
+    The round-trip tests save a definition with the real assemblers, read the result back the way a client does
+    (the HOCON file parsed with its substitutions resolved, or the reservations spec as deployed) and feed the
+    instructions back through the stripper, which must return the own text the save started from. The other
+    tests cover pieces left from a role the agent no longer has, text that must be left alone, text made only of
+    common instructions and the running time.
+    """
+
+    async def asyncSetUp(self) -> None:
+        """
+        Read the AAOSA instructions every generated network includes.
+        """
+        aaosa_config: ConfigTree = ConfigFactory.parse_file(str(REPO_ROOT / "registries" / "aaosa.hocon"))
+        self.aaosa: str = aaosa_config.get("aaosa_instructions")
+
+    async def test_hocon_round_trip_returns_the_own_text(self) -> None:
+        """
+        A definition saved as a HOCON file and read back resolved comes back as the own text, demo mode on or off.
+        """
+        for demo_mode in (True, False):
+            with self.subTest(demo_mode=demo_mode):
+                resolved: dict[str, Any] = await self._hocon_round_trip(DEFINITION, NETWORK_NAME, demo_mode)
+                self.assertEqual(resolved.get("front").get("instructions").count(AAOSA_MARKER), 1)
+
+                stripped: dict[str, Any]
+                stripped, _ = self._stripper().strip_definition(resolved)
+
+                self.assertEqual(stripped, DEFINITION)
+
+    async def test_reservations_round_trip_returns_the_own_text(self) -> None:
+        """
+        A definition deployed as a reservations spec in demo mode comes back as the own text. Demo mode off is not
+        covered: there the leaf template's "{demo_mode}" placeholder stays in the deployed text as written, because
+        neuro-san's StringCommonDefsConfigFilter skips an empty replacement string.
+        """
+        deployed: dict[str, Any] = await self._reservations_round_trip(DEFINITION, NETWORK_NAME, True)
+        self.assertEqual(deployed.get("front").get("instructions").count(FRONT_MAN_MARKER), 1)
+        self.assertEqual(deployed.get("weather").get("instructions").count(DEMO_MARKER), 1)
+
+        stripped: dict[str, Any]
+        stripped, _ = self._stripper().strip_definition(deployed)
+
+        self.assertEqual(stripped, DEFINITION
```

---

### Incident Patch 4: `54d61425` (2026-09-30)
**Commit Message**: Merge branch 'main' into fix/1458-unwrap-designer-instructions

**File**: `.github/workflows/agent_network_designer.yml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ jobs:
         export PYTHONPATH=".:${PYTHONPATH:-}"
         build_scripts/server_start.sh
         if ! pytest --capture=no --verbose \
-            -m "integration_agent_network_designer" --timer-top-n 100; then
+            -m "integration_agent_network_designer" --durations=100; then
           echo "===================================================="
           echo "=== Server Log ==="
           cat logs/server.log || echo "(no server.log found)"
```

**File**: `AGENTS.md` (modified, +43/-23)
```diff
@@ -1,8 +1,10 @@
 # AGENTS.md
 
-Rules for coding agents in Neuro-san-studio. Follow them and the §4 gates pass on the first run.
-
----
+Rules for coding agents in Neuro-san-studio.
+Neuro SAN Studio is a multi-agent orchestration framework built on the
+[neuro-san](https://github.com/cognizant-ai-lab/neuro-san) library.
+Agent networks are defined declaratively in HOCON files under `registries/`.
+Custom Python tools live in `coded_tools/`.
 
 ## 1. Contribution rules
 
@@ -23,18 +25,28 @@ Rules for coding agents in Neuro-san-studio. Follow them and the §4 gates pass
   [search_tools.md](docs/search_tools.md), or [user_guide.md → Middleware](docs/user_guide.md#middleware).
   A network in `generated/` is git-ignored and personal.
   Verify every link in the documents you touch to check for broken links.
+- Use US spelling for English words.
+
+## 2. Coding style
 
-## 2. Python style
+- Clean Code Standards: follow Robert C. Martin’s (Uncle Bob) *Clean Code* and *The Clean Coder* recommendations
+- Keep things simple, to the point, readable, maintainable and individually testable.
+- Line length: 119 characters, both for .py and .md files.
 
+### 2.1 Python
+
+- Use Python 3.12+ syntax.
+- Use type hints on all parameters and return values, and annotate variable assignments when the type
+  isn't obvious from the right-hand side.
+- Imports: ES-style single-line imports, sorted by isort (`force-single-line = true`).
+- Use `snake_case` for functions, methods, variables, parameters and attributes, `PascalCase` for classes, and
+  `UPPER_CASE` for constants. Comment the reason if an external API forces `camelCase`.
+- Linting: ruff (format + isort + pycodestyle + pyflakes) then pylint. Config in `pyproject.toml`.
 - Everything lives in a class. No standalone helpers, including in tests. `main()` is a static method, and no
   nested `def`s without a comment stating why. Data-only classes carry no policy methods. One class per file,
   named after it.
 - Use `async_invoke` in a `CodedTool`, since `invoke()` blocks the event loop, and wrap blocking I/O in
   `asyncio.to_thread()`.
-- Use `snake_case` for functions, methods, variables, parameters and attributes, `PascalCase` for classes, and
-  `UPPER_CASE` for constants. Comment the reason if an external API forces `camelCase`.
-- Annotate a method that returns `self` or `cls(...)` with `typing.Self`, not its class name, and do not add
-  `from __future__ import annotations`; the Python floor is 3.12.
 - Dictionary access uses `.get()`, never `dict[key]`.
 - Catch specific exceptions that can be handled at that level; never a generalized `Exception`.
 - Never fail silently. Report a missing or unreadable file, malformed input or an unknown choice with the full
@@ -45,9 +57,14 @@ Rules for coding agents in Neuro-san-studio. Follow them and the §4 gates pass
   class; check the interface, or add an interface method that answers the question.
 - Comment the non-obvious: which `_method`s are overrides, threading and lifecycle behavior, design decisions, and
   a breadcrumb to related code or documentation. Order lifecycle methods logically, `start()` before `stop()`.
-- Use long-form flags (`--force`, not `-f`), and docstrings on functions, classes and modules.
+- Docstrings required on classes and functions/methods.
+- Use long-form flags (`--force`, not `-f`)
 - Cover new behavior with a test: a unit test for a coded tool, an integration fixture for a network.
 
+### 2.2 Markdown
+
+- Markdown: linted with pymarkdown (config `.pymarkdownlint.yaml`). Scan covers `docs/` and `README.md`.
+
 ## 3. Framework behavior
 
 - The Front Man must be an LLM agent, never a coded or toolbox tool.
@@ -64,24 +81,27 @@ Rules for coding agents in Neuro-san-studio. Follow them and the §4 gates pass
 - In a manifest, `serve` loads the network, `public` lists it in `/list`, and `mcp` exposes it as an MCP tool.
   Paths resolve relative to `registries/`.
 
-## 4. Opening the PR
-
-Details in [CONTRIBUTING.md](CONTRIBUTING.md).
-
-Branch as `feature/short-name`, `fix/short-name` or `docs/short-name`, and never commit to `main`. A commit is a
-one-line summary, prefixed with the issue number like '#123: Add retry handling to the order lookup coded tool'.
+## 4. Build & test commands
 
+- Main commands are in the Makefile. Run them from the repo root, with the venv activated:
 ```bash
-ns validate registries/<group>/<name>.hocon   # HOCON structure; no LLM calls, no keys needed
-make lint                                     # rewrites files (ruff format + import fix), then checks
-make test                                     # make lint, then pytest with coverage (no integration)
-make test-integration                         # installs into ./venv, then sets the required env vars
+make lint             # Format (ruff) then lint (ruff + pylint + pymarkdown)
+make test             # Lint + run pytest (unit tests only, excludes integration)
+python -m pytest tests/path/to/test_file.py -
```

**File**: `Makefile` (modified, +2/-2)
```diff
@@ -94,7 +94,7 @@ test-integration: install
 	export PYTHONPATH=`pwd` && \
 	export AGENT_TOOL_PATH=coded_tools/ && \
 	export AGENT_MANIFEST_FILE=registries/manifest.hocon && \
-	pytest -s -m "integration" --timer-top-n 100
+	pytest -s -m "integration" --durations=100
 
 # Test the Agent Network Designer (AND)
 test-designer: install
@@ -112,7 +112,7 @@ test-designer: install
 	export PYTHONPATH=`pwd` && \
 	export AGENT_TOOL_PATH=coded_tools/ && \
 	export AGENT_MANIFEST_FILE=registries/manifest.hocon && \
-	pytest --capture=no --verbose -m "integration_agent_network_designer" --timer-top-n 100
+	pytest --capture=no --verbose -m "integration_agent_network_designer" --durations=100
 
 help: ## Show this help message and exit
 	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
```

**File**: `docs/user_guide.md` (modified, +8/-8)
```diff
@@ -1974,40 +1974,40 @@ with ongoing additions of test cases to improve coverage.
 
 Please select the execution option that best aligns with the level of validation you want to perform.
 
-`--timer-top-n 100` flag is optional. It shows the top 100 slowest test cases.
+`--durations=100` flag is optional. It shows the 100 slowest test phases (setup, call, teardown).
 
 - Run all integration test cases:
 
     Example:
 
     ```bash
-    pytest -s -m "integration" --timer-top-n 100
+    pytest -s -m "integration" --durations=100
     ```
 
 - Run by a group or groups of those test cases:
 
     ```bash
-    pytest -s -m "<name of folder>" --timer-top-n 100
+    pytest -s -m "<name of folder>" --durations=100
     ```
 
     Example:
 
     ```bash
-    pytest -s -m "integration_basic" --timer-top-n 100
-    pytest -s -m "integration_industry" --timer-top-n 100
+    pytest -s -m "integration_basic" --durations=100
+    pytest -s -m "integration_industry" --durations=100
     ```
 
 - Run by the network agent hocon name of those test cases:
 
     ```bash
-    pytest -s -m "<name of network_agent hocon>" --timer-top-n 100
+    pytest -s -m "<name of network_agent hocon>" --durations=100
     ```
 
     Example:
 
     ```bash
-    pytest -s -m "integration_basic_coffee_finder_advanced" --timer-top-n 100
-    pytest -s -m "integration_industry_airline_policy" --timer-top-n 100
+    pytest -s -m "integration_basic_coffee_finder_advanced" --durations=100
+    pytest -s -m "integration_industry_airline_policy" --durations=100
     ```
 
 - Run a single test case:
```

**File**: `requirements-build.txt` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@ coverage==7.6.1
 pytest==9.0.3
 pytest-asyncio==1.3.0
 pytest-cov==5.0.0
-pytest-timer==1.0.0
 pytest-timeout>=2.3.1
 timeout-decorator==0.5.0
 pymarkdownlnt==0.9.30
```

**File**: `tests/neuro_san_studio/discovery/test_analysis_logging.py` (removed, +0/-121)
```diff
@@ -1,121 +0,0 @@
-# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-#
-# END COPYRIGHT
-
-"""Dependency analysis must not spam the console with pyhocon include warnings.
-
-A pip-installed source tree ships no `config/` directory, so nearly every network's
-`include "config/llm_config.hocon"` fails to resolve during analysis. That is expected —
-the analyzer tolerates unresolved includes by design — but pyhocon logs
-"Cannot include file ..." once per parse, which interleaved noise into every
-`ns init` / `ns import` run on a pip install.
-"""
-
-import logging
-from pathlib import Path
-from typing import List
-
-import pytest
-
-from neuro_san_studio.discovery.dependency_analyzer import AgentNetworkDependencies
-from neuro_san_studio.discovery.dependency_analyzer import DependencyAnalyzer
-
-
-class TestAnalysisLogging:
-    """`get_transitive_dependencies` must keep pyhocon quiet and put its logger back."""
-
-    @staticmethod
-    def _build_source_with_missing_include(source_dir: Path) -> Path:
-        """
-        Lay out a source tree whose network includes a file that does not exist there.
-
-        Mirrors the pip layout: the network references `config/llm_config.hocon`, which the
-        installed package never ships. No `${substitution}` is used, so the parse itself
-        succeeds and the class reference below stays extractable.
-
-        :param source_dir: Root directory to build the synthetic source tree under.
-        :return: The full path of the network HOCON to analyze.
-        """
-        registries: Path = source_dir / "registries"
-        registries.mkdir(parents=True)
-        hocon: Path = registries / "demo.hocon"
-        hocon.write_text(
-            """{
-    include "config/llm_config.hocon",
-    "tools": [
-        { "name": "demo", "class": "demo_tool.DemoTool" }
-    ]
-}
-"""
-        )
-        coded_tools: Path = source_dir / "coded_tools"
-        coded_tools.mkdir(parents=True)
-        (coded_tools / "__init__.py").write_text("")
-        (coded_tools / "demo_tool.py").write_text("class DemoTool:\n    pass\n")
-        (source_dir / "middleware").mkdir(parents=True)
-        return hocon
-
-    @staticmethod
-    def _analyzer(source_dir: Path) -> DependencyAnalyzer:
-        """
-        Build an analyzer rooted at `source_dir`.
-
-        :param source_dir: Root of the synthetic source tree.
-        :return: A DependencyAnalyzer over that tree's registries/coded_tools/middleware roots.
-        """
-        return DependencyAnalyzer(
-            str(source_dir / "registries"),
-            str(source_dir / "coded_tools"),
-            str(source_dir / "middleware"),
-        )
-
-    def test_unresolvable_include_logs_nothing(self, tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
-        """An include that cannot resolve must not reach the console, and analysis must still work.
-
-        :param tmp_path: pytest-provided temporary directory for the synthetic source tree.
-        :param caplog: pytest's log capture, used to detect pyhocon's include complaints.
-        """
-        source: Path = tmp_path / "source"
-        hocon: Path = self._build_source_with_missing_include(source)
-
-        with caplog.at_level(logging.WARNING, logger="pyhocon.config_parser"):
-            deps: AgentNetworkDependencies = self._analyzer(source).get_transitive_dependencies(str(hocon))
-
-        # The failed include must not have cost us the actual dependency extraction.
-        assert deps.coded_tools == ["coded_tools/demo_tool.py"]
-        pyhocon_complaints: List[str] = []
-        for record in caplog.records:
-            if record.name == "pyhocon.config_parser":
-                pyhocon_complaints.append(record.getMessage())
-        assert not pyhocon_complaints, f"pyhocon noise leaked through: {pyhocon_complaints}"
-
-    def test_pyhocon_logger_level_is_restored(self, tmp_path: Path) -> None:
-        """The demotion is scoped to the walk; a caller's own pyhocon level must survive.
-
-        :param tmp_path: pytest-provided temporary directory for the synthetic source tree.
-        """
-        source: Path = tmp_path / "source"
-        hocon: Path = self._build_source_with_missing_include(source)
-        pyhocon_logger: logging.Logger = logging.getLogger("pyhocon.config_parser")
-        prev_level: int = pyhocon_logger.level
-        try:
-            pyhocon
```

**File**: `tests/neuro_san_studio/discovery/test_analysis_working_directory.py` (removed, +0/-127)
```diff
@@ -1,127 +0,0 @@
-# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-#
-# END COPYRIGHT
-
-"""Dependency analysis must not depend on the caller's working directory.
-
-Networks pull shared prompt fragments in with `include "registries/<name>.hocon"` and then
-substitute them (`${aaosa_instructions}`). pyhocon resolves a relative include against the
-process CWD, and `analyze_network` swallows the resulting ValueError -- so analyzing from
-the wrong directory used to return an *empty* dependency set with no error at all, and the
-network landed in the target project with none of its coded tools.
-"""
-
-import os
-from pathlib import Path
-
-import pytest
-
-from neuro_san_studio.discovery.dependency_analyzer import DependencyAnalyzer
-
-
-def _build_source(source_dir: Path) -> None:
-    """Lay out a source tree whose network includes and substitutes a shared fragment."""
-    registries = source_dir / "registries"
-    registries.mkdir(parents=True)
-    (registries / "shared.hocon").write_text('{ "shared_instructions": "be helpful" }\n')
-    (registries / "demo.hocon").write_text(
-        """{
-    include "registries/shared.hocon",
-    "tools": [
-        {
-            "name": "demo",
-            "instructions": ${shared_instructions},
-            "class": "demo_tool.DemoTool"
-        }
-    ]
-}
-"""
-    )
-
-    coded_tools = source_dir / "coded_tools"
-    coded_tools.mkdir(parents=True)
-    (coded_tools / "__init__.py").write_text("")
-    (coded_tools / "demo_tool.py").write_text("class DemoTool:\n    pass\n")
-    (source_dir / "middleware").mkdir(parents=True)
-
-
-def _analyzer(source_dir: Path) -> DependencyAnalyzer:
-    """Build an analyzer rooted at `source_dir`."""
-    return DependencyAnalyzer(
-        str(source_dir / "registries"),
-        str(source_dir / "coded_tools"),
-        str(source_dir / "middleware"),
-    )
-
-
-class TestAnalysisIsWorkingDirectoryIndependent:
-    """`get_transitive_dependencies` must resolve includes relative to the analyzed tree."""
-
-    def test_includes_resolve_from_an_unrelated_cwd(self, tmp_path: Path) -> None:
-        """The dependency set must be identical whether or not CWD happens to hold the includes.
-
-        This is the regression guard for `ns import`, which ran the analysis with CWD set to
-        the user's project while parsing HOCONs out of the installed studio package.
-        """
-        source = tmp_path / "source"
-        _build_source(source)
-        elsewhere = tmp_path / "elsewhere"
-        elsewhere.mkdir()
-
-        analyzer = _analyzer(source)
-        target = str(source / "registries" / "demo.hocon")
-
-        from_source = analyzer.get_transitive_dependencies(target)
-        os.chdir(elsewhere)
-        from_elsewhere = analyzer.get_transitive_dependencies(target)
-
-        assert from_source.coded_tools == ["coded_tools/demo_tool.py"]
-        assert from_elsewhere.coded_tools == from_source.coded_tools
-
-    def test_working_directory_is_restored(self, tmp_path: Path) -> None:
-        """A caller's CWD must survive the analysis, including when the network is unparseable."""
-        source = tmp_path / "source"
-        _build_source(source)
-        (source / "registries" / "broken.hocon").write_text("{ not valid hocon ${\n")
-        elsewhere = tmp_path / "elsewhere"
-        elsewhere.mkdir()
-        os.chdir(elsewhere)
-        before = os.getcwd()
-
-        analyzer = _analyzer(source)
-        analyzer.get_transitive_dependencies(str(source / "registries" / "demo.hocon"))
-        assert os.getcwd() == before
-
-        analyzer.get_transitive_dependencies(str(source / "registries" / "broken.hocon"))
-        assert os.getcwd() == before
-
-    def test_relative_hocon_path_is_resolved_before_the_chdir(self, tmp_path: Path) -> None:
-        """A path relative to the caller's CWD must still resolve once analysis chdirs away."""
-        source = tmp_path / "source"
-        _build_source(source)
-        os.chdir(source / "registries")
-
-        analyzer = _analyzer(source)
-        deps = analyzer.get_transitive_dependencies("demo.hocon")
-
-        assert deps.coded_tools == ["coded_tools/demo_tool.py"]
-
-
-@pytest.fixture(autouse=True)
-def _restore_cwd():
-    """Tests here chdir on purpose; put the process back so later tests are unaffected."""
-    prev = os.getcwd()
-    yield
-    os.chdir(prev)
```

**File**: `tests/neuro_san_studio/discovery/test_coded_tool_resolution.py` (removed, +0/-58)
```diff
@@ -1,58 +0,0 @@
-# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-#
-# END COPYRIGHT
-
-"""Tests for DependencyAnalyzer.resolve_coded_tool_path short-form hierarchy resolution."""
-
-from pathlib import Path
-
-from neuro_san_studio.discovery.dependency_analyzer import DependencyAnalyzer
-
-
-def _analyzer(tmp_path: Path) -> DependencyAnalyzer:
-    """A DependencyAnalyzer pointed at empty registries/coded_tools/middleware under tmp_path."""
-    return DependencyAnalyzer(
-        str(tmp_path / "registries"),
-        str(tmp_path / "coded_tools"),
-        str(tmp_path / "middleware"),
-    )
-
-
-class TestShortFormResolution:
-    """A short-form ``module.Class`` ref resolves up the group hierarchy, like neuro-san."""
-
-    def test_resolves_tool_in_per_network_dir(self, tmp_path: Path) -> None:
-        """A tool under coded_tools/<group>/<network>/ is found via context_dir."""
-        tool = tmp_path / "coded_tools" / "basic" / "music_nerd" / "lookup.py"
-        tool.parent.mkdir(parents=True)
-        tool.write_text("class Lookup: pass\n")
-
-        result = _analyzer(tmp_path).resolve_coded_tool_path("lookup.Lookup", context_dir="basic/music_nerd")
-        assert result == "coded_tools/basic/music_nerd/lookup.py"
-
-    def test_resolves_group_level_tool(self, tmp_path: Path) -> None:
-        """A tool at the group level coded_tools/<group>/ is found when not in the network dir.
-
-        Regression for issue #1147: music_nerd_pro's ``accountant.Accountant`` lives at
-        coded_tools/basic/accountant.py, not coded_tools/basic/music_nerd_pro/accountant.py.
-        """
-        tool = tmp_path / "coded_tools" / "basic" / "accountant.py"
-        tool.parent.mkdir(parents=True)
-        tool.write_text("class Accountant: pass\n")
-
-        result = _analyzer(tmp_path).resolve_coded_tool_path(
-            "accountant.Accountant", context_dir="basic/music_nerd_pro"
-        )
-        assert result == "coded_tools/basic/accountant.py"
```

---

### Incident Patch 5: `008ce9d7` (2026-09-29)
**Commit Message**: Merge branch 'main' into fix/1458-unwrap-designer-instructions

**File**: `.lycheeignore` (modified, +4/-0)
```diff
@@ -25,6 +25,10 @@ https://mcp/
 # Login-walled pages that redirect through an auth flow lychee can't resolve
 https://admin.mistral.ai/
 
+# TEMPORARY: serply.io is down (as of 2026-09-29). Remove once the site is back.
+https://serply.io
+https://api.serply.io
+
 # URLs whose base path is not browsable (returns 400 or 404)
 https://raw.githubusercontent.com/anthropics/skills/main/skills/internal-comms/
 https://api.anthropic.com/
```

**File**: `neuro_san_studio/coded_tools/utils/safe_fetch.py` (modified, +64/-19)
```diff
@@ -33,8 +33,10 @@
 from aiohttp import ClientSession
 from aiohttp import ClientTimeout
 from aiohttp import DummyCookieJar
+from aiohttp import RequestInfo
 from aiohttp import TCPConnector
 from bs4 import BeautifulSoup
+from yarl import URL
 
 from neuro_san_studio.coded_tools.utils.global_only_resolver import GlobalOnlyResolver
 from neuro_san_studio.coded_tools.utils.pdf_utils import PDF_HEADER_WINDOW
@@ -103,6 +105,10 @@ class delegates to it. Ordinary hostnames are validated at connection time by
     oversized body. A PDF download is also sniffed for a "%PDF-" header within its
     first PDF_HEADER_WINDOW bytes and refused (not_a_pdf) before the rest is read.
 
+    Every URL named in an error message is reduced to scheme, host and path
+    (UrlPolicy.redact_for_log): redirect targets are server-controlled and routinely carry a
+    bearer credential in their query string, and these messages end up in logs.
+
     Error types (raised as ValueError or aiohttp.ClientResponseError or aiohttp.ClientError with the specified message)
         invalid_input            – URL is missing, not a valid http/https URL, or a parameter has an invalid type.
         url_too_long             – URL exceeds MAX_URL_LENGTH characters.
@@ -313,16 +319,18 @@ async def _open_following_redirects(
                 # requests from this host (DoS, or probing the SSRF policy hop by hop).
                 if redirects_followed >= MAX_REDIRECTS:
                     raise ValueError(
-                        f"url_not_allowed: '{url}' exceeded MAX_REDIRECTS ({MAX_REDIRECTS}) redirects "
-                        f"(last hop '{current_url}' answered {status})."
+                        f"url_not_allowed: '{UrlPolicy.redact_for_log(url)}' exceeded MAX_REDIRECTS "
+                        f"({MAX_REDIRECTS}) redirects (last hop '{UrlPolicy.redact_for_log(current_url)}' "
+                        f"answered {status})."
                     )
                 # 304 Not Modified and any other 3xx without a Location cannot be
                 # followed. Refuse rather than fall through and hand the redirect
                 # page's own body to the caller as if it were the resource.
                 location: str = (response.headers.get("Location") or "").strip()
                 if not location:
                     raise ValueError(
-                        f"url_not_allowed: '{url}' answered {status} at '{current_url}' without a Location header."
+                        f"url_not_allowed: '{UrlPolicy.redact_for_log(url)}' answered {status} at "
+                        f"'{UrlPolicy.redact_for_log(current_url)}' without a Location header."
                     )
             # The hop's response context has now been exited, so its connection is
             # released (back to the pool, or closed) before the next request is made
@@ -344,17 +352,21 @@ async def _open_following_redirects(
                 # caller's URL was fine; the server pointed somewhere this policy
                 # refuses, so surface every hop failure uniformly as url_not_allowed
                 # and keep the inner reason for diagnosis.
+                # next_url is the raw, unvalidated Location the server chose: it may be any scheme
+                # and may carry a credential in its query, so it is named in redacted form only.
                 raise ValueError(
-                    f"url_not_allowed: '{url}' redirects to '{next_url}' ({status}), which failed validation: {exc}"
+                    f"url_not_allowed: '{UrlPolicy.redact_for_log(url)}' redirects to "
+                    f"'{UrlPolicy.redact_for_log(next_url)}' ({status}), which failed validation: {exc}"
                 ) from exc
             # Refuse https -> http downgrade hops. The session stores no cookies and
             # sends no credentials, but the URL itself can carry a bearer secret (a
             # presigned S3/Azure query string), and the server chooses the Location,
             # so a downgrade hop could deliberately put that secret on plaintext.
             if urlparse(current_url).scheme.lower() == "https" and urlparse(validated_next).scheme.lower() == "http":
                 raise ValueError(
-                    f"url_not_allowed: '{url}' redirects from https '{current_url}' to http '{validated_next}' "
-                    f"({status}); downgrade redirects are not followed."
+                    f"url_not_allowed: '{UrlPolicy.redact_for_log(url)}' redirects from https "
+                    f"'{UrlPolicy.redact_for_log(current_url)}' to http "
+                    f"'{UrlPolicy.redact_for_log(validated_next)}' ({status}); downgrade redirects are not followed."
                 )
             current_url = validated_next
             redirects_followed += 1
@@ -546,7 +558,7 @@ def check_content_length(content_length_header: str | None, url: str) -> None:
         Raise response_too_large if a Content-Length header exceeds MAX_RESPONSE_BYTES.
 
         :param con
```

**File**: `neuro_san_studio/coded_tools/utils/url_policy.py` (modified, +105/-0)
```diff
@@ -16,12 +16,14 @@
 
 """URL-level SSRF policy (scheme, length, hostname canonicalization, domain rules) behind SafeFetch."""
 
+import re
 from ipaddress import IPv4Address
 from ipaddress import IPv6Address
 from ipaddress import ip_address
 from typing import Any
 from urllib.parse import ParseResult
 from urllib.parse import urlparse
+from urllib.parse import urlunparse
 
 import idna
 from aiohttp.helpers import is_ip_address
@@ -38,6 +40,14 @@
 # literals are validated separately; a genuine hostname containing anything outside
 # this set means IDNA could not canonicalize it and it is not a usable DNS name.
 HOSTNAME_ALLOWED_CHARS: frozenset[str] = frozenset("abcdefghijklmnopqrstuvwxyz0123456789.-_")
+# A URL with an authority ("scheme://...") embedded in free text, such as an error message. Any
+# scheme is matched, not only http(s), and the match runs to the next whitespace: a URL may itself
+# contain quotes or brackets, so stopping at one would leave its query behind. Whatever quoting or
+# punctuation the surrounding text closed the URL with is peeled off again in _redact_match.
+# Case-insensitive because validate_url accepts an upper-case scheme and hands the spelling on.
+URL_IN_TEXT_PATTERN: re.Pattern[str] = re.compile(r"[a-z][a-z0-9+.-]*://\S+", re.IGNORECASE)
+# Characters that surrounding prose may attach to the end of a quoted URL; they are not part of it.
+URL_TRAILING_CHARS: frozenset[str] = frozenset(".,;:)]>'\"")
 
 
 class UrlPolicy:
@@ -286,3 +296,98 @@ def validate_domain_list(value: Any, param_name: str) -> list[str]:
                     f"but contains non-string element {item!r}."
                 )
         return value
+
+    @staticmethod
+    def redact_for_log(url: str) -> str:
+        """
+        Return a URL reduced to scheme, host and path, for log lines.
+
+        Redirect targets are server-controlled and routinely carry bearer credentials in the
+        query string (presigned object-store links, signed CDN URLs) or, rarely, in userinfo.
+        A log line that records such a URL verbatim persists the credential for as long as the
+        logs live. This keeps what identifies the resource and replaces the query with a fixed
+        marker, so a reader can still tell one was present; the fragment and any userinfo are
+        dropped.
+
+        :param url: The URL to redact. Usually one that passed validate_url, but a raw redirect
+                    Location of any scheme is accepted too; a string urlparse rejects is cut at
+                    its first "?" or "#" instead.
+        :return: The redacted URL, e.g. "https://files.example.com/report.pdf?[redacted]".
+        """
+        try:
+            parsed: ParseResult = urlparse(url)
+            port: int | None = parsed.port
+        except ValueError:
+            return UrlPolicy._redact_unparseable(url)
+        host: str = parsed.hostname or ""
+        # urlparse strips the brackets from an IPv6 literal; put them back so the log stays a URL.
+        if ":" in host:
+            host = f"[{host}]"
+        if port is not None:
+            host = f"{host}:{port}"
+        query: str = "[redacted]" if parsed.query else ""
+        return urlunparse((parsed.scheme, host, parsed.path, "", query, ""))
+
+    @staticmethod
+    def redact_urls_in_text(text: str) -> str:
+        """
+        Redact every URL with an authority embedded in free text, for log lines that quote an error message.
+
+        SafeFetch's translated errors interpolate the URL they were given, and for a body fetch
+        that is the server-controlled redirect target; a log line that quotes such a message
+        would leak a presigned token exactly as logging the URL itself would. Every match is
+        replaced by its redact_for_log form.
+
+        :param text: The text to scan, typically str(exception).
+        :return: The text with every embedded URL reduced to scheme, host and path.
+        """
+        return URL_IN_TEXT_PATTERN.sub(UrlPolicy._redact_match, text)
+
+    @staticmethod
+    def _redact_match(match: re.Match[str]) -> str:
+        """
+        Redact one URL found by URL_IN_TEXT_PATTERN, keeping sentence punctuation that followed it.
+
+        :param match: The regex match holding the URL (and possibly a trailing "." or ",").
+        :return: The redacted URL followed by whatever punctuation the match swallowed.
+        """
+        url: str = match.group(0)
+        trailing: str = ""
+        # The pattern runs to whitespace, so closing quotes, brackets and sentence punctuation
+        # that belong to the prose end up inside the match; peel them off, redact, re-append.
+        while url and url[-1] in URL_TRAILING_CHARS:
+            trailing = url[-1] + trailing
+            url = url[:-1]
+        return UrlPolicy.redact_for_log(url) + trailing
+
+    @staticmethod
+    def _redact_unparseable(url: str) -> str:
+        """
+        Redact a URL that urlparse rejected, by text, keeping enou
```

**File**: `neuro_san_studio/coded_tools/web_fetch.py` (modified, +33/-10)
```diff
@@ -23,6 +23,7 @@
 from neuro_san.interfaces.coded_tool import CodedTool
 
 from neuro_san_studio.coded_tools.utils.safe_fetch import SafeFetch
+from neuro_san_studio.coded_tools.utils.url_policy import UrlPolicy
 
 MAX_CHARS: int = 20_000
 SUPPORTED_CONTENT_TYPES: set[str] = {
@@ -54,7 +55,8 @@ class WebFetch(CodedTool):
     (anti DNS-rebinding), redirects are followed up to SafeFetch's MAX_REDIRECTS
     hops with every hop re-validated as a brand-new URL (including this tool's own
     allowed_domains / blocked_domains, which are forwarded to SafeFetch for that
-    purpose), and response sizes are capped. HTML is stripped with BeautifulSoup;
+    purpose), the body is fetched from the chain's final URL (reported as
+    "final_url"), and response sizes are capped. HTML is stripped with BeautifulSoup;
     PDF bodies are sniffed for a "%PDF-" header while streaming, then parsed with
     pypdf. Use allowed_domains / blocked_domains for stricter control.
 
@@ -92,7 +94,11 @@ async def async_invoke(self, args: dict[str, Any], sly_data: dict[str, Any]) ->
 
         :return:
             A dictionary with the following keys:
-                "url"          (str): The URL that was fetched.
+                "url"          (str): The URL that was requested.
+                "final_url"    (str): The URL the probe ended on after redirects, and the URL
+                                      the body fetch started from (equal to "url" when there
+                                      were none). A redirect that appears only at fetch time
+                                      is followed under the same rules but is not reported here.
                 "content"      (str): Plain-text body of the fetched page.
                 "retrieved_at" (str): ISO-8601 UTC timestamp when the content was retrieved.
 
@@ -117,10 +123,25 @@ async def async_invoke(self, args: dict[str, Any], sly_data: dict[str, Any]) ->
             content_type, prefetched_text, final_url = await SafeFetch.get_content_type(
                 url, session, allowed_domains=allowed_domains, blocked_domains=blocked_domains
             )
-            # Classify by the URL the headers actually came from: a link that redirects
-            # to a .pdf served as a generic download type is a PDF even though the
-            # requested URL carries no .pdf suffix. The fetch below still starts from
-            # the requested URL and re-validates every hop.
+            # Log the redirect before fetching, so the requested -> final link is on record
+            # even when the body fetch below fails: SafeFetch's error message names only the
+            # URL it was given, which is now final_url rather than the one logged above. The
+            # target is server-controlled and may be a presigned URL carrying a bearer token
+            # in its query, so it is logged redacted (scheme, host, path only).
+            if final_url != url:
+                logger.info("WebFetch: %s redirected to %s", url, UrlPolicy.redact_for_log(final_url))
+            # Classify by the URL the headers actually came from, and fetch from it too.
+            # A link that redirects to a .pdf served as a generic download type is a PDF
+            # even though the requested URL carries no .pdf suffix. Starting the body
+            # fetch at final_url instead of the requested URL avoids walking the redirect
+            # chain a second time and keeps the body and the classification from the same
+            # place: a rotating or expiring redirect could otherwise send the second walk
+            # elsewhere and hand a PDF body to the HTML stripper (or the reverse). One
+            # window remains: a redirect that appears only at fetch time is followed by
+            # SafeFetch under the same rules, but its fetch methods return the body alone,
+            # so final_url stays the probe's terminal URL. Nothing is skipped by this: the
+            # probe re-validated every hop under the same domain rules, and the fetch
+            # re-validates final_url at entry again.
             is_pdf: bool = SafeFetch.is_pdf(content_type, final_url)
 
             if not is_pdf and not self._is_supported_content_type(content_type):
@@ -134,23 +155,25 @@ async def async_invoke(self, args: dict[str, Any], sly_data: dict[str, Any]) ->
                 # Note: passing the PDF as base64 directly to the model would be
                 # preferable once neuro-san supports multimodal input.
                 text: str = await SafeFetch.fetch_pdf_text(
-                    url, session, allowed_domains=allowed_domains, blocked_domains=blocked_domains
+                    final_url, session, allowed_domains=allowed_domains, blocked_domains=blocked_domains
                 )
             elif prefetched_text is not None:
                 # Body was already fetched during the 405 HEAD fallback GET; no second request needed.
                 text = SafeFetch.parse_raw_text(prefetched_text
```

**File**: `neuro_san_studio/coded_tools/webpage_rag.py` (modified, +31/-11)
```diff
@@ -31,6 +31,7 @@
 from neuro_san_studio.coded_tools.base_rag import BaseRag
 from neuro_san_studio.coded_tools.base_rag import PostgresConfig
 from neuro_san_studio.coded_tools.utils.safe_fetch import SafeFetch
+from neuro_san_studio.coded_tools.utils.url_policy import UrlPolicy
 
 logging.basicConfig(level=logging.INFO)
 logger = logging.getLogger(__name__)
@@ -46,7 +47,8 @@ class WebpageRag(CodedTool, BaseRag):
     Content is downloaded through the shared SSRF-hardened fetch path (SafeFetch):
     private/loopback/reserved hosts are rejected, DNS records are validated at
     connection time (anti DNS-rebinding), redirects are followed up to a bounded
-    number of hops with every hop re-validated, and response sizes are capped. Each
+    number of hops with every hop re-validated, the body is fetched from the chain's
+    final URL (recorded as the Document's source), and response sizes are capped. Each
     URL is routed by content type: PDFs are parsed with pypdf
     (via SafeFetch.fetch_pdf_text) and HTML/text is stripped to plain text, so a PDF
     link is ingested as readable text instead of being embedded as binary garbage.
@@ -209,7 +211,10 @@ async def load_documents(self, loader_args: dict[str, Any]) -> list[Document]:
             if isinstance(result, Document):
                 documents.append(result)
             elif result is not None:
-                logger.error("Skipped a URL after an unexpected error: %r", result)
+                # Same redaction as the per-URL catch: the message may quote the fetched URL.
+                logger.error(
+                    "Skipped a URL after an unexpected error: %s", UrlPolicy.redact_urls_in_text(repr(result))
+                )
         return documents
 
     async def _load_single(self, url: str, session: ClientSession, semaphore: Semaphore) -> Document | None:
@@ -243,14 +248,26 @@ async def _load_single(self, url: str, session: ClientSession, semaphore: Semaph
                 prefetched_text: str | None
                 final_url: str
                 content_type, prefetched_text, final_url = await SafeFetch.get_content_type(validated_url, session)
-
-                # Classify by the URL the headers came from (after redirects), so a link
-                # that redirects to a .pdf served as a generic download type is parsed
-                # as a PDF. The source metadata below still records the requested URL.
+                # The redirect target is server-controlled and may be a presigned URL carrying a
+                # bearer token in its query, so it is logged redacted (scheme, host, path only).
+                if final_url != validated_url:
+                    logger.info("%s redirected to %s", validated_url, UrlPolicy.redact_for_log(final_url))
+
+                # Classify by the URL the headers came from (after redirects), fetch from
+                # it, and record it as the source. A link that redirects to a .pdf served
+                # as a generic download type is parsed as a PDF. Fetching from final_url
+                # avoids a second walk of the redirect chain and keeps the body and the
+                # classification from the same place (the probe re-validated every hop,
+                # and the fetch re-validates final_url at entry). Recording final_url as
+                # the source means citations point at the document, not the redirector,
+                # and two configured links to one document collapse to one source. The
+                # source is the probe's terminal URL: a redirect that appears only at fetch
+                # time is followed by SafeFetch under the same rules, but its fetch methods
+                # return the body alone, so it is not reflected here.
                 if SafeFetch.is_pdf(content_type, final_url):
-                    pdf_text: str = await SafeFetch.fetch_pdf_text(validated_url, session)
+                    pdf_text: str = await SafeFetch.fetch_pdf_text(final_url, session)
                     # PDFs carry no HTML metadata; record only the source.
-                    return Document(page_content=pdf_text, metadata={"source": validated_url})
+                    return Document(page_content=pdf_text, metadata={"source": final_url})
 
                 # An empty/missing Content-Type is treated as text rather than skipped:
                 # WebBaseLoader (the loader this replaces) fetched regardless of type,
@@ -268,22 +285,25 @@ async def _load_single(self, url: str, session: ClientSession, semaphore: Semaph
                 if prefetched_text is not None:
                     raw = prefetched_text
                 else:
-                    raw = await SafeFetch.fetch_raw(validated_url, session)
+                    raw = await SafeFetch.fetch_raw(final_url, session)
 
                 # BeautifulSoup parsing is blocking CPU work. Calling it directly would
                 # occupy the single event-loop thread for its whole duration and freeze
           
```

**File**: `requirements.txt` (modified, +4/-0)
```diff
@@ -24,6 +24,10 @@ aiohttp>=3.13.0,<4.0
 # imports it directly and relies on yarl-matching UTS#46 behavior.
 idna>=3.0
 
+# aiohttp's URL type, used to hand a translated ClientResponseError a redacted RequestInfo in
+# SafeFetch. Already required by aiohttp; declared here because SafeFetch imports it directly.
+yarl>=1.9
+
 # For HTML parsing
 beautifulsoup4>=4.12.0
 
```

**File**: `tests/neuro_san_studio/coded_tools/test_web_fetch.py` (modified, +53/-4)
```diff
@@ -36,7 +36,7 @@ def setUp(self):
         self.sly_data: dict = {}
 
     def test_html_fetch_returns_correct_keys(self):
-        """Tests that fetching an HTML page returns a result with url, content, and retrieved_at keys."""
+        """Tests that an HTML fetch returns url, final_url, content and retrieved_at keys."""
         with (
             patch.object(
                 SafeFetch, "get_content_type", new=AsyncMock(return_value=("text/html", None, "http://example.com"))
@@ -46,6 +46,7 @@ def test_html_fetch_returns_correct_keys(self):
             result = asyncio.run(self.tool.async_invoke({"url": "http://example.com"}, self.sly_data))
 
         self.assertEqual(result["url"], "http://example.com")
+        self.assertEqual(result["final_url"], "http://example.com")
         self.assertEqual(result["content"], "Hello world")
         self.assertIn("retrieved_at", result)
 
@@ -99,8 +100,9 @@ def test_redirected_pdf_is_classified_by_final_url(self) -> None:
         """A link without a .pdf suffix that redirects to a .pdf served as a generic download type is parsed as PDF.
 
         The suffix fallback must look at the URL the headers came from, not the
-        requested one. The PDF fetch itself still starts from the requested URL so
-        every hop is re-validated on the way down, and the result keeps that URL.
+        requested one. The PDF fetch then starts from that final URL (one walk of the
+        redirect chain, body and classification from the same place); the result keeps
+        the requested URL as "url" and reports the fetched one as "final_url".
         """
         requested: str = "http://example.com/download?id=42"
         final: str = "http://cdn.example.com/files/report.pdf"
@@ -113,9 +115,56 @@ def test_redirected_pdf_is_classified_by_final_url(self) -> None:
             result = asyncio.run(self.tool.async_invoke({"url": requested}, self.sly_data))
 
         mock_pdf.assert_awaited_once()
-        self.assertEqual(mock_pdf.await_args.args[0], requested)
+        self.assertEqual(mock_pdf.await_args.args[0], final)
         self.assertEqual(result["content"], "PDF content")
         self.assertEqual(result["url"], requested)
+        self.assertEqual(result["final_url"], final)
+
+    def test_redirected_text_page_is_fetched_from_final_url_with_domain_rules(self) -> None:
+        """Tests that a redirected HTML page is fetched from the probe's final URL, with the domain rules forwarded.
+
+        The redirect chain is walked once (by the probe), so the body comes from the
+        same place the classification did. "url" stays the requested URL so the caller
+        can match the result to its request; "final_url" says where the content came
+        from. The allow-list must still reach the fetch, which re-validates final_url.
+        """
+        requested: str = "http://example.com/go"
+        final: str = "http://www.example.com/landing"
+        with (
+            patch.object(SafeFetch, "get_content_type", new=AsyncMock(return_value=("text/html", None, final))),
+            patch.object(SafeFetch, "fetch_text", new=AsyncMock(return_value="Landed")) as mock_text,
+        ):
+            result = asyncio.run(
+                self.tool.async_invoke({"url": requested, "allowed_domains": ["example.com"]}, self.sly_data)
+            )
+
+        mock_text.assert_awaited_once()
+        self.assertEqual(mock_text.await_args.args[0], final)
+        self.assertEqual(mock_text.await_args.kwargs["allowed_domains"], ["example.com"])
+        self.assertEqual(result["url"], requested)
+        self.assertEqual(result["final_url"], final)
+        self.assertEqual(result["content"], "Landed")
+
+    def test_redirect_logs_redact_server_controlled_url(self) -> None:
+        """Tests that a presigned redirect target is logged without its query, while the result keeps the full URL.
+
+        The redirect target is chosen by the server and may carry a bearer token in its query
+        string; log lines must not persist it. The agent still receives the full final URL,
+        which it needs to cite the document.
+        """
+        requested: str = "http://example.com/report"
+        final: str = "http://files.example.com/report.pdf?X-Amz-Signature=secret-token"
+        with (
+            patch.object(SafeFetch, "get_content_type", new=AsyncMock(return_value=("application/pdf", None, final))),
+            patch.object(SafeFetch, "fetch_pdf_text", new=AsyncMock(return_value="PDF content")),
+        ):
+            with self.assertLogs("WebFetch", level="INFO") as logs:
+                result = asyncio.run(self.tool.async_invoke({"url": requested}, self.sly_data))
+
+        joined: str = "\n".join(logs.output)
+        self.assertNotIn("secret-token", joined)
+        self.assertIn("redirected to http://files.example.com/report.pdf?[redacted]", joined)
+        self.assertEqual(result["final_url"], final)
 
     def test_redirected_generic_download_with
```

**File**: `tests/neuro_san_studio/coded_tools/test_webpage_rag.py` (modified, +88/-12)
```diff
@@ -99,14 +99,29 @@ async def cancel_mid_flight_load(tool: WebpageRag) -> None:
     await task
 
 
-class TestWebpageRag(TestCase):
+class TestWebpageRag(TestCase):  # pylint: disable=too-many-public-methods
     """Unit tests for WebpageRag: SSRF-hardened loading, PDF/HTML routing, input guards."""
 
     def setUp(self):
         # Bypass BaseRag.__init__, which instantiates OpenAIEmbeddings and therefore
         # requires an OPENAI_API_KEY; these tests never embed or build a store.
         self.tool = object.__new__(WebpageRag)
 
+    @staticmethod
+    async def _probe_as_text(url: str, _session: Any) -> tuple[str, None, str]:
+        """
+        Stand in for get_content_type: report text/html with no redirect, echoing the requested URL as final.
+
+        Multi-URL tests need this rather than a fixed return value: since the fetch and the
+        Document source follow the probe's final URL, a fixed final URL would make every
+        page in the batch fetch from and be attributed to the same address.
+
+        :param url: The URL being probed.
+        :param _session: The shared session; unused.
+        :return: A ("text/html", None, url) probe result.
+        """
+        return "text/html", None, url
+
     def _load(self, urls: list[str]) -> list:
         """
         Run load_documents with the given URLs against mocked session and bodies.
@@ -193,7 +208,11 @@ def test_pdf_url_suffix_routes_to_fetch_pdf(self):
         self.assertEqual(docs[0].page_content, "PDF from suffix")
 
     def test_redirected_pdf_is_classified_by_final_url(self) -> None:
-        """A URL that redirects to a .pdf served as a generic download type is parsed as PDF via the final URL."""
+        """A URL that redirects to a .pdf served as a generic download type is parsed as PDF via the final URL.
+
+        The PDF is fetched from that final URL and it becomes the Document's source, so
+        the redirect chain is walked once and citations point at the document itself.
+        """
         with (
             patch.object(SafeFetch, "open_session", return_value=make_session_cm()),
             patch.object(
@@ -207,8 +226,73 @@ def test_redirected_pdf_is_classified_by_final_url(self) -> None:
             docs = self._load(["http://example.com/download"])
 
         mock_pdf.assert_awaited_once()
+        self.assertEqual(mock_pdf.await_args.args[0], "http://example.com/files/report.pdf")
         mock_raw.assert_not_awaited()
         self.assertEqual(docs[0].page_content, "PDF after redirect")
+        self.assertEqual(docs[0].metadata, {"source": "http://example.com/files/report.pdf"})
+
+    def test_redirected_html_page_is_fetched_from_and_attributed_to_final_url(self) -> None:
+        """A redirected HTML page is fetched from the URL the probe ended on, and that URL becomes the source.
+
+        One walk of the redirect chain (the probe), then one fetch starting at its end;
+        the source names where the content lives, not the redirector.
+        """
+        with (
+            patch.object(SafeFetch, "open_session", return_value=make_session_cm()),
+            patch.object(
+                SafeFetch,
+                "get_content_type",
+                new=AsyncMock(return_value=("text/html", None, "http://www.example.com/landing")),
+            ),
+            patch.object(SafeFetch, "fetch_raw", new=AsyncMock(return_value=HTML_PAGE)) as mock_raw,
+        ):
+            docs = self._load(["http://example.com/go"])
+
+        mock_raw.assert_awaited_once()
+        self.assertEqual(mock_raw.await_args.args[0], "http://www.example.com/landing")
+        self.assertEqual(docs[0].metadata["source"], "http://www.example.com/landing")
+        self.assertIn("Hello world", docs[0].page_content)
+
+    def test_redirect_log_redacts_server_controlled_url_but_source_keeps_it(self) -> None:
+        """Tests that a presigned redirect target is logged without its query while the Document source keeps it.
+
+        Logs must not persist a bearer token chosen by the server; the source metadata needs the
+        full URL so the document can be fetched again from where it lives.
+        """
+        final: str = "http://files.example.com/landing?X-Amz-Signature=secret-token"
+        with (
+            patch.object(SafeFetch, "open_session", return_value=make_session_cm()),
+            patch.object(SafeFetch, "get_content_type", new=AsyncMock(return_value=("text/html", None, final))),
+            patch.object(SafeFetch, "fetch_raw", new=AsyncMock(return_value=HTML_PAGE)),
+        ):
+            with self.assertLogs("neuro_san_studio.coded_tools.webpage_rag", level="INFO") as logs:
+                docs = self._load(["http://example.com/go"])
+
+        joined: str = "\n".join(logs.output)
+        self.assertNotIn("secret-token", joined)
+        self.assertIn("redirected to http://files.example.com/landing?[redacted]", joined)
+        self.assertEqual(docs[0].metadata["source"], final)
+
+ 
```

---

### Incident Patch 6: `5cc2df7d` (2026-09-29)
**Commit Message**: Merge pull request #1448 from cognizant-ai-lab/fix/1446-fetch-from-final-url

#1446: Fetch from the redirect target and record it in WebFetch and WebpageRag

**File**: `neuro_san_studio/coded_tools/utils/safe_fetch.py` (modified, +64/-19)
```diff
@@ -33,8 +33,10 @@
 from aiohttp import ClientSession
 from aiohttp import ClientTimeout
 from aiohttp import DummyCookieJar
+from aiohttp import RequestInfo
 from aiohttp import TCPConnector
 from bs4 import BeautifulSoup
+from yarl import URL
 
 from neuro_san_studio.coded_tools.utils.global_only_resolver import GlobalOnlyResolver
 from neuro_san_studio.coded_tools.utils.pdf_utils import PDF_HEADER_WINDOW
@@ -103,6 +105,10 @@ class delegates to it. Ordinary hostnames are validated at connection time by
     oversized body. A PDF download is also sniffed for a "%PDF-" header within its
     first PDF_HEADER_WINDOW bytes and refused (not_a_pdf) before the rest is read.
 
+    Every URL named in an error message is reduced to scheme, host and path
+    (UrlPolicy.redact_for_log): redirect targets are server-controlled and routinely carry a
+    bearer credential in their query string, and these messages end up in logs.
+
     Error types (raised as ValueError or aiohttp.ClientResponseError or aiohttp.ClientError with the specified message)
         invalid_input            – URL is missing, not a valid http/https URL, or a parameter has an invalid type.
         url_too_long             – URL exceeds MAX_URL_LENGTH characters.
@@ -313,16 +319,18 @@ async def _open_following_redirects(
                 # requests from this host (DoS, or probing the SSRF policy hop by hop).
                 if redirects_followed >= MAX_REDIRECTS:
                     raise ValueError(
-                        f"url_not_allowed: '{url}' exceeded MAX_REDIRECTS ({MAX_REDIRECTS}) redirects "
-                        f"(last hop '{current_url}' answered {status})."
+                        f"url_not_allowed: '{UrlPolicy.redact_for_log(url)}' exceeded MAX_REDIRECTS "
+                        f"({MAX_REDIRECTS}) redirects (last hop '{UrlPolicy.redact_for_log(current_url)}' "
+                        f"answered {status})."
                     )
                 # 304 Not Modified and any other 3xx without a Location cannot be
                 # followed. Refuse rather than fall through and hand the redirect
                 # page's own body to the caller as if it were the resource.
                 location: str = (response.headers.get("Location") or "").strip()
                 if not location:
                     raise ValueError(
-                        f"url_not_allowed: '{url}' answered {status} at '{current_url}' without a Location header."
+                        f"url_not_allowed: '{UrlPolicy.redact_for_log(url)}' answered {status} at "
+                        f"'{UrlPolicy.redact_for_log(current_url)}' without a Location header."
                     )
             # The hop's response context has now been exited, so its connection is
             # released (back to the pool, or closed) before the next request is made
@@ -344,17 +352,21 @@ async def _open_following_redirects(
                 # caller's URL was fine; the server pointed somewhere this policy
                 # refuses, so surface every hop failure uniformly as url_not_allowed
                 # and keep the inner reason for diagnosis.
+                # next_url is the raw, unvalidated Location the server chose: it may be any scheme
+                # and may carry a credential in its query, so it is named in redacted form only.
                 raise ValueError(
-                    f"url_not_allowed: '{url}' redirects to '{next_url}' ({status}), which failed validation: {exc}"
+                    f"url_not_allowed: '{UrlPolicy.redact_for_log(url)}' redirects to "
+                    f"'{UrlPolicy.redact_for_log(next_url)}' ({status}), which failed validation: {exc}"
                 ) from exc
             # Refuse https -> http downgrade hops. The session stores no cookies and
             # sends no credentials, but the URL itself can carry a bearer secret (a
             # presigned S3/Azure query string), and the server chooses the Location,
             # so a downgrade hop could deliberately put that secret on plaintext.
             if urlparse(current_url).scheme.lower() == "https" and urlparse(validated_next).scheme.lower() == "http":
                 raise ValueError(
-                    f"url_not_allowed: '{url}' redirects from https '{current_url}' to http '{validated_next}' "
-                    f"({status}); downgrade redirects are not followed."
+                    f"url_not_allowed: '{UrlPolicy.redact_for_log(url)}' redirects from https "
+                    f"'{UrlPolicy.redact_for_log(current_url)}' to http "
+                    f"'{UrlPolicy.redact_for_log(validated_next)}' ({status}); downgrade redirects are not followed."
                 )
             current_url = validated_next
             redirects_followed += 1
@@ -546,7 +558,7 @@ def check_content_length(content_length_header: str | None, url: str) -> None:
         Raise response_too_large if a Content-Length header exceeds MAX_RESPONSE_BYTES.
 
         :param con
```

**File**: `neuro_san_studio/coded_tools/utils/url_policy.py` (modified, +105/-0)
```diff
@@ -16,12 +16,14 @@
 
 """URL-level SSRF policy (scheme, length, hostname canonicalization, domain rules) behind SafeFetch."""
 
+import re
 from ipaddress import IPv4Address
 from ipaddress import IPv6Address
 from ipaddress import ip_address
 from typing import Any
 from urllib.parse import ParseResult
 from urllib.parse import urlparse
+from urllib.parse import urlunparse
 
 import idna
 from aiohttp.helpers import is_ip_address
@@ -38,6 +40,14 @@
 # literals are validated separately; a genuine hostname containing anything outside
 # this set means IDNA could not canonicalize it and it is not a usable DNS name.
 HOSTNAME_ALLOWED_CHARS: frozenset[str] = frozenset("abcdefghijklmnopqrstuvwxyz0123456789.-_")
+# A URL with an authority ("scheme://...") embedded in free text, such as an error message. Any
+# scheme is matched, not only http(s), and the match runs to the next whitespace: a URL may itself
+# contain quotes or brackets, so stopping at one would leave its query behind. Whatever quoting or
+# punctuation the surrounding text closed the URL with is peeled off again in _redact_match.
+# Case-insensitive because validate_url accepts an upper-case scheme and hands the spelling on.
+URL_IN_TEXT_PATTERN: re.Pattern[str] = re.compile(r"[a-z][a-z0-9+.-]*://\S+", re.IGNORECASE)
+# Characters that surrounding prose may attach to the end of a quoted URL; they are not part of it.
+URL_TRAILING_CHARS: frozenset[str] = frozenset(".,;:)]>'\"")
 
 
 class UrlPolicy:
@@ -286,3 +296,98 @@ def validate_domain_list(value: Any, param_name: str) -> list[str]:
                     f"but contains non-string element {item!r}."
                 )
         return value
+
+    @staticmethod
+    def redact_for_log(url: str) -> str:
+        """
+        Return a URL reduced to scheme, host and path, for log lines.
+
+        Redirect targets are server-controlled and routinely carry bearer credentials in the
+        query string (presigned object-store links, signed CDN URLs) or, rarely, in userinfo.
+        A log line that records such a URL verbatim persists the credential for as long as the
+        logs live. This keeps what identifies the resource and replaces the query with a fixed
+        marker, so a reader can still tell one was present; the fragment and any userinfo are
+        dropped.
+
+        :param url: The URL to redact. Usually one that passed validate_url, but a raw redirect
+                    Location of any scheme is accepted too; a string urlparse rejects is cut at
+                    its first "?" or "#" instead.
+        :return: The redacted URL, e.g. "https://files.example.com/report.pdf?[redacted]".
+        """
+        try:
+            parsed: ParseResult = urlparse(url)
+            port: int | None = parsed.port
+        except ValueError:
+            return UrlPolicy._redact_unparseable(url)
+        host: str = parsed.hostname or ""
+        # urlparse strips the brackets from an IPv6 literal; put them back so the log stays a URL.
+        if ":" in host:
+            host = f"[{host}]"
+        if port is not None:
+            host = f"{host}:{port}"
+        query: str = "[redacted]" if parsed.query else ""
+        return urlunparse((parsed.scheme, host, parsed.path, "", query, ""))
+
+    @staticmethod
+    def redact_urls_in_text(text: str) -> str:
+        """
+        Redact every URL with an authority embedded in free text, for log lines that quote an error message.
+
+        SafeFetch's translated errors interpolate the URL they were given, and for a body fetch
+        that is the server-controlled redirect target; a log line that quotes such a message
+        would leak a presigned token exactly as logging the URL itself would. Every match is
+        replaced by its redact_for_log form.
+
+        :param text: The text to scan, typically str(exception).
+        :return: The text with every embedded URL reduced to scheme, host and path.
+        """
+        return URL_IN_TEXT_PATTERN.sub(UrlPolicy._redact_match, text)
+
+    @staticmethod
+    def _redact_match(match: re.Match[str]) -> str:
+        """
+        Redact one URL found by URL_IN_TEXT_PATTERN, keeping sentence punctuation that followed it.
+
+        :param match: The regex match holding the URL (and possibly a trailing "." or ",").
+        :return: The redacted URL followed by whatever punctuation the match swallowed.
+        """
+        url: str = match.group(0)
+        trailing: str = ""
+        # The pattern runs to whitespace, so closing quotes, brackets and sentence punctuation
+        # that belong to the prose end up inside the match; peel them off, redact, re-append.
+        while url and url[-1] in URL_TRAILING_CHARS:
+            trailing = url[-1] + trailing
+            url = url[:-1]
+        return UrlPolicy.redact_for_log(url) + trailing
+
+    @staticmethod
+    def _redact_unparseable(url: str) -> str:
+        """
+        Redact a URL that urlparse rejected, by text, keeping enou
```

**File**: `neuro_san_studio/coded_tools/web_fetch.py` (modified, +33/-10)
```diff
@@ -23,6 +23,7 @@
 from neuro_san.interfaces.coded_tool import CodedTool
 
 from neuro_san_studio.coded_tools.utils.safe_fetch import SafeFetch
+from neuro_san_studio.coded_tools.utils.url_policy import UrlPolicy
 
 MAX_CHARS: int = 20_000
 SUPPORTED_CONTENT_TYPES: set[str] = {
@@ -54,7 +55,8 @@ class WebFetch(CodedTool):
     (anti DNS-rebinding), redirects are followed up to SafeFetch's MAX_REDIRECTS
     hops with every hop re-validated as a brand-new URL (including this tool's own
     allowed_domains / blocked_domains, which are forwarded to SafeFetch for that
-    purpose), and response sizes are capped. HTML is stripped with BeautifulSoup;
+    purpose), the body is fetched from the chain's final URL (reported as
+    "final_url"), and response sizes are capped. HTML is stripped with BeautifulSoup;
     PDF bodies are sniffed for a "%PDF-" header while streaming, then parsed with
     pypdf. Use allowed_domains / blocked_domains for stricter control.
 
@@ -92,7 +94,11 @@ async def async_invoke(self, args: dict[str, Any], sly_data: dict[str, Any]) ->
 
         :return:
             A dictionary with the following keys:
-                "url"          (str): The URL that was fetched.
+                "url"          (str): The URL that was requested.
+                "final_url"    (str): The URL the probe ended on after redirects, and the URL
+                                      the body fetch started from (equal to "url" when there
+                                      were none). A redirect that appears only at fetch time
+                                      is followed under the same rules but is not reported here.
                 "content"      (str): Plain-text body of the fetched page.
                 "retrieved_at" (str): ISO-8601 UTC timestamp when the content was retrieved.
 
@@ -117,10 +123,25 @@ async def async_invoke(self, args: dict[str, Any], sly_data: dict[str, Any]) ->
             content_type, prefetched_text, final_url = await SafeFetch.get_content_type(
                 url, session, allowed_domains=allowed_domains, blocked_domains=blocked_domains
             )
-            # Classify by the URL the headers actually came from: a link that redirects
-            # to a .pdf served as a generic download type is a PDF even though the
-            # requested URL carries no .pdf suffix. The fetch below still starts from
-            # the requested URL and re-validates every hop.
+            # Log the redirect before fetching, so the requested -> final link is on record
+            # even when the body fetch below fails: SafeFetch's error message names only the
+            # URL it was given, which is now final_url rather than the one logged above. The
+            # target is server-controlled and may be a presigned URL carrying a bearer token
+            # in its query, so it is logged redacted (scheme, host, path only).
+            if final_url != url:
+                logger.info("WebFetch: %s redirected to %s", url, UrlPolicy.redact_for_log(final_url))
+            # Classify by the URL the headers actually came from, and fetch from it too.
+            # A link that redirects to a .pdf served as a generic download type is a PDF
+            # even though the requested URL carries no .pdf suffix. Starting the body
+            # fetch at final_url instead of the requested URL avoids walking the redirect
+            # chain a second time and keeps the body and the classification from the same
+            # place: a rotating or expiring redirect could otherwise send the second walk
+            # elsewhere and hand a PDF body to the HTML stripper (or the reverse). One
+            # window remains: a redirect that appears only at fetch time is followed by
+            # SafeFetch under the same rules, but its fetch methods return the body alone,
+            # so final_url stays the probe's terminal URL. Nothing is skipped by this: the
+            # probe re-validated every hop under the same domain rules, and the fetch
+            # re-validates final_url at entry again.
             is_pdf: bool = SafeFetch.is_pdf(content_type, final_url)
 
             if not is_pdf and not self._is_supported_content_type(content_type):
@@ -134,23 +155,25 @@ async def async_invoke(self, args: dict[str, Any], sly_data: dict[str, Any]) ->
                 # Note: passing the PDF as base64 directly to the model would be
                 # preferable once neuro-san supports multimodal input.
                 text: str = await SafeFetch.fetch_pdf_text(
-                    url, session, allowed_domains=allowed_domains, blocked_domains=blocked_domains
+                    final_url, session, allowed_domains=allowed_domains, blocked_domains=blocked_domains
                 )
             elif prefetched_text is not None:
                 # Body was already fetched during the 405 HEAD fallback GET; no second request needed.
                 text = SafeFetch.parse_raw_text(prefetched_text
```

**File**: `neuro_san_studio/coded_tools/webpage_rag.py` (modified, +31/-11)
```diff
@@ -31,6 +31,7 @@
 from neuro_san_studio.coded_tools.base_rag import BaseRag
 from neuro_san_studio.coded_tools.base_rag import PostgresConfig
 from neuro_san_studio.coded_tools.utils.safe_fetch import SafeFetch
+from neuro_san_studio.coded_tools.utils.url_policy import UrlPolicy
 
 logging.basicConfig(level=logging.INFO)
 logger = logging.getLogger(__name__)
@@ -46,7 +47,8 @@ class WebpageRag(CodedTool, BaseRag):
     Content is downloaded through the shared SSRF-hardened fetch path (SafeFetch):
     private/loopback/reserved hosts are rejected, DNS records are validated at
     connection time (anti DNS-rebinding), redirects are followed up to a bounded
-    number of hops with every hop re-validated, and response sizes are capped. Each
+    number of hops with every hop re-validated, the body is fetched from the chain's
+    final URL (recorded as the Document's source), and response sizes are capped. Each
     URL is routed by content type: PDFs are parsed with pypdf
     (via SafeFetch.fetch_pdf_text) and HTML/text is stripped to plain text, so a PDF
     link is ingested as readable text instead of being embedded as binary garbage.
@@ -209,7 +211,10 @@ async def load_documents(self, loader_args: dict[str, Any]) -> list[Document]:
             if isinstance(result, Document):
                 documents.append(result)
             elif result is not None:
-                logger.error("Skipped a URL after an unexpected error: %r", result)
+                # Same redaction as the per-URL catch: the message may quote the fetched URL.
+                logger.error(
+                    "Skipped a URL after an unexpected error: %s", UrlPolicy.redact_urls_in_text(repr(result))
+                )
         return documents
 
     async def _load_single(self, url: str, session: ClientSession, semaphore: Semaphore) -> Document | None:
@@ -243,14 +248,26 @@ async def _load_single(self, url: str, session: ClientSession, semaphore: Semaph
                 prefetched_text: str | None
                 final_url: str
                 content_type, prefetched_text, final_url = await SafeFetch.get_content_type(validated_url, session)
-
-                # Classify by the URL the headers came from (after redirects), so a link
-                # that redirects to a .pdf served as a generic download type is parsed
-                # as a PDF. The source metadata below still records the requested URL.
+                # The redirect target is server-controlled and may be a presigned URL carrying a
+                # bearer token in its query, so it is logged redacted (scheme, host, path only).
+                if final_url != validated_url:
+                    logger.info("%s redirected to %s", validated_url, UrlPolicy.redact_for_log(final_url))
+
+                # Classify by the URL the headers came from (after redirects), fetch from
+                # it, and record it as the source. A link that redirects to a .pdf served
+                # as a generic download type is parsed as a PDF. Fetching from final_url
+                # avoids a second walk of the redirect chain and keeps the body and the
+                # classification from the same place (the probe re-validated every hop,
+                # and the fetch re-validates final_url at entry). Recording final_url as
+                # the source means citations point at the document, not the redirector,
+                # and two configured links to one document collapse to one source. The
+                # source is the probe's terminal URL: a redirect that appears only at fetch
+                # time is followed by SafeFetch under the same rules, but its fetch methods
+                # return the body alone, so it is not reflected here.
                 if SafeFetch.is_pdf(content_type, final_url):
-                    pdf_text: str = await SafeFetch.fetch_pdf_text(validated_url, session)
+                    pdf_text: str = await SafeFetch.fetch_pdf_text(final_url, session)
                     # PDFs carry no HTML metadata; record only the source.
-                    return Document(page_content=pdf_text, metadata={"source": validated_url})
+                    return Document(page_content=pdf_text, metadata={"source": final_url})
 
                 # An empty/missing Content-Type is treated as text rather than skipped:
                 # WebBaseLoader (the loader this replaces) fetched regardless of type,
@@ -268,22 +285,25 @@ async def _load_single(self, url: str, session: ClientSession, semaphore: Semaph
                 if prefetched_text is not None:
                     raw = prefetched_text
                 else:
-                    raw = await SafeFetch.fetch_raw(validated_url, session)
+                    raw = await SafeFetch.fetch_raw(final_url, session)
 
                 # BeautifulSoup parsing is blocking CPU work. Calling it directly would
                 # occupy the single event-loop thread for its whole duration and freeze
           
```

**File**: `requirements.txt` (modified, +4/-0)
```diff
@@ -24,6 +24,10 @@ aiohttp>=3.13.0,<4.0
 # imports it directly and relies on yarl-matching UTS#46 behavior.
 idna>=3.0
 
+# aiohttp's URL type, used to hand a translated ClientResponseError a redacted RequestInfo in
+# SafeFetch. Already required by aiohttp; declared here because SafeFetch imports it directly.
+yarl>=1.9
+
 # For HTML parsing
 beautifulsoup4>=4.12.0
 
```

**File**: `tests/neuro_san_studio/coded_tools/test_web_fetch.py` (modified, +53/-4)
```diff
@@ -36,7 +36,7 @@ def setUp(self):
         self.sly_data: dict = {}
 
     def test_html_fetch_returns_correct_keys(self):
-        """Tests that fetching an HTML page returns a result with url, content, and retrieved_at keys."""
+        """Tests that an HTML fetch returns url, final_url, content and retrieved_at keys."""
         with (
             patch.object(
                 SafeFetch, "get_content_type", new=AsyncMock(return_value=("text/html", None, "http://example.com"))
@@ -46,6 +46,7 @@ def test_html_fetch_returns_correct_keys(self):
             result = asyncio.run(self.tool.async_invoke({"url": "http://example.com"}, self.sly_data))
 
         self.assertEqual(result["url"], "http://example.com")
+        self.assertEqual(result["final_url"], "http://example.com")
         self.assertEqual(result["content"], "Hello world")
         self.assertIn("retrieved_at", result)
 
@@ -99,8 +100,9 @@ def test_redirected_pdf_is_classified_by_final_url(self) -> None:
         """A link without a .pdf suffix that redirects to a .pdf served as a generic download type is parsed as PDF.
 
         The suffix fallback must look at the URL the headers came from, not the
-        requested one. The PDF fetch itself still starts from the requested URL so
-        every hop is re-validated on the way down, and the result keeps that URL.
+        requested one. The PDF fetch then starts from that final URL (one walk of the
+        redirect chain, body and classification from the same place); the result keeps
+        the requested URL as "url" and reports the fetched one as "final_url".
         """
         requested: str = "http://example.com/download?id=42"
         final: str = "http://cdn.example.com/files/report.pdf"
@@ -113,9 +115,56 @@ def test_redirected_pdf_is_classified_by_final_url(self) -> None:
             result = asyncio.run(self.tool.async_invoke({"url": requested}, self.sly_data))
 
         mock_pdf.assert_awaited_once()
-        self.assertEqual(mock_pdf.await_args.args[0], requested)
+        self.assertEqual(mock_pdf.await_args.args[0], final)
         self.assertEqual(result["content"], "PDF content")
         self.assertEqual(result["url"], requested)
+        self.assertEqual(result["final_url"], final)
+
+    def test_redirected_text_page_is_fetched_from_final_url_with_domain_rules(self) -> None:
+        """Tests that a redirected HTML page is fetched from the probe's final URL, with the domain rules forwarded.
+
+        The redirect chain is walked once (by the probe), so the body comes from the
+        same place the classification did. "url" stays the requested URL so the caller
+        can match the result to its request; "final_url" says where the content came
+        from. The allow-list must still reach the fetch, which re-validates final_url.
+        """
+        requested: str = "http://example.com/go"
+        final: str = "http://www.example.com/landing"
+        with (
+            patch.object(SafeFetch, "get_content_type", new=AsyncMock(return_value=("text/html", None, final))),
+            patch.object(SafeFetch, "fetch_text", new=AsyncMock(return_value="Landed")) as mock_text,
+        ):
+            result = asyncio.run(
+                self.tool.async_invoke({"url": requested, "allowed_domains": ["example.com"]}, self.sly_data)
+            )
+
+        mock_text.assert_awaited_once()
+        self.assertEqual(mock_text.await_args.args[0], final)
+        self.assertEqual(mock_text.await_args.kwargs["allowed_domains"], ["example.com"])
+        self.assertEqual(result["url"], requested)
+        self.assertEqual(result["final_url"], final)
+        self.assertEqual(result["content"], "Landed")
+
+    def test_redirect_logs_redact_server_controlled_url(self) -> None:
+        """Tests that a presigned redirect target is logged without its query, while the result keeps the full URL.
+
+        The redirect target is chosen by the server and may carry a bearer token in its query
+        string; log lines must not persist it. The agent still receives the full final URL,
+        which it needs to cite the document.
+        """
+        requested: str = "http://example.com/report"
+        final: str = "http://files.example.com/report.pdf?X-Amz-Signature=secret-token"
+        with (
+            patch.object(SafeFetch, "get_content_type", new=AsyncMock(return_value=("application/pdf", None, final))),
+            patch.object(SafeFetch, "fetch_pdf_text", new=AsyncMock(return_value="PDF content")),
+        ):
+            with self.assertLogs("WebFetch", level="INFO") as logs:
+                result = asyncio.run(self.tool.async_invoke({"url": requested}, self.sly_data))
+
+        joined: str = "\n".join(logs.output)
+        self.assertNotIn("secret-token", joined)
+        self.assertIn("redirected to http://files.example.com/report.pdf?[redacted]", joined)
+        self.assertEqual(result["final_url"], final)
 
     def test_redirected_generic_download_with
```

**File**: `tests/neuro_san_studio/coded_tools/test_webpage_rag.py` (modified, +88/-12)
```diff
@@ -99,14 +99,29 @@ async def cancel_mid_flight_load(tool: WebpageRag) -> None:
     await task
 
 
-class TestWebpageRag(TestCase):
+class TestWebpageRag(TestCase):  # pylint: disable=too-many-public-methods
     """Unit tests for WebpageRag: SSRF-hardened loading, PDF/HTML routing, input guards."""
 
     def setUp(self):
         # Bypass BaseRag.__init__, which instantiates OpenAIEmbeddings and therefore
         # requires an OPENAI_API_KEY; these tests never embed or build a store.
         self.tool = object.__new__(WebpageRag)
 
+    @staticmethod
+    async def _probe_as_text(url: str, _session: Any) -> tuple[str, None, str]:
+        """
+        Stand in for get_content_type: report text/html with no redirect, echoing the requested URL as final.
+
+        Multi-URL tests need this rather than a fixed return value: since the fetch and the
+        Document source follow the probe's final URL, a fixed final URL would make every
+        page in the batch fetch from and be attributed to the same address.
+
+        :param url: The URL being probed.
+        :param _session: The shared session; unused.
+        :return: A ("text/html", None, url) probe result.
+        """
+        return "text/html", None, url
+
     def _load(self, urls: list[str]) -> list:
         """
         Run load_documents with the given URLs against mocked session and bodies.
@@ -193,7 +208,11 @@ def test_pdf_url_suffix_routes_to_fetch_pdf(self):
         self.assertEqual(docs[0].page_content, "PDF from suffix")
 
     def test_redirected_pdf_is_classified_by_final_url(self) -> None:
-        """A URL that redirects to a .pdf served as a generic download type is parsed as PDF via the final URL."""
+        """A URL that redirects to a .pdf served as a generic download type is parsed as PDF via the final URL.
+
+        The PDF is fetched from that final URL and it becomes the Document's source, so
+        the redirect chain is walked once and citations point at the document itself.
+        """
         with (
             patch.object(SafeFetch, "open_session", return_value=make_session_cm()),
             patch.object(
@@ -207,8 +226,73 @@ def test_redirected_pdf_is_classified_by_final_url(self) -> None:
             docs = self._load(["http://example.com/download"])
 
         mock_pdf.assert_awaited_once()
+        self.assertEqual(mock_pdf.await_args.args[0], "http://example.com/files/report.pdf")
         mock_raw.assert_not_awaited()
         self.assertEqual(docs[0].page_content, "PDF after redirect")
+        self.assertEqual(docs[0].metadata, {"source": "http://example.com/files/report.pdf"})
+
+    def test_redirected_html_page_is_fetched_from_and_attributed_to_final_url(self) -> None:
+        """A redirected HTML page is fetched from the URL the probe ended on, and that URL becomes the source.
+
+        One walk of the redirect chain (the probe), then one fetch starting at its end;
+        the source names where the content lives, not the redirector.
+        """
+        with (
+            patch.object(SafeFetch, "open_session", return_value=make_session_cm()),
+            patch.object(
+                SafeFetch,
+                "get_content_type",
+                new=AsyncMock(return_value=("text/html", None, "http://www.example.com/landing")),
+            ),
+            patch.object(SafeFetch, "fetch_raw", new=AsyncMock(return_value=HTML_PAGE)) as mock_raw,
+        ):
+            docs = self._load(["http://example.com/go"])
+
+        mock_raw.assert_awaited_once()
+        self.assertEqual(mock_raw.await_args.args[0], "http://www.example.com/landing")
+        self.assertEqual(docs[0].metadata["source"], "http://www.example.com/landing")
+        self.assertIn("Hello world", docs[0].page_content)
+
+    def test_redirect_log_redacts_server_controlled_url_but_source_keeps_it(self) -> None:
+        """Tests that a presigned redirect target is logged without its query while the Document source keeps it.
+
+        Logs must not persist a bearer token chosen by the server; the source metadata needs the
+        full URL so the document can be fetched again from where it lives.
+        """
+        final: str = "http://files.example.com/landing?X-Amz-Signature=secret-token"
+        with (
+            patch.object(SafeFetch, "open_session", return_value=make_session_cm()),
+            patch.object(SafeFetch, "get_content_type", new=AsyncMock(return_value=("text/html", None, final))),
+            patch.object(SafeFetch, "fetch_raw", new=AsyncMock(return_value=HTML_PAGE)),
+        ):
+            with self.assertLogs("neuro_san_studio.coded_tools.webpage_rag", level="INFO") as logs:
+                docs = self._load(["http://example.com/go"])
+
+        joined: str = "\n".join(logs.output)
+        self.assertNotIn("secret-token", joined)
+        self.assertIn("redirected to http://files.example.com/landing?[redacted]", joined)
+        self.assertEqual(docs[0].metadata["source"], final)
+
+ 
```

**File**: `tests/neuro_san_studio/coded_tools/utils/test_safe_fetch.py` (modified, +68/-0)
```diff
@@ -19,6 +19,7 @@
 # pylint: disable=too-many-lines
 
 import asyncio
+import traceback
 from collections.abc import AsyncIterator
 from collections.abc import Mapping
 from functools import partial
@@ -964,6 +965,73 @@ def test_fetch_raw_redirect_to_non_http_scheme_raises_url_not_allowed(self) -> N
         self.assertIn("invalid_input", error)
         self.assertEqual(calls, [("GET", "http://example.com/start")])
 
+    def test_fetch_raw_refused_location_is_named_without_its_query(self) -> None:
+        """Tests that a refused redirect target with a credential in its query is named in redacted form.
+
+        The Location is chosen by the server and never passed validate_url, so the message
+        names it only as scheme, host and path: these messages end up in logs.
+        """
+        hops = [self._redirect(302, "ftp://files.example.com/a?token=secret")]
+        session, _ = self._make_chain_session(hops)
+        with self.assertRaises(ValueError) as ctx:
+            asyncio.run(SafeFetch.fetch_raw("http://example.com/start", session))
+        error = str(ctx.exception)
+        self.assertNotIn("secret", error)
+        self.assertIn("redirects to 'ftp://files.example.com/a?[redacted]'", error)
+
+    def test_fetch_raw_translated_http_error_names_url_without_its_query(self) -> None:
+        """Tests that a translated HTTP failure carries no query string in its message, its str() or its request info.
+
+        ClientResponseError.__str__ renders request_info.real_url, so redacting the message alone
+        would still leak a presigned query to any caller that logs str(error).
+        """
+        exc = make_response_error(503, url="http://example.com/x?token=secret")
+        session, _ = make_get_response(status=503, raise_for_status_exc=exc)
+        with self.assertRaises(ClientResponseError) as ctx:
+            asyncio.run(SafeFetch.fetch_raw("http://example.com/x?token=secret", session))
+        self.assertNotIn("secret", ctx.exception.message)
+        self.assertIn("for 'http://example.com/x?[redacted]'", ctx.exception.message)
+        self.assertNotIn("secret", str(ctx.exception))
+        self.assertEqual(str(ctx.exception.request_info.real_url), "http://example.com/x?[redacted]")
+        self.assertEqual(ctx.exception.request_info.method, "HEAD")
+        # The chained cause is rendered by traceback logging too; it must carry the redacted URL as well.
+        self.assertIsInstance(ctx.exception.__cause__, ClientResponseError)
+        formatted: str = "".join(traceback.format_exception(ctx.exception))
+        self.assertNotIn("secret", formatted)
+
+    def test_fetch_raw_translated_transport_error_has_no_url_bearing_cause(self) -> None:
+        """Tests that a transport failure whose text quotes the URL is translated without a chained cause.
+
+        aiohttp's own message may quote the URL (InvalidURL does); a traceback log prints the
+        cause verbatim, so the cause is dropped and its class name and redacted text kept instead.
+        """
+        failure = ClientError("boom while connecting to 'http://example.com/x'?token=secret")
+        session = MagicMock()
+        session.get = MagicMock(side_effect=failure)
+        with self.assertRaises(ClientError) as ctx:
+            asyncio.run(SafeFetch.fetch_raw("http://example.com/x?token=secret", session))
+        message: str = str(ctx.exception)
+        self.assertNotIn("secret", message)
+        # The original text names a URL, so it is withheld outright rather than partially redacted.
+        self.assertEqual(
+            message,
+            "url_not_accessible: Could not reach 'http://example.com/x?[redacted]': ClientError: "
+            "[message withheld: it quotes a URL]",
+        )
+        self.assertIsNone(ctx.exception.__cause__)
+        self.assertNotIn("secret", "".join(traceback.format_exception(ctx.exception)))
+
+    def test_fetch_raw_translated_transport_error_keeps_text_that_names_no_url(self) -> None:
+        """Tests that a transport failure whose text names no URL keeps that text for diagnosis."""
+        session = MagicMock()
+        session.get = MagicMock(side_effect=ClientError("connection reset by peer"))
+        with self.assertRaises(ClientError) as ctx:
+            asyncio.run(SafeFetch.fetch_raw("http://example.com/x", session))
+        self.assertEqual(
+            str(ctx.exception),
+            "url_not_accessible: Could not reach 'http://example.com/x': ClientError: connection reset by peer",
+        )
+
     def test_fetch_raw_redirect_without_location_raises_url_not_allowed(self) -> None:
         """Tests that a 3xx with no Location header (e.g. 304) raises url_not_allowed."""
         for status in (304, 302):
```

---

### Incident Patch 7: `72fbbd3e` (2026-09-29)
**Commit Message**: Merge branch 'main' into fix/1446-fetch-from-final-url

**File**: `.lycheeignore` (modified, +4/-0)
```diff
@@ -25,6 +25,10 @@ https://mcp/
 # Login-walled pages that redirect through an auth flow lychee can't resolve
 https://admin.mistral.ai/
 
+# TEMPORARY: serply.io is down (as of 2026-09-29). Remove once the site is back.
+https://serply.io
+https://api.serply.io
+
 # URLs whose base path is not browsable (returns 400 or 404)
 https://raw.githubusercontent.com/anthropics/skills/main/skills/internal-comms/
 https://api.anthropic.com/
```

---

### Incident Patch 8: `b4d933b5` (2026-09-28)
**Commit Message**: #1458: Match the leading pieces with named word lists and a prefix matcher instead of a pattern table

**File**: `middleware/agent_network_designer/persistence/common_instruction_stripper.py` (modified, +82/-69)
```diff
@@ -73,7 +73,10 @@ class CommonInstructionStripper:
     One copy of each is the smallest text that stays the same over any number of saves.
     """
 
-    # One word of a text: what the matching compares, so whitespace never takes part in it.
+    # One word of a text: a run of one or more characters that are not whitespace (\S is "not a space, tab or line
+    # break", + means "one or more"). finditer with it yields the words one by one, with their offsets, and skips
+    # whatever whitespace lies between them. Words are what the matching compares, so indentation and line breaks
+    # never take part in it.
     WORD: re.Pattern[str] = re.compile(r"\S+")
 
     # The most words a network name in a copy of the prefix may span. Names are usually one word, but nothing
@@ -94,28 +97,24 @@ class CommonInstructionStripper:
 
     def __init__(self, aaosa_instructions: str | None) -> None:
         """
-        Prepare the words of each piece.
+        Split each piece into the words its copies are matched by.
 
         :param aaosa_instructions: The AAOSA instructions the save appends to the front man and to agents with
                 tools, from registries/aaosa.hocon, or None to strip none
         """
-        # The pieces a save writes before the custom instructions, as (key, (words before the network name, words
-        # after it)). Only the prefix names the network; the other two are fixed texts, so their second list is
-        # empty and their words are matched as they are.
-        self.leading_pieces: list[tuple[str, tuple[list[str], list[str]]]] = [
-            (
-                self.PREFIX,
-                (
-                    self._words(DesignerCommonInstructions.PREFIX_OPENING),
-                    self._words(DesignerCommonInstructions.PREFIX_RULES),
-                ),
-            ),
-            (self.FRONT_MAN_LINES, (self._words(DesignerCommonInstructions.FRONT_MAN_LINES), [])),
-            (self.DEMO_SENTENCE, (self._words(DesignerCommonInstructions.DEMO_SENTENCE), [])),
-        ]
-        # The AAOSA instructions, the one piece a save writes after the custom instructions. The end of a text is
-        # read backwards (see _trailing_copy), so their words are kept last word first and each spelled backwards.
-        # Empty when there are none to strip.
+        # The three pieces a save writes before the custom instructions. The prefix is the opening words, then the
+        # network name and a period, then the rule lines, so it is kept as two lists and the name is matched
+        # between them (see _prefix_copy). The other two are fixed texts.
+        self.prefix_opening: list[str] = self._words(DesignerCommonInstructions.PREFIX_OPENING)
+        self.prefix_rules: list[str] = self._words(DesignerCommonInstructions.PREFIX_RULES)
+        self.front_man_lines: list[str] = self._words(DesignerCommonInstructions.FRONT_MAN_LINES)
+        self.demo_sentence: list[str] = self._words(DesignerCommonInstructions.DEMO_SENTENCE)
+        # The AAOSA instructions, the one piece a save writes after the custom instructions, kept last word first
+        # with each word spelled backwards. A copy can only be at the end of the text, and the text can be long (a
+        # front man that grew over many saves holds many copies), so the whole of it must not be read to find one.
+        # Regular expressions only scan forwards, so the end is examined by reversing its last characters and
+        # matching from the start of that reversed string (see _trailing_copy), and the words to compare with have
+        # to be reversed the same way. Empty when there are none to strip.
         self.reversed_aaosa: list[str] = self._reversed_words(aaosa_instructions)
         # How many characters _trailing_copy first reads from the end: twice a copy of the AAOSA instructions with
         # single spaces, so a copy with the indentation of registries/aaosa.hocon fits in one read.
@@ -202,13 +201,13 @@ def _strip_copies(self, instructions: str) -> tuple[int, int, dict[str, tuple[in
         found: bool = True
         while found:
             found = False
-            for piece, pattern in self.leading_pieces:
-                copy: tuple[int, int] | None = self._leading_copy(instructions, start, end, pattern)
+            for piece in (self.PREFIX, self.FRONT_MAN_LINES, self.DEMO_SENTENCE):
+                copy: tuple[int, int] | None = self._leading_copy(piece, instructions, start, end)
                 while copy is not None:
                     first_copies.setdefault(piece, copy)
                     start = copy[1]
                     found = True
-                    copy = self._leading_copy(instructions, start, end, pattern)
+                    copy = self._leading_copy(piece, instructions, start, end)
             if self.reversed_aaosa:
                 copy = self._trailing_copy(instructions, start, end)
                 while copy is not None:
@@ -218,66 +217,80 @@ def _strip_c
```

---

### Incident Patch 9: `bbbea437` (2026-09-28)
**Commit Message**: Merge branch 'main' into fix/1458-unwrap-designer-instructions

**File**: `AGENTS.md` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ Rules for coding agents in Neuro-san-studio. Follow them and the §4 gates pass
   `asyncio.to_thread()`.
 - Use `snake_case` for functions, methods, variables, parameters and attributes, `PascalCase` for classes, and
   `UPPER_CASE` for constants. Comment the reason if an external API forces `camelCase`.
+- Annotate a method that returns `self` or `cls(...)` with `typing.Self`, not its class name, and do not add
+  `from __future__ import annotations`; the Python floor is 3.12.
 - Dictionary access uses `.get()`, never `dict[key]`.
 - Catch specific exceptions that can be handled at that level; never a generalized `Exception`.
 - Never fail silently. Report a missing or unreadable file, malformed input or an unknown choice with the full
```

**File**: `middleware/persistent_memory/mem0_store.py` (modified, +0/-2)
```diff
@@ -59,8 +59,6 @@
 ``suggestion`` attributes intact.
 """
 
-from __future__ import annotations
-
 import os
 from typing import Any
 from typing import Awaitable
```

**File**: `neuro_san_studio/plugins/log_bridge/process_log_bridge.py` (modified, +0/-2)
```diff
@@ -13,8 +13,6 @@
 # limitations under the License.
 #
 # END COPYRIGHT
-from __future__ import annotations
-
 import copy
 import json
 import logging
```

**File**: `tests/middleware/persistent_memory/base.py` (modified, +0/-2)
```diff
@@ -16,8 +16,6 @@
 
 """Shared ``TestCase`` base for persistent-memory tests."""
 
-from __future__ import annotations
-
 import shutil
 import tempfile
 from typing import Any
```

**File**: `tests/middleware/persistent_memory/should_summarize.py` (modified, +0/-2)
```diff
@@ -16,8 +16,6 @@
 
 """Test helper: a callable that mirrors ``TopicSummarizer.should_summarize``."""
 
-from __future__ import annotations
-
 
 class ShouldSummarize:  # pylint: disable=too-few-public-methods
     """Callable wrapping the ``max_topic_size`` threshold used in tests.
```

**File**: `tests/middleware/persistent_memory/test_json_file_store.py` (modified, +0/-2)
```diff
@@ -16,8 +16,6 @@
 
 """Round-trip + edge-case tests for ``JsonFileStore``."""
 
-from __future__ import annotations
-
 import asyncio
 import json
 from pathlib import Path
```

**File**: `tests/middleware/persistent_memory/test_markdown_file_store.py` (modified, +0/-2)
```diff
@@ -16,8 +16,6 @@
 
 """Behaviour tests for ``MarkdownFileStore``."""
 
-from __future__ import annotations
-
 import asyncio
 from pathlib import Path
 from typing import Optional
```

**File**: `tests/middleware/persistent_memory/test_mem0_store.py` (modified, +0/-2)
```diff
@@ -22,8 +22,6 @@
 the CRUD outcomes.
 """
 
-from __future__ import annotations
-
 import asyncio
 import os
 from typing import Any
```

---

### Incident Patch 10: `74eff4c6` (2026-09-28)
**Commit Message**: Merge branch 'main' into fix/1446-fetch-from-final-url

**File**: `.github/workflows/checkmarx.yml` (modified, +19/-21)
```diff
@@ -1,31 +1,29 @@
 ---
 name: Checkmarx One
 
-permissions:
-    contents: read
-    security-events: write
-
 on:
     schedule:
         # M-F at 3:00 am UTC (offset from neuro-san and neuro-san-ui)
         - cron: "0 3 * * 1-5"
     workflow_dispatch:
+    release:
+        types:
+            - published
 
 jobs:
-    checkmarx-scan:
-        runs-on: ubuntu-latest
-        steps:
-            - name: Checkout repository
-              # v6.0.2
-              uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
-              with:
-                  fetch-depth: 0
-
-            - name: Run Checkmarx One scan
-              # build-common 1.0.12
-              uses: cognizant-ai-lab/build-common/actions/checkmarx-one@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
-              with:
-                  base-uri: ${{ vars.CX_BASE_URI }}
-                  cx-tenant: ${{ vars.CX_TENANT }}
-                  cx-client-id: ${{ vars.CX_CLIENT_ID }}
-                  cx-client-secret: ${{ secrets.CX_CLIENT_SECRET }}
+    checkmarx:
+        # 1.0.12
+        uses: cognizant-ai-lab/build-common/.github/workflows/_checkmarx.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+        with:
+            # 1.0.12
+            build-common-ref: "3f4cdab31b6ac10382c99452b720eb0b8b2dab8f"
+            base-uri: ${{ vars.CX_BASE_URI }}
+            cx-tenant: ${{ vars.CX_TENANT }}
+            cx-client-id: ${{ vars.CX_CLIENT_ID }}
+            scan-params: '--sast-preset-name "Checkmarx Default" --threshold "sast-critical=1;sast-high=1"'
+        secrets:
+            CX_CLIENT_SECRET: ${{ secrets.CX_CLIENT_SECRET }}
+            SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
+        permissions:
+            contents: write
+            security-events: write
```

**File**: `AGENTS.md` (modified, +2/-0)
```diff
@@ -33,6 +33,8 @@ Rules for coding agents in Neuro-san-studio. Follow them and the §4 gates pass
   `asyncio.to_thread()`.
 - Use `snake_case` for functions, methods, variables, parameters and attributes, `PascalCase` for classes, and
   `UPPER_CASE` for constants. Comment the reason if an external API forces `camelCase`.
+- Annotate a method that returns `self` or `cls(...)` with `typing.Self`, not its class name, and do not add
+  `from __future__ import annotations`; the Python floor is 3.12.
 - Dictionary access uses `.get()`, never `dict[key]`.
 - Catch specific exceptions that can be handled at that level; never a generalized `Exception`.
 - Never fail silently. Report a missing or unreadable file, malformed input or an unknown choice with the full
```

**File**: `coded_tools/tools/video_describer.py` (removed, +0/-95)
```diff
@@ -1,95 +0,0 @@
-# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-#
-# END COPYRIGHT
-
-import base64
-import logging
-from typing import Any
-
-# pylint: disable=import-error
-import cv2
-from langchain_core.messages import HumanMessage
-from langchain_openai import ChatOpenAI
-from neuro_san.interfaces.coded_tool import CodedTool
-
-INSTRUCTIONS = "Describe the content of the video in detail."
-
-
-class VideoDescriber(CodedTool):
-    """
-    A CodedTool implementation for invoking OpenAI model to describe a generated video.
-    """
-
-    def __init__(self):
-        self.logger = logging.getLogger(__name__)
-
-    async def async_invoke(self, args: dict[str, Any], sly_data: dict[str, Any]) -> str:
-        """
-        :param args: An argument dictionary whose keys are the parameters
-                to the coded tool and whose values are the values passed for them
-                by the calling agent or user. This dictionary is to be treated as read-only.
-
-                The argument dictionary expects the following keys:
-                - from calling agent
-                    - "file_path" (str): Path to the video file to be described.
-                - from user
-                    - "openai_model" (str): OpenAI model to call the tool. Default to gpt-4o.
-
-        :param sly_data: A dictionary whose keys are defined by the agent hierarchy,
-                but whose values are meant to be kept out of the chat stream.
-
-        :return: Text string describing the video.
-        """
-
-        # Get file_path from args
-        file_path: str = args.get("file_path")
-        if not file_path:
-            raise ValueError("No file_path provided!!!")
-
-        # User-defined arguments
-        openai_model: str = args.get("openai_model", "gpt-4o")
-
-        # Read video and extract frames
-        video = cv2.VideoCapture(file_path)
-        base64_frames: list[str] = []
-        while video.isOpened():
-            success, frame = video.read()
-            if not success:
-                break
-            _, buffer = cv2.imencode(".jpg", frame)
-            base64_frames.append(base64.b64encode(buffer).decode("utf-8"))
-
-        video.release()
-        self.logger.info("%d frames read from %s.", len(base64_frames), file_path)
-
-        llm = ChatOpenAI(model=openai_model)
-        content = [
-            {
-                "type": "text",
-                "text": f"{INSTRUCTIONS}",
-            },
-            *[
-                {
-                    "type": "image",
-                    "base64": f"{frame}",
-                    "mime_type": "image/jpeg",
-                }
-                for frame in base64_frames
-            ],
-        ]
-
-        message = HumanMessage(content=content)
-        response = await llm.ainvoke([message])
-        return response.text
```

**File**: `docs/examples.md` (modified, +0/-11)
```diff
@@ -31,7 +31,6 @@ Here are a few examples ordered by level of complexity.
     - [Anthropic Web Search](#anthropic-web-search)
     - [OpenAI Code Interpreter](#openai-code-interpreter)
     - [OpenAI Image Generation](#openai-image-generation)
-    - [OpenAI Video Generation](#openai-video-generation)
     - [OpenAI Web Search](#openai-web-search)
     - [Google Maps](#google-maps)
     - [Gemini Image Generation](#gemini-image-generation)
@@ -263,16 +262,6 @@ for generated images.
 
 **Tags:** `tool`, `image`, `OpenAI`
 
-### OpenAI Video Generation
-
-[OpenAI Video Generation](examples/tools/openai_video_generation.md) is a multi-agent system that allows users to
-create, remix, and describe videos through natural language commands. It consists of a Video Generator agent that
-coordinates with two tools: an OpenAI video generation tool (using Sora models) that creates videos from text prompts
-with configurable durations and resolutions, and a Video Describer tool that analyzes video content by extracting
-frames and generating detailed descriptions using vision-capable language models.
-
-**Tags:** `tool`, `video`, `OpenAI`
-
 ### OpenAI Web Search
 
 [OpenAI Web Search](examples/tools/openai_web_search.md) is a task-oriented agentic system designed to help users search
```

**File**: `docs/examples/agent_network_designer.md` (modified, +6/-1)
```diff
@@ -352,11 +352,16 @@ back, so the block survives a save the same way the definition and the name do:
 other key are written as sent, `sample_queries` is replaced only when `agent_network_query_generator` ran on
 that turn, and in file mode `date_created` is stamped once and `date_modified` on every save. A temporary
 network gets no studio dates in its deployed spec (neuro-san records `stored_at`), but the HOCON text returned
-for download always carries a `date_created`, as a saved file would. The saved block
+for download always carries a `date_created`, as a saved file would. The resulting block
 is returned under `agent_network_metadata` for the client to send back with its next request. A
 `skip_designer` save that carries the block therefore leaves `metadata` intact. A client that sends no
 `agent_network_metadata` at all (nsflow's manual save sends nothing as of nsflow 0.7.1) gets the existing file's
 block kept in file mode; sending the key, even empty, makes the block client-owned and nothing is read from disk.
+- In reservations mode a deployment the server rejects ends the turn with an error message
+(`Error: the agent network could not be deployed as a temporary network: ...`) and clears `agent_reservations`,
+a handle the request carried from an earlier deploy included; `agent_network_definition`,
+`agent_network_hocon_text` and `agent_network_metadata` are still returned, so the network can be downloaded and
+the save retried
 - Updates the local `manifest.hocon` file in file mode
 
 ### Research Tool
```

**File**: `docs/examples/tools/openai_video_generation.md` (removed, +0/-207)
```diff
@@ -1,207 +0,0 @@
-# OpenAI Video Generation
-
-The **OpenAI Video Generation** is a task-oriented agentic system designed to help users create, remix, and describe
-videos through natural language descriptions. It leverages OpenAI's built-in video generation tool through a
-specialized toolkit, providing users with AI-generated videos based on their creative prompts and specifications.
-
----
-
-## File
-
-[openai_video_generation.hocon](../../../registries/tools/openai_video_generation.hocon)
-
----
-
-## Description
-
-At the core of the system is the Video Generator agent, which serves as the primary interface between the user and
-OpenAI's built-in video generation capabilities. When a user gives an instruction—such as "generate a video of a gray
-tabby cat hugging an otter with an orange scarf" or "create a video of a cute fuzzy cat with an umbrella under the
-rain"—the agent intelligently routes the request to the appropriate video generation tool. The generated video is
-automatically displayed in the user's browser and can optionally be saved to disk.
-
-The system also includes a Video Describer tool that analyzes generated videos by extracting frames and using
-vision-capable language models to provide detailed descriptions of the video content.
-
----
-
-## Prerequisites
-
-This agent network requires the following setup:
-
-### Python Dependencies
-
-This agent network requires langchain-openai for OpenAI's Responses API integration.
-This is already included with neuro-san-studio, so no need to install it separately.
-
-Additional dependencies for video processing:
-
-```bash
-pip install opencv-python aiohttp
-```
-
-### Environment Variables
-
-```bash
-export OPENAI_API_KEY="your_openai_api_key_here"
-```
-
-For more information on setting up OpenAI tools, see:
-
-- [OpenAI Video Generation Guide](https://developers.openai.com/api/docs/guides/video-generation)
-
----
-
-## Example Conversation
-
-### Human
-
-```text
-Generate a video of gray tabby cat hugging an otter with an orange scarf
-```
-
-### AI (Video Generator)
-
-```text
-Video generation completed with id vid_abc123xyz. Saved to: file:///path/to/vid_abc123xyz.mp4
-```
-
-### Human
-
-```text
-Describe what's in the video you just created
-```
-
-### AI (Video Generator)
-
-```text
-The video shows a gray tabby cat warmly embracing an otter that is wearing a bright orange scarf. The scene captures a
-heartwarming moment between these two adorable animals, with gentle movements and affectionate interaction throughout
-the clip.
-```
-
----
-
-## Architecture Overview
-
-### Frontman Agent: video_generator
-
-- Main entry point for user video generation, remixing, and description requests.
-- Interprets natural language descriptions and delegates tasks to the appropriate tools.
-- Processes results and provides feedback about generated videos, including file paths.
-- Handles the display and optional saving of generated videos.
-
-### Tools
-
-#### openai_video_generation
-
-This agent is a coded tool that can be called from the toolbox with the name `openai_video_generation`, which leverages
-OpenAI's built-in video generation capabilities.
-
-##### Tool Arguments and Parameters
-
-- `query`: The video description derived from user inquiry (required)
-- `video_id`: Optional ID of an existing video to remix
-- `openai_model`: Model used for video generation (defaults to "sora-2", allowed values: "sora-2", "sora-2-pro")
-- `save_video_file`: Boolean flag to save the generated video to disk (defaults to `false`)
-- `open_in_browser`: Boolean flag to automatically open the video in browser (defaults to `false`)
-- `seconds`: Clip duration in seconds (allowed values: "4", "8", "12"; defaults to "4")
-- `size`: Output resolution formatted as width x height (allowed values: "720x1280", "1280x720", "1024x1792",
-"1792x1024"; defaults to "720x1280")
-
-For additional parameters, see
-[OpenAI Video Generation API Reference](https://developers.openai.com/api/reference/resources/videos)
-
-Note: `input_reference` is not currently supported.
-
-#### video_describer
-
-This coded tool analyzes video content by extracting frames and using a vision-capable language model to describe what
-happens in the video.
-
-##### Tool Arguments and Parameters
-
-- `file_path`: Path to the video file to be described (required)
-- `openai_model`: OpenAI model to use for description (defaults to "gpt-4o"; must support image input)
-
----
-
-## Key Features
-
-### Video Generation
-
-- Creates videos from text prompts using OpenAI's Sora models
-- Supports multiple durations (4, 8, or 12 seconds)
-- Offers various resolution options for different aspect ratios
-- Asynchronous processing with status polling
-- Automatic timeout handling (600 seconds default)
-
-### Video Remixing
-
-- Modify existing videos with new prompts
-- Build upon previously generated content
-- Maintain video ID references for iterative editing
-
-### Video Description
-
-- Automaticall
```

**File**: `middleware/agent_network_designer/persistence/agent_network_persistence_middleware.py` (modified, +93/-11)
```diff
@@ -23,6 +23,7 @@
 from langchain.agents.middleware import AgentMiddleware
 from langchain.agents.middleware import AgentState
 from langchain.agents.middleware import hook_config
+from langchain.messages import AIMessage
 from langchain.messages import HumanMessage
 from langgraph.runtime import Runtime
 from neuro_san.interfaces.reservationist import Reservationist
@@ -80,6 +81,11 @@ class AgentNetworkPersistenceMiddleware(AgentMiddleware):
     (e.g., in AgentNetworkDefinitionMiddleware) and the agent needs to report that error
     rather than produce a network definition.
 
+    In reservations mode a third outcome exists: when the persistor reports that the temporary
+    network could not be deployed, the turn ends with an error message for the client, the
+    HOCON text and the metadata block are still published, and agent_reservations is cleared
+    (issue #1425, see aafter_agent and _deploy_error_response).
+
     Note: Validation is intentionally duplicated here even though individual subnetworks
     already perform their own validation. This is a safeguard for cases where the agent
     returns a final response without having called the necessary tools or subnetworks —
@@ -131,6 +137,7 @@ def __init__(self, reservationist: Reservationist, sly_data: dict[str, Any]) ->
 
     # Reenter the agent loop at the model node if validation fails.
     # If no agent network definition is present, return None to let the agent respond freely.
+    # If the temporary-network deploy fails, end the turn with an error message and no jump (issue #1425).
     # See https://github.com/cognizant-ai-lab/neuro-san-studio/blob/main/docs/user_guide.md#middleware and
     # https://reference.langchain.com/python/langchain/agents/middleware/types/hook_config for details on
     # hook_config and jump_to.
@@ -144,14 +151,20 @@ async def aafter_agent(self, state: AgentState, runtime: Runtime) -> dict[str, A
         errors are found, injects a human message with the errors and jumps back to the model
         so it can self-correct. If no definition is present, returns None so the agent can
         respond freely (e.g., to report a loading error from AgentNetworkDefinitionMiddleware).
+        In reservations mode a deployment the persistor reported as failed ends the turn with
+        an error message appended for the client; the HOCON text and the metadata block are
+        still published, since they describe the design rather than the deploy, and
+        agent_reservations is cleared, a handle the request carried included, see
+        _deploy_error_response (issue #1425).
 
         This validation acts as a final safety net: even if the agent bypassed calling
         the necessary tools or subnetworks (and thus their built-in validators never ran),
         errors will still be caught here before the network is persisted.
 
         :param state: Current agent state
         :param runtime: Runtime context
-        :return: Dict with error message and jump directive, or None if valid
+        :return: Dict with error message and jump directive on a validation failure, dict with
+                the error message alone on a failed deployment, or None otherwise
         """
         network_def: dict[str, Any] = self.sly_data.get(AGENT_NETWORK_DEFINITION)
         agent_network_name: str = self.sly_data.get(AGENT_NETWORK_NAME)
@@ -205,7 +218,10 @@ async def aafter_agent(self, state: AgentState, runtime: Runtime) -> dict[str, A
 
             sample_queries: list[str] = self.sly_data.get(AGENT_NETWORK_QUERIES, [])
 
-            await self._assemble_and_persist(network_def, agent_network_name, sample_queries)
+            # None means the save happened; a str is the deploy error the reservations persistor reported.
+            deploy_error: str | None = await self._assemble_and_persist(
+                network_def, agent_network_name, sample_queries
+            )
 
             agent_progress_style: str = environ.get("AGENT_NETWORK_DESIGNER_PROGRESS_STYLE", "internal")
 
@@ -218,10 +234,16 @@ async def aafter_agent(self, state: AgentState, runtime: Runtime) -> dict[str, A
             # and HOCON parse on the event loop.
             if agent_progress_style == "connectivity":
                 await ConnectivityDictionaryConverter.get_shared_toolbox_factory()
+            # The export runs on a deploy error too: the definition handed back describes the network
+            # the client asked for and is what it needs to retry the save; it does not depend on the
+            # deploy. Only agent_reservations is withheld, see _assemble_and_persist.
             self._determine_exported_network_definition(self.sly_data, agent_progress_style)
 
             self.logger.debug(">>>>>>>>>>>>>>>>>>> DONE %s !!!>>>>>>>>>>>>>>>>>>", self.__class__.__name__)
 
+            if deploy_error is not None:
+                return self._deploy_error_response(deploy_error)
+
         return None
 
     def _error_response(self, c
```

**File**: `middleware/persistent_memory/mem0_store.py` (modified, +0/-2)
```diff
@@ -59,8 +59,6 @@
 ``suggestion`` attributes intact.
 """
 
-from __future__ import annotations
-
 import os
 from typing import Any
 from typing import Awaitable
```

---

### Incident Patch 11: `5a024407` (2026-09-25)
**Commit Message**: #1458: Require the period after the network name when matching the prefix

- The prefix's name slot now also names the ending its last word must
  have: the period a save writes right after the name for the current
  wording, nothing for the legacy wording, where "of assistants."
  follows the name
- Text with the prefix's words but no period after the name is left
  alone, for one name word or several

**File**: `middleware/agent_network_designer/persistence/designer_instruction_unwrapper.py` (modified, +39/-32)
```diff
@@ -50,11 +50,12 @@ class DesignerInstructionUnwrapper:
       (registries/basic/wolfram_mcp.hocon) or quotes a wrapper sentence in the middle is left alone.
     - Every copy, however many there are and in whatever order: after several saves the leading pieces
       interleave (prefix, front man's lines, prefix, front man's lines, ...).
-    - The prefix under any network name of up to MAX_NAME_WORDS words, since a copy carries the name the network
-      was saved under, which can differ from the name of this save; and in the wording networks generated before
-      22a84541 used, whose names were single words. That old wording is also what some hand-written networks use
-      for their own prefix with a longer name ("You are part of a smart home network of assistants." in
-      registries/basic/smart_home.hocon), and those are not designer copies, so they are left alone.
+    - The prefix under any network name of up to MAX_NAME_WORDS words, followed by the period a save writes
+      after it, since a copy carries the name the network was saved under, which can differ from the name of
+      this save; and in the wording networks generated before 22a84541 used, whose names were single words.
+      That old wording is also what some hand-written networks use for their own prefix with a longer name
+      ("You are part of a smart home network of assistants." in registries/basic/smart_home.hocon), and those
+      are not designer copies, so they are left alone.
     - Only the words at the two ends of the text are ever read, and only the end is copied, to be read backwards
       (see _trailing_copy), so the cost grows with the copies stripped, not with the length of the text. The words
       are compared one by one rather than with a regular expression: a pattern anchored at the end of the text is
@@ -88,24 +89,25 @@ def __init__(self, aaosa_instructions: str | None) -> None:
         Prepare the word patterns of the wrapper pieces.
 
         The prefix, the front man's lines and the demo sentence are fixed texts from DesignerWrapperTexts. A copy of
-        the prefix names the network it was saved under, so up to MAX_NAME_WORDS words stand in for the name (one
-        word for the legacy wording).
+        the prefix names the network it was saved under, so up to MAX_NAME_WORDS words stand in for the name, the
+        last of them ending with the period the save writes after it (one word, without the period, for the
+        legacy wording, where "of assistants." follows the name).
 
         :param aaosa_instructions: The AAOSA instructions the save appends to the front man and to agents with
                 tools, from registries/aaosa.hocon, or None to strip none
         """
-        # An int entry stands for the network name, which differs from copy to copy: it matches one word up to
-        # that many words.
-        current_prefix: list[str | int] = self._words(DesignerWrapperTexts.PREFIX_OPENING)
-        current_prefix.append(self.MAX_NAME_WORDS)
+        # A (count, ending) entry stands for the network name, which differs from copy to copy: it matches one word
+        # up to count words, the last of them ending with ending.
+        current_prefix: list[str | tuple[int, str]] = self._words(DesignerWrapperTexts.PREFIX_OPENING)
+        current_prefix.append((self.MAX_NAME_WORDS, "."))
         current_prefix.extend(self._words(DesignerWrapperTexts.PREFIX_RULES))
-        legacy_prefix: list[str | int] = self._words(DesignerWrapperTexts.LEGACY_PREFIX_OPENING)
-        legacy_prefix.append(1)
+        legacy_prefix: list[str | tuple[int, str]] = self._words(DesignerWrapperTexts.LEGACY_PREFIX_OPENING)
+        legacy_prefix.append((1, ""))
         legacy_prefix.extend(self._words(DesignerWrapperTexts.LEGACY_PREFIX_CLOSING))
         legacy_prefix.extend(self._words(DesignerWrapperTexts.PREFIX_RULES))
 
         # (piece key, word pattern) pairs for the pieces a save writes before the agent's own text.
-        self.leading_pieces: list[tuple[str, list[str | int]]] = [
+        self.leading_pieces: list[tuple[str, list[str | tuple[int, str]]]] = [
             (self.PREFIX, current_prefix),
             (self.PREFIX, legacy_prefix),
             (self.FRONT_MAN_LINES, self._words(DesignerWrapperTexts.FRONT_MAN_LINES)),
@@ -114,10 +116,10 @@ def __init__(self, aaosa_instructions: str | None) -> None:
         # The AAOSA instructions, the one piece a save writes after the own text, are matched on the reversed text
         # (see _trailing_copy), so their pattern is kept the way that text reads: last word first, and every word
         # spelled backwards. Without them there is nothing to look for at the end.
-        reversed_aaosa_pattern: list[str | int] = []
+        reversed_aaosa_pattern: list[str | tuple[int, str]] = []
         for word in reversed(self._words(aaosa_instructions)):
             reversed_aaosa_pattern.append(word[::-1])
-        self.trailing_pieces: list[tupl
```

**File**: `tests/middleware/agent_network_designer/persistence/test_designer_instruction_unwrapper.py` (modified, +3/-0)
```diff
@@ -190,6 +190,9 @@ def test_leaves_text_without_the_wrapper_unchanged(self) -> None:
             # A hand-written network's own prefix in the legacy wording with a longer name
             # (registries/basic/smart_home.hocon), which no designer version wrote.
             f"You are part of a smart home network of assistants.\n{DesignerWrapperTexts.PREFIX_RULES}\nOwn text.",
+            # The prefix's words without the period a save writes right after the name, for one name word or more.
+            f"{PREFIX_MARKER} travel\n{DesignerWrapperTexts.PREFIX_RULES}\nOwn text.",
+            f"{PREFIX_MARKER} My Travel Desk\n{DesignerWrapperTexts.PREFIX_RULES}\nOwn text.",
         ]
         for text in texts:
             with self.subTest(text=text[:30]):
```

---

### Incident Patch 12: `09698264` (2026-09-25)
**Commit Message**: Merge pull request #1465 from cognizant-ai-lab/fix/1464-remove-openai-video-generation

#1464: Remove the OpenAI video generation tool now that OpenAI has shut down the Videos API

**File**: `coded_tools/tools/video_describer.py` (removed, +0/-95)
```diff
@@ -1,95 +0,0 @@
-# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-#
-# END COPYRIGHT
-
-import base64
-import logging
-from typing import Any
-
-# pylint: disable=import-error
-import cv2
-from langchain_core.messages import HumanMessage
-from langchain_openai import ChatOpenAI
-from neuro_san.interfaces.coded_tool import CodedTool
-
-INSTRUCTIONS = "Describe the content of the video in detail."
-
-
-class VideoDescriber(CodedTool):
-    """
-    A CodedTool implementation for invoking OpenAI model to describe a generated video.
-    """
-
-    def __init__(self):
-        self.logger = logging.getLogger(__name__)
-
-    async def async_invoke(self, args: dict[str, Any], sly_data: dict[str, Any]) -> str:
-        """
-        :param args: An argument dictionary whose keys are the parameters
-                to the coded tool and whose values are the values passed for them
-                by the calling agent or user. This dictionary is to be treated as read-only.
-
-                The argument dictionary expects the following keys:
-                - from calling agent
-                    - "file_path" (str): Path to the video file to be described.
-                - from user
-                    - "openai_model" (str): OpenAI model to call the tool. Default to gpt-4o.
-
-        :param sly_data: A dictionary whose keys are defined by the agent hierarchy,
-                but whose values are meant to be kept out of the chat stream.
-
-        :return: Text string describing the video.
-        """
-
-        # Get file_path from args
-        file_path: str = args.get("file_path")
-        if not file_path:
-            raise ValueError("No file_path provided!!!")
-
-        # User-defined arguments
-        openai_model: str = args.get("openai_model", "gpt-4o")
-
-        # Read video and extract frames
-        video = cv2.VideoCapture(file_path)
-        base64_frames: list[str] = []
-        while video.isOpened():
-            success, frame = video.read()
-            if not success:
-                break
-            _, buffer = cv2.imencode(".jpg", frame)
-            base64_frames.append(base64.b64encode(buffer).decode("utf-8"))
-
-        video.release()
-        self.logger.info("%d frames read from %s.", len(base64_frames), file_path)
-
-        llm = ChatOpenAI(model=openai_model)
-        content = [
-            {
-                "type": "text",
-                "text": f"{INSTRUCTIONS}",
-            },
-            *[
-                {
-                    "type": "image",
-                    "base64": f"{frame}",
-                    "mime_type": "image/jpeg",
-                }
-                for frame in base64_frames
-            ],
-        ]
-
-        message = HumanMessage(content=content)
-        response = await llm.ainvoke([message])
-        return response.text
```

**File**: `docs/examples.md` (modified, +0/-11)
```diff
@@ -31,7 +31,6 @@ Here are a few examples ordered by level of complexity.
     - [Anthropic Web Search](#anthropic-web-search)
     - [OpenAI Code Interpreter](#openai-code-interpreter)
     - [OpenAI Image Generation](#openai-image-generation)
-    - [OpenAI Video Generation](#openai-video-generation)
     - [OpenAI Web Search](#openai-web-search)
     - [Google Maps](#google-maps)
     - [Gemini Image Generation](#gemini-image-generation)
@@ -263,16 +262,6 @@ for generated images.
 
 **Tags:** `tool`, `image`, `OpenAI`
 
-### OpenAI Video Generation
-
-[OpenAI Video Generation](examples/tools/openai_video_generation.md) is a multi-agent system that allows users to
-create, remix, and describe videos through natural language commands. It consists of a Video Generator agent that
-coordinates with two tools: an OpenAI video generation tool (using Sora models) that creates videos from text prompts
-with configurable durations and resolutions, and a Video Describer tool that analyzes video content by extracting
-frames and generating detailed descriptions using vision-capable language models.
-
-**Tags:** `tool`, `video`, `OpenAI`
-
 ### OpenAI Web Search
 
 [OpenAI Web Search](examples/tools/openai_web_search.md) is a task-oriented agentic system designed to help users search
```

**File**: `docs/examples/tools/openai_video_generation.md` (removed, +0/-207)
```diff
@@ -1,207 +0,0 @@
-# OpenAI Video Generation
-
-The **OpenAI Video Generation** is a task-oriented agentic system designed to help users create, remix, and describe
-videos through natural language descriptions. It leverages OpenAI's built-in video generation tool through a
-specialized toolkit, providing users with AI-generated videos based on their creative prompts and specifications.
-
----
-
-## File
-
-[openai_video_generation.hocon](../../../registries/tools/openai_video_generation.hocon)
-
----
-
-## Description
-
-At the core of the system is the Video Generator agent, which serves as the primary interface between the user and
-OpenAI's built-in video generation capabilities. When a user gives an instruction—such as "generate a video of a gray
-tabby cat hugging an otter with an orange scarf" or "create a video of a cute fuzzy cat with an umbrella under the
-rain"—the agent intelligently routes the request to the appropriate video generation tool. The generated video is
-automatically displayed in the user's browser and can optionally be saved to disk.
-
-The system also includes a Video Describer tool that analyzes generated videos by extracting frames and using
-vision-capable language models to provide detailed descriptions of the video content.
-
----
-
-## Prerequisites
-
-This agent network requires the following setup:
-
-### Python Dependencies
-
-This agent network requires langchain-openai for OpenAI's Responses API integration.
-This is already included with neuro-san-studio, so no need to install it separately.
-
-Additional dependencies for video processing:
-
-```bash
-pip install opencv-python aiohttp
-```
-
-### Environment Variables
-
-```bash
-export OPENAI_API_KEY="your_openai_api_key_here"
-```
-
-For more information on setting up OpenAI tools, see:
-
-- [OpenAI Video Generation Guide](https://developers.openai.com/api/docs/guides/video-generation)
-
----
-
-## Example Conversation
-
-### Human
-
-```text
-Generate a video of gray tabby cat hugging an otter with an orange scarf
-```
-
-### AI (Video Generator)
-
-```text
-Video generation completed with id vid_abc123xyz. Saved to: file:///path/to/vid_abc123xyz.mp4
-```
-
-### Human
-
-```text
-Describe what's in the video you just created
-```
-
-### AI (Video Generator)
-
-```text
-The video shows a gray tabby cat warmly embracing an otter that is wearing a bright orange scarf. The scene captures a
-heartwarming moment between these two adorable animals, with gentle movements and affectionate interaction throughout
-the clip.
-```
-
----
-
-## Architecture Overview
-
-### Frontman Agent: video_generator
-
-- Main entry point for user video generation, remixing, and description requests.
-- Interprets natural language descriptions and delegates tasks to the appropriate tools.
-- Processes results and provides feedback about generated videos, including file paths.
-- Handles the display and optional saving of generated videos.
-
-### Tools
-
-#### openai_video_generation
-
-This agent is a coded tool that can be called from the toolbox with the name `openai_video_generation`, which leverages
-OpenAI's built-in video generation capabilities.
-
-##### Tool Arguments and Parameters
-
-- `query`: The video description derived from user inquiry (required)
-- `video_id`: Optional ID of an existing video to remix
-- `openai_model`: Model used for video generation (defaults to "sora-2", allowed values: "sora-2", "sora-2-pro")
-- `save_video_file`: Boolean flag to save the generated video to disk (defaults to `false`)
-- `open_in_browser`: Boolean flag to automatically open the video in browser (defaults to `false`)
-- `seconds`: Clip duration in seconds (allowed values: "4", "8", "12"; defaults to "4")
-- `size`: Output resolution formatted as width x height (allowed values: "720x1280", "1280x720", "1024x1792",
-"1792x1024"; defaults to "720x1280")
-
-For additional parameters, see
-[OpenAI Video Generation API Reference](https://developers.openai.com/api/reference/resources/videos)
-
-Note: `input_reference` is not currently supported.
-
-#### video_describer
-
-This coded tool analyzes video content by extracting frames and using a vision-capable language model to describe what
-happens in the video.
-
-##### Tool Arguments and Parameters
-
-- `file_path`: Path to the video file to be described (required)
-- `openai_model`: OpenAI model to use for description (defaults to "gpt-4o"; must support image input)
-
----
-
-## Key Features
-
-### Video Generation
-
-- Creates videos from text prompts using OpenAI's Sora models
-- Supports multiple durations (4, 8, or 12 seconds)
-- Offers various resolution options for different aspect ratios
-- Asynchronous processing with status polling
-- Automatic timeout handling (600 seconds default)
-
-### Video Remixing
-
-- Modify existing videos with new prompts
-- Build upon previously generated content
-- Maintain video ID references for iterative editing
-
-### Video Description
-
-- Automaticall
```

**File**: `neuro_san_studio/coded_tools/openai_video_generation.py` (removed, +0/-249)
```diff
@@ -1,249 +0,0 @@
-# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-#
-# END COPYRIGHT
-
-import asyncio
-import logging
-import os
-import webbrowser
-from pathlib import Path
-from tempfile import NamedTemporaryFile
-from typing import Any
-
-import aiohttp
-from neuro_san.interfaces.coded_tool import CodedTool
-
-URL_ENDPOINT = "https://api.openai.com/v1/videos"
-API_KEY = os.getenv("OPENAI_API_KEY")
-HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
-POLL_INTERVAL = 5  # seconds between status checks
-TIMEOUT = 600  # maximum wait time in seconds
-
-
-class OpenAIVideoGeneration(CodedTool):
-    """
-    A CodedTool implementation for invoking OpenAI video generation using OpenAI API.
-
-    See https://platform.openai.com/docs/guides/video-generation
-    """
-
-    def __init__(self):
-        self.logger = logging.getLogger(__name__)
-
-    async def async_invoke(self, args: dict[str, Any], sly_data: dict[str, Any]) -> str:
-        """
-        :param args: An argument dictionary whose keys are the parameters
-                to the coded tool and whose values are the values passed for them
-                by the calling agent or user. This dictionary is to be treated as read-only.
-
-                The argument dictionary expects the following keys:
-                - from calling agent
-                    - "query" (str): Request from the user prompt.
-                - from user
-                    - "openai_model" (str): OpenAI model to call the tool. Default to sora-2.
-                    - "additional_kwargs" (dict): Any additional arguments for the tool.
-
-        :param sly_data: A dictionary whose keys are defined by the agent hierarchy,
-                but whose values are meant to be kept out of the chat stream.
-
-        :return:
-            In case of successful execution:
-                Text string indicating video generation is completed.
-            otherwise:
-                a text string an error message in the format:
-                "Error: <error message>"
-        """
-
-        # Get query from args
-        query: str = args.get("query")
-        if not query:
-            raise ValueError("Error: No query provided.")
-
-        # Get video id to remix if provided
-        video_id: str = args.get("video_id")
-
-        # User-defined arguments
-        openai_model: str = args.get("openai_model", "sora-2")
-        size: str = args.get("size", "720x1280")
-        seconds: str = args.get("seconds", "4")
-        save_video_file: bool = args.get("save_video_file", False)
-        open_in_browser: bool = args.get("open_in_browser", False)
-
-        async with aiohttp.ClientSession() as session:
-            if video_id:
-                # Remix existing video
-                self.logger.info("Starting video remix for ID: %s", video_id)
-                video_id = await self._remix_video(session, video_id, query)
-            else:
-                self.logger.info("Starting new video generation.")
-                # Start video generation job
-                video_id = await self._create_video(session, query, openai_model, size, seconds)
-
-            if not video_id:
-                # pylint: disable=broad-exception-raised
-                raise Exception("Failed to create video rendering job.")
-            self.logger.info("Video generation started with ID: %s", video_id)
-
-            # Poll for completion
-            status_data = await self._poll_status(session, video_id)
-
-            if status_data.get("status") != "completed":
-                error_msg = status_data.get("error", "Unknown error")
-                return f"Error: Video generation failed - {error_msg}"
-
-            # Download and display video
-            video_path = await self._display_video(session, video_id, save_video_file, open_in_browser)
-
-            if video_path:
-                return f"Video generation completed with id {video_id}. Saved to: {video_path}"
-
-            # pylint: disable=broad-exception-raised
-            raise Exception("Failed to download generated video.")
-
-    # pylint: disable=too-many-arguments
-    # pylint: disable=too-many-positional-arguments
-    async def _create_video(
-        self, session: aiohttp.ClientSession, query: str, model: str, size: str, seconds: str
-    ) -> str | None:
-        """
-        Create a vide
```

**File**: `neuro_san_studio/toolbox/agent_network_designer_toolbox_info.hocon` (modified, +0/-19)
```diff
@@ -90,25 +90,6 @@
         }
     },
 
-    "openai_video_generation": {
-        "class": "neuro_san_studio.coded_tools.openai_video_generation.OpenAIVideoGeneration",
-        "description": "Tool that generates video using OpenAI models",
-        "parameters": {
-            "type": "object",
-            "properties": {
-                "query": {
-                    "type": "string",
-                    "description": "The prompt for video generation."
-                },
-                "video_id": {
-                    "type": "string",
-                    "description": "The ID of an existing video to remix. If provided, the video will be remixed based on the prompt."
-                }
-            },
-            "required": ["query"]
-        }
-    },
-
      # ---------- RAG Tools ----------
     #
     # Supported Vector Store: In-Memory and PostgreSQL vector stores
```

**File**: `neuro_san_studio/toolbox/toolbox_info.hocon` (modified, +1/-19)
```diff
@@ -317,25 +317,7 @@
             "required": ["query"]
         }
     },
-    "openai_video_generation": {
-        "class": "neuro_san_studio.coded_tools.openai_video_generation.OpenAIVideoGeneration",
-        "description": "Tool that generates video using OpenAI models",
-        "parameters": {
-            "type": "object",
-            "properties": {
-                "query": {
-                    "type": "string",
-                    "description": "The prompt for video generation."
-                },
-                "video_id": {
-                    "type": "string",
-                    "description": "The ID of an existing video to remix. If provided, the video will be remixed based on the prompt."
-                }
-            },
-            "required": ["query"]
-        }
-    },
-        
+
     # ---------- RAG Tools ----------
     #
     # Supported Vector Store: In-Memory and PostgreSQL vector stores
```

**File**: `registries/tools/manifest.hocon` (modified, +0/-3)
```diff
@@ -136,9 +136,6 @@
     # https://python.langchain.com/docs/integrations/chat/openai/#responses-api
     "tools/openai_code_interpreter.hocon": true,
     "tools/openai_image_generation.hocon": true,
-    # This network also requires opencv-python
-    # See docs/examples/tools/openai_video_generation.hocon#Prerequisites for more information.
-    "tools/openai_video_generation.hocon": false,
     "tools/openai_web_search.hocon": true,
 
     "tools/pdf_rag.hocon": false,
```

**File**: `registries/tools/openai_video_generation.hocon` (removed, +0/-135)
```diff
@@ -1,135 +0,0 @@
-# Copyright © 2025-2026 Cognizant Technology Solutions Corp, www.cognizant.com.
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-#
-# END COPYRIGHT
-
-# The schema specifications for this file are documented here:
-# https://github.com/cognizant-ai-lab/neuro-san/blob/main/docs/agent_hocon_reference.md
-
-# Requirement to use this agent network:
-# - OPENAI_API_KEY
-# - opencv-python
-# See https://platform.openai.com/docs/guides/video-generation
-
-{
-    include "registries/expertise_scoping_instructions.hocon",
-
-    # Load the shared LLM configuration from a single source of truth.
-    # This allows users to change the model in one file rather than
-    # modifying the configuration for each agent network.
-    # Note that the file path here is relative to the root level of the repo.
-    include "config/llm_config.hocon",
-
-    # Video generation can take longer than usual LLM responses. Hence, we set
-    "max_execution_seconds": 600,
-
-    # Optional metadata describing this agent network
-    "metadata": {
-        "description": "Video generation assistant that leverages OpenAI's built-in video generation tool",
-        "tags": ["video generation", "openai", "tool"],
-        "sample_queries": [
-            "Generate an video of gray tabby cat hugging an otter with an orange scarf",
-            "Create a video of a cute fuzzy cat with an umbrella under the rain",
-            "Create a video of a cat sleeping like a human baby",
-        ]
-    },
-
-    "tools": [
-        # This first agent definition is regarded as the "Front Man", which
-        # does all the talking to the outside world/client.
-        #
-        # Some disqualifications from being a front man:
-        #   1) Cannot use a CodedTool "class" definition
-        #   2) Cannot use a Tool "toolbox" definition
-        #
-        # Besides the first agent being the front man, these tool definitions
-        # do not have to be in any particular order. How they are linked and
-        # call each other is defined within their own specs.
-        # This could be a graph, potentially even with cycles.
-        {
-            "name": "video_generator",
-
-            "function": {
-                # The description acts as an initial prompt. 
-                "description": "Assist caller in video generation.",
-                "parameters": {
-                    "type": "object",
-                    "properties": {
-                        "user_inquiry": {
-                            "type": "string",
-                            "description": "A prompt from a user."
-                        },
-                    },
-                    "required": ["user_inquiry"]
-                }
-            },
-
-            "instructions": """Use your tool to generate, remix, or describe a video.
-If the user ask you to generate or modify a video, you MUST provide the local file URL using the `file:///` scheme pointing to the generated video in the response.
-If the user ask you to describe a video, you MUST call your video_describer tool to get the description first before responding to the user.
-""" ${expertise_scoping_instructions},
-            "tools": ["openai_video_generation", "video_describer"]
-        },
-        {
-            "name": "openai_video_generation",            
-            "toolbox": "openai_video_generation",
-
-            # --- Optional Arguments ---
-            "args": {
-                # The video generation model to use (allowed values: "sora-2", "sora-2-pro"). Defaults to "sora-2".
-                "openai_model": "sora-2",
-
-                # Whether to save video on disk. Defaults to false.
-                "save_video_file": true,
-
-                # Whether to open the video in the browser after generation. Defaults to false.
-                "open_in_browser": true,
-
-                # Additinal arguments can be passed below
-
-                # Clip duration in seconds (allowed values: "4", "8", "12"). Defaults to 4 seconds.
-                "seconds": "4",
-
-                # Output resolution formatted as width x height (allowed values: 720x1280, 1280x720, 1024x1792, 1792x1024). Defaults to 720x1280.
-                "size": "720x1280"
-
-                # For more information, please see https://developers.openai.com/api/reference/resources/videos
-                # Note that "input_reference" is not currently supported.
-            }
-        },
-        {
-    
```

---

### Incident Patch 13: `f9fb11ad` (2026-09-25)
**Commit Message**: Merge pull request #1460 from cognizant-ai-lab/fix/checkmarx-reusable-workflow

Use reusable Checkmarx workflow from build-common

**File**: `.github/workflows/checkmarx.yml` (modified, +19/-21)
```diff
@@ -1,31 +1,29 @@
 ---
 name: Checkmarx One
 
-permissions:
-    contents: read
-    security-events: write
-
 on:
     schedule:
         # M-F at 3:00 am UTC (offset from neuro-san and neuro-san-ui)
         - cron: "0 3 * * 1-5"
     workflow_dispatch:
+    release:
+        types:
+            - published
 
 jobs:
-    checkmarx-scan:
-        runs-on: ubuntu-latest
-        steps:
-            - name: Checkout repository
-              # v6.0.2
-              uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
-              with:
-                  fetch-depth: 0
-
-            - name: Run Checkmarx One scan
-              # build-common 1.0.12
-              uses: cognizant-ai-lab/build-common/actions/checkmarx-one@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
-              with:
-                  base-uri: ${{ vars.CX_BASE_URI }}
-                  cx-tenant: ${{ vars.CX_TENANT }}
-                  cx-client-id: ${{ vars.CX_CLIENT_ID }}
-                  cx-client-secret: ${{ secrets.CX_CLIENT_SECRET }}
+    checkmarx:
+        # 1.0.12
+        uses: cognizant-ai-lab/build-common/.github/workflows/_checkmarx.yml@3f4cdab31b6ac10382c99452b720eb0b8b2dab8f
+        with:
+            # 1.0.12
+            build-common-ref: "3f4cdab31b6ac10382c99452b720eb0b8b2dab8f"
+            base-uri: ${{ vars.CX_BASE_URI }}
+            cx-tenant: ${{ vars.CX_TENANT }}
+            cx-client-id: ${{ vars.CX_CLIENT_ID }}
+            scan-params: '--sast-preset-name "Checkmarx Default" --threshold "sast-critical=1;sast-high=1"'
+        secrets:
+            CX_CLIENT_SECRET: ${{ secrets.CX_CLIENT_SECRET }}
+            SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
+        permissions:
+            contents: write
+            security-events: write
```

---

### Incident Patch 14: `a90ba644` (2026-09-25)
**Commit Message**: Merge branch 'main' into fix/checkmarx-reusable-workflow

**File**: `docs/examples/agent_network_designer.md` (modified, +6/-1)
```diff
@@ -352,11 +352,16 @@ back, so the block survives a save the same way the definition and the name do:
 other key are written as sent, `sample_queries` is replaced only when `agent_network_query_generator` ran on
 that turn, and in file mode `date_created` is stamped once and `date_modified` on every save. A temporary
 network gets no studio dates in its deployed spec (neuro-san records `stored_at`), but the HOCON text returned
-for download always carries a `date_created`, as a saved file would. The saved block
+for download always carries a `date_created`, as a saved file would. The resulting block
 is returned under `agent_network_metadata` for the client to send back with its next request. A
 `skip_designer` save that carries the block therefore leaves `metadata` intact. A client that sends no
 `agent_network_metadata` at all (nsflow's manual save sends nothing as of nsflow 0.7.1) gets the existing file's
 block kept in file mode; sending the key, even empty, makes the block client-owned and nothing is read from disk.
+- In reservations mode a deployment the server rejects ends the turn with an error message
+(`Error: the agent network could not be deployed as a temporary network: ...`) and clears `agent_reservations`,
+a handle the request carried from an earlier deploy included; `agent_network_definition`,
+`agent_network_hocon_text` and `agent_network_metadata` are still returned, so the network can be downloaded and
+the save retried
 - Updates the local `manifest.hocon` file in file mode
 
 ### Research Tool
```

**File**: `middleware/agent_network_designer/persistence/agent_network_persistence_middleware.py` (modified, +93/-11)
```diff
@@ -23,6 +23,7 @@
 from langchain.agents.middleware import AgentMiddleware
 from langchain.agents.middleware import AgentState
 from langchain.agents.middleware import hook_config
+from langchain.messages import AIMessage
 from langchain.messages import HumanMessage
 from langgraph.runtime import Runtime
 from neuro_san.interfaces.reservationist import Reservationist
@@ -80,6 +81,11 @@ class AgentNetworkPersistenceMiddleware(AgentMiddleware):
     (e.g., in AgentNetworkDefinitionMiddleware) and the agent needs to report that error
     rather than produce a network definition.
 
+    In reservations mode a third outcome exists: when the persistor reports that the temporary
+    network could not be deployed, the turn ends with an error message for the client, the
+    HOCON text and the metadata block are still published, and agent_reservations is cleared
+    (issue #1425, see aafter_agent and _deploy_error_response).
+
     Note: Validation is intentionally duplicated here even though individual subnetworks
     already perform their own validation. This is a safeguard for cases where the agent
     returns a final response without having called the necessary tools or subnetworks —
@@ -131,6 +137,7 @@ def __init__(self, reservationist: Reservationist, sly_data: dict[str, Any]) ->
 
     # Reenter the agent loop at the model node if validation fails.
     # If no agent network definition is present, return None to let the agent respond freely.
+    # If the temporary-network deploy fails, end the turn with an error message and no jump (issue #1425).
     # See https://github.com/cognizant-ai-lab/neuro-san-studio/blob/main/docs/user_guide.md#middleware and
     # https://reference.langchain.com/python/langchain/agents/middleware/types/hook_config for details on
     # hook_config and jump_to.
@@ -144,14 +151,20 @@ async def aafter_agent(self, state: AgentState, runtime: Runtime) -> dict[str, A
         errors are found, injects a human message with the errors and jumps back to the model
         so it can self-correct. If no definition is present, returns None so the agent can
         respond freely (e.g., to report a loading error from AgentNetworkDefinitionMiddleware).
+        In reservations mode a deployment the persistor reported as failed ends the turn with
+        an error message appended for the client; the HOCON text and the metadata block are
+        still published, since they describe the design rather than the deploy, and
+        agent_reservations is cleared, a handle the request carried included, see
+        _deploy_error_response (issue #1425).
 
         This validation acts as a final safety net: even if the agent bypassed calling
         the necessary tools or subnetworks (and thus their built-in validators never ran),
         errors will still be caught here before the network is persisted.
 
         :param state: Current agent state
         :param runtime: Runtime context
-        :return: Dict with error message and jump directive, or None if valid
+        :return: Dict with error message and jump directive on a validation failure, dict with
+                the error message alone on a failed deployment, or None otherwise
         """
         network_def: dict[str, Any] = self.sly_data.get(AGENT_NETWORK_DEFINITION)
         agent_network_name: str = self.sly_data.get(AGENT_NETWORK_NAME)
@@ -205,7 +218,10 @@ async def aafter_agent(self, state: AgentState, runtime: Runtime) -> dict[str, A
 
             sample_queries: list[str] = self.sly_data.get(AGENT_NETWORK_QUERIES, [])
 
-            await self._assemble_and_persist(network_def, agent_network_name, sample_queries)
+            # None means the save happened; a str is the deploy error the reservations persistor reported.
+            deploy_error: str | None = await self._assemble_and_persist(
+                network_def, agent_network_name, sample_queries
+            )
 
             agent_progress_style: str = environ.get("AGENT_NETWORK_DESIGNER_PROGRESS_STYLE", "internal")
 
@@ -218,10 +234,16 @@ async def aafter_agent(self, state: AgentState, runtime: Runtime) -> dict[str, A
             # and HOCON parse on the event loop.
             if agent_progress_style == "connectivity":
                 await ConnectivityDictionaryConverter.get_shared_toolbox_factory()
+            # The export runs on a deploy error too: the definition handed back describes the network
+            # the client asked for and is what it needs to retry the save; it does not depend on the
+            # deploy. Only agent_reservations is withheld, see _assemble_and_persist.
             self._determine_exported_network_definition(self.sly_data, agent_progress_style)
 
             self.logger.debug(">>>>>>>>>>>>>>>>>>> DONE %s !!!>>>>>>>>>>>>>>>>>>", self.__class__.__name__)
 
+            if deploy_error is not None:
+                return self._deploy_error_response(deploy_error)
+
         return None
 
     def _error_response(self, c
```

**File**: `registries/agent_network_designer.hocon` (modified, +5/-4)
```diff
@@ -206,17 +206,18 @@ Send agent_network_metadata back with it so the saved network keeps its metadata
                             "type": "string",
                             "description": """
 The contents of an agent network HOCON file describing the created network. In file mode this is exactly
-the saved file. In reservations mode it is the downloadable form of the deployed network and carries a
-date_created the deployed spec does not have.
+the saved file. In reservations mode it is the downloadable form of the network, returned whether or not the
+deploy succeeded, and carries a date_created the deployed spec does not have.
 """
                         },
                         "agent_network_metadata": {
                             "type": "object",
                             "description": """
 The network's top-level metadata block exactly as written into the saved network and as connectivity()
 serves it, minus the reservation and stored_at keys neuro-san's reservation storage adds to a temporary
-network. Send it back unchanged with the next request (see the input schema). Present after a save and
-after a network was loaded from agent_network_hocon_file or a reservation; absent otherwise.
+network. Send it back unchanged with the next request (see the input schema). Present after a save attempt,
+a rejected temporary-network deploy included, and after a network was loaded from agent_network_hocon_file
+or a reservation; absent otherwise.
 """,
                             "properties": {
                                 "description": {"type": "string"},
```

**File**: `tests/middleware/agent_network_designer/persistence/test_agent_network_persistence_middleware.py` (modified, +73/-4)
```diff
@@ -18,7 +18,8 @@
 Tests for AgentNetworkPersistenceMiddleware.aafter_agent: validation gating and the stateless
 handling of the persisted metadata block (issue #1398) in both file mode and reservations mode,
 including the compatibility fallback that reads the block of the network about to be overwritten
-when the client sent no agent_network_metadata key at all.
+when the client sent no agent_network_metadata key at all, and the surfacing of a failed
+temporary-network deployment (issue #1425).
 """
 
 import json
@@ -35,6 +36,7 @@
 from unittest import mock
 from unittest.mock import AsyncMock
 
+from langchain.messages import AIMessage
 from langchain.messages import HumanMessage
 from neuro_san.interfaces.reservation import Reservation
 from neuro_san.interfaces.reservationist import Reservationist
@@ -66,7 +68,8 @@
 # distinct from None, which _request sends as an explicit null: the middleware treats both alike
 # (fallback read), and the tests must be able to show that for each of them separately.
 NO_BLOCK: object = object()
-# Logger names the persistor and the metadata block warn on; both are built from the class name.
+# Logger names the middleware, the persistor and the metadata block log on; all are built from the class name.
+MIDDLEWARE_LOGGER: str = "AgentNetworkPersistenceMiddleware"
 PERSISTOR_LOGGER: str = "FileSystemAgentNetworkPersistor"
 METADATA_LOGGER: str = "AgentNetworkMetadataBlock"
 SAMPLE_QUERIES: list[str] = ["What can you do?", "Help me with X"]
@@ -181,7 +184,9 @@ def _enter_reservations_mode(self) -> AsyncMock:
         Switch the middleware to reservations mode and stub the neuro-san deployment call.
 
         The fake Reservation reports RESERVATION_ID / LIFETIME_SECONDS / EXPIRATION_SECONDS, which
-        ReservationsAgentNetworkPersistor echoes into sly_data["agent_reservations"].
+        ReservationsAgentNetworkPersistor echoes into sly_data["agent_reservations"]. A test that
+        needs a failed deploy sets the mock's return_value to (None, "<error>"), the shape
+        ReservationUtil.wait_for_one uses to report one.
 
         :return: The AsyncMock standing in for ReservationUtil.wait_for_one, so a test can inspect
                 the agent_spec it was awaited with (positional argument 1) and the prefix (argument 3)
@@ -254,7 +259,8 @@ async def _save(sly_data: dict[str, Any]) -> dict[str, Any] | None:
         over from one request to the next.
 
         :param sly_data: The request's sly_data, mutated in place by the middleware
-        :return: What aafter_agent returned: None on success, a jump_to dict on validation failure
+        :return: What aafter_agent returned: None on success, a jump_to dict on validation failure,
+                a messages-only dict on a failed deploy
         """
         middleware: AgentNetworkPersistenceMiddleware = AgentNetworkPersistenceMiddleware(Reservationist(), sly_data)
         return await middleware.aafter_agent({}, None)
@@ -716,6 +722,69 @@ async def test_reservations_mode_passes_client_dates_through_unchanged(self) ->
         self.assertNotIn("date_modified", agent_spec["metadata"])
         self.assertEqual(sly_data["agent_network_metadata"], CLIENT_METADATA)
 
+    async def test_reservations_mode_deploy_error_is_surfaced_and_only_reservations_are_withheld(self) -> None:
+        """
+        Issue #1425: when ReservationUtil.wait_for_one reports an error, aafter_agent returns a dict of
+        exactly one AIMessage naming the error and no jump_to (an infrastructure failure is not something
+        the model can fix by editing the definition), logs exactly one ERROR naming the network and the
+        error, and clears agent_reservations: this save created none, and the handle of the earlier
+        deploy the request carried would otherwise go back as if it were this save's. The HOCON text
+        and the metadata block are published all the same: they describe the design, which the client
+        may download and retry, and the block is the only way this turn's sample queries reach the
+        client. skip_designer keeps its value and the validation counter is not incremented, unlike on
+        a validation failure, and the definition export still runs so the client can retry with it.
+        """
+        wait_for_one: AsyncMock = self._enter_reservations_mode()
+        wait_for_one.return_value = (None, "boom")
+        client_block: dict[str, Any] = deepcopy(CLIENT_METADATA)
+        network_def: dict[str, Any] = self._network_def()
+        # Queries generated on this turn: the one part of the published block that differs from what
+        # the client sent, so the assertion below can tell "block published" from "block left as sent".
+        sly_data: dict[str, Any] = self._request(
+            queries=list(FRESH_QUERIES), skip_designer=True, client_block=client_block, network_def=network_def
+        )
+        # The request loaded its network from an earlier deploy and so carries that de
```

---

### Incident Patch 15: `a5787615` (2026-09-25)
**Commit Message**: Merge pull request #1454 from cognizant-ai-lab/fix/1425-persistor-return-contract

#1425: Report a failed temporary-network deploy to the client

**File**: `docs/examples/agent_network_designer.md` (modified, +6/-1)
```diff
@@ -352,11 +352,16 @@ back, so the block survives a save the same way the definition and the name do:
 other key are written as sent, `sample_queries` is replaced only when `agent_network_query_generator` ran on
 that turn, and in file mode `date_created` is stamped once and `date_modified` on every save. A temporary
 network gets no studio dates in its deployed spec (neuro-san records `stored_at`), but the HOCON text returned
-for download always carries a `date_created`, as a saved file would. The saved block
+for download always carries a `date_created`, as a saved file would. The resulting block
 is returned under `agent_network_metadata` for the client to send back with its next request. A
 `skip_designer` save that carries the block therefore leaves `metadata` intact. A client that sends no
 `agent_network_metadata` at all (nsflow's manual save sends nothing as of nsflow 0.7.1) gets the existing file's
 block kept in file mode; sending the key, even empty, makes the block client-owned and nothing is read from disk.
+- In reservations mode a deployment the server rejects ends the turn with an error message
+(`Error: the agent network could not be deployed as a temporary network: ...`) and clears `agent_reservations`,
+a handle the request carried from an earlier deploy included; `agent_network_definition`,
+`agent_network_hocon_text` and `agent_network_metadata` are still returned, so the network can be downloaded and
+the save retried
 - Updates the local `manifest.hocon` file in file mode
 
 ### Research Tool
```

**File**: `middleware/agent_network_designer/persistence/agent_network_persistence_middleware.py` (modified, +93/-11)
```diff
@@ -23,6 +23,7 @@
 from langchain.agents.middleware import AgentMiddleware
 from langchain.agents.middleware import AgentState
 from langchain.agents.middleware import hook_config
+from langchain.messages import AIMessage
 from langchain.messages import HumanMessage
 from langgraph.runtime import Runtime
 from neuro_san.interfaces.reservationist import Reservationist
@@ -80,6 +81,11 @@ class AgentNetworkPersistenceMiddleware(AgentMiddleware):
     (e.g., in AgentNetworkDefinitionMiddleware) and the agent needs to report that error
     rather than produce a network definition.
 
+    In reservations mode a third outcome exists: when the persistor reports that the temporary
+    network could not be deployed, the turn ends with an error message for the client, the
+    HOCON text and the metadata block are still published, and agent_reservations is cleared
+    (issue #1425, see aafter_agent and _deploy_error_response).
+
     Note: Validation is intentionally duplicated here even though individual subnetworks
     already perform their own validation. This is a safeguard for cases where the agent
     returns a final response without having called the necessary tools or subnetworks —
@@ -131,6 +137,7 @@ def __init__(self, reservationist: Reservationist, sly_data: dict[str, Any]) ->
 
     # Reenter the agent loop at the model node if validation fails.
     # If no agent network definition is present, return None to let the agent respond freely.
+    # If the temporary-network deploy fails, end the turn with an error message and no jump (issue #1425).
     # See https://github.com/cognizant-ai-lab/neuro-san-studio/blob/main/docs/user_guide.md#middleware and
     # https://reference.langchain.com/python/langchain/agents/middleware/types/hook_config for details on
     # hook_config and jump_to.
@@ -144,14 +151,20 @@ async def aafter_agent(self, state: AgentState, runtime: Runtime) -> dict[str, A
         errors are found, injects a human message with the errors and jumps back to the model
         so it can self-correct. If no definition is present, returns None so the agent can
         respond freely (e.g., to report a loading error from AgentNetworkDefinitionMiddleware).
+        In reservations mode a deployment the persistor reported as failed ends the turn with
+        an error message appended for the client; the HOCON text and the metadata block are
+        still published, since they describe the design rather than the deploy, and
+        agent_reservations is cleared, a handle the request carried included, see
+        _deploy_error_response (issue #1425).
 
         This validation acts as a final safety net: even if the agent bypassed calling
         the necessary tools or subnetworks (and thus their built-in validators never ran),
         errors will still be caught here before the network is persisted.
 
         :param state: Current agent state
         :param runtime: Runtime context
-        :return: Dict with error message and jump directive, or None if valid
+        :return: Dict with error message and jump directive on a validation failure, dict with
+                the error message alone on a failed deployment, or None otherwise
         """
         network_def: dict[str, Any] = self.sly_data.get(AGENT_NETWORK_DEFINITION)
         agent_network_name: str = self.sly_data.get(AGENT_NETWORK_NAME)
@@ -205,7 +218,10 @@ async def aafter_agent(self, state: AgentState, runtime: Runtime) -> dict[str, A
 
             sample_queries: list[str] = self.sly_data.get(AGENT_NETWORK_QUERIES, [])
 
-            await self._assemble_and_persist(network_def, agent_network_name, sample_queries)
+            # None means the save happened; a str is the deploy error the reservations persistor reported.
+            deploy_error: str | None = await self._assemble_and_persist(
+                network_def, agent_network_name, sample_queries
+            )
 
             agent_progress_style: str = environ.get("AGENT_NETWORK_DESIGNER_PROGRESS_STYLE", "internal")
 
@@ -218,10 +234,16 @@ async def aafter_agent(self, state: AgentState, runtime: Runtime) -> dict[str, A
             # and HOCON parse on the event loop.
             if agent_progress_style == "connectivity":
                 await ConnectivityDictionaryConverter.get_shared_toolbox_factory()
+            # The export runs on a deploy error too: the definition handed back describes the network
+            # the client asked for and is what it needs to retry the save; it does not depend on the
+            # deploy. Only agent_reservations is withheld, see _assemble_and_persist.
             self._determine_exported_network_definition(self.sly_data, agent_progress_style)
 
             self.logger.debug(">>>>>>>>>>>>>>>>>>> DONE %s !!!>>>>>>>>>>>>>>>>>>", self.__class__.__name__)
 
+            if deploy_error is not None:
+                return self._deploy_error_response(deploy_error)
+
         return None
 
     def _error_response(self, c
```

**File**: `registries/agent_network_designer.hocon` (modified, +5/-4)
```diff
@@ -206,17 +206,18 @@ Send agent_network_metadata back with it so the saved network keeps its metadata
                             "type": "string",
                             "description": """
 The contents of an agent network HOCON file describing the created network. In file mode this is exactly
-the saved file. In reservations mode it is the downloadable form of the deployed network and carries a
-date_created the deployed spec does not have.
+the saved file. In reservations mode it is the downloadable form of the network, returned whether or not the
+deploy succeeded, and carries a date_created the deployed spec does not have.
 """
                         },
                         "agent_network_metadata": {
                             "type": "object",
                             "description": """
 The network's top-level metadata block exactly as written into the saved network and as connectivity()
 serves it, minus the reservation and stored_at keys neuro-san's reservation storage adds to a temporary
-network. Send it back unchanged with the next request (see the input schema). Present after a save and
-after a network was loaded from agent_network_hocon_file or a reservation; absent otherwise.
+network. Send it back unchanged with the next request (see the input schema). Present after a save attempt,
+a rejected temporary-network deploy included, and after a network was loaded from agent_network_hocon_file
+or a reservation; absent otherwise.
 """,
                             "properties": {
                                 "description": {"type": "string"},
```

**File**: `tests/middleware/agent_network_designer/persistence/test_agent_network_persistence_middleware.py` (modified, +73/-4)
```diff
@@ -18,7 +18,8 @@
 Tests for AgentNetworkPersistenceMiddleware.aafter_agent: validation gating and the stateless
 handling of the persisted metadata block (issue #1398) in both file mode and reservations mode,
 including the compatibility fallback that reads the block of the network about to be overwritten
-when the client sent no agent_network_metadata key at all.
+when the client sent no agent_network_metadata key at all, and the surfacing of a failed
+temporary-network deployment (issue #1425).
 """
 
 import json
@@ -35,6 +36,7 @@
 from unittest import mock
 from unittest.mock import AsyncMock
 
+from langchain.messages import AIMessage
 from langchain.messages import HumanMessage
 from neuro_san.interfaces.reservation import Reservation
 from neuro_san.interfaces.reservationist import Reservationist
@@ -66,7 +68,8 @@
 # distinct from None, which _request sends as an explicit null: the middleware treats both alike
 # (fallback read), and the tests must be able to show that for each of them separately.
 NO_BLOCK: object = object()
-# Logger names the persistor and the metadata block warn on; both are built from the class name.
+# Logger names the middleware, the persistor and the metadata block log on; all are built from the class name.
+MIDDLEWARE_LOGGER: str = "AgentNetworkPersistenceMiddleware"
 PERSISTOR_LOGGER: str = "FileSystemAgentNetworkPersistor"
 METADATA_LOGGER: str = "AgentNetworkMetadataBlock"
 SAMPLE_QUERIES: list[str] = ["What can you do?", "Help me with X"]
@@ -181,7 +184,9 @@ def _enter_reservations_mode(self) -> AsyncMock:
         Switch the middleware to reservations mode and stub the neuro-san deployment call.
 
         The fake Reservation reports RESERVATION_ID / LIFETIME_SECONDS / EXPIRATION_SECONDS, which
-        ReservationsAgentNetworkPersistor echoes into sly_data["agent_reservations"].
+        ReservationsAgentNetworkPersistor echoes into sly_data["agent_reservations"]. A test that
+        needs a failed deploy sets the mock's return_value to (None, "<error>"), the shape
+        ReservationUtil.wait_for_one uses to report one.
 
         :return: The AsyncMock standing in for ReservationUtil.wait_for_one, so a test can inspect
                 the agent_spec it was awaited with (positional argument 1) and the prefix (argument 3)
@@ -254,7 +259,8 @@ async def _save(sly_data: dict[str, Any]) -> dict[str, Any] | None:
         over from one request to the next.
 
         :param sly_data: The request's sly_data, mutated in place by the middleware
-        :return: What aafter_agent returned: None on success, a jump_to dict on validation failure
+        :return: What aafter_agent returned: None on success, a jump_to dict on validation failure,
+                a messages-only dict on a failed deploy
         """
         middleware: AgentNetworkPersistenceMiddleware = AgentNetworkPersistenceMiddleware(Reservationist(), sly_data)
         return await middleware.aafter_agent({}, None)
@@ -716,6 +722,69 @@ async def test_reservations_mode_passes_client_dates_through_unchanged(self) ->
         self.assertNotIn("date_modified", agent_spec["metadata"])
         self.assertEqual(sly_data["agent_network_metadata"], CLIENT_METADATA)
 
+    async def test_reservations_mode_deploy_error_is_surfaced_and_only_reservations_are_withheld(self) -> None:
+        """
+        Issue #1425: when ReservationUtil.wait_for_one reports an error, aafter_agent returns a dict of
+        exactly one AIMessage naming the error and no jump_to (an infrastructure failure is not something
+        the model can fix by editing the definition), logs exactly one ERROR naming the network and the
+        error, and clears agent_reservations: this save created none, and the handle of the earlier
+        deploy the request carried would otherwise go back as if it were this save's. The HOCON text
+        and the metadata block are published all the same: they describe the design, which the client
+        may download and retry, and the block is the only way this turn's sample queries reach the
+        client. skip_designer keeps its value and the validation counter is not incremented, unlike on
+        a validation failure, and the definition export still runs so the client can retry with it.
+        """
+        wait_for_one: AsyncMock = self._enter_reservations_mode()
+        wait_for_one.return_value = (None, "boom")
+        client_block: dict[str, Any] = deepcopy(CLIENT_METADATA)
+        network_def: dict[str, Any] = self._network_def()
+        # Queries generated on this turn: the one part of the published block that differs from what
+        # the client sent, so the assertion below can tell "block published" from "block left as sent".
+        sly_data: dict[str, Any] = self._request(
+            queries=list(FRESH_QUERIES), skip_designer=True, client_block=client_block, network_def=network_def
+        )
+        # The request loaded its network from an earlier deploy and so carries that de
```

#### Recent Merged Pull Requests:
- **PR #1479** (2026-10-02): Upgrade neuro-san to 0.7.7, nsflow to 0.7.4 and leaf-common to 1.4.4 (@Noravee)
- **PR #1478** (2026-10-01): Bump build-common to 1.0.13 (@donn-leaf)
- **PR #1473** (closed): Ignore serply.io in the lychee link check (@devin-ai-integration[bot])
- **PR #1472** (2026-09-29): Temporarily ignore serply.io URLs while serply.io is down (@ofrancon)
- **PR #1469** (2026-09-30): Add directives to AGENTS.md (@ofrancon)
- **PR #1468** (2026-09-25): #1441: Remove the unneeded future annotations import and use typing.Self in its place (@Noravee)
- **PR #1467** (2026-09-30): #1458: ANDe strip common instructions from agent_network_definition instructions (@Noravee)
- **PR #1465** (2026-09-25): #1464: Remove the OpenAI video generation tool now that OpenAI has shut down the Videos API (@Noravee)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
