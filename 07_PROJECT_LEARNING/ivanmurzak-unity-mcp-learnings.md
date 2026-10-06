# Forensic Learning Record (Deep Inspection): IvanMurzak/Unity-MCP

> **Canonical Artifact**: `07_PROJECT_LEARNING/ivanmurzak-unity-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/IvanMurzak/Unity-MCP](https://github.com/IvanMurzak/Unity-MCP))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:29:04.510Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `IvanMurzak/Unity-MCP`
- **Description**: AI Skills, MCP Tools, and CLI for Unity Engine. Full AI develop and test loop. Use cli for quick setup. Efficient token usage, advanced tools. Any C# method may be turned into a tool by a single line. Works with Claude Code, Gemini, Copilot, Cursor and any other absolutely for free.
- **Primary Language / Ecosystem**: C#
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4387 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/src/utils/agents.ts`
```
// Copyright (c) 2024 Ivan Murzak. All rights reserved.
// Licensed under the Apache License, Version 2.0.

/**
 * The AI-agent registry now lives in `@baizor/gamedev-cli-core` (auth-fixes T7 / D1): ONE
 * engine-neutral registry (agent id → config path, body path, format, per-transport prop builders)
 * shared by the three engine CLIs, with the server-entry name + stdio-args vector supplied by the
 * engine adapter. The registry's config WRITERS are the golden-vector-gated `JsonAiAgentConfig` /
 * `TomlAiAgentConfig` (byte-for-byte parity with the C# Editor Configure), reached through
 * cli-core's `setupMcp`.
 *
 * This module re-exports that registry and keeps the two Unity-CLI-local bits cli-core does not own:
 *   - `MCP_SERVER_NAME` — the Unity server-entry name (`ai-game-developer`), from `unityAdapter`.
 *   - `listAgentTable` — the terminal-table renderer used by `setup-mcp --list` / `setup-skills
 *     --list` (a CLI presentation concern, not shared library logic).
 */

import chalk from 'chalk';
import {
  agentRegistry,
  getAgentById,
  getAgentIds,
  unityAdapter,
  type AgentDefinition,
} from '@baizor/gamedev-cli-core';

export { agentRegistry, getAgentById, getAgentIds };
export type { AgentDefinition };

/** The Unity MCP server-entry name written under an agent config's body path. */
const MCP_SERVER_NAME = unityAdapter.serverName;
export { MCP_SERVER_NAME };

// ---------------------------------------------------------------------------
// Terminal table renderer (CLI presentation — not part of the shared library)
// ---------------------------------------------------------------------------

export function listAgentTable(
  heading: string,
  locationLabel: string,
  locationFn: (agent: AgentDefinition) => string,
): void {
  const sorted = [...agentRegistry].sort((a, b) => a.id.localeCompare(b.id));

  const colId = 'ID';
  const colLoc = locationLabel;

  const wId = Math.max(colId.length, ...sorted.map((a) => a.id.length));
  const wLoc = Math.max(colLoc.length, ...sorted.map((a) => locationFn(a).length));

  const sep = chalk.dim;
  const hBar = (w: number) => '─'.repeat(w);

  console.log(`\n${chalk.bold.cyan(heading)}\n`);

  // Header
  console.log(
    sep('  ┌─') + sep(hBar(wId)) + sep('─┬─') + sep(hBar(wLoc)) + sep('─┐'),
  );
  console.log(
    sep('  │ ') + chalk.bold.white(colId.padEnd(wId)) + sep(' │ ') + chalk.bold.white(colLoc.padEnd(wLoc)) + sep(' │'),
  );
  console.log(
    sep('  ├─') + sep(hBar(wId)) + sep('─┼─') + sep(hBar(wLoc)) + sep('─┤'),
  );

  // Rows
  for (const agent of sorted) {
    const loc = locationFn(agent);
    console.log(
      sep('  │ ') + chalk.yellow(agent.id.padEnd(wId)) + sep(' │ ') + chalk.green(loc.padEnd(wLoc)) + sep(' │'),
    );
  }

  // Footer
  console.log(
    sep('  └─') + sep(hBar(wId)) + sep('─┴─') + sep(hBar(wLoc)) + sep('─┘'),
  );
  console.log('');
}

```

### Core Architecture Module: `cli/src/utils/browser.ts`
```
// Copyright (c) 2024 Ivan Murzak. All rights reserved.
// Licensed under the Apache License, Version 2.0.

import { execFile } from 'child_process';
import { verbose } from './ui.js';

/**
 * Open a URL in the user's default browser.
 * Silently ignores errors — the URL is always shown in the terminal as a fallback.
 */
export function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string;
  let args: string[];

  if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }

  verbose(`Opening browser: ${cmd} ${args.join(' ')}`);
  execFile(cmd, args, (err) => {
    if (err) {
      verbose(`Failed to open browser: ${err.message}`);
    }
  });
}

```

### Core Architecture Module: `cli/src/utils/cloud-credentials.ts`
```
// Copyright (c) 2024 Ivan Murzak. All rights reserved.
// Licensed under the Apache License, Version 2.0.

import {
  MachineCredentialProvider,
  MachineCredentialStore,
  MachineCredentialStoreUnreadableError,
  CredentialLockBusyError,
  HttpTokenRefresher,
  LoginRequiredError,
  unityAdapter,
} from '@baizor/gamedev-cli-core';
import { verbose } from './ui.js';
import { CLOUD_SERVER_BASE_URL } from './config.js';

/**
 * The CLI's single seam onto cli-core's `MachineCredentialProvider` (unified-machine-auth 02/04,
 * task d2 / W2). Every Cloud-mode Bearer the CLI presents comes through here — the provider owns
 * proactive refresh (inside the 60 s expiry skew), reactive refresh (driven by a hub 401), the
 * cross-process credential lock, and the family-aware machine-store view. The CLI never reads
 * `accessToken` raw off disk: a raw read returns a token that may be seconds from expiry (or past
 * it) with nobody refreshing, which is exactly the defect this module replaces
 * (the pre-d2 `readMachineStoreCloudToken`).
 */

/** Injectable construction options — tests point the provider at a temp store + a fake AS. */
export interface CloudCredentialProviderOptions {
  /** The credential store to serve from; defaults to the shared per-machine store. */
  store?: MachineCredentialStore;
  /** Authorization-server base for the refresh endpoint; defaults to the hosted cloud. */
  serverBaseUrl?: string;
  /** Injectable `fetch` for the refresher (tests). */
  fetchImpl?: typeof fetch;
}

/**
 * Build a `MachineCredentialProvider` wired the way this CLI consumes it:
 * `HttpTokenRefresher` against the AS root, and `unity-mcp-cli` as the component-default client
 * id — used ONLY for `families.legacy` (a stored family's own `clientId` always wins, 04 §3).
 */
export function createCloudCredentialProvider(
  options: CloudCredentialProviderOptions = {},
): MachineCredentialProvider {
  const store = options.store ?? new MachineCredentialStore();
  const refresher = new HttpTokenRefresher({
    defaultServerBaseUrl: options.serverBaseUrl ?? CLOUD_SERVER_BASE_URL,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  return new MachineCredentialProvider(store, refresher, {
    defaultClientId: unityAdapter.clientId, // unity-mcp-cli
    onWarning: (message) => verbose(`[credential-provider] ${message}`),
    onTelemetry: (event) => verbose(`[credential-provider] ${event.type}: ${event.family} (${event.reason})`),
  });
}

/** Lazy singleton for the default (real per-machine) store — one provider per CLI process. */
let defaultProvider: MachineCredentialProvider | undefined;

function resolveProvider(options?: CloudCredentialProviderOptions): MachineCredentialProvider {
  if (options?.store || options?.serverBaseUrl || options?.fetchImpl) {
    return createCloudCredentialProvider(options);
  }
  defaultProvider ??= createCloudCredentialProvider();
  return defaultProvider;
}

/** TEST-ONLY: drop the cached default provider (e.g. after re-pointing HOME). */
export function resetCloudCredentialProviderForTests(): void {
  defaultProvider = undefined;
}

/**
 * Read a valid plugin-plane access token for a Cloud-mode call, PROACTIVELY refreshing under the
 * cross-process lock when the stored token is within the expiry skew. Returns `undefined` when the
 * machine is effectively not signed in — no credential, a dead family, an unreadable store, or a
 * lock that stayed contended — so callers surface their actionable "not logged in" error instead
 * of issuing a silent unauthenticated request (defect E / D11). The precise reason is logged via
 * `verbose()` (never token bytes).
 */
export async function readCloudAccessToken(
  options?: CloudCredentialProviderOptions,
): Promise<string | undefined> {
  const provider = resolveProvider(options);
  try {
    return await provider.getAccessToken({ family: 'plugin' });
  } catch (err) {
    return degradeToSignedOut(err, 'read');
  }
}

/**
 * REACTIVELY refresh the plugin-plane family now — the hub answered 401 while the local expiry
 * still looked fine (revocation, clock skew). Runs the same locked critical section as the
 * proactive path. Returns the fresh access token, or `undefined` when the family is dead /
 * signed out (the caller falls back to its "not logged in" error).
 */
export async function refreshCloudAccessToken(
  options?: CloudCredentialProviderOptions,
): Promise<string | undefined> {
  const provider = resolveProvider(options);
  try {
    const document = await provider.refresh({ family: 'plugin' });
    return document.accessToken ?? document.families?.plugin?.accessToken ?? undefined;
  } catch (err) {
    return degradeToSignedOut(err, 'refresh');
  }
}

function degradeToSignedOut(err: unknown, operation: string): undefined {
  if (err instanceof LoginRequiredError) {
    verbose(`Cloud credential ${operation}: login required (${err.message})`);
    return undefined;
  }
  if (err instanceof MachineCredentialStoreUnreadableError) {
    verbose(`Cloud credential ${operation}: store unreadable — sign in again to replace it (${err.message})`);
    return undefined;
  }
  if (err instanceof CredentialLockBusyError) {
    verbose(`Cloud credential ${operation}: credential store busy — retry shortly (${err.message})`);
    return undefined;
  }
  throw err;
}

```

### Core Architecture Module: `cli/src/utils/cloud-login.ts`
```
// Copyright (c) 2024 Ivan Murzak. All rights reserved.
// Licensed under the Apache License, Version 2.0.

import * as readline from 'readline/promises';
import * as ui from './ui.js';
import { CLOUD_SERVER_BASE_URL } from './config.js';
import { openBrowser } from './browser.js';
import { MachineCredentialStore } from './machine-credentials.js';
import {
  deviceLogin,
  unityAdapter,
  commitAgentLogin,
  commitToolsOnlyLogin,
  derivePluginFamily,
  HttpTokenExchangeClient,
  DEFAULT_PLUGIN_SCOPE,
  MCP_AGENT_SCOPE,
  type DeviceLoginResult,
  type DeviceLoginOptions,
  type MachineCredentials,
  type RevokeTokenFn,
  type TokenExchangeClient,
} from '@baizor/gamedev-cli-core';

/**
 * The cloud sign-in flow (unified-machine-auth 03 F1/F7/F10, task d2). The device grant
 * (RFC 8628, client_id `unity-mcp-cli`) now mints at **agent scope** (`mcp:agent`) by default and
 * the commit goes through cli-core's login-commit machinery — the two-lock-hold sequence: agent
 * family under the first hold, RFC 8693 token exchange with the lock released, derived plugin
 * family (+ v1 mirror) under the second hold. A failed exchange leaves a valid committed agent
 * family (`partial`) and the derivation alone is retried.
 *
 * `--tools-only` (O10/F10) mints at `mcp:plugin` scope and commits a plugin family ONLY — the
 * store then holds no agent family, so App pickup is impossible by design and the runner appears
 * as its own revocable device group.
 *
 * The D6/F7 account-switch guard runs before ANY write: a subject mismatch prompts
 * (`--yes`-gated); decline revokes the just-minted family (best effort, RFC 7009) and aborts with
 * the store untouched.
 */

/** How many times the F1 `partial` state retries the derivation leg within one login run. */
const DERIVE_RETRY_ATTEMPTS = 3;
/** Base backoff between derivation retries (doubles per attempt). */
const DERIVE_RETRY_BASE_MS = 500;

/** Injection seams so the login flow can be exercised offline in tests without the network. */
export interface RunCloudLoginOptions {
  /** O10/F10: mint `scope=mcp:plugin` and commit a plugin-only store (no agent family). */
  toolsOnly?: boolean;
  /** F7: auto-confirm the account-switch prompt (the `--yes` flag). */
  assumeYes?: boolean;
  /** Authorization-server base; defaults to the hosted `CLOUD_SERVER_BASE_URL`. */
  serverBaseUrl?: string;
  /** The device-login implementation; defaults to cli-core's `deviceLogin`. */
  login?: (options: DeviceLoginOptions) => Promise<DeviceLoginResult>;
  /** The RFC 8693 exchange client; defaults to cli-core's `HttpTokenExchangeClient`. */
  exchangeClient?: TokenExchangeClient;
  /** The D6/F7 confirmation; defaults to an interactive prompt (auto-confirmed by `assumeYes`). */
  confirmAccountSwitch?: (info: {
    storedSubject: string;
    newSubject: string;
  }) => boolean | Promise<boolean>;
  /** Injectable best-effort RFC 7009 revoker (tests). */
  revokeToken?: RevokeTokenFn;
  /** Injectable backoff sleep (tests make it a no-op). */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The D6/F7 account-switch confirmation used when no callback is injected:
 * - `--yes` ⇒ confirmed without prompting (F7 "`--yes`-gated");
 * - interactive TTY ⇒ y/N prompt (default No);
 * - non-interactive without `--yes` ⇒ DECLINED (fail closed) with an actionable hint.
 */
function buildAccountSwitchConfirm(
  assumeYes: boolean,
): (info: { storedSubject: string; newSubject: string }) => Promise<boolean> {
  return async (info) => {
    ui.warn(
      `This machine is currently signed in as "${info.storedSubject}"; you are signing in as "${info.newSubject}".`,
    );
    ui.info('Switching replaces the stored credential and signs the previous account out on this machine.');
    if (assumeYes) {
      ui.info('--yes given: switching accounts.');
      return true;
    }
    if (!process.stdin.isTTY) {
      ui.error('Account switch requires confirmation. Re-run with --yes to switch accounts.');
      return false;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = (await rl.question('Switch this machine to the new account? [y/N] ')).trim();
      return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    } finally {
      rl.close();
    }
  };
}

/** The v2 document's plugin-plane access token (v1 mirror first — it IS the plugin family's). */
function pluginPlaneToken(document: MachineCredentials): string | null {
  return (
    document.accessToken ??
    document.families?.plugin?.accessToken ??
    document.families?.legacy?.accessToken ??
    null
  );
}

/**
 * Retry the F1.4 derivation leg alone (the `partial` state): RFC 8693 exchange → plugin family +
 * v1 mirror under one lock hold. Returns the committed document, or null when every attempt
 * failed or the store changed underneath (aborts are terminal — retrying cannot help).
 */
async function retryDerivePluginFamily(params: {
  store: MachineCredentialStore;
  exchangeClient: TokenExchangeClient;
  agentAccessToken: string;
  expectedSubject: string | undefined;
  serverTarget: string | undefined;
  revokeToken: RevokeTokenFn | undefined;
  sleep: (ms: number) => Promise<void>;
  attempts?: number;
}): Promise<MachineCredentials | null> {
  const attempts = params.attempts ?? DERIVE_RETRY_ATTEMPTS;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await derivePluginFamily({
      store: params.store,
      exchangeClient: params.exchangeClient,
      clientId: unityAdapter.clientId,
      agentAccessToken: params.agentAccessToken,
      ...(params.expectedSubject !== undefined ? { expectedSubject: params.expectedSubject } : {}),
      ...(params.serverTarget !== undefined ? { serverTarget: params.serverTarget } : {}),
      ...(params.revokeToken ? { revokeToken: params.revokeToken } : {}),
      onWarning: ui.warn,
    });
    if (result.status === 'derived') {
      return result.document;
    }
    if (result.status === 'aborted') {
      // Store-missing / subject-changed / store-unreadable: a concurrent flow changed the world;
      // the orphaned derived family was already revoked best-effort by cli-core. Terminal.
      ui.error(`Could not finish authorization: ${result.reason}. Run \`unity-mcp-cli login\` again.`);
      return null;
    }
    ui.warn(`Deriving the tools credential failed (${result.reason}) — attempt ${attempt}/${attempts}.`);
    if (attempt < attempts) {
      await params.sleep(DERIVE_RETRY_BASE_MS * 2 ** (attempt - 1));
    }
  }
  return null;
}

/**
 * Finish a previously interrupted agent login (F1 `partial`: agent family committed, plugin
 * derivation missing) using a FRESH agent access token supplied by the caller. Returns true when
 * the plugin family is committed.
 */
export async function completePluginDerivation(
  store: MachineCredentialStore,
  agentAccessToken: string,
  options: Pick<RunCloudLoginOptions, 'serverBaseUrl' | 'exchangeClient' | 'revokeToken' | 'sleep'> = {},
): Promise<boolean> {
  const serverBaseUrl = options.serverBaseUrl ?? CLOUD_SERVER_BASE_URL;
  const exchangeClient =
    options.exchangeClient ?? new HttpTokenExchangeClient({ defaultServerBaseUrl: serverBaseUrl });
  const stored = safeRead(store);
  const document = await retryDerivePluginFamily({
    store,
    exchangeClient,
    agentAccessToken,
    expectedSubject: stored?.subject,
    serverTarget: stored?.serverTarget,
    revokeToken: options.revokeToken,
    sleep: options.sleep ?? defaultSleep,
  });
  if (document) {
    ui.success('Authorization completed: tools credential derived.');
    return true;
  }
  return false;
}

function safeRead(store: MachineCredentialStore): MachineCredentials | null {
  try {
    return store.read();
  } catch {
    return null;
  }
}

/**
 * Run the cloud device-auth flow: initiate, display the user code + verification URL, open the
 * browser, poll, then commit through cli-core's login-commit machinery (two-lock-hold agent
 * commit + exchange-derived plugin family, or the tools-only plugin commit — never a raw
 * `store.write`).
 *
 * Returns the plugin-plane access token on success, or null on failure (errors are printed).
 */
