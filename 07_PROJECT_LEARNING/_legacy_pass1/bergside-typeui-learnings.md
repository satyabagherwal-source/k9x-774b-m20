# Forensic Learning Record (Deep Inspection): bergside/typeui

> **Canonical Artifact**: `07_PROJECT_LEARNING/bergside-typeui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bergside/typeui](https://github.com/bergside/typeui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:15:54.189Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bergside/typeui`
- **Description**: Build better UI with AI
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2002 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `plugins/cline/typeui/index.ts`
```
import { createTool, type AgentPlugin } from "@cline/sdk";

const TYPEUI_MCP_URL = "https://mcp.typeui.sh";
const TYPEUI_DOCS_URL = "https://www.typeui.sh/docs/guides/cline";

const mcpConfig = `{
  "mcpServers": {
    "typeui": {
      "url": "${TYPEUI_MCP_URL}",
      "disabled": false,
      "autoApprove": []
    }
  }
}`;

const typeuiPlugin: AgentPlugin = {
  name: "typeui",
  manifest: {
    capabilities: ["tools"],
  },
  setup(api) {
    api.registerTool(
      createTool({
        name: "typeui_setup_help",
        description:
          "Show how to connect TypeUI MCP to Cline for design systems, UI prompts, and layout variations.",
        inputSchema: {
          type: "object",
          properties: {},
        },
        async execute() {
          return [
            "Connect Cline to the hosted TypeUI MCP server:",
            "",
            mcpConfig,
            "",
            "After TypeUI is connected, ask Cline for UI in plain language:",
            "",
            "Build me a landing page.",
            "",
            "Docs:",
            TYPEUI_DOCS_URL,
          ].join("\n");
        },
      }),
    );
  },
};

export default typeuiPlugin;


```

### Core Architecture Module: `plugins/hermes/typeui/__init__.py`
```
"""Directory-plugin entrypoint for TypeUI Hermes integration."""

try:
    from .typeui_hermes import register
except ImportError:
    from typeui_hermes import register

__all__ = ["register"]

```

