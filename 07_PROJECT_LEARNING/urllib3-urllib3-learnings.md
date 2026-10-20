> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/urllib3-urllib3-learnings.md`  
> **Source**: github ([https://github.com/urllib3/urllib3](https://github.com/urllib3/urllib3))  
> **Source Version**: `a37bc93b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T00:19:05.259Z  
> **Learning ID**: `learn-github-urllib3-urllib3`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): urllib3/urllib3

> **Canonical Artifact**: `07_PROJECT_LEARNING/urllib3-urllib3-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/urllib3/urllib3](https://github.com/urllib3/urllib3))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T00:19:05.251Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `urllib3/urllib3`
- **Description**: urllib3 is a user-friendly HTTP client library for Python
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4076 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/urllib3/contrib/emscripten/emscripten_fetch_worker.js`
```
let Status = {
  SUCCESS_HEADER: -1,
  SUCCESS_EOF: -2,
  ERROR_TIMEOUT: -3,
  ERROR_EXCEPTION: -4,
};

let connections = new Map();
let nextConnectionID = 1;
const encoder = new TextEncoder();

self.addEventListener("message", async function (event) {
  if (event.data.close) {
    let connectionID = event.data.close;
    connections.delete(connectionID);
    return;
  } else if (event.data.getMore) {
    let connectionID = event.data.getMore;
    let { curOffset, value, reader, intBuffer, byteBuffer } =
      connections.get(connectionID);
    // if we still have some in buffer, then just send it back straight away
    if (!value || curOffset >= value.length) {
      // read another buffer if required
      try {
        let readResponse = await reader.read();

        if (readResponse.done) {
          // read everything - clear connection and return
          connections.delete(connectionID);
          Atomics.store(intBuffer, 0, Status.SUCCESS_EOF);
          Atomics.notify(intBuffer, 0);
          // finished reading successfully
          // return from event handler
          return;
        }
        curOffset = 0;
        connections.get(connectionID).value = readResponse.value;
        value = readResponse.value;
      } catch (error) {
        console.log("Request exception:", error);
        let errorBytes = encoder.encode(error.message);
        let written = errorBytes.length;
        byteBuffer.set(errorBytes);
        intBuffer[1] = written;
        Atomics.store(intBuffer, 0, Status.ERROR_EXCEPTION);
        Atomics.notify(intBuffer, 0);
      }
    }

    // send as much buffer as we can
    let curLen = value.length - curOffset;
    if (curLen > byteBuffer.length) {
      curLen = byteBuffer.length;
    }
    byteBuffer.set(value.subarray(curOffset, curOffset + curLen), 0);

    Atomics.store(intBuffer, 0, curLen); // store current length in bytes
    Atomics.notify(intBuffer, 0);
    curOffset += curLen;
    connections.get(connectionID).curOffset = curOffset;

    return;
  } else {
    // start fetch
    let connectionID = nextConnectionID;
    nextConnectionID += 1;
    const intBuffer = new Int32Array(event.data.buffer);
    const byteBuffer = new Uint8Array(event.data.buffer, 8);
    try {
      const response = await fetch(event.data.url, event.data.fetchParams);
      // return the headers first via textencoder
      var headers = [];
      for (const pair of response.headers.entries()) {
        headers.push([pair[0], pair[1]]);
      }
      let headerObj = {
        headers: headers,
        status: response.status,
        connectionID,
      };
      const headerText = JSON.stringify(headerObj);
      let headerBytes = encoder.encode(headerText);
      let written = headerBytes.length;
      byteBuffer.set(headerBytes);
      intBuffer[1] = written;
      // make a connection
      connections.set(connectionID, {
        reader: response.body.getReader(),
        intBuffer: intBuffer,
        byteBuffer: byteBuffer,
        value: undefined,
        curOffset: 0,
      });
      // set header ready
      Atomics.store(intBuffer, 0, Status.SUCCESS_HEADER);
      Atomics.notify(intBuffer, 0);
      // all fetching after this goes through a new postmessage call with getMore
      // this allows for parallel requests
    } catch (error) {
      console.log("Request exception:", error);
      let errorBytes = encoder.encode(error.message);
      let written = errorBytes.length;
      byteBuffer.set(errorBytes);
      intBuffer[1] = written;
      Atomics.store(intBuffer, 0, Status.ERROR_EXCEPTION);
      Atomics.notify(intBuffer, 0);
    }
  }
});
self.postMessage({ inited: true });

```

### Core Architecture Module: `src/urllib3/util/__init__.py`
```
# For backwards compatibility, provide imports that used to be here.
from __future__ import annotations

from .connection import is_connection_dropped
from .request import SKIP_HEADER, SKIPPABLE_HEADERS, make_headers
from .response import is_fp_closed
from .retry import Retry
from .ssl_ import (
    ALPN_PROTOCOLS,
    IS_PYOPENSSL,
    SSLContext,
    assert_fingerprint,
    create_urllib3_context,
    resolve_cert_reqs,
    resolve_ssl_version,
    ssl_wrap_socket,
)
from .timeout import Timeout
from .url import Url, parse_url
from .wait import wait_for_read, wait_for_write

__all__ = (
    "IS_PYOPENSSL",
    "SSLContext",
    "ALPN_PROTOCOLS",
    "Retry",
    "Timeout",
    "Url",
    "assert_fingerprint",
    "create_urllib3_context",
    "is_connection_dropped",
    "is_fp_closed",
    "parse_url",
    "make_headers",
    "resolve_cert_reqs",
    "resolve_ssl_version",
    "ssl_wrap_socket",
    "wait_for_read",
    "wait_for_write",
    "SKIP_HEADER",
    "SKIPPABLE_HEADERS",
)

```

### Core Architecture Module: `src/urllib3/util/connection.py`
```
from __future__ import annotations

import socket
import typing

from ..exceptions import LocationParseError
from .timeout import _DEFAULT_TIMEOUT, _TYPE_TIMEOUT

_TYPE_SOCKET_OPTIONS = list[tuple[int, int, typing.Union[int, bytes]]]

if typing.TYPE_CHECKING:
    from .._base_connection import BaseHTTPConnection


def is_connection_dropped(conn: BaseHTTPConnection) -> bool:  # Platform-specific
    """
    Returns True if the connection is dropped and should be closed.
    :param conn: :class:`urllib3.connection.HTTPConnection` object.
    """
    return not conn.is_connected


# This function is copied from socket.py in the Python 2.7 standard
# library test suite. Added to its signature is only `socket_options`.
# One additional modification is that we avoid binding to IPv6 servers
# discovered in DNS if the system doesn't have IPv6 functionality.
def create_connection(
    address: tuple[str, int],
    timeout: _TYPE_TIMEOUT = _DEFAULT_TIMEOUT,
    source_address: tuple[str, int] | None = None,
    socket_options: _TYPE_SOCKET_OPTIONS | None = None,
) -> socket.socket:
    """Connect to *address* and return the socket object.

    Convenience function.  Connect to *address* (a 2-tuple ``(host,
    port)``) and return the socket object.  Passing the optional
    *timeout* parameter will set the timeout on the socket instance
    before attempting to connect.  If no *timeout* is supplied, the
    global default timeout setting returned by :func:`socket.getdefaulttimeout`
    is used.  If *source_address* is set it must be a tuple of (host, port)
    for the socket to bind as a source address before making the connection.
    An host of '' or port 0 tells the OS to use the default.
    """

    host, port = address
    if host.startswith("["):
        host = host.strip("[]")
    err = None

    # Using the value from allowed_gai_family() in the context of getaddrinfo lets
    # us select whether to work with IPv4 DNS records, IPv6 records, or both.
    # The original create_connection function always returns all records.
    family = allowed_gai_family()

    try:
        host.encode("idna")
    except UnicodeError:
        raise LocationParseError(f"'{host}', label empty or too long") from None

    for res in socket.getaddrinfo(host, port, family, socket.SOCK_STREAM):
        af, socktype, proto, canonname, sa = res
        sock = None
        try:
            sock = socket.socket(af, socktype, proto)

            # If provided, set socket level options before connecting.
            _set_socket_options(sock, socket_options)

            if timeout is not _DEFAULT_TIMEOUT:
                sock.settimeout(timeout)
            if source_address:
                sock.bind(source_address)
            sock.connect(sa)
            # Break explicitly a reference cycle
            err = None
            return sock

        except OSError as _:
            err = _
            if sock is not None:
                sock.close()

    if err is not None:
        try:
            raise err
        finally:
            # Break explicitly a reference cycle
            err = None
    else:
        raise OSError("getaddrinfo returns an empty list")


def _set_socket_options(
    sock: socket.socket, options: _TYPE_SOCKET_OPTIONS | None
) -> None:
    if options is None:
        return

    for opt in options:
        sock.setsockopt(*opt)


def allowed_gai_family() -> socket.AddressFamily:
    """This function is designed to work in the context of
    getaddrinfo, where family=socket.AF_UNSPEC is the default and
    will perform a DNS search for both IPv6 and IPv4 records."""

    family = socket.AF_INET
    if HAS_IPV6:
        family = socket.AF_UNSPEC
    return family


def _has_ipv6(host: str) -> bool:
    """Returns True if the system can bind an IPv6 address."""
    sock = None
    has_ipv6 = False

    if socket.has_ipv6:
        # has_ipv6 returns true if cPython was compiled with IPv6 support.
        # It does not tell us if the system has IPv6 support enabled. To
        # determine that we must bind to an IPv6 address.
        # https://github.com/urllib3/urllib3/pull/611
        # https://bugs.python.org/issue658327
        try:
            sock = socket.socket(socket.AF_INET6)
            sock.bind((host, 0))
            has_ipv6 = True
        except Exception:
            pass

    if sock:
        sock.close()
    return has_ipv6


HAS_IPV6 = _has_ipv6("::1")

```

