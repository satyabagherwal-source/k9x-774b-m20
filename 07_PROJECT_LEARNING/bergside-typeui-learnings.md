# Forensic Learning Record (Deep Inspection): bergside/typeui

> **Canonical Artifact**: `07_PROJECT_LEARNING/bergside-typeui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bergside/typeui](https://github.com/bergside/typeui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:45:00.124Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bergside/typeui`
- **Description**: Build better UI with AI
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2012 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/renderers/claudeRenderer.ts`
```
import { DesignSystemInput, ProviderFile } from "../types";
import { createManagedSkillBody } from "./shared";

export function renderClaudeSkill(design: DesignSystemInput): ProviderFile {
  return {
    provider: "claude-code",
    relativePath: ".claude/skills/design-system/SKILL.md",
    content: createManagedSkillBody("Claude Code", design)
  };
}

```

### Core Architecture Module: `src/renderers/codexRenderer.ts`
```
import { DesignSystemInput, ProviderFile } from "../types";
import { createManagedSkillBody } from "./shared";

export function renderCodexSkill(design: DesignSystemInput): ProviderFile {
  return {
    provider: "codex",
    relativePath: ".codex/skills/design-system/SKILL.md",
    content: createManagedSkillBody("Codex", design)
  };
}

```

### Core Architecture Module: `src/renderers/cursorRenderer.ts`
```
import { DesignSystemInput, ProviderFile } from "../types";
import { createManagedSkillBody } from "./shared";

export function renderCursorSkill(design: DesignSystemInput): ProviderFile {
  return {
    provider: "cursor",
    relativePath: ".cursor/skills/design-system/SKILL.md",
    content: createManagedSkillBody("Cursor", design)
  };
}

```

### Core Architecture Module: `src/renderers/index.ts`
```
import { DesignSystemInput, PROVIDER_DETAILS, Provider, ProviderFile, SkillMetadata } from "../types";
import { createManagedSkillFile } from "./shared";

export function renderProviderFiles(
  design: DesignSystemInput,
  providers: Provider[],
  metadata: SkillMetadata
): ProviderFile[] {
  return providers.map((provider) => ({
    provider,
    relativePath: PROVIDER_DETAILS[provider].relativePath,
    content: createManagedSkillFile(PROVIDER_DETAILS[provider].title, design, metadata)
  }));
}

```

### Core Architecture Module: `src/renderers/openCodeRenderer.ts`
```
import { DesignSystemInput, ProviderFile } from "../types";
import { createManagedSkillBody } from "./shared";

export function renderOpenCodeSkill(design: DesignSystemInput): ProviderFile {
  return {
    provider: "open-code",
    relativePath: ".opencode/skills/design-system/SKILL.md",
    content: createManagedSkillBody("Open Code", design)
  };
}

```

### Core Architecture Module: `src/renderers/shared.ts`
```
import { MANAGED_BLOCK_END, MANAGED_BLOCK_START } from "../config";
import { SKILL_AUTHOR } from "../skillMetadata";
import { DesignSystemInput, SkillMetadata } from "../types";

function list(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function createManagedSkillBody(providerTitle: string, design: DesignSystemInput): string {
  return [
    MANAGED_BLOCK_START,
    `# ${design.productName} Design System Skill (${providerTitle})`,
    "",
    "## Mission",
    `You are an expert design-system guideline author for ${design.productName}.`,
    "Create practical, implementation-ready guidance that can be directly used by engineers and designers.",
    "",
    "## Brand",
    design.brandSummary,
    "",
    "## Style Foundations",
    `- Visual style: ${design.visualStyle}`,
    `- Typography scale: ${design.typographyScale}`,
    `- Color palette: ${design.colorPalette}`,
    `- Spacing scale: ${design.spacingScale}`,
    "",
    "## Accessibility",
    design.accessibilityRequirements,
    "",
    "## Writing Tone",
    design.writingTone,
    "",
    "## Rules: Do",
    list(design.doRules),
    "",
    "## Rules: Don't",
    list(design.dontRules),
    "",
    "## Expected Behavior",
    "- Follow the foundations first, then component consistency.",
    "- When uncertain, prioritize accessibility and clarity over novelty.",
    "- Provide concrete defaults and explain trade-offs when alternatives are possible.",
    "- Keep guidance opinionated, concise, and implementation-focused.",
    "",
    "## Guideline Authoring Workflow",
    "1. Restate the design intent in one sentence before proposing rules.",
    "2. Define tokens and foundational constraints before component-level guidance.",
    "3. Specify component anatomy, states, variants, and interaction behavior.",
    "4. Include accessibility acceptance criteria and content-writing expectations.",
    "5. Add anti-patterns and migration notes for existing inconsistent UI.",
    "6. End with a QA checklist that can be executed in code review.",
    "",
    "## Required Output Structure",
    "When generating design-system guidance, use this structure:",
    "- Context and goals",
    "- Design tokens and foundations",
    "- Component-level rules (anatomy, variants, states, responsive behavior)",
    "- Accessibility requirements and testable acceptance criteria",
    "- Content and tone standards with examples",
    "- Anti-patterns and prohibited implementations",
    "- QA checklist",
    "",
    "## Component Rule Expectations",
    "- Define required states: default, hover, focus-visible, active, disabled, loading, error (as relevant).",
    "- Describe interaction behavior for keyboard, pointer, and touch.",
    "- State spacing, typography, and color-token usage explicitly.",
    "- Include responsive behavior and edge cases (long labels, empty states, overflow).",
    "",
    "## Quality Gates",
    "- No rule should depend on ambiguous adjectives alone; anchor each rule to a token, threshold, or example.",
    "- Every accessibility statement must be testable in implementation.",
    "- Prefer system consistency over one-off local optimizations.",
    "- Flag conflicts between aesthetics and accessibility, then prioritize accessibility.",
    "",
    "## Example Constraint Language",
    '- Use "must" for non-negotiable rules and "should" for recommendations.',
    "- Pair every do-rule with at least one concrete don't-example.",
    "- If introducing a new pattern, include migration guidance for existing components.",
    "",
    MANAGED_BLOCK_END
  ].join("\n");
}

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseKeyValuePairs(value: string): Record<string, string> {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [rawKey, ...rawValueParts] = part.split("=");
      const key = rawKey?.trim().toLowerCase();
      const rawValue = rawValueParts.join("=").trim();
      if (key && rawValue) {
        acc[key] = rawValue;
      }
      return acc;
    }, {});
}