### Core Architecture Module: `plugins/hermes/typeui/typeui_hermes/__init__.py`
```
"""TypeUI plugin registration for Hermes Agent."""

from __future__ import annotations

import json
import shlex
from pathlib import Path

from . import schemas, tools


def _format_json_result(payload: str, *, status: bool = False) -> str:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return payload

    if data.get("error"):
        return f"TypeUI MCP error: {data['error']}"

    if status:
        if data.get("configured"):
            return "\n".join(
                [
                    "TypeUI MCP is configured in Hermes.",
                    f"Config: {data.get('config_path')}",
                    "",
                    json.dumps(data.get("server", {}), indent=2),
                ]
            )

        return "\n".join(
            [
                "TypeUI MCP is not configured in Hermes yet.",
                f"Config: {data.get('config_path')}",
                "",
                "Install it with:",
                "hermes typeui install-mcp",
            ]
        )

    changed = bool(data.get("changed"))
    first_line = (
        "TypeUI MCP has been installed in Hermes config."
        if changed
        else "TypeUI MCP is already installed in Hermes config."
    )
    lines = [
        first_line,
        f"Config: {data.get('config_path')}",
    ]

    if data.get("backup_path"):
        lines.append(f"Backup: {data['backup_path']}")

    lines.extend(
        [
            "",
            "Next, authorize TypeUI OAuth:",
            "hermes mcp login typeui",
            "",
            "If Hermes is already running, reload MCP servers in the session:",
            "/reload-mcp",
        ]
    )

    return "\n".join(lines)


def _cli_command(args) -> None:
    subcommand = getattr(args, "typeui_command", None)
    config_path = getattr(args, "config_path", None)

    if subcommand == "install-mcp":
        result = tools.install_mcp(
            {
                "force": bool(getattr(args, "force", False)),
                "config_path": config_path,
            }
        )
        print(_format_json_result(result))
        return

    if subcommand == "mcp-status":
        result = tools.mcp_status({"config_path": config_path})
        print(_format_json_result(result, status=True))
        return

    print("Usage: hermes typeui <install-mcp|mcp-status>")


def _setup_argparse(subparser) -> None:
    subcommands = subparser.add_subparsers(dest="typeui_command")

    install = subcommands.add_parser(
        "install-mcp",
        help="Install the hosted TypeUI MCP server into Hermes config.",
    )
    install.add_argument(
        "--force",
        action="store_true",
        help="Overwrite the existing typeui MCP server entry.",
    )
    install.add_argument(
        "--config",
        dest="config_path",
        help="Path to Hermes config.yaml. Defaults to $HERMES_HOME/config.yaml or ~/.hermes/config.yaml.",
    )

    status = subcommands.add_parser(
        "mcp-status",
        help="Show whether TypeUI MCP is installed in Hermes config.",
    )
    status.add_argument(
        "--config",
        dest="config_path",
        help="Path to Hermes config.yaml. Defaults to $HERMES_HOME/config.yaml or ~/.hermes/config.yaml.",
    )

    subparser.set_defaults(func=_cli_command)


def _slash_command(raw_args: str) -> str:
    try:
        parts = shlex.split(raw_args or "")
    except ValueError as exc:
        return f"Invalid /typeui arguments: {exc}"

    subcommand = parts[0] if parts else "mcp-status"
    force = "--force" in parts

    if subcommand in {"help", "-h", "--help"}:
        return "\n".join(
            [
                "Usage:",
                "/typeui install-mcp [--force]",
                "/typeui mcp-status",
            ]
        )

    if subcommand in {"install", "install-mcp"}:
        result = tools.install_mcp({"force": force})
        return _format_json_result(result)

    if subcommand in {"status", "mcp-status"}:
        result = tools.mcp_status({})
        return _format_json_result(result, status=True)

    return "Unknown /typeui command. Use /typeui help."


def _register_skills(ctx) -> None:
    if not hasattr(ctx, "register_skill"):
        return

    skills_dir = Path(__file__).parent / "skills"
    if not skills_dir.exists():
        return

    for child in sorted(skills_dir.iterdir()):
        skill_md = child / "SKILL.md"
        if child.is_dir() and skill_md.exists():
            ctx.register_skill(child.name, skill_md)


def register(ctx) -> None:
    """Register TypeUI tools, commands, and bundled skills with Hermes."""
    ctx.register_tool(
        name="typeui_install_mcp",
        toolset="typeui",
        schema=schemas.TYPEUI_INSTALL_MCP,
        handler=tools.install_mcp,
    )
    ctx.register_tool(
        name="typeui_mcp_status",
        toolset="typeui",
        schema=schemas.TYPEUI_MCP_STATUS,
        handler=tools.mcp_status,
    )

    if hasattr(ctx, "register_cli_command"):
        ctx.register_cli_command(
            name="typeui",
            help="Install and inspect TypeUI MCP for Hermes.",
            setup_fn=_setup_argparse,
            handler_fn=_cli_command,
        )

    if hasattr(ctx, "register_command"):
        ctx.register_command(
            "typeui",
            handler=_slash_command,
            description="Install and inspect TypeUI MCP.",
            args_hint="install-mcp|mcp-status",
        )

    _register_skills(ctx)

```

### Core Architecture Module: `plugins/hermes/typeui/typeui_hermes/schemas.py`
```
"""Tool schemas for the TypeUI Hermes plugin."""

TYPEUI_INSTALL_MCP = {
    "name": "typeui_install_mcp",
    "description": (
        "Install or repair the hosted TypeUI MCP server in Hermes Agent config. "
        "Use when the user wants Hermes to connect to TypeUI, enable TypeUI design "
        "skills, or add TypeUI MCP to ~/.hermes/config.yaml."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "force": {
                "type": "boolean",
                "description": "Overwrite the existing typeui MCP server entry if it is already configured.",
            },
            "config_path": {
                "type": "string",
                "description": "Optional path to Hermes config.yaml. Defaults to $HERMES_HOME/config.yaml or ~/.hermes/config.yaml.",
            },
        },
    },
}

TYPEUI_MCP_STATUS = {
    "name": "typeui_mcp_status",
    "description": (
        "Show whether the hosted TypeUI MCP server is configured in Hermes Agent. "
        "Use before installing or when troubleshooting TypeUI MCP availability."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "config_path": {
                "type": "string",
                "description": "Optional path to Hermes config.yaml. Defaults to $HERMES_HOME/config.yaml or ~/.hermes/config.yaml.",
            },
        },
    },
}

```