export async function runCloudLogin(
  store: MachineCredentialStore,
  options: RunCloudLoginOptions = {},
): Promise<string | null> {
  const serverBaseUrl = options.serverBaseUrl ?? CLOUD_SERVER_BASE_URL;
  const login = options.login ?? deviceLogin;
  const sleep = options.sleep ?? defaultSleep;
  let spinner: ReturnType<typeof ui.startSpinner> | undefined;

  try {
    const result = await login({
      serverBaseUrl,
      clientId: unityAdapter.clientId, // unity-mcp-cli
      // Agent scope by default (03 §F1); plugin scope only for --tools-only (O10/F10).
      scope: options.toolsOnly ? DEFAULT_PLUGIN_SCOPE : MCP_AGENT_SCOPE,
      onUserCode: (userCode, verificationUri) => {
        ui.info('Open this URL to authorize:');
        console.log();
        console.log(`  ${verificationUri}`);
        console.log();
        ui.label('Code', userCode);
      },
      onPolling: () => {
        spinner = ui.startSpinner('Waiting for authorization...');
      },
      openBrowser,
    });

    if (!result.ok) {
      spinner?.stop();
      ui.error(result.message);
      return null;
    }
    spinner?.success('Authorized');

    const confirmAccountSwitch =
      options.confirmAccountSwitch ?? buildAccountSwitchConfirm(options.assumeYes ?? false);

    if (options.toolsOnly) {
      const commit = await commitToolsOnlyLogin({
        store,
        clientId: unityAdapter.clientId,
        credentials: result.credentials,
        confirmAccountSwitch,
        ...(options.revokeToken ? { revokeToken: options.revokeToken } : {}),
        onWarning: ui.warn,
      });
      switch (commit.status) {
        case 'committed':
 
```

### Core Architecture Module: `cli/src/utils/config.ts`
```
import * as fs from 'fs';
import * as path from 'path';
import { generatePortFromDirectory } from './port.js';

const CONFIG_RELATIVE_PATH = 'UserSettings/AI-Game-Developer-Config.json';

export interface McpFeature {
  name: string;
  enabled: boolean;
}

export interface UnityConnectionConfig {
  host?: string;
  token?: string;
  keepConnected?: boolean;
  logLevel?: number;
  timeoutMs?: number;
  keepServerRunning?: boolean;
  transportMethod?: string;
  authOption?: string;
  connectionMode?: string | number;
  cloudToken?: string;
  tools?: McpFeature[];
  prompts?: McpFeature[];
  resources?: McpFeature[];
  [key: string]: unknown;
}

function getConfigPath(projectPath: string): string {
  return path.join(projectPath, CONFIG_RELATIVE_PATH);
}

/**
 * Create a default config for a Unity project.
 */
export function createDefaultConfig(projectPath: string): UnityConnectionConfig {
  const port = generatePortFromDirectory(projectPath);
  return {
    host: `http://localhost:${port}`,
    keepConnected: false,
    logLevel: 3,
    timeoutMs: 10000,
    keepServerRunning: false,
    transportMethod: 'streamableHttp',
    authOption: 'none',
    connectionMode: 'Custom',
    tools: [],
    prompts: [],
    resources: [],
  };
}

/**
 * Read the AI-Game-Developer-Config.json from a Unity project.
 * Returns null if the file doesn't exist.
 */
export function readConfig(projectPath: string): UnityConnectionConfig | null {
  const configPath = getConfigPath(projectPath);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const json = fs.readFileSync(configPath, 'utf-8');
  try {
    return JSON.parse(json) as UnityConnectionConfig;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new SyntaxError(`Malformed JSON in config file: ${configPath}\n${err.message}`);
    }
    throw err;
  }
}

/**
 * Write the AI-Game-Developer-Config.json to a Unity project.
 * Creates the UserSettings directory if needed.
 */
export function writeConfig(projectPath: string, config: UnityConnectionConfig): void {
  const configPath = getConfigPath(projectPath);
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Read config or create with defaults if it doesn't exist.
 */
export function getOrCreateConfig(projectPath: string): UnityConnectionConfig {
  if (fs.existsSync(getConfigPath(projectPath))) {
    return readConfig(projectPath) as UnityConnectionConfig;
  }

  const config = createDefaultConfig(projectPath);
  writeConfig(projectPath, config);
  return config;
}

/**
 * Update features (tools, prompts, or resources) in the config.
 * - enableNames: set these to enabled=true
 * - disableNames: set these to enabled=false
 * - enableAll/disableAll: override all features
 */
export function updateFeatures(
  config: UnityConnectionConfig,
  featureType: 'tools' | 'prompts' | 'resources',
  options: {
    enableNames?: string[];
    disableNames?: string[];
    enableAll?: boolean;
    disableAll?: boolean;
  }
): void {
  const rawFeatures = config[featureType];
  const features: McpFeature[] = Array.isArray(rawFeatures)
    ? rawFeatures.filter(
        (f): f is McpFeature =>
          typeof f === 'object' && f !== null && typeof f.name === 'string' && typeof f.enabled === 'boolean'
      )
    : [];

  if (options.enableAll) {
    for (const f of features) f.enabled = true;
    config[featureType] = features;
    return;
  }

  if (options.disableAll) {
    for (const f of features) f.enabled = false;
    config[featureType] = features;
    return;
  }

  if (options.enableNames) {
    for (const name of options.enableNames) {
      const existing = features.find((f) => f.name === name);
      if (existing) {
        existing.enabled = true;
      } else {
        features.push({ name, enabled: true });
      }
    }
  }

  if (options.disableNames) {
    for (const name of options.disableNames) {
      const existing = features.find((f) => f.name === name);
      if (existing) {
        existing.enabled = false;
      } else {
        features.push({ name, enabled: false });
      }
    }
  }

  config[featureType] = features;
}

/**
 * Determine whether the config is in Cloud mode.
 * Handles both string ("Cloud") and legacy integer (1) representations
 * of the ConnectionMode enum.
 */
export function isCloudMode(config: UnityConnectionConfig): boolean {
  const mode = config.connectionMode;
  return mode === 'Cloud' || mode === 1;
}

export const CLOUD_SERVER_BASE_URL = 'https://ai-game.dev';
export const CLOUD_SERVER_URL = 'https://ai-game.dev/mcp';

/** Options for {@link resolveConnectionFromConfig}. */
export interface ResolveConnectionFromConfigOptions {
  /**
   * Supplies the Cloud-mode Bearer credential. REQUIRED (no built-in default): the production
   * value is `readCloudAccessToken` from `cloud-credentials.ts` — cli-core's
   * `MachineCredentialProvider`, which proactively refreshes an expiring token under the
   * cross-process lock (unified-machine-auth 04 §3). A raw on-disk `accessToken` read must never
   * reappear here: it returns a token nobody refreshes (the pre-d2 defect). Tests inject a
   * deterministic value; sync or async both work.
   */
  readCloudToken: () => Promise<string | undefined> | string | undefined;
}

/**
 * Resolve the server URL and auth token from a project config based on connectionMode.
 * - Custom mode (string "Custom" or integer 0): uses `host` and `token` (self-host / derived-port).
 * - Cloud mode (string "Cloud" or integer 1): uses the hardcoded cloud URL and the Bearer credential
 *   supplied by `options.readCloudToken` (production: the shared machine credential store via
 *   cli-core's refreshing `MachineCredentialProvider`) — NOT the on-disk `cloudToken`, which the
 *   plugin stopped writing post-T9 (defect E / D11).
 * In Custom mode, `url` and `token` may be undefined if the corresponding config fields are not set.
 * In Cloud mode, `url` is always the hardcoded cloud URL, while `token` is the provided credential and
 * is `undefined` when the user is not logged in — the caller surfaces an actionable "not logged in"
 * error rather than issuing a silent unauthenticated request.
 */
export async function resolveConnectionFromConfig(
  config: UnityConnectionConfig,
  options: ResolveConnectionFromConfigOptions,
): Promise<{
  url: string | undefined;
  token: string | undefined;
}> {
  if (isCloudMode(config)) {
    return { url: CLOUD_SERVER_URL, token: await options.readCloudToken() };
  }

  return { url: config.host, token: config.token };
}

```

### Core Architecture Module: `cli/src/utils/connection.ts`
```
import * as fs from 'fs';
import * as path from 'path';
import { verbose } from './ui.js';
import { generatePortFromDirectory } from './port.js';
import { readConfig, resolveConnectionFromConfig, isCloudMode } from './config.js';
import { readCloudAccessToken } from './cloud-credentials.js';
import * as ui from './ui.js';

export interface ConnectionOptions {
  path?: string;
  url?: string;
  token?: string;
}

/**
 * Returns true if the given directory looks like a Unity project (has an Assets subfolder).
 */
export function isUnityProject(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'Assets'));
}

/**
 * Resolve the project path from positional arg, --path option, or cwd.
 */
export function resolveProjectPath(positionalPath: string | undefined, options: ConnectionOptions): string {
  const resolved = path.resolve(positionalPath ?? options.path ?? process.cwd());
  if ((positionalPath !== undefined || options.path !== undefined) && !fs.existsSync(resolved)) {
    ui.error(`Project path does not exist: ${resolved}`);
    process.exit(1);
  }
  return resolved;
}

/**
 * Resolve the project path and validate it is a Unity project.
 * Skips validation when --url is provided (explicit server override).
 */
export function resolveAndValidateProjectPath(positionalPath: string | undefined, options: ConnectionOptions): string {
  const resolved = resolveProjectPath(positionalPath, options);

  // Skip Unity project validation when --url is explicitly provided
  if (options.url) {
    return resolved;
  }

  if (!isUnityProject(resolved)) {
    ui.error(`Not a Unity project (missing Assets folder): ${resolved}`);
    ui.info('Provide a Unity project path as an argument, or use --url to connect to a server directly.');
    process.exit(1);
  }

  return resolved;
}

/**
 * Resolve the server URL and auth token.
 *
 * URL priority:
 *   1. --url flag (explicit override)
 *   2. Config file connectionMode → Custom: host, Cloud: hardcoded cloud URL
 *   3. Deterministic port from project path
 *
 * Token priority:
 *   1. --token flag (explicit override)
 *   2. Config file token (Custom mode) / shared machine credential store (Cloud mode)
 */
export interface ResolveConnectionDeps {
  /**
   * Injection point for the Cloud-mode machine-store credential read. Forwarded to
   * `resolveConnectionFromConfig`; defaults to `readCloudAccessToken` — cli-core's
   * `MachineCredentialProvider` (proactive refresh under the cross-process lock, never a raw
   * on-disk read). Tests inject a deterministic value.
   */
  readCloudToken?: () => Promise<string | undefined> | string | undefined;
}

export async function resolveConnection(
  projectPath: string,
  options: ConnectionOptions,
  deps: ResolveConnectionDeps = {},
): Promise<{
  url: string;
  token: string | undefined;
  cloudAuthMissing: boolean;
  /** True when the Bearer came from the shared machine store (Cloud mode, no --token override). */
  tokenFromCloudStore: boolean;
}> {
  const config = readConfig(projectPath);
  const fromConfig = config
    ? await resolveConnectionFromConfig(config, {
        readCloudToken: deps.readCloudToken ?? readCloudAccessToken,
      })
    : { url: undefined, token: undefined };

  verbose(`Config loaded: connectionMode=${config?.connectionMode ?? 'N/A'}, configUrl=${fromConfig.url ?? 'N/A'}, hasToken=${!!fromConfig.token}`);

  let url: string;
  let usingCloudUrl = false;
  if (options.url) {
    url = options.url.replace(/\/$/, '');
    verbose(`Using explicit --url: ${url}`);
  } else if (fromConfig.url) {
    url = fromConfig.url.replace(/\/$/, '');
    usingCloudUrl = !!config && isCloudMode(config);
    verbose(`Using URL from config (${config?.connectionMode} mode): ${url}`);
  } else {
    const port = generatePortFromDirectory(projectPath);
    url = `http://localhost:${port}`;
    verbose(`Using deterministic port URL: ${url}`);
  }

  const token = options.token ?? fromConfig.token;
  if (options.token) {
    verbose('Using explicit --token');
  }

  // Cloud mode resolves its Bearer from the shared machine credential store (see
  // resolveConnectionFromConfig). When the store holds no credential AND the caller overrode
  // neither the endpoint (--url) nor the token (--token), the request would go out unauthenticated —
  // signal this so the run-tool command surfaces an actionable "not logged in" error instead of a
  // silent unauthenticated cloud call (defect E / D11).
  const cloudAuthMissing = usingCloudUrl && !token;
  const tokenFromCloudStore = usingCloudUrl && !options.token && !!token;

  return { url, token, cloudAuthMissing, tokenFromCloudStore };
}

```

### Core Architecture Module: `cli/src/utils/editor-cache.ts`
```
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { verbose } from './ui.js';

const CACHE_FILE = join(homedir(), '.unity-mcp-cli-editor-cache.json');

// Storage key for the version-less "highest installed" lookup.
// Underscored to stay out of the Unity-version namespace (e.g. `6000.3.1f1`).
const AUTO_KEY = '__auto__';

interface CacheEntry {
  path: string;
  savedAt: number;
}

interface EditorCache {
  [versionKey: string]: CacheEntry;
}

function keyFor(version: string | undefined): string {
  return version ?? AUTO_KEY;
}

function readAll(): EditorCache {
  try {
    const raw = readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const safe: EditorCache = Object.create(null) as EditorCache;
      for (const k of Object.keys(parsed as object)) {
        safe[k] = (parsed as EditorCache)[k];
      }
      return safe;
    }
  } catch {
    // Missing or corrupt — treat as empty cache.
  }
  return Object.create(null) as EditorCache;
}

function writeAll(cache: EditorCache): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Best-effort: a read-only home dir or full disk should never break `open`.
  }
}

/**
 * Look up a previously-resolved editor binary path for the given
 * Unity version (or `undefined` to look up the "auto / highest" slot).
 * Returns null when no entry exists OR when the cached path no longer
 * exists on disk — in the latter case the stale entry is dropped
 * automatically so subsequent reads don't waste a stat call.
 */
export function readCachedEditorPath(version: string | undefined): string | null {
  const cache = readAll();
  const k = keyFor(version);
  const entry = cache[k];
  if (!entry || typeof entry.path !== 'string') return null;
  if (!existsSync(entry.path)) {
    verbose(`editor-cache: stale entry for ${k} -> ${entry.path} (file missing), evicting`);
    delete cache[k];
    writeAll(cache);
    return null;
  }
  verbose(`editor-cache: hit ${k} -> ${entry.path}`);
  return entry.path;
}

/** Save the resolved editor path under the given version key. */
export function writeCachedEditorPath(version: string | undefined, editorPath: string): void {
  const cache = readAll();
  const k = keyFor(version);
  cache[k] = { path: editorPath, savedAt: Date.now() };
  writeAll(cache);
  verbose(`editor-cache: stored ${k} -> ${editorPath}`);
}

/**
 * Drop the cache entry for the given version. Called when a cached
 * path turned out to be unusable (e.g. spawn failed) so the next
 * invocation re-runs the full resolution.
 */
export function clearCachedEditorPath(version: string | undefined): void {
  const cache = readAll();
  const k = keyFor(version);
  if (cache[k] === undefined) return;
  delete cache[k];
  writeAll(cache);
  verbose(`editor-cache: cleared ${k}`);
}

```

### Core Architecture Module: `cli/src/utils/enroll.ts`
```
// Copyright (c) 2024 Ivan Murzak. All rights reserved.
// Licensed under the Apache License, Version 2.0.

/**
 * Agent-driven enrollment now lives in `@baizor/gamedev-cli-core` (auth-fixes T3/T7): ONE engine-
 * agnostic `enroll` flow — redeem a one-time code, plant the plugin credential in the SHARED machine
 * store, record the AS-root server target in the committable project marker (MED-2), and upsert the
 * `/p/<pin>` routing segment into existing project-local agent configs.
 *
 * Two things changed vs. the old Unity-CLI-local port:
 *   - The pin is derived with **v2** identity (`derivePinV2`, the `\`→`/` normalization). This
 *     REPLACES the Unity CLI's local `projectRootForIdentity` `\`→`/` workaround — one algorithm for
 *     every engine, so a Windows `path.resolve` backslash root matches the plugin's forward-slash
 *     hash. `projectRootForIdentity` is therefore gone.
 *   - `runEnroll` takes an `adapter` (pass `unityAdapter`); it records the AS root via
 *     `adapter.loginServerTarget`, never a pinned hub URL.
 */

export {
  redeemEnrollmentCode,
  normalizeRedeemResponse,
  resolveEnrollCode,
  upsertProjectPinIntoConfigs,
  runEnroll,
  EnrollmentError,
  pinUrl,
} from '@baizor/gamedev-cli-core';

export type {
  RedeemedCredential,
  RedeemOptions,
  RunEnrollOptions,
  RunEnrollResult,
  PinUpsertResult,
} from '@baizor/gamedev-cli-core';

```

### Core Architecture Module: `cli/src/utils/extensions-catalog.ts`
```
// The CLI's typed mirror of the SHARED extension catalogue — the single source of
// truth `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/extensions.catalog.json`
// (see that file's sibling `extensions.catalog.md`).
//
// There are THREE artifacts holding this same list, and all three are kept in
// lockstep by build-failing parity tests:
//
//   1. `extensions.catalog.json`        — the JSON source of truth, shipped in the UPM package.
//   2. `MainWindowEditor._extensions`   — the C# array that drives the editor's Extensions
//                                         section and `ExtensionPanel.AddToManifest`.
//   3. `EXTENSIONS_CATALOG` (this file) — drives `installExtension` in this CLI.
//
// SINGLE SOURCE OF TRUTH: this constant MUST stay equivalent to the JSON. The parity
// test `cli/tests/extensions-catalog-parity.test.ts` reads the JSON and FAILS the build
// if this mirror drifts; `cli/tests/extensions-catalog-csharp-parity.test.ts` does the
// same for the C# array. Adding an extension = appending an entry to the JSON, the C#
// array, AND this array (both tests enforce it). This mirror exists so the published npm
// package stays self-contained — no runtime `../Unity-MCP-Plugin` dependency.
//
// No top-level side effects; pure data + pure lookups only.

/** One tool a catalogue extension contributes — mirrors the JSON `tools[]` entry. */
export interface ExtensionTool {
  readonly name: string;
  readonly description: string;
}

/**
 * One installable extension — the CLI analog of the C# `ExtensionPanel.ExtensionData`.
 * `packageId` is the INSTALL IDENTITY (the `Packages/manifest.json` dependency key,
 * resolved from the OpenUPM scoped registry).
 * `version` is `null` for a floating (unpinned) reference — every catalogue entry is
 * unpinned, so OpenUPM's `dist-tags.latest` is resolved live at install time.
 *
 * `tools` is the same CURATED highlight list the editor renders in an extension's
 * tooltip (`ExtensionPanel.BuildTooltip`) — it is deliberately NOT an exhaustive
 * inventory of the extension's MCP tools, and must not be consumed as one.
 */
export interface ExtensionDescriptor {
  readonly name: string;
  readonly description: string;
  readonly packageId: string;
  readonly version: string | null;
  readonly gitUrl: string | null;
  readonly tools: readonly ExtensionTool[];
}

/**
 * The extension catalogue, single-sourced from
 * `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/extensions.catalog.json`.
 * Ten shipped extensions; `Unity-AI-Tools-Template` is a template and is excluded.
 */