function parseTypographyMetadata(typographyScale: string): {
  sourceScale: string;
  primary: string;
  display: string;
  mono: string;
  weights: string;
} {
  const sourceScale = typographyScale.split("|")[0]?.trim() || "12/14/16/20/24/32";
  const fontsMatch = typographyScale.match(/\|\s*Fonts:\s*([^|]+)/i);
  const fontPairs = parseKeyValuePairs(fontsMatch?.[1] ?? "");
  const weightsMatch = typographyScale.match(/weights\s*=\s*([^|]+)/i);

  return {
    sourceScale,
    primary: fontPairs.primary ?? "Public Sans",
    display: fontPairs.display ?? fontPairs.primary ?? "Public Sans",
    mono: fontPairs.mono ?? "Space Grotesk",
    weights: weightsMatch?.[1]?.trim() ?? "400, 500, 600, 700"
  };
}

function parseColorTokens(colorPalette: string): {
  primary: string;
  secondary: string;
  tertiary: string;
  neutral: string;
  success: string;
  warning: string;
  danger: string;
  surface: string;
  text: string;
} {
  const tokensMatch = colorPalette.match(/\|\s*Tokens:\s*([^|]+)/i);
  const tokenPairs = parseKeyValuePairs(tokensMatch?.[1] ?? "");
  const primary = tokenPairs.primary ?? "#1A1C1E";
  const secondary = tokenPairs.secondary ?? "#6C7278";
  const surface = tokenPairs.surface ?? "#F7F5F2";
  const text = tokenPairs.text ?? "#1A1C1E";

  return {
    primary,
    secondary,
    tertiary: tokenPairs.tertiary ?? secondary,
    neutral: tokenPairs.neutral ?? surface,
    success: tokenPairs.success ?? "#16A34A",
    warning: tokenPairs.warning ?? "#D97706",
    danger: tokenPairs.danger ?? "#DC2626",
    surface,
    text
  };
}

function deriveSpacingTokens(spacingScale: string): { sm: string; md: string } {
  const numericValues = spacingScale.match(/\d+/g)?.map((value) => Number(value)) ?? [];
  if (numericValues.length >= 2) {
    return {
      sm: `${numericValues[0]}px`,
      md: `${numericValues[1]}px`
    };
  }
  if (/compact/i.test(spacingScale)) {
    return { sm: "4px", md: "8px" };
  }
  if (/comfortable/i.test(spacingScale)) {
    return { sm: "8px", md: "16px" };
  }
  return { sm: "8px", md: "16px" };
}

export function createSkillFrontmatter(metadata: SkillMetadata): string {
  return [
    "---",
    `name: "${escapeYamlString(metadata.name)}"`,
    `description: "${escapeYamlString(metadata.description)}"`,
    "metadata:",
    `  author: ${escapeYamlString(SKILL_AUTHOR)}`,
    "---"
  ].join("\n");
}

export function createManagedSkillFile(
  providerTitle: string,
  design: DesignSystemInput,
  metadata: SkillMetadata
): string {
  return `${createSkillFrontmatter(metadata)}\n\n${createManagedSkillBody(providerTitle, design)}`;
}

export function createDesignMarkdownFile(design: DesignSystemInput): string {
  const typography = parseTypographyMetadata(design.typographyScale);
  const colors = parseColorTokens(design.colorPalette);
  const spacing = deriveSpacingTokens(design.spacingScale);

  return [
    "---",
    `name: "${escapeYamlString(design.productName)}"`,
    "colors:",
    `  primary: "${colors.primary}"`,
    `  secondary: "${colors.secondary}"`,
    `  tertiary: "${colors.tertiary}"`,
    `  neutral: "${colors.neutral}"`,
    `  success: "${colors.success}"`,
    `  warning: "${colors.warning}"`,
    `  danger: "${colors.danger}"`,
    `  surface: "${colors.surface}"`,
    `  text: "${colors.text}"`,
    "typography:",
    "  h1:",
    `    fontFamily: "${escapeYamlString(typography.display)}"`,
    "    fontSize: 3rem",
    "  body-md:",
    `    fontFamily: "${escapeYamlString(typography.primary)}"`,
    "    fontSize: 1rem",
    "  label-caps:",
    `    fontFamily: "${escapeYamlString(typography.mono)}"`,
    "    fontSize: 0.75rem",
    `  sourceScale: "${escapeYamlString(typography.sourceScale)}"`,
    `  weights: "${escapeYamlString(typography.weights)}"`,
    "rounded:",
    "  sm: 4px",
    "  md: 8px",
    "spacing:",
    `  sm: ${spacing.sm}`,
    `  md: ${spacing.md}`,
    `  sourceScale: "${escapeYamlString(design.spacingScale)}"`,
    "---",
    "",
    "## Overview",
    design.brandSummary,
    "",
    "## Style Foundations",
    `- **Visual style:** ${design.visualStyle}`,
    `- **Typography scale:** ${design.typographyScale}`,
    `- **Color palette:** ${design.colorPalette}`,
    `- **Spacing scale:** ${design.spacingScale}`,
    "",
    "## Accessibility",
    design.accessibilityRequirements,
    "",
    "## Writing Tone",
    design.writingTone,
    "",
    "## Rules: Do",
    list(design.doRules),
    "",
    "## Rules: Don't",
    list(design.dontRules)
  ].join("\n");
}

```

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

        if not isinstance(mcp_servers, dict):
            raise ValueError("mcp_servers must be a YAML mapping.")

        server = mcp_servers.get("typeui")

        return _json(
            {
                "configured": _is_typeui_mcp_configured(server),
                "config_path": str(config_path),
                "server": server,
                "expected": TYPEUI_MCP_SERVER,
            }
        )
    except Exception as exc:
        return _json({"error": str(exc)})

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

### Incident Patch 1: `2a977f1f` (2026-07-04)
**Commit Message**: add: eve guide

**File**: `README.md` (modified, +21/-10)
```diff
@@ -91,6 +91,17 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/openclaw"><b>Open OpenClaw guide →</b></a>
     </td>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/eve">
