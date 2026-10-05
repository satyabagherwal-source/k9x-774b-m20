# Forensic Learning Record (Deep Inspection): potpie-ai/potpie

> **Canonical Artifact**: `07_PROJECT_LEARNING/potpie-ai-potpie-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/potpie-ai/potpie](https://github.com/potpie-ai/potpie))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:11:37.430Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `potpie-ai/potpie`
- **Description**: Context Graph for AI Native SDLC
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 5738 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `potpie/__init__.py`
```
"""Potpie product distribution."""

```

### Core Architecture Module: `potpie/agent_context.py`
```
"""Potpie agent-context composition over graph, pot, and skill services.

This is the public four-tool surface. ``resolve``/``search``/``record`` delegate
straight to ``GraphService``; ``status`` is the only composite — it joins graph
status, pot/source status, and a ``SkillManager`` nudge into one ``StatusReport``.

The root local-runtime composition binds here. The standalone Context Engine
HTTP surface owns its own delivery composition and must not import this root
composition or define new agent tools through it.
"""

from __future__ import annotations

from dataclasses import dataclass

from potpie_context_engine.core.agent_context_port import normalize_context_intent
from potpie_context_engine.core.agent_envelope import AgentEnvelope
from potpie_context_engine.core.ports.agent_context import (
    RecordReceipt,
    RecordRequest,
    ResolveRequest,
    SearchRequest,
    StatusReport,
    StatusRequest,
)
from potpie_context_engine.core.ports.graph_service import GraphService
from potpie.pots.contracts import (
    PotManagementService,
)
from potpie.skills.contracts import SkillManager


@dataclass(slots=True)
class AgentContextService:
    """The 4-tool agent contract, composed over the three services."""

    graph: GraphService
    pots: PotManagementService
    skills: SkillManager
    profile: str = "local"

    def resolve(self, request: ResolveRequest) -> AgentEnvelope:
        return self.graph.resolve(request)

    def search(self, request: SearchRequest) -> AgentEnvelope:
        return self.graph.search(request)

    def record(self, request: RecordRequest) -> RecordReceipt:
        return self.graph.record(request)

    def status(self, request: StatusRequest) -> StatusReport:
        agg = self.pots.aggregate_status(pot_id=request.pot_id)
        active = agg.active_pot
        pot_id = request.pot_id or (active.pot_id if active else "")
        data_plane = self.graph.data_plane_status(pot_id) if pot_id else None
        nudge = self.skills.nudge(agent=request.harness) if request.harness else None
        backend_ready = bool(data_plane and data_plane.backend_ready)
        return StatusReport(
            pot_id=pot_id,
            profile=self.profile,
            daemon_up=True,  # in-process host; real daemon liveness is host.daemon
            active_pot=active.name if active else None,
            backend_ready=backend_ready,
            data_plane=_data_plane_dict(data_plane),
            pot_summary={
                "pot_count": agg.pot_count,
                "sources": [s.name for s in agg.sources],
            },
            skills=nudge,
            recommended_next_action=_next_action(active is not None, backend_ready),
            metadata={"intent": normalize_context_intent(request.intent)},
        )


def _data_plane_dict(dp) -> dict:
    if dp is None:
        return {}
    return {
        "backend_profile": dp.backend_profile,
        "backend_ready": dp.backend_ready,
        "reader_backed_includes": list(dp.reader_backed_includes),
        "counts": dict(dp.counts),
        "freshness": dict(dp.freshness),
        "quality": dict(dp.quality),
    }


def _next_action(has_pot: bool, backend_ready: bool) -> str:
    if not has_pot:
        return "Run 'potpie setup' to create and activate a pot."
    if not backend_ready:
        return "Backend not ready — run 'potpie backend doctor'."
    return "Run 'potpie resolve \"<task>\"' to pull context for your work."


__all__ = ["AgentContextService"]

```

### Core Architecture Module: `potpie/auth/__init__.py`
```
"""Potpie-owned authentication contracts, adapters, and composition."""

from potpie.auth.ports.credentials import CredentialStore
from potpie.auth.wiring import build_credential_store

__all__ = ["CredentialStore", "build_credential_store"]

```

### Core Architecture Module: `potpie/auth/adapters/__init__.py`
```
"""Outbound adapters for the Potpie-owned authentication subsystem.

Persistence (file credential store), HTTP transport, and the
provider auth/flow clients (GitHub, Firebase, Potpie, Linear, Atlassian) that
talk to external systems. The inbound CLI command surfaces under
``potpie/cli`` drive these via their ports
(:class:`~domain.ports.cli_auth.credentials.CredentialStore`,
:class:`~adapters.outbound.cli_auth.http.HttpClient`). Nothing here imports from
``adapters.inbound``.
"""

```

### Core Architecture Module: `potpie/auth/adapters/atlassian_client.py`
```
"""Potpie-owned Atlassian client: token verification + site discovery.

Pure HTTP/transport for Jira & Confluence (no CLI/presentation). The interactive
login command lives in ``potpie.cli.auth.atlassian_auth``.
"""

from __future__ import annotations

import base64
import enum
import re
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import urlparse

from potpie.auth.adapters.http import (
    AuthHttpClient,
    AuthHttpError,
    HttpClient,
)
from potpie.auth.adapters.provider_config import (
    ATLASSIAN_ACCESSIBLE_RESOURCES_URL,
    AtlassianProduct,
    atlassian_confluence_gateway_url,
    atlassian_jira_gateway_url,
)


_HTTP_TIMEOUT = 30.0


_SITE_PROBE_TIMEOUT = 15.0


_JIRA_GATEWAY_PROBE_PATHS = (
    "/rest/api/3/project/search?maxResults=1",
    "/rest/api/3/myself",
)


_CONFLUENCE_GATEWAY_PROBE_PATHS = (
    "/wiki/rest/api/space?limit=1",
    "/wiki/rest/api/user/current",
)


class AtlassianAuthErrorKind(enum.StrEnum):
    INVALID_CREDENTIALS = "invalid_credentials"
    INSUFFICIENT_SCOPES = "insufficient_scopes"
    SITE_DISCOVERY_FAILED = "site_discovery_failed"
    PRODUCT_ACCESS_DENIED = "product_access_denied"
    UNKNOWN = "unknown"


AtlassianAuthScheme = Literal["basic", "bearer"]


@dataclass(frozen=True)
class AtlassianVerifyResult:
    ok: bool
    error_kind: AtlassianAuthErrorKind | None = None
    http_status: int | None = None
    display_name: str = ""
    succeeded_scheme: AtlassianAuthScheme | None = None


def token_style_from_succeeded_scheme(scheme: AtlassianAuthScheme | None) -> str:
    """Map gateway auth scheme to stored token_style metadata."""
    if scheme == "bearer":
        return "bearer"
    return "classic"


def atlassian_basic_auth_header(email: str, api_token: str) -> str:
    raw = f"{email.strip()}:{api_token.strip()}".encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("ascii")


def atlassian_bearer_auth_header(api_token: str) -> str:
    return f"Bearer {api_token.strip()}"


def _auth_header_variants(
    email: str, api_token: str
) -> list[tuple[AtlassianAuthScheme, dict[str, str]]]:
    accept = {"Accept": "application/json"}
    return [
        (
            "basic",
            {
                **accept,
                "Authorization": atlassian_basic_auth_header(email, api_token),
            },
        ),
        (
            "bearer",
            {
                **accept,
                "Authorization": atlassian_bearer_auth_header(api_token),
            },
        ),
    ]


def normalize_site_url(url: str) -> str:
    value = url.strip().rstrip("/")
    if not value:
        return ""
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"
    parsed = urlparse(value)
    if not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}"


def site_url_from_subdomain(subdomain: str) -> str:
    slug = subdomain.strip().lower().removesuffix(".atlassian.net")
    slug = slug.removeprefix("https://").removeprefix("http://")
    if not slug or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
        return ""
    return f"https://{slug}.atlassian.net"


def _gateway_base_url(cloud_id: str, product: AtlassianProduct) -> str:
    if product == "jira":
        return atlassian_jira_gateway_url(cloud_id)
    return atlassian_confluence_gateway_url(cloud_id)


def _gateway_probe_paths(product: AtlassianProduct) -> tuple[str, ...]:
    if product == "jira":
        return _JIRA_GATEWAY_PROBE_PATHS
    return _CONFLUENCE_GATEWAY_PROBE_PATHS


def _classify_gateway_status(status: int) -> AtlassianAuthErrorKind:
    if status == 401:
        return AtlassianAuthErrorKind.INVALID_CREDENTIALS
    if status == 403:
        return AtlassianAuthErrorKind.INSUFFICIENT_SCOPES
    if status == 404:
        return AtlassianAuthErrorKind.PRODUCT_ACCESS_DENIED
    return AtlassianAuthErrorKind.UNKNOWN


def _parse_profile_name(data: Any, *, product: AtlassianProduct) -> str:
    if not isinstance(data, dict):
        return ""
    if product == "jira":
        return str(data.get("displayName") or data.get("emailAddress") or "").strip()
    return str(data.get("displayName") or data.get("username") or "").strip()


def _parse_gateway_probe_success(
    data: Any,
    *,
    product: AtlassianProduct,
    path: str,
) -> str:
    if product == "jira" and "myself" in path:
        return _parse_profile_name(data, product=product)
    if product == "jira" and isinstance(data, dict):
        values = data.get("values")
        if isinstance(values, list) and values:
            first = values[0]
            if isinstance(first, dict):
                return str(first.get("name") or first.get("key") or "").strip()
        if isinstance(data, list) and data and isinstance(data[0], dict):
            return str(data[0].get("name") or data[0].get("key") or "").strip()
    if product == "confluence" and "user/current" in path:
        return _parse_profile_name(data, product=product)
    if product == "confluence" and isinstance(data, dict):
        results = data.get("results")
        if isinstance(results, list) and results:
            first = results[0]
            if isinstance(first, dict):
                return str(first.get("name") or first.get("key") or "").strip()
    return _parse_profile_name(data, product=product)