export const EXTENSIONS_CATALOG: readonly ExtensionDescriptor[] = [
  {
    name: 'Animation',
    description: 'AI-driven animation control and playback tools.',
    packageId: 'com.ivanmurzak.unity.mcp.animation',
    version: null,
    gitUrl: 'https://github.com/IvanMurzak/Unity-AI-Animation.git',
    tools: [
      { name: 'animation-create', description: 'Create AnimationClip assets with keyframes' },
      { name: 'animation-get-data', description: 'Inspect clip curves, events, and properties' },
      { name: 'animation-modify', description: 'Edit curves, events, and settings on a clip' },
      { name: 'animator-create', description: 'Create AnimatorController assets' },
      { name: 'animator-get-data', description: 'Inspect controller layers, states, and parameters' },
      { name: 'animator-modify', description: 'Edit parameters, states, and transitions' },
    ],
  },
  {
    name: 'Cinemachine',
    description: 'AI-assisted Cinemachine camera setup and configuration tools.',
    packageId: 'com.ivanmurzak.unity.mcp.cinemachine',
    version: null,
    gitUrl: 'https://github.com/IvanMurzak/Unity-AI-Cinemachine.git',
    tools: [
      { name: 'cinemachine-camera-create', description: 'Create a CinemachineCamera in the scene' },
      { name: 'cinemachine-set-targets', description: 'Set the Follow and LookAt targets' },
      { name: 'cinemachine-set-lens', description: 'Configure FOV, clip planes, and dutch' },
      { name: 'cinemachine-set-body', description: 'Set the position-control component (Follow/Orbital/...)' },
      { name: 'cinemachine-set-noise', description: 'Add camera shake via Perlin noise' },
    ],
  },
  {
    name: 'InputSystem',
    description:
      'AI-assisted Unity Input System authoring: InputActionAssets, maps, actions, bindings, and control schemes.',
    packageId: 'com.ivanmurzak.unity.mcp.inputsystem',
    version: null,
    gitUrl: 'https://github.com/IvanMurzak/Unity-AI-InputSystem.git',
    tools: [
      { name: 'inputsystem-asset-create', description: 'Create a new .inputactions InputActionAsset' },
      { name: 'inputsystem-actionmap-add', description: 'Add an ActionMap to the asset' },
      { name: 'inputsystem-action-add', description: 'Add an Action (type + expectedControlType)' },
      { name: 'inputsystem-binding-add', description: 'Add a binding path to an Action' },
      { name: 'inputsystem-binding-composite-add', description: 'Add a composite binding (2DVector/1DAxis)' },
      { name: 'inputsystem-controlscheme-add', description: 'Add a control scheme with device requirements' },
      { name: 'inputsystem-get', description: "Read the asset's maps, actions, and bindings" },
    ],
  },
  {
    name: 'Navigation',
    description: 'AI-driven NavMesh navigation: surfaces, baking, agents, and links.',
    packageId: 'com.ivanmurzak.unity.mcp.navigation',
    version: null,
    gitUrl: 'https://github.com/IvanMurzak/Unity-AI-Navigation.git',
    tools: [
      { name: 'navigation-surface-add', description: 'Add and configure a NavMeshSurface' },
      { name: 'navigation-set-bake-settings', description: 'Set agent radius/height/slope/step and voxel size' },
      { name: 'navigation-surface-bake', description: 'Bake or clear a NavMeshSurface' },
      { name: 'navigation-modifier-add', description: 'Add a NavMeshModifier (override area / ignore)' },
      { name: 'navigation-modifier-volume-add', description: 'Add a NavMeshModifierVolume' },
      { name: 'navigation-link-add', description: 'Add a NavMeshLink between two points' },
      { name: 'navigation-agent-add', description: 'Add and configure a NavMeshAgent' },
      { name: 'navigation-agent-set-destination', description: "Set a NavMeshAgent's destination" },
      { name: 'navigation-list', description: 'List NavMeshSurfaces and NavMeshAgents' },
      { name: 'navigation-get', description: 'Serialize any NavMesh component' },
      { name: 'navigation-modify', description: 'Modify any NavMesh component via ReflectorNet' },
    ],
  },
  {
    name: 'ParticleSystem',
    description: 'AI-powered particle system creation and control tools.',
    packageId: 'com.ivanmurzak.unity.mcp.particlesystem',
    version: null,
    gitUrl: 'https://github.com/IvanMurzak/Unity-AI-ParticleSystem.git',
    tools: [
      { name: 'particle-system-get', description: 'Inspect ParticleSystem modules and settings' },
      { name: 'particle-system-modify', description: 'Modify emission, shape, color, noise, and more' },
    ],
  },
  {
    name: 'ProBuilder',
    description: 'AI-assisted ProBuilder geometry modeling tools.',
    packageId: 'com.ivanmurzak.unity.mcp.probuilder',
    version: null,
    gitUrl: 'https://github.com/IvanMurzak/Unity-AI-ProBuilder.git',
    tools: [
      { name: 'probuilder-create-shape', description: 'Create editable 3D primitives in the scene' },
      { name: 'probuilder-get-mesh-info', description: 'Retrieve faces, vertices, and edges data' },
      { name: 'probuilder-extrude', description: 'Extrude faces along their normals' },
      { name: 'probuilder-delete-faces', description: 'Remove faces to create holes or trim geometry' },
      { name: 'probuilder-set-face-material', description: 'Assign materials to individual faces' },
    ],
  },
  {
    name: 'Splines',
    description: 'AI-assisted Spline authoring: containers, knots, tangents, and evaluation.',
    packageId: 'com.ivanmurzak.unity.mcp.splines',
    version: null,
    gitUrl: 'https://github.com/IvanMurzak/Unity-AI-Splines.git',
    tools: [
      { name: 'splines-container-create', description: 'Create a SplineContainer in the scene' },
      { name: 'splines-add-knot', description: 'Append a knot to a spline' },
      { name: 'splines-set-knot', description: "Set a knot's position, tangents, and rotation" },
      { name: 'splines-set-tangent-mode', description: "Set a knot's tangent mode" },
      { name: 'splines-evaluate', description: 'Evaluate position/tangent/up along a spline' },
      { name: 'splines-modify', description: 'Modify any Splines component via ReflectorNet' },
    ],
  },
  {
    name: 'Terrain',
    description: 'AI-powered Unity Terrain authoring tools.',
    packageId: 'com.ivanmurzak.unity.mcp.terrain',
    version: null,
    gitUrl: 'https://github.com/IvanMurzak/Unity-AI-Terrain.git',
    tools: [
      { name: 'terrain-create', description: 'Create a Terrain GameObject backed by new TerrainData' },
      { name: 'terrain-set-heights', description: 'Sculpt heightmap values over a region or the whole terrain' },
      { name: 'terrain-paint-layer', description: 'Paint a TerrainLayer onto the alphamap (splatmap)' },
      { name: 'terrain-place-trees', description: 'Scatter or place trees from a tree prototype' },
      { name: 'terrain-set-neighbors', description: 'Stitch neighbor Terrains so Unity blends seams' },
    ],
  },
  {
    name: 'Tilemap',
    description: 'AI-assisted 2D Tilemap creation, painting, and tile/RuleTile asset tools.',
    packageId: 'com.ivanmurzak.unity.mcp.tilemap',
    version: null,
    gitUrl: 'https://github.com/IvanMurzak/Unity-AI-Tilemap.git',
    tools: [
      { name: 'tilemap-create', description: 'Create a Grid + Tilemap + TilemapRenderer' },
      { name: 'tilemap-set-tile', description: 'Paint a tile into a cell' },
      { name: 'tilemap-box-fill', description: 'Fill a rectangular region with a tile' },
      { n
```

### Core Architecture Module: `cli/src/utils/input.ts`
```
import * as fs from 'fs';
import * as path from 'path';
import * as ui from './ui.js';
import { verbose } from './ui.js';
import { parseJsonStrict, JsonParseError } from './json-parse.js';

export interface InputOptions {
  input?: string;
  inputFile?: string;
}

/**
 * Parse tool input from --input, --input-file, or stdin.
 *
 * - `--input-file -` or `--input-file /dev/stdin` reads from stdin (cross-platform).
 * - `--input-file <path>` reads from a file.
 * - `--input <json>` parses inline JSON.
 * - Falls back to `{}` if nothing provided.
 */
export function parseInput(options: InputOptions): string {
  if (options.inputFile) {
    const isStdin = options.inputFile === '-' || options.inputFile === '/dev/stdin';
    let content: string;

    if (isStdin) {
      verbose('Reading input from stdin...');
      try {
        content = fs.readFileSync(0, 'utf-8');
      } catch {
        ui.error('Failed to read from stdin.');
        process.exit(1);
      }
      if (!content.trim()) {
        ui.error('No input received from stdin.');
        process.exit(1);
      }
    } else {
      const filePath = path.resolve(options.inputFile);
      if (!fs.existsSync(filePath)) {
        ui.error(`Input file does not exist: ${filePath}`);
        process.exit(1);
      }
      content = fs.readFileSync(filePath, 'utf-8');
    }

    try {
      parseJsonStrict(content);
    } catch (err) {
      const source = isStdin ? 'stdin' : options.inputFile;
      if (err instanceof JsonParseError) {
        ui.error(`--input-file content from '${source}' must be valid JSON\n${err.message}`);
      } else {
        ui.error(`--input-file content from '${source}' must be valid JSON`);
      }
      process.exit(1);
    }

    return content;
  }

  if (options.input) {
    try {
      const result = parseJsonStrict(options.input);
      return result.raw;
    } catch (err) {
      if (err instanceof JsonParseError) {
        ui.error(`--input must be valid JSON\n${err.message}`);
      } else {
        ui.error('--input must be valid JSON');
      }
      process.exit(1);
    }
  }

  return '{}';
}

```

### Core Architecture Module: `cli/src/utils/json-parse.ts`
```
/**
 * Robust JSON parsing with auto-stringify fallback and detailed error reporting.
 *
 * 1. Try to parse the raw string as JSON.
 * 2. If that fails, wrap it in quotes (stringify) and try again.
 * 3. If still invalid, report the exact position where parsing fails.
 */
export interface JsonParseResult {
  readonly value: unknown;
  readonly raw: string;
  readonly wasStringified: boolean;
}

export class JsonParseError extends Error {
  readonly position: number;
  readonly snippet: string;

  constructor(message: string, position: number, snippet: string) {
    super(message);
    this.name = 'JsonParseError';
    this.position = position;
    this.snippet = snippet;
  }
}

/**
 * Extract the error position from a JSON.parse SyntaxError message.
 * Common formats:
 *   - "... at position 42"           (V8 / Node)
 *   - "... at line 3 column 5"       (some engines)
 *   - "Unexpected token X in JSON at position 42"
 */
function extractErrorPosition(error: SyntaxError, input: string): number {
  const msg = error.message;

  const posMatch = msg.match(/position\s+(\d+)/i);
  if (posMatch) {
    return parseInt(posMatch[1], 10);
  }

  const lineColMatch = msg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch) {
    const targetLine = parseInt(lineColMatch[1], 10);
    const targetCol = parseInt(lineColMatch[2], 10);
    const lines = input.split('\n');
    let offset = 0;
    for (let i = 0; i < targetLine - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }
    return offset + targetCol - 1;
  }

  return -1;
}

/**
 * Build a human-readable snippet around the error position.
 */
function buildSnippet(input: string, position: number): string {
  if (position < 0 || position > input.length) {
    return input.length <= 80 ? input : input.slice(0, 80) + '...';
  }

  const contextBefore = 20;
  const contextAfter = 20;

  const start = Math.max(0, position - contextBefore);
  const end = Math.min(input.length, position + contextAfter);

  const before = (start > 0 ? '...' : '') + input.slice(start, position);
  const errorChar = position < input.length ? input[position] : '<end>';
  const after = input.slice(position + 1, end) + (end < input.length ? '...' : '');

  const pointer = ' '.repeat(before.length) + '^';

  return `${before}${errorChar}${after}\n${pointer}`;
}

/**
 * Build a detailed error message for a JSON parse failure.
 */
function buildDetailedError(input: string, error: SyntaxError): JsonParseError {
  const position = extractErrorPosition(error, input);
  const snippet = buildSnippet(input, position);

  const posInfo = position >= 0 ? ` at position ${position}` : '';
  const message =
    `Invalid JSON${posInfo}: ${error.message}\n\n` +
    `  ${snippet.split('\n').join('\n  ')}\n`;

  return new JsonParseError(message, position, snippet);
}

/**
 * Parse a string as strict JSON. Throws {@link JsonParseError} with
 * position and snippet on failure.
 *
 * @param input  The raw string to parse as JSON.
 * @returns      A result containing the parsed value.
 * @throws       {@link JsonParseError} with position and snippet on failure.
 */
export function parseJsonStrict(input: string): JsonParseResult {
  try {
    const value = JSON.parse(input);
    return { value, raw: input, wasStringified: false };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw buildDetailedError(input, error);
    }
    throw error;
  }
}

/**
 * Parse a string as JSON with auto-stringify fallback.
 * If the input is not valid JSON, it wraps the raw string via
 * `JSON.stringify` so it becomes a valid JSON string literal.
 * Check {@link JsonParseResult.wasStringified} to detect this case.
 *
 * @param input  The raw string to parse as JSON.
 * @returns      A result containing the parsed value (never throws).
 */
export function parseJsonRobust(input: string): JsonParseResult {
  try {
    const value = JSON.parse(input);
    return { value, raw: input, wasStringified: false };
  } catch {
    const stringified = JSON.stringify(input);
    const value = JSON.parse(stringified);
    return { value, raw: stringified, wasStringified: true };
  }
}

```

### Core Architecture Module: `cli/src/utils/launch-error-dismiss.ts`
```
import { execFile, execFileSync } from 'child_process';
import { platform as nodePlatform } from 'os';
import { verbose } from './ui.js';

/**
 * Supported `process.platform` values for the launch-errors dialog
 * dismiss helper. Narrowed alias of NodeJS.Platform — keeps the
 * platform-dispatch table exhaustive in tests without forcing callers
 * to import a Node-internal type.
 */
export type DismissPlatform = 'win32' | 'darwin' | 'linux';

/**
 * Outcome of a single dismiss attempt against the running OS desktop.
 *
 * `dismissed`: the dialog was found AND a click was dispatched
 * successfully. The polling loop should stop and return.
 *
 * `not-found`: no matching dialog was visible on this poll tick. The
 * polling loop should continue ticking until either the overall
 * timeout elapses or Unity reports ready (the existing wait-for-ready
 * logic, which runs in parallel, is the authoritative ready signal).
 *
 * `error`: an unexpected platform error happened (a required tool was
 * missing, a syscall failed). The polling loop logs the error once
 * and continues with `not-found` semantics — the dialog may simply
 * not be open yet, and a single transient error must not abort the
 * whole launch flow.
 */
export type DismissOutcome =
  | { kind: 'dismissed'; button: string }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

/**
 * Window-title fragments matched against the Unity launch-errors
 * dialog. Both legacy and current strings are listed so the matcher
 * stays resilient across Unity versions. The match is case-insensitive
 * and substring-based — Unity's actual title varies by version but
 * always contains one of these.
 *
 * Exposed so tests can assert the matcher knows about both spellings
 * without grepping the implementation.
 */
export const LAUNCH_ERROR_DIALOG_TITLE_FRAGMENTS: readonly string[] = [
  'Safe Mode', // Unity 2020.2+ ("Enter Safe Mode?") — the launch-errors dialog on every modern Unity (2022 LTS, 6000.x)
  'Compiler Errors', // Unity 2020+ ("Hold On" + "Compiler Errors on Launch")
  'Hold On', // Generic Unity progress dialog wrapping the launch-errors variant
  'Compile Errors', // Older Unity dialog spelling
  'Scripts have compiler errors', // Unity 2022+ on Linux (window manager surfacing)
] as const;

/** The button label this helper presses to dismiss the dialog. */
export const DISMISS_BUTTON_LABEL = 'Ignore';

/**
 * Producer-side prefixes for error messages that callers treat as
 * permanent (the polling loop bails out instead of ticking again).
 *
 * Exported so the bailout matcher in `lib/open.ts` and the
 * error-construction sites below reference the SAME literal — a
 * future re-word lands in both places at once.
 *
 * The matcher in `lib/open.ts` uses `String.includes`, so each
 * constant just needs to be a stable substring of the full message.
 */
export const LINUX_XDOTOOL_MISSING_PREFIX =
  'xdotool not found on PATH';

export const UNSUPPORTED_PLATFORM_PREFIX =
  'Unsupported platform for launch-errors auto-dismiss';

/**
 * Try once to find and dismiss the Unity launch-errors dialog on the
 * current OS desktop. Pure-ish — performs a single OS call and
 * returns; never blocks past the underlying syscall's own timeout.
 *
 * Library-safe: never throws (errors are returned in the
 * `DismissOutcome` union), never writes to stdout/stderr, never
 * mutates global state.
 *
 * The helper is platform-dispatched:
 * - **Windows**: Win32 (`FindWindowW` / `EnumWindows` /
 *   `EnumChildWindows` / `GetWindowTextW` / `SendMessageW(BM_CLICK)`)
 *   driven from PowerShell so we do not pull in a native node-gyp
 *   dependency. UI Automation is the documented fallback if title
 *   matching breaks on a future Unity release.
 * - **macOS**: AppleScript via `osascript` (the leaner
 *   AX-C-API-direct path is a documented follow-up). Requires the
 *   user to have granted Accessibility permission to the terminal /
 *   `unity-mcp-cli` binary once.
 * - **Linux/X11**: `xdotool` (documented as a Linux platform
 *   dependency; `wmctrl` is acceptable as an alternative window
 *   enumerator). Wayland is deferred — call out explicitly in the
 *   error message so the user does not waste time debugging.
 */
export async function tryDismissLaunchErrorsDialog(
  platform: DismissPlatform = nodePlatform() as DismissPlatform,
): Promise<DismissOutcome> {
  switch (platform) {
    case 'win32':
      return tryDismissWindows();
    case 'darwin':
      return tryDismissMacOS();
    case 'linux':
      return tryDismissLinuxX11();
    default:
      return {
        kind: 'error',
        message: `${UNSUPPORTED_PLATFORM_PREFIX}: ${platform as string}`,
      };
  }
}

// ---------------------------------------------------------------------------
// Windows — Win32 via PowerShell
// ---------------------------------------------------------------------------

/**
 * The PowerShell payload that probes for the Unity launch-errors
 * dialog and clicks `Ignore` if found. Exported as a string (not a
 * function) so tests can assert the script shape without launching
 * PowerShell.
 *
 * Strategy:
 *   1. P/Invoke `EnumWindows` via Add-Type to enumerate every visible
 *      top-level window owned by `Unity.exe`.
 *   2. Filter by title fragment (case-insensitive substring).
 *   3. Walk child windows with `EnumChildWindows`, looking for a
 *      Button whose text equals `Ignore`.
 *   4. Send `BM_CLICK` (0x00F5) to the matched button. `BM_CLICK` is
 *      preferred over a synthesised mouse event — it works even if
 *      the user is mid-click in another app, and it does not steal
 *      focus.
 *
 * The script writes a single-token result to stdout:
 *   - `dismissed:<button>` on success
 *   - `not-found` when no dialog was matched
 *   - `error:<message>` on an unexpected exception
 */
export const WINDOWS_DISMISS_PS_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  if (-not ([System.Management.Automation.PSTypeName]'UnityMcp.LaunchErrors.Dismisser').Type) {
    Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
namespace UnityMcp.LaunchErrors {
  public static class Dismisser {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassNameW(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr SendMessageW(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    const uint BM_CLICK = 0x00F5;
    static readonly string[] TitleFragments = new[] { ${LAUNCH_ERROR_DIALOG_TITLE_FRAGMENTS.map((f) => JSON.stringify(f)).join(', ')} };
    static readonly string[] ButtonLabels = new[] { "${DISMISS_BUTTON_LABEL}", "&${DISMISS_BUTTON_LABEL}" };
    public static string TryDismiss(int[] unityPids) {
      var unityPidSet = new HashSet<uint>();
      for (int i = 0; i < unityPids.Length; i++) unityPidSet.Add((uint)unityPids[i]);
      IntPtr matchedDialog = IntPtr.Zero;
      var sb = new StringBuilder(512);
      EnumWindows((hWnd, lParam) => {
        if (!IsWindowVisible(hWnd)) return true;
        uint procId; GetWindowThreadProcessId(hWnd, out procId);
        if (!unityPidSet.Contains(procId)) return true;
        sb.Length = 0;
        GetWindowTextW(hWnd, sb, sb.Capacity);
        var text = sb.ToString();
        foreach (var frag in TitleFragments) {
          if (text.IndexOf(frag, StringComparison.OrdinalIgnoreCase) >= 0) {
            matchedDialog = hWnd;
            return false;
          }
        }
        return true;
      }, IntPtr.Zero);
      if (matchedDialog == IntPtr.Zero) return "not-found";
      IntPtr matchedButton = IntPtr.Zero;
      EnumChildWindows(matchedDialog, (hWnd, lParam) => {
        sb.Length = 0;
        GetClassNameW(hWnd, sb, sb.Capacity);
        if (sb.ToString() != "Button") return true;
        sb.Length = 0;
        GetWindowTextW(hWnd, sb, sb.Capacity);
        var text = sb.ToString();
        foreach (var label in ButtonLabels) {
          if (string.Equals(text, label, StringComparison.OrdinalIgnoreCase)) {
            matchedButton = hWnd;
            return false;
          }
        }
        return true;
      }, IntPtr.Zero);
      if (matchedButton == IntPtr.Zero) return "not-found";
      SendMessageW(matchedButton, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
      return "dismissed:${DISMISS_BUTTON_LABEL}";
    }
  }
}
"@
  }
  $unityPids = @(Get-Process -Name 'Unity' -ErrorAction SilentlyContinue | ForEach-Object { [int]$_.Id })
  if ($unityPids.Count -eq 0) { Write-Output 'not-found'; return }
  Write-Output ([UnityMcp.LaunchErrors.Dismisser]::TryDismiss([int[]]$unityPids))
} catch {
  Write-Output ('error:' + $_.Exception.Message)
}
`;

async function tryDismissWindows(): Promise<DismissOutcome> {
  return new Promise<DismissOutcome>((resolve) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_DISMISS_PS_SCRIPT],
      { timeout: 5000, windowsHide: true },
      (err, stdout) => {
        if (err) {
          // ETIMEDOUT, ENOENT (powershell missing), etc. Treat as transient.
          verbose(
            `tryDismissWindows: powershell invocation failed (${err.message}) — treating as not-found`,
          );
          resolve({ kind: 'error', message: err.message })
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #963** (2026-08-24): **Update TestResultCollector.cs**
  *Symptoms*: 

- **Issue #945** (2026-08-25): **tests-run returns "after 10 retries" error while tests actually run — retry budget (~10s) is shorter than the domain reload it must survive (16-20s)**
  *Symptoms*: ## Summary  `tests-run` frequently returns `isError: true` with  ``` Invoke 'RunCallTool': Failed to invoke 'com.IvanMurzak.McpPlugin.Common.Model.RequestCallTool' after 10 retries. ```  while the tests **actually run to completion in Unity**. The AI agent sees a failure, retries, and the tests run a second time — or worse, the agent reports the tool as broken.  Root cause: entering the EditMode test context triggers a Unity **domain reload**, which drops the plugin's SignalR connection to the server for **16–20 seconds**. `RemoteToolRunner` retries only **10× at 1s intervals (~10s)** before giving up. The retry budget is roughly half the length of the outage it exists to absorb.  This is distinct from #863 (that one hangs forever via a PlayerPrefs-wiped request id; this one returns an error quickly and the results are simply discarded).  ## Environment  - `com.ivanmurzak.unity.mcp@a63fd9aa01d6` - MCP server `gamedev-mcp-server.exe` 9.2.4.0 - Unity 6000.3.5f1, Windows 11, stdio transport - Client: claude-code 2.1.220  ## Evidence  Measured from `Library/mcp-server/win-x64/logs/server-log_01.txt` over one ~50 minute session.  **Every `tests-run` triggers a disconnect 2–5s later** (7 of 10 calls; the other 3 landed while already disconnected):  | `tests-run` call | disconnect after | |---|---| | 19:19:51 | +4.5s | | 19:37:38 | +4.3s | | 19:46:54 | +3.0s | | 19:47:56 | +2.0s | | 19:48:25 | +21.9s | | 19:49:02 | +49.2s | | 19:49:49 | +2.2s |  **Reconnect takes 16–20s** (15 outage
  **Post-Mortem & Fix Analysis**:
  > Hi @kvasanova , thanks for sharing. It was the time period with an issue with authorization system. I assume the problem is resolved. Going to close the issue. But please let me know if you have the problem - I will re-open it back.

- **Issue #892** (2026-07-21): **new "generated configuration" for mcp server breaks custom connections from claude and codex**
  *Symptoms*: The new generated config for mcp on a local custom setup breaks the mcp connection to the server. in the config it adds an api path to the end of the server(i.e./p/randomcharsandnumbers) This results in a response: 404 (POST /p/randomcharsandnumbers) inside the unity console. As soon as I removed that portion from both mcp connections the connection was restored. I am using version 0.84.0 freshly updated about 20 minutes ago and unity 6.5
  **Post-Mortem & Fix Analysis**:
  > Me too, but in my case, "Reconfigure" button, destroy oauth header too and can't start mpc, I needed to put authentication none for work and delete: /p/randomcharsandnumbers
  > Sorry for the problems, it is already fixed in the latest update `0.86.0`.   ## Follow these steps 1. Install it Unity-MCP update to `0.86.0` or newer 2. Authorize in Unity "AI Game Developer" window 3. Configure Claude / Codex / ____  4. Start Claude / Codex / ____ 5. Authorize in Claude / Codex / ____ using the command `/mcp` and then follow the instructions on your screen.  **✅ Connection is established**

- **Issue #873** (2026-07-12): **Prevent overlapping Unity test runs**
  *Symptoms*: ## Summary  Prevents overlapping `tests-run` calls from overwriting the active MCP request id while a Unity test run is already in progress.  ## Root cause  `tests-run` stored the active request id in a single static/PlayerPrefs-backed value. When two clients invoked the tool concurrently, the second call replaced the first request id. When Unity finished the test run, `RunFinished` completed only the latest request id, leaving the original caller waiting until its MCP-side timeout.  ## Changes  - Adds single-flight tracking helpers for active Unity test runs. - Returns an immediate tool error when another `tests-run` call is already active. - Clears the active request id only when the finishing request matches it. - Adds a stale-lock lease so a Unity crash or lost callback does not block future test runs forever. - Adds editor tests for request-id preservation, guarded cleanup, and stale-lock recovery.  ## Stale-lock behavior  The active test-run marker now stores a UTC start timestamp in PlayerPrefs. If Unity restarts after a crash, or no callback ever clears the marker, a future `tests-run` call treats the marker as stale after the configured MCP timeout plus one minute, with a 10-minute minimum lease. That keeps normal long-running tests from being preempted accidentally while avoiding a permanent PlayerPrefs lock.  ## Validation  Ran Unity editmode tests locally:  ```powershell powershell -NoProfile -ExecutionPolicy Bypass -File commands\run-unity-tests.ps1 -UnityPath "C

- **Issue #870** (2026-07-21): **Fix tests-run state being wiped by PlayerPrefs.DeleteAll**
  *Symptoms*: Fixes #863.\n\n## Summary\n- Moves the 	ests-run pending request id and response option state from PlayerPrefs to editor SessionState.\n- Keeps the state alive across domain reloads while preventing project/test code that calls PlayerPrefs.DeleteAll() from wiping the routing id mid-run.\n- Logs an explicit error if a completed/deferred test run cannot be routed because the request id is missing.\n\n## Testing\n- git diff --check\n- Not run: Unity editor tests / local compile because Unity and dotnet are not available in this environment.
  **Post-Mortem & Fix Analysis**:
  > Hi @Abhinav-0311, thanks for the contribution.  Could you please explain, why is it needed for?  PlayerPrefs survives domain reload already.
  > You’re right that PlayerPrefs survives domain reload. The reason for this change is different: tests can legitimately call PlayerPrefs.DeleteAll() during SetUp/TearDown to clean game state.  In that case the test run starts normally and the request id is stored, but while the run is in flight the user test deletes all PlayerPrefs. When RunFinished later reads TestCallRequestID, it is empty, so NotifyToolRequestCompleted is never called and the MCP client waits indefinitely.  SessionState still survives the editor domain reload case needed by tests-run, but it is editor-only session state and is not affected by game/test code calling PlayerPrefs.DeleteAll(). So this keeps the existing domain-reload behavior while protecting the MCP routing state from project test fixtures.  That is the repro covered by #863.  On Sun, Jul 12, 2026 at 6:22 AM Ivan Murzak ***@***.***> wrote:  > *IvanMurzak* left a comment (IvanMurzak/Unity-MCP#870) > <https://github.com/IvanMurzak/Uni
  > @Abhinav-0311 Thanks for clarifying. Now I see the problem you want to fix. Hm... this PR doesn't fix it, it only moves the problem from PlayerPrefs.DeleteAll to EditorPrefs.DeleteAll. The data still could be deleted by tests run.

- **Issue #847** (2026-06-26): **Harden flaky ToolThreadSafetyTests teardown asset-import race**
  *Symptoms*: ## Summary  The `[TearDown] BgTearDown()` in the `ToolThreadSafetyTests` suite intermittently fails the Unity EditMode suite by deleting the suite's temp asset folder while Unity 6.x's async asset-import worker is still settling a background-thread-created asset. The deferred importer then logs an unexpected `[Error]`, and NUnit fails whichever test happens to be running. The tool bodies themselves all succeed — this is purely a shared-teardown race that should be made deterministic.  ## Context / Motivation  `BgTearDown()` calls `AssetDatabase.DeleteAsset("Assets/BgThreadTests_TMP")` while the import worker is still flushing assets created on a background thread (for example `mat_bg.mat` from `AssetsMaterialCreate_BothThreads`, or `scene_bg.unity` from `SceneCreate_BothThreads`). The import worker then logs verbatim:  ``` [Error] [Worker0] Could not open file .../BgThreadTests_TMP/... for read ```  NUnit fails any test that emits an unexpected `[Error]` log, so the suite goes red even though every tool call reported `Status=Success`.  The failure is intermittent and so far only hits the Unity `6000.3.1f1` EditMode leg. A *different* test trips it on each run — the definitive signature of a shared-teardown race rather than a defect in any single test body.  Two version variants of the suite share the same `BgTearDown` and the same `AssetsMaterialCreate_BothThreads` / `SceneCreate_BothThreads` bodies, so both must be hardened identically:  - `Unity-MCP-Plugin/Packages/com.ivan

- **Issue #846** (2026-07-04): **The package update will softlock the additional unity instance spawned by the MPPM**
  *Symptoms*: <img width="431" height="351" alt="Image" src="https://github.com/user-attachments/assets/9527138f-1751-4132-9ae7-70b0b1132033" />  <img width="418" height="259" alt="Image" src="https://github.com/user-attachments/assets/bc2959a5-3b04-40a7-8e92-56493ca49bdc" />  When using Unity Multiplayer package to launch a second virtual player, the `Updated` tab will hijack the whole virtual player, and pressing OK button will kill the instance. Any button that triggers a package operation forces a domain reload, which kills the virtual player process (MPPM virtual players can't survive a package reinstall).  I am on the latest version already. Even when I completely turned off the MCP it still hijacks the virtual player. This make development using MPPM with the MCP impossible.  Expected behaviour: The update tab should not hijack the virtual player spawned
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report @Eric-ChanHL . Could you please attach logs from Unity Editor?
  > Closing because of inactivity.

- **Issue #813** (2026-06-10): **Antigravity agent configPath outdated — should be ~/.gemini/config/mcp_config.json**
  *Symptoms*: ## Description The Antigravity agent configurator writes `mcp_config.json` to `~/.gemini/antigravity/mcp_config.json`, but the current Antigravity IDE (post Antigravity 2.0, released May 19, 2026) reads from `~/.gemini/config/mcp_config.json`.  This causes Antigravity IDE to fail to discover the Unity MCP server after clicking "Configure" in the AI Game Developer window.  ---  ## Link https://antigravity.google/docs/mcp#connecting-custom-mcp-servers  ---  ## Steps to Reproduce 1. Open Unity project with AI Game Developer plugin installed 2. In AI Game Developer window, select "Antigravity" as AI agent 3. Click "Configure" / "Reconfigure" 4. Plugin writes config to `~/.gemini/antigravity/mcp_config.json` 5. Open Antigravity IDE → MCP server is NOT loaded 6. Manually copy config to `~/.gemini/config/mcp_config.json` → works  ---  ## Expected Behavior The plugin should write to `~/.gemini/config/mcp_config.json` (the path Antigravity IDE actually reads from).  ---  ## Environment - Unity-MCP CLI: v0.79.1 - Unity-MCP Plugin: v0.79.1   - Antigravity IDE: current version (post 2.0 update) - OS: Windows 11  ---  ## Suggested Fix Update the `antigravity` agent's `configPath` from `~/.gemini/antigravity/mcp_config.json` to  `~/.gemini/config/mcp_config.json` in the CLI agent registry and the Unity plugin configurator.  --- 

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

### Incident Patch 1: `8d0cdd57` (2026-10-03)
**Commit Message**: console-get-logs: honour includeStackTrace, add sinceSequence cursor (#1005)

* feat(console): console-get-logs honours includeStackTrace and gains a sinceSequence cursor

Every captured entry now carries a monotonic 'sequence' assigned inside the
log storage under the file mutex. New optional sinceSequence parameter returns
only newer entries, oldest first (cursor, filter, sort, limit). The high-water
mark survives Clear/ResetLogFile/Temp wipe via a sidecar under Library/.
includeStackTrace was ignored by both storages and is now honoured on copies.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

* chore(console): refresh console-get-logs skill file and chain fixtures for sinceSequence

The tool contract gained the sinceSequence input and a sequence output field.
The four per-Unity-version chain fixtures differ from before in that one tool
record only; the 2022.3.62f3 one was regenerated from a real editor run and
diffs identical (chain_fixture.py diff exit 0). The other three received the
same record (their pre-change records were byte-identical to 2022.3's).

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAI

**File**: `Unity-MCP-Plugin/.claude/skills/console-get-logs/SKILL.md` (modified, +16/-2)
```diff
@@ -13,6 +13,11 @@ Retrieves Unity Editor logs. Useful for debugging and monitoring Unity Editor ac
 - `logTypeFilter` — Unity `LogType` filter; `null` returns all severities.
 - `includeStackTrace` (default `false`) — include stack-trace strings in each entry.
 - `lastMinutes` (default 0) — when non-zero, only logs from the last N minutes are returned.
+- `sinceSequence` (default 0) — every entry carries a `sequence` number. When greater than 0, only entries with a higher `sequence` are returned, oldest first, up to `maxEntries`.
+
+## Polling
+
+To read only what is new, pass the highest `sequence` you have received as `sinceSequence`; if the result has `maxEntries` entries, call again with the new highest `sequence` to continue. If returned sequences are lower than your cursor, the log restarted.
 
 ## How to Call
 
@@ -21,7 +26,8 @@ unity-mcp-cli run-tool console-get-logs --input '{
   "maxEntries": 0,
   "logTypeFilter": "string_value",
   "includeStackTrace": false,
-  "lastMinutes": 0
+  "lastMinutes": 0,
+  "sinceSequence": 0
 }'
 ```
 
@@ -51,6 +57,7 @@ Read the /unity-initial-setup skill for detailed installation instructions.
 | `logTypeFilter` | `any` | No | Filter by log type. 'null' means All. |
 | `includeStackTrace` | `boolean` | No | Include stack traces in the output. Default: false |
 | `lastMinutes` | `integer` | No | Return logs from the last N minutes. If 0, returns all available logs. Default: 0 |
+| `sinceSequence` | `integer` | No | Return only entries whose `sequence` is greater than this value, oldest first. If 0, returns the most recent entries. Default: 0 |
 
 ### Input JSON Schema
 
@@ -69,6 +76,9 @@ Read the /unity-initial-setup skill for detailed installation instructions.
     },
     "lastMinutes": {
       "type": "integer"
+    },
+    "sinceSequence": {
+      "type": "integer"
     }
   },
   "$defs": {
@@ -121,11 +131,15 @@ Read the /unity-initial-setup skill for detailed installation instructions.
         },
         "StackTrace": {
           "type": "string"
+        },
+        "sequence": {
+          "type": "integer"
         }
       },
       "required": [
         "LogType",
-        "Timestamp"
+        "Timestamp",
+        "sequence"
       ]
     },
     "com.IvanMurzak.Unity.MCP.LogEntry-1": {
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Editor/Scripts/API/Tool/Console.GetLogs.cs` (modified, +30/-6)
```diff
@@ -34,9 +34,18 @@ public partial class Tool_Console
             "- `maxEntries` (default 100, minimum 1) — caps the size of the returned array.\n" +
             "- `logTypeFilter` — Unity `LogType` filter; `null` returns all severities.\n" +
             "- `includeStackTrace` (default `false`) — include stack-trace strings in each entry.\n" +
-            "- `lastMinutes` (default 0) — when non-zero, only logs from the last N minutes are returned.")]
+            "- `lastMinutes` (default 0) — when non-zero, only logs from the last N minutes are returned.\n" +
+            "- `sinceSequence` (default 0) — every entry carries a `sequence` number. When greater than 0, only entries " +
+            "with a higher `sequence` are returned, oldest first, up to `maxEntries`.\n\n" +
+            "## Polling\n\n" +
+            "To read only what is new, pass the highest `sequence` you have received as `sinceSequence`; if the result " +
+            "has `maxEntries` entries, call again with the new highest `sequence` to continue. " +
+            "If returned sequences are lower than your cursor, the log restarted.")]
         [Description("Retrieves Unity Editor logs. " +
-            "Useful for debugging and monitoring Unity Editor activity.")]
+            "Useful for debugging and monitoring Unity Editor activity. " +
+            "Every entry has a `sequence` number: to poll, pass the highest `sequence` you received as `sinceSequence` " +
+            "to get only newer entries (oldest first; if the result has `maxEntries` entries, call again with the new highest). " +
+            "If returned sequences are lower than your cursor, the log restarted.")]
         public LogEntry[] GetLogs
         (
             [Description("Maximum number of log entries to return. Minimum: 1. Default: 100")]
@@ -46,13 +55,19 @@ public LogEntry[] GetLogs
             [Description("Include stack traces in the output. Default: false")]
             bool includeStackTrace = false,
             [Description("Return logs from the last N minutes. If 0, returns all available logs. Default: 0")]
-            int lastMinutes = 0
+            int lastMinutes = 0,
+            [Description("Return only entries whose `sequence` is greater than this value, oldest first. " +
+                "If 0, returns the most recent entries. Default: 0")]
+            long sinceSequence = 0
         )
         {
             // Validate parameters
             if (maxEntries < 1)
                 throw new ArgumentException(Error.InvalidMaxEntries(maxEntries));
 
+            if (sinceSequence < 0)
+                throw new ArgumentException(Error.InvalidSinceSequence(sinceSequence));
+
             if (!UnityMcpPluginEditor.HasInstance)
                 throw new InvalidOperationException("UnityMcpPluginEditor is not initialized.");
 
@@ -61,14 +76,23 @@ public LogEntry[] GetLogs
                 throw new InvalidOperationException("LogCollector is not initialized.");
 
             // Get all log entries as array to avoid concurrent modification
-            var logs = logCollector.Query(
+            if (sinceSequence > 0)
+            {
+                return logCollector.QuerySince(
+                    sinceSequence: sinceSequence,
+                    maxEntries: maxEntries,
+                    logTypeFilter: logTypeFilter,
+                    includeStackTrace: includeStackTrace,
+                    lastMinutes: lastMinutes
+                );
+            }
+
+            return logCollector.Query(
                 maxEntries: maxEntries,
                 logTypeFilter: logTypeFilter,
                 includeStackTrace: includeStackTrace,
                 lastMinutes: lastMinutes
             );
-
-            return logs;
         }
     }
 }