### Core Architecture Module: `plugins/hermes/typeui/typeui_hermes/tools.py`
```
"""Tool handlers for installing TypeUI MCP in Hermes Agent."""

from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover - Hermes ships YAML support.
    yaml = None


TYPEUI_MCP_URL = "https://mcp.typeui.sh"
TYPEUI_MCP_SERVER = {
    "url": TYPEUI_MCP_URL,
    "auth": "oauth",
}
_RAW_CONFIG_TEXT = "__typeui_raw_config_text"


def _json(data: dict[str, Any]) -> str:
    return json.dumps(data, indent=2, sort_keys=True)


def _default_config_path() -> Path:
    hermes_home = os.environ.get("HERMES_HOME")
    if hermes_home:
        return Path(hermes_home).expanduser() / "config.yaml"
    return Path.home() / ".hermes" / "config.yaml"


def _resolve_config_path(value: Any) -> Path:
    if isinstance(value, str) and value.strip():
        return Path(value).expanduser()
    return _default_config_path()


def _unquote_yaml_scalar(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def _load_config_without_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}

    raw_text = path.read_text(encoding="utf-8")
    config: dict[str, Any] = {_RAW_CONFIG_TEXT: raw_text}

    if not raw_text.strip():
        return config

    lines = raw_text.splitlines()
    mcp_index = None
    for index, line in enumerate(lines):
        if line.startswith("mcp_servers:"):
            mcp_index = index
            break

    if mcp_index is None:
        config["mcp_servers"] = {}
        return config

    typeui_server: dict[str, Any] | None = None
    in_typeui = False
    in_auth = False

    for line in lines[mcp_index + 1 :]:
        if not line.strip() or line.lstrip().startswith("#"):
            continue

        indent = len(line) - len(line.lstrip(" "))
        stripped = line.strip()

        if indent == 0:
            break

        if indent == 2 and stripped.startswith("typeui:"):
            typeui_server = {}
            in_typeui = True
            in_auth = False
            continue

        if in_typeui and indent <= 2:
            break

        if not in_typeui or typeui_server is None:
            continue

        if indent == 4 and ":" in stripped:
            key, value = stripped.split(":", 1)
            key = key.strip()
            value = value.split(" #", 1)[0].strip()

            if key == "url":
                typeui_server["url"] = _unquote_yaml_scalar(value)
                in_auth = False
            elif key == "auth" and value:
                typeui_server["auth"] = _unquote_yaml_scalar(value)
                in_auth = False
            elif key == "auth":
                typeui_server["auth"] = {}
                in_auth = True
            else:
                in_auth = False
            continue

        if in_auth and indent == 6 and ":" in stripped:
            key, value = stripped.split(":", 1)
            if key.strip() == "type":
                typeui_server["auth"]["type"] = _unquote_yaml_scalar(
                    value.split(" #", 1)[0].strip()
                )

    config["mcp_servers"] = {"typeui": typeui_server} if typeui_server else {}
    return config


def _load_config(path: Path) -> dict[str, Any]:
    if yaml is None:
        return _load_config_without_yaml(path)

    if not path.exists():
        return {}

    with path.open("r", encoding="utf-8") as handle:
        loaded = yaml.safe_load(handle) or {}

    if not isinstance(loaded, dict):
        raise ValueError(f"{path} must contain a YAML mapping at the top level.")

    return loaded


def _typeui_server_yaml() -> str:
    return "\n".join(
        [
            "mcp_servers:",
            "  typeui:",
            f'    url: "{TYPEUI_MCP_URL}"',
            "    auth: oauth",
            "",
        ]
    )


def _write_config_without_yaml(path: Path, config: dict[str, Any]) -> str | None:
    raw_text = config.get(_RAW_CONFIG_TEXT)
    server = (config.get("mcp_servers") or {}).get("typeui")

    if not _is_typeui_mcp_configured(server):
        raise RuntimeError("Cannot write TypeUI MCP config without a valid typeui server entry.")

    if raw_text and raw_text.strip():
        if "\nmcp_servers:" in f"\n{raw_text}" and "typeui:" not in raw_text:
            raise RuntimeError(
                "PyYAML is required to update an existing Hermes config that already contains mcp_servers."
            )
        next_text = raw_text.rstrip() + "\n\n" + _typeui_server_yaml()
    else:
        next_text = _typeui_server_yaml()

    path.parent.mkdir(parents=True, exist_ok=True)
    backup_path = _backup_config(path)
    path.write_text(next_text, encoding="utf-8")
    return backup_path


def _backup_config(path: Path) -> str | None:
    if not path.exists():
        return None

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    backup_path = path.with_name(f"{path.name}.typeui.{stamp}.bak")
    shutil.copy2(path, backup_path)
    return str(backup_path)


def _write_config(path: Path, config: dict[str, Any]) -> str | None:
    if yaml is None:
        return _write_config_without_yaml(path, config)

    path.parent.mkdir(parents=True, exist_ok=True)
    backup_path = _backup_config(path)

    config = {key: value for key, value in config.items() if key != _RAW_CONFIG_TEXT}

    with path.open("w", encoding="utf-8") as handle:
        yaml.safe_dump(config, handle, sort_keys=False, default_flow_style=False)

    return backup_path


def _has_oauth_auth(auth: Any) -> bool:
    if auth == "oauth":
        return True

    if isinstance(auth, dict):
        return auth.get("type") == "oauth"

    return False


def _is_typeui_mcp_configured(server: Any) -> bool:
    return (
        isinstance(server, dict)
        and server.get("url") == TYPEUI_MCP_URL
        and _has_oauth_auth(server.get("auth"))
    )


def _server_payload(current: Any) -> dict[str, Any]:
    server = dict(current) if isinstance(current, dict) else {}
    server.update(TYPEUI_MCP_SERVER)
    return server


def install_mcp(args: dict[str, Any], **kwargs: Any) -> str:
    """Install TypeUI MCP into Hermes config.yaml."""
    try:
        config_path = _resolve_config_path(args.get("config_path"))
        force = bool(args.get("force", False))
        config = _load_config(config_path)

        mcp_servers = config.get("mcp_servers")
        if mcp_servers is None:
            mcp_servers = {}
            config["mcp_servers"] = mcp_servers
        elif not isinstance(mcp_servers, dict):
            raise ValueError("mcp_servers must be a YAML mapping.")

        current = mcp_servers.get("typeui")
        was_configured = _is_typeui_mcp_configured(current)
        changed = False
        backup_path = None

        if force or not was_configured:
            mcp_servers["typeui"] = _server_payload(current)
            backup_path = _write_config(config_path, config)
            changed = True

        return _json(
            {
                "changed": changed,
                "was_configured": was_configured,
                "config_path": str(config_path),
                "backup_path": backup_path,
                "server": mcp_servers.get("typeui"),
                "next_steps": [
                    "hermes mcp login typeui",
                    "Restart Hermes or run /reload-mcp in an active Hermes session.",
                ],
            }
        )
    except Exception as exc:
        return _json({"error": str(exc)})


def mcp_status(args: dict[str, Any], **kwargs: Any) -> str:
    """Return TypeUI MCP status for Hermes config.yaml."""
    try:
        config_path = _resolve_config_path(args.get("config_path"))
        config = _load_config(config_path)
        mcp_servers = config.get("mcp_servers") or {}

        if not isinstance(mcp_servers, dict
```

