# Forensic Learning Record (Deep Inspection): omnigent-ai/omnigent

> **Canonical Artifact**: `07_PROJECT_LEARNING/omnigent-ai-omnigent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/omnigent-ai/omnigent](https://github.com/omnigent-ai/omnigent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:34:37.350Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `omnigent-ai/omnigent`
- **Description**: Omnigent is an open-source AI agent framework and meta-harness: orchestrate Claude Code, Codex, Cursor, Pi, and custom agents — swap harnesses without rewriting, enforce policies and sandboxing, and collaborate in real time from any device.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 10373 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/cli-setup-verify/verify_cli.py`
```
#!/usr/bin/env python3
"""Drive the Omnigent CLI through a PTY in a throwaway sandbox and verify it.

This is the reusable engine behind the ``cli-setup-verify`` skill (see
``SKILL.md`` next to this file for the playbook and CUJ catalog). One run:

1. Builds an **isolated config/data sandbox** so nothing the CLI writes ever
   lands in the real ``~/.omnigent`` — it sets the purpose-built
   ``OMNIGENT_CONFIG_HOME`` / ``OMNIGENT_DATA_DIR`` knobs (``omnigent/cli.py``
   ``_CONFIG_HOME_ENV_VAR`` / ``_DATA_DIR_ENV_VAR``), strips leaked model
   credentials from the child env, and (optionally) points ``HOME`` and a
   minimal ``PATH`` at the sandbox to simulate a brand-new machine.
2. Drives the real ``omnigent`` binary through ``pexpect`` (a real PTY with a
   sane ``TERM`` so prompt-toolkit / the raw-termios pickers actually render).
3. Captures ANSI-stripped frames into an artifacts dir for UX inspection.
4. Runs the named scenario's assertions and prints a single machine-readable
   ``SUMMARY {json}`` line; exits non-zero on failure.
5. Proves it left the real ``~/.omnigent`` byte-for-byte unchanged.

The point is a **verifiable loop**: run a scenario on the *unfixed* code
(``--label before``) to capture the baseline, make the change, run the same
scenario again (``--label after``), and diff the two SUMMARY lines. If you
cannot reach the surface under test (missing harness, no credential), the
scenario reports ``skipped`` — never a false ``pass``.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from tempfile import mkdtemp

try:
    import pexpect
except ImportError:  # pragma: no cover - guidance, not logic
    sys.stderr.write(
        "verify_cli.py needs `pexpect`. Run it with the omnigent project's "
        "venv python (it bundles pexpect), e.g.\n"
        "  <repo>/.venv/bin/python verify_cli.py ...\n"
    )
    raise

# --- PTY constants (mirrors tests/e2e/omnigent/_pexpect_harness.py) ---------

# prompt-toolkit refuses to draw on TERM=dumb; this is what the REPL tests use.
TERM = "xterm-256color"
# 80x24 is the default new-user window — exactly where narrow-terminal bugs
# (banner overflow, picker redraw past the bottom row) show up. Override with
# --cols/--rows to also exercise the roomy 120x40 layout.
DEFAULT_COLS = 80
DEFAULT_ROWS = 24

ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[a-zA-Z]")

# Stable onboarding anchors (omnigent/cli.py:520, :10064, :10300).
ANCHOR_SEARCHING = "Searching for existing credentials"
ANCHOR_CONFIGURE = "Configure harnesses"
ANCHOR_NO_HARNESS = "Found no harnesses configured"
# REPL readiness signals (the toolbar state line, with the input prompt as a
# fallback for PTY combos that suppress the bottom toolbar).
REPL_READY = [r"state: sleeping", r"❯ "]

# Keys for driving the raw-termios + prompt-toolkit pickers.
KEY_UP = "\x1b[A"
KEY_DOWN = "\x1b[B"
KEY_ENTER = "\r"
KEY_ESC = "\x1b"

# Model-provider credentials we strip from the child env so a "cold" sandbox
# is genuinely credential-free (the CLI auto-adopts ambient keys otherwise).
LEAKED_CRED_VARS = (
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "OPENAI_API_KEY",
    "CLAUDE_API_KEY",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "CURSOR_API_KEY",
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "DATABRICKS_TOKEN",
    "DATABRICKS_HOST",
    "DATABRICKS_CONFIG_PROFILE",
)


def strip_ansi(text: str) -> str:
    """Remove ANSI control sequences so frames can be asserted as plain text."""
    return ANSI_RE.sub("", text)


# --- sandbox ----------------------------------------------------------------


@dataclass
class Sandbox:
    """A throwaway config/data/home for one verification run.

    :param root: Temp directory holding ``config/``, ``data/`` and (unless
        ``--inherit-home``) ``home/``. Removed on cleanup unless ``--keep-sandbox``.
    :param env: The child-process environment with the isolation knobs set.
    :param home_isolated: Whether ``HOME`` was redirected into the sandbox.
    """

    root: Path
    env: dict[str, str]
    home_isolated: bool


def build_sandbox(
    *,
    keep_env_creds: bool,
    inherit_home: bool,
    strip_path: bool,
    omnigent_bin: Path,
) -> Sandbox:
    """Create an isolated sandbox env that cannot touch the real ``~/.omnigent``.

    ``HOME`` is redirected into the sandbox **by default**. This is load-bearing,
    not cosmetic: the CLI's diagnostics logger writes a per-invocation
    ``cli-*.log`` under ``state_dir()`` which is hardcoded to ``Path.home() /
    ".omnigent"`` (``omnigent_ui_sdk/terminal/_config.py``) and ignores
    ``OMNIGENT_CONFIG_HOME`` / ``OMNIGENT_DATA_DIR``. So redirecting ``HOME`` is
    the *only* thing that keeps non-help commands (``config list``, the setup
    PTY spawns, ``server stop`` teardown) from writing into the real home.

    :param keep_env_creds: Keep ambient model keys (e.g. ``ANTHROPIC_API_KEY``)
        in the child env. Default False → a genuinely cold, credential-free run.
    :param inherit_home: Opt OUT of home isolation — use the real ``HOME`` (and
        thus its ambient ``~/.claude`` / ``~/.databrickscfg`` auth). Needed to
        reach a real credentialed REPL, but **relaxes the safety guarantee**:
        non-help commands will then write ``cli-*.log`` into the real
        ``~/.omnigent/logs`` (the broadened fingerprint catches this).
    :param strip_path: Reduce ``PATH`` to just the omnigent binary's dir + an
        empty dir, so node/npm/tmux/claude/codex read as "not installed" — i.e.
        a brand-new machine.
    :param omnigent_bin: Path to the ``omnigent`` console script being driven.
    :returns: A :class:`Sandbox`.
    """
    root = Path(mkdtemp(prefix="omnigent-verify-"))
    (root / "config").mkdir()
    (root / "data").mkdir()

    env = dict(os.environ)
    if not keep_env_creds:
        for var in LEAKED_CRED_VARS:
            env.pop(var, None)

    env["OMNIGENT_CONFIG_HOME"] = str(root / "config")
    env["OMNIGENT_DATA_DIR"] = str(root / "data")
    env["OMNIGENT_NO_UPDATE_CHECK"] = "1"  # keep the update nag out of frames
    env["TERM"] = TERM
    env["COLUMNS"] = str(DEFAULT_COLS)
    env["LINES"] = str(DEFAULT_ROWS)

    if not inherit_home:
        home = root / "home"
        home.mkdir()
        env["HOME"] = str(home)

    if strip_path:
        empty = root / "emptybin"
        empty.mkdir()
        env["PATH"] = f"{omnigent_bin.parent}:{empty}"

    return Sandbox(root=root, env=env, home_isolated=not inherit_home)


def fingerprint_real_config() -> dict[str, str]:
    """Fingerprint the real ``~/.omnigent`` so we can prove we never wrote to it.

    Stat-only (size + mtime, no content reads). It captures two things, both
    cheap:

    * the top-level config files (``*.yaml`` / ``*.json`` / ``*.toml`` plus the
      known names) — what onboarding writes; and
    * the set of ``logs/cli-*.log`` diagnostic files — what *any* non-help CLI
      invocation writes via the hardcoded ``Path.home()/.omnigent`` state dir.
      A new ``cli-*.log`` basename after the run means we wrote into the real
      home (the precise violation that slips through ``OMNIGENT_CONFIG_HOME`` /
      ``OMNIGENT_DATA_DIR``). With home isolation on (the default) none appear;
      under ``--inherit-home`` they do — and this is what trips the guard.

    It deliberately does **not** read the multi-GB ``logs/*.log`` bodies,
    ``db-backups/`` or native-state dirs (reading them would hang, and other
    running omnigent daemons churn them → false alarms). The single ``logs/``
    glob is bounded by the diagnostics log cap.

    :returns: Mapping of relative path → ``"<size>:<mtime_ns>"`` (config files)
        or ``"<mtime_ns>"`` (cli logs). Empty if the directory does not exist.
    """
   
```

### Core Architecture Module: `.claude/skills/polly-e2e-dev/polly_cuj.py`
```
#!/usr/bin/env python3
"""Deterministic mock-LLM CUJ driver for the polly coding orchestrator.

This is the *reproducible loop* half of the ``polly-e2e-dev`` skill. It boots a
throwaway local Omnigent server from the current checkout (which carries
``omnigent.inner.nessie.policies`` — the module polly's guardrails resolve) plus
the repo's mock-LLM server, rewrites the ``examples/polly`` bundle to the
``openai-agents`` harness wired to the mock, then drives ``omnigent run`` turns
where the brain is *scripted* (text or tool calls). Because the brain is mocked,
the loop tests the **substrate / mechanics** of each critical user journey —
tool dispatch, the three runner-side guardrails, session persistence — not
polly's live judgment (that is the live recipe in ``SKILL.md``).

Each scenario prints one machine-readable ``SUMMARY {json}`` line and the driver
exits non-zero if any check failed (a ``skipped`` check never fails the run).

Run it (use the repo venv so subprocesses import the checkout, not a stale wheel)::

    .venv/bin/python .claude/skills/polly-e2e-dev/polly_cuj.py --scenario all
    .venv/bin/python .claude/skills/polly-e2e-dev/polly_cuj.py --list-scenarios
    .venv/bin/python .claude/skills/polly-e2e-dev/polly_cuj.py --scenario guardrail_purpose --keep

No credentials or network egress are required — the mock LLM stands in for every
provider. See ``SKILL.md`` for the live (real claude/codex/pi) recipe.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Iterator
from contextlib import closing, contextmanager, suppress
from dataclasses import dataclass, field
from pathlib import Path

import yaml

# ── Paths & constants ────────────────────────────────────────────────────────

# polly_cuj.py -> polly-e2e-dev -> skills -> .claude -> <repo root>
_REPO_DEFAULT = Path(__file__).resolve().parents[3]
_MOCK_SERVER_REL = Path("tests") / "server" / "integration" / "mock_llm_server.py"

_SERVER_BOOT_TIMEOUT_S = 90.0
_MOCK_BOOT_TIMEOUT_S = 15.0
_RUN_TIMEOUT_S = 180
_MIN_REPLY_CHARS = 12

# The mock routes /v1/responses by the request's ``model`` field; the polly
# brain spec is rewritten to send this exact key so we own its response queue.
_BRAIN_MODEL = "mock-polly-brain"

# Native harnesses that need a CLI binary on PATH; rewritten to ``openai-agents``
# (SDK-based, no binary) for the one scenario that actually dispatches workers.
_NATIVE_HARNESSES = frozenset(
    {
        "claude-native",
        "native-claude",
        "codex-native",
        "native-codex",
        "pi",
        "pi-native",
        "native-pi",
        "cursor-native",
        "native-cursor",
    }
)


# ── HTTP helpers (stdlib only) ───────────────────────────────────────────────


def _free_port() -> int:
    """Reserve an ephemeral loopback port."""
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _get_json(url: str, timeout: float = 10.0) -> object:
    """GET *url* and parse JSON."""
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def _post_json(url: str, payload: dict, timeout: float = 10.0) -> object:
    """POST *payload* as JSON to *url* and parse the JSON reply."""
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data, headers={"content-type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def _wait_for_http(url: str, deadline: float) -> None:
    """Block until *url* answers HTTP 200, or raise past *deadline*."""
    last: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                if resp.status == 200:
                    return
        except (urllib.error.URLError, OSError) as err:
            last = err
        time.sleep(0.5)
    raise TimeoutError(f"{url} never became healthy: {last}")


# ── Mock LLM controls ────────────────────────────────────────────────────────


def _mock_reset(mock_url: str) -> None:
    _post_json(f"{mock_url}/mock/reset", {})


def _mock_configure(mock_url: str, responses: list[dict], *, key: str = "default") -> None:
    """Load a keyed response queue on the mock server."""
    _post_json(f"{mock_url}/mock/configure", {"key": key, "responses": responses})


def _mock_set_fallback(mock_url: str, key: str, text: str) -> None:
    """Set a non-resettable fallback response for *key* (drains stray child calls)."""
    _post_json(f"{mock_url}/mock/set_fallback", {"key": key, "text": text})


def _sys_session_send_call(
    agent: str, title: str, child_args: object, *, call_id: str = "call_1"
) -> dict:
    """Build a ``tool_calls`` entry for ``sys_session_send``.

    *child_args* may be a string (bare input) or a dict
    (``{"input": ..., "purpose": ...}``) — the latter is what
    ``headless_subagent_purpose_guard`` requires.
    """
    return {
        "call_id": call_id,
        "name": "sys_session_send",
        "arguments": json.dumps({"agent": agent, "title": title, "args": child_args}),
    }


def _sys_os_shell_call(command: str, *, call_id: str = "call_sh") -> dict:
    """Build a ``tool_calls`` entry for ``sys_os_shell``."""
    return {
        "call_id": call_id,
        "name": "sys_os_shell",
        "arguments": json.dumps({"command": command}),
    }


# ── Bundle rewrite (inlined from tests/e2e/test_polly_e2e.py) ─────────────────


def _mock_polly_bundle(tmp: Path, mock_url: str, *, rewrite_subagents: bool = False) -> Path:
    """Copy ``examples/polly`` into *tmp* and rewrite it to use the mock LLM.

    Switches the brain harness from ``claude-sdk`` to ``openai-agents``, pins the
    deterministic model key, and bakes ``auth`` + ``connection`` blocks at the
    mock so neither the brain nor the runner-side cost judge reaches a real
    provider. When *rewrite_subagents* is set, native sub-agent harnesses become
    ``openai-agents`` too (so a dispatch doesn't need claude/codex/pi on PATH).
    """
    src = (_repo() / "examples" / "polly").resolve()
    dst = tmp / "polly"
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst, symlinks=False)

    cfg_path = dst / "config.yaml"
    spec = yaml.safe_load(cfg_path.read_text())
    executor = spec.setdefault("executor", {})
    exec_cfg = executor.pop("config", {}) or {}
    exec_cfg["harness"] = "openai-agents"
    executor["config"] = exec_cfg
    executor["model"] = _BRAIN_MODEL
    executor["auth"] = {
        "type": "api_key",
        "api_key": "mock-key",
        "base_url": f"{mock_url}/v1",
    }
    executor["connection"] = {"base_url": f"{mock_url}/v1", "api_key": "mock-key"}
    cfg_path.write_text(yaml.safe_dump(spec, sort_keys=False))

    if rewrite_subagents:
        agents_dir = dst / "agents"
        for sub_cfg in agents_dir.glob("*/config.yaml") if agents_dir.is_dir() else []:
            sub = yaml.safe_load(sub_cfg.read_text())
            sub_exec = sub.get("executor") or {}
            sub_inner = sub_exec.get("config") or {}
            harness = sub_inner.get("harness") or sub_exec.get("type") or ""
            if harness in _NATIVE_HARNESSES:
                sub_inner["harness"] = "openai-agents"
                sub_exec["config"] = sub_inner
                sub["executor"] = sub_exec
                sub_cfg.write_text(yaml.safe_dump(sub, sort_keys=False))
    return dst


# ── Subprocess env ───────────────────────────────────────────────────────────

_CREDENTIAL_VARS = (
    "DATABRICKS_TOKEN",
    "DATABRICKS_HOST",
    "DATABRICKS_CLIENT_ID",
    "DATABRICKS_CLIENT_SECRET",
    "DATABRICKS_CONFI
```

### Core Architecture Module: `deploy/cloudflare/sitecustomize.py`
```
"""Auto-loaded shim that makes Omnigent work against Cloudflare D1.

D1 is SQLite reached over an HTTP REST API. The third-party
``sqlalchemy-cloudflare-d1`` dialect subclasses the *generic* ``DefaultDialect``
and then hand-reimplements SQLite's SQL compilation and schema reflection —
incompletely. That breaks DDL (a composite primary key emits two ``PRIMARY
KEY`` clauses, which D1 rejects; reserved words like ``key`` go unquoted) and
migrations (``get_unique_constraints`` is unimplemented; ``get_foreign_keys``
drops keys reflection needs).

The fix is to subclass SQLAlchemy's real ``SQLiteDialect`` and keep only the
*transport*: the HTTP DBAPI, the URL parser, and the D1 type processors (which
base64-encode blobs and ISO-format dates for the JSON REST API — SQLite's file
DBAPI does this natively, D1's API does not). Everything above the transport —
DDL compiler, type compiler, identifier quoting, and full reflection — is then
inherited from SQLite, correctly. This is the change that belongs upstream in
the dialect package (just change its base class); until it ships, sitecustomize
re-registers a corrected dialect here. Python imports ``sitecustomize`` at
interpreter startup, so it runs before Omnigent builds an engine.

Two small adaptations remain, both expressing facts about D1 rather than SQLite
shortcomings:

  * **Alembic.** Its DDL-impl registry (``alembic.ddl.impl._impls``) is keyed by
    ``dialect.name`` with no inheritance fallback, so the (correctly named)
    ``cloudflare_d1`` dialect ``KeyError``s in ``MigrationContext.__init__``.
    Register SQLite's impl under that name.
  * **No ``temp`` schema.** D1 exposes a single ``main`` schema and forbids the
    ``temp`` schema (``SQLITE_AUTH``). SQLite's reflection probes ``temp``
    (``PRAGMA temp.*``, ``sqlite_temp_master``, ``PRAGMA database_list``); the
    three touchpoints are overridden to read only ``main``.
"""

import sys

# ── Alembic: register a DDL impl for the cloudflare_d1 name ──────────────
try:
    from alembic.ddl.sqlite import SQLiteImpl

    class CloudflareD1Impl(SQLiteImpl):  # auto-registers via __dialect__
        __dialect__ = "cloudflare_d1"
except Exception as exc:  # noqa: BLE001 -- defensive: never block server startup
    print(f"[d1-shim] could not register Alembic impl: {exc}", file=sys.stderr)

# ── Dialect: re-register cloudflare_d1 as a real SQLite subclass ─────────
try:
    from sqlalchemy import exc as _sa_exc
    from sqlalchemy.dialects import registry
    from sqlalchemy.dialects.sqlite.base import SQLiteDialect
    from sqlalchemy_cloudflare_d1.dialect import CloudflareD1Dialect as _UpstreamD1

    # SQLiteDialect.__init__ reads self.dbapi.sqlite_version_info to gate
    # features. D1 runs a modern SQLite; advertise it (the live version is also
    # read in _get_server_version_info below).
    _D1_SQLITE_VERSION = (3, 45, 0)
    _dbapi = _UpstreamD1.import_dbapi()
    if not hasattr(_dbapi, "sqlite_version_info"):
        _dbapi.sqlite_version_info = _D1_SQLITE_VERSION
        _dbapi.sqlite_version = ".".join(str(p) for p in _D1_SQLITE_VERSION)

    class CloudflareD1Dialect(SQLiteDialect):
        """The cloudflare_d1 dialect: SQLite behavior over D1's HTTP transport."""

        name = "cloudflare_d1"
        driver = "httpx"
        default_paramstyle = "qmark"
        supports_statement_cache = True

        # D1's JSON REST API needs the transport type processors (blob->base64,
        # date/time->ISO); layer them over SQLite's defaults.
        colspecs = {**SQLiteDialect.colspecs, **_UpstreamD1.colspecs}  # noqa: RUF012

        # ── transport (from the upstream dialect) ──
        @classmethod
        def import_dbapi(cls):
            return _UpstreamD1.import_dbapi()

        create_connect_args = _UpstreamD1.create_connect_args

        # D1 has no isolation levels — keep these no-ops so SQLite's
        # PRAGMA read_uncommitted machinery never runs over the REST API.
        def get_isolation_level(self, dbapi_connection):  # noqa: ARG002
            return None

        def set_isolation_level(self, dbapi_connection, level):
            pass

        def _get_server_version_info(self, connection):
            try:
                v = connection.exec_driver_sql("SELECT sqlite_version()").scalar()
                return tuple(int(x) for x in str(v).split("."))
            except Exception:  # noqa: BLE001
                return _D1_SQLITE_VERSION

        # ── D1 has a single "main" schema and forbids "temp" ──
        def get_schema_names(self, connection, **kw):  # noqa: ARG002
            return ["main"]

        def _get_table_sql(self, connection, table_name, schema=None, **kw):  # noqa: ARG002
            schema_expr = f"{self.identifier_preparer.quote_identifier(schema)}." if schema else ""
            s = (
                f"SELECT sql FROM {schema_expr}sqlite_master "
                "WHERE name = ? AND type in ('table', 'view')"
            )
            value = connection.exec_driver_sql(s, (table_name,)).scalar()
            if value is None and not self._is_sys_table(table_name):
                raise _sa_exc.NoSuchTableError(f"{schema_expr}{table_name}")
            return value

        def _get_table_pragma(self, connection, pragma, table_name, schema=None):
            quote = self.identifier_preparer.quote_identifier
            prefix = f"{quote(schema)}." if schema is not None else "main."
            cursor = connection.exec_driver_sql(f"PRAGMA {prefix}{pragma}({quote(table_name)})")
            return cursor.fetchall() if not cursor._soft_closed else []

    registry.register("cloudflare_d1", __name__, "CloudflareD1Dialect")
except Exception as exc:  # noqa: BLE001 -- defensive: never block server startup
    print(f"[d1-shim] could not register D1 dialect: {exc}", file=sys.stderr)

```