\ No newline at end of file
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Editor/Scripts/API/Tool/Console.cs` (modified, +3/-0)
```diff
@@ -21,6 +21,9 @@ public static class Error
             public static string InvalidMaxEntries(int entriesCount)
                 => $"Invalid maxEntries value '{entriesCount}'. Must be greater than 0.";
 
+            public static string InvalidSinceSequence(long sinceSequence)
+                => $"Invalid sinceSequence value '{sinceSequence}'. Must be 0 or greater.";
+
             public static string InvalidLogTypeFilter(string logType)
                 => $"Invalid logType filter '{logType}'. Valid values: All, Error, Assert, Warning, Log, Exception.";
         }
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Runtime/Unity/Logs/BufferedFileLogStorage.cs` (modified, +36/-5)
```diff
@@ -60,7 +60,7 @@ public override void Flush()
                 {
                     var entriesToFlush = new LogEntry[_logEntriesBufferLength];
                     Array.Copy(_logEntriesBuffer, entriesToFlush, _logEntriesBufferLength);
-                    base.AppendInternal(entriesToFlush);
+                    WriteEntries(entriesToFlush);
                     _logEntriesBufferLength = 0;
                 }
                 fileWriteStream?.Flush();
@@ -81,7 +81,7 @@ public override Task FlushAsync()
                 {
                     var entriesToFlush = new LogEntry[_logEntriesBufferLength];
                     Array.Copy(_logEntriesBuffer, entriesToFlush, _logEntriesBufferLength);
-                    base.AppendInternal(entriesToFlush);
+                    WriteEntries(entriesToFlush);
                     _logEntriesBufferLength = 0;
                 }
                 fileWriteStream?.Flush();
@@ -97,9 +97,12 @@ protected override void AppendInternal(params LogEntry[] entries)
                     nameof(AppendInternal));
                 return;
             }
+            // Numbered here, under the file mutex the callers hold, in the same step that buffers the entry.
+            AssignSequences(entries);
+
             if (_logEntriesBufferLength >= _flushEntriesThreshold)
             {
-                base.AppendInternal(_logEntriesBuffer);
+                WriteEntries(_logEntriesBuffer);
                 _logEntriesBufferLength = 0;
             }
             foreach (var entry in entries)
@@ -109,7 +112,7 @@ protected override void AppendInternal(params LogEntry[] entries)
 
                 if (_logEntriesBufferLength >= _flushEntriesThreshold)
                 {
-                    base.AppendInternal(_logEntriesBuffer);
+                    WriteEntries(_logEntriesBuffer);
                     _logEntriesBufferLength = 0;
                 }
             }
@@ -133,6 +136,9 @@ public override void Clear()
                 fileWriteStream = null;
                 _logEntriesBufferLength = 0;
 
+                // The sequence must outlive the entries that carried it.
+                PersistHighWaterMark();
+
                 if (File.Exists(filePath))
                     File.Delete(filePath);
 
@@ -185,7 +191,8 @@ protected override LogEntry[] QueryInternal(
                     }
                 }
 
-                result.Add(entry);
+                // The buffer slot is shared with the writer and with later queries: hand out a copy.
+                result.Add(entry.Clone(includeStackTrace));
                 if (result.Count >= maxEntries)
                     return result.AsEnumerable().Reverse().ToArray();
             }
@@ -204,6 +211,30 @@ protected override LogEntry[] QueryInternal(
             return result.ToArray();
         }
 
+        protected override void CollectBufferedEntriesNewerThan(
+            List<LogEntry> collected,
+            long cursor,
+            LogType? logTypeFilter,
+            bool includeStackTrace,
+            DateTime? cutoffTime)
+        {
+            // Newest are at the end of the buffer; everything in it is newer than everything in the file.
+            for (int i = _logEntriesBufferLength - 1; i >= 0; i--)
+            {
+                var entry = _logEntriesBuffer[i];
+                if (entry.Sequence <= cursor)
+                    break;
+
+                if (cutoffTime.HasValue && entry.Timestamp < cutoffTime.Value)
+                    break;
+
+                if (logTypeFilter.HasValue && entry.LogType != logTypeFilter.Value)
+                    continue;
+
+                collected.Add(entry.Clone(includeStackTrace));
+            }
+        }
+
         ~BufferedFileLogStorage() => Dispose();
     }
 }
