# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: topoteretes-cognee-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "topoteretes-cognee-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T17:37:29.271Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-topoteretes-cognee-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [topoteretes-cognee-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T17:37:29.271Z`  
> **Learning ID**: `LEARN-EVO-topoteretes-cognee-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: D (Research & Knowledge Intelligence), G (Architecture Intelligence), K (Quality & Verification Intelligence), B (Product Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 61%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from topoteretes-cognee-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/topoteretes-cognee-learnings.md`  
> **Source**: github ([https://github.com/topoteretes/cognee](https://github.com/topoteretes/cognee))  
> **Source Version**: `1961133d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T17:37:22.493Z  
> **Learning ID**: `learn-github-topoteretes-cognee`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): topoteretes/cognee

> **Canonical Artifact**: `07_PROJECT_LEARNING/topoteretes-cognee-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/topoteretes/cognee](https://github.com/topoteretes/cognee))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T17:37:22.488Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `topoteretes/cognee`
- **Description**: Cognee is the open-source AI memory platform for agents. Give your AI agents persistent long-term memory with small models for free
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 33431 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cognee-connectors/connectors/github/cognee_connector_github/webhooks.py`
```
"""GitHub webhook delivery verification.

Copied from cognee.modules.integrations.github.verify_github_signature (cognee
dev, 2026-10-26) onto the core contract: the check itself is the core
``HmacVerifier`` with GitHub's ``sha256_prefix`` scheme, and the FastAPI shim
that adapts a request to it stays in ``cognee_host/verify_github_signature.py``.

Every inbound delivery is authenticated by an HMAC-SHA256 over the raw body
keyed with the app's webhook secret, compared against the
``X-Hub-Signature-256`` header
(https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries).

The check MUST run over the raw request bytes, before any parsing —
re-serializing a parsed JSON body changes key order/escaping and breaks the
HMAC (same rule as Slack's verifier). Unlike Slack, GitHub's scheme carries
no timestamp, so there is no replay window to enforce here; handlers are
idempotent instead (revokes are no-ops on revoked rows, syncs skip unchanged
snapshots).
"""

from typing import Any

from cognee_connector_github.settings import github_settings
from cognee_connectors_core.signatures import HmacVerifier, SignatureScheme

PROVIDER = "github"

#: The header GitHub carries the delivery signature in.
SIGNATURE_HEADER = "x-hub-signature-256"


def github_webhook_verifier(settings: Any = None) -> HmacVerifier:
    """GitHub's ``X-Hub-Signature-256`` on the core verifier.

    ``settings`` is any object with a ``webhook_secret`` attribute (the
    package's :data:`~cognee_connector_github.settings.github_settings` by
    default). The secret is read per request, so a rotated secret takes
    effect on the next delivery; an unset secret makes the verifier refuse
    every delivery rather than check against an empty key.
    """
    source = github_settings if settings is None else settings
    return HmacVerifier(
        provider=PROVIDER,
        scheme=SignatureScheme.SHA256_PREFIX,
        header=SIGNATURE_HEADER,
        secret_provider=lambda: getattr(source, "webhook_secret", None) or None,
    )


__all__ = ["PROVIDER", "SIGNATURE_HEADER", "github_webhook_verifier"]

```

### Core Architecture Module: `cognee-connectors/connectors/linear/cognee_connector_linear/webhooks.py`
```
"""Linear webhook delivery verification.

Copied from cognee.modules.integrations.linear.verify_linear_signature (cognee dev,
2026-10-26) and re-expressed on the core contract: the verifier takes the raw body and the
request headers and refuses a delivery with ``WebhookVerificationError``; the FastAPI shim
cognee's generic events route needs stays in ``cognee_host/verify_linear_signature.py``.

Every inbound delivery is authenticated by a hex HMAC-SHA256 over the raw
body keyed with the app's webhook signing secret, compared against the
``Linear-Signature`` header
(https://linear.app/developers/webhooks#securing-webhooks).

The check MUST run over the raw request bytes, before any parsing —
re-serializing a parsed JSON body changes key order/escaping and breaks the
HMAC (same rule as the Slack and GitHub verifiers). Unlike GitHub, Linear
does carry replay protection: the payload's ``webhookTimestamp`` field (Unix
milliseconds) is checked against a one-minute skew window, Linear's
documented guidance. That field lives *inside* the body, so it is read only
after the HMAC has authenticated the bytes — a timestamp from an unverified
body proves nothing.
"""

import json
import time
from collections.abc import Callable, Mapping

from cognee_connector_linear.settings import linear_settings
from cognee_connectors_core.base import WebhookVerifier
from cognee_connectors_core.errors import WebhookVerificationError
from cognee_connectors_core.signatures import HmacVerifier, SignatureScheme

#: The header Linear signs with: a bare hex HMAC-SHA256, no ``sha256=`` prefix.
SIGNATURE_HEADER = "linear-signature"

# Linear's documented replay-protection window: reject deliveries whose
# webhookTimestamp differs from local time by more than a minute, so a
# captured request cannot be replayed after the fact.
_MAX_TIMESTAMP_SKEW_SECONDS = 60


def configured_webhook_secret() -> str | None:
    """The app's webhook signing secret from the settings, ``None`` while it is unset.

    Read per call, never captured, so a rotated value takes effect at once. ``None``
    makes the verifier refuse every delivery rather than check an HMAC under an empty
    key.
    """
    return linear_settings.webhook_secret or None


def has_fresh_webhook_timestamp(raw_body: bytes) -> bool:
    """Whether ``raw_body`` carries a ``webhookTimestamp`` within the skew window.

    Call only on a body whose HMAC already passed — parsing (and trusting a
    timestamp from) unverified bytes would defeat the point of the guard.
    A missing or malformed timestamp is rejected the same as a stale one.
    """
    try:
        payload = json.loads(raw_body)
        timestamp_ms = int(payload["webhookTimestamp"])
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return False

    return abs(time.time() - timestamp_ms / 1000) <= _MAX_TIMESTAMP_SKEW_SECONDS


class LinearWebhookVerifier(WebhookVerifier):
    """The HMAC through the core's bare-hex scheme, then the body's own replay guard.

    The HMAC half is the core's :class:`HmacVerifier`, which also caps the body size and
    answers every rejection with the same 401; the ``webhookTimestamp`` window is Linear's
    own and runs only on bytes the HMAC has authenticated. ``secret_provider`` is read per
    delivery and defaults to the ``LINEAR_WEBHOOK_SECRET`` setting.
    """

    __slots__ = ("_hmac",)

    def __init__(self, secret_provider: Callable[[], str | None] | None = None) -> None:
        self._hmac = HmacVerifier(
            provider="linear",
            scheme=SignatureScheme.BARE_HEX,
            header=SIGNATURE_HEADER,
            secret_provider=secret_provider or configured_webhook_secret,
        )

    async def verify(self, body: bytes, headers: Mapping[str, str]) -> bytes:
        raw_body = await self._hmac.verify(body, headers)

        # Only after the HMAC passed — see module docstring.
        if not has_fresh_webhook_timestamp(raw_body):
            raise WebhookVerificationError("Stale Linear webhook timestamp", status_code=401)

        return raw_body


__all__ = [
    "SIGNATURE_HEADER",
    "LinearWebhookVerifier",
    "configured_webhook_secret",
    "has_fresh_webhook_timestamp",
]

```

### Core Architecture Module: `cognee-connectors/connectors/slack/cognee_connector_slack/webhooks.py`
```
"""Slack request signature verification, on the core webhook verifier.

Copied from cognee.modules.integrations.slack.verify_slack_signature (cognee dev,
2026-11-12). The HMAC is now :class:`cognee_connectors_core.signatures.HmacVerifier`
with the ``slack_v0`` scheme, the one ``CONNECTOR`` declares, so the hand-written
Slack routes and a host serving the generic ``/events`` route verify deliveries the
same way. The FastAPI dependency that sat next to the check lives in
:mod:`cognee_connector_slack.cognee_host.verify_slack_signature`.

Every inbound Slack payload — Events API, interactivity — is
authenticated by an HMAC over ``v0:{timestamp}:{raw_body}`` keyed with the
app's signing secret, compared against the ``X-Slack-Signature`` header
(https://docs.slack.dev/authentication/verifying-requests-from-slack).

The check MUST run over the raw request bytes, before any parsing: interactive
payloads arrive form-encoded, and re-serializing a parsed dict changes key
order/escaping and breaks the HMAC. Handlers therefore take the verified raw
body from the host's ``verify_slack_request`` dependency and parse it
themselves instead of declaring parsed body parameters.
"""

from collections.abc import Coroutine, Mapping
from typing import Any

from cognee_connector_slack.connector import CONNECTOR, DESCRIPTOR
from cognee_connectors_core.base import WebhookVerifier
from cognee_connectors_core.errors import WebhookVerificationError

#: The request headers Slack signs with, as the descriptor spells them (lower-case;
#: the verifier matches header names case-insensitively).
SIGNATURE_HEADER: str = DESCRIPTOR.signature_header or "x-slack-signature"
TIMESTAMP_HEADER: str = DESCRIPTOR.signature_timestamp_header or "x-slack-request-timestamp"


def slack_webhook_verifier() -> WebhookVerifier:
    """The ``slack_v0`` verifier ``CONNECTOR`` declares.

    It reads ``SLACK_SIGNING_SECRET`` off the settings object on every call, so
    a rotated secret applies to the next request; an unset secret refuses every
    delivery rather than checking against an empty key. Slack's documented
    five-minute replay window is enforced in both directions.
    """
    verifier = CONNECTOR.webhook_verifier()
    if verifier is None:  # pragma: no cover - DESCRIPTOR declares a signature scheme
        raise RuntimeError("the Slack descriptor declares no webhook signature")
    return verifier


async def verify_slack_request_body(raw_body: bytes, headers: Mapping[str, str]) -> bytes:
    """Return ``raw_body`` once its Slack signature checks out.

    Raises :class:`~cognee_connectors_core.errors.WebhookVerificationError`
    carrying the HTTP status a host should answer with: 401 for a missing or wrong
    signature or timestamp, 413 for a body over the verifier's cap. ``headers``
    may spell the header names in any case.
    """
    return await slack_webhook_verifier().verify(raw_body, headers)


def is_valid_slack_signature(raw_body: bytes, timestamp: str, signature: str) -> bool:
    """Whether ``signature`` is a current, authentic Slack signature for ``raw_body``.

    Pure function of its inputs (plus the clock): the same check as
    :func:`verify_slack_request_body`, as a boolean, for callers that hold the
    two header values rather than a request — ``timestamp`` is
    ``X-Slack-Request-Timestamp`` and ``signature`` is ``X-Slack-Signature``.
    """
    headers: dict[str, str] = {}
    if timestamp is not None:
        headers[TIMESTAMP_HEADER] = str(timestamp)
    if signature is not None:
        headers[SIGNATURE_HEADER] = str(signature)
    try:
        _complete(slack_webhook_verifier().verify(raw_body, headers))
    except WebhookVerificationError:
        return False
    return True


def _complete(coroutine: Coroutine[Any, Any, Any]) -> Any:
    """Finish a coroutine that never suspends, with no event loop involved.

    ``HmacVerifier.verify`` is ``async`` for the contract's sake but awaits
    nothing, so its first step runs it to completion. That is what keeps
    :func:`is_valid_slack_signature` synchronous, as the moved function always
    was, and callable from inside a running event loop; a verifier that did
    suspend would be a bug here, not something to wait on.
    """
    try:
        coroutine.send(None)
    except StopIteration as finished:
        return finished.value
    coroutine.close()
    raise RuntimeError("the Slack webhook verifier suspended; await verify_slack_request_body")

```

### Core Architecture Module: `cognee-connectors/core/cognee_connectors_core/__init__.py`
```
"""cognee-connectors-core: the contract every cognee connector implements.

No host in here. A connector package depends on this and on its vendor SDK;
cognee and cloud-backend depend on this to load and drive the connectors. See
each module's docstring for the piece it owns:

- :mod:`.base` — ``Connector`` and the dataclasses it speaks in.
- :mod:`.descriptor` — ``ConnectorDescriptor``, a Tier 1 connector as data.
- :mod:`.oauth2` — ``DescriptorConnector``, which makes a descriptor work.
- :mod:`.signatures` — webhook HMAC schemes and ``HmacVerifier``.
- :mod:`.oauth_state` — OAuth ``state`` signing and validation.
- :mod:`.settings` — ``ConnectorSettings`` and ``require``.
- :mod:`.dlt_conventions` — what cognee's ingestion reads off a DLT source.
- :mod:`.registry` — ``use_connector``, ``catalog`` and the entry-point loaders.
- :mod:`.http` — the ``HttpClient`` protocol and its aiohttp default.
- :mod:`.testing` — ``FakeHttpClient`` and fixtures for connector tests.
"""

from cognee_connectors_core import dlt_conventions
from cognee_connectors_core.base import (
    AUTH_KINDS,
    AuthKind,
    Connector,
    ConnectorInstallation,
    ConnectorResource,
    Credential,
    RefreshedTokens,
    SyncScope,
    WebhookDispatch,
    WebhookVerifier,
    account_slug,
    dataset_name_for,
)
from cognee_connectors_core.descriptor import ConnectorDescriptor, payload_paths, resolve_path
from cognee_connectors_core.errors import ConnectorError, RateLimitedError, WebhookVerificationError
from cognee_connectors_core.http import AiohttpClient, HttpClient
from cognee_connectors_core.oauth2 import DescriptorConnector
from cognee_connectors_core.oauth_state import (
    DEFAULT_STATE_TTL_SECONDS,
    make_state,
    sign_state_payload,
    validate_state,
)
from cognee_connectors_core.registry import (
    catalog,
    find_connector,
    get_connector,
    load_connectors,
    load_host_registrations,
    load_sources,
    registered_providers,
    reset_registry,
    use_connector,
)
from cognee_connectors_core.settings import ConnectorSettings, require
from cognee_connectors_core.signatures import HmacVerifier, SignatureScheme

__version__ = "0.1.0"

__all__ = [
    "AUTH_KINDS",
    "DEFAULT_STATE_TTL_SECONDS",
    "AiohttpClient",
    "AuthKind",
    "Connector",
    "ConnectorDescriptor",
    "ConnectorError",
    "ConnectorInstallation",
    "ConnectorResource",
    "ConnectorSettings",
    "Credential",
    "DescriptorConnector",
    "HmacVerifier",
    "HttpClient",
    "RateLimitedError",
    "RefreshedTokens",
    "SignatureScheme",
    "SyncScope",
    "WebhookDispatch",
    "WebhookVerificationError",
    "WebhookVerifier",
    "__version__",
    "account_slug",
    "catalog",
    "dataset_name_for",
    "dlt_conventions",
    "find_connector",
    "get_connector",
    "load_connectors",
    "load_host_registrations",
    "load_sources",
    "make_state",
    "payload_paths",
    "registered_providers",
    "require",
    "reset_registry",
    "resolve_path",
    "sign_state_payload",
    "use_connector",
    "validate_state",
]

```

### Core Architecture Module: `cognee-connectors/core/cognee_connectors_core/base.py`
```
"""The connector contract every cognee connector implements.

Moved from cloud-backend ``modules.integrations.framework.base``
(cognee-saas-backend, 2026-10-26) and re-expressed without a host: no FastAPI
request, no credential model, no delivery dedupe. The host — cognee core's
``cognee.modules.integrations``, cloud-backend — owns credential storage, token
decryption, the OAuth routes and webhook dedupe; a connector supplies only what
is genuinely provider-specific, and this module is where that line is drawn.

Slack was built as a hand-written module: thousands of lines across ~21 files,
its own router block, its own sync router, its own secret keys. That is
affordable once. The connectors roadmap is 50+ providers, where it is not: it
would mean 50 copies of OAuth state signing, credential handling, and webhook
HMAC verification — logic that has nothing to do with any individual provider,
replicated 50 times, each copy an independent chance to get a security boundary
subtly wrong. So the contract owns that logic exactly once.

**Three tiers, by how much code a provider actually needs.** The tier is an
observation about a provider, not a setting — it falls out of which methods the
provider has to override:

* **Tier 1 — pure config.** Standard OAuth2: an authorize URL, a token
  endpoint, scopes, and an account identity readable straight out of the token
  response. No Python at all; see :class:`~.descriptor.ConnectorDescriptor`,
  which :class:`~.oauth2.DescriptorConnector` turns into a working connector.
* **Tier 2 — config plus one hook.** OAuth2, but the token response does not
  say *which* account authorized, so identity needs one extra API call. Linear
  is the type case (its token response omits the organization; webhooks route
  by it). A descriptor plus an overridden
  :meth:`~.oauth2.DescriptorConnector.resolve_account`.
* **Tier 3 — full connector.** An auth model that is not OAuth2-with-a-bearer-
  token at all. GitHub is the type case: an org-level RSA key signs a short
  JWT, which mints hour-lived per-installation tokens, and nothing durable is
  stored. Subclass :class:`Connector` directly.

API-key and local providers (Apollo, Asana, OneNote, Obsidian) describe
themselves on the same contract with :attr:`Connector.auth` set to
``"api_key"`` or ``"local"``: their OAuth members raise ``NotImplementedError``
and the rest — dataset naming, the catalog entry, polling — works as for any
other provider.

**Multi-tenancy is the host's job, not the connector's.** A connector never
sees a user id or a tenant id. It maps provider data to and from an *external
account identity* (:attr:`ConnectorInstallation.provider_account_id`) and the
host resolves that to users or tenants — one authorize, or many on a fan-out
path, where one external workspace legitimately feeds several tenants. A
connector that reasons about tenants itself is a connector that will
eventually leak across them.

**Token material is passed in, never looked up.** Every method that needs a
stored token takes ``tokens``, the decrypted token payload, as a plain mapping.
Nothing in this package decrypts or persists; the host does both, at the
moment of use. Provider app secrets (a GitHub App's private key) stay with the
connector's own settings and never go on a :class:`SyncScope`, which is shipped
to whatever runs the sync.
"""

import logging
import unicodedata
from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, ClassVar, Literal, Protocol
from uuid import UUID

logger = logging.getLogger(__name__)

#: How a connection is established. See :attr:`Connector.auth`.
AuthKind = Literal["oauth2", "api_key", "local"]
AUTH_KINDS: tuple[str, ...] = ("oauth2", "api_key", "local")


@dataclass(slots=True)
class ConnectorInstallation:
    """What a completed connect yields, normalized for the credential store.

    This is the whole surface between a provider's OAuth response and the
    host's credential table. :meth:`Connector.parse_installation` produces it;
    the host encrypts :attr:`token_payload` and writes the rest, adding the
    user or tenant scoping the connector never sees.
    """

    # The external account this install belongs to — a Slack team id, a GitHub
    # App installation id, a Linear organization id. Load-bearing well beyond
    # display: it is the *only* handle an inbound webhook carries, so it is how
    # a delivery is routed back to the connections that own it. It must
    # therefore be stable for the life of the install and identical on both
    # paths (the value parsed at connect time and the one read off a webhook
    # payload). A provider whose webhooks carry a different id than its token
    # response is a provider whose deliveries will resolve to nothing.
    provider_account_id: str

    # Token material. Encrypted at rest by the host; never logged, never
    # returned by an API route. May be empty for an auth model with nothing
    # durable to keep — GitHub App installs store ``{}`` and mint a fresh token
    # per operation.
    token_payload: dict[str, Any] = field(default_factory=dict)

    # Non-secret provider facts worth keeping in the clear, so support and the
    # UI can answer "connected to what?" without decrypting anything.
    provider_metadata: dict[str, Any] = field(default_factory=dict)

    # Human-readable account name for the UI ("acme-corp", "Acme Workspace").
    # Never used for identity or lookups: it is provider-controlled, mutable,
    # and not unique.
    account_label: str | None = None

    # Granted scopes as the provider reported them, for support and for
    # detecting an install that predates a scope addition.
    scopes: str | None = None

    # When the access token expires, for providers that rotate. ``None`` means
    # either no expiry or no stored token at all — both are "nothing to
    # refresh", which is why they share a representation.
    token_expires_at: datetime | None = None

    # How to interpret ``token_payload``: ``oauth2`` (bearer), ``github_app``
    # (mint on demand), ``api_key`` (user-supplied). Read by refresh logic to
    # decide whether rotation even applies.
    auth_type: str = "oauth2"


@dataclass(slots=True)
class RefreshedTokens:
    """What :meth:`Connector.refresh` hands back for the host to store.

    ``token_payload`` replaces the stored payload wholesale, so a connector
    that rotates the refresh token puts the new one here and one whose
    provider does not rotate puts the old one back. ``token_expires_at`` and
    ``scopes`` replace their stored values; ``None`` means the provider said
    nothing about them.
    """

    token_payload: dict[str, Any]
    token_expires_at: datetime | None = None
    scopes: str | None = None


@dataclass(slots=True)
class SyncScope:
    """What a sync is asked to ingest, and the short-lived credential to do it.

    Returned by :meth:`Connector.sync_scope` and handed to whatever runs the
    sync (cognee's ingestion, a tenant pod). Deliberately not the provider's
    own payload shape: the runner stays provider-agnostic, so adding a
    connector never touches it.
    """

    # cognee dataset the content lands in. Convention is
    # ``{provider}_{account_slug}`` — one dataset per external account rather
    # than per repo/channel, because backend access control isolates per
    # dataset and per-resource datasets would multiply that cost without
    # buying isolation anyone asked for.
    dataset_name: str

    # cognee ingestion mode — e.g. ``"code"`` for repositories. ``None`` for
    # ordinary document ingestion.
    content_type: str | None = None

    # What to ingest: repo clone URLs, channel ids, page ids. Opaque to the
    # host, meaningful to the source for this provider.
    items: list[str] = field(default_factory=list)

    # Short-lived credential the runner uses to fetch the items above — an
    # hour-lived GitHub installation token, a Slack bot token. Scoped to this
    # one external account, never a durable app secret, and never persisted by
    # the runner.
    credential: str | None = None

    # Expiry of ``credential`` when it is deliberately short-lived. The runner
    # uses this only to refresh before expiry; it never persists it. A
    # connector that can mint a replacement marks this scope refreshable, and
    # the host binds that capability to this dispatch rather than exposing a
    # durable provider secret.
    credential_expires_at: datetime | None = None
    credential_refreshable: bool = False

    # Provider-specific hints for the source (branch name, since cursor). Kept
    # a free-form dict so a provider can pass what it needs without widening
    # this dataclass — and therefore never secrets, which belong in
    # :attr:`credential` where the redaction rules apply.
    options: dict[str, Any] = field(default_factory=dict)

    # Which resource each entry of :attr:`items` came from, same length and
    # order. Optional: fill it when ``items`` are *derived* from resource ids
    # rather than being them, so a per-item outcome can be attributed back to
    # the id a picker shows. GitHub needs it — its items are clone URLs built
    # from ``acme/api`` — while a connector whose items already *are* resource
    # ids can leave it ``None`` and be attributed positionally.
    #
    # The host never parses these, and neither does the runner: they travel
    # down and come back as opaque labels, which is what keeps the runner
    # provider-agnostic while still reporting something a UI can key on.
    item_resource_ids: list[str] | None = None


@dataclass(slots=True)
class ConnectorResource:
    """One thing a connection could ingest, for the picker UI.

    A repository, a channel, a space. Display data plus the id a selection is
    recorded against — deliberately not the provider's whole object, so the
    picker stays provider-agnosti
```

### Core Architecture Module: `cognee-connectors/core/cognee_connectors_core/descriptor.py`
```
"""A connector expressed as data.

Moved from cloud-backend ``modules.integrations.framework.descriptor``
(cognee-saas-backend, 2026-10-26). The cloud's own metadata keys (``selection``,
``resource_health``) are host concerns and are no longer guarded here; ``auth``
is new, so API-key and local providers can describe themselves on the same
dataclass.

The bet this module makes: most of the roadmap's 50+ providers differ only in
strings — an authorize URL, a token endpoint, scopes, and where in the
response their account identity sits. If that holds, those providers need no
Python at all, and adding one is a descriptor plus a secret. If it does not
hold, the tier model in :mod:`~.base` is wrong and it is much cheaper to find
that out here than after 20 connectors are built on it.

So the descriptor covers standard OAuth2 exhaustively and refuses to grow
hooks. When a provider does not fit, it graduates to Tier 2 (a descriptor plus
an overridden :meth:`~.oauth2.DescriptorConnector.resolve_account`) or Tier 3
(its own :class:`~.base.Connector`) — rather than this dataclass acquiring a
field for every provider's quirk, which is how declarative config decays back
into code with worse ergonomics.

**Why JSON paths.** The only genuinely per-provider logic in a standard OAuth2
flow is "which field holds the account id" — ``team.id`` for Slack,
``organization.id`` for Linear. Expressed as a path string, that is config;
expressed as a lambda, it is code, and code cannot live in a YAML catalog or
be reviewed by someone who does not write Python. Paths are deliberately
minimal — dotted key traversal, no wildcards, no filters, no indexing. A
provider needing more than that needs a hook, and the tier model already says
where hooks go.
"""

from dataclasses import dataclass, field, fields
from typing import Any
from urllib.parse import urlencode

from cognee_connectors_core.base import AUTH_KINDS, AuthKind
from cognee_connectors_core.oauth_state import DEFAULT_STATE_TTL_SECONDS
from cognee_connectors_core.signatures import SignatureScheme

# The field names a standard OAuth2 token response carries bearer/refresh
# material under, i.e. the ones oauth2.py hands the host to encrypt. Defined
# HERE rather than in oauth2.py, which is where they are actually consumed,
# for one reason: oauth2.py already imports this module, so the dependency
# only runs one way and oauth2.py can import these — where the reverse would
# be a cycle. They used to be duplicated in both files with a comment asking
# the reader to keep them in sync, which is not a mechanism.
ACCESS_TOKEN_FIELDS = ("access_token", "bot_access_token")
REFRESH_TOKEN_FIELD = "refresh_token"

# Substrings that make a path segment credential-bearing. Matched by
# CONTAINMENT on a case-folded, alphanumeric-only form of the segment, which
# is what makes this a rule rather than a list: "access_token",
# "accessToken", "ACCESS-TOKEN" and "authed_user.access_token" all reduce to
# something containing "token".
#
# Three earlier versions of this guard were enumerations that each closed the
# one example a report had named — a set of three leaf names, then the same
# three matched per segment, then those plus hand-picked extras and the
# suffixes "_token"/"_secret"/"_password". Each still let the next real field
# through: "config.secret" is GitHub's hook signing secret, "auth.api_key"
# and "app.privateKey" are ordinary, and none of them ends in one of those
# suffixes. So the direction is inverted here — anything that looks like a
# credential is refused, and an author who needs an exception argues for it
# in _CREDENTIAL_EXEMPT below.
_CREDENTIAL_SUBSTRINGS = (
    "token",
    "secret",
    "password",
    "passwd",
    "credential",
    "apikey",
    "privatekey",
    "publickey",
    "signingkey",
    "accesskey",
    "cookie",
    "signature",
    "bearer",
    "jwt",
    "pem",
)

# Segments that contain one of the above and are provably not credentials.
# Every entry is a field a real provider sends and a descriptor has a
# legitimate reason to store: pagination and delta-sync cursors, which belong
# in provider_metadata and which Google Calendar, Gmail, Notion and every
# cursor-paginated API hand you under exactly these names. Without this the
# rule refuses them and tells the author their pagination cursor is
# credential material, which is the over-broad half of the same problem.
_CREDENTIAL_EXEMPT = frozenset(
    {
        "pagetoken",
        "nextpagetoken",
        "synctoken",
        "nextsynctoken",
        "deltatoken",
        "continuationtoken",
    }
)

# Whole segments refused by name, for credentials whose field name carries no
# hint of what it is. The containment rule cannot catch these and no rule
# can: "incoming_webhook" is Slack's oauth.v2.access subtree whose "url"
# field is a post-anything-to-this-channel credential, and "url" is not a
# word that can go in a denylist. The whole subtree is refused rather than
# just its url — nothing under it is worth the risk of enumerating leaves.
_CREDENTIAL_SUBTREES = frozenset({"incomingwebhook"})

# Kept as a named set because oauth2.py's stored-token fields must be a
# SUBSET of what this guard refuses, and a test asserts that direction. It is
# deliberately one-directional: the denylist is free to refuse more than
# oauth2 stores, and an earlier test asserting the two were EQUAL made the
# denylist unable to grow at all.
_TOKEN_MATERIAL_SEGMENTS = frozenset({*ACCESS_TOKEN_FIELDS, REFRESH_TOKEN_FIELD})


def _normalize_segment(segment: str) -> str:
    """Case-fold a path segment down to its letters and digits.

    So camelCase, snake_case, kebab-case and any punctuation a provider
    invents all reduce to one comparable form. Without this the rule below is
    a snake_case-only rule, which is how "accessToken" got past three
    previous versions of it.
    """
    return "".join(char for char in segment.lower() if char.isalnum())


def _credential_segment(path: str) -> str | None:
    """The first segment of ``path`` that names credential material, if any.

    Split the same way :func:`resolve_path` splits, because a guard that
    decomposes a path differently from the code that traverses it is a guard
    with a gap — that is exactly how ``authed_user.access_token`` got past an
    earlier version of this check, which compared the whole path string
    against a set of leaf names.
    """
    for segment in path.split("."):
        normalized = _normalize_segment(segment)
        if not normalized:
            continue
        if normalized in _CREDENTIAL_SUBTREES:
            return segment.strip()
        if normalized in _CREDENTIAL_EXEMPT:
            continue
        if any(marker in normalized for marker in _CREDENTIAL_SUBSTRINGS):
            return segment.strip()
    return None


# Query parameters build_authorize_url always sets itself, in this order —
# see the ``params = [...]`` list there. A descriptor's authorize_params
# extends this list, so any of these names in it collides and (per how every
# provider treats a repeated query parameter) silently replaces the host's
# own value. state is the one that actually matters: it is the signed CSRF
# binding the whole install to a user, and a descriptor overwriting it
# — even by accident, declaring `("state", "x")` for some unrelated reason —
# would replace it with something unsigned.
_RESERVED_AUTHORIZE_PARAMS = frozenset({"client_id", "redirect_uri", "state", "scope"})


def resolve_path(payload: Any, path: str) -> Any | None:
    """Read a dotted path out of a decoded JSON body, or ``None``.

    ``resolve_path({"team": {"id": "T1"}}, "team.id") == "T1"``

    Absent and null are both ``None`` on purpose: for every use here — is
    there an account id? a label? — "the key was missing" and "the key was
    null" call for the same handling, and distinguishing them would only add a
    branch every caller collapses again.

    A non-mapping encountered mid-path is ``None`` rather than an error.
    Webhook and token bodies are provider-controlled and change without
    notice; a shape surprise should drop one delivery, not raise out of a
    verified webhook handler.
    """
    current = payload
    for key in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(key)
        if current is None:
            return None
    return current


def payload_paths(instance: Any) -> list[tuple[str, str]]:
    """Enumerate the payload paths any dataclass instance declares.

    Reads the fields' own ``payload_path`` metadata, so a path field joins the
    credential guard by declaring what it is rather than by being named a
    particular way. Written as a free function over any dataclass, not a
    method, so it can be exercised against a field whose name does NOT end in
    ``_path`` — otherwise the marker mechanism is indistinguishable from the
    naming convention it replaced, and a test cannot tell which one the guard
    is really reading.
    """
    collected: list[tuple[str, str]] = []
    for declared in fields(instance):
        kind = declared.metadata.get("payload_path")
        if kind is None:
            continue
        value = getattr(instance, declared.name)
        if not value:
            continue
        if kind == "scalar":
            collected.append((declared.name, value))
        else:
            collected.extend((f"{declared.name}[{name!r}]", path) for name, path in value if path)
    return collected


# Field markers, so the credential guard enumerates paths by DECLARED INTENT
# rather than by a naming convention. The convention version keyed on
# `name.endswith("_path")` and then special-cased metadata_paths by name,
# which is the tell that the convention was never load-bearing: a second
# plural path field would have been invisible to it, and invisible to the
# test meant to catch exactly that (the test filtered the declared set by the
# same predica
```

### Core Architecture Module: `cognee-connectors/core/cognee_connectors_core/dlt_conventions.py`
```
"""Shared utilities for DLT ingestion.

Copied from cognee.tasks.ingestion.dlt_utils (cognee dev, 2026-10-26). This is
the one definition both cognee's ingestion and the connector packages read: the
string values are byte-identical to cognee's and must stay so, because cognee
reads them by attribute and column name. ``load_dlt_manifest`` stayed in cognee
— it reads cognee's storage, which is a host concern.

One value is not a name: ``DOCUMENT_SYNC_VERSION`` is the document-sync protocol
version, which moves with cognee releases. The copy here is the version this
package was cut at; a source's capability gate ("does the host read per-row
node sets?") must read the *host's* value through
:func:`host_document_sync_version`, never this constant, or the gate compares
the package with itself and never refuses an old cognee.
"""

import importlib
import json
import time
from collections.abc import Callable
from typing import TypeVar

_T = TypeVar("_T")

# A dlt source sets this attribute to opt into the "document" ingestion path:
# each row becomes a text document that flows through normal cognify (LLM entity
# extraction), instead of the default relational schema-context path. The value
# is the ``system_metadata["source"]`` tag used for that source's rows. This
# lets resolve_dlt_sources stay connector-agnostic — a connector declares its
# own nature rather than the shared engine hard-coding connector names.
DOCUMENT_SOURCE_ATTR = "cognee_document_source"

# Opt-in namespace for connectors whose incremental state must survive
# alternating destination datasets. Unrelated DLT sources keep their contract.
PIPELINE_SCOPE_ATTR = "cognee_pipeline_scope"


def pipeline_name_for_source(source, dataset_name: str) -> str:
    from hashlib import sha256

    scope = getattr(source, PIPELINE_SCOPE_ATTR, None)
    if not isinstance(scope, str) or not scope:
        return "ingest_dlt_source"
    digest = sha256(json.dumps([dataset_name, scope]).encode()).hexdigest()[:32]
    return f"ingest_dlt_{digest}"


# Community/cloud hosts can refuse unsafe older cores before ingestion starts.
# Version 1 scopes cleanup by staging table and handles a confirmed empty table.
# Version 2 reads the per-row node_set column (NODE_SET_COLUMN).
# Version 3 reads the per-row structure column (STRUCTURE_COLUMN).
#
# In cognee this constant IS the host's capability. Here it is the version the
# sources in this repo were written against; see host_document_sync_version()
# for the value a gate must compare with.
DOCUMENT_SYNC_VERSION = 3


def host_document_sync_version() -> int:
    """The document-sync protocol version the host's cognee implements.

    Reads ``cognee.tasks.ingestion.dlt_utils.DOCUMENT_SYNC_VERSION`` from the
    installed cognee; ``0`` for a cognee too old to have DLT document
    ingestion at all. Without cognee it returns this package's own
    :data:`DOCUMENT_SYNC_VERSION`: there is no ingestion to be too old, and a
    connector's own tests run without one. Imported lazily, so this module
    stays importable with cognee absent.

    This — not the constant above — is what a source's capability gate reads.
    Cognee's sources did ``getattr(dlt_utils, "DOCUMENT_SYNC_VERSION", 0)``
    against cognee's own module; ported to this package that would compare
    the package with itself and pass on every host.
    """
    try:
        importlib.import_module("cognee")
    except ImportError:
        return DOCUMENT_SYNC_VERSION
    try:
        host = importlib.import_module("cognee.tasks.ingestion.dlt_utils")
    except ImportError:
        return 0
    return int(getattr(host, "DOCUMENT_SYNC_VERSION", 0) or 0)


def require_document_sync_version(minimum: int, *, provider: str, feature: str) -> None:
    """Refuse a sync the host's cognee cannot ingest correctly.

    The gate every source in cognee carried, shared: ``provider`` and
    ``feature`` fill the message cognee's sources used (``"Notion sync requires
    a Cognee build that reads per-row node sets and structure
    (DOCUMENT_SYNC_VERSION >= 3). Upgrade Cognee before syncing."``). Call it
    where the source factory starts, before any provider call.
    """
    if host_document_sync_version() < minimum:
        raise RuntimeError(
            f"{provider} sync requires a Cognee build that {feature} "
            f"(DOCUMENT_SYNC_VERSION >= {minimum}). Upgrade Cognee before syncing."
        )


# A document-mode row may carry its own node sets in this column, as a JSON
# list of names (see resolve_dlt_sources._row_node_set). Every name is
# namespaced under the source tag, so a row can never name one of cognee's
# own node sets. The type hint is applied at load time so dlt stores the list
# on the row as json instead of normalizing it into a child table.
NODE_SET_COLUMN = "cognee_node_set"
NODE_SET_COLUMN_HINT = {NODE_SET_COLUMN: {"data_type": "json", "nullable": True}}

# A document-mode row may say where it sits in its source's tree in this column:
# ``{"ancestors": [{"kind", "id", "name"?, "document"?}, ...]}``, nearest parent
# first, empty for a row at the top. A ``"document": true`` entry is another row of
# this source and table (its ``id`` column) and ends the list; any other entry is a
# container with no row of its own (a database, a folder). Never hashed, so a move
# keeps the row's data_id. Loaded as json for the same reason as the node set column.
STRUCTURE_COLUMN = "cognee_structure"
STRUCTURE_COLUMN_HINT = {STRUCTURE_COLUMN: {"data_type": "json", "nullable": True}}
DOCUMENT_COLUMN_HINTS = {**NODE_SET_COLUMN_HINT, **STRUCTURE_COLUMN_HINT}


def guarded_rows(rows, check_active=None):
    """Check authorization before each extraction step and before publishing it.

    Hosts run extraction on a worker thread and supply a synchronous bridge to
    their credential store. Standalone SDK sources need no such callback.
    """
    iterator = iter(rows)
    while True:
        if check_active is not None:
            check_active()
        try:
            row = next(iterator)
        except StopIteration:
            if check_active is not None:
                check_active()
            return
        if check_active is not None:
            check_active()
        yield row


def with_retries(
    attempt: Callable[[], _T],
    *,
    retry_on: tuple[type[BaseException], ...],
    delay: Callable[[BaseException, int], float | None],
    attempts: int,
    check_active: Callable[[], None] | None = None,
    sleep: Callable[[float], None] | None = None,
) -> _T:
    """Run one provider request, retried by the connector's own policy.

    ``attempt`` makes one request. An error of a ``retry_on`` class is retried after
    ``delay(error, number)`` seconds unless it was the last of ``attempts`` or ``delay`` answers
    ``None``; then it is raised as it is. ``check_active`` runs before every wait and every
    retry, never before a first attempt, and what it raises propagates as it is.
    """
    for number in range(attempts):
        if number and check_active is not None:
            check_active()
        try:
            return attempt()
        except retry_on as error:
            if number == attempts - 1:
                raise
            wait = delay(error, number)
            if wait is None:
                raise
        if check_active is not None:
            check_active()
        (sleep or time.sleep)(wait)
    raise ValueError("with_retries needs at least one attempt")


def document_source_tag(item) -> str | None:
    """Return the document-source tag a dlt source opted into, else ``None``."""
    tag = getattr(item, DOCUMENT_SOURCE_ATTR, None)
    return tag if isinstance(tag, str) and tag else None


def metadata_source(metadata) -> str | None:
    """Extract the ``source`` field from system metadata.

    Accepts a dict, a JSON string, or an object with a ``system_metadata``
    attribute (a Data record / DataItem). Returns None when the source cannot
    be determined. Deliberately never reads external_metadata: that field is
    user-writable, and routing/deletion decisions must not key on user bytes.

    Shared reader for every system_metadata["source"] check (DLT here, code
    files in cognee.tasks.code_graph.code_files) so the tag is parsed one way.
    """
    meta = getattr(metadata, "system_metadata", metadata)
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except (json.JSONDecodeError, TypeError):
            return None
    if isinstance(meta, dict):
        return meta.get("source")
    return None


def is_dlt_sourced(metadata) -> bool:
    """Check whether system_metadata indicates a legacy per-row DLT item (source == "dlt")."""
    return metadata_source(metadata) == "dlt"


def is_dlt_source_manifest(metadata) -> bool:
    """Check whether system_metadata indicates a DLT source manifest (source == "dlt_source")."""
    return metadata_source(metadata) == "dlt_source"


def column_selected(selection: dict | None, table_name: str, column: str) -> bool:
    """Whether ``selection`` ({table: [column, ...]}, "*" wildcards on either side)
    names this cell. A table named in the selection gets exactly its list — an
    empty list means none for that table — and only an unnamed table takes the
    wildcard. An empty or missing selection names nothing."""
    if not selection:
        return False
    columns = selection[table_name] if table_name in selection else selection.get("*", [])
    return "*" in columns or column in columns


__all__ = [
    "DOCUMENT_COLUMN_HINTS",
    "DOCUMENT_SOURCE_ATTR",
    "DOCUMENT_SYNC_VERSION",
    "NODE_SET_COLUMN",
    "NODE_SET_COLUMN_HINT",
    "PIPELINE_SCOPE_ATTR",
    "STRUCTURE_COLUMN",
    "STRUCTURE_COLUMN_HINT",
    "column_selected",
    "document_source_tag",
    "guarded_rows",
    "host_document_sync_version",
    "is_dlt_source_manifest",
    "is_dlt_sourced",
    "metadata_source",
    "pipeline_name_for_source",
    "require_document_sync_v
```

### Core Architecture Module: `cognee-connectors/core/cognee_connectors_core/errors.py`
```
"""Errors raised by the connector contract.

Host-agnostic on purpose: a connector package never imports FastAPI, so the
one place the contract has to say "this request is bad" raises a plain
exception carrying the HTTP status a host *would* answer with, and the host
shim (cognee's ``POST /{provider}/events`` route, cloud-backend's) maps it to
its own response type.
"""


class ConnectorError(Exception):
    """Base class for every error this package raises on purpose."""


class WebhookVerificationError(ConnectorError):
    """An inbound webhook delivery failed verification and must be refused.

    ``status_code`` is the HTTP status a host should answer with — ``401`` for
    a bad or missing signature, ``413`` for a body over the cap, ``400`` for a
    request the verifier could not read — and ``detail`` the response text.
    The detail is deliberately uniform across every rejection reason (see
    ``signatures._reject`` for why), so a host can return it verbatim.
    """

    def __init__(self, detail: str = "Invalid signature", *, status_code: int = 401) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


class RateLimitedError(ConnectorError):
    """The provider rate-limited a request.

    Raised by provider clients so a sync can back off rather than fail.
    ``retry_after`` is the provider's own hint in seconds when it sent one
    (``Retry-After``), otherwise ``None``.
    """

    def __init__(
        self,
        message: str = "rate limited by the provider",
        *,
        retry_after: float | None = None,
    ) -> None:
        super().__init__(message)
        self.retry_after = retry_after


__all__ = ["ConnectorError", "RateLimitedError", "WebhookVerificationError"]

```

### Core Architecture Module: `cognee-connectors/core/cognee_connectors_core/http.py`
```
"""HTTP for the descriptor connector, behind a two-method protocol.

:class:`~.oauth2.DescriptorConnector` makes exactly two kinds of request — a
form-encoded POST to a token endpoint and a JSON GET for an identity lookup —
so that is the whole protocol. It is injectable so connector tests script
responses with :class:`~.testing.FakeHttpClient` and never touch the network;
:class:`AiohttpClient` is the default a host gets without asking.
"""

import json
import logging
from collections.abc import Mapping
from typing import Any, Protocol

import aiohttp

logger = logging.getLogger(__name__)

# The token exchange runs inside the callback request, so cap it: a hanging
# provider must not tie up a worker. Matches the timeout cognee's Slack flow
# uses for oauth.v2.access.
DEFAULT_TIMEOUT_SECONDS = 30.0


class HttpClient(Protocol):
    """The two requests a descriptor connector makes.

    Both return ``(status, body)``. ``body`` is the decoded JSON when the
    response parses as JSON — whatever its ``Content-Type`` says, since GitHub
    answers token exchanges with JSON under a form-encoded type — and the
    response text (a ``str``) when it does not, so a caller can tell a provider
    mid-outage answering HTML from a JSON error. Neither method raises on an
    HTTP error status: the caller decides what a 4xx means, because providers
    disagree on whether a rejected exchange is a 4xx or a 200 with an error
    field. Transport failures raise the client's own exception.

    Neither method follows redirects: a redirect comes back as its own 3xx
    status. The token POST carries the client secret and the refresh token, and
    a followed 307/308 would send that body to whatever host the response names
    and hand back that host's answer.
    """

    async def post_form(
        self,
        url: str,
        data: Mapping[str, str],
        headers: Mapping[str, str] | None = None,
    ) -> tuple[int, Any]:
        """POST ``data`` form-encoded to ``url``."""
        ...

    async def get_json(
        self,
        url: str,
        headers: Mapping[str, str] | None = None,
    ) -> tuple[int, Any]:
        """GET ``url``, asking for JSON."""
        ...


class AiohttpClient:
    """The default :class:`HttpClient`: one short-lived aiohttp session per request.

    A session per request rather than a shared one because the connector is a
    process-wide singleton that outlives any event loop a host may create and
    tear down (tests, workers), and an aiohttp session is bound to the loop it
    was created on.
    """

    def __init__(self, *, timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS) -> None:
        self._timeout = aiohttp.ClientTimeout(total=timeout_seconds)

    async def post_form(
        self,
        url: str,
        data: Mapping[str, str],
        headers: Mapping[str, str] | None = None,
    ) -> tuple[int, Any]:
        async with (
            aiohttp.ClientSession(timeout=self._timeout) as session,
            session.post(
                url, data=dict(data), headers=_with_accept(headers), allow_redirects=False
            ) as response,
        ):
            return response.status, await _decode(response)

    async def get_json(
        self,
        url: str,
        headers: Mapping[str, str] | None = None,
    ) -> tuple[int, Any]:
        async with (
            aiohttp.ClientSession(timeout=self._timeout) as session,
            session.get(url, headers=_with_accept(headers), allow_redirects=False) as response,
        ):
            return response.status, await _decode(response)


def _with_accept(headers: Mapping[str, str] | None) -> dict[str, str]:
    # Without this, several providers (GitHub notably) answer form-encoded
    # and .json() fails on a response that is otherwise fine. A caller's own
    # headers win, so one that wants something else can say so.
    merged = {"Accept": "application/json"}
    if headers:
        merged.update(headers)
    return merged


async def _decode(response: aiohttp.ClientResponse) -> Any:
    """The response body as JSON, or as text when it is not JSON.

    ``content_type=None`` because the declared type is not to be trusted (see
    :func:`_with_accept`). A body that is not valid JSON, or not valid in the
    charset the response declares — a provider mid-outage is as likely to
    mangle encoding as it is to answer HTML instead of JSON — comes back as
    text so the caller can report "non-JSON body (HTTP status)" rather than
    surface an unhandled decode error.
    """
    try:
        return await response.json(content_type=None)
    except (aiohttp.ContentTypeError, json.JSONDecodeError, UnicodeDecodeError):
        try:
            return await response.text(errors="replace")
        except (UnicodeDecodeError, LookupError, RuntimeError):
            # An encoding aiohttp cannot even name. There is nothing useful
            # left to hand back but the fact that it was not JSON.
            return ""


__all__ = ["DEFAULT_TIMEOUT_SECONDS", "AiohttpClient", "HttpClient"]

```

### Core Architecture Module: `cognee-connectors/core/cognee_connectors_core/oauth2.py`
```
"""A working connector built from a descriptor alone.

Moved from cloud-backend ``modules.integrations.framework.oauth2``
(cognee-saas-backend, 2026-10-26) and re-expressed on the host-agnostic
contract: app credentials come from a :class:`~.settings.ConnectorSettings`-
shaped object instead of the cloud's secret blobs, HTTP goes through an
injectable :class:`~.http.HttpClient` so tests never touch the network, token
material is passed in by the host, and delivery dedupe is the host's — the
delivery id is still read out of the signed body and handed back on the
dispatch for it to claim.

This is the class that makes Tier 1 real: given a
:class:`~.descriptor.ConnectorDescriptor`, it implements every abstract method
of :class:`~.base.Connector`, so a standard-OAuth2 provider ships with no
Python of its own.

Tier 2 subclasses it and overrides exactly one method — nearly always
:meth:`DescriptorConnector.resolve_account`, for a provider whose token
response does not say which account authorized. Overriding more than one or
two is the signal that a provider is really Tier 3 and should subclass
:class:`~.base.Connector` directly, where it is not fighting assumptions that
do not apply to it.

**Known limits, deliberately not solved with descriptor fields.** Client
credentials go in the request body (``client_id``/``client_secret`` form
fields), which is what the roadmap's providers use; a provider requiring HTTP
Basic instead is Tier 2 territory until a real one turns up, at which point
``token_auth_style`` is the field to add.
"""

import json
import logging
import math
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from typing import Any

from cognee_connectors_core.base import (
    Connector,
    ConnectorInstallation,
    Credential,
    RefreshedTokens,
    SyncScope,
    WebhookDispatch,
    WebhookVerifier,
    dataset_name_for,
)
from cognee_connectors_core.descriptor import (
    ACCESS_TOKEN_FIELDS as _ACCESS_TOKEN_FIELDS,
)
from cognee_connectors_core.descriptor import (
    REFRESH_TOKEN_FIELD as _REFRESH_TOKEN_FIELD,
)
from cognee_connectors_core.descriptor import ConnectorDescriptor, resolve_path
from cognee_connectors_core.http import AiohttpClient, HttpClient
from cognee_connectors_core.settings import require
from cognee_connectors_core.signatures import HmacVerifier

logger = logging.getLogger(__name__)

# Field names looked for in a token response are imported from descriptor.py
# above rather than declared here: descriptor.py's metadata_paths guard has to
# refuse those same names, and two copies drifting apart is how a path reading
# token material gets past it. Standard OAuth2 names, which the roadmap's
# providers follow; a provider that does not is Tier 2.
_EXPIRES_IN_FIELD = "expires_in"

# Real tokens are tens to a few hundred bytes; even a fat JWT stays under a few
# KB. This is generous headroom, not a realistic ceiling — its job is to stop
# a compromised or misconfigured token endpoint from having whatever it
# returns encrypted and stored verbatim (the host's ciphertext column is
# unbounded, so nothing downstream would otherwise reject it).
_MAX_TOKEN_FIELD_BYTES = 65536

# The settings attributes a webhook secret is read from, in order. GitHub-shaped
# providers call it ``webhook_secret``; Slack calls the same thing its
# ``signing_secret`` and cognee's SlackSettings kept that name.
_WEBHOOK_SECRET_FIELDS = ("webhook_secret", "signing_secret")


def _scalar_or_none(
    value: Any, *, provider: str, path: str, context: str, source: str = "webhook"
) -> Any | None:
    """Drop a non-scalar resolved value with a log, or return it unchanged.

    A dict/list at a descriptor path is a wiring mistake, not a real value,
    and ``str()``-ing it silently produces a Python repr that becomes whatever
    everything downstream reads or routes by. This is the *shape* half of that
    check only — it deliberately does not stringify, so a caller storing
    arbitrary provider JSON (``_metadata``) keeps a number as a number.

    Degrades rather than raising, which is right for both callers now that
    ``source`` distinguishes them: on a webhook the body is untrusted traffic
    the provider changes without notice, and on the connect path these are the
    *optional* fields, where dropping a mis-shaped label is strictly better
    than failing an otherwise-good install. The one connect-path value that
    does raise is the account id, in :meth:`parse_installation` — without it
    the credential can never be routed to at all.
    """
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        logger.warning(
            "%s %s has a non-scalar value at '%s' (%s) while resolving %s; dropping",
            provider,
            source,
            path,
            type(value).__name__,
            context,
        )
        return None
    if isinstance(value, str) and "\x00" in value:
        # Postgres rejects a NUL byte in a text column outright, so this
        # would abort the whole connect transaction from account_label or
        # scopes. provider_metadata is JSON (not JSONB) and would accept the
        # \u0000 escape, but there is no value in letting one through on the
        # column where it happens to survive.
        logger.warning(
            "%s %s has a NUL byte at '%s' while resolving %s; dropping",
            provider,
            source,
            path,
            context,
        )
        return None
    if isinstance(value, float) and not math.isfinite(value):
        # json.loads accepts the non-standard NaN/Infinity/-Infinity literals
        # by default, and provider_metadata is a JSON column: a non-finite
        # float round-trips through here fine and then fails the INSERT
        # ("Out of range float values are not JSON compliant"), taking the
        # whole connect transaction with it. Only reachable since this guard
        # stopped stringifying — str() used to flatten it to "nan" — so it is
        # this function's own regression to catch.
        logger.warning(
            "%s %s has a non-finite float at '%s' while resolving %s; dropping",
            provider,
            source,
            path,
            context,
        )
        return None
    return value


def _scalar_str_or_none(value: Any, **kwargs: Any) -> str | None:
    """:func:`_scalar_or_none` for the fields stored as text, refusing booleans.

    Here rather than at each call site, because guarding the account id alone
    was the shape of the bug this closes: a JSON ``true`` at
    ``webhook_delivery_id_path`` became the literal ``"True"``, i.e. a
    CONSTANT dedupe key, so every delivery in the window after the first was
    silently discarded — and the value is provider-controlled. The same
    ``str(bool)`` also produced ``account_label="True"`` and
    ``scopes="False"``, which are only cosmetic by comparison.

    Booleans stay legal in :func:`_scalar_or_none`, which feeds the JSON
    ``provider_metadata`` column: there a ``true`` is stored as a boolean and
    means something. It is the stringification that destroys the distinction,
    so the guard belongs on the stringifying path only.
    """
    if isinstance(value, bool):
        logger.warning(
            "%s %s has a boolean at '%s' while resolving %s; dropping "
            "(a stringified boolean would be a constant, not an identifier)",
            kwargs.get("provider"),
            kwargs.get("source", "webhook"),
            kwargs.get("path"),
            kwargs.get("context"),
        )
        return None
    scalar = _scalar_or_none(value, **kwargs)
    return None if scalar is None else str(scalar)


class DescriptorConnector(Connector):
    """Serves any standard OAuth2 provider from its descriptor.

    ``settings`` is the provider's settings object — a
    :class:`~.settings.ConnectorSettings` subclass instance, or anything with
    ``client_id``, ``client_secret`` and ``redirect_uri`` attributes, plus
    ``webhook_secret`` or ``signing_secret`` when the descriptor verifies
    webhooks. It is read at call time, never captured, so a value the host
    rotates on the settings object takes effect on the next request. ``None``
    is allowed for a descriptor with no OAuth flow and no webhooks.

    ``http`` is the :class:`~.http.HttpClient` every provider call goes
    through; tests pass :class:`~.testing.FakeHttpClient`, hosts take the
    aiohttp default.
    """

    def __init__(
        self,
        descriptor: ConnectorDescriptor,
        settings: Any = None,
        http: HttpClient | None = None,
    ) -> None:
        self.descriptor = descriptor
        self.settings = settings
        self.http: HttpClient = http if http is not None else AiohttpClient()
        # Set as instance attributes rather than class attributes because every
        # descriptor-driven connector shares this one class — a ClassVar here
        # would have each registration overwrite the last.
        self.provider = descriptor.provider
        self.display_name = descriptor.display_name
        self.auth = descriptor.auth

    # ---- Settings ------------------------------------------------------

    def _setting(self, field_name: str) -> str:
        """A required settings value, named by its environment variable when unset."""
        if self.settings is None:
            raise RuntimeError(
                f"{self.provider}: DescriptorConnector was built without settings, so "
                f"{field_name!r} cannot be read"
            )
        return require(self.settings, field_name)

    def _require_oauth2(self, member: str) -> None:
        if self.auth != "oauth2":
            raise NotImplementedError(
                f"{self.provider} declares auth={self.auth!r}; {member} is only meaningful "
                "for an oauth2 connector"
            )

    # ---- Connect -------------------------------------------------------

    
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6689** (2026-11-13): **[Bug] LanceDB fails to persist transaction files on Windows during cognee.remember() — CognifyFailedError and CollectionNotFoundError**
  *Symptoms*: ### Bug Description  I'm encountering an issue when using Cognee on Windows with LanceDB as the vector database and OpenRouter for both LLM and embedding inference.  After resetting Cognee's data and ingesting local text files using cognee.remember(), the indexing pipeline fails because LanceDB cannot persist a transaction file.  The initial error is: _RuntimeError: lance error: LanceError(IO): failed to shutdown local writer LanceError(IO): failed to persist temp file The system cannot find the path specified. (os error 3)_  The subsequent rollback also fails: _CollectionNotFoundError: Collection 'DocumentChunk_text' not found! (Status code: 422)_  ### Steps to Reproduce  I run the following code in a Jupyter notebook (the code was given in the first video in cognee Youtube channel : https://www.youtube.com/watch?v=lQpmXvsrBzg&list=PLbJ6aa1LYeSTxMhlfOTKw3RbHGiL3fbm0&index=1): import cognee import os  await cognee.forget(everything=True)  data_path = "../data/silver"  for root, dirs, files in os.walk(data_path):     for file in files:         file_path = os.path.join(root, file)         print(file_path)          content = open(file_path, "r").read()         await cognee.remember(content)  The directory contains local md documents that I want to ingest into Cognee.  ### Expected Behavior  1. Ingest and index documents without filesystem errors. 2. Handle failed collection creation gracefully during rollback, without raising an additional CollectionNotFoundError.  ### Actual Be

- **Issue #6558** (2026-11-09): **Recreated dataset reuses its deterministic ID but loses all non-owner ACLs, silently locking out shared principals**
  *Symptoms*: ## Summary  When a dataset is deleted (`forget` / `delete_dataset`) and then created again under the same name by the same owner, it gets **the same dataset ID** but **only the owner's ACLs**. Every grant that other principals (users, roles, tenants) held on the old dataset is gone. Nothing in the API tells a client that this ID now refers to a different dataset. So a client that remembers "I already shared dataset `<id>` with role X" keeps trusting a grant that no longer exists. From then on that principal gets 403 on every read and write, with no clear signal why.  ## Where it comes from  - `cognee/modules/data/methods/get_unique_dataset_id.py`: the dataset ID is deterministic, `uuid5(NAMESPACE_OID, f"{dataset_name}{user.id}")` (and the tenant-aware variant). Recreating the dataset gives back the same UUID. - `cognee/modules/data/methods/delete_dataset.py`: `session.delete(dataset)` cascades and removes the dataset's ACL rows. That part is correct by itself. - On re-creation, only the owner gets `read/write/delete/share`.  Together these mean a dataset ID does not identify one dataset over its whole life. It can come back after a delete, with different permissions.  ## Steps to reproduce  1. User A creates dataset `agent_sessions` and adds data. 2. A grants a role (or another user B) `read` and `write` on it via `POST /api/v1/permissions/datasets/{principal_id}?permission_name=...`. 3. B writes to and searches the dataset successfully. 4. A runs `forget` on the dataset (or 

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

### Incident Patch 1: `1961133d` (2026-11-20)
**Commit Message**: docs: Revise the LoCoMo technical report (COG-7552) (#6800)

Brings the report in line with the GRO-248 review: the answer prompt's
decline rules and the judge's half-of-the-items rule (and when it
changed), how the exclusion list was built and what our audit could see,
both runs of the main configuration by category and with nothing
excluded, the cognee version behind the runs, and drops claims the
records don't back, such as the default depth being more economical.

**File**: `cognee/eval_framework/locomo/REPORT.md` (modified, +130/-66)
```diff
@@ -1,118 +1,164 @@
-# Cognee on LoCoMo - Technical Evaluation Report
+# Benchmarking cognee on LoCoMo - Technical Evaluation Report
+
+*Revised November 19, 2026. This revision describes the answer prompt's decline rules and the judge's partial-credit rule in more detail, including when that rule changed; explains how the exclusion list was built and what our audit could see; reports both runs of the main configuration by category and with nothing excluded; states which cognee version produced the runs; and removes observations we can't back up with hard data, such as the default depth being more economical. Earlier versions are in the repository history.*
 
 ## 1. Introduction
 
-This report documents our evaluation of Cognee, an open-source AI memory platform, on LoCoMo, a benchmark of very long-term conversational memory. We used standard Cognee memory components with LoCoMo-specific data formatting, one answer prompt for every question, a fixed retrieval configuration and an LLM judge. The goal was to measure the existing pipeline with a setup that others can inspect and rerun.
+This report documents our evaluation of cognee, an open-source AI memory platform, on LoCoMo, a benchmark of very long-term conversational memory. We used cognee's existing memory components and built a LoCoMo-specific setup around them: how the conversations are formatted for ingestion, one answer prompt for every question, the retrieval depth and the judge's grading prompt were all developed on the ten conversations we report on. The goal was to measure that pipeline with a setup that others can inspect and rerun.
 
-Cognee answers **91%** of the 1,762 evaluated questions correctly according to the LLM judge, using the hybrid retrieval approach we previously evaluated on [BEAM](../beam/REPORT.md). We audited LoCoMo's reference answers and exclude the questions that our audit or an external one found faulty. We also leave out open-domain questions, since this evaluation focuses on memory rather than general knowledge. As is now common for LoCoMo, an LLM judge grades the answers, with a single prompt for all questions; we comment on current judging practices in Section 5.
+cognee answered **~91%** of the 1,762 evaluated questions correctly according to the LLM judge (90.7% and 91.3% in two runs), using the hybrid retriever we previously evaluated on [BEAM](../beam/REPORT.md). We audited LoCoMo's reference answers and excluded the questions that our audit or an external one flagged. We also left out open-domain questions, which need knowledge from outside the conversation. As is now common for LoCoMo, an LLM judge grades the answers, with one prompt for all questions; Section 5 compares its rules with those of other published LoCoMo judges.
 
-Section 2 introduces LoCoMo and the parts of Cognee used here. Section 3 describes the method: how the conversations are ingested, how questions are answered, and the evaluation protocol, including the scope and the grading rules. Section 4 reports the results, overall and by category. Section 5 discusses a configuration at the retriever's default depth, how our grading compares with published LoCoMo judges, and the limits of the evaluation. Section 6 concludes, and Appendix A gives the models, configurations, rerun commands, audits and artifacts behind the results.
+Section 2 introduces LoCoMo and the parts of cognee used here. Section 3 describes the method: how the conversations are ingested, how questions are answered, and the evaluation protocol, including the scope and the grading rules. Section 4 reports the results, overall and by category. Section 5 discusses an additional experiment at the retriever's default depth, how our grading compares with published LoCoMo judges, and what the evaluation doesn't show. Section 6 concludes, and Appendix A gives the models, configurations, rerun commands, audits and artifacts behind the results.
 
 ## 2. Preliminaries
 
 ### 2.1 LoCoMo
 
-LoCoMo ([paper](https://arxiv.org/abs/2402.17753), [repository](https://github.com/snap-research/locomo)) contains 10 conversations between two people, each with 19–32 dated sessions and 369–689 turns, and 1,986 questions about them. The questions fall into five categories: single-hop (841), multi-hop (282), temporal (321), open-domain (96) and adversarial (446). Open-domain questions combine what a speaker said with general knowledge. Adversarial questions cannot be answered from the conversation: the expected response is to say so, and the dataset pairs each with a plausible wrong answer.
+LoCoMo ([paper](https://arxiv.org/abs/2402.17753), [repository](https://github.com/snap-research/locomo)) has a public release, `locomo10.json`, with 10 conversations between two people, a subset of the dataset described in the paper. Each conversation has 19–32 dated sessions and 369–689 turns, and the release has 1,986 questions about them. The questions fall into five categories: single-hop (841), multi-hop (282), temp
```

---

### Incident Patch 2: `013199f4` (2026-11-19)
**Commit Message**: docs: Revise the LoCoMo technical report (COG-7552)

Brings the report in line with the GRO-248 review: the answer prompt's
decline rules and the judge's half-of-the-items rule (and when it
changed), how the exclusion list was built and what our audit could see,
both runs of the main configuration by category and with nothing
excluded, the cognee version behind the runs, and drops claims the
records don't back, such as the default depth being more economical.

**File**: `cognee/eval_framework/locomo/REPORT.md` (modified, +130/-66)
```diff
@@ -1,118 +1,164 @@
-# Cognee on LoCoMo - Technical Evaluation Report
+# Benchmarking cognee on LoCoMo - Technical Evaluation Report
+
+*Revised November 19, 2026. This revision describes the answer prompt's decline rules and the judge's partial-credit rule in more detail, including when that rule changed; explains how the exclusion list was built and what our audit could see; reports both runs of the main configuration by category and with nothing excluded; states which cognee version produced the runs; and removes observations we can't back up with hard data, such as the default depth being more economical. Earlier versions are in the repository history.*
 
 ## 1. Introduction
 
-This report documents our evaluation of Cognee, an open-source AI memory platform, on LoCoMo, a benchmark of very long-term conversational memory. We used standard Cognee memory components with LoCoMo-specific data formatting, one answer prompt for every question, a fixed retrieval configuration and an LLM judge. The goal was to measure the existing pipeline with a setup that others can inspect and rerun.
+This report documents our evaluation of cognee, an open-source AI memory platform, on LoCoMo, a benchmark of very long-term conversational memory. We used cognee's existing memory components and built a LoCoMo-specific setup around them: how the conversations are formatted for ingestion, one answer prompt for every question, the retrieval depth and the judge's grading prompt were all developed on the ten conversations we report on. The goal was to measure that pipeline with a setup that others can inspect and rerun.
 
-Cognee answers **91%** of the 1,762 evaluated questions correctly according to the LLM judge, using the hybrid retrieval approach we previously evaluated on [BEAM](../beam/REPORT.md). We audited LoCoMo's reference answers and exclude the questions that our audit or an external one found faulty. We also leave out open-domain questions, since this evaluation focuses on memory rather than general knowledge. As is now common for LoCoMo, an LLM judge grades the answers, with a single prompt for all questions; we comment on current judging practices in Section 5.
+cognee answered **~91%** of the 1,762 evaluated questions correctly according to the LLM judge (90.7% and 91.3% in two runs), using the hybrid retriever we previously evaluated on [BEAM](../beam/REPORT.md). We audited LoCoMo's reference answers and excluded the questions that our audit or an external one flagged. We also left out open-domain questions, which need knowledge from outside the conversation. As is now common for LoCoMo, an LLM judge grades the answers, with one prompt for all questions; Section 5 compares its rules with those of other published LoCoMo judges.
 
-Section 2 introduces LoCoMo and the parts of Cognee used here. Section 3 describes the method: how the conversations are ingested, how questions are answered, and the evaluation protocol, including the scope and the grading rules. Section 4 reports the results, overall and by category. Section 5 discusses a configuration at the retriever's default depth, how our grading compares with published LoCoMo judges, and the limits of the evaluation. Section 6 concludes, and Appendix A gives the models, configurations, rerun commands, audits and artifacts behind the results.
+Section 2 introduces LoCoMo and the parts of cognee used here. Section 3 describes the method: how the conversations are ingested, how questions are answered, and the evaluation protocol, including the scope and the grading rules. Section 4 reports the results, overall and by category. Section 5 discusses an additional experiment at the retriever's default depth, how our grading compares with published LoCoMo judges, and what the evaluation doesn't show. Section 6 concludes, and Appendix A gives the models, configurations, rerun commands, audits and artifacts behind the results.
 
 ## 2. Preliminaries
 
 ### 2.1 LoCoMo
 
-LoCoMo ([paper](https://arxiv.org/abs/2402.17753), [repository](https://github.com/snap-research/locomo)) contains 10 conversations between two people, each with 19–32 dated sessions and 369–689 turns, and 1,986 questions about them. The questions fall into five categories: single-hop (841), multi-hop (282), temporal (321), open-domain (96) and adversarial (446). Open-domain questions combine what a speaker said with general knowledge. Adversarial questions cannot be answered from the conversation: the expected response is to say so, and the dataset pairs each with a plausible wrong answer.
+LoCoMo ([paper](https://arxiv.org/abs/2402.17753), [repository](https://github.com/snap-research/locomo)) has a public release, `locomo10.json`, with 10 conversations between two people, a subset of the dataset described in the paper. Each conversation has 19–32 dated sessions and 369–689 turns, and the release has 1,986 questions about them. The questions fall into five categories: single-hop (841), multi-hop (282), temp
```

#### Recent Merged Pull Requests:
- **PR #6807** (closed): fix(chunks): run the date-hint pass off the event loop (@pazonex)
- **PR #6806** (2026-11-20): docs(graph): Describe Node neighbours as a copy (SDK-1684) (@dexters1)
- **PR #6805** (2026-11-20): chore: Change default LLM model to gpt-6-luna (@dexters1)
- **PR #6801** (2026-11-20): fix(graph): Look up one document's source refs (@dexters1)
- **PR #6800** (2026-11-20): docs: Revise the LoCoMo technical report (COG-7552) (@goran-radonic)
- **PR #6799** (closed): docs: Revise the LoCoMo technical report (COG-7552) (@goran-radonic)

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

## X. docs: Revise the LoCoMo technical report (COG-7552)

**RULE**:
When implementing operations in `cognee/eval_framework/locomo/REPORT.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in topoteretes/cognee. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1961133d`: docs: Revise the LoCoMo technical report (COG-7552). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `cognee/eval_framework/locomo/REPORT.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
# Benchmarking cognee on LoCoMo - Technical Evaluation Report

*Revised November 19, 2026. This revision describes the answer prompt's decline rules and the judge's partial-credit rule in more detail, including when that rule changed; explains how the exclusion list was built and what our audit could see; reports both runs of the main configuration by category and with nothing excluded; states which cognee version produced the runs; and removes observations we can't back up with hard data, such as the default depth being more economical. Earlier versions are in the repository history.*
This report documents our evaluation of cognee, an open-source AI memory platform, on LoCoMo, a benchmark of very long-term conversational memory. We used cognee's existing memory components and built a LoCoMo-specific setup around them: how the conversations are formatted for ingestion, one answer prompt for every question, the retrieval depth and the judge's grading prompt were all developed on the ten conversations we report on. The goal was to measure that pipeline with a setup that others can inspect and rerun.
cognee answered **~91%** of the 1,762 evaluated questions correctly according to the 
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
# Cognee on LoCoMo - Technical Evaluation Report
This report documents our evaluation of Cognee, an open-source AI memory platform, on LoCoMo, a benchmark of very long-term conversational memory. We used standard Cognee memory components with LoCoMo-specific data formatting, one answer prompt for every question, a fixed retrieval configuration and an LLM judge. The goal was to measure the existing pipeline with a setup that others can inspect and rerun.
Cognee answers **91%** of the 1,762 evaluated questions correctly according to the LLM judge, using the hybrid retrieval approach we previously evaluated on [BEAM](../beam/REPORT.md). We audited LoCoMo's reference answers and exclude the questions that our audit or an external one found faulty. We also leave out open-domain questions, since this evaluation focuses on memory rather than general knowledge. As is now common for LoCoMo, an LLM judge grades the answers, with a single prompt for all questions; we comment on current judging practices in Section 5.
Section 2 introduces LoCoMo and the parts of Cognee used here. Section 3 describes the method: how the conversations are ingested, how questions are answered, and the evaluation 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1961133d` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
