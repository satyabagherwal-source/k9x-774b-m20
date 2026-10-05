# Forensic Learning Record (Deep Inspection): D4Vinci/Scrapling

> **Canonical Artifact**: `07_PROJECT_LEARNING/d4vinci-scrapling-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/D4Vinci/Scrapling](https://github.com/D4Vinci/Scrapling))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:45:32.299Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `D4Vinci/Scrapling`
- **Description**: 🕷️ An adaptive Web Scraping framework that handles everything from a single request to a full-scale crawl! Don't be shy, join here: https://discord.gg/EMgGbDceNQ and follow here for daily tips and tricks: https://x.com/Scrapling_dev
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 85821 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scrapling/core/_shell_signatures.py`
```
from scrapling.core._types import (
    Any,
    Dict,
    List,
    Set,
    Tuple,
    Sequence,
    Callable,
    Optional,
    SetCookieParam,
    SelectorWaitStates,
    FollowRedirects,
)

# Parameter definitions for shell function signatures (defined once at module level)
# Mirrors TypedDict definitions from _types.py but runtime-accessible for IPython introspection
_REQUESTS_PARAMS = {
    "params": Optional[Dict | List | Tuple],
    "cookies": Any,
    "auth": Optional[Tuple[str, str]],
    "impersonate": Any,
    "http3": Optional[bool],
    "stealthy_headers": Optional[bool],
    "proxies": Any,
    "proxy": Optional[str],
    "proxy_auth": Optional[Tuple[str, str]],
    "timeout": Optional[int | float],
    "headers": Any,
    "retries": Optional[int],
    "retry_delay": Optional[int],
    "follow_redirects": Optional[FollowRedirects],
    "max_redirects": Optional[int],
    "verify": Optional[bool],
    "cert": Optional[str | Tuple[str, str]],
    "selector_config": Optional[Dict],
}

_FETCH_PARAMS = {
    "headless": bool,
    "disable_resources": bool,
    "network_idle": bool,
    "load_dom": bool,
    "wait_selector": Optional[str],
    "wait_selector_state": SelectorWaitStates,
    "cookies": Sequence[SetCookieParam],
    "google_search": bool,
    "wait": int | float,
    "timezone_id": str | None,
    "page_action": Optional[Callable],
    "page_setup": Optional[Callable],
    "proxy": Optional[str | Dict[str, str] | Tuple],
    "extra_headers": Optional[Dict[str, str]],
    "timeout": int | float,
    "init_script": Optional[str],
    "user_data_dir": str,
    "selector_config": Optional[Dict],
    "additional_args": Optional[Dict],
    "locale": Optional[str],
    "real_chrome": bool,
    "cdp_url": Optional[str],
    "useragent": Optional[str],
    "extra_flags": Optional[List[str]],
    "blocked_domains": Optional[Set[str]],
    "block_ads": bool,
    "retries": int,
    "retry_delay": int | float,
    "capture_xhr": str | None,
    "executable_path": Optional[str],
    "dns_over_https": bool,
}

_STEALTHY_FETCH_PARAMS = {
    "headless": bool,
    "disable_resources": bool,
    "network_idle": bool,
    "load_dom": bool,
    "wait_selector": Optional[str],
    "wait_selector_state": SelectorWaitStates,
    "cookies": Sequence[SetCookieParam],
    "google_search": bool,
    "wait": int | float,
    "timezone_id": str | None,
    "page_action": Optional[Callable],
    "page_setup": Optional[Callable],
    "proxy": Optional[str | Dict[str, str] | Tuple],
    "extra_headers": Optional[Dict[str, str]],
    "timeout": int | float,
    "init_script": Optional[str],
    "user_data_dir": str,
    "selector_config": Optional[Dict],
    "additional_args": Optional[Dict],
    "locale": Optional[str],
    "real_chrome": bool,
    "cdp_url": Optional[str],
    "useragent": Optional[str],
    "extra_flags": Optional[List[str]],
    "blocked_domains": Optional[Set[str]],
    "block_ads": bool,
    "retries": int,
    "retry_delay": int | float,
    "capture_xhr": str | None,
    "executable_path": Optional[str],
    "dns_over_https": bool,
    "allow_webgl": bool,
    "hide_canvas": bool,
    "block_webrtc": bool,
    "solve_cloudflare": bool,
}

# Mapping of function names to their parameter definitions
Signatures_map = {
    "get": _REQUESTS_PARAMS,
    "post": {**_REQUESTS_PARAMS, "data": Optional[Dict | str], "json": Optional[Dict | List]},
    "put": {**_REQUESTS_PARAMS, "data": Optional[Dict | str], "json": Optional[Dict | List]},
    "delete": _REQUESTS_PARAMS,
    "fetch": _FETCH_PARAMS,
    "stealthy_fetch": _STEALTHY_FETCH_PARAMS,
}

```

### Core Architecture Module: `scrapling/core/_types.py`
```
"""
Type definitions for type checking purposes.
"""

from typing import (
    TYPE_CHECKING,
    TypeAlias,
    cast,
    overload,
    Any,
    Callable,
    Dict,
    Generator,
    AsyncGenerator,
    Generic,
    Iterable,
    List,
    Set,
    Literal,
    Optional,
    Iterator,
    Pattern,
    Sequence,
    Tuple,
    TypeVar,
    Union,
    Match,
    Mapping,
    Awaitable,
    Protocol,
    Coroutine,
    SupportsIndex,
)
from typing_extensions import Self, Unpack, TypedDict

# Proxy can be a string URL or a dict (Playwright format: {"server": "...", "username": "...", "password": "..."})
ProxyType = Union[str, Dict[str, str]]
SUPPORTED_HTTP_METHODS = Literal["GET", "POST", "PUT", "DELETE"]
SelectorWaitStates = Literal["attached", "detached", "hidden", "visible"]
PageLoadStates = Literal["commit", "domcontentloaded", "load", "networkidle"]
extraction_types = Literal["text", "html", "markdown"]
StrOrBytes = Union[str, bytes]
FollowRedirects = Union[bool, Literal["safe", "all", "obeycode", "firstonly"]]


# Copied from `playwright._impl._api_structures.SetCookieParam`
class SetCookieParam(TypedDict, total=False):
    name: str
    value: str
    url: Optional[str]
    domain: Optional[str]
    path: Optional[str]
    expires: Optional[float]
    httpOnly: Optional[bool]
    secure: Optional[bool]
    sameSite: Optional[Literal["Lax", "None", "Strict"]]
    partitionKey: Optional[str]

```

### Core Architecture Module: `scrapling/core/ai.py`
```
from uuid import uuid4
from os import environ
from hmac import compare_digest
from asyncio import gather
from datetime import datetime, timezone
from dataclasses import dataclass, field

from mcp.server import MCPServer
from mcp.server.mcpserver import Image
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.caching import CacheHint
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import Icon, ImageContent, TextContent, ToolAnnotations
from pydantic import AnyHttpUrl, BaseModel, Field

from scrapling import __version__
from scrapling.core.utils import log
from scrapling.core.shell import Convertor, _CONTROL_CHARS_PATTERN
from scrapling.engines.toolbelt.custom import Response as _ScraplingResponse
from scrapling.engines.static import ImpersonateType
from scrapling.fetchers import (
    FetcherSession,
    AsyncDynamicSession,
    AsyncStealthySession,
)
from scrapling.engines._browsers._types import PlaywrightFetchParams, StealthFetchParams
from scrapling.core._types import (
    Optional,
    Literal,
    Union,
    Tuple,
    Mapping,
    Dict,
    List,
    Any,
    Set,
    Sequence,
    SetCookieParam,
    extraction_types,
    SelectorWaitStates,
    FollowRedirects,
    SUPPORTED_HTTP_METHODS,
)

SessionType = Literal["dynamic", "stealthy", "static"]
BrowserSessionType = Literal["dynamic", "stealthy"]
ScreenshotType = Literal["png", "jpeg"]
MCP_EXECUTABLE_PATH_ENV = "SCRAPLING_EXECUTABLE_PATH"
MCP_AUTH_TOKEN_ENV = "SCRAPLING_MCP_AUTH_TOKEN"  # nosec B105 - the name of the variable, not a token

_MAX_POOL_PAGES = 50  # Upper bound of `PagesCount` in scrapling/engines/_browsers/_validators.py


def _page_pool_size(urls: Sequence[str]) -> int:
    """Return a page pool size that covers the batch without leaving the validator's bounds."""
    return min(max(len(urls), 1), _MAX_POOL_PAGES)


def _typed_dict_keys(typed_dict: Any) -> frozenset:
    """Collect all the keys a TypedDict holds, including the inherited ones."""
    return frozenset(typed_dict.__required_keys__ | typed_dict.__optional_keys__)


_EXCLUDED_FETCH_KEYS = frozenset({"page_action", "page_setup", "selector_config", "proxy"})
_PLAYWRIGHT_FETCH_KEYS = _typed_dict_keys(PlaywrightFetchParams) - _EXCLUDED_FETCH_KEYS
_STEALTH_FETCH_KEYS = _typed_dict_keys(StealthFetchParams) - _EXCLUDED_FETCH_KEYS


def _session_settings(session: Any) -> Dict[str, Any]:
    """Extract the JSON-safe effective settings of a session, for the AI agent."""
    if isinstance(session, FetcherSession):
        fields = {"stealthy_headers": session._stealth} | {
            f.removeprefix("_default_"): getattr(session, f)
            for f in FetcherSession.__slots__
            if f.startswith("_default")
        }
        return {
            name: value for name, value in fields.items() if isinstance(value, (str, int, float, bool)) or value is None
        }
    config = session._config
    if config.cdp_url:
        return {}
    return {
        f: value
        for f in config.__struct_fields__
        if isinstance(value := getattr(config, f), (str, int, float, bool)) or value is None
    }


_FETCH_TOOL_ANNOTATIONS = ToolAnnotations(read_only_hint=True, open_world_hint=True)
_SESSION_TOOL_ANNOTATIONS = ToolAnnotations(read_only_hint=False, destructive_hint=False, open_world_hint=True)
_LIST_TOOL_ANNOTATIONS = ToolAnnotations(read_only_hint=True, open_world_hint=False)


class ResponseModel(BaseModel):
    """Request's response information structure."""

    status: int = Field(description="The status code returned by the website.")
    content: list[str] = Field(description="The content as Markdown/HTML or the text content of the page.")
    url: str = Field(description="The URL given by the user that resulted in this response.")


class SessionInfo(BaseModel):
    """Information about an open browser session."""

    session_id: str = Field(description="The unique identifier of the session.")
    session_type: SessionType = Field(description="The type of the session: 'dynamic', 'stealthy', or 'static'.")
    created_at: str = Field(description="ISO timestamp of when the session was created.")
    is_alive: bool = Field(description="Whether the session is still alive and usable.")
    settings: Dict[str, Any] = Field(
        default_factory=dict,
        description="The effective settings this session was created with.",
    )


class SessionCreatedModel(SessionInfo):
    """Response returned when a new session is created."""

    message: str = Field(description="A confirmation message.")


class SessionClosedModel(BaseModel):
    """Response returned when a session is closed."""

    session_id: str = Field(description="The unique identifier of the closed session.")
    message: str = Field(description="A confirmation message.")


@dataclass
class _SessionEntry:
    session: Any  # AsyncDynamicSession | AsyncStealthySession | FetcherSession
    session_type: SessionType
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def _translate_response(
    page: _ScraplingResponse,
    extraction_type: extraction_types,
    css_selector: Optional[str],
    main_content_only: bool,
) -> ResponseModel:
    """Extract content from a response and translate it to a ResponseModel."""
    content = [
        _CONTROL_CHARS_PATTERN.sub("", chunk)
        for chunk in Convertor._extract_content(
            page,
            css_selector=css_selector,
            extraction_type=extraction_type,
            main_content_only=main_content_only,
        )
    ]
    return ResponseModel(status=page.status, content=content, url=page.url)


def _normalize_credentials(credentials: Optional[Dict[str, str]]) -> Optional[Tuple[str, str]]:
    """Convert a credentials dictionary to a tuple accepted by fetchers."""
    if not credentials:
        return None

    username = credentials.get("username")
    password = credentials.get("password")

    if username is None or password is None:
        raise ValueError("Credentials dictionary must contain both 'username' and 'password' keys")

    return username, password


class _StaticTokenVerifier(TokenVerifier):
    """Verifies requests against a single shared bearer token."""

    def __init__(self, token: str):
        self._token = token.encode()

    async def verify_token(self, token: str) -> Optional[AccessToken]:
        if compare_digest(token.encode(), self._token):
            return AccessToken(token=token, client_id="scrapling-mcp", scopes=[])
        return None


class ScraplingMCPServer:
    def __init__(self, executable_path: Optional[str] = None, auth_token: Optional[str] = None):
        """Create a Scrapling MCP server.

        :param executable_path: Optional global Chromium-compatible browser executable path for browser tools.
            If omitted, the SCRAPLING_EXECUTABLE_PATH environment variable is used when set.
        :param auth_token: Optional shared token that clients must send as `Authorization: Bearer <token>`.
            If omitted, the SCRAPLING_MCP_AUTH_TOKEN environment variable is used when set. It only applies
            to the streamable-http transport.
        """
        self._sessions: Dict[str, _SessionEntry] = {}
        self._executable_path = executable_path or environ.get(MCP_EXECUTABLE_PATH_ENV) or None
        self._auth_token = auth_token or environ.get(MCP_AUTH_TOKEN_ENV) or None

    def _resolve_executable_path(self, executable_path: Optional[str]) -> Optional[str]:
        """Return a per-call executable path or the server-wide default."""
        return executable_path or self._executable_path

    def _get_session(self, session_id: str, expected_type: Optional[SessionType]) -> _SessionEntry:
        """Look up a session by ID, optionally validating its type. Pass `None` to skip the type check."""
        entry = self._sessions.get(session_id)
        if entry is None:
            raise ValueError(f"Session '{session_id}' not found. Use list_sessions to see active sessions.")
        if not entry.session._is_alive:
            raise ValueError(f"Session '{session_id}' is no longer alive. Open a new session.")
        if expected_type is not None and entry.session_type != expected_type:
            raise ValueError(
                f"Session '{session_id}' is a '{entry.session_type}' session, but this tool requires a "
                f"'{expected_type}' session. Use the matching fetch tool for your session type."
            )
        return entry

    def _new_session_id(self, session_id: Optional[str]) -> str:
        """Generate a session ID when none is given, and reject duplicates."""
        session_id = session_id or uuid4().hex[:12]
        if session_id in self._sessions:
            raise ValueError(
                f"Session '{session_id}' already exists. Use a different ID or close the existing session first."
            )
        return session_id

    def _register_session(self, session_id: str, session: Any, session_type: SessionType) -> SessionCreatedModel:
        """Store a started session and build its creation receipt."""
        entry = _SessionEntry(session=session, session_type=session_type)
        self._sessions[session_id] = entry
        return SessionCreatedModel(
            session_id=session_id,
            session_type=session_type,
            created_at=entry.created_at,
            is_alive=True,
            settings=_session_settings(session),
            message=f"Session '{session_id}' ({session_type}) created successfully.",
        )

    async def open_session(
        self,
        session_type: BrowserSessionType,
        session_id: Optional[str] = None,
        headless: bool = True,
        real_chrome: bool = False,
        timezone_id: str | None = None,
        locale: str | None = None,
        useragent: Optional[str] = None,
        proxy: Optional[str | Dict[str, str]] = N
```

### Core Architecture Module: `scrapling/core/custom_types.py`
```
from collections.abc import Mapping
from types import MappingProxyType
from re import compile as re_compile, UNICODE, IGNORECASE

from orjson import dumps, loads
from w3lib.html import replace_entities as _replace_entities

from scrapling.core._types import (
    Any,
    cast,
    Dict,
    List,
    Union,
    overload,
    TypeVar,
    Literal,
    Pattern,
    Iterable,
    Generator,
    SupportsIndex,
)
from scrapling.core.utils import _is_iterable, flatten, __CONSECUTIVE_SPACES_REGEX__

# Define type variable for AttributeHandler value type
_TextHandlerType = TypeVar("_TextHandlerType", bound="TextHandler")
__CLEANING_TABLE__ = str.maketrans("\t\r\n", "   ")


class TextHandler(str):
    """Extends standard Python string by adding more functionality"""

    __slots__ = ()

    def __getitem__(self, key: SupportsIndex | slice) -> "TextHandler":  # pragma: no cover
        lst = super().__getitem__(key)
        return TextHandler(lst)

    def split(self, sep: str | None = None, maxsplit: SupportsIndex = -1) -> list[Any]:  # pragma: no cover
        return TextHandlers([TextHandler(s) for s in super().split(sep, maxsplit)])

    def strip(self, chars: str | None = None) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().strip(chars))

    def lstrip(self, chars: str | None = None) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().lstrip(chars))

    def rstrip(self, chars: str | None = None) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().rstrip(chars))

    def capitalize(self) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().capitalize())

    def casefold(self) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().casefold())

    def center(self, width: SupportsIndex, fillchar: str = " ") -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().center(width, fillchar))

    def expandtabs(self, tabsize: SupportsIndex = 8) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().expandtabs(tabsize))

    def format(self, *args: object, **kwargs: object) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().format(*args, **kwargs))

    def format_map(self, mapping) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().format_map(mapping))

    def join(self, iterable: Iterable[str]) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().join(iterable))

    def ljust(self, width: SupportsIndex, fillchar: str = " ") -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().ljust(width, fillchar))

    def rjust(self, width: SupportsIndex, fillchar: str = " ") -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().rjust(width, fillchar))

    def swapcase(self) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().swapcase())

    def title(self) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().title())

    def translate(self, table) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().translate(table))

    def zfill(self, width: SupportsIndex) -> Union[str, "TextHandler"]:  # pragma: no cover
        return TextHandler(super().zfill(width))

    def replace(self, old: str, new: str, count: SupportsIndex = -1) -> Union[str, "TextHandler"]:
        return TextHandler(super().replace(old, new, count))

    def upper(self) -> Union[str, "TextHandler"]:
        return TextHandler(super().upper())

    def lower(self) -> Union[str, "TextHandler"]:
        return TextHandler(super().lower())

    ##############

    def sort(self, reverse: bool = False) -> Union[str, "TextHandler"]:
        """Return a sorted version of the string"""
        return self.__class__("".join(sorted(self, reverse=reverse)))

    def clean(self, remove_entities=False) -> Union[str, "TextHandler"]:
        """Return a new version of the string after removing all white spaces and consecutive spaces"""
        data = self.translate(__CLEANING_TABLE__)
        if remove_entities:
            data = _replace_entities(data)
        return self.__class__(__CONSECUTIVE_SPACES_REGEX__.sub(" ", data).strip())

    # For easy copy-paste from Scrapy/parsel code when needed :)
    def get(self, default=None):  # pragma: no cover
        return self

    def getall(self):  # pragma: no cover
        return self

    extract = getall
    extract_first = get

    def json(self) -> Dict:
        """Return JSON response if the response is jsonable otherwise throw error"""
        # Using str function as a workaround for orjson issue with subclasses of str.
        # Check this out: https://github.com/ijl/orjson/issues/445
        return loads(str(self))

    @overload
    def re(
        self,
        regex: str | Pattern,
        replace_entities: bool = True,
        clean_match: bool = False,
        case_sensitive: bool = True,
        *,
        check_match: Literal[True],
    ) -> bool: ...

    @overload
    def re(
        self,
        regex: str | Pattern,
        replace_entities: bool = True,
        clean_match: bool = False,
        case_sensitive: bool = True,
        check_match: Literal[False] = False,
    ) -> "TextHandlers": ...

    def re(
        self,
        regex: str | Pattern,
        replace_entities: bool = True,
        clean_match: bool = False,
        case_sensitive: bool = True,
        check_match: bool = False,
    ) -> Union["TextHandlers", bool]:
        """Apply the given regex to the current text and return a list of strings with the matches.

        :param regex: Can be either a compiled regular expression or a string.
        :param replace_entities: If enabled character entity references are replaced by their corresponding character
        :param clean_match: If enabled, this will ignore all whitespaces and consecutive spaces while matching
        :param case_sensitive: If disabled, function will set the regex to ignore the letters-case while compiling it
        :param check_match: Used to quickly check if this regex matches or not without any operations on the results

        """
        if isinstance(regex, str):
            if case_sensitive:
                regex = re_compile(regex, UNICODE)
            else:
                regex = re_compile(regex, flags=UNICODE | IGNORECASE)

        input_text = self.clean() if clean_match else self
        results = regex.findall(input_text)
        if check_match:
            return bool(results)

        if all(_is_iterable(res) for res in results):
            results = flatten(results)

        if not replace_entities:
            return TextHandlers([TextHandler(string) for string in results])

        return TextHandlers([TextHandler(_replace_entities(s)) for s in results])

    def re_first(
        self,
        regex: str | Pattern,
        default: Any = None,
        replace_entities: bool = True,
        clean_match: bool = False,
        case_sensitive: bool = True,
    ) -> "TextHandler":
        """Apply the given regex to text and return the first match if found, otherwise return the default value.

        :param regex: Can be either a compiled regular expression or a string.
        :param default: The default value to be returned if there is no match
        :param replace_entities: If enabled character entity references are replaced by their corresponding character
        :param clean_match: If enabled, this will ignore all whitespaces and consecutive spaces while matching
        :param case_sensitive: If disabled, function will set the regex to ignore the letters-case while compiling it

        """
        result = self.re(
            regex,
            replace_entities,
            clean_match=clean_match,
            case_sensitive=case_sensitive,
        )
        return result[0] if result else default


class TextHandlers(List[TextHandler]):
    """
    The :class:`TextHandlers` class is a subclass of the builtin ``List`` class, which provides a few additional methods.
    """

    __slots__ = ()

    @overload
    def __getitem__(self, pos: SupportsIndex) -> TextHandler:  # pragma: no cover
        pass

    @overload
    def __getitem__(self, pos: slice) -> "TextHandlers":  # pragma: no cover
        pass

    def __getitem__(self, pos: SupportsIndex | slice) -> Union[TextHandler, "TextHandlers"]:
        lst = super().__getitem__(pos)
        if isinstance(pos, slice):
            return TextHandlers(cast(List[TextHandler], lst))
        return TextHandler(cast(TextHandler, lst))

    def re(
        self,
        regex: str | Pattern,
        replace_entities: bool = True,
        clean_match: bool = False,
        case_sensitive: bool = True,
    ) -> "TextHandlers":
        """Call the ``.re()`` method for each element in this list and return
        their results flattened as TextHandlers.

        :param regex: Can be either a compiled regular expression or a string.
        :param replace_entities: If enabled character entity references are replaced by their corresponding character
        :param clean_match: if enabled, this will ignore all whitespaces and consecutive spaces while matching
        :param case_sensitive: if disabled, the function will set the regex to ignore the letters-case while compiling it
        """
        results = [n.re(regex, replace_entities, clean_match, case_sensitive) for n in self]
        return TextHandlers(flatten(results))

    def re_first(
        self,
        regex: str | Pattern,
        default: Any = None,
        replace_entities: bool = True,
        clean_match: bool = False,
        case_sensitive: bool = True,
    ) -> TextHandler:  # pragma: no cover
        """Call the ``.re_first()`` method for each el
```

