# Forensic Learning Record (Deep Inspection): bojieli/ai-agent-book

> **Canonical Artifact**: `07_PROJECT_LEARNING/bojieli-ai-agent-book-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bojieli/ai-agent-book](https://github.com/bojieli/ai-agent-book))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:37:37.013Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bojieli/ai-agent-book`
- **Description**: 《深入理解 AI Agent：设计原理与工程实践》（李博杰 著）开源主仓库：全书正文、编译版 PDF 与按章配套代码
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 51927 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agentbook/__init__.py`
```
"""Shared packaging and plumbing for the ai-agent-book companion experiments.

This package exists so the repo can declare its dependencies once (see the root
``pyproject.toml``) instead of repeating them across per-project
``requirements.txt`` files.

Install what a chapter needs::

    pip install -e ".[ch1]"     # chapter 1, no GPU stack
    pip install -e ".[ch7]"     # heavy fine-tuning deps, opt in explicitly

Scope: this package holds *plumbing only* -- provider resolution, environment
loading, trace printing. The teaching code stays inside each chapter's
experiment directory, where a reader can follow it top to bottom.
"""

__version__ = "0.1.0"

__all__ = ["__version__"]

```

### Core Architecture Module: `agentbook/providers/__init__.py`
```
"""Single source of truth for LLM provider resolution.

Every chapter experiment talks to an OpenAI-compatible endpoint. What differs
per provider is only the base URL, the default model id, and which environment
variable holds the key -- so all of that lives here instead of being repeated
in each experiment.

Typical use::

    from agentbook.providers import resolve_backend

    backend = resolve_backend("kimi")
    client = OpenAI(api_key=backend.api_key, base_url=backend.base_url)
    ...
    client.chat.completions.create(model=backend.model, ...)

Adding a provider is one entry in :data:`PROVIDERS`, in
:mod:`~agentbook.providers.registry`.

Free / zero-cost options:

* ``ollama``   -- runs models on your own machine, no API key, no cost.
* ``openrouter`` with a ``:free`` model id, e.g.::

      OPENROUTER_API_KEY=your-openrouter-api-key
      OPENROUTER_MODEL=google/gemma-4-31b-it:free

  The model runs on OpenRouter's servers, so a modest laptop is fine.

Package layout, in dependency order -- each module imports only from those
above it:

* :mod:`~agentbook.providers.models` -- the ``Provider`` and ``Backend`` types
* :mod:`~agentbook.providers.openrouter` -- OpenRouter constants and model mapping
* :mod:`~agentbook.providers.registry` -- the provider table and name lookup
* :mod:`~agentbook.providers.resolution` -- the precedence rules
* :mod:`~agentbook.providers.legacy` -- the pre-registry compatibility shim

This module re-exports the full public surface, so importing from
``agentbook.providers`` directly is the supported way to use the package.
"""

from __future__ import annotations

from .legacy import resolve_llm_backend
from .models import Backend, Provider
from .openrouter import (
    OPENROUTER_BASE_URL,
    OPENROUTER_DEFAULT_MODEL,
    is_openrouter_key,
    map_model_to_openrouter,
)
from .registry import PROVIDERS, SUPPORTED_PROVIDERS, canonical_provider
from .resolution import resolve_backend

__all__ = [
    "OPENROUTER_BASE_URL",
    "OPENROUTER_DEFAULT_MODEL",
    "PROVIDERS",
    "SUPPORTED_PROVIDERS",
    "Backend",
    "Provider",
    "canonical_provider",
    "is_openrouter_key",
    "map_model_to_openrouter",
    "resolve_backend",
    "resolve_llm_backend",
]

```

### Core Architecture Module: `agentbook/providers/legacy.py`
```
"""Backwards-compatible shim for the pre-registry chapter helper.

Before the shared registry existed, three chapter experiments each carried
their own copy of ``resolve_llm_backend``. It is still imported by three
chapter modules and called by two of them, so it stays until all of them are
migrated:

* ``chapter1/web-search-agent/agent.py`` -- calls it
* ``chapter1/learning-from-experience/llm_agent.py`` -- calls it
* ``chapter1/context/config.py`` -- re-exports it for its own importers

Deleting this function therefore breaks ``chapter1/context`` at import time
even though that module never calls it.

It cannot simply delegate to :func:`~agentbook.providers.resolution.resolve_backend`:
callers pass a bare ``base_url`` with no provider name, which the registry has
no way to express. What it *can* share is the OpenRouter construction, so the
two code paths cannot drift apart on the part that matters.
"""

from __future__ import annotations

from .openrouter import ZERO_COST_HINT, openrouter_key
from .resolution import build_openrouter_backend

__all__ = ["resolve_llm_backend"]

_NO_KEY_MESSAGE = (
    "No API key found. Set a provider key (DASHSCOPE_API_KEY / SILICONFLOW_API_KEY / ARK_API_KEY / "
    "MOONSHOT_API_KEY / DEEPSEEK_API_KEY / ZHIPU_API_KEY / OPENAI_API_KEY / "
    "GEMINI_API_KEY) or OPENROUTER_API_KEY (universal fallback). " + ZERO_COST_HINT
)


def resolve_llm_backend(
    primary_key: str | None,
    primary_base_url: str,
    model: str,
) -> tuple[str, str, str, bool]:
    """Resolve a backend from a loose key/URL pair, as the old helper did.

    Prefer :func:`~agentbook.providers.resolution.resolve_backend`, which knows
    the provider registry and therefore reports far better errors. This exists
    for call sites that only have a base URL and no provider name.

    Args:
        primary_key: The caller's own API key. Falsy values trigger the
            OpenRouter fallback.
        primary_base_url: Endpoint matching ``primary_key``.
        model: Requested model id. Mapped to an OpenRouter id when the request
            is rerouted, and passed through untouched otherwise.

    Returns:
        A plain ``(api_key, base_url, model, using_openrouter)`` tuple. Callers
        compare this against tuple literals, so it deliberately stays a tuple
        rather than becoming a :class:`~agentbook.providers.models.Backend`.

    Raises:
        ValueError: If neither ``primary_key`` nor ``OPENROUTER_API_KEY`` is
            set.
    """
    fallback_key = openrouter_key()

    # gpt-5.x needs OpenAI org verification on the direct API; prefer OpenRouter
    # even when the caller supplied their own key.
    if fallback_key and str(model or "").lower().startswith("gpt-5"):
        return tuple(build_openrouter_backend(model, fallback_key))

    if primary_key:
        return primary_key, primary_base_url, model, False

    if fallback_key:
        return tuple(build_openrouter_backend(model, fallback_key))

    raise ValueError(_NO_KEY_MESSAGE)

```

### Core Architecture Module: `agentbook/providers/models.py`
```
"""Dataclasses describing providers and resolved backends.

This module is the leaf of the package's dependency graph: it defines the two
value types the rest of the package builds on, and imports nothing from its
siblings.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

__all__ = ["Backend", "Provider"]


@dataclass(frozen=True)
class Provider:
    """Static description of an OpenAI-compatible backend.

    Attributes:
        name: Canonical provider name, e.g. ``"kimi"``.
        base_url: Default API endpoint, used when no override is set.
        default_model: Model id used when the caller does not pick one.
        key_vars: Environment variables holding the API key, tried in order.
            The first non-empty one wins; later entries exist for backwards
            compatibility.
        base_url_var: Environment variable overriding ``base_url``, for
            self-hosted or regional deployments. ``None`` if not overridable.
        requires_key: Whether a missing key is an error. Local runtimes such as
            Ollama accept any placeholder, so they set this to ``False``.
        namespaces_models: Whether this backend expects vendor-namespaced model
            ids such as ``openai/gpt-4o`` rather than bare ones. True for
            aggregators that resell many vendors' models; a bare id given to
            one of these is mapped before the request goes out.

            This describes *model-id formatting only*. It says nothing about
            which endpoint to call or whose credentials are valid -- an
            aggregator sharing OpenRouter's id format still has its own
            ``base_url`` and its own key, and is never routed through
            OpenRouter on that basis.
    """

    name: str
    base_url: str
    default_model: str
    key_vars: tuple[str, ...] = ()
    base_url_var: str | None = None
    requires_key: bool = True
    namespaces_models: bool = False

    def api_key(self) -> str:
        """Read this provider's API key from the environment.

        Returns:
            The first non-empty value among ``key_vars``, stripped of
            surrounding whitespace, or ``""`` when none is set.
        """
        for var in self.key_vars:
            value = os.getenv(var, "").strip()
            if value:
                return value
        return ""

    def resolved_base_url(self) -> str:
        """Return the endpoint to call, honouring any environment override.

        Returns:
            The value of ``base_url_var`` if that variable is set and non-empty,
            otherwise the built-in ``base_url``.
        """
        if self.base_url_var:
            return os.getenv(self.base_url_var, "").strip() or self.base_url
        return self.base_url


@dataclass(frozen=True)
class Backend:
    """A resolved, ready-to-use OpenAI-compatible endpoint.

    Attributes:
        api_key: Credential for ``base_url``. Never empty -- local runtimes get
            a placeholder, because the OpenAI client rejects an empty key.
        base_url: The endpoint to send requests to.
        model: Model id valid at ``base_url``. Note this may differ from the
            requested id when the request was rerouted through OpenRouter.
        provider: The provider that was requested, after alias resolution.
        using_openrouter: Whether the request is going through OpenRouter
            rather than the provider's own API.
    """

    api_key: str
    base_url: str
    model: str
    provider: str
    using_openrouter: bool

    def __iter__(self):
        """Unpack as the 4-tuple the pre-registry chapter helpers returned.

        Returns:
            An iterator over ``api_key``, ``base_url``, ``model`` and
            ``using_openrouter``, in that order.
        """
        return iter((self.api_key, self.base_url, self.model, self.using_openrouter))

```

### Core Architecture Module: `agentbook/providers/openrouter.py`
```
"""OpenRouter endpoint constants and model-id mapping.

OpenRouter is the universal fallback: it speaks the OpenAI protocol and hosts
models from many vendors, so any chapter can run against it with a single key.
The catch is that it namespaces model ids (``openai/gpt-4o`` rather than
``gpt-4o``), which is what :func:`map_model_to_openrouter` translates.

Everything OpenRouter-specific lives here, so a change to its ids or endpoint
touches exactly one module.
"""

from __future__ import annotations

import os

__all__ = [
    "OPENROUTER_BASE_URL",
    "OPENROUTER_DEFAULT_MODEL",
    "ZERO_COST_HINT",
    "is_openrouter_key",
    "map_model_to_openrouter",
    "openrouter_base_url",
    "openrouter_key",
]

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_DEFAULT_MODEL = "openai/gpt-5.6-luna"

# Appended to every "no key configured" error so the way out of the problem is
# stated once rather than copied into each message.
ZERO_COST_HINT = (
    "For a zero-cost setup use provider 'ollama' (local, no key) or "
    "OPENROUTER_MODEL with a ':free' model id."
)


def openrouter_key() -> str:
    """Read the OpenRouter API key from the environment.

    Returns:
        The value of ``OPENROUTER_API_KEY``, stripped, or ``""`` when unset.
    """
    return os.getenv("OPENROUTER_API_KEY", "").strip()


def is_openrouter_key(api_key: str) -> bool:
    """Report whether a credential looks like an OpenRouter key.

    OpenRouter issues keys under the ``sk-or-`` prefix, so a key the reader
    pasted can usually be attributed without asking them which service it came
    from. This is a naming convention rather than a guarantee, which bounds
    where the answer may be used.

    Intended for callers that accept a key of unknown origin -- a CLI taking
    ``--api-key``, say -- and must pick which provider to resolve. It is
    deliberately *not* used by :func:`~agentbook.providers.resolve_backend`,
    whose ``api_key`` argument means "this provider's credential"; inferring
    routing from the value there would silently override the caller and send a
    provider's key to the wrong host when a prefix collides.

    Args:
        api_key: A credential of unknown origin. ``None`` and ``""`` are
            tolerated and report ``False``.

    Returns:
        ``True`` if the key carries OpenRouter's prefix.
    """
    return (api_key or "").strip().startswith("sk-or-")


def openrouter_base_url() -> str:
    """Return the OpenRouter endpoint, honouring an environment override.

    Returns:
        The value of ``OPENROUTER_BASE_URL`` if set and non-empty, otherwise
        the default public endpoint.
    """
    return os.getenv("OPENROUTER_BASE_URL", "").strip() or OPENROUTER_BASE_URL


def map_model_to_openrouter(model: str, *, substitute_unknown: bool = False) -> str:
    """Map a bare model id to the equivalent OpenRouter model id.

    Mapping rules, applied in order:

    * ids already containing ``/`` are returned unchanged (already OpenRouter form)
    * ``gpt-*`` / ``o1*`` / ``o3*`` / ``o4*`` / ``chatgpt*`` become ``openai/<id>``
    * ``claude-*`` becomes the matching Anthropic id
    * ``gemini*`` becomes ``google/<id>``
    * ``kimi-*`` becomes ``moonshotai/kimi-k2.6`` (kimi-k3 is not hosted)
    * ``deepseek-*`` becomes ``deepseek/<id>``
    * ``qwen-*`` / ``qwen2*`` / ``qwen3*`` becomes ``qwen/<id>``
    What to do with an unmapped id -- a native one such as ``doubao-*`` or
    ``glm-*``, which OpenRouter does not reliably host -- depends on why the
    caller is mapping, so it is the caller's decision rather than a fixed rule
    here. Talking to an aggregator that *requires* a namespaced id, a working
    default beats a request that cannot succeed. Rerouting a request the reader
    already aimed at a named model, silently answering as a different vendor's
    model is worse than failing.

    Args:
        model: A bare or already-namespaced model id. ``None`` and ``""`` are
            tolerated.
        substitute_unknown: When ``True``, an unmapped id becomes
            ``OPENROUTER_MODEL`` or the package default. When ``False`` it is
            returned unchanged, to be rejected by OpenRouter under the name the
            reader actually asked for.

    Returns:
        An OpenRouter model id, or the unchanged input for an unmapped id when
        ``substitute_unknown`` is ``False``.
    """
    m = (model or "").strip()
    if "/" in m:
        return m
    ml = m.lower()
    # The o-series ships bare ids too ("o3", "o4-mini"), so the prefixes are
    # matched without the dash the other families need.
    if ml.startswith(("gpt-", "o1", "o3", "o4", "chatgpt")):
        return "openai/" + m
    if ml.startswith("claude-"):
        if "sonnet" in ml:
            return "anthropic/claude-sonnet-4.6"
        if "haiku" in ml:
            return "anthropic/claude-haiku-4.5"
        return "anthropic/claude-opus-4.8"
    if ml.startswith("gemini"):
        return "google/" + m
    if ml.startswith("kimi"):
        return "moonshotai/kimi-k2.6"
    if ml.startswith("deepseek"):
        return "deepseek/" + m
    if ml.startswith("qwen"):
        return "qwen/" + m
    if substitute_unknown:
        return os.getenv("OPENROUTER_MODEL", "").strip() or OPENROUTER_DEFAULT_MODEL
    return m

```

### Core Architecture Module: `agentbook/providers/registry.py`
```
"""The provider registry: which backends exist and what they are called.

This module is pure data plus lookup. Adding a provider means adding one entry
to :data:`PROVIDERS` and nothing else -- chapter CLIs build their
``--provider`` choices from :data:`SUPPORTED_PROVIDERS`, so a new entry becomes
selectable without touching any argparse code.

Resolution *policy* -- which provider wins, when to fall back -- lives in
:mod:`agentbook.providers.resolution`, not here.
"""

from __future__ import annotations

from .models import Provider
from .openrouter import OPENROUTER_BASE_URL, OPENROUTER_DEFAULT_MODEL

__all__ = [
    "PROVIDERS",
    "SUPPORTED_PROVIDERS",
    "canonical_provider",
    "lookup",
    "supported_providers",
]

PROVIDERS: dict[str, Provider] = {
    "dashscope": Provider(
        name="dashscope",
        # Alibaba Cloud Model Studio (Bailian) keys are region-bound. Default
        # to the mainland endpoint for this Chinese-first project; readers
        # using an international-region key can set DASHSCOPE_BASE_URL to the
        # Singapore endpoint documented in the experiment README.
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        default_model="qwen3.7-plus",
        key_vars=("DASHSCOPE_API_KEY",),
        base_url_var="DASHSCOPE_BASE_URL",
    ),
    "siliconflow": Provider(
        name="siliconflow",
        base_url="https://api.siliconflow.cn/v1",
        default_model="Qwen/Qwen3.5-397B-A17B",
        key_vars=("SILICONFLOW_API_KEY",),
    ),
    "doubao": Provider(
        name="doubao",
        base_url="https://ark.cn-beijing.volces.com/api/v3",
        default_model="doubao-seed-1-6-thinking-250715",
        key_vars=("ARK_API_KEY",),
    ),
    "kimi": Provider(
        name="kimi",
        base_url="https://api.moonshot.cn/v1",
        default_model="kimi-k3",
        # KIMI_API_KEY kept for backwards compatibility.
        key_vars=("MOONSHOT_API_KEY", "KIMI_API_KEY"),
        base_url_var="KIMI_BASE_URL",
    ),
    "deepseek": Provider(
        name="deepseek",
        base_url="https://api.deepseek.com",
        # V4 Flash is OpenAI-compatible with tool calling + thinking mode.
        # Legacy deepseek-chat / deepseek-reasoner aliases deprecated 2026-07-24.
        default_model="deepseek-v4-flash",
        key_vars=("DEEPSEEK_API_KEY",),
        base_url_var="DEEPSEEK_BASE_URL",
    ),
    "zhipu": Provider(
        name="zhipu",
        base_url="https://open.bigmodel.cn/api/paas/v4",
        default_model="glm-5.2",
        key_vars=("ZHIPU_API_KEY",),
    ),
    "krill": Provider(
        name="krill",
        base_url="https://api.krill-code.net/v1",
        default_model="gpt-5.6-luna",
        key_vars=("KRILL_API_KEY",),
        base_url_var="KRILL_BASE_URL",
    ),
    "atlascloud": Provider(
        name="atlascloud",
        base_url="https://api.atlascloud.ai/v1",
        default_model="openai/gpt-4.1-mini",
        key_vars=("ATLASCLOUD_API_KEY",),
        base_url_var="ATLASCLOUD_BASE_URL",
        # Atlas Cloud serves models from multiple vendors under namespaced ids.
        namespaces_models=True,
    ),
    "openrouter": Provider(
        name="openrouter",
        base_url=OPENROUTER_BASE_URL,
        default_model=OPENROUTER_DEFAULT_MODEL,
        key_vars=("OPENROUTER_API_KEY",),
        base_url_var="OPENROUTER_BASE_URL",
        # Resells many vendors' models, so ids must be namespaced.
        namespaces_models=True,
    ),
    "openai": Provider(
        name="openai",
        base_url="https://api.openai.com/v1",
        default_model="gpt-4o",
        key_vars=("OPENAI_API_KEY",),
        base_url_var="OPENAI_BASE_URL",
    ),
    "gemini": Provider(
        name="gemini",
        # Google exposes an OpenAI-compatible endpoint; the free tier is
        # generous enough for most chapter experiments.
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
        default_model="gemini-2.5-flash",
        key_vars=("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    ),
    "ollama": Provider(
        name="ollama",
        base_url="http://localhost:11434/v1",
        default_model="qwen3:8b",
        # Ollama ignores the key but the OpenAI client requires a non-empty one.
        key_vars=("OLLAMA_API_KEY",),
        base_url_var="OLLAMA_BASE_URL",
        requires_key=False,
    ),
}

# Provider names used interchangeably in the chapters, mapped to canonical ones.
_ALIASES = {
    "moonshot": "kimi",
    "ark": "doubao",
    "google": "gemini",
    # "Qwen" is the model family and "Bailian" is the product name; both
    # select Alibaba's DashScope-compatible endpoint rather than SiliconFlow.
    "qwen": "dashscope",
    "bailian": "dashscope",
}

# Every accepted name, canonical plus aliases. Chapter CLIs use this for their
# --provider choices so a new registry entry is immediately selectable instead
# of being rejected by argparse.
#
# Computed once at import: PROVIDERS is a module-level table edited in source,
# not registered at runtime. Anything mutating PROVIDERS after import (tests
# do, to exercise hypothetical providers) must read supported_providers()
# instead, which recomputes.
SUPPORTED_PROVIDERS: tuple[str, ...] = tuple(sorted(set(PROVIDERS) | set(_ALIASES)))


def supported_providers() -> tuple[str, ...]:
    """Return every accepted provider name, canonical plus aliases.

    Prefer the :data:`SUPPORTED_PROVIDERS` constant unless
    :data:`PROVIDERS` may have been modified since import.

    Returns:
        Sorted provider names and aliases, recomputed from the live table.
    """
    return tuple(sorted(set(PROVIDERS) | set(_ALIASES)))


def canonical_provider(provider: str) -> str:
    """Normalise a provider name, resolving aliases.

    Args:
        provider: A provider name or alias, e.g. ``"moonshot"`` or ``"Kimi"``.
            Case and surrounding whitespace are ignored. ``None`` is tolerated.

    Returns:
        The canonical name, e.g. ``"kimi"``. Names that are not known aliases
        are returned lowercased but otherwise unchanged, so callers can still
        look them up and get a sensible error for genuinely unknown providers.
    """
    key = (provider or "").strip().lower()
    return _ALIASES.get(key, key)


def lookup(provider: str) -> Provider:
    """Find the :class:`~agentbook.providers.models.Provider` for a name.

    Args:
        provider: A provider name or alias.

    Returns:
        The registered provider specification.

    Raises:
        ValueError: If the name matches no registry entry or alias. The message
            lists the supported names.
    """
    key = canonical_provider(provider)
    if key not in PROVIDERS:
        supported = ", ".join(sorted(PROVIDERS))
        raise ValueError(f"Unsupported provider: {provider!r}. Supported: {supported}")
    return PROVIDERS[key]

```

### Core Architecture Module: `agentbook/providers/resolution.py`
```
"""Resolution policy: turning a provider name into a usable backend.

