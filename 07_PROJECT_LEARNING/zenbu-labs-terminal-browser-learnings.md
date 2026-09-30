# Forensic Learning Record (Deep Inspection): zenbu-labs/terminal-browser

> **Canonical Artifact**: `07_PROJECT_LEARNING/zenbu-labs-terminal-browser-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zenbu-labs/terminal-browser](https://github.com/zenbu-labs/terminal-browser))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:26:10.342Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zenbu-labs/terminal-browser`
- **Description**: A browser inside your terminal
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3546 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `browser/src/assets.ts`
```
import fs from "node:fs";
import path from "node:path";

export function bundledAsset(relative: string): string | null {
  for (let dir = __dirname; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "assets", relative);
    if (fs.existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

```

### Core Architecture Module: `browser/src/daemon.ts`
```
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import { app } from "electron";

// why is this defined in pixel store?
import { DAEMON_SOCKET } from "shared";
import { createSession } from "./session/session";
import type { SessionHandle } from "./session/session";
import { servePages } from "./pages/scheme";

// what
const IDLE_EXIT_MS = 15_000;


interface OpenRequest {
  cmd: "open";
  tty: string;
  argv?: string[];
  env?: Record<string, string | undefined>;
  cwd?: string;
  build?: string;
}

export function buildStamp(): string {
  try {
    return String(Math.floor(fs.statSync(path.join(__dirname, "main.js")).mtimeMs));
  } catch {
    return "unknown";
  }
}

export async function runDaemon(cdpPort: number | null): Promise<void> {
  if (await socketAlive()) {
    process.stderr.write("terminal-browser daemon already running\n");
    app.exit(3);
    return;
  }
  fs.mkdirSync(path.dirname(DAEMON_SOCKET), { recursive: true });
  fs.rmSync(DAEMON_SOCKET, { force: true });

  const build = buildStamp();
  const sessions = new Map<string, SessionHandle>();
  servePages(() => {
    const all = [...sessions.values()];
    const shown = all.filter((open) => open.showsStartPage());
    const chosen = shown[shown.length - 1] ?? all[all.length - 1];
    return chosen?.pageContext() ?? { cwd: process.cwd(), theme: null };
  });
  let seq = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleIdleExit = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (sessions.size === 0) app.exit(0);
    }, IDLE_EXIT_MS);
  };
  scheduleIdleExit();

  const stopEverything = (code: number) => {
    for (const open of [...sessions.values()]) {
      try {
        open.close();
      } catch {}
    }
    sessions.clear();
    setTimeout(() => app.exit(code), 200);
  };
  process.on("SIGINT", () => stopEverything(130));
  process.on("SIGTERM", () => stopEverything(143));

  const server = net.createServer((connection) => {
    let key: string | null = null;
    let session: SessionHandle | null = null;
    const reply = (value: unknown) => {
      try {
        connection.write(`${JSON.stringify(value)}\n`);
      } catch {}
    };

    let buffer = "";
    connection.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
        let message: Omit<OpenRequest, "cmd"> & { cmd: string };
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.cmd === "open" && !session) {
          if (message.build && message.build !== build) {
            reply({ ok: false, error: "stale" });
            connection.end();
            if (sessions.size === 0) app.exit(0);
            return;
          }
          if (!message.tty) {
            reply({ ok: false, error: "no tty" });
            connection.end();
            return;
          }
          if (idleTimer) clearTimeout(idleTimer);
          key = `${process.pid}-${++seq}`;
          const sessionKey = key;
          try {
            session = createSession({
              tty: message.tty,
              key: sessionKey,
              argv: message.argv ?? [],
              env: message.env ?? {},
              cwd: message.cwd ?? process.cwd(),
              cdpPort,
              onClose: (code) => {
                sessions.delete(sessionKey);
                reply({ event: "closed", code });
                connection.end();
                scheduleIdleExit();
              },
            });
          } catch (error) {
            reply({ ok: false, error: String(error) });
            connection.end();
            scheduleIdleExit();
            return;
          }
          sessions.set(sessionKey, session);
          reply({ ok: true, session: sessionKey, pid: process.pid });
        } else if (message.cmd === "resize") {
          session?.nudgeResize();
        } else if (message.cmd === "close") {
          session?.close();
        } else if (message.cmd === "shutdown") {
          reply({ ok: true, sessions: sessions.size });
          connection.end();
          setTimeout(() => app.exit(0), 50);
        }
      }
    });
    connection.on("error", () => {});
    connection.on("close", () => {
      if (key && sessions.has(key)) {
        const orphan = sessions.get(key)!;
        sessions.delete(key);
        orphan.close();
        scheduleIdleExit();
      }
    });
  });
  server.on("error", (error) => {
    process.stderr.write(`terminal-browser daemon socket error: ${error}\n`);
    app.exit(1);
  });
  server.listen(DAEMON_SOCKET);
}

function socketAlive(): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.connect(DAEMON_SOCKET);
    probe.once("connect", () => {
      probe.end();
      resolve(true);
    });
    probe.once("error", () => resolve(false));
  });
}

```

