# Forensic Learning Record (Deep Inspection): crewAIInc/crewAI

> **Canonical Artifact**: `07_PROJECT_LEARNING/crewaiinc-crewai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crewAIInc/crewAI](https://github.com/crewAIInc/crewAI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:51:00.790Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crewAIInc/crewAI`
- **Description**: Framework for orchestrating role-playing, autonomous AI agents. By fostering collaborative intelligence, CrewAI empowers agents to work together seamlessly, tackling complex tasks.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 59379 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lib/cli/src/crewai_cli/authentication/utils.py`
```
"""Re-export of ``validate_jwt_token`` from ``crewai_core.auth.utils``."""

from __future__ import annotations

from crewai_core.auth.utils import validate_jwt_token as validate_jwt_token


__all__ = ["validate_jwt_token"]

```

### Core Architecture Module: `lib/cli/src/crewai_cli/utils.py`
```
from __future__ import annotations

from collections.abc import Mapping
import os
from pathlib import Path
import re
import shutil
from typing import Any, Literal

import click
from crewai_core.project import (
    get_or_create_project_id as get_or_create_project_id,
    get_project_description as get_project_description,
    get_project_id as get_project_id,
    get_project_name as get_project_name,
    get_project_version as get_project_version,
    parse_toml as parse_toml,
    read_toml as read_toml,
)
from crewai_core.tool_credentials import (
    build_env_with_all_tool_credentials as build_env_with_all_tool_credentials,
    build_env_with_tool_repository_credentials as build_env_with_tool_repository_credentials,
)
from rich.console import Console

from crewai_cli.version import get_crewai_tools_dependency


__all__ = [
    "build_env_with_all_tool_credentials",
    "build_env_with_tool_repository_credentials",
    "copy_assistant_imports",
    "copy_assistant_instructions",
    "copy_template",
    "enable_prompt_line_editing",
    "fetch_and_json_env_file",
    "get_or_create_project_id",
    "get_project_description",
    "get_project_id",
    "get_project_name",
    "get_project_version",
    "is_dmn_mode_enabled",
    "load_env_vars",
    "normalize_package_name",
    "parse_toml",
    "read_toml",
    "render_template",
    "tree_copy",
    "tree_find_and_replace",
    "warn_deprecated",
    "write_env_file",
]


def warn_deprecated(
    *,
    kind: Literal["command", "flag"],
    old: str,
    new: str,
) -> None:
    """Print a yellow deprecation warning for a legacy CLI command or flag."""
    label = "command" if kind == "command" else "flag"
    click.secho(
        f"Warning: The {label} '{old}' is deprecated. Use '{new}' instead.",
        fg="yellow",
    )


console = Console()
_TEMPLATE_TOKEN_RE = re.compile(r"{{([a-zA-Z_][a-zA-Z0-9_]*)}}")


def normalize_package_name(project_name: str) -> str:
    """Normalize a project name into its scaffolded Python package name."""
    folder = project_name.replace(" ", "_").replace("-", "_").lower()
    return re.sub(r"[^a-zA-Z0-9_]", "", folder)


def is_dmn_mode_enabled() -> bool:
    """Return True when the enterprise non-interactive mode is enabled."""
    value = os.environ.get("CREWAI_DMN")
    if value is None:
        return False
    return value.strip().lower() not in {"", "0", "false", "no", "off"}


def enable_prompt_line_editing() -> None:
    """Enable cursor movement/history editing for Click text prompts when available."""
    try:
        import readline
    except ImportError:
        return

    try:
        readline.parse_and_bind("set editing-mode emacs")
    except Exception:  # pragma: no cover - readline backends vary by platform
        return


_TEMPLATES_DIR = Path(__file__).parent / "templates"


def copy_assistant_imports(destination: Path) -> None:
    """Copy assistant instruction files that import ``AGENTS.md``."""
    for name in ("CLAUDE.md", "CURSOR.md", "GEMINI.md"):
        shutil.copy2(_TEMPLATES_DIR / name, destination / name)


def copy_assistant_instructions(destination: Path) -> None:
    """Copy ``AGENTS.md`` and the files that import it into a project."""
    shutil.copy2(_TEMPLATES_DIR / "AGENTS.md", destination / "AGENTS.md")
    copy_assistant_imports(destination)


def copy_template(
    src: Path, dst: Path, name: str, class_name: str, folder_name: str
) -> None:
    """Copy a file from src to dst."""
    content = render_template(
        src,
        {
            "name": name,
            "crew_name": class_name,
            "folder_name": folder_name,
            "crewai_tools_dependency": get_crewai_tools_dependency(),
        },
    )

    with open(dst, "w") as file:
        file.write(content)

    click.secho(f"  - Created {dst}", fg="green")


def render_template(src: Path, replacements: Mapping[str, str]) -> str:
    """Render a template file using ``{{placeholder}}`` replacements."""
    content = src.read_text(encoding="utf-8")
    return _TEMPLATE_TOKEN_RE.sub(
        lambda match: replacements.get(match.group(1), match.group(0)),
        content,
    )


def fetch_and_json_env_file(env_file_path: str = ".env") -> dict[str, Any]:
    """Fetch the environment variables from a .env file and return them as a dictionary."""
    try:
        with open(env_file_path, "r") as f:
            env_content = f.read()

        env_dict = {}
        for line in env_content.splitlines():
            if line.strip() and not line.strip().startswith("#"):
                key, value = line.split("=", 1)
                env_dict[key.strip()] = value.strip()

        return env_dict

    except FileNotFoundError:
        console.print(f"Error: {env_file_path} not found.", style="bold red")
    except Exception as e:
        console.print(f"Error reading the .env file: {e}", style="bold red")

    return {}


def tree_copy(source: Path, destination: Path) -> None:
    """Copies the entire directory structure from the source to the destination."""
    for item in os.listdir(source):
        source_item = os.path.join(source, item)
        destination_item = os.path.join(destination, item)
        if os.path.isdir(source_item):
            shutil.copytree(source_item, destination_item)
        else:
            shutil.copy2(source_item, destination_item)


def tree_find_and_replace(directory: Path, find: str, replace: str) -> None:
    """Recursively searches through a directory, replacing a target string in
    both file contents and filenames with a specified replacement string.
    """
    for path, dirs, files in os.walk(os.path.abspath(directory), topdown=False):
        for filename in files:
            filepath = os.path.join(path, filename)

            with open(filepath, "r", encoding="utf-8", errors="ignore") as file:
                contents = file.read()
            with open(filepath, "w") as file:
                file.write(contents.replace(find, replace))

            if find in filename:
                new_filename = filename.replace(find, replace)
                new_filepath = os.path.join(path, new_filename)
                os.rename(filepath, new_filepath)

        for dirname in dirs:
            if find in dirname:
                new_dirname = dirname.replace(find, replace)
                new_dirpath = os.path.join(path, new_dirname)
                old_dirpath = os.path.join(path, dirname)
                os.rename(old_dirpath, new_dirpath)


def load_env_vars(folder_path: Path) -> dict[str, Any]:
    """Loads environment variables from a .env file in the specified folder path."""
    env_file_path = folder_path / ".env"
    env_vars = {}
    if env_file_path.exists():
        with open(env_file_path, "r") as file:
            for line in file:
                key, _, value = line.strip().partition("=")
                if key and value:
                    env_vars[key] = value
    return env_vars


def write_env_file(folder_path: Path, env_vars: dict[str, Any]) -> None:
    """Writes environment variables to a .env file in the specified folder."""
    env_file_path = folder_path / ".env"
    with open(env_file_path, "w") as file:
        for key, value in env_vars.items():
            file.write(f"{key.upper()}={value}\n")

```

### Core Architecture Module: `lib/crewai-core/src/crewai_core/__init__.py`
```
__version__ = "1.15.23"

```

### Core Architecture Module: `lib/crewai-core/src/crewai_core/auth/__init__.py`
```
"""OAuth2 authentication primitives — shared by crewai and crewai-cli."""

from __future__ import annotations

from crewai_core.auth.oauth2 import (
    AuthenticationCommand as AuthenticationCommand,
    Oauth2Settings as Oauth2Settings,
    ProviderFactory as ProviderFactory,
)
from crewai_core.auth.token import (
    AuthError as AuthError,
    get_auth_token as get_auth_token,
)
from crewai_core.auth.utils import validate_jwt_token as validate_jwt_token


__all__ = [
    "AuthError",
    "AuthenticationCommand",
    "Oauth2Settings",
    "ProviderFactory",
    "get_auth_token",
    "validate_jwt_token",
]

```

### Core Architecture Module: `lib/crewai-core/src/crewai_core/auth/constants.py`
```
"""Authentication constants."""

from __future__ import annotations

from typing import Final


ALGORITHMS: Final[list[str]] = ["RS256"]

```

### Core Architecture Module: `lib/crewai-core/src/crewai_core/auth/oauth2.py`
```
"""OAuth2 device-flow authentication for the CrewAI platform."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any, TypeVar, cast
import webbrowser

import httpx
from pydantic import BaseModel, Field
from rich.console import Console

from crewai_core.auth.utils import validate_jwt_token
from crewai_core.settings import Settings
from crewai_core.token_manager import TokenManager


console = Console()

TOauth2Settings = TypeVar("TOauth2Settings", bound="Oauth2Settings")


class Oauth2Settings(BaseModel):
    """OAuth2 provider configuration."""

    provider: str = Field(
        description="OAuth2 provider used for authentication (e.g., workos, okta, auth0)."
    )
    client_id: str = Field(
        description="OAuth2 client ID issued by the provider, used during authentication requests."
    )
    domain: str = Field(
        description="OAuth2 provider's domain (e.g., your-org.auth0.com) used for issuing tokens."
    )
    audience: str | None = Field(
        description="OAuth2 audience value, typically used to identify the target API or resource.",
        default=None,
    )
    extra: dict[str, Any] = Field(
        description="Extra configuration for the OAuth2 provider.",
        default={},
    )

    @classmethod
    def from_settings(cls: type[TOauth2Settings]) -> TOauth2Settings:
        """Build an ``Oauth2Settings`` instance from the persisted CrewAI settings."""
        settings = Settings()

        return cls(
            provider=settings.oauth2_provider,
            domain=settings.oauth2_domain,
            client_id=settings.oauth2_client_id,
            audience=settings.oauth2_audience,
            extra=settings.oauth2_extra,
        )


if TYPE_CHECKING:
    from crewai_core.auth.providers.base_provider import BaseProvider


class ProviderFactory:
    """Factory for resolving the configured OAuth2 provider."""

    @classmethod
    def from_settings(
        cls: type["ProviderFactory"],  # noqa: UP037
        settings: Oauth2Settings | None = None,
    ) -> "BaseProvider":  # noqa: UP037
        """Create a provider instance from settings, importing the module dynamically."""
        settings = settings or Oauth2Settings.from_settings()

        import importlib

        module = importlib.import_module(
            f"crewai_core.auth.providers.{settings.provider.lower()}"
        )
        provider = getattr(
            module,
            f"{''.join(word.capitalize() for word in settings.provider.split('_'))}Provider",
        )

        return cast("BaseProvider", provider(settings))


class AuthenticationCommand:
    """Drives the OAuth2 device-flow login against the configured provider."""

    def __init__(self) -> None:
        self.token_manager = TokenManager()
        self.oauth2_provider = ProviderFactory.from_settings()

    def login(self) -> None:
        """Sign in to the CrewAI platform via the OAuth2 device flow."""
        console.print("Signing in to CrewAI AMP...\n", style="bold blue")

        device_code_data = self._get_device_code()
        self._display_auth_instructions(device_code_data)

        return self._poll_for_token(device_code_data)

    def _get_device_code(self) -> dict[str, Any]:
        """Request a device code from the provider."""
        device_code_payload = {
            "client_id": self.oauth2_provider.get_client_id(),
            "scope": " ".join(self.oauth2_provider.get_oauth_scopes()),
            "audience": self.oauth2_provider.get_audience(),
        }
        response = httpx.post(
            url=self.oauth2_provider.get_authorize_url(),
            data=device_code_payload,
            timeout=20,
        )
        response.raise_for_status()
        return cast(dict[str, Any], response.json())

    def _display_auth_instructions(self, device_code_data: dict[str, str]) -> None:
        """Print and open the verification URL the user must visit."""
        verification_uri = device_code_data.get(
            "verification_uri_complete", device_code_data.get("verification_uri", "")
        )

        console.print("1. Navigate to: ", verification_uri)
        console.print("2. Enter the following code: ", device_code_data["user_code"])
        webbrowser.open(verification_uri)

    def _poll_for_token(self, device_code_data: dict[str, Any]) -> None:
        """Poll the token endpoint until authentication completes or times out."""
        token_payload = {
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            "device_code": device_code_data["device_code"],
            "client_id": self.oauth2_provider.get_client_id(),
        }

        console.print("\nWaiting for authentication... ", style="bold blue", end="")

        attempts = 0
        while True and attempts < 10:
            response = httpx.post(
                self.oauth2_provider.get_token_url(), data=token_payload, timeout=30
            )
            token_data = response.json()

            if response.status_code == 200:
                self._validate_and_save_token(token_data)

                console.print(
                    "Success!",
                    style="bold green",
                )

                self._post_login()

                console.print("\n[bold green]Welcome to CrewAI AMP![/bold green]\n")
                return

            if token_data["error"] not in ("authorization_pending", "slow_down"):
                raise httpx.HTTPError(
                    token_data.get("error_description") or token_data.get("error")
                )

            time.sleep(device_code_data["interval"])
            attempts += 1

        console.print(
            "Timeout: Failed to get the token. Please try again.", style="bold red"
        )

    def _validate_and_save_token(self, token_data: dict[str, Any]) -> None:
        """Validate the JWT and persist it via the token manager."""
        jwt_token = token_data["access_token"]
        issuer = self.oauth2_provider.get_issuer()
        jwt_token_data = {
            "jwt_token": jwt_token,
            "jwks_url": self.oauth2_provider.get_jwks_url(),
            "issuer": issuer,
            "audience": self.oauth2_provider.get_audience(),
        }

        decoded_token = validate_jwt_token(**jwt_token_data)

        expires_at = decoded_token.get("exp", 0)
        self.token_manager.save_tokens(jwt_token, expires_at)

    def _post_login(self) -> None:
        """Hook called after a successful login. Override to extend behavior."""

```

### Core Architecture Module: `lib/crewai-core/src/crewai_core/auth/providers/__init__.py`
```
"""OAuth2 authentication providers."""

```

### Core Architecture Module: `lib/crewai-core/src/crewai_core/auth/providers/auth0.py`
```
"""Auth0 OAuth2 provider."""

from __future__ import annotations

from crewai_core.auth.providers.base_provider import BaseProvider


class Auth0Provider(BaseProvider):
    """Auth0 OAuth2 provider implementation."""

    def get_authorize_url(self) -> str:
        return f"https://{self._get_domain()}/oauth/device/code"

    def get_token_url(self) -> str:
        return f"https://{self._get_domain()}/oauth/token"

    def get_jwks_url(self) -> str:
        return f"https://{self._get_domain()}/.well-known/jwks.json"

    def get_issuer(self) -> str:
        return f"https://{self._get_domain()}/"

    def get_audience(self) -> str:
        if self.settings.audience is None:
            raise ValueError(
                "Audience is required. Please set it in the configuration."
            )
        return self.settings.audience

    def get_client_id(self) -> str:
        if self.settings.client_id is None:
            raise ValueError(
                "Client ID is required. Please set it in the configuration."
            )
        return self.settings.client_id

    def _get_domain(self) -> str:
        if self.settings.domain is None:
            raise ValueError("Domain is required. Please set it in the configuration.")
        return self.settings.domain

```

### Core Architecture Module: `lib/crewai-core/src/crewai_core/auth/providers/base_provider.py`
```
"""Base OAuth2 provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod

from crewai_core.auth.oauth2 import Oauth2Settings


class BaseProvider(ABC):
    """Abstract base class for OAuth2 providers."""

    def __init__(self, settings: Oauth2Settings):
        self.settings = settings

    @abstractmethod
    def get_authorize_url(self) -> str:
        """Return the authorization endpoint URL."""

    @abstractmethod
    def get_token_url(self) -> str:
        """Return the token endpoint URL."""

    @abstractmethod
    def get_jwks_url(self) -> str:
        """Return the JWKS endpoint URL."""

    @abstractmethod
    def get_issuer(self) -> str:
        """Return the OAuth issuer identifier."""

    @abstractmethod
    def get_audience(self) -> str:
        """Return the OAuth audience identifier."""

    @abstractmethod
    def get_client_id(self) -> str:
        """Return the OAuth client identifier."""

    def get_required_fields(self) -> list[str]:
        """Return provider-specific keys required inside ``Oauth2Settings.extra``."""
        return []

    def get_oauth_scopes(self) -> list[str]:
        """Return the OAuth scopes to request."""
        return ["openid", "profile", "email"]

```

### Core Architecture Module: `lib/crewai-core/src/crewai_core/auth/providers/entra_id.py`
```
"""Entra ID (Azure AD) OAuth2 provider."""

from __future__ import annotations

from typing import cast

from crewai_core.auth.providers.base_provider import BaseProvider


class EntraIdProvider(BaseProvider):
    """Entra ID (Azure AD) OAuth2 provider implementation."""

    def get_authorize_url(self) -> str:
        return f"{self._base_url()}/oauth2/v2.0/devicecode"

    def get_token_url(self) -> str:
        return f"{self._base_url()}/oauth2/v2.0/token"

    def get_jwks_url(self) -> str:
        return f"{self._base_url()}/discovery/v2.0/keys"

    def get_issuer(self) -> str:
        return f"{self._base_url()}/v2.0"

    def get_audience(self) -> str:
        if self.settings.audience is None:
            raise ValueError(
                "Audience is required. Please set it in the configuration."
            )
        return self.settings.audience

    def get_client_id(self) -> str:
        if self.settings.client_id is None:
            raise ValueError(
                "Client ID is required. Please set it in the configuration."
            )
        return self.settings.client_id

    def get_oauth_scopes(self) -> list[str]:
        return [
            *super().get_oauth_scopes(),
            *cast(str, self.settings.extra.get("scope", "")).split(),
        ]

    def get_required_fields(self) -> list[str]:
        return ["scope"]

    def _base_url(self) -> str:
        return f"https://login.microsoftonline.com/{self.settings.domain}"

```

### Core Architecture Module: `lib/crewai-core/src/crewai_core/auth/providers/keycloak.py`
```
"""Keycloak OAuth2 provider."""

from __future__ import annotations

from crewai_core.auth.providers.base_provider import BaseProvider


class KeycloakProvider(BaseProvider):
    """Keycloak OAuth2 provider implementation."""

    def get_authorize_url(self) -> str:
        return f"{self._oauth2_base_url()}/realms/{self.settings.extra.get('realm')}/protocol/openid-connect/auth/device"

    def get_token_url(self) -> str:
        return f"{self._oauth2_base_url()}/realms/{self.settings.extra.get('realm')}/protocol/openid-connect/token"

    def get_jwks_url(self) -> str:
        return f"{self._oauth2_base_url()}/realms/{self.settings.extra.get('realm')}/protocol/openid-connect/certs"

    def get_issuer(self) -> str:
        return f"{self._oauth2_base_url()}/realms/{self.settings.extra.get('realm')}"

    def get_audience(self) -> str:
        return self.settings.audience or "no-audience-provided"

    def get_client_id(self) -> str:
        if self.settings.client_id is None:
            raise ValueError(
                "Client ID is required. Please set it in the configuration."
            )
        return self.settings.client_id

    def get_required_fields(self) -> list[str]:
        return ["realm"]

    def _oauth2_base_url(self) -> str:
        domain = self.settings.domain.removeprefix("https://").removeprefix("http://")
        return f"https://{domain}"

```

### Core Architecture Module: `lib/crewai-core/src/crewai_core/auth/providers/okta.py`
```
"""Okta OAuth2 provider."""

from __future__ import annotations

from crewai_core.auth.providers.base_provider import BaseProvider


class OktaProvider(BaseProvider):
    """Okta OAuth2 provider implementation."""

    def get_authorize_url(self) -> str:
        return f"{self._oauth2_base_url()}/v1/device/authorize"

    def get_token_url(self) -> str:
        return f"{self._oauth2_base_url()}/v1/token"

    def get_jwks_url(self) -> str:
        return f"{self._oauth2_base_url()}/v1/keys"

    def get_issuer(self) -> str:
        return self._oauth2_base_url().removesuffix("/oauth2")

    def get_audience(self) -> str:
        if self.settings.audience is None:
            raise ValueError(
                "Audience is required. Please set it in the configuration."
            )
        return self.settings.audience

    def get_client_id(self) -> str:
        if self.settings.client_id is None:
            raise ValueError(
                "Client ID is required. Please set it in the configuration."
            )
        return self.settings.client_id

    def get_required_fields(self) -> list[str]:
        return ["authorization_server_name", "using_org_auth_server"]

    def _oauth2_base_url(self) -> str:
        using_org_auth_server = self.settings.extra.get("using_org_auth_server", False)

        if using_org_auth_server:
            base_url = f"https://{self.settings.domain}/oauth2"
        else:
            base_url = f"https://{self.settings.domain}/oauth2/{self.settings.extra.get('authorization_server_name', 'default')}"

        return f"{base_url}"

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7434** (2026-09-14): **[BUG] TUI crashes with TypeError: Object of type ellipsis is not JSON serializable when streamed output contains a literal [...]**
  *Symptoms*: ### Description  **Environment**   - crewai 1.15.21 (CLI and library, from PyPI), Python 3.12.10, macOS Tahoe.  **Summary** > Running a crew via `crewai run` crashes the live TUI and cancels the in-progress run whenever an agent's streamed text output happens to contain a literal [...] (three dots inside square brackets). The crew's actual execution (LLM calls, tool calls) is unaffected; only the terminal renderer crashes, taking the whole session down with it.  **Root cause** > In crewai_cli/crew_run_tui.py, _format_json_in_text() scans streamed text for bracketed spans and passes each candidate to _try_parse_structured(). That function tries json.loads() first, then falls back to ast.literal_eval() for non-JSON text, accepting the result as long as it's a dict or list — without checking that its contents are JSON-serializable. ast.literal_eval("[...]") is valid Python and returns [Ellipsis] (bare ... is the Ellipsis singleton), which passes the isinstance(obj, (dict, list)) check. _format_json_in_text then calls json.dumps([Ellipsis], ...), which raises TypeError: Object of type ellipsis is not JSON serializable. This propagates up through _render_main_content → _tick and crashes the whole CrewRunApp, cancelling the run.  ### Steps to Reproduce  Minimal, deterministic repro (no LLM needed): ``` from crewai_cli.crew_run_tui import _format_json_in_text _format_json_in_text("pandas,[...]") # TypeError: Object of type ellipsis is not JSON serializable ```  Full CLI repro: 1. Cr