### Core Architecture Module: `deploy/cloudflare/src/index.js`
```
// Worker that fronts the Omnigent container and proxies all HTTP (and
// WebSocket) traffic to it. Omnigent needs a SINGLE server instance (in-memory
// runner registry), so every request routes to one fixed container instance.
import { Container, getContainer } from "@cloudflare/containers";

export class OmnigentServer extends Container {
  // Port the omnigent server listens on inside the container.
  defaultPort = 8000;
  // Keep the container warm so D1-backed sessions don't cold-start constantly.
  sleepAfter = "30m";

  constructor(ctx, env) {
    super(ctx, env);
    // Env passed into the container. Secrets (DATABASE_URL, the cookie secret,
    // the AWS_* R2 keys) come from `wrangler secret put`; the rest are plain
    // vars in wrangler.jsonc.
    this.envVars = {
      DATABASE_URL: env.DATABASE_URL,
      OMNIGENT_ACCOUNTS_COOKIE_SECRET: env.OMNIGENT_ACCOUNTS_COOKIE_SECRET,
      OMNIGENT_AUTH_ENABLED: "1",
      OMNIGENT_AUTH_PROVIDER: "accounts",
      OMNIGENT_ACCOUNTS_AUTO_OPEN: "0",
      HOST: "0.0.0.0",
      PORT: "8000",
      // Artifact store -> R2 over the S3 API (omnigent's native S3 backend).
      // OMNIGENT_ARTIFACT_URI selects it; AWS_* point boto3 at R2.
      OMNIGENT_ARTIFACT_URI: env.OMNIGENT_ARTIFACT_URI,
      AWS_ENDPOINT_URL_S3: env.AWS_ENDPOINT_URL_S3,
      AWS_DEFAULT_REGION: "auto",
      AWS_ACCESS_KEY_ID: env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: env.AWS_SECRET_ACCESS_KEY,
    };
  }
}

export default {
  async fetch(request, env) {
    // One shared instance for the whole app (single-replica requirement).
    return await getContainer(env.OMNIGENT, "singleton").fetch(request);
  },
};

```

### Core Architecture Module: `deploy/databricks/deploy.py`
```
#!/usr/bin/env python3
"""Deploy Omnigent to a Databricks App via Databricks Asset Bundles.

End-to-end orchestrator that wraps `databricks bundle deploy` +
`databricks bundle run`. The build pieces (version stamp, wheel
build, uv lock generation, stale-wheel sweep) stay in Python; the
deploy itself is a DAB so the app's resource definition (Lakebase,
UC volume) lives declaratively in ``databricks.yml``.

Runs unchanged from a laptop or from CI. Re-runnable;
every step is idempotent.

Usage example:
    python deploy/databricks/deploy.py \\
        --app-name omnigent --profile <your-profile> \\
        --lakebase-branch projects/omnigent/branches/production \\
        --lakebase-database \\
            projects/omnigent/branches/production/databases/databricks-postgres \\
        --volume-name main.omnigent.artifacts

See ``README.md`` in the same directory for the full guide,
including first-time infrastructure setup.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import time
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

from packaging.version import InvalidVersion, Version

if TYPE_CHECKING:
    from databricks.sdk import WorkspaceClient

# Databricks Apps rejects any single source file over 10 MB. Keep wheels and
# the externalized SPA archive under the same limit.
_WORKSPACE_FILE_LIMIT_BYTES = 10 * 1024 * 1024
_WORKSPACE_WHEEL_LIMIT_BYTES = _WORKSPACE_FILE_LIMIT_BYTES
_WEB_UI_DIR_NAME = "web-ui"
_WEB_UI_ARCHIVE_NAME = "web-ui.tar.gz"
_APP_REQUIRES_PYTHON = ">=3.12,<3.13"
# Public PyPI by default; UV_INDEX_URL selects a deployment-accessible mirror.
_UV_DEFAULT_INDEX_URL = "https://pypi.org/simple"

# Select UV_INDEX_URL explicitly before clearing uv's environment overrides.
# --no-config only ignores files; extra indexes can still outrank --default-index.
_UV_INDEX_ENV_VARS = (
    "UV_CONFIG_FILE",
    "UV_DEFAULT_INDEX",
    "UV_EXTRA_INDEX_URL",
    "UV_FIND_LINKS",
    "UV_INDEX",
    "UV_INDEX_URL",
    "UV_NO_CONFIG",
)

# Leaving these in the env when we hand off to the CLI/SDK can
# silently route us to the wrong workspace, or upload code under the
# wrong account. The deploy must use --profile / DATABRICKS_HOST +
# DATABRICKS_CLIENT_ID explicitly.
_ENV_VARS_TO_CLEAR = (
    "DATABRICKS_TOKEN",
    "ANTHROPIC_API_KEY",
    "CODEX",
    "CLAUDE_CODE",
)

# Must match the `resources.apps.<key>` and `bundle.name` in databricks.yml.
_BUNDLE_RESOURCE_KEY = "omnigent"

_WHEEL_PREFIXES = ("omnigent-", "omnigent_client-", "omnigent_ui_sdk-")


def _log(msg: str) -> None:
    print(f"[deploy] {msg}", flush=True)


def _repo_root() -> Path:
    # deploy/databricks/deploy.py → repo root is two parents up.
    return Path(__file__).resolve().parents[2]


def _deploy_dir() -> Path:
    return Path(__file__).resolve().parent


def _src_dir() -> Path:
    return _deploy_dir() / "src"


def _pyproject_paths() -> list[Path]:
    root = _repo_root()
    return [
        root / "pyproject.toml",
        root / "sdks" / "python-client" / "pyproject.toml",
        root / "sdks" / "ui" / "pyproject.toml",
    ]


def _version_py_path() -> Path:
    return _repo_root() / "omnigent" / "version.py"


def _read_base_version() -> str:
    """Read the base version from the top-level pyproject.toml.

    The three pyprojects share the same version; we only need to read
    one. The base value is the on-disk version; deploys append a
    `.postN` suffix so pip's wheel cache treats every deploy as a
    distinct release.
    """
    text = (_repo_root() / "pyproject.toml").read_text()
    match = re.search(r'^version\s*=\s*"([^"]+)"', text, re.MULTILINE)
    if not match:
        raise RuntimeError("could not find version in pyproject.toml")
    return match.group(1)


def _compute_deploy_version(base: str, explicit: str | None) -> str:
    if explicit:
        # Caller knows what they want — let it through after a sanity check.
        # The parser accepts every form this script generates, so a generated
        # version can be fed back through `--skip-build --version`; the
        # normalized form is the one wheel filenames carry.
        try:
            return str(Version(explicit))
        except InvalidVersion:
            raise SystemExit(f"--version {explicit!r} is not a valid PEP 440 version") from None
    # Strip a previous deploy's stamp so suffixes don't stack if a prior
    # deploy left pyproject.toml dirty (or someone committed the bumped
    # value): the local segment first, then `.postN` / `.devN`.
    base = re.sub(r"\+[\w.]+$", "", base)
    base = re.sub(r"(\.post\d+|\.dev\d+)+$", "", base)
    # Post-release, not dev: pip treats `.dev` as a pre-release and
    # ignores it when resolving `>=` constraints, so a deploy that
    # bumps via `.dev` clashes with `omnigent-ui-sdk` declaring
    # `omnigent-client>=0.1.0`. `.post` is a final release and
    # sorts strictly above the base. The local segment names the commit
    # so a debug-log row's app_version (and a runner's hello) says which
    # build it came from.
    return f"{base}.post{int(time.time())}{_git_build_suffix()}"


def _git_build_suffix() -> str:
    """PEP 440 local segment for the checked-out commit, e.g. ``+g1a2b3c4``.

    ``.dirty`` is appended when the tree has uncommitted changes or untracked,
    non-ignored files (the wheel packages those too), so a deploy from a
    modified tree is not mistaken for the commit itself. Empty when the tree
    is not a git checkout.
    """
    try:
        sha = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=_repo_root(),
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        dirty = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=_repo_root(),
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ""
    return f"+g{sha}.dirty" if dirty else f"+g{sha}"


def set_version_in_pyproject(path: Path, new_version: str) -> str:
    """Rewrite the version line and lockstep sibling pins in a pyproject.

    The release process pins the sibling SDK packages in lockstep
    (e.g. ``"omnigent-client==0.1.0rc2"``). Stamping only the
    ``version = "..."`` line would leave those exact pins pointing at
    the unstamped base version, which no built wheel carries — so the
    app-level ``uv lock`` becomes unsatisfiable. Rewrite both.

    :param path: Pyproject file to rewrite, e.g.
        ``<repo>/sdks/ui/pyproject.toml``.
    :param new_version: Stamped deploy version, e.g. ``"0.1.0rc2.post123"``.
    :returns: The original file text, for restore after the build.
    """
    original = path.read_text()
    updated, count = re.subn(
        r'(?m)^version\s*=\s*"[^"]+"',
        f'version = "{new_version}"',
        original,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f"could not rewrite version in {path}")
    # The lockstep graph is circular: omnigent pins both SDKs, the
    # client pins omnigent back, and the ui-sdk pins the client. All
    # three names must be stamped or the resolver still dead-ends.
    updated = re.sub(
        r'"(omnigent(?:-client|-ui-sdk)?)==[^"]+"',
        rf'"\1=={new_version}"',
        updated,
    )
    path.write_text(updated)
    return original


_VERSION_CONSTANT = re.compile(r'^VERSION = "[^"]*"$', re.MULTILINE)


def set_version_constant(path: Path, new_version: str) -> str:
    """Rewrite the ``VERSION`` constant the runtime imports.

    ``omnigent/version.py`` is what debug-log rows (``app_version``), the
    runner hello and ``omnigent --version`` report; the wheel build reads
    only the pyprojects, so the stamped version has to be written here too
    or the deployed processes keep
```

### Core Architecture Module: `deploy/databricks/grant_sp_perms.py`
```
"""
Grant a Databricks App service principal Lakebase schema privileges.

Run this after ``wc.apps.create`` creates the app service principal and
before ``wc.apps.deploy`` starts the app. The app needs these grants so
Alembic can create and migrate Omnigent tables on first boot.
"""

from __future__ import annotations

import argparse
import sys
from typing import Protocol, cast

import psycopg
from databricks.sdk import WorkspaceClient


class _GrantArgs(Protocol):
    """
    Parsed CLI arguments for the grant helper.

    :param app_name: Databricks App name, e.g. ``"omnigent"``.
    :param lakebase_endpoint: Full Lakebase endpoint resource path, e.g.
        ``"projects/omnigent/branches/production/endpoints/primary"``.
    :param database: PostgreSQL database name, e.g.
        ``"databricks_postgres"``.
    :param profile: Optional Databricks CLI profile name, e.g.
        ``"<your-profile>"``.
    """

    app_name: str
    lakebase_endpoint: str
    database: str
    profile: str | None


def _parse_args() -> _GrantArgs:
    """
    Parse command-line arguments for the grant helper.

    :returns: Parsed CLI arguments.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--app-name",
        required=True,
        help="Databricks App name, e.g. 'omnigent'.",
    )
    parser.add_argument(
        "--lakebase-endpoint",
        required=True,
        help=(
            "Full Lakebase endpoint resource path, e.g. "
            "'projects/omnigent/branches/production/endpoints/primary'."
        ),
    )
    parser.add_argument(
        "--database",
        required=True,
        help="PostgreSQL database name, e.g. 'databricks_postgres'.",
    )
    parser.add_argument(
        "--profile",
        default=None,
        help="Optional Databricks CLI profile name, e.g. '<your-profile>'.",
    )
    return cast(_GrantArgs, parser.parse_args())


def _grant_sql(sp_uuid: str) -> str:
    """
    Build the GRANT statement block for an app service principal.

    :param sp_uuid: App service principal client ID, e.g.
        ``"00000000-0000-0000-0000-000000000000"``. Lakebase creates a
        PostgreSQL role with this identifier when the app is created.
    :returns: SQL statements granting schema, table, and sequence
        privileges in the PostgreSQL ``public`` schema.
    """
    escaped = sp_uuid.replace('"', '""')
    quoted = f'"{escaped}"'
    return f"""
GRANT ALL ON SCHEMA public TO {quoted};
GRANT ALL ON ALL TABLES IN SCHEMA public TO {quoted};
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO {quoted};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO {quoted};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO {quoted};
"""


def _resolve_endpoint_host(wc: WorkspaceClient, endpoint_name: str) -> str | None:
    """
    Resolve the Lakebase endpoint hostname.

    :param wc: Databricks workspace client.
    :param endpoint_name: Full Lakebase endpoint resource path, e.g.
        ``"projects/omnigent/branches/production/endpoints/primary"``.
    :returns: Endpoint hostname, or ``None`` when the endpoint is not ready.
    """
    endpoint = wc.postgres.get_endpoint(name=endpoint_name)
    if endpoint.status is None or endpoint.status.hosts is None:
        return None
    return endpoint.status.hosts.host


def _build_conn_params(
    wc: WorkspaceClient, host: str, database: str, endpoint_name: str
) -> dict[str, str]:
    """
    Build psycopg connection params using a short-lived Lakebase OAuth token.

    Returned as keyword params (not a hand-built conninfo string) so the
    token — which we don't control the contents of — is never string-
    interpolated into a DSN where whitespace or ``key=value`` metacharacters
    could be mis-parsed.

    :param wc: Databricks workspace client.
    :param host: Lakebase endpoint hostname, e.g.
        ``"example.database.cloud.databricks.com"``.
    :param database: PostgreSQL database name, e.g.
        ``"databricks_postgres"``.
    :param endpoint_name: Full Lakebase endpoint resource path, e.g.
        ``"projects/omnigent/branches/production/endpoints/primary"``.
    :returns: psycopg connection keyword params for the current user.
    """
    cred = wc.postgres.generate_database_credential(endpoint=endpoint_name)
    pg_user = wc.current_user.me().user_name
    return {
        "host": host,
        "port": "5432",
        "dbname": database,
        "user": pg_user,
        "password": cred.token,
        "sslmode": "require",
    }


def main() -> int:
    """
    Resolve the app service principal and apply Lakebase grants.

    :returns: Process exit code, ``0`` on success and ``1`` when the app
        or Lakebase endpoint is not ready.
    """
    args = _parse_args()

    wc = WorkspaceClient(profile=args.profile) if args.profile else WorkspaceClient()

    app = wc.apps.get(name=args.app_name)
    sp_uuid = app.service_principal_client_id
    if not sp_uuid:
        print(
            f"ERROR: app '{args.app_name}' has no service_principal_client_id "
            "yet; wait for wc.apps.create() to finish.",
            file=sys.stderr,
        )
        return 1

    host = _resolve_endpoint_host(wc, args.lakebase_endpoint)
    if not host:
        print(
            f"ERROR: endpoint '{args.lakebase_endpoint}' has no hostname "
            "in status; wait for the endpoint to become ACTIVE.",
            file=sys.stderr,
        )
        return 1

    print(f"==> Granting public schema privileges to app SP {sp_uuid}")
    params = _build_conn_params(wc, host, args.database, args.lakebase_endpoint)
    with psycopg.connect(autocommit=True, **params) as conn, conn.cursor() as cur:
        cur.execute(_grant_sql(sp_uuid))

    print("Done. The app can create and migrate Omnigent tables on first boot.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `deploy/databricks/src/app.py`
```
"""Databricks Apps entry point for omnigent.

Starts omnigent with Lakebase (managed PostgreSQL) as the
database and UC Volumes as the artifact store.
"""

from __future__ import annotations

import logging
import os
import sys
import threading
import time
import traceback
from pathlib import Path as _Path

from web_ui_archive import extract_web_ui_archive as _extract_web_ui_archive

logging.basicConfig(level=logging.INFO, stream=sys.stderr, force=True)
logger = logging.getLogger("omnigent-app")

# ── Web UI location ────────────────────────────────────────
#
# The deploy ships the SPA outside the wheel as one archive beside this entry
# point. Extract it before importing omnigent.server.app, which binds the
# static-file directory at module import time. A loose directory is supported
# for compatibility with deployments made by the earlier packaging scheme.


def _prepare_web_ui() -> None:
    import shutil as _shutil
    import tarfile as _tarfile
    import tempfile as _tempfile

    here = _Path(__file__).resolve().parent
    archive = here / "web-ui.tar.gz"
    loose = here / "web-ui"
    if loose.is_dir() and not archive.is_file():
        os.environ.setdefault("OMNIGENT_WEB_UI_DIST", str(loose))
        logger.info("Web UI: serving legacy loose assets from %s", loose)
        return
    if not archive.is_file():
        logger.info("Web UI: no archive at %s; using packaged assets", archive)
        return

    extracted = _Path(_tempfile.mkdtemp(prefix="omnigent-web-ui-"))
    try:
        _extract_web_ui_archive(archive, extracted)
    except (OSError, ValueError, _tarfile.TarError) as exc:
        _shutil.rmtree(extracted, ignore_errors=True)
        logger.warning("Web UI: failed to extract %s: %s; using packaged assets", archive, exc)
        return

    os.environ.setdefault("OMNIGENT_WEB_UI_DIST", str(extracted))
    logger.info("Web UI: serving extracted assets from %s", extracted)


_prepare_web_ui()

# ── Lakebase token cache ──────────────────────────────────
#
# Lakebase tokens are valid for ~60 minutes. The previous design
# minted a fresh token on every new physical Postgres connection
# inside SQLAlchemy's ``do_connect`` event hook — a synchronous
# Databricks SDK HTTPS round-trip costing 100–300 ms per call.
# Under the 200-runner load test that meant ~20 mints/minute as
# the pool churned overflow connections, with each mint blocking
# whatever thread (sometimes the asyncio event-loop thread) was
# establishing the connection.
#
# This cache mints once per endpoint and reuses the token across
# all subsequent ``do_connect`` calls until the TTL expires. 50
# minutes leaves a 10-minute safety margin before Lakebase rejects
# the token. Concurrent first-time mints are NOT serialized — we
# release the lock around the SDK call so a thundering herd of
# initial connections all mints once each (worst case) rather than
# waiting on a single in-flight mint. The cache is then populated
# atomically with whichever mint finishes first; the late losers
# just overwrite with their own (equally-valid) token.
_TOKEN_TTL_SECONDS = 50 * 60
_token_cache: dict[str, tuple[str, float]] = {}
_token_cache_lock = threading.Lock()

try:
    import sqlalchemy
    from databricks.sdk import WorkspaceClient

    # ── Configuration ──────────────────────────────────────────

    # Required env vars — injected by Databricks Apps runtime from
    # the resources declared in databricks.yml / app.yaml.
    LAKEBASE_ENDPOINT = os.environ["AP_LAKEBASE_ENDPOINT"]
    VOLUME_PATH = os.environ["AP_ARTIFACT_VOLUME_PATH"]
    PGHOST = os.environ["PGHOST"]
    PGDATABASE = os.environ["PGDATABASE"]
    PGUSER = os.environ["PGUSER"]

    # Optional with documented defaults.
    # Databricks Apps expects the app to listen on DATABRICKS_APP_PORT
    # (8000 by convention) — deliberately decoupled from the CLI's
    # local-server default (6767 in host/local_server.py).
    PORT = int(os.environ.get("DATABRICKS_APP_PORT", "8000"))
    PGPORT = os.environ.get("PGPORT", "5432")
    PGSSLMODE = os.environ.get("PGSSLMODE", "require")
    # Recycle DB connections before Lakebase 60-min token expiry.
    # 300s (5 min) is conservative — well under the 60-min token TTL.
    POOL_RECYCLE_SECONDS = int(os.environ.get("AP_POOL_RECYCLE_SECONDS", "300"))
    logger.info(
        "Config: PGHOST=%s PGDATABASE=%s PGUSER=%s VOLUME=%s PORT=%d",
        PGHOST,
        PGDATABASE,
        PGUSER,
        VOLUME_PATH,
        PORT,
    )

    # ── Lakebase token injection ──────────────────────────────

    _workspace_client = WorkspaceClient()

    def _get_cached_token(endpoint: str) -> str:
        """Return a cached Lakebase token for ``endpoint``, minting if needed.

        Fast path: cached token whose expiry is in the future is returned
        without contacting the workspace. Slow path: mint a new token via
        the Databricks SDK (synchronous HTTPS). The mint runs OUTSIDE the
        cache lock so multiple concurrent first-time mints don't serialize
        behind one another — the last winner writes the cache, which is
        safe since every minted token is independently valid for ~60 min.

        :param endpoint: Lakebase endpoint resource name, e.g.
            ``"projects/foo/branches/production/endpoints/primary"``.
        :returns: A Lakebase database credential token.
        :raises RuntimeError: If the SDK returns a credential with no token.
        """
        now = time.monotonic()
        with _token_cache_lock:
            cached = _token_cache.get(endpoint)
            if cached is not None and cached[1] > now:
                return cached[0]
        credential = _workspace_client.postgres.generate_database_credential(
            endpoint=endpoint,
        )
        if credential.token is None:
            raise RuntimeError("Lakebase credential response did not include a token")
        with _token_cache_lock:
            _token_cache[endpoint] = (credential.token, now + _TOKEN_TTL_SECONDS)
        return credential.token

    # SQLAlchemy fixes the signature of do_connect; the dialect /
    # conn_rec / cargs args aren't used here, but they have to be
    # named so the hook accepts them. Underscore prefix tells the
    # linter we know they're unused.
    @sqlalchemy.event.listens_for(sqlalchemy.engine.Engine, "do_connect")
    def _inject_lakebase_credentials(_dialect, _conn_rec, _cargs, cparams):
        if cparams.get("host") != PGHOST:
            return
        cparams["password"] = _get_cached_token(LAKEBASE_ENDPOINT)
        cparams["sslmode"] = PGSSLMODE

    # ── Start omnigent ─────────────────────────────────────

    import tempfile

    import uvicorn

    from omnigent.runtime import init as init_runtime
    from omnigent.runtime import telemetry
    from omnigent.runtime.agent_cache import AgentCache
    from omnigent.runtime.caps import RuntimeCaps
    from omnigent.server.app import create_app
    from omnigent.server.auth import create_auth_provider, warn_if_single_user_exposed
    from omnigent.util.tunnel_limits import uvicorn_tunnel_kwargs

    # OTel: the Databricks Apps platform auto-injects
    # OTEL_EXPORTER_OTLP_ENDPOINT when `telemetry_export_destinations`
    # is set on the app — telemetry.init() picks that up and routes
    # OTLP to the platform collector, which writes to the configured
    # UC tables. No-op if neither OTEL nor MLflow env vars are set.
    telemetry.init()
    from omnigent.stores.agent_store.sqlalchemy_store import SqlAlchemyAgentStore
    from omnigent.stores.artifact_store.databricks_volumes import (
        DatabricksVolumesArtifactStore,
    )
    from omnigent.stores.comment_store.sqlalchemy_store import (
        SqlAlchemyCommentStore,
    )
    from omnigent.stores.conversation_store.sqlalchemy_store import (
        SqlAlchemyConversationStore,
    )
    from omnigent.stores.file_store.sqlalchemy_store import SqlAlchemyFileStore
    from omnigent.stores.host_store import HostStore
    from omn