\ No newline at end of file
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Runtime/Unity/Logs/FileLogStorage.cs` (modified, +245/-2)
```diff
@@ -31,6 +31,13 @@ public class FileLogStorage : ILogStorage, IDisposable
     {
         protected const int DefaultMaxFileSizeMB = 512;
 
+        /// <summary>
+        /// While running, the sequence high-water mark is persisted in blocks of this size (a reserved ceiling),
+        /// so a crash or an editor restart can never reissue a number, without a disk write per entry.
+        /// An orderly Dispose/Clear/ResetLogFile persists the exact value instead.
+        /// </summary>
+        protected const long SequenceReservation = 256;
+
         protected readonly ILogger _logger;
         protected readonly string _directoryPath;
         protected readonly string _requestedFileName;
@@ -45,6 +52,15 @@ public class FileLogStorage : ILogStorage, IDisposable
 
         protected FileStream? fileWriteStream;
 
+        /// <summary>Sidecar holding the sequence high-water mark. Deliberately outside the log file: Clear() and ResetLogFile() delete that.</summary>
+        protected readonly string _sequenceFilePath;
+
+        /// <summary>Highest sequence issued so far. Only touched under <see cref="_fileMutex"/>.</summary>
+        protected long _sequence;
+
+        /// <summary>Highest value known to be persisted in the sidecar. Only touched under <see cref="_fileMutex"/>.</summary>
+        protected long _sequenceCeiling;
+
         public FileLogStorage(
             ILogger? logger = null,
             string? directoryPath = null,
@@ -86,6 +102,112 @@ public FileLogStorage(
             };
 
             fileWriteStream = CreateWriteStream(_requestedFileName, out fileName, out filePath);
+
+            // Editor: Library/ survives the Temp/ wipe that happens on every Editor start. A caller-chosen
+            // directory keeps its sidecar next to the log; so does a player build (no Library there).
+            var sequenceDirectory = directoryPath == null && Application.isEditor
+                ? Path.GetFullPath($"{Path.GetDirectoryName(Application.dataPath)}/Library/mcp-server")
+                : _directoryPath;
+            try
+            {
+                if (!Directory.Exists(sequenceDirectory))
+                    Directory.CreateDirectory(sequenceDirectory);
+            }
+            catch (Exception ex)
+            {
+                _logger.LogWarning(ex, "Failed to create sequence directory {dir}. Using the log directory.", sequenceDirectory);
+                sequenceDirectory = _directoryPath;
+            }
+            _sequenceFilePath = Path.Combine(sequenceDirectory, Path.GetFileNameWithoutExtension(_requestedFileName) + ".sequence");
+
+            // Continue where the previous instance stopped: the larger of the persisted high-water mark
+            // (survives Clear and a Temp/ wipe) and the newest entry still in the log file.
+            lock (_fileMutex)
+            {
+                _sequence = Math.Max(ReadPersistedSequence(), ReadHighestSequenceInFile());
+                _sequenceCeiling = _sequence;
+            }
+        }
+
+        protected virtual long ReadPersistedSequence()
+        {
+            try
+            {
+                if (File.Exists(_sequenceFilePath)
+                    && long.TryParse(File.ReadAllText(_sequenceFilePath).Trim(), out var value)
+                    && value > 0)
+                    return value;
+            }
+            catch (Exception ex)
+            {
+                _logger.LogWarning(ex, "Failed to read sequence file {file}.", _sequenceFilePath);
+            }
+            return 0;
+        }
+
+        protected virtual long ReadHighestSequenceInFile()
+        {
+            try
+            {
+                if (!File.Exists(filePath))
+                    return 0;
+
+                using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
+                // Sequences ascend through the file, so the newest readable entry carries the highest one.
+                foreach (var entry in ReadLogEntriesFromLinesInReverse(stream))
+                    return Math.Max(entry.Sequence, 0);
+            }
+            catch (Exception ex)
+            {
+                _logger.LogWarning(ex, "Failed to read the last sequence from {file}.", filePath);
+            }
+            return 0;
+        }
+
+        /// <summary>
+        /// Persists <paramref name="value"/> to the sidecar. Writes a temp file and swaps it in, so a failed
+        /// write can never truncate the existing high-water mark. Must be called under <see cref="_fileMutex"/>.
+        /// </summary>
+        protected virtual void PersistSequence(long value)
+        {
+            // Recorded before the write: the warning below is itself a Unity log that re-enters Append on this
+            // thread (the mutex is reentrant), and a failing disk must not make that recurse.
+            _sequenceCeiling = value;
+            try
+            {
+                var tempPath = _sequenceFilePat
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Runtime/Unity/Logs/ILogStorage.cs` (modified, +19/-0)
```diff
@@ -33,6 +33,25 @@ LogEntry[] Query(
             bool includeStackTrace = false,
             int lastMinutes = 0);
 
+        /// <summary>
+        /// Entries newer than <paramref name="sinceSequence"/>, oldest first (cursor, then filters, then sort, then
+        /// limit - an overflowing result is the OLDEST page, so the next call continues without a gap).
+        /// A cursor above every sequence ever issued is treated as "before everything".
+        /// </summary>
+        Task<LogEntry[]> QuerySinceAsync(
+            long sinceSequence,
+            int maxEntries = 100,
+            UnityEngine.LogType? logTypeFilter = null,
+            bool includeStackTrace = false,
+            int lastMinutes = 0);
+        /// <inheritdoc cref="QuerySinceAsync"/>
+        LogEntry[] QuerySince(
+            long sinceSequence,
+            int maxEntries = 100,
+            UnityEngine.LogType? logTypeFilter = null,
+            bool includeStackTrace = false,
+            int lastMinutes = 0);
+
         void Clear();
     }
 }
\ No newline at end of file
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Runtime/Unity/Logs/LogEntry.cs` (modified, +16/-0)
```diff
@@ -10,6 +10,7 @@
 
 #nullable enable
 using System;
+using System.Text.Json.Serialization;
 using UnityEngine;
 
 namespace com.IvanMurzak.Unity.MCP
@@ -21,6 +22,14 @@ public class LogEntry
         public DateTime Timestamp { get; set; }
         public string? StackTrace { get; set; }
 
+        /// <summary>
+        /// Monotonic capture number (starts at 1), assigned by the log storage atomically with storing the entry.
+        /// 0 means "not assigned" (never stored, or written before sequences existed).
+        /// Serialized as lowercase <c>sequence</c>; agents pass the highest value they received as <c>sinceSequence</c>.
+        /// </summary>
+        [JsonPropertyName("sequence")]
+        public long Sequence { get; set; }
+
         public LogEntry()
         {
             LogType = LogType.Log;
@@ -50,6 +59,13 @@ public LogEntry(LogType logType, string message, DateTime timestamp, string? sta
             StackTrace = string.IsNullOrEmpty(stackTrace) ? null : stackTrace;
         }
 
+        /// <summary>
+        /// Returns an independent copy. Storages share entry instances (the buffered storage hands out its own
+        /// buffer slots), so anything that strips a field for a caller must strip it on a copy.
+        /// </summary>
+        public LogEntry Clone(bool includeStackTrace)
+            => new LogEntry(LogType, Message, Timestamp, includeStackTrace ? StackTrace : null) { Sequence = Sequence };
+
         public override string ToString() => ToString(includeStackTrace: false);
 
         public string ToString(bool includeStackTrace)
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Runtime/Unity/Logs/UnityLogCollector.cs` (modified, +20/-0)
```diff
@@ -88,6 +88,26 @@ public LogEntry[] Query(
             return _logStorage.Query(maxEntries, logTypeFilter, includeStackTrace, lastMinutes);
         }
 
+        public Task<LogEntry[]> QuerySinceAsync(
+            long sinceSequence,
+            int maxEntries = 100,
+            LogType? logTypeFilter = null,
+            bool includeStackTrace = false,
+            int lastMinutes = 0)
+        {
+            return _logStorage.QuerySinceAsync(sinceSequence, maxEntries, logTypeFilter, includeStackTrace, lastMinutes);
+        }
+
+        public LogEntry[] QuerySince(
+            long sinceSequence,
+            int maxEntries = 100,
+            LogType? logTypeFilter = null,
+            bool includeStackTrace = false,
+            int lastMinutes = 0)
+        {
+            return _logStorage.QuerySince(sinceSequence, maxEntries, logTypeFilter, includeStackTrace, lastMinutes);
+        }
+
         void OnLogMessageReceived(string message, string stackTrace, LogType type)
         {
             try
```

---

### Incident Patch 2: `ed316782` (2026-09-27)
**Commit Message**: test(chain): commit the Unity 6000.6.3f1 editor tool-contract fixture

Recorded by the 6000.6.3f1 base/editmode leg (run 36286648729). Same 78 tools
as 6000.3.1f1; the only contract differences are the 6.5+ EntityId shape
(instanceID is a $ref to UnityEngine.EntityId instead of an integer).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_016wRnXX11seX5vLSSodUjf3



---

### Incident Patch 3: `3670b7af` (2026-09-26)
**Commit Message**: Merge pull request #994 from IvanMurzak/fix/cli-deprecated-deps

fix(cli): print the update command alone on its own line

**File**: `cli/src/utils/update-check.ts` (modified, +10/-2)
```diff
@@ -94,11 +94,19 @@ export function formatUpdateAvailable(current: string, latest: string): string {
   return `Update available: ${chalk.dim(current)} → ${chalk.green(latest)}`;
 }
 
+/**
+ * The exact command a user should run to update. It is printed ALONE on its own
+ * line with nothing after it: the old wording "Run npm i -g unity-mcp-cli to update"
+ * was copied whole from the terminal, so npm also installed the unrelated `to`
+ * and `update` packages (the latter drags in ~630 deprecated dependencies).
+ */
+export const UPDATE_COMMAND = `npm i -g ${PACKAGE_NAME}`;
+
 /** Print a styled update notification to stderr (does not interfere with stdout piping). */
 export function printUpdateNotification(current: string, latest: string): void {
   console.error();
-  console.error(chalk.yellow(`  ${formatUpdateAvailable(current, latest)}`));
-  console.error(chalk.dim(`  Run ${chalk.cyan(`npm i -g ${PACKAGE_NAME}`)} to update`));
+  console.error(chalk.yellow(`  ${formatUpdateAvailable(current, latest)}. To update, run:`));
+  console.error(`    ${chalk.cyan(UPDATE_COMMAND)}`);
   console.error();
 }
 
```

**File**: `cli/tests/update-notification.test.ts` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+// Copyright (c) 2025 Ivan Murzak. All rights reserved.
+// Licensed under the Apache License, Version 2.0.
+
+import { describe, it, expect, vi, afterEach } from 'vitest';
+import { printUpdateNotification, UPDATE_COMMAND } from '../src/utils/update-check.js';
+
+// eslint-disable-next-line no-control-regex
+const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');
+
+function captureNotification(): string[] {
+  const lines: string[] = [];
+  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
+    lines.push(stripAnsi(args.map(String).join(' ')));
+  });
+  try {
+    printUpdateNotification('0.1.0', '0.2.0');
+  } finally {
+    spy.mockRestore();
+  }
+  return lines;
+}
+
+describe('update notification', () => {
+  afterEach(() => vi.restoreAllMocks());
+
+  it('prints the update command alone on its line, ending with the package name', () => {
+    // Regression: "Run npm i -g unity-mcp-cli to update" was copy-pasted whole,
+    // so npm also installed the unrelated `to` and `update` packages (the
+    // latter pulls in ~630 deprecated deps: set-value, glob@5, rimraf@2, ...).
+    const lines = captureNotification().filter((l) => l.includes('npm i -g'));
+    expect(lines).toHaveLength(1);
+    const line = lines[0]!.trim();
+    expect(line).toBe(UPDATE_COMMAND);
+    expect(line.endsWith('unity-mcp-cli')).toBe(true);
+    expect(line.split(/\s+/).slice(3)).toEqual(['unity-mcp-cli']);
+  });
+});
```

---

### Incident Patch 4: `38447de1` (2026-09-26)
**Commit Message**: fix(cli): print the update command alone on its own line

Move the bare `npm i -g unity-mcp-cli` onto its own line under the
"Update available: X -> Y. To update, run:" header, so nothing can be
copied into the command. The test now pins that the line containing
`npm i -g` is exactly the command and ends with the package name.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_016wRnXX11seX5vLSSodUjf3

**File**: `cli/src/utils/update-check.ts` (modified, +7/-12)
```diff
@@ -95,23 +95,18 @@ export function formatUpdateAvailable(current: string, latest: string): string {
 }
 
 /**
- * The exact command a user should run to update. It is always the LAST thing on
- * its line: the old wording "Run npm i -g unity-mcp-cli to update" was copied
- * whole from the terminal, so npm installed the unrelated `to` and `update`
- * packages alongside the CLI (and `update` drags in 600+ deprecated deps).
+ * The exact command a user should run to update. It is printed ALONE on its own
+ * line with nothing after it: the old wording "Run npm i -g unity-mcp-cli to update"
+ * was copied whole from the terminal, so npm also installed the unrelated `to`
+ * and `update` packages (the latter drags in ~630 deprecated dependencies).
  */
-export const UPDATE_COMMAND = `npm i -g ${PACKAGE_NAME}@latest`;
-
-/** Format the "how to update" hint; the command ends the line with nothing after it. */
-export function formatUpdateHint(): string {
-  return `To update, run: ${chalk.cyan(UPDATE_COMMAND)}`;
-}
+export const UPDATE_COMMAND = `npm i -g ${PACKAGE_NAME}`;
 
 /** Print a styled update notification to stderr (does not interfere with stdout piping). */
 export function printUpdateNotification(current: string, latest: string): void {
   console.error();
-  console.error(chalk.yellow(`  ${formatUpdateAvailable(current, latest)}`));
-  console.error(chalk.dim(`  ${formatUpdateHint()}`));
+  console.error(chalk.yellow(`  ${formatUpdateAvailable(current, latest)}. To update, run:`));
+  console.error(`    ${chalk.cyan(UPDATE_COMMAND)}`);
   console.error();
 }
 
```

**File**: `cli/tests/update-notification.test.ts` (modified, +8/-8)
```diff
@@ -23,15 +23,15 @@ function captureNotification(): string[] {
 describe('update notification', () => {
   afterEach(() => vi.restoreAllMocks());
 
-  it('installs exactly one package when the hint line is copied after its colon', () => {
+  it('prints the update command alone on its line, ending with the package name', () => {
     // Regression: "Run npm i -g unity-mcp-cli to update" was copy-pasted whole,
     // so npm also installed the unrelated `to` and `update` packages (the
-    // latter pulls in ~600 deprecated deps: set-value, glob@5, rimraf@2, ...).
-    const hint = captureNotification().find((l) => l.includes('npm i -g'));
-    expect(hint).toBeDefined();
-    const command = hint!.slice(hint!.indexOf('npm i -g')).trim();
-    expect(command).toBe(UPDATE_COMMAND);
-    const packages = command.split(/\s+/).slice(3);
-    expect(packages).toEqual(['unity-mcp-cli@latest']);
+    // latter pulls in ~630 deprecated deps: set-value, glob@5, rimraf@2, ...).
+    const lines = captureNotification().filter((l) => l.includes('npm i -g'));
+    expect(lines).toHaveLength(1);
+    const line = lines[0]!.trim();
+    expect(line).toBe(UPDATE_COMMAND);
+    expect(line.endsWith('unity-mcp-cli')).toBe(true);
+    expect(line.split(/\s+/).slice(3)).toEqual(['unity-mcp-cli']);
   });
 });
```

---

### Incident Patch 5: `19c829f3` (2026-09-26)
**Commit Message**: fix(cli): make the update hint safe to copy-paste

The update notice read "Run npm i -g unity-mcp-cli to update". Copying the
whole line ran `npm i -g unity-mcp-cli to update`, which also installs the
unrelated npm packages `to` and `update`; `update@0.7.4` drags in ~630
packages and prints the set-value/glob/rimraf/inflight/lodash.isequal
deprecation warnings. unity-mcp-cli itself installs 6 packages with zero
deprecation warnings.

Reword to "To update, run: npm i -g unity-mcp-cli@latest" so the command
ends the line, and add a regression test that fails on the old wording.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_016wRnXX11seX5vLSSodUjf3

**File**: `cli/src/utils/update-check.ts` (modified, +14/-1)
```diff
@@ -94,11 +94,24 @@ export function formatUpdateAvailable(current: string, latest: string): string {
   return `Update available: ${chalk.dim(current)} → ${chalk.green(latest)}`;
 }
 
+/**
+ * The exact command a user should run to update. It is always the LAST thing on
+ * its line: the old wording "Run npm i -g unity-mcp-cli to update" was copied
+ * whole from the terminal, so npm installed the unrelated `to` and `update`
+ * packages alongside the CLI (and `update` drags in 600+ deprecated deps).
+ */
+export const UPDATE_COMMAND = `npm i -g ${PACKAGE_NAME}@latest`;
+
+/** Format the "how to update" hint; the command ends the line with nothing after it. */
+export function formatUpdateHint(): string {
+  return `To update, run: ${chalk.cyan(UPDATE_COMMAND)}`;
+}
+
 /** Print a styled update notification to stderr (does not interfere with stdout piping). */
 export function printUpdateNotification(current: string, latest: string): void {
   console.error();
   console.error(chalk.yellow(`  ${formatUpdateAvailable(current, latest)}`));
-  console.error(chalk.dim(`  Run ${chalk.cyan(`npm i -g ${PACKAGE_NAME}`)} to update`));
+  console.error(chalk.dim(`  ${formatUpdateHint()}`));
   console.error();
 }
 
```

**File**: `cli/tests/update-notification.test.ts` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+// Copyright (c) 2025 Ivan Murzak. All rights reserved.
+// Licensed under the Apache License, Version 2.0.
+
+import { describe, it, expect, vi, afterEach } from 'vitest';
+import { printUpdateNotification, UPDATE_COMMAND } from '../src/utils/update-check.js';
+
+// eslint-disable-next-line no-control-regex
+const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');
+
+function captureNotification(): string[] {
+  const lines: string[] = [];
+  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
+    lines.push(stripAnsi(args.map(String).join(' ')));
+  });
+  try {
+    printUpdateNotification('0.1.0', '0.2.0');
+  } finally {
+    spy.mockRestore();
+  }
+  return lines;
+}
+
+describe('update notification', () => {
+  afterEach(() => vi.restoreAllMocks());
+
+  it('installs exactly one package when the hint line is copied after its colon', () => {
+    // Regression: "Run npm i -g unity-mcp-cli to update" was copy-pasted whole,
+    // so npm also installed the unrelated `to` and `update` packages (the
+    // latter pulls in ~600 deprecated deps: set-value, glob@5, rimraf@2, ...).
+    const hint = captureNotification().find((l) => l.includes('npm i -g'));
+    expect(hint).toBeDefined();
+    const command = hint!.slice(hint!.indexOf('npm i -g')).trim();
+    expect(command).toBe(UPDATE_COMMAND);
+    const packages = command.split(/\s+/).slice(3);
+    expect(packages).toEqual(['unity-mcp-cli@latest']);
+  });
+});
```

---

### Incident Patch 6: `81412e91` (2026-09-23)
**Commit Message**: Merge pull request #992 from IvanMurzak/fix/regenerate-key-right-edge

fix(ui): align "Regenerate key" right edge with Configure

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Editor/Scripts/UI/AiAgentConfigurators/AiAgentConfiguratorView.cs` (modified, +14/-21)
```diff
@@ -496,6 +496,9 @@ private VisualElement BuildConfigureStatusRow(TransportMethod transport, AgentCo
             var statusText = root.Q<Label>("configureStatusText") ?? throw new NullReferenceException("Label 'configureStatusText' not found in UI.");
             var btnConfigure = root.Q<Button>("btnConfigure") ?? throw new NullReferenceException("Button 'btnConfigure' not found in UI.");
             var btnRemove = root.Q<Button>("btnRemoveConfig") ?? throw new NullReferenceException("Button 'btnRemoveConfig' not found in UI.");
+            var keyRow = root.Q<VisualElement>("projectKeyRow") ?? throw new NullReferenceException("VisualElement 'projectKeyRow' not found in UI.");
+            var keyStatusText = root.Q<Label>("projectKeyStatusText") ?? throw new NullReferenceException("Label 'projectKeyStatusText' not found in UI.");
+            var btnRegenerate = root.Q<Button>("btnRegenerateKey") ?? throw new NullReferenceException("Button 'btnRegenerateKey' not found in UI.");
 
             var config = GetConfig(settings, transport);
 
@@ -519,40 +522,30 @@ private VisualElement BuildConfigureStatusRow(TransportMethod transport, AgentCo
             });
 
             // Cloud HTTP only: which credential the config carries + "Regenerate key" (project-keys contract §7).
-            // stdio and the local server are unchanged, so they get no key row.
+            // stdio and the local server are unchanged, so they keep the row hidden.
             if (transport == TransportMethod.streamableHttp && IsCloud(settings))
-                root.Add(BuildProjectKeyRow(settings));
+                ShowProjectKeyRow(keyRow, keyStatusText, btnRegenerate, settings);
 
             return root;
         }
 
-        private VisualElement BuildProjectKeyRow(AgentConfig.AgentConfiguratorSettings settings)
+        /// <summary>
+        /// Fills the project-key row declared in <c>TemplateConfigureStatus.uxml</c>. The row lives in the same column
+        /// as the Configure row, with the same layout, so the Regenerate button's right edge matches Configure's.
+        /// </summary>
+        private void ShowProjectKeyRow(VisualElement keyRow, Label keyStatusText, Button btnRegenerate, AgentConfig.AgentConfiguratorSettings settings)
         {
-            var row = new VisualElement();
-            row.style.flexDirection = FlexDirection.Row;
-            row.style.alignItems = Align.Center;
-            row.style.justifyContent = Justify.SpaceBetween;
-            row.style.marginTop = 2;
-
             var isSignedIn = AccountCredentialService.IsSignedIn;
-            var label = TemplateLabelDescription(_keyMessage ?? DescribeKeyState(isSignedIn, settings.HasProjectKey));
-            label.style.flexShrink = 1;
-            label.style.whiteSpace = WhiteSpace.Normal;
-            row.Add(label);
+            keyStatusText.text = _keyMessage ?? DescribeKeyState(isSignedIn, settings.HasProjectKey);
 
             // Regenerating needs a login (it mints with the account's token); signed out there is nothing to press.
             if (isSignedIn)
             {
-                var btnRegenerate = new Button(RegenerateProjectKey)
-                {
-                    text = "Regenerate key",
-                    tooltip = "Regenerate this project's key, rewrite every agent config that uses it, and revoke the old key",
-                };
-                btnRegenerate.AddToClassList("btn-compact");
+                btnRegenerate.clicked += RegenerateProjectKey;
                 btnRegenerate.SetEnabled(_busyText == null);
-                row.Add(btnRegenerate);
+                btnRegenerate.style.display = DisplayStyle.Flex;
             }
-            return row;
+            keyRow.style.display = DisplayStyle.Flex;
         }
 
         private AgentConfig.AiAgentConfig GetConfig(AgentConfig.AgentConfiguratorSettings settings, TransportMethod transport)
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Editor/UI/uxml/agents/elements/TemplateConfigureStatus.uxml` (modified, +5/-0)
```diff
@@ -12,6 +12,11 @@
                     <ui:Button name="btnConfigure" text="Configure" class="btn-compact" />
                 </ui:VisualElement>
             </ui:VisualElement>
+            <!-- Cloud HTTP only (shown from C#). Same column + same row layout as the Configure row above, so both buttons share one right edge. -->
+            <ui:VisualElement name="projectKeyRow" style="display: none; flex-direction: row; align-items: center; justify-content: space-between; margin-top: 2px;">
+                <ui:Label name="projectKeyStatusText" class="section-desc" style="margin-bottom: 0; flex-shrink: 1;" />
+                <ui:Button name="btnRegenerateKey" text="Regenerate key" class="btn-compact" tooltip="Regenerate this project's key, rewrite every agent config that uses it, and revoke the old key" style="display: none;" />
+            </ui:VisualElement>
         </ui:VisualElement>
     </ui:VisualElement>
 </ui:UXML>
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Tests/Editor/UI/AiAgentConfiguratorViewLogicTests.cs` (modified, +51/-3)
```diff
@@ -12,6 +12,7 @@
 using com.IvanMurzak.McpPlugin.AgentConfig;
 using com.IvanMurzak.Unity.MCP.Editor.UI;
 using NUnit.Framework;
+using UnityEngine.UIElements;
 using CustomConfigurator = com.IvanMurzak.McpPlugin.AgentConfig.Impl.CustomConfigurator;
 using TransportMethod = com.IvanMurzak.McpPlugin.Common.Consts.MCP.Server.TransportMethod;
 using AgentConnectionMode = com.IvanMurzak.McpPlugin.AgentConfig.ConnectionMode;
@@ -22,9 +23,9 @@ namespace com.IvanMurzak.Unity.MCP.Editor.Tests
     /// <summary>
     /// Pure-logic tests for the configurator view's decision points: the sign-in state chip, the
     /// credential mode each connection mode writes, and the Cloud project key (project-keys contract
-    /// §7) being written as <c>Authorization: Bearer</c> for every agent. No UIToolkit / Editor state is
-    /// exercised — the view's decision points are unit-tested through internal static helpers
-    /// (same pattern as <c>MainWindowEditorStatusLogicTests</c>).
+    /// §7) being written as <c>Authorization: Bearer</c> for every agent. No Editor state is exercised — the
+    /// view's decision points are unit-tested through internal static helpers (same pattern as
+    /// <c>MainWindowEditorStatusLogicTests</c>); the one UIToolkit test only clones a UXML template to pin its layout.
     /// </summary>
     public class AiAgentConfiguratorViewLogicTests
     {
@@ -204,5 +205,52 @@ public void DescribeKeyState_SaysWhetherAKeyIsInUse(bool isSignedIn, bool hasKey
         }
 
         #endregion
+
+        #region Regenerate key shares the Configure button's right edge
+
+        /// <summary>
+        /// The "Regenerate key" row must sit in the SAME column as the Configure row with the SAME row layout: that
+        /// column is the `.row` child that `.row > * { margin-right }` insets, so sharing it is what puts both buttons'
+        /// right edges on one line. A row added to the template root instead escapes that inset (the 0.92.0 bug).
+        /// </summary>
+        [Test]
+        public void ConfigureStatusTemplate_KeyRowSharesTheConfigureColumnAndLayout()
+        {
+            var root = new UITemplate<VisualElement>("Editor/UI/uxml/agents/elements/TemplateConfigureStatus.uxml").Value;
+            var btnConfigure = root.Q<Button>("btnConfigure");
+            var btnRegenerate = root.Q<Button>("btnRegenerateKey");
+            var configureStatusText = root.Q<Label>("configureStatusText");
+            var keyStatusText = root.Q<Label>("projectKeyStatusText");
+            Assert.IsNotNull(btnConfigure);
+            Assert.IsNotNull(btnRegenerate);
+            Assert.IsNotNull(configureStatusText);
+            Assert.IsNotNull(keyStatusText);
+
+            var configureRow = configureStatusText!.parent;
+            var keyRow = btnRegenerate!.parent;
+            Assert.AreEqual("projectKeyRow", keyRow.name);
+            Assert.AreSame(keyStatusText!.parent, keyRow);
+
+            // Same column, and that column is the `.row` child the right-edge inset applies to.
+            Assert.AreSame(configureRow.parent, keyRow.parent);
+            Assert.AreEqual("templateConfigurationStatus", keyRow.parent.name);
+            Assert.IsTrue(keyRow.parent.parent.ClassListContains("row"));
+
+            // Each button (group) is its row's last child under the same row layout.
+            Assert.AreSame(btnConfigure!.parent, configureRow[configureRow.childCount - 1]);
+            Assert.AreSame(btnRegenerate, keyRow[keyRow.childCount - 1]);
+            Assert.AreEqual(configureRow.style.flexDirection.value, keyRow.style.flexDirection.value);
+            Assert.AreEqual(configureRow.style.alignItems.value, keyRow.style.alignItems.value);
+            Assert.AreEqual(configureRow.style.justifyContent.value, keyRow.style.justifyContent.value);
+            Assert.AreEqual(configureRow.style.marginTop.value, keyRow.style.marginTop.value);
+
+            // Same button + label styling, and the tooltip is kept.
+            CollectionAssert.AreEquivalent(btnConfigure.GetClasses(), btnRegenerate.GetClasses());
+            CollectionAssert.AreEquivalent(configureStatusText.GetClasses(), keyStatusText.GetClasses());
+            Assert.AreEqual(configureStatusText.style.marginBottom.value, keyStatusText.style.marginBottom.value);
+            Assert.IsFalse(string.IsNullOrEmpty(btnRegenerate.tooltip));
+        }
+
+        #endregion
     }
 }
```

---

### Incident Patch 7: `700eb093` (2026-09-23)
**Commit Message**: refactor(ui): declare the project-key row in TemplateConfigureStatus.uxml

Code-review follow-up. The key row is now declared in the UXML directly
under the Configure row, in the same column and with the same inline row
layout; C# only fills its text and toggles visibility. Its label copies
configureStatusText's class and zero bottom margin, so the row is as tall
as the Configure row (the C#-built row kept TemplateLabelDescription's
4px/8px margins and sat lower). A missing element now fails for every
transport, not only Cloud. Adds an EditMode test pinning the shared
column, row layout, button class and tooltip.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Mer91zRikZmjaCsydhCED6

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Editor/Scripts/UI/AiAgentConfigurators/AiAgentConfiguratorView.cs` (modified, +14/-26)
```diff
@@ -496,6 +496,9 @@ private VisualElement BuildConfigureStatusRow(TransportMethod transport, AgentCo
             var statusText = root.Q<Label>("configureStatusText") ?? throw new NullReferenceException("Label 'configureStatusText' not found in UI.");
             var btnConfigure = root.Q<Button>("btnConfigure") ?? throw new NullReferenceException("Button 'btnConfigure' not found in UI.");
             var btnRemove = root.Q<Button>("btnRemoveConfig") ?? throw new NullReferenceException("Button 'btnRemoveConfig' not found in UI.");
+            var keyRow = root.Q<VisualElement>("projectKeyRow") ?? throw new NullReferenceException("VisualElement 'projectKeyRow' not found in UI.");
+            var keyStatusText = root.Q<Label>("projectKeyStatusText") ?? throw new NullReferenceException("Label 'projectKeyStatusText' not found in UI.");
+            var btnRegenerate = root.Q<Button>("btnRegenerateKey") ?? throw new NullReferenceException("Button 'btnRegenerateKey' not found in UI.");
 
             var config = GetConfig(settings, transport);
 
@@ -519,45 +522,30 @@ private VisualElement BuildConfigureStatusRow(TransportMethod transport, AgentCo
             });
 
             // Cloud HTTP only: which credential the config carries + "Regenerate key" (project-keys contract §7).
-            // stdio and the local server are unchanged, so they get no key row.
-            // It goes INTO the same column as the Configure row (not onto the template root): that column is the
-            // `.row` child that `.row > * { margin-right }` insets, so both buttons share one right edge.
+            // stdio and the local server are unchanged, so they keep the row hidden.
             if (transport == TransportMethod.streamableHttp && IsCloud(settings))
-            {
-                var statusColumn = root.Q<VisualElement>("templateConfigurationStatus") ?? throw new NullReferenceException("VisualElement 'templateConfigurationStatus' not found in UI.");
-                statusColumn.Add(BuildProjectKeyRow(settings));
-            }
+                ShowProjectKeyRow(keyRow, keyStatusText, btnRegenerate, settings);
 
             return root;
         }
 
-        private VisualElement BuildProjectKeyRow(AgentConfig.AgentConfiguratorSettings settings)
+        /// <summary>
+        /// Fills the project-key row declared in <c>TemplateConfigureStatus.uxml</c>. The row lives in the same column
+        /// as the Configure row, with the same layout, so the Regenerate button's right edge matches Configure's.
+        /// </summary>
+        private void ShowProjectKeyRow(VisualElement keyRow, Label keyStatusText, Button btnRegenerate, AgentConfig.AgentConfiguratorSettings settings)
         {
-            var row = new VisualElement();
-            row.style.flexDirection = FlexDirection.Row;
-            row.style.alignItems = Align.Center;
-            row.style.justifyContent = Justify.SpaceBetween;
-            row.style.marginTop = 2;
-
             var isSignedIn = AccountCredentialService.IsSignedIn;
-            var label = TemplateLabelDescription(_keyMessage ?? DescribeKeyState(isSignedIn, settings.HasProjectKey));
-            label.style.flexShrink = 1;
-            label.style.whiteSpace = WhiteSpace.Normal;
-            row.Add(label);
+            keyStatusText.text = _keyMessage ?? DescribeKeyState(isSignedIn, settings.HasProjectKey);
 
             // Regenerating needs a login (it mints with the account's token); signed out there is nothing to press.
             if (isSignedIn)
             {
-                var btnRegenerate = new Button(RegenerateProjectKey)
-                {
-                    text = "Regenerate key",
-                    tooltip = "Regenerate this project's key, rewrite every agent config that uses it, and revoke the old key",
-                };
-                btnRegenerate.AddToClassList("btn-compact");
+                btnRegenerate.clicked += RegenerateProjectKey;
                 btnRegenerate.SetEnabled(_busyText == null);
-                row.Add(btnRegenerate);
+                btnRegenerate.style.display = DisplayStyle.Flex;
             }
-            return row;
+            keyRow.style.display = DisplayStyle.Flex;
         }
 
         private AgentConfig.AiAgentConfig GetConfig(AgentConfig.AgentConfiguratorSettings settings, TransportMethod transport)
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Editor/UI/uxml/agents/elements/TemplateConfigureStatus.uxml` (modified, +5/-0)
```diff
@@ -12,6 +12,11 @@
                     <ui:Button name="btnConfigure" text="Configure" class="btn-compact" />
                 </ui:VisualElement>
             </ui:VisualElement>
+            <!-- Cloud HTTP only (shown from C#). Same column + same row layout as the Configure row above, so both buttons share one right edge. -->
+            <ui:VisualElement name="projectKeyRow" style="display: none; flex-direction: row; align-items: center; justify-content: space-between; margin-top: 2px;">
+                <ui:Label name="projectKeyStatusText" class="section-desc" style="margin-bottom: 0; flex-shrink: 1;" />
+                <ui:Button name="btnRegenerateKey" text="Regenerate key" class="btn-compact" tooltip="Regenerate this project's key, rewrite every agent config that uses it, and revoke the old key" style="display: none;" />
+            </ui:VisualElement>
         </ui:VisualElement>
     </ui:VisualElement>
 </ui:UXML>
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Tests/Editor/UI/AiAgentConfiguratorViewLogicTests.cs` (modified, +51/-3)
```diff
@@ -12,6 +12,7 @@
 using com.IvanMurzak.McpPlugin.AgentConfig;
 using com.IvanMurzak.Unity.MCP.Editor.UI;
 using NUnit.Framework;
+using UnityEngine.UIElements;
 using CustomConfigurator = com.IvanMurzak.McpPlugin.AgentConfig.Impl.CustomConfigurator;
 using TransportMethod = com.IvanMurzak.McpPlugin.Common.Consts.MCP.Server.TransportMethod;
 using AgentConnectionMode = com.IvanMurzak.McpPlugin.AgentConfig.ConnectionMode;
@@ -22,9 +23,9 @@ namespace com.IvanMurzak.Unity.MCP.Editor.Tests
     /// <summary>
     /// Pure-logic tests for the configurator view's decision points: the sign-in state chip, the
     /// credential mode each connection mode writes, and the Cloud project key (project-keys contract
-    /// §7) being written as <c>Authorization: Bearer</c> for every agent. No UIToolkit / Editor state is
-    /// exercised — the view's decision points are unit-tested through internal static helpers
-    /// (same pattern as <c>MainWindowEditorStatusLogicTests</c>).
+    /// §7) being written as <c>Authorization: Bearer</c> for every agent. No Editor state is exercised — the
+    /// view's decision points are unit-tested through internal static helpers (same pattern as
+    /// <c>MainWindowEditorStatusLogicTests</c>); the one UIToolkit test only clones a UXML template to pin its layout.
     /// </summary>
     public class AiAgentConfiguratorViewLogicTests
     {
@@ -204,5 +205,52 @@ public void DescribeKeyState_SaysWhetherAKeyIsInUse(bool isSignedIn, bool hasKey
         }
 
         #endregion
+
+        #region Regenerate key shares the Configure button's right edge
+
+        /// <summary>
+        /// The "Regenerate key" row must sit in the SAME column as the Configure row with the SAME row layout: that
+        /// column is the `.row` child that `.row > * { margin-right }` insets, so sharing it is what puts both buttons'
+        /// right edges on one line. A row added to the template root instead escapes that inset (the 0.92.0 bug).
+        /// </summary>
+        [Test]
+        public void ConfigureStatusTemplate_KeyRowSharesTheConfigureColumnAndLayout()
+        {
+            var root = new UITemplate<VisualElement>("Editor/UI/uxml/agents/elements/TemplateConfigureStatus.uxml").Value;
+            var btnConfigure = root.Q<Button>("btnConfigure");
+            var btnRegenerate = root.Q<Button>("btnRegenerateKey");
+            var configureStatusText = root.Q<Label>("configureStatusText");
+            var keyStatusText = root.Q<Label>("projectKeyStatusText");
+            Assert.IsNotNull(btnConfigure);
+            Assert.IsNotNull(btnRegenerate);
+            Assert.IsNotNull(configureStatusText);
+            Assert.IsNotNull(keyStatusText);
+
+            var configureRow = configureStatusText!.parent;
+            var keyRow = btnRegenerate!.parent;
+            Assert.AreEqual("projectKeyRow", keyRow.name);
+            Assert.AreSame(keyStatusText!.parent, keyRow);
+
+            // Same column, and that column is the `.row` child the right-edge inset applies to.
+            Assert.AreSame(configureRow.parent, keyRow.parent);
+            Assert.AreEqual("templateConfigurationStatus", keyRow.parent.name);
+            Assert.IsTrue(keyRow.parent.parent.ClassListContains("row"));
+
+            // Each button (group) is its row's last child under the same row layout.
+            Assert.AreSame(btnConfigure!.parent, configureRow[configureRow.childCount - 1]);
+            Assert.AreSame(btnRegenerate, keyRow[keyRow.childCount - 1]);
+            Assert.AreEqual(configureRow.style.flexDirection.value, keyRow.style.flexDirection.value);
+            Assert.AreEqual(configureRow.style.alignItems.value, keyRow.style.alignItems.value);
+            Assert.AreEqual(configureRow.style.justifyContent.value, keyRow.style.justifyContent.value);
+            Assert.AreEqual(configureRow.style.marginTop.value, keyRow.style.marginTop.value);
+
+            // Same button + label styling, and the tooltip is kept.
+            CollectionAssert.AreEquivalent(btnConfigure.GetClasses(), btnRegenerate.GetClasses());
+            CollectionAssert.AreEquivalent(configureStatusText.GetClasses(), keyStatusText.GetClasses());
+            Assert.AreEqual(configureStatusText.style.marginBottom.value, keyStatusText.style.marginBottom.value);
+            Assert.IsFalse(string.IsNullOrEmpty(btnRegenerate.tooltip));
+        }
+
+        #endregion
     }
 }