### Core Architecture Module: `browser/src/grab/agents.ts`
```
import fs from "node:fs";

const AGENTS: Record<string, readonly string[]> = {
  claude: ["claude", "claude-code"],
  codex: ["codex", "codex-cli"],
  gemini: ["gemini", "gemini-cli"],
  cursor: ["cursor", "cursor-agent", "agent"],
  opencode: ["opencode", "opencode2", "open-code", "opencode-ai"],
  pi: ["pi", "pi-coding-agent"],
  copilot: ["copilot", "github-copilot", "ghcs"],
  grok: ["grok", "grok-build"],
  amp: ["amp", "amp-local"],
  aider: ["aider", "aider-chat"],
  goose: ["goose"],
  devin: ["devin", "devin-cli"],
  antigravity: ["agy", "antigravity-cli"],
  cline: ["cline"],
  omp: ["omp"],
  mastracode: ["mastracode", "mastra-code"],
  kimi: ["kimi", "kimi-code", "kimi-cli"],
  kiro: ["kiro", "kiro-cli"],
  droid: ["droid", "factory-droid"],
  hermes: ["hermes", "hermes-agent"],
  kilo: ["kilo", "kilo-code"],
  qodercli: ["qodercli", "qoder", "qodercn", "qoderclicn"],
  qwen: ["qwen", "qwen-code"],
  maki: ["maki"],
  muse: ["muse", "muse-code", "muse-cli"],
  auggie: ["auggie"],
  vibe: ["vibe", "vibe-acp"],
};

const PACKAGE_PATHS: readonly [string, string][] = [
  ["node_modules/@anthropic-ai/claude-code", "claude"],
  [".local/share/claude/versions", "claude"],
  ["node_modules/@openai/codex", "codex"],
  ["node_modules/@google/gemini-cli", "gemini"],
  ["node_modules/@earendil-works/pi-coding-agent", "pi"],
  ["node_modules/@mariozechner/pi-coding-agent", "pi"],
  ["node_modules/@qwen-code/qwen-code", "qwen"],
  ["node_modules/mastracode", "mastracode"],
  ["node_modules/opencode-ai", "opencode"],
  ["cursor-agent/versions", "cursor"],
];

const NODE_LIKE = new Set(["node", "nodejs", "bun", "deno", "tsx", "ts-node"]);
const NODE_EVAL_FLAGS = new Set(["-e", "--eval", "-p", "--print", "-c"]);
const NODE_VALUE_FLAGS = new Set([
  "-r", "--require", "--loader", "--import", "--experimental-loader", "--inspect-port",
  "--env-file", "-C", "--conditions", "--title", "-W", "-X", "-S", "-L", "-o",
]);
const PACKAGE_RUNNERS = new Set(["npx", "bunx", "uvx", "pipx"]);
const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "uv"]);
const RUNNER_SUBCOMMANDS = new Set(["run", "dlx", "exec", "x", "tool"]);
const SHELLS = new Set(["sh", "bash", "zsh", "fish", "dash", "ksh"]);
const SUFFIX = /\.(exe|cmd|bat|ps1|js|mjs|cjs|ts|py|rb|sh)$/;

const isPython = (stem: string) => /^python(\d+(\.\d+)*)?$/.test(stem);
const isEnvAssignment = (token: string) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
const unquote = (token: string) => token.replace(/^["']+|["']+$/g, "");

function basename(token: string): string {
  return token.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "";
}

function stem(token: string): string {
  let name = basename(unquote(token)).toLowerCase().replace(SUFFIX, "");
  if (name.startsWith("-")) name = name.slice(1);
  const nix = /^\.(.+)-wrapped$/.exec(name);
  return nix ? nix[1] : name;
}

function agentFromStem(name: string): string | null {
  for (const [agent, aliases] of Object.entries(AGENTS)) {
    if (aliases.includes(name)) return agent;
  }
  if (name.startsWith("grok-")) return "grok";
  if (/^muse-bin-\d/.test(name)) return "muse";
  return null;
}

function agentFromPackagePath(token: string): string | null {
  const normalized = unquote(token).replace(/\\/g, "/").toLowerCase();
  for (const [needle, agent] of PACKAGE_PATHS) {
    if (normalized.includes(`/${needle}/`) || normalized.endsWith(`/${needle}`)) return agent;
  }
  return null;
}

function agentFromPathToken(token: string): string | null {
  const clean = unquote(token);
  if (!clean || clean.startsWith("-")) return null;
  const direct = agentFromStem(stem(clean)) ?? agentFromPackagePath(clean);
  if (direct) return direct;
  if (!/[\\/]/.test(clean)) return null;
  try {
    const real = fs.realpathSync(clean);
    return agentFromStem(stem(real)) ?? agentFromPackagePath(real);
  } catch {
    return null;
  }
}

function positionals(args: readonly string[]): string[] {
  return args.filter((arg) => !arg.startsWith("-"));
}

function agentFromNodeArgs(args: readonly string[]): string | null {
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") {
      rest.push(...args.slice(i + 1));
      break;
    }
    if (NODE_EVAL_FLAGS.has(arg)) return null;
    if (NODE_VALUE_FLAGS.has(arg)) {
      i++;
      continue;
    }
    if (arg.startsWith("-")) continue;
    rest.push(arg);
  }
  for (const token of rest) {
    const found = agentFromPathToken(token) ?? agentFromSegments(token);
    if (found) return found;
  }
  return null;
}

function agentFromSegments(token: string): string | null {
  for (const segment of unquote(token).split(/[\\/]/)) {
    const found = agentFromStem(segment.toLowerCase().replace(SUFFIX, ""));
    if (found) return found;
  }
  return null;
}

function agentFromArgv(argv: readonly string[]): string | null {
  let start = 0;
  while (start < argv.length && isEnvAssignment(argv[start])) start++;
  const launcher = argv[start];
  if (!launcher) return null;
  const args = argv.slice(start + 1);
  const name = stem(launcher);
  const direct = agentFromStem(name) ?? agentFromPackagePath(launcher);
  if (direct) return direct;

  if (name === "env") {
    return agentFromArgv(args.filter((arg) => !arg.startsWith("-")));
  }
  if (name === "tmux") return null;
  if (NODE_LIKE.has(name)) return agentFromNodeArgs(args);
  if (PACKAGE_RUNNERS.has(name)) {
    const [target] = positionals(args);
    return target ? agentFromPathToken(target) ?? agentFromSegments(target) : null;
  }
  if (PACKAGE_MANAGERS.has(name)) {
    const [subcommand, ...rest] = positionals(args);
    if (!subcommand || !RUNNER_SUBCOMMANDS.has(subcommand)) return null;
    const target = rest[0];
    return target ? agentFromPathToken(target) ?? agentFromSegments(target) : null;
  }
  if (isPython(name)) {
    if (args.some((arg) => arg === "-c" || arg === "-m")) return null;
    const [script] = positionals(args);
    return script ? agentFromPathToken(script) : null;
  }
  if (SHELLS.has(name)) {
    if (args.includes("-c")) return null;
    const [script] = positionals(args);
    return script ? agentFromPathToken(script) : null;
  }
  if (name === "cmd") {
    const at = args.findIndex((arg) => /^\/[ck]$/i.test(arg));
    if (at < 0) return null;
    const payload = args.slice(at + 1).filter((token) => !["&", ".", "call"].includes(unquote(token).toLowerCase()));
    return payload[0] ? agentFromPathToken(payload[0]) : null;
  }
  if (name === "powershell" || name === "pwsh") {
    for (let i = 0; i < args.length; i++) {
      const flag = args[i].toLowerCase();
      if (flag === "-encodedcommand" || flag === "-ec") return null;
      if ((flag === "-file" || flag === "-f" || flag === "-command" || flag === "-c") && args[i + 1]) {
        return agentFromPathToken(args[i + 1]);
      }
    }
    return null;
  }
  return null;
}
export function codingAgent(command: string | readonly string[] | null | undefined): string | null {
  if (!command) return null;
  const lines = typeof command === "string" ? command.split("\n") : [command.join(" ")];
  for (const line of lines) {
    const argv = line.trim().split(/\s+/).filter(Boolean);
    const found = agentFromArgv(argv);
    if (found) return found;
  }
  return null;
}

```