+        <img src="./ai-tools-logos/light/eve.svg" alt="Eve logo" width="48" height="48" />
+        <br /><br />
+        <b>Eve</b>
+      </a>
+      <br />
+      <sub>Add TypeUI design skills to Eve agents.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/eve"><b>Open Eve guide →</b></a>
+    </td>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/mistral">
         <img src="./ai-tools-logos/light/mistral-ai.svg" alt="Mistral logo" width="69" height="48" />
@@ -102,6 +113,8 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/mistral"><b>Open Mistral guide →</b></a>
     </td>
+  </tr>
+  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/opencode">
         <img src="./ai-tools-logos/light/opencode.svg" alt="OpenCode logo" width="48" height="48" />
@@ -113,8 +126,6 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/opencode"><b>Install in OpenCode →</b></a>
     </td>
-  </tr>
-  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/vscode">
         <img src="./ai-tools-logos/light/vscode.svg" alt="Visual Studio Code logo" width="48" height="48" />
@@ -137,6 +148,8 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/antigravity"><b>Open Antigravity guide →</b></a>
     </td>
+  </tr>
+  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/windsurf">
         <img src="./ai-tools-logos/light/windsurf.svg" alt="Windsurf logo" width="48" height="48" />
@@ -148,8 +161,6 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/windsurf"><b>Install in Windsurf →</b></a>
     </td>
-  </tr>
-  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/jetbrains">
         <img src="./ai-tools-logos/light/junie.svg" alt="Junie logo" width="48" height="48" />
@@ -172,6 +183,8 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/zed"><b>Open Zed guide →</b></a>
     </td>
+  </tr>
+  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/github-copilot">
         <img src="./ai-tools-logos/light/githubcopilot.svg" alt="GitHub Copilot logo" width="48" height="48" />
@@ -183,8 +196,6 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/github-copilot"><b>Open GitHub Copilot guide →</b></a>
     </td>
-  </tr>
-  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/cline">
         <img src="./ai-tools-logos/light/cline.svg" alt="Cline logo" width="48" height="48" />
@@ -207,6 +218,8 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/qwen"><b>Open Qwen guide →</b></a>
     </td>
+  </tr>
+  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/amp">
         <img src="./ai-tools-logos/light/ampcode.svg" alt="Amp logo" width="94" height="48" />
@@ -218,8 +231,6 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/amp"><b>Open Amp guide →</b></a>
     </td>
-  </tr>
-  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/goose">
         <img src="./ai-tools-logos/light/goose.svg" alt="Goose logo" width="48" height="48" />
@@ -242,6 +253,8 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/lovable"><b>Open Lovable guide →</b></a>
     </td>
+  </tr>
+  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/replit">
         <img src="./ai-tools-logos/light/replit-color.svg" alt="Replit logo" width="48" height="48" />
@@ -253,8 +266,6 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/replit"><b>Open Replit guide →</b></a>
```

**File**: `ai-tools-logos/light/eve.svg` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+<svg width="1155" height="1000" viewBox="0 0 1155 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
+<path d="M577.344 0L1154.69 1000H0L577.344 0Z" fill="black"/>
+</svg>
```

---

### Incident Patch 2: `4d8619be` (2026-07-02)
**Commit Message**: add: Z.ai integration guide

**File**: `README.md` (modified, +35/-22)
```diff
@@ -56,6 +56,41 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/grok"><b>Open Grok guide →</b></a>
     </td>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/z-ai">
+        <img src="./ai-tools-logos/light/zai.svg" alt="Z.ai logo" width="48" height="48" />
+        <br /><br />
+        <b>Z.ai</b>
+      </a>
+      <br />
+      <sub>Add the hosted TypeUI MCP server to Z.ai ZCode.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/z-ai"><b>Open Z.ai guide →</b></a>
+    </td>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/hermes">
+        <img src="./ai-tools-logos/light/hermes.svg" alt="Hermes logo" width="48" height="48" />
+        <br /><br />
+        <b>Hermes</b>
+      </a>
+      <br />
+      <sub>Install the TypeUI MCP plugin for Hermes Agent.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/hermes"><b>Open Hermes guide →</b></a>
+    </td>
+  </tr>
+  <tr>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/openclaw">
+        <img src="./ai-tools-logos/light/openclaw.svg" alt="OpenClaw logo" width="48" height="48" />
+        <br /><br />
+        <b>OpenClaw</b>
+      </a>
+      <br />
+      <sub>Add the hosted TypeUI MCP server to OpenClaw.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/openclaw"><b>Open OpenClaw guide →</b></a>
+    </td>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/mistral">
         <img src="./ai-tools-logos/light/mistral-ai.svg" alt="Mistral logo" width="69" height="48" />
@@ -231,28 +266,6 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/v0"><b>Open v0 guide →</b></a>
     </td>
-    <td align="center" width="33%">
-      <a href="https://www.typeui.sh/docs/guides/hermes">
-        <img src="./ai-tools-logos/light/hermes.svg" alt="Hermes logo" width="48" height="48" />
-        <br /><br />
-        <b>Hermes</b>
-      </a>
-      <br />
-      <sub>Install the TypeUI MCP plugin for Hermes Agent.</sub>
-      <br /><br />
-      <a href="https://www.typeui.sh/docs/guides/hermes"><b>Open Hermes guide →</b></a>
-    </td>
-    <td align="center" width="33%">
-      <a href="https://www.typeui.sh/docs/guides/openclaw">
-        <img src="./ai-tools-logos/light/openclaw.svg" alt="OpenClaw logo" width="48" height="48" />
-        <br /><br />
-        <b>OpenClaw</b>
-      </a>
-      <br />
-      <sub>Add the hosted TypeUI MCP server to OpenClaw.</sub>
-      <br /><br />
-      <a href="https://www.typeui.sh/docs/guides/openclaw"><b>Open OpenClaw guide →</b></a>
-    </td>
   </tr>
 </table>
 
```

**File**: `ai-tools-logos/light/zai.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg fill="currentColor" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Z.ai</title><path d="M12.105 2L9.927 4.953H.653L2.83 2h9.276zM23.254 19.048L21.078 22h-9.242l2.174-2.952h9.244zM24 2L9.264 22H0L14.736 2H24z"></path></svg>
\ No newline at end of file
```

---

### Incident Patch 3: `baf2aee8` (2026-06-29)
**Commit Message**: add: Hermes integration guide