```

---

### Incident Patch 8: `03a6f90f` (2026-09-23)
**Commit Message**: fix(ui): align "Regenerate key" right edge with Configure

The project-key row was appended to the template root, a sibling of the
`.row` wrapper, so it escaped `.row > * { margin-right: 8px }` and its
button sat 8px further right than Configure. Add it to the same
`templateConfigurationStatus` column that holds the Configure row, so one
rule insets both.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Mer91zRikZmjaCsydhCED6

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Editor/Scripts/UI/AiAgentConfigurators/AiAgentConfiguratorView.cs` (modified, +6/-1)
```diff
@@ -520,8 +520,13 @@ private VisualElement BuildConfigureStatusRow(TransportMethod transport, AgentCo
 
             // Cloud HTTP only: which credential the config carries + "Regenerate key" (project-keys contract §7).
             // stdio and the local server are unchanged, so they get no key row.
+            // It goes INTO the same column as the Configure row (not onto the template root): that column is the
+            // `.row` child that `.row > * { margin-right }` insets, so both buttons share one right edge.
             if (transport == TransportMethod.streamableHttp && IsCloud(settings))
-                root.Add(BuildProjectKeyRow(settings));
+            {
+                var statusColumn = root.Q<VisualElement>("templateConfigurationStatus") ?? throw new NullReferenceException("VisualElement 'templateConfigurationStatus' not found in UI.");
+                statusColumn.Add(BuildProjectKeyRow(settings));
+            }
 
             return root;
         }
```

---

### Incident Patch 9: `a5913bb0` (2026-09-23)
**Commit Message**: fix(cli): open — Cloud auto-setup keys on the connection mode, not cloudToken

The App no longer writes cloudToken (the plugin stopped reading it in
b08d6943), so openProject never enabled claude-code skill auto-gen /
keep-connected for a Cloud project. Gate the block on Cloud mode alone.
Test plants: re-adding the cloudToken gate reddens it.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Mer91zRikZmjaCsydhCED6

**File**: `cli/src/lib/open.ts` (modified, +7/-5)
```diff
@@ -275,16 +275,18 @@ export async function openProject(
       version,
     });
 
-    // Cloud-mode auto-detect: if the project's config is in Cloud
-    // mode AND has a cloudToken, ensure keepConnected so the plugin
-    // connects on startup; also enable claude-code skill auto-gen.
+    // Cloud-mode auto-detect: if the project's config is in Cloud mode,
+    // ensure keepConnected so the plugin connects on startup; also enable
+    // claude-code skill auto-gen. Gated on the mode ALONE — the Cloud
+    // credential lives in the machine store (~/.ai-game-dev), and the plugin
+    // no longer reads (nor the App writes) a per-project `cloudToken`.
     let effectiveOptions = options;
     {
       const config = readConfig(projectPath);
-      if (config && isCloudMode(config) && config.cloudToken) {
+      if (config && isCloudMode(config)) {
         if (!effectiveOptions.keepConnected) {
           effectiveOptions = { ...effectiveOptions, keepConnected: true };
-          warnings.push('Cloud mode with token detected — auto-enabling keep-connected.');
+          warnings.push('Cloud mode detected — auto-enabling keep-connected.');
           // keepConnected flipped — rebuild the env map so the editor
           // receives UNITY_MCP_KEEP_CONNECTED=true.
           env = buildOpenEnv(effectiveOptions);
```

**File**: `cli/tests/open-lib.test.ts` (modified, +33/-0)
```diff
@@ -397,6 +397,39 @@ describe('openProject — explicit editor path override (mocked)', () => {
     });
   });
 
+  // The App no longer writes `cloudToken` (the plugin stopped reading it), so the Cloud auto-setup must
+  // key on the connection mode alone. Plant: re-adding a `config.cloudToken` gate reddens this test.
+  it('Cloud mode WITHOUT a cloudToken enables claude-code skill auto-gen and keep-connected', async () => {
+    const configPath = path.join(tmpDir, 'UserSettings', 'AI-Game-Developer-Config.json');
+    fs.mkdirSync(path.dirname(configPath), { recursive: true });
+    fs.writeFileSync(configPath, JSON.stringify({ connectionMode: 'Cloud', timeoutMs: 10000 }, null, 2));
+    const { openProject: mockedOpenProject } = await import('../src/lib/open.js');
+
+    const result = await mockedOpenProject({ projectPath: tmpDir, editorPath, autoDismissLaunchErrors: false });
+
+    expect(result.kind).toBe('success');
+    const written = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
+      cloudToken?: string;
+      skillAutoGenerate?: Record<string, boolean>;
+    };
+    expect(written.skillAutoGenerate?.['claude-code']).toBe(true);
+    expect(written.cloudToken).toBeUndefined();
+    expect(launchEditorMock.mock.calls[0][2]).toMatchObject({ UNITY_MCP_KEEP_CONNECTED: 'true' });
+  });
+
+  it('a non-Cloud config is left untouched', async () => {
+    const configPath = path.join(tmpDir, 'UserSettings', 'AI-Game-Developer-Config.json');
+    fs.mkdirSync(path.dirname(configPath), { recursive: true });
+    const original = JSON.stringify({ connectionMode: 'Custom', host: 'http://localhost:12345' }, null, 2);
+    fs.writeFileSync(configPath, original);
+    const { openProject: mockedOpenProject } = await import('../src/lib/open.js');
+
+    const result = await mockedOpenProject({ projectPath: tmpDir, editorPath, autoDismissLaunchErrors: false });
+
+    expect(result.kind).toBe('success');
+    expect(fs.readFileSync(configPath, 'utf-8')).toBe(original);
+  });
+
   it('rejects an empty string editorPath without spawning the editor', async () => {
     // Regression for review: `path.resolve('')` is `process.cwd()`,
     // which would otherwise pass `existsSync` and lead us to spawn
```

---

### Incident Patch 10: `176ef22d` (2026-09-23)
**Commit Message**: fix(project-keys): code-review — signed-in-only mint, key survives sign-out, report failed rewrites

- Signed-out Configure writes synchronously (cached key or URL-only) instead of
  a pointless busy round-trip; KnownKey no longer drops a non-expiring key on
  sign-out, so key-carrying configs don't flip to reconfigure-needed.
- KnownKey ignores a cache entry with no recorded account (get-or-mint never
  reuses it).
- Regenerate reports configs that could not be rewritten (they still carry
  the revoked key).
- Status row reuses the container's settings snapshot (fewer cache reads).
- lib.test.ts: the wire-compatible setupMcp test injects the signed-out
  resolver, so no test can mint a real key.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Mer91zRikZmjaCsydhCED6

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Editor/Scripts/Services/ProjectKeyService.cs` (modified, +7/-5)
```diff
@@ -75,18 +75,20 @@ static ProjectKeyProvider Provider
 
         /// <summary>
         /// The cached project key the agent configs for <paramref name="pin"/> are expected to carry, or <c>null</c>