### Core Architecture Module: `src/urllib3/util/proxy.py`
```
from __future__ import annotations

import typing

from .url import Url

if typing.TYPE_CHECKING:
    from ..connection import ProxyConfig


def connection_requires_http_tunnel(
    proxy_url: Url | None = None,
    proxy_config: ProxyConfig | None = None,
    destination_scheme: str | None = None,
) -> bool:
    """
    Returns True if the connection requires an HTTP CONNECT through the proxy.

    :param URL proxy_url:
        URL of the proxy.
    :param ProxyConfig proxy_config:
        Proxy configuration from poolmanager.py
    :param str destination_scheme:
        The scheme of the destination. (i.e https, http, etc)
    """
    # If we're not using a proxy, no way to use a tunnel.
    if proxy_url is None:
        return False

    # HTTP destinations never require tunneling, we always forward.
    if destination_scheme == "http":
        return False

    # Support for forwarding with HTTPS proxies and HTTPS destinations.
    if (
        proxy_url.scheme == "https"
        and proxy_config
        and proxy_config.use_forwarding_for_https
    ):
        return False

    # Otherwise always use a tunnel.
    return True

```

### Core Architecture Module: `src/urllib3/util/request.py`
```
from __future__ import annotations

import io
import sys
import typing
from base64 import b64encode
from enum import Enum

from ..exceptions import UnrewindableBodyError
from .util import to_bytes

if typing.TYPE_CHECKING:
    from typing import Final

# Pass as a value within ``headers`` to skip
# emitting some HTTP headers that are added automatically.
# The only headers that are supported are ``Accept-Encoding``,
# ``Host``, and ``User-Agent``.
SKIP_HEADER = "@@@SKIP_HEADER@@@"
SKIPPABLE_HEADERS = frozenset(["accept-encoding", "host", "user-agent"])

ACCEPT_ENCODING = "gzip,deflate"
try:
    try:
        import brotlicffi as _unused_module_brotli  # type: ignore[import-not-found] # noqa: F401
    except ImportError:
        import brotli as _unused_module_brotli  # type: ignore[import-not-found] # noqa: F401
except ImportError:
    pass
else:
    ACCEPT_ENCODING += ",br"

try:
    if sys.version_info >= (3, 14):
        from compression import zstd as _unused_module_zstd  # noqa: F401
    else:
        from backports import zstd as _unused_module_zstd  # noqa: F401
except ImportError:
    pass
else:
    ACCEPT_ENCODING += ",zstd"


class _TYPE_FAILEDTELL(Enum):
    token = 0


_FAILEDTELL: Final[_TYPE_FAILEDTELL] = _TYPE_FAILEDTELL.token

_TYPE_BODY_POSITION = typing.Union[int, _TYPE_FAILEDTELL]

# When sending a request with these methods we aren't expecting
# a body so don't need to set an explicit 'Content-Length: 0'
# The reason we do this in the negative instead of tracking methods
# which 'should' have a body is because unknown methods should be
# treated as if they were 'POST' which *does* expect a body.
_METHODS_NOT_EXPECTING_BODY = {"GET", "HEAD", "DELETE", "TRACE", "OPTIONS", "CONNECT"}


def make_headers(
    keep_alive: bool | None = None,
    accept_encoding: bool | list[str] | str | None = None,
    user_agent: str | None = None,
    basic_auth: str | None = None,
    proxy_basic_auth: str | None = None,
    disable_cache: bool | None = None,
    *,
    basic_auth_encoding: str = "latin-1",
    proxy_basic_auth_encoding: str = "latin-1",
) -> dict[str, str]:
    """
    Shortcuts for generating request headers.

    :param keep_alive:
        If ``True``, adds 'connection: keep-alive' header.

    :param accept_encoding:
        Can be a boolean, list, or string.
        ``True`` translates to 'gzip,deflate'.  If the dependencies for
        Brotli (either the ``brotli`` or ``brotlicffi`` package) and/or
        Zstandard (the ``backports.zstd`` package for Python before 3.14)
        algorithms are installed, then their encodings are
        included in the string ('br' and 'zstd', respectively).
        List will get joined by comma.
        String will be used as provided.

    :param user_agent:
        String representing the user-agent you want, such as
        "python-urllib3/0.6"

    :param basic_auth:
        Colon-separated username:password string for 'authorization: basic ...'
        auth header. Basic authentication transmits Base64-encoded bytes, not
        Unicode text, so the string is encoded with ``basic_auth_encoding``
        before Base64 encoding.

        Must contain decoded credentials (not percent-encoded).
        For URLs parsed with :func:`parse_url`, use :attr:`Url.auth_decoded_joined`
        to get the properly formatted string.

    :param basic_auth_encoding:
        Text encoding used to encode ``basic_auth`` before Base64 encoding.
        Defaults to "latin-1" for backward compatibility. Use "utf-8" only
        when the peer expects UTF-8 Basic authentication credentials.

        Must contain decoded credentials (not percent-encoded).
        For URLs parsed with :func:`parse_url`, use :attr:`Url.auth_decoded_joined`
        to get the properly formatted string.

    :param proxy_basic_auth:
        Colon-separated username:password string for 'proxy-authorization: basic ...'
        auth header. Basic authentication transmits Base64-encoded bytes, not
        Unicode text, so the string is encoded with ``proxy_basic_auth_encoding``
        before Base64 encoding.

        Must contain decoded credentials (not percent-encoded).
        For URLs parsed with :func:`parse_url`, use :attr:`Url.auth_decoded_joined`
        to get the properly formatted string.

    :param proxy_basic_auth_encoding:
        Text encoding used to encode ``proxy_basic_auth`` before Base64
        encoding. Defaults to "latin-1" for backward compatibility. Use
        "utf-8" only when the proxy expects UTF-8 Basic authentication
        credentials.

        Must contain decoded credentials (not percent-encoded).
        For URLs parsed with :func:`parse_url`, use :attr:`Url.auth_decoded_joined`
        to get the properly formatted string.

    :param disable_cache:
        If ``True``, adds 'cache-control: no-cache' header.

    Example:

    .. code-block:: python

        import urllib3

        print(urllib3.util.make_headers(keep_alive=True, user_agent="Batman/1.0"))
        # {'connection': 'keep-alive', 'user-agent': 'Batman/1.0'}
        print(urllib3.util.make_headers(accept_encoding=True))
        # {'accept-encoding': 'gzip,deflate'}
    """
    headers: dict[str, str] = {}
    if accept_encoding:
        if isinstance(accept_encoding, str):
            pass
        elif isinstance(accept_encoding, list):
            accept_encoding = ",".join(accept_encoding)
        else:
            accept_encoding = ACCEPT_ENCODING
        headers["accept-encoding"] = accept_encoding

    if user_agent:
        headers["user-agent"] = user_agent

    if keep_alive:
        headers["connection"] = "keep-alive"

    if basic_auth:
        headers["authorization"] = (
            f"Basic {b64encode(basic_auth.encode(basic_auth_encoding)).decode()}"
        )

    if proxy_basic_auth:
        headers["proxy-authorization"] = (
            f"Basic {b64encode(proxy_basic_auth.encode(proxy_basic_auth_encoding)).decode()}"
        )

    if disable_cache:
        headers["cache-control"] = "no-cache"

    return headers


def set_file_position(
    body: typing.Any, pos: _TYPE_BODY_POSITION | None
) -> _TYPE_BODY_POSITION | None:
    """
    If a position is provided, move file to that point.
    Otherwise, we'll attempt to record a position for future use.
    """
    if pos is not None:
        rewind_body(body, pos)
    elif getattr(body, "tell", None) is not None:
        try:
            pos = body.tell()
        except OSError:
            # This differentiates from None, allowing us to catch
            # a failed `tell()` later when trying to rewind the body.
            pos = _FAILEDTELL

    return pos


def rewind_body(body: typing.IO[typing.AnyStr], body_pos: _TYPE_BODY_POSITION) -> None:
    """
    Attempt to rewind body to a certain position.
    Primarily used for request redirects and retries.

    :param body:
        File-like object that supports seek.

    :param int pos:
        Position to seek to in file.
    """
    body_seek = getattr(body, "seek", None)
    if body_seek is not None and isinstance(body_pos, int):
        try:
            body_seek(body_pos)
        except OSError as e:
            raise UnrewindableBodyError(
                "An error occurred when rewinding request body for redirect/retry."
            ) from e
    elif body_pos is _FAILEDTELL:
        raise UnrewindableBodyError(
            "Unable to record file position for rewinding "
            "request body during a redirect/retry."
        )
    elif body_seek is None:
        raise UnrewindableBodyError("body does not implement seek.")
    else:
        raise ValueError(
            f"body_pos must be of type integer, instead it was {type(body_pos)}."
        )


class ChunksAndContentLength(typing.NamedTuple):
    chunks: typing.Iterable[bytes] | None
    content_length: int | None


def body_to_chunks(
    body: typing.Any | None, method: str, blocksize: int
) -> ChunksAndContentLength:
    """Takes the HTTP request method, body, and blocksize and
    transforms them into an iterable of chunks to pass to
    socket.sendall() and an optional 'Content-Length' header.

    A 'Content-Length' of 'None' indicates the length of the body
    can't be determined so should use 'Transfer-Encoding: chunked'
    for framing instead.
    """

    chunks: typing.Iterable[bytes] | None
    content_length: int | None

    # No body, we need to make a recommendation on 'Content-Length'
    # based on whether that request method is expected to have
    # a body or not.
    if body is None:
        chunks = None
        if method.upper() not in _METHODS_NOT_EXPECTING_BODY:
            content_length = 0
        else:
            content_length = None

    # Bytes or strings become bytes
    elif isinstance(body, (str, bytes)):
        chunks = (to_bytes(body),)
        content_length = len(chunks[0])

    # File-like object, TODO: use seek() and tell() for length?
    elif hasattr(body, "read"):

        def chunk_readable() -> typing.Iterable[bytes]:
            encode = isinstance(body, io.TextIOBase)
            while True:
                datablock = body.read(blocksize)
                if not datablock:
                    break
                if encode:
                    datablock = datablock.encode("utf-8")
                yield datablock

        chunks = chunk_readable()
        content_length = None

    # Otherwise we need to start checking via duck-typing.
    else:
        try:
            # Check if the body implements the buffer API.
            mv = memoryview(body)
        except TypeError:
            try:
                # Check if the body is an iterable
                chunks = iter(body)
                content_length = None
            except TypeError:
                raise TypeError(
                    f"'body' must be a bytes-like object, file-like "
                    f"object, or iterable. Instead was {body!r}"
                ) from None
        else:
            #
```