### Core Architecture Module: `browser/src/grab/grab.ts`
```
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { WebViewHandle } from "@zenbu-labs/pixel";
import { bundledAsset } from "../assets";

const CHANNEL = "grab";
const PLUGIN = "terminal-browser";
const SCRIPT_ASSET = "react-grab/index.global.js";
const BINDING = "__pixelEmit";

let librarySource: string | null = null;
function reactGrabLibrary(): string {
  if (librarySource) return librarySource;
  const file = bundledAsset(SCRIPT_ASSET);
  if (!file) throw new Error(`react-grab bundle missing: assets/${SCRIPT_ASSET} (run pnpm install)`);
  librarySource = `${fs.readFileSync(file, "utf8")}\n;undefined;`;
  return librarySource;
}

const REGISTER_PLUGIN = `(api) => {
  const emit = (data) => window.${BINDING}?.(JSON.stringify({ channel: ${JSON.stringify(CHANNEL)}, data }));
  const overlay = document.querySelector("[data-react-grab]")?.shadowRoot;
  if (overlay && !overlay.querySelector("#${PLUGIN}-style")) {
    const style = document.createElement("style");
    style.id = "${PLUGIN}-style";
    style.textContent = "[data-react-grab-completion] { display: none !important; }";
    overlay.appendChild(style);
  }
  if (api.getPlugins().includes(${JSON.stringify(PLUGIN)})) return;
  api.registerPlugin({
    name: ${JSON.stringify(PLUGIN)},
    theme: { toolbar: { enabled: false } },
    hooks: {
      onActivate: () => emit({ type: "active", active: true }),
      onDeactivate: () => emit({ type: "active", active: false }),
      transformCopyContent: (content) => {
        emit({ type: "selected", content });
        api.reset();
        api.deactivate();
        return content;
      },
    },
  });
}`;

const COPY_ON_SELECT_BINDING = "__terminalBrowserCopyOnSelect";
const COPY_ON_SELECT_WORLD_ID = 1013;
const COPY_ON_SELECT_WORLD = "terminal-browser-copy-on-select";

const COPY_ON_SELECT_WATCHER = `;(() => {
  let last = "";
  document.addEventListener("mouseup", (e) => {
    if (!e.isTrusted) return;
    setTimeout(() => {
      const sel = window.getSelection && window.getSelection();
      const text = sel ? String(sel).trim() : "";
      if (text && text !== last && typeof window.${COPY_ON_SELECT_BINDING} === "function") {
        last = text;
        window.${COPY_ON_SELECT_BINDING}(text);
      }
    }, 0);
  });
})();`;

let preloadFile: string | null = null;
export function reactGrabPreloadPath(copyOnSelect = false): string {
  if (!preloadFile) {
    const early = `window.__REACT_GRAB_DISABLED__ = true;\n${reactGrabLibrary()}`;
    const copyOnSelectInjection = copyOnSelect
      ? `
  webFrame.setIsolatedWorldInfo(${COPY_ON_SELECT_WORLD_ID}, { name: ${JSON.stringify(COPY_ON_SELECT_WORLD)} });
  void webFrame.executeJavaScriptInIsolatedWorld(${COPY_ON_SELECT_WORLD_ID}, [{ code: ${JSON.stringify(COPY_ON_SELECT_WATCHER)} }]);`
      : "";
    preloadFile = path.join(app.getPath("userData"), "terminal-browser-react-grab-preload.js");
    fs.writeFileSync(
      preloadFile,
      `if (process.isMainFrame) {
  const { webFrame } = require("electron");
  void webFrame.executeJavaScript(${JSON.stringify(early)});${copyOnSelectInjection}
}
`,
    );
  }
  return preloadFile;
}

export class CopyOnSelect {
  private listening = false;
  private readonly onMessage = (_event: unknown, method: string, params: unknown) => {
    if (method !== "Runtime.bindingCalled") return;
    const call = params as { name: string; payload: string };
    if (call.name === COPY_ON_SELECT_BINDING) this.hooks.copied(call.payload);
  };

  constructor(
    private readonly view: WebViewHandle,
    private readonly hooks: { copied(text: string): void },
  ) {}

  async enable(): Promise<void> {
    if (this.listening) return;
    this.listening = true;
    await this.view.cdp("Runtime.addBinding", { name: COPY_ON_SELECT_BINDING, executionContextName: COPY_ON_SELECT_WORLD });
    this.view.webContents.debugger.on("message", this.onMessage);
  }

  dispose(): void {
    if (!this.listening) return;
    this.listening = false;
    try {
      this.view.webContents.debugger.removeListener("message", this.onMessage);
    } catch {}
  }
}

const ACTIVATE_SCRIPT = `(() => {
  const api = (window.__REACT_GRAB__ ??= globalThis.__REACT_GRAB_MODULE__?.init({ telemetry: false }));
  if (!api) return "missing";
  (${REGISTER_PLUGIN})(api);
  api.activate();
  return "active";
})()`;

const DEACTIVATE_SCRIPT = "window.__REACT_GRAB__?.deactivate()";

type GrabMessage =
  | { type: "active"; active: boolean }
  | { type: "selected"; content: string };

export interface GrabHooks {
  selected(content: string): void;
}

export class Grab {
  active = false;
  private readonly onMessage = (_event: unknown, method: string, params: unknown) => {
    if (method === "Page.frameNavigated") {
      const frame = (params as { frame?: { parentId?: string } }).frame;
      if (!frame?.parentId) this.active = false;
      return;
    }
    if (method !== "Runtime.bindingCalled") return;
    const call = params as { name: string; payload: string };
    if (call.name !== BINDING) return;
    try {
      const message = JSON.parse(call.payload) as { channel: string; data: GrabMessage };
      if (message.channel === CHANNEL) this.receive(message.data);
    } catch {}
  };
  private listening = false;

  constructor(
    private readonly view: WebViewHandle,
    private readonly hooks: GrabHooks,
  ) {}

  private async listen(): Promise<void> {
    if (this.listening) return;
    this.listening = true;
    await this.view.cdp("Runtime.addBinding", { name: BINDING });
    this.view.webContents.debugger.on("message", this.onMessage);
  }

  private runJs(source: string): Promise<unknown> {
    return this.view.webContents.executeJavaScript(source, true);
  }

  async activate(): Promise<void> {
    await this.listen();
    const loaded = await this.runJs("Boolean(window.__REACT_GRAB__)");
    if (!loaded) await this.runJs(reactGrabLibrary());
    const result = await this.runJs(ACTIVATE_SCRIPT);
    if (result !== "active") {
      throw new Error("react-grab failed to start");
    }
    this.active = true;
  }

  async deactivate(): Promise<void> {
    this.active = false;
    await this.runJs(DEACTIVATE_SCRIPT).catch(() => {});
  }

  dispose() {
    if (!this.listening) return;
    this.listening = false;
    try {
      this.view.webContents.debugger.removeListener("message", this.onMessage);
    } catch {}
  }

  private receive(message: GrabMessage) {
    if (message.type === "active") {
      if (!message.active) this.active = false;
      return;
    }
    if (message.type === "selected") {
      if (!this.active) return;
      this.active = false;
      this.hooks.selected(message.content);
      void this.deactivate();
    }
  }
}

```