-        /// for the URL-only config. Never touches the network; signed out, or a key cached for another account,
-        /// ⇒ <c>null</c> (contract §6).
+        /// for the URL-only config. Never touches the network. A key does not depend on the login (it never expires),
+        /// so signing out does not turn configs that carry it into "reconfigure needed"; a key cached for a
+        /// different signed-in account is ignored (contract §6).
         /// </summary>
         public static string? KnownKey(string pin)
         {
-            if (!AccountCredentialService.IsSignedIn)
-                return null;
             try
             {
                 var entry = Provider.Store.Get(Issuer, pin);
                 var subject = AccountCredentialService.Provider.Subject;
-                return entry != null && (entry.Sub == null || subject == null || entry.Sub == subject)
+                // An entry with no recorded account is never reused by GetOrMintAsync (it requires an exact sub
+                // match), so Configure would mint a replacement — expecting it here would report a config as
+                // "Configured" that the next Configure silently rewrites with a different key.
+                return entry != null && entry.Sub != null && (subject == null || entry.Sub == subject)
                     ? entry.Key
                     : null;
             }
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Editor/Scripts/UI/AiAgentConfigurators/AiAgentConfiguratorView.cs` (modified, +25/-12)
```diff
@@ -306,7 +306,7 @@ private void BuildTransportContainer(VisualElement container, TransportMethod tr
             // (the Custom configurator's GetStatus is always NotConfigured and it has no
             // writable config file, so it gets no status row, matching the old behaviour).
             if (HasDetectableConfig)
-                container.Add(BuildConfigureStatusRow(transport));
+                container.Add(BuildConfigureStatusRow(transport, settings));
 
             foreach (var section in description.Sections)
                 container.Add(BuildSection(section, transport));
@@ -488,14 +488,15 @@ private void SetupSignInChip()
         /// <summary>The outcome of the last project-key action, shown in the key row until the next action.</summary>
         private string? _keyMessage;
 
-        private VisualElement BuildConfigureStatusRow(TransportMethod transport)
+        /// <param name="settings">The container's snapshot (<see cref="CurrentSettings"/>), passed down so one refresh
+        /// reads the project-key cache once per container instead of once per element.</param>
+        private VisualElement BuildConfigureStatusRow(TransportMethod transport, AgentConfig.AgentConfiguratorSettings settings)
         {
             var root = new UITemplate<VisualElement>("Editor/UI/uxml/agents/elements/TemplateConfigureStatus.uxml").Value;
             var statusText = root.Q<Label>("configureStatusText") ?? throw new NullReferenceException("Label 'configureStatusText' not found in UI.");
             var btnConfigure = root.Q<Button>("btnConfigure") ?? throw new NullReferenceException("Button 'btnConfigure' not found in UI.");
             var btnRemove = root.Q<Button>("btnRemoveConfig") ?? throw new NullReferenceException("Button 'btnRemoveConfig' not found in UI.");
 
-            var settings = CurrentSettings();
             var config = GetConfig(settings, transport);
 
             var pathLabel = root.Q<Label>("labelConfigPath");
@@ -505,7 +506,7 @@ private VisualElement BuildConfigureStatusRow(TransportMethod transport)
                 pathLabel.tooltip = config.ConfigPath;
             }
 
-            UpdateStatusRow(statusText, btnConfigure, btnRemove, transport);
+            UpdateStatusRow(statusText, btnConfigure, btnRemove, transport, settings);
 
             btnConfigure.tooltip = $"Write the MCP entry into {AgentName}'s config file";
             btnRemove.tooltip = $"Remove the MCP entry from {AgentName}'s config file";
@@ -570,9 +571,11 @@ private AgentConfig.AiAgentConfig GetConfig(AgentConfig.AgentConfiguratorSetting
         private void ConfigureTransport(TransportMethod transport)
         {
             var settings = AgentConfiguratorSettingsFactory.Create();
-            if (transport == TransportMethod.stdio || !IsCloud(settings))
+            // No project key outside Cloud http, and none can be minted while signed out — write synchronously,
+            // without the busy round-trip: the local config, or (signed out) the still-valid cached key / URL-only.
+            if (transport == TransportMethod.stdio || !IsCloud(settings) || !AccountCredentialService.IsSignedIn)
             {
-                GetConfig(settings, transport).Configure(); // no project key outside Cloud http
+                GetConfig(WithKnownProjectKey(settings), transport).Configure();
                 RefreshConfigurationUI();
                 return;
             }
@@ -602,8 +605,12 @@ private void RegenerateProjectKey()
                 {
                     if (key == null)
                         return "Could not regenerate the project key (sign-in or server unavailable) — nothing was changed.";
-                    var rewritten = RewriteHttpConfigs(previous, previous.WithProjectKey(key));
-                    return $"Project key regenerated — {rewritten} agent config(s) rewritten.";
+                    var (rewritten, failed) = RewriteHttpConfigs(previous, previous.WithProjectKey(key));
+                    // The provider has already revoked the previous key, so a config that could not be rewritten
+                    // still carries a dead credential — say so instead of reporting only the successes.
+                    return failed == 0
+                        ? $"Project key regenerated — {rewritten} agent config(s) rewritten."
+                        : $"Project key regenerated — {rewritten} agent config(s) rewritten, {failed} could not be rewritten and still carry the revoked key; press Configure on those agents (see the Console).";
                 });
         }
 
@@ -612,9 +619,10 @@ private void RegenerateProjectKey()
         /// the replaced key, or is the URL-only config) so it carries <paramref name="next"/>'s key. Agents configured
         /// for stdio, or not configured at all, are left untouched.
         /// </summary>
-        private static int RewriteHttpConfigs(AgentConfig.AgentConfiguratorSettings previous, AgentConfig.AgentConfiguratorSettings 
```

**File**: `cli/tests/lib.test.ts` (modified, +2/-0)
```diff
@@ -487,6 +487,8 @@ describe('setupMcp', () => {
       agentId: listAgentIds()[0],
       unityProjectPath: tmpDir,
       transport: 'http',
+      // Signed-out resolver: the default one would read the real machine login and mint a real key.
+      projectKeyResolver: async () => ({ kind: 'no-login', reason: 'not signed in' }),
     });
     expect(ok.success).toBe(ok.kind === 'success');
 
```

---

### Incident Patch 11: `53338d6c` (2026-09-16)
**Commit Message**: test(chain): de-duplicate repeated fixture field names in ChainRecordTests

Replaces the 11 repeated wire-format string literals in ChainRecordTests.cs
with private consts inside the test class. Every const value is byte-identical
to the literal it replaced, verified by back-substituting the const table into
the new file and diffing against HEAD: the result is byte-identical, so no
emitted JSON key or value changed and the committed fixtures under
tests/chain-fixtures/ are unaffected.

No cross-assembly constant was applicable. ContentType (McpPlugin.Common) was
already used for every content-block type VALUE, matching the reference
recorder RawDump.cs exactly. ReflectorNet's JsonSchema consts were deliberately
NOT used: their spellings collide with MCP envelope keys by coincidence of two
independent specifications, and the in-repo convention (Tool.List.cs,
Type.GetJsonSchema.cs) applies them only where the JSON being manipulated
actually IS a JSON Schema document.

No asmdef change; defineConstraints untouched.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01ELWKnA7Gi7Rnq2zsjCcVo5

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Tests/Editor/Chain/ChainRecordTests.cs` (modified, +47/-25)
```diff
@@ -57,6 +57,28 @@ public class ChainRecordTests
         const int FixtureSchema = 1;
         const float TimeoutSeconds = 300f;
 
+        // ── Fixture field names and envelope values (format: MCP-Plugin-dotnet docs/chain-fixtures.md §F1) ──
+        // LOCAL de-duplication only; these are NOT a new contract. None of these names has a public
+        // constant in any assembly Unity receives: the fixture format's own field tables live in
+        // McpPlugin.NullEngine's FixtureLoader, whose project is IsPackable=false (no DLL in Unity's
+        // NuGet drop) and whose field arrays are internal — and the reference recorder RawDump.cs
+        // writes them inline for the same reason. Hoisted only where a name repeats, so that a typo
+        // cannot desync a write site from its matching read site (schema/name/args) or the success
+        // envelope from the error envelope (status/content/errorKind).
+        // Every value here is byte-identical to the literal it replaced; the committed fixtures under
+        // tests/chain-fixtures/ are what enforces that.
+        const string FieldSchema = "schema";
+        const string FieldKind = "kind";
+        const string FieldName = "name";
+        const string FieldArgs = "args";
+        const string FieldStatus = "status";
+        const string FieldContent = "content";
+        const string FieldErrorKind = "errorKind";
+        const string FieldType = "type";
+        const string FieldText = "text";
+        const string FieldMimeType = "mimeType";
+        const string StatusError = "error";
+
         [UnityTest]
         public IEnumerator RecordEditorToolContract()
         {
@@ -117,8 +139,8 @@ static string ResolvePath(string projectRoot, string path)
 
             var meta = new JsonObject
             {
-                ["schema"] = FixtureSchema,
-                ["kind"] = "meta",
+                [FieldSchema] = FixtureSchema,
+                [FieldKind] = "meta",
                 ["engine"] = "unity",
                 ["engine_version"] = engineVersion,
                 ["surface"] = "editor",
@@ -144,9 +166,9 @@ static string ResolvePath(string projectRoot, string path)
 
                 var line = new JsonObject
                 {
-                    ["kind"] = "call",
-                    ["name"] = name,
-                    ["args"] = callArgs,
+                    [FieldKind] = "call",
+                    [FieldName] = name,
+                    [FieldArgs] = callArgs,
                     ["response"] = ProjectResponse(outer)
                 };
                 lines.Add(line.ToJsonString());
@@ -171,7 +193,7 @@ static string ResolvePath(string projectRoot, string path)
             var document = JsonNode.Parse(File.ReadAllText(path, Encoding.UTF8)) as JsonObject
                 ?? throw new InvalidOperationException($"battery {path} must be a JSON object");
 
-            var schema = document["schema"]?.ToJsonString();
+            var schema = document[FieldSchema]?.ToJsonString();
             if (schema != FixtureSchema.ToString(CultureInfo.InvariantCulture))
                 throw new InvalidOperationException($"battery {path}: schema mismatch - expected {FixtureSchema}, got {schema ?? "<missing>"}");
 
@@ -181,12 +203,12 @@ static string ResolvePath(string projectRoot, string path)
             var result = new List<(string, JsonObject)>();
             foreach (var item in calls)
             {
-                var name = (item as JsonObject)?["name"]?.GetValue<string>();
+                var name = (item as JsonObject)?[FieldName]?.GetValue<string>();
                 if (string.IsNullOrEmpty(name))
                     throw new InvalidOperationException($"battery {path}: every call needs a 'name'");
 
                 // Detached copy: a node can have only one parent, and the battery document owns this one.
-                var args = item!["args"] is JsonObject source
+                var args = item![FieldArgs] is JsonObject source
                     ? (JsonObject)JsonNode.Parse(source.ToJsonString())!
                     : new JsonObject();
                 result.Add((name!, args));
@@ -215,8 +237,8 @@ static JsonObject ToolLine(ResponseListTool tool)
         {
             var line = new JsonObject
             {
-                ["kind"] = "tool",
-                ["name"] = tool.Name
+                [FieldKind] = "tool",
+                [FieldName] = tool.Name
             };
             if (!string.IsNullOrEmpty(tool.Title))
                 line["title"] = tool.Title;
@@ -259,24 +281,24 @@ static JsonObject ProjectResponse(ResponseData<ResponseCallTool> outer)
 
             var response = new JsonObject
             {
-                ["status"] = value.Status == ResponseStatus.Error ? "error" : "success",
-                ["content"] = content
+                [FieldStatus] = value.Status == ResponseStatus.Error ? StatusError : "success",
+                [FieldContent] = content
      
```

---

### Incident Patch 12: `713ca3e2` (2026-09-14)
**Commit Message**: ci: T2 chain record leg — in-process editor tool-contract recorder + fixture diff (#981)

Adds Unity-MCP's T2 chain record leg: an in-process EditMode recorder that dumps the editor tool contract, per-version committed fixtures, a byte-identical vendored chain_fixture.py, and base/editmode CI steps that canonicalise and diff the recording (fixture-missing and contract-change both fail).

**File**: `.gitattributes` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+# T2 chain fixtures are compared BYTE-for-byte (MCP-Plugin-dotnet docs/chain-fixtures.md §F1), and the
+# vendored chain_fixture.py is checked by sha256 against its canonical copy. A CRLF working copy
+# (core.autocrlf=true on Windows) would break both, so pin them to LF.
+/tests/chain-fixtures/** text eol=lf
+/.github/scripts/chain_fixture.py text eol=lf
```

**File**: `.github/scripts/chain_fixture.py` (added, +888/-0)
```diff
@@ -0,0 +1,888 @@
+#!/usr/bin/env python3
+# CANONICAL COPY - engine repos vendor this file to .github/scripts/chain_fixture.py
+# byte-identically (same rule as chain_feed.py, chain-testing 02 section C8). Edit it here,
+# then re-vendor; a drifted copy is a defect, and `chain_fixture.py hash --file <path>`
+# is what a vendor check compares.
+#
+# T2 record / replay fixture tool. The format it reads and writes is specified in
+# docs/chain-fixtures.md (F1 file, F2 canonicalisation, F3 masking, F4 caps, F5 diff,
+# F6 replay); this file and McpPlugin.NullEngine/src/Replay/FixtureLoader.cs are the two
+# implementations of F2-F4, kept in step by a differential test
+# (McpPlugin.Tests/Chain/CanonicalizeParityTests.cs).
+#
+# Stdlib only, Python 3.9+: it runs on hosted `python3`, on Unreal Engine's bundled
+# Python 3.11 and on the Windows dev box. Nothing here may import a third-party module.
+"""Record, canonicalise, diff and hash T2 chain fixtures.
+
+Subcommands
+    record        drive an MCP server over Streamable HTTP and write a canonical fixture
+    canonicalize  rewrite a fixture (or a raw dump) in canonical form
+    diff          compare a committed fixture against a fresh one
+    hash          sha256 of a file, or the args_hash of a JSON arguments document
+
+Exit codes
+    0  success / fixtures identical
+    2  usage error
+    3  contract-change (diff found a difference)
+    4  schema mismatch, or a fixture over the size cap
+    5  record failed to talk to the server
+"""
+
+from __future__ import annotations
+
+import argparse
+import datetime
+import difflib
+import hashlib
+import json
+import os
+import re
+import sys
+import urllib.error
+import urllib.request
+
+CHAIN_FIXTURE_VERSION = "1"
+
+#: The only fixture schema this build understands. A fixture carrying anything else is a
+#: schema mismatch (exit 4) rather than a contract change: the two files are not comparable.
+FIXTURE_SCHEMA = 1
+
+#: F4. A canonical response larger than this is stored as {"$hash": ..., "$bytes": n}.
+MAX_RESPONSE_BYTES = 32 * 1024
+
+#: F4. A whole canonical fixture larger than this fails canonicalisation.
+MAX_FIXTURE_BYTES = 256 * 1024
+
+EXIT_OK = 0
+EXIT_USAGE = 2
+EXIT_CONTRACT_CHANGE = 3
+EXIT_SCHEMA = 4
+EXIT_RECORD_FAILED = 5
+
+RECORDER_MCP_CLIENT = "mcp-client"
+RECORDER_IN_PROCESS = "in-process"
+
+#: F3. Meta fields that name WHICH bits produced the fixture rather than what the contract
+#: is. Kept in the file for humans, replaced by a placeholder in the comparison form.
+PROVENANCE_META = {
+    "recorded_at": "<ts>",
+    "plugin_version": "<version>",
+    "mcp_plugin_version": "<version>",
+}
+
+#: F3 (cross-recorder). `meta.recorder` is determined by HOW the fixture was captured, and
+#: `response.errorKind` is observable ONLY in-process - the MCP wire drops it
+#: (McpPlugin.Server/src/Extension/ExtensionsTool.cs:92-101 maps Status/Content/
+#: StructuredContent and nothing else). Masked only under --cross-recorder, so the default
+#: diff an engine leg runs stays strict on both.
+CROSS_RECORDER_META = {"recorder": "<recorder>"}
+
+#: F1 content-block fields. Anything else an SDK happens to serialise is dropped, so a
+#: transport-library upgrade cannot show up as a contract change.
+CONTENT_BLOCK_FIELDS = ("type", "text", "data", "mimeType", "resource")
+
+#: F1 tool-line fields, in addition to "kind" and "name".
+TOOL_FIELDS = (
+    "title",
+    "description",
+    "inputSchema",
+    "outputSchema",
+    "readOnlyHint",
+    "destructiveHint",
+    "idempotentHint",
+    "openWorldHint",
+)
+
+# ---------------------------------------------------------------------------------------
+# F3 masking rules. Applied to STRING VALUES inside a call's `response` subtree, in this
+# exact order, plus the key-driven rules below. The C# mirror carries the same table; the
+# parity test reddens if either drifts.
+# ---------------------------------------------------------------------------------------
+
+RE_TIMESTAMP = re.compile(
+    r"\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:?\d{2})?"
+)
+RE_GUID = re.compile(
+    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
+)
+# A drive letter must not be the tail of a longer word, else "http:" in a URL would match.
+RE_WINDOWS_PATH = re.compile(r"(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s\"'<>|]*")
+# The negative lookahead is what keeps "/variable" from being read as "/var" + junk.
+RE_POSIX_PATH = re.compile(
+    r"(?<![A-Za-z0-9._\-])/(?:Users|home|tmp|var|private|opt|mnt|Volumes)"
+    r"(?![A-Za-z0-9])[^\s\"'<>|]*"
+)
+RE_URL_PORT = re.compile(r"(://[^\s/:\"'<>|]+):\d{1,5}")
+RE_DURATION_MS = re.compile(r"\b\d+(?:\.\d+)?\s*ms\b")
+
+#: Key-driven masking: the member's whole value becomes the placeholder, whatever its JSON
+#: type, because a pid / port / duration is usually a NUMBER and a regex over strings can
+#: never reach it. Deliberately a short, explicit list - a generic name like "ms" 
```

**File**: `.github/workflows/test_unity_plugin.yml` (modified, +60/-1)
```diff
@@ -144,7 +144,10 @@ jobs:
           testMode: ${{ inputs.testMode }}
           customImage: ${{ steps.custom_image.outputs.image }}
           artifactsPath: artifacts-${{ inputs.unityVersion }}-${{ inputs.testMode }}-${{ matrix.platform }}
-          customParameters: -CI true -GITHUB_ACTIONS true
+          # The base/editmode leg also runs the T2 chain recorder (Tests/Editor/Chain/ChainRecordTests.cs).
+          # Both paths are RELATIVE TO THE UNITY PROJECT ROOT (the recorder resolves them there), so they
+          # mean the same files inside the game-ci container and on the host, and contain no spaces.
+          customParameters: -CI true -GITHUB_ACTIONS true${{ (matrix.platform == 'base' && inputs.testMode == 'editmode') && ' -CHAIN_RECORD_OUT chain-record/raw.json -CHAIN_BATTERY ../../tests/chain-fixtures/battery.json' || '' }}
 
       # --------------------------------------------------------------------- #
       - uses: actions/upload-artifact@v6
@@ -153,6 +156,62 @@ jobs:
           name: Test results for ${{ inputs.unityVersion }} ${{ inputs.testMode }} on ${{ matrix.platform }}
           path: ${{ steps.tests.outputs.artifactsPath }}
 
+      # --------------------------------------------------------------------- #
+      # 2-c'. T2 chain fixture (MCP-Plugin-dotnet docs/chain-fixtures.md §F5) — base/editmode legs only.
+      #
+      # Canonicalises the recorder's raw dump and diffs it against the committed
+      # tests/chain-fixtures/<unityVersion>/tools.jsonl. Outputs go to RUNNER_TEMP, not the checkout:
+      # the Unity container created chain-record/ as root, so the host user cannot write beside it.
+      # A missing committed fixture FAILS (fixture-missing) — a leg can never go green without one.
+      # --------------------------------------------------------------------- #
+      - name: chain fixture diff
+        if: ${{ !cancelled() && matrix.platform == 'base' && inputs.testMode == 'editmode' }}
+        shell: bash
+        env:
+          RAW: ${{ inputs.projectPath }}/chain-record/raw.json
+          COMMITTED: tests/chain-fixtures/${{ inputs.unityVersion }}/tools.jsonl
+          OUT_DIR: ${{ runner.temp }}/chain-fixture-unity-${{ inputs.unityVersion }}
+        run: |
+          set +e
+          mkdir -p "$OUT_DIR"
+          if [ ! -f "$RAW" ]; then
+            echo "::error title=chain fixture::raw-dump-missing: $RAW was not written - ChainRecordTests did not run or failed (see the Unity test step)"
+            exit 1
+          fi
+          python3 -c 'import json,sys; k=[json.loads(l).get("kind") for l in open(sys.argv[1],encoding="utf-8") if l.strip()]; print("chain-record: %d tools, %d calls -> raw.json" % (k.count("tool"), k.count("call")))' "$RAW"
+
+          python3 .github/scripts/chain_fixture.py canonicalize "$RAW" --out "$OUT_DIR/fresh.jsonl"
+          rc=$?
+          if [ "$rc" -ne 0 ]; then
+            cp "$RAW" "$OUT_DIR/raw.json"   # no fresh.jsonl to review, so the raw dump is the only evidence
+            echo "::error title=chain fixture::canonicalize exited $rc"
+            exit "$rc"
+          fi
+
+          if [ ! -f "$COMMITTED" ]; then
+            echo "::error title=chain fixture::fixture-missing: $COMMITTED is not committed. Review fresh.jsonl in the chain-fixture-unity-${{ inputs.unityVersion }} artifact and commit it."
+            exit 1
+          fi
+
+          python3 .github/scripts/chain_fixture.py diff "$COMMITTED" "$OUT_DIR/fresh.jsonl" > "$OUT_DIR/diff.txt"
+          rc=$?
+          cat "$OUT_DIR/diff.txt"
+          case "$rc" in
+            0) echo "chain fixture: identical to $COMMITTED (diff exit 0)" ;;
+            3) echo "::error title=chain fixture::contract-change: the editor tool contract differs from $COMMITTED (unified diff above and in diff.txt)"; exit 3 ;;
+            *) echo "::error title=chain fixture::diff exited $rc"; exit "$rc" ;;
+          esac
+
+      - name: chain fixture artifact
+        if: ${{ always() && matrix.platform == 'base' && inputs.testMode == 'editmode' }}
+        uses: actions/upload-artifact@v6
+        with:
+          name: chain-fixture-unity-${{ inputs.unityVersion }}
+          path: ${{ runner.temp }}/chain-fixture-unity-${{ inputs.unityVersion }}
+          if-no-files-found: warn
+          # Review aid only (fresh.jsonl to commit, diff.txt): the replay side reads the COMMITTED fixture.
+          retention-days: 1
+
       # --------------------------------------------------------------------- #
       # 2-d. Chain leg record (chain_feed.py §C5) — one artifact per job (12 distinct names)
       # --------------------------------------------------------------------- #
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Tests/Editor/Chain.meta` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+fileFormatVersion: 2
+guid: df70d0b4df7c49c2901ac3d7d2690056
+folderAsset: yes
+DefaultImporter:
+  externalObjects: {}
+  userData:
+  assetBundleName:
+  assetBundleVariant:
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Tests/Editor/Chain/ChainRecordTests.cs` (added, +321/-0)
```diff
@@ -0,0 +1,321 @@
+/*
+┌──────────────────────────────────────────────────────────────────┐
+│  Author: Ivan Murzak (https://github.com/IvanMurzak)             │
+│  Repository: GitHub (https://github.com/IvanMurzak/Unity-MCP)    │
+│  Copyright (c) 2025 Ivan Murzak                                  │
+│  Licensed under the Apache License, Version 2.0.                 │
+│  See the LICENSE file in the project root for more information.  │
+└──────────────────────────────────────────────────────────────────┘
+*/
+
+#nullable enable
+using System;
+using System.Collections;
+using System.Collections.Generic;
+using System.Globalization;
+using System.IO;
+using System.Reflection;
+using System.Runtime.ExceptionServices;
+using System.Text;
+using System.Text.Json;
+using System.Text.Json.Nodes;
+using System.Threading.Tasks;
+using com.IvanMurzak.McpPlugin;
+using com.IvanMurzak.McpPlugin.Common.Model;
+using com.IvanMurzak.McpPlugin.Common.Utils;
+using NUnit.Framework;
+using UnityEngine;
+using UnityEngine.TestTools;
+using ContentType = com.IvanMurzak.McpPlugin.Common.Consts.ContentType;
+
+namespace com.IvanMurzak.Unity.MCP.Editor.Tests.Chain
+{
+    /// <summary>
+    /// T2 chain recorder (IN-PROCESS): dumps the editor's own tool contract — <c>tools/list</c> plus
+    /// one <c>tools/call</c> per battery entry — as an F1-shaped raw dump, the format defined by
+    /// MCP-Plugin-dotnet <c>docs/chain-fixtures.md</c>. The CI leg then runs
+    /// <c>.github/scripts/chain_fixture.py canonicalize</c> + <c>diff</c> against
+    /// <c>tests/chain-fixtures/&lt;unity-version&gt;/tools.jsonl</c>.
+    ///
+    /// <para>Active ONLY when the editor was started with <c>-CHAIN_RECORD_OUT &lt;path&gt;</c> (and
+    /// <c>-CHAIN_BATTERY &lt;path&gt;</c>); otherwise it is a named skip, so an ordinary Test Runner
+    /// run is unaffected. Relative paths resolve against the Unity PROJECT root, never the process
+    /// working directory, so the same arguments mean the same files inside the game-ci container
+    /// and on a developer machine.</para>
+    ///
+    /// <para><b>The response projection mirrors the server</b>, as MCP-Plugin-dotnet's reference
+    /// recorder <c>McpPlugin.NullEngine/src/Replay/RawDump.cs</c> does: an outer error discards the
+    /// response's own content and becomes one text block; a null value becomes a fixed text; a text
+    /// block loses its MimeType. What is recorded is what an MCP client observes. The serialisation
+    /// uses only the EXISTING pinned <c>ResponseListTool</c> / <c>ResponseCallTool</c> types and
+    /// <c>System.Text.Json</c> — no new plugin API, so this compiles against the pinned DLLs.</para>
+    /// </summary>
+    public class ChainRecordTests
+    {
+        const string ArgRecordOut = "CHAIN_RECORD_OUT";
+        const string ArgBattery = "CHAIN_BATTERY";
+        const int FixtureSchema = 1;
+        const float TimeoutSeconds = 300f;
+
+        [UnityTest]
+        public IEnumerator RecordEditorToolContract()
+        {
+            var args = ArgsUtils.ParseCommandLineArguments();
+            var outArg = Clean(args.GetValueOrDefault(ArgRecordOut));
+            if (string.IsNullOrEmpty(outArg))
+                Assert.Ignore("chain record not requested");
+
+            // The battery records ERROR contracts on purpose (e.g. an unknown tool), and the tool manager
+            // logs every such error. Those logs are the recorded behaviour, not a test failure; whether the
+            // recording is right is decided by the fixture diff on the host, not by the log stream.
+            LogAssert.ignoreFailingMessages = true;
+
+            var batteryArg = Clean(args.GetValueOrDefault(ArgBattery));
+            Assert.IsFalse(string.IsNullOrEmpty(batteryArg),
+                $"-{ArgRecordOut} was given without -{ArgBattery} <path>: the recorder needs a battery.");
+
+            // Unity API values are captured HERE, on the main thread; the recording itself runs on
+            // the thread pool so tools that marshal onto the main thread cannot deadlock on it.
+            var projectRoot = Path.GetDirectoryName(Application.dataPath)!;
+            var outPath = ResolvePath(projectRoot, outArg!);
+            var batteryPath = ResolvePath(projectRoot, batteryArg!);
+            var engineVersion = Application.unityVersion;
+
+            UnityMcpPluginEditor.InitSingletonIfNeeded();
+            UnityMcpPluginEditor.Instance.BuildMcpPluginIfNeeded();
+            var toolManager = UnityMcpPluginEditor.Instance.Tools;
+            Assert.IsNotNull(toolManager, "The MCP plugin was built but exposes no tool manager.");
+
+            var task = Task.Run(() => RecordAsync(toolManager!, outPath, batteryPath, engineVersion));
+
+            var startTime = Time.realtimeSinceStartup;
+            while (!task.IsCompleted)
+            {
+                if (Time.realtimeSinceStartup - startTime > TimeoutSeconds)
+                    Assert.Fail($"
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Tests/Editor/Chain/ChainRecordTests.cs.meta` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+fileFormatVersion: 2
+guid: 5b8868c027f34510a389315b4a686344
+MonoImporter:
+  externalObjects: {}
+  serializedVersion: 2
+  defaultReferences: []
+  executionOrder: 0
+  icon: {instanceID: 0}
+  userData:
+  assetBundleName:
+  assetBundleVariant:
```

**File**: `tests/chain-fixtures/battery.json` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+{
+  "schema": 1,
+  "_comment": [
+    "Unity-MCP's T2 chain battery (format: MCP-Plugin-dotnet docs/chain-fixtures.md). Recorded in-process",
+    "by Tests/Editor/Chain/ChainRecordTests.cs on the base/editmode game-ci legs; the committed result is",
+    "tests/chain-fixtures/<unity-version>/tools.jsonl.",
+    "READ-ONLY TOOLS ONLY: nothing here may mutate the project, the scene or editor state, because the",
+    "recorder runs inside the ordinary EditMode suite.",
+    "Only tools the tool manager actually registers: `ping` is a System tool and is NOT in it (measured:",
+    "Tool with Name 'ping' not found).",
+    "Every response must be DETERMINISTIC across runs of the same editor build, or the diff is noise:",
+    "editor-application-get-state (TimeSinceStartup) and profiler-get-status (MaxUsedMemoryMB) carry",
+    "unmasked volatile numbers, and scene-list-opened depends on which tests ran first - all excluded.",
+    "unity-tool-list appears twice with different arguments so the (name, args_hash) key is observable;",
+    "the unknown tool records the manager's not-found error contract."
+  ],
+  "calls": [
+    { "name": "unity-tool-list", "args": {} },
+    { "name": "unity-tool-list", "args": { "regexSearch": "^scene-", "includeDescription": true } },
+    { "name": "type-get-json-schema", "args": { "typeName": "UnityEngine.Vector3" } },
+    { "name": "chain-record-unknown-tool", "args": {} }
+  ]
+}
```

---

### Incident Patch 13: `013c83ed` (2026-09-14)
**Commit Message**: test: commit T2 chain fixtures recorded by the first CI run

Copied byte-for-byte from the chain-fixture-unity-<ver> artifacts of run
34793319736 (head 9ba5fac5), which failed fixture-missing by design on
all three base/editmode legs. 73 tools, 4 battery calls per version.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01SJtdYLM85WG7fP5v7aVi5i



---

### Incident Patch 14: `9ba5fac5` (2026-09-14)
**Commit Message**: ci: T2 chain record leg - in-process editor tool-contract recorder + fixture diff

Adds the Unity half of the T2 record/replay contract (MCP-Plugin-dotnet
docs/chain-fixtures.md, PR #223):

- Tests/Editor/Chain/ChainRecordTests.cs: one EditMode test, active only
  with -CHAIN_RECORD_OUT/-CHAIN_BATTERY (named skip otherwise). Drives
  IToolManager.RunListTool + RunCallTool in-process and writes the F1 raw
  dump, mirroring the reference RawDump projection with pinned types only.
- tests/chain-fixtures/battery.json: read-only, deterministic calls.
- .github/scripts/chain_fixture.py: byte-identical vendored copy of MPD
  scripts/chain_fixture.py at 3a17ab4 (sha256 aa87b1fd...).
- test_unity_plugin.yml: base/editmode legs record, canonicalise and diff
  against tests/chain-fixtures/<unityVersion>/tools.jsonl (fixture-missing
  and contract-change both fail) and upload chain-fixture-unity-<ver>.
- .gitattributes: pin fixtures and the vendored script to LF.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01SJtdYLM85WG7fP5v7aVi5i

**File**: `.gitattributes` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+# T2 chain fixtures are compared BYTE-for-byte (MCP-Plugin-dotnet docs/chain-fixtures.md §F1), and the
+# vendored chain_fixture.py is checked by sha256 against its canonical copy. A CRLF working copy
+# (core.autocrlf=true on Windows) would break both, so pin them to LF.
+/tests/chain-fixtures/** text eol=lf
+/.github/scripts/chain_fixture.py text eol=lf
```

**File**: `.github/scripts/chain_fixture.py` (added, +888/-0)
```diff
@@ -0,0 +1,888 @@
+#!/usr/bin/env python3
+# CANONICAL COPY - engine repos vendor this file to .github/scripts/chain_fixture.py
+# byte-identically (same rule as chain_feed.py, chain-testing 02 section C8). Edit it here,
+# then re-vendor; a drifted copy is a defect, and `chain_fixture.py hash --file <path>`
+# is what a vendor check compares.
+#
+# T2 record / replay fixture tool. The format it reads and writes is specified in
+# docs/chain-fixtures.md (F1 file, F2 canonicalisation, F3 masking, F4 caps, F5 diff,
+# F6 replay); this file and McpPlugin.NullEngine/src/Replay/FixtureLoader.cs are the two
+# implementations of F2-F4, kept in step by a differential test
+# (McpPlugin.Tests/Chain/CanonicalizeParityTests.cs).
+#
+# Stdlib only, Python 3.9+: it runs on hosted `python3`, on Unreal Engine's bundled
+# Python 3.11 and on the Windows dev box. Nothing here may import a third-party module.
+"""Record, canonicalise, diff and hash T2 chain fixtures.
+
+Subcommands
+    record        drive an MCP server over Streamable HTTP and write a canonical fixture
+    canonicalize  rewrite a fixture (or a raw dump) in canonical form
+    diff          compare a committed fixture against a fresh one
+    hash          sha256 of a file, or the args_hash of a JSON arguments document
+
+Exit codes
+    0  success / fixtures identical
+    2  usage error
+    3  contract-change (diff found a difference)
+    4  schema mismatch, or a fixture over the size cap
+    5  record failed to talk to the server
+"""
+
+from __future__ import annotations
+
+import argparse
+import datetime
+import difflib
+import hashlib
+import json
+import os
+import re
+import sys
+import urllib.error
+import urllib.request
+
+CHAIN_FIXTURE_VERSION = "1"
+
+#: The only fixture schema this build understands. A fixture carrying anything else is a
+#: schema mismatch (exit 4) rather than a contract change: the two files are not comparable.
+FIXTURE_SCHEMA = 1
+
+#: F4. A canonical response larger than this is stored as {"$hash": ..., "$bytes": n}.
+MAX_RESPONSE_BYTES = 32 * 1024
+
+#: F4. A whole canonical fixture larger than this fails canonicalisation.
+MAX_FIXTURE_BYTES = 256 * 1024
+
+EXIT_OK = 0
+EXIT_USAGE = 2
+EXIT_CONTRACT_CHANGE = 3
+EXIT_SCHEMA = 4
+EXIT_RECORD_FAILED = 5
+
+RECORDER_MCP_CLIENT = "mcp-client"
+RECORDER_IN_PROCESS = "in-process"
+
+#: F3. Meta fields that name WHICH bits produced the fixture rather than what the contract
+#: is. Kept in the file for humans, replaced by a placeholder in the comparison form.
+PROVENANCE_META = {
+    "recorded_at": "<ts>",
+    "plugin_version": "<version>",
+    "mcp_plugin_version": "<version>",
+}
+
+#: F3 (cross-recorder). `meta.recorder` is determined by HOW the fixture was captured, and
+#: `response.errorKind` is observable ONLY in-process - the MCP wire drops it
+#: (McpPlugin.Server/src/Extension/ExtensionsTool.cs:92-101 maps Status/Content/
+#: StructuredContent and nothing else). Masked only under --cross-recorder, so the default
+#: diff an engine leg runs stays strict on both.
+CROSS_RECORDER_META = {"recorder": "<recorder>"}
+
+#: F1 content-block fields. Anything else an SDK happens to serialise is dropped, so a
+#: transport-library upgrade cannot show up as a contract change.
+CONTENT_BLOCK_FIELDS = ("type", "text", "data", "mimeType", "resource")
+
+#: F1 tool-line fields, in addition to "kind" and "name".
+TOOL_FIELDS = (
+    "title",
+    "description",
+    "inputSchema",
+    "outputSchema",
+    "readOnlyHint",
+    "destructiveHint",
+    "idempotentHint",
+    "openWorldHint",
+)
+
+# ---------------------------------------------------------------------------------------
+# F3 masking rules. Applied to STRING VALUES inside a call's `response` subtree, in this
+# exact order, plus the key-driven rules below. The C# mirror carries the same table; the
+# parity test reddens if either drifts.
+# ---------------------------------------------------------------------------------------
+
+RE_TIMESTAMP = re.compile(
+    r"\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:?\d{2})?"
+)
+RE_GUID = re.compile(
+    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
+)
+# A drive letter must not be the tail of a longer word, else "http:" in a URL would match.
+RE_WINDOWS_PATH = re.compile(r"(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s\"'<>|]*")
+# The negative lookahead is what keeps "/variable" from being read as "/var" + junk.
+RE_POSIX_PATH = re.compile(
+    r"(?<![A-Za-z0-9._\-])/(?:Users|home|tmp|var|private|opt|mnt|Volumes)"
+    r"(?![A-Za-z0-9])[^\s\"'<>|]*"
+)
+RE_URL_PORT = re.compile(r"(://[^\s/:\"'<>|]+):\d{1,5}")
+RE_DURATION_MS = re.compile(r"\b\d+(?:\.\d+)?\s*ms\b")
+
+#: Key-driven masking: the member's whole value becomes the placeholder, whatever its JSON
+#: type, because a pid / port / duration is usually a NUMBER and a regex over strings can
+#: never reach it. Deliberately a short, explicit list - a generic name like "ms" 
```

**File**: `.github/workflows/test_unity_plugin.yml` (modified, +58/-1)
```diff
@@ -144,7 +144,10 @@ jobs:
           testMode: ${{ inputs.testMode }}
           customImage: ${{ steps.custom_image.outputs.image }}
           artifactsPath: artifacts-${{ inputs.unityVersion }}-${{ inputs.testMode }}-${{ matrix.platform }}
-          customParameters: -CI true -GITHUB_ACTIONS true
+          # The base/editmode leg also runs the T2 chain recorder (Tests/Editor/Chain/ChainRecordTests.cs).
+          # Both paths are RELATIVE TO THE UNITY PROJECT ROOT (the recorder resolves them there), so they
+          # mean the same files inside the game-ci container and on the host, and contain no spaces.
+          customParameters: -CI true -GITHUB_ACTIONS true${{ (matrix.platform == 'base' && inputs.testMode == 'editmode') && ' -CHAIN_RECORD_OUT chain-record/raw.json -CHAIN_BATTERY ../../tests/chain-fixtures/battery.json' || '' }}
 
       # --------------------------------------------------------------------- #
       - uses: actions/upload-artifact@v6
@@ -153,6 +156,60 @@ jobs:
           name: Test results for ${{ inputs.unityVersion }} ${{ inputs.testMode }} on ${{ matrix.platform }}
           path: ${{ steps.tests.outputs.artifactsPath }}
 
+      # --------------------------------------------------------------------- #
+      # 2-c'. T2 chain fixture (MCP-Plugin-dotnet docs/chain-fixtures.md §F5) — base/editmode legs only.
+      #
+      # Canonicalises the recorder's raw dump and diffs it against the committed
+      # tests/chain-fixtures/<unityVersion>/tools.jsonl. Outputs go to RUNNER_TEMP, not the checkout:
+      # the Unity container created chain-record/ as root, so the host user cannot write beside it.
+      # A missing committed fixture FAILS (fixture-missing) — a leg can never go green without one.
+      # --------------------------------------------------------------------- #
+      - name: chain fixture diff
+        if: ${{ !cancelled() && matrix.platform == 'base' && inputs.testMode == 'editmode' }}
+        shell: bash
+        env:
+          RAW: ${{ inputs.projectPath }}/chain-record/raw.json
+          COMMITTED: tests/chain-fixtures/${{ inputs.unityVersion }}/tools.jsonl
+          OUT_DIR: ${{ runner.temp }}/chain-fixture-unity-${{ inputs.unityVersion }}
+        run: |
+          set +e
+          mkdir -p "$OUT_DIR"
+          if [ ! -f "$RAW" ]; then
+            echo "::error title=chain fixture::raw-dump-missing: $RAW was not written - ChainRecordTests did not run or failed (see the Unity test step)"
+            exit 1
+          fi
+          cp "$RAW" "$OUT_DIR/raw.json"
+          python3 -c 'import json,sys; k=[json.loads(l).get("kind") for l in open(sys.argv[1],encoding="utf-8") if l.strip()]; print("chain-record: %d tools, %d calls -> raw.json" % (k.count("tool"), k.count("call")))' "$RAW"
+
+          python3 .github/scripts/chain_fixture.py canonicalize "$RAW" --out "$OUT_DIR/fresh.jsonl"
+          rc=$?
+          if [ "$rc" -ne 0 ]; then
+            echo "::error title=chain fixture::canonicalize exited $rc"
+            exit "$rc"
+          fi
+
+          if [ ! -f "$COMMITTED" ]; then
+            echo "::error title=chain fixture::fixture-missing: $COMMITTED is not committed. Review fresh.jsonl in the chain-fixture-unity-${{ inputs.unityVersion }} artifact and commit it."
+            exit 1
+          fi
+
+          python3 .github/scripts/chain_fixture.py diff "$COMMITTED" "$OUT_DIR/fresh.jsonl" > "$OUT_DIR/diff.txt"
+          rc=$?
+          cat "$OUT_DIR/diff.txt"
+          case "$rc" in
+            0) echo "chain fixture: identical to $COMMITTED (diff exit 0)" ;;
+            3) echo "::error title=chain fixture::contract-change: the editor tool contract differs from $COMMITTED (unified diff above and in diff.txt)"; exit 3 ;;
+            *) echo "::error title=chain fixture::diff exited $rc"; exit "$rc" ;;
+          esac
+
+      - name: chain fixture artifact
+        if: ${{ always() && matrix.platform == 'base' && inputs.testMode == 'editmode' }}
+        uses: actions/upload-artifact@v6
+        with:
+          name: chain-fixture-unity-${{ inputs.unityVersion }}
+          path: ${{ runner.temp }}/chain-fixture-unity-${{ inputs.unityVersion }}
+          if-no-files-found: warn
+
       # --------------------------------------------------------------------- #
       # 2-d. Chain leg record (chain_feed.py §C5) — one artifact per job (12 distinct names)
       # --------------------------------------------------------------------- #
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Tests/Editor/Chain.meta` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+fileFormatVersion: 2
+guid: df70d0b4df7c49c2901ac3d7d2690056
+folderAsset: yes
+DefaultImporter:
+  externalObjects: {}
+  userData:
+  assetBundleName:
+  assetBundleVariant:
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Tests/Editor/Chain/ChainRecordTests.cs` (added, +321/-0)
```diff
@@ -0,0 +1,321 @@
+/*
+┌──────────────────────────────────────────────────────────────────┐
+│  Author: Ivan Murzak (https://github.com/IvanMurzak)             │
+│  Repository: GitHub (https://github.com/IvanMurzak/Unity-MCP)    │
+│  Copyright (c) 2025 Ivan Murzak                                  │
+│  Licensed under the Apache License, Version 2.0.                 │
+│  See the LICENSE file in the project root for more information.  │
+└──────────────────────────────────────────────────────────────────┘
+*/
+
+#nullable enable
+using System;
+using System.Collections;
+using System.Collections.Generic;
+using System.Globalization;
+using System.IO;
+using System.Reflection;
+using System.Runtime.ExceptionServices;
+using System.Text;
+using System.Text.Json;
+using System.Text.Json.Nodes;
+using System.Threading.Tasks;
+using com.IvanMurzak.McpPlugin;
+using com.IvanMurzak.McpPlugin.Common.Model;
+using com.IvanMurzak.McpPlugin.Common.Utils;
+using NUnit.Framework;
+using UnityEngine;
+using UnityEngine.TestTools;
+using ContentType = com.IvanMurzak.McpPlugin.Common.Consts.ContentType;
+
+namespace com.IvanMurzak.Unity.MCP.Editor.Tests.Chain
+{
+    /// <summary>
+    /// T2 chain recorder (IN-PROCESS): dumps the editor's own tool contract — <c>tools/list</c> plus
+    /// one <c>tools/call</c> per battery entry — as an F1-shaped raw dump, the format defined by
+    /// MCP-Plugin-dotnet <c>docs/chain-fixtures.md</c>. The CI leg then runs
+    /// <c>.github/scripts/chain_fixture.py canonicalize</c> + <c>diff</c> against
+    /// <c>tests/chain-fixtures/&lt;unity-version&gt;/tools.jsonl</c>.
+    ///
+    /// <para>Active ONLY when the editor was started with <c>-CHAIN_RECORD_OUT &lt;path&gt;</c> (and
+    /// <c>-CHAIN_BATTERY &lt;path&gt;</c>); otherwise it is a named skip, so an ordinary Test Runner
+    /// run is unaffected. Relative paths resolve against the Unity PROJECT root, never the process
+    /// working directory, so the same arguments mean the same files inside the game-ci container
+    /// and on a developer machine.</para>
+    ///
+    /// <para><b>The response projection mirrors the server</b>, as MCP-Plugin-dotnet's reference
+    /// recorder <c>McpPlugin.NullEngine/src/Replay/RawDump.cs</c> does: an outer error discards the
+    /// response's own content and becomes one text block; a null value becomes a fixed text; a text
+    /// block loses its MimeType. What is recorded is what an MCP client observes. The serialisation
+    /// uses only the EXISTING pinned <c>ResponseListTool</c> / <c>ResponseCallTool</c> types and
+    /// <c>System.Text.Json</c> — no new plugin API, so this compiles against the pinned DLLs.</para>
+    /// </summary>
+    public class ChainRecordTests
+    {
+        const string ArgRecordOut = "CHAIN_RECORD_OUT";
+        const string ArgBattery = "CHAIN_BATTERY";
+        const int FixtureSchema = 1;
+        const float TimeoutSeconds = 300f;
+
+        [UnityTest]
+        public IEnumerator RecordEditorToolContract()
+        {
+            var args = ArgsUtils.ParseCommandLineArguments();
+            var outArg = Clean(args.GetValueOrDefault(ArgRecordOut));
+            if (string.IsNullOrEmpty(outArg))
+                Assert.Ignore("chain record not requested");
+
+            // The battery records ERROR contracts on purpose (e.g. an unknown tool), and the tool manager
+            // logs every such error. Those logs are the recorded behaviour, not a test failure; whether the
+            // recording is right is decided by the fixture diff on the host, not by the log stream.
+            LogAssert.ignoreFailingMessages = true;
+
+            var batteryArg = Clean(args.GetValueOrDefault(ArgBattery));
+            Assert.IsFalse(string.IsNullOrEmpty(batteryArg),
+                $"-{ArgRecordOut} was given without -{ArgBattery} <path>: the recorder needs a battery.");
+
+            // Unity API values are captured HERE, on the main thread; the recording itself runs on
+            // the thread pool so tools that marshal onto the main thread cannot deadlock on it.
+            var projectRoot = Path.GetDirectoryName(Application.dataPath)!;
+            var outPath = ResolvePath(projectRoot, outArg!);
+            var batteryPath = ResolvePath(projectRoot, batteryArg!);
+            var engineVersion = Application.unityVersion;
+
+            UnityMcpPluginEditor.InitSingletonIfNeeded();
+            UnityMcpPluginEditor.Instance.BuildMcpPluginIfNeeded();
+            var toolManager = UnityMcpPluginEditor.Instance.Tools;
+            Assert.IsNotNull(toolManager, "The MCP plugin was built but exposes no tool manager.");
+
+            var task = Task.Run(() => RecordAsync(toolManager!, outPath, batteryPath, engineVersion));
+
+            var startTime = Time.realtimeSinceStartup;
+            while (!task.IsCompleted)
+            {
+                if (Time.realtimeSinceStartup - startTime > TimeoutSeconds)
+                    Assert.Fail($"
```

**File**: `Unity-MCP-Plugin/Packages/com.ivanmurzak.unity.mcp/Tests/Editor/Chain/ChainRecordTests.cs.meta` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+fileFormatVersion: 2
+guid: 5b8868c027f34510a389315b4a686344
+MonoImporter:
+  externalObjects: {}
+  serializedVersion: 2
+  defaultReferences: []
+  executionOrder: 0
+  icon: {instanceID: 0}
+  userData:
+  assetBundleName:
+  assetBundleVariant:
```

**File**: `tests/chain-fixtures/battery.json` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+{
+  "schema": 1,
+  "_comment": [
+    "Unity-MCP's T2 chain battery (format: MCP-Plugin-dotnet docs/chain-fixtures.md). Recorded in-process",
+    "by Tests/Editor/Chain/ChainRecordTests.cs on the base/editmode game-ci legs; the committed result is",
+    "tests/chain-fixtures/<unity-version>/tools.jsonl.",
+    "READ-ONLY TOOLS ONLY: nothing here may mutate the project, the scene or editor state, because the",
+    "recorder runs inside the ordinary EditMode suite.",
+    "Only tools the tool manager actually registers: `ping` is a System tool and is NOT in it (measured:",
+    "Tool with Name 'ping' not found).",
+    "Every response must be DETERMINISTIC across runs of the same editor build, or the diff is noise:",
+    "editor-application-get-state (TimeSinceStartup) and profiler-get-status (MaxUsedMemoryMB) carry",
+    "unmasked volatile numbers, and scene-list-opened depends on which tests ran first - all excluded.",
+    "unity-tool-list appears twice with different arguments so the (name, args_hash) key is observable;",
+    "the unknown tool records the manager's not-found error contract."
+  ],
+  "calls": [
+    { "name": "unity-tool-list", "args": {} },
+    { "name": "unity-tool-list", "args": { "regexSearch": "^scene-", "includeDescription": true } },
+    { "name": "type-get-json-schema", "args": { "typeName": "UnityEngine.Vector3" } },
+    { "name": "chain-record-unknown-tool", "args": {} }
+  ]
+}
```

---

### Incident Patch 15: `97725650` (2026-09-13)
**Commit Message**: ci: dispatchable chain leg for unity-mcp (lock inputs, DLL-drop pre-step, leg records, concurrency, timeouts) (#979)

Make Unity-MCP's test_pull_request.yml dispatchable as chain node unity-mcp: lock inputs, run-name, lock-keyed concurrency, per-job --edges scoped chain_feed apply/record legs with identity proofs, job timeouts, and PR CI on chain-testing

**File**: `.github/workflows/test_cli.yml` (modified, +79/-0)
```diff
@@ -10,17 +10,56 @@ name: test-cli
 
 on:
   workflow_call:
+    inputs:
+      # Chain leg contract (chain_feed.py §C1): the caller forwards its workflow_dispatch inputs. Empty on an
+      # ordinary pull_request run, where the chain feed steps below are no-ops.
+      lock: { required: false, type: string, default: "" }
+      lock_hash8: { required: false, type: string, default: "" }
 
 jobs:
   test-cli:
     runs-on: ubuntu-latest
+    # The tests take a few minutes; a chain dispatch additionally self-builds ReflectorNet,
+    # McpPlugin, the linux-x64 GameDev-MCP-Server and cli-core from the lock before them.
+    timeout-minutes: 30
     strategy:
+      # Every matrix job writes its OWN chain leg record. With the default fail-fast, one leg failing
+      # (e.g. a lock whose lower-node sha does not exist) cancels its sibling before that sibling's
+      # record step runs, leaving the chain verdict one record short. Matches test_unity_plugin.yml.
+      fail-fast: false
       matrix:
         node-version: [20, 22]
+    env:
+      CHAIN_LOCK: ${{ inputs.lock }}
+      CHAIN_LOCK_HASH8: ${{ inputs.lock_hash8 }}
     steps:
       - name: Checkout repository
         uses: actions/checkout@v6
 
+      # --- chain feed (chain_feed.py §C4): a no-op on an ordinary PR run ---------------------------------------
+      - name: Setup .NET (chain feed)
+        if: ${{ inputs.lock != '' || contains(join(github.event.pull_request.labels.*.name, ' '), 'train/') }}
+        uses: actions/setup-dotnet@v5
+        with:
+          dotnet-version: |
+            8.0.x
+            9.0.x
+
+      # cli-core declares node >= 22.14, so the lower layers are built on 22 regardless of the
+      # matrix; the matrix Node below is what the unity-mcp-cli tests then run on.
+      - name: Setup Node.js 22 (chain feed)
+        if: ${{ inputs.lock != '' || contains(join(github.event.pull_request.labels.*.name, ' '), 'train/') }}
+        uses: actions/setup-node@v6
+        with:
+          node-version: 22
+
+      # Builds the lock's cli-core tarball and linux-x64 server and exports UNITY_MCP_SERVER_PATH.
+      # No cli test reads that variable today (only the Unity Editor's McpServerManager does), so
+      # the server-binary scope is identity-proven here, not exercised.
+      - name: chain feed
+        id: chain
+        run: python3 .github/scripts/chain_feed.py apply --node unity-mcp --job test-cli-node${{ matrix.node-version }} --edges npm --edges server-binary
+
       - name: Setup Node.js ${{ matrix.node-version }}
         uses: actions/setup-node@v6
         with:
@@ -30,10 +69,50 @@ jobs:
         working-directory: ./cli
         run: npm ci
 
+      # MUST follow `npm ci`, which would undo a --no-save install.
+      - name: chain feed (npm)
+        if: env.CHAIN_ACTIVE == '1'
+        run: python3 .github/scripts/chain_feed.py apply-npm --node unity-mcp --dir cli
+
+      # UNITY_MCP_SERVER_PATH makes the Unity plugin skip its server version match (docs/mcp-server.md),
+      # so a lock whose gamedev-mcp-server base version differs from the CLI's pinned
+      # DEFAULT_SERVER_VERSION is a named caveat in the leg record (a warning — it never turns the leg RED).
+      - name: chain pin drift (server-binary)
+        if: env.CHAIN_ACTIVE == '1'
+        # A caveat, never a gate: an unreadable lock or pin file must not skip the tests below.
+        continue-on-error: true
+        shell: bash
+        run: |
+          # The lock is dispatch input: only a plain version string may reach $GITHUB_ENV (a newline
+          # would inject further variables), so anything else is reported as unreadable instead.
+          locked=$(python3 -c 'import json,os,re; v=(json.load(open(os.environ["CHAIN_LOCK_PATH"]))["nodes"].get("gamedev-mcp-server") or {}).get("base_version", ""); print(v if isinstance(v, str) and re.fullmatch(r"[0-9]+(\.[0-9]+){0,3}(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?", v) else ("unreadable" if v else ""))')
+          pinned=$(sed -n "s/^export const DEFAULT_SERVER_VERSION = '\([^']*\)'.*/\1/p" cli/src/utils/server-version.ts || true)
+          echo "gamedev-mcp-server: lock base_version='$locked', cli DEFAULT_SERVER_VERSION='$pinned'"
+          if [ -n "$locked" ] && [ -z "$pinned" ]; then
+            echo "CHAIN_PIN_WARN=pin drift not checked: DEFAULT_SERVER_VERSION could not be read from cli/src/utils/server-version.ts (lock base_version $locked)" >> "$GITHUB_ENV"
+          elif [ -n "$locked" ] && [ "$locked" != "$pinned" ]; then
+            echo "CHAIN_PIN_WARN=pin drift: gamedev-mcp-server lock base_version $locked != cli/src/utils/server-version.ts DEFAULT_SERVER_VERSION $pinned (UNITY_MCP_SERVER_PATH makes the Unity plugin skip its version match)" >> "$GITHUB_ENV"
+          fi
+
       - name: Build TypeScript
         working-directory: ./cli
         run: npm run build
 
       - name: Run tests
         working-directory: ./cli
         run: npm test
+
+      # --- chain leg
```

**File**: `.github/workflows/test_pull_request.yml` (modified, +84/-2)
```diff
@@ -8,13 +8,48 @@
 
 name: test-pull-request
 
+# Chain leg contract (software `.scripts/chain/leg/chain_feed.py`, §C1-C5) for node `unity-mcp`.
+# A `workflow_dispatch` carries ONE lock JSON + its hash8. Each job self-builds ONLY the lower layers
+# its own `--edges` scope consumes, from the lock's SHAs, and proves identity for exactly that scope
+# in a per-job leg record (`apply` and `record` always take the SAME `--edges`):
+#   engine-free-tests  --edges nuget                        (ReflectorNet + McpPlugin nupkgs)
+#   test-unity-*       --edges unity-dll                    (the 3 netstandard2.1 DLL drops)
+#   test-cli           --edges npm --edges server-binary    (cli-core tarball + GameDev-MCP-Server)
+# On an ordinary pull_request the vendored script is a no-op (`chain: no lock (ordinary run)`), so
+# the chain steps change nothing there. A pull_request carrying a `train/` label is the exception: it
+# takes its lock from the PR body (chain_feed.py §C7), which is why the toolchain setup steps test it.
 on:
   workflow_dispatch:
+    inputs:
+      lock:
+        description: the chain lock JSON (<= 60000 characters)
+        required: true
+        type: string
+      lock_hash8:
+        description: first 8 hex characters of the lock hash
+        required: true
+        type: string
 
   pull_request:
-    branches: [main, dev]
+    branches: [main, dev, chain-testing]
     types: [opened, synchronize, reopened]
 
+# Guarded: `inputs` is empty on pull_request, so ordinary PR runs keep GitHub's default title.
+run-name: ${{ github.event_name == 'workflow_dispatch' && format('chain {0} unity-mcp', inputs.lock_hash8) || '' }}
+
+# Lock-keyed for dispatch events, so a re-dispatch of the same lock queues behind the first and
+# different locks run independently. cancel-in-progress is false: a RUNNING run is never cancelled,
+# because a queued run is preferable to cancelling 12 game-ci legs, and runaway runs are bounded by
+# the per-job timeouts instead. GitHub still keeps only ONE pending run per group, so a third run
+# arriving while one runs and one waits replaces (cancels) the waiting one.
+concurrency:
+  group: ${{ github.event_name == 'workflow_dispatch' && format('chain-{0}-{1}', inputs.lock_hash8, github.workflow) || format('test-pr-{0}-{1}', github.workflow, github.event.pull_request.number || github.ref) }}
+  cancel-in-progress: false
+
+env:
+  CHAIN_LOCK: ${{ inputs.lock }}
+  CHAIN_LOCK_HASH8: ${{ inputs.lock_hash8 }}
+
 jobs:
   save-event-file:
     runs-on: ubuntu-latest
@@ -48,7 +83,9 @@ jobs:
   engine-free-tests:
     name: engine-free tests (.NET 8)
     runs-on: ubuntu-latest
-    timeout-minutes: 10
+    # 10 min covered the test alone; a chain dispatch also clones, builds and packs ReflectorNet and
+    # McpPlugin (its `nuget` scope) before it.
+    timeout-minutes: 30
     steps:
       - uses: actions/checkout@v6
 
@@ -57,11 +94,44 @@ jobs:
         with:
           dotnet-version: "8.0.x"
 
+      # --- chain feed (chain_feed.py §C4): a no-op on an ordinary PR run ---------------------------------------
+      - name: Setup .NET 9 (chain feed)
+        if: ${{ inputs.lock != '' || contains(join(github.event.pull_request.labels.*.name, ' '), 'train/') }}
+        uses: actions/setup-dotnet@v5
+        with:
+          dotnet-version: |
+            8.0.x
+            9.0.x
+
+      # Scope `nuget`: EngineFree.csproj is this node's NuGet override target, so the job builds
+      # ReflectorNet + McpPlugin into the local feed and proves what its project.assets.json resolved.
+      - name: chain feed
+        id: chain
+        run: python3 .github/scripts/chain_feed.py apply --node unity-mcp --job engine-free-tests --edges nuget
+
       - name: Test
         run: dotnet test Unity-MCP-Plugin/Tests~/EngineFree/EngineFree.csproj -c Release --logger trx -- RunConfiguration.TreatNoTestsAsError=true
 
+      # --- chain leg record (chain_feed.py §C5) ----------------------------------------------------------------
+      - name: chain leg record
+        id: chain_record
+        if: always()
+        run: python3 .github/scripts/chain_feed.py record --node unity-mcp --job engine-free-tests --edges nuget --job-status "${{ job.status }}" --out chain-leg.json
+
+      # Keyed on the record's own output, not CHAIN_ACTIVE (which only a COMPLETED apply exports),
+      # so a failed apply's RED record still uploads.
+      - name: chain leg artifact
+        if: always() && steps.chain_record.outputs.artifact_name != ''
+        uses: actions/upload-artifact@v6
+        with:
+          name: ${{ steps.chain_record.outputs.artifact_name }}
+          path: chain-leg.json
+
   test-cli:
     uses: ./.github/workflows/test_cli.yml
+    with:
+      lock: ${{ inputs.lock }}
+      lock_hash8: ${{ inputs.lock_hash8 }}
 
   # NOTE: the MCP server is no longer built from this repo — the plugin consumes the shared
   # GameDev-MCP-Server (https://github.com/IvanMurzak/GameDev-MCP-Serv
```

**File**: `.github/workflows/test_unity_plugin.yml` (modified, +52/-0)
```diff
@@ -17,6 +17,10 @@ on:
       projectPath: { required: true, type: string }
       unityVersion: { required: true, type: string }
       testMode: { required: true, type: string }
+      # Chain leg contract (chain_feed.py §C1): the caller forwards its workflow_dispatch inputs. Empty on an
+      # ordinary pull_request run, where the chain feed steps below are no-ops.
+      lock: { required: false, type: string, default: "" }
+      lock_hash8: { required: false, type: string, default: "" }
     secrets:
       # Stored Unity Personal license (.ulf XML). Generated once via the
       # generate-unity-activation-file workflow + https://license.unity3d.com/manual
@@ -47,6 +51,12 @@ jobs:
 
     name: ${{ inputs.unityVersion }} ${{ inputs.testMode }} on ${{ matrix.platform }}
     runs-on: ${{ matrix.os }}
+    # Measured ~4-22 min per leg (standalone ~4-7, editmode ~10-16). Without a cap a hung leg ran to GitHub's 360-min default, which is
+    # where the ~4,500-min zombie runs in this workflow's history came from.
+    timeout-minutes: 45
+    env:
+      CHAIN_LOCK: ${{ inputs.lock }}
+      CHAIN_LOCK_HASH8: ${{ inputs.lock_hash8 }}
 
     steps:
       # --------------------------------------------------------------------- #
@@ -69,6 +79,31 @@ jobs:
           large-packages: true
           swap-storage: true
 
+      # --------------------------------------------------------------------- #
+      # 2-b'. Chain feed (chain_feed.py §C4) — a no-op on an ordinary PR run.
+      #
+      # Builds ReflectorNet + McpPlugin + McpPlugin.Common (netstandard2.1) at
+      # the lock's SHAs on the HOST and copies the 3 DLLs over the 6 flat
+      # Assets/Plugins/NuGet drops (.dll.meta and .nuget-installed.json are left
+      # untouched). This MUST finish before game-ci mounts the checkout into the
+      # Unity container, which only reads it. Placed after "Free disk space",
+      # which removes the runner's preinstalled .NET.
+      # --------------------------------------------------------------------- #
+      - name: Setup .NET (chain feed)
+        if: ${{ inputs.lock != '' || contains(join(github.event.pull_request.labels.*.name, ' '), 'train/') }}
+        uses: actions/setup-dotnet@v5
+        with:
+          dotnet-version: |
+            8.0.x
+            9.0.x
+
+      # Scope `unity-dll`: a game-ci leg consumes only the 3 DLL drops. The CLI, the server binary and
+      # the engine-free NuGet project are not this job's, so they are not built here and each appears
+      # in the leg record's skipped[] instead of being proven.
+      - name: chain feed
+        id: chain
+        run: python3 .github/scripts/chain_feed.py apply --node unity-mcp --job test-unity-${{ inputs.unityVersion }}-${{ inputs.testMode }}-${{ matrix.platform }} --edges unity-dll
+
       # --------------------------------------------------------------------- #
       # 2-c. Cache & run the Unity test-runner
       #
@@ -118,3 +153,20 @@ jobs:
           name: Test results for ${{ inputs.unityVersion }} ${{ inputs.testMode }} on ${{ matrix.platform }}
           path: ${{ steps.tests.outputs.artifactsPath }}
 
+      # --------------------------------------------------------------------- #
+      # 2-d. Chain leg record (chain_feed.py §C5) — one artifact per job (12 distinct names)
+      # --------------------------------------------------------------------- #
+      - name: chain leg record
+        id: chain_record
+        if: always()
+        run: python3 .github/scripts/chain_feed.py record --node unity-mcp --job test-unity-${{ inputs.unityVersion }}-${{ inputs.testMode }}-${{ matrix.platform }} --edges unity-dll --engine unity --engine-version ${{ inputs.unityVersion }} --job-status "${{ job.status }}" --out chain-leg.json
+
+      # Keyed on the record's own output, not CHAIN_ACTIVE (which only a COMPLETED apply exports),
+      # so a failed apply's RED record still uploads.
+      - name: chain leg artifact
+        if: always() && steps.chain_record.outputs.artifact_name != ''
+        uses: actions/upload-artifact@v6
+        with:
+          name: ${{ steps.chain_record.outputs.artifact_name }}
+          path: chain-leg.json
+
```

#### Recent Merged Pull Requests:
- **PR #1006** (2026-10-04): console-get-logs: post-merge quality pass on the sequence cursor (#1005) (@IvanMurzak)
- **PR #1005** (2026-10-03): console-get-logs: honour includeStackTrace, add sinceSequence cursor (@IvanMurzak)
- **PR #1003** (2026-09-28): ci: re-enable Library cache for Unity 6000.6 and drop stale burst/ilpp pid files (@IvanMurzak)
- **PR #1000** (2026-09-27): ci: skip the Library cache for Unity 6000.6+ legs (@IvanMurzak)
- **PR #999** (2026-09-27): chore(release): 0.93.2 (@IvanMurzak)
- **PR #998** (2026-09-27): chore(cli): upgrade vitest to 4.1.11 (0 audit findings) (@IvanMurzak)
- **PR #997** (2026-09-27): ci: add Unity 6000.6.3f1 to the test matrix (@IvanMurzak)
- **PR #996** (2026-09-27): chore(chain): vendor chain_feed.py v5 (Unity-Tests/6000.6.3f1 drop) (@IvanMurzak)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