This module owns the *rules* -- which credential wins, when to reroute through
OpenRouter, what to do when nothing is configured. The registry owns the data
those rules operate on.

The precedence chain is deliberately expressed as one readable sequence in
:func:`resolve_backend`, because the order of its steps is the entire
behaviour: swapping two of them silently changes which endpoint a chapter
talks to.
"""

from __future__ import annotations

import os

from .models import Backend, Provider
from .openrouter import (
    OPENROUTER_DEFAULT_MODEL,
    ZERO_COST_HINT,
    map_model_to_openrouter,
    openrouter_base_url,
    openrouter_key,
)
from .registry import lookup

__all__ = ["resolve_backend"]

# Local runtimes ignore the key, but the OpenAI client rejects an empty one.
# Deliberately not a provider name: this is a credential value, and reusing a
# provider name here would make the two indistinguishable to callers that log
# or redact based on either.
_PLACEHOLDER_KEY = "not-needed"

# The universal fallback is one specific provider, not a category. Other
# aggregators may share its model-id format (see Provider.namespaces_models)
# but not its endpoint or its credentials.
_OPENROUTER = "openrouter"


def build_openrouter_backend(
    model: str,
    api_key: str,
    provider: str = "openrouter",
) -> Backend:
    """Build a backend that routes through OpenRouter.

    Shared by :func:`resolve_backend` and the legacy shim in
    :mod:`agentbook.providers.legacy` so the two cannot drift apart.

    Args:
        model: The requested model id; mapped to its OpenRouter equivalent.
        api_key: The OpenRouter credential to use. Must already be resolved --
            this function does not fall back to the environment. Empty values
            become a placeholder, since the OpenAI client rejects an empty key.
        provider: The provider that was originally requested. Recorded on the
            backend so callers can report what the user asked for.

    Returns:
        A backend pointing at OpenRouter with ``using_openrouter`` set.
    """
    return Backend(
        api_key=api_key or _PLACEHOLDER_KEY,
        base_url=openrouter_base_url(),
        # The caller asked for this model and is being rerouted for credential
        # reasons alone, so an unmapped id is sent as-is and rejected by name.
        # Substituting here would answer as a different vendor's model without
        # the reader ever learning theirs was unavailable.
        model=map_model_to_openrouter(
            (model or "").strip() or os.getenv("OPENROUTER_MODEL", "").strip() or OPENROUTER_DEFAULT_MODEL,
            substitute_unknown=not (model or "").strip(),
        ),
        provider=provider,
        using_openrouter=True,
    )


def _needs_openrouter_for_gpt5(
    spec: Provider, model: str, chosen_by_reader: bool
) -> bool:
    """Report whether a gpt-5 request must be rerouted through OpenRouter.

    Two independent things make the direct OpenAI API a poor default for
    gpt-5.x. It requires organisation verification, which most readers will not
    have. And its ``/v1/chat/completions`` endpoint refuses function tools
    unless reasoning is switched off entirely -- it accepts the two together
    only with ``reasoning_effort="none"``, which is the one thing an agent
    experiment cannot give up. OpenRouter has neither restriction.

    The exception is a reader who named ``openai`` or ``krill`` themselves:
    sending their prompts and their spend to a different provider against an
    explicit instruction is worse than the failure it avoids. A caller whose
    provider name is its own built-in default rather than the reader's choice
    passes ``chosen_by_reader=False`` and is rerouted like any other provider.

    Args:
        spec: The provider that was requested.
        model: The resolved model id.
        chosen_by_reader: Whether the provider name came from the reader rather
            than from the calling experiment's default.

    Returns:
        ``True`` if the request should be rerouted.
    """
    if not model.lower().startswith("gpt-5"):
        return False
    return not (spec.name in {"openai", "krill"} and chosen_by_reader)


def _missing_key_error(spec: Provider) -> ValueError:
    """Build the error raised when no credential can be found.

    Args:
        spec: The provider that could not be configured.

    Returns:
        A ``ValueError`` naming the variables that would fix the problem and
        pointing at the zero-cost options.
    """
    wanted = " / ".join(spec.key_vars) or "(none)"
    return ValueError(
        f"No API key found for provider {spec.name!r}. Set {wanted}, "
        "or OPENROUTER_API_KEY as a universal fallback. " + ZERO_COST_HINT
    )


def resolve_backend(
    provider: str,
    model: str | None = None,
    api_key: str | None = None,
    *,
    chosen_by_reader: bool = True,
) -> Backend:
    """Resolve a provider name into a usable backend.

    Resolution order:

    1. ``gpt-5*`` ids route through OpenRouter when a key is available, because
       the direct OpenAI API requires org verification for them and refuses
       function tools alongside reasoning. A reader who named ``openai``
       themselves is honoured instead; see :func:`_needs_openrouter_for_gpt5`.
    2. If the provider's own key is set (or the provider needs none, e.g.
       Ollama), use the provider directly.
    3. Otherwise fall back to OpenRouter, mapping the model id.
    4. Otherwise raise, naming the variables that would fix it.

    Args:
        provider: Provider name or alias, e.g. ``"kimi"`` or ``"moonshot"``.
        model: Model id overriding the provider's default.
        api_key: Credential overriding the environment. For the ``openrouter``
            provider this is treated as an OpenRouter key; for any other
            provider it belongs to that provider and is never forwarded to
            OpenRouter.
        chosen_by_reader: Whether ``provider`` is the reader's own selection --
            a ``--provider`` flag or an equivalent setting. Pass ``False`` when
            it is a caller's hardcoded default, which lets step 1 reroute a
            gpt-5 request that would otherwise fail on the direct API.

    Returns:
        A ready-to-use :class:`~agentbook.providers.models.Backend`.

    Raises:
        ValueError: If the provider is unknown, or if it requires a key and
            neither its own variables nor ``OPENROUTER_API_KEY`` are set.
    """
    spec = lookup(provider)
    model_clean = (model or "").strip()
    if model_clean:
        resolved_model = model_clean
    elif spec.name == _OPENROUTER:
        # The OpenRouter default honours OPENROUTER_MODEL — the env var this
        # package documents (see the module docstring / ZERO_COST_HINT) as the
        # ':free' zero-cost selector. Without this, the documented free recipe
        # silently resolves the paid OPENROUTER_DEFAULT_MODEL instead.
        resolved_model = os.getenv("OPENROUTER_MODEL", "").strip() or spec.default_model
    else:
        resolved_model = spec.default_model
    key = (api_key or "").strip() or spec.api_key()

    # Only OpenRouter's own credential can authenticate against OpenRouter. An
    # explicit key given for the openrouter provider is such a credential and
    # wins over the environment; any other provider's key -- including another
    # aggregator's -- belongs to that provider and is never forwarded here.
    explicit_openrouter_key = key if spec.name == _OPENROUTER else ""
    available_openrouter_key = explicit_openrouter_key or openrouter_key()

    # 1. gpt-5.x needs OpenAI org verification on the direct API, which also
    #    refuses function tools unless reasoning is off.
    if available_openrouter_key and _needs_openrouter_for_gpt5(
        spec, resolved_model, chosen_by_reader
    ):
        return build_open
```

### Core Architecture Module: `book-ar/fit_svg_text.py`
```
"""Repair text overflow in checked-in book SVGs (in place).

This tool applies the svg_lib.fit_overflow width model to any SVG on disk,
shrinking only the font-size of text runs that spill outside their
containing rectangle or the canvas. It is safe (positions are never moved) and
idempotent (re-running makes no further changes).

Usage:
    python3 fit_svg_text.py                 # fix every images/*.svg
    python3 fit_svg_text.py images/fig6-3.svg ...   # fix specific files