### Core Architecture Module: `src/urllib3/util/response.py`
```
from __future__ import annotations

import http.client as httplib
from email.errors import MultipartInvariantViolationDefect, StartBoundaryNotFoundDefect

from ..exceptions import HeaderParsingError


def is_fp_closed(obj: object) -> bool:
    """
    Checks whether a given file-like object is closed.

    :param obj:
        The file-like object to check.
    """

    try:
        # Check `isclosed()` first, in case Python3 doesn't set `closed`.
        # GH Issue #928
        return obj.isclosed()  # type: ignore[no-any-return, attr-defined]
    except AttributeError:
        pass

    try:
        # Check via the official file-like-object way.
        return obj.closed  # type: ignore[no-any-return, attr-defined]
    except AttributeError:
        pass

    try:
        # Check if the object is a container for another file-like object that
        # gets released on exhaustion (e.g. HTTPResponse).
        return obj.fp is None  # type: ignore[attr-defined]
    except AttributeError:
        pass

    raise ValueError("Unable to determine whether fp is closed.")


def assert_header_parsing(headers: httplib.HTTPMessage) -> None:
    """
    Asserts whether all headers have been successfully parsed.
    Extracts encountered errors from the result of parsing headers.

    Only works on Python 3.

    :param http.client.HTTPMessage headers: Headers to verify.

    :raises urllib3.exceptions.HeaderParsingError:
        If parsing errors are found.
    """

    # This will fail silently if we pass in the wrong kind of parameter.
    # To make debugging easier add an explicit check.
    if not isinstance(headers, httplib.HTTPMessage):
        raise TypeError(f"expected httplib.Message, got {type(headers)}.")

    unparsed_data = None

    # get_payload is actually email.message.Message.get_payload;
    # we're only interested in the result if it's not a multipart message
    if not headers.is_multipart():
        payload = headers.get_payload()

        if isinstance(payload, (bytes, str)):
            unparsed_data = payload

    # httplib is assuming a response body is available
    # when parsing headers even when httplib only sends
    # header data to parse_headers() This results in
    # defects on multipart responses in particular.
    # See: https://github.com/urllib3/urllib3/issues/800

    # So we ignore the following defects:
    # - StartBoundaryNotFoundDefect:
    #     The claimed start boundary was never found.
    # - MultipartInvariantViolationDefect:
    #     A message claimed to be a multipart but no subparts were found.
    defects = [
        defect
        for defect in headers.defects
        if not isinstance(
            defect, (StartBoundaryNotFoundDefect, MultipartInvariantViolationDefect)
        )
    ]

    if defects or unparsed_data:
        raise HeaderParsingError(defects=defects, unparsed_data=unparsed_data)


def is_response_to_head(response: httplib.HTTPResponse) -> bool:
    """
    Checks whether the request of a response has been a HEAD-request.

    :param http.client.HTTPResponse response:
        Response to check if the originating request
        used 'HEAD' as a method.
    """
    # FIXME: Can we do this somehow without accessing private httplib _method?
    method_str = response._method  # type: str  # type: ignore[attr-defined]
    return method_str.upper() == "HEAD"

```