- **Issue #7358** (2026-09-16): **[BUG] SQLiteFlowPersistence crashes with TypeError when Flow state contains datetime, UUID, or set fields**
  *Symptoms*: ### Description  When persisting Flow state via `@persist` or `SQLiteFlowPersistence`, workflows with structured Pydantic state models containing standard fields like `datetime`, `UUID`, `set`, `Decimal`, or `Path` crash during state saving with:  `RuntimeError: State persistence failed: Object of type datetime is not JSON serializable`  #### Root Cause: In `lib/crewai/src/crewai/flow/persistence/sqlite.py`: 1. `_to_state_dict` calls `state_data.model_dump()` without specifying `mode="json"`. In Pydantic v2, `model_dump()` keeps native Python types (`datetime.datetime`, `uuid.UUID`, `set`, etc.) instead of converting them to JSON primitives. 2. In `_save_state_sql` (line 142) and `save_pending_feedback` (line 241), `json.dumps(state_dict)` is called directly without a serializer fallback (`default=str`), which immediately raises a `TypeError` on any non-primitive type.  ### Steps to Reproduce  1. Define a Flow with a Pydantic state model containing a `datetime` (or `uuid.UUID`, `set`). 2. Attach `SQLiteFlowPersistence` using `@persist` on a flow step. 3. Call `flow.kickoff()`. 4. Observe the flow crashing upon completing the persisted method.  ### Expected behavior  `SQLiteFlowPersistence` should serialize Pydantic state models in JSON mode (`model_dump(mode="json")`) and handle fallback dicts gracefully with `default=str`. When loaded back via `load_state`, Pydantic's `model_validate` restores them to their native types (`datetime`, `UUID`, `set`) without data loss.  ### Scr
  **Post-Mortem & Fix Analysis**:
  > Hi Maintainers,  I would love to work on this! I've already tested the fix locally with full roundtrip serialization and deserialization across `datetime`, `UUID`, and `set` fields, and have the patch and unit tests ready to submit. If the proposal solutions looks good to you, I can work on it, Could you please assign this issue to me? Thanks!
  > Sounds good @Rohitkanithi 
  > Hi @Vidit-Ostwal, Just following up on this, I've raised PR #7376 with the complete fix and regression test coverage. Whenever you have a moment, could you please take a look and review Thanks

- **Issue #7356** (2026-09-10): **[BUG] DOCXSearchTool crashes with ValidationError when initialized with a fixed docx**
  *Symptoms*: ### Description  When `DOCXSearchTool` is initialized with a fixed document path: `tool = DOCXSearchTool(docx="document.docx")` the tool sets `self.args_schema = FixedDOCXSearchToolSchema`.  However, in `FixedDOCXSearchToolSchema`, the `docx` field is mistakenly marked as required (`Field(...)`). When an agent executes the tool with only `{"search_query": "..."}`, Pydantic raises a ValidationError: `ValidationError: 1 validation error for FixedDOCXSearchToolSchema: docx: Field required`  Unlike all sibling tools (CSVSearchTool, PDFSearchTool, JSONSearchTool, DirectorySearchTool), DOCXSearchTool accidentally inverted its schema inheritance, making the fixed mode require `docx` and breaking agent tool calls.  ### Steps to Reproduce  1. Initialize DOCXSearchTool with a fixed document:    tool = DOCXSearchTool(docx="sample.docx")  2. Validate the input that an agent sends during tool execution:    tool.args_schema.model_validate({"search_query": "quarterly revenue"})  3. Pydantic raises:    ValidationError: 1 validation error for FixedDOCXSearchToolSchema    docx: Field required [type=missing, input_value={'search_query': '...'}, input_type=dict]  ### Expected behavior  When `DOCXSearchTool` is initialized with a fixed `docx` file, `FixedDOCXSearchToolSchema` should only require `search_query`. `DOCXSearchToolSchema` should inherit from `FixedDOCXSearchToolSchema` and add `docx: str = Field(...)` for runtime/dynamic mode.  ### Screenshots/Code snippets  # Current buggy definition
  **Post-Mortem & Fix Analysis**:
  > Hi maintainers,  I would love to work on this issue!  I have already developed the patch aligning DOCXSearchTool with the standard RAG schema pattern (matching CSVSearchTool, PDFSearchTool, and JSONSearchTool), along with dedicated unit tests in test_docx_search_tool.py. All local checks (pytest, mypy, and ruff) are passing cleanly.  Could you please assign this issue to me, If the proposed solution looks good to you, I can open the PR right away.  Thanks!
  > @Rohitkanithi, sure assigning it to you.
  > <!-- linear-linkback --> <p><a href="https://linear.app/crewai/issue/OSS-147">OSS-147</a></p>

- **Issue #7305** (2026-09-08): **[BUG] 2 Tests fail when pytest is run with --disable-plugin-autoload -p anyio**
  *Symptoms*: ### Description  anyio is installed so according to args it should be used but there are these 2 failures:  ``` ================================================================================================================== FAILURES ================================================================================================================== ______________________________________________________________________________________ test_async_negative_seconds_is_rejected_when_passed_positionally ______________________________________________________________________________________ async def functions are not natively supported. You need to install a suitable plugin for your async framework, for example:   - anyio   - pytest-asyncio   - pytest-tornasync   - pytest-trio   - pytest-twisted ______________________________________________________________________________________________________ test_async_wait_caps_long_waits _______________________________________________________________________________________________________ async def functions are not natively supported. You need to install a suitable plugin for your async framework, for example:   - anyio   - pytest-asyncio   - pytest-tornasync   - pytest-trio   - pytest-twisted ```  OS: FreeBSD 15.1 Version: 1.15.20 Python-3.12 pytest-9.1.1  ### Steps to Reproduce  tun tests  ### Expected behavior  n/a  ### Screenshots/Code snippets  n/a  ### Operating System  Other (specify in additional context)  ### Python Version  3.12  
  **Post-Mortem & Fix Analysis**:
  > I reproduced this on current main with plugin autoload disabled: the two failures are the only async tests in `wait_tool_test.py`, and both use `@pytest.mark.asyncio` while only the AnyIO plugin is loaded.  I have a minimal test-only patch that switches those two tests to `@pytest.mark.anyio` and pins `anyio_backend` to `asyncio`, matching the `WaitTool.arun()` implementation that uses `asyncio.sleep`. With the isolated plugin configuration, the file changes from 2 failed / 21 passed to 23 passed.  Could you assign this issue to me? I can submit the focused PR. If you prefer keeping pytest-asyncio as a required downstream test dependency instead, I can adjust the scope.
  > These two tests fail only because pytest was invoked with `--disable-plugin-autoload -p anyio`. They are marked `@pytest.mark.asyncio` because this repo's async test runner is **pytest-asyncio** (workspace dep, `asyncio_mode = "strict"`). They pass under the normal test command.  `--disable-plugin-autoload -p anyio` is an incomplete plugin set for this suite. Load pytest-asyncio instead (`-p pytest_asyncio`). This is not a WaitTool bug.  Closing as not planned.
  > <!-- linear-linkback --> <p><a href="https://linear.app/crewai/issue/OSS-147">OSS-147</a></p>

- **Issue #7303** (2026-10-01): **[BUG] o1, o1-pro, and o3 reasoning models fallback to 8k default context window**
  *Symptoms*: ### Description  OpenAI's flagship reasoning models (`o1`, `o1-pro`, `o3`) and Azure OpenAI deployments of `o1`, `o1-mini`, and `o3-mini` are missing from `LLM_CONTEXT_WINDOW_SIZES` and native provider context window tables.  Because prefix lookup fails (`"o1".startswith("o1-preview")` is false), querying with `model="o1"` or `model="o3"` falls back to `DEFAULT_CONTEXT_WINDOW_SIZE` (8,192 tokens, or 6,144 usable tokens with ratio) instead of their official 200,000 tokens. This can trigger false `LLMContextLengthExceededError` or premature prompt truncation.  ### Proposed Solution Register official 200k context windows for `o1`, `o1-pro`, and `o3` across `llm.py`, `openai/completion.py`, and `azure/completion.py`, while preserving the 128k windows for `o1-preview` and `o1-mini`.  ### Steps to Reproduce  1. Initialize an LLM instance with an o-series model:    llm = LLM(model="o1", is_litellm=True) 2. Query its context window:    size = llm.get_context_window_size() 3. Check the returned size:    Expected ~150,000 (200k * 0.75 ratio), but returns 6,144 (8k * 0.75 ratio).  ### Expected behavior  `o1`, `o1-pro`, and `o3` should recognize the official 200,000 context window (150,000 usable after ratio), while `o1-preview` and `o1-mini` retain their 128,000 window.  ### Screenshots/Code snippets  from crewai.llm import LLM  llm = LLM(model="o1") print(llm.get_context_window_size()) # Outputs: 6144 (Incorrect: default 8192 * 0.75) # Expected: 150000 (Official 200000 * 0.75)  ### Ope
  **Post-Mortem & Fix Analysis**:
  > Looks like #7796 (centralize and refresh context windows) resolved this: o1, o1-pro, and o3 are now registered at 200k in crewai/llms/context_window.py, with o1-preview and o1-mini at 128k. This can probably be closed.
  > Fixed by #7796, which centralizes context-window lookup and includes the o1, o1-pro, and o3 windows. Closing the open pull requests that targeted this issue as superseded.

- **Issue #7233** (2026-09-08): **[BUG] DashScope non-Qwen models bypass the native provider and ignore DASHSCOPE_BASE_URL**
  *Symptoms*: ### Description  While working on another Ollama-related fix I noticed that `_matches_provider_pattern` in `llm.py` only treats a DashScope model as natively supported when its name starts with `qwen`. Any other DashScope model skips CrewAI's native OpenAI-compatible provider and falls through to the LiteLLM fallback instead.  That matters because Alibaba's documentation says the same `compatible-mode/v1` endpoint also serves DeepSeek, Kimi, GLM and MiniMax. So the prefix check is excluding models the endpoint genuinely supports, and users of those models quietly lose their DashScope configuration.  ### Steps to Reproduce  1. Set DASHSCOPE_API_KEY and DASHSCOPE_BASE_URL. 2. Build one LLM with a Qwen model and one with a non-Qwen DashScope model. 3. Compare the class that gets created and the resolved base_url.  DASHSCOPE_API_KEY=************  DASHSCOPE_BASE_URL=https://my-dashscope.example.com/v1 python -c " from crewai import LLM for m in ['dashscope/qwen-max', 'dashscope/deepseek-v3']:     l = LLM(model=m)     print(m, type(l).__name__, getattr(l, 'base_url', None)) "  ### Expected behavior  I'd expect both models to use the native OpenAICompatibleCompletion provider and to respect DASHSCOPE_BASE_URL, since DashScope serves them through the same endpoint.  ### Screenshots/Code snippets  Here's what I get:  ``` dashscope/qwen-max                -> OpenAICompatibleCompletion   base_url=https://dashscope-intl.aliyuncs.com/compatible-mode/v1 dashscope/deepseek-v3             ->
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/crewai/issue/OSS-147">OSS-147</a></p>

- **Issue #7124** (2026-08-26): **[BUG] `crewai create` offers 7 retired Anthropic model ids that 404 on first call**
  *Symptoms*: ### Description  `MODELS["anthropic"]` in `lib/cli/src/crewai_cli/constants.py:167-178` (at `56e0e85a`) offers 10 models. **7 of them are no longer served by the Anthropic API**, so a new user scaffolding a project and picking from the menu gets a 404 on their first call.  `GET /v1/models/{id}`, `anthropic-version: 2023-06-01`:  | line | id in menu | result | |---|---|---| | 168 | `claude-opus-4-6` | 200 `Claude Opus 4.6` | | 169 | `claude-sonnet-4-6` | 200 `Claude Sonnet 4.6` | | 170 | `claude-haiku-4-5-20251001` | 200 `Claude Haiku 4.5` | | 171 | `claude-3-7-sonnet-20250219` | **404** `model: claude-3-7-sonnet-20250219` | | 172 | `claude-3-5-sonnet-20241022` | **404** `model: claude-3-5-sonnet-20241022` | | 173 | `claude-3-5-haiku-20241022` | **404** `model: claude-3-5-haiku-20241022` | | 174 | `claude-3-5-sonnet-20240620` | **404** `model: claude-3-5-sonnet-20240620` | | 175 | `claude-3-opus-20240229` | **404** `model: claude-3-opus-20240229` | | 176 | `claude-3-sonnet-20240229` | **404** `model: claude-3-sonnet-20240229` | | 177 | `claude-3-haiku-20240307` | **404** `model: claude-3-haiku-20240307` |  The menu's newest entry is 4.6; Opus 4.7/4.8, Sonnet 5, and Opus 5 are absent.  ### Steps to Reproduce  1. `crewai create crew demo` 2. Select `anthropic` 3. Select any of the 7 ids marked 404 above 4. First `kickoff()` fails with a 404 for that model id  ### Expected behavior  Models that are actually available only show in the CLI  ### Screenshots/Code snippets  `GET /v1/m
  **Post-Mortem & Fix Analysis**:
  > Oops - already fixed by #7077, which merged 26 minutes before I filed. Closing.  

- **Issue #7004** (2026-09-29): **[BUG] LLM().call() doesn't work with Tools**
  *Symptoms*: ### Description  LLM().call() doesn't work with Tools  ### Steps to Reproduce  code  ### Expected behavior  I want to use the LLM() class without Agent() for more control over the "messages" (lower level).  ### Screenshots/Code snippets  ```python import crewai as c import crewai.flow as cf import crewai_tools as ct import logging from pathlib import Path  logging.basicConfig(level=logging.DEBUG)  llm = c.LLM(model="ollama/my", base_url="http://127.0.0.1:8080") print(c.__version__)  ROOT = Path(Path(__file__).parent, "_temp").resolve() ROOT.mkdir(parents=True, exist_ok=True) fwriter = ct.FileWriterTool(base_dir=str(ROOT)) freader = ct.FileReadTool(base_dir=str(ROOT))  print(llm.call(     messages=[{"role":"user","content":"Who are you?"}],     tools=[fwriter, freader], )) ```   ### Operating System  Windows 10  ### Python Version  3.12  ### crewAI Version  1.15.16  ### crewAI Tools Version  1.15.16  ### Virtual Environment  Venv  ### Evidence  DEBUG:asyncio:Using proactor: IocpProactor ERROR:root:OpenAI: Error extracting tool info: Tool must be a dictionary ERROR:root:OpenAI: Tool structure: name='File Writer Tool' description="A tool to write content to a specified file. Accepts filename, content, and optionally a directory path and overwrite flag as input. Writes are confined to the tool's allowed directory; a filename or directory that resolves outside it is rejected." env_vars=[] args_schema=<class 'crewai_tools.tools.file_writer_tool.file_writer_tool.FileWriterToolInput'
  **Post-Mortem & Fix Analysis**:
  > I want to solve this issue 
  > I reproduced this and I'm tracing the difference between the tool-conversion path used by Agent and direct LLM.call(). I'll add regression coverage once I determine whether LLM.call() should normalize BaseTool instances or reuse an existing conversion helper.
  > With patch #7005 , LLM.call() returned: ``` [ChatCompletionMessageFunctionToolCall(id='9HOqZpSsDjmRvNEB1FbXjzUT58VDKFKR', function=Function(arguments='{"content":"I am a large language model, trained by Google.","directory":"","filename":"answer.md","overwrite":true}', name='file_writer_tool'), type='function')] ``` I expected a full cycle of processing "messages" with a call to Tools.

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