### Core Architecture Module: `browser/src/grab/target.ts`
```
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { shellLiteral } from "@zenbu-labs/pixel/terminal";
import { codingAgent } from "./agents";
import type { Pane, PaneDetails, Terminal } from "@zenbu-labs/pixel/terminal";

const exec = promisify(execFile);

export type TargetTier = "embed" | "parent" | "agent" | "neighbor";

export interface AgentTarget {
  pane: string;
  tier: TargetTier;
  agent: boolean;
}

const CONTROL_BYTES = /[\x00-\x1f\x7f-\x9f]/g;

export function chatMessage(content: string, target: AgentTarget): string {
  const line = `> ${content.replace(CONTROL_BYTES, " ").replace(/\s+/g, " ").trim()}`;
  return target.agent ? `${line}\n\n` : shellLiteral(line);
}

export interface AgentPaneContext {
  terminal: Terminal | null;
  parentTty: string | null;
  cwd: string;
  self(): Promise<Pane | null>;
  embedded?: EmbeddedAgent | null;
}

export interface EmbeddedAgent {
  send(content: string): Promise<boolean>;
}

const EMBED_TARGET: AgentTarget = { pane: "embed", tier: "embed", agent: true };

async function withCommands(panes: PaneDetails[]): Promise<PaneDetails[]> {
  if (!panes.some((pane) => pane.tty && pane.command == null)) return panes;
  let listing = "";
  try {
    listing = (await exec("ps", ["-e", "-o", "tty=,args="])).stdout;
  } catch {
    return panes;
  }
  const byTty = new Map<string, string[]>();
  for (const line of listing.split("\n")) {
    const parts = line.trim().match(/^(\S+)\s+(.*)$/);
    if (!parts || parts[1].startsWith("?")) continue;
    const tty = `/dev/${parts[1]}`;
    byTty.set(tty, [...(byTty.get(tty) ?? []), parts[2]]);
  }
  for (const pane of panes) {
    if (pane.tty && pane.command == null) pane.command = (byTty.get(pane.tty) ?? []).join("\n") || null;
  }
  return panes;
}

const isAgentPane = (pane: PaneDetails): boolean => codingAgent(pane.command) != null;

export class AgentPaneFinder {
  private cached: AgentTarget | null = null;
  private resolving: Promise<AgentTarget | null> | null = null;
  private parent: Promise<Pane | null> | null = null;

  constructor(private readonly ctx: AgentPaneContext) {}

  warm() {
    void this.target();
  }

  async send(content: string): Promise<AgentTarget | null> {
    if (this.ctx.embedded) {
      const taken = await this.ctx.embedded.send(content).catch(() => false);
      if (taken) return EMBED_TARGET;
    }
    const terminal = this.ctx.terminal;
    if (!terminal?.sendText) return null;
    let target = await this.target();
    if (!target) return null;
    try {
      await terminal.sendText(target.pane, chatMessage(content, target));
    } catch {
      this.cached = null;
      target = await this.target();
      if (!target) return null;
      await terminal.sendText(target.pane, chatMessage(content, target));
    }
    await terminal.focusPane?.(target.pane).catch(() => {});
    return target;
  }

  private target(): Promise<AgentTarget | null> {
    if (this.cached) return Promise.resolve(this.cached);
    this.resolving ??= this.resolve()
      .then((target) => {
        this.cached = target;
        return target;
      })
      .finally(() => {
        this.resolving = null;
      });
    return this.resolving;
  }

  private async parentPane(panes: PaneDetails[]): Promise<PaneDetails | null> {
    const tty = this.ctx.parentTty;
    if (!tty || !this.ctx.terminal) return null;
    const listed = panes.find((pane) => pane.tty === tty);
    if (listed) return listed;
    this.parent ??= (
      this.ctx.terminal.getCurrentPane?.({ tty, cwd: this.ctx.cwd }) ?? Promise.resolve(null)
    ).catch(() => null);
    const found = await this.parent;
    if (!found) return null;
    const known = panes.find((pane) => pane.id === found.id);
    const [parent] = await withCommands([{ ...found, tty, command: known?.command ?? null }]);
    return parent;
  }

  private async resolve(): Promise<AgentTarget | null> {
    const terminal = this.ctx.terminal;
    if (!terminal) return null;
    let panes: PaneDetails[] = [];
    try {
      panes = await withCommands(
        (await terminal.listPanes?.({
          commands: (command) => codingAgent(command) != null,
          tty: this.ctx.parentTty,
        })) ?? [],
      );
    } catch {}
    const self = await this.ctx.self();
    const inTab = (pane: Pane) => self == null || pane.tab === self.tab;
    const parent = await this.parentPane(panes);
    if (parent && parent.id !== self?.id && inTab(parent)) {
      if (panes.length === 0 || panes.some((pane) => pane.id === parent.id)) {
        return { pane: parent.id, tier: "parent", agent: isAgentPane(parent) };
      }
    }
    if (!self) return null;
    const neighbours = panes.filter((pane) => pane.id !== self.id && pane.tab === self.tab);
    const agent = neighbours.find(isAgentPane);
    if (agent) return { pane: agent.id, tier: "agent", agent: true };
    if (neighbours.length > 0) return { pane: neighbours[0].id, tier: "neighbor", agent: false };
    return null;
  }
}

```

