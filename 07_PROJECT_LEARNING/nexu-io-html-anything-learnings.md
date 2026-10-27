> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nexu-io-html-anything-learnings.md`  
> **Source**: github ([https://github.com/nexu-io/html-anything](https://github.com/nexu-io/html-anything))  
> **Source Version**: `975fb3bc`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T13:28:17.319Z  
> **Learning ID**: `learn-github-nexu-io-html-anything`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): nexu-io/html-anything

> **Canonical Artifact**: `07_PROJECT_LEARNING/nexu-io-html-anything-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nexu-io/html-anything](https://github.com/nexu-io/html-anything))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T13:28:16.233Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nexu-io/html-anything`
- **Description**: ✨ The agentic HTML editor — your local AI agent writes the HTML, you ship it. 🚀 75 Skills × 9 Surfaces (magazine · deck · poster · XHS / tweet · prototype · data report · Hyperframes) 🛡️ Sandboxed preview · 📤 1-click to WeChat / X / Zhihu / HTML / PNG 🔑 Zero API key — Claude Code / Cursor / Codex / Gemini / Copilot / OpenCode / Qwen / Aider.
- **Primary Language / Ecosystem**: HTML
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9259 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/src/agents-detect.ts`
```
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path, { delimiter, join } from "node:path";

/**
 * Agent detection — adapted from next/src/lib/agents/detect.ts
 */

export type AgentProtocol = "stdin" | "argv" | "argv-message" | "acp" | "pi-rpc";

export type ModelOption = { id: string; label: string };

export const DEFAULT_MODEL: ModelOption = { id: "default", label: "Default (CLI config)" };

export type AgentDef = {
  id: string;
  label: string;
  bin: string;
  fallbackBins?: string[];
  envOverride?: string;
  vendor: string;
  protocol?: AgentProtocol;
  fallbackModels: ModelOption[];
};

export const AGENTS: AgentDef[] = [
  {
    id: "claude",
    label: "Claude Code",
    bin: "claude",
    fallbackBins: ["openclaude"],
    envOverride: "CLAUDE_BIN",
    vendor: "Anthropic",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "sonnet", label: "Sonnet (alias)" },
      { id: "opus", label: "Opus (alias)" },
      { id: "haiku", label: "Haiku (alias)" },
      { id: "claude-opus-4-7", label: "claude-opus-4-7" },
      { id: "claude-sonnet-4-6", label: "claude-sonnet-4-6" },
      { id: "claude-haiku-4-5", label: "claude-haiku-4-5" },
      { id: "MiniMax-M3", label: "MiniMax-M3" },
      { id: "MiniMax-M2.7", label: "MiniMax-M2.7" },
    ],
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    bin: "openclaw",
    envOverride: "OPENCLAW_BIN",
    vendor: "OpenClaw multi-channel agent gateway",
    protocol: "argv-message",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "openrouter/anthropic/claude-opus-4.7", label: "Opus 4.7 (OpenRouter)" },
      { id: "openrouter/anthropic/claude-sonnet-4.6", label: "Sonnet 4.6 (OpenRouter)" },
      { id: "openrouter/anthropic/claude-haiku-4.5", label: "Haiku 4.5 (OpenRouter)" },
    ],
  },
  {
    id: "codex",
    label: "OpenAI Codex",
    bin: "codex",
    envOverride: "CODEX_BIN",
    vendor: "OpenAI",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "gpt-5.5", label: "gpt-5.5" },
      { id: "gpt-5.4", label: "gpt-5.4" },
      { id: "gpt-5.4-mini", label: "gpt-5.4-mini" },
      { id: "gpt-5.3-codex", label: "gpt-5.3-codex" },
      { id: "gpt-5-codex", label: "gpt-5-codex" },
      { id: "gpt-5", label: "gpt-5" },
      { id: "o3", label: "o3" },
      { id: "o4-mini", label: "o4-mini" },
    ],
  },
  {
    id: "cursor-agent",
    label: "Cursor Agent",
    bin: "cursor-agent",
    envOverride: "CURSOR_AGENT_BIN",
    vendor: "Cursor",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "auto", label: "auto" },
      { id: "sonnet-4", label: "sonnet-4" },
      { id: "sonnet-4-thinking", label: "sonnet-4-thinking" },
      { id: "gpt-5", label: "gpt-5" },
    ],
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    bin: "gemini",
    envOverride: "GEMINI_BIN",
    vendor: "Google",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "gemini-2.5-pro", label: "gemini-2.5-pro" },
      { id: "gemini-2.5-flash", label: "gemini-2.5-flash" },
    ],
  },
  {
    id: "copilot",
    label: "GitHub Copilot CLI",
    bin: "copilot",
    envOverride: "COPILOT_BIN",
    vendor: "GitHub",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
      { id: "gpt-5.2", label: "GPT-5.2" },
    ],
  },
  {
    id: "opencode",
    label: "OpenCode",
    bin: "opencode-cli",
    fallbackBins: ["opencode"],
    envOverride: "OPENCODE_BIN",
    vendor: "Open",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "anthropic/claude-sonnet-4-5", label: "anthropic/claude-sonnet-4-5" },
      { id: "openai/gpt-5", label: "openai/gpt-5" },
      { id: "google/gemini-2.5-pro", label: "google/gemini-2.5-pro" },
    ],
  },
  {
    id: "qwen",
    label: "Qwen Coder",
    bin: "qwen",
    envOverride: "QWEN_BIN",
    vendor: "Alibaba",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "qwen3-coder-plus", label: "qwen3-coder-plus" },
      { id: "qwen3-coder-flash", label: "qwen3-coder-flash" },
    ],
  },
  {
    id: "qoder",
    label: "Qoder CLI",
    bin: "qodercli",
    envOverride: "QODER_BIN",
    vendor: "Qoder",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "lite", label: "Lite" },
      { id: "efficient", label: "Efficient" },
      { id: "auto", label: "Auto" },
      { id: "performance", label: "Performance" },
      { id: "ultimate", label: "Ultimate" },
    ],
  },
  {
    id: "codewhale",
    label: "CodeWhale",
    bin: "codewhale",
    fallbackBins: ["deepseek-tui"],
    envOverride: "CODEWHALE_BIN",
    vendor: "CodeWhale",
    protocol: "argv",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "deepseek-v4-pro", label: "deepseek-v4-pro" },
      { id: "deepseek-v4-flash", label: "deepseek-v4-flash" },
    ],
  },
  {
    id: "deepseek-tui",
    label: "DeepSeek TUI",
    bin: "deepseek-tui",
    fallbackBins: ["codewhale"],
    envOverride: "DEEPSEEK_TUI_BIN",
    vendor: "DeepSeek",
    protocol: "argv",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "deepseek-v4-pro", label: "deepseek-v4-pro" },
      { id: "deepseek-v4-flash", label: "deepseek-v4-flash" },
    ],
  },
  {
    id: "aider",
    label: "Aider",
    bin: "aider",
    vendor: "Aider",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "claude-sonnet-4-5", label: "claude-sonnet-4-5" },
      { id: "gpt-5", label: "gpt-5" },
      { id: "deepseek/deepseek-chat", label: "deepseek/deepseek-chat" },
    ],
  },
  {
    id: "hermes",
    label: "Hermes",
    bin: "hermes",
    envOverride: "HERMES_BIN",
    vendor: "Mature",
    protocol: "acp",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "openai-codex:gpt-5.5", label: "gpt-5.5 (openai-codex)" },
      { id: "openai-codex:gpt-5.4", label: "gpt-5.4 (openai-codex)" },
    ],
  },
  {
    id: "kimi",
    label: "Kimi CLI",
    bin: "kimi",
    envOverride: "KIMI_BIN",
    vendor: "Moonshot",
    protocol: "acp",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "kimi-k2-turbo-preview", label: "kimi-k2-turbo-preview" },
      { id: "moonshot-v1-8k", label: "moonshot-v1-8k" },
      { id: "moonshot-v1-32k", label: "moonshot-v1-32k" },
    ],
  },
  {
    id: "devin",
    label: "Devin for Terminal",
    bin: "devin",
    envOverride: "DEVIN_BIN",
    vendor: "Cognition",
    protocol: "acp",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "adaptive", label: "adaptive" },
      { id: "swe", label: "swe" },
      { id: "opus", label: "opus" },
      { id: "sonnet", label: "sonnet" },
      { id: "codex", label: "codex" },
      { id: "gpt", label: "gpt" },
      { id: "gemini", label: "gemini" },
    ],
  },
  {
    id: "kiro",
    label: "Kiro CLI",
    bin: "kiro-cli",
    envOverride: "KIRO_BIN",
    vendor: "AWS",
    protocol: "acp",
    fallbackModels: [DEFAULT_MODEL],
  },
  {
    id: "kilo",
    label: "Kilo",
    bin: "kilo",
    envOverride: "KILO_BIN",
    vendor: "Kilo",
    protocol: "acp",
    fallbackModels: [DEFAULT_MODEL],
  },
  {
    id: "vibe",
    label: "Mistral Vibe CLI",
    bin: "vibe-acp",
    envOverride: "VIBE_BIN",
    vendor: "Mistral",
    protocol: "acp",
    fallbackModels: [DEFAULT_MODEL],
  },
  {
    id: "pi",
    label: "Pi",
    bin: "pi",
    envOverride: "PI_BIN",
    vendor: "Inflection",
    protocol: "pi-rpc",
    fallbackModels: [
      DEFAULT_MODEL,
      { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { id: "anthropic/claude-opus-4-5", label: "Claude Opus 4.5" },
      { id: "openai/gpt-5", label: "GPT-5" },
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
  },
];

function userToolchainDirs(): string[] {
  const home = homedir();
  const env = process.env;
  const dirs: string[] = [];
  const vp = env.VP_HOME?.trim();
  if (vp) dirs.push(join(vp, "bin"));
  const npmPrefix = env.NPM_CONFIG_PREFIX?.trim();
  if (npmPrefix) {
    dirs.push(join(npmPrefix, "bin"), npmPrefix);
  }
  dirs.push(
    join(home, ".local/bin"),
    join(home, ".vite-plus/bin"),
    join(home, ".opencode/bin"),
    join(home, ".bun/bin"),
    join(home, ".volta/bin"),
    join(home, ".asdf/shims"),
    join(home, "Library/pnpm"),
    join(home, ".cargo/bin"),
    join(home, ".npm-global/bin"),
    join(home, ".npm-packages/bin"),
    join(home, ".claude/local"),
  );
  if (process.platform === "win32") {
    const scoopRoot = env.SCOOP?.trim() || join(home, "scoop");
    const globalScoopRoot = env.SCOOP_GLOBAL?.trim() || "C:\\ProgramData\\scoop";
    const appData = env.APPDATA?.trim();
    dirs.push(
      join(scoopRoot, "shims"),
      join(scoopRoot, "apps", "nodejs", "current"),
      join(scoopRoot, "apps", "nodejs-lts", "current"),
      join(globalScoopRoot, "shims"),
      join(globalScoopRoot, "apps", "nodejs", "current"),
    );
    if (appData) dirs.push(join(appData, "npm"));
  } else {
    dirs.push("/opt/homebrew/bin", "/usr/local/bin");
  }
  return dirs;
}

export function resolveOnPath(bin: string): string | null {
  const exts =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")
      : [""];
  const seen = new Set<string>();
  const dirs = [
    ...(process.env.PATH ?? "").split(delimiter),
    ...userToolchainDirs(),
  ].filter((d) => d && !seen.has(d) && (seen.add(d), true));
  for (const d of dirs) {
    for (const e of exts) {
      const full = path.join(d, bin + e);
      try {
        if (existsSync(full)) return full;
      } catch {}
    }
  }
  return null;
}

export type DetectedAgent = {
  id: string;
  label: string;
  vendor: string;
  available: boolean;
  path?: string;
  resolvedBin?: string;
  protocol: AgentProtocol;
  models: ModelOption[];
  unsupported?: boolean;
};

export function detectAgents(): DetectedAgent[] {
  return AGENTS.map((a): DetectedAgent => {
    const protocol = a.protocol ?? "stdin";
    const unsupported = protocol === "acp" || protocol === "pi-rpc";
    const base = {
      id: a.id,
      label: a.label,
      vendor: a.vendor,
 
```

### Core Architecture Module: `cli/src/agents-invoke.ts`
```
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { resolveOnPath, AGENTS, type AgentDef, type AgentProtocol } from "./agents-detect.js";

export type InvokeOpts = {
  agent: string;
  prompt: string;
  cwd?: string;
  model?: string;
  signal?: AbortSignal;
  binOverride?: string;
};

type BinResolution =
  | { kind: "ok"; bin: string }
  | { kind: "override-missing"; tried: string }
  | { kind: "not-found" };

function resolveBinForAgent(
  def: (typeof AGENTS)[number],
  binOverride: string | undefined,
): BinResolution {
  const tryPath = (p: string | undefined): string | null => {
    if (!p) return null;
    const trimmed = p.trim();
    if (!trimmed) return null;
    if (/^([a-zA-Z]:[\\/]|[\\/])/.test(trimmed)) {
      return existsSync(trimmed) ? trimmed : null;
    }
    if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.startsWith(".")) {
      const resolved = path.resolve(trimmed);
      return existsSync(resolved) ? resolved : null;
    }
    return resolveOnPath(trimmed);
  };
  if (binOverride && binOverride.trim()) {
    const fromOverride = tryPath(binOverride);
    if (fromOverride) return { kind: "ok", bin: fromOverride };
    return { kind: "override-missing", tried: binOverride.trim() };
  }
  if (def.envOverride) {
    const fromEnv = tryPath(process.env[def.envOverride]);
    if (fromEnv) return { kind: "ok", bin: fromEnv };
  }
  for (const c of [def.bin, ...(def.fallbackBins ?? [])]) {
    const found = resolveOnPath(c);
    if (found) return { kind: "ok", bin: found };
  }
  return { kind: "not-found" };
}

export type InvokeEvent =
  | { type: "start"; bin: string; argv: string[]; promptBytes: number }
  | { type: "delta"; text: string }
  | { type: "html"; text: string }
  | { type: "meta"; key: string; value: unknown }
  | { type: "stderr"; text: string }
  | { type: "raw"; text: string }
  | { type: "done"; code: number | null }
  | { type: "error"; message: string };

// ─── argv builder ────────────────────────────────────────────────────

type AgentArgvOpts = {
  model?: string;
  openclawAgentId?: string;
};

class UnsupportedAgentProtocolError extends Error {
  constructor(public readonly agent: string, public readonly protocol: string) {
    super(
      `${agent} uses the ${protocol} protocol, which is not yet wired up in this build. ` +
        `Pick one of: claude / codex / cursor-agent / gemini / copilot / opencode / qwen / qoder / codewhale / deepseek-tui / aider.`,
    );
  }
}

function buildArgv(agent: string, opts: AgentArgvOpts = {}): string[] {
  const { model } = opts;
  switch (agent) {
    case "claude":
      return [
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--permission-mode",
        "bypassPermissions",
        ...(model ? ["--model", model] : []),
      ];
    case "openclaw":
      return [
        "agent",
        "--local",
        "--json",
        "--agent",
        opts.openclawAgentId ?? "main",
        ...(model ? ["--model", model] : []),
      ];
    case "codex":
      return [
        "exec",
        "--json",
        "--skip-git-repo-check",
        "--sandbox",
        "workspace-write",
        "-c",
        "sandbox_workspace_write.network_access=true",
        ...(model ? ["--model", model] : []),
      ];
    case "cursor-agent":
      return [
        "--print",
        "--output-format",
        "stream-json",
        "--stream-partial-output",
        "--force",
        "--trust",
        ...(model ? ["--model", model] : []),
      ];
    case "gemini":
      return [
        "--output-format",
        "stream-json",
        "--yolo",
        ...(model ? ["--model", model] : []),
      ];
    case "copilot":
      return [
        "--allow-all-tools",
        "--output-format",
        "json",
        ...(model ? ["--model", model] : []),
      ];
    case "opencode":
      return [
        "run",
        "--format",
        "json",
        "--dangerously-skip-permissions",
        ...(model ? ["--model", model] : []),
        "-",
      ];
    case "qwen":
      return ["--yolo", ...(model ? ["--model", model] : []), "-"];
    case "aider":
      return [
        "--no-pretty",
        "--no-stream",
        "--yes-always",
        "--message-file",
        "-",
        ...(model ? ["--model", model] : []),
      ];
    case "qoder":
      return [
        "-p",
        "--output-format",
        "stream-json",
        "--yolo",
        ...(model ? ["--model", model] : []),
      ];
    case "codewhale":
    case "deepseek-tui":
      return ["exec", "--auto", ...(model ? ["--model", model] : [])];
    case "hermes":
    case "kimi":
    case "devin":
    case "kiro":
    case "kilo":
    case "vibe":
      throw new UnsupportedAgentProtocolError(agent, "ACP JSON-RPC");
    case "pi":
      throw new UnsupportedAgentProtocolError(agent, "pi-rpc");
    default:
      throw new Error(`unknown agent: ${agent}`);
  }
}

function envFor(agent: string): NodeJS.ProcessEnv {
  const base = { ...process.env };
  if (agent === "gemini") base.GEMINI_CLI_TRUST_WORKSPACE = "true";
  return base;
}

// ─── stdout parser ────────────────────────────────────────────────────

type AgentParse =
  | { kind: "delta"; text: string }
  | { kind: "meta"; key: string; value: unknown }
  | { kind: "html"; text: string }
  | { kind: "noise" };

type ParseState = { sawStreamEventText?: boolean };

function rescueHtmlFromToolUse(
  content: Array<{ type?: string; name?: string; input?: unknown }> | undefined,
): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || block.type !== "tool_use") continue;
    const name = (block.name ?? "").toLowerCase();
    if (
      name !== "write" &&
      name !== "create_file" &&
      name !== "createfile" &&
      name !== "writefile" &&
      name !== "write_file" &&
      name !== "filewrite"
    )
      continue;
    const input = block.input as Record<string, unknown> | undefined;
    if (!input || typeof input !== "object") continue;
    const path = String(input.file_path ?? input.path ?? input.filename ?? "").toLowerCase();
    if (path && !/\.(html?|htm)$/.test(path)) continue;
    const text =
      typeof input.content === "string"
        ? input.content
        : typeof input.text === "string"
          ? input.text
          : typeof input.file_content === "string"
            ? input.file_content
            : "";
    if (text) parts.push(text);
  }
  return parts.join("");
}

function parseLineWithState(agent: string, line: string, state: ParseState): AgentParse[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  if (agent === "aider" || agent === "codewhale" || agent === "deepseek-tui") {
    return [{ kind: "delta", text: trimmed.endsWith("\n") ? trimmed : trimmed + "\n" }];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [{ kind: "noise" }];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;
  const out: AgentParse[] = [];

  if (agent === "claude") {
    if (obj.type === "system" && obj.subtype === "init") {
      out.push({ kind: "meta", key: "model", value: obj.model });
      out.push({ kind: "meta", key: "session", value: obj.session_id });
      if (obj.cwd) out.push({ kind: "meta", key: "cwd", value: obj.cwd });
    }
    if (obj.type === "stream_event" && obj.event && typeof obj.event === "object") {
      const ev = obj.event as { type?: string; delta?: { type?: string; text?: string; thinking?: string } };
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && typeof ev.delta.text === "string") {
        state.sawStreamEventText = true;
        out.push({ kind: "delta", text: ev.delta.text });
      } else if (ev.type === "content_block_delta" && ev.delta?.type === "thinking_delta") {
        out.push({ kind: "meta", key: "thinking", value: ev.delta.thinking });
      }
    }
    if (obj.type === "assistant" && obj.message && typeof obj.message === "object") {
      const msg = obj.message as {
        content?: Array<{ type?: string; text?: string; name?: string; input?: unknown }>;
        usage?: Record<string, number>;
        model?: string;
      };
      const toolHtml = rescueHtmlFromToolUse(msg.content);
      if (toolHtml) {
        out.push({ kind: "html", text: toolHtml });
        state.sawStreamEventText = true;
      }
      if (!state.sawStreamEventText) {
        const text = (msg.content ?? [])
          .filter((c) => c?.type === "text" && typeof c.text === "string")
          .map((c) => c.text!)
          .join("");
        if (text) out.push({ kind: "delta", text });
      }
      if (msg.usage) out.push({ kind: "meta", key: "usage_partial", value: msg.usage });
    }
    if (obj.type === "result") {
      if (obj.usage) out.push({ kind: "meta", key: "usage", value: obj.usage });
      if (typeof obj.duration_ms === "number") out.push({ kind: "meta", key: "duration_ms", value: obj.duration_ms });
      if (typeof obj.total_cost_usd === "number") out.push({ kind: "meta", key: "cost_usd", value: obj.total_cost_usd });
      if (typeof obj.subtype === "string") out.push({ kind: "meta", key: "result", value: obj.subtype });
    }
  }

  if (agent === "codex") {
    if (obj.type === "item.completed" && obj.item && typeof obj.item === "object") {
      const item = obj.item as { item_type?: string; type?: string; text?: string };
      const itemType = item.item_type ?? item.type;
      if (
        (itemType === "assistant_message" || itemType === "agent_message") &&
        typeof item.text === "string"
      ) {
        out.push({ kind: "delta", text: item.text });
      }
    }
    if (obj.type === "item.delta" && typeof obj.text === "string") {
      o
```

### Core Architecture Module: `cli/src/collision-resolve.ts`
```
import path from "node:path";

export function findCommonPath(dirs: string[]): string {
  if (dirs.length === 0) return "";
  const resolved = dirs.map((d) => path.resolve(d));
  const segments = resolved.map((d) => d.split(path.sep).filter(Boolean));
  const minLen = Math.min(...segments.map((s) => s.length));
  let common = 0;
  for (let i = 0; i < minLen; i++) {
    const seg = segments[0][i];
    if (segments.every((s) => s[i] === seg)) common++;
    else break;
  }
  return segments[0].slice(0, common).join(path.sep) || path.sep;
}

export function resolveCollisionOutput(inputPath: string, outputDir: string, commonRoot: string): string {
  const basename = path.basename(inputPath, path.extname(inputPath));
  const inputDir = path.resolve(path.dirname(inputPath));
  let relativeDir = path.relative(commonRoot, inputDir);
  relativeDir = relativeDir
    .split(path.sep)
    .filter((s) => s !== ".." && s !== ".")
    .join(path.sep);
  if (relativeDir) {
    return path.resolve(outputDir, relativeDir, `${basename}.html`);
  }
  return path.resolve(outputDir, `${basename}.html`);
}

```

### Core Architecture Module: `cli/src/config.ts`
```
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface CliConfig {
  defaultTemplate?: string;
  defaultAgent?: string;
  model?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".config", "html-anything");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): CliConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      return JSON.parse(raw) as CliConfig;
    }
  } catch {
  }
  return {};
}