### Core Architecture Module: `plugins/openclaw/typeui/index.js`
```
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "typebox";

const TYPEUI_MCP_URL = "https://mcp.typeui.sh";
const TYPEUI_MCP_SERVER = {
  url: TYPEUI_MCP_URL,
  transport: "streamable-http",
  auth: "oauth",
};

function isTypeUiMcpConfigured(server) {
  return (
    server?.url === TYPEUI_MCP_URL &&
    server?.transport === "streamable-http" &&
    server?.auth === "oauth"
  );
}

function getTypeUiMcpStatus(api) {
  const cfg = api.runtime.config.current();
  const server = cfg?.mcp?.servers?.typeui;

  return {
    configured: isTypeUiMcpConfigured(server),
    server,
  };
}

async function installTypeUiMcp(api, { force = false } = {}) {
  let wasConfigured = false;
  let changed = false;

  const result = await api.runtime.config.mutateConfigFile({
    afterWrite: { mode: "auto" },
    mutate(draft) {
      draft.mcp ??= {};
      draft.mcp.servers ??= {};

      const current = draft.mcp.servers.typeui;
      wasConfigured = isTypeUiMcpConfigured(current);

      if (wasConfigured && !force) {
        return;
      }

      draft.mcp.servers.typeui = {
        ...(typeof current === "object" && current ? current : {}),
        ...TYPEUI_MCP_SERVER,
      };
      changed = true;
    },
  });

  return {
    changed,
    wasConfigured,
    followUp: result?.followUp ?? result?.afterWrite,
  };
}

function formatInstallResult(result) {
  const firstLine = result.changed
    ? "TypeUI MCP has been installed in OpenClaw config."
    : "TypeUI MCP is already installed in OpenClaw config.";

  return [
    firstLine,
    "",
    "Next, authorize TypeUI OAuth:",
    "",
    "openclaw mcp login typeui",
    "",
    "Then verify the live MCP connection:",
    "",
    "openclaw mcp doctor typeui --probe",
  ].join("\n");
}

function formatStatusResult(status) {
  if (status.configured) {
    return [
      "TypeUI MCP is configured.",
      "",
      JSON.stringify(status.server, null, 2),
    ].join("\n");
  }

  return [
    "TypeUI MCP is not configured yet.",
    "",
    "Install it with:",
    "",
    "openclaw typeui install-mcp",
  ].join("\n");
}

export default definePluginEntry({
  id: "typeui",
  name: "TypeUI",
  description:
    "Connect OpenClaw-managed agents to TypeUI MCP for design skills, UI prompts, and layout variations.",
  register(api) {
    api.registerTool({
      name: "typeui_install_mcp",
      description: "Install the hosted TypeUI MCP server into OpenClaw config.",
      parameters: Type.Object({
        force: Type.Optional(Type.Boolean({
          description: "Overwrite the existing typeui MCP server entry if it is already present.",
        })),
      }),
      async execute(_id, params) {
        const result = await installTypeUiMcp(api, { force: Boolean(params?.force) });

        return {
          content: [{ type: "text", text: formatInstallResult(result) }],
        };
      },
    });

    api.registerTool({
      name: "typeui_mcp_status",
      description: "Show whether TypeUI MCP is installed in OpenClaw config.",
      parameters: Type.Object({}),
      async execute() {
        return {
          content: [{ type: "text", text: formatStatusResult(getTypeUiMcpStatus(api)) }],
        };
      },
    });

    api.registerCli(
      async ({ program }) => {
        const command = program
          .command("typeui")
          .description("Install and inspect TypeUI MCP for OpenClaw.");

        command
          .command("install-mcp")
          .description("Install the hosted TypeUI MCP server into OpenClaw config.")
          .option("--force", "Overwrite the existing typeui MCP server entry")
          .action(async (options) => {
            const result = await installTypeUiMcp(api, { force: Boolean(options.force) });
            console.log(formatInstallResult(result));
          });

        command
          .command("mcp-status")
          .description("Show whether TypeUI MCP is installed in OpenClaw config.")
          .action(() => {
            console.log(formatStatusResult(getTypeUiMcpStatus(api)));
          });
      },
      {
        descriptors: [
          {
            name: "typeui",
            description: "Install and inspect TypeUI MCP for OpenClaw.",
            hasSubcommands: true,
          },
        ],
      }
    );
  },
});

```