"""
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from svg_lib import fit_overflow

IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'images')


def process(path):
    with open(path, encoding='utf-8') as f:
        original = f.read()
    fixed = fit_overflow(original)
    if fixed != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(fixed)
        return True
    return False


def main(argv):
    targets = argv[1:] or sorted(glob.glob(os.path.join(IMG, '*.svg')))
    changed = 0
    for path in targets:
        if process(path):
            changed += 1
            print(f'  fitted {os.path.basename(path)}')
    print(f'\nAdjusted {changed}/{len(targets)} SVG file(s).')


if __name__ == '__main__':
    main(sys.argv)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1152** (2026-09-23): **docs(i18n): sync #1151 ch2 preserved-thinking additions to all translations**
  *Symptoms*: 将 #1151 的三处第二章改动同步到全部 14 个译本（ar, en, es, he, hu, id, ja, ko, ptbr, ru, ta, tr, vi, zhtw）：  1. 思维链保留段落中关于 Claude 的句子：改为“签名把 thinking block 绑定到产生它时的前缀”。 2. “缓存作为架构约束”一节：新增两段 + 脚注 `[^ch2-preserved-thinking]`，并在核心启示段末补一句。 3. “压缩与 KV Cache”一节：第 3 条之后新增压缩与 thinking 绑定的说明。  检查：每个文件 `ch2-preserved-thinking` 恰好出现 2 次（引用 + 定义）；旧句子已删除；除 ja / zhtw 外新增行不含 CJK 字符；交叉引用使用各译本自己的小节标题和引号风格；未新增标题或图片。  建议在 #1151 合并后再合并本 PR。  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #1151** (2026-09-23): **docs(ch2): 补充 Claude preserved thinking——前缀改动会让历史 thinking 失效**
  *Symptoms*: 依据 Anthropic 官方文档 [Preserved thinking](https://platform.claude.com/docs/en/build-with-claude/preserved-thinking)，在第二章补充“前缀绑定 thinking”这一约束。书中原先只从 KV Cache / Prompt Cache 的成本角度讲“前缀不能动”；Claude Fable 5.1 / Opus 5.5 出于防蒸馏，用签名把 thinking block 绑定到产生它时的前缀，前缀一改，历史 thinking 就失效（新账户默认 400）。两条规则来源不同，得出的都是“只追加、不改写”的纪律。  改动（仅 `book/chapter2.md`）： 1. 思维链保留段落：更正 Claude 历史 thinking 的旧说法，改为签名绑定前缀的描述。 2. “缓存作为架构约束”：新增两段 + 脚注，说明机制、常见踩坑写法、追加式替代方案、thinking 裁剪规则和换模型时的静默丢弃。 3. “压缩与 KV Cache”：补充“摘要旧轮次 + 保留尾部”会让保留轮次的 thinking 失效，以及官方推荐的两种压缩方式。  正文只讲原理，不写 beta header 和参数名。未新增标题或图片。14 个译本的同步另开 PR。  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #1150** (2026-09-24): **文章内容描述歧义，第一章AI Agent 部分 Harness 工程：模型之外的竞争力部分**
  *Symptoms*: 表格数据 Context（上下文） | 为模型提供感知信息；信息要充分，让 Agent 在每个决策点都基于足够的信息判断 | 系统提示词、知识库、Agent 状态栏、Sidecar 旁路查询 | 第二、三章  Sidecar是什么意思，应该为Sidebar吧，Codex Sidebar? 这个名词没有见过 

- **Issue #1149** (2026-09-23): **feat(site): number chapters in the reader rail**
  *Symptoms*: 给 Web 站点的侧边栏目录增加章节序号，提升阅读体验；  **现状**：我在阅读正文的时候，正文中经常提及某一章节，但是不能依赖左边的目录快速定位章节，我还要从头数一下；  <img width="1508" height="805" alt="old" src="https://github.com/user-attachments/assets/a31186ba-6754-4f78-9f3f-7b505c4a21a8" />   **修改**：增加章节序号，对齐正文说的章节是哪一章；  <img width="1477" height="793" alt="new" src="https://github.com/user-attachments/assets/a680cd86-22c7-4704-9419-1221ce803594" />   移动端：  <img width="256" height="461" alt="mobile" src="https://github.com/user-attachments/assets/d7b31fc9-cd64-4a5e-8915-694a7727959d" />   
  **Post-Mortem & Fix Analysis**:
  > Nice work! Thanks for your contributions @Dada-liu 

- **Issue #1146** (2026-09-23): **ci: install httpx and MkDocs for offline test jobs**
  *Symptoms*: The web-search workflow fails during test collection: its chapter environment imports `httpx` directly without declaring it, and its root job runs MkDocs source-link tests without installing MkDocs.  Declare `httpx>=0.27,<1` in the chapter's existing dependency file and install `mkdocs>=1.6,<2` alongside the development package in the root CI job. Both jobs keep their complete test suites. Runtime package requirements and the lockfile are unchanged.  Validation in a fresh Python 3.12 environment:  - Chapter formatting check passes; all 44 offline web-search tests pass. - Root suite: 736 passed, 15 skipped for optional dependencies. On macOS, this run uses `TMPDIR=/private/tmp` so the temporary directory is a canonical path, matching the Linux runner; the default `/var` alias exposes an existing direct-helper path-normalization issue in `test_core_clean_site_links.py`.  This separately fixes the missing-dependency failures seen on #1143 and #1145; it contains no README rewrite.  GitHub verification: both `test` and `agentbook` jobs now pass, as does the security check. 

- **Issue #1145** (2026-09-22): **docs: 保留完整内容，重写中文实验 README 的教学流程**
  *Symptoms*: 原有实验 README 经常先展示英文长文、实现清单或运行结论，首次阅读时难以沿着“问题—方法—准备—操作—结果”理解完整实验。这次在完整 README 内重新组织教学顺序，补充概念、操作衔接和结果解释，保留详细步骤与历史材料。  这是撤销 #1143（#1144）后的重新实现。它不采用短介绍替换全文，也不创建 `REFERENCE` 替代文档。  - 覆盖 111 个实验入口、4 份附属说明和 10 个章节导航，共 125 份现有 README；没有修改实验运行代码或独立语言译本。 - 把完整中文流程放在英文版本之前，把原有章节按概念、准备、运行、结果、实现与排错组织；对较长中文段落分段，补足每一步为什么要做、应该观察什么。 - 为原先英文为主或中文说明过短的项目补充中文教学内容，包括工具生成、桌面交互、记忆系统评估、失败归因、语音训练和多 Agent 协作。原始英文正文完整保留在同一 README 内。 - 保留已有配置、代码、表格、任务案例、失败记录与结果；解释历史分数和单次曲线的适用条件。例如，混合检索的小样本满分不再被写成一般结论；明确 BM25 离线路径需要同时关闭 dense 与 rerank。 - 修正 13 处安装/运行片段中的旧章节目录及相应环境组；澄清评估脚本的 `--load_in_4bit` 不能接受 `False`。保留已有章节链接使用的三个锚点。  ### 如何核对内容保留  差异中的大段删除/新增主要来自完整中英文区块和原有章节的移动，不代表把内容缩成摘要。125 份文档净增加约 5,700 行，每一份都比原文更长。  逐文件与 #1144 合并后的版本比较：原有 1,713 个代码块、344 张表格、1,014 处 Markdown 链接和 8 处图片引用全部保留。代码块只对上述明确的旧目录修正做规范化比较；其余代码内容保留。已有英文正文按原始完整区块检查保留，没有抽取为短摘要。  ### 验证  - 内容保留审计通过；新增文件链接与新增页内锚点检查通过。 - 多语言结构审计通过；章节编号、文档状态链接、网站资源处理测试 11 项通过。 - 实际运行混合检索 BM25 离线入口、DPO 数据示例和轨迹验证器，均通过；未运行付费 API、GPU 训练或设备实验。 - MkDocs 完整构建和英文跳转修正后的增量构建通过；抽查上下文、混合检索、工具训练和社会模拟页面，完整代码/表格与教学导航均正常渲染。 - 原文移动带入了原有行尾空格；没有为清理格式而改动保留代码。新增空行/冲突标记检查通过。  两处原本就不存在的本地结果文件链接仍保留：章节 5 中的旧 agent-creator comparison.json，以及 user-memory-system-evaluation 的 full_7_3_structured_rubric_evidence.json。本次没有伪造或删除这些历史记录的引用。现有 CI 的 mkdocs/httpx 依赖问题由独立的 #1146 修复，不混入这次文档重写。  GitHub 当前验证：多语言检查和 9 个实验测试任务通过。现有 web-search 工作流的两项任务仍因未安装 mkdocs/httpx 在收集测试时失败，修复见 #1146。  #1146 的 GitHub `test` 与 `agentbook` 两项任务已验证通过。文档 PR 的旧基线仍保留原失败；先合并依赖修复并更新本分支即可使用修复后的 CI 环境。 

- **Issue #1144** (2026-09-22): **Revert truncated experiment READMEs and restore full content**
  *Symptoms*: Revert #1143 because it replaced the full experiment READMEs with short introductions and moved their substance into reference files. The requested improvement was to make the complete material easier for first-time learners to follow, while retaining explanations, procedures, examples, configuration details, and results in the READMEs.  This restores every file to its state immediately before #1143, including the full experiment and chapter READMEs, and removes the reference copies and guide introduced by that PR. Earlier changes, including the homepage index automation and #1142, remain in place.  Validation: `git diff --exit-code abb83693^ HEAD` confirms an exact restoration of the pre-#1143 tree. The multilingual consistency audit and 11 chapter/documentation/site-asset tests pass.  The separately requested CI dependency fixes are being kept in a separate change. 

- **Issue #1143** (2026-09-22): **docs: 将全部中文实验 README 改写为教学教程**
  *Symptoms*: 读者打开实验 README 时，原先往往先看到运行记录、验收术语、长篇配置和结果表，难以理解实验要解释什么。本次把全部自有中文实验入口改写为教学正文：从具体问题引入机制，说明如何逐步观察，再解释结果能支持什么结论，并提出进一步思考的问题。  - 重写 111 个实验入口（包含 AndroidWorld 的嵌套失败归因教程）、10 个章节实验导航和 4 份附属教程。第三方随仓库保存的 README、模型产物说明和独立语言译本不在这次编辑范围内。 - 每个实验都有针对自身代码与任务的说明、观察要点和源码阅读路径。区分离线演示、真实模型调用、训练与硬件实验，避免把历史分数或演示输出当作必然结论。 - 将这 125 份文档的原始内容逐字节保存在同目录的 `REFERENCE*.md`，保留英文说明、完整配置和历史记录；维护实际被引用的旧章节锚点。 - 新增 `docs/EXPERIMENTS.md`，说明环境准备、共享包安装、控制比较条件和阅读输出的方法，并接入网站构建。  这是已合并的 #1142 的完整后续改写，回应 #1133，也与 #950 的可读性反馈相关。本次仅编辑文档和学习指南的发布路径，没有修改实验运行逻辑。  验证：  - 章节编号、文档状态链接与网站资源处理测试：11 项通过。 - 多语言结构审计通过；译本文件未修改。 - 54 条入口示例命令的脚本路径和参数已与源码核对；新教学文档本地链接和原文归档完整性已检查。 - 在临时副本中抽查 12 个离线示例，全部通过，涵盖上下文提示、结构化索引、工具选择与发现、ERP、桌面操作预览、成本评估、DPO 数据、轨迹验证、确认门禁、持续进化评估和书籍翻译。 - 最终 MkDocs 完整构建通过；检查 126 个教学页面的 1,688 个内部链接，未发现失效目标或锚点。首次构建触及本机文件描述符上限，提高构建进程限额（`ulimit -n 8192`）后通过。  验证未运行付费模型调用、GPU 训练或实体设备实验。原始参考文档保留既有内容，其中历史链接问题不代表新教学入口的链接状态。  CI 当前状态：多语言审计与 9 个实验测试任务通过，GitHub 网站构建仍在运行。现有 web-search 工作流的两项任务在测试收集时失败：`agentbook` 缺少 `mkdocs`（`tests/test_site_edit_urls.py`），`test` 缺少 `httpx`（`tests/test_agent.py`）；已下载本次运行日志确认。这与 #1142 上已有的依赖问题一致，本次未改动对应工作流或依赖定义。 

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

### Incident Patch 1: `f89a8464` (2026-09-22)
**Commit Message**: Revert "docs: rewrite all Chinese experiment entries as teaching tutorials (#1143)" (#1144)

This reverts commit abb8369328625da900bc1808ad5cdae9829e4415.

Co-authored-by: Bojie Li <i@01.me>

**File**: `chapter1/README.md` (modified, +32/-21)
```diff
@@ -1,29 +1,40 @@
-# 第 1 章 · AI Agent 入门
+# 第 1 章 · Agent 基础知识
 
-[读本章正文](../book/chapter1.md) · [实验学习指南](../docs/EXPERIMENTS.md)
+> **Agent = LLM + 上下文 + 工具**；Harness 工程才是竞争力
 
-本章从一条可见的执行轨迹开始，理解模型怎样读取上下文、调用工具并利用结果继续工作。先学会解释一次运行，再讨论不同设计的优劣。
+← [返回主目录](../README.md) · 📖 [读本章正文](../book/chapter1.md)
 
-## 建议的学习顺序
+## 从哪里开始
 
-1. [从一次搜索问答理解 ReAct 循环](web-search-agent/README.md)：先看无需凭据的离线搜索轨迹，辨认思考、动作与观察。
-2. [上下文怎样影响 Agent 的执行过程](context/README.md)：再在同一任务中移除一类上下文，分析行为变化。
-3. [提示词改写会让生成图片更符合需求吗](image-gen-workflow/README.md)：最后比较工作流中的额外步骤是否帮助满足用户需求。
+本章实验帮助你看清两件事：模型每轮能看到哪些信息，以及它如何调用工具、读取结果并继续回答。
+第一次阅读可以按下面的顺序进行：
 
-## 配套项目
-
-| 编号 | 项目 | 类型 | 学习内容 |
-| :--: | --- | :--: | --- |
-| 1-1 | [上下文怎样影响 Agent 的执行过程](context/README.md) | ✅ | 假设模型刚用计算器得到一个结果，下一轮却看不到这条工具消息。 |
-| 1-2 | [从一次搜索问答理解 ReAct 循环](web-search-agent/README.md) | ✅ | 回答一个需要新信息的问题时，模型往往不能一步结束：它先决定查什么，读到结果后再决定是否继续查。 |
-| 1-3 | [把搜索得到的信息交给代码计算](search-codegen/README.md) | ✅ | “两个城市相距多远”同时包含事实查询和数值计算。 |
-| 1-4 | [提示词改写会让生成图片更符合需求吗](image-gen-workflow/README.md) | ✅ | 用户说“画一张耳机海报”，与明确指定画面、风格和文案，是两种不同的任务。 |
-| 8-1, 8-2 | [在寻宝游戏中比较两种学习方式](learning-from-experience/README.md) | ✅ | 面对规则不完全公开的寻宝游戏，Agent 必须从行动后果中学习。 |
+1. 打开 [web-search-agent](web-search-agent/)，先运行无需 API Key 的离线演示。
+   观察一次“思考 → 调用工具 → 读取结果 → 回答”的过程。演示中的搜索结果是预先编写的。
+2. 打开 [context](context/)，配置一个模型提供商，先运行单个任务，再移除一种上下文信息做对照。
+   比较工具调用和最终答案，看看变化发生在哪一步。
+3. 跑通后再读代码：从 `main.py` 找入口，在 `agent.py` 中跟踪消息如何组装、工具结果如何返回。
+   提供商适配、图表和测试可以稍后阅读。
 
-✅ 表示仓库提供实现入口；📖 表示需要按指南准备外部项目；🚧 表示按正文开展的设计练习。即使有实现入口，模型、数据、浏览器或硬件仍可能需要单独准备。
+正文中的简化代码用于解释流程，实验目录中的代码负责实际运行。
+如果你要核对书中的实验结论，再查看 [实验记录](EXPERIMENT_LEDGER.md)：其中列出了运行条件、
+服务可用性和结果文件。例如，实验 1-1 的一次五组对照没有观察到“去掉推理内容必然退化”，
+因此不要把预期现象当作每次都能复现的结论。
 
-## 从演示走向完整实验
-
-先选一项实验，读清楚输入、预期观察和结果解释，再准备该项目的环境。能解释一次运行后，再扩大任务数量或比较不同配置。不要把离线示例、真实模型运行和硬件结果混为同一种证据。
+## 配套项目
 
-各实验的 README 是教学入口。完整配置、英文资料与历史结果保留在对应的技术参考文档中；本章的原始目录、外部项目版本与运行记录可在[章节技术参考](REFERENCE.md)中查阅。
+| 编号 | 项目 | 类型 | 一句话说明 |
+| :--: | --- | :--: | --- |
+| 1-1 | [context](context/) | ✅ | 系统性消融实验展示 Agent 上下文各组件的重要性；支持阿里云百炼直连 Qwen、SiliconFlow Qwen、字节 Doubao、月之暗面 Kimi 等多提供商 |
+| 1-2 | [web-search-agent](web-search-agent/) | ✅ | Kimi K3 模型即 Agent，具备基础深度搜索能力，能进行多轮搜索和信息整合 |
+| 1-3 | [search-codegen](search-codegen/) | ✅ | 模型自主多轮搜索 + 服务端代码执行的 Deep Research 闭环，先澄清意图再执行；官方 GPT-5.6 路径保留，阿里云百炼 qwen3.7-plus（hosted web_search + code_interpreter）实测通过东盟首都距离与比特币技术分析全部验收门 |
+| 1-4 | [image-gen-workflow](image-gen-workflow/) | ✅ | 具体/宽泛两类需求 × 工作流（kimi-k3 改写 + 通义万相）与原生（Gemini / GPT-Image 2）双路线真实对照：具体需求下原生更忠实（海报文案被改写节点丢进负面词），宽泛需求下改写的场景具象化带来想象力，但 GPT-Image 2 自己就能补观点——适配层被模型内化的实证 |
+| 7-1, 7-2 | [learning-from-experience](learning-from-experience/) | ✅ | 10,000 局 Q-learning + 100 局评估与官方 Kimi K3 第一局双臂实测已验收；[证据](learning-from-experience/validation/20260730_011704/evidence.json)记录 Kimi 17 步成功、零 fallback 及历史点估计差异 |
+
+## 项目类型说明
+
+| 图标 | 类型 | 含义 |
+| :--: | --- | --- |
+| ✅ | **可独立运行** | 本仓库自带完整代码，配置好 API Key 即可运行 |
+| 📖 | **复现指南** | 依赖需自行 `git clone` 的**外部仓库**（训练框架、评测基准等） |
+| 🚧 | **设计文档** | 仅包含架构与实现方案，可运行代码仍在完善中 |
```

**File**: `chapter1/REFERENCE.md` (removed, +0/-40)
```diff
@@ -1,40 +0,0 @@
-# 第 1 章 · Agent 基础知识
-
-> **Agent = LLM + 上下文 + 工具**；Harness 工程才是竞争力
-
-← [返回主目录](../README.md) · 📖 [读本章正文](../book/chapter1.md)
-
-## 从哪里开始
-
-本章实验帮助你看清两件事：模型每轮能看到哪些信息，以及它如何调用工具、读取结果并继续回答。
-第一次阅读可以按下面的顺序进行：
-
-1. 打开 [web-search-agent](web-search-agent/)，先运行无需 API Key 的离线演示。
-   观察一次“思考 → 调用工具 → 读取结果 → 回答”的过程。演示中的搜索结果是预先编写的。
-2. 打开 [context](context/)，配置一个模型提供商，先运行单个任务，再移除一种上下文信息做对照。
-   比较工具调用和最终答案，看看变化发生在哪一步。
-3. 跑通后再读代码：从 `main.py` 找入口，在 `agent.py` 中跟踪消息如何组装、工具结果如何返回。
-   提供商适配、图表和测试可以稍后阅读。
-
-正文中的简化代码用于解释流程，实验目录中的代码负责实际运行。
-如果你要核对书中的实验结论，再查看 [实验记录](EXPERIMENT_LEDGER.md)：其中列出了运行条件、
-服务可用性和结果文件。例如，实验 1-1 的一次五组对照没有观察到“去掉推理内容必然退化”，
-因此不要把预期现象当作每次都能复现的结论。
-
-## 配套项目
-
-| 编号 | 项目 | 类型 | 一句话说明 |
-| :--: | --- | :--: | --- |
-| 1-1 | [context](context/) | ✅ | 系统性消融实验展示 Agent 上下文各组件的重要性；支持阿里云百炼直连 Qwen、SiliconFlow Qwen、字节 Doubao、月之暗面 Kimi 等多提供商 |
-| 1-2 | [web-search-agent](web-search-agent/) | ✅ | Kimi K3 模型即 Agent，具备基础深度搜索能力，能进行多轮搜索和信息整合 |
-| 1-3 | [search-codegen](search-codegen/) | ✅ | 模型自主多轮搜索 + 服务端代码执行的 Deep Research 闭环，先澄清意图再执行；官方 GPT-5.6 路径保留，阿里云百炼 qwen3.7-plus（hosted web_search + code_interpreter）实测通过东盟首都距离与比特币技术分析全部验收门 |
-| 1-4 | [image-gen-workflow](image-gen-workflow/) | ✅ | 具体/宽泛两类需求 × 工作流（kimi-k3 改写 + 通义万相）与原生（Gemini / GPT-Image 2）双路线真实对照：具体需求下原生更忠实（海报文案被改写节点丢进负面词），宽泛需求下改写的场景具象化带来想象力，但 GPT-Image 2 自己就能补观点——适配层被模型内化的实证 |
-| 7-1, 7-2 | [learning-from-experience](learning-from-experience/) | ✅ | 10,000 局 Q-learning + 100 局评估与官方 Kimi K3 第一局双臂实测已验收；[证据](learning-from-experience/validation/20260730_011704/evidence.json)记录 Kimi 17 步成功、零 fallback 及历史点估计差异 |
-
-## 项目类型说明
-
-| 图标 | 类型 | 含义 |
-| :--: | --- | --- |
-| ✅ | **可独立运行** | 本仓库自带完整代码，配置好 API Key 即可运行 |
-| 📖 | **复现指南** | 依赖需自行 `git clone` 的**外部仓库**（训练框架、评测基准等） |
-| 🚧 | **设计文档** | 仅包含架构与实现方案，可运行代码仍在完善中 |
```

**File**: `chapter1/context/README.md` (modified, +1160/-18)
```diff
@@ -1,37 +1,1179 @@
-# 上下文怎样影响 Agent 的执行过程
+# Context-Aware AI Agent with Ablation Studies / 上下文感知 Agent 与消融实验
 
-[本章实验目录](../README.md) · [相关正文](../../book/chapter1.md) · [技术参考](REFERENCE.md)
+> Multi-provider context-aware agent with systematic ablation of context components (history, reasoning, tool calls, tool results).
+> 配套《深入理解 AI Agent》第 1 章 **实验 1-1 ★★：上下文的关键作用**。
 
-假设模型刚用计算器得到一个结果，下一轮却看不到这条工具消息。它还能可靠地继续计算吗？本实验用同一任务的不同上下文版本，帮助你理解模型的行为为什么取决于它实际收到的信息。
+← [Chapter 1 index / 返回第 1 章目录](../README.md) · 📖 [Read the chapter / 读本章正文](../../book/chapter1.md)（[EN](../../book-en/chapter1.md)）
 
-## 理解实验
+---
 
-把一类信息从完整输入中移除，再比较行为，称为消融实验。这里分别考察历史消息、推理内容、工具定义和工具结果。它们承担不同职责：工具定义说明能做什么，工具结果说明刚才发生了什么；两者不能相互替代。
+[中文说明](#中文) · [English](#english)
 
-## 动手之前
+## 先跑一个对照
 
-运行模型部分需要按技术参考配置对应的服务凭据；调用会使用该服务的额度。先准备一个小任务，再扩展比较范围。 通用环境说明见[实验学习指南](../../docs/EXPERIMENTS.md)。
+这个实验研究：给同一个模型、同一个任务，少提供一类上下文信息，执行过程会发生什么变化？
+“消融”就是一次只移除一个组件，再与完整版本比较。先观察一个任务，之后再运行批量实验。
 
-## 一步步观察
+你需要 Python 3.10+，以及一个可用的模型 API Key。下面以百炼为例；其他提供商的配置见中文说明。
+在仓库根目录安装依赖并激活环境，再进入实验目录：
 
-先为所选提供商配置 API Key。下面以百炼为例，只运行一道计算题。读完终端中的工具调用，再把命令里的 `full` 改成 `no_tool_results` 重跑。保持任务和模型相同，才能把差异与上下文变化联系起来。
+```bash
+uv sync --locked --extra ch1
+source .venv/bin/activate
+cd chapter1/context
+export DASHSCOPE_API_KEY='your-api-key-here'
+
+python main.py --mode single --provider dashscope --context-mode full \
+  --task "请调用计算器计算 (125 + 375) * 8，并给出结果。" --output full.json
+python main.py --mode single --provider dashscope --context-mode no_tool_results \
+  --task "请调用计算器计算 (125 + 375) * 8，并给出结果。" --output no-tool-results.json
+```
+
+Windows 的环境激活方式和其他安装方法见下文“快速开始”。这两条命令会调用模型 API。
+
+计算结果应为 **4000**。但答案相同不代表两次执行相同：先检查是否调用了计算器，再看工具结果是否
+进入了下一轮上下文。即使没有看到工具结果，模型也可能自己算对这道简单题。
+如果没有发生工具调用，这次任务就不能说明移除工具结果的影响；应换一个确实需要工具的任务再比较。
+`full.json` 和 `no-tool-results.json` 保存了各次运行结果，可结合终端日志核对。
+
+读代码时，先看 `main.py` 的参数分发，再看 `agent.py` 如何组装消息和处理工具结果。
+提供商适配和绘图代码可以稍后阅读。
+
+## 中文
+
+### 概述
+
+对应书中**实验 1-1 ★★：上下文的关键作用**。Agent 可以读取 PDF、换算货币、计算表达式和执行 Python。你可以分别移除历史消息、推理内容、工具定义或工具结果，观察它怎样完成同一任务。下面的配置说明供你在跑通第一个对照后查阅。
+
+### 主要特性
+
+- **多提供商支持**：阿里云百炼（Qwen 直连）、SiliconFlow（Qwen）、Doubao（字节）、Kimi（月之暗面）、DeepSeek
+- **多工具 Agent**：PDF 解析、货币换算、计算与 Python 代码执行
+- **上下文模式**：五种配置，用于消融对照
+- **交互与批处理**：单任务运行或完整测试套件
+- **对话历史**：同一会话内跨多轮查询保持上下文
+- **详细分析**：性能指标、可视化与综合报告
+
+### 支持的 LLM 提供商
+
+#### Doubao（字节跳动）— 默认
+
+- **模型**：`doubao-seed-1-6-thinking-250715`（可自定义）
+- **API**：火山引擎上的 OpenAI 兼容接口
+- **适合**：深度推理、较快响应，中英文任务均可
+
+#### SiliconFlow
+
+- **模型**：`Qwen/Qwen3.5-397B-A17B`（可自定义）
+- **API**：OpenAI 兼容
+- **适合**：复杂推理与细致分析
+
+#### 阿里云百炼（Qwen 直连）
+
+- **模型**：`qwen3.7-plus`（可通过 `--model` 自定义）
+- **API**：直连 DashScope 的 OpenAI 兼容接口，无需 SiliconFlow 账号
+- **提供商名称**：规范名称为 `dashscope`，也可使用别名 `qwen` 或 `bailian`
+- **区域说明**：API Key 与区域绑定。中国内地 Key 默认直连内地端点；国际站 Key 必须设置 `DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
+
+#### Kimi（月之暗面）
+
+- **模型**：`kimi-k3`（K3 推理模型；temperature 强制为 1，max_tokens 足够容纳思考输出）
+- **API**：Moonshot 平台 OpenAI 兼容接口
+- **适合**：深度推理、多轮对话，中英文任务均可
+- **特性**：上下文缓存以优化成本
+
+#### DeepSeek
+
+- **模型**：`deepseek-v4-flash`（默认；更强档可用 `--model deepseek-v4-pro`）
+- **API**：[DeepSeek Platform](https://platform.deepseek.com/) 的 OpenAI 兼容接口
+- **适合**：性价比高的工具调用；开启 thinking，便于 `no_reasoning` 消融剥离 `reasoning_content`
+- **说明**：旧别名 `deepseek-chat` / `deepseek-reasoner` 已弃用（2026-07-24），请优先使用 V4 id
+
+### 架构
+
+#### 上下文组件
+
+1. **Full Context** — 完整 Agent，保留全部组件
+2. **No History** — 缺少历史工具调用追踪
+3. **No Reasoning** — 无战略规划/思考过程
+4. **No Tool Calls** — 无法执行外部工具
+5. **No Tool Results** — 看不到工具执行结果
+
+#### 可用工具
+
+- **`parse_pdf(url)`** — 下载并抽取 PDF 文本
+- **`convert_currency(amount, from, to)`** — 货币换算
+- **`calculate(expression)`** — 简单数学表达式求值
+- **`code_interpreter(code)`** — 执行 Python，用于复杂计算、汇总与数据处理
+
+### 前置条件
+
+- Python 3.10+
+- 任一支持提供商的 API Key：
+  - **阿里云百炼**：[百炼控制台](https://bailian.console.aliyun.com/)
+  - **SiliconFlow**：[SiliconFlow](https://siliconflow.cn)
+  - **Doubao（字节）**：[火山引擎](https://ww
```

**File**: `chapter1/context/REFERENCE.md` (removed, +0/-1179)
```diff
@@ -1,1179 +0,0 @@
-# Context-Aware AI Agent with Ablation Studies / 上下文感知 Agent 与消融实验
-
-> Multi-provider context-aware agent with systematic ablation of context components (history, reasoning, tool calls, tool results).
-> 配套《深入理解 AI Agent》第 1 章 **实验 1-1 ★★：上下文的关键作用**。
-
-← [Chapter 1 index / 返回第 1 章目录](../README.md) · 📖 [Read the chapter / 读本章正文](../../book/chapter1.md)（[EN](../../book-en/chapter1.md)）
-
----
-
-[中文说明](#中文) · [English](#english)
-
-## 先跑一个对照
-
-这个实验研究：给同一个模型、同一个任务，少提供一类上下文信息，执行过程会发生什么变化？
-“消融”就是一次只移除一个组件，再与完整版本比较。先观察一个任务，之后再运行批量实验。
-
-你需要 Python 3.10+，以及一个可用的模型 API Key。下面以百炼为例；其他提供商的配置见中文说明。
-在仓库根目录安装依赖并激活环境，再进入实验目录：
-
-```bash
-uv sync --locked --extra ch1
-source .venv/bin/activate
-cd chapter1/context
-export DASHSCOPE_API_KEY='your-api-key-here'
-
-python main.py --mode single --provider dashscope --context-mode full \
-  --task "请调用计算器计算 (125 + 375) * 8，并给出结果。" --output full.json
-python main.py --mode single --provider dashscope --context-mode no_tool_results \
-  --task "请调用计算器计算 (125 + 375) * 8，并给出结果。" --output no-tool-results.json
-```
-
-Windows 的环境激活方式和其他安装方法见下文“快速开始”。这两条命令会调用模型 API。
-
-计算结果应为 **4000**。但答案相同不代表两次执行相同：先检查是否调用了计算器，再看工具结果是否
-进入了下一轮上下文。即使没有看到工具结果，模型也可能自己算对这道简单题。
-如果没有发生工具调用，这次任务就不能说明移除工具结果的影响；应换一个确实需要工具的任务再比较。
-`full.json` 和 `no-tool-results.json` 保存了各次运行结果，可结合终端日志核对。
-
-读代码时，先看 `main.py` 的参数分发，再看 `agent.py` 如何组装消息和处理工具结果。
-提供商适配和绘图代码可以稍后阅读。
-
-## 中文
-
-### 概述
-
-对应书中**实验 1-1 ★★：上下文的关键作用**。Agent 可以读取 PDF、换算货币、计算表达式和执行 Python。你可以分别移除历史消息、推理内容、工具定义或工具结果，观察它怎样完成同一任务。下面的配置说明供你在跑通第一个对照后查阅。
-
-### 主要特性
-
-- **多提供商支持**：阿里云百炼（Qwen 直连）、SiliconFlow（Qwen）、Doubao（字节）、Kimi（月之暗面）、DeepSeek
-- **多工具 Agent**：PDF 解析、货币换算、计算与 Python 代码执行
-- **上下文模式**：五种配置，用于消融对照
-- **交互与批处理**：单任务运行或完整测试套件
-- **对话历史**：同一会话内跨多轮查询保持上下文
-- **详细分析**：性能指标、可视化与综合报告
-
-### 支持的 LLM 提供商
-
-#### Doubao（字节跳动）— 默认
-
-- **模型**：`doubao-seed-1-6-thinking-250715`（可自定义）
-- **API**：火山引擎上的 OpenAI 兼容接口
-- **适合**：深度推理、较快响应，中英文任务均可
-
-#### SiliconFlow
-
-- **模型**：`Qwen/Qwen3.5-397B-A17B`（可自定义）
-- **API**：OpenAI 兼容
-- **适合**：复杂推理与细致分析
-
-#### 阿里云百炼（Qwen 直连）
-
-- **模型**：`qwen3.7-plus`（可通过 `--model` 自定义）
-- **API**：直连 DashScope 的 OpenAI 兼容接口，无需 SiliconFlow 账号
-- **提供商名称**：规范名称为 `dashscope`，也可使用别名 `qwen` 或 `bailian`
-- **区域说明**：API Key 与区域绑定。中国内地 Key 默认直连内地端点；国际站 Key 必须设置 `DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
-
-#### Kimi（月之暗面）
-
-- **模型**：`kimi-k3`（K3 推理模型；temperature 强制为 1，max_tokens 足够容纳思考输出）
-- **API**：Moonshot 平台 OpenAI 兼容接口
-- **适合**：深度推理、多轮对话，中英文任务均可
-- **特性**：上下文缓存以优化成本
-
-#### DeepSeek
-
-- **模型**：`deepseek-v4-flash`（默认；更强档可用 `--model deepseek-v4-pro`）
-- **API**：[DeepSeek Platform](https://platform.deepseek.com/) 的 OpenAI 兼容接口
-- **适合**：性价比高的工具调用；开启 thinking，便于 `no_reasoning` 消融剥离 `reasoning_content`
-- **说明**：旧别名 `deepseek-chat` / `deepseek-reasoner` 已弃用（2026-07-24），请优先使用 V4 id
-
-### 架构
-
-#### 上下文组件
-
-1. **Full Context** — 完整 Agent，保留全部组件
-2. **No History** — 缺少历史工具调用追踪
-3. **No Reasoning** — 无战略规划/思考过程
-4. **No Tool Calls** — 无法执行外部工具
-5. **No Tool Results** — 看不到工具执行结果
-
-#### 可用工具
-
-- **`parse_pdf(url)`** — 下载并抽取 PDF 文本
-- **`convert_currency(amount, from, to)`** — 货币换算
-- **`calculate(expression)`** — 简单数学表达式求值
-- **`code_interpreter(code)`** — 执行 Python，用于复杂计算、汇总与数据处理
-
-### 前置条件
-
-- Python 3.10+
-- 任一支持提供商的 API Key：
-  - **阿里云百炼**：[百炼控制台](https://bailian.console.aliyun.com/)
-  - **SiliconFlow**：[SiliconFlow](https://siliconflow.cn)
-  - **Doubao（字节）**：[火山引擎](https://www.volcengine.com/)
-  - **Kimi（月之暗面）**：[Moonshot Platform](https://platform.moonshot.cn/)
-  - **DeepSeek**：[DeepSeek Platform](https://platform.deepseek.com/api_keys)
-
-### 示例任务
-
-系统预置 5 个样例任务：
-
-1. **简单货币换算** — 基础多币种计算
-2. **多币种预算分析** — 跨办公室费用分析
-3. **PDF 财务分析** — 解析并分析财务文档
-4. **投资增长计算** — 复利与货币换算
-5. **综合财务报告** — 串联全部工具的完整流程
-
-用于展示 Agent 能力与上下文消融的影响。
-
-### 快速开始
-
-#### 1. 安装
-
-```bash
-# 推荐在仓库根目录使用统一的第 1 章环境
-uv sync --locked --extra ch1
-
-# 切换目录前先激活环境：
-# macOS/Linux：
-source .venv/bin/activate
-# Windows Pow
```

**File**: `chapter1/image-gen-workflow/README.md` (modified, +175/-19)
```diff
@@ -1,37 +1,193 @@
-# 提示词改写会让生成图片更符合需求吗
+# 实验 1-4：文生图工作流与原生图像生成的对照
 
-[本章实验目录](../README.md) · [相关正文](../../book/chapter1.md) · [技术参考](REFERENCE.md)
+对应书稿 `book/chapter1.md` 的「实验 1-4 ★」。
 
-用户说“画一张耳机海报”，与明确指定画面、风格和文案，是两种不同的任务。本实验比较直接生成图片和先改写提示词再生成图片，学习如何判断一个工作流步骤是否真正有帮助。
+## 实验目标
 
-## 理解实验
+让同一句口语化中文需求走两条路线，对照观察：
 
-改写节点把用户语言转成图像模型的输入，也可能补充场景细节。对于宽泛需求，这可能有助于形成画面；对于具体需求，多加的内容却可能挤掉用户的原始约束。因此，应分别评价创意补充和要求保留。
+1. **工作流路线中「改写」节点产出的提示词与原始需求的差异**——LLM 在这一节点做的不是智能决策，而是「翻译」：把自然语言适配成文生图模型能消化的输入格式；
+2. **两条路线最终图片对原始需求的满足程度**。
 
-## 动手之前
+需求按口语化程度分两类对照：
 
-运行模型部分需要按技术参考配置对应的服务凭据；调用会使用该服务的额度。先准备一个小任务，再扩展比较范围。 通用环境说明见[实验学习指南](../../docs/EXPERIMENTS.md)。
+- **具体需求**：用户已指定场景、风格或文案细节，考察的是执行的**忠实度**——改写节点会不会弄丢或篡改用户给定的信息；
+- **宽泛需求**：用户只给主题不给细节，考察的是改写节点做**场景具象化**带来的信息增益——它替用户想象出的画面，是原生路线直接出图所没有的叙事性，还是多此一举的过度发挥。
 
-## 一步步观察
+测试需求（5 句口语化中文描述，`main.py` 中 `REQUIREMENTS`）：
 
-配置参考文档中对应路线的模型凭据后，先只选 `windowsill-plant` 这一项。运行后并排阅读原始需求、改写后的提示词和最终图片。再选择一个宽泛需求，重复同样的观察，避免一开始就批量生成所有图片。
+| 类别 | ID | 需求 |
+| --- | --- | --- |
+| 具体 | `programmer-overtime` | 帮我画一个周末加班的程序员，风格丧一点 |
+| 具体 | `windowsill-plant` | 帮我画一盆放在窗台上的绿植，早晨的阳光刚好照进来 |
+| 具体 | `headphone-poster` | 帮我做一张新款降噪耳机的产品海报，主打"深夜独处也清净"这句文案，风格简约高级 |
+| 宽泛（主用例） | `agi-programmer` | 帮我画一个 AGI 实现以后程序员的工作场景 |
+| 宽泛 | `future-city-morning` | 帮我画一幅"未来城市的早晨"的画 |
 
-以下命令从本实验目录运行；请先完成上面的环境准备。
+## 三条路线的架构
 
-```bash
-python main.py --requirement windowsill-plant
+```
+工作流路线（workflow）：
+  用户需求 ──> [节点 1: 提示词改写, Kimi kimi-k3]
+                 输出 SD 风格 JSON：{prompt（逗号分隔英文 tag + 质量词）,
+                                      negative_prompt, style_notes}
+             ──> [节点 2: 文生图, 通义万相 wan2.2-t2i-flash]
+                 输入改写后的 prompt / negative_prompt，输出图片
+
+原生路线 A（native）：
+  用户需求 ──> [Gemini gemini-3-pro-image（书稿所称 Nano Banana 2）]
+                 一次调用直接输出图片（response_modalities=["IMAGE"]）
+
+原生路线 B（native_gptimage）：
+  用户需求 ──> [OpenAI gpt-image-2（GPT-Image 2）]
+                 images/generations 接口，一次调用直接出图
 ```
 
-## 怎样解释结果
+工作流路线的执行路径是代码写死的（先改写、后生成，见 `pipeline.py` 的
+`run_workflow_route`）；两条原生路线都没有改写节点，模型自己理解口语化需求并直接出图。
+
+## 模型选型实录（如实记录）
+
+- **原生路线 A（native）**：**`gemini-3-pro-image`**（书稿所称 Nano Banana 2）——
+  ListModels 实测可用，5 句需求全部一次成功（20260821T040450Z 轮）；早期轮次
+  `agi-programmer` 偶发内容过滤（候选响应 content 为 None），重跑后恢复，非不可用。
+- **原生路线 B（native_gptimage）**：OpenAI **`gpt-image-2`**（GPT-Image 2，
+  images/generations 接口）——全部 5 句需求均一次成功。该账户此前 GPT-5.x 因
+  `credit_balance_exhausted` 失败过，但图像接口可用。
+- **工作流路线生图工具**：实验设计首选 SiliconFlow 托管的 FLUX.1 / Stable Diffusion
+  系列，实测 `black-forest-labs/FLUX.1-schnell` 与
+  `stabilityai/stable-diffusion-3-5-large` 返回 `Model disabled`；账户余额为 0，
+  `Kwai-Kolors/Kolors`、`Tongyi-MAI/Z-Image-Turbo`、`Qwen/Qwen-Image` 均报
+  `balance insufficient`；OpenRouter 仅提供视觉理解模型，不支持文本转图像生成。
+  改用 **DashScope 国际站通义万相 `wan2.2-t2i-flash`**（经典扩散式文生图模型，接受
+  SD 风格提示词与负面提示词，异步任务接口）。注意：该模型服务端会再做一次内部提示词
+  扩写（响应中的 `actual_prompt` 字段），已一并留证。
+- **改写节点 LLM**：Moonshot **`kimi-k3`**（OpenAI 兼容接口）。
+  kimi-k3 只允许 temperature=1（默认值），显式传其他值被 400 拒绝。
+
+## 配置与运行
 
-检查窗台、绿植和晨光是否同时出现，而不只判断图片是否漂亮。如果某个要求消失了，先查它是否在改写时丢失；若提示词仍保留它，再分析图像生成阶段。不同路线使用的模型也不同，结果不能全部归因于是否改写。
+```bash
+# 在仓库根目录
+cp chapter1/image-gen-workflow/env.example .env   # 填入各 API Key（或 export 环境变量）
 
-## 继续思考
+cd chapter1/image-gen-workflow
+pip install -r requirements.txt   # google-genai openai requests python-dotenv
 
-怎样设计一个既奖励合理补充、又惩罚擅自修改明确要求的评分表？
+# 标准运行：全部 5 句需求 × 3 条路线（workflow/native/native_gptimage）
+python main.py
 
-## 阅读代码与技术参考
+# 只跑某条路线 / 某句需求
+python main.py --route workflow
+python main.py --route native_gptimage
+python main.py --requirement windowsill-plant
 
-沿下面的顺序阅读代码，可以把前面的概念与实现对应起来：[main.py](https://github.com/bojieli/ai-agent-book/blob/main/chapter1/image-gen-workflow/main.py) → [pipeline.py](https://github.com/bojieli/ai-agent-book/blob/main/chapter1/image-gen-workflow/pipeline.py) → [evidence.py](https://github.com/bojieli/ai-agent-book/blob/main/chapter1/image-gen-workflow/evidence.py)。
+# 离线测试（不发真实请求）
+python -m pytest
+```
+
+所需环
```

---

### Incident Patch 2: `19fa4233` (2026-09-22)
**Commit Message**: docs(ch1): fix Harness emphasis rendering (#1136) (#1141)

Co-authored-by: Bojie Li <i@01.me>

**File**: `book/chapter1.md` (modified, +1/-1)
```diff
@@ -505,7 +505,7 @@ while true:
 
 ### Harness 五要素与「构建」部分的对应
 
-**先说清楚两个公式的关系，以免读者记住两套骨架。** 全书的结构骨架只有一个，就是引言和后记反复使用的 **Agent = LLM + 上下文 + 工具**：第二至六章讨论构建，第七至九章讨论评估与进化，第十章讨论协作。**Agent = Model + Harness** 不是与它并列的另一套划分，而是同一事物在生产形态下的展开——它把“上下文”和“工具”两项细分为上下文管理、工具接口、约束、验证、纠正五项职责，因此它是**“构建”这一部分内部的一个观察视角**，而不是覆盖全书十章的目录。
+**先说清楚两个公式的关系，以免读者记住两套骨架。** 全书的结构骨架只有一个，就是引言和后记反复使用的 **Agent = LLM + 上下文 + 工具**：第二至六章讨论构建，第七至九章讨论评估与进化，第十章讨论协作。**Agent = Model + Harness** 不是与它并列的另一套划分，而是同一事物在生产形态下的展开——它把“上下文”和“工具”两项细分为上下文管理、工具接口、约束、验证、纠正五项职责，因此，它是**构建部分内部的一个观察视角**，而不是覆盖全书十章的目录。
 
 在这个范围内，Harness 五要素与第二至五章有清晰的对应：
 
```

---

### Incident Patch 3: `59e00981` (2026-09-22)
**Commit Message**: fix(site): generate homepage chapter index from manuscripts (#1139)

* fix(site): generate homepage chapter cards from manuscripts (#1138)

* test(site): keep YAML-dependent audit in the docs environment

---------

Co-authored-by: Bojie Li <i@01.me>

**File**: `.github/workflows/deploy-pages.yml` (modified, +9/-0)
```diff
@@ -6,6 +6,11 @@ on:
   pull_request:
     paths:
       - ".github/workflows/deploy-pages.yml"
+      - "scripts/**"
+      - "tests/test_homepage_index.py"
+      - "index*.md"
+      - "mkdocs.yml"
+      - "extras/**"
       - "web-astro/**"
       - "book*/**"
       - "README*.md"
@@ -37,6 +42,10 @@ jobs:
           python-version: "3.11"
       - name: Install MkDocs Material
         run: pip install -r requirements-docs.txt
+      - name: Test homepage generation
+        run: |
+          pip install pytest
+          python -m pytest tests/test_homepage_index.py -q
       - name: Assemble docs
         run: bash scripts/build_site.sh
       - name: Build site
```

**File**: `docs/STATIC_SITE_I18N.md` (modified, +26/-0)
```diff
@@ -62,3 +62,29 @@ The check automatically discovers languages and named navigation entries from
 
 The `i18n consistency check` GitHub Actions workflow runs this audit whenever
 site configuration, translated books, navigation code, or the catalog changes.
+
+## Homepage chapter cards
+
+The `index.md` and `index.<language>.md` homepages are templates. Keep their
+`<!-- book-chapter-index -->` marker: `scripts/homepage_index.py` replaces it
+with chapter cards during every MkDocs build, including local previews.
+There is no generated index to commit or manually synchronize.
+
+The generator follows the chapter index paths in `mkdocs.yml`'s navigation,
+reads each edition's level-one manuscript heading for the card title, and
+uses its first three level-two headings as a short contents preview. It also
+includes the introduction, afterword, and reference answers. Code fences are
+excluded when reading headings. Language prefixes and filename suffixes come
+from `extra.languages`; translated homepages use relative links that work
+under the GitHub Pages repository subpath.
+
+To change a chapter title or its contents preview, edit the manuscript. To
+change the order of chapters, edit the navigation. Missing source files,
+missing titles, or duplicate chapter paths fail the build. The homepage
+regression tests run in the Pages PR workflow:
+
+```bash
+python -m pytest tests/test_homepage_index.py -q
+bash scripts/build_site.sh
+mkdocs build -d site
+```
```

**File**: `index.he.md` (modified, +1/-63)
```diff
@@ -28,69 +28,7 @@ description: ספר טכני פתוח על סוכני AI, הבנוי סביב ה
 
 ## מבט מהיר על הספר
 
-<div class="exp-grid" markdown>
-
-<a class="exp-card" href="../book-he/introduction.he/">
-<span class="exp-title">📖 הקדמה</span>
-<span class="exp-desc">מדוע נכתב הספר · כיצד עקרונות עיצוב טובים שורדים דורות של מודלים</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter1.he/">
-<span class="exp-title">🚀 פרק 1 · צעדים ראשונים עם סוכני AI</span>
-<span class="exp-desc">Agent = LLM + הקשר + כלים · הנדסת Harness כמקור ליתרון תחרותי</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter2.he/">
-<span class="exp-title">🎯 פרק 2 · הנדסת הקשר</span>
-<span class="exp-desc">KV Cache, הנדסת פרומפטים, Agent Skills ודחיסת הקשר</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter3.he/">
-<span class="exp-title">📚 פרק 3 · זיכרון משתמש ובסיס ידע</span>
-<span class="exp-desc">זיכרון בין מפגשים, RAG, אינדוקס מובנה וגרפי ידע</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter4.he/">
-<span class="exp-title">🛠️ פרק 4 · כלים</span>
-<span class="exp-desc">MCP, כלי תפיסה וביצוע, שיתוף פעולה וגילוי כלים</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter5.he/">
-<span class="exp-title">💻 פרק 5 · סוכן קוד ויצירת קוד</span>
-<span class="exp-desc">קוד ככלי שיוצר כלים חדשים · התמונה המלאה של סוכני קוד ברמת ייצור</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter6.he/">
-<span class="exp-title">🎙️ פרק 6 · אינטראקציה</span>
-<span class="exp-desc">אירועים אסינכרוניים, קול, Computer Use ורובוטיקה</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter7.he/">
-<span class="exp-title">🎯 פרק 7 · הערכת סוכנים</span>
-<span class="exp-desc">סביבות הערכה, מדדים, מובהקות סטטיסטית ובחירת מודלים</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter8.he/">
-<span class="exp-title">🧠 פרק 8 · אימון־על של מודלים</span>
-<span class="exp-desc">אימון ביניים, SFT ו־RL · הפיכת אותות משוב ליכולות מודל</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter9.he/">
-<span class="exp-title">🔄 פרק 9 · התפתחות מתמשכת של סוכנים</span>
-<span class="exp-desc">הפקת אותות למידה ממסלולים ועדכון ידע, הוראות, תוכנות ופרמטרים</span>
-</a>
-
-<a class="exp-card" href="../book-he/chapter10.he/">
-<span class="exp-title">🤝 פרק 10 · שיתוף פעולה רב־סוכני</span>
-<span class="exp-desc">מסגרות שיתוף פעולה, שיתוף והפרדת הקשר וחברות של סוכנים</span>
-</a>
-
-<a class="exp-card" href="../book-he/afterword.he/">
-<span class="exp-title">📝 אחרית דבר</span>
-<span class="exp-desc">האם מודלים יאכלו את ה־Harness? תשובה מלאה ומבט קדימה</span>
-</a>
-
-</div>
+<!-- book-chapter-index -->
 
 ---
 
```

**File**: `index.ko.md` (modified, +1/-63)
```diff
@@ -28,69 +28,7 @@ description: 핵심 공식 Agent = LLM + 컨텍스트 + 도구를 중심으로,
 
 ## 한눈에 보는 구성
 
-<div class="exp-grid" markdown>
-
-<a class="exp-card" href="../book-ko/introduction.ko/">
-<span class="exp-title">📖 들어가며</span>
-<span class="exp-desc">왜 이 책을 썼는가 · 좋은 설계 원칙은 어떻게 모델 세대 교체를 넘어서는가</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter1.ko/">
-<span class="exp-title">🚀 제1장 · AI 에이전트 기초</span>
-<span class="exp-desc">Agent = LLM + 컨텍스트 + 도구 · 경쟁력의 핵심은 하네스 엔지니어링</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter2.ko/">
-<span class="exp-title">🎯 제2장 · 컨텍스트 엔지니어링</span>
-<span class="exp-desc">컨텍스트가 능력의 상한을 결정 · KV Cache, 프롬프트 엔지니어링, Agent Skills, 컨텍스트 압축</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter3.ko/">
-<span class="exp-title">📚 제3장 · 사용자 메모리와 지식 베이스</span>
-<span class="exp-desc">세션을 넘어 사용자를 기억하고 외부 지식을 연결 · 사용자 메모리, RAG, 구조화 색인, 지식 그래프</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter4.ko/">
-<span class="exp-title">🛠️ 제4장 · 도구</span>
-<span class="exp-desc">도구는 에이전트의 두 손 · MCP 프로토콜, 인식·실행·협업 세 종류의 도구, 비동기 에이전트</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter5.ko/">
-<span class="exp-title">💻 제5장 · 코딩 에이전트와 코드 생성</span>
-<span class="exp-desc">코드는 '새 도구를 만들 수 있는 도구' · 프로덕션급 코딩 에이전트의 전체 그림</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter6.ko/">
-<span class="exp-title">🎯 제6장 · 에이전트 평가</span>
-<span class="exp-desc">성능을 비교 가능한 신호로 · 평가 환경, 지표, 통계적 유의성</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter7.ko/">
-<span class="exp-title">🧠 제7장 · 모델 사후 학습</span>
-<span class="exp-desc">SFT와 강화 학습 · 하네스에 쌓인 피드백 신호를 모델 파라미터에 기록</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter8.ko/">
-<span class="exp-title">🌱 제8장 · 에이전트의 지속적 진화</span>
-<span class="exp-desc">신뢰할 수 있는 학습 신호에서 지식·지침·프로그램·파라미터 갱신까지</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter9.ko/">
-<span class="exp-title">🎙️ 제9장 · 멀티모달과 실시간 상호작용</span>
-<span class="exp-desc">음성 에이전트, Computer Use, 로봇 조작</span>
-</a>
-
-<a class="exp-card" href="../book-ko/chapter10.ko/">
-<span class="exp-title">🤝 제10장 · 멀티 에이전트 협업</span>
-<span class="exp-desc">협업 아키텍처, 실패 유형, 에이전트 사회</span>
-</a>
-
-<a class="exp-card" href="../book-ko/afterword.ko/">
-<span class="exp-title">📝 후기</span>
-<span class="exp-desc">모델이 하네스를 삼키게 될까? 완전한 답과 전망</span>
-</a>
-
-</div>
+<!-- book-chapter-index -->
 
 ---
 
```

**File**: `index.md` (modified, +1/-63)
```diff
@@ -28,69 +28,7 @@ description: 围绕核心公式 Agent = LLM + 上下文 + 工具,用 10 章把 A
 
 ## 章节速览
 
-<div class="exp-grid" markdown>
-
-<a class="exp-card" href="book/introduction/">
-<span class="exp-title">📖 引言</span>
-<span class="exp-desc">为什么写这本书 · 好的设计原则如何穿越模型迭代周期</span>
-</a>
-
-<a class="exp-card" href="book/chapter1/">
-<span class="exp-title">🚀 第 1 章 · Agent 基础知识</span>
-<span class="exp-desc">Agent = LLM + 上下文 + 工具；Harness 工程才是竞争力</span>
-</a>
-
-<a class="exp-card" href="book/chapter2/">
-<span class="exp-title">🎯 第 2 章 · 上下文工程</span>
-<span class="exp-desc">上下文决定能力上限:KV Cache、提示工程、Agent Skills、上下文压缩</span>
-</a>
-
-<a class="exp-card" href="book/chapter3/">
-<span class="exp-title">📚 第 3 章 · 用户记忆和知识库</span>
-<span class="exp-desc">跨会话记住用户、接入外部知识:用户记忆、RAG、结构化索引、知识图谱</span>
-</a>
-
-<a class="exp-card" href="book/chapter4/">
-<span class="exp-title">🛠️ 第 4 章 · 工具</span>
-<span class="exp-desc">工具是 Agent 的双手:MCP 协议、感知/执行/协作三类工具、异步 Agent</span>
-</a>
-
-<a class="exp-card" href="book/chapter5/">
-<span class="exp-title">💻 第 5 章 · Coding Agent 与代码生成</span>
-<span class="exp-desc">代码是「能创造新工具的工具」,生产级 Coding Agent 全景</span>
-</a>
-
-<a class="exp-card" href="book/chapter6/">
-<span class="exp-title">🎯 第 6 章 · Agent 的评估</span>
-<span class="exp-desc">把表现变成可比较信号:评估环境、指标、统计显著性</span>
-</a>
-
-<a class="exp-card" href="book/chapter7/">
-<span class="exp-title">🧠 第 7 章 · 模型后训练</span>
-<span class="exp-desc">SFT、强化学习——把 Harness 中积累的反馈信号写入模型参数</span>
-</a>
-
-<a class="exp-card" href="book/chapter8/">
-<span class="exp-title">🌱 第 8 章 · Agent 的持续进化</span>
-<span class="exp-desc">从可靠学习信号到知识、指令、程序与参数更新</span>
-</a>
-
-<a class="exp-card" href="book/chapter9/">
-<span class="exp-title">🎙️ 第 9 章 · 多模态与实时交互</span>
-<span class="exp-desc">语音 Agent、Computer Use、机器人操作</span>
-</a>
-
-<a class="exp-card" href="book/chapter10/">
-<span class="exp-title">🤝 第 10 章 · 多 Agent 协作</span>
-<span class="exp-desc">协作架构、失败模式、Agent 社会</span>
-</a>
-
-<a class="exp-card" href="book/afterword/">
-<span class="exp-title">📝 后记</span>
-<span class="exp-desc">模型会不会吃掉 Harness?完整答案与展望</span>
-</a>
-
-</div>
+<!-- book-chapter-index -->
 
 ---
 
```

---

### Incident Patch 4: `873a20ce` (2026-09-20)
**Commit Message**: test: add regression check for fig0-1 overview figure chapter numbers (#1132)

**File**: `tests/test_chapter_numbering_consistency.py` (modified, +23/-1)
```diff
@@ -6,9 +6,9 @@
 
 from __future__ import annotations
 
+import html
 from pathlib import Path
 
-
 ROOT = Path(__file__).resolve().parents[1]
 
 CHAPTERS = {
@@ -137,3 +137,25 @@ def test_chapter_overviews_do_not_link_obsolete_run_ids():
         content = read(path)
         for fragment in fragments:
             assert fragment not in content, (path, fragment)
+
+
+def test_introduction_overview_figure_uses_current_chapter_numbers():
+    """fig0-1 must agree with fig0-2 on where each chapter sits.
+
+    The figure was corrected in #1111 (issue #1079); this locks the 2.0
+    numbering in so the stale 1.4 numbers cannot drift back unnoticed.
+    fig0-1 stores its text as numeric character references, so it is
+    unescaped before matching.
+    """
+    overview_figure = html.unescape(read("book/images/fig0-1.svg"))
+
+    assert "第 7 章 评估" in overview_figure
+    assert "第 8 章 后训练" in overview_figure
+    assert "第 6 章 交互" in overview_figure
+    assert "第 9 章 持续进化" in overview_figure
+    assert "第 10 章 多 Agent" in overview_figure
+
+    assert "第 6 章 评估" not in overview_figure
+    assert "第 7 章 后训练" not in overview_figure
+    assert "第 8 章 自我进化" not in overview_figure
+    assert "第 9 章 多模态" not in overview_figure
```

---

### Incident Patch 5: `2c730262` (2026-09-19)
**Commit Message**: fix(site): keep experiment figures inside their blockquote box (#1118)

Follow-up to #1087. The figure-caption hook rewrote the Markdown, so a
quoted experiment figure (`> ![图8-7 …](…)`) had to lose its `>` marker:
Python-Markdown has no Markdown-level shape that puts a <figure> directly
inside a <blockquote>. The experiment box therefore split in two with a
bare figure between, and the quote bar broke at every one of the 23
experiment figures per edition.

Run the hook on the rendered HTML instead (on_page_content). There a
standalone image is always `<p><img …></p>`, inside or outside a
blockquote, and can be wrapped in <figure>/<figcaption> in place. The
<img> tag is kept exactly as Python-Markdown emitted it and the caption is
its already-escaped alt text, so numbering and captions are unchanged.
Hook ordering in mkdocs.yml no longer matters (the Pandoc strip is a
Markdown-stage hook and always runs first).

Tests: HTML-level cases plus end-to-end through Python-Markdown with the
site's extensions (skipped where `markdown` is not installed), asserting
the quoted figure stays a direct child of a single <blockquote>.

Co-authored-by: Bojie Li <i@01.me>
Co-authored-by: Claude Fabl

**File**: `mkdocs.yml` (modified, +5/-5)
```diff
@@ -25,11 +25,11 @@ hooks:
   - scripts/mkdocs_pandoc_strip.py
   # Wrap every standalone book figure in <figure>/<figcaption> so the label the
   # author already wrote in the image alt text ("图0-2 …", "Figure 0-2: …")
-  # becomes a visible caption on the reading site. Must run AFTER the Pandoc
-  # strip above: by the time this hook runs the figure is raw HTML that the
-  # strip hook can no longer reach, so a leftover `{height=55%}` would be
-  # printed as literal text in the caption. See the module docstring for why
-  # this is a build-time hook rather than a browser script.
+  # becomes a visible caption on the reading site. Works on the rendered HTML
+  # (on_page_content), which is what lets the experiment figures stay inside
+  # their `> ` blockquote box; the Pandoc strip above is a Markdown-stage hook,
+  # so it has always run by then whatever the order here. See the module
+  # docstring for why this is a build-time hook rather than a browser script.
   - scripts/mkdocs_figure_captions.py
   - scripts/seo_meta.py
   # Splits the search plugin's single 55 MB search_index.json into one file
```

**File**: `scripts/mkdocs_figure_captions.py` (modified, +65/-97)
```diff
@@ -12,128 +12,96 @@
 caption has to be in the served HTML for search engines, screen readers,
 "view source", and the no-JavaScript case.
 
-This hook rewrites such lines *before* Python-Markdown runs (MkDocs runs every
-`on_page_markdown` hook before parsing):
+This hook rewrites the *rendered* HTML (`on_page_content`, i.e. after
+Python-Markdown has run). A lone image line always comes out of
+Python-Markdown as a paragraph holding nothing but the `<img>`:
 
-    ![图0-2 全书结构](images/fig0-2.svg)
+    <p><img alt="图0-2 全书结构" src="images/fig0-2.svg" /></p>
       ->  <figure class="md-typeset-figure">
-          <img src="images/fig0-2.svg" alt="图0-2 全书结构">
+          <img alt="图0-2 全书结构" src="images/fig0-2.svg" />
           <figcaption>图0-2 全书结构</figcaption>
           </figure>
 
-The `<figure>` is emitted as finished HTML rather than with `markdown="1"`, for
-two reasons:
-
-* inside a blockquote, `md_in_html` never processes the nested figure, so the
-  attribute survived into the page and the `<figcaption>` came out wrapped in a
-  `<p>` (both verified in a real build);
-* it keeps the caption verbatim — the book's captions are plain single-line text
-  (no emphasis or links), so nothing is lost, and no stray Pandoc attribute can
-  end up printed inside the caption.
-
-The caption is never invented: it is the label the author already wrote in the
-alt text, so numbering stays identical to the PDF/EPUB and to every translated
-edition.
-
-Run this hook AFTER `mkdocs_pandoc_strip.py` (see mkdocs.yml): the image line
-must already be free of Pandoc attributes (`{height=55%}`), because the `src`
-written here is final and any leftover attribute would be printed verbatim.
-
-Images inside a blockquote (`> ![图8-7 …](…)`, the 23 experiment figures of
-each edition) lose their quote marker and render as plain centered figures like
-every other figure. Python-Markdown offers no shape that avoids this: a figure
-quoted line comes out as `<p><figure>` with its `<figcaption>` wrapped in a
-`<p>` (inside a blockquote every block is parsed as a paragraph), and with
-`markdown="1"` the attribute and the extra `<p>` both reached the served HTML.
-Every such line is a standalone blockquote, so no prose is disturbed; the only
-visible effect is that the surrounding quote bar breaks where the figure sits.
-Images that are inline inside a sentence (Vietnamese chapter 2) are left alone,
-since splitting their paragraph would reflow prose.
+Working on the HTML rather than the Markdown is what keeps the 23 experiment
+figures of each edition inside their experiment box. Those are written as
+
+    > **实验 8-2 ★★：…**
+    >
+    > ![图8-7 …](images/fig8-7.svg)
+    >
+    > 正文 …
+
+and Python-Markdown offers no Markdown-level shape that puts a `<figure>`
+directly inside a `<blockquote>`: raw HTML on a quoted line is treated as
+inline HTML (`<p><figure>`, caption wrapped in a `<p>`), and `md_in_html`'s
+`markdown="1"` is never processed inside a quote, so the earlier
+Markdown-level version of this hook had to drop the `>` marker and the quote
+bar broke around every experiment figure. Once the page is HTML the quoted
+image is just `<blockquote>…<p><img …></p>…</blockquote>` and can be wrapped
+in place, so the experiment box stays one unbroken blockquote.
+
+The `<img>` tag is kept exactly as Python-Markdown emitted it, and the
+caption is the alt text verbatim: it is the label the author already wrote,
+so numbering stays identical to the PDF/EPUB and to every translated edition.
+Python-Markdown has already HTML-escaped the alt attribute (`&amp;`, `&lt;`,
+`&quot;`), and every such entity is equally valid as element text, so the
+caption is safe to copy as-is.
+
+Images that sit inside a sentence (Vietnamese chapter 2) produce a `<p>` with
+other content around the `<img>`, so they never match and their prose is not
+reflowed. Image syntax inside a code block is rendered as `<code>` text, not
+an `<img>`, so it is never touched either.
+
+`
```

**File**: `tests/test_mkdocs_figure_captions.py` (modified, +114/-88)
```diff
@@ -1,12 +1,16 @@
 """Tests for the MkDocs hook that turns book figures into <figure> + <figcaption>.
 