```

### Core Architecture Module: `deploy/databricks/src/web_ui_archive.py`
```
"""Safe extraction for the Databricks Apps web UI archive."""

from __future__ import annotations

import tarfile
from pathlib import Path

# These bounds apply after gzip expansion. The compressed archive is separately
# checked against Databricks Apps' 10 MiB source-file limit by deploy.py.
MAX_MEMBERS = 4096
MAX_MEMBER_BYTES = 10 * 1024 * 1024
MAX_EXTRACTED_BYTES = 100 * 1024 * 1024


def extract_web_ui_archive(archive: Path, destination: Path) -> None:
    """Safely extract a bounded web UI archive into ``destination``."""
    with tarfile.open(archive, "r:gz") as tar:
        members = []
        total_size = 0
        # Iterate headers and validate each one before advancing over its data.
        # This rejects a single large member before reading its compressed body.
        for member in tar:
            members.append(member)
            if len(members) > MAX_MEMBERS:
                raise ValueError(f"archive has too many members ({len(members)})")
            if member.isfile():
                if member.size < 0 or member.size > MAX_MEMBER_BYTES:
                    raise ValueError("archive contains a file over the 10 MB limit")
                total_size += member.size
                if total_size > MAX_EXTRACTED_BYTES:
                    raise ValueError("archive expands beyond the web UI size limit")
        # The data filter rejects absolute paths, traversal, links, and special
        # files that could escape or mutate state outside the extraction root.
        tar.extractall(destination, members=members, filter="data")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8601** (2026-09-30): **Nested child sessions and failed retries can lose parent host routing**
  *Symptoms*: On host-sharded deployments, two reproducible routing defects can send child-session requests to a replica without their runner:  1. The server checks only the immediate parent and root for a host. In a tree `root → hosted worker → hostless child → hostless grandchild`, it skips the worker's host and returns the root's host or no host. 2. After `wrong_replica`, the web client remembers keyless routing even when that fallback returns HTTP 400, 500, or 503. Later child retries and parent messages then omit their shared host key.  Expected: resolve the nearest host-bound ancestor, and remember keyless routing only after a successful fallback.  Both cases reproduce in focused regression tests against main `8cc27c6e7`. The affected paths are `omnigent/runner/routing.py:routing_host_id` and the fallback handling in `web/src/lib/identity.ts:authenticatedFetch`. No provider credentials or live agent execution are needed to reproduce them.  Related: #8063. 
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":30.0,"content_hash":"a228357c2c66b38de384297b4e4954d4e11b70ac85849f6073fc2d3c7c9d058b","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** Medium impact - **Priority:** `P2-medium` - **Evidence:** a controlled test - **Why:** No type override: the report describes reproducible incorrect routing in existing behavior. On host-sharded deployments with nested child sessions, requests and parent messages can be sent to replicas without the runner, disrupting session progress for that affected user segment. The report does not specify a workaround; the focused regression tests provide enough evidence to investigate.  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. #8486, #8357, #3067 may be related — could you take a look in case they already cover this?  If it turns out to be the same problem, please close this one and add your details there. Otherwise leave a note and we'll pick it up here. 

- **Issue #8573** (2026-09-29): **[Bug] Claude-native conversations can disappear when hook TMPDIR differs**
  *Symptoms*: ### Description  A Claude-native session can run successfully while Omnigent persists no conversation messages or external Claude session ID. The runner creates its bridge under one temporary root, but Claude's hook and MCP subprocesses may inherit a different TMPDIR and recompute a different security allowlist. Every observer hook is then rejected, so Omnigent never discovers the Claude transcript.  Expected: hook and MCP subprocesses validate against the same bridge root the runner used, and the completed conversation is persisted normally.  ### Steps to reproduce  1. Start a runner whose Python process resolves its temporary directory to `/tmp`, creating a bridge below `/tmp/omnigent-<uid>/claude-native/`. 2. Launch Claude Code so its hook subprocesses inherit a different value such as `TMPDIR=/var/tmp/bztmp`. 3. Run a successful Claude-native conversation and inspect the observer hook diagnostics.  Each hook rejects the `/tmp/...` bridge because its allowed Claude root was recomputed below `/var/tmp/bztmp/...`. The Omnigent session consequently has no persisted messages or native Claude session ID. Re-running a hook with `TMPDIR=/tmp` succeeds and backfills the transcript, confirming the mismatch as the cause.  ### Version  0.12.0 observed; cached 0.15.0 code also lacks explicit temp-root pinning  ### OS  Linux (exact distribution/version unknown)  ### Harness  _No response_  ### Harness mode  _No response_  ### Platform or device  _No response_  ### Observed impact  None
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":30.0,"content_hash":"685a3e50e862ae98cbdba97859c4260b93e8dd23a2c23abb00e2f027fe5facc9","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** Medium impact - **Priority:** `P2-medium` - **Evidence:** a controlled test - **Why:** A failure was observed: successful Claude-native conversations can complete without persisted messages or an external Claude session ID when the runner and hook subprocesses resolve different temporary roots. The supplied reproduction is a plausible user-facing sequence involving a runner, Claude Code, a successful conversation, and observer-hook diagnostics; rerunning the hook with the runner's TMPDIR succeeds and backfills the transcript, providing controlled confirmation of the cause. No type  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.

- **Issue #8543** (2026-09-30): **[Bug] MCP url ${VAR} is not expanded when `omnigent run` uploads a session bundle**
  *Symptoms*: ### Description  An MCP server declared with an environment variable in its URL, for example  ```yaml # tools/mcp/pipeshub.yaml name: pipeshub transport: http url: ${PIPESHUB_MCP_URL} ```  works when the spec is parsed locally, but under `omnigent run <agent-dir>` the server receives the literal string `${PIPESHUB_MCP_URL}` as the URL, so the MCP connection fails. The same happens for an inline MCP server in `config.yaml`'s `tools:` block, and there it affects `headers` and `env` too, not just `url`.  **Why it happens.** `${VAR}` expansion of MCP `url` was added to the spec parser, but only for parses that run with `expand_env=True`. The path `omnigent run` actually uses never takes it:  1. `omnigent run` bundles the agent directory and uploads it. The bundler (`_resolve_bundle_env_vars` in `omnigent/cli.py`) resolves `${VAR}` in `tools/mcp/*.yaml` for `headers` and `env` only, not `url`. 2. The same bundler's `config.yaml` rewrite (`_expand_config_env_vars`) covers `llm.connection`, `executor.connection`/`auth` and `tools.builtins`, but not inline `tools.<name>` entries with `type: mcp`, so their `url`, `headers` and `env` are shipped unresolved. 3. The server re-parses uploaded bundles with `expand_env=False` (`omnigent/server/bundles.py`), and session-scoped runners load them the same way. That is deliberate and correct: expanding a tenant-supplied `${VAR}` against the server's own environment would leak server secrets. So anything the client doesn't resolve reaches the se
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":30.0,"content_hash":"a3404de1cee89172d5b5eab7b2313b498986c687f71a5b35866ce9a5996dcb67","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** Medium impact - **Priority:** `P2-medium` - **Evidence:** direct reproduction steps - **Why:** No type override: the report describes existing behavior that fails to expand MCP environment variables before upload. This affects users running agents with MCP servers configured through environment-variable values; the MCP connection is blocked for those configurations, though using literal values is a practical workaround. Impact is medium because the failure is reproduced and has that workaround.  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. This looks like the same problem as #8338 — could you take a look?  If it covers your case, please close this one and add anything new over on #8338 so the discussion stays in one place. If it doesn't, say what's different and we'll pick it up here. 

- **Issue #8493** (2026-09-28): **Web chat header shows claude-native-ui instead of Claude Code**
  *Symptoms*: ## Problem The web chat header displays the internal agent name `claude-native-ui` when viewing an ordinary Claude Code child session. It should display `Claude Code`.  ## Reproduction Open a child session bound to the built-in Claude Code agent, with the regular `claude-code-native-ui` wrapper (or without a wrapper label) and no explicit sub-agent name. The breadcrumb after the parent session title shows `claude-native-ui`.  ## Evidence Reproduced with a focused ChatHeader render against main at a6074c120: the header renders the raw bound-agent name, and an assertion for `Claude Code` fails. Native Task children already resolve the product name through their sub-agent wrapper; ordinary child sessions fall through to the raw name.  ## Expected Resolve canonical built-in agent names through the existing display-name registry. Preserve custom agent names and explicit sub-agent names.  ## Environment Omnigent web UI; Claude Code native harness. Also reproducible for the equivalent Codex child-session header. No session execution or navigation failure; this is a label-only bug.
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":10.0,"content_hash":"c958959aab989c9900652b1297b501296bbedf8fd8e6b8c9380346ce360c2b46","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** Low impact - **Priority:** `P3-low` - **Evidence:** a controlled test - **Why:** This remains a Bug because it reports incorrect existing UI behavior rather than requesting a new capability; a focused ChatHeader render reproduced the failure and verified that the raw bound-agent name is rendered instead of Claude Code. The affected CUJ is viewing and identifying an existing child session in the web UI; session execution, navigation, and results are not blocked, and the practical workaround is to infer the harness from surrounding UI context. The issue is a cosmetic, label-on  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. This looks like the same problem as #4269, which has already been fixed — so the fix may have shipped after the build you're on.  Could you check whether you're on a version that includes it? If you are and this still happens, say so here — that makes it a regression rather than a duplicate, and we'll keep this open. 

- **Issue #8491** (2026-09-29): **Relay swallows a turn's completion after a false runner_disconnected fail, and polls GET /stream every 0.5 s during an outage**
  *Symptoms*: Two follow-ups to #8412 (runner-disconnect false fatals), left open by #8413 and #8152.  ## 1. The sticky-failed rule swallows the completion  `_publish_status` drops any `idle` while the cache reads `failed`. The rule protects a real turn error from the quiet-pane `idle` that follows it one second later. But when a false `runner_disconnected` fail lands and the runner then finishes the turn, its completion `idle` is swallowed: the red card with Retry stays until the next user message, even though the answer already arrived.  **Fix.** In the relay's status-edge handler, when the runner reports `idle` and the cache says `failed`, route through `_publish_runner_recovered_status(require_disconnect_code=True)`, which already clears exactly a `runner_disconnected` failure and its labels on passive reconnect. Any other failure code stays sticky.  ## 2. The relay polls the stream every 0.5 s for the whole grace  Only the disconnect timer became event-driven in #8413. `_relay_runner_stream` still sleeps `_RELAY_RETRY_INTERVAL_S` and re-opens `GET /stream` until the deadline. With the 90 s lease that is up to 180 stream opens per session per outage, each logging a `retrying` line; a single 45 s blackout produces about 94 attempts. In managed this was about 100k give-up rows a week before the grace was raised.  **Fix.** Give `WSTunnelTransport` a `wait_for_runner(timeout_s)` over the registry's existing event-driven waiter, and have the relay park on it instead of sleeping. One attempt
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":30.0,"content_hash":"bdf2b2e0f06ec8d834b3920c2663d66b4f1e29885b0ae91955e8d27dd7560e00","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** Medium impact - **Priority:** `P2-medium` - **Evidence:** a controlled test - **Why:** A false runner-disconnected status can leave a completed session visibly failed and cause excessive stream polling during outages; the answer remains available and sending another message can clear the stale failure, so the CUJ is degraded but not permanently blocked.  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. #8412, #4554, #8342 may be related — could you take a look in case they already cover this?  If it turns out to be the same problem, please close this one and add your details there. Otherwise leave a note and we'll pick it up here. 

- **Issue #8483** (2026-09-28): **Polly/Debby SDK brains ignore global model and antigravity.model in spawn env**
  *Symptoms*: ## Summary `omnigent config set --global model=…` and `antigravity.model` / `cursor.model` in `config.yaml` are not applied when spawning SDK brains for agents that omit `executor.model` (Polly/Debby with harness override). Spawn env builders only honor the **spec** model.  ## Environment - omnigent 0.15.0 - cursor-sdk 1.0.32, google-antigravity 0.1.20 - Host: ChromeOS Crostini (Debian 12, aarch64)  ## Repro 1. Set in `~/.omnigent/config.yaml`:    ```yaml    model: composer-2.5    antigravity:      model: gemini-2.5-flash      api_key_ref: keychain:antigravity    ``` 2. Start Polly with brain **Antigravity** (or **Cursor**) without picking a model in the UI. 3. Inspect runner log for the session.  ## Actual ``` antigravity gateway routing: ... model=None ``` (or Cursor falls through to `auto-smart` — see companion issue). Antigravity then uses the SDK/provider default (observed earlier as busy `gemini-3.8-flash` → 503), ignoring `antigravity.model`.  ## Expected When spec model is unset, `_build_*_spawn_env` should fall back to: - Cursor: global `model` or `cursor.model` - Antigravity: `antigravity.model` and set `HARNESS_CURSOR_MODEL` / `HARNESS_ANTIGRAVITY_MODEL` accordingly.  ## Code pointers - `omnigent/runtime/workflow.py` — `_build_cursor_spawn_env`, `_build_antigravity_spawn_env`  ## Workaround UI model picker per session, or local patch reading `load_config()` in those builders.
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":30.0,"content_hash":"d05fe50f89ac6d1cc99cbeab13cb7922733d41824364bd5098b29f40be933775","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** Medium impact - **Priority:** `P2-medium` - **Evidence:** diagnostic evidence - **Why:** Retained as a Bug because the report describes existing configuration being ignored, not a request for new capability. The affected users are Polly/Debby users launching Cursor or Antigravity SDK brains without an explicit session model; this can cause the provider default to be selected and may prevent a session from starting, but the CUJ is not universally blocked because users can choose a model in the UI or patch configuration handling locally. The report provides a plausible public CLI/conf  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. #8482 may be related — could you take a look in case it already covers this?  If it turns out to be the same problem, please close this one and add your details there. Otherwise leave a note and we'll pick it up here. 
  > Thanks — related to #8482, but not the same surface.  - **#8482** is Cursor’s hardcoded `auto-smart` fallback when no model is set. - **#8483** is the broader spawn-env gap: Polly/Debby SDK brains ignore config defaults (`model` / `cursor.model` / `antigravity.model`), so Antigravity also ships with `model=None` and picks an unintended SDK default.  Both are addressed in one change: https://github.com/omnigent-ai/omnigent/pull/8485   Please keep this open (or close it as fixed-by that PR) rather than folding solely into #8482 — the Antigravity path needs the `antigravity.model` half.

- **Issue #8482** (2026-09-28): **cursor SDK brain defaults to auto-smart, which many Cursor API keys reject (Polly/Debby)**
  *Symptoms*: ## Summary When Polly/Debby (or any agent whose spec has no `executor.model`) is run with harness override `cursor`, omnigent does not set `HARNESS_CURSOR_MODEL`. The Cursor executor then falls back to hardcoded `_DEFAULT_CURSOR_MODEL = "auto-smart"`. Many Cursor API keys reject that id at agent create time.  Related: #547 (model switcher / IDs) — this is the default-fallback half of that pain.  ## Environment - omnigent 0.15.0 - cursor-sdk 1.0.32 - Host: ChromeOS Crostini (Debian 12, aarch64)  ## Repro 1. Configure Cursor API key (`omnigent[cursor]` extra + `cursor.api_key_ref`). 2. Optionally set global `model: composer-2.5` in `~/.omnigent/config.yaml`. 3. Start Polly (or Debby) in the web UI and pick **Cursor** as the brain. 4. Send any message (no model override in the session).  ## Actual ``` Failed to start cursor-sdk agent: invalid_argument: Cannot use this model: auto-smart. Available models: default, grok-4.7, ..., composer-2.5, ... ``` Runner log shows harness=`cursor`. Global `model` is **not** applied to spawn env.  ## Expected - Honor global `model` / `cursor.model` when the agent spec has no model, **or** - Default to a catalog id that `Cursor.models.list()` returns for the account (e.g. `default` / `composer-2.5`), not a hardcoded `auto-smart`.  ## Code pointers - `omnigent/inner/cursor_executor.py` — `_DEFAULT_CURSOR_MODEL = "auto-smart"` - `omnigent/runtime/workflow.py` — `_build_cursor_spawn_env` only sets `HARNESS_CURSOR_MODEL` from `_resolve_spec_model(sp
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":30.0,"content_hash":"7b0563d1fb03788cc2dd9e1fae63ce78ef022fc2f59c1385eb37ad32bfce5156","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** Medium impact - **Priority:** `P2-medium` - **Evidence:** diagnostic evidence - **Why:** This is a Bug, with no type override: the report describes observed incorrect behavior in the existing Cursor SDK integration. The supplied UI reproduction is complete and plausible, and the exact Cursor SDK rejection plus runner-log detail provide diagnostic evidence. Affected users cannot start Cursor-backed Polly/Debby sessions without an accepted model, which blocks the submit-request CUJ for agents lacking an explicit model, but selecting a valid model per session provides an easy workaroun  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.
  > <!-- omnigent-duplicate-check --> Thanks for reporting this. #547 may be related, and has already been fixed — so the fix may have shipped after the build you're on.  Could you check whether you're on a version that includes it? If you are and this still happens, say so here — that makes it a regression rather than a duplicate, and we'll keep this open. 
  > Thanks for the pointer to #547.  This is still reproducible after that work. #547 was about model switcher / IDs in the UI; this issue is the **Cursor SDK brain default** when Polly/Debby leave `executor.model` unset: spawn env omits `HARNESS_CURSOR_MODEL`, then `cursor_executor` falls back to hardcoded `auto-smart`, which many Cursor API keys reject.  Reproduced on omnigent **0.15.0** and again on current `main` (`0.16.0.dev0`). Please keep this open as a regression / remaining gap rather than closing as a duplicate of #547.  Fix proposed in https://github.com/omnigent-ai/omnigent/pull/8485 (also covers #8483).

- **Issue #8480** (2026-09-28): **Require session ownership to manage MCP configuration**
  *Symptoms*: ## Problem  MCP configuration should require ownership of the session. The current UI offers MCP management controls to collaborators, while the backend checks agent creation ownership separately from session access.  ## Expected behavior  - Require session-owner access to add, edit, or remove an MCP server, for both HTTP and stdio transports where deployment policy permits them. - Apply the same requirement to whole-agent uploads, which can replace MCP configuration. - Keep configured MCPs visible to readers, editors, and managers, but hide their management controls. - Preserve the existing agent-creator checks, administrator access, and deployment transport restrictions. 
  **Post-Mortem & Fix Analysis**:
  > <!-- omnigent-issue-prioritization-v2 {"schema_version":2,"base_score":30.0,"content_hash":"79a1f857b23262712906ff1230a121bab31680b156eb9fd5a766521b64c5d648","information_status":"sufficient","needs_info_deadline":null} --> 🤖 **Automated triage**  - **Bot assessment:** Medium impact - **Priority:** `P2-medium` - **Evidence:** direct reproduction steps - **Why:** This is a Bug, not a Feature: it reports an existing authorization mismatch where collaborators can manage MCP configuration, rather than requesting an unrelated new capability. The affected CUJ is managing a session's agent configuration; it is not necessarily blocked because the owner or administrator can still manage MCPs, and a workaround is to restrict collaborator access or have the owner perform changes. The report describes a plausible user-facing collaborator workflow and the expected a  This automated assessment uses the issue content and repository signals. Maintainers can override the priority label.

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

