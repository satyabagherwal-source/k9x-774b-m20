> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/topoteretes-cognee-learnings.md`  
> **Source**: github ([https://github.com/topoteretes/cognee](https://github.com/topoteretes/cognee))  
> **Source Version**: `c78a56ff`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T16:58:29.537Z  
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
> **Harvest Timestamp**: 2026-11-26T16:58:29.529Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `topoteretes/cognee`
- **Description**: Cognee is the open-source AI memory platform for agents. Give your AI agents persistent long-term memory with small models for free
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 33647 stars

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
- **Issue #6791** (2026-11-23): **Deleting one document's graph reads the whole dataset into memory; table loads run out of memory on a large graph**
  *Symptoms*: ## Summary  `delete_by_document` finds the nodes and edges of one data item by fetching the source references of every node and every edge in the dataset and filtering them in Python. Its cost depends on the size of the dataset, not on the size of the document.  Cognify runs it once per table item through `purge_stale_dlt_source_artifacts`, also on a first load when nothing can be stale. Loading tables into a large dataset is therefore slow, and with several items in parallel the server runs out of memory.  ## Versions  - cognee 1.6.8, and the code path is unchanged in 1.6.9 (line numbers below are from 1.6.9) - Postgres graph store with pgvector, backend access control on  ## What happens  1. Cognify's table branch runs `purge_stale_dlt_source_artifacts` for every `DltSourceDocument` (`cognee/api/v1/cognify/cognify.py:815`). 2. That calls `delete_data_nodes_and_edges` → `try_delete_data_by_graph_provenance` → `unified.delete_by_document(dataset_id, data_id)`. 3. `delete_by_document` (`cognee/infrastructure/databases/unified/unified_store_engine.py:163`) calls `graph.find_node_source_refs_by_dataset(dataset_id)` and `graph.find_edge_source_refs_by_dataset(dataset_id)` (lines 192 and 197) and keeps the refs whose parsed data id equals `data_id`. 4. The Postgres adapter answers both with an unfiltered read of the dataset (`cognee/infrastructure/databases/graph/postgres_demo/adapter.py:1550` and `:1572`):  ```sql SELECT id, source_ref_keys FROM graph_node WHERE :dataset_id = ANY

- **Issue #6689** (2026-11-13): **[Bug] LanceDB fails to persist transaction files on Windows during cognee.remember() — CognifyFailedError and CollectionNotFoundError**
  *Symptoms*: ### Bug Description  I'm encountering an issue when using Cognee on Windows with LanceDB as the vector database and OpenRouter for both LLM and embedding inference.  After resetting Cognee's data and ingesting local text files using cognee.remember(), the indexing pipeline fails because LanceDB cannot persist a transaction file.  The initial error is: _RuntimeError: lance error: LanceError(IO): failed to shutdown local writer LanceError(IO): failed to persist temp file The system cannot find the path specified. (os error 3)_  The subsequent rollback also fails: _CollectionNotFoundError: Collection 'DocumentChunk_text' not found! (Status code: 422)_  ### Steps to Reproduce  I run the following code in a Jupyter notebook (the code was given in the first video in cognee Youtube channel : https://www.youtube.com/watch?v=lQpmXvsrBzg&list=PLbJ6aa1LYeSTxMhlfOTKw3RbHGiL3fbm0&index=1): import cognee import os  await cognee.forget(everything=True)  data_path = "../data/silver"  for root, dirs, files in os.walk(data_path):     for file in files:         file_path = os.path.join(root, file)         print(file_path)          content = open(file_path, "r").read()         await cognee.remember(content)  The directory contains local md documents that I want to ingest into Cognee.  ### Expected Behavior  1. Ingest and index documents without filesystem errors. 2. Handle failed collection creation gracefully during rollback, without raising an additional CollectionNotFoundError.  ### Actual Be

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