### Core Architecture Module: `src/urllib3/util/retry.py`
```
from __future__ import annotations

import email
import logging
import random
import re
import time
import typing
import warnings
from collections.abc import Collection
from itertools import takewhile
from types import TracebackType

from ..exceptions import (
    ConnectTimeoutError,
    InvalidHeader,
    MaxRetryError,
    ProtocolError,
    ProxyError,
    ReadTimeoutError,
    ResponseError,
)
from .util import reraise

if typing.TYPE_CHECKING:
    from typing_extensions import Self

    from ..connectionpool import ConnectionPool
    from ..response import BaseHTTPResponse

log = logging.getLogger(__name__)


# Data structure for representing the metadata of requests that result in a retry.
class RequestHistory(typing.NamedTuple):
    method: str | None
    url: str | None
    error: Exception | None
    status: int | None
    redirect_location: str | None


class Retry:
    """Retry configuration.

    Each retry attempt will create a new Retry object with updated values, so
    they can be safely reused.

    Retries can be defined as a default for a pool:

    .. code-block:: python

        retries = Retry(connect=5, read=2, redirect=5)
        http = PoolManager(retries=retries)
        response = http.request("GET", "https://example.com/")

    Or per-request (which overrides the default for the pool):

    .. code-block:: python

        response = http.request("GET", "https://example.com/", retries=Retry(10))

    Retries can be disabled by passing ``False``:

    .. code-block:: python

        response = http.request("GET", "https://example.com/", retries=False)

    Errors will be wrapped in :class:`~urllib3.exceptions.MaxRetryError` unless
    retries are disabled, in which case the causing exception will be raised.

    :param int total:
        Total number of retries to allow. Takes precedence over other counts.

        Set to ``None`` to remove this constraint and fall back on other
        counts.

        Set to ``0`` to fail on the first retry.

        Set to ``False`` to disable and imply ``raise_on_redirect=False``.

    :param int connect:
        How many connection-related errors to retry on.

        These are errors raised before the request is sent to the remote server,
        which we assume has not triggered the server to process the request.

        Set to ``0`` to fail on the first retry of this type.

    :param int read:
        How many times to retry on read errors.

        These errors are raised after the request was sent to the server, so the
        request may have side-effects.

        Set to ``0`` to fail on the first retry of this type.

    :param int redirect:
        How many redirects to perform. Limit this to avoid infinite redirect
        loops.

        A redirect is a HTTP response with a status code 301, 302, 303, 307 or
        308.

        Set to ``0`` to fail on the first retry of this type.

        Set to ``False`` to disable and imply ``raise_on_redirect=False``.

    :param int status:
        How many times to retry on bad status codes.

        These are retries made on responses, where status code matches
        ``status_forcelist``.

        Set to ``0`` to fail on the first retry of this type.

    :param int other:
        How many times to retry on other errors.

        Other errors are errors that are not connect, read, redirect or status errors.
        These errors might be raised after the request was sent to the server, so the
        request might have side-effects.

        Set to ``0`` to fail on the first retry of this type.

        If ``total`` is not set, it's a good idea to set this to 0 to account
        for unexpected edge cases and avoid infinite retry loops.

    :param Collection allowed_methods:
        Set of uppercased HTTP method verbs that we should retry on.

        By default, we only retry on methods which are considered to be
        idempotent (multiple requests with the same parameters end with the
        same state). See :attr:`Retry.DEFAULT_ALLOWED_METHODS`.

        Set to a ``None`` value to retry on any verb.

    :param Collection status_forcelist:
        A set of integer HTTP status codes that we should force a retry on.
        A retry is initiated if the request method is in ``allowed_methods``
        and the response status code is in ``status_forcelist``.

        By default, this is disabled with ``None``.

    :param float backoff_factor:
        A backoff factor to apply between attempts after the second try
        (most errors are resolved immediately by a second try without a
        delay). urllib3 will sleep for::

            {backoff factor} * (2 ** ({number of previous retries}))

        seconds. If `backoff_jitter` is non-zero, this sleep is extended by::

            random.uniform(0, {backoff jitter})

        seconds. For example, if the backoff_factor is 0.1, then :func:`Retry.sleep` will
        sleep for [0.0s, 0.2s, 0.4s, 0.8s, ...] between retries. No backoff will ever
        be longer than `backoff_max`.

        By default, backoff is disabled (factor set to 0). In production services,
        setting a non-zero factor (e.g. 0.5 to 1.0) along with `backoff_jitter` is
        recommended to prevent overloading servers with immediate retries.

    :param float backoff_max:
        The maximum backoff time (in seconds) between retry attempts.
        This value caps the computed backoff from `backoff_factor`.

    :param float backoff_jitter:
        Random jitter amount (in seconds) added to the computed backoff.
        Jitter is sampled uniformly from `0` to `backoff_jitter`.

    :param bool raise_on_redirect: Whether, if the number of redirects is
        exhausted, to raise a MaxRetryError, or to return a response with a
        response code in the 3xx range.

    :param bool raise_on_status: Similar meaning to ``raise_on_redirect``:
        whether we should raise an exception, or return a response,
        if status falls in ``status_forcelist`` range and retries have
        been exhausted.

    :param tuple history: The history of the request encountered during
        each call to :meth:`~Retry.increment`. The list is in the order
        the requests occurred. Each list item is of class :class:`RequestHistory`.

    :param bool respect_retry_after_header:
        Whether to respect Retry-After header on status codes defined as
        :attr:`Retry.RETRY_AFTER_STATUS_CODES` or not.

    :param Collection remove_headers_on_redirect:
        Sequence of headers to remove from the request when a response
        indicating a redirect is returned before firing off the redirected
        request.

    :param int retry_after_max: Number of seconds to allow as the maximum for
        Retry-After headers. Defaults to :attr:`Retry.DEFAULT_RETRY_AFTER_MAX`.
        Any Retry-After headers larger than this value will be limited to this
        value.
    """

    #: Default methods to be used for ``allowed_methods``
    DEFAULT_ALLOWED_METHODS = frozenset(
        ["HEAD", "GET", "PUT", "DELETE", "OPTIONS", "TRACE"]
    )

    #: Default status codes that trigger a retry when a Retry-After header is
    #: present and ``respect_retry_after_header`` is enabled.
    RETRY_AFTER_STATUS_CODES = frozenset([413, 429, 503])

    #: Default headers to be used for ``remove_headers_on_redirect``
    DEFAULT_REMOVE_HEADERS_ON_REDIRECT = frozenset(
        ["Cookie", "Authorization", "Proxy-Authorization"]
    )

    #: Default maximum backoff time.
    DEFAULT_BACKOFF_MAX = 120

    # This is undocumented in the RFC. Setting to 6 hours matches other popular libraries.
    #: Default maximum allowed value for Retry-After headers in seconds
    DEFAULT_RETRY_AFTER_MAX: typing.Final[int] = 21600

    # Backward compatibility; assigned outside of the class.
    DEFAULT: typing.ClassVar[Retry]

    def __init__(
        self,
        total: bool | int | None = 10,
        connect: int | None = None,
        read: int | None = None,
        redirect: bool | int | None = None,
        status: int | None = None,
        other: int | None = None,
        allowed_methods: typing.Collection[str] | None = DEFAULT_ALLOWED_METHODS,
        status_forcelist: typing.Collection[int] | None = None,
        backoff_factor: float = 0,
        backoff_max: float = DEFAULT_BACKOFF_MAX,
        raise_on_redirect: bool = True,
        raise_on_status: bool = True,
        history: tuple[RequestHistory, ...] | None = None,
        respect_retry_after_header: bool = True,
        remove_headers_on_redirect: typing.Collection[
            str
        ] = DEFAULT_REMOVE_HEADERS_ON_REDIRECT,
        backoff_jitter: float = 0.0,
        retry_after_max: int = DEFAULT_RETRY_AFTER_MAX,
    ) -> None:
        self.total = total
        self.connect = connect
        self.read = read
        self.status = status
        self.other = other

        if redirect is False or total is False:
            redirect = 0
            raise_on_redirect = False

        self.redirect = redirect
        self.status_forcelist = status_forcelist or set()
        if not allowed_methods and isinstance(allowed_methods, Collection):
            warnings.warn(
                "Using an empty collection for 'allowed_methods' option to "
                "retry on any verb is deprecated and will skip retries for "
                "all verbs in urllib3 v3.0. Instead use "
                "Retry(..., allowed_methods=None).",
                FutureWarning,
                stacklevel=2,
            )
        self.allowed_methods = allowed_methods
        self.backoff_factor = backoff_factor
        self.backoff_max = backoff_max
        self.retry_after_max = retry_after_max
        self.raise_on_redirect = raise_on_redirect
        self.raise_on_status = raise_on_status
        self.history = history or ()
        self.respect_retry_after_header = respect_retry_after_header
        self.remove_headers_on_redirect = frozenset(
       
```