### Core Architecture Module: `scrapling/core/mixins.py`
```
from scrapling.core._types import Any, Dict


class SelectorsGeneration:
    """
    Functions for generating selectors
    Trying to generate selectors like Firefox or maybe cleaner ones!? Ehm
    Inspiration: https://searchfox.org/mozilla-central/source/devtools/shared/inspector/css-logic.js#591
    """

    # Note: This is a mixin class meant to be used with Selector.
    # The methods access Selector attributes (._root, .parent, .attrib, .tag, etc.)
    # through self, which will be a Selector instance at runtime.

    def _general_selection(self: Any, selection: str = "css", full_path: bool = False) -> str:
        """Generate a selector for the current element.
        :return: A string of the generated selector.
        """
        if self._is_text_node(self._root):
            return ""

        selectorPath = []
        target = self
        css = selection.lower() == "css"
        while target is not None:
            if target.parent:
                if target.attrib.get("id"):
                    # id is enough
                    if css:
                        part = f"#{target.attrib['id']}"
                    elif full_path:
                        part = f"*[@id='{target.attrib['id']}']"
                    else:
                        part = f"[@id='{target.attrib['id']}']"
                    selectorPath.append(part)
                    if not full_path:
                        return " > ".join(reversed(selectorPath)) if css else "//*" + "/".join(reversed(selectorPath))
                else:
                    part = f"{target.tag}"
                    # We won't use classes anymore because I some websites share exact classes between elements
                    # classes = target.attrib.get('class', '').split()
                    # if classes and css:
                    #     part += f".{'.'.join(classes)}"
                    # else:
                    counter: Dict[str, int] = {}
                    for child in target.parent.children:
                        counter.setdefault(child.tag, 0)
                        counter[child.tag] += 1
                        if child._root == target._root:
                            break

                    if counter[target.tag] > 1:
                        part += f":nth-of-type({counter[target.tag]})" if css else f"[{counter[target.tag]}]"

                    selectorPath.append(part)
                target = target.parent
                if target is None or target.tag == "html":
                    return " > ".join(reversed(selectorPath)) if css else "//" + "/".join(reversed(selectorPath))
            else:
                break

        return " > ".join(reversed(selectorPath)) if css else "//" + "/".join(reversed(selectorPath))

    @property
    def generate_css_selector(self: Any) -> str:
        """Generate a CSS selector for the current element
        :return: A string of the generated selector.
        """
        return self._general_selection()

    @property
    def generate_full_css_selector(self: Any) -> str:
        """Generate a complete CSS selector for the current element
        :return: A string of the generated selector.
        """
        return self._general_selection(full_path=True)

    @property
    def generate_xpath_selector(self: Any) -> str:
        """Generate an XPath selector for the current element
        :return: A string of the generated selector.
        """
        return self._general_selection("xpath")

    @property
    def generate_full_xpath_selector(self: Any) -> str:
        """Generate a complete XPath selector for the current element
        :return: A string of the generated selector.
        """
        return self._general_selection("xpath", full_path=True)

```

### Core Architecture Module: `scrapling/core/shell.py`
```
# -*- coding: utf-8 -*-
from sys import stderr
from copy import deepcopy
from functools import wraps
from re import sub as re_sub, compile as re_compile
from collections import namedtuple
from shlex import split as shlex_split
from inspect import signature, Parameter
from tempfile import mkstemp as make_temp_file
from argparse import ArgumentParser, SUPPRESS
from webbrowser import open as open_in_browser
from urllib.parse import urlparse, urlunparse, parse_qsl
from logging import (
    DEBUG,
    INFO,
    WARNING,
    ERROR,
    CRITICAL,
    FATAL,
    getLogger,
    getLevelName,
)

from lxml.etree import XPath
from orjson import loads as json_loads, JSONDecodeError

from ._shell_signatures import Signatures_map
from scrapling import __version__
from scrapling.core.utils import log
from scrapling.parser import Selector, Selectors
from scrapling.core.custom_types import TextHandler
from scrapling.engines.toolbelt.custom import Response
from scrapling.core.utils._shell import _ParseHeaders, _CookieParser
from scrapling.core._types import (
    Callable,
    Dict,
    Any,
    cast,
    Optional,
    Generator,
    extraction_types,
)


_known_logging_levels = {
    "debug": DEBUG,
    "info": INFO,
    "warning": WARNING,
    "error": ERROR,
    "critical": CRITICAL,
    "fatal": FATAL,
}


# Define the structure for parsed context - Simplified for Fetcher args
Request = namedtuple(
    "Request",
    [
        "method",
        "url",
        "params",
        "data",  # Can be str, bytes, or dict (for urlencoded)
        "json_data",  # Python object (dict/list) for JSON payload
        "headers",
        "cookies",
        "proxy",
        "follow_redirects",  # Added for -L flag
    ],
)

# Precompiled for the prompt injection sanitizer
_HIDDEN_XPATH = XPath(
    './/*[contains(@style,"display:none") or contains(@style,"display: none")'
    ' or contains(@style,"visibility:hidden") or contains(@style,"visibility: hidden")'
    ' or contains(@style,"opacity:0") or contains(@style,"opacity: 0")'
    ' or contains(@style,"font-size:0") or contains(@style,"font-size: 0")'
    ' or contains(@style,"height:0") or contains(@style,"height: 0")'
    ' or contains(@style,"width:0") or contains(@style,"width: 0")]'
    " | .//*[@aria-hidden='true']"
    " | .//template"
)
_ZWC_PATTERN = re_compile(r"[\u200b\u200c\u200d\ufeff\u2060\u180e]")
_CONTROL_CHARS_PATTERN = re_compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


# Suppress exit on error to handle parsing errors gracefully
class NoExitArgumentParser(ArgumentParser):  # pragma: no cover
    def error(self, message):
        log.error(f"Curl arguments parsing error: {message}")
        raise ValueError(f"Curl arguments parsing error: {message}")

    def exit(self, status=0, message=None):
        if message:
            log.error(f"Scrapling shell exited with status {status}: {message}")
            self._print_message(message, stderr)
        raise ValueError(f"Scrapling shell exited with status {status}: {message or 'Unknown reason'}")


class CurlParser:
    """Builds the argument parser for relevant curl flags from DevTools."""

    def __init__(self) -> None:
        from scrapling.fetchers import Fetcher as __Fetcher

        self.__fetcher = __Fetcher
        # We will use argparse parser to parse the curl command directly instead of regex
        # We will focus more on flags that will show up on curl commands copied from DevTools's network tab
        _parser = NoExitArgumentParser(add_help=False)  # Disable default help
        # Basic curl arguments
        _parser.add_argument("curl_command_placeholder", nargs="?", help=SUPPRESS)
        _parser.add_argument("url")
        _parser.add_argument("-X", "--request", dest="method", default=None)
        _parser.add_argument("-H", "--header", action="append", default=[])
        _parser.add_argument(
            "-A", "--user-agent", help="Will be parsed from -H if present"
        )  # Note: DevTools usually includes this in -H

        # Data arguments (prioritizing types common from DevTools)
        _parser.add_argument("-d", "--data", default=None)
        _parser.add_argument("--data-raw", default=None)  # Often used by browsers for JSON body
        _parser.add_argument("--data-binary", default=None)
        # Keep urlencode for completeness, though less common from browser copy/paste
        _parser.add_argument("--data-urlencode", action="append", default=[])
        _parser.add_argument("-G", "--get", action="store_true")  # Use GET and put data in URL

        _parser.add_argument(
            "-b",
            "--cookie",
            default=None,
            help="Send cookies from string/file (string format used by DevTools)",
        )

        # Proxy
        _parser.add_argument("-x", "--proxy", default=None)
        _parser.add_argument("-U", "--proxy-user", default=None)  # Basic proxy auth

        # Connection/Security
        _parser.add_argument("-k", "--insecure", action="store_true")
        _parser.add_argument("--compressed", action="store_true")  # Very common from browsers

        # Other flags often included but may not map directly to request args
        _parser.add_argument("-i", "--include", action="store_true")
        _parser.add_argument("-s", "--silent", action="store_true")
        _parser.add_argument("-v", "--verbose", action="store_true")

        self.parser: NoExitArgumentParser = _parser
        self._supported_methods = ("get", "post", "put", "delete")

    # --- Main Parsing Logic ---
    def parse(self, curl_command: str) -> Optional[Request]:
        """Parses the curl command string into a structured context for Fetcher."""

        clean_command = curl_command.strip().lstrip("curl").strip().replace("\\\n", " ")

        try:
            tokens = shlex_split(clean_command)  # Split the string using shell-like syntax
        except ValueError as e:  # pragma: no cover
            log.error(f"Could not split command line: {e}")
            return None

        try:
            parsed_args, unknown = self.parser.parse_known_args(tokens)
            if unknown:
                raise AttributeError(f"Unknown/Unsupported curl arguments: {unknown}")

        except ValueError:  # pragma: no cover
            return None

        except AttributeError:
            raise

        except Exception as e:  # pragma: no cover
            log.error(f"An unexpected error occurred during curl arguments parsing: {e}")
            return None

        # --- Determine Method ---
        method = "get"  # Default
        if parsed_args.get:  # `-G` forces GET
            method = "get"

        elif parsed_args.method:
            method = parsed_args.method.strip().lower()

        # Infer POST if data is present (unless overridden by -X or -G)
        elif any(
            [
                parsed_args.data,
                parsed_args.data_raw,
                parsed_args.data_binary,
                parsed_args.data_urlencode,
            ]
        ):
            method = "post"

        headers, cookies = _ParseHeaders(parsed_args.header)

        if parsed_args.cookie:
            # We are focusing on the string format from DevTools.
            try:
                for key, value in _CookieParser(parsed_args.cookie):
                    # Update the cookie dict, potentially overwriting cookies with the same name from -H 'cookie:'
                    cookies[key] = value
                log.debug(f"Parsed cookies from -b argument: {list(cookies.keys())}")
            except Exception as e:  # pragma: no cover
                log.error(f"Could not parse cookie string from -b '{parsed_args.cookie}': {e}")

        # --- Process Data Payload ---
        params = dict()
        data_payload: Optional[str | bytes | Dict] = None
        json_payload: Optional[Any] = None

        # DevTools often uses --data-raw for JSON bodies
        # Precedence: --data-binary > --data-raw / -d > --data-urlencode
        if parsed_args.data_binary is not None:  # pragma: no cover
            try:
                data_payload = parsed_args.data_binary.encode("utf-8")
                log.debug("Using data from --data-binary as bytes.")
            except Exception as e:
                log.warning(
                    f"Could not encode binary data '{parsed_args.data_binary}' as bytes: {e}. Using raw string."
                )
                data_payload = parsed_args.data_binary  # Fallback to string

        elif parsed_args.data_raw is not None:
            data_payload = parsed_args.data_raw.lstrip("$")

        elif parsed_args.data is not None:
            data_payload = parsed_args.data

        elif parsed_args.data_urlencode:  # pragma: no cover
            # Combine and parse urlencoded data
            combined_data = "&".join(parsed_args.data_urlencode)
            try:
                data_payload = dict(parse_qsl(combined_data, keep_blank_values=True))
            except Exception as e:
                log.warning(f"Could not parse urlencoded data '{combined_data}': {e}. Treating as raw string.")
                data_payload = combined_data

        # Check if raw data looks like JSON, prefer 'json' param if so
        if isinstance(data_payload, str):
            try:
                maybe_json = json_loads(data_payload)
                if isinstance(maybe_json, (dict, list)):
                    json_payload = maybe_json
                    data_payload = None
            except JSONDecodeError:
                pass  # Not JSON, keep it in data_payload

        # Handle `-G`: Move data to params if the method is GET
        if method == "get" and data_payload:  # pragma: no cover
            if isinstance(data_payload, dict):  # From --data-urlencode likely
                params.update(data_payload)
            elif isinstance(data_payload, str):
                try:
                    params.update(dict(parse_qsl(data_payload, keep_blank_values=True)))
                except Valu
```

### Core Architecture Module: `scrapling/core/storage.py`
```
from hashlib import sha256
from threading import RLock
from functools import lru_cache
from abc import ABC, abstractmethod
from sqlite3 import connect as db_connect

from orjson import dumps, loads
from lxml.html import HtmlElement

from scrapling.core.utils import _StorageTools, log
from scrapling.core._types import Dict, Optional, Any, cast


class StorageSystemMixin(ABC):  # pragma: no cover
    # If you want to make your own storage system, you have to inherit from this
    def __init__(self, url: Optional[str] = None):
        """
        :param url: URL of the website we are working on to separate it from other websites data
        """
        # Make the url in lowercase to handle this edge case until it's updated: https://github.com/barseghyanartur/tld/issues/124
        self.url = url.lower() if (url and isinstance(url, str)) else None

    @lru_cache(64, typed=True)
    def _get_base_url(self, default_value: str = "default") -> str:
        if not self.url:
            return default_value

        try:
            from tld import get_tld, Result

            # Fixing the inaccurate return type hint in `get_tld`
            extracted: Result | None = cast(
                Result, get_tld(self.url, as_object=True, fail_silently=True, fix_protocol=True)
            )
            if not extracted:
                return default_value
            return extracted.fld or extracted.domain or default_value
        except AttributeError:
            return default_value

    @abstractmethod
    def save(self, element: HtmlElement, identifier: str) -> None:
        """Saves the element's unique properties to the storage for retrieval and relocation later

        :param element: The element itself which we want to save to storage.
        :param identifier: This is the identifier that will be used to retrieve the element later from the storage. See
            the docs for more info.
        """
        raise NotImplementedError("Storage system must implement `save` method")

    @abstractmethod
    def retrieve(self, identifier: str) -> Optional[Dict]:
        """Using the identifier, we search the storage and return the unique properties of the element

        :param identifier: This is the identifier that will be used to retrieve the element from the storage. See
            the docs for more info.
        :return: A dictionary of the unique properties
        """
        raise NotImplementedError("Storage system must implement `retrieve` method")

    @staticmethod
    @lru_cache(128, typed=True)
    def _get_hash(identifier: str) -> str:
        """If you want to hash identifier in your storage system, use this safer"""
        _identifier = identifier.lower().strip()
        # Hash functions have to take bytes
        _identifier_bytes = _identifier.encode("utf-8")

        hash_value = sha256(_identifier_bytes).hexdigest()
        return f"{hash_value}_{len(_identifier_bytes)}"  # Length to reduce collision chance


@lru_cache(1, typed=True)
class SQLiteStorageSystem(StorageSystemMixin):
    """The recommended system to use, it's race condition safe and thread safe.
    Mainly built, so the library can run in threaded frameworks like scrapy or threaded tools
    > It's optimized for threaded applications, but running it without threads shouldn't make it slow."""

    def __init__(self, storage_file: str, url: Optional[str] = None):
        """
        :param storage_file: File to be used to store elements' data.
        :param url: URL of the website we are working on to separate it from other websites data

        """
        super().__init__(url)
        self.storage_file = storage_file
        self.lock = RLock()  # Better than Lock for reentrancy
        # >SQLite default mode in the earlier version is 1 not 2 (1=thread-safe 2=serialized)
        # `check_same_thread=False` to allow it to be used across different threads.
        self.connection = db_connect(self.storage_file, check_same_thread=False)
        # WAL (Write-Ahead Logging) allows for better concurrency.
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.cursor = self.connection.cursor()
        self._setup_database()
        log.debug(f'Storage system loaded with arguments (storage_file="{storage_file}", url="{url}")')

    def _setup_database(self) -> None:
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS storage (
                id INTEGER PRIMARY KEY,
                url TEXT,
                identifier TEXT,
                element_data TEXT,
                UNIQUE (url, identifier)
            )
        """)
        self.connection.commit()

    def save(self, element: HtmlElement, identifier: str) -> None:
        """Saves the elements unique properties to the storage for retrieval and relocation later

        :param element: The element itself which we want to save to storage.
        :param identifier: This is the identifier that will be used to retrieve the element later from the storage. See
            the docs for more info.
        """
        url = self._get_base_url()
        element_data = _StorageTools.element_to_dict(element)
        with self.lock:
            self.cursor.execute(
                """
                INSERT OR REPLACE INTO storage (url, identifier, element_data)
                VALUES (?, ?, ?)
            """,
                (url, identifier, dumps(element_data)),
            )
            self.connection.commit()

    def retrieve(self, identifier: str) -> Optional[Dict[str, Any]]:
        """Using the identifier, we search the storage and return the unique properties of the element

        :param identifier: This is the identifier that will be used to retrieve the element from the storage. See
            the docs for more info.
        :return: A dictionary of the unique properties
        """
        url = self._get_base_url()
        with self.lock:
            self.cursor.execute(
                "SELECT element_data FROM storage WHERE url = ? AND identifier = ?",
                (url, identifier),
            )
            result = self.cursor.fetchone()
            if result:
                return loads(result[0])
            return None

    def close(self):
        """Close all connections. It will be useful when with some things like scrapy Spider.closed() function/signal"""
        with self.lock:
            self.connection.commit()
            self.cursor.close()
            self.connection.close()

    def __del__(self):
        """To ensure all connections are closed when the object is destroyed."""
        self.close()

```