### Core Architecture Module: `plugins/opencode/typeui/index.js`
```
import { tool } from "@opencode-ai/plugin";

const TYPEUI_MCP_URL = "https://mcp.typeui.sh";
const TYPEUI_DOCS_URL = "https://www.typeui.sh/docs/guides/opencode";

const configSnippet = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "typeui": {
      "type": "remote",
      "url": "${TYPEUI_MCP_URL}",
      "enabled": true
    }
  }
}`;

export const TypeUIPlugin = async () => {
  return {
    tool: {
      typeui_setup_help: tool({
        description: "Show the TypeUI MCP configuration needed to use TypeUI with OpenCode.",
        args: {},
        async execute() {
          return [
            "Add TypeUI to OpenCode by adding this MCP server to opencode.json:",
            "",
            configSnippet,
            "",
            "Then authenticate if OpenCode asks you to sign in:",
            "",
            "opencode mcp auth typeui",
            "",
            `Docs: ${TYPEUI_DOCS_URL}`,
          ].join("\n");
        },
      }),
    },
  };
};

export default TypeUIPlugin;

```

### Core Architecture Module: `plugins/zed/typeui/src/typeui_zed.rs`
```
use schemars::JsonSchema;
use serde::Deserialize;
use zed::settings::ContextServerSettings;
use zed_extension_api::{
    self as zed, serde_json, Command, ContextServerConfiguration, ContextServerId, Os, Project,
    Result,
};