-Two things are locked down here:
-
-1. the line transform itself (standalone images, blockquoted images, Pandoc
-   attributes, code fences, inline images); and
-2. the book sources the transform depends on — every figure in every edition
+Three things are locked down here:
+
+1. the HTML transform itself (standalone images, inline images, images
+   without alt text, attributes Python-Markdown may add);
+2. end to end through Python-Markdown with the site's extensions: a quoted
+   experiment figure must stay inside its <blockquote>, and image syntax in
+   a code fence must stay code (skipped when `markdown` is not installed —
+   the site build installs it via requirements-docs.txt); and
+3. the book sources the transform depends on — every figure in every edition
    must carry its "图X-Y …" / "Figure X-Y: …" label in the image alt text,
-   because that alt text is exactly what the site now prints as the caption.
+   because that alt text is exactly what the site prints as the caption.
 """
 
 from __future__ import annotations
@@ -15,138 +19,160 @@
 import sys
 from pathlib import Path
 
+import pytest
+
 ROOT = Path(__file__).resolve().parents[1]
 sys.path.insert(0, str(ROOT / "scripts"))
 
 from mkdocs_figure_captions import (
     _IMAGE_LINE,
     _transform,
     iter_figure_files,
-    on_page_markdown,
+    on_page_content,
 )
 from mkdocs_pandoc_strip import on_page_markdown as strip_pandoc_attrs
 
 # Every edition labels its figures in its own script, e.g. 图1-1, 圖 1-1,
 # 図1-1, 그림 1-1, Figure 1-1:, Figura 1-1:, Рис. 1-1., Şekil 1-1:, 1-1. ábra:,
 # איור 1‑1: (note the non-breaking hyphen), படம் 1-1, Hình 1-1:, Gambar 1-1:.
-FIGURE_LABEL = re.compile(r"\d+\s*[-\u2010\u2011\u2012\u2013]\s*\d+")
+FIGURE_LABEL = re.compile(r"\d+\s*[-‐‑‒–]\s*\d+")
 
+# The extensions from mkdocs.yml that shape how an image line is rendered.
+SITE_EXTENSIONS = ["admonition", "attr_list", "footnotes", "md_in_html"]
 
-def test_standalone_image_becomes_a_captioned_figure():
-    markdown = (
-        "段落。\n"
-        "\n"
-        "![图0-2 全书结构：构建 Agent 与提升 Agent 能力](images/fig0-2.svg)\n"
-        "\n"
-        "后续段落。\n"
-    )
 
-    result = _transform(markdown)
-
-    assert (
-        '<figure class="md-typeset-figure">\n'
-        '<img src="images/fig0-2.svg" alt="图0-2 全书结构：构建 Agent 与提升 Agent 能力">\n'
-        "<figcaption>图0-2 全书结构：构建 Agent 与提升 Agent 能力</figcaption>\n"
-        "</figure>"
-    ) in result
-    assert result.startswith("段落。\n\n")
-    assert result.endswith("\n\n后续段落。\n")
-    # No `markdown="1"`: inside a blockquote md_in_html never processes the
-    # nested figure, and the attribute leaked into the served HTML.
-    assert "markdown=" not in result
+def render(markdown_text: str) -> str:
+    """Python-Markdown -> figure hook, the way MkDocs chains them."""
+    markdown = pytest.importorskip("markdown")
+    html = markdown.markdown(strip_pandoc_attrs(markdown_text), extensions=SITE_EXTENSIONS)
+    return on_page_content(html)
 
 
-def test_blockquoted_figure_becomes_a_plain_centered_figure():
-    # All 23 experiment figures per edition are written as `> ![图8-7 …](…)`.
-    # Inside a blockquote Python-Markdown cannot make the figure a direct child
-    # of the <blockquote> (`<p><figure>` came out of the real build), so the
-    # markers are dropped and the figure renders like every other figure.
-    markdown = "> ![图8-7 Q-learning 与 LLM Agent 在寻宝游戏中的架构对比](images/fig8-7.svg)\n"
+def test_standalone_image_paragraph_becomes_a_captioned_figure():
+    html = (
+        "<p>段落。</p>\n"
+        '<p><img alt="图0-2 全书结构：构建 Agent 与提升 Agent 能力" src="images/fig0-2.svg" /></p>\n'
+        "<p>后续段落。</p>"
+    )
 
-    result = _transform(markdown)
+    result = _transform(html)
 
     assert result == (
+        "<p>段落。</p>\n"
         '<figure class="md-typeset-figure">\n'
-        '<img src="images/fig8-7.svg" al
```

---

### Incident Patch 6: `65a9beb4` (2026-09-18)
**Commit Message**: fix(ch4): make execution-tools run on Windows via Git Bash / WSL instead of dying on /bin/bash (#1116)

`python cli.py demo` fails on native Windows at step 4 (#1068): the
multi-language executor unconditionally passed executable='/bin/bash' to
create_subprocess_shell, so every code_interpreter call raised
FileNotFoundError. The local Python fallback also invoked `python3`, which
Windows does not put on PATH, and the demo interpolated a backslash temp
path into a bash command line.

- multilang_executor: new find_bash() (POSIX: /bin/bash; otherwise the first
  bash on PATH, i.e. Git for Windows / MSYS2 / WSL) and BASH_MISSING_ERROR.
  _run_command returns an ERROR result with that message when no bash exists
  instead of raising, and spawns `bash -c <command>` through
  create_subprocess_exec: on Windows shell=True always wraps the command in
  `cmd.exe /c`, so a replacement executable would receive cmd's arguments.
  The local Python path runs sys.executable (forward-slash form) rather than
  `python3`; the bash runner quotes its script path the same way.
- execution_tools.virtual_terminal: on Windows run the command as
  [bash, "-c", command] (or return BASH_MISSING_ERROR); POSIX

**File**: `chapter4/execution-tools/README.md` (modified, +4/-0)
```diff
@@ -66,6 +66,8 @@ cd chapter4/execution-tools
 # python -m pip install -r requirements.txt
 ```
 
+> **Windows note**: `code_interpreter` and `virtual_terminal` run commands through `bash`. On Windows, either run the project inside WSL, or install [Git for Windows](https://gitforwindows.org/) so that `bash` (Git Bash) is on your `PATH`. Without `bash`, both tools return a clear error instead of crashing, and `python cli.py demo` stops at startup with the same message.
+
 ### Configuration
 
 1. Copy `env.example` to `.env`:
@@ -312,6 +314,8 @@ cd chapter4/execution-tools
 # python -m pip install -r requirements.txt
 ```
 
+> **Windows 用户注意**：`code_interpreter` 与 `virtual_terminal` 通过 `bash` 执行命令。在 Windows 上请在 WSL 中运行本项目，或安装 [Git for Windows](https://gitforwindows.org/) 让 `bash`（Git Bash）位于 `PATH` 中。找不到 `bash` 时，两个工具会返回明确的错误而不是崩溃，`python cli.py demo` 也会在启动时给出同样的提示。
+
 ### 配置
 
 1. 复制 `env.example` 为 `.env`：
```

**File**: `chapter4/execution-tools/cli.py` (modified, +11/-1)
```diff
@@ -35,9 +35,11 @@
 import asyncio
 import json
 import os
+import shlex
 import sys
 import tempfile
 import textwrap
+from pathlib import Path
 
 
 # ---------------------------------------------------------------------------
@@ -199,6 +201,13 @@ def cmd_demo(args: argparse.Namespace) -> int:
     校验结果。演示同时覆盖四个安全机制：linter 校验、危险命令 fail-safe 审批、
     长输出截断与持久化。整个流程默认离线运行（关闭 LLM 总结）。
     """