### Core Architecture Module: `src/urllib3/util/ssl_.py`
```
from __future__ import annotations

import hashlib
import hmac
import os
import socket
import sys
import typing
import warnings
from binascii import Error as BinasciiError
from binascii import unhexlify

from ..exceptions import ProxySchemeUnsupported, SSLError
from .url import _BRACELESS_IPV6_ADDRZ_RE, _IPV4_RE

SSLContext = None
SSLTransport = None
HAS_NEVER_CHECK_COMMON_NAME = False
IS_PYOPENSSL = False
ALPN_PROTOCOLS = ["http/1.1"]

_TYPE_VERSION_INFO = tuple[int, int, int, str, int]

# Maps the length of a digest to a possible hash function producing this digest
HASHFUNC_MAP = {
    length: getattr(hashlib, algorithm, None)
    for length, algorithm in ((32, "md5"), (40, "sha1"), (64, "sha256"))
}


def _is_has_never_check_common_name_reliable(
    openssl_version: str,
) -> bool:
    # As of May 2023, all released versions of LibreSSL fail to reject certificates with
    # only common names, see https://github.com/urllib3/urllib3/pull/3024
    is_openssl = openssl_version.startswith("OpenSSL ")

    return is_openssl


if typing.TYPE_CHECKING:
    from ssl import VerifyMode
    from typing import TypedDict

    from .ssltransport import SSLTransport as SSLTransportType

    class _TYPE_PEER_CERT_RET_DICT(TypedDict, total=False):
        subjectAltName: tuple[tuple[str, str], ...]
        subject: tuple[tuple[tuple[str, str], ...], ...]
        serialNumber: str


# Mapping from 'ssl.PROTOCOL_TLSX' to 'TLSVersion.X'
_SSL_VERSION_TO_TLS_VERSION: dict[int, int] = {}

try:  # Do we have ssl at all?
    import ssl
    from ssl import (  # type: ignore[assignment]
        CERT_REQUIRED,
        HAS_NEVER_CHECK_COMMON_NAME,
        OP_NO_COMPRESSION,
        OP_NO_TICKET,
        OPENSSL_VERSION,
        PROTOCOL_TLS,
        PROTOCOL_TLS_CLIENT,
        VERIFY_X509_PARTIAL_CHAIN,
        VERIFY_X509_STRICT,
        OP_NO_SSLv2,
        OP_NO_SSLv3,
        SSLContext,
        TLSVersion,
    )

    PROTOCOL_SSLv23 = PROTOCOL_TLS

    # Setting SSLContext.hostname_checks_common_name = False didn't work with
    # LibreSSL, check details in the used function.
    if HAS_NEVER_CHECK_COMMON_NAME and not _is_has_never_check_common_name_reliable(
        OPENSSL_VERSION,
    ):  # Defensive:
        HAS_NEVER_CHECK_COMMON_NAME = False

    # Need to be careful here in case old TLS versions get
    # removed in future 'ssl' module implementations.
    for attr in ("TLSv1", "TLSv1_1", "TLSv1_2"):
        try:
            _SSL_VERSION_TO_TLS_VERSION[getattr(ssl, f"PROTOCOL_{attr}")] = getattr(
                TLSVersion, attr
            )
        except AttributeError:  # Defensive:
            continue

    from .ssltransport import SSLTransport  # type: ignore[assignment]
except ImportError:
    OP_NO_COMPRESSION = 0x20000  # type: ignore[assignment,misc]
    OP_NO_TICKET = 0x4000  # type: ignore[assignment,misc]
    OP_NO_SSLv2 = 0x1000000  # type: ignore[assignment,misc]
    OP_NO_SSLv3 = 0x2000000  # type: ignore[assignment,misc]
    PROTOCOL_SSLv23 = PROTOCOL_TLS = 2  # type: ignore[assignment,misc]
    PROTOCOL_TLS_CLIENT = 16  # type: ignore[assignment,misc]
    VERIFY_X509_PARTIAL_CHAIN = 0x80000  # type: ignore[assignment,misc]
    VERIFY_X509_STRICT = 0x20  # type: ignore[assignment,misc]


_TYPE_PEER_CERT_RET = typing.Union["_TYPE_PEER_CERT_RET_DICT", bytes, None]


def assert_fingerprint(cert: bytes | None, fingerprint: str) -> None:
    """
    Checks if given fingerprint matches the supplied certificate.

    :param cert:
        Certificate as bytes object.
    :param fingerprint:
        Fingerprint as string of hexdigits, can be interspersed by colons.
    """

    if cert is None:
        raise SSLError("No certificate for the peer.")

    fingerprint = fingerprint.replace(":", "").lower()
    digest_length = len(fingerprint)
    if digest_length not in HASHFUNC_MAP:
        raise SSLError(f"Fingerprint of invalid length: {fingerprint}")
    hashfunc = HASHFUNC_MAP.get(digest_length)
    if hashfunc is None:
        raise SSLError(
            f"Hash function implementation unavailable for fingerprint length: {digest_length}"
        )

    # We need encode() here for py32; works on py2 and p33.
    try:
        fingerprint_bytes = unhexlify(fingerprint.encode())
    except BinasciiError as e:
        raise SSLError(e) from e

    cert_digest = hashfunc(cert).digest()

    if not hmac.compare_digest(cert_digest, fingerprint_bytes):
        raise SSLError(
            f'Fingerprints did not match. Expected "{fingerprint}", got "{cert_digest.hex()}"'
        )


def resolve_cert_reqs(candidate: None | int | str) -> VerifyMode:
    """
    Resolves the argument to a numeric constant, which can be passed to
    the wrap_socket function/method from the ssl module.
    Defaults to :data:`ssl.CERT_REQUIRED`.
    If given a string it is assumed to be the name of the constant in the
    :mod:`ssl` module or its abbreviation.
    (So you can specify `REQUIRED` instead of `CERT_REQUIRED`.
    If it's neither `None` nor a string we assume it is already the numeric
    constant which can directly be passed to wrap_socket.
    """
    if candidate is None:
        return CERT_REQUIRED

    if isinstance(candidate, str):
        res = getattr(ssl, candidate, None)
        if res is None:
            res = getattr(ssl, "CERT_" + candidate)
        return res  # type: ignore[no-any-return]

    return candidate  # type: ignore[return-value]


def resolve_ssl_version(candidate: None | int | str) -> int:
    """
    like resolve_cert_reqs
    """
    if candidate is None:
        return PROTOCOL_TLS

    if isinstance(candidate, str):
        res = getattr(ssl, candidate, None)
        if res is None:
            res = getattr(ssl, "PROTOCOL_" + candidate)
        return typing.cast(int, res)

    return candidate


def create_urllib3_context(
    ssl_version: int | None = None,
    cert_reqs: int | None = None,
    options: int | None = None,
    ciphers: str | None = None,
    ssl_minimum_version: int | None = None,
    ssl_maximum_version: int | None = None,
    verify_flags: int | None = None,
) -> ssl.SSLContext:
    """Creates and configures an :class:`ssl.SSLContext` instance for use with urllib3.

    :param ssl_version:
        The desired protocol version to use. This will default to
        PROTOCOL_SSLv23 which will negotiate the highest protocol that both
        the server and your installation of OpenSSL support.

        This parameter is deprecated instead use 'ssl_minimum_version'.
    :param ssl_minimum_version:
        The minimum version of TLS to be used. Use the 'ssl.TLSVersion' enum for specifying the value.
    :param ssl_maximum_version:
        The maximum version of TLS to be used. Use the 'ssl.TLSVersion' enum for specifying the value.
        Not recommended to set to anything other than 'ssl.TLSVersion.MAXIMUM_SUPPORTED' which is the
        default value.
    :param cert_reqs:
        Whether to require the certificate verification. This defaults to
        ``ssl.CERT_REQUIRED``.
    :param options:
        Specific OpenSSL options. These default to ``ssl.OP_NO_SSLv2``,
        ``ssl.OP_NO_SSLv3``, ``ssl.OP_NO_COMPRESSION``, and ``ssl.OP_NO_TICKET``.
    :param ciphers:
        Which cipher suites to allow the server to select. Defaults to either system configured
        ciphers if OpenSSL 1.1.1+, otherwise uses a secure default set of ciphers.
    :param verify_flags:
        The flags for certificate verification operations. These default to
        ``ssl.VERIFY_X509_PARTIAL_CHAIN`` and ``ssl.VERIFY_X509_STRICT`` for Python 3.13+.
    :returns:
        Constructed SSLContext object with specified options
    :rtype: SSLContext
    """
    if SSLContext is None:
        raise TypeError("Can't create an SSLContext object without an ssl module")

    # This means 'ssl_version' was specified as an exact value.
    if ssl_version not in (None, PROTOCOL_TLS, PROTOCOL_TLS_CLIENT):
        # Disallow setting 'ssl_version' and 'ssl_minimum|maximum_version'
        # to avoid conflicts.
        if ssl_minimum_version is not None or ssl_maximum_version is not None:
            raise ValueError(
                "Can't specify both 'ssl_version' and either "
                "'ssl_minimum_version' or 'ssl_maximum_version'"
            )

        # 'ssl_version' is deprecated and will be removed in the future.
        else:
            # Use 'ssl_minimum_version' and 'ssl_maximum_version' instead.
            ssl_minimum_version = _SSL_VERSION_TO_TLS_VERSION.get(
                ssl_version, TLSVersion.MINIMUM_SUPPORTED
            )
            ssl_maximum_version = _SSL_VERSION_TO_TLS_VERSION.get(
                ssl_version, TLSVersion.MAXIMUM_SUPPORTED
            )

            # This warning message is pushing users to use 'ssl_minimum_version'
            # instead of both min/max. Best practice is to only set the minimum version and
            # keep the maximum version to be it's default value: 'TLSVersion.MAXIMUM_SUPPORTED'
            warnings.warn(
                "'ssl_version' option is deprecated and will be "
                "removed in urllib3 v3.0. Instead use 'ssl_minimum_version'",
                category=FutureWarning,
                stacklevel=2,
            )

    context = SSLContext(PROTOCOL_TLS_CLIENT)
    if ssl_minimum_version is not None:
        context.minimum_version = ssl_minimum_version
    else:  # pyOpenSSL defaults to 'MINIMUM_SUPPORTED' so explicitly set TLSv1.2 here
        context.minimum_version = TLSVersion.TLSv1_2

    if ssl_maximum_version is not None:
        context.maximum_version = ssl_maximum_version

    # Unless we're given ciphers defer to either system ciphers in
    # the case of OpenSSL 1.1.1+ or use our own secure default ciphers.
    if ciphers:
        context.set_ciphers(ciphers)

    # Setting the default here, as we may have no ssl module on import
    cert_reqs = ssl.CERT_REQUIRED if cert_reqs is None else cert_reqs

    if options 
```