### Core Architecture Module: `browser/src/main.tsx`
```
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import { app, screen } from "electron";

import { runDaemon } from "./daemon";
import { ConfigStore, LOGS_DIR, SETTINGS_FILE, SHORTCUTS_FILE, ensureDataDir, installedVersion } from "shared";
import { Telemetry } from "./telemetry";
import type { CrashSource } from "./telemetry";
import { appLog } from "@zenbu-labs/pixel";
import { claimProfile } from "./profile";
import { registerScheme } from "./pages/scheme";
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

if (process.env.TERMINAL_BROWSER_DISABLE_GPU === "1") {
  app.commandLine.appendSwitch("disable-gpu");
}
try {
  ensureDataDir();
  fs.mkdirSync(LOGS_DIR, { recursive: true });
} catch {}
app.commandLine.appendSwitch("enable-logging", "file");
app.commandLine.appendSwitch("log-file", path.join(LOGS_DIR, "chromium.log"));
app.setName("terminal-browser");
claimProfile();
registerScheme();

const CRASH_REPORT_EXIT_DEADLINE_MS = 2000;
const crashReports = new Telemetry({
  version: installedVersion() ?? "dev",
  usageEnabled: () => false,
  crashReportsEnabled: () =>
    new ConfigStore({ settings: SETTINGS_FILE, shortcuts: SHORTCUTS_FILE }).load().settings?.["telemetry.crashReports"] !== "off",
  terminal: () => null,
});
function reportAndExit(error: unknown, source: CrashSource) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  const exit = () => app.exit(1);
  const deadline = setTimeout(exit, CRASH_REPORT_EXIT_DEADLINE_MS);
  void crashReports.crashed(error, source).finally(() => {
    clearTimeout(deadline);
    exit();
  });
}
process.on("uncaughtException", (error) => reportAndExit(error, "uncaughtException"));
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`${reason instanceof Error ? reason.stack : String(reason)}\n`);
  void crashReports.crashed(reason, "unhandledRejection");
});


function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("no port assigned"));
      });
    });
  });
}


void (async () => {
  const cdpPort = await freePort().catch(() => null);
  if (cdpPort != null) app.commandLine.appendSwitch("remote-debugging-port", String(cdpPort));
  await app.whenReady();
  appLog(
    "info",
    "scale",
    `chromium reports ${screen
      .getAllDisplays()
      .map((d) => `${d.size.width}x${d.size.height}@${d.scaleFactor}x`)
      .join(", ")}`,
  );
  await runDaemon(cdpPort);
})().catch((error) => reportAndExit(error, "startup"));

```

### Core Architecture Module: `browser/src/pages/markdown.ts`
```
import type { Theme } from "../ui/theme";
import { escape, pageColors } from "./scheme";

// forcing esm
const parser = Promise.all([import("micromark"), import("micromark-extension-gfm")]).then(
  ([{ micromark }, { gfm, gfmHtml }]) =>
    (source: string) => micromark(source, { extensions: [gfm()], htmlExtensions: [gfmHtml()] }),
);

export async function renderMarkdown(source: string, title: string, theme: Theme | null): Promise<string> {
  const body = (await parser)(source);
  const { fg, muted, accent, hairline, field } = pageColors(theme);
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escape(title)}</title>
<style>
  :root { color-scheme: dark light; }
  html, body { margin: 0; background: transparent; color: ${fg}; }
  body { font: 15px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; padding: 32px 40px 64px; max-width: 760px; }
  h1, h2, h3, h4 { line-height: 1.25; margin: 1.6em 0 0.5em; font-weight: 600; }
  h1 { font-size: 1.8em; margin-top: 0; } h2 { font-size: 1.35em; } h3 { font-size: 1.1em; }
  p, ul, ol, pre, table, blockquote { margin: 0 0 1em; }
  a { color: ${accent}; text-decoration: none; } a:hover { text-decoration: underline; }
  code, pre { font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  code { background: ${field}; padding: 0.1em 0.35em; border-radius: 4px; }
  pre { background: ${field}; padding: 12px 14px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { color: ${muted}; border-left: 3px solid ${hairline}; margin-left: 0; padding-left: 14px; }
  hr { border: 0; border-top: 1px solid ${hairline}; margin: 2em 0; }
  table { border-collapse: collapse; } th, td { border: 1px solid ${hairline}; padding: 4px 10px; text-align: left; }
  img { max-width: 100%; }
  ul.contains-task-list { list-style: none; padding-left: 0.5em; }
</style></head>
<body>${body}</body></html>`;
}

```

### Core Architecture Module: `browser/src/pages/scheme.ts`
```
import fs from "node:fs";
import path from "node:path";

import { protocol } from "electron";

import { renderMarkdown } from "./markdown";
import { renderStartPage } from "./start";
import type { Theme } from "../ui/theme";



export const SCHEME = "terminal-browser";
// local file previews get their own scheme without fetch/CORS, so a page opened
// from disk can run its scripts but cannot read other local files
export const DOC_SCHEME = "terminal-browser-file";
export const START_URL = `${SCHEME}://start`;

export interface PageContext {
  cwd: string;
  theme: Theme | null;
}

type Rgba = [number, number, number, number];

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};


export function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
    { scheme: DOC_SCHEME, privileges: { standard: true, secure: true } },
  ]);
}

export function servePages(context: () => PageContext) {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host === "start") return renderStartPage(url, context());
    return new Response("", { status: 404 });
  });
  protocol.handle(DOC_SCHEME, async (request) => {
    const url = new URL(request.url);
    return serveDocument(decodeURIComponent(url.pathname), context().theme);
  });
}

export function documentUrl(file: string): string {
  return `${DOC_SCHEME}://file${file.split(path.sep).map(encodeURIComponent).join("/")}`;
}

// a previewed file may embed remote frames but not other local files, so it
// cannot reach a same-origin local document to read its DOM
const DOC_CSP = "frame-src https: http: data:; object-src 'none'";

async function serveDocument(file: string, theme: Theme | null): Promise<Response> {
  try {
    const stat = await fs.promises.stat(file);
    if (!stat.isFile()) return new Response("", { status: 404 });
    const body = await fs.promises.readFile(file);
    const extension = path.extname(file).toLowerCase();
    const headers: Record<string, string> = { "content-security-policy": DOC_CSP };
    if (extension === ".md" || extension === ".markdown") {
      headers["content-type"] = "text/html; charset=utf-8";
      return new Response(await renderMarkdown(body.toString("utf8"), path.basename(file), theme), { headers });
    }
    headers["content-type"] = CONTENT_TYPES[extension] ?? "application/octet-stream";
    return new Response(body, { headers });
  } catch {
    return new Response("", { status: 404 });
  }
}