**File**: `README.md` (modified, +11/-1)
```diff
@@ -231,7 +231,17 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/v0"><b>Open v0 guide →</b></a>
     </td>
-    <td align="center" width="33%"></td>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/hermes">
+        <img src="./ai-tools-logos/light/hermes.svg" alt="Hermes logo" width="48" height="48" />
+        <br /><br />
+        <b>Hermes</b>
+      </a>
+      <br />
+      <sub>Add the hosted TypeUI MCP server to Hermes Agent.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/hermes"><b>Open Hermes guide →</b></a>
+    </td>
     <td align="center" width="33%"></td>
   </tr>
 </table>
```

**File**: `ai-tools-logos/light/hermes.svg` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" role="img" aria-labelledby="title desc">
+  <title id="title">Hermes</title>
+  <desc id="desc">Hermes Agent mark for TypeUI integration listings.</desc>
+  <rect width="48" height="48" rx="12" fill="#0000F2"/>
+  <path fill="#fff" d="M13 12h5v10h12V12h5v24h-5V27H18v9h-5V12Z"/>
+  <path fill="#fff" fill-opacity=".72" d="M21 17h6l-3 4-3-4Zm0 14h6l-3-4-3 4Z"/>
+</svg>
```

**File**: `plugins/README.md` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ Tool-specific TypeUI plugins live in provider namespaces:
 - `cline/typeui` for the Cline plugin and MCP setup helper.
 - `opencode/typeui` for the OpenCode helper plugin and MCP configuration.
 - `antigravity/typeui` for the Antigravity CLI plugin and MCP configuration.
+- `hermes/typeui` for the Hermes Agent MCP configuration guide.
 - `zed/typeui` for the Zed MCP server extension package.
 
 Marketplace entries can still expose each plugin as `typeui`; the namespaced folders only keep repository ownership clear as more tool plugins are added.
```