### Incident Patch 1: `1133f16c` (2026-10-05)
**Commit Message**: fix(deps): bump oauthlib to 4.0.0 to clear PYSEC-2026-4114 (#7906)

**File**: `.github/workflows/vulnerability-scan.yml` (modified, +0/-10)
```diff
@@ -117,16 +117,6 @@ jobs:
             # patched release; keep the ignore list in sync with
             # .pre-commit-config.yaml.
             --ignore-vuln GHSA-4j2p-28q2-5m79
-            # oauthlib <4.0.0: GHSA-xpv3-w29h-x7cv: timing side channel in the
-            # server-side PKCE code_verifier check (authorization_code grant).
-            # The fix, 4.0.0 (published 2026-09-28), is inside the 3-day
-            # exclude-newer cooldown. Transitive via chromadb -> kubernetes ->
-            # requests-oauthlib, which uses oauthlib as an OAuth client only;
-            # CrewAI never runs an oauthlib authorization server.
-            # TODO: drop this ignore and run `uv lock --upgrade-package oauthlib`
-            # once 4.0.0 clears the cooldown (after 2026-10-01 06:01 UTC); keep
-            # the ignore list in sync with .pre-commit-config.yaml.
-            --ignore-vuln GHSA-xpv3-w29h-x7cv
           )
           uv run pip-audit "${pip_audit_args[@]}"
         continue-on-error: true
```

**File**: `.pre-commit-config.yaml` (modified, +1/-3)
```diff
@@ -31,7 +31,6 @@ repos:
         # Keep this ignore list in sync with .github/workflows/vulnerability-scan.yml.
         # TODO: drop --ignore-vuln GHSA-8mgp-746c-j5xp when bumping nltk past 3.10.3.
         # TODO: drop --ignore-vuln GHSA-4j2p-28q2-5m79 when bumping accelerate past 1.14.0.
-        # TODO: drop --ignore-vuln GHSA-xpv3-w29h-x7cv when bumping oauthlib to 4.0.0 (after 2026-10-01 06:01 UTC).
         entry: >-
           bash -c 'case "$OSTYPE" in msys*|cygwin*|win32*) source .venv/Scripts/activate ;; *) source .venv/bin/activate ;; esac && uv run pip-audit --skip-editable
           --ignore-vuln PYSEC-2024-277
@@ -64,8 +63,7 @@ repos:
           --ignore-vuln GHSA-36p7-vc44-83pf
           --ignore-vuln GHSA-xph7-9rjv-w5fr
           --ignore-vuln GHSA-8mgp-746c-j5xp
-          --ignore-vuln GHSA-4j2p-28q2-5m79
-          --ignore-vuln GHSA-xpv3-w29h-x7cv' --
+          --ignore-vuln GHSA-4j2p-28q2-5m79' --
         language: system
         pass_filenames: false
         stages: [pre-push, manual]
```

**File**: `pyproject.toml` (modified, +5/-0)
```diff
@@ -274,6 +274,10 @@ exclude-newer-package = { msgpack = "2026-06-20T00:00:00Z", pydantic-settings =
 # a client SDK, but pip-audit flags the package). The floor lives in lib/crewai/pyproject.toml (the
 # crewai[litellm] extra, "litellm>=1.88.6,<2") rather than here, since crewai declares litellm directly.
 # 1.88.6 is older than the global 3-day cutoff, so no exclude-newer-package override is needed.
+# oauthlib <4.0.0 has GHSA-xpv3-w29h-x7cv / PYSEC-2026-4114 (PKCE code_verifier timing side channel)
+# and GHSA-hj66-6f7g-4r5v (JSONP callback injection on RevocationEndpoint). Fixed in 4.0.0.
+# Transitive via chromadb -> kubernetes -> requests-oauthlib, which uses oauthlib as a client.
+# 4.0.0 (2026-09-28) is older than the global 3-day cutoff, so no exclude-newer-package override is needed.
 # Keep OpenAI on the SDK range required by CrewAI when transitive dependencies
 # loosen or pin their own lower versions.
 override-dependencies = [
@@ -311,6 +315,7 @@ override-dependencies = [
     "snowflake-connector-python>=4.7.1",
     "snowflake-sqlalchemy>=1.11.0",
     "soupsieve>=2.9.2",
+    "oauthlib>=4.0.0",
 ]
 
 [tool.uv.workspace]
```

**File**: `uv.lock` (modified, +4/-3)
```diff
@@ -47,6 +47,7 @@ overrides = [
     { name = "langsmith", specifier = ">=0.8.18,<1" },
     { name = "msgpack", specifier = ">=1.2.1" },
     { name = "nltk", specifier = ">=3.10.3" },
+    { name = "oauthlib", specifier = ">=4.0.0" },
     { name = "onnxruntime", marker = "python_full_version < '3.11'", specifier = "<1.24" },
     { name = "openai", specifier = ">=2.30.0,<3" },
     { name = "paramiko", specifier = ">=5.0.0" },
@@ -5626,11 +5627,11 @@ wheels = [
 
 [[package]]
 name = "oauthlib"
-version = "3.3.1"
+version = "4.0.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/0b/5f/19930f824ffeb0ad4372da4812c50edbd1434f678c90c2733e1188edfc63/oauthlib-3.3.1.tar.gz", hash = "sha256:0f0f8aa759826a193cf66c12ea1af1637f87b9b4622d46e866952bb022e538c9", size = 185918, upload-time = "2025-06-19T22:48:08.269Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/7a/d8/a1bcc8ba112a627f8ffbdc212a78ce18d3ac07e91a5ca65d27918eee25a1/oauthlib-4.0.0.tar.gz", hash = "sha256:efb274799819440f95b4ab3b818869f1ce9ae26c5beacba0201d1a1b76b54f86", size = 187232, upload-time = "2026-09-28T06:01:18.77Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/be/9c/92789c596b8df838baa98fa71844d84283302f7604ed565dafe5a6b5041a/oauthlib-3.3.1-py3-none-any.whl", hash = "sha256:88119c938d2b8fb88561af5f6ee0eec8cc8d552b7bb1f712743136eb7523b7a1", size = 160065, upload-time = "2025-06-19T22:48:06.508Z" },
+    { url = "https://files.pythonhosted.org/packages/d9/f4/78229a1066068ca14fc60fb26cf7381cabe4382261392b90e5f9552722d4/oauthlib-4.0.0-py3-none-any.whl", hash = "sha256:624c28c13a0a59cabf9747dfa52af63be3e512a7f2714df16e91b5b3a145e6cd", size = 159715, upload-time = "2026-09-28T06:01:17.008Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 2: `8078f913` (2026-10-01)
**Commit Message**: fix(flow): let human_feedback emit steps expose the review in outputs (#7850)

**File**: `lib/crewai/src/crewai/flow/runtime/__init__.py` (modified, +20/-12)
```diff
@@ -1549,9 +1549,13 @@ async def _resume_async_body(
         # This allows methods to re-execute in loops (e.g., implement_changes → suggest_changes → implement_changes)
         self._is_execution_resuming = False
 
-        self._method_outputs.append(
-            {"method": context.method_name, "output": resumed_method_output}
-        )
+        method_output_entry: dict[str, Any] = {
+            "method": context.method_name,
+            "output": resumed_method_output,
+        }
+        if emit and isinstance(result, HumanFeedbackResult):
+            method_output_entry["human_feedback"] = result
+        self._method_outputs.append(method_output_entry)
 
         try:
             if emit and collapsed_outcome:
@@ -2981,12 +2985,16 @@ async def _execute_method(
             # For @human_feedback methods with emit, the result is the collapsed outcome
             # (e.g., "approved") used for routing. But we want the actual method output
             # to be the stored result (for final flow output). Replace the last entry
-            # if a stashed output exists. Dict-based stash is concurrency-safe and
-            # handles None return values (presence in dict = stashed, not value).
+            # if a stashed output exists, keeping the feedback alongside the output so
+            # expressions read `outputs.<method>` as the full feedback result.
+            # Dict-based stash is concurrency-safe.
             if method_name in self._human_feedback_method_outputs:
-                self._method_outputs[-1]["output"] = (
-                    self._human_feedback_method_outputs.pop(method_name)
-                )
+                feedback_result = self._human_feedback_method_outputs.pop(method_name)
+                self._method_outputs[-1] = {
+                    "method": str(method_name),
+                    "output": feedback_result.output,
+                    "human_feedback": feedback_result,
+                }
 
             self._method_execution_counts[method_name] = (
                 self._method_execution_counts.get(method_name, 0) + 1
@@ -3660,10 +3668,10 @@ async def _run_human_feedback_step(
             )
 
         if emit:
-            # Stash the real method output: the collapsed outcome routes
-            # listeners, but the flow's final result stays the method's
-            # actual return value.
-            self._human_feedback_method_outputs[method_name] = method_output
+            # Stash the feedback result: the collapsed outcome routes listeners,
+            # but the flow's final result stays the method's actual return
+            # value (result.output).
+            self._human_feedback_method_outputs[method_name] = result
             return result.outcome
         return result
 
```

**File**: `lib/crewai/src/crewai/flow/runtime/_outputs.py` (modified, +6/-2)
```diff
@@ -3,14 +3,17 @@
 from __future__ import annotations
 
 from collections.abc import Mapping
-from typing import Any, TypedDict
+from typing import Any
+
+from typing_extensions import NotRequired, TypedDict
 
 from crewai.utilities.serialization import to_serializable
 
 
 class _MethodOutput(TypedDict):
     method: str
     output: Any
+    human_feedback: NotRequired[Any]
 
 
 def outputs_by_name(
@@ -21,7 +24,8 @@ def outputs_by_name(
 ) -> dict[str, Any]:
     outputs: dict[str, Any] = {}
     for entry in method_outputs:
-        outputs[entry["method"]] = _output_value(entry["output"], serialize=serialize)
+        value = entry.get("human_feedback", entry["output"])
+        outputs[entry["method"]] = _output_value(value, serialize=serialize)
 
     if local_outputs is not None:
         outputs.update(
```

**File**: `lib/crewai/src/crewai/flow/templates/flow_definition_skill.md.j2` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ Pick the simplest action that does the job.
 {% endif %}
 {% if include_hitl %}
 - Use `human_feedback` when a method needs a human checkpoint.
+- After a `human_feedback` method, read the review as `outputs.method_name.feedback` and `outputs.method_name.outcome`, and the method's own result as `outputs.method_name.output` (for example `${outputs.method_name.output.raw}`). This holds with or without `emit`.
 {% endif %}
 {% if include_script_action %}
 - Use `call: script` only for trusted inline Python. Scripts are not sandboxed.
```

**File**: `lib/crewai/tests/test_flow_from_definition.py` (modified, +113/-0)
```diff
@@ -4006,6 +4006,119 @@ def test_human_feedback_pending_and_resume_from_declaration():
     assert flow_id not in DefinitionStoreBackend.pending
 
 
+EMIT_REVIEW_EXPR_YAML = """
+schema: crewai.flow/v1
+name: EmitReviewExprFlow
+methods:
+  draft:
+    do:
+      call: expression
+      expr: "'draft-content'"
+    start: true
+    human_feedback:
+      message: "Review the draft:"
+      emit: [approved, rejected]
+      llm: gpt-4o-mini
+      default_outcome: rejected
+  rewrite:
+    do:
+      call: expression
+      expr: "outputs.draft.feedback + '|' + outputs.draft.outcome + '|' + outputs.draft.output"
+    listen: rejected
+"""
+
+
+def test_human_feedback_emit_exposes_feedback_in_outputs():
+    flow = Flow.from_declaration(contents=EMIT_REVIEW_EXPR_YAML)
+
+    with (
+        patch.object(flow, "_request_human_feedback", return_value="make it shorter"),
+        patch.object(flow, "_collapse_to_outcome", return_value="rejected"),
+    ):
+        result = flow.kickoff()
+
+    assert result == "make it shorter|rejected|draft-content"
+    assert flow.method_outputs[0] == "draft-content"
+
+
+def test_human_feedback_emit_feedback_renders_in_action_templates():
+    yaml_str = f"""
+schema: crewai.flow/v1
+name: EmitFeedbackTemplateFlow
+methods:
+  draft:
+    do:
+      call: expression
+      expr: "'draft-content'"
+    start: true
+    human_feedback:
+      message: "Review the draft:"
+      emit: [approved, rejected]
+      llm: gpt-4o-mini
+  rewrite:
+    do:
+      call: tool
+      ref: {__name__}:StaticSearchTool
+      with:
+        search_query: "Draft: ${{outputs.draft.output}}. Reason: ${{outputs.draft.feedback}}"
+        prefix: rewrite
+    listen: rejected
+"""
+    flow = Flow.from_declaration(contents=yaml_str)
+
+    with (
+        patch.object(flow, "_request_human_feedback", return_value="too long"),
+        patch.object(flow, "_collapse_to_outcome", return_value="rejected"),
+    ):
+        result = flow.kickoff()
+
+    assert result == "rewrite:Draft: draft-content. Reason: too long"
+
+
+PENDING_EMIT_REVIEW_YAML = f"""
+schema: crewai.flow/v1
+name: PendingEmitReviewFlow
+persist:
+  enabled: true
+  persistence:
+    persistence_type: DefinitionStoreBackend
+    store: hitl-pending-emit
+methods:
+  draft:
+    do:
+      call: expression
+      expr: "'draft-content'"
+    start: true
+    human_feedback:
+      message: "Review:"
+      emit: [approved, rejected]
+      llm: gpt-4o-mini
+      provider: {__name__}:PausingProvider
+  rewrite:
+    do:
+      call: expression
+      expr: "outputs.draft.feedback + '|' + outputs.draft.output"
+    listen: rejected
+"""
+
+
+def test_human_feedback_emit_exposes_feedback_in_outputs_after_resume():
+    definition = FlowDefinition.from_declaration(contents=PENDING_EMIT_REVIEW_YAML)
+    pending = Flow.from_declaration(contents=definition).kickoff()
+    assert isinstance(pending, HumanFeedbackPending)
+
+    resumed = Flow.from_pending(
+        pending.context.flow_id,
+        DefinitionStoreBackend(store="hitl-pending-emit"),
+        definition=definition,
+    )
+    with patch.object(resumed, "_collapse_to_outcome", return_value="rejected"):
+        result = resumed.resume("make it shorter")
+
+    assert result == "make it shorter|draft-content"
+    assert resumed.method_outputs[0] == "draft-content"
+
+
 def test_flow_config_provider_fallback_from_declaration():
     yaml_str = f"""
 schema: crewai.flow/v1
```

---

### Incident Patch 3: `19713955` (2026-10-01)
**Commit Message**: fix(deps): bump pypdf to 6.19.0 to clear pip-audit findings (#7851)

pypdf 6.16.2 is flagged for eight advisories, all fixed in 6.19.0.

**File**: `lib/crewai-files/pyproject.toml` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ authors = [
 requires-python = ">=3.10, <3.14"
 dependencies = [
     "Pillow~=12.3.0",
-    "pypdf~=6.16.1",
+    "pypdf~=6.19.0",
     "python-magic>=0.4.27",
     "aiocache~=0.12.3",
     "aiofiles~=24.1.0",
```

**File**: `pyproject.toml` (modified, +10/-3)
```diff
@@ -190,8 +190,15 @@ exclude-newer-package = { msgpack = "2026-06-20T00:00:00Z", pydantic-settings =
 # and /ToUnicode streams); force 6.15.0+.
 # pypdf <6.16.0 has GHSA-jp53-mhqp-8xcg (infinite loop in TreeObject.insert_child).
 # pypdf <6.16.1 has GHSA-23w6-3w8w-8484 and GHSA-763m-79hh-57f2 (unbounded runtime/memory on
-# outlines and XForm extraction); force 6.16.1+. 6.16.2 is older than the global 3-day cutoff,
-# so no exclude-newer-package override is needed.
+# outlines and XForm extraction).
+# pypdf <6.17.0 has GHSA-qv6h-rv94-w285 (large memory on Roman page labels).
+# pypdf <6.18.0 has GHSA-5jq2-8x83-x246 (long runtimes/memory parsing indirect objects).
+# pypdf <6.18.1 has GHSA-fp3h-c4fm-7vvf (ToUnicode follow-up), GHSA-g9cg-prrw-2r8q (font data
+# memory), and GHSA-jw7q-gvrg-4vj3 (malformed FlateDecode follow-up).
+# pypdf <6.19.0 has GHSA-w23x-9jrw-r45c (alphabetical page labels), GHSA-php9-fj8v-98fj
+# (appearance streams), and GHSA-v247-6f48-mgcj (embedded files); force 6.19.0+.
+# 6.19.0 (2026-09-16) is older than the global 3-day cutoff, so no exclude-newer-package
+# override is needed.
 # uv <0.11.15 has GHSA-4gg8-gxpx-9rph (and earlier GHSA-pjjw-68hj-v9mw); force 0.11.15+.
 # python-multipart <0.0.27 has GHSA-pp6c-gr5w-3c5g (DoS via unbounded multipart headers).
 # gitpython <3.1.50 has GHSA-mv93-w799-cj2w (config_writer newline injection bypassing the 3.1.49 patch -> RCE via core.hooksPath).
@@ -281,7 +288,7 @@ override-dependencies = [
     "virtualenv>=21.7.13",
     "transformers>=5.4.0; python_version >= '3.10'",
     "cryptography>=50.0.0",
-    "pypdf>=6.16.1,<7",
+    "pypdf>=6.19.0,<7",
     "uv>=0.11.15,<1",
     "python-multipart>=0.0.27,<1",
     "gitpython>=3.1.59,<4",
```

**File**: `uv.lock` (modified, +6/-6)
```diff
@@ -21,8 +21,8 @@ exclude-newer = "0001-01-01T00:00:00Z" # This has no effect and is included for
 exclude-newer-span = "P3D"
 
 [options.exclude-newer-package]
-langsmith = "2026-06-20T00:00:00Z"
 msgpack = "2026-06-20T00:00:00Z"
+langsmith = "2026-06-20T00:00:00Z"
 pydantic-settings = "2026-06-20T00:00:00Z"
 
 [manifest]
@@ -54,7 +54,7 @@ overrides = [
     { name = "pip", specifier = ">=26.2" },
     { name = "pyasn1", specifier = ">=0.6.4" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
-    { name = "pypdf", specifier = ">=6.16.1,<7" },
+    { name = "pypdf", specifier = ">=6.19.0,<7" },
     { name = "python-multipart", specifier = ">=0.0.27,<1" },
     { name = "rich", specifier = ">=13.7.1" },
     { name = "setuptools", specifier = ">=83.0.0" },
@@ -1705,7 +1705,7 @@ requires-dist = [
     { name = "aiofiles", specifier = "~=24.1.0" },
     { name = "av", specifier = "~=13.0.0" },
     { name = "pillow", specifier = "~=12.3.0" },
-    { name = "pypdf", specifier = "~=6.16.1" },
+    { name = "pypdf", specifier = "~=6.19.0" },
     { name = "python-magic", specifier = ">=0.4.27" },
     { name = "tinytag", specifier = "~=2.2.1" },
 ]
@@ -7520,14 +7520,14 @@ wheels = [
 
 [[package]]
 name = "pypdf"
-version = "6.16.2"
+version = "6.19.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "typing-extensions", marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/44/66/54212e75406afd9f3e933d0dda23072f6aecc55c5a273077dc2e0b028b23/pypdf-6.16.2.tar.gz", hash = "sha256:595647f6191de6f402cfde1d0c455d6cbccbd509aac32b34783009c032de5d6e", size = 7008996, upload-time = "2026-08-23T13:50:07.135Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/1f/ac/63d71aaedb59acbcdef491e6ca6469165e3771c9c74358204818fd9bc5a6/pypdf-6.19.0.tar.gz", hash = "sha256:bbc43aca292369ccc6cbc8a921991ecf2538a3587ab5a116eff06c321d647155", size = 7033266, upload-time = "2026-09-16T09:32:05.946Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/13/f1/a2da3b55acd4ab737bf728c97edaaed5ec1d3c1236acb639dcdfa97e42c7/pypdf-6.16.2-py3-none-any.whl", hash = "sha256:c8b09a59399062fb45a1b8156c18a787a10a3dae03ac9674397a226712c94604", size = 385060, upload-time = "2026-08-23T13:50:05.349Z" },
+    { url = "https://files.pythonhosted.org/packages/3c/2c/c43c03eaf630435f023f1dc61ec4a4a78951ad5530a62c71cc89bde307b7/pypdf-6.19.0-py3-none-any.whl", hash = "sha256:7e5d6e730e7dae87d560a2cee218b852f6498c8be61966f3cd02ead971e48d14", size = 395480, upload-time = "2026-09-16T09:32:04.087Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 4: `fbcf2de3` (2026-10-01)
**Commit Message**: fix(tracing): keep tool and task outputs whole in exported spans (#7833)

* fix(tracing): keep tool and task outputs whole in exported spans

Every gen_ai.* content attribute was capped at 32 KiB, and a value over the
cap that was not a message array became an envelope holding a 4 KiB preview:
a 33 KB tool result reached the trace as 4 KB. Graders checking a summary
against the data a tool returned could not decide.

- DEFAULT_MAX_ATTR_BYTES is 384 KiB, sized to Wharf's 3,072,000-byte request
  limit: seven attributes at the bound still fit one request.
- Over the bound, a value loses only what is over it (the envelope preview
  fills the bound; a message's text is cut by the overshoot, not halved), with
  the existing <attr>.truncated / <attr>.original_size_bytes markers.
- Every other string attribute (crewai.task.output, crewai.mcp.tool_result,
  serialized flow state) gets the same bound and markers; before, one huge
  value made the span too large for Wharf and the exporter dropped it whole.
- An OpenTelemetry SDK attribute length limit, when set, lowers the bound, so
  the SDK (which cuts without a marker) never has anything left to cut.
  CREWAI_OTEL_MAX_ATTR_BYTES still rep

**File**: `lib/crewai/src/crewai/telemetry/tracing/gen_ai_shapes.py` (modified, +150/-15)
```diff
@@ -17,16 +17,41 @@
 
 from __future__ import annotations
 
+from functools import lru_cache
 import json
+import logging
+import math
 import os
 from typing import Any
 
 from crewai.utilities.serialization import to_serializable
 
 
+logger = logging.getLogger(__name__)
+
+
 _MAX_DEPTH = 14
 
-DEFAULT_MAX_ATTR_BYTES = 32 * 1024
+DEFAULT_MAX_ATTR_BYTES = 384 * 1024
+"""Upper bound, in UTF-8 bytes, on one exported span attribute value.
+
+Tool results, task outputs, agent prompts and answers, and LLM messages are
+evidence: whoever reads the trace (a person in the trace viewer, an evaluator
+checking that a summary matches the data a tool returned) needs them whole, so
+the bound sits well above what a real run produces (a 300 KB tool result fits).
+It is set by Wharf, which refuses an OTLP request whose encoded body is over
+3,072,000 bytes, so seven attributes at this bound still fit one request with
+room for the rest of the span (a span that does not fit is cut further at
+export, see ``grants._fit_span``). A value over the bound is cut as little as possible and says so:
+``<attr>.truncated`` and ``<attr>.original_size_bytes`` ride next to it.
+
+It is also the ceiling: ``CREWAI_OTEL_MAX_ATTR_BYTES`` and the OpenTelemetry
+SDK's span attribute length limit (``OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT``,
+else ``OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT``) can lower it, never raise it; a
+higher ``CREWAI_OTEL_MAX_ATTR_BYTES`` is clamped to it with one warning. The
+SDK cuts without a marker, so a lower SDK limit lowers the bound and the SDK
+never has anything left to cut.
+"""
 _PLACEHOLDER_ROLE = "system"
 _TRUNCATION_LOOP_LIMIT = 8
 
@@ -351,7 +376,7 @@ def truncate_attr(
     if payload is None:
         return None, {}
 
-    cap = max_bytes if max_bytes is not None else _max_attr_bytes()
+    cap = max_bytes if max_bytes is not None else max_attr_bytes()
     original_size = _byte_len(payload)
     if original_size <= cap:
         return payload, {}
@@ -371,15 +396,111 @@ def truncate_attr(
     return _envelope(payload, original_size, cap), markers
 
 
-def _max_attr_bytes() -> int:
-    raw = os.environ.get("CREWAI_OTEL_MAX_ATTR_BYTES")
+def _positive_env_int(name: str) -> int | None:
+    raw = os.environ.get(name)
     if not raw:
-        return DEFAULT_MAX_ATTR_BYTES
+        return None
     try:
         value = int(raw)
     except ValueError:
-        return DEFAULT_MAX_ATTR_BYTES
-    return value if value > 0 else DEFAULT_MAX_ATTR_BYTES
+        return None
+    return value if value > 0 else None
+
+
+_UNLIMITED = object()
+
+
+def _sdk_env_limit(name: str) -> int | None | object:
+    """Read one SDK length limit the way the OpenTelemetry SDK does.
+
+    Absent → ``None`` (fall through to the next setting); empty → unlimited;
+    a non-negative integer → that limit, ``0`` included (the SDK then cuts
+    every string to nothing). A value the SDK would reject is ignored here.
+    """
+    if name not in os.environ:
+        return None
+    raw = os.environ[name].strip().lower()
+    if raw == "":
+        return _UNLIMITED
+    try:
+        value = int(raw)
+    except ValueError:
+        return None
+    return value if value >= 0 else None
+
+
+def _sdk_span_attribute_limit() -> int | None:
+    """The SDK's span attribute length limit; ``None`` when unlimited.
+
+    The span setting takes precedence over the general one, also when it is
+    explicitly empty (unlimited), as in ``SpanLimits``.
+    """
+    for name in (
+        "OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT",
+        "OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT",
+    ):
+        limit = _sdk_env_limit(name)
+        if limit is _UNLIMITED:
+            return None
+        if isinstance(limit, int):
+            return limit
+    return None
+
+
+def max_attr_bytes() -> int:
+    """The byte bound :func:`truncate_attr` applies when given none.
+
+    See :data:`DEFAULT_MAX_ATTR_BYTES`. The SDK's limit counts characters and a
+    character is at least one byte, so a value within this many bytes is
+    within the SDK's limit too.
+    """
+    cap = DEFAULT_MAX_ATTR_BYTES
+    configured = _positive_env_int("CREWAI_OTEL_MAX_ATTR_BYTES")
+    if configured is not None:
+        if configured > DEFAULT_MAX_ATTR_BYTES:
+            _warn_clamped(configured)
+        else:
+            cap = configured
+    sdk_limit = _sdk_span_attribute_limit()
+    return min(cap, sdk_limit) if sdk_limit is not None else cap
+
+
+@lru_cache(maxsize=8)
+def _warn_clamped(configured: int) -> None:
+    """Say once per configured value that it was clamped, and why."""
+    logger.warning(
+        "CREWAI_OTEL_MAX_ATTR_BYTES=%d is above the %d-byte ceiling; using %d. "
+        "Wharf refuses an OTLP request over 3,072,000 bytes, and a span with "
+        "several attributes above the ceiling would not fit one request.",
+        configured,
+        DEFAULT_MAX_ATTR_BYTES,
+        DEFAULT_MAX_ATTR_BYTES,
+    )
+
+
+def truncate_plain(
+    payload:
```

**File**: `lib/crewai/src/crewai/telemetry/tracing/grants.py` (modified, +83/-1)
```diff
@@ -9,6 +9,7 @@
 import logging
 import os
 from threading import Lock
+from typing import Any
 from urllib.parse import urlsplit
 from uuid import UUID
 
@@ -28,7 +29,7 @@
     should_suppress_tracing_messages,
 )
 from crewai.telemetry.telemetry import Telemetry
-from crewai.telemetry.tracing import last_run
+from crewai.telemetry.tracing import gen_ai_shapes, last_run
 from crewai.telemetry.tracing.session import MAX_EXPORT_BATCH_SIZE, otlp_exporter
 
 
@@ -37,6 +38,75 @@
 MAX_EXPORT_BODY_BYTES = 3_072_000
 
 
+_FIT_ATTEMPTS = 16
+
+
+def _fit_span(span: ReadableSpan, size: int) -> ReadableSpan | None:
+    """``span`` with its largest string attributes cut until it fits a request.
+
+    Each attribute is bounded on its own, so only a span carrying many large
+    ones gets here. Cutting the largest by the overshoot, with the usual
+    ``<attr>.truncated`` / ``<attr>.original_size_bytes`` markers, keeps the
+    span (its place in the tree, its timing, its status) where dropping it
+    would lose all of it. ``None`` when its strings cannot make it fit — the
+    excess is in the resource, the scope or the events.
+    """
+    attributes = dict(span.attributes or {})
+    for _ in range(_FIT_ATTEMPTS):
+        overshoot = size - MAX_EXPORT_BODY_BYTES
+        if overshoot <= 0:
+            return _with_attributes(span, attributes)
+        key, value = max(
+            (
+                (k, v)
+                for k, v in attributes.items()
+                if isinstance(v, str) and not k.endswith(".truncated")
+            ),
+            key=lambda item: len(item[1].encode("utf-8")),
+            default=(None, None),
+        )
+        if key is None or value is None:
+            return None
+        length = len(value.encode("utf-8"))
+        target = max(0, length - overshoot - 1024)
+        if key.startswith("gen_ai."):
+            cut, markers = gen_ai_shapes.truncate_attr(
+                value, attr=key, max_bytes=target
+            )
+        else:
+            cut, markers = gen_ai_shapes.truncate_plain(
+                value, attr=key, max_bytes=target
+            )
+        if cut is None:
+            cut = ""
+        if cut == value:
+            return None
+        attributes[key] = cut
+        # A value already cut keeps the size it had before the first cut.
+        markers.pop(f"{key}.original_size_bytes", None)
+        attributes.setdefault(f"{key}.original_size_bytes", length)
+        attributes.update(markers)
+        size = encode_spans([_with_attributes(span, attributes)]).ByteSize()
+    return None
+
+
+def _with_attributes(span: ReadableSpan, attributes: dict[str, Any]) -> ReadableSpan:
+    return ReadableSpan(
+        name=span.name,
+        context=span.get_span_context(),
+        parent=span.parent,
+        resource=span.resource,
+        attributes=attributes,
+        events=span.events,
+        links=span.links,
+        kind=span.kind,
+        status=span.status,
+        start_time=span.start_time,
+        end_time=span.end_time,
+        instrumentation_scope=span.instrumentation_scope,
+    )
+
+
 class TraceGrantError(Exception):
     """AMP could not authorize tracing; never downgrade a supplied credential."""
 
@@ -265,6 +335,18 @@ def _export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
             size = encode_spans(batch).ByteSize()
             if size > MAX_EXPORT_BODY_BYTES:
                 if len(batch) == 1:
+                    fitted = _fit_span(batch[0], size)
+                    if fitted is not None:
+                        logger.warning(
+                            "Execution trace span %r encoded to %d bytes, over "
+                            "Wharf's %d-byte request limit; its largest "
+                            "attributes were cut, each marked <attr>.truncated",
+                            batch[0].name,
+                            size,
+                            MAX_EXPORT_BODY_BYTES,
+                        )
+                        pending.append([fitted])
+                        continue
                     logger.warning(
                         "Skipping execution trace span: encoded size %d exceeds "
                         "Wharf's %d-byte request limit",
```

**File**: `lib/crewai/src/crewai/telemetry/tracing/handlers.py` (modified, +19/-3)
```diff
@@ -112,7 +112,7 @@
     SkillUsedEvent,
 )
 from crewai.tasks.output_format import OutputFormat
-from crewai.telemetry.tracing import semantic_conventions
+from crewai.telemetry.tracing import gen_ai_shapes, semantic_conventions
 from crewai.telemetry.tracing.context import (
     PendingSpanEnd,
     TelemetryExecutionContext,
@@ -589,9 +589,25 @@ def _task_output_format(task: Any, output: Any = None) -> str:
 
 
 def _set_span_attributes(span: Span, attributes: dict[str, Any]) -> None:
+    """Set ``attributes`` on ``span``, no string value over the export bound.
+
+    The ``gen_ai.*`` content attributes arrive already bounded (and marked),
+    message-aware, by ``semantic_conventions``; this catches every other
+    string — a task's ``crewai.task.output``, an MCP tool's ``crewai.mcp.tool_result``, a flow's
+    serialized state — with a plain cut (the head, up to the bound) so one
+    oversized value marks itself instead of making the whole span too large
+    for Wharf to accept, and is never reshaped as if it were a conversation.
+    """
     for key, value in attributes.items():
-        if value is not None:
-            span.set_attribute(key, value)
+        if value is None:
+            continue
+        if isinstance(value, str) and f"{key}.truncated" not in attributes:
+            value, markers = gen_ai_shapes.truncate_plain(value, attr=key)
+            for marker, marker_value in markers.items():
+                span.set_attribute(marker, marker_value)
+            if value is None:
+                continue
+        span.set_attribute(key, value)
 
 
 def _get_parent_context(
```

**File**: `lib/crewai/tests/telemetry/test_grant_export_bounds.py` (modified, +38/-3)
```diff
@@ -113,17 +113,52 @@ def test_exact_body_limit_and_oversized_span_preserve_fitting_neighbors(
     assert encode_spans([large]).ByteSize() == BODY_LIMIT + extra_bytes
     spans = [make_span(0), large, make_span(2)]
 
-    expected = SpanExportResult.FAILURE if extra_bytes else SpanExportResult.SUCCESS
-    assert exporter.export(spans) == expected
+    # One byte over is no longer a dropped span: its largest attribute is cut,
+    # marked, and the span is sent with its neighbours.
+    assert exporter.export(spans) == SpanExportResult.SUCCESS
 
     exported = [span for batch in exported_batches(delegate) for span in batch]
-    assert exported == ([spans[0], spans[2]] if extra_bytes else spans)
+    assert [span.context.span_id for span in exported] == [1, 2, 3]
     if extra_bytes:
+        fitted = exported[1]
+        assert fitted.attributes["gen_ai.input.messages.truncated"] is True
+        assert fitted.attributes[
+            "gen_ai.input.messages.original_size_bytes"
+        ] == BODY_LIMIT - overhead + extra_bytes
+        assert encode_spans([fitted]).ByteSize() <= BODY_LIMIT
         assert "3072001" in caplog.text and "3072000" in caplog.text
         assert "synthetic-grant" not in caplog.text
+    else:
+        assert exported == spans
     client.create.assert_not_called()
 
 
+def test_a_span_with_many_large_attributes_is_shrunk_not_dropped(
+    destination, caplog
+):
+    """Each attribute fits its own bound, the span does not fit a request: the
+    largest are cut, each marked, until it fits; nothing else changes."""
+    exporter, _, delegate = destination
+    attributes = {f"crewai.part.{i}": f"{i}" * 390_000 for i in range(9)}
+    attributes["crewai.task.name"] = "summary"
+    span = make_span(0, attributes=attributes)
+    assert encode_spans([span]).ByteSize() > BODY_LIMIT
+
+    assert exporter.export([span]) == SpanExportResult.SUCCESS
+
+    (fitted,) = [s for batch in exported_batches(delegate) for s in batch]
+    assert fitted.context == span.context and fitted.name == span.name
+    assert fitted.attributes["crewai.task.name"] == "summary"
+    cut = [k for k in attributes if fitted.attributes.get(f"{k}.truncated")]
+    assert cut
+    for key in cut:
+        assert fitted.attributes[f"{key}.original_size_bytes"] == 390_000
+        assert attributes[key].startswith(fitted.attributes[key])
+    for key in set(attributes) - set(cut):
+        assert fitted.attributes[key] == attributes[key]
+    assert "were cut" in caplog.text
+
+
 def test_oversized_metadata_returns_failure_without_sending(destination, caplog):
     exporter, _, delegate = destination
     span = make_span(
```

**File**: `lib/crewai/tests/telemetry/test_span_attribute_bound.py` (added, +403/-0)
```diff
@@ -0,0 +1,403 @@
+"""What a run produced reaches the exported span whole, up to one stated bound.
+
+A graded run of a flow could not be judged because the span carried a cut copy
+of a tool's result: a summary task had to report "the issue count and
+source_issue_ids exactly match the Linear results", and the grader saw 4 KB of
+a 33 KB result. Tool results, task outputs and LLM messages are what a reader
+of the trace checks the run against, so they now arrive whole up to
+``DEFAULT_MAX_ATTR_BYTES`` (sized to Wharf's request limit), and a value over
+it is cut as little as possible and says so — never silently.
+"""
+
+from __future__ import annotations
+
+from datetime import datetime, timezone
+import json
+
+from crewai import Agent, Crew, Task
+from crewai.events.types.task_events import TaskCompletedEvent, TaskStartedEvent
+from crewai.events.types.tool_usage_events import (
+    ToolUsageFinishedEvent,
+    ToolUsageStartedEvent,
+)
+from crewai.tasks.task_output import TaskOutput
+from crewai.telemetry.tracing import gen_ai_shapes, handlers, semantic_conventions
+from crewai.telemetry.tracing.context import TelemetryExecutionContext
+from crewai.telemetry.tracing.grants import MAX_EXPORT_BODY_BYTES
+from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
+from opentelemetry.sdk.trace import TracerProvider
+from opentelemetry.sdk.trace.export import SimpleSpanProcessor
+from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
+import pytest
+
+
+BOUND = gen_ai_shapes.DEFAULT_MAX_ATTR_BYTES
+
+
+def _text(size: int, label: str = "issue") -> str:
+    """Non-repeating text of about ``size`` bytes: a cut copy cannot compare equal."""
+    lines: list[str] = []
+    total = 0
+    i = 0
+    while total < size:
+        line = f'{{"id": "{label}-{i}", "title": "Linear issue number {i}"}}\n'
+        lines.append(line)
+        total += len(line)
+        i += 1
+    return "".join(lines)
+
+
+@pytest.fixture(autouse=True)
+def enable_otel_sdk(monkeypatch: pytest.MonkeyPatch) -> None:
+    """The suite otherwise runs with OTEL_SDK_DISABLED, which makes every
+    assertion here pass vacuously against non-recording spans."""
+    for name in (
+        "OTEL_SDK_DISABLED",
+        "CREWAI_DISABLE_TELEMETRY",
+        "CREWAI_DISABLE_TRACKING",
+        "CREWAI_OTEL_MAX_ATTR_BYTES",
+        "OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT",
+        "OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT",
+    ):
+        monkeypatch.delenv(name, raising=False)
+
+
+class _Providers:
+    def __init__(self, tracer) -> None:
+        self._tracer = tracer
+
+    def get_tracer(self, name: str | None = None):
+        return self._tracer
+
+    def emit_log(self, *args, **kwargs) -> None:
+        pass
+
+
+def _pipeline():
+    """Built inside each test, after any env change: the SDK reads its span
+    limits when the provider is constructed."""
+    exporter = InMemorySpanExporter()
+    provider = TracerProvider()
+    provider.add_span_processor(SimpleSpanProcessor(exporter))
+    tracer = provider.get_tracer("test")
+    ctx = TelemetryExecutionContext(
+        kickoff_id="kickoff", automation_name="test", tracer=tracer
+    )
+    return provider, _Providers(tracer), ctx, exporter
+
+
+def _only_span(exporter: InMemorySpanExporter, name: str):
+    matches = [s for s in exporter.get_finished_spans() if s.name == name]
+    assert len(matches) == 1, [s.name for s in exporter.get_finished_spans()]
+    return matches[0]
+
+
+def _tool_span(result: str):
+    provider, providers, ctx, exporter = _pipeline()
+    now = datetime.now(timezone.utc)
+    args = {"query": "issues in cycle 42"}
+    started = ToolUsageStartedEvent(
+        tool_name="linear_run_query", tool_args=args, agent_key="k", agent_role="r"
+    )
+    handlers.handle_tool_usage_started(providers, ctx, None, started)
+    handlers.handle_tool_usage_finished(
+        providers,
+        ctx,
+        None,
+        ToolUsageFinishedEvent(
+            tool_name="linear_run_query",
+            tool_args=args,
+            agent_key="k",
+            agent_role="r",
+            started_at=now,
+            finished_at=now,
+            output=result,
+            started_event_id=started.event_id,
+        ),
+    )
+    span = _only_span(exporter, "call tool")
+    provider.shutdown()
+    return span
+
+
+@pytest.mark.parametrize("size", [50_000, 300_000], ids=["50KB", "300KB"])
+def test_a_tool_result_arrives_whole(size: int) -> None:
+    result = _text(size)
+
+    span = _tool_span(result)
+
+    assert json.loads(span.attributes["gen_ai.tool.call.result"]) == result
+    assert "gen_ai.tool.call.result.truncated" not in span.attributes
+
+
+def test_a_tool_result_over_the_bound_is_cut_with_the_marker_and_its_size() -> None:
+    result = _text(BOUND + 200_000)
+    original = len(json.dumps(result).encode("utf-8"))
+
+    span = _tool_span(result)
+
+    payload = span.attributes["gen_ai.tool.call.re
```

**File**: `lib/crewai/tests/telemetry/test_span_task_agent_tool_attributes.py` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@
 
 
 # Long and non-repeating, so a truncated or elided copy cannot compare equal.
-# Under the default 32 KiB attribute cap, so it must arrive whole.
+# Under the default attribute bound, so it must arrive whole.
 LONG_TEXT = "".join(
     f"paragraph {i}: the quick brown fox jumps over the lazy dog\n" for i in range(400)
 )
```

---

### Incident Patch 5: `ca1d55ab` (2026-10-01)
**Commit Message**: fix(tracing): a refused trace grant runs the crew untraced instead of failing it (#7812)

* fix(tracing): a refused trace grant runs the crew untraced instead of failing it

An authenticated run asks AMP for a trace grant as it starts, and a refusal
raised out of `begin_execution` — so when a `crewai login` expired or a token
was revoked, every traced crew and flow failed with "AMP trace grant request
failed (HTTP 401)" before it did any work. A trace is a record of the run, not
a condition of it.

Now the run goes on untraced and logs one warning naming the fix: for a 401/403,
"Run `crewai login` again to trace your runs"; otherwise that the run itself is
unaffected. It never falls back to an anonymous upload of a logged-in user's run
(the grant client's "never downgrade a supplied credential" still holds). The
test that pinned the raise now pins the run completing, the context restored,
nothing uploaded, and the warning.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(tracing): name the credential AMP refused, not always the saved login

`tracing_credential()` sends CREWAI_USER_PAT first, then the platform
integration token, then the saved `crewai login` —

**File**: `lib/crewai/src/crewai/execution.py` (modified, +57/-5)
```diff
@@ -18,6 +18,7 @@
 from contextlib import ExitStack
 import contextvars
 from dataclasses import dataclass
+import logging
 import os
 import sys
 from types import TracebackType
@@ -29,6 +30,9 @@
     from crewai.telemetry.tracing.session import TraceSession
 
 
+logger = logging.getLogger(__name__)
+
+
 @dataclass
 class ExecutionTrace:
     """Trace lifetime that can be rebound between deferred conversational turns."""
@@ -143,22 +147,38 @@ def _start_tracing(execution_uuid: str, tracing: bool | None) -> None:
     from crewai.telemetry.tracing.grants import (
         GrantSpanExporter,
         TraceGrantClient,
-        tracing_credential,
+        resolve_tracing_credential,
     )
     from crewai.telemetry.tracing.session import TraceSession
 
     stack = ExitStack()
     # First-run discovery is local even if CLI credentials happen to exist.
-    amp_credential = tracing_credential() if enabled else None
-    if amp_credential is None:
+    # The credential and its source are resolved ONCE: the pair that is sent is
+    # the pair a refusal names, whatever the environment says afterwards.
+    resolved = resolve_tracing_credential() if enabled else None
+    if resolved is None:
         from crewai.telemetry.tracing.ephemeral import ephemeral_tracing
 
         session = stack.enter_context(
             ephemeral_tracing(execution_uuid, first_time=not enabled)
         )
     else:
-        client = TraceGrantClient(amp_credential)
-        grant = client.create(execution_uuid)
+        from crewai.telemetry.tracing.grants import TraceGrantError
+
+        credential_source, amp_credential = resolved
+        try:
+            # The constructor refuses a blank credential with the same error, so
+            # it sits inside the same boundary as the grant request.
+            client = TraceGrantClient(amp_credential)
+            grant = client.create(execution_uuid)
+        except TraceGrantError as error:
+            # A trace is a record of the run, not a condition of it: a login
+            # that expired or a token that was revoked must not take the run
+            # down with it. The run goes on untraced and says so — never falls
+            # back to an anonymous upload of a run whose owner is logged in.
+            logger.warning(_untraced_because(error, credential_source))
+            stack.close()
+            return
         exporter = GrantSpanExporter(client, grant)
         session = TraceSession(grant.execution_uuid, [exporter])
 
@@ -170,6 +190,38 @@ def finish_authenticated_trace() -> None:
     _activate_tracing(ExecutionTrace(session, stack))
 
 
+# What each credential is called, and what fixes it when AMP refuses it: the one
+# that was sent, never a different one — refreshing a login does nothing for a
+# rejected CREWAI_USER_PAT.
+_CREDENTIAL_FIX = {
+    "pat": (
+        "the CREWAI_USER_PAT token",
+        "Replace it with a valid personal access token",
+    ),
+    "integration": (
+        "the platform integration token",
+        "Check the integration token this environment is given",
+    ),
+    "login": ("the saved login", "Run `crewai login` again"),
+}
+
+
+def _untraced_because(error: Exception, source: str | None) -> str:
+    """The warning for a run AMP would not grant a trace to, naming the
+    credential it refused and the fix for that one."""
+    status = getattr(error, "status_code", None)
+    if status in (401, 403):
+        name, fix = _CREDENTIAL_FIX.get(source or "", ("the credential", "Check it"))
+        return (
+            f"This run is not traced: CrewAI AMP refused {name} (HTTP {status}). "
+            f"{fix} to trace your runs."
+        )
+    return (
+        f"This run is not traced: CrewAI AMP could not grant a trace "
+        f"({f'HTTP {status}' if status else error}). The run itself is unaffected."
+    )
+
+
 def _activate_tracing(tracing: ExecutionTrace) -> None:
     activation = ExitStack()
     activation.enter_context(tracing.session.activate())
```

**File**: `lib/crewai/src/crewai/telemetry/tracing/grants.py` (modified, +25/-3)
```diff
@@ -47,14 +47,36 @@ def __init__(self, message: str, status_code: int | None = None):
 
 def tracing_credential() -> str | None:
     """Resolve an explicit PAT, integration credential, or saved CLI login."""
+    resolved = resolve_tracing_credential()
+    return resolved[1] if resolved else None
+
+
+def tracing_credential_source() -> str | None:
+    """Which credential ``tracing_credential`` sends: ``"pat"``
+    (``CREWAI_USER_PAT``), ``"integration"`` (the platform integration token)
+    or ``"login"`` (the saved ``crewai login``) — so a refusal can name the one
+    that failed instead of sending somebody to refresh another."""
+    resolved = resolve_tracing_credential()
+    return resolved[0] if resolved else None
+
+
+def resolve_tracing_credential() -> tuple[str, str] | None:
+    """The credential tracing sends and where it came from, as ``(source,
+    token)`` — read once, in the one order both functions above follow.
+
+    A caller that sends the token and may later explain a refusal keeps this
+    pair: resolving the source again after the request can name a credential
+    AMP never saw (the environment or the context may have changed meanwhile).
+    """
     if token := os.getenv("CREWAI_USER_PAT"):
-        return token
+        return "pat", token
     if token := get_platform_integration_token():
-        return token
+        return "integration", token
     try:
-        return get_auth_token()
+        token = get_auth_token()
     except AuthError:
         return None
+    return ("login", token) if token else None
 
 
 @dataclass(frozen=True)
```

**File**: `lib/crewai/tests/telemetry/test_session_trace_export.py` (modified, +2/-2)
```diff
@@ -711,9 +711,9 @@ def test_first_time_execution_uses_local_session_even_with_saved_credentials(
         "crewai.events.listeners.tracing.utils.should_auto_collect_first_time_traces",
         lambda: True,
     )
-    credential = Mock(return_value="saved-login")
+    credential = Mock(return_value=("login", "saved-login"))
     monkeypatch.setattr(
-        "crewai.telemetry.tracing.grants.tracing_credential", credential
+        "crewai.telemetry.tracing.grants.resolve_tracing_credential", credential
     )
     save = Mock()
     monkeypatch.setattr(ephemeral, "update_user_data", save)
```

**File**: `lib/crewai/tests/telemetry/test_trace_lifecycle.py` (modified, +108/-5)
```diff
@@ -19,6 +19,9 @@
     GrantSpanExporter,
     TraceGrantClient,
     TraceGrantError,
+    resolve_tracing_credential,
+    tracing_credential,
+    tracing_credential_source,
 )
 from opentelemetry import trace
 from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
@@ -322,15 +325,115 @@ def test_explicit_disable_prevents_first_time_collection(monkeypatch, disabled):
 
 
 @pytest.mark.parametrize("async_run", [False, True])
-def test_grant_failure_restores_execution_context(monkeypatch, async_run):
+@pytest.mark.parametrize(
+    ("status", "says"),
+    [
+        (401, "refused the CREWAI_USER_PAT token (HTTP 401)"),
+        (403, "Replace it with a valid personal access token"),
+        (503, "unaffected"),
+    ],
+)
+def test_a_refused_grant_runs_untraced_and_says_why(
+    monkeypatch, caplog, async_run, status, says
+):
+    """A trace is a record of the run, not a condition of it: an expired login
+    must not fail the crew. The run completes, nothing is uploaded, the context
+    is restored, and the warning names the fix."""
     monkeypatch.setenv("CREWAI_USER_PAT", "invalid")
+    create = Mock(side_effect=TraceGrantError("AMP rejected credential", status))
+    monkeypatch.setattr(TraceGrantClient, "create", create)
+    exporter = Mock(return_value=InMemorySpanExporter())
+    monkeypatch.setattr(GrantSpanExporter, "_exporter", staticmethod(exporter))
+
+    with caplog.at_level("WARNING", logger="crewai.execution"):
+        flow = ExampleFlow(tracing=True)
+        result = asyncio.run(flow.kickoff_async()) if async_run else flow.kickoff()
+
+    assert result == "hello world"
+    create.assert_called_once()
+    exporter.assert_not_called()
+    assert get_trace_session() is None and get_execution_uuid() is None
+    assert any(says in record.getMessage() for record in caplog.records)
+
+
+@pytest.mark.parametrize(
+    ("source", "says", "never"),
+    [
+        ("pat", "refused the CREWAI_USER_PAT token", "crewai login"),
+        ("integration", "refused the platform integration token", "crewai login"),
+        ("login", "refused the saved login (HTTP 401). Run `crewai login` again", "CREWAI_USER_PAT"),
+    ],
+)
+def test_the_warning_names_the_credential_that_was_refused(
+    monkeypatch, caplog, source, says, never
+):
+    """The fix named is for the credential that was sent: refreshing a login does
+    nothing for a rejected CREWAI_USER_PAT or an integration token."""
+    grants = "crewai.telemetry.tracing.grants"
+    monkeypatch.setattr(
+        f"{grants}.resolve_tracing_credential", lambda: (source, "rejected")
+    )
     monkeypatch.setattr(
         TraceGrantClient,
         "create",
         Mock(side_effect=TraceGrantError("AMP rejected credential", 401)),
     )
-    with pytest.raises(TraceGrantError) as error:
-        flow = ExampleFlow(tracing=True)
-        asyncio.run(flow.kickoff_async()) if async_run else flow.kickoff()
-    assert error.value.status_code == 401
+
+    with caplog.at_level("WARNING", logger="crewai.execution"):
+        assert ExampleFlow(tracing=True).kickoff() == "hello world"
+
+    warning = next(r.getMessage() for r in caplog.records if "not traced" in r.getMessage())
+    assert says in warning and never not in warning
+
+
+def test_the_credential_source_follows_the_credential_order(monkeypatch):
+    grants = "crewai.telemetry.tracing.grants"
+    monkeypatch.setenv("CREWAI_USER_PAT", "pat")
+    assert tracing_credential_source() == "pat"
+    monkeypatch.delenv("CREWAI_USER_PAT")
+    monkeypatch.setattr(f"{grants}.get_platform_integration_token", lambda: "integration")
+    assert tracing_credential_source() == "integration"
+    monkeypatch.setattr(f"{grants}.get_platform_integration_token", lambda: None)
+    monkeypatch.setattr(f"{grants}.get_auth_token", lambda: "login")
+    assert tracing_credential_source() == "login"
+    assert tracing_credential() == "login"
+    assert resolve_tracing_credential() == ("login", "login")
+
+
+def test_the_warning_names_the_credential_that_was_sent_not_the_one_left_after(
+    monkeypatch, caplog
+):
+    """The credential and its source are read once: a PAT that disappears while
+    the grant request is in flight is still the one the warning names, never
+    the integration token the environment falls back to afterwards."""
+    grants = "crewai.telemetry.tracing.grants"
+    monkeypatch.setenv("CREWAI_USER_PAT", "rejected-pat")
+    monkeypatch.setattr(f"{grants}.get_platform_integration_token", lambda: "integration")
+    sent = []
+
+    def refuse(client, execution_uuid):
+        sent.append(client._api.api_key)
+        monkeypatch.delenv("CREWAI_USER_PAT")
+        raise TraceGrantError("AMP rejected credential", 401)
+
+    monkeypatch.setattr(TraceGrantClient, "create", refuse)
+    with caplog.at_level("WARNING", logger="crewai.execution"):
+        assert ExampleFlow(tracing=True).kickoff() == "hello world"
+
+    warning = next(r.getMe
```

**File**: `lib/crewai/tests/tracing/test_tracing.py` (modified, +3/-3)
```diff
@@ -86,8 +86,8 @@ def trace_transport(self, monkeypatch):
         transport = SimpleNamespace(grants=[], exporter=InMemorySpanExporter())
         monkeypatch.setenv("OTEL_SDK_DISABLED", "false")
         monkeypatch.setattr(
-            "crewai.telemetry.tracing.grants.tracing_credential",
-            lambda: "synthetic-login",
+            "crewai.telemetry.tracing.grants.resolve_tracing_credential",
+            lambda: ("login", "synthetic-login"),
         )
 
         def grant(client, execution_uuid):
@@ -441,7 +441,7 @@ def start(self):
     def test_trace_listener_ephemeral_batch(self, trace_transport, monkeypatch):
         """Unauthenticated kickoff uploads buffered spans only after consent."""
         monkeypatch.setattr(
-            "crewai.telemetry.tracing.grants.tracing_credential", lambda: None
+            "crewai.telemetry.tracing.grants.resolve_tracing_credential", lambda: None
         )
         monkeypatch.setenv("CREWAI_TRACING_ENABLED", "true")
 
```

---

### Incident Patch 6: `b6bfae60` (2026-10-01)
**Commit Message**: fix(deps): bump litellm to 1.88.6 for GHSA-3cv6-jpf6-8222 (#7835)

litellm <1.88.6 has GHSA-3cv6-jpf6-8222 (CVE-2026-84377): authenticated
SSRF and provider-credential exfiltration via unvalidated request-body
routing parameters in the LiteLLM proxy server. crewAI uses litellm as a
client SDK and never runs the proxy, but pip-audit flags the package and
fails the vulnerability scan on every PR.

- lib/crewai/pyproject.toml: crewai[litellm] floor litellm>=1.84.0 -> >=1.88.6
- pyproject.toml: advisory comment beside the other overrides
- uv.lock: litellm 1.84.8 -> 1.88.6; nothing else moved (same dependency set)

1.88.6 (2026-08-09) is older than the 3-day exclude-newer cutoff, so no
exclude-newer-package override is needed.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `lib/crewai/pyproject.toml` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ voyageai = [
     "voyageai~=0.3.5",
 ]
 litellm = [
-    "litellm>=1.84.0,<2",
+    "litellm>=1.88.6,<2",
 ]
 bedrock = [
     "boto3~=1.43.46",
```

**File**: `pyproject.toml` (modified, +5/-0)
```diff
@@ -262,6 +262,11 @@ exclude-newer-package = { msgpack = "2026-06-20T00:00:00Z", pydantic-settings =
 # fixed in 4.7.1. Declared as crewai-tools[snowflake] "snowflake-connector-python>=3.12.4",
 # which the lock resolved to 4.6.0.
 # soupsieve <=2.8.4 has GHSA-j934-xhv5-fg8f and GHSA-gjv8-xp57-g29c; force 2.9.2+.
+# litellm <1.88.6 has GHSA-3cv6-jpf6-8222 (CVE-2026-84377; authenticated SSRF and provider-credential
+# exfiltration via request-body routing parameters in the LiteLLM proxy server; crewAI uses litellm only as
+# a client SDK, but pip-audit flags the package). The floor lives in lib/crewai/pyproject.toml (the
+# crewai[litellm] extra, "litellm>=1.88.6,<2") rather than here, since crewai declares litellm directly.
+# 1.88.6 is older than the global 3-day cutoff, so no exclude-newer-package override is needed.
 # Keep OpenAI on the SDK range required by CrewAI when transitive dependencies
 # loosen or pin their own lower versions.
 override-dependencies = [
```

**File**: `uv.lock` (modified, +4/-4)
```diff
@@ -1558,7 +1558,7 @@ requires-dist = [
     { name = "json5", specifier = "~=0.10.0" },
     { name = "jsonref", specifier = "~=1.1.0" },
     { name = "lancedb", specifier = ">=0.29.2,<0.30.1" },
-    { name = "litellm", marker = "extra == 'litellm'", specifier = ">=1.84.0,<2" },
+    { name = "litellm", marker = "extra == 'litellm'", specifier = ">=1.88.6,<2" },
     { name = "mcp", specifier = "~=1.28.1" },
     { name = "mem0ai", marker = "extra == 'mem0'", specifier = ">=2.0.0,<3" },
     { name = "openai", specifier = ">=2.30.0,<3" },
@@ -4271,7 +4271,7 @@ wheels = [
 
 [[package]]
 name = "litellm"
-version = "1.84.8"
+version = "1.88.6"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "aiohttp" },
@@ -4287,9 +4287,9 @@ dependencies = [
     { name = "tiktoken" },
     { name = "tokenizers" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/b4/2c/eda7995bc9d6a7277be409a317893df52a25131a21ed572651a3c27ac20e/litellm-1.84.8.tar.gz", hash = "sha256:5a6349ce1c153fc27c9b1f88c39a396779c30af16704d9ef3633ccb24d04d374", size = 15117432, upload-time = "2026-06-13T01:25:25.125Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/f4/a6/d2312da4d65390f0d899a669731500983c8a10bd89009657680949c5766d/litellm-1.88.6.tar.gz", hash = "sha256:07d947dfe92f137d5296c40285dbcf97cb405b4300d73c0feda48d76468d6eb4", size = 13889078, upload-time = "2026-08-09T00:06:33.818Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/12/9b/70a4f3378130564505046e94ce521363f50d075198e16b7663b66b11eb23/litellm-1.84.8-py3-none-any.whl", hash = "sha256:297b81d56b3fdfc39411b0330edce0f29a4b2e82e90d5f73efdc102b57cb45e7", size = 16747828, upload-time = "2026-06-13T01:25:12.964Z" },
+    { url = "https://files.pythonhosted.org/packages/f7/0b/2e42b95ccca2e2a8a524808e9c414f70a0352165dac589efa01192afb8ba/litellm-1.88.6-py3-none-any.whl", hash = "sha256:8c01f7e9aebded5b3509128be648518a2ec4f1feb8dfb87a539895091651898b", size = 15271205, upload-time = "2026-08-09T00:06:30.607Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 7: `fad444da` (2026-10-01)
**Commit Message**: chore(deps): bump the security-updates group across 1 directory with 2 updates (#7832)

Bumps the security-updates group with 2 updates in the / directory: [chromadb](https://github.com/chroma-core/chroma) and [accelerate](https://github.com/huggingface/accelerate).


Updates `chromadb` from 1.1.1 to 1.5.9
- [Release notes](https://github.com/chroma-core/chroma/releases)
- [Changelog](https://github.com/chroma-core/chroma/blob/main/RELEASE_PROCESS.md)
- [Commits](https://github.com/chroma-core/chroma/compare/1.1.1...1.5.9)

Updates `accelerate` from 1.13.0 to 1.15.0
- [Release notes](https://github.com/huggingface/accelerate/releases)
- [Commits](https://github.com/huggingface/accelerate/compare/v1.13.0...v1.15.0)

---
updated-dependencies:
- dependency-name: chromadb
  dependency-version: 1.5.9
  dependency-type: direct:production
  dependency-group: security-updates
- dependency-name: accelerate
  dependency-version: 1.15.0
  dependency-type: indirect
  dependency-group: security-updates
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `lib/crewai/pyproject.toml` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ dependencies = [
     "opentelemetry-sdk>=1.42,<2",
     "opentelemetry-exporter-otlp-proto-http>=1.42,<2",
     # Data Handling
-    "chromadb~=1.1.0",
+    "chromadb~=1.5.9",
     "tokenizers>=0.21,<1",
     "openpyxl~=3.1.5",
     # Authentication and Security
```

**File**: `uv.lock` (modified, +314/-314)
```diff
@@ -21,8 +21,8 @@ exclude-newer = "0001-01-01T00:00:00Z" # This has no effect and is included for
 exclude-newer-span = "P3D"
 
 [options.exclude-newer-package]
-msgpack = "2026-06-20T00:00:00Z"
 langsmith = "2026-06-20T00:00:00Z"
+msgpack = "2026-06-20T00:00:00Z"
 pydantic-settings = "2026-06-20T00:00:00Z"
 
 [manifest]
@@ -115,7 +115,7 @@ wheels = [
 
 [[package]]
 name = "accelerate"
-version = "1.13.0"
+version = "1.15.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "huggingface-hub" },
@@ -127,9 +127,9 @@ dependencies = [
     { name = "safetensors" },
     { name = "torch" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/ca/14/787e5498cd062640f0f3d92ef4ae4063174f76f9afd29d13fc52a319daae/accelerate-1.13.0.tar.gz", hash = "sha256:d631b4e0f5b3de4aff2d7e9e6857d164810dfc3237d54d017f075122d057b236", size = 402835, upload-time = "2026-03-04T19:34:12.359Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/f5/b5/1d3ed029ac71d3f2961346829a268da923698e9fd63f218f78841f216bfd/accelerate-1.15.0.tar.gz", hash = "sha256:5654f8c5eaa0d4fa68b33e287a97765da6849bf6d51dcac874e73fbbddfb6134", size = 422615, upload-time = "2026-09-09T13:04:49.078Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/7e/46/02ac5e262d4af18054b3e922b2baedbb2a03289ee792162de60a865defc5/accelerate-1.13.0-py3-none-any.whl", hash = "sha256:cf1a3efb96c18f7b152eb0fa7490f3710b19c3f395699358f08decca2b8b62e0", size = 383744, upload-time = "2026-03-04T19:34:10.313Z" },
+    { url = "https://files.pythonhosted.org/packages/8a/4c/34f0450479d01195027260da68d8a3880683f1640c3ca5adf64acb3185f1/accelerate-1.15.0-py3-none-any.whl", hash = "sha256:97eacca0b73e45cb867dbf8c5d5d4dc32219544300e0c8992c7334dc2ef33cec", size = 394295, upload-time = "2026-09-09T13:04:47.331Z" },
 ]
 
 [[package]]
@@ -668,8 +668,8 @@ resolution-markers = [
     "python_full_version < '3.11' and platform_machine == 's390x'",
 ]
 dependencies = [
-    { name = "soupsieve", marker = "python_full_version < '3.11'" },
-    { name = "typing-extensions", marker = "python_full_version < '3.11'" },
+    { name = "soupsieve" },
+    { name = "typing-extensions" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/85/2e/3e5079847e653b1f6dc647aa24549d68c6addb4c595cc0d902d1b19308ad/beautifulsoup4-4.13.5.tar.gz", hash = "sha256:5e70131382930e7c3de33450a2f54a63d5e4b19386eab43a5b34d594268f3695", size = 622954, upload-time = "2025-08-24T14:06:13.168Z" }
 wheels = [
@@ -693,8 +693,8 @@ resolution-markers = [
     "python_full_version == '3.11.*' and platform_machine == 's390x' and sys_platform == 'win32'",
 ]
 dependencies = [
-    { name = "soupsieve", marker = "python_full_version >= '3.11'" },
-    { name = "typing-extensions", marker = "python_full_version >= '3.11'" },
+    { name = "soupsieve" },
+    { name = "typing-extensions" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/43/65/318323f98dbee45d42dff61d8f047181bc6f2268a9068cfad035a46be5af/beautifulsoup4-4.15.0.tar.gz", hash = "sha256:288e3ca7d54b06f2ac191970bc275c1939cb46d450b255bf6718b04aa37ab4f7", size = 632571, upload-time = "2026-06-07T16:44:20.453Z" }
 wheels = [
@@ -725,7 +725,7 @@ name = "blis"
 version = "1.3.3"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "numpy", version = "2.4.6", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.11'" },
+    { name = "numpy", version = "2.4.6", source = { registry = "https://pypi.org/simple" } },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/d0/d0/d8cc8c9a4488a787e7fa430f6055e5bd1ddb22c340a751d9e901b82e2efe/blis-1.3.3.tar.gz", hash = "sha256:034d4560ff3cc43e8aa37e188451b0440e3261d989bb8a42ceee865607715ecd", size = 2644873, upload-time = "2025-11-17T12:28:30.511Z" }
 wheels = [
@@ -1075,7 +1075,7 @@ wheels = [
 
 [[package]]
 name = "chromadb"
-version = "1.1.1"
+version = "1.5.9"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "bcrypt" },
@@ -1094,9 +1094,9 @@ dependencies = [
     { name = "opentelemetry-sdk" },
     { name = "orjson" },
     { name = "overrides" },
-    { name = "posthog" },
     { name = "pybase64" },
     { name = "pydantic" },
+    { name = "pydantic-settings" },
     { name = "pypika" },
     { name = "pyyaml" },
     { name = "rich" },
@@ -1107,13 +1107,13 @@ dependencies = [
     { name = "typing-extensions" },
     { name = "uvicorn", extra = ["standard"] },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/7f/48/11851dddeadad6abe36ee071fedc99b5bdd2c324df3afa8cb952ae02798b/chromadb-1.1.1.tar.gz", hash = "sha256:ebfce0122753e306a76f1e291d4ddaebe5f01b5979b97ae0bc80b1d4024ff223", size = 1338109, upload-time = "2025-10-05T02:49:14.834Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/92/d1/5e33b26985f0c7046a0be1cee2158ada1748ee700d2545057fde1468d74d/chromadb-1.5.9.tar.gz", hash = "sha256:5c20e62a455c28bacac927f26116a73fd8e1799e0d9
```

---

### Incident Patch 8: `243e8199` (2026-09-29)
**Commit Message**: fix(tracing): report tracing sent usage from the grant exporter (#7810)

Since 1.15.22 every crew and flow kickoff owns an execution uuid, so the
legacy TraceBatchManager handlers never finalize a batch and the
`tracing:ephemeral_sent` / `tracing:authenticated_sent` Feature Usage
events stopped. Emit them from GrantSpanExporter.record_export, the point
both upload tiers reach once every span has arrived.

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `lib/crewai/src/crewai/telemetry/tracing/grants.py` (modified, +6/-1)
```diff
@@ -27,6 +27,7 @@
     is_tui_mode,
     should_suppress_tracing_messages,
 )
+from crewai.telemetry.telemetry import Telemetry
 from crewai.telemetry.tracing import last_run
 from crewai.telemetry.tracing.session import MAX_EXPORT_BATCH_SIZE, otlp_exporter
 
@@ -293,15 +294,19 @@ def record_export(self) -> None:
             self._recorded = True
             execution_uuid = self._grant.execution_uuid
             api = getattr(self._client, "_api", None)
+            tier = getattr(self._client, "_tier", None)
             last_run.record_last_run(
                 execution_id=execution_uuid,
-                tier=getattr(self._client, "_tier", None),
+                tier=tier,
                 started_at_ns=self._first_start_ns,
                 finished_at_ns=self._last_end_ns,
                 amp_base_url=getattr(api, "base_url", None),
                 trace_url=self._trace_url,
             )
             logger.debug("Traces exported for execution %s", execution_uuid)
+            # Counts that a trace reached AMP, never its contents. The legacy
+            # TraceBatchManager emits the same names for runs outside a kickoff.
+            Telemetry().feature_usage_span(f"tracing:{tier}_sent")
             self._show_trace_link()
 
     def _show_trace_link(self) -> None:
```

**File**: `lib/crewai/tests/telemetry/test_session_trace_export.py` (modified, +139/-0)
```diff
@@ -847,3 +847,142 @@ def test_invalid_buffer_limits_use_safe_defaults(monkeypatch, invalid):
     buffer = EphemeralSpanBuffer()
     assert buffer._max_spans == 1000 and buffer._max_bytes == 8388608
     buffer.shutdown()
+
+
+@pytest.fixture
+def sent_features(monkeypatch):
+    """The `tracing:*` Feature Usage names emitted, in order."""
+    from crewai.telemetry.telemetry import Telemetry
+
+    features = []
+    monkeypatch.setattr(
+        Telemetry,
+        "feature_usage_span",
+        lambda self, feature: features.append(feature)
+        if feature.startswith("tracing:")
+        else None,
+    )
+    return features
+
+
+@pytest.mark.parametrize(
+    ("authenticated", "approved", "grant_status", "export_status", "expected"),
+    [
+        (True, True, 200, 200, ["tracing:authenticated_sent"]),
+        (False, True, 200, 200, ["tracing:ephemeral_sent"]),
+        (False, False, 200, 200, []),
+        (True, True, 200, 401, []),
+        (False, True, 200, 401, []),
+        (False, True, 500, 200, []),
+    ],
+)
+def test_a_trace_that_reaches_amp_is_counted_once_by_tier(
+    collector,
+    sent_features,
+    monkeypatch,
+    authenticated,
+    approved,
+    grant_status,
+    export_status,
+    expected,
+):
+    """Declined consent, a refused grant, or a rejected export never counts."""
+    from crewai.execution import begin_execution, end_execution
+    from crewai.telemetry.tracing.context import get_trace_session
+
+    collector.grant_status = grant_status
+    collector.export_status = export_status
+    if authenticated:
+        monkeypatch.setenv("CREWAI_USER_PAT", "synthetic-pat")
+
+    def run():
+        with trace_consent(lambda: approved):
+            token = begin_execution(tracing=True)
+            try:
+                record(get_trace_session())
+                nested = begin_execution(tracing=True)
+                end_execution(nested)
+            finally:
+                end_execution(token)
+
+    copy_context().run(run)
+    assert sent_features == expected
+
+
+def test_a_deferred_run_is_counted_once_when_it_finally_ends(
+    collector, sent_features, monkeypatch
+):
+    from crewai.execution import begin_execution, end_execution
+    from crewai.telemetry.tracing.context import get_trace_session
+
+    monkeypatch.setenv("CREWAI_USER_PAT", "synthetic-pat")
+    token = begin_execution(tracing=True)
+    try:
+        session = get_trace_session()
+        record(session)
+        session.flush()
+    finally:
+        lifetime = end_execution(token, defer=True)
+    assert sent_features == []  # spans reached AMP, but the run is not over
+
+    token = begin_execution(tracing=True, trace_session=lifetime)
+    try:
+        record(get_trace_session(), "second turn")
+    finally:
+        end_execution(token)
+    assert sent_features == ["tracing:authenticated_sent"]
+
+
+def test_recording_the_same_export_twice_counts_it_once(collector, sent_features):
+    client = TraceGrantClient(None)
+    grant = client.create(str(uuid4()))
+    exporter = GrantSpanExporter(client, grant)
+    session = TraceSession(grant.execution_uuid, [exporter])
+    try:
+        record(session)
+    finally:
+        session.shutdown()
+    exporter.record_export()
+    exporter.record_export()
+    assert sent_features == ["tracing:ephemeral_sent"]
+
+
+def test_a_truncated_ephemeral_trace_is_not_counted(
+    collector, sent_features, monkeypatch
+):
+    """It is uploaded, but like the `crewai eval` record it is not a whole run."""
+    monkeypatch.setenv("CREWAI_EPHEMERAL_TRACE_MAX_SPANS", "1")
+    with trace_consent(lambda: True), ephemeral_tracing(str(uuid4())) as session:
+        record(session, "first")
+        record(session, "second")
+    assert len(collector.batches) == 1
+    assert sent_features == []
+
+
+@pytest.mark.parametrize("authenticated", [True, False])
+@pytest.mark.parametrize("use_async", [False, True])
+def test_a_flow_kickoff_counts_its_trace(
+    collector, sent_features, monkeypatch, authenticated, use_async
+):
+    from crewai.flow.flow import Flow, start
+
+    if authenticated:
+        monkeypatch.setenv("CREWAI_USER_PAT", "synthetic-pat")
+
+    class Greeting(Flow):
+        @start()
+        def greet(self):
+            return "hello"
+
+    def run():
+        with trace_consent(lambda: True):
+            flow = Greeting(tracing=True)
+            if use_async:
+                return asyncio.run(flow.kickoff_async())
+            return flow.kickoff()
+
+    assert copy_context().run(run) == "hello"
+    assert collector.batches
+    assert sent_features == [
+        "tracing:authenticated_sent" if authenticated else "tracing:ephemeral_sent"
+    ]
```

---

### Incident Patch 9: `19d2ebcc` (2026-09-29)
**Commit Message**: fix(cli): crewai eval exits 1 unless the gate passed, and says to log in when nothing was traced unattended (#7806)

* fix(cli): `crewai eval` exits 1 unless the gate passed, and says to log in when nothing was traced unattended

The exit code is what a CI job reads, and it said only whether the evaluation
finished: a run whose goal gate FAILED exited 0, so a pipeline gating on
`crewai eval` waved it through. It is the gate's now — 0 only for PASSED; a
failed gate, one without a verdict, and an evaluation that stopped are 1. The
command's help says so.

With no terminal and no login, an anonymous run's trace stays on the machine
even with tracing on (nobody is there to approve the upload). `crewai eval` then
told the user to turn tracing on, which they had — the same loop again. When
tracing is on and nobody is logged in, it now says what traces an unattended
run: `crewai login`.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(cli): an unreadable login is the reason given when nothing was traced unattended

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(cli): print the unattended reason as text, never markup

Co-Authored-By: Claude Op

**File**: `lib/cli/src/crewai_cli/cli.py` (modified, +5/-1)
```diff
@@ -693,7 +693,11 @@ def run(
     ),
 )
 def eval_command(run_id: str | None) -> None:
-    """Evaluate the last traced run through CrewAI AMP."""
+    """Evaluate the last traced run through CrewAI AMP.
+
+    Exits 0 only when the goal gate PASSED, and 1 otherwise — a failed gate, no
+    verdict, or an evaluation that could not run — so a CI job can gate on it.
+    """
     eval_crew(run_id=run_id)
 
 
```

**File**: `lib/cli/src/crewai_cli/experimental/eval_crew.py` (modified, +39/-2)
```diff
@@ -168,10 +168,19 @@ def eval_crew(run_id: str | None = None) -> None:
         raise SystemExit(130) from None
     _print_verdict(finished, url)
     _say_where_the_criteria_live(write_eval_config(finished))
-    if finished.get("status") != "done":
+    # The exit code is what a CI job reads, so it is the gate's: 0 only for a
+    # run that PASSED. A failed gate, one without a verdict, and an evaluation
+    # that stopped are all 1 — a pipeline that carried on past any of them would
+    # ship what the evaluation did not vouch for.
+    if not _gate_passed(finished):
         raise SystemExit(1)
 
 
+def _gate_passed(finished: dict[str, Any]) -> bool:
+    verdict = finished.get("verdict") if finished.get("status") == "done" else None
+    return isinstance(verdict, dict) and str(verdict.get("gate")).lower() == "passed"
+
+
 def _ran_just_now(record: dict[str, Any]) -> bool:
     """Did the project record this run in the last few minutes?
 
@@ -506,7 +515,9 @@ def _run_and_let_the_app_evaluate() -> str | None:
         f"  1. add {TRACING_ENV_VAR}=true to .env\n  2. crewai run\n  3. crewai eval"
     )
     if is_dmn_mode_enabled() or not sys.stdin.isatty():
-        console.print(steps, style="yellow")
+        # `Text`, never markup: the reason may be an OS error's own words, and
+        # its `[Errno 13]` would be read as a style tag.
+        console.print(Text(_nothing_traced_unattended() or steps), style="yellow")
         raise SystemExit(1)
     if not click.confirm(
         "No traced run is recorded in this project. Turn tracing on and run the crew now? "
@@ -567,6 +578,32 @@ def _recorded_since(record: dict[str, Any], began: datetime) -> bool:
     return when >= began - timedelta(seconds=1)
 
 
+def _nothing_traced_unattended() -> str | None:
+    """Why a run with tracing on left nothing to evaluate, when nobody was there.
+
+    An anonymous run asks before its trace leaves the machine, and a process with
+    no terminal has nobody to ask — so its trace is kept local, tracing on or
+    not. Telling that user to turn tracing on sends them round the same loop;
+    logging in is what makes an unattended run traced. None when tracing is off
+    or there is a login: the ordinary steps are the right ones then. A login
+    that cannot be read says so instead.
+    """
+    if os.environ.get(TRACING_ENV_VAR, "").strip().lower() not in ("true", "1"):
+        return None
+    try:
+        if saved_login() is not None:
+            return None
+    except EvaluationStoppedError as unreadable:
+        # A login that exists and cannot be read is the reason, and its
+        # sentence says what to do about it.
+        return str(unreadable)
+    return (
+        "No traced run is recorded in this project. Tracing is on, but a run nobody is "
+        "watching is only traced when you are logged in: run `crewai login`, then "
+        "`crewai run` and `crewai eval` again."
+    )
+
+
 def _enable_tracing() -> None:
     """`CREWAI_TRACING_ENABLED=true` in the project's .env, and in this process for the run about to start."""
     env_file = Path.cwd() / ".env"
```

**File**: `lib/cli/tests/experimental/test_eval_crew.py` (modified, +82/-1)
```diff
@@ -241,13 +241,33 @@ def test_run_names_another_execution_and_an_anonymous_caller_sends_no_token(proj
     monkeypatch.setattr(eval_module, "saved_login", lambda: None)
     amp = install(monkeypatch, FakeAMP(statuses=[done("failed")]))
 
-    eval_module.eval_crew(run_id="other-run")
+    with pytest.raises(SystemExit):  # a failed gate is exit 1
+        eval_module.eval_crew(run_id="other-run")
 
     assert amp.api_key is None
     assert amp.calls[0] == ("create", "other-run")
     assert "Goal gate: FAILED" in capsys.readouterr().out
 
 
+@pytest.mark.parametrize(
+    "gate, code", [("passed", None), ("failed", 1), ("inconclusive", 1), ("unknown", 1)]
+)
+def test_the_exit_code_is_the_gates(project, monkeypatch, capsys, gate, code):
+    """A CI job reads the exit code. Only a gate that PASSED is 0: a failed one,
+    and one with no verdict, must stop the pipeline rather than wave it on."""
+    directory, _ = project
+    record_last_run(directory)
+    install(monkeypatch, FakeAMP(statuses=[done(gate)]))
+
+    if code is None:
+        eval_module.eval_crew()
+    else:
+        with pytest.raises(SystemExit) as exited:
+            eval_module.eval_crew()
+        assert exited.value.code == code
+    assert f"Goal gate: {gate.upper()}" in capsys.readouterr().out
+
+
 def test_a_failed_evaluation_exits_one_with_amps_reason(project, monkeypatch, capsys):
     directory, _ = project
     record_last_run(directory)
@@ -1126,3 +1146,64 @@ def test_read_last_run_reads_the_record_crewai_writes(tmp_path):
     record_last_run(tmp_path)
     record = eval_module.read_last_run(tmp_path)
     assert record is not None and record["execution_id"] == EXECUTION_ID and record["amp_base_url"] == "https://amp.test"
+
+
+@pytest.mark.parametrize(
+    "tracing, login, says_login",
+    [
+        ("true", None, True),  # tracing on, nobody logged in: log in
+        ("true", "tok", False),  # logged in: the ordinary steps
+        (None, None, False),  # tracing off: turn it on
+    ],
+)
+def test_an_unattended_run_with_nothing_traced_says_what_would_trace_it(
+    project, monkeypatch, capsys, tracing, login, says_login
+):
+    """With no terminal, an anonymous run's trace stays on the machine even with
+    tracing on. Telling that user to turn tracing on sends them round the same
+    loop; logging in is what makes an unattended run traced."""
+    directory, _ = project
+    (directory / "pyproject.toml").write_text("[project]\nname = 'demo'\n")
+    monkeypatch.setattr(eval_module.sys.stdin, "isatty", lambda: False)
+    monkeypatch.setattr(eval_module, "saved_login", lambda: login)
+    if tracing:
+        monkeypatch.setenv("CREWAI_TRACING_ENABLED", tracing)
+    else:
+        monkeypatch.delenv("CREWAI_TRACING_ENABLED", raising=False)
+
+    with pytest.raises(SystemExit) as exited:
+        eval_module.eval_crew()
+
+    out = capsys.readouterr().out.replace("\n", " ")
+    assert exited.value.code == 1
+    assert ("run `crewai login`" in out) is says_login
+    assert ("add CREWAI_TRACING_ENABLED=true" in out) is not says_login
+
+
+def test_an_unreadable_login_is_the_reason_given_when_nothing_was_traced(
+    project, monkeypatch, capsys
+):
+    """A login that exists and cannot be read is why an unattended run was not
+    traced, and its own sentence says what to do — not "turn tracing on"."""
+    directory, _ = project
+    (directory / "pyproject.toml").write_text("[project]\nname = 'demo'\n")
+    monkeypatch.setattr(eval_module.sys.stdin, "isatty", lambda: False)
+    monkeypatch.setenv("CREWAI_TRACING_ENABLED", "true")
+
+    def unreadable() -> None:
+        raise eval_module.EvaluationStoppedError(
+            "Could not read the saved login (PermissionError: [Errno 13] "
+            "Permission denied: [/Users/me/.config/crewai]). Run `crewai login` again"
+        )
+
+    monkeypatch.setattr(eval_module, "saved_login", unreadable)
+
+    with pytest.raises(SystemExit):
+        eval_module.eval_crew()
+
+    out = capsys.readouterr().out.replace("\n", " ")
+    assert "Could not read the saved login" in out
+    # printed as it is: `[/Users/…]` read as markup is a closing tag, and a crash
+    assert "[/Users/me/.config/crewai]" in out
+    assert "add CREWAI_TRACING_ENABLED=true" not in out
+
```

---

### Incident Patch 10: `d183aedb` (2026-09-28)
**Commit Message**: ensure panel for viewing traces is visible (#7803)

**File**: `lib/crewai/src/crewai/telemetry/tracing/grants.py` (modified, +8/-2)
```diff
@@ -17,6 +17,7 @@
 from opentelemetry.sdk.trace import ReadableSpan
 from opentelemetry.sdk.trace.export import SpanExportResult, SpanExporter
 from rich.console import Console
+from rich.panel import Panel
 from rich.style import Style
 from rich.text import Text
 
@@ -304,7 +305,7 @@ def record_export(self) -> None:
             self._show_trace_link()
 
     def _show_trace_link(self) -> None:
-        """One line, once: where to see the run that was just exported.
+        """Show where to see the run that was just exported, once.
 
         The execution id stays out of it — `crewai eval` reads that from the
         record — but whoever wants to open the trace gets AMP's viewer link.
@@ -318,7 +319,12 @@ def _show_trace_link(self) -> None:
             self._trace_url,
             style=Style(color="cyan", underline=True, link=self._trace_url),
         )
-        Console().print(line)
+        title = (
+            "🔗 Ephemeral Execution Traces"
+            if self._client._tier == "ephemeral"
+            else "🔗 Execution Traces"
+        )
+        Console().print(Panel(line, title=title, border_style="green", padding=(1, 2)))
 
     def shutdown(self) -> None:
         with self._lock:
```

**File**: `lib/crewai/tests/telemetry/test_session_trace_export.py` (modified, +2/-0)
```diff
@@ -212,6 +212,8 @@ def run():
     # a run that was exported whole, and not where tracing messages are suppressed.
     shown = recorded and suppression is None
     assert ("View traces:" in output) == shown
+    assert ("Execution Traces" in output and "╭" in output) == shown
+    assert ("Ephemeral Execution Traces" in output) == (shown and not authenticated)
     assert (url in output.replace("\n", "")) == shown
     assert len(collector.batches) == int(authenticated or approved)
     # A run whose spans reached Wharf is recorded for `crewai eval`, silently,
```

---

### Incident Patch 11: `4dcd19aa` (2026-09-28)
**Commit Message**: fix(tracing): turning tracing on is the answer, and an Evaluate button in the TUI (#7765)

* fix(tracing): turning tracing on is the answer; stop asking again

Two things a user who ran `crewai eval` sees today.

`crewai eval` offers to turn tracing on and run the crew. The run finishes —
and the ephemeral buffer asks "Share this execution trace with CrewAI?", which
is the same question again. Turning tracing on IS consent: `tracing_asked_for()`
is true when `CREWAI_TRACING_ENABLED` says so or when `tracing=True` was passed
in this context, and the buffer takes it as the answer. First-time
auto-collection still asks, because nobody asked for that one.

And the offer named the mechanism rather than the effect — "Turn tracing on
(CREWAI_TRACING_ENABLED=true stays in .env) and run the crew now?", then
"Tracing is on for this project (CREWAI_TRACING_ENABLED=true in .env)." The
variable is how it works, not what the user is agreeing to; both lines now say
what happens and leave the plumbing to the .env file it is written in.

491 telemetry tests and 62 eval-CLI tests green.

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

* fix(tracing): the TUI's modal is a prompt too, a

**File**: `lib/cli/src/crewai_cli/crew_run_tui.py` (modified, +517/-6)
```diff
@@ -5,8 +5,15 @@
 """
 
 import asyncio
+from collections.abc import Callable, Iterator
+import contextlib
+from contextlib import contextmanager
+from contextvars import ContextVar
 import json as _json
+import os
+from pathlib import Path
 import re
+import secrets
 import threading
 import time
 from typing import Any, ClassVar
@@ -289,6 +296,116 @@ def action_consent_no(self) -> None:
         self.dismiss(False)
 
 
+_AUTO_EVAL: ContextVar[dict[str, str | None] | None] = ContextVar(
+    "crewai_tui_auto_eval", default=None
+)
+
+# The same word, for the app that runs in a CHILD process. A project's crew and
+# flow are run through `uv run …` in the project's own environment, and nothing
+# in this process's memory reaches that app — the environment does, and it is
+# the only thing that does. Set and cleared by `evaluating_after_run()` alone:
+# an internal handshake between two parts of one command, never a setting for
+# anyone to turn on.
+#
+# The child loads the project's `.env` over its environment, so the variable
+# alone would be a switch any project could flip — an evaluation started, with
+# the machine's `crewai login`, on a plain `crewai run`. Its value is therefore a
+# random token, and it counts only while the file of that name exists in this
+# user's crewAI data directory: the command writes it before the run and removes
+# it after, and a `.env` cannot create a file.
+_AWAITING_EVAL_ENV = "CREWAI_EVAL_AWAITING_RUN"
+_AWAITING_TOKEN = re.compile(r"[0-9a-f]{32}")
+
+
+def _awaiting_dir() -> Path:
+    import appdirs
+
+    return Path(appdirs.user_data_dir("crewai", "CrewAI")) / "eval-awaiting"
+
+
+@contextmanager
+def evaluating_after_run() -> Iterator[dict[str, str | None]]:
+    """Run the crew for an evaluation that is already under way.
+
+    `crewai eval` with nothing traced offers to run the crew first. The app it
+    opens would otherwise sit there until somebody quits it, with the command
+    waiting behind — so inside this block the app closes itself when the run
+    ends and leaves its execution id in the holder. It does NOT chain into an
+    evaluation of its own: the command that opened it is the one evaluating.
+
+    A run in the same process leaves its id here; a run in a child process
+    leaves it in the project's last-run record, which the caller reads when the
+    holder comes back empty.
+    """
+    holder: dict[str, str | None] = {"execution_id": None}
+    token = _AUTO_EVAL.set(holder)
+    before = os.environ.get(_AWAITING_EVAL_ENV)
+    # Without the file a child app cannot be told, and the command grades the
+    # run itself once the app closes — slower to the verdict, never wrong.
+    marker: Path | None = None
+    with contextlib.suppress(OSError):
+        nonce = secrets.token_hex(16)
+        _awaiting_dir().mkdir(parents=True, exist_ok=True)
+        (_awaiting_dir() / nonce).touch(exist_ok=False)
+        marker = _awaiting_dir() / nonce
+        os.environ[_AWAITING_EVAL_ENV] = nonce
+    try:
+        yield holder
+    finally:
+        _AUTO_EVAL.reset(token)
+        if marker is not None:
+            with contextlib.suppress(OSError):
+                marker.unlink()
+        if before is None:
+            os.environ.pop(_AWAITING_EVAL_ENV, None)
+        else:
+            os.environ[_AWAITING_EVAL_ENV] = before
+
+
+def _an_evaluation_is_waiting() -> dict[str, str | None] | None:
+    """The evaluation this run was started for, if there is one.
+
+    In this process the holder itself; in a child process the environment says
+    an evaluation is waiting and the holder is a local one — the id travels
+    back through the project's last-run record instead, which the child writes
+    when its trace is exported.
+    """
+    holder = _AUTO_EVAL.get()
+    if holder is not None:
+        return holder
+
+    value = os.environ.get(_AWAITING_EVAL_ENV) or ""
+    if not _AWAITING_TOKEN.fullmatch(value):
+        return None
+    try:
+        waiting = (_awaiting_dir() / value).is_file()
+    except OSError:
+        return None
+    return {"execution_id": None} if waiting else None
+
+
+def _recorded_run(execution_uuid: str) -> dict[str, Any] | None:
+    """This execution's own record, if its trace reached AMP.
+
+    crewAI records a run when its spans are exported, so the record answers the
+    one question the uuid alone cannot: whether there is anything to grade, and
+    where AMP will show it. It is matched by id rather than trusted as "the
+    last run", which it is only until another run in the project finishes.
+    """
+    # a missing or unreadable record simply means "not traced"
+    with contextlib.suppress(Exception):
+        from crewai.telemetry.tracing.last_run import read_last_run
+
+        record = read_last_run() or {}
+        if str(record.get("execution_id") or "") == execution_uuid:
+            return record
+    return None
+
+
+def _trace_was_recorded(execution_uuid: str) -> bool:
+    return _reco
```

**File**: `lib/cli/src/crewai_cli/experimental/eval_crew.py` (modified, +503/-103)
```diff
@@ -14,7 +14,9 @@
 
 from __future__ import annotations
 
+from collections.abc import Callable
 import contextlib
+from datetime import datetime, timedelta, timezone
 from ipaddress import ip_address
 import json
 import os
@@ -44,10 +46,65 @@
 TRACING_ENV_VAR = "CREWAI_TRACING_ENABLED"
 POLL_SECONDS = 3.0
 POLL_RETRIES = 5  # consecutive unreachable / 5xx polls before giving up; the evaluation keeps running
+
+# A run's spans reach AMP a little after the run ends — the exporter sends them
+# as the process closes and AMP has its own queue behind that. A command that
+# just watched the run would otherwise ask for a trace that is still in flight
+# and be told, correctly and uselessly, that there is nothing there. So a run
+# we know is fresh gets a wait; an id somebody typed does not, and fails at
+# once as it always has.
+SPANS_WAIT_SECONDS = 120.0
+SPANS_POLL_SECONDS = 5.0
+RUN_IS_FRESH_SECONDS = 600.0
 FINISHED = {"done", "failed"}
 STATUSES = {"queued", "running"} | FINISHED
 
 
+def _record_usage(*, logged_in: bool) -> None:
+    """Count an evaluation that is actually starting, and whether the caller was
+    logged in.
+
+    Usage stats are anonymous, so nothing that names the run or the account is
+    sent — no execution id, no organization, and nothing about the run's content.
+    Which runs were evaluated, and by whom, is AMP's record, not these stats'.
+
+    The TUI's button counts `cli_usage:evaluate` when it is pressed, so the
+    difference between that and `cli_usage:eval` is intent that never became an
+    evaluation.
+    """
+    try:
+        from crewai_core.telemetry import Telemetry
+
+        telemetry = Telemetry()
+        telemetry.set_tracer()
+        telemetry.feature_usage_span(
+            "cli_usage:eval",
+            {"authenticated": "true" if logged_in else "false"},
+        )
+    except Exception:  # noqa: S110 - telemetry must never break a command
+        pass
+
+
+NOT_TRACED = (
+    "The run finished but no trace was recorded: the run may have failed, sharing the "
+    "trace was declined, or this project's crewai is older than the version that records "
+    f"the last run ({LAST_RUN_FILE}). Run the crew again and accept when asked, then `crewai eval`."
+)
+
+
+class EvaluationStoppedError(RuntimeError):
+    """The evaluation cannot go on, in words meant for a reader.
+
+    Raised rather than printed-and-exited, because the same two functions serve
+    the terminal and the run app: one of them owns the screen, and a line
+    printed underneath it is a smear nobody asked for.
+    """
+
+
+def _note(text: str, style: str = "dim") -> None:
+    console.print(Text(text), style=style)
+
+
 def eval_crew(run_id: str | None = None) -> None:
     """Evaluate the last traced run of this project, or the run RUN_ID."""
     get_or_create_project_id()
@@ -57,10 +114,19 @@ def eval_crew(run_id: str | None = None) -> None:
     record = read_last_run() or {}
     execution_id = run_id or record.get("execution_id")
     if execution_id is None:
-        execution_id = _run_now_or_explain()
+        # Nothing traced here: the crew runs first, and the app that runs it
+        # carries the evaluation on its own screen — link, progress, verdict.
+        # It comes back with the run to grade when the app did NOT get to it: a
+        # conversational session, or a flow that took the terminal instead.
+        execution_id = _run_and_let_the_app_evaluate()
+        if execution_id is None:
+            return
         record = read_last_run() or {}
 
-    client = _amp_client(trusted)
+    try:
+        client = _amp_client(trusted)
+    except EvaluationStoppedError as stopped:
+        _fail(str(stopped))
     recorded_amp = str(record.get("amp_base_url") or "").rstrip("/")
     if not run_id and recorded_amp and recorded_amp != client.base_url.rstrip("/"):
         console.print(
@@ -69,7 +135,18 @@ def eval_crew(run_id: str | None = None) -> None:
             ),
             style="yellow",
         )
-    started = _start_evaluation(client, execution_id)
+    try:
+        started = _start_evaluation(
+            client,
+            execution_id,
+            wait_for_spans=run_id is None and _ran_just_now(record),
+        )
+    except EvaluationStoppedError as stopped:
+        _fail(str(stopped))
+    # After, not before: `cli_usage:eval` counts an evaluation, and a refused
+    # request — a run AMP does not hold, a credential it will not take — is not
+    # one. `_start_evaluation` raises rather than returning on those.
+    _record_usage(logged_in=client.api_key is not None)
     url = started.get("url")
     console.print(Text("Evaluating run ").append(execution_id, style="bold"))
     if url:
@@ -79,12 +156,202 @@ def eval_crew(run_id: str | None = None) -> None:
         console.print(Text("Follow it at ").append(url, style="cyan underline"))
         _open(url)
 
-    finished = _wait(client, started["id"], url)
+    console.print("Waiting for t
```

**File**: `lib/cli/src/crewai_cli/plus_api.py` (modified, +13/-3)
```diff
@@ -27,12 +27,22 @@ class PlusAPI(_CorePlusAPI):
     EVALUATION_START_TIMEOUT = 120.0
     EVALUATION_POLL_TIMEOUT = 30.0
 
-    def create_evaluation(self, execution_id: str) -> httpx.Response:
-        """Ask AMP to evaluate the traced run EXECUTION_ID (crewai eval)."""
+    def create_evaluation(
+        self, execution_id: str, *, eval_config: str | None = None
+    ) -> httpx.Response:
+        """Ask AMP to evaluate the traced run EXECUTION_ID (crewai eval).
+
+        EVAL_CONFIG is the project's own `eval.jsonc` when it has one: what
+        good means for this crew, in its own words. Sent as it was written,
+        comments and all, and read by the grader rather than here.
+        """
+        body: dict[str, str] = {"execution_id": execution_id}
+        if eval_config:
+            body["eval_config"] = eval_config
         return self._make_request(
             "POST",
             self.EVALUATIONS_RESOURCE,
-            json={"execution_id": execution_id},
+            json=body,
             timeout=self.EVALUATION_START_TIMEOUT,
         )
 
```

**File**: `lib/cli/src/crewai_cli/run_crew.py` (modified, +42/-0)
```diff
@@ -600,6 +600,48 @@ def _print_post_tui_summary(app: CrewRunApp) -> None:
             )
         )
 
+    _print_evaluation_line(app, console, crewai_teal)
+
+
+def _print_evaluation_line(app: CrewRunApp, console: Any, teal: str) -> None:
+    """The evaluation's link, once the app that showed it has gone.
+
+    An evaluation started inside the app is read there; the terminal is what is
+    left afterwards, and a link that only ever existed on a screen that is now
+    closed is a link nobody can open again.
+    """
+    evaluation = getattr(app, "_evaluation", None) or {}
+    url = str(evaluation.get("url") or "")
+    if not url:
+        return
+
+    from rich.text import Text
+
+    state = str(evaluation.get("state"))
+    line = Text("\n  ")
+    if state == "done":
+        verdict = evaluation.get("verdict") or {}
+        line.append("Evaluated: ", style="dim")
+        line.append(
+            f"goal gate {str(verdict.get('gate') or '').upper()}  ", style="bold"
+        )
+    elif state == "failed":
+        line.append("Evaluation stopped — the report has what it got: ", style="dim")
+    else:
+        line.append("Evaluation still running at ", style="dim")
+    line.append(url, style=f"{teal} underline")
+    console.print(line)
+
+    wrote = evaluation.get("wrote_config")
+    if wrote:
+        note = Text("  ")
+        note.append(f"Wrote {wrote}", style="bold")
+        note.append(
+            " — say what good means for this crew there, and the next evaluation is graded on it.",
+            style="dim",
+        )
+        console.print(note)
+
 
 def run_crew(
     trained_agents_file: str | None = None,
```

**File**: `lib/cli/src/crewai_cli/run_declarative_flow.py` (modified, +4/-0)
```diff
@@ -328,6 +328,10 @@ def _print_flow_post_tui_summary(app: Any) -> None:
             )
         )
 
+    from crewai_cli.run_crew import _print_evaluation_line
+
+    _print_evaluation_line(app, console, crewai_teal)
+
 
 def _resolve_flow_inputs(flow: Any, provided: dict[str, Any]) -> dict[str, Any]:
     """Resolve kickoff inputs from the flow's state schema.
```

**File**: `lib/cli/tests/experimental/test_eval_crew.py` (modified, +524/-14)
```diff
@@ -12,10 +12,21 @@
 import pytest
 from rich.console import Console
 
+from crewai_cli import run_crew as run_crew_module
 from crewai_cli.experimental import eval_crew as eval_module
 from crewai_cli.cli import eval_command
 
 
+@pytest.fixture(autouse=True)
+def _awaiting_files_stay_in_tmp(tmp_path, monkeypatch):
+    """The waiting-evaluation token file belongs to the user's crewAI data
+    directory; a test keeps it in its own."""
+    monkeypatch.setattr(
+        "crewai_cli.crew_run_tui._awaiting_dir", lambda: tmp_path / "eval-awaiting"
+    )
+
+
+
 EXECUTION_ID = "6f31fe1a-20bd-4bfe-a011-25d6b9341f62"
 URL = "https://evolve.crewai.test/e/ev-1"
 
@@ -29,22 +40,30 @@ def __init__(self, create=None, statuses=None):
         )
         self.statuses = list(statuses or [])
         self.calls: list[tuple] = []
+        self.sent_config = None
         self.api_key = None
+        self.headers: dict[str, str] = {"X-Crewai-Organization-Id": "org-42"}
 
-    def create_evaluation(self, execution_id):
+    def create_evaluation(self, execution_id, *, eval_config=None):
         self.calls.append(("create", execution_id))
+        self.sent_config = eval_config
+        if isinstance(self.create, list):
+            return self.create.pop(0) if len(self.create) > 1 else self.create[0]
         return self.create
 
     def get_evaluation(self, evaluation_id):
         self.calls.append(("get", evaluation_id))
         return self.statuses.pop(0) if self.statuses else httpx.Response(200, json={"id": evaluation_id, "status": "running"})
 
 
-def done(gate="passed", grades=None):
-    return httpx.Response(200, json={
+def done(gate="passed", grades=None, eval_config=None):
+    payload = {
         "id": "ev-1", "status": "done", "url": URL,
         "verdict": {"gate": gate, "grades": grades if grades is not None else {"goal": 5, "quality": 4, "process": 5, "cost": None}},
-    })
+    }
+    if eval_config is not None:
+        payload["eval_config"] = eval_config
+    return httpx.Response(200, json=payload)
 
 
 @pytest.fixture
@@ -69,6 +88,12 @@ def record_last_run(directory: Path, execution_id: str = EXECUTION_ID, **fields)
     (directory / ".crewai" / "last_run.json").write_text(json.dumps(record))
 
 
+def _now() -> str:
+    from datetime import datetime, timezone
+
+    return datetime.now(timezone.utc).isoformat()
+
+
 def install(monkeypatch, amp: FakeAMP, configured_amp: str = "https://amp.test") -> FakeAMP:
     def build(api_key=None, base_url=None):
         # PlusAPI's own resolution: explicit, then CREWAI_PLUS_URL, then the saved settings.
@@ -137,13 +162,15 @@ def test_the_follow_link_cannot_be_retargeted_by_the_url_amp_sends(project, monk
     # command to let markup through.
     directory, _ = project
     record_last_run(directory)
-    hostile = "[link=http://attacker.test/]https://app.crewai.com/e/ev-1[/link]"
+    # A web address that carries markup inside it: printed as text, never
+    # interpreted (one that IS markup is not a web address, and is dropped).
+    hostile = "https://app.crewai.com/e/[link=http://attacker.test/]ev-1[/link]"
     created = httpx.Response(202, json={"id": "ev-1", "url": hostile, "status": "queued"})
     install(monkeypatch, FakeAMP(create=created, statuses=[done()]))
 
     eval_module.eval_crew()
 
-    out = capsys.readouterr().out
+    out = capsys.readouterr().out.replace("\n", "")
     assert "[link=http://attacker.test/]" in out  # printed, not followed
 
 
@@ -160,7 +187,7 @@ def test_a_url_that_is_not_a_string_costs_the_link_and_nothing_else(project, mon
     eval_module.eval_crew()
 
     out = capsys.readouterr().out
-    assert "report url that is not a string" in out  # said, not swallowed
+    assert "not a web address" in out  # said, not swallowed
     assert "Goal gate: PASSED" in out  # and the verdict still arrives
     assert opened == []  # nothing was handed to a browser
     assert "Follow it at" not in out
@@ -300,6 +327,44 @@ def test_a_project_may_point_at_another_amp_but_never_gets_the_saved_login(proje
     assert "crewai enterprise configure" in out
 
 
+def test_the_app_never_trusts_an_amp_the_project_env_introduced(project, monkeypatch):
+    """`crewai eval` reads CREWAI_PLUS_URL before the project's `.env` is
+    loaded, so a shell export is trusted there and a project cannot slip one
+    in. Inside the run app there is no such "before" — the crew has already run
+    and its `.env` was loaded for it — so an exported variable buys nothing and
+    the saved login stays home."""
+    directory, _ = project
+    # what a project's .env would leave behind, indistinguishable by then
+    monkeypatch.setenv("CREWAI_PLUS_URL", "https://evil.example")
+    amp = install(monkeypatch, FakeAMP(statuses=[done()]))
+    notes: list[str] = []
+
+    eval_module.evaluate_run(
+        EXECUTION_ID, on_started=lambda started: None, note=notes.append
+    )
+
+    assert amp.base_url == "https://evil.example"  # the request still fo
```

**File**: `lib/cli/tests/test_crew_run_tui.py` (modified, +412/-8)
```diff
@@ -1,3 +1,4 @@
+import contextvars
 from datetime import datetime
 import time
 from types import SimpleNamespace
@@ -32,7 +33,7 @@
     ToolUsageFinishedEvent,
     ToolUsageStartedEvent,
 )
-from crewai_cli import run_crew
+from crewai_cli import crew_run_tui, run_crew
 from crewai_cli.command import AuthenticationRequiredError
 from crewai_cli.crew_run_tui import (
     _LOG_ARGS_TEXT_LIMIT,
@@ -43,6 +44,17 @@
     _try_parse_structured,
 )
 import pytest
+from rich.text import Text
+
+
+@pytest.fixture(autouse=True)
+def _awaiting_files_stay_in_tmp(tmp_path, monkeypatch):
+    """The waiting-evaluation token file belongs to the user's crewAI data
+    directory; a test keeps it in its own."""
+    monkeypatch.setattr(
+        "crewai_cli.crew_run_tui._awaiting_dir", lambda: tmp_path / "eval-awaiting"
+    )
+
 
 
 def _app_with_plan() -> CrewRunApp:
@@ -137,21 +149,56 @@ def login(self) -> None:
     assert "Deploy failed with exit code 42" in capsys.readouterr().out
 
 
-def test_view_traces_button_click_records_telemetry(monkeypatch) -> None:
+def test_view_traces_opens_the_link_crewai_recorded_for_this_run(monkeypatch) -> None:
+    """crewAI prints that link after a run but never under a TUI, so the button
+    reads it off the record crewAI wrote — matched to THIS app's execution."""
     app = CrewRunApp()
     app._status = "completed"
     app._telemetry = Mock()
-    notice = Mock()
-    monkeypatch.setattr(app, "notify", notice)
+    app._execution_uuid = "run-this-app"
+    monkeypatch.setattr(
+        crew_run_tui,
+        "_recorded_run",
+        lambda uuid: {"execution_id": uuid, "trace_url": "https://amp.example/t/1"}
+        if uuid == "run-this-app"
+        else None,
+    )
+    opened: list[str] = []
+    monkeypatch.setattr(CrewRunApp, "_open_report", lambda self, url: opened.append(url))
+    monkeypatch.setattr(app, "notify", Mock())
 
     app.on_button_pressed(SimpleNamespace(button=SimpleNamespace(id="btn-traces")))
 
     app._telemetry.feature_usage_span.assert_called_once_with("cli_usage:view_traces")
-    notice.assert_called_once_with(
-        "Trace sharing is requested when the execution finishes. "
-        "A trace link is not available for this run.",
-        title="Execution traces",
+    assert opened == ["https://amp.example/t/1"]
+
+
+@pytest.mark.parametrize(
+    ("record", "said"),
+    [
+        (None, "not traced"),
+        ({"execution_id": "run-this-app"}, "granted no link"),
+    ],
+)
+def test_view_traces_says_which_of_the_two_reasons_there_is_no_link(
+    monkeypatch, record, said
+) -> None:
+    """A run nobody traced and a traced run AMP gave no link for are different
+    problems, and only one of them is the reader's to fix."""
+    app = CrewRunApp()
+    app._status = "completed"
+    app._telemetry = Mock()
+    app._execution_uuid = "run-this-app"
+    monkeypatch.setattr(crew_run_tui, "_recorded_run", lambda uuid: record)
+    monkeypatch.setattr(
+        CrewRunApp, "_open_report", lambda self, url: pytest.fail("nothing to open")
     )
+    notices: list[str] = []
+    monkeypatch.setattr(app, "notify", lambda message, **kwargs: notices.append(message))
+
+    app.on_button_pressed(SimpleNamespace(button=SimpleNamespace(id="btn-traces")))
+
+    assert said in notices[0]
 
 
 def test_deploy_button_click_records_telemetry() -> None:
@@ -170,6 +217,363 @@ def test_deploy_button_click_records_telemetry() -> None:
     assert exits == [app._crew_result]
 
 
+def test_evaluate_button_evaluates_here_and_does_not_leave(monkeypatch) -> None:
+    """The evaluation takes minutes, has a link worth showing and a verdict
+    worth reading. Sending somebody to a bare terminal to wait for them is the
+    worst of both, so it runs on this screen — and it names THIS app's
+    execution, not whichever run finished last in the project."""
+    app = CrewRunApp()
+    app._status = "completed"
+    app._telemetry = Mock()
+    app._execution_uuid = "run-this-app"
+    app.exit = lambda result=None: pytest.fail("the app must stay open")  # type: ignore[method-assign]
+    started: list[str] = []
+    monkeypatch.setattr(
+        CrewRunApp, "_evaluate_worker", lambda self, execution_id: started.append(execution_id)
+    )
+    monkeypatch.setattr(crew_run_tui, "_trace_was_recorded", lambda uuid: uuid == "run-this-app")
+
+    app.on_button_pressed(SimpleNamespace(button=SimpleNamespace(id="btn-eval")))
+
+    app._telemetry.feature_usage_span.assert_called_once_with("cli_usage:evaluate")
+    assert started == ["run-this-app"]
+    assert app._evaluation == {"state": "starting", "execution_id": "run-this-app"}
+
+
+def test_the_button_spins_while_it_evaluates_and_still_opens_the_report(
+    monkeypatch,
+) -> None:
+    """A label that never moves reads as a screen that has stopped — and the
+    report page is where the progress is, so the button stays pressable."""
+    app = CrewRunApp()
+    app._status = "completed"
+    app._telemetry =
```

**File**: `lib/cli/tests/test_run_declarative_flow.py` (modified, +30/-1)
```diff
@@ -418,7 +418,7 @@ def test_id_restore_still_drops_unknown_keys(
 # ── TUI vs terminal (headless/deploy) routing ──────────────────────
 
 
-def _install_fake_flow_app(monkeypatch, *, status, want_deploy=False):
+def _install_fake_flow_app(monkeypatch, *, status, want_deploy=False, evaluation=None):
     """Replace CrewRunApp/EventListener/summary so _run_declarative_flow_tui is
     driven by a controllable fake app."""
 
@@ -430,6 +430,7 @@ def __init__(self, crew_name=""):
             self._crew_name = crew_name
             self._status = status
             self._want_deploy = want_deploy
+            self._evaluation = evaluation
             self._crew_result = "result"
 
         def run(self):
@@ -541,6 +542,34 @@ def test_run_declarative_flow_tui_no_deploy_when_not_requested(
     assert deploy_calls == []
 
 
+def test_run_declarative_flow_tui_leaves_the_report_link_behind(capsys) -> None:
+    """A declarative flow evaluates inside the app like a crew does. What the
+    terminal is for is afterwards: the link, once the screen that held it is
+    gone."""
+    app = SimpleNamespace(
+        _crew_name="Flow",
+        _status="completed",
+        _elapsed_frozen=1.0,
+        _start_time=0.0,
+        _input_tokens=0,
+        _output_tokens=0,
+        _live_out_tokens=0,
+        _final_output=None,
+        _error=None,
+        _evaluation={
+            "state": "done",
+            "url": "https://optimize.example/e/1",
+            "verdict": {"gate": "passed"},
+        },
+    )
+
+    run_declarative_flow_module._print_flow_post_tui_summary(app)
+
+    printed = capsys.readouterr().out
+    assert "goal gate PASSED" in printed
+    assert "https://optimize.example/e/1" in printed
+
+
 def test_run_declarative_flow_tui_enables_flow_events(
     monkeypatch: pytest.MonkeyPatch,
 ) -> None:
```

---

### Incident Patch 12: `4ed2abc7` (2026-09-25)
**Commit Message**: fix(llm): retry throttled provider calls (#7677)

* feat(llm): add rate limit retry policy foundation

* feat(llm): retry rate limited client calls

* fix(llm): keep throttles out of context recovery

* refactor(llm): use throttling classifier directly

* refactor(llm): clarify retry scope name

* test(llm): keep retry coverage provider neutral

* refactor(llm): simplify retry defaults

* refactor(llm): encapsulate throttling retries

**File**: `lib/crewai/src/crewai/llm.py` (modified, +4/-4)
```diff
@@ -1149,7 +1149,7 @@ def _handle_streaming_response(
             raise
         except Exception as e:
             error_msg = str(e)
-            if LLMContextLengthExceededError._is_context_limit_error(error_msg):
+            if LLMContextLengthExceededError._is_context_length_exceeded_error(e):
                 raise LLMContextLengthExceededError(error_msg) from e
 
             logging.error(f"Error in streaming response: {e!s}")
@@ -1346,7 +1346,7 @@ def _handle_non_streaming_response(
             raise
         except Exception as e:
             error_msg = str(e)
-            if LLMContextLengthExceededError._is_context_limit_error(error_msg):
+            if LLMContextLengthExceededError._is_context_length_exceeded_error(e):
                 raise LLMContextLengthExceededError(error_msg) from e
             raise
 
@@ -1501,7 +1501,7 @@ async def _ahandle_non_streaming_response(
             raise
         except Exception as e:
             error_msg = str(e)
-            if LLMContextLengthExceededError._is_context_limit_error(error_msg):
+            if LLMContextLengthExceededError._is_context_length_exceeded_error(e):
                 raise LLMContextLengthExceededError(error_msg) from e
             raise
 
@@ -1773,7 +1773,7 @@ async def _ahandle_streaming_response(
             raise
         except Exception as e:
             error_msg = str(e)
-            if LLMContextLengthExceededError._is_context_limit_error(error_msg):
+            if LLMContextLengthExceededError._is_context_length_exceeded_error(e):
                 raise LLMContextLengthExceededError(error_msg) from e
 
             if chunk_count == 0:
```

**File**: `lib/crewai/src/crewai/llms/base_llm.py` (modified, +43/-0)
```diff
@@ -11,6 +11,7 @@
 from contextlib import contextmanager
 import contextvars
 from datetime import datetime
+from functools import wraps
 import json
 import logging
 import re
@@ -42,6 +43,7 @@
     ToolUsageFinishedEvent,
     ToolUsageStartedEvent,
 )
+from crewai.llms.retry import arun_with_rate_limit_retry, run_with_rate_limit_retry
 from crewai.types.streaming import StreamSession
 from crewai.types.usage_metrics import UsageMetrics
 from crewai.utilities.pydantic_schema_utils import serialize_model_class
@@ -177,6 +179,47 @@ class BaseLLM(BaseModel, ABC):
 
     model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)
 
+    def __init_subclass__(cls, **kwargs: Any) -> None:
+        """Wrap concrete client call methods with the shared retry policy."""
+        super().__init_subclass__(**kwargs)
+        cls._wrap_call_method("call")
+        cls._wrap_call_method("acall")
+
+    @classmethod
+    def _wrap_call_method(cls, method_name: str) -> None:
+        """Install one retry wrapper around a subclass-defined public call method."""
+        method = cls.__dict__.get(method_name)
+        if method is None or getattr(method, "_crewai_rate_limit_wrapped", False):
+            return
+
+        if method_name == "call":
+
+            @wraps(method)
+            def wrapped_call(instance: BaseLLM, *args: Any, **kwargs: Any) -> Any:
+                return run_with_rate_limit_retry(
+                    lambda: method(instance, *args, **kwargs)
+                )
+
+            wrapped_call._crewai_rate_limit_wrapped = True  # type: ignore[attr-defined]
+            setattr(cls, method_name, wrapped_call)
+            return
+
+        if method_name == "acall":
+
+            @wraps(method)
+            async def wrapped_acall(
+                instance: BaseLLM, *args: Any, **kwargs: Any
+            ) -> Any:
+                return await arun_with_rate_limit_retry(
+                    lambda: method(instance, *args, **kwargs)
+                )
+
+            wrapped_acall._crewai_rate_limit_wrapped = True  # type: ignore[attr-defined]
+            setattr(cls, method_name, wrapped_acall)
+            return
+
+        raise ValueError(f"Unsupported LLM call method: {method_name}")
+
     llm_type: str = "base"
     model: str
     temperature: float | None = None
```

**File**: `lib/crewai/src/crewai/llms/retry.py` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+"""Shared primitives for retrying transient LLM rate limits."""
+
+from __future__ import annotations
+
+import asyncio
+from collections.abc import Awaitable, Callable, Iterator
+import contextvars
+import random
+import time
+from typing import Any, Final, TypeVar, cast
+
+
+_RETRYABLE_ERROR_CODES: Final[frozenset[str]] = frozenset(
+    {
+        "429",
+        "ratelimiterror",
+        "ratelimitexceeded",
+        "resourceexhausted",
+        "throttlingexception",
+        "toomanyrequests",
+    }
+)
+_NON_RETRYABLE_ERROR_CODES: Final[frozenset[str]] = frozenset(
+    {
+        "servicequotaexceededexception",
+    }
+)
+_RETRYABLE_MESSAGE_MARKERS: Final[tuple[str, ...]] = (
+    "rate limit",
+    "rate-limit",
+    "too many requests",
+    "throttled",
+    "resource exhausted",
+)
+_LLM_RATE_LIMIT_MAX_ATTEMPTS: Final = 3
+_LLM_RATE_LIMIT_INITIAL_DELAY_SECONDS: Final = 1.0
+_LLM_RATE_LIMIT_MAX_DELAY_SECONDS: Final = 8.0
+_LLM_RATE_LIMIT_JITTER_RATIO: Final = 0.2
+_T = TypeVar("_T")
+_active_llm_rate_limit_retry: contextvars.ContextVar[bool] = contextvars.ContextVar(
+    "_active_llm_rate_limit_retry", default=False
+)
+
+
+class _ThrottlingErrorClassifier:
+    """Classify provider exceptions without exposing provider SDK details."""
+
+    @classmethod
+    def is_throttling_error(cls, error: BaseException) -> bool:
+        """Return whether an error chain represents a transient provider throttle."""
+        error_chain = tuple(cls.iter_error_chain(error))
+        error_codes = tuple(cls.error_code(candidate) for candidate in error_chain)
+        if any(code in _NON_RETRYABLE_ERROR_CODES for code in error_codes):
+            return False
+
+        for candidate, error_code in zip(error_chain, error_codes, strict=True):
+            if (
+                cls.status_code(candidate) == 429
+                or error_code in _RETRYABLE_ERROR_CODES
+            ):
+                return True
+
+        return any(
+            marker in str(candidate).lower()
+            for candidate in error_chain
+            for marker in _RETRYABLE_MESSAGE_MARKERS
+        )
+
+    @staticmethod
+    def iter_error_chain(error: BaseException) -> Iterator[BaseException]:
+        """Yield an exception and its explicit or implicit causes once each."""
+        seen: set[int] = set()
+        current: BaseException | None = error
+        while current is not None and id(current) not in seen:
+            seen.add(id(current))
+            yield current
+            current = current.__cause__ or current.__context__
+
+    @staticmethod
+    def error_code(error: BaseException) -> str:
+        """Extract and normalize provider error codes across common SDK shapes."""
+        code: Any = getattr(error, "code", None)
+        response = getattr(error, "response", None)
+        if isinstance(response, dict):
+            response_error = response.get("Error") or response.get("error") or {}
+            if isinstance(response_error, dict):
+                code = response_error.get("Code") or response_error.get("code") or code
+        return str(code or error.__class__.__name__).replace("_", "").lower()
+
+    @staticmethod
+    def status_code(error: BaseException) -> int | None:
+        """Extract an HTTP status code when an SDK exposes one."""
+        status_code = getattr(error, "status_code", None)
+        response = getattr(error, "response", None)
+        if status_code is None:
+            status_code = getattr(response, "status_code", None)
+        return status_code if isinstance(status_code, int) else None
+
+
+def get_retry_delay_seconds(
+    retry_number: int,
+    *,
+    retry_after_seconds: float | None = None,
+    random_value: Callable[[], float] = random.random,
+) -> float:
+    """Calculate a jittered backoff delay for a one-based retry number.
+
+    A provider-provided retry delay takes precedence over locally calculated
+    backoff. ``random_value`` is injectable to make callers' tests deterministic.
+    """
+    if retry_number < 1:
+        raise ValueError("retry_number must be at least 1")
+    if retry_after_seconds is not None:
+        return max(0.0, retry_after_seconds)
+
+    delay = min(
+        _LLM_RATE_LIMIT_INITIAL_DELAY_SECONDS * (2 ** (retry_number - 1)),
+        _LLM_RATE_LIMIT_MAX_DELAY_SECONDS,
+    )
+    jitter = (float(random_value()) * 2 - 1) * _LLM_RATE_LIMIT_JITTER_RATIO
+    return float(delay * (1 + jitter))
+
+
+def run_with_rate_limit_retry(
+    operation: Callable[[], _T],
+    *,
+    sleep: Callable[[float], None] = time.sleep,
+) -> _T:
+    """Run an operation with retries for transient rate-limit errors only."""
+
+    def attempt() -> tuple[bool, _T | None, Exception | None]:
+        """Run one operation while retaining its retryable error."""
+        try:
+            return True, operation(), None
+        except Exception as error:
+            return False, None, error
+
+    if _active_llm_rate_limit_retr
```

**File**: `lib/crewai/src/crewai/utilities/agent_utils.py` (modified, +2/-2)
```diff
@@ -795,9 +795,9 @@ def is_context_length_exceeded(exception: Exception) -> bool:
     Returns:
         bool: True if the exception is due to context length exceeding
     """
-    return LLMContextLengthExceededError(str(exception))._is_context_limit_error(
+    return LLMContextLengthExceededError(
         str(exception)
-    )
+    )._is_context_length_exceeded_error(exception)
 
 
 def handle_context_length(
```

**File**: `lib/crewai/src/crewai/utilities/exceptions/context_window_exceeding_exception.py` (modified, +11/-3)
```diff
@@ -1,5 +1,7 @@
 from typing import Final
 
+from crewai.llms.retry import _ThrottlingErrorClassifier
+
 
 CONTEXT_LIMIT_ERRORS: Final[list[str]] = [
     "expected a string with maximum length",
@@ -30,15 +32,21 @@ def __init__(self, error_message: str) -> None:
         super().__init__(self._get_error_message(error_message))
 
     @staticmethod
-    def _is_context_limit_error(error_message: str) -> bool:
-        """Check if the error message indicates a context length limit error.
+    def _is_context_length_exceeded_error(error: str | BaseException) -> bool:
+        """Check whether an error represents a context limit, not a throttle.
 
         Args:
-            error_message: The error message to check.
+            error: The provider exception or error message to check.
 
         Returns:
             True if the error message indicates a context length limit error, False otherwise.
         """
+        if isinstance(
+            error, BaseException
+        ) and _ThrottlingErrorClassifier.is_throttling_error(error):
+            return False
+
+        error_message = str(error)
         return any(
             phrase.lower() in error_message.lower() for phrase in CONTEXT_LIMIT_ERRORS
         )
```

**File**: `lib/crewai/tests/llms/bedrock/test_bedrock.py` (modified, +85/-2)
```diff
@@ -1,7 +1,7 @@
 import logging
 import os
 import threading
-from unittest.mock import patch, MagicMock
+from unittest.mock import AsyncMock, MagicMock, patch
 import pytest
 
 from crewai.llm import LLM
@@ -770,12 +770,13 @@ def test_bedrock_handles_cohere_conversation_requirements():
     assert "continue" in formatted_messages[-1]["content"][0]["text"].lower()
 
 
-def test_bedrock_client_error_handling():
+def test_bedrock_client_error_handling(monkeypatch):
     """
     Test that Bedrock properly handles various AWS client errors
     """
     from botocore.exceptions import ClientError
 
+    monkeypatch.setattr('crewai.llms.retry.time.sleep', lambda _: None)
     llm = LLM(model="bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0")
 
     with patch.object(llm._client, 'converse') as mock_converse:
@@ -804,6 +805,88 @@ def test_bedrock_client_error_handling():
             llm.call("Hello")
         assert "throttled" in str(exc_info.value).lower()
 
+    with patch.object(llm._client, 'converse') as mock_converse:
+        error_response = {
+            'Error': {
+                'Code': 'ServiceQuotaExceededException',
+                'Message': 'Quota increase required',
+            }
+        }
+        mock_converse.side_effect = ClientError(error_response, 'converse')
+
+        with pytest.raises(RuntimeError) as exc_info:
+            llm.call("Hello")
+
+        assert "quota" in str(exc_info.value).lower()
+        assert mock_converse.call_count == 1
+
+
+def test_bedrock_throttling_retries_without_context_recovery(monkeypatch):
+    """Bedrock token throttles retry instead of being treated as context overflow."""
+    from botocore.exceptions import ClientError
+
+    monkeypatch.setattr('crewai.llms.retry.time.sleep', lambda _: None)
+    llm = LLM(model="bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0")
+    throttle_response = {
+        'Error': {
+            'Code': 'ThrottlingException',
+            'Message': 'Too many tokens, please wait before trying again',
+        }
+    }
+    successful_response = {
+        'output': {
+            'message': {'role': 'assistant', 'content': [{'text': 'Recovered'}]}
+        },
+        'usage': {'inputTokens': 1, 'outputTokens': 1, 'totalTokens': 2},
+    }
+
+    with patch.object(llm._client, 'converse') as mock_converse:
+        mock_converse.side_effect = [
+            ClientError(throttle_response, 'converse'),
+            successful_response,
+        ]
+
+        assert llm.call("Hello") == "Recovered"
+
+    assert mock_converse.call_count == 2
+
+
+@pytest.mark.asyncio
+async def test_bedrock_async_throttling_retries_without_context_recovery(monkeypatch):
+    """Async Bedrock token throttles use the same client-level retry behavior."""
+    from botocore.exceptions import ClientError
+
+    async def no_sleep(_: float) -> None:
+        return None
+
+    monkeypatch.setattr('crewai.llms.retry.asyncio.sleep', no_sleep)
+    monkeypatch.setattr(bedrock_completion, 'AIOBOTOCORE_AVAILABLE', True)
+    llm = LLM(model="bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0")
+    throttle_response = {
+        'Error': {
+            'Code': 'ThrottlingException',
+            'Message': 'Too many tokens, please wait before trying again',
+        }
+    }
+    successful_response = {
+        'output': {
+            'message': {'role': 'assistant', 'content': [{'text': 'Recovered'}]}
+        },
+        'usage': {'inputTokens': 1, 'outputTokens': 1, 'totalTokens': 2},
+    }
+    async_client = MagicMock()
+    async_client.converse = AsyncMock(
+        side_effect=[
+            ClientError(throttle_response, 'converse'),
+            successful_response,
+        ]
+    )
+
+    with patch.object(llm, '_ensure_async_client', return_value=async_client):
+        assert await llm.acall("Hello") == "Recovered"
+
+    assert async_client.converse.await_count == 2
+
 
 def test_bedrock_stop_sequences_sync():
     """Test that stop and stop_sequences attributes stay synchronized."""
```

**File**: `lib/crewai/tests/llms/test_retry.py` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+"""Tests for provider-neutral LLM retry behavior."""
+
+from typing import Any
+
+import pytest
+
+from crewai.llms.base_llm import BaseLLM
+from crewai.llms.retry import (
+    _ThrottlingErrorClassifier,
+    arun_with_rate_limit_retry,
+    get_retry_delay_seconds,
+    run_with_rate_limit_retry,
+)
+
+
+class _StructuredProviderError(Exception):
+    def __init__(self, code: str) -> None:
+        self.response = {"Error": {"Code": code}}
+        super().__init__(code)
+
+
+class _RetryingLLM(BaseLLM):
+    model: str = "test-model"
+    outcomes: list[Any]
+
+    def call(self, *args: Any, **kwargs: Any) -> str:
+        outcome = self.outcomes.pop(0)
+        if isinstance(outcome, BaseException):
+            raise outcome
+        return outcome
+
+    async def acall(self, *args: Any, **kwargs: Any) -> str:
+        outcome = self.outcomes.pop(0)
+        if isinstance(outcome, BaseException):
+            raise outcome
+        return outcome
+
+
+@pytest.mark.parametrize(
+    "error",
+    [
+        type("Http429Error", (Exception,), {"status_code": 429})("busy"),
+        type("RateLimitError", (Exception,), {})("busy"),
+        _StructuredProviderError("TooManyRequests"),
+        RuntimeError("provider request was throttled"),
+    ],
+)
+def test_throttling_error_classifier_recognizes_transient_provider_throttles(
+    error: Exception,
+) -> None:
+    assert _ThrottlingErrorClassifier.is_throttling_error(error)
+
+
+def test_throttling_error_classifier_follows_exception_causes() -> None:
+    try:
+        raise _StructuredProviderError("TooManyRequests")
+    except _StructuredProviderError as cause:
+        wrapped = RuntimeError("provider request failed")
+        wrapped.__cause__ = cause
+
+    assert _ThrottlingErrorClassifier.is_throttling_error(wrapped)
+
+
+@pytest.mark.parametrize(
+    "error",
+    [
+        _StructuredProviderError("InvalidRequest"),
+        RuntimeError("input exceeds the context window"),
+        ValueError("request validation failed"),
+    ],
+)
+def test_throttling_error_classifier_rejects_non_transient_errors(
+    error: Exception,
+) -> None:
+    assert not _ThrottlingErrorClassifier.is_throttling_error(error)
+
+
+def test_get_retry_delay_seconds_uses_exponential_backoff() -> None:
+    assert get_retry_delay_seconds(retry_number=1, random_value=lambda: 0.5) == 1
+    assert get_retry_delay_seconds(retry_number=2, random_value=lambda: 0.5) == 2
+    assert get_retry_delay_seconds(retry_number=3, random_value=lambda: 0.5) == 4
+    assert get_retry_delay_seconds(retry_number=4, random_value=lambda: 0.5) == 8
+
+
+def test_get_retry_delay_seconds_applies_jitter_and_honors_retry_after() -> None:
+    assert get_retry_delay_seconds(retry_number=1, random_value=lambda: 1) == 1.2
+    assert get_retry_delay_seconds(retry_number=1, retry_after_seconds=5) == 5
+
+
+def test_run_with_rate_limit_retry_retries_with_backoff() -> None:
+    outcomes: list[str | Exception] = [
+        RuntimeError("rate limit exceeded"),
+        "complete",
+    ]
+    delays: list[float] = []
+
+    result = run_with_rate_limit_retry(
+        lambda: _pop_outcome(outcomes), sleep=delays.append
+    )
+
+    assert result == "complete"
+    assert delays == [pytest.approx(1, abs=0.2)]
+
+
+@pytest.mark.asyncio
+async def test_arun_with_rate_limit_retry_retries_with_backoff() -> None:
+    outcomes: list[str | Exception] = [
+        RuntimeError("rate limit exceeded"),
+        "complete",
+    ]
+    delays: list[float] = []
+
+    async def record_delay(delay: float) -> None:
+        delays.append(delay)
+
+    async def operation() -> str:
+        return _pop_outcome(outcomes)
+
+    result = await arun_with_rate_limit_retry(operation, sleep=record_delay)
+
+    assert result == "complete"
+    assert delays == [pytest.approx(1, abs=0.2)]
+
+
+def test_base_llm_call_is_automatically_wrapped(monkeypatch: pytest.MonkeyPatch) -> None:
+    monkeypatch.setattr("crewai.llms.retry.time.sleep", lambda _: None)
+    llm = _RetryingLLM(
+        model="test-model",
+        outcomes=[RuntimeError("rate limit exceeded"), "complete"]
+    )
+
+    assert llm.call("hello") == "complete"
+    assert llm.outcomes == []
+
+
+@pytest.mark.asyncio
+async def test_base_llm_acall_is_automatically_wrapped(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    async def no_sleep(_: float) -> None:
+        return None
+
+    monkeypatch.setattr("crewai.llms.retry.asyncio.sleep", no_sleep)
+    llm = _RetryingLLM(
+        model="test-model",
+        outcomes=[RuntimeError("rate limit exceeded"), "complete"]
+    )
+
+    assert await llm.acall("hello") == "complete"
+    assert llm.outcomes == []
+
+
+def _pop_outcome(outcomes: list[str | Exception]) -> str:
+    """Raise a scripted error or return a scripted successful result."""
+    outcome = outcomes.pop(0)
+    if isinstance(outcome, Exception):
+        raise outcome
+    return outcome
```

**File**: `lib/crewai/tests/test_llm.py` (modified, +23/-0)
```diff
@@ -13,6 +13,10 @@
 )
 from crewai.llm import CONTEXT_WINDOW_USAGE_RATIO, DEFAULT_CONTEXT_WINDOW_SIZE, LLM
 from crewai.llms.providers.anthropic.completion import AnthropicCompletion
+from crewai.utilities.agent_utils import is_context_length_exceeded
+from crewai.utilities.exceptions.context_window_exceeding_exception import (
+    LLMContextLengthExceededError,
+)
 from crewai.utilities.token_counter_callback import TokenCalcHandler
 from pydantic import BaseModel
 import pytest
@@ -430,6 +434,7 @@ def test_context_window_exceeded_error_handling():
         assert "context length exceeded" in str(excinfo.value).lower()
         assert "8192 tokens" in str(excinfo.value)
 
+
     llm = LLM(model="gpt-4", stream=True, is_litellm=True)
     with patch("litellm.completion") as mock_completion:
         mock_completion.side_effect = ContextWindowExceededError(
@@ -445,6 +450,24 @@ def test_context_window_exceeded_error_handling():
         assert "8192 tokens" in str(excinfo.value)
 
 
+def test_rate_limits_are_not_treated_as_context_window_errors(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    error = RuntimeError("API throttled: too many tokens requested this minute")
+
+    assert not is_context_length_exceeded(error)
+    assert not LLMContextLengthExceededError._is_context_length_exceeded_error(error)
+
+    monkeypatch.setattr("crewai.llms.retry.time.sleep", lambda _: None)
+    llm = LLM(model="gpt-4o-mini", is_litellm=True)
+    with patch("litellm.completion", side_effect=error) as completion:
+        with pytest.raises(RuntimeError) as exc_info:
+            llm.call("Hello")
+
+    assert exc_info.value is error
+    assert completion.call_count == 3
+
+
 @pytest.fixture
 def anthropic_llm():
     """Fixture providing an Anthropic LLM instance."""
```

---

### Incident Patch 13: `0e6440b3` (2026-09-25)
**Commit Message**: docs(cli): guide assistants to platform tools (#7581)

* feat(cli): prioritize platform integrations

* docs(cli): guide assistants to platform tools

* test(platform): update missing token assertion

* fix(platform): retain integration token environment key

* chore: ignore Codex workspace files

* feat(platform): expand integration catalog

* feat(platform): show integration action counts

* feat(platform): select agent actions separately

* feat(platform): group integration applications

* fix(cli): keep platform picker navigation in place

* fix(cli): validate platform apps once

* fix(platform): use one integration token variable

* test(platform): update integration token assertion

* fix(cli): clarify platform token validation

* fix(cli): show platform token prompts

* refactor(platform): expose application catalog

* refactor(platform): export catalog from Python

* docs(platform): document catalog regeneration

* fix(platform): resolve catalog type export

**File**: `lib/cli/src/crewai_cli/templates/AGENTS.md` (modified, +35/-0)
```diff
@@ -854,6 +854,41 @@ flow.plot("my_flow")           # Generates my_flow.html
 
 ## Custom Tools
 
+### CrewAI Platform Tools
+CrewAI AMP provides integrations for supported applications, exposing the actions
+available through each connected application as CrewAI tools. Before selecting an
+integration, use your file-read or search tools to read the installed
+`crewai_core/platform_apps.py` module. Its `PLATFORM_APPS` catalog is the source
+of truth for supported application selectors; do not hard-code that list.
+For how to connect applications and use their actions in AMP, see
+[CrewAI Platform Tools and Integrations](https://docs-platform.crewai.com/platform/en/features/tools-and-integrations).
+
+Connect the required application in CrewAI AMP before using it. Then pass its
+selector to `CrewaiPlatformTools`; the factory returns the action tools available
+for that application, which can be assigned directly to an agent:
+
+```python
+from crewai_tools import CrewaiPlatformTools
+
+gmail_tools = CrewaiPlatformTools(apps=["gmail"])
+agent = Agent(..., tools=gmail_tools)
+```
+
+Multiple connected applications can be requested together:
+
+```python
+platform_tools = CrewaiPlatformTools(apps=["gmail", "slack"])
+```
+
+In JSON crew projects, use the equivalent `platform:<app>` selector in the
+agent's `tools` list:
+```jsonc
+{ "tools": ["platform:gmail"] }
+```
+
+If an application or action is not listed in `PLATFORM_APPS`, do not invent a
+selector; use an appropriate built-in or custom tool instead.
+
 ### Using BaseTool
 ```python
 from typing import Type
```

**File**: `lib/cli/src/crewai_cli/templates/CURSOR.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+# CURSOR.md
+
+Cursor loads this file for project guidance. The import below pulls in the shared
+CrewAI instructions. Keep shared conventions in `AGENTS.md`; add Cursor-specific
+notes under the import.
+
+@AGENTS.md
```

**File**: `lib/cli/src/crewai_cli/utils.py` (modified, +2/-2)
```diff
@@ -101,8 +101,8 @@ def enable_prompt_line_editing() -> None:
 
 
 def copy_assistant_imports(destination: Path) -> None:
-    """Copy the ``CLAUDE.md`` and ``GEMINI.md`` that import ``AGENTS.md``."""
-    for name in ("CLAUDE.md", "GEMINI.md"):
+    """Copy assistant instruction files that import ``AGENTS.md``."""
+    for name in ("CLAUDE.md", "CURSOR.md", "GEMINI.md"):
         shutil.copy2(_TEMPLATES_DIR / name, destination / name)
 
 
```

**File**: `lib/cli/tests/test_create_crew.py` (modified, +4/-0)
```diff
@@ -1261,6 +1261,8 @@ def test_create_crew_scaffolds_assistant_instructions(tmp_path, monkeypatch):
     assert "CrewAI Reference for AI Coding Assistants" in agents_md
     claude_md = (project_root / "CLAUDE.md").read_text(encoding="utf-8")
     assert "@AGENTS.md" in claude_md.splitlines()
+    cursor_md = (project_root / "CURSOR.md").read_text(encoding="utf-8")
+    assert "@AGENTS.md" in cursor_md.splitlines()
     gemini_md = (project_root / "GEMINI.md").read_text(encoding="utf-8")
     assert "@./AGENTS.md" in gemini_md.splitlines()
 
@@ -1320,5 +1322,7 @@ def test_json_create_scaffolds_assistant_instructions(tmp_path, monkeypatch):
     assert "crew.jsonc" in agents_md
     claude_md = (project_root / "CLAUDE.md").read_text(encoding="utf-8")
     assert "@AGENTS.md" in claude_md.splitlines()
+    cursor_md = (project_root / "CURSOR.md").read_text(encoding="utf-8")
+    assert "@AGENTS.md" in cursor_md.splitlines()
     gemini_md = (project_root / "GEMINI.md").read_text(encoding="utf-8")
     assert "@./AGENTS.md" in gemini_md.splitlines()
```

**File**: `lib/cli/tests/test_create_flow.py` (modified, +2/-0)
```diff
@@ -39,6 +39,8 @@ def test_create_flow_declarative_project_can_run(
     assert "human_feedback" not in agents_md
     claude_md = (project_root / "CLAUDE.md").read_text(encoding="utf-8")
     assert "@AGENTS.md" in claude_md.splitlines()
+    cursor_md = (project_root / "CURSOR.md").read_text(encoding="utf-8")
+    assert "@AGENTS.md" in cursor_md.splitlines()
     gemini_md = (project_root / "GEMINI.md").read_text(encoding="utf-8")
     assert "@./AGENTS.md" in gemini_md.splitlines()
 
```

**File**: `lib/cli/tests/tools/test_main.py` (modified, +2/-0)
```diff
@@ -75,6 +75,8 @@ def test_create_scaffolds_assistant_instructions(mock_subprocess, tool_command):
         assert "Never disable, block, or silence CrewAI's built-in observability" in agents_md
         claude_md = Path("test_tool", "CLAUDE.md").read_text(encoding="utf-8")
         assert "@AGENTS.md" in claude_md.splitlines()
+        cursor_md = Path("test_tool", "CURSOR.md").read_text(encoding="utf-8")
+        assert "@AGENTS.md" in cursor_md.splitlines()
         gemini_md = Path("test_tool", "GEMINI.md").read_text(encoding="utf-8")
         assert "@./AGENTS.md" in gemini_md.splitlines()
 
```

---

### Incident Patch 14: `dd4a1062` (2026-09-25)
**Commit Message**: fix(bedrock): fall back to sync calls from acall (#7680)

**File**: `lib/crewai/src/crewai/llms/providers/bedrock/completion.py` (modified, +15/-4)
```diff
@@ -1,5 +1,6 @@
 from __future__ import annotations
 
+import asyncio
 from collections.abc import Mapping, Sequence
 from contextlib import AsyncExitStack
 import json
@@ -485,15 +486,25 @@ async def acall(
             Generated text response or structured output.
 
         Raises:
-            NotImplementedError: If aiobotocore is not installed.
             LLMContextLengthExceededError: If context window is exceeded.
         """
         effective_response_model = response_model or self.response_format
 
         if not AIOBOTOCORE_AVAILABLE:
-            raise NotImplementedError(
-                "Async support for AWS Bedrock requires aiobotocore. "
-                'Install with: uv add "crewai[bedrock]"'
+            logging.warning(
+                "aiobotocore is not installed; falling back to synchronous AWS "
+                "Bedrock calls in a worker thread. Install `crewai[bedrock]` "
+                "for native async support."
+            )
+            return await asyncio.to_thread(
+                self.call,
+                messages,
+                tools=tools,
+                callbacks=callbacks,
+                available_functions=available_functions,
+                from_task=from_task,
+                from_agent=from_agent,
+                response_model=effective_response_model,
             )
 
         with llm_call_context():
```

**File**: `lib/crewai/tests/llms/bedrock/test_bedrock.py` (modified, +41/-0)
```diff
@@ -1,4 +1,6 @@
+import logging
 import os
+import threading
 from unittest.mock import patch, MagicMock
 import pytest
 
@@ -210,6 +212,45 @@ def test_bedrock_completion_call():
         mock_call.assert_called_once_with("Hello, how are you?")
 
 
+@pytest.mark.asyncio
+async def test_bedrock_acall_falls_back_to_sync_call_without_aiobotocore(caplog):
+    """Async Bedrock calls remain usable when only the sync SDK is installed."""
+    llm = LLM(model="bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0")
+    callbacks = [MagicMock()]
+    available_functions = {"lookup": MagicMock()}
+    call_thread_id: int | None = None
+
+    def sync_call(*args, **kwargs):
+        nonlocal call_thread_id
+        call_thread_id = threading.get_ident()
+        return "fallback response"
+
+    with caplog.at_level(logging.WARNING):
+        with (
+            patch.object(bedrock_completion, "AIOBOTOCORE_AVAILABLE", False),
+            patch.object(llm, "call", side_effect=sync_call) as mock_call,
+        ):
+            event_loop_thread_id = threading.get_ident()
+            result = await llm.acall(
+                "Hello, how are you?",
+                callbacks=callbacks,
+                available_functions=available_functions,
+            )
+
+    assert result == "fallback response"
+    assert call_thread_id != event_loop_thread_id
+    assert "falling back to synchronous AWS Bedrock calls" in caplog.text
+    mock_call.assert_called_once_with(
+        "Hello, how are you?",
+        tools=None,
+        callbacks=callbacks,
+        available_functions=available_functions,
+        from_task=None,
+        from_agent=None,
+        response_model=None,
+    )
+
+
 def test_bedrock_completion_called_during_crew_execution():
     """
     Test that BedrockCompletion.call is actually invoked when running a crew
```

---

### Incident Patch 15: `7060bf85` (2026-09-23)
**Commit Message**: Merge pull request #7717 from crewAIInc/security-policy-update

Security policy: security@ and private vulnerability reporting

**File**: `.github/security.md` (modified, +87/-10)
```diff
@@ -1,15 +1,92 @@
-## CrewAI Security Policy
+# Security policy
 
-We are committed to protecting the confidentiality, integrity, and availability of the
-CrewAI ecosystem.
+Thank you for helping keep CrewAI and the people who use it safe. This page
+explains how to report a security issue, what to include, what is in scope,
+and what you can expect from us.
 
-### How to Report
+## How to report
 
-Please submit reports through one of the following channels:
+- **A vulnerability in this repository's code:** open a private report at
+  https://github.com/crewAIInc/crewAI/security/advisories/new. The details
+  stay private, and we can work on the fix, the advisory, and the CVE with
+  you in one place.
+- **Anything else** (the CrewAI platform at app.crewai.com, Factory,
+  crewAI-tools, another CrewAI service, or you are not sure where it
+  belongs): email **security@crewai.com**.
 
-- **crewai-vdp-ess@submit.bugcrowd.com**
-- https://security.crewai.com
+Please do not report security issues through public GitHub issues, pull
+requests, discussions, or social media.
 
-- **Please do not** disclose vulnerabilities via public GitHub issues, pull requests,
-  or social media
-- Reports submitted via channels other than the methods above will not be reviewed and will be dismissed
+## What to include
+
+- The product and the version, commit, or URL affected.
+- Where the problem is: endpoint, file, function, or setting.
+- Steps to reproduce, or a proof of concept. Plain text beats screenshots;
+  please do not send executables.
+- What an attacker could do with it.
+- How you would like to be credited, if at all.
+
+## Scope
+
+- crewAI (this repository) and crewAI-tools
+- The CrewAI AMP platform at app.crewai.com
+- CrewAI Factory releases
+
+## Out of scope
+
+- Third-party services and sites CrewAI does not operate
+- Denial of service, load testing, and other volumetric testing
+- Social engineering and physical attacks
+- Scanner output without demonstrated impact: missing headers, SPF, DMARC
+  or CAA records, version banners, rate limiting
+- Generic "the LLM can be jailbroken" findings without a crewAI-specific
+  defect
+- trust.crewai.com, which is operated by Vanta, except where the finding
+  concerns CrewAI's own content on it
+
+If a report is out of scope, we will tell you so in one reply.
+
+## What we commit to
+
+- Acknowledgment within 2 business days.
+- A substantive response within 10 business days: confirmed, not
+  reproducible, out of scope, already known, or still investigating with a
+  date for the next update.
+- An update at least every 14 days until the report is closed.
+- Coordinated disclosure. We publish the fix and the advisory together, by
+  default within 90 days of acknowledgment; earlier if the fix ships sooner,
+  later only by agreement with you.
+- A CVE, through GitHub's CNA, for confirmed vulnerabilities in publicly
+  distributed CrewAI products.
+- Credit in the advisory if you want it.
+
+## Bounties
+
+CrewAI does not run a paid bug bounty program. We credit reporters who want
+credit.
+
+## Safe harbor
+
+CrewAI will not pursue or support legal action against anyone who reports a
+security issue in good faith and follows these rules:
+
+- Test only against your own account, your own self-hosted Factory instance,
+  or your own copy of our open-source software.
+- Do not access, modify, copy, or keep data that is not yours. If you
+  encounter customer or personal data, stop and tell us immediately.
+- Do not degrade our service: no denial-of-service testing, no bulk automated
+  scanning against AMP, no spam.
+- No social engineering of CrewAI staff, customers, or vendors; no physical
+  attempts against CrewAI property.
+- Report promptly via private vulnerability reporting for this repository's
+  code, or security@crewai.com for other issues. Give us the agreed time to
+  fix before disclosing publicly.
+
+Good-faith research within these rules is authorized access for the purposes
+of applicable computer misuse laws. Activity outside these rules is not
+covered.
+
+## Canonical policy
+
+This page is the canonical version of CrewAI's disclosure policy. A copy at
+https://crewai.com/security will link back here.
```

#### Recent Merged Pull Requests:
- **PR #7906** (2026-10-05): fix(deps): bump oauthlib to 4.0.0 to clear PYSEC-2026-4114 (@Vidit-Ostwal)
- **PR #7879** (closed): fix(flow): preserve sequential method status order (@jstar0)
- **PR #7874** (closed): feat(tools): add HackerNewsTopStoriesTool for fetching top tech stories (@aravindprasads)
- **PR #7864** (2026-10-03): feat(flow): add experimental job lifecycle and runner (@lorenzejay)
- **PR #7863** (closed): feat(memory): Implement Advanced Semantic Cache for Agents (Bounty) (@HasnainChavhan)
- **PR #7854** (closed): feat(crewai-tools): add Darkmoon pentest tools (@MBK-fr)
- **PR #7852** (closed): Main 18173163290657853774 (@abisheakp197)
- **PR #7851** (2026-10-01): fix(deps): bump pypdf to 6.19.0 to clear pip-audit findings (@Vidit-Ostwal)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