def verify_gateway_product(
    email: str,
    api_token: str,
    cloud_id: str,
    product: AtlassianProduct,
    *,
    http: HttpClient | None = None,
) -> AtlassianVerifyResult:
    """Verify credentials against the Atlassian scoped-token gateway."""
    cloud_id = cloud_id.strip()
    if not cloud_id:
        return AtlassianVerifyResult(
            ok=False,
            error_kind=AtlassianAuthErrorKind.SITE_DISCOVERY_FAILED,
        )

    base = _gateway_base_url(cloud_id, product)
    last_status: int | None = None
    last_kind = AtlassianAuthErrorKind.UNKNOWN
    saw_403 = False

    owns = http is None
    http = http or AuthHttpClient(timeout=_SITE_PROBE_TIMEOUT)
    try:
        for path in _gateway_probe_paths(product):
            url = f"{base}{path}"
            for scheme, headers in _auth_header_variants(email, api_token):
                try:
                    response = http.get(url, headers=headers)
                except AuthHttpError:
                    last_kind = AtlassianAuthErrorKind.UNKNOWN
                    last_status = None
                    continue
                last_status = response.status_code
                if response.status_code == 200:
                    payload = response.json() if response.content else {}
                    return AtlassianVerifyResult(
                        ok=True,
                        display_name=_parse_gateway_probe_success(
                            payload,
                            product=product,
                            path=path,
                        ),
                        succeeded_scheme=scheme,
                    )
                kind = _classify_gateway_status(response.status_code)
                last_kind = kind
                if response.status_code == 403:
                    saw_403 = True
                if response.status_code == 401:
                    continue
                break
    finally:
        if owns:
            http.close()

    if saw_403 and last_kind != AtlassianAuthErrorKind.INVALID_CREDENTIALS:
        last_kind = AtlassianAuthErrorKind.INSUFFICIENT_SCOPES

    return AtlassianVerifyResult(
        ok=False,
        error_kind=last_kind,
        http_status=last_status,
    )


def fetch_cloud_id_for_site(site_url: str, *, http: HttpClient | None = None) -> str:
    normalized = normalize_site_url(site_url)
    if not normalized:
        return ""
    url = f"{normalized}/_edge/tenant_info"
    owns = http is None
    http = http or AuthHttpClient(timeout=_SITE_PROBE_TIMEOUT)
    try:
        response = http.get(url, headers={"Accept":
```

### Core Architecture Module: `potpie/auth/adapters/atlassian_read_client.py`
```
"""Potpie-owned Atlassian Cloud read client (classic unscoped API tokens).

Pure transport + parsing for Jira & Confluence reads (fetch projects/issues/
spaces/pages, credential loading, response parsing) — no CLI/presentation. The
interactive workspace-selection flow lives in
``potpie.cli.auth.atlassian_read``.
"""

from __future__ import annotations

import re
from html import unescape
from typing import Any
from urllib.parse import quote

from potpie.auth.adapters.atlassian_client import (
    AtlassianProduct,
    atlassian_basic_auth_header,
    atlassian_bearer_auth_header,
    normalize_site_url,
)
from potpie.auth.adapters.credentials_store import (
    ProviderCredentialError,
    get_confluence_credentials,
    get_jira_credentials,
)
from potpie.auth.adapters.integration_profile import (
    atlassian_site_from_entry,
    atlassian_workspaces_from_entry,
)
from potpie.auth.adapters.errors import CliAuthError
from potpie.auth.adapters.http import (
    AuthHttpClient,
    AuthHttpError,
    HttpClient,
)
from potpie.auth.adapters.provider_config import (
    atlassian_confluence_gateway_url,
    atlassian_jira_gateway_url,
)

_HTTP_TIMEOUT = 30.0
_DEFAULT_JIRA_LIMIT = 10
_DEFAULT_CONFLUENCE_LIMIT = 10
_EXCERPT_LEN = 280


class AtlassianReadError(CliAuthError):
    """Failed to read Jira or Confluence data with stored credentials."""


def _is_gateway_base(base: str) -> bool:
    return "api.atlassian.com" in base.lower()


def _auth_header_variants(
    email: str,
    api_token: str,
    *,
    base: str,
) -> list[dict[str, str]]:
    """Build auth headers for a request base URL.

    Tenant URLs (*.atlassian.net) require Basic email:token. Bearer is interpreted
    as a Connect JWT and returns 403 "Failed to parse Connect Session Auth Token".
    """
    accept = {"Accept": "application/json"}
    basic = {**accept, "Authorization": atlassian_basic_auth_header(email, api_token)}
    if _is_gateway_base(base):
        bearer = {**accept, "Authorization": atlassian_bearer_auth_header(api_token)}
        return [basic, bearer]
    return [basic]


def _ordered_bases(
    product: AtlassianProduct,
    cloud_id: str,
    site_url: str,
    *,
    site_first: bool = False,
) -> list[str]:
    gateway = _gateway_bases(product, cloud_id)
    site = _site_bases(product, site_url)
    if site_first:
        return site + gateway
    return gateway + site


def _cloud_id_from_credentials(credentials: dict[str, Any]) -> str:
    site = atlassian_site_from_entry(credentials)
    cloud_id = str(site.get("cloud_id") or credentials.get("cloud_id") or "").strip()
    if not cloud_id:
        raise AtlassianReadError(
            "Missing cloud_id. Run: potpie jira login or potpie confluence login"
        )
    return cloud_id


def _site_url_from_credentials(credentials: dict[str, Any]) -> str:
    site = atlassian_site_from_entry(credentials)
    site_url = normalize_site_url(
        str(site.get("site_url") or credentials.get("site_url") or "")
    )
    if not site_url:
        raise AtlassianReadError(
            "Missing site_url. Run: potpie jira login or potpie confluence login"
        )
    return site_url


def _gateway_bases(product: AtlassianProduct, cloud_id: str) -> list[str]:
    if product == "jira":
        return [atlassian_jira_gateway_url(cloud_id).rstrip("/")]
    return [atlassian_confluence_gateway_url(cloud_id).rstrip("/")]


def _site_bases(product: AtlassianProduct, site_url: str) -> list[str]:
    base = normalize_site_url(site_url)
    if not base:
        return []
    if product == "jira":
        return [base]
    return [base]


def _transport_read_error(
    exc: AuthHttpError,
    *,
    product: AtlassianProduct,
    method: str,
    base: str,
    path: str,
) -> AtlassianReadError:
    return AtlassianReadError(f"{product} {method} failed for {path} via {base}: {exc}")


def _get_json(
    *,
    email: str,
    api_token: str,
    product: AtlassianProduct,
    cloud_id: str,
    site_url: str,
    path: str,
    site_first: bool = False,
    http: HttpClient | None = None,
) -> dict[str, Any]:
    path = path if path.startswith("/") else f"/{path}"
    paths = [path]
    if product == "confluence" and not path.startswith("/wiki/"):
        paths.append(f"/wiki{path}")
    bases = _ordered_bases(product, cloud_id, site_url, site_first=site_first)
    last_status: int | None = None
    last_body = ""
    last_transport_exc: AuthHttpError | None = None
    last_transport_base = ""
    last_transport_path = ""

    owns = http is None
    http = http or AuthHttpClient(timeout=_HTTP_TIMEOUT)
    try:
        for candidate_path in paths:
            for base in bases:
                url = f"{base}{candidate_path}"
                for headers in _auth_header_variants(email, api_token, base=base):
                    try:
                        response = http.get(url, headers=headers)
                    except AuthHttpError as exc:
                        last_transport_exc = exc
                        last_transport_base = base
                        last_transport_path = candidate_path
                        continue
                    last_status = response.status_code
                    if response.status_code == 200:
                        data = response.json()
                        if isinstance(data, dict):
                            return data
                        return {"data": data}
                    last_body = response.text[:500]
    finally:
        if owns:
            http.close()

    if last_transport_exc is not None and last_status is None:
        raise _transport_read_error(
            last_transport_exc,
            product=product,
            method="GET",
            base=last_transport_base,
            path=last_transport_path,
        ) from last_transport_exc

    raise AtlassianReadError(
        f"{product} read failed (HTTP {last_status}): {last_body or 'no response body'}"
    )


def _post_json(
    *,
    email: str,
    api_token: str,
    product: AtlassianProduct,
    cloud_id: str,
    site_url: str,
    path: str,
    body: dict[str, Any],
    site_first: bool = False,
    http: HttpClient | None = None,
) -> dict[str, Any]:
    path = path if path.startswith("/") else f"/{path}"
    bases = _ordered_bases(product, cloud_id, site_url, site_first=site_first)
    last_status: int | None = None
    last_body = ""
    headers_base = {"Accept": "application/json", "Content-Type": "application/json"}

    owns = http is None
    http = http or AuthHttpClient(timeout=_HTTP_TIMEOUT)
    try:
        for base in bases:
            url = f"{base}{path}"
            for auth in _auth_header_variants(email, api_token, base=base):
                headers = {**headers_base, **auth}
                try:
                    response = http.post(url, headers=headers, json=body)
                except AuthHttpError as exc:
                    raise _transport_read_error(
                        exc,
                        product=product,
                        method="POST",
                        base=base,
                        path=path,
                    ) from exc
                last_status = response.status_code
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, dict):
                        return data
                    return {"data": data}
                last_body = response.text[:500]
    finally:
        if owns:
            http.close()

    raise AtlassianReadError(
        f"{product} read failed (HTTP {last_status}): {last_body or 'no response body'}"
    )


_JIRA_ISSUE_FIELDS = [
    "summary",
    "status",
    "created",
    "updated",
    "project",
    "assignee",
    "reporter",
    "priority",
    "issuetype",
    "description",
]


def _jira_search(
    ctx: dict[str, Any],
    *,
    jql: str,
    max_results: int,
    fields: list[str] | None = None,
) -> di
```

### Core Architecture Module: `potpie/auth/adapters/callback_server.py`
```
"""Potpie-owned local server that captures OAuth redirect parameters."""

from __future__ import annotations

import html
import threading
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Sequence
from urllib.parse import parse_qs, urlparse


@dataclass
class OAuthCallbackResult:
    code: str | None = None
    state: str | None = None
    error: str | None = None
    error_description: str | None = None

    @property
    def ok(self) -> bool:
        return bool(self.code) and not self.error


@dataclass
class OAuthCallbackServer:
    host: str
    port: int
    path: str
    result: OAuthCallbackResult
    _done: threading.Event
    _server: HTTPServer
    _thread: threading.Thread

    def wait(self, *, timeout: float = 300.0) -> OAuthCallbackResult:
        expected_path = self.path if self.path.startswith("/") else f"/{self.path}"
        if not self._done.wait(timeout=timeout):
            raise TimeoutError(
                f"Timed out after {timeout:.0f}s waiting for OAuth callback on "
                f"http://{self.host}:{self.port}{expected_path}"
            )
        return self.result

    def close(self) -> None:
        self._server.shutdown()
        self._server.server_close()
        self._thread.join(timeout=2.0)


def _oauth_callback_failure_html(error: str | None) -> str:
    escaped_error = html.escape(error or "No authorization code received")
    return (
        "<html><body><h1>Authentication failed</h1>"
        f"<p>{escaped_error}</p>"
        "</body></html>"
    )


def start_oauth_callback_server(
    *,
    host: str = "localhost",
    port: int,
    path: str = "/callback",
    fallback_ports: Sequence[int] = (),
) -> OAuthCallbackServer:
    """Start a local callback server, trying fallback ports when the base is busy."""
    errors: list[OSError] = []
    for candidate in _unique_ports((port, *fallback_ports)):
        try:
            return _start_oauth_callback_server(host=host, port=candidate, path=path)
        except OSError as exc:
            errors.append(exc)
    ports = ", ".join(
        str(candidate) for candidate in _unique_ports((port, *fallback_ports))
    )
    detail = "; ".join(str(exc) for exc in errors)
    raise OSError(
        f"Could not bind OAuth callback server on {host} port(s) {ports}: {detail}"
    )


def wait_for_oauth_callback(
    *,
    host: str = "localhost",
    port: int,
    path: str = "/callback",
    timeout: float = 300.0,
) -> OAuthCallbackResult:
    """Block until the provider redirects to the local callback URL."""
    server = start_oauth_callback_server(host=host, port=port, path=path)
    try:
        return server.wait(timeout=timeout)
    finally:
        server.close()


def _start_oauth_callback_server(
    *,
    host: str,
    port: int,
    path: str,
) -> OAuthCallbackServer:
    result = OAuthCallbackResult()
    done = threading.Event()
    expected_path = path if path.startswith("/") else f"/{path}"

    class _Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args: Any) -> None:  # noqa: ARG002
            return

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path != expected_path:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Not found")
                return

            params = parse_qs(parsed.query, keep_blank_values=True)
            result.code = _first(params, "code")
            result.state = _first(params, "state")
            result.error = _first(params, "error")
            result.error_description = _first(params, "error_description")

            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            if result.ok:
                body = (
                    "<html><body><h1>Authentication successful</h1>"
                    "<p>You can close this tab and return to the terminal.</p>"
                    "</body></html>"
                )
            else:
                body = _oauth_callback_failure_html(result.error)
            self.wfile.write(body.encode("utf-8"))
            done.set()

    server = HTTPServer((host, port), _Handler)
    server.timeout = 1.0
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return OAuthCallbackServer(
        host=host,
        port=port,
        path=expected_path,
        result=result,
        _done=done,
        _server=server,
        _thread=thread,
    )