export function html(markup: string): Response {
  return new Response(markup, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
}

function css(color: Rgba | undefined, fallback: string): string {
  if (!color) return fallback;
  const [r, g, b, a] = color;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

export function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function pageColors(theme: Theme | null) {
  return {
    fg: css(theme?.fg, "#e6e6e6"),
    muted: css(theme?.muted, "#8a8f98"),
    accent: css(theme?.accent, "#6ea8ff"),
    hairline: css(theme?.hairline, "rgba(255,255,255,0.12)"),
    field: css(theme?.field, "rgba(255,255,255,0.06)"),
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #17** (2026-08-07): **Ghostty backend is chosen for libghostty-embedding terminals (cmux): every osascript call fails with -1728 but is reported as a title/tmux problem**
  *Symptoms*: ## Summary  On a Mac whose terminal is **cmux** (`com.cmuxterm.app`, which embeds libghostty), `detectBackend()` picks the **Ghostty** backend purely from environment variables, and that backend then drives the terminal exclusively through `tell application "Ghostty"`. `Ghostty.app` is not installed here, so every `osascript` call fails with `-1728`. Because `withMarkedPane()` swallows the error in `catch {}`, the user is shown a completely unrelated cause:  ``` $ terminal-browser ls terminal-browser: could not find this pane in Ghostty — something keeps rewriting the /dev/ttysNNN title (busy TUI), or this shell is inside tmux (which drops the title marker unless set-titles is on) ```  Neither is true: there is no tmux in the process tree, and nothing is fighting over the title. `terminal-browser open --split right <url>` fails identically. It took a full source dive to find out that the real error is "the app I am trying to script does not exist".  ## Environment  - terminal-browser **v0.3.3** (the relevant code is unchanged at HEAD / v0.4.1) - macOS (darwin 25.5.0), Apple Silicon - Terminal: **cmux 0.64.17**, bundle id `com.cmuxterm.app`, bundles libghostty (`ghostty --version` → `Ghostty 1.3.2-HEAD-+05c3e29`) - `/Applications/Ghostty.app` does **not** exist; the only running terminal process is `/Applications/cmux.app/Contents/MacOS/cmux`  Environment inherited from cmux:  ``` TERM=xterm-256color TERM_PROGRAM=ghostty TERM_PROGRAM_VERSION=1.3.2-HEAD-+05c3e29 GHOSTTY_RESOURC
  **Post-Mortem & Fix Analysis**:
  > Hit this too, and one detail differs in a way that changes which fix is right.  This report assumes `Ghostty.app` is absent, so every `osascript` call fails with `-1728`. On a machine where **Ghostty.app is installed alongside cmux**, there is no `-1728`:  ``` $ osascript -e 'tell application "Ghostty" to count windows' 1 ```  AppleScript succeeds and returns Ghostty.app's real panes. The cmux pane is just never among them, so `withMarkedPane` exhausts its six attempts and prints the same misleading message. Same symptom, different mechanism.  So suggestion 1 (stop swallowing the `osascript` error) is still worth doing, but it would not have helped here — there is no error to surface. Suggestion 2 is the one that covers both machines: do not treat `GHOSTTY_*` in the environment as proof that Ghostty.app owns the pane.  I took suggestion 3 and opened #23 with a cmux backend. It goes through the `cmux` CLI rather than AppleScript, which sidesteps the title-marker gap you flagged: `cmux t
  > Resolved by https://github.com/zenbu-labs/terminal-browser/pull/26

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

### Incident Patch 1: `aec81269` (2026-09-17)
**Commit Message**: fix readme

**File**: `claude-code-plugin/README.md` (modified, +11/-11)
```diff
@@ -29,17 +29,6 @@ Enable claude code UI plugins by adding this to `~/.claude/settings.json`:
 ```
 
 
-## Updating
-
-Update the claude code plugin:
-```
-claude plugin update terminal-browser@terminal-browser
-```
-
-Update terminal-browser
-```
-terminal-browser upgrade
-```
 
 
 Install the terminal-browser plugin
@@ -53,6 +42,17 @@ claude plugin install terminal-browser@terminal-browser
 
 Now you can run "/browser" inside claude code to open the browser
 
+## Updating
+
+Update the claude code plugin:
+```
+claude plugin update terminal-browser@terminal-browser
+```
+
+Update terminal-browser
+```
+terminal-browser upgrade
+```
 
 ### Configuration
 
```

---

### Incident Patch 2: `606bb566` (2026-09-17)
**Commit Message**: fix build, update readme

**File**: `claude-code-plugin/README.md` (modified, +2/-2)
```diff
@@ -117,15 +117,15 @@ In addition any terminals that are built on libghostty will support this feature
 
 You can find more libghostty based terminals here: [awesome-libghostty](https://github.com/Uzaaft/awesome-libghostty)
 
-Even if your terminal supports the required graphics feature, if you are running a multiplexer, the plugin may not work. This is because multiplexers rewrite the output of terminal programs and breaks terminal graphics commands. tmux support will be arriving soon (terminal-browser currently works in tmux, just not through the claude code plugin yet), and herdr is not yet supported until they implement the kitty graphics placeholders feature. Other multiplexers I have not tested, so if it does not work please file an issue and I will see if we can support this.
+Even if your terminal supports the required graphics feature, if you are running a multiplexer, the plugin may not work. This is because multiplexers rewrite the output of terminal programs and breaks terminal graphics commands. tmux support will be arriving soon (terminal-browser currently works in tmux, just not through the claude code plugin yet), and within herdr performance is very bad when running through the claude code plugin, but will likely improve soon. Other multiplexers I have not tested, so if it does not work please file an issue and I will see if we can support this.
 
 
 
 
 ## Caveats:
 - depends on your terminal supporting the [kitty graphics protocol]
 - cannot render above 50fps while running inside claude code without risk of the terminal UI getting "messed up"
-  - if you still see the screen getting messed up, select the text around that area with your mouse to make the terminal correctly redraw the area
+  - if you still see the screen getting messed up, select the text around that area with your mouse to make the terminal correctly redraw the area, or try resizing the pane till it looks right
 - the mouse position will sometimes be slightly off, since claude code does not enable pixel coordinate mouse reporting
 - the plugin needs to make fetch requests to a local http server to communicate with the terminal-browser CLI, which may cause a prompt to show in your OS that your terminal wants to access the local network
 - claude code sets a very high min width for the chat area, so its sometimes not possible to resize the browser to the size you want
```

**File**: `scripts/release.sh` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ fi
 cp -RL "$NATIVE_PKG" "$STAGE/browser/node_modules/@zenbu-labs/pixel-native-$TARGET"
 if [ -n "$DARWIN_ARCH" ]; then
   cp "$NATIVE_PKG/native-scroll-helper" "$STAGE/bin/native-scroll-helper"
+  rm -f "$STAGE/browser/node_modules/@zenbu-labs/pixel-native-$TARGET/native-scroll-helper"
 fi
 
 AGENT_BROWSER_BIN="$("$ROOT/scripts/agent-browser.sh" --path)"
```

---

### Incident Patch 3: `5fda5e5a` (2026-09-17)
**Commit Message**: Fix heading format and enhance plugin API section

Updated heading format and clarified plugin API usage examples.

**File**: `claude-code-plugin/README.md` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ claude plugin marketplace add zenbu-labs/terminal-browser
 claude plugin install terminal-browser@terminal-browser
 ```
 
-## plugin API
+## Plugin API
 
 The terminal-browser plugin comes with an API you can use within another claude code plugin to programatically open the browser and load a URL. Some examples of useful plugins you can build with this are:
 - a `/tldraw` slash command that opens tldraw in the claude code split pane
```

---

### Incident Patch 4: `6bf72120` (2026-09-17)
**Commit Message**: Fix formatting issue in README.md caveats section

**File**: `claude-code-plugin/README.md` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ Even if your terminal supports the required graphics feature, if you are running
 
 ## Caveats:
 - cannot render above 50fps while running inside claude code without risk of screen tearing (possible screen tearing regardless)
- - if you see the screen slightly getting messed up, select the text around that area with your mouse to make the terminal correctly redraw the area
+  - if you see the screen slightly getting messed up, select the text around that area with your mouse to make the terminal correctly redraw the area
 - cannot enable pixel mouse position reporting, so the mouse position will almost always be slightly off, and in some cases making interacting with some elements not possible
 - the plugin needs to make fetch requests to a local http server to communicate with the terminal-browser CLI, which may cause a prompt to show in your OS that your terminal wants to access the local network
 - claude code sets a very high min width for the chat area, so its sometimes not possible to resize the browser to the size you want
```

---

### Incident Patch 5: `b16b8574` (2026-09-09)
**Commit Message**: fix: align mouse reporting with negotiated coordinates (#105)

**File**: `engine/crates/pixel-core/src/terminal.rs` (modified, +65/-0)
```diff
@@ -397,6 +397,10 @@ impl Terminal {
             terminal.io.out().flush()?;
         }
         terminal.mouse_pixels = !wrapper.relayed() && terminal.probe_mouse_pixels()?;
+        if !terminal.mouse_pixels {
+            terminal.io.out().write_all(b"\x1b[?1016l\x1b[?1006h")?;
+            terminal.io.out().flush()?;
+        }
         terminal.clipboard_data = !wrapper.relayed() && terminal.probe_clipboard_data()?;
         terminal.connect_herdr();
         if terminal.herdr.is_none() && terminal.herdr_target.is_some() {
@@ -2481,6 +2485,67 @@ mod tests {
 mod tty_tests {
     use super::*;
 
+    #[test]
+    fn mouse_coordinates_match_the_negotiated_format() {
+        use std::io::Write as _;
+
+        for (reply, wrapper) in [
+            (Some(b"\x1b[?1016;1$y".as_slice()), Wrapper::None),
+            (Some(b"\x1b[?1016;4$y".as_slice()), Wrapper::None),
+            (None, Wrapper::None),
+            (None, Wrapper::Tmux),
+        ] {
+            let (mut master, _slave, path) = open_pty();
+            let emulator = std::thread::spawn(move || {
+                use std::io::Read as _;
+                let mut seen = Vec::new();
+                let mut pixels = false;
+                let mut byte = [0u8; 1];
+                while master.read_exact(&mut byte).is_ok() {
+                    seen.push(byte[0]);
+                    if seen.ends_with(b"\x1b[?1016h") {
+                        pixels = true;
+                    } else if seen.ends_with(b"\x1b[?1016l")
+                        || seen.ends_with(b"\x1b[?1006h")
+                    {
+                        pixels = false;
+                    } else if seen.ends_with(b"\x1b[?1016$p") {
+                        if let Some(reply) = reply {
+                            master.write_all(reply).unwrap();
+                        }
+                    } else if seen.ends_with(b"\x1b[5n") {
+                        master
+                            .write_all(if pixels {
+                                b"\x1b[<0;485;329M"
+                            } else {
+                                b"\x1b[<0;61;21M"
+                            })
+                            .unwrap();
+                    } else if seen.ends_with(b"\x1b[?1049l") {
+                        break;
+                    }
+                }
+            });
+            let mut term = Terminal::open(&path, wrapper, SessionEnv::of_process()).unwrap();
+            term.cell = Some((8, 16));
+            term.io.out().write_all(b"\x1b[5n").unwrap();
+            term.io.out().flush().unwrap();
+            let event = term.poll_event(Some(Duration::from_millis(500))).unwrap();
+            assert!(
+                matches!(event, Some(Event::Mouse(Mouse {
+                    kind: MouseKind::Down,
+                    button: MouseButton::Left,
+                    x: 484,
+                    y: 328,
+                    ..
+                }))),
+                "the same click must land at (484, 328), reply={reply:?}, wrapper={wrapper:?}: {event:?}"
+            );
+            drop(term);
+            emulator.join().unwrap();
+        }
+    }
+
     /// Returns (master, initial slave fd, slave path). The slave fd stays
     /// open so reads on the master never hit EOF between Terminal lifetimes.
     fn open_pty() -> (std::fs::File, std::fs::File, String) {
```

---

### Incident Patch 6: `a1378a9b` (2026-08-28)
**Commit Message**: fix split merge heuerstic

**File**: `cli/src/main.ts` (modified, +3/-1)
```diff
@@ -593,7 +593,9 @@ async function openCommand(args: string[]) {
   if (positionals.length > 1) {
     fail(`unexpected ${positionals[1]} (one url; --split <direction> opens a new pane)`);
   }
-  if (!noMerge && !args.some((arg) => arg.startsWith("--ssh="))) {
+  const targeted = Boolean(process.env.TERMINAL_BROWSER_INTEROP_TARGET);
+  const wouldSplit = split !== null || !interactiveTty();
+  if (!noMerge && (wouldSplit || targeted) && !args.some((arg) => arg.startsWith("--ssh="))) {
     if (await tryAdopt(args)) return;
   }
   await requireGraphics(await currentTerminal());
```

---

### Incident Patch 7: `2a739b31` (2026-08-21)
**Commit Message**: fix slice

**File**: `cli/src/main.ts` (modified, +2/-2)
```diff
@@ -501,12 +501,12 @@ function takeSshFlags(args: string[]): void {
   if (ssh !== undefined) args.push(`--ssh=${ssh}`);
   const bundle = takeFlag(args, "--ssh-bundle");
   if (bundle !== undefined) args.push(`--ssh-bundle=${bundle}`);
+  const bundleDir = takeFlag(args, "--ssh-bundle-dir");
+  if (bundleDir !== undefined) args.push(`--ssh-bundle-dir=${bundleDir}`);
   const at = args.findIndex((arg) => arg.startsWith("--ssh-bundle="));
   if (at >= 0) {
     args[at] = `--ssh-bundle=${path.resolve(args[at].slice("--ssh-bundle=".length))}`;
   }
-  const bundleDir = takeFlag(args, "--ssh-bundle-dir");
-  if (bundleDir !== undefined) args.push(`--ssh-bundle-dir=${bundleDir}`);
   const target = args.find((arg) => arg.startsWith("--ssh="))?.slice("--ssh=".length);
   if (at >= 0 && !target) fail("--ssh-bundle needs --ssh");
   if (args.some((arg) => arg.startsWith("--ssh-bundle-dir=")) && at < 0) {
```

---

### Incident Patch 8: `b33a3e07` (2026-08-20)
**Commit Message**: fix typo (#47)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ terminal-browser action # an agent-browser compatible cli for interacting with o
 ### Use cases:
 - You can have a coding agent and website scoped to the same terminal tab
 - Your agent has full access to interact with open terminal-browsers, which gives your agent the capability to use the web
-- You can ask an agent to make HTML plans and them open them inside terminal-browser, which will automatically open in a split pane next to your agent
+- You can ask an agent to make HTML plans and then open them inside terminal-browser, which will automatically open in a split pane next to your agent
 - terminal-browser works over SSH, which allows you to preview websites running on remote machines easily
 
 ### Shortcuts
```

---

### Incident Patch 9: `f0e6afff` (2026-08-19)
**Commit Message**: fix: pick available AppArmor ABI for chromium userns profile (#35)

Hardcoding abi/5.0 fails the parser on AppArmor 4.x (Ubuntu 24.04 LTS),
so the profile is never loaded and the sandbox cannot start.

**File**: `scripts/apparmor.sh` (modified, +13/-1)
```diff
@@ -23,7 +23,19 @@ BINARY="$(readlink -f "$BINARY")"
 NAME="terminal-browser-$(printf '%s' "$BINARY" | sha256sum | cut -c1-12)"
 PROFILE="/etc/apparmor.d/$NAME"
 
-WANTED="abi <abi/5.0>,
+# Ubuntu 24.04 ships AppArmor 4.x (abi/4.0 only). Newer releases may have abi/5.0.
+if [ -f /etc/apparmor.d/abi/5.0 ]; then
+  ABI=5.0
+elif [ -f /etc/apparmor.d/abi/4.0 ]; then
+  ABI=4.0
+elif [ -f /etc/apparmor.d/abi/3.0 ]; then
+  ABI=3.0
+else
+  echo "no AppArmor abi under /etc/apparmor.d/abi/ — cannot install profile" >&2
+  exit 1
+fi
+
+WANTED="abi <abi/${ABI}>,
 
 include <tunables/global>
 
```

---

### Incident Patch 10: `0a79797f` (2026-08-18)
**Commit Message**: fix missing window close guards, add quit url so vscode can close itself (#44)

**File**: `browser/src/page/controller.ts` (modified, +9/-0)
```diff
@@ -211,6 +211,7 @@ export class BrowserController {
   }
 
   resize(layout: BrowserSurfaceLayout, options?: { keepFrame?: boolean }) {
+    if (this.stopped) return;
     if (
       this.layout.x === layout.x &&
       this.layout.y === layout.y &&
@@ -517,6 +518,7 @@ export class BrowserController {
   };
 
   setVisible(visible: boolean) {
+    if (this.stopped) return;
     if (this.visible === visible) return;
     this.visible = visible;
     this.popup?.setVisible(visible);
@@ -534,6 +536,7 @@ export class BrowserController {
   }
 
   invalidate(): void {
+    if (this.stopped) return;
     this.wholeSurfaceNext = true;
     this.window.webContents.invalidate();
   }
@@ -563,6 +566,12 @@ export class BrowserController {
     { url, disposition, features }: Electron.HandlerDetails,
     opener: Electron.WebContents,
   ): Electron.WindowOpenHandlerResponse {
+    if (url.startsWith("terminal-browser://quit")) {
+      setImmediate(() => {
+        if (!this.stopped) this.window.close();
+      });
+      return { action: "deny" };
+    }
     const wantsTab = disposition === "foreground-tab" || disposition === "background-tab";
     if (wantsTab && !this.tabsAsPopups && this.onOpenTab) {
       this.onOpenTab(url, disposition === "foreground-tab");
```

#### Recent Merged Pull Requests:
- **PR #131** (2026-09-30): Add telemetry and error reporting (@RobPruzan)
- **PR #130** (2026-09-29): Move pixel to terminal-browser repo (@RobPruzan)
- **PR #127** (2026-09-29): Improve CPU usage by 5x (@RobPruzan)
- **PR #123** (closed): fix(store): keep agent socket dir within the unix socket path budget (@sx4im)
- **PR #117** (2026-09-20): Add settings + shortcuts config files, ui for settings (@RobPruzan)
- **PR #115** (2026-09-19): expose socket for responding to terminal browser actions (@RobPruzan)
- **PR #113** (2026-09-17): Claude code plugin (@RobPruzan)
- **PR #106** (closed): Fix ghostty scripting when multiple windows open (@RobPruzan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