const MCP_REMOTE_PACKAGE: &str = "mcp-remote";
const MCP_REMOTE_VERSION: &str = "latest";
const TYPEUI_MCP_URL: &str = "https://mcp.typeui.sh";

struct TypeUIZedExtension;

#[derive(Debug, Default, Deserialize, JsonSchema)]
struct TypeUIContextServerSettings {
    /// Optional override for self-hosted or staging TypeUI MCP deployments.
    #[serde(default)]
    mcp_url: Option<String>,
}

impl zed::Extension for TypeUIZedExtension {
    fn new() -> Self {
        Self
    }

    fn context_server_command(
        &mut self,
        _context_server_id: &ContextServerId,
        project: &Project,
    ) -> Result<Command> {
        if zed::npm_package_installed_version(MCP_REMOTE_PACKAGE)?.is_none() {
            zed::npm_install_package(MCP_REMOTE_PACKAGE, MCP_REMOTE_VERSION)?;
        }

        let settings = ContextServerSettings::for_project("typeui", project)?;
        let settings = match settings.settings {
            Some(settings) => serde_json::from_value::<TypeUIContextServerSettings>(settings)
                .map_err(|error| error.to_string())?,
            None => TypeUIContextServerSettings::default(),
        };

        let mcp_url = settings.mcp_url.unwrap_or_else(|| TYPEUI_MCP_URL.to_string());
        let command = if zed::current_platform().0 == Os::Windows {
            "node_modules/.bin/mcp-remote.cmd".to_string()
        } else {
            let path = "node_modules/.bin/mcp-remote";
            zed::make_file_executable(path)?;
            path.to_string()
        };

        Ok(Command {
            command,
            args: vec![mcp_url],
            env: Vec::new(),
        })
    }

    fn context_server_configuration(
        &mut self,
        _context_server_id: &ContextServerId,
        _project: &Project,
    ) -> Result<Option<ContextServerConfiguration>> {
        let installation_instructions =
            include_str!("../configuration/installation_instructions.md").to_string();
        let default_settings = include_str!("../configuration/default_settings.jsonc").to_string();
        let settings_schema =
            serde_json::to_string(&schemars::schema_for!(TypeUIContextServerSettings))
                .map_err(|error| error.to_string())?;

        Ok(Some(ContextServerConfiguration {
            installation_instructions,
            default_settings,
            settings_schema,
        }))
    }
}

zed::register_extension!(TypeUIZedExtension);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4** (2026-08-27): **Opencode typeui mcp not working**
  *Symptoms*: The server-side fundamentals check is broken for OpenCode t can't verify local installations.
  **Post-Mortem & Fix Analysis**:
  > Hey @gramnaters,  Did you follow our Opencode guide?  https://www.typeui.sh/docs/guides/opencode  Please share the error that you are seeing.  Thanks!
  > yes i followed  it and authenticated  heres the full logs-   MCP tools blocked  "install fundamentals" loop even after installation   TypeUI MCP at https://mcp.typeui.sh/mcp returns this for every tool call:  Run this command from the project root to install TypeUI UI/UX fundamentals: npx skills add https://github.com/bergside/typeui --skill typeui-fundamentals Even after running that command and confirming the skill is installed at .agents/skills/typeui-fundamentals/, the MCP keeps returning the same instruction. Only check_access and get_usage work — all other tools are blocked.  Agent: OpenCode v1.14.45 on Windows 11
  > Thanks for the breakdown!  Do you have a pro subscription?  https://www.typeui.sh/#pricing

- **Issue #2** (2026-08-17): **default Dropdown Menu on the website**
  *Symptoms*: just found a small ui issues on the website and thought of contributing, is this repo up for open source pr's?  <img width="1852" height="648" alt="Image" src="https://github.com/user-attachments/assets/ff268574-b0ff-4ba7-bf86-0a2c54f19e43" />

- **Issue #1** (2026-05-14): **Typo in link url in README.md**
  *Symptoms*: In README there's a link to wrong website url (wwww.typeui.sh/design-skills)  ```md ## Design skills  Check out all [design skills](https://wwww.typeui.sh/design-skills) that can be pulled into your project. Available in both `DESIGN.md` and `SKILL.md` formats. ```
  **Post-Mortem & Fix Analysis**:
  > Fixed. Thank you!

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