### Core Architecture Module: `scrapling/core/translator.py`
```
"""
Most of this file is an adapted version of the parsel library's translator with some modifications simply for 1 important reason...

To add pseudo-elements ``::text`` and ``::attr(ATTR_NAME)`` so we match the Parsel/Scrapy selectors format which will be important in future releases but most importantly...

So you don't have to learn a new selectors/api method like what bs4 done with soupsieve :)

    If you want to learn about this, head to https://cssselect.readthedocs.io/en/latest/#cssselect.FunctionalPseudoElement
"""

from functools import lru_cache

from cssselect import HTMLTranslator as OriginalHTMLTranslator
from cssselect.xpath import ExpressionError, XPathExpr as OriginalXPathExpr
from cssselect.parser import Element, FunctionalPseudoElement, PseudoElement

from scrapling.core._types import Any, Protocol, Self


class XPathExpr(OriginalXPathExpr):
    textnode: bool = False
    attribute: str | None = None

    @classmethod
    def from_xpath(
        cls,
        xpath: OriginalXPathExpr,
        textnode: bool = False,
        attribute: str | None = None,
    ) -> Self:
        x = cls(path=xpath.path, element=xpath.element, condition=xpath.condition)
        x.textnode = textnode
        x.attribute = attribute
        return x

    def __str__(self) -> str:
        path = super().__str__()
        if self.textnode:
            if path == "*":  # pragma: no cover
                path = "text()"
            elif path.endswith("::*/*"):  # pragma: no cover
                path = path[:-3] + "text()"
            else:
                path += "/text()"

        if self.attribute is not None:
            if path.endswith("::*/*"):  # pragma: no cover
                path = path[:-2]
            path += f"/@{self.attribute}"

        return path

    def join(
        self: Self,
        combiner: str,
        other: OriginalXPathExpr,
        *args: Any,
        **kwargs: Any,
    ) -> Self:
        if not isinstance(other, XPathExpr):
            raise ValueError(  # pragma: no cover
                f"Expressions of type {__name__}.XPathExpr can ony join expressions"
                f" of the same type (or its descendants), got {type(other)}"
            )
        super().join(combiner, other, *args, **kwargs)
        self.textnode = other.textnode
        self.attribute = other.attribute
        return self


# e.g. cssselect.GenericTranslator, cssselect.HTMLTranslator
class TranslatorProtocol(Protocol):
    def xpath_element(self, selector: Element) -> OriginalXPathExpr:  # pyright: ignore # pragma: no cover
        pass

    def css_to_xpath(self, css: str, prefix: str = ...) -> str:  # pyright: ignore # pragma: no cover
        pass


class TranslatorMixin:
    """This mixin adds support to CSS pseudo elements via dynamic dispatch.

    Currently supported pseudo-elements are ``::text`` and ``::attr(ATTR_NAME)``.
    """

    def xpath_element(self: TranslatorProtocol, selector: Element) -> XPathExpr:
        # https://github.com/python/mypy/issues/14757
        xpath = super().xpath_element(selector)  # type: ignore[safe-super]
        return XPathExpr.from_xpath(xpath)

    def xpath_pseudo_element(self, xpath: OriginalXPathExpr, pseudo_element: PseudoElement) -> OriginalXPathExpr:
        """
        Dispatch method that transforms XPath to support the pseudo-element.
        """
        if isinstance(pseudo_element, FunctionalPseudoElement):
            method_name = f"xpath_{pseudo_element.name.replace('-', '_')}_functional_pseudo_element"
            method = getattr(self, method_name, None)
            if not method:  # pragma: no cover
                raise ExpressionError(f"The functional pseudo-element ::{pseudo_element.name}() is unknown")
            xpath = method(xpath, pseudo_element)
        else:
            method_name = f"xpath_{pseudo_element.replace('-', '_')}_simple_pseudo_element"
            method = getattr(self, method_name, None)
            if not method:  # pragma: no cover
                raise ExpressionError(f"The pseudo-element ::{pseudo_element} is unknown")
            xpath = method(xpath)
        return xpath

    @staticmethod
    def xpath_attr_functional_pseudo_element(xpath: OriginalXPathExpr, function: FunctionalPseudoElement) -> XPathExpr:
        """Support selecting attribute values using ::attr() pseudo-element"""
        if function.argument_types() not in (["STRING"], ["IDENT"]):  # pragma: no cover
            raise ExpressionError(f"Expected a single string or ident for ::attr(), got {function.arguments!r}")
        return XPathExpr.from_xpath(xpath, attribute=function.arguments[0].value)

    @staticmethod
    def xpath_text_simple_pseudo_element(xpath: OriginalXPathExpr) -> XPathExpr:
        """Support selecting text nodes using ::text pseudo-element"""
        return XPathExpr.from_xpath(xpath, textnode=True)


class HTMLTranslator(TranslatorMixin, OriginalHTMLTranslator):
    def css_to_xpath(self, css: str, prefix: str = "descendant-or-self::") -> str:
        return super().css_to_xpath(css, prefix)


translator = HTMLTranslator()
# Using a function instead of the translator directly to avoid Pyright override error


@lru_cache(maxsize=256)
def css_to_xpath(query: str) -> str:
    """Return the translated XPath version of a given CSS query"""
    return translator.css_to_xpath(query)

```

### Core Architecture Module: `scrapling/core/utils/__init__.py`
```
from ._utils import (
    log,
    set_logger,
    reset_logger,
    __CONSECUTIVE_SPACES_REGEX__,
    flatten,
    _is_iterable,
    _StorageTools,
    clean_spaces,
    html_forbidden,
)

```

### Core Architecture Module: `scrapling/core/utils/_shell.py`
```
from http import cookies as Cookie


from scrapling.core._types import (
    List,
    Dict,
    Tuple,
)


def _CookieParser(cookie_string):
    # Errors will be handled on call so the log can be specified
    cookie_parser = Cookie.SimpleCookie()
    cookie_parser.load(cookie_string)
    for key, morsel in cookie_parser.items():
        yield key, morsel.value


def _ParseHeaders(header_lines: List[str], parse_cookies: bool = True) -> Tuple[Dict[str, str], Dict[str, str]]:
    """Parses headers into separate header and cookie dictionaries."""
    header_dict = dict()
    cookie_dict = dict()

    for header_line in header_lines:
        if ":" not in header_line:
            if header_line.endswith(";"):
                header_key = header_line[:-1].strip()
                header_value = ""
                header_dict[header_key] = header_value
            else:
                raise ValueError(f"Could not parse header without colon: '{header_line}'.")
        else:
            header_key, header_value = header_line.split(":", 1)
            header_key = header_key.strip()
            header_value = header_value.strip()

            if parse_cookies:
                if header_key.lower() == "cookie":
                    try:
                        cookie_dict = {key: value for key, value in _CookieParser(header_value)}
                    except Exception as e:  # pragma: no cover
                        raise ValueError(f"Could not parse cookie string from header '{header_value}': {e}")
                else:
                    header_dict[header_key] = header_value
            else:
                header_dict[header_key] = header_value

    return header_dict, cookie_dict

```

### Core Architecture Module: `scrapling/core/utils/_utils.py`
```
import logging
from itertools import chain
from re import compile as re_compile
from contextvars import ContextVar, Token

from lxml import html

from scrapling.core._types import Any, Dict, Iterable, List

# Using cache on top of a class is a brilliant way to achieve a Singleton design pattern without much code
from functools import lru_cache  # isort:skip

html_forbidden = (html.HtmlComment,)

__CLEANING_TABLE__ = str.maketrans({"\t": " ", "\n": None, "\r": None})
__CONSECUTIVE_SPACES_REGEX__ = re_compile(r" +")


@lru_cache(1, typed=True)
def setup_logger():
    """Create and configure a logger with a standard format.

    :returns: logging.Logger: Configured logger instance
    """
    logger = logging.getLogger("scrapling")
    logger.setLevel(logging.INFO)

    formatter = logging.Formatter(fmt="[%(asctime)s] %(levelname)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    # Add handler to logger (if not already added)
    if not logger.handlers:
        logger.addHandler(console_handler)

    return logger


_current_logger: ContextVar[logging.Logger] = ContextVar("scrapling_logger", default=setup_logger())


class LoggerProxy:
    def __getattr__(self, name: str):
        return getattr(_current_logger.get(), name)


log = LoggerProxy()


def set_logger(logger: logging.Logger) -> Token:
    """Set the current context logger. Returns token for reset."""
    return _current_logger.set(logger)


def reset_logger(token: Token) -> None:
    """Reset logger to previous state using token."""
    _current_logger.reset(token)


def flatten(lst: Iterable[Any]) -> List[Any]:
    return list(chain.from_iterable(lst))


def _is_iterable(obj: Any) -> bool:
    # This will be used only in regex functions to make sure it's iterable but not string/bytes
    return isinstance(
        obj,
        (
            list,
            tuple,
        ),
    )


class _StorageTools:
    @staticmethod
    def __clean_attributes(element: html.HtmlElement, forbidden: tuple = ()) -> Dict:
        if not element.attrib:
            return {}
        return {k: v.strip() for k, v in element.attrib.items() if v and v.strip() and k not in forbidden}

    @classmethod
    def element_to_dict(cls, element: html.HtmlElement) -> Dict:
        parent = element.getparent()
        result = {
            "tag": str(element.tag),
            "attributes": cls.__clean_attributes(element),
            "text": element.text.strip() if element.text else None,
            "path": cls._get_element_path(element),
        }
        if parent is not None:
            result.update(
                {
                    "parent_name": parent.tag,
                    "parent_attribs": dict(parent.attrib),
                    "parent_text": parent.text.strip() if parent.text else None,
                }
            )

            siblings = [child.tag for child in parent.iterchildren() if child != element]
            if siblings:
                result.update({"siblings": tuple(siblings)})

        children = [child.tag for child in element.iterchildren() if not isinstance(child, html_forbidden)]
        if children:
            result.update({"children": tuple(children)})

        return result

    @classmethod
    def _get_element_path(cls, element: html.HtmlElement):
        parent = element.getparent()
        return tuple((element.tag,) if parent is None else (cls._get_element_path(parent) + (element.tag,)))


@lru_cache(128, typed=True)
def clean_spaces(string):
    string = string.translate(__CLEANING_TABLE__)
    return __CONSECUTIVE_SPACES_REGEX__.sub(" ", string)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #458** (2026-09-24): **fix(spiders): route sitemap URLs to parse() instead of the sitemap parser**
  *Symptoms*: <!--   You are amazing! Thanks for contributing to Scrapling!   Please, DO NOT DELETE ANY TEXT from this template! (unless instructed). -->  ## Proposed change <!--   Describe the big picture of your changes here to communicate to the maintainers why we should accept this pull request.   If it fixes a bug or resolves a feature request, be sure to link to that issue in the additional information section. -->  With no `rules()`, or with a matching `CrawlRule` that has no callback, `SitemapSpider` never calls `parse()` for the URLs listed in a sitemap.  `start_requests()` creates each sitemap request with `callback=self._parse_sitemap`. `_dispatch()` then followed each listed URL with `response.follow(url)` or `response.follow(url, callback=rule.callback)`. When no callback is given, `Response.follow()` falls back to `self.request.callback`, so every page request inherited `_parse_sitemap`. The HTML pages were then parsed as sitemaps, which logs `Unknown sitemap root element: 'html'` and yields nothing.  That contradicts the docs (`docs/spiders/generic-templates.md`: "If `rules()` returns an empty list, every URL is routed to the spider's `parse()` method") and `CrawlRule`'s docstring ("Falls back to the spider's default ``parse()``").  The fix is limited to the template. `_dispatch()` is now a regular method and passes `self.parse` explicitly when there are no rules, or when the matching rule has no callback. `Response.follow()` is unchanged, since its fallback to the parent re
  **Post-Mortem & Fix Analysis**:
  > @D4Vinci when you have a moment, could you take a look at this one? With no `rules()`, or with a matching `CrawlRule` that has no callback, `SitemapSpider` sends the URLs listed in a sitemap back to the sitemap parser, so `parse()` is never called for them. The branch merges cleanly and CI is green. 
  > Good catch @SulimanAbdulrazzaq ! Thanks a lot for finding and solving this one. It will be merged and added to the next major release.

- **Issue #453** (2026-09-19): **fix(spiders): ignore a leading byte-order mark in robots.txt and CSV feeds**
  *Symptoms*: <!--   You are amazing! Thanks for contributing to Scrapling!   Please, DO NOT DELETE ANY TEXT from this template! (unless instructed). -->  ## Proposed change <!--   Describe the big picture of your changes here to communicate to the maintainers why we should accept this pull request.   If it fixes a bug or resolves a feature request, be sure to link to that issue in the additional information section. -->  The spiders package turns robots.txt and CSV bodies into text with `body.decode(encoding, errors="replace")`. A UTF-8 byte-order mark (`EF BB BF`) survives that as `"﻿"` at the start of the text, and both consumers then misread the first line.  **robots.txt** (`RobotsTxtManager` and `SitemapSpider._robots_body`). protego doesn't strip the BOM, so the first line reads as `"﻿User-agent"`, which isn't a directive it knows, and the whole first group is dropped. For the common file that starts with `User-agent: *`, that group holds every rule. With `robots_txt_obey = True`, `can_fetch()` then allows paths the site disallowed, and its `Crawl-delay`/`Request-rate` are never applied. When the file starts with a `Sitemap:` line instead, `SitemapSpider` loses that sitemap.  ```python >>> from protego import Protego >>> robots = "﻿User-agent: *\nDisallow: /private\n" >>> Protego.parse(robots).can_fetch("https://example.com/private", "*") True >>> Protego.parse(robots[1:]).can_fetch("https://example.com/private", "*") False ```  This happens on real sites. Scrapy hit the same protego
  **Post-Mortem & Fix Analysis**:
  > Thanks, @SulimanAbdulrazzaq, for catching and solving this!

- **Issue #450** (2026-09-17): **fix(spiders): skip non-element nodes in sitemap XML instead of crashing on comments**
  *Symptoms*: ## What's wrong  `SitemapSpider._get_type` calls `etree.QName(el.tag)` on every node it iterates (`scrapling/spiders/templates/sitemap.py:105` on `dev`). lxml keeps XML comments and processing instructions in the parsed tree, and their `.tag` is not a string (it is `etree.Comment` / `etree.ProcessingInstruction`), so `etree.QName` raises `ValueError` for them. Nothing catches it, and `_sm_body` iterates `root` directly — a single comment anywhere under `<urlset>` or `<sitemapindex>` (e.g. a `<!-- generated by ... -->` note, which real-world sitemaps regularly carry) kills the whole `_parse_sitemap` callback, and the crawl loses every URL from that sitemap.  `XMLFeedSpider._iter_nodes` already guards exactly this case with `isinstance(el.tag, str)` — the sitemap template was missing the same guard.  ## What changed  - `_get_type` returns `""` for non-element nodes (the same idiom as the feed   template). All callers compare the result against known element names   ("url", "loc", "sitemap"), so comments/PIs are now simply skipped. - Regression test `test_comments_in_sitemap_are_skipped`: a sitemap with   comments both under the root and inside `<url>`. Crashes with `ValueError`   before the fix, passes after.  ## Verification  Written by reading the code; the test suite was not run locally — CI (tox) runs it on this PR.  ## AI disclosure (per AI_POLICY.md)  This change was prepared with AI assistance: an agent located the bug by reading the code and authored the fix and the reg
  **Post-Mortem & Fix Analysis**:
  > Thanks @sup3dev for catching this one! It will be released with the next version.

- **Issue #448** (2026-09-17): **fix(spiders): include params in the request fingerprint**
  *Symptoms*: Passing query params through `params` gets deduped as if they weren't there. No error, the later pages just never get fetched:  ```python for n in range(3):     yield Request("https://dummyjson.com/products", params={"limit": 1, "skip": n}) # only product 1 comes back, skip=1 and skip=2 are dropped as duplicates ```  The fingerprint hashes the URL as written, but curl tacks `params` onto it before sending, so all three look identical. `fp_include_kwargs=True` works around it, but pagination through `params` shouldn't need a flag.  Tiny fix so the fingerprint uses the URL curl actually sends. Added a test in `TestRequestProperties` that fails on `dev` today, rest still pass.  Written by me, reviewed by Claude Code. 
  **Post-Mortem & Fix Analysis**:
  > Hi @yetval, nice catch, but why didn't you use `curl_cffi`'s `update_url_params` instead of doing it manually? It would be cleaner, and manually appending `urlencode(params)` still mishandles fragments, existing query keys, and list/bool values.  Could you use `curl_cffi.requests.utils.update_url_params(self.url, params)` before `canonicalize_url()`? This should make the fingerprint follow the request engine’s URL rules.  Here's an example: ```python from curl_cffi.requests.utils import update_url_params from w3lib.url import canonicalize_url  params = self._session_kwargs.get("params") url = update_url_params(self.url, params) if params else self.url  data = {     "sid": self.sid,     "body": body.hex(),     "method": self._session_kwargs.get("method", "GET"),     "url": canonicalize_url(url, keep_fragments=keep_fragments), } ```  Please add tests for these cases and confirm that the helper is available in our minimum supported curl_cffi version.
  > @D4Vinci I completely forgot about that. I have gone ahead and fixed it in the latest commit. Please let me know if there are any other issues you spot!
  > Thanks, @yetval, for your continued contributions to the project!

- **Issue #446** (2026-09-18): **fix(spiders): cache responses only after blocked-response checks**
  *Symptoms*: <!--   You are amazing! Thanks for contributing to Scrapling!   Please, DO NOT DELETE ANY TEXT from this template! (unless instructed). -->  ## Proposed change <!--   Describe the big picture of your changes here to communicate to the maintainers why we should accept this pull request.   If it fixes a bug or resolves a feature request, be sure to link to that issue in the additional information section. -->  With `development_mode=True`, a response is cached before `is_blocked` runs. A retry of that URL then hits the cached blocked page and sends it straight to the parse callback. For example, a session returning a blocked response followed by a successful response is fetched only once, and the callback receives the blocked body.  Write responses to the development cache only after they pass the spider's live `is_blocked` hook. Cache replay remains unchanged: reconstructed responses may lack metadata needed by custom hooks. Users with blocked pages cached by older versions can clear their development cache once.  Three regressions cover a blocked HTTP 403, blocked content with HTTP 200, and exhausted retries. The retry cases also run a second crawl using a custom hook that requires live-only metadata, verifying that the accepted response is replayed without a fetch or another call to that hook. Tests exercise the real engine, scheduler, requests, and disk cache with a controlled session.  Issue investigation, code, tests, and this description were prepared wi

- **Issue #443** (2026-09-19): **fix: robots.txt fetch failures cached as allow-all**
  *Symptoms*: <!--   You are amazing! Thanks for contributing to Scrapling!   Please, DO NOT DELETE ANY TEXT from this template! (unless instructed). -->  ## Proposed change  `RobotsTxtManager._get_parser` treated any non-200 fetch outcome the same as a 404: it parsed an empty string, which allows everything, and cached that permissive parser for the domain with no TTL. A single transient failure (5xx, timeout, connection error) therefore disabled robots.txt enforcement for that domain for the rest of the run, even with `robots_txt_obey = True` explicitly set.  Per RFC 9309 §2.3.1.3, a 4xx correctly means no robots.txt restrictions exist (allow-all), but a 5xx or fetch exception means the file's state is unknown, and a crawler should assume full disallow while the failure lasts — not allow-all, and not for the rest of the run.  This PR makes `_get_parser` branch on the response status: 2xx parses normally, 4xx still allow-all and cached (a durable fact about the domain), and 5xx/exceptions return a `Disallow: /` parser for that call only without caching it, so the next call retries the fetch instead of being stuck.  ### Type of change:  - [ ] Dependency upgrade - [x] Bugfix (non-breaking change which fixes an issue) - [ ] New integration (thank you!) - [ ] New feature (which adds functionality to an existing integration) - [ ] Deprecation (breaking change to happen in the future) - [ ] Breaking change (fix/feature causing existing functionality to break) - [ ] Code qua
  **Post-Mortem & Fix Analysis**:
  > @D4Vinci - Can you please approve the workflow?
  > Thanks, @prateekraawat1, for catching and fixing this!