### Incident Patch 1: `8708a069` (2026-09-30)
**Commit Message**: fix(cli): expand ${VAR} in MCP url when uploading a session bundle (#8544)

* fix(cli): expand ${VAR} in MCP url when uploading a session bundle

`omnigent run` uploads the agent as a session bundle, and the server
re-parses it with expand_env=False so a tenant's ${VAR} is never
resolved against the server's environment. The client bundler resolved
MCP headers/env from tools/mcp/*.yaml but not url, and skipped inline
`type: mcp` entries in config.yaml entirely, so those reached the
server as literal ${VAR} strings.

Resolve url, headers and env for both directory and inline MCP servers
at upload time from the uploading user's environment, through one
shared helper. A missing variable now fails the upload with the
parser's "Unresolved environment variable" error.

Closes #8543

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F6pVKn77Twn89rN1d2ZpuQ
Signed-off-by: Shekhar Kadyan <shekharkadyan@gmail.com>

* test+docs: cover MCP url expansion on the omnigent run upload path

Add an end-to-end regression test that drives the real
`omnigent run ./folder -p ...` journey with an MCP server addressed
through `${VAR}` -- s

**File**: `omnigent/cli.py` (modified, +83/-15)
```diff
@@ -6054,9 +6054,11 @@ def _resolve_bundle_env_vars(source: Path) -> dict[str, str]:
 
     - ``config.yaml``: ``llm.connection.*`` and
       ``executor.connection.*`` values, ``executor.auth``
-      ``api_key`` / ``base_url`` (when ``type: api_key``), and
-      ``tools.builtins[*]`` dict-entry values (except ``name``)
-    - ``tools/mcp/*.yaml``: ``headers.*`` and ``env.*`` values
+      ``api_key`` / ``base_url`` (when ``type: api_key``),
+      ``tools.builtins[*]`` dict-entry values (except ``name``), and
+      inline ``tools.<name>`` MCP servers' ``url``, ``headers.*`` and
+      ``env.*`` values
+    - ``tools/mcp/*.yaml``: ``url``, ``headers.*`` and ``env.*`` values
 
     These mirror the server-side parser's ``${VAR}`` expansion
     sites. Resolving here, against the client's own environment,
@@ -6086,24 +6088,13 @@ def _resolve_bundle_env_vars(source: Path) -> dict[str, str]:
                 )
 
     # ── tools/mcp/*.yaml ─────────────────────────────
-    # ``headers`` (HTTP transport auth) and ``env`` (stdio transport
-    # process env) are both secret-bearing and both expanded by the
-    # server-side parser, so resolve both client-side.
     mcp_dir = source / "tools" / "mcp"
     if mcp_dir.is_dir():
         for yaml_file in sorted(mcp_dir.glob("*.yaml")):
             raw = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
             if not isinstance(raw, dict):
                 continue
-            changed = False
-            for field in ("headers", "env"):
-                value = raw.get(field)
-                if isinstance(value, dict):
-                    raw[field] = expand_env_vars(
-                        {str(k): str(v) for k, v in value.items()},
-                    )
-                    changed = True
-            if changed:
+            if _expand_mcp_server_env_vars(raw, expand_env_vars):
                 arcname = str(yaml_file.relative_to(source))
                 resolved[arcname] = yaml.dump(
                     raw,
@@ -6220,6 +6211,8 @@ def _expand_config_env_vars(  # type: ignore[explicit-any]  # raw is parsed YAML
     - ``executor.auth`` — ``api_key`` / ``base_url`` when
       ``type == "api_key"``
     - ``tools.builtins[*]`` — dict-entry values except ``name``
+    - ``tools.<name>`` inline MCP servers — ``url``, ``headers`` and
+      ``env`` values
 
     :param raw: The parsed config.yaml dict (modified in-place).
     :param expand_fn: Callable that expands env var references
@@ -6264,6 +6257,81 @@ def _expand_config_env_vars(  # type: ignore[explicit-any]  # raw is parsed YAML
             or changed
         )
 
+    return _expand_inline_mcp_env_vars(raw.get("tools"), expand_fn) or changed
+
+
+def _expand_inline_mcp_env_vars(
+    raw_tools: object,
+    expand_fn: Callable[[dict[str, str]], dict[str, str]],
+) -> bool:
+    """
+    Expand ``${VAR}`` references in inline ``type: mcp`` entries of
+    config.yaml's ``tools:`` block, modifying them in-place.
+
+    Selects the same entries the parser's ``_parse_inline_mcp_servers``
+    expands: mappings with ``type: mcp`` under a non-reserved key that
+    declare a ``command`` or ``url``.
+
+    :param raw_tools: The raw ``tools:`` value from config.yaml, e.g.
+        ``{"search": {"type": "mcp", "url": "${SEARCH_URL}"}}``.
+        Non-dict values are ignored.
+    :param expand_fn: Callable that expands env var references
+        in a string-to-string dict.
+    :returns: ``True`` if any values were expanded.
+    """
+    from omnigent.spec.parser import _TOOLS_CONFIG_KEYS
+
+    if not isinstance(raw_tools, dict):
+        return False
+    changed = False
+    for key, entry in raw_tools.items():
+        if key in _TOOLS_CONFIG_KEYS or not isinstance(entry, dict):
+            continue
+        if str(entry.get("type", "")) != "mcp":
+            continue
+        if entry.get("command") is None and entry.get("url") is None:
+            continue
+        changed = _expand_mcp_server_env_vars(e
```

**File**: `omnigent/spec/AGENTSPEC.md` (modified, +2/-2)
```diff
@@ -268,8 +268,8 @@ defaults apply: **5 seconds** for the initial HTTP connection handshake and
 `timeout` overrides both values to the same number of seconds.
 
 **Security note — `${VAR}` is NOT expanded for uploaded bundles:**
-``${VAR}`` references in `headers`, `env`, and connection blocks are
-resolved against the spec author's *own* environment at the client /
+``${VAR}`` references in MCP `url`, `headers`, `env`, and connection blocks
+are resolved against the spec author's *own* environment at the client /
 registration boundary (`omnigent.cli._resolve_bundle_env_vars`), never
 at runtime by the server or runner for a tenant-uploaded
 (session-scoped) bundle. Expanding an uploaded spec's ``${VAR}`` against
```

**File**: `tests/cli/test_cli.py` (modified, +228/-0)
```diff
@@ -3223,6 +3223,234 @@ def test_bundle_no_env_vars_preserves_files(
     assert parsed["llm"]["model"] == "openai/gpt-4o"
 
 
+# ── MCP url/headers/env through the upload path ────────────
+
+
+def _write_upload_agent(
+    agent_dir: Path,
+    tools: dict[str, Any] | None = None,
+) -> None:
+    """
+    Write a minimal agent ``config.yaml`` the server accepts on upload.
+
+    :param agent_dir: The agent image directory.
+    :param tools: Optional ``tools:`` block, e.g. inline MCP servers
+        ``{"search": {"type": "mcp", "url": "${SEARCH_URL}"}}``.
+    """
+    config: dict[str, Any] = {
+        "spec_version": 1,
+        "name": "mcp-upload-agent",
+        "prompt": "hi",
+        "executor": {"type": "omnigent", "config": {"harness": "claude-sdk"}},
+    }
+    if tools is not None:
+        config["tools"] = tools
+    _write_config(agent_dir, config)
+
+
+def _upload_and_parse(agent_dir: Path) -> dict[str, Any]:
+    """
+    Bundle *agent_dir* as ``omnigent run`` does, then parse it the way
+    the server parses an uploaded session bundle.
+
+    :param agent_dir: The agent image directory.
+    :returns: ``{server_name: MCPServerConfig}`` from the server-side spec.
+    """
+    from omnigent.server.bundles import validate_agent_bundle
+
+    spec = validate_agent_bundle(_bundle(agent_dir), enforce_handler_allowlist=False)
+    return {server.name: server for server in spec.mcp_servers}
+
+
+def test_bundle_upload_resolves_directory_mcp_url(
+    tmp_path: Path,
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    """
+    A ``tools/mcp/*.yaml`` server's ``url: ${VAR}`` reaches the server
+    resolved, since the server re-parses uploads without expansion.
+    """
+    monkeypatch.setenv("UPLOAD_MCP_URL", "https://mcp.example.invalid")
+    monkeypatch.setenv("UPLOAD_MCP_TOKEN", "tok-dir")
+    _write_upload_agent(tmp_path)
+    _write_mcp_config(
+        tmp_path,
+        "pipeshub",
+        {
+            "name": "pipeshub",
+            "transport": "http",
+            "url": "${UPLOAD_MCP_URL}/mcp",
+            "headers": {"Authorization": "Bearer ${UPLOAD_MCP_TOKEN}"},
+        },
+    )
+
+    servers = _upload_and_parse(tmp_path)
+
+    assert servers["pipeshub"].url == "https://mcp.example.invalid/mcp"
+    assert servers["pipeshub"].headers == {"Authorization": "Bearer tok-dir"}
+
+
+def test_bundle_upload_resolves_inline_mcp_fields(
+    tmp_path: Path,
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    """
+    Inline ``tools:`` MCP servers in config.yaml have ``url``,
+    ``headers`` and ``env`` resolved before upload.
+    """
+    monkeypatch.setenv("INLINE_MCP_URL", "https://inline.example.invalid/mcp")
+    monkeypatch.setenv("INLINE_MCP_TOKEN", "tok-inline")
+    monkeypatch.setenv("INLINE_STDIO_SECRET", "stdio-inline")
+    _write_upload_agent(
+        tmp_path,
+        tools={
+            "search": {
+                "type": "mcp",
+                "url": "${INLINE_MCP_URL}",
+                "headers": {"Authorization": "Bearer ${INLINE_MCP_TOKEN}"},
+            },
+            "local": {
+                "type": "mcp",
+                "command": "my-mcp-server",
+                "env": {"API_TOKEN": "${INLINE_STDIO_SECRET}"},
+            },
+        },
+    )
+
+    servers = _upload_and_parse(tmp_path)
+
+    assert servers["search"].url == "https://inline.example.invalid/mcp"
+    assert servers["search"].headers == {"Authorization": "Bearer tok-inline"}
+    assert servers["local"].env == {"API_TOKEN": "stdio-inline"}
+    # The shipped config.yaml itself carries the resolved values, since the
+    # runtime tool loader reads them from the raw YAML.
+    shipped = _extract_yaml_from_bundle(_bundle(tmp_path), "config.yaml")
+    assert shipped["tools"]["search"]["url"] == "https://inline.example.invalid/mcp"
+    assert shipped["tools"]["local"]["env"] == {"API_TOKEN": "stdio-inline"}
+
+
+@pytest.mark.parametrize("layout", ["directory", "inline"])
+def test_bundl
```

**File**: `tests/e2e/test_run_mcp_url_env_expansion_e2e.py` (added, +412/-0)
```diff
@@ -0,0 +1,412 @@
+"""``omnigent run ./folder`` must upload MCP ``${VAR}`` references resolved.
+
+Journey: an agent folder declares an MCP server whose ``url`` (sidecar
+``tools/mcp/*.yaml`` or inline ``tools.<name>: {type: mcp}``) or stdio ``env``
+reads from the user's environment. The user exports the variables and launches
+``omnigent run ./company-knowledge/ -p "..."``; the runner must connect to the
+resolved server so the model can call its tools.
+
+Usage::
+
+    python -m pytest tests/e2e/test_run_mcp_url_env_expansion_e2e.py -v
+"""
+
+from __future__ import annotations
+
+import contextlib
+import json
+import os
+import re
+import socket
+import subprocess
+import sys
+import time
+import uuid
+from collections.abc import Iterator
+from pathlib import Path
+from typing import Any
+
+import httpx
+import pytest
+import yaml
+
+from tests.e2e.conftest import configure_mock_llm, get_mock_requests, reset_mock_llm
+
+_REPO_ROOT = Path(__file__).resolve().parents[2]
+_FIXTURES = _REPO_ROOT / "tests" / "tools" / "fixtures"
+_ECHO_HTTP_MCP_SERVER = _FIXTURES / "echo_http_mcp_server.py"
+_ENV_PROBE_STDIO_MCP_SERVER = _FIXTURES / "env_probe_stdio_mcp_server.py"
+
+_AGENT_NAME = "company-knowledge"
+_SERVER_NAME = "pipeshub"
+_URL_VAR = "PIPESHUB_MCP_URL"
+_TOKEN_VAR = "PIPESHUB_MCP_TOKEN"
+_REGION_VAR = "PIPESHUB_REGION"
+_REGION = "eu-west-1"
+
+# One launch covers daemon spawn, local-server boot, bundle upload, runner
+# bring-up and a single mocked tool round-trip (~30s observed).
+_RUN_TIMEOUT_S = 240
+_STOP_TIMEOUT_S = 120
+
+_SESSION_LINE_RE = re.compile(r"Omnigent session: (?P<base>https?://[^/\s]+)/c/(?P<sid>[0-9a-f]+)")
+_PROXY_VARS = frozenset({"HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"})
+
+
+def _free_port() -> int:
+    with socket.socket() as sock:
+        sock.bind(("127.0.0.1", 0))
+        return sock.getsockname()[1]
+
+
+def _wait_for_listen(port: int, timeout_s: float = 30.0) -> None:
+    deadline = time.monotonic() + timeout_s
+    while time.monotonic() < deadline:
+        with contextlib.suppress(OSError):
+            socket.create_connection(("127.0.0.1", port), timeout=1).close()
+            return
+        time.sleep(0.2)
+    raise TimeoutError(f"nothing listening on 127.0.0.1:{port} after {timeout_s}s")
+
+
+@pytest.fixture(scope="module")
+def echo_mcp_base_url(tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
+    """A real streamable-HTTP MCP server; ``${PIPESHUB_MCP_URL}`` resolves to its base URL."""
+    port = _free_port()
+    log_path = tmp_path_factory.mktemp("echo_mcp") / "echo_mcp.log"
+    with log_path.open("w") as log:
+        proc = subprocess.Popen(
+            [sys.executable, str(_ECHO_HTTP_MCP_SERVER), str(port)],
+            stdout=log,
+            stderr=subprocess.STDOUT,
+        )
+    try:
+        _wait_for_listen(port)
+        yield f"http://127.0.0.1:{port}"
+    finally:
+        proc.terminate()
+        with contextlib.suppress(subprocess.TimeoutExpired):
+            proc.wait(timeout=5)
+        if proc.poll() is None:
+            proc.kill()
+
+
+def _write_agent_folder(
+    root: Path,
+    *,
+    layout: str,
+    mock_llm_server_url: str,
+    url: str | None = None,
+) -> Path:
+    """Write the reporter's ``company-knowledge/`` folder with the MCP server per *layout*."""
+    agent_dir = root / _AGENT_NAME
+    agent_dir.mkdir()
+    config: dict[str, Any] = {
+        "spec_version": 1,
+        "name": _AGENT_NAME,
+        "executor": {
+            "type": "omnigent",
+            "model": "gpt-4o",
+            "config": {"harness": "openai-agents"},
+            "auth": {
+                "type": "api_key",
+                "api_key": "mock-key",
+                "base_url": f"{mock_llm_server_url}/v1",
+            },
+        },
+        "prompt": "Answer questions from the company knowledge base using the pipeshub tools.",
+    }
+    http_server = {"url": url, "headers": {"Authorization": f"Bearer ${{{_TOKEN_VAR}}}"}}
+    if
```

---

### Incident Patch 2: `88327827` (2026-09-30)
**Commit Message**: fix(web): keep the session menu above the terminal Connecting overlay (#7845)

The terminal StatusOverlay (absolute inset-0 z-[10000]) resolved its
z-index at the page level because the terminal view creates no stacking
context, so it painted over — and intercepted taps meant for — the
session menu, a Radix dropdown portaled to <body> at z-50. Most visible
on phones, where a terminal-first session shows the overlay full-screen
while its terminal bridge is still dialing.

Scope the overlay with `isolate` on the terminal view root: it still
covers everything inside the terminal surface but can no longer
out-stack body-portaled UI.

Co-authored-by: omni-resolve-agent[bot] <omni-resolve-agent[bot]@users.noreply.github.com>

**File**: `tests/e2e_ui/mobile/test_connecting_overlay_session_menu.py` (added, +167/-0)
```diff
@@ -0,0 +1,167 @@
+"""E2E: the terminal "Connecting…" overlay must not bury the session menu.
+
+The iOS shell renders this same SPA in a WebView, so a phone-sized
+viewport reproduces its layout. A terminal-first session whose terminal
+bridge is still dialing paints the full-surface "Connecting…" status
+overlay — a translucent layer over the whole terminal area. The header's
+session menu is a dropdown portaled to ``<body>``; while the overlay is
+up, an open menu must stay usable (its items hit-testable and tappable),
+or the menu must not present as open at all. The broken state is a menu
+that is open yet painted over by the translucent overlay, leaving its
+rows faintly visible but untappable.
+
+The terminal-attach WebSocket is replaced with a dial that never
+completes — what a phone on a stalled network sees — so the terminal
+stays in "Connecting…" deterministically while the menu is exercised.
+"""
+
+from __future__ import annotations
+
+import json
+import re
+import time
+
+import httpx
+from playwright.sync_api import Page, Route, ViewportSize, expect
+
+_MOBILE_VIEWPORT: ViewportSize = {"width": 390, "height": 844}
+
+# Replace the terminal-attach WebSocket with a dial that never completes
+# (readyState stays CONNECTING), pinning the status overlay to "Connecting…".
+_HOLD_ATTACH_DIAL = """
+(() => {
+  const NativeWebSocket = window.WebSocket;
+  const heldUrl = /\\/resources\\/terminals\\/[^/]+\\/attach/;
+  function HeldWebSocket(url, protocols) {
+    if (!heldUrl.test(String(url))) {
+      return protocols === undefined
+        ? new NativeWebSocket(url)
+        : new NativeWebSocket(url, protocols);
+    }
+    const stub = new EventTarget();
+    return Object.assign(stub, {
+      url: String(url),
+      readyState: NativeWebSocket.CONNECTING,
+      bufferedAmount: 0,
+      extensions: "",
+      protocol: "",
+      binaryType: "arraybuffer",
+      onopen: null,
+      onmessage: null,
+      onerror: null,
+      onclose: null,
+      send() {},
+      close() {
+        stub.readyState = NativeWebSocket.CLOSED;
+      },
+    });
+  }
+  HeldWebSocket.prototype = NativeWebSocket.prototype;
+  for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
+    HeldWebSocket[k] = NativeWebSocket[k];
+  }
+  window.WebSocket = HeldWebSocket;
+})();
+"""
+
+
+def _serve_agent_terminal(route: Route) -> None:
+    """Publish one running agent terminal, the shape the runner reports."""
+    match = re.search(r"/v1/sessions/([^/]+)/", route.request.url)
+    assert match is not None
+    session_id = match.group(1)
+    route.fulfill(
+        status=200,
+        content_type="application/json",
+        body=json.dumps(
+            {
+                "object": "list",
+                "data": [
+                    {
+                        "id": "terminal_tui_main",
+                        "type": "terminal",
+                        "session_id": session_id,
+                        "name": "tui:main",
+                        "metadata": {
+                            "terminal_name": "tui",
+                            "session_key": "main",
+                            "running": True,
+                        },
+                    }
+                ],
+                "first_id": "terminal_tui_main",
+                "last_id": "terminal_tui_main",
+                "has_more": False,
+            }
+        ),
+    )
+
+
+def test_connecting_overlay_keeps_session_menu_usable(
+    page: Page,
+    seeded_session: tuple[str, str],
+) -> None:
+    """An open session menu stays tappable while the terminal is connecting.
+
+    With the attach dial held open the terminal surface shows the
+    "Connecting…" status overlay. Opening the header's session menu must
+    then leave the menu items as the top hit-target at their own centers;
+    a translucent overlay painting above the open menu (items visible but
+    taps landing on the overlay) is the regression.
+    """
+    base_url, sess
```

**File**: `web/src/components/blocks/TerminalView.test.tsx` (modified, +14/-0)
```diff
@@ -1289,6 +1289,20 @@ describe("closed bridge overlay", () => {
   });
 });
 
+describe("status overlay stacking", () => {
+  it("keeps the connecting overlay inside the terminal's own stacking context", async () => {
+    render(<TerminalView sessionId="conv_abc" terminalId="terminal_bash_s1" />);
+    await waitFor(() => expect(terminalSessionMock.instances).toHaveLength(1));
+
+    const view = screen.getByTestId("terminal-view");
+    expect(view).toHaveAttribute("data-state", "connecting");
+    expect(within(view).getByText("Connecting…")).toBeInTheDocument();
+    // Without `isolate`, the overlay's z-index resolves at the page level and
+    // paints over dropdowns portaled to <body> at z-50 (the session menu).
+    expect(view).toHaveClass("isolate");
+  });
+});
+
 describe("automatic reconnect", () => {
   beforeEach(() => {
     // Fake only what the backoff scheduling touches; promises and
```

**File**: `web/src/components/blocks/TerminalView.tsx` (modified, +3/-1)
```diff
@@ -730,13 +730,15 @@ export function TerminalView({
     };
   }, [state, disposeActiveSession, sessionId]);
 
+  // `isolate` scopes the status overlay's z-index to this surface so it
+  // can't paint over body-portaled UI such as the header's session menu.
   return (
     <div
       data-testid="terminal-view"
       data-state={state.kind}
       data-terminal-id={terminalId}
       data-terminal-theme={isDark ? "dark" : "light"}
-      className="relative flex min-h-0 flex-1 flex-col"
+      className="relative isolate flex min-h-0 flex-1 flex-col"
     >
       {visibleClipboardPrompt !== null && (
         <TerminalClipboardPrompt
```

---

### Incident Patch 3: `ad67cb17` (2026-09-30)
**Commit Message**: fix(web): align the sidebar Search bubble with the chat overflow bubble (#7853)

With the phone-width drawer open, the sidebar's round Search button and
the chat header's round overflow button read as one row of paired
top-right controls, but their centers sat 4px apart on thin web (h-12
sidebar header row vs h-14 mobile chat header) and 4px apart in the
opposite direction on native shells (the drawer was padded by the full
safe-area top inset while the chat header sits at safe-top - 0.5rem).

Match the sidebar header row to the mobile chat header height below md,
and give the phone-width native drawer the chat header's safe-top -
0.5rem offset, so the bubbles share a centerline on both surfaces.

Resolves OMNI-9122 (Linear).

Co-authored-by: omni-resolve-agent[bot] <omni-resolve-agent[bot]@users.noreply.github.com>

**File**: `tests/e2e_ui/mobile/test_sidebar_bubble_alignment.py` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+"""E2E: the sidebar Search bubble and the chat-header overflow bubble align.
+
+With the mobile sidebar drawer open, the drawer stops 56px short of the right
+screen edge, so the chat header's round overflow (...) button stays visible in
+the exposed strip directly beside the sidebar's round Search button. The two
+bubbles read as one row of paired top-right controls, so they must share a
+vertical centerline. Guarded on both surfaces where they diverge, in opposite
+directions:
+
+1. Thin web: the sidebar header row must match the mobile chat header height
+   (h-14 below ``md``) or their 44px chips center at different heights and
+   Search rides higher.
+2. iOS shell: the drawer's safe-area top padding must mirror the chat
+   header's ``safe-top - 0.5rem`` offset (index.css) or the offset flips and
+   Search lands lower than the overflow bubble.
+
+The iOS case runs in Chromium with the CDP safe-area override and the
+``window.omnigentNative`` iOS-bridge stub (same stand-in as the sibling
+``test_ios_*`` tests); the geometry under test is plain CSS layout, not
+WebKit-specific rendering.
+"""
+
+from __future__ import annotations
+
+import os
+
+from playwright.sync_api import Browser, BrowserContext, Page, expect
+
+# iPhone-class portrait viewport, below the Tailwind ``md`` breakpoint so the
+# sidebar behaves as an overlay drawer and every ``max-md:`` rule is live.
+_MOBILE_VIEWPORT = {"width": 390, "height": 844}
+
+# iPhone 15-class portrait insets: 59px status bar / Dynamic Island on top.
+_IOS_SAFE_AREA = {"top": 59, "left": 0, "bottom": 34, "right": 0}
+
+_IOS_SHELL_INIT_SCRIPT = """
+window.omnigentNative = {
+  kind: "ios",
+  setBadgeCount: function () {},
+  notify: function () { return Promise.resolve(false); },
+  onNotificationActivated: function () { return function () {}; },
+  onOpenPath: function () { return function () {}; },
+  onNativeInsets: function () { return function () {}; },
+  onSidebarDrag: function () { return function () {}; },
+  onViewModeChanged: function () { return function () {}; },
+  setViewMode: function () {},
+  setServerSwitcherHidden: function () {},
+  setSidebarOpen: function () {},
+};
+"""
+
+# Half a pixel absorbs subpixel layout rounding; the reported divergence is a
+# full grid step (4px), so anything above 1px is a real misalignment.
+_ALIGN_TOLERANCE_PX = 1.0
+
+
+def _new_mobile_page(browser: Browser) -> tuple[BrowserContext, Page]:
+    context = browser.new_context(
+        viewport=_MOBILE_VIEWPORT,
+        has_touch=True,
+        is_mobile=True,
+        record_video_dir=os.environ.get("OMNIGENT_E2E_RECORD_DIR"),
+    )
+    return context, context.new_page()
+
+
+def _beat(page: Page) -> None:
+    """Pause briefly between journey steps -- only while filming a clip."""
+    if os.environ.get("OMNIGENT_E2E_RECORD_DIR"):
+        page.wait_for_timeout(900)
+
+
+def _open_drawer(page: Page, base_url: str, session_id: str) -> None:
+    """Load the session at phone width and open the sidebar drawer."""
+    page.goto(f"{base_url}/c/{session_id}")
+    expect(page.get_by_label("Message the agent")).to_be_visible(timeout=30_000)
+    assert page.evaluate("matchMedia('(max-width: 767.98px)').matches"), (
+        "expected the mobile (max-md) layout branch to be in effect"
+    )
+
+    toggle = page.get_by_role("button", name="Open sidebar")
+    expect(toggle).to_be_visible(timeout=10_000)
+    _beat(page)
+    toggle.tap()
+    drawer = page.locator('aside[aria-label="Conversations"]')
+    expect(drawer).to_have_attribute("aria-hidden", "false", timeout=5_000)
+    # Let the drawer's slide transition settle before measuring geometry.
+    page.wait_for_timeout(700)
+    _beat(page)
+
+
+def _assert_bubbles_share_centerline(page: Page) -> None:
+    search = page.get_by_test_id("sidebar-search-button")
+    overflow = page.get_by_test_id("header-conversation-actions")
+    expect(search).to_be_visible()
+    expect(overflow).to_be_visible()
+

```

**File**: `web/src/index.css` (modified, +14/-0)
```diff
@@ -1064,6 +1064,20 @@ aside[aria-label="Workspace"][data-maximized] {
   padding-right: min(var(--omnigent-safe-right), var(--omnigent-lateral-inset-cap));
 }
 
+/* At phone widths the open drawer's Search bubble pairs with the chat
+ * header's overflow bubble in the exposed chat strip beside it. The chat
+ * header sits at safe-top - 0.5rem (rule above), so mirror that offset here
+ * or the paired bubbles drift 0.5rem apart. Keeps the specificity of the
+ * padding rule above and follows it in source order so it wins the tie. */
+@media (width < 48rem) {
+  :is([data-ios-native], [data-android-native])
+    aside.conversations-sidebar:not(aside[aria-label="Workspace"] *):not([data-collapsed]):not(
+      .is-peek
+    ) {
+    padding-top: max(0px, calc(var(--omnigent-safe-top) - 0.5rem));
+  }
+}
+
 @media (width < 48rem) and (prefers-reduced-motion: reduce) {
   [data-ios-native] .conversations-sidebar {
     transition-duration: 1ms;
```

**File**: `web/src/shell/Sidebar.tsx` (modified, +4/-1)
```diff
@@ -1000,7 +1000,10 @@ function SidebarImpl({
           brand mark is dropped and the actions slide left to sit beside the
           window controls (see the [data-electron-mac] rules in index.css).
           Inert in a browser and on other platforms, which keep the row below. */}
-            <div className="sidebar-header-row flex h-12 shrink-0 items-center justify-between pr-3 pl-4">
+            {/* h-14 below md matches the mobile chat header height so the
+            Search bubble shares a centerline with the overflow bubble in the
+            chat strip beside the open drawer. */}
+            <div className="sidebar-header-row flex h-14 shrink-0 items-center justify-between pr-3 pl-4 md:h-12">
               {/* Brand mark doubles as the "home" affordance: clicking it
             returns to `/`, the new-session composer. Without this there
             is no way back to the landing composer once you're inside a
```

---

### Incident Patch 4: `7f1324a5` (2026-09-30)
**Commit Message**: fix(web): clear stale "Working…" after a mid-turn server restart (#8644)

* fix(web): clear stale "Working…" after a mid-turn server restart

When the server restarts mid-turn, the chat SSE stream reconnects and runs
reconcileOnReconnect once — but a just-restarted server may not have
reprocessed the turn's completion yet, so that read sees a stale "running"
and the tab stays on "Working…" (with the reply missing) until the 60s
periodic reconcile. A hard reload fixes it (it refetches the settled
snapshot), but the open tab does not self-heal for up to a minute.

Add a short bounded catch-up burst after reconnect
(RECONNECT_STATUS_CATCHUP_DELAYS_MS = 3s/8s/20s) that re-reads durable
status via the existing reconcileActiveSessionStatus. Once the server has
settled, this clears the stale status — and retries the interrupted-preview
final-item backfill — within seconds instead of up to 60s. Each call is
guarded and idempotent, and scoped to the active conversation.

Verified: new regression test asserts a stale "running" clears via the 3s
catch-up (before the 60s interval); an existing final-item-backfill test is
updated to reflect the faster recovery. Full chatStore suite (537) green.

**File**: `web/src/store/chatStore.test.ts` (modified, +76/-5)
```diff
@@ -11232,15 +11232,86 @@ describe("chatStore — startStreamPump reconnect loop", () => {
       await vi.advanceTimersByTimeAsync(20);
       seedSessionItems("conv_interrupted_retry", [assistantMessage("resp_1", "canonical answer")]);
       sinks[0]!.error();
+      // The reconnect's first backfill attempt fails (itemAttempts === 1). The
+      // post-reconnect catch-up burst (RECONNECT_STATUS_CATCHUP_DELAYS_MS, first
+      // at 3s) re-reads status, which — with the interrupted preview still
+      // present — retries the failed final-item backfill. So the canonical item
+      // recovers within seconds rather than waiting out the 60s periodic
+      // reconcile.
       await vi.advanceTimersByTimeAsync(6000);
+      await drainAsync(2);
       expect(sinks).toHaveLength(2);
-      expect(itemAttempts).toBe(1);
-      expect(useChatStore.getState().blocks.some((b) => b.ctx.itemId === "live:m1")).toBe(true);
+      expect(itemAttempts).toBe(2);
+      expect(useChatStore.getState().blocks.map((b) => b.ctx.itemId)).toEqual(["msg_resp_1_asst"]);
+      expect(useChatStore.getState().blocks.some((b) => b.ctx.itemId === "live:m1")).toBe(false);
+    } finally {
+      controller.abort();
+      const last = sinks[sinks.length - 1];
+      if (last) {
+        last.push("data: [DONE]\n\n");
+        last.close();
+      }
+      await vi.advanceTimersByTimeAsync(20);
+      await loop;
+    }
+  });
 
-      await advanceWithHeartbeats(sinks[1]!, ACTIVE_SESSION_STATUS_RECONCILE_INTERVAL_MS);
+  it("clears a stale 'running' via the reconnect catch-up burst, before the 60s reconcile", async () => {
+    // Reproduces the mid-turn server-restart bug: the reconnect's immediate
+    // reconcile reads a still-"running" snapshot (the restarted server hasn't
+    // reprocessed the turn's completion yet), so the tab stays on "Working…".
+    // The catch-up burst re-reads status a few seconds later — once the server
+    // has settled to idle — and clears it, instead of stranding the tab until
+    // the 60s periodic reconcile.
+    seedSession("conv_catchup", [assistantMessage("resp_1", "answer")]);
+    const sinks = routeStreamOpens(["server-a", "server-b"]);
+    const normalFetch = fetchMock.getMockImplementation()!;
+    let snapshotGets = 0;
+    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
+      const url = typeof input === "string" ? input : input.toString();
+      const path = url.split("?")[0]!;
+      if (path === "/v1/sessions/conv_catchup" && (init?.method ?? "GET") === "GET") {
+        snapshotGets += 1;
+        // First read (the reconnect's own reconcile) still sees "running";
+        // later reads (the catch-up burst) see the settled "idle".
+        const status = snapshotGets <= 1 ? "running" : "idle";
+        return Promise.resolve(
+          mockResponse({
+            id: "conv_catchup",
+            agent_id: "agent_xyz",
+            status,
+            created_at: 0,
+            items: sessionSnapshots.get("conv_catchup") ?? [],
+            labels: {},
+            pending_elicitations: [],
+            pending_inputs: [],
+            mcp_startup: null,
+            terminal_pending: false,
+          }),
+        );
+      }
+      return normalFetch(input, init);
+    });
+    const controller = new AbortController();
+    useChatStore.setState({
+      conversationId: "conv_catchup",
+      abortController: controller,
+      sessionStatus: "running",
+      blocks: [],
+    });
+    const loop = startStreamPump("conv_catchup", controller, setState, getState);
+    try {
+      await vi.advanceTimersByTimeAsync(1);
+      sinks[0]!.error();
+      // Reconnect + its immediate reconcile read the still-"running" snapshot.
+      await vi.advanceTimersByTimeAsync(50);
       await drainAsync(2);
-      expect(itemAttempts).toBeGreaterThan(1);
-      expect(useChatStore.getState().blocks.map((b) => b.ctx.itemId)).toEqual(["msg_resp_1_asst"]);
+      expect(
```

**File**: `web/src/store/chatStore.ts` (modified, +48/-7)
```diff
@@ -1600,6 +1600,14 @@ const STREAM_RECONNECT_BASE_MS = 250;
 const STREAM_RECONNECT_MAX_MS = 5_000;
 export const ACTIVE_SESSION_STATUS_RECONCILE_INTERVAL_MS = 60_000;
 export const ACTIVE_SESSION_STATUS_RECONCILE_TIMEOUT_MS = 15_000;
+// After the stream reconnects, `reconcileActiveSessionStatus` runs once
+// immediately — but a server that just restarted may not have reprocessed the
+// in-flight turn's completion yet, so that read can see a stale "running" and
+// leave the tab on "Working…" until the 60s periodic reconcile. These short
+// catch-up delays re-read status a few times over the first ~20s so a status
+// that settles right after reconnect is reflected in seconds, not up to a
+// minute. Each call is guarded + idempotent (see reconcileActiveSessionStatus).
+export const RECONNECT_STATUS_CATCHUP_DELAYS_MS = [3_000, 8_000, 20_000] as const;
 // A reverse proxy serves 404 for the stream route for the ~10-60s a backend
 // container takes to restart (upgrade, config change, re-seed bounce), so a
 // 404 mid-restart must not be treated as permanent. Bound the retries instead
@@ -5120,16 +5128,30 @@ export async function startStreamPump(
   nativePreviewTombstonesByController.set(controller, ignoredNativeMessageIds);
   let failedOpens = 0;
   let statusReconcileInFlight = false;
+  // Shared by the periodic reconcile and the post-reconnect catch-up burst so
+  // reconciliations stay serialized: a catch-up tick that straddles a slow
+  // snapshot fetch (or the periodic tick) is skipped rather than issuing a
+  // duplicate concurrent backfill.
+  const runGuardedStatusReconcile = (): void => {
+    if (statusReconcileInFlight) return;
+    statusReconcileInFlight = true;
+    void reconcileActiveSessionStatus(id, controller, set, get).finally(() => {
+      statusReconcileInFlight = false;
+    });
+  };
   const statusReconcileTimer =
     typeof window === "undefined"
       ? null
-      : window.setInterval(() => {
-          if (statusReconcileInFlight) return;
-          statusReconcileInFlight = true;
-          void reconcileActiveSessionStatus(id, controller, set, get).finally(() => {
-            statusReconcileInFlight = false;
-          });
-        }, ACTIVE_SESSION_STATUS_RECONCILE_INTERVAL_MS);
+      : window.setInterval(runGuardedStatusReconcile, ACTIVE_SESSION_STATUS_RECONCILE_INTERVAL_MS);
+  // Pending post-reconnect catch-up timers. Tracked so each reconnect cancels
+  // the previous burst before scheduling a new one — otherwise recurring
+  // reconnects (the ~5-min ingress recycle) would accumulate timers on the
+  // long-lived controller. Cleared on teardown in the outer `finally`.
+  let catchupTimers: number[] = [];
+  const clearCatchupTimers = (): void => {
+    for (const timer of catchupTimers) window.clearTimeout(timer);
+    catchupTimers = [];
+  };
   // Consecutive 404s only — reset on any non-404 outcome (success or a
   // different-status failure), so a 404 has to persist across attempts to
   // count toward the cap below.
@@ -5314,6 +5336,24 @@ export async function startStreamPump(
         );
         if (reconnecting) {
           await reconcileOnReconnect(id, set, get, ignoredNativeMessageIds);
+          // reconcileOnReconnect can read a stale "running" when the server
+          // just restarted and hasn't reprocessed the turn's completion yet,
+          // stranding the tab on "Working…" until the 60s periodic reconcile.
+          // Re-read status a few times over the next ~20s so a status that
+          // settles shortly after reconnect clears in seconds. Guarded +
+          // idempotent, and scoped to the active conversation by
+          // reconcileActiveSessionStatus itself.
+          if (typeof window !== "undefined") {
+            // Cancel any prior burst so recurring reconnects don't accumulate
+            // timers on the long-lived controller.
+            clearCatchupTimers();
+            catchupTimers = RECONNECT_STATUS_CATCHUP_DELAYS_MS
```

---

### Incident Patch 5: `74f94c3d` (2026-09-30)
**Commit Message**: [opus] fix(desktop): show sign-in, connect and server-loading progress in the onboarding wizard (#8634)

**File**: `web/electron/connection-loading/index.html` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta
+      http-equiv="Content-Security-Policy"
+      content="default-src 'none'; style-src 'unsafe-inline'"
+    />
+    <title>Opening Omnigent</title>
+    <style>
+      :root {
+        color-scheme: light dark;
+      }
+      body {
+        margin: 0;
+        padding: 8px;
+        font:
+          14px system-ui,
+          sans-serif;
+      }
+      .card {
+        display: flex;
+        align-items: center;
+        justify-content: center;
+        gap: 12px;
+        height: 46px;
+        border: 1px solid #8885;
+        border-radius: 12px;
+        background: #fff;
+        color: #222;
+      }
+      .spinner {
+        width: 16px;
+        height: 16px;
+        border: 2px solid #8884;
+        border-top-color: currentColor;
+        border-radius: 50%;
+        animation: spin 0.8s linear infinite;
+      }
+      @keyframes spin {
+        to {
+          transform: rotate(360deg);
+        }
+      }
+      @media (prefers-color-scheme: dark) {
+        .card {
+          background: #1e1927;
+          color: #eee;
+        }
+      }
+      @media (prefers-reduced-motion: reduce) {
+        .spinner {
+          animation: none;
+        }
+      }
+    </style>
+  </head>
+  <body>
+    <div class="card" role="status" aria-live="polite" aria-busy="true">
+      <span class="spinner" aria-hidden="true"></span>
+      <span id="status">Opening Omnigent…</span>
+    </div>
+  </body>
+</html>
```

**File**: `web/electron/package.json` (modified, +1/-0)
```diff
@@ -70,6 +70,7 @@
       "server-selector-v2/**/*",
       "find/**/*",
       "return-banner/**/*",
+      "connection-loading/**/*",
       "icons/**/*",
       "overlay/**/*"
     ],
```

**File**: `web/electron/src/connection_loading.js` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+"use strict";
+
+const path = require("node:path");
+
+// Loads that finish sooner never show the indicator, so fast connects don't flash it.
+const SHOW_DELAY_MS = 300;
+
+/** A shell-owned loading indicator that survives replacement of the server document. */
+function createConnectionLoading({ BrowserWindow, platform = process.platform }) {
+  const entries = new Map();
+
+  function show(parent, attempt, label) {
+    if (parent.isDestroyed()) return;
+    let entry = entries.get(parent);
+    if (!entry) {
+      const window = new BrowserWindow({
+        parent,
+        frame: false,
+        transparent: true,
+        hasShadow: false,
+        show: false,
+        resizable: false,
+        movable: false,
+        minimizable: false,
+        maximizable: false,
+        fullscreenable: false,
+        skipTaskbar: true,
+        ...(platform === "darwin" ? { focusable: false, hiddenInMissionControl: true } : {}),
+        width: 340,
+        height: 64,
+        webPreferences: {
+          preload: path.join(__dirname, "connection_loading_preload.js"),
+          contextIsolation: true,
+          nodeIntegration: false,
+          sandbox: true,
+        },
+      });
+      if (platform === "darwin") window.excludedFromShownWindowsMenu = true;
+      window.setIgnoreMouseEvents(true, { forward: true });
+      entry = { window, attempt, label, ready: false, due: false };
+      entries.set(parent, entry);
+      const current = entry;
+      const reveal = () => {
+        if (
+          current.ready &&
+          current.due &&
+          !window.isDestroyed() &&
+          entries.get(parent) === current
+        )
+          window.showInactive();
+      };
+      const timer = setTimeout(() => {
+        current.due = true;
+        reveal();
+      }, SHOW_DELAY_MS);
+      const position = () => {
+        if (parent.isDestroyed() || window.isDestroyed()) return;
+        const bounds = parent.getContentBounds();
+        window.setBounds({
+          x: bounds.x + Math.round((bounds.width - 340) / 2),
+          y: bounds.y + 40,
+          width: 340,
+          height: 64,
+        });
+      };
+      const close = () => {
+        if (!window.isDestroyed()) window.destroy();
+      };
+      parent.on("move", position);
+      parent.on("resize", position);
+      parent.on("closed", close);
+      window.on("closed", () => {
+        clearTimeout(timer);
+        entries.delete(parent);
+        parent.removeListener("move", position);
+        parent.removeListener("resize", position);
+        parent.removeListener("closed", close);
+      });
+      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
+      window.webContents.on("will-navigate", (event) => event.preventDefault());
+      window.webContents.on("did-finish-load", () => {
+        if (window.isDestroyed() || entries.get(parent) !== entry) return;
+        entry.ready = true;
+        window.webContents.send("omnigent:connection-loading", entry.label);
+        reveal();
+      });
+      position();
+      void window
+        .loadFile(path.join(__dirname, "..", "connection-loading", "index.html"))
+        .catch(close);
+    }
+    entry.attempt = attempt;
+    entry.label = label;
+    if (entry.ready) entry.window.webContents.send("omnigent:connection-loading", label);
+  }
+
+  function hide(parent, attempt) {
+    const entry = entries.get(parent);
+    if (entry?.attempt === attempt && !entry.window.isDestroyed()) entry.window.destroy();
+  }
+
+  return { show, hide };
+}
+
+module.exports = { createConnectionLoading };
```

**File**: `web/electron/src/connection_loading_preload.js` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+"use strict";
+
+const { ipcRenderer } = require("electron");
+
+ipcRenderer.on("omnigent:connection-loading", (_event, label) => {
+  const status = document.getElementById("status");
+  if (status && typeof label === "string") status.textContent = label;
+});
```

**File**: `web/electron/src/main.js` (modified, +20/-3)
```diff
@@ -32,6 +32,7 @@ const {
 const { autoUpdater } = require("electron-updater");
 const { createDesktopUpdater } = require("./desktop_updater");
 const { createUpdateOverlay } = require("./update_overlay");
+const { createConnectionLoading } = require("./connection_loading");
 const { createAboutWindow, resolveAppIconDataUrl } = require("./about_window");
 const { registerFileReveal } = require("./fileReveal");
 const fs = require("node:fs");
@@ -764,6 +765,7 @@ function abortConnectionAttempt(win, message = "Connection superseded") {
   const attempt = connectionAttempts.get(win);
   if (!attempt) return;
   connectionAttempts.delete(win);
+  connectionLoading.hide(win, attempt);
   attempt.pending = false;
   attempt.controller.abort(Object.assign(new Error(message), { name: "AbortError" }));
 }
@@ -1200,6 +1202,8 @@ const aboutWindow = createAboutWindow({
   preloadPath: path.join(__dirname, "about_preload.js"),
 });
 
+const connectionLoading = createConnectionLoading({ BrowserWindow });
+
 // Shell-owned update toast: renders the reused web UpdateBanner in a transparent
 // corner window so it shows even against servers running old omnigent web.
 const updateOverlay = createUpdateOverlay({
@@ -1662,6 +1666,9 @@ async function loadServerUrl(
       reportConnectionProgress(win, attempt, "authenticating");
       const auth = getDatabricksAuth();
       win.webContents.stop();
+      if (!isSetupPageUrl(win.webContents.getURL())) {
+        connectionLoading.show(win, attempt, "Signing in…");
+      }
       try {
         const entered = new URL(serverUrl);
         const resolvedOrigin = await ensureDatabricksSession(
@@ -1704,12 +1711,14 @@ async function loadServerUrl(
     void fetchServerManifest(serverUrl).then((manifest) => {
       if (current()) setWindowServerManifest(win, manifest);
     });
+    connectionLoading.show(win, attempt, "Opening Omnigent…");
     await win.loadURL(target);
     assertCurrent();
     const arcaServerUrl = windowArcaServerUrl(win);
     void refreshArcaBinary().then(() => arcaAutoConnect.ensure(arcaServerUrl));
     return serverUrl;
   } finally {
+    connectionLoading.hide(win, attempt);
     attempt.pending = false;
   }
 }
@@ -3344,8 +3353,11 @@ function registerIpc() {
     if (!cliCommand) return { ok: false, error: missingHostCliError(target) };
     log(`$ ${omnigentCli.cliCommandParts(cliCommand).displayName} host --server ${target}`);
     log("Signing in to the server if needed…");
-    const auth = await serverManager.ensureServerAuth(cliCommand, target);
+    const auth = await serverManager.ensureServerAuth(cliCommand, target, {
+      onLogin: () => log("Finish signing in in your browser, then come back here."),
+    });
     if (!auth.ok) return { ok: false, error: auth.error };
+    log("Connecting this laptop to the server…");
     const result = await serverManager.ensureHostConnected(cliCommand, target);
     broadcastHostStatus();
     if (result.ok) {
@@ -3596,14 +3608,19 @@ function registerIpc() {
     if (!isSetupPageSender(event)) {
       throw new Error("get-cli-status is only available to the setup page");
     }
+    // Concurrent: the setup page holds its first paint on this.
+    const [status, localUrl] = await Promise.all([
+      omnigentCli.getCliStatus(loadSettings().omnigent_path),
+      omnigentCli.localServerHealthy(),
+    ]);
     return {
-      ...(await omnigentCli.getCliStatus(loadSettings().omnigent_path)),
+      ...status,
       customizationDisabled: databricksInternalFeaturesEnabled(),
       // In-app install is macOS-only; the renderer must not route connect/local
       // through an install step on platforms where it can't run.
       installSupported: process.platform === "darwin",
       // start-local's own reuse test, so "Open" vs "Start Omnigent" matches it.
-      localServerRunning: (await omnigentCli.localServerHealthy()) !== null,
+      localServerRunning: localUrl !== null,
     };
   });
 
```

---

### Incident Patch 6: `9de4d495` (2026-09-30)
**Commit Message**: fix(logging): attribute unclassified startup failures in debug logs (#8617)

* fix(logging): attribute unclassified startup failures in debug logs

KPI 1 "startup adverse event unattributed" attempts had no usable
error_category, or lost their diagnostic text:

- trim_terminal_output now keeps a character tail instead of dropping
  whole leading lines, which discarded a long usage/error line and left
  only "pane is dead".
- FailureDiagnosis carries a fault category; a new rejected_arguments
  matcher covers CLI usage errors from host-side launchers.
- Stamp error_category/impact/phase on host spawn failures, server
  host-launch timeouts and refusals, required-terminal exits (new
  required_terminal_exited event), codex thread-start failures (attributed
  to the dead TUI when it already exited), native terminal start failures,
  and runner session init over a dropped tunnel.
- classify_exception treats ENOSPC/EDQUOT as a blocking host fault.

Co-authored-by: Isaac <no-reply@databricks.com>
Signed-off-by: Daniel Lok <daniel.lok@databricks.com>

* fix(logging): address review on startup failure attribution

- Attribute httpx.TransportError on runner session init to the runner too:
 

**File**: `omnigent/errors.py` (modified, +9/-0)
```diff
@@ -11,6 +11,7 @@
 
 from __future__ import annotations
 
+import errno
 import functools
 import inspect
 from collections.abc import Callable
@@ -624,6 +625,10 @@ def is_cancelled_rpc_error(exc: BaseException) -> bool:
     return getattr(status, "name", None) == "CANCELLED"
 
 
+# EDQUOT is POSIX-only; Windows reports a full disk as ENOSPC.
+_DISK_FULL_ERRNOS = frozenset({errno.ENOSPC, getattr(errno, "EDQUOT", errno.ENOSPC)})
+
+
 def classify_exception(exc: BaseException) -> tuple[ErrorCategory, ErrorImpact]:
     """Best-effort (category, impact) for any logged exception.
 
@@ -636,6 +641,8 @@ def classify_exception(exc: BaseException) -> tuple[ErrorCategory, ErrorImpact]:
       matched by type name) read as a transient upstream blip.
     - A peer-cancelled gRPC call (see :func:`is_cancelled_rpc_error`) reads the
       same way: the dependency tore down the in-flight call, not our fault.
+    - A full disk or exhausted quota (``ENOSPC`` / ``EDQUOT``) is the host
+      machine's fault and blocks whatever tried to write.
     - Anything else is genuinely unattributed: UNKNOWN on both axes rather than a
       guessed owner. The turn's terminal outcome remains the authoritative
       blocking signal.
@@ -645,6 +652,8 @@ def classify_exception(exc: BaseException) -> tuple[ErrorCategory, ErrorImpact]:
     """
     if isinstance(exc, OmnigentError):
         return exc.category, exc.impact
+    if isinstance(exc, OSError) and exc.errno in _DISK_FULL_ERRNOS:
+        return ErrorCategory.HOST, ErrorImpact.BLOCKING
     # ConnectionError/TimeoutError are OSError subclasses: this also catches an
     # internal asyncio timeout on a slow server-side call (really ours) as
     # upstream. Same best-effort trade-off as the name set below.
```

**File**: `omnigent/host/connect.py` (modified, +18/-2)
```diff
@@ -46,7 +46,13 @@
     debug_event,
     runner_log_scope,
 )
-from omnigent.errors import ErrorCategory, ErrorImpact, ErrorPhase
+from omnigent.errors import (
+    ErrorCategory,
+    ErrorImpact,
+    ErrorPhase,
+    category_for_code,
+    phase_for_code,
+)
 from omnigent.gateway_inference import gateway_inference_map
 from omnigent.harness_aliases import canonicalize_harness, is_claude_sdk_harness_name
 from omnigent.harness_availability import HARNESS_BINARY_MISSING, HarnessAvailability
@@ -1646,12 +1652,15 @@ def _launch_failed(
         error: str,
         *,
         error_code: str | None = None,
+        error_category: ErrorCategory = ErrorCategory.HOST,
     ) -> HostLaunchRunnerResultFrame:
         """Report and return a failed runner launch.
 
         :param frame: Launch request that failed.
         :param error: Human-readable failure reason.
         :param error_code: Optional machine-readable failure category.
+        :param error_category: Fault attribution for an uncoded failure; a coded
+            preflight refusal uses its code's mapping instead.
         :returns: Failed result frame for the server.
         """
         session_id = frame.session_id or "<unknown>"
@@ -1673,6 +1682,13 @@ def _launch_failed(
                 host_request_id=frame.request_id,
                 stage="runner_launch",
                 error_code=error_code or "runner_spawn_failed",
+                error_category=(
+                    category_for_code(error_code) if error_code else error_category
+                ).value,
+                error_impact=ErrorImpact.BLOCKING.value,
+                error_phase=(
+                    phase_for_code(error_code) if error_code else ErrorPhase.RUNNER_LAUNCH
+                ).value,
             ),
         )
         print(
@@ -1916,7 +1932,7 @@ async def _handle_launch_impl(
             self._trigger_maintenance("runner_launch_failed")
             # The returned result retains the diagnostic tail, while
             # _launch_failed limits the host lifecycle line to its first line.
-            return self._launch_failed(frame, error)
+            return self._launch_failed(frame, error, error_category=ErrorCategory.RUNNER)
 
         # One live runner per session: the session's previous runner —
         # whose binding the server has already rotated away — is
```

**File**: `omnigent/runner/app.py` (modified, +24/-10)
```diff
@@ -60,7 +60,7 @@
     session_resource_view_to_dict,
     terminal_resource_id,
 )
-from omnigent.errors import ErrorCode, ErrorPhase, OmnigentError
+from omnigent.errors import ErrorCategory, ErrorCode, ErrorImpact, ErrorPhase, OmnigentError
 from omnigent.harness_aliases import (
     canonicalize_harness,
     is_native_harness,
@@ -3467,20 +3467,19 @@ def _format_required_terminal_exit_output(
             )
         return "\n".join(parts)
 
-    def _build_required_terminal_error(event: TerminalExitEvent) -> dict[str, str]:
+    def _build_required_terminal_error(
+        event: TerminalExitEvent, diagnosis: FailureDiagnosis | None
+    ) -> dict[str, str]:
         """Build the structured ``session.status`` error for a required-terminal exit.
 
         Always carries ``code`` + a fully-composed ``message`` (back-compat: the
         REPL and older clients render it verbatim). When the failure is
         recognized, also carries ``title`` / ``cause`` / ``remediation`` so the
         web UI can render a friendly card instead of the raw enum + blob.
+
+        :param event: The required terminal's exit event.
+        :param diagnosis: The exit's :func:`classify_terminal_failure` result.
         """
-        # Classify once; the message formatter reuses the same diagnosis.
-        diagnosis = classify_terminal_failure(
-            command=event.command,
-            exit_status=event.exit_status,
-            output=event.last_output,
-        )
         message = _format_required_terminal_exit_output(event, diagnosis)
         error: dict[str, str] = {"code": "required_terminal_exited", "message": message}
         if diagnosis is not None:
@@ -3588,7 +3587,13 @@ def _publish_terminal_exit(event: TerminalExitEvent) -> None:
         # Record the exit before releasing the harness: the release severs any
         # in-flight turn stream, whose failure handler then reports this exit
         # instead of the transport error the severed socket raises.
-        error = _build_required_terminal_error(event)
+        # Classify once; the error card and the failure log share the diagnosis.
+        diagnosis = classify_terminal_failure(
+            command=event.command,
+            exit_status=event.exit_status,
+            output=event.last_output,
+        )
+        error = _build_required_terminal_error(event, diagnosis)
         _required_terminal_exit_errors[event.session_id] = error
         # A dead required terminal cannot still be working a turn.
         _native_pane_status.pop(event.session_id, None)
@@ -3633,7 +3638,16 @@ def _publish_terminal_exit(event: TerminalExitEvent) -> None:
             event.terminal_name,
             event.session_id,
             error.get("message"),
-            extra={"session_id": event.session_id},
+            extra=debug_event(
+                "required_terminal_exited",
+                session_id=event.session_id,
+                terminal_name=event.terminal_name,
+                terminal_exit_status=event.exit_status,
+                error_code=error["code"],
+                # An unrecognized exit is the harness CLI dying under the runner.
+                error_category=(diagnosis.category if diagnosis else ErrorCategory.RUNNER).value,
+                error_impact=ErrorImpact.BLOCKING.value,
+            ),
         )
         _publish_event(
             event.session_id,
```

**File**: `omnigent/runner/launch_failure.py` (modified, +31/-0)
```diff
@@ -20,6 +20,7 @@
 from dataclasses import dataclass
 
 from omnigent.cli_invocation import cli_invocation
+from omnigent.errors import ErrorCategory
 
 __all__ = [
     "FailureDiagnosis",
@@ -39,11 +40,13 @@ class FailureDiagnosis:
         the user can act on.
     :param remediation: The concrete next step, e.g. a command to run or a
         config to change. ``None`` when there is no single clear fix.
+    :param category: Fault attribution stamped on the failure's log row.
     """
 
     title: str
     cause: str
     remediation: str | None = None
+    category: ErrorCategory = ErrorCategory.CONFIG
 
 
 @dataclass(frozen=True)
@@ -103,6 +106,18 @@ class _TerminalMatcher:
     "executable file not found",
 )
 
+# --- CLI rejected its arguments -----------------------------------------------
+# Usage errors from the agent CLI or a wrapper around it, e.g. a flag added by a
+# host-side launcher that this CLI version (or Omnigent's env) does not allow.
+_REJECTED_ARGUMENT_MARKERS = (
+    "unknown option",
+    "unrecognized option",
+    "unexpected argument",
+    "is disabled by claude_code_",
+    "usage: claude",
+    "usage: codex",
+)
+
 
 # Ordered most-specific first: the root case also reads like a permission /
 # auth problem, so it must win over the broader rules below it.
@@ -146,6 +161,22 @@ class _TerminalMatcher:
             ),
         ),
     ),
+    _TerminalMatcher(
+        "rejected_arguments",
+        lambda s: s.output_contains_any(_REJECTED_ARGUMENT_MARKERS),
+        FailureDiagnosis(
+            title="Agent CLI rejected its launch arguments",
+            cause=(
+                "The agent CLI exited at startup because it did not accept the "
+                "arguments it was started with, often from a wrapper script, shell "
+                "alias, or extra launch arguments configured on the host."
+            ),
+            remediation=(
+                "Check the agent's launcher and any extra arguments configured on "
+                "the host, then retry."
+            ),
+        ),
+    ),
 )
 
 
```

**File**: `omnigent/runner/native/orchestration.py` (modified, +30/-0)
```diff
@@ -5895,6 +5895,24 @@ async def _codex_discover_thread_and_forward(
                 except Exception as diagnostics_error:  # noqa: BLE001
                     # Diagnostics must not replace the startup error or prevent cleanup.
                     diagnostics = {"diagnostics_error_type": type(diagnostics_error).__name__}
+                # A timeout after the TUI already died is a symptom: attribute the
+                # exit itself rather than the generic TimeoutError.
+                exit_attribution: dict[str, object] = {}
+                if isinstance(exc, _CodexTerminalExited) or diagnostics.get(
+                    "terminal_exited_undetected"
+                ):
+                    from omnigent.runner.launch_failure import classify_terminal_failure
+
+                    exit_status = diagnostics.get("terminal_exit_status")
+                    last_output = diagnostics.get("terminal_last_output")
+                    diagnosis = classify_terminal_failure(
+                        command="codex",
+                        exit_status=exit_status if isinstance(exit_status, int) else None,
+                        output=last_output if isinstance(last_output, str) else None,
+                    )
+                    exit_attribution["error_category"] = (
+                        diagnosis.category if diagnosis else ErrorCategory.RUNNER
+                    ).value
                 failure_event = debug_event("codex_thread_start_failed", session_id=session_id)
                 failure_event["attributes"] = {
                     "harness": "codex-native",
@@ -5918,6 +5936,9 @@ async def _codex_discover_thread_and_forward(
                     "elapsed_ms": round((time.monotonic() - discovery_started_at) * 1000),
                     "login_required": login_required,
                     **diagnostics,
+                    **exit_attribution,
+                    "error_impact": ErrorImpact.BLOCKING.value,
+                    "error_phase": ErrorPhase.HARNESS_STARTUP.value,
                 }
                 _logger.exception(
                     "Codex TUI never started a thread for %s; chat will not forward%s%s",
@@ -7512,6 +7533,12 @@ def _native_terminal_start_error_payload(
         exception_type=type(exc).__name__,
         exception_cause_type=type(exc.__cause__).__name__ if exc.__cause__ is not None else None,
         cause_code=exc.code if isinstance(exc, OmnigentError) else None,
+        # The warning below carries no exc_info for a missing agent, so the
+        # sink cannot derive its category.
+        error_category=exc.category.value
+        if isinstance(exc, OmnigentError) and missing_agent
+        else None,
+        error_impact=ErrorImpact.BLOCKING.value,
     )
     if missing_agent:
         # Expected session-lifecycle condition: the session's agent was deleted
@@ -9626,6 +9653,8 @@ async def _launch_native_terminal(
                     session_id=ctx.session_id,
                     harness=harness_name,
                     stage="terminal_start",
+                    error_impact=ErrorImpact.BLOCKING.value,
+                    error_phase=ErrorPhase.HARNESS_STARTUP.value,
                 ),
             )
             if reraise:
@@ -9784,6 +9813,7 @@ async def _ensure_native_terminal(
                         session_id=ctx.session_id,
                         terminal_name=terminal_name,
                         stage="terminal_start",
+                        error_impact=ErrorImpact.BLOCKING.value,
                     ),
                 )
             return _native_terminal_start_error_response(
```

---

### Incident Patch 7: `3f6decfc` (2026-09-30)
**Commit Message**: fix(resolve): iterate Polly and OCR until review findings are settled (#8554)

* fix(resolve): iterate Polly and OCR until review findings are settled

Signed-off-by: Serena Ruan <serena.rxy@gmail.com>

* fix(resolve): handle review API failures and tighten receipt validation

Signed-off-by: Serena Ruan <serena.rxy@gmail.com>

* fix(resolve): require trusted Polly completion evidence

Signed-off-by: Serena Ruan <serena.rxy@gmail.com>

* fix(resolve): address review receipt and CLI feedback

Signed-off-by: Serena Ruan <serena.rxy@gmail.com>

* fix(resolve): retain full review snapshot fingerprint

Signed-off-by: Serena Ruan <serena.rxy@gmail.com>

* fix(resolve): validate artifact pages and document review receipts

Signed-off-by: Serena Ruan <serena.rxy@gmail.com>

* fix(ocr): mark zero-finding summaries with their review run

Signed-off-by: Serena Ruan <serena.rxy@gmail.com>

* Revert "fix(ocr): mark zero-finding summaries with their review run"

This reverts commit 6cd4eb646f9ccd6fa9684c7f63fc3f112aa67116.

Signed-off-by: Serena Ruan <serena.rxy@gmail.com>

* fix(resolve): accept receipted OCR zero-finding summaries

Signed-off-by: Serena Ruan <serena.rxy@gmail.com>

---------

S

**File**: `.github/workflows/polly-review.yml` (modified, +13/-0)
```diff
@@ -843,6 +843,7 @@ jobs:
           fi
 
       - name: Post review comment
+        id: publish
         if: steps.polly.outputs.review_text != ''
         env:
           GH_TOKEN: ${{ steps.app-token.outputs.token || github.token }}
@@ -857,6 +858,7 @@ jobs:
           {
             echo "<!-- polly-review-bot -->"
             echo "<!-- polly-reviewed-sha: ${HEAD_SHA} -->"
+            echo "<!-- polly-review-run:${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT} -->"
             echo "## <img src=\"https://raw.githubusercontent.com/omnigent-ai/omnigent/main/docs/images/omnigent-logo.svg\" alt=\"\" height=\"20\" valign=\"middle\" /> Polly AI Review"
             echo ""
             cat /tmp/polly_review.txt
@@ -869,8 +871,19 @@ jobs:
           # `/review` comment, or maintainer approval) is visible in the thread
           # and notifies watchers — no in-place upsert of a prior comment.
           gh pr comment "$PR_NUMBER" --repo "$REPO" --body-file /tmp/comment.md
+          printf '%s\n' "$HEAD_SHA" > /tmp/polly-completed-sha.txt
           echo "Created new comment"
 
+      - name: Upload Polly completion receipt
+        if: steps.publish.outcome == 'success' && github.event_name != 'pull_request'
+        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
+        with:
+          name: polly-completed-${{ steps.pr.outputs.pr_number }}-${{ steps.ctx.outputs.head_sha }}
+          path: /tmp/polly-completed-sha.txt
+          overwrite: true
+          retention-days: 90
+          if-no-files-found: error
+
       # Successful slow runs need the same evidence as failed reviews.
       - name: Prepare Polly diagnostics
         if: always() && (failure() || (steps.polly.outcome != '' && steps.polly.outcome != 'skipped'))
```

**File**: `dev/resolve-agent/AGENTS.md` (modified, +9/-9)
```diff
@@ -7,8 +7,8 @@ selected delivery mode. You do **not** merge.
 
 You run unattended. Carry authorized work to completion without asking again.
 Stop with an honest outcome when input cannot be recovered, bug identities
-conflict, verification is blocked, a product decision needs a human, or the
-bounded PR-driving loop is exhausted. Do not end with a promise to do the work.
+conflict, verification is blocked, a product decision needs a human, or an actual
+execution deadline prevents further work. Do not end with a promise to do the work.
 
 ## Load the procedure for the current phase
 
@@ -96,16 +96,16 @@ intended outcome or a necessary broader behavior change needs a human decision,
 explain it and use `needs_more_info` rather than silently widening the task.
 
 Before delivery, recheck the full diff against that outcome, including changes
-made to address CI or Polly. Keep necessary work and the permitted small
+made to address CI, Polly, or OCR. Keep necessary work and the permitted small
 incidental improvements; remove your other unrelated changes. Explain why any
 necessary changes across layers belong with the reported fix.
 
 ## Evidence and completion
 
 Resolve owns implementation and focused validation. Independent review is a
-separate stage: Polly reviews published PRs; workflow verification may also
-assess retained evidence. Do not substitute your own judgment for an independent
-review, claim an unrun verifier passed, or create child sessions for self-review.
+separate stage: Polly and Open Code Review review published PRs; workflow
+verification may also assess retained evidence. Do not substitute your own
+judgment for an independent review, claim an unrun verifier passed, or create child sessions for self-review.
 
 For reproduction-driven work, prove the same audited assertions fail for the
 reported behavior on the unfixed base and pass on the candidate. Setup/import
@@ -130,9 +130,9 @@ handoff narrative or file hash alone is not proof that a command ran.
 regression check. Preserve incomplete work as `partially_fixed` with
 `remaining_work`, or `needs_more_info` when resolution cannot be established.
 Missing footage alone follows the recording exception in the phase procedure.
-Cap the PR-driving loop at approximately six fix/push/recheck rounds; never
-loosen tests or skip checks to force green. Load `resolve-handoff` and finish with
-exactly one complete JSON handoff as the final block, including `test_audit`,
+For open PRs, run the Step 4.3 live Polly/OCR gate before `fixed` or approval.
+Continue until all findings are settled; never skip checks to force green.
+Load `resolve-handoff` and finish with exactly one complete JSON handoff as the final block, including `test_audit`,
 `impact_assessment`, and `remaining_work`. Use its exact mode/outcome literals.
 
 ## Writing and environment
```

**File**: `dev/resolve-agent/README.md` (modified, +38/-12)
```diff
@@ -91,7 +91,7 @@ follows the existing PR's remediation and publication rules.
 
 - **Direct publication** is the default when no external publisher contract is
   present. The agent pushes, opens a ready-for-review PR, and drives its preview,
-  CI, Polly review, live-validation prompt, and maintainer handoff.
+  CI, Polly and OCR reviews, live-validation prompt, and maintainer handoff.
 - **Workflow-owned publication** is selected by an explicit CI publisher
   contract with `skip_push` false. The agent commits the fix and prepares and
   validates `.omnigent/pr-body.md` plus the deferred validation prompt, but makes
@@ -155,12 +155,13 @@ is the review gate after the fact.
    GitHub writes. Local-only runs stop at the commit. Full repository validation
    and independent review happen after publication.
 7. *(direct author path and review path)* **Drives the open PR to a landable
-   state** — a bounded loop. Workflow-owned author runs leave this post-publication
-   work to the publisher:
+   state** — iterating until ready or concretely blocked. Workflow-owned author
+   runs leave this post-publication work to the publisher:
    - Labels **every** PR **`ui-preview`** (not just frontend fixes) to request a
-     live app deploy — but only **after** CI is green and the Polly review is
-     clean for the current commit, never up front, since the label triggers a
-     `pull_request_target` deploy of the PR's code. Then waits for the
+     live app deploy — but only **after** CI is green and both Polly and OCR
+     reviews are settled for the current commit on the existing-PR review path,
+     since the label triggers a `pull_request_target` deploy of the PR's code.
+     Directly authored PRs may label immediately, per the preview procedure. Then waits for the
      preview URL and posts a comment with how to connect a runner to it
      (`omnigent run --server <url>`) to validate the fix directly. (The workflow
      deploys for any labelled non-draft PR, forks included — the label is the
@@ -169,9 +170,13 @@ is the review gate after the fact.
    - Watches CI (`gh pr checks --watch`); when a check fails it reads the log,
      fixes its own regressions, and pushes — while leaving pre-existing/flaky/infra
      failures alone (and saying so).
-   - Reads the latest **Polly AI Review** comment; fixes every actionable finding
-     at the root, pushes, and re-triggers `polly-review.yml` for the PR, looping
-     until the newest review is clean or the review-round cap is reached.
+   - Collects **Polly AI Review** and **Open Code Review** summaries and inline
+     findings, including non-blocking notes. Fixes needed changes and records
+     evidenced invalid/not-needed dispositions. After every push, dispatches
+     both workflows (the bot equivalent of `/review` and `/ocr`) and waits for
+     current-head completion proof. There is no fixed round cap. A bundled live
+     checker rejects missing reviews, stale receipts, and missing dispositions;
+     a concrete blocker or execution deadline produces an incomplete checkpoint.
    - Writes a **paste-to-an-agent live-validation prompt** into the PR body so a
      human can reproduce and confirm the fix, then **tags the issue's assignee**
      (the maintainer) to review once CI is green and the review is clean.
@@ -182,8 +187,8 @@ is the review gate after the fact.
    update, the per-facet fail→pass proof, the compact PR-facing `review_body` in
    review mode, the PR URL (opened or reviewed, or empty until the workflow-owned
    publisher opens it), and the publication state
-   (`ci_status`, `polly_review`, `ui_preview`, `validation_prompt`,
-   `maintainer_review`).
+   (`ci_status`, `polly_review`, `ocr_review`, `review_cycle`, `ui_preview`,
+   `validation_prompt`, `maintainer_review`).
 
 It does **not** merge. [AGENTS.md](AGENTS.md) contains the role, mode selection,
 essential constraints, and completion contract. Detailed procedures live in
@@ -196,7 +201,7
```

**File**: `dev/resolve-agent/config.yaml` (modified, +7/-28)
```diff
@@ -1,20 +1,9 @@
 # resolve-agent (local) — take a reproduced bug to resolution, or remediate
 # requested changes on an existing Resolve-managed PR.
 #
-# This is the step AFTER repro-agent. It consumes repro-agent's handoff (the
-# reported reproduction and its tests). It audits the patch and behavioral
-# baseline before looking for an open PR: if found, it REVIEWS that PR using the
-# audited test and diff — instead of writing a competing fix. If none
-# exists, it finds the root cause, implements a fix in a fresh worktree, selects
-# permanent regression coverage (reusing existing tests where sufficient), proves the set
-# goes fail→pass, then commits, pushes, and opens a ready-for-review PR. It then
-# drives that PR to a landable state (Step 4): labels every PR `ui-preview` (so a
-# live app is deployed to validate against, not just for frontend fixes) and posts
-# connect instructions, iterates on failing CI and on the
-# Polly automated review (fixing critical findings and re-triggering with a
-# `/review` comment) until CI is green and no critical findings remain, writes a
-# paste-to-an-agent live-validation prompt into the PR, and tags the issue's
-# assignee to review.
+# Audits repro-agent's handoff, reviews an existing fix or authors a new one,
+# then iterates on CI and Polly/OCR (re-dispatching after every push) until green
+# and settled. Publishes preview/live-validation instructions for human review.
 #
 # It is invoked with a pointer to a completed repro run — either a `session`
 # link (local: right after `dev/repro.py`) or a `ci_link` (a CI run URL, when the
@@ -86,22 +75,12 @@ agent_session_sharing: public
 async: true
 cancellable: true
 
-# Independent review runs through Polly after publication; the implementation
-# agent does not need child-session creation tools.
+# Polly and OCR review published PRs; Resolve needs no child-session tools.
 spawn: false
 
-# Declaring os_env registers sys_os_read / sys_os_write / sys_os_edit /
-# sys_os_shell. The agent uses the shell for `git` (branch/commit/push), `gh`
-# (find/review an existing fix PR, recover a CI run's artifacts, open the PR,
-# and then land it: `gh pr checks` to poll CI, `gh pr edit --add-label` /
-# `--add-reviewer`, `gh pr comment` to post connect/validation notes and the
-# `/review` re-trigger, `gh issue view` to read the assignee), and to run tests
-# and write the fix + its tests into this checkout; it reads the repro session
-# via sys_session_*. `cwd: .` runs in the caller's
-# working directory — run `omnigent run dev/resolve-agent` from the root of your
-# omnigent checkout so the agent lands in this repo. `sandbox: none` runs
-# unsandboxed with unrestricted network so it can reach the repro session, run
-# tests, and reach GitHub.
+# os_env registers sys_os_* tools; the shell drives git/gh, review dispatch,
+# and tests. Run from the repo root (`cwd: .`); unrestricted network lets the
+# agent reach the repro session and GitHub.
 os_env:
   type: caller_process
   cwd: .
```

**File**: `dev/resolve-agent/skills/resolve-drive-pr/SKILL.md` (modified, +14/-15)
```diff
@@ -1,6 +1,6 @@
 ---
 name: resolve-drive-pr
-description: Drive an open PR through current CI, independent Polly review, preview, and maintainer handoff.
+description: Drive an open PR through current CI, independent Polly and OCR reviews, preview, and maintainer handoff.
 ---
 
 # Drive an open PR
@@ -10,8 +10,8 @@ Read each resource when reaching its substep, preserving the publication mode:
 | Substep | Resource |
 | --- | --- |
 | 4.2, current CI and mergeability | [ci.md](ci.md) |
-| 4.3, independent Polly review | [polly.md](polly.md) |
-| 4.1, preview after CI and Polly are clean | [preview.md](preview.md) |
+| 4.3, independent Polly and OCR reviews | [polly.md](polly.md) |
+| 4.1, preview after CI and both reviews are clean | [preview.md](preview.md) |
 | 4.4, live-validation instructions | [validation-prompt.md](validation-prompt.md) |
 | 4.5, final review and maintainer handoff | [final-review.md](final-review.md) |
 
@@ -31,9 +31,9 @@ live-validation command, and a maintainer tagged. `skip_push` runs (author path
 that only committed locally) have no PR to land, so skip Step 4 entirely.
 Workflow-owned author runs also have no PR during the agent session: perform only
 the deferred body/prompt preparation called out in Step 4.4 before the final
-handoff, and leave preview, CI, Polly, GitHub comments, and maintainer tagging to
-the post-publication workflow. Once a directly published or reviewed PR is up you
-**stay on it** until CI is green and the review is clean, then hand it to a
+handoff, and leave preview, CI, both reviews, GitHub comments, and maintainer
+tagging to the post-publication workflow. Once a directly published or reviewed
+PR is up you **stay on it** until CI is green and the review is clean, then hand it to a
 human. The sub-steps overlap in time (kick off the preview and the first review,
 then poll), so don't serialize what can run concurrently.
 
@@ -95,12 +95,11 @@ can land a fix depends on where its branch lives:
     try-it-out command, then tag the maintainer. No takeover needed. (The approval
     is a bot indicator — the maintainer's approval still merges it.)
 
-Throughout, address the PR you're landing by its number `<pr>`. This whole step is
-a **bounded loop** — cap it at **~6 fix→(push-or-takeover)→re-check rounds**. A
-fork **takeover** is not one of those rounds: it opens a fresh PR and restarts CI +
-Polly from scratch on it, so treat it as a **reset** — the ~6-round budget applies
-to the new PR from that point, rather than being consumed by the takeover itself.
-If you're still red or still getting blocking findings after the budget, stop,
-leave the PR open with an honest summary comment of what's unresolved, and report
-`outcome: "partially_fixed"` with the specifics (see Output). Never loosen a test,
-skip a check, or merge to force green.
+Throughout, address the PR you're landing by its number `<pr>`. Continue until
+current CI and both independent reviews are settled; there is **no fixed
+review-round cap**. After every push, request both Polly and OCR for the new head
+(Step 4.3), including pushes for CI or conflict repairs. A fork takeover starts
+this loop on the replacement PR. If a concrete blocker or actual execution
+deadline prevents completion, leave a resumable checkpoint and report
+`outcome: "partially_fixed"` with the unresolved work (see Output). Never loosen
+a test, skip a check, or merge to force green.
```

---

### Incident Patch 8: `53cf8305` (2026-09-30)
**Commit Message**: fix: preserve parent host routing for side chats (#8602)

Signed-off-by: Dhruv Gupta <dhruv0811@gmail.com>

**File**: `omnigent/runner/routing.py` (modified, +17/-7)
```diff
@@ -74,9 +74,8 @@ def routing_host_id(conv: Conversation, conversation_store: ConversationStore) -
 
     A host-bound session is served by its own ``host_id``. A sub-agent child
     copies its parent's ``runner_id`` at creation but carries no host binding
-    of its own, so the nearest host-bound ancestor (parent, then root) names
-    the replica holding the shared tunnel. Without this, a child's routing
-    miss reads as a dead runner instead of a re-addressable wrong replica.
+    of its own. The nearest host-bound ancestor identifies the shared tunnel's
+    replica, so a routing miss is distinguished from a dead runner.
 
     :param conv: Conversation whose runner is being routed.
     :param conversation_store: Store used to read the ancestor rows.
@@ -85,12 +84,23 @@ def routing_host_id(conv: Conversation, conversation_store: ConversationStore) -
     """
     if conv.host_id is not None or conv.kind != "sub_agent":
         return conv.host_id
-    for ancestor_id in dict.fromkeys((conv.parent_conversation_id, conv.root_conversation_id)):
-        if ancestor_id is None or ancestor_id == conv.id:
-            continue
+    visited = {conv.id}
+    ancestor_id = conv.parent_conversation_id
+    while ancestor_id is not None and ancestor_id not in visited:
+        visited.add(ancestor_id)
         ancestor = conversation_store.get_conversation(ancestor_id)
-        if ancestor is not None and ancestor.host_id is not None:
+        if ancestor is None:
+            break
+        if ancestor.host_id is not None:
             return ancestor.host_id
+        ancestor_id = ancestor.parent_conversation_id
+
+    # Retain the root fallback when an intermediate parent is missing or cyclic.
+    root_id = conv.root_conversation_id
+    if root_id is not None and root_id not in visited:
+        root = conversation_store.get_conversation(root_id)
+        if root is not None:
+            return root.host_id
     return None
 
 
```

**File**: `tests/server/test_runner_routing_wrong_replica.py` (modified, +59/-4)
```diff
@@ -4,7 +4,7 @@
 
 from omnigent.entities import Conversation
 from omnigent.errors import ErrorCode, OmnigentError
-from omnigent.runner.routing import RunnerRouter
+from omnigent.runner.routing import RunnerRouter, routing_host_id
 from omnigent.server._runner_ws_tunnel import WrongReplicaWSError, make_tunnel_ws_factory
 
 
@@ -132,7 +132,8 @@ def test_runner_absent_code_no_store_registry_only_returns_wrong_replica():
 
 
 @pytest.mark.parametrize("surface", ["resources", "existing", "dispatch", "terminal_attach"])
-def test_colocated_child_on_another_replica_is_not_reported_offline(surface):
+@pytest.mark.parametrize("ancestry", ["direct", "nested", "nested_hostless_root"])
+def test_colocated_child_on_another_replica_is_not_reported_offline(surface, ancestry):
     parent = Conversation(
         id="parent",
         created_at=1,
@@ -150,11 +151,35 @@ def test_colocated_child_on_another_replica_is_not_reported_offline(surface):
         kind="sub_agent",
         runner_id=parent.runner_id,
     )
+    conversations = [parent, child]
+    if ancestry != "direct":
+        root = Conversation(
+            id="root",
+            created_at=1,
+            updated_at=1,
+            root_conversation_id="root",
+            host_id="host_root" if ancestry == "nested" else None,
+        )
+        intermediate = Conversation(
+            id="intermediate",
+            created_at=1,
+            updated_at=1,
+            root_conversation_id=root.id,
+            parent_conversation_id=parent.id,
+            kind="sub_agent",
+            runner_id=parent.runner_id,
+        )
+        parent.parent_conversation_id = root.id
+        parent.root_conversation_id = root.id
+        parent.kind = "sub_agent"
+        child.parent_conversation_id = intermediate.id
+        child.root_conversation_id = root.id
+        conversations.extend([root, intermediate])
     registry = MockTunnelRegistry()
     router = RunnerRouter(
         registry=registry,
-        conversation_store=MockConversationStore(parent, child),
-        host_registry=MockHostRegistry(),
+        conversation_store=MockConversationStore(*conversations),
+        host_registry=MockHostRegistry({"host_root": "local_connection"}),
         host_store=MockHostStore({"host_parent": True}),
     )
     if surface == "terminal_attach":
@@ -171,3 +196,33 @@ def test_colocated_child_on_another_replica_is_not_reported_offline(surface):
                 router.client_for_conversation(conversation_id=child.id, harness="pi-native")
         assert caught.value.code == ErrorCode.WRONG_REPLICA
     assert child.host_id is None
+
+
+@pytest.mark.parametrize("root_host", [None, "host_root"])
+@pytest.mark.parametrize("broken_parent", ["missing", "cycle"])
+def test_routing_host_handles_broken_ancestry(root_host, broken_parent):
+    root = Conversation(
+        id="root", created_at=1, updated_at=1, root_conversation_id="root", host_id=root_host
+    )
+    child = Conversation(
+        id="child",
+        created_at=1,
+        updated_at=1,
+        kind="sub_agent",
+        parent_conversation_id="parent",
+        root_conversation_id=root.id,
+    )
+    conversations = [root, child]
+    if broken_parent == "cycle":
+        conversations.append(
+            Conversation(
+                id="parent",
+                created_at=1,
+                updated_at=1,
+                kind="sub_agent",
+                parent_conversation_id=child.id,
+                root_conversation_id=root.id,
+            )
+        )
+
+    assert routing_host_id(child, MockConversationStore(*conversations)) == root_host
```

**File**: `web/src/lib/identity.test.ts` (modified, +52/-0)
```diff
@@ -408,6 +408,58 @@ describe("authenticatedFetch", () => {
       expect(response.status).toBe(200);
     });
 
+    it.each([200, 400, 500, 503])(
+      "only drops the shared parent host key after a successful fallback (HTTP %s)",
+      async (fallbackStatus) => {
+        vi.doUnmock("./sessionHost");
+        const { setSessionHost, setSessionParent } = await import("./sessionHost");
+        setSessionHost("parent", "host_parent");
+        setSessionParent("child", "parent");
+        vi.doMock("./host", () => ({
+          getOmnigentHostConfig: vi.fn(() => ({ fetcher: () => fetch })),
+          hostFetch: fetchMock,
+          isDatabricksWorkspace: vi.fn(() => true),
+        }));
+        const { authenticatedFetch } = await import("./identity");
+        fetchMock
+          .mockResolvedValueOnce(
+            new Response(JSON.stringify({ error: { code: "wrong_replica" } }), { status: 400 }),
+          )
+          .mockResolvedValueOnce(
+            new Response(
+              JSON.stringify(
+                fallbackStatus === 200
+                  ? { queued: true }
+                  : { error: { code: "runner_unavailable" } },
+              ),
+              { status: fallbackStatus },
+            ),
+          )
+          .mockResolvedValue(mockJsonResponse({ queued: true }));
+
+        const response = await authenticatedFetch("/v1/sessions/child/events", {
+          method: "POST",
+          body: JSON.stringify({ type: "message", data: { content: "side question" } }),
+        });
+        expect(response.status).toBe(fallbackStatus);
+        await authenticatedFetch("/v1/sessions/child/events", {
+          method: "POST",
+          body: JSON.stringify({ type: "retry_session" }),
+        });
+        await authenticatedFetch("/v1/sessions/parent/events", {
+          method: "POST",
+          body: JSON.stringify({ type: "message", data: { content: "main question" } }),
+        });
+
+        const subsequentKey = fallbackStatus === 200 ? null : "host_parent";
+        expect(
+          fetchMock.mock.calls.map(([, init]) =>
+            new Headers((init as RequestInit).headers).get("X-Databricks-Omnigent-Slice-Key"),
+          ),
+        ).toEqual(["host_parent", null, subsequentKey, subsequentKey]);
+      },
+    );
+
     it("keys /v1/imports/local by its body host_id, not the modal host", async () => {
       // The import reads the CHOSEN host's transcripts over that host's tunnel,
       // so it must route to the replica keyed by the body host_id — never the
```

**File**: `web/src/lib/identity.ts` (modified, +3/-8)
```diff
@@ -518,14 +518,9 @@ export async function authenticatedFetch(
       headers: retryHeaders,
       cache: "no-store",
     });
-    // Sticky demotion: the keyless re-address PROVED this host routes keyless
-    // (the keyed attempt returned wrong_replica, the keyless one didn't).
-    // Remember it so every later request for this host — including the control
-    // paths with no server-side wrong-replica guard — goes keyless from the
-    // start. Evidence-based: we demote only on a keyless SUCCESS, so a
-    // correctly-keyed host having a transient blip (whose keyless re-address
-    // would also fail) is never stranded.
-    if (derivedHostId && !(await _isWrongReplica(res))) {
+    // Only a successful keyless retry proves this host uses the default replica.
+    // Failed retries must preserve the host key for subsequent requests.
+    if (derivedHostId && res.ok) {
       markHostKeyless(derivedHostId);
     }
   } else if (
```

---

### Incident Patch 9: `1d0cbe7d` (2026-09-30)
**Commit Message**: fix(web): enable Start session for Windows drive-letter workspaces (#7837)

* fix(web): enable Start session for Windows drive-letter workspaces

The new-session landing gate validated the picked working directory with
isValidWorkspace, which accepted only POSIX paths starting with '/'. A
workspace picked on a Windows host arrives as a drive-letter path
(C:\... / C:/...), so the Start session button stayed disabled with
'Please choose a host and working directory' even though the picker, the
browse API, and the server's session-create validation all accept that
path.

Validate with isHostAbsolutePath (POSIX '/...' or Windows drive-letter),
matching the server's validate_workspace shape. Backslash UNC paths stay
rejected, as the server rejects them too.

Adds unit coverage for the drive-letter shapes and an e2e regression test
that picks C:\Users\alice\work on a fake Windows host over the real
tunnel and asserts Start session enables and the create carries the
drive-letter workspace.

* Preserve path helpers in project creation test mock

Signed-off-by: Pat Sukprasert <pattara.sk127@gmail.com>

* Use a static type import in the project-create mock

Signed-off-by: Pat Sukprasert <pat

**File**: `web/src/shell/NewChatDialog.projectCreate.test.tsx` (modified, +3/-1)
```diff
@@ -1,3 +1,4 @@
+import type * as WorkspacePickerModule from "./WorkspacePicker";
 import type * as SandboxModelOptionsModule from "@/hooks/useSandboxModelOptions";
 
 vi.mock("@/hooks/useSandboxModelOptions", async (importOriginal) => ({
@@ -116,7 +117,8 @@ vi.mock("@/hooks/RunnerHealthProvider", () => ({
 }));
 // The file browser is heavy UI; a stub button stands in for a user selection —
 // deliberately re-picking the config workspace through the modal commit path.
-vi.mock("./WorkspacePicker", () => ({
+vi.mock("./WorkspacePicker", async (importOriginal) => ({
+  ...(await importOriginal<typeof WorkspacePickerModule>()),
   isNavigablePath: () => false,
   WorkspacePicker: (props: { onSelect: (path: string) => void }) => (
     <button
```

**File**: `web/src/shell/NewChatDialog.test.tsx` (modified, +20/-7)
```diff
@@ -498,13 +498,7 @@ describe("resolveThisMachineHostId", () => {
   });
 });
 
-// Workspace validation contract — pins the same shape the server
-// validator enforces (per designs/SESSION_WORKSPACE_SELECTION.md):
-// tilde-prefixed and relative paths are rejected; only
-// fully-absolute paths starting with `/` are accepted. If this
-// drifts out of sync with the server, the submit button would
-// either let through requests the server rejects (opaque 400) or
-// block requests the server would accept (button stuck disabled).
+// Keep the submit gate aligned with the server's workspace validation.
 describe("isValidWorkspace", () => {
   it("accepts a fully absolute path", () => {
     expect(isValidWorkspace("/Users/corey/projects/myapp")).toBe(true);
@@ -546,6 +540,25 @@ describe("isValidWorkspace", () => {
     expect(isValidWorkspace("./myapp")).toBe(false);
     expect(isValidWorkspace("../myapp")).toBe(false);
   });
+
+  it("accepts Windows drive-letter paths", () => {
+    expect(isValidWorkspace("C:\\Users\\alice\\work")).toBe(true);
+    expect(isValidWorkspace("C:/Users/alice/work")).toBe(true);
+    expect(isValidWorkspace("c:\\work")).toBe(true);
+    expect(isValidWorkspace("  C:\\Users\\alice  ")).toBe(true);
+  });
+
+  it("rejects a bare drive letter and non-drive colon shapes", () => {
+    // "C:" without a separator is drive-relative on Windows, not absolute.
+    expect(isValidWorkspace("C:")).toBe(false);
+    expect(isValidWorkspace("C:work")).toBe(false);
+  });
+
+  it("rejects backslash UNC paths, matching the server", () => {
+    // validate_workspace only admits /-prefixed or drive-letter paths, so
+    // accepting \\server\share here would surface an opaque 400 on submit.
+    expect(isValidWorkspace("\\\\server\\share")).toBe(false);
+  });
 });
 
 // Path normalization underpins the directory-conflict match: a freshly
```

**File**: `web/src/shell/NewChatDialog.tsx` (modified, +4/-14)
```diff
@@ -134,7 +134,7 @@ import { useIsCoarsePointer } from "@/hooks/useIsCoarsePointer";
 import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
 import { useModelPickerHotkey } from "@/hooks/useModelPickerHotkey";
 import { CliCommandBlock, renderTextWithInlineCode } from "./CliCommandBlock";
-import { isNavigablePath } from "./WorkspacePicker";
+import { isHostAbsolutePath, isNavigablePath } from "./WorkspacePicker";
 import { WorkspacePickerDialog } from "./WorkspacePickerDialog";
 import { RecentWorkspaceList } from "./RecentWorkspaceList";
 import {
@@ -534,21 +534,11 @@ export function ConnectHostInstructions({
 }
 
 /**
- * Return true when ``workspace`` is acceptable to send to the backend.
- *
- * Per designs/SESSION_WORKSPACE_SELECTION.md: only fully-absolute
- * paths (starting with ``/``) are accepted. Tilde-prefixed and
- * relative paths are rejected because the server never expands ``~``
- * — that's the host's job, and the workspace request body must be
- * an unambiguous absolute path. Empty / whitespace-only input is
- * also rejected so the submit button is disabled until the user
- * has typed something usable.
- *
- * @param workspace Value the user typed in the workspace input.
- * @returns true when ``workspace.trim()`` starts with ``/``.
+ * Match session-create validation: accept absolute POSIX or drive-letter paths.
+ * The host must expand tilde and relative paths before submission.
  */
 export function isValidWorkspace(workspace: string): boolean {
-  return workspace.trim().startsWith("/");
+  return isHostAbsolutePath(workspace.trim());
 }
 
 /**
```

---

### Incident Patch 10: `60eee195` (2026-09-30)
**Commit Message**: fix(desktop): show the picked server when sign-in moves to the workspace host (#8618)

* fix(desktop): show the picked server when sign-in moves to the workspace host

Joining through an account-level URL signs in on the workspace's own
host, so the recents, the setup page and the server picker all named
that host instead of the server the user picked, next to it as a
separate server.

The shell now records the pick as a display label for the workspace
host (settings.server_labels) after a successful connect. Recents and
the saved server keep the workspace URL, so sign-in, switching and
deep-link trust are unchanged.

- Setup page: a labeled recent is listed as its pick, folded into the
  organization's server when it's that same server; forget accepts it.
- Server picker: names the current server and recents by their pick; a
  recent reached through a managed server is listed once, as managed,
  and selecting it switches through the recent's workspace host.

Co-authored-by: Isaac <no-reply@databricks.com>
Signed-off-by: Hubert Zub <hubert.zub@gmail.com>

* fix(desktop): tighten the setup page's server labels

- A labeled recent whose own workspace URL the organization provides is


**File**: `web/electron/src/main.js` (modified, +69/-10)
```diff
@@ -55,6 +55,7 @@ const {
   PRE_MANIFEST_BASELINE,
 } = require("./url");
 const { parseOmnigentDeepLink, chooseDeepLinkStrategy } = require("./deepLink");
+const { parseServerLabels, serverLabel, withConnectLabel } = require("./server_labels");
 const { registerWorkspaceChromeHide } = require("./workspace-chrome");
 const { registerWorkspaceRootBounce } = require("./workspace-root-bounce");
 const { registerServerAwayWatch, AWAY_BANNER_DELAY_MS } = require("./away_banner");
@@ -1306,6 +1307,30 @@ function rememberRecentServer(settings, url) {
   ].slice(0, MAX_RECENT_SERVERS);
 }
 
+/**
+ * Recents as the setup page lists them: normalized, a workspace host shown as
+ * the URL the user picked when sign-in moved to it, and without servers the
+ * organization provides. Connecting from the setup page always signs in
+ * afresh, so the picked URL reaches the same workspace.
+ *
+ * @param {Record<string, unknown>} settings Settings object from loadSettings().
+ * @returns {string[]}
+ */
+function setupPageRecents(settings) {
+  const labels = parseServerLabels(settings.server_labels);
+  const managed = managedServerUrls();
+  const managedServers = new Set(normalizeRecentServers(managed));
+  return normalizeRecentServers(
+    normalizeRecentServers(settings.recent_servers).flatMap((url) => {
+      const label = serverLabel(labels, url);
+      const unmanaged = excludingManagedServers([url], managed);
+      if (label === null || unmanaged.length === 0) return unmanaged;
+      // Folded into the organization's server only when it's that same server.
+      return managedServers.has(normalizeRecentServers([label])[0]) ? [] : [label];
+    }),
+  );
+}
+
 // ---------------------------------------------------------------------------
 // Window + navigation
 // ---------------------------------------------------------------------------
@@ -3004,10 +3029,20 @@ function registerIpc() {
         interactive: true,
         attempt,
       });
-      // Only a server that actually responded earns a recents slot.
+      // Only a server that actually responded earns a recents slot. Sign-in that
+      // moved to another host keeps the pick's name for display.
       if (!ephemeral) {
         const settings = loadSettings();
         rememberRecentServer(settings, resolvedServerUrl);
+        const labels = withConnectLabel(
+          parseServerLabels(settings.server_labels),
+          target,
+          resolvedServerUrl,
+          settings.recent_servers,
+        );
+        if (settings.server_labels !== undefined || Object.keys(labels).length > 0) {
+          settings.server_labels = labels;
+        }
         saveSettings(settings);
       }
       return {};
@@ -3024,7 +3059,12 @@ function registerIpc() {
     if (!isSetupPageSender(event)) {
       throw new Error("get-server-url is only available to the setup page");
     }
-    return loadSettings().server_url ?? null;
+    const settings = loadSettings();
+    return (
+      serverLabel(parseServerLabels(settings.server_labels), settings.server_url) ??
+      settings.server_url ??
+      null
+    );
   });
 
   // Setup page → recently-connected servers, most recent first, for the
@@ -3033,8 +3073,7 @@ function registerIpc() {
     if (!isSetupPageSender(event)) {
       throw new Error("get-recent-servers is only available to the setup page");
     }
-    const managed = managedServerUrls();
-    return excludingManagedServers(normalizeRecentServers(loadSettings().recent_servers), managed);
+    return setupPageRecents(loadSettings());
   });
 
   // Setup page → drop one recent server from settings.json. Returns the
@@ -3044,12 +3083,21 @@ function registerIpc() {
     if (!isSetupPageSender(event)) {
       throw new Error("forget-recent-server is only available to the setup page");
     }
-    const managed = managedServerUrls();
     const settings = loadSettings();
-    const remaining = normalizeRecentServers(settings.recent_servers).filter((u) => u !=
```

**File**: `web/electron/src/server_labels.js` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+"use strict";
+
+/**
+ * Server labels, persisted as settings.server_labels: workspace origin → the
+ * server URL the user picked when Databricks sign-in moved to that workspace's
+ * own host. Display only: recents and the saved server keep the workspace URL,
+ * where the sign-in is stored.
+ */
+
+/**
+ * @param {unknown} url
+ * @returns {string | null}
+ */
+function originOf(url) {
+  try {
+    return new URL(String(url)).origin;
+  } catch {
+    return null;
+  }
+}
+
+/**
+ * The valid entries of a settings.server_labels value (hand-edited settings
+ * may hold anything).
+ *
+ * @param {unknown} value
+ * @returns {Record<string, string>}
+ */
+function parseServerLabels(value) {
+  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
+  return Object.fromEntries(
+    Object.entries(value).filter(
+      ([origin, url]) =>
+        originOf(origin) === origin && typeof url === "string" && originOf(url) !== null,
+    ),
+  );
+}
+
+/**
+ * The URL the user picked for `url`'s host, else null.
+ *
+ * @param {Record<string, string>} labels From parseServerLabels.
+ * @param {unknown} url
+ * @returns {string | null}
+ */
+function serverLabel(labels, url) {
+  const origin = originOf(url);
+  return origin !== null && Object.hasOwn(labels, origin) ? labels[origin] : null;
+}
+
+/**
+ * Labels after a connect to `picked` landed on `connected`, kept only for hosts
+ * still in `recents`. Sign-in that moved hosts labels the connected host with
+ * the pick; a direct connect to a host drops its label.
+ *
+ * @param {Record<string, string>} labels From parseServerLabels.
+ * @param {string} picked
+ * @param {string} connected
+ * @param {unknown[]} recents
+ * @returns {Record<string, string>}
+ */
+function withConnectLabel(labels, picked, connected, recents) {
+  const origin = originOf(connected);
+  const listed = new Set(recents.map(originOf));
+  const next = Object.fromEntries(
+    Object.entries(labels).filter(([host]) => host !== origin && listed.has(host)),
+  );
+  if (origin !== null && listed.has(origin) && originOf(picked) !== origin) next[origin] = picked;
+  return next;
+}
+
+module.exports = { parseServerLabels, serverLabel, withConnectLabel };
```

**File**: `web/electron/test/main.test.js` (modified, +160/-8)
```diff
@@ -44,6 +44,7 @@ function loadNavigationHarness({
   realBrowserRegistry = false,
   arcaPath = null,
   arcaResult = { ok: true, alreadyRunning: false },
+  managedServers = [],
 } = {}) {
   const userData = fs.mkdtempSync(path.join(os.tmpdir(), "omnigent-navigation-test-"));
   if (savedServerUrl) {
@@ -230,6 +231,10 @@ function loadNavigationHarness({
       },
       PRE_MANIFEST_BASELINE: {},
     },
+    "./managed_preferences": {
+      ...require("../src/managed_preferences"),
+      getManagedServerUrls: () => managedServers,
+    },
     "./deepLink": {
       parseOmnigentDeepLink: () => null,
       chooseDeepLinkStrategy: () => null,
@@ -674,6 +679,116 @@ describe("Databricks auth mode wiring", () => {
     assert.equal(h.calls.auth[1][2].interactive, false);
   });
 
+  describe("server labels", () => {
+    const picked = "https://accounts.cloud.databricks.com/omnigent?o=123";
+    const pickedListed = "https://accounts.cloud.databricks.com/?o=123";
+    const workspaceOrigin = new URL(workspace).origin;
+    const setupEvent = (h) => ({
+      sender: h.webContents,
+      senderFrame: { url: `file://${h.api.SETUP_PAGE}` },
+    });
+    const pageEvent = (h) => ({ sender: h.webContents, senderFrame: { url: workspace } });
+    const saved = (h) => JSON.parse(fs.readFileSync(h.settingsPath, "utf8"));
+    // main.js runs in its own VM context: compare its values structurally.
+    const plain = (value) => JSON.parse(JSON.stringify(value));
+
+    // Sign-in at an account-level URL lands on the workspace's own host.
+    async function joinThroughAccount(t, options = {}) {
+      const h = loadNavigationHarness({
+        serverUrl: picked,
+        databricksMode: "browser",
+        ensureSession: async () => workspaceOrigin,
+        ...options,
+      });
+      t.after(h.cleanup);
+      h.api.registerIpc();
+      await h.ipc.get("omnigent:set-server-url")(setupEvent(h), picked);
+      h.setUrl(workspace);
+      return h;
+    }
+
+    it("keeps the workspace URL for sign-in, and shows the pick", async (t) => {
+      const h = await joinThroughAccount(t);
+      assert.equal(saved(h).server_url, workspace);
+      assert.deepEqual(saved(h).recent_servers, [workspace]);
+      assert.deepEqual(saved(h).server_labels, { [workspaceOrigin]: picked });
+      assert.deepEqual(plain(await h.ipc.get("omnigent:get-recent-servers")(setupEvent(h))), [
+        pickedListed,
+      ]);
+      assert.equal(await h.ipc.get("omnigent:get-server-url")(setupEvent(h)), picked);
+      const picker = plain(await h.ipc.get("omnigent:get-server-picker")(pageEvent(h)));
+      assert.equal(picker.currentOrigin, workspaceOrigin);
+      assert.equal(picker.currentServer, picked);
+      assert.deepEqual(picker.recentServers, [workspace]);
+      assert.deepEqual(picker.recentLabels, { [workspace]: picked });
+    });
+
+    it("folds the workspace into the organization's server on the setup page", async (t) => {
+      const h = await joinThroughAccount(t, { managedServers: [picked] });
+      assert.deepEqual(plain(await h.ipc.get("omnigent:get-recent-servers")(setupEvent(h))), []);
+    });
+
+    it("lists the workspace once when the organization provides the workspace URL itself", async (t) => {
+      const h = await joinThroughAccount(t, { managedServers: [`${workspaceOrigin}/`] });
+      assert.deepEqual(plain(await h.ipc.get("omnigent:get-recent-servers")(setupEvent(h))), []);
+    });
+
+    it("forgets without adding labels to settings that had none", async (t) => {
+      const h = loadNavigationHarness();
+      t.after(h.cleanup);
+      h.api.registerIpc();
+      fs.writeFileSync(
+        h.settingsPath,
+        JSON.stringify({ recent_servers: ["https://a.example.com/", "https://b.example.com/"] }),
+      );
+      await h.ipc.get("omnigent:forget-recent-server")(setupEvent(h), "https://a.example.com/");
+      assert.deepEqual(saved(h), { recent_servers: ["https://b.example.com/"] });
+    });
+
+    i
```

**File**: `web/electron/test/server_labels.test.js` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+"use strict";
+
+const { describe, it } = require("node:test");
+const assert = require("node:assert/strict");
+const { parseServerLabels, serverLabel, withConnectLabel } = require("../src/server_labels");
+
+const PICKED = "https://accounts.cloud.databricks.com/omnigent?o=123";
+const WORKSPACE = "https://dbc-1234.cloud.databricks.com";
+const OTHER = "https://dbc-5678.cloud.databricks.com";
+
+describe("server labels", () => {
+  it("keeps only origin → string entries from a settings value", () => {
+    assert.deepEqual(parseServerLabels(undefined), {});
+    assert.deepEqual(parseServerLabels(["x"]), {});
+    assert.deepEqual(
+      parseServerLabels({
+        [WORKSPACE]: PICKED,
+        "https://bad.example.com/path": PICKED, // not a bare origin
+        "https://num.example.com": 42,
+        "https://typo.example.com": "not a url", // hand-edited
+      }),
+      { [WORKSPACE]: PICKED },
+    );
+  });
+
+  it("names any URL on a labeled host by its pick", () => {
+    const labels = { [WORKSPACE]: PICKED };
+    assert.equal(serverLabel(labels, `${WORKSPACE}/omnigent`), PICKED);
+    assert.equal(serverLabel(labels, "https://other.example.com/"), null);
+    assert.equal(serverLabel(labels, "not a url"), null);
+    assert.equal(serverLabel(labels, 42), null);
+    // Inherited keys never count as labels.
+    assert.equal(serverLabel({}, "https://constructor"), null);
+  });
+
+  it("labels a host sign-in moved to, and drops the label on a direct connect", () => {
+    const recents = [`${WORKSPACE}/omnigent`, `${OTHER}/omnigent`];
+    const moved = withConnectLabel({ [OTHER]: PICKED }, PICKED, `${WORKSPACE}/omnigent`, recents);
+    assert.deepEqual(moved, { [OTHER]: PICKED, [WORKSPACE]: PICKED });
+    assert.deepEqual(withConnectLabel(moved, WORKSPACE, `${WORKSPACE}/omnigent`, recents), {
+      [OTHER]: PICKED,
+    });
+  });
+
+  it("keeps labels only for hosts still in the recents", () => {
+    const labels = { [OTHER]: PICKED };
+    assert.deepEqual(withConnectLabel(labels, PICKED, `${WORKSPACE}/omnigent`, [WORKSPACE]), {
+      [WORKSPACE]: PICKED,
+    });
+  });
+});
```

**File**: `web/src/lib/nativeBridge.ts` (modified, +7/-0)
```diff
@@ -340,6 +340,13 @@ export interface ElectronUpdateBridge {
 export interface ServerPickerInfo {
   /** Origin this window is connected to, e.g. `"http://localhost:8000"`. */
   currentOrigin: string;
+  /**
+   * The server URL the user picked when sign-in moved to `currentOrigin`'s host
+   * (it may carry a workspace `?o=` selector), else null. Absent on older shells.
+   */
+  currentServer?: string | null;
+  /** Recent URL → the server URL the user picked for it, for display. Absent on older shells. */
+  recentLabels?: Record<string, string>;
   /**
    * Server URLs supplied through macOS Managed Preferences. Optional because a
    * newer server-served SPA can run inside a desktop shell that predates MDM.
```

#### Recent Merged Pull Requests:
- **PR #8644** (2026-09-30): fix(web): clear stale "Working…" after a mid-turn server restart (@TomeHirata)
- **PR #8636** (closed): [astra] fix(desktop): show progress through setup, sign-in and server loading (@hzub)
- **PR #8634** (2026-09-30): [opus] fix(desktop): show sign-in, connect and server-loading progress in the onboarding wizard (@hzub)
- **PR #8627** (2026-09-30): feat(desktop): name managed servers from an MDM serverNames dictionary (@hzub)
- **PR #8622** (2026-09-30): docs: correct automation validation and history guidance (@PattaraS)
- **PR #8621** (2026-09-30): test: distinguish incomplete harness bench runs from passing checks (@PattaraS)
- **PR #8620** (2026-09-30): fix: queue Claude SDK compact commands in chat (@serena-ruan)
- **PR #8618** (2026-09-30): fix(desktop): show the picked server when sign-in moves to the workspace host (@hzub)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
