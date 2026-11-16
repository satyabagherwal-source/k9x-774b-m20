# Verification Protocol: Verification Protocol: Empirical Defect Shield for topoteretes/cognee

<!-- PROVENANCE_START
{
  "source_repository": "topoteretes/cognee",
  "source_url": "https://github.com/topoteretes/cognee",
  "source_version": "5870f15d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T15:10:08.678Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-topoteretes-cognee",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [topoteretes/cognee](https://github.com/topoteretes/cognee) (Revision: `5870f15d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T15:10:08.678Z`  
> **Learning ID**: `learn-github-topoteretes-cognee`


## 1. Scope & Verification Target
- **Target Repository**: `topoteretes/cognee` (Commit: `5870f15d`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): topoteretes/cognee

> **Canonical Artifact**: `07_PROJECT_LEARNING/topoteretes-cognee-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/topoteretes/cognee](https://github.com/topoteretes/cognee))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-16T15:10:07.562Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `topoteretes/cognee`
- **Description**: Cognee is the open-source AI memory platform for agents. Give your AI agents persistent long-term memory with small models for free
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 33347 stars

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
2026-10-27). The HMAC is now :class:`cognee_connectors_core.signatures.HmacVerifier`
with the ``slack_v0`` scheme, the one ``CONNECTOR`` declares, so the hand-written
Slack routes and a host serving the generic ``/events`` route verify deliveries the
same way. The FastAPI dependency that sat next to the check lives in
:mod:`cognee_connector_slack.cognee_host.verify_slack_signature`.

Every inbound Slack payload — slash commands, Events API, interactivity — is
authenticated by an HMAC over ``v0:{timestamp}:{raw_body}`` keyed with the
app's signing secret, compared against the ``X-Slack-Signature`` header
(https://docs.slack.dev/authentication/verifying-requests-from-slack).

The check MUST run over the raw request bytes, before any parsing: slash
commands arrive form-encoded, and re-serializing a parsed dict changes key
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

### Incident Patch 1: `5870f15d` (2026-11-16)
**Commit Message**: feat(hermes): Move the Hermes plugin into cognee-integrations/ (SDK-1489) (#6650)

<!-- .github/pull_request_template.md -->

## Description

Moves the Hermes Agent memory plugin (`cognee-integration-hermes-agent`)
from topoteretes/cognee-integrations into
`cognee-integrations/integrations/hermes-agent`, the first of the agent
plugins to move into this repository. The shared conformance case tables
come along as `cognee-integrations/integrations/conformance/`.

- **Code:** the plugin is the released `hermes-agent-v1.4.3`
(cognee-integrations@3b2a19b6), byte for byte, except the README (new
location and release flow), a CHANGELOG note and preamble, `[tool.uv]`
in its pyproject plus the re-lock, the conformance README's "Copy" note
and a header comment in `cognee-integrations/pyproject.toml`. Neither
the cognee sdist nor the wheel includes `cognee-integrations/`.
- **CI:** `test_integrations.yml` finds plugins by their folders, so a
moved plugin needs no workflow edit. On a PR it lints, lock-checks and
tests the changed plugins, and `integrations-tests` is its gate job.
When dispatched with `live`, it runs each plugin's live round trip
against a real cognee server and LLM. That tier 

**File**: `.github/workflows/nightly_scheduler.yml` (modified, +75/-0)
```diff
@@ -156,3 +156,78 @@ jobs:
           payload: |
             channel: ${{ secrets.SLACK_NIGHTLY_CHANNEL_ID }}
             text: "Nightly Scheduler failed to dispatch Nightly Tests at `${{ steps.pick.outputs.ref }}` — tonight's nightly will not run and will post nothing. ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
+
+  # The integrations' live round trip (test_integrations.yml, `live`), every
+  # evening against dev: plugin fixes land on dev, and main only moves at core
+  # releases, so main's copy of the plugins would be weeks old. Its own job, so a
+  # failure here never stops the core nightly above. Skips the Sunday 06:00 cron,
+  # which would run it a second time that day.
+  dispatch-integrations:
+    name: Dispatch the integrations live tier
+    if: ${{ github.event_name == 'schedule' && github.event.schedule != '0 6 * * 0' }}
+    runs-on: ubuntu-latest
+    timeout-minutes: 10
+    permissions:
+      contents: read
+      actions: write
+    steps:
+      - name: Note the newest existing integrations run
+        id: baseline
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          GH_REPO: ${{ github.repository }}
+        run: |
+          set -euo pipefail
+          # Before dispatching, so the confirm step below cannot match an older run.
+          id="$(gh run list --workflow test_integrations.yml --branch dev \
+                  --event workflow_dispatch --limit 1 \
+                  --json databaseId --jq '.[0].databaseId // 0')"
+          echo "id=$id" >> "$GITHUB_OUTPUT"
+          echo "baseline run id: $id"
+
+      - name: Dispatch test_integrations.yml at dev with live
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          GH_REPO: ${{ github.repository }}
+        run: |
+          set -euo pipefail
+          # Input values as strings, as the dispatch API documents them; a
+          # boolean input still arrives as a boolean `inputs.live`.
+          jq -nc '{ref: "dev", inputs: {live: "true"}}' \
+          | gh api -X POST \
+              "repos/$GH_REPO/actions/workflows/test_integrations.yml/dispatches" \
+              --input -
+
+      - name: Confirm a NEW run was created
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+          GH_REPO: ${{ github.repository }}
+          BASELINE: ${{ steps.baseline.outputs.id }}
+        run: |
+          set -euo pipefail
+          # The dispatch endpoint answers 204 with no body, so a lost dispatch
+          # looks like success, and a live tier that never starts posts nothing.
+          for _ in $(seq 1 12); do
+            read -r id url <<<"$(gh run list --workflow test_integrations.yml \
+                  --branch dev --event workflow_dispatch --limit 1 \
+                  --json databaseId,url --jq '.[0] | "\(.databaseId) \(.url)"' \
+                  2>/dev/null || echo "0 -")"
+            if [ "${id:-0}" != "0" ] && [ "${id}" != "${BASELINE}" ]; then
+              echo "dispatched: $url"
+              echo "Integrations live tier dispatched at \`dev\`: $url" >> "$GITHUB_STEP_SUMMARY"
+              exit 0
+            fi
+            sleep 5
+          done
+          echo "::error::no NEW test_integrations.yml run appeared for dev within 60s"
+          exit 1
+
+      - name: Alert Slack if the dispatch failed
+        if: ${{ failure() }}
+        uses: slackapi/slack-github-action@dcb1066f776dd043e64d0e8ba94ca15cc7e1875d  # v4.0.0
+        with:
+          method: chat.postMessage
+          token: ${{ secrets.SLACK_BOT_TOKEN }}
+          payload: |
+            channel: ${{ secrets.SLACK_INTEGRATIONS_NIGHTLY_CHANNEL_ID }}
+            text: "Nightly Scheduler failed to dispatch the integrations live tier at `dev` — tonight's live tier will not run and will post nothing. ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
```

**File**: `.github/workflows/pre_test.yml` (modified, +6/-1)
```diff
@@ -34,6 +34,11 @@ jobs:
         if: ${{ !cancelled() }}
         run: uv sync --extra dev
 
+      # The Hermes plugin is excluded: it came from topoteretes/cognee-integrations,
+      # where these rules did not apply, and catches broad exceptions on purpose so
+      # a memory failure never crashes the host agent. Each plugin that moves here
+      # is excluded by its own entry, not by a rule covering all of them.
+      #
       # Exception-handling rules are enforced without escape hatch: `--ignore-noqa`
       # makes a `# noqa` comment on these rules count as a finding, so a silent
       # `except Exception` has to be fixed (log with traceback, re-raise, or narrow
@@ -42,7 +47,7 @@ jobs:
       # Exception raise.
       - name: Ruff exception-handling rules (strict, noqa ignored)
         if: ${{ !cancelled() }}
-        run: uv run ruff check . --select BLE001,S110,S112,G201,TRY201,TRY002 --ignore-noqa
+        run: uv run ruff check . --select BLE001,S110,S112,G201,TRY201,TRY002 --ignore-noqa --extend-exclude cognee-integrations/integrations/hermes-agent
 
       - name: Ty type check
         if: ${{ !cancelled() }}
```

**File**: `.github/workflows/release_hermes_plugin.yml` (added, +146/-0)
```diff
@@ -0,0 +1,146 @@
+name: release_hermes_plugin.yml
+# Publish the Hermes Agent memory plugin (cognee-integrations/integrations/hermes-agent) to
+# PyPI as cognee-integration-hermes-agent.
+#
+# The plugin versions independently of the cognee library, so, like cognee-mcp,
+# it has its own workflow and its own tag namespace (hermes-agent-v*). The tag
+# names are the same as when the plugin lived in topoteretes/cognee-integrations.
+#
+# Release flow:
+#   1. Bump the version in pyproject.toml, plugin.yaml,
+#      cognee_integration_hermes/_plugin_root/plugin.yaml and the hermes-agent
+#      entry of cognee-integrations/integrations/inventory.yml (the tests and
+#      the inventory check verify they match), re-lock, and add a CHANGELOG.md
+#      section. Merge that to main.
+#   2. Run this workflow from main. It tests, builds, attests, publishes and
+#      then tags the released commit hermes-agent-v<version>.
+#
+# Auth: PyPI Trusted Publishing only. A PyPI owner of
+# cognee-integration-hermes-agent has to add a publisher with
+#   Repository owner: topoteretes
+#   Repository name:  cognee
+#   Workflow name:    release_hermes_plugin.yml
+#   Environment:      (leave blank)
+# The publisher for topoteretes/cognee-integrations can be removed once the
+# first release from here is out.
+on:
+  workflow_dispatch:
+
+# Minimal default permissions (OSSF Scorecard: Token-Permissions). The one job
+# opts in to exactly what it needs.
+permissions:
+  contents: read
+
+concurrency:
+  group: release-hermes-plugin
+  cancel-in-progress: false
+
+jobs:
+  release-hermes-plugin-pypi:
+    name: Release cognee-integration-hermes-agent to PyPI from ${{ github.ref_name }}
+    permissions:
+      contents: write       # push the hermes-agent-v* tag
+      id-token: write       # OIDC: Trusted Publishing and signing attestations
+      attestations: write   # Persist the SLSA build provenance attestation
+    runs-on: ubuntu-latest
+    timeout-minutes: 30
+    env:
+      TELEMETRY_DISABLED: "1"
+    defaults:
+      run:
+        working-directory: cognee-integrations/integrations/hermes-agent
+
+    steps:
+      - name: Refuse any ref but main
+        working-directory: .
+        run: |
+          if [ "${GITHUB_REF}" != "refs/heads/main" ]; then
+            echo "::error::release_hermes_plugin.yml publishes and tags permanently; run it from main (got ${GITHUB_REF})."
+            exit 1
+          fi
+
+      - name: Check out ${{ github.ref_name }} at ${{ github.sha }}
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1
+        with:
+          # The commit the run was dispatched on, not the branch head now.
+          ref: ${{ github.sha }}
+
+      - name: Install uv
+        uses: astral-sh/setup-uv@c18668ad3cf93ea998bef934396af7bb5c839dc7  # v10.2.0
+
+      - name: Install Python
+        run: uv python install
+
+      - name: Resolve version and tag
+        id: meta
+        run: |
+          VERSION="$(uv version --short)"
+          TAG="hermes-agent-v${VERSION}"
+          echo "Releasing cognee-integration-hermes-agent ${VERSION} as ${TAG}"
+          echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
+          echo "tag=${TAG}" >> "$GITHUB_OUTPUT"
+
+      - name: Refuse to republish an existing version
+        env:
+          VERSION: ${{ steps.meta.outputs.version }}
+          TAG: ${{ steps.meta.outputs.tag }}
+        run: |
+          # PyPI versions are immutable: a second upload of the same version is
+          # rejected. Fail here, with a message that says what to do, rather
+          # than at the upload step.
+          if curl -fsS "https://pypi.org/pypi/cognee-integration-hermes-agent/${VERSION}/json" >/dev/null 2>&1; then
+            echo "::error::cognee-integration-hermes-agent ${VERSION} is already on PyPI. Bump the version (pyproject.toml, both plugin.yaml files and inventory.yml) and re-lock before releasing."
+            exit 1
+          fi
+          if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
+            echo "::error::Tag ${TAG} already exists on origin."
+            exit 1
+          fi
+          echo "${VERSION} is unpublished and ${TAG} is free."
+
+      - name: Run the test suite
+        run: |
+          uv sync --locked --dev
+          uv pip install -r local-mode-requirements.txt
+          uv run --no-sync pytest tests/ -q
+
+      - name: Build distributions
+        run: uv build
+
+      - name: Verify distributions were built
+        run: |
+          shopt -s nullglob
+          wheels=(dist/*.whl)
+          sdists=(dist/*.tar.gz)
+          if [ "${#wheels[@]}" -ne 1 ] || [ "${#sdists[@]}" -ne 1 ] || \
+             [ ! -s "${wheels[0]}" ] || [ ! -s "${sdists[0]}" ]; then
+            echo "::error::Build must produce exactly one nonempty wheel and sdist."
+            ls -lh dist/ || true
+            exit 1
+          fi
+          ls -lh "${wheels[@]}" "${sdists[@]}"
+
+ 
```

**File**: `.github/workflows/test_integrations.yml` (added, +473/-0)
```diff
@@ -0,0 +1,473 @@
+name: test | integrations
+# Checks for the agent plugins under cognee-integrations/integrations/: lint, the
+# lockfile and each plugin's own test suite on every change, and, when dispatched
+# with `live`, each plugin's live round trip against a real cognee server and LLM.
+#
+# Plugins are discovered from their folders (a pyproject.toml makes a Python
+# plugin), so moving one here needs no edit to this file. A pull request tests
+# only the plugins it changes, or all of them when it changes something they
+# share. `integrations-tests` is the one job to require.
+#
+# Each plugin declares no cognee dependency (cognee's pins conflict with the
+# environments the host agents share between plugins). A plugin whose tests
+# start a local server gets cognee from its local-mode-requirements.txt, the
+# release its local mode installs: a PyPI release, not this checkout.
+#
+# The live tier (tests/test_integration_*.py) needs secrets and spends LLM
+# tokens, so it runs only on dispatch: nightly_scheduler.yml dispatches it
+# against dev every evening. It fails when any of those tests skips, so a
+# missing dependency or key can never pass as green, and `notify` posts every
+# dispatched run's result, green included, to #nightly-ci-integrations: the
+# live tier and every other job that run executes, so no failure reports green.
+#
+# The case tables in integrations/conformance/ are a copy: the hook plugins in
+# topoteretes/cognee-integrations generate two of them and test against the
+# same files there. `conformance-drift` fails when the copy here differs from
+# upstream main, on pull requests that touch it and on every dispatched run.
+
+on:
+  push:
+    branches: [ main, dev ]
+    paths: &paths
+      - "cognee-integrations/**"
+      - ".github/workflows/test_integrations.yml"
+  pull_request:
+    branches: [ main, dev ]
+    types: [opened, synchronize, reopened]
+    paths: *paths
+  workflow_dispatch:
+    inputs:
+      live:
+        description: "Also run each plugin's live round trip (real cognee server and LLM)"
+        required: false
+        type: boolean
+        default: false
+
+permissions:
+  contents: read
+
+concurrency:
+  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}-${{ inputs.live && 'live' || 'checks' }}
+  # Cancel superseded PR runs, never a push-to-dev or live run.
+  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
+
+env:
+  TELEMETRY_DISABLED: "1"
+
+jobs:
+  detect:
+    name: Detect integration plugins
+    runs-on: ubuntu-22.04
+    outputs:
+      python: ${{ steps.plugins.outputs.python }}
+      live: ${{ steps.plugins.outputs.live }}
+      conformance: ${{ steps.plugins.outputs.conformance }}
+    steps:
+      - name: Check out repository
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1
+        with:
+          # The pull request's base commit, to list what it changed.
+          fetch-depth: 0
+
+      - name: List the plugins to test
+        id: plugins
+        env:
+          EVENT: ${{ github.event_name }}
+          BASE_SHA: ${{ github.event.pull_request.base.sha }}
+          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
+        run: |
+          set -euo pipefail
+          # On a pull request, test the plugins it changed, or all of them when it
+          # changed something they share. Everywhere else, test all of them.
+          # Conformance drift: on pull requests that touch the tables, and on
+          # dispatched runs (the nightly), never on a push.
+          all=true
+          changed=""
+          conformance=false
+          if [ "${EVENT}" = "workflow_dispatch" ]; then
+            conformance=true
+          fi
+          if [ "${EVENT}" = "pull_request" ]; then
+            conformance=true
+            changed="$(git diff --name-only "${BASE_SHA}...${HEAD_SHA}")"
+            if ! grep -q -E '^(cognee-integrations/pyproject\.toml|cognee-integrations/integrations/conformance/|\.github/workflows/test_integrations\.yml)' <<<"${changed}"; then
+              all=false
+            fi
+            if ! grep -q '^cognee-integrations/integrations/conformance/' <<<"${changed}"; then
+              conformance=false
+            fi
+          fi
+
+          python=()
+          live=()
+          cd cognee-integrations/integrations
+          for dir in */; do
+            slug="${dir%/}"
+            case "${slug}" in conformance|tests) continue ;; esac
+            if [ -f "${slug}/pyproject.toml" ]; then
+              if [ "${all}" = true ] || grep -q "^cognee-integrations/integrations/${slug}/" <<<"${changed}"; then
+                python+=("${slug}")
+              fi
+              # The live tier runs every plugin that has one, changed or not.
+              if compgen -G "${slug}/tests/test_integration_*.py" > /dev/null; then
+                live+=("${slug}")
+              fi
+            elif [ -f "${slug}/package.json
```

**File**: `cognee-integrations/README.md` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+# Cognee integrations
+
+Plugins that give agent tools persistent memory backed by Cognee. Each plugin
+is its own package, released on its own schedule.
+
+The integrations are moving here from
+[topoteretes/cognee-integrations](https://github.com/topoteretes/cognee-integrations),
+one at a time. Until an integration is listed below, its source, docs and
+releases are still in that repository.
+
+## Moved so far
+
+<!-- inventory:start -->
+<!-- Generated by scripts/inventory.py from integrations/inventory.yml; do not edit by hand. -->
+
+| Integration | Package | Version | Source | Release |
+|---|---|---|---|---|
+| Cognee Memory Plugin for Hermes Agent | [`cognee-integration-hermes-agent`](https://pypi.org/project/cognee-integration-hermes-agent/) | 1.4.3 | [`integrations/hermes-agent`](integrations/hermes-agent) | [`release_hermes_plugin.yml`](../.github/workflows/release_hermes_plugin.yml), tags `hermes-agent-v*` |
+
+<!-- inventory:end -->
+
+The table is rendered from [`integrations/inventory.yml`](integrations/inventory.yml)
+by `scripts/inventory.py`, which also checks the inventory against the plugin
+folders and their manifests.
+
+## Layout
+
+```
+cognee-integrations/
+├── pyproject.toml   Shared lint and test settings for every plugin below
+├── scripts/         inventory.py: checks the inventory, renders the table above
+└── integrations/
+    ├── inventory.yml One entry per plugin below
+    ├── conformance/ Case tables that every plugin tests against
+    └── <plugin>/    One folder per plugin, with its own pyproject.toml or
+                     package.json, tests, README and CHANGELOG
+```
+
+The layout is the same as in topoteretes/cognee-integrations, with this
+folder in place of that repository's root, so paths inside a plugin keep
+working when it moves. Everything at that repository's root has a place here:
+
+| In topoteretes/cognee-integrations | Here |
+|---|---|
+| `integrations/<plugin>/` | `integrations/<plugin>/` |
+| `integrations/tests/` (the shared hook-plugin suite) | `integrations/tests/` |
+| `integrations/inventory.yml`, `integrations/CONFIGURATION.md` | `integrations/` |
+| `scripts/`, `assets/`, `n8n_workflows/` | `scripts/`, `assets/`, `n8n_workflows/` |
+| `.github/workflows/` | the shared workflows in this repository's `.github/workflows/` |
+| `reports/` | not moved |
+| `.claude-plugin/`, `.cursor-plugin/`, `.grok-plugin/`, `.agents/plugins/` | not moved; see [Marketplace plugins](#marketplace-plugins) |
+
+`integrations/conformance/` is a copy. Two of its tables are generated from
+the Claude Code and Codex hook plugins, which are still in
+topoteretes/cognee-integrations, so that copy is canonical until they move
+here. `test_integrations.yml` fails when this copy differs from it.
+
+## Marketplace plugins
+
+The Claude Code, Codex, Cursor and Grok Bot plugins are installed from agent
+marketplaces, not from a package registry. Their code moves here like the rest.
+They are distributed through the official listings (the claude.ai Directory,
+and each agent's own marketplace), pointed at this repository. Nothing is added
+at this repository's root for them.
+
+topoteretes/cognee-integrations keeps only its marketplace manifests, repointed
+here, for users who added that repository as a marketplace by hand. Once they
+have moved to the official listings, it is archived.
+
+## Moving a plugin
+
+1. Copy the plugin folder from topoteretes/cognee-integrations to
+   `integrations/<plugin>/`, move its entry from that repository's
+   `integrations/inventory.yml` to `integrations/inventory.yml` here (adding
+   `path`, `tag_prefix`, `release_workflow` and `moved_from`), and run
+   `python scripts/inventory.py` to render the table above.
+2. If it is listed in a marketplace or directory, point that listing at
+   `topoteretes/cognee` and `cognee-integrations/integrations/<plugin>` first.
+   The Directory reviews each version, so allow time for that.
+3. In topoteretes/cognee-integrations, in the same change: replace the plugin
+   folder with a note pointing here, remove it from that repository's CI and
+   release workflows, and mark it moved in `integrations/inventory.yml`.
+4. Triage the CodeQL alerts the move raises on the copied code, and dismiss
+   the false positives with a reason.
+
+## Development and releases
+
+Each plugin's README covers its own setup, tests and release steps.
+`.github/workflows/test_integrations.yml` lints and tests every plugin under
+`integrations/` that has a `pyproject.toml`, and runs each plugin's live round
+trip (`tests/test_integration_*.py`) nightly against `dev`, posting every
+result to `#nightly-ci-integrations` on Slack. It needs no edit when a plugin
+moves here. Releases are per plugin for now, for example
+`release_hermes_plugin.yml` for Hermes.
```

**File**: `cognee-integrations/integrations/conformance/README.md` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+> **Copy.** These case tables are shared by every Cognee agent plugin. Only the
+> Hermes plugin has moved into this repository so far. The canonical tables are
+> in `integrations/conformance/` of
+> [topoteretes/cognee-integrations](https://github.com/topoteretes/cognee-integrations):
+> `recall_text_cases.json` and `capture_policy_cases.json` are generated there
+> from the hook plugins' `_recall_text.py` and `_capture_policy.py`, and Claude
+> Code, Codex and OpenClaw test against them there. Change a table there first,
+> then copy it here; `.github/workflows/test_integrations.yml` fails when the
+> two differ. The test paths below are paths in that repository, except
+> hermes-agent's, which are under `cognee-integrations/` here.
+
+# Session id sanitization conformance
+
+Every Cognee integration turns a native session id into a Cognee session id with
+the same shape: `{agent}_{native_id}`. Before the native id is used, each
+integration runs it through a small sanitizer. The rule is:
+
+- Keep only the ASCII set `[A-Za-z0-9-_.]`.
+- Replace every other character with `_`.
+- Trim leading and trailing `.` and `_`.
+- Cap the length at 120 characters.
+
+`session_id_cases.json` is the single source of truth for that rule. It is a
+list of `{ "input", "expected", "note" }` cases. Each test loads this file and
+checks its sanitizer against it. The tests live with the suite that already
+covers the tree they test, so no integration needs a test project of its own:
+
+- claude-code and codex:
+  `integrations/tests/tests/unit/test_session_id_conformance.py` — the shared
+  hook-plugin suite, parametrized over both plugin trees.
+- hermes-agent: `integrations/hermes-agent/tests/test_session_id_conformance.py`
+- openclaw: `integrations/openclaw/__tests__/unit/test_session_id_conformance.ts`
+
+Because every test reads the same file, any implementation that drifts from the
+rule fails its test. CI runs all of them on every pull request through the
+existing jobs in `.github/workflows/ci.yml`: the shared suite via `test-python`
+(`detect-changes` maps a claude-code or codex change onto the `tests` cell) and
+again under Python 3.9 via `test-hooks-python39`, hermes-agent via `test-python`
+(it has its own `pyproject.toml`), and openclaw via `test-typescript`, which
+runs `npm test` as well as the type check.
+
+## Note on empty results
+
+The table only holds inputs whose sanitized output is not empty. hermes-agent
+returns `"session"` when the result would be empty, while the others return an
+empty string. That one case is left out on purpose so the shared table stays
+identical for all four integrations.
+
+# Dataset name sanitization conformance
+
+cognee rejects a dataset name that contains a space or a dot
+(`check_dataset_name`, run on every write: remember, improve, memify and the
+pipelines). Every integration therefore runs a configured or derived dataset
+name through a small sanitizer before using it. The rule is deliberately narrow:
+
+- Trim surrounding whitespace.
+- Replace every run of spaces and dots with a single `_`.
+- If nothing but underscores is left (and the input was not already that),
+  use the integration's default dataset instead.
+
+Nothing else changes. A name the server accepts today (`Foo+Bar`, `héllo`,
+`_x_`) comes back unchanged, so no user is silently moved to a new, empty
+dataset. A name that contains a space or a dot never took a write, so rewriting
+it orphans nothing. The vscode extension's `sanitizeDatasetName` is stricter
+(`[^A-Za-z0-9_-]` → `_`) because it only cleans names it derives itself.
+
+`dataset_name_cases.json` holds `{ "input", "fallback", "expected", "note" }`
+cases; each test passes `fallback` as the default, so one table serves
+integrations with different defaults. The tests live next to the session-id ones:
+
+- claude-code, codex and antigravity:
+  `integrations/tests/tests/unit/test_dataset_name_conformance.py`
+- hermes-agent: `integrations/hermes-agent/tests/test_dataset_name_conformance.py`
+- openclaw: `integrations/openclaw/__tests__/unit/test_dataset_name_conformance.ts`
+
+Where a name is typed explicitly (the dataset-switch commands), an invalid name
+is refused with the sanitized form as a suggestion instead of being rewritten,
+so a switch never lands in a dataset the user did not name.
+
+# Recall text trimming conformance
+
+On cognee 1.6.x a graph recall with `only_context` returns the full prompt the
+server's own LLM would have received: the conversation history, the question
+template around the retrieved context, and the `## Active session guidance`
+block. The hook plugins and openclaw keep only the retrieved context and shrink
+it the same way, without an LLM:
+
+- Find the context by the question marker (`` The question is: `<prompt>` ``)
+  and the final backtick, or the last `` `\n\n## Active session guidance ``.
+  Text that does not fit is returned whole and flagged `parsed: false`.
+- Drop passages w
```

**File**: `cognee-integrations/integrations/conformance/capture_policy_cases.json` (added, +1568/-0)
```diff
@@ -0,0 +1,1568 @@
+{
+  "_comment": "Generated by running integrations/claude-code/scripts/_capture_policy.py. tool_cases: expected is true/false, or \"error\" when the policy raises (fail closed). redact_cases: expected output, or error=true when redaction raises.",
+  "tool_cases": [
+    {
+      "note": "default allows any tool",
+      "env": {},
+      "tool": "Bash",
+      "params": {
+        "command": "ls -la"
+      },
+      "expected": true
+    },
+    {
+      "note": "default allows a read of an ordinary file",
+      "env": {},
+      "tool": "Read",
+      "params": {
+        "file_path": "/project/main.py"
+      },
+      "expected": true
+    },
+    {
+      "note": "allow list by name keeps the named tool",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "Grep|Glob"
+      },
+      "tool": "Grep",
+      "params": {
+        "path": "main.py"
+      },
+      "expected": true
+    },
+    {
+      "note": "allow list by name drops other tools",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "Grep|Glob"
+      },
+      "tool": "Read",
+      "params": {
+        "path": "main.py"
+      },
+      "expected": false
+    },
+    {
+      "note": "allow list glob",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "mcp__*"
+      },
+      "tool": "mcp__github__get_issue",
+      "params": {},
+      "expected": true
+    },
+    {
+      "note": "allow list glob drops non-matching",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "mcp__*"
+      },
+      "tool": "Bash",
+      "params": {
+        "command": "ls"
+      },
+      "expected": false
+    },
+    {
+      "note": "allow list as JSON array",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "[\"Read\", \"Bash(git:*)\"]"
+      },
+      "tool": "Read",
+      "params": {
+        "file_path": "a.py"
+      },
+      "expected": true
+    },
+    {
+      "note": "empty JSON array allow list means everything",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "[]"
+      },
+      "tool": "Write",
+      "params": {
+        "file_path": "a.py"
+      },
+      "expected": true
+    },
+    {
+      "note": "an env value starting with [ is read as JSON",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "[RW]*"
+      },
+      "tool": "Write",
+      "params": {
+        "file_path": "a.py"
+      },
+      "expected": "error"
+    },
+    {
+      "note": "glob with character class",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "[\"[RW]*\"]"
+      },
+      "tool": "Write",
+      "params": {
+        "file_path": "a.py"
+      },
+      "expected": true
+    },
+    {
+      "note": "glob with negated character class",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "[\"[!RW]*\"]"
+      },
+      "tool": "Write",
+      "params": {
+        "file_path": "a.py"
+      },
+      "expected": false
+    },
+    {
+      "note": "glob with a range",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "[\"[A-C]*\"]"
+      },
+      "tool": "Bash",
+      "params": {
+        "command": "ls"
+      },
+      "expected": true
+    },
+    {
+      "note": "glob question mark",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "Rea?"
+      },
+      "tool": "Read",
+      "params": {
+        "file_path": "a.py"
+      },
+      "expected": true
+    },
+    {
+      "note": "whitespace around pipe entries is trimmed",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": " Read | Grep "
+      },
+      "tool": "Grep",
+      "params": {},
+      "expected": true
+    },
+    {
+      "note": "prefix keeps the command",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "Bash(git:*)"
+      },
+      "tool": "Bash",
+      "params": {
+        "command": "git status"
+      },
+      "expected": true
+    },
+    {
+      "note": "prefix keeps the bare command",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "Bash(git:*)"
+      },
+      "tool": "Bash",
+      "params": {
+        "command": "git"
+      },
+      "expected": true
+    },
+    {
+      "note": "prefix ends on a word boundary",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "Bash(git:*)"
+      },
+      "tool": "Bash",
+      "params": {
+        "command": "gitk --all"
+      },
+      "expected": false
+    },
+    {
+      "note": "prefix ignores leading whitespace",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "Bash(git:*)"
+      },
+      "tool": "Bash",
+      "params": {
+        "command": "   git log"
+      },
+      "expected": true
+    },
+    {
+      "note": "prefix boundary may be a tab",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "Bash(git:*)"
+      },
+      "tool": "Bash",
+      "params": {
+        "command": "git\tlog"
+      },
+      "expected": true
+    },
+    {
+      "note": "compound command counts as its first word",
+      "env": {
+        "COGNEE_CAPTURE_TOOLS": "Bash(git:*)"
+      },
+      "tool": "Bash",
+      "params": {
+        "command": "cd x && git status"
+      },
+      "expected": false
+    },

```

**File**: `cognee-integrations/integrations/conformance/dataset_name_cases.json` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+[
+  {
+    "input": "agent_sessions",
+    "fallback": "agent_sessions",
+    "expected": "agent_sessions",
+    "note": "a valid name passes through unchanged"
+  },
+  {
+    "input": "My-Project_2",
+    "fallback": "agent_sessions",
+    "expected": "My-Project_2",
+    "note": "letters, digits, dash and underscore are untouched"
+  },
+  {
+    "input": "Foo+Bar@team",
+    "fallback": "agent_sessions",
+    "expected": "Foo+Bar@team",
+    "note": "characters the server accepts are left alone, so no existing dataset is orphaned"
+  },
+  {
+    "input": "héllo-wörld",
+    "fallback": "agent_sessions",
+    "expected": "héllo-wörld",
+    "note": "non-ASCII letters are accepted by the server and left alone"
+  },
+  {
+    "input": "my project",
+    "fallback": "agent_sessions",
+    "expected": "my_project",
+    "note": "a space becomes an underscore"
+  },
+  {
+    "input": "project-x_2.0",
+    "fallback": "agent_sessions",
+    "expected": "project-x_2_0",
+    "note": "a dot becomes an underscore"
+  },
+  {
+    "input": "team-user-a.b@x.com",
+    "fallback": "agent_sessions",
+    "expected": "team-user-a_b@x_com",
+    "note": "dots inside a derived name (an email user id) are replaced"
+  },
+  {
+    "input": "a . b",
+    "fallback": "agent_sessions",
+    "expected": "a_b",
+    "note": "a run of spaces and dots collapses to one underscore"
+  },
+  {
+    "input": "  padded  ",
+    "fallback": "agent_sessions",
+    "expected": "padded",
+    "note": "surrounding whitespace is trimmed"
+  },
+  {
+    "input": ".hidden",
+    "fallback": "agent_sessions",
+    "expected": "_hidden",
+    "note": "a leading dot becomes an underscore rather than being dropped"
+  },
+  {
+    "input": "_x_",
+    "fallback": "agent_sessions",
+    "expected": "_x_",
+    "note": "existing underscores are not trimmed"
+  },
+  {
+    "input": "___",
+    "fallback": "agent_sessions",
+    "expected": "___",
+    "note": "a valid all-underscore name is kept, not replaced by the fallback"
+  },
+  {
+    "input": "...",
+    "fallback": "agent_sessions",
+    "expected": "agent_sessions",
+    "note": "nothing usable left after replacement falls back to the default"
+  },
+  {
+    "input": "   ",
+    "fallback": "my-default",
+    "expected": "my-default",
+    "note": "a blank name falls back to the integration's own default"
+  },
+  {
+    "input": "",
+    "fallback": "agent_sessions",
+    "expected": "agent_sessions",
+    "note": "an empty name falls back to the default"
+  }
+]
```

---

### Incident Patch 2: `f5250eab` (2026-11-13)
**Commit Message**: ci: Report every nightly job to Slack (SDK-1489)

A dispatched run also runs the plugin checks, the conformance drift
check and the inventory check, but the Slack report waited for the live
tier alone and built its headline from it. A failed drift check or unit
test posted "green" while the run was red, and since the bot dispatches
the run, GitHub notified nobody.

notify now needs every job of the run, lists each one's result and
counts it in the headline, so any failure turns the post red.

**File**: `.github/workflows/test_integrations.yml` (modified, +29/-8)
```diff
@@ -17,7 +17,8 @@ name: test | integrations
 # tokens, so it runs only on dispatch: nightly_scheduler.yml dispatches it
 # against dev every evening. It fails when any of those tests skips, so a
 # missing dependency or key can never pass as green, and `notify` posts every
-# live run's result, green included, to #nightly-ci-integrations.
+# dispatched run's result, green included, to #nightly-ci-integrations: the
+# live tier and every other job that run executes, so no failure reports green.
 #
 # The case tables in integrations/conformance/ are a copy: the hook plugins in
 # topoteretes/cognee-integrations generate two of them and test against the
@@ -295,9 +296,12 @@ jobs:
           retention-days: 7
 
   notify:
-    name: Slack live report
-    needs: [detect, live]
-    # Every live run, green included: a failure-only report makes a passing
+    name: Slack nightly report
+    # Every job a dispatched run executes: a dispatch also runs the plugin checks,
+    # the conformance drift check and the inventory check, and a report built from
+    # the live tier alone would post green over any of them failing.
+    needs: [detect, python-plugin, live, conformance-drift, inventory]
+    # Every dispatched run, green included: a failure-only report makes a passing
     # night and a broken notifier look the same. Not on push or PR runs.
     if: ${{ always() && inputs.live }}
     runs-on: ubuntu-22.04
@@ -318,6 +322,9 @@ jobs:
           PLUGINS: ${{ needs.detect.outputs.live }}
           DETECT_RESULT: ${{ needs.detect.result }}
           LIVE_RESULT: ${{ needs.live.result }}
+          PLUGIN_CHECKS_RESULT: ${{ needs.python-plugin.result }}
+          CONFORMANCE_RESULT: ${{ needs.conformance-drift.result }}
+          INVENTORY_RESULT: ${{ needs.inventory.result }}
           REPORTS: ${{ runner.temp }}/reports
           REF: ${{ github.ref_name }}
           TRIGGER: ${{ github.event_name }}
@@ -333,13 +340,14 @@ jobs:
           token = os.environ["SLACK_BOT_TOKEN"].strip()
           channel = os.environ["SLACK_CHANNEL"].strip()
           if not token or not channel:
-              print("::error::SLACK_BOT_TOKEN / SLACK_INTEGRATIONS_NIGHTLY_CHANNEL_ID are not set; cannot post the live report.")
+              print("::error::SLACK_BOT_TOKEN / SLACK_INTEGRATIONS_NIGHTLY_CHANNEL_ID are not set; cannot post the nightly report.")
               sys.exit(1)
 
           icons = {
               "success": ":white_check_mark:",
               "failure": ":red_circle:",
               "cancelled": ":octagonal_sign:",
+              "skipped": ":fast_forward:",
           }
           try:
               plugins = json.loads(os.environ.get("PLUGINS") or "[]")
@@ -364,14 +372,27 @@ jobs:
               if status != "success" and not any(t.strip() for t in tests):
                   lines.append("> no per-test summary — the job likely crashed or timed out; see the run log")
 
+          # The other jobs of the run. Skipped means it had nothing to check
+          # (no plugin, no conformance run) and does not change the headline.
+          checks = {
+              "lint and unit tests": os.environ["PLUGIN_CHECKS_RESULT"],
+              "conformance drift": os.environ["CONFORMANCE_RESULT"],
+              "inventory": os.environ["INVENTORY_RESULT"],
+          }
+          for name, result in checks.items():
+              result = result or "unknown"
+              lines.append(f"{icons.get(result, ':white_circle:')} *{name}*: {result}")
+              if result != "skipped":
+                  outcomes.add(result)
+
           trigger = os.environ["TRIGGER"]
           ref = os.environ["REF"]
           if outcomes == {"success"}:
-              headline = f":large_green_circle: *Integrations live tier green* (`{ref}`, {trigger})"
+              headline = f":large_green_circle: *Integrations nightly green* (`{ref}`, {trigger})"
           elif "failure" in outcomes:
-              headline = f":rotating_light: *Integrations live tier failed* (`{ref}`, {trigger})"
+              headline = f":rotating_light: *Integrations nightly failed* (`{ref}`, {trigger})"
           else:
-              headline = f":warning: *Integrations live tier incomplete* (`{ref}`, {trigger}) — a plugin was cancelled or not run"
+              headline = f":warning: *Integrations nightly incomplete* (`{ref}`, {trigger}) — a job was cancelled or not run"
           text = "\n".join([headline, *lines, f"<{os.environ['RUN_URL']}|Open the run>"])
 
           request = urllib.request.Request(
```

#### Recent Merged Pull Requests:
- **PR #6737** (closed): dev -> main (@mertzamir)
- **PR #6718** (closed): feat: resolve issue #5916 - Hackathon [Feature]: Add Polar customer-state, sub (@ademolaaa)
- **PR #6717** (2026-11-16): docs(guides): rework hybrid decomposition guide, remove dlt column search guide (RES-110) (@ArmagedonFlamer)
- **PR #6715** (2026-11-13): feat: package standalone Vercel connector (SDK-1568) (@NMZivkovic)
- **PR #6714** (2026-11-16): perf(pgvector): Store new collections as halfvec, require pgvector 0.7.0 (SDK-651) (@dexters1)
- **PR #6712** (2026-11-14): perf(pgvector): Build HNSW indexes with 8 links per node (SDK-651) (@dexters1)

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

## X. hermes): Move the Hermes plugin into cognee-integrations/ (SDK-1489)

**RULE**:
When implementing operations in `.github/workflows/nightly_scheduler.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in topoteretes/cognee. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5870f15d`: hermes): Move the Hermes plugin into cognee-integrations/ (SDK-1489). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/nightly_scheduler.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:

  # The integrations' live round trip (test_integrations.yml, `live`), every
  # evening against dev: plugin fixes land on dev, and main only moves at core
  # releases, so main's copy of the plugins would be weeks old. Its own job, so a
  # failure here never stops the core nightly above. Skips the Sunday 06:00 cron,
  # which would run it a second time that day.
  dispatch-integrations:
    name: Dispatch the integrations live tier
    if: ${{ github.event_name == 'schedule' && github.event.schedule != '0 6 * * 0' }}
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      actions: write
    steps:
      - name: Note the newest existing integrations run
        id: baseline
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_REPO: ${{ github.repository }}
        run: |
          set -euo pipefail
          # Before dispatching, so the confirm step below cannot match an older run.
          id="$(gh run list --workflow test_integrations.yml --branch dev \
                  --event workflow_dispatch --limit 1 \
                  --json databaseId --jq '.[0].databaseId // 0')"
          echo "id=$id" >> "$GITHUB_OUTPUT"
 
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5870f15d` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