- **Issue #433** (2026-09-12): **css selector parser problem**
  *Symptoms*: ### Have you searched if there an existing issue for this?  - [x] I have searched the existing issues  ### Python version (python --version)  Python 3.14.7s  ### Scrapling version (scrapling.__version__)  0.4.15  ### Dependencies version (pip3 freeze)  anyio==4.14.1 apify_fingerprint_datapoints==0.15.0 asttokens==3.0.1 beautifulsoup4==4.15.0 browserforge==1.2.4 certifi==2026.6.17 cffi==2.1.0 click==8.4.2 cssselect==1.5.0 curl_cffi==0.16.1 decorator==5.3.1 executing==2.2.1 greenlet==3.5.3 idna==3.18 ipython==9.15.0 ipython_pygments_lexers==1.1.1 jedi==0.20.0 lxml==6.1.1 markdown-it-py==4.2.0 markdownify==1.2.3 matplotlib-inline==0.2.2 mdurl==0.1.2 msgspec==0.21.1 orjson==3.11.9 parso==0.8.7 patchright==1.62.1 pexpect==4.9.0 pip==26.2.1 playwright==1.62.0 prompt_toolkit==3.0.52 Protego==0.6.2 psutil==7.2.2 ptyprocess==0.7.0 pure_eval==0.2.3 pycparser==3.0 pyee==13.0.1 Pygments==2.20.0 rich==15.0.0 scrapling==0.4.15 six==1.17.0 soupsieve==2.8.4 stack-data==0.6.3 tld==0.13.2 traitlets==5.15.1 typing_extensions==4.16.0 w3lib==2.4.1 wcwidth==0.8.2  ### What's your operating system?  mac 26.6.2  ### Are you using a separate virtual environment?  Yes  ### Expected behavior  cannot use a period (.) in an ID selector.  ```bash % scrapling extract stealthy-fetch 'https://scrapling.readthedocs.io/en/latest/api-reference/response.html#scrapling.engines.toolbelt.custom.Response.markdown' test.md -s 'div:has(>#scrapling\\.engines\\.toolbelt\\.custom\\.Response\\.markdown)' [2026-09-01 19:41
  **Post-Mortem & Fix Analysis**:
  > It should also be possible to specify a timeout for the wait selector. ```bash % scrapling extract stealthy-fetch "https://scrapling.readthedocs.io/en/latest/api-reference/fetchers.html" timeout.md --solve-cloudflare --timeout=10000 --wait 500 --wait-selector ".notFoundClass" [2026-09-01 20:11:27] ERROR: No Cloudflare challenge found. [2026-09-01 20:12:27] ERROR: Error waiting for selector .notFoundClass: Locator.wait_for: Timeout 60000ms exceeded. Call log:   - waiting for locator(".notFoundClass").first  [2026-09-01 20:12:28] INFO: Fetched (200) <GET https://scrapling.readthedocs.io/en/latest/api-reference/fetchers.html> (referer: https://www.google.com/) [2026-09-01 20:12:28] INFO: Content successfully saved to '/Users/myuser/PycharmProjects/scrapling/timeout.md' ```
  > This is not a Scrapling bug. The CSS library it uses (cssselect) doesn't support `#id` inside `:has()` at all, even without the dots. Fix opened: scrapy/cssselect#187 Workaround for now:      page.css('[id="scrapling.engines.toolbelt.custom.Response.markdown"]')[0].parent  About the timeout: `--timeout` does work, but `--solve-cloudflare` silently bumps it to a 60s minimum. Drop that flag and your 10s timeout will kick in.
  > @yetval  Thank you for your reply. What if we restore the timeout value whenever the system detects that there is no Cloudflare challenge? ```bash ERROR: No Cloudflare challenge found. ```

- **Issue #431** (2026-09-21): **fix(ai): match inline style values instead of substrings when sanitizing**
  *Symptoms*: <!--   You are amazing! Thanks for contributing to Scrapling!   Please, DO NOT DELETE ANY TEXT from this template! (unless instructed). -->  ## Proposed change <!--   Describe the big picture of your changes here to communicate to the maintainers why we should accept this pull request.   If it fixes a bug or resolves a feature request, be sure to link to that issue in the additional information section. -->  The prompt-injection sanitizer decides what is hidden with XPath `contains()` on the whole `style` attribute:  ```python # scrapling/core/shell.py _HIDDEN_XPATH = XPath(     './/*[contains(@style,"display:none") or contains(@style,"display: none")'     ...     ' or contains(@style,"opacity:0") or contains(@style,"opacity: 0")'     ' or contains(@style,"font-size:0") or contains(@style,"font-size: 0")'     ' or contains(@style,"height:0") or contains(@style,"height: 0")'     ' or contains(@style,"width:0") or contains(@style,"width: 0")]'     ... ) ```  `contains()` is a plain substring test, so a value that merely *starts* with a zero matches, and so does a different property whose name *ends* with a matching one:  | inline style | substring that matches | what it actually means | |---|---|---| | `opacity:0.95` | `opacity:0` | almost fully opaque | | `font-size:0.9rem` | `font-size:0` | slightly smaller text | | `width:0.5em` | `width:0` | half an em wide | | `line-height:0.9` | `height:0` | a different property entirely | | `min-height:0` | `height:0` | the flexbox defau
  **Post-Mortem & Fix Analysis**:
  > Handled in 727e143. `_is_hidden_element` now strips `/* ... */` before splitting the declarations, so `display:none/*hidden*/` and `opacity:0/*hidden*/` are dropped again, matching what the browser does and what the old substring XPath happened to catch.  Regression cases added for both, plus a comment inside a declaration (`display:/* keep */none`) and a comment containing a separator (`color:red/*;*/;visibility:hidden`). `opacity:0.95/*hidden*/` went into the visible set so the decimal cases stay covered.  The branch is also rebased on the current `dev`: the `.//slot[@hidden]` candidate from 6bbc6e0 is part of the rewritten XPath and confirmed by the helper, so `test_shadow_hidden_slots.py` passes unchanged.  Local run: ruff, bandit, vermin, mypy and pyright are clean; the affected test directories pass (263 tests).  AI assistance disclosure: the follow-up patch, its tests and this comment were drafted with Claude Code. I reviewed the diff, checked the browser behaviour the review de
  > Thanks @Yigtwxx, the comment handling and hidden-slot support look good. There’s one remaining case: `display:none ! important` and `opacity:0 ! important` are valid CSS. Chrome hides both, but the helper misses them because it only strips the exact `!important` suffix.  Please handle whitespace between `!` and `important` and add regression tests.
  > Handled in c94a3c9. The `!important` suffix is now removed with `!\s*important$` instead of an exact `removesuffix`, so `display:none ! important` and `opacity:0 ! important` are compared as `none` and `0` again.  Regression cases added for both, plus `visibility:hidden!important` for the no-space form. `opacity:0.95 ! important` went into the visible set so the suffix handling does not reopen the decimal case.  Local run: ruff, bandit, vermin, mypy and pyright are clean; `tests/fetchers`, `tests/parser` and `tests/core` pass (460 tests).  AI assistance disclosure: the patch, its tests and this comment were drafted with Claude Code. I reviewed the diff and ran the checks and tests locally. 

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