def _unique_ports(ports: Sequence[int]) -> tuple[int, ...]:
    seen: set[int] = set()
    candidates: list[int] = []
    for port in ports:
        if not 1 <= port <= 65535 or port in seen:
            continue
        seen.add(port)
        candidates.append(port)
    return tuple(candidates)


def _first(params: dict[str, list[str]], key: str) -> str | None:
    values = params.get(key)
    if not values:
        return None
    value = values[0]
    return value if value else None

```

### Core Architecture Module: `potpie/auth/adapters/credentials.py`
```
"""Potpie-owned file-backed implementation of the ``CredentialStore`` port.

`FileCredentialStore` implements the core-owned
:class:`~potpie.auth.ports.credentials.CredentialStore` port, delegating to the
existing :mod:`potpie.auth.adapters.credentials_store` module (the file-backed
store is *wrapped, not rewritten*). It is constructed at the composition root
(:func:`potpie.auth.wiring.build_credential_store`); inbound code depends on
the port, never on this class. Tests inject an in-memory fake satisfying the same
port instead of monkeypatching the module.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from potpie.auth.ports.credentials import CredentialStore
from potpie.auth.adapters import credentials_store as _store


class FileCredentialStore(CredentialStore):
    """Production `CredentialStore` backed by local credential files.

    Thin delegation to the `credentials_store` module so the existing
    implementation stays the single source of truth.
    """

    # --- paths / Potpie account ------------------------------------------
    def credentials_path(self) -> Path:
        return _store.credentials_path()

    def get_stored_api_key(self) -> str:
        return _store.get_stored_api_key()

    def get_stored_api_base_url(self) -> str:
        return _store.get_stored_api_base_url()

    def write_api_base_url(self, api_base_url: Optional[str]) -> None:
        _store.write_api_base_url(api_base_url)

    def store_potpie_api_key(self, api_key: str, *, created_at: str) -> None:
        _store.store_potpie_api_key(api_key, created_at=created_at)

    def store_potpie_firebase_refresh_token(
        self,
        refresh_token: str,
        *,
        created_at: str,
        firebase_api_key: str | None = None,
    ) -> None:
        _store.store_potpie_firebase_refresh_token(
            refresh_token, created_at=created_at, firebase_api_key=firebase_api_key
        )

    def store_potpie_firebase_id_token(self, id_token: str) -> None:
        _store.store_potpie_firebase_id_token(id_token)

    def update_potpie_firebase_refresh_token(self, refresh_token: str) -> None:
        _store.update_potpie_firebase_refresh_token(refresh_token)

    def get_potpie_auth_type(self) -> str:
        return _store.get_potpie_auth_type()

    def get_potpie_firebase_refresh_token(self) -> str:
        return _store.get_potpie_firebase_refresh_token()

    def get_potpie_firebase_id_token(self) -> str:
        return _store.get_potpie_firebase_id_token()

    def get_potpie_firebase_api_key(self) -> str:
        return _store.get_potpie_firebase_api_key()

    def clear_potpie_auth(self, *, clear_api_key: bool = False) -> None:
        _store.clear_potpie_auth(clear_api_key=clear_api_key)

    # --- generic provider credentials (github) ---------------------------
    def get_provider_credentials(self, provider: str) -> dict[str, Any]:
        return _store.get_provider_credentials(provider)

    def write_provider_credentials(
        self, provider: str, payload: dict[str, Any]
    ) -> None:
        _store.write_provider_credentials(provider, payload)

    def clear_provider_credentials(self, provider: str) -> None:
        _store.clear_provider_credentials(provider)

    # --- integrations (linear / atlassian) -------------------------------
    def get_integration_tokens(self, provider: str) -> dict[str, Any]:
        return _store.get_integration_tokens(provider)

    def save_integration_tokens(self, provider: str, tokens: dict[str, Any]) -> None:
        _store.save_integration_tokens(provider, tokens)

    def clear_integration_tokens(self, provider: str) -> None:
        _store.clear_integration_tokens(provider)

    def get_integration_status(self, provider: str) -> dict[str, Any]:
        return _store.get_integration_status(provider)

    def list_integration_providers(self) -> list[str]:
        return _store.list_integration_providers()

    # --- Atlassian product credentials + workspace prefs -----------------
    def get_jira_credentials(self) -> dict[str, Any]:
        return _store.get_jira_credentials()

    def save_jira_credentials(self, credentials: dict[str, Any]) -> None:
        _store.save_jira_credentials(credentials)

    def clear_jira_credentials(self) -> None:
        _store.clear_jira_credentials()

    def get_confluence_credentials(self) -> dict[str, Any]:
        return _store.get_confluence_credentials()

    def save_confluence_credentials(self, credentials: dict[str, Any]) -> None:
        _store.save_confluence_credentials(credentials)

    def clear_confluence_credentials(self) -> None:
        _store.clear_confluence_credentials()

    def get_atlassian_credentials(self) -> dict[str, Any]:
        return _store.get_atlassian_credentials()

    def save_atlassian_credentials(self, credentials: dict[str, Any]) -> None:
        _store.save_atlassian_credentials(credentials)

    def clear_atlassian_credentials(self) -> None:
        _store.clear_atlassian_credentials()

    def save_jira_workspace_prefs(self, *, project_key: str) -> None:
        _store.save_jira_workspace_prefs(project_key=project_key)

    def save_confluence_workspace_prefs(self, *, space_key: str) -> None:
        _store.save_confluence_workspace_prefs(space_key=space_key)

    # --- GitBucket product credentials -----------------------------------
    def get_gitbucket_credentials(self) -> dict[str, Any]:
        return _store.get_gitbucket_credentials()

    def save_gitbucket_credentials(self, credentials: dict[str, Any]) -> None:
        _store.save_gitbucket_credentials(credentials)

    def clear_gitbucket_credentials(self) -> None:
        _store.clear_gitbucket_credentials()

    # --- GitLab credentials + workspace prefs ----------------------------
    def get_gitlab_credentials(
        self,
        instance_host: str | None = None,
    ) -> dict[str, Any]:
        return _store.get_gitlab_credentials(instance_host=instance_host)

    def save_gitlab_credentials(
        self,
        credentials: dict[str, Any],
        *,
        account: dict[str, Any] | None = None,
    ) -> None:
        _store.save_gitlab_credentials(credentials, account=account)

    def clear_gitlab_credentials(
        self,
        instance_host: str | None = None,
    ) -> None:
        _store.clear_gitlab_credentials(instance_host=instance_host)

    def list_gitlab_instances(self) -> list[dict[str, Any]]:
        return _store.list_gitlab_instances()

    def save_gitlab_workspace_prefs(
        self,
        *,
        instance_host: str | None = None,
        default_project: str,
    ) -> None:
        _store.save_gitlab_workspace_prefs(
            instance_host=instance_host,
            default_project=default_project,
        )


__all__ = ["CredentialStore", "FileCredentialStore"]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1027** (2026-07-28): **Consolidate local reinstall guidance around make cli-install**
  *Symptoms*: ### Area  Install or upgrade  ### Potpie version  v2.0.0  ### Install source  Other  ### System  macOS , python3.13.13  ### Coding agent and model  _No response_  ### Command or workflow  ```bash uv tool install --force --editable ./potpie/context-engine ```  > **Note:** Some older documentation may instead instruct you to run: > > ```bash > pip install potpie > ```  ### What happened?  Raw editable/`pip` install guidance worked but skipped UI build, daemon stop, and the full local install path. Expected docs and skills to point repo-local reinstall at `make cli-install`, keep `pip`/`uv tool install potpie` for published packages only, and hint `make cli-status` / `potpie doctor` for uv-tool installs.  ### Source or build details  _No response_ 
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-2031">POT-2031</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Standardize on one rule everywhere: `make cli-install` for repo-local/contributor reinstall (full UI build + daemon stop + editable install), `pip install potpie` / `uv tool install potpie` for published packages only, and `make cli-status` / `potpie doctor` as the health checks. - Update human docs (README, context-graph docs, contributor guides) and agent-facing files (potpie-cli SKILL, Claude plugin README) to apply that rule and remove the nonexistent `potpie install` reference. - Fix the `cli_install_status.py` package-name mismatch so `potpie doctor` correctly detects uv-tool installs, making the promoted hints truthful, and update the unit test to match real `uv tool list` output while preserving all existing string/key contracts.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: Should the uv-tool detection bug in `cli_install_status.py` be fixed as pa

- **Issue #1025** (2026-07-27): **De-emphasize legacy and cloud groups in root help; add first-run guidance**
  *Symptoms*: ### Area  Other  ### Potpie Version  v2.0.0  ### Install Source  Editable/local build  ### System  - **OS:** macOS 26.4.1 - **Python:** 3.13.13  ### Coding Agent and Model  _No response_  ### Command or Workflow  ```bash potpie --help ```  ### What Happened?  The root `potpie --help` output listed `auth` (legacy aliases) and `cloud` (currently under development) alongside the primary user commands in the **Commands** section, making them appear as part of the recommended workflow for first-time users.  ### Expected Behavior  The root help should:  - Display a short **First Run** guide (for example: `setup` → `doctor` → `status`) to direct new users toward the recommended workflow. - De-emphasize the `auth` and `cloud` command groups by clearly marking them as **Legacy** and **Coming Soon** (or similar), and displaying them below the primary commands rather than alongside the happy-path commands.  ### Source or Build Details  _No response_ 
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-2030">POT-2030</a></p>

- **Issue #992** (2026-07-28): **Domain errors and ok:false JSON exit 0 — automation cannot detect CLI failures**
  *Symptoms*: ### Area  Other  ### Potpie version  potpie v2.0.0b3  ### Install source  uv tool install potpie  ### System  macOS  ### Coding agent and model  _No response_  ### Command or workflow  Commands run:  ```bash # Capability not implemented potpie --json cloud status echo "exit: $?"  # Domain / pot scope failure potpie --json graph status echo "exit: $?"  # Graph workbench failure (ok:false in JSON) potpie --json graph nudge --event bogus --session s1 --pot <pot-id> echo "exit: $?"  # Shell chain (automation) potpie --json cloud status && echo "should not print" ```  ### What happened?  The CLI printed the correct structured error output, but the process still exited with code `0` (success).  | Command | Output | Exit code | |---------|--------|-----------| | `potpie --json cloud status` | `"code": "not_implemented"` | `0` | | `potpie --json graph status` | `"ok": false` (for example, `ambiguous_pot`) | `0` | | `potpie --json graph nudge --event bogus ...` | `"ok": false` with error details | `0` | | `potpie --json cloud status && echo "should not print"` | The second command executed because the first returned success | `0` |  So the JSON correctly indicated a failure, but `$?` reported success.  Parser and usage errors behaved correctly and returned a non-zero exit code. For example:  ```bash potpie pot create # Error: Missing argument 'NAME' echo "exit: $?" # exit: 2 ```  ### Source or build details  _No response_  ### Output or logs  _No additional logs._
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1869">POT-1869</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Fix the true root cause once at the boundary: `run_cli()` must propagate the exit code that Typer/Click's `standalone_mode=False` returns instead of discarding it, restoring correct exit codes for all `fail()`/`contract()` domain errors (including `cloud status` and pot-scope failures). - Close the graph-specific gap by centralizing the `ok:false` → nonzero-exit guard in `_emit_graph_result()`, so `graph nudge` and sibling commands exit nonzero on error envelopes. - Add regression tests at the real exit-code boundary (not `CliRunner`) and document the invariant so the fix stays enforced.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: How should graph commands that emit ok:false payloads be made to exit nonzero?</b></summary>    **Options Considered:** 1. Centralize the guard inside _emit_graph_result() so it raises typer.Exit(EXIT_VALIDATION) whenever the e

- **Issue #981** (2026-07-28): **Fix mislabeled feature claims in potpie resolve output**
  *Symptoms*: ## Component/Module  Other  ## Environment  Development (`isDevelopmentMode=enabled`)  ## Severity  Low (Minor issue / Cosmetic)  ## Operating System  macOS  ## Environment Information  - **OS:** macOS - **Shell:** zsh - **CLI:** `potpie` - **Working Directory:** `potpie/context-engine` - **Backend Profile:** Local graph backend - **Reproduction Condition:** Use a populated pot containing both infrastructure-topology claims and feature claims such as `PROVIDES` or `IMPLEMENTED_IN`.  ## Description  `potpie resolve` can return feature-related claims under the `infra_topology` include label.  This is misleading because predicates such as `PROVIDES` and `IMPLEMENTED_IN` describe feature context, not infrastructure topology. These claims should instead be returned under `features` so that the output labels accurately reflect the semantics of the underlying data.  The issue occurs because the top-level resolve behavior allows feature predicates to surface through the `infra_topology` include path instead of the `features` include path.  ## Expected Behavior  When resolving feature-oriented context:  - Feature claims such as `PROVIDES` and `IMPLEMENTED_IN` should appear under `features`. - `infra_topology` results should contain only infrastructure-related predicates such as `DEPENDS_ON`, `USES`, `DEPLOYED_TO`, `DEFINED_IN`, `HOSTED_ON`, and `OWNED_BY`. - Top-level `resolve` output should use include labels that match the semantic category of the returned claims.  ## Actual Behavio
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1819">POT-1819</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Remove the overlapping `PROVIDES`/`IMPLEMENTED_IN` predicates from `_INFRA_PREDICATES` so the infra-topology read path no longer consumes feature-domain edges. - Add the `"features"` family to the default includes for the `"feature"` intent so `FeaturesReader` is dispatched and feature claims are correctly labeled. - Rely on the existing orchestrator/envelope labeling pipeline (no changes needed there), since labels are stamped from the routing key, which becomes correct once the predicates and dispatch are fixed. - Update existing tests that encoded the old behavior and add coverage asserting correct predicate-to-family labeling.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: Should the `features` family be added to other intents that currently include `infra_topology`?</b></summary>    **Options Considered:** 1. Only add `"features"` to `DEFAULT_INTENT_IN
  > Mislabeled feature claims in resolve output sound like they should be generated from a capability registry rather than hand-maintained text. A regression could run `potpie resolve` against a fixture project and assert each claim maps to an actual detector/result field. That would make it much harder for marketing-style wording to drift ahead of what the resolver can prove. 

- **Issue #978** (2026-06-30): **Add next actions after potpie source add repo for empty pots**
  *Symptoms*: ### Component/Module  Other  ### Environment  Development (isDevelopmentMode=enabled)  ### Severity  Low (Minor issue/Cosmetic)  ### Operating System  macOS  ### Environment Information   OS: macOS   - Shell: zsh   - CLI entrypoint: potpie   - Working directory: potpie/context-engine   - Backend: local graph backend  ### Description  ## Description    Source registration is intentionally registration-only and should not trigger ingestion or scanning automatically. That part is correct.    The problem is that when a repository is added to a brand-new or otherwise empty pot, the CLI did not provide follow-up guidance. Users could complete the command successfully and   still be left with an empty graph and no clear next step.    The fix is to add a next-actions block for empty pots after successful source add repo, and include `recommended_next_action` in JSON output.  ### Expected Behavior    ## Expected Behavior    After running:    `potpie source add repo . --pot <empty-pot-id>`    if the target pot has 0 claims, the CLI should:    - confirm registration succeeded   - clearly state that no ingestion or scan was started   - show concrete next actions, such as:       - inspect linked pots       - switch to a populated pot       - start a manual graph mutation workflow    In JSON mode, the success payload should also include:    `"recommended_next_action": "..."`  ### Actual Behavior  _No response_  ### Steps to Reproduce  ## Steps To Reproduce    1. Choose or create a pot with
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1816">POT-1816</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Enrich only the post-success output of `source_add` in `pots.py`; registration, telemetry, and repo-default logic stay unchanged. - Reuse the existing emptiness-detection helpers (`pot_graph_counts` / `empty_pot_warnings`) in `_common.py` rather than introducing new graph queries or new abstractions. - Since `emit()` has no next-action parameter, inline `recommended_next_action` into the JSON payload and append a next-actions block to the human string (the same pattern `graph.py` already uses), gated on the pot being empty. - Add targeted unit tests in `test_source_cli_contract.py` for the empty-pot path while preserving the existing non-empty JSON contract.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: Source of the next-action guidance text for empty pots</b></summary>    **Options Considered:** 1. Reuse `empty_pot_warnings()` verbatim as the `recommende
  > <!-- This is an auto-generated reply by CodeRabbit --> I've updated the plan above based on your feedback. Ready to proceed when you are!

- **Issue #977** (2026-07-01): **fix(cli): explain missing service logs for embedded graph backends**
  *Symptoms*: ## Summary  `potpie service logs falkordb_lite` (and other embedded graph backends) returns a generic `no log file` message even though `falkordb_lite` runs embedded inside the daemon, not as a managed subprocess with its own `service-<name>.log`. Users get no guidance on where to look (`potpie daemon logs`) or where the FalkorDBLite database file lives.  ## Reproduction  ```bash potpie setup --daemon          # default embedded / falkordb_lite backend potpie --json service logs falkordb_lite ```  ## Observed:  ```bash  {"lines": []} Human output: no log file ``` No status, profile, recommended_log_command, or database_path. Same vague response for embedded, in_memory, and alias falkordblite.  ## Expected:  Structured response explaining the backend is embedded, pointing to potpie daemon logs, and (for falkordb_lite) including the database file path:  ```bash {   "lines": [],   "status": "embedded_backend",   "profile": "falkordb_lite",   "recommended_log_command": "potpie daemon logs",   "database_path": "/path/to/falkordb_lite.db",   "message": "falkordb_lite runs embedded inside the daemon (no separate service log).",   "detail": [     "falkordb_lite runs embedded inside the daemon (no separate service log).",     "Use `potpie daemon logs` for daemon output.",     "Database file: /path/to/falkordb_lite.db"   ] } ``` For unknown or not-yet-started managed subprocess services, the message should distinguish:  - managed service not started yet → potpie service up <name> - unk
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1815">POT-1815</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Replace the single bare missing-log emission in `service_logs` with a `_missing_service_log_response()` helper that classifies the requested name into embedded-backend, managed-but-unstarted, or unknown, emitting a structured payload via the existing `emit()` contract. - Add small, cohesive private helpers (`_normalize_service_name`, `_embedded_graph_profile`, `_managed_service_names`) that follow the module's established private-helper and graceful-absent patterns, reusing `context_engine_falkordb_lite_path()` and the `/admin/services` endpoint. - Keep all existing behavior intact when a real `service-<name>.log` exists, and cover the new embedded-backend path with a unit test mirroring existing test fixtures.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: How should managed-service classification behave when the daemon is not running?</b></summary>    **O

- **Issue #973** (2026-07-01): **`pot create --repo . ` not registering the current repo**
  *Symptoms*: ## Summary  `potpie pot create <name> --use --repo .` creates the pot but registers a broken repo source: `name="."`, `location=null`, and does not set the repo-local default. `source add repo .` already resolves `.` correctly and sets the default.  ## Reproduction  ```bash potpie --json pot create pot-1 --use --repo . potpie --json source list --pot <new-pot-id> ``` Observed: ```bash {"kind":"repo","name":".","location":null} ``` Repo default for the current repo is not set.`  Expected (same as source add repo .): ```bash {"kind":"repo","name":"github.com/owner/repo","location":"github.com/owner/repo"} with repo_default_set: true. ``` ## Root cause Two different code paths:  - source add repo → resolve_repo_location() + add_source(location=...) + set_repo_default() - pot create --repo → LocalPotStore.create() appends {kind: repo, name: repo} with no location and no default  ## Evidence `potpie/context-engine/adapters/outbound/pots/local_pot_store.py:85-92` — broken inline source on create `potpie/context-engine/adapters/inbound/cli/commands/pots.py` — pot create passed repo to store `potpie/context-engine/adapters/inbound/cli/commands/pots.py` — source add uses resolve_repo_location + default `potpie/context-engine/adapters/inbound/cli/repo_location.py` — repo resolution helpers `potpie/context-engine/tests/unit/test_cli_ergonomics.py` — source add repo . contract tests  ## Impact - Repo pot resolution breaks after pot create --repo . - source list shows unusable source meta
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1808">POT-1808</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Extract a single `register_repo_source()` helper in `pots.py` that performs resolve → `add_source` → `set_repo_default`, and route both `source add repo` and `pot create --repo` through it. - Remove the malformed inline source registration from `LocalPotStore.create()` so there is one correct registration path. - Add `--no-default` to `pot create` and enrich its JSON output with `source`, `repo_default_set`, and `repo_key`, matching `source add`. - Align the setup wizard with the shared path and add tests covering `.`/`current` normalization, CWD fallback, and `--no-default`.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: Where should the shared repo-registration helper live?</b></summary>    **Options Considered:** 1. Define `register_repo_source()` in `adapters/inbound/cli/commands/pots.py` (as stated in the ticket). 2. Define it in `repo_location.py` alo

- **Issue #971** (2026-07-01): **Surface empty-pot recovery guidance earlier in pot/source commands**
  *Symptoms*: ## Summary  `graph status`, `graph read`, and `search-entities` warn when the current pot has **0 claims** but another repo-linked pot has claims. That recovery hint is useful, but it only appears **after** graph calls have already run.  Users can create or switch to an empty pot, register sources, and only discover the mismatch once they hit graph commands.  **Area:** `potpie-context-engine` CLI — pot/source commands + `_common.empty_pot_warnings`   **Severity:** Low–Medium — UX / recovery guidance, not data loss  ## Reproduction  1. Link the same repo to two pots: one empty, one populated. 2. `potpie pot use <empty-pot>` or `potpie source add repo .` on the empty pot. 3. Command succeeds with no warning. 4. `potpie graph status` (or `read` / `search-entities`) warns:   ## Root cause  `empty_pot_warnings()` in `_common.py` is only called from graph commands **after** graph service calls complete.  Pot/source commands (`pot create`, `pot use`, `source add`, `source list`) do not surface the same guidance.  ## Evidence  - `potpie/context-engine/adapters/inbound/cli/commands/_common.py` — `empty_pot_warnings()` - `potpie/context-engine/adapters/inbound/cli/commands/graph.py` — used in `status`, `read`, `search-entities` - `potpie/context-engine/adapters/inbound/cli/commands/pots.py` — pot/source commands with no early warning - `potpie/context-engine/tests/unit/test_graph_cli_contract.py::test_graph_status_warns_when_active_repo_pot_is_empty`  ## Impact  - Users pick the wrong 
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1807">POT-1807</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Centralize a new `empty_pot_guidance()` in `_common.py` that reuses the existing sibling-pot warning and adds ingestion next-step guidance for pots with sources but zero claims. - Add an `enrich_with_pot_guidance()` helper that injects `warnings`/`recommended_next_action` into the emit payload (for `--json`) and appends warning lines to the human string, leaving the shared `emit()` untouched. - Wire the helper into `pot create`, `pot use`, `source add`, and `source list` at the point each resolves its pot, so guidance appears before any graph call. - Keep graph commands and their existing warnings unchanged, and add fake-host contract tests covering the new early guidance across both output modes.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: How should warnings reach `--json` output given that `emit()` only serializes the payload dict?</b></summary>    **

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

### Incident Patch 1: `32b8cbbb` (2026-09-28)
**Commit Message**: fix(deps): bump anyio to 4.14.2 for CVE-2026-63374 (#1080)

Raise the workspace floor to anyio>=4.14.2 so the transitive httpx /
starlette pin leaves the TLS IDNA hostname-mismatch range (<=4.14.1)
flagged by Vanta POT-2597.

Co-authored-by: Cursor Agent <cursoragent@cursor.com>
Co-authored-by: Shambhavi Shinde <shmbhvi101@users.noreply.github.com>

**File**: `potpie/context-engine/pyproject.toml` (modified, +1/-0)
```diff
@@ -144,5 +144,6 @@ constraint-dependencies = [
     "urllib3>=2.7.0",
     "httpx2>=2.12.0",
     "httpcore2>=2.10.0",
+    "anyio>=4.14.2",
     "soupsieve>=2.9.0",
 ]
```

**File**: `potpie/context-engine/uv.lock` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@ constraints = [
     { name = "urllib3", specifier = ">=2.7.0" },
     { name = "httpcore2", specifier = ">=2.10.0" },
     { name = "httpx2", specifier = ">=2.12.0" },
+    { name = "anyio", specifier = ">=4.14.2" },
     { name = "soupsieve", specifier = ">=2.9.0" },
 ]
 
```

**File**: `potpie/sandbox/pyproject.toml` (modified, +2/-0)
```diff
@@ -50,4 +50,6 @@ constraint-dependencies = [
     "starlette>=1.3.1",
     "torch>=2.13.0",
     "urllib3>=2.7.0",
+    # CVE-2026-63374 / GHSA-82r6-8w77-94w6: floor at 4.14.2 (vulnerable: <=4.14.1).
+    "anyio>=4.14.2",
 ]
```

**File**: `potpie/sandbox/uv.lock` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ constraints = [
     { name = "starlette", specifier = ">=1.3.1" },
     { name = "torch", specifier = ">=2.13.0" },
     { name = "urllib3", specifier = ">=2.7.0" },
+    { name = "anyio", specifier = ">=4.14.2" },
 ]
 
 [[package]]
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -130,6 +130,7 @@ override-dependencies = [
     # transitive genai-prices client stack on patched releases.
     "httpx2>=2.12.0",
     "httpcore2>=2.10.0",
+    "anyio>=4.14.2",
     "soupsieve>=2.9.0",
 ]
 
```

---

### Incident Patch 2: `db33c46d` (2026-09-23)
**Commit Message**: fix(deps): bump soupsieve to 2.9.2 for CVE-2026-85999/86000 (POT-2569) (#1079)

* fix(deps): bump soupsieve to 2.9.2 for CVE-2026-85999/86000

Raise the workspace floor to soupsieve>=2.9.0 so the markdownify →
beautifulsoup4 transitive pin in context-engine leaves the ReDoS range
(<2.9.0) flagged by Vanta POT-2569.

Co-authored-by: Shambhavi Shinde <shmbhvi101@users.noreply.github.com>

* chore: drop soupsieve CVE comments per review

Review feedback on #1079: keep the >=2.9.0 floor without inline CVE notes.
---------
Co-authored-by: Shambhavi Shinde <shmbhvi101@users.noreply.github.com>

**File**: `potpie/context-engine/pyproject.toml` (modified, +1/-0)
```diff
@@ -144,4 +144,5 @@ constraint-dependencies = [
     "urllib3>=2.7.0",
     "httpx2>=2.12.0",
     "httpcore2>=2.10.0",
+    "soupsieve>=2.9.0",
 ]
```

**File**: `potpie/context-engine/uv.lock` (modified, +4/-3)
```diff
@@ -25,6 +25,7 @@ constraints = [
     { name = "urllib3", specifier = ">=2.7.0" },
     { name = "httpcore2", specifier = ">=2.10.0" },
     { name = "httpx2", specifier = ">=2.12.0" },
+    { name = "soupsieve", specifier = ">=2.9.0" },
 ]
 
 [[package]]
@@ -3245,11 +3246,11 @@ wheels = [
 
 [[package]]
 name = "soupsieve"
-version = "2.8.4"
+version = "2.9.2"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/47/2c/0a5f6f8ee0d5589e48c7640213ed5175d52cf540a06725b628cc1a45d6ce/soupsieve-2.8.4.tar.gz", hash = "sha256:e121fd02e975c695e4e9e8774a5ee35d74714b59307868dcc5319ad2d9e3328e", size = 121110, upload-time = "2026-05-24T13:55:57.154Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/69/99/a6ca3beb3ccacb41fb3321d8a60e5566f9e6467601ef8eba6a17e1b89778/soupsieve-2.9.2.tar.gz", hash = "sha256:4a55d8cf158a9c2e587fa4922f1bbb91d68ac829e2d6f25403a85747c71daf74", size = 122445, upload-time = "2026-08-07T00:57:24.801Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/5e/f5/0c41cb68dcae6b7de4fac4188a3a9589e21fb31df21ea3a2e888db95e6c9/soupsieve-2.8.4-py3-none-any.whl", hash = "sha256:e7e6b0769c8f51ed59acab6e994b00621096cfb1c640a7509295987388fbaf65", size = 37304, upload-time = "2026-05-24T13:55:55.406Z" },
+    { url = "https://files.pythonhosted.org/packages/eb/dc/ad025c1ee131eba60c69f4dd5779b18fcf1e6b21a343e2162a84d5d133c7/soupsieve-2.9.2-py3-none-any.whl", hash = "sha256:8089a26fd974ca7a1f30276d3d8492ab266ab15af581642dfe8aa162e0c1c823", size = 37370, upload-time = "2026-08-07T00:57:23.524Z" },
 ]
 
 [[package]]
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -130,6 +130,7 @@ override-dependencies = [
     # transitive genai-prices client stack on patched releases.
     "httpx2>=2.12.0",
     "httpcore2>=2.10.0",
+    "soupsieve>=2.9.0",
 ]
 
 [tool.uv.workspace]
```

**File**: `uv.lock` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@ overrides = [
     { name = "pydantic-settings", specifier = ">=2.14.2" },
     { name = "pyjwt", specifier = ">=2.13.0" },
     { name = "python-dotenv", specifier = ">=1.2.2" },
+    { name = "soupsieve", specifier = ">=2.9.0" },
     { name = "starlette", specifier = ">=1.3.1" },
     { name = "torch", specifier = ">=2.13.0" },
 ]
```

---

### Incident Patch 3: `6373454c` (2026-09-09)
**Commit Message**: fix(deps): remediate Vanta high and medium vulnerabilities (#1075)

**File**: `potpie/context-engine/pyproject.toml` (modified, +8/-0)
```diff
@@ -124,6 +124,12 @@ dev = [
 ]
 
 [tool.uv]
+override-dependencies = [
+    # GHSA-8xx6-hgc6-gc2m and related httpx2/httpcore2 advisories: keep the
+    # transitive genai-prices client stack on patched releases.
+    "httpx2>=2.12.0",
+    "httpcore2>=2.10.0",
+]
 constraint-dependencies = [
     "aiohttp>=3.14.3",
     "cryptography>=50.0.0",
@@ -136,4 +142,6 @@ constraint-dependencies = [
     "starlette>=1.3.1",
     "torch>=2.13.0",
     "urllib3>=2.7.0",
+    "httpx2>=2.12.0",
+    "httpcore2>=2.10.0",
 ]
```

**File**: `potpie/context-engine/uv.lock` (modified, +20/-8)
```diff
@@ -23,6 +23,8 @@ constraints = [
     { name = "starlette", specifier = ">=1.3.1" },
     { name = "torch", specifier = ">=2.13.0" },
     { name = "urllib3", specifier = ">=2.7.0" },
+    { name = "httpcore2", specifier = ">=2.10.0" },
+    { name = "httpx2", specifier = ">=2.12.0" },
 ]
 
 [[package]]
@@ -991,15 +993,15 @@ wheels = [
 
 [[package]]
 name = "httpcore2"
-version = "2.7.0"
+version = "2.12.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "h11" },
     { name = "truststore" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/d5/fe/6a3f9f1a8bb8733326140737446aaf72fddb8b54b8f202302f5c84960613/httpcore2-2.7.0.tar.gz", hash = "sha256:6dc0fedf329a52a990930a5579edfebaea81118ea700ea0dd7de2b5e5be49efc", size = 65593, upload-time = "2026-07-14T20:40:01.111Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/be/ad/f4f0e57345f1870f3e8cb624e058d7eca6e5a27d33bcc3311d9b618734cd/httpcore2-2.12.0.tar.gz", hash = "sha256:9293522bba0aa7c4c8e9e3f040c16575bd8868e155a77fa30c7a9085a5eae648", size = 67548, upload-time = "2026-08-18T13:22:08.211Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/6f/6c/62e2e279e63fc4f7a5ee841ef13175a8bbc613f258e9dcc186e9de803a42/httpcore2-2.7.0-py3-none-any.whl", hash = "sha256:1452f589fe23f55b44546cd884294c41a29330af902bc0b71a761fd52d18f92b", size = 81506, upload-time = "2026-07-14T20:39:58.053Z" },
+    { url = "https://files.pythonhosted.org/packages/d2/74/d370e55600d9bcfa0d9794b0166126d49291a3d2b20c268fc98c453a4948/httpcore2-2.12.0-py3-none-any.whl", hash = "sha256:7e04258ce01013d7d615e5b910a3b27fac937d7a95038227e79652b4ba3b4ceb", size = 83074, upload-time = "2026-08-18T13:22:05.854Z" },
 ]
 
 [[package]]
@@ -1064,18 +1066,28 @@ wheels = [
 
 [[package]]
 name = "httpx2"
-version = "2.7.0"
+version = "2.12.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "anyio" },
+    { name = "anyio", marker = "sys_platform != 'emscripten'" },
     { name = "httpcore2" },
+    { name = "httpx2-jsfetch", marker = "sys_platform == 'emscripten'" },
     { name = "idna" },
-    { name = "truststore" },
+    { name = "truststore", marker = "sys_platform != 'emscripten'" },
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/a3/4a/129b2e21b90ac2985d3928d96792bccc39bc6dfe796c5eee2d8ec06d4105/httpx2-2.7.0.tar.gz", hash = "sha256:8b30709aed5c8465b0dd3b95c09ce301c8f79e7e7a2d00ab0af551e0d0375b07", size = 94487, upload-time = "2026-07-14T20:40:02.318Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/7f/f8/579a8b51e42e38ee32647df9f08aa25643ae788e275cc625b199829c4671/httpx2-2.12.0.tar.gz", hash = "sha256:7631fe9887a8a2275f4a2540e053aa670fcc50742864a9ae7c66e609fdcf12cf", size = 100040, upload-time = "2026-08-18T13:22:09.086Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/c8/95/411ba65569158e862368917aaf56597f3e5fa3b91b0502919638465a08f3/httpx2-2.12.0-py3-none-any.whl", hash = "sha256:cc8b6eecb8661c146b8f89a60e97456ee086e91a784ed31ac450c3a9e613dd36", size = 95427, upload-time = "2026-08-18T13:22:06.834Z" },
+]
+
+[[package]]
+name = "httpx2-jsfetch"
+version = "1.0"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.pythonhosted.org/packages/cd/c4/0e5636363151a2a1795e0a77617168b9ca438e1748ec05fc9b5687f93d64/httpx2_jsfetch-1.0.tar.gz", hash = "sha256:70a0e3eabfef7cce5ad9c629f7d01ca05e418f586646f4ddf14782e4c1454c60", size = 6872, upload-time = "2026-08-07T00:13:07.492Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/1d/b8/c341bba6411bdfda786020343c47a75ef472f6085caf82391b142b1a3ad9/httpx2-2.7.0-py3-none-any.whl", hash = "sha256:ed2a2719c696789e09493bd8e2bec3d8bd925cc6e26b68389ec25ade132f7bf4", size = 90234, upload-time = "2026-07-14T20:39:59.531Z" },
+    { url = "https://files.pythonhosted.org/packages/9b/43/832f631d32e4f1211caa2ba368317739fe71f
```

**File**: `potpie/daemon/http/ui/frontend/package-lock.json` (modified, +44/-30)
```diff
@@ -1192,7 +1192,9 @@
       }
     },
     "node_modules/baseline-browser-mapping": {
-      "version": "2.10.43",
+      "version": "2.11.21",
+      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.21.tgz",
+      "integrity": "sha512-uh8vpY/1/YyFkunIDFH/12p7/7VdPKA1hejMVEbdkEaWnUz0Hesvx5EbiU6XxjyHZIOju+ZMbQJkRh+es3/spQ==",
       "dev": true,
       "license": "Apache-2.0",
       "bin": {
@@ -1211,7 +1213,9 @@
       }
     },
     "node_modules/browserslist": {
-      "version": "4.28.6",
+      "version": "4.28.9",
+      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.28.9.tgz",
+      "integrity": "sha512-EWazOblFYUvlGZcfGhPUPmYh3nikUxBVb+y9MJun5f3hBi812X+8MSQTujLBtgK3cf51fJWbWfOjyeO954d+Eg==",
       "dev": true,
       "funding": [
         {
@@ -1229,11 +1233,11 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "baseline-browser-mapping": "^2.10.42",
-        "caniuse-lite": "^1.0.30001803",
-        "electron-to-chromium": "^1.5.389",
-        "node-releases": "^2.0.51",
-        "update-browserslist-db": "^1.2.3"
+        "baseline-browser-mapping": "^2.11.20",
+        "caniuse-lite": "^1.0.30001810",
+        "electron-to-chromium": "^1.5.420",
+        "node-releases": "^2.0.54",
+        "update-browserslist-db": "^1.3.2"
       },
       "bin": {
         "browserslist": "cli.js"
@@ -1243,7 +1247,9 @@
       }
     },
     "node_modules/caniuse-lite": {
-      "version": "1.0.30001806",
+      "version": "1.0.30001810",
+      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001810.tgz",
+      "integrity": "sha512-TITQPUkaz+aVk5GL6NhOdwk1aEaNTSDPsGFWrTuhKGtjTF70jL/Oht2W4c6rXUe5fu7Ie19VIahAXHIIiWWNeg==",
       "dev": true,
       "funding": [
         {
@@ -1476,7 +1482,9 @@
       }
     },
     "node_modules/electron-to-chromium": {
-      "version": "1.5.393",
+      "version": "1.5.425",
+      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.425.tgz",
+      "integrity": "sha512-QvPtl41EUOnuT1HBvMKgxXRIaHNcagBPs50u7VULzhZXaGfqTbZyE16LQsctZ/RQHlGu+FOWeDTR4mY6YbeF1g==",
       "dev": true,
       "license": "ISC"
     },
@@ -1522,6 +1530,8 @@
     },
     "node_modules/escalade": {
       "version": "3.2.0",
+      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
+      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
       "dev": true,
       "license": "MIT",
       "engines": {
@@ -1687,27 +1697,10 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/nanoid": {
-      "version": "3.3.17",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.17.tgz",
-      "integrity": "sha512-xQLf0A3HOMlgHq0n247/LRuAOYmB7dXJ/DvAxGvsSBij45XtBSmQycu+F8ODbHwns/XyFZagyL1+J0Offw1E0g==",
-      "dev": true,
-      "funding": [
-        {
-          "type": "github",
-          "url": "https://github.com/sponsors/ai"
-        }
-      ],
-      "license": "MIT",
-      "bin": {
-        "nanoid": "bin/nanoid.cjs"
-      },
-      "engines": {
-        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
-      }
-    },
     "node_modules/node-releases": {
-      "version": "2.0.51",
+      "version": "2.0.54",
+      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.54.tgz",
+      "integrity": "sha512-YHs7BmmcsdAI5Ozuf8JZo6PT0mv2GIWC9vMfvUC3dp65M8hn7Ux8CPL+2oBI7juNuj9d0ndhTcznq2ODBps9cQ==",
       "dev": true,
       "license": "MIT",
       "engines": {
@@ -1766,6 +1759,25 @@
         "node": "^10 || ^12 || >=14"
       }
     },
+    "node_modules/postcss/node_modules/nanoid": {
+      "version": "3.3.18",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.18.tgz",
+      "integrity": "sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==",
+      "dev": true,
+      "fu
```

**File**: `potpie/daemon/http/ui/frontend/package.json` (modified, +4/-1)
```diff
@@ -22,6 +22,9 @@
     "vite": "^6.4.3"
   },
   "overrides": {
-    "postcss": ">=8.5.23"
+    "postcss": ">=8.5.23",
+    "baseline-browser-mapping": ">=2.11.0",
+    "browserslist": ">=4.28.7",
+    "nanoid": ">=3.3.18 <4.0.0"
   }
 }
```

**File**: `pyproject.toml` (modified, +4/-0)
```diff
@@ -126,6 +126,10 @@ override-dependencies = [
     "pydantic-ai-slim>=1.106.0",
     # CVE-2025-3000: torch <= 2.12.1; 2.13.0 is the first patched release on PyPI.
     "torch>=2.13.0",
+    # GHSA-8xx6-hgc6-gc2m and related httpx2/httpcore2 advisories: keep the
+    # transitive genai-prices client stack on patched releases.
+    "httpx2>=2.12.0",
+    "httpcore2>=2.10.0",
 ]
 
 [tool.uv.workspace]
```

---

### Incident Patch 4: `642a72c3` (2026-09-07)
**Commit Message**: fix(deps): remediate xmldom vulnerability (POT-2475) (#1072)

* fix(deps): remediate xmldom vulnerability in docs checks

* fix(deps): lock xmldom at patched version

**File**: `tests/docs/package-lock.json` (modified, +4/-4)
```diff
@@ -6,17 +6,17 @@
     "": {
       "name": "potpie-docs-check",
       "dependencies": {
-        "@xmldom/xmldom": "^0.9.11",
+        "@xmldom/xmldom": "^0.9.12",
         "yaml": "^2.8.2"
       },
       "engines": {
         "node": ">=22"
       }
     },
     "node_modules/@xmldom/xmldom": {
-      "version": "0.9.11",
-      "resolved": "https://registry.npmjs.org/@xmldom/xmldom/-/xmldom-0.9.11.tgz",
-      "integrity": "sha512-tW8bcK3hsG0/uqSnNz6TK4BkcuZSezoU7DlnYssILmZDktPnSHHuDJJFM0AJv+13gz2r0iGdrj6qqKeUnxXEDg==",
+      "version": "0.9.12",
+      "resolved": "https://registry.npmjs.org/@xmldom/xmldom/-/xmldom-0.9.12.tgz",
+      "integrity": "sha512-5AXjrcMClTryPe9LgZrygpB1lj7s0S9E0+W+AHaVKAVyHanafK86iPSvG5xHVSp/jC+VH1UXu0TAEmY279xH7A==",
       "license": "MIT",
       "engines": {
         "node": ">=14.6"
```

**File**: `tests/docs/package.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     "node": ">=22"
   },
   "dependencies": {
-    "@xmldom/xmldom": "^0.9.11",
+    "@xmldom/xmldom": "^0.9.12",
     "yaml": "^2.8.2"
   }
 }
```

---

### Incident Patch 5: `23f11d68` (2026-08-31)
**Commit Message**: fix: align PyPI metadata tooling (#1069)

**File**: `.github/workflows/release_potpie_pypi.yml` (modified, +2/-2)
```diff
@@ -366,7 +366,7 @@ jobs:
           path: release-bundle
 
       - name: Publish potpie-context-engine
-        uses: pypa/gh-action-pypi-publish@cef221092ed1bacb1cc03d23a2d87d1d172e277b # release/v1
+        uses: pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33 # release/v1
         with:
           packages-dir: release-bundle/dist/context-engine/
 
@@ -401,7 +401,7 @@ jobs:
           path: release-bundle
 
       - name: Publish potpie
-        uses: pypa/gh-action-pypi-publish@cef221092ed1bacb1cc03d23a2d87d1d172e277b # release/v1
+        uses: pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33 # release/v1
         with:
           packages-dir: release-bundle/dist/potpie/
 
```

**File**: `potpie/context-engine/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 [build-system]
-requires = ["hatchling"]
+requires = ["hatchling==1.32.0"]
 build-backend = "hatchling.build"
 
 [tool.hatch.build.hooks.custom]
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 [build-system]
-requires = ["hatchling>=1.27"]
+requires = ["hatchling==1.32.0"]
 build-backend = "hatchling.build"
 
 [tool.hatch.build.hooks.custom]
```

---

### Incident Patch 6: `a3419788` (2026-08-14)
**Commit Message**: fix(deps): bump pydantic-ai-slim past CVE-2026-54249 (POT-2310) (#1054)

Raise the pydantic-ai-slim floor from 1.102.0 to 1.106.0 and lock
1.107.4 so Dependabot/Vanta no longer report GHSA-h7p7-w5gc-xj3w.

Co-authored-by: Cursor Agent <cursoragent@cursor.com>
Co-authored-by: Shambhavi Shinde <shmbhvi101@users.noreply.github.com>

**File**: `potpie/context-engine/pyproject.toml` (modified, +3/-3)
```diff
@@ -64,8 +64,8 @@ github = [
 ]
 reconciliation-agent = [
     "pydantic-deep>=0.3.0",
-    # CVE floor for pydantic-deep's transitive dependency (see #1015).
-    "pydantic-ai-slim>=1.102.0",
+    # CVE-2026-54249: floor at 1.106.0 (vulnerable: >=1.65.0, <1.106.0).
+    "pydantic-ai-slim>=1.106.0",
 ]
 hatchet = [
     "hatchet-sdk>=1.29.0",
@@ -139,7 +139,7 @@ constraint-dependencies = [
     "gitpython>=3.1.58",
     "idna>=3.15",
     "pyjwt>=2.13.0",
-    "pydantic-ai-slim>=1.102.0",
+    "pydantic-ai-slim>=1.106.0",
     "pydantic-settings>=2.14.2",
     "python-multipart>=0.0.28",
     "starlette>=1.3.1",
```

**File**: `potpie/context-engine/uv.lock` (modified, +3/-3)
```diff
@@ -16,7 +16,7 @@ constraints = [
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
     { name = "idna", specifier = ">=3.15" },
-    { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
+    { name = "pydantic-ai-slim", specifier = ">=1.106.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
     { name = "pyjwt", specifier = ">=2.13.0" },
     { name = "python-multipart", specifier = ">=0.0.28" },
@@ -2128,8 +2128,8 @@ requires-dist = [
     { name = "psycopg", extras = ["binary"], marker = "extra == 'all'", specifier = ">=3.2" },
     { name = "psycopg", extras = ["binary"], marker = "extra == 'postgres'", specifier = ">=3.2" },
     { name = "pydantic", specifier = ">=2.0" },
-    { name = "pydantic-ai-slim", marker = "extra == 'all'", specifier = ">=1.102.0" },
-    { name = "pydantic-ai-slim", marker = "extra == 'reconciliation-agent'", specifier = ">=1.102.0" },
+    { name = "pydantic-ai-slim", marker = "extra == 'all'", specifier = ">=1.106.0" },
+    { name = "pydantic-ai-slim", marker = "extra == 'reconciliation-agent'", specifier = ">=1.106.0" },
     { name = "pydantic-deep", marker = "extra == 'all'", specifier = ">=0.3.0" },
     { name = "pydantic-deep", marker = "extra == 'reconciliation-agent'", specifier = ">=0.3.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

**File**: `potpie/sandbox/pyproject.toml` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ constraint-dependencies = [
     "gitpython>=3.1.58",
     "idna>=3.15",
     "pyjwt>=2.13.0",
-    "pydantic-ai-slim>=1.102.0",
+    "pydantic-ai-slim>=1.106.0",
     "pydantic-settings>=2.14.2",
     "python-multipart>=0.0.28",
     "starlette>=1.3.1",
```

**File**: `potpie/sandbox/uv.lock` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ constraints = [
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
     { name = "idna", specifier = ">=3.15" },
-    { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
+    { name = "pydantic-ai-slim", specifier = ">=1.106.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
     { name = "pyjwt", specifier = ">=2.13.0" },
     { name = "python-multipart", specifier = ">=0.0.28" },
```

**File**: `pyproject.toml` (modified, +3/-2)
```diff
@@ -33,7 +33,7 @@ dependencies = [
     "pillow>=12.3.0",
     "potpie-context-core==0.1.0",
     "potpie-context-engine[all]==0.1.0",
-    "pydantic-ai-slim>=1.102.0",
+    "pydantic-ai-slim>=1.106.0",
     "pydantic-settings>=2.14.2",
     "pyjwt>=2.13.0",
     "rich>=13.0",
@@ -109,7 +109,8 @@ override-dependencies = [
     "starlette>=1.3.1",
     "pyjwt>=2.13.0",
     "pydantic-settings>=2.14.2",
-    "pydantic-ai-slim>=1.102.0",
+    # CVE-2026-54249: floor at 1.106.0 (vulnerable: >=1.65.0, <1.106.0).
+    "pydantic-ai-slim>=1.106.0",
     # CVE-2025-3000: torch <= 2.12.1; 2.13.0 is the first patched release on PyPI.
     "torch>=2.13.0",
 ]
```

---

### Incident Patch 7: `af27492c` (2026-08-13)
**Commit Message**: Revert "fix(deps): clear stale legacy/uv.lock for POT-2266 Medium vulns (#1048)" (#1052)

This reverts commit 86891420e0d9d5de8fadcae1668269e9aa0c6c2c.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `legacy/uv.lock` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-version = 1
-revision = 3
-requires-python = ">=3.12, <3.15"
-
-[[package]]
-name = "potpie-legacy"
-version = "0.2.0"
-source = { editable = "." }
```

**File**: `potpie/context-engine/pyproject.toml` (modified, +0/-1)
```diff
@@ -137,7 +137,6 @@ constraint-dependencies = [
     "aiohttp>=3.14.3",
     "cryptography>=50.0.0",
     "gitpython>=3.1.58",
-    "h2>=4.4.1",
     "idna>=3.15",
     "pyjwt>=2.13.0",
     "pydantic-ai-slim>=1.102.0",
```

**File**: `potpie/context-engine/uv.lock` (modified, +0/-1)
```diff
@@ -15,7 +15,6 @@ constraints = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
-    { name = "h2", specifier = ">=4.4.1" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

**File**: `potpie/sandbox/pyproject.toml` (modified, +0/-1)
```diff
@@ -42,7 +42,6 @@ constraint-dependencies = [
     "aiohttp>=3.14.3",
     "cryptography>=50.0.0",
     "gitpython>=3.1.58",
-    "h2>=4.4.1",
     "idna>=3.15",
     "pyjwt>=2.13.0",
     "pydantic-ai-slim>=1.102.0",
```

**File**: `potpie/sandbox/uv.lock` (modified, +0/-1)
```diff
@@ -7,7 +7,6 @@ constraints = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
-    { name = "h2", specifier = ">=4.4.1" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

---

### Incident Patch 8: `3a2d4368` (2026-08-13)
**Commit Message**: Revert "fix(deps): clear stale potpie-legacy SBOM for POT-2236 Medium vulns (#1046)" (#1051)

This reverts commit 20b0497d4c521021addce15ca40b43250c9907d4.

**File**: `legacy/README.md` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-# potpie-legacy (dependency-graph stub)
-
-This directory is **not** the former Potpie demo host.
-
-After `legacy/` was removed in #1034, GitHub’s dependency graph kept a stale
-`potpie-legacy@0.1.0` / `legacy/uv.lock` snapshot that still resolved
-vulnerable pins (`aiohttp==3.14.1`, `gitpython==3.1.54`, and
-`httpx[http2]` → `h2==4.3.0`). That ghost snapshot kept Medium Dependabot /
-Vanta findings open (POT-2236, POT-2266).
-
-This empty PEP 621 manifest plus empty `uv.lock` at the same path (version
-`0.2.0`) replaces that snapshot with zero dependencies. It is intentionally
-**not** a uv workspace member.
-
-Once Dependabot shows `deps=0` for this path (or the alerts auto-close), a
-follow-up may delete this stub entirely.
```

**File**: `legacy/_potpie_legacy_stub/__init__.py` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-"""Empty package so hatch can build the potpie-legacy hygiene stub wheel."""
```

**File**: `legacy/pyproject.toml` (removed, +0/-20)
```diff
@@ -1,20 +0,0 @@
-[build-system]
-requires = ["hatchling>=1.27"]
-build-backend = "hatchling.build"
-
-# Dependency-graph hygiene stub (POT-2236 / POT-2266).
-# GitHub's SBOM kept a deleted potpie-legacy@0.1.0 + legacy/uv.lock snapshot
-# with aiohttp==3.14.1, gitpython==3.1.54, and httpx[http2] -> h2==4.3.0 after
-# legacy/ was removed (#1034). Re-publishing an empty manifest + empty uv.lock
-# at this path (version bump to 0.2.0) replaces that stale snapshot so
-# Dependabot/Vanta Medium findings can clear. Not a workspace member.
-[project]
-name = "potpie-legacy"
-version = "0.2.0"
-description = "Empty stub replacing the removed legacy demo host (dependency-graph hygiene only)."
-requires-python = ">=3.12,<3.15"
-license = "Apache-2.0"
-dependencies = []
-
-[tool.hatch.build.targets.wheel]
-packages = ["_potpie_legacy_stub"]
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -103,8 +103,8 @@ override-dependencies = [
     "cryptography>=50.0.0",
     # CVE-2026-59881 / CVE-2026-69243 / CVE-2026-69244: floor at 3.14.3.
     "aiohttp>=3.14.3",
-    # GitPython: Medium + High advisories through 3.1.57 (incl. GHSA-p538-c434-8v24,
-    # GHSA-539m-9xh6-q6rr, GHSA-wvpp-8hx9-p66j). Floor at 3.1.58.
+    # GitPython GHSA-3f7w-8rr8-f37f / GHSA-539m-9xh6-q6rr (<=3.1.56) and
+    # GHSA-wvpp-8hx9-p66j / related Highs (<=3.1.57): floor at 3.1.58.
     "gitpython>=3.1.58",
     # CVE-2026-71554 / GHSA-6hr6-w5qg-qmwg: h2 <=4.4.0; floor at 4.4.1.
     "h2>=4.4.1",
```

---

### Incident Patch 9: `86891420` (2026-08-12)
**Commit Message**: fix(deps): clear stale legacy/uv.lock for POT-2266 Medium vulns (#1048)

Replace the ghost legacy/uv.lock Dependabot still served after #1034
(aiohttp==3.14.1, gitpython==3.1.54, httpx[http2]->h2==4.3.0) with an
empty lock and bump potpie-legacy to 0.2.0. Add h2>=4.4.1 floors.

Linear: POT-2266

Co-authored-by: Cursor Agent <cursoragent@cursor.com>
Co-authored-by: Shambhavi Shinde <shmbhvi101@users.noreply.github.com>

**File**: `legacy/README.md` (modified, +7/-5)
```diff
@@ -3,12 +3,14 @@
 This directory is **not** the former Potpie demo host.
 
 After `legacy/` was removed in #1034, GitHub’s dependency graph kept a stale
-`potpie-legacy@0.1.0` snapshot that still resolved vulnerable pins
-(`aiohttp==3.14.1`, `gitpython==3.1.54`). That ghost snapshot kept Medium
-Dependabot / Vanta findings open (POT-2236).
+`potpie-legacy@0.1.0` / `legacy/uv.lock` snapshot that still resolved
+vulnerable pins (`aiohttp==3.14.1`, `gitpython==3.1.54`, and
+`httpx[http2]` → `h2==4.3.0`). That ghost snapshot kept Medium Dependabot /
+Vanta findings open (POT-2236, POT-2266).
 
-This empty PEP 621 manifest at the same path replaces that snapshot with zero
-dependencies. It is intentionally **not** a uv workspace member.
+This empty PEP 621 manifest plus empty `uv.lock` at the same path (version
+`0.2.0`) replaces that snapshot with zero dependencies. It is intentionally
+**not** a uv workspace member.
 
 Once Dependabot shows `deps=0` for this path (or the alerts auto-close), a
 follow-up may delete this stub entirely.
```

**File**: `legacy/pyproject.toml` (modified, +7/-6)
```diff
@@ -2,14 +2,15 @@
 requires = ["hatchling>=1.27"]
 build-backend = "hatchling.build"
 
-# Dependency-graph hygiene stub (POT-2236).
-# GitHub's SBOM still listed a deleted potpie-legacy@0.1.0 snapshot with
-# aiohttp==3.14.1 and gitpython==3.1.54 after legacy/ was removed (#1034).
-# Re-publishing an empty manifest at this path replaces that stale snapshot
-# so Dependabot/Vanta Medium findings can clear. Not a workspace member.
+# Dependency-graph hygiene stub (POT-2236 / POT-2266).
+# GitHub's SBOM kept a deleted potpie-legacy@0.1.0 + legacy/uv.lock snapshot
+# with aiohttp==3.14.1, gitpython==3.1.54, and httpx[http2] -> h2==4.3.0 after
+# legacy/ was removed (#1034). Re-publishing an empty manifest + empty uv.lock
+# at this path (version bump to 0.2.0) replaces that stale snapshot so
+# Dependabot/Vanta Medium findings can clear. Not a workspace member.
 [project]
 name = "potpie-legacy"
-version = "0.1.0"
+version = "0.2.0"
 description = "Empty stub replacing the removed legacy demo host (dependency-graph hygiene only)."
 requires-python = ">=3.12,<3.15"
 license = "Apache-2.0"
```

**File**: `legacy/uv.lock` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+version = 1
+revision = 3
+requires-python = ">=3.12, <3.15"
+
+[[package]]
+name = "potpie-legacy"
+version = "0.2.0"
+source = { editable = "." }
```

**File**: `potpie/context-engine/pyproject.toml` (modified, +1/-0)
```diff
@@ -137,6 +137,7 @@ constraint-dependencies = [
     "aiohttp>=3.14.3",
     "cryptography>=50.0.0",
     "gitpython>=3.1.58",
+    "h2>=4.4.1",
     "idna>=3.15",
     "pyjwt>=2.13.0",
     "pydantic-ai-slim>=1.102.0",
```

**File**: `potpie/context-engine/uv.lock` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ constraints = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
+    { name = "h2", specifier = ">=4.4.1" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

---

### Incident Patch 10: `20b0497d` (2026-08-11)
**Commit Message**: fix(deps): clear stale potpie-legacy SBOM for POT-2236 Medium vulns (#1046)

Replace the deleted legacy/ manifest with an empty potpie-legacy stub so
GitHub's dependency graph drops ghost aiohttp==3.14.1 and gitpython==3.1.54
pins that keep Dependabot/Vanta Medium findings open. Raise GitPython floors
to >=3.1.58. postcss remains at >=8.5.23 / lock 8.5.26.

Co-authored-by: Cursor Agent <cursoragent@cursor.com>
Co-authored-by: Shambhavi Shinde <shmbhvi101@users.noreply.github.com>
Co-authored-by: Yash Krishan <yashkmkrishan@gmail.com>

**File**: `legacy/README.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+# potpie-legacy (dependency-graph stub)
+
+This directory is **not** the former Potpie demo host.
+
+After `legacy/` was removed in #1034, GitHub’s dependency graph kept a stale
+`potpie-legacy@0.1.0` snapshot that still resolved vulnerable pins
+(`aiohttp==3.14.1`, `gitpython==3.1.54`). That ghost snapshot kept Medium
+Dependabot / Vanta findings open (POT-2236).
+
+This empty PEP 621 manifest at the same path replaces that snapshot with zero
+dependencies. It is intentionally **not** a uv workspace member.
+
+Once Dependabot shows `deps=0` for this path (or the alerts auto-close), a
+follow-up may delete this stub entirely.
```

**File**: `legacy/_potpie_legacy_stub/__init__.py` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+"""Empty package so hatch can build the potpie-legacy hygiene stub wheel."""
```

**File**: `legacy/pyproject.toml` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+[build-system]
+requires = ["hatchling>=1.27"]
+build-backend = "hatchling.build"
+
+# Dependency-graph hygiene stub (POT-2236).
+# GitHub's SBOM still listed a deleted potpie-legacy@0.1.0 snapshot with
+# aiohttp==3.14.1 and gitpython==3.1.54 after legacy/ was removed (#1034).
+# Re-publishing an empty manifest at this path replaces that stale snapshot
+# so Dependabot/Vanta Medium findings can clear. Not a workspace member.
+[project]
+name = "potpie-legacy"
+version = "0.1.0"
+description = "Empty stub replacing the removed legacy demo host (dependency-graph hygiene only)."
+requires-python = ">=3.12,<3.15"
+license = "Apache-2.0"
+dependencies = []
+
+[tool.hatch.build.targets.wheel]
+packages = ["_potpie_legacy_stub"]
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -103,8 +103,8 @@ override-dependencies = [
     "cryptography>=50.0.0",
     # CVE-2026-59881 / CVE-2026-69243 / CVE-2026-69244: floor at 3.14.3.
     "aiohttp>=3.14.3",
-    # GitPython GHSA-3f7w-8rr8-f37f / GHSA-539m-9xh6-q6rr (<=3.1.56) and
-    # GHSA-wvpp-8hx9-p66j / related Highs (<=3.1.57): floor at 3.1.58.
+    # GitPython: Medium + High advisories through 3.1.57 (incl. GHSA-p538-c434-8v24,
+    # GHSA-539m-9xh6-q6rr, GHSA-wvpp-8hx9-p66j). Floor at 3.1.58.
     "gitpython>=3.1.58",
     "starlette>=1.3.1",
     "pyjwt>=2.13.0",
```

#### Recent Merged Pull Requests:
- **PR #1080** (2026-09-28): fix(deps): bump anyio to 4.14.2 for CVE-2026-63374 (POT-2597) (@shmbhvi101)
- **PR #1079** (2026-09-23): fix(deps): bump soupsieve to 2.9.2 for CVE-2026-85999/86000 (POT-2569) (@shmbhvi101)
- **PR #1075** (2026-09-09): [Vanta] Remediate high and medium vulnerabilities (@shmbhvi101)
- **PR #1074** (2026-09-15): Instrument graph explorer load and tag CLI usage by product surface (@BrhKmr23)
- **PR #1073** (2026-09-15): feat(cli): emit canonical activation-command and useful-context telemetry (@BrhKmr23)
- **PR #1072** (2026-09-07): fix(deps): remediate xmldom vulnerability (POT-2475) (@shmbhvi101)
- **PR #1071** (2026-09-15): feat(cli): emit canonical per-agent skills-install telemetry  (@BrhKmr23)
- **PR #1069** (2026-08-31): Fix PyPI Core Metadata 2.5 publishing (@Dsantra92)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