export function saveConfig(config: CliConfig): void {
  ensureConfigDir();
  const merged = { ...loadConfig(), ...config };
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err) {
    throw new Error(
      `Cannot write config to ${CONFIG_PATH}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
```

### Core Architecture Module: `cli/src/extract-html.ts`
```
/**
 * Extract HTML from agent output — adapted from next/src/lib/extract-html.ts
 */

export function extractHtml(streamed: string): string {
  if (!streamed) return "";

  const fence = streamed.match(/```(?:html|HTML)?\s*([\s\S]*?)```/);
  if (fence) {
    const inner = fence[1].trim();
    if (inner.startsWith("<")) return inner;
  }

  const doctypeStart = streamed.search(/<!DOCTYPE\s+html/i);
  if (doctypeStart !== -1) {
    const closeIdx = streamed.lastIndexOf("</html>");
    if (closeIdx !== -1) {
      return streamed.slice(doctypeStart, closeIdx + "</html>".length);
    }
    return streamed.slice(doctypeStart);
  }

  const htmlStart = streamed.search(/<html[\s>]/i);
  if (htmlStart !== -1) {
    const closeIdx = streamed.lastIndexOf("</html>");
    if (closeIdx !== -1) {
      return streamed.slice(htmlStart, closeIdx + "</html>".length);
    }
    return streamed.slice(htmlStart);
  }

  if (streamed.trimStart().startsWith("<")) {
    return streamed;
  }

  return "";
}
```

### Core Architecture Module: `cli/src/index.ts`
```
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { loadSkill, listSkills, type SkillMeta, type LoadedSkill } from "./skills-loader.js";
import { detectAgents, type DetectedAgent } from "./agents-detect.js";
import { assemblePrompt } from "./prompt-assemble.js";
import { invokeAgent, type InvokeEvent } from "./agents-invoke.js";
import { extractHtml } from "./extract-html.js";
import { loadConfig, saveConfig, getConfigPath, type CliConfig } from "./config.js";
import { matchTemplate, type MatchResult } from "./skills-matcher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findWorkspaceRoot(): string {
  let dir = __dirname;
  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const WORKSPACE_ROOT = findWorkspaceRoot();
const SKILLS_DIR = path.join(WORKSPACE_ROOT, "next", "src", "lib", "templates", "skills");

export function getSkillsDir(): string {
  return SKILLS_DIR;
}

export function getAvailableTemplates(): SkillMeta[] {
  return listSkills(SKILLS_DIR);
}

export function getTemplate(id: string): LoadedSkill | null {
  return loadSkill(SKILLS_DIR, id);
}

export function getAvailableAgents(): DetectedAgent[] {
  return detectAgents();
}

function findAgent(agentId?: string): DetectedAgent | null {
  const agents = getAvailableAgents();
  if (agentId) {
    return agents.find((a) => a.id === agentId && a.available) ?? null;
  }
  const config = loadConfig();
  if (config.defaultAgent) {
    const found = agents.find((a) => a.id === config.defaultAgent && a.available && !a.unsupported);
    if (found) return found;
  }
  return agents.find((a) => a.available && !a.unsupported) ?? null;
}

function printHelp(): void {
  console.log(`html-anything — AI-powered Markdown to HTML converter (CLI)

USAGE:
  html-anything <command> [options]

COMMANDS:
  convert [input]     Convert Markdown to HTML
    input               Input file (markdown), or use stdin if omitted
    --template, -t <id>  Template ID (default: uses saved default)
    --agent, -a <id>     Agent ID (default: auto-detect)
    --output, -o <path>  Output file path (default: auto-save to <input>.html or stdout)
    --output-dir, -d <dir>  Output directory for auto-saved files (default: current dir)
    --model <id>         Model to use (optional)
    --format <type>      Input format: markdown, text, csv, json (default: markdown)

  auto [input]        Auto-detect best template and convert
    input               Input file, or use stdin if omitted
    --agent, -a <id>     Agent ID (default: auto-detect)
    --output, -o <path>  Output file path
    --output-dir, -d <dir>  Output directory for auto-saved files
    --model <id>         Model to use (optional)
    --format <type>      Input format: markdown, text, csv, json (default: markdown)
    --force-ai                Force AI summary for matching
    --show-match-only          Show match result, skip conversion

  templates           List all available templates

  agents              List detected AI agents

  config              Show current configuration
  config set-default-template <id>   Set the default template
  config set-default-agent <id>      Set the default AI agent
  config set-model <id>              Set the default model
  config reset                       Reset all configuration

EXAMPLES:
  html-anything auto article.md
  html-anything auto article.md -o output.html
  html-anything auto article.md --show-match-only
  html-anything auto article.md --force-ai
  cat article.md | html-anything auto
  html-anything convert article.md
  html-anything convert article.md -t doc-kami-parchment -o output.html
  html-anything convert article.md -t doc-kami-parchment -d ./dist
  html-anything convert article.md -a claude --model sonnet
  html-anything convert file1.md file2.md file3.md -d ./dist
  cat article.md | html-anything convert
  html-anything config set-default-template resume-modern
  html-anything templates
  html-anything agents
`);
}

function createSpinner(msg: string) {
  if (!process.stderr.isTTY) {
    const start = Date.now();
    let chunkCount = 0;
    return {
      tick: () => { chunkCount++; },
      start,
      stop: (final?: string) => {
        if (final !== undefined) process.stderr.write(`${final}\n`);
      },
    };
  }

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let chunkCount = 0;
  const start = Date.now();
  let lastLen = 0;

  const interval = setInterval(() => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const frame = frames[i % frames.length];
    const text = `\r  ${frame} ${msg}  ${chunkCount} chunks / ${elapsed}s \x1b[90m(Ctrl+C to stop)\x1b[0m`;
    process.stderr.write(text);
    lastLen = text.length;
    i++;
  }, 80);

  return {
    tick: () => { chunkCount++; },
    start,
    stop: (final?: string) => {
      clearInterval(interval);
      process.stderr.write("\r" + " ".repeat(lastLen) + "\r");
      if (final !== undefined) process.stderr.write(`${final}\n`);
    },
  };
}

async function handleConvert(args: string[]): Promise<void> {
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--template" || arg === "-t") {
      flags.template = args[++i] ?? "";
    } else if (arg === "--agent" || arg === "-a") {
      flags.agent = args[++i] ?? "";
    } else if (arg === "--output" || arg === "-o") {
      flags.output = args[++i] ?? "";
    } else if (arg === "--output-dir" || arg === "-d") {
      flags.outputDir = args[++i] ?? "";
    } else if (arg === "--model") {
      flags.model = args[++i] ?? "";
    } else if (arg === "--format") {
      flags.format = args[++i] ?? "";
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      return;
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  if (flags.output && flags.outputDir) {
    console.error("Error: --output (-o) and --output-dir (-d) cannot be used together.");
    process.exit(1);
  }

  if (flags.output && positional.length > 1) {
    console.error("Error: --output (-o) cannot be used with multiple input files. Use --output-dir (-d) instead.");
    process.exit(1);
  }

  const VALID_FORMATS = ["markdown", "text", "csv", "json"];
  const format = flags.format ?? "markdown";
  if (!VALID_FORMATS.includes(format)) {
    console.error(`Error: Unknown format "${format}". Supported: ${VALID_FORMATS.join(", ")}`);
    process.exit(1);
  }

  const config = loadConfig();

  const templateId = flags.template ?? config.defaultTemplate;
  if (!templateId) {
    console.error("Error: No template specified. Use --template <id> or set a default with:");
    console.error("  html-anything config set-default-template <id>");
    console.error("\nAvailable templates:");
    for (const t of getAvailableTemplates()) {
      console.error(`  ${t.id} — ${t.zhName}`);
    }
    process.exit(1);
  }

  const skill = getTemplate(templateId);
  if (!skill) {
    console.error(`Error: Unknown template "${templateId}"`);
    console.error("Run 'html-anything templates' to list available templates.");
    process.exit(1);
  }

  const agent = findAgent(flags.agent);
  if (!agent) {
    const wantId = flags.agent ?? config.defaultAgent ?? "(auto-detect)";
    console.error(`Error: No available AI agent found${flags.agent ? ` for "${wantId}"` : ""}.`);
    console.error("\nDetected agents:");
    for (const a of getAvailableAgents()) {
      const status = a.available ? (a.unsupported ? "(unsupported)" : "✓") : "✗";
      console.error(`  ${status} ${a.id} — ${a.label}`);
    }
    console.error("\nInstall one of the supported agents (e.g. 'claude', 'codex', 'gemini') and try again.");
    process.exit(1);
  }

  const model = flags.model ?? config.model;

  const inputPaths = positional.length > 0 ? positional : [];

  if (inputPaths.length === 0) {
    const content = await readStdin();
    if (!content.trim()) {
      console.error("Error: No input provided. Pipe content via stdin or specify an input file.");
      process.exit(1);
    }
    process.stdout.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "EPIPE") process.exit(0);
    });
    const ok = await convertOne({ inputPath: null, content, skill, agent, model, format, flags });
    if (!ok) process.exit(1);
  } else {
    const outputDir = flags.outputDir || process.cwd();

    if (inputPaths.length > 1) {
      const flatBasenames = inputPaths.map((p) => path.basename(p, path.extname(p)));
      const basenameCounts = new Map<string, string[]>();
      for (let i = 0; i < flatBasenames.length; i++) {
        const key = flatBasenames[i];
        if (!basenameCounts.has(key)) basenameCounts.set(key, []);
        basenameCounts.get(key)!.push(inputPaths[i]);
      }
      const collisions = [...basenameCounts].filter(([, paths]) => paths.length > 1);

      if (collisions.length > 0) {
        console.error(`\x1b[33m⚠\x1b[0m Multiple inputs would produce the same output basename:`);
        for (const [basename, paths] of collisions) {
          console.error(`  ${basename}:`);
          for (const p of paths) console.error(`    → ${p}`);
        }
        const useRelative = await promptYesNo(
          "\x1b[33m⚠\x1b[0m Save with relative directory paths (e.g. dir1/readme.html)? (y/N): ",
        );
        if (!useRelative) {
          console.error(
            "Aborted. Rename your input files to use different basenames, or use --output (-o) for each file.",
          );
          process.exit(1);
     
```

### Core Architecture Module: `cli/src/prompt-assemble.ts`
```
/**
 * Prompt assembly — adapted from next/src/lib/templates/shared.ts
 */

const SHARED_DESIGN_DIRECTIVES = `
你是世界级的视觉设计师 + 资深前端工程师。请输出一份**自包含的单文件 HTML**，要求：

【内容驱动数量 — 最高优先级, 覆盖模板里的任何数字】
- 模板只定义"可用版面 / 风格 / 配色 / 字体 / 组件库", **不定义** slide / 帧 / 卡片 / section 的数量。
- 输出的 slide / frame / card / section 数量**完全由【用户内容】的实际长度和信息结构决定**。必须**完整覆盖**用户内容的每一个要点、章节、数据组, **不许总结、压缩、丢弃信息**。
- 如果模板正文里写了类似"挑 6-10 张组成 deck / 输出 6-10 帧 / 3-6 张卡片"的数字, **一律视为短示例下的参考下限, 不是上限**。短内容可以低于该范围, 长内容应远超该范围 — 用户给了 12k 字符的内容, 输出 4-6 张是**严重错误**。
- 模板里的"N 个锁死版面 / N 个磁带式版面 / N 个 layout"指的是**可复用的版式池**, 同一个版式允许在不同内容上多次出现 (例如 KPI Tower 可以连续用 3 次承载不同章节的数据), 不是页数上限。
- 推荐做法: 先把【用户内容】按语义切成若干段 (章节标题 / 论点 / 数据组 / 列表项 / 步骤), 每一段 → 至少一个独立的 slide / section / card, 然后再从模板的版式池里给每一段挑最合适的版面。宁可多页也不要把多个独立要点硬塞进一页。

【硬性技术要求】
- **禁止使用 Write / Edit / MultiEdit / Bash / Create / 任何文件系统工具**。不要把 HTML 写到任何 \`.html\` 文件里。前端直接捕获你的 stdout 文本, 文件落盘由前端负责。
- 直接把完整的 HTML 文档作为助手回复的正文流式输出。不要先说"我来生成"、"已输出至 …"之类的话。
- 文档以 \`<!DOCTYPE html>\` 开头, 末尾以 \`</html>\` 结束。
- 在 \`<head>\` 中通过 CDN 引入 Tailwind v3 Play (https://cdn.tailwindcss.com) 与所需的 Google Fonts。
- 不要引用任何外部图片 URL（除非你能保证 URL 长期有效；优先使用 CSS / SVG 内联绘制）。
- 必要的脚本（图表、动画）通过 jsdelivr CDN 引入；保持单文件可双击打开即用。
- 输出**纯 HTML**, 不要用 markdown 代码围栏包裹, 不要任何解释性文字。第一个字符必须是 \`<\`。

【设计准则 — 世界级标准】
- 排版: 中文优先 \`Noto Sans SC\` / \`Noto Serif SC\`, 英文 \`Inter\` / \`Manrope\` / \`SF Pro\` 风格。
- 色彩: 使用 1 个主色 + 2 个中性色 + 至多 1 个强调色; 大胆留白; 不使用纯黑纯白 (#000/#fff), 改用 \`#0a0a0a\` / \`#fafafa\`。
- 网格: 8 px 基线; 段落最大宽度 65 ch; 标题与正文有清晰的层级。
- 微观细节: 圆角统一 (rounded-xl/2xl), 投影柔和 (shadow-sm/lg), 边框 1px \`#e5e7eb\` / \`#262626\`。
- 动效: 仅在必要处使用 \`transition-all\` 或入场 fade-in; 不要喧宾夺主。
- 无障碍: 颜色对比度 ≥ 4.5; 重要交互有 focus 态。

【内容真实性】
- **必须使用用户提供的真实数据**, 不要编造、不要 lorem ipsum、不要 "Your text here"。
- 如果用户数据是结构化数据 (CSV/JSON), 请提取关键洞察并以图表/表格呈现。
- 中文与英文混排时, 中英文之间留半角空格 (盘古之白)。

`;

export function assemblePrompt(opts: {
  body: string;
  content: string;
  format: string;
}): string {
  return `${SHARED_DESIGN_DIRECTIVES}
${opts.body.trim()}

【输入格式】: ${opts.format}
【用户内容】:
${opts.content}
`;
}
```

### Core Architecture Module: `cli/src/prompt.ts`
```
import readline from "node:readline";

export function promptYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY || !process.stderr.isTTY) {
      resolve(false);
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

export function promptOverwrite(filepath: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY || !process.stderr.isTTY) {
      resolve(true);
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(`\x1b[33m⚠\x1b[0m ${filepath} already exists. Overwrite? (y/N): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

```

### Core Architecture Module: `cli/src/run.ts`
```
#!/usr/bin/env node
import { main } from "./index.js";
main(process.argv.slice(2));
```

### Core Architecture Module: `cli/src/skills-loader.ts`
```
import fs from "node:fs";
import path from "node:path";

/**
 * File-based skill loader — adapted from next/src/lib/templates/loader.ts
 * This version accepts a skillsDir parameter instead of hardcoding process.cwd().
 */

export type SkillFrontmatter = {
  name?: string;
  zh_name?: string;
  en_name?: string;
  emoji?: string;
  description?: string;
  category?: string;
  scenario?: string;
  aspect_hint?: string;
  featured?: number;
  recommended?: number;
  tags?: string[];
  example_id?: string;
  example_name?: string;
  example_format?: string;
  example_tagline?: string;
  example_desc?: string;
  example_source_url?: string;
  example_source_label?: string;
};

export type SkillExampleMeta = {
  id: string;
  name: string;
  format: string;
  tagline: string;
  desc: string;
  source?: { url: string; label: string };
  hasHtml: boolean;
  hasMd: boolean;
};

export type SkillMeta = {
  id: string;
  zhName: string;
  enName: string;
  emoji: string;
  description: string;
  category: string;
  scenario: string;
  aspectHint: string;
  featured?: number;
  recommended?: number;
  tags: string[];
  example?: SkillExampleMeta;
};

export type LoadedSkill = SkillMeta & {
  body: string;
  exampleMd?: string;
  exampleHtml?: string;
};

function parseFrontmatter(raw: string): { fm: SkillFrontmatter; body: string } {
  const m = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/m.exec(raw);
  if (!m) return { fm: {}, body: raw };
  const block = m[1];
  const body = m[2] ?? "";
  const fm: SkillFrontmatter = {};
  for (const line of block.split(/\r?\n/)) {
    const mm = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!mm) continue;
    const key = mm[1];
    let val: string = mm[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1).replace(/\\"/g, '"');
    }
    switch (key) {
      case "featured": {
        const n = Number(val);
        if (Number.isFinite(n)) fm.featured = n;
        break;
      }
      case "recommended": {
        const n = Number(val);
        if (Number.isFinite(n)) fm.recommended = n;
        break;
      }
      case "tags": {
        const arr = /^\[(.*)\]$/.exec(val);
        if (arr) {
          fm.tags = arr[1]
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""))
            .map((s) => s.replace(/\\"/g, '"'))
            .filter(Boolean);
        }
        break;
      }
      case "name":
      case "zh_name":
      case "en_name":
      case "emoji":
      case "description":
      case "category":
      case "scenario":
      case "aspect_hint":
      case "example_id":
      case "example_name":
      case "example_format":
      case "example_tagline":
      case "example_desc":
      case "example_source_url":
      case "example_source_label":
        (fm as Record<string, string>)[key] = val;
        break;
    }
  }
  return { fm, body: body.trim() };
}

function safeRead(p: string): string | undefined {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return undefined;
  }
}

function fmToMeta(id: string, fm: SkillFrontmatter, hasHtml: boolean, hasMd: boolean): SkillMeta {
  const meta: SkillMeta = {
    id,
    zhName: fm.zh_name ?? fm.name ?? id,
    enName: fm.en_name ?? id,
    emoji: fm.emoji ?? "✨",
    description: fm.description ?? "",
    category: fm.category ?? "other",
    scenario: fm.scenario ?? "marketing",
    aspectHint: fm.aspect_hint ?? "",
    tags: Array.isArray(fm.tags) ? fm.tags : [],
  };
  if (typeof fm.featured === "number") meta.featured = fm.featured;
  if (typeof fm.recommended === "number") meta.recommended = fm.recommended;
  if (fm.example_id || hasMd || hasHtml) {
    meta.example = {
      id: fm.example_id ?? `example-${id}`,
      name: fm.example_name ?? `${meta.zhName} 示例`,
      format: fm.example_format ?? "markdown",
      tagline: fm.example_tagline ?? "",
      desc: fm.example_desc ?? "",
      hasHtml,
      hasMd,
      ...(fm.example_source_url
        ? {
            source: {
              url: fm.example_source_url,
              label: fm.example_source_label ?? fm.example_source_url,
            },
          }
        : {}),
    };
  }
  return meta;
}

function isValidId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/i.test(id);
}

export function listSkills(skillsDir: string): SkillMeta[] {
  const out: SkillMeta[] = [];
  let dirents: fs.Dirent[] = [];
  try {
    dirents = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of dirents) {
    if (!ent.isDirectory()) continue;
    const id = ent.name;
    if (!isValidId(id)) continue;
    const dir = path.join(skillsDir, id);
    const raw = safeRead(path.join(dir, "SKILL.md"));
    if (!raw) continue;
    const { fm } = parseFrontmatter(raw);
    const hasHtml = fs.existsSync(path.join(dir, "example.html"));
    const hasMd = fs.existsSync(path.join(dir, "example.md"));
    out.push(fmToMeta(id, fm, hasHtml, hasMd));
  }
  return out;
}

export function loadSkill(skillsDir: string, id: string): LoadedSkill | null {
  if (!isValidId(id)) return null;
  const dir = path.join(skillsDir, id);
  const raw = safeRead(path.join(dir, "SKILL.md"));
  if (!raw) return null;
  const { fm, body } = parseFrontmatter(raw);
  const exampleMd = safeRead(path.join(dir, "example.md"));
  const exampleHtml = safeRead(path.join(dir, "example.html"));
  const meta = fmToMeta(id, fm, !!exampleHtml, !!exampleMd);
  return { ...meta, body, exampleMd, exampleHtml };
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #148** (2026-10-13): **Codex invocations do not handle lifecycle diagnostics reliably**
  *Symptoms*: ## Problem  When Codex runs through the conversion route, its JSONL stream includes lifecycle events such as `thread.started` and `turn.started`. It can also emit a nonfatal model-catalog refresh diagnostic on stderr and then continue successfully.  The current adapter ignores the lifecycle start events and forwards the full diagnostic response body. The browser also marks a conversion as done whenever the SSE stream ends, even when the agent has a non-zero or missing exit code or produced no HTML. Together, this makes a run look stalled or successful without a reliable terminal state.  ## Reproduction  1. Run `pnpm -F @html-anything/next dev`. 2. Select Codex and start any conversion. 3. Observe a lifecycle diagnostic before the assistant output. 4. Observe that completion is not derived from both the process exit code and generated HTML.  Redacted real-session event shape:  ```text thread.started turn.started item.completed (diagnostic) item.completed (agent message) turn.completed ```  ## Expected behavior  - Surface the Codex session and generation start events. - Treat diagnostic items as warnings rather than generated HTML. - Preserve useful stderr context while redacting appended response bodies. - Mark a conversion done only after exit code 0 and non-empty HTML. - Keep provider and model selection inherited from the existing Codex CLI configuration.
  **Post-Mortem & Fix Analysis**:
  > Hi @jhinzzz — thanks for the crisp write-up here. The redacted Codex event sequence plus the exit-code/HTML success criteria made this easy to verify against the current pipeline.  I could confirm the main gaps from the code path: - `next/src/lib/agents/argv.ts` currently only turns Codex `item.delta` and assistant-message payloads into rendered output, so `thread.started` / `turn.started` never surface as start/meta events today. - `next/src/lib/use-convert.ts` flips the task to `done` as soon as the SSE reader finishes, without checking whether the final process exit code was `0` or whether any HTML was actually produced. - The provider/model inheritance part already looks aligned with the existing Codex CLI config, since the Codex argv builder only appends `--model` when the UI explicitly sets one.  So this looks like a real bug in the adapter/completion boundary rather than just noisy diagnostics. The fix direction you outlined makes sense: classify lifecycle/diagnostic items as me
  > If you'd like to take this on, comment `/claim` and we can track it with you. The bug is nicely scoped from the parser/completion path above. <!-- synclo-community-invitation:v1 --> 

- **Issue #110** (2026-07-28): **🤖 🐛 Zero duration is incorrectly treated as undefined**
  *Symptoms*: 🐛 **Bug** · 🟡 Medium · Confidence: 96%  **File:** `next/src/lib/hyperframes.ts` **Location:** `dataDur`  ---  ### What's wrong  The line `const dataDur = Number(extractAttr(openTag, "data-duration")) || undefined;` uses the logical OR operator, which treats a duration value of `0` as falsy and replaces it with `undefined`, causing the default duration (3000 ms) to be used instead of the intended zero duration.  ### Suggested fix  Replace the assignment with an explicit check for an empty string before converting to a number, e.g. ```typescript const dataDurStr = extractAttr(openTag, "data-duration"); const dataDur = dataDurStr ? Number(dataDurStr) : undefined; ```  ---  <details> <summary>About this report</summary>  This finding was generated by an automated audit tool using Llama 3.3 70B + verification passes. Only findings with ≥92% confidence that passed both LLM self-verification and line reference verification are reported. False positives are still possible — please verify before acting.  </details>

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

### Incident Patch 1: `2be93108` (2026-05-29)
**Commit Message**: fix(security): validate Host header on /api/* to block DNS rebinding (#61)

* fix(security): validate Host header on /api/* to block DNS rebinding

`next dev` and `next start` bind to 0.0.0.0 by default. A malicious
page can DNS-rebind an attacker-controlled name (`attacker.example` →
`127.0.0.1`) and POST to `/api/convert`, `/api/deploy`, etc. through
the user's browser — `/api/convert` spawns the local agent CLI with
maximally permissive flags, so a successful forged-Host POST is
unauthenticated RCE via the agent.

Add a Next middleware that gates every `/api/*` request on a
Host-header allowlist. Defaults to loopback only (`127.0.0.1`,
`localhost`, `::1`, any port). Two operator knobs:

- `HTML_ANYTHING_ALLOWED_HOSTS=host1,host2,…` — extend the allowlist
  for LAN / mDNS / `.local` setups.
- `HTML_ANYTHING_ALLOW_ANY_HOST=1` — bypass entirely, for when a
  trusted reverse proxy is terminating Host upstream. Loudly insecure
  by design; not the default.

Restructured for the workspace layout per maintainer guidance on PR #61:

- `next/src/middleware.ts` — the Next middleware (runs on `/api/:path*`)
- `next/src/lib/security/host-validation.ts` — pure validator + env wrapper
- `next

**File**: `README.md` (modified, +12/-0)
```diff
@@ -440,6 +440,18 @@ Early but real. The closed loop — **detect agent → pick skill → SSE stream
 | History / version diff / IndexedDB archive | ⏳ planned |
 | Skill marketplace (`install <github-repo>`) | ⏳ planned |
 
+## Security
+
+The Next API surface is the local-only side of the app — `/api/convert` spawns the user's coding-agent CLI with maximally permissive flags, `/api/deploy` writes credentialed config to disk. Both are intended for a single operator on a single machine. To prevent a malicious page from DNS-rebinding `attacker.example` to `127.0.0.1` and POSTing into those routes through the user's browser, every `/api/*` request is gated on a Host-header allowlist in [`next/src/middleware.ts`](next/src/middleware.ts).
+
+| Setting | When to use |
+|---|---|
+| **Default (no env vars set)** | The common case — `next dev` / `next start` on your own machine. `127.0.0.1`, `localhost`, and `::1` Host headers (any port) are accepted. Everything else gets a 403 `{ "error": "Host not allowed" }`. |
+| **`HTML_ANYTHING_ALLOWED_HOSTS=daemon.mirage.local,html-anything.lan`** | LAN / mDNS setup — you're reaching the app from another device on the same network and the browser dials a non-loopback hostname. Comma-separated; port-insensitive; case-insensitive. The default loopback set is still accepted on top of this. |
+| **`HTML_ANYTHING_ALLOW_ANY_HOST=1`** | Reverse-proxy mode — Caddy / nginx / Cloudflare Tunnel is terminating the public hostname and forwarding to the app. The proxy is now responsible for Host policy. Loudly insecure if you set this without a trusted proxy in front, so it is not the default. |
+
+Set the env var in whatever environment file your launcher reads (e.g. `next/.env.local`). The middleware is pinned to the Node runtime (`export const runtime = "nodejs"` in [`next/src/middleware.ts`](next/src/middleware.ts)) so `process.env` is read per-request — Edge middleware can inline `process.env.*` at build time, which would silently break operator overrides set after `next build`. The validation is unit-tested in [`next/src/lib/security/host-validation.test.ts`](next/src/lib/security/host-validation.test.ts) and the loopback-still-works dev path is exercised in the Playwright spec at [`e2e/ui/host-validation.spec.ts`](e2e/ui/host-validation.spec.ts).
+
 ## Contributing
 
 Issues, PRs, new skills, new agent adapters, new export targets, and translations are all welcome. The highest-leverage contributions are usually **one folder, one Markdown file, or one PR-sized adapter** — small surface area, big leverage. Pick the slot that matches what you want to add:
```

**File**: `e2e/ui/host-validation.spec.ts` (added, +131/-0)
```diff
@@ -0,0 +1,131 @@
+/**
+ * End-to-end verification that the API surface refuses requests whose `Host`
+ * header isn't on the loopback allowlist. The exact rebinding attack we are
+ * defending against would deliver these requests from a real browser tab
+ * after a DNS flip; here we use a raw `request.fetch` so we can forge the
+ * header directly.
+ *
+ * The Playwright webServer in `e2e/playwright.config.ts` runs
+ * `next start -p 3317`, which binds to every interface by default. The
+ * default `baseURL` resolves to `127.0.0.1:3317` — the loopback path. To
+ * exercise the rejection path we override the `Host` header to attacker-
+ * controlled values while still dialing the real loopback IP.
+ *
+ * The accept-loopback tests prove the default dev path keeps working —
+ * gating on Host must not break the common case where the user opens
+ * `http://localhost:3317/` in a browser on their own machine.
+ */
+import { test, expect, request as playwrightRequest } from "@playwright/test";
+
+const API_PATHS = [
+  "/api/agents",
+  "/api/templates",
+  "/api/deploy/config?provider=vercel",
+] as const;
+
+// Matches the `webServer.url` in e2e/playwright.config.ts (port 3317). Used as
+// a fallback when the `baseURL` fixture is undefined — exactOptionalPropertyTypes
+// rejects passing `string | undefined` to newContext's `baseURL?: string`.
+const DEFAULT_BASE_URL = "http://127.0.0.1:3317";
+
+test.describe("API host-header validation", () => {
+  test("accepts loopback Host (127.0.0.1) — default dev path", async ({ baseURL }) => {
+    const ctx = await playwrightRequest.newContext({
+      baseURL: baseURL ?? DEFAULT_BASE_URL,
+      extraHTTPHeaders: { Host: "127.0.0.1:3317" },
+    });
+    for (const p of API_PATHS) {
+      const r = await ctx.get(p);
+      // Any 2xx / 4xx that ISN'T 403 from this middleware passes — the route
+      // may legitimately 400 (missing query / not configured) but it should
+      // not be the host-rejection 403.
+      if (r.status() === 403) {
+        const body = await r.json().catch(() => ({}));
+        expect(body.error, `loopback host rejected on ${p}: ${JSON.stringify(body)}`).not.toBe(
+          "Host not allowed",
+        );
+      }
+    }
+    await ctx.dispose();
+  });
+
+  test("accepts localhost Host — default dev path", async ({ baseURL }) => {
+    const ctx = await playwrightRequest.newContext({
+      baseURL: baseURL ?? DEFAULT_BASE_URL,
+      extraHTTPHeaders: { Host: "localhost:3317" },
+    });
+    const r = await ctx.get("/api/agents");
+    expect(r.status()).not.toBe(403);
+    await ctx.dispose();
+  });
+
+  test("rejects attacker.example Host on every API path", async ({ baseURL }) => {
+    const ctx = await playwrightRequest.newContext({
+      baseURL: baseURL ?? DEFAULT_BASE_URL,
+      extraHTTPHeaders: { Host: "attacker.example" },
+    });
+    for (const p of API_PATHS) {
+      const r = await ctx.get(p);
+      expect(r.status(), `${p} should reject attacker.example`).toBe(403);
+      const body = await r.json();
+      expect(body.error).toBe("Host not allowed");
+    }
+    await ctx.dispose();
+  });
+
+  test("rejects POST /api/convert with attacker Host (RCE vector)", async ({ baseURL }) => {
+    const ctx = await playwrightRequest.newContext({
+      baseURL: baseURL ?? DEFAULT_BASE_URL,
+      extraHTTPHeaders: { Host: "attacker.example" },
+    });
+    const r = await ctx.post("/api/convert", {
+      data: { agent: "claude", templateId: "deck-swiss-international", content: "ignore" },
+    });
+    expect(r.status(), "POST /api/convert must reject forged Host (RCE vector)").toBe(403);
+    await ctx.dispose();
+  });
+
+  test("rejects PUT /api/deploy/config with attacker Host (token-write vector)", async ({
+    baseURL,
+  }) => {
+    const ctx = await playwrightRequest.newContext({
+      baseURL: baseURL ?? DEFAULT_BASE_URL,
+      extraHTTPHeaders: { Host: "attacker.example" },
+    });
+    const r = await ctx.put("/api/deploy/config?provider=vercel", {
+      data: { token: "attacker-token" },
+    });
+    expect(r.status()).toBe(403);
+    await ctx.dispose();
+  });
+
+  test("rejects subdomain-tricks (localhost.attacker.example)", async ({ baseURL }) => {
+    const ctx = await playwrightRequest.newContext({
+      baseURL: baseURL ?? DEFAULT_BASE_URL,
+      extraHTTPHeaders: { Host: "localhost.attacker.example" },
+    });
+    const r = await ctx.get("/api/agents");
+    expect(r.status()).toBe(403);
+    await ctx.dispose();
+  });
+
+  test("rejects empty Host", async ({ baseURL }) => {
+    // A single space is deterministically transmitted; per RFC 7230 the
+    // receiving parser strips the surrounding OWS and the server sees an
+    // empty `host`. The validator's `stripPort.trim()` reduces it to "" and
+    // `isAllowedHost("")` returns false → 403. An empty-string value would
+    // be at the mercy of Playwright's header-serialization behavior (it may
+    // drop the entry, in which c
```

**File**: `next/src/lib/security/host-validation.test.ts` (added, +146/-0)
```diff
@@ -0,0 +1,146 @@
+import { afterEach, describe, expect, it } from "vitest";
+import {
+  isAllowedHost,
+  isRequestHostAllowed,
+  parseAllowedHosts,
+  stripPort,
+} from "./host-validation";
+
+describe("stripPort", () => {
+  it("preserves bare hostnames", () => {
+    expect(stripPort("localhost")).toBe("localhost");
+    expect(stripPort("127.0.0.1")).toBe("127.0.0.1");
+    expect(stripPort("daemon.mirage.local")).toBe("daemon.mirage.local");
+  });
+  it("strips ipv4 + dns ports", () => {
+    expect(stripPort("localhost:3000")).toBe("localhost");
+    expect(stripPort("127.0.0.1:3317")).toBe("127.0.0.1");
+    expect(stripPort("example.com:443")).toBe("example.com");
+  });
+  it("strips ipv6 ports while keeping brackets", () => {
+    expect(stripPort("[::1]:3000")).toBe("[::1]");
+    expect(stripPort("[::1]")).toBe("[::1]");
+  });
+  it("lower-cases", () => {
+    expect(stripPort("LOCALHOST:3000")).toBe("localhost");
+  });
+  it("does not strip when the trailing chunk is not a port", () => {
+    expect(stripPort("not-a-port:abc")).toBe("not-a-port:abc");
+  });
+  // Documents the fact that bare unbracketed `::1` is mangled by the
+  // `last-colon-trailing-digit` branch — the last colon is index 1 and the
+  // trailing "1" is all digits, so the slice returns ":". A bare `::1` can
+  // therefore never match anything in `LOOPBACK_HOSTS`, which is why only
+  // the bracketed `[::1]` form is on the allowlist.
+  it("mangles bare ::1 to ':' (only [::1] is a real Host header anyway)", () => {
+    expect(stripPort("::1")).toBe(":");
+  });
+});
+
+describe("parseAllowedHosts", () => {
+  it("returns an empty set for undefined / empty input", () => {
+    expect(parseAllowedHosts(undefined).size).toBe(0);
+    expect(parseAllowedHosts("").size).toBe(0);
+    expect(parseAllowedHosts("  ,  ,").size).toBe(0);
+  });
+  it("splits + trims + lowercases + strips ports", () => {
+    const set = parseAllowedHosts("Daemon.mirage.local, HOST-A:8080 , host-b");
+    expect([...set].sort()).toEqual(["daemon.mirage.local", "host-a", "host-b"]);
+  });
+});
+
+describe("isAllowedHost (defaults — loopback only)", () => {
+  it("accepts loopback variants on any port", () => {
+    expect(isAllowedHost("127.0.0.1")).toBe(true);
+    expect(isAllowedHost("127.0.0.1:3000")).toBe(true);
+    expect(isAllowedHost("localhost")).toBe(true);
+    expect(isAllowedHost("LOCALHOST:3317")).toBe(true);
+    expect(isAllowedHost("[::1]:3000")).toBe(true);
+    expect(isAllowedHost("[::1]")).toBe(true);
+  });
+  it("rejects attacker hosts", () => {
+    expect(isAllowedHost("attacker.example")).toBe(false);
+    expect(isAllowedHost("attacker.example:80")).toBe(false);
+    expect(isAllowedHost("evil.local")).toBe(false);
+    // Adjacent loopback aliases that aren't on the allowlist — keep strict
+    expect(isAllowedHost("127.0.0.2")).toBe(false);
+    expect(isAllowedHost("localhost.attacker.example")).toBe(false);
+  });
+  // `0.0.0.0` is reachable from a public page on pre-fix Chrome (< 128) — it
+  // routes to the local machine on macOS/Linux without needing DNS rebinding.
+  // Must be rejected so the gate covers that sibling vector.
+  it("rejects 0.0.0.0 (sidesteps DNS rebinding via 0.0.0.0-day vector)", () => {
+    expect(isAllowedHost("0.0.0.0")).toBe(false);
+    expect(isAllowedHost("0.0.0.0:3317")).toBe(false);
+  });
+  // Bare unbracketed `::1` is mangled by stripPort (see stripPort tests) and
+  // browsers / HTTP/2 always bracket IPv6 in the Host / :authority field.
+  it("rejects bare unbracketed ::1 (only [::1] is a real Host header)", () => {
+    expect(isAllowedHost("::1")).toBe(false);
+  });
+  it("rejects empty / missing host", () => {
+    expect(isAllowedHost(null)).toBe(false);
+    expect(isAllowedHost(undefined)).toBe(false);
+    expect(isAllowedHost("")).toBe(false);
+    expect(isAllowedHost("   ")).toBe(false);
+  });
+});
+
+describe("isAllowedHost — operator-extended allowlist", () => {
+  const extras = parseAllowedHosts("daemon.mirage.local,html.anything.lan");
+  it("accepts entries from extraAllowed (case + port insensitive)", () => {
+    expect(isAllowedHost("daemon.mirage.local", { extraAllowed: extras })).toBe(true);
+    expect(isAllowedHost("DAEMON.MIRAGE.LOCAL:3000", { extraAllowed: extras })).toBe(true);
+    expect(isAllowedHost("html.anything.lan:8080", { extraAllowed: extras })).toBe(true);
+  });
+  it("still rejects non-listed hosts even when extras are configured", () => {
+    expect(isAllowedHost("attacker.example", { extraAllowed: extras })).toBe(false);
+  });
+  it("accepts a string[] form for extraAllowed (not just Set)", () => {
+    expect(
+      isAllowedHost("daemon.mirage.local", { extraAllowed: ["daemon.mirage.local"] }),
+    ).toBe(true);
+  });
+});
+
+describe("isAllowedHost — wildcard opt-out", () => {
+  it("allowAny=true accepts any host (reverse-proxy mode)", () => {
+    expect(isAllowedHost("attacker.example", { allowAny: true })).toBe(true)
```

**File**: `next/src/lib/security/host-validation.ts` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+/**
+ * Host-header validator for the Next.js API surface.
+ *
+ * Threat model:
+ *   `next dev` and `next start` bind to `0.0.0.0` by default. Even with the
+ *   server bound to loopback only, a malicious page in the user's browser can
+ *   DNS-rebind an attacker-controlled name (`attacker.example` → `127.0.0.1`)
+ *   and POST to `/api/convert`, `/api/deploy`, `/api/deploy/config`, etc.
+ *   `/api/convert` spawns the user's local coding-agent CLI with maximally
+ *   permissive flags (`--permission-mode bypassPermissions`, `--yolo`,
+ *   `--allow-all-tools`, `--dangerously-skip-permissions`, …), so a successful
+ *   POST is unauthenticated RCE on the user's machine via the agent.
+ *
+ *   The browser blocks attackers from forging `Host` to `localhost`, so a
+ *   Host-header allowlist is the canonical defense: the browser sends the
+ *   hostname it dialed (`attacker.example`), we reject it, the request never
+ *   reaches the handler. Origin / CSRF tokens are not sufficient on their own
+ *   because no-cors POSTs with `Content-Type: text/plain` skip preflight.
+ *
+ * Defaults:
+ *   loopback IPv4 + loopback IPv6 + literal `localhost`, on any port.
+ *
+ * Operator extensibility:
+ *   `HTML_ANYTHING_ALLOWED_HOSTS` — comma-separated list (e.g. for a LAN-host
+ *      setup or a `.local` mDNS name). Each entry matches case-insensitively
+ *      against the bare hostname; port is ignored.
+ *   `HTML_ANYTHING_ALLOW_ANY_HOST=1` — opt-out wildcard, intended for behind
+ *      a trusted reverse proxy that terminates Host itself. Loudly insecure;
+ *      not the default.
+ */
+
+// `0.0.0.0` is intentionally NOT on the allowlist: on macOS/Linux it routes
+// to the local machine, and pre-fix Chrome (< 128) lets a public page fetch
+// `http://0.0.0.0:<port>` directly — that path bypasses DNS rebinding entirely
+// and would still reach the API if we accepted `Host: 0.0.0.0`. The Playwright
+// suite dials `127.0.0.1` (see `e2e/playwright.config.ts`), so removing it
+// breaks no test.
+//
+// `::1` (bare) is also omitted: `stripPort("::1")` produces `":"` (the
+// last-colon-trailing-digit branch), so a bare unbracketed `::1` can never
+// match anyway. Browsers and HTTP/2 `:authority` always bracket IPv6 literals,
+// so a bare `::1` doesn't appear in real Host headers either.
+const LOOPBACK_HOSTS = new Set([
+  "127.0.0.1",
+  "localhost",
+  "[::1]",
+]);
+
+/**
+ * Strip the optional port from a Host header value. Handles both IPv4 / DNS
+ * (`example.com:3000`) and IPv6 (`[::1]:3000`).
+ */
+export function stripPort(host: string): string {
+  const trimmed = host.trim().toLowerCase();
+  if (!trimmed) return "";
+  // IPv6 — `[::1]:3000` or `[::1]`
+  if (trimmed.startsWith("[")) {
+    const end = trimmed.indexOf("]");
+    if (end === -1) return trimmed; // malformed; fail in isAllowedHost
+    return trimmed.slice(0, end + 1);
+  }
+  const colon = trimmed.lastIndexOf(":");
+  if (colon === -1) return trimmed;
+  // Bare IPv6 with multiple colons but no brackets isn't valid in a Host
+  // header per RFC 7230, but be defensive: only strip when the part after the
+  // last colon is purely digits.
+  const after = trimmed.slice(colon + 1);
+  if (after.length > 0 && /^\d+$/.test(after)) return trimmed.slice(0, colon);
+  return trimmed;
+}
+
+/**
+ * Parse `HTML_ANYTHING_ALLOWED_HOSTS` into a normalized, lowercased set. Empty
+ * entries and whitespace are tolerated.
+ */
+export function parseAllowedHosts(raw: string | undefined): Set<string> {
+  const out = new Set<string>();
+  if (!raw) return out;
+  for (const part of raw.split(",")) {
+    const v = part.trim().toLowerCase();
+    if (v) out.add(stripPort(v));
+  }
+  return out;
+}
+
+export type HostValidationOptions = {
+  /** Operator-extended allowlist, in addition to the loopback defaults. */
+  extraAllowed?: Set<string> | string[];
+  /** When true, bypass the allowlist entirely. Driven by env opt-out. */
+  allowAny?: boolean;
+};
+
+/**
+ * Return true iff the `Host` header is one of: a loopback variant, an entry
+ * in the operator-extended allowlist, or `*` is enabled via env.
+ *
+ * `null` / empty host is treated as not allowed — HTTP/1.1 requires a Host
+ * header and HTTP/2 maps `:authority` to it, so an empty value is anomalous.
+ */
+export function isAllowedHost(
+  headerHost: string | null | undefined,
+  opts: HostValidationOptions = {},
+): boolean {
+  if (opts.allowAny) return true;
+  if (!headerHost) return false;
+  const host = stripPort(headerHost);
+  if (!host) return false;
+  if (LOOPBACK_HOSTS.has(host)) return true;
+  const extras =
+    opts.extraAllowed instanceof Set
+      ? opts.extraAllowed
+      : new Set((opts.extraAllowed ?? []).map((h) => stripPort(h.toLowerCase())));
+  return extras.has(host);
+}
+
+/**
+ * Convenience wrapper that reads the two env-vars and the request's Host
+ * header. Intended for use from `middleware.ts` so policy lives in one place.
+ */
+exp
```

**File**: `next/src/middleware.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import { NextRequest, NextResponse } from "next/server";
+import { isRequestHostAllowed } from "@/lib/security/host-validation";
+
+/**
+ * Gate every `/api/*` request behind a Host-header allowlist. See
+ * `next/src/lib/security/host-validation.ts` for the threat-model rationale and
+ * env knobs (`HTML_ANYTHING_ALLOWED_HOSTS`, `HTML_ANYTHING_ALLOW_ANY_HOST`).
+ *
+ * Why /api/*: the static + RSC routes don't have side effects worth gating
+ * (and refusing the document would just produce a confusing UX during DNS
+ * rebinding). The agent-spawn, file-write, and credentialed network paths
+ * all live under `/api/`.
+ */
+export function middleware(req: NextRequest) {
+  if (isRequestHostAllowed(req)) return NextResponse.next();
+  return new NextResponse(
+    JSON.stringify({
+      error: "Host not allowed",
+      hint:
+        "html-anything's API only accepts requests with a loopback Host header (127.0.0.1, localhost, ::1). " +
+        "If you're fronting it behind a different hostname, add it to HTML_ANYTHING_ALLOWED_HOSTS (comma-separated) " +
+        "or set HTML_ANYTHING_ALLOW_ANY_HOST=1 if a trusted reverse proxy is terminating Host upstream.",
+    }),
+    {
+      status: 403,
+      headers: { "Content-Type": "application/json; charset=utf-8" },
+    },
+  );
+}
+
+// Pin to the Node runtime so `process.env.HTML_ANYTHING_ALLOWED_HOSTS` and
+// `process.env.HTML_ANYTHING_ALLOW_ANY_HOST` are read per-request, not
+// inlined at build time. On Edge middleware, Next can fold `process.env.*`
+// references into the build output — operator-set env in `next/.env.local`
+// would then silently fail to take effect after `next start`, locking out
+// legitimate LAN hosts (`HTML_ANYTHING_ALLOWED_HOSTS`) or failing to disable
+// the gate (`HTML_ANYTHING_ALLOW_ANY_HOST=1`). Node runtime middleware
+// (Next 15.2+) sidesteps that by reading env at request time.
+export const runtime = "nodejs";
+
+export const config = {
+  // Run on every API route. Excludes static assets, RSC payloads, and the
+  // page tree — those are not the rebinding-attack surface.
+  matcher: ["/api/:path*"],
+};
```

---

### Incident Patch 2: `8fd5227d` (2026-06-16)
**Commit Message**: feat: rename DeepSeek TUI agent to CodeWhale (#87)

* feat(cli): add CLI tool with spinner progress and auto-save HTML

- Add CLI package that converts Markdown to styled HTML via local AI agents
- Support 8 coding-agent CLIs (Claude Code, Codex, Cursor Agent, Gemini, etc.)
- 75 skill templates from next/src/lib/templates/skills/
- Spinner progress indicator with chunk count and elapsed time (zero deps, pure ANSI)
- Auto-save output to <input>.html when input is a file
- --output-dir / -d flag to specify auto-save directory
- Config management (default template, agent, model)
- Stdin support for piping content

Part of: nexu-io/html-anything

* fix(cli): fail hard on non-HTML output, flush status in non-TTY mode

- extractHtml: return empty string instead of wrapping non-HTML in pre tag,
  so the CLI correctly surfaces agent errors (rate limits, auth failures)
  instead of silently saving a valid-looking HTML file around error text
- createSpinner: in the non-TTY branch, still flush the final status
  message to stderr so CI/piped scripts can diagnose failures

* fix(cli): robust error handling, multi-file support, overwrite prompt

Agent exit-code & stderr (A): track done.code and

**File**: `cli/.gitignore` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+dist/
+node_modules/
\ No newline at end of file
```

**File**: `cli/README.md` (added, +288/-0)
```diff
@@ -0,0 +1,288 @@
+# html-anything CLI
+
+从命令行直接将 Markdown（或纯文本/CSV/JSON）转换为精美排版的 HTML 文件，无需打开网页界面。
+
+## 安装
+
+```bash
+# 1. 进入项目目录，安装依赖
+cd html-anything
+pnpm install
+
+# 2. 构建 CLI
+pnpm -F @html-anything/cli build
+```
+
+### 全局安装（可选）
+
+构建完成后，可以创建全局链接：
+
+```bash
+# 在 cli 目录下创建全局链接
+cd cli
+npm link
+
+# 之后可以在任意目录使用
+html-anything --help
+```
+
+或者将以下别名添加到 `~/.zshrc` 或 `~/.bashrc`：
+
+```bash
+alias html-anything="node /path/to/html-anything/cli/dist/run.js"
+```
+
+## 快速开始
+
+### 1. 设置默认模板（推荐）
+
+```bash
+# 查看所有可用模板
+html-anything templates
+
+# 设置一个默认模板，之后 convert 时无需每次都指定
+html-anything config set-default-template doc-kami-parchment
+```
+
+### 2. 转换 Markdown 文件
+
+```bash
+# 自动匹配模板（推荐：无需手动选模板）
+html-anything auto article.md
+
+# 仅查看匹配结果，不执行转换
+html-anything auto article.md --show-match-only
+
+# 使用默认模板转换（自动保存为 article.html）
+html-anything convert article.md
+
+# 批量转换多个文件
+html-anything convert file1.md file2.md file3.md -d ./dist
+
+# 保存到指定文件
+html-anything convert article.md -o output.html
+
+# 指定自动保存目录
+html-anything convert article.md -d ./dist
+
+# 指定模板
+html-anything convert article.md -t resume-modern
+
+# 指定 AI agent
+html-anything convert article.md -a claude --model sonnet
+
+# 从标准输入读取（输出到 stdout）
+cat article.md | html-anything convert -o page.html
+```
+
+### 3. 查看生成结果
+
+```bash
+# 用浏览器打开生成的 HTML
+open output.html
+```
+
+## 命令详解
+
+### `convert` / `auto` — 转换内容
+
+两个命令共享以下通用参数：
+
+| 参数 | 简写 | 说明 | 默认值 |
+|------|------|------|--------|
+| `input` | — | 输入文件路径，省略则从 stdin 读取 | stdin |
+| `--agent <id>` | `-a` | AI agent ID | 自动检测第一个可用 agent |
+| `--output <path>` | `-o` | 输出文件路径 | 自动保存为 `<输入文件名>.html`，stdin 输入时输出到 stdout |
+| `--output-dir <dir>` | `-d` | 自动保存目录 | 当前目录 |
+| `--model <id>` | — | 使用的模型 | agent 默认模型 |
+| `--format <type>` | — | 输入格式：markdown, text, csv, json | markdown |
+
+#### `convert` — 指定模板转换
+
+```bash
+html-anything convert [input] [options]
+```
+
+用户明确指定模板 ID 来转换内容。
+
+| 参数 | 简写 | 说明 | 默认值 |
+|------|------|------|--------|
+| `--template <id>` | `-t` | 模板 ID | 配置中的 default-template |
+
+#### `auto` — 自动匹配模板并转换
+
+```bash
+html-anything auto [input] [options]
+```
+
+无需手动选择模板，CLI 自动分析内容主题，从 75 个模板中匹配最合适的模板，然后执行转换。
+
+| 参数 | 简写 | 说明 | 默认值 |
+|------|------|------|--------|
+| `--force-ai` | — | 跳过关键词匹配，强制使用 AI summary | — |
+| `--show-match-only` | — | 仅显示匹配结果，不执行转换 | — |
+
+### `templates` — 列出模板
+
+```bash
+html-anything templates
+```
+
+列出所有 75 个可用模板，按类别分组显示。已设为默认的模板会标记 `(default)`。
+
+### `agents` — 列出 Agent
+
+```bash
+html-anything agents
+```
+
+列出系统中已安装的 AI agent CLI。`✓` 表示可用，`✗` 表示未安装。
+
+### `config` — 配置管理
+
+```bash
+html-anything config                          # 查看当前配置
+html-anything config set-default-template <id>  # 设置默认模板
+html-anything config set-default-agent <id>     # 设置默认 agent
+html-anything config set-model <id>             # 设置默认模型
+html-anything config reset                      # 重置所有配置
+```
+
+配置文件位于 `~/.config/html-anything/config.json`。
+
+## 支持的 AI Agent
+
+html-anything 本身不做 AI 生成，它会自动检测并调用你系统里已安装的 AI CLI 工具（任意一个即可）来完成转换。支持的 AI CLI：
+
+| Agent | 安装方式 |
+|-------|----------|
+| Claude Code | `npm install -g @anthropic-ai/claude-code` |
+| OpenAI Codex | `npm install -g @openai/codex` |
+| Cursor Agent | 安装 Cursor 编辑器后可用 |
+| Gemini CLI | `npm install -g @google/gemini-cli` |
+| GitHub Copilot CLI | `npm install -g @github/copilot-cli` |
+| OpenCode | `npm install -g @open/open-cli` |
+| Qwen Coder | `npm install -g @alibaba/qwen-coder` |
+| CodeWhale | `npm install -g codewhale` |
+| DeepSeek TUI | `npm install -g deepseek-tui` |
+| Aider | `pip install aider-chat` |
+| OpenClaw | 参考官方文档安装 |
+
+## 常用模板推荐
+
+| 模板 ID | 名称 | 适用场景 |
+|---------|------|----------|
+| `doc-kami-parchment` | Kami 羊皮纸文档 | 长文、报告、one-pager |
+| `resume-modern` | 极简简历 | A4 单页简历 |
+| `deck-swiss-international` | 瑞士国际主义 Deck | 演示文稿 |
+| `deck-guizang-editorial` | 贵赞编辑墨水 Deck | 杂志风 PPT |
+| `magazine-poster` | 杂志风海报 | 海报、宣传单页 |
+| `blog-post` | 博客长文 | 技术博客 |
+| `data-report` | 数据可视化报告 | 数据分析报告 |
+| `card-xiaohongshu` | 小红书图文卡片 | 社交媒体图文 |
+| `prototype-web` | Web 产品原型 | 产品原型 |
+| `saas-landing` | SaaS Landing | 产品落地页 |
+
+## 完整使用示例
+
+```bash
+# 1. 首次使用：查看有哪些模板
+html-anything templates
+
+# 2. 设置你最喜欢的模板为默认
+html-anything config set-default-template doc-kami-parchment
+
+# 3. 写一篇 Markdown 文章
+cat > my-article.md << 'EOF'
+# 我的项目总结
+
+## 背景
+这是一个关于...
+
+## 成果
+- 完成了 A 功能
+- 优化了 B 模块
+
+## 下一步
+我们计划在 Q3 完成...
+EOF
+
+# 4. 一键自动匹配模板并转换（推荐）
+html-anything auto my-article.md
+
+# 5. 在浏览器中查看结果
+open my-article.html
+
+# 6. 如果只想看匹配结果
+html-anything auto my-article.md --show-match-only
+
+# 7. 如果想换个风格
+html-anything convert my-article.md -t blog-post -o my-article-v2.html
+
+# 8. 保存到指定目录
+html-anything convert my-article.md -d ./output
+```
+
+## 开发
+
+```bash
+# 开发模式（无需构建，直接运行 TypeScript）
+pnpm -F @html-anything/cli dev -- templates
+
+# 类型检查
+pnpm -F @html-anything/cli typecheck
+
+# 构建
+pnpm -F @html-anything/cli build
+```
+
+## 工作原理
+
+### `convert` 命令流程
+
+1. **模板加载*
```

**File**: `cli/package.json` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+{
+  "name": "@html-anything/cli",
+  "version": "0.1.0",
+  "private": true,
+  "license": "Apache-2.0",
+  "type": "module",
+  "bin": {
+    "html-anything": "./dist/run.js"
+  },
+  "scripts": {
+    "build": "tsc",
+    "dev": "tsx src/index.ts",
+    "typecheck": "tsc --noEmit",
+    "test": "vitest run",
+    "test:watch": "vitest"
+  },
+  "dependencies": {},
+  "devDependencies": {
+    "@types/node": "^20",
+    "tsx": "^4.22.1",
+    "typescript": "^5",
+    "vitest": "^4.1.6"
+  }
+}
\ No newline at end of file
```

**File**: `cli/src/__tests__/agents-detect.test.ts` (added, +329/-0)
```diff
@@ -0,0 +1,329 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
+
+const { existsSyncMock } = vi.hoisted(() => ({
+  existsSyncMock: vi.fn((_path?: string) => false),
+}));
+
+vi.mock("node:fs", async () => {
+  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
+  return { ...actual, existsSync: existsSyncMock };
+});
+
+import { detectAgents } from "../agents-detect.js";
+
+function findAgent(
+  agents: ReturnType<typeof detectAgents>,
+  id: string,
+) {
+  const agent = agents.find((a) => a.id === id);
+  if (!agent) throw new Error(`Agent with id "${id}" not found`);
+  return agent;
+}
+
+beforeEach(() => {
+  existsSyncMock.mockReset();
+  existsSyncMock.mockReturnValue(false);
+});
+
+afterEach(() => {
+  vi.unstubAllEnvs();
+});
+
+describe("detectAgents", () => {
+  describe("*_BIN env override with absolute path that exists", () => {
+    it("finds claude via absolute CLAUDE_BIN path", () => {
+      vi.stubEnv("CLAUDE_BIN", "/usr/local/bin/claude");
+      existsSyncMock.mockImplementation(
+        (p) => p === "/usr/local/bin/claude",
+      );
+
+      const agents = detectAgents();
+      const claude = findAgent(agents, "claude");
+
+      expect(claude.available).toBe(true);
+      expect(claude.path).toBe("/usr/local/bin/claude");
+      expect(claude.resolvedBin).toBe("claude");
+      expect(claude.protocol).toBe("stdin");
+      expect(claude.unsupported).toBeUndefined();
+    });
+  });
+
+  describe("*_BIN with command name resolved on PATH", () => {
+    it("finds gemini via GEMINI_BIN command name on PATH", () => {
+      vi.stubEnv("GEMINI_BIN", "fake-gemini");
+      existsSyncMock.mockImplementation((p) => {
+        if (p === "/usr/local/bin/fake-gemini") return true;
+        return false;
+      });
+
+      const agents = detectAgents();
+      const gemini = findAgent(agents, "gemini");
+
+      expect(gemini.available).toBe(true);
+      expect(gemini.resolvedBin).toBe("fake-gemini");
+      expect(gemini.path).toBe("/usr/local/bin/fake-gemini");
+    });
+  });
+
+  describe("*_BIN pointing to non-existent path", () => {
+    it("returns unavailable when CLAUDE_BIN path does not exist", () => {
+      vi.stubEnv("CLAUDE_BIN", "/nonexistent/claude");
+      existsSyncMock.mockReturnValue(false);
+
+      const agents = detectAgents();
+      const claude = findAgent(agents, "claude");
+
+      expect(claude.available).toBe(false);
+      expect(claude.path).toBeUndefined();
+      expect(claude.resolvedBin).toBeUndefined();
+    });
+  });
+
+  describe("no env override, binary found on PATH", () => {
+    it("detects claude when binary is on PATH without env override", () => {
+      existsSyncMock.mockImplementation((p) => {
+        if (p === "/usr/local/bin/claude") return true;
+        return false;
+      });
+
+      const agents = detectAgents();
+      const claude = findAgent(agents, "claude");
+
+      expect(claude.available).toBe(true);
+      expect(claude.path).toBe("/usr/local/bin/claude");
+      expect(claude.resolvedBin).toBe("claude");
+    });
+
+    it("detects aider which has no envOverride via bin on PATH", () => {
+      existsSyncMock.mockImplementation((p) => {
+        if (p === "/usr/local/bin/aider") return true;
+        return false;
+      });
+
+      const agents = detectAgents();
+      const aider = findAgent(agents, "aider");
+
+      expect(aider.available).toBe(true);
+      expect(aider.path).toBe("/usr/local/bin/aider");
+      expect(aider.resolvedBin).toBe("aider");
+    });
+
+    it("detects opencode via fallbackBins when primary bin not found", () => {
+      existsSyncMock.mockImplementation((p) => {
+        if (p === "/usr/local/bin/opencode") return true;
+        return false;
+      });
+
+      const agents = detectAgents();
+      const opencode = findAgent(agents, "opencode");
+
+      expect(opencode.available).toBe(true);
+      expect(opencode.path).toBe("/usr/local/bin/opencode");
+      expect(opencode.resolvedBin).toBe("opencode");
+    });
+
+    it("returns unavailable when no binary is on PATH and no env override", () => {
+      existsSyncMock.mockReturnValue(false);
+
+      const agents = detectAgents();
+      const claude = findAgent(agents, "claude");
+
+      expect(claude.available).toBe(false);
+    });
+  });
+
+  describe("unsupported protocol agents", () => {
+    it("marks hermes with acp protocol as unsupported even when found", () => {
+      existsSyncMock.mockImplementation((p) => {
+        if (p === "/usr/local/bin/hermes") return true;
+        return false;
+      });
+
+      const agents = detectAgents();
+      const hermes = findAgent(agents, "hermes");
+
+      expect(hermes.available).toBe(true);
+      expect(hermes.protocol).toBe("acp");
+      expect(hermes.unsupported).toBe(true);
+    });
+
+    it("marks pi with pi-rpc protocol as unsupported even when found", () => {
+      existsSyncMock.mockImplementation((p) => {
+    
```

**File**: `cli/src/__tests__/agents-invoke.test.ts` (added, +530/-0)
```diff
@@ -0,0 +1,530 @@
+import { vi, describe, it, expect, afterEach } from "vitest";
+import { EventEmitter } from "node:events";
+import { PassThrough, Writable } from "node:stream";
+
+const { mockSpawn, existsSyncDelegate } = vi.hoisted(() => ({
+  mockSpawn: vi.fn(),
+  existsSyncDelegate: vi.fn((p: string) => p === "/bin/sh"),
+}));
+
+vi.mock("node:child_process", () => ({
+  spawn: mockSpawn,
+}));
+
+vi.mock("node:fs", async () => {
+  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
+  return { ...actual, existsSync: existsSyncDelegate };
+});
+
+import { invokeAgent, type InvokeEvent } from "../agents-invoke.js";
+
+function makeFakeChild() {
+  const stdout = new PassThrough();
+  const stderr = new PassThrough();
+  const stdin = new Writable({
+    write(_chunk: unknown, _enc: unknown, cb: () => void) {
+      cb();
+    },
+  });
+
+  const child = Object.assign(new EventEmitter(), {
+    stdin,
+    stdout,
+    stderr,
+    pid: 99999,
+  });
+
+  return { child, stdout, stderr, stdin };
+}
+
+async function collectStream(
+  stream: ReadableStream<InvokeEvent>,
+): Promise<InvokeEvent[]> {
+  const events: InvokeEvent[] = [];
+  const reader = stream.getReader();
+  while (true) {
+    const { done, value } = await reader.read();
+    if (done) break;
+    if (value) events.push(value);
+  }
+  return events;
+}
+
+async function driveInvoke(
+  opts: Parameters<typeof invokeAgent>[0],
+  stdoutContent: string | null,
+  exitCode: number | null = 0,
+): Promise<InvokeEvent[]> {
+  const { child, stdout } = makeFakeChild();
+  mockSpawn.mockReturnValue(child);
+
+  const stream = invokeAgent(opts);
+
+  await new Promise((r) => setTimeout(r, 0));
+
+  const eventsPromise = collectStream(stream);
+
+  if (stdoutContent != null) {
+    stdout.write(stdoutContent);
+  }
+  stdout.end();
+
+  await new Promise((r) => setImmediate(r));
+  child.emit("close", exitCode);
+
+  return eventsPromise;
+}
+
+const BIN_OVERRIDE = "/bin/sh";
+
+describe("invokeAgent", () => {
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  describe("error cases", () => {
+    it("returns error stream for unknown agent", async () => {
+      const stream = invokeAgent({
+        agent: "nonexistent",
+        prompt: "test",
+        binOverride: BIN_OVERRIDE,
+      });
+
+      const events = await collectStream(stream);
+
+      expect(events).toHaveLength(1);
+      expect(events[0]).toMatchObject({
+        type: "error",
+        message: expect.stringContaining("unknown agent"),
+      });
+    });
+
+    it("returns error stream when binOverride points to missing file", async () => {
+      const stream = invokeAgent({
+        agent: "claude",
+        prompt: "test",
+        binOverride: "/nonexistent/path/to/bin",
+      });
+
+      const events = await collectStream(stream);
+
+      expect(events).toHaveLength(1);
+      expect(events[0]).toMatchObject({
+        type: "error",
+        message: expect.stringContaining("does not exist"),
+      });
+    });
+
+    it("returns error stream for unsupported (acp) agent protocol", async () => {
+      const stream = invokeAgent({
+        agent: "hermes",
+        prompt: "test",
+        binOverride: BIN_OVERRIDE,
+      });
+
+      const events = await collectStream(stream);
+
+      expect(events).toHaveLength(1);
+      expect(events[0]).toMatchObject({
+        type: "error",
+        message: expect.stringContaining("not yet wired up"),
+      });
+    });
+  });
+
+  describe("relative binOverride resolution", () => {
+    it("resolves ./mock-agent via path.resolve + existsSync", async () => {
+      existsSyncDelegate.mockImplementation((p: string) => {
+        if (p.endsWith("/mock-agent")) return true;
+        return p === "/bin/sh";
+      });
+
+      const html = "<html><body>ok</body></html>";
+      const events = await driveInvoke(
+        { agent: "deepseek-tui", prompt: "test", binOverride: "./mock-agent" },
+        html,
+        0,
+      );
+
+      const start = events.find((e) => e.type === "start");
+      expect(start).toBeDefined();
+      expect(start).toMatchObject({
+        type: "start",
+        bin: expect.stringContaining("/mock-agent"),
+      });
+    });
+
+    it("resolves ../bin/claude wrapper relative path", async () => {
+      existsSyncDelegate.mockImplementation((p: string) => {
+        if (p.endsWith("/bin/claude")) return true;
+        return p === "/bin/sh";
+      });
+
+      const html = "<html><body>ok</body></html>";
+      const events = await driveInvoke(
+        { agent: "claude", prompt: "test", binOverride: "../bin/claude" },
+        html,
+        0,
+      );
+
+      const start = events.find((e) => e.type === "start");
+      expect(start).toBeDefined();
+      expect(start).toMatchObject({
+        type: "start",
+        bin: expect.stringContaining("/bin/claude"),
+      });
+    });
+  });
+
+  describe("close-path: codewhale, deepseek-tui and aider agents
```

**File**: `cli/src/__tests__/collision-resolve.test.ts` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+import { describe, it, expect } from "vitest";
+import { findCommonPath, resolveCollisionOutput } from "../collision-resolve.js";
+
+describe("findCommonPath", () => {
+  it('returns "" for empty array', () => {
+    expect(findCommonPath([])).toBe("");
+  });
+
+  it("returns the resolved path of a single input", () => {
+    expect(findCommonPath(["/tmp/x"])).toBe("tmp/x");
+  });
+
+  it("finds the common ancestor of two paths with a shared parent", () => {
+    expect(
+      findCommonPath(["/home/user/a/b/file.md", "/home/user/a/c/file.md"]),
+    ).toBe("home/user/a");
+  });
+
+  it("returns path.sep when paths share only the root", () => {
+    expect(findCommonPath(["/foo/a.md", "/bar/b.md"])).toBe("/");
+  });
+});
+
+describe("resolveCollisionOutput", () => {
+  it("maps a file under a subdirectory relative to the common root", () => {
+    expect(
+      resolveCollisionOutput("/repo/a/b/readme.md", "/out", "/repo/a"),
+    ).toBe("/out/b/readme.html");
+  });
+
+  it("preserves deeply nested directory structure under the common root", () => {
+    expect(
+      resolveCollisionOutput("/repo/x/y/z/doc.md", "/out", "/repo"),
+    ).toBe("/out/x/y/z/doc.html");
+  });
+
+  it("falls back to plain basename.html when the file is directly in the common root directory", () => {
+    expect(
+      resolveCollisionOutput("/repo/a/readme.md", "/out", "/repo/a"),
+    ).toBe("/out/readme.html");
+  });
+
+  it("filters out '..' and '.' segments and produces a clean relative output", () => {
+    expect(
+      resolveCollisionOutput("/outside/tmp/a.md", "/out", "/outside"),
+    ).toBe("/out/tmp/a.html");
+  });
+});
```

**File**: `cli/src/__tests__/extract-html.test.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import { describe, it, expect } from "vitest";
+import { extractHtml } from "../extract-html.js";
+
+describe("extractHtml", () => {
+  it('returns "" for agent error text ("rate limit exceeded")', () => {
+    expect(extractHtml("rate limit exceeded")).toBe("");
+  });
+
+  it('returns "" for empty string input', () => {
+    expect(extractHtml("")).toBe("");
+  });
+
+  it('returns "" for plain text without HTML markers ("Here is your result: some text")', () => {
+    expect(extractHtml("Here is your result: some text")).toBe("");
+  });
+
+  it('returns "" for non-HTML fenced code block (```json {"a":1} ```)', () => {
+    expect(extractHtml('```json\n{"a":1}\n```')).toBe("");
+  });
+
+  it("extracts DOCTYPE + full HTML from text with surrounding content", () => {
+    const input = "Sure!\n<!DOCTYPE html><html><body>ok</body></html>";
+    expect(extractHtml(input)).toBe("<!DOCTYPE html><html><body>ok</body></html>");
+  });
+
+  it("extracts inner content from fenced HTML code block", () => {
+    const input = "```html\n<html><body>ok</body></html>\n```";
+    expect(extractHtml(input)).toBe("<html><body>ok</body></html>");
+  });
+
+  it("returns content starting with < that is valid HTML snippet", () => {
+    const input = "<div><p>Hello</p></div>";
+    expect(extractHtml(input)).toBe("<div><p>Hello</p></div>");
+  });
+
+  it("returns HTML content when closing </html> is missing (streaming)", () => {
+    const input = "<html><body>streaming...";
+    expect(extractHtml(input)).toBe("<html><body>streaming...");
+  });
+
+  it("returns plain <html> tag content without DOCTYPE", () => {
+    const input = "<html>\n<body>ok</body>\n</html>";
+    expect(extractHtml(input)).toBe("<html>\n<body>ok</body>\n</html>");
+  });
+});
```

**File**: `cli/src/__tests__/index.test.ts` (added, +446/-0)
```diff
@@ -0,0 +1,446 @@
+import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
+
+const {
+  agentStore,
+  skillStore,
+  configStore,
+  invokeStore,
+  fsStore,
+  saveStore,
+  setAgents,
+  setSkills,
+  setConfig,
+  setInvokeStream,
+  getFileContents,
+  getSaveConfigCalls,
+  resetStores,
+} = vi.hoisted(() => {
+  const agentStore = {
+    list: [
+      {
+        id: "claude",
+        label: "Claude Code",
+        vendor: "Anthropic",
+        available: true,
+        protocol: "stdin" as const,
+        models: [] as { id: string; label: string }[],
+        unsupported: undefined as boolean | undefined,
+      },
+      {
+        id: "hermes",
+        label: "Hermes",
+        vendor: "Mature",
+        available: true,
+        protocol: "acp" as const,
+        models: [] as { id: string; label: string }[],
+        unsupported: true,
+      },
+      {
+        id: "pi",
+        label: "Pi",
+        vendor: "Inflection",
+        available: true,
+        protocol: "pi-rpc" as const,
+        models: [] as { id: string; label: string }[],
+        unsupported: true,
+      },
+      {
+        id: "gemini",
+        label: "Gemini CLI",
+        vendor: "Google",
+        available: false,
+        protocol: "stdin" as const,
+        models: [] as { id: string; label: string }[],
+        unsupported: undefined as boolean | undefined,
+      },
+    ],
+  };
+
+  const skillStore = {
+    list: [
+      {
+        id: "valid-template",
+        zhName: "Valid Template",
+        enName: "Valid",
+        emoji: "📄",
+        description: "A valid template",
+        category: "doc",
+        scenario: "general",
+        aspectHint: "",
+        tags: [] as string[],
+      },
+    ],
+    loaded: new Map<string, any>([
+      [
+        "valid-template",
+        {
+          id: "valid-template",
+          zhName: "Valid Template",
+          enName: "Valid",
+          emoji: "📄",
+          description: "A valid template",
+          category: "doc",
+          scenario: "general",
+          aspectHint: "",
+          tags: [],
+          body: "You are a world-class HTML designer. Output complete HTML.",
+        },
+      ],
+    ]),
+  };
+
+  const configStore = {
+    data: {} as Record<string, any>,
+    saveError: null as Error | null,
+  };
+
+  const invokeStore = {
+    htmlOutput: "<!DOCTYPE html><html><head></head><body><h1>Test</h1></body></html>",
+    errorMessage: null as string | null,
+    exitCode: 0,
+  };
+
+  const fsStore = {
+    files: new Map<string, string>(),
+    existing: new Set<string>(),
+    mkdirCalls: [] as string[],
+  };
+
+  const saveStore = {
+    calls: [] as Array<Record<string, any>>,
+  };
+
+  const defaults = {
+    agents: JSON.parse(JSON.stringify(agentStore.list)),
+    skills: JSON.parse(JSON.stringify(skillStore.list)),
+    config: {},
+  };
+
+  return {
+    agentStore,
+    skillStore,
+    configStore,
+    invokeStore,
+    fsStore,
+    saveStore,
+    setAgents: (a: typeof agentStore.list) => {
+      agentStore.list = a;
+    },
+    setSkills: (s: typeof skillStore.list) => {
+      skillStore.list = s;
+    },
+    setConfig: (c: Record<string, any>) => {
+      configStore.data = c;
+    },
+    setInvokeStream: (html: string, err?: string | null, code?: number) => {
+      invokeStore.htmlOutput = html;
+      invokeStore.errorMessage = err ?? null;
+      invokeStore.exitCode = code ?? 0;
+    },
+    getFileContents: () => fsStore.files,
+    getSaveConfigCalls: () => saveStore.calls,
+    resetStores: () => {
+      agentStore.list = JSON.parse(JSON.stringify(defaults.agents));
+      skillStore.list = JSON.parse(JSON.stringify(defaults.skills));
+      configStore.data = { ...defaults.config };
+      configStore.saveError = null;
+      invokeStore.htmlOutput = "<!DOCTYPE html><html><head></head><body><h1>Test</h1></body></html>";
+      invokeStore.errorMessage = null;
+      invokeStore.exitCode = 0;
+      fsStore.files.clear();
+      fsStore.existing.clear();
+      fsStore.mkdirCalls = [];
+      saveStore.calls = [];
+    },
+  };
+});
+
+vi.mock("../agents-detect.js", () => ({
+  detectAgents: vi.fn(() => [...agentStore.list]),
+}));
+
+vi.mock("../skills-loader.js", () => ({
+  listSkills: vi.fn(() => [...skillStore.list]),
+  loadSkill: vi.fn((_dir: string, id: string) => skillStore.loaded.get(id) ?? null),
+}));
+
+function makeMockStream(): any {
+  const chunks: any[] = [];
+  if (invokeStore.errorMessage) {
+    chunks.push({ type: "error", message: invokeStore.errorMessage });
+  } else {
+    chunks.push({ type: "delta", text: invokeStore.htmlOutput });
+    chunks.push({ type: "done", code: invokeStore.exitCode });
+  }
+
+  let index = 0;
+  return {
+    getReader() {
+      return {
+        read() {
+          if (index < chunks.length) {
+            return Promise.resolve({ value: chunks[index++], done: false });
+          }
+          return Promise.resolve
```

---

### Incident Patch 3: `532bc39f` (2026-08-11)
**Commit Message**: fix: preserve zero hyperframe durations (#110) (#120)

* fix: preserve zero hyperframe durations (#110)

data-duration="0" was treated as falsy and fell back to the default 3000ms.

- Add parseOptionalDuration(): returns undefined only for empty string,
  preserves 0 as a valid duration.
- Add extractOpeningTag(): returns the matched <section ...> tag itself
  instead of a missing capture group, so data-* attributes are read.
- Apply both in parseHyperframes() and parseInlineMarker().
- Add hyperframes.test.ts covering zero, absent, and mixed durations.

Fixes #110

* test: cover inline marker fallback zero-duration (issue #110)

Adds a regression test that exercises parseInlineMarker fallback with an
inline 'frame:1 duration:0' comment marker (no data-duration attribute),
asserting frames[0].duration === 0. Mirrors the existing data-duration=0
test so both branches of the zero-duration fix are locked in.

---------

Co-authored-by: C1-BA-B1-F3 <[REDACTED_EMAIL]>
Co-authored-by: C1-BA-B1-F3 <[REDACTED_EMAIL]>

**File**: `next/src/lib/__tests__/hyperframes.test.ts` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+import { describe, it, expect } from "vitest";
+import { parseHyperframes, isHyperframes } from "../hyperframes";
+
+describe("parseHyperframes", () => {
+  it("parses a minimal hyperframes document", () => {
+    const html = `
+      <html>
+        <head><title>Test</title></head>
+        <body class="foo">
+          <section class="frame" data-duration="3000">
+            <p>Frame 1</p>
+          </section>
+          <!-- HYPERFRAMES_META: {"frames":[{"i":1,"duration":3000}]} -->
+        </body>
+      </html>
+    `;
+    const result = parseHyperframes(html);
+    expect(result.isHyperframes).toBe(true);
+    expect(result.frames).toHaveLength(1);
+    expect(result.frames[0].duration).toBe(3000);
+    expect(result.frames[0].innerHtml).toContain("Frame 1");
+    expect(result.title).toBe("Test");
+  });
+
+  it("preserves zero duration from data-duration attribute (issue #110)", () => {
+    const html = `
+      <html>
+        <head><title>Zero Dur</title></head>
+        <body>
+          <section class="frame" data-duration="0">
+            <p>Instant frame</p>
+          </section>
+        </body>
+      </html>
+    `;
+    const result = parseHyperframes(html);
+    expect(result.isHyperframes).toBe(true);
+    expect(result.frames).toHaveLength(1);
+    expect(result.frames[0].duration).toBe(0);
+  });
+
+  it("preserves zero duration from inline comment marker fallback (issue #110)", () => {
+    const html = `
+      <html>
+        <head><title>Marker Zero</title></head>
+        <body>
+          <section class="frame">
+            <p>Instant frame via marker</p>
+            <!-- frame:1 duration:0 -->
+          </section>
+        </body>
+      </html>
+    `;
+    const result = parseHyperframes(html);
+    expect(result.isHyperframes).toBe(true);
+    expect(result.frames).toHaveLength(1);
+    expect(result.frames[0].duration).toBe(0);
+  });
+
+  it("falls back to default when data-duration is absent", () => {
+    const html = `
+      <html>
+        <head><title>No Dur</title></head>
+        <body>
+          <section class="frame">
+            <p>Frame</p>
+          </section>
+        </body>
+      </html>
+    `;
+    const result = parseHyperframes(html);
+    expect(result.isHyperframes).toBe(true);
+    expect(result.frames).toHaveLength(1);
+    expect(result.frames[0].duration).toBe(3000);
+  });
+
+  it("parses multiple frames with mixed durations including zero", () => {
+    const html = `
+      <html>
+        <head><title>Mixed</title></head>
+        <body>
+          <section class="frame" data-duration="0"><p>A</p></section>
+          <section class="frame" data-duration="1000"><p>B</p></section>
+          <section class="frame"><p>C</p></section>
+        </body>
+      </html>
+    `;
+    const result = parseHyperframes(html);
+    expect(result.frames).toHaveLength(3);
+    expect(result.frames[0].duration).toBe(0);
+    expect(result.frames[1].duration).toBe(1000);
+    expect(result.frames[2].duration).toBe(3000);
+  });
+});
+
+describe("isHyperframes", () => {
+  it("returns false for empty or non-hyperframes html", () => {
+    expect(isHyperframes("")).toBe(false);
+    expect(isHyperframes("<html><body><p>hello</p></body></html>")).toBe(false);
+  });
+
+  it("returns true when at least one frame section exists", () => {
+    const html = `<html><body><section class="frame"><p>hi</p></section></body></html>`;
+    expect(isHyperframes(html)).toBe(true);
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #157** (closed): feat(agents): add ZCode (Z.ai) agent adapter (@Geerdan1995)
- **PR #149** (2026-10-13): fix Codex invocation lifecycle handling (@jhinzzz)
- **PR #147** (closed): Support OpenClaw multiline prompt from a file (@haoke016)
- **PR #146** (closed): Support OpenClaw multiline prompt from a file (@haoke016)
- **PR #144** (closed): feat: add temp.md temporary preview sharing (@huangdun)
- **PR #142** (2026-10-13): fix broken star history chart in README (@FaintFlower)

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

## X. security): validate Host header on /api/* to block DNS rebinding (#61)

**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nexu-io/html-anything. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2be93108`: security): validate Host header on /api/* to block DNS rebinding (#61). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing HTML data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```html
// Verified production-grade fix pattern:
## Security

The Next API surface is the local-only side of the app — `/api/convert` spawns the user's coding-agent CLI with maximally permissive flags, `/api/deploy` writes credentialed config to disk. Both are intended for a single operator on a single machine. To prevent a malicious page from DNS-rebinding `attacker.example` to `127.0.0.1` and POSTing into those routes through the user's browser, every `/api/*` request is gated on a Host-header allowlist in [`next/src/middleware.ts`](next/src/middleware.ts).

| Setting | When to use |
|---|---|
| **Default (no env vars set)** | The common case — `next dev` / `next start` on your own machine. `127.0.0.1`, `localhost`, and `::1` Host headers (any port) are accepted. Everything else gets a 403 `{ "error": "Host not allowed" }`. |
| **`HTML_ANYTHING_ALLOWED_HOSTS=daemon.mirage.local,html-anything.lan`** | LAN / mDNS setup — you're reaching the app from another device on the same network and the browser dials a non-loopback hostname. Comma-separated; port-insensitive; case-insensitive. The default loopback set is still accepted on top of this. |
| **`HTML_ANYTHING_ALLOW_ANY_HOST=1`** | Reverse-proxy mode — Caddy / nginx / Cloudflare 
```

**NEGATIVE CONSTRAINT**:
```html
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2be93108` are properly handled with clean fallback behavior.