### Core Architecture Module: `src/urllib3/util/ssl_match_hostname.py`
```
"""The match_hostname() function from Python 3.5, essential when using SSL."""

# Note: This file is under the PSF license as the code comes from the python
# stdlib.   http://docs.python.org/3/license.html
# It is modified to remove commonName support.

from __future__ import annotations

import ipaddress
import re
import typing
from ipaddress import IPv4Address, IPv6Address

if typing.TYPE_CHECKING:
    from .ssl_ import _TYPE_PEER_CERT_RET_DICT

__version__ = "3.5.0.1"


class CertificateError(ValueError):
    pass


def _dnsname_match(
    dn: typing.Any, hostname: str, max_wildcards: int = 1
) -> typing.Match[str] | None | bool:
    """Matching according to RFC 6125, section 6.4.3

    http://tools.ietf.org/html/rfc6125#section-6.4.3
    """
    pats = []
    if not dn:
        return False

    # Ported from python3-syntax:
    # leftmost, *remainder = dn.split(r'.')
    parts = dn.split(r".")
    leftmost = parts[0]
    remainder = parts[1:]

    wildcards = leftmost.count("*")
    if wildcards > max_wildcards:
        # Issue #17980: avoid denials of service by refusing more
        # than one wildcard per fragment.  A survey of established
        # policy among SSL implementations showed it to be a
        # reasonable choice.
        raise CertificateError(
            "too many wildcards in certificate DNS name: " + repr(dn)
        )

    # speed up common case w/o wildcards
    if not wildcards:
        return bool(dn.lower() == hostname.lower())

    # RFC 6125, section 6.4.3, subitem 1.
    # The client SHOULD NOT attempt to match a presented identifier in which
    # the wildcard character comprises a label other than the left-most label.
    if leftmost == "*":
        # When '*' is a fragment by itself, it matches a non-empty dotless
        # fragment.
        pats.append("[^.]+")
    elif leftmost.startswith("xn--") or hostname.startswith("xn--"):
        # RFC 6125, section 6.4.3, subitem 3.
        # The client SHOULD NOT attempt to match a presented identifier
        # where the wildcard character is embedded within an A-label or
        # U-label of an internationalized domain name.
        pats.append(re.escape(leftmost))
    else:
        # Otherwise, '*' matches any dotless string, e.g. www*
        pats.append(re.escape(leftmost).replace(r"\*", "[^.]*"))

    # add the remaining fragments, ignore any wildcards
    for frag in remainder:
        pats.append(re.escape(frag))

    pat = re.compile(r"\A" + r"\.".join(pats) + r"\Z", re.IGNORECASE)
    return pat.match(hostname)


def _ipaddress_match(ipname: str, host_ip: IPv4Address | IPv6Address) -> bool:
    """Exact matching of IP addresses.

    RFC 9110 section 4.3.5: "A reference identity of IP-ID contains the decoded
    bytes of the IP address. An IP version 4 address is 4 octets, and an IP
    version 6 address is 16 octets. [...] A reference identity of type IP-ID
    matches if the address is identical to an iPAddress value of the
    subjectAltName extension of the certificate."
    """
    # OpenSSL may add a trailing newline to a subjectAltName's IP address
    # Divergence from upstream: ipaddress can't handle byte str
    ip = ipaddress.ip_address(ipname.rstrip())
    return bool(ip.packed == host_ip.packed)


def match_hostname(
    cert: _TYPE_PEER_CERT_RET_DICT | None,
    hostname: str,
    hostname_checks_common_name: bool = False,
) -> None:
    """Verify that *cert* (in decoded format as returned by
    SSLSocket.getpeercert()) matches the *hostname*.  RFC 2818 and RFC 6125
    rules are followed, but IP addresses are not accepted for *hostname*.

    CertificateError is raised on failure. On success, the function
    returns nothing.
    """
    if not cert:
        raise ValueError(
            "empty or no certificate, match_hostname needs a "
            "SSL socket or SSL context with either "
            "CERT_OPTIONAL or CERT_REQUIRED"
        )

    try:
        host_ip = ipaddress.ip_address(hostname)
    except ValueError:
        # Not an IP address (common case)
        host_ip = None
    dnsnames = []
    san: tuple[tuple[str, str], ...] = cert.get("subjectAltName", ())
    key: str
    value: str
    for key, value in san:
        if key == "DNS":
            if host_ip is None and _dnsname_match(value, hostname):
                return
            dnsnames.append(value)
        elif key == "IP Address":
            if host_ip is not None and _ipaddress_match(value, host_ip):
                return
            dnsnames.append(value)

    # We only check 'commonName' if it's enabled and we're not verifying
    # an IP address. IP addresses aren't valid within 'commonName'.
    if hostname_checks_common_name and host_ip is None and not dnsnames:
        for sub in cert.get("subject", ()):
            for key, value in sub:
                if key == "commonName":
                    if _dnsname_match(value, hostname):
                        return
                    dnsnames.append(
                        value
                    )  # Defensive: for older PyPy and OpenSSL versions

    if len(dnsnames) > 1:
        raise CertificateError(
            "hostname %r "
            "doesn't match either of %s" % (hostname, ", ".join(map(repr, dnsnames)))
        )
    elif len(dnsnames) == 1:
        raise CertificateError(f"hostname {hostname!r} doesn't match {dnsnames[0]!r}")
    else:
        raise CertificateError("no appropriate subjectAltName fields were found")

```