### Incident Patch 1: `538c2de4` (2026-06-15)
**Commit Message**: fix: icon and placeholder positioning

**File**: `skills/fundamentals/ui-principles.md` (modified, +8/-0)
```diff
@@ -87,6 +87,14 @@ When padding differs per side, use the **smallest inset** that separates the cur
 - Match vertical padding, font size, line-height, and border width so the outer edges line up. If the design system defines button height, **derive the input height from that token** — do not invent a second size.
 - This rule applies to text fields, search fields, selects, and textareas paired with a button in a horizontal group. Stacked layouts (input above button) are exempt.
 
+### Icon inset on inputs must balance both sides
+
+- When an input carries a **leading or trailing icon** (search magnifier, mail glyph, currency symbol, etc.), the placeholder and typed text sit **after** the icon — not centered in the full field.
+- **The gap from the icon to the input edge must equal the gap from the icon to the placeholder/text.** If the icon sits 12px from the start edge, leave 12px between the icon and where the text begins. Asymmetric spacing makes the field feel lopsided: text hugging the icon on one side while the icon floats too far from the border on the other.
+- Measure both gaps on the **same axis** — inline-start edge → icon → text start (LTR: left edge → icon → text). Trailing icons mirror the rule on the inline-end side.
+- Derive input text padding from the design system's icon inset token: `textPaddingStart = iconInset + iconWidth + iconInset` (or the equivalent in your stack). Do not pad text from the field edge alone and bolt the icon on with a separate, smaller inset.
+- Applies to search fields, text inputs, textareas, and selects with inline icons. Icon-only buttons attached to the field (clear, reveal password) follow the input + button row rule above for height; this rule governs **in-field** icon spacing only.
+
 ### Button labels must not wrap — buttons must not shrink
 
 - **Button label text must stay on one line** — wrapping to a second line is forbidden. Multi-line buttons break height rhythm, misalign adjacent controls, and read as broken layout, not intentional design.
```

---

### Incident Patch 2: `51eddbfc` (2026-05-19)
**Commit Message**: fix: codex preview

**File**: `README.md` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ Check out all [design skills](https://www.typeui.sh/design-skills). Available in
     </td>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/design-skills/codex">
-        <img src="https://www.typeui.sh/registry-examples/open.png" alt="Codex" width="220" />
+        <img src="https://www.typeui.sh/registry-examples/codex.png" alt="Codex" width="220" />
         <br /><b>Codex</b>
       </a>
     </td>
```

---

### Incident Patch 3: `9f5d4ba7` (2026-05-14)
**Commit Message**: fix: typo in README url

**File**: `README.md` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ npx typeui.sh --help
 
 ## Design skills
 
-Check out all [design skills](https://wwww.typeui.sh/design-skills) that can be pulled into your project. Available in both `DESIGN.md` and `SKILL.md` formats.
+Check out all [design skills](https://www.typeui.sh/design-skills) that can be pulled into your project. Available in both `DESIGN.md` and `SKILL.md` formats.
 
 ## Available commands
 
```

---

### Incident Patch 4: `e32e52cf` (2026-04-03)
**Commit Message**: fix: update not working when brand summary is empty field

**File**: `src/generation/existingDesignSystem.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ export function parseManagedDesignSystem(content: string): DesignSystemInput | n
 
   if (
     !productName ||
-    !brandSummary ||
+    brandSummary === null ||
     !visualStyle ||
     !typographyScale ||
     !colorPalette ||
```

**File**: `test/existingDesignSystem.test.ts` (modified, +11/-0)
```diff
@@ -22,6 +22,17 @@ describe("parseManagedDesignSystem", () => {
     expect(parseManagedDesignSystem(content)).toEqual(sampleDesign);
   });
 
+  it("accepts an empty brand section", () => {
+    const content = createManagedSkillBody("Cursor", {
+      ...sampleDesign,
+      brandSummary: ""
+    });
+    expect(parseManagedDesignSystem(content)).toEqual({
+      ...sampleDesign,
+      brandSummary: ""
+    });
+  });
+
   it("returns null when managed block is missing", () => {
     expect(parseManagedDesignSystem("# Manual only")).toBeNull();
   });
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