### Incident Patch 1: `f508a230` (2026-11-26)
**Commit Message**: fix(code_graph): Read enola 0.5.4 cluster output (SDK-1759) (#6882)

## Description

#6880 bumped `enola-cli` to 0.5.4 with only `pyproject.toml` and
`uv.lock`. It merged with the Code Graph E2E check red, and the SDK
still assumed the pre-0.5.3 cluster layout. This PR makes the two SDK
changes the bump needs.

**Cluster output location (enola 0.5.3+).** enola now writes a cluster's
graph once, to a directory of its own, and refuses a directory inside a
member repository. Before, every member's `.enola-<dataset_id>` got a
copy and cognee read the first member's. With 0.5.4 that directory only
receives `extractor_cache.json`, so any dataset with more than one
repository failed with `EnolaSnapshotError: no facts.jsonl`.

- The cluster snapshot is written to
`COGNEE_REPOS_DIR/.enola-clusters/<dataset_id>` through enola's
`output.cluster_dir`. The repos root is always a local directory (the
system root can be `s3://`), and a clone's directory name never starts
with a dot, so no clone can collide with it.
- Member labels are read from the `members` list of the cluster's
`receipt.json` (`repo` + `repo_path`). The old path read
`snapshot.meta.json` and `receipt.json` from each member's di

**File**: `cognee/tasks/code_graph/cluster.py` (modified, +40/-82)
```diff
@@ -3,9 +3,8 @@
 A repository extracted on its own cannot see the others: a frontend's HTTP call
 names a path, and only a snapshot that also covers the backend can say which
 route serves it. enola links repositories when it is given a cluster config
-listing them, and writes the whole linked graph into every member, under a
-directory of the dataset's own (``.enola-<dataset_id>``, see
-:func:`cluster_output_dir`) rather than the shared ``.enola``.
+listing them, and writes the whole linked graph once, to a directory of the
+dataset's own outside the repositories (see :func:`cluster_snapshot_dir`).
 
 A dataset is the cluster. When it holds more than one ``code_repo`` Data row,
 :func:`snapshot_dataset_code_repos` runs enola once over all of them and the
@@ -25,6 +24,7 @@
 
 import asyncio
 import json
+import os
 from dataclasses import dataclass, field, replace
 from pathlib import Path
 from typing import TYPE_CHECKING, Any, Optional
@@ -36,7 +36,6 @@
     ParsedSnapshot,
     parse_enola_snapshot,
     run_enola_cluster,
-    snapshot_identity,
 )
 
 if TYPE_CHECKING:
@@ -113,93 +112,53 @@ async def dataset_code_repo_rows(dataset_id: UUID) -> list:
 
 
 def cluster_output_dir(dataset_id: UUID) -> str:
-    """Where, inside each member repository, a dataset's cluster snapshot is written.
+    """The working directory enola keeps inside each member for a dataset's cluster runs.
 
-    A remote clone is shared by every dataset that adds its URL, and a cluster
-    snapshot holds the facts of all the dataset's repositories. One directory
-    per dataset keeps a cluster run from overwriting the snapshot another
-    dataset is reading. enola takes the name relative to each repository.
+    It holds the member's extractor cache, not a snapshot. A remote clone is
+    shared by every dataset that adds its URL, so the name is the dataset's
+    own rather than the ``.enola`` a single-repository run writes its snapshot
+    to. enola takes the name relative to each repository.
     """
     return f".enola-{dataset_id}"
 
 
-def _written_label(repo_path: Path, output_dir: str, snapshot_id: str | None) -> str | None:
-    """The label enola gave a member in the snapshot just taken, or None.
+def cluster_snapshot_dir(dataset_id: UUID) -> Path:
+    """Where a dataset's cluster snapshot is written: one directory per dataset.
 
-    A cluster run writes ``snapshot.meta.json`` into every member's
-    ``output_dir`` with the member's own ``repo_label`` — the exact name its
-    facts carry. The file is enola's own bookkeeping rather than part of the
-    documented snapshot contract, so it is only trusted when it describes
-    this snapshot (same ``snapshot_id``) and the caller falls back to
-    deriving the label when it is missing or stale.
+    enola writes a cluster's graph once and refuses a directory inside a
+    member repository, so it lives next to the clones, under
+    ``BaseConfig.repos_root_directory`` (``COGNEE_REPOS_DIR``), which is a
+    local directory whatever the storage backend. A clone's directory name
+    never starts with a dot, so no clone can take this one's place.
     """
-    try:
-        meta = json.loads(
-            (repo_path / output_dir / "snapshot.meta.json").read_text(encoding="utf-8")
-        )
-    except (OSError, json.JSONDecodeError):
-        return None
-    if not isinstance(meta, dict):
-        return None
-    if snapshot_id is not None and meta.get("snapshot_id") != snapshot_id:
-        return None
-    label = meta.get("repo_label")
-    return label if isinstance(label, str) and label else None
+    from cognee.tasks.code_graph.resolve_repo import default_clones_dir
 
+    return default_clones_dir() / ".enola-clusters" / str(dataset_id)
 
-def _label_candidates(repo_path: Path, output_dir: str) -> list[str]:
-    """The labels enola may have given a repository, most likely first.
 
-    enola labels a repository by its own name from the git remote, and by its
-    directory name when there is no usable remote or the name is already taken
-    in the cluster. The remote is read from the member's own receipt.
-    """
-    candidates = []
-    try:
-        receipt = json.loads((repo_path / output_dir / "receipt.json").read_text(encoding="utf-8"))
-    except (OSError, json.JSONDecodeError):
-        receipt = None
-    git = receipt.get("git") if isinstance(receipt, dict) else None
-    remote = git.get("remote") if isinstance(git, dict) else None
-    if isinstance(remote, str) and "/" in remote.strip("/"):
-        candidates.append(remote.strip("/").rsplit("/", 1)[-1])
-    if repo_path.name not in candidates:
-        candidates.append(repo_path.name)
-    return candidates
-
-
-def resolve_member_labels(
-    repo_paths: list[Path],
-    fact_labels: set[str],
-    output_dir: str,
-    snapshot_id: str | None = None,
-) -> list[str] | None:
+def resolve_member_labels(repo_paths: list[Path], receipt: dict | None) -> list[str] | None:
     """The enola 
```

**File**: `cognee/tasks/code_graph/enola.py` (modified, +21/-13)
```diff
@@ -215,19 +215,26 @@ def _config_via_stdin() -> bool:
     return os.name != "nt"
 
 
-def render_cluster_config(repo_paths: list[Path], output_dir: str) -> str:
+def render_cluster_config(repo_paths: list[Path], output_dir: str, cluster_dir: Path) -> str:
     """The enola cluster config for these repositories, as YAML text.
 
     enola accepts a cluster only as a ``repos:`` config, whose entries must be
     plain path strings. Paths are written absolute, so the config means the
     same thing wherever enola resolves it from, and as JSON strings, which are
-    valid YAML scalars and quote any path safely. ``output_dir`` replaces
-    ``.enola`` as the snapshot directory; enola joins it to each repository
-    path and refuses an absolute one. enola's per-repository
+    valid YAML scalars and quote any path safely. ``cluster_dir`` is where
+    enola writes the cluster's graph; enola refuses a directory inside one of
+    the repositories. ``output_dir`` replaces ``.enola`` as each member's own
+    working directory (its extractor cache); enola joins it to each
+    repository path and refuses an absolute one. enola's per-repository
     architecture history (revisions under ``~/.enola/graphs``) is switched
     off: cognee keeps its own record of the snapshot it loaded.
     """
-    lines = ["output:", f"  dir: {json.dumps(output_dir)}", "repos:"]
+    lines = [
+        "output:",
+        f"  dir: {json.dumps(output_dir)}",
+        f"  cluster_dir: {json.dumps(str(cluster_dir))}",
+        "repos:",
+    ]
     lines.extend(f"  - {json.dumps(str(path))}" for path in repo_paths)
     lines.extend(["history:", "  enabled: false"])
     return "\n".join(lines) + "\n"
@@ -236,13 +243,15 @@ def render_cluster_config(repo_paths: list[Path], output_dir: str) -> str:
 async def run_enola_cluster(
     repo_paths: list[Path],
     output_dir: str,
+    cluster_dir: Path,
     timeout: float = 600.0,
 ) -> Path:
-    """Run `enola --generate` over a cluster of repositories; return one snapshot directory.
+    """Run `enola --generate` over a cluster of repositories; return its snapshot directory.
 
     enola links the repositories of a cluster config into one graph and
-    writes that whole graph to every member's ``output_dir``, so any member's
-    directory is the cluster's snapshot. The first member's is returned.
+    writes that graph once, to ``cluster_dir``, which must lie outside every
+    member repository (enola 0.5.3 and later; before, each member's
+    ``output_dir`` received a copy).
 
     The config is built from the repositories' paths and handed to enola on
     its standard input (``--generate /dev/stdin``): enola reads the config
@@ -258,7 +267,7 @@ async def run_enola_cluster(
         if not repo_path.is_dir():
             raise EnolaSnapshotError(message=f"Repository path '{repo_path}' is not a directory.")
 
-    config_text = render_cluster_config(repo_paths, output_dir)
+    config_text = render_cluster_config(repo_paths, output_dir, cluster_dir)
     subject = f"the {len(repo_paths)}-repository cluster {[path.name for path in repo_paths]}"
     cwd = Path(tempfile.gettempdir())
 
@@ -283,13 +292,12 @@ async def run_enola_cluster(
             stdin_data=config_text.encode("utf-8"),
         )
 
-    snapshot_dir = repo_paths[0] / output_dir
-    if not (snapshot_dir / "facts.jsonl").is_file():
+    if not (cluster_dir / "facts.jsonl").is_file():
         raise EnolaSnapshotError(
-            message=f"enola completed but no facts.jsonl was found in '{snapshot_dir}'."
+            message=f"enola completed but no facts.jsonl was found in '{cluster_dir}'."
         )
 
-    return snapshot_dir
+    return cluster_dir
 
 
 @dataclass(frozen=True)
```

**File**: `cognee/tests/test_code_graph_e2e.py` (modified, +10/-10)
```diff
@@ -63,12 +63,12 @@
 
 # --- Known answers, pinned to the fixture + ENOLA_PINNED_VERSION ------------
 # If enola is bumped and these change, update them deliberately. Last
-# re-verified against enola 0.5.1: it emits the README as document/section
-# symbols, an `extraction` coverage fact, the pyproject's declared package as
-# `pkg:pypi/requests`, and (since 0.4.14) a module-level `module-edge:` dependency
-# fact per resolved package import. File-level import facts such as
-# `main -> inventory.store` now carry the imported file path as their target and
-# no resolved module id; the resolved `imports` edge lives on the module-edge fact.
+# re-verified against enola 0.5.4: it emits the README as document/section
+# symbols, an `extraction` coverage fact and the pyproject's declared package as
+# `pkg:pypi/requests`. File-level import facts such as `main -> inventory.store`
+# carry the imported file path as their target and no resolved module id. Since
+# 0.5.4 the fixture gets no module-level `module-edge:` dependency fact either,
+# so the module-to-module `imports` edge is the one cognee derives itself.
 
 EXPECTED_MODULES = {".", "inventory"}
 
@@ -234,10 +234,10 @@ def _assert_typed_code_graph(nodes: dict, edges: list, repo_name: str) -> None:
     )
 
     imports = {(name_of[s], name_of[t]) for s, t, rel, _ in edges if rel == "imports"}
-    # enola resolves the package import from main.py to the top-level module
-    # `inventory` on a module-level dependency fact (see the known-answers note).
-    assert ("module-edge: . -> inventory", "inventory") in imports, (
-        f"Missing 'imports' edge from 'module-edge: . -> inventory' to module 'inventory'; "
+    # main.py imports the package: the root module imports module `inventory`
+    # (see the known-answers note).
+    assert (".", "inventory") in imports, (
+        f"Missing 'imports' edge from module '.' to module 'inventory'; "
         f"imports present: {sorted(imports)}"
     )
 
```

**File**: `cognee/tests/unit/tasks/code_graph/test_cluster.py` (modified, +41/-98)
```diff
@@ -14,6 +14,7 @@
     ClusterMember,
     DatasetCodeSnapshot,
     cluster_output_dir,
+    cluster_snapshot_dir,
     code_repo_path,
     load_dataset_cluster,
     mark_dataset_code_repos_for_rebuild,
@@ -32,6 +33,7 @@
 from cognee.tests.utils.graph_lookups import lookups_through_get_graph_data
 
 cluster_module = importlib.import_module("cognee.tasks.code_graph.cluster")
+resolve_repo_module = importlib.import_module("cognee.tasks.code_graph.resolve_repo")
 extract_module = importlib.import_module("cognee.tasks.code_graph.extract_code_graph")
 graph_engine_module = importlib.import_module(
     "cognee.infrastructure.databases.graph.get_graph_engine"
@@ -75,33 +77,24 @@
 REACHES = (UI_ROUTE, GOLF_ROUTE, "reaches_route")
 
 
-def _write_snapshot(
-    directory,
-    facts=CLUSTER_FACTS,
-    snapshot_id=SNAPSHOT_ID,
-    remote=None,
-    label=None,
-    label_snapshot_id=None,
-):
-    """A member's cluster output directory (``OUTPUT_DIR``) as a cluster run leaves it.
+def _write_snapshot(directory, facts=CLUSTER_FACTS, snapshot_id=SNAPSHOT_ID, members=()):
+    """A cluster snapshot directory as an enola run leaves it.
 
-    ``label`` adds the ``snapshot.meta.json`` enola writes, carrying the
-    member's own ``repo_label`` (for ``label_snapshot_id``, default this
-    snapshot). Without it only the contract files are present.
+    ``members`` are the (label, repository path) pairs the receipt lists.
     """
-    snapshot_dir = directory / OUTPUT_DIR
+    snapshot_dir = directory / "cluster-snapshot"
     snapshot_dir.mkdir(parents=True, exist_ok=True)
     (snapshot_dir / "facts.jsonl").write_text("\n".join(json.dumps(fact) for fact in facts) + "\n")
-    receipt = {"snapshot_id": snapshot_id}
-    if remote:
-        receipt["git"] = {"remote": remote}
-    (snapshot_dir / "receipt.json").write_text(json.dumps(receipt))
-    if label is not None:
-        meta = {"repo_label": label, "snapshot_id": label_snapshot_id or snapshot_id}
-        (snapshot_dir / "snapshot.meta.json").write_text(json.dumps(meta))
+    (snapshot_dir / "receipt.json").write_text(
+        json.dumps({"snapshot_id": snapshot_id, "members": _receipt_members(members)})
+    )
     return snapshot_dir
 
 
+def _receipt_members(members):
+    return [{"repo": label, "repo_path": str(path)} for label, path in members]
+
+
 def _mock_engine(monkeypatch, nodes=(), edges=()):
     engine = AsyncMock()
     engine.get_graph_data.return_value = (list(nodes), list(edges))
@@ -138,90 +131,41 @@ def test_code_repo_path_reads_metadata_as_dict_or_json_string(tmp_path):
     assert code_repo_path(SimpleNamespace(system_metadata=None)) is None
 
 
-def test_each_dataset_has_its_own_cluster_output_dir():
-    """A clone is shared by datasets: their cluster snapshots must not overwrite each other."""
+def test_each_dataset_has_its_own_cluster_directories(monkeypatch, tmp_path):
+    """A clone is shared by datasets: their cluster runs must not overwrite each other."""
+    monkeypatch.setattr(resolve_repo_module, "default_clones_dir", lambda: tmp_path)
     other = UUID("7d4e1c2a-0000-4000-8000-000000000001")
 
     assert OUTPUT_DIR != cluster_output_dir(other)
     assert ".enola" not in {OUTPUT_DIR, cluster_output_dir(other)}
+    assert cluster_snapshot_dir(DATASET_ID) != cluster_snapshot_dir(other)
+    # Next to the clones, under a name no clone can have.
+    assert cluster_snapshot_dir(DATASET_ID) == tmp_path / ".enola-clusters" / str(DATASET_ID)
 
 
-def test_member_label_is_the_one_enola_wrote_for_this_snapshot(tmp_path):
-    """enola records each member's label; it wins over anything derivable."""
-    first, second = _repos(tmp_path, "one", "two")
-    _write_snapshot(first, remote="github.com/acme/golf", label="golf-api")
-    _write_snapshot(second, label="ui")
-
-    labels = resolve_member_labels(
-        [first, second], {"golf-api", "ui"}, OUTPUT_DIR, snapshot_id=SNAPSHOT_ID
-    )
-
-    assert labels == ["golf-api", "ui"]
-
-
-def test_members_with_the_same_written_label_are_not_a_cluster(tmp_path):
+def test_member_label_is_the_one_the_receipt_lists_for_its_path(tmp_path):
     first, second = _repos(tmp_path, "one", "two")
-    _write_snapshot(first, label="web")
-    _write_snapshot(second, label="web")
-
-    assert (
-        resolve_member_labels([first, second], {"web"}, OUTPUT_DIR, snapshot_id=SNAPSHOT_ID) is None
-    )
-
-
-def test_stale_written_label_is_ignored_and_derived_instead(tmp_path):
-    """A meta file from an earlier run describes another snapshot: not trusted."""
-    golf, ui = _repos(tmp_path, "golf", "ui")
-    _write_snapshot(golf, label="old-golf", label_snapshot_id="sha256:older")
-    _write_snapshot(ui, label="ui")
+    receipt = {"members": _receipt_members([("ui", second), ("golf-api", first)])}
 
-    labels = resolve_member_labels([golf, ui], {"golf", "ui"}, OUTPUT_DIR, snapshot_id=SNAPSHOT_ID)
+    assert resolve_member_labels([first, second], receipt) == ["golf-api", "ui"]
 
-    
```

**File**: `cognee/tests/unit/tasks/code_graph/test_enola_runner.py` (modified, +28/-12)
```diff
@@ -157,18 +157,23 @@ async def fake_create_subprocess_exec(*args, **kwargs):
 CLUSTER_OUTPUT_DIR = ".enola-7d4e1c2a-0000-4000-8000-000000000000"
 
 
-def test_render_cluster_config_sets_output_dir_lists_absolute_paths_and_disables_history(
+def test_render_cluster_config_sets_output_dirs_lists_absolute_paths_and_disables_history(
     tmp_path,
 ):
     odd = tmp_path / "re: po"
 
-    config = enola_module.render_cluster_config([tmp_path / "golf", odd], CLUSTER_OUTPUT_DIR)
+    cluster_dir = tmp_path / "clusters" / "ds: 1"
+
+    config = enola_module.render_cluster_config(
+        [tmp_path / "golf", odd], CLUSTER_OUTPUT_DIR, cluster_dir
+    )
 
     # Paths are JSON-quoted (so Windows backslashes are escaped, and a path
     # with YAML punctuation stays one scalar), absolute, in cluster order.
     golf = json.dumps(str(tmp_path / "golf"))
     assert config == (
         f'output:\n  dir: "{CLUSTER_OUTPUT_DIR}"\n'
+        f"  cluster_dir: {json.dumps(str(cluster_dir))}\n"
         f"repos:\n  - {golf}\n  - {json.dumps(str(odd))}\nhistory:\n  enabled: false\n"
     )
 
@@ -200,21 +205,26 @@ async def test_run_enola_cluster_pipes_the_config_and_writes_no_file(monkeypatch
     monkeypatch.setattr(enola_module, "_config_via_stdin", lambda: True)
     golf, ui = _cluster_repos(tmp_path)
 
+    cluster_dir = tmp_path / "clusters" / "dataset"
+
     def write_snapshot():
-        (golf / CLUSTER_OUTPUT_DIR).mkdir(exist_ok=True)
-        (golf / CLUSTER_OUTPUT_DIR / "facts.jsonl").write_text("")
+        cluster_dir.mkdir(parents=True, exist_ok=True)
+        (cluster_dir / "facts.jsonl").write_text("")
 
     calls = _capture_subprocess(monkeypatch, write_snapshot)
 
-    snapshot_dir = await enola_module.run_enola_cluster([golf, ui], CLUSTER_OUTPUT_DIR, timeout=5.0)
+    snapshot_dir = await enola_module.run_enola_cluster(
+        [golf, ui], CLUSTER_OUTPUT_DIR, cluster_dir, timeout=5.0
+    )
 
-    assert snapshot_dir == golf / CLUSTER_OUTPUT_DIR
+    # The cluster's graph is read from its own directory, not from a member.
+    assert snapshot_dir == cluster_dir
     (args, kwargs, process), *_ = calls
     assert args == (str(fake_binary), "--generate", "/dev/stdin")
     assert kwargs["stdin"] == asyncio.subprocess.PIPE
     assert (
         process.stdin_received
-        == enola_module.render_cluster_config([golf, ui], CLUSTER_OUTPUT_DIR).encode()
+        == enola_module.render_cluster_config([golf, ui], CLUSTER_OUTPUT_DIR, cluster_dir).encode()
     )
     # Neutral working directory, nothing written next to the repositories.
     assert kwargs["cwd"] not in {str(golf), str(ui)}
@@ -232,20 +242,24 @@ async def test_run_enola_cluster_on_windows_uses_a_temporary_file_it_removes(mon
     golf, ui = _cluster_repos(tmp_path)
     seen_configs = []
 
+    cluster_dir = tmp_path / "clusters" / "dataset"
+
     def write_snapshot():
-        (golf / CLUSTER_OUTPUT_DIR).mkdir(exist_ok=True)
-        (golf / CLUSTER_OUTPUT_DIR / "facts.jsonl").write_text("")
+        cluster_dir.mkdir(parents=True, exist_ok=True)
+        (cluster_dir / "facts.jsonl").write_text("")
         # The config exists while enola runs ...
         seen_configs.extend(path.read_text() for path in tmp_path.glob("cognee-enola-cluster-*"))
 
     calls = _capture_subprocess(monkeypatch, write_snapshot)
 
-    await enola_module.run_enola_cluster([golf, ui], CLUSTER_OUTPUT_DIR, timeout=5.0)
+    await enola_module.run_enola_cluster([golf, ui], CLUSTER_OUTPUT_DIR, cluster_dir, timeout=5.0)
 
     (args, _kwargs, process), *_ = calls
     assert args[:2] == (str(fake_binary), "--generate")
     assert args[2].endswith(".yaml") and process.stdin_received is None
-    assert seen_configs == [enola_module.render_cluster_config([golf, ui], CLUSTER_OUTPUT_DIR)]
+    assert seen_configs == [
+        enola_module.render_cluster_config([golf, ui], CLUSTER_OUTPUT_DIR, cluster_dir)
+    ]
     # ... and is gone once it has exited.
     assert not list(tmp_path.glob("cognee-enola-cluster-*"))
 
@@ -258,6 +272,8 @@ async def test_run_enola_cluster_rejects_a_missing_repository_before_running(mon
     calls = _capture_subprocess(monkeypatch, lambda: None)
 
     with pytest.raises(enola_module.EnolaSnapshotError):
-        await enola_module.run_enola_cluster([golf, tmp_path / "gone"], CLUSTER_OUTPUT_DIR)
+        await enola_module.run_enola_cluster(
+            [golf, tmp_path / "gone"], CLUSTER_OUTPUT_DIR, tmp_path / "clusters" / "dataset"
+        )
 
     assert calls == []
```

**File**: `docs/memory-internals.md` (modified, +2/-2)
```diff
@@ -184,8 +184,8 @@ Supported code files (`.py`, `.go`, `.ts`, `.java`, `.rs`, … — the extension
 - **enola version**: installed by default as the pinned `enola-cli` wheel, which puts the binary in the environment's scripts directory; `ENOLA_PATH` always wins. A missing binary raises `EnolaNotInstalledError` with a reinstall hint — nothing is downloaded at runtime. The version pin lives only in `pyproject.toml`. Cognee reads enola's documented snapshot contract (`facts.jsonl`, `insights.json`, `flows.json`, `receipt.json`; `format_version` 1) and rejects a receipt with a format version it does not understand. Fact ids and resolved relation `target_id`s from the writer are used when present; explainer findings become `CodeInsight` nodes with `evidences` edges; a symbol's `doc` prop (its doc comment) becomes the node's `doc` and description; each `flows.json` flow becomes a `CodeFlow` node with `flow_entry`/`flow_stage`/`flow_route` edges to its entry, stages and routes, but only when the receipt lists that `flows.json` among the run's outputs (a release without the flows renderer leaves an earlier run's file in place; a snapshot without docs or flows ingests exactly as before); flows sharing a name in one repo (two services serving `GET /health`) are named after their entry as well, e.g. `GET /health (svc_a/app.health)`, so they stay separate nodes; an unchanged snapshot is skipped only when the repository node also carries the current `CODE_GRAPH_MAPPING_VERSION` (`extract_code_graph.py`; bump it whenever the fact-to-graph mapping changes, so repositories whose code did not change are mapped again); the receipt's provenance/quality block is stamped on the `CodeRepository` node and reported by the `delta` operation. Bumping the pin means re-checking the known answers in `cognee/tests/test_code_graph_e2e.py`.
 - **Opt-out per add**: `preferred_loaders={"text_loader": {}}` treats a code file as a plain document (chunking + LLM extraction).
 - **Whole repositories**: a local code-project directory or a GitHub/GitLab repository URL passed to `add()`/`remember()` (API: the `raw_data` form field) resolves to ONE `code_repo` manifest that cognify runs through the CODE_REPO route — a single enola pass with cross-file edges, plus the repo's documents as ordinary items. Remote URLs are shallow-cloned under `COGNEE_REPOS_DIR` (default `~/.cognee/repos`). Git LFS is disabled for every git command (`_run_git` in `resolve_repo.py`): an LFS file stays a pointer, and LFS pointers of documents are not ingested. A token passed as `repo_credentials` is sent only to the repository's own origin. `remember(content_type="code")` builds the same graph without the add step. The CODE route is per-file.
-- **Several repositories in one dataset**: the dataset is one enola cluster. Its `code_repo` rows are extracted in a single enola run, so the graph also holds the edges between repositories: `reaches_route` from a client call to the route that serves it, cross-repository `calls`/`imports`. The cluster config has no file of its own — its members are the rows themselves (`system_metadata.repo_path`), and the `repos:` config enola needs is rendered from them and piped to `enola --generate /dev/stdin` (a temporary file, removed when enola exits, on Windows). enola writes the cluster snapshot into each member's `.enola-<dataset_id>` (enola's `output.dir`), not the `.enola` a single-repository run uses: a remote clone is shared by every dataset that adds its URL, and a cluster snapshot holds the other repositories' facts. Each member's label is read back from the `repo_label` in that directory's `snapshot.meta.json`. Each row still owns its own repository's nodes. The snapshot is parsed once per load, off the event loop, and shared by every member's tasks (`ParsedSnapshot`). Adding a repository (`remember(content_type="code")`) rebuilds the others from a fresh snapshot — up to `CLUSTER_INLINE_REBUILD_LIMIT` (5) existing repositories; beyond that only the new rows are built inline and the rest are marked for the next `cognify()`, which rebuilds the whole cluster. Deleting one (`forget(data_id=...)`, `datasets.delete_data`) does not run enola — the remaining rows are marked for re-extraction, and the next `cognify()` of the dataset rebuilds them, as after `forget(memory_only=True)`. The enola run over a cluster gets the per-repository timeout times the member count, capped at `CLUSTER_ENOLA_TIMEOUT_CAP_SECONDS` (1 h). Put repositories that call each other in the same dataset; ones in different datasets are never linked. Implementation: `cognee/tasks/code_graph/cluster.py`.
-- **Docstrings as memory (code docs pipeline)**: `cognify_code_docs_pipeline(user, dataset=..., extract_entities=False, repo=None, include_modules=True)` in `cognee/memify_pipelines/cognify_code_docs.py` is a memify pipeline over an indexed repository (tasks in `cognee/tasks/code_docs/`). `extract_code_docs` reads the dataset's code graph, reads each documented symbol's do
```

---

### Incident Patch 2: `aa38c696` (2026-11-26)
**Commit Message**: fix: Keep Notion pages under unreadable blocks (CLO-1400) (#6440)

## Description
A Notion sync failed for the whole data source when one page held a
block whose children the API will not return. A production tenant had 3
of 10 data sources failing with `DLTIngestionError`, and the pod logs
show the same two errors each time: `Notion API error 400 on
blocks/<id>/children: validation_error: Block type
external_object_instance_page is not supported via the API.` and `...
Block type ai_block is not supported via the API for your bot type.`
`_collect_nested_children` lists the children of every block with
`has_children`, and any 4xx raised in `_NotionClient.request` aborts the
dlt resource, so the rest of the source was lost with it (CLO-1400).

A first-request `400 validation_error` that names the listed block's own
type is now read as "the API cannot expose this block". The connector
skips those children, keeps the block's own text and the surrounding
blocks, and logs one warning with the block id and type. This holds for
discovery and rendering, including synced copies. Page and table
listings never skip, and neither does an error on a later page of a
listing, since that would drop 

**File**: `cognee/modules/integrations/notion/sync.py` (modified, +38/-27)
```diff
@@ -65,15 +65,15 @@ async def sync_notion(credential: IntegrationCredential) -> None:
     await ingestion.run_sync("notion", credential, _sync_source)
 
 
-async def without_nested_roots(access_token: str, roots: list[str]) -> list[str]:
-    """The roots whose parent chain does not reach another selected root.
-
-    The outer root's walk already reads everything under it, so syncing the inner root
-    too would ingest and cognify its pages twice under two node sets. The chain is
-    followed one request per level (a page's parent can be a block, and a data
-    source's parent is its database). A chain that cannot be followed because Notion
-    reports an object as not shared is left alone and the root is kept. Any other
-    failure raises, so a flaky lookup never silently changes what is synced.
+async def nested_roots(access_token: str, roots: list[str]) -> dict[str, str]:
+    """Each root whose parent chain reaches another selected root, mapped to that root.
+
+    The outer root's walk reads what is under it, so syncing the inner root too would
+    ingest and cognify its pages twice under two node sets. The chain is followed one
+    request per level (a page's parent can be a block, and a data source's parent is its
+    database). A chain that cannot be followed because Notion reports an object as not
+    shared is left alone and the root is kept. Any other failure raises, so a flaky
+    lookup never silently changes what is synced.
     """
     # ``_split`` refuses an entry that is not page:<id> or data_source:<id>, before any request.
     selected = {client.canonical_id(_split(root)[1]): root for root in roots}
@@ -90,21 +90,18 @@ async def parent_of(kind: str, object_id: str) -> tuple[str, str] | None:
                 parents[key] = None
         return parents[key]
 
-    kept = []
+    nested = {}
     for root in roots:
         kind, object_id = _split(root)
         seen = {client.canonical_id(object_id)}
         parent = await parent_of(kind, object_id)
-        nested = False
         while parent is not None and client.canonical_id(parent[1]) not in seen:
             if client.canonical_id(parent[1]) in selected:
-                nested = True
+                nested[root] = selected[client.canonical_id(parent[1])]
                 break
             seen.add(client.canonical_id(parent[1]))
             parent = await parent_of(*parent)
-        if not nested:
-            kept.append(root)
-    return kept
+    return nested
 
 
 async def _require_accepted_token(credential: IntegrationCredential, access_token: str) -> None:
@@ -146,28 +143,42 @@ async def _sync_source(
     source_factory = ingestion.source_factory("notion")
     access_token = await access_token_for(credential)
     await _require_accepted_token(credential, access_token)
-    roots = await without_nested_roots(access_token, roots)
+    nested = await nested_roots(access_token, roots)
+    sources = {}
 
     def make_source(root: str, resource_name: str, check_active):
         kind, object_id = _split(root)
-        return source_factory(
+        sources[root] = source_factory(
             token=access_token,
             root_page_ids=[object_id] if kind == "page" else [],
             root_data_source_ids=[object_id] if kind == "data_source" else [],
             workspace_id=str(credential.provider_account_id),
             resource_name=resource_name,
             check_active=check_active,
         )
-
-    retained = await ingestion.sync_scopes(
-        "notion",
-        credential,
-        counts,
-        scopes=roots,
-        dataset_name=dataset_name_for_credential(credential),
-        make_source=make_source,
-        classify_error=_classify_error,
-    )
+        return sources[root]
+
+    retained: set[str] = set()
+    scopes = [root for root in roots if root not in nested]
+    while scopes:
+        retained |= await ingestion.sync_scopes(
+            "notion",
+            credential,
+            counts,
+            scopes=scopes,
+            dataset_name=dataset_name_for_credential(credential),
+            make_source=make_source,
+            classify_error=_classify_error,
+        )
+        # An outer walk that left blocks it could not read may not have reached a root
+        # nested in it, so that root is synced as its own scope instead of being retired.
+        scopes = [
+            inner
+            for inner, outer in nested.items()
+            if inner not in sources
+            and outer in sources
+            and ingestion.source_counts(sources[outer]).get("pages_incomplete")
+        ]
     if not ingestion.retirement_blocked(counts):
         await ingestion.retire_resources(
             "notion", credential, dataset_name_for_credential(credential), retained
```

**File**: `cognee/tasks/ingestion/connectors/notion.md` (modified, +42/-1)
```diff
@@ -81,7 +81,9 @@ mass deletion. A 403/404 when fetching a page or database reached *through* the
 item is gone and is tombstoned; the same error on one of your explicit roots aborts the sync
 instead, since that is a configuration problem, not a deletion. A failure while listing a
 readable page's blocks or querying a data source also aborts the sync, because it does not prove
-anything below it is gone.
+anything below it is gone. So does an answer that omits what it must carry (a listing's
+`results` or `has_more`, a block's `type` or `has_children`, a database's `data_sources`) or that
+is not a JSON object: a missing field is never read as empty.
 
 Moving a page between two of your selected roots, or changing the roots so that another one
 reaches it, changes its `cognee_node_set` (part of the row's identity), so it is re-ingested once
@@ -164,3 +166,42 @@ uv run pytest cognee/tests/integration/tasks/connectors/test_notion_ingestion.py
 Both mock the Notion API over `httpx.MockTransport` (no live credentials, no network). The
 integration test runs the real source through `cognee.add()`, dlt staging on sqlite and orphan
 cleanup; it needs no LLM because it does not cognify.
+
+## API-unsupported blocks
+
+If Notion rejects a block's children with `400 validation_error` and `Block type <type> is
+not supported via the API.` (or the `for your bot type` variant), the connector skips those
+children, keeps the block's own text and the rest of the page, and logs a warning with the
+block ID and type, never document content. This applies to discovery and rendering,
+including synced copies. These two messages are the ones the production sync logged
+(CLO-1400): another wording, any other error, a failed page or table listing, and an error
+after the first page of a listing still abort the sync.
+
+A page stored without such children is marked in its sync state, not in the stored row or
+its content hash, counted in `pages_incomplete` of `cognee_sync_stats` and logged by ID.
+Every sync lists its blocks again, so a page is rendered again when it turns incomplete or
+complete, not on every sync. A synced copy is listed only while its page is rendered, so a
+block that is unsupported inside a copy is skipped and logged but does not mark the page: the
+page is rendered again when it is edited, not when that block becomes readable. Nested text that
+was ingested before a block turned unsupported is dropped in that run: the document holds what
+the API returns.
+
+A page that disappears from below an incompletely read page is not proof of a deletion,
+because the stored ancestry names pages and databases, not container blocks. Such a page,
+and everything below it, is kept as stored and counted in `deletions_withheld`, with a
+warning naming the IDs. The rest of the sync goes on and its state advances. When the tree
+reads completely, the pages that are really gone are forgotten. State stored before
+ancestors were recorded withholds by root instead. Child pages inside synced copies are
+never discovered, so an unreadable block inside a copy withholds nothing.
+
+What the sync itself proved gone is never withheld: a page or database it reached and found
+gone (403/404, archived or in the trash), everything below it, and a row missing from a data
+source it queried to the end. Rows live in the data source, not under blocks, so a complete
+query is proof.
+
+A block Notion lists as `"type": "unsupported"` is matched by the type in its
+`unsupported.block_type`, the type Notion's error names.
+
+In Cognee Cloud, a selected root nested inside another selected root is normally synced
+through the outer one. When the outer root's sync leaves blocks unread, the nested root may
+be behind one of them, so it is synced as its own source and its pages are kept.
```

**File**: `cognee/tasks/ingestion/connectors/notion.py` (modified, +278/-44)
```diff
@@ -91,7 +91,7 @@
 from collections import deque
 from collections.abc import Callable
 from dataclasses import dataclass
-from typing import Any
+from typing import Any, overload
 from uuid import UUID
 
 from cognee.shared.logging_utils import get_logger
@@ -121,9 +121,25 @@
 class NotionAPIError(Exception):
     """A Notion API response that isn't worth retrying (or ran out of retries)."""
 
-    def __init__(self, status_code: int, message: str):
+    def __init__(
+        self,
+        status_code: int,
+        message: str,
+        *,
+        code: str | None = None,
+        api_message: str | None = None,
+    ):
         super().__init__(message)
         self.status_code = status_code
+        self.code = code
+        self.api_message = api_message
+
+
+class NotionResponseError(NotionAPIError):
+    """A 200 answer that cannot be read as what it should carry, so it has no HTTP status."""
+
+    def __init__(self, message: str):
+        super().__init__(0, message)
 
 
 class _RetryableStatusError(NotionAPIError):
@@ -190,8 +206,25 @@ def _attempt(self, method: str, path: str, params: dict | None, json_body: dict
         # a 3xx answer with a JSON body must not be read as an empty page, which would
         # tombstone everything below it.
         if status != 200:
-            raise NotionAPIError(status, _error_message(status, path, response))
-        return response.json()
+            try:
+                error = response.json()
+            except ValueError:
+                error = {}
+            if not isinstance(error, dict):
+                error = {}
+            raise NotionAPIError(
+                status,
+                _error_message(status, path, response),
+                code=error.get("code"),
+                api_message=error.get("message"),
+            )
+        try:
+            body = response.json()
+        except ValueError:
+            body = None
+        if not isinstance(body, dict):
+            raise NotionResponseError(f"Notion answered {path} without a JSON object.")
+        return body
 
     def get_self(self) -> dict:
         return self.request("GET", "users/me")
@@ -242,20 +275,107 @@ def _is_gone(exc: Exception) -> bool:
     return isinstance(exc, NotionAPIError) and exc.status_code in (403, 404)
 
 
-def _list_block_children(client: _NotionClient, block_id: str):
-    """Yield a block's direct children, across Notion's cursor pagination."""
+def _listing_page(response: dict, path: str) -> tuple[list[dict], str | None]:
+    """One page of a listing as ``(results, next_cursor)``; ``next_cursor`` is None on the last.
+
+    A field the answer lacks is never read as "nothing more here": a missing ``results`` list or
+    ``has_more`` flag would end the walk early and tombstone every page synced from below it.
+    """
+    results = response.get("results")
+    if not isinstance(results, list):
+        raise NotionResponseError(f"Notion answered {path} without a results list.")
+    if not all(isinstance(result, dict) for result in results):
+        raise NotionResponseError(f"Notion answered {path} with a result that is not an object.")
+    has_more = response.get("has_more")
+    if not isinstance(has_more, bool):
+        raise NotionResponseError(f"Notion answered {path} without a has_more flag.")
+    if not has_more:
+        return results, None
+    cursor = response.get("next_cursor")
+    if not cursor:
+        raise NotionResponseError("Notion reported more results without a next_cursor.")
+    return results, cursor
+
+
+def _check_blocks(blocks: list[dict], path: str) -> None:
+    """A block names its type and says whether it has children, or the walk cannot tell.
+
+    Without ``has_children`` its nested pages are never listed, and without ``type`` a child
+    page or database is not recognised; both would be tombstoned as gone.
+    """
+    for block in blocks:
+        if not isinstance(block.get("type"), str) or not isinstance(
+            block.get("has_children"), bool
+        ):
+            raise NotionResponseError(
+                f"Notion answered {path} with a block lacking type or has_children."
+            )
+
+
+def _database_data_sources(database: dict, database_id: str) -> list[dict]:
+    """The data sources of a database answer; a missing list is not a database without rows."""
+    data_sources = database.get("data_sources")
+    if not isinstance(data_sources, list):
+        raise NotionResponseError(f"Notion answered database {database_id} without data_sources.")
+    return data_sources
+
+
+@overload
+def _list_block_children(
+    client: _NotionClient, block_id: str, *, block_type: None = None
+) -> list[dict]: ...
+
+
+@overload
+def _list_block_children(
+    client: _NotionClient, block_id: str, *, block_type: str
+) -> list[dict] | None: ...
+
+
+def _list_block_children(
+    client: _NotionClient, block_id: str, *, block_type: str | None = None
+) -> list[dict] | None:
+    """Re
```

**File**: `cognee/tests/integration/tasks/connectors/test_notion_ingestion.py` (modified, +112/-0)
```diff
@@ -611,3 +611,115 @@ async def test_one_page_that_cannot_be_extracted_does_not_freeze_the_tree_of_the
         await cognee.cognify(datasets=[DATASET_NAME])
 
     assert {edge for edge in await _page_tree() if edge[0] == CHILD} == {(CHILD, MID)}
+
+
+def _unsupported_children(fake, monkeypatch, block_type):
+    original_handler = fake.handler
+    failures = {"blocked": True, "calls": 0}
+
+    def handler(request):
+        if request.url.path == "/v1/blocks/unsupported/children":
+            failures["calls"] += 1
+            if failures["blocked"]:
+                return httpx.Response(
+                    400,
+                    json={
+                        "code": "validation_error",
+                        "message": (
+                            f"Block type {block_type} is not supported via the API "
+                            "for your bot type."
+                        ),
+                    },
+                )
+        return original_handler(request)
+
+    monkeypatch.setattr(fake, "handler", handler)
+    return failures
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("block_type", ["external_object_instance_page", "ai_block"])
+# Notion documents an API-unsupported type as listed "unsupported" with its own type inside;
+# which shape the tenant's listing uses is not known, so both are synced.
+@pytest.mark.parametrize("listed_as", ["own_type", "unsupported"])
+async def test_unsupported_children_sync_and_recover_without_page_edit(
+    clean_environment, monkeypatch, block_type, listed_as
+):
+    fake = _tree()
+    if listed_as == "own_type":
+        block = {"id": "unsupported", "type": block_type, "has_children": True, block_type: {}}
+    else:
+        block = {
+            "id": "unsupported",
+            "type": "unsupported",
+            "has_children": True,
+            "unsupported": {"block_type": block_type},
+        }
+    fake.blocks[ROOT].extend([block, _paragraph("after", "Content after unsupported block.")])
+    fake.blocks["unsupported"] = [_paragraph("recovered", "Recovered content.")]
+    failures = _unsupported_children(fake, monkeypatch, block_type)
+    await _sync(fake)
+    first = await _notion_data()
+    assert set(first) == {ROOT, CHILD}
+    assert failures["calls"] == 1
+    with open(first[ROOT].raw_data_location.removeprefix("file://"), encoding="utf-8") as document:
+        content = document.read()
+    assert "Q4 moves orders to Postgres." in content
+    assert "Content after unsupported block." in content
+    assert "Recovered content." not in content
+
+    await _sync(fake)
+    assert {key: record.id for key, record in (await _notion_data()).items()} == {
+        key: record.id for key, record in first.items()
+    }
+    assert failures["calls"] == 2
+
+    failures["blocked"] = False
+    await _sync(fake)
+    recovered = await _notion_data()
+    assert recovered[ROOT].id != first[ROOT].id
+    assert recovered[CHILD].id == first[CHILD].id
+    with open(
+        recovered[ROOT].raw_data_location.removeprefix("file://"), encoding="utf-8"
+    ) as document:
+        assert "Recovered content." in document.read()
+    await _sync(fake)
+    assert {key: record.id for key, record in (await _notion_data()).items()} == {
+        key: record.id for key, record in recovered.items()
+    }
+
+
+@pytest.mark.asyncio
+async def test_unsupported_subtree_keeps_previous_pages_until_it_reads_completely(
+    clean_environment, monkeypatch
+):
+    fake = _tree()
+    await _sync(fake)
+    original = await _notion_data()
+    child_block = fake.blocks[ROOT].pop()
+    fake.blocks[ROOT].append(
+        {
+            "id": "unsupported",
+            "type": "ai_block",
+            "has_children": True,
+            "ai_block": {},
+        }
+    )
+    fake.blocks["unsupported"] = [child_block]
+    fake.pages[ROOT]["last_edited_time"] = "2026-02-01T00:00:00.000Z"
+    failures = _unsupported_children(fake, monkeypatch, "ai_block")
+
+    # The child page is no longer listed, but nothing proves it is gone: the sync succeeds,
+    # the page that was edited lands, and the child stays.
+    await _sync(fake)
+    kept = await _notion_data()
+    assert set(kept) == {ROOT, CHILD}
+    assert kept[CHILD].id == original[CHILD].id
+    assert kept[ROOT].id != original[ROOT].id
+
+    failures["blocked"] = False
+    await _sync(fake)
+    assert set(await _notion_data()) == {ROOT, CHILD}
+    fake.blocks["unsupported"] = []
+    await _sync(fake)
+    assert set(await _notion_data()) == {ROOT}
```

**File**: `cognee/tests/unit/modules/integrations/test_notion_sync.py` (modified, +157/-11)
```diff
@@ -12,7 +12,7 @@
 
 from cognee.modules.integrations.notion import client
 from cognee.modules.integrations.notion import sync as sync_module
-from cognee.modules.integrations.notion.sync import sync_notion, without_nested_roots
+from cognee.modules.integrations.notion.sync import nested_roots, sync_notion
 
 WORKSPACE = "ws-1"
 
@@ -239,6 +239,152 @@ async def test_a_root_nested_in_another_selected_root_is_not_synced_twice(sync_m
     assert [call.kwargs["root_page_ids"] for call in sync_mocks.source.call_args_list] == [[nid(2)]]
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("pages_incomplete", [0, 1])
+async def test_a_root_nested_in_a_root_whose_walk_left_blocks_unread_is_synced_itself(
+    sync_mocks, pages_incomplete
+):
+    """The outer walk may not have reached a root inside a block it could not read: that
+    root is then synced as its own scope, and kept, instead of being retired."""
+    chain = {
+        ("page", nid(1)): ("block", nid(3)),
+        ("block", nid(3)): ("page", nid(2)),
+        ("page", nid(2)): None,
+    }
+    sync_mocks.parent.side_effect = lambda _token, kind, object_id: chain[(kind, object_id)]
+
+    def source(**kwargs):
+        stats = (
+            {"pages_incomplete": pages_incomplete} if kwargs["root_page_ids"] == [nid(2)] else {}
+        )
+        return SimpleNamespace(**kwargs, cognee_sync_stats=stats)
+
+    sync_mocks.source.side_effect = source
+    credential = make_credential(page(1), page(2))
+    await sync_notion(credential)
+
+    synced = [call.kwargs["root_page_ids"] for call in sync_mocks.source.call_args_list]
+    retained = sync_mocks.retire.await_args.args[3]
+    inner = sync_module.ingestion.resource_name("notion", credential, page(1))
+    if pages_incomplete:
+        assert synced == [[nid(2)], [nid(1)]]
+        assert inner in retained
+    else:
+        assert synced == [[nid(2)]]
+        assert inner not in retained
+
+
+@pytest.mark.asyncio
+async def test_a_root_nested_twice_is_reached_through_each_incomplete_walk(sync_mocks):
+    """Roots 1 in 2 in 3: 3's walk and then 2's walk left blocks unread, so all three sync."""
+    chain = {
+        ("page", nid(1)): ("page", nid(2)),
+        ("page", nid(2)): ("page", nid(3)),
+        ("page", nid(3)): None,
+    }
+    sync_mocks.parent.side_effect = lambda _token, kind, object_id: chain[(kind, object_id)]
+    sync_mocks.source.side_effect = lambda **kwargs: SimpleNamespace(
+        **kwargs, cognee_sync_stats={"pages_incomplete": int(kwargs["root_page_ids"] != [nid(1)])}
+    )
+
+    await sync_notion(make_credential(page(1), page(2), page(3)))
+
+    synced = [call.kwargs["root_page_ids"] for call in sync_mocks.source.call_args_list]
+    assert synced == [[nid(3)], [nid(2)], [nid(1)]]
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("readable", [True, False])
+async def test_a_selected_root_inside_a_block_notion_cannot_list_is_not_lost(readable):
+    """The real ``notion_source``: root B sits in an ai_block of root A. When A's walk can
+    read the block, B is synced through A once; when it cannot, B is synced on its own and
+    its table is kept, instead of being retired on a run recorded as ok."""
+    from cognee.tasks.ingestion.connectors.notion import notion_source
+    from cognee.tests.unit.tasks.connectors.test_notion_source import (
+        FakeNotion,
+        _page_object,
+        _rich_text_block,
+        _unsupported_response,
+    )
+
+    outer, inner, hidden = (
+        "00000000-0000-0000-0000-000000000001",
+        "00000000-0000-0000-0000-000000000002",
+        "00000000-0000-0000-0000-000000000003",
+    )
+    fake = FakeNotion()
+    fake.pages[outer] = _page_object(outer, "A", parent={"type": "workspace", "workspace": True})
+    fake.blocks[outer] = [_rich_text_block(hidden, "ai_block", "", has_children=True)]
+    fake.pages[inner] = _page_object(inner, "B", parent={"type": "block_id", "block_id": hidden})
+    fake.blocks[inner] = [_rich_text_block("b2", "paragraph", "hello B")]
+    fake.blocks[hidden] = [
+        {"id": inner, "type": "child_page", "has_children": False, "child_page": {"title": "B"}}
+    ]
+
+    def handler(request):
+        if not readable and request.url.path == f"/v1/blocks/{hidden}/children":
+            return _unsupported_response("ai_block")
+        return fake.handler(request)
+
+    http_client = httpx.Client(transport=httpx.MockTransport(handler))
+    chain = {
+        ("page", nid(2)): ("block", nid(3)),
+        ("block", nid(3)): ("page", nid(1)),
+        ("page", nid(1)): None,
+    }
+    built, rows_by_root = [], {}
+
+    def real_source(**kwargs):
+        built.append(kwargs["root_page_ids"])
+        return notion_source(**kwargs, http_client=http_client)
+
+    async def remember(source, **_kwargs):
+        rows = await asyncio.to_thread(list, source)
+        rows_by_root[built[-1][0]] = {row["id"] for row in rows}
+        return SimpleNamespace(status="completed")
+
+    creden
```

**File**: `cognee/tests/unit/tasks/connectors/test_notion_source.py` (modified, +610/-1)
```diff
@@ -15,6 +15,8 @@
 from cognee.tasks.ingestion.connectors import notion as notion_module
 from cognee.tasks.ingestion.connectors.notion import (
     NotionAPIError,
+    NotionResponseError,
+    _is_gone,
     _iter_rows,
     _NotionClient,
     _resolve_workspace_id,
@@ -465,14 +467,146 @@ def handler(request):
     previous = {ROOT_PAGE_ID: {}, CHILD_PAGE_ID: {}, ROW_PAGE_ID: {}}
     state: dict = {}
     rows = []
-    with pytest.raises(NotionAPIError, match="incomplete"):
+    with pytest.raises(NotionResponseError, match="incomplete"):
         rows.extend(
             _iter_rows(_client(fake), [ROOT_PAGE_ID], [], WORKSPACE_ID, previous, state, {})
         )
     assert not any(row.get("_deleted") for row in rows)
     assert state == {}
 
 
+def _resync_aborts(fake, answer_for, message, *, roots=([ROOT_PAGE_ID], [])):
+    """Sync once, then walk again where ``answer_for(request)`` may replace an answer; the walk
+    must raise ``message`` before any tombstone is emitted and before state is written."""
+    state: dict = {}
+    list(_iter_rows(_client(fake), *roots, WORKSPACE_ID, {}, state, {}))
+    previous = dict(state["pages"])
+    original, requests = fake.handler, []
+
+    def handler(request):
+        requests.append(request)
+        # A walk that reads the bad page as "more" asks for the next one for ever.
+        assert len(requests) < 200, "the walk did not stop"
+        return answer_for(request) or original(request)
+
+    fake.handler = handler
+    rows, new_state = [], {}
+    with pytest.raises(NotionResponseError, match=message):
+        rows.extend(_iter_rows(_client(fake), *roots, WORKSPACE_ID, previous, new_state, {}))
+    assert not any(row.get("_deleted") for row in rows)
+    assert new_state == {}
+
+
+_BLOCKS = f"blocks/{ROOT_PAGE_ID}/children"
+_QUERY = f"data_sources/{DATA_SOURCE_ID}/query"
+_NO_RESULTS = "without a results list"
+_NO_HAS_MORE = "without a has_more flag"
+# A page whose answer cannot be read as a page of results, and the error that says why.
+_BAD_PAGES = [
+    ({"has_more": False}, _NO_RESULTS),
+    ({"results": None}, _NO_RESULTS),
+    ({"results": {}}, _NO_RESULTS),
+    ({"results": [None], "has_more": False}, "not an object"),
+    ({"results": []}, _NO_HAS_MORE),
+    ({"results": [], "next_cursor": "c"}, _NO_HAS_MORE),
+    # Truthy, so only the type check stops it from reading as "more pages".
+    ({"results": [], "has_more": "false", "next_cursor": "c"}, _NO_HAS_MORE),
+    ({"results": [], "has_more": True}, "more results without a next_cursor"),
+]
+
+
+@pytest.mark.parametrize(("body", "message"), _BAD_PAGES)
+@pytest.mark.parametrize("listing", [_BLOCKS, _QUERY])
+def test_a_listing_page_that_cannot_be_read_aborts_without_tombstones(listing, body, message):
+    """A missing field is not an empty or last page: reading it as one would end the walk and
+    tombstone every page synced from below it."""
+
+    def answer_for(request):
+        if request.url.path.endswith(listing):
+            return httpx.Response(200, json={"object": "list", **body})
+
+    _resync_aborts(_tree_with_database(), answer_for, message)
+
+
+@pytest.mark.parametrize(("body", "message"), _BAD_PAGES)
+@pytest.mark.parametrize("listing", [_BLOCKS, _QUERY])
+def test_a_later_page_that_cannot_be_read_aborts_without_tombstones(listing, body, message):
+    """The page that is cut short is the second one: the first is complete and well formed."""
+
+    def answer_for(request):
+        if not request.url.path.endswith(listing):
+            return None
+        sent = request.url.params.get("start_cursor") or json.loads(request.content or b"{}").get(
+            "start_cursor"
+        )
+        if sent:
+            return httpx.Response(200, json={"object": "list", **body})
+        return httpx.Response(
+            200, json={"object": "list", "results": [], "has_more": True, "next_cursor": "c2"}
+        )
+
+    _resync_aborts(_tree_with_database(), answer_for, message)
+
+
+@pytest.mark.parametrize(
+    "content",
+    [b"[]", b'"x"', b"1", b"null", b"not json"],
+    ids=["list", "str", "int", "null", "raw"],
+)
+@pytest.mark.parametrize("listing", [_BLOCKS, _QUERY])
+def test_an_answer_that_is_not_a_json_object_aborts_without_tombstones(listing, content):
+    def answer_for(request):
+        if request.url.path.endswith(listing):
+            return httpx.Response(200, content=content)
+
+    _resync_aborts(_tree_with_database(), answer_for, "without a JSON object")
+
+
+@pytest.mark.parametrize(
+    "block",
+    [
+        {"id": "b", "has_children": False},
+        {"id": "b", "type": "toggle"},
+        {"id": "b", "type": "toggle", "has_children": "false"},
+        {"id": "b", "type": None, "has_children": False},
+    ],
+    ids=["no-type", "no-has_children", "has_children-not-bool", "type-null"],
+)
+def test_a_block_missing_its_type_or_has_children_aborts_without_tombstones(block):
+    """Without ``has_children`` a toggle's 
```

---

### Incident Patch 3: `83742468` (2026-11-26)
**Commit Message**: fix(broad): Measure store_mb in text and return clear limit errors (#6875)

<!-- .github/pull_request_template.md -->

## Description
<!--
Please provide a clear, human-generated description of the changes in
this PR.
DO NOT use AI-generated descriptions. We want to understand your thought
process and reasoning.
-->
Fixes three BROAD limit problems found in manual release testing of
`dev` (SDK-1757).

| Problem | Before | After |
|---|---|---|
| `store_mb` unit | Whole-vs-partial decision used stored file bytes;
the partial budget counted characters of text | Both count characters of
text, measured as the dataset is loaded |
| Non-finite limits (`NaN`, `Infinity`, `1e999`) | HTTP 500 with a
traceback; bare `TypeError`/`OverflowError` in the SDK | HTTP 400 naming
the setting; `ValueError` naming the setting in the SDK |
| `BroadLimitError` | 500 on `/search`, unrelated 422 on `/recall` | 422
with the "Raise batch_mb" message on both |

## What changed

- **`store_mb`:** the file-bytes gate (`dataset_size`) is removed. The
dataset is loaded whole while characters are counted; once the text
passes `store_mb`, loading stops and the most similar parts are loaded
into a new store.
- **Co

**File**: `cognee/api/client.py` (modified, +7/-1)
```diff
@@ -1,5 +1,6 @@
 """FastAPI server for the Cognee API."""
 
+import math
 import os
 from contextlib import asynccontextmanager
 from traceback import format_exc
@@ -303,9 +304,14 @@ async def request_validation_exception_handler(request: Request, exc: RequestVal
             content={"detail": "LOGIN_BAD_CREDENTIALS"},
         )
 
+    # The rejected input is echoed back, and JSON cannot hold NaN or Infinity: those are
+    # written as text so the answer stays the 400 it is.
     return JSONResponse(
         status_code=400,
-        content=jsonable_encoder({"detail": exc.errors(), "body": exc.body}),
+        content=jsonable_encoder(
+            {"detail": exc.errors(), "body": exc.body},
+            custom_encoder={float: lambda value: value if math.isfinite(value) else str(value)},
+        ),
     )
 
 
```

**File**: `cognee/modules/retrieval/README.md` (modified, +10/-7)
```diff
@@ -49,13 +49,16 @@ connection. Graph/vector I/O and LLM calls remain on the caller's async event lo
 Cancelling a retrieval interrupts active SQLite work; any running Python stage must
 finish before the queued close can release its store. Waiting for cleanup is asynchronous.
 
-`retriever_specific_config["store_mb"]` defaults to `512` (512 MB in decimal units).
-Datasets whose stored document sizes sum to at most that threshold are loaded whole.
-Above it, the existing similarity-selected subset is used and the answer reports partial
-coverage. The selected text is budgeted in million characters. This setting does not cap
-process RAM: SQLite storage, parsed rows and document batches also consume memory, and
-concurrent retrievals each own a separate store. The 256 MB batching budget and token and
-result-row limits are independent of this threshold.
+`retriever_specific_config["store_mb"]` defaults to `512` and counts megabytes of text
+(million characters), the same on both sides of the threshold. A dataset holding at most
+that much text is loaded whole. Above it, the parts most similar to the question are
+loaded up to the same size, and the answer reports partial coverage as the text held and
+an estimate of the dataset's text. The stored file sizes do not decide this: a CSV holds
+more text than bytes, a PDF far less. The text is measured as it is read, so a dataset
+over the threshold is read up to it once before its most similar parts are loaded. This
+setting does not cap process RAM: SQLite storage, parsed rows and document batches also
+consume memory, and concurrent retrievals each own a separate store. The 256 MB batching
+budget and token and result-row limits are independent of this threshold.
 
 ## The contract
 
```

**File**: `cognee/modules/retrieval/broad_retriever.py` (modified, +105/-65)
```diff
@@ -16,17 +16,19 @@
 """
 
 import json
+import math
 import re
 from collections.abc import AsyncIterator
 from dataclasses import dataclass, field
 from itertools import groupby, pairwise
 from typing import Any, Literal
 from uuid import UUID
 
+from fastapi import status
 from pydantic import BaseModel, Field
-from sqlalchemy import func, select
+from sqlalchemy import select
 
-from cognee.context_global_variables import current_dataset_id
+from cognee.exceptions import CogneeValidationError
 from cognee.infrastructure.databases.relational import get_relational_engine
 from cognee.infrastructure.databases.unified import get_unified_engine
 from cognee.infrastructure.databases.vector.exceptions import CollectionNotFoundError
@@ -51,8 +53,9 @@
 BROAD_READING_TOKENS = 12_000
 # Megabytes of text held in memory at once while the store is built.
 BROAD_BATCH_MB = 256
-# A dataset up to this many megabytes is loaded into the store whole; a larger one is
-# represented by the parts most similar to the question, up to this size.
+# A dataset holding up to this many megabytes (million characters) of text is loaded into
+# the store whole; a larger one is represented by the parts most similar to the question,
+# up to this size.
 BROAD_STORE_MB = 512
 # The least text a chunk is assumed to hold, when deciding how many to ask the vector
 # store for; a chunk is rarely shorter.
@@ -70,8 +73,17 @@
 _MIN_CHUNK_TOKENS = 256
 
 
-class BroadLimitError(ValueError):
-    """The dataset exceeds a BROAD limit; the message names the setting to raise."""
+class BroadLimitError(CogneeValidationError):
+    """The dataset exceeds a BROAD limit; the message names the setting to raise. Not
+    logged when raised: recall catches it on a routed guess and answers another way."""
+
+    def __init__(
+        self,
+        message: str,
+        name: str = "BroadLimitError",
+        status_code: int = status.HTTP_422_UNPROCESSABLE_CONTENT,
+    ):
+        super().__init__(message, name, status_code, log=False)
 
 
 class BroadNoTextError(NoDataError):
@@ -146,22 +158,41 @@ def _units_of(nodes: list, edges: list, names: dict[str, str]) -> list[Unit]:
 class Corpus:
     """A dataset's documents, fetched from the graph in batches of whole documents so the
     text held at once stays near ``batch_chars``. Batches are planned from each document's
-    stored size, scaled by how much text a stored byte turned out to hold; a document
-    larger than a batch raises."""
+    stored size, scaled by how much text a stored byte turned out to hold. The batches
+    end early once the text read passes ``store_chars``: the dataset is then too large to
+    load whole (``over_store``). A document larger than a batch is left out and raises
+    once the rest is read, so only when the dataset would otherwise load whole."""
 
     graph: Any
     documents: list[str]
     names: dict[str, str]
     sizes: dict[str, int]
     batch_chars: int
+    store_chars: int
     worker: BroadWorker
+    # The text read so far, in characters, and the stored bytes of the documents it came from.
+    read_chars: int = 0
+    read_stored: int = 0
+
+    @property
+    def over_store(self) -> bool:
+        return self.read_chars > self.store_chars
+
+    def estimated_chars(self) -> int | None:
+        """The whole dataset's text in characters, estimated from the text the documents
+        read so far held per stored byte; None when their stored sizes are unknown."""
+        if not self.read_stored:
+            return None
+        return round(self.read_chars * sum(self.sizes.values()) / self.read_stored)
 
     async def fetch(self, documents: list[str]) -> list[Unit]:
         nodes, edges = await self.graph.get_neighborhood(documents, depth=1)
         return await self.worker.run(_units_of, nodes, edges, self.names)
 
     async def batches(self) -> AsyncIterator[list[Unit]]:
         ratio, start = 1.0, 0
+        # The first document larger than a batch, and its text in characters.
+        oversized: tuple[str, int] | None = None
         while start < len(self.documents):
             batch = [self.documents[start]]
             planned = self.sizes.get(batch[0], 0) * ratio
@@ -173,17 +204,25 @@ async def batches(self) -> AsyncIterator[list[Unit]]:
                 planned += size * ratio
             units = await self.fetch(batch)
             text = sum(len(unit.text) for unit in units)
-            if len(batch) == 1 and text > self.batch_chars:
-                raise BroadLimitError(
-                    f"BROAD: document {self.names.get(batch[0], batch[0])} holds {text:,} "
-                    f"characters of text, more than one batch of {self.batch_chars:,} "
-                    "(batch_mb). Raise batch_mb in retriever_specific_config."
-                )
             stored = sum(self.sizes.get(document, 0) for document in batch)
+            self.read_chars += text
+            self.read_stored += stored
+            if self.over_sto
```

**File**: `cognee/tests/performance/benchmark_broad_quality.py` (modified, +0/-3)
```diff
@@ -357,9 +357,6 @@ class Retriever(BroadRetriever):
             responses = decisions
             fixed_sql = reference_sql
 
-            async def dataset_size(self):
-                return fixture.manifest["bytes"]
-
             async def document_sizes(self, documents):
                 return {doc: fixture.documents[doc]["bytes"] for doc in documents}
 
```

**File**: `cognee/tests/performance/benchmark_broad_store.py` (modified, +0/-3)
```diff
@@ -224,9 +224,6 @@ def close(self):
             timings["close"] += time.perf_counter() - started
 
     class FixedSQLRetriever(BroadRetriever):
-        async def dataset_size(self):
-            return sum(graph.sizes.values())
-
         async def document_sizes(self, documents):
             return {document: graph.sizes[document] for document in documents}
 
```

**File**: `cognee/tests/unit/api/test_retriever_specific_config_over_http.py` (modified, +48/-4)
```diff
@@ -1,7 +1,8 @@
 """POST /api/v1/search and /recall forward retriever_specific_config to the SDK call,
 the way the SDK's own search()/recall() already accept it. The known keys are checked
 for type and upper bound, and the one key JSON cannot carry (response_model) is rejected.
-A rejected request answers 400: the app maps every request validation error to 400."""
+A rejected request answers 400: the app maps every request validation error to 400.
+A BROAD limit the dataset exceeds answers 422 with the setting to raise."""
 
 import importlib
 from types import SimpleNamespace
@@ -12,7 +13,9 @@
 from fastapi.exceptions import RequestValidationError
 from fastapi.testclient import TestClient
 
-from cognee.api.client import request_validation_exception_handler
+from cognee.api.client import exception_handler, request_validation_exception_handler
+from cognee.exceptions import CogneeApiError
+from cognee.modules.retrieval.broad_retriever import BroadLimitError
 
 search_router_module = importlib.import_module("cognee.api.v1.search.routers.get_search_router")
 recall_router_module = importlib.import_module("cognee.api.v1.recall.routers.get_recall_router")
@@ -29,11 +32,12 @@
 def _app(router_module, name):
     """An app serving ``get_<name>_router()`` under ``/api/v1/<name>`` for a stub user.
 
-    It registers the production validation handler, so a rejected body answers with the
-    status a real client gets.
+    It registers the production error handlers, so a rejected body or a cognee error
+    answers with the status a real client gets.
     """
     app = FastAPI()
     app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
+    app.add_exception_handler(CogneeApiError, exception_handler)
     app.include_router(getattr(router_module, f"get_{name}_router")(), prefix=f"/api/v1/{name}")
     app.dependency_overrides[router_module.get_authenticated_user] = lambda: SimpleNamespace(
         id=uuid4(), tenant_id=None
@@ -214,3 +218,43 @@ def test_values_at_the_bounds_and_unknown_keys_pass(search_client):
 
     assert response.status_code == 200, response.text
     assert captured["retriever_specific_config"] == config
+
+
+@pytest.mark.parametrize("route", ["search", "recall"])
+@pytest.mark.parametrize("key", ["store_mb", "batch_mb"])
+@pytest.mark.parametrize("number", ["NaN", "Infinity", "-Infinity", "1e999"])
+def test_non_finite_limits_are_rejected_with_a_readable_400(
+    search_client, recall_client, route, key, number
+):
+    """JSON cannot hold the rejected NaN or Infinity, so the 400 echoes it as text."""
+    client = search_client[0] if route == "search" else recall_client[0]
+    captured = search_client[1] if route == "search" else recall_client[1]
+    body = f'{{"query": "q", "retrieverSpecificConfig": {{"{key}": {number}}}}}'
+
+    response = client.post(
+        f"/api/v1/{route}", content=body, headers={"Content-Type": "application/json"}
+    )
+
+    assert response.status_code == 400, response.text
+    assert key in response.json()["detail"][0]["msg"]
+    assert "Traceback" not in response.text
+    assert captured == {}
+
+
+@pytest.mark.parametrize("route", ["search", "recall"])
+def test_a_broad_limit_answers_422_with_the_setting_to_raise(
+    monkeypatch, search_client, recall_client, route
+):
+    message = "BROAD: document a.csv holds too much text. Raise batch_mb."
+
+    async def over_the_limit(**kwargs):
+        raise BroadLimitError(message)
+
+    package = importlib.import_module(f"cognee.api.v1.{route}")
+    monkeypatch.setattr(package, route, over_the_limit)
+    client = search_client[0] if route == "search" else recall_client[0]
+
+    response = client.post(f"/api/v1/{route}", json={"query": "q", "searchType": "BROAD"})
+
+    assert response.status_code == 422, response.text
+    assert response.json()["detail"] == f"{message} [BroadLimitError]"
```

**File**: `cognee/tests/unit/modules/retrieval/test_broad_retriever.py` (modified, +137/-26)
```diff
@@ -11,6 +11,7 @@
 from cognee.infrastructure.databases.vector.exceptions import CollectionNotFoundError
 from cognee.modules.retrieval import broad_retriever
 from cognee.modules.retrieval.broad_retriever import (
+    BroadLimitError,
     BroadNoTextError,
     BroadRetriever,
     DecisionLarge,
@@ -248,36 +249,151 @@ def test_the_settings_are_positive():
         BroadRetriever(reading_tokens=0)
 
 
+@pytest.mark.parametrize("setting", ["context_tokens", "reading_tokens", "batch_mb", "store_mb"])
+@pytest.mark.parametrize("value", ["abc", None, True, float("inf"), float("nan"), -1])
+def test_a_setting_that_is_not_a_positive_finite_number_is_named(setting, value):
+    with pytest.raises(ValueError, match=f"BROAD {setting} must be"):
+        BroadRetriever(**{setting: value})
+
+
+class _OneChunkVector:
+    """Ranks the given chunks best first and serves their text; each is its own document."""
+
+    def __init__(self, texts: dict[str, str]):
+        self.texts = texts
+
+    async def search(self, collection, *args, **kwargs):
+        if collection != "DocumentChunk_text":
+            raise CollectionNotFoundError("none")
+        return [
+            SimpleNamespace(id=name, score=n / 10, payload=None)
+            for n, name in enumerate(self.texts)
+        ]
+
+    async def retrieve(self, collection, ids):
+        return [
+            SimpleNamespace(
+                id=name,
+                score=0,
+                payload={"text": self.texts[name], "document_id": name, "document_name": name},
+            )
+            for name in ids
+        ]
+
+
+def test_the_default_store_holds_512_mb_of_text():
+    assert BroadRetriever().store_chars == 512_000_000
+
+
 @pytest.mark.asyncio
 @pytest.mark.parametrize(
-    ("dataset_bytes", "expected_rows", "partial"),
-    [(32_000_001, 2, False), (512_000_000, 2, False), (512_000_001, 1, True)],
+    ("store_chars", "expected_rows", "partial"), [(22, 2, False), (21, 2, False), (20, 1, True)]
 )
-async def test_default_store_covers_all_records_through_512_mb(
-    monkeypatch, dataset_bytes, expected_rows, partial
+@pytest.mark.parametrize("stored_bytes", [1, 10, 1_000_000_000])
+async def test_store_mb_is_compared_with_the_text_not_the_stored_bytes(
+    monkeypatch, store_chars, expected_rows, partial, stored_bytes
 ):
-    class Vector:
-        async def search(self, collection, *args, **kwargs):
-            if collection != "DocumentChunk_text":
-                raise CollectionNotFoundError("none")
-            return [SimpleNamespace(id="c1", score=0.1, payload=None)]
+    """21 characters of text: loaded whole into a store of 21, whatever the files weigh
+    (a CSV holds more text than bytes, a PDF far less)."""
+    texts = {"a": "Alpha only.", "b": "Beta only."}
+    _use(monkeypatch, texts, vector=_OneChunkVector(texts), size=stored_bytes)
+    _llm(monkeypatch, [DecisionLarge(sql="SELECT COUNT(*) FROM lines")])
+    retriever = BroadRetriever(context_tokens=1)
+    retriever.store_chars = store_chars
 
-        async def retrieve(self, collection, ids):
-            payload = {"text": "Beta only.", "document_id": "d1", "document_name": "b"}
-            return [SimpleNamespace(id="c1", score=0, payload=payload)]
+    found = await retriever.get_retrieved_objects("How many lines?")
 
-    _use(monkeypatch, {"a": "Alpha only.", "b": "Beta only."}, vector=Vector())
+    assert found.rows == [(expected_rows,)]
+    assert bool(found.coverage) is partial
 
-    async def dataset_size(self):
-        return dataset_bytes
 
-    monkeypatch.setattr(BroadRetriever, "dataset_size", dataset_size)
+@pytest.mark.asyncio
+async def test_a_store_just_under_the_text_holds_nearly_all_of_it(monkeypatch):
+    """One character short of the dataset costs one part, not most of the store: the
+    threshold and the size of the most similar parts are the same characters."""
+    texts = {f"doc{n}": f"row {n:02d}\n" for n in range(40)}  # 7 characters each, 280 in all
+    _use(monkeypatch, texts, vector=_OneChunkVector(texts), size=1)  # 40 bytes stored
     _llm(monkeypatch, [DecisionLarge(sql="SELECT COUNT(*) FROM lines")])
+    retriever = BroadRetriever(context_tokens=1)
+    retriever.store_chars = 279
 
-    found = await BroadRetriever(context_tokens=1).get_retrieved_objects("How many lines?")
+    found = await retriever.get_retrieved_objects("How many rows?")
 
-    assert found.rows == [(expected_rows,)]
-    assert bool(found.coverage) is partial
+    assert found.rows == [(39,)]
+    assert "39 parts of the dataset most similar" in found.coverage
+
+
+@pytest.mark.asyncio
+async def test_partial_coverage_states_the_text_held_and_the_estimated_text_of_the_dataset(
+    monkeypatch,
+):
+    """Both sizes are characters of text. The total is estimated from what the documents
+    read before the store was full held per stored byte."""
+    document = "".join(f"row {n:05d}\n" for n in range(1_000))  # 10,000 characters
+    texts = {f"doc{
```

#### Recent Merged Pull Requests:
- **PR #6883** (2026-11-26): fix(ci): Provide the Ladybug v0.17.0 JSON extension to the migration test (SDK-1760) (@siillee)
- **PR #6882** (2026-11-26): fix(code_graph): Read enola 0.5.4 cluster output (SDK-1759) (@Vasilije1990)
- **PR #6880** (2026-11-26): chore: bump enola-cli to 0.5.4 (@siillee)
- **PR #6879** (2026-11-26): chore: release v1.6.11 (@siillee)
- **PR #6878** (2026-11-26): chore: release v1.6.11 (@siillee)
- **PR #6875** (2026-11-26): fix(broad): Measure store_mb in text and return clear limit errors (@siillee)

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

## X. code_graph): Read enola 0.5.4 cluster output (SDK-1759)

**RULE**:
When implementing operations in `cognee/tasks/code_graph/cluster.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in topoteretes/cognee. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f508a230`: code_graph): Read enola 0.5.4 cluster output (SDK-1759). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `cognee/tasks/code_graph/cluster.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
listing them, and writes the whole linked graph once, to a directory of the
dataset's own outside the repositories (see :func:`cluster_snapshot_dir`).
import os
    """The working directory enola keeps inside each member for a dataset's cluster runs.
    It holds the member's extractor cache, not a snapshot. A remote clone is
    shared by every dataset that adds its URL, so the name is the dataset's
    own rather than the ``.enola`` a single-repository run writes its snapshot
    to. enola takes the name relative to each repository.
def cluster_snapshot_dir(dataset_id: UUID) -> Path:
    """Where a dataset's cluster snapshot is written: one directory per dataset.
    enola writes a cluster's graph once and refuses a directory inside a
    member repository, so it lives next to the clones, under
    ``BaseConfig.repos_root_directory`` (``COGNEE_REPOS_DIR``), which is a
    local directory whatever the storage backend. A clone's directory name
    never starts with a dot, so no clone can take this one's place.
    from cognee.tasks.code_graph.resolve_repo import default_clones_dir
    return default_clones_dir() / ".enola-clusters" / str(dataset_id)
def resolve_member_labels(repo_p
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
listing them, and writes the whole linked graph into every member, under a
directory of the dataset's own (``.enola-<dataset_id>``, see
:func:`cluster_output_dir`) rather than the shared ``.enola``.
    snapshot_identity,
    """Where, inside each member repository, a dataset's cluster snapshot is written.
    A remote clone is shared by every dataset that adds its URL, and a cluster
    snapshot holds the facts of all the dataset's repositories. One directory
    per dataset keeps a cluster run from overwriting the snapshot another
    dataset is reading. enola takes the name relative to each repository.
def _written_label(repo_path: Path, output_dir: str, snapshot_id: str | None) -> str | None:
    """The label enola gave a member in the snapshot just taken, or None.
    A cluster run writes ``snapshot.meta.json`` into every member's
    ``output_dir`` with the member's own ``repo_label`` — the exact name its
    facts carry. The file is enola's own bookkeeping rather than part of the
    documented snapshot contract, so it is only trusted when it describes
    this snapshot (same ``snapshot_id``) and the caller falls back to
    deriving the label when it is missing or stale.
  
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f508a230` are properly handled with clean fallback behavior.