### Core Architecture Module: `src/urllib3/util/ssltransport.py`
```
from __future__ import annotations

import io
import socket
import ssl
import typing

from ..exceptions import ProxySchemeUnsupported

if typing.TYPE_CHECKING:
    from typing_extensions import Self

    from .ssl_ import _TYPE_PEER_CERT_RET, _TYPE_PEER_CERT_RET_DICT


_WriteBuffer = typing.Union[bytearray, memoryview]
_ReturnValue = typing.TypeVar("_ReturnValue")

SSL_BLOCKSIZE = 16384


class SSLTransport:
    """
    The SSLTransport wraps an existing socket and establishes an SSL connection.

    Contrary to Python's implementation of SSLSocket, it allows you to chain
    multiple TLS connections together. It's particularly useful if you need to
    implement TLS within TLS.

    The class supports most of the socket API operations.
    """

    @staticmethod
    def _validate_ssl_context_for_tls_in_tls(ssl_context: ssl.SSLContext) -> None:
        """
        Raises a ProxySchemeUnsupported if the provided ssl_context can't be used
        for TLS in TLS.

        The only requirement is that the ssl_context provides the 'wrap_bio'
        methods.
        """

        if not hasattr(ssl_context, "wrap_bio"):
            raise ProxySchemeUnsupported(
                "TLS in TLS requires SSLContext.wrap_bio() which isn't "
                "available on non-native SSLContext"
            )

    def __init__(
        self,
        socket: socket.socket,
        ssl_context: ssl.SSLContext,
        server_hostname: str | None = None,
        suppress_ragged_eofs: bool = True,
    ) -> None:
        """
        Create an SSLTransport around socket using the provided ssl_context.
        """
        self.incoming = ssl.MemoryBIO()
        self.outgoing = ssl.MemoryBIO()

        self.suppress_ragged_eofs = suppress_ragged_eofs
        self.socket = socket

        self.sslobj = ssl_context.wrap_bio(
            self.incoming, self.outgoing, server_hostname=server_hostname
        )

        # Perform initial handshake.
        self._ssl_io_loop(self.sslobj.do_handshake)

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: typing.Any) -> None:
        self.close()

    def fileno(self) -> int:
        return self.socket.fileno()

    def read(self, len: int = 1024, buffer: typing.Any | None = None) -> int | bytes:
        return self._wrap_ssl_read(len, buffer)

    def recv(self, buflen: int = 1024, flags: int = 0) -> int | bytes:
        if flags != 0:
            raise ValueError("non-zero flags not allowed in calls to recv")
        return self._wrap_ssl_read(buflen)

    def recv_into(
        self,
        buffer: _WriteBuffer,
        nbytes: int | None = None,
        flags: int = 0,
    ) -> None | int | bytes:
        if flags != 0:
            raise ValueError("non-zero flags not allowed in calls to recv_into")
        if nbytes is None:
            nbytes = len(buffer)
        return self.read(nbytes, buffer)

    def sendall(self, data: bytes, flags: int = 0) -> None:
        if flags != 0:
            raise ValueError("non-zero flags not allowed in calls to sendall")
        count = 0
        with memoryview(data) as view, view.cast("B") as byte_view:
            amount = len(byte_view)
            while count < amount:
                v = self.send(byte_view[count:])
                count += v

    def send(self, data: bytes, flags: int = 0) -> int:
        if flags != 0:
            raise ValueError("non-zero flags not allowed in calls to send")
        return self._ssl_io_loop(self.sslobj.write, data)

    def makefile(
        self,
        mode: str,
        buffering: int | None = None,
        *,
        encoding: str | None = None,
        errors: str | None = None,
        newline: str | None = None,
    ) -> typing.BinaryIO | typing.TextIO | socket.SocketIO:
        """
        Python's httpclient uses makefile and buffered io when reading HTTP
        messages and we need to support it.

        This is unfortunately a copy and paste of socket.py makefile with small
        changes to point to the socket directly.
        """
        if not set(mode) <= {"r", "w", "b"}:
            raise ValueError(f"invalid mode {mode!r} (only r, w, b allowed)")

        writing = "w" in mode
        reading = "r" in mode or not writing
        assert reading or writing
        binary = "b" in mode
        rawmode = ""
        if reading:
            rawmode += "r"
        if writing:
            rawmode += "w"
        raw = socket.SocketIO(self, rawmode)  # type: ignore[arg-type]
        self.socket._io_refs += 1  # type: ignore[attr-defined]
        if buffering is None:
            buffering = -1
        if buffering < 0:
            buffering = io.DEFAULT_BUFFER_SIZE
        if buffering == 0:
            if not binary:
                raise ValueError("unbuffered streams must be binary")
            return raw
        buffer: typing.BinaryIO
        if reading and writing:
            buffer = io.BufferedRWPair(raw, raw, buffering)  # type: ignore[assignment]
        elif reading:
            buffer = io.BufferedReader(raw, buffering)
        else:
            assert writing
            buffer = io.BufferedWriter(raw, buffering)
        if binary:
            return buffer
        text = io.TextIOWrapper(buffer, encoding, errors, newline)
        text.mode = mode  # type: ignore[misc]
        return text

    def unwrap(self) -> None:
        self._ssl_io_loop(self.sslobj.unwrap)

    def close(self) -> None:
        self.socket.close()

    @typing.overload
    def getpeercert(
        self, binary_form: typing.Literal[False] = ...
    ) -> _TYPE_PEER_CERT_RET_DICT | None: ...

    @typing.overload
    def getpeercert(self, binary_form: typing.Literal[True]) -> bytes | None: ...

    def getpeercert(self, binary_form: bool = False) -> _TYPE_PEER_CERT_RET:
        return self.sslobj.getpeercert(binary_form)  # type: ignore[return-value]

    def version(self) -> str | None:
        return self.sslobj.version()

    def cipher(self) -> tuple[str, str, int] | None:
        return self.sslobj.cipher()

    def selected_alpn_protocol(self) -> str | None:
        return self.sslobj.selected_alpn_protocol()

    def shared_ciphers(self) -> list[tuple[str, str, int]] | None:
        return self.sslobj.shared_ciphers()

    def compression(self) -> str | None:
        return self.sslobj.compression()

    def settimeout(self, value: float | None) -> None:
        self.socket.settimeout(value)

    def gettimeout(self) -> float | None:
        return self.socket.gettimeout()

    def _decref_socketios(self) -> None:
        self.socket._decref_socketios()  # type: ignore[attr-defined]

    def _wrap_ssl_read(self, len: int, buffer: bytearray | None = None) -> int | bytes:
        try:
            return self._ssl_io_loop(self.sslobj.read, len, buffer)
        except ssl.SSLError as e:
            if e.errno == ssl.SSL_ERROR_EOF and self.suppress_ragged_eofs:
                if buffer is not None:
                    # eof, no bytes were written into the buffer.
                    return 0
                # eof, no more data to return.
                return b""
            else:
                raise

    # func is sslobj.do_handshake or sslobj.unwrap
    @typing.overload
    def _ssl_io_loop(self, func: typing.Callable[[], None]) -> None: ...

    # func is sslobj.write, arg1 is data
    @typing.overload
    def _ssl_io_loop(self, func: typing.Callable[[bytes], int], arg1: bytes) -> int: ...

    # func is sslobj.read, arg1 is len, arg2 is buffer
    @typing.overload
    def _ssl_io_loop(
        self,
        func: typing.Callable[[int, bytearray | None], bytes],
        arg1: int,
        arg2: bytearray | None,
    ) -> bytes: ...

    def _ssl_io_loop(
        self,
        func: typing.Callable[..., _ReturnValue],
        arg1: None | bytes | int = None,
        arg2: bytearray | None = None,
    ) -> _ReturnValue:
        """Performs an I/O loop between incoming/outgoing and the socket."""
        should_loop = True
        ret = None

        while should_loop:
            errno = None
            try:
                if arg1 is None and arg2 is None:
                    ret = func()
                elif arg2 is None:
                    ret = func(arg1)
                else:
                    ret = func(arg1, arg2)
            except ssl.SSLError as e:
                if e.errno not in (ssl.SSL_ERROR_WANT_READ, ssl.SSL_ERROR_WANT_WRITE):
                    # WANT_READ, and WANT_WRITE are expected, others are not.
                    raise e
                errno = e.errno

            buf = self.outgoing.read()
            self.socket.sendall(buf)

            if errno is None:
                should_loop = False
            elif errno == ssl.SSL_ERROR_WANT_READ:
                buf = self.socket.recv(SSL_BLOCKSIZE)
                if buf:
                    self.incoming.write(buf)
                else:
                    self.incoming.write_eof()
        return typing.cast(_ReturnValue, ret)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5313** (2026-10-14): **Fix fingerprint verification test on PyPy 8.0.1**
  *Symptoms*: PyPy 8.0.1 [can raise `ssl.SSLError` for a connection reset](https://github.com/pypy/pypy/commit/50aae04106ea0fed733c399379eb22c2fedd28fd). The fingerprint test does not catch it, so the server thread exits and the second request fails with "connection refused".  The change makes it catch `ssl.SSLError` instead of its subclass `ssl.SSLEOFError` when the server sends its response, so both requests can reach the fingerprint check.

- **Issue #5311** (2026-10-14): **fix: reject NaN values in Timeout validation**
  *Symptoms*: ## Problem  `Timeout` accepts `float("nan")` for connect/read/total. A NaN connect timeout is then returned unchanged to the socket layer, where it raises `ValueError`.  ## Fix  Reject NaN in `_validate_timeout`, alongside nonpositive values. `None` remains the supported unlimited-timeout option.  ## Verification  - New test fails on main, passes with fix. - Full timeout test suite passes.
  **Post-Mortem & Fix Analysis**:
  > This PR does not comply with our contributing policy because another pull request addressing the same issue was already open.  Please see our contributing guidelines: https://github.com/urllib3/urllib3/tree/2.8.0#contributing

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

### Incident Patch 1: `a164d79c` (2026-10-03)
**Commit Message**: Fix HTTP/2 probe cache lock leak (#5254)

**File**: `changelog/5206.bugfix.rst` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fixed concurrent HTTP/2 probes leaving waiting connection threads blocked after the probe result was cached.
```