+    # bash 是 code_interpreter / virtual_terminal 的执行外壳。纯 Windows 环境没有
+    # bash 时，后面的步骤 4～7 都会失败，这里先给出明确提示（见 README 的 Windows 说明）。
+    from multilang_executor import find_bash, BASH_MISSING_ERROR
+    if find_bash() is None:
+        print(f"错误：{BASH_MISSING_ERROR}", file=sys.stderr)
+        return 1
+
     # 演示放在独立临时工作区，避免污染当前目录。
     workspace = tempfile.mkdtemp(prefix="exec_tools_demo_")
     os.environ["WORKSPACE_DIR"] = workspace
@@ -268,7 +277,8 @@ def word_count(path):
         # 5. virtual_terminal：用 shell 校验数据文件
         section("5. virtual_terminal：用 shell 校验数据文件")
         r = await exec_tools.virtual_terminal(
-            command=f"wc -w {workspace}/data.txt && echo '--- 词数统计完成 ---'"
+            # 正斜杠 + 引号：Windows 的临时目录路径含反斜杠和空格，直接拼进 bash 命令会被当作转义。
+            command=f"wc -w {shlex.quote(Path(workspace).as_posix())}/data.txt && echo '--- 词数统计完成 ---'"
         )
         print(f"结果：success={r['success']}, returncode={r.get('returncode')}")
         print("stdout:")