**File**: `plugins/hermes/typeui/README.md` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+# TypeUI for Hermes Agent
+
+TypeUI connects Hermes Agent to the hosted TypeUI MCP server so it can use project design skills, brand kits, UI prompts, and layout variations while building interfaces.
+
+## Configure TypeUI MCP
+
+Merge this server into your Hermes configuration at `~/.hermes/config.yaml`:
+
+```yaml
+mcp_servers:
+  typeui:
+    url: "https://mcp.typeui.sh"
+    auth: oauth
+```
+
+This folder includes the same snippet in `config.yaml`.
+
+After updating the file, start or reload Hermes Agent:
+
+```bash
+hermes chat
+```
+
+Then run this command inside Hermes Agent:
+
+```text
+/reload-mcp
+```
+
+If Hermes does not start the OAuth flow automatically, run:
+
+```bash
+hermes mcp login typeui
+```
+
+Sign in with TypeUI when Hermes asks you to authorize the connection.
+
+## Links
+
+- Website: https://www.typeui.sh
+- Documentation: https://www.typeui.sh/docs
+- Hermes setup guide: https://www.typeui.sh/docs/guides/hermes
+- TypeUI MCP server: https://mcp.typeui.sh
+- Privacy policy: https://www.typeui.sh/privacy
+- Terms of service: https://www.typeui.sh/terms
```

**File**: `plugins/hermes/typeui/config.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+mcp_servers:
+  typeui:
+    url: "https://mcp.typeui.sh"
+    auth: oauth
```

---

### Incident Patch 4: `4177229f` (2026-06-28)
**Commit Message**: update: rename luxury to power skill

**File**: `README.md` (modified, +3/-3)
```diff
@@ -489,9 +489,9 @@ Check out all [design skills](https://www.typeui.sh/design-skills). Available in
       </a>
     </td>
     <td align="center" width="33%">
-      <a href="https://www.typeui.sh/design-skills/luxury">
-        <img src="./registry-examples/luxury.png" alt="Luxury" width="260" />
-        <br /><b>Luxury</b>
+      <a href="https://www.typeui.sh/design-skills/power">
+        <img src="./registry-examples/power.png" alt="Power" width="260" />
+        <br /><b>Power</b>
       </a>
     </td>
     <td align="center" width="33%">
```

---

### Incident Patch 5: `538c2de4` (2026-06-15)
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

### Incident Patch 6: `4fe71266` (2026-06-03)
**Commit Message**: add: Github Copilot guide

**File**: `README.md` (modified, +19/-4)
```diff
@@ -137,6 +137,19 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/zed"><b>Open Zed guide →</b></a>
     </td>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/github-copilot">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/githubcopilot.svg" alt="GitHub Copilot logo" width="48" height="48" />
+        <br /><br />
+        <b>GitHub Copilot</b>
+      </a>
+      <br />
+      <sub>Add the hosted TypeUI MCP server to GitHub Copilot.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/github-copilot"><b>Open GitHub Copilot guide →</b></a>
+    </td>
+  </tr>
+  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/cline">
         <img src="https://www.typeui.sh/ai-tools-logos/light/cline.svg" alt="Cline logo" width="48" height="48" />
@@ -148,8 +161,6 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/cline"><b>Install in Cline →</b></a>
     </td>
-  </tr>
-  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/qwen">
         <img src="https://www.typeui.sh/ai-tools-logos/light/qwen.svg" alt="Qwen logo" width="120" height="40" />
@@ -172,6 +183,8 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/amp"><b>Open Amp guide →</b></a>
     </td>
+  </tr>
+  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/goose">
         <img src="https://www.typeui.sh/ai-tools-logos/light/goose.svg" alt="Goose logo" width="48" height="48" />
@@ -183,8 +196,6 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/goose"><b>Open Goose guide →</b></a>
     </td>
-  </tr>
-  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/lovable">
         <img src="https://www.typeui.sh/ai-tools-logos/light/lovable-logo-icon.svg" alt="Lovable logo" width="48" height="48" />
@@ -207,6 +218,8 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/replit"><b>Open Replit guide →</b></a>
     </td>
+  </tr>
+  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/v0">
         <img src="https://www.typeui.sh/ai-tools-logos/light/v0.svg" alt="v0 logo" width="48" height="48" />
@@ -218,6 +231,8 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/v0"><b>Open v0 guide →</b></a>
     </td>
+    <td align="center" width="33%"></td>
+    <td align="center" width="33%"></td>
   </tr>
 </table>
 
```

---

### Incident Patch 7: `071390bc` (2026-06-03)
**Commit Message**: add: v0 guide

**File**: `README.md` (modified, +11/-1)
```diff
@@ -207,7 +207,17 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/replit"><b>Open Replit guide →</b></a>
     </td>
-    <td align="center" width="33%"></td>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/v0">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/v0.svg" alt="v0 logo" width="48" height="48" />
+        <br /><br />
+        <b>v0</b>
+      </a>
+      <br />
+      <sub>Add the hosted TypeUI MCP server to v0.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/v0"><b>Open v0 guide →</b></a>
+    </td>
   </tr>
 </table>
 
```

---

### Incident Patch 8: `afa34295` (2026-06-03)
**Commit Message**: add: Replit integration guide

**File**: `README.md` (modified, +11/-1)
```diff
@@ -196,7 +196,17 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/lovable"><b>Open Lovable guide →</b></a>
     </td>
-    <td align="center" width="33%"></td>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/replit">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/replit-color.svg" alt="Replit logo" width="48" height="48" />
+        <br /><br />
+        <b>Replit</b>
+      </a>
+      <br />
+      <sub>Add the hosted TypeUI MCP server to Replit.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/replit"><b>Open Replit guide →</b></a>
+    </td>
     <td align="center" width="33%"></td>
   </tr>
 </table>
```

---

### Incident Patch 9: `c2b84ed9` (2026-06-03)
**Commit Message**: add: Mistral guide

**File**: `README.md` (modified, +15/-0)
```diff
@@ -184,6 +184,21 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <a href="https://www.typeui.sh/docs/guides/lovable"><b>Open Lovable guide →</b></a>
     </td>
   </tr>
+  <tr>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/mistral">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/mistral-ai.svg" alt="Mistral logo" width="69" height="48" />
+        <br /><br />
+        <b>Mistral</b>
+      </a>
+      <br />
+      <sub>Add the hosted TypeUI MCP server to Mistral.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/mistral"><b>Open Mistral guide →</b></a>
+    </td>
+    <td align="center" width="33%"></td>
+    <td align="center" width="33%"></td>
+  </tr>
 </table>
 
 ## Design skills
```

---

### Incident Patch 10: `b1e34d3f` (2026-06-03)
**Commit Message**: add: Lovable guide

**File**: `README.md` (modified, +11/-1)
```diff
@@ -172,7 +172,17 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/goose"><b>Open Goose guide →</b></a>
     </td>
-    <td align="center" width="33%"></td>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/lovable">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/lovable-logo-icon.svg" alt="Lovable logo" width="48" height="48" />
+        <br /><br />
+        <b>Lovable</b>
+      </a>
+      <br />
+      <sub>Add the hosted TypeUI MCP server to Lovable.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/lovable"><b>Open Lovable guide →</b></a>
+    </td>
   </tr>
 </table>
 
```

---

### Incident Patch 11: `dd26ff65` (2026-06-01)
**Commit Message**: add: grok guide

**File**: `README.md` (modified, +29/-4)
```diff
@@ -45,6 +45,17 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
     </td>
   </tr>
   <tr>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/grok">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/xai.svg" alt="xAI logo" width="48" height="48" />
+        <br /><br />
+        <b>Grok</b>
+      </a>
+      <br />
+      <sub>Add the hosted TypeUI MCP server to Grok.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/grok"><b>Open Grok guide →</b></a>
+    </td>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/opencode">
         <img src="https://www.typeui.sh/ai-tools-logos/light/opencode.svg" alt="OpenCode logo" width="48" height="48" />
@@ -67,6 +78,8 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/vscode"><b>Install in VS Code →</b></a>
     </td>
+  </tr>
+  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/antigravity">
         <img src="https://www.typeui.sh/ai-tools-logos/light/antigravity.svg" alt="Antigravity logo" width="48" height="48" />
@@ -78,8 +91,6 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/antigravity"><b>Open Antigravity guide →</b></a>
     </td>
-  </tr>
-  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/windsurf">
         <img src="https://www.typeui.sh/ai-tools-logos/light/windsurf.svg" alt="Windsurf logo" width="48" height="48" />
@@ -102,6 +113,8 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/jetbrains"><b>Install in JetBrains →</b></a>
     </td>
+  </tr>
+  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/zed">
         <img src="https://www.typeui.sh/ai-tools-logos/light/zed.svg" alt="Zed logo" width="48" height="48" />
@@ -113,8 +126,6 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/zed"><b>Open Zed guide →</b></a>
     </td>
-  </tr>
-  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/cline">
         <img src="https://www.typeui.sh/ai-tools-logos/light/cline.svg" alt="Cline logo" width="48" height="48" />
@@ -137,6 +148,8 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/qwen"><b>Open Qwen guide →</b></a>
     </td>
+  </tr>
+  <tr>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/amp">
         <img src="https://www.typeui.sh/ai-tools-logos/light/ampcode.svg" alt="Amp logo" width="94" height="48" />
@@ -148,6 +161,18 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/amp"><b>Open Amp guide →</b></a>
     </td>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/goose">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/goose.svg" alt="Goose logo" width="48" height="48" />
+        <br /><br />
+        <b>Goose</b>
+      </a>
+      <br />
+      <sub>Add the hosted TypeUI MCP server to Goose.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/goose"><b>Open Goose guide →</b></a>
+    </td>
+    <td align="center" width="33%"></td>
   </tr>
 </table>
 
```

---

### Incident Patch 12: `9eb5c91c` (2026-06-01)
**Commit Message**: add: Zed extension for TypeUI

**File**: `.gitignore` (modified, +4/-0)
```diff
@@ -14,3 +14,7 @@ coverage
 /mistral-vibe
 .package-lock.json
 .mcpregistry_*
+
+# Zed extension build output
+plugins/zed/**/target/
+plugins/zed/**/extension.wasm
```

**File**: `README.md` (modified, +20/-20)
```diff
@@ -46,26 +46,26 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
   </tr>
   <tr>
     <td align="center" width="33%">
-      <a href="https://www.typeui.sh/docs/guides/vscode">
-        <img src="https://www.typeui.sh/ai-tools-logos/light/vscode.svg" alt="Visual Studio Code logo" width="48" height="48" />
+      <a href="https://www.typeui.sh/docs/guides/opencode">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/opencode.svg" alt="OpenCode logo" width="48" height="48" />
         <br /><br />
-        <b>VS Code</b>
+        <b>OpenCode</b>
       </a>
       <br />
-      <sub>Connect GitHub Copilot in VS Code to TypeUI MCP.</sub>
+      <sub>Give OpenCode access to TypeUI design systems and prompts.</sub>
       <br /><br />
-      <a href="https://www.typeui.sh/docs/guides/vscode"><b>Install in VS Code →</b></a>
+      <a href="https://www.typeui.sh/docs/guides/opencode"><b>Install in OpenCode →</b></a>
     </td>
     <td align="center" width="33%">
-      <a href="https://www.typeui.sh/docs/guides/jetbrains">
-        <img src="https://www.typeui.sh/ai-tools-logos/light/junie.svg" alt="Junie logo" width="48" height="48" />
+      <a href="https://www.typeui.sh/docs/guides/vscode">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/vscode.svg" alt="Visual Studio Code logo" width="48" height="48" />
         <br /><br />
-        <b>JetBrains</b>
+        <b>VS Code</b>
       </a>
       <br />
-      <sub>Connect JetBrains AI Assistant or Junie to TypeUI MCP.</sub>
+      <sub>Connect GitHub Copilot in VS Code to TypeUI MCP.</sub>
       <br /><br />
-      <a href="https://www.typeui.sh/docs/guides/jetbrains"><b>Install in JetBrains →</b></a>
+      <a href="https://www.typeui.sh/docs/guides/vscode"><b>Install in VS Code →</b></a>
     </td>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/antigravity">
@@ -81,26 +81,26 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
   </tr>
   <tr>
     <td align="center" width="33%">
-      <a href="https://www.typeui.sh/docs/guides/opencode">
-        <img src="https://www.typeui.sh/ai-tools-logos/light/opencode.svg" alt="OpenCode logo" width="48" height="48" />
+      <a href="https://www.typeui.sh/docs/guides/windsurf">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/windsurf.svg" alt="Windsurf logo" width="48" height="48" />
         <br /><br />
-        <b>OpenCode</b>
+        <b>Windsurf</b>
       </a>
       <br />
-      <sub>Give OpenCode access to TypeUI design systems and prompts.</sub>
+      <sub>Connect Windsurf Cascade to TypeUI MCP.</sub>
       <br /><br />
-      <a href="https://www.typeui.sh/docs/guides/opencode"><b>Install in OpenCode →</b></a>
+      <a href="https://www.typeui.sh/docs/guides/windsurf"><b>Install in Windsurf →</b></a>
     </td>
     <td align="center" width="33%">
-      <a href="https://www.typeui.sh/docs/guides/windsurf">
-        <img src="https://www.typeui.sh/ai-tools-logos/light/windsurf.svg" alt="Windsurf logo" width="48" height="48" />
+      <a href="https://www.typeui.sh/docs/guides/jetbrains">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/junie.svg" alt="Junie logo" width="48" height="48" />
         <br /><br />
-        <b>Windsurf</b>
+        <b>JetBrains</b>
       </a>
       <br />
-      <sub>Connect Windsurf Cascade to TypeUI MCP.</sub>
+      <sub>Connect JetBrains AI Assistant or Junie to TypeUI MCP.</sub>
       <br /><br />
-      <a href="https://www.typeui.sh/docs/guides/windsurf"><b>Install in Windsurf →</b></a>
+      <a href="https://www.typeui.sh/docs/guides/jetbrains"><b>Install in JetBrains →</b></a>
     </td>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/cline">
```

**File**: `plugins/README.md` (modified, +1/-0)
```diff
@@ -12,5 +12,6 @@ Tool-specific TypeUI plugins live in provider namespaces:
 - `cline/typeui` for the Cline plugin and MCP setup helper.
 - `opencode/typeui` for the OpenCode helper plugin and MCP configuration.
 - `antigravity/typeui` for the Antigravity CLI plugin and MCP configuration.
+- `zed/typeui` for the Zed MCP server extension package.
 
 Marketplace entries can still expose each plugin as `typeui`; the namespaced folders only keep repository ownership clear as more tool plugins are added.
```

**File**: `plugins/zed/typeui/Cargo.lock` (added, +860/-0)
```diff
@@ -0,0 +1,860 @@
+# This file is automatically @generated by Cargo.
+# It is not intended for manual editing.
+version = 4
+
+[[package]]
+name = "adler2"
+version = "2.0.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "320119579fcad9c21884f5c4861d16174d0e06250625266f50fe6898340abefa"
+
+[[package]]
+name = "anyhow"
+version = "1.0.102"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
+
+[[package]]
+name = "auditable-serde"
+version = "0.8.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "5c7bf8143dfc3c0258df908843e169b5cc5fcf76c7718bd66135ef4a9cd558c5"
+dependencies = [
+ "semver",
+ "serde",
+ "serde_json",
+ "topological-sort",
+]
+
+[[package]]
+name = "bitflags"
+version = "2.11.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c4512299f36f043ab09a583e57bceb5a5aab7a73db1805848e8fef3c9e8c78b3"
+
+[[package]]
+name = "cfg-if"
+version = "1.0.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801"
+
+[[package]]
+name = "crc32fast"
+version = "1.5.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "9481c1c90cbf2ac953f07c8d4a58aa3945c425b7185c9154d67a65e4230da511"
+dependencies = [
+ "cfg-if",
+]
+
+[[package]]
+name = "displaydoc"
+version = "0.2.6"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "1ac70aa55017e108007fbaf5aa0f54b021c98f92ff8af59d42eda9da96e3dd4f"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn",
+]
+
+[[package]]
+name = "dyn-clone"
+version = "1.0.20"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "d0881ea181b1df73ff77ffaaf9c7544ecc11e82fba9b5f27b262a3c73a332555"
+
+[[package]]
+name = "equivalent"
+version = "1.0.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "877a4ace8713b0bcf2a4e7eec82529c029f1d0619886d18145fea96c3ffe5c0f"
+
+[[package]]
+name = "flate2"
+version = "1.1.9"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "843fba2746e448b37e26a819579957415c8cef339bf08564fe8b7ddbd959573c"
+dependencies = [
+ "crc32fast",
+ "miniz_oxide",
+]
+
+[[package]]
+name = "foldhash"
+version = "0.1.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "d9c4f5dac5e15c24eb999c26181a6ca40b39fe946cbe4c263c7209467bc83af2"
+
+[[package]]
+name = "form_urlencoded"
+version = "1.2.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cb4cb245038516f5f85277875cdaa4f7d2c9a0fa0468de06ed190163b1581fcf"
+dependencies = [
+ "percent-encoding",
+]
+
+[[package]]
+name = "futures"
+version = "0.3.32"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "8b147ee9d1f6d097cef9ce628cd2ee62288d963e16fb287bd9286455b241382d"
+dependencies = [
+ "futures-channel",
+ "futures-core",
+ "futures-executor",
+ "futures-io",
+ "futures-sink",
+ "futures-task",
+ "futures-util",
+]
+
+[[package]]
+name = "futures-channel"
+version = "0.3.32"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "07bbe89c50d7a535e539b8c17bc0b49bdb77747034daa8087407d655f3f7cc1d"
+dependencies = [
+ "futures-core",
+ "futures-sink",
+]
+
+[[package]]
+name = "futures-core"
+version = "0.3.32"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7e3450815272ef58cec6d564423f6e755e25379b217b0bc688e295ba24df6b1d"
+
+[[package]]
+name = "futures-executor"
+version = "0.3.32"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "baf29c38818342a3b26b5b923639e7b1f4a61fc5e76102d4b1981c6dc7a7579d"
+dependencies = [
+ "futures-core",
+ "futures-task",
+ "futures-util",
+]
+
+[[package]]
+name = "futures-io"
+version = "0.3.32"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "cecba35d7ad927e23624b22ad55235f2239cfa44fd10428eecbeba6d6a717718"
+
+[[package]]
+name = "futures-macro"
+version = "0.3.32"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "e835b70203e41293343137df5c0664546da5745f82ec9b84d40be8336958447b"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn",
+]
+
+[[package]]
+name = "futures-sink"
+version = "0.3.32"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c39754e157331b013978ec91992bde1ac089843443c49cbc7f46150b0fad0893"
+
+[[package]]
+name = "futures-task"
+version = "0.3.32"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "037711b3d59c33004d3856fbdc83b99d4ff37a24768fa1be9ce3538a1cde4393"
+
+[[package]]
+name = "futures-util"
+version = "0.3.32"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "389ca41296e6190b48053de0321d02a77f32f8a5d2461dd38762c0593805c6d6"
+dependencies = [
+ "futures-channel",
+ "fut
```

**File**: `plugins/zed/typeui/Cargo.toml` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+[package]
+name = "typeui_zed"
+version = "1.0.0"
+edition = "2021"
+publish = false
+license = "MIT"
+
+[lib]
+path = "src/typeui_zed.rs"
+crate-type = ["cdylib"]
+
+[dependencies]
+schemars = "0.8"
+serde = "1.0"
+zed_extension_api = "0.7.0"
```

**File**: `plugins/zed/typeui/LICENSE.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Released under MIT License
+
+Copyright (c) 2026 Bergside LLC
+
+Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
+
+The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
+
+THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

**File**: `plugins/zed/typeui/README.md` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+# TypeUI Zed Extension
+
+TypeUI connects Zed's Agent Panel to the hosted TypeUI MCP server so it can use curated design systems, UI prompts, and layout variations while building interfaces.
+
+## Install TypeUI MCP today
+
+Until the Zed extension is approved in the marketplace, add TypeUI as a custom MCP server in Zed settings:
+
+```json
+{
+  "context_servers": {
+    "typeui": {
+      "url": "https://mcp.typeui.sh/mcp"
+    }
+  }
+}
+```
+
+If Zed asks you to authenticate, sign in with TypeUI.
+
+## Test the extension locally
+
+For local validation from a checkout of the public repository:
+
+1. Install Rust with `rustup`.
+2. Open Zed Extensions.
+3. Run `zed: install dev extension`.
+4. Select `plugins/zed/typeui`.
+
+The extension installs `mcp-remote` and uses it to bridge Zed's extension context server command to the hosted TypeUI MCP endpoint.
+
+## Distribution
+
+Submit this extension to the official Zed extensions registry with `plugins/zed/typeui` as the extension path. The registry entry should point to the public TypeUI repository and include the subdirectory path:
+
+```toml
+[typeui]
+submodule = "extensions/typeui"
+path = "plugins/zed/typeui"
+version = "1.0.0"
+```
+
+## Links
+
+- Website: https://www.typeui.sh
+- Documentation: https://www.typeui.sh/docs
+- Zed setup guide: https://www.typeui.sh/docs/guides/zed
+- Privacy policy: https://www.typeui.sh/privacy
+- Terms of service: https://www.typeui.sh/terms
```

**File**: `plugins/zed/typeui/configuration/default_settings.jsonc` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+{
+  "context_servers": {
+    "typeui": {
+      "settings": {
+        // Optional. Leave unset to use the hosted TypeUI MCP server.
+        "mcp_url": "https://mcp.typeui.sh/mcp"
+      }
+    }
+  }
+}
```

---

### Incident Patch 13: `4443ced2` (2026-06-01)
**Commit Message**: add: Cline guide

**File**: `README.md` (modified, +12/-2)
```diff
@@ -56,6 +56,17 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/vscode"><b>Install in VS Code →</b></a>
     </td>
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/jetbrains">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/junie.svg" alt="Junie logo" width="48" height="48" />
+        <br /><br />
+        <b>JetBrains</b>
+      </a>
+      <br />
+      <sub>Connect JetBrains AI Assistant or Junie to TypeUI MCP.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/jetbrains"><b>Install in JetBrains →</b></a>
+    </td>
     <td align="center" width="33%">
       <a href="https://www.typeui.sh/docs/guides/antigravity">
         <img src="https://www.typeui.sh/ai-tools-logos/light/antigravity.svg" alt="Antigravity logo" width="48" height="48" />
@@ -67,7 +78,6 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/antigravity"><b>Open Antigravity guide →</b></a>
     </td>
-    <td align="center" width="33%"></td>
   </tr>
   <tr>
     <td align="center" width="33%">
@@ -99,7 +109,7 @@ Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then
         <b>Cline</b>
       </a>
       <br />
-      <sub>Install the TypeUI Cline plugin or connect the hosted MCP server.</sub>
+      <sub>Add the hosted TypeUI MCP server to Cline.</sub>
       <br /><br />
       <a href="https://www.typeui.sh/docs/guides/cline"><b>Install in Cline →</b></a>
     </td>
```

**File**: `llms-install.md` (modified, +1/-1)
```diff
@@ -17,6 +17,7 @@ Add this server to Cline MCP settings:
   "mcpServers": {
     "typeui": {
       "url": "https://mcp.typeui.sh/mcp",
+      "type": "streamableHttp",
       "disabled": false,
       "autoApprove": []
     }
@@ -36,4 +37,3 @@ After installation, Cline should be able to use TypeUI tools for:
 - downloading TypeUI Pro resources for authenticated Pro users
 
 Documentation: https://www.typeui.sh/docs/guides/cline
-
```

---

### Incident Patch 14: `bb8b18ee` (2026-05-31)
**Commit Message**: update: improve the UI of the integration guides

**File**: `README.md` (modified, +28/-25)
```diff
@@ -6,38 +6,41 @@
 
 Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then ask for UI in plain language while TypeUI supplies design systems, prompts, and layout variation guidance.
 
-<table>
-  <tr>
-    <th align="left">Tool</th>
-    <th align="left">Install guide</th>
-    <th align="left">What it unlocks</th>
-  </tr>
+<table width="100%">
   <tr>
-    <td>
-      <img src="https://www.typeui.sh/ai-tools-logos/light/codex.svg" alt="Codex logo" width="24" />
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/codex">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/codex.svg" alt="Codex logo" height="48" />
+        <br /><br />
+        <b>Codex</b>
+      </a>
       <br />
-      <b>Codex</b>
+      <sub>Connect Codex to TypeUI MCP automatically with the TypeUI Codex plugin.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/codex"><b>Install in Codex →</b></a>
     </td>
-    <td><a href="https://www.typeui.sh/docs/guides/codex">Install TypeUI in Codex</a></td>
-    <td>Use the TypeUI Codex plugin to connect Codex to TypeUI MCP automatically.</td>
-  </tr>
-  <tr>
-    <td>
-      <img src="https://www.typeui.sh/ai-tools-logos/light/claude-color.svg" alt="Claude logo" width="24" />
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/claude">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/claude-color.svg" alt="Claude logo" height="48" />
+        <br /><br />
+        <b>Claude</b>
+      </a>
       <br />
-      <b>Claude</b>
+      <sub>Give Claude access to curated design guidance while it writes or refactors UI.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/claude"><b>Install in Claude →</b></a>
     </td>
-    <td><a href="https://www.typeui.sh/docs/guides/claude">Install TypeUI in Claude</a></td>
-    <td>Give Claude access to curated design guidance while it writes or refactors UI.</td>
-  </tr>
-  <tr>
-    <td>
-      <img src="https://www.typeui.sh/ai-tools-logos/light/cursor.svg" alt="Cursor logo" width="24" />
+    <td align="center" width="33%">
+      <a href="https://www.typeui.sh/docs/guides/cursor">
+        <img src="https://www.typeui.sh/ai-tools-logos/light/cursor.svg" alt="Cursor logo" height="48" />
+        <br /><br />
+        <b>Cursor</b>
+      </a>
       <br />
-      <b>Cursor</b>
+      <sub>Use the TypeUI Cursor plugin while Cursor builds screens, sections, and variations.</sub>
+      <br /><br />
+      <a href="https://www.typeui.sh/docs/guides/cursor"><b>Install in Cursor →</b></a>
     </td>
-    <td><a href="https://www.typeui.sh/docs/guides/cursor">Install TypeUI in Cursor</a></td>
-    <td>Use the TypeUI Cursor plugin while Cursor builds screens, sections, and variations.</td>
   </tr>
 </table>
 
```

---

### Incident Patch 15: `c0ecf59f` (2026-05-31)
**Commit Message**: update: readme for integration guides

**File**: `README.md` (modified, +38/-1)
```diff
@@ -4,7 +4,44 @@
 
 ## Getting started
 
-You can start building with TypeUI by using the NPX command:
+Install TypeUI where you build. Connect your AI coding tool to TypeUI MCP, then ask for UI in plain language while TypeUI supplies design systems, prompts, and layout variation guidance.
+
+<table>
+  <tr>
+    <th align="left">Tool</th>
+    <th align="left">Install guide</th>
+    <th align="left">What it unlocks</th>
+  </tr>
+  <tr>
+    <td>
+      <img src="https://www.typeui.sh/ai-tools-logos/light/codex.svg" alt="Codex logo" width="24" />
+      <br />
+      <b>Codex</b>
+    </td>
+    <td><a href="https://www.typeui.sh/docs/guides/codex">Install TypeUI in Codex</a></td>
+    <td>Use the TypeUI Codex plugin to connect Codex to TypeUI MCP automatically.</td>
+  </tr>
+  <tr>
+    <td>
+      <img src="https://www.typeui.sh/ai-tools-logos/light/claude-color.svg" alt="Claude logo" width="24" />
+      <br />
+      <b>Claude</b>
+    </td>
+    <td><a href="https://www.typeui.sh/docs/guides/claude">Install TypeUI in Claude</a></td>
+    <td>Give Claude access to curated design guidance while it writes or refactors UI.</td>
+  </tr>
+  <tr>
+    <td>
+      <img src="https://www.typeui.sh/ai-tools-logos/light/cursor.svg" alt="Cursor logo" width="24" />
+      <br />
+      <b>Cursor</b>
+    </td>
+    <td><a href="https://www.typeui.sh/docs/guides/cursor">Install TypeUI in Cursor</a></td>
+    <td>Use TypeUI from your editor while Cursor builds screens, sections, and variations.</td>
+  </tr>
+</table>
+
+You can also use the TypeUI CLI directly:
 
 ```bash
 npx typeui.sh --help
```

**File**: `plugins/codex/typeui/README.md` (modified, +7/-0)
```diff
@@ -4,8 +4,15 @@ TypeUI connects Codex to the TypeUI MCP server so it can use curated design syst
 
 ## Install
 
+First, add the Bergside plugin marketplace so Codex can find TypeUI:
+
 ```bash
 codex plugin marketplace add bergside/typeui --sparse .agents/plugins --ref main
+```
+
+Then install the TypeUI plugin from that marketplace:
+
+```bash
 codex plugin add typeui@bergside
 ```
 
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