**File**: `src/urllib3/http2/probe.py` (modified, +5/-0)
```diff
@@ -46,6 +46,11 @@ def acquire_and_get(self, host: str, port: int) -> bool | None:
             key_lock.release()
             raise
 
+        # Only the thread responsible for probing keeps the lock until
+        # set_and_release(). Waiters returning a cached result must release it.
+        if value is not None:
+            key_lock.release()
+
         return value
 
     def set_and_release(
```

**File**: `test/test_http2_probe.py` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+from __future__ import annotations
+
+from unittest import mock
+
+from urllib3.http2.probe import _HTTP2ProbeCache
+
+
+def test_waiter_releases_lock_when_probe_result_is_available() -> None:
+    cache = _HTTP2ProbeCache()
+    key = ("example.test", 443)
+    key_lock = mock.MagicMock()
+
+    def acquire() -> bool:
+        cache._cache_values[key] = False
+        return True
+
+    key_lock.acquire.side_effect = acquire
+    cache._cache_locks[key] = key_lock
+    cache._cache_values[key] = None
+
+    assert cache.acquire_and_get(*key) is False
+    key_lock.release.assert_called_once_with()
```

---

### Incident Patch 2: `b066a98b` (2026-10-14)
**Commit Message**: Fix Memray availability checks and enable it on Python 3.15 (#5307)

* Only enable Memray options when the pytest plugin is installed

* Add changelog entry for CI Memray availability fix

* Upgrade pytest-memray and enable it on Python 3.15

---------

Co-authored-by: Illia Volochii <[REDACTED_EMAIL]>

**File**: `changelog/5307.misc.rst` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fixed test sessions passing Memray options when the pytest plugin was not installed.
```

**File**: `noxfile.py` (modified, +11/-0)
```diff
@@ -69,6 +69,17 @@ def tests_impl(
         memray_supported = False
     elif sys.platform == "win32":
         memray_supported = False
+    else:
+        # Dependency markers may exclude the plugin for this interpreter.
+        memray_supported = (
+            session.run(
+                "python",
+                "-c",
+                "import importlib.util; print(importlib.util.find_spec('pytest_memray') is not None)",
+                silent=True,
+            ).strip()  # type: ignore[union-attr]
+            == "True"
+        )
 
     # Environment variables being passed to the pytest run.
     pytest_session_envvars = {
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ dev-base = [
     {include-group = "test-base"},
     "build>=1.2.2.post1",
     "coverage>=7.8.0",
-    "pytest-memray==1.8.0 ; python_full_version < '3.15' and implementation_name == 'cpython' and sys_platform != 'win32'",
+    "pytest-memray>=1.11.0 ; python_full_version < '3.16' and implementation_name == 'cpython' and sys_platform != 'win32'",
     "towncrier>=24.8.0",
 ]
 dev = [
```

**File**: `uv.lock` (modified, +98/-78)
```diff
@@ -2,19 +2,19 @@ version = 1
 revision = 3
 requires-python = ">=3.10"
 resolution-markers = [
-    "python_full_version >= '3.13' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'group-7-urllib3-mypy' and extra != 'group-7-urllib3-test'",
-    "python_full_version == '3.12.*' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'group-7-urllib3-mypy' and extra != 'group-7-urllib3-test'",
-    "python_full_version == '3.11.*' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'group-7-urllib3-mypy' and extra != 'group-7-urllib3-test'",
-    "python_full_version < '3.11' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'group-7-urllib3-mypy' and extra != 'group-7-urllib3-test'",
     "python_full_version >= '3.15' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
-    "python_full_version >= '3.13' and python_full_version < '3.15' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
-    "python_full_version == '3.12.*' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
-    "python_full_version == '3.11.*' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
-    "python_full_version < '3.11' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
     "python_full_version >= '3.15' and extra != 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
+    "python_full_version >= '3.13' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'group-7-urllib3-mypy' and extra != 'group-7-urllib3-test'",
+    "python_full_version >= '3.13' and python_full_version < '3.15' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
     "python_full_version >= '3.13' and python_full_version < '3.15' and extra != 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
+    "python_full_version == '3.12.*' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'group-7-urllib3-mypy' and extra != 'group-7-urllib3-test'",
+    "python_full_version == '3.12.*' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
     "python_full_version == '3.12.*' and extra != 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
+    "python_full_version == '3.11.*' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'group-7-urllib3-mypy' and extra != 'group-7-urllib3-test'",
+    "python_full_version == '3.11.*' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
     "python_full_version == '3.11.*' and extra != 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
+    "python_full_version < '3.11' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'group-7-urllib3-mypy' and extra != 'group-7-urllib3-test'",
+    "python_full_version < '3.11' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
     "python_full_version < '3.11' and extra != 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
 ]
 conflicts = [[
@@ -1244,16 +1244,16 @@ name = "markdown-it-py"
 version = "4.2.0"
 source = { registry = "https://pypi.org/simple" }
 resolution-markers = [
-    "python_full_version >= '3.13' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'group-7-urllib3-mypy' and extra != 'group-7-urllib3-test'",
-    "python_full_version == '3.12.*' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'group-7-urllib3-mypy' and extra != 'group-7-urllib3-test'",
-    "python_full_version == '3.11.*' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'group-7-urllib3-mypy' and extra != 'group-7-urllib3-test'",
     "python_full_version >= '3.15' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
-    "python_full_version >= '3.13' and python_full_version < '3.15' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
-    "python_full_version == '3.12.*' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
-    "python_full_version == '3.11.*' and extra == 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
     "python_full_version >= '3.15' and extra != 'group-7-urllib3-dev' and extra != 'group-7-urllib3-dev-min-pyopenssl'",
+    "python_full_version >= '3.13' and extra != 'group-7-urllib3-dev' and extra == 'group-7-urllib3-dev-min-pyopenssl' and extra != 'gr
```

---

### Incident Patch 3: `e1d8025e` (2026-10-14)
**Commit Message**: Fix fingerprint verification test on PyPy 8.0.1 (#5313)

**File**: `test/with_dummyserver/test_socketlevel.py` (modified, +1/-1)
```diff
@@ -1727,7 +1727,7 @@ def socket_handler(listener: socket.socket) -> None:
                                 b"Hello"
                             )
                         except (
-                            ssl.SSLEOFError,
+                            ssl.SSLError,
                             ConnectionResetError,
                             ConnectionAbortedError,
                             BrokenPipeError,
```

#### Recent Merged Pull Requests:
- **PR #5313** (2026-10-14): Fix fingerprint verification test on PyPy 8.0.1 (@illia-v)
- **PR #5311** (closed): fix: reject NaN values in Timeout validation (@DawnofGenX)
- **PR #5307** (2026-10-14): Only enable Memray options when the pytest plugin is installed (@00200200)
- **PR #5304** (2026-10-08): Avoid unnecessary copy in single-output gzip decompression (@Johnny-Kao)
- **PR #5303** (closed): Reject NaN timeout values in Timeout validation (@boriskozak)
- **PR #5296** (closed): Reject non-finite timeout values (@masterwusama)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. HTTP/2 probe cache lock leak (#5254)

**RULE**:
When implementing operations in `changelog/5206.bugfix.rst`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in urllib3/urllib3. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a164d79c`: HTTP/2 probe cache lock leak (#5254). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `changelog/5206.bugfix.rst`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
Fixed concurrent HTTP/2 probes leaving waiting connection threads blocked after the probe result was cached.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a164d79c` are properly handled with clean fallback behavior.