```

**File**: `chapter4/execution-tools/execution_tools.py` (modified, +15/-4)
```diff
@@ -10,7 +10,7 @@
 from contextlib import redirect_stdout, redirect_stderr
 from llm_helper import LLMHelper
 from config import Config
-from multilang_executor import LanguageExecutor, ExecutionStatus
+from multilang_executor import LanguageExecutor, ExecutionStatus, find_bash, BASH_MISSING_ERROR
 
 # Long-output handling thresholds (see "长输出的截断与持久化" in chapter 4).
 # When output exceeds either threshold, keep the head and tail few lines in the
@@ -227,11 +227,22 @@ async def virtual_terminal(
                         "error": f"Command execution not approved: {reason}"
                     }
         
-        # Execute command
+        # Execute command. POSIX keeps the platform shell. Windows has no POSIX
+        # shell of its own, so run the command through bash (Git Bash or WSL) as
+        # `bash -c`, which is what the shell examples in the book assume.
+        if os.name == "nt":
+            bash = find_bash()
+            if bash is None:
+                return {"success": False, "error": BASH_MISSING_ERROR}
+            popen_args: Any = [bash, "-c", command]
+            use_shell = False
+        else:
+            popen_args = command
+            use_shell = True
         try:
             result = subprocess.run(
-                command,
-                shell=True,
+                popen_args,
+                shell=use_shell,
                 capture_output=True,
                 text=True,
                 timeout=timeout,
```

**File**: `chapter4/execution-tools/multilang_executor.py` (modified, +36/-6)
```diff
@@ -9,6 +9,8 @@
 import base64
 import psutil
 import shlex
+import sys
+from pathlib import Path
 from typing import Dict, Any, Optional, List
 from enum import Enum
 import logging
@@ -36,6 +38,25 @@ async def get_all_output(stream) -> str:
         return ""
 
 
+BASH_MISSING_ERROR = (
+    "bash not found: code_interpreter and virtual_terminal run commands through bash. "
+    "On Windows, run the project inside WSL or install Git for Windows so that "
+    "`bash` (Git Bash) is on PATH."
+)
+
+
+def find_bash() -> Optional[str]:
+    """Locate the bash used to run tool commands, or None when there is none.
+
+    POSIX keeps the historical /bin/bash. Windows has no bash of its own, so
+    the only candidates are a bash.exe on PATH: Git for Windows, MSYS2, or the
+    WSL launcher.
+    """
+    if os.name != "nt" and os.path.exists("/bin/bash"):
+        return "/bin/bash"
+    return shutil.which("bash")
+
+
 def kill_process_tree(pid: int):
     """Kill process and all its children."""
     try:
@@ -150,16 +171,22 @@ async def _run_command(
     ) -> Dict[str, Any]:
         """Run a shell command and return results with proper process management."""
         process = None
+        bash = find_bash()
+        if bash is None:
+            logger.error(BASH_MISSING_ERROR)
+            return {"status": ExecutionStatus.ERROR, "error": BASH_MISSING_ERROR}
         try:
             logger.debug(f'Running command: {command[:100]}...')
-            
-            process = await asyncio.create_subprocess_shell(
-                command,
+
+            # `bash -c` through exec rather than create_subprocess_shell(executable=...):
+            # with shell=True Windows always wraps the command in `cmd.exe /c`, so a
+            # replacement executable would be handed cmd's arguments instead.
+            process = await asyncio.create_subprocess_exec(
+                bash, '-c', command,
                 stdin=asyncio.subprocess.PIPE if stdin else None,
                 stdout=asyncio.subprocess.PIPE,
                 stderr=asyncio.subprocess.PIPE,
                 cwd=cwd,
-                executable='/bin/bash'
             )
             
             # Write stdin if provided
@@ -301,7 +328,10 @@ async def _run_python(
                 }
             else:
                 result = await self._run_command(
-                    f'python3 -I -B -u {shlex.quote(code_file)}',
+                    # The interpreter running this tool, as a forward-slash path so the
+                    # command also parses under Git Bash on Windows.
+                    f'{shlex.quote(Path(sys.executable).as_posix())} -I -B -u '
+                    f'{shlex.quote(Path(code_file).as_posix())}',
                     timeout,
                     stdin,
                     tmp_dir
@@ -630,7 +660,7 @@ async def _run_bash(
             os.chmod(code_file, 0o755)
             
             result = await self._run_command(
-                f'bash {code_file}',
+                f'bash {shlex.quote(Path(code_file).as_posix())}',
                 timeout,
                 stdin,
                 tmp_dir
```

**File**: `chapter4/execution-tools/test_bash_lookup.py` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+"""Regression tests for #1068: the executors must not hard-code /bin/bash.
+
+On native Windows there is no /bin/bash, so every code_interpreter and
+virtual_terminal call used to die with FileNotFoundError. The executor now
+looks bash up (Git Bash / WSL on Windows), reports a clear error when it is
+missing, and runs local Python through the current interpreter instead of a
+`python3` that Windows does not have on PATH.
+"""
+import asyncio
+import sys
+from pathlib import Path
+
+import pytest
+
+import multilang_executor as ml
+from multilang_executor import (
+    BASH_MISSING_ERROR,
+    ExecutionStatus,
+    LanguageExecutor,
+    find_bash,
+)
+
+
+def test_find_bash_posix_prefers_bin_bash(monkeypatch):
+    monkeypatch.setattr(ml.os, "name", "posix")
+    monkeypatch.setattr(ml.os.path, "exists", lambda p: p == "/bin/bash")
+    monkeypatch.setattr(ml.shutil, "which", lambda name: None)
+    assert find_bash() == "/bin/bash"
+
+
+def test_find_bash_windows_uses_bash_on_path(monkeypatch):
+    monkeypatch.setattr(ml.os, "name", "nt")
+    monkeypatch.setattr(
+        ml.shutil, "which",
+        lambda name: r"C:\Program Files\Git\bin\bash.exe" if name == "bash" else None,
+    )
+    assert find_bash() == r"C:\Program Files\Git\bin\bash.exe"
+
+
+def test_find_bash_missing_returns_none(monkeypatch):
+    monkeypatch.setattr(ml.os, "name", "nt")
+    monkeypatch.setattr(ml.shutil, "which", lambda name: None)
+    assert find_bash() is None
+
+
+def test_run_command_reports_missing_bash_instead_of_raising(monkeypatch):
+    monkeypatch.setattr(ml, "find_bash", lambda: None)
+    result = asyncio.run(LanguageExecutor()._run_command("echo hi", timeout=5))
+    assert result["status"] == ExecutionStatus.ERROR
+    assert result["error"] == BASH_MISSING_ERROR
+
+
+def test_local_python_uses_current_interpreter(monkeypatch):
+    captured = {}
+
+    async def fake_run(self, command, timeout, stdin=None, cwd=None, shell=True):
+        captured["command"] = command
+        return {"status": ExecutionStatus.SUCCESS, "returncode": 0,
+                "stdout": "", "stderr": "", "execution_time": 0.0}
+
+    monkeypatch.setattr(ml.shutil, "which", lambda name: None)  # no docker -> local path
+    monkeypatch.setattr(LanguageExecutor, "_run_command", fake_run)
+    asyncio.run(LanguageExecutor()._run_python("print(1)", 5, 5, None, {}))
+    assert Path(sys.executable).as_posix() in captured["command"]
+    assert "python3 -I" not in captured["command"]
+    assert "\\" not in captured["command"]
+
+
+@pytest.mark.skipif(find_bash() is None, reason="needs a bash to run")
+def test_bash_roundtrip_with_real_bash():
+    result = asyncio.run(LanguageExecutor()._run_command("echo ok", timeout=10))
+    assert result["status"] == ExecutionStatus.SUCCESS
+    assert result["stdout"].strip() == "ok"
+
+
+@pytest.mark.skipif(find_bash() is None, reason="needs a bash to run")
+def test_python_roundtrip_with_real_interpreter(monkeypatch):
+    monkeypatch.setattr(ml.shutil, "which", lambda name: find_bash() if name == "bash" else None)
+    result = asyncio.run(LanguageExecutor()._run_python("print(2 + 2)", 10, 10, None, {}))
+    assert result["status"] == ExecutionStatus.SUCCESS, result
+    assert result["stdout"].strip() == "4"
+    assert result["sandbox"]["kind"] == "local-process"
```

---

### Incident Patch 7: `7aacea32` (2026-09-18)
**Commit Message**: fix(ch2): label the cross-request prefix reuse in fig 2-10 as Prompt Cache (#1113)

Section "KV Cache and Prompt Cache: Two Levels of Caching" defines KV Cache
as the in-model mechanism within one inference and Prompt Cache as the
API-layer reuse of the same prefix across requests. Figure 2-10 compares
three separate API requests, yet its title was "KV Cache Prefix Reuse
Mechanism" and the arrows were labelled "KV reuse" / "KV reuse interrupted",
which suggests that KV Cache itself lives across requests.

- fig 2-10 (all 15 editions): title/caption "Prompt Cache: Reusing the Prefix
  KV Cache Across Requests"; arrow labels "Prompt Cache hit: KV reused" and
  "Prompt Cache miss: KV recomputed"; <desc> reworded accordingly. Labels
  use one font size per edition (14 px where it fits, 12 px for ru/tr) and
  sit in the free gap between request rows.
- Markdown captions updated in all 15 chapter 2 files.
- book/chapter2.md and book-en/chapter2.md: one sentence after the prefix
  sensitivity paragraph says the figure shows Prompt Cache-level reuse of
  the prefix's KV Cache, so the two terms are tied together at the figure.

Fixes #1073

Co-authored-by: Bojie Li <i@01.me>
Co-authored-by:

**File**: `book-ar/chapter2.ar.md` (modified, +1/-1)
```diff
@@ -541,7 +541,7 @@ response = call_model(request)
 
 لفهم قيمة KV Cache، فكر أولاً في ما يحدث بدونها. لنفترض أن أحد الوكلاء قد وصل إلى جولة المحادثة السادسة وجمع 2000 رمزًا مميزًا للسياق. بدون التخزين المؤقت، يتطلب كل رمز مميز جديد من النموذج إعادة حساب متجهات K وV للبادئة بأكملها. على الرغم من أن الجولات الخمس الأولى لم تتغير، إلا أن الجولة السادسة لا تزال تعيد حسابها، والبادئة الأطول تجعل هذه الجولة أكثر تكلفة من الأولى. بدون التخزين المؤقت، فإن حساب الانتباه في مرحلة التعبئة المسبقة (المرحلة التي يعالج فيها النموذج جميع الرموز المميزة للإدخال قبل إنشاء استجابة) ينمو بشكل تربيعي مع طول السياق، مما يتسبب في ارتفاع زمن الوصول والتكلفة بسرعة مع تعمق المحادثة. يعد هذا مشكلة بشكل خاص لمهام الوكيل التي تتطلب العديد من استدعاءات الأدوات.
 
-![الشكل 2-10: KV Cache آلية إعادة استخدام البادئة](images/fig2-10.svg)
+![الشكل 2-10: Prompt Cache: إعادة استخدام KV Cache للبادئة عبر الطلبات](images/fig2-10.svg)
 
 **فهم KV Cache بمثال بسيط.** لنفترض أن السياق يحتوي على 4 رموز مميزة [A، B، C، D]، والنموذج على وشك إنشاء الرمز المميز الخامس، E. تعمل عملية الاهتمام الأساسية على النحو التالي: ناقل الاستعلام في هذه الخطوة يأتي من آخر رمز مميز معروف وهو D، ويُقارَن بالمتجهات الرئيسية للرموز الأربعة A وB وC وD لحساب درجات المطابقة (للحصول على شرح بديهي للمنتجات النقطية، راجع التجربة 2-2). ثم يستخدم هذه الدرجات لحساب المجموع المرجح لمتجهات القيمة للرموز الأربعة نفسها، مما يؤدي إلى إنتاج تمثيل المخرجات عند موضع D — وهو بالضبط ما يستخدمه النموذج للتنبؤ بالرمز التالي E. أما متجهات Q وK وV الخاصة بـ E نفسه فلا تُحسب إلا بعد أخذ عينة من E وإعادة إدخاله إلى النموذج.
 
```

**File**: `book-ar/images/fig2-10.svg` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 44 820 443" width="820" height="443" style="background:#ffffff">
-<title>الشكل 2-10: KV Cache آلية إعادة استخدام البادئة</title>
-<desc>تقارن ثلاثة طلبات إعادة استخدام بادئة KV Cache: ينشئ الطلب 1 الذاكرة المؤقتة، ويصيبها الطلب 2 لأن البادئة لم تتغير، بينما يضع الطلب 3 طابعًا زمنيًا ديناميكيًا في بداية موجّه النظام، فتُعاد حساب جميع الرموز بعد نقطة التغيير وتُحتسب تكلفتها من جديد.</desc>
+<title>الشكل 2-10: Prompt Cache: إعادة استخدام KV Cache للبادئة عبر الطلبات</title>
+<desc>تقارن ثلاثة طلبات كيف يعيد Prompt Cache استخدام KV Cache الخاصة بالبادئة عبر الطلبات: ينشئ الطلب 1 الذاكرة المؤقتة، ويصيبها الطلب 2 لأن البادئة لم تتغير، بينما يضع الطلب 3 طابعًا زمنيًا ديناميكيًا في بداية موجّه النظام، فتُعاد حساب جميع الرموز بعد نقطة التغيير وتُحتسب تكلفتها من جديد.</desc>
 <defs><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#999999"/></marker></defs>
 <text x="135.262" y="70" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الطلب 1</text>
 <rect x="40" y="85" width="455" height="40" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -17,10 +17,10 @@
 <rect x="660" y="170" width="120" height="40" rx="6" fill="#e8e8e8" stroke="#333333" stroke-width="2"/>
 <text x="720" y="190" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">→ توليد الاستجابة</text>
 <line x1="267.5" y1="127" x2="267.5" y2="168" stroke="#999999" stroke-width="2" marker-end="url(#ah-light)"/>
-<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="end" dominant-baseline="central" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">إعادة استخدام KV</text>
+<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="end" dominant-baseline="central" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">إصابة Prompt Cache: إعادة استخدام KV</text>
 <line x1="267.5" y1="212" x2="267.5" y2="253" stroke="#999999" stroke-width="2" stroke-dasharray="6,5" marker-end="url(#ah-light)"/>
 <text x="255.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#666666" text-anchor="start" dominant-baseline="central" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">تغيّر موجّه النظام</text>
-<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="end" dominant-baseline="central" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">انقطاع إعادة استخدام KV</text>
+<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="end" dominant-baseline="central" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">إخفاق Prompt Cache: إعادة حساب KV</text>
 <text x="135.262" y="240" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang S
```

**File**: `book-en/chapter2.md` (modified, +2/-2)
```diff
@@ -527,13 +527,13 @@ With Qwen3's Chat Template, for instance, multi-turn tool calls can retain prior
 
 Note that different model families differ greatly in how they handle historical chain-of-thought, and the strategies themselves are evolving rapidly. The official guidance in the DeepSeek R1 era was to **strip all historical reasoning**: in multi-turn conversations, only `content` is passed back, not `reasoning_content`—because historical CoT never appeared in R1's training input, feeding it back is out-of-distribution input that may instead interfere with the output, and it also saves a considerable number of tokens. But this strategy has flaws for Agent scenarios: intermediate reasoning carries critical state such as "why this tool was called and which hypotheses were ruled out"; once stripped, the model reasons from scratch every turn, making it prone to repeating mistakes and losing long-range plans. DeepSeek therefore **completely reversed** the policy in V4: as long as the request carries the `tools` parameter, the `reasoning_content` of every assistant message between two user messages—even one that made no tool call on that turn—must be passed back verbatim, or the API returns a 400 error; plain chat without `tools` still ignores historical reasoning. An Agent always carries `tools`, so there is no escaping this requirement—Kimi K2, GLM-5, and others have adopted the same protocol. Claude, meanwhile, requires the client to pass the thinking block (with signature verification) back to the API unchanged within the tool call loop; after new user input, the server ignores thinking blocks from before the most recent user input. Consult the model's latest documentation before use. Across multi-turn dialogue these differences only decide whether tokens are saved; the moment a half-finished trajectory has to be handed to another vendor's model to complete, they turn into real API errors—see Experiment 5-1 in Chapter 5.
 
-**Second, it explains why KV Cache is so sensitive to the prefix.** The Chat Template converts system messages and tool definitions into a fixed token sequence near the beginning of the input. The key-value states for these tokens can be cached and reused across requests. If a token in this prefix changes—even because of an extra space in the system prompt—the cache from the first differing token onward can no longer be reused.
+**Second, it explains why KV Cache is so sensitive to the prefix.** The Chat Template converts system messages and tool definitions into a fixed token sequence near the beginning of the input. The key-value states for these tokens can be cached and reused across requests. If a token in this prefix changes—even because of an extra space in the system prompt—the cache from the first differing token onward can no longer be reused. Figure 2-10 shows exactly this cross-request prefix reuse: in the terms of "KV Cache and Prompt Cache: Two Levels of Caching" below, it happens at the Prompt Cache level, and what gets reused is the prefix's KV Cache.
 
 ### Principles and Constraints of KV Cache
 
 To understand the value of KV Cache, first consider what happens without it. Suppose an Agent has reached the sixth conversation round and accumulated 2,000 context tokens. Without caching, each new token requires the model to recalculate the K and V vectors for the entire prefix. Although the first five rounds are unchanged, the sixth round still recomputes them, and the longer prefix makes this round more expensive than the first. Without caching, the attention computation in the prefill phase (the stage where the model processes all input tokens before generating a response) grows quadratically with context length, causing latency and cost to rise rapidly as the conversation deepens. This is especially problematic for Agent tasks that require many tool calls.
 
-![Figure 2-10: KV Cache Prefix Reuse Mechanism](images/fig2-10.svg)
+![Figure 2-10: Prompt Cache: Reusing the Prefix KV Cache Across
```

**File**: `book-en/images/fig2-10.svg` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 44 820 443" width="820" height="443" style="background:#ffffff">
-<title>Figure 2-10: KV Cache Prefix Reuse Mechanism</title>
-<desc>Three requests compare KV Cache prefix reuse: Request 1 establishes the cache; Request 2 hits it because the prefix is unchanged; Request 3 puts a dynamic timestamp at the start of the system prompt, so every token after the change point is recomputed and billed again.</desc>
+<title>Figure 2-10: Prompt Cache: Reusing the Prefix KV Cache Across Requests</title>
+<desc>Three requests compare how Prompt Cache reuses the prefix KV Cache across requests: Request 1 establishes the cache; Request 2 hits it because the prefix is unchanged; Request 3 puts a dynamic timestamp at the start of the system prompt, so every token after the change point is recomputed and billed again.</desc>
 <defs><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#999999"/></marker></defs>
 <text x="40" y="70" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="bold">Request 1</text>
 <rect x="40" y="85" width="455" height="40" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -17,10 +17,10 @@
 <rect x="660" y="170" width="120" height="40" rx="6" fill="#e8e8e8" stroke="#333333" stroke-width="2"/>
 <text x="720" y="190" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">→ Generate response</text>
 <line x1="267.5" y1="127" x2="267.5" y2="168" stroke="#999999" stroke-width="2" marker-end="url(#ah-light)"/>
-<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="start" dominant-baseline="central">KV reuse</text>
+<text x="279.5" y="147.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="start" dominant-baseline="central">Prompt Cache hit: KV reused</text>
 <line x1="267.5" y1="212" x2="267.5" y2="253" stroke="#999999" stroke-width="2" stroke-dasharray="6,5" marker-end="url(#ah-light)"/>
 <text x="255.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="end" dominant-baseline="central">System prompt changed</text>
-<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="start" dominant-baseline="central">KV reuse interrupted</text>
+<text x="279.5" y="232.5" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#666666" text-anchor="start" dominant-baseline="central">Prompt Cache miss: KV recomputed</text>
 <text x="40" y="240" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="20" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="bold">Request 3</text>
 <rect x="40" y="255" width="455" height="40" rx="6" fill="#ffffff" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="267.5" y="275" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">"Time: 10:30:45" + System Prompt + Tools (cache miss ✗)</text>
```

**File**: `book-es/chapter2.es.md` (modified, +1/-1)
```diff
@@ -529,7 +529,7 @@ Conviene señalar que las distintas familias de modelos aplican estrategias muy
 
 Para comprender el valor de la Caché KV, veamos primero qué ocurriría sin ella. Supongamos que un Agente se encuentra en el sexto turno de una conversación y que el contexto ya acumula 2000 tokens. Sin caché, cada vez que el modelo genera un token nuevo debe volver a calcular los vectores K y V de esos 2000 tokens, lo que equivale a repetir todo el cálculo hacia delante del prefijo. Aunque el contenido de los cinco primeros turnos no haya cambiado en absoluto, en el sexto turno todavía habría que calcular desde cero todo el prefijo, como en el primero; además, el prefijo sería ahora más largo, por lo que el coste sería muy superior al del primer turno. Sin caché, el volumen de cálculo de atención durante la fase de prefill —es decir, la fase en la que el modelo procesa de una sola vez todos los tokens de entrada antes de comenzar a generar formalmente la respuesta— crece de forma cuadrática con la longitud del contexto. A medida que avanza la conversación, tanto la latencia como el coste aumentan bruscamente. Esto resulta inaceptable para tareas de Agentes que requieren decenas de rondas de llamadas a herramientas.
 
-![Figura 2-10 Mecanismo de reutilización de prefijos de la Caché KV](images/fig2-10.svg)
+![Figura 2-10 Prompt Cache: reutilización de la Caché KV del prefijo entre solicitudes](images/fig2-10.svg)
 
 **Comprendamos la Caché KV con un ejemplo sencillo**. Supongamos que el contexto contiene cuatro tokens [A, B, C, D] y que el modelo está a punto de generar un quinto token, E. La operación fundamental de la atención es la siguiente: el vector de consulta —Query— de este paso procede del último token conocido, D, y se multiplica escalarmente por los vectores de clave —Key— de los cuatro tokens A, B, C y D para determinar el grado de coincidencia —consulte el experimento 2-2 para obtener una explicación intuitiva del producto escalar—. Después, se realiza una suma ponderada de los vectores de valor —Value— de esos mismos cuatro tokens según ese grado de coincidencia, con lo que se obtiene la representación de salida de la posición de D, que es justamente lo que el modelo utiliza para predecir el siguiente token, E. Los vectores Q, K y V del propio E no se calculan hasta que E se ha muestreado y se ha vuelto a introducir en el modelo.
 
```

---

### Incident Patch 8: `3485886f` (2026-09-18)
**Commit Message**: fix(ch1): scope "no client-side ReAct loop" in fig 1-5 to the Responses API path (#1112)

Figure 1-5 and the Experiment 1-2 text claimed the orchestration loop moved
from the client to the server. That holds for the GPT-5.6 Responses API path
(Experiment 1-3), but not for the Kimi K3 path (Experiment 1-2): Formula runs
web_search server-side, while chapter1/web-search-agent/agent.py still drives
the "call model -> append tool result -> call again" loop in a client-side
while loop.

- fig 1-5 (all 15 editions): ReAct box retitled "Responses API path: ...";
  checklist now says the model decides tool calls, tools execute server-side,
  the loop is server-side on the Responses API path, and the client still
  drives the loop on the Kimi path; <desc> carries the same caveat
- book/chapter1.md: the "loop moved to the server" sentence now distinguishes
  the two paths, and the figure lead-in notes which path the checkmark covers
  (the translations' prose only says tools execute server-side, which is
  accurate, so only the figure changes there)

Fixes #1061

Co-authored-by: Bojie Li <i@01.me>
Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `book-ar/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>الشكل 1-5: بنية &quot;النموذج كوكيل&quot; — استدعاء الأداة الأصلية</title>
-<desc>يستدعي النموذج أدوات أصلية مثل web_search و code_interpreter داخل حلقة مغلقة ينفّذها Harness على الخادم. مدخل المستخدم والناتج النهائي خارج هذه الحلقة، وداخلها تتكوّن حلقة ReAct من الفكرة والفعل والملاحظة.</desc>
+<desc>يستدعي النموذج أدوات أصلية مثل web_search و code_interpreter داخل حلقة مغلقة ينفّذها Harness على الخادم. مدخل المستخدم والناتج النهائي خارج هذه الحلقة، وداخلها تتكوّن حلقة ReAct من الفكرة والفعل والملاحظة. عبارة «لا حاجة لكتابة حلقة ReAct في العميل» تصح فقط لمسار Responses API (التجربة 1-3)؛ أما في مسار Kimi K3 (التجربة 1-2) فتُنفَّذ الأدوات على الخادم لكن الحلقة ما زالت تُدار من كود العميل.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14.5" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">البيتكوين في الشهر الماضي</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">حلقة ReAct (تنفيذ مغلق عبر Harness على الخادم)</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">حلقة ReAct (مسار Responses API: تنفيذ مغلق عبر Harness على الخادم)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -55,9 +55,8 @@
 
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="233" y="88" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الاختلافات عن الأطر التقليدية</text>
-<text x="230" y="110.6" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">✓ التنسيق يديره Harness على الخادم</text>
-<text x="230" y="129.3" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">✓ لا حاجة لكتابة حلقة ReAct في</text>
-<text x="230" y="143" font-family="Arial, 'Helve
```

**File**: `book-en/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>Figure 1-5: &quot;Model as Agent&quot; Architecture—Native Tool Calling</title>
-<desc>The LLM calls native tools such as web_search and code_interpreter in a closed loop run by the server-side Harness. User input and final output sit outside that loop; inside it, Thought, Action and Observation form the ReAct cycle.</desc>
+<desc>The LLM calls native tools such as web_search and code_interpreter in a closed loop run by the server-side Harness. User input and final output sit outside that loop; inside it, Thought, Action and Observation form the ReAct cycle. "No hand-written ReAct loop on the client" holds only for the Responses API path (Experiment 1-3); on the Kimi K3 path (Experiment 1-2) the tools run server-side but the loop is still driven by client code.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">trend over the last month</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct loop (closed-loop execution by the server-side Harness)</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct loop (Responses API path: closed-loop execution by the server-side Harness)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -55,9 +55,8 @@
 
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="27" y="88" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">Differences from traditional frameworks</text>
-<text x="30" y="109.4" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Orchestration hosted by the</text>
-<text x="30" y="123.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">server-side Harness</text>
-<text x="30" y="143" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ No hand-written ReAct loop on the</text>
-<text x="30" y="157.3" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">client</text>
-<text x="30" y="176.6" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-
```

**File**: `book-es/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>Figura 1-5 Arquitectura de «el modelo es el Agente»—invocación nativa de herramientas</title>
-<desc>El LLM invoca herramientas nativas como web_search y code_interpreter dentro de un bucle cerrado que ejecuta el Harness del servidor. La entrada del usuario y la salida final quedan fuera de ese bucle; dentro, pensamiento, acción y observación forman el ciclo ReAct.</desc>
+<desc>El LLM invoca herramientas nativas como web_search y code_interpreter dentro de un bucle cerrado que ejecuta el Harness del servidor. La entrada del usuario y la salida final quedan fuera de ese bucle; dentro, pensamiento, acción y observación forman el ciclo ReAct. «El cliente no escribe el bucle ReAct» solo se cumple en la ruta Responses API (experimento 1-3); en la ruta Kimi K3 (experimento 1-2) las herramientas corren en el servidor, pero el bucle sigue dirigido por el código del cliente.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">de Bitcoin del último mes</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">Bucle ReAct (ejecución en bucle cerrado por el Harness del servidor)</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">Bucle ReAct (ruta Responses API: ejecución en bucle cerrado por el Harness del servidor)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -55,9 +55,8 @@
 
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="27" y="88" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">Diferencias con los marcos tradicionales</text>
-<text x="30" y="109.4" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ La orquestación la aloja el Harness</text>
-<text x="30" y="123.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">del servidor</text>
-<text x="30" y="143" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ El cliente no escribe el bucle ReAct</text>
-<text x="30" y="162.3" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ El modelo
```

**File**: `book-he/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>איור 1‑5: ארכיטקטורת &quot;מודל כסוכן&quot; — קריאה מובנית לכלים</title>
-<desc>The LLM calls native tools such as web_search and code_interpreter in a closed loop run by the server-side Harness. User input and final output sit outside that loop; inside it, Thought, Action and Observation form the ReAct cycle.</desc>
+<desc>The LLM calls native tools such as web_search and code_interpreter in a closed loop run by the server-side Harness. User input and final output sit outside that loop; inside it, Thought, Action and Observation form the ReAct cycle. "No hand-written ReAct loop on the client" holds only for the Responses API path (Experiment 1-3); on the Kimi K3 path (Experiment 1-2) the tools run server-side but the loop is still driven by client code.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">trend over the last month</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct loop (closed-loop execution by the server-side Harness)</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct loop (Responses API path: closed-loop execution by the server-side Harness)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -55,9 +55,8 @@
 
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="27" y="88" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">Differences from traditional frameworks</text>
-<text x="30" y="109.4" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Orchestration hosted by the</text>
-<text x="30" y="123.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">server-side Harness</text>
-<text x="30" y="143" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ No hand-written ReAct loop on the</text>
-<text x="30" y="157.3" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">client</text>
-<text x="30" y="176.6" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="1
```

**File**: `book-hu/images/fig1-5.svg` (modified, +6/-7)
```diff
@@ -1,6 +1,6 @@
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 820 530" width="820" height="530" style="background:#ffffff">
 <title>1-5. ábra: &quot;Model as Agent&quot; Architektúra – Natív eszközhívás</title>
-<desc>Az LLM natív eszközöket – például web_search és code_interpreter – hív meg a szerveroldali Harness által futtatott zárt hurokban. A felhasználói bemenet és a végső kimenet a hurkon kívül van; a hurkon belül a gondolat, a cselekvés és a megfigyelés alkotja a ReAct-ciklust.</desc>
+<desc>Az LLM natív eszközöket – például web_search és code_interpreter – hív meg a szerveroldali Harness által futtatott zárt hurokban. A felhasználói bemenet és a végső kimenet a hurkon kívül van; a hurkon belül a gondolat, a cselekvés és a megfigyelés alkotja a ReAct-ciklust. „A kliensnek nem kell ReAct-ciklust írnia” csak a Responses API-útra (1-3. kísérlet) igaz; a Kimi K3-úton (1-2. kísérlet) az eszközök a szerveren futnak, de a ciklust továbbra is a kliens kódja hajtja.</desc>
 <defs><marker id="ah" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#333333"/></marker><marker id="ah-light" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto"><polygon points="0 0, 12 4, 0 8" fill="#999999"/></marker></defs>
 
 <rect x="260" y="70" width="300" height="100" rx="6" fill="#d0d0d0" stroke="#333333" stroke-width="2"/>
@@ -26,7 +26,7 @@
 <text x="140" y="273.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14.5" fill="#333333" text-anchor="middle" dominant-baseline="central" font-weight="normal">keresése az elmúlt hónapban</text>
 
 <rect x="15" y="310" width="790" height="170" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct-ciklus (zárt hurkú végrehajtás a szerveroldali Harnessben)</text>
+<text x="410" y="328" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="16" fill="#666666" text-anchor="middle" dominant-baseline="central" font-weight="bold">ReAct-ciklus (Responses API-út: zárt hurkú végrehajtás a szerveroldali Harnessben)</text>
 
 <line x1="140" y1="292" x2="140" y2="380" stroke="#333333" stroke-width="2" marker-end="url(#ah)"/>
 
@@ -56,9 +56,8 @@
 <rect x="15" y="70" width="230" height="120" rx="8" fill="none" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
 <text x="27" y="80.8" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">Eltérések a hagyományos</text>
 <text x="27" y="95.2" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#666666" text-anchor="start" dominant-baseline="central" font-weight="bold">keretrendszerektől</text>
-<text x="30" y="109.4" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ Az orkesztrációt a szerveroldali</text>
-<text x="30" y="123.7" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">Harness futtatja</text>
-<text x="30" y="143" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#333333" text-anchor="start" dominant-baseline="central" font-weight="normal">✓ A kliensnek nem kell ReAct-ciklust</text>
-<text x="30" y="157.3" font-family="Arial, 
```

---

### Incident Patch 9: `3612c7f1` (2026-09-18)
**Commit Message**: fix(intro): sync fig 0-1 chapter numbers with the current book structure (#1111)

Figure 0-1 (Agent = LLM + Context + Tools) still carried the pre-2.0 chapter
map in every edition: "Ch. 6 Evaluation · Ch. 7 Post-Training" and
"Ch. 8 Self-Evolution · Ch. 9 Multimodal · Ch. 10 Multi-Agent". The book
now has Chapter 6 Interaction, 7 Evaluation, 8 Post-Training, 9 Continual
Evolution and 10 Multi-Agent, as the introduction text and figure 0-2 say.

- LLM detail box: 7 Evaluation · 8 Post-Training
- bottom extension box: 6 Interaction · 9 Continual Evolution · 10 Multi-Agent,
  keywords "Multimodal · Voice · Computer Use · Robotics · Learning from
  Experience · Collaboration"; box widened 390 -> 590 px so every language
  fits on one line (Arabic labels restored to the template 14/13 px after
  being auto-shrunk to 9/12 px)
- applied to all 15 editions; chapter names follow each edition's own
  chapter titles
- book-zhtw: the figure was still in simplified Chinese, converted to
  traditional at the same time

Fixes #1079

Co-authored-by: Bojie Li <i@01.me>
Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `book-ar/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -30,7 +30,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#555555" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الفصل. 6 التقييم · الفصل. 7 ما بعد التدريب</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#555555" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الفصل. 7 التقييم · الفصل. 8 ما بعد التدريب</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#888888" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">النموذج كوكيل · SFT · التعلم المعزز</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#888888" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">يتم التقييم خلال العملية برمتها</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -50,9 +50,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="9" fill="#333333" text-anchor="middle" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الفصل. 8 التطور الذاتي · الفصل. 9 الوسائط المتعددة · الفصل. 10 متعدد الوكيل</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">نماذج التعلم · إنشاء الأدوات · الصوت · الروبوتات · التعاون</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="14" fill="#333333" text-anchor="middle" font-weight="bold" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الفصل. 6 التفاعل · الفصل. 9 التطور المستمر · الفصل. 10 متعدد الوكيل</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#666666" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" style="font-family:'Noto Sans Arabic','Noto Sans',Arial,sans-serif">الوسائط المتعددة · الصوت · Computer Use · الروبوتات · التعلم من التجربة · التعاون</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
\ No newline at end of file
```

**File**: `book-en/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -30,7 +30,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">Ch. 6 Evaluation · Ch. 7 Post-Training</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">Ch. 7 Evaluation · Ch. 8 Post-Training</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#888888" text-anchor="middle">Model as Agent · SFT · Reinforcement Learning</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#888888" text-anchor="middle">Evaluation Runs Through the Entire Process</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -50,9 +50,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">Ch. 8 Self-Evolution · Ch. 9 Multimodal · Ch. 10 Multi-Agent</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">Learning Paradigms · Tool Creation · Voice · Robotics · Collaboration</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">Ch. 6 Interaction · Ch. 9 Continual Evolution · Ch. 10 Multi-Agent</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">Multimodal · Voice · Computer Use · Robotics · Learning from Experience · Collaboration</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
\ No newline at end of file
```

**File**: `book-es/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -32,7 +32,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#555555" text-anchor="middle">Cap. 6 Evaluación · Cap. 7 Posentrenamiento</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11" fill="#555555" text-anchor="middle">Cap. 7 Evaluación · Cap. 8 Posentrenamiento</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="9.5" fill="#888888" text-anchor="middle">Modelo como Agent · SFT · Aprendizaje por refuerzo</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#888888" text-anchor="middle">Evaluación de extremo a extremo</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -52,9 +52,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="middle" font-weight="bold">Cap. 8 Autoevolución · Cap. 9 Multimodalidad · Cap. 10 Multiagente</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="9.5" fill="#666666" text-anchor="middle">Paradigmas de aprendizaje · Creación de herramientas · Voz · Robótica · Colaboración</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#333333" text-anchor="middle" font-weight="bold">Cap. 6 Interacción · Cap. 9 Evolución continua · Cap. 10 Multiagente</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="9.5" fill="#666666" text-anchor="middle">Multimodalidad · Voz · Computer Use · Robótica · Aprendizaje por experiencia · Colaboración</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
```

**File**: `book-he/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -30,7 +30,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">Ch. 6 Evaluation · Ch. 7 Post-Training</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">Ch. 7 Evaluation · Ch. 8 Post-Training</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10.5" fill="#888888" text-anchor="middle">Model as Agent · SFT · Reinforcement Learning</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#888888" text-anchor="middle">Evaluation Runs Through the Entire Process</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -50,9 +50,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">Ch. 8 Self-Evolution · Ch. 9 Multimodal · Ch. 10 Multi-Agent</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">Learning Paradigms · Tool Creation · Voice · Robotics · Collaboration</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">Ch. 6 Interaction · Ch. 9 Continual Evolution · Ch. 10 Multi-Agent</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="12" fill="#666666" text-anchor="middle">Multimodal · Voice · Computer Use · Robotics · Learning from Experience · Collaboration</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
\ No newline at end of file
```

**File**: `book-hu/images/fig0-1.svg` (modified, +4/-4)
```diff
@@ -30,7 +30,7 @@
 
 <!-- Details under LLM -->
 <rect x="30" y="62" width="240" height="72" rx="6" fill="#f5f5f5" stroke="#999999" stroke-width="1.5" stroke-dasharray="6,3"/>
-<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">6. fej. Kiértékelés · 7. fej. Utótréning</text>
+<text x="150" y="82" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13" fill="#555555" text-anchor="middle">7. fej. Kiértékelés · 8. fej. Utótréning</text>
 <text x="150" y="102" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="10" fill="#888888" text-anchor="middle">modell mint ágens · SFT · megerősítéses tanulás</text>
 <text x="150" y="122" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#888888" text-anchor="middle">A kiértékelés a teljes folyamatot áthatja</text>
 <line x1="270" y1="98" x2="293" y2="98" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
@@ -50,9 +50,9 @@
 <line x1="610" y1="266" x2="610" y2="293" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 <!-- Applications at bottom -->
-<rect x="195" y="400" width="390" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
-<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">8. fej. Önfejlődés · 9. fej. Multimodális · 10. fej. Többágens</text>
-<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#666666" text-anchor="middle">tanulási paradigmák · eszközkészítés · hang · robotika · együttműködés</text>
+<rect x="95" y="400" width="590" height="60" rx="8" fill="#f0f0f0" stroke="#333333" stroke-width="2" stroke-dasharray="8,4"/>
+<text x="390" y="422" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="13.5" fill="#333333" text-anchor="middle" font-weight="bold">6. fej. Interakció · 9. fej. Folyamatos evolúció · 10. fej. Többágens</text>
+<text x="390" y="446" font-family="Arial, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="11.5" fill="#666666" text-anchor="middle">multimodalitás · hang · Computer Use · robotika · tapasztalati tanulás · együttműködés</text>
 <line x1="390" y1="298" x2="390" y2="398" stroke="#999999" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#ah-light)"/>
 
 </svg>
\ No newline at end of file
```

---

### Incident Patch 10: `766b29fb` (2026-09-18)
**Commit Message**: Fix agent-loop animation and responsive connectors (#1085)

* Add Astro homepage and chapter one reading prototype

* Add browser-saved highlights and notes to the Astro reader

* Add Chinese editions to the Astro book prototype

* Add homepage and reader screenshots for prototype review

* Improve reading continuity, mobile controls, and diagram viewing

* Expand prototype to all 15 editions and fix diagram label overflow

Render the homepage and Chapter 1 from all maintained source editions, with
localized interfaces, edition-specific routes, and RTL reading layouts.

Reflow the Agent-Environment interaction diagram (Figure 1-1) because its
fixed text boxes overflowed in English and 10 other editions. Generate a
taller web-only SVG with wrapping labels, retaining all 18 source labels
and the original interaction semantics. Preserve the tracked source SVGs
and Markdown so the Mandarin source, MkDocs, and PDF pipeline are unchanged;
the other six figures per edition remain byte-identical copies.

Expand the mobile chapter outline by default and remember the reader's
choice. Add syntax highlighting for the API and trajectory pseudocode,
including comments and numbers, without changi

**File**: `web-astro/src/components/AgentArchitecture.astro` (modified, +165/-81)
```diff
@@ -3,10 +3,6 @@ import { editions, translator, type Locale } from '../lib/i18n';
 const { locale = 'en' } = Astro.props as { locale?: Locale };
 const t = translator(locale);
 const stages = [
-  {
-    label: t('Observe'),
-    detail: t('Observations update the context available to the model.'),
-  },
   {
     label: t('Reason'),
     detail: t('The model uses that context to choose its next action.'),
@@ -17,6 +13,10 @@ const stages = [
       'Tools act on the environment; the results become new observations.',
     ),
   },
+  {
+    label: t('Observe'),
+    detail: t('Observations update the context available to the model.'),
+  },
 ];
 ---
 
@@ -39,34 +39,21 @@ const stages = [
     )}
   >
     <svg class="circuit" viewBox="0 0 640 460" fill="none" aria-hidden="true">
-      <defs>
-        <marker
-          id="flow-arrow"
-          viewBox="0 0 10 10"
-          refX="8"
-          refY="5"
-          markerWidth="5"
-          markerHeight="5"
-          orient="auto"
-          ><path d="m2 1 6 4-6 4" stroke="currentColor" stroke-width="1.5"
-          ></path></marker
-        >
-      </defs>
-      <g class="circuit-paths" marker-end="url(#flow-arrow)">
-        <path data-route="observe" d="M275 382H116Q80 382 80 346V218"></path>
+      <g class="circuit-paths">
+        <path data-route="observe" d="M174 382H116Q80 382 80 346V252"></path>
         <path data-route="reason" d="M147 180H241"></path>
         <path data-route="select" d="M399 180H493"></path>
-        <path data-route="execute" d="M560 218V346Q560 382 524 382H365"></path>
+        <path data-route="execute" d="M560 252V346Q560 382 524 382H466"></path>
       </g>
       <g class="energy-paths" aria-hidden="true">
-        <path data-energy="0" pathLength="1" d="M275 382H116Q80 382 80 346V218"
+        <path data-energy="0" pathLength="1" d="M174 382H116Q80 382 80 346V252"
         ></path>
         <path data-energy="1" pathLength="1" d="M147 180H241"></path>
         <path data-energy="2" pathLength="1" d="M399 180H493"></path>
         <path
           data-energy="3"
           pathLength="1"
-          d="M560 218V346Q560 382 524 382H365"></path>
+          d="M560 252V346Q560 382 524 382H466"></path>
       </g>
       <g class="packet-stream" opacity="0" aria-hidden="true">
         {
@@ -78,6 +65,12 @@ const stages = [
           ))
         }
       </g>
+      <g class="flow-arrowheads" aria-hidden="true">
+        <path data-arrowhead="0" d="m76 258 4-6 4 6"></path>
+        <path data-arrowhead="1" d="m235 176 6 4-6 4"></path>
+        <path data-arrowhead="2" d="m487 176 6 4-6 4"></path>
+        <path data-arrowhead="3" d="m472 378-6 4 6 4"></path>
+      </g>
       <g class="processing-waves" aria-hidden="true">
         <circle data-wave="0" cx="320" cy="180" r="88"></circle>
         <circle data-wave="1" cx="320" cy="180" r="88"></circle>
@@ -216,14 +209,24 @@ const stages = [
     const routes = ['observe', 'reason', 'select', 'execute'].map((name) =>
       panel.querySelector<SVGPathElement>(`[data-route="${name}"]`)!,
     );
-    const lengths = routes.map((path) => path.getTotalLength());
+    let lengths = routes.map((path) => path.getTotalLength());
+    const scene = panel.querySelector<HTMLElement>('.agent-scene')!;
+    const circuit = panel.querySelector<SVGSVGElement>('.circuit')!;
+    const core = panel.querySelector<HTMLElement>('.model-core')!;
+    const context = panel.querySelector<HTMLElement>('.context-node')!;
+    const tools = panel.querySelector<HTMLElement>('.tools-node')!;
+    const environment = panel.querySelector<HTMLElement>('.environment-label')!;
+    let coreRadius = 80;
     const packetStream = panel.querySelector<SVGGElement>('.packet-stream')!;
     const packets = [
       ...panel.querySelectorAll<SVGCircleElement>('[data-packet]'),
     ];
     const energyPaths = [
       ...panel.querySelectorAll<SVGPathElement>('[data-energy]'),
     ];
+    const arrowheads = [
+      ...panel.
```

**File**: `web-astro/src/components/Header.astro` (modified, +86/-84)
```diff
@@ -18,93 +18,95 @@ const edition = editions[locale];
 ---
 
 <header class:list={['site-header', { 'reader-header': reader }]}>
-  <a
-    class="brand"
-    dir="ltr"
-    href={edition.home}
-    aria-label={t('AI Agents in Depth')}
-    ><span class="brand-mark" aria-hidden="true">a<span>i</span></span><span
-      >AI Agents<span class="brand-secondary">in Depth</span></span
-    ></a
-  >
-  <nav class="header-nav" aria-label={t('Main navigation')}>
-    <a href={`${edition.home}#contents`}>{t('The book')}</a>
-    <a class="desktop-link" href={`${repo}/tree/main/chapter${chapterNumber}`}
-      >{t('Experiments')} <Icon name="external" size={15} /></a
+  <div class="site-header-inner">
+    <a
+      class="brand"
+      dir="ltr"
+      href={edition.home}
+      aria-label={t('AI Agents in Depth')}
+      ><span class="brand-mark" aria-hidden="true">a<span>i</span></span><span
+        >AI Agents<span class="brand-secondary">in Depth</span></span
+      ></a
     >
-    <a href={repo}>GitHub <Icon name="external" size={15} /></a>
-  </nav>
-  <div class="header-tools">
-    <details class="language-picker">
-      <summary aria-label={t('Language')} title={edition.name}
-        ><span aria-hidden="true">◎</span>
-        <span class="current-language">{edition.name}</span>
-        <span aria-hidden="true">⌄</span></summary
+    <nav class="header-nav" aria-label={t('Main navigation')}>
+      <a href={`${edition.home}#contents`}>{t('The book')}</a>
+      <a class="desktop-link" href={`${repo}/tree/main/chapter${chapterNumber}`}
+        >{t('Experiments')} <Icon name="external" size={15} /></a
       >
-      <nav aria-label={t('Language')}>
-        {
-          locales.map((language) => (
-            <a
-              href={
-                reader
-                  ? withBase(
-                      `/${editions[language].directory}/chapter${chapterNumber}${editions[language].suffix}/`,
-                    )
-                  : editions[language].home
-              }
-              lang={language}
-              hreflang={language}
-              dir={editions[language].dir}
-              aria-current={language === locale ? 'page' : undefined}
+      <a href={repo}>GitHub <Icon name="external" size={15} /></a>
+    </nav>
+    <div class="header-tools">
+      <details class="language-picker">
+        <summary aria-label={t('Language')} title={edition.name}
+          ><span aria-hidden="true">◎</span>
+          <span class="current-language">{edition.name}</span>
+          <span aria-hidden="true">⌄</span></summary
+        >
+        <nav aria-label={t('Language')}>
+          {
+            locales.map((language) => (
+              <a
+                href={
+                  reader
+                    ? withBase(
+                        `/${editions[language].directory}/chapter${chapterNumber}${editions[language].suffix}/`,
+                      )
+                    : editions[language].home
+                }
+                lang={language}
+                hreflang={language}
+                dir={editions[language].dir}
+                aria-current={language === locale ? 'page' : undefined}
+              >
+                {editions[language].name}
+                <span aria-hidden="true">{language === locale ? '✓' : ''}</span>
+              </a>
+            ))
+          }
+          <div class="machine-language-heading" dir="auto">
+            机器翻译 / Machine translation<br /><small
+              >未经审核 / Not vetted</small
             >
-              {editions[language].name}
-              <span aria-hidden="true">{language === locale ? '✓' : ''}</span>
-            </a>
-          ))
-        }
-        <div class="machine-language-heading" dir="auto">
-          机器翻译 / Machine translation<br /><small
-            >未经审核 / Not vetted</small
+          </div>
+          {
+            machineTranslation.languages.map((language) => (
+              <a
+                data-machine
```

**File**: `web-astro/src/styles/global.css` (modified, +10/-9)
```diff
@@ -118,13 +118,17 @@ img {
 }
 .site-header {
   height: 92px;
+  border-bottom: 1px solid var(--line);
+}
+.site-header-inner {
+  width: 100%;
+  height: 100%;
   max-width: 1600px;
-  margin: auto;
+  margin-inline: auto;
   display: flex;
   align-items: center;
   gap: 3rem;
   padding: 0 48px;
-  border-bottom: 1px solid var(--line);
 }
 .brand {
   display: flex;
@@ -463,16 +467,11 @@ img {
   font-weight: 750;
   color: var(--ink);
 }
-@media (min-width: 1600px) {
-  .site-header {
-    border-inline: 1px solid var(--line);
-  }
-}
 @media (max-width: 1100px) {
   .page-width {
     padding-inline: 36px;
   }
-  .site-header {
+  .site-header-inner {
     padding-inline: 30px;
     gap: 20px;
   }
@@ -498,6 +497,8 @@ img {
 @media (max-width: 760px) {
   .site-header {
     height: 76px;
+  }
+  .site-header-inner {
     padding-inline: 20px;
   }
   .brand {
@@ -604,7 +605,7 @@ img {
   .header-nav a:first-child {
     display: none;
   }
-  .site-header {
+  .site-header-inner {
     gap: 10px;
   }
   .hero-actions {
```

#### Recent Merged Pull Requests:
- **PR #1152** (2026-09-23): docs(i18n): sync #1151 ch2 preserved-thinking additions to all translations (@bojieli)
- **PR #1151** (2026-09-23): docs(ch2): 补充 Claude preserved thinking——前缀改动会让历史 thinking 失效 (@bojieli)
- **PR #1149** (2026-09-23): feat(site): number chapters in the reader rail (@Dada-liu)
- **PR #1146** (2026-09-23): ci: install httpx and MkDocs for offline test jobs (@bojieli)
- **PR #1145** (2026-09-22): docs: 保留完整内容，重写中文实验 README 的教学流程 (@bojieli)
- **PR #1144** (2026-09-22): Revert truncated experiment READMEs and restore full content (@bojieli)
- **PR #1143** (2026-09-22): docs: 将全部中文实验 README 改写为教学教程 (@bojieli)
- **PR #1142** (2026-09-22): docs(ch1): clarify the first experiment walkthroughs (@bojieli)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