### Incident Patch 1: `ac18622e` (2026-08-23)
**Commit Message**: fix(static): send the request once when retries is below 1 (#420)

**File**: `scrapling/engines/static.py` (modified, +4/-2)
```diff
@@ -228,7 +228,8 @@ def _make_request(self, method: SUPPORTED_HTTP_METHODS, stealth: Optional[bool]
         stealth = self._stealth if stealth is None else stealth
 
         selector_config = self._get_param(kwargs, "selector_config", self.selector_config) or self.selector_config
-        max_retries = self._get_param(kwargs, "retries", self._default_retries)
+        # Always attempt the request once; `retries` below 1 (or `None`) means "send it, but don't retry"
+        max_retries = max(1, self._get_param(kwargs, "retries", self._default_retries) or 1)
         retry_delay = self._get_param(kwargs, "retry_delay", self._default_retry_delay)
         static_proxy = kwargs.pop("proxy", None)
 
@@ -443,7 +444,8 @@ async def _make_request(self, method: SUPPORTED_HTTP_METHODS, stealth: Optional[
         stealth = self._stealth if stealth is None else stealth
 
         selector_config = self._get_param(kwargs, "selector_config", self.selector_config) or self.selector_config
-        max_retries = self._get_param(kwargs, "retries", self._default_retries)
+        # Always attempt the request once; `retries` below 1 (or `None`) means "send it, but don't retry"
+        max_retries = max(1, self._get_param(kwargs, "retries", self._default_retries) or 1)
         retry_delay = self._get_param(kwargs, "retry_delay", self._default_retry_delay)
         static_proxy = kwargs.pop("proxy", None)
 
```

**File**: `tests/fetchers/async/test_requests.py` (modified, +5/-0)
```diff
@@ -160,3 +160,8 @@ async def test_selector_config_overrides_configure(
         )
         assert response._storage is not None
         assert response.url == "from-request.test"
+
+    async def test_retries_below_one_still_performs_the_request(self, fetcher, urls):
+        """``retries`` below 1 means "send the request once", not "send nothing"."""
+        assert (await fetcher.get(urls["status_200"], retries=0)).status == 200
+        assert (await fetcher.get(urls["status_200"], retries=-1)).status == 200
```

**File**: `tests/fetchers/async/test_requests_session.py` (modified, +25/-0)
```diff
@@ -60,3 +60,28 @@ async def test_proxy_rotates_per_retry_attempt(self):
 
             proxies_used = [call.kwargs["proxy"] for call in mocked_request.call_args_list]
             assert proxies_used == ["http://p1:8080", "http://p2:8080"]
+
+    @pytest.mark.asyncio
+    @pytest.mark.parametrize("retries", [0, -1, None])
+    async def test_retries_below_one_still_sends_the_request(self, retries):
+        """A session-level retries below 1 must still send the request once instead of skipping it"""
+        async with AsyncFetcherSession(retries=retries, retry_delay=0) as session:
+            with (
+                patch.object(session._async_curl_session, "request", new=AsyncMock()) as mocked_request,
+                patch("scrapling.engines.static.ResponseFactory.from_http_request", return_value=MagicMock()),
+            ):
+                await session.get("http://example.com")
+
+            assert mocked_request.call_count == 1
+
+    @pytest.mark.asyncio
+    async def test_per_request_retries_below_one_still_sends_the_request(self):
+        """A per-request retries of 0 must override the session default without skipping the request"""
+        async with AsyncFetcherSession(retries=3, retry_delay=0) as session:
+            with (
+                patch.object(session._async_curl_session, "request", new=AsyncMock()) as mocked_request,
+                patch("scrapling.engines.static.ResponseFactory.from_http_request", return_value=MagicMock()),
+            ):
+                await session.get("http://example.com", retries=0)
+
+            assert mocked_request.call_count == 1
```

**File**: `tests/fetchers/sync/test_requests.py` (modified, +5/-0)
```diff
@@ -151,3 +151,8 @@ def test_selector_config_overrides_configure(self, fetcher, _reset_fetcher_confi
         )
         assert response._storage is not None
         assert response.url == "from-request.test"
+
+    def test_retries_below_one_still_performs_the_request(self, fetcher):
+        """``retries`` below 1 means "send the request once", not "send nothing"."""
+        assert fetcher.get(self.status_200, retries=0).status == 200
+        assert fetcher.get(self.status_200, retries=-1).status == 200
```

**File**: `tests/fetchers/sync/test_requests_session.py` (modified, +23/-0)
```diff
@@ -82,3 +82,26 @@ def test_proxy_rotates_per_retry_attempt(self):
 
             proxies_used = [call.kwargs["proxy"] for call in mocked_request.call_args_list]
             assert proxies_used == ["http://p1:8080", "http://p2:8080"]
+
+    @pytest.mark.parametrize("retries", [0, -1, None])
+    def test_retries_below_one_still_sends_the_request(self, retries):
+        """A session-level retries below 1 must still send the request once instead of skipping it"""
+        with FetcherSession(retries=retries, retry_delay=0) as session:
+            with (
+                patch.object(session._curl_session, "request") as mocked_request,
+                patch("scrapling.engines.static.ResponseFactory.from_http_request", return_value=MagicMock()),
+            ):
+                session.get("http://example.com")
+
+            assert mocked_request.call_count == 1
+
+    def test_per_request_retries_below_one_still_sends_the_request(self):
+        """A per-request retries of 0 must override the session default without skipping the request"""
+        with FetcherSession(retries=3, retry_delay=0) as session:
+            with (
+                patch.object(session._curl_session, "request") as mocked_request,
+                patch("scrapling.engines.static.ResponseFactory.from_http_request", return_value=MagicMock()),
+            ):
+                session.get("http://example.com", retries=0)
+
+            assert mocked_request.call_count == 1
```

---

### Incident Patch 2: `63cdc99c` (2026-08-23)
**Commit Message**: fix(spiders): keep the request meta on cached responses (#419)

**File**: `scrapling/spiders/engine.py` (modified, +2/-0)
```diff
@@ -200,6 +200,8 @@ async def _process_request(self, request: Request) -> None:
             cached = await self._cache_manager.get(request._fp)
             if cached is not None:
                 cached.request = request
+                # Cached responses are rebuilt without meta, so merge the request's in as the live path does
+                cached.meta = {**request.meta, **cached.meta}
                 self.stats.cache_hits += 1
                 self.stats.increment_requests_count(request.sid or self.session_manager.default_session_id)
                 self.stats.increment_response_bytes(request.domain, len(cached.body))
```

**File**: `tests/spiders/test_cache.py` (modified, +33/-2)
```diff
@@ -34,7 +34,6 @@ def _make_response(
 
 
 class TestResponseCacheManager:
-
     @pytest.mark.anyio
     async def test_put_get_roundtrip(self):
         with tempfile.TemporaryDirectory() as tmpdir:
@@ -268,7 +267,6 @@ async def start_requests(self) -> AsyncGenerator[Request, None]:
 
 
 class TestDevelopmentModeIntegration:
-
     @pytest.mark.anyio
     async def test_first_run_fetches_and_caches(self):
         with tempfile.TemporaryDirectory() as tmpdir:
@@ -317,3 +315,36 @@ async def test_disabled_by_default(self):
         sm.add("default", MockSession())
         engine = CrawlerEngine(spider, sm)
         assert engine._cache_manager is None
+
+    @pytest.mark.anyio
+    async def test_cached_run_keeps_the_request_meta(self):
+        """A cache hit must hand the callback the same meta the live fetch did, not an empty one"""
+
+        class MetaSpider(MockSpider):
+            async def parse(self, response) -> AsyncGenerator[Dict[str, Any] | Request | None, None]:
+                yield {"meta": dict(response.meta)}
+
+            async def start_requests(self) -> AsyncGenerator[Request, None]:
+                yield Request("https://example.com/page1", sid="default", meta={"page": 7})
+
+        with tempfile.TemporaryDirectory() as tmpdir:
+            spider = MetaSpider(cache_dir=tmpdir)
+            sm = SessionManager()
+            sm.add("default", MockSession())
+            await CrawlerEngine(spider, sm).crawl()
+
+            cached_spider = MetaSpider(cache_dir=tmpdir)
+            cached_sm = SessionManager()
+            cached_sm.add("default", MockSession())
+            cached_engine = CrawlerEngine(cached_spider, cached_sm)
+            await cached_engine.crawl()
+
+            assert cached_engine.stats.cache_hits == 1, (
+                f"Expected the second run to be served from the cache, got {cached_engine.stats.cache_hits} hits"
+            )
+            assert spider.scraped_items == [{"meta": {"page": 7}}], (
+                f"Expected the live run to see the request meta, got {spider.scraped_items}"
+            )
+            assert cached_spider.scraped_items == [{"meta": {"page": 7}}], (
+                f"Expected the cached run to see the request meta too, got {cached_spider.scraped_items}"
+            )
```

---

### Incident Patch 3: `6ca35d04` (2026-08-23)
**Commit Message**: feat(spiders): Adding easy interface for building RAG systems

**File**: `agent-skill/Scrapling-Skill/SKILL.md` (modified, +1/-0)
```diff
@@ -398,6 +398,7 @@ async with AsyncDynamicSession(capture_xhr=r"https://api\.example\.com/.*") as s
 ## References
 You already had a good glimpse of what the library can do. Use the references below to dig deeper when needed
 - `references/mcp-server.md` - MCP server tools, persistent session management, remote browsers over CDP, authentication, and capabilities
+- `references/building-rag-systems.md` - Converting pages/websites to LLM-ready Markdown with `Response.markdown()` and `SiteToMarkdownSpider` for RAG pipelines
 - `references/parsing` - Everything you need for parsing HTML
 - `references/fetching` - Everything you need to fetch websites and session persistence
 - `references/spiders` - Everything you need to write spiders, proxy rotation, and advanced features. It follows a Scrapy-like format
```

**File**: `agent-skill/Scrapling-Skill/references/building-rag-systems.md` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+# Building RAG Systems
+
+RAG pipelines are only as good as the text you feed them. Raw HTML wastes tokens on markup, navigation, scripts, and tracking noise, and it can even carry hidden prompt-injection content straight into your LLM. Scrapling turns pages and whole websites into clean, sanitized Markdown with no LLM in the loop, so your ingestion runs fast and costs nothing per page.
+
+## Installation
+
+```bash
+pip install "scrapling[rag]"
+
+scrapling install
+```
+
+The `rag` extra installs the fetchers with Markdown conversion support (the `ai`, `shell`, and `all` extras include it too). The `scrapling install` command downloads the browser dependencies, which you only need for the browser-based fetchers.
+
+## One page to Markdown
+
+Every [Response](fetching/choosing.md) has a `markdown()` method:
+
+```python
+from scrapling.fetchers import Fetcher
+
+markdown = Fetcher.get("https://example.com").markdown(main_content_only=True)
+```
+
+It works with all fetchers, so pages behind Cloudflare are one line away too:
+
+```python
+from scrapling.fetchers import StealthyFetcher
+
+markdown = StealthyFetcher.fetch("https://protected.example.com", solve_cloudflare=True).markdown(main_content_only=True)
+```
+
+Two arguments control the output:
+
+- `main_content_only`: Convert only the content inside the page's `<body>` tag.
+- `css_selector`: Convert only the elements matching a CSS selector (all matches are concatenated). Use it to extract exactly the part your pipeline needs and save tokens:
+
+```python
+markdown = Fetcher.get("https://example.com/docs/page").markdown(css_selector="article")
+```
+
+Whatever you pass, scripts, styles, and hidden content are always removed before conversion. This is the same cleaning the [MCP server](mcp-server.md) uses to protect AI agents from prompt injection: CSS-hidden elements, `aria-hidden` elements, `<template>` tags, HTML comments, and zero-width characters never reach your model.
+
+## A whole website to a Markdown corpus
+
+The `SiteToMarkdownSpider` template crawls a website and converts every page, powered by the [spiders framework](spiders/architecture.md), so you get concurrency, autothrottle, robots.txt compliance, and pause/resume for free:
+
+```python
+from scrapling.spiders import SiteToMarkdownSpider
+
+class DocsSpider(SiteToMarkdownSpider):
+    name = "docs"
+    start_urls = ["https://example.com/docs/"]
+    allowed_domains = {"example.com"}
+    output_dir = "docs_markdown"
+    max_pages = 200
+
+result = DocsSpider().start()
+result.items.to_jsonl("docs.jsonl")
+```
+
+Each crawled page becomes one item with `url`, `title`, and `markdown` keys. With `output_dir` set, each page is also written to a Markdown file named after its URL, so the run above gives you both a folder of `.md` files and a `docs.jsonl` ready for ingestion.
+
+The template requires `allowed_domains` so the crawl stays bound to the target website. The options:
+
+- `css_selector` / `main_content_only`: Passed to `markdown()` for every page, with `main_content_only` enabled by default.
+- `output_dir`: When set, writes one Markdown file per page.
+- `max_pages`: Maximum number of pages to convert. Requests already queued when the cap hits may still be fetched, but they aren't converted. `0` (the default) disables it.
+
+Every page link inside `allowed_domains` is followed by default. Since the template builds on [CrawlSpider](spiders/generic-templates.md), override `rules()` with your own [LinkExtractor](spiders/generic-templates.md) to control the crawl: `allow` narrows it to the URL patterns you want, and `deny` drops the patterns you don't (login pages, tag listings, print views, etc.):
+
+```python
+from scrapling.spiders import CrawlRule, LinkExtractor, SiteToMarkdownSpider
+
+class DocsSpider(SiteToMarkdownSpider):
+    name = "docs"
+    start_urls = ["https://example.com/"]
+    allowed_domains = {"example.com"}
+
+    def rules(self):
+        return [CrawlRule(LinkExtractor(allow=r"/docs/", deny=[r"/docs/changelog/", r"\?print="]))]
+```
+
+`deny` wins over `allow`, and a rule can carry a `priority` or a `process_request` hook as with any **CrawlSpider**.
+
+## Feeding a vector store
+
+The JSONL output plugs into any embedding pipeline. A minimal example:
+
+```python
+import json
+
+with open("docs.jsonl") as f:
+    for line in f:
+        page = json.loads(line)
+        for chunk in split_into_chunks(page["markdown"]):
+            vector_store.add(text=chunk, metadata={"url": page["url"], "title": page["title"]})
+```
+
+Use `css_selector` on the spider to cut boilerplate before chunking instead of cleaning it downstream. The less noise you embed, the better your retrieval.
+
+## Interactive alternatives
+
+For conversational scraping instead of pipelines, the [MCP server](mcp-server.md) gives your AI chatbot the same Markdown extraction as tools, and this agent skill teaches coding agents to write this code themselves.
```

**File**: `agent-skill/Scrapling-Skill/references/fetching/choosing.md` (modified, +6/-0)
```diff
@@ -75,4 +75,10 @@ page.captured_xhr    # List of captured XHR/fetch responses (when capture_xhr is
 ```
 All fetchers return the `Response` object.
 
+The `Response` object can also convert the page to clean, LLM-ready Markdown in one line:
+```python
+markdown = Fetcher.get('https://example.com').markdown(main_content_only=True)
+```
+Scripts, styles, and hidden/prompt-injection content are always removed before conversion, and you can pass `css_selector` to convert specific elements only. It requires the `rag` extra (included in `ai`/`shell`/`all` too). See `../building-rag-systems.md` for the full guide.
+
 **Note:** Unlike the [Selector](parsing/main_classes.md#selector) class, the `Response` class's body is always bytes since v0.4.
\ No newline at end of file
```

**File**: `agent-skill/Scrapling-Skill/references/spiders/generic-templates.md` (modified, +18/-0)
```diff
@@ -191,6 +191,24 @@ class PriceSpider(CSVFeedSpider):
 
 Gzipped feeds are decompressed automatically here as well, as shown above for **XMLFeedSpider**.
 
+## SiteToMarkdownSpider
+
+`SiteToMarkdownSpider` builds on **CrawlSpider** to crawl a website and convert every page to clean, LLM-ready Markdown, yielding one item per page (`url`, `title`, `markdown` keys) and optionally writing one Markdown file per page:
+
+```python
+from scrapling.spiders import SiteToMarkdownSpider
+
+class DocsSpider(SiteToMarkdownSpider):
+    name = "docs"
+    start_urls = ["https://example.com/docs/"]
+    allowed_domains = {"example.com"}
+    output_dir = "docs_markdown"
+
+result = DocsSpider().start()
+```
+
+It requires `allowed_domains` to keep the crawl bound to the target website. Options: `css_selector`/`main_content_only` (passed to `markdown()` per page, `main_content_only` enabled by default), `output_dir`, and `max_pages` (max pages to convert, `0` disables). Every page link inside `allowed_domains` is followed by default; override `rules()` with a `LinkExtractor` (`allow` to narrow the crawl, `deny` to drop URL patterns) to control it. The full guide is in `../building-rag-systems.md`.
+
 ## Using `LinkExtractor` directly
 
 You don't have to use the templates. `LinkExtractor` works inside any plain `Spider`:
```

**File**: `docs/ai/building-rag-systems.md` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+# Building RAG Systems with Scrapling
+
+RAG pipelines are only as good as the text you feed them. Raw HTML wastes tokens on markup, navigation, scripts, and tracking noise, and it can even carry hidden prompt-injection content straight into your LLM. Scrapling turns pages and whole websites into clean, sanitized Markdown with no LLM in the loop, so your ingestion runs fast and costs nothing per page.
+
+## Installation
+
+```bash
+pip install "scrapling[rag]"
+
+scrapling install
+```
+
+The `rag` extra installs the fetchers with Markdown conversion support (the `ai`, `shell`, and `all` extras include it too). The `scrapling install` command downloads the browser dependencies, which you only need for the browser-based fetchers.
+
+## One page to Markdown
+
+Every [Response](../fetching/choosing.md#response-object) has a `markdown()` method:
+
+```python
+from scrapling.fetchers import Fetcher
+
+markdown = Fetcher.get("https://example.com").markdown(main_content_only=True)
+```
+
+It works with all fetchers, so pages behind Cloudflare are one line away too:
+
+```python
+from scrapling.fetchers import StealthyFetcher
+
+markdown = StealthyFetcher.fetch("https://protected.example.com", solve_cloudflare=True).markdown(main_content_only=True)
+```
+
+Two arguments control the output:
+
+- `main_content_only`: Convert only the content inside the page's `<body>` tag.
+- `css_selector`: Convert only the elements matching a CSS selector (all matches are concatenated). Use it to extract exactly the part your pipeline needs and save tokens:
+
+```python
+markdown = Fetcher.get("https://example.com/docs/page").markdown(css_selector="article")
+```
+
+Whatever you pass, scripts, styles, and hidden content are always removed before conversion. This is the same cleaning the [MCP server](mcp-server.md) uses to protect AI agents from prompt injection: CSS-hidden elements, `aria-hidden` elements, `<template>` tags, HTML comments, and zero-width characters never reach your model.
+
+## A whole website to a Markdown corpus
+
+The `SiteToMarkdownSpider` template crawls a website and converts every page, powered by the [spiders framework](../spiders/architecture.md), so you get concurrency, autothrottle, robots.txt compliance, and pause/resume for free:
+
+```python
+from scrapling.spiders import SiteToMarkdownSpider
+
+class DocsSpider(SiteToMarkdownSpider):
+    name = "docs"
+    start_urls = ["https://example.com/docs/"]
+    allowed_domains = {"example.com"}
+    output_dir = "docs_markdown"
+    max_pages = 200
+
+result = DocsSpider().start()
+result.items.to_jsonl("docs.jsonl")
+```
+
+Each crawled page becomes one item with `url`, `title`, and `markdown` keys. With `output_dir` set, each page is also written to a Markdown file named after its URL, so the run above gives you both a folder of `.md` files and a `docs.jsonl` ready for ingestion.
+
+The template requires `allowed_domains` so the crawl stays bound to the target website. The options:
+
+- `css_selector` / `main_content_only`: Passed to `markdown()` for every page, with `main_content_only` enabled by default.
+- `output_dir`: When set, writes one Markdown file per page.
+- `max_pages`: Maximum number of pages to convert. Requests already queued when the cap hits may still be fetched, but they aren't converted. `0` (the default) disables it.
+
+Every page link inside `allowed_domains` is followed by default. Since the template builds on [CrawlSpider](../spiders/generic-templates.md#crawlspider), override `rules()` with your own [LinkExtractor](../spiders/generic-templates.md#linkextractor-reference) to control the crawl: `allow` narrows it to the URL patterns you want, and `deny` drops the patterns you don't (login pages, tag listings, print views, etc.):
+
+```python
+from scrapling.spiders import CrawlRule, LinkExtractor, SiteToMarkdownSpider
+
+class DocsSpider(SiteToMarkdownSpider):
+    name = "docs"
+    start_urls = ["https://example.com/"]
+    allowed_domains = {"example.com"}
+
+    def rules(self):
+        return [CrawlRule(LinkExtractor(allow=r"/docs/", deny=[r"/docs/changelog/", r"\?print="]))]
+```
+
+`deny` wins over `allow`, and a rule can carry a `priority` or a `process_request` hook as with any **CrawlSpider**.
+
+## Feeding a vector store
+
+The JSONL output plugs into any embedding pipeline. A minimal example:
+
+```python
+import json
+
+with open("docs.jsonl") as f:
+    for line in f:
+        page = json.loads(line)
+        for chunk in split_into_chunks(page["markdown"]):
+            vector_store.add(text=chunk, metadata={"url": page["url"], "title": page["title"]})
+```
+
+Use `css_selector` on the spider to cut boilerplate before chunking instead of cleaning it downstream. The less noise you embed, the better your retrieval.
+
+## Interactive alternatives
+
+For conversational scraping instead of pipelines, the [MCP server](mcp-server.md) gives your AI chatbot the same Markdown extraction as tools, and the [Ag
```

**File**: `docs/fetching/choosing.md` (modified, +6/-0)
```diff
@@ -81,6 +81,12 @@ page.captured_xhr    # List of captured XHR/fetch responses (when capture_xhr is
 ```
 All fetchers return the `Response` object.
 
+The `Response` object can also convert the page to clean, LLM-ready Markdown in one line:
+```python
+markdown = Fetcher.get('https://example.com').markdown(main_content_only=True)
+```
+Scripts, styles, and hidden/prompt-injection content are always removed before conversion, and you can pass `css_selector` to convert specific elements only. It requires the `rag` extra (included in `ai`/`shell`/`all` too), and the [Building RAG systems](../ai/building-rag-systems.md) page covers it in detail.
+
 !!! note
 
     Unlike the [Selector](../parsing/main_classes.md#selector) class, the `Response` class's body is always bytes since v0.4.
\ No newline at end of file
```

**File**: `docs/index.md` (modified, +4/-0)
```diff
@@ -203,6 +203,10 @@ pip install scrapling
        ```bash
        pip install "scrapling[ai]"
        ```
+     - Install dependencies for ([building RAG systems](ai/building-rag-systems.md)):
+       ```bash
+       pip install "scrapling[rag]"
+       ```
      - Install shell features (Web Scraping shell and the `extract` command): 
          ```bash
          pip install "scrapling[shell]"
```

**File**: `docs/spiders/generic-templates.md` (modified, +18/-0)
```diff
@@ -192,6 +192,24 @@ class PriceSpider(CSVFeedSpider):
 
 Gzipped feeds are decompressed automatically here as well, as shown above for **XMLFeedSpider**.
 
+## SiteToMarkdownSpider
+
+`SiteToMarkdownSpider` builds on **CrawlSpider** to crawl a website and convert every page to clean, LLM-ready Markdown, yielding one item per page and optionally writing one Markdown file per page:
+
+```python
+from scrapling.spiders import SiteToMarkdownSpider
+
+class DocsSpider(SiteToMarkdownSpider):
+    name = "docs"
+    start_urls = ["https://example.com/docs/"]
+    allowed_domains = {"example.com"}
+    output_dir = "docs_markdown"
+
+result = DocsSpider().start()
+```
+
+It requires `allowed_domains` to keep the crawl bound to the target website. The full guide, including all its options and how to feed the output to RAG pipelines, is on the [Building RAG systems](../ai/building-rag-systems.md) page.
+
 ## Using `LinkExtractor` directly
 
 You don't have to use the templates. `LinkExtractor` works inside any plain `Spider`:
```

---

### Incident Patch 4: `93ae0ac9` (2026-08-21)
**Commit Message**: fix(mcp): Set the session proxy to be browser-level argument

Thanks for @Yigtwxx for pointing that out in #418

**File**: `docs/ai/mcp-server.md` (modified, +2/-1)
```diff
@@ -60,7 +60,8 @@ Since version 0.4.15, the MCP server is reworked. If you are upgrading, note:
 
 1. **The Streamable HTTP transport now requires authentication and binds to localhost.** `scrapling-mcp --http` on its own refuses to start; pass `--auth-token` (or the `SCRAPLING_MCP_AUTH_TOKEN` environment variable), or `--no-auth` to serve it unauthenticated on purpose. The default host is now `127.0.0.1` instead of `0.0.0.0`; pass `--host 0.0.0.0` to accept connections from the network.
 2. **The one-shot fetch tools no longer accept `session_id`.** `fetch`, `bulk_fetch`, `stealthy_fetch`, and `bulk_stealthy_fetch` always launch their own browser. To fetch through a session, use the new **`session_fetch`** tool (one URL per call, works with dynamic and stealthy sessions).
-3. **`open_session` takes browser-level parameters only.** The per-request options (`wait`, `timeout`, `google_search`, `network_idle`, `disable_resources`, `wait_selector`, `wait_selector_state`, `extra_headers`, `proxy`, `solve_cloudflare`) moved to `session_fetch` and are supplied on each call. `max_pages` was removed too, since a session manages a single page per call now.
+3. **`open_session` takes browser-level parameters only.** The per-request options (`wait`, `timeout`, `google_search`, `network_idle`, `disable_resources`, `wait_selector`, `wait_selector_state`, `extra_headers`, `solve_cloudflare`) moved to `session_fetch` and are supplied on each call. `proxy` stays on `open_session` (it applies to the whole session, which runs a single tab). `max_pages` was removed too, since a session manages a single page per call now.
+4. **The `get` tool is renamed to `make_request`.** It now takes a `method` parameter and supports GET (default), POST, PUT, and DELETE, with `data`/`json` for request bodies. `bulk_get` is unchanged.
 
 ## Installation
 
```

**File**: `scrapling/core/ai.py` (modified, +4/-4)
```diff
@@ -60,7 +60,7 @@ def _typed_dict_keys(typed_dict: Any) -> frozenset:
     return frozenset(typed_dict.__required_keys__ | typed_dict.__optional_keys__)
 
 
-_EXCLUDED_FETCH_KEYS = frozenset({"page_action", "page_setup", "selector_config"})
+_EXCLUDED_FETCH_KEYS = frozenset({"page_action", "page_setup", "selector_config", "proxy"})
 _PLAYWRIGHT_FETCH_KEYS = _typed_dict_keys(PlaywrightFetchParams) - _EXCLUDED_FETCH_KEYS
 _STEALTH_FETCH_KEYS = _typed_dict_keys(StealthFetchParams) - _EXCLUDED_FETCH_KEYS
 
@@ -208,6 +208,7 @@ async def open_session(
         timezone_id: str | None = None,
         locale: str | None = None,
         useragent: Optional[str] = None,
+        proxy: Optional[str | Dict[str, str]] = None,
         cdp_url: Optional[str] = None,
         executable_path: Optional[str] = None,
         cookies: Sequence[SetCookieParam] | None = None,
@@ -228,6 +229,7 @@ async def open_session(
         :param timezone_id: Changes the timezone of the browser. Defaults to the system timezone.
         :param locale: Specify user locale, for example, `en-GB`, `de-DE`, etc.
         :param useragent: Pass a useragent string to be used. Otherwise the fetcher will generate a real Useragent of the same browser and use it.
+        :param proxy: The proxy used for every request in this session, as a string or a dictionary with the keys 'server', 'username', and 'password' only.
         :param cdp_url: Instead of launching a new browser instance, connect to this CDP URL to control real browsers through CDP.
         :param executable_path: Absolute path to a custom Chromium-compatible browser executable. Overrides the server-wide default for this session.
         :param cookies: Set cookies for the session. It should be in a dictionary format that Playwright accepts.
@@ -243,6 +245,7 @@ async def open_session(
             )
 
         common_kwargs: Dict[str, Any] = dict(
+            proxy=proxy,
             locale=locale,
             cookies=cookies,
             cdp_url=cdp_url,
@@ -872,7 +875,6 @@ async def session_fetch(
         wait_selector_state: SelectorWaitStates = "attached",
         extra_headers: Optional[Dict[str, str]] = None,
         blocked_domains: Optional[Set[str]] = None,
-        proxy: Optional[str | Dict[str, str]] = None,
         solve_cloudflare: bool = False,
     ) -> ResponseModel:
         """Fetch a URL through a browser session previously opened with `open_session` and return a structured output of the result.
@@ -894,7 +896,6 @@ async def session_fetch(
         :param wait_selector_state: The state to wait for the selector given with `wait_selector`.
         :param extra_headers: A dictionary of extra headers to add to the request. _The referer set by `google_search` takes priority over the referer set here if used together._
         :param blocked_domains: A list of domain names to block requests to for this request. Subdomains are also matched.
-        :param proxy: The proxy to be used with this request, it can be a string or a dictionary with the keys 'server', 'username', and 'password' only.
         :param solve_cloudflare: (Stealthy sessions only) Solves all types of the Cloudflare's Turnstile/Interstitial challenges before returning the response.
         """
         entry = self._get_session(session_id, expected_type=None)
@@ -916,7 +917,6 @@ async def session_fetch(
             wait_selector_state=wait_selector_state,
             extra_headers=extra_headers,
             blocked_domains=blocked_domains,
-            proxy=proxy,
             solve_cloudflare=solve_cloudflare,
         )
         page = await entry.session.fetch(
```

---

### Incident Patch 5: `d4e121ce` (2026-08-19)
**Commit Message**: fix(ai)!: keep session settings on MCP session fetches (#418)

The three MCP tools that accept a `session_id` forwarded every per-fetch
parameter to the session's `fetch()`, including their own defaults when
the caller supplied nothing. `validate_fetch` treats every key it
receives as an override, so the branch that reads the value from the
session config never ran, and the tool defaults replaced the settings the
session was opened with.

- Forward only the parameters the caller actually supplied
- Default those parameters to `None` on `fetch`, `bulk_fetch`,
  `stealthy_fetch`, `bulk_stealthy_fetch` and `screenshot`
- Add regression tests for the forwarded kwargs, and for the session
  settings surviving the validation the tools go through

**File**: `scrapling/core/ai.py` (modified, +77/-93)
```diff
@@ -53,6 +53,11 @@ def _page_pool_size(urls: Sequence[str]) -> int:
     return min(max(len(urls), 1), _MAX_POOL_PAGES)
 
 
+def _supplied_params(**params: Any) -> Dict[str, Any]:
+    """Keep only the parameters the caller set, so the unset ones fall back to the session/fetcher defaults."""
+    return {name: value for name, value in params.items() if value is not None}
+
+
 _FETCH_TOOL_ANNOTATIONS = ToolAnnotations(read_only_hint=True, open_world_hint=True)
 _SESSION_TOOL_ANNOTATIONS = ToolAnnotations(read_only_hint=False, destructive_hint=False, open_world_hint=True)
 _LIST_TOOL_ANNOTATIONS = ToolAnnotations(read_only_hint=True, open_world_hint=False)
@@ -321,11 +326,11 @@ async def screenshot(
         image_type: ScreenshotType = "png",
         full_page: bool = False,
         quality: Optional[int] = None,
-        wait: int | float = 0,
+        wait: int | float | None = None,
         wait_selector: Optional[str] = None,
-        wait_selector_state: SelectorWaitStates = "attached",
-        network_idle: bool = False,
-        timeout: int | float = 30000,
+        wait_selector_state: Optional[SelectorWaitStates] = None,
+        network_idle: bool | None = None,
+        timeout: int | float | None = None,
     ) -> List[ImageContent | TextContent]:
         """Capture a screenshot of a web page using an existing browser session and return it as an image.
         A browser session must be opened first with `open_session` (either `dynamic` or `stealthy`); the session ID is then passed here.
@@ -335,11 +340,11 @@ async def screenshot(
         :param image_type: Image format. Defaults to "png". Use "jpeg" for smaller file sizes.
         :param full_page: When True, captures the full scrollable page instead of just the viewport. Defaults to False.
         :param quality: Image quality (0-100) for JPEG only. Raises if passed with `image_type="png"`.
-        :param wait: Time in milliseconds to wait after page load before capturing. Defaults to 0.
-        :param wait_selector: Optional CSS selector to wait for before capturing.
-        :param wait_selector_state: State to wait for the selector. Defaults to "attached".
-        :param network_idle: Wait for the page until there are no network connections for at least 500 ms.
-        :param timeout: Timeout in milliseconds for page operations. Defaults to 30,000.
+        :param wait: Time in milliseconds to wait after page load before capturing. Uses the session's setting when omitted.
+        :param wait_selector: Optional CSS selector to wait for before capturing. Uses the session's setting when omitted.
+        :param wait_selector_state: State to wait for the selector. Uses the session's setting when omitted.
+        :param network_idle: Wait for the page until there are no network connections for at least 500 ms. Uses the session's setting when omitted.
+        :param timeout: Timeout in milliseconds for page operations. Uses the session's setting when omitted.
         """
         if quality is not None and image_type != "jpeg":
             raise ValueError("'quality' is only valid when 'image_type' is 'jpeg'.")
@@ -361,12 +366,14 @@ async def _capture(page: Any) -> None:
 
         await entry.session.fetch(
             url,
-            wait=wait,
-            timeout=timeout,
-            network_idle=network_idle,
-            wait_selector=wait_selector,
-            wait_selector_state=wait_selector_state,
             page_action=_capture,
+            **_supplied_params(
+                wait=wait,
+                timeout=timeout,
+                network_idle=network_idle,
+                wait_selector=wait_selector,
+                wait_selector_state=wait_selector_state,
+            ),
         )
 
         if "error" in captured:
@@ -529,22 +536,22 @@ async def fetch(
         css_selector: Optional[str] = None,
         main_content_only: bool = True,
         headless: bool = True,  # noqa: F821
-        google_search: bool = True,
+        google_search: bool | None = None,
         real_chrome: bool = False,
-        wait: int | float = 0,
+        wait: int | float | None = None,
         proxy: Optional[str | Dict[str, str]] = None,
         timezone_id: str | None = None,
         locale: str | None = None,
         extra_headers: Optional[Dict[str, str]] = None,
         useragent: Optional[str] = None,
         cdp_url: Optional[str] = None,
         executable_path: Optional[str] = None,
-        timeout: int | float = 30000,
-        disable_resources: bool = False,
+        timeout: int | float | None = None,
+        disable_resources: bool | None = None,
         wait_selector: Optional[str] = None,
         cookies: Sequence[SetCookieParam] | None = None,
-        network_idle: bool = False,
-        wait_selector_state: SelectorWaitStates = "attached",
+        network_idle: bool | None = None,
+        wait_selector_state: Optional[SelectorWaitStates] = None,
         session_id: Optional[str] = N
```

**File**: `tests/ai/test_ai_mcp.py` (modified, +267/-1)
```diff
@@ -24,9 +24,11 @@
     _normalize_credentials,
     _page_pool_size,
     _StaticTokenVerifier,
+    _supplied_params,
     _translate_response,
 )
-from scrapling.fetchers import AsyncDynamicSession
+from scrapling.engines._browsers._validators import PlaywrightConfig, StealthConfig, validate_fetch
+from scrapling.fetchers import AsyncDynamicSession, AsyncStealthySession
 
 
 def test_translate_response_strips_control_characters():
@@ -49,11 +51,21 @@ def test_translate_response_strips_control_characters():
     assert not any(ord(c) < 0x20 and c not in "\t\n\r" for c in joined)
 
 
+class _FakePage:
+    """The page object a fake session hands to a `page_action`."""
+
+    url = "https://example.com/captured"
+
+    async def screenshot(self, **kwargs: Any) -> bytes:
+        return b"fake-png-bytes"
+
+
 class _FakeAsyncBrowserSession:
     instances: list["_FakeAsyncBrowserSession"] = []
 
     def __init__(self, **kwargs: Any) -> None:
         self.kwargs = kwargs
+        self.fetch_calls: list[dict[str, Any]] = []
         self._is_alive = False
         type(self).instances.append(self)
 
@@ -71,6 +83,9 @@ async def close(self) -> None:
         self._is_alive = False
 
     async def fetch(self, url: str, **kwargs: Any) -> Response:
+        self.fetch_calls.append(kwargs)
+        if kwargs.get("page_action") is not None:
+            await kwargs["page_action"](_FakePage())
         return Response(
             url=url,
             content="<html><body>ok</body></html>",
@@ -378,6 +393,257 @@ def test_page_pool_size_is_accepted_by_session_validation(self, url_count):
         )
 
 
+async def _noop_page_action(page: Any) -> None:
+    """Stand-in for the `page_action` the screenshot tool always sends."""
+
+
+class TestSessionSettingsSurviveFetchKwargs:
+    """The kwargs the tools send on the session path must not overwrite the settings of the session"""
+
+    def test_dynamic_session_settings_survive_bulk_fetch_kwargs(self):
+        """Options left out of a `bulk_fetch` call keep the values `open_session` was given"""
+        session = AsyncDynamicSession(
+            wait=1500,
+            timeout=45000,
+            network_idle=True,
+            disable_resources=True,
+            google_search=False,
+            wait_selector="#main",
+            wait_selector_state="visible",
+            extra_headers={"x-test": "1"},
+        )
+
+        params = validate_fetch(
+            _supplied_params(
+                wait=None,
+                timeout=None,
+                google_search=None,
+                extra_headers=None,
+                disable_resources=None,
+                wait_selector=None,
+                wait_selector_state=None,
+                network_idle=None,
+            ),
+            session,
+            PlaywrightConfig,
+        )
+
+        assert params.wait == 1500, f"Expected the session's wait 1500, got {params.wait}"
+        assert params.timeout == 45000, f"Expected the session's timeout 45000, got {params.timeout}"
+        assert params.network_idle is True, f"Expected the session's network_idle True, got {params.network_idle}"
+        assert params.disable_resources is True, (
+            f"Expected the session's disable_resources True, got {params.disable_resources}"
+        )
+        assert params.google_search is False, f"Expected the session's google_search False, got {params.google_search}"
+        assert params.wait_selector == "#main", (
+            f"Expected the session's wait_selector '#main', got {params.wait_selector}"
+        )
+        assert params.wait_selector_state == "visible", (
+            f"Expected the session's wait_selector_state 'visible', got {params.wait_selector_state}"
+        )
+        assert params.extra_headers == {"x-test": "1"}, (
+            f"Expected the session's extra_headers, got {params.extra_headers}"
+        )
+
+    def test_stealthy_session_keeps_solving_cloudflare(self):
+        """A session opened with `solve_cloudflare` keeps solving, and keeps the timeout that comes with it"""
+        session = AsyncStealthySession(solve_cloudflare=True)
+
+        assert session._config.timeout == 60_000, (
+            f"Expected solve_cloudflare to raise the session timeout to 60,000, got {session._config.timeout}"
+        )
+
+        params = validate_fetch(
+            _supplied_params(
+                wait=None,
+                timeout=None,
+                google_search=None,
+                extra_headers=None,
+                disable_resources=None,
+                wait_selector=None,
+                wait_selector_state=None,
+                network_idle=None,
+                solve_cloudflare=None,
+            ),
+            session,
+            StealthConfig,
+        )
+
+        assert params.solve_cloudflare is True, (
+            f"Expected the session's solve_cloudflare True, got {params.solve_cloudflare}"
+        )
+        assert params.timeout == 60_000, f"Ex
```

---

### Incident Patch 6: `0003f644` (2026-08-19)
**Commit Message**: fix(parser): keep filtering on blank class_ and escape CSS string values (#417)

**File**: `scrapling/parser.py` (modified, +17/-4)
```diff
@@ -53,6 +53,19 @@
     "for_": "for",
 }
 _T = TypeVar("_T")
+
+
+def _escape_css_string(value: str) -> str:
+    """Escape the characters that can't appear literally inside a CSS double-quoted string.
+
+    Line breaks have to be written as hexadecimal escapes, the trailing space ends the escape.
+    Backslashes are left alone on purpose: `cssselect` drops characters while unescaping them
+    (both `\\\\` and `\\5C ` lose the backslash and the character after it), so no form we could
+    emit here would match them anyway.
+    """
+    return value.replace('"', r"\"").replace("\n", r"\A ").replace("\r", r"\D ").replace("\f", r"\C ")
+
+
 # Pre-compiled selectors for efficiency
 _find_all_elements = XPath(".//*")
 _find_all_elements_with_spaces = XPath(
@@ -760,13 +773,13 @@ def find_all(
         for tag in tags:
             selector = tag
             for key, value in attributes.items():
-                value = value.replace('"', r"\"")  # Escape double quotes in user input
                 # Not escaping anything with the key so the user can pass patterns like {'href*': '/p/'} or get errors :)
-                if key == "class":
+                if key == "class" and (class_names := value.split()):
                     # `class` is a space-separated list, so exact-match [class="x"] misses class="x y"; match each name with ~=
-                    selector += "".join('[class~="{}"]'.format(t) for t in value.split())
+                    # An empty/blank value has no names to match, so it falls through to the exact match below
+                    selector += "".join('[class~="{}"]'.format(_escape_css_string(name)) for name in class_names)
                 else:
-                    selector += '[{}="{}"]'.format(key, value)
+                    selector += '[{}="{}"]'.format(key, _escape_css_string(value))
             if selector != "*":
                 selectors.append(selector)
 
```

**File**: `tests/parser/test_general.py` (modified, +16/-0)
```diff
@@ -175,6 +175,22 @@ def test_find_all_matches_all_of_multiple_tokens(self, page):
         assert len(page.find_all("div", class_="stock hidden")) == 3
         assert page.find_all("div", class_="hidden nonexistent") == []
 
+    def test_find_all_keeps_filtering_on_a_blank_class(self):
+        """A blank class has no names to match, so it must match `class=""` instead of being dropped"""
+        blank_class = Selector('<div class="">empty</div><div class="a">a</div><div>none</div>')
+
+        assert [element.get_all_text() for element in blank_class.find_all("div", class_="")] == ["empty"]
+        assert blank_class.find_all("div", class_="   ") == []
+
+
+class TestFindByEscapedAttributes:
+    def test_find_all_matches_values_needing_css_escapes(self):
+        """Quotes and line breaks can't appear literally inside a CSS string, so they have to be escaped"""
+        page = Selector('<a title=\'say "hi"\'>quoted</a><a title="one\ntwo">broken</a>')
+
+        assert page.find("a", title='say "hi"').get_all_text() == "quoted"
+        assert page.find("a", title="one\ntwo").get_all_text() == "broken"
+
 
 # Error Handling Tests
 class TestErrorHandling:
```

---

### Incident Patch 7: `c0326263` (2026-08-19)
**Commit Message**: fix(stealth): solve Cloudflare challenges regardless of locale + retry cap + fix crashing mid-solve

The solver matched English challenge strings, so any non-default locale left the challenge unsolved.
The real cause was Playwright's context locale option patching the main thread only, while Web Workers kept the browser language, a mismatch Cloudflare rejects. Locale is now applied via browser launch flags, so the page, workers, and the Accept-Language header stay consistent, and the solver checks the language-free challenge markers with a retry cap.

Also catch patchright errors in the page-content retry so stealth pages stop crashing mid-solve.

Co-Authored-By: Parash Subedi <[REDACTED_EMAIL]>

**File**: `scrapling/engines/_browsers/_base.py` (modified, +28/-1)
```diff
@@ -437,11 +437,13 @@ def __generate_options__(self, extra_flags: Tuple | None = None) -> None:
         self._context_options.update(
             {
                 "proxy": config.proxy,
-                "locale": config.locale,
                 "timezone_id": config.timezone_id,
                 "extra_http_headers": config.extra_headers,
             }
         )
+        if config.locale and config.cdp_url:
+            # Launch flags can't be set on remote browsers, so the detectable context option is the best effort left
+            self._context_options["locale"] = config.locale
         # The default useragent in the headful is always correct now in the current versions of Playwright
         if config.useragent:
             self._context_options["user_agent"] = config.useragent
@@ -462,6 +464,17 @@ def __generate_options__(self, extra_flags: Tuple | None = None) -> None:
                 else:
                     flags = list(flags) + [doh_flag]
 
+            if config.locale:
+                # The context `locale` option patches the main thread only, so Web Workers keep the browser's real
+                # language and WAFs like Cloudflare flag the mismatch. Launch flags set it browser-wide instead,
+                # so workers, `Intl`, and the `Accept-Language` header all follow natively.
+                base_lang = config.locale.split("-")[0].lower()
+                accept_lang = f"{config.locale},{base_lang}" if base_lang != config.locale.lower() else config.locale
+                flags = (flags if isinstance(flags, list) else list(flags)) + [
+                    f"--lang={config.locale}",
+                    f"--accept-lang={accept_lang}",
+                ]
+
             self._browser_options.update(
                 {
                     "args": flags,
@@ -575,3 +588,17 @@ def _detect_cloudflare(page_content: str) -> str | None:
             return "embedded"
 
         return None
+
+    @classmethod
+    def _challenge_cleared(cls, page_content: str, challenge_type: str) -> bool:
+        """
+        Check whether the Cloudflare challenge is no longer present in the page content.
+
+        Args:
+            page_content (str): The content of the page to analyze.
+            challenge_type (str): The challenge type returned by `_detect_cloudflare`.
+
+        Returns:
+            bool: True if the challenge is gone from the page, False otherwise.
+        """
+        return challenge_type == "embedded" or cls._detect_cloudflare(page_content) is None
```

**File**: `scrapling/engines/_browsers/_stealth.py` (modified, +49/-26)
```diff
@@ -17,6 +17,7 @@
 from scrapling.engines._browsers._validators import validate_fetch as _validate, StealthConfig
 
 __CF_PATTERN__ = re_compile(r"^https?://challenges\.cloudflare\.com/cdn-cgi/challenge-platform/.*")
+__CF_MAX_SOLVE_ATTEMPTS__ = 3
 
 
 class StealthySession(SyncSession, StealthySessionMixin):
@@ -104,33 +105,43 @@ def start(self) -> None:
         else:
             raise RuntimeError("Session has been already started")
 
-    def _cloudflare_solver(self, page: Page) -> None:  # pragma: no cover
+    def _cloudflare_solver(self, page: Page, _attempts: int = 0) -> None:  # pragma: no cover
         """Solve the cloudflare challenge displayed on the playwright page passed
 
         :param page: The targeted page
+        :param _attempts: The number of solve attempts done so far, used internally to cap the retries.
         :return:
         """
         self._wait_for_networkidle(page, timeout=5000)
         challenge_type = self._detect_cloudflare(ResponseFactory._get_page_content(page))
         if not challenge_type:
             log.error("No Cloudflare challenge found.")
             return None
+        elif _attempts >= __CF_MAX_SOLVE_ATTEMPTS__:
+            log.error(f"Failed to solve the Cloudflare challenge after {_attempts} attempts, returning the page as is")
+            return None
         else:
             log.info(f'The turnstile version discovered is "{challenge_type}"')
             if challenge_type == "non-interactive":
-                while "<title>Just a moment...</title>" in (ResponseFactory._get_page_content(page)):
+                while self._detect_cloudflare(ResponseFactory._get_page_content(page)) == "non-interactive":
                     log.info("Waiting for Cloudflare wait page to disappear.")
                     page.wait_for_timeout(1000)
                     page.wait_for_load_state()
-                log.info("Cloudflare captcha is solved")
-                return None
+                if self._challenge_cleared(ResponseFactory._get_page_content(page), challenge_type):
+                    log.info("Cloudflare captcha is solved")
+                    return None
+                return self._cloudflare_solver(page, _attempts + 1)
 
             else:
                 box_selector = "#cf_turnstile div, #cf-turnstile div, .turnstile>div>div"
                 if challenge_type != "embedded":
                     box_selector = ".main-content p+div>div>div"
-                    while "Verifying you are human." in ResponseFactory._get_page_content(page):
-                        # Waiting for the verify spinner to disappear, checking every 1s if it disappeared
+                    for _ in range(20):
+                        # Waiting for the verify spinner to resolve into the widget iframe or pass on its own
+                        if page.frame(url=__CF_PATTERN__) is not None or self._challenge_cleared(
+                            ResponseFactory._get_page_content(page), challenge_type
+                        ):
+                            break
                         page.wait_for_timeout(500)
 
                 outer_box: Any = {}
@@ -146,11 +157,14 @@ def _cloudflare_solver(self, page: Page) -> None:  # pragma: no cover
                     outer_box = iframe.frame_element().bounding_box()
 
                 if not iframe or not outer_box:
-                    if "<title>Just a moment...</title>" not in (ResponseFactory._get_page_content(page)):
+                    if self._challenge_cleared(ResponseFactory._get_page_content(page), challenge_type):
                         log.info("Cloudflare captcha is solved")
                         return None
 
                     outer_box = page.locator(box_selector).last.bounding_box()
+                    if not outer_box:
+                        page.wait_for_timeout(1000)
+                        return self._cloudflare_solver(page, _attempts + 1)
 
                 # Calculate the Captcha coordinates for any viewport
                 captcha_x, captcha_y = outer_box["x"] + randint(26, 28), outer_box["y"] + randint(25, 27)
@@ -161,25 +175,22 @@ def _cloudflare_solver(self, page: Page) -> None:  # pragma: no cover
 
                 if challenge_type != "embedded":
                     attempts = 0
-                    while "<title>Just a moment...</title>" in ResponseFactory._get_page_content(page):
+                    while not self._challenge_cleared(ResponseFactory._get_page_content(page), challenge_type):
                         # Wait for the page
                         if attempts >= 100:
                             log.info("Cloudflare page didn't disappear after 10s, continuing...")
                             break
                         page.wait_for_timeout(100)
                         attempts += 1
 
-                    # page.locator(box_selector).last.wait_for(state="detached")
-                    # page.locator(".zone-name-title").wait_for(state="hidden")
-
          
```

**File**: `scrapling/engines/toolbelt/convertor.py` (modified, +3/-2)
```diff
@@ -3,6 +3,7 @@
 
 from curl_cffi.requests import Response as CurlResponse
 from playwright._impl._errors import Error as PlaywrightError
+from patchright._impl._errors import Error as PatchrightError
 from playwright.sync_api import Page as SyncPage, Response as SyncResponse
 from playwright.async_api import Page as AsyncPage, Response as AsyncResponse
 
@@ -206,7 +207,7 @@ def _get_page_content(cls, page: SyncPage, max_retries: int = 20) -> str:
         for _ in range(max_retries):
             try:
                 return page.content() or ""
-            except PlaywrightError:
+            except (PlaywrightError, PatchrightError):
                 page.wait_for_timeout(500)
         raise RuntimeError(f"Failed to retrieve the page content after retrying for {max_retries * 500}ms.")
 
@@ -221,7 +222,7 @@ async def _get_async_page_content(cls, page: AsyncPage, max_retries: int = 20) -
         for _ in range(max_retries):
             try:
                 return (await page.content()) or ""
-            except PlaywrightError:
+            except (PlaywrightError, PatchrightError):
                 await page.wait_for_timeout(500)
         raise RuntimeError(f"Failed to retrieve the page content after retrying for {max_retries * 500}ms.")
 
```

**File**: `tests/fetchers/test_cloudflare_solver.py` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+from unittest.mock import AsyncMock, MagicMock
+
+import pytest
+from patchright._impl._errors import Error as PatchrightError
+from playwright._impl._errors import Error as PlaywrightError
+
+from scrapling.engines.toolbelt.convertor import ResponseFactory
+from scrapling.engines._browsers._stealth import StealthySession, AsyncStealthySession, __CF_MAX_SOLVE_ATTEMPTS__
+
+FRENCH_CHALLENGE = (
+    "<html><head><title>Un instant…</title></head><body><script>cType: 'interactive'</script></body></html>"
+)
+CLEAN_PAGE = "<html><head><title>La Redoute</title></head><body>content</body></html>"
+
+
+class TestChallengeCleared:
+    def test_localized_challenge_is_not_cleared(self):
+        """The check must catch the challenge markers no matter what language the page is displayed with"""
+        assert StealthySession._challenge_cleared(FRENCH_CHALLENGE, "interactive") is False
+
+    def test_clean_page_is_cleared(self):
+        assert StealthySession._challenge_cleared(CLEAN_PAGE, "interactive") is True
+
+    def test_embedded_is_always_cleared(self):
+        """Embedded widgets stay in the page after solving, so they are always reported as cleared"""
+        content = '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>'
+        assert StealthySession._challenge_cleared(content, "embedded") is True
+
+
+def _make_sync_page():
+    page = MagicMock()
+    page.frame.return_value = None
+    page.locator.return_value.last.bounding_box.return_value = {"x": 100, "y": 200}
+    return page
+
+
+class TestSyncSolver:
+    def _solver_setup(self, monkeypatch, content_state):
+        monkeypatch.setattr(ResponseFactory, "_get_page_content", staticmethod(lambda page: content_state["content"]))
+        monkeypatch.setattr(StealthySession, "_wait_for_networkidle", lambda self, page, timeout=None: None)
+        monkeypatch.setattr(
+            StealthySession, "_wait_for_page_stability", lambda self, page, load_dom, network_idle: None
+        )
+        return object.__new__(StealthySession)
+
+    def test_solver_clicks_localized_challenge(self, monkeypatch):
+        """A localized challenge page must still be detected, clicked, and confirmed as solved"""
+        state = {"content": FRENCH_CHALLENGE}
+        session = self._solver_setup(monkeypatch, state)
+        page = _make_sync_page()
+        page.mouse.click.side_effect = lambda *args, **kwargs: state.update(content=CLEAN_PAGE)
+
+        assert session._cloudflare_solver(page) is None
+        assert page.mouse.click.call_count == 1
+        x, y = page.mouse.click.call_args.args
+        assert 126 <= x <= 128
+        assert 225 <= y <= 227
+
+    def test_solver_stops_after_max_attempts(self, monkeypatch):
+        """A challenge that never clears must stop after the attempts cap instead of retrying forever"""
+        state = {"content": FRENCH_CHALLENGE}
+        session = self._solver_setup(monkeypatch, state)
+        page = _make_sync_page()
+
+        assert session._cloudflare_solver(page) is None
+        assert page.mouse.click.call_count == __CF_MAX_SOLVE_ATTEMPTS__
+
+
+class TestAsyncSolver:
+    def _solver_setup(self, monkeypatch, content_state):
+        async def content(page):
+            return content_state["content"]
+
+        monkeypatch.setattr(ResponseFactory, "_get_async_page_content", staticmethod(content))
+        monkeypatch.setattr(AsyncStealthySession, "_wait_for_networkidle", AsyncMock())
+        monkeypatch.setattr(AsyncStealthySession, "_wait_for_page_stability", AsyncMock())
+        return object.__new__(AsyncStealthySession)
+
+    @pytest.mark.asyncio
+    async def test_solver_clicks_localized_challenge(self, monkeypatch):
+        state = {"content": FRENCH_CHALLENGE}
+        session = self._solver_setup(monkeypatch, state)
+        page = MagicMock()
+        page.frame.return_value = None
+        page.wait_for_timeout = AsyncMock()
+        page.wait_for_load_state = AsyncMock()
+        page.locator.return_value.last.bounding_box = AsyncMock(return_value={"x": 100, "y": 200})
+        page.mouse.click = AsyncMock(side_effect=lambda *args, **kwargs: state.update(content=CLEAN_PAGE))
+
+        assert await session._cloudflare_solver(page) is None
+        assert page.mouse.click.await_count == 1
+        x, y = page.mouse.click.await_args.args
+        assert 126 <= x <= 128
+        assert 225 <= y <= 227
+
+    @pytest.mark.asyncio
+    async def test_solver_stops_after_max_attempts(self, monkeypatch):
+        state = {"content": FRENCH_CHALLENGE}
+        session = self._solver_setup(monkeypatch, state)
+        page = MagicMock()
+        page.frame.return_value = None
+        page.wait_for_timeout = AsyncMock()
+        page.wait_for_load_state = AsyncMock()
+        page.locator.return_value.last.bounding_box = AsyncMock(return_value={"x": 100, "y": 200})
+        page.mouse.click = AsyncMock()
+
+        assert await session._cloudflare_solver(p
```

---

### Incident Patch 8: `e90875f3` (2026-08-18)
**Commit Message**: docs: fix missing parts from the updates

Missing from #414

**File**: `agent-skill/Scrapling-Skill/references/mcp-server.md` (modified, +6/-0)
```diff
@@ -215,6 +215,12 @@ docker pull pyd4vinci/scrapling
 docker run -i --rm pyd4vinci/scrapling mcp
 ```
 
+That runs the stdio transport. To use Streamable HTTP inside Docker, bind to `0.0.0.0` yourself and set a token, since the container's `127.0.0.1` is not reachable through the published port:
+
+```bash
+docker run -p 8000:8000 -e SCRAPLING_MCP_AUTH_TOKEN="<your-token>" pyd4vinci/scrapling mcp --http --host 0.0.0.0
+```
+
 ## Custom browser executable
 
 Browser-based tools (`fetch`, `bulk_fetch`, `stealthy_fetch`, `bulk_stealthy_fetch`, and `open_session`) can use a custom Chromium-compatible browser executable instead of the bundled Chromium. This is useful for custom browser builds or lightweight browser engines.
```

**File**: `docs/ai/mcp-server.md` (modified, +5/-0)
```diff
@@ -212,6 +212,11 @@ scrapling-mcp --http --host '0.0.0.0' --port 8000
 ```
 The default only accepts connections from the same machine. Pass `--host '0.0.0.0'` when you want the server to be reachable from the network, which is a separate decision from authentication below.
 
+If you run the 'Streamable HTTP' transport inside Docker, you have to bind to '0.0.0.0' yourself and set a token, otherwise the published port can't reach the server (the container's '127.0.0.1' is only visible inside the container):
+```bash
+docker run -p 8000:8000 -e SCRAPLING_MCP_AUTH_TOKEN="<your-token>" pyd4vinci/scrapling mcp --http --host '0.0.0.0'
+```
+
 ### Authentication
 
 The 'stdio' transport is only reachable by the program that started it, but the moment you switch to 'Streamable HTTP', anyone who can reach the port can call every tool, and that includes fetching any URL from the machine running the server. That's why 'Streamable HTTP' requires authentication, so `--http` on its own refuses to start and asks you for a token:
```

---

### Incident Patch 9: `029d098c` (2026-08-18)
**Commit Message**: fix: require authentication by default for the HTTP transport (#414)

Co-authored-by: MJ <[REDACTED_EMAIL]>

**File**: `agent-skill/Scrapling-Skill/references/mcp-server.md` (modified, +14/-3)
```diff
@@ -203,9 +203,11 @@ Or with Streamable HTTP transport:
 
 ```bash
 scrapling-mcp --http
-scrapling-mcp --http --host 127.0.0.1 --port 8000
+scrapling-mcp --http --host 0.0.0.0 --port 8000
 ```
 
+The host defaults to `127.0.0.1`, so the server only accepts connections from the same machine. Pass `--host 0.0.0.0` to make it reachable from the network.
+
 Docker alternative:
 
 ```bash
@@ -256,7 +258,7 @@ The URL can be a WebSocket endpoint (`ws://`/`wss://`), which is what managed br
 
 ## Authentication
 
-The stdio transport is only reachable by the program that started it, but with Streamable HTTP anyone who can reach the port can call every tool, including fetching any URL from the machine running the server. If the server listens on anything other than localhost, give it a token:
+The stdio transport is only reachable by the program that started it, but with Streamable HTTP anyone who can reach the port can call every tool, including fetching any URL from the machine running the server. That's why Streamable HTTP requires authentication, so `--http` on its own refuses to start and asks you for a token:
 
 ```bash
 scrapling-mcp --http --auth-token "$(openssl rand -hex 32)"
@@ -284,6 +286,14 @@ export SCRAPLING_MCP_AUTH_TOKEN="<your-token>"
 scrapling-mcp --http
 ```
 
+If you really want an unauthenticated server, for example while testing locally on the default `127.0.0.1`, you have to ask for it with `--no-auth`:
+
+```bash
+scrapling-mcp --http --no-auth
+```
+
+Combining `--no-auth` with `--host 0.0.0.0` leaves every tool open to anyone who can reach the port, so avoid that pair outside a trusted network.
+
 When the server listens on a public address, also tell it which host names to accept, which turns on protection against DNS-rebinding attacks. The option can be repeated:
 
 ```bash
@@ -295,4 +305,5 @@ scrapling-mcp --http --allowed-host 'your-server.example.com:8000'
 - Authentication applies to the Streamable HTTP transport only. It's ignored with stdio, and the server logs a warning to say so.
 - Plain HTTP sends the token in cleartext, so put the server behind a reverse proxy that terminates TLS before exposing it to the internet.
 - This is a single shared key, not per-client credentials, so every client uses the same token and rotating it means restarting the server.
-- Starting with `--http` and no token still works for local use, but logs a warning that it's unauthenticated.
\ No newline at end of file
+- Starting with `--http --no-auth` still logs a warning that it's unauthenticated.
+- Passing both `--auth-token` and `--no-auth` keeps the token, so the server stays authenticated instead of quietly dropping it.
\ No newline at end of file
```

**File**: `docs/ai/mcp-server.md` (modified, +12/-4)
```diff
@@ -206,14 +206,15 @@ Use the following to enable 'Streamable HTTP' transport mode:
 ```bash
 scrapling-mcp --http
 ```
-Hence, the default value for the host the server is listening to is '0.0.0.0' and the port is 8000, which both can be configured as below:
+Hence, the default value for the host the server is listening to is '127.0.0.1' and the port is 8000, which both can be configured as below:
 ```bash
-scrapling-mcp --http --host '127.0.0.1' --port 8000
+scrapling-mcp --http --host '0.0.0.0' --port 8000
 ```
+The default only accepts connections from the same machine. Pass `--host '0.0.0.0'` when you want the server to be reachable from the network, which is a separate decision from authentication below.
 
 ### Authentication
 
-The 'stdio' transport is only reachable by the program that started it, but the moment you switch to 'Streamable HTTP', anyone who can reach the port can call every tool, and that includes fetching any URL from the machine running the server. So if the server is listening on anything other than localhost, give it a token:
+The 'stdio' transport is only reachable by the program that started it, but the moment you switch to 'Streamable HTTP', anyone who can reach the port can call every tool, and that includes fetching any URL from the machine running the server. That's why 'Streamable HTTP' requires authentication, so `--http` on its own refuses to start and asks you for a token:
 ```bash
 scrapling-mcp --http --auth-token "$(openssl rand -hex 32)"
 ```
@@ -235,6 +236,12 @@ Passing the token on the command line leaves it in your shell history and in the
 export SCRAPLING_MCP_AUTH_TOKEN="<your-token>"
 scrapling-mcp --http
 ```
+If you really want an unauthenticated server, for example while testing locally on the default '127.0.0.1', you have to ask for it with `--no-auth`:
+```bash
+scrapling-mcp --http --no-auth
+```
+Combining `--no-auth` with `--host '0.0.0.0'` leaves every tool open to anyone who can reach the port, so avoid that pair outside a trusted network.
+
 When the server listens on a public address, you should also tell it which host names to accept, which turns on protection against DNS-rebinding attacks (a website your browser visits trying to talk to your server). The option can be repeated:
 ```bash
 scrapling-mcp --http --allowed-host 'your-server.example.com:8000'
@@ -245,7 +252,8 @@ scrapling-mcp --http --allowed-host 'your-server.example.com:8000'
     * Authentication applies to the 'Streamable HTTP' transport only. It's ignored with 'stdio', and the server logs a warning to tell you so.<br/>
     * Plain HTTP sends the token in cleartext, so put the server behind a reverse proxy that terminates TLS before exposing it to the internet.<br/>
     * This is a single shared key, not per-client credentials, so every client uses the same token, and rotating it means restarting the server.<br/>
-    * Starting the server with `--http` and no token still works for local use, but it logs a warning telling you that it's unauthenticated.
+    * Starting the server with `--http --no-auth` still logs a warning telling you that it's unauthenticated.<br/>
+    * Passing both `--auth-token` and `--no-auth` keeps the token, so the server stays authenticated instead of quietly dropping it.
 
 ## Examples
 
```

**File**: `docs/api-reference/mcp-server.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ Or import the server class directly:
 from scrapling.core.ai import ScraplingMCPServer
 
 server = ScraplingMCPServer()
-server.serve(http=False, host="0.0.0.0", port=8000)
+server.serve(http=False, host="127.0.0.1", port=8000)
 ```
 
 To set a custom Chromium-compatible browser executable for browser-based MCP tools, pass `executable_path`:
```

**File**: `scrapling/cli.py` (modified, +17/-5)
```diff
@@ -12,7 +12,7 @@
 from orjson import loads as json_loads, JSONDecodeError
 
 try:
-    from click import command, option, Choice, group, argument, version_option
+    from click import command, option, Choice, group, argument, version_option, UsageError
 except (ImportError, ModuleNotFoundError) as e:
     raise ModuleNotFoundError(
         "You need to install scrapling with any of the extras to enable Shell commands. See: https://scrapling.readthedocs.io/en/latest/#installation"
@@ -152,8 +152,9 @@ def install(force):  # pragma: no cover
 @option(
     "--host",
     type=str,
-    default="0.0.0.0",
-    help="The host to use if streamable-http transport is enabled (Default: '0.0.0.0')",
+    default="127.0.0.1",
+    help="The host to use if streamable-http transport is enabled. Pass '0.0.0.0' to accept connections from "
+    "the network (Default: '127.0.0.1')",
 )
 @option(
     "--port", type=int, default=8000, help="The port to use if streamable-http transport is enabled (Default: 8000)"
@@ -178,11 +179,22 @@ def install(force):  # pragma: no cover
     help="Enable DNS-rebinding protection and accept requests for this host only, like 'mcp.example.com:8000' "
     "(repeatable). Recommended whenever the server listens on a public address",
 )
-def mcp(http, host, port, executable_path, auth_token, allowed_host):
+@option(
+    "--no-auth",
+    is_flag=True,
+    default=False,
+    help="Serve the streamable-http transport without authentication (not recommended). Without it, `--http` "
+    "refuses to start unless a token is given",
+)
+def mcp(http, host, port, executable_path, auth_token, allowed_host, no_auth):
     from scrapling.core.ai import ScraplingMCPServer
 
     server = ScraplingMCPServer(executable_path=executable_path, auth_token=auth_token)
-    server.serve(http, host, port, allowed_hosts=allowed_host)
+    try:
+        server.serve(http, host, port, allowed_hosts=allowed_host, allow_unauthenticated=no_auth)
+    except ValueError as e:
+        # Turn the unauthenticated-HTTP refusal into a clean CLI error instead of a traceback
+        raise UsageError(str(e)) from e
 
 
 @command(help="Interactive scraping console")
```

**File**: `scrapling/core/ai.py` (modified, +36/-9)
```diff
@@ -1017,17 +1017,44 @@ def _build_server(self, host: str, port: int) -> MCPServer:
         )
         return server
 
-    def serve(self, http: bool, host: str, port: int, allowed_hosts: Sequence[str] = ()):
-        """Serve the MCP server."""
-        if http and not self._auth_token:
-            log.warning(
-                f"The MCP server is running over HTTP without authentication, so anyone who can reach "
-                f"{host}:{port} can use every tool, including fetching arbitrary URLs from this machine. "
-                f"Pass `--auth-token` (or set the {MCP_AUTH_TOKEN_ENV} environment variable) to require a bearer token."
+    def serve(
+        self,
+        http: bool,
+        host: str,
+        port: int,
+        allowed_hosts: Sequence[str] = (),
+        allow_unauthenticated: bool = False,
+    ):
+        """Serve the MCP server.
+
+        :param http: Serve over the streamable-http transport instead of stdio.
+        :param host: The host to bind to when `http` is enabled.
+        :param port: The port to bind to when `http` is enabled.
+        :param allowed_hosts: Host names to accept, which turns on DNS-rebinding protection.
+        :param allow_unauthenticated: Start the streamable-http transport without a token. The transport
+            requires authentication by default, so this is the explicit opt-out.
+        """
+        if not http:
+            if self._auth_token:
+                log.warning(
+                    "The authentication token only applies to the streamable-http transport, so it's ignored with stdio."
+                )
+        elif self._auth_token:
+            if allow_unauthenticated:
+                log.warning(
+                    "An authentication token was given, so it takes precedence and the server still requires it."
+                )
+        elif not allow_unauthenticated:
+            raise ValueError(
+                f"Refusing to serve the MCP server over HTTP without authentication because anyone who can reach "
+                f"{host}:{port} would be able to use every tool, including fetching arbitrary URLs from this machine. "
+                f"Pass `--auth-token` (or set the {MCP_AUTH_TOKEN_ENV} environment variable) to require a bearer "
+                f"token, or `--no-auth` to serve it unauthenticated anyway."
             )
-        elif self._auth_token and not http:
+        else:
             log.warning(
-                "The authentication token only applies to the streamable-http transport, so it's ignored with stdio."
+                f"The MCP server is running over HTTP without authentication, so anyone who can reach "
+                f"{host}:{port} can use every tool, including fetching arbitrary URLs from this machine."
             )
 
         server = self._build_server(host, port)
```

**File**: `tests/ai/test_ai_mcp.py` (modified, +42/-0)
```diff
@@ -4,10 +4,12 @@
 from contextlib import contextmanager
 from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
 from threading import Thread
+from unittest.mock import patch
 
 import pytest
 import pytest_httpbin
 from mcp.client import Client
+from mcp.server import MCPServer
 from mcp.types import ImageContent, TextContent
 
 from scrapling import __version__ as scrapling_version
@@ -574,6 +576,46 @@ def test_all_tools_are_registered_with_auth_enabled(self, monkeypatch):
 
         assert len(built._tool_manager.list_tools()) == 10
 
+    def test_http_without_a_token_refuses_to_serve(self, monkeypatch):
+        """The streamable-http transport requires authentication unless the caller explicitly opts out"""
+        monkeypatch.delenv(MCP_AUTH_TOKEN_ENV, raising=False)
+        server = ScraplingMCPServer()
+
+        with pytest.raises(ValueError, match="without authentication"):
+            server.serve(True, "0.0.0.0", 8000)
+
+    def test_stdio_without_a_token_still_serves(self, monkeypatch):
+        """stdio is only reachable by the program that started it, so it stays unauthenticated"""
+        monkeypatch.delenv(MCP_AUTH_TOKEN_ENV, raising=False)
+        server = ScraplingMCPServer()
+
+        with patch.object(MCPServer, "run") as mocked_run:
+            server.serve(False, "0.0.0.0", 8000)
+
+        mocked_run.assert_called_once_with()
+
+    def test_http_serves_unauthenticated_when_explicitly_allowed(self, monkeypatch):
+        """`--no-auth` is the opt-out, and the server still warns that it's unprotected"""
+        monkeypatch.delenv(MCP_AUTH_TOKEN_ENV, raising=False)
+        server = ScraplingMCPServer()
+
+        with patch.object(MCPServer, "run") as mocked_run:
+            server.serve(True, "0.0.0.0", 8000, allow_unauthenticated=True)
+
+        assert mocked_run.call_args.kwargs["transport"] == "streamable-http"
+        assert server._build_server("0.0.0.0", 8000).settings.auth is None
+
+    def test_token_wins_over_the_opt_out(self, monkeypatch):
+        """Passing both keeps authentication on instead of silently dropping the token"""
+        monkeypatch.delenv(MCP_AUTH_TOKEN_ENV, raising=False)
+        server = ScraplingMCPServer(auth_token=SHARED_KEY)
+
+        with patch.object(MCPServer, "run") as mocked_run:
+            server.serve(True, "0.0.0.0", 8000, allow_unauthenticated=True)
+
+        assert mocked_run.call_args.kwargs["transport"] == "streamable-http"
+        assert server._build_server("0.0.0.0", 8000).settings.auth is not None
+
     def test_allowed_hosts_enable_dns_rebinding_protection(self):
         assert ScraplingMCPServer._transport_security(()) is None
 
```

**File**: `tests/cli/test_cli.py` (modified, +50/-4)
```diff
@@ -56,7 +56,9 @@ def test_mcp_command(self, runner):
             result = runner.invoke(mcp)
             assert result.exit_code == 0
             mock_server.assert_called_once_with(executable_path=None, auth_token=None)
-            mock_instance.serve.assert_called_once_with(False, "0.0.0.0", 8000, allowed_hosts=())
+            mock_instance.serve.assert_called_once_with(
+                False, "127.0.0.1", 8000, allowed_hosts=(), allow_unauthenticated=False
+            )
 
     def test_mcp_command_with_executable_path(self, runner):
         """Test MCP command with a custom browser executable"""
@@ -67,7 +69,9 @@ def test_mcp_command_with_executable_path(self, runner):
             result = runner.invoke(mcp, ["--executable-path", "/opt/custom-chromium"])
             assert result.exit_code == 0
             mock_server.assert_called_once_with(executable_path="/opt/custom-chromium", auth_token=None)
-            mock_instance.serve.assert_called_once_with(False, "0.0.0.0", 8000, allowed_hosts=())
+            mock_instance.serve.assert_called_once_with(
+                False, "127.0.0.1", 8000, allowed_hosts=(), allow_unauthenticated=False
+            )
 
     def test_mcp_command_with_auth_token(self, runner):
         """Test MCP command with a shared authentication token"""
@@ -79,7 +83,45 @@ def test_mcp_command_with_auth_token(self, runner):
             result = runner.invoke(mcp, ["--http", "--auth-token", shared_key])
             assert result.exit_code == 0
             mock_server.assert_called_once_with(executable_path=None, auth_token=shared_key)
-            mock_instance.serve.assert_called_once_with(True, "0.0.0.0", 8000, allowed_hosts=())
+            mock_instance.serve.assert_called_once_with(
+                True, "127.0.0.1", 8000, allowed_hosts=(), allow_unauthenticated=False
+            )
+
+    def test_mcp_command_with_no_auth(self, runner):
+        """Test MCP command opting out of the streamable-http authentication"""
+        with patch("scrapling.core.ai.ScraplingMCPServer") as mock_server:
+            mock_instance = MagicMock()
+            mock_server.return_value = mock_instance
+
+            result = runner.invoke(mcp, ["--http", "--no-auth"])
+            assert result.exit_code == 0
+            mock_instance.serve.assert_called_once_with(
+                True, "127.0.0.1", 8000, allowed_hosts=(), allow_unauthenticated=True
+            )
+
+    def test_mcp_command_binds_loopback_unless_asked_otherwise(self, runner):
+        """`--http` stays off the network by default, so `--no-auth` can't expose the tools by accident"""
+        with patch("scrapling.core.ai.ScraplingMCPServer") as mock_server:
+            mock_instance = MagicMock()
+            mock_server.return_value = mock_instance
+
+            runner.invoke(mcp, ["--http", "--no-auth"])
+            assert mock_instance.serve.call_args.args[1] == "127.0.0.1"
+
+            mock_instance.serve.reset_mock()
+            runner.invoke(mcp, ["--http", "--no-auth", "--host", "0.0.0.0"])
+            assert mock_instance.serve.call_args.args[1] == "0.0.0.0"
+
+    def test_mcp_command_reports_the_unauthenticated_refusal(self, runner):
+        """The refusal raised by `serve` is shown as a CLI usage error instead of a traceback"""
+        with patch("scrapling.core.ai.ScraplingMCPServer") as mock_server:
+            mock_instance = MagicMock()
+            mock_instance.serve.side_effect = ValueError("Refusing to serve without authentication")
+            mock_server.return_value = mock_instance
+
+            result = runner.invoke(mcp, ["--http"])
+            assert result.exit_code == 2
+            assert "Refusing to serve without authentication" in result.output
 
     def test_mcp_command_with_allowed_hosts(self, runner):
         """Test MCP command with repeated allowed hosts"""
@@ -92,7 +134,11 @@ def test_mcp_command_with_allowed_hosts(self, runner):
             )
             assert result.exit_code == 0
             mock_instance.serve.assert_called_once_with(
-                True, "0.0.0.0", 8000, allowed_hosts=("mcp.example.com:8000", "127.0.0.1:8000")
+                True,
+                "127.0.0.1",
+                8000,
+                allowed_hosts=("mcp.example.com:8000", "127.0.0.1:8000"),
+                allow_unauthenticated=False,
             )
 
     def test_extract_get_command(self, runner, tmp_path, html_url):
```

---

### Incident Patch 10: `0e1e085a` (2026-08-18)
**Commit Message**: build: correcting dep version

**File**: `.github/workflows/tests.yml` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ jobs:
     - name: Install all browsers dependencies
       run: |
         python3 -m pip install --upgrade pip
-        python3 -m pip install playwright==1.62.0 patchright==1.62.2
+        python3 -m pip install playwright==1.62.0 patchright==1.62.1
 
     - name: Get Playwright version
       id: playwright-version
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ fetchers = [
     "click>=8.3.0",
     "curl_cffi>=0.16.0",
     "playwright>=1.62.0",
-    "patchright>=1.62.2",
+    "patchright>=1.62.1",
     "browserforge>=1.2.4",
     "apify-fingerprint-datapoints>=0.15.0",
     "msgspec>=0.21.1",
```

**File**: `tox.ini` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ usedevelop = True
 changedir = tests
 deps =
     playwright==1.62.0
-    patchright==1.62.2
+    patchright==1.62.1
     -r{toxinidir}/tests/requirements.txt
 extras = ai,shell
 commands =
```

---

### Incident Patch 11: `1cd938e0` (2026-08-18)
**Commit Message**: build: pump version and deps

**File**: `.github/workflows/docker-build.yml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ on:
   workflow_dispatch:
     inputs:
       version:
-        description: "Release version to tag the images with, like 'v0.4.14'. Leave it empty to only push 'latest'"
+        description: "Release version to tag the images with, like 'v0.4.15'. Leave it empty to only push 'latest'"
         required: false
         default: ''
 
```

**File**: `.github/workflows/tests.yml` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ jobs:
     - name: Install all browsers dependencies
       run: |
         python3 -m pip install --upgrade pip
-        python3 -m pip install playwright==1.61.0 patchright==1.61.2
+        python3 -m pip install playwright==1.62.0 patchright==1.62.2
 
     - name: Get Playwright version
       id: playwright-version
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ local_tests/*
 # AI related files
 .claude/*
 CLAUDE.md
+tasks/*
 
 # cached files
 __pycache__/
```

**File**: `agent-skill/Scrapling-Skill/SKILL.md` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 ---
 name: scrapling-official
 description: Scrape web pages using Scrapling with anti-bot bypass (like Cloudflare Turnstile), stealth headless browsing, spiders framework, adaptive scraping, and JavaScript rendering. Use when asked to scrape, crawl, or extract data from websites; web_fetch fails; the site has anti-bot protections; write Python code to scrape/crawl; or write spiders.
-version: "0.4.14"
+version: "0.4.15"
 license: Complete terms in LICENSE.txt
 metadata:
   homepage: "https://scrapling.readthedocs.io/en/latest/index.html"
@@ -40,7 +40,7 @@ Blazing fast crawls with real-time stats and streaming. Built by Web Scrapers fo
 
 Create a virtual Python environment through any way available, like `venv`, then inside the environment do:
 
-`pip install "scrapling[all]>=0.4.14"`
+`pip install "scrapling[all]>=0.4.15"`
 
 Then do this to download all the browsers' dependencies:
 
```

**File**: `agent-skill/Scrapling-Skill/examples/README.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ All examples collect **all 100 quotes across 10 pages**.
 Make sure Scrapling is installed:
 
 ```bash
-pip install "scrapling[all]>=0.4.14"
+pip install "scrapling[all]>=0.4.15"
 scrapling install --force
 ```
 
```

**File**: `docs/requirements.txt` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
-zensical>=0.0.46
-mkdocstrings>=1.0.4
+zensical>=0.0.54
+mkdocstrings>=1.0.6
 mkdocstrings-python>=2.0.5
 griffe-inherited-docstrings>=1.1.3
 griffe-runtime-objects>=0.3.1
```

**File**: `pyproject.toml` (modified, +3/-3)
```diff
@@ -5,7 +5,7 @@ build-backend = "setuptools.build_meta"
 [project]
 name = "scrapling"
 # Static version instead of a dynamic version so we can get better layer caching while building docker, check the docker file to understand
-version = "0.4.14"
+version = "0.4.15"
 description = "Scrapling is an undetectable, powerful, flexible, high-performance Python library that makes Web Scraping easy and effortless as it should be!"
 readme = {file = "README.md", content-type = "text/markdown"}
 license = {file = "LICENSE"}
@@ -73,8 +73,8 @@ dependencies = [
 fetchers = [
     "click>=8.3.0",
     "curl_cffi>=0.16.0",
-    "playwright>=1.61.0",
-    "patchright>=1.61.2",
+    "playwright>=1.62.0",
+    "patchright>=1.62.2",
     "browserforge>=1.2.4",
     "apify-fingerprint-datapoints>=0.15.0",
     "msgspec>=0.21.1",
```

**File**: `scrapling/__init__.py` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 __author__ = "Karim Shoair (karim.shoair@pm.me)"
-__version__ = "0.4.14"
+__version__ = "0.4.15"
 __copyright__ = "Copyright (c) 2024 Karim Shoair"
 
 from typing import Any, TYPE_CHECKING
```

---

### Incident Patch 12: `316b6d23` (2026-08-18)
**Commit Message**: fix(parser): find/find_all with class_ silently miss multi-class elements (#410)

**File**: `scrapling/parser.py` (modified, +5/-1)
```diff
@@ -762,7 +762,11 @@ def find_all(
             for key, value in attributes.items():
                 value = value.replace('"', r"\"")  # Escape double quotes in user input
                 # Not escaping anything with the key so the user can pass patterns like {'href*': '/p/'} or get errors :)
-                selector += '[{}="{}"]'.format(key, value)
+                if key == "class":
+                    # `class` is a space-separated list, so exact-match [class="x"] misses class="x y"; match each name with ~=
+                    selector += "".join('[class~="{}"]'.format(t) for t in value.split())
+                else:
+                    selector += '[{}="{}"]'.format(key, value)
             if selector != "*":
                 selectors.append(selector)
 
```

**File**: `tests/parser/test_general.py` (modified, +14/-0)
```diff
@@ -162,6 +162,20 @@ def test_finding_similar_reviews(self, page):
         assert len(similar_high_rated_reviews) == 1
 
 
+class TestFindByClass:
+    def test_find_all_matches_multi_class_element(self, page):
+        """A single class token should match elements that carry other classes too"""
+        assert len(page.find_all("div", class_="stock")) == 3
+        assert len(page.find_all("div", class_="hidden")) == 3
+        assert page.find("div", class_="stock") is not None
+
+    def test_find_all_matches_all_of_multiple_tokens(self, page):
+        """Multiple class tokens all have to be present, regardless of order"""
+        assert len(page.find_all("div", class_="hidden stock")) == 3
+        assert len(page.find_all("div", class_="stock hidden")) == 3
+        assert page.find_all("div", class_="hidden nonexistent") == []
+
+
 # Error Handling Tests
 class TestErrorHandling:
     def test_invalid_selector_initialization(self):
```

---

### Incident Patch 13: `69a2985a` (2026-08-12)
**Commit Message**: fix(parser): match multi-class elements in find/find_all class_ filter

**File**: `scrapling/parser.py` (modified, +5/-1)
```diff
@@ -762,7 +762,11 @@ def find_all(
             for key, value in attributes.items():
                 value = value.replace('"', r"\"")  # Escape double quotes in user input
                 # Not escaping anything with the key so the user can pass patterns like {'href*': '/p/'} or get errors :)
-                selector += '[{}="{}"]'.format(key, value)
+                if key == "class":
+                    # `class` is a space-separated list, so exact-match [class="x"] misses class="x y"; match each name with ~=
+                    selector += "".join('[class~="{}"]'.format(t) for t in value.split())
+                else:
+                    selector += '[{}="{}"]'.format(key, value)
             if selector != "*":
                 selectors.append(selector)
 
```

**File**: `tests/parser/test_general.py` (modified, +14/-0)
```diff
@@ -162,6 +162,20 @@ def test_finding_similar_reviews(self, page):
         assert len(similar_high_rated_reviews) == 1
 
 
+class TestFindByClass:
+    def test_find_all_matches_multi_class_element(self, page):
+        """A single class token should match elements that carry other classes too"""
+        assert len(page.find_all("div", class_="stock")) == 3
+        assert len(page.find_all("div", class_="hidden")) == 3
+        assert page.find("div", class_="stock") is not None
+
+    def test_find_all_matches_all_of_multiple_tokens(self, page):
+        """Multiple class tokens all have to be present, regardless of order"""
+        assert len(page.find_all("div", class_="hidden stock")) == 3
+        assert len(page.find_all("div", class_="stock hidden")) == 3
+        assert page.find_all("div", class_="hidden nonexistent") == []
+
+
 # Error Handling Tests
 class TestErrorHandling:
     def test_invalid_selector_initialization(self):
```

---

### Incident Patch 14: `4e0ac98d` (2026-08-10)
**Commit Message**: build: pump version and deps

**File**: `.github/workflows/docker-build.yml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ on:
   workflow_dispatch:
     inputs:
       version:
-        description: "Release version to tag the images with, like 'v0.4.13'. Leave it empty to only push 'latest'"
+        description: "Release version to tag the images with, like 'v0.4.14'. Leave it empty to only push 'latest'"
         required: false
         default: ''
 
```

**File**: `agent-skill/Scrapling-Skill/SKILL.md` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 ---
 name: scrapling-official
 description: Scrape web pages using Scrapling with anti-bot bypass (like Cloudflare Turnstile), stealth headless browsing, spiders framework, adaptive scraping, and JavaScript rendering. Use when asked to scrape, crawl, or extract data from websites; web_fetch fails; the site has anti-bot protections; write Python code to scrape/crawl; or write spiders.
-version: "0.4.13"
+version: "0.4.14"
 license: Complete terms in LICENSE.txt
 metadata:
   homepage: "https://scrapling.readthedocs.io/en/latest/index.html"
@@ -40,7 +40,7 @@ Blazing fast crawls with real-time stats and streaming. Built by Web Scrapers fo
 
 Create a virtual Python environment through any way available, like `venv`, then inside the environment do:
 
-`pip install "scrapling[all]>=0.4.13"`
+`pip install "scrapling[all]>=0.4.14"`
 
 Then do this to download all the browsers' dependencies:
 
```

**File**: `agent-skill/Scrapling-Skill/examples/README.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ All examples collect **all 100 quotes across 10 pages**.
 Make sure Scrapling is installed:
 
 ```bash
-pip install "scrapling[all]>=0.4.13"
+pip install "scrapling[all]>=0.4.14"
 scrapling install --force
 ```
 
```

**File**: `pyproject.toml` (modified, +3/-3)
```diff
@@ -5,7 +5,7 @@ build-backend = "setuptools.build_meta"
 [project]
 name = "scrapling"
 # Static version instead of a dynamic version so we can get better layer caching while building docker, check the docker file to understand
-version = "0.4.13"
+version = "0.4.14"
 description = "Scrapling is an undetectable, powerful, flexible, high-performance Python library that makes Web Scraping easy and effortless as it should be!"
 readme = {file = "README.md", content-type = "text/markdown"}
 license = {file = "LICENSE"}
@@ -72,13 +72,13 @@ dependencies = [
 [project.optional-dependencies]
 fetchers = [
     "click>=8.3.0",
-    "curl_cffi>=0.16.1b1",
+    "curl_cffi>=0.16.0",
     "playwright>=1.61.0",
     "patchright>=1.61.2",
     "browserforge>=1.2.4",
     "apify-fingerprint-datapoints>=0.15.0",
     "msgspec>=0.21.1",
-    "anyio>=4.13.0",
+    "anyio>=4.14.0",
     "protego>=0.6.2",
 ]
 ai = [
```

**File**: `scrapling/__init__.py` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 __author__ = "Karim Shoair (karim.shoair@pm.me)"
-__version__ = "0.4.13"
+__version__ = "0.4.14"
 __copyright__ = "Copyright (c) 2024 Karim Shoair"
 
 from typing import Any, TYPE_CHECKING
```

**File**: `server.json` (modified, +2/-2)
```diff
@@ -14,12 +14,12 @@
       "mimeType": "image/png"
     }
   ],
-  "version": "0.4.13",
+  "version": "0.4.14",
   "packages": [
     {
       "registryType": "pypi",
       "identifier": "scrapling",
-      "version": "0.4.13",
+      "version": "0.4.14",
       "runtimeHint": "uvx",
       "packageArguments": [
         {
```

**File**: `setup.cfg` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [metadata]
 name = scrapling
-version = 0.4.13
+version = 0.4.14
 author = Karim Shoair
 author_email = karim.shoair@pm.me
 description = Scrapling is an undetectable, powerful, flexible, high-performance Python library that makes Web Scraping easy and effortless as it should be!
```

---

### Incident Patch 15: `6e41f335` (2026-08-09)
**Commit Message**: fix(xml template): Be specific about the node type hint

**File**: `scrapling/spiders/templates/feed.py` (modified, +5/-4)
```diff
@@ -5,6 +5,7 @@
 from io import StringIO
 
 from lxml import etree
+from lxml.etree import _Element
 
 from scrapling.core._types import (
     TYPE_CHECKING,
@@ -64,7 +65,7 @@ async def parse(self, response: "Response") -> AsyncGenerator[Union[Dict[str, An
                 yield result
 
     async def parse_node(
-        self, response: "Response", node: Any
+        self, response: "Response", node: _Element
     ) -> AsyncGenerator[Union[Dict[str, Any], Request, None], None]:
         """Override to process one feed node; `node` is a namespace-stripped `lxml` element."""
         raise NotImplementedError(f"{self.__class__.__name__} must implement parse_node() method")
@@ -80,7 +81,7 @@ def _wanted_tag(self) -> Tuple[Optional[str], str]:
             raise ValueError(f"`itertag` prefix {prefix!r} is not defined in `namespaces`")
         return uri, name
 
-    def _iter_nodes(self, root: Any) -> Iterator[Any]:
+    def _iter_nodes(self, root: _Element) -> Iterator[_Element]:
         uri, name = self._wanted_tag()
         for el in root.iter():
             if isinstance(el.tag, str):
@@ -89,14 +90,14 @@ def _iter_nodes(self, root: Any) -> Iterator[Any]:
                     yield self._strip_namespaces(el)
 
     @staticmethod
-    def _strip_namespaces(node: Any) -> Any:
+    def _strip_namespaces(node: _Element) -> _Element:
         """Return a copy of `node` with namespaces removed from every tag and attribute."""
         node = deepcopy(node)
         for el in node.iter():
             if isinstance(el.tag, str):
                 el.tag = etree.QName(el.tag).localname
             for key in list(el.attrib):
-                if key.startswith("{"):
+                if isinstance(key, str) and key.startswith("{"):
                     el.attrib[etree.QName(key).localname] = el.attrib.pop(key)
         etree.cleanup_namespaces(node)
         return node
```

#### Recent Merged Pull Requests:
- **PR #477** (2026-10-04): V5 dev (@D4Vinci)
- **PR #471** (closed): docs: update ProxyLane sponsor description (@SwiftAdviser)
- **PR #461** (closed): docs(examples): add Adam Network integration — publish scraped insights to an agent stream (@snow884)
- **PR #460** (2026-09-26): fix(ai): match inline style values instead of substrings when sanitizing (@Yigtwxx)
- **PR #458** (2026-09-24): fix(spiders): route sitemap URLs to parse() instead of the sitemap parser (@SulimanAbdulrazzaq)
- **PR #457** (2026-09-24): test: make checkpoint and CSV tests portable to Windows (@diegobravtraps-oss)
- **PR #456** (closed): Add Docker deployment for the web UI, targeting Raspberry Pi (@dwb-io)
- **PR #455** (closed): UI fixes v1 (@dwb-io)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
